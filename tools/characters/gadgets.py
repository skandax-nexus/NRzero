"""AFTERZERO gadgets (docs/COSTUMES.md "Gadgets and gameplay"): hard-surface pieces built on top of a finished costume.

A character spec lists them in `gear=[...]`: a name or (name, {options}); ancient props may be written `period:<name>`.
Every gadget is real geometry (bevelled boxes, chamfered cylinders, lathes, bands fitted to the limb under them),
placed by casting rays at the dressed body (so it sits on the outermost layer: harness, belt, shell, cap, helmet ...),
and weighted 100 % to one bone (straps, lanyards and cords that lie on the cloth copy the weights under them).

Output per gadget `<t>` (t = the gadget type, e.g. `chronolith_band`):
- body: joined into the character mesh (atlas material), coloured from a small flat-colour palette in the aux region
  of the atlas (gunmetal, graphite, polymer, smoked glass, bronze, leather ...), gloss in the shading mask.
- glow: a separate skinned mesh `gx_<t>` (node extras: gadget=<t>, slot='glow', idle=<level>, segs=<n>, bone) with a
  shared per-colour material `<id>_glow_<hex>` (extras slot='glow', glow=<hex>): base colour is the dark lens / inlay,
  emissive the light colour (emissiveFactor = colour; the runtime drives emissiveIntensity). Vertex attribute `_gseg`:
  the segment index (chronolith glyphs, shard index lights) or a 0..1 coordinate along the piece (visor scan lines).
- hand props (`gp_<t>`: staffs, spears, phones in the hand, umbrellas, jars ...): separate meshes with the atlas
  material weighted to the hand (extras gadget=<t>, prop='hand'), so the runtime can show them in idle / talk only.
- crowds (budget below 11 000 triangles, or `gadgetMeshes=False`): glow is baked into emissive palette swatches of
  the atlas at its idle level and joined into the body mesh (no extra draw calls).
The armature (glTF root node) carries `gadgets`: a JSON list of {type, bone, glow, idle, segs, prop, node}.
"""
import json
import math
import os
import numpy as np

BH = None
TORSO = frozenset(("torso", "neck", "legL", "legR"))
HEAD = frozenset(("head", "neck"))
HEADH = frozenset(("head", "neck", "hair"))
UP = None


def bind(m):
    global BH, UP
    BH = m
    from mathutils import Vector
    UP = Vector((0, 0, 1))


def V(*a):
    from mathutils import Vector
    return Vector(a[0] if len(a) == 1 else a)


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


# ----------------------------------------------------------------------------------------------------------------
# era rules: ancient props only in the settlement, technology never there
# ----------------------------------------------------------------------------------------------------------------
PERIOD = {"bronze_bracelets", "bronze_armlet", "bronze_pin", "bead_necklace", "tally_cords", "leather_satchel", "leather_pouch", "water_gourd",
          "clay_jar", "staff", "spear", "sling", "flint_knife", "distaff", "horn"}
ERA = {  # allowed eras for technology (default: 2049 and 2196)
    "smartphone": {"2026", "2049"}, "smartwatch": {"2026", "2049"}, "fitness_band": {"2026", "2049"}, "crossbody_bag": {"2026", "2049"},
    "tote_bag": {"2026", "2049"}, "school_backpack": {"2026", "2049"}, "loupe_cord": {"2026", "2049", "2196"}, "earbuds": {"2026", "2049"},
    "led_umbrella": {"2026", "2049"}, "id_badge": {"2026", "2049"}, "keycard_reel": {"2026", "2049"}, "ar_glasses": {"2049", "2196"},
    "respirator": {"2196"}, "goggles": {"2196"}, "magnifier_goggles": {"2196"}, "wrist_scanner_scav": {"2196"}, "handheld_scanner": {"2196"},
    "radio_chest_rig": {"2196"}, "salvage_backpack": {"2196"}, "rope_coil": {"2196"}, "crank_lamp": {"2196"}, "shard_bandolier": {"2196"},
    "sample_rig": {"2196"}, "continuum_chest_emitter": {"2196"}, "continuum_forearm_emitter": {"2196"}, "continuum_visor": {"2196"},
    "stabilizer_fins": {"2196"}, "rank_bar": {"2196"}, "cube_backpack": {"2049"}, "payment_terminal": {"2049"}, "kid_locator_band": {"2049"},
}


UNWRITTEN = {"chronolith_cuff_thin"}   # Orren (the Unwritten Second, outside time): only the pale echo of a Chronolith ring


def era_ok(typ, era):
    if era == "unwritten":
        return typ in UNWRITTEN
    if typ in PERIOD:
        return era == "ancient"
    if era == "ancient":
        return False
    return era in ERA.get(typ, {"2049", "2196", "2026"})


# ----------------------------------------------------------------------------------------------------------------
# geometry: numpy triangle/quad soup with per-face colour, gloss, smoothing; per-vertex weight tag and segment
# ----------------------------------------------------------------------------------------------------------------
class Geo:
    def __init__(s):
        s.v, s.f, s.col, s.gl, s.sm, s.wt, s.seg = [], [], [], [], [], [], []

    def add(s, verts, faces, col, gloss=0.4, smooth=False, wt=None, seg=0.0, recalc=True):
        verts = [tuple(p) for p in verts]
        if isinstance(smooth, (list, tuple)):
            smooth = list(smooth)
        if recalc:
            verts, faces, keep = _recalc(verts, faces)
            if isinstance(smooth, list):
                smooth = [smooth[i] for i in keep]
        o = len(s.v)
        s.v += verts
        s.f += [[o + i for i in f] for f in faces]
        n = len(faces)
        s.col += [col] * n
        s.gl += [gloss] * n
        s.sm += (list(smooth) if isinstance(smooth, (list, tuple)) else [smooth] * n)
        s.wt += [wt] * len(verts)
        s.seg += [seg] * len(verts)

    def tris(s):
        return sum(len(f) - 2 for f in s.f)


def _recalc(verts, faces):
    """Consistent outward winding (closed pieces) via bmesh."""
    import bmesh
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in verts]
    keep = []
    for i, f in enumerate(faces):
        try:
            bm.faces.new([vs[j] for j in f])
            keep.append(i)
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.verts.index_update()
    out_f = [[v.index for v in f.verts] for f in bm.faces]
    out_v = [tuple(v.co) for v in bm.verts]
    bm.free()
    return out_v, out_f, keep


def _bm_arrays(bm, M=None):
    if M is not None:
        import bmesh
        bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    bm.verts.index_update()
    verts = [tuple(v.co) for v in bm.verts]
    faces = [[v.index for v in f.verts] for f in bm.faces]
    nz = [abs(f.normal.z) for f in bm.faces]
    bm.free()
    return verts, faces, nz


def box(w, h, d, bev=0.0, seg=1, M=None, taper=0.0):
    """Bevelled box: x = w, y = h centred, z from 0 (back, on the surface) to d (front). taper shrinks the front face."""
    import bmesh
    from mathutils import Matrix
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        t = 1 - taper * (v.co.z + 0.5)
        v.co.x, v.co.y, v.co.z = v.co.x * w * t, v.co.y * h * t, (v.co.z + 0.5) * d
    if bev > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bev, 0.45 * min(w, h, d)), segments=seg, affect="EDGES", profile=0.5)
    _ = Matrix
    return _bm_arrays(bm, M)[:2]


def cyl(r, d, n=12, bev=0.0, M=None, r2=None, z0=0.0):
    """Chamfered cylinder along z from z0 to z0 + d (r2: front radius)."""
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=n, radius1=r, radius2=r if r2 is None else r2, depth=d)
    for v in bm.verts:
        v.co.z += d / 2 + z0
    if bev > 0:
        ed = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-7]
        bmesh.ops.bevel(bm, geom=ed, offset=min(bev, 0.45 * d, 0.45 * r), segments=1, affect="EDGES")
    verts, faces, nz = _bm_arrays(bm, M)
    return verts, faces, [z < 0.6 for z in nz]


def lathe(prof, n=10, M=None):
    """Surface of revolution around z: prof = [(r, z), ...] bottom to top (r = 0 ends are poles)."""
    verts, faces, rings = [], [], []
    for r, z in prof:
        if r <= 1e-6:
            rings.append([len(verts)])
            verts.append((0.0, 0.0, z))
        else:
            ring = []
            for i in range(n):
                t = 2 * math.pi * i / n
                ring.append(len(verts))
                verts.append((r * math.cos(t), r * math.sin(t), z))
            rings.append(ring)
    for a, b in zip(rings[:-1], rings[1:]):
        if len(a) == 1:
            faces += [[a[0], b[i], b[(i + 1) % n]] for i in range(n)]
        elif len(b) == 1:
            faces += [[a[i], a[(i + 1) % n], b[0]] for i in range(n)]
        else:
            faces += [[a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]] for i in range(n)]
    if len(rings[0]) > 1:
        faces.append(rings[0][::-1])
    if len(rings[-1]) > 1:
        faces.append(rings[-1])
    return _xf(verts, M), faces


def _xf(verts, M):
    if M is None:
        return verts
    A = np.array(M)
    P = np.asarray(verts, float)
    return (P @ A[:3, :3].T + A[:3, 3]).tolist()


def tube(pts, r, n=6, caps=True):
    """Tube through points (Vectors); r: radius or per-point radii. Parallel-transport frames."""
    pts = [V(p) for p in pts]
    rs = r if isinstance(r, (list, tuple, np.ndarray)) else [r] * len(pts)
    verts, faces = [], []
    prev = None
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        if prev is None:
            a = d.orthogonal().normalized()
        else:
            a = (prev - d * prev.dot(d)).normalized()
        prev = a
        b = d.cross(a)
        for j in range(n):
            t = 2 * math.pi * j / n
            verts.append(tuple(p + (a * math.cos(t) + b * math.sin(t)) * rs[i]))
    for i in range(len(pts) - 1):
        for j in range(n):
            faces.append([i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j])
    if caps:
        faces.append(list(range(n))[::-1])
        faces.append([(len(pts) - 1) * n + j for j in range(n)])
    return verts, faces


def torus(R, r, n=16, m=5, M=None, arc=2 * math.pi):
    verts, faces = [], []
    closed = arc >= 2 * math.pi - 1e-6
    nn = n if closed else n + 1
    for i in range(nn):
        t = arc * i / n
        for j in range(m):
            s = 2 * math.pi * j / m
            rr = R + r * math.cos(s)
            verts.append((rr * math.cos(t), rr * math.sin(t), r * math.sin(s)))
    for i in range(n):
        i2 = (i + 1) % nn
        for j in range(m):
            faces.append([i * m + j, i2 * m + j, i2 * m + (j + 1) % m, i * m + (j + 1) % m])
    if not closed:
        faces.append(list(range(m)))
        faces.append([n * m + j for j in range(m)][::-1])
    return _xf(verts, M), faces


def ribbon(P, N, width, thick, closed=False, side=None):
    """Flat strap along points P (Vectors) lying on normals N: a thin box section (width across, thick out)."""
    P = [V(p) for p in P]
    N = [V(n).normalized() for n in N]
    m = len(P)
    verts = []
    for i in range(m):
        d = (P[(i + 1) % m if closed else min(i + 1, m - 1)] - P[(i - 1) % m if closed else max(i - 1, 0)])
        s = (side[i] if side is not None else d.cross(N[i])).normalized()
        for a, o in ((-0.5, 0.0), (0.5, 0.0), (0.5, 1.0), (-0.5, 1.0)):
            verts.append(tuple(P[i] + s * (a * width) + N[i] * (o * thick)))
    faces = []
    for i in range(m if closed else m - 1):
        i2 = (i + 1) % m
        for j in range(4):
            faces.append([i * 4 + j, i * 4 + (j + 1) % 4, i2 * 4 + (j + 1) % 4, i2 * 4 + j])
    if not closed:
        faces.append([0, 1, 2, 3][::-1])
        faces.append([(m - 1) * 4 + j for j in range(4)])
    return verts, faces


def frame(p, n, up=None):
    """4x4 matrix: local z = n (out of the surface), local y as close to `up` as possible, origin p."""
    from mathutils import Matrix
    z = V(n).normalized()
    u = V(up) if up is not None else V((0, 0, 1))
    x = u.cross(z)
    if x.length < 1e-5:
        x = V((1, 0, 0)).cross(z) if abs(z.x) < 0.9 else V((0, 1, 0)).cross(z)
    x.normalize()
    y = z.cross(x)
    return Matrix(((x.x, y.x, z.x, p[0]), (x.y, y.y, z.y, p[1]), (x.z, y.z, z.z, p[2]), (0, 0, 0, 1)))


def mat_axes(xa, ya, za, p):
    from mathutils import Matrix
    return Matrix(((xa[0], ya[0], za[0], p[0]), (xa[1], ya[1], za[1], p[1]), (xa[2], ya[2], za[2], p[2]), (0, 0, 0, 1)))


def local(M, x=0.0, y=0.0, z=0.0):
    """M moved by (x, y, z) in its own axes."""
    from mathutils import Matrix
    return M @ Matrix.Translation((x, y, z))


def rot(M, axis, ang):
    from mathutils import Matrix
    return M @ Matrix.Rotation(ang, 4, axis)


# ----------------------------------------------------------------------------------------------------------------
# palette colours
# ----------------------------------------------------------------------------------------------------------------
GUN, GRAPH, BLACK, POLY, GLASS, WHITE = "3a3f46", "25282d", "131417", "2e3238", "0d1116", "e6e8ea"
STEEL, SILVER, GOLD, BRONZE, BRASS = "8a9098", "a4a8ac", "c9a050", "b0803c", "a88a4a"
LEATHER, LEATHER2, WOOD, WOOD2, CLAY, CORD, LINEN = "5a3e28", "4a3220", "7a5634", "5e4026", "a0603a", "8a7458", "cdb48a"
ORANGE, YELLOW, RED, OLIVE, CANVAS, RUBBER = "d9781e", "d4c21a", "a8262e", "4a4a3a", "6a5a44", "1b1b1b"


# ----------------------------------------------------------------------------------------------------------------
# the kit: ray casting on the dressed body, frames, landmarks, output
# ----------------------------------------------------------------------------------------------------------------
def fam_of(bone):
    if bone in ("head",):
        return "head"
    if bone == "neck":
        return "neck"
    if bone.startswith(("upperarm", "forearm", "hand")):
        return "arm" + bone[-1]
    if bone.startswith(("thigh", "shin", "foot", "toe")):
        return "leg" + bone[-1]
    return "torso"


class Kit:
    def __init__(s, c, B, cov, objs):
        from mathutils.bvhtree import BVHTree
        s.c, s.B, s.cov = c, B, cov
        s.k = B.H / 1.75
        s.J = B.J
        s.era = c.get("era", "2049")
        bud = BH.budget(c)
        s.lod = 2 if bud >= 15000 else 1 if bud >= 11000 else 0
        s.bake = not c.get("gadgetMeshes", bud >= 11000)
        s.glow_hex = (c.get("glow") or "ffffff").lstrip("#")
        V_, F_, fam, srcn, WV, FV = [], [], [], [], [], []
        for o in objs:
            W = BH.WSTORE.get(o.name)
            if W is None or not len(o.data.polygons):
                continue
            co = BH.obj_world_verts(o)
            W = np.asarray(W)
            if len(W) != len(co):
                continue
            dom = W.argmax(1)
            vf = np.array([fam_of(BH.BONE_NAMES[j]) for j in dom])
            mk = o.data.attributes.get("_mask")
            if mk is not None:
                m = np.zeros(len(co) * 3, np.float32)
                mk.data.foreach_get("vector", m)
                vf[m.reshape(-1, 3)[:, 2] > 0.5] = "hair"
            off = len(V_)
            V_ += co.tolist()
            WV.append(W)
            FV.append(vf)
            for p in o.data.polygons:
                vs = list(p.vertices)
                F_.append([off + i for i in vs])
                fs = list(vf[vs])
                fam.append(max(set(fs), key=fs.count))
                srcn.append(o.name)
        s.V = np.array(V_)
        s.F, s.ffam, s.fsrc = F_, fam, srcn
        s.W = np.concatenate(WV)
        s.vfam = np.concatenate(FV)
        s.bvh = BVHTree.FromPolygons([tuple(p) for p in V_], F_)
        s._sub = {}
        s.gads = []
        s.eye = {sd: BH.to_bl(getattr(B.L, "eye" + sd)) for sd in "LR"}
        s.ear = {sd: BH.to_bl(getattr(B.L, "ear" + sd)) for sd in "LR"}
        s.eyec = (s.eye["L"] + s.eye["R"]) / 2
        s.belt_z = s.J["spine"].z - 0.055 * s.k
        s.hands = {}

    # ---- rays ----
    def ray(s, o, d, fams=TORSO, maxd=1.5, skip_src=()):
        o, d = V(o), V(d).normalized()
        t = 0.0
        for _ in range(16):
            loc, nrm, idx, dist = s.bvh.ray_cast(o, d, maxd - t)
            if loc is None:
                return None
            if s.ffam[idx] in fams and not s.fsrc[idx].startswith(skip_src or ("\0",)):
                n = V(nrm)
                if n.dot(d) > 0:
                    n = -n
                return loc, n, idx
            o = loc + d * 2e-4
            t += dist + 2e-4
        return None

    def toward(s, target, out, fams=TORSO, dist=0.5, skip_src=()):
        """Outermost surface point along the line from `target` + out * dist back to target."""
        out = V(out).normalized()
        return s.ray(V(target) + out * dist, -out, fams, dist * 2, skip_src)

    def patch(s, target, out, fams=TORSO, r=0.015, skip_src=()):
        """Surface point and averaged normal (3 x 3 rays around target)."""
        out = V(out).normalized()
        a = out.orthogonal().normalized()
        b = out.cross(a)
        h0 = s.toward(target, out, fams, skip_src=skip_src)
        if h0 is None:
            return V(target), out
        n = V((0, 0, 0))
        for i in (-1, 0, 1):
            for j in (-1, 0, 1):
                h = s.toward(V(target) + a * (i * r) + b * (j * r), out, fams, skip_src=skip_src)
                if h is not None:
                    n += h[1]
        n = n.normalized() if n.length > 1e-6 else out
        if n.dot(out) < 0.3:
            n = (n + out).normalized()
        return h0[0], n

    def front(s, x, z, back=False, fams=TORSO, r=0.015, skip_src=()):
        """(point, normal) on the outermost torso surface at (x, z), front (-y) or back (+y)."""
        out = V((0, 1, 0)) if back else V((0, -1, 0))
        yc = -float(BH.costume.zc_at(s.B, z)) if hasattr(BH, "costume") else 0.0
        return s.patch(V((x, yc, z)), out, fams, r, skip_src)

    def soft_weights(s, pts, fams=TORSO):
        key = tuple(sorted(fams))
        if key not in s._sub:
            m = np.isin(s.vfam, list(fams))
            s._sub[key] = (s.V[m], s.W[m])
        ref, W = s._sub[key]
        return BH.nearest_weights(np.asarray(pts), ref, W, k=4)

    # ---- limbs ----
    def hand(s, sd):
        """Hand frame: wrist, axis (wrist -> fingers), palm (out of the palm), across (perpendicular), grip point."""
        if sd in s.hands:
            return s.hands[sd]
        B = s.B
        hv = np.array([i for i in B.bodyv if B.vb[i] == "hand_" + sd])
        P = BH.to_bl_np(B.P[hv])
        w, e = np.array(s.J["wrist_" + sd]), np.array(s.J["handEnd_" + sd])
        a = (e - w) / np.linalg.norm(e - w)
        Q = P - P.mean(0)
        Q = Q - np.outer(Q @ a, a)
        ev, evec = np.linalg.eigh(Q.T @ Q)
        pn = evec[:, 0]
        along = (P - w) @ a
        L = np.linalg.norm(e - w)
        tips = P[along > along.max() - 0.25 * (along.max() - along.min())]
        if (tips.mean(0) - P.mean(0)) @ pn < 0:
            pn = -pn
        pn = pn - (pn @ a) * a
        pn /= np.linalg.norm(pn)
        ac = np.cross(a, pn)
        th = abs((P - P.mean(0)) @ pn).max()
        grip = w + a * (0.62 * L) + pn * (th * 0.6 + 0.004)
        s.hands[sd] = dict(wrist=V(w), axis=V(a), palm=V(pn), across=V(ac), grip=V(grip), len=L)
        return s.hands[sd]

    def limb_ring(s, sd, j0, j1, t, n=16, fams=None, along=0.0, inner=False):
        """Cross-section of the dressed limb at fraction t from joint j0 to j1 (+ `along` metres): centre, axis, dorsal
        and side axes, radius per angle (angle 0 = dorsal = back of the hand / outside of the arm). inner=True: the
        innermost surface (rays from the bone outward: the skin under a loose sleeve)."""
        a, b = s.J[j0 + sd], s.J[j1 + sd]
        ax = (b - a).normalized()
        c = a.lerp(b, t) + ax * along
        dors = -s.hand(sd)["palm"]
        e1 = (dors - ax * dors.dot(ax)).normalized()
        e2 = ax.cross(e1)
        fams = fams or frozenset(("arm" + sd,))
        rr = []
        for i in range(n):
            th = 2 * math.pi * i / n
            d = e1 * math.cos(th) + e2 * math.sin(th)
            h = s.ray(c + d * 0.002, d, fams, 0.3) if inner else s.ray(c + d * 0.16, -d, fams, 0.3)
            rr.append((h[0] - c).dot(d) if h is not None else np.nan)
        rr = np.array(rr)
        if np.isnan(rr).all():
            rr[:] = 0.03 * s.k
        rr = np.where(np.isnan(rr), np.nanmean(rr), rr)
        rs = np.maximum(rr, (np.roll(rr, 1) + rr + np.roll(rr, -1)) / 3)
        return dict(c=c, ax=ax, e1=e1, e2=e2, r=rs)

    def add(s, g):
        s.gads.append(g)
        return g


class Gad:
    """One gadget being built: body / glow geometry, its bone and runtime metadata."""

    def __init__(s, K, typ, bone, o):
        s.K, s.typ, s.bone, s.o = K, typ, bone, o
        s.body, s.glow = Geo(), Geo()
        s.prop = None
        s.idle = float(o.get("idle", 0.0))
        s.segs = 0
        s.seg_mode = "index"
        s.glow_hex = (o.get("glow") or K.glow_hex).lstrip("#")

    def part(s, geo_vf, col, gloss=0.4, smooth=False, wt=None, recalc=True):
        verts, faces = geo_vf[0], geo_vf[1]
        if len(geo_vf) > 2 and smooth == "auto":
            smooth = geo_vf[2]
        elif smooth == "auto":
            smooth = False
        s.body.add(verts, faces, col.lstrip("#"), gloss, smooth, wt or s.bone, recalc=recalc)

    def light(s, geo_vf, seg=0.0, smooth=False, wt=None, recalc=True):
        verts, faces = geo_vf[0], geo_vf[1]
        if len(geo_vf) > 2 and smooth == "auto":
            smooth = geo_vf[2]
        elif smooth == "auto":
            smooth = False
        s.glow.add(verts, faces, s.glow_hex, 0.9, smooth, wt or s.bone, seg, recalc=recalc)


# ----------------------------------------------------------------------------------------------------------------
# shared builders
# ----------------------------------------------------------------------------------------------------------------
def band_geo(R, w, t, gap=0.0015, ch=None, a0=None, a1=None, n=None, groove=None, along=0.0, fit=False):
    """A band (closed ring, or an arc a0..a1 in radians from dorsal) of width w and thickness t on a limb ring.
    fit=True with R from fitted_ring ("r_lo" / "r_hi": limb radii at the elbow-side / hand-side edge): the inner lip
    of each edge closes in to the limb there, so a band sized to a sleeve hem shows no gap over the bare wrist."""
    ch = t * 0.45 if ch is None else ch
    rr = R["r"]
    edge = {0: R.get("r_lo"), 5: R.get("r_hi")} if fit else {}
    nr = len(rr)
    closed = a0 is None
    n = n or nr
    prof = [(0.0, -w / 2), (t * 0.6, -w / 2), (t, -w / 2 + ch), (t, w / 2 - ch), (t * 0.6, w / 2), (0.0, w / 2)]
    verts = []
    cnt = n if closed else n + 1
    for i in range(cnt):
        th = 2 * math.pi * i / n if closed else a0 + (a1 - a0) * i / n
        fi = (th / (2 * math.pi) * nr) % nr
        i0 = int(fi)
        f = fi - i0
        r = rr[i0] * (1 - f) + rr[(i0 + 1) % nr] * f + gap
        d = R["e1"] * math.cos(th) + R["e2"] * math.sin(th)
        gr = 1.0
        if groove and closed and (i % groove == 0):
            gr = 0.55
        for j, (dr, da) in enumerate(prof):
            re_ = edge.get(j)
            if re_ is not None:
                r_e = min(re_[i0] * (1 - f) + re_[(i0 + 1) % nr] * f + gap * 0.5, r)
                verts.append(tuple(R["c"] + R["ax"] * (da + along) + d * r_e))
                continue
            verts.append(tuple(R["c"] + R["ax"] * (da + along) + d * (r + dr * (gr if dr > 0 else 1.0))))
    faces = []
    m = len(prof)
    for i in range(n):
        i2 = (i + 1) % cnt
        for j in range(m):
            faces.append([i * m + j, i * m + (j + 1) % m, i2 * m + (j + 1) % m, i2 * m + j])
    if not closed:
        faces.append(list(range(m))[::-1])
        faces.append([n * m + j for j in range(m)])
    return verts, faces


def ring_frame(R, th, t=0.0, along=0.0, gap=0.0015):
    """Frame on top of a limb band at angle th (local z out, local y along the limb)."""
    rr = R["r"]
    nr = len(rr)
    fi = (th / (2 * math.pi) * nr) % nr
    i0 = int(fi)
    f = fi - i0
    r = rr[i0] * (1 - f) + rr[(i0 + 1) % nr] * f + gap + t
    d = R["e1"] * math.cos(th) + R["e2"] * math.sin(th)
    p = R["c"] + R["ax"] * along + d * r
    return frame(p, d, R["ax"])


def torso_loop(K, p_hi, p_lo, n=36, fams=TORSO, lift=0.003, skip_src=(), seg=0.025):
    """Closed path around the torso in the plane through p_hi (over a shoulder) and p_lo (a hip) that contains the
    forward axis: a sash / bandolier / bag strap line. Returns n points (even arc length) and outward normals.
    Rays are cast at evenly spaced angles, then more are added wherever two hits are further apart than `seg`
    (the turn over the shoulder and round the hip), so no chord cuts into the cloth."""
    p_hi, p_lo = V(p_hi), V(p_lo)
    u = (p_hi - p_lo).normalized()
    f = V((0, -1, 0))
    f = (f - u * f.dot(u)).normalized()
    c = (p_hi + p_lo) / 2

    def hit(th):
        d = u * math.cos(th) + f * math.sin(th)
        return K.ray(c + d * 0.7, -d, fams, 1.4, skip_src)
    pts = []
    for i in range(36):
        th = 2 * math.pi * i / 36
        h = hit(th)
        if h is not None:
            pts.append((th, h[0], h[1]))
    for _ in range(6):
        add = []
        for i in range(len(pts)):
            a_, b_ = pts[i], pts[(i + 1) % len(pts)]
            if (a_[1] - b_[1]).length > seg:
                tb = b_[0] if b_[0] > a_[0] else b_[0] + 2 * math.pi
                if tb - a_[0] < 1e-3:
                    continue
                h = hit((a_[0] + tb) / 2)
                if h is not None:
                    add.append(((a_[0] + tb) / 2 % (2 * math.pi), h[0], h[1]))
        if not add or len(pts) > 400:
            break
        pts = sorted(pts + add, key=lambda x: x[0])
    P = [p_ + n_ * lift for _, p_, n_ in pts]
    N = [n_ for _, _, n_ in pts]
    P, N = _smooth_loop(P, N, it=1)
    A = np.array([tuple(p_) for p_ in P + [P[0]]])
    Nn = np.array([tuple(n_) for n_ in N + [N[0]]])
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(A, axis=0), axis=1))]
    t = np.linspace(0, d[-1], n, endpoint=False)
    Pr = [V(tuple(np.interp(tt, d, A[:, j]) for j in range(3))) for tt in t]
    Nr = [V(tuple(np.interp(tt, d, Nn[:, j]) for j in range(3))).normalized() for tt in t]
    return Pr, Nr


def neck_loop(K, z_front, z_back, n=24, fams=TORSO | {"neck"}, lift=0.003, r_out=0.2):
    """Closed path around the neck base sloping from z_back (behind) to z_front (front, lower)."""
    c0 = K.J["neck"]
    P, N = [], []
    for i in range(n):
        th = 2 * math.pi * i / n
        d = V((math.sin(th), -math.cos(th), 0))
        z = z_back + (z_front - z_back) * (0.5 + 0.5 * math.cos(th))
        h = K.ray(V((c0.x, c0.y, z)) + d * r_out + V((0, 0, 0.06)), (-d * r_out - V((0, 0, 0.06))).normalized(), fams, 0.6)
        if h is None:
            continue
        P.append(h[0] + h[1] * lift)
        N.append(h[1])
    return _smooth_loop(P, N)


def _smooth_loop(P, N, it=2):
    P = np.array([tuple(p) for p in P])
    N = np.array([tuple(n) for n in N])
    for _ in range(it):
        P = (np.roll(P, 1, 0) + 2 * P + np.roll(P, -1, 0)) / 4
        N = (np.roll(N, 1, 0) + 2 * N + np.roll(N, -1, 0)) / 4
    N /= np.linalg.norm(N, axis=1, keepdims=True)
    return [V(tuple(p)) for p in P], [V(tuple(n)) for n in N]


def surf_path(K, guide, fams=TORSO, lift=0.003):
    """Points of a guide polyline dropped onto the nearest outer surface (rays from outside along each guide
    point's outward direction from the torso axis)."""
    P, N = [], []
    dense = []
    for i in range(len(guide) - 1):
        g0, g1 = V(guide[i]), V(guide[i + 1])
        m = max(1, int(math.ceil((g1 - g0).length / 0.025)))
        dense += [g0.lerp(g1, j / m) for j in range(m)]
    dense.append(V(guide[-1]))
    for g in dense:
        c = V((0, -float(BH.costume.zc_at(K.B, g.z)), g.z))
        out = (g - c)
        out = out.normalized() if out.length > 1e-4 else V((0, -1, 0))
        h = K.toward(g, out, fams, 0.4)
        if h is None:
            continue
        P.append(h[0] + h[1] * lift)
        N.append(h[1])
    return P, N


def resample(P, n):
    A = np.array([tuple(p) for p in P])
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(A, axis=0), axis=1))]
    t = np.linspace(0, d[-1], n)
    return [V(tuple(np.array([np.interp(tt, d, A[:, j]) for j in range(3)]))) for tt in t]


def strap(g, P, N, width, thick, col, gloss=0.15, closed=False, soft=True):
    g.part(ribbon(P, N, width, thick, closed), col, gloss, smooth=True, wt="soft" if soft else None)


def ensure_diag(K, side_hi="L"):
    """Shoulder and opposite-hip points of a diagonal strap (side_hi: the shoulder it crosses)."""
    s = 1 if side_hi == "L" else -1
    k = K.k
    sh = K.J["shoulder_" + side_hi]
    p_hi = V((sh.x * 0.62, sh.y + 0.01, sh.z + 0.06 * k))
    hp = K.J["hip_" + ("R" if side_hi == "L" else "L")]
    p_lo = V((hp.x + -s * 0.03 * k, hp.y, hp.z + 0.02 * k))
    return p_hi, p_lo


# ----------------------------------------------------------------------------------------------------------------
# the catalogue
# ----------------------------------------------------------------------------------------------------------------
CAT = {}


def gadget(name, bone):
    def deco(fn):
        CAT[name] = (fn, bone)
        return fn
    return deco


def opt_side(o, d):
    return o.get("side", d)


# ---------------- wrist and arm pieces ----------------
def fitted_ring(K, sd, along, w, n=16, fams=None, t=1.0, inner=False):
    """Limb ring for a band of width w centred `along` metres from the wrist: outer radius = the widest of five
    sections under the band (a sleeve hem never pokes through), inner lips = the limb radius at each edge."""
    R = K.limb_ring(sd, "elbow_", "wrist_", t, n=n, along=along, fams=fams, inner=inner)
    secs = [K.limb_ring(sd, "elbow_", "wrist_", t, n=n, along=along + f * (w / 2 - 0.002), fams=fams, inner=inner)["r"] for f in (-1, -0.5, 0.5, 1)]
    R["r"] = np.max(np.stack([R["r"]] + secs), 0)
    R["r_lo"], R["r_hi"] = secs[0], secs[3]
    return R


def sleeve_hem(K, sd, fams=None):
    """`along` (metres from the wrist joint) of the sleeve hem on the forearm: the last sharp drop of the limb radius
    going toward the hand (None: bare forearm, or the sleeve runs over the wrist)."""
    key = ("hem", sd)
    if key not in K._sub:
        st = 0.004 * K.k
        al = np.arange(-0.11 * K.k, 0.006 * K.k, st)
        r = np.array([float(np.mean(K.limb_ring(sd, "elbow_", "wrist_", 1.0, n=8, along=a, fams=fams)["r"])) for a in al])
        hem = None
        for i in range(1, len(al)):
            if r[i - 1] - r[i] > 0.0025:
                hem = float(al[i])
        K._sub[key] = hem
        if os.environ.get("GADGET_DEBUG"):
            print("  hem", sd, hem, " ".join("%.3f:%.4f" % (a, b) for a, b in zip(al, r)), flush=True)
    return K._sub[key]


def wrist_band(g, sd, w, t, col, gloss, along=-0.035, n=16, groove=None, fams=None, auto=None):
    """A band at the wrist. Narrow bands (auto, w <= 3.5 cm) never straddle a sleeve hem: under a loose sleeve
    (1.2 cm or more of room) they sit on the skin, half out below the hem; under a fitted one they move onto the
    bare wrist below the hem when there is room, else up onto the sleeve end."""
    K = g.K
    along *= K.k
    ww = w * K.k
    inner = False
    if (ww <= 0.035 if auto is None else auto):
        hem = sleeve_hem(K, sd, fams)
        if hem is not None and hem > along - ww:
            a_ = hem - 0.01 * K.k
            ro = float(np.mean(K.limb_ring(sd, "elbow_", "wrist_", 1.0, n=8, along=a_, fams=fams)["r"]))
            ri = float(np.mean(K.limb_ring(sd, "elbow_", "wrist_", 1.0, n=8, along=a_, fams=fams, inner=True)["r"]))
            if ro - ri > 0.012:
                inner, along = True, min(hem + ww * 0.3, 0.004 * K.k - ww / 2)
            elif along - ww / 2 < hem < along + ww / 2:
                below = hem + ww / 2 + 0.003
                along = below if below + ww / 2 <= 0.006 * K.k else hem - ww / 2 - 0.002
    R = fitted_ring(K, sd, along, ww, n=n, fams=fams, inner=inner)
    g.part(band_geo(R, w * K.k, t, groove=groove, fit=True), col, gloss, smooth=True)
    return R


@gadget("chronolith_band", "forearm_L")
def g_chronolith(g):
    """Kai's segmented gunmetal cuff (7 cm) with a ring of 7 glyph segments (`_gseg` 0..6, from the back of the
    wrist around); the Witness variant (cracked=True) has two segments dark for good."""
    K, o = g.K, g.o
    sd = opt_side(o, "L")
    g.bone = "forearm_" + sd
    w = 0.07 * K.k
    R = wrist_band(g, sd, 0.07, 0.0085, o.get("color", GUN), 0.6, along=-0.042, n=21, groove=3)
    dead = {2, 5} if o.get("cracked") else set()
    for i in range(7):
        th = 2 * math.pi * (i + 0.5) / 7
        M = ring_frame(R, th, t=0.0085 - 0.0006)
        tile = box(0.011 * K.k, w * 0.42, 0.0016, M=M)
        if i in dead:
            g.part(tile, "201c1a", 0.3)
        else:
            g.light(tile, seg=float(i))
    g.segs, g.idle = 7, float(o.get("idle", 0.15))


@gadget("chronolith_cuff_thin", "forearm_L")
def g_cuff_thin(g):
    """Mira's thin tarnished-silver echo of the band; a hairline ring lights (violet) after the reveal."""
    K, o = g.K, g.o
    sd = opt_side(o, "L")
    g.bone = "forearm_" + sd
    R = wrist_band(g, sd, 0.026, 0.0055, o.get("color", "8e9092"), 0.55, along=-0.03, n=18)
    rr = dict(R, r=R["r"] + 0.0055 + 0.0012)
    g.light(band_geo(rr, 0.0028, 0.0008, gap=0.0), smooth=True)
    g.idle = float(o.get("idle", 0.0))


def watch(g, sd, band_w, band_t, band_col, case, screen, case_col=GRAPH, gloss=0.5, along=-0.028, n=14):
    """A band with a case on the back of the wrist (case = (across, along, height)), screen glow inset."""
    K = g.K
    R = wrist_band(g, sd, band_w, band_t, band_col, 0.25, along=along, n=n)
    M = ring_frame(R, 0.0, t=band_t * 0.4)
    cw, cl, ch = case
    if cw > 0:
        g.part(box(cw, cl, ch, bev=min(0.003, ch * 0.4), M=M), case_col, gloss)
    if screen:
        sw, sl = screen
        g.light(box(sw, sl, 0.0008, M=local(M, 0, 0, ch - 0.0004)))
    return R, M


@gadget("wrist_device", "forearm_L")
def g_wrist_device(g):
    """2049 wrist screen: a slim band with a wide curved screen strip over the back of the wrist."""
    K, o = g.K, g.o
    sd = opt_side(o, "L")
    g.bone = "forearm_" + sd
    R = wrist_band(g, sd, 0.022, 0.0055, o.get("color", GRAPH), 0.45, along=-0.028, n=16)
    rr = dict(R, r=R["r"] + 0.0055)
    g.part(band_geo(rr, 0.03 * K.k, 0.0022, gap=0.0, a0=-1.1, a1=1.1, n=8), o.get("case", POLY), 0.7, smooth=True)
    rr2 = dict(R, r=R["r"] + 0.0055 + 0.0022)
    g.light(band_geo(rr2, 0.022 * K.k, 0.0006, gap=0.0, ch=0.0002, a0=-0.95, a1=0.95, n=8), smooth=True)
    g.idle = float(o.get("idle", 0.5))


@gadget("wrist_slate", "forearm_L")
def g_wrist_slate(g):
    """Rook's white-banded wrist slate: a flat glass slate on the back of the wrist (lights during calls)."""
    K, o = g.K, g.o
    sd = opt_side(o, "L")
    g.bone = "forearm_" + sd
    watch(g, sd, 0.03, 0.006, o.get("color", WHITE), (0.036 * K.k, 0.046 * K.k, 0.0075), (0.03 * K.k, 0.04 * K.k), case_col=o.get("case", "d8dadc"), along=-0.032)
    g.idle = float(o.get("idle", 0.15))


@gadget("smartwatch", "forearm_L")
def g_smartwatch(g):
    K, o = g.K, g.o
    sd = opt_side(o, "L")
    g.bone = "forearm_" + sd
    kid = K.B.H < 1.45
    watch(g, sd, 0.02 if not kid else 0.018, 0.005, o.get("color", BLACK), (0.036 * K.k, 0.042 * K.k, 0.0095), (0.03 * K.k, 0.035 * K.k),
          case_col=o.get("case", GRAPH), gloss=0.6)
    g.idle = float(o.get("idle", 0.25))


@gadget("fitness_band", "forearm_L")
def g_fitness(g):
    K, o = g.K, g.o
    sd = opt_side(o, "L")
    g.bone = "forearm_" + sd
    watch(g, sd, 0.017, 0.0065, o.get("color", BLACK), (0.016 * K.k, 0.034 * K.k, 0.0085), (0.009 * K.k, 0.026 * K.k), case_col=o.get("case", "1d1f22"), gloss=0.7)
    g.idle = float(o.get("idle", 0.2))


@gadget("kid_locator_band", "forearm_L")
def g_kid_band(g):
    """A soft chunky band with a glowing pebble (dims when the timeline forgets her)."""
    K, o = g.K, g.o
    sd = opt_side(o, "L")
    g.bone = "forearm_" + sd
    R = wrist_band(g, sd, 0.02, 0.006, o.get("color", "e8d36a"), 0.3, along=-0.02, n=12)
    M = ring_frame(R, 0.0, t=0.004)
    g.part(cyl(0.012, 0.004, n=10, bev=0.0015, M=M), o.get("case", "f2efe6"), 0.5, smooth="auto")
    g.light(lathe([(0.0085, 0.0), (0.0085, 0.0015), (0.006, 0.0035), (0.0, 0.0045)], n=8, M=local(M, 0, 0, 0.0038)), smooth=True)
    g.glow_hex = (o.get("glow") or "ffe066").lstrip("#")
    g.idle = float(o.get("idle", 0.6))


@gadget("forearm_tablet", "forearm_L")
def g_forearm_tablet(g):
    """Rugged slate strapped on the back of the forearm: orange bumper, glass screen (access codes)."""
    K, o = g.K, g.o
    sd = opt_side(o, "L")
    g.bone = "forearm_" + sd
    k = K.k
    for t in (0.42, 0.78):
        R = K.limb_ring(sd, "elbow_", "wrist_", t, n=14)
        g.part(band_geo(R, 0.016 * k, 0.003), BLACK, 0.2, smooth=True)
    R = K.limb_ring(sd, "elbow_", "wrist_", 0.6, n=14)
    M = ring_frame(R, 0.0, t=0.003)
    g.part(box(0.068 * k, 0.12 * k, 0.0105, bev=0.004, M=M), o.get("bumper", ORANGE), 0.3)
    g.part(box(0.058 * k, 0.106 * k, 0.0115, bev=0.0015, M=M), GRAPH, 0.6)
    g.light(box(0.05 * k, 0.088 * k, 0.0006, M=local(M, 0, 0.004 * k, 0.0115)))
    g.idle = float(o.get("idle", 0.4))


@gadget("wrist_scanner_scav", "forearm_R")
def g_scav_scanner(g):
    """Scavenged scanner in a padded sleeve on the forearm: cracked green screen (tracks survivors)."""
    K, o = g.K, g.o
    sd = opt_side(o, "R")
    g.bone = "forearm_" + sd
    k = K.k
    R = fitted_ring(K, sd, 0.0, 0.11 * k, n=16, t=0.62)
    g.part(band_geo(R, 0.11 * k, 0.005, groove=4, fit=True), o.get("sleeve", CANVAS), 0.05, smooth=True)
    M = ring_frame(R, 0.0, t=0.005)
    g.part(box(0.058 * k, 0.08 * k, 0.011, bev=0.003, M=M), o.get("color", OLIVE), 0.35)
    g.part(box(0.012 * k, 0.03 * k, 0.006, bev=0.002, M=local(M, 0.034 * k, -0.02 * k, 0)), STEEL, 0.6)
    scr = local(M, 0, 0.006 * k, 0.011)
    g.light(box(0.04 * k, 0.046 * k, 0.0006, M=scr))
    g.part(box(0.003, 0.05 * k, 0.0012, M=rot(local(scr, 0.004, 0, 0.0002), "Z", 0.6)), "1a1a18", 0.2)   # the crack
    g.glow_hex = (o.get("glow") or "b6ff8a").lstrip("#")
    g.idle = float(o.get("idle", 0.6))


@gadget("continuum_forearm_emitter", "forearm_R")
def g_cont_forearm(g):
    """Continuum bracer: white ceramic armour section with an emitter nozzle and a gold light strip
    (slate=True: the officer's command slate)."""
    K, o = g.K, g.o
    sd = opt_side(o, "R")
    g.bone = "forearm_" + sd
    k = K.k
    R = fitted_ring(K, sd, 0.0, 0.12 * k, n=18, t=0.55)
    g.part(band_geo(R, 0.12 * k, 0.0075, fit=True), o.get("color", "dfe1e3"), 0.75, smooth=True)
    M = ring_frame(R, 0.0, t=0.0075)
    if o.get("slate"):
        g.part(box(0.05 * k, 0.08 * k, 0.0045, bev=0.002, M=M), GRAPH, 0.7)
        g.light(box(0.042 * k, 0.068 * k, 0.0006, M=local(M, 0, 0, 0.0045)))
    else:
        g.part(box(0.04 * k, 0.07 * k, 0.0045, bev=0.002, M=M), GRAPH, 0.6)
        g.part(cyl(0.008, 0.012, n=10, bev=0.001, M=rot(local(M, 0, 0.035 * k, 0.004), "X", -math.pi / 2)), STEEL, 0.7, smooth="auto")
        g.light(box(0.006 * k, 0.06 * k, 0.0008, M=local(M, 0, -0.003 * k, 0.0045)))
    g.glow_hex = (o.get("glow") or "ffd27a").lstrip("#")
    g.idle = float(o.get("idle", 0.4))


def bangles(g, sd, count, w, t, col, along0, step, n=14, bone="forearm_"):
    for i in range(count):
        wrist_band(g, sd, w, t, col, 0.75, along=along0 - i * step, n=n, auto=False)


@gadget("bronze_bracelets", "forearm_L")
def g_bracelets(g):
    """Thin bronze bangles (two or three) on one or both wrists (sides='LR')."""
    K, o = g.K, g.o
    sides = o.get("sides", "LR")
    g.bone = "forearm_" + sides[0]
    cnt = int(o.get("count", 2))
    for sd in sides:
        sub = Gad(K, g.typ, "forearm_" + sd, o)
        bangles(sub, sd, cnt, 0.006, 0.0032, o.get("color", BRONZE), -0.012, 0.011, n=10)
        _merge(g.body, sub.body)


def _merge(dst, src):
    o = len(dst.v)
    dst.v += src.v
    dst.f += [[i + o for i in f] for f in src.f]
    dst.col += src.col
    dst.gl += src.gl
    dst.sm += src.sm
    dst.wt += src.wt
    dst.seg += src.seg


@gadget("bronze_armlet", "upperarm_R")
def g_armlet(g):
    """Bronze arm ring above the biceps: a broad band with two raised ridges."""
    K, o = g.K, g.o
    sd = opt_side(o, "R")
    g.bone = "upperarm_" + sd
    R = K.limb_ring(sd, "shoulder_", "elbow_", 0.42, n=12)
    col = o.get("color", BRONZE)
    g.part(band_geo(R, 0.026 * K.k, 0.0028), col, 0.75, smooth=True)
    for da in (-0.009, 0.009):
        g.part(band_geo(dict(R, r=R["r"] + 0.0026), 0.004 * K.k, 0.0018, gap=0.0, along=da * K.k), col, 0.85, smooth=True)


# ---------------- head pieces ----------------
def head_side(K, sd, dz=0.0, dy=0.0, fams=HEADH):
    """Outer surface point at the side of the head (over the hair) near the ear top, with the outward normal."""
    s = 1 if sd == "L" else -1
    e = K.ear[sd]
    tgt = V((e.x, e.y + dy, e.z + dz))
    h = K.toward(tgt, V((s, 0, 0)), fams, 0.25)
    return (h[0], h[1]) if h else (tgt, V((s, 0, 0)))


def face_point(K, x, z, dy=0.0, fams=HEAD):
    h = K.toward(V((x, K.eyec.y + dy, z)), V((0, -1, 0)), fams, 0.3)
    return (h[0], h[1]) if h else (V((x, K.eyec.y - 0.09, z)), V((0, -1, 0)))


@gadget("earpiece", "head")
def g_earpiece(g):
    """Comm earpiece in the ear: a graphite (or white) bud, a pin-point LED that blinks on calls."""
    K, o = g.K, g.o
    sd = opt_side(o, "L")
    s = 1 if sd == "L" else -1
    e = K.ear[sd]
    skin = K.toward(e, V((s, 0, 0)), HEAD, 0.2)
    outer = K.toward(e, V((s, 0, 0)), HEADH, 0.2)
    p = skin[0] if skin else e
    x_out = max(abs(p.x) + 0.009, (abs(outer[0].x) + 0.003) if outer else 0)
    M = frame(V((s * x_out, p.y - 0.004, p.z + 0.002)), V((s, 0, 0)), UP)
    depth = x_out - abs(p.x) + 0.004
    small = o.get("small", False)
    r = 0.0075 if not small else 0.006
    g.part(cyl(r, depth, n=12, bev=0.002, M=local(M, 0, 0, -depth + 0.002)), o.get("color", GRAPH), 0.6, smooth="auto")
    g.part(box(0.006, 0.014, 0.004, bev=0.0015, M=local(M, 0.004 * s * 0, -0.011, -0.003)), o.get("color", GRAPH), 0.5)
    g.light(cyl(0.0016, 0.0012, n=6, M=local(M, 0.0, 0.0028, 0.0018)))
    g.idle = float(o.get("idle", 0.0))


def arm_from_ear(g, sd, tip, col, w=0.004, t=0.003):
    """A slim arm from above the ear forward along the temple (over the hair) to `tip`."""
    K = g.K
    p0, n0 = head_side(g.K, sd, dz=0.02, dy=0.01)
    p0 = p0 + n0 * 0.002
    mid_tgt = V((p0.x, (p0.y + tip.y) / 2, (p0.z + tip.z) / 2))
    s = 1 if sd == "L" else -1
    hm = K.toward(mid_tgt, V((s, 0, 0)), HEADH, 0.25)
    pm = (hm[0] + hm[1] * 0.0025) if hm else mid_tgt
    pts = resample([p0, pm, tip], 6)
    g.part(tube(pts, w * 0.6, n=5), col, 0.6, smooth=True)
    return p0


def lens_frame(K, sd, fwd=0.024, dz=0.0, dx=0.0):
    s = 1 if sd == "L" else -1
    e = K.eye[sd]
    return frame(V((e.x + s * dx, e.y - fwd, e.z + dz)), V((0, -1, 0)), UP)


@gadget("ar_monocle", "head")
def g_monocle(g):
    """Smoked AR lens before the right eye on a slim arm from the right ear (lights cyan in Residue Vision)."""
    K, o = g.K, g.o
    sd = opt_side(o, "R")
    s = 1 if sd == "L" else -1
    M = lens_frame(K, sd, fwd=0.026, dz=0.002, dx=0.004)
    M = rot(M, "Y", s * 0.25)
    col = o.get("color", GRAPH)
    lw, lh = 0.036 * K.k, 0.026 * K.k
    rim, rt = 0.0032, 0.0046
    g.part(box(lw + 0.002, lh + 0.002, 0.0026, bev=0.001, M=M), col, 0.65)                     # lens seat
    for sy in (1, -1):                                                                          # raised bezel
        g.part(box(lw + 2 * rim, rim, rt, bev=0.0012, M=local(M, 0, sy * (lh + rim) / 2, 0)), col, 0.7)
    for sx in (1, -1):
        g.part(box(rim, lh, rt, bev=0.0012, M=local(M, sx * (lw + rim) / 2, 0, 0)), col, 0.7)
    g.part(box(0.009, 0.006, 0.006, bev=0.0018, M=local(M, s * (lw / 2 - 0.004), lh / 2 + rim + 0.002, 0.0)), GUN, 0.6)  # sensor pod
    g.part(cyl(0.0018, 0.0012, n=8, M=local(M, s * (lw / 2 - 0.004), lh / 2 + rim + 0.002, 0.006)), GLASS, 0.9, smooth="auto")
    g.light(box(lw, lh, 0.0006, M=local(M, 0, 0, 0.0027)))
    if o.get("cracked"):
        g.part(box(0.0012, lh * 0.9, 0.0004, M=rot(local(M, -0.004, 0, 0.0036), "Z", 0.5)), "2a2522", 0.2)
    tip = M @ V((s * (lw / 2 + 0.002), 0.004, 0.0015))
    p0 = arm_from_ear(g, sd, tip, col)
    g.part(box(0.009, 0.016, 0.007, bev=0.002, M=frame(p0, V((s, 0, 0)), V((0, -1, 0.3)))), col, 0.5)
    g.idle = float(o.get("idle", 0.0))


@gadget("ar_visor_clip", "head")
def g_visor_clip(g):
    """Clip-on AR visor: a small prism over the upper outer corner of the right eye on a bar from a temple pod."""
    K, o = g.K, g.o
    sd = opt_side(o, "R")
    s = 1 if sd == "L" else -1
    M = lens_frame(K, sd, fwd=0.024, dz=0.012, dx=0.012)
    col = o.get("color", GRAPH)
    g.light(box(0.02 * K.k, 0.012 * K.k, 0.004, bev=0.001, M=M))
    tip = M @ V((s * 0.012, 0.0, 0.002))
    p0 = arm_from_ear(g, sd, tip, col, w=0.005)
    g.part(box(0.01, 0.03, 0.009, bev=0.003, M=frame(p0 + V((0, -0.01, 0)), V((s, 0, 0)), V((0, -1, 0)))), col, 0.55)
    g.idle = float(o.get("idle", 0.5))


@gadget("ar_glasses", "head")
def g_ar_glasses(g):
    """AR glasses: thin frames (or rimless=True: lens edges only) with a HUD edge glow along the top of each lens."""
    K, o = g.K, g.o
    k = K.k
    col = o.get("color", "1e1f22")
    rimless = o.get("rimless", False)
    nseg = 12 if K.lod else 8
    lw, lh = 0.05 * k, 0.032 * k
    for sd in "LR":
        s = 1 if sd == "L" else -1
        M = rot(lens_frame(K, sd, fwd=0.023, dz=-0.002, dx=0.002), "Y", -s * 0.12)
        pts = []
        for i in range(nseg):
            t = 2 * math.pi * i / nseg
            x, y = math.cos(t), math.sin(t)
            sx = math.copysign(abs(x) ** 0.6, x) * lw / 2
            sy = math.copysign(abs(y) ** 0.75, y) * lh / 2
            pts.append(M @ V((sx, sy, 0)))
        if not rimless:
            g.part(tube(pts + [pts[0]], 0.0013, n=4, caps=False), col, 0.6, smooth=True)
        if o.get("plain"):
            if o.get("clip") and sd == "R":   # repaired glasses: a clip-on magnifier lens over the right eye
                g.part(cyl(lh * 0.42, 0.003, n=10, bev=0.0008, M=local(M, 0, 0.002, 0.005)), "2a2620", 0.4, smooth="auto")
                g.part(cyl(lh * 0.34, 0.0015, n=10, M=local(M, 0, 0.002, 0.0075)), GLASS, 0.95, smooth="auto")
            continue
        top = [M @ V((lw / 2 * f, lh / 2 + 0.0004, 0.0008)) for f in (-0.75, -0.25, 0.25, 0.75)]
        g.light(tube(top, 0.0008, n=4), seg=0.0, smooth=True)
    eL, eR = K.eye["L"], K.eye["R"]
    br = [V(((eL.x + eR.x) / 2 + dx, eL.y - 0.025, eL.z + 0.004)) for dx in (-0.007, 0.0, 0.007)]
    g.part(tube(br, 0.0014, n=4), col, 0.6, smooth=True)
    for sd in "LR":
        s = 1 if sd == "L" else -1
        tip = V((K.eye[sd].x + s * (lw / 2 + 0.004), K.eye[sd].y - 0.02, K.eye[sd].z + 0.006))
        arm_from_ear(g, sd, tip, col, w=0.0035)
    g.glow_hex = (o.get("glow") or g.glow_hex).lstrip("#")
    g.idle = float(o.get("idle", 0.45))


@gadget("glasses", "head")
def g_glasses(g):
    """Plain glasses (any modern era): the AR glasses frame without the HUD light; clip=True adds a clip-on magnifier."""
    g.o = dict(g.o, plain=True)
    g_ar_glasses(g)
    g.idle = 0.0


@gadget("ar_half_visor", "head")
def g_half_visor(g):
    """Tactical AR half-visor: a red-tinted bar across the brow from temple to temple with a scan line
    (`_gseg` = 0..1 across, for the sweep)."""
    K, o = g.K, g.o
    k = K.k
    c = K.eyec
    z = c.z + 0.008 * k
    pts_out, pts_n = [], []
    n = 11
    for i in range(n):
        a = -1.15 + 2.3 * i / (n - 1)
        d = V((math.sin(a), -math.cos(a), 0))
        h = K.toward(V((c.x, c.y + 0.03, z)), d, HEADH, 0.3)
        p = (h[0] if h else V((c.x, c.y + 0.03, z)) + d * 0.1)
        p = p + d * (0.022 if abs(a) < 0.7 else 0.01)
        pts_out.append(p)
        pts_n.append(d)
    P, N = _smooth_open(pts_out, pts_n)
    side = [V((0, 0, 1))] * len(P)
    g.part(ribbon(P, N, 0.03 * k, 0.003, side=side), o.get("color", "3a0c10"), 0.9, smooth=True)
    for e in (0, -1):
        g.part(box(0.012, 0.03 * k, 0.012, bev=0.003, M=frame(P[e], N[e], UP)), GRAPH, 0.5)
    for i in range(len(P)):
        pass
    gv, gf = ribbon(P[1:-1], N[1:-1], 0.003 * k, 0.0006, side=side[1:-1])
    g.light((_lift(gv, N[1:-1], 0.003), gf), smooth=True)
    _seg_u(g.glow, len(gv))
    g.seg_mode = "u"
    g.glow_hex = (o.get("glow") or "ff3b3b").lstrip("#")
    g.idle = float(o.get("idle", 0.6))


def _smooth_open(P, N):
    P = [V(p) for p in P]
    for _ in range(2):
        P = [P[0]] + [(P[i - 1] + P[i] * 2 + P[i + 1]) / 4 for i in range(1, len(P) - 1)] + [P[-1]]
    return P, [V(n) for n in N]


def _lift(verts, N, d):
    per = len(verts) // len(N)
    return [tuple(V(verts[i]) + N[i // per] * d) for i in range(len(verts))]


def _seg_u(geo, n_last):
    """`_gseg` = 0..1 along the last-added glow piece (by its x extent in the head frame)."""
    vs = np.array(geo.v[-n_last:])
    x = vs[:, 0]
    u = (x - x.min()) / max(np.ptp(x), 1e-6)
    geo.seg[-n_last:] = list(u)


@gadget("continuum_visor", "head")
def g_cont_visor(g):
    """The Continuum scan line: a thin gold bar across the helmet visor slit (or the officer's retracted visor
    eye-line), `_gseg` 0..1 across for the sweep; the helmet's own painted line is switched off."""
    K, o = g.K, g.o
    k = K.k
    c = K.eyec
    z = c.z
    P, N = [], []
    for i in range(9):
        a = -0.95 + 1.9 * i / 8
        d = V((math.sin(a), -math.cos(a), 0))
        h = K.toward(V((c.x, c.y + 0.03, z)), d, HEADH | {"torso"}, 0.3)
        p = h[0] if h else V((c.x, c.y + 0.03, z)) + d * 0.1
        on_face = h is not None and K.fsrc[h[2]].startswith("skin")
        P.append(p + d * (0.026 if on_face else 0.0012))
        N.append(d)
    P, N = _smooth_open(P, N)
    side = [V((0, 0, 1))] * len(P)
    gv, gf = ribbon(P, N, 0.0045 * k, 0.0008, side=side)
    g.light((gv, gf), smooth=True)
    _seg_u(g.glow, len(gv))
    g.seg_mode = "u"
    for h in K.cov["_costume"]["head"]:
        if h.get("kind") == "helmet":
            h["glow_level"] = 0.0
            if isinstance(h.get("src"), dict):
                h["src"]["glow_level"] = 0.0
    g.glow_hex = (o.get("glow") or "ffd27a").lstrip("#")
    g.idle = float(o.get("idle", 0.6))


def strap_round_head(K, z_front, z_back, fams=HEADH, lift=0.002, n=20):
    c = K.eyec + V((0, 0.085 * K.k, 0))
    P, N = [], []
    for i in range(n):
        th = 2 * math.pi * i / n
        d = V((math.sin(th), -math.cos(th), 0))
        z = z_back + (z_front - z_back) * (0.5 + 0.5 * math.cos(th))
        h = K.toward(V((c.x, c.y, z)), d, fams, 0.3)
        if h is None:
            continue
        P.append(h[0] + h[1] * lift)
        N.append(h[1])
    return _smooth_loop(P, N)


@gadget("goggles", "head")
def g_goggles(g):
    """Dust goggles (worn='eyes' | 'brow' | 'neck'): two cups with scratched amber lenses on an elastic strap."""
    K, o = g.K, g.o
    k = K.k
    worn = o.get("worn", "eyes")
    lens = o.get("lens", "b07a2a")
    col = o.get("color", "2a2824")
    if worn == "neck":
        g.bone = "chest"
        P, N = neck_loop(K, K.J["neck"].z - 0.03 * k, K.J["neck"].z + 0.03 * k, lift=0.012)
        strap(g, P, N, 0.022 * k, 0.003, "3a3a36", closed=True)
        i0 = int(np.argmin([p.y for p in P]))
        c, n = P[i0], N[i0]
        Mc = frame(c + n * 0.004 + V((0, 0, -0.012)), (n + V((0, 0, -0.5))).normalized(), UP)
        cups = [local(Mc, s * 0.034 * k, 0, 0) for s in (1, -1)]
    else:
        zf = K.eyec.z + (0.0 if worn == "eyes" else 0.055 * k)
        P, N = strap_round_head(K, zf, zf + 0.01 * k)
        strap(g, P, N, 0.02 * k, 0.003, "3a3a36", closed=True, soft=False)
        cups = []
        for sd in "LR":
            s = 1 if sd == "L" else -1
            if worn == "eyes":
                M = rot(lens_frame(K, sd, fwd=0.012, dx=0.002), "Y", -s * 0.18)
            else:
                p, n = face_point(K, K.eye[sd].x, zf, fams=HEADH)
                M = rot(frame(p, (n + V((0, 0, 0.4))).normalized(), UP), "Y", 0)
            cups.append(M)
    for M in cups:
        g.part(cyl(0.022 * k, 0.017, n=12 if K.lod else 10, bev=0.003, M=M, r2=0.02 * k), col, 0.3, smooth="auto")
        g.part(cyl(0.017 * k, 0.0015, n=12 if K.lod else 10, M=local(M, 0, 0, 0.017)), lens, 0.95, smooth="auto")
    a, b = cups
    pa, pb, za = a.translation, b.translation, a.col[2].xyz
    g.part(tube([pa + (pb - pa) * 0.25 + za * 0.012, pa + (pb - pa) * 0.75 + za * 0.012], 0.004, n=5), col, 0.3, smooth=True)


@gadget("magnifier_goggles", "head")
def g_magnifier(g):
    """Head-mounted magnifier: a headband, a brow housing and two lens tubes before the eyes, a green readout lens."""
    K, o = g.K, g.o
    k = K.k
    zf = K.eyec.z + 0.04 * k
    P, N = strap_round_head(K, zf, zf + 0.02 * k)
    strap(g, P, N, 0.024 * k, 0.004, "2a2824", closed=True, soft=False)
    p, n = face_point(K, 0.0, zf, fams=HEADH)
    M = frame(p + n * 0.003, n, UP)
    g.part(box(0.1 * k, 0.03 * k, 0.022, bev=0.005, M=M), o.get("color", OLIVE), 0.35)
    for sd in "LR":
        s = 1 if sd == "L" else -1
        Ml = lens_frame(K, sd, fwd=0.03)
        g.part(cyl(0.011 * k, 0.026, n=10, bev=0.002, M=local(Ml, 0, 0, -0.004)), BLACK, 0.5, smooth="auto")
        g.part(cyl(0.008 * k, 0.001, n=10, M=local(Ml, 0, 0, 0.022)), "6a8a7a", 0.95, smooth="auto")
        g.part(tube([Ml @ V((0, 0.01, 0.004)), M @ V((s * 0.03 * k, -0.008, 0.012))], 0.0025, n=4), STEEL, 0.6, smooth=True)
    g.light(cyl(0.006, 0.0012, n=8, M=local(M, 0.034 * k, 0.0, 0.022)))
    g.glow_hex = (o.get("glow") or "b6ff8a").lstrip("#")
    g.idle = float(o.get("idle", 0.5))


@gadget("respirator", "head")
def g_respirator(g):
    """Half-mask respirator: a contoured shell over nose and mouth (snout forward, rubber seal lip), two filter
    cartridges on the cheeks and an exhale valve (worn='face', or 'neck': hanging at the neck)."""
    K, o = g.K, g.o
    k = K.k
    worn = o.get("worn", "neck")
    col = o.get("color", "33352f")
    fcol = o.get("filter", "7a7862")
    mouth = BH.to_bl(K.B.L.mouth)
    if worn == "face":
        rows, cols, amax = 6, 9, 1.15
        z_hi, z_lo = mouth.z + 0.045 * k, mouth.z - 0.05 * k
        zc = mouth.z - 0.004 * k
        grid, dirs = [], []
        for i in range(rows):
            v = i / (rows - 1)
            z = z_hi + (z_lo - z_hi) * v
            row, drow = [], []
            for j in range(cols):
                u = -1 + 2 * j / (cols - 1)
                a = u * amax * (0.8 + 0.2 * math.sin(math.pi * v))      # narrower over the nose bridge and chin
                d = V((math.sin(a), -math.cos(a), 0))
                cen = V((0, K.eyec.y + 0.04, z))
                h = K.toward(cen, d, HEAD, 0.3)
                bulge = max(0.0, 1 - u * u) * max(0.0, 1 - ((z - zc) / (0.055 * k)) ** 2)
                row.append((h[0] if h else cen + d * 0.09) + d * (0.006 + 0.02 * bulge))
                drow.append(d)
            grid.append(row)
            dirs.append(drow)
        verts = [tuple(p) for r in grid for p in r]
        quads = [[i * cols + j, i * cols + j + 1, (i + 1) * cols + j + 1, (i + 1) * cols + j] for i in range(rows - 1) for j in range(cols - 1)]
        nv = len(verts)
        verts += [tuple(V(verts[i * cols + j]) - dirs[i][j] * 0.004) for i in range(rows) for j in range(cols)]
        faces = quads + [[nv + f[3], nv + f[2], nv + f[1], nv + f[0]] for f in quads]
        ring = [(0, j) for j in range(cols)] + [(i, cols - 1) for i in range(1, rows)] + [(rows - 1, j) for j in range(cols - 2, -1, -1)] + [(i, 0) for i in range(rows - 2, 0, -1)]
        for q in range(len(ring)):
            a_, b_ = ring[q], ring[(q + 1) % len(ring)]
            ia, ib = a_[0] * cols + a_[1], b_[0] * cols + b_[1]
            faces.append([ia, ib, nv + ib, nv + ia])
        g.part((verts, faces), col, 0.35, smooth=True)
        seal = [V(verts[r[0] * cols + r[1]]) - dirs[r[0]][r[1]] * 0.002 for r in ring]      # rubber seal lip
        g.part(tube(seal + [seal[0]], 0.0028, n=3, caps=False), BLACK, 0.2, smooth=True)
        ci = rows // 2
        cm = V(grid[ci][cols // 2])
        base = frame(cm, V((0, -1, -0.2)).normalized(), UP)
        for jj in (1, cols - 2):                          # filter cartridges on the cheeks
            d = dirs[ci][jj]
            fwd = (d + V((0, -0.6, -0.25))).normalized()
            Mc = frame(V(grid[ci][jj]) - d * 0.004, fwd, UP)
            g.part(cyl(0.02 * k, 0.018, n=10, bev=0.003, M=Mc), fcol, 0.25, smooth="auto")
            g.part(cyl(0.021 * k, 0.004, n=10, M=local(Mc, 0, 0, 0.004)), BLACK, 0.3, smooth="auto")
            g.part(cyl(0.012 * k, 0.0015, n=10, M=local(Mc, 0, 0, 0.018)), GRAPH, 0.3, smooth="auto")
        g.part(cyl(0.013 * k, 0.01, n=10, bev=0.002, M=local(base, 0, -0.012 * k, -0.002)), GRAPH, 0.45, smooth="auto")   # exhale valve
        g.part(box(0.016 * k, 0.003, 0.0016, M=local(base, 0, -0.012 * k, 0.008)), BLACK, 0.2)
        P, N = strap_round_head(K, mouth.z, mouth.z + 0.05 * k)
        strap(g, [p for p in P if p.y > K.eyec.y - 0.02], [n for p, n in zip(P, N) if p.y > K.eyec.y - 0.02], 0.014 * k, 0.003, "2a2a26", soft=False)
        return
    g.bone = "chest"
    nz = K.J["neck"].z
    p, n = K.patch(V((0, K.J["neck"].y, nz - 0.02 * k)), V((0, -1, -0.15)), TORSO | {"neck", "head"}, 0.01)
    base = frame(p + n * 0.012, (n + V((0, 0, -0.7))).normalized(), UP)
    g.part(lathe([(0.0, 0.0), (0.034 * k, 0.0), (0.04 * k, 0.012), (0.028 * k, 0.03), (0.0, 0.034)], n=10, M=base), col, 0.35, smooth=True)
    P, N = neck_loop(K, nz - 0.02 * k, nz + 0.03 * k, lift=0.01)
    strap(g, P, N, 0.012 * k, 0.003, "2a2a26", closed=True)
    for s_ in (1, -1):
        Mc = rot(local(base, s_ * 0.034 * k, -0.01 * k, 0.012), "Y", s_ * 0.7)
        g.part(cyl(0.017 * k, 0.02, n=10, bev=0.003, M=Mc), fcol, 0.3, smooth="auto")
        g.part(cyl(0.011 * k, 0.0015, n=10, M=local(Mc, 0, 0, 0.02)), BLACK, 0.2, smooth="auto")
    g.part(cyl(0.012 * k, 0.012, n=10, bev=0.002, M=local(base, 0, -0.018 * k, 0.018)), GRAPH, 0.4, smooth="auto")


@gadget("headset_neck", "chest")
def g_headset(g):
    """Ear-defender headset around the neck with a boom mic (worn='head': cups over the ears)."""
    K, o = g.K, g.o
    k = K.k
    col = o.get("color", "2a2e33")
    worn = o.get("worn", "neck")
    cups = {}
    if worn == "head":
        g.bone = "head"
        for sd in "LR":
            s = 1 if sd == "L" else -1
            p, n = head_side(K, sd, dz=-0.004, dy=0.0)
            cups[sd] = frame(p + n * 0.002, V((s, 0, 0)), UP)
        top = K.toward(K.eyec + V((0, 0.03, 0.06)), V((0, 0, 1)), HEADH, 0.3)
        tz = top[0].z + 0.008 if top else K.eyec.z + 0.14
        arc = [cups["R"] @ V((0, 0.02, 0.01))] + [V((math.sin(a) * (abs(cups["L"][0][3]) + 0.006), K.eyec.y + 0.03, K.eyec.z + 0.03 + (tz - K.eyec.z - 0.03) * math.cos(a))) for a in np.linspace(-1.2, 1.2, 9)] + [cups["L"] @ V((0, 0.02, 0.01))]
        g.part(tube(arc, 0.005, n=5), col, 0.4, smooth=True)
    else:
        nz = K.J["neck"].z
        for sd in "LR":
            s = 1 if sd == "L" else -1
            tgt = V((K.J["neck"].x, K.J["neck"].y - 0.005, nz + 0.005 * k))
            h = K.toward(tgt, V((s, -0.25, 0)), TORSO | {"neck"}, 0.25)
            p = (h[0] if h else tgt + V((s * 0.06, 0, 0)))
            cups[sd] = frame(p + V((s, -0.2, 0)).normalized() * 0.016, V((s, -0.25, -0.35)).normalized(), V((0, -1, 0.6)))
        back = K.toward(V((0, K.J["neck"].y, nz + 0.02 * k)), V((0, 1, 0)), TORSO | {"neck", "hair"}, 0.25)
        bp = (back[0] + V((0, 0.02, 0))) if back else K.J["neck"] + V((0, 0.08, 0))
        arc = resample([cups["R"] @ V((0, 0.01, -0.006)), V((-0.05 * k, bp.y - 0.02, bp.z - 0.005)), bp, V((0.05 * k, bp.y - 0.02, bp.z - 0.005)), cups["L"] @ V((0, 0.01, -0.006))], 9)
        g.part(tube(arc, 0.0055, n=5), col, 0.4, smooth=True)
    for sd, M in cups.items():
        g.part(cyl(0.036 * k, 0.026, n=12 if K.lod else 10, bev=0.006, M=local(M, 0, 0, -0.008), r2=0.032 * k), o.get("cup", col), 0.35, smooth="auto")
    ML = cups["L"]
    boom = [ML @ V((0.0, -0.01, 0.012)), ML @ V((0.0, -0.05, 0.02)), ML @ V((0.0, -0.08, 0.012))]
    g.part(tube(boom, 0.0022, n=4), GRAPH, 0.5, smooth=True)
    g.part(cyl(0.006, 0.012, n=8, bev=0.002, M=frame(boom[-1], (boom[-1] - boom[-2]).normalized(), UP)), BLACK, 0.2, smooth="auto")
    g.light(cyl(0.0022, 0.001, n=6, M=local(ML, 0.0, 0.012, 0.0185)))
    g.idle = float(o.get("idle", 0.3))


@gadget("earbuds", "head")
def g_earbuds(g):
    """Earbuds: 2049 dark buds with a status dot; 2026 (or stem=True) white buds with a short stem."""
    K, o = g.K, g.o
    stem = o.get("stem", K.era == "2026")
    col = o.get("color", WHITE if stem else GRAPH)
    for sd in o.get("sides", "LR"):
        s = 1 if sd == "L" else -1
        e = K.ear[sd]
        skin = K.toward(e, V((s, 0, 0)), HEAD, 0.2)
        p = skin[0] if skin else e
        M = frame(V((p.x + s * 0.004, p.y - 0.004, p.z)), V((s, 0, 0)), UP)
        g.part(lathe([(0.0, -0.004), (0.0065, -0.003), (0.0072, 0.003), (0.0045, 0.007), (0.0, 0.0075)], n=8, M=M), col, 0.7, smooth=True)
        if stem:
            g.part(tube([M @ V((0, -0.002, 0.003)), M @ V((0, -0.022, 0.004))], 0.0028, n=5), col, 0.7, smooth=True)
        else:
            g.light(cyl(0.0015, 0.001, n=6, M=local(M, 0, 0.0015, 0.0072)))
    g.idle = float(o.get("idle", 0.4))


@gadget("cap_headlamp", "head")
def g_headlamp(g):
    """A warm lamp on the front of the cap (or on a headband when there is no cap); the lens lights in the dark."""
    K, o = g.K, g.o
    k = K.k
    z = K.eyec.z + 0.062 * k
    p, n = face_point(K, 0.0, z, dy=0.0, fams=HEADH)
    if not any(h.get("kind") in ("cap", "peaked", "beanie", "helmet") for h in K.cov["_costume"]["head"]):
        P, N = strap_round_head(K, z, z + 0.015 * k)
        strap(g, P, N, 0.022 * k, 0.003, "2a2a2a", closed=True, soft=False)
        p = p + n * 0.003
    M = frame(p + n * 0.002, (n + V((0, 0, 0.25))).normalized(), UP)
    g.part(box(0.04 * k, 0.026 * k, 0.016, bev=0.004, M=M), o.get("color", GRAPH), 0.45)
    g.part(cyl(0.011 * k, 0.006, n=12, bev=0.0015, M=local(M, 0, 0, 0.015)), STEEL, 0.7, smooth="auto")
    g.light(cyl(0.0085 * k, 0.001, n=12, M=local(M, 0, 0, 0.021)))
    g.glow_hex = (o.get("glow") or "ffe2b0").lstrip("#")
    g.idle = float(o.get("idle", 0.0))


# ---------------- chest and shoulders ----------------
def strap_x(K, z, s, back=False):
    """x of the harness / sling strap crossing the front (or back) at height z on side s (None: no strap there)."""
    xs = []
    for i in range(40):
        x = s * (0.015 + 0.004 * i) * K.k
        yc = -float(BH.costume.zc_at(K.B, z)) if hasattr(BH, "costume") else 0.0
        h = K.ray(V((x, yc + (0.5 if back else -0.5), z)), V((0, -1 if back else 1, 0)), TORSO, 1.0)
        if h is not None and K.fsrc[h[2]].startswith("strap_"):
            xs.append(x)
    return sum(xs) / len(xs) if xs else None


@gadget("shoulder_lamp", "chest")
def g_shoulder_lamp(g):
    """Compact hex lamp on the harness strap high on the left shoulder (cool-white cone in dark areas)."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "L")
    s = 1 if sd == "L" else -1
    z = K.J["chest"].z + 0.125 * k
    x = strap_x(K, z, s) or s * 0.105 * k
    p, n = K.front(x, z)
    M = frame(p - n * 0.002, (n + V((0, 0, 0.15))).normalized(), UP)
    col = o.get("color", GUN)
    g.part(box(0.036 * k, 0.03 * k, 0.006, bev=0.002, M=M), BLACK, 0.3)
    hexm = rot(local(M, 0, 0, 0.005), "Z", math.pi / 6)
    g.part(cyl(0.022 * k, 0.016, n=6, bev=0.003, M=hexm), col, 0.6, smooth=False)
    g.light(cyl(0.015 * k, 0.0012, n=12, M=local(M, 0, 0, 0.021)))
    g.part(cyl(0.0175 * k, 0.0016, n=12, M=local(M, 0, 0, 0.0205)), GRAPH, 0.6, smooth="auto")
    g.glow_hex = (o.get("glow") or "e8f4ff").lstrip("#")
    g.idle = float(o.get("idle", 0.0))


@gadget("echo_emitter", "chest")
def g_echo(g):
    """Echo Step emitter: a flat 12 cm hexagonal module between the shoulder blades with two vents (`_gseg` 0 / 1);
    scorched=True: the Witness's burnt version."""
    K, o = g.K, g.o
    k = K.k
    z = K.J["chest"].z + 0.075 * k
    for _ in range(8):
        h = K.toward(V((0, 0, z)), V((0, 1, 0)), TORSO)
        if h is None or not K.fsrc[h[2]].startswith(("hood_roll", "collar")):
            break
        z -= 0.012 * k
    p, n = K.front(0.0, z, back=True, r=0.03)
    M = frame(p - n * 0.003, n, UP)
    col = o.get("color", "2a2e34" if not o.get("scorched") else "2a2522")
    g.part(box(0.07 * k, 0.09 * k, 0.005, bev=0.002, M=M), BLACK, 0.3)
    hexm = local(M, 0, 0, 0.004)
    g.part(cyl(0.06 * k, 0.016, n=6, bev=0.004, M=hexm, r2=0.054 * k), col, 0.55, smooth=False)
    g.part(cyl(0.032 * k, 0.003, n=6, bev=0.001, M=local(hexm, 0, 0, 0.016)), GUN, 0.7)
    for i, s in enumerate((1, -1)):
        vm = local(hexm, s * 0.03 * k, 0, 0.0155)
        g.part(box(0.011 * k, 0.05 * k, 0.0025, bev=0.001, M=vm), BLACK, 0.4)
        g.light(box(0.0065 * k, 0.042 * k, 0.0006, M=local(vm, 0, 0, 0.0024)), seg=float(i))
    if o.get("scorched"):
        g.part(box(0.05 * k, 0.012, 0.0008, M=rot(local(hexm, -0.01, 0.02, 0.019), "Z", 0.7)), "171310", 0.1)
    g.segs = 2
    g.idle = float(o.get("idle", 0.0))


def pouch(g, M, w, h, d, col, flap=True, gloss=0.1):
    g.part(box(w, h, d, bev=min(0.008, d * 0.35), M=M, taper=0.08), col, gloss)
    if flap:
        g.part(box(w * 1.04, h * 0.36, 0.004, bev=0.0015, M=local(M, 0, h * 0.34, d - 0.002)), col, gloss + 0.05)
        g.part(box(0.014, 0.01, 0.003, bev=0.001, M=local(M, 0, h * 0.2, d + 0.0015)), BLACK, 0.4)


@gadget("harness_pouches", "hips")
def g_pouches(g):
    """Two low-profile pouches at the back hips (kidney position, clear of the arm swing)."""
    K, o = g.K, g.o
    k = K.k
    col = o.get("color", _wear_color(K, ("chest_harness",), "2e3238"))
    for s in (1, -1):
        p, n = K.front(s * 0.075 * k, K.belt_z - 0.035 * k, back=True, r=0.02)
        M = frame(p - n * 0.006, n, UP)
        pouch(g, M, 0.085 * k, 0.075 * k, 0.03, col)


@gadget("chest_slate_pocket", "chest")
def g_slate_pocket(g):
    """Slim slate pocket on the left chest with a top flap."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "L")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.085 * k, K.J["chest"].z + 0.04 * k, r=0.02)
    M = frame(p - n * 0.003, n, UP)
    col = o.get("color", _wear_color(K, ("chest_harness",), "2e3238"))
    g.part(box(0.07 * k, 0.1 * k, 0.011, bev=0.003, M=M), col, 0.15)
    g.part(box(0.072 * k, 0.026 * k, 0.003, bev=0.001, M=local(M, 0, 0.04 * k, 0.011)), col, 0.2)
    g.part(box(0.05 * k, 0.012 * k, 0.0035, bev=0.001, M=local(M, 0, 0.052 * k, 0.009)), GRAPH, 0.6)
    g.part(box(0.056 * k, 0.012 * k, 0.0075, bev=0.0015, M=local(M, 0, 0.056 * k, 0.002)), BLACK, 0.8)     # the slate
    g.part(box(0.046 * k, 0.03 * k, 0.0012, bev=0.0005, M=local(M, 0, -0.018 * k, 0.011)), BLACK, 0.05)   # grip patch


def _wear_color(K, names, d):
    for w in K.c.get("wear", []):
        nm = w if isinstance(w, str) else w[0]
        if nm in names and not isinstance(w, str) and w[1]:
            return w[1]
    return d


@gadget("recorder_spool", "chest")
def g_spool(g):
    """The Witness's recorder spool clipped on the left chest (a red-orange ring while it records)."""
    K, o = g.K, g.o
    k = K.k
    p, n = K.front(0.09 * k, K.J["chest"].z + 0.085 * k, r=0.012)
    M = frame(p - n * 0.002, n, UP)
    g.part(box(0.02 * k, 0.05 * k, 0.004, bev=0.0012, M=local(M, 0, 0.012 * k, 0)), STEEL, 0.6)
    g.part(cyl(0.017 * k, 0.012, n=12, bev=0.002, M=local(M, 0, 0, 0.003)), o.get("color", GRAPH), 0.5, smooth="auto")
    g.part(cyl(0.007 * k, 0.003, n=8, M=local(M, 0, 0, 0.015)), STEEL, 0.7, smooth="auto")
    g.light(torus(0.0125 * k, 0.0012, n=14, m=4, M=local(M, 0, 0, 0.0152)), smooth=True)
    g.idle = float(o.get("idle", 0.25))


@gadget("gorget_resonance", "chest")
def g_gorget(g):
    """Violet light lines etched into Mira's collar plate: three arcs on the outer surface of whatever is at the
    front of the neck (the gorget), weighted like the plate."""
    K, o = g.K, g.o
    k = K.k
    nz = K.J["neck"].z
    fams = TORSO | {"neck", "head"}
    for li, dz in enumerate((-0.004, 0.012, 0.026)):
        P, N = [], []
        span = 1.0 - 0.15 * li
        for i in range(9):
            a = -span + 2 * span * i / 8
            d = V((math.sin(a), -math.cos(a), -0.15)).normalized()
            h = K.toward(V((K.J["neck"].x, K.J["neck"].y + 0.005, nz + dz * k)), d, fams, 0.25)
            if h is None or K.fsrc[h[2]].startswith("skin"):
                continue
            P.append(h[0] + h[1] * 0.0009)
            N.append(h[1])
        if len(P) >= 3:
            P, N = _smooth_open(P, N)
            gv, gf = ribbon(P, N, 0.0022 * k, 0.0006)
            g.light((gv, gf), seg=float(li), smooth=True, wt="soft")
    g.segs = 3
    g.glow_hex = (o.get("glow") or "9a7bff").lstrip("#")
    g.idle = float(o.get("idle", 0.3))


@gadget("id_badge", "chest")
def g_badge(g):
    """Staff ID card: on a lanyard (default) or held magnetically on the coat pocket (mount='clip', Rook's
    gold-edged director badge: edge='gold'). A small chip light shows its access tier."""
    K, o = g.K, g.o
    k = K.k
    mount = o.get("mount", "lanyard")
    header = o.get("header", "38c8c0")
    if mount == "clip":
        p, n = K.front(0.095 * k, K.J["chest"].z + 0.02 * k, r=0.012)
        M = frame(p + n * 0.0005, n, UP)
    else:
        nz = K.J["neck"].z
        P, N = neck_loop(K, K.J["chest"].z + 0.06 * k, nz + 0.02 * k, lift=0.004)
        i0 = int(np.argmin([p.y for p in P]))
        P = P[i0 + 1:] + P[:i0]
        N = N[i0 + 1:] + N[:i0]
        pc, nc = K.front(0.0, K.J["chest"].z + 0.03 * k, r=0.02)
        M = frame(pc + nc * 0.004, (nc + V((0, 0, 0.1))).normalized(), UP)
        top = M @ V((0, 0.045 * k, 0.001))
        P = [top + V((-0.006, 0, 0.012))] + P + [top + V((0.006, 0, 0.012))]
        N = [nc] + N + [nc]
        strap(g, resample(P, 26), [N[min(int(i * len(N) / 26), len(N) - 1)] for i in range(26)], 0.011 * k, 0.0012, o.get("lanyard", "1d2a44"), gloss=0.2)
        g.part(box(0.012, 0.012, 0.004, bev=0.0012, M=local(M, 0, 0.047 * k, 0.0)), STEEL, 0.6)
    edge = o.get("edge")
    if edge == "gold":
        g.part(box(0.058 * k, 0.09 * k, 0.0022, bev=0.0008, M=M), GOLD, 0.85)
    g.part(box(0.054 * k, 0.086 * k, 0.003, bev=0.001, M=M), o.get("card", "eceeef"), 0.5)
    g.part(box(0.054 * k, 0.018 * k, 0.0008, M=local(M, 0, 0.032 * k, 0.003)), header, 0.4)
    g.part(box(0.024 * k, 0.028 * k, 0.0006, M=local(M, -0.01 * k, 0.004 * k, 0.003)), "8a8f96", 0.2)
    g.light(box(0.008 * k, 0.006 * k, 0.0008, M=local(M, 0.015 * k, -0.03 * k, 0.003)))
    g.glow_hex = (o.get("glow") or header).lstrip("#")
    g.idle = float(o.get("idle", 0.25))


@gadget("keycard_reel", "hips")
def g_reel(g):
    """Retractable reel at the front-left of the belt with a keycard on its cord."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "L")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.09 * k, K.belt_z, r=0.012)
    M = frame(p - n * 0.001, n, UP)
    g.part(box(0.016, 0.03, 0.004, bev=0.001, M=local(M, 0, 0.006, 0)), BLACK, 0.4)
    g.part(cyl(0.017 * k, 0.011, n=12, bev=0.002, M=local(M, 0, 0, 0.003)), o.get("color", GRAPH), 0.55, smooth="auto")
    cm = local(M, 0, -0.085 * k, 0.012)
    g.part(tube([M @ V((0, -0.016 * k, 0.009)), cm @ V((0, 0.045 * k, 0))], 0.0011, n=4), BLACK, 0.3, smooth=True)
    g.part(box(0.054 * k, 0.086 * k, 0.0025, bev=0.0008, M=cm), o.get("card", "eceeef"), 0.5)
    g.part(box(0.054 * k, 0.016 * k, 0.0006, M=local(cm, 0, 0.034 * k, 0.0025)), o.get("header", "38c8c0"), 0.4)
    g.light(box(0.007 * k, 0.006 * k, 0.0008, M=local(cm, 0.016 * k, -0.03 * k, 0.0025)))
    g.glow_hex = (o.get("glow") or o.get("header", "38c8c0")).lstrip("#")
    g.idle = float(o.get("idle", 0.2))


@gadget("shoulder_radio", "chest")
def g_radio(g):
    """Shoulder radio with a status LED (steady on patrol, pulsing when alerted) and a stub antenna."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "R")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.115 * k, K.J["chest"].z + 0.11 * k, r=0.012)
    M = frame(p - n * 0.002, (n + V((0, 0, 0.2))).normalized(), UP)
    col = o.get("color", BLACK)
    g.part(box(0.042 * k, 0.07 * k, 0.022, bev=0.005, M=M), col, 0.35)
    g.part(box(0.03 * k, 0.03 * k, 0.003, bev=0.001, M=local(M, 0, -0.01 * k, 0.022)), "2c2f33", 0.2)
    g.part(cyl(0.004, 0.035 * k, n=6, M=rot(local(M, s * 0.012 * k, 0.034 * k, 0.012), "X", -math.pi / 2)), RUBBER, 0.3, smooth="auto")
    g.light(cyl(0.0032, 0.0015, n=8, M=local(M, -s * 0.012 * k, 0.026 * k, 0.022)))
    g.idle = float(o.get("idle", 0.8))


@gadget("body_cam", "chest")
def g_bodycam(g):
    """Chest body cam: a dark block with a lens and a red recording dot."""
    K, o = g.K, g.o
    k = K.k
    p, n = K.front(-0.03 * k, K.J["chest"].z + 0.06 * k, r=0.012)
    M = frame(p - n * 0.002, n, UP)
    g.part(box(0.05 * k, 0.066 * k, 0.022, bev=0.005, M=M), o.get("color", BLACK), 0.35)
    g.part(cyl(0.012 * k, 0.006, n=12, bev=0.0015, M=local(M, 0, 0.008 * k, 0.021)), GRAPH, 0.6, smooth="auto")
    g.part(cyl(0.008 * k, 0.001, n=12, M=local(M, 0, 0.008 * k, 0.027)), GLASS, 0.95, smooth="auto")
    g.light(cyl(0.0028, 0.0012, n=8, M=local(M, 0.015 * k, -0.022 * k, 0.022)))
    g.glow_hex = (o.get("glow") or "ff2a2a").lstrip("#")
    g.idle = float(o.get("idle", 1.0))


@gadget("vest_flashlight", "chest")
def g_flashlight(g):
    """Flashlight clipped on the left shoulder of the vest pointing forward (its cone is the guard's vision)."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "L")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.11 * k, K.J["chest"].z + 0.115 * k, r=0.012)
    M = frame(p - n * 0.002, n, UP)
    g.part(box(0.022 * k, 0.05 * k, 0.012, bev=0.003, M=M), BLACK, 0.3)
    tm = frame(M.translation + M.col[2].xyz * 0.024, V((0, -1, 0.05)).normalized(), UP)
    tm = local(tm, 0, 0, -0.045)
    g.part(cyl(0.013 * k, 0.07, n=10, bev=0.002, M=tm), o.get("color", GRAPH), 0.55, smooth="auto")
    g.part(cyl(0.0175 * k, 0.022, n=12, bev=0.002, M=local(tm, 0, 0, 0.065)), o.get("color", GRAPH), 0.55, smooth="auto")
    g.light(cyl(0.014 * k, 0.001, n=12, M=local(tm, 0, 0, 0.0875)))
    g.glow_hex = (o.get("glow") or "eef4ff").lstrip("#")
    g.idle = float(o.get("idle", 0.3))


@gadget("pen_light", "chest")
def g_penlight(g):
    K, o = g.K, g.o
    k = K.k
    p, n = K.front(0.075 * k, K.J["chest"].z + 0.06 * k, r=0.01)
    M = frame(p + n * 0.004, n, UP)
    g.part(cyl(0.0055, 0.12 * k, n=8, bev=0.001, M=rot(local(M, 0, -0.06 * k, 0.0), "X", -math.pi / 2)), o.get("color", STEEL), 0.75, smooth="auto")
    g.part(box(0.004, 0.035 * k, 0.003, M=local(M, 0, 0.035 * k, 0.005)), STEEL, 0.75)
    g.light(cyl(0.0042, 0.001, n=8, M=rot(local(M, 0, 0.061 * k, 0.0), "X", -math.pi / 2)))
    g.glow_hex = (o.get("glow") or "f2f6ff").lstrip("#")
    g.idle = float(o.get("idle", 0.0))


@gadget("transit_tablet", "chest")
def g_transit_tablet(g):
    """Transit tablet clipped on the right chest (hand=True: held in the left hand) showing the schedule."""
    K, o = g.K, g.o
    k = K.k
    if o.get("hand"):
        return _hand_slate(g, "L", (0.1 * k, 0.15 * k, 0.011), o.get("color", "2a2e33"), bumper=o.get("bumper", YELLOW))
    p, n = K.front(-0.075 * k, K.J["chest"].z + 0.02 * k, r=0.025)
    M = frame(p - n * 0.003, n, UP)
    g.part(box(0.03 * k, 0.03 * k, 0.006, bev=0.002, M=local(M, 0, 0.06 * k, 0)), BLACK, 0.4)
    M = rot(local(M, 0, 0, 0.004), "X", 0.12)
    g.part(box(0.1 * k, 0.14 * k, 0.01, bev=0.004, M=M), o.get("bumper", YELLOW), 0.3)
    g.part(box(0.09 * k, 0.128 * k, 0.011, bev=0.0015, M=M), GRAPH, 0.6)
    g.light(box(0.08 * k, 0.112 * k, 0.0006, M=local(M, 0, 0.002, 0.011)))
    g.glow_hex = (o.get("glow") or "ffe9a8").lstrip("#")
    g.idle = float(o.get("idle", 0.5))


@gadget("rugged_slate", "chest")
def g_rugged_slate(g):
    """Ruggedised slate on a chest strap (dam controls): a landscape slate with a bumper, neck straps."""
    K, o = g.K, g.o
    k = K.k
    if o.get("hand"):
        return _hand_slate(g, opt_side(o, "R"), (0.09 * k, 0.15 * k, 0.014), o.get("color", "2a2e33"), bumper=o.get("bumper", "3a3f46"))
    pc, nc = K.front(0.0, K.J["chest"].z - 0.01 * k, r=0.03)
    M = frame(pc + nc * 0.004, (nc + V((0, 0, 0.25))).normalized(), UP)
    bw, bh = 0.17 * k, 0.11 * k
    g.part(box(bw, bh, 0.016, bev=0.006, M=M), o.get("bumper", "3a3f46"), 0.3)
    g.part(box(bw - 0.014, bh - 0.014, 0.017, bev=0.002, M=M), GRAPH, 0.6)
    g.light(box(bw - 0.026, bh - 0.026, 0.0006, M=local(M, 0, 0, 0.017)))
    for s in (1, -1):
        a = M @ V((s * (bw / 2 - 0.01), bh / 2, 0.004))
        sh = K.J["shoulder_" + ("L" if s > 0 else "R")]
        guide = [a, V((s * 0.09 * k, a.y - 0.01, (a.z + sh.z) / 2 + 0.02)), V((s * 0.075 * k, K.J["neck"].y, sh.z + 0.05 * k)),
                 V((s * 0.05 * k, K.J["neck"].y + 0.08, sh.z + 0.01))]
        P, N = surf_path(K, guide, TORSO | {"neck"}, lift=0.004)
        if len(P) >= 2:
            strap(g, resample(P, 10), [N[min(i * len(N) // 10, len(N) - 1)] for i in range(10)], 0.02 * k, 0.002, "2a2a2a")
    g.glow_hex = (o.get("glow") or "bfe8ff").lstrip("#")
    g.idle = float(o.get("idle", 0.45))


@gadget("radio_chest_rig", "chest")
def g_radio_rig(g):
    """Repaired radio on a chest rig (rig=False: just the radio clipped on the chest plate), green blink."""
    K, o = g.K, g.o
    k = K.k
    if o.get("rig", True):
        pc, nc = K.front(0.0, K.J["chest"].z - 0.03 * k, r=0.03)
        M0 = frame(pc - nc * 0.004, nc, UP)
        g.part(box(0.22 * k, 0.13 * k, 0.02, bev=0.006, M=M0), o.get("rigColor", OLIVE), 0.1)
        for s in (1, -1):
            pouch(g, local(M0, s * 0.07 * k, -0.005, 0.018), 0.06 * k, 0.07 * k, 0.022, o.get("rigColor", OLIVE))
            a = M0 @ V((s * 0.09 * k, 0.06 * k, 0.01))
            sh = K.J["shoulder_" + ("L" if s > 0 else "R")]
            guide = [a, V((s * 0.1 * k, a.y, (a.z + sh.z) / 2 + 0.03)), V((s * 0.09 * k, K.J["neck"].y, sh.z + 0.05 * k)),
                     V((s * 0.07 * k, K.J["neck"].y + 0.1, sh.z - 0.03)), V((-s * 0.02, K.J["chest"].y + 0.14, K.J["chest"].z - 0.02))]
            P, N = surf_path(K, guide, lift=0.004)
            if len(P) >= 2:
                strap(g, resample(P, 12), [N[min(i * len(N) // 12, len(N) - 1)] for i in range(12)], 0.03 * k, 0.003, o.get("rigColor", OLIVE))
        p, n = M0 @ V((0, 0.0, 0.02)), nc
    else:
        p, n = K.front(0.07 * k, K.J["chest"].z + 0.05 * k, r=0.015)
    M = frame(p, n, UP)
    g.part(box(0.06 * k, 0.095 * k, 0.03, bev=0.006, M=M), o.get("color", "3a3a32"), 0.3)
    g.part(box(0.045 * k, 0.03 * k, 0.003, M=local(M, 0, 0.02 * k, 0.03)), "1c1c1a", 0.2)
    g.part(cyl(0.0045, 0.11 * k, n=6, bev=0.001, M=rot(local(M, 0.02 * k, 0.045 * k, 0.015), "X", -math.pi / 2 + 0.15)), RUBBER, 0.3, smooth="auto")
    g.part(cyl(0.007, 0.008, n=8, bev=0.002, M=local(M, -0.018 * k, 0.035 * k, 0.03)), STEEL, 0.6, smooth="auto")
    g.light(cyl(0.0035, 0.0015, n=8, M=local(M, 0.016 * k, -0.03 * k, 0.03)))
    g.glow_hex = (o.get("glow") or "b6ff8a").lstrip("#")
    g.idle = float(o.get("idle", 0.4))


@gadget("sample_rig", "chest")
def g_sample_rig(g):
    """Sample vials in a chest rig: a panel with six vials (faintly glowing samples)."""
    K, o = g.K, g.o
    k = K.k
    pc, nc = K.front(0.0, K.J["chest"].z - 0.02 * k, r=0.03)
    M0 = frame(pc - nc * 0.004, nc, UP)
    g.part(box(0.2 * k, 0.1 * k, 0.016, bev=0.005, M=M0), o.get("rigColor", OLIVE), 0.1)
    for i in range(6):
        x = (-0.075 + 0.03 * i) * k
        vm = rot(local(M0, x, -0.03 * k, 0.026), "X", -math.pi / 2)
        g.part(cyl(0.0085, 0.075 * k, n=6, M=vm), "5a6a62", 0.9, smooth="auto")
        g.part(cyl(0.0095, 0.012, n=6, M=local(vm, 0, 0, 0.075 * k)), ("8a3a2a", "3a5a8a", STEEL)[i % 3], 0.5, smooth="auto")
        g.light(cyl(0.006, 0.045 * k, n=6, M=local(vm, 0, 0, 0.008)), seg=float(i))
    g.part(box(0.2 * k, 0.03 * k, 0.012, bev=0.003, M=local(M0, 0, -0.005, 0.016)), o.get("rigColor", OLIVE), 0.1)
    for s in (1, -1):
        a = M0 @ V((s * 0.085 * k, 0.05 * k, 0.01))
        sh = K.J["shoulder_" + ("L" if s > 0 else "R")]
        guide = [a, V((s * 0.1 * k, a.y, (a.z + sh.z) / 2 + 0.03)), V((s * 0.09 * k, K.J["neck"].y, sh.z + 0.05 * k)), V((s * 0.07 * k, K.J["neck"].y + 0.1, sh.z - 0.03))]
        P, N = surf_path(K, guide, lift=0.004)
        if len(P) >= 2:
            strap(g, resample(P, 10), [N[min(i * len(N) // 10, len(N) - 1)] for i in range(10)], 0.026 * k, 0.003, o.get("rigColor", OLIVE))
    g.segs = 6
    g.glow_hex = (o.get("glow") or "b6ff8a").lstrip("#")
    g.idle = float(o.get("idle", 0.15))


@gadget("continuum_chest_emitter", "chest")
def g_cont_chest(g):
    """Continuum chest emitter: a circular gold ring on a ceramic housing (pulses before a temporal attack)."""
    K, o = g.K, g.o
    k = K.k
    p, n = K.front(0.0, K.J["chest"].z + 0.05 * k, r=0.03)
    M = frame(p - n * 0.003, n, UP)
    g.part(cyl(0.052 * k, 0.012, n=16 if K.lod else 12, bev=0.004, M=M, r2=0.048 * k), o.get("color", "dfe1e3"), 0.8, smooth="auto")
    g.part(cyl(0.03 * k, 0.004, n=16 if K.lod else 12, bev=0.001, M=local(M, 0, 0, 0.012)), GRAPH, 0.8, smooth="auto")
    g.part(cyl(0.014 * k, 0.002, n=12, M=local(M, 0, 0, 0.016)), GLASS, 0.95, smooth="auto")
    g.light(torus(0.039 * k, 0.0035, n=20 if K.lod else 14, m=4, M=local(M, 0, 0, 0.0125)), smooth=True)
    g.glow_hex = (o.get("glow") or "ffd27a").lstrip("#")
    g.idle = float(o.get("idle", 0.4))


@gadget("rank_bar", "chest")
def g_rank(g):
    """Continuum officer's rank bar on the left chest: three gold pips (`_gseg` 0..2)."""
    K, o = g.K, g.o
    k = K.k
    p, n = K.front(0.085 * k, K.J["chest"].z + 0.1 * k, r=0.01)
    M = frame(p - n * 0.001, n, UP)
    g.part(box(0.07 * k, 0.016 * k, 0.004, bev=0.0012, M=M), GRAPH, 0.7)
    for i in range(int(o.get("pips", 3))):
        g.light(box(0.012 * k, 0.007 * k, 0.0012, bev=0.0004, M=local(M, (-0.02 + 0.02 * i) * k, 0, 0.004)), seg=float(i))
    g.segs = int(o.get("pips", 3))
    g.glow_hex = (o.get("glow") or "ffd27a").lstrip("#")
    g.idle = float(o.get("idle", 0.6))


@gadget("stabilizer_fins", "chest")
def g_fins(g):
    """Continuum back stabilizer fins: two short blades in a V on a back plate, with gold edge lights."""
    K, o = g.K, g.o
    k = K.k
    p, n = K.front(0.0, K.J["chest"].z + 0.06 * k, back=True, r=0.03)
    M = frame(p - n * 0.003, n, UP)
    col = o.get("color", "dfe1e3")
    g.part(box(0.12 * k, 0.12 * k, 0.012, bev=0.004, M=M), GRAPH, 0.6)
    for i, s in enumerate((1, -1)):
        fm = rot(rot(local(M, s * 0.035 * k, 0.01 * k, 0.01), "Z", -s * 0.42), "Y", s * 0.35)
        bl = box(0.012, 0.17 * k, 0.045, bev=0.003, M=local(fm, 0, 0.03 * k, 0), taper=0.35)
        g.part(bl, col, 0.8)
        g.light(box(0.004, 0.14 * k, 0.003, M=local(fm, 0, 0.03 * k, 0.045 * 0.65)), seg=float(i))
    g.segs = 2
    g.glow_hex = (o.get("glow") or "ffd27a").lstrip("#")
    g.idle = float(o.get("idle", 0.5))


# ---------------- belt / hips ----------------
def belt_loop(K, z, lift=0.003):
    P, N = [], []
    c = V((0, -float(BH.costume.zc_at(K.B, z)), z))
    for i in range(30):
        th = 2 * math.pi * i / 30
        d = V((math.sin(th), -math.cos(th), 0))
        h = K.ray(c + d * 0.5, -d, TORSO, 1.0)
        if h is None:
            continue
        P.append(h[0] + h[1] * lift)
        N.append(h[1])
    return _smooth_loop(P, N)


@gadget("belt_scanner", "hips")
def g_belt_scanner(g):
    """Palm-size puck on the front-right of the harness belt (ahead of the arm swing) with a cyan ring that pulses
    near evidence."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "R")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.075 * k, K.belt_z - 0.01 * k, r=0.015)
    M = frame(p - n * 0.002, n, UP)
    g.part(box(0.04 * k, 0.05 * k, 0.006, bev=0.002, M=local(M, 0, 0.004 * k, 0)), BLACK, 0.35)
    pm = local(M, 0, 0, 0.005)
    g.part(cyl(0.03 * k, 0.013, n=16 if K.lod > 1 else 12, bev=0.004, M=pm, r2=0.027 * k), o.get("color", GUN), 0.6, smooth="auto")
    g.part(cyl(0.017 * k, 0.002, n=12, M=local(pm, 0, 0, 0.013)), GLASS, 0.95, smooth="auto")
    g.light(torus(0.0215 * k, 0.0018, n=16 if K.lod > 1 else 12, m=4, M=local(pm, 0, 0, 0.0128)), smooth=True)
    g.idle = float(o.get("idle", 0.2))


@gadget("stun_baton", "hips")
def g_baton(g):
    """Stun baton holstered at the right back hip, handle up (the tip glows when drawn)."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "R")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.1 * k, K.belt_z - 0.04 * k, back=True, r=0.015)
    M = rot(frame(p + n * 0.012, n, UP), "Z", s * 0.4)
    g.part(box(0.04 * k, 0.11 * k, 0.012, bev=0.004, M=local(M, 0, -0.01 * k, -0.012)), BLACK, 0.3)
    ax = rot(local(M, 0, 0, 0.006), "X", -math.pi / 2)
    g.part(cyl(0.0145 * k, 0.12 * k, n=10, bev=0.002, M=local(ax, 0, 0, 0.0)), o.get("grip", RUBBER), 0.2, smooth="auto")
    g.part(cyl(0.012 * k, 0.2 * k, n=10, bev=0.002, M=local(ax, 0, 0, -0.2 * k)), o.get("color", GRAPH), 0.6, smooth="auto")
    g.part(cyl(0.017 * k, 0.012, n=10, bev=0.002, M=local(ax, 0, 0, -0.01 * k)), STEEL, 0.7, smooth="auto")
    g.light(cyl(0.0105 * k, 0.025 * k, n=10, M=local(ax, 0, 0, -0.225 * k)))
    g.glow_hex = (o.get("glow") or "bfe4ff").lstrip("#")
    g.idle = float(o.get("idle", 0.0))


@gadget("restraint_cuffs", "hips")
def g_cuffs(g):
    """Restraint cuffs on the back of the belt: a holder with two rings."""
    K, o = g.K, g.o
    k = K.k
    p, n = K.front(0.035 * k, K.belt_z - 0.01 * k, back=True, r=0.012)
    M = frame(p - n * 0.002, n, UP)
    g.part(box(0.1 * k, 0.05 * k, 0.012, bev=0.004, M=M), BLACK, 0.3)
    for s in (1, -1):
        g.part(torus(0.028 * k, 0.0045, n=14, m=4, M=local(M, s * 0.03 * k, -0.025 * k, 0.016)), o.get("color", STEEL), 0.8, smooth=True)
    g.part(box(0.022 * k, 0.01, 0.006, bev=0.002, M=local(M, 0, -0.03 * k, 0.014)), STEEL, 0.8)


def belt_band(g, z, w, t, col, gloss=0.25):
    K = g.K
    P, N = belt_loop(K, z, lift=0.002)
    if len(P) > 8:
        g.part(ribbon(P, N, w, t, closed=True, side=[V((0, 0, 1))] * len(P)), col, gloss, smooth=True)


@gadget("tool_belt", "hips")
def g_tool_belt(g):
    """Technician's tool belt: a wide belt, a driver pouch (front right), a cable spool (front left), a multi-driver
    and a torque driver in loops at the back."""
    K, o = g.K, g.o
    k = K.k
    z = K.belt_z - 0.02 * k
    belt_band(g, z, 0.045 * k, 0.005, o.get("color", "2a2620"))
    p, n = K.front(-0.085 * k, z, r=0.015)
    M = frame(p + n * 0.004, n, UP)
    pouch(g, local(M, 0, -0.035 * k, 0), 0.07 * k, 0.09 * k, 0.03, o.get("pouch", "3a332a"), flap=False)
    for i, (dx, col) in enumerate(((-0.018, ORANGE), (0.0, BLACK), (0.018, "c8ccd0"))):
        hm = rot(local(M, dx * k, 0.012 * k, 0.016), "X", -math.pi / 2)
        g.part(cyl(0.006, 0.05 * k, n=6, bev=0.0015, M=hm), col, 0.4, smooth="auto")
    p, n = K.front(0.1 * k, z, r=0.015)
    M = frame(p + n * 0.004, n, UP)
    g.part(box(0.03 * k, 0.05 * k, 0.006, bev=0.002, M=M), BLACK, 0.3)
    g.part(cyl(0.03 * k, 0.026, n=12, bev=0.003, M=local(M, 0, -0.01 * k, 0.006)), o.get("spool", ORANGE), 0.35, smooth="auto")
    g.part(cyl(0.012 * k, 0.03, n=8, M=local(M, 0, -0.01 * k, 0.004)), STEEL, 0.6, smooth="auto")
    for s in (1, -1):
        p, n = K.front(s * 0.06 * k, z, back=True, r=0.012)
        M = rot(frame(p + n * 0.006, n, UP), "Z", s * 0.25)
        g.part(box(0.03 * k, 0.035 * k, 0.012, bev=0.003, M=M), BLACK, 0.3)
        g.part(cyl(0.0085 * k, 0.12 * k, n=8, bev=0.002, M=rot(local(M, 0, 0.05 * k, 0.016), "X", math.pi / 2)), (ORANGE if s > 0 else YELLOW), 0.35, smooth="auto")
        g.part(cyl(0.004, 0.06 * k, n=6, M=rot(local(M, 0, -0.07 * k, 0.016), "X", math.pi / 2)), STEEL, 0.75, smooth="auto")


@gadget("diagnostic_probe", "hips")
def g_probe(g):
    """Holstered diagnostic probe at the front left of the belt: a pistol-grip body, a nose with a lit tip."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "L")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.11 * k, K.belt_z - 0.03 * k, r=0.015)
    M = rot(frame(p + n * 0.003, n, UP), "Z", -s * 0.25)
    g.part(box(0.045 * k, 0.12 * k, 0.03, bev=0.006, M=local(M, 0, -0.04 * k, 0), taper=0.1), BLACK, 0.25)
    g.part(box(0.03 * k, 0.07 * k, 0.026, bev=0.006, M=local(M, 0, 0.05 * k, 0.004)), o.get("color", ORANGE), 0.35)
    g.part(cyl(0.007 * k, 0.04 * k, n=8, bev=0.0015, M=rot(local(M, 0, -0.1 * k, 0.015), "X", math.pi / 2)), STEEL, 0.7, smooth="auto")
    g.light(cyl(0.004 * k, 0.008, n=8, M=rot(local(M, 0, -0.135 * k, 0.015), "X", math.pi / 2)))
    g.idle = float(o.get("idle", 0.2))


@gadget("signal_wand", "hips")
def g_wand(g):
    """Amber light baton holstered at the back left hip (lights while guiding passengers)."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "L")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.1 * k, K.belt_z - 0.035 * k, back=True, r=0.015)
    M = rot(frame(p + n * 0.012, n, UP), "Z", s * 0.4)
    g.part(box(0.035 * k, 0.07 * k, 0.012, bev=0.004, M=local(M, 0, 0, -0.012)), BLACK, 0.3)
    ax = rot(local(M, 0, 0, 0.006), "X", -math.pi / 2)
    g.part(cyl(0.013 * k, 0.1 * k, n=10, bev=0.002, M=local(ax, 0, 0, -0.01 * k)), GRAPH, 0.4, smooth="auto")
    g.part(cyl(0.011 * k, 0.2 * k, n=10, bev=0.002, M=local(ax, 0, 0, -0.21 * k)), "5a4a2a", 0.85, smooth="auto")
    g.light(cyl(0.0095 * k, 0.18 * k, n=8, M=local(ax, 0, 0, -0.2 * k)))
    g.glow_hex = (o.get("glow") or "ffb02e").lstrip("#")
    g.idle = float(o.get("idle", 0.35))


@gadget("payment_terminal", "hips")
def g_payment(g):
    """Belt payment terminal at the front left: a slim block with a glass face and a green tap ring."""
    K, o = g.K, g.o
    k = K.k
    p, n = K.front(0.09 * k, K.belt_z - 0.03 * k, r=0.015)
    M = frame(p - n * 0.002, n, UP)
    g.part(box(0.025 * k, 0.04 * k, 0.006, bev=0.002, M=local(M, 0, 0.03 * k, 0)), BLACK, 0.3)
    g.part(box(0.07 * k, 0.105 * k, 0.018, bev=0.006, M=M), o.get("color", "2e3136"), 0.45)
    g.part(box(0.058 * k, 0.07 * k, 0.0012, bev=0.0005, M=local(M, 0, 0.01 * k, 0.018)), GLASS, 0.95)
    g.light(torus(0.014 * k, 0.0016, n=12, m=4, M=local(M, 0, 0.01 * k, 0.0195)), smooth=True)
    g.glow_hex = (o.get("glow") or "5aff8a").lstrip("#")
    g.idle = float(o.get("idle", 0.6))


@gadget("med_pack", "hips")
def g_medpack(g):
    """Trauma med pack at the right back hip with a reflective white cross."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "R")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.08 * k, K.belt_z - 0.045 * k, back=True, r=0.02)
    M = frame(p - n * 0.006, n, UP)
    col = o.get("color", "b0262e")
    pouch(g, M, 0.14 * k, 0.1 * k, 0.055, col, flap=False, gloss=0.2)
    g.part(box(0.14 * k * 1.02, 0.012, 0.004, M=local(M, 0, 0.025 * k, 0.05)), BLACK, 0.4)
    g.part(box(0.034 * k, 0.01 * k, 0.0012, M=local(M, 0, -0.012 * k, 0.055)), "eef0f0", 0.6)
    g.part(box(0.01 * k, 0.034 * k, 0.0012, M=local(M, 0, -0.012 * k, 0.055)), "eef0f0", 0.6)


# ---------------- packs and bags ----------------
def pack_straps(g, M, w, h, col, width=0.04, thick=0.004, crossed=False):
    """Two shoulder straps from the top of a back pack over the shoulders down the chest to under the arms."""
    K = g.K
    k = K.k
    mx = 1 if M.col[0][0] >= 0 else -1        # the pack's local x may point to -x on the back: pick the strap's own side
    for s in (1, -1):
        sd = "L" if s > 0 else "R"
        sh = K.J["shoulder_" + sd]
        top = M @ V((mx * s * w * 0.3, h * 0.45, 0.0))
        guide = [top, V((s * 0.075 * k, K.J["neck"].y + 0.06, sh.z + 0.04 * k)), V((s * 0.09 * k, K.J["neck"].y - 0.02, sh.z + 0.05 * k)),
                 V((s * 0.105 * k, sh.y - 0.1, sh.z - 0.02 * k)), V((s * 0.12 * k, sh.y - 0.09, K.J["chest"].z - 0.04 * k)),
                 V((s * 0.15 * k, sh.y - 0.02, K.J["chest"].z - 0.08 * k))]
        P, N = surf_path(K, guide, lift=0.004)
        if len(P) >= 3:
            n = 14
            strap(g, resample(P, n), [N[min(i * len(N) // n, len(N) - 1)] for i in range(n)], width * k, thick, col, soft=True)


def back_mount(K, z, dz=0.0, r=0.04):
    p, n = K.front(0.0, z, back=True, r=r)
    n = (n * 0.5 + V((0, 1, 0)) * 0.5).normalized()
    return frame(p - n * 0.004, n, UP)


@gadget("cube_backpack", "chest")
def g_cube(g):
    """Insulated courier cube backpack with a green delivery-status light bar."""
    K, o = g.K, g.o
    k = K.k
    M = back_mount(K, K.J["chest"].z + 0.0 * k)
    w, h, d = 0.36 * k, 0.38 * k, 0.26 * k
    col = o.get("color", "1f2226")
    g.part(box(w, h, d, bev=0.03, seg=2 if K.lod else 1, M=local(M, 0, -0.02, 0)), col, 0.35)
    g.part(box(w * 0.92, 0.012, d * 0.5, M=local(M, 0, h * 0.5 - 0.02, d * 0.3)), "2c3035", 0.4)
    g.part(box(w * 0.7, h * 0.12, 0.004, M=local(M, 0, -0.02 - h * 0.25, d)), "c8ccd0", 0.6)
    g.light(box(w * 0.5, 0.008, 0.0012, M=local(M, 0, -0.02 + h * 0.3, d)))
    pack_straps(g, M, w, h, BLACK)
    g.glow_hex = (o.get("glow") or "4dff8a").lstrip("#")
    g.idle = float(o.get("idle", 0.8))


@gadget("school_backpack", "chest")
def g_school(g):
    """Small school backpack with a front pocket and a keyring charm (tablet=True: a lit tablet sleeve strip)."""
    K, o = g.K, g.o
    k = K.k
    M = back_mount(K, K.J["chest"].z - 0.02 * k)
    w, h, d = 0.27 * k, 0.32 * k, 0.12 * k
    col = o.get("color", "3a5a9a")
    g.part(box(w, h, d, bev=0.035 * k, seg=2 if K.lod else 1, M=M, taper=0.12), col, 0.2)
    g.part(box(w * 0.7, h * 0.4, 0.035, bev=0.012, M=local(M, 0, -h * 0.18, d - 0.01)), o.get("pocket", "2a2e36"), 0.2)
    ch = local(M, w * 0.22, h * 0.05, d + 0.02)
    g.part(torus(0.008, 0.0015, n=8, m=4, M=rot(ch, "Y", math.pi / 2)), STEEL, 0.8, smooth=True)
    g.part(box(0.022, 0.026, 0.008, bev=0.004, M=local(ch, 0, -0.022, -0.004)), o.get("charm", "e8b923"), 0.4)
    if o.get("tablet") or K.era == "2049":
        g.light(box(w * 0.5, 0.006, 0.001, M=local(M, 0, h * 0.18, d - 0.003)))
        g.idle = float(o.get("idle", 0.4))
    pack_straps(g, M, w, h, o.get("strap", "1f2226"), width=0.032)


@gadget("salvage_backpack", "chest")
def g_salvage(g):
    """A big patched salvage pack with a bedroll on top, a side canister and webbing."""
    K, o = g.K, g.o
    k = K.k
    M = back_mount(K, K.J["chest"].z - 0.03 * k)
    w, h, d = 0.32 * k, 0.42 * k, 0.17 * k
    col = o.get("color", "5a4a38")
    g.part(box(w, h, d, bev=0.04 * k, seg=1, M=M, taper=0.1), col, 0.08)
    g.part(box(w * 0.75, h * 0.3, 0.04, bev=0.014, M=local(M, 0, -h * 0.2, d - 0.012)), "4a4232", 0.08)
    g.part(box(w * 0.3, h * 0.25, 0.004, M=local(M, -w * 0.15, h * 0.12, d - 0.008)), "6a5a40", 0.05)
    br = rot(local(M, -w * 0.5, h * 0.5 + 0.045 * k, d * 0.45), "Y", math.pi / 2)
    g.part(cyl(0.05 * k, w, n=10, bev=0.012, M=br), o.get("roll", "6a6a54"), 0.05, smooth="auto")
    for f in (0.22, 0.78):
        g.part(torus(0.052 * k, 0.004, n=10, m=4, M=local(br, 0, 0, w * f)), "2a2620", 0.2, smooth=True)
    g.part(box(w * 1.04, h * 0.2, d * 0.55, bev=0.018 * k, M=local(M, 0, h * 0.42, d * 0.5)), "4e4030", 0.08)      # lid
    for f in (-0.28, 0.28):                                                   # compression straps with buckles
        g.part(box(0.026 * k, h * 0.92, 0.004, M=local(M, w * f, -h * 0.02, d + 0.001)), "2e2820", 0.15)
        g.part(box(0.034 * k, 0.03 * k, 0.006, bev=0.002, M=local(M, w * f, h * 0.18, d + 0.002)), GUN, 0.5)
    sc = rot(local(M, w * 0.5 + 0.03, -h * 0.1, d * 0.45), "X", -math.pi / 2)
    g.part(cyl(0.03 * k, 0.2 * k, n=10, bev=0.006, M=local(sc, 0, 0, -0.1 * k)), "6a6e66", 0.35, smooth="auto")
    g.part(cyl(0.031 * k, 0.012, n=10, bev=0.002, M=local(sc, 0, 0, 0.09 * k)), "3a3a32", 0.3, smooth="auto")
    pack_straps(g, M, w, h, "3a3226", width=0.04)


@gadget("sling_bag", "chest")
def g_sling(g):
    """Sling bag across the back (strap over the left shoulder) with a tablet sleeve at the top."""
    K, o = g.K, g.o
    k = K.k
    p_hi, p_lo = ensure_diag(K, opt_side(o, "L"))
    P, N = torso_loop(K, p_hi, p_lo, lift=0.003)
    strap(g, P, N, 0.032 * k, 0.003, o.get("strap", "1f2226"), closed=True)
    s = 1 if opt_side(o, "L") == "L" else -1
    p, n = K.front(-s * 0.05 * k, K.J["chest"].z - 0.03 * k, back=True, r=0.03)
    M = rot(frame(p + n * 0.003, n, UP), "Z", s * 0.75)
    col = o.get("color", "2a3038")
    g.part(box(0.32 * k, 0.16 * k, 0.06, bev=0.025 * k, seg=1, M=M, taper=0.15), col, 0.25)
    g.part(box(0.26 * k, 0.012, 0.004, M=local(M, 0, 0.03 * k, 0.058)), "c8ccd0", 0.6)
    g.part(box(0.2 * k, 0.03 * k, 0.012, bev=0.003, M=local(M, 0.02, 0.085 * k, 0.015)), BLACK, 0.5)
    g.light(box(0.16 * k, 0.004, 0.001, M=local(M, 0.02, 0.1 * k, 0.025)))
    g.idle = float(o.get("idle", 0.3))


@gadget("tablet_bag", "hips")
def g_tablet_bag(g):
    """Slim tablet bag worn across the body (strap over the right shoulder), riding at the back left hip."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "R")
    p_hi, p_lo = ensure_diag(K, sd)
    P, N = torso_loop(K, p_hi, p_lo, lift=0.003)
    strap(g, P, N, 0.03 * k, 0.003, o.get("strap", "1f2226"), closed=True)
    s = 1 if sd == "L" else -1
    p, n = K.front(-s * 0.07 * k, K.belt_z - 0.06 * k, back=True, r=0.03)
    M = rot(frame(p + n * 0.002, n, UP), "Z", -s * 0.12)
    g.part(box(0.3 * k, 0.22 * k, 0.03, bev=0.01, M=M), o.get("color", "2e2a28"), 0.3)
    g.part(box(0.3 * k * 1.01, 0.07 * k, 0.004, bev=0.0015, M=local(M, 0, 0.08 * k, 0.03)), o.get("color", "2e2a28"), 0.35)
    g.part(box(0.04 * k, 0.012, 0.003, M=local(M, 0, 0.05 * k, 0.034)), STEEL, 0.7)


@gadget("crossbody_bag", "hips")
def g_crossbody(g):
    """Small crossbody phone bag at the front right hip on a strap over the left shoulder."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "L")
    s = 1 if sd == "L" else -1
    p_hi, p_lo = ensure_diag(K, sd)
    P, N = torso_loop(K, p_hi, p_lo, lift=0.003)
    strap(g, P, N, 0.018 * k, 0.0025, o.get("strap", "2a2420"), closed=True)
    p, n = K.front(-s * 0.1 * k, K.J["pelvis"].z + 0.01 * k, r=0.02)
    M = frame(p - n * 0.002, n, UP)
    g.part(box(0.12 * k, 0.17 * k, 0.035, bev=0.01, M=M, taper=0.05), o.get("color", "3a2a22"), 0.35)
    g.part(box(0.122 * k, 0.06 * k, 0.004, bev=0.0015, M=local(M, 0, 0.055 * k, 0.034)), o.get("color", "3a2a22"), 0.4)
    g.part(box(0.012, 0.014, 0.004, bev=0.001, M=local(M, 0, 0.03 * k, 0.037)), GOLD, 0.8)


@gadget("tote_bag", "chest")
def g_tote(g):
    """Tote bag with a laptop on the right shoulder, riding behind the hip (out of the arm swing)."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "R")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.1 * k, K.J["pelvis"].z + 0.06 * k, back=True, r=0.03)
    M = rot(frame(p + n * 0.004, (n + V((s * 0.5, 0, 0))).normalized(), UP), "Z", 0.0)
    w, h = 0.34 * k, 0.32 * k
    col = o.get("color", "c8b89a")
    g.part(box(w, h, 0.05, bev=0.012, M=M, taper=0.12), col, 0.08)
    g.part(box(w * 0.82, 0.02, 0.012, M=local(M, 0, h * 0.5, 0.025)), "3a3a3e", 0.4)
    sh = K.J["shoulder_" + sd]
    for dx in (-0.1, 0.1):
        a = M @ V((dx * k, h * 0.48, 0.02))
        guide = [a, V((s * 0.13 * k, sh.y + 0.04, K.J["chest"].z + 0.02)), V((s * 0.12 * k, sh.y, sh.z + 0.05 * k)),
                 V((s * 0.11 * k, sh.y - 0.07, K.J["chest"].z + 0.06 * k)), V((s * 0.12 * k + (dx * 0.4), sh.y - 0.09, K.J["chest"].z - 0.02))]
        P, N = surf_path(K, guide, lift=0.004)
        if len(P) >= 3:
            strap(g, resample(P, 10), [N[min(i * len(N) // 10, len(N) - 1)] for i in range(10)], 0.022 * k, 0.003, o.get("strap", "8a7a62"))


@gadget("loupe_cord", "chest")
def g_loupe(g):
    """Jeweller's loupe on a cord around the neck, hanging at the sternum."""
    K, o = g.K, g.o
    k = K.k
    P, N = neck_loop(K, K.J["chest"].z + 0.06 * k, K.J["neck"].z + 0.02 * k, lift=0.004)
    i0 = int(np.argmin([p.y for p in P]))
    P = P[i0 + 1:] + P[:i0]
    pc, nc = K.front(0.0, K.J["chest"].z + 0.035 * k, r=0.015)
    M = frame(pc + nc * 0.004, nc, UP)
    top = M @ V((0, 0.02, 0))
    P = [top] + P + [top]
    g.part(tube(resample(P, 22), 0.0012, n=4, caps=False), "2a2420", 0.2, smooth=True, wt="soft")
    g.part(cyl(0.013 * k, 0.022, n=10, bev=0.003, M=M, r2=0.011 * k), o.get("color", BLACK), 0.5, smooth="auto")
    g.part(cyl(0.009 * k, 0.001, n=10, M=local(M, 0, 0, 0.022)), "a8c0c8", 0.95, smooth="auto")


@gadget("bead_necklace", "chest")
def g_beads(g):
    """Clay-bead necklace around the neck base (two alternating clay colours, a bronze centre bead)."""
    K, o = g.K, g.o
    k = K.k
    P, N = neck_loop(K, K.J["chest"].z + 0.075 * k, K.J["neck"].z + 0.01 * k, lift=0.006, n=24)
    P2 = resample(P + [P[0]], (26, 20, 16)[2 - K.lod])[:-1]
    nb = (6, 5, 4)[2 - K.lod]
    cols = o.get("colors", [CLAY, "6a3a2a"])
    i0 = int(np.argmin([p.y for p in P2]))
    for i, p in enumerate(P2):
        d = (P2[(i + 1) % len(P2)] - P2[i - 1]).normalized()
        M = frame(p, d, UP)
        big = i == i0
        r = 0.0065 if big else 0.0048
        g.part(lathe([(0.0, -r), (r * 0.9, -r * 0.45), (r * 0.9, r * 0.45), (0.0, r)], n=nb, M=M), BRONZE if big else cols[i % len(cols)], 0.7 if big else 0.3, smooth=True)


@gadget("bronze_pin", "chest")
def g_pin(g):
    """Bronze cloak pin at the right shoulder front: a ring brooch with a pin bar."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "R")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.1 * k, K.J["chest"].z + 0.12 * k, r=0.01)
    M = frame(p + n * 0.002, n, UP)
    g.part(torus(0.016 * k, 0.0035, n=14, m=5, M=M), o.get("color", BRONZE), 0.85, smooth=True)
    g.part(tube([M @ V((-0.024 * k, -0.006, 0.002)), M @ V((0.024 * k, 0.008, 0.002))], 0.0018, n=5), BRONZE, 0.85, smooth=True)
    g.part(lathe([(0.0, 0.0), (0.004, 0.0), (0.003, 0.004), (0.0, 0.005)], n=6, M=local(M, 0, 0.016 * k, 0.0)), BRONZE, 0.85, smooth=True)


@gadget("tally_cords", "chest")
def g_tally(g):
    """Knotted tally cords on a shoulder cord (left shoulder to right hip), five strands hanging on the chest."""
    K, o = g.K, g.o
    k = K.k
    p_hi, p_lo = ensure_diag(K, opt_side(o, "L"))
    P, N = torso_loop(K, p_hi, p_lo, n=28, lift=0.004)
    g.part(ribbon(P, N, 0.007 * k, 0.004, closed=True), o.get("color", "8a6a44"), 0.15, smooth=True, wt="soft")
    front = [(p, n) for p, n in zip(P, N) if p.y < K.J["chest"].y - 0.03 and K.J["spine"].z < p.z < K.J["chest"].z + 0.1 * k]
    front.sort(key=lambda t: -t[0].z)
    cols = o.get("colors", ["cdb48a", "9b3b24", "3f6a6a", "cdb48a", "5a3e28"])
    sel = front[1:len(front) - 1:max(1, (len(front) - 2) // 5)][:5] if len(front) > 3 else front
    for i, (p, n) in enumerate(sel):
        L = (0.09 + 0.03 * ((i * 7) % 3)) * k
        pts = [p + n * 0.003 + V((0, 0, -L * f)) + n * (0.006 * f) for f in (0.0, 0.33, 0.66, 1.0)]
        g.part(tube(pts, 0.0018, n=4), cols[i % len(cols)], 0.1, smooth=True)
        for f in (0.4, 0.75):
            kp = p + n * (0.003 + 0.006 * f) + V((0, 0, -L * f))
            g.part(lathe([(0.0, -0.004), (0.0035, -0.002), (0.0035, 0.002), (0.0, 0.004)], n=4, M=frame(kp, UP, V((0, -1, 0)))), cols[i % len(cols)], 0.1, smooth=True)


@gadget("shard_bandolier", "chest")
def g_shards(g):
    """Data-shard bandolier (right shoulder to left hip) holding recovered memory shards, each with a faint green
    index light (`_gseg` = shard index)."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "R")
    p_hi, p_lo = ensure_diag(K, sd)
    P, N = torso_loop(K, p_hi, p_lo, n=32, lift=0.004)
    g.part(ribbon(P, N, 0.045 * k, 0.004, closed=True), o.get("color", "4a3a28"), 0.12, smooth=True, wt="soft")
    front = [(p, n, i) for i, (p, n) in enumerate(zip(P, N)) if p.y < K.J["chest"].y - 0.02 and K.J["spine"].z - 0.04 < p.z < K.J["shoulder_L"].z - 0.02]
    front.sort(key=lambda t: -t[0].z)
    slots = 6 if K.lod else 4
    if len(front) > slots:
        front = [front[int(round(j * (len(front) - 1) / (slots - 1)))] for j in range(slots)]
    cnt = 0
    for j, (p, n, i) in enumerate(front):
        d = (P[(i + 1) % len(P)] - P[i - 1]).normalized()
        M = frame(p + n * 0.004, n, d)
        g.part(box(0.034 * k, 0.012 * k, 0.003, M=local(M, 0, -0.012 * k, 0)), "2e2418", 0.2)          # the loop strap
        for dx in (-0.011, 0.011):
            sm = local(M, dx * k, 0, 0)
            g.part(box(0.009 * k, 0.034 * k, 0.006, taper=0.25, M=sm), "2a2c2e", 0.6)
            g.light(box(0.004 * k, 0.004 * k, 0.0008, M=local(sm, 0, 0.009 * k, 0.006)), seg=float(cnt))
            cnt += 1
    g.segs = cnt
    g.glow_hex = (o.get("glow") or "b6ff8a").lstrip("#")
    g.idle = float(o.get("idle", 0.3))


@gadget("rope_coil", "chest")
def g_rope(g):
    """Coiled rope over the shoulder, worn bandolier-style (left shoulder to right hip)."""
    K, o = g.K, g.o
    k = K.k
    p_hi, p_lo = ensure_diag(K, opt_side(o, "L"))
    p_lo = p_lo + V((0, 0, 0.13 * k))           # a coil ends at the opposite waist, not the hip
    col = o.get("color", "8a7a60")
    for j, lift in enumerate((0.012, 0.024)):
        P, N = torso_loop(K, p_hi + V((0, 0, 0.006 * j)), p_lo + V((0.01 * j, 0, -0.01 * j)), n=26 if K.lod else 20, lift=lift)
        g.part(tube(P + [P[0]], 0.011 * k, n=5 if K.lod else 4, caps=False), col if j == 0 else "7a6a52", 0.1, smooth=True, wt="soft")


@gadget("leather_satchel", "hips")
def g_satchel(g):
    """Small leather satchel at the back right hip (clay tablets) on a strap over the left shoulder."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "L")
    s = 1 if sd == "L" else -1
    p_hi, p_lo = ensure_diag(K, sd)
    P, N = torso_loop(K, p_hi, p_lo, lift=0.004)
    g.part(ribbon(P, N, 0.022 * k, 0.003, closed=True), o.get("strap", LEATHER2), 0.15, smooth=True, wt="soft")
    p, n = K.front(-s * 0.08 * k, K.belt_z - 0.05 * k, back=True, r=0.02)
    M = frame(p - n * 0.004, n, UP)
    col = o.get("color", LEATHER)
    g.part(box(0.17 * k, 0.13 * k, 0.05, bev=0.015, M=M, taper=0.1), col, 0.25)
    g.part(box(0.172 * k, 0.08 * k, 0.005, bev=0.002, M=local(M, 0, 0.03 * k, 0.048)), LEATHER2, 0.3)
    g.part(cyl(0.005, 0.006, n=6, M=local(M, 0, 0.0, 0.052)), BRONZE, 0.8, smooth="auto")


@gadget("leather_pouch", "hips")
def g_lpouch(g):
    """Drawstring leather pouch at the front left of the sash / belt."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "L")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.09 * k, K.belt_z - 0.035 * k, r=0.015)
    M = frame(p + n * 0.002, n, UP)
    col = o.get("color", LEATHER)
    g.part(lathe([(0.0, -0.045 * k), (0.028 * k, -0.04 * k), (0.033 * k, -0.015 * k), (0.022 * k, 0.012 * k), (0.012 * k, 0.02 * k), (0.016 * k, 0.03 * k), (0.0, 0.032 * k)],
                 n=8, M=rot(local(M, 0, -0.02 * k, 0.024), "X", -math.pi / 2)), col, 0.2, smooth=True)
    g.part(torus(0.013 * k, 0.0022, n=8, m=4, M=rot(local(M, 0, 0.0, 0.024), "X", math.pi / 2)), "8a6a44", 0.1, smooth=True)


@gadget("water_gourd", "hips")
def g_gourd(g):
    """Gourd water flask on a cord at the right hip (behind the hip joint, clear of the hand)."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "R")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.11 * k, K.belt_z - 0.02 * k, back=True, r=0.015)
    M = frame(p + n * 0.004, n, UP)
    gm = rot(local(M, 0, -0.1 * k, 0.045 * k), "X", -math.pi / 2)
    g.part(lathe([(0.0, -0.075 * k), (0.03 * k, -0.07 * k), (0.045 * k, -0.045 * k), (0.042 * k, -0.02 * k), (0.026 * k, 0.0), (0.022 * k, 0.012 * k),
                  (0.03 * k, 0.028 * k), (0.026 * k, 0.045 * k), (0.012 * k, 0.058 * k), (0.009 * k, 0.07 * k), (0.0, 0.072 * k)], n=10 if K.lod else 8, M=gm),
           o.get("color", "b08a4a"), 0.35, smooth=True)
    g.part(cyl(0.008 * k, 0.014, n=6, M=local(gm, 0, 0, 0.068 * k)), WOOD2, 0.2, smooth="auto")
    g.part(tube([gm @ V((0, 0, 0.06 * k)), M @ V((0, 0.01, 0.02)), M @ V((0, 0.03, 0.004))], 0.002, n=4), "8a6a44", 0.1, smooth=True)
    g.part(torus(0.024 * k, 0.002, n=10, m=4, M=local(gm, 0, 0, 0.006 * k)), "8a6a44", 0.1, smooth=True)


@gadget("sling", "hips")
def g_sling_weapon(g):
    """Woven sling tucked in the belt at the front left: a folded cord with the pouch hanging."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "L")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.075 * k, K.belt_z - 0.025 * k, r=0.012)
    M = frame(p + n * 0.004, n, UP)
    col = o.get("color", "9b7a4a")
    for dx in (-0.006, 0.006):
        pts = [M @ V((dx, 0.02, 0.0)), M @ V((dx * 1.5, -0.06 * k, 0.006)), M @ V((dx * 2.5, -0.13 * k, 0.008))]
        g.part(tube(pts, 0.0022, n=4), col, 0.1, smooth=True)
    g.part(box(0.03 * k, 0.045 * k, 0.008, bev=0.003, M=local(M, 0, -0.15 * k, 0.004), taper=0.2), "7a5a34", 0.1)


@gadget("flint_knife", "hips")
def g_knife(g):
    """Flint knife in a leather sheath at the front of the sash: a wooden handle with a binding."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "L")
    s = 1 if sd == "L" else -1
    p, n = K.front(s * 0.06 * k, K.belt_z - 0.04 * k, r=0.012)
    M = rot(frame(p + n * 0.003, n, UP), "Z", -s * 0.35)
    g.part(box(0.035 * k, 0.15 * k, 0.012, bev=0.004, M=local(M, 0, -0.05 * k, 0), taper=0.25), o.get("sheath", LEATHER2), 0.25)
    hm = rot(local(M, 0, 0.03 * k, 0.006), "X", -math.pi / 2)
    g.part(cyl(0.0085 * k, 0.07 * k, n=6, bev=0.002, M=hm), WOOD, 0.25, smooth="auto")
    for f in (0.2, 0.8):
        g.part(cyl(0.0098 * k, 0.008, n=6, M=local(hm, 0, 0, 0.07 * k * f)), "8a6a44", 0.1, smooth="auto")
    g.part(lathe([(0.0, 0.0), (0.012, 0.004), (0.008, 0.012), (0.0, 0.014)], n=5, M=local(hm, 0, 0, 0.07 * k)), "5a5a58", 0.5, smooth=True)


@gadget("horn", "hips")
def g_horn(g):
    """Cattle horn on a cord over the right shoulder, hanging at the back left hip."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "R")
    s = 1 if sd == "L" else -1
    p_hi, p_lo = ensure_diag(K, sd)
    P, N = torso_loop(K, p_hi, p_lo, lift=0.004)
    g.part(ribbon(P, N, 0.006 * k, 0.004, closed=True), "6a4a2a", 0.1, smooth=True, wt="soft")
    p, n = K.front(-s * 0.1 * k, K.belt_z - 0.03 * k, back=True, r=0.015)
    M = frame(p + n * 0.03 * k, n, UP)
    pts, rs = [], []
    for i in range(8):
        t = i / 7
        a = t * 1.3
        pts.append(M @ V((-s * (0.13 * k * math.sin(a) - 0.07 * k), -0.13 * k * (1 - math.cos(a)) + 0.03, 0.0)))
        rs.append(0.026 * k * (1 - t) ** 0.8 + 0.003)
    g.part(tube(pts, rs, n=8 if K.lod else 6), o.get("color", "d8c8a0"), 0.55, smooth=True)
    g.part(torus(rs[0] * 0.95, 0.003, n=8, m=4, M=frame(pts[0], (pts[0] - pts[1]).normalized(), UP)), BRONZE, 0.8, smooth=True)


# ---------------- hand props ----------------
def hand_prop(g, sd):
    g.bone = "hand_" + sd
    g.prop = "hand"
    return g.K.hand(sd)


def stick(g, sd, below, above, r, col, top=None, bottom=None, n=8, gloss=0.25):
    """A stick through the fist along the hand axis (down to the floor when the arm hangs)."""
    h = hand_prop(g, sd)
    k = g.K.k
    ax = h["axis"]
    c = h["grip"]
    p0, p1 = c + ax * below, c - ax * above
    pts = [p0 + (p1 - p0) * t for t in np.linspace(0, 1, 6)]
    rr = [r * (0.85 + 0.15 * t) for t in np.linspace(0, 1, 6)]
    g.part(tube(pts, rr, n=n), col, gloss, smooth=True)
    return p0, p1, ax, k


@gadget("staff", "hand_R")
def g_staff(g):
    """Carved wooden staff (hand prop) with a carved knob and a leather grip wrap."""
    K, o = g.K, g.o
    sd = opt_side(o, "R")
    below = K.hand(sd)["grip"].z * 0.97
    p0, p1, ax, k = stick(g, sd, below, o.get("above", 0.8) * K.k, 0.017 * K.k, o.get("color", WOOD))
    g.part(lathe([(0.0, 0.0), (0.024 * k, 0.012), (0.026 * k, 0.03), (0.018 * k, 0.05), (0.0, 0.06)], n=8, M=frame(p1, -ax, UP)), o.get("color", WOOD), 0.3, smooth=True)
    g.part(cyl(0.0195 * k, 0.12 * k, n=8, M=frame(K.hand(sd)["grip"] + ax * 0.06 * k, -ax, UP)), LEATHER2, 0.15, smooth="auto")


@gadget("spear", "hand_R")
def g_spear(g):
    """Bronze-tipped spear: a hand prop (default) or slung across the back (mount='back')."""
    K, o = g.K, g.o
    k = K.k
    col = o.get("color", WOOD)
    if o.get("mount") == "back":
        g.bone = "chest"
        p, n = K.front(0.0, K.J["chest"].z, back=True, r=0.03)
        d = V((0.45, 0, 1)).normalized()
        c = p + n * 0.035
        p0, p1 = c - d * 0.75 * k, c + d * 1.05 * k
        g.part(tube([p0, p1], 0.0135 * k, n=7), col, 0.25, smooth=True)
        P, N = torso_loop(K, *ensure_diag(K, "L"), lift=0.004)
        g.part(ribbon(P, N, 0.016 * k, 0.003, closed=True), LEATHER2, 0.15, smooth=True, wt="soft")
        ax = -d
    else:
        below = K.hand(opt_side(o, "R"))["grip"].z * 0.97
        p0, p1, ax, k = stick(g, opt_side(o, "R"), below, 1.15 * k, 0.0135 * K.k, col, n=7)
    tip = frame(p1, -ax, UP)
    g.part(lathe([(0.0, -0.01), (0.016 * k, 0.0), (0.017 * k, 0.03), (0.026 * k, 0.07 * k), (0.0, 0.2 * k)], n=6, M=tip), o.get("tip", BRONZE), 0.85, smooth=False)
    g.part(cyl(0.017 * k, 0.03 * k, n=7, M=local(tip, 0, 0, -0.03 * k)), "8a6a44", 0.1, smooth="auto")


@gadget("distaff", "hand_L")
def g_distaff(g):
    """Distaff with a bundle of wool (hand prop)."""
    K, o = g.K, g.o
    sd = opt_side(o, "L")
    k = K.k
    p0, p1, ax, _ = stick(g, sd, 0.08 * k, 0.5 * k, 0.009 * k, o.get("color", WOOD))
    wm = frame(p1 + ax * 0.12 * k, -ax, UP)
    g.part(lathe([(0.0, -0.02 * k), (0.035 * k, 0.0), (0.05 * k, 0.05 * k), (0.045 * k, 0.1 * k), (0.025 * k, 0.14 * k), (0.0, 0.16 * k)], n=8, M=wm), o.get("wool", "e0d6c0"), 0.02, smooth=True)
    g.part(torus(0.046 * k, 0.003, n=10, m=4, M=local(wm, 0, 0, 0.07 * k)), "9b3b24", 0.1, smooth=True)


@gadget("clay_jar", "hand_L")
def g_jar(g):
    """Clay water jar carried by its neck in the hand (hand prop)."""
    K, o = g.K, g.o
    sd = opt_side(o, "L")
    h = hand_prop(g, sd)
    k = K.k
    M = frame(h["grip"] + h["axis"] * 0.02 * k, -h["axis"], h["palm"])
    prof = [(0.0, -0.3 * k), (0.06 * k, -0.295 * k), (0.11 * k, -0.24 * k), (0.125 * k, -0.17 * k), (0.11 * k, -0.09 * k), (0.06 * k, -0.04 * k),
            (0.038 * k, -0.015 * k), (0.036 * k, 0.012 * k), (0.046 * k, 0.022 * k), (0.03 * k, 0.026 * k), (0.0, 0.0)]
    g.part(lathe(prof, n=12 if K.lod else 9, M=M), o.get("color", CLAY), 0.25, smooth=True)
    g.part(torus(0.105 * k, 0.003, n=14, m=3, M=local(M, 0, 0, -0.14 * k)), "6a3a2a", 0.2, smooth=True)


def _hand_slate(g, sd, size, col, bumper=None, screen=True):
    h = hand_prop(g, sd)
    k = g.K.k
    w, l, t = size
    M = mat_axes(h["across"], h["axis"], h["palm"], h["grip"] + h["palm"] * 0.004 + h["axis"] * (l * 0.15))
    if bumper:
        g.part(box(w, l, t, bev=0.004, M=M), bumper, 0.3)
        g.part(box(w - 0.01, l - 0.01, t + 0.0008, bev=0.0015, M=M), col, 0.6)
    else:
        g.part(box(w, l, t, bev=min(0.004, t * 0.45), M=M), col, 0.7)
    if screen:
        g.light(box(w - 0.016, l - 0.02, 0.0006, M=local(M, 0, 0, t + 0.0008)))
    _ = k


@gadget("smartphone", "hand_R")
def g_phone(g):
    """2026 smartphone: in the hand with its screen lit (default) or in a chest / vest pocket (mount='pocket')."""
    K, o = g.K, g.o
    k = K.k
    if o.get("mount") == "pocket":
        g.bone = "chest"
        p, n = K.front(0.085 * k, K.J["chest"].z + 0.03 * k, r=0.012)
        M = frame(p - n * 0.004, n, UP)
        g.part(box(0.07 * k, 0.15 * k, 0.008, bev=0.003, M=local(M, 0, 0.02 * k, 0)), o.get("color", "1c1d20"), 0.75)
        g.idle = 0.0
        return
    _hand_slate(g, opt_side(o, "R"), (0.072 * k, 0.15 * k, 0.008), o.get("color", "1c1d20"))
    g.glow_hex = (o.get("glow") or "cfe6ff").lstrip("#")
    g.idle = float(o.get("idle", 0.5))


@gadget("handheld_scanner", "hand_R")
def g_handscan(g):
    """Handheld scanner with a green screen and an antenna stub: in the hand, or clipped at the vest on a coiled
    cable (mount='vest')."""
    K, o = g.K, g.o
    k = K.k
    col = o.get("color", OLIVE)
    if o.get("mount") == "vest":
        g.bone = "chest"
        p, n = K.front(-0.08 * k, K.J["chest"].z + 0.01 * k, r=0.02)
        M = frame(p - n * 0.002, n, UP)
    else:
        h = hand_prop(g, opt_side(o, "R"))
        M = mat_axes(-h["across"], -h["axis"], h["palm"], h["grip"] + h["palm"] * 0.006)
    g.part(box(0.07 * k, 0.13 * k, 0.026, bev=0.007, M=M), col, 0.3)
    g.part(box(0.056 * k, 0.06 * k, 0.0015, M=local(M, 0, 0.022 * k, 0.026)), "1a1c1a", 0.6)
    g.light(box(0.046 * k, 0.05 * k, 0.0006, M=local(M, 0, 0.022 * k, 0.0275)))
    g.part(cyl(0.006, 0.05 * k, n=6, bev=0.001, M=rot(local(M, 0.022 * k, 0.065 * k, 0.013), "X", -math.pi / 2)), RUBBER, 0.3, smooth="auto")
    if o.get("mount") == "vest":
        coil = [M @ V((0.0, -0.065 * k, 0.012))]
        for i in range(1, 9):
            coil.append(M @ V((0.012 * math.sin(i * 1.9), -0.065 * k - 0.012 * i, 0.012 + 0.008 * math.cos(i * 1.9))))
        g.part(tube(coil, 0.003, n=4), BLACK, 0.4, smooth=True)
    g.glow_hex = (o.get("glow") or "b6ff8a").lstrip("#")
    g.idle = float(o.get("idle", 0.6))


@gadget("crank_lamp", "hips")
def g_crank(g):
    """Hand-crank lamp hanging at the back left hip (hand=True: carried in the hand)."""
    K, o = g.K, g.o
    k = K.k
    if o.get("hand"):
        h = hand_prop(g, opt_side(o, "L"))
        M = frame(h["grip"] + h["axis"] * 0.08 * k, -h["axis"], h["palm"])
    else:
        p, n = K.front(0.085 * k, K.belt_z - 0.02 * k, back=True, r=0.015)
        M = frame(p + n * 0.035 * k, V((0, 0, 1)), V((0, 1, 0)))
        M = local(M, 0, 0, -0.07 * k)
    col = o.get("color", "4a4a3a")
    g.part(cyl(0.035 * k, 0.07 * k, n=10, bev=0.006, M=M), col, 0.35, smooth="auto")
    g.part(cyl(0.03 * k, 0.006, n=10, M=local(M, 0, 0, 0.07 * k)), STEEL, 0.6, smooth="auto")
    g.light(cyl(0.028 * k, 0.04 * k, n=10, M=local(M, 0, 0, 0.076 * k)))
    g.part(cyl(0.033 * k, 0.008, n=10, bev=0.002, M=local(M, 0, 0, 0.116 * k)), col, 0.35, smooth="auto")
    hp = [M @ V((-0.03 * k, 0, 0.124 * k)), M @ V((0, 0, 0.16 * k)), M @ V((0.03 * k, 0, 0.124 * k))]
    g.part(tube(hp, 0.0025, n=4), STEEL, 0.6, smooth=True)
    g.part(box(0.006, 0.04 * k, 0.006, M=local(rot(M, "Y", math.pi / 2), -0.035 * k, 0.0, 0.035 * k)), STEEL, 0.6)
    g.glow_hex = (o.get("glow") or "ffd9a0").lstrip("#")
    g.idle = float(o.get("idle", 0.2))


@gadget("led_umbrella", "hand_R")
def g_umbrella(g):
    """LED-rim umbrella (hand prop): open over the head on a shaft from the fist (closed=True: a furled cane
    umbrella to the floor). 2026: a plain compact umbrella without the light."""
    K, o = g.K, g.o
    k = K.k
    sd = opt_side(o, "R")
    h = K.hand(sd)
    col = o.get("color", "1d2430")
    led = o.get("led", K.era == "2049")
    if o.get("closed"):
        below = h["grip"].z * 0.97
        p0, p1, ax, _ = stick(g, sd, below, 0.03 * k, 0.008 * k, GRAPH, gloss=0.6)
        fm = frame(p0 - ax * 0.12 * k, -ax, UP)
        g.part(lathe([(0.0, 0.0), (0.012 * k, 0.04 * k), (0.022 * k, 0.25 * k), (0.016 * k, 0.5 * k), (0.009 * k, 0.6 * k)], n=8, M=rot(fm, "X", math.pi)), col, 0.3, smooth=True)
        hook = [p1, p1 - ax * 0.04 * k + h["palm"] * 0.02, p1 - ax * 0.05 * k + h["palm"] * 0.05, p1 - ax * 0.03 * k + h["palm"] * 0.07]
        g.part(tube(hook, 0.011 * k, n=6), BLACK, 0.4, smooth=True)
        if led:
            g.light(torus(0.0125 * k, 0.0015, n=8, m=3, M=frame(p0 - ax * 0.69 * k, ax, UP)), smooth=True)
        g.glow_hex = (o.get("glow") or "8ad8ff").lstrip("#")
        g.idle = float(o.get("idle", 0.6 if led else 0.0))
        return
    hand_prop(g, sd)
    ax = h["axis"]
    up_dir = -ax
    kid = K.B.H < 1.45
    L = 0.85 * k if not kid else 0.72         # a child's umbrella is small, but its shaft still clears her head
    R = 0.5 * k if not kid else 0.36
    c = h["grip"]
    top = c + up_dir * L
    g.part(tube([c + ax * 0.06 * k, top + up_dir * 0.03], 0.0065 * k, n=6), GRAPH, 0.6, smooth=True)
    g.part(cyl(0.014 * k, 0.11 * k, n=8, bev=0.003, M=frame(c + ax * 0.06 * k, up_dir, UP)), BLACK, 0.3, smooth="auto")
    Mt = frame(top, up_dir, V((0, -1, 0)))
    nr = 16 if K.lod else 12
    rings = [(R, -0.16 * R), (R * 0.82, 0.04 * R), (R * 0.45, 0.2 * R), (0.0, 0.26 * R)]
    verts, faces = [], []
    for ri, (rr, z) in enumerate(rings):
        if rr == 0:
            verts.append((0.0, 0.0, z))
        else:
            for i in range(nr):
                t = 2 * math.pi * i / nr
                sag = 0.03 * R * (1 - math.cos(nr / 2 * t)) * 0.5 if ri < 2 else 0.0
                verts.append((rr * math.cos(t), rr * math.sin(t), z - sag))
    for ri in range(len(rings) - 2):
        a, b = ri * nr, (ri + 1) * nr
        faces += [[a + i, a + (i + 1) % nr, b + (i + 1) % nr, b + i] for i in range(nr)]
    pole = len(verts) - 1
    a = (len(rings) - 2) * nr
    faces += [[a + i, a + (i + 1) % nr, pole] for i in range(nr)]
    nv = len(verts)
    verts += [(x, y, z - 0.004) for (x, y, z) in verts]
    faces += [[nv + i for i in f[::-1]] for f in faces[:]]
    faces += [[i, nv + i, nv + (i + 1) % nr, (i + 1) % nr] for i in range(nr)]
    g.part((_xf(verts, Mt), faces), col, 0.35, smooth=True)
    if led:
        rim = [Mt @ V((R * 1.002 * math.cos(2 * math.pi * i / nr), R * 1.002 * math.sin(2 * math.pi * i / nr), -0.16 * R - 0.002)) for i in range(nr)]
        g.light(tube(rim + [rim[0]], 0.0035, n=4, caps=False), smooth=True)
    g.glow_hex = (o.get("glow") or "8ad8ff").lstrip("#")
    g.idle = float(o.get("idle", 0.7 if led else 0.0))


# ----------------------------------------------------------------------------------------------------------------
# build: run the catalogue, register the palette, make the objects
# ----------------------------------------------------------------------------------------------------------------
def parse(item):
    if isinstance(item, str):
        return item, {}
    if len(item) == 1:
        return item[0], {}
    return item[0], dict(item[1] or {})


def build(c, B, cov, objs):
    """Build every gadget of `c["gear"]` against the dressed body `objs` (layer objects + extras, weights in WSTORE).
    Returns dict(body=[objects to join], glow=[gx_ objects], props=[gp_ objects], meta=[...], tris=int)."""
    gear = c.get("gear") or []
    if not gear:
        return None
    K = Kit(c, B, cov, objs)
    for item in gear:
        name, o = parse(item)
        typ = name.split(":", 1)[-1]
        if typ not in CAT:
            raise ValueError("unknown gadget %r (%s)" % (name, c["id"]))
        if not era_ok(typ, K.era):
            raise ValueError("gadget %s does not belong in era %s (%s)" % (typ, K.era, c["id"]))
        fn, bone = CAT[typ]
        g = Gad(K, typ, bone, o)
        fn(g)
        K.add(g)
    return finish(K)


def finish(K):
    import costume
    c = K.c
    # ---- palette: every body colour (and baked glow colours for crowds) gets a flat swatch in the aux region ----
    sw = {}
    for g in K.gads:
        for col in g.body.col:
            sw.setdefault((col, 0.0), len(sw))
        if K.bake and g.glow.f:
            sw.setdefault((g.glow_hex, round(g.idle if g.idle > 0 else 0.12, 3)), len(sw))
    cols = 8
    rows = max(1, int(math.ceil(len(sw) / cols)))
    cell = 0.035
    pid = costume.aux_piece("gpal", cols * cell, rows * cell, None, dict(palette=[(k_[0], k_[1]) for k_ in sorted(sw, key=sw.get)], cols=cols, rows=rows))

    def swatch_uv(key, a, b):
        i = sw[key]
        cx, cy = i % cols, i // cols
        u = (cx + 0.35 + 0.3 * a) / cols
        v = 1 - (cy + 0.35 + 0.3 * b) / rows
        return costume.aux_uv(pid, u, v)
    out = dict(body=[], glow=[], props=[], meta=[], tris=0)
    glow_mats = {}
    for g in K.gads:
        body = g.body
        if K.bake and g.glow.f:
            lvl = round(g.idle if g.idle > 0 else 0.12, 3)
            gl = g.glow
            o_ = len(body.v)
            body.v += gl.v
            body.f += [[i + o_ for i in f] for f in gl.f]
            body.col += [("@", g.glow_hex, lvl)] * len(gl.f)
            body.gl += [0.9] * len(gl.f)
            body.sm += gl.sm
            body.wt += gl.wt
            body.seg += gl.seg
            g.glow = Geo()
        pre = "gp_" if g.prop else "gadget_"
        if body.f:
            ob = make_obj(K, pre + g.typ, body, g, lambda col, a, b: swatch_uv((col[1], col[2]) if isinstance(col, tuple) else (col, 0.0), a, b))
            if g.prop:
                ob["gadget"] = g.typ
                ob["prop"] = g.prop
                out["props"].append(ob)
            else:
                out["body"].append(ob)
            out["tris"] += body.tris()
        node = None
        if g.glow.f:
            og = make_obj(K, "gx_" + g.typ, g.glow, g, None)
            og["gadget"] = g.typ
            og["slot"] = "glow"
            og["idle"] = float(g.idle)
            og["segs"] = int(g.segs)
            og["seg_mode"] = g.seg_mode
            og["bone"] = g.bone
            if g.prop:
                og["prop"] = g.prop
            hx = g.glow_hex
            if hx not in glow_mats:
                glow_mats[hx] = glow_material(c, hx)
            og.data.materials.clear()
            og.data.materials.append(glow_mats[hx])
            out["glow"].append(og)
            out["tris"] += g.glow.tris()
            node = og.name
        out["meta"].append(dict(type=g.typ, bone=g.bone, glow=bool(node) or (K.bake and any(isinstance(cc, tuple) for cc in body.col)),
                                idle=float(g.idle), segs=int(g.segs), seg_mode=g.seg_mode, prop=g.prop or "", node=node or "",
                                color=g.glow_hex, baked=bool(K.bake)))
    print("  gadgets", len(K.gads), "->", out["tris"], "tris", "(baked glow)" if K.bake else "(%d glow meshes)" % len(out["glow"]),
          " ".join("%s=%d" % (g.typ, g.body.tris() + g.glow.tris()) for g in K.gads), flush=True)
    return out


def make_obj(K, name, geo, g, uvf):
    """Blender object from a Geo: uvs (palette swatches or a 0..1 box projection for glow), shading mask (gloss),
    smoothing, weights (rigid bone, or 'soft': the weights of the cloth under it), `_gseg` for glow."""
    me_o = BH.mesh_from(name, geo.v, geo.f, None)
    me = me_o.data
    for p, sm in zip(me.polygons, geo.sm):
        p.use_smooth = bool(sm)
    P = np.array(geo.v)
    li = np.array([l.vertex_index for l in me.loops])
    lo, hi = P.min(0), P.max(0)
    span = np.maximum(hi - lo, 1e-6)
    ax = np.argsort(-span)[:2]
    a = (P[li, ax[0]] - lo[ax[0]]) / span[ax[0]]
    b = (P[li, ax[1]] - lo[ax[1]]) / span[ax[1]]
    uv = np.stack([a, b], 1)
    if uvf is not None:
        for p, col in zip(me.polygons, geo.col):
            for l in p.loop_indices:
                uv[l] = uvf(col, a[l], b[l])
    uvl = me.uv_layers.new(name="UVMap")
    uvl.data.foreach_set("uv", uv.astype(np.float32).ravel())
    gl = np.zeros(len(geo.v))
    for f, gv in zip(geo.f, geo.gl):
        gl[f] = gv
    BH.set_mask(me_o, np.stack([np.zeros_like(gl), gl, np.zeros_like(gl)], 1))
    if uvf is None:
        at = me.attributes.new("_gseg", "FLOAT", "POINT")
        at.data.foreach_set("value", np.asarray(geo.seg, dtype=np.float32))
    W = np.zeros((len(geo.v), len(BH.BONE_NAMES)))
    soft = [i for i, w in enumerate(geo.wt) if w == "soft"]
    for i, w in enumerate(geo.wt):
        if w != "soft":
            W[i, BH.BI[w or g.bone]] = 1.0
    if soft:
        W[soft] = K.soft_weights(P[soft])
    BH.WSTORE[me_o.name] = W
    return me_o


def glow_material(c, hx):
    import bpy
    m = bpy.data.materials.new("%s_glow_%s" % (c["id"], hx))
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    lc = BH.lin(hexc(hx))
    bsdf.inputs["Base Color"].default_value = (*(lc * 0.05 + 0.012), 1.0)
    bsdf.inputs["Roughness"].default_value = 0.28
    bsdf.inputs["Emission Color"].default_value = (*lc, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 1.0
    m["slot"] = "glow"
    m["glow"] = hx
    return m


def paint_palette(pc, img, mask, himg, gimg, spx, res, seed):
    """Flat swatches of the gadget palette (glow swatches: emissive at their level)."""
    x0, y0, w, h = pc["rect"]
    fl = pc["flags"]
    cols, rows = fl["cols"], fl["rows"]
    rng = np.random.default_rng(int(seed * 100) + 5)
    for i, (hx, lvl) in enumerate(fl["palette"]):
        cx, cy = i % cols, i // cols
        u0, u1 = x0 + w * cx / cols, x0 + w * (cx + 1) / cols
        v1, v0 = y0 + h * (1 - cy / rows), y0 + h * (1 - (cy + 1) / rows)
        px0, px1 = int(math.floor(u0 * res)), int(math.ceil(u1 * res))
        py0, py1 = int(math.floor((1 - v1) * res)), int(math.ceil((1 - v0) * res))
        px0, py0 = max(px0, 0), max(py0, 0)
        px1, py1 = min(px1, res), min(py1, res)
        if px1 <= px0 or py1 <= py0:
            continue
        col = hexc(hx)
        if lvl > 0:
            base = col * 0.35 + 0.05
            img[py0:py1, px0:px1] = np.clip(base, 0, 1)
            gimg[py0:py1, px0:px1] = col * lvl
        else:
            n = rng.normal(0, 0.008, (py1 - py0, px1 - px0, 1))
            img[py0:py1, px0:px1] = np.clip(col[None, None, :] * (1 + n), 0, 1)
        mask[py0:py1, px0:px1] = True
        himg[py0:py1, px0:px1] = 0.0
        spx[py0:py1, px0:px1] = 0.004


def armature_meta(arm, meta):
    arm["gadgets"] = json.dumps(meta, separators=(",", ":"))
