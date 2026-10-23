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


def head_scene(P, neck_drop=0.035):
    """Triangles of the head (body faces above the neck joint minus neck_drop, both eye helpers) and vertex colours."""
    V0, _, F = mh.base()
    neck = mh.joint(P, "neck")
    tris, grp = [], []
    for vs, _, g in F:
        if g == "body":
            if min(P[v, 1] for v in vs) < neck[1] - neck_drop:
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
    S.col = _colours(P, S)
    return S


def _colours(P, S):
    """Per-vertex albedo (skin) plus what the per-pixel painter needs: the neutral layout positions (S.ref)."""
    S.ref = P.copy()
    L = _landmarks()
    S.paint = dict(sto=P[L["Sto"]].copy(), chx=abs(P[L["Ch_L"], 0]), eyes={})
    for s in (1, -1):
        en, ex = P[L["En_L" if s > 0 else "En_R"]], P[L["Ex_L" if s > 0 else "Ex_R"]]
        S.paint[s] = (en.copy(), ex.copy())
    for g, k in (("helper-l-eye", 1), ("helper-r-eye", 2)):
        vs = np.array(mh.group_vertices(g))
        S.paint["eyes"][k] = P[vs].mean(0)
    return np.tile(SKIN, (len(P), 1))


def paint_pixels(S, Q, grp):
    """Albedo per pixel from Q (the neutral-layout position of each pixel) and its group (0 skin, 1 / 2 eyes)."""
    col = np.tile(SKIN, (len(Q), 1))
    pt = S.paint
    skin = grp == 0
    # lips: an ellipse-ish vermilion around the stomion, upper 11 mm, lower 12 mm, out to the mouth corners
    d = Q - pt["sto"]
    ell = (d[:, 0] / pt["chx"]) ** 2 + (d[:, 1] / np.where(d[:, 1] > 0, 0.0105, 0.0115)) ** 2
    w = np.clip((1.0 - ell) / 0.25, 0, 1) * (Q[:, 2] > pt["sto"][2] - 0.012) * skin
    col = col * (1 - w[:, None]) + LIP * w[:, None]
    # brows: a band over each eye, 17-25 mm above the corners' mid height, thick medially, thinner laterally
    for s in (1, -1):
        en, ex = pt[s]
        ey = (en[1] + ex[1]) / 2
        x0, x1 = abs(en[0]) - 0.006, abs(ex[0]) + 0.008
        x = Q[:, 0] * s
        f = np.clip((x - x0) / (x1 - x0), 0, 1)
        yc = ey + 0.0195 + 0.004 * np.sin(np.pi * f) + 0.002 * f
        half = 0.0036 - 0.0013 * f
        dy = np.abs(Q[:, 1] - yc)
        b = np.clip((half + 0.0008 - dy) / 0.0016, 0, 1) * np.clip((x - x0) / 0.003, 0, 1) * np.clip((x1 - x) / 0.003, 0, 1)
        b *= skin * (Q[:, 2] > ex[2] - 0.01)
        col = col * (1 - b[:, None]) + BROW * b[:, None]
    # eyes: sclera, iris, pupil by the radius from the helper's forward axis
    for k, c in pt["eyes"].items():
        e = grp == k
        r = np.hypot(Q[:, 0] - c[0], Q[:, 1] - c[1])
        col[e] = SCLERA
        col[e & (r < 0.0062)] = IRIS
        col[e & (r < 0.0026)] = PUPIL
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


def render(P, S, K, R, t, W, H, light_dir=(0.25, 0.55, 1.0), ambient=0.38, wire=False):
    """Shaded image (H,W,3 floats 0..1, sRGB-ish) and buffers."""
    uv, z = project(P, K, R, t)
    tid, bar, zb = rasterise(uv, z, S.tris, W, H)
    n = vertex_normals(P, S.tris)
    img = np.tile(BG, (H, W, 1))
    m = tid >= 0
    tv = S.tris[tid[m]]
    bw = bar[m]
    nn = (n[tv] * bw[:, :, None]).sum(1)
    nn /= np.maximum(np.linalg.norm(nn, axis=1, keepdims=True), 1e-12)
    Q = (S.ref[tv] * bw[:, :, None]).sum(1)
    cc = paint_pixels(S, Q, S.grp[tid[m]])
    # light in head axes (x left of the subject, y up, z out of the face): a soft key from the front, a bit above
    l = np.array(light_dir, float)
    l /= np.linalg.norm(l)
    dif = np.clip(nn @ l * 0.5 + 0.5, 0, 1) ** 1.6       # wrapped (soft) key
    shade = ambient + (1 - ambient) * dif
    img[m] = np.clip(cc * shade[:, None], 0, 1)
    return img, dict(tri=tid, bary=bar, depth=zb, uv=uv, z=z)


def to_u8(img):
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)
