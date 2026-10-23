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

