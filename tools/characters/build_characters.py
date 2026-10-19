"""AFTERZERO character generator (Blender as a Python module).

Builds the whole cast from parameters — no external models: anatomy from a skin-modifier skeleton graph, a sculpted
head, hair, clothing and accessories, an original rig, and hand-authored (procedural keyframe) animations.

    python -m venv venv && venv/bin/pip install bpy==5.2.2
    venv/bin/python build_characters.py ../../assets/models

Outputs  cast.glb  (every character, skinned, no animation) and  anims.glb  (reference rig + all clips).
Character specs live in cast.py; this file is the machinery.
"""
import bpy, bmesh, math, os, random, sys
from mathutils import Vector, Matrix, Quaternion

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cast import CAST, REF  # noqa: E402

V = Vector
ARM_ANGLE = math.radians(52)  # A-pose: upper arm angle from vertical (constant so every rig shares rest orientations)


# ----------------------------------------------------------------------------------------------------------------
# scene helpers
# ----------------------------------------------------------------------------------------------------------------
def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def apply_modifiers(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    bpy.data.meshes.remove(old)


def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def rng_for(key):
    return random.Random(hash(key) & 0xFFFFFFFF)


def noise3(p, seed=0):
    """Cheap smooth value noise (deterministic) for vertex-colour detail."""
    x, y, z = p.x * 7.1 + seed, p.y * 7.3, p.z * 7.7
    return (math.sin(x * 1.7 + math.sin(y * 2.3)) + math.sin(y * 1.9 + math.sin(z * 2.9)) + math.sin(z * 2.1 + math.sin(x * 3.1))) / 6 + 0.5


# ----------------------------------------------------------------------------------------------------------------
# proportions -> joints
# ----------------------------------------------------------------------------------------------------------------
def joints(c):
    """Joint positions for a spec. Directions of every bone are constant; only lengths/positions scale."""
    H, fem, b = c["height"], c.get("fem", 0.0), c.get("build", 1.0)
    child = c.get("child", 0.0)
    J = {}
    J["ground"] = V((0, 0, 0))
    J["pelvis"] = V((0, 0, 0.555 * H))
    J["spine"] = V((0, 0, 0.625 * H))
    J["chest"] = V((0, 0, 0.705 * H))
    J["neck"] = V((0, 0, 0.83 * H - child * 0.03 * H))
    J["head"] = V((0, 0, 0.87 * H - child * 0.04 * H))
    J["headTop"] = V((0, 0, H))
    sw = (0.104 - 0.012 * fem) * H * (0.9 + 0.1 * b)
    for s, k in ((1, "L"), (-1, "R")):
        J["clav_" + k] = V((s * 0.018 * H, 0, 0.805 * H))
        J["shoulder_" + k] = V((s * sw, 0, 0.805 * H))
        d = V((s * math.sin(ARM_ANGLE), 0, -math.cos(ARM_ANGLE)))
        J["elbow_" + k] = J["shoulder_" + k] + d * (0.172 * H)
        J["wrist_" + k] = J["elbow_" + k] + d * (0.152 * H)
        J["handEnd_" + k] = J["wrist_" + k] + d * (0.104 * H)
        hx = s * (0.052 + 0.006 * fem) * H * (0.92 + 0.08 * b)
        J["hip_" + k] = V((hx, 0, 0.525 * H))
        J["knee_" + k] = V((hx, 0, 0.285 * H))
        J["ankle_" + k] = V((hx, 0, 0.045 * H))
        J["ball_" + k] = V((hx, -0.095 * H, 0.012 * H))
        J["toe_" + k] = V((hx, -0.14 * H, 0.012 * H))
    return J


BONES = [  # name, head joint, tail joint, parent
    ("hips", "pelvis", "spine", None), ("spine", "spine", "chest", "hips"), ("chest", "chest", "neck", "spine"),
    ("neck", "neck", "head", "chest"), ("head", "head", "headTop", "neck"),
]
for k in "LR":
    BONES += [
        ("clavicle_" + k, "clav_" + k, "shoulder_" + k, "chest"), ("upperarm_" + k, "shoulder_" + k, "elbow_" + k, "clavicle_" + k),
        ("forearm_" + k, "elbow_" + k, "wrist_" + k, "upperarm_" + k), ("hand_" + k, "wrist_" + k, "handEnd_" + k, "forearm_" + k),
        ("thigh_" + k, "hip_" + k, "knee_" + k, "hips"), ("shin_" + k, "knee_" + k, "ankle_" + k, "thigh_" + k),
        ("foot_" + k, "ankle_" + k, "ball_" + k, "shin_" + k), ("toe_" + k, "ball_" + k, "toe_" + k, "foot_" + k),
    ]


def build_armature(name, J):
    arm = bpy.data.armatures.new(name + "_rig")
    obj = link(bpy.data.objects.new(name, arm))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    eb = {}
    for bn, h, t, par in BONES:
        b = arm.edit_bones.new(bn)
        b.head, b.tail = J[h], J[t]
        if J[t].z < J[h].z - 1e-4 or abs(J[t].z - J[h].z) < 1e-4:
            b.roll = 0
        b.align_roll(V((0, -1, 0)) if abs((J[t] - J[h]).normalized().y) < 0.9 else V((0, 0, 1)))
        if par:
            b.parent = eb[par]
        eb[bn] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


# ----------------------------------------------------------------------------------------------------------------
# body (skin modifier graph). Every edge carries a region tag -> material + vertex colour.
# ----------------------------------------------------------------------------------------------------------------
class Graph:
    def __init__(self):
        self.v, self.r, self.e = [], [], []

    def add(self, p, rx, ry=None):
        self.v.append(V(p))
        self.r.append((rx, ry if ry is not None else rx))
        return len(self.v) - 1

    def edge(self, a, b, tag):
        self.e.append((a, b, tag))


def skin_object(name, g, subdiv=2):
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in g.v]
    for a, b, _ in g.e:
        bm.edges.new((vs[a], vs[b]))
    obj = mesh_obj(name, bm)
    mod = obj.modifiers.new("skin", "SKIN")
    mod.use_smooth_shade = True
    mod.branch_smoothing = 0.6
    sv = obj.data.skin_vertices[0].data
    for i, r in enumerate(g.r):
        sv[i].radius = r
        sv[i].use_root = i == 0
    obj.modifiers.new("sub", "SUBSURF").levels = subdiv
    apply_modifiers(obj)
    smooth(obj)
    return obj


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (a + ab * t - p).length, t


def tag_vertices(obj, g):
    """Region tag per vertex = tag of the nearest graph edge (scaled by that edge's radius)."""
    tags = []
    for v in obj.data.vertices:
        best, bt, bu = 1e9, None, 0
        for a, b, tag in g.e:
            d, t = seg_dist(v.co, g.v[a], g.v[b])
            r = g.r[a][0] * (1 - t) + g.r[b][0] * t
            s = d - r
            if s < best:
                best, bt, bu = s, tag, t
        tags.append((bt, bu))
    return tags


def body_graph(c, J):
    """Clothed body. Radii already include clothing thickness for covered regions."""
    H, fem, b = c["height"], c.get("fem", 0.0), c.get("build", 1.0)
    top, bottom = c.get("top", "jacket"), c.get("bottom", "trousers")
    thick = {"coat": 0.010, "robe": 0.012, "jacket": 0.006, "dress": 0.004, "sweater": 0.007, "uniform": 0.006, "vest": 0.004, "shirt": 0.003}.get(top, 0.005) * H
    w = b * (0.96 + 0.04 * (1 - fem))
    g = Graph()
    torso_tag = "top"
    # spine column (front is -Y; a slight forward chest / back curve)
    p_low = g.add((0, 0.004 * H, 0.505 * H), (0.088 + 0.012 * fem) * H * w + thick * 0.5, (0.058 + 0.006 * fem) * H * w + thick * 0.5)
    p_pel = g.add((0, 0.002 * H, 0.56 * H), (0.093 + 0.012 * fem) * H * w + thick, (0.060 + 0.004 * fem) * H * w + thick)
    p_wai = g.add((0, 0.0, 0.625 * H), (0.080 - 0.008 * fem) * H * w + thick, (0.056 - 0.002 * fem) * H * w + thick)
    p_che = g.add((0, -0.004 * H, 0.70 * H), (0.093 - 0.004 * fem) * H * w + thick, (0.062 + 0.010 * fem) * H * w + thick)
    p_up = g.add((0, -0.002 * H, 0.765 * H), (0.100 - 0.008 * fem) * H * w + thick, (0.058 + 0.002 * fem) * H * w + thick)
    p_sh = g.add((0, 0.004 * H, 0.805 * H), (0.070 - 0.006 * fem) * H * w + thick, (0.046) * H * w + thick)
    p_nb = g.add((0, 0.006 * H, 0.835 * H), 0.030 * H * (0.9 + 0.1 * b) + (thick if top in ("robe", "uniform") else 0))
    p_nt = g.add((0, 0.004 * H, 0.885 * H), 0.027 * H * (0.9 + 0.1 * b))
    g.edge(p_low, p_pel, "bottom" if bottom == "trousers" else torso_tag)
    g.edge(p_pel, p_wai, torso_tag)
    g.edge(p_wai, p_che, torso_tag)
    g.edge(p_che, p_up, torso_tag)
    g.edge(p_up, p_sh, torso_tag)
    g.edge(p_sh, p_nb, "collar" if top in ("robe", "uniform", "coat") else "neck")
    g.edge(p_nb, p_nt, "neck")
    sleeve = c.get("sleeve", "long")
    for s, k in ((1, "L"), (-1, "R")):
        d = V((s * math.sin(ARM_ANGLE), 0, -math.cos(ARM_ANGLE)))
        sh = J["shoulder_" + k]
        a0 = g.add(sh + V((-s * 0.012 * H, 0.002 * H, -0.004 * H)), (0.040 - 0.004 * fem) * H * w + thick)
        a1 = g.add(sh + d * (0.09 * H), (0.034 - 0.004 * fem) * H * w + thick)
        el = g.add(J["elbow_" + k], 0.027 * H * w + thick)
        f1 = g.add(J["elbow_" + k] + d * (0.07 * H), 0.027 * H * w + thick * 0.8)
        wr = g.add(J["wrist_" + k] - d * (0.008 * H), 0.019 * H * (0.9 + 0.1 * b) + thick * 0.6)
        hw = g.add(J["wrist_" + k] + d * (0.012 * H), 0.017 * H)
        pa = g.add(J["wrist_" + k] + d * (0.048 * H), 0.024 * H, 0.011 * H)
        g.edge(p_up, a0, torso_tag)
        g.edge(a0, a1, "sleeve")
        g.edge(a1, el, "sleeve")
        g.edge(el, f1, "sleeve" if sleeve != "short" else "skin")
        g.edge(f1, wr, "cuff" if sleeve == "long" else "skin")
        g.edge(wr, hw, "skin")
        g.edge(hw, pa, "skin")
        # fingers + thumb (slightly curled forward)
        fwd = V((0, -1, 0))
        side = V((0, 0, 1)).cross(d).normalized() * (1 if s > 0 else -1)
        for i in range(4):
            o = (i - 1.5) * 0.0105 * H
            f0 = g.add(J["wrist_" + k] + d * (0.066 * H) + fwd * (o), 0.0062 * H)
            ft = g.add(J["wrist_" + k] + d * ((0.104 - abs(i - 1.5) * 0.008) * H) + fwd * (o * 1.1 - 0.008 * H), 0.0052 * H)
            g.edge(pa, f0, "skin")
            g.edge(f0, ft, "skin")
        t0 = g.add(J["wrist_" + k] + d * (0.03 * H) + fwd * (-0.022 * H), 0.0075 * H)
        t1 = g.add(J["wrist_" + k] + d * (0.058 * H) + fwd * (-0.034 * H), 0.006 * H)
        g.edge(hw, t0, "skin")
        g.edge(t0, t1, "skin")
        _ = side
        # legs
        hip = J["hip_" + k]
        leg_t = "bottom"
        th = (0.006 if bottom == "trousers" else 0.0) * H
        skirted = bottom in ("skirt", "longskirt") or top in ("coat", "robe", "dress")
        lw = w * (0.62 if skirted else 1.0)   # legs hidden under a skirt are slimmer so a stride never pokes through
        l0 = g.add(hip + V((0, 0.002 * H, 0.0)), (0.064 + 0.008 * fem) * H * lw + th)
        l1 = g.add(hip + V((0, -0.002 * H, -0.11 * H)), (0.052 + 0.004 * fem) * H * lw + th)
        kn = g.add(J["knee_" + k], 0.036 * H * w + th)
        c1 = g.add(J["knee_" + k] + V((0, 0.006 * H, -0.08 * H)), 0.037 * H * w + th)
        boot_top = c.get("boots", 0.12)  # boot shaft height as fraction of H
        bt = g.add(V((hip.x, 0.002 * H, (0.045 + boot_top) * H)), 0.028 * H * w + th + 0.002 * H)
        an = g.add(J["ankle_" + k] + V((0, 0, 0.012 * H)), 0.024 * H)
        g.edge(p_low, l0, leg_t)
        g.edge(l0, l1, leg_t)
        g.edge(l1, kn, leg_t)
        g.edge(kn, c1, leg_t)
        g.edge(c1, bt, leg_t)
        g.edge(bt, an, "shoe")

    return g


# ----------------------------------------------------------------------------------------------------------------
# head
# ----------------------------------------------------------------------------------------------------------------
def gauss(x, s):
    return math.exp(-(x * x) / (2 * s * s))


def head_object(c, J):
    H, fem = c["height"], c.get("fem", 0.0)
    child = c.get("child", 0.0)
    hs = (0.0635 + 0.008 * child) * H * c.get("headScale", 1.0) * (1.0 - 0.03 * fem)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=56, v_segments=40, radius=1.0)
    face = c.get("face", {})
    jaw = face.get("jaw", 0.5 - 0.3 * fem)
    nose = face.get("nose", 0.5)
    cheek = face.get("cheek", 0.5)
    brow = face.get("brow", 0.5 - 0.3 * fem)
    for v in bm.verts:
        x, y, z = v.co  # front = -y
        fr = max(0.0, -y)
        # base proportions: taller than wide, deeper at the back
        sx, sy, sz = 0.86, 0.98 if y < 0 else 1.05, 1.12
        # jaw / chin taper
        if z < 0.05:
            t = (0.05 - z) / 1.05
            sx *= 1.0 - (0.22 + 0.12 * (1 - jaw)) * t * t * 1.1
            sy *= 1.0 - 0.18 * t * (y > 0)
        nx, ny, nz = x * sx, y * sy, z * sz
        # forehead slightly flatter, cranium fuller
        if z > 0.3 and y < 0:
            ny *= 0.97
        # chin point
        ny -= 0.035 * gauss(x, 0.32) * gauss(z + 0.88, 0.2) * fr
        # brow ridge
        ny -= (0.025 + 0.03 * brow) * gauss(z - 0.26, 0.09) * gauss(x, 0.55) * fr
        # eye sockets
        for ex in (-0.36, 0.36):
            ny += 0.07 * gauss(x - ex, 0.13) * gauss(z - 0.12, 0.09) * fr
        # cheekbones
        nx += math.copysign(0.035 + 0.04 * cheek, x) * gauss(z + 0.02, 0.14) * gauss(abs(x) - 0.62, 0.18)
        # nose: bridge + tip + nostrils
        n_len = 0.13 + 0.08 * nose
        ny -= n_len * gauss(x, 0.07 + 0.02 * nose) * (gauss(z + 0.19, 0.09) + 0.55 * gauss(z - 0.02, 0.13)) * fr
        ny -= 0.05 * gauss(abs(x) - 0.12, 0.05) * gauss(z + 0.26, 0.05) * fr        # nostril wings
        nx += math.copysign(0.03, x) * gauss(abs(x) - 0.12, 0.05) * gauss(z + 0.26, 0.05) * fr
        ny += 0.025 * gauss(abs(x) - 0.3, 0.07) * gauss(z + 0.33, 0.09) * fr        # nasolabial softness
        # mouth: soft lips, groove under the nose
        ny -= (0.04 + 0.015 * fem) * gauss(x, 0.2) * gauss(z + 0.43, 0.04) * fr      # upper lip
        ny += 0.02 * gauss(x, 0.24) * gauss(z + 0.485, 0.012) * fr                   # mouth line
        ny -= (0.035 + 0.015 * fem) * gauss(x, 0.17) * gauss(z + 0.53, 0.04) * fr      # lower lip
        ny += 0.02 * gauss(x, 0.2) * gauss(z + 0.62, 0.035) * fr                     # chin dimple
        v.co = V((nx * hs, ny * hs, nz * hs))
    obj = mesh_obj("head", bm)
    smooth(obj)
    obj.location = J["head"] + V((0, -0.005 * H, 0.47 * hs * 1.12 * 0.92))
    # ears
    ears = []
    for s in (1, -1):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=10, radius=1.0)
        for v in bm.verts:
            v.co = V((v.co.x * 0.16 * hs, v.co.y * 0.28 * hs, v.co.z * 0.42 * hs))
        e = mesh_obj("ear", bm)
        smooth(e)
        e.location = obj.location + V((s * 0.80 * hs, 0.06 * hs, 0.02 * hs))
        e.rotation_euler = (0, s * 0.12, 0)
        ears.append(e)
    return obj, hs, ears


def eye_objects(c, head, hs):
    out = []
    iris = c.get("eyes", (0.28, 0.2, 0.12))
    for s in (1, -1):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=0.115 * hs)
        e = mesh_obj("eye", bm)
        smooth(e)
        e.location = head.location + V((s * 0.36 * 0.82 * hs, -0.84 * hs, 0.12 * 1.12 * hs))
        col = e.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        for i, v in enumerate(e.data.vertices):
            f = -v.co.normalized().y
            c4 = (0.9, 0.88, 0.85, 1)
            if f > 0.86:
                c4 = (*iris, 1)
            if f > 0.96:
                c4 = (0.02, 0.02, 0.02, 1)
            col.data[i].color = c4
        e["mat"] = "eyes"
        out.append(e)
        # eyelids: skin shells over the top ~40% and bottom ~15% of the eyeball
        for lo, hi, name in ((0.36, 1.01, "lidU"), (-1.01, -0.66, "lidL")):
            lid = shell(name, e.location.copy(), 0.13 * hs, 0.13 * hs, 0.13 * hs, lambda p, lo=lo, hi=hi: lo < p.z < hi and p.y < 0.35, seg=(18, 14))
            lid["mat"] = "skin"
            solid_color(lid, (0.95, 0.9, 0.88))
            if name == "lidU":
                ca = lid.data.color_attributes["Col"]
                zs = [v.co.z for v in lid.data.vertices]
                zmin = min(zs)
                for i, v in enumerate(lid.data.vertices):
                    if v.co.z < zmin + 0.035 * hs:
                        ca.data[i].color = (0.12, 0.08, 0.07, 1)
            out.append(lid)
    return out


# ----------------------------------------------------------------------------------------------------------------
# hair / hats / accessories (shells around the head or body)
# ----------------------------------------------------------------------------------------------------------------
def shell(name, center, rx, ry, rz, keep, seg=(32, 20), push=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1.0)
    kill = [f for f in bm.faces if not keep(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    for v in bm.verts:
        p = v.co.copy()
        if push:
            p = push(p)
        v.co = V((p.x * rx, p.y * ry, p.z * rz))
    o = mesh_obj(name, bm)
    o.modifiers.new("solid", "SOLIDIFY").thickness = 0.004
    apply_modifiers(o)
    smooth(o)
    o.location = center
    return o


def hair_objects(c, head, hs):
    style = c.get("hair", "short")
    if c.get("hat") in ("hood", "headscarf") and style != "long":
        style = "none"
    out = []
    hc = head.location
    if style == "none":
        return out

    def hairline(p, front_z=0.34, side_z=-0.05, back_z=-0.55):
        if p.y < -0.3:   # front
            return p.z > front_z - 0.15 * abs(p.x)
        if p.y < 0.35:   # sides (leave the ears)
            return p.z > side_z + (0.25 if abs(p.x) > 0.7 and p.z < 0.25 else 0)
        return p.z > back_z

    bump = lambda p: p * (1.0 + 0.03 * math.sin(p.x * 18) * math.sin(p.z * 9))
    if style in ("short", "crop", "bob", "long", "bun", "braid", "pony", "swept"):
        fz = {"crop": 0.5, "swept": 0.52, "short": 0.46}.get(style, 0.44)
        sz = {"crop": 0.15, "bob": -0.55, "long": -0.6}.get(style, -0.05)
        bz = {"crop": -0.45, "bob": -0.95, "long": -1.0}.get(style, -0.62)
        thick = 1.07 if style == "crop" else 1.12
        o = shell("hair", hc, 0.86 * hs * thick, 1.03 * hs * thick, 1.12 * hs * thick,
                  lambda p: hairline(p, fz, sz, bz), push=bump, seg=(56, 40))
        out.append(o)
    if style == "swept":
        o = shell("hair_top", hc + V((0, -0.2 * hs, 0.75 * hs)), 0.62 * hs, 0.55 * hs, 0.32 * hs, lambda p: p.z > -0.2)
        out.append(o)
    if style == "long":
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=False, segments=20, radius1=0.95, radius2=0.78, depth=1.0)
        kill = [f for f in bm.faces if f.calc_center_median().y < -0.25]
        bmesh.ops.delete(bm, geom=kill, context="FACES")
        for v in bm.verts:
            v.co = V((v.co.x * 0.86 * hs, v.co.y * 0.75 * hs + 0.45 * hs, v.co.z * 1.25 * hs - 1.05 * hs))
        o = mesh_obj("hair_long", bm)
        o.modifiers.new("solid", "SOLIDIFY").thickness = 0.006
        apply_modifiers(o)
        smooth(o)
        o.location = hc
        out.append(o)
    if style == "bun":
        o = shell("bun", hc + V((0, 0.72 * hs, 0.62 * hs)), 0.36 * hs, 0.34 * hs, 0.34 * hs, lambda p: True, seg=(16, 12))
        out.append(o)
    if style in ("braid", "pony"):
        for i in range(5 if style == "braid" else 4):
            r = (0.2 - i * 0.025) * hs
            o = shell("braid", hc + V((0, 1.02 * hs + i * 0.05 * hs, -0.25 * hs - i * 0.32 * hs)), r, r, r * 1.4, lambda p: True, seg=(10, 8))
            out.append(o)
    for o in out:
        o["mat"] = "hair"
        strands(o, c.get("hairColor", (0.08, 0.06, 0.05)), hs)
    return out


def strands(o, rgb, hs):
    """Vertex-colour striping that reads as combed strands + darker roots."""
    col = o.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for i, v in enumerate(o.data.vertices):
        a = math.atan2(v.co.x, v.co.y)
        k = 0.78 + 0.22 * (0.5 + 0.5 * math.sin(a * 40 + math.sin(v.co.z / hs * 6) * 2)) + 0.12 * noise3(v.co * (8 / hs))
        root = 0.85 if v.co.z < -0.2 * hs else 1.0
        col.data[i].color = (rgb[0] * k * root, rgb[1] * k * root, rgb[2] * k * root, 1)


def facial_hair(c, head, hs):
    out = []
    fh = c.get("facial", None)
    if not fh:
        return out
    hc = head.location
    if fh in ("beard", "fullbeard"):
        o = shell("beard", hc, 0.84 * hs, 1.03 * hs, 1.14 * hs,
                  lambda p: p.y < 0.25 and p.z < (-0.15 if fh == "fullbeard" else -0.35) and (p.y < -0.2 or p.z < -0.5))
        out.append(o)
    if fh in ("mustache", "beard", "fullbeard"):
        o = shell("mustache", hc + V((0, -0.93 * hs, -0.37 * hs)), 0.30 * hs, 0.09 * hs, 0.07 * hs, lambda p: True, seg=(12, 8))
        out.append(o)
    for o in out:
        o["mat"] = "hair"
    return out


def brows(c, head, hs):
    out = []
    thick = 0.022 + 0.012 * (1 - c.get("fem", 0.0))
    for sd in (1, -1):
        pts, rad = [], []
        for i in range(6):
            t = i / 5
            x = sd * (0.14 + 0.34 * t) * 0.86 * hs
            z = (0.30 + 0.05 * math.sin(math.pi * min(1, t * 1.3)) - 0.03 * t) * 1.12 * hs
            y = -(0.96 - 0.22 * t * t) * hs
            pts.append(head.location + V((x, y, z)))
            rad.append((thick * hs * (1.1 - 0.5 * t), 0.012 * hs))
        o = tube("brow", pts, rad, seg=6)
        o["mat"] = "hair"
        out.append(o)
    return out


def hat_objects(c, head, hs, H):
    hat = c.get("hat")
    out = []
    hc = head.location
    if not hat:
        return out
    if hat == "cap":  # courier / worker cap
        out.append(shell("cap", hc + V((0, 0.02 * hs, 0.1 * hs)), 1.0 * hs, 1.2 * hs, 1.12 * hs, lambda p: p.z > 0.2, seg=(40, 24)))
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=True, segments=20, radius=1.0)
        for v in bm.verts:
            v.co = V((v.co.x * 0.7 * hs, v.co.y * 0.5 * hs - 1.05 * hs, 0.0))
        o = mesh_obj("visor", bm)
        o.modifiers.new("solid", "SOLIDIFY").thickness = 0.006
        apply_modifiers(o)
        o.location = hc + V((0, 0, 0.36 * hs))
        o.rotation_euler = (-0.18, 0, 0)
        out.append(o)
    elif hat in ("fedora", "tophat", "warden"):
        h = {"fedora": 0.55, "tophat": 1.25, "warden": 0.6}[hat] * hs
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=28, radius1=0.84 * hs, radius2=(0.78 if hat == "tophat" else 0.62) * hs, depth=h)
        o = mesh_obj("crown", bm)
        o.location = hc + V((0, 0.02 * hs, 0.62 * hs + h / 2))
        smooth(o)
        out.append(o)
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=(1.35 if hat != "warden" else 0.95) * hs, radius2=(1.25 if hat != "warden" else 0.9) * hs, depth=0.04 * hs)
        o = mesh_obj("brim", bm)
        o.location = hc + V((0, -0.08 * hs if hat == "warden" else 0, 0.62 * hs))
        smooth(o)
        out.append(o)
        if hat == "warden":
            bm = bmesh.new()
            bmesh.ops.create_circle(bm, cap_ends=True, segments=20, radius=1.0)
            for v in bm.verts:
                v.co = V((v.co.x * 0.7 * hs, v.co.y * 0.5 * hs - 1.0 * hs, 0))
            o = mesh_obj("visor", bm)
            o.modifiers.new("solid", "SOLIDIFY").thickness = 0.005
            apply_modifiers(o)
            o.location = hc + V((0, 0, 0.6 * hs))
            o.rotation_euler = (0.2, 0, 0)
            out.append(o)
    elif hat in ("hood", "headscarf"):
        big = 1.32 if hat == "hood" else 1.16
        out.append(shell(hat, hc + V((0, 0.06 * hs, 0.02 * hs)), 0.84 * hs * big, 1.04 * hs * big, 1.14 * hs * big,
                         lambda p: (p.y > -0.55 or p.z > 0.55) and p.z > (-0.85 if hat == "hood" else -0.35)))
        if hat == "hood":  # drape over the shoulders
            bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=False, segments=24, radius1=2.05, radius2=1.0, depth=1.0)
            kill = [f for f in bm.faces if f.calc_center_median().y < -0.5]
            bmesh.ops.delete(bm, geom=kill, context="FACES")
            for v in bm.verts:
                v.co = V((v.co.x * 0.95 * hs, v.co.y * 0.8 * hs + 0.15 * hs, v.co.z * 1.1 * hs - 1.25 * hs))
            o = mesh_obj("drape", bm)
            o.modifiers.new("solid", "SOLIDIFY").thickness = 0.006
            apply_modifiers(o)
            smooth(o)
            o.location = hc
            out.append(o)
    for o in out:
        o["mat"] = c.get("hatMat", "trim")
        o["rigid"] = "head"
    return out


def tube(name, pts, radii, seg=16, closed_ends=False):
    """Lofted tube through points (used for skirts, coat tails, scarves, straps)."""
    bm = bmesh.new()
    rings = []
    for i, (p, r) in enumerate(zip(pts, radii)):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        up = V((0, 0, 1)) if abs(d.z) < 0.9 else V((0, 1, 0))
        a = d.cross(up).normalized()
        b2 = d.cross(a).normalized()
        rx, ry = r if isinstance(r, tuple) else (r, r)
        ring = []
        for k in range(seg):
            t = 2 * math.pi * k / seg
            ring.append(bm.verts.new(V(p) + a * math.cos(t) * rx + b2 * math.sin(t) * ry))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    o = mesh_obj(name, bm)
    bpy.context.view_layer.objects.active = o
    smooth(o)
    return o


def accessories(c, J, H):
    out = []
    fem = c.get("fem", 0.0)
    w = c.get("build", 1.0)
    acc = c.get("acc", [])
    skirt = c.get("bottom") in ("skirt", "longskirt") or c.get("top") in ("coat", "robe", "dress")
    if skirt:
        length = {"coat": 0.27, "robe": 0.45, "dress": 0.42}.get(c.get("top"), 0.0)
        if c.get("bottom") == "longskirt":
            length = max(length, 0.47)
        elif c.get("bottom") == "skirt":
            length = max(length, 0.30)
        length = c.get("skirtLen", length)
        top_z = 0.565 * H
        bot_z = max(0.06 * H, top_z - length * H)
        n = 6
        pts, rad = [], []
        for i in range(n):
            t = i / (n - 1)
            z = top_z + (bot_z - top_z) * t
            flare = 1 + t * (0.95 if c.get("top") != "robe" else 1.05)
            pts.append(V((0, 0.006 * H, z)))
            rad.append(((0.104 + 0.012 * fem) * H * w * flare, (0.074 + 0.006 * fem) * H * w * (1 + (flare - 1) * 1.35)))
        o = tube("skirt", pts, rad, seg=28)
        o.modifiers.new("solid", "SOLIDIFY").thickness = 0.005
        apply_modifiers(o)
        smooth(o)
        o["mat"] = "clothA" if c.get("top") in ("coat", "robe", "dress") and c.get("bottom") != "longskirt" else "clothB"
        o["tag"] = "skirt"
        out.append(o)
    if "scarf" in acc:
        pts = [V((0.0, 0.0, 0.0))]
        o = tube("scarf", [J["neck"] + V((0, 0.004 * H, 0.002 * H)), J["neck"] + V((0, 0.004 * H, 0.02 * H))],
                 [0.042 * H, 0.040 * H], seg=20)
        o["mat"] = "accent"
        o["rigid"] = "neck"
        out.append(o)
        tail = tube("scarf_tail", [J["neck"] + V((0.03 * H, -0.04 * H, -0.0)), J["chest"] + V((0.045 * H, -0.075 * H, -0.02 * H)), J["spine"] + V((0.05 * H, -0.07 * H, 0))],
                    [(0.024 * H, 0.006 * H)] * 3, seg=8)
        tail["mat"] = "accent"
        tail["rigid"] = "chest"
        out.append(tail)
        _ = pts
    if "satchel" in acc:
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co = V((v.co.x * 0.03 * H, v.co.y * 0.13 * H, v.co.z * 0.1 * H))
        o = mesh_obj("satchel", bm)
        o.location = V((-0.115 * H * w, -0.01 * H, 0.54 * H))
        o["mat"] = "trim"
        o["rigid"] = "hips"
        out.append(o)
        strap = tube("strap", [V((-0.1 * H, -0.0, 0.58 * H)), V((-0.03 * H, -0.075 * H, 0.70 * H)), V((0.06 * H, -0.06 * H, 0.79 * H)), V((0.07 * H, 0.04 * H, 0.80 * H)), V((-0.05 * H, 0.07 * H, 0.66 * H)), V((-0.1 * H, 0.01 * H, 0.58 * H))],
                     [(0.012 * H, 0.002 * H)] * 6, seg=6)
        strap["mat"] = "trim"
        strap["rigid"] = "chest"
        out.append(strap)
    if "belt" in acc or c.get("top") in ("robe", "uniform", "coat"):
        o = tube("belt", [V((0, 0.0, 0.615 * H)), V((0, 0, 0.632 * H))], [((0.088 - 0.006 * fem) * H * w + 0.012 * H, (0.062) * H * w + 0.011 * H)] * 2, seg=24)
        o["mat"] = "trim"
        o["rigid"] = "spine"
        out.append(o)
    if "apron" in acc:
        top_z, bot_z = 0.62 * H, 0.62 * H - 0.36 * H
        pts, rad = [], []
        for i in range(6):
            t = i / 5
            flare = 1 + max(0.0, (0.565 * H - (top_z + (bot_z - top_z) * t)) / (0.45 * H)) * 0.95 if skirt else 1.0
            pts.append(V((0, 0.006 * H, top_z + (bot_z - top_z) * t)))
            rad.append(((0.104 + 0.012 * fem) * H * w * flare + 0.006 * H, (0.074 + 0.006 * fem) * H * w * flare + 0.006 * H))
        o = tube("apron", pts, rad, seg=32)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        kill = [f for f in bm.faces if f.calc_center_median().y > -0.035 * H]
        bmesh.ops.delete(bm, geom=kill, context="FACES")
        bm.to_mesh(o.data)
        bm.free()
        o.modifiers.new("solid", "SOLIDIFY").thickness = 0.003
        apply_modifiers(o)
        smooth(o)
        o["mat"] = "accent"
        o["tag"] = "skirt"
        out.append(o)
    if "buttons" in acc or c.get("top") in ("coat", "uniform"):
        for i in range(5):
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.0075 * H)
            o = mesh_obj("button", bm)
            z = 0.78 * H - i * 0.042 * H
            o.location = V((0.022 * H if c.get("top") == "coat" else 0, -(0.068 if z > 0.68 * H else 0.064) * H * w - 0.012 * H, z))
            o["mat"] = "metal"
            o["rigid"] = "chest" if z > 0.69 * H else "spine"
            out.append(o)
    if "glasses" in acc:
        pass  # added in face pass (needs head)
    if "lapels" in acc:
        for s in (1, -1):
            bm = bmesh.new()
            bmesh.ops.create_grid(bm, x_segments=2, y_segments=4, size=1.0)
            for v in bm.verts:
                x, y = v.co.x, v.co.y
                v.co = V((s * (0.022 + 0.022 * (x + 1)) * H * (1 - 0.3 * (1 - y) / 2), -0.074 * H * w - 0.011 * H, 0.70 * H + (y + 1) * 0.055 * H))
            o = mesh_obj("lapel", bm)
            o.modifiers.new("solid", "SOLIDIFY").thickness = 0.004
            apply_modifiers(o)
            o["mat"] = "clothA"
            o["rigid"] = "chest"
            out.append(o)
    return out


def shoes(c, J, H):
    out = []
    w = c.get("build", 1.0)
    for k in "LR":
        an, ba, to = J["ankle_" + k], J["ball_" + k], J["toe_" + k]
        x = an.x
        pts = [V((x, 0.035 * H, 0.03 * H)), V((x, 0.02 * H, 0.042 * H)), V((x, -0.01 * H, 0.04 * H)), V((x, -0.05 * H, 0.032 * H)),
               V((x, ba.y, 0.024 * H)), V((x, to.y + 0.008 * H, 0.018 * H)), V((x, to.y - 0.004 * H, 0.016 * H))]
        rad = [(0.018, 0.012), (0.026, 0.028), (0.03, 0.03), (0.032, 0.022), (0.034, 0.018), (0.028, 0.013), (0.012, 0.008)]
        o = tube("shoe", pts, [(a * H * (0.95 + 0.05 * w), b2 * H) for a, b2 in rad], seg=14)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.holes_fill(bm, edges=bm.edges, sides=0)
        for v in bm.verts:   # flat sole
            v.co.z = max(v.co.z, 0.002 * H)
        bm.to_mesh(o.data)
        bm.free()
        o.modifiers.new("sub", "SUBSURF").levels = 1
        apply_modifiers(o)
        smooth(o)
        col = o.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        sc = c.get("shoeColor", c.get("trimColor", (0.06, 0.045, 0.035)))
        for i, v in enumerate(o.data.vertices):
            k2 = (0.35 if v.co.z < 0.008 * H else 1.0) * (0.85 + 0.3 * noise3(v.co * (60 / H)))
            col.data[i].color = (sc[0] * k2, sc[1] * k2, sc[2] * k2, 1)
        o["mat"] = "trim"
        o["rigid"] = "foot_" + k
        out.append(o)
    return out


def glasses(c, head, hs):
    if "glasses" not in c.get("acc", []):
        return []
    out = []
    for s in (1, -1):
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=False, segments=16, radius=0.17 * hs)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=V((0, 0, 0)), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
        o = mesh_obj("lens", bm)
        o.modifiers.new("skin", "SKIN")
        for d in o.data.skin_vertices[0].data:
            d.radius = (0.012 * hs, 0.012 * hs)
        apply_modifiers(o)
        o.location = head.location + V((s * 0.3 * hs, -1.0 * hs, 0.12 * hs))
        o["mat"] = "metal"
        o["rigid"] = "head"
        out.append(o)
    return out


def mask(c, head, hs):
    if "mask" not in c.get("acc", []):
        return []
    o = shell("mask", head.location + V((0, -0.05 * hs, 0)), 0.86 * hs, 1.06 * hs, 1.16 * hs, lambda p: p.y < -0.35 and p.z > -0.75 and p.z < 0.62, seg=(36, 24))
    o["mat"] = "metal"
    o["rigid"] = "head"
    out = [o]
    for sd in (1, -1):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co = V((v.co.x * 0.26 * hs, v.co.y * 0.05 * hs, v.co.z * 0.035 * hs))
        sl = mesh_obj("slit", bm)
        sl.location = head.location + V((sd * 0.3 * hs, -1.06 * hs, 0.14 * hs))
        sl.rotation_euler = (0, sd * -0.15, sd * 0.25)
        sl["mat"] = "glow"
        sl["rigid"] = "head"
        out.append(sl)
    return out


# ----------------------------------------------------------------------------------------------------------------
# colour: per-vertex detail (fabric grain, AO toward folds and soles, face features)
# ----------------------------------------------------------------------------------------------------------------
TAG_MAT = {"top": "clothA", "sleeve": "clothA", "cuff": "clothA", "collar": "clothA", "bottom": "clothB", "skirt": "clothB", "shoe": "trim", "skin": "skin", "neck": "skin"}


def colorize_body(obj, g, c, H):
    """Region per face (majority of its vertices' nearest graph edge); colour per face corner from that region."""
    tags = tag_vertices(obj, g)
    me = obj.data
    shoe = c.get("shoeColor", c.get("trimColor", (0.06, 0.045, 0.035)))
    seed = len(c["id"])
    ftags = []
    for p in me.polygons:
        vs = [tags[i] for i in p.vertices]
        names = [t for t, _ in vs]
        ftags.append((max(set(names), key=names.count), max(u for t, u in vs)))
    col = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for p, (tag, t) in zip(me.polygons, ftags):
        for li in p.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            n = noise3(v.co * (40 / H), seed)
            ao = 0.82 + 0.18 * min(1, v.co.z / H * 6)
            if tag in ("skin", "neck"):
                k = 0.94 + 0.06 * n
                rgb = (k, k, k)
            elif tag == "shoe":
                k = 0.85 + 0.25 * n
                rgb = (shoe[0] * k, shoe[1] * k, shoe[2] * k)
            else:
                k = (0.86 + 0.14 * n) * ao
                if tag == "cuff" and t > 0.82:
                    k *= 0.78   # cuff seam
                rgb = (k, k, k)
            col.data[li].color = (*rgb, 1)
    obj["ftags"] = [TAG_MAT.get(tg, "clothA") for tg, _ in ftags]


def to_corner_colors(obj):
    """Convert a POINT colour attribute to CORNER so every part of the joined mesh uses one domain."""
    a = obj.data.color_attributes.get("Col")
    if not a or a.domain == "CORNER":
        return
    vals = [tuple(d.color) for d in a.data]
    obj.data.color_attributes.remove(a)
    b = obj.data.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for li, lp in enumerate(obj.data.loops):
        b.data[li].color = vals[lp.vertex_index]


def colorize_head(head, c, hs):
    col = head.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    lip = c.get("lip", (0.75, 0.42, 0.40))
    stub = c.get("stubble", 0.0)
    for i, v in enumerate(head.data.vertices):
        p = V((v.co.x / (0.82 * hs), v.co.y / hs, v.co.z / (1.12 * hs)))
        fr = max(0.0, -p.y)
        r = g_ = b = 1.0
        # lips + mouth line
        m = gauss(p.x, 0.17) * (gauss(p.z + 0.43, 0.035) + gauss(p.z + 0.53, 0.035)) * fr
        ml = 0.45 * gauss(p.x, 0.22) * gauss(p.z + 0.485, 0.01) * fr
        r, g_, b = r - ml, g_ - ml, b - ml
        r, g_, b = r * (1 - m) + lip[0] * m, g_ * (1 - m) + lip[1] * m, b * (1 - m) + lip[2] * m
        # cheeks blush
        bl = 0.12 * gauss(abs(p.x) - 0.48, 0.14) * gauss(p.z + 0.12, 0.12) * fr
        g_ -= bl
        b -= bl
        # eye sockets slightly darker, under-eye
        for ex in (-0.36, 0.36):
            d = 0.16 * gauss(p.x - ex, 0.13) * gauss(p.z - 0.1, 0.1) * fr
            r -= d
            g_ -= d
            b -= d * 0.8
        # stubble / jaw shade
        if stub:
            s = stub * (1 if p.z < -0.25 and abs(p.y) < 0.95 and not (abs(p.x) < 0.25 and p.z > -0.55 and fr > 0.8) else 0) * 0.35
            r, g_, b = r - s, g_ - s, b - s * 0.9
        col.data[i].color = (max(0, r), max(0, g_), max(0, b), 1)
    head["mat"] = "skin"


def solid_color(obj, rgb):
    col = obj.data.color_attributes.get("Col") or obj.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for i, v in enumerate(obj.data.vertices):
        k = 0.88 + 0.24 * noise3(v.co * 60)
        col.data[i].color = (rgb[0] * k, rgb[1] * k, rgb[2] * k, 1)


# ----------------------------------------------------------------------------------------------------------------
# materials (few per character: tintable cloth A / cloth B / skin, plus fixed trim / hair / eyes / metal / accent)
# ----------------------------------------------------------------------------------------------------------------
MAT_ORDER = ["skin", "clothA", "clothB", "trim", "hair", "eyes", "metal", "accent", "glow"]


def make_material(name, c):
    m = bpy.data.materials.new(c["id"] + "_" + name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    ca = nt.nodes.new("ShaderNodeVertexColor")
    ca.layer_name = "Col"
    nt.links.new(ca.outputs["Color"], bsdf.inputs["Base Color"])
    rough = {"skin": 0.55, "clothA": 0.85, "clothB": 0.9, "trim": 0.55, "hair": 0.5, "eyes": 0.15, "metal": 0.3, "accent": 0.8, "glow": 0.4}[name]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0.8 if name == "metal" else 0.0
    if name == "glow":
        bsdf.inputs["Emission Color"].default_value = (*c.get("glowColor", (0.3, 0.9, 1.0)), 1)
        bsdf.inputs["Emission Strength"].default_value = 2.0
    tint = {"skin": c.get("skin", (0.8, 0.6, 0.48)), "clothA": c.get("colorA", (0.3, 0.3, 0.35)), "clothB": c.get("colorB", (0.15, 0.15, 0.18))}.get(name)
    if tint:
        m["tint"] = list(tint)
    m["slot"] = name
    return m


# ----------------------------------------------------------------------------------------------------------------
# weights
# ----------------------------------------------------------------------------------------------------------------
def nearest_bone(arm, p):
    best, bn = 1e9, None
    for b in arm.data.bones:
        d, _ = seg_dist(p, b.head_local, b.tail_local)
        if d < best:
            best, bn = d, b.name
    return bn


def auto_weight(mesh, arm):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    # any vertex the heat solver missed -> nearest bone
    groups = {vg.index: vg.name for vg in mesh.vertex_groups}
    missing = [v for v in mesh.data.vertices if sum(gw.weight for gw in v.groups) < 1e-3]
    for v in missing:
        bn = nearest_bone(arm, mesh.matrix_world @ v.co)
        vg = mesh.vertex_groups.get(bn) or mesh.vertex_groups.new(name=bn)
        vg.add([v.index], 1.0, "REPLACE")
    _ = groups
    return len(missing)


def skirt_weight(obj, arm, J, H):
    """Coat tails / skirts: hips at the waist, blending toward both thighs (side-biased) lower down."""
    obj.vertex_groups.clear()
    vh, vl, vr = (obj.vertex_groups.new(name=n) for n in ("hips", "thigh_L", "thigh_R"))
    top, hipx = 0.57 * H, abs(J["hip_L"].x)
    for v in obj.data.vertices:
        p = obj.matrix_world @ v.co
        t = max(0.0, min(1.0, (top - p.z) / (0.35 * H)))
        lw = 0.55 * t
        sx = max(-1.0, min(1.0, p.x / (hipx * 2.2)))
        vh.add([v.index], 1 - lw, "REPLACE")
        vl.add([v.index], lw * (0.5 + 0.5 * sx), "REPLACE")
        vr.add([v.index], lw * (0.5 - 0.5 * sx), "REPLACE")
    obj.parent = arm
    m = obj.modifiers.new("arm", "ARMATURE")
    m.object = arm


def rigid_weight(obj, arm, bone):
    obj.vertex_groups.clear()
    vg = obj.vertex_groups.new(name=bone)
    vg.add([v.index for v in obj.data.vertices], 1.0, "REPLACE")
    obj.parent = arm
    obj.parent_type = "OBJECT"
    m = obj.modifiers.new("arm", "ARMATURE")
    m.object = arm


# ----------------------------------------------------------------------------------------------------------------
# character assembly
# ----------------------------------------------------------------------------------------------------------------
def build_character(c):
    H = c["height"]
    J = joints(c)
    arm = build_armature(c["id"], J)
    g = body_graph(c, J)
    body = skin_object(c["id"] + "_body", g)
    colorize_body(body, g, c, H)
    head, hs, ears = head_object(c, J)
    colorize_head(head, c, hs)
    for e in ears:
        solid_color(e, (1, 1, 1))
        e["mat"] = "skin"
        e["rigid"] = "head"
    head["rigid"] = "head"
    parts = [head] + ears + eye_objects(c, head, hs) + brows(c, head, hs) + hair_objects(c, head, hs) + facial_hair(c, head, hs)
    parts += hat_objects(c, head, hs, H) + glasses(c, head, hs) + mask(c, head, hs)
    for o in parts:
        o["rigid"] = o.get("rigid", "head")
    extra = accessories(c, J, H) + shoes(c, J, H)
    hair_rgb = c.get("hairColor", (0.08, 0.06, 0.05))
    trim_rgb = c.get("trimColor", (0.12, 0.09, 0.07))
    accent_rgb = c.get("accentColor", (0.6, 0.2, 0.15))
    for o in parts + extra:
        if not o.data.color_attributes.get("Col"):
            mt = o.get("mat")
            rgb = {"hair": hair_rgb, "trim": trim_rgb, "accent": accent_rgb, "metal": c.get("metalColor", (0.75, 0.6, 0.35)),
                   "clothA": (0.9, 0.9, 0.9), "clothB": (0.9, 0.9, 0.9), "glow": (1, 1, 1)}.get(mt, (1, 1, 1))
            solid_color(o, rgb)
    for o in parts + extra:
        to_corner_colors(o)
    # materials
    mats = {n: make_material(n, c) for n in MAT_ORDER}
    used = set()

    merge = {"hair": "trim", "eyes": "trim", "accent": "trim", "metal": "trim"}   # colour lives in vertex colours: one draw call

    def assign(o, per_face):
        o.data.materials.clear()
        for n in MAT_ORDER:
            o.data.materials.append(mats[n])
        for p in o.data.polygons:
            n = per_face(p)
            n = merge.get(n, n)
            p.material_index = MAT_ORDER.index(n)
            used.add(n)

    ft = body["ftags"]
    assign(body, lambda p: ft[p.index])
    for o in parts + extra:
        assign(o, lambda p, o=o: o.get("mat", "trim"))
    # weights: body + skirts by heat, rigid accessories by bone
    soft = [body] + [o for o in extra if o.get("tag") == "skirt"]
    auto_weight(body, arm)
    for o in soft[1:]:
        skirt_weight(o, arm, J, H)
    for o in parts + extra:
        if o.get("tag") == "skirt":
            continue
        o.matrix_world = o.matrix_world  # bake location
        rigid_weight(o, arm, o.get("rigid", "head"))
    # join into one mesh
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    allp = soft + [o for o in parts + extra if o.get("tag") != "skirt"]
    for o in allp:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = c["id"] + "_mesh"
    # drop unused material slots (remap face indices)
    keep = [i for i, m in enumerate(body.data.materials) if m["slot"] in used]
    remap = {old: new for new, old in enumerate(keep)}
    idx = [remap[p.material_index] for p in body.data.polygons]
    kept = [body.data.materials[i] for i in keep]
    body.data.materials.clear()
    for m in kept:
        body.data.materials.append(m)
    for p, i in zip(body.data.polygons, idx):
        p.material_index = i
    # decimate to budget
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    budget = c.get("tris", 9000)
    if tris > budget:
        d = body.modifiers.new("dec", "DECIMATE")
        d.ratio = budget / tris
        d.use_collapse_triangulate = True
        # keep armature modifier last
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.modifier_move_to_index(modifier="dec", index=0)
        bpy.ops.object.modifier_apply(modifier="dec")
    arm["character"] = c["id"]
    return arm, body


# ----------------------------------------------------------------------------------------------------------------
# animation (keyframed from code; shared by every rig because rest orientations are identical)
# ----------------------------------------------------------------------------------------------------------------
def rest_q(arm, bn):
    return arm.data.bones[bn].matrix_local.to_quaternion()


def qaxis(axis, deg):
    return Quaternion(V(axis), math.radians(deg))


def set_pose(arm, pose, frame, hips=V((0, 0, 0))):
    """pose: bone -> world-axis rotation (Quaternion) in armature rest space."""
    for pb in arm.pose.bones:
        R = rest_q(arm, pb.name)
        Q = pose.get(pb.name, Quaternion())
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = R.inverted() @ Q @ R
        pb.keyframe_insert("rotation_quaternion", frame=frame)
    hb = arm.pose.bones["hips"]
    R = rest_q(arm, "hips")
    hb.location = R.inverted() @ hips
    hb.keyframe_insert("location", frame=frame)


X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def side(k):
    return 1 if k == "L" else -1


def pose_walk(ph, H, run=0.0, sneak=0.0):
    """ph in [0,1): gait phase. Left foot forward at 0."""
    P = {}
    s = math.sin(2 * math.pi * ph)
    c2 = math.cos(4 * math.pi * ph)
    amp = 21 + 18 * run - 5 * sneak
    lean = 4 + 12 * run + 18 * sneak
    P["hips"] = qaxis(Z, 6 * s) @ qaxis(X, lean * 0.3)
    P["spine"] = qaxis(Z, -4 * s) @ qaxis(X, lean * 0.4)
    P["chest"] = qaxis(Z, -6 * s) @ qaxis(X, lean * 0.3)
    P["neck"] = qaxis(X, -lean * 0.4)
    P["head"] = qaxis(X, -lean * 0.3) @ qaxis(Z, 3 * s)
    for k in "LR":
        sg = s if k == "L" else -s
        ph2 = (ph + (0 if k == "L" else 0.5)) % 1.0
        swing = amp * math.sin(2 * math.pi * ph2)
        # knee bends during swing (second half of the leg's cycle, foot behind -> passing)
        knee = (8 + 50 * (1 + run * 0.6)) * max(0.0, math.sin(2 * math.pi * (ph2 - 0.5))) ** 1.2 + 6 + 30 * sneak
        P["thigh_" + k] = qaxis(X, -swing - 20 * sneak)
        P["shin_" + k] = qaxis(X, knee)
        foot = -10 * math.sin(2 * math.pi * ph2) * (1 + run) - 6 * max(0.0, -math.cos(2 * math.pi * ph2))
        P["foot_" + k] = qaxis(X, foot - 8 * sneak)
        P["toe_" + k] = qaxis(X, 12 * max(0.0, math.sin(2 * math.pi * (ph2 - 0.35))))
        # arms opposite to legs; A-pose relaxed down
        down = 36 - 6 * run - 10 * sneak
        arm_sw = (amp * 0.85 + 12 * run) * math.sin(2 * math.pi * ph2)
        P["clavicle_" + k] = qaxis(Y, side(k) * (-2 + 2 * c2))
        P["upperarm_" + k] = qaxis(X, arm_sw) @ qaxis(Y, side(k) * down)
        P["forearm_" + k] = qaxis(X, -(14 + 70 * run + 30 * sneak + 10 * max(0, -arm_sw / amp)))
        P["hand_" + k] = qaxis(Y, side(k) * 8)
        _ = sg
    bob = (0.012 + 0.03 * run) * H * (0.5 - 0.5 * c2) - 0.004 * H - 0.12 * sneak * H
    return P, V((0, -0.01 * H * run, bob))


def pose_idle(t, H, sad=0.0):
    P = {}
    br = math.sin(2 * math.pi * t)
    sw = math.sin(2 * math.pi * t * 0.5)
    P["hips"] = qaxis(Y, 1.5 * sw) @ qaxis(Z, 2 * sw)
    P["spine"] = qaxis(X, 1.2 * br + 6 * sad)
    P["chest"] = qaxis(X, -1.5 * br + 8 * sad)
    P["neck"] = qaxis(X, 10 * sad) @ qaxis(Z, 6 * math.sin(2 * math.pi * t * 0.25))
    P["head"] = qaxis(X, -2 + 18 * sad) @ qaxis(Z, 8 * math.sin(2 * math.pi * t * 0.25 + 1.2))
    for k in "LR":
        P["clavicle_" + k] = qaxis(Y, side(k) * (1.2 * br - 6 * sad))
        P["upperarm_" + k] = qaxis(Y, side(k) * (36 + 1.5 * br)) @ qaxis(X, 3)
        P["forearm_" + k] = qaxis(X, -(14 + 2 * br))
        P["hand_" + k] = qaxis(Y, side(k) * 8)
        P["thigh_" + k] = qaxis(X, 0) @ qaxis(Y, side(k) * (2 + 1.2 * sw * side(k)))
        P["shin_" + k] = qaxis(X, 3 + 2 * (sw * side(k) > 0) * abs(sw))
    return P, V((0, 0, -0.003 * H * abs(sw)))


def pose_talk(t, H):
    """Conversational gestures: arms stay relaxed at the sides; the right hand lifts a little at waist height, the left forearm
    flexes now and then, small head movement. (Big world-axis swings on the A-pose rig read as hailing / shrugging.)"""
    P, hp = pose_idle(t, H)
    g = math.sin(2 * math.pi * t * 1.0)
    g2 = math.sin(2 * math.pi * t * 0.5 + 0.7)
    lift = 0.5 + 0.5 * g
    P["upperarm_R"] = qaxis(X, -6 - 8 * lift) @ qaxis(Y, -34)
    P["forearm_R"] = qaxis(X, -30 - 22 * lift)
    P["hand_R"] = qaxis(Y, -6 + 6 * g2)
    P["upperarm_L"] = qaxis(X, -3 - 4 * max(0, -g2)) @ qaxis(Y, 35)
    P["forearm_L"] = qaxis(X, -16 - 14 * max(0, -g2))
    P["head"] = qaxis(X, -2 + 3 * math.sin(2 * math.pi * t * 2)) @ qaxis(Z, 5 * g2)
    return P, hp


def pose_nod(t, H):
    P, hp = pose_idle(t, H)
    P["head"] = qaxis(X, 4 + 12 * max(0, math.sin(2 * math.pi * t * 1.5)) ** 2)
    P["upperarm_R"] = qaxis(X, -24) @ qaxis(Y, -28)
    P["forearm_R"] = qaxis(X, -95)
    P["upperarm_L"] = qaxis(X, -24) @ qaxis(Y, 28)
    P["forearm_L"] = qaxis(X, -95)   # arms folded / working at a stall
    return P, hp


def pose_fall(t, H):
    P, hp = pose_walk(0.25, H, run=1.0)
    for k in "LR":
        P["upperarm_" + k] = qaxis(Y, side(k) * 10) @ qaxis(X, -30)
        P["shin_" + k] = qaxis(X, 40)
        P["thigh_" + k] = qaxis(X, -30 if k == "L" else -10)
    return P, V((0, 0, 0))


REST = {}   # reference-rig measurements (filled by bake_clips) for poses that must meet the floor / a seat


def pose_sit(t, H):
    """Seated on a ~0.46 m bench: thighs forward ~81 deg, knees ~81 deg, feet flat on the floor, hands resting on the
    thighs, slow breathing and a little head life. The hips drop so the ankles keep their rest height (feet on the
    floor); for the reference body that puts the pelvis ~0.54 m up and the seat contact ~0.45 m (the prologue benches
    are 0.466 m: a lower pelvis would sink into the cushion)."""
    P = {}
    br = math.sin(2 * math.pi * t)
    look = math.sin(2 * math.pi * t * 0.5)
    th, sh = 81.0, 0.0          # thigh / shin angle forward from hanging straight down
    P["hips"] = qaxis(X, 0)
    P["spine"] = qaxis(X, -5 + 0.8 * br)
    P["chest"] = qaxis(X, 4 - 1.4 * br)
    P["neck"] = qaxis(X, 5) @ qaxis(Z, 4 * look)
    P["head"] = qaxis(X, 3 + 1.0 * br) @ qaxis(Z, 6 * math.sin(2 * math.pi * t * 0.5 + 1.0))
    for k in "LR":
        spread = side(k) * 6
        P["thigh_" + k] = qaxis(Z, spread) @ qaxis(X, -th)
        P["shin_" + k] = qaxis(X, th - sh)
        P["foot_" + k] = qaxis(X, sh) @ qaxis(Z, -spread * 0.5)
        P["toe_" + k] = qaxis(X, 0)
        P["clavicle_" + k] = qaxis(Y, side(k) * (0.8 * br - 2))
    # arms: aim each bone at a world direction (upper arm down the side, forearm forward onto the thigh, hand on it),
    # converted to parent-relative through the chain (the rest pose already has the forearms angled forward)
    for k in "LR":
        sd = side(k)
        chain = P["hips"] @ P["spine"] @ P["chest"] @ P["clavicle_" + k]
        rd = REST.get("dirs", {})
        aim = lambda bn, d: V(rd.get(bn + k, (sd * 0.6, -0.1, -0.8))).normalized().rotation_difference(V(d).normalized())
        Wu = aim("upperarm_", (sd * 0.07, -0.26, -1.0))
        Wf = aim("forearm_", (-sd * 0.2, -1.0, -0.42 - 0.01 * br))
        Wh = aim("hand_", (-sd * 0.12, -1.0, -0.75))
        P["upperarm_" + k] = chain.inverted() @ Wu
        P["forearm_" + k] = Wu.inverted() @ Wf
        P["hand_" + k] = Wf.inverted() @ Wh
    # hips height so the ankles keep their rest height (feet on the floor), from the real rest bone directions
    rd = REST.get("dirs", {})
    td = P["thigh_L"] @ V(rd.get("thigh_L", (0, 0, -1)))
    sv = P["thigh_L"] @ P["shin_L"] @ V(rd.get("shin_L", (0, 0, -1)))
    hj = REST.get("ankle", 0.085 * H / 1.7) - REST.get("thigh", 0.245 * H) * td.z - REST.get("shin", 0.25 * H) * sv.z
    drop = REST.get("hipj", 0.53 * H) - hj
    return P, V((0, 0.0, -drop + 0.002 * br))


CLIPS = [  # name, frames (30 fps), pose fn(t in 0..1)
    ("idle", 120, lambda t, H: pose_idle(t, H)),
    ("walk", 32, lambda t, H: pose_walk(t, H)),
    ("run", 20, lambda t, H: pose_walk(t, H, run=1.0)),
    ("crouch", 40, lambda t, H: pose_walk(t, H, sneak=1.0)),
    ("talk", 90, lambda t, H: pose_talk(t, H)),
    ("nod", 60, lambda t, H: pose_nod(t, H)),
    ("sad", 90, lambda t, H: pose_idle(t, H, sad=1.0)),
    ("fall", 20, lambda t, H: pose_fall(t, H)),
    ("sit", 120, lambda t, H: pose_sit(t, H)),
]


def bake_clips(arm, H):
    b = arm.data.bones
    if "thigh_L" in b and "shin_L" in b and "foot_L" in b:
        REST.update(hipj=b["thigh_L"].head_local.z, thigh=b["thigh_L"].length, shin=b["shin_L"].length, ankle=b["foot_L"].head_local.z,
                    pelvis=b["hips"].head_local.z, dirs={n: tuple((b[n].tail_local - b[n].head_local).normalized()) for n in b.keys()})
    arm.animation_data_create()
    for name, frames, fn in CLIPS:
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        step = 2
        for f in range(0, frames + 1, step):
            P, hip = fn((f % frames) / frames, H)
            set_pose(arm, P, f + 1, hip)
    arm.animation_data.action = None


# ----------------------------------------------------------------------------------------------------------------
def export(path, objs, animations, attributes=False):
    """attributes=True: no vertex colours, but custom '_name' attributes (the realistic cast's shading mask)."""
    for o in bpy.context.view_layer.objects:
        o.select_set(o in objs)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_skins=True,
                              export_animations=animations, export_animation_mode="ACTIONS", export_extras=True,
                              export_vertex_color="NONE" if attributes else "ACTIVE", export_all_vertex_colors=False,
                              export_attributes=attributes, export_morph=False,
                              export_force_sampling=True, export_optimize_animation_size=True)


def main():
    out = os.path.abspath(sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith(".py") else "out")
    only = os.environ.get("ONLY")
    os.makedirs(out, exist_ok=True)
    clear()
    objs = []
    for c in CAST:
        if only and c["id"] not in only.split(","):
            continue
        arm, body = build_character(c)
        objs += [arm, body] + [o for o in bpy.context.view_layer.objects if o.parent == arm and o not in (body,)]
        print("built", c["id"], sum(len(p.vertices) - 2 for p in body.data.polygons), "tris", len(body.data.materials), "mats")
    export(os.path.join(out, "cast.glb"), set(objs), False)
    clear()
    ref = build_armature("rig", joints(REF))
    bake_clips(ref, REF["height"])
    export(os.path.join(out, "anims.glb"), {ref}, True)
    print("done ->", out)


if __name__ == "__main__":
    main()
