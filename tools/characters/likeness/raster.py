"""A small z-buffer rasteriser (numpy) for the likeness fit: MakeHuman head renders a face detector can read, with a
triangle id and barycentric buffer so every detected point can be traced back onto the mesh.

    img, buf = render(P, scene, K, R, t, W, H)        # P: (N,3) metres, MH axes; R, t: head -> OpenCV camera
    buf['tri'] (H,W) int (-1 = background), buf['bary'] (H,W,3), buf['depth'] (H,W)

`head_scene(P)` picks the head faces (body above the neck, the eye helpers) and paints them: skin, lips, brows, iris
and sclera, a soft frontal key with a little fill, so the render reads like a bald, beardless portrait. Nothing here
is shipped; it only measures.
"""
import numpy as np

import mh


def _hex(h):
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])


SKIN, LIP, BROW, IRIS, PUPIL, SCLERA, BG = (_hex(h) for h in ("b0785c", "8a4c42", "2a211c", "2e221c", "0c0a09", "d8cfc4", "e8e2d0"))


class Scene:
    pass


def head_scene(P, neck_drop=0.035, jaw_cut=True):
    """Triangles of the head (body faces above the neck joint minus neck_drop, both eye helpers) and the painter.

    jaw_cut drops the neck under the jaw (below the line chin -> jaw angle -> back of the head, 3 mm under it): the
    face's outline then stands against the background as the jaw does against the shirt in the photo, so the detector
    traces the jaw and not the neck."""
    V0, _, F = mh.base()
    neck = mh.joint(P, "neck")
    L = _landmarks()
    me, go = P[L["Me"]], 0.5 * (P[L["Go_L"]] + P[L["Go_R"]])
    def is_neck(q):
        yl = np.interp(q[2], [go[2] - 0.08, go[2], me[2]], [go[1] + 0.01, go[1], me[1]])
        return q[1] < yl - 0.003
    tris, grp = [], []
    for vs, _, g in F:
        if g == "body":
            if min(P[v, 1] for v in vs) < neck[1] - neck_drop:
                continue
            if jaw_cut and all(is_neck(P[v]) for v in vs):
                continue
            kind = 0
        elif g in ("helper-l-eye", "helper-r-eye"):
            kind = 1 if g == "helper-l-eye" else 2
        else:
            continue
        for a, b, c in ((vs[0], vs[1], vs[2]), (vs[0], vs[2], vs[3])) if len(vs) == 4 else ((vs[0], vs[1], vs[2]),):
            tris.append((a, b, c))
            grp.append(kind)
    S = Scene()
    S.tris = np.array(tris, np.int64)
    S.grp = np.array(grp)
    S.verts = np.unique(S.tris)
    S.brow_thick = 1.0
    S.brow_lift = 0.0
    repaint(S, P)
    return S


_LIPV = None


def group_exact(name):
    """Vertices of the faces in exactly this group (mh.group_vertices matches a prefix: 'helper-l-eye' also takes the
    lash helpers 'helper-l-eyelashes-*')."""
    _, _, F = mh.base()
    return sorted({v for vs, _, g in F if g == name for v in vs})


def repaint(S, P):
    """Anchor the painter on the head P (head frame, MH axes): the game paints lips and brows from the sculpted
    head's own landmarks (build_humans.paint: lips from the lip contact line, brows from the eye centres), so the
    painted features follow the shape exactly as they will in the build."""
    global _LIPV
    if _LIPV is None:
        import json, os
        _LIPV = np.array(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "mh_lip_line.json")))["verts"])
    S.ref = P.copy()
    q = P[_LIPV]
    # the contact line as build_humans._profile does it: mean height in 11 bins across the mouth
    e = np.linspace(q[:, 0].min(), q[:, 0].max(), 12)
    k = np.clip(np.digitize(q[:, 0], e) - 1, 0, 10)
    bx = np.array([q[k == i, 0].mean() for i in range(11) if (k == i).any()])
    by = np.array([q[k == i, 1].mean() for i in range(11) if (k == i).any()])
    S.paint = dict(lip_x=bx, lip_y=by, lip_w=(q[:, 0].max() - q[:, 0].min()) / 2, lip_z=q[:, 2].max(), eyes={})
    S.paint["iris"] = {}
    for g, k in (("helper-l-eye", 1), ("helper-r-eye", 2)):
        # brows: from build_humans.Landmarks' eye centre (mh.group_vertices, lash helpers included, as the game does)
        S.paint["eyes"][k] = P[mh.group_vertices(g)].mean(0)
        S.paint["iris"][k] = P[group_exact(g)].mean(0)       # the eyeball's own centre


def _ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def paint_pixels(S, Q, grp):
    """Albedo per pixel from Q (the head-frame position of each pixel) and its group (0 skin, 1 / 2 eyes)."""
    col = np.tile(SKIN, (len(Q), 1))
    pt = S.paint
    skin = (grp == 0).astype(float)
    # lips: build_humans.paint's male lip shape (upper 7.4 mm, lower 9.2 mm x mouth width / 48 mm) from the contact line
    lw = max(pt["lip_w"], 0.018)
    t = Q[:, 0] / lw
    d = Q[:, 1] - np.interp(Q[:, 0], pt["lip_x"], pt["lip_y"])
    front = _ss(pt["lip_z"] - 0.025, pt["lip_z"] - 0.012, Q[:, 2]) * (np.abs(t) < 1.1) * skin
    sc = pt["lip_w"] / 0.024
    hu0, hl0 = 0.0074 * sc, 0.0092 * sc
    at = np.clip(np.abs(t), 0, 1)
    hu = hu0 * (1 - at ** 2.3) ** 0.55 * (1 - 0.16 * np.exp(-(t / 0.13) ** 2)) * (1 + 0.1 * np.exp(-((at - 0.3) / 0.15) ** 2))
    hl = hl0 * (1 - at ** 2.0) ** 0.7
    mu = _ss(hu + 0.0007, hu - 0.0004, d) * _ss(-0.0012, 0.0, d)
    ml = _ss(hl + 0.0008, hl - 0.0005, -d) * _ss(-0.0012, 0.0, -d)
    lipm = np.clip(np.maximum(mu, ml) * front * _ss(1.05, 0.9, np.abs(t)), 0, 1)
    col = col * (1 - lipm[:, None] * 0.85) + LIP * lipm[:, None] * 0.85
    line = 0.55 * np.exp(-d ** 2 / 0.0005 ** 2) * front * _ss(1.15, 0.85, np.abs(t))
    col *= (1 - line[:, None] * 0.6)
    # brows: build_humans.paint's stroke band (look v2 curve) from each eye centre
    bt, lift = S.brow_thick, S.brow_lift
    for k, sg in ((1, 1), (2, -1)):
        e = pt["eyes"][k]
        X = (Q[:, 0] - e[0]) * sg
        Y = Q[:, 1] - e[1]
        tt = np.clip((X + 0.0185) / 0.047, 0, 1)
        lo = np.interp(tt, [0, 0.35, 0.68, 1.0], [0.0150, 0.0178, 0.0192, 0.0162]) + lift
        w = np.interp(tt, [0, 0.15, 0.6, 1.0], [0.0072, 0.0068, 0.0048, 0.0018]) * (0.8 + 0.4 * bt)
        b = _ss(-0.0006, 0.0006, Y - lo) * _ss(w + 0.0006, w - 0.0004, Y - lo) * _ss(-0.0205, -0.0175, X) * _ss(0.0305, 0.0280, X)
        b *= skin * (Q[:, 2] > e[2] - 0.01)
        col = col * (1 - b[:, None] * 0.92) + BROW * b[:, None] * 0.92
    # eyes: sclera, iris, pupil by the radius from the helper's forward axis
    for k, c in pt["iris"].items():
        ee = grp == k
        r = np.hypot(Q[:, 0] - c[0], Q[:, 1] - c[1])
        col[ee] = SCLERA
        col[ee & (r < 0.0062)] = IRIS
        col[ee & (r < 0.0026)] = PUPIL
    return col


_L = None


def _landmarks():
    global _L
    if _L is None:
        import face_metric as fmx
        _L = fmx.FaceSpace().L
    return _L


def vertex_normals(P, tris):
    a, b, c = P[tris[:, 0]], P[tris[:, 1]], P[tris[:, 2]]
    fn = np.cross(b - a, c - a)
    n = np.zeros_like(P)
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def project(P, K, R, t):
    Xc = P @ R.T + t
    uv = Xc @ K.T
    return uv[:, :2] / uv[:, 2:3], Xc[:, 2]


def rasterise(uv, z, tris, W, H):
    """tri id, barycentrics, depth per pixel (pixel centres at +0.5)."""
    zb = np.full((H, W), np.inf)
    tid = np.full((H, W), -1, np.int64)
    bar = np.zeros((H, W, 3))
    A, B, C = uv[tris[:, 0]], uv[tris[:, 1]], uv[tris[:, 2]]
    area = (B[:, 0] - A[:, 0]) * (C[:, 1] - A[:, 1]) - (B[:, 1] - A[:, 1]) * (C[:, 0] - A[:, 0])
    lo = np.floor(np.minimum(np.minimum(A, B), C) - 0.5).astype(int)
    hi = np.ceil(np.maximum(np.maximum(A, B), C) - 0.5).astype(int)
    for i in np.nonzero(np.abs(area) > 1e-9)[0]:
        x0, y0 = max(lo[i, 0], 0), max(lo[i, 1], 0)
        x1, y1 = min(hi[i, 0], W - 1), min(hi[i, 1], H - 1)
        if x1 < x0 or y1 < y0:
            continue
        xs = np.arange(x0, x1 + 1) + 0.5
        ys = np.arange(y0, y1 + 1) + 0.5
        X, Y = np.meshgrid(xs, ys)
        a, b, c = A[i], B[i], C[i]
        w1 = ((X - a[0]) * (c[1] - a[1]) - (Y - a[1]) * (c[0] - a[0])) / area[i]
        w2 = ((b[0] - a[0]) * (Y - a[1]) - (b[1] - a[1]) * (X - a[0])) / area[i]
        w0 = 1 - w1 - w2
        m = (w0 >= -1e-9) & (w1 >= -1e-9) & (w2 >= -1e-9)
        if not m.any():
            continue
        zi = w0 * z[tris[i, 0]] + w1 * z[tris[i, 1]] + w2 * z[tris[i, 2]]
        sub = zb[y0:y1 + 1, x0:x1 + 1]
        m &= zi < sub
        if not m.any():
            continue
        sub[m] = zi[m]
        tid[y0:y1 + 1, x0:x1 + 1][m] = i
        bb = bar[y0:y1 + 1, x0:x1 + 1]
        bb[m] = np.stack([w0[m], w1[m], w2[m]], 1)
    return tid, bar, zb


def render(P, S, K, R, t, W, H, light=(-0.35, -0.6), ambient=0.3, Q=None):
    """Shaded image (H,W,3 floats 0..1) and buffers. P: positions transformed by R, t into the camera; Q: the head-frame
    positions the painter reads (default: S.ref). The key light sits on the camera side, `light` = its direction offset
    (image x, y; y < 0 = from above), a soft wrap, so the jaw gets its shadow underneath as in an overhead room light."""
    uv, z = project(P, K, R, t)
    tid, bar, zb = rasterise(uv, z, S.tris, W, H)
    Pc = P @ R.T + t
    n = vertex_normals(Pc, S.tris)
    img = np.tile(BG, (H, W, 1))
    m = tid >= 0
    tv = S.tris[tid[m]]
    bw = bar[m]
    nn = (n[tv] * bw[:, :, None]).sum(1)
    nn /= np.maximum(np.linalg.norm(nn, axis=1, keepdims=True), 1e-12)
    pp = (Pc[tv] * bw[:, :, None]).sum(1)
    v = -pp / np.linalg.norm(pp, axis=1, keepdims=True)            # to the camera
    nn *= np.sign((nn * v).sum(1))[:, None]                        # face the viewer (winding-agnostic)
    l = np.array([light[0], light[1], -1.0])                        # surface -> light: the camera side, above
    l /= np.linalg.norm(l)
    dif = np.clip(nn @ l * 0.6 + 0.4, 0, 1) ** 1.5
    shade = ambient + (1 - ambient) * dif
    QQ = S.ref if Q is None else Q
    Qp = (QQ[tv] * bw[:, :, None]).sum(1)
    cc = paint_pixels(S, Qp, S.grp[tid[m]])
    img[m] = np.clip(cc * shade[:, None], 0, 1)
    return img, dict(tri=tid, bary=bar, depth=zb, uv=uv, z=z)


def to_u8(img):
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)
