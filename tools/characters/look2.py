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
    return expand_weights_split(o, W, B, ["hand_L", "hand_R"] + (["head"] if nm.startswith(HEADSPLIT) else []), None, out)


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


def mouth_objects(B):
    """MakeHuman's upper / lower teeth and tongue helpers (sculpted with the body), uv'd into the mouth cell."""
    _, _, F = mh.base()
    out = []
    eye = B.L.eye
    for g, fine, a0, a1, mask in (("helper-upper-teeth", None, 0.02, 0.34, (0.0, 0.55, 0.0)), ("helper-lower-teeth", "jaw", 0.02, 0.34, (0.0, 0.55, 0.0)),
                                  ("helper-tongue", "jaw", 0.4, 0.66, (0.55, 0.6, 0.0))):
        fs = [f for f in F if f[2] == g]
        used = sorted({v for f in fs for v in f[0]})
        rm = {v: i for i, v in enumerate(used)}
        P = B.P[used].copy()
        # the teeth sit a little inside the lips (MakeHuman's helpers touch them): 1.5 mm back
        P[:, 2] -= 0.0015
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


def paint_mouth_cell(c, img, mask, grid, put):
    """The mouth cell: teeth (ivory, a translucent biting edge), gums and tongue (wet pink), the cavity (near black)."""
    gx, gy, a, b = grid(MOUTH_CELL)
    rng_n = BH.vnoise(np.stack([a * 7, b * 7, np.zeros_like(a)], -1).reshape(-1, 3), 3.0, 1.7).reshape(a.shape)
    ss = BH.ss
    # stored as the cell's a (x) / b (y) like cell_uv: here a runs along the tooth, b across
    ta = a
    tooth = np.array([0.80, 0.76, 0.68]) * (0.93 + 0.07 * rng_n)[..., None]
    tooth = tooth * (1 - 0.18 * ss(0.22, 0.36, ta))[..., None] + np.array([0.02, 0.03, 0.05]) * ss(0.24, 0.34, ta)[..., None]
    gum = np.array([0.62, 0.30, 0.30]) * (0.9 + 0.12 * rng_n)[..., None]
    tongue = np.array([0.66, 0.36, 0.36]) * (0.85 + 0.2 * rng_n)[..., None]
    cav = np.array([0.07, 0.025, 0.025])
    col = np.where((ta < 0.02)[..., None], gum, tooth)
    col = np.where((ta >= 0.36)[..., None], tongue * (1 - 0.45 * ss(0.5, 0.66, ta))[..., None], col)
    col = np.where((ta >= 0.7)[..., None], cav, col)
    _ = b
    put(gx, gy, col)


# ---------------------------------------------------------------------------------------------------------------
# strand texture (one image shared by every character's hair cards): 8 columns of 128 x 1024 texels, v = root (top
# row) -> tip. R: strand brightness, G: a per-strand random (highlight shift / sparkle), B: depth across the card
# (strands at the card's centre lie on top), A: coverage. Drawn 2x and box-filtered.
# ---------------------------------------------------------------------------------------------------------------
HT_W, HT_H, HT_COLS = 1024, 1024, 8
# column kinds: 0-2 dense body, 3 clumped body, 4-5 sparse edge / flyaway, 6 wavy / curly, 7 short fine (lashes, brows, beard)
HT_KIND = ["body", "body", "body", "clump", "sparse", "sparse", "curl", "fine"]


def strand_texture(path):
    if os.path.exists(path):
        return path
    from PIL import Image
    S = 2
    cw, hh = HT_W // HT_COLS * S, HT_H * S
    out = np.zeros((HT_H, HT_W, 4), np.float32)
    rng = np.random.default_rng(20491)
    y = (np.arange(hh) + 0.5) / hh                     # 0 root .. 1 tip
    xs = np.arange(cw) + 0.5
    for col, kind in enumerate(HT_KIND):
        A = np.zeros((hh, cw), np.float32)
        Rr = np.zeros((hh, cw), np.float32)
        G = np.zeros((hh, cw), np.float32)
        n = {"body": 64, "clump": 70, "sparse": 16, "curl": 34, "fine": 40}[kind]
        if kind == "clump":
            cents = rng.uniform(0.2, 0.8, 3) * cw
        for s in range(n):
            x0 = rng.uniform(0.08, 0.92) * cw
            if kind == "fine":     # short strokes: each strand from a random root to a random tip
                t0, t1 = rng.uniform(0.0, 0.25), rng.uniform(0.55, 1.0)
            else:
                t0, t1 = 0.0, rng.uniform(0.45 if kind != "sparse" else 0.4, 1.0) ** 0.7
            wid = rng.uniform(1.6, 3.0) * S * (0.75 if kind in ("fine", "sparse") else 1.0)
            ph, fr = rng.uniform(0, 6.3), rng.uniform(1.0, 2.6)
            amp = {"body": 3.0, "clump": 2.5, "sparse": 6.0, "curl": 14.0, "fine": 2.0}[kind] * S
            if kind == "curl":
                fr = rng.uniform(3.0, 4.5)
            xc = x0 + amp * np.sin(y * fr * 6.283 + ph) + (rng.normal(0, 4 * S) * y ** 2 if kind == "sparse" else 0)
            if kind == "clump":   # strands converge toward their clump's centre near the tip
                cc = cents[np.argmin(np.abs(cents - x0))]
                xc = xc + (cc - xc) * (y ** 1.6) * 0.75
            tt = np.clip((y - t0) / max(t1 - t0, 1e-3), 0, 1)
            inside = (y >= t0) & (y <= t1)
            taper = np.where(inside, (1 - tt ** 3) * np.clip(tt * 12, 0, 1) if kind == "fine" else (1 - tt ** 4), 0.0)
            w = wid * (0.35 + 0.65 * taper)
            d = np.abs(xs[None, :] - xc[:, None])
            cov = np.clip(1.0 - (d - w[:, None] * 0.5) / (0.9 * S), 0, 1) * (taper[:, None] > 0.02)
            cov *= np.clip(taper[:, None] * 3.0, 0, 1)
            br = rng.uniform(0.62, 1.0)
            newA = A + cov * (1 - A)
            Rr = np.where(cov > 0, (Rr * A + br * cov * (1 - A)) / np.maximum(newA, 1e-6), Rr)
            G = np.where(cov > 0.5, rng.random(), G)
            A = newA
        Bd = np.clip(1 - 0.5 * np.abs(xs / cw - 0.5) * 2, 0, 1)[None, :] * np.ones((hh, 1))
        blk = np.stack([Rr, G, Bd, A], -1)
        blk = blk.reshape(HT_H, S, cw // S, S, 4).mean((1, 3))
        out[:, col * (HT_W // HT_COLS):(col + 1) * (HT_W // HT_COLS)] = blk
    # premultiplied-style fill: colour of transparent texels = the column's mean strand colour (no dark mip fringes)
    a = out[..., 3:4]
    mean = (out[..., :3] * a).sum((0, 1)) / max(a.sum(), 1e-6)
    out[..., :3] = out[..., :3] * np.clip(a * 4, 0, 1) + mean * (1 - np.clip(a * 4, 0, 1))
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


def _hair_cols(c, rng):
    hc = BH.lin(BH.hexc(c.get("hairColor", "2e2119")))
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
    if hair_objs and style in STYLE:
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
    brow_c = BH.lin(BH.hexc(c.get("browColor", c.get("hairColor", "2e2119"))))
    lash_c = brow_c * 0.25 + 0.004
    for s, e in (("l", L.eyeL), ("r", L.eyeR)):
        S_ = s.upper()
        for grp, bone, scale, alpha in ((f"helper-{s}-eyelashes-2", "lid_" + S_, 1.0, 1.0), (f"helper-{s}-eyelashes-1", "lidlo_" + S_, 0.55, 0.7)):
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
            # one card across the lid: rows = root line and tip line (v), columns along the lid (u)
            k = len(rts)
            mid = (rts + tps) / 2
            out_n = mid - e
            out_n /= np.maximum(np.linalg.norm(out_n, axis=1, keepdims=True), 1e-9)
            tipd = tps - rts
            lens = np.linalg.norm(tipd, axis=1)
            tipd = tipd / np.maximum(lens[:, None], 1e-9)
            taper = np.sin(np.linspace(0.15, 1.0, k) * math.pi * 0.98) ** 0.6
            Ltip = (0.0085 if bone.startswith("lid_") else 0.0045) * scale * taper * B.H / 1.75 / 1.0
            # curl: the tip turns up (upper) / down (lower)
            up = np.array([0, 1.0 if bone.startswith("lid_") else -1.0, 0])
            tip = rts + tipd * Ltip[:, None] * 0.75 + up * Ltip[:, None] * 0.45
            base = sum(len(x) for x in K.v)
            vs_, ns_, uv_, cs_, ts_ = [], [], [], [], []
            for i in range(k):
                for j, p in enumerate((rts[i] - tipd[i] * 0.0004, tip[i])):
                    vs_.append(p)
                    ns_.append(out_n[i])
                    uv_.append(((7 + 0.05 + 0.9 * i / (k - 1)) / HT_COLS, 1.0 - (0.02 + 0.96 * j)))
                    cs_.append(lash_c * (0.8 + 0.4 * j) * alpha)
                    ts_.append(tipd[i])
            faces = [[base + 2 * i, base + 2 * i + 2, base + 2 * i + 3, base + 2 * i + 1] for i in range(k - 1)]
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
    for e, sg in ((L.eyeL, 1), (L.eyeR, -1)):
        nb = 7 if tier > 0 else 5
        for i in range(nb):
            tk = (i + 0.5) / nb
            bx = -0.0185 + 0.047 * tk
            by = np.interp(tk, [0, 0.35, 0.68, 1.0], [0.0150, 0.0182, 0.0198, 0.0150]) + c.get("browLift", 0.0)
            bw = np.interp(tk, [0, 0.15, 0.6, 1.0], [0.0072, 0.0068, 0.0048, 0.0018]) * (1.0 if male else 0.78) * (0.8 + 0.4 * bt)
            ang = math.radians(np.interp(tk, [0, 0.12, 0.35, 1.0], [78, 52, 16, -14]))
            p0 = e + np.array([bx * sg, by + bw * 0.25, 0.03])
            # project onto the skin from the front
            si, _ = skin.near(p0)
            for _ in range(3):
                p0 = skin.P[si] + skin.N[si] * 0.0009
                si, _ = skin.near(p0)
            n = skin.N[si]
            d = _tan(np.array([math.cos(ang) * sg, math.sin(ang), 0.0]), n)
            d /= max(np.linalg.norm(d), 1e-9)
            ln = 0.0075 * (0.9 + 0.2 * rng.random())
            pts = [p0 - d * ln * 0.45, p0, p0 + d * ln * 0.55]
            pts = [skin.P[skin.near(q)[0]] + skin.N[skin.near(q)[0]] * 0.0009 for q in pts]
            pts = np.array(pts)
            nr = np.repeat(n[None], 3, 0)
            col = brow_c * (0.9 + 0.2 * rng.random())
            K.ribbon(pts, nr, np.full(3, max(bw * 1.6, 0.004)), 7, col * 0.85, col, np.eye(len(BH.BONE_NAMES))[BH.BI["head"]], 2.5, fine="@split", kind=2)
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
                K.ribbon(pts, np.repeat(n[None], 3, 0), np.array([0.0045, 0.004, 0.003]), 7, col0, col1, np.eye(len(BH.BONE_NAMES))[BH.BI["head"]], 1.5, fine="@split", kind=3)
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
        k = g2((d ** 2).sum(1), 0.016) * face * (0.09 + 0.1 * age)
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
    dark = np.array([0.05, 0.018, 0.018])
    k = BH.ss(0.003, 0.022, depth)[:, None]
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
