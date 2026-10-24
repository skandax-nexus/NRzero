"""likeness:views - the multi-view data of the v3 fit (docs/CHARACTER_LOOK.md, "Kai v3: the three photos"): the FRONT
photo (measure.py's folder, LIKENESS_DIR: lifted.npz, measure.json, fit_inputs_front.json) and the two SIDE photos
(the likeness:sides step's sides_targets.json, LIKENESS_SIDES) in ONE head frame, every camera chained to the model's
pose, the side silhouettes found by analysis by synthesis, the profile and ear landmarks on the mesh.

Frames:
  model     the MakeHuman sculpt, metres, MH axes (x his left, y up, z forward);
  front     fit.py's pose (rvec, t, scale about the model's eye midpoint c) takes model points into the front photo's
            OpenCV camera (metres): Xc = s R (X - c) + t;
  head      the front measurement's head frame, mm: origin the midpoint of the inner eye corners (MediaPipe 133 / 362),
            x his left, y up, z forward; Xhead = 1000 R_f^T (Xc - t_f) - eyes_mid (lifted.npz R, t, eyes_mid);
  side      each side photo's camera (sides_targets.json photos.<tag>.camera: K, R, t, mm, UN-MIRRORED pixels):
            Xs = R_s Xhead + t_s, refined by a small (rvec, t) delta held to the bundle's pose covariance.
So every view is one affine map of the model points (model metres -> camera units) and a pinhole K: the slider fit
(fit.py) and the dense layer (dense_fit.py) use the same projections and Jacobians for all three photos.

The side terms:
  - landmarks seen from the side: the outer eye corner (MediaPipe 33 / 263), the alar crease (129 / 358), and the ear
    (tragus, superaurale, subaurale, postaurale, otobasion superius / inferius: base-mesh vertices on the MakeHuman ear,
    EAR_PICKS, mirrored for his right ear); each with the pick's sigma plus the mesh point's own uncertainty;
  - the silhouette: the head is rendered (raster.py, ears included, neck cut below the throat) at the side camera; for
    every true-silhouette sample of the photo's outline (segments face_profile, other = the columella, beard_profile,
    hair_top, hair_back) the signed distance along the outline's normal to the render's silhouette (mm, + = the render
    outside his outline) and the surface point there. Bands take the hair and the beard off (SIDE_BANDS): the face
    profile is skin (the brow hairs at the glabella allowed), the moustache 6 +- 2.5 mm, the visible lower lip skin, the
    beard under the lip growing to 13 +- 4 at the chin front and 18 +- 5 under it (the side step's estimates), the sleek
    hair 2 -> 7.5 mm back from the hairline, the gathered hair at the back 10 +- 6; the bun, the nape curls, the collar
    and his right side's beard hanging onto the neck (side1 below y -116) carry no term.
Nothing here holds photo pixels: the outlines and landmarks are the measurement's derived numbers.
"""
import json
import os

import numpy as np

import fit
import raster

SIDES = os.environ.get("LIKENESS_SIDES", os.path.join(os.path.dirname(os.path.abspath(fit.LK)), "sides"))
SIDE_TAGS = ("side1", "side2")

# MakeHuman base-mesh vertices of the ear landmarks (his LEFT ear; picked on a clay side render of the shipped head,
# fix round 4: the helix top, the lobe's bottom, the helix's back, the tragus, the helix root, the lobe attachment)
EAR_PICKS = dict(sa=12012, sba=12365, pa=12018, t=12207, obs=12024, obi=12013)
# landmarks of the side photos -> MediaPipe index (his left, his right)
# (the side step's alar crease 'Ac' is not MediaPipe's alare 358 / 129: the crease lies several mm deeper in the same
# frontal x / y, so it is not used)
MP_SIDE = dict(Ex=(263, 33))
SEG_POINTS = 25               # a segment's weight in samples (views.Side)
EAR_MODEL_SD_MM = 3.0         # the mesh point's own uncertainty (the pick on the MakeHuman ear against his)
FACE_MODEL_SD_MM = 1.5


def rodrigues(r):
    return fit.rodrigues(np.asarray(r, float))


class Front:
    """The front photo's head frame (fit.Photo's lifted.npz): model -> head mm through fit.py's pose."""

    def __init__(self, photo):
        self.R, self.t = photo.R, photo.t
        self.em = photo.eyes_mid * 1000.0           # mm (template frame)

    def affine(self, pose, c):
        """(A, b): front camera metres = X @ A.T + b for model metres X."""
        R = rodrigues(pose[:3])
        s = pose[6]
        A = s * R
        return A, pose[3:6] - A @ c

    def head_affine(self, pose, c):
        """(A, b): head-frame mm = X @ A.T + b."""
        A, b = self.affine(pose, c)
        return 1000.0 * self.R.T @ A, 1000.0 * self.R.T @ (b - self.t) - self.em


def side_band(tag, seg, y, z):
    """(lo, hi, weight) of the skin's signed distance (mm, + = render outside his outline) for an outline sample of
    segment seg at sagittal (y, z) head mm, or None (no term)."""
    if seg in ("face_profile", "other"):
        if tag == "side1" and seg == "face_profile" and -15 < y < 12:
            # the radix from 16 deg above: an off-midline contour (the side step and the sculptor read it from side2,
            # the level camera); the two photos disagree there by up to 8 mm
            return (-1.5, 1.5, 0.3)
        if seg == "face_profile" and 4 < y < 24:
            return (-3.0, 1.0, 1.0)          # the glabella: brow-head hairs reach the outline
        if y > 50:
            th = float(np.interp(y, [50, 60, 75], [0.5, 3.0, 6.0]))       # past the trichion: hair begins
            return (-th - 2.0, -th + 1.5, 0.6)
        return (-1.2, 1.2, 1.0)
    if seg == "beard_profile":
        if tag == "side1" and y < -116:
            return None                       # his right: the beard on the side of the neck (seen from above)
        if z < -30:
            return None                       # the beard underside meeting the collar / throat (posture)
        if y > -57:                           # the moustache over the upper lip (starts at Sn)
            th = float(np.interp(y, [-46, -42], [6.0, 2.0]))
            return (-th - 2.5, -th + 2.0, 0.6)
        if y > -71 and z > 18:                # the visible lower lip
            return (-2.0, 1.2, 0.8)
        if y > -112 and z > 10:               # under the lip -> the chin front
            th = float(np.interp(y, [-95, -72], [13.0, 4.0]))
            sd = float(np.interp(y, [-95, -72], [4.0, 2.5]))
            return (-th - sd, -th + sd, 0.5)
        th = float(np.interp(z, [-30, -5, 10], [12.0, 18.0, 15.0]))       # under the chin
        return (-th - 5.0, -th + 5.0, 0.35)
    if seg == "hair_top":
        th = float(np.interp(z, [-15, 0, 10], [7.5, 3.0, 1.5]))           # the sleek hair, thin at the hairline
        return (-th - 2.5, -th + 2.0, 0.5)
    if seg == "hair_back":
        if y < -15 or y > 25:
            return None                       # the nape curls / collar; the bun and the hair gathered into it
        # the long hair gathered up over the occiput into the bun, and the curls: 3-25 mm (the two photos' back
        # outlines differ by up to 20 mm: the mass sits toward his right); the skull's length is the targets' too
        return (-25.0, -3.0, 0.3)
    return None


class Side:
    """One side photo: camera (with its refinement delta), landmarks, the outline samples with normals and bands."""

    def __init__(self, tag, T=None, step=2):
        T = T or json.load(open(os.path.join(SIDES, "sides_targets.json")))
        ph = T["photos"][tag]
        cam = ph["camera"]
        self.tag = tag
        self.K = np.array(cam["K"], float)
        self.R0 = np.array(cam["R"], float)
        self.t0 = np.array(cam["t"], float)
        self.rvec0 = fit.rvec(self.R0)
        cov = np.array(cam["pose_cov_rvec_t"], float)
        cov = cov + np.diag([1e-6] * 3 + [1e-2] * 3)
        self.Linv = np.linalg.inv(np.linalg.cholesky(cov))
        self.W, self.H = 1440, 1920
        self.ppm0 = float(cam["px_per_mm_at_origin"])
        self.near = 1 if tag == "side2" else -1            # side2 sees his left (x > 0)
        # landmarks used (lateral ones and the ear; the profile is the silhouette's)
        self.lm = {}
        for k, v in ph["landmarks"].items():
            if k in EAR_PICKS or k in MP_SIDE:
                self.lm[k] = dict(px=np.array(v["px"], float), sigma=float(v.get("sigma_px", 6)), conf=float(v.get("confidence_value", 0.6)),
                                  mm=v.get("mm"))
        # outline samples (true silhouette) with outward normals
        o = ph["outline"]
        px = np.array(o["px"], float)
        n = len(px)
        d = np.roll(px, -2, 0) - np.roll(px, 2, 0)
        area = 0.5 * np.sum(px[:, 0] * np.roll(px[:, 1], -1) - np.roll(px[:, 0], -1) * px[:, 1])
        nrm = np.c_[d[:, 1], -d[:, 0]] * (1.0 if area > 0 else -1.0)
        nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
        # check against the polygon: a step along the normal must leave it
        from matplotlib.path import Path
        pth = Path(px)
        out = ~pth.contains_points(px + 4 * nrm)
        if out.mean() < 0.5:
            nrm = -nrm
        keep = []
        for i in range(0, n, step):
            if not o["true_silhouette"][i]:
                continue
            seg = o["segment"][i]
            yz = o["back_plane_yz_mm"][i] if seg == "hair_back" else o["sagittal_yz_mm"][i]
            if yz is None:
                continue
            b = side_band(tag, seg, yz[0], yz[1])
            if b is None:
                continue
            keep.append((i, seg, yz[0], yz[1]) + b)
        self.idx = np.array([k[0] for k in keep])
        self.S = px[self.idx]
        self.n = nrm[self.idx]
        self.seg = np.array([k[1] for k in keep])
        self.yz = np.array([[k[2], k[3]] for k in keep])
        self.band = np.array([[k[4], k[5], k[6]] for k in keep])
        # each segment weighs about as much as SEG_POINTS samples, however finely the outline is sampled
        for sg in set(self.seg):
            k = self.seg == sg
            self.band[k, 2] *= min(1.0, np.sqrt(SEG_POINTS / k.sum()))
        self.delta = np.zeros(6)

    # ---- camera ----
    def cam(self, delta=None):
        dl = self.delta if delta is None else delta
        return rodrigues(self.rvec0 + dl[:3]), self.t0 + dl[3:6]

    def affine(self, front, pose, c, delta=None):
        """(A, b): side camera mm = X @ A.T + b for model metres X."""
        Ah, bh = front.head_affine(pose, c)
        R, t = self.cam(delta)
        return R @ Ah, R @ bh + t

    def prior(self, delta):
        return self.Linv @ delta

    # ---- the mesh points of the landmarks ----
    def lm_points(self, mirror, table):
        """{name: [(vertex ids (k,), weights (k,))]} on the side this photo sees; table: mp_to_mh 'front' (v, w)."""
        out = {}
        for k in self.lm:
            if k in EAR_PICKS:
                v = EAR_PICKS[k]
                if self.near < 0:
                    v = int(mirror[v])
                out[k] = (np.array([v]), np.array([1.0]))
            else:
                i = MP_SIDE[k][0 if self.near > 0 else 1]
                out[k] = (np.array(table["v"][i]), np.array(table["w"][i]))
        return out


def load_sides(tags=SIDE_TAGS, step=2):
    T = json.load(open(os.path.join(SIDES, "sides_targets.json")))
    return [Side(t, T, step) for t in tags]


def project_affine(K, A, b, X):
    """Pixels (n, 2), camera points (n, 3) and the image Jacobian per model metre (n, 2, 3) of model points X."""
    Xc = X @ A.T + b
    z = Xc[:, 2]
    uv = np.c_[K[0, 0] * Xc[:, 0] / z + K[0, 2], K[1, 1] * Xc[:, 1] / z + K[1, 2]]
    Juv = np.zeros((len(Xc), 2, 3))
    Juv[:, 0, 0] = K[0, 0] / z
    Juv[:, 0, 2] = -K[0, 0] * Xc[:, 0] / z ** 2
    Juv[:, 1, 1] = K[1, 1] / z
    Juv[:, 1, 2] = -K[1, 1] * Xc[:, 1] / z ** 2
    return uv, Xc, Juv @ A


def side_scene(P, front, pose, c, cut_mm=-150.0):
    """The raster scene for the side views: the body above the neck joint - 35 mm, the eyes, the ears; the neck under
    the jaw kept (the profile's under-chin) down to cut_mm (head-frame y, below his throat)."""
    S = raster.head_scene(P, neck_drop=0.06, jaw_cut=False)
    Ah, bh = front.head_affine(pose, c)
    y = (P @ Ah.T + bh)[:, 1]
    bad = (y[S.tris] < cut_mm).all(1)
    S.tris = S.tris[~bad]
    S.grp = S.grp[~bad]
    S.verts = np.unique(S.tris)
    return S


def silhouette(P, scene, side, front, pose, c, sc=0.5, reach_mm=45.0, want_img=False):
    """The head's silhouette at a side camera against the photo's outline samples: per sample the signed distance (mm,
    + = render outside) and the surface point (scene triangle's vertex ids, barycentrics), the mm per px there."""
    A, b = side.affine(front, pose, c)
    uv_all, Xc_all, _ = project_affine(side.K, A, b, P[scene.verts])
    lo, hi = uv_all.min(0) - 60, uv_all.max(0) + 60
    u0, v0 = int(max(lo[0], -400)), int(max(lo[1], -400))
    u1, v1 = int(min(hi[0], side.W + 400)), int(min(hi[1], side.H + 400))
    Kc = side.K.copy()
    Kc[0, 2] -= u0
    Kc[1, 2] -= v0
    Kc[:2] *= sc
    Wc, Hc = int((u1 - u0) * sc), int((v1 - v0) * sc)
    Pc = P @ A.T + b
    img, buf = raster.render(Pc, scene, Kc, np.eye(3), np.zeros(3), Wc, Hc) if want_img else (None, None)
    if buf is None:
        uv, z = raster.project(Pc, Kc, np.eye(3), np.zeros(3))
        tid, bar, zb = raster.rasterise(uv, z, scene.tris, Wc, Hc)
        buf = dict(tri=tid, bary=bar, depth=zb)
    tid = buf["tri"]
    mask = tid >= 0
    zmed = float(np.median(Xc_all[:, 2]))
    ppm = side.K[0, 0] / zmed                          # px per mm at the head's depth (full-resolution px)
    err, pts = [], []
    ts = np.linspace(-reach_mm, reach_mm, int(2 * reach_mm * 4) + 1)
    for p, nn, band in zip(side.S, side.n, side.band):
        q = (p[None] + ts[:, None] * ppm * nn[None] - [u0, v0]) * sc
        xi = np.clip(q[:, 0].astype(int), 0, Wc - 1)
        yi = np.clip(q[:, 1].astype(int), 0, Hc - 1)
        inside = mask[yi, xi]
        tr = np.nonzero(inside[:-1] & ~inside[1:])[0]
        if len(tr) == 0:
            err.append(np.nan)
            pts.append(None)
            continue
        centre = 0.5 * (band[0] + band[1])
        j = tr[np.argmin(np.abs(ts[tr] - centre))]
        err.append(ts[j])
        k_ = tid[yi[j], xi[j]]
        pts.append((scene.tris[k_], buf["bary"][yi[j], xi[j]].copy()))
    return dict(err=np.array(err), pts=pts, ppm=ppm, mask=mask, img=img, crop=(u0, v0, u1, v1, sc), A=A, b=b)


def side_parts(side, err):
    """Per segment: n, signed median / rms (mm), and the distance outside the band (rms)."""
    out = {}
    for s in sorted(set(side.seg)):
        k = (side.seg == s) & np.isfinite(err)
        if not k.any():
            continue
        e = err[k]
        lo, hi = side.band[k, 0], side.band[k, 1]
        ob = np.where(e < lo, e - lo, np.where(e > hi, e - hi, 0.0))
        out[s] = dict(n=int(k.sum()), signed_median_mm=round(float(np.median(e)), 2), outside_band_rms_mm=round(float(np.sqrt((ob ** 2).mean())), 2),
                      outside_band_mean_mm=round(float(ob.mean()), 2))
    return out


def profile_parts(side, err):
    """The face profile in named stretches (sagittal y of the sample): forehead, brow / glabella, radix, dorsum, tip,
    columella, moustache, lower lip, under the lip, chin front, under the chin; the signed median of the distance
    outside the band (mm, + = the build sticks out past his skin)."""
    names = [("forehead", "face_profile", 24, 60), ("glabella", "face_profile", 4, 24), ("radix_dorsum", "face_profile", -20, 4),
             ("tip", "face_profile", -32, -20), ("columella", "other", -48, -28), ("moustache", "beard_profile", -57, -40),
             ("lower_lip", "beard_profile", -71, -57), ("under_lip_chin", "beard_profile", -112, -71), ("under_chin", "beard_profile", -140, -112),
             ("hair_top", "hair_top", -200, 200), ("hair_back", "hair_back", -200, 200)]
    out = {}
    for nm, seg, y0, y1 in names:
        k = (side.seg == seg) & (side.yz[:, 0] >= y0) & (side.yz[:, 0] < y1) & np.isfinite(err)
        if not k.any():
            continue
        e = err[k]
        lo, hi = side.band[k, 0], side.band[k, 1]
        ob = np.where(e < lo, e - lo, np.where(e > hi, e - hi, 0.0))
        out[nm] = dict(n=int(k.sum()), outside_band_median_mm=round(float(np.median(ob)), 2), outside_band_rms_mm=round(float(np.sqrt((ob ** 2).mean())), 2),
                       raw_median_mm=round(float(np.median(e)), 2))
    return out


def side_overlay(side, sil, lm_uv, path, scale=0.5):
    """PRIVATE picture (photo pixels: never into the repo): the un-mirrored side photo, the render's silhouette (cyan),
    the photo outline samples (green inside their band, orange outside, a line to the render's silhouette), the
    landmarks (photo green, model red)."""
    from PIL import Image, ImageDraw, ImageOps
    from scipy.ndimage import binary_dilation
    im = ImageOps.mirror(Image.open(f"/home/user/tools/kai_ref/kai_ref_{side.tag}.jpg").convert("RGB"))
    u0, v0, u1, v1, sc = sil["crop"]
    m = sil["mask"]
    e = m & ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1))
    e = binary_dilation(e, iterations=1)
    ys, xs = np.nonzero(e)
    a = np.asarray(im).copy()
    X = (xs / sc + u0).astype(int)
    Y = (ys / sc + v0).astype(int)
    ok = (X >= 0) & (X < side.W) & (Y >= 0) & (Y < side.H)
    a[Y[ok], X[ok]] = (0, 230, 255)
    im = Image.fromarray(a)
    dr = ImageDraw.Draw(im)
    for p, nn, d, b in zip(side.S, side.n, sil["err"], side.band):
        if not np.isfinite(d):
            dr.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], outline=(255, 0, 255))
            continue
        col = (60, 255, 60) if b[0] - 0.3 <= d <= b[1] + 0.3 else (255, 140, 0)
        dr.line([tuple(p), tuple(p + nn * d * sil["ppm"])], fill=col, width=2)
        dr.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], fill=col)
    for nm, u in lm_uv.items():
        p = side.lm[nm]["px"]
        dr.line([tuple(p), tuple(u)], fill=(255, 60, 60), width=2)
        dr.ellipse([p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4], outline=(60, 255, 60), width=2)
        dr.ellipse([u[0] - 4, u[1] - 4, u[0] + 4, u[1] + 4], outline=(255, 40, 40), width=2)
        dr.text((p[0] + 6, p[1] - 6), nm, fill=(255, 255, 0))
    lo = np.maximum(side.S.min(0) - 90, 0).astype(int)
    hi = np.minimum(side.S.max(0) + 90, [side.W, side.H]).astype(int)
    im = im.crop((lo[0], lo[1], hi[0], hi[1]))
    if scale != 1.0 and max(im.size) > 1300:
        im = im.resize((int(im.size[0] * scale * 1.6), int(im.size[1] * scale * 1.6)), Image.LANCZOS)
    im.save(path, quality=88)


def mask_contour_sagittal(side, sil, x_plane=0.0, step=2):
    """The render's outer silhouette at a side camera, back-projected onto the plane x = x_plane of the head frame:
    (n, 2) (y, z) mm. Derived geometry (no pixels)."""
    import cv2
    m = sil["mask"].astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cs:
        return np.zeros((0, 2))
    c = max(cs, key=len)[:, 0, :].astype(float)[::step]
    u0, v0, _, _, sc = sil["crop"]
    px = c / sc + [u0, v0]
    R, t = side.cam()
    Kinv = np.linalg.inv(side.K)
    d = (Kinv @ np.c_[px, np.ones(len(px))].T).T @ R          # ray directions in the head frame (R^T d)
    C = -R.T @ t
    lam = (x_plane - C[0]) / d[:, 0]
    X = C + lam[:, None] * d
    return X[:, 1:3]


def sagittal_plot(path, curves, midline=None, title=""):
    """A sagittal (x = 0) plot: the photos' true silhouettes (sides_targets profile_curves_sagittal: side1 red, side2
    blue), the model's silhouettes at the same cameras (light), the model's skin midline (green). No pixels."""
    from PIL import Image, ImageDraw
    T = json.load(open(os.path.join(SIDES, "sides_targets.json")))
    SC = 3.0
    Y0, Y1, Z0, Z1 = -175, 130, -240, 60
    img = Image.new("RGB", (int((Z1 - Z0) * SC) + 1, int((Y1 - Y0) * SC) + 1), (250, 250, 250))
    dr = ImageDraw.Draw(img)
    P = lambda y, z: ((z - Z0) * SC, (Y1 - y) * SC)       # noqa: E731
    for y in range(-160, 131, 20):
        dr.line([P(y, Z0), P(y, Z1)], fill=(228, 228, 228))
        dr.text(P(y, Z0 + 1), str(y), fill=(150, 150, 150))
    for z in range(-240, 61, 20):
        dr.line([P(Y0, z), P(Y1, z)], fill=(228, 228, 228))
        dr.text(P(Y1 - 4, z), str(z), fill=(150, 150, 150))
    col = dict(side1=(220, 40, 40), side2=(40, 40, 220))
    for tag in ("side1", "side2"):
        for seg, ss in T["profile_curves_sagittal"]["curves"][tag].items():
            for s_ in ss:
                for y, z in s_:
                    a, b = P(y, z)
                    dr.ellipse([a - 1.2, b - 1.2, a + 1.2, b + 1.2], fill=col[tag])
    for tag, yz in curves.items():
        c = tuple(int(v * 0.45 + 255 * 0.55) for v in col[tag])
        for y, z in yz:
            a, b = P(y, z)
            dr.ellipse([a - 1.0, b - 1.0, a + 1.0, b + 1.0], fill=c)
    if midline is not None:
        for y, z in midline:
            a, b = P(y, z)
            dr.rectangle([a - 1.2, b - 1.2, a + 1.2, b + 1.2], fill=(0, 150, 0))
    for k, v in T["combined"].items():
        if isinstance(v, dict) and "mm" in v and abs(v["mm"][0]) < 1:
            a, b = P(v["mm"][1], v["mm"][2])
            dr.rectangle([a - 2, b - 2, a + 2, b + 2], outline=(0, 0, 0))
            dr.text((a + 4, b + 1), k, fill=(0, 0, 0))
    for k, v in T.get("estimates_under_hair", {}).items():
        if isinstance(v, dict) and "mm" in v and abs(v["mm"][0]) < 1:
            a, b = P(v["mm"][1], v["mm"][2])
            dr.rectangle([a - 2, b - 2, a + 2, b + 2], outline=(120, 0, 120))
            dr.text((a + 4, b + 1), k, fill=(120, 0, 120))
    dr.text((5, 5), title + "  photos: side1 red / side2 blue dots; the model at the same cameras: light red / light blue; green: model skin midline", fill=(0, 0, 0))
    img.save(path)
