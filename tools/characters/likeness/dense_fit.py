"""likeness:dense - Kai's complete head shape beyond MakeHuman's sliders (docs/CHARACTER_LOOK.md, "Kai's face",
"Fix round 4: the complete face shape"). The design is the shape study's METHOD.md (stage B); the targets are the
sculptor's SHAPE_SPEC.md read of the photo, transcribed into shape_targets.json (next to this file).

    PY=/home/user/tools/likeness-venv/bin/python
    $PY dense_fit.py stage_b [--face=../faces/kai.json] [--out=WORK/kai_shape.npz] [--lam=10] [--rounds=8] [--inner=6]
                             [--alar=12] [--pose=fixed|solve] [--beard=built|band] [--beard_shift=1.3]
    $PY dense_fit.py report  [--face=FILE] [--shape=NPZ] [--tag=NAME] [--pose=fixed|solve]   # errors and targets only
    $PY dense_fit.py stage_a [--face=../faces/kai.json] [--out=DIR/kai.json]     # the de-compensated slider refit (tried,
                                                                                 # not used: see the deviations)

The layer (stage B). A per-vertex offset field D over the head of the MakeHuman base mesh (every body vertex above the
neck joint - 35 mm, about 4 400, plus the helpers that ride on it), solved as a sparse regularised least-squares
problem in Gauss-Newton rounds (each round: render the shaped head at the photo's camera with raster.py, run
MediaPipe, trace its points back onto the mesh, then 6 linearised steps with the hinge sets refreshed):
  data, at the photo's own camera (fit.py's pose, fit/x.npy, held fixed: the head is reshaped through the camera that
  measured the photo, the iris giving the scale):
    - the 468 MediaPipe points: projected mesh point minus the photo's (frown undone, upper lids +0.6 mm), mm on the
      face, fit.py's weights, a 0.8 mm dead zone (the detector's own scatter: the layer does not chase it); the points
      on the beard (below the lower lip, beside and below the mouth) at 0.1 (MediaPipe reads the beard's surface there)
      and on the frowning forehead and brows at 0.3;
    - the head's true silhouette (ears hidden: his are under the hair) against the photo's outline, as a band along
      the outline's normal: above the brows the sleek hair hides the skull (the skin may lie up to 6-15 mm outside the
      visible skin edge, never inside it), at the cheekbones -4..+1 mm; on the beard (--beard=built) the skin goes where
      the slider head's skin was plus BEARD_SHIFT (the round-3 build's beard, rendered in the game at this camera, read
      1.3 mm inside the photo's: MediaPipe's oval on both bearded faces), +-1.5 mm, so the shipped beard's outline lands
      on his (--beard=band: the sculptor's beard thicknesses instead: sideburn 3-4 mm, jaw sides 4.5-7.5, under the chin
      1.5-5);
    - MediaPipe's depth is NOT used: the study measured its response to real depth changes at -0.3 / -0.23 / -0.03
      (study geo/cur/depth_check.json): it returns its prior whatever the geometry.
  targets (shape_targets.json, the sculptor's 3D read: vault height and midline profile, skull breadth, sections of the
    cheeks, nose and chin, the brow over the lid, the lips' depth, the chin's height and projection, soft front-to-side
    turns, the under-chin, the temples, the head length; each a band with a confidence weight). The photo does not see
    along its rays, so these mostly move the surface in the camera's null space: the profile and three-quarter become
    his while the front stays matched;
  regularisers: a thin-plate (bi-Laplacian, cotangent, area-normalised) energy on the offsets, smooth everywhere (the
    features ride on a smooth field and keep their reviewed small forms), stiffer on the skull and the brow roll;
    symmetric by construction (the base mesh is exactly mirror-symmetric); rigid patches (a translation each) for
    each eye (eyeball, lash helpers, the lid margins and the socket lining, the eye joints: blinks and gaze keep their
    geometry; the eye spacing held), each ear, and the lip contact line (the jaw split) with the teeth and tongue
    riding on it (full height, half depth); soft-tissue bounds along the normal per region; an eye clearance (the lid
    skin never nearer the eyeball than now); the neck held at 0 toward the collar line; a small cost on the patches'
    translations; a proximal damping between steps.
Output: an .npz stored like a MakeHuman target (decimetre deltas on base-mesh vertex ids, applied by
mh.sculpt(..., shape=) after the macro and detail targets; the face file's alarSoften passes baked in), a region id per
vertex (for the Witness / Mira inheritance), the base mesh's hash and the provenance (no photo pixels: geometry only).
Private reports, overlays and renders go to LIKENESS_DIR/shape/fit/.

Deviations from METHOD.md (written down as it asks):
  - Stage A (fit.py with the whole-head compensation held at 0) was run twice and is not used: with head-scale-vert
    freed, the face-local sliders that took the proportions back gave a long hooked nose and deep folds (nose base
    +0.7, nose length -1.0, forehead height -1.0 in the first try); the reviewed slider values stay, and the layer
    raises and narrows the skull itself.
  - The thin plate is not softer at the nose, lips and lids: that let the landmarks carve them (a hooked tip, a brow
    shelf, dents in the cheeks).
  - Stage C (the definition-layer normal displacement) is not part of this run; nostrils are not separate patches.
  - The pose is held at fit.py's, not re-solved (--pose=solve re-solves it with the silhouette): the shipped build is
    then reviewed through exactly that camera (photo_camera_exact, FS_PHOTO_IOD=0).
  - The beard band comes from the built beard, not the sculptor's 6-11 mm hang under the chin (that left the game's
    beard ending 4-5 mm short of the photo's).
"""
import hashlib
import json
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CHAR = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, CHAR)
os.environ.setdefault("CAST", "nrzero")
os.environ.setdefault("MH_DATA", "/home/user/tools/mh/makehuman/data")

import mh  # noqa: E402
import fit  # noqa: E402
import raster  # noqa: E402

LK = fit.LK
WORK = os.environ.get("SHAPE_WORK", os.path.join(LK, "shape", "fit"))
FACE_DEFAULT = os.path.join(CHAR, "faces", "kai.json")
TARGETS = os.path.join(HERE, "shape_targets.json")
VERSION = 1

# ---------------------------------------------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------------------------------------------
def opts(argv):
    return dict(a[2:].split("=", 1) for a in argv if a.startswith("--") and "=" in a)


def ss(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def base_hash():
    V, _, _ = mh.base()
    return hashlib.sha1(np.round(V, 6).tobytes()).hexdigest()[:16]


def load_face(path):
    o = json.load(open(path))
    if o.get("extends"):
        b = json.load(open(os.path.join(os.path.dirname(path), o["extends"])))
        o = {**b, **{k: v for k, v in o.items() if k != "extends"}}
    return o


def build_macro(face):
    """Kai's build macro (cast_nrzero's entry: sex, age, proportions) with the face file's face terms; height solved."""
    m = {k: float(face["macro"][k]) for k in fit.MACRO_KEYS}
    return m


def d_from_details(model, det):
    d = np.zeros(len(model.params))
    for j, (nm, keys) in enumerate(model.params):
        vals = [det[k] for k in keys if k in det]
        if vals:
            d[j] = float(np.mean(vals))
    return d


def setup_model(face, shape=None):
    """fit.Model for the face file's macro, its detail vector, the solved height and fit.py's pose (x.npy)."""
    m = build_macro(face)
    model = fit.Model(mh.sculpt(fit.macro_dict(m)))
    d = d_from_details(model, face["details"])
    model.height = solve_height(fit.macro_dict(m), model.details(d, 0.0), shape)
    model._macro.cache_clear()
    x0 = np.load(os.path.join(LK, "fit", "x.npy"))
    pose = x0[4 + len(model.params):].copy()
    return model, m, d, pose


def solve_height(macro, details, shape=None):
    body = mh.group_vertices("body")
    lo, hi = 0.0, 1.0
    for _ in range(10):
        h = (lo + hi) / 2
        P = mh.sculpt(dict(macro, height=h), details, shape=shape)
        if P[body, 1].max() - P[body, 1].min() < fit.METRES:
            lo = h
        else:
            hi = h
    return round((lo + hi) / 2, 4)


# ---------------------------------------------------------------------------------------------------------------
# Stage A: the de-compensated slider base
# ---------------------------------------------------------------------------------------------------------------
COMP = ("head/head-scale-vert-decr|incr", "head/head-scale-horiz-decr|incr", "head/head-scale-depth-decr|incr",
        "head/head-fat-decr|incr", "head/head-round", "head/head-square")
# terms that carried the compensation with them (eyes pushed up into the skull, brows down): free to move back
LOOSE = ("eyes/eye-trans-down|up", "eyebrows/eyebrows-trans-down|up", "chin/chin-height-decr|incr", "nose/nose-scale-vert-decr|incr",
         "mouth/mouth-trans-down|up", "forehead/forehead-scale-vert-decr|incr", "cheek/cheek-trans-down|up",
         "chin/chin-width-decr|incr", "chin/chin-jaw-drop-decr|incr", "cheek/cheek-bones-decr|incr", "cheek/cheek-volume-decr|incr",
         "head/head-oval", "head/head-triangular", "neck/neck-double-decr|incr", "mouth/mouth-scale-vert-decr|incr",
         "eyes/eye-scale-decr|incr", "mouth/mouth-scale-horiz-decr|incr")
WALL = {"eyes/eye-trans-down|up": 0.6, "eyebrows/eyebrows-trans-down|up": 0.6}


class StageA(fit.Problem):
    """fit.Problem with the compensation terms held at 0 and every other modifier held to its installed value."""

    def __init__(self, model, photo, G, d0, m0, kp=0.5):
        super().__init__(model, photo, G)
        names = [nm for nm, _ in model.params]
        self.dref = np.array([0.0 if nm in COMP else v for nm, v in zip(names, d0)])
        self.pw = np.array([60.0 if nm in COMP else (0.6 if nm in LOOSE else kp) for nm in names])
        self.wall = np.array([WALL.get(nm, 9.0) for nm in names])
        self.m0 = m0

    def residuals(self, x, parts=False):
        X, c, pose = self.landmarks(x)
        uv = fit.proj(self.photo.K, fit.cam_points(X, c, pose))
        ph = self.photo
        e = (uv - ph.target) / ph.ppm[:, None]
        res = np.r_[(e[self.u_int] * self.w[self.u_int, None]).ravel(), (e[self.u_ov] * self.n_ov).sum(1) * self.w[self.u_ov]]
        Zm = fit.cam_points(X, c, pose)[:, 2]
        dz = ((Zm[fit.DEPTH] - Zm[[133, 362]].mean()) / pose[6] - (ph.Xc[fit.DEPTH, 2] - ph.Xc[[133, 362], 2].mean()) / ph.s0) * 1000.0
        res = np.r_[res, dz * fit.W_DEPTH]
        rr = fit.ratios(X)
        rat = np.array([(rr[k] / self.r_photo[k] - 1) / 0.03 for k in fit.RATIOS] + [(rr["canthal_tilt_deg"] - self.r_photo["canthal_tilt_deg"]) / 3.0]) * self.w_ratio * 0.25
        m, d, _ = self.unpack(x)
        pri_d = np.r_[self.pw * (d - self.dref), 12.0 * np.clip(np.abs(d) - self.wall, 0, None)]
        pri_m = np.array([(m[k] - self.m0[k]) / 0.03 for k in fit.MACRO_KEYS]) * 0.6
        dp = pose - self.pose0
        pri_p = np.r_[dp[:3] / np.radians(6) * 0.5, dp[3:5] / 0.03 * 0.5, dp[5] / 0.015, dp[6] / 0.04]
        if parts:
            return dict(e=e, dz=dz, ratios=rr, rat=rat, pri_d=pri_d, pri_m=pri_m, pri_p=pri_p)
        return np.r_[res, rat, pri_d, pri_m, pri_p]


def stage_a(argv):
    from scipy.optimize import least_squares
    o = opts(argv)
    face_path = o.get("face", FACE_DEFAULT)
    out = o.get("out", os.path.join(WORK, "stage_a", "kai.json"))
    rounds = int(o.get("rounds", 4))
    wd = os.path.join(os.path.dirname(out))
    os.makedirs(wd, exist_ok=True)
    face = load_face(face_path)
    model, m, d0, pose = setup_model(face)
    photo = fit.Photo()
    G = fit.groups()
    prob = StageA(model, photo, G, d0, dict(m), kp=float(o.get("kp", 4.0)))
    prob.pose0 = pose.copy()
    x = np.r_[[m[k] for k in fit.MACRO_KEYS], d0, pose]
    lo, hi = prob.bounds()
    lo[4:4 + prob.np] = -1.0
    hi[4:4 + prob.np] = 1.0
    x = np.clip(x, lo + 1e-9, hi - 1e-9)
    log = dict(face=face_path, rounds=[])
    corr = fit.correspond(model, m, d0, pose, photo, "a0", save=os.path.join(wd, "render_a0.png"))
    for rnd in range(rounds):
        T = time.time()
        prob.set_corr(corr)
        if rnd == 0:
            n0 = 4 + prob.np
            rp = least_squares(lambda p: prob.residuals(np.r_[x[:n0], p]), x[n0:], bounds=(lo[n0:], hi[n0:]), x_scale="jac")
            x[n0:] = rp.x
        r = least_squares(prob.residuals, x, bounds=(lo, hi), x_scale="jac", max_nfev=60 if rnd < rounds - 1 else 120)
        x = r.x
        m, d, pose = prob.unpack(x)
        model.height = fit.solve_height(fit.macro_dict(m), model.details(d, 0.0))
        model._macro.cache_clear()
        corr = fit.correspond(model, m, d, pose, photo, f"a{rnd + 1}", save=os.path.join(wd, f"render_a{rnd + 1}.png"))
        rep = fit.region_report(prob, x, corr["q"])
        names = [nm for nm, _ in model.params]
        ent = dict(round=rnd + 1, seconds=round(time.time() - T), cost=round(float(r.cost), 2),
                   macro={k: round(float(v), 3) for k, v in m.items()},
                   comp={nm: round(float(v), 3) for nm, v in zip(names, d) if nm in COMP},
                   moved=sorted(((nm, round(float(a), 3), round(float(b), 3)) for nm, a, b in zip(names, d0, d) if abs(a - b) > 0.03),
                                key=lambda t: -abs(t[2] - t[1]))[:30],
                   after_detector=rep)
        log["rounds"].append(ent)
        print(f"stage A round {rnd + 1}: cost {r.cost:.1f} {time.time() - T:.0f}s comp {ent['comp']}", flush=True)
        for g in ("eyes", "nose", "lips", "oval"):
            print("   ", g, {k: v for k, v in rep[g].items() if k.startswith("detector")}, flush=True)
        json.dump(log, open(os.path.join(wd, "stage_a.json"), "w"), indent=1)
        np.save(os.path.join(wd, "x_stage_a.npy"), x)
        # the candidate face file: the installed one with the new detail values (and macro face terms)
        new = json.load(open(face_path))
        new["details"] = dict(sorted(model.details(d).items()))
        new["macro"] = dict(new["macro"], **{k: round(float(m[k]), 3) for k in fit.MACRO_KEYS})
        tot = new["macro"]["african"] + new["macro"]["asian"]
        new["macro"]["caucasian"] = round(max(0.0, 1 - tot), 3)
        json.dump(new, open(out, "w"), indent=1)
    print("stage A done ->", out)


# ---------------------------------------------------------------------------------------------------------------
# mesh structure of the head (base-mesh topology, exact mirror map, cotangent Laplacian)
# ---------------------------------------------------------------------------------------------------------------
class HeadMesh:
    def __init__(self, P):
        """P: the slider-base sculpt (metres, MH axes)."""
        import scipy.sparse as sp
        V0, _, F = mh.base()
        self.N = len(V0)
        self.F = F
        self.body_faces = [list(vs) for vs, _, g in F if g == "body"]
        body = np.array(mh.group_vertices("body"))
        self.body = body
        neck_y = mh.joint(P, "neck")[1]
        self.inH = np.zeros(self.N, bool)
        self.inH[body[P[body, 1] > neck_y - 0.035]] = True
        # exact mirror map of the base mesh (x -> -x)
        from scipy.spatial import cKDTree
        t = cKDTree(V0)
        dd, j = t.query(V0 * [-1, 1, 1])
        assert dd.max() < 1e-5, "base mesh is not mirror-symmetric"
        self.mirror = j
        self.mid = np.abs(V0[:, 0]) < 1e-6
        # neighbours (body faces) and the H boundary (an H vertex next to a body vertex outside H)
        nb = [set() for _ in range(self.N)]
        for f in self.body_faces:
            for i in range(len(f)):
                a, b = f[i], f[(i + 1) % len(f)]
                nb[a].add(b)
                nb[b].add(a)
        self.nb = nb
        self.bnd = np.zeros(self.N, bool)
        for v in np.nonzero(self.inH)[0]:
            if any(not self.inH[u] for u in nb[v]):
                self.bnd[v] = True
        # triangles of H (one diagonal; for hits and normals) and of the whole body (both diagonals; Laplacian)
        tri = []
        for f in self.body_faces:
            if all(self.inH[v] for v in f):
                tri += [(f[0], f[1], f[2])] + ([(f[0], f[2], f[3])] if len(f) == 4 else [])
        self.tris = np.array(tri, np.int64)
        tl, tw = [], []
        for f in self.body_faces:
            if len(f) == 3:
                tl.append(f)
                tw.append(1.0)
            else:
                for q in ((f[0], f[1], f[2]), (f[0], f[2], f[3]), (f[0], f[1], f[3]), (f[1], f[2], f[3])):
                    tl.append(q)
                    tw.append(0.5)
        self.ltris, self.ltw = np.array(tl, np.int64), np.array(tw)
        self.sp = sp

    def laplacian(self, P):
        """Cotangent matrix C (N x N, positive semi-definite form: (C x)_i = sum_j w_ij (x_i - x_j)) and lumped areas (mm^2)."""
        sp = self.sp
        X = P * 1000.0
        T, w = self.ltris, self.ltw
        I, J, Vv = [], [], []
        area = np.zeros(self.N)
        for k in range(3):
            a, b, c = T[:, k], T[:, (k + 1) % 3], T[:, (k + 2) % 3]
            u, v = X[b] - X[a], X[c] - X[a]
            cr = np.linalg.norm(np.cross(u, v), axis=1)
            cot = (u * v).sum(1) / np.maximum(cr, 1e-12)
            cot = np.clip(cot, -5, 20) * 0.5 * w
            I += [b, c, b, c]
            J += [c, b, b, c]
            Vv += [-cot, -cot, cot, cot]
            area += 0
        a, b, c = T[:, 0], T[:, 1], T[:, 2]
        ar = 0.5 * np.linalg.norm(np.cross(X[b] - X[a], X[c] - X[a]), axis=1) * w
        for k in range(3):
            np.add.at(area, T[:, k], ar / 3)
        C = sp.csr_matrix((np.concatenate(Vv), (np.concatenate(I), np.concatenate(J))), shape=(self.N, self.N))
        return C, area

    def boundary_loops(self):
        """Open borders of the body mesh (the eye openings among them)."""
        cnt = {}
        for f in self.body_faces:
            for i in range(len(f)):
                e = (min(f[i], f[(i + 1) % len(f)]), max(f[i], f[(i + 1) % len(f)]))
                cnt[e] = cnt.get(e, 0) + 1
        edges = [e for e, n in cnt.items() if n == 1]
        nb = {}
        for a, b in edges:
            nb.setdefault(a, []).append(b)
            nb.setdefault(b, []).append(a)
        seen, loops = set(), []
        for s in nb:
            if s in seen:
                continue
            loop, stack = [], [s]
            while stack:
                v = stack.pop()
                if v in seen:
                    continue
                seen.add(v)
                loop.append(v)
                stack += nb[v]
            loops.append(loop)
        return loops


def group_exact(name):
    return raster.group_exact(name)


def proxy_eye_spheres(Pmm):
    """{side: (centre mm, radius mm)} of the cornea shells of MakeHuman's eye proxy fitted on Pmm (build_humans.fit_proxy
    + look2.eye_spheres, numpy only): the eye the build makes. Its vertices are the helper's plus scaled offsets, so the
    shell moves with the eye patch's translation."""
    rel = "eyes/high-poly/high-poly.mhclo"
    d = os.path.dirname(mh.path(rel))
    Pdm = Pmm / 100.0
    scale, rows, obj, in_verts = {}, [], None, False
    for line in open(mh.path(rel)):
        a = line.split()
        if not a or a[0].startswith("#"):
            continue
        if a[0] == "obj_file":
            obj = os.path.join(d, a[1])
        elif a[0] in ("x_scale", "y_scale", "z_scale"):
            ax = "xyz".index(a[0][0])
            scale[ax] = abs(Pdm[int(a[1])][ax] - Pdm[int(a[2])][ax]) / float(a[3])
        elif a[0] == "verts":
            in_verts = True
        elif in_verts and len(a) in (1, 9):
            rows.append(a)
        elif in_verts:
            in_verts = False
    ev = []
    for a in rows:
        if len(a) == 1:
            ev.append(Pdm[int(a[0])])
            continue
        i = [int(x) for x in a[:3]]
        w = [float(x) for x in a[3:6]]
        off = np.array([float(x) for x in a[6:9]]) * np.array([scale.get(0, 1), scale.get(1, 1), scale.get(2, 1)])
        ev.append(w[0] * Pdm[i[0]] + w[1] * Pdm[i[1]] + w[2] * Pdm[i[2]] + off)
    ev = np.array(ev) * 100.0
    ef = [[int(t.split("/")[0]) - 1 for t in line.split()[1:]] for line in open(obj) if line.startswith("f ")]
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
        q = ev[vs]
        A = np.c_[2 * q, np.ones(len(q))]
        sol = np.linalg.lstsq(A, (q ** 2).sum(1), rcond=None)[0]
        out[side] = (sol[:3], float(np.sqrt(sol[3] + sol[:3] @ sol[:3])))
    return out


def ear_vertices(P=None):
    """The ears: MakeHuman's ear-scale targets' vertices inside build_humans.layout's ear box (lateral bumps behind the
    eyes: |x| > 71 mm, -50 < y < 34 mm, -115 < z < -55 mm from the eye midpoint)."""
    tab = mh.modifier_table()
    s = set()
    for k in ("ears/l-ear-scale-decr|incr", "ears/r-ear-scale-decr|incr"):
        s |= set(mh.target(tab[k][1])[0].tolist())
    v = np.array(sorted(s))
    if P is None:
        V0, _, _ = mh.base()
        P = V0 * 0.1
    eye = 0.5 * (P[mh.group_vertices("helper-l-eye")].mean(0) + P[mh.group_vertices("helper-r-eye")].mean(0))
    q = P[v] - eye
    return v[(np.abs(q[:, 0]) > 0.071) & (q[:, 1] > -0.05) & (q[:, 1] < 0.034) & (q[:, 2] < -0.055) & (q[:, 2] > -0.115)]


# ---------------------------------------------------------------------------------------------------------------
# face frame (face mm: origin = the inner eye corners' midpoint as MediaPipe 133 / 362 traced onto the base mesh,
# x his left, y up, z forward; photo mm = build mm x likenessScale)
# ---------------------------------------------------------------------------------------------------------------
class Frame:
    def __init__(self, scale, rot=None):
        m = json.load(open(os.path.join(HERE, "mp_to_mh.json")))
        self.tv = np.array(m["front"]["v"])
        self.tw = np.array(m["front"]["w"])
        self.k = scale
        # v3: the head frame of the three photos is the model's axes turned by the fit's pose (R_f^T R): targets
        # measured in the photos' frame (the forehead's lean, the profile depths) are read in it
        self.rot = np.eye(3) if rot is None else np.asarray(rot, float)

    def lm(self, Pmm, i):
        return (Pmm[self.tv[i]] * self.tw[i][:, None]).sum(0)

    def origin(self, Pmm):
        return 0.5 * (self.lm(Pmm, 133) + self.lm(Pmm, 362))

    def origin_terms(self):
        """[(vertex, weight)] of the origin (for Jacobian rows)."""
        out = {}
        for i in (133, 362):
            for v, w in zip(self.tv[i], self.tw[i]):
                out[int(v)] = out.get(int(v), 0.0) + 0.5 * float(w)
        return list(out.items())

    def q(self, Pmm):
        return ((Pmm - self.origin(Pmm)) @ self.rot.T) * self.k


# ---------------------------------------------------------------------------------------------------------------
# surface queries on the face-frame positions Q (rays along the axes, sections)
# ---------------------------------------------------------------------------------------------------------------
class Surf:
    def __init__(self, Q, tris):
        self.Q, self.T = Q, tris
        A, B, C = Q[tris[:, 0]], Q[tris[:, 1]], Q[tris[:, 2]]
        self.A, self.B, self.C = A, B, C
        self.lo = np.minimum(np.minimum(A, B), C)
        self.hi = np.maximum(np.maximum(A, B), C)
        n = np.cross(B - A, C - A)
        self.n = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)

    def ray(self, ax, a, b, want="max"):
        """Hit of the line {axes != ax at (a, b)} along axis ax: the extreme (max / min) coordinate on ax.
        ax 2 (z): (a, b) = (x, y); ax 1 (y): (a, b) = (x, z); ax 0 (x): (a, b) = (y, z).
        Returns (tri id, barycentrics (3,), value, normal) or None."""
        p, q = [k for k in range(3) if k != ax]
        m = (self.lo[:, p] <= a) & (self.hi[:, p] >= a) & (self.lo[:, q] <= b) & (self.hi[:, q] >= b)
        idx = np.nonzero(m)[0]
        if not len(idx):
            return None
        A, B, C = self.A[idx], self.B[idx], self.C[idx]
        x1, y1, x2, y2, x3, y3 = A[:, p], A[:, q], B[:, p], B[:, q], C[:, p], C[:, q]
        det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
        ok = np.abs(det) > 1e-12
        det = np.where(ok, det, 1.0)
        l1 = ((y2 - y3) * (a - x3) + (x3 - x2) * (b - y3)) / det
        l2 = ((y3 - y1) * (a - x3) + (x1 - x3) * (b - y3)) / det
        l3 = 1 - l1 - l2
        ins = ok & (l1 >= -1e-9) & (l2 >= -1e-9) & (l3 >= -1e-9)
        if not ins.any():
            return None
        val = l1 * A[:, ax] + l2 * B[:, ax] + l3 * C[:, ax]
        val = np.where(ins, val, -np.inf if want == "max" else np.inf)
        k = int(np.argmax(val) if want == "max" else np.argmin(val))
        return int(idx[k]), np.array([l1[k], l2[k], l3[k]]), float(val[k]), self.n[idx[k]]

    def section_extreme(self, y, zmin, sign=1):
        """Section of the surface with the plane y: the point of max (sign=1) / min (sign=-1) x among the segment ends
        with z > zmin. Returns ((va, vb, t), x) on the edge va -> vb at t."""
        best, arg = -np.inf, None
        Q, T = self.Q, self.T
        ys = Q[T][:, :, 1]
        m = (ys.min(1) <= y) & (ys.max(1) >= y)
        for ti in np.nonzero(m)[0]:
            tri = T[ti]
            for i in range(3):
                a, b = tri[i], tri[(i + 1) % 3]
                ya, yb = Q[a, 1], Q[b, 1]
                if (ya - y) * (yb - y) > 0 or ya == yb:
                    continue
                t = (y - ya) / (yb - ya)
                pnt = Q[a] * (1 - t) + Q[b] * t
                if pnt[2] <= zmin:
                    continue
                v = sign * pnt[0]
                if v > best:
                    best, arg = v, (int(a), int(b), float(t))
        return arg, sign * best


# ---------------------------------------------------------------------------------------------------------------
# targets (shape_targets.json): evaluation and linearisation
# ---------------------------------------------------------------------------------------------------------------
CONF = dict(high=1.0, medium=0.5, low=0.2)


class Row:
    """A scalar function of the vertex offsets, linearised: value and [(vertex, coeff (3,))] per mm of offset."""
    def __init__(self, value, terms):
        self.value, self.terms = value, terms

    def __sub__(self, o):
        return Row(self.value - o.value, self.terms + [(v, -c) for v, c in o.terms])

    def __add__(self, o):
        return Row(self.value + o.value, self.terms + o.terms)

    def scale(self, s):
        return Row(self.value * s, [(v, c * s) for v, c in self.terms])


class TargetEval:
    def __init__(self, frame, hm, eyes):
        self.fr, self.hm, self.eyes = frame, hm, eyes
        self.oterms = frame.origin_terms()

    def update(self, Pmm):
        self.Pmm = Pmm
        self.Q = self.fr.q(Pmm)
        self.S = Surf(self.Q, self.hm.tris)
        self.k = self.fr.k

    def _pt(self, terms, axis_vec):
        """Row of axis_vec . (k * rot (sum w X_v - O))."""
        a = self.fr.rot.T @ np.asarray(axis_vec, float)
        out = [(v, self.k * w * a) for v, w in terms]
        out += [(v, -self.k * w * a) for v, w in self.oterms]
        return out

    def z(self, x, y, want="max"):
        h = self.S.ray(2, x, y, want)
        if h is None:
            return None
        ti, bw, val, n = h
        if abs(n[2]) < 0.05:
            n = np.array([n[0], n[1], 0.05 * np.sign(n[2] or 1)])
        tri = self.hm.tris[ti]
        return Row(val, self._pt(list(zip(tri, bw)), n / n[2]))

    def ybot(self, x, z):
        h = self.S.ray(1, x, z, "min")
        if h is None:
            return None
        ti, bw, val, n = h
        if abs(n[1]) < 0.05:
            n = np.array([n[0], 0.05 * np.sign(n[1] or 1), n[2]])
        tri = self.hm.tris[ti]
        return Row(val, self._pt(list(zip(tri, bw)), n / n[1]))

    def xext(self, y, zmin, sign):
        arg, val = self.S.section_extreme(y, zmin, sign)
        if arg is None:
            return None
        a, b, t = arg
        return Row(val, self._pt([(a, 1 - t), (b, t)], np.array([1.0, 0, 0])))

    def top(self):
        H = np.nonzero(self.hm.inH)[0]
        y = self.Q[H, 1]
        ymax = y.max()
        sel = H[y > ymax - 1.5]
        w = np.exp((self.Q[sel, 1] - ymax) / 0.5)
        w /= w.sum()
        val = float((self.Q[sel, 1] * w).sum())
        return Row(val, self._pt(list(zip(sel, w)), np.array([0, 1.0, 0])))

    def lm(self, i, axis):
        e = np.zeros(3)
        e[axis] = 1.0
        X = (self.Pmm[self.fr.tv[i]] * self.fr.tw[i][:, None]).sum(0)
        val = float((((X - self.fr.origin(self.Pmm)) @ self.fr.rot.T) * self.k)[axis])
        return Row(val, self._pt(list(zip(self.fr.tv[i], self.fr.tw[i])), e))

    def cornea_front(self, side):
        """The eye's front as the brow target reads it: the upper lid's lash line (the most forward point of the
        upper lash helper, which rides on the lid margin; SHAPE_SPEC's 'eye front z 7.9' of the round-3 head)."""
        vs = np.array(group_exact(f"helper-{side.lower()}-eyelashes-2"))
        v = int(vs[np.argmax(self.Q[vs, 2])])
        val = float(self.Q[v, 2])
        return Row(val, self._pt([(v, 1.0)], np.array([0, 0, 1.0])))

    def back(self, ys):
        best = None
        for y in ys:
            r = self.z(0.0, y, "min")
            if r is not None and (best is None or r.value < best.value):
                best = r
        return best

    def evaluate(self, t):
        """Row for one target definition (or None when it cannot be evaluated)."""
        k = t["kind"]
        try:
            if k == "z":
                return self.z(t["x"], t["y"])
            if k == "zrel":
                a, b = self.z(t["x"], t["y"]), self.z(t["x2"], t["y2"])
                return a - b if a is not None and b is not None else None
            if k == "zsec":
                h = t.get("h", 4.0)
                r = [self.z(t["x"] + i * h, t["y"]) for i in range(3)]
                if any(x is None for x in r):
                    return None
                return r[0] - r[1].scale(2.0) + r[2]
            if k == "zsecy":
                h = t.get("h", 4.0)
                r = [self.z(t["x"], t["y"] + i * h) for i in range(3)]
                if any(x is None for x in r):
                    return None
                return r[0] - r[1].scale(2.0) + r[2]
            if k == "zdrop":
                a, b = self.z(t["x"], t["y"]), self.z(t["x2"], t["y"])
                return a - b if a is not None and b is not None else None
            if k == "width":
                a, b = self.xext(t["y"], t.get("zmin", -1e9), 1), self.xext(t["y"], t.get("zmin", -1e9), -1)
                return a - b if a is not None and b is not None else None
            if k == "top":
                return self.top()
            if k == "lm":
                return self.lm(t["mp"], "xyz".index(t["axis"]))
            if k == "lmrel":
                ax = "xyz".index(t["axis"])
                return self.lm(t["mp"], ax) - self.lm(t["mp2"], ax)
            if k == "brow_eye":
                a = self.z(t["x"], t["y"])
                return a - self.cornea_front("L") if a is not None else None
            if k == "ybot":
                return self.ybot(t["x"], t["z"])
            if k == "length":
                a, b = self.z(0.0, t["y"]), self.back(t["ys"])
                return a - b if a is not None and b is not None else None
        except (ValueError, IndexError):
            return None
        raise KeyError(k)


def expand_targets(spec):
    """shape_targets.json entries -> flat list (lists of x / y expand into one target each)."""
    out = []
    for t in spec["targets"]:
        if t["kind"] in ("z",) and isinstance(t.get("x"), list):
            for x, band in zip(t["x"], t["bands"]):
                out.append(dict(t, x=x, band=band, id=f"{t['id']}_x{x}"))
        elif t["kind"] in ("zsec", "zsecy", "zdrop", "temple") and isinstance(t.get("y"), list):
            for y in t["y"]:
                xs = t["x"] if isinstance(t["x"], list) else [t["x"]]
                for x in xs:
                    out.append(dict(t, y=y, x=x, id=f"{t['id']}_y{y}_x{x}"))
        else:
            out.append(t)
    return out


# ---------------------------------------------------------------------------------------------------------------
# the shaped model (fit.Model's interface over the base sculpt + offsets) and the photo's outline
# ---------------------------------------------------------------------------------------------------------------
class ShapedModel:
    def __init__(self, model, m, d):
        self.model, self.m, self.d = model, m, d
        self.base = model.full(m, d)                          # metres, full body
        _, self.c = model.heads(m, d)
        self.Dm = np.zeros_like(self.base)                    # offsets, metres
        for k in ("hv", "S", "loc", "params", "eyes", "prior", "height"):
            setattr(self, k, getattr(model, k))

    def full(self, m=None, d=None):
        return self.base + self.Dm

    def heads(self, m=None, d=None, sub=None):
        P = (self.base + self.Dm)[self.hv]
        return (P if sub is None else P[sub]), self.c

    def details(self, d, eps=0.005):
        return self.model.details(d, eps)


def outline_samples(pts, n_sub=3):
    o = np.array(fit.OVAL + fit.OVAL[:1])
    P = pts[o]
    S, idx = [], []
    for k in range(len(o) - 1):
        for t in np.linspace(0, 1, n_sub, endpoint=False):
            S.append(P[k] * (1 - t) + P[k + 1] * t)
            idx.append((o[k], o[k + 1], t))
    S = np.array(S)
    nb = np.roll(S, -1, 0) - np.roll(S, 1, 0)
    n = np.c_[nb[:, 1], -nb[:, 0]]
    n /= np.linalg.norm(n, axis=1, keepdims=True)
    cen = pts[[1, 168, 152]].mean(0)
    n[((S - cen) * n).sum(1) < 0] *= -1
    return S, n, idx


def outline_band(fy, inset=None):
    """(lo, hi, weight) of the skin silhouette's signed distance (mm, + = outside) from the photo's outline at face
    height fy (photo face mm), or None (no term): the sleek hair hides the skull above the brows, the beard's
    thickness below the cheekbones (the sculptor's band: sideburn 3-4 mm, jaw sides 4.5-7.5; under the chin the built
    beard's reach from this camera, 1.5-5)."""
    if fy > 45:
        return None
    if fy > 25:
        return (-1.5, 15.0, 0.3)
    if fy > -10:
        return (-1.5, 6.0, 0.6)
    if fy > -28:
        return (-4.0, 1.0, 1.0)
    if fit.CFG and inset is not None:
        # v3 (the 2026 front photo): MediaPipe's oval runs inside the beard close to the skin; the skin lies the front
        # measurement's estimated inset (0-2 mm) inside it, +-1.5
        return (-float(inset) - 2.0, -float(inset) + 1.0, 1.0)
    # under the chin the band is the built beard's own reach in this view (the round-3 build: its chin outline sits
    # 2 mm past its skin from the photo camera above, the jaw-side cards about 5 mm): the shipped beard's outline then
    # lands on his. The sculptor's 8-12 mm hang would leave the game's beard ending 4-5 mm short of the photo's.
    lo = np.interp(fy, [-125, -112, -98, -70, -45, -28], [1.5, 1.5, 4.5, 4.5, 3.0, 0.5])
    hi = np.interp(fy, [-125, -112, -98, -70, -45, -28], [5.0, 5.0, 8.0, 7.5, 4.5, 3.0])
    return (-float(hi), -float(lo), 1.0)


def silhouette(sm, photo, pose, scene, box=None, sc=0.5, want_pts=True):
    """The head's true silhouette at the photo's camera against the photo's outline: per outline sample, the signed
    distance (mm, + = the render's silhouette outside the photo's) and the surface point on the silhouette (global
    vertex ids + barycentrics)."""
    box = box or photo.box
    pose = pose[:7]
    P_full = sm.full()
    Pc = np.ones_like(P_full)
    Ph, c = sm.heads()
    Pc[sm.hv] = fit.cam_points(Ph, c, pose)
    raster.repaint(scene, P_full)
    img, buf, _ = fit.render_view(Pc, scene, photo.K, np.eye(3), np.zeros(3), (*box, sc))
    tid = buf["tri"]
    mask = tid >= 0
    S, n, idx = outline_samples(photo.pts[:, :2])
    ppm = np.array([photo.ppm[a] * (1 - t) + photo.ppm[b] * t for a, b, t in idx])
    fy = np.array([photo.face[a, 1] * (1 - t) + photo.face[b, 1] * t for a, b, t in idx])
    ob = {i: th for i, th in zip(fit.OVAL, photo.oval_beard)}
    inset = np.array([ob[a] * (1 - t) + ob[b] * t for a, b, t in idx])
    H, W = mask.shape
    err, pts = [], []
    for p, nn, k in zip(S, n, ppm):
        ts = np.linspace(-45, 45, 721)
        q = (p[None] + ts[:, None] * k * nn[None] - box[:2]) * sc
        xi = np.clip(q[:, 0].astype(int), 0, W - 1)
        yi = np.clip(q[:, 1].astype(int), 0, H - 1)
        inside = mask[yi, xi]
        tr = np.nonzero(inside[:-1] & ~inside[1:])[0]
        if len(tr) == 0:
            err.append(np.nan)
            pts.append(None)
            continue
        j = tr[np.argmin(np.abs(ts[tr]))]
        err.append(ts[j])
        k_ = tid[yi[j], xi[j]]
        pts.append((scene.tris[k_], buf["bary"][yi[j], xi[j]].copy()))
    return dict(S=S, n=n, ppm=ppm, fy=fy, inset=inset, err=np.array(err), pts=pts, mask=mask, img=img, box=box, sc=sc)


def scene_without(scene, verts):
    """A copy of a raster scene without the triangles touching verts (the ears)."""
    import copy
    s2 = copy.copy(scene)
    bad = np.isin(scene.tris, verts).any(1)
    s2.tris = scene.tris[~bad]
    s2.grp = scene.grp[~bad]
    s2.verts = np.unique(s2.tris)
    return s2


# ---------------------------------------------------------------------------------------------------------------
# Stage B: the dense layer
# ---------------------------------------------------------------------------------------------------------------
class Dense:
    def __init__(self, sm, photo, G, targets, lam=8.0, scale=1.007, sides=None, rot=None):
        import scipy.sparse as sp
        self.sp = sp
        self.sm, self.photo = sm, photo
        P = sm.base
        self.Pmm0 = P * 1000.0
        self.hm = hm = HeadMesh(P)
        N = hm.N
        self.fr = Frame(scale, rot)
        # v3: the side photos (views.Side) at their own cameras, chained to the front pose
        self.sides = sides or []
        self.w_slm, self.w_ssil = 1.0, 1.0
        Q0 = self.fr.q(self.Pmm0)
        self.Q0 = Q0
        # ---- patches ----
        # the eye patch's skin: the lid margins (body vertices within 1.5 mm of the lash helpers, which ride on them)
        # and the socket lining inside the eye helper's sphere (+0.5 mm); the base body mesh has no open eye border
        from scipy.spatial import cKDTree
        lid = {}
        Pmm = self.Pmm0
        bodyv = hm.body
        for side in "LR":
            pre = side.lower()
            lash = np.r_[group_exact(f"helper-{pre}-eyelashes-1"), group_exact(f"helper-{pre}-eyelashes-2")]
            dd, _ = cKDTree(Pmm[lash]).query(Pmm[bodyv])
            q = Pmm[group_exact(f"helper-{pre}-eye")]
            A = np.c_[2 * q, np.ones(len(q))]
            sol = np.linalg.lstsq(A, (q ** 2).sum(1), rcond=None)[0]
            r_ = np.sqrt(sol[3] + sol[:3] @ sol[:3])
            inside = np.linalg.norm(Pmm[bodyv] - sol[:3], axis=1) < r_ + 0.5
            lid[side] = bodyv[(dd < 1.5) | inside]
        self.lid = lid
        ears = ear_vertices(P)
        ears = ears[hm.inH[ears]]
        self.ears = ears
        lipline = np.array(json.load(open(os.path.join(HERE, "mh_lip_line.json")))["verts"])
        if fit.AT_REST:
            # v3: the lips' seal rides with the contact line (the skin within LIP_SEAL_MM of it): pulled apart by the
            # moustache and the lower lip's profile the vermilion edges parted and showed the teeth (first v3 runs)
            from scipy.spatial import cKDTree
            dd_, _ = cKDTree(P[lipline] * 1000.0).query(P[hm.body] * 1000.0)
            seal = hm.body[(dd_ < LIP_SEAL_MM) & hm.inH[hm.body]]
            lipline = np.unique(np.r_[lipline, seal])
        self.lipline = lipline
        patch = {}          # vertex -> (patch name, sign of x)
        for side, sg in (("L", 1), ("R", -1)):
            pre = side.lower()
            vs = set(lid[side].tolist())
            for g in (f"helper-{pre}-eye", f"helper-{pre}-eyelashes-1", f"helper-{pre}-eyelashes-2", f"joint-{pre}-eye",
                      f"joint-{pre}-eye-target", f"joint-{pre}-upperlid", f"joint-{pre}-lowerlid"):
                vs |= set(group_exact(g))
            for v in vs:
                patch[v] = ("eye", sg)
        for v in ears:
            patch[int(v)] = ("ear", 1 if P[v, 0] > 0 else -1)
        for v in lipline:
            patch[int(v)] = ("lip", 1)
        for g in ("helper-upper-teeth", "helper-lower-teeth", "helper-tongue", "joint-tongue-1", "joint-tongue-2", "joint-tongue-3", "joint-tongue-4"):
            for v in group_exact(g):
                patch[v] = ("teeth", 1)
        self.patch = patch
        self.eyes = dict(L=np.array(group_exact("helper-l-eye")), R=np.array(group_exact("helper-r-eye")))
        sph = proxy_eye_spheres(self.Pmm0)
        self.eyes["sphere"] = sph
        # ---- unknowns: free half-mesh vertices (x >= 0) + patch translations ----
        free = hm.inH & ~hm.bnd
        for v in patch:
            free[v] = False
        rep = np.where(hm.mid | (P[:, 0] > 0), np.arange(N), hm.mirror)
        col = -np.ones(N, np.int64)
        reps = np.unique(rep[free])
        col[reps] = np.arange(len(reps)) * 3
        nc = len(reps) * 3
        pc = {"eye": nc, "ear": nc + 3, "lip": nc + 6}
        self.ncol = nc + 8                    # eye (3), ear (3), lip (y, z)
        self.pc = pc
        I, J, Vv = [], [], []
        for v in range(N):
            if free[v]:
                r = rep[v]
                sx = -1.0 if (r != v and not hm.mid[v]) else 1.0
                for k in range(3):
                    if k == 0 and hm.mid[v]:
                        continue
                    I.append(3 * v + k)
                    J.append(col[r] + k)
                    Vv.append(sx if k == 0 else 1.0)
            elif v in patch:
                nm, sg = patch[v]
                if nm in ("eye", "ear"):
                    for k in range(3):
                        I.append(3 * v + k)
                        J.append(pc[nm] + k)
                        Vv.append(float(sg) if k == 0 else 1.0)
                elif nm == "lip":
                    I += [3 * v + 1, 3 * v + 2]
                    J += [pc["lip"], pc["lip"] + 1]
                    Vv += [1.0, 1.0]
                elif nm == "teeth":
                    I += [3 * v + 1, 3 * v + 2]
                    J += [pc["lip"], pc["lip"] + 1]
                    Vv += [1.0, 0.5]
        self.S = sp.csr_matrix((Vv, (I, J)), shape=(3 * N, self.ncol))
        self.free, self.rep, self.col = free, rep, col
        self.u = np.zeros(self.ncol)
        # ---- regularisers ----
        C, area = hm.laplacian(P)
        y, z, ax = Q0[:, 1], Q0[:, 2], np.abs(Q0[:, 0])
        stiff = 1.0 + 3.0 * np.maximum(ss(40, 60, y), ss(-40, -60, z) * ss(-60, -30, y))          # the skull: bone-like
        stiff = stiff + 1.0 * ss(4, 14, y) * ss(60, 45, y)        # the brow and forehead: one continuous roll, no shelf
        # the offsets are smooth everywhere, the features included: a smooth field moves and reshapes the masses and
        # carries MakeHuman's (reviewed) nose, lids and lips along unchanged in their small forms (METHOD.md's softer
        # stiffness at the features let the landmarks carve them: a hooked tip, a brow shelf, dents in the cheeks)
        if fit.AT_REST:
            # v3: the skin round the rigid eye patches (the lids) is a little softer, so the socket can deepen under the
            # brow roll (his deep-set eyes) with a smooth fall-off to the orbital rim; the fold of the first v3 run came
            # from the brow slider pulling the brow tissue down over the lids (now held: fit.HOLD_FIXED)
            from scipy.spatial import cKDTree
            lidv = np.r_[self.lid["L"], self.lid["R"]]
            dl, _ = cKDTree(self.Pmm0[lidv]).query(self.Pmm0)
            stiff = stiff * (1.0 - EYE_SOFT * ss(12.0, 2.0, dl)) + EYE_STIFF * ss(12.0, 2.0, dl)
        lamv = lam * stiff
        rows = np.nonzero(hm.inH | (np.asarray(np.abs(C).sum(1)).ravel() * 0 > 1))[0]
        # include the ring just outside H so the offsets fade with continuous slope at its border
        ring = set()
        for v in np.nonzero(hm.bnd)[0]:
            ring |= {u for u in hm.nb[v] if not hm.inH[u]}
        rows = np.unique(np.r_[rows, np.array(sorted(ring), np.int64)])
        Wr = sp.diags(np.sqrt(lamv[rows] / np.maximum(area[rows], 1e-6)))
        Lr = Wr @ C[rows]
        self.Lsm = sp.vstack([Lr @ self.S[k::3] for k in range(3)]).tocsr()
        self.lamv, self.area = lamv, area
        # anchors: the neck toward the collar line, the nape (no data, under the hair)
        anc = 6.0 * ss(-128, -165, y) + 1.5 * ss(-55, -80, y) * ss(-45, -70, z)
        anc = anc * hm.inH
        av = np.nonzero(anc > 1e-3)[0]
        A_rows = []
        for k in range(3):
            A_rows.append(sp.csr_matrix((anc[av], (np.arange(len(av)), 3 * av + k)), shape=(len(av), 3 * N)))
        self.Anc = (sp.vstack(A_rows) @ self.S).tocsr()
        # soft-tissue bounds (mm along the base normal) per region
        Nn = raster.vertex_normals(self.Pmm0, hm.tris)
        self.N0 = Nn
        lo = np.full(N, -3.0)
        hi = np.full(N, 8.0)
        vault = (y > 50) | (z < -45)
        lo[vault], hi[vault] = -10.0, 22.0
        fh = (y > 20) & (y <= 50) & ~vault
        lo[fh], hi[fh] = -2.5, 7.0
        br = (y > 5) & (y <= 20) & ~vault
        lo[br], hi[br] = (-5.0 if fit.AT_REST else -2.0), 5.0      # v3: the lids sink under the brow roll
        ns = (ax < 18) & (y > -45) & (y <= 5) & (z > 5)
        lo[ns], hi[ns] = -3.0, (8.0 if fit.AT_REST else 5.0)        # v3: the high, straight radix of the side photos
        lp = (ax < 30) & (y > -88) & (y <= -45) & (z > 0)
        lo[lp], hi[lp] = -2.5, 5.0
        ml = (ax >= 18) & (y > -45) & (y <= 5) & ~vault
        lo[ml], hi[ml] = (-9.0 if fit.AT_REST else -3.0), 7.0      # v3: the side photos see the cheeks recede (the mole, Ex)
        bc = (y <= -45) & ~lp & ~vault
        lo[bc], hi[bc] = -8.0, 9.0           # the jaw and jowl: the photo's outline (beard band) decides, both ways
        ch = (ax < 25) & (y < -88) & (z > -10)
        lo[ch], hi[ch] = -6.0, 6.0
        sm_ = (y < -105) & (z <= -10)
        lo[sm_], hi[sm_] = -3.0, 10.0
        self.tlo, self.thi = lo, hi
        self.tissue_v = np.nonzero(hm.inH & ~hm.bnd)[0]
        # eye clearance: skin near the eyes that is not in the eye patch
        self.clear_v = {}
        for s in "LR":
            c, r = sph[s]
            d_ = np.linalg.norm(self.Pmm0 - c, axis=1)
            vs = np.nonzero(hm.inH & (d_ < r + 6.0) & np.array([patch.get(v, ("", 0))[0] != "eye" for v in range(N)]))[0]
            self.clear_v[s] = vs
            self.clear_min = getattr(self, "clear_min", np.zeros(N))
            self.clear_min[vs] = np.minimum(d_[vs], r + 0.4) - 0.05      # never closer than now, nor than r + 0.4
        # landmarks / outline / targets
        self.G = G
        self.prob = fit.Problem(sm, photo, G)
        self.targets = targets
        self.te = TargetEval(self.fr, hm, self.eyes)
        self.te.Pmm0 = self.Pmm0
        self.region = self.regions(Q0)
        self.log = []
        self.w_sil = 0.6
        self.w_t = 1.0
        self.w_tissue = 2.0
        self.damp = 0.3
        self.lm_dead = 0.8
        self.beard_ref = None
        self.beard_lm_w = float(os.environ.get("BEARD_LM_W", 0.1))
        # landmarks on the beard (below the lower lip, or beside and below the mouth): MediaPipe reads the beard's
        # surface there, not his skin; the outline band carries the skin's place, these only a little
        fx, fy_ = photo.face[:, 0], photo.face[:, 1]
        lips_set = set(G["lips"])
        self.lm_w = np.ones(len(photo.face))
        for i in range(min(468, len(fx))):
            if i in lips_set:
                continue
            if fy_[i] < -82 or (abs(fx[i]) > 28 and fy_[i] < -45):
                # v3: the 2026 photo's points there sit close to the skin inside the beard (the front measurement)
                self.lm_w[i] = 0.4 if fit.AT_REST else self.beard_lm_w
            elif fy_[i] > 6 and i not in set(G["eyes"]) and fit.AT_REST:
                # v3: no frown; the forehead's points are MediaPipe's guesses on smooth skin (the side photos see it)
                self.lm_w[i] = 0.6
            elif fy_[i] > 6 and i not in set(G["eyes"]):
                # the forehead and brow skin: the photo frowns (corrugators bunched, brows drawn down and together);
                # MediaPipe's points there are its guesses moved by the frown, not his neutral shape
                self.lm_w[i] = 0.3
    # -------------------------------------------------------------------------------------------------------
    def regions(self, Q):
        """0 skull / vault, 1 forehead / brow, 2 orbit / lids, 3 nose, 4 cheeks / malar, 5 mouth / lips, 6 chin / jaw,
        7 under-chin / neck, 8 ears, 9 helpers."""
        N = self.hm.N
        x, y, z = Q[:, 0], Q[:, 1], Q[:, 2]
        ax = np.abs(x)
        r = np.full(N, 4, np.uint8)
        r[(y > 8)] = 1
        r[(y > 50) | (z < -45)] = 0
        r[(np.hypot(ax - 32, (y - 0) * 1.4) < 24) & (z > -25)] = 2
        r[(ax < 20) & (y <= 5) & (y > -48) & (z > 4)] = 3
        r[(ax < 34) & (y <= -40) & (y > -90) & (z > -8)] = 5
        r[(y <= -82) & (z > -60)] = 6
        r[(y <= -110) & (z <= -10)] = 7
        r[(y < -128)] = 7
        r[self.ears] = 8
        bodyset = np.zeros(N, bool)
        bodyset[self.hm.body] = True
        r[~bodyset] = 9
        return r

    def D(self, u=None):
        u = self.u if u is None else u
        return (self.S @ u).reshape(-1, 3)          # mm

    def set_u(self, u):
        self.u = u
        self.sm.Dm = self.D(u) / 1000.0

    # ---- Jacobian assembly helpers ----
    def _rows_to_sparse(self, rows):
        """rows: [(weight, Row-like terms)] -> sparse (n, 3N) over vertex offsets (mm)."""
        sp = self.sp
        I, J, V = [], [], []
        for i, terms in enumerate(rows):
            for v, c in terms:
                for k in range(3):
                    if c[k] != 0.0:
                        I.append(i)
                        J.append(3 * int(v) + k)
                        V.append(float(c[k]))
        return sp.csr_matrix((V, (I, J)), shape=(len(rows), 3 * self.hm.N))

    def proj_jac(self, Xmm):
        """Image Jacobian (2x3 per point, px per mm of model offset) of points in model mm."""
        pose = self.pose
        R = fit.rodrigues(pose[:3])
        s = pose[6]
        Xc = fit.cam_points(Xmm / 1000.0, self.sm.c, pose)
        K = self.photo.K
        fx, fy_ = K[0, 0], K[1, 1]
        z = Xc[:, 2]
        Juv = np.zeros((len(Xc), 2, 3))
        Juv[:, 0, 0] = fx / z
        Juv[:, 0, 2] = -fx * Xc[:, 0] / z ** 2
        Juv[:, 1, 1] = fy_ / z
        Juv[:, 1, 2] = -fy_ * Xc[:, 1] / z ** 2
        J = Juv @ (s * R) / 1000.0
        uv = fit.proj(K, Xc)
        return uv, J

    # ---- per round: correspondences, silhouette, pose ----
    def refresh(self, rnd, save_dir):
        from scipy.optimize import least_squares
        ph, prob = self.photo, self.prob
        m, d = self.sm.m, self.sm.d
        corr = fit.correspond(self.sm, m, d, self.pose, ph, f"b{rnd}", save=os.path.join(save_dir, f"render_b{rnd}.png"))
        prob.set_corr(corr)
        prob.pose0 = self.pose0
        if self.fixed_pose:
            # the photo's camera and pose stay fit.py's (fit/x.npy, the camera the game's photo view reproduces through
            # fit/photo_camera.json): the head is reshaped to the photo at that camera, so the shipped build registers
            # with the photo exactly where the round-3 build did
            self.corr = corr
            self.sil = silhouette(self.sm, ph, self.pose, self.scene_noear)
            self.refresh_sides()
            return corr
        x = np.r_[[m[k] for k in fit.MACRO_KEYS], d, self.pose]
        n0 = 4 + prob.np
        lo, hi = prob.bounds()
        # the pose sees the head's silhouette too (its points held on the surface, the band as in the shape solve): the
        # landmarks alone leave the yaw loose, and a yaw error reads as an asymmetric outline a symmetric head cannot fit
        sil = silhouette(self.sm, ph, self.pose, self.scene_noear)
        Pmm = (self.sm.full() * 1000.0)
        sp_, bands = [], []
        for j, pt in enumerate(sil["pts"]):
            b_ = outline_band(sil["fy"][j], sil["inset"][j]) if pt is not None else None
            if b_ is None:
                continue
            tri, bb = pt
            sp_.append(((Pmm[tri] * bb[:, None]).sum(0) / 1000.0, sil["S"][j], sil["n"][j], sil["ppm"][j]) + b_)
        Xs = np.array([a[0] for a in sp_])

        def fpose(p):
            r = prob.residuals(np.r_[x[:n0], p])
            uvs = fit.proj(ph.K, fit.cam_points(Xs, self.sm.c, p))
            out = []
            for (X_, S_, n_, k_, lo_, hi_, w_), u_ in zip(sp_, uvs):
                d_ = float((u_ - S_) @ n_ / k_)
                out.append(self.w_sil * w_ * (d_ - lo_ if d_ < lo_ else (d_ - hi_ if d_ > hi_ else 0.0)))
            return np.r_[r, np.array(out)]
        rp = least_squares(fpose, x[n0:], bounds=(lo[n0:], hi[n0:]), x_scale="jac")
        self.pose = rp.x
        self.corr = corr
        self.sil = silhouette(self.sm, ph, self.pose, self.scene_noear)
        return corr

    def refresh_sides(self):
        """v3: the head's silhouette at each side camera (views.silhouette) and the side landmarks' mesh points (the
        MediaPipe ones from this round's front trace)."""
        import views
        if not self.sides:
            return
        P = self.sm.full()
        self.side_sil = [views.silhouette(P, sc_, sd, self.front, self.pose[:7], self.sm.c) for sd, sc_ in zip(self.sides, self.side_scenes)]
        tv = self.sm.hv[self.prob.tv]
        self.side_lm = []
        for sd in self.sides:
            L = {}
            for nm, o in sd.lm.items():
                if nm in views.MP_SIDE:
                    i = views.MP_SIDE[nm][0 if sd.near > 0 else 1]
                    v, w = tv[i], self.prob.bw[i]
                else:
                    v = views.EAR_PICKS[nm] if sd.near > 0 else int(self.hm.mirror[views.EAR_PICKS[nm]])
                    v, w = np.array([v]), np.array([1.0])
                sig = np.hypot(o["sigma"], (views.EAR_MODEL_SD_MM if nm in views.EAR_PICKS else views.FACE_MODEL_SD_MM) * sd.ppm0)
                L[nm] = (v, w, o["px"], sig, o["conf"])
            self.side_lm.append(L)

    def side_rows(self, Pmm, add):
        """v3: the side photos' rows: landmarks (px / sigma) and the silhouette's band (mm), at each side camera."""
        import views
        for k, sd in enumerate(self.sides):
            A, b = sd.affine(self.front, self.pose[:7], self.sm.c)
            rows, r0 = [], []
            for nm, (v, w, px, sig, conf) in self.side_lm[k].items():
                X = (Pmm[v] * w[:, None]).sum(0) / 1000.0
                uv, _, J = views.project_affine(sd.K, A, b, X[None])
                e = (uv[0] - px) / sig
                if np.linalg.norm(e) * sig / sd.ppm0 <= self.lm_dead:
                    continue
                ww = conf * self.w_slm
                for a in range(2):
                    rows.append([(int(v[q]), ww * w[q] * J[0, a] / 1000.0 / sig) for q in range(len(v))])
                    r0.append(ww * e[a])
            if rows:
                add(self._rows_to_sparse(rows), np.array(r0), f"{sd.tag}_landmarks")
            sil = self.side_sil[k]
            rows, r0 = [], []
            for j, pt in enumerate(sil["pts"]):
                if pt is None:
                    continue
                lo_, hi_, wb = sd.band[j]
                tri, bb = pt
                X = (Pmm[tri] * bb[:, None]).sum(0) / 1000.0
                uv, Xc, J = views.project_affine(sd.K, A, b, X[None])
                ppm = sd.K[0, 0] / Xc[0, 2]
                dd = float((uv[0] - sd.S[j]) @ sd.n[j]) / ppm
                if lo_ <= dd <= hi_:
                    continue
                edge = lo_ if dd < lo_ else hi_
                w = self.w_ssil * wb
                g = sd.n[j] @ J[0] / 1000.0 / ppm
                rows.append([(int(tri[q]), w * bb[q] * g) for q in range(3)])
                r0.append(w * (dd - edge))
            if rows:
                add(self._rows_to_sparse(rows), np.array(r0), f"{sd.tag}_silhouette")

    # ---- the linear system at the current offsets ----
    def system(self):
        sp = self.sp
        ph, prob = self.photo, self.prob
        Pmm = self.Pmm0 + self.D()
        blocks, rhs, names = [], [], []

        def add(J_full, r0, name):
            # residual r(u) ~ r0 + J (u - u0): rows J u ~ J u0 - r0
            Ju = (J_full @ self.S) if J_full.shape[1] == 3 * self.hm.N else J_full
            blocks.append(Ju)
            rhs.append(Ju @ self.u - r0)
            names.append((name, len(r0)))
        # landmarks (interior): 2D, mm
        tv = self.sm.hv[prob.tv]                       # global ids
        bw = prob.bw
        X = (Pmm[tv] * bw[:, :, None]).sum(1)
        uv, Jp = self.proj_jac(X)
        ui = prob.u_int
        e = (uv - ph.target) / ph.ppm[:, None]
        rows, r0 = [], []
        for i in ui:
            # a dead zone of LM_DEAD mm (MediaPipe's own scatter between two renders): the layer does not chase noise
            en = float(np.linalg.norm(e[i]))
            if en <= self.lm_dead:
                continue
            k_ = (en - self.lm_dead) / en
            wi = prob.w[i] * self.lm_w[i]
            w = wi / ph.ppm[i]
            for a in range(2):
                rows.append([(tv[i, k], w * bw[i, k] * Jp[i, a]) for k in range(3)])
                r0.append(wi * e[i, a] * k_)
        if rows:
            add(self._rows_to_sparse(rows), np.array(r0), "landmarks")
        # MediaPipe's oval on the render: a band along the photo outline's normal
        rows, r0 = [], []
        okk = [prob.oval_k[i] for i in prob.u_ov]
        for i, kk in zip(prob.u_ov, okk):
            nrm = ph.oval_n[kk]
            band = outline_band(ph.face[i, 1], ph.oval_beard[kk])
            if band is None or (self.beard_ref is not None and ph.face[i, 1] < -28):
                continue          # on the beard the true silhouette's reference band holds the skin (below)
            lo_, hi_, wb = band
            sdist = float(((uv[i] - ph.pts[i]) @ nrm) / ph.ppm[i])         # the skin's outline: the beard band
            if lo_ <= sdist <= hi_:
                continue
            edge = lo_ if sdist < lo_ else hi_
            w = prob.w[i] * wb
            rows.append([(tv[i, k], w * bw[i, k] * (nrm @ Jp[i]) / ph.ppm[i]) for k in range(3)])
            r0.append(w * (sdist - edge))
        if rows:
            add(self._rows_to_sparse(rows), np.array(r0), "oval")
        # the true silhouette
        rows, r0 = [], []
        sil = self.sil
        for j, pt in enumerate(sil["pts"]):
            if pt is None:
                continue
            band = outline_band(sil["fy"][j], sil["inset"][j])
            if band is None:
                continue
            lo_, hi_, wb = band
            if self.beard_ref is not None and sil["fy"][j] < -28 and np.isfinite(self.beard_ref[j]):
                c_ = self.beard_ref[j]
                lo_, hi_ = c_ - 1.5, c_ + 1.5
            tri, b = pt
            Xs = (Pmm[tri] * b[:, None]).sum(0)
            uvs, Js = self.proj_jac(Xs[None])
            sdist = float(((uvs[0] - sil["S"][j]) @ sil["n"][j]) / sil["ppm"][j])
            if lo_ <= sdist <= hi_:
                continue
            edge = lo_ if sdist < lo_ else hi_
            w = self.w_sil * wb
            g = sil["n"][j] @ Js[0] / sil["ppm"][j]
            rows.append([(tri[k], w * b[k] * g) for k in range(3)])
            r0.append(w * (sdist - edge))
        if rows:
            add(self._rows_to_sparse(rows), np.array(r0), "silhouette")
        if self.sides:
            self.side_rows(Pmm, add)
        # targets
        self.te.update(Pmm)
        rows, r0 = [], []
        self.tvals = {}
        for t in self.targets:
            row = self.te.evaluate(t)
            if row is None:
                self.tvals[t["id"]] = None
                continue
            lo_, hi_ = t["band"]
            lo_ = -1e9 if lo_ is None else lo_
            hi_ = 1e9 if hi_ is None else hi_
            self.tvals[t["id"]] = row.value
            if lo_ <= row.value <= hi_:
                continue
            edge = lo_ if row.value < lo_ else hi_
            w = CONF[t["conf"]] * self.w_t * t.get("w", 1.0)
            rows.append([(v, w * c) for v, c in row.terms])
            r0.append(w * (row.value - edge))
        if rows:
            add(self._rows_to_sparse(rows), np.array(r0), "targets")
        # soft-tissue bounds along the base normal
        D = self.D()
        vs = self.tissue_v
        dn = (D[vs] * self.N0[vs]).sum(1)
        act = (dn < self.tlo[vs]) | (dn > self.thi[vs])
        if act.any():
            va = vs[act]
            edge = np.where(dn[act] < self.tlo[va], self.tlo[va], self.thi[va])
            rows = [[(v, self.w_tissue * self.N0[v])] for v in va]
            add(self._rows_to_sparse(rows), self.w_tissue * (dn[act] - edge), "tissue")
        # eye clearance
        rows, r0 = [], []
        for s in "LR":
            c, r = self.eyes["sphere"][s]
            cc = c + D[self.eyes[s]].mean(0)
            vv = self.clear_v[s]
            dv = Pmm[vv] - cc
            dist = np.linalg.norm(dv, axis=1)
            lim = self.clear_min[vv]
            bad = dist < lim
            for v, dd, di, li in zip(vv[bad], dv[bad], dist[bad], lim[bad]):
                un = dd / di
                terms = [(v, 5.0 * un)] + [(e_, -5.0 * un / len(self.eyes[s])) for e_ in self.eyes[s]]
                rows.append(terms)
                r0.append(5.0 * (di - li))
        if rows:
            add(self._rows_to_sparse(rows), np.array(r0), "eye_clearance")
        # linear terms (exact): smoothness, anchors, a small Tikhonov
        blocks.append(self.Lsm)
        rhs.append(np.zeros(self.Lsm.shape[0]))
        names.append(("smooth", self.Lsm.shape[0]))
        blocks.append(self.Anc)
        rhs.append(np.zeros(self.Anc.shape[0]))
        names.append(("anchor", self.Anc.shape[0]))
        tk = sp.identity(self.ncol, format="csr") * 0.02
        blocks.append(tk)
        rhs.append(np.zeros(self.ncol))
        names.append(("tikhonov", self.ncol))
        # the patches' translations cost (the eye may sit 1-2 mm deeper, the lips come forward a little)
        pw = np.zeros(self.ncol)
        pw[self.pc["eye"]:self.pc["eye"] + 3] = 0.3 if fit.AT_REST else 1.5      # v3: deep-set eyes (Ex, the brow roll)
        pw[self.pc["eye"]] = 40.0          # the eye spacing (validated in three review rounds; the review camera's
                                           # pupil-distance dolly reads it) stays: the eyes may only sink or rise
        pw[self.pc["ear"]:self.pc["ear"] + 3] = 0.3
        pw[self.pc["lip"]:self.pc["lip"] + 2] = 1.0
        nzp = np.nonzero(pw)[0]
        blocks.append(sp.csr_matrix((pw[nzp], (np.arange(len(nzp)), nzp)), shape=(len(nzp), self.ncol)))
        rhs.append(np.zeros(len(nzp)))
        names.append(("patch_prior", len(nzp)))
        # proximal damping (the hinge sets change between steps: keep each step moderate)
        if self.damp > 0:
            blocks.append(sp.identity(self.ncol, format="csr") * np.sqrt(self.damp))
            rhs.append(np.sqrt(self.damp) * self.u)
            names.append(("damping", self.ncol))
        A = sp.vstack(blocks).tocsr()
        b = np.concatenate(rhs)
        return A, b, names

    def step(self):
        from scipy.sparse.linalg import spsolve
        A, b, names = self.system()
        AtA = (A.T @ A).tocsc()
        u = spsolve(AtA, A.T @ b)
        # energy report (at the old u, per block)
        r = A @ self.u - b
        rep, k = {}, 0
        for nm, n in names:
            rep[nm] = round(float((r[k:k + n] ** 2).sum()), 2)
            k += n
        self.set_u(u)
        return rep

    # ---- outputs ----
    def to_npz(self, path, meta):
        D = (self.D() + getattr(self, "pre_mm", 0.0)) / 100.0       # mm -> decimetres (MakeHuman target units)
        mag = np.linalg.norm(D, axis=1)
        idx = np.nonzero(mag > 0.005 / 100.0)[0]
        np.savez_compressed(path, version=np.int32(VERSION), base_hash=np.array(base_hash()), idx=idx.astype(np.int32),
                            d=D[idx].astype(np.float32), region=self.region[idx].astype(np.uint8),
                            sym_rms_mm=np.float32(0.0), meta=np.array(json.dumps(meta)))
        return idx


# ---------------------------------------------------------------------------------------------------------------
# reports (the same measures for every candidate: before / after)
# ---------------------------------------------------------------------------------------------------------------
REGIONS = dict(
    forehead=[10, 151, 9, 108, 69, 104, 68, 109, 67, 103, 337, 299, 333, 298, 338, 297, 332],
    temples=[21, 54, 71, 162, 127, 139, 251, 284, 301, 389, 356, 368],
    brow_ridge=[70, 63, 105, 66, 107, 46, 53, 52, 65, 55, 225, 224, 223, 222, 221],
    eye_sockets_lids=[33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 247, 30, 29, 27, 28, 56, 190,
                      130, 25, 110, 24, 23, 22, 26, 112, 243, 226, 31, 228, 229, 230, 231, 232, 233, 244, 113, 189],
    cheekbones=[116, 117, 118, 119, 100, 111, 143, 35, 34, 120, 121, 47],
    cheeks=[50, 101, 36, 205, 187, 207, 147, 123, 192, 213, 177, 137, 93, 234, 132],
    nasolabial=[203, 206, 216, 92, 165, 186, 212, 142, 126, 129],
    nose_bridge=[168, 6, 197, 195, 122, 196, 3, 51, 45, 193, 245, 188, 174, 236],
    nose_tip=[4, 1, 19, 5, 44, 45, 125, 141, 241, 242, 94, 2, 274, 275],
    nose_wings=[129, 98, 64, 48, 49, 102, 115, 220, 219, 218, 237, 166, 79, 240, 75, 60, 20, 59, 235],
    philtrum=[164, 0, 167, 37, 165, 267, 393, 391],
    lips=[61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 146, 91, 181, 84, 17, 314, 405, 321, 375, 78, 191, 80, 81, 82, 13, 312,
          311, 310, 415, 308, 95, 88, 178, 87, 14, 317, 402, 318, 324],
    mouth_corners=[61, 291, 57, 287, 43, 273, 146, 375, 185, 409, 76, 306, 62, 292, 78, 308],
    chin=[18, 200, 199, 175, 152, 201, 208, 32, 171, 140, 83, 194, 148, 377, 176, 400, 421, 428, 262, 396, 369, 313, 418],
    jaw_angle=[172, 58, 132, 136, 138, 135, 215, 397, 288, 361, 365, 367, 364, 435],
    jawline=[150, 149, 176, 148, 169, 170, 211, 210, 214, 379, 378, 400, 377, 394, 395, 431, 430, 434],
)


def region_sets(face):
    F = face[:468]
    M = F * [-1, 1, 1]
    mm = np.argmin(((F[:, None, :] - M[None, :, :]) ** 2).sum(2), 0)
    return {k: sorted(set(v) | {int(mm[i]) for i in v}) for k, v in REGIONS.items()}


def region_errors(photo, q, ref="pts"):
    """rms (mm) per region of the detector's points on the render against the photo's (raw points, or the targets
    with the frown undone)."""
    P = photo.pts if ref == "pts" else photo.target
    out = {}
    for k, idx in region_sets(photo.face).items():
        idx = np.array([i for i in idx if i < 468])
        e = (q[idx] - P[idx]) / photo.ppm[idx, None]
        out[k] = round(float(np.sqrt((e ** 2).sum(1).mean())), 2)
    return out


def outline_parts(sil, beard_allowance=True):
    e, fy = sil["err"], sil["fy"]
    ins = sil.get("inset", np.zeros(len(fy)))
    out = {}
    for part, sel in (("upper_forehead_sides", (fy > 25) & (fy <= 45)), ("temples", (fy > 0) & (fy <= 25)),
                      ("cheekbone_level", (fy > -28) & (fy <= 0)), ("cheeks_mouth_level", (fy > -70) & (fy <= -28)),
                      ("jaw_angle_level", (fy > -100) & (fy <= -70)), ("chin_bottom", fy <= -100)):
        ok = sel & np.isfinite(e)
        if not ok.any():
            continue
        ee = e[ok]
        # distance outside the allowed band (0 inside): the skin against where his skin is
        bands = [outline_band(f, i) for f, i in zip(fy[ok], ins[ok])]
        ob = np.array([0.0 if b is None else (x - b[1] if x > b[1] else (x - b[0] if x < b[0] else 0.0)) for x, b in zip(ee, bands)])
        out[part] = dict(n=int(ok.sum()), signed_mean_mm=round(float(ee.mean()), 2), rms_mm=round(float(np.sqrt((ee ** 2).mean())), 2),
                         outside_band_rms_mm=round(float(np.sqrt((ob ** 2).mean())), 2), outside_band_mean_mm=round(float(ob.mean()), 2))
    sel = (fy <= 45) & np.isfinite(e)
    bands = [outline_band(f, i) for f, i in zip(fy[sel], ins[sel])]
    ob = np.array([0.0 if b is None else (x - b[1] if x > b[1] else (x - b[0] if x < b[0] else 0.0)) for x, b in zip(e[sel], bands)])
    out["all_below_hairline"] = dict(outside_band_rms_mm=round(float(np.sqrt((ob ** 2).mean())), 2), rms_mm=round(float(np.sqrt((e[sel] ** 2).mean())), 2))
    return out


def evaluate(sm, photo, pose, tag, outdir, scene_full, scene_noear, targets=None, extra=None):
    """Detector-on-render region errors, the outline (with and without ears), target values; writes an overlay."""
    G = fit.groups()
    prob = fit.Problem(sm, photo, G)
    corr = fit.correspond(sm, sm.m, sm.d, pose, photo, tag, save=os.path.join(outdir, f"clay_photocam_{tag}.png"))
    q = corr["q"]
    prob.set_corr(corr)
    x = np.r_[[sm.m[k] for k in fit.MACRO_KEYS], sm.d, pose]
    rep_fit = fit.region_report(prob, x, q)
    sil_full = silhouette(sm, photo, pose, scene_full)
    sil_ne = silhouette(sm, photo, pose, scene_noear)
    out = dict(tag=tag, regions_vs_photo=region_errors(photo, q, "pts"), regions_vs_targets=region_errors(photo, q, "target"),
               fit_groups={g: {k: v for k, v in r.items() if k.startswith("detector")} for g, r in rep_fit.items()},
               outline_with_ears=outline_parts(sil_full), outline_skin=outline_parts(sil_ne))
    if targets is not None:
        fr = Frame(1.007)
        hm = HeadMesh(sm.base)
        eyes = dict(L=np.array(group_exact("helper-l-eye")), R=np.array(group_exact("helper-r-eye")))
        Pmm = sm.full() * 1000.0
        eyes["sphere"] = proxy_eye_spheres(sm.base * 1000.0)
        eyes["shift"] = {s: (Pmm - sm.base * 1000.0)[eyes[s]].mean(0) for s in "LR"}
        te = TargetEval(fr, hm, eyes)
        te.update(Pmm)
        tv = {}
        for t in targets:
            r = te.evaluate(t)
            tv[t["id"]] = None if r is None else round(float(r.value), 2)
        out["targets"] = tv
        out["targets_in_band"] = target_summary(targets, tv)
    if extra:
        out.update(extra)
    overlay(photo, q, sil_ne, os.path.join(outdir, f"overlay_{tag}.png"))
    return out, corr


def target_summary(targets, tv):
    n_in, n, miss = 0, 0, []
    for t in targets:
        v = tv.get(t["id"])
        if v is None:
            continue
        lo_, hi_ = t["band"]
        lo_ = -1e9 if lo_ is None else lo_
        hi_ = 1e9 if hi_ is None else hi_
        n += 1
        if lo_ - 1e-6 <= v <= hi_ + 1e-6:
            n_in += 1
        else:
            miss.append((t["id"], t["conf"], v, t["band"]))
    return dict(in_band=n_in, total=n, outside=miss)


def overlay(photo, q, sil, path, box=None, sc=None):
    from PIL import Image, ImageDraw
    from scipy.ndimage import binary_dilation
    box = box or sil.get("box") or photo.box
    sc = sc or sil.get("sc", 0.5)
    im = fit.photo_crop(box, sc)
    a = np.asarray(im).copy()
    edge = fit.silhouette_edges(np.where(sil["mask"], 0, -1))
    a[binary_dilation(edge, iterations=1)] = (0, 230, 255)
    im = Image.fromarray(a)
    dr = ImageDraw.Draw(im)
    tr = lambda p: ((p[0] - box[0]) * sc, (p[1] - box[1]) * sc)     # noqa: E731
    o = np.array(fit.OVAL + fit.OVAL[:1])
    dr.line([tr(p) for p in photo.pts[o, :2]], fill=(60, 255, 60), width=3)
    for i in range(468):
        p, qq = tr(photo.pts[i]), tr(q[i])
        dr.line([p, qq], fill=(255, 80, 80), width=1)
        dr.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], fill=(60, 255, 60))
        dr.ellipse([qq[0] - 2, qq[1] - 2, qq[0] + 2, qq[1] + 2], fill=(255, 40, 40))
    for p, nn, e, k, fy, ins in zip(sil["S"], sil["n"], sil["err"], sil["ppm"], sil["fy"], sil.get("inset", np.zeros(len(sil["fy"])))):
        if np.isfinite(e):
            b = outline_band(fy, ins)
            col = (255, 255, 0) if b is None or b[0] - 0.5 <= e <= b[1] + 0.5 else (255, 120, 0)
            dr.line([tr(p), tr(p + nn * e * k)], fill=col, width=2)
    dr.rectangle([0, 0, 1000, 70], fill=(0, 0, 0))
    dr.text((8, 6), "green: photo's MediaPipe points + outline   red: MediaPipe on the clay render at the photo camera (lines = error)", fill=(255, 255, 255))
    dr.text((8, 26), "cyan: the clay head's silhouette (bald, beardless skin, ears hidden: his are under the hair)", fill=(255, 255, 255))
    dr.text((8, 46), "yellow / orange: photo outline -> silhouette, inside / outside the beard-and-hair band", fill=(255, 255, 255))
    im.save(path)


# ---------------------------------------------------------------------------------------------------------------
# Stage B main
# ---------------------------------------------------------------------------------------------------------------
def stage_b(argv):
    o = opts(argv)
    face_path = o.get("face", FACE_DEFAULT)
    out = o.get("out", os.path.join(WORK, "kai_shape.npz"))
    rounds = int(o.get("rounds", 8))
    inner = int(o.get("inner", 6))
    lam = float(o.get("lam", 10.0))
    wd = o.get("work", WORK)
    os.makedirs(wd, exist_ok=True)
    face = load_face(face_path)
    scale = float(face.get("likenessScale", 1.007))
    spec = json.load(open(o.get("targets", TARGETS)))
    targets = expand_targets(spec)
    T0 = time.time()
    model, m, d, pose = setup_model(face)
    photo = fit.Photo()
    G = fit.groups()
    sm = ShapedModel(model, m, d)
    alar = float(o.get("alar", 12))
    pre = np.zeros_like(sm.base)
    if alar > 0:
        # the face file's alarSoften (build_humans.soften_alar) baked into the layer's base: the build then needs no
        # separate pass, and the dense layer is solved on the head the build would have made
        pre = alar_soften_offsets(sm.base, alar)
        sm.base = sm.base + pre
    dn = Dense(sm, photo, G, targets, lam=lam, scale=scale)
    dn.pre_mm = pre * 1000.0
    dn.w_sil = float(o.get("wsil", 1.0))
    dn.w_t = float(o.get("wt", 1.0))
    dn.pose = pose.copy()
    dn.pose0 = pose.copy()
    dn.fixed_pose = o.get("pose", "fixed") == "fixed"        # --pose=solve: re-solve it every round (outline-aware)
    dn.scene_noear = scene_without(model.S, dn.ears)
    dn.beard_ref = None
    if o.get("beard", "built") == "built":
        # the beard band from the built beard (fix round 4): on the beard the photo's outline is the beard's surface,
        # and the round-3 build's beard, rendered in the game at this camera, reads (MediaPipe's oval, the same detector
        # on both bearded faces) BEARD_SHIFT mm inside the photo's on the jaw and chin; its skin silhouette (this head
        # before the layer) plus that shift is where the skin goes, +-1.5 mm, so the shipped beard lands on his
        s0 = silhouette(sm, photo, dn.pose, dn.scene_noear)
        dn.beard_ref = s0["err"] + float(o.get("beard_shift", 1.3))
    print(f"stage B: {dn.ncol} unknowns, H {int(dn.hm.inH.sum())} vertices, {len(targets)} targets, setup {time.time() - T0:.0f}s", flush=True)
    log = dict(face=face_path, lam=lam, rounds=[])
    for rnd in range(rounds):
        T = time.time()
        dn.refresh(rnd, wd)
        reps = []
        for it in range(inner):
            reps.append(dn.step())
        D = dn.D()
        ent = dict(round=rnd + 1, seconds=round(time.time() - T), energy=reps,
                   pose=dict(rvec_deg=np.degrees(dn.pose[:3]).round(2).tolist(), t=dn.pose[3:6].round(4).tolist(), s=round(float(dn.pose[6]), 4)),
                   max_offset_mm=round(float(np.linalg.norm(D, axis=1).max()), 2),
                   patches=dict(eye=dn.u[dn.pc["eye"]:dn.pc["eye"] + 3].round(2).tolist(), ear=dn.u[dn.pc["ear"]:dn.pc["ear"] + 3].round(2).tolist(),
                                lip=dn.u[dn.pc["lip"]:dn.pc["lip"] + 2].round(2).tolist()),
                   detector_regions=region_errors(photo, dn.corr["q"], "pts"),
                   outline=outline_parts(dn.sil))
        log["rounds"].append(ent)
        print(f"round {rnd + 1}: {ent['seconds']}s energy {reps[-1]} max |D| {ent['max_offset_mm']} patches {ent['patches']}", flush=True)
        print("    regions (render, last round's)", ent["detector_regions"], flush=True)
        print("    outline", {k: v.get("outside_band_rms_mm") for k, v in ent["outline"].items()}, flush=True)
        json.dump(log, open(os.path.join(wd, "stage_b.json"), "w"), indent=1)
        np.save(os.path.join(wd, "u_stage_b.npy"), dn.u)
    # the final targets' values
    dn.system()
    meta = dict(version=VERSION, method="likeness/dense_fit.py stage B (METHOD.md: thin plate, symmetric, rigid patches, photo landmarks + outline band, sculptor targets)",
                face=os.path.basename(face_path), details_digest=hashlib.sha1(json.dumps(face["details"], sort_keys=True).encode()).hexdigest()[:12],
                targets_digest=hashlib.sha1(open(o.get("targets", TARGETS), "rb").read()).hexdigest()[:12], lam=lam, rounds=rounds,
                mediapipe="0.10.21", views=["kai_ref (front camera, 23 deg above)"], date=time.strftime("%Y-%m-%d"),
                pose=dict(rvec=dn.pose[:3].tolist(), t=dn.pose[3:6].tolist(), s=float(dn.pose[6])),
                targets={k: (None if v is None else round(float(v), 2)) for k, v in dn.tvals.items()})
    idx = dn.to_npz(out, meta)
    np.save(os.path.join(wd, "pose_stage_b.npy"), dn.pose)
    photo_camera(sm, dn.pose, os.path.join(wd, "photo_camera.json"))
    print(f"stage B done {time.time() - T0:.0f}s -> {out} ({len(idx)} vertices)")
    return dn


def photo_camera(sm, pose, path=None):
    """The photo's camera in the shaped head's frame (game_compare.photo_camera's convention: metres from the eye-helper
    midpoint, x his left, y up, z forward), for face_studio's 'photo' view of this candidate."""
    P = sm.full()
    eyes = 0.5 * (P[mh.group_vertices("helper-l-eye")].mean(0) + P[mh.group_vertices("helper-r-eye")].mean(0))
    R = fit.rodrigues(pose[:3])
    t, s = pose[3:6], pose[6]
    cam = sm.c + R.T @ (-t) / s
    fwd, right = R[2], R[0]
    zc = -fwd
    xl = np.cross([0, 1, 0], zc)
    xl /= np.linalg.norm(xl)
    roll = np.degrees(np.arctan2(np.cross(xl, right) @ fwd, xl @ right))
    K = np.load(os.path.join(LK, "lifted.npz"))["K"]
    fov = 2 * np.degrees(np.arctan(1850.0 / K[1, 1]))
    out = dict(cam_from_eyes=(cam - eyes).round(5).tolist(), aim_from_eyes=(cam - eyes + fwd * 0.3).round(5).tolist(),
               fov_deg=round(float(fov), 3), roll_deg=round(float(roll), 3), principal_px=K[:2, 2].tolist(), half_px=1850.0,
               distance_m=round(float(np.linalg.norm(cam - eyes)), 4), scale=round(float(s), 4))
    if path:
        json.dump(out, open(path, "w"), indent=1)
    return out


# ---------------------------------------------------------------------------------------------------------------
# reports
# ---------------------------------------------------------------------------------------------------------------
def report(argv):
    """Pose-only fit of a face file (with an optional shape) at the photo's camera, then evaluate()."""
    from scipy.optimize import least_squares
    o = opts(argv)
    face_path = o.get("face", FACE_DEFAULT)
    face = load_face(face_path)
    shape = o.get("shape") or (os.path.join(os.path.dirname(os.path.abspath(face_path)), face["shape"]) if face.get("shape") else None)
    tag = o.get("tag", "report")
    wd = o.get("work", os.path.join(WORK, "report"))
    os.makedirs(wd, exist_ok=True)
    spec = json.load(open(o.get("targets", TARGETS)))
    targets = expand_targets(spec)
    model, m, d, pose = setup_model(face)
    sm = ShapedModel(model, m, d)
    if shape:
        sh = mh.shape_target(shape)
        Dm = np.zeros_like(sm.base)
        Dm[sh[0]] = sh[1] * 0.1
        sm.Dm = Dm
    if face.get("alarSoften") and not shape:
        # the installed r3 face: the build softens the nose wings after the sculpt (build_humans.soften_alar)
        sm.Dm = alar_soften_offsets(sm.base, float(face["alarSoften"]))
    photo = fit.Photo()
    ears = ear_vertices(sm.base)
    scene_ne = scene_without(model.S, ears)
    if o.get("pose", "fixed") == "solve":
        pose = pose_solve(sm, photo, pose, scene_ne, iters=2)
    rep, corr = evaluate(sm, photo, pose, tag, wd, model.S, scene_ne, targets)
    json.dump(rep, open(os.path.join(wd, f"report_{tag}.json"), "w"), indent=1)
    np.save(os.path.join(wd, f"pose_{tag}.npy"), pose)
    photo_camera(sm, pose, os.path.join(wd, f"photo_camera_{tag}.json"))
    print(json.dumps({k: rep[k] for k in ("regions_vs_photo", "outline_skin")}, indent=0))
    print("targets in band", rep["targets_in_band"]["in_band"], "/", rep["targets_in_band"]["total"])
    return rep


def photo_camera_exact(sm, pose, path=None):
    """The fit's camera (pose) for this head in face_studio's terms, anchored on the game's eye bones (the eye proxy's
    sphere centres) instead of the eye helpers, with no pupil-distance dolly: FS_PHOTO_CAM / AIM / ROLL / FOV of this
    file and FS_PHOTO_IOD=0 render the shipped build from exactly the camera the fit saw (fix round 4)."""
    from scipy.spatial.transform import Rotation
    P = sm.full()
    sph = proxy_eye_spheres(P * 1000.0)
    eyes = 0.5 * (sph["L"][0] + sph["R"][0]) / 1000.0
    R = fit.rodrigues(pose[:3])
    t, sc = pose[3:6], pose[6]
    cam = sm.c + R.T @ (-t) / sc
    fwd, right = R[2], R[0]
    zc = -fwd
    xl = np.cross([0, 1, 0], zc)
    xl /= np.linalg.norm(xl)
    roll = np.degrees(np.arctan2(np.cross(xl, right) @ fwd, xl @ right))
    K = np.load(os.path.join(LK, "lifted.npz"))["K"]
    fov = 2 * np.degrees(np.arctan(1850.0 / K[1, 1]))
    out = dict(cam_from_eyes=(cam - eyes).round(5).tolist(), aim_from_eyes=(cam - eyes + fwd * 0.3).round(5).tolist(),
               fov_deg=round(float(fov), 3), roll_deg=round(float(roll), 3), principal_px=K[:2, 2].tolist(), half_px=1850.0,
               distance_m=round(float(np.linalg.norm(cam - eyes)), 4), scale=round(float(sc), 4), iod=0,
               notes="fit.py's camera (x.npy pose) relative to the eye bones of this head; render with FS_PHOTO_IOD=0")
    if path:
        json.dump(out, open(path, "w"), indent=1)
    return out


def pose_solve(sm, photo, pose0, scene_noear, iters=2, w_sil=0.6):
    """The photo's pose for a head (shape fixed), as stage B solves it every round: fit.py's landmark terms and priors
    plus the true silhouette's band (its surface points held), so every candidate (the installed one too) is measured
    at its own best pose by one rule."""
    from scipy.optimize import least_squares
    G = fit.groups()
    prob = fit.Problem(sm, photo, G)
    prob.pose0 = pose0.copy()
    x = np.r_[[sm.m[k] for k in fit.MACRO_KEYS], sm.d, pose0]
    n0 = 4 + prob.np
    lo, hi = prob.bounds()
    for it in range(iters):
        p = x[n0:]
        corr = fit.correspond(sm, sm.m, sm.d, p, photo, "pose")
        prob.set_corr(corr)
        sil = silhouette(sm, photo, p, scene_noear)
        Pmm = sm.full() * 1000.0
        sp_ = []
        for j, pt in enumerate(sil["pts"]):
            b_ = outline_band(sil["fy"][j], sil["inset"][j]) if pt is not None else None
            if b_ is None:
                continue
            tri, bb = pt
            sp_.append(((Pmm[tri] * bb[:, None]).sum(0) / 1000.0, sil["S"][j], sil["n"][j], sil["ppm"][j]) + b_)
        Xs = np.array([a[0] for a in sp_])

        def f(p):
            r = prob.residuals(np.r_[x[:n0], p])
            uvs = fit.proj(photo.K, fit.cam_points(Xs, sm.c, p))
            out = []
            for (X_, S_, n_, k_, lo_, hi_, w_), u_ in zip(sp_, uvs):
                d_ = float((u_ - S_) @ n_ / k_)
                out.append(w_sil * w_ * (d_ - lo_ if d_ < lo_ else (d_ - hi_ if d_ > hi_ else 0.0)))
            return np.r_[r, np.array(out)]
        r = least_squares(f, x[n0:], bounds=(lo[n0:], hi[n0:]), x_scale="jac")
        x = np.r_[x[:n0], r.x]
    return x[n0:]


def alar_soften_offsets(P, amount):
    """build_humans.soften_alar as offsets (metres) on the sculpt (numpy only, same rule), for the r3 report."""
    _, _, F = mh.base()
    eye = 0.5 * (P[mh.group_vertices("helper-l-eye")].mean(0) + P[mh.group_vertices("helper-r-eye")].mean(0))
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
    Q = P.copy()
    for _ in range(int(round(amount))):
        Q2 = Q.copy()
        for i in idx:
            n_ = nb.get(int(i))
            if n_:
                Q2[i] = Q[i] + 0.45 * w[i] * (Q[list(n_)].mean(0) - Q[i])
        Q = Q2
    return Q - P


# ---------------------------------------------------------------------------------------------------------------
# v3: the three 2026 photos at once (docs/CHARACTER_LOOK.md "Kai v3")
# ---------------------------------------------------------------------------------------------------------------
TARGETS_V3 = os.path.join(HERE, "shape_targets_v3.json")
EYE_SOFT = float(os.environ.get("EYE_SOFT", 0.0))     # v3: how much softer the skin round the lids is (0 = as elsewhere)
LIP_SEAL_MM = float(os.environ.get("LIP_SEAL_MM", 2.5))   # v3: the band round the lips' contact line that moves with it
EYE_STIFF = float(os.environ.get("EYE_STIFF", 1.5))   # v3: added stiffness round the lids (no folds over the canthi)


def setup_v3(face, shape=None):
    """fit.Model (wide: the neck under the jaw and the back of the head, for the side views) for the face file's
    macro and details, the height solved with the shape."""
    m = build_macro(face)
    model = fit.Model(mh.sculpt(fit.macro_dict(m)), wide=True)
    d = d_from_details(model, face["details"])
    model.height = solve_height(fit.macro_dict(m), model.details(d, 0.0), shape)
    model._macro.cache_clear()
    return model, m, d


def head_frame(photo, pose):
    """(rotation, scale) of the v3 head frame against the model's axes (dense_fit.Frame)."""
    return photo.R.T @ fit.rodrigues(pose[:3]), float(pose[6])


def midline_yz(sm, fr, hm):
    Pmm = sm.full() * 1000.0
    Q = fr.q(Pmm)
    sel = hm.mid & hm.inH
    return Q[sel][:, 1:3]


def report3(argv):
    """The per-photo errors of a face file (+ its shape layer) at the three photos' cameras: the front pose solved
    for this head (pose_multi), then the front regions (MediaPipe on the clay render against the photo), the front
    outline (the v3 bands), the side landmarks and silhouettes (per segment and per stretch of the profile) and the
    v3 targets. Writes report_<tag>.json, the sagittal plot, the clay renders and the private overlays."""
    import views
    o = opts(argv)
    face_path = o.get("face", FACE_DEFAULT)
    face = load_face(face_path)
    shape = o.get("shape") or (os.path.join(os.path.dirname(os.path.abspath(face_path)), face["shape"]) if face.get("shape") else None)
    if o.get("shape") == "none":
        shape = None
    tag = o.get("tag", "report")
    wd = o.get("work", os.path.join(WORK, "report3"))
    os.makedirs(wd, exist_ok=True)
    model, m, d = setup_v3(face, shape)
    sm = ShapedModel(model, m, d)
    if shape:
        sh = mh.shape_target(shape)
        Dm = np.zeros_like(sm.base)
        Dm[sh[0]] = sh[1] * 0.1
        sm.Dm = Dm
    elif face.get("alarSoften"):
        sm.Dm = alar_soften_offsets(sm.base, float(face["alarSoften"]))
    photo = fit.Photo()
    sides = views.load_sides(step=2)
    pose0 = np.load(o["pose"]) if o.get("pose") else fit.initial_pose(photo)
    if len(pose0) > 19:                        # a whole fit.py x vector: its front pose
        pose0 = pose0[4 + len(model.params):4 + len(model.params) + 7]
    prob, x, corr, sils = fit.pose_multi(sm, m, d, photo, sides, pose0[:7], rounds=int(o.get("pose_rounds", 2)), outdir=wd, tag=tag)
    n0 = 4 + prob.np
    pose = x[n0:n0 + 7]
    rep = fit.multi_report(prob, x, corr, sils)
    ears = ear_vertices(sm.base)
    scene_ne = scene_without(model.S, ears)
    sil_f = silhouette(sm, photo, pose, scene_ne)
    out = dict(tag=tag, face=face_path, shape=shape, pose=dict(rvec_deg=np.degrees(pose[:3]).round(2).tolist(), t=pose[3:6].round(4).tolist(), scale=round(float(pose[6]), 4)),
               front_regions_vs_photo_mm=region_errors(photo, corr["q"], "pts"), front_outline=outline_parts(sil_f),
               front_groups={g: {k: v for k, v in r.items() if k.startswith("detector")} for g, r in rep["front"].items()})
    for sd in sides:
        out[sd.tag] = rep[sd.tag]
    rot, k = head_frame(photo, pose)
    fr = Frame(k, rot)
    hm = HeadMesh(sm.base)
    eyes = dict(L=np.array(group_exact("helper-l-eye")), R=np.array(group_exact("helper-r-eye")))
    eyes["sphere"] = proxy_eye_spheres(sm.base * 1000.0)
    te = TargetEval(fr, hm, eyes)
    te.update(sm.full() * 1000.0)
    targets = expand_targets(json.load(open(o.get("targets", TARGETS_V3))))
    tv = {}
    for t in targets:
        r = te.evaluate(t)
        tv[t["id"]] = None if r is None else round(float(r.value), 2)
    out["targets_v3"] = tv
    out["targets_v3_in_band"] = target_summary(targets, tv)
    # profile numbers in the head frame (the model's skin midline): what the sculptor tabulated
    Q = te.Q
    prof = {}
    for y in (55, 45, 35, 25, 15, 5, 0, -5, -10, -15, -20, -25):
        r = te.z(0.0, float(y))
        prof[str(y)] = None if r is None else round(r.value, 1)
    out["midline_z_at_y"] = prof
    out["landmarks_head_mm"] = {nm: [round(float(v), 1) for v in (((sm.full()[model.hv][prob.tv[i]] * prob.bw[i][:, None]).sum(0) * 1000.0 - fr.origin(sm.full() * 1000.0)) @ rot.T) * k]
                                for nm, i in (("Prn", 1), ("Sn", 2), ("Li", 17), ("Sto", 13), ("Me", 152), ("Ex_L", 263), ("N", 168))}
    out["ears_head_mm"] = {nm: [round(float(v), 1) for v in ((sm.full()[vv] * 1000.0 - fr.origin(sm.full() * 1000.0)) @ rot.T) * k] for nm, vv in views.EAR_PICKS.items()}
    json.dump(out, open(os.path.join(wd, f"report_{tag}.json"), "w"), indent=1)
    np.save(os.path.join(wd, f"x_{tag}.npy"), x)
    overlay(photo, corr["q"], sil_f, os.path.join(wd, f"front_{tag}.jpg"))
    fit.side_pictures(prob, x, sils, wd)
    for sd in sides:
        for nm in (f"side_{sd.tag}.jpg", f"render_{sd.tag}.png"):
            if os.path.exists(os.path.join(wd, nm)):
                os.replace(os.path.join(wd, nm), os.path.join(wd, nm.replace(sd.tag, sd.tag + "_" + tag)))
    curves = {sd.tag: views.mask_contour_sagittal(sd, sil) for sd, sil in zip(sides, sils)}
    views.sagittal_plot(os.path.join(wd, f"sagittal_{tag}.png"), curves, midline_yz(sm, fr, hm), title=tag)
    print(json.dumps({k: out[k] for k in ("pose", "front_regions_vs_photo_mm")}, indent=0))
    for sd in sides:
        print(sd.tag, "lm", out[sd.tag]["landmarks_mm"])
        print(sd.tag, "profile", {k_: v["outside_band_median_mm"] for k_, v in out[sd.tag]["profile"].items()})
    print("front outline", {k_: v.get("outside_band_rms_mm") for k_, v in out["front_outline"].items()})
    print("targets in band", out["targets_v3_in_band"]["in_band"], "/", out["targets_v3_in_band"]["total"], out["targets_v3_in_band"]["outside"])
    return out


def stage_b3(argv):
    """The dense layer against the three photos at once (v3): the front photo's landmarks and outline at its own
    camera (fit.py's multi-view pose, x.npy), each side photo's landmarks and silhouette at its own camera
    (views.py), the v3 targets (shape_targets_v3.json) for what no photo sees; the regularisers, patches and bounds of
    stage B."""
    import views
    o = opts(argv)
    face_path = o["face"]
    out = o.get("out", os.path.join(WORK, "kai_shape.npz"))
    rounds = int(o.get("rounds", 8))
    inner = int(o.get("inner", 6))
    lam = float(o.get("lam", 10.0))
    wd = o.get("work", WORK)
    os.makedirs(wd, exist_ok=True)
    face = load_face(face_path)
    T0 = time.time()
    model, m, d = setup_v3(face)
    x0 = np.load(o.get("x", os.path.join(fit.OUT, "fit", "x.npy")))
    n0 = 4 + len(model.params)
    pose = x0[n0:n0 + 7].copy()
    photo = fit.Photo()
    G = fit.groups()
    sm = ShapedModel(model, m, d)
    alar = float(o.get("alar", 12))
    pre = np.zeros_like(sm.base)
    if alar > 0:
        pre = alar_soften_offsets(sm.base, alar)
        sm.base = sm.base + pre
    sides = views.load_sides(step=int(o.get("step", 2)))
    rot, k = head_frame(photo, pose)
    spec_path = o.get("targets", TARGETS_V3)
    targets = expand_targets(json.load(open(spec_path)))
    dn = Dense(sm, photo, G, targets, lam=lam, scale=k, sides=sides, rot=rot)
    dn.front = views.Front(photo)
    dn.side_scenes = [views.side_scene(sm.full(), dn.front, pose, sm.c) for _ in sides]
    dn.pre_mm = pre * 1000.0
    dn.w_sil = float(o.get("wsil", 1.0))
    dn.w_t = float(o.get("wt", 1.0))
    dn.w_slm = float(o.get("wslm", 1.0))
    dn.w_ssil = float(o.get("wssil", 1.0))
    dn.pose = pose.copy()
    dn.pose0 = pose.copy()
    dn.fixed_pose = True
    dn.scene_noear = scene_without(model.S, dn.ears)
    dn.beard_ref = None
    print(f"stage B3: {dn.ncol} unknowns, H {int(dn.hm.inH.sum())} vertices, {len(targets)} targets, {sum(len(sd.S) for sd in sides)} side samples, setup {time.time() - T0:.0f}s", flush=True)
    log = dict(face=face_path, lam=lam, rounds=[])
    for rnd in range(rounds):
        T = time.time()
        dn.refresh(rnd, wd)
        reps = [dn.step() for _ in range(inner)]
        D = dn.D()
        ent = dict(round=rnd + 1, seconds=round(time.time() - T), energy=reps,
                   max_offset_mm=round(float(np.linalg.norm(D, axis=1).max()), 2),
                   patches=dict(eye=dn.u[dn.pc["eye"]:dn.pc["eye"] + 3].round(2).tolist(), ear=dn.u[dn.pc["ear"]:dn.pc["ear"] + 3].round(2).tolist(),
                                lip=dn.u[dn.pc["lip"]:dn.pc["lip"] + 2].round(2).tolist()),
                   detector_regions=region_errors(photo, dn.corr["q"], "pts"),
                   outline=outline_parts(dn.sil),
                   sides={sd.tag: views.profile_parts(sd, sil["err"]) for sd, sil in zip(sides, dn.side_sil)})
        log["rounds"].append(ent)
        print(f"round {rnd + 1}: {ent['seconds']}s energy {reps[-1]} max |D| {ent['max_offset_mm']} patches {ent['patches']}", flush=True)
        print("    regions (render, last round's)", ent["detector_regions"], flush=True)
        print("    outline", {k_: v.get("outside_band_rms_mm") for k_, v in ent["outline"].items()}, flush=True)
        for sd in sides:
            print("   ", sd.tag, {k_: v["outside_band_median_mm"] for k_, v in ent["sides"][sd.tag].items()}, flush=True)
        json.dump(log, open(os.path.join(wd, "stage_b3.json"), "w"), indent=1)
        np.save(os.path.join(wd, "u_stage_b3.npy"), dn.u)
    dn.system()
    meta = dict(version=VERSION, method="likeness/dense_fit.py stage_b3 (v3: the front photo's landmarks + outline at its camera, both side photos' landmarks + silhouettes at theirs, shape_targets_v3.json; thin plate, symmetric, rigid patches)",
                face=os.path.basename(face_path), details_digest=hashlib.sha1(json.dumps(face["details"], sort_keys=True).encode()).hexdigest()[:12],
                targets_digest=hashlib.sha1(open(spec_path, "rb").read()).hexdigest()[:12], lam=lam, rounds=rounds,
                mediapipe="0.10.21", views=["kai_ref_front (front camera, 8 deg above, at rest)", "kai_ref_side1 (his right, 16 deg above)", "kai_ref_side2 (his left, level)"],
                date=time.strftime("%Y-%m-%d"), pose=dict(rvec=pose[:3].tolist(), t=pose[3:6].tolist(), s=float(pose[6])),
                head_scale_per_build_mm=k, targets={k_: (None if v is None else round(float(v), 2)) for k_, v in dn.tvals.items()})
    idx = dn.to_npz(out, meta)
    print(f"stage B3 done {time.time() - T0:.0f}s -> {out} ({len(idx)} vertices)")
    return dn


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "stage_a":
        stage_a(sys.argv[2:])
    elif cmd == "stage_b":
        stage_b(sys.argv[2:])
    elif cmd == "report":
        report(sys.argv[2:])
    elif cmd == "report3":
        report3(sys.argv[2:])
    elif cmd == "stage_b3":
        stage_b3(sys.argv[2:])
    else:
        print(__doc__)
