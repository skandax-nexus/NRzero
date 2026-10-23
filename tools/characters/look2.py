"""Look v2 (docs/CHARACTER_LOOK.md, "Cast rebuild"): the generator side of the realistic look.

Everything here is our own code on top of the MakeHuman base mesh (CC0) and its default rig weights; no model, texture
or motion from anywhere else. build_humans.py calls into this module when LOOK2 is on (the default; LOOK=1 builds the
classic cast exactly as before).

- rig: face bones (jaw, eyes, upper / lower lids, brows, mouth corners) and three bones per finger, added under the
  21 body bones the motion capture retargets onto (names and rest orientation of those 21 are unchanged, so
  assets/models/anims.glb keeps playing; the new bones have no tracks and are driven at run time by src/human/skin.js
  and src/human/rig2.js). Weights: the generator keeps working with the 21-bone weights everywhere and splits the head
  and hand weights onto the new bones only when it writes vertex groups (expand_weights), from MakeHuman's own face
  and finger weights.
- eyes: an eyeball per side (sphere with a cornea bulge) on its eye bone; a mouth interior (MakeHuman's teeth and
  tongue helpers, the inner mouth painted dark with depth).
- hair: strand cards (hair_cards) grown from the hair volume along per-style flow fields, with our procedural strand
  texture (strand_texture); lash and brow cards. One extra skinned mesh `gh_<id>` with material `<id>_hair`.
- skin and cloth texture content: paint_skin (region colour, age, beard shadow, freckles / age spots, knuckles and
  nails, the inner mouth), skin_height (creases and pores baked into the normal map), cloth_folds (fold and seam relief
  at the joints), the roughness / occlusion map.
"""
import json
import math
import os

import numpy as np

import bpy
import bmesh
from mathutils import Vector as V, kdtree

import mh

BH = None   # build_humans (bound by bind())


def bind(mod):
    global BH
    BH = mod


ON = os.environ.get("LOOK", "2") != "1"

# ---------------------------------------------------------------------------------------------------------------
# rig
# ---------------------------------------------------------------------------------------------------------------
FACE = ["jaw", "eye_L", "eye_R", "lid_L", "lid_R", "lidlo_L", "lidlo_R", "brow_L", "brow_R", "mouth_L", "mouth_R"]
FINGERS = ["thumb", "index", "middle", "ring", "pinky"]
FINGER_BONES = [f"{f}{k}_{s}" for s in "LR" for f in FINGERS for k in (1, 2, 3)]
FINE = FACE + FINGER_BONES
# MakeHuman bone -> fine bone (the rest fold onto the 21 body bones as before)
FINE_MAP = {"jaw": "jaw", "special04": "jaw", "oris01": "jaw", "oris07.L": "jaw", "oris07.R": "jaw", "levator05.L": "jaw", "levator05.R": "jaw"}
for _t in ("tongue00", "tongue01", "tongue02", "tongue03", "tongue04", "tongue05.L", "tongue05.R", "tongue06.L", "tongue06.R", "tongue07.L", "tongue07.R"):
    FINE_MAP[_t] = "jaw"
for _s in "LR":
    FINE_MAP.update({f"eye.{_s}": f"eye_{_s}", f"orbicularis03.{_s}": f"lid_{_s}", f"orbicularis04.{_s}": f"lidlo_{_s}",
                     f"oculi01.{_s}": f"brow_{_s}", f"risorius03.{_s}": f"mouth_{_s}"})
    for _f in range(1, 6):
        for _k in (1, 2, 3):
            FINE_MAP[f"finger{_f}-{_k}.{_s}"] = f"{FINGERS[_f - 1]}{_k}_{_s}"


def all_bones():
    return BH.BONE_NAMES + FINE


def _fine_matrix(n):
    """(n, 21 + fine) MakeHuman weights with the face and finger bones kept apart, rows normalised."""
    names = all_bones()
    ix = {b: i for i, b in enumerate(names)}
    W = np.zeros((n, len(names)))
    for mhb, lst in BH.skel()["w"].items():
        j = ix[FINE_MAP.get(mhb) or BH.our_bone(mhb)]
        for vi, w in lst:
            if vi < n:
                W[vi, j] += w
    s = W.sum(1)
    W[s < 1e-9, ix["hips"]] = 1.0
    return W / W.sum(1, keepdims=True)


_FAM = {}


def families():
    """head family (head + face bones) and the two hand families (hand + its fingers), as column indices."""
    if not _FAM:
        names = all_bones()
        ix = {b: i for i, b in enumerate(names)}
        _FAM["head"] = [ix["head"]] + [ix[b] for b in FACE]
        for s in "LR":
            _FAM["hand_" + s] = [ix["hand_" + s]] + [ix[b] for b in FINGER_BONES if b.endswith("_" + s)]
    return _FAM


class _Split:
    """Per character: fine fractions of the head and hand weights at every body vertex, and a kd-tree to look them up."""
    def __init__(self, B):
        Wf = _fine_matrix(len(B.P))
        self.frac = {}
        for k, cols in families().items():
            sub = Wf[:, cols]
            s = sub.sum(1, keepdims=True)
            f = np.where(s > 1e-6, sub / np.maximum(s, 1e-9), 0.0)
            f[s[:, 0] <= 1e-6, 0] = 1.0
            self.frac[k] = f
        bv = B.bodyv
        self.idx = bv
        Q = BH.to_bl_np(B.P[bv])
        self.kd = kdtree.KDTree(len(Q))
        for i, p in enumerate(Q):
            self.kd.insert(V(p), i)
        self.kd.balance()


HEADSPLIT = ("skin", "lash", "brow", "beard", "tongue", "teeth_lo", "mouth")
NOSPLIT = ("gp_", "gx_", "gadget", "strap_", "pouch", "buckle", "panel", "knot", "helmet")


def expand_weights(o, W, B):
    """21-column weights of object o -> all bones (face / finger split from the nearest body vertices)."""
    names = all_bones()
    n = len(W)
    out = np.zeros((n, len(names)))
    out[:, :W.shape[1]] = W
    if not ON:
        return out
    fb = o.get("fine_bone")
    if fb:                       # eyeballs, lower teeth, tongue: one bone
        out[:] = 0
        out[:, names.index(fb)] = 1.0
        return out
    nm = o.name
    if nm.startswith(NOSPLIT):
        return out
    fl = o.get("fine_list")
    if fl:                       # hair cards: lashes on their lid bone, brows / beard split like the skin under them
        fl = json.loads(fl)
        split = np.array([f == "@split" for f in fl])
        for i, f in enumerate(fl):
            if f and f != "@split":
                out[i] = 0
                out[i, names.index(f)] = 1.0
        if not split.any():
            return out
        Wm = W.copy()
        Wm[~split] = 0
        sub = expand_weights_split(o, Wm, B, ["head"], split)
        out[split] = sub[split]
        return out
    out = expand_weights_split(o, W, B, ["hand_L", "hand_R"] + (["head"] if nm.startswith(HEADSPLIT) else []), None, out)
    if nm.startswith("skin") and os.environ.get("MOUTH_FIX") != "0":
        _mouth_fix(o, out, B)
    return out


def _mouth_fix(o, out, B):
    """The lips part cleanly when the jaw opens: MakeHuman's lip bones leave some jaw weight on vertices of the upper
    lip's inner edge (a zigzag of skin hanging into the open mouth); above the lips' contact line it goes to the head,
    and the lower lip's inner edge follows the jaw in full."""
    names = all_bones()
    j, h = names.index("jaw"), names.index("head")
    L = B.L
    xs, ys = L.lip_line
    pts = BH.from_bl_np(BH.obj_world_verts(o))
    near = (np.abs(pts[:, 0] - L.lip_cx) < L.lip_w * 1.25) & (np.abs(pts[:, 1] - L.mouth[1]) < 0.022) & (pts[:, 2] > L.lip_z - 0.04)
    d = pts[:, 1] - np.interp(pts[:, 0], xs, ys)
    d0 = d.copy()
    # vertices on the contact line itself (upper and lower lip rows touch there) take the side of their neighbours
    online = near & (np.abs(d) <= 0.0012) & (np.abs(pts[:, 0] - L.lip_cx) < L.lip_w * 1.05)
    if online.any():
        nb_sum = np.zeros(len(pts))
        nb_cnt = np.zeros(len(pts))
        ev = np.zeros(len(o.data.edges) * 2, dtype=np.int64)
        o.data.edges.foreach_get("vertices", ev)
        ev = ev.reshape(-1, 2)
        for a_, b_ in ((0, 1), (1, 0)):
            va, vb = ev[:, a_], ev[:, b_]
            m_ = online[va] & ~online[vb]
            np.add.at(nb_sum, va[m_], d[vb[m_]])
            np.add.at(nb_cnt, va[m_], 1)
        side = np.where(nb_cnt > 0, nb_sum / np.maximum(nb_cnt, 1), 0.0)
        d = np.where(online & (nb_cnt > 0), np.sign(side) * 0.0013, d)
    if os.environ.get("MOUTH_RIM") != "0" and getattr(L, "rim_up", None) and os.environ.get("MOUTH_FIX_V1") != "1":
        # proto:makehuman: the split by topology. The upper and lower rims of the mouth opening run within a millimetre of
        # each other (MakeHuman's contact line is not a straight row), so a split by height left single rim vertices on
        # the wrong bone: fangs of lip hanging into the open mouth. Each rim chain goes to its bone in full (corners half
        # way), and the share fades back to MakeHuman's own weights over the next rings of the lip and the mouth bag.
        _mouth_rims(o, out, B, pts, j, h)
        if os.environ.get("MOUTH_SLIT") != "0":
            _mouth_slit(o, out, pts, near, d0, L, j)
        return
    if os.environ.get("MOUTH_FIX_V1") == "1":
        up = near & (d > 0.0002) & (out[:, j] > 0)
        out[up, h] += out[up, j]
        out[up, j] = 0.0
        lo = near & (d < -0.0002) & (d > -0.012) & ((out[:, j] > 0.15) | online) & (np.abs(pts[:, 0] - L.lip_cx) < L.lip_w * 1.05)
        out[lo, j] += out[lo, h]
        out[lo, h] = 0.0
    else:
        # hero pipeline v7: one smooth split of the head + jaw share by height over the contact line: sharp in the
        # middle (the lips part cleanly along the removed slit), softening toward the corners (the commissure opens
        # as a smooth V instead of a zigzag of stretched faces), fading back to MakeHuman's weights 5-12 mm away
        ax = np.abs(pts[:, 0] - L.lip_cx) / max(L.lip_w, 1e-4)
        zone = near & (ax < 1.25) & (np.abs(d) < 0.012)
        cs = BH.ss(0.7, 1.08, ax)
        sw = 0.0004 + 0.0035 * cs
        jt = 0.5 - 0.5 * np.tanh(d / sw)
        kb = BH.ss(0.012, 0.005, np.abs(d)) * BH.ss(1.25, 1.02, ax) * zone
        tot = out[:, j] + out[:, h]
        nj = out[:, j] * (1 - kb) + tot * jt * kb
        out[:, j] = nj
        out[:, h] = tot - nj
    if os.environ.get("MOUTH_SLIT") != "0":
        _mouth_slit(o, out, pts, near, d0, L, j)


def _mouth_rims(o, out, B, pts, j, h, rings=5):
    rings_up = rings + 3
    L = B.L
    kd = kdtree.KDTree(len(pts))
    for i, p in enumerate(pts):
        kd.insert(V(p), i)
    kd.balance()

    def find(idx):
        r = []
        for vi in idx:
            co, i, dd = kd.find(V(B.P[vi]))
            if dd < 2e-4:
                r.append(i)
        return r
    up, lo = set(find(L.rim_up)), set(find(L.rim_lo))
    corners = up & lo
    if len(up) < 4 or len(lo) < 4:
        print("  mouth rims: not found in the skin layer", flush=True)
        return
    ev = np.zeros(len(o.data.edges) * 2, dtype=np.int64)
    o.data.edges.foreach_get("vertices", ev)
    ev = ev.reshape(-1, 2)
    box = (np.abs(pts[:, 0] - L.lip_cx) < L.lip_w * 1.6) & (np.abs(pts[:, 1] - L.mouth[1]) < 0.035) & (pts[:, 2] > L.lip_z - 0.12)
    nbr = {}
    for a_, b_ in ev:
        if box[a_] and box[b_]:
            nbr.setdefault(int(a_), []).append(int(b_))
            nbr.setdefault(int(b_), []).append(int(a_))

    def bfs(src):
        dist = {v: 0 for v in src}
        fr = list(src)
        for r in range(1, rings + 1):
            nx = []
            for v in fr:
                for u in nbr.get(v, ()):
                    if u not in dist:
                        dist[u] = r
                        nx.append(u)
            fr = nx
        return dist
    rings0 = rings
    rings = rings_up
    du = bfs(up - corners)
    rings = rings0
    dl = bfs(lo - corners)
    tot = out[:, j] + out[:, h]
    jw = np.where(tot > 1e-6, out[:, j] / np.maximum(tot, 1e-6), 0.0)
    new = jw.copy()
    ax = np.abs(pts[:, 0] - L.lip_cx) / max(L.lip_w, 1e-4)
    for v in set(du) | set(dl):
        a_, b_ = du.get(v, 99), dl.get(v, 99)
        if a_ == b_:
            new[v] = 0.5 if a_ <= 1 else jw[v]
            continue
        # how far the bone of the nearer rim holds: full on the rim, MakeHuman's weight `rings` rings away; toward the
        # corners the fade is quicker (the commissure stretches as a smooth V)
        r_ = min(a_, b_)
        k_ = 1.0 - BH.ss(0.0, rings - 1.5 * float(BH.ss(0.75, 1.0, ax[v])), r_)
        if a_ < b_:
            # the upper lip stays on the head over its whole height (a share of MakeHuman's jaw weight on the vermilion
            # let it sag over the upper teeth when the jaw opened)
            ku = (1.0 - BH.ss(2.0, rings + 3.0, r_)) * BH.ss(1.0, 0.8, ax[v])
            new[v] = min(jw[v], jw[v] * (1 - max(k_, ku)))
        else:
            new[v] = max(jw[v], jw[v] + (1 - jw[v]) * k_)
    for v in corners:
        new[v] = 0.5
    out[:, j] = tot * new
    out[:, h] = tot * (1 - new)
    # the rims close at rest: each rim vertex moves to 0.15 mm from the middle line between the two rims (the open
    # gap of up to 1.5 mm showed the teeth as a white line between the closed lips)
    me = o.data
    co = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    U, Lo = sorted(up - corners), sorted(lo - corners)
    if U and Lo:
        PU, PL = pts[U], pts[Lo]
        M = np.array(o.matrix_world)
        Minv = np.linalg.inv(M[:3, :3])
        for grp, other, sg in ((U, PL, 1.0), (Lo, PU, -1.0)):
            for vi in grp:
                p = pts[vi]
                q = other[np.argmin(np.abs(other[:, 0] - p[0]) + 3 * np.abs(other[:, 2] - p[2]))]
                mid = (p[1] + q[1]) / 2
                ty = mid + sg * 0.00015
                if sg * (p[1] - ty) > 0:
                    dyw = ty - p[1]
                    co[vi] += Minv @ np.array([0.0, 0.0, dyw])      # Blender z = MH y
        me.vertices.foreach_set("co", co.ravel())
        me.update()
    print(f"  mouth rims: {len(up)} upper / {len(lo)} lower rim vertices, {len(set(du) | set(dl))} re-weighted", flush=True)


def _mouth_slit(o, out, pts, near, d0, L, j):
    """Hero pipeline: MakeHuman closes the mouth with a thin strip of faces between the upper and the lower lip's rims
    (the front of the mouth bag). With the lips on the head and on the jaw it stretched into a skin curtain across the
    open mouth, in front of the teeth. The strip's faces (every corner within 1.6 mm of the contact line, mixed jaw
    weights, inside the corners) are removed: the open mouth shows the teeth, the tongue and the dark mouth bag; the
    corners still stretch."""
    me = o.data
    zone = near & (np.abs(d0) < 0.0016) & (np.abs(pts[:, 0] - L.lip_cx) < L.lip_w * 0.88)
    h = all_bones().index("head")
    # vertices the height split left half-way (on the contact line itself, inside the corners) take the side of their
    # neighbours across the faces that are not part of the strip (a half-way vertex pulled a spike of the mouth bag
    # into the open mouth, and its strip faces escaped the removal)
    tot = out[:, j] + out[:, h]
    jw = np.where(tot > 1e-6, out[:, j] / np.maximum(tot, 1e-6), 0.0)
    polys = [list(p_.vertices) for p_ in me.polygons]
    strip = [all(zone[v] for v in vs) and max(jw[v] for v in vs) - min(jw[v] for v in vs) > 0.3 for vs in polys]
    amb = zone & (jw > 0.15) & (jw < 0.85) & (np.abs(pts[:, 0] - L.lip_cx) < L.lip_w * 0.85)
    if amb.any():
        nbs = {int(v): set() for v in np.nonzero(amb)[0]}
        for vs, st in zip(polys, strip):
            if st:
                continue
            for v in vs:
                if v in nbs:
                    nbs[v].update(vs)
        for _ in range(3):
            for v, nb in nbs.items():
                vals = [jw[u] for u in nb if u != v and not amb[u]]
                if vals:
                    jw[v] = 1.0 if np.mean(vals) > 0.5 else 0.0
                    amb[v] = False
        fix = np.array(list(nbs.keys()))
        out[fix, j] = tot[fix] * jw[fix]
        out[fix, h] = tot[fix] * (1 - jw[fix])
    jw = out[:, j]
    kill = []
    for poly in me.polygons:
        vs = list(poly.vertices)
        if all(zone[v] for v in vs) and max(jw[v] for v in vs) - min(jw[v] for v in vs) > 0.5:
            kill.append(poly.index)
    if not kill:
        return
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in kill], context="FACES_ONLY")
    bm.to_mesh(me)
    bm.free()
    # the rims close again at rest: the strip held them ~1.4 mm apart, which showed the teeth as a white line between
    # the closed lips; each rim vertex moves toward the contact line (0.25 mm short of it, the order kept)
    vs = np.nonzero(zone)[0]
    if len(vs):
        tgt = np.sign(d0[vs]) * np.maximum(0.00025, np.abs(d0[vs]) * 0.3)
        dyw = tgt - d0[vs]                                   # MH y shift (world up)
        M = np.array(o.matrix_world)
        dl = np.linalg.inv(M[:3, :3]) @ np.stack([np.zeros_like(dyw), np.zeros_like(dyw), dyw])   # Blender z = MH y
        co = np.zeros(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        co[vs] += dl.T
        me.vertices.foreach_set("co", co.ravel())
    me.update()
    print(f"  mouth slit: {len(kill)} faces, {len(vs)} rim vertices closed", flush=True)


def expand_weights_split(o, W, B, keys, only=None, out=None):
    names = all_bones()
    n = len(W)
    if out is None:
        out = np.zeros((n, len(names)))
        out[:, :W.shape[1]] = W
    sp = getattr(B, "_split", None)
    if sp is None:
        sp = B._split = _Split(B)
    ix = {b: i for i, b in enumerate(names)}
    fam = families()
    need = np.zeros(n, bool)
    for k in keys:
        need |= W[:, ix[k]] > 1e-4
    if only is not None:
        need &= only
    if not need.any():
        return out
    pts = BH.obj_world_verts(o)
    for i in np.nonzero(need)[0]:
        hits = sp.kd.find_n(V(pts[i]), 3)
        w = np.array([1.0 / max(d, 2e-4) for _, _, d in hits])
        w /= w.sum()
        for k in keys:
            wk = W[i, ix[k]]
            if wk <= 1e-4:
                continue
            f = (w[:, None] * sp.frac[k][[j for _, j, _ in hits]]).sum(0)
            cols = fam[k]
            out[i, cols] = wk * f
    return out


def _axis_x(P, name):
    S = BH.skel()
    b = S["bones"][name]
    h, t = BH.jpos(P, b["head"]), BH.jpos(P, b["tail"])
    p1, p2, p3 = (BH.jpos(P, j) for j in S["planes"][b["rotation_plane"]])
    nn = np.cross(BH.nrm3(p3 - p2), BH.nrm3(p2 - p1))
    y = BH.nrm3(t - h)
    z = BH.nrm3(np.cross(nn, y))
    return np.cross(y, z)


def add_bones(arm, B, eyes):
    """Face and finger bones under the body rig (edit mode). eyes: {side: (centre MH, radius)}. Writes arm['look']
    (run-time metadata: eye centres, finger flexion axes, all in the template's rest space = MakeHuman metres)."""
    P = B.P
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones

    def add(name, h, t, parent):
        b = eb.new(name)
        b.head, b.tail = BH.to_bl(h), BH.to_bl(t)
        b.roll = 0.0
        b.parent = eb[parent]
        b.use_connect = False
    jp = lambda b, e: BH.jpos(P, b + "____" + e)
    add("jaw", jp("jaw", "head"), jp("jaw", "tail"), "head")
    meta = {"v": 2, "eyes": {}, "fingers": {}}
    for s in "LR":
        c, r = eyes[s]
        add("eye_" + s, c, c + np.array([0, 0, r]), "head")
        add("lid_" + s, c, c + np.array([0, 0.35 * r, r]), "head")
        add("lidlo_" + s, c, c + np.array([0, -0.35 * r, r]), "head")
        add("brow_" + s, jp(f"oculi01.{s}", "head"), jp(f"oculi01.{s}", "tail"), "head")
        add("mouth_" + s, jp(f"risorius03.{s}", "head"), jp(f"risorius03.{s}", "tail"), "head")
        meta["eyes"][s] = [round(float(x), 5) for x in list(c) + [r]]
        for f in range(1, 6):
            par = "hand_" + s
            for k in (1, 2, 3):
                mhb = f"finger{f}-{k}.{s}"
                nm = f"{FINGERS[f - 1]}{k}_{s}"
                add(nm, jp(mhb, "head"), jp(mhb, "tail"), par)
                ax = _axis_x(P, mhb)
                meta["fingers"][nm] = [round(float(x), 4) for x in ax]
                par = nm
    bpy.ops.object.mode_set(mode="OBJECT")
    arm["look"] = json.dumps(meta)
    return meta


# ---------------------------------------------------------------------------------------------------------------
# eyes and the mouth interior
# ---------------------------------------------------------------------------------------------------------------
def eye_spheres(B):
    """{side: (centre, radius)} of the cornea shells of MakeHuman's eye proxy (MH metres; 'L' = +x)."""
    ev, ef = BH.fit_proxy("eyes/high-poly/high-poly.mhclo", B.P * 10)
    par = list(range(len(ev)))

    def find(a):
        while par[a] != a:
            par[a] = par[par[a]]
            a = par[a]
        return a
    for f in ef:
        for v in f[1:]:
            par[find(v)] = find(f[0])
    comps = {}
    for i in range(len(ev)):
        comps.setdefault(find(i), []).append(i)
    out = {}
    for side, sg in (("L", 1), ("R", -1)):
        cs = [vs for vs in comps.values() if np.sign(ev[vs, 0].mean()) == sg]
        vs = max(cs, key=lambda vs: ev[vs, 2].max())
        cen, rad = BH.sphere_fit(ev[vs])
        out[side] = (cen, rad)
    return out


def eyeball(name, cen, rad, side):
    """Eyeball: a sphere whose front cap bulges into a cornea (0.55 mm at the apex, the limbus at ~30 degrees), uv'd
    into the atlas eye disc exactly like the classic shell (polar angle from the front -> disc radius)."""
    polar = [0, 3, 7, 11, 15, 19, 23, 27, 31, 36, 44, 55, 70, 90, 115, 145, 180]
    na = 18
    verts, uvs = [], []
    limb = math.radians(31)
    for p in polar:
        ph = math.radians(p)
        bulge = 0.00055 * max(0.0, 1 - (ph / limb) ** 2) ** 1.5
        r = rad * 0.992 + bulge
        for k in range(na if p not in (0, 180) else 1):
            al = 2 * math.pi * k / na
            d = np.array([math.sin(ph) * math.cos(al), math.sin(ph) * math.sin(al), math.cos(ph)])
            verts.append(cen + d * r)
            rr = min(ph / (math.pi / 2), 1.0)
            uvs.append((0.5 + 0.47 * rr * math.cos(al), 0.5 + 0.47 * rr * math.sin(al)))
    faces = []
    rows = []
    i = 0
    for p in polar:
        cnt = 1 if p in (0, 180) else na
        rows.append(list(range(i, i + cnt)))
        i += cnt
    for a, b in zip(rows[:-1], rows[1:]):
        if len(a) == 1:
            for k in range(na):
                faces.append([a[0], b[(k + 1) % na], b[k]])
        elif len(b) == 1:
            for k in range(na):
                faces.append([a[k], a[(k + 1) % na], b[0]])
        else:
            for k in range(na):
                faces.append([a[k], a[(k + 1) % na], b[(k + 1) % na], b[k]])
    # outward winding: the classic shell faces out; check one face and flip if needed
    v = np.array(verts)
    f0 = faces[na + 3]
    nrm = np.cross(v[f0[1]] - v[f0[0]], v[f0[2]] - v[f0[0]])
    if nrm @ (v[f0[0]] - cen) < 0:
        faces = [f[::-1] for f in faces]
    uvv = BH.cell_uv("eye", np.array([u for u, _ in uvs]), np.array([w for _, w in uvs]), inset=0.0)
    o = BH.mesh_from(name, BH.to_bl_np(v), faces, [uvv[j] for f in faces for j in f])
    BH.set_mask(o, (0.0, 1.0, 0.0))
    W = np.zeros((len(o.data.vertices), len(BH.BONE_NAMES)))
    W[:, BH.BI["head"]] = 1
    BH.WSTORE[o.name] = W
    o["fine_bone"] = "eye_" + side
    return o


# the mouth cell (the classic lash cell: v2 lashes are strand cards): teeth in a < 0.36, gums / tongue 0.36-0.7,
# the dark cavity beyond
MOUTH_CELL = "lash"


TOOTH_W = [0.0085, 0.0066, 0.0076, 0.0070, 0.0068, 0.0100, 0.0098]    # central incisor -> second molar (m, adult)
TEETH_HALF = 0.036                                                     # half arch length painted in the mouth cell


def _teeth_arch(P, upper, a0, a1, k):
    """A smooth dental arch over a teeth helper's points (MH coordinates): returns (points, quads, uv (a, b))."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    xm = max(np.abs(x).max(), 0.012)
    nb = 25
    xs = np.linspace(-xm, xm, nb)
    zf, yg, ye = [], [], []
    for xc in xs:
        m = np.abs(x - xc) < xm / nb * 1.6
        if m.sum() < 2:
            m = np.argsort(np.abs(x - xc))[:4]
        zf.append(z[m].max())
        yg.append(y[m].max() if upper else y[m].min())
        ye.append(y[m].min() if upper else y[m].max())
    sm = lambda v: np.convolve(np.pad(np.asarray(v), 2, mode="edge"), np.ones(5) / 5, mode="valid")
    zf, yg, ye = sm(zf), sm(yg), sm(ye)
    # crown height: incisors ~10 mm (upper) / 8.5 mm (lower) visible, less toward the molars
    hmax = (0.0095 if upper else 0.0085) * k
    sgn = -1 if upper else 1
    t = np.abs(xs) / xm
    hh = hmax * (1 - 0.25 * t)
    if os.environ.get("TEETH_GUM") == "1":      # (before the hero pipeline fix: anchored at the helper's gum line)
        ye = yg + sgn * np.minimum(np.abs(yg - ye), hh)
    else:
        # anchored at the biting edge (MakeHuman's helpers meet at the lips' contact line; their gum line sits ~18 mm
        # up, so a gum-anchored crown ended 7-10 mm above the lips and the open mouth showed no teeth): the upper
        # incisal edge 3.2 mm lower, the lower 2 mm lower (the upper teeth show under the upper lip when the jaw opens,
        # an overbite of ~1.2 mm, the lower arch sits behind), the crown height up from there
        ye = ye + (-0.0032 if upper else -0.0020) * k
        yg = ye - sgn * hh
    # arc length for b (centre 0.5), the lingual side 3.5 mm in along the arch normal
    pts = np.stack([xs, (yg + ye) / 2, zf], 1)
    d = np.gradient(pts[:, [0, 2]], axis=0)
    d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    nrm = np.stack([d[:, 1], -d[:, 0]], 1)          # outward (toward +z at the front)
    if nrm[nb // 2, 1] < 0:
        nrm = -nrm
    seg = np.linalg.norm(np.diff(pts[:, [0, 2]], axis=0), axis=1)
    arc = np.concatenate([[0], np.cumsum(seg)])
    arc -= arc[nb // 2]
    b = 0.5 + 0.45 * np.clip(arc / (TEETH_HALF * k), -1, 1)
    th = 0.0035 * k
    rows = []          # (y, inward offset, a)
    rows.append((yg, 0.0, a0))
    rows.append((yg + (ye - yg) * 0.55, 0.0003, a0 + (a1 - a0) * 0.55))
    rows.append((ye, 0.0009, a1 * 0.97))
    rows.append((ye, th * 0.6, a1))
    rows.append((yg, th, a1))
    V_, UV_ = [], []
    for (yy, off, aa) in rows:
        for i in range(nb):
            V_.append([xs[i] - nrm[i, 0] * off, yy[i] if np.ndim(yy) else yy, zf[i] - nrm[i, 1] * off])
            UV_.append([aa, b[i]])
    V_, UV_ = np.array(V_), np.array(UV_)
    quads = []
    for r in range(len(rows) - 1):
        for i in range(nb - 1):
            q = [r * nb + i, r * nb + i + 1, (r + 1) * nb + i + 1, (r + 1) * nb + i]
            quads.append(q[::-1] if upper else q)     # faces out (labial side toward +z)
    return V_, quads, UV_


# proto:makehuman teeth: one crown per tooth along a smooth dental arch (U-shaped: z = z0 - 25 x^2 - 25 000 x^4),
# (mesio-distal width, crown height, labio-lingual depth) in mm, central incisor -> second molar
CROWNS_UP = [(8.6, 10.4, 7.0), (6.6, 8.8, 6.2), (7.6, 9.8, 8.0), (7.0, 8.2, 9.0), (6.6, 7.6, 9.0), (10.0, 7.2, 11.0), (9.0, 6.8, 10.5)]
CROWNS_LO = [(5.3, 9.0, 6.0), (5.9, 9.3, 6.3), (6.9, 10.6, 7.6), (7.0, 8.3, 7.8), (7.1, 8.0, 8.2), (11.0, 7.4, 10.4), (10.5, 7.0, 10.0)]


def _arch_curve(z0, k, n=400, xmax=0.034):
    xs = np.linspace(0, xmax * k, n)
    zs = z0 - 25.0 / k * xs ** 2 - 25000.0 / k ** 3 * xs ** 4
    seg = np.hypot(np.diff(xs), np.diff(zs))
    arc = np.concatenate([[0], np.cumsum(seg)])
    return xs, zs, arc


def _teeth_crowns(P, upper, k, yc, a0, a1):
    """Individual crowns (proto:makehuman). P: the teeth helper's points (MH, already set back from the lips); yc: the lips'
    contact height at the midline. The upper central incisors end 1.8 mm under the contact line (they show under the upper
    lip as soon as the lips part), the lower incisors' edges sit 1.6 mm higher, 2.4 mm behind (overbite, overjet); the
    occlusal plane rises a little toward the molars. Returns (points, faces, uv (a, b)) with a = gum -> biting edge."""
    z_front = P[:, 2].max()
    if upper:
        z0 = z_front
        UP_Z0[:] = [z0]
    else:
        z0 = UP_Z0[0] - 0.0024 * k if UP_Z0 else z_front - 0.0022 * k
    xs, zs, arc = _arch_curve(z0, k)
    crowns = CROWNS_UP if upper else CROWNS_LO
    sgn = 1.0 if upper else -1.0              # crowns grow up (upper: toward the gum) from the edge
    edge0 = yc - 0.0026 * k if upper else yc - 0.0007 * k
    V_, F_, UV_ = [], [], []
    for side in (1.0, -1.0):
        s0 = 0.0
        for ti, (w, hgt, dep) in enumerate(crowns):
            w, hgt, dep = w * 0.001 * k, hgt * 0.001 * k, dep * 0.001 * k
            sc = s0 + w / 2 + 0.00008 * k
            s0 += w + 0.00016 * k
            xc = np.interp(sc, arc, xs)
            zc = np.interp(sc, arc, zs)
            dz = np.interp(sc + 1e-4, arc, zs) - np.interp(sc - 1e-4, arc, zs)
            dx = np.interp(sc + 1e-4, arc, xs) - np.interp(sc - 1e-4, arc, xs)
            t = np.array([dx * side, 0.0, dz]); t /= max(np.linalg.norm(t), 1e-9)   # along the arch (away from the midline)
            nrm = np.array([side * -dz, 0.0, dx]); nrm /= max(np.linalg.norm(nrm), 1e-9)   # labial: out of the arch
            cen = np.array([xc * side, 0.0, zc])
            rise = np.interp(ti, [0, 1, 2, 3, 4, 5, 6], [0.0, 0.6, 0.3, 0.9, 1.3, 1.7, 2.1]) * 0.001 * k
            ye = edge0 + sgn * rise
            yg = ye + sgn * hgt
            kind = "inc" if ti < 2 else "can" if ti == 2 else "post"
            seg = 10 if ti < 3 else 7
            us = [-0.18, 0.0, 0.3, 0.62, 0.86, 1.0]
            base = len(V_)
            b_uv = 0.5 + side * 0.45 * np.clip(sc / (TEETH_HALF * k), 0, 1)
            for u in us:
                uu = max(u, 0.0)
                if kind == "inc":
                    ww = w / 2 * (0.72 + 0.28 * BH.ss(0.0, 0.55, uu)) * (1 - 0.06 * BH.ss(0.85, 1.0, uu))
                    dd = dep / 2 * (1 - 0.78 * uu ** 1.4)
                elif kind == "can":
                    ww = w / 2 * (0.78 + 0.22 * BH.ss(0.0, 0.5, uu)) * (1 - 0.45 * BH.ss(0.65, 1.0, uu))
                    dd = dep / 2 * (1 - 0.55 * uu ** 1.4)
                else:
                    ww = w / 2 * (0.84 + 0.16 * BH.ss(0.0, 0.5, uu))
                    dd = dep / 2 * (0.88 + 0.12 * BH.ss(0.0, 0.5, uu))
                y = ye + (yg - ye) * (1 - u)          # u = 0 at the gum, 1 at the biting edge
                for si in range(seg):
                    ang = 2 * math.pi * si / seg
                    ca, sa = math.cos(ang), math.sin(ang)
                    ex = 2.6 if kind != "post" else 3.2          # superellipse: a rounded box section
                    px = np.sign(ca) * abs(ca) ** (2 / ex)
                    pz = np.sign(sa) * abs(sa) ** (2 / ex)
                    # labial face (pz > 0) a little convex and on the arch line, lingual behind it
                    off = t * (px * ww) + nrm * (pz * dd - dd)
                    yy = y
                    if u >= 0.99 and kind == "inc":          # the biting edge: slightly rounded corners
                        yy = y + sgn * 0.0004 * k * abs(px) ** 3
                    if u >= 0.99 and kind == "post":         # a shallow occlusal fossa
                        yy = y + sgn * 0.0006 * k * (1 - max(abs(px), abs(pz)) ** 2)
                    V_.append(cen + off + np.array([0.0, yy, 0.0]))
                    UV_.append([a0 + (a1 - a0) * (0.06 + 0.94 * max(u, 0.0)), b_uv])
            nr = len(us)
            for r in range(nr - 1):
                for si in range(seg):
                    a_ = base + r * seg + si
                    b_ = base + r * seg + (si + 1) % seg
                    c_ = base + (r + 1) * seg + (si + 1) % seg
                    d_ = base + (r + 1) * seg + si
                    F_.append([a_, b_, c_, d_])
            # cap at the biting edge / occlusal surface
            cap = len(V_)
            ring = [base + (nr - 1) * seg + si for si in range(seg)]
            V_.append(np.mean([V_[i] for i in ring], 0))
            UV_.append([a1, b_uv])
            for si in range(seg):
                F_.append([ring[si], ring[(si + 1) % seg], cap])
    V_ = np.array(V_)
    UV_ = np.array(UV_)
    return V_, _orient(V_, F_, sgn), UV_


UP_Z0 = []


def _orient(V_, F_, sgn):
    """faces wound outward from their own tooth: each tooth is a separate connected piece; its centroid is inside."""
    par = list(range(len(V_)))

    def fnd(a):
        while par[a] != a:
            par[a] = par[par[a]]
            a = par[a]
        return a
    for f in F_:
        for v in f[1:]:
            ra, rb = fnd(f[0]), fnd(v)
            if ra != rb:
                par[rb] = ra
    roots = np.array([fnd(i) for i in range(len(V_))])
    cen = {r: V_[roots == r].mean(0) for r in set(roots.tolist())}
    out = []
    for f in F_:
        q = V_[f]
        fn = np.cross(q[1] - q[0], q[2] - q[0])
        if fn @ (q.mean(0) - cen[roots[f[0]]]) < 0:
            f = f[::-1]
        out.append(list(f))
    return out


def _gum_band(P, upper, k, yc, a_gum):
    """The gums over the crowns (labial side): a scalloped strip along the arch, its border dipping between the teeth
    (papillae), rolling back toward the lip's inner surface. Returns (points, quads, uv)."""
    z_front = P[:, 2].max()
    z0 = UP_Z0[0] if (upper and UP_Z0) else (UP_Z0[0] - 0.0024 * k if UP_Z0 else z_front - 0.0022 * k)
    xs, zs, arc = _arch_curve(z0, k)
    crowns = CROWNS_UP if upper else CROWNS_LO
    sgn = 1.0 if upper else -1.0
    edge0 = yc - 0.0026 * k if upper else yc - 0.0007 * k
    bounds = np.concatenate([[0.0], np.cumsum([(w + 0.16) * 0.001 * k for w, _, _ in crowns])])
    smax = bounds[-1]
    ns = 34
    V_, F_, UV_ = [], [], []
    rows = [(-0.0006, 0.0012), (0.0016, 0.0011), (0.0050, 0.0006), (0.0075, -0.0025)]    # (height over the gum line, labial offset)
    for side in (1.0, -1.0):
        base = len(V_)
        for r, (hy, off) in enumerate(rows):
            for i in range(ns + 1):
                s = smax * (i / ns)
                ti = int(np.clip(np.searchsorted(bounds, s) - 1, 0, len(crowns) - 1))
                w, hgt, dep = crowns[ti]
                rise = np.interp(ti, [0, 1, 2, 3, 4, 5, 6], [0.0, 0.6, 0.3, 0.9, 1.3, 1.7, 2.1]) * 0.001 * k
                yg = edge0 + sgn * (rise + hgt * 0.001 * k)
                # papillae: the gum reaches down between the teeth (toward the edge) 2 mm
                fr = (s - bounds[ti]) / max(bounds[ti + 1] - bounds[ti], 1e-6)
                pap = (1 - math.sin(math.pi * fr)) ** 2 * 0.0022 * k if r == 0 else 0.0
                x = np.interp(s, arc, xs)
                z = np.interp(s, arc, zs)
                dz = np.interp(s + 1e-4, arc, zs) - np.interp(max(s - 1e-4, 0), arc, zs)
                dx = np.interp(s + 1e-4, arc, xs) - np.interp(max(s - 1e-4, 0), arc, xs)
                nrm = np.array([side * -dz, 0.0, dx]); nrm /= max(np.linalg.norm(nrm), 1e-9)
                p = np.array([x * side, yg + sgn * (hy * k) - sgn * pap, z]) + nrm * off * k
                V_.append(p)
                UV_.append([a_gum, 0.5 + side * 0.45 * min(1.0, s / (TEETH_HALF * k))])
        for r in range(len(rows) - 1):
            for i in range(ns):
                a_ = base + r * (ns + 1) + i
                q = [a_, a_ + 1, a_ + ns + 2, a_ + ns + 1]
                F_.append(q)
    V_ = np.array(V_)
    out = []
    for f in F_:          # wound to face out of the arch (labial) and toward the opposing arch
        q = V_[f]
        fn = np.cross(q[1] - q[0], q[2] - q[0])
        c = q.mean(0)
        outward = np.array([c[0], 0.0, c[2] - (z0 - 0.03 * k)])
        if fn @ outward < 0:
            f = f[::-1]
        out.append(list(f))
    return V_, out, np.array(UV_)


def mouth_objects(B):
    """MakeHuman's upper / lower teeth and tongue helpers (sculpted with the body), uv'd into the mouth cell."""
    _, _, F = mh.base()
    out = []
    eye = B.L.eye
    for g, fine, a0, a1, mask in (("helper-upper-teeth", None, 0.02, 0.34, (0.0, 0.55, 0.0)), ("helper-lower-teeth", "jaw", 0.02, 0.34, (0.0, 0.55, 0.0)),
                                  ("helper-tongue", "jaw", 0.4, 0.66, (0.45, 0.6, 0.0))):
        fs = [f for f in F if f[2] == g]
        used = sorted({v for f in fs for v in f[0]})
        rm = {v: i for i, v in enumerate(used)}
        P = B.P[used].copy()
        # the teeth sit a little inside the lips (MakeHuman's helpers touch them): 1.5 mm back
        P[:, 2] -= 0.0018
        if "teeth" not in g or os.environ.get("TEETH_MH") == "1" or os.environ.get("TEETH_GUM") == "1":
            P[:, 1] += (np.mean(P[:, 1]) - P[:, 1]) * 0.12      # a touch shorter: hidden behind closed lips
        y = P[:, 1]
        if "teeth" in g:
            # a = along the tooth (gum line -> biting edge), b = around the arch
            top = "upper" in g
            t = (y.max() - y) / max(np.ptp(y), 1e-4) if top else (y - y.min()) / max(np.ptp(y), 1e-4)
            a = a0 + (a1 - a0) * np.clip(t, 0, 1)
            b = 0.5 + 0.45 * np.clip(P[:, 0] / 0.03, -1, 1)
        else:
            a = a0 + (a1 - a0) * np.clip((P[:, 2] - P[:, 2].min()) / max(np.ptp(P[:, 2]), 1e-4), 0, 1)
            b = 0.5 + 0.45 * np.clip(P[:, 0] / 0.025, -1, 1)
        uvv = BH.cell_uv(MOUTH_CELL, a, b, inset=0.04)
        fl = [[rm[v] for v in f[0]] for f in fs]
        nm = "teeth_up" if "upper" in g else "teeth_lo" if "lower" in g else "tongue"
        if "teeth" in g and os.environ.get("TEETH_MH") != "1" and os.environ.get("TEETH_CROWNS") != "0":
            # proto:makehuman: one crown per tooth on a smooth U-shaped arch, and the gums over them (TEETH_CROWNS=0: the
            # painted band of the hero pipeline)
            yc = float(np.interp(0.0, *B.L.lip_line))
            Pg = P.copy()
            P, fl, uvl = _teeth_crowns(Pg, "upper" in g, B.H / 1.75, yc, a0, a1)
            uvv = BH.cell_uv(MOUTH_CELL, uvl[:, 0], uvl[:, 1], inset=0.04)
            gv, gf, guv = _gum_band(Pg, "upper" in g, B.H / 1.75, yc, 0.008)
            guvv = BH.cell_uv(MOUTH_CELL, guv[:, 0], guv[:, 1], inset=0.04)
            go = BH.mesh_from("gum_up" if "upper" in g else "teeth_lo_gum", BH.to_bl_np(gv), gf, [guvv[j] for f in gf for j in f])
            BH.set_mask(go, (0.55, 0.6, 0.0))
            Wg = np.zeros((len(gv), len(BH.BONE_NAMES)))
            Wg[:, BH.BI["head"]] = 1
            BH.WSTORE[go.name] = Wg
            if fine:
                go["fine_bone"] = fine
            out.append(go)
        elif "teeth" in g and os.environ.get("TEETH_MH") != "1":
            # hero pipeline: MakeHuman's teeth helpers are a coarse zigzag; an even dental arch follows them instead
            # (a smooth band: labial face, biting edge, lingual face), the teeth painted on it (paint_mouth_cell)
            P, fl, uvl = _teeth_arch(P, "upper" in g, a0, a1, B.H / 1.75)
            uvv = BH.cell_uv(MOUTH_CELL, uvl[:, 0], uvl[:, 1], inset=0.04)
        o = BH.mesh_from(nm, BH.to_bl_np(P), fl, [uvv[j] for f in fl for j in f])
        BH.set_mask(o, mask)
        W = np.zeros((len(P), len(BH.BONE_NAMES)))
        W[:, BH.BI["head"]] = 1
        BH.WSTORE[o.name] = W
        if fine:
            o["fine_bone"] = fine
        out.append(o)
    _ = eye
    return out


def eye_objects(B, c):
    """v2 replacement of build_humans.eye_objects: eyeballs + the mouth interior (lashes are strand cards)."""
    sph = eye_spheres(B)
    B._eyes = sph
    out = [eyeball("eyeball_" + s, sph[s][0], sph[s][1], s) for s in "LR"]
    out += mouth_objects(B)
    return out


def paint_eye(c, dxe, dye, r, th, seed, vnoise, hash01, ss, g2):
    """The eye cell (sRGB 0..1): the disc radius r = polar angle / 90 degrees on the eyeball (the limbus at ~0.34).
    Iris: radial fibres in two frequencies with wavy crypts (darker pits), a lighter, warmer collarette ring, a dark
    pupillary ruff and a crisp dark limbal ring; the colour runs warmer toward the pupil. Sclera: warm white, pinker
    and darker toward the corners with a few faint vessels, a soft shade under the upper lid."""
    iris_c = BH.hexc(c.get("eyes", "5a4030"))
    ir, pr = c.get("irisR", 0.34), c.get("pupilR", 0.12)
    rr = np.clip((r - pr) / max(ir - pr, 1e-3), 0, 1.5)
    sh = r.shape
    p3 = np.stack([np.cos(th) * 3, np.sin(th) * 3, r * 5], -1).reshape(-1, 3)
    wob = vnoise(p3, 1.1, seed).reshape(sh)
    fib = 0.5 + 0.25 * np.sin(th * 60 + 3.0 * wob) + 0.15 * np.sin(th * 151 + 5 * vnoise(p3 * 1.9, 1.4, seed + 2).reshape(sh)) + 0.1 * np.sin(th * 307 + 2.0 * wob)
    crypt = np.clip(vnoise(np.stack([np.cos(th) * 7, np.sin(th) * 7, rr * 4], -1).reshape(-1, 3), 1.0, seed + 5).reshape(sh) - 0.62, 0, 1) * 2.2
    warm = np.array([0.62, 0.42, 0.16])           # amber near the pupil (stroma pigment)
    inner = ss(0.55, 0.15, rr)[..., None]
    base = iris_c[None, None, :] * (1 - 0.35 * inner) + warm[None, None, :] * 0.35 * inner * (0.4 + 0.6 * iris_c.mean() / 0.35)
    irc = base * (0.62 + 0.62 * fib[..., None])
    irc = irc * (1 + 0.28 * g2((rr - 0.32) ** 2, 0.006))[..., None]            # collarette
    irc = irc * (1 - 0.45 * crypt * ss(0.25, 0.4, rr) * ss(0.95, 0.7, rr))[..., None]
    irc = irc * (1 - 0.5 * ss(0.78, 1.0, rr))[..., None]                       # darker outer iris toward the limbus
    irc = irc * (1 - 0.35 * ss(0.12, 0.0, rr))[..., None]                      # pupillary ruff
    # hero pipeline v7: a little darker (0.86 read as paper white under the dialogue key and ACES), more shade toward the
    # corners and under the lids
    sclera = np.array([0.79, 0.75, 0.71]) * (1 - 0.3 * ss(0.45, 1.0, r))[..., None]
    sclera = sclera * (1 - 0.1 * ss(0.45, 1.0, np.abs(dxe))[..., None] * np.array([0.0, 1.0, 0.8]))    # pinker corners
    ves = (0.5 + 0.5 * np.sin(th * 23 + 6 * vnoise(p3 * 0.7, 2.0, seed + 9).reshape(sh))) ** 80 * ss(0.5, 0.95, r) * ss(0.3, 0.8, np.abs(dxe))
    sclera = sclera * (1 - 0.07 * ves[..., None] * np.array([0.0, 1.0, 0.9]))
    limb = np.exp(-((r - ir) / 0.025) ** 2)
    col = np.where((r < ir)[..., None], irc, sclera)
    col = col * (1 - 0.6 * limb[..., None])
    pup = ss(pr + 0.012, pr - 0.006, r)[..., None]
    col = col * (1 - pup) + np.array([0.015, 0.013, 0.012]) * pup
    col = col * (1 - 0.22 * ss(0.3, 0.9, dye)[..., None] * (r < 1.0)[..., None])          # upper lid shade
    return np.clip(col, 0, 1)


def paint_mouth_cell(c, img, mask, grid, put):
    """The mouth cell: teeth (ivory, a translucent biting edge), gums and tongue (wet pink), the cavity (near black)."""
    gx, gy, a, b = grid(MOUTH_CELL)
    rng_n = BH.vnoise(np.stack([a * 7, b * 7, np.zeros_like(a)], -1).reshape(-1, 3), 3.0, 1.7).reshape(a.shape)
    ss = BH.ss
    # stored as the cell's a (x) / b (y) like cell_uv: here a runs along the tooth, b across
    ta = a
    tooth = np.array([0.68, 0.64, 0.57]) * (0.93 + 0.07 * rng_n)[..., None]      # (v6 0.74: a bright denture band in the mouth's shade)
    tooth = tooth * (1 - 0.18 * ss(0.22, 0.36, ta))[..., None] + np.array([0.02, 0.03, 0.05]) * ss(0.24, 0.34, ta)[..., None]
    gum = np.array([0.62, 0.30, 0.30]) * (0.9 + 0.12 * rng_n)[..., None]
    tongue = np.array([0.66, 0.36, 0.36]) * (0.85 + 0.2 * rng_n)[..., None]
    cav = np.array([0.10, 0.035, 0.035])      # proto:makehuman: a deep red, not black (0.07, 0.025)
    if os.environ.get("TEETH_MH") != "1":       # the gaps between the teeth along the arch (b: arc length, centre 0.5)
        arcp = np.abs(b - 0.5) / 0.45 * TEETH_HALF
        edges = np.cumsum(TOOTH_W)
        gap = np.zeros_like(arcp)
        for e_ in np.concatenate([[0.0], edges]):
            gap = np.maximum(gap, np.exp(-((arcp - e_) / 0.00035) ** 2))
        tooth = tooth * (1 - 0.55 * gap[..., None] * BH.ss(0.0, 0.06, ta)[..., None])
        tooth = tooth * (1 - 0.25 * BH.ss(0.45, 1.0, np.abs(b - 0.5) / 0.45))[..., None]     # back teeth in shadow
    col = np.where((ta < 0.02)[..., None], gum, tooth)
    col = np.where((ta >= 0.36)[..., None], tongue * (1 - 0.45 * ss(0.5, 0.66, ta))[..., None], col)
    col = np.where((ta >= 0.7)[..., None], cav, col)
    put(gx, gy, col)


# ---------------------------------------------------------------------------------------------------------------
# strand texture (one image shared by every character's hair cards): 8 columns of 128 x 1024 texels, v = root (top
# row) -> tip. R: strand brightness, G: a per-strand random (highlight shift / sparkle), B: depth across the card
# (strands at the card's centre lie on top), A: coverage. Drawn 2x and box-filtered.
# ---------------------------------------------------------------------------------------------------------------
HT_W, HT_H, HT_COLS = 1024, 1024, 8
HT_VERSION = 8
# column kinds (same slots as v1, so a build's uvs keep their meaning): 0-2 clump cards (dense centre, sparse edges,
# staggered tapered tips), 3 tight clump (strands gather to a point: tips of short textured cuts), 4-5 wisps (a few
# loose strands: flyaways, edges), 6 wavy / curly, 7 fine short strokes (lashes, brows, beard)
HT_KIND = ["clump", "clump", "clump", "tight", "wisp", "wisp", "curl", "fine"]
HT_SINGLE = (0.86, 0.995)      # u range (within the fine column) of the single strand: one lash / brow hair per ribbon


def strand_texture(path):
    """The strand atlas: RGBA, v = root (row 0) -> tip. R strand brightness, G per-strand random, B depth across the
    card (centre on top), A coverage (antialiased: drawn at 2x and box-filtered). Strand density falls off toward the
    card's long edges and tips end at staggered lengths, so a card has a soft, irregular outline instead of a rectangle;
    transparent texels carry the column's mean colour (no dark fringes in the mips)."""
    path = path.replace(".png", "_v%d.png" % HT_VERSION)
    if os.path.exists(path):
        return path
    from PIL import Image
    S = 2
    cw, hh = HT_W // HT_COLS * S, HT_H * S
    out = np.zeros((HT_H, HT_W, 4), np.float32)
    rng = np.random.default_rng(20492)
    y = (np.arange(hh) + 0.5) / hh
    for col, kind in enumerate(HT_KIND):
        A = np.zeros((hh, cw), np.float32)
        Rr = np.zeros((hh, cw), np.float32)
        G = np.zeros((hh, cw), np.float32)
        # v6: clumps spread wider with feathered, staggered ends (v5's strands converged into one point, so every
        # short card read as a spike); a clean single strand at the right edge of the fine column (HT_SINGLE: lashes and
        # brow hairs, one hair per ribbon)
        n = {"clump": 150, "tight": 110, "wisp": 22, "curl": 90, "fine": 48}[kind]
        sig = {"clump": 0.21, "tight": 0.17, "wisp": 0.2, "curl": 0.17, "fine": 0.26}[kind]
        # v8 (proto:makehuman): a clump card is 3-4 sub-clumps with gaps between them (piecey, never a flat ribbon), and
        # every strand fades in at its own root (no straight-cut card start where a card lies on the hair below)
        subs = np.sort(rng.uniform(0.18, 0.82, 4 if col % 2 else 3)) if kind == "clump" else None
        for s in range(n):
            if kind == "clump":
                x0 = float(subs[int(rng.integers(0, len(subs)))] + rng.normal(0, 0.07))
                while not 0.06 < x0 < 0.94:
                    x0 = float(subs[int(rng.integers(0, len(subs)))] + rng.normal(0, 0.07))
            elif kind != "fine":       # resampled, not clipped (v5 piled the outliers up on one straight edge line)
                x0 = float(rng.normal(0.5, sig))
                while not 0.07 < x0 < 0.93:
                    x0 = float(rng.normal(0.5, sig))
            else:
                x0 = float(rng.uniform(0.03, HT_SINGLE[0] - 0.04))
            if kind == "fine":       # brow and beard hairs: rooted at the card's root edge, tapering to a fine tip
                t0, t1 = rng.uniform(0.0, 0.06), rng.uniform(0.6, 1.0)
            else:
                t0 = rng.uniform(0.0, 0.16 if kind == "clump" else 0.07)
                # staggered, feathered ends: the centre strands are a little longer, the rest end anywhere in the last half
                edge = abs(x0 - 0.5) * 2
                t1 = float(np.clip(rng.uniform(0.42, 1.0) * (1 - 0.22 * edge ** 1.5), 0.25, 1.0))
            wid = rng.uniform(1.1, 2.0) * S * (0.8 if kind in ("fine", "wisp") else 1.0)
            ph, fr = rng.uniform(0, 6.3), rng.uniform(0.8, 2.2)
            amp = {"clump": 2.5, "tight": 2.0, "wisp": 7.0, "curl": 12.0, "fine": 1.5}[kind] * S
            if kind == "curl":
                fr = rng.uniform(3.0, 4.6)
            xc = x0 * cw + amp * np.sin(y * fr * 6.283 + ph)
            if kind == "wisp":
                xc = xc + rng.normal(0, 7 * S) * y ** 2
            if kind in ("clump", "tight"):       # strands gather toward the card's centre line near the tip
                pull = 0.14 if kind == "clump" else 0.34
                xc = xc + (cw * 0.5 - xc) * (np.clip((y - t0) / max(t1 - t0, 1e-3), 0, 1) ** 1.8) * pull
            tt = np.clip((y - t0) / max(t1 - t0, 1e-3), 0, 1)
            inside = (y >= t0) & (y <= t1)
            taper = np.where(inside, (1 - tt) ** 1.4 * np.clip(tt * 25, 0, 1) if kind == "fine" else (1 - tt ** 2.2) * (np.clip(tt * 9, 0, 1) if kind == "clump" else 1.0), 0.0)
            w = wid * (0.3 + 0.7 * taper)
            rows = np.nonzero(taper > 0.02)[0]
            if not len(rows):
                continue
            lo_x = int(max(0, np.floor(xc[rows].min() - 3 * S - wid)))
            hi_x = int(min(cw, np.ceil(xc[rows].max() + 3 * S + wid)))
            xs = np.arange(lo_x, hi_x) + 0.5
            d = np.abs(xs[None, :] - xc[rows, None])
            cov = np.clip(1.0 - (d - w[rows, None] * 0.5) / (0.9 * S), 0, 1)
            cov *= np.clip(taper[rows, None] * 3.0, 0, 1)
            br = rng.uniform(0.55, 1.0)
            a_ = A[rows, lo_x:hi_x]
            newA = a_ + cov * (1 - a_)
            Rr[rows, lo_x:hi_x] = np.where(cov > 0, (Rr[rows, lo_x:hi_x] * a_ + br * cov * (1 - a_)) / np.maximum(newA, 1e-6), Rr[rows, lo_x:hi_x])
            G[rows, lo_x:hi_x] = np.where(cov > 0.5, rng.random(), G[rows, lo_x:hi_x])
            A[rows, lo_x:hi_x] = newA
        if kind == "fine":           # HT_SINGLE: one clean tapered strand, root (v = 0) to tip (v = 1)
            xc_ = (HT_SINGLE[0] + HT_SINGLE[1]) / 2 * cw
            wr = (HT_SINGLE[1] - HT_SINGLE[0]) * cw * 0.36
            tt_ = np.clip(y / 0.97, 0, 1)
            w_ = wr * (1 - tt_) ** 0.8 + 0.6 * S
            xs_ = np.arange(int(HT_SINGLE[0] * cw), cw) + 0.5
            d_ = np.abs(xs_[None, :] - xc_)
            cov_ = np.clip(1.0 - (d_ - w_[:, None] * 0.5) / (0.9 * S), 0, 1) * np.clip((0.985 - y) * 40, 0, 1)[:, None]
            sl_ = slice(int(HT_SINGLE[0] * cw), cw)
            A[:, sl_] = cov_
            Rr[:, sl_] = 0.85
            G[:, sl_] = 0.5
        xs_all = (np.arange(cw) + 0.5) / cw
        Bd = np.clip(1 - np.abs(xs_all - 0.5) * 2, 0, 1)[None, :] * np.ones((hh, 1))
        blk = np.stack([Rr, G, Bd, A], -1)
        blk = blk.reshape(HT_H, S, cw // S, S, 4).mean((1, 3))
        out[:, col * (HT_W // HT_COLS):(col + 1) * (HT_W // HT_COLS)] = blk
    a = out[..., 3:4]
    for col in range(HT_COLS):
        sl = slice(col * (HT_W // HT_COLS), (col + 1) * (HT_W // HT_COLS))
        aa = a[:, sl]
        mean = (out[:, sl, :2] * aa).sum((0, 1)) / max(aa.sum(), 1e-6)
        k = np.clip(aa * 4, 0, 1)
        out[:, sl, :2] = out[:, sl, :2] * k + mean * (1 - k)
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), "RGBA").save(path)
    return path



def hair_material(c, tex_path):
    """`<id>_hair`: the strand texture with alpha (clip), double sided; the colour lives in the cards' `_hcol`."""
    m = bpy.data.materials.new(c["id"] + "_hair")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    im = nt.nodes.new("ShaderNodeTexImage")
    im.image = bpy.data.images.load(tex_path, check_existing=True)
    nt.links.new(im.outputs["Color"], bsdf.inputs["Base Color"])
    rnd = nt.nodes.new("ShaderNodeMath")
    rnd.operation = "ROUND"
    nt.links.new(im.outputs["Alpha"], rnd.inputs[0])
    nt.links.new(rnd.outputs[0], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.45
    m.use_backface_culling = False
    try:
        m.surface_render_method = "DITHERED"
    except Exception:  # noqa: BLE001 (older Blender)
        pass
    m["slot"] = "hair"
    return m


# ---------------------------------------------------------------------------------------------------------------
# hair cards
# ---------------------------------------------------------------------------------------------------------------
# per style: card length (m) on the scalp and on hanging pieces, width (m), comb mode, wave (amplitude rad, wavelength
# m), lift at the tip (m: volume), gravity once a strand leaves the scalp
STYLE = {
    "crop":     dict(L=0.014, W=0.006, comb="crown", wave=(0.25, 0.02), lift=0.0012, dens=1.0),
    "fade":     dict(L=0.016, W=0.006, comb="crown", wave=(0.2, 0.02), lift=0.0012, dens=0.9),
    "undercut": dict(L=0.05, W=0.010, comb="swept", wave=(0.2, 0.04), lift=0.004, dens=0.9),
    "short":    dict(L=0.035, W=0.009, comb="crown", wave=(0.25, 0.03), lift=0.003, dens=1.0),
    "swept":    dict(L=0.065, W=0.011, comb="swept", wave=(0.15, 0.05), lift=0.004, dens=1.0),
    "waves":    dict(L=0.075, W=0.012, comb="crown_fwd", wave=(0.42, 0.035), lift=0.006, dens=1.1),
    "pixie":    dict(L=0.05, W=0.010, comb="side_fwd", wave=(0.25, 0.04), lift=0.004, dens=1.0),
    "bob":      dict(L=0.10, W=0.013, comb="part", wave=(0.12, 0.06), lift=0.004, dens=1.0),
    "long":     dict(L=0.14, W=0.014, comb="part", wave=(0.15, 0.07), lift=0.005, dens=1.0),
    "pony":     dict(L=0.08, W=0.011, comb="gather", wave=(0.1, 0.06), lift=0.0015, dens=1.0),
    "bun":      dict(L=0.07, W=0.011, comb="gather", wave=(0.1, 0.06), lift=0.0015, dens=1.0),
    "braid":    dict(L=0.08, W=0.010, comb="gather", wave=(0.1, 0.06), lift=0.0015, dens=1.0),
    "curls":    dict(L=0.022, W=0.010, comb="curl", wave=(1.3, 0.012), lift=0.004, dens=1.25),
    "puffs":    dict(L=0.022, W=0.011, comb="curl", wave=(1.3, 0.012), lift=0.004, dens=1.2),
    "locs":     dict(L=0.05, W=0.009, comb="down", wave=(0.1, 0.05), lift=0.002, dens=0.6),
}
HAIR_OBJ = ("hair", "bun", "braid", "pony", "puff", "loc")
COVER_OBJ = ("cap", "peaked", "beanie", "headband", "visor", "helmet", "band", "hood", "scarf", "collar_")


def _tan(v, n):
    t = v - n * (v @ n)
    ln = np.linalg.norm(t)
    return t / ln if ln > 1e-9 else t


def _rot(v, n, a):
    """rotate v about the unit axis n by a (Rodrigues)."""
    return v * math.cos(a) + np.cross(n, v) * math.sin(a) + n * (n @ v) * (1 - math.cos(a))


class _Surf:
    """Points + normals with nearest lookup (mathutils kd-tree); MH coordinates."""
    def __init__(self, P, N):
        self.P, self.N = np.asarray(P, float), np.asarray(N, float)
        self.kd = kdtree.KDTree(len(self.P))
        for i, p in enumerate(self.P):
            self.kd.insert(V(p), i)
        self.kd.balance()

    def near(self, p):
        co, i, d = self.kd.find(V(p))
        return i, d


def _obj_surface(objs):
    """MH-space vertices, vertex normals, faces (triangulated) and per-vertex weights (WSTORE) of Blender objects."""
    P, N, T, W = [], [], [], []
    off = 0
    for o in objs:
        me = o.data
        me.calc_loop_triangles()
        bpy.context.view_layer.update()
        M = np.array(o.matrix_world)
        co = np.array([v.co for v in me.vertices])
        no = np.array([v.normal for v in me.vertices])
        co = co @ M[:3, :3].T + M[:3, 3]
        no = no @ M[:3, :3].T
        P.append(BH.from_bl_np(co))
        N.append(BH.from_bl_np(no))
        T.append(np.array([lt.vertices[:] for lt in me.loop_triangles], int).reshape(-1, 3) + off)
        Wo = BH.WSTORE.get(o.name)
        W.append(np.asarray(Wo) if Wo is not None else np.tile(np.eye(len(BH.BONE_NAMES))[BH.BI["head"]], (len(co), 1)))
        off += len(co)
    P, N, T, W = np.concatenate(P), np.concatenate(N), np.concatenate(T), np.concatenate(W)
    N = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    return P, N, T, W


def _sample_tris(P, T, n, rng):
    A = 0.5 * np.linalg.norm(np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]), axis=1)
    if A.sum() <= 0 or n <= 0:
        return np.zeros((0, 3)), np.zeros(0, int), A.sum()
    ti = rng.choice(len(T), size=n, p=A / A.sum())
    r1, r2 = rng.random(n), rng.random(n)
    s = np.sqrt(r1)
    bc = np.stack([1 - s, s * (1 - r2), s * r2], 1)
    pts = (P[T[ti]] * bc[:, :, None]).sum(1)
    return pts, ti, A.sum()


class Cards:
    """Accumulates card ribbons: vertices (MH), normals, uvs, colours, strand tangents, weights, importance."""
    def __init__(self):
        self.v, self.n, self.uv, self.col, self.tan, self.w, self.f, self.imp, self.fine, self.kind = [], [], [], [], [], [], [], [], [], []

    def ribbon(self, pts, norms, width, column, col_root, col_tip, W, imp, fine=None, u0=0.06, u1=0.94, kind=0):
        """A strip along pts (k, 3) with per-point normals; width (k,) metres; uv column of the strand texture."""
        k = len(pts)
        base = sum(len(x) for x in self.v)
        vs, ns, uvs, cs, ts = [], [], [], [], []
        cw = 1.0 / HT_COLS
        for i in range(k):
            d = pts[min(i + 1, k - 1)] - pts[max(i - 1, 0)]
            d = d / max(np.linalg.norm(d), 1e-9)
            nn = norms[i]
            b = np.cross(nn, d)
            b = b / max(np.linalg.norm(b), 1e-9)
            t = i / (k - 1)
            for side in (-1, 1):
                vs.append(pts[i] + b * side * width[i] * 0.5)
                ns.append(nn)
                uvs.append((column * cw + cw * (u0 if side < 0 else u1), 1.0 - t))
                cs.append(col_root * (1 - t) + col_tip * t)
                ts.append(d)
        faces = []
        for i in range(k - 1):
            a = base + 2 * i
            faces.append([a, a + 1, a + 3, a + 2])
        self.v.append(np.array(vs))
        self.n.append(np.array(ns))
        self.uv += uvs
        self.col.append(np.array(cs))
        self.tan.append(np.array(ts))
        self.w.append(np.repeat(np.asarray(W)[None], 2 * k, 0) if np.ndim(W) == 1 else np.repeat(np.asarray(W), 2, 0))
        self.f.append((faces, imp))
        self.fine.append([fine] * (2 * k))
        self.kind.append(kind)

    def empty(self):
        return not self.v


def hair_floor(rgb, lo=0.15):
    """sRGB hair colour with its value raised to at least lo (hue kept): the cast's near-black hexes (0x14 = 0.08)
    rendered as a flat black mass with no strand light; real black hair is a very dark brown with highlights."""
    import colorsys
    h, s_, v = colorsys.rgb_to_hsv(*[float(x) for x in rgb])
    if v >= lo:
        return np.asarray(rgb, float)
    return np.array(colorsys.hsv_to_rgb(h, min(s_, 0.45), lo + (v - 0) * 0.3))


def _hair_cols(c, rng):
    hc = BH.lin(hair_floor(BH.hexc(c.get("hairColor", "2e2119"))))
    grey = BH.hexc(c.get("hairColor", "2e2119")).mean() > 0.42
    return hc, grey


def _card_colour(hc, grey, rng):
    """root and tip colour (linear) of one card: a little variation per card; grey hair mixes darker strands."""
    v = rng.normal(1.0, 0.05)
    root = hc * 0.66 * v
    tip = hc * (0.86 + 0.06 * rng.random()) * v
    if grey and rng.random() < 0.15:
        k = rng.uniform(0.78, 0.9)
        root, tip = root * k, tip * k
    return root, tip


# ---------------------------------------------------------------------------------------------------------------
# the cut library (hero pipeline, docs/CHARACTER_LOOK.md "Faces: hero pipeline"): any cast entry or face file picks a
# cut by name in "hair". A cut names the hair volume (shell) style it sits on (`base`, one of the legacy styles the
# coverage fields, hairline, shell and hanging pieces know) and how its strand cards grow: lengths (m, for a 1.75 m
# person) on the top, at the front, over the sides and at the nape, the comb (flow field), the volume lift at the
# tips (m), wave, card width (m), the density over the sides (fades and undercuts are carried by the painted scalp),
# the share of loose wisps, and the hairline fade of the painted scalp under short cuts.
# ---------------------------------------------------------------------------------------------------------------
CUTS = {
    # textured crop: short, slightly forward, piecey texture on top
    "crop":      dict(base="crop", stiff=1.0, top=0.026, front=0.024, side=0.010, nape=0.008, comb="fwd", lift=0.003, frontLift=0.004, wave=0.25, W=0.0060, side_dens=0.75, wisp=0.08, scalp="short"),
    # skin fade: short textured top pushed forward and up, sides faded to the skin
    "fade":      dict(base="fade", stiff=1.0, top=0.036, front=0.030, side=0.0045, nape=0.004, comb="up_fwd", lift=0.004, frontLift=0.008, wave=0.3, W=0.0062, side_dens=0.3, wisp=0.06, scalp="fade"),
    # modern quiff: long front swept up and back, short sides
    "quiff":     dict(base="undercut", stiff=0.9, top=0.050, front=0.075, side=0.006, nape=0.006, comb="quiff", lift=0.006, frontLift=0.020, wave=0.18, W=0.0075, side_dens=0.3, wisp=0.08, scalp="fade"),
    # side-swept: a side part, the top swept across and a little forward, tapered sides
    "sideswept": dict(base="short", stiff=0.6, top=0.055, front=0.062, side=0.016, nape=0.012, comb="side", lift=0.005, frontLift=0.008, wave=0.2, W=0.0095, side_dens=0.8, wisp=0.08, scalp="short"),
    # swept-back: combed straight back from the hairline, a little lift at the front
    "swept":     dict(base="swept", stiff=0.7, top=0.070, front=0.075, side=0.035, nape=0.040, comb="back", lift=0.004, frontLift=0.010, wave=0.15, W=0.010, side_dens=1.0, wisp=0.06, scalp="full"),
    "slick":     dict(base="swept", stiff=0.9, top=0.070, front=0.075, side=0.035, nape=0.040, comb="back", lift=0.002, frontLift=0.004, wave=0.08, W=0.010, side_dens=1.0, wisp=0.03, scalp="full"),
    # tousled medium: messy from the crown, forward over the brow and the ears, loose wisps
    "tousled":   dict(base="short", stiff=0.35, top=0.065, front=0.060, side=0.040, nape=0.045, comb="tousle", lift=0.006, frontLift=0.006, wave=0.45, W=0.0100, side_dens=1.0, wisp=0.16, scalp="full"),
    # short (legacy): an even short cut from the crown
    "short":     dict(base="short", stiff=0.8, top=0.038, front=0.034, side=0.020, nape=0.016, comb="crown", lift=0.003, frontLift=0.004, wave=0.25, W=0.0075, side_dens=1.0, wisp=0.08, scalp="short"),
    # undercut (legacy): long top swept to the side, shaved sides
    "undercut":  dict(base="undercut", stiff=0.7, top=0.060, front=0.065, side=0.005, nape=0.005, comb="side", lift=0.005, frontLift=0.006, wave=0.2, W=0.0085, side_dens=0.25, wisp=0.08, scalp="fade"),
    # Kai's classic messy waves (legacy)
    "waves":     dict(base="waves", stiff=0.25, top=0.075, front=0.070, side=0.055, nape=0.050, comb="crown_fwd", lift=0.006, frontLift=0.006, wave=0.42, W=0.0095, side_dens=1.0, wisp=0.12, scalp="full"),
    "pixie":     dict(base="pixie", stiff=0.4, top=0.050, front=0.055, side=0.030, nape=0.025, comb="side_fwd", lift=0.004, frontLift=0.005, wave=0.25, W=0.0085, side_dens=1.0, wisp=0.1, scalp="full"),
    "bob":       dict(base="bob", top=0.10, front=0.09, side=0.10, nape=0.10, comb="part", lift=0.004, frontLift=0.004, wave=0.12, W=0.010, side_dens=1.0, wisp=0.08, scalp="full"),
    "long":      dict(base="long", top=0.14, front=0.12, side=0.14, nape=0.14, comb="part", lift=0.005, frontLift=0.005, wave=0.15, W=0.011, side_dens=1.0, wisp=0.1, scalp="full"),
    "pony":      dict(base="pony", top=0.08, front=0.07, side=0.08, nape=0.06, comb="gather", lift=0.0015, frontLift=0.002, wave=0.1, W=0.0085, side_dens=1.0, wisp=0.08, scalp="full"),
    "bun":       dict(base="bun", top=0.07, front=0.06, side=0.07, nape=0.06, comb="gather", lift=0.0015, frontLift=0.002, wave=0.1, W=0.0085, side_dens=1.0, wisp=0.08, scalp="full"),
    "braid":     dict(base="braid", top=0.08, front=0.07, side=0.08, nape=0.06, comb="gather", lift=0.0015, frontLift=0.002, wave=0.1, W=0.0080, side_dens=1.0, wisp=0.06, scalp="full"),
    "curls":     dict(base="curls", top=0.024, front=0.022, side=0.018, nape=0.016, comb="curl", lift=0.004, frontLift=0.004, wave=1.3, W=0.0085, side_dens=1.0, wisp=0.05, scalp="short"),
    "puffs":     dict(base="puffs", top=0.022, front=0.02, side=0.018, nape=0.016, comb="curl", lift=0.004, frontLift=0.004, wave=1.3, W=0.009, side_dens=1.0, wisp=0.05, scalp="short"),
    "locs":      dict(base="locs", top=0.05, front=0.05, side=0.05, nape=0.05, comb="down", lift=0.002, frontLift=0.002, wave=0.1, W=0.008, side_dens=0.6, wisp=0.0, scalp="full"),
}
# proto:makehuman hero cuts (Kai's three looks): a sculpted hair volume (`hero_T`: the full thickness of the cut over the
# scalp, metres for a 1.75 m person) whose inner half is the shell (the dark under-layer in the body atlas) and whose
# outer half is built from layered strand cards that lie inside the volume's envelope, along the comb (`_hero_cards`):
# no card leaves the envelope, so the silhouette is the cut's own shape broken up by strand tips (no spikes, no helmet)
CUTS["lead_quiff"] = dict(base="short", hero="quiff", stiff=1.0, top=0.060, front=0.068, side=0.016, nape=0.014, comb="back", lift=0.0, frontLift=0.0,
                          wave=0.18, W=0.0072, side_dens=1.0, wisp=0.05, scalp="fade")
CUTS["lead_crop"] = dict(base="short", hero="crop", stiff=1.0, top=0.034, front=0.032, side=0.013, nape=0.011, comb="fwd", lift=0.0, frontLift=0.0,
                         wave=0.25, W=0.0058, side_dens=1.0, wisp=0.05, scalp="fade")
CUTS["lead_part"] = dict(base="short", hero="part", stiff=0.9, top=0.075, front=0.080, side=0.016, nape=0.014, comb="back", lift=0.0, frontLift=0.0,
                         wave=0.14, W=0.0080, side_dens=1.0, wisp=0.04, scalp="short")
# messy medium (the owner's pick for Kai: "Messy medium length: tousled, ear-length hair with natural texture: relaxed
# and boyish"): ear-length, tousled from a crown whorl, a soft uneven fringe to the brows, the sides over the tops of
# the ears; two close alternatives: a shaggier middle-parted cut (curtain fringe, flicked ends) and a slightly shorter
# tousled cut with a side fringe. Lengths (m, 1.75 m person) by root region; `_messy_cards` grows them as clumped
# strands inside a smooth envelope around the head (ears and collar included, so the hair drapes over them).
CUTS["lead_messy"] = dict(base="short", hero="messy", stiff=0.4, top=0.110, front=0.086, side=0.080, nape=0.060, comb="tousle", lift=0.0, frontLift=0.0,
                          wave=0.35, W=0.0088, side_dens=1.0, wisp=0.06, scalp="full", tousle=0.55, floor=(0.02, 0.07), hem=(-0.034, -0.084), flick=0.2)
CUTS["lead_shag"] = dict(base="short", hero="shag", stiff=0.35, top=0.118, front=0.100, side=0.090, nape=0.070, comb="part", lift=0.0, frontLift=0.0,
                         wave=0.4, W=0.0085, side_dens=1.0, wisp=0.08, scalp="full", tousle=0.45, floor=(0.012, 0.040), hem=(-0.048, -0.092), flick=0.5)
CUTS["lead_tousle"] = dict(base="short", hero="tousle", stiff=0.5, top=0.090, front=0.085, side=0.058, nape=0.045, comb="side", lift=0.0, frontLift=0.0,
                           wave=0.3, W=0.0082, side_dens=1.0, wisp=0.05, scalp="full", tousle=0.45, floor=(0.018, 0.05), hem=(-0.02, -0.074), flick=0.15)
MESSY = ("messy", "shag", "tousle")
HERO_SHELL = 0.5        # the shell carries this share of the volume; the cards build the rest


def hero_cut(c):
    cut = c.get("hairCut") or ""
    return CUTS.get(cut, {}).get("hero")


def hero_T(c, rel, part_x=0.024):
    """Full hair thickness (m, 1.75 m person) of a hero cut at points rel (relative to the eye centre, MH axes:
    x to the character's left, y up, z forward)."""
    kind = hero_cut(c)
    r = rel - np.array([0.0, 0.03, -0.075])
    rn = r / np.maximum(np.linalg.norm(r, axis=1, keepdims=True), 1e-9)
    up, fwd, sx = rn[:, 1], rn[:, 2], rn[:, 0]
    top = BH.ss(0.05, 0.6, up)
    if kind in MESSY:           # messy medium: a full, soft, rounded volume (thicker on the crown and the top front)
        front = BH.ss(-0.2, 0.6, fwd) * BH.ss(0.0, 0.5, up)
        Ttop = {"messy": 0.023, "shag": 0.021, "tousle": 0.019}[kind] + 0.004 * front
        Tside = {"messy": 0.008, "shag": 0.010, "tousle": 0.0065}[kind] * BH.ss(-0.75, -0.1, up) + 0.002
        if kind == "shag":      # the middle part: a shallow dip along the top front
            Ttop = Ttop * (1 - 0.35 * np.exp(-(rel[:, 0] / 0.006) ** 2) * BH.ss(0.25, 0.6, up) * BH.ss(-0.4, 0.2, fwd))
        T = Tside + (Ttop - Tside) * BH.ss(0.2, 0.88, up) ** 1.7          # rounded: the volume sits on the top
        return T * (0.85 + 0.15 * BH.ss(-0.9, -0.3, -np.abs(fwd + 0.85)))
    if kind == "quiff":         # textured modern quiff: volume at the front lifted up and back, short tapered sides
        front = BH.ss(-0.25, 0.65, fwd) * BH.ss(0.15, 0.55, up)
        Ttop = 0.012 + 0.020 * front
        Tside = 0.0032 * BH.ss(-0.3, 0.12, up) + 0.0004
    elif kind == "crop":        # textured crop: short, even, a little forward fringe; faded sides
        front = BH.ss(-0.1, 0.7, fwd) * BH.ss(0.05, 0.5, up)
        Ttop = 0.0075 + 0.0035 * front
        Tside = 0.0026 * BH.ss(-0.35, 0.08, up) + 0.0004
    else:                       # side part, swept across and back; scissor-tapered sides (not faded)
        front = BH.ss(-0.2, 0.7, fwd) * BH.ss(0.1, 0.55, up)
        side_s = 1.0 if part_x > 0 else -1.0
        far = BH.ss(0.0, 0.6, -side_s * sx)           # the side the top is swept toward carries more
        Ttop = 0.010 + 0.007 * front + 0.004 * far * top
        Ttop = Ttop * (1 - 0.45 * np.exp(-((rel[:, 0] - part_x) / 0.0055) ** 2) * BH.ss(0.25, 0.6, up) * BH.ss(-0.5, 0.2, fwd))
        Tside = 0.0055 * BH.ss(-0.45, 0.05, up) + 0.0008
    T = Tside + (Ttop - Tside) * BH.ss(0.0, 0.5, up)
    T = T * (0.75 + 0.25 * BH.ss(-0.75, -0.2, -np.abs(fwd + 0.75)))  # a little less at the back of the crown
    return T


def hero_ramp(c):
    """Distance (m) inside the hairline over which the volume grows to full thickness."""
    return {"quiff": 0.010, "crop": 0.012, "part": 0.014, "messy": 0.014, "shag": 0.014, "tousle": 0.013}.get(hero_cut(c), 0.03)


def _hero_cards(c, B, cov, hair_objs, coll, cover, rng, K, tier, hc, grey):
    """Layered strand cards of a hero cut. Each card is rooted on the hair shell, marches along the comb on the scalp and
    keeps a fixed fraction f of the cut's local thickness above the skin (f from the shell's top to the envelope), so the
    cards lie inside the volume in overlapping layers (deeper layers darker), tips tapered on the surface."""
    cut = c.get("hairCut")
    C = CUTS[cut]
    kind = C["hero"]
    if kind in MESSY:
        return _messy_cards(c, B, hair_objs, coll, cover, rng, K, tier, hc, grey)
    L = B.L
    eye = L.eye
    k = B.H / 1.75
    head_c = eye + np.array([0, 0.03, -0.075])
    hP, hN, hT, hW = _obj_surface(hair_objs)
    body_skin, body_n = B.P[B.bodyv], B.N[B.bodyv]
    headm = (np.linalg.norm(body_skin - head_c, axis=1) < 0.16) & (body_skin[:, 1] > eye[1] - 0.06)
    skin = _Surf(body_skin[headm], body_n[headm])
    shell = _Surf(hP, hN)
    # thickness of the full volume at each shell vertex: the shell sits at HERO_SHELL of it
    Tv = np.zeros(len(hP))
    for i, p in enumerate(hP):
        si, _ = skin.near(p)
        Tv[i] = max(0.0, (p - skin.P[si]) @ skin.N[si]) / HERO_SHELL
    side = 1 if c.get("hairPart", "left") == "left" else -1
    part_x = 0.024 * side * k

    def T_at(q):
        i, _ = shell.near(q)
        return Tv[i], shell.N[i]

    def region(p):
        r = p - head_c
        rn = r / max(np.linalg.norm(r), 1e-9)
        return r, rn[1], rn[2], rn[0]

    def length(p):
        r, up, fwd, sx = region(p)
        top = BH.ss(0.05, 0.6, up)
        front = BH.ss(-0.2, 0.6, fwd) * BH.ss(0.1, 0.5, up)
        nape = BH.ss(0.0, -0.5, fwd) * BH.ss(0.3, -0.2, up)
        ln = C["side"] + (C["top"] - C["side"]) * top
        ln += (C["front"] - ln) * front
        ln += (C["nape"] - ln) * nape * (1 - top)
        return ln * k

    g = np.array([0.0, -1.0, 0.0])

    def flow(p, n):
        r, up, fwd, sx = region(p)
        top = BH.ss(0.1, 0.55, up)
        if kind == "quiff":       # front: up and back off the hairline; top: back; sides: back and down
            front = BH.ss(0.0, 0.6, fwd) * BH.ss(0.1, 0.5, up)
            d = np.array([0.0, 1.0, -0.35]) * front + np.array([0.0, -0.05, -1.0]) * top * (1 - front) \
                + np.array([0.0, -0.7, -0.75]) * (1 - top)
        elif kind == "crop":      # from the crown forward over the top, the short fringe pushed up (never down onto the
            # forehead: a forward fringe read as a row of spikes), down the sides
            cr = head_c + np.array([0.0, 0.10, -0.07])
            front = BH.ss(0.25, 0.7, fwd) * BH.ss(0.05, 0.45, up)
            d = _tan(p - cr, n) * 0.5 * (1 - front) + np.array([0.0, -0.1, 0.8]) * top * (1 - front) + np.array([0.0, 1.0, 0.25]) * front \
                + g * 0.7 * (1 - top)
        else:                     # side part: across the top toward the far side and a little back; near side down/back
            far = np.sign(r[0] - part_x) != side
            if far:
                d = np.array([-side * 1.0, 0.0, -0.35 + 0.25 * BH.ss(0.3, 0.8, fwd)]) * top + np.array([-side * 0.25, -0.8, -0.6]) * (1 - top)
            else:
                d = np.array([side * 0.5, -0.4, -0.9]) * top + np.array([side * 0.1, -0.8, -0.6]) * (1 - top)
        t = _tan(np.asarray(d, float), n)
        if np.linalg.norm(t) < 1e-6:
            t = _tan(g + np.array([0, 0, -0.3]), n)
        return t / max(np.linalg.norm(t), 1e-9)

    # layers: (fraction of the thickness, share of the cards, width factor, colour factor, importance)
    layers = [(0.60, 0.24, 1.15, 0.82, 0.3), (0.78, 0.30, 1.05, 0.92, 1.0), (0.94, 0.38, 1.0, 1.0, 2.2), (0.99, 0.08, 0.5, 1.02, 1.6)]
    budget = BH.budget(c)
    target = 16000 if budget >= 16000 else 4800 if budget > 9000 else 1800
    probe, _, _ = _sample_tris(hP, hT, 800, rng)
    lens = np.array([length(q) for q in probe])
    tprobe = np.array([T_at(q)[0] for q in probe])
    okp = tprobe > 0.0022 * k
    mean_seg = float(np.mean(np.clip(np.round(lens[okp] / (0.0085 * k)), 3, 8))) if okp.any() else 4
    n_cards = int(target / (2 * mean_seg))
    cand, cti, _ = _sample_tris(hP, hT, n_cards * 4, rng)
    cards = []
    li = 0
    for ci in range(len(cand)):
        if len(cards) >= n_cards:
            break
        p = cand[ci]
        Tp, n = T_at(p)
        if Tp < 0.0018 * k or rng.random() > BH.ss(0.0018 * k, 0.0036 * k, Tp):    # the fade: the painted scalp carries it, the cards thin out over it
            continue
        if cover is not None:
            qi, qd = cover.near(p)
            if qd < 0.035 and (cover.P[qi] - p) @ n > -0.002:
                continue
        u = rng.random()
        acc = 0.0
        for li, lay in enumerate(layers):
            acc += lay[1]
            if u <= acc:
                break
        f, _, wf, cf, imp0 = layers[li]
        ln = length(p) * rng.uniform(0.7, 1.15) * (0.8 if li == 3 else 1.0)
        nseg = int(np.clip(round(ln / (0.0085 * k)), 3, 8))
        ds = ln / nseg
        jit = rng.normal(0, 0.06 if kind != "crop" else 0.2)      # combed cuts: coherent strands
        d = _rot(flow(p, n), n, jit)
        ph = rng.uniform(0, 6.283)
        lam = max(0.02, ln * 0.8)
        pts, nrm = [], []
        q = p.copy()
        for s in range(nseg + 1):
            t = s / nseg
            Tq, sn = T_at(q)
            ki, _ = skin.near(q)
            kp, kn = skin.P[ki], skin.N[ki]
            # the root sits a little under the layer (it grows out of the hair below), the tip a little above it
            ff = f * (0.82 + 0.18 * min(1.0, t * 3)) + (0.015 * t if li == 3 else 0.0)
            if kind == "crop":
                ff += 0.06 * t * rng.random()         # piecey texture: tips lift a little, inside the envelope
            h = max(ff * Tq, 0.0009 * k)
            hh = (q - kp) @ kn
            q = q + kn * (h - hh)
            ci_, _ = coll.near(q)
            hc_ = (q - coll.P[ci_]) @ coll.N[ci_]
            if hc_ < 0.0012:
                q = q + coll.N[ci_] * (0.0012 - hc_)
            if q[2] > eye[2] - 0.035 and abs(q[0] - eye[0]) < 0.07 and q[1] < eye[1] + 0.03:   # never down over the brow
                q[1] = eye[1] + 0.03
            pts.append(q.copy())
            nrm.append(sn * 0.6 + kn * 0.4)
            if s == nseg:
                break
            ang = C["wave"] * math.sin(6.283 * s * ds / lam + ph) * 0.4
            dk = _rot(d, kn, ang)
            q = q + dk * ds
            d = _tan(0.6 * dk + 0.4 * flow(q, kn), kn)
            d = _rot(d / max(np.linalg.norm(d), 1e-9), kn, jit * 0.3)
        pts = np.array(pts)
        nrm = np.array(nrm)
        radial = pts - head_c
        radial /= np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-9)
        nrm = nrm * 0.7 + radial * 0.3
        nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
        w0 = C["W"] * wf * rng.uniform(0.8, 1.2) * k
        width = w0 * (1 - 0.55 * np.linspace(0, 1, len(pts)) ** 1.3)
        column = (4 + int(rng.integers(0, 2))) if li == 3 else int(rng.integers(0, 3))
        v = rng.normal(1.0, 0.03)
        root = hc * 0.72 * cf * v
        tip = hc * rng.uniform(0.97, 1.05) * cf * v
        if grey and rng.random() < 0.18:
            kq = rng.uniform(0.7, 0.88)
            root, tip = root * kq, tip * kq
        W = hW[hT[cti[ci], 0]]
        cards.append((pts, nrm, width, column, root, tip, W, imp0 + rng.random()))
    # the hairline: short fine cards along the front / temple border of the shell, combed in the cut's direction
    ecount = {}
    for t_ in range(len(hT)):
        for a_, b_ in ((0, 1), (1, 2), (2, 0)):
            e_ = tuple(sorted((int(hT[t_, a_]), int(hT[t_, b_]))))
            ecount[e_] = ecount.get(e_, 0) + 1
    bedges = [e_ for e_, n_ in ecount.items() if n_ == 1 and (hP[e_[0]] - head_c)[2] > -0.02 and hP[e_[0]][1] > eye[1] + 0.02]
    nline = {16000: 420, 4800: 130, 1800: 44}[target] if bedges else 0
    for _ in range(nline):
        e_ = bedges[int(rng.integers(0, len(bedges)))]
        p = hP[e_[0]] + (hP[e_[1]] - hP[e_[0]]) * rng.random()
        ki, _ = skin.near(p)
        kp, kn = skin.P[ki], skin.N[ki]
        d = flow(p, kn)
        ln = rng.uniform(0.008, 0.016) * k
        pts = []
        q = kp + kn * 0.0006
        for s in range(4):
            Tq, _ = T_at(q)
            ki, _ = skin.near(q)
            kp, kn = skin.P[ki], skin.N[ki]
            q = kp + kn * max(0.0006, 0.5 * Tq * s / 3)
            pts.append(q.copy())
            q = q + d * ln / 3
            d = flow(q, kn)
        pts = np.array(pts)
        nr = np.repeat(kn[None], 4, 0)
        width = np.array([0.0022, 0.002, 0.0016, 0.001]) * k * rng.uniform(0.8, 1.2)
        v = rng.normal(1.0, 0.05)
        cards.append((pts, nr, width, 4 + int(rng.integers(0, 2)), hc * 0.7 * v, hc * 0.95 * v, np.eye(len(BH.BONE_NAMES))[BH.BI["head"]], 1.4 + rng.random()))
    for cd in cards:
        K.ribbon(*cd, kind=0)
    print(f"  hero cut {cut}: {len(cards)} cards ({nline} hairline), volume {Tv.min():.4f}-{Tv.max():.4f} m", flush=True)
    return len(cards)


class _SphGrid:
    """A field over the directions around a centre (azimuth x elevation bins, azimuth 0 = forward (+z), wraps),
    bilinear lookup. Used for the hair envelope: the outermost radius of the head, ears, collar and gadgets in every
    direction (a smooth shrink-wrap with no gap behind the ears), the scalp coverage and the hair thickness."""
    def __init__(self, c0, naz=120, nel=60):
        self.c0, self.naz, self.nel = np.asarray(c0, float), naz, nel

    def coords(self, D):
        D = np.atleast_2d(D)
        r = np.linalg.norm(D, axis=1)
        az = np.arctan2(D[:, 0], D[:, 2])
        el = np.arcsin(np.clip(D[:, 1] / np.maximum(r, 1e-9), -1, 1))
        return (az + np.pi) / (2 * np.pi) * self.naz - 0.5, (el + np.pi / 2) / np.pi * self.nel - 0.5, r

    def centres(self):
        ea, ee = np.meshgrid((np.arange(self.naz) + 0.5) / self.naz * 2 * np.pi - np.pi, (np.arange(self.nel) + 0.5) / self.nel * np.pi - np.pi / 2)
        return np.stack([np.cos(ee) * np.sin(ea), np.sin(ee), np.cos(ee) * np.cos(ea)], -1)       # (nel, naz, 3)

    def bin_max(self, P):
        fa, fe, r = self.coords(np.asarray(P) - self.c0)
        ia = np.round(fa).astype(int) % self.naz
        ie = np.clip(np.round(fe).astype(int), 0, self.nel - 1)
        G = np.full((self.nel, self.naz), -1.0)
        np.maximum.at(G, (ie, ia), r)
        return G

    def ang_max(self, P, deg):
        """per bin: the largest radius of the points within deg of the bin's centre direction (-1: none); uniform
        everywhere (bins shrink toward the poles, a plain per-bin max leaves holes there)"""
        R = np.asarray(P) - self.c0
        r = np.linalg.norm(R, axis=1)
        U = R / np.maximum(r[:, None], 1e-9)
        Cc = self.centres().reshape(-1, 3)
        out = np.full(len(Cc), -1.0)
        cth = math.cos(math.radians(deg))
        for i in range(0, len(Cc), 256):
            dots = Cc[i:i + 256] @ U.T
            out[i:i + 256] = np.where(dots > cth, r[None, :], -1.0).max(1)
        return out.reshape(self.nel, self.naz)

    @staticmethod
    def _nb(G):
        Gp = np.pad(G, ((1, 1), (0, 0)), mode="edge")
        return [np.roll(Gp, s, 1)[1 + a:1 + a + G.shape[0]] for a in (-1, 0, 1) for s in (-1, 0, 1)]

    def dilate(self, G, n=1):
        for _ in range(n):
            G = np.max(np.stack(self._nb(G)), 0)
        return G

    def fill(self, G):
        for _ in range(200):
            bad = G < 0
            if not bad.any():
                break
            nb = np.stack(self._nb(G))
            ok = nb >= 0
            s = np.where(ok, nb, 0).sum(0)
            n = ok.sum(0)
            G = np.where(bad & (n > 0), s / np.maximum(n, 1), G)
        return np.where(G < 0, 0.0, G)

    def blur(self, G, n=1):
        k = np.array([1, 4, 6, 4, 1], float) / 16
        for _ in range(n):
            G = sum(k[i] * np.roll(G, i - 2, 1) for i in range(5))
            Gp = np.pad(G, ((2, 2), (0, 0)), mode="edge")
            G = sum(k[i] * Gp[i:i + G.shape[0]] for i in range(5))
        # the pole rows: one value (every azimuth there is the same point)
        el = (np.arange(self.nel) + 0.5) / self.nel * 180 - 90
        w = BH.ss(76, 88, np.abs(el))[:, None]
        return G * (1 - w) + G.mean(1, keepdims=True) * w

    def sample(self, G, D):
        fa, fe, _ = self.coords(D)
        a0 = np.floor(fa).astype(int)
        e0 = np.floor(fe).astype(int)
        ta, te = fa - a0, fe - e0
        a0m, a1 = a0 % self.naz, (a0 + 1) % self.naz
        e0c, e1c = np.clip(e0, 0, self.nel - 1), np.clip(e0 + 1, 0, self.nel - 1)
        return (G[e0c, a0m] * (1 - ta) * (1 - te) + G[e0c, a1] * ta * (1 - te) + G[e1c, a0m] * (1 - ta) * te + G[e1c, a1] * ta * te)


def _messy_cards(c, B, hair_objs, coll, cover, rng, K, tier, hc, grey):
    """Messy medium-length cuts (lead_messy / lead_shag / lead_tousle): clumped strand cards grown inside a smooth hair
    envelope. The envelope is the outermost radius of the head (ears, collar and gadgets included, blurred) in every
    direction around the head centre, plus the cut's thickness over the scalp (hero_T) and a thin hanging layer past
    the hairline (fringe, over the ears, the nape). Guide strands march along the cut's flow field (crown whorl, tousled
    by a smooth noise field, gravity below the crown); each guide carries a clump of child cards on deeper and higher
    layers that follow its steps and converge a little toward its tips (pieces, no spikes); a few thin loose strands and
    flicked ends break the silhouette. The fringe ends on an uneven line above the brows; nothing grows forward over
    the eyes or cheeks."""
    C = CUTS[c["hairCut"]]
    kind = C["hero"]
    L = B.L
    eye = L.eye
    k = B.H / 1.75
    head_c = eye + np.array([0, 0.03, -0.075])
    seed = (sum(map(ord, c["id"])) % 97) * 0.37 + {"messy": 0.0, "shag": 3.1, "tousle": 6.7}[kind]
    hP, hN, hT, hW = _obj_surface(hair_objs)
    shell = _Surf(hP, hN)
    G = _SphGrid(head_c)
    # ---- envelope: skin, ears, garments and gadgets near the head
    E = coll.P
    m = (np.linalg.norm(E - head_c, axis=1) < 0.19 * k) & (E[:, 1] > eye[1] - 0.17 * k)
    Em = E[m]
    if len(Em) > 40000:
        Em = Em[rng.choice(len(Em), 40000, replace=False)]
    Renv = G.blur(G.fill(G.ang_max(Em, 4.5)), 2)
    # scalp coverage (the shell) and the shell's own outer radius, from a dense sampling of the shell's surface (its
    # vertices are ~1 cm apart)
    shS, _, _ = _sample_tris(hP, hT, 40000, np.random.default_rng(5))
    Rsh0 = G.ang_max(np.concatenate([shS, hP]), 2.2)
    cov = G.blur((Rsh0 > 0).astype(float), 2)
    Rsh = np.where(Rsh0 > 0, Rsh0, 0.0)
    # thickness: the cut's volume over the scalp, a thin hanging layer past the hairline; a little lumpy
    U = G.centres().reshape(-1, 3)
    Pe = head_c + U * Renv.reshape(-1)[:, None]
    Ts = hero_T(c, Pe - eye) * k
    Tf = (0.0045 + 0.0015 * BH.ss(0.3, -0.3, U[:, 2])) * k
    lump = 0.82 + 0.36 * BH.vnoise(Pe, 45, seed)
    T = ((Tf + (Ts - Tf) * cov.reshape(-1)) * lump).reshape(Renv.shape)

    def lo(q, f):
        """radius of layer f (0 = skin, 1 = the cut's outer surface) in the direction of q (rel. head_c)"""
        re = G.sample(Renv, q)[0]
        r = re + f * G.sample(T, q)[0]
        rs = G.sample(Rsh, q)[0]
        if rs > 0:
            r = max(r, rs + (0.0012 + 0.004 * f) * k)
        return r

    Y = np.array([0.0, 1.0, 0.0])

    def tg(v, u):
        t = v - u * (v @ u)
        n = np.linalg.norm(t)
        return t / n if n > 1e-9 else t

    whorl = np.array([0.025, 1.0, -0.3 if kind != "shag" else -0.45])
    whorl /= np.linalg.norm(whorl)
    side = 1.0 if c.get("hairPart", "left") == "left" else -1.0
    part_x = 0.03 * side * k

    def flow(q):
        """unit tangent of the comb at q (rel. head_c)"""
        u = q / np.linalg.norm(q)
        p = q + head_c - eye                                   # rel. eye
        away = tg(u - whorl, u)
        # around the whorl the strands spiral out (no stubs pointing every way at the crown)
        cw = BH.ss(0.35, 0.05, float(np.linalg.norm(u - whorl)))
        away = away + np.cross(whorl, u) * 2.0 * cw
        away = tg(away, u)
        down = tg(-Y, u)
        gw = 0.12 + 0.9 * BH.ss(0.55, -0.05, u[1])
        fringe = BH.ss(0.35, 0.7, u[2]) * BH.ss(0.75, 0.35, u[1])     # the front, below the top
        topf = BH.ss(-0.4, 0.15, u[2]) * BH.ss(0.35, 0.75, u[1])      # the top front half
        sidew = BH.ss(0.45, 0.85, abs(u[0])) * BH.ss(0.7, 0.3, u[1])
        away = away + tg(np.array([0.0, -0.3, -0.45]), u) * sidew       # over the ears: down and a little back
        if kind == "messy":            # the fringe falls a little toward the side away from the whorl
            d = away + gw * down + tg(np.array([-side * 0.4, 0.0, 0.0]), u) * fringe
        elif kind == "shag":       # middle part: the top falls away from the part to both sides; a curtain fringe
            s_ = np.sign(p[0]) if abs(p[0]) > 0.002 else (1.0 if rng.random() < 0.5 else -1.0)
            d = (away + gw * down) * (1 - topf) + tg(np.array([s_ * 1.0, -0.2, 0.45]), u) * topf * 1.4
            d = d * (1 - fringe) + tg(np.array([s_ * 0.75, -1.0, 0.15]), u) * fringe * 1.4
        else:                      # tousle: the top swept forward and across, a side fringe falling diagonally
            far = (p[0] - part_x) * side < 0
            if far:
                d = (away + gw * down) * (1 - topf) + tg(np.array([-side * 0.75, -0.1, 0.7]), u) * topf * 1.4
                d = d * (1 - fringe) + tg(np.array([-side * 0.8, -0.85, 0.15]), u) * fringe * 1.4
            else:
                d = (away + gw * down) * (1 - topf) + tg(np.array([side * 0.45, -0.55, -0.25]), u) * topf * 1.2
        d = tg(d, u)
        return d / max(np.linalg.norm(d), 1e-9)

    def tousle(q):
        """the tousle angle of a piece rooted at q: a smooth field (neighbouring pieces agree), calmer on the fringe;
        one angle per piece, kept along it (a piece turns smoothly, never folds)"""
        u = q / np.linalg.norm(q)
        p = q + head_c - eye
        fringe = BH.ss(0.35, 0.7, u[2]) * BH.ss(0.75, 0.35, u[1])
        amp = C.get("tousle", 0.5) * (1 - 0.4 * fringe)
        return float(amp * (2 * BH.vnoise(p[None], 45 / k, seed)[0] - 1) * 1.8)

    def floor_of(p, base):
        """height (rel. eye) where a fringe strand at p (rel. eye) ends"""
        if kind == "shag":         # parted: high in the middle, down to the outer brows at the sides
            return base + 0.016 - 0.024 * BH.ss(0.008, 0.045, abs(p[0]))
        if kind == "tousle":       # swept to one side: longer on the side it falls to
            return base - 0.014 * BH.ss(0.0, 0.05, -side * p[0]) + 0.006 * BH.ss(0.0, 0.04, side * p[0])
        return base

    def stopped(q, flo, hem=None):
        p = q + head_c - eye
        if hem is not None:
            uq = q / np.linalg.norm(q)
            if p[1] < (hem[0] + (hem[1] - hem[0]) * BH.ss(-0.4, -0.88, uq[2])) * k:
                return True                                    # ear-length: the hem over the ears and at the nape
        if p[2] > -0.032 * k and abs(p[0]) < 0.078 * k and p[1] < floor_of(p, flo) * k:
            return True                                        # the fringe line: never over the brows / eyes
        if p[2] > -0.046 * k and p[1] < 0.012 * k:
            return True                                        # nothing forward over the cheeks / eye corners
        return p[1] < -0.11 * k

    def length(u):
        top = BH.ss(0.1, 0.6, u[1])
        front = BH.ss(-0.2, 0.6, u[2]) * BH.ss(0.1, 0.5, u[1])
        nape = BH.ss(0.0, -0.5, u[2]) * BH.ss(0.3, -0.2, u[1])
        ln = C["side"] + (C["top"] - C["side"]) * top
        ln += (C["front"] - ln) * front
        ln += (C["nape"] - ln) * nape * (1 - top)
        return ln * k

    MAXTURN = math.radians(20)

    def march(root, f, ln, nseg, jit, lift, flo, guide=None, conv=0.0, hem=None, npre=2):
        """one strand: points (rel. head_c) and tangents; guide = (points, directions, angle) to follow; jit: the
        strand's own extra angle on top of its piece's tousle angle"""
        ds = ln / nseg
        q = root / np.linalg.norm(root) * lo(root, f)
        u = q / np.linalg.norm(q)
        ang = (tousle(q) if guide is None else guide[2]) + jit
        fl = lambda x, ux: _rot(flow(x), ux, ang)
        d = fl(q, u) if guide is None else tg(guide[1][min(npre, len(guide[1]) - 1)], u)
        ph = rng.uniform(0, 6.283)
        lam = max(0.03, ln * 0.7)
        # the card starts a little upstream of its root (its faded-in start lies over the hair it grows out of: the
        # crown, where every strand leaves the whorl, is covered)
        pre = []
        qb = q.copy()
        for _ in range(npre if u[1] > 0.15 else 0):
            ub = qb / np.linalg.norm(qb)
            qb = qb - fl(qb, ub) * ds * 0.55
            if G.sample(cov, qb)[0] < 0.6:
                break
            qb = qb / np.linalg.norm(qb) * lo(qb, f)
            pre.insert(0, qb.copy())
        pts, dirs = pre + [q.copy()], [d.copy()] * len(pre) + [d.copy()]
        for s in range(1, nseg + 1):
            t = s / nseg
            qn = q + d * ds
            if guide is not None:      # pieces: the strands of a clump gather toward the guide near the tips
                gi = min(s + len(pre), len(guide[0]) - 1)
                pull = guide[0][gi] - qn
                un = qn / np.linalg.norm(qn)
                qn = qn + (pull - un * (pull @ un)) * conv * t ** 2
            un = qn / np.linalg.norm(qn)
            qn = un * (lo(qn, f) + lift * t ** 2)
            if stopped(qn, flo, hem):
                break
            pts.append(qn.copy())
            dn = qn - q
            dn = dn / max(np.linalg.norm(dn), 1e-9)
            if guide is not None and s + len(pre) < len(guide[1]):
                want = 0.75 * tg(guide[1][s + len(pre)], un) + 0.25 * fl(qn, un)
            else:
                want = fl(qn, un)
            dp = tg(dn, un)
            d = tg(0.62 * dn + 0.38 * want, un)
            d = _rot(d / max(np.linalg.norm(d), 1e-9), un, C["wave"] * 0.3 * math.sin(6.283 * s * ds / lam + ph))
            ca = float(np.clip(d @ dp, -1, 1))
            if ca < math.cos(MAXTURN):              # a strand bends, never kinks: at most MAXTURN per step
                pr = d - dp * ca
                pr /= max(np.linalg.norm(pr), 1e-9)
                d = dp * math.cos(MAXTURN) + pr * math.sin(MAXTURN)
            dirs.append(d.copy())
            q = qn
        return np.array(pts), np.array(dirs)

    # layers: (fraction of the thickness, share, width factor, colour factor, importance)
    layers = [(0.50, 0.20, 1.30, 0.74, 0.5), (0.68, 0.26, 1.15, 0.85, 1.0), (0.84, 0.30, 1.0, 0.95, 1.8), (0.97, 0.19, 0.85, 1.02, 2.3)]
    budget = BH.budget(c)
    target = 25000 if budget >= 16000 else 6400 if budget > 9000 else 2600
    nseg_of = lambda ln: int(np.clip(round(ln / (0.0085 * k)), 4, 14))
    # guides: roots spread over the scalp (area-weighted on the shell), a little denser toward the front
    cand, cti, _ = _sample_tris(hP, hT, 6000, rng)
    rel_c = cand - head_c
    un_c = rel_c / np.linalg.norm(rel_c, axis=1, keepdims=True)
    keep = rng.random(len(cand)) < 0.55 + 0.45 * BH.ss(-0.6, 0.6, un_c[:, 2])
    cand, cti = cand[keep], cti[keep]
    per = 6                                  # cards per clump (the guide's own card + children)
    n_guides = min(len(cand) // 3, 900)      # an evenly spread pool, used in order until the budget is spent
    # spread the guides evenly (farthest-point style on a random pool)
    pool = cand[: min(len(cand), n_guides * 4)]
    gi_ = [0]
    dmin = np.linalg.norm(pool - pool[0], axis=1)
    up_p = (pool - head_c) / np.linalg.norm(pool - head_c, axis=1, keepdims=True)
    wgt = 1.0 + 0.9 * BH.ss(0.1, 0.75, up_p[:, 1]) + 0.3 * BH.ss(0.2, 0.7, up_p[:, 2])
    for _ in range(n_guides - 1):
        j = int(np.argmax(dmin * wgt))
        gi_.append(j)
        dmin = np.minimum(dmin, np.linalg.norm(pool - pool[j], axis=1))
    groots = pool[gi_] - head_c
    cards = []

    def card(pts, f, wf, cf, imp, column, Wv, tipw=0.62):
        if len(pts) < 3:
            return
        P = pts + head_c
        nrm = pts / np.linalg.norm(pts, axis=1, keepdims=True)
        w0 = C["W"] * wf * rng.uniform(0.8, 1.2) * k
        width = w0 * (1 - (1 - tipw) * np.linspace(0, 1, len(P)) ** 1.2)
        v = rng.normal(1.0, 0.035)
        root = hc * 0.66 * cf * v
        tip = hc * rng.uniform(0.98, 1.08) * cf * v
        if grey and rng.random() < 0.18:
            kq = rng.uniform(0.7, 0.88)
            root, tip = root * kq, tip * kq
        cards.append((P, nrm, width, column, root, tip, Wv, imp + rng.random()))

    nflick = 0
    ntri = 0
    nused = 0
    for g in groots:
        if ntri >= target * 0.86:
            break
        nused += 1
        n0 = len(cards)
        u = g / np.linalg.norm(g)
        fr_g = float(BH.ss(0.3, 0.6, u[2]) * BH.ss(0.85, 0.5, u[1]))      # a fringe piece: soft, feathered, many fine cards
        temple = float(BH.ss(0.55, 0.8, abs(u[0])) * BH.ss(-0.2, 0.3, u[2]))  # over the temples: fine, never a flap
        si, _ = shell.near(g + head_c)
        Wv = hW[si]
        ln = length(u) * rng.uniform(0.82, 1.12)
        nseg = nseg_of(ln)
        flo = rng.uniform(*C["floor"])
        hem = (C["hem"][0] + rng.normal(0, 0.006), C["hem"][1] + rng.normal(0, 0.011))
        flick = rng.random() < C.get("flick", 0.2)
        lift_g = rng.uniform(0.0015, 0.004) * k if flick else 0.0
        if kind == "shag" and u[1] < 0.45:     # shaggy: the ends over the ears and the nape flip out
            lift_g = max(lift_g, rng.uniform(0.003, 0.007) * k)
        ga = tousle(g) + rng.normal(0, 0.12)
        fg = rng.uniform(0.8, 0.95)            # every card on its own depth: crossing cards never share a surface
        gp, gd = march(g, fg, ln, nseg, ga - tousle(g), lift_g, flo, hem=hem)
        if len(gp) < 3:
            continue
        if lift_g > 0:
            nflick += 1
        soft = max(fr_g, temple)
        card(gp, fg, 1.05 - 0.3 * soft, 0.97, 2.2, int(rng.integers(0, 3)), Wv, tipw=0.62 + 0.25 * soft)
        conv = rng.uniform(0.04, 0.18) * (1 - 0.7 * fr_g)
        for _ in range(per - 1 + int(round(2 * soft))):
            # a child root a few mm from the guide's (on the scalp), its own layer
            off = rng.normal(0, 0.0065 * k, 3)
            r0 = g + off - u * (off @ u)
            if G.sample(cov, r0)[0] < 0.5:
                continue
            uu = rng.random()
            acc = 0.0
            for lay in layers:
                acc += lay[1]
                if uu <= acc:
                    break
            f, _, wf, cf, imp = lay
            f = f + rng.uniform(-0.075, 0.075)
            cl = ln * rng.uniform(0.82, 1.04) * (0.9 if f < 0.6 else 1.0)
            pp, _ = march(r0, f, cl, max(3, int(round(nseg * cl / ln))), 0.0, lift_g * BH.ss(0.75, 0.97, f) * rng.uniform(0.5, 1.1),
                          flo + rng.normal(0, 0.005), guide=(gp, gd, ga), conv=conv, hem=(hem[0] + rng.normal(0, 0.003), hem[1] + rng.normal(0, 0.004)))
            col_ = (4 + int(rng.integers(0, 2))) if rng.random() < 0.35 * soft else int(rng.integers(0, 4))
            card(pp, f, wf * (1 - 0.35 * soft), cf, imp, col_, Wv, tipw=0.62 + 0.25 * soft)
        ntri += sum(2 * (len(cd[0]) - 1) for cd in cards[n0:])
    # loose strands: thin wisps above the outer layer (they break the silhouette a little; never long, never stiff)
    nwisp = int(len(cards) * C.get("wisp", 0.06))
    wroots = cand[rng.choice(len(cand), size=min(nwisp, len(cand)), replace=False)] - head_c
    for g in wroots:
        u = g / np.linalg.norm(g)
        si, _ = shell.near(g + head_c)
        ln = length(u) * rng.uniform(0.6, 1.0)
        pp, _ = march(g, rng.uniform(0.97, 1.05), ln, nseg_of(ln), rng.normal(0, 0.25), rng.uniform(0.0015, 0.004) * k, rng.uniform(*C["floor"]), hem=C["hem"])
        card(pp, 1.0, 0.24, 1.04, 1.4, 4 + int(rng.integers(0, 2)), hW[si], tipw=0.7)
    # the hairline: short fine cards along the shell's border where it is seen (front, temples, above the ears)
    ecount = {}
    for t_ in range(len(hT)):
        for a_, b_ in ((0, 1), (1, 2), (2, 0)):
            e_ = tuple(sorted((int(hT[t_, a_]), int(hT[t_, b_]))))
            ecount[e_] = ecount.get(e_, 0) + 1
    bedges = [e_ for e_, n_ in ecount.items() if n_ == 1 and (hP[e_[0]] - head_c)[2] > -0.06 and hP[e_[0]][1] > eye[1] - 0.02]
    nline = {2: 260, 1: 90, 0: 30}[tier] if bedges else 0
    for _ in range(nline):
        e_ = bedges[int(rng.integers(0, len(bedges)))]
        p = hP[e_[0]] + (hP[e_[1]] - hP[e_[0]]) * rng.random() - head_c
        ln = rng.uniform(0.012, 0.024) * k
        pp, _ = march(p, rng.uniform(0.3, 0.6), ln, 4, rng.normal(0, 0.15), 0.0, 0.03, hem=C["hem"])
        card(pp, 0.4, 0.4, 0.82, 1.2, 4 + int(rng.integers(0, 2)), np.eye(len(BH.BONE_NAMES))[BH.BI["head"]], tipw=0.5)
    for cd in cards:
        K.ribbon(*cd, kind=0)
    if os.environ.get("HAIR_DUMP"):          # debug: the card centre lines, the shell, the skin of the head
        np.savez(os.environ["HAIR_DUMP"], pts=np.concatenate([cd[0] for cd in cards]), cid=np.concatenate([np.full(len(cd[0]), i) for i, cd in enumerate(cards)]),
                 shell=hP, eye=eye, head_c=head_c, Renv=Renv, T=T, cov=cov, Rsh=Rsh)
    tris = sum(2 * (len(cd[0]) - 1) for cd in cards)
    print(f"  messy cut {c['hairCut']}: {len(cards)} cards ({nused} clumps, {nflick} flicked, {nwisp} wisps, {nline} hairline), {tris} tris, "
          f"thickness {T.min():.4f}-{T.max():.4f} m", flush=True)
    return len(cards)


CUTS["braids"] = dict(CUTS["braid"])
CUTS["buns"] = dict(CUTS["bun"])
CUTS["textured_crop"] = dict(CUTS["crop"])
CUTS["swept_back"] = dict(CUTS["swept"])
CUTS["side_swept"] = dict(CUTS["sideswept"])


def resolve_cut(c):
    """A cast entry with a cut name in "hair": the hair volume style in "hair", the cut in "hairCut" (a copy)."""
    cut = c.get("hairCut") or c.get("hair")
    if not ON or cut not in CUTS:
        return c
    c = dict(c)
    c["hairCut"] = cut
    c["hair"] = CUTS[cut]["base"]
    return c


def _cut_cards(c, B, cov, hair_objs, coll, cover, rng, K, tier, hc, grey):
    """Strand cards of a cut over the hair volume. Returns the number of scalp cards."""
    cut = c.get("hairCut") or cov.get("_style")
    C = CUTS[cut]
    if C.get("hero") and os.environ.get("HERO_HAIR") != "0":
        return _hero_cards(c, B, cov, hair_objs, coll, cover, rng, K, tier, hc, grey)
    L = B.L
    eye = L.eye
    k = B.H / 1.75
    head_c = eye + np.array([0, 0.03, -0.075])
    crown = head_c + np.array([0.0, 0.095, -0.05])
    hP, hN, hT, hW = _obj_surface(hair_objs)
    surf = _Surf(hP, hN)
    budget = BH.budget(c)
    # hero pipeline v7: the hero gets more, narrower cards (finer layering; 6 000 tris and full width before)
    target = 7800 if budget >= 16000 else 3200 if budget > 9000 else 1400
    wk = 0.85 if budget >= 16000 else 1.0
    side = 1 if (sum(map(ord, c["id"])) % 2) else -1
    if c.get("hairPart") in ("left", "right"):
        side = 1 if c["hairPart"] == "left" else -1
    part_x = 0.024 * side

    def region(p):
        rel = p - head_c
        r = max(np.linalg.norm(rel), 1e-6)
        up, fwd = rel[1] / r, rel[2] / r
        top = BH.ss(0.2, 0.62, up)
        front = BH.ss(0.05, 0.55, fwd) * BH.ss(-0.05, 0.4, up)
        nape = BH.ss(0.15, -0.35, up) * BH.ss(0.05, -0.55, fwd)
        return rel, up, fwd, top, front, nape

    def length(p):
        rel, up, fwd, top, front, nape = region(p)
        ln = C["side"] + (C["top"] - C["side"]) * top
        ln += (C["front"] - ln) * front
        ln += (C["nape"] - ln) * nape
        return ln * k

    def lift(p):
        rel, up, fwd, top, front, nape = region(p)
        return (C["lift"] * top + (C["frontLift"] - C["lift"]) * front) * k

    def dens(p):
        rel, up, fwd, top, front, nape = region(p)
        return C["side_dens"] + (1 - C["side_dens"]) * max(top, front * 0.8)

    g = np.array([0.0, -1.0, 0.0])
    comb = C["comb"]

    def flow(p, n, jitter):
        rel, up, fwd, top, front, nape = region(p)
        if comb == "fwd":
            d = _tan(p - crown, n) + np.array([0, 0, 0.9]) * top + g * 0.4 * (1 - top)
        elif comb == "up_fwd":
            d = np.array([0.15 * np.sign(rel[0]) * (1 - top), 0.2 * front, 1.0]) * top + (g * 0.8 + np.array([0, 0, -0.3])) * (1 - top)
        elif comb == "quiff":
            d = (np.array([0, 1.0, -0.35]) * front + np.array([0.0, -0.1, -1.0]) * top * (1 - front) + (g + np.array([0, 0, -0.6])) * (1 - max(top, front)))
        elif comb == "side":
            far = np.sign(rel[0] - part_x) != side      # the side the top is swept toward
            if far:
                d = np.array([-side * 1.0, -0.15, 0.35 * BH.ss(-0.02, 0.06, rel[2])]) * max(top, front) + (g + np.array([0, 0, -0.2])) * (1 - max(top, front))
            else:
                d = np.array([side * 0.7, -0.6, 0.0]) + g * 0.5
        elif comb == "back":        # up off the forehead, then back over the top and down the back
            d = np.array([0, 0.45, -1.0]) * front + np.array([0.25 * np.sign(rel[0]) * (1 - top), -0.25 - 0.5 * (1 - top), -1.0]) * (1 - front)
        elif comb == "tousle":
            d = _tan(p - crown, n) + np.array([0, -0.1, 0.7]) * top + g * 0.5 * (1 - top)
        elif comb == "crown_fwd":
            d = (p - crown) / max(np.linalg.norm(p - crown), 1e-9) + np.array([0, -0.02, 0.06 * (rel[2] > -0.04)]) + g * 0.25 * BH.ss(0.05, -0.02, rel[1])
        elif comb == "side_fwd":
            d = (p - crown) / max(np.linalg.norm(p - crown), 1e-9) + np.array([0.05 * side, -0.01, 0.04])
        elif comb == "part":         # from the part line out to the sides and back (framing the face, not over it)
            sx = np.sign(rel[0] - part_x * 0.9) or 1.0
            d = (np.array([sx * 0.9, 0.3, -0.7]) * front
                 + (np.array([sx * 0.8, -0.35, -0.25 + 0.4 * BH.ss(-0.02, 0.06, rel[2])]) + g * 1.2 * BH.ss(0.07, 0.0, rel[1])) * (1 - front))
        elif comb == "gather":
            gat = head_c + np.array([0.0, 0.05 if cut not in ("bun", "buns") else 0.085, -0.105])
            d = (gat - p) / max(np.linalg.norm(gat - p), 1e-9)
        elif comb in ("curl", "crown"):
            d = (p - crown) / max(np.linalg.norm(p - crown), 1e-9) + g * 0.25 * BH.ss(0.05, -0.02, rel[1])
        else:
            d = g
        t = _tan(np.asarray(d, float), n)
        if np.linalg.norm(t) < 1e-6:
            t = _tan(g + np.array([0, 0, -0.3]), n)
        t = t / max(np.linalg.norm(t), 1e-9)
        if jitter:
            t = _rot(t, n, jitter)
        return t

    # roots: area-uniform over the hair volume, thinned where the cut is short (fades, undercuts)
    _, _, area = _sample_tris(hP, hT, 0, rng)
    probe, pti, _ = _sample_tris(hP, hT, 600, rng)
    nseg_of = lambda ln: 2 if ln < 0.015 else 3 if ln < 0.045 else 4 if ln < 0.09 else 5
    mean_seg = float(np.mean([nseg_of(length(q)) for q in probe])) if len(probe) else 3
    n_cards = int(target / (2 * mean_seg))
    cand, cti, _ = _sample_tris(hP, hT, n_cards * 3, rng)
    keep = [i for i in range(len(cand)) if rng.random() < dens(cand[i]) and length(cand[i]) > 0.0075 * k]
    keep = keep[:n_cards]
    roots, ti = cand[keep], cti[keep]
    # the hairline: extra fine cards rooted along the hair volume's front / side border (a soft, combed hairline
    # instead of the volume's cut edge)
    ecount = {}
    for t_ in range(len(hT)):
        for a_, b_ in ((0, 1), (1, 2), (2, 0)):
            e_ = tuple(sorted((int(hT[t_, a_]), int(hT[t_, b_]))))
            ecount[e_] = ecount.get(e_, 0) + 1
    tri_of = {}
    for t_ in range(len(hT)):
        for a_, b_ in ((0, 1), (1, 2), (2, 0)):
            tri_of.setdefault(tuple(sorted((int(hT[t_, a_]), int(hT[t_, b_])))), t_)
    bedges = []
    for e_, n_ in ecount.items():
        if n_ != 1:
            continue
        m_ = (hP[e_[0]] + hP[e_[1]]) / 2
        rel_ = m_ - head_c
        if np.linalg.norm(rel_) < 0.14 and m_[1] > eye[1] - 0.03 and rel_[2] > -0.06:
            bedges.append(e_)
    nline = {7800: 200, 3200: 90, 1400: 40}[target] if bedges else 0
    line_roots, line_ti = [], []
    for _ in range(nline):
        e_ = bedges[int(rng.integers(0, len(bedges)))]
        t_ = tri_of[e_]
        q_ = hP[e_[0]] + (hP[e_[1]] - hP[e_[0]]) * rng.random()
        cen_ = hP[hT[t_]].mean(0)
        q_ = q_ + (cen_ - q_) * rng.uniform(0.15, 0.6)
        line_roots.append(q_)
        line_ti.append(t_)
    n_line = len(line_roots)
    if n_line:
        roots = np.concatenate([np.array(line_roots), roots])
        ti = np.concatenate([np.array(line_ti, int), ti])
    cards = []
    for ci in range(len(roots)):
        at_line = ci < n_line
        p = roots[ci].copy()
        si, _ = surf.near(p)
        n = surf.N[si]
        if cover is not None:      # under a cap / helmet / hood: hidden, and a card would poke through
            qi, qd = cover.near(p)
            if qd < 0.035 and (cover.P[qi] - p) @ n > -0.002:
                continue
        ln = length(p) * rng.uniform(0.75, 1.2)
        if at_line:       # short combed hairs along the hairline: they lie in the comb's direction, never hang
            ln = min(ln * rng.uniform(0.35, 0.7), 0.028 * k * rng.uniform(0.6, 1.0))
        if ln < 0.008 * k:          # clipper-short (fade sides, nape): the painted scalp carries it, a card reads as a dash
            continue
        nseg = nseg_of(ln)
        ds = ln / nseg
        # short hair holds its shape, long hair hangs; styled cuts (quiff, slick, side-swept) hold it with product
        stiff = max(float(np.clip((0.065 * k - ln) / (0.045 * k), 0, 1)), C.get("stiff", 0.0) * float(np.clip((0.16 * k - ln) / (0.08 * k), 0, 1)))
        if at_line:
            stiff = 1.0
        wisp = rng.random() < (0.6 if at_line else C["wisp"])
        jit = rng.normal(0, 0.35 if comb == "tousle" else 0.12)
        d = flow(p, n, jit)
        h0 = rng.uniform(0.0003, 0.0008) if at_line else rng.uniform(0.0006, 0.0018)
        hl = lift(p) * rng.uniform(0.6, 1.3)
        amp, lam = C["wave"], max(0.012, ln * 0.6) if comb != "curl" else 0.012
        ph = rng.uniform(0, 6.283)
        pts, nrm = [p + n * h0], [n]
        off_edge = False
        for kk in range(1, nseg + 1):
            t = kk / nseg
            ang = amp * math.sin(6.283 * (kk * ds) / lam + ph) * (0.4 + 0.6 * t)
            dk = _rot(d, n, ang * (0.35 if comb != "curl" else 1.0))
            q = pts[-1] + dk * ds
            si, dist = surf.near(q)
            s0, sn = surf.P[si], surf.N[si]
            tang = q - s0 - sn * ((q - s0) @ sn)
            h = h0 + hl * t ** 1.1 + (0.002 * t if wisp else 0.0)
            if np.linalg.norm(tang) < 0.012 and not off_edge:
                q = q - sn * ((q - s0) @ sn - h)
                n = sn
            else:                                    # past the volume's edge: long hair falls, short hair stands
                off_edge = True
                fall = 1 - stiff
                dd = d * (1 - 0.5 * fall) + g * 0.9 * t * fall + n * 0.35 * stiff
                if comb in ("part", "gather", "back", "side", "down") and q[2] > eye[2] - 0.03 and abs(q[0] - eye[0]) < 0.06:
                    dd = dd + np.array([np.sign(q[0] - eye[0]) or 1.0, 0.0, -0.3]) * 0.9 * fall     # long hair falls beside the face
                q = pts[-1] + dd / max(np.linalg.norm(dd), 1e-9) * ds
            if q[2] > eye[2] - 0.035 and abs(q[0] - eye[0]) < 0.07 and q[1] < eye[1] + 0.017:     # never past the brows
                q[1] = eye[1] + 0.017
            ki, kd = coll.near(q)
            kp, kn = coll.P[ki], coll.N[ki]
            hh = (q - kp) @ kn
            if hh < 0.0022:
                q = q + kn * (0.0022 - hh)
            if cover is not None:
                qi, qd = cover.near(q)
                if qd < 0.006:
                    q = q + cover.N[qi] * (0.006 - qd)
            pts.append(q)
            nrm.append(n)
            dn = q - pts[-2]
            dn = dn / max(np.linalg.norm(dn), 1e-9)
            d = _tan(0.65 * dn + 0.35 * flow(q, n, jit), n)
            d = d / max(np.linalg.norm(d), 1e-9)
        pts = np.array(pts)
        nrm = np.array(nrm)
        # shading normals: half the volume's normal, half the head's centre-out direction (a soft, rounded light, no
        # card-by-card facets)
        radial = pts - head_c
        radial /= np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-9)
        nrm = nrm * 0.55 + radial * 0.45
        nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
        w0 = C["W"] * wk * rng.uniform(0.8, 1.25) * k * (0.6 if wisp else 1.15 if off_edge else 1.0) * (0.7 if at_line else 1.0)
        width = w0 * (1 - 0.4 * np.linspace(0, 1, len(pts)) ** 1.2)
        if off_edge and not wisp and comb != "curl":
            column = int(rng.integers(0, 3))
        elif wisp:
            column = 4 + int(rng.integers(0, 2))
        elif comb == "curl":
            column = 6
        elif ln < 0.03 * k:
            column = 3 if rng.random() < 0.35 else int(rng.integers(0, 3))
        else:
            column = int(rng.integers(0, 3)) if rng.random() < 0.8 else 3
        # the low tier draws the most important 45 %: spread over the whole head with a slight bias to the silhouette and
        # the hairline (v6 gave every edge card priority, so the low tier showed a bare glossy cap with a fringe of spikes)
        imp = 1.0 + rng.random() + (0.15 if (off_edge or wisp) else 0.0) + (0.25 if at_line else 0.0)
        v = rng.normal(1.0, 0.06)
        root = hc * 0.62 * v
        tip = hc * rng.uniform(0.95, 1.08) * v
        if grey and rng.random() < 0.18:
            kq = rng.uniform(0.7, 0.88)
            root, tip = root * kq, tip * kq
        W = hW[hT[ti[ci], 0]]
        cards.append((pts, nrm, width, column, root, tip, W, imp))
    for cd in cards:
        K.ribbon(*cd, kind=0)
    return len(cards)


def _lash_strands(K, c, rts, tps, e, s, bone, lash_c, tier, B):
    """Hero pipeline lashes: one fine ribbon per lash (the single strand of the fine column, HT_SINGLE) along the lid
    margin of MakeHuman's lash helper: rooted a little inside the lid, leaving along the helper's direction, fanning
    toward the outer corner and curling up (upper) / down (lower); longest past the middle of the lid, short at both
    corners; lower lashes shorter, sparser, finer and a little lighter. (v5 drew one card across the whole lid: under
    the mips it read as a grey band with a black wing at the outer corner.)"""
    upper = bone.startswith("lid_")
    rng = np.random.default_rng(sum(map(ord, c["id"])) * 17 + (1 if upper else 2) + (0 if s == "l" else 5))
    k_ = B.H / 1.75
    fem = c["macro"].get("gender", 0.5) < 0.5
    n = {2: 78, 1: 44, 0: 22}[tier] if upper else {2: 20, 1: 12, 0: 6}[tier]
    seg = np.linalg.norm(np.diff(rts, axis=0), axis=1)
    arc = np.concatenate([[0], np.cumsum(seg)])
    arc /= max(arc[-1], 1e-9)
    tipd = tps - rts
    tipd /= np.maximum(np.linalg.norm(tipd, axis=1, keepdims=True), 1e-9)
    outn = (rts + tps) / 2 - e
    outn /= np.maximum(np.linalg.norm(outn, axis=1, keepdims=True), 1e-9)
    lat = rts[-1] - rts[0]
    lat /= max(np.linalg.norm(lat), 1e-9)
    up = np.array([0.0, 1.0 if upper else -1.0, 0.0])
    Lmax = (0.0068 if upper else 0.0019) * k_ * (1.2 if fem else 1.0) * float(c.get("lashLen", 1.0))
    # MakeHuman's lash helper sits on the front-upper edge of a ~1.8 mm thick lid rim (the rim faces forward and is seen
    # from the front): the roots move down over the rim to the opening and a little back toward the eyeball, so the
    # lashes leave the lid margin itself (checked against the eye opening in Blender renders of the raw build)
    drop = (0.0012 if upper else 0.0013) * k_
    col = lash_c if upper else lash_c * 3.0 + 0.012
    W = np.zeros(len(BH.BONE_NAMES))
    W[BH.BI["head"]] = 1
    wid = np.array([0.00034, 0.00030, 0.00023, 0.00014]) * k_ * (1.0 if upper else 0.55)
    ip = lambda A, u: np.array([np.interp(u, arc, A[:, d]) for d in range(3)])
    for i in range(n):
        u = 0.03 + 0.94 * (i + rng.uniform(0.15, 0.85)) / n
        root, dn, on = ip(rts, u), ip(tipd, u), ip(outn, u)
        bk = e - root
        root = root - up * drop + bk / max(np.linalg.norm(bk), 1e-9) * 0.0006 * k_
        dn /= max(np.linalg.norm(dn), 1e-9)
        on /= max(np.linalg.norm(on), 1e-9)
        # proto:makehuman: shorter toward the outer corner (a long fanned outer corner read as a painted eyeliner wing)
        shape = np.interp(u, [0.0, 0.18, 0.5, 0.8, 1.0], [0.42, 0.72, 1.0, 0.82, 0.38] if upper else [0.3, 0.6, 1.0, 0.8, 0.35])
        ln = Lmax * shape * rng.uniform(0.82, 1.1)
        d = dn + lat * (u - 0.45) * (0.16 if upper else 0.12)
        d = _rot(d / max(np.linalg.norm(d), 1e-9), on, rng.normal(0, 0.07))
        curl = rng.uniform(0.8, 1.2)
        pts = np.array([root - dn * 0.0003 * k_,
                        root + d * ln * 0.42 + up * ln * 0.05 * curl,
                        root + d * ln * 0.76 + up * ln * 0.24 * curl,
                        root + d * ln * 0.93 + up * ln * 0.5 * curl])
        K.ribbon(pts, np.repeat(on[None], 4, 0), wid * rng.uniform(0.85, 1.1), 7, col * 0.9, col * 1.15, W, 3.0,
                 fine=bone, u0=HT_SINGLE[0], u1=HT_SINGLE[1], kind=1)


def hair_cards(c, B, cov, parts, ex):
    """Build gh_<id>: strand cards over the hair volume (scalp shell, hanging sheets, buns, braids, pony tails), lash
    cards on the lids, brow cards and (with a beard) beard cards. Returns the Blender object or None."""
    rng = np.random.default_rng(sum(map(ord, c["id"])) * 131 + 7)
    style = cov.get("_style", "none")
    budget = BH.budget(c)
    tier = 2 if budget >= 16000 else 1 if budget > 9000 else 0
    hc, grey = _hair_cols(c, rng)
    K = Cards()
    L = B.L
    eye = L.eye
    head_c = eye + np.array([0, 0.03, -0.075])
    allobjs = parts + ex
    hair_objs = [o for o in allobjs if o.name.split(".")[0].startswith(HAIR_OBJ) and not o.name.startswith("hair_tie") and len(o.data.vertices) > 8]
    covers = [o for o in allobjs if o.name.split(".")[0].startswith(COVER_OBJ)]
    body_skin = B.P[B.bodyv]
    body_n = B.N[B.bodyv]
    # collision surface: skin + every garment layer / piece that is not hair (cards rest on top of them)
    others = [o for o in allobjs if o not in hair_objs and len(o.data.vertices) > 8 and not o.name.startswith(("eyeball", "teeth", "tongue"))]
    cP, cN, _, _ = _obj_surface(others) if others else (body_skin, body_n, None, None)
    coll = _Surf(np.concatenate([body_skin, cP]), np.concatenate([body_n, cN]))
    cover = None
    if covers:
        qP, qN, _, _ = _obj_surface(covers)
        cover = _Surf(qP, qN)
    n_cards = 0
    if hair_objs and (c.get("hairCut") or style) in CUTS and os.environ.get("CARDS_V1") != "1":
        n_cards = _cut_cards(c, B, cov, hair_objs, coll, cover, rng, K, tier, hc, grey)
    elif hair_objs and style in STYLE:
        S = STYLE[style]
        hP, hN, hT, hW = _obj_surface(hair_objs)
        surf = _Surf(hP, hN)
        # total cards by tier and the visible hair area
        _, _, area = _sample_tris(hP, hT, 0, rng)
        target = {2: 3000, 1: 2000, 0: 1150}[tier]
        L0 = S["L"] * B.H / 1.75
        nseg = 2 if L0 < 0.02 else 3 if L0 < 0.06 else 4 if L0 < 0.1 else 5
        n_cards = int(min(target / (2 * nseg), max(40, area * S["dens"] * 9000 * (0.012 / max(S["W"], 1e-3)))))
        n_cards = int(target / (2 * nseg)) if area * 9000 > target / (2 * nseg) else n_cards
        roots, ti, _ = _sample_tris(hP, hT, n_cards, rng)
        crown = head_c + np.array([0.0, 0.095, -0.05])
        part_x = 0.022 if style in ("bob", "long", "waves") else 0.0
        gather = head_c + np.array([0.0, 0.05 if style != "bun" else 0.085, -0.105])
        side = 1 if (sum(map(ord, c["id"])) % 2) else -1
        hy = head_c[1]

        def flow(p, n, on_head):
            g = np.array([0.0, -1.0, 0.0])
            rel = p - head_c
            comb = S["comb"]
            if not on_head:            # hanging sheets, tails, buns: down (along the piece)
                d = g + np.array([0, 0, -0.25]) if comb == "gather" else g
            elif comb in ("crown", "curl", "crown_fwd", "side_fwd"):
                d = p - crown
                if comb == "crown_fwd":      # Kai: thick waves pushed forward and down over the brow and the ears
                    d = d + np.array([0, -0.02, 0.06 * (rel[2] > -0.04)])
                if comb == "side_fwd":
                    d = d + np.array([0.05 * side, -0.01, 0.04])
                d = d / max(np.linalg.norm(d), 1e-9) + g * 0.25 * BH.ss(0.05, -0.02, rel[1])
            elif comb == "swept":
                d = np.array([0.15 * np.sign(rel[0]) * BH.ss(0.02, 0.06, abs(rel[0])), -0.35, -1.0]) + g * 0.6 * BH.ss(0.06, -0.02, rel[1])
            elif comb == "part":
                sx = np.sign(rel[0] - part_x) or 1.0
                d = np.array([sx * 0.8, -0.35, -0.25 + 0.4 * BH.ss(-0.02, 0.06, rel[2])]) + g * 1.2 * BH.ss(0.07, 0.0, rel[1])
            elif comb == "gather":
                d = gather - p
                d = d / max(np.linalg.norm(d), 1e-9)
            else:
                d = g
            t = _tan(d, n)
            if np.linalg.norm(t) < 1e-6:
                t = _tan(g + np.array([0, 0, -0.3]), n)
            return t / max(np.linalg.norm(t), 1e-9)
        Lh = L0
        hang = [o.name.split(".")[0] for o in hair_objs]
        _ = hang
        cards = []
        for ci in range(len(roots)):
            p = roots[ci].copy()
            si, _ = surf.near(p)
            n = surf.N[si]
            on_head = np.linalg.norm(p - head_c) < 0.13 and p[1] > hy - 0.075
            if cover is not None:      # under a cap / helmet / hood: hidden, and a card would poke through
                qi, qd = cover.near(p)
                if qd < 0.035 and (cover.P[qi] - p) @ n > -0.002:
                    continue
            ln = Lh * rng.uniform(0.7, 1.25) * (1.0 if on_head else 1.15)
            if S["comb"] in ("crown", "curl", "side_fwd") and on_head and p[1] < hy - 0.02:       # shorter at the nape / over the ears
                ln *= 0.75
            if style in ("undercut", "fade") and on_head and p[1] < hy + 0.035:
                ln *= 0.3
            ds = ln / nseg
            d = flow(p, n, on_head)
            h0 = rng.uniform(0.0008, 0.0026)
            amp, lam = S["wave"]
            ph = rng.uniform(0, 6.283)
            pts, nrm = [p + n * h0], [n]
            off_edge = False
            for k in range(1, nseg + 1):
                t = k / nseg
                ang = amp * math.sin(6.283 * (k * ds) / lam + ph) * (0.4 + 0.6 * t)
                dk = _rot(d, n, ang * 0.35) if S["comb"] != "curl" else _rot(d, n, ang)
                q = pts[-1] + dk * ds
                si, dist = surf.near(q)
                s0, sn = surf.P[si], surf.N[si]
                tang = q - s0 - sn * ((q - s0) @ sn)
                h = h0 + S["lift"] * t ** 1.3
                if np.linalg.norm(tang) < 0.012 and not off_edge:
                    q = q - sn * ((q - s0) @ sn - h)     # ride on the hair volume at height h
                    n = sn
                else:                                    # past the volume's edge: falls (fringe tips, ends), stays off skin
                    off_edge = True
                    q = pts[-1] + _tan(d + np.array([0, -0.9, 0]) * t, n) * ds * 0.6 + np.array([0, -1.0, 0]) * ds * 0.4
                    if q[2] > eye[2] - 0.035 and abs(q[0] - eye[0]) < 0.07 and q[1] < eye[1] + 0.016:     # over the face: never past the brows
                        q[1] = eye[1] + 0.016
                ki, kd = coll.near(q)
                kp, kn = coll.P[ki], coll.N[ki]
                hh = (q - kp) @ kn
                if hh < 0.0025:
                    q = q + kn * (0.0025 - hh)
                if cover is not None:
                    qi, qd = cover.near(q)
                    if qd < 0.006:
                        q = q + cover.N[qi] * (0.006 - qd)
                pts.append(q)
                nrm.append(n)
                dn = q - pts[-2]
                dn = dn / max(np.linalg.norm(dn), 1e-9)
                d = _tan(0.65 * dn + 0.35 * flow(q, n, on_head), n)
                d = d / max(np.linalg.norm(d), 1e-9)
            pts = np.array(pts)
            nrm = np.array(nrm)
            # shading normals: the volume's normal bent toward the head's centre-out direction (soft, rounded light)
            radial = pts - head_c
            radial /= np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-9)
            nrm = nrm * 0.9 + radial * 0.1
            nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
            w0 = S["W"] * rng.uniform(0.8, 1.2) * B.H / 1.75
            width = w0 * (1 - 0.45 * np.linspace(0, 1, len(pts)) ** 1.2)
            edge = off_edge or rng.random() < 0.18
            column = (4 + rng.integers(0, 2)) if (edge and rng.random() < 0.55) else (6 if S["comb"] == "curl" else int(rng.integers(0, 4)))
            imp = (2.0 if off_edge else 1.0) + rng.random()
            root, tip = _card_colour(hc, grey, rng)
            W = hW[hT[ti[ci], 0]]
            cards.append((pts, nrm, width, column, root, tip, W, imp))
        for cd in cards:
            K.ribbon(*cd, kind=0)
        n_cards = len(cards)
    # ---- lashes: strips on the lid margins from MakeHuman's lash helpers (root at the lid, tip outward)
    _, _, F = mh.base()
    brow_c = BH.lin(hair_floor(BH.hexc(c.get("browColor", c.get("hairColor", "2e2119"))), 0.12))
    lash_c = brow_c * 0.35 + 0.002
    for s, e in (("l", L.eyeL), ("r", L.eyeR)):
        S_ = s.upper()
        for grp, bone, scale, alpha in ((f"helper-{s}-eyelashes-2", "lid_" + S_, 1.0, 1.0), (f"helper-{s}-eyelashes-1", "lidlo_" + S_, 0.42, 0.4)):
            vs = mh.group_vertices(grp)
            if not vs:
                continue
            Q = B.P[vs]
            dist = np.linalg.norm(Q - e, axis=1)
            dx = (Q - e)[:, 0] * (1 if s == "l" else -1)
            bins = np.linspace(dx.min(), dx.max(), 9)
            rts, tps = [], []
            for a0, a1 in zip(bins[:-1], bins[1:]):
                m = (dx >= a0) & (dx <= a1)
                if m.sum() < 2:
                    continue
                qa = Q[m]
                da = dist[m]
                rts.append(qa[da <= np.percentile(da, 30)].mean(0))
                tps.append(qa[da >= np.percentile(da, 70)].mean(0))
            if len(rts) < 3:
                continue
            rts, tps = np.array(rts), np.array(tps)
            if os.environ.get("LASH_CARD") != "1":
                _lash_strands(K, c, rts, tps, e, s, bone, lash_c, tier, B)
                continue
            if True:      # LASH_CARD=1: the earlier single lash card across the lid
                # one card across the lid: rows = root line and tip line (v), columns along the lid (u)
                k = len(rts)
                mid = (rts + tps) / 2
                out_n = mid - e
                out_n /= np.maximum(np.linalg.norm(out_n, axis=1, keepdims=True), 1e-9)
                tipd = tps - rts
                lens = np.linalg.norm(tipd, axis=1)
                tipd = tipd / np.maximum(lens[:, None], 1e-9)
                taper = np.sin(np.linspace(0.15, 1.0, k) * math.pi * 0.98) ** 0.6
                fem = c["macro"].get("gender", 0.5) < 0.5
                Ltip = (0.0074 if bone.startswith("lid_") else 0.0034) * scale * taper * B.H / 1.75 * (1.15 if fem else 1.0) * float(c.get("lashLen", 1.0))
                # three rows (root, middle, tip): the lashes leave the lid along it, then curl up (upper) / down (lower)
                up = np.array([0, 1.0 if bone.startswith("lid_") else -1.0, 0])
                midp = rts + tipd * Ltip[:, None] * 0.5 + up * Ltip[:, None] * 0.08
                tip = rts + tipd * Ltip[:, None] * 0.85 + up * Ltip[:, None] * 0.32
                base = sum(len(x) for x in K.v)
                vs_, ns_, uv_, cs_, ts_ = [], [], [], [], []
                rows3 = (rts - tipd * 0.0004, midp, tip)
                for i in range(k):
                    for j, P_ in enumerate(rows3):
                        p = P_[i]
                        vs_.append(p)
                        ns_.append(out_n[i])
                        uv_.append(((7 + 0.03 + 0.94 * i / (k - 1)) / HT_COLS, 1.0 - (0.02 + 0.96 * j / 2)))
                        cs_.append(lash_c * (0.8 + 0.25 * j) * alpha)
                        ts_.append(tipd[i])
                faces = []
                for i in range(k - 1):
                    for j in range(2):
                        a0 = base + 3 * i + j
                        faces.append([a0, a0 + 3, a0 + 4, a0 + 1])
                K.v.append(np.array(vs_))
                K.n.append(np.array(ns_))
                K.uv += uv_
                K.col.append(np.array(cs_))
                K.tan.append(np.array(ts_))
                W = np.zeros(len(BH.BONE_NAMES))
                W[BH.BI["head"]] = 1
                K.w.append(np.repeat(W[None], len(vs_), 0))
                K.f.append((faces, 3.0))
                K.fine.append([bone] * len(vs_))
                K.kind.append(1)
    # ---- brows: short cards lying on the brow skin, along the hair direction of each part of the brow
    bt = c.get("browThick", 0.5)
    male = c["macro"].get("gender", 0.5) >= 0.5
    skin = _Surf(body_skin, body_n)
    def on_skin(q, lift=0.0):
        si_, _ = skin.near(q)
        n_ = skin.N[si_]
        return q - n_ * ((q - skin.P[si_]) @ n_ - lift), n_
    nb = {2: 420, 1: 150, 0: 40}[tier]      # proto:makehuman: finer, denser, groomed (v7: 230 / 110 / 34; v6: 140 / 70 / 26 sticks)
    for e, sg in ((L.eyeL, 1), (L.eyeR, -1)):
        # fine hair cards rooted over the brow's band, each along the growth direction of its part of the brow (inner
        # hairs up, the body outward, the tail outward and down; the upper rows lie a little downward)
        for i in range(nb):
            tk = float(rng.random() ** 0.85)
            nn_ = float(rng.random())
            bx = -0.0185 + 0.047 * tk
            by = np.interp(tk, [0, 0.35, 0.68, 1.0], [0.0150, 0.0178, 0.0192, 0.0162]) + c.get("browLift", 0.0)
            bw = np.interp(tk, [0, 0.15, 0.6, 1.0], [0.0072, 0.0068, 0.0048, 0.0018]) * (1.0 if male else 0.78) * (0.8 + 0.4 * bt)
            # proto:makehuman: groomed (the hairs of each part of the brow lie the same way: random angles read unkempt)
            ang = math.radians(np.interp(tk, [0, 0.12, 0.35, 1.0], [62, 40, 12, -10]) + rng.normal(0, 3.5) - 8 * (nn_ - 0.5))
            p0, n = on_skin(e + np.array([bx * sg, by + nn_ * bw, 0.03]), 0.0004)
            for _ in range(2):
                p0, n = on_skin(p0, 0.0004)
            d = _tan(np.array([math.cos(ang) * sg, math.sin(ang), 0.0]), n)
            d /= max(np.linalg.norm(d), 1e-9)
            ln = float(np.interp(tk, [0, 0.4, 1.0], [0.0036, 0.0052, 0.0040]) * rng.uniform(0.85, 1.12))
            pts = np.array([on_skin(p0 + d * ln * f, 0.0003 + 0.00025 * f)[0] for f in (0.0, 0.5, 1.0)])
            nr = np.repeat(n[None], 3, 0)
            col = brow_c * (1.15 + 0.35 * rng.random())       # a little lighter than the scalp hair (black stripes otherwise)
            K.ribbon(pts, nr, np.array([0.00030, 0.00026, 0.00015]) * (1.05 if male else 0.95) * (1.25 if tier < 2 else 1.0), 7, col * 0.8, col * 1.12, np.eye(len(BH.BONE_NAMES))[BH.BI["head"]], 2.5,
                     fine="@split", u0=HT_SINGLE[0], u1=HT_SINGLE[1], kind=2)
    # ---- beard: short cards pointing down the jaw and chin over the painted beard
    brd = c.get("beard", 0.0)
    if brd >= 0.5:
        bc_ = BH.lin(BH.hexc(c.get("beardColor", c.get("hairColor", "2e2119"))))
        rel = body_skin - eye
        my = L.mouth[1] - eye[1]
        reg = (rel[:, 1] < my + 0.012) & (rel[:, 1] > my - 0.075 * B.H / 1.75) & (rel[:, 2] > -0.06) & (np.abs(rel[:, 0]) < 0.068) & (B.hw[B.bodyv] > 0.5)
        lipd = np.hypot((body_skin[:, 0] - L.lip_cx) / max(L.lip_w * 1.15, 0.02), (body_skin[:, 1] - L.mouth[1] - 0.004) / 0.011)
        reg &= lipd > 1.0
        cand = np.nonzero(reg)[0]
        nb = int({2: 110, 1: 80, 0: 45}[tier] * brd)
        if len(cand):
            pick = rng.choice(cand, size=min(nb, len(cand)), replace=False)
            for vi in pick:
                p = body_skin[vi]
                n = body_n[vi]
                d = _tan(np.array([0.0, -1.0, 0.25]), n)
                d /= max(np.linalg.norm(d), 1e-9)
                ln = rng.uniform(0.006, 0.011) * (0.6 + 0.6 * brd)
                pts = np.array([p + n * 0.0006, p + d * ln * 0.5 + n * 0.0014, p + d * ln + n * 0.0018])
                col0, col1 = bc_ * 0.75, bc_ * 0.92
                K.ribbon(pts, np.repeat(n[None], 3, 0), np.array([0.0045, 0.004, 0.003]), 7, col0, col1, np.eye(len(BH.BONE_NAMES))[BH.BI["head"]], 1.5, fine="@split",
                         u0=0.04, u1=HT_SINGLE[0] - 0.04, kind=3)
    if K.empty():
        return None
    # ---- the object: faces ordered by importance (the low tier draws the first part of the index list)
    order = sorted(range(len(K.f)), key=lambda i: -K.f[i][1])
    verts = np.concatenate(K.v)
    nall = np.concatenate(K.n)
    faces = []
    for i in order:
        faces += K.f[i][0]
    # winding: every card faces out along its shading normal (three.js flips the normal of back faces)
    for fi, f in enumerate(faces):
        q = verts[f]
        fn = np.cross(q[1] - q[0], q[2] - q[0])
        if fn @ nall[f].sum(0) < 0:
            faces[fi] = f[::-1]
    uv = np.array(K.uv)
    o = BH.mesh_from("gh_" + c["id"], BH.to_bl_np(verts), faces, [uv[j] for f in faces for j in f])
    # custom normals (the soft head-out normals), tint and strand tangent attributes
    me = o.data
    nrm = BH.to_bl_np(np.concatenate(K.n))
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    try:
        me.normals_split_custom_set_from_vertices([tuple(x) for x in nrm])
    except Exception as ex_:  # noqa: BLE001
        print("  hair cards: custom normals failed", ex_)
    col = np.clip(np.concatenate(K.col), 0, 1) ** (1 / 2.2)     # stored gamma-encoded: 8 bits keep dark hair's steps
    a = me.attributes.new("_hcol", "FLOAT_VECTOR", "POINT")
    a.data.foreach_set("vector", np.ascontiguousarray(col, np.float32).ravel())
    tan = BH.to_bl_np(np.concatenate(K.tan))
    tan /= np.maximum(np.linalg.norm(tan, axis=1, keepdims=True), 1e-9)
    if os.environ.get("MATTE_FINE") != "0":      # proto:makehuman: lashes and brows matte (no strand sheen: grey stripes)
        kinds = np.concatenate([np.full(len(v_), kd_) for v_, kd_ in zip(K.v, K.kind)])
        tan[(kinds == 1) | (kinds == 2)] = 0.0
    a = me.attributes.new("_htan", "FLOAT_VECTOR", "POINT")
    a.data.foreach_set("vector", np.ascontiguousarray(tan * 0.5 + 0.5, np.float32).ravel())
    Wc = np.concatenate(K.w)
    BH.WSTORE[o.name] = Wc
    o["fine_list"] = json.dumps([f for lst in K.fine for f in lst])
    # low tier: the first `lo_tris` triangles (silhouette and fringe cards, lashes, brows)
    ntri = 2 * len(faces)
    lo = 0
    acc = 0
    for i in order:
        acc += 2 * len(K.f[i][0])
        if acc > ntri * 0.45:
            break
        lo = acc
    o["lo_tris"] = int(max(lo, min(ntri, 200)))
    # per-vertex low-tier flag (`_hlo`): the run time sorts the low set first (meshopt reorders the index list)
    flag = np.zeros(len(verts), np.float32)
    starts = np.cumsum([0] + [len(x) for x in K.v])
    acc = 0
    for i in order:
        acc += 2 * len(K.f[i][0])
        if acc <= o["lo_tris"] or K.kind[i] in (1, 2):
            flag[starts[i]:starts[i + 1]] = 1.0
    a_ = me.attributes.new("_hlo", "FLOAT", "POINT")
    a_.data.foreach_set("value", flag)
    o["cards"] = int(n_cards)
    print(f"  hair cards {c['id']}: style {style}, {n_cards} scalp cards, {ntri} tris (low tier {o['lo_tris']})", flush=True)
    return o


# ---------------------------------------------------------------------------------------------------------------
# skin texture content (paint): colour by region and age, hands, and the height (creases, pores) for the normal map
# ---------------------------------------------------------------------------------------------------------------
def _seg_dist(P, a, b):
    ab = b - a
    t = np.clip((P - a) @ ab / max(ab @ ab, 1e-12), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1), t


def natural_skin(rgb):
    """Hero pipeline: the cast's skin hex -> a natural skin albedo (sRGB 0..1). Real skin sits in a narrow hue band
    (about 14-27 degrees: blood red to melanin brown) at a moderate chroma that grows a little in deeper tones; the cast
    hexes ran to orange and yellow (hue 30+, chroma 0.5) and read as an orange cast under the warm key and ACES. The
    value (lightness) and therefore the heritage tone are kept; only hue and chroma are brought into the band."""
    import colorsys
    r, g, b = (float(x) for x in rgb)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    hd = h * 360
    if hd > 180:
        hd -= 360
    if hd > 24:
        hd = 24 + (hd - 24) * 0.4
    elif hd < 14:
        hd = 14 - (14 - hd) * 0.5
    s = min(s * 0.92, 0.30 + 0.26 * (1 - v))
    return np.array(colorsys.hsv_to_rgb((hd % 360) / 360, s, v))


def paint_skin(c, B, pos, part, col, isface, seed):
    """Adds to the painted skin colour (in place) and returns (height m, roughness) per texel for the skin."""
    ss, g2, vnoise, hash01 = BH.ss, BH.g2, BH.vnoise, BH.hash01
    L = B.L
    n = len(pos)
    rel = pos - L.eye
    years = float(c.get("years", 30))
    age = float(np.clip((years - 22) / 50, 0, 1))
    child = years < 14
    male = c["macro"].get("gender", 0.5) >= 0.5
    front = ss(-0.035, -0.015, rel[:, 2])
    face = isface.astype(float) * front
    hands = np.isin(part, ["handL", "handR"])
    h = np.zeros(n)
    rough = np.full(n, 0.58)
    # ---- large-scale complexion: soft mottling and a little redness variation (not on children: porcelain-smooth)
    mot = vnoise(pos, 11, seed + 21) - 0.5
    col *= (1 + (0.05 if not child else 0.025) * mot)[:, None]
    red = vnoise(pos, 26, seed + 23) - 0.5
    col *= (1 + np.outer(0.05 * red * (0.6 + 0.4 * face), [1.0, -0.35, -0.45]))
    # ---- eye sockets: darker, cooler (more with age); the inner corner pinker
    for e, sg in ((L.eyeL, 1), (L.eyeR, -1)):
        d = (pos - (e + np.array([0.002 * sg, -0.004, 0.004]))) * np.array([0.75, 1.2, 1.0])
        k = g2((d ** 2).sum(1), 0.016) * face * (0.09 + 0.1 * age) * (1 - 0.5 * float(c.get("skinSmooth", 0.0)))
        col *= (1 - k[:, None] * np.array([0.12, 0.14, 0.06]) * 4)
    # ---- ears, nose wings, chin: blood close to the surface
    ear = BH.layout()["ears"]
    _ = ear
    earf = np.zeros(n)
    for E in (L.earL, L.earR):
        earf = np.maximum(earf, g2(((pos - E) ** 2).sum(1), 0.022))
    col *= (1 - np.outer(earf * 0.22, [0.0, 0.18, 0.24]))
    for sg in (1, -1):
        wing = np.array([0.016 * sg, L.eye[1] - 0.05, L.eye[2] + 0.014])
        col *= (1 - np.outer(g2(((pos - wing) ** 2).sum(1), 0.006) * face * 0.2, [0.0, 0.16, 0.2]))
    # ---- shave shadow (men with little stubble) and the jaw line
    stub = c.get("stubble", 0.0)
    if male and not child:
        my = L.mouth[1]
        jaw = ss(my + 0.02, my - 0.01, pos[:, 1]) * ss(my - 0.11, my - 0.075, pos[:, 1]) * ss(0.075, 0.05, np.abs(rel[:, 0])) * ss(-0.1, -0.06, rel[:, 2]) * isface
        k = jaw * 0.16 * (1 - min(stub, 1.0) * 0.6)
        col *= (1 - k[:, None] * np.array([0.35, 0.3, 0.18]))
    # ---- age spots (60+), more freckles for freckled skin in the sun-exposed zones
    if years > 50:
        spots = (hash01(pos, 140, seed + 31) > 0.93) * (0.4 + 0.6 * hash01(pos, 70, seed + 33))
        zone = np.clip(face + hands * 1.0 + ss(0.05, 0.09, rel[:, 1]) * isface, 0, 1)
        k = spots * zone * 0.22 * ss(50, 70, years)
        col *= (1 - k[:, None] * np.array([0.25, 0.35, 0.45]))
    # ---- hands: knuckles (redder, darker creases), nail beds (pink, a pale free edge)
    nail = np.zeros(n)
    if hands.any():
        P = B.P
        for s in "LR":
            for f in range(1, 6):
                hds = [BH.jpos(P, f"finger{f}-{k}.{s}____head") for k in (1, 2, 3)]
                tip = BH.jpos(P, f"finger{f}-3.{s}____tail")
                axis = BH.nrm3(tip - hds[2])
                for k, J in enumerate(hds):
                    d2 = ((pos - J) ** 2).sum(1)
                    kn = g2(d2, 0.0055 if k == 0 else 0.0042) * hands
                    col *= (1 - np.outer(kn * (0.16 if k else 0.1), [0.0, 0.14, 0.16]))
                    if k:      # crease rings at the finger joints
                        dd = (pos - J) @ BH.nrm3(hds[min(k, 2)] - hds[k - 1] if k else axis)
                        h -= 0.00009 * g2(dd ** 2, 0.0009) * kn
                # the nail: over the last phalanx, on its back side
                mid = hds[2] * 0.35 + tip * 0.65
                dist, t = _seg_dist(pos, hds[2] + (tip - hds[2]) * 0.35, tip)
                back = BH.nrm3(np.cross(axis, np.array([0, 1.0, 0])) if f == 1 else np.array([0, 1.0, 0]))
                _ = mid, back
                nl = (dist < 0.0062) * hands * ss(0.0062, 0.004, dist)
                nail = np.maximum(nail, nl)
        col = col * (1 - nail[:, None] * 0.35) + nail[:, None] * np.array([0.78, 0.6, 0.56]) * 0.35 * (col.mean(1, keepdims=True) / 0.55)
    # ---- height: pores (face, finer elsewhere), skin lines by age; children nearly smooth
    pf = 0.6 if child else 1.0
    pf *= 1.0 - 0.6 * float(c.get("skinSmooth", 0.0))     # proto:makehuman: clear, even skin for the leads (finer pores)
    pores = (hash01(pos, 2300, seed + 41) > 0.72) * (0.5 + 0.5 * hash01(pos, 1100, seed + 43))
    fine = vnoise(pos, 900, seed + 45) - 0.5
    h -= pf * (0.000045 * pores * (0.6 + 0.8 * face) + 0.00002 * fine)
    if not child:
        # nasolabial folds (everyone a little, deeper with age), forehead lines, crow's feet, under-eye lines
        for sg in (1, -1):
            a = np.array([0.018 * sg, L.eye[1] - 0.052, L.eye[2] + 0.008])
            b = np.array([(L.lip_w + 0.006) * sg, L.mouth[1] - 0.012, L.lip_z - 0.012])
            d, t = _seg_dist(pos, a, b)
            h -= 0.00035 * (0.25 + 0.75 * age) * g2(d ** 2, 0.0024) * face * ss(0.0, 0.2, t)
            (ux, uy), _lo = L.lid["L" if sg > 0 else "R"]
            oc = (L.eyeL if sg > 0 else L.eyeR) + np.array([ux.max() * sg + 0.004 * sg, np.interp(ux.max(), ux, uy), -0.004])
            dd = pos - oc
            r_ = np.hypot(dd[:, 0], dd[:, 1])
            ang = np.arctan2(dd[:, 1], np.abs(dd[:, 0]))
            crow = (0.5 + 0.5 * np.cos(ang * 9 + np.sin(r_ * 300))) ** 8 * ss(0.002, 0.006, r_) * ss(0.022, 0.012, r_) * (dd[:, 0] * sg > 0) * isface
            h -= 0.00012 * age * crow
            ue = (L.eyeL if sg > 0 else L.eyeR) + np.array([0.0, -0.013, 0.006])
            d2 = ((pos - ue) * np.array([0.7, 2.2, 1.0]) ** 1) ** 2
            h -= 0.00014 * (0.2 + 0.8 * age) * g2(d2.sum(1), 0.0035) * face * (0.5 + 0.5 * np.cos((pos[:, 1] - ue[1]) * 900))
        fh = ss(0.025, 0.045, rel[:, 1]) * ss(0.085, 0.06, rel[:, 1]) * ss(0.06, 0.035, np.abs(rel[:, 0])) * face
        ph = rel[:, 1] * 700 + 2.0 * np.sin(rel[:, 0] * 60)
        h -= 0.00016 * (0.15 + 0.85 * age) * fh * (0.5 + 0.5 * np.cos(ph)) ** 6 * (0.6 + 0.4 * np.sin(rel[:, 0] * 90 + seed))
        # neck rings with age
        neck = np.isin(part, ["torso"]) & (pos[:, 1] > B.Jm["neck"][1] - 0.04) & (pos[:, 1] < B.Jm["head"][1] - 0.01)
        h -= 0.00012 * age * neck * (0.5 + 0.5 * np.cos((pos[:, 1] - B.Jm["neck"][1]) * 450)) ** 6
    # ---- roughness: an oily T-zone, matte cheeks, glossy lips and nails
    tz = (g2(rel[:, 0] ** 2, 0.016) * ss(-0.06, -0.03, rel[:, 1]) * ss(0.085, 0.05, rel[:, 1])) * face
    nose = g2(((pos - np.array([0, L.eye[1] - 0.04, L.eye[2] + 0.025])) ** 2).sum(1), 0.012) * face
    rough = rough - 0.18 * np.clip(tz + nose, 0, 1) - 0.04 * face + 0.05 * age
    rough = rough - 0.26 * nail
    rough += 0.06 * (pores - 0.3) * face
    return col, h, np.clip(rough, 0.25, 0.8)


def lip_rough(rough, lipm):
    return np.where(lipm > 0.3, np.minimum(rough, 0.34), rough)


def inner_mouth(c, B, pos, part, col):
    """The inner mouth (the mouth part of the body): wet pink just inside the lips, dark toward the throat."""
    m = part == "mouth"
    if not m.any():
        return col
    L = B.L
    depth = L.lip_z - pos[m, 2]
    inner = np.array([0.55, 0.26, 0.25])
    # proto:makehuman: the mouth bag shades from the wet pink inside the lips to a deep red (near-black read as a hole
    # beside the teeth), darker only toward the throat
    dark = np.array([0.16, 0.05, 0.05]) * (1 - 0.6 * BH.ss(0.03, 0.07, depth))[:, None]
    k = BH.ss(0.0015, 0.02, depth)[:, None]
    col[m] = col[m] * BH.ss(0.006, 0.0, depth)[:, None] * 0.5 + (inner * (1 - k) + dark * k) * (1 - BH.ss(0.006, 0.0, depth)[:, None] * 0.5)
    return col


# ---------------------------------------------------------------------------------------------------------------
# cloth folds: relief at the joints, added to each soft garment's painted height (normal map)
# ---------------------------------------------------------------------------------------------------------------
def cloth_folds(B, P, g, arm_f, leg_f, key, seed):
    if not ON:
        return 0.0
    fab = g.get("fab", "cotton")
    if fab in ("ceramic", "polymer", "metal") or g.get("shape") in ("plates", "pauldron", "gorget"):
        return 0.0
    amp = {"leather": 0.0009, "knit": 0.0006, "wool": 0.0012, "canvas": 0.0012, "denim": 0.0011, "linen": 0.0011}.get(fab, 0.001)
    J = B.Jm
    h = np.zeros(len(P))
    vnoise = BH.vnoise
    wob = vnoise(P, 30, seed + 5) - 0.5
    for s in "LR":
        # elbows: rings round the arm, deepest on the inside of the bend
        sh, el, wr = J["shoulder_" + s], J["elbow_" + s], J["wrist_" + s]
        ax = BH.nrm3(wr - sh)
        d = (P - el) @ ax
        rad = P - el - np.outer(d, ax)
        rr = np.linalg.norm(rad, axis=1)
        inner = 0.6 + 0.4 * (rad @ BH.nrm3(np.cross(ax, np.array([1.0 if s == "L" else -1.0, 0, 0]))) / np.maximum(rr, 1e-6))
        env = np.exp(-(d / 0.055) ** 2) * (rr < 0.075) * arm_f
        ang = np.arctan2(rad[:, 1], rad[:, 2] + 1e-9)
        ph = d / 0.017 * 6.283 + 1.6 * np.sin(ang * 2 + seed) + 3 * wob
        h -= amp * env * inner * (0.5 + 0.5 * np.cos(ph)) ** 3
        # sleeve bunching above the wrist
        dw = (P - wr) @ ax
        envw = BH.ss(-0.11, -0.05, dw) * BH.ss(0.0, -0.03, dw) * arm_f
        h -= amp * 0.6 * envw * (0.5 + 0.5 * np.cos(dw / 0.013 * 6.283 + 2 * np.sin(ang * 3) + 3 * wob)) ** 3
        # armpit: folds fanning from the armpit across the chest side
        ap = sh + np.array([0.0, -0.06, 0.0])
        da = P - ap
        ra = np.linalg.norm(da, axis=1)
        envp = BH.ss(0.11, 0.03, ra) * (1 - arm_f) * (1 - leg_f) * key.startswith("top")
        aa = np.arctan2(da[:, 1], da[:, 2])
        h -= amp * 0.7 * envp * (0.5 + 0.5 * np.cos(aa * 9 + ra * 60 + 2 * wob)) ** 4
        # knees: rings, deepest at the back of the knee; trousers bunch above the boots
        hp, kn, an = J["hip_" + s], J["knee_" + s], J["ankle_" + s]
        ax2 = BH.nrm3(an - hp)
        d2 = (P - kn) @ ax2
        rad2 = P - kn - np.outer(d2, ax2)
        rr2 = np.linalg.norm(rad2, axis=1)
        back = 0.55 + 0.45 * (-rad2[:, 2] / np.maximum(rr2, 1e-6))
        env2 = np.exp(-(d2 / 0.07) ** 2) * (rr2 < 0.09) * leg_f
        ang2 = np.arctan2(rad2[:, 0], rad2[:, 2] + 1e-9)
        h -= amp * 0.9 * env2 * back * (0.5 + 0.5 * np.cos(d2 / 0.02 * 6.283 + 1.4 * np.sin(ang2 * 2 + seed) + 3 * wob)) ** 3
        da2 = (P - an) @ ax2
        enva = BH.ss(-0.16, -0.08, da2) * BH.ss(0.0, -0.04, da2) * leg_f
        h -= amp * 0.7 * enva * (0.5 + 0.5 * np.cos(da2 / 0.018 * 6.283 + 2 * np.sin(ang2 * 3) + 3 * wob)) ** 3
    # waist: soft horizontal folds of tops / coats above the belt line, more at the sides
    if key.startswith("top"):
        y0 = J["pelvis"][1] + 0.06
        dy = P[:, 1] - y0
        side = 0.5 + 0.5 * np.abs(P[:, 0] - J["pelvis"][0]) / 0.17
        envw = np.exp(-(dy / 0.05) ** 2) * (1 - arm_f) * (1 - leg_f)
        h -= amp * 0.6 * envw * np.clip(side, 0, 1.3) * (0.5 + 0.5 * np.cos(dy / 0.022 * 6.283 + 2.2 * np.sin(P[:, 0] * 40 + seed) + 3 * wob)) ** 4
    # crotch: folds fanning out from the crotch over the thighs
    cr = J["pelvis"] + np.array([0, -0.09, 0.02])
    dc = P - cr
    rc = np.linalg.norm(dc, axis=1)
    envc = BH.ss(0.14, 0.04, rc) * leg_f * (dc[:, 1] < 0.02)
    h -= amp * 0.6 * envc * (0.5 + 0.5 * np.cos(np.arctan2(dc[:, 0], -dc[:, 1]) * 8 + rc * 50 + 2 * wob)) ** 4
    return h


def rough_ao_map(himg, mask, spx, rough_img, res, path):
    """The roughness / occlusion map (glTF metallicRoughness: G roughness; occlusion in R from the height's cavities),
    half the atlas resolution."""
    from PIL import Image
    hh = himg
    # cavity: the height below its local mean (a few mm), creases and folds darker
    k = max(2, res // 256)
    pad = np.pad(hh, k, mode="edge")
    acc = np.zeros_like(hh)
    cnt = 0
    for dy in range(-k, k + 1, max(1, k // 2)):
        for dx in range(-k, k + 1, max(1, k // 2)):
            acc += pad[k + dy:k + dy + hh.shape[0], k + dx:k + dx + hh.shape[1]]
            cnt += 1
    cav = np.clip((acc / cnt - hh) / 0.0008, 0, 1)
    ao = 1 - 0.55 * cav
    img = np.stack([ao, np.clip(rough_img, 0, 1), np.zeros_like(ao)], -1)
    half = img.reshape(res // 2, 2, res // 2, 2, 3).mean((1, 3))
    Image.fromarray((np.clip(half, 0, 1) * 255).astype(np.uint8)).save(path, quality=90)
    return path
