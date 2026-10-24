"""AFTERZERO realistic cast builder: MakeHuman sculpting (mh.py) + our own skin/clothes/hair texturing, game rig and
animations, in Blender (bpy). Every character is designed in cast_humans.py.

    export MH_DATA=/path/to/makehuman/makehuman/data
    venv/bin/python build_humans.py OUT_DIR            # ONLY=arin,pell to build a subset

Outputs OUT_DIR/cast.glb (all characters) and OUT_DIR/anims.glb (reference rig + clips).

How a character is made:
- layout(): the MakeHuman UV islands are split (face / scalp / torso / limbs ...) and re-packed so the face gets ~2.2x
  the texels of the stock layout (hidden feet shrink); a reserved square holds small "cells" (eye disc, hair, leather,
  sole, fabrics, metal ...) that every non-body piece maps into, so the whole character is ONE texture + ONE material.
- fields(): smooth per-vertex coverage fields (metres; >0 = covered) for each layer: top, trousers, boot shaft, hair,
  headscarf, hood. Layers are copies of the body faces with any vertex covered whose open border is snapped onto the
  field's zero line (no stair-step teeth). Skin keeps a 2 cm band under every border and garments overlap each other
  (top over trousers at the waist, trousers inside the boots), so nothing is ever see-through.
- paint(): every texel is coloured from its 3D position and the same fields (outermost layer wins), with painted
  features placed from real landmarks (lid margins from the lash helpers, lip line from the mouth topology).
- Feet wear a fitted shoe: the convex hull of the real foot, voxel-remeshed, with a stretched sole edge, weighted
  like the skin it covers. Eyes are the MakeHuman cornea shell textured with a painted iris (glossy via the mask).
- Hands rest relaxed (relax_hands: a finger curl baked into the rest mesh with MakeHuman's finger joints and weights);
  the deltoid cap is weighted half to the upper arm, so shoulders stay round when the arms hang down.
- Skirts, coat tails and aprons are cloth tubes: both thighs blend across the front and back panels (the cloth
  stretches between the legs instead of splitting), the hem rim has its own normals, and they skip decimation.
- A per-vertex "_mask" attribute (skin, gloss, hair) drives the runtime skin shading in assets/js/humans.js.
- Decimation classes: face, rest of the head, hands (their own ratio: under the body's ratio the fingers became cones)
  and the body + garments, which never go below 42 % (lower, the collapse folded cloth into holes and smeared texels).
  Atlas island borders are weighted in the 'feat' group so no collapse joins two islands; small hard pieces (pouches,
  buckles, panels, knots) are not decimated. Budgets are targets: a character lands above them rather than tearing.
"""
import json, math, os, sys
from functools import lru_cache
import numpy as np
import bpy, bmesh
from mathutils import Vector, Matrix, kdtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mh  # noqa: E402
import build_characters as BC  # noqa: E402  (tube/shell helpers, clips, export)
import costume  # noqa: E402  (the `wear=[...]` costume pipeline: garments.py catalogue + painters)
import garments  # noqa: E402
import gadgets  # noqa: E402  (hard-surface gadgets of `gear=[...]`, docs/COSTUMES.md)
import importlib  # noqa: E402
import look2  # noqa: E402  (look v2: face / finger rig, eyes, mouth, strand cards, skin bake; LOOK=1: classic)
import likeness_look  # noqa: E402  (photo likeness: beard / brow / mole / colour-zone data of a face file's `likeness`)

# CAST=<name> picks the cast module: cast_<name>.py (e.g. CAST=test -> cast_test.py, CAST=nrzero -> cast_nrzero.py);
# default: AfterZero's cast_humans.py
CAST = importlib.import_module("cast_" + os.environ["CAST"] if os.environ.get("CAST") else "cast_humans").CAST
costume.bind(sys.modules[__name__])
look2.bind(sys.modules[__name__])
gadgets.bind(sys.modules[__name__])

V = Vector
OURS = {  # MakeHuman bone -> our game bone
    "root": "hips", "spine05": "hips", "pelvis.L": "hips", "pelvis.R": "hips",
    "spine04": "spine", "spine03": "spine", "spine02": "chest", "spine01": "chest", "breast.L": "chest", "breast.R": "chest",
    "neck01": "neck", "neck02": "neck", "neck03": "neck",
}
for s in "LR":
    OURS.update({f"clavicle.{s}": f"clavicle_{s}", f"shoulder01.{s}": f"clavicle_{s}", f"upperarm01.{s}": f"upperarm_{s}", f"upperarm02.{s}": f"upperarm_{s}",
                 f"lowerarm01.{s}": f"forearm_{s}", f"lowerarm02.{s}": f"forearm_{s}", f"wrist.{s}": f"hand_{s}",
                 f"upperleg01.{s}": f"thigh_{s}", f"upperleg02.{s}": f"thigh_{s}", f"lowerleg01.{s}": f"shin_{s}", f"lowerleg02.{s}": f"shin_{s}",
                 f"foot.{s}": f"foot_{s}"})
BONE_NAMES = [b[0] for b in BC.BONES]
WSTORE = {}   # object name -> (verts, bones) weight matrix until the rig exists
BI = {b: i for i, b in enumerate(BONE_NAMES)}


def our_bone(mhb):
    if mhb in OURS:
        return OURS[mhb]
    side = "L" if mhb.endswith(".L") else "R" if mhb.endswith(".R") else None
    if side and (mhb.startswith("finger") or mhb.startswith("metacarpal")):
        return "hand_" + side
    if side and mhb.startswith("toe"):
        return "toe_" + side
    return "head"   # face muscles, jaw, eyes, tongue, special*


def to_bl(p):
    """MakeHuman (x left, y up, z forward) metres -> Blender (x left, -y forward, z up)."""
    return V((p[0], -p[2], p[1]))


def to_bl_np(P):
    P = np.asarray(P, float)
    return np.stack([P[:, 0], -P[:, 2], P[:, 1]], 1)


def from_bl_np(Q):
    Q = np.asarray(Q, float)
    return np.stack([Q[:, 0], Q[:, 2], -Q[:, 1]], 1)


def ss(e0, e1, x):
    t = np.clip((np.asarray(x, float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ----------------------------------------------------------------------------------------------------------------
# skeleton (from MakeHuman joints) and weights
# ----------------------------------------------------------------------------------------------------------------
SKEL = None


def skel():
    global SKEL
    if SKEL is None:
        SKEL = json.load(open(mh.path("rigs", "default.mhskel")))
        SKEL["w"] = json.load(open(mh.path("rigs", "default_weights.mhw")))["weights"]
    return SKEL


def jpos(P, name):
    return P[skel()["joints"][name]].mean(axis=0)


def rig_points(P):
    """Our rig joints in Blender space from MakeHuman bone heads/tails."""
    h = lambda b: to_bl(jpos(P, b + "____head"))
    t = lambda b: to_bl(jpos(P, b + "____tail"))
    J = {"pelvis": h("spine05"), "spine": h("spine04"), "chest": h("spine02"), "neck": h("neck01"), "head": h("head"), "headTop": t("head")}
    for s in "LR":
        J["clav_" + s] = h(f"clavicle.{s}")
        J["shoulder_" + s] = h(f"upperarm01.{s}")
        J["elbow_" + s] = h(f"lowerarm01.{s}")
        J["wrist_" + s] = h(f"wrist.{s}")
        J["handEnd_" + s] = h(f"finger3-2.{s}")
        J["hip_" + s] = h(f"upperleg01.{s}")
        J["knee_" + s] = h(f"lowerleg01.{s}")
        J["ankle_" + s] = h(f"foot.{s}")
        J["ball_" + s] = h(f"toe3-1.{s}")
        J["toe_" + s] = t(f"toe3-3.{s}")
    return J


@lru_cache(None)
def dense_weights(n):
    """(n, bones) MakeHuman weights folded onto our 21 game bones, rows normalised."""
    W = np.zeros((n, len(BONE_NAMES)))
    for mhb, lst in skel()["w"].items():
        j = BI[our_bone(mhb)]
        # the deltoid cap (shoulder01) turns half with the arm: on the clavicle alone it squares off as the arm drops
        j2 = BI["upperarm_" + mhb[-1]] if mhb.startswith("shoulder01.") else j
        for vi, w in lst:
            if vi < n:
                W[vi, j] += w * (0.5 if j2 != j else 1.0)
                if j2 != j:
                    W[vi, j2] += w * 0.5
    s = W.sum(1)
    W[s < 1e-9, BI["hips"]] = 1.0
    return W / W.sum(1, keepdims=True)


# relaxed hands: degrees of flexion per phalanx (proximal, middle, distal), thumb first; the metacarpals of the ring
# and little fingers cup the palm a little. MakeHuman's rest hand is flat with the fingers splayed.
CURL = {1: (4, 12, 10), 2: (14, 20, 10), 3: (18, 26, 12), 4: (22, 30, 14), 5: (26, 32, 16)}
CUP = {3: 3.0, 4: 6.0}


def relax_hands(P):
    """Bake a relaxed finger pose into the rest mesh (MakeHuman finger joints / weights, linear blend skinning). Each
    phalanx flexes about its bone X axis, built like MakeHuman's own bone frames from the bone's rotation plane."""
    S = skel()
    bones, planes = S["bones"], S["planes"]

    def axis_x(name):
        b = bones[name]
        h, t = jpos(P, b["head"]), jpos(P, b["tail"])
        p1, p2, p3 = (jpos(P, j) for j in planes[b["rotation_plane"]])
        n = np.cross(nrm3(p3 - p2), nrm3(p2 - p1))
        y = nrm3(t - h)
        z = nrm3(np.cross(n, y))
        return h, np.cross(y, z)

    def rot(h, ax, deg):
        a = math.radians(deg)
        x, y, z = ax
        c, s, C = math.cos(a), math.sin(a), 1 - math.cos(a)
        R = np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                      [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])
        M = np.eye(4)
        M[:3, :3] = R
        M[:3, 3] = h - R @ h
        return M

    G = {}
    for s in "LR":
        for f in range(1, 6):
            parent = np.eye(4)
            if f > 1:
                mc = f"metacarpal{f - 1}.{s}"
                parent = rot(*axis_x(mc), CUP.get(f - 1, 0.0)) if CUP.get(f - 1) else np.eye(4)
                G[mc] = parent
            for k in range(3):
                bn = f"finger{f}-{k + 1}.{s}"
                parent = parent @ rot(*axis_x(bn), CURL[f][k])
                G[bn] = parent
    Ph = np.c_[P, np.ones(len(P))]
    out = P.copy()
    for bn, M in G.items():
        for vi, w in S["w"].get(bn, []):
            if vi < len(P):
                out[vi] += w * ((M @ Ph[vi])[:3] - P[vi])
    return out


def nrm3(v):
    return v / max(np.linalg.norm(v), 1e-12)


# ----------------------------------------------------------------------------------------------------------------
# proxies (.mhclo) e.g. eyes
# ----------------------------------------------------------------------------------------------------------------
def fit_proxy(rel, Pdm, Pdm_scale=None):
    """Fit a MakeHuman proxy (eyes) to sculpted base vertices (decimetres). Returns verts (metres), faces.
    Pdm_scale (fix round 4): the vertices the proxy's x/y/z scale references are read from (the head without its
    dense shape layer: the eye proxy's references are skull points, and a reshaped vault must not resize the eyes)."""
    Ps = Pdm if Pdm_scale is None else Pdm_scale
    d = os.path.dirname(mh.path(rel))
    scale = {}
    rows, obj = [], None
    in_verts = False
    for line in open(mh.path(rel)):
        a = line.split()
        if not a or a[0].startswith("#"):
            continue
        if a[0] == "obj_file":
            obj = os.path.join(d, a[1])
        elif a[0] in ("x_scale", "y_scale", "z_scale"):
            ax = "xyz".index(a[0][0])
            scale[ax] = abs(Ps[int(a[1])][ax] - Ps[int(a[2])][ax]) / float(a[3])
        elif a[0] == "verts":
            in_verts = True
        elif in_verts and len(a) in (1, 9):
            rows.append(a)
        elif in_verts:
            in_verts = False
    out = []
    for a in rows:
        if len(a) == 1:
            out.append(Pdm[int(a[0])])
            continue
        i = [int(x) for x in a[:3]]
        w = [float(x) for x in a[3:6]]
        off = np.array([float(x) for x in a[6:9]]) * np.array([scale.get(0, 1), scale.get(1, 1), scale.get(2, 1)])
        out.append(w[0] * Pdm[i[0]] + w[1] * Pdm[i[1]] + w[2] * Pdm[i[2]] + off)
    faces = []
    for line in open(obj):
        if line.startswith("f "):
            faces.append([int(t.split("/")[0]) - 1 for t in line.split()[1:]])
    return np.array(out) * 0.1, faces


# ----------------------------------------------------------------------------------------------------------------
# colour helpers (sRGB, 0..1)
# ----------------------------------------------------------------------------------------------------------------
def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def lin(c):
    c = np.asarray(c, dtype=float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def vnoise(p, f, seed=0.0):
    """Smooth pseudo-noise of 3D points p (N,3) at frequency f (per metre); 0..1."""
    x, y, z = p[:, 0] * f + seed, p[:, 1] * f + seed * 0.7, p[:, 2] * f - seed * 0.3
    n = (np.sin(x * 1.7 + np.sin(y * 2.3)) + np.sin(y * 1.9 + np.sin(z * 2.9)) + np.sin(z * 2.1 + np.sin(x * 3.1))
         + 0.5 * np.sin(x * 4.3 + y * 3.7) + 0.5 * np.sin(z * 4.1 - y * 3.3))
    return n / 8 + 0.5


def hash01(p, f, seed=0.0):
    """Per-cell white noise (0..1) of 3D points on a grid of 1/f metres (stubble dots, pores)."""
    q = np.floor(p * f)
    h = np.sin(q[:, 0] * 12.9898 + q[:, 1] * 78.233 + q[:, 2] * 37.719 + seed * 4.1) * 43758.5453
    return h - np.floor(h)


def g2(d2, s):
    return np.exp(-d2 / (2 * s * s))


# ----------------------------------------------------------------------------------------------------------------
# texture layout: re-packed MakeHuman islands + a square of material cells
# ----------------------------------------------------------------------------------------------------------------
PART_SCALE = dict(face=2.5, scalp=0.9, lidL=1.0, lidR=1.0, mouth=0.5, torso=0.85, legL=0.8, legR=0.8, armL=0.9, armR=0.9,
                  handL=1.0, handR=1.0, footL=0.3, footR=0.3)
PATCH = 0.22            # side of the cell square (fraction of the atlas)
CELL_NAMES = ["hair", "shoe", "sole", "colA", "colB", "acc", "trim", "metal", "lash", "skin", "glow", "shirt"]
PART_CODE = {k: i for i, k in enumerate(list(PART_SCALE) + ["patch"])}
AUX_RECT = (0.46, 0.15)      # costume pipeline: atlas region for cloth tails, collars, hood rolls, skirts, helmets
AUX_MODE = [False]           # set per character by build(): True for `wear=[...]` costumes
AUX_SCALE = dict(footL=0.55, footR=0.55)   # sandals show the feet


def _skyline(rects, margin=0.006, fixed=("aux",)):
    """Bottom-left skyline packing of (key, w, h) rectangles (largest first, 90-degree rotation allowed except for
    the `fixed` keys)."""
    sky, out = [(0.0, 1.0, 0.0)], {}
    for k, w, h in sorted(rects, key=lambda r: -max(r[1], r[2]) * min(r[1], r[2]) ** 0.3):
        best = None
        for rot in ((0,) if k in fixed else (0, 1)):
            ww, hh = ((h, w) if rot else (w, h))
            ww, hh = ww + margin, hh + margin
            for x in sorted({s[0] for s in sky}):
                if x + ww > 1.0 + 1e-9:
                    continue
                y = max(s[2] for s in sky if s[1] > x + 1e-9 and s[0] < x + ww - 1e-9)
                if best is None or (y + hh, x) < (best[0] + best[3], best[1]):
                    best = (y, x, rot, hh, ww)
        y, x, rot, hh, ww = best
        out[k] = (x, y, rot)
        new = []
        for s in sky:
            if s[1] <= x or s[0] >= x + ww:
                new.append(s)
            else:
                if s[0] < x:
                    new.append((s[0], x, s[2]))
                if s[1] > x + ww:
                    new.append((x + ww, s[1], s[2]))
        new.append((x, x + ww, y + hh))
        sky = sorted(new)
    return out, max(s[2] for s in sky)


def layout():
    """part per body face, per-corner atlas UVs (FUV[face] -> (k,2)), the cell square origin (and the aux rectangle
    of the costume pipeline)."""
    return _layout(AUX_MODE[0])


@lru_cache(None)
def _layout(aux):
    scale = dict(PART_SCALE, **(AUX_SCALE if aux else {}))
    Vb, UV, F = mh.base()
    body = [i for i, f in enumerate(F) if f[2] == "body"]
    W = dense_weights(len(Vb))
    vb = [BONE_NAMES[i] for i in W.argmax(1)]
    P = Vb * 0.1
    P = P - np.array([0, P[:, 1].min(), 0])
    eye = (P[mh.group_vertices("helper-l-eye")].mean(0) + P[mh.group_vertices("helper-r-eye")].mean(0)) / 2
    fam = lambda b: ("torso" if b in ("hips", "spine", "chest", "neck", "clavicle_L", "clavicle_R", "head") else
                     "arm" + b[-1] if b.startswith(("upperarm", "forearm", "hand")) else "leg" + b[-1])
    par = {}

    def find(a):
        while par.setdefault(a, a) != a:
            par[a] = par[par[a]]
            a = par[a]
        return a
    for fi in body:
        ts = F[fi][1]
        for t in ts[1:]:
            ra, rb = find(ts[0]), find(t)
            if ra != rb:
                par[ra] = rb
    isl = {}
    for fi in body:
        isl.setdefault(find(F[fi][1][0]), []).append(fi)
    part = {}
    for fs in isl.values():
        bs = [vb[v] for fi in fs for v in F[fi][0]]
        dom = max(set(bs), key=bs.count)
        for fi in fs:
            vs = list(F[fi][0])
            fb = [vb[v] for v in vs]
            b = max(set(fb), key=fb.count)
            if dom == "head":
                if len(fs) > 1000:
                    rel = P[vs].mean(0) - eye
                    part[fi] = "face" if (rel[2] > -0.03 and -0.16 < rel[1] < 0.07) else "scalp"
                elif len(fs) > 350:
                    part[fi] = "mouth"
                else:   # the two small head islands are the eye sockets (inner lids)
                    part[fi] = "lid" + ("L" if P[vs].mean(0)[0] > 0 else "R")
            elif dom.startswith("hand"):
                part[fi] = "hand" + dom[-1]
            elif dom.startswith(("foot", "toe")):
                part[fi] = "foot" + dom[-1]
            else:
                part[fi] = fam(b)
    parts = {}
    for fi, k in part.items():
        parts.setdefault(k, []).append(fi)
    box = {}
    for k, fs in parts.items():
        uv = UV[[t for fi in fs for t in F[fi][1]]]
        box[k] = (uv.min(0), uv.max(0))

    def attempt(g):
        rects = [(k, (box[k][1] - box[k][0])[0] * scale[k] * g, (box[k][1] - box[k][0])[1] * scale[k] * g) for k in parts]
        return _skyline(rects + [("patch", PATCH, PATCH)] + ([("aux",) + AUX_RECT] if aux else []))
    lo, hi = 0.3, 2.0
    for _ in range(28):
        g = (lo + hi) / 2
        if attempt(g)[1] <= 1.0:
            lo = g
        else:
            hi = g
    place, _ = attempt(lo)
    FUV = {}
    for k, fs in parts.items():
        x, y, rot = place[k]
        s = scale[k] * lo
        b0, b1 = box[k]
        for fi in fs:
            uv = (UV[list(F[fi][1])] - b0) * s
            if rot:
                uv = np.stack([(b1[1] - b0[1]) * s - uv[:, 1], uv[:, 0]], 1)
            FUV[fi] = uv + np.array([x, y])
    # ears (inside the scalp island): lateral bumps behind the eyes
    hv = np.array(sorted({v for fi, k in part.items() if k == "scalp" for v in F[fi][0]}))
    q = P[hv] - eye
    ears = hv[(np.abs(q[:, 0]) > 0.071) & (q[:, 1] > -0.05) & (q[:, 1] < 0.034) & (q[:, 2] < -0.055) & (q[:, 2] > -0.115)]
    out = dict(part=part, FUV=FUV, patch=place["patch"][:2], g=lo, ears=ears)
    if aux:
        x, y, rot = place["aux"]
        out["aux"] = (x, y) + ((AUX_RECT[1], AUX_RECT[0]) if rot else AUX_RECT)
    return out


def cell_rect(name):
    """(u0, v0, size) of a material cell inside the cell square (4x4 grid; the eye disc takes the top-left 2x2)."""
    px, py = layout()["patch"]
    cs = PATCH / 4
    if name == "eye":
        return px, py + 2 * cs, 2 * cs
    slots = [(c, r) for r in range(4) for c in range(4) if not (c < 2 and r >= 2)]
    c, r = slots[CELL_NAMES.index(name)]
    return px + c * cs, py + r * cs, cs


def cell_uv(name, a, b, inset=0.14):
    u0, v0, s = cell_rect(name)
    a, b = np.clip(a, 0, 1), np.clip(b, 0, 1)
    return np.stack([u0 + s * (inset + (1 - 2 * inset) * a), v0 + s * (inset + (1 - 2 * inset) * b)], -1)


# ----------------------------------------------------------------------------------------------------------------
# landmarks
# ----------------------------------------------------------------------------------------------------------------
def _profile(x, y, fn, n=9):
    edges = np.linspace(x.min(), x.max(), n + 1)
    xs, ys = [], []
    for a, b in zip(edges[:-1], edges[1:]):
        m = (x >= a) & (x <= b)
        if m.any():
            xs.append((a + b) / 2)
            ys.append(fn(y[m]))
    return np.array(xs), np.array(ys)


def _rim_chains(P, F, part, lv):
    """The mouth opening (the border between the face and the inner-mouth parts of the base mesh) as a loop, split at
    its two corners (extreme x) into the upper and the lower rim: MH vertex index lists (corners in both), or (None, None)
    when the loop is not clean. The two rims run within a millimetre of each other, so only the topology tells them apart."""
    lvs = set(lv)
    ef, em = set(), set()
    for fi, (vs, _, _) in enumerate(F):
        k = part.get(fi)
        if k not in ("face", "mouth"):
            continue
        for i in range(len(vs)):
            a, b = vs[i], vs[(i + 1) % len(vs)]
            if a in lvs and b in lvs:
                (ef if k == "face" else em).add((min(a, b), max(a, b)))
    edges = ef & em
    nb = {v: [] for v in lvs}
    for a, b in edges:
        nb[a].append(b)
        nb[b].append(a)
    if not lv or any(len(x) != 2 for x in nb.values()):
        return None, None
    loop = [lv[0]]
    prev = None
    while True:
        cur = loop[-1]
        nxt = [u for u in nb[cur] if u != prev]
        if not nxt or nxt[0] == loop[0]:
            break
        prev = cur
        loop.append(nxt[0])
    if len(loop) != len(lv):
        return None, None
    x = P[loop, 0]
    i0, i1 = int(np.argmin(x)), int(np.argmax(x))
    a, b = min(i0, i1), max(i0, i1)
    c1 = loop[a:b + 1]
    c2 = loop[b:] + loop[:a + 1]
    if P[c1, 1].mean() >= P[c2, 1].mean():
        return c1, c2
    return c2, c1


class Landmarks:
    def __init__(self, P):
        self.eyeL = P[mh.group_vertices("helper-l-eye")].mean(axis=0)
        self.eyeR = P[mh.group_vertices("helper-r-eye")].mean(axis=0)
        self.eye = (self.eyeL + self.eyeR) / 2
        self.H = P[:, 1].max() - P[:, 1].min()
        self.ground = P[:, 1].min()
        upper = P[mh.group_vertices("helper-upper-teeth")].mean(axis=0)
        m = mh.joint(P, "mouth")
        self.mouth = np.array([m[0], upper[1] - 0.004, max(m[2], upper[2]) + 0.01])
        # lid margins (dx outward from each eye centre) from the roots of the lash helpers
        self.lid = {}
        for s, e, sg in (("L", self.eyeL, 1), ("R", self.eyeR, -1)):
            up = P[mh.group_vertices(f"helper-{s.lower()}-eyelashes-2")] - e
            lo = P[mh.group_vertices(f"helper-{s.lower()}-eyelashes-1")] - e
            self.lid[s] = (_profile(up[:, 0] * sg, up[:, 1], np.min), _profile(lo[:, 0] * sg, lo[:, 1], np.max))
        # lip contact line: vertices shared by the face part and the inner-mouth part of the layout
        lay = layout()
        _, _, F = mh.base()
        fv, mv = set(), set()
        for fi, k in lay["part"].items():
            (fv if k == "face" else mv if k == "mouth" else set()).update(F[fi][0])
        lv = sorted(fv & mv)
        self.rim_up, self.rim_lo = _rim_chains(P, F, lay["part"], lv)
        q = P[lv]
        self.lip_cx = 0.0
        self.lip_w = (q[:, 0].max() - q[:, 0].min()) / 2
        self.lip_line = _profile(q[:, 0], q[:, 1], np.mean, 11)
        self.lip_z = q[:, 2].max()
        ears = lay["ears"]
        self.earL = P[ears[P[ears, 0] > 0]].mean(0)
        self.earR = P[ears[P[ears, 0] < 0]].mean(0)


# ----------------------------------------------------------------------------------------------------------------
# the sculpted body and its coverage fields
# ----------------------------------------------------------------------------------------------------------------
def vertex_normals(P, faces):
    N = np.zeros_like(P)
    q = [f for f in faces if len(f) == 4]
    t = [f for f in faces if len(f) == 3]
    if q:
        q = np.array(q)
        n = np.cross(P[q[:, 2]] - P[q[:, 0]], P[q[:, 3]] - P[q[:, 1]])
        for k in range(4):
            np.add.at(N, q[:, k], n)
    if t:
        t = np.array(t)
        n = np.cross(P[t[:, 1]] - P[t[:, 0]], P[t[:, 2]] - P[t[:, 0]])
        for k in range(3):
            np.add.at(N, t[:, k], n)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)


def chain_param(P, pts):
    """Arc length (m) of each point's projection onto a joint polyline, plus the cumulative joint lengths."""
    best = np.full(len(P), np.inf)
    s = np.zeros(len(P))
    acc, cum = 0.0, [0.0]
    for a, b in zip(pts[:-1], pts[1:]):
        ab = b - a
        L2 = max(ab @ ab, 1e-12)
        t = np.clip((P - a) @ ab / L2, 0, 1)
        d = np.linalg.norm(P - (a + t[:, None] * ab), axis=1)
        m = d < best
        best[m] = d[m]
        s[m] = acc + t[m] * math.sqrt(L2)
        acc += math.sqrt(L2)
        cum.append(acc)
    return s, cum


class Body:
    def __init__(self, c):
        shape = mh.shape_of(c)       # fix round 4 (Kai): the face file's dense shape layer, after the modifiers
        P = mh.sculpt(c["macro"], c.get("details"), shape=shape)
        self.P = relax_hands(P - np.array([0, P[:, 1].min(), 0]))
        # the same head without the layer, in the same frame: the eye proxy's scale references (fit_proxy)
        self.P0 = self.P if not shape else relax_hands(mh.sculpt(c["macro"], c.get("details")) - np.array([0, P[:, 1].min(), 0]))
        if shape:
            print(f"  shape layer: {len(mh.shape_target(shape)[0])} vertices ({os.path.basename(shape['path'])}, weight {shape['weight']})", flush=True)
        _, _, self.F = mh.base()
        self.faces = [i for i, f in enumerate(self.F) if f[2] == "body"]
        wear = [w if isinstance(w, str) else w[0] for w in c.get("wear", [])]
        if "sandals" in wear:      # costume sandals: the bare sole stands on the sandal (the shoe hull is not stretched down)
            bv = np.unique(np.concatenate([np.asarray(self.F[i][0]) for i in self.faces]))
            dy = np.array([0, self.P[bv, 1].min() - 0.012, 0])
            self.P = self.P - dy
            self.P0 = self.P if not shape else self.P0 - dy
        self.W = dense_weights(len(self.P))
        self.vb = [BONE_NAMES[i] for i in self.W.argmax(1)]
        if c.get("alarSoften"):      # fix round 2 (Kai): the nose wings' crease against the cheek smoothed (a hard U line read as cut out)
            self.P = soften_alar(self.P, self.F, Landmarks(self.P).eye, float(c["alarSoften"]))
        self.L = Landmarks(self.P)
        self.J = rig_points(self.P)
        self.Jm = {k: np.array([v.x, v.z, -v.y]) for k, v in self.J.items()}
        self.H = self.L.H
        self.N = vertex_normals(self.P, [self.F[i][0] for i in self.faces])
        self.part = layout()["part"]
        fam = lambda names: self.W[:, [BI[n] for n in names]].sum(1)
        self.tw = fam(["hips", "spine", "chest", "neck", "head", "clavicle_L", "clavicle_R"])
        self.hw = self.W[:, BI["head"]]
        self.aw = {s: fam([f"upperarm_{s}", f"forearm_{s}", f"hand_{s}"]) for s in "LR"}
        self.lw = {s: fam([f"thigh_{s}", f"shin_{s}", f"foot_{s}", f"toe_{s}"]) for s in "LR"}
        self.arm = {s: chain_param(self.P, [self.Jm[k + s] for k in ("shoulder_", "elbow_", "wrist_", "handEnd_")]) for s in "LR"}
        self.legs = self.lw["L"] + self.lw["R"]
        self.arms = self.aw["L"] + self.aw["R"]
        bodyv = mh.group_vertices("body")
        self.bodyv = np.array(bodyv)
        self.ear = np.zeros(len(self.P))
        self.ear[layout()["ears"]] = 1.0


def soften_alar(P, F, eye, amount):
    """Laplacian smoothing of the skin around the nose wings (the alar-facial groove and the wing's rim), with a soft
    falloff: amount = iterations of a 0.45 step. The tip, the nostrils' openings and the philtrum stay as sculpted."""
    faces = [f[0] for f in F if f[2] == "body"]
    nb = {}
    for f in faces:
        for i in range(len(f)):
            a, b = f[i], f[(i + 1) % len(f)]
            nb.setdefault(a, set()).add(b)
            nb.setdefault(b, set()).add(a)
    rel = P - eye
    ax = np.abs(rel[:, 0])
    w = ss(0.006, 0.013, ax) * ss(0.036, 0.028, ax) * ss(-0.06, -0.052, rel[:, 1]) * ss(-0.018, -0.026, rel[:, 1]) * ss(-0.004, 0.006, rel[:, 2])
    idx = np.nonzero(w > 0.01)[0]
    P = P.copy()
    for _ in range(int(round(amount))):
        Q = P.copy()
        for i in idx:
            n_ = nb.get(int(i))
            if n_:
                Q[i] = P[i] + 0.45 * w[i] * (P[list(n_)].mean(0) - P[i])
        P = Q
    return P


NECK = {  # neckline: (height above the neck base at the back, front dip) in metres (1.75 m body)
    "coat": (0.035, 0.035), "uniform": (0.03, 0.025), "robe": (0.02, 0.05), "sweater": (0.022, 0.02), "jacket": (0.012, 0.06),
    "vest": (0.012, 0.06), "shirt": (0.012, 0.045), "dress": (0.0, 0.055)}
HEM = {"coat": -0.0, "jacket": 0.0, "uniform": 0.0, "sweater": 0.005, "shirt": 0.005, "vest": 0.04}
COLLAR_H = {"coat": 0.032, "uniform": 0.026, "robe": 0.012, "sweater": 0.014, "jacket": 0.012, "vest": 0.008, "shirt": 0.012, "dress": 0.006}


def hairline(rel, style, male, old, shape=None):
    """Height (above the eye centre) of the hairline at each vertex's azimuth (0 = front, 180 = back). shape: a face
    file's `hairline` (fix round 1): {"centre": m (the middle of the front hairline, + higher), "temple": m (how far the
    temples are set back up the head)}: the front becomes one rounded arch from the centre to recessed temples, then
    curves down to the sideburn (no straight front edge with square temple corners)."""
    th = np.degrees(np.abs(np.arctan2(rel[:, 0], rel[:, 2] + 0.085)))
    hf = 0.062 if male else 0.057
    if old and male:
        hf += 0.012
    temple = hf + (0.004 if male else -0.012)
    sb = -0.012 if male else 0.01
    if style in ("crop", "fade", "curls"):
        sb = -0.004
    if style == "waves":           # thick hair falling onto the brow
        hf -= 0.012
        temple -= 0.008
    if style == "pixie":
        hf -= 0.006
    if style in ("undercut", "fade"):
        sb = 0.004 if style == "undercut" else -0.002
    nape = {"crop": -0.062, "short": -0.075, "swept": -0.075, "bob": -0.085, "long": -0.09, "waves": -0.088, "curls": -0.07, "puffs": -0.072,
            "locs": -0.086, "undercut": -0.058, "fade": -0.055, "pixie": -0.078}.get(style, -0.08)
    ks = [0, 28, 48, 66, 78, 88, 100, 114, 132, 152, 180]
    hs = [hf, hf - 0.003, temple, 0.026, sb, 0.024, 0.036, 0.016, nape * 0.55, nape, nape]
    if shape and shape.get("arch"):
        # fix round 2: `arch`: the front hairline as [azimuth deg, height m] pairs from the centre to the temple (Kai: the
        # photo's measured hairline, a rounded dome with the hair coming down over the temples, no square corners)
        ar = sorted((float(a_), float(h_)) for a_, h_ in shape["arch"])
        ks = [a_ for a_, _ in ar] + [78, 88, 100, 114, 132, 152, 180]
        hs = [h_ for _, h_ in ar] + [sb, 0.024, 0.036, 0.016, nape * 0.55, nape, nape]
        return np.interp(th, ks, hs)
    if shape:
        cen, tem = float(shape.get("centre", 0.0)), float(shape.get("temple", 0.0))
        ks = [0, 12, 24, 36, 46, 56, 66, 78, 88, 100, 114, 132, 152, 180]
        hs = [hf + cen, hf + cen + 0.001, hf + cen + 0.0035, hf + 0.6 * tem, hf + tem, hf + 0.6 * tem - 0.012, 0.026, sb, 0.024, 0.036, 0.016,
              nape * 0.55, nape, nape]
        return np.interp(th, ks, hs)
    if style == "waves":            # a few tapered fringe clumps over the brow and two over the ears (no sawtooth)
        ths = np.degrees(np.arctan2(rel[:, 0], rel[:, 2] + 0.085))
        clumps = np.zeros(len(ths))
        for cth, w, dep in ((-46, 10, 0.011), (-21, 12, 0.016), (4, 11, 0.012), (27, 12, 0.017), (52, 10, 0.01),
                            (-96, 9, 0.006), (98, 9, 0.006)):
            d = ((ths - cth + 180) % 360) - 180
            clumps = np.maximum(clumps, dep * np.clip(1 - np.abs(d) / w, 0, 1) ** 1.6)
        return np.interp(th, ks, hs) - clumps - 0.004 * ss(75, 20, th) + 0.006 * ss(30, 0, th) * (rel[:, 0] > 0)
    if style == "pixie":            # side-swept: the fringe dips on one side only
        return np.interp(th, ks, hs) - 0.008 * np.clip(rel[:, 0] / 0.05, 0, 1) * (np.abs(rel[:, 0]) < 0.06)
    return np.interp(th, ks, hs)


def fields(c, B):
    """Coverage fields (per base vertex, metres, > 0 = covered) for every layer of this character."""
    P, Jm, H = B.P, B.Jm, B.H
    k = H / 1.75
    y = P[:, 1]
    top, bottom = c.get("top", "jacket"), c.get("bottom", "trousers")
    sh_y, hip_y, pel_y, spn_y, ank_y = Jm["shoulder_L"][1], Jm["hip_L"][1], Jm["pelvis"][1], Jm["spine"][1], Jm["ankle_L"][1]
    neck = Jm["neck"]
    nb_y = sh_y + 0.04 * k
    back, dip = NECK.get(top, (0.015, 0.05))
    th = np.arctan2(P[:, 0], P[:, 2] - neck[2])
    front = np.clip(np.cos(th), 0, 1) ** 2
    neck_y = nb_y + back * k - dip * k * front
    skirted = bottom in ("skirt", "longskirt") or top in ("dress", "robe")
    hem_top = (spn_y - 0.03 * k) if top in ("dress", "robe") else hip_y + HEM.get(top, -0.05) * k
    trouser_top = (pel_y + spn_y) / 2 + 0.012 * k
    cov = {"_neck_y": neck_y}
    # ---- top ----
    sleeve = c.get("sleeve", "long")
    f = B.tw * np.minimum(neck_y - y, y - hem_top) + B.legs * (y - hem_top)
    for s in "LR":
        sa, cum = B.arm[s]
        end = {"long": cum[2] - 0.012, "mid": cum[1] + 0.04, "short": cum[1] * 0.45}.get(sleeve, cum[2] - 0.012)
        f = f + B.aw[s] * (end - sa)
    cov["top"] = f
    # ---- footwear ----
    collar_y = ank_y + 0.035 * k
    boot_top = (0.045 + c.get("boots", 0.10)) * H
    shaft = boot_top > collar_y + 0.025
    cov["_collar_y"], cov["_boot_top"] = collar_y, boot_top
    cov["inshoe"] = B.legs * (collar_y - 0.02 - y) - (1 - B.legs) * 0.2
    if shaft:
        cov["shaft"] = B.legs * np.minimum(boot_top - y, y - (collar_y - 0.035)) - (1 - B.legs) * 0.2
    # ---- trousers (or shorts under a skirt) ----
    hem_b = (hip_y - 0.10 * k) if skirted else (boot_top - 0.04) if shaft else (collar_y - 0.03)
    cov["bottom"] = B.tw * (trouser_top - y) + B.legs * np.minimum(trouser_top - y, y - hem_b) - B.arms * 0.2
    # ---- head: hair, headscarf, hood ----
    rel = P - B.L.eye
    male = c["macro"].get("gender", 0.5) >= 0.5
    old = c["macro"].get("age", 0.5) > 0.8
    style = c.get("hair", "short")
    head = B.hw + B.W[:, BI["neck"]] * 0.5
    hat = c.get("hat")
    if hat == "hood":
        o = (rel[:, 0] / 0.074) ** 2 + ((rel[:, 1] + 0.022) / 0.098) ** 2 + (np.minimum(0, rel[:, 2] + 0.005) / 0.035) ** 2
        f = (np.sqrt(o) - 1) * 0.07
        f = np.where(y > sh_y - 0.03 * k, f, f - (sh_y - 0.03 * k - y) * 4)   # down to the shoulders
        cov["hood"] = np.minimum(f, 0.12)
        style = "none"
    if hat == "headscarf":
        th2 = np.degrees(np.abs(np.arctan2(rel[:, 0], rel[:, 2] + 0.085)))
        line = np.interp(th2, [0, 35, 62, 85, 110, 140, 180], [0.044, 0.04, 0.0, -0.045, -0.07, -0.085, -0.09])
        w = np.clip(B.hw + B.W[:, BI["neck"]], 0, 1)
        cov["scarf"] = w * (rel[:, 1] - line) - (1 - w) * 0.03
        style = "none" if style not in ("bun",) else "bun_hidden"
    hwt = np.clip((head - 0.2) / 0.3, 0, 1)      # smooth blend: no ragged edge where head / neck weights meet
    if style not in ("none", "bun_hidden"):
        cov["hair"] = hwt * (rel[:, 1] - hairline(rel, style, male, old, c.get("hairline"))) - (1 - hwt) * 0.05
    elif style == "bun_hidden" or hat in ("hood",):
        cov["_hairpaint"] = hwt * (rel[:, 1] - hairline(rel, c.get("hair", "short"), male, old, c.get("hairline"))) - (1 - hwt) * 0.05
    for key in ("hair", "_hairpaint"):     # never hair on the ears
        if key in cov:
            cov[key] = cov[key] - B.ear * 0.05
    cov["_style"] = style
    return cov


SHELL = {"crop": 0.0015, "short": 0.0065, "swept": 0.009, "bob": 0.008, "long": 0.007, "bun": 0.0075, "braid": 0.0075, "pony": 0.0075,
         "waves": 0.012, "curls": 0.008, "puffs": 0.004, "locs": 0.006, "undercut": 0.009, "fade": 0.0025, "pixie": 0.0075}


def hide_field(cov):
    """Where the skin is hidden by an outer layer (> 0)."""
    g = [cov[k] for k in ("top", "bottom", "shaft", "inshoe") if k in cov]
    if "hair" in cov and SHELL.get(cov["_style"], 0) > 0.003:
        g.append(cov["hair"] - 0.03)
    for k in ("scarf", "hood"):
        if k in cov:
            g.append(cov[k] - 0.03)
    return np.max(np.stack(g), 0)


# ----------------------------------------------------------------------------------------------------------------
# layers: copies of body faces with a smooth, snapped border
# ----------------------------------------------------------------------------------------------------------------
class Layer:
    def __init__(self, name, pos, base, faces, fuv, cov):
        self.name, self.pos, self.base, self.faces, self.fuv, self.cov = name, pos, base, faces, fuv, cov
        self.mask = np.zeros((len(pos), 3))
        self.W = None
        self.g = {}          # costume garment params (costume.py)

    def edges(self):
        e = {}
        for f in self.faces:
            k = len(f)
            for a in range(k):
                i, j = f[a], f[(a + 1) % k]
                key = (min(i, j), max(i, j))
                e[key] = e.get(key, 0) + 1
        return e

    def boundary_loops(self):
        nb = {}
        for (i, j), n in self.edges().items():
            if n == 1:
                nb.setdefault(i, []).append(j)
                nb.setdefault(j, []).append(i)
        loops, seen = [], set()
        for s in nb:
            if s in seen:
                continue
            loop, prev, cur = [s], None, s
            seen.add(s)
            while True:
                nxt = [x for x in nb[cur] if x != prev and x not in seen]
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
                loop.append(cur)
                seen.add(cur)
            if len(loop) > 5:
                loops.append(loop)
        return loops


def build_layer(B, name, cov, iso=0.0, faces=None, min_area=3e-9):
    F, FUV = B.F, layout()["FUV"]
    cand = B.faces if faces is None else faces
    sel = [fi for fi in cand if cov[list(F[fi][0])].max() > iso]
    if not sel:
        return None
    used = sorted({v for fi in sel for v in F[fi][0]})
    idx = {v: i for i, v in enumerate(used)}
    pos0 = B.P[used].copy()
    cv = cov[used].copy()
    nb = [set() for _ in used]
    loc = []
    for fi in sel:
        vs = [idx[v] for v in F[fi][0]]
        loc.append(vs)
        for a in vs:
            nb[a].update(vs)
    pos = pos0.copy()
    snapped = np.zeros(len(used), bool)
    for i in np.nonzero(cv <= iso)[0]:
        acc = [pos0[i] + (iso - cv[i]) / (cv[j] - cv[i]) * (pos0[j] - pos0[i]) for j in nb[i] if j != i and cv[j] > iso]
        if acc:
            pos[i] = np.mean(acc, 0)
            snapped[i] = True
    cvn = np.where(snapped, iso, cv)
    faces_l, fuv_l = [], []
    for fi, vs in zip(sel, loc):
        k = len(vs)
        uv0 = FUV[fi]
        uv = uv0.copy()
        for a in range(k):
            i = vs[a]
            if not snapped[i]:
                continue
            p0 = pos0[i]
            e1, e2 = pos0[vs[(a + 1) % k]] - p0, pos0[vs[(a - 1) % k]] - p0
            d = pos[i] - p0
            M = np.array([[e1 @ e1, e1 @ e2], [e1 @ e2, e2 @ e2]])
            try:
                al, be = np.linalg.solve(M, [d @ e1, d @ e2])
            except np.linalg.LinAlgError:
                continue
            uv[a] = uv0[a] + al * (uv0[(a + 1) % k] - uv0[a]) + be * (uv0[(a - 1) % k] - uv0[a])
        q = pos[vs]
        area = 0.5 * np.linalg.norm(np.cross(q[1] - q[0], q[2] - q[0])) + (0.5 * np.linalg.norm(np.cross(q[2] - q[0], q[3] - q[0])) if k == 4 else 0)
        if area < min_area:
            continue
        faces_l.append(vs)
        fuv_l.append(uv)
    L = Layer(name, pos, np.array(used), faces_l, fuv_l, cvn)
    L.W = B.W[L.base].copy()
    return L



def layer_normals(L, B):
    N = vertex_normals(L.pos, L.faces)
    N = N + (L.nb if getattr(L, "nb", None) is not None else B.N[L.base])
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)


def taubin(L, iters, lam=0.5, mu=-0.53, pin=None):
    """Smooth a layer without shrinking it; border vertices only slide along the border (straightens it)."""
    if not iters:
        return
    e = L.edges()
    ii, jj = [], []
    bnd = np.zeros(len(L.pos), bool)
    for (i, j), n in e.items():
        if n == 1:
            bnd[i] = bnd[j] = True
    for (i, j), n in e.items():
        both_b = bnd[i] and bnd[j] and n == 1
        for a, b in ((i, j), (j, i)):
            if bnd[a] and not both_b:
                continue          # border vertices only listen to border neighbours
            ii.append(a)
            jj.append(b)
    ii, jj = np.array(ii), np.array(jj)
    cnt = np.bincount(ii, minlength=len(L.pos)).astype(float)
    fix = cnt == 0
    if pin is not None:
        fix |= pin
    for _ in range(iters):
        for f in (lam, mu):
            acc = np.zeros_like(L.pos)
            np.add.at(acc, ii, L.pos[jj])
            avg = acc / np.maximum(cnt, 1)[:, None]
            d = avg - L.pos
            d[fix] = 0
            L.pos = L.pos + f * d


def offset_layer(L, B, amount):
    L.pos = L.pos + layer_normals(L, B) * np.asarray(amount, float).reshape(-1, 1)


def inflate(L, B, amount):
    """Loosen a garment: push torso vertices out toward a smooth elliptical shell (hides anatomy under coats)."""
    P = B.P
    tsel = np.isin(np.array(B.vb), ["hips", "spine", "chest"]) & np.isin(np.arange(len(P)), B.bodyv)
    tsel &= (B.aw["L"] + B.aw["R"]) < 0.05      # deltoid / armpit vertices labelled "chest" would widen the shell into a web
    T = P[tsel]
    y0, y1 = B.Jm["hip_L"][1] - 0.2, B.Jm["shoulder_L"][1] - 0.02
    torso = (B.tw[L.base] > 0.6) & (L.pos[:, 1] > y0) & (L.pos[:, 1] < y1)
    old = L.pos.copy()
    for i in np.nonzero(torso)[0]:
        p = L.pos[i]
        m = T[np.abs(T[:, 1] - p[1]) < 0.015]
        if len(m) < 8:
            continue
        cx, cz = (m[:, 0].max() + m[:, 0].min()) / 2, (m[:, 2].max() + m[:, 2].min()) / 2
        rx, rz = (m[:, 0].max() - m[:, 0].min()) / 2, (m[:, 2].max() - m[:, 2].min()) / 2
        dx, dz = p[0] - cx, p[2] - cz
        r = math.hypot(dx, dz)
        if r < 1e-5:
            continue
        ang = math.atan2(dz / max(rz, 1e-3), dx / max(rx, 1e-3))
        target = math.hypot(math.cos(ang) * rx, math.sin(ang) * rz) * 1.04 + 0.006
        # fade out over the top 8 cm under the shoulder line: the torso ellipse at that height reaches past the
        # sloping shoulder and squared it off into a pad
        am = amount * min(max((y1 - p[1]) / 0.08, 0.0), 1.0)
        nr = r + (max(r, target) - r) * am
        if r > target:
            nr = nr * (1 - 0.5 * am) + target * 0.5 * am
        L.pos[i, 0] = cx + dx / r * nr
        L.pos[i, 2] = cz + dz / r * nr
    # smooth the displacement over the surface: per-vertex targets follow the anatomy under the cloth, and the
    # painted lines (seams, LED piping, stripes) would zigzag with them
    d = L.pos - old
    ii, jj = [], []
    for (i, j) in L.edges():
        ii += [i, j]
        jj += [j, i]
    ii, jj = np.array(ii), np.array(jj)
    cnt = np.maximum(np.bincount(ii, minlength=len(d)), 1).astype(float)[:, None]
    for _ in range(10):
        acc = np.zeros_like(d)
        np.add.at(acc, ii, d[jj])
        d = 0.5 * d + 0.5 * acc / cnt
    L.pos = old + d


# ----------------------------------------------------------------------------------------------------------------
# Blender objects, masks and weights
# ----------------------------------------------------------------------------------------------------------------
def mesh_from(name, verts, faces, uvs=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [list(f) for f in faces])
    if uvs is not None:
        uvl = me.uv_layers.new(name="UVMap")
        uvl.data.foreach_set("uv", np.asarray(uvs, dtype=np.float32).ravel())
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def set_mask(o, m):
    # in [0, 1]: the shipped cast quantizes this attribute to 8 bits (gltf-transform skips one outside [-1, 1])
    m = np.clip(np.broadcast_to(np.asarray(m, float), (len(o.data.vertices), 3)), 0.0, 1.0)
    a = o.data.attributes.get("_mask") or o.data.attributes.new("_mask", "FLOAT_VECTOR", "POINT")
    a.data.foreach_set("vector", np.ascontiguousarray(m, dtype=np.float32).ravel())


def layer_object(L, B=None):
    uvs = [uv for f in L.fuv for uv in f]
    o = mesh_from(L.name, to_bl_np(L.pos), L.faces, uvs)
    set_mask(o, L.mask)
    keep = getattr(L, "tail_mask", None)
    if keep is not None:      # cloth tails keep their full density (decimation would cut chords into the legs under them)
        a = o.data.attributes.new("_keep", "FLOAT", "POINT")
        a.data.foreach_set("value", np.asarray(keep, dtype=np.float32))
    rim = getattr(L, "_rim", None)
    hem = np.zeros(len(L.pos), np.float32)
    if rim:                   # visible hems: the rim strip and the garment's border loop keep their shape in decimation
        hem[list(rim)] = 1.0
        hem[list(L._rim_src.values())] = 1.0
    if B is not None and L.name != "hair":
        # the armpit / crotch bands of a garment: a collapse across them joins sleeve and side (or the two legs)
        # into one long triangle, a web that hangs from the arm when it swings
        aw = (B.aw["L"] + B.aw["R"])[L.base]
        lw = B.legs[L.base]
        band = ((aw > 0.12) & (aw < 0.88)) | ((lw > 0.12) & (lw < 0.88) & (np.abs(L.pos[:, 0]) < 0.06))
        hem[band] = 1.0
    if hem.any():
        a = o.data.attributes.new("_hem", "FLOAT", "POINT")
        a.data.foreach_set("value", hem)
    if B is not None:         # hands (bare or gloved): the collapse turns fingers into claws, so they decimate last
        hw = np.clip((B.W[:, BI["hand_L"]] + B.W[:, BI["hand_R"]])[L.base] * 1.5, 0, 1).astype(np.float32)
        if hw.any():
            a = o.data.attributes.new("_hand", "FLOAT", "POINT")
            a.data.foreach_set("value", hw)
    WSTORE[o.name] = L.W
    return o


def obj_world_verts(o):
    bpy.context.view_layer.update()
    M = np.array(o.matrix_world)
    co = np.array([v.co for v in o.data.vertices])
    return co @ M[:3, :3].T + M[:3, 3]


def set_cell_uvs(o, cell, proj="xz", per_face=None):
    """UVs inside a material cell: a planar projection of the object (or per-face cells via per_face(poly)->name)."""
    me = o.data
    co = np.array([v.co for v in me.vertices])
    li = np.array([l.vertex_index for l in me.loops])
    lo, hi = co.min(0), co.max(0)
    span = np.maximum(hi - lo, 1e-6)
    if proj == "cyl":      # around the object's vertical axis (hats, bands): a = azimuth, b = height
        cen = (lo + hi) / 2
        a = (np.arctan2(co[li, 0] - cen[0], -(co[li, 1] - cen[1])) / (2 * math.pi)) % 1.0
        b = (co[li, 2] - lo[2]) / span[2]
    else:
        ax = {"x": 0, "y": 1, "z": 2}
        a_, b_ = ax[proj[0]], ax[proj[1]]
        a = (co[li, a_] - lo[a_]) / span[a_]
        b = (co[li, b_] - lo[b_]) / span[b_]
    if o.name.startswith(("pouch", "buckle", "panel")):     # small hard pieces: a clean flat patch of the cell (the whole
        a, b = 0.45 + 0.1 * a, 0.45 + 0.1 * b              # cell squeezed onto a pouch showed its texels as blocky squares)
    uv = cell_uv(cell, a, b)
    if per_face is not None:
        for p in me.polygons:
            nm = per_face(p)
            if nm != cell:
                for l in p.loop_indices:
                    uv[l] = cell_uv(nm, a[l:l + 1], b[l:l + 1])[0]
    uvl = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    uvl.data.foreach_set("uv", uv.astype(np.float32).ravel())


def piece(o, cell, mask=(0, 0, 0), proj="xz", W=None, bone=None):
    """Finish an extra piece: cell UVs, shading mask and skin weights (a bone name, or a per-vertex weight matrix)."""
    BC.apply_modifiers(o) if o.modifiers else None
    set_cell_uvs(o, cell, proj)
    set_mask(o, mask)
    if W is None:
        W = np.zeros((len(o.data.vertices), len(BONE_NAMES)))
        W[:, BI[bone or "head"]] = 1
    WSTORE[o.name] = W
    return o


def nearest_weights(pts_bl, ref_bl, ref_W, k=4):
    """Weights for points from the k nearest reference points (inverse-distance blended)."""
    kd = kdtree.KDTree(len(ref_bl))
    for i, p in enumerate(ref_bl):
        kd.insert(V(p), i)
    kd.balance()
    out = np.zeros((len(pts_bl), ref_W.shape[1]))
    for i, p in enumerate(pts_bl):
        hits = kd.find_n(V(p), k)
        w = np.array([1.0 / max(d, 1e-4) for _, _, d in hits])
        out[i] = (w[:, None] * ref_W[[j for _, j, _ in hits]]).sum(0) / w.sum()
    return out


CUR_B = [None]     # the body being built (look v2 splits head / hand weights onto the face and finger bones)


def apply_weights(o, arm):
    W = np.asarray(WSTORE.pop(o.name))
    names = BONE_NAMES
    if look2.ON and CUR_B[0] is not None:
        W = look2.expand_weights(o, W, CUR_B[0])
        names = look2.all_bones()
    o.vertex_groups.clear()
    for j, bn in enumerate(names):
        col = W[:, j]
        nz = np.nonzero(col > 0.004)[0]
        if not len(nz):
            continue
        vg = o.vertex_groups.new(name=bn)
        for i in nz:
            vg.add([int(i)], float(col[i]), "REPLACE")
    o.parent = arm
    m = o.modifiers.new("arm", "ARMATURE")
    m.object = arm


# ----------------------------------------------------------------------------------------------------------------
# painting
# ----------------------------------------------------------------------------------------------------------------
def rasterize(B, face_ids, res):
    """Per covered texel: pixel x/y, 3D position, face, barycentrics and the 3 base vertex ids."""
    FUV, P, F = layout()["FUV"], B.P, B.F
    out = [[] for _ in range(6)]
    for fi in face_ids:
        vs = F[fi][0]
        uvf = FUV[fi]
        for a, b, c in ([(0, 1, 2), (0, 2, 3)] if len(vs) == 4 else [(0, 1, 2)]):
            uv = np.array([uvf[a], uvf[b], uvf[c]]) * res
            uv[:, 1] = res - uv[:, 1]
            x0, y0 = np.floor(uv.min(axis=0)).astype(int)
            x1, y1 = np.ceil(uv.max(axis=0)).astype(int)
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, res - 1), min(y1, res - 1)
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            gx, gy = gx.ravel(), gy.ravel()
            (ax, ay), (bx, by), (cx, cy) = uv
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-12:
                continue
            l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / den
            l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / den
            l3 = 1 - l1 - l2
            ok = (l1 >= -0.03) & (l2 >= -0.03) & (l3 >= -0.03)
            if not ok.any():
                continue
            bc = np.stack([l1[ok], l2[ok], l3[ok]], 1)
            bc = np.clip(bc, 0, None)
            bc /= bc.sum(1, keepdims=True)
            tv = np.array([vs[a], vs[b], vs[c]])
            out[0].append(gx[ok].astype(int))
            out[1].append(gy[ok].astype(int))
            out[2].append(bc @ P[tv])
            out[3].append(np.full(ok.sum(), fi))
            out[4].append(bc)
            out[5].append(np.tile(tv, (ok.sum(), 1)))
    return [np.concatenate(x) for x in out]


def dilate(img, mask, n=6):
    """Bleed filled texels outward so mip-maps never pull in empty background at UV seams."""
    img, mask = img.copy(), mask.copy()
    for _ in range(n):
        acc = np.zeros_like(img)
        cnt = np.zeros(mask.shape)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            m2 = np.roll(np.roll(mask, dy, 0), dx, 1)
            acc += np.roll(np.roll(img, dy, 0), dx, 1) * m2[..., None]
            cnt += m2
        new = (~mask) & (cnt > 0)
        img[new] = acc[new] / cnt[new][:, None]
        mask = mask | new
    return img, mask


def shoe_hex(c):
    """One footwear colour for the painted boot shaft and the shoe (cell): no mismatch."""
    return c.get("shoeColor", c.get("trimColor", "2a1d16"))


def fabric(c, key, q, seed, L):
    fab = c.get("fabric", {}).get(key, "wool" if key in ("top", "colA") else "twill" if key in ("bottom", "colB") else "leather")
    if fab == "leather":
        k = 0.88 + 0.16 * vnoise(q, 260, seed) + 0.05 * vnoise(q, 1900, seed)
    elif fab == "twill":
        k = 0.9 + 0.05 * np.sin((q[:, 0] + q[:, 1]) * 2600) + 0.08 * vnoise(q, 180, seed)
    else:  # wool / knit
        k = 0.89 + 0.045 * np.sin(q[:, 1] * 3000) * np.sin(q[:, 0] * 3000 + q[:, 2] * 3000) + 0.09 * vnoise(q, 150, seed)
    return k


def hair_strands(c, rel, style, seed, fine=1.0):
    """0..1 strand value for points relative to the eye centre (lines follow the comb direction of the style)."""
    if style in ("curls", "puffs"):                          # tight coils: a dense cellular texture, no comb direction
        q = rel * (1 / 0.004)
        v = 0.55 + 0.25 * np.sin(q[:, 0] * 2.1 + np.sin(q[:, 1] * 1.7 + seed)) * np.sin(q[:, 1] * 2.3 + np.sin(q[:, 2] * 1.9)) \
            + 0.2 * (hash01(rel, 520 * fine, seed) - 0.5)
        return np.clip(v, 0, 1)
    if style in ("swept", "bun", "braid", "pony", "bun_hidden", "waves", "undercut", "pixie", "locs"):
        a = np.arctan2(rel[:, 0], rel[:, 1] + 0.03)          # combed back: lines run front to back
    else:
        a = np.arctan2(rel[:, 0], rel[:, 2] + 0.08)          # from the crown: lines run down from the top
    j = vnoise(rel * np.array([1.0, 1.0, 1.0]), 60, seed) * 2.5
    if style == "waves":
        j = j + 1.6 * np.sin(rel[:, 1] * 2 * math.pi / 0.03 + a * 6)
    v = (0.55 + 0.2 * np.sin(a * 70 + j) + 0.15 * np.sin(a * 190 * fine + j * 1.7 + 1.3) + 0.1 * np.sin(a * 470 * fine + j * 2.3 + 0.4))
    return np.clip(v, 0, 1)


def paint(c, B, cov, res, path_out):
    lay = layout()
    L = B.L
    px, py, pos, fid, bc, tv = rasterize(B, B.faces, res)
    fld = lambda arr: (arr[tv] * bc).sum(1)
    part = np.array([lay["part"][f] for f in fid])
    seed = (sum(map(ord, c["id"])) % 97) * 0.37
    male = c["macro"].get("gender", 0.5) >= 0.5
    rng = np.random.default_rng(sum(map(ord, c["id"])) * 7919)
    rel = pos - L.eye
    front = ss(-0.035, -0.015, rel[:, 2])            # front of the face (0 at the ears)
    # ---------------- skin ----------------
    skin = hexc(c["skin"])
    if look2.ON and os.environ.get("SKIN_CLASSIC") != "1" and not c.get("skinExact"):      # hero pipeline: a natural skin albedo (no orange cast)
        skin = look2.natural_skin(skin)
    LK = likeness_look.load(c, B)          # photo likeness data (None for every other face)
    col = np.tile(skin, (len(px), 1))
    lum = 1 + 0.035 * (vnoise(pos, 22, seed) - 0.5) + 0.02 * (vnoise(pos, 90, seed + 3) - 0.5) + 0.012 * (vnoise(pos, 700, seed + 5) - 0.5)
    red = 0.02 * (vnoise(pos, 40, seed + 9) - 0.5)
    col = col * lum[:, None] * (1 + np.outer(red, [1, -0.4, -0.6]))
    warm = np.array([1.0, 0.86, 0.82])
    isface = np.isin(part, ["face", "scalp", "lidL", "lidR", "mouth"])
    earf = fld(B.ear)

    def tint(m, rgb, k=1.0):
        nonlocal col
        m = np.clip(m * k, 0, 1)[:, None]
        col = col * (1 - m) + col * np.asarray(rgb)[None, :] * m

    def over(m, rgb):
        nonlocal col
        m = np.clip(m, 0, 1)[:, None]
        col = col * (1 - m) + np.asarray(rgb)[None, :] * m
    blush = c.get("blush", 0.22 if not male else 0.14)
    for e, sg in ((L.eyeL, 1), (L.eyeR, -1)):
        ch = e + np.array([0.014 * sg, -0.032, 0.0])
        tint(blush * g2(((pos - ch) ** 2 * np.array([1, 1.4, 0.3])).sum(1), 0.017) * front * isface, warm)
        # under-eye: slightly darker and cooler
        ue = e + np.array([0.002 * sg, -0.014, 0.004])
        tint(0.07 * g2(((pos - ue) ** 2 * np.array([0.6, 2.5, 1])).sum(1), 0.009) * front * isface, [0.88, 0.86, 0.9])
    nose = np.array([0, L.eye[1] - 0.045, L.eye[2] + 0.03])
    tint(0.3 * g2(((pos - nose) ** 2 * np.array([1, 0.8, 0.5])).sum(1), 0.011) * front * isface, warm)
    tint(0.2 * earf, warm)
    if LK is None:       # (photo likeness: his forehead is no lighter than his cheeks)
        tint(0.04 * ss(0.02, 0.06, rel[:, 1]) * front * isface, [1.03, 1.02, 1.0])      # forehead a touch lighter
    skin_h = skin_r = None
    if look2.ON:      # v2: region colour by age and sex, hands, pores and creases (height), roughness
        col, skin_h, skin_r = look2.paint_skin(c, B, pos, part, col, isface, seed)
    if LK is not None:       # photo likeness: the measured colour zones and the moles
        col = likeness_look.paint_zones(c, B, LK, pos, col, isface, front, sys.modules[__name__])
        col, nmol = likeness_look.paint_moles(c, LK, pos, col, isface, sys.modules[__name__])
    # ---- lips ----
    lip_c = hexc(c.get("lip", "b06a62" if not male else "a8706a"))
    xs, ys = L.lip_line
    t = (pos[:, 0] - L.lip_cx) / max(L.lip_w, 0.018)
    d = pos[:, 1] - np.interp(pos[:, 0], xs, ys)
    lipfront = ss(L.lip_z - 0.025, L.lip_z - 0.012, pos[:, 2]) * (np.abs(t) < 1.1) * isface
    sc = L.lip_w / 0.024
    hu0, hl0 = (0.0074 if male else 0.0082) * sc, (0.0092 if male else 0.0108) * sc
    if c.get("lipScale"):      # photo likeness: the painted lip heights (upper, lower) scaled to the photo's
        hu0, hl0 = hu0 * float(c["lipScale"][0]), hl0 * float(c["lipScale"][1])
    at = np.clip(np.abs(t), 0, 1)
    hu = hu0 * (1 - at ** 2.3) ** 0.55 * (1 - 0.16 * np.exp(-(t / 0.13) ** 2)) * (1 + 0.1 * np.exp(-((at - 0.3) / 0.15) ** 2))
    hl = hl0 * (1 - at ** 2.0) ** 0.7
    eb = float(c.get("lipEdge", 0.0))       # fix round 1: the vermilion border blurred over eb metres (a hard outline read as a painted sausage)
    mu = ss(hu + 0.0007 + eb * 0.5, hu - 0.0004 - eb * 0.5, d) * ss(-0.0012, 0.0, d)
    ml = ss(hl + 0.0008 + eb * 0.5, hl - 0.0005 - eb * 0.5, -d) * ss(-0.0012, 0.0, -d)
    lipm = np.clip(np.maximum(mu, ml) * lipfront * ss(1.05, 0.9, np.abs(t)), 0, 1)
    lipcol = skin * 0.3 + lip_c * 0.7
    over(lipm * 0.85, lipcol)
    tint(lipm * mu * (0.1 if LK is None else float(c.get("upperLipDark", 0.14))), [0.9, 0.88, 0.9])              # upper lip a touch darker (photo: mauve-grey)
    tint(lipm * ml * (0.1 if LK is None else 0.03) * g2(t ** 2 + ((-d - hl0 * 0.45) / 0.004) ** 2, 1.0), [1.12, 1.1, 1.1])   # lower lip highlight
    if LK is not None and c.get("lipLower"):      # fix round 2: the lower lip's centre rosier and a little darker (not a pale clay lozenge)
        lc_ = g2((t / 0.55) ** 2 + ((-d - hl0 * 0.5) / (hl0 * 0.6)) ** 2, 1.0) * ml
        over(lipm * lc_ * 0.7, hexc(c["lipLower"]))
        if c.get("lipEdgeDark"):      # fix round 3: the lower lip darker toward its edges (mauve-brown, not a pale glossy lens)
            tint(lipm * ml * float(c["lipEdgeDark"]) * (1 - g2((t / 0.7) ** 2 + ((-d - hl0 * 0.5) / (hl0 * 0.45)) ** 2, 1.0)), [0.85, 0.82, 0.84])
    if LK is not None and c.get("lipAsym"):       # fix round 2: a slight left / right asymmetry (one side a touch darker and fuller-toned)
        tint(lipm * float(c["lipAsym"]) * ss(-0.6, 0.8, t) * (0.6 + 0.4 * vnoise(pos, 160, seed + 4.4)), [0.9, 0.86, 0.88])
    if LK is not None and c.get("lipLines"):      # fix round 1: fine vertical lip lines (the vermilion's furrows), darker at the centre of each lip
        ll = vnoise(pos * np.array([1.0, 0.07, 1.0]), 2300, seed + 8.3)
        tint(lipm * float(c["lipLines"]) * np.clip((ll - 0.45) * 2.5, 0, 1) * (1 - 0.5 * ss(0.5, 1.0, np.abs(t))), [0.82, 0.78, 0.8])
    tint((0.4 if LK is None else float(c.get("lipParted", 0.4))) * g2(d ** 2, 0.0005 if LK is None else 0.00065) * lipfront * ss(1.15, 0.85, np.abs(t)), [0.55, 0.45, 0.45])   # contact line
    tint((0.05 if LK is None else float(c.get("lipRim", 0.05))) * g2((d - hu - 0.0012) ** 2, 0.0007) * lipfront * (np.abs(t) < 0.9), [1.08, 1.06, 1.04])   # vermilion edge (fix round 3: lipRim, Kai 0: no light outline)
    for sg in (1, -1):
        cn = np.array([sg * L.lip_w, np.interp(sg * L.lip_w, xs, ys), L.lip_z - 0.008])
        if look2.ON:      # scaled to the mouth (a child's corners read as dirt at the adult size) and softer
            tint(0.08 * g2(((pos - cn) ** 2).sum(1), 0.0035 * min(1.0, L.lip_w / 0.024)) * isface, [0.84, 0.76, 0.74])
        else:
            tint(0.18 * g2(((pos - cn) ** 2).sum(1), 0.0035) * isface, [0.75, 0.68, 0.66])   # mouth corners
    # ---- eyes: lash line, lid crease, inner corner ----
    brow_c = hexc(c.get("browColor", c.get("hairColor", "2e2119")))
    hair_c = hexc(c.get("hairColor", "2e2119"))
    if look2.ON:      # hero pipeline: near-black hexes lifted to a deep brown-black (look2.hair_floor), like the cards
        brow_c, hair_c = look2.hair_floor(brow_c, 0.12), look2.hair_floor(hair_c)
    lash_c = brow_c * 0.35 + np.array([0.02, 0.015, 0.012])
    for s, e, sg in (("L", L.eyeL, 1), ("R", L.eyeR, -1)):
        dx = (pos[:, 0] - e[0]) * sg
        dy = pos[:, 1] - e[1]
        near = (np.abs(dx) < 0.024) & (np.abs(dy) < 0.022) & (rel[:, 2] > -0.03) & isface
        (ux, uy), (lx, ly) = L.lid[s]
        ym = np.interp(dx, ux, uy)
        inside = (dx > ux.min() - 0.001) & (dx < ux.max() + 0.002)
        dd = dy - ym
        thick = 0.0006 + 0.0007 * ss(-0.006, 0.012, dx)
        lash = ss(-0.0006, 0.0, dd) * (1 - ss(thick * 0.5, thick + 0.0004, dd)) * inside * near
        lash *= ss(ux.min() - 0.001, ux.min() + 0.003, dx) * ss(ux.max() + 0.0012, ux.max() - 0.001, dx)
        wing = g2(((dx - ux.max() + 0.0005) / 0.0018) ** 2 + ((dd - 0.0004) / 0.001) ** 2, 1.0) * near
        over(np.clip(lash * 0.82 + wing * 0.05, 0, 1), lash_c)
        crease = g2((dd - 0.0058 - 0.0012 * ss(-0.01, 0.01, dx)) ** 2, 0.0013) * inside * near * ss(-0.016, -0.008, dx)
        tint(crease * 0.16, [0.82, 0.74, 0.72])
        tint(g2(((dd - 0.003) / 0.003) ** 2, 1.0) * inside * near * 0.05, [0.92, 0.88, 0.9])      # lid
        ylo = np.interp(dx, lx, ly)
        lo_line = g2(((dy - ylo + 0.0005) / 0.0008) ** 2, 1.0) * ((dx > lx.min()) & (dx < lx.max())) * near
        tint(lo_line * (0.22 if LK is None else float(c.get("lidLineLo", 0.22))), [0.7, 0.62, 0.6])      # (fix round 3, Kai 0.06: no dark ring round the sclera)
        inner = g2(((dx - ux.min() + 0.002) / 0.004) ** 2 + (dy / 0.004) ** 2, 1.0) * near
        tint(inner * (0.18 if LK is None else 0.07), [0.86, 0.72, 0.72])
        if c.get("caruncle"):      # fix round 2: the pink caruncle in the inner corner (the skin of the canthus, at the opening's height)
            ycar = 0.5 * (np.interp(ux.min() + 0.0012, ux, uy) + np.interp(ux.min() + 0.0012, lx, ly))
            car = g2(((dx - ux.min() - 0.0004) / 0.0019) ** 2 + ((dy - ycar) / 0.0014) ** 2, 1.0) * near
            over(car * float(c["caruncle"]), np.array([0.70, 0.42, 0.40]))
    # ---- eyebrows: hair strokes placed from the eye centres ----
    bt = c.get("browThick", 0.5)
    nstr = 260 if res >= 2048 else 200
    for e, sg in ((L.eyeL, 1), (L.eyeR, -1)):
        dx = (pos[:, 0] - e[0]) * sg
        dy = pos[:, 1] - e[1]
        near = (dx > -0.024) & (dx < 0.034) & (dy > 0.004) & (dy < 0.036) & (rel[:, 2] > -0.03) & isface
        idx = np.nonzero(near)[0]
        if not len(idx):
            continue
        X, Y = dx[idx], dy[idx]
        lift = c.get("browLift", 0.0)
        T = lambda t: (-0.0185 + 0.047 * t, np.interp(t, [0, 0.35, 0.68, 1.0], [0.0150, 0.0178, 0.0192, 0.0162] if look2.ON else [0.0150, 0.0182, 0.0198, 0.0150]) + lift,
                       np.interp(t, [0, 0.15, 0.6, 1.0], [0.0072, 0.0068, 0.0048, 0.0018]) * (1.0 if male else 0.78) * (0.8 + 0.4 * bt))
        if LK is not None:       # photo likeness: the measured brow (its own medial / lateral ends, top and bottom edge)
            T = likeness_look.brow_T(LK, e, sg, lift, c.get("browShape"))
            nstr = 620 if res >= 2048 else 440
        tk = rng.random(nstr) ** 0.85
        bx, by, bw = T(tk)
        n = rng.uniform(0.0, 1.0, nstr)
        rx, ry = bx, by + n * bw
        ang = np.radians(np.interp(tk, [0, 0.12, 0.35, 1.0], [78, 52, 16, -14] if LK is None else [70, 44, 12, -9]) + rng.normal(0, 7, nstr) - 10 * (n - 0.5))
        ln = np.interp(tk, [0, 0.4, 1.0], [0.0042, 0.0056, 0.0040]) * rng.uniform(0.8, 1.15, nstr)
        ex, ey = rx + np.cos(ang) * ln, ry + np.sin(ang) * ln
        wd = (0.00042 if res >= 2048 else 0.0005) * rng.uniform(0.8, 1.2, nstr)
        sx, sy = ex - rx, ey - ry
        L2 = sx * sx + sy * sy
        tt = np.clip(((X[:, None] - rx[None]) * sx[None] + (Y[:, None] - ry[None]) * sy[None]) / L2[None], 0, 1)
        dd = np.hypot(X[:, None] - (rx[None] + tt * sx[None]), Y[:, None] - (ry[None] + tt * sy[None]))
        cvg = np.clip(1 - dd / (wd[None] * (1.15 - 0.55 * tt)), 0, 1)
        if LK is not None and c.get("browTailFade"):      # fix round 3: the painted strokes fade toward the tail too
            cvg = cvg * (1 - float(c["browTailFade"]) * ss(0.55, 1.0, tk))[None, :]
        alpha = 1 - np.prod(1 - (0.38 if look2.ON else 0.7) * cvg, axis=1)     # v2: brow hair cards lie on top (proto:makehuman 0.55 -> 0.38)
        # soft base tint under the strokes
        bx0, bx1 = float(T(0.0)[0]), float(T(1.0)[0])
        cbx, cby, cbw = T(np.clip((X - bx0) / (bx1 - bx0), 0, 1))
        top_m = (0.0012, 0.0004) if LK is None else (0.0006, 0.0)       # photo likeness: registered to the card band (no band above it)
        inb = ss(-0.0006, 0.001, Y - cby) * ss(cbw + top_m[0], cbw - top_m[1] - 0.0004, Y - cby) * ss(bx0 - 0.002, bx0 + 0.002, X) * ss(bx1 + 0.002, bx1 - 0.001, X)
        if LK is not None:       # fix round 1: the top edge feathered over ~1.6 mm along a broken line (a solid band read as a marker stroke)
            brk = 0.0007 * (vnoise(pos[idx] * np.array([1.0, 0.3, 1.0]), 900, seed + 6.1) - 0.5)
            be = float(c.get("browEdge", 0.0))      # fix round 2: both edges softened over ~1.5 mm (no ragged marker outline)
            inb = (ss(-0.0006 - be * 0.5, 0.001 + be * 0.3, Y - cby) * ss(cbw + 0.0001 + be * 0.3 + brk, cbw - 0.0017 + brk, Y - cby)
                   * ss(bx0 - 0.0005, bx0 + 0.004, X) * ss(bx1 + 0.002, bx1 - 0.003, X))
        if LK is not None and c.get("browTailFade"):
            inb = inb * (1 - float(c["browTailFade"]) * ss(bx0 + 0.55 * (bx1 - bx0), bx1, X))
        alpha = np.clip(np.maximum(alpha, 0.0) + ((0.17 if LK is None else float(c.get("browBase", 0.4))) if look2.ON else 0.34) * inb * (1 - alpha), 0, 0.9)      # proto:makehuman: 0.28 (a painted brow block under the hairs)
        m = np.zeros(len(px))
        m[idx] = alpha
        over(m, brow_c * (float(c.get("browPaintGain", 1.0)) if LK is not None else 1.0))     # fix round 2: browPaintGain (Kai: the painted base as dark as the cards, no light patches)
    # ---- stubble ----
    stub = c.get("stubble", 0.0)
    if LK is not None and c.get("beard", 0.0) >= 0.5:
        # photo likeness: the measured beard (density map): a dark painted under-layer below the beard cards, a stubble
        # shadow where it thins out (look2 grows the cards from the same map)
        ab, brgb, _bd = likeness_look.beard_paint(c, B, LK, pos, fld(B.hw), lipm, isface, seed, sys.modules[__name__], lipgeo=(d, hu, t, lipfront),
                                                  nrm=np.stack([fld(B.N[:, i]) for i in range(3)], 1),
                                                  side=LK.side_at(tv, bc) if getattr(LK, "v3", False) else None)      # (Kai v3: the side photos' beard)
        col = col * (1 - ab[:, None]) + brgb * ab[:, None]
        if c.get("moHang"):      # (the moustache hanging over the upper lip is hair: no lip gloss or lip tint under it)
            lipm = lipm * (1 - ss(0.5, 0.9, _bd) * (lipm > 0))
        stub = 0.0
    if stub:
        ax_ = np.abs(pos[:, 0])
        my = np.interp(0, xs, ys)
        top_b = np.interp(ax_, [0, 0.012, 0.03, 0.048, 0.062, 0.08], [my + 0.017, my + 0.013, my + 0.012, my + 0.026, L.eye[1] - 0.034, L.eye[1] - 0.012])
        # feathered over ~1.5 cm along its upper edge, faded out before the sideburn / ear and under the jaw
        reg = (ss(-0.004, 0.014, top_b - pos[:, 1]) * ss(-0.1, -0.055, rel[:, 2]) * ss(my - 0.135, my - 0.095, pos[:, 1]) * isface * (earf < 0.5)
               * ss(0.088, 0.064, ax_))
        reg *= 1 - lipm
        reg *= 1 - 0.85 * g2(t ** 2 + ((d + 0.0) / 0.012) ** 2, 1.0) * (np.abs(t) < 1.2)
        dots = (hash01(pos, 2600, seed) > 0.55).astype(float) * 0.7 + 0.3
        # proto:makehuman: a soft even shadow with a faint grain (0.3 + 0.4 dots: 0.4 mm specks alias to sand in the atlas)
        grain = vnoise(pos, 1400, seed + 0.7)
        a = np.clip(stub * reg * (0.46 + 0.1 * dots + 0.12 * (grain - 0.5)), 0, 0.62)
        tint(a * 0.5, [0.86, 0.86, 0.9])
        over(a * 0.4, hair_c * 0.8)
        # ---- beard (0..1, needs stubble): dense short hair over the same region, strands running down the jaw ----
        brd = c.get("beard", 0.0)
        if brd:
            bc_ = hexc(c.get("beardColor", c.get("hairColor", "2e2119")))
            edge = ss(-0.003, 0.012, top_b - pos[:, 1]) * ss(my - 0.12, my - 0.085, pos[:, 1])
            strands = vnoise(pos * np.array([3.0, 0.6, 3.0]), 900, seed + 2.3)
            fine = hash01(pos, 3800, seed + 1.1)
            if look2.ON and brd < 0.5:
                # proto:makehuman: a short groomed beard painted only (no cards under 0.5): a crisp cheek line, dense short
                # hairs that run down the jaw (fine strokes, not a grey shadow), thinner toward the cheek line and neck
                # (moustache included: the stubble's lip ring exclusion is not applied; a 1.5 mm clear margin to the lips)
                regb = (ss(0.0, 0.006, top_b - pos[:, 1]) * ss(-0.1, -0.055, rel[:, 2]) * ss(my - 0.128, my - 0.1, pos[:, 1]) * isface
                        * (earf < 0.5) * ss(0.088, 0.066, ax_) * (1 - ss(0.2, 0.6, lipm)))
                regb *= 1 - 0.5 * g2(t ** 2 + ((d + 0.0) / 0.006) ** 2, 1.0) * (np.abs(t) < 1.05)
                # proto:makehuman: a groomed short beard has a density gradient (full on the chin, the jaw and the
                # moustache, thinning up the cheeks), a soft cheek line broken by the hair (not a straight painted edge),
                # a faded neckline, and a visible fine-hair texture (flat tone read as a painted mask)
                edge_n = 0.004 * (vnoise(pos, 260, seed + 4.1) - 0.5)
                regb = (ss(-0.004, 0.012, top_b + edge_n - pos[:, 1]) * ss(-0.1, -0.055, rel[:, 2]) * ss(my - 0.13, my - 0.092, pos[:, 1]) * isface
                        * (earf < 0.5) * ss(0.09, 0.064, ax_) * (1 - ss(0.2, 0.6, lipm)))
                regb *= 1 - 0.5 * g2(t ** 2 + ((d + 0.0) / 0.006) ** 2, 1.0) * (np.abs(t) < 1.05)
                chinjaw = np.clip(ss(my - 0.012, my - 0.05, pos[:, 1]) + g2(((pos[:, 0] - 0.0) / 0.03) ** 2 + ((pos[:, 1] - my - 0.012) / 0.01) ** 2, 1.0), 0, 1)
                dens = np.clip(brd * 2.0, 0, 1) * regb * (0.62 + 0.38 * chinjaw)
                hairs = np.clip((vnoise(pos * np.array([3.0, 0.7, 3.0]), 1700, seed + 2.9) - 0.35) * 2.2, 0, 1)
                ab = np.clip(dens * (0.5 + 0.28 * hairs + 0.1 * (fine - 0.5)), 0, 0.8)
                bc_ = bc_ * 0.62
            else:
                ab = np.clip(brd * reg * edge * (0.62 + 0.3 * strands + 0.12 * (fine - 0.5)), 0, 0.93)
            over(ab, bc_ * 0.95)
            if not (look2.ON and brd < 0.5):
                tint(ab * np.abs(strands - 0.5) * 0.8, [0.8, 0.8, 0.8])
    # ---- freckles (0..1): small warm dots over the nose bridge and cheeks ----
    frk = c.get("freckles", 0.0)
    if frk:
        zone = g2(((rel - np.array([0, -0.032, 0.02])) ** 2 * np.array([0.45, 1.6, 0.3])).sum(1), 0.026) * front * isface
        fd = (hash01(pos, 520, seed + 7) > 0.8).astype(float) * (0.5 + 0.5 * hash01(pos, 260, seed + 3))
        tint(frk * zone * fd * 0.5, [0.78, 0.64, 0.56])
    # ---- scars: [((x0, y0), (x1, y1)), ...] in metres from the mid-eye point (x to the character's left, y up) ----
    for (x0, y0), (x1, y1) in c.get("scars", []):
        sx_, sy_ = x1 - x0, y1 - y0
        L2 = sx_ * sx_ + sy_ * sy_
        tt_ = np.clip(((rel[:, 0] - x0) * sx_ + (rel[:, 1] - y0) * sy_) / L2, 0, 1)
        dd_ = np.hypot(rel[:, 0] - (x0 + tt_ * sx_), rel[:, 1] - (y0 + tt_ * sy_))
        taper = np.sin(np.pi * np.clip(tt_, 0.02, 0.98)) ** 0.5
        onf = ss(-0.04, -0.02, rel[:, 2]) * isface
        tint(0.45 * g2((dd_ / (0.0034 * taper + 1e-4)) ** 2, 1.0) * onf, [0.86, 0.66, 0.62])      # healed rim, a touch darker
        tint(0.55 * g2((dd_ / (0.0013 * taper + 1e-4)) ** 2, 1.0) * onf, [1.18, 1.0, 0.98])       # pale scar line
    # ---- scalp, hairline feathering ----
    style = cov["_style"]
    hcov = fld(cov["hair"]) if "hair" in cov else (fld(cov["_hairpaint"]) if "_hairpaint" in cov else None)
    ears = earf > 0.4
    if hcov is not None:
        st = hair_strands(c, rel, style, seed, fine=1.6)
        st2 = hair_strands(c, rel, style, seed + 1.7, fine=3.0)
        band = (hcov < 0) & (hcov > -0.008) & ~ears
        u = ss(-0.008, 0.0, hcov)
        # a soft density gradient outside the hairline (no discrete strokes: they read as a row of stitches), with a
        # faint, low-contrast strand modulation
        fa = (0.4 * u ** 1.7) * (0.85 + 0.15 * st2) * band
        ed_ = float(look2.CUTS.get(c.get("hairCut") or "", {}).get("edgeDark", 0.0)) if look2.ON else 0.0
        if ed_ > 0:     # fix round 2: the skin right at the shell's border darkened (it caught the light as a pale strip)
            fa = np.maximum(fa, ed_ * ss(-0.0035, -0.0005, hcov) * band)
        over(fa, hair_c * 0.8 + skin * 0.2)
        if look2.ON and look2.CUTS.get(c.get("hairCut") or "", {}).get("hairlineJag"):
            # fix round 3: the hairline as hair, not a band: the edge broken by a 2-4 mm noise (no straight edge, no
            # square temples), fine dark hair strokes along the growth direction rooted on it (dark roots, no greyed
            # skin-and-hair mix that caught the light as a pale comb)
            jg = float(look2.CUTS[c["hairCut"]]["hairlineJag"])
            jag = jg * (vnoise(rel, 210, seed + 5.5) - 0.5) + 0.4 * jg * (vnoise(rel, 700, seed + 6.6) - 0.5)
            hc2 = hcov + jag
            strokes = np.clip((vnoise(rel * np.array([1.0, 0.2, 1.0]), 1500, seed + 7.7) - 0.35) * 2.4, 0, 1)
            ea = ss(-0.0045, 0.0005, hc2) * (0.45 + 0.55 * strokes) * ((hcov < 0.002) & ~ears)
            over(np.clip(ea, 0, 0.92), hair_c * 0.95)
        under = (hcov >= 0) & ~ears
        # the density is already full a couple of mm inside the hairline: the hair shell's border sits on the hairline
        # and samples these texels, so a fade inside it painted the shell's edge skin-pale (a light outline under the
        # bangs); the soft gradient lives outside the hairline (`fa` above)
        fade_in = ss(-0.006, 0.002, hcov) * (0.88 + 0.12 * st2)
        if look2.ON and look2.hero_cut(c):
            # proto:makehuman hero cuts: the volume rises from the hairline, so its shell is hair-dark right from the edge
            # (the cards and the painted gradient outside the hairline carry the soft transition)
            fade_in = ss(-0.005, 0.0015, hcov) * (0.9 + 0.1 * st2)
        elif look2.ON and look2.CUTS.get(c.get("hairCut") or "", {}).get("comb") in ("part", "gather", "back"):
            # hair combed away from the face thins toward the hairline over ~1 cm (no hard band across the forehead)
            fade_in = ss(-0.004, 0.011, hcov) ** 1.3 * (0.8 + 0.2 * st2)
        st3 = hair_strands(c, rel, style, seed + 4.1, fine=2.2)
        k = 0.6 + 0.32 * st ** 1.2 + 0.16 * st3 - 0.06
        if hair_c.mean() > 0.42:     # grey / blond: the regular strand stripes read as a knitted (woolly hat) rib
            k = 0.8 + 0.1 * st ** 1.2 + 0.08 * st3 + 0.08 * (vnoise(rel * np.array([1.0, 3.0, 1.0]), 140, seed + 6.2) - 0.5) - 0.04
        roots = 1 - 0.1 * ss(0.012, 0.0, hcov)
        hcol = hair_c[None, :] * (k * roots)[:, None] * (0.78 if look2.ON else 1.0)   # v2: the volume under the cards reads as depth
        sheen = 1 + 0.12 * g2((rel[:, 1] - 0.085) ** 2, 0.018) * (style not in ("crop",))
        hcol = hcol * sheen[:, None]
        if look2.ON and look2.hero_cut(c):      # proto:makehuman: the shell under hero cards is the deep, matte under-layer
            hcol = hcol * 0.72
            cut_ = look2.CUTS.get(c.get("hairCut") or "", {})
            if cut_.get("shellStripe") is not None:     # fix round 2 (curly cuts): weaker strand stripes on the shell (a grey striped cap)
                km = float(np.mean(k))
                hcol = hcol / np.maximum(k, 1e-3)[:, None] * (km + (k - km) * float(cut_["shellStripe"]))[:, None]
            hcol = hcol * float(cut_.get("shellDark", 1.0))
        scalp = look2.CUTS.get(c.get("hairCut") or "", {}).get("scalp") if look2.ON else None
        if scalp in ("short", "fade"):      # hero pipeline: short cuts read as dense hair (the cards on top carry the
            # texture); a faint stipple of scalp between the hairs; a fade runs down the sides to stubble on the skin
            fine_d = hash01(rel, 2400, seed + 8.1)
            dense = 0.9 + 0.1 * fine_d
            hcol = hcol * 0.8 * dense[:, None] + col * 0.06       # the volume under the cards: in their shade
            if scalp == "fade":
                fy = ss(0.022, 0.058, rel[:, 1]) + ss(-0.02, 0.03, rel[:, 2]) * ss(0.0, 0.03, rel[:, 1]) * 0.6
                fy = np.clip(fy, 0, 1)[:, None]
                stub = (fine_d > 0.45).astype(float)[:, None] * 0.5 + 0.35
                shaved = col * (1 - 0.62 * stub) + hair_c[None, :] * 0.62 * stub * 0.85     # a clipper-short stubble
                hcol = hcol * fy + shaved * (1 - fy)
        elif style in ("crop", "fade"):       # very short hair: mostly the scalp showing through
            hcol = hcol * 0.75 + col * 0.25 * (0.6 + 0.4 * st[:, None])
        if style in ("bun", "braid", "pony") and not (look2.ON and look2.CUTS.get(c.get("hairCut") or "", {}).get("nopart")):   # tied-back hair: a centre part from the hairline toward the crown
            pl = g2(rel[:, 0] ** 2, 0.0018 ** 2) * ss(-0.02, 0.03, rel[:, 2] + 0.06) * ss(0.04, 0.07, rel[:, 1])
            hcol = hcol * (1 - 0.55 * pl[:, None]) + col * 0.55 * pl[:, None]
        if style in ("undercut", "fade") and scalp not in ("short", "fade"):   # shaved sides: the scalp shows through, fading toward the top
            sh_ = ss(0.075, 0.04, rel[:, 1])[:, None] * (0.55 if style == "undercut" else 0.45)
            hcol = hcol * (1 - sh_) + col * sh_
        fa_ = np.clip(fade_in, 0, 1)[:, None]
        col[under] = (hcol * fa_ + col * (1 - fa_))[under]
    if look2.ON:
        col = look2.inner_mouth(c, B, pos, part, col)
    # ---------------- garments (outermost layer wins) ----------------
    costume_mode = "_costume" in cov
    taken = np.zeros(len(px), bool)
    if costume_mode:
        cov["_texel_xy"] = (px, py, res)
        hgt, glw = costume.paint_body(c, B, cov, pos, fld, part, col, taken, seed)
    shirt_c = hexc(c.get("shirtColor", "d8d0c4"))
    order = [] if costume_mode else [("hood", c.get("colorA")), ("scarf", c.get("accentColor")), ("top", c.get("colorA", "444a55")),
             ("shaft", shoe_hex(c)), ("inshoe", shoe_hex(c)), ("bottom", c.get("colorB", "2a2a30"))]
    for key, chex in order:
        if key not in cov:
            continue
        f = fld(cov[key])
        m = (f > -0.003) & ~taken
        if key == "inshoe":
            m &= f > 0.0
        if not m.any():
            continue
        taken |= m
        q = pos[m]
        cc = hexc(chex or "444a55")
        fk = {"hood": "top", "scarf": "colA", "top": "top", "shaft": "shoe", "inshoe": "shoe", "bottom": "bottom"}[key]
        k = fabric(c, fk, q, seed, L)
        k = k * (1 - 0.1 * ss(0.012, 0.0, f[m]))                # hem / edge shadow
        if key in ("top", "bottom", "hood"):
            k = k * (0.94 + 0.06 * np.clip((q[:, 1] - L.ground) / (0.5 * L.H), 0, 1))
        cm = cc[None, :] * k[:, None]
        if key == "top" and c.get("top") == "vest":
            arm = fld(B.arms)[m]
            vneck = (q[:, 2] > B.Jm["chest"][2] - 0.02) & (q[:, 1] > B.Jm["chest"][1] - 0.02) & (np.abs(q[:, 0]) < 0.06 * (q[:, 1] - B.Jm["chest"][1] + 0.08) / 0.2)
            sm = np.clip(ss(0.4, 0.6, arm) + vneck, 0, 1)
            cm = cm * (1 - sm[:, None]) + (shirt_c[None, :] * (0.93 + 0.07 * vnoise(q, 200, seed))[:, None]) * sm[:, None]
        col[m] = cm
    img = np.zeros((res, res, 3))
    mask = np.zeros((res, res), bool)
    img[py, px] = np.clip(col, 0, 1)
    mask[py, px] = True
    paint_cells(c, img, mask, res, seed, cov)
    out = dict(base=path_out, normal=None, emissive=None)
    from PIL import Image
    if costume_mode:
        himg = np.zeros((res, res))
        gimg = np.zeros((res, res, 3))
        spx = np.full((res, res), 0.004)
        if skin_h is not None:
            hgt = hgt + np.where(taken, 0.0, skin_h)
        himg[py, px] = hgt
        gimg[py, px] = glw
        spx[py, px] = texel_size(B, res)[fid]
        costume.paint_aux(c, B, img, mask, himg, gimg, spx, res, seed)
        lvl = costume.glow_cell_level(c)
        if lvl > 0:
            u0, v0, cs = cell_rect("glow")
            x0, x1 = int(round(u0 * res)), int(round((u0 + cs) * res))
            y0, y1 = int(round((1 - v0 - cs) * res)), int(round((1 - v0) * res))
            gimg[y0:y1, x0:x1] = hexc(c["glow"]) * lvl
        # normal map from the painted height (tangent space: +x along u, +y along v up), heights in metres
        hm = mask.copy()
        h3, _ = dilate(np.repeat(himg[..., None], 1, 2), hm, 4)
        hh = h3[..., 0]
        gy_, gx_ = np.gradient(hh)
        k = 1.6 / np.maximum(spx, 1e-5)
        nx, ny = -gx_ * k, gy_ * k
        nl = np.sqrt(nx * nx + ny * ny + 1)
        nimg = np.stack([nx / nl, ny / nl, 1 / nl], -1) * 0.5 + 0.5
        nimg, nm = dilate(nimg, mask.copy(), 8)
        nimg[~nm] = (0.5, 0.5, 1.0)
        out["normal"] = path_out.replace(".jpg", "_n.jpg")
        nd = int(c.get("normalDiv", 1))       # crowds: a half-resolution normal map (file size; detail reads at crowd distance)
        if nd > 1:
            nimg = nimg.reshape(res // nd, nd, res // nd, nd, 3).mean((1, 3))
            nimg = (nimg - 0.5) / np.maximum(np.linalg.norm(nimg - 0.5, axis=-1, keepdims=True) * 2, 1e-6) * 0.5 + 0.5
        Image.fromarray((np.clip(nimg, 0, 1) * 255).astype(np.uint8)).save(out["normal"], quality=c.get("normalQ", 90))
        if skin_r is not None:     # v2: roughness (G) and cavity occlusion (R), half resolution
            rimg = np.full((res, res), 0.82)
            rr = np.where(taken, 0.82, look2.lip_rough(skin_r, lipm, c.get("lipGloss", 1.0)))
            if hcov is not None:
                rr = np.where(~taken & (hcov >= 0), 0.5, rr)
            rimg[py, px] = rr
            out["rough"] = look2.rough_ao_map(hh, mask, spx, rimg, res, path_out.replace(".jpg", "_r.jpg"))
        if gimg.max() > 0.01:
            lit0 = gimg.max(-1) > 0.004
            gimg, gm = dilate(gimg, lit0, 3)
            gimg[mask & ~lit0] = 0.0      # bleed into empty padding only: a glow swatch lit the gadget swatch next to it
            half = gimg.reshape(res // 2, 2, res // 2, 2, 3).mean((1, 3))
            out["emissive"] = path_out.replace(".jpg", "_e.jpg")
            Image.fromarray((np.clip(half, 0, 1) * 255).astype(np.uint8)).save(out["emissive"], quality=92)
    img, mask = dilate(img, mask, 10 if res >= 2048 else 8)
    img[~mask] = img[mask].mean(axis=0)
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(path_out, quality=c.get("jpegQ", 88 if res >= 2048 else 87))
    return out


def texel_size(B, res):
    """Metres per atlas pixel of every body face (for the normal map's slope scale)."""
    FUV, P, F = layout()["FUV"], B.P, B.F
    out = np.full(len(F), 0.004)
    for fi in B.faces:
        vs = F[fi][0]
        uv = FUV[fi] * res
        q = P[list(vs)]
        a3 = 0.5 * np.linalg.norm(np.cross(q[1] - q[0], q[2] - q[0]))
        cr = lambda a, b: a[0] * b[1] - a[1] * b[0]
        au = 0.5 * abs(cr(uv[1] - uv[0], uv[2] - uv[0]))
        if len(vs) == 4:
            a3 += 0.5 * np.linalg.norm(np.cross(q[2] - q[0], q[3] - q[0]))
            au += 0.5 * abs(cr(uv[2] - uv[0], uv[3] - uv[0]))
        if au > 1e-9:
            out[fi] = math.sqrt(a3 / au)
    return out


def paint_cells(c, img, mask, res, seed, cov=None):
    """Material cells: eye disc, hair, leather, sole, fabrics, metal, lashes, skin, glow, shirt (costumes: their own
    colours, and painted shoe / sole designs)."""
    def grid(name):
        u0, v0, s = cell_rect(name)
        x0, x1 = int(round(u0 * res)), int(round((u0 + s) * res))
        y0, y1 = int(round((1 - v0 - s) * res)), int(round((1 - v0) * res))
        gx, gy = np.meshgrid(np.arange(x0, x1), np.arange(y0, y1))
        a = (gx + 0.5 - u0 * res) / (s * res)
        b = 1 - (gy + 0.5 - (1 - v0 - s) * res) / (s * res)
        return gx, gy, a, b

    def put(gx, gy, rgb):
        img[gy, gx] = np.clip(rgb, 0, 1)
        mask[gy, gx] = True
    rng = np.random.default_rng(int(seed * 1000) + 11)
    # ---- eye ----
    gx, gy, a, b = grid("eye")
    dxe, dye = (a - 0.5) / 0.47, (b - 0.5) / 0.47
    r = np.hypot(dxe, dye)
    th = np.arctan2(dye, dxe)
    iris_c = hexc(c.get("eyes", "5a4030"))
    ir, pr = c.get("irisR", 0.33), c.get("pupilR", 0.12)
    sclera = np.array([0.75, 0.71, 0.67]) * (1 - 0.3 * ss(0.45, 1.0, r))[..., None]
    sclera = sclera * (1 - 0.06 * ss(0.5, 1.0, np.abs(dxe))[..., None] * np.array([0.2, 1, 1]))   # pinkish corners
    p3 = np.stack([np.cos(th) * 3, np.sin(th) * 3, r * 5], -1).reshape(-1, 3)
    fib = (0.5 + 0.28 * np.sin(th * 41 + 2.5 * vnoise(p3, 1.1, seed).reshape(r.shape)) + 0.22 * np.sin(th * 97 + 4 * vnoise(p3 * 1.7, 1.3, seed + 2).reshape(r.shape)))
    rr = (r - pr) / max(ir - pr, 1e-3)
    ring = 1.0 + 0.35 * g2((rr - 0.25) ** 2, 0.12) - 0.45 * ss(0.7, 1.0, rr)          # light collarette, dark rim
    irc = iris_c[None, None, :] * (0.55 + 0.75 * fib[..., None]) * ring[..., None]
    irc = irc * (1 - 0.35 * ss(0.15, -0.1, dye)[..., None] * 0) + 0.04
    col = np.where((r < ir)[..., None], irc, sclera)
    limb = g2((r - ir) ** 2, 0.022) * 0.55
    col = col * (1 - limb[..., None])
    col = np.where((r < pr)[..., None], np.array([0.02, 0.018, 0.016]), col)
    col = col * (1 - 0.25 * ss(0.3, 0.9, dye)[..., None] * (r < 1.0)[..., None])        # upper lid shadow
    if not look2.ON:      # v2: no painted catch-light (the scene's lights make the real one)
        cl = g2((dxe + 0.17) ** 2 + (dye - 0.17) ** 2, 0.045)
        col = col + np.clip(cl * 1.6, 0, 0.95)[..., None] * np.array([1.0, 1.0, 1.0])
    if look2.ON:      # hero pipeline: a detailed iris and a living sclera (look2.paint_eye)
        col = look2.paint_eye(c, dxe, dye, r, th, seed, vnoise, hash01, ss, g2)
    col = np.where((r > 1.0)[..., None], np.array([0.6, 0.55, 0.52]), col)
    put(gx, gy, col)
    # ---- flat-ish cells ----
    hair_c = hexc(c.get("hairColor", "2e2119"))
    if look2.ON:
        hair_c = look2.hair_floor(hair_c)
    shoe = hexc(shoe_hex(c))
    cells = {"hair": hair_c, "shoe": shoe, "sole": shoe * 0.35 + 0.02, "colA": hexc(c.get("colorA", "444a55")), "colB": hexc(c.get("colorB", "2a2a30")),
             "acc": hexc(c.get("accentColor", "8a3a2a")), "trim": hexc(c.get("trimColor", "2a1d16")), "metal": hexc(c.get("metalColor", "b09060")),
             "lash": hexc(c.get("browColor", c.get("hairColor", "2e2119"))) * 0.3 + 0.015,
             "skin": look2.natural_skin(hexc(c["skin"])) if look2.ON and os.environ.get("SKIN_CLASSIC") != "1" and not c.get("skinExact") else hexc(c["skin"]),
             "glow": hexc(c.get("glowColor", "ffb050")), "shirt": hexc(c.get("shirtColor", "d8d0c4"))}
    over = costume.cell_colors(c, cov) if cov is not None and "_costume" in cov else {}
    for name, v in over.items():
        if isinstance(v, str):
            cells[name] = hexc(v)
    for name, cc in cells.items():
        if look2.ON and name == look2.MOUTH_CELL:
            look2.paint_mouth_cell(c, img, mask, grid, put)
            continue
        gx, gy, a, b = grid(name)
        if isinstance(over.get(name), tuple):
            kind, feet = over[name]
            put(gx, gy, garments.shoe_cell(feet, a, b, seed) if kind == "design" else garments.sole_cell(feet, a, b, seed))
            continue
        p3 = np.stack([a, b, np.zeros_like(a)], -1).reshape(-1, 3)
        if name == "hair":
            cc = cc * (0.9 if look2.ON else 1.0)
            k = 0.8 + 0.12 * np.sin(a * 60 + 2 * vnoise(p3, 3, seed).reshape(a.shape)) + 0.08 * np.sin(a * 151 + 1.3)
            cut_ = look2.CUTS.get(c.get("hairCut") or "", {}) if look2.ON else {}
            if cut_.get("shellStripe") is not None:      # fix round 2 (curly cuts): the hanging pieces' cell as dark and unstriped as the shell
                k = 0.8 + (k - 0.8) * float(cut_["shellStripe"])
                cc = cc * float(cut_.get("shellDark", 1.0)) * 0.72
        elif name in ("shoe", "sole"):
            k = 0.9 + 0.12 * vnoise(p3, 9, seed).reshape(a.shape)
        elif name in ("colA", "colB", "acc"):    # skirts, coat tails, aprons: the same mean shade as the painted garments
            k = 0.84 + 0.07 * vnoise(p3, 6, seed).reshape(a.shape)
        else:
            k = 0.93 + 0.08 * vnoise(p3, 6, seed).reshape(a.shape)
        put(gx, gy, cc[None, None, :] * k[..., None])


# ----------------------------------------------------------------------------------------------------------------
# eyes, lashes
# ----------------------------------------------------------------------------------------------------------------
def sphere_fit(p):
    A = np.c_[2 * p, np.ones(len(p))]
    sol = np.linalg.lstsq(A, (p ** 2).sum(1), rcond=None)[0]
    cen = sol[:3]
    return cen, math.sqrt(max(sol[3] + cen @ cen, 1e-12))


def eye_objects(B, c):
    ev, ef = fit_proxy("eyes/high-poly/high-poly.mhclo", B.P * 10, getattr(B, "P0", B.P) * 10)
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
    out = []
    for side in (1, -1):
        cs = [vs for vs in comps.values() if np.sign(ev[vs, 0].mean()) == side]
        # the outer (cornea) shell reaches furthest forward: it carries the painted iris and the gloss
        vs = max(cs, key=lambda vs: ev[vs, 2].max())
        cen, rad = sphere_fit(ev[vs])
        keep = set(vs)
        faces = [f for f in ef if f[0] in keep]
        remap = {v: i for i, v in enumerate(vs)}
        P = ev[vs]
        d = (P - cen) / np.linalg.norm(P - cen, axis=1, keepdims=True)
        phi = np.arccos(np.clip(d[:, 2], -1, 1))
        al = np.arctan2(d[:, 1], d[:, 0])
        rr = np.clip(phi / (math.pi / 2), 0, 1.0)
        a = 0.5 + 0.47 * rr * np.cos(al)
        b = 0.5 + 0.47 * rr * np.sin(al)
        uvv = cell_uv("eye", a, b, inset=0.0)
        fl = [[remap[v] for v in f] for f in faces]
        uvs = [uvv[v] for f in fl for v in f]
        o = mesh_from("eye", to_bl_np(P), fl, uvs)
        dec = o.modifiers.new("dec", "DECIMATE")
        dec.ratio = 0.45
        BC.apply_modifiers(o)
        set_mask(o, (0.0, 1.0, 0.0))
        W = np.zeros((len(o.data.vertices), len(BONE_NAMES)))
        W[:, BI["head"]] = 1
        WSTORE[o.name] = W
        out.append(o)
    # upper lashes: the MakeHuman lash strips shortened toward the lid so they read as a lash line, not a band
    _, _, F = mh.base()
    for s, e in (("l", B.L.eyeL), ("r", B.L.eyeR)):
        fs = [f for f in F if f[2] == f"helper-{s}-eyelashes-2"]
        used = sorted({v for f in fs for v in f[0]})
        rm = {v: i for i, v in enumerate(used)}
        P = B.P[used].copy()
        dist = np.linalg.norm(P - e, axis=1)
        r0 = dist.min()
        P = e + (P - e) * ((r0 + 0.5 * (dist - r0)) / dist)[:, None]
        fl = [[rm[v] for v in f[0]] for f in fs]
        uvs = [cell_uv("lash", np.array([0.5]), np.array([0.5]))[0] for f in fl for _ in f]
        o = mesh_from("lashes", to_bl_np(P), fl, uvs)
        set_mask(o, (0.0, 0.0, 0.5))
        W = np.zeros((len(P), len(BONE_NAMES)))
        W[:, BI["head"]] = 1
        WSTORE[o.name] = W
        out.append(o)
    return out


# ----------------------------------------------------------------------------------------------------------------
# shoes: hull of the real foot, remeshed, with a sole edge; weighted like the foot skin
# ----------------------------------------------------------------------------------------------------------------
def shoe_objects(B, c, cov, params=None):
    """params (costume footwear): sole_h (sole height, m), lip (sole overhang), toe (toe-cap bulge), gloss, sole_gloss."""
    pr = dict(sole_h=0.014, lip=0.0022, toe=0.0, gloss=0.42, sole_gloss=0.1)
    pr.update(params or {})
    out = []
    collar = cov["_collar_y"]
    bodyv = set(B.bodyv.tolist())
    for s in "LR":
        sel = np.array([i for i in B.bodyv if (B.vb[i] in (f"foot_{s}", f"toe_{s}") or (B.vb[i] == f"shin_{s}" and B.P[i, 1] < collar + 0.012))])
        pts = B.P[sel] + B.N[sel] * 0.0075
        if pr["toe"]:     # toe cap / bumper: the front of the foot a little fuller
            fwd0 = B.Jm["toe_" + s] - B.Jm["ankle_" + s]
            fwd0[1] = 0
            fwd0 /= np.linalg.norm(fwd0)
            t_ = np.clip(((B.P[sel] - B.Jm["ball_" + s]) @ fwd0) / 0.06 + 0.5, 0, 1)
            pts = pts + B.N[sel] * (pr["toe"] * t_)[:, None]
        bm = bmesh.new()
        for p in to_bl_np(pts):
            bm.verts.new(p)
        bmesh.ops.convex_hull(bm, input=bm.verts)
        o = BC.mesh_obj("shoe", bm)
        rm = o.modifiers.new("remesh", "REMESH")
        rm.mode, rm.voxel_size = "VOXEL", 0.0055
        sm = o.modifiers.new("smooth", "SMOOTH")
        sm.factor, sm.iterations = 0.5, 4
        BC.apply_modifiers(o)
        me = o.data
        co = np.array([v.co for v in me.vertices])
        zb = co[:, 2].min()
        # open the top (the leg goes in) and stretch the bottom band down to the ground: a sole with a straight edge
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z > collar], context="FACES")
        fwd = to_bl(B.Jm["toe_" + s]) - to_bl(B.Jm["ankle_" + s])
        fwd.z = 0
        fwd.normalize()
        ax0 = to_bl(B.Jm["ankle_" + s])
        band = pr["sole_h"]
        lip_h = band + 0.002
        for v in bm.verts:
            z = v.co.z - zb
            if z < band:
                v.co.z = z / band * (zb + band)
            if v.co.z < lip_h:      # sole lip (chunky soles stand out further, with a squared-off edge)
                rel = v.co - ax0
                along = rel.dot(fwd)
                perp = rel - fwd * along
                perp.z = 0
                k_ = 1 - (v.co.z / lip_h) ** (3 if band > 0.02 else 1)
                if perp.length > 1e-4:
                    v.co += perp.normalized() * pr["lip"] * k_
                v.co += fwd * pr["lip"] * 0.8 * k_ * (1 if along > 0 else -0.6)
        if params and cov.get("_shaft"):     # a boot shaft overlaps the hull's top: tuck the hull under it (no z-fight)
            ax = to_bl(B.Jm["ankle_" + s])
            for v in bm.verts:
                t_ = min(max((v.co.z - (collar - 0.045)) / 0.025, 0.0), 1.0)
                if t_ > 0:
                    rel = v.co - ax
                    rel.z = 0
                    if rel.length > 1e-4:
                        v.co -= rel.normalized() * 0.0045 * t_
        bm.to_mesh(me)
        bm.free()
        dec = o.modifiers.new("dec", "DECIMATE")
        dec.ratio = min(1.0, 520 / max(1, len(me.polygons) * 2))
        BC.apply_modifiers(o)
        BC.smooth(o)
        sz = max(0.012, zb + band + 0.0015) if params else 0.012
        if params:      # cut the hull along the sole line: the sole / upper split is a clean edge, not decimation teeth
            bm = bmesh.new()
            bm.from_mesh(o.data)
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5, plane_co=(0, 0, sz), plane_no=(0, 0, 1))
            bm.to_mesh(o.data)
            bm.free()
        set_cell_uvs(o, "shoe", "yz", per_face=lambda p: "sole" if p.center.z < sz else "shoe")
        zz = np.array([v.co.z for v in o.data.vertices])
        set_mask(o, np.stack([np.zeros_like(zz), np.where(zz < sz, pr["sole_gloss"], pr["gloss"]), np.zeros_like(zz)], 1))
        if params:      # already low-poly: the body decimation would collapse across the sole / upper cell seam (teeth)
            a = o.data.attributes.new("_keep", "FLOAT", "POINT")
            a.data.foreach_set("value", np.ones(len(o.data.vertices), np.float32))
        ref = np.array([i for i in B.bodyv if B.vb[i] in (f"foot_{s}", f"toe_{s}", f"shin_{s}") and B.P[i, 1] < collar + 0.05])
        WSTORE[o.name] = nearest_weights(obj_world_verts(o), to_bl_np(B.P[ref]), B.W[ref], 4)
        out.append(o)
    _ = bodyv
    return out


# ----------------------------------------------------------------------------------------------------------------
# hair pieces, hats, accessories
# ----------------------------------------------------------------------------------------------------------------
def head_frame(B):
    hv = np.array([i for i in B.bodyv if B.vb[i] == "head"])
    Hp = B.P[hv]
    return Hp


def hair_sheet(B, c, ref, a0, a1, y_top, y_bot, clear=0.004, flare=0.03, seg=30, rows=8, narrow=0.0, tip=0.0, vol=0.008, name="hair_sheet"):
    """Hanging hair: an arc of strands (azimuth a0..a1 deg, 0 = front, narrowing by `narrow` deg per side toward the
    ends) from y_top down to y_bot, hugging the reference surface (head + hair shell + neck/shoulders, MH coords)."""
    L = B.L
    cz = L.eye[2] - 0.085
    rel = ref - np.array([0, 0, cz])
    th_v = np.degrees(np.arctan2(rel[:, 0], rel[:, 2]))
    rad_v = np.hypot(rel[:, 0], rel[:, 2])
    verts, uvs_v = [], []
    for r in range(rows):
        t = r / (rows - 1)
        lo, hi = a0 + narrow * t, a1 - narrow * t
        for k in range(seg):
            u = k / (seg - 1)
            yb = y_bot + tip * abs(2 * u - 1) ** 1.5          # longer at the centre of the back, shorter at the sides
            edge = min(u, 1 - u)
            # the top row follows the skull: it starts lower toward the side ends (no flaps rising above the crown)
            yt = y_top - 0.035 * ss(0.32, 0.0, edge)
            yy = yt + (yb - yt) * t
            a = lo + (hi - lo) * u
            m = (np.abs(((th_v - a + 180) % 360) - 180) < 9) & (np.abs(ref[:, 1] - yy) < (0.008 if t < 0.3 else 0.018))
            base_r = rad_v[m].max() if m.any() else 0.08
            # starts inside the hair shell (hidden) and grows through it: a layered edge, not a visible seam; the ends
            # curl in a little
            rr = (base_r + clear + (vol + 0.006) * ss(0.12, 0.45, t) + flare * ss(0.4, 1.0, t) ** 1.4 - 0.004 * ss(0.15, 0.0, edge) * ss(0.2, 0.5, t)
                  - 0.006 * ss(0.15, 0.0, t) - 0.005 * ss(0.82, 1.0, t))
            rr += 0.0022 * (0.6 * math.sin(math.radians(a) * 17 + 1.3) + 0.4 * math.sin(math.radians(a) * 31)) * ss(0.15, 0.5, t)
            ar = math.radians(a)
            verts.append([math.sin(ar) * rr, yy, cz + math.cos(ar) * rr])
            uvs_v.append((u, 1 - t))
    P = np.array(verts)
    # follow the surface below: never cut through anything further down (radius only grows downward)
    for k in range(seg):
        for r in range(1, rows):
            i, j = r * seg + k, (r - 1) * seg + k
            ri = math.hypot(P[i, 0], P[i, 2] - cz)
            rj = math.hypot(P[j, 0], P[j, 2] - cz)
            if ri < rj - 0.002:
                f = (rj - 0.002) / max(ri, 1e-6)
                P[i, 0] *= f
                P[i, 2] = cz + (P[i, 2] - cz) * f
    jit = 0.01 * np.sin(np.arange(seg) * 2.3) * np.sin(np.arange(seg) * 0.7 + 1)
    P[(rows - 1) * seg:, 1] += jit
    # outer surface: thickness grows from ~0 at the top (no step where it leaves the shell) to 6 mm at the ends
    th = 0.0012 + 0.006 * ss(0.25, 0.6, np.repeat(np.arange(rows) / (rows - 1), seg))
    rad = np.hypot(P[:, 0], P[:, 2] - cz)
    Q = P.copy()
    Q[:, 0] *= (rad + th) / rad
    Q[:, 2] = cz + (P[:, 2] - cz) * (rad + th) / rad
    n = rows * seg
    verts = np.concatenate([P, Q])
    faces = []
    for r in range(rows - 1):
        for k in range(seg - 1):
            i = r * seg + k
            faces.append([i, i + 1, i + seg + 1, i + seg])                     # inner (faces the head)
            faces.append([n + i, n + i + seg, n + i + seg + 1, n + i + 1])     # outer
    edges = [((rows - 1) * seg + k, (rows - 1) * seg + k + 1) for k in range(seg - 1)]
    edges += [(r * seg, (r + 1) * seg) for r in range(rows - 1)] + [(r * seg + seg - 1, (r + 1) * seg + seg - 1) for r in range(rows - 1)]
    for i, j in edges:   # close the ends (both windings: visible from either side)
        faces.append([i, j, n + j, n + i])
        faces.append([i, n + i, n + j, j])
    uv = np.array(uvs_v + uvs_v)
    o = mesh_from(name, to_bl_np(verts), faces, [cell_uv("hair", uv[v, 0] * 0.7 + 0.15, uv[v, 1]) for f in faces for v in f])
    BC.smooth(o)
    set_mask(o, (0, 0, 1))
    pts = obj_world_verts(o)
    W = np.zeros((len(pts), len(BONE_NAMES)))
    hy, ny = B.Jm["head"][1], B.Jm["neck"][1] - 0.06
    wh = np.clip((pts[:, 2] - ny) / max(hy - ny, 1e-3), 0, 1) * 0.65 + 0.35
    W[:, BI["head"]] = wh
    W[:, BI["neck"]] = (1 - wh) * 0.5
    W[:, BI["chest"]] = (1 - wh) * 0.5
    WSTORE[o.name] = W
    return o


def ring_fit(pts_bl, z, dz=0.015, n=36):
    """Per-angle radius of a point cloud's horizontal slice around its centre (Blender coords)."""
    m = pts_bl[np.abs(pts_bl[:, 2] - z) < dz]
    if len(m) < 8:
        m = pts_bl[np.argsort(np.abs(pts_bl[:, 2] - z))[:60]]
    cx, cy = (m[:, 0].max() + m[:, 0].min()) / 2, (m[:, 1].max() + m[:, 1].min()) / 2
    ang = np.arctan2(m[:, 1] - cy, m[:, 0] - cx)
    rad = np.hypot(m[:, 0] - cx, m[:, 1] - cy)
    bins = ((ang + math.pi) / (2 * math.pi) * n).astype(int) % n
    R = np.zeros(n)
    for b, r in zip(bins, rad):
        R[b] = max(R[b], r)
    if (R == 0).any():
        good = np.nonzero(R > 0)[0]
        R = np.interp(np.arange(n), np.r_[good - n, good, good + n], np.r_[R[good], R[good], R[good]])
    R = (np.roll(R, 1) + 2 * R + np.roll(R, -1)) / 4
    return (cx, cy), R


def ring_tube(name, rings, n=36, cap=False):
    """rings: list of (z, (cx, cy), R[n], pad) -> lofted closed-around tube."""
    verts, faces = [], []
    for z, (cx, cy), R, pad in rings:
        for k in range(n):
            a = -math.pi + (k + 0.5) * 2 * math.pi / n
            verts.append((cx + math.cos(a) * (R[k] + pad), cy + math.sin(a) * (R[k] + pad), z))
    for r in range(len(rings) - 1):
        for k in range(n):
            i, j = r * n + k, r * n + (k + 1) % n
            faces.append([i, j, j + n, i + n])
    return mesh_from(name, verts, faces)


def band_from_loop(name, L, loop, B, up, out, h, cell):
    """A collar / cuff band lofted from a layer's border loop (so it sits exactly on the garment edge)."""
    P = L.pos[loop]
    cen = P.mean(0)
    rings = []
    for k, (du, do) in enumerate(((-0.006, 0.0012), (h * 0.5, 0.0035), (h, 0.002 + out))):
        hor = P - cen
        hor[:, 1] = 0
        hor /= np.maximum(np.linalg.norm(hor, axis=1, keepdims=True), 1e-6)
        rings.append(P + up * du + hor * do)
    n = len(loop)
    verts = np.concatenate(rings)
    faces = []
    for r in range(2):
        for k in range(n):
            i, j = r * n + k, r * n + (k + 1) % n
            faces.append([i, j, j + n, i + n])
    o = mesh_from(name, to_bl_np(verts), faces)
    sol = o.modifiers.new("solid", "SOLIDIFY")
    sol.thickness, sol.offset = 0.0025, -1
    BC.apply_modifiers(o)
    W = np.tile(L.W[loop], (3, 1))
    o2 = piece(o, cell, (0, 0, 0), "xz", W=None)
    WSTORE[o2.name] = nearest_weights(obj_world_verts(o2), to_bl_np(verts), W, 2)
    return o2


def rope_from_loop(name, L, loop, radius, cell, closed=True):
    """A soft rolled hem: a thin tube along a layer border loop (sits on the edge, weighted like it)."""
    P = L.pos[loop]
    n = len(P)
    seg = 6
    verts = []
    for i in range(n):
        t = P[(i + 1) % n] - P[i - 1]
        t /= max(np.linalg.norm(t), 1e-9)
        a = np.cross(t, [0, 1, 0]) if abs(t[1]) < 0.9 else np.cross(t, [1, 0, 0])
        a /= np.linalg.norm(a)
        b = np.cross(t, a)
        for k in range(seg):
            ang = 2 * math.pi * k / seg
            verts.append(P[i] + (a * math.cos(ang) + b * math.sin(ang)) * radius)
    faces = []
    for i in range(n if closed else n - 1):
        j = (i + 1) % n
        for k in range(seg):
            faces.append([i * seg + k, i * seg + (k + 1) % seg, j * seg + (k + 1) % seg, j * seg + k])
    o = mesh_from(name, to_bl_np(np.array(verts)), faces)
    BC.smooth(o)
    piece(o, cell, (0, 0, 0), "xz")
    WSTORE[o.name] = np.repeat(L.W[loop], seg, axis=0)
    return o


def extras(c, B, cov, layers):
    """Fitted pieces: skirts / coat tails, belt, collar, scarf, buttons, bag, hats, hair pieces, glasses, mask."""
    out = []
    J, L, H = B.J, B.L, B.H
    top, bottom, accs = c.get("top"), c.get("bottom", "trousers"), c.get("acc", [])
    waist_z = J["spine"].z - 0.01
    hip_z = (J["hip_L"].z + J["pelvis"].z) / 2
    lay_pts = {k: to_bl_np(v.pos) for k, v in layers.items() if v is not None}
    lay_W = {k: v.W for k, v in layers.items() if v is not None}
    body_bl = to_bl_np(B.P[B.bodyv])
    cloth_pts = np.concatenate([lay_pts[k] for k in ("top", "bottom") if k in lay_pts] + [body_bl[np.isin(np.array(B.vb)[B.bodyv], ["hips", "spine", "thigh_L", "thigh_R"])]])
    # ---- skirt / coat tails / robe ----
    length = {"coat": 0.24, "robe": 0.45, "dress": 0.36, "jacket": 0.1, "uniform": 0.11}.get(top, 0.0)
    if bottom == "longskirt":
        length = max(length, 0.46)
    elif bottom == "skirt":
        length = max(length, 0.30)
    if length:
        top_z = waist_z if top in ("dress", "robe") or bottom != "trousers" else hip_z + 0.045
        bot_z = max(0.07, top_z - length * H)
        legs = body_bl[np.isin(np.array(B.vb)[B.bodyv], ["hips", "thigh_L", "thigh_R", "spine", "shin_L", "shin_R"])]
        rings = []
        under = top not in ("dress", "robe") and bottom != "trousers" and "top" in lay_pts   # skirt tucked under a top
        if under:      # starts hidden under the top, then clears the top's (flared) hem
            tp = lay_pts["top"][np.abs(lay_pts["top"][:, 0]) < 0.22]
            zh = tp[:, 2].min()
            _, Rh = ring_fit(tp, zh + 0.012, 0.012)
            inner = np.concatenate([lay_pts.get("bottom", np.zeros((0, 3))), body_bl[np.isin(np.array(B.vb)[B.bodyv], ["hips", "spine"])]])
            c0, R0 = ring_fit(inner, top_z, 0.012)
            top_z = max(top_z, zh + 0.05)
            c0, R0 = ring_fit(inner, top_z, 0.012)
        else:
            c0, R0 = ring_fit(cloth_pts, top_z, 0.012)
        fl_k = {"coat": 0.3, "robe": 0.42, "jacket": 0.12, "uniform": 0.1}.get(top, 0.4 if bottom == "longskirt" else 0.36)
        prevR = R0
        for i in range(12):
            t = i / 11
            z = top_z + (bot_z - top_z) * t
            ci, Ri = ring_fit(legs, max(z, J["knee_L"].z), 0.02)
            Ri = np.maximum(Ri, prevR * (0.985 if z > hip_z else 1.0)) if i else R0
            if under and i and z < zh + 0.02:
                Ri = np.maximum(Ri, Rh + 0.006)
            fl = 1 + t * fl_k
            pad = 0.004 + 0.012 * t
            rings.append((z, (0.0, c0[1] * (1 - t) + (ci[1] + 0.004) * t), Ri * (fl if i else 1.0), pad))
            prevR = Ri
        if under:   # emerge right under the top's hem edge (the visible line is the hem itself)
            rings = [(zh + 0.03, rings[0][1], R0, 0.003), (zh - 0.004, rings[0][1], np.maximum(R0, Rh - 0.003), 0.0),
                     (zh - 0.026, rings[0][1], np.maximum(R0, Rh + 0.004), 0.004)] + [r for r in rings[1:] if r[0] < zh - 0.05]
        o = ring_tube("skirt", rings)
        if top in ("coat", "jacket") and bottom == "trousers":   # coats / jackets: a front vent, closed at the waist
            bm = bmesh.new()
            bm.from_mesh(o.data)
            kill = [f for f in bm.faces if f.calc_center_median().y < -0.02 and abs(f.calc_center_median().x) < 0.1 * (top_z - f.calc_center_median().z) - 0.004]
            bmesh.ops.delete(bm, geom=kill, context="FACES")
            bm.to_mesh(o.data)
            bm.free()
        cloth_shell(o, 0.005)
        cell = "colA" if top in ("coat", "robe", "dress", "jacket", "uniform") and bottom == "trousers" or top in ("robe", "dress") else "colB"
        piece(o, cell, (0, 0, 0), "xz")
        WSTORE[o.name] = skirt_weights(obj_world_verts(o), J, H, top_z, long=length > 0.4)
        out.append(o)
        if "apron" in accs:
            ap = ring_tube("apron", [(z, cc, R * 1.05, p + 0.008) for z, cc, R, p in rings[:6]])
            bm = bmesh.new()
            bm.from_mesh(ap.data)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().y > rings[0][1][1] - 0.03], context="FACES")
            bm.to_mesh(ap.data)
            bm.free()
            cloth_shell(ap, 0.003)
            piece(ap, "acc", (0, 0, 0), "xz")
            WSTORE[ap.name] = skirt_weights(obj_world_verts(ap), J, H, top_z, long=length > 0.4)
            out.append(ap)
    elif "apron" in accs:
        c0, R0 = ring_fit(cloth_pts, waist_z, 0.012)
        rings = [(waist_z - i * 0.06, c0, R0, 0.008 + 0.004 * i) for i in range(6)]
        ap = ring_tube("apron", rings)
        bm = bmesh.new()
        bm.from_mesh(ap.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().y > c0[1] - 0.03], context="FACES")
        bm.to_mesh(ap.data)
        bm.free()
        cloth_shell(ap, 0.003)
        piece(ap, "acc", (0, 0, 0), "xz")
        WSTORE[ap.name] = skirt_weights(obj_world_verts(ap), J, H, waist_z, long=False)
        out.append(ap)
    # ---- belt (fitted to the garment surface) ----
    if "belt" in accs or top in ("robe", "uniform"):
        src = np.concatenate([lay_pts[k] for k in ("top", "bottom") if k in lay_pts])
        srcW = np.concatenate([lay_W[k] for k in ("top", "bottom") if k in lay_pts])
        cc, R = ring_fit(src[np.abs(src[:, 0]) < 0.3], waist_z, 0.012)
        hh = 0.02 if top in ("robe", "coat") else 0.016
        o = ring_tube("belt", [(waist_z - hh, cc, R, 0.0035), (waist_z, cc, R, 0.0045), (waist_z + hh, cc, R, 0.0035)])
        piece(o, "trim", (0, 0.3, 0), "xz")
        WSTORE[o.name] = nearest_weights(obj_world_verts(o), src, srcW, 3)
        out.append(o)
    # ---- collar band on the real neckline ----
    T = layers.get("top")
    if T is not None and top and c.get("hat") != "hood":
        loops = T.boundary_loops()
        if loops:
            neck_loop = max(loops, key=lambda lp: T.pos[lp, 1].mean() - 2 * np.abs(T.pos[lp, 0]).mean())
            if T.pos[neck_loop, 1].mean() > B.Jm["chest"][1]:
                h = COLLAR_H.get(top, 0.01) * H / 1.75
                o = band_from_loop("collar", T, neck_loop, B, np.array([0, 1.0, 0]), 0.004 if h > 0.02 else 0.0, h, "colA")
                out.append(o)
            # cuffs: short bands on the sleeve ends
            for lp in loops:
                if lp is neck_loop:
                    continue
                q = T.pos[lp]
                if np.abs(q[:, 0]).mean() > 0.25 and len(lp) > 8:
                    axis = B.Jm["wrist_L" if q[:, 0].mean() > 0 else "wrist_R"] - B.Jm["elbow_L" if q[:, 0].mean() > 0 else "elbow_R"]
                    axis = axis / np.linalg.norm(axis)
                    out.append(band_from_loop("cuff", T, lp, B, -axis, 0.0, 0.012, "colA"))
    # ---- scarf ----
    if "scarf" in accs:
        nz = J["neck"].z + 0.012
        neckp = body_bl[np.isin(np.array(B.vb)[B.bodyv], ["neck"])]
        if T is not None:
            tp = lay_pts["top"]
            neckp = np.concatenate([neckp, tp[(tp[:, 2] > nz - 0.05) & (np.abs(tp[:, 0]) < 0.075 * H / 1.75)]])
        cc, R = ring_fit(neckp, nz - 0.012, 0.018)
        o = loft("scarf", [(nz - 0.04, cc, R, 0.006), (nz - 0.022, cc, R, 0.011), (nz - 0.002, cc, R * 0.97, 0.011), (nz + 0.016, cc, R * 0.93, 0.008), (nz + 0.026, cc, R * 0.9, 0.004)])
        piece(o, "acc", (0, 0, 0), "xz", bone="neck")
        out.append(o)
        ch = J["chest"]
        crx = ring_fit(cloth_pts, ch.z + 0.06, 0.015)[1]
        cry = crx[9]  # front radius (angle -90 deg)
        tail = BC.tube("scarf_tail", [V((0.03, cc[1] - R[9] - 0.01, nz - 0.03)), V((0.034, ch.y - cry - 0.022, ch.z + 0.06)), V((0.036, ch.y - cry - 0.026, ch.z - 0.04)), V((0.037, ch.y - cry - 0.02, ch.z - 0.12))],
                       [(0.028, 0.004)] * 4, seg=8)
        piece(tail, "acc", (0, 0, 0), "xz", bone="chest")
        out.append(tail)
    # ---- buttons down the front (on the garment surface) ----
    if (top in ("coat", "uniform") or "buttons" in accs) and T is not None:
        tp = lay_pts["top"]
        for i in range(5):
            z = J["neck"].z - 0.075 - i * 0.075
            if z < hip_z + 0.02:
                break
            m = tp[(np.abs(tp[:, 2] - z) < 0.012) & (np.abs(tp[:, 0]) < 0.02)]
            if not len(m):
                continue
            yf = m[:, 1].min()
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.006)
            for v in bm.verts:
                v.co.y *= 0.55
            o = BC.mesh_obj("button", bm)
            o.location = V((0.0, yf - 0.001, z))
            BC.apply_modifiers(o)
            bpy.context.view_layer.update()
            o.data.transform(o.matrix_world)
            o.matrix_world = Matrix.Identity(4)
            piece(o, "metal", (0, 0.6, 0), "xz", bone="chest" if z > J["chest"].z else "spine")
            out.append(o)
    # ---- satchel ----
    if "satchel" in accs:
        cc, R = ring_fit(cloth_pts, hip_z, 0.02)
        rx = R[18]   # +x side radius
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.bevel(bm, geom=bm.edges, offset=0.25, segments=2, affect="EDGES")
        for v in bm.verts:
            v.co = V((v.co.x * 0.05 + (rx + 0.035), v.co.y * 0.22 + cc[1], v.co.z * 0.17 + hip_z + 0.02))
        o = BC.mesh_obj("satchel", bm)
        piece(o, "trim", (0, 0.25, 0), "yz", bone="hips")
        out.append(o)
        sh = J["shoulder_L"]
        strap = BC.tube("strap", [V((rx + 0.03, cc[1] - 0.02, hip_z + 0.1)), V((0.04, J["chest"].y - 0.13, J["chest"].z)), V((-sh.x + 0.03, sh.y - 0.05, sh.z + 0.06)),
                                  V((-sh.x + 0.02, sh.y + 0.06, sh.z + 0.04)), V((0.05, J["chest"].y + 0.12, J["chest"].z - 0.02)), V((rx + 0.03, cc[1] + 0.03, hip_z + 0.1))],
                        [(0.02, 0.003)] * 6, seg=6)
        piece(strap, "trim", (0, 0.2, 0), "xz", bone="chest")
        out.append(strap)
    # ---- head pieces ----
    hcen = to_bl(L.eye)
    Hp = to_bl_np(head_frame(B))
    hm = Hp[np.abs(Hp[:, 2] - (hcen.z + 0.03)) < 0.02]
    hrx = (hm[:, 0].max() - hm[:, 0].min()) / 2
    hry = (hm[:, 1].max() - hm[:, 1].min()) / 2
    hc = V(((hm[:, 0].max() + hm[:, 0].min()) / 2, (hm[:, 1].max() + hm[:, 1].min()) / 2, hcen.z + 0.02))
    hs = hrx / 0.86
    hat, style = c.get("hat"), cov["_style"]
    vol = SHELL.get(style, 0.0)
    out += hat_pieces(c, B, layers)
    for key, cell, rad in (("scarf", "acc", 0.0045), ("hood", "colA", 0.006)):
        Lx = layers.get(key)
        if Lx is not None:
            loops = Lx.boundary_loops()
            if loops:
                out.append(rope_from_loop(key + "_hem", Lx, max(loops, key=len), rad, cell))
    if hat == "headscarf":   # knot at the nape with two short tails
        nape = hc + V((0, hry * 0.95, -0.07))
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=1.0)
        for v in bm.verts:
            v.co = V((v.co.x * 0.026, v.co.y * 0.014, v.co.z * 0.018))
        o = BC.mesh_obj("knot", bm)
        o.data.transform(Matrix.Translation(nape))
        piece(o, "acc", (0, 0, 0), "xz", bone="head")
        out.append(o)
        for sd in (-1, 1):
            tl = BC.tube("knot_tail", [nape + V((sd * 0.008, 0.004, -0.004)), nape + V((sd * 0.018, 0.012, -0.045)), nape + V((sd * 0.024, 0.02, -0.085))],
                         [(0.016, 0.003), (0.02, 0.003), (0.012, 0.002)], seg=8)
            piece(tl, "acc", (0, 0, 0), "xz", bone="head")
            out.append(tl)
    if hat not in ("hood", "headscarf"):
        out += hair_pieces(c, B, cov, layers)
    if "glasses" in accs:
        for e in (L.eyeL, L.eyeR):
            bm = bmesh.new()
            bmesh.ops.create_circle(bm, cap_ends=False, segments=16, radius=0.017)
            bmesh.ops.rotate(bm, verts=bm.verts, cent=V((0, 0, 0)), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
            o = BC.mesh_obj("lens", bm)
            o.modifiers.new("skin", "SKIN")
            for dd in o.data.skin_vertices[0].data:
                dd.radius = (0.0012, 0.0012)
            BC.apply_modifiers(o)
            o.data.transform(Matrix.Translation(to_bl(e) + V((0, -0.02, 0))))
            piece(o, "metal", (0, 0.6, 0), "xz", bone="head")
            out.append(o)
    if "mask" in accs:
        o = BC.shell("mask", hc + V((0, -0.006, 0)), hrx * 1.1, hry * 1.12, hrx * 1.45, lambda p: p.y < -0.3 and -0.75 < p.z < 0.62, seg=(36, 24))
        bpy.context.view_layer.update()
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
        piece(o, "metal", (0, 0.5, 0), "xz", bone="head")
        out.append(o)
    return out


def hair_pieces(c, B, cov, layers):
    """Hair pieces of the legacy styles: bun, braid, ponytail, long / bob hanging sheets."""
    out = []
    L, H = B.L, B.H
    hcen = to_bl(L.eye)
    Hp = to_bl_np(head_frame(B))
    hm = Hp[np.abs(Hp[:, 2] - (hcen.z + 0.03)) < 0.02]
    hrx = (hm[:, 0].max() - hm[:, 0].min()) / 2
    hry = (hm[:, 1].max() - hm[:, 1].min()) / 2
    hc = V(((hm[:, 0].max() + hm[:, 0].min()) / 2, (hm[:, 1].max() + hm[:, 1].min()) / 2, hcen.z + 0.02))
    style = cov["_style"]
    vol = SHELL.get(style, 0.0)
    _ = hrx
    hp = []
    if style == "bun":
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=12, radius=1.0)
        for v in bm.verts:
            v.co = V((v.co.x * 0.04, v.co.y * 0.034, v.co.z * 0.036))
        o = BC.mesh_obj("bun", bm)
        o.data.transform(Matrix.Translation(hc + V((0, hry * 0.86 + vol, hrx * 0.5))))
        hp.append((o, "head"))
    if style in ("braid", "pony"):
        # gathered at the back of the head, then hanging with gravity down the nape (it follows the back of the head,
        # neck and garments at a small clearance): a tapered tube (a braid: lobed), a tie band at the gather
        ref = [head_frame(B), B.P[B.bodyv][np.isin(np.array(B.vb)[B.bodyv], ["neck", "chest", "clavicle_L", "clavicle_R", "spine"])]]
        ref += [Lt.pos for k_, Lt in layers.items() if (k_.startswith("top") or k_ == "hair") and Lt is not None]
        R_ = to_bl_np(np.concatenate(ref))
        R_ = R_[np.abs(R_[:, 0]) < 0.035]
        braid = style == "braid"
        drop = float(c.get("hairDrop", 0.27 if braid else 0.17)) * B.H / 1.75
        g0 = hc + V((0, hry * 0.9 + vol, -0.012))
        nseg = 16 if braid else 11
        pts, radii = [], []
        yprev = None
        for i in range(nseg):
            t = i / (nseg - 1)
            z = g0.z - drop * t ** 1.05
            m = np.abs(R_[:, 2] - z) < 0.012
            surf = R_[m, 1].max() if m.any() else g0.y
            r = (0.0145 if braid else 0.021) * (1 - (0.72 if braid else 0.55) * t ** 1.5) + (0.003 if braid else 0.005)
            if braid:
                r *= 1 + 0.16 * abs(math.sin(t * math.pi * 7.5))
            y = max(surf + r + 0.004, g0.y + 0.012 * math.sin(min(t * 3, 1) * math.pi / 2))
            if yprev is not None:
                y = max(y, yprev - 0.006)          # it hangs: never tucks back in sharply
            yprev = y
            pts.append(V((g0.x + 0.004 * math.sin(t * 5.0), y, z)))
            radii.append(r)
        o = hair_tube("braid" if braid else "pony", pts, radii, seg=10 if braid else 12)
        hp.append((o, "head"))
        tie = bmesh.new()
        bmesh.ops.create_cone(tie, cap_ends=False, segments=12, radius1=radii[0] * 0.95 + 0.002, radius2=radii[0] * 0.95 + 0.002, depth=0.008)
        ot = BC.mesh_obj("hair_tie", tie)
        d0 = (pts[1] - pts[0]).normalized()
        ot.data.transform(Matrix.Translation(pts[0] + d0 * 0.004) @ d0.to_track_quat("Z", "Y").to_matrix().to_4x4())
        hp.append((ot, "head"))
    for o, bone in hp:
        BC.smooth(o)
        piece(o, "hair", (0, 0, 1), "xz", bone=bone)
        out.append(o)
    if style in ("long", "bob"):
        ref = [head_frame(B), B.P[B.bodyv][np.isin(np.array(B.vb)[B.bodyv], ["neck", "chest", "clavicle_L", "clavicle_R"])]]
        ref += [Lt.pos for k_, Lt in layers.items() if k_.startswith("top") and Lt is not None]
        if cov.get("_hair_ref") is not None:
            ref.append(cov["_hair_ref"])
        ref = np.concatenate(ref)
        sh = look2.CUTS.get(c.get("hairCut") or "", {}).get("sheet") if look2.ON else None
        if sh:          # a cut's own hanging inner mass (photo likeness, loose curls: the dark core the ringlets sit on)
            out.append(hair_sheet(B, c, ref, sh.get("a0", 66), sh.get("a1", 294), L.eye[1] + 0.085, L.eye[1] - sh["drop"] * H / 1.75, clear=sh["clear"], flare=sh["flare"], rows=16,
                                  tip=sh.get("tip", 0.012), seg=42, vol=vol))
        elif style == "long":
            out.append(hair_sheet(B, c, ref, 84, 276, L.eye[1] + 0.085, L.eye[1] - 0.27 * H / 1.75, clear=0.003, flare=0.016, narrow=36, rows=20, tip=0.07, seg=44, vol=vol))
        else:
            out.append(hair_sheet(B, c, ref, 70, 290, L.eye[1] + 0.085, L.eye[1] - 0.078, clear=0.003, flare=0.01, rows=16, tip=0.012, seg=42, vol=vol))
    return out


def hair_tube(name, pts, radii, seg=10):
    """Tapered hair tube through pts (BL coords) with parallel-transport frames (no twist where the path turns from
    backward to downward) and a closed rounded tip."""
    bm = bmesh.new()
    rings = []
    prev = None
    for i, (p, r) in enumerate(zip(pts, radii)):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        if prev is None:
            a = d.cross(V((1, 0, 0)))
            a = a.normalized() if a.length > 1e-6 else d.orthogonal().normalized()
        else:
            a = (prev - d * prev.dot(d)).normalized()
        prev = a
        b2 = d.cross(a).normalized()
        rings.append([bm.verts.new(V(p) + (a * math.cos(2 * math.pi * k / seg) + b2 * math.sin(2 * math.pi * k / seg)) * r) for k in range(seg)])
    for i in range(len(rings) - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    d_end = (pts[-1] - pts[-2]).normalized()
    tip = bm.verts.new(V(pts[-1]) + d_end * radii[-1] * 0.9)
    for k in range(seg):
        bm.faces.new((rings[-1][k], rings[-1][(k + 1) % seg], tip))
    d_0 = (pts[0] - pts[1]).normalized()
    cap = bm.verts.new(V(pts[0]) + d_0 * radii[0] * 0.5)
    for k in range(seg):
        bm.faces.new((rings[0][(k + 1) % seg], rings[0][k], cap))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = BC.mesh_obj(name, bm)
    return o


def loft(name, rings, n=36, cap_top=False, front=None):
    """rings: [(z, (cx, cy), R[n], pad)] (Blender coords) -> quad tube; cap_top closes the last ring with a fan;
    front=(a0, a1) keeps only the arc of angles a0..a1 (radians, -pi/2 = front) -> an open strip (visors)."""
    verts, faces = [], []
    ks = list(range(n))
    angs = [-math.pi + (k + 0.5) * 2 * math.pi / n for k in ks]
    if front is not None:
        angs = list(np.linspace(front[0], front[1], n))
    for z, (cx, cy), R, pad in rings:
        for k, a in enumerate(angs):
            kk = int(((a + math.pi) / (2 * math.pi) * len(R))) % len(R)
            rr = (R[kk] if hasattr(R, "__len__") else R) + pad
            verts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr, z))
    m = len(angs)
    for r in range(len(rings) - 1):
        for k in range(m if front is None else m - 1):
            i, j = r * m + k, r * m + (k + 1) % m
            faces.append([i, j, j + m, i + m])
    if cap_top:
        z, (cx, cy), _, _ = rings[-1]
        top = np.array(verts[-m:])
        verts.append((top[:, 0].mean(), top[:, 1].mean(), z + 0.004))
        c0 = len(verts) - 1
        for k in range(m):
            faces.append([(len(rings) - 1) * m + k, (len(rings) - 1) * m + (k + 1) % m, c0])
    return mesh_from(name, verts, faces)


def hat_pieces(c, B, layers):
    """Hats fitted to the real head (+ hair): crown rings measured at their own heights, brims / visors on the band."""
    hat = c.get("hat")
    if hat not in ("cap", "fedora", "tophat", "warden"):
        return []
    k = B.H / 1.75
    hp = to_bl_np(head_frame(B))
    if layers.get("hair") is not None:
        hp = np.concatenate([hp, to_bl_np(layers["hair"].pos)])
    eye_z = B.L.eye[1]
    zb = eye_z + {"cap": 0.046, "fedora": 0.05, "tophat": 0.052, "warden": 0.047}[hat] * k
    cc, R = ring_fit(hp, zb, 0.01)
    top = hp[:, 2].max()
    cell = {"clothA": "colA", "clothB": "colB", "accent": "acc"}.get(c.get("hatMat", "trim"), "trim")
    out, pad = [], 0.0045
    if hat == "cap":   # flat cap: roomy crown sloping forward over a short peak
        fwd = 0.016 * k
        rings = [(zb - 0.003, cc, R, pad)]
        for f, sc in ((0.35, 1.07), (0.7, 1.08), (1.0, 0.92)):
            z = zb + (top - zb) * 0.8 * f + 0.004
            ci, Ri = ring_fit(hp, min(z, top - 0.01), 0.008)
            rings.append((z, (cc[0], cc[1] - fwd * f), np.maximum(Ri, R * (1.0 - 0.45 * f)) * sc, pad + 0.004))
        crown = loft("cap", rings, cap_top=True)
        visor = loft("visor", [(zb + 0.001, cc, R, pad - 0.003), (zb - 0.01 * k, cc, R, pad + 0.046 * k)], n=14, front=(-math.pi / 2 - 0.85, -math.pi / 2 + 0.85))
    else:
        h = {"fedora": 0.08, "tophat": 0.17, "warden": 0.058}[hat] * k
        fl = {"fedora": 0.96, "tophat": 1.03, "warden": 1.07}[hat]
        rings = [(zb - 0.004, cc, R, pad), (zb + h * 0.5, cc, R * (1 + (fl - 1) * 0.5), pad), (zb + h, cc, R * fl, pad)]
        crown = loft(hat, rings, cap_top=True)
        if hat == "warden":
            visor = loft("visor", [(zb + 0.002, cc, R, pad - 0.001), (zb - 0.02 * k, cc, R, pad + 0.05 * k)], n=14, front=(-math.pi / 2 - 1.0, -math.pi / 2 + 1.0))
            band = loft("band", [(zb - 0.004, cc, R, pad + 0.0015), (zb + 0.022 * k, cc, R, pad + 0.0015 + 0.001)])
            piece(band, "trim", (0, 0.3, 0), "xz", bone="head")
            out.append(band)
        else:
            bw = {"fedora": 0.05, "tophat": 0.04}[hat] * k
            visor = loft("brim", [(zb + 0.001, cc, R, pad - 0.002), (zb - (0.006 if hat == "fedora" else 0.0), cc, R, pad + bw)])
    for o in (crown, visor):
        sol = o.modifiers.new("solid", "SOLIDIFY")
        sol.thickness = 0.0035
        BC.apply_modifiers(o)
        BC.smooth(o)
        piece(o, cell, (0, 0.08, 0), "xz", bone="head")
        out.append(o)
    return out


def cloth_shell(o, thickness):
    """Give a cloth sheet its thickness, with the hem / edge rim on its own normals (smooth normals averaged across the
    rim turn the whole hem dark)."""
    sol = o.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = thickness
    es = o.modifiers.new("split", "EDGE_SPLIT")
    es.split_angle = math.radians(55)
    es.use_edge_sharp = False
    BC.apply_modifiers(o)


def skirt_weights(pts, J, H, top_z, long=False):
    """Skirts / coat tails: hips at the waist, then mostly the thigh on the same side (by the knee, so a striding leg
    carries its half of the skirt instead of poking through it), with a little shin toward a long hem. The two sides
    blend over the whole front / back panel, so the cloth stretches between the legs instead of splitting into two
    rigid boards. An apron takes the same weights as the skirt under it (they move as one)."""
    W = np.zeros((len(pts), len(BONE_NAMES)))
    t = np.clip((top_z - pts[:, 2]) / (0.2 * H), 0, 1)
    back = np.clip((pts[:, 1] - J["pelvis"].y) / 0.08, 0, 1)        # the back panel stays a little more with the hips
    lw = t ** 0.8 * (1 - 0.25 * back) * 0.85
    sx = np.clip(pts[:, 0] / 0.11, -1, 1)
    sx = np.sin(sx * math.pi / 2)
    kz = J["knee_L"].z
    below = np.clip((kz + 0.02 - pts[:, 2]) / 0.22, 0, 1) * 0.75     # below the knee the hem hangs from the shin
    W[:, BI["hips"]] = 1 - lw
    for s_, side in (("L", 0.5 + 0.5 * sx), ("R", 0.5 - 0.5 * sx)):
        W[:, BI["thigh_" + s_]] = lw * side * (1 - below)
        W[:, BI["shin_" + s_]] = lw * side * below
    return W


# ----------------------------------------------------------------------------------------------------------------
# build one character
# ----------------------------------------------------------------------------------------------------------------
def budget(c):
    if c.get("tris"):
        return c["tris"]
    if c["id"] == "arin":
        return 16000
    if c["id"].startswith("town_") or c["macro"].get("age", 0.5) < 0.25:
        return 9000
    return 11000


def build(c, tex_dir):
    c = look2.resolve_cut(c)       # hero pipeline: a cut from the library names its hair volume style and its cards
    costume_mode = "wear" in c
    AUX_MODE[0] = costume_mode
    B = Body(c)
    if costume_mode:
        costume.aux_reset()
        cov = costume.fields(c, B)
    else:
        cov = fields(c, B)
    style = cov["_style"]
    lay_parts = layout()["part"]
    res = c.get("res", 2048 if c["id"] in ("arin", "kai") else 1024)
    tex_path = os.path.join(tex_dir, c["id"] + ".jpg")
    tex = None if costume_mode else paint(c, B, cov, res, tex_path)
    layers = {}
    H = B.H
    # ---- skin (with a 2 cm band under every garment border) ----
    hide = costume.hide_field(cov) if costume_mode else hide_field(cov)
    for key in ("scarf", "hood"):      # ears under a headscarf / hood are tucked away
        if key in cov:
            earv = layout()["ears"]
            hide[earv] = np.maximum(hide[earv], np.where(cov[key][earv] > -0.01, 0.05, hide[earv]))
    skin = build_layer(B, "skin", -hide, iso=-0.02)
    hpaint = cov.get("hair", cov.get("_hairpaint"))
    sk = ss(-0.006, 0.0, -hide[skin.base])
    hb = ss(-0.002, 0.004, hpaint[skin.base]) if hpaint is not None else 0
    skin.mask = np.stack([sk * (1 - hb), np.zeros_like(sk), hb * np.ones_like(sk)], 1)
    layers["skin"] = skin
    # ---- garments ----
    if costume_mode:
        layers.update(costume.build_layers(c, B, cov))
        cov["_layer_objs"] = layers      # the painter claims each layer's own uv footprint (costume.layer_texels)
    else:
        thick = {"coat": 0.012, "robe": 0.012, "jacket": 0.009, "uniform": 0.009, "sweater": 0.008, "vest": 0.007, "shirt": 0.006, "dress": 0.006}.get(c.get("top"), 0.008)
        if "bottom" in cov:
            Lb = build_layer(B, "bottom", cov["bottom"])
            if Lb is not None:
                taubin(Lb, 4)
                offset_layer(Lb, B, 0.0055 * (0.35 + 0.65 * ss(0.0, 0.02, Lb.cov)))
                layers["bottom"] = Lb
        if "shaft" in cov:
            Ls = build_layer(B, "shaft", cov["shaft"])
            if Ls is not None:
                taubin(Ls, 4)
                offset_layer(Ls, B, 0.0085 * (0.6 + 0.4 * ss(0.0, 0.015, Ls.cov)))
                Ls.mask[:, 1] = 0.42
                layers["shaft"] = Ls
        if "top" in cov:
            Lt = build_layer(B, "top", cov["top"])
            if Lt is not None:
                loose = {"coat": 10, "robe": 12, "jacket": 8, "uniform": 8, "sweater": 8, "dress": 8}.get(c.get("top"), 6)
                taubin(Lt, loose)
                offset_layer(Lt, B, thick * (0.4 + 0.6 * ss(0.0, 0.02, Lt.cov)))
                amt = {"coat": 1.0, "robe": 1.0, "jacket": 0.85, "uniform": 0.8, "sweater": 0.75, "dress": 0.7}.get(c.get("top"), 0.5)
                inflate(Lt, B, amt)
                taubin(Lt, 2)
                layers["top"] = Lt
    head_faces = [fi for fi in B.faces if lay_parts[fi] in ("face", "scalp")]
    if "hair" in cov and SHELL.get(style, 0) > 0:
        Lh = build_layer(B, "hair", cov["hair"], faces=head_faces)
        if Lh is not None:
            vol = SHELL[style]
            rel = Lh.pos - B.L.eye
            shape = 0.55 + 0.45 * ss(-0.02, 0.07, rel[:, 1])
            if style == "swept":
                shape = shape + 0.7 * g2(((rel[:, 2] - 0.0) / 0.04) ** 2 + ((rel[:, 1] - 0.075) / 0.035) ** 2, 1.0)
            shape = costume.hair_shape(style, rel, shape)
            taubin(Lh, 3, pin=Lh.cov <= 0.0005)
            seed = (sum(map(ord, c["id"])) % 97) * 0.37
            clumps = hair_strands(c, rel, style, seed, fine=0.6) - 0.5     # combed clumps: relief along the strands
            if hexc(c.get("hairColor", "2e2119")).mean() > 0.42:            # light hair shows every ridge: softer clumps
                clumps = clumps * 0.45
            relief = costume.hair_relief(style, rel, seed)
            if look2.ON and look2.hero_cut(c) and os.environ.get("HERO_HAIR") != "0":
                # proto:makehuman hero cuts: the shell is the inner share of the cut's sculpted volume (look2.hero_T)
                Th = look2.hero_T(c, rel, 0.024 * (1 if c.get("hairPart", "left") == "left" else -1)) * H / 1.75
                offset_layer(Lh, B, 0.0004 + (look2.HERO_SHELL * Th * (1 + 0.12 * clumps)) * ss(0.0, look2.hero_ramp(c), Lh.cov))
            else:
                offset_layer(Lh, B, 0.0004 + (vol * (shape + 0.45 * clumps) + relief) * ss(0.0, 0.03, Lh.cov))
            taubin(Lh, 2, pin=Lh.cov <= 0.0005)
            Lh.mask[:, 2] = 1
            layers["hair"] = Lh
    if c.get("beardShell"):
        # Kai v3: the beard's volume. His beard is a dense spade standing 3-6 mm off the moustache and the jaw, 13 mm
        # off the chin and hanging 20-30 mm under it (the three photos): a copy of the head skin where the beard is
        # (likeness_look.Look.shell: the density over `beardShell`), lifted to the beard's measured outer surface,
        # sharing the skin's atlas texels (the painted beard mat) and shaded as hair; the beard cards grow over it
        LKs = likeness_look.load(c, B)
        if LKs is not None and getattr(LKs, "v3", False):
            shv = LKs.shell(B)
            iso = float(c["beardShell"])
            fcs = [fi for fi in B.faces if lay_parts[fi] not in ("mouth", "lidL", "lidR")]
            Lbs = build_layer(B, "beardshell", shv["dens"] - iso, faces=fcs)
            if Lbs is not None:
                ramp = ss(0.0, 0.22, Lbs.cov)
                Lbs.pos = Lbs.pos + (shv["S"] - B.P)[Lbs.base] * ramp[:, None] + B.N[Lbs.base] * 0.0003
                taubin(Lbs, 3, pin=Lbs.cov <= 0.0005)
                Lbs.mask[:, 2] = 0.988         # hair (0.988: the bare-clay review renders can tell the beard's volume from the scalp's)
                Lbs.split_src = B.P[Lbs.base]          # (the face-bone split from the skin it grows on, look2.SPLIT_SRC)
                layers["beardshell"] = Lbs
                # the skin it hides (dense, standing well off): shaded as hair, not subdivided (subdivide_head)
                hid = ss(0.7, 0.85, shv["dens"]) * ss(2.0, 3.5, shv["t"])
                skin.mask[:, 2] = np.maximum(skin.mask[:, 2], hid[skin.base])
                skin.mask[:, 0] = skin.mask[:, 0] * (1 - hid[skin.base])
                print(f"  beard shell: {len(Lbs.faces)} faces, standoff {shv['t'][Lbs.base].max():.1f} mm max, skin hidden {int((hid[skin.base] > 0.5).sum())} vertices", flush=True)
    for key, off in (("scarf", 0.015), ("hood", 0.016)):
        if key in cov:
            faces = [fi for fi in B.faces if lay_parts[fi] not in ("mouth", "lidL", "lidR")]
            Lx = build_layer(B, key, cov[key], faces=faces)
            if Lx is not None:
                # cloth passes over the ears: press them flat against the side of the skull
                rel0 = B.P - B.L.eye
                sk = B.P[(np.abs(rel0[:, 1] - 0.03) < 0.006) & (rel0[:, 2] < -0.05) & (rel0[:, 2] > -0.12) & (B.hw > 0.5)]
                xs = np.abs(sk[:, 0] - B.L.eye[0]).max() if len(sk) else 0.072
                em = B.ear[Lx.base] > 0.5
                Lx.nb = B.N[Lx.base].copy()
                if em.any():
                    sx = np.sign(Lx.pos[em, 0] - B.L.eye[0])
                    Lx.pos[em, 0] = B.L.eye[0] + sx * np.minimum(np.abs(Lx.pos[em, 0] - B.L.eye[0]), xs)
                    Lx.nb[em] = np.stack([sx, np.zeros_like(sx), np.zeros_like(sx)], 1)
                taubin(Lx, 10 if key == "hood" else 14)
                rel = Lx.pos - B.L.eye
                bump = 0.0
                hw = np.clip(B.hw[Lx.base] + B.W[Lx.base, BI["neck"]], 0, 1) if key == "hood" else 1.0
                if key == "scarf" and c.get("hair") == "bun":
                    bump = 0.03 * g2(rel[:, 0] ** 2 + ((rel[:, 1] - 0.07) / 1.0) ** 2 + ((rel[:, 2] + 0.15) / 0.6) ** 2, 0.035)
                if key == "hood":   # snug at the face opening, loose and a little peaked behind; a slim mantle on the shoulders
                    big = 1.4 if costume_mode else 1.0
                    bump = 0.022 * big * ss(0.0, 0.07, Lx.cov) * hw + 0.012 * big * g2(rel[:, 0] ** 2 + ((rel[:, 1] - 0.06) / 1.2) ** 2 + ((rel[:, 2] + 0.12) / 0.8) ** 2, 0.04)
                offset_layer(Lx, B, off * (0.35 + 0.65 * ss(0.0, 0.02, Lx.cov)) + bump)
                if key == "hood" and costume_mode:
                    costume.hood_drape(Lx, B)
                taubin(Lx, 2)
                if costume_mode:       # over whatever the costume put on the shoulders
                    costume.push_out(Lx, B, cov["_OFF"][Lx.base] + 0.004)
                    Lx.mask[:, 1] = 0.0
                layers[key] = Lx
    parts = [layer_object(Lr, B) for Lr in layers.values()]
    for Lr in layers.values():
        if getattr(Lr, "split_src", None) is not None:      # (Kai v3: the beard shell splits its face bones from the skin under it)
            look2.SPLIT_SRC[Lr.name] = to_bl_np(Lr.split_src)
    parts += look2.eye_objects(B, c) if look2.ON else eye_objects(B, c)
    gk = None
    if costume_mode:
        ex = costume.extras(c, B, cov, layers)
        if os.environ.get("PIECES"):
            print("  pieces", sorted(o.name for o in ex))
        if c.get("gear"):      # gadgets: built on the dressed body (rays hit the outermost layer)
            gk = gadgets.build(c, B, cov, parts + ex)
            ex += gk["body"]
    else:
        parts += shoe_objects(B, c, cov)
        ex = extras(c, B, cov, layers)
    cloth = [o for o in ex if o.name.startswith(("skirt", "apron", "collar", "hood_roll", "helmet", "strap_", "gadget_", "pouch", "buckle", "panel", "knot"))]    # even quads / thin shells / hard surface: no decimation
    gx = (gk["glow"] + gk["props"]) if gk else []      # separate skinned meshes: glow (gx_*) and hand props (gp_*)
    parts += [o for o in ex if o not in cloth]
    if costume_mode:      # aux pieces packed, their uvs mapped, then the atlas painted (it needs the pieces)
        costume.aux_pack()
        costume.aux_remap(parts + cloth + gx)
        tex = paint(c, B, cov, res, tex_path)
    # ---- look v2: strand cards over the hair volume, lashes, brows, beard (one extra mesh, gh_<id>) ----
    gh = look2.hair_cards(c, B, cov, parts, ex) if look2.ON else None
    # ---- rig + weights + one material ----
    arm = BC.build_armature(c["id"], B.J)
    CUR_B[0] = B
    if look2.ON:
        look2.add_bones(arm, B, B._eyes)
        # fix round 1: run-time skin values of this build (skin.js azLook): the scatter tint and the lips' roughness
        _m = json.loads(arm["look"])
        for _k in ("skinScatter", "lipRough", "shellSheen"):      # (fix round 3: shellSheen)
            if c.get(_k) is not None:
                _m[_k] = float(c[_k])
        arm["look"] = json.dumps(_m)
    for o in parts + cloth + gx + ([gh] if gh else []):
        apply_weights(o, arm)
    if c.get("aoFace"):
        ao_relief(parts[0], B, c)
    if look2.ON and budget(c) >= 16000 and os.environ.get("HEAD_SUBDIV", "1") != "0":
        subdivide_head(parts[0], B)       # proto:makehuman: smooth face silhouettes on the hero (pack lands the budget)
        for o_ in parts[1:]:
            if o_.name.split(".")[0] == "beardshell":
                subdivide_head(o_, B, shell=True)     # (Kai v3: a round beard silhouette)
    if gh:
        gh.data.materials.clear()
        gh.data.materials.append(look2.hair_material(c, look2.strand_texture(os.path.join(tex_dir, "az_strands.png"))))
        arm["hair_cards"] = gh.name
    mat = atlas_material(c, tex)
    for o in (gk["props"] if gk else []):
        o.data.materials.clear()
        o.data.materials.append(mat)
    if gk:
        gadgets.armature_meta(arm, gk["meta"])
    for o in parts + cloth:
        o.data.materials.clear()
        o.data.materials.append(mat)
        if not o.data.uv_layers:
            o.data.uv_layers.new(name="UVMap")
        if not o.data.attributes.get("_mask"):
            set_mask(o, (0, 0, 0))

    def join(objs):
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        return objs[0]
    mesh = join(parts)
    mesh.name = c["id"] + "_mesh"
    cloth_tris = sum(len(p.vertices) - 2 for o in cloth + gx for p in o.data.polygons)
    decimate_protected(mesh, B, budget(c) - cloth_tris if costume_mode else budget(c), face_keep=0.75 if budget(c) <= 9000 else 1.0,
                       tex=tex["base"] if costume_mode and tex else None, hero=budget(c) >= 16000, costume=costume_mode)
    if cloth:
        mesh = join([mesh] + cloth)
        print("  + cloth", cloth_tris, "tris", flush=True)
    arm["character"] = c["id"]
    # read by compress_cast.sh / simplify_cast.mjs (final triangle budget, crowd low LOD) and by the runtime
    # (cast3d.js: `stature` is the standing body height without hats, hoods, props or raised hands, for scaling)
    arm["tris_budget"] = int(budget(c))
    if budget(c) <= 9000:
        arm["lod_tris"] = 6000
    arm["stature"] = float(c.get("metres") or round(float(B.P[:, 1].max() - B.P[:, 1].min()), 3))
    AUX_MODE[0] = False
    return arm, mesh


def ao_relief(o, B, c):
    """fix round 3 (a face file's `aoFace`, Kai): per skin vertex, the share of the baked ambient occlusion that
    pack_cast2.mjs removes (`_aor`, 0 = unchanged; the other joined parts carry 0): the nose's side walls, the
    nasolabial folds and the under-eye crescent, where the bake's 6 cm rays darkened a full, round face into a gaunt,
    contoured one (narrow bridge, deep grooves, hard bags). aoFace: {"nose": .., "fold": .., "underEye": ..} = the
    occlusion kept there (0.6 = 40 % less)."""
    if o.name.split(".")[0] != "skin":
        return
    cfg = c["aoFace"]
    P = from_bl_np(obj_world_verts(o))
    LK = likeness_look.load(c, B)
    q = LK.mm(P) if LK is not None else (P - B.L.eye) * 1000.0
    ax_, y = np.abs(q[:, 0]), q[:, 1]
    front = ss(-30.0, -15.0, q[:, 2])
    nose = ss(3.0, 8.0, ax_) * ss(25.0, 18.0, ax_) * ss(-2.0, -10.0, y) * ss(-48.0, -38.0, y)
    a_, b_ = np.array([17.0, -36.0]), np.array([33.0, -70.0])
    ab = b_ - a_
    t_ = np.clip(((ax_ - a_[0]) * ab[0] + (y - a_[1]) * ab[1]) / (ab @ ab), 0, 1)
    dd = np.hypot(ax_ - (a_[0] + t_ * ab[0]), y - (a_[1] + t_ * ab[1]))
    fold = ss(9.0, 3.0, dd)
    ue = g2(((ax_ - 32.0) / 17.0) ** 2 + ((y + 13.0) / 8.0) ** 2, 1.0)
    red = np.maximum.reduce([(1 - float(cfg.get("nose", 1.0))) * nose, (1 - float(cfg.get("fold", 1.0))) * fold,
                             (1 - float(cfg.get("underEye", 1.0))) * ue]) * front
    a = o.data.attributes.get("_aor") or o.data.attributes.new("_aor", "FLOAT", "POINT")
    a.data.foreach_set("value", np.clip(red, 0, 1).astype(np.float32))
    print(f"  ao relief: {int((red > 0.05).sum())} vertices, max {red.max():.2f}", flush=True)


def subdivide_head(o, B, shell=False):
    """proto:makehuman: one smoothed subdivision step of the visible head skin (face, ears, neck under the jaw; not the
    scalp under the hair, not the mouth bag), after the weights are written as vertex groups (bmesh interpolates them,
    the uvs and the shading mask). The base mesh is too coarse for a close-up silhouette (faceted jaw, cheek, ears);
    pack_cast2.mjs then lands the HD and phone head budgets on the denser surface."""
    if o.name.split(".")[0] != ("beardshell" if shell else "skin"):
        return
    me = o.data
    if shell:       # Kai v3: the beard shell, every face once (smooth)
        bm = bmesh.new()
        bm.from_mesh(me)
        n0 = len(bm.faces)
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1, use_grid_fill=True, smooth=1.0, use_smooth_even=True)
        bm.to_mesh(me)
        bm.free()
        for p_ in me.polygons:
            p_.use_smooth = True
        me.update()
        print(f"  beard shell subdivided: {n0} -> {len(me.polygons)} faces", flush=True)
        return
    hc = B.L.eye + np.array([0.0, 0.0, -0.06])
    msk = np.zeros(len(me.vertices) * 3)
    a = me.attributes.get("_mask")
    if a is not None:
        a.data.foreach_get("vector", msk)
    msk = msk.reshape(-1, 3)
    P = from_bl_np(obj_world_verts(o))
    neck_y = B.Jm["neck"][1] - 0.01
    vin = (np.linalg.norm(P - hc, axis=1) < 0.15) & (P[:, 1] > neck_y) & (msk[:, 2] < 0.5) & (P[:, 2] > B.L.lip_z - 0.035 - 0.2)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    mouthz = B.L.lip_z - 0.006
    sel = set()
    for f in bm.faces:
        vs = [v.index for v in f.verts]
        if all(vin[i] for i in vs):
            # the mouth bag stays as it is (its rims carry the topological jaw split)
            cz = np.mean([P[i, 2] for i in vs]); cy = np.mean([P[i, 1] for i in vs]); cx = np.mean([P[i, 0] for i in vs])
            if cz < mouthz and abs(cx) < B.L.lip_w * 1.1 and abs(cy - B.L.mouth[1]) < 0.03 and cz > B.L.lip_z - 0.12:
                continue
            sel.add(f.index)
    edges = {e for i in sel for e in bm.faces[i].edges}
    n0 = len(bm.faces)
    bmesh.ops.subdivide_edges(bm, edges=list(edges), cuts=1, use_grid_fill=True, smooth=1.0, use_smooth_even=True)
    bm.to_mesh(me)
    bm.free()
    for p_ in me.polygons:
        p_.use_smooth = True
    me.update()
    print(f"  head subdivided: {len(sel)} faces -> {len(me.polygons) - n0 + len(sel)} ({len(me.polygons)} polys)", flush=True)


def select_class(mesh, cls, which):
    """Select one decimation class; open borders (garment hems, hairline, boot tops, collars) stay unselected so the
    collapse never touches them (they keep their smooth snapped shape)."""
    bm = bmesh.from_edit_mesh(mesh.data)
    keep = bm.verts.layers.float.get("_keep")
    # a garment border carries a rim strip (hem thickness): the visible edge is then one ring inside the open
    # boundary, so the faces on the rim and on the hem loop (`_hem`, layer_object) stay (no ragged hems); hide cuts
    # under an outer garment are invisible and only keep their boundary vertices
    hem = bm.verts.layers.float.get("_hem")
    ring = set(v for v in bm.verts if v[hem] > 0.5) if hem is not None else set()
    for f in bm.faces:
        f.select_set(cls(f, bm) == which and not (keep is not None and any(v[keep] > 0.5 for v in f.verts))
                     and not any(v in ring for v in f.verts))
    bm.select_flush_mode()
    for e in bm.edges:
        if e.is_boundary:
            for v in e.verts:
                v.select_set(False)
    bmesh.update_edit_mesh(mesh.data)


def fix_uv_stretch(mesh):
    """After decimation: a face whose corners landed on two atlas islands (an edge collapse across a uv seam) samples
    a stretch of unrelated texels (skin on a coat). Each such corner takes the uv it has in a neighbouring face so the
    face's uvs are coherent again (the combination with the smallest uv spread)."""
    import itertools
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    uvl = bm.loops.layers.uv.active
    fixed = 0
    if uvl is not None:
        for f in bm.faces:
            ls = list(f.loops)
            uv = [l[uvl].uv.copy() for l in ls]
            span = max((a - b).length for a, b in itertools.combinations(uv, 2))
            size = max(e.calc_length() for e in f.edges)
            if span < 0.03 or span < 6 * size:
                continue
            cand = []
            for l in ls:
                cs = [l[uvl].uv.copy()]
                for l2 in l.vert.link_loops:
                    u2 = l2[uvl].uv
                    if all((u2 - c).length > 1e-6 for c in cs):
                        cs.append(u2.copy())
                cand.append(cs[:4])
            best, bs = None, span
            for combo in itertools.product(*cand):
                sp = max((a - b).length for a, b in itertools.combinations(combo, 2))
                if sp < bs - 1e-6:
                    best, bs = combo, sp
            if best is not None:
                for l, u in zip(ls, best):
                    l[uvl].uv = u
                fixed += 1
    bm.to_mesh(mesh.data)
    bm.free()
    return fixed


def feature_group(mesh, tex_path):
    """Vertex group 'feat': 1 on vertices whose edges cross a painted feature of the atlas (stripes, panels, LED
    piping, seams, hems). The collapse slides texture coordinates along the surface, so plain cloth is decimated
    first and printed detail keeps its triangles (no zigzag stripes, no torn panel edges)."""
    from PIL import Image
    img = np.asarray(Image.open(tex_path).convert("RGB")).astype(np.float32) / 255.0
    res = img.shape[0]
    me = mesh.data
    nl = len(me.loops)
    if not me.uv_layers or nl == 0:
        return None
    uv = np.zeros(nl * 2)
    me.uv_layers.active.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    lv = np.zeros(nl, int)
    me.loops.foreach_get("vertex_index", lv)
    ls = np.zeros(len(me.polygons), int)
    lt = np.zeros(len(me.polygons), int)
    me.polygons.foreach_get("loop_start", ls)
    me.polygons.foreach_get("loop_total", lt)
    a = np.concatenate([ls + i for i in range(4)])
    tot = np.concatenate([lt for _ in range(4)])
    st = np.concatenate([ls for _ in range(4)])
    idx = np.concatenate([np.full(len(ls), i) for i in range(4)])
    ok = idx < tot
    a, st, tot, idx = a[ok], st[ok], tot[ok], idx[ok]
    b = st + (idx + 1) % tot
    ts = np.linspace(0, 1, 7)
    U = uv[a][:, None, :] * (1 - ts[None, :, None]) + uv[b][:, None, :] * ts[None, :, None]
    px = np.clip((U[..., 0] * res).astype(int), 0, res - 1)
    py = np.clip(((1 - U[..., 1]) * res).astype(int), 0, res - 1)
    C = img[py, px]                                   # edges x samples x rgb
    d = np.abs(np.diff(C, axis=1)).sum(2).max(1)      # strongest step along the edge
    w = np.clip((d - 0.08) / 0.17, 0, 1)
    wv = np.zeros(len(me.vertices), np.float32)
    np.maximum.at(wv, lv[a], w)
    np.maximum.at(wv, lv[b], w)
    if me.attributes.get("_hand"):
        hand = np.zeros(len(me.vertices), np.float32)
        me.attributes["_hand"].data.foreach_get("value", hand)
        wv = np.maximum(wv, 0.85 * hand)
    vg = mesh.vertex_groups.new(name="feat")
    for v in np.nonzero(wv > 0.01)[0]:
        vg.add([int(v)], float(wv[v]), "REPLACE")
    mesh.vertex_groups.active_index = vg.index
    return float((wv > 0.5).mean())


DEC_DBG = []


def split_uv_seams(mesh):
    """Cut the mesh open along its atlas island borders before the collapse: open borders are never collapsed
    (select_class), so no triangle can end up spanning two islands (a smear of skin or of another garment's
    texels across a coat). The cut vertices are tagged `_seam` and welded back after the collapse."""
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    uvl = bm.loops.layers.uv.active
    if uvl is None:
        bm.free()
        return 0
    seams = []
    for ed in bm.edges:
        if len(ed.link_faces) != 2:
            continue
        uvs = []
        for f in ed.link_faces:
            m = {l.vert.index: l[uvl].uv.copy() for l in f.loops if l.vert in ed.verts}
            uvs.append(m)
        if any((uvs[0][v.index] - uvs[1][v.index]).length > 1e-5 for v in ed.verts):
            seams.append(ed)
    sl = bm.verts.layers.int.get("_seam") or bm.verts.layers.int.new("_seam")
    for ed in seams:
        for v in ed.verts:
            v[sl] = 1
    if seams:
        bmesh.ops.split_edges(bm, edges=seams)
    bm.to_mesh(mesh.data)
    bm.free()
    return len(seams)


def protect_uv_seams(mesh):
    """Atlas island borders get full weight in the 'feat' group: the collapse keeps them (a collapse across a border
    leaves a triangle that samples two islands - skin smeared across a coat)."""
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    uvl = bm.loops.layers.uv.active
    vs = set()
    if uvl is not None:
        for ed in bm.edges:
            if len(ed.link_faces) != 2:
                continue
            f0, f1 = ed.link_faces
            for v in ed.verts:
                a = next(l[uvl].uv for l in f0.loops if l.vert == v)
                b = next(l[uvl].uv for l in f1.loops if l.vert == v)
                if (a - b).length > 1e-5:
                    vs.add(v.index)
    bm.free()
    vg = mesh.vertex_groups["feat"]
    for i in vs:
        vg.add([i], 1.0, "REPLACE")
    return len(vs)


def join_uv_seams(mesh):
    """Weld the vertices split by split_uv_seams (they never moved) so the shading stays smooth across the seam."""
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    sl = bm.verts.layers.int.get("_seam")
    if sl is not None:
        vs = [v for v in bm.verts if v[sl]]
        bmesh.ops.remove_doubles(bm, verts=vs, dist=1e-6)
        bm.verts.layers.int.remove(sl)
    bm.to_mesh(mesh.data)
    bm.free()


def decimate_protected(mesh, B, target, face_keep=1.0, tex=None, hero=False, costume=False):
    """Full density on the face (eyes, lids, lips, nose), less on the rest of the head, the body takes the rest.
    costume=True (the costume pipeline): no collapse here unless BLENDER_DEC=1 (simplify_cast.mjs lands the budget);
    only the cleanup (uv clamp, helper attributes removed) runs."""
    use = not costume or os.environ.get("BLENDER_DEC")
    feat = feature_group(mesh, tex) if tex and use else None
    vgk = dict(use_vertex_group=True, invert_vertex_group=True, vertex_group_factor=float(os.environ.get("FEATF", "2.5"))) if feat is not None else {}
    e = to_bl(B.L.eye)
    hc = to_bl(B.L.eye + np.array([0, 0.02, -0.08]))

    def cls(f, bm=None):
        # hands (bare or gloved) are their own class: a collapse driven by the body ratio turns the fingers into a cone
        hl = bm.verts.layers.float.get("_hand") if bm is not None else None
        if hl is not None and min(v[hl] for v in f.verts) > 0.5:
            return "hand"
        p = f.calc_center_median()
        d = p - e
        if d.y < 0.03 and -0.13 < d.z < 0.075 and abs(d.x) < 0.075:
            return "face"
        if (p - hc).length < 0.2 and p.z > B.J["neck"].z - 0.02:
            return "head"
        return "body"
    nseam = 0      # (cutting the seams open pinned them and the collapse folded the cloth between them: holes)
    if feat is not None and not os.environ.get("NOSEAM"):
        protect_uv_seams(mesh)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.mode_set(mode="EDIT")

    def counts():
        bm = bmesh.from_edit_mesh(mesh.data)
        kl = bm.verts.layers.float.get("_keep")
        n = {"face": 0, "head": 0, "body": 0, "hand": 0}
        kept = 0
        for f in bm.faces:
            if kl is not None and any(v[kl] > 0.5 for v in f.verts):
                kept += len(f.verts) - 2
            else:
                n[cls(f, bm)] += len(f.verts) - 2
        return n, kept
    n, kept = counts()
    target = max(target - kept, 2000)          # protected cloth tails are not decimated
    total = sum(n.values())
    # costume builds leave the collapse to simplify_cast.mjs (meshoptimizer, attribute-aware, borders and uv seams
    # locked): Blender's collapse left stray dark triangles on faces and faceted ears; BLENDER_DEC=1 brings it back
    if total > target and use and not os.environ.get("NODEC"):
        crowd = face_keep < 1.0       # crowds / children (budget <= 9000): seen from further away, many on screen at once
        face_min = float(os.environ.get("CROWD_FACEK", "0.23")) if crowd else (0.4 if hero else 0.34)
        head_k = 0.6 if target >= 15000 else 0.36 if not crowd else 0.3
        hand_k = 0.36 if hero else (0.3 if not crowd else float(os.environ.get("CROWD_HANDK", "0.19")))   # fingers stay fingers (they are seen in every gesture)
        for _ in range(24):      # the body (and its garments) must not drop below ~30 %: spikes and chords appear
            body_k = (target - n["face"] * face_keep - n["head"] * head_k - n["hand"] * hand_k) / max(n["body"], 1)
            if body_k >= 0.3:
                break
            head_k = max(0.2, head_k * 0.88)
            face_keep = max(face_min, face_keep * 0.94)
        body_k = max(body_k, float(os.environ.get("BODYK", os.environ.get("CROWD_BODYK", "0.36") if crowd else "0.42")))     # below this the collapse folds and smears the cloth (holes, stretched texels)
        hand_k = min(hand_k, 0.5)
        for which, ratio in (("body", body_k), ("hand", hand_k), ("head", head_k), ("face", face_keep)):
            if ratio >= 0.999:
                continue
            select_class(mesh, cls, which)
            bpy.ops.mesh.decimate(ratio=float(np.clip(ratio, 0.05, 1.0)), **(vgk if which == "body" else {}))
        n2, _ = counts()
        DEC_DBG[:] = [n2, dict(body=round(body_k, 2), hand=round(hand_k, 2), head=round(head_k, 2), face=round(face_keep, 2))]
        tot2 = sum(n2.values())
        if tot2 > target * 1.01:   # land on the budget: the body takes the overshoot
            select_class(mesh, cls, "body")
            bpy.ops.mesh.decimate(ratio=float(np.clip((n2["body"] - (tot2 - target)) / max(n2["body"], 1), 0.85, 1.0)), **vgk)
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    if nseam and not os.environ.get("NOJOIN"):
        join_uv_seams(mesh)
    nfix = fix_uv_stretch(mesh)
    if mesh.data.uv_layers:     # a collapse can push a corner a hair outside the atlas: 0..1 keeps texcoords quantizable
        uvd = mesh.data.uv_layers.active.data
        uv = np.zeros(len(uvd) * 2)
        uvd.foreach_get("uv", uv)
        uvd.foreach_set("uv", np.clip(uv, 0.0, 1.0))
    if nfix:
        print("  uv seam faces repaired:", nfix, flush=True)
    for an in ("_keep", "_hem", "_hand"):
        if mesh.data.attributes.get(an):
            mesh.data.attributes.remove(mesh.data.attributes[an])
    if feat is not None:
        mesh.vertex_groups.remove(mesh.vertex_groups["feat"])
        print("  feature-protected vertices %.0f %%" % (feat * 100), flush=True)
    print("  decimate", c_id(mesh), n, "->", sum(len(p.vertices) - 2 for p in mesh.data.polygons), "tris (target", target, ")", DEC_DBG, flush=True)


def c_id(mesh):
    return mesh.name.replace("_mesh", "")


def atlas_material(c, tex):
    """One material per character: the atlas (+ a normal map and an emissive map for costumes). glTF export:
    baseColorTexture, normalTexture, emissiveTexture with emissiveFactor 1 (three.js: map, normalMap, emissiveMap)."""
    tex = tex if isinstance(tex, dict) else dict(base=tex)
    m = bpy.data.materials.new(c["id"] + "_atlas")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    im = nt.nodes.new("ShaderNodeTexImage")
    im.image = bpy.data.images.load(tex["base"])
    nt.links.new(im.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.82
    if tex.get("normal"):
        nm = nt.nodes.new("ShaderNodeTexImage")
        nm.image = bpy.data.images.load(tex["normal"])
        nm.image.colorspace_settings.name = "Non-Color"
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nm.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    if tex.get("rough"):        # look v2: glTF metallicRoughness (G roughness; R carries the cavity occlusion)
        rm = nt.nodes.new("ShaderNodeTexImage")
        rm.image = bpy.data.images.load(tex["rough"])
        rm.image.colorspace_settings.name = "Non-Color"
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(rm.outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
        nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
    if tex.get("emissive"):
        em = nt.nodes.new("ShaderNodeTexImage")
        em.image = bpy.data.images.load(tex["emissive"])
        nt.links.new(em.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.0
        m["glow"] = c.get("glow", "")
    m["slot"] = "atlas"
    return m


# ----------------------------------------------------------------------------------------------------------------
def main():
    out = os.path.abspath(sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith(".py") else "out")
    tex_dir = os.path.join(out, "tex")
    os.makedirs(tex_dir, exist_ok=True)
    only = os.environ.get("ONLY")
    BC.clear()
    objs = []
    for c in CAST:
        if only and c["id"] not in only.split(","):
            continue
        arm, mesh = build(c, tex_dir)
        more = [o for o in bpy.context.view_layer.objects if o.parent == arm and o is not mesh]
        objs += [arm, mesh] + more
        print("built", c["id"], sum(len(p.vertices) - 2 for o in [mesh] + more for p in o.data.polygons), "tris", flush=True)
    BC.export(os.path.join(out, "cast.glb"), set(objs), False, attributes=True)
    # reference rig + clips from an average body
    BC.clear()
    P = mh.sculpt(dict(gender=0.5))
    P = P - np.array([0, P[:, 1].min(), 0])
    ref = BC.build_armature("rig", rig_points(P))
    BC.bake_clips(ref, P[:, 1].max())
    BC.export(os.path.join(out, "anims.glb"), {ref}, True)
    print("done ->", out)


if __name__ == "__main__":
    main()
