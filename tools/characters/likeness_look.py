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
SIDE_BAND = (0.88, 0.56, 0.36)  # fix round 2: the outline band's density and its n.v ramp (the photo camera's view)


def _vnoise(p, f, seed=0.0):
    """Smooth value noise (0..1) on points p (n, 3) at frequency f (cycles per unit): a hashed lattice, trilinear with a
    smoothstep fade (numpy only, the same field at the build's paint and its cards)."""
    q = np.asarray(p, float) * f + seed * 17.13
    i0 = np.floor(q)
    t = q - i0
    t = t * t * (3 - 2 * t)
    i0 = i0.astype(np.int64)

    def h(a):
        n = a[:, 0] * 73856093 ^ a[:, 1] * 19349663 ^ a[:, 2] * 83492791
        n = (n ^ (n >> 13)) * 1274126177
        return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0
    out = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (t[:, 0] if dx else 1 - t[:, 0]) * (t[:, 1] if dy else 1 - t[:, 1]) * (t[:, 2] if dz else 1 - t[:, 2])
                out = out + w * h(i0 + np.array([dx, dy, dz]))
    return out


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
        self.cam = d["photo_cam"].astype(np.float64) if "photo_cam" in d.files else None      # fix round 2
        # fix round 3: where the beard's hair is lighter (under the lower lip, the philtrum) and its dark rim (jaw, neck,
        # the chin's bottom edge)
        self.light_map = d["beard_light"].astype(np.float32) if "beard_light" in d.files else None
        self.rim_map = d["beard_rim"].astype(np.float32) if "beard_rim" in d.files else None
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
    def beard_density(self, pos, hw, ear_z, ear_lo=None, sb_top=None, nrm=None):
        """Beard density 0..1 at MH points pos: the frontal map (rows below the nose base), a sideburn band in front of
        the ear from the map's top up to the hairline, gated to the head (MakeHuman's head weights end under the jaw:
        the neckline) and to the front of the ear (above the lobe; below it the beard runs back along the jaw to its angle). hw: head weight per point;
        ear_z: z (MH) of the ear's front edge; ear_lo: y (MH) of the lowest point of the ear."""
        q = self.mm(pos)
        d = self._grid(self.beard, pos)
        z = np.asarray(pos)[:, 2]
        front = _ss(ear_z - 0.004, ear_z + 0.006, z)
        if ear_lo is not None:     # under the ear lobe: back to the angle of the jaw
            below = _ss(ear_lo + 0.004, ear_lo - 0.008, np.asarray(pos)[:, 1])
            front = np.maximum(front, below * _ss(ear_z - 0.026, ear_z - 0.014, z))
        # sideburns: a band 0-45 mm ahead of the ear front (fix round 2: was 0-24 mm, which left the side of the face bare
        # between the sideburn and the cheek silhouette seen from the front), from the nose base (y = -38 mm, where the
        # map's own rows start) up to the hairline / temple (sb_top mm), full at the back edge, thinning forward
        top = -6.0 if sb_top is None else sb_top
        ahead = (z - ear_z) * 1000.0
        # the band's front edge runs diagonally in profile (45 mm ahead at the nose base, 30 mm at eye level, 18 mm at the
        # temple), a natural cheek line rather than a box
        amax = np.interp(q[:, 1], [-38.0, 5.0, top], [45.0, 30.0, 18.0])
        amax = amax + 6.0 * (_vnoise(np.asarray(pos, float), 160.0, 3.1) - 0.5)      # fix round 3: a hair-broken edge, not an exact line
        sb = _ss(-3.0, 1.0, ahead) * _ss(amax + 2.0, amax - 9.0, ahead) * _ss(top + 2.0, top - 6.0, q[:, 1]) * _ss(-56.0, -36.0, q[:, 1])
        sb = sb * _ss(0.35, 0.6, np.abs(q[:, 0]) / 80.0)
        # above the nose base the map carries only the outer band along the face outline (look_data SIDEBAND); it ends
        # forward at the same diagonal cheek line
        hi = d * _ss(-40.0, -34.0, q[:, 1]) * _ss(0.6, 0.8, np.abs(q[:, 0]) / 80.0) * _ss(amax + 12.0, amax + 2.0, ahead)
        d = np.maximum(d * _ss(-34.0, -40.0, q[:, 1]) + hi, sb * 0.95)
        if nrm is not None and self.cam is not None:
            # fix round 2: the face outline as the photo's camera saw it: where the skin turns away from that camera
            # (n.v below ~0.5: the outermost ~10 mm inside its silhouette, and everything past it toward the ear) the
            # beard runs as one band from the sideburn at eye level down to the jaw (SIDE_BAND density)
            v = self.cam[None, :] - q
            v /= np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-9)
            n_ = np.asarray(nrm, float)
            n_ = n_ / np.maximum(np.linalg.norm(n_, axis=1, keepdims=True), 1e-9)
            ndv = (n_ * v).sum(1)
            # its front edge is a natural cheek line, diagonal in profile: from a narrow sideburn at eye level (32 mm ahead
            # of the ear) widening down to the jaw (the camera's grazing view makes a few mm of image a wide strip of
            # the cheek's side, so the band is limited there, not by n.v alone)
            # fix round 3: the cheek line read as a sticker (one smooth convex front edge, full to zero over a 10 mm ramp,
            # starting near eye level): its front edge 5-8 mm further back toward the top, broken by a 4 mm noise field
            # (clumps of hair, never an exact curve), feathered over ~10 mm where the hair thins to sparse single hairs,
            # and the band itself a little patchy (no uniform mat)
            bfront = np.interp(q[:, 1], [-56.0, -40.0, -20.0, 0.0, 8.0], [90.0, 70.0, 48.0, 30.0, 20.0])
            pm = np.asarray(pos, float)
            nz = _vnoise(pm, 160.0, 3.1) - 0.5
            nz2 = _vnoise(pm, 420.0, 7.7) - 0.5
            bf = bfront + 10.0 * nz + 3.5 * nz2
            edge_ = _ss(bf + 4.0, bf - 10.0, ahead) ** 1.4
            band = (_ss(SIDE_BAND[1], SIDE_BAND[2], ndv) * _ss(42.0, 54.0, np.abs(q[:, 0])) * _ss(6.0, -1.0, q[:, 1]) * _ss(-60.0, -46.0, q[:, 1])
                    * _ss(-3.0, 1.0, ahead) * edge_)
            band = band * (0.82 + 0.18 * _ss(0.2, 0.7, _vnoise(pm, 260.0, 5.3)))
            d = np.maximum(d, SIDE_BAND[0] * band)
        neck = _ss(0.25, 0.7, hw)
        return np.clip(d * front * neck, 0, 1)

    def beard_light(self, pos):
        """fix round 3: 0..1 where the beard's hair is lighter and warmer (look_data `beard_light`)"""
        return np.zeros(len(pos)) if self.light_map is None else np.clip(self._grid(self.light_map, pos), 0, 1)

    def beard_rim(self, pos):
        """fix round 3: 0..1 the beard's dark, dense rim (look_data `beard_rim`)"""
        return np.zeros(len(pos)) if self.rim_map is None else np.clip(self._grid(self.rim_map, pos), 0, 1)

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


def ear_low_y(B):
    """y (MH) of the bottom of the ear lobes."""
    P = B.P[B.ear > 0.5]
    return float(np.percentile(P[:, 1], 3)) if len(P) else float(B.L.eye[1] - 0.06)


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
        # likeness:final: broad, soft and mild (the narrow crescent read as a bruise): wider, feathered down onto the
        # upper cheek, clear of the inner corner (no grey smudge at the canthus)
        # fix round 2: underEyeBlur (default 1): the crescent's falloff widened (Kai 2: a soft shade, not a sharp bag edge)
        ub = float(c.get("underEyeBlur", 1.0))
        cres = (g2(((dx + 0.5) / (15.0 * (1 + 0.3 * (ub - 1)))) ** 2 + ((dy + 11.0 + 0.04 * dx) / (6.5 * ub)) ** 2, 1.0)
                * ss(-2.5 + 0.5 * (ub - 1), -6.0 - 1.5 * (ub - 1), dy) * ss(-13.0 - 3.0 * (ub - 1), -7.0, dx))
        col *= k(cres * face * float(c.get("underEye", 0.5)), [0.86, 0.83, 0.86])
        # fix round 2: underEyeLift: the crescent lightened (the deep-set eye's socket shading and the lid's contact
        # shadow already darken it in the renderer; painting it darker as well read as a bruise)
        col *= (1 + float(c.get("underEyeLift", 0.0)) * np.clip(cres * face, 0, 1))[:, None]
        # fix round 1: underEyeDesat: the crescent pulled toward a mauve-grey of its own lightness (the photo's 141/105/90
        # is cooler than his cheek; a multiplied shade alone kept the skin's orange and read as a saturated crescent)
        de = cres * face * float(c.get("underEyeDesat", 0.0))
        if de.max() > 0:
            lum = (col * np.array([0.3, 0.59, 0.11])).sum(1, keepdims=True)
            mauve = lum * np.array([1.2, 0.97, 0.9])
            col += np.clip(de, 0, 1)[:, None] * (mauve - col)
        # upper lid: darker skin between the lash line and the crease
        (ux, uy), _ = L.lid["L" if sg > 0 else "R"]
        top = np.interp(dx / 1000 / LK.scale, ux, uy) * 1000 * LK.scale
        lid = ss(-0.5, 0.8, dy - top) * ss(7.5, 4.0, dy - top) * ss(-11.0, -6.0, dx) * ss(17.0, 13.0, dx)
        col *= k(lid * face * float(c.get("lidShade", 0.8)), [0.86, 0.80, 0.82])
        # fix round 2: lidHood: the heavy, hooded lid under a low brow is one shadowed fold from the lashes up to the
        # brow (no light crease band between them): a soft shade up to 11 mm above the lash line, deepest under the brow
        hd = float(c.get("lidHood", 0.0))
        if hd > 0:
            hood = ss(0.0, 2.5, dy - top) * ss(12.0, 7.0, dy - top) * ss(-12.0, -5.0, dx) * ss(19.0, 13.0, dx)
            col *= k(hood * face * hd, [0.86, 0.81, 0.82])
    # nose: the bridge and the side walls a little darker, the tip and the wings warmer
    bridge = g2((q[:, 0] / 7.5) ** 2 + ((q[:, 1] + 6.0) / 9.0) ** 2, 1.0)
    col *= k(bridge * face * 0.7, [0.86, 0.82, 0.80])
    tip = g2((q[:, 0] / 11.0) ** 2 + ((q[:, 1] + 31.0) / 7.0) ** 2, 1.0)
    col *= k(tip * face * 0.9, [0.88, 0.84, 0.83])      # (fix round 1: darker, less red: the tip read as a hot spot)
    fs_ramp = c.get("foreheadRamp")      # fix round 2: the ramp (mm above the eye line) the forehead shade comes in over
    # likeness:final: the forehead no lighter than the cheeks (measured: the sides and temples darker than the centre;
    # the renderer's key light from above adds its own lift)
    fh = ss(14.0, 26.0, q[:, 1]) * face if fs_ramp is None else ss(fs_ramp[0], fs_ramp[1], q[:, 1]) * face
    # fix round 2: foreheadShade is the tone's exponent (it was a strength clipped at 1, so 2-3 all gave the same 10 %)
    fs = float(c.get("foreheadShade", 1.0))
    # fix round 3: foreheadBase / foreheadSide (defaults 0.55 / 0.45): the shade's strength at the centre and its extra
    # toward the temples (Kai 0.72 / 0.08: the forehead about 8 % darker overall, no darker band framing it like a box)
    fb_, fsd_ = float(c.get("foreheadBase", 0.55)), float(c.get("foreheadSide", 0.45))
    col *= k(fh * (fb_ + fsd_ * ss(14.0, 40.0, np.abs(q[:, 0]))), np.array([0.9, 0.88, 0.87]) ** fs)
    # cheekbone band (zygoma, under the outer eye) a touch darker and warmer
    for sg in (1, -1):
        cb = g2(((q[:, 0] * sg - 46.0) / 13.0) ** 2 + ((q[:, 1] + 22.0) / 9.0) ** 2, 1.0)
        col *= k(cb * face * 0.6, [0.93, 0.90, 0.86])
    return col


def paint_moles(c, LK, pos, col, isface, BH):
    """The moles and faint spots of the photo at their measured places (soft-edged, dark brown)."""
    q = LK.mm(pos)
    out = 0
    # fix round 2: moleTweak (face file): per mole index [i, dx mm, dy mm, diameter scale, strength scale] (Kai: the lower
    # of his two moles was painted twice the photo's size and 1.5 mm low; the upper one a little lighter)
    tw = {int(t[0]): t[1:] for t in c.get("moleTweak", [])}
    for mi, (x, y, z, dia, con, kind) in enumerate(LK.moles):
        dx_, dy_, dsc, ssc = tw.get(mi, (0.0, 0.0, 1.0, 1.0))
        x, y = x + dx_, y + dy_
        d2 = (q[:, 0] - x) ** 2 + (q[:, 1] - y) ** 2
        near = (d2 < (dia * 3) ** 2) & (np.abs(q[:, 2] - z) < 9.0) & isface
        if not near.any():
            continue
        # likeness:final: the two moles read alike (the upper one was measured fainter: it sits in the cheek's shading),
        # 1.6 mm at least, dark brown; the faint spots a little stronger so two or three read in a close-up
        r = max(dia * 0.5, 0.8 if kind > 0.5 else 0.5) * dsc
        sf = float(c.get("moleSoft", 0.0))        # fix round 1: mm of extra edge falloff (soft brown spots, not crisp dots)
        a = BH.ss(r * 1.25 + sf * 0.6, max(r * 0.6 - sf * 0.4, 0.15), np.sqrt(d2)) * near
        strength = (max((1.0 - con) * 1.25, 0.78) if kind > 0.5 else (1.0 - con) * float(c.get("faintSpots", 0.55))) * ssc
        tone = (np.array([0.5, 0.4, 0.36]) if sf <= 0 else np.array([0.56, 0.42, 0.33])) if kind > 0.5 else np.array([0.72, 0.62, 0.58])
        col *= 1 - np.clip(a * strength, 0, 0.75)[:, None] * (1 - tone)[None, :]
        out += 1
    # fix round 3: cheekSpots [n on his right, n on his left]: small faint freckles scattered over the upper cheeks (the
    # photo shows more than the six measured faint spots: 5-8 on his right upper cheek)
    cs_ = c.get("cheekSpots")
    if cs_:
        rng = np.random.default_rng(4049)
        fr_ = float(c.get("faintSpots", 0.55))
        for sg, nn in ((-1, int(cs_[0])), (1, int(cs_[1]))):
            for _ in range(nn):
                x = sg * rng.uniform(30.0, 54.0)
                y = rng.uniform(-30.0, -12.0)
                if any((x - m[0]) ** 2 + (y - m[1]) ** 2 < 16.0 for m in LK.moles):
                    continue
                d2 = (q[:, 0] - x) ** 2 + (q[:, 1] - y) ** 2
                near = (d2 < 9.0) & isface
                if not near.any():
                    continue
                r = rng.uniform(0.35, 0.65)
                a = BH.ss(r * 1.5 + 0.3, r * 0.4, np.sqrt(d2)) * near
                col *= 1 - np.clip(a * rng.uniform(0.1, 0.2) * fr_, 0, 0.6)[:, None] * (1 - np.array([0.7, 0.6, 0.56]))[None, :]
                out += 1
    return col, out


def beard_paint(c, B, LK, pos, hw, lipm, isface, seed, BH, lipgeo=None, nrm=None):
    """The beard's painted under-layer: alpha and colour (sRGB) per texel. Under dense beard it is a dark, nearly solid
    layer with a fine down-running hair texture (no skin shows between the cards); toward the cheek line and in the
    sparse patches it turns to a thinner hair texture with skin between the strokes, so the edge reads as hair thinning
    out (groomed: the map is already smooth and symmetric)."""
    ss, vnoise, hash01 = BH.ss, BH.vnoise, BH.hash01
    dens = LK.beard_density(pos, hw, ear_front_z(B), ear_low_y(B), sb_top=float(c.get("sideburnTop", 20.0)), nrm=nrm)
    dens = dens * (1 - ss(0.12, 0.45, lipm)) * isface
    bc = BH.hexc(c.get("beardColor", c.get("hairColor", "2e2119")))
    hairs = np.clip((vnoise(pos * np.array([3.0, 0.5, 3.0]), 1900, seed + 2.9) - 0.3) * 2.0, 0, 1)
    fine = np.clip((vnoise(pos * np.array([3.2, 0.7, 3.2]), 3100, seed + 7.3) - 0.25) * 1.8, 0, 1)
    if c.get("beardStroke"):
        # fix round 3: hair strokes the atlas can hold (~0.7 mm across, 4 mm along: the earlier 0.2 mm streaks averaged
        # to a smooth, flat mat at ~0.25 mm per texel), in two offset layers
        h1 = np.clip((vnoise(pos * np.array([1.0, 0.17, 1.0]), 1450, seed + 2.9) - 0.38) * 2.6, 0, 1)
        h2 = np.clip((vnoise(pos * np.array([1.0, 0.22, 1.0]) + 0.0031, 1150, seed + 5.1) - 0.4) * 2.6, 0, 1)
        hairs = np.clip(0.6 * h1 + 0.6 * h2, 0, 1)
    # likeness:final: the under-layer carries the beard's coverage as a solid hair texture (down-running strokes, no
    # dots): nearly opaque where the beard is dense, skin glinting between the strokes at the filled, lighter chin
    # (density ~0.6), a fine, thin edge where it thins out toward the cheek line
    cov = ss(0.04, 0.9, dens) ** 0.75
    # fix round 1 (beardPaint, default 0.6): the hair texture's floor where the beard is dense; Kai 0.72: the jaw strip
    # and the moustache read as one dense mat (about 0.9 coverage, 0.95 in the philtrum), skin only between the strokes
    # where the map thins out
    bp = float(c.get("beardPaint", 0.6))
    a = cov * (bp + (0.86 - bp) * hairs + 0.14 * fine) + ss(0.8, 1.0, dens) * 0.12
    over = np.zeros(len(pos))
    if lipgeo is not None and float(c.get("moHang", 0.0)) > 0:
        # fix round 1: the moustache hangs over the top of the upper vermilion (moHang: the share of the upper lip's
        # height it covers at the centre), its lower edge broken by strand tips, shorter toward the corners
        d_, hu_, t_, lf_ = lipgeo
        # fix round 2: moHangCorner (default 0.45 x moHang): the hang toward the mouth corners (Kai: deeper than at the
        # centre; his moustache's soft fringe covers the top of the upper vermilion out to the corners)
        h0_ = float(c["moHang"])
        hang = h0_ + (float(c.get("moHangCorner", h0_ * 0.45)) - h0_) * ss(0.25, 0.85, np.abs(t_))
        edge = hu_ * (1 - hang * (0.7 + 0.6 * hairs))
        over = ss(edge - 0.0004, edge + 0.0007, d_) * ss(hu_ + 0.0025, hu_ + 0.0005, d_) * lf_ * ss(1.0, 0.85, np.abs(t_)) * isface
        a = np.maximum(a, over * (0.82 + 0.16 * hairs))
        dens = np.maximum(dens, over * 0.95)
    # a faint shave shadow a little past the beard (the skin around a full beard is never bare-clean)
    halo = ss(0.0, 0.12, LK._grid(LK.beard, pos)) * ss(0.25, 0.7, hw) * isface * (1 - ss(0.12, 0.45, lipm))
    a = np.maximum(a, halo * 0.12 * (0.6 + 0.4 * fine))
    sk_ = float(c.get("beardStroke", 0.0))      # (the strokes' tone contrast)
    rgb = bc[None, :] * (0.78 - 0.1 * sk_ + (0.32 + 0.25 * sk_) * hairs[:, None] + 0.12 * fine[:, None]) * (1 - float(c.get("beardDark", 0.3)) * ss(0.8, 1.0, dens))[:, None]     # the dense band darker
    if c.get("moPaintDark"):     # fix round 2: the moustache's mat darker and solid (the cards on it lighter): one soft, dense mass
        qq = LK.mm(pos)
        sto_, sn_ = LK.lm.get("Sto", [0, -65, 0])[1], LK.lm.get("Sn", [0, -42, 0])[1]
        mz = ss(sto_ - 1.0, sto_ + 3.0, qq[:, 1]) * ss(sn_ + 1.0, sn_ - 3.0, qq[:, 1]) * ss(34.0, 26.0, np.abs(qq[:, 0])) * ss(0.5, 0.8, dens)
        if LK.light_map is not None:      # fix round 3: not over the philtrum notch (the moustache's thinner, lighter middle)
            mz = mz * (1 - LK.beard_light(pos))
        rgb = rgb * (1 - float(c["moPaintDark"]) * mz)[:, None]
        a = np.maximum(a, mz * 0.93)
    lt = LK.beard_light(pos) * isface * (1 - over)
    if c.get("beardWarm"):     # fix round 1: where the beard thins (under the lower lip) its hair reads a warmer, lighter brown
        wb = BH.hexc(c["beardWarm"])
        mid = ss(0.78, 0.5, dens) * ss(0.1, 0.35, dens) * (1 - over)
        if LK.light_map is not None:      # fix round 3: the lighter zone is lighter HAIR (a dense mat tinted warm), not thin hair
            mid = np.maximum(mid * (1 - lt), lt * 0.55)
        rgb = rgb + (mid * 0.6)[:, None] * (wb[None, :] * (0.85 + 0.3 * hairs[:, None]) - rgb)
    if LK.light_map is not None:
        # fix round 3: the mat there only 10-15 % lighter (the cards carry the light look), and solid: no skin window
        rgb = rgb * (1 + float(c.get("beardLightPaint", 0.12)) * lt)[:, None]
        a = np.maximum(a, lt * ss(0.5, 0.75, dens) * (0.8 + 0.12 * hairs))
    if LK.rim_map is not None and c.get("beardRimDark"):
        # fix round 3: the dark, dense rim along the jaw and the neck and at the chin's bottom edge: darker and less red
        # (the photo's dark jaw side is a near-neutral brown-black, r/g 1.1)
        rm = LK.beard_rim(pos) * ss(0.4, 0.8, dens)
        lum = (rgb * np.array([0.3, 0.59, 0.11])).sum(1, keepdims=True)
        rgb = rgb + (rm * 0.45)[:, None] * (lum * np.array([1.08, 1.0, 0.92]) - rgb)
        rgb = rgb * (1 - float(c["beardRimDark"]) * rm)[:, None]
        a = np.maximum(a, rm * 0.9)
    # fix round 3: clumps: the mat's tone varies over 5-8 mm patches (a flat, uniform mat read as a painted slab)
    clump = _vnoise(np.asarray(pos, float), 140.0, 2.2) - 0.5
    rgb = rgb * (1 + float(c.get("beardClump", 0.0)) * clump)[:, None]
    return np.clip(a, 0, 0.95), rgb, dens


def brow_shape(b, shape=None):
    """The measured brow profile (rows x, top, bottom, thickness mm) reshaped by a face file's `browShape` (fix round 1):
    flat: 0..1 how much of the arch of the lower edge is replaced by its straight fit (medial end to 72 % of the way
    out; rise scales that line's slope, pivot at the medial head); tail: mm the lower edge falls over the last 28 % (the tail tapers down, never ends raised); tailThin: the
    thickness left at the very end (share of the measured); head: the thickness left at the medial end (a feathered
    head, not a blunt block). Returns the new (n, 4) rows."""
    b = np.array(b, float)
    if not shape:
        return b
    xs, bot, th = b[:, 0], b[:, 2].copy(), b[:, 3].copy()
    t = (xs - xs[0]) / max(xs[-1] - xs[0], 1e-6)
    body = t <= 0.72
    A = np.stack([np.ones(body.sum()), t[body]], 1)
    a0, a1 = np.linalg.lstsq(A, bot[body], rcond=None)[0]
    line = a0 + a1 * float(shape.get("rise", 1.0)) * np.minimum(t, 0.72)      # rise: the straight line's slope scaled (pivot: the head)
    fl = float(shape.get("flat", 0.0))
    bot = bot + fl * (line - bot) * _ss(1.02, 0.72, t) + fl * (np.minimum(bot, line) - bot) * _ss(0.72, 0.8, t)
    tl = _ss(0.72, 1.0, t)
    bot = bot - float(shape.get("tail", 0.0)) * tl ** 1.5
    bot = bot - float(shape.get("latDrop", 0.0)) * _ss(0.3, 0.75, t)      # fix round 2: the lateral half lower (mm), close over the hooded lid
    th = th * (1.0 - (1.0 - float(shape.get("tailThin", 1.0))) * tl ** 1.2)
    th = th * (1.0 - (1.0 - float(shape.get("head", 1.0))) * _ss(0.12, 0.0, t))
    th = th * float(shape.get("thick", 1.0))
    return np.stack([xs, bot + th, bot, th], 1)


def brow_T(LK, e, sg, lift=0.0, shape=None):
    """build_humans.paint's brow curve T(t) (t: 0 medial -> 1 lateral) from the measured profile: (x from the eye
    centre outward, the lower edge above the eye centre, the thickness), metres. shape: the face file's `browShape`
    (brow_shape); the painted brow and the brow cards pass the same, so they stay registered (no double brow)."""
    b = brow_shape(LK.brow(0 if sg > 0 else 1), shape)
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
