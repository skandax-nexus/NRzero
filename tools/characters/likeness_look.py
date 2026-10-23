"""Photo likeness look (docs/CHARACTER_LOOK.md, "Faces: photo likeness"): a face file's `likeness` key names the look
data that likeness/look_data.py wrote from a reference photo's measurements (beard density and length maps, the brow
profile, moles, measured colours). build_humans.paint (skin zones, moles, lips, the painted beard under-layer, brows)
and look2.hair_cards (brow and beard strand cards) read it through this module. numpy only (runs inside Blender's
Python and outside it).

The data's frame is measure.py's "face mm": the pose-corrected head seen from the front, x = the subject's left, y up,
origin = the midpoint of the inner eye corners (endocanthions). On a build that point is found on the sculpted mesh
through MediaPipe's inner-corner landmarks (133, 362) traced onto the MakeHuman base mesh (likeness/mp_to_mh.json).
"""
import json
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_CACHE = {}
EN_R, EN_L = 133, 362          # MediaPipe: inner corner of the subject's right / left eye


def _ss(e0, e1, x):
    t = np.clip((np.asarray(x, float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


class Look:
    def __init__(self, path, scale=1.0):
        d = np.load(path)
        self.path = path
        self.beard = d["beard"].astype(np.float32)
        self.blen = d["beard_len"].astype(np.float32)
        self.x0, self.y0, self.step = (float(v) for v in d["frame"])
        self.brows = d["brows"].astype(np.float64)
        self.moles = d["moles"].astype(np.float64)
        self.colours = json.loads(str(d["colours"]))
        self.lm = json.loads(str(d["landmarks"]))
        self.scale = scale          # photo mm per build mm (the fit's head scale)
        self.origin = None

    # ---- frame
    def bind(self, P):
        """P: the sculpted base-mesh vertices (MH metres). Sets the frame origin (inner eye corner midpoint)."""
        t = json.load(open(os.path.join(HERE, "likeness", "mp_to_mh.json")))["front"]
        pts = []
        for i in (EN_R, EN_L):
            v, w = np.array(t["v"][i]), np.array(t["w"][i])
            pts.append((P[v] * w[:, None]).sum(0))
        self.origin = 0.5 * (pts[0] + pts[1])
        return self

    def mm(self, pos):
        """MH metres -> face mm (x, y, z) of the photo frame."""
        return (np.asarray(pos, float) - self.origin) * 1000.0 * self.scale

    def to_mh(self, q):
        """face mm -> MH metres"""
        return self.origin + np.asarray(q, float) / 1000.0 / self.scale

    def _grid(self, G, pos):
        q = self.mm(pos)
        c = (q[:, 0] - self.x0) / self.step - 0.5
        r = (self.y0 - q[:, 1]) / self.step - 0.5
        H, W = G.shape
        c0 = np.clip(np.floor(c).astype(int), 0, W - 2)
        r0 = np.clip(np.floor(r).astype(int), 0, H - 2)
        tc, tr = np.clip(c - c0, 0, 1), np.clip(r - r0, 0, 1)
        v = (G[r0, c0] * (1 - tc) * (1 - tr) + G[r0, c0 + 1] * tc * (1 - tr) + G[r0 + 1, c0] * (1 - tc) * tr + G[r0 + 1, c0 + 1] * tc * tr)
        out = (c < -0.5) | (c > W - 0.5) | (r < -0.5) | (r > H - 0.5)
        return np.where(out, 0.0, v)

    # ---- beard
    def beard_density(self, pos, hw, ear_z, hair_y=None, sb_top=None):
        """Beard density 0..1 at MH points pos: the frontal map (rows below the nose base), a sideburn band in front of
        the ear from the map's top up to the hairline, gated to the head (MakeHuman's head weights end under the jaw:
        the neckline) and to the front of the ear. hw: head weight per point; ear_z: z (MH) of the ear's front edge."""
        q = self.mm(pos)
        d = self._grid(self.beard, pos)
        z = np.asarray(pos)[:, 2]
        front = _ss(ear_z - 0.004, ear_z + 0.006, z)
        # sideburns: a band 0-24 mm ahead of the ear front, from the nose base (y = -38 mm, where the map starts) up to
        # the hairline / temple (sb_top mm), full at the back edge, thinning forward (a groomed, slightly tapered edge)
        top = -6.0 if sb_top is None else sb_top
        ahead = (z - ear_z) * 1000.0
        sb = _ss(-3.0, 1.0, ahead) * _ss(24.0, 15.0, ahead) * _ss(top + 2.0, top - 6.0, q[:, 1]) * _ss(-56.0, -36.0, q[:, 1])
        sb = sb * _ss(0.35, 0.6, np.abs(q[:, 0]) / 80.0)
        d = np.maximum(d * _ss(-34.0, -40.0, q[:, 1]) + d * _ss(-40.0, -34.0, q[:, 1]) * _ss(0.6, 0.8, np.abs(q[:, 0]) / 80.0), sb * 0.95)
        neck = _ss(0.25, 0.7, hw)
        return np.clip(d * front * neck, 0, 1)

    def beard_length(self, pos):
        return np.clip(self._grid(self.blen, pos), 0.5, 2.0)

    # ---- brows
    def brow(self, side):
        """(x outward mm, top mm, bottom mm, thickness mm) rows of one side's brow (side 0 = left, 1 = right)."""
        return self.brows[side]


def load(c, B=None):
    """The Look of a cast entry (c['likeness'] = a path, absolute or relative to the face file's folder), bound to the
    body B when given; None when the entry has none."""
    p = c.get("likeness")
    if not p:
        return None
    if not os.path.isabs(p):
        p = os.path.join(c.get("_faces_dir") or os.path.join(HERE, "faces"), p)
    key = (p, id(B))
    if key in _CACHE:
        return _CACHE[key]
    L = Look(p, float(c.get("likenessScale", 1.0)))
    if B is not None:
        L.bind(B.P)
    _CACHE[key] = L
    return L


def ear_front_z(B):
    """z (MH) of the front edge of the ears (the tragus side): the 85th percentile of the ear vertices' z."""
    P = B.P[B.ear > 0.5]
    return float(np.percentile(P[:, 2], 85)) if len(P) else float(B.L.eye[2] - 0.07)


def hexlin(h):
    h = h.lstrip("#")
    c = np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(c):
    c = np.clip(np.asarray(c, float), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)



# ---------------------------------------------------------------------------------------------------------------
# painting (build_humans.paint): colour zones, moles, the beard's painted under-layer
# ---------------------------------------------------------------------------------------------------------------
def paint_zones(c, B, LK, pos, col, isface, front, BH):
    """The measured colour zones on the painted skin (sRGB col, in place): the darker, cooler crescent under the deep-set
    eyes and the darker upper lids, a little darker nose bridge and side of the nose, a warmer, redder nose tip, the
    slightly darker cheekbone band; ratios from the photo's albedo samples (left / right averaged; about half of the
    under-eye darkness in the photo is the shadow of the brow ridge, which the renderer adds itself)."""
    ss, g2 = BH.ss, BH.g2
    L = B.L
    q = LK.mm(pos)
    face = isface.astype(float) * front
    k = lambda m, rgb: np.clip(m, 0, 1)[:, None] * (np.asarray(rgb)[None, :] - 1.0) + 1.0
    for e, sg in ((L.eyeL, 1), (L.eyeR, -1)):
        ex = (e[0] - LK.origin[0]) * 1000 * LK.scale
        ey = (e[1] - LK.origin[1]) * 1000 * LK.scale
        dx, dy = (q[:, 0] - ex) * sg, q[:, 1] - ey
        # under-eye crescent: 4-15 mm below the eye centre, inner corner to past the outer corner, into the tear trough
        cres = g2(((dx + 1.0) / 13.0) ** 2 + ((dy + 9.0 + 0.04 * dx) / 4.2) ** 2, 1.0) * ss(-3.0, -5.5, dy)
        col *= k(cres * face * float(c.get("underEye", 0.85)), [0.80, 0.76, 0.84])
        # upper lid: darker skin between the lash line and the crease
        (ux, uy), _ = L.lid["L" if sg > 0 else "R"]
        top = np.interp(dx / 1000 / LK.scale, ux, uy) * 1000 * LK.scale
        lid = ss(-0.5, 0.8, dy - top) * ss(7.5, 4.0, dy - top) * ss(-16.0, -12.0, dx) * ss(17.0, 13.0, dx)
        col *= k(lid * face * 0.8, [0.84, 0.80, 0.84])
    # nose: the bridge and the side walls a little darker, the tip and the wings warmer
    bridge = g2((q[:, 0] / 7.5) ** 2 + ((q[:, 1] + 6.0) / 9.0) ** 2, 1.0)
    col *= k(bridge * face * 0.7, [0.86, 0.82, 0.80])
    tip = g2((q[:, 0] / 11.0) ** 2 + ((q[:, 1] + 31.0) / 7.0) ** 2, 1.0)
    col *= k(tip * face * 0.7, [1.04, 0.97, 0.92])
    # cheekbone band (zygoma, under the outer eye) a touch darker and warmer
    for sg in (1, -1):
        cb = g2(((q[:, 0] * sg - 46.0) / 13.0) ** 2 + ((q[:, 1] + 22.0) / 9.0) ** 2, 1.0)
        col *= k(cb * face * 0.6, [0.93, 0.90, 0.86])
    return col


def paint_moles(c, LK, pos, col, isface, BH):
    """The moles and faint spots of the photo at their measured places (soft-edged, dark brown)."""
    q = LK.mm(pos)
    out = 0
    for x, y, z, dia, con, kind in LK.moles:
        d2 = (q[:, 0] - x) ** 2 + (q[:, 1] - y) ** 2
        near = (d2 < (dia * 3) ** 2) & (np.abs(q[:, 2] - z) < 9.0) & isface
        if not near.any():
            continue
        r = max(dia * 0.5, 0.45)
        a = BH.ss(r * 1.25, r * 0.6, np.sqrt(d2)) * near
        strength = (1.0 - con) * (1.25 if kind > 0.5 else float(c.get("faintSpots", 0.55)))
        tone = np.array([0.62, 0.52, 0.48]) if kind > 0.5 else np.array([0.75, 0.66, 0.62])
        col *= 1 - np.clip(a * strength, 0, 0.75)[:, None] * (1 - tone)[None, :]
        out += 1
    return col, out


def beard_paint(c, B, LK, pos, hw, lipm, isface, seed, BH):
    """The beard's painted under-layer: alpha and colour (sRGB) per texel. Under dense beard it is a dark, nearly solid
    layer with a fine down-running hair texture (no skin shows between the cards); toward the cheek line and in the
    sparse patches it turns to a stubble shadow of fine dots, so the edge reads as hair thinning out (groomed: the map is
    already smooth and symmetric)."""
    ss, vnoise, hash01 = BH.ss, BH.vnoise, BH.hash01
    dens = LK.beard_density(pos, hw, ear_front_z(B), sb_top=20.0)
    dens = dens * (1 - ss(0.12, 0.45, lipm)) * isface
    bc = BH.hexc(c.get("beardColor", c.get("hairColor", "2e2119")))
    hairs = np.clip((vnoise(pos * np.array([3.0, 0.5, 3.0]), 1900, seed + 2.9) - 0.3) * 2.0, 0, 1)
    dots = (hash01(pos, 2800, seed + 0.5) > 0.5).astype(float)
    solid = ss(0.35, 0.8, dens)
    a = solid * (0.86 + 0.1 * hairs) + (1 - solid) * np.clip(dens * 1.6, 0, 1) * (0.32 + 0.3 * dots + 0.12 * hairs)
    # a faint shave shadow a little past the beard (the skin around a full beard is never bare-clean)
    halo = ss(0.0, 0.12, LK._grid(LK.beard, pos)) * ss(0.25, 0.7, hw) * isface * (1 - ss(0.12, 0.45, lipm))
    a = np.maximum(a, halo * 0.14 * (0.6 + 0.4 * dots))
    rgb = bc[None, :] * (0.78 + 0.22 * hairs[:, None])
    return np.clip(a, 0, 0.95), rgb, dens


def brow_T(LK, e, sg, lift=0.0):
    """build_humans.paint's brow curve T(t) (t: 0 medial -> 1 lateral) from the measured profile: (x from the eye
    centre outward, the lower edge above the eye centre, the thickness), metres."""
    b = LK.brow(0 if sg > 0 else 1)
    ex = abs(e[0] - LK.origin[0]) * 1000 * LK.scale
    ey = (e[1] - LK.origin[1]) * 1000 * LK.scale
    xs = b[:, 0]
    t0 = (xs - xs[0]) / (xs[-1] - xs[0])

    def T(t):
        t = np.asarray(t, float)
        x = np.interp(t, t0, xs)
        bot = np.interp(t, t0, b[:, 2])
        th = np.interp(t, t0, b[:, 3])
        s = 1.0 / 1000 / LK.scale
        return (x - ex) * s, (bot - ey) * s + lift, np.maximum(th, 0.6) * s
    return T
