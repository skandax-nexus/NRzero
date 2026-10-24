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
        # Kai v3 (likeness/look_data.py --v3): the front photo's head frame bound by the fit's anchors (a similarity,
        # rotation included), the frontal beard thickness, the side photos' beard per vertex, the midline profile and
        # bottom of the beard, the brows at rest with their depth, the under-eye rows
        self.version = int(d["version"]) if "version" in d.files else 2
        self.v3 = self.version >= 3
        if self.v3:
            self.anchor_v = d["anchor_v"].astype(np.int64)
            self.anchor_mm = d["anchor_mm"].astype(np.float64)
            self.thick = d["beard_thick"].astype(np.float32)
            self.side_v = d["beard_side"].astype(np.float64)
            self.prof = d["beard_prof"].astype(np.float64)
            self.bottom = d["beard_bottom"].astype(np.float64)
            self.brow_z = d["brow_z"].astype(np.float64)
            self.brow_dens = d["brow_dens"].astype(np.float64)
            self.under_eye = d["under_eye"].astype(np.float64)
            self.R = np.eye(3)
            self.sm = 1000.0 * scale
            self.tr = np.zeros(3)
            self._shell = None

    # ---- frame
    def bind(self, P):
        """P: the sculpted base-mesh vertices (MH metres). Sets the frame origin (inner eye corner midpoint)."""
        t = json.load(open(os.path.join(HERE, "likeness", "mp_to_mh.json")))["front"]
        pts = []
        for i in (EN_R, EN_L):
            v, w = np.array(t["v"][i]), np.array(t["w"][i])
            pts.append((P[v] * w[:, None]).sum(0))
        self.origin = 0.5 * (pts[0] + pts[1])
        if self.v3:
            # Kai v3: the similarity (scale, rotation, translation) that takes the build's own anchor vertices onto their
            # head-frame mm under the fit's final pose (Umeyama): the maps then land where the photos saw them, whatever
            # the build's stature scale (the game keeps his 1.83 m: the build's head is ~8 % larger than the photo frame)
            A = np.asarray(P, float)[self.anchor_v]
            Bm = self.anchor_mm
            ca, cb = A.mean(0), Bm.mean(0)
            Ac, Bc = A - ca, Bm - cb
            U, S_, Vt = np.linalg.svd(Bc.T @ Ac)
            dd = np.sign(np.linalg.det(U @ Vt))
            Dg = np.diag([1.0, 1.0, dd])
            R = U @ Dg @ Vt
            sm = float(np.trace(np.diag(S_) @ Dg) / (Ac ** 2).sum())
            self.R, self.sm = R, sm
            self.tr = cb - sm * (R @ ca)
            self.scale = sm / 1000.0
            self.origin = self.to_mh(np.zeros(3))
            self.P = np.asarray(P, float)
            res = np.sqrt((((A @ R.T) * sm + self.tr - Bm) ** 2).sum(1).mean())
            self.bind_rms = float(res)
        return self

    def mm(self, pos):
        """MH metres -> face mm (x, y, z) of the photo frame."""
        if self.v3:
            return np.asarray(pos, float) @ (self.sm * self.R).T + self.tr
        return (np.asarray(pos, float) - self.origin) * 1000.0 * self.scale

    def to_mh(self, q):
        """face mm -> MH metres"""
        if self.v3:
            return ((np.asarray(q, float) - self.tr) @ self.R) / self.sm
        return self.origin + np.asarray(q, float) / 1000.0 / self.scale

    def dir_mm(self, v):
        """directions MH -> head frame (rotation only)"""
        return np.asarray(v, float) @ self.R.T if self.v3 else np.asarray(v, float)

    def dir_mh(self, v):
        """directions head frame -> MH"""
        return np.asarray(v, float) @ self.R if self.v3 else np.asarray(v, float)

    def front_surface(self, xy, near=None):
        """v3: build points (MH metres) on the front of the skin at head-frame (x, y) mm: the nearest front-facing head
        vertices in (x, y), inverse-distance weighted (near: an optional mask of candidate vertices)."""
        if not hasattr(self, "_fs"):
            q = self.mm(self.P)
            ok = (np.abs(q[:, 0]) < 80) & (q[:, 1] > -140) & (q[:, 1] < 80) & (q[:, 2] > -45)
            idx = np.nonzero(ok)[0]
            # keep the front-most vertex per 1.5 mm cell (the visible skin, not the eyeball, the mouth bag or the
            # back of the ear)
            cell = {}
            for i in idx[np.argsort(-q[idx, 2])]:
                k = (int(np.floor(q[i, 0] / 1.5)), int(np.floor(q[i, 1] / 1.5)))
                if k not in cell:
                    cell[k] = i
            self._fs = np.array(sorted(cell.values()))
            self._fsq = q[self._fs]
        xy = np.atleast_2d(np.asarray(xy, float))
        out = np.zeros((len(xy), 3))
        for k, (x, y) in enumerate(xy):
            d2 = (self._fsq[:, 0] - x) ** 2 + (self._fsq[:, 1] - y) ** 2
            j = np.argsort(d2)[:4]
            w = 1.0 / np.maximum(d2[j], 0.05)
            # the head-frame z there, then back to the build (the point lies on the skin, at exactly (x, y))
            z = float((self._fsq[j, 2] * w).sum() / w.sum())
            out[k] = self.to_mh(np.array([x, y, z]))
        return out

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
    def beard_density(self, pos, hw, ear_z, ear_lo=None, sb_top=None, nrm=None, side=None):
        """Beard density 0..1 at MH points pos: the frontal map (rows below the nose base), a sideburn band in front of
        the ear from the map's top up to the hairline, gated to the head (MakeHuman's head weights end under the jaw:
        the neckline) and to the front of the ear (above the lobe; below it the beard runs back along the jaw to its angle). hw: head weight per point;
        ear_z: z (MH) of the ear's front edge; ear_lo: y (MH) of the lowest point of the ear. side (v3): the side
        photos' coverage at the points (Look.side_at; -1 unseen)."""
        if self.v3:
            return self._beard_density_v3(pos, hw, ear_z, ear_lo, nrm, side)
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

    def side_at(self, tri_v, bary=None):
        """v3: the side photos' beard coverage at points on triangles (vertex ids (n, k), barycentrics or the mean):
        -1 where neither side photo saw the surface."""
        v = self.side_v[np.asarray(tri_v)]
        ok = v >= 0
        w = np.ones(v.shape) / v.shape[1] if bary is None else np.asarray(bary, float)
        wv = (w * ok).sum(1)
        return np.where(wv > 0.5, (w * np.where(ok, v, 0.0)).sum(1) / np.maximum(wv, 1e-9), -1.0)

    def _beard_density_v3(self, pos, hw, ear_z, ear_lo, nrm, side):
        """Kai v3: the front photo's map where the skin faces the front, the side photos' coverage (per vertex,
        interpolated: `side`) where it turns to the side or under the jaw; never on the ear or the scalp (the hair's)."""
        pos = np.asarray(pos, float)
        q = self.mm(pos)
        d_f = self._grid(self.beard, pos)
        if nrm is None:
            wf = np.ones(len(pos))
        else:
            nh = self.dir_mm(nrm)
            nh = nh / np.maximum(np.linalg.norm(nh, axis=1, keepdims=True), 1e-9)
            # the frontal map holds where the front camera sees the skin squarely; past ~55 deg the side photos
            wf = _ss(0.3, 0.62, nh[:, 2])
        z = pos[:, 2]
        front = _ss(ear_z - 0.004, ear_z + 0.006, z)          # (the frontal map's outline columns would paint the ear)
        if ear_lo is not None:
            front = np.maximum(front, _ss(ear_lo + 0.004, ear_lo - 0.008, pos[:, 1]) * _ss(ear_z - 0.03, ear_z - 0.016, z))
        if side is None:
            d = d_f * front
        else:
            side = np.asarray(side, float)
            seen = side >= 0
            d = np.where(seen, wf * d_f + (1 - wf) * np.clip(side, 0, 1), d_f * front)
        # the scalp's hair is the hair's: the sideburn fades in above eye level into the hairline
        d = d * _ss(10.0, 2.0, q[:, 1])
        # the neckline: under the jaw the beard runs onto the throat (the side photos), not down the neck
        d = d * _ss(0.03, 0.3, np.asarray(hw, float)) * _ss(-150.0, -132.0, q[:, 1])
        return np.clip(d, 0, 1)

    # ---- v3: the beard's volume (the shell the build grows its mat on, and the cards over it)
    def _midline_z(self):
        """the build's skin profile at the midline: head-frame (y, z) mm, the front-most skin per 2 mm of y"""
        if not hasattr(self, "_mid"):
            q = self.mm(self.P)
            m = (np.abs(q[:, 0]) < 3.0) & (q[:, 1] > -150) & (q[:, 1] < 40) & (q[:, 2] > -60)
            yy = np.arange(-150.0, 40.0, 2.0)
            zz = np.full(len(yy), np.nan)
            for k, y in enumerate(yy):
                s_ = m & (np.abs(q[:, 1] - y) < 1.5)
                if s_.any():
                    zz[k] = q[s_, 2].max()
            ok = np.isfinite(zz)
            self._mid = (yy[ok], zz[ok])
        return self._mid

    def beard_thickness(self, pos, nrm, dens):
        """Kai v3: the beard's standoff off the skin (head-frame mm) and the direction it stands off in (MH, unit) at
        skin points pos with normals nrm and beard density dens. The beard's measured volume:
          - the moustache 3-4.5 mm (the side photos: its front 2.5-2.8 mm past the fitted skin);
          - from under the lower lip to the chin's front, the side photo's midline outline (the beard front 22 -> 34 mm
            ahead of the eye corners from y -80 to -110), easing off toward the jaw;
          - under the chin it hangs: the standoff is taken down (the normal bent toward -y) to the front photo's dense
            bottom (y -135 at the midline, -127 at x 20, -113 at 30, -98 at 45), rising toward the throat;
          - the jaw sides 4.5-6.5 mm (the front silhouette 3-9; the side photos' back-edge step 5-9), the cheek band
            3.5 mm, the sideburn 1.5-2.5 mm (frizzy, sparse);
          - elsewhere the front map's standoff (measured on its silhouette, interpolated inside)."""
        pos = np.asarray(pos, float)
        q = self.mm(pos)
        nh = self.dir_mm(nrm)
        nh = nh / np.maximum(np.linalg.norm(nh, axis=1, keepdims=True), 1e-9)
        x, y, z = q.T
        ax = np.abs(x)
        lm = self.lm
        sn, ls, li, pg = lm["Sn"][1], lm["Ls"][1], lm["Li"][1], lm["Pg"][1]
        tf = np.clip(self._grid(self.thick, pos).astype(float), 0, 32)
        # the midline profile target: the beard front z(y), and the build's own skin profile
        pr = self.prof
        fr = pr[pr[:, 1] > 15.0]
        o = np.argsort(fr[:, 0])
        yy, zf = fr[o, 0], fr[o, 1]
        my, mz = self._midline_z()
        t_mid = np.interp(y, yy, zf) - np.interp(y, my, mz)
        # chin front (front-facing, under the lower lip): the midline standoff, easing toward the jaw
        chin = _ss(li - 2.0, li - 10.0, y) * _ss(0.2, 0.55, nh[:, 2])
        t_chin = np.clip(t_mid, 2.0, 26.0) * (1.0 - 0.45 * _ss(8.0, 48.0, ax))
        # under the chin: down to the front photo's bottom (rising 0.35 mm per mm toward the throat)
        yb = np.interp(ax, self.bottom[:, 0], self.bottom[:, 1], right=self.bottom[-1, 1])
        yb = yb + 0.35 * np.clip(-(z + 8.0), 0, None)
        hang = _ss(pg + 6.0, pg - 6.0, y) * _ss(-0.05, -0.5, nh[:, 1])
        dvec = nh + np.array([0.0, -0.9, 0.0])[None] * hang[:, None]
        dvec = dvec / np.maximum(np.linalg.norm(dvec, axis=1, keepdims=True), 1e-9)
        t_hang = np.clip((y - yb) / np.maximum(-dvec[:, 1], 0.45), 3.0, 30.0)
        # the moustache
        mo = _ss(ls - 1.0, ls + 3.0, y) * _ss(sn + 2.0, sn - 2.0, y) * _ss(34.0, 26.0, ax)
        t_mo = 3.0 + 1.5 * _ss(4.0, 18.0, ax)
        # jaw sides, cheek band, sideburn (the skin turned to the side)
        lat = _ss(0.45, 0.75, np.abs(nh[:, 0])) * (1 - hang)
        t_lat = np.interp(y, [-95.0, -70.0, -45.0, -20.0, 0.0, 8.0], [6.5, 5.5, 4.5, 3.5, 2.5, 1.5])
        t = tf.copy()
        t = t * (1 - chin) + t_chin * chin
        t = t * (1 - lat) + np.maximum(t_lat, 0.6 * tf) * lat
        t = t * (1 - hang) + t_hang * hang
        t = t * (1 - mo) + t_mo * mo
        # where the beard thins out it lies flat: the standoff follows the density
        t = t * _ss(0.15, 0.75, np.asarray(dens, float))
        t = np.clip(t, 0.0, 32.0)
        return t, self.dir_mh(dvec)

    def shell(self, B):
        """Kai v3: the beard's outer surface over the base mesh (cached per build): per vertex the density, the
        standoff (head mm), the offset direction (MH) and the offset point (MH metres). The standoff is smoothed over
        the mesh (one beard, not a relief of the skin's bumps)."""
        if self._shell is not None and self._shell[0] is B:
            return self._shell[1]
        P, N = np.asarray(B.P, float), np.asarray(B.N, float)
        ez, el = ear_front_z(B), ear_low_y(B)
        dens = self.beard_density(P, B.hw, ez, el, nrm=N, side=self.side_v[:len(P)])
        t, dv = self.beard_thickness(P, N, dens)
        F = [B.F[i][0] for i in B.faces]
        ii, jj = [], []
        for f in F:
            k = len(f)
            for a in range(k):
                ii.append(f[a])
                jj.append(f[(a + 1) % k])
        ii, jj = np.array(ii + jj), np.array(jj + ii)
        cnt = np.maximum(np.bincount(ii, minlength=len(P)), 1).astype(float)
        act = dens > 0.02
        for _ in range(6):
            acc = np.zeros(len(P))
            np.add.at(acc, ii, t[jj])
            t = np.where(act, 0.5 * t + 0.5 * acc / cnt, t)
            acc3 = np.zeros((len(P), 3))
            np.add.at(acc3, ii, dv[jj])
            dv = np.where(act[:, None], 0.5 * dv + 0.5 * acc3 / cnt[:, None], dv)
        dv = dv / np.maximum(np.linalg.norm(dv, axis=1, keepdims=True), 1e-9)
        S = P + dv * (t / self.sm)[:, None]
        out = dict(dens=dens, t=t, dir=dv, S=S)
        self._shell = (B, out)
        return out

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
    if LK.v3:
        return paint_zones_v3(c, B, LK, pos, col, isface, front, BH)
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
        if LK.v3:       # (v3: MediaPipe's depth of a cheek mole is a guess; the skin facing forward on its side is enough)
            near = (d2 < (dia * 3) ** 2) & (np.abs(q[:, 2] - z) < 25.0) & (q[:, 0] * np.sign(x) > 0) & isface
        else:
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


def beard_paint(c, B, LK, pos, hw, lipm, isface, seed, BH, lipgeo=None, nrm=None, side=None):
    """The beard's painted under-layer: alpha and colour (sRGB) per texel. Under dense beard it is a dark, nearly solid
    layer with a fine down-running hair texture (no skin shows between the cards); toward the cheek line and in the
    sparse patches it turns to a thinner hair texture with skin between the strokes, so the edge reads as hair thinning
    out (groomed: the map is already smooth and symmetric)."""
    ss, vnoise, hash01 = BH.ss, BH.vnoise, BH.hash01
    dens = LK.beard_density(pos, hw, ear_front_z(B), ear_low_y(B), sb_top=float(c.get("sideburnTop", 20.0)), nrm=nrm, side=side)
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
    if LK.v3:
        return _brow_T_v3(LK, e, sg, lift, b)
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


def _brow_T_v3(LK, e, sg, lift, b):
    """Kai v3: the brow at rest (head-frame mm rows: x outward, top, bottom) put on the build's skin through the fit's
    frame (Look.front_surface), then read as build_humans.paint's T(t) from the eye centre e (MH metres)."""
    xs = b[:, 0]
    Pb = LK.front_surface(np.stack([sg * xs, b[:, 2]], 1))
    Pt = LK.front_surface(np.stack([sg * xs, b[:, 2] + np.maximum(b[:, 3], 0.6)], 1))
    dx = (Pb[:, 0] - e[0]) * sg
    dy = Pb[:, 1] - e[1]
    th = np.maximum(Pt[:, 1] - Pb[:, 1], 0.6 / LK.sm)
    t0 = (xs - xs[0]) / (xs[-1] - xs[0])

    def T(t):
        t = np.asarray(t, float)
        return np.interp(t, t0, dx), np.interp(t, t0, dy) + lift, np.interp(t, t0, th)
    return T


# ---------------------------------------------------------------------------------------------------------------
# Kai v3: the de-lit skin zones of the 2026 front photo (front_look skin_zones: ratio of each zone's de-lit albedo to
# the skin reference), the measured under-eye crescent, and the lids (the face file's lidShade / lidHood as before)
# ---------------------------------------------------------------------------------------------------------------
V3_ZONES = (      # zone name, centre (head mm, his left; mirrored), radius mm, strength (the share of the measured deviation
                  # painted: the glabella's and the wings' darkness is half the renderer's own shading of those folds)
    ("forehead_centre", (0.0, 26.0), 14.0, 1.0),
    ("forehead_left", (34.3, 31.5), 13.0, 1.0),
    ("temple_left", (61.0, 22.0), 10.0, 0.6),
    ("glabella", (0.0, 12.9), 5.5, 0.45),
    ("nose_bridge", (0.0, -3.9), 5.0, 1.0),
    ("nose_dorsum", (0.0, -15.0), 5.5, 1.0),
    ("nose_tip", (0.0, -27.5), 6.5, 1.0),
    ("ala_left", (19.0, -28.4), 4.5, 0.55),
    ("cheekbone_left", (46.0, -13.4), 10.0, 1.0),
    ("cheek_left", (31.5, -30.9), 10.0, 1.0),
    ("lateral_cheek_left", (54.1, -33.8), 9.0, 1.0),
)


def _zone_ratio(LK, name):
    Z = LK.colours.get("zones", {})
    r = [np.array(Z[n]["ratio"], float) for n in (name, name.replace("_left", "_right")) if n in Z]
    return np.mean(r, 0) if r else np.ones(3)


def paint_zones_v3(c, B, LK, pos, col, isface, front, BH):
    ss, g2 = BH.ss, BH.g2
    L = B.L
    q = LK.mm(pos)
    face = isface.astype(float) * front
    k = lambda m, rgb: np.clip(m, 0, 1)[:, None] * (np.asarray(rgb)[None, :] - 1.0) + 1.0      # noqa: E731
    zk = float(c.get("zoneStrength", 1.0))
    # the zones' tints (linear albedo ratio -> sRGB), blended as a normalised radial field, mirrored for his right
    acc = np.zeros((len(pos), 3))
    wsum = np.full(len(pos), 0.08)
    for name, (zx, zy), r, kz in V3_ZONES:
        t_ = _zone_ratio(LK, name) ** (1 / 2.2)
        t_ = 1.0 + zk * kz * (t_ - 1.0)
        for sgn in ((1.0, -1.0) if zx > 0 else (1.0,)):
            w = np.exp(-(((q[:, 0] - sgn * zx) ** 2 + (q[:, 1] - zy) ** 2) / (2 * r * r)))
            acc += w[:, None] * t_[None, :]
            wsum += w
    tint = (acc + 0.08) / wsum[:, None]
    col *= 1.0 + (tint - 1.0) * face[:, None]
    # the under-eye crescent, as measured (per x: first / last mm below the lower lid margin, peak darkness), toward
    # the measured core colour (its ratio to the skin) by underEyeV3 of the way (the deep-set socket's own shading
    # does the rest)
    ue_k = float(c.get("underEyeV3", 0.7))
    core = np.mean([np.array(v, float) for v in LK.colours.get("under_eye_core", [])], 0) / np.array(LK.colours["skin_ref"], float)
    core = core ** (1 / 2.2)
    lid_lo = {1: -1.4, -1: -0.6}
    for e, sg in ((L.eyeL, 1), (L.eyeR, -1)):
        rows = LK.under_eye[0 if sg > 0 else 1]
        x = q[:, 0] * sg
        top = np.interp(x, rows[:, 0], rows[:, 1], left=rows[0, 1], right=rows[-1, 1])
        bot = np.minimum(np.interp(x, rows[:, 0], rows[:, 2], left=rows[0, 2], right=rows[-1, 2]), float(c.get("underEyeDepth", 16.0)))
        pk = np.interp(x, rows[:, 0], rows[:, 3], left=0.0, right=0.0)
        dep = lid_lo[sg] - q[:, 1]
        m = ss(top - 1.5, top + 1.5, dep) * ss(bot + 2.5, bot - 2.0, dep) * ss(12.0, 17.0, x) * ss(50.0, 45.0, x)
        m = m * np.clip(pk / 0.72, 0, 1) * face * (q[:, 2] > -40)
        col *= 1.0 + (m * ue_k)[:, None] * (core[None, :] - 1.0)
        # upper lid: darker skin between the lash line and the crease, and the hooded fold (the face file's keys)
        ex = (e[0] - LK.origin[0]) * 1000 * LK.scale
        ey = (e[1] - LK.origin[1]) * 1000 * LK.scale
        qe = LK.mm(np.asarray(e)[None])[0]
        dx, dy = (q[:, 0] - qe[0]) * sg, q[:, 1] - qe[1]
        (ux, uy), _ = L.lid["L" if sg > 0 else "R"]
        top_l = np.interp(dx / LK.sm, ux, uy) * LK.sm
        lid = ss(-0.5, 0.8, dy - top_l) * ss(7.5, 4.0, dy - top_l) * ss(-11.0, -6.0, dx) * ss(17.0, 13.0, dx)
        col *= k(lid * face * float(c.get("lidShade", 0.8)), [0.86, 0.80, 0.82])
        hd = float(c.get("lidHood", 0.0))
        if hd > 0:
            hood = ss(0.0, 2.5, dy - top_l) * ss(12.0, 7.0, dy - top_l) * ss(-12.0, -5.0, dx) * ss(19.0, 13.0, dx)
            col *= k(hood * face * hd, [0.86, 0.81, 0.82])
    return col
