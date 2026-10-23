"""Camera, head pose and pose-corrected frontal 3D landmarks from MediaPipe Face Mesh points on one photo.

Frames (the same as the MakeHuman base mesh, so the fit can compare vertex landmarks directly):
  head frame  metres, x = the subject's left, y = up, z = out of the face (MH's own axes).
  camera      OpenCV: x = image right, y = image down, z = viewing direction.
The head pose is a perspective PnP of the MH neutral adult male (age 32) anthropometric landmarks
(face_metric.FaceSpace.L) against the matching MediaPipe points, with the camera's focal length from EXIF and the
sensor's pixel pitch. Every MediaPipe point is then lifted: its depth is MediaPipe's own relative depth around the
PnP depth, the point is back-projected along its camera ray (this removes the selfie's perspective magnification of
the nose and centre of the face) and rotated into the head frame (this removes yaw, pitch and roll). The absolute
size comes from the iris (horizontal visible iris diameter 11.7 mm, the adult mean).
"""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
os.environ.setdefault("CAST", "nrzero")
os.environ.setdefault("MH_DATA", "/home/user/tools/mh/makehuman/data")

IRIS_MM = 11.7
# MediaPipe Face Mesh index (or indices averaged) for each face_metric landmark ("_L" = the subject's left)
MP = dict(N=[168], Prn=[1], Sn=[2], Ls=[0], Sto=[13, 14], Li=[17], Pg=[199], Me=[152],
          En_L=[362], Ex_L=[263], En_R=[133], Ex_R=[33], Al_L=[358], Al_R=[129], Ch_L=[291], Ch_R=[61],
          Go_L=[397], Go_R=[172], Br_L=[334, 282], Br_R=[105, 52])
PNP_KEYS = ["N", "Prn", "Sn", "Ls", "Sto", "Li", "En_L", "Ex_L", "En_R", "Ex_R", "Al_L", "Al_R", "Ch_L", "Ch_R"]
# face oval, from the forehead top clockwise in the image (subject's left side first)
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149,
        150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
IRIS_R, IRIS_L = list(range(468, 473)), list(range(473, 478))     # centre + 4 rim points (MediaPipe's right = subject's right)
EYE_R = dict(top=159, bottom=145, inner=133, outer=33)
EYE_L = dict(top=386, bottom=374, inner=362, outer=263)
BROW_R_UP, BROW_R_LO = [70, 63, 105, 66, 107], [46, 53, 52, 65, 55]
BROW_L_UP, BROW_L_LO = [300, 293, 334, 296, 336], [276, 283, 282, 295, 285]
LIP_OUT_UP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
LIP_OUT_LO = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]
LIP_IN_UP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]
LIP_IN_LO = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]
MIDLINE = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 11, 12, 13, 14, 15, 16, 17, 18, 200, 199, 175, 152]
F_FLIP = np.diag([1.0, -1.0, -1.0])     # MH axes -> camera axes for a face looking straight into the camera


def camera(exif_focal_mm, pixel_um, W, H):
    f = exif_focal_mm / (pixel_um * 1e-3)
    return np.array([[f, 0, W / 2], [0, f, H / 2], [0, 0, 1.0]])


def template(age=32, gender=1.0, weight=0.5, muscle=0.5):
    import face_metric as fmx
    import mh
    FS = fmx.FaceSpace()
    P = mh.sculpt(dict(gender=gender, age=fmx.mh_age(age), muscle=muscle, weight=weight))
    return FS, P


def mp_point(pts, key):
    return pts[MP[key]].mean(0)


def pnp(pts2, model3, K):
    import cv2
    ok, rv, tv = cv2.solvePnP(model3, pts2, K, None, flags=cv2.SOLVEPNP_ITERATIVE)
    ok, rv, tv = cv2.solvePnP(model3, pts2, K, None, rv, tv, useExtrinsicGuess=True, flags=cv2.SOLVEPNP_ITERATIVE)
    R = cv2.Rodrigues(rv)[0]
    proj = (K @ (R @ model3.T + tv)).T
    proj = proj[:, :2] / proj[:, 2:]
    return R, tv.ravel(), np.linalg.norm(proj - pts2, axis=1)


def euler(R_head_to_cam):
    """yaw, pitch, roll (deg) of the head relative to facing the camera squarely (see measure.json 'pose' notes)."""
    Rr = F_FLIP @ R_head_to_cam          # head rotation expressed in MH-like viewer axes (x right, y up, z to camera)
    f = Rr[:, 2]
    pitch = np.degrees(np.arcsin(np.clip(-f[1], -1, 1)))
    yaw = np.degrees(np.arctan2(f[0], f[2]))
    ps, ys = np.radians(pitch), np.radians(yaw)
    Ry = np.array([[np.cos(ys), 0, np.sin(ys)], [0, 1, 0], [-np.sin(ys), 0, np.cos(ys)]])
    Rx = np.array([[1, 0, 0], [0, np.cos(ps), -np.sin(ps)], [0, np.sin(ps), np.cos(ps)]])
    u0 = (Ry @ Rx).T @ Rr[:, 1]
    roll = np.degrees(np.arctan2(-u0[0], u0[1]))
    return float(yaw), float(pitch), float(roll)


def kabsch(A, B, scale=True):
    """R, s, t minimising |s R A + t - B| (rows are points)."""
    ca, cb = A.mean(0), B.mean(0)
    A0, B0 = A - ca, B - cb
    U, S, Vt = np.linalg.svd(A0.T @ B0)
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    D = np.diag([1, 1, d])
    R = Vt.T @ D @ U.T
    s = (S * np.diag(D)).sum() / (A0 ** 2).sum() if scale else 1.0
    return R, s, cb - s * R @ ca


def iris_diameter_px(pts, idx):
    c, r1, r2, r3, r4 = pts[idx, :2]
    horiz = np.linalg.norm(pts[idx[1], :2] - pts[idx[3], :2])
    vert = np.linalg.norm(pts[idx[2], :2] - pts[idx[4], :2])
    return float(horiz), float(vert)


def solve(pts, K, FS, P_t):
    """Head pose + lifted head-frame points (metres, MH axes, origin = MH origin of the scaled template)."""
    keys = PNP_KEYS
    M = np.array([P_t[FS.L[k]] for k in keys])
    I2 = np.array([mp_point(pts, k)[:2] for k in keys])
    R, t, res = pnp(I2, M, K)
    f = K[0, 0]
    # iris scale: distance to the eyes from the iris diameter vs the template's eye depth
    dR = iris_diameter_px(pts, IRIS_R)
    dL = iris_diameter_px(pts, IRIS_L)
    d_px = (dR[0] + dL[0]) / 2
    eyes_t = np.array([(P_t[FS.L["En_L"]] + P_t[FS.L["Ex_L"]]) / 2, (P_t[FS.L["En_R"]] + P_t[FS.L["Ex_R"]]) / 2])
    z_eyes_t = (R @ eyes_t.T + t[:, None])[2].mean()
    z_eyes_iris = f * IRIS_MM * 1e-3 / d_px
    s = z_eyes_iris / z_eyes_t                       # the subject's face = s x the template's
    t_s = t * s
    # lift every MediaPipe point: depth = Zc + z_mp * Zc / f (weak-perspective units of MediaPipe's z)
    Zt = (R @ (M * s).T + t_s[:, None])[2]
    zmp = np.array([pts[MP[k], 2].mean() for k in keys])
    Zc = Zt.mean() / (1 + zmp.mean() / f)
    Z = Zc * (1 + pts[:, 2] / f)
    Kinv = np.linalg.inv(K)
    rays = (Kinv @ np.c_[pts[:, :2], np.ones(len(pts))].T).T
    Xc = rays * Z[:, None]
    Xh = (R.T @ (Xc - t_s).T).T                    # head frame (scaled template's frame), metres
    # weak-perspective cross-check of the rotation: MediaPipe's own 3D vs the template
    A = np.array([P_t[FS.L[k]] for k in keys]) @ F_FLIP.T
    B = np.array([pts[MP[k]].mean(0) for k in keys])
    R_mp, s_mp, _ = kabsch(A, B)
    cam_in_head = -R.T @ t_s
    return dict(R=R, t=t_s, scale=s, reproj_px=res, Xh=Xh, Xc=Xc, Zc=Zc, iris_px=dict(right=dR, left=dL),
                z_eyes_iris=z_eyes_iris, z_eyes_template=z_eyes_t, R_mp=R_mp @ F_FLIP, cam_in_head=cam_in_head)


def refine_iris(gray, pts, idx):
    """Visible iris (limbus) circle measured on the image: (diameter px, edge points, MediaPipe diameter, centre).

    MediaPipe's iris rim is a fixed circle model that runs wide on this photo, and in a selfie from above the upper
    lid covers the top of the iris, so the circle is fitted to the limbus on the lower half: rays from MediaPipe's
    centre at angles from 15 deg above the horizontals through the bottom, walking outward from 0.55 r (past the
    specular highlights) to the first rise past halfway from the iris to the sclera; a robust least-squares circle
    through those edge points (outliers beyond 2.5 MAD dropped twice)."""
    c = pts[idx[0], :2]
    r0 = np.linalg.norm(pts[idx[1], :2] - pts[idx[3], :2]) / 2
    H, W = gray.shape
    g = gray.astype(float)
    def sample(x, y):
        x0, y0 = int(np.floor(x)), int(np.floor(y))
        fx, fy = x - x0, y - y0
        p = g[y0:y0 + 2, x0:x0 + 2]
        return (p[0, 0] * (1 - fx) + p[0, 1] * fx) * (1 - fy) + (p[1, 0] * (1 - fx) + p[1, 1] * fx) * fy
    yy, xx = np.mgrid[-int(r0):int(r0), -int(r0):int(r0)]
    inner = (xx ** 2 + yy ** 2 < (0.6 * r0) ** 2) & (yy > 0)
    iris = np.percentile(g[int(c[1]) + yy[inner], int(c[0]) + xx[inner]], 40)
    E = []
    for a in np.radians(np.linspace(-15, 195, 85)):          # image y is down: 90 deg = straight down
        d = np.array([np.cos(a), np.sin(a)])
        rs = np.arange(0.55 * r0, 1.5 * r0, 0.5)
        prof = np.array([sample(*(c + r * d)) for r in rs])
        prof = np.convolve(prof, np.ones(5) / 5, mode="same")
        scl = np.percentile(prof[rs > 1.15 * r0], 70)
        if scl - iris < 25:
            continue
        thr = (iris + scl) / 2
        k = np.where(prof[2:] > thr)[0]
        if len(k):
            E.append(c + rs[k[0] + 2] * d)
    E = np.array(E)
    keep = np.ones(len(E), bool)
    for _ in range(3):
        A = np.c_[2 * E[keep], np.ones(keep.sum())]
        b = (E[keep] ** 2).sum(1)
        sol = np.linalg.lstsq(A, b, rcond=None)[0]
        cc, rr = sol[:2], np.sqrt(sol[2] + (sol[:2] ** 2).sum())
        res = np.abs(np.linalg.norm(E - cc, axis=1) - rr)
        mad = np.median(res[keep]) + 0.5
        keep = res < 2.5 * mad
    return float(2 * rr), E[keep].tolist(), float(2 * r0), (float(cc[0]), float(cc[1]))
