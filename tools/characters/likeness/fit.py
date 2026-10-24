"""likeness:fit - fit Kai's MakeHuman head to the reference photo (docs/CHARACTER_LOOK.md, "Faces").

    /home/user/tools/likeness-venv/bin/python fit.py [--rounds=4] [--out=../faces_candidates/kai_photo/kai.json]

Inputs (measure.py's output folder, LIKENESS_DIR; private, outside the repo): lifted.npz (photo landmarks in pixels,
camera K, photo head pose), measure.json (frontal ratios, beard notes).

Model: the MakeHuman base mesh with Kai's sex and age (32), a face macro (weight, muscle, African / Asian / European
mix) and ~85 detail modifiers (faces/README.md semantics; every left / right pair is one value, so the head stays
symmetric), seen through the photo's camera (EXIF focal length) under a free similarity pose (rotation, translation,
scale about the eye midpoint).

Correspondences (analysis by synthesis): MediaPipe Face Mesh runs on a render of the current head at the photo's pose
(raster.py: a bald, beardless clay portrait with painted brows, lips and irises) and every one of its 478 points is
traced back onto the mesh (triangle + barycentrics). The same detector on the photo and on the render means every
landmark has the same definition on both. `mp_to_mh.json` (next to this file) is the table for the neutral head in a
frontal and the photo's view; the fit refreshes the photo-view table every round (the outline points slide over the
surface as the shape changes), so the fit converges to a head whose render the detector reads like the photo.

Residuals (mm on the face, from pixels / (f / depth)):
  - interior landmarks (eyes, nose, lips, brows, iris centres, midline; cheeks and forehead with a low weight): the
    2D distance between the projected mesh point and the photo point;
  - the face outline (MediaPipe's oval): the distance along the photo outline's normal only (silhouette points slide
    along it). Below the cheekbones the photo outline is the beard's surface: the target is moved inward by the beard
    thickness (8 mm under the chin, 5 mm on the jaw, 4 mm at the sideburn, measure.json notes), so the skin is fitted;
  - brows: the photo's slight frown (brows drawn down and together, measure.json notes) is undone (targets moved up
    1.5-3 mm, medial ends 1 mm apart) before projecting;
  - depth: MediaPipe's relative depth of the lifted nose, lips, brows and cheek points along the camera ray (relative
    to the inner eye corners, scale-free), weight 0.2: one view from above hardly separates a nose's depth from its
    length, this keeps the profile honest;
  - frontal proportions (pose-free ratios of measure.json: eye spacing / eye width, nose / intercanthal, mouth / nose,
    lower / upper lip, canthal tilt) on the model's frontal landmarks, as soft terms;
  - priors: details toward 0 (more weight on modifiers that change the whole head, on depth-only terms and on what the
    frown or the beard hides) with a soft wall past |0.7|, macro toward a South Asian man of a solid build, the pose
    toward measure.py's, the size (scale) and the camera distance held to the iris measurement.
Not fitted (look keys, not shape, in the game): the iris centres (he looks up into the lens), the painted brow height
(build_humans paints brows at fixed offsets from the eye centres: reported as render_above_photo_mm -> browLift) and
the lip outline height (painted from the contact line; the outline counts with a low weight).
Check in the shipping pipeline: game_compare.py (builds Kai from the face file, face_studio's 'photo' view).
Outputs (LIKENESS_DIR): fit_overlay.png (the fitted head's landmarks and silhouette over the photo), fit_compare.png
(photo | clay render at the photo's pose | overlay, and the frontal photo against the fitted head's frontal render),
fit.json (parameters, residuals per region per round); the face file (FACES_DIR candidate).
"""
import json
import os
import sys
import time
from functools import lru_cache

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CHAR = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, CHAR)
os.environ.setdefault("CAST", "nrzero")
os.environ.setdefault("MH_DATA", "/home/user/tools/mh/makehuman/data")

import mh  # noqa: E402
import face_metric as fmx  # noqa: E402
import raster  # noqa: E402

LK = os.environ.get("LIKENESS_DIR", "/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/feel/faces/likeness")
PHOTO = os.environ.get("KAI_PHOTO", "/home/user/tools/kai_ref/kai_ref.jpg")
OUT = os.environ.get("FIT_OUT", LK)          # fit.json, fit/x.npy and the pictures (v3: likeness/v3/fit/work)
# v3 (the owner's three 2026 photos, docs/CHARACTER_LOOK.md "Kai v3"): measure.py's folder holds fit_inputs_front.json
# (the photo's size, which corrections are off for a photo at rest, the skin's inset under the beard per oval point)
CFG_PATH = os.path.join(LK, "fit_inputs_front.json")
CFG = json.load(open(CFG_PATH)) if os.path.exists(CFG_PATH) else {}
PHOTO_WH = tuple(CFG.get("photo_size", (3121, 6528)))
AT_REST = CFG.get("corrections_OFF_for_this_photo", {}).get("frown_undo") is False      # no frown to undo, lids at rest
FIT_EARS = os.environ.get("LIKENESS_EARS", "1" if CFG else "0") == "1"                 # the side photos see the ears
YEARS, METRES = 32, 1.83
SA = dict(caucasian=0.55, asian=0.25, african=0.2)      # cast_nrzero.SA (South Asian)

# ---------------------------------------------------------------------------------------------------------------
# MediaPipe index groups
# ---------------------------------------------------------------------------------------------------------------
def _conn():
    from mediapipe.python.solutions import face_mesh_connections as C
    s = lambda c: sorted({i for e in c for i in e})      # noqa: E731
    return dict(eye_l=s(C.FACEMESH_LEFT_EYE), eye_r=s(C.FACEMESH_RIGHT_EYE), brow_l=s(C.FACEMESH_LEFT_EYEBROW),
                brow_r=s(C.FACEMESH_RIGHT_EYEBROW), lips=s(C.FACEMESH_LIPS), oval=s(C.FACEMESH_FACE_OVAL),
                nose=s(C.FACEMESH_NOSE))


OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149,
        150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
MIDLINE = [151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 11, 12, 13, 14, 15, 16, 17]
NOSE_X = [129, 358, 98, 327, 48, 278, 64, 294, 102, 331, 49, 279, 115, 344, 220, 440, 45, 275, 4, 5, 195, 197, 6, 1, 2, 94, 19]
LIP_OUT_UP = [185, 40, 39, 37, 0, 267, 269, 270, 409]
CHIN_IN = [18, 200, 199, 175, 152, 171, 396, 208, 428, 32, 262, 140, 369, 170, 395, 211, 431, 169, 394, 135, 364, 138, 367, 83, 313, 201, 421, 194, 418]


def groups():
    c = _conn()
    G = dict(eyes=c["eye_l"] + c["eye_r"], brows=c["brow_l"] + c["brow_r"], iris=[468, 473], lips=c["lips"],
             nose=sorted(set(c["nose"]) | set(NOSE_X)), oval=OVAL, midline=MIDLINE)
    used = set().union(*map(set, G.values()))
    G["chin_beard"] = [i for i in CHIN_IN if i not in used]
    used |= set(G["chin_beard"])
    G["other"] = [i for i in range(468) if i not in used]
    return G


W_REGION = dict(eyes=1.0, brows=0.1, iris=0.0, lips=0.8, nose=1.0, midline=0.8, oval=1.0, chin_beard=0.15, other=0.22)

# ---------------------------------------------------------------------------------------------------------------
# parameters
# ---------------------------------------------------------------------------------------------------------------
SKIP = ("head-trans-", "nose-trans-in|out", "mouth-trans-in|out", "-eye-push", "mouth-dimples", "head-angle-in|out")
GROUPS_FIT = ("head/", "forehead/", "eyebrows/", "eyes/", "nose/", "mouth/", "chin/", "cheek/", "neck/neck-double")


# v3: the ear's place, size, tilt and stand-off (the side photos measure the ear; FIT_EARS)
EAR_FIT = ("ear-trans-backward|forward", "ear-trans-down|up", "ear-scale-decr|incr", "ear-scale-vert-decr|incr",
           "ear-rot-backward|forward", "ear-wing-decr|incr", "ear-lobe-decr|incr")


def detail_params():
    """[(name, [modifier keys])]: one value per symmetric pair (l- and r- together)."""
    out, seen = [], set()
    for k in mh.list_modifiers():
        ear = FIT_EARS and k.startswith("ears/") and k.split("/")[1][2:] in EAR_FIT
        # v3: the side photos see the eye's depth (the old single view could not: eye-push was skipped)
        skip = tuple(s for s in SKIP if not (FIT_EARS and s == "-eye-push"))
        if not (k.startswith(GROUPS_FIT) or ear) or any(s in k for s in skip) or k in seen:
            continue
        g, n = k.split("/")
        if n.startswith(("l-", "r-")):
            other = g + "/" + ("r-" if n.startswith("l-") else "l-") + n[2:]
            out.append((g + "/" + n[2:], [k, other]))
            seen |= {k, other}
        else:
            out.append((k, [k]))
            seen.add(k)
    return out


# prior strength per detail (larger = held closer to 0): whole-head shape modifiers and the age term cost more
def prior_w(name):
    if name.startswith("head/head-scale-"):
        return 3.5
    if name.startswith("head/head-") and not name.endswith(("fat-decr|incr", "round", "square")):
        return 5.0
    if "age" in name:
        return 8.0
    if name in ("eyebrows/eyebrows-trans-down|up", "chin/chin-cleft-decr|incr", "mouth/mouth-laugh-lines-in|out", "mouth/mouth-angles-down|up",
                "nose/nose-scale-depth-decr|incr", "nose/nose-trans-backward|forward", "eyebrows/eyebrows-trans-backward|forward",
                "forehead/forehead-trans-backward|forward", "mouth/mouth-trans-backward|forward", "chin/chin-prognathism-decr|incr"):
        return 5.0          # the frown (brows down, folds, mouth corners), the chin under the beard, and depth-only terms
                            # (one view from above hardly separates depth from height): the photo says little
    if name.startswith("neck/"):
        return 4.0
    return 2.5


MACRO_KEYS = ("weight", "muscle", "african", "asian")
MACRO_INIT = dict(weight=0.6, muscle=0.58, african=SA["african"], asian=SA["asian"])
MACRO_PRIOR = dict(weight=(0.6, 0.08), muscle=(0.58, 0.1), african=(0.2, 0.12), asian=(0.25, 0.12))
MACRO_BOUNDS = dict(weight=(0.42, 0.72), muscle=(0.4, 0.78), african=(0.0, 0.45), asian=(0.05, 0.5))


def macro_dict(m, height=0.59):
    af, asn = m["african"], m["asian"]
    return dict(gender=1.0, age=fmx.mh_age(YEARS), muscle=m["muscle"], weight=m["weight"], height=height, proportions=0.72,
                african=af, asian=asn, caucasian=max(0.0, 1.0 - af - asn))


def solve_height(macro, details):
    body = mh.group_vertices("body")
    lo, hi = 0.0, 1.0
    for _ in range(10):
        h = (lo + hi) / 2
        P = mh.sculpt(dict(macro, height=h), details)
        if P[body, 1].max() - P[body, 1].min() < METRES:
            lo = h
        else:
            hi = h
    return round((lo + hi) / 2, 4)


class Model:
    """Head vertices as a fast function of (macro, details): macro sculpts are cached, details are linear per sign."""

    def __init__(self, P_ref, wide=False):
        self.S = raster.head_scene(P_ref)
        self.hv = self.S.verts                          # head vertex ids (global)
        if wide:
            # v3: the side photos see the neck under the jaw and the back of the head too (the front render keeps its
            # jaw cut: the detector traces the jaw there)
            self.hv = np.unique(np.r_[self.hv, raster.head_scene(P_ref, neck_drop=0.06, jaw_cut=False).verts])
        self.loc = -np.ones(len(P_ref), np.int64)
        self.loc[self.hv] = np.arange(len(self.hv))
        self.params = detail_params()
        tab = mh.modifier_table()
        n = len(self.params)
        self.Dp = np.zeros((n, len(self.hv), 3))
        self.Dn = np.zeros((n, len(self.hv), 3))
        for j, (_, keys) in enumerate(self.params):
            for k in keys:
                lo, hi = tab[k]
                for rel, D in ((hi, self.Dp), (lo, self.Dn)):
                    t = mh.target(rel) if rel else None
                    if t is None or not len(t[0]):
                        continue
                    idx, d = t
                    m = self.loc[idx] >= 0
                    D[j, self.loc[idx[m]]] += d[m] * 0.1
        self.eyes = [self.loc[np.array(raster.group_exact(g))] for g in ("helper-l-eye", "helper-r-eye")]
        assert all((e >= 0).all() for e in self.eyes)
        self.height = 0.59
        self.prior = np.array([prior_w(nm) for nm, _ in self.params])

    @lru_cache(256)
    def _macro(self, key):
        m = dict(zip(MACRO_KEYS, key))
        P = mh.sculpt(macro_dict(m, self.height))[self.hv]
        return P

    def heads(self, m, d, sub=None):
        P = self._macro(tuple(float(m[k]) for k in MACRO_KEYS))
        c = 0.5 * (P[self.eyes[0]].mean(0) + P[self.eyes[1]].mean(0))       # pose anchor: eye midpoint before details
        dp, dn = np.clip(d, 0, None), np.clip(-d, 0, None)
        if sub is None:
            return P + np.tensordot(dp, self.Dp, 1) + np.tensordot(dn, self.Dn, 1), c
        return P[sub] + np.tensordot(dp, self.Dp[:, sub], 1) + np.tensordot(dn, self.Dn[:, sub], 1), c

    def details(self, d, eps=0.005):
        out = {}
        for (nm, keys), v in zip(self.params, d):
            if abs(v) >= eps:
                for k in keys:
                    out[k] = round(float(v), 3)
        return out

    def full(self, m, d):
        return mh.sculpt(macro_dict(m, self.height), self.details(d, 0.0))


# ---------------------------------------------------------------------------------------------------------------
# camera, pose
# ---------------------------------------------------------------------------------------------------------------
def rodrigues(r):
    th = np.linalg.norm(r)
    if th < 1e-12:
        return np.eye(3)
    k = r / th
    Kx = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + np.sin(th) * Kx + (1 - np.cos(th)) * Kx @ Kx


def rvec(R):
    from scipy.spatial.transform import Rotation
    return Rotation.from_matrix(R).as_rotvec()


def cam_points(X, c, pose):
    r, t, s = pose[:3], pose[3:6], pose[6]
    return (s * (X - c)) @ rodrigues(r).T + t


def proj(K, Xc):
    u = Xc @ K.T
    return u[:, :2] / u[:, 2:3]


# ---------------------------------------------------------------------------------------------------------------
# photo targets
# ---------------------------------------------------------------------------------------------------------------
class Photo:
    def __init__(self):
        z = np.load(os.path.join(LK, "lifted.npz"))
        self.K, self.R, self.t = z["K"], z["R"], z["t"]
        self.pts = z["pts"][:, :2].copy()
        self.Xh = z["Xh"] / 1000.0                       # photo head frame (metres, the scaled template's frame)
        self.eyes_mid = z["eyes_mid"] / 1000.0
        self.M = json.load(open(os.path.join(LK, "measure.json")))
        self.s0 = self.M["camera"]["face_scale_vs_template"]
        self.Xc = self.Xh @ self.R.T + self.t
        self.ppm = self.K[0, 0] / self.Xc[:, 2] / 1000.0  # pixels per mm at each landmark
        self.face = (self.Xh - self.eyes_mid) * 1000.0    # face mm (x = subject's left, y up)
        self.target = self.pts.copy()
        self.cfg = CFG
        self.W, self.H = PHOTO_WH
        if AT_REST:
            self.brow_shift = "none: the photo's brows and lids are at rest (fit_inputs_front.json)"
        else:
            self._brows()
        self._oval()
        # the crop the pictures and the true-silhouette renders use: the face's landmarks padded
        lo, hi = self.pts[:468].min(0), self.pts[:468].max(0)
        sz = hi - lo
        self.box = tuple(int(v) for v in (max(lo[0] - 0.45 * sz[0], 0), max(lo[1] - 0.45 * sz[1], 0),
                                           min(hi[0] + 0.45 * sz[0], self.W), min(hi[1] + 0.35 * sz[1], self.H)))
        if not CFG:
            self.box = (250, 1200, 2950, 4900)

    def _reproj(self, X):
        return proj(self.K, X @ self.R.T + self.t)

    def _brows(self):
        """Undo the frown: brows up 3 mm medially, 1.5 mm laterally, medial ends 1 mm apart, reprojected."""
        G = _conn()
        for side, idx in ((1, G["brow_l"]), (-1, G["brow_r"])):
            x = self.face[idx, 0] * side
            f = np.clip((x - 12) / 45, 0, 1)
            dy = 3.0 - 1.5 * f
            dx = side * 1.0 * (1 - f)
            X = self.Xh[idx].copy()
            X[:, 1] += dy / 1000
            X[:, 0] += dx / 1000
            self.target[idx] = self._reproj(X)
        self.brow_shift = "up 3.0 mm medially -> 1.5 mm laterally, medial ends 1 mm apart"
        # the frown narrows the lids a little: the upper lid margins 0.6 mm up (neutral opening)
        lids = [157, 158, 159, 160, 161, 384, 385, 386, 387, 388, 246, 466]
        X = self.Xh[lids].copy()
        X[:, 1] += 0.0006
        self.target[lids] = self._reproj(X)

    def beard_mm(self, y, idx=None):
        if self.cfg.get("beard_on_outline") and idx is not None:
            # v3: MediaPipe's oval runs inside the beard close to the skin (the front measurement's per-point estimate
            # of the skin's inset from it, 0-2 mm; the beard's surface lies 3-24 mm beyond it)
            tab = {r["mp_index"]: r.get("skin_inset_from_mp_mm_estimate") or 0.0 for r in self.cfg["beard_on_outline"]["rows"]}
            return np.array([float(tab.get(int(i), 0.0)) for i in idx])
        # the low end of measure.json's estimate (6-12 mm under the chin, 4-8 mm on the jaw): the skin is never fitted
        # smaller than he is; the beard pass adds the rest of the volume
        return np.interp(y, [-124, -100, -70, -40, -28], [6.0, 5.0, 4.0, 3.0, 0.0])

    def _oval(self):
        """Outline normals (image, pointing out of the face) and the beard-corrected outline targets."""
        o = np.array(OVAL)
        P = self.pts[o]
        nb = np.roll(P, -1, 0) - np.roll(P, 1, 0)
        n = np.c_[nb[:, 1], -nb[:, 0]]
        n /= np.linalg.norm(n, axis=1, keepdims=True)
        cen = self.pts[[1, 168, 152]].mean(0)
        flip = ((P - cen) * n).sum(1) < 0
        n[flip] *= -1
        self.oval_n = n
        th = self.beard_mm(self.face[o, 1], o)
        self.oval_beard = th
        self.target[o] = P - n * (th * self.ppm[o])[:, None]


# ---------------------------------------------------------------------------------------------------------------
# correspondences: render, detect, trace back
# ---------------------------------------------------------------------------------------------------------------
def crop_for(uv, pad=0.25, scale=0.5, W=None, H=None):
    W, H = (W or PHOTO_WH[0]), (H or PHOTO_WH[1])
    lo, hi = uv.min(0), uv.max(0)
    sz = hi - lo
    lo, hi = np.maximum(lo - sz * pad, 0), np.minimum(hi + sz * pad, [W, H])
    return int(lo[0]), int(lo[1]), int(hi[0]), int(hi[1]), scale


def render_view(P_full, S, K, R, t, crop):
    u0, v0, u1, v1, sc = crop
    Kc = K.copy()
    Kc[0, 2] -= u0
    Kc[1, 2] -= v0
    Kc[:2] *= sc
    Wc, Hc = int((u1 - u0) * sc), int((v1 - v0) * sc)
    img, buf = raster.render(P_full, S, Kc, R, t, Wc, Hc)
    return img, buf, Kc


def trace(buf, S, q):
    """MediaPipe points (render pixels) -> (tri vertex ids (n,3), barycentrics (n,3), on-surface flag)."""
    tid, uvv = buf["tri"], buf["uv"]
    H, W = tid.shape
    fg = np.argwhere(tid >= 0)
    tv, bw, ok = np.zeros((len(q), 3), np.int64), np.zeros((len(q), 3)), np.zeros(len(q), bool)
    for i, (x, y) in enumerate(q[:, :2]):
        xi, yi = int(np.clip(x, 0, W - 1)), int(np.clip(y, 0, H - 1))
        k = tid[yi, xi]
        ok[i] = k >= 0
        if k < 0:
            j = np.argmin(((fg - [yi, xi]) ** 2).sum(1))
            yi, xi = fg[j]
            k = tid[yi, xi]
            x, y = xi + 0.5, yi + 0.5
        tri = S.tris[k]
        a, b, c = uvv[tri]
        T = np.array([[b[0] - a[0], c[0] - a[0]], [b[1] - a[1], c[1] - a[1]]])
        w12 = np.linalg.solve(T, [x - a[0], y - a[1]])
        w = np.clip(np.r_[1 - w12.sum(), w12], 0, 1)
        tv[i], bw[i] = tri, w / w.sum()
    return tv, bw, ok


def detect_render(img):
    import detect
    from PIL import Image
    d = detect.detect(Image.fromarray(raster.to_u8(img)))
    return np.array(d["points"])


def correspond(model, m, d, pose, photo, tag, save=None):
    """Photo-view correspondences of the current head; also returns the detector's points on the render (photo px)."""
    P_full = model.full(m, d)
    Ph, c = model.heads(m, d)
    Pc = np.ones_like(P_full)
    Pc[model.hv] = cam_points(Ph, c, pose)
    # the render takes camera-frame points: identity pose
    uv = proj(photo.K, Pc[model.hv])
    crop = crop_for(uv)
    raster.repaint(model.S, P_full)
    img, buf, Kc = render_view(Pc, model.S, photo.K, np.eye(3), np.zeros(3), crop)
    q = detect_render(img)
    tv, bw, ok = trace(buf, model.S, q)
    u0, v0, _, _, sc = crop
    q_photo = q[:, :2] / sc + [u0, v0]
    if save:
        from PIL import Image
        Image.fromarray(raster.to_u8(img)).save(save)
    return dict(tv=model.loc[tv], bw=bw, ok=ok, q=q_photo, img=img, crop=crop, buf=buf)


def frontal_table(model, m, d, out_json):
    """The correspondence table for the neutral head: frontal view and the photo's view, merged (written once)."""
    P = model.full(m, d)
    f = 3000.0
    K = np.array([[f, 0, 600], [0, f, 700], [0, 0, 1.0]])
    c = 0.5 * (P[mh.group_vertices("helper-l-eye")].mean(0) + P[mh.group_vertices("helper-r-eye")].mean(0))
    R = np.diag([1.0, -1.0, -1.0])        # MH -> camera: image right = the subject's left, y down, z into the scene
    t = -R @ c + [0, 0.02, 0.6]
    raster.repaint(model.S, P)
    img, buf = raster.render(P, model.S, K, R, t, 1200, 1500)
    q = detect_render(img)
    tv, bw, ok = trace(buf, model.S, q)
    from PIL import Image
    Image.fromarray(raster.to_u8(img)).save(os.path.join(OUT, "fit", "neutral_front.png"))
    X = (P[tv] * bw[:, :, None]).sum(1)
    return dict(tv=tv, bw=bw, ok=ok, X=X)


# ---------------------------------------------------------------------------------------------------------------
# residuals
# ---------------------------------------------------------------------------------------------------------------
# depth (along the camera ray, relative to the inner eye corners) of MediaPipe's lifted points: a weak profile constraint
DEPTH = [1, 4, 5, 195, 197, 6, 168, 98, 327, 0, 13, 17, 151, 9, 105, 334, 50, 280, 205, 425, 61, 291, 33, 263]
W_DEPTH = 0.2

RATIOS = ("eye_spacing_en_over_eye_width", "nose_width_over_intercanthal", "mouth_over_nose", "lower_over_upper_lip")


def ratios(X):
    """measure.py's pose-free frontal ratios on MediaPipe-indexed head-frame points (x left, y up)."""
    dx = lambda a, b: abs(X[a, 0] - X[b, 0])          # noqa: E731
    ewR, ewL = np.linalg.norm(X[33] - X[133]), np.linalg.norm(X[263] - X[362])
    sto = (X[13] + X[14]) / 2
    tilt = np.degrees(np.arctan2((X[263, 1] - X[362, 1]) + (X[33, 1] - X[133, 1]), dx(263, 362) + dx(33, 133)))
    return dict(eye_spacing_en_over_eye_width=dx(362, 133) / ((ewR + ewL) / 2), nose_width_over_intercanthal=dx(358, 129) / dx(362, 133),
                mouth_over_nose=dx(291, 61) / dx(358, 129), lower_over_upper_lip=(sto[1] - X[17, 1]) / (X[0, 1] - sto[1]),
                canthal_tilt_deg=tilt)


class Problem:
    def __init__(self, model, photo, G):
        self.model, self.photo, self.G = model, photo, G
        self.np = len(model.params)
        self.w = np.zeros(478)
        self.reg = np.empty(478, object)
        for g, idx in G.items():
            self.w[idx] = W_REGION[g]
            self.reg[idx] = g
        # lips: the game paints the vermilion from the contact line (its height is a look parameter, build_humans.paint),
        # so the shape is fitted on the mouth corners and the contact line; the outer outline counts a little
        import geom
        self.w[sorted(set(geom.LIP_OUT_UP + geom.LIP_OUT_LO) - {61, 291})] = 0.25
        self.w[[2, 94, 19]] = 0.4                        # subnasale and columella: hidden under the nose tip (camera above)
        top = [10, 338, 297, 332, 284, 251, 21, 54, 103, 67, 109, 389, 162]
        self.w[top] = 0.25                               # the forehead outline: MediaPipe's guess under the hair
        self.use = np.nonzero(self.w > 0)[0][:468].tolist() + [468, 473]
        self.oval_k = {i: k for k, i in enumerate(OVAL)}
        r = photo.M["frontal"]["ratios"]
        # v3: the upper vermilion is partly under the moustache (measure: lower / upper 1.24), not a shape ratio
        self.ratio_keys = tuple(k for k in RATIOS if not (CFG and k == "lower_over_upper_lip"))
        self.r_photo = {k: r[k] for k in RATIOS}
        self.r_photo["canthal_tilt_deg"] = photo.M["frontal"]["face_metric_canon"]["photo"]["canthal_tilt_deg"]
        self.w_ratio = 4.0
        self.w_depth = W_DEPTH
        self.pose_sd = (0.015, 0.04)            # the camera distance (m) and the size held to the iris measurement
        self.pose0 = None
        self.d_ref = np.zeros(self.np)          # the details' prior centre (0: MakeHuman's average)
        self.np_pose = 7

    def set_corr(self, corr):
        self.tv, self.bw = corr["tv"], corr["bw"]
        self.sub, inv = np.unique(self.tv, return_inverse=True)
        self.tv_sub = inv.reshape(self.tv.shape)
        use = np.array(self.use)
        self.u_int = np.array([i for i in use if i not in self.oval_k])
        self.u_ov = np.array([i for i in use if i in self.oval_k])
        self.n_ov = self.photo.oval_n[[self.oval_k[i] for i in self.u_ov]]

    def unpack(self, x):
        m = dict(zip(MACRO_KEYS, x[:4]))
        d = x[4:4 + self.np]
        pose = x[4 + self.np:]
        return m, d, pose

    def landmarks(self, x):
        m, d, pose = self.unpack(x)
        Ph, c = self.model.heads(m, d, self.sub)
        X = (Ph[self.tv_sub] * self.bw[:, :, None]).sum(1)
        return X, c, pose[:7]

    def residuals(self, x, parts=False):
        X, c, pose = self.landmarks(x)
        uv = proj(self.photo.K, cam_points(X, c, pose))
        ph = self.photo
        e = (uv - ph.target) / ph.ppm[:, None]                    # mm
        res = np.r_[(e[self.u_int] * self.w[self.u_int, None]).ravel(), (e[self.u_ov] * self.n_ov).sum(1) * self.w[self.u_ov]]
        Zm = cam_points(X, c, pose)[:, 2]
        # scale-free: the model's depths in its own size (/ scale) against the photo's in the measured size (/ face scale)
        dz = ((Zm[DEPTH] - Zm[[133, 362]].mean()) / pose[6] - (ph.Xc[DEPTH, 2] - ph.Xc[[133, 362], 2].mean()) / ph.s0) * 1000.0
        res = np.r_[res, dz * self.w_depth]
        rr = ratios(X)
        rat = np.array([(rr[k] / self.r_photo[k] - 1) / 0.03 for k in self.ratio_keys] + [(rr["canthal_tilt_deg"] - self.r_photo["canthal_tilt_deg"]) / 3.0]) * self.w_ratio * 0.25
        m, d, _ = self.unpack(x)
        pri_d = np.r_[self.model.prior * (d - self.d_ref), 12.0 * np.clip(np.abs(d) - 0.7, 0, None)]    # soft wall past |0.7|
        mp_ = getattr(self, "macro_prior", None) or MACRO_PRIOR
        pri_m = np.array([(m[k] - mp_[k][0]) / mp_[k][1] for k in MACRO_KEYS]) * 0.6
        dp = pose[:7] - self.pose0[:7]
        # the iris gives the size (+-5 %) and the camera distance: scale and depth are held to it, x / y move freely
        pri_p = np.r_[dp[:3] / np.radians(6) * 0.5, dp[3:5] / 0.03 * 0.5, dp[5] / self.pose_sd[0], dp[6] / self.pose_sd[1]]
        if parts:
            return dict(e=e, dz=dz, ratios=rr, rat=rat, pri_d=pri_d, pri_m=pri_m, pri_p=pri_p)
        return np.r_[res, rat, pri_d, pri_m, pri_p]

    def bounds(self):
        lo = [MACRO_BOUNDS[k][0] for k in MACRO_KEYS] + [-1.0] * self.np + [-np.pi] * 3 + [-1, -1, 0.05] + [0.7]
        hi = [MACRO_BOUNDS[k][1] for k in MACRO_KEYS] + [1.0] * self.np + [np.pi] * 3 + [1, 1, 1.5] + [1.4]
        return np.array(lo), np.array(hi)


KEEP_REVIEWED = ("eyes/eye-eyefold-down|up", "eyes/eye-eyefold-angle-down|up", "eyes/eye-bag-decr|incr", "eyes/eye-bag-in|out",
                 "eyes/eye-bag-height-decr|incr",
                 # the brow's place is a look key (browLift: the game paints the brows from the eye centres, so the
                 # detector on the render cannot see this slider move them), the upper lip is under the moustache
                 "eyebrows/eyebrows-trans-down|up", "mouth/mouth-cupidsbow-decr|incr", "mouth/mouth-cupidsbow-width-decr|incr",
                 "mouth/mouth-upperlip-height-decr|incr", "mouth/mouth-upperlip-middle-down|up", "mouth/mouth-philtrum-volume-decr|incr")
HOLD_FIXED = ("eyebrows/eyebrows-trans-down|up",)
MACRO_HOLD_SD = dict(weight=0.03, muscle=0.04, african=0.05, asian=0.05)


class MultiProblem(Problem):
    """v3 (docs/CHARACTER_LOOK.md "Kai v3"): the front photo's terms (Problem, at its own camera: the 478 points, the
    oval with the skin's inset under the beard, the ratios; MediaPipe's depth off: the side photos measure depth) plus
    each side photo at its own camera (views.py): the ear and lateral landmarks and the true silhouette (hair and beard
    taken off by bands), the side cameras refined by a delta held to the bundle's pose covariance. x = macro (4),
    details, the front pose (7), one camera delta (6) per side."""

    def __init__(self, model, photo, G, sides, table, mirror):
        super().__init__(model, photo, G)
        import views
        self.V = views
        self.front = views.Front(photo)
        self.sides = sides
        self.np_pose = 7 + 6 * len(sides)
        self.w_depth = 0.0
        self.pose_sd = (0.05, 0.10)             # the side cameras (chained to this pose) carry the depth and the size
        self.w_slm, self.w_ssil, self.w_spri = 1.0, 1.0, 1.0
        self.lm_pts = [s.lm_points(mirror, table) for s in sides]
        self.sils = [None] * len(sides)
        # the moustache hides the upper vermilion and the philtrum (the front measurement: MediaPipe's Ls sits on the
        # hair's edge): those points on the photo are hair, not his lip
        import geom
        hidden = sorted(set(geom.LIP_OUT_UP) - {61, 291}) + [164, 167, 393, 165, 391, 92, 322]
        self.w[hidden] = np.minimum(self.w[hidden], 0.05)
        # the brows: painted from the eye centres in the render (and in the game, browLift), so their points measure
        # the paint, not the shape; the brow ridge is the side photos' profile
        self.w[G["brows"]] = 0.0
        self.use = np.nonzero(self.w > 0)[0][:468].tolist() + [468, 473]
        # the macro (his body: sex, build, the ancestry mix that shapes the whole body) stays the installed one unless
        # the photos insist: MACRO_PRIOR centred on the start, tight
        self.macro_prior = None

    def set_corr(self, corr, sils=None):
        Problem.set_corr(self, corr)
        if sils is not None:
            self.sils = sils
        loc = self.model.loc
        ids = [self.tv.ravel()]
        self._slm, self._ssil = [], []
        for k, side in enumerate(self.sides):
            L = []
            for nm, (v, w) in self.lm_pts[k].items():
                if nm in self.V.MP_SIDE:
                    # the front photo's own correspondence of that MediaPipe point (refreshed every round): the side
                    # photo measures its depth, the front its x / y
                    i = self.V.MP_SIDE[nm][0 if side.near > 0 else 1]
                    lv, w = self.tv[i], self.bw[i]
                else:
                    lv = loc[v]
                if (lv < 0).any():
                    continue
                o = side.lm[nm]
                sig = np.hypot(o["sigma"], (self.V.EAR_MODEL_SD_MM if nm in self.V.EAR_PICKS else self.V.FACE_MODEL_SD_MM) * side.ppm0)
                L.append((nm, lv, w, o["px"], sig, o["conf"]))
                ids.append(lv)
            self._slm.append(L)
            Sx = []
            sil = self.sils[k]
            if sil is not None:
                for j, pt in enumerate(sil["pts"]):
                    if pt is None:
                        continue
                    lv = loc[pt[0]]
                    if (lv < 0).any():
                        continue
                    Sx.append((j, lv, pt[1]))
                    ids.append(lv)
            self._ssil.append(Sx)
        self.sub = np.unique(np.concatenate([np.asarray(i).ravel() for i in ids]))
        self.tv_sub = np.searchsorted(self.sub, self.tv)
        for L in self._slm:
            for i, e in enumerate(L):
                L[i] = (e[0], np.searchsorted(self.sub, e[1])) + e[2:]
        for k, Sx in enumerate(self._ssil):
            if Sx:
                self._ssil[k] = (np.array([e[0] for e in Sx]), np.searchsorted(self.sub, np.array([e[1] for e in Sx])), np.array([e[2] for e in Sx]))
            else:
                self._ssil[k] = None

    def unpack_sides(self, x):
        n0 = 4 + self.np
        return x[n0:n0 + 7], x[n0 + 7:].reshape(len(self.sides), 6)

    def side_residuals(self, x, parts=False):
        m, d, _ = self.unpack(x)
        pose, deltas = self.unpack_sides(x)
        Ph, c = self.model.heads(m, d, self.sub)
        out, rep = [], []
        for k, side in enumerate(self.sides):
            A, b = side.affine(self.front, pose, c, deltas[k])
            L = self._slm[k]
            lm_rows, lm_rep = [], {}
            if L:
                X = np.array([(Ph[v] * w[:, None]).sum(0) for _, v, w, _, _, _ in L])
                uv, _, _ = self.V.project_affine(side.K, A, b, X)
                for (nm, _, _, px, sig, conf), u in zip(L, uv):
                    e = (u - px) / sig * conf * self.w_slm
                    lm_rows.append(e)
                    lm_rep[nm] = round(float(np.linalg.norm(u - px) / side.ppm0), 2)
            sil_rows, d_mm = [], {}
            Sx = self._ssil[k]
            if Sx is not None:
                j, tv_, bb_ = Sx
                X = (Ph[tv_] * bb_[:, :, None]).sum(1)
                uv, Xc, _ = self.V.project_affine(side.K, A, b, X)
                ppm = side.K[0, 0] / Xc[:, 2]
                dd = ((uv - side.S[j]) * side.n[j]).sum(1) / ppm
                lo, hi, w = side.band[j, 0], side.band[j, 1], side.band[j, 2]
                h = np.where(dd < lo, dd - lo, np.where(dd > hi, dd - hi, 0.0))
                sil_rows = h * w * self.w_ssil
                d_mm = dict(j=j, d=dd)
            pri = side.prior(deltas[k]) * self.w_spri
            out.append(np.r_[np.ravel(lm_rows), sil_rows, pri])
            rep.append(dict(landmarks_mm=lm_rep, sil=d_mm))
        if parts:
            return rep
        return np.concatenate(out) if out else np.zeros(0)

    def residuals(self, x, parts=False):
        if parts:
            return Problem.residuals(self, x, parts=True)
        return np.r_[Problem.residuals(self, x), self.side_residuals(x)]

    def bounds(self):
        lo, hi = Problem.bounds(self)
        dl = np.tile([np.radians(12)] * 3 + [40.0] * 3, len(self.sides))
        return np.r_[lo, -dl], np.r_[hi, dl]


def mirror_map():
    """The base mesh's exact x -> -x vertex map."""
    from scipy.spatial import cKDTree
    V0, _, _ = mh.base()
    dd, j = cKDTree(V0).query(V0 * [-1, 1, 1])
    assert dd.max() < 1e-5
    return j


def side_refresh(model, m, d, x, prob, scenes, want_img=False):
    """Render the current head at each side camera and find its silhouette against the photo's outline samples."""
    import views
    pose, deltas = prob.unpack_sides(x)
    P_full = model.full(m, d)
    Ph, c = model.heads(m, d)
    P = P_full.copy()
    P[model.hv] = Ph
    sils = []
    for side, sc_, dl in zip(prob.sides, scenes, deltas):
        side.delta = dl.copy()
        sils.append(views.silhouette(P, sc_, side, prob.front, pose, c, want_img=want_img))
    return sils


def side_landmarks_uv(prob, x):
    """{tag: {landmark: model pixel}} at each side camera."""
    import views
    m, d, _ = prob.unpack(x)
    pose, deltas = prob.unpack_sides(x)
    Ph, c = prob.model.heads(m, d, prob.sub)
    out = {}
    for k, side in enumerate(prob.sides):
        A, b = side.affine(prob.front, pose, c, deltas[k])
        L = prob._slm[k]
        out[side.tag] = {}
        if L:
            X = np.array([(Ph[v] * w[:, None]).sum(0) for _, v, w, _, _, _ in L])
            uv, _, _ = views.project_affine(side.K, A, b, X)
            out[side.tag] = {e[0]: u for e, u in zip(L, uv)}
    return out


def side_pictures(prob, x, sils, outdir):
    """PRIVATE (photo pixels): per side photo the render's silhouette, the outline samples and the landmarks."""
    import views
    from PIL import Image
    luv = side_landmarks_uv(prob, x)
    for side, sil in zip(prob.sides, sils):
        views.side_overlay(side, sil, luv[side.tag], os.path.join(outdir, f"side_{side.tag}.jpg"))
        if sil.get("img") is not None:
            Image.fromarray(raster.to_u8(sil["img"])).save(os.path.join(outdir, f"render_{side.tag}.png"))


def multi_report(prob, x, corr, sils):
    """The per-photo errors (mm): front regions (the detector on the clay render against the photo), front outline,
    side landmarks, side silhouettes per segment and per stretch of the profile."""
    import views
    out = dict(front=region_report(prob, x, corr["q"]))
    rep = prob.side_residuals(x, parts=True)
    for side, r, sil in zip(prob.sides, rep, sils):
        out[side.tag] = dict(landmarks_mm=r["landmarks_mm"], segments=views.side_parts(side, sil["err"]), profile=views.profile_parts(side, sil["err"]))
    return out


def initial_pose(photo):
    """measure.py's pose (the template scaled by face_scale) about the template's eye midpoint, as main() starts."""
    s0 = photo.M["camera"]["face_scale_vs_template"]
    Pt = mh.sculpt(dict(gender=1.0, age=fmx.mh_age(YEARS), muscle=0.5, weight=0.5))
    ct = 0.5 * (Pt[mh.group_vertices("helper-l-eye")].mean(0) + Pt[mh.group_vertices("helper-r-eye")].mean(0))
    return np.r_[rvec(photo.R), photo.R @ (s0 * ct) + photo.t, s0]


def pose_multi(model, m, d, photo, sides, pose, rounds=2, outdir=None, tag="pose"):
    """The front pose of a fixed head (sliders and any shape layer held; model may be dense_fit.ShapedModel) against all
    three photos, the side cameras held: (prob, x, corr, sils). Every candidate is measured at its own best pose by
    this one rule (the before / after reports)."""
    from scipy.optimize import least_squares
    import views
    G = groups()
    table = json.load(open(os.path.join(HERE, "mp_to_mh.json")))["front"]
    prob = MultiProblem(model, photo, G, sides, table, mirror_map())
    prob.pose0 = np.r_[pose, np.zeros(6 * len(sides))]
    x = np.r_[[m[k] for k in MACRO_KEYS], d, pose, np.zeros(6 * len(sides))]
    n0 = 4 + prob.np
    lo, hi = prob.bounds()
    lo[:n0], hi[:n0] = x[:n0] - 1e-9, x[:n0] + 1e-9
    lo[n0 + 7:], hi[n0 + 7:] = x[n0 + 7:] - 1e-9, x[n0 + 7:] + 1e-9
    x = np.clip(x, lo, hi)
    prob.w_slm = 2.0
    _, c = model.heads(m, d)
    scenes = [views.side_scene(model.full(m, d), prob.front, pose, c) for _ in sides]
    for it in range(rounds + 1):
        corr = correspond(model, m, d, x[n0:n0 + 7], photo, tag, save=os.path.join(outdir, f"render_{tag}.png") if outdir else None)
        sils = side_refresh(model, m, d, x, prob, scenes, want_img=(it == rounds))
        prob.set_corr(corr, sils)
        if it == rounds:
            break
        r = least_squares(lambda p: prob.residuals(np.r_[x[:n0], p]), x[n0:], bounds=(lo[n0:], hi[n0:]), x_scale="jac")
        x[n0:] = r.x
    return prob, x, corr, sils


def main_multi(argv):
    """fit.py --views=front,side1,side2 [--start=FACE.json] [--prior=zero|start] [--rounds=4] [--pose_only]
    [--out=OUT/kai.json]: the multi-view slider fit (v3)."""
    from scipy.optimize import least_squares
    import views
    opt = dict(a[2:].split("=", 1) for a in argv if a.startswith("--") and "=" in a)
    rounds = int(opt.get("rounds", 4))
    tags = [t for t in opt.get("views", "front,side1,side2").split(",") if t != "front"]
    start = opt.get("start", os.path.join(CHAR, "faces", "kai.json"))
    out_face = opt.get("out", os.path.join(OUT, "kai.json"))
    pose_only = "--pose_only" in argv
    os.makedirs(os.path.join(OUT, "fit"), exist_ok=True)
    T0 = time.time()
    face0 = json.load(open(start))
    m = {k: float(face0["macro"][k]) for k in MACRO_KEYS}
    P0 = mh.sculpt(macro_dict(m))
    model = Model(P0, wide=True)
    d = np.zeros(len(model.params))
    for j, (nm, keys) in enumerate(model.params):
        vals = [face0["details"][k] for k in keys if k in face0["details"]]
        if vals:
            d[j] = float(np.mean(vals))
    model.height = solve_height(macro_dict(m), model.details(d, 0.0))
    model._macro.cache_clear()
    G = groups()
    photo = Photo()
    sides = views.load_sides(tags, step=int(opt.get("step", 3)))
    table = json.load(open(os.path.join(HERE, "mp_to_mh.json")))["front"]
    prob = MultiProblem(model, photo, G, sides, table, mirror_map())
    if opt.get("prior", "zero") == "start":
        prob.d_ref = d.copy()
    else:
        # what no photo measures keeps its reviewed value (fix round 2's hooded lid)
        for j, (nm, _) in enumerate(model.params):
            if nm in KEEP_REVIEWED:
                prob.d_ref[j] = d[j]
    if opt.get("macro", "hold") == "hold":
        prob.macro_prior = {k: (m[k], MACRO_HOLD_SD[k]) for k in MACRO_KEYS}
    fixed = [j for j, (nm, _) in enumerate(model.params) if nm in HOLD_FIXED]
    if opt.get("x0"):
        x = np.load(opt["x0"])
        pose = x[4 + len(model.params):4 + len(model.params) + 7]
        dls = x[4 + len(model.params) + 7:]
    else:
        Ph, c = model.heads(m, d)
        s0 = photo.M["camera"]["face_scale_vs_template"]
        Pt = mh.sculpt(dict(gender=1.0, age=fmx.mh_age(YEARS), muscle=0.5, weight=0.5))
        ct = 0.5 * (Pt[mh.group_vertices("helper-l-eye")].mean(0) + Pt[mh.group_vertices("helper-r-eye")].mean(0))
        pose = np.r_[rvec(photo.R), photo.R @ (s0 * ct) + photo.t, s0]
        dls = np.zeros(6 * len(sides))
    prob.pose0 = np.r_[pose, np.zeros(6 * len(sides))]
    x = np.r_[[m[k] for k in MACRO_KEYS], d, pose, dls]
    lo, hi = prob.bounds()
    if pose_only:
        n0 = 4 + prob.np
        lo[:n0] = x[:n0] - 1e-9
        hi[:n0] = x[:n0] + 1e-9
    for j in fixed:
        # tried free: the brow tissue slid down onto the lids to close them (the hooded look), folding the skin
        # over the inner canthi; the lid opening is the eye sliders'
        lo[4 + j], hi[4 + j] = d[j] - 1e-9, d[j] + 1e-9
    if "--free_sides" not in argv:
        # the side cameras stay the bundle's (likeness:sides, solved on surface points): refined against an imperfect
        # head they absorb its shape errors (tried: 14-27 mm, 5-10 deg moves that broke the ear and eye fits)
        n1 = 4 + prob.np + 7
        lo[n1:] = x[n1:] - 1e-9
        hi[n1:] = x[n1:] + 1e-9
    prob.w_slm = float(opt.get("wslm", 2.0))
    prob.w_ssil = float(opt.get("wssil", 1.0))
    x = np.clip(x, lo, hi)
    scenes = [views.side_scene(model.full(m, d), prob.front, pose, model.heads(m, d)[1]) for _ in sides]
    log = dict(start=start, views=["front"] + tags, pose_only=pose_only, rounds=[])
    corr = correspond(model, m, d, x[4 + prob.np:4 + prob.np + 7], photo, "m0", save=os.path.join(OUT, "fit", "render_m0.png"))
    sils = side_refresh(model, m, d, x, prob, scenes)
    prob.set_corr(corr, sils)
    log["before"] = multi_report(prob, x, corr, sils)
    n0 = 4 + prob.np
    for rnd in range(rounds):
        T = time.time()
        prob.set_corr(corr, sils)
        if rnd == 0 or pose_only:     # the pose (and the side cameras) alone first
            rp = least_squares(lambda p: prob.residuals(np.r_[x[:n0], p]), x[n0:], bounds=(lo[n0:], hi[n0:]), x_scale="jac")
            x[n0:] = rp.x
        if not pose_only:
            r = least_squares(prob.residuals, x, bounds=(lo, hi), x_scale="jac", max_nfev=60 if rnd < rounds - 1 else 120, verbose=0)
            x = r.x
        m, d, _ = prob.unpack(x)
        if not pose_only:
            model.height = solve_height(macro_dict(m), model.details(d, 0.0))
            model._macro.cache_clear()
        pose = x[n0:n0 + 7]
        corr = correspond(model, m, d, pose, photo, f"m{rnd + 1}", save=os.path.join(OUT, "fit", f"render_m{rnd + 1}.png"))
        sils = side_refresh(model, m, d, x, prob, scenes, want_img=(rnd == rounds - 1))
        prob.set_corr(corr, sils)
        rep = multi_report(prob, x, corr, sils)
        ent = dict(round=rnd + 1, seconds=round(time.time() - T, 1), cost=round(float(0.5 * (prob.residuals(x) ** 2).sum()), 2),
                   height=model.height, macro={k: round(float(v), 3) for k, v in m.items()},
                   pose=dict(rvec_deg=np.degrees(pose[:3]).round(2).tolist(), t_m=pose[3:6].round(4).tolist(), scale=round(float(pose[6]), 4)),
                   side_deltas={s.tag: np.r_[np.degrees(dl[:3]), dl[3:]].round(2).tolist() for s, dl in zip(sides, prob.unpack_sides(x)[1])},
                   report=rep, biggest_details=sorted(((nm, round(float(v), 3)) for (nm, _), v in zip(model.params, d)), key=lambda a: -abs(a[1]))[:30])
        log["rounds"].append(ent)
        print(f"round {rnd + 1}: cost {ent['cost']:.1f} {ent['seconds']:.0f}s scale {pose[6]:.4f} deltas {ent['side_deltas']}", flush=True)
        for g in ("eyes", "nose", "lips", "oval"):
            print("   front", g, {k: v for k, v in rep["front"][g].items() if k.startswith("detector") and "rms" in k}, flush=True)
        for s in sides:
            print("   ", s.tag, "lm", rep[s.tag]["landmarks_mm"], flush=True)
            print("   ", s.tag, "profile", {k: v["outside_band_median_mm"] for k, v in rep[s.tag]["profile"].items()}, flush=True)
        json.dump(log, open(os.path.join(OUT, "fit_multi.json"), "w"), indent=1)
        np.save(os.path.join(OUT, "fit", "x.npy"), x)
        if not pose_only:
            new = json.load(open(start))
            new["details"] = dict(sorted(model.details(d).items()))
            new["macro"] = dict(new["macro"], **{k: round(float(m[k]), 3) for k in MACRO_KEYS})
            new["macro"]["caucasian"] = round(max(0.0, 1 - new["macro"]["african"] - new["macro"]["asian"]), 3)
            json.dump(new, open(out_face, "w"), indent=1)
    side_pictures(prob, x, sils, os.path.join(OUT, "fit"))
    draw_overlay(prob, x, corr, os.path.join(OUT, "fit_overlay.png"))
    print("done %.0fs" % (time.time() - T0), out_face)
    return prob, x


def brow_up_dir(prob, idx):
    """Image direction (unit, per point) of the photo head's +y axis, scaled so a 1 mm head-frame rise reads 1 mm."""
    ph = prob.photo
    X = ph.Xh[idx]
    a = ph._reproj(X)
    b = ph._reproj(X + [0, 0.001, 0])
    d = (b - a) / ph.ppm[idx, None]
    return d / (np.linalg.norm(d, axis=1, keepdims=True) ** 2)


def region_report(prob, x, q_render=None):
    """Residual per region (mm): the fit's landmarks, and (q_render) the detector on the render against the photo."""
    ph = prob.photo
    out = {}
    X, c, pose = prob.landmarks(x)
    uv = proj(ph.K, cam_points(X, c, pose))
    for g, idx in prob.G.items():
        idx = [i for i in idx if i < 478]
        row = {}
        for nm, pts in (("fit", uv), ("detector", q_render)):
            if pts is None:
                continue
            e = (pts[idx] - ph.target[idx]) / ph.ppm[idx, None]
            if g == "oval":
                k = [prob.oval_k[i] for i in idx]
                en = (e * ph.oval_n[k]).sum(1)
                row[nm + "_rms_normal_mm"] = round(float(np.sqrt((en ** 2).mean())), 2)
                row[nm + "_mean_normal_mm"] = round(float(en.mean()), 2)
                # by part of the outline
                fy = ph.face[idx, 1]
                for part, sel in (("forehead", fy > 25), ("temples_cheeks", (fy <= 25) & (fy > -28)), ("jaw_beard", (fy <= -28) & (fy > -110)), ("chin_beard", fy <= -110)):
                    if sel.any():
                        row[f"{nm}_{part}_normal_mm"] = round(float(np.sqrt((en[sel] ** 2).mean())), 2)
                        row[f"{nm}_{part}_signed_mm"] = round(float(en[sel].mean()), 2)
            else:
                if g == "brows":       # the vertical offset (head up, mm): the game's brow height is a look key (browLift)
                    up = brow_up_dir(prob, idx)
                    row[nm + "_render_above_photo_mm"] = round(float((e * up).sum(1).mean()), 2)
                row[nm + "_rms_mm"] = round(float(np.sqrt((e ** 2).sum(1).mean())), 2)
                row[nm + "_max_mm"] = round(float(np.sqrt((e ** 2).sum(1)).max()), 2)
        out[g] = row
    return out


# ---------------------------------------------------------------------------------------------------------------
# pictures
# ---------------------------------------------------------------------------------------------------------------
def photo_crop(box, scale):
    from PIL import Image
    im = Image.open(PHOTO).convert("RGB")
    u0, v0, u1, v1 = box
    return im.crop((u0, v0, u1, v1)).resize((int((u1 - u0) * scale), int((v1 - v0) * scale)), Image.LANCZOS)


def silhouette_edges(tid):
    m = tid >= 0
    e = m & ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1))
    return e


def draw_overlay(prob, x, corr, path):
    """Photo with: photo landmarks (green), fitted mesh landmarks (red, lines to the photo point), beard-corrected
    outline target (yellow), the fitted head's silhouette (cyan) and the outline seen by the detector on the photo."""
    from PIL import Image, ImageDraw
    ph = prob.photo
    X, c, pose = prob.landmarks(x)
    uv = proj(ph.K, cam_points(X, c, pose))
    box = ph.box
    sc = 0.5 if not CFG else 1.0
    im = photo_crop(box, sc)
    # silhouette of the fitted head at the photo's pose (rendered at full photo scale in the same crop)
    m, d, _ = prob.unpack(x)
    model = prob.model
    P_full = model.full(m, d)
    Ph, cc = model.heads(m, d)
    Pc = np.ones_like(P_full)
    Pc[model.hv] = cam_points(Ph, cc, pose)
    raster.repaint(model.S, P_full)
    img, buf, _ = render_view(Pc, model.S, ph.K, np.eye(3), np.zeros(3), (*box, sc))
    edge = silhouette_edges(buf["tri"])
    a = np.asarray(im).copy()
    from scipy.ndimage import binary_dilation
    a[binary_dilation(edge, iterations=1)] = (0, 230, 255)
    im = Image.fromarray(a)
    dr = ImageDraw.Draw(im)
    tr = lambda p: ((p[0] - box[0]) * sc, (p[1] - box[1]) * sc)     # noqa: E731
    o = np.array(OVAL + OVAL[:1])
    dr.line([tr(p) for p in ph.pts[o]], fill=(60, 255, 60), width=2)
    dr.line([tr(p) for p in ph.target[o]], fill=(255, 220, 0), width=2)
    for i in prob.use:
        p, q = tr(ph.target[i]), tr(uv[i])
        dr.line([p, q], fill=(255, 60, 60), width=1)
        dr.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], fill=(60, 255, 60))
        dr.ellipse([q[0] - 2, q[1] - 2, q[0] + 2, q[1] + 2], fill=(255, 40, 40))
    dr.rectangle([0, 0, 760, 92], fill=(0, 0, 0))
    dr.text((8, 6), "green: photo landmarks (brows: frown undone)   yellow: outline minus beard (skin target)", fill=(255, 255, 255))
    dr.text((8, 26), "red: fitted MakeHuman head's landmarks at the photo's camera + pose (line = error)", fill=(255, 255, 255))
    dr.text((8, 46), "cyan: fitted head's silhouette (bald, beardless skin; neck cut below the jaw)", fill=(255, 255, 255))
    dr.text((8, 66), "the beard surface is the green outline below the cheeks; the skin fit is the yellow one", fill=(255, 255, 255))
    im.save(path)


def compare(prob, x, corr, path):
    from PIL import Image, ImageDraw
    ph = prob.photo
    box = ph.box
    sc = 0.32 if not CFG else 0.6
    pc = photo_crop(box, sc)
    m, d, pose = prob.unpack(x)
    pose = pose[:7]
    model = prob.model
    P_full = model.full(m, d)
    Ph, cc = model.heads(m, d)
    Pc = np.ones_like(P_full)
    Pc[model.hv] = cam_points(Ph, cc, pose)
    raster.repaint(model.S, P_full)
    img, buf, _ = render_view(Pc, model.S, ph.K, np.eye(3), np.zeros(3), (*box, sc))
    rd = Image.fromarray(raster.to_u8(img))
    mix = Image.blend(pc, rd, 0.5)
    # frontal: the photo unwarped (measure.py) and the fitted head seen straight on, both orthographic, same frame
    fr = Image.open(os.path.join(LK, "frontal.png")).convert("RGB")
    XR, YB, YT, PX = 95.0, -150.0, 115.0, 0.25
    # the fitted head in the photo's head frame (measure.py's frontal frame): camera points -> photo pose inverse
    Xh_model = (Pc - ph.t) @ ph.R            # R^T (Xc - t)
    org = ph.eyes_mid
    Wf, Hf = fr.size
    s = 1.0 / (PX / 1000.0)
    K = np.array([[s * 30, 0, Wf / 2], [0, s * 30, YT / PX], [0, 0, 1.0]])    # near-orthographic: camera 30 m away
    R = np.diag([1.0, -1.0, -1.0])       # image right = the subject's left (+x), y down, z into the scene
    t = -R @ org + [0, 0, 30.0]
    imgf, buff = raster.render(Xh_model, model.S, K, R, t, Wf, Hf)
    rf = Image.fromarray(raster.to_u8(imgf))
    # side by side, all at one height
    Hh = 760
    tiles = []
    for im_ in (pc, rd, mix, fr, rf):
        w_ = int(im_.size[0] * Hh / im_.size[1])
        tiles.append(im_.resize((w_, Hh), Image.LANCZOS))
    W = sum(t_.size[0] for t_ in tiles) + 10 * (len(tiles) - 1)
    out = Image.new("RGB", (W, Hh + 30), (20, 20, 20))
    xo = 0
    labels = ["photo", "fitted head, photo's camera + pose", "50 / 50", "photo, unwarped frontal", "fitted head, frontal (same frame)"]
    dr = ImageDraw.Draw(out)
    for t_, lb in zip(tiles, labels):
        out.paste(t_, (xo, 30))
        dr.text((xo + 6, 8), lb, fill=(255, 255, 255))
        xo += t_.size[0] + 10
    out.save(path)


# ---------------------------------------------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------------------------------------------
def write_face(model, m, d, path, report):
    det = model.details(d)
    tot = m["african"] + m["asian"] + max(0.0, 1 - m["african"] - m["asian"])
    face = {
        "notes": ("kai_photo (likeness:fit): Kai's head fitted to the owner's reference photo (MediaPipe landmarks and the "
                  "face outline at the photo's own camera and pose, skin under the beard; tools/characters/likeness/fit.py). "
                  "Shape only: skin, beard, brows, hair and moles come from the later likeness steps. The skin outline sits "
                  "3-6 mm inside his beard's (jaw 3-4 mm, chin 6 mm): the beard pass adds that volume. Painted brows sit "
                  f"{report['after_detector']['brows'].get('detector_render_above_photo_mm', 0):.1f} mm above his (frown undone): "
                  "browLift about -0.003."),
        "replace_details": True,
        "macro": {"weight": round(m["weight"], 3), "muscle": round(m["muscle"], 3), "african": round(m["african"], 3),
                  "asian": round(m["asian"], 3), "caucasian": round(max(0.0, 1 - m["african"] - m["asian"]), 3)},
        "details": dict(sorted(det.items())),
    }
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(face, open(path, "w"), indent=1)


def main(argv):
    opt = dict(a[2:].split("=", 1) for a in argv if a.startswith("--") and "=" in a)
    rounds = int(opt.get("rounds", 4))
    out_face = opt.get("out", os.path.join(CHAR, "faces_candidates", "kai_photo", "kai.json"))
    os.makedirs(os.path.join(OUT, "fit"), exist_ok=True)
    from scipy.optimize import least_squares
    T0 = time.time()
    m = dict(MACRO_INIT)
    P0 = mh.sculpt(macro_dict(m))
    model = Model(P0)
    model.height = solve_height(macro_dict(m), {})
    model._macro.cache_clear()
    print("params", len(model.params), "height", model.height, "%.1fs" % (time.time() - T0))
    G = groups()
    photo = Photo()
    prob = Problem(model, photo, G)
    d = np.zeros(len(model.params))
    # initial pose: measure.py's (template scaled by face_scale) about the model's eye midpoint
    Ph, c = model.heads(m, d)
    s0 = photo.M["camera"]["face_scale_vs_template"]
    pose = np.r_[rvec(photo.R), photo.R @ (s0 * c) + photo.t, s0]
    # measure.py's frame is the template's (height 0.5, weight 0.5): re-anchor on the eye midpoint
    FS_t, Pt = None, mh.sculpt(dict(gender=1.0, age=fmx.mh_age(YEARS), muscle=0.5, weight=0.5))
    ct = 0.5 * (Pt[mh.group_vertices("helper-l-eye")].mean(0) + Pt[mh.group_vertices("helper-r-eye")].mean(0))
    pose[3:6] = photo.R @ (s0 * ct) + photo.t
    prob.pose0 = pose.copy()
    x = np.r_[[m[k] for k in MACRO_KEYS], d, pose]
    lo, hi = prob.bounds()
    # the correspondence table for the starting head (frontal + the photo's view), written once
    tab_path = os.path.join(HERE, "mp_to_mh.json")
    log = dict(rounds=[])
    corr = correspond(model, m, d, pose, photo, "r0", save=os.path.join(OUT, "fit", "render_r0.png"))
    if not os.path.exists(tab_path) or "--table" in argv:
        ft = frontal_table(model, m, d, tab_path)
        Pfull0 = model.full(m, d)
        tv_p = model.hv[corr["tv"]]
        Xp = (Pfull0[tv_p] * corr["bw"][:, :, None]).sum(1)
        Xf = (Pfull0[ft["tv"]] * ft["bw"][:, :, None]).sum(1)
        spread = np.linalg.norm(Xp - Xf, axis=1) * 1000
        json.dump(dict(
            notes=("MediaPipe Face Mesh index -> MakeHuman base-mesh point (three vertex ids + barycentric weights) on Kai's "
                   "starting head (male, 32, South Asian mix), found by running the detector on renders of the head (raster.py) "
                   "and tracing each point back onto the mesh. 'front': a frontal view; 'photo_view': the reference photo's "
                   "camera and pose (outline points differ: they follow the silhouette of the view); spread_mm: the distance "
                   "between the two on the head (small for interior points)."),
            front=dict(v=ft["tv"].tolist(), w=np.round(ft["bw"], 4).tolist(), on_surface=ft["ok"].tolist()),
            photo_view=dict(v=tv_p.tolist(), w=np.round(corr["bw"], 4).tolist(), on_surface=corr["ok"].tolist()),
            spread_mm=np.round(spread, 2).tolist(),
            spread_median_mm_interior=round(float(np.median(spread[[i for i in range(468) if i not in OVAL]])), 2),
            spread_median_mm_oval=round(float(np.median(spread[OVAL])), 2)), open(tab_path, "w"))
        print("table", tab_path, "interior spread median %.2f mm" % np.median(spread[[i for i in range(468) if i not in OVAL]]))
    for rnd in range(rounds):
        prob.set_corr(corr)
        rep0 = region_report(prob, x, corr["q"])
        T = time.time()
        if rnd == 0:     # the pose (and scale) alone first
            def fpose(p):
                return prob.residuals(np.r_[x[:4 + prob.np], p])
            rp = least_squares(fpose, x[4 + prob.np:], bounds=(lo[4 + prob.np:], hi[4 + prob.np:]), x_scale="jac")
            x[4 + prob.np:] = rp.x
        r = least_squares(prob.residuals, x, bounds=(lo, hi), x_scale="jac", max_nfev=60 if rnd < rounds - 1 else 120, verbose=0)
        x = r.x
        m, d, pose = prob.unpack(x)
        # re-solve the height for 1.83 m with the new face and macro (head size follows the body), refresh
        model.height = solve_height(macro_dict(m), model.details(d, 0.0))
        model._macro.cache_clear()
        rep_fit = region_report(prob, x)
        corr = correspond(model, m, d, pose, photo, f"r{rnd + 1}", save=os.path.join(OUT, "fit", f"render_r{rnd + 1}.png"))
        rep_det = region_report(prob, x, corr["q"])
        parts = prob.residuals(x, parts=True)
        ent = dict(round=rnd + 1, seconds=round(time.time() - T, 1), cost=round(float(r.cost), 2), height=model.height,
                   macro={k: round(float(v), 3) for k, v in m.items()},
                   pose=dict(rvec_deg=np.degrees(pose[:3]).round(2).tolist(), t_m=pose[3:6].round(4).tolist(), scale=round(float(pose[6]), 4)),
                   ratios={k: [round(float(v), 3), round(float(prob.r_photo[k]), 3)] for k, v in parts["ratios"].items()},
                   depth_vs_mediapipe_mm=dict(rms=round(float(np.sqrt((parts["dz"] ** 2).mean())), 2),
                                              nose_tip=round(float(parts["dz"][0]), 2), alae=round(float(parts["dz"][7:9].mean()), 2),
                                              lips=round(float(parts["dz"][9:12].mean()), 2), brows=round(float(parts["dz"][14:16].mean()), 2)),
                   before_detector=rep0, fit=rep_fit, after_detector=rep_det,
                   biggest_details=sorted(((nm, round(float(v), 3)) for (nm, _), v in zip(model.params, d)), key=lambda a: -abs(a[1]))[:25])
        log["rounds"].append(ent)
        print(f"round {rnd + 1}: cost {r.cost:.1f}  {time.time() - T:.0f}s  macro {ent['macro']}  scale {pose[6]:.3f}  height {model.height}")
        for g in ("eyes", "nose", "lips", "brows", "oval"):
            print("   ", g, rep_det[g])
        json.dump(log, open(os.path.join(OUT, "fit.json"), "w"), indent=1)
        np.save(os.path.join(OUT, "fit", "x.npy"), x)
        write_face(model, m, d, out_face, ent)
    prob.set_corr(corr)
    draw_overlay(prob, x, corr, os.path.join(OUT, "fit_overlay.png"))
    compare(prob, x, corr, os.path.join(OUT, "fit_compare.png"))
    print("done %.0fs" % (time.time() - T0), out_face)


if __name__ == "__main__":
    if any(a.startswith("--views=") for a in sys.argv[1:]):
        main_multi(sys.argv[1:])
    else:
        main(sys.argv[1:])
