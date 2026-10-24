"""MakeHuman (CC0 base mesh + shape targets) as a sculpting library: parameters in, an anatomically realistic body out.

Data: a checkout of github.com/makehumancommunity/makehuman (makehuman/data). Point MH_DATA at that folder:
    git clone --depth 1 https://github.com/makehumancommunity/makehuman
    export MH_DATA=$PWD/makehuman/makehuman/data
Only the CC0 base mesh, targets, joint helpers and eye textures are used; every character's shape is ours.
"""
import json, os
from functools import lru_cache
import numpy as np

DATA = os.environ.get("MH_DATA", "")


def path(*p):
    return os.path.join(DATA, *p)


# ----------------------------------------------------------------------------------------------------------------
# base mesh
# ----------------------------------------------------------------------------------------------------------------
@lru_cache(None)
def base():
    """Vertices (N,3, metres, Y-up), UVs, faces [(vidx..), (uvidx..), group]."""
    V, UV, F = [], [], []
    group = None
    with open(path("3dobjs", "base.obj")) as f:
        for line in f:
            if line.startswith("v "):
                V.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("vt "):
                UV.append([float(x) for x in line.split()[1:3]])
            elif line.startswith("g "):
                group = line.split()[1]
            elif line.startswith("f "):
                vs, ts = [], []
                for tok in line.split()[1:]:
                    a = tok.split("/")
                    vs.append(int(a[0]) - 1)
                    ts.append(int(a[1]) - 1 if len(a) > 1 and a[1] else -1)
                F.append((tuple(vs), tuple(ts), group))
    return np.array(V, dtype=np.float64), np.array(UV, dtype=np.float64), F


@lru_cache(None)
def target(rel):
    """Sparse target: (indices, deltas) — empty if the file is missing."""
    p = path("targets", rel)
    if not os.path.exists(p):
        return None
    idx, d = [], []
    with open(p) as f:
        for line in f:
            if not line.strip() or line[0] == "#":
                continue
            a = line.split()
            idx.append(int(a[0]))
            d.append([float(a[1]), float(a[2]), float(a[3])])
    return np.array(idx, dtype=np.int64), np.array(d, dtype=np.float64)


# ----------------------------------------------------------------------------------------------------------------
# macro modifiers (same blending rules as MakeHuman)
# ----------------------------------------------------------------------------------------------------------------
def macro_weights(gender=0.5, age=0.5, muscle=0.5, weight=0.5, height=0.5, proportions=0.5, african=1 / 3, asian=1 / 3, caucasian=1 / 3):
    g = {"female": 1 - gender, "male": gender}
    if age < 0.5:
        young = max(0.0, (age - 0.1875) * 3.2)
        a = {"baby": max(0.0, 1 - age * 5.333), "young": young, "old": 0.0}
        a["child"] = max(0.0, min(1.0, 5.333 * age) - young)
    else:
        old = max(0.0, age * 2 - 1)
        a = {"baby": 0.0, "child": 0.0, "young": 1 - old, "old": old}
    tri = lambda v: {"min": max(0.0, 1 - v * 2), "max": max(0.0, v * 2 - 1), "average": 1 - max(0.0, 1 - v * 2) - max(0.0, v * 2 - 1)}
    m, w = tri(muscle), tri(weight)
    hv = {"minheight": max(0.0, 1 - height * 2), "maxheight": max(0.0, height * 2 - 1)}
    pv = {"uncommonproportions": max(0.0, 1 - proportions * 2), "idealproportions": max(0.0, proportions * 2 - 1)}
    s = african + asian + caucasian
    race = {"african": african / s, "asian": asian / s, "caucasian": caucasian / s}
    out = []
    for gk, gv in g.items():
        for ak, av in a.items():
            if gv * av <= 1e-6:
                continue
            for rk, rv in race.items():
                if rv > 1e-6:
                    out.append((f"macrodetails/{rk}-{gk}-{ak}.target", gv * av * rv))
            for mk, mv in m.items():
                for wk, wv in w.items():
                    base_w = gv * av * mv * wv
                    if base_w <= 1e-6:
                        continue
                    out.append((f"macrodetails/universal-{gk}-{ak}-{mk}muscle-{wk}weight.target", base_w))
                    for hk, hvv in hv.items():
                        if hvv > 1e-6:
                            out.append((f"macrodetails/height/{gk}-{ak}-{mk}muscle-{wk}weight-{hk}.target", base_w * hvv))
                    for pk, pvv in pv.items():
                        if pvv > 1e-6:
                            out.append((f"macrodetails/proportions/{gk}-{ak}-{mk}muscle-{wk}weight-{pk}.target", base_w * pvv))
    return out


@lru_cache(None)
def modifier_table():
    """'group/name' -> (min target rel path or None, max target rel path) from modeling_modifiers.json."""
    t = {}
    for grp in json.load(open(path("modifiers", "modeling_modifiers.json"))):
        g = grp["group"]
        if g.startswith("macrodetails"):
            continue
        for m in grp["modifiers"]:
            if "target" not in m:   # macro-driven (breast size/firmness) — not exposed
                continue
            name = m["target"]
            if "min" in m:
                key = f"{g}/{name}-{m['min']}|{m['max']}"
                t[key] = (f"{g}/{name}-{m['min']}.target", f"{g}/{name}-{m['max']}.target")
            else:
                t[f"{g}/{name}"] = (None, f"{g}/{name}.target")
    return t


def detail_weights(details):
    """details: {'nose/nose-trans-down|up': 0.4, 'head/head-oval': 0.6, ...} -> [(target, weight)]."""
    out, tab = [], modifier_table()
    for k, v in details.items():
        if k not in tab:
            raise KeyError("unknown modifier " + k)
        lo, hi = tab[k]
        if v >= 0:
            out.append((hi, v))
        elif lo:
            out.append((lo, -v))
    return out


def base_hash():
    """A short digest of the base mesh's vertices (a shape layer is only valid on the mesh it was solved on)."""
    import hashlib
    return hashlib.sha1(np.round(base()[0], 6).tobytes()).hexdigest()[:16]


@lru_cache(None)
def _shape_file(p):
    z = np.load(p)
    meta = json.loads(str(z["meta"])) if "meta" in z.files else {}
    bh = str(z["base_hash"]) if "base_hash" in z.files else ""
    if bh and bh != base_hash():
        raise ValueError(f"{p}: solved on another MakeHuman base mesh ({bh} != {base_hash()})")
    return (z["idx"].astype(np.int64), z["d"].astype(np.float64), z["region"].astype(np.int64) if "region" in z.files else None, bh, meta)


def shape_target(shape):
    """A face file's dense shape layer (likeness/dense_fit.py, docs/CHARACTER_LOOK.md "Fix round 4") as a sparse
    target: (indices, decimetre deltas). shape: a path, or {"path", "weight", "regions": {region id: weight}}."""
    if isinstance(shape, str):
        shape = {"path": shape}
    idx, d, region, _, _ = _shape_file(os.path.abspath(shape["path"]))
    w = float(shape.get("weight", 1.0))
    if shape.get("regions") and region is not None:
        rw = np.array([float(shape["regions"].get(str(r), shape["regions"].get(r, 1.0))) for r in range(16)])
        return idx, d * (w * rw[region])[:, None]
    return idx, d * w


def shape_of(c):
    """The dense shape argument of a cast entry (its face file's `shape`, `shapeWeight`, `shapeRegions`), or None."""
    if not c.get("shape"):
        return None
    return {"path": c["shape"], "weight": float(c.get("shapeWeight", 1.0)), "regions": c.get("shapeRegions")}


def shape_digest(shape):
    """A short digest of a shape argument (file content + weights), for caches keyed on the sculpt."""
    import hashlib
    h = hashlib.sha1(open(shape["path"], "rb").read()).hexdigest()[:16]
    return [h, shape.get("weight", 1.0), shape.get("regions")]


def sculpt(macro, details=None, shape=None):
    """Final vertex positions (metres, Y-up) for macro + detail parameters (+ an optional dense shape layer, applied
    after them like one more target; None: exactly the slider sculpt)."""
    V, _, _ = base()
    P = V.copy()
    for rel, w in macro_weights(**macro) + detail_weights(details or {}):
        t = target(rel)
        if t is None or w == 0 or len(t[0]) == 0:
            continue
        idx, d = t
        P[idx] += d * w
    if shape:
        idx, d = shape_target(shape)
        P[idx] += d
    return P * 0.1   # decimetres -> metres


def group_vertices(prefix):
    """Vertex indices used by faces of groups starting with prefix (e.g. 'joint-l-knee', 'helper-l-eye', 'body')."""
    _, _, F = base()
    s = set()
    for vs, _, g in F:
        if g and g.startswith(prefix):
            s.update(vs)
    return sorted(s)


def joint(P, name):
    """Centre of a MakeHuman joint helper (e.g. 'l-knee', 'neck', 'spine-3', 'head')."""
    vs = group_vertices("joint-" + name)
    if not vs:
        raise KeyError(name)
    return P[vs].mean(axis=0)


def list_modifiers(prefix=""):
    return [k for k in modifier_table() if k.startswith(prefix)]
