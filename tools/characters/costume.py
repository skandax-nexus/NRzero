"""AFTERZERO costume pipeline for build_humans.py (characters whose spec has `wear=[...]`, see garments.py).

How a costume is made (all garment layers are copies of body faces, like the legacy pipeline):
- fields(): one smooth coverage field per worn item (metres, > 0 = covered): tops, vests, carriers, straps, plates,
  trousers, leggings, wraps, pads, gloves, boot shafts, hoods. Items are stacked by their `z` (inner -> outer).
- build_layers(): each item becomes a layer whose open border is snapped onto its field's zero line. Broad items
  (`hides`) cut the layers under them back to a 2.5 cm overlap band, so nothing is see-through and no triangles are
  wasted under a coat. Every layer is offset from the skin by the thickness of what it covers (a per-vertex stack
  height), then pushed out so it never dips under the layer below while it is animated (same skin weights).
  Long garments (coats, lab coats, tunics, ponchos, cloaks) grow a cloth tail lofted from their own hem loop (no seam,
  same painter); the tail gets skirt weights (the cloth stretches between the legs), a lining and vents / slits.
  Hems, cuffs and vest edges get a rim (real thickness), collars are lofted profiles on the neck loop.
- extras(): collars, hood rolls, skirts, belts with buckles, pouches, shoes (sole height / lip / toe cap per type),
  sandals, caps, beanies, Continuum helmets, ancient headbands and hair pieces.
- paint_*: garment painters (garments.paint) run on every texel of the outermost layer; tails, collars, hood rolls
  and helmets live in an extra atlas region ("aux") and are painted from their own 3D rest positions by the same
  painters, so they match the torso exactly. Painters also give a height (-> normal map) and glow (-> emissive map).
"""
import math
import os
import numpy as np
import garments as G

BH = None          # the build_humans module (bound by build_humans at import: it runs as __main__)
AUX = []           # aux pieces of the character being built


def bind(m):
    global BH
    BH = m


ss, g2 = G.ss, lambda d2, s: np.exp(-d2 / (2 * s * s))


# ----------------------------------------------------------------------------------------------------------------
# body coordinates: torso axis, limb chains (arc length, angle around, radius)
# ----------------------------------------------------------------------------------------------------------------
def limb_coords(P, pts, kind, side):
    """Arc length along a joint chain, angle around it (deg; arms 0 = front, 90 = top; legs 0 = front, 90 = outer),
    distance from the chain."""
    n = len(P)
    best = np.full(n, np.inf)
    s, ang, rad = np.zeros(n), np.zeros(n), np.zeros(n)
    acc, cum = 0.0, [0.0]
    for a, b in zip(pts[:-1], pts[1:]):
        ab = b - a
        L = max(np.linalg.norm(ab), 1e-6)
        d = ab / L
        t = np.clip((P - a) @ d / L, 0, 1)
        rv = P - (a + t[:, None] * ab)
        dist = np.linalg.norm(rv, axis=1)
        fwd = np.array([0.0, 0.0, 1.0]) - d[2] * d
        fwd /= max(np.linalg.norm(fwd), 1e-6)
        ref = np.array([0.0, 1.0, 0.0]) if kind == "arm" else np.array([side * 1.0, 0.0, 0.0])
        ref = ref - (ref @ d) * d - (ref @ fwd) * fwd
        ref /= max(np.linalg.norm(ref), 1e-6)
        m = dist < best
        best[m] = dist[m]
        s[m] = acc + t[m] * L
        ang[m] = np.degrees(np.arctan2(rv[m] @ ref, rv[m] @ fwd))
        rad[m] = dist[m]
        acc += L
        cum.append(acc)
    return s, ang, rad, cum


def chains(B):
    if getattr(B, "_chains", None) is None:
        J = B.Jm
        arm = {s: [J["shoulder_" + s], J["elbow_" + s], J["wrist_" + s], J["handEnd_" + s]] for s in "LR"}
        leg = {s: [J["hip_" + s], J["knee_" + s], J["ankle_" + s], J["toe_" + s]] for s in "LR"}
        T = B.P[B.bodyv]
        tv = np.isin(np.array(B.vb)[B.bodyv], ["hips", "spine", "chest", "clavicle_L", "clavicle_R", "neck"])
        T = T[tv]
        ys = np.linspace(T[:, 1].min(), T[:, 1].max(), 40)
        zc = []
        for yy in ys:
            m = T[np.abs(T[:, 1] - yy) < 0.02]
            zc.append((m[:, 2].max() + m[:, 2].min()) / 2 if len(m) > 4 else np.nan)
        zc = np.array(zc)
        ok = ~np.isnan(zc)
        B._chains = dict(arm=arm, leg=leg, zc=(ys[ok], zc[ok]))
        B._vc = vertex_coords(B, B.P)
    return B._chains


def zc_at(B, y):
    ys, zs = chains(B)["zc"]
    return np.interp(y, ys, zs)


def vertex_coords(B, P):
    ch = B._chains
    out = {}
    for s, sg in (("L", 1), ("R", -1)):
        out["arm" + s] = limb_coords(P, ch["arm"][s], "arm", sg)
        out["leg" + s] = limb_coords(P, ch["leg"][s], "leg", sg)
    zc = np.interp(P[:, 1], *ch["zc"])
    out["th"] = np.degrees(np.arctan2(P[:, 0], P[:, 2] - zc))
    out["r"] = np.hypot(P[:, 0], P[:, 2] - zc)
    out["zc"] = zc
    return out


def side_pick(x, a, b):
    """Per point: the left-side value (x > 0) or the right-side one."""
    return np.where(x >= 0, a, b)


def finger_weight(B):
    """Per vertex: weight of the distal finger bones (bare on fingerless gloves)."""
    if getattr(B, "_fingw", None) is None:
        w = np.zeros(len(B.P))
        for bn, lst in BH.skel()["w"].items():
            if not bn.startswith("finger"):
                continue
            f, j = bn[6:].split(".")[0].split("-")
            k = 1.0 if j in ("2", "3") else (0.5 if f != "1" else 0.0)
            for vi, ww in lst:
                if vi < len(w):
                    w[vi] += ww * k
        B._fingw = w
    return B._fingw


# ----------------------------------------------------------------------------------------------------------------
# coverage fields
# ----------------------------------------------------------------------------------------------------------------
def landmarks(B):
    J, k = B.Jm, B.H / 1.75
    P = B.P[B.bodyv]
    vb = np.array(B.vb)[B.bodyv]
    m = (np.abs(P[:, 0]) < 0.02) & np.isin(vb, ["hips", "thigh_L", "thigh_R"])
    crotch = P[m, 1].min() if m.any() else J["hip_L"][1] - 0.12 * k
    sh_y = J["shoulder_L"][1]
    return dict(k=k, sh=sh_y, hip=J["hip_L"][1], pel=J["pelvis"][1], spn=J["spine"][1], ch=J["chest"][1], ank=J["ankle_L"][1],
                knee=J["knee_L"][1], nb=sh_y + 0.04 * k, crotch=crotch, neck=J["neck"])


def neck_line(B, back, dip, LM):
    P = B.P
    th = np.arctan2(P[:, 0], P[:, 2] - LM["neck"][2])
    front = np.clip(np.cos(th), 0, 1) ** 2
    return LM["nb"] + back * LM["k"] - dip * LM["k"] * front


def f_top(g, B, LM, cov):
    P, y, k = B.P, B.P[:, 1], LM["k"]
    vc = B._vc
    neck_y = neck_line(B, g["neck"][0], g["neck"][1], LM)
    hem_y = LM["hip"] + g["hem"] * k
    if g.get("poncho"):
        hem_y = LM["ch"] + 0.0 * k
    elif g.get("tail"):
        hem_y = max(hem_y, LM["crotch"] + 0.045 * k)
    g["_hem_y"] = hem_y
    f = B.tw * np.minimum(neck_y - y, y - hem_y) + B.legs * (y - hem_y)
    sleeve = g.get("sleeve", "long")
    for s in "LR":
        sa, _, _, cum = vc["arm" + s]
        end = {"long": cum[2] - 0.012, "elbow": cum[1] + 0.035, "short": cum[1] * 0.42, "none": -0.035, "poncho": cum[1] + 0.02,
               "cap": 0.05}.get(sleeve, cum[2] - 0.012)
        if g.get("cuff") == "rib" and sleeve == "long":
            end = cum[2] - 0.02
        f = f + B.aw[s] * (end - sa)
    if g.get("open_front"):
        yb = LM["ch"] - 0.02 * k
        t = np.clip((y - yb) / max(LM["nb"] - yb, 1e-3), 0, 1)
        w = g["open_front"] * k * t + 0.006 * t
        front = (P[:, 2] - vc["zc"]) > 0
        f = np.where(front & (y > yb), np.minimum(f, np.abs(P[:, 0]) - w), f)
    return f


def f_bottom(g, B, LM, cov, feet):
    y, k = B.P[:, 1], LM["k"]
    top_y = (LM["pel"] + LM["spn"]) / 2 + g.get("top", 0.012) * k
    shape = g.get("shape", "trousers")
    collar_y, boot_top, shaft = cov["_collar_y"], cov["_boot_top"], cov["_shaft"]
    if shape == "shorts":
        hem = LM["knee"] + 0.1 * k
    elif shape == "leg_wraps":
        lo = boot_top - 0.02 if shaft else collar_y - 0.012
        return B.legs * np.minimum((LM["knee"] - 0.045 * k) - y, y - lo) - (1 - B.legs) * 0.2
    elif shaft and (g.get("tuck") or shape == "leggings"):
        hem = boot_top - 0.035
    elif shaft:
        hem = max(collar_y + 0.012, LM["ank"] + 0.035 * k)
    else:
        hem = collar_y - 0.028 if feet is None or not feet.get("sandal") else LM["ank"] + 0.03 * k
    if feet is not None and feet.get("sandal") and shape in ("trousers", "leggings"):
        hem = LM["ank"] + 0.035 * k
    g["_hem_y"] = hem
    return B.tw * (top_y - y) + B.legs * np.minimum(top_y - y, y - hem) - B.arms * 0.2


def f_limb(g, B, LM, cov):
    y, k = B.P[:, 1], LM["k"]
    vc = B._vc
    shape = g["shape"]
    f = np.full(len(y), -1.0)
    for s in "LR":
        if g.get("side") and g["side"] not in ("both", s):
            continue
        sa, aa, ra, cum = vc["arm" + s]
        sl, la, rl, lcum = vc["leg" + s]
        aw, lw = B.aw[s], B.lw[s]
        if shape == "forearm_wrap":
            fs = aw * np.minimum(sa - (cum[1] + 0.005), (cum[2] + 0.018) - sa) - (1 - aw) * 0.2
        elif shape == "forearm_guard":
            fs = aw * np.minimum(np.minimum(sa - (cum[1] + 0.045), (cum[2] - 0.03) - sa), np.radians(115 - np.abs(aa - 60)) * ra) - (1 - aw) * 0.2
        elif shape == "shin_wrap":
            lo = cov["_boot_top"] - 0.015 if cov["_shaft"] else cov["_collar_y"] + 0.005
            fs = lw * np.minimum(y - lo, (LM["knee"] - 0.06 * k) - y) - (1 - lw) * 0.2
        elif shape == "knee_pad":
            kl = lcum[1]
            e = ((sl - kl - 0.008) / (0.068 * k)) ** 2 + (la / 62.0) ** 2
            pad = (1 - np.sqrt(e)) * 0.05
            strap = np.minimum(0.011 - np.abs(sl - kl - 0.085 * k), 0.4) * (np.abs(la) > 40)
            strap2 = np.minimum(0.009 - np.abs(sl - kl + 0.075 * k), 0.4) * (np.abs(la) > 40)
            fs = lw * np.maximum(pad, np.maximum(strap, strap2)) - (1 - lw) * 0.2
        else:
            continue
        f = np.maximum(f, fs)
    return f


def f_hands(g, B, LM, cov):
    vc = B._vc
    f = np.full(len(B.P), -1.0)
    fw = finger_weight(B)
    for s in "LR":
        if g.get("side", "both") not in ("both", s):
            continue
        sa, _, _, cum = vc["arm" + s]
        aw = B.aw[s]
        fs = aw * (sa - (cum[2] - 0.035)) - (1 - aw) * 0.2
        if g.get("fingerless"):
            fs = np.minimum(fs, (0.42 - fw) * 0.04)
        f = np.maximum(f, fs)
    return f


def strap_plane(B, LM, side, width, lo_y=None):
    """Diagonal band from one shoulder top to the opposite hip, over the front and the back."""
    J, k = B.Jm, LM["k"]
    s = 1 if side == "L" else -1
    p0 = np.array([0.105 * s * k, LM["sh"] + 0.065 * k, J["shoulder_L"][2]])
    p1 = np.array([-0.14 * s * k, LM["spn"] - 0.11 * k, J["spine"][2]])
    d = p1 - p0
    nP = np.cross(d, [0, 0, 1.0])
    nP /= np.linalg.norm(nP)
    dist = (B.P - p0) @ nP
    f = width / 2 - np.abs(dist)
    f = f * B.tw - B.arms * 0.3 - B.hw * 0.3
    return np.where(B.P[:, 1] > LM["spn"] - 0.18 * k, f, -0.1)


def f_over(g, B, LM, cov):
    P, y, k = B.P, B.P[:, 1], LM["k"]
    vc = B._vc
    th, r = vc["th"], vc["r"]
    shape = g["shape"]
    tor = B.tw - B.hw - B.W[:, BH.BI["neck"]] * 0.5
    if shape in ("vest", "cuirass"):
        neck_y = neck_line(B, 0.0 if shape == "vest" else 0.01, 0.12 if shape == "vest" else 0.05, LM)
        hem = LM["hip"] + g.get("hem", -0.04) * k
        f = B.tw * np.minimum(neck_y - y, y - hem) + B.legs * (y - hem)
        for s in "LR":
            sa = vc["arm" + s][0]
            f = f + B.aw[s] * ((-0.035 if shape == "vest" else -0.02) - sa)
        if shape == "vest":    # armholes cut a little deeper into the side
            f = np.minimum(f, (np.abs(np.abs(th) - 90) * 0.0175 * r - 0.03) + ss(LM["sh"] - 0.13, LM["sh"] - 0.17, y))
        return f
    if shape == "carrier":
        fr = np.radians(62 - np.abs(th)) * r
        bk = np.radians(np.abs(th) - 118) * r
        y0, y1 = LM["spn"] - 0.075 * k, LM["ch"] + 0.13 * k
        front = np.minimum(np.minimum(fr, y - y0), y1 - y)
        back = np.minimum(np.minimum(bk, y - y0), (LM["sh"] - 0.04 * k) - y)
        strap = np.minimum(0.028 - np.abs(np.abs(P[:, 0]) - 0.085 * k), y - (LM["ch"] + 0.05 * k))
        cumm = np.minimum(y - y0, (y0 + 0.14 * k) - y)
        f = np.maximum(np.maximum(front, back), np.maximum(strap, cumm))
        return f * np.clip(tor * 1.4, 0, 1) - B.arms * 0.3 - (1 - np.clip(tor * 1.4, 0, 1)) * 0.05
    if shape == "harness":
        belt_y = LM["spn"] - 0.055 * k
        belt = (0.022 * k - np.abs(y - belt_y)) * B.tw - B.arms * 0.3 - B.legs * 0.0
        return np.maximum(strap_plane(B, LM, "L", 0.042 * k), belt)
    if shape == "strap":
        return strap_plane(B, LM, g.get("side", "L"), g.get("width", 0.04) * k)
    if shape == "belt":
        belt_y = LM["spn"] - 0.055 * k if not g.get("waist") else LM["spn"] + 0.0
        return (g.get("width", 0.03) * k / 2 - np.abs(y - belt_y)) * (B.tw + B.legs) - B.arms * 0.3
    if shape == "sash":
        belt_y = LM["spn"] - 0.01 * k
        return (g.get("width", 0.08) * k / 2 - np.abs(y - belt_y)) * (B.tw + B.legs) - B.arms * 0.3
    if shape == "pauldron":
        f = np.full(len(y), -1.0)
        for s, sg in (("L", 1), ("R", -1)):
            if g.get("side", "L") not in ("both", s):
                continue
            c = B.Jm["shoulder_" + s] + np.array([0.015 * sg, 0.045 * k, 0.0])
            d = np.linalg.norm((P - c) * np.array([1.0, 1.25, 1.1]), axis=1)
            fs = (g.get("radius", 0.105) * k - d) * ((P[:, 0] * sg) > 0.1 * k) * (1 - B.hw)
            fs = np.minimum(fs, y - (LM["sh"] - 0.13 * k))
            f = np.maximum(f, fs)
        return f
    if shape == "gorget":
        c = np.array([0.0, LM["sh"] + 0.0 * k, LM["neck"][2] + 0.03 * k])
        e = np.linalg.norm((P - c) / np.array([0.15, 0.085, 0.11]) / k, axis=1)
        frontish = (P[:, 2] - vc["zc"]) > -0.035 * k
        f = (1 - e) * 0.06 * frontish - (1 - frontish) * 0.05
        return np.minimum(f, neck_line(B, 0.05, 0.0, LM) + 0.015 * k - y) - B.hw * 0.3
    if shape == "epaulettes":
        f = np.full(len(y), -1.0)
        for s, sg in (("L", 1), ("R", -1)):
            a = np.array([0.065 * sg * k, LM["nb"] - 0.005, B.Jm["shoulder_" + s][2]])
            b = np.array([0.175 * sg * k, LM["sh"] + 0.04 * k, B.Jm["shoulder_" + s][2]])
            ab = b - a
            t = np.clip((P - a) @ ab / (ab @ ab), 0, 1)
            d = np.linalg.norm((P - (a[None] + t[:, None] * ab[None])) * np.array([1.0, 0.25, 1.0]), axis=1)
            fs = (0.02 * k - d) * (B.N[:, 1] > 0.15)
            f = np.maximum(f, fs)
        return f - B.hw * 0.3
    if shape == "half_cape":
        sg = 1 if g.get("side", "L") == "L" else -1
        back = (P[:, 2] - vc["zc"]) < 0.01
        reg_b = np.minimum(P[:, 0] * sg + 0.07 * k, y - (LM["spn"] + 0.1 * k)) * back
        reg_s = np.minimum(y - (LM["sh"] - 0.04 * k), P[:, 0] * sg - 0.03 * k) * (~back)
        f = np.maximum(np.where(back, reg_b, -1), np.where(~back, reg_s, -1))
        sa = vc["arm" + ("L" if sg > 0 else "R")][0]
        f = np.maximum(f, B.aw["L" if sg > 0 else "R"] * (0.16 - sa) - (1 - B.aw["L" if sg > 0 else "R"]) * 0.3)
        f = np.minimum(f, neck_line(B, 0.012, 0.03, LM) - y + 0.0 * k) - B.hw * 0.3
        return f
    if shape == "mantle":
        sg = 1 if g.get("side", "L") == "L" else -1
        s = "L" if sg > 0 else "R"
        f = strap_plane(B, LM, s, 0.2 * k)
        sa = vc["arm" + s][0]
        f = np.maximum(f, B.aw[s] * (0.13 - sa) - (1 - B.aw[s]) * 0.3)
        f = np.maximum(f, np.minimum(y - (LM["sh"] - 0.06 * k), P[:, 0] * sg - 0.02 * k) * B.tw)
        f = np.minimum(f, neck_line(B, 0.0, 0.03, LM) - 0.004 - y)
        return f - B.hw * 0.3
    if shape == "plates":
        return f_plates(g, B, LM)
    raise KeyError(shape)


def f_plates(g, B, LM):
    """Continuum: segmented ceramic plates (chest, abdomen bands, back, pauldrons, bracers, thighs, shins)."""
    P, y, k = B.P, B.P[:, 1], LM["k"]
    vc = B._vc
    th, r = vc["th"], vc["r"]
    tor = np.clip((B.tw - B.hw - B.W[:, BH.BI["neck"]]) * 1.5, 0, 1)
    fr = np.radians(58 - np.abs(th)) * r
    bk = np.radians(np.abs(th) - 125) * r
    chest = np.minimum(np.minimum(fr, y - (LM["ch"] + 0.0 * k)), (LM["sh"] - 0.035 * k) - y)
    chest = np.minimum(chest, 0.004 + np.abs(P[:, 0]) * 0.0 + 0.2)
    abd = np.minimum(np.minimum(np.radians(40 - np.abs(th)) * r, y - (LM["spn"] - 0.06 * k)), (LM["ch"] - 0.012 * k) - y)
    for gy in (LM["spn"] - 0.012 * k, LM["spn"] + 0.04 * k, LM["ch"] - 0.012 * k):
        abd = np.minimum(abd, np.abs(y - gy) - 0.004)
    back = np.minimum(np.minimum(bk, y - (LM["ch"] - 0.06 * k)), (LM["sh"] - 0.02 * k) - y)
    back = np.minimum(back, np.abs(P[:, 0]) - 0.008)       # split down the spine (stabilizer mount)
    f = np.maximum(np.maximum(chest, abd), back) * tor - (1 - tor) * 0.1
    for s, sg in (("L", 1), ("R", -1)):
        c = B.Jm["shoulder_" + s] + np.array([0.02 * sg, 0.04 * k, 0.0])
        d = np.linalg.norm((P - c) * np.array([1.0, 1.3, 1.05]), axis=1)
        pa = np.minimum((0.1 * k - d) * ((P[:, 0] * sg) > 0.105 * k), y - (LM["sh"] - 0.12 * k))
        pa = np.minimum(pa, np.abs(y - (LM["sh"] - 0.035 * k)) - 0.004)      # two lames
        sa, aa, ra, cum = vc["arm" + s]
        br = B.aw[s] * np.minimum(np.minimum(sa - (cum[1] + 0.05), (cum[2] - 0.035) - sa), np.radians(100 - np.abs(aa - 50)) * ra) - (1 - B.aw[s]) * 0.2
        sl, la, rl, lc = vc["leg" + s]
        th_ = B.lw[s] * np.minimum(np.minimum(sl - 0.1 * k, (lc[1] - 0.075 * k) - sl), np.radians(50 - np.abs(la)) * rl) - (1 - B.lw[s]) * 0.2
        sh_ = B.lw[s] * np.minimum(np.minimum(sl - (lc[1] + 0.06 * k), (lc[2] - 0.1 * k) - sl), np.radians(48 - np.abs(la)) * rl) - (1 - B.lw[s]) * 0.2
        kn = B.lw[s] * ((0.045 * k) - np.hypot(sl - lc[1] - 0.005, np.radians(la) * rl)) - (1 - B.lw[s]) * 0.2
        f = np.maximum.reduce([f, pa, br, th_, sh_, kn])
    return f


def f_feet(g, B, LM, cov, c):
    y, H = B.P[:, 1], B.H
    collar_y = LM["ank"] + 0.035 * LM["k"]
    shaft_h = g.get("shaft", 0.0) if g else c.get("boots", 0.10)
    boot_top = (0.045 + shaft_h) * H
    shaft = bool(g) and not g.get("sandal") and boot_top > collar_y + 0.025
    cov["_collar_y"], cov["_boot_top"], cov["_shaft"] = collar_y, boot_top, shaft
    if g is not None and g.get("sandal"):
        return None, None
    inshoe = B.legs * (collar_y - 0.02 - y) - (1 - B.legs) * 0.2
    sh = B.legs * np.minimum(boot_top - y, y - (collar_y - 0.035)) - (1 - B.legs) * 0.2 if shaft else None
    return inshoe, sh


def head_fields(c, B, cos, cov):
    """Hair / hood / head-wrap fields (legacy formulas: the head pieces are shared with the old pipeline)."""
    P, y = B.P, B.P[:, 1]
    rel = P - B.L.eye
    LM = landmarks(B)
    sh_y, k = LM["sh"], LM["k"]
    male = c["macro"].get("gender", 0.5) >= 0.5
    old = c["macro"].get("age", 0.5) > 0.8
    style = c.get("hair", "short")
    kinds = {h["kind"]: h for h in cos["head"]}
    head = B.hw + B.W[:, BH.BI["neck"]] * 0.5
    if "hood_up" in kinds:
        o = (rel[:, 0] / 0.076) ** 2 + ((rel[:, 1] + 0.022) / 0.1) ** 2 + (np.minimum(0, rel[:, 2] + 0.002) / 0.035) ** 2
        f = (np.sqrt(o) - 1) * 0.07
        f = np.where(y > sh_y - 0.03 * k, f, f - (sh_y - 0.03 * k - y) * 4)
        cov["hood"] = np.minimum(f, 0.12)
        style = "none"
    if "head_wrap" in kinds:
        th2 = np.degrees(np.abs(np.arctan2(rel[:, 0], rel[:, 2] + 0.085)))
        line = np.interp(th2, [0, 35, 62, 85, 110, 140, 180], [0.05, 0.045, 0.012, -0.02, -0.045, -0.06, -0.065])
        w = np.clip(B.hw + B.W[:, BH.BI["neck"]], 0, 1)
        cov["scarf"] = w * (rel[:, 1] - line) - (1 - w) * 0.03
        style = "none" if style not in ("bun",) else "bun_hidden"
    if "helmet" in kinds:
        style = "fade" if style not in ("none",) else style
    hwt = np.clip((head - 0.2) / 0.3, 0, 1)
    if style not in ("none", "bun_hidden"):
        cov["hair"] = hwt * (rel[:, 1] - BH.hairline(rel, style, male, old)) - (1 - hwt) * 0.05
    elif style == "bun_hidden" or "hood_up" in kinds:
        cov["_hairpaint"] = hwt * (rel[:, 1] - BH.hairline(rel, c.get("hair", "short"), male, old)) - (1 - hwt) * 0.05
    for key in ("hair", "_hairpaint"):
        if key in cov:
            cov[key] = cov[key] - B.ear * 0.05
    cov["_style"] = style


def fields(c, B):
    chains(B)
    cos = G.resolve(c)
    LM = landmarks(B)
    cov = {"_costume": cos, "_lm": LM}
    cov["_neck_y"] = neck_line(B, 0.02, 0.03, LM)
    feet = cos["feet"]
    inshoe, shaft = f_feet(feet, B, LM, cov, c)
    stack = []
    if inshoe is not None:
        cov["inshoe"] = inshoe
    if shaft is not None:
        g = dict(cat="shaft", z=25 if any(b.get("tuck") or b.get("shape") == "leggings" for b in cos["bottom"]) else 15, fab=feet.get("fab", "leather"),
                 color=feet["color"], gloss=feet.get("gloss", 0.4), det=shaft_dets(feet), thick=0.0075, loose=4, rim=0.0, hides=True, type=feet["type"],
                 wear=feet.get("wear", 0.0), glow=None, design=feet.get("design"))
        stack.append(("shaft", g, shaft))
    for i, g in enumerate(cos["bottom"]):
        stack.append((f"bottom{i}", g, f_bottom(g, B, LM, cov, feet)))
        g.setdefault("hides", True)
    for i, g in enumerate(cos["top"]):
        stack.append((f"top{i}", g, f_top(g, B, LM, cov)))
        g.setdefault("hides", True)
    for i, g in enumerate(cos["limb"]):
        stack.append((f"limb{i}", g, f_limb(g, B, LM, cov)))
        g.setdefault("hides", g["shape"] in ("forearm_wrap", "shin_wrap"))
    for i, g in enumerate(cos["hands"]):
        stack.append((f"hands{i}", g, f_hands(g, B, LM, cov)))
        g.setdefault("hides", True)
    over = list(cos["over"])
    for tg in cos["top"]:   # pieces that come with a top
        if tg.get("plates"):
            over.append(dict(G.O(shape="plates", thick=0.0085, fab="ceramic", gloss=0.85, rim=0.0075, det=["plate_bevel"], z=66), type="continuum_plates",
                             color=tg.get("c2", "e6e8ea"), c3=tg.get("c3", "d9a441"), glow=tg.get("glow"), glow_level=tg.get("glow_level", 0.5), wear=0.0))
        if tg.get("gorget"):
            over.append(dict(G.GARMENTS["gorget"], type="gorget", color=tg.get("gorget_color", "8a9098"), glow=tg.get("glow"),
                             glow_level=tg.get("glow_level", 0.5), wear=0.0, det=["gorget_lines"]))
        if tg.get("shoulder_caps"):
            over.append(dict(G.O(shape="pauldron", side="both", radius=0.085, thick=0.0055, fab="softshell", gloss=0.25, rim=0.005, det=["lames"], z=64),
                             type="shoulder_caps", color=tg.get("cap_color") or "%02x%02x%02x" % tuple((G.hexc(tg["color"]) * 255 * 1.25).clip(0, 255).astype(int)),
                             glow=None, wear=0.0))
        if tg.get("epaulettes"):
            over.append(dict(G.GARMENTS["epaulettes"], type="epaulettes", color=tg["color"], c3=tg.get("c3"), det=["epaulette"], glow=None, wear=0.0))
        if tg.get("belt"):
            over.append(dict(G.GARMENTS["leather_belt"], type="coat_belt", color=tg["color"], fab=tg.get("fab", "cotton"), gloss=tg.get("gloss", 0.1),
                             det=["belt_holes"], glow=None, wear=0.0, buckle=True, width=0.04))
    for i, g in enumerate(over):
        stack.append((f"over{i}", g, f_over(g, B, LM, cov)))
        g.setdefault("hides", g.get("shape") in ("vest", "carrier", "cuirass"))
    stack.sort(key=lambda s: s[1].get("z", 50))
    for key, g, f in stack:
        cov[key] = f
    cov["_stack"] = stack
    head_fields(c, B, cos, cov)
    return cov


def shaft_dets(feet):
    d = feet.get("design", "")
    if d in ("lace_boot", "tech_boot", "safety"):
        return ["laces", "boot_collar"]
    if d == "wrapped":
        return ["wraps", "wear"]
    if d == "chelsea":
        return ["gusset", "boot_collar"]
    return ["boot_collar"]


def hide_field(cov):
    g = [cov[k] for k, gg, _ in cov["_stack"] if gg.get("hides", True)]
    if "inshoe" in cov:
        g.append(cov["inshoe"])
    if "hair" in cov and BH.SHELL.get(cov["_style"], 0) > 0.003:
        g.append(cov["hair"] - 0.03)
    for k in ("scarf", "hood"):
        if k in cov:
            g.append(cov[k] - 0.03)
    return np.max(np.stack(g), 0)


# ----------------------------------------------------------------------------------------------------------------
# layers
# ----------------------------------------------------------------------------------------------------------------
def build_layers(c, B, cov):
    """Garment layers, inner to outer (dict key -> Layer); the skin / hair / hood layers are built by build_humans."""
    stack = cov["_stack"]
    LM = cov["_lm"]
    OFF = np.zeros(len(B.P))
    layers = {}
    band = 0.025
    for i, (key, g, f) in enumerate(stack):
        above = [ff for kk, gg, ff in stack[i + 1:] if gg.get("hides", True) and gg.get("cat") not in ("head",)]
        fld = f
        if above:
            fld = np.minimum(f, band - np.max(np.stack(above), 0))
        L = BH.build_layer(B, key, fld)
        if L is None:
            continue
        L.cov = f[L.base]          # painter / taper use the item's own field
        BH.taubin(L, int(g.get("loose", 4)))
        below = OFF[L.base]
        own = g.get("thick", 0.006) * (0.45 + 0.55 * ss(0.0, 0.02, L.cov))
        BH.offset_layer(L, B, below + own)
        if g.get("inflate"):
            BH.inflate(L, B, g["inflate"])
            BH.taubin(L, 2)
        shape_layer(L, B, g, LM, cov)
        push_out(L, B, below + 0.0014)
        d = ((L.pos - B.P[L.base]) * B.N[L.base]).sum(1)
        OFF[L.base] = np.maximum(OFF[L.base], d * ss(-0.004, 0.012, L.cov))
        L.mask[:, 1] = g.get("gloss", 0.0)
        L.g = g
        layers[key] = L
    cov["_OFF"] = OFF
    for key, L in layers.items():   # cloth tails, then rims (hems with real thickness)
        g = L.g
        if g.get("cat") == "top" and (g.get("tail") or g.get("poncho")):
            extend_tail(L, B, g, LM, cov, layers)
    for key, L in layers.items():
        if L.g.get("rim", 0) > 0:
            add_rims(L, B, L.g["rim"])
    return layers


def push_out(L, B, need):
    n = B.N[L.base]
    for _ in range(2):
        d = ((L.pos - B.P[L.base]) * n).sum(1)
        short = np.maximum(need - d, 0)
        if not short.any():
            return
        L.pos = L.pos + n * short[:, None]
        BH.taubin(L, 1)


def shape_layer(L, B, g, LM, cov):
    """Per-garment shaping after the offset: wide legs, bloused / cinched hems, wide poncho sleeves, pad domes."""
    vc = B._vc
    base = L.base
    if g.get("ease") and g.get("cat") in ("top", "bottom"):
        ease_limbs(L, B, g["ease"], "arm" if g["cat"] == "top" else "leg")
    P = L.pos
    if g.get("cat") == "bottom":
        if g.get("flare"):
            for s in "LR":
                sl, la, rl, lc = vc["leg" + s]
                m = B.lw[s][base] > 0.5
                t = ss(lc[1] - 0.05, lc[2], sl[base]) * m
                ax = axis_point(P, B.Jm["knee_" + s], B.Jm["ankle_" + s])
                dirn = P - ax
                dirn /= np.maximum(np.linalg.norm(dirn, axis=1, keepdims=True), 1e-6)
                L.pos = L.pos + dirn * (g["flare"] * t)[:, None]
        if g.get("tuck") and cov.get("_shaft"):
            hb = cov["_boot_top"]
            bump = 0.006 * g2((P[:, 1] - hb - 0.03) ** 2, 0.02) * B.legs[base]
            L.pos = L.pos + B.N[base] * bump[:, None]
        if g.get("cinch"):
            hem = g.get("_hem_y", 0.1)
            pull = -0.003 * ss(hem + 0.06, hem + 0.02, P[:, 1]) * B.legs[base]
            L.pos = L.pos + B.N[base] * pull[:, None]
    if g.get("cat") == "top" and g.get("sleeve") == "poncho":
        for s in "LR":
            sa, _, _, cum = vc["arm" + s]
            m = B.aw[s][base]
            t = ss(0.02, cum[1] + 0.02, sa[base]) * m
            ax = axis_point(P, B.Jm["shoulder_" + s], B.Jm["elbow_" + s])
            dirn = P - ax
            dirn /= np.maximum(np.linalg.norm(dirn, axis=1, keepdims=True), 1e-6)
            dirn = dirn * 0.5 + np.array([0, -1.0, 0]) * 0.5
            L.pos = L.pos + dirn * (0.045 * t ** 1.3)[:, None]
    if g.get("shape") == "knee_pad":
        dome = 0.006 * ss(0.0, 0.025, L.cov)
        L.pos = L.pos + B.N[base] * dome[:, None]
    if g.get("shape") in ("pauldron", "plates"):
        dome = 0.004 * ss(0.0, 0.03, L.cov)
        L.pos = L.pos + B.N[base] * dome[:, None]


def ease_limbs(L, B, ease, kind):
    """Cloth does not follow every muscle: each sleeve / trouser leg becomes a smooth tube around the limb (per angle,
    the radius is the max over a window along the limb), plus some ease. Shoulders / hips / cuffs blend back."""
    vc = B._vc
    for s in "LR":
        sl, ang, rad, cum = vc[kind + s]
        w = (B.aw[s] if kind == "arm" else B.lw[s])[L.base]
        m = np.nonzero(w > 0.3)[0]
        if len(m) < 20:
            continue
        pts = (B.Jm["shoulder_" + s], B.Jm["elbow_" + s], B.Jm["wrist_" + s]) if kind == "arm" else (B.Jm["hip_" + s], B.Jm["knee_" + s], B.Jm["ankle_" + s])
        P = L.pos[m]
        s2, a2, r2, _ = limb_coords(P, list(pts), kind, 1 if s == "L" else -1)
        nb_s, nb_a = 40, 24
        si = np.clip((s2 / max(cum[2], 1e-3) * nb_s).astype(int), 0, nb_s - 1)
        ai = ((a2 + 180) / 360 * nb_a).astype(int) % nb_a
        R = np.zeros((nb_s, nb_a))
        np.maximum.at(R, (si, ai), r2)
        win = 2 if kind == "arm" else 3
        Rw = R.copy()
        for d in range(1, win + 1):
            Rw[d:] = np.maximum(Rw[d:], R[:-d])
            Rw[:-d] = np.maximum(Rw[:-d], R[d:])
        Rw = (np.roll(Rw, 1, 1) + 2 * Rw + np.roll(Rw, -1, 1)) / 4
        tgt = Rw[si, ai] * (0.94 if kind == "arm" else 0.97) + ease * (0.5 if kind == "arm" else 1.0)
        # fade near the joint with the torso and at the cuff / hem
        t = s2 / max(cum[2], 1e-3)
        fade = ss(0.02, 0.12, t) * ss(1.02, 0.9, t) * np.clip((w[m] - 0.3) / 0.4, 0, 1)
        newr = r2 + np.maximum(tgt - r2, 0) * fade
        ax = np.zeros_like(P)
        for a, b in zip(pts[:-1], pts[1:]):
            pass
        # radial direction from the chain: rebuild from the nearest segment
        best = np.full(len(P), np.inf)
        for a, b in zip(pts[:-1], pts[1:]):
            q = axis_point(P, a, b)
            d = np.linalg.norm(P - q, axis=1)
            mm = d < best
            best[mm] = d[mm]
            ax[mm] = q[mm]
        dirn = (P - ax) / np.maximum(best, 1e-6)[:, None]
        L.pos[m] = ax + dirn * newr[:, None]


def axis_point(P, a, b):
    ab = b - a
    t = np.clip((P - a) @ ab / (ab @ ab), 0, 1)
    return a + t[:, None] * ab


def vertex_uv(L):
    uv = np.zeros((len(L.pos), 2))
    for f, fu in zip(L.faces, L.fuv):
        for v, u in zip(f, fu):
            uv[v] = u
    return uv


def add_rims(L, B, depth):
    """Real thickness at the garment's own open borders: a strip from every border edge down toward the layer below
    (built per edge, so it never depends on loop order). Hide cuts (under an outer garment) and the tail lining get none."""
    e = L.edges()
    border = [(i, j) for (i, j), n in e.items() if n == 1]
    if not border:
        return
    N = BH.layer_normals(L, B)
    tm = getattr(L, "tail_mask", None)
    if tm is not None and getattr(L, "tailN", None) is not None:
        N[tm] = L.tailN
    skip = getattr(L, "_lining", set())
    # directed border edges (as they appear in faces) + the face's third vertex: the garment side of the edge
    side = {}
    for f in L.faces:
        k = len(f)
        for a in range(k):
            i, j = f[a], f[(a + 1) % k]
            key = (min(i, j), max(i, j))
            if e.get(key) == 1:
                side[key] = (i, j, f[(a + 2) % k])
    uv = vertex_uv(L)
    nv0 = len(L.pos)
    newid = {}
    add_p, add_i = [], []
    faces, fuv = [], []
    for key, (i, j, o) in side.items():
        if i in skip or j in skip:
            continue
        own = L.cov[[i, j]]
        if (tm is None or not (tm[i] or tm[j])) and own.min() > 0.012:
            continue                      # a hide cut, not a hem
        for v in (i, j):
            if v not in newid:
                dep = L.tail_thick if tm is not None and tm[v] else depth
                newid[v] = nv0 + len(add_p)
                add_p.append(L.pos[v] - N[v] * dep)
                add_i.append(v)
        # face i->j belongs to the garment; the rim continues it: (j, i, i', j') keeps a consistent winding
        faces.append([j, i, newid[i], newid[j]])
        fuv.append(np.array([uv[j], uv[i], uv[i], uv[j]]))
    if not faces:
        return
    idx = np.array(add_i)
    L.pos = np.concatenate([L.pos, np.array(add_p)])
    L.W = np.concatenate([L.W, L.W[idx]])
    L.base = np.concatenate([L.base, L.base[idx]])
    L.cov = np.concatenate([L.cov, L.cov[idx]])
    L.mask = np.concatenate([L.mask, L.mask[idx]])
    if tm is not None:
        L.tail_mask = np.concatenate([tm, np.zeros(len(idx), bool)])
    L._rim = set(range(nv0, len(L.pos)))
    L._rim_src = {nv0 + i: int(v) for i, v in enumerate(idx)}
    L.faces += faces
    L.fuv += fuv


def sorted_loop(P, lp, axis="y", center=None):
    """Loop vertices ordered by azimuth around the loop's centre (robust for neck / hem / cuff loops)."""
    Q = P[lp]
    c = Q.mean(0) if center is None else center
    if axis == "y":
        ang = np.arctan2(Q[:, 0] - c[0], Q[:, 2] - c[2])
    else:
        d = axis / np.linalg.norm(axis)
        u = np.cross(d, [0, 0, 1.0])
        u /= max(np.linalg.norm(u), 1e-6)
        w = np.cross(d, u)
        ang = np.arctan2((Q - c) @ u, (Q - c) @ w)
    o = np.argsort(ang)
    return [lp[i] for i in o]


def resample_loop(Q, n, smooth=3):
    """Closed polyline -> n points evenly spaced by arc length, after a little smoothing."""
    for _ in range(smooth):
        Q = (np.roll(Q, 1, 0) + 2 * Q + np.roll(Q, -1, 0)) / 4
    seg = np.linalg.norm(np.roll(Q, -1, 0) - Q, axis=1)
    cum = np.r_[0, np.cumsum(seg)]
    t = np.linspace(0, cum[-1], n, endpoint=False)
    Qc = np.concatenate([Q, Q[:1]])
    return np.stack([np.interp(t, cum, Qc[:, k]) for k in range(3)], 1)


def garment_loops(L):
    """The layer's own open borders (not its rim strips or tail lining)."""
    rim, lin = getattr(L, "_rim", set()), getattr(L, "_lining", set())
    src = getattr(L, "_rim_src", {})
    out = []
    for lp in L.boundary_loops():
        if sum(v in lin for v in lp) > len(lp) / 2:
            continue
        if sum(v in rim for v in lp) > len(lp) / 2:      # a rim's inner edge: the garment border it was built from
            lp = [src[v] for v in lp if v in src]
        out.append(lp)
    return out


# ----------------------------------------------------------------------------------------------------------------
# cloth tails: lofted from the layer's own hem loop
# ----------------------------------------------------------------------------------------------------------------
def radial_table(pts, cz_of, ys, nb=72):
    """Max radius of points around (0, cz(y)) per height row and angle bin (MH coords; angle 0 = front)."""
    R = np.zeros((len(ys), nb))
    ang = np.degrees(np.arctan2(pts[:, 0], pts[:, 2] - cz_of(pts[:, 1])))
    rad = np.hypot(pts[:, 0], pts[:, 2] - cz_of(pts[:, 1]))
    bi = ((ang + 180) / 360 * nb).astype(int) % nb
    yi = np.clip(np.round((pts[:, 1] - ys[0]) / (ys[1] - ys[0])).astype(int), 0, len(ys) - 1)
    np.maximum.at(R, (yi, bi), rad)
    for r in range(len(ys)):     # fill empty bins, smooth around
        row = R[r]
        good = np.nonzero(row > 0)[0]
        if len(good) == 0:
            continue
        R[r] = np.interp(np.arange(nb), np.r_[good - nb, good, good + nb], np.r_[row[good], row[good], row[good]])
        R[r] = (np.roll(R[r], 1) + 2 * R[r] + np.roll(R[r], -1)) / 4
    for r in range(1, len(ys)):  # fill empty rows from above
        if not R[r].any():
            R[r] = R[r - 1]
    return R


def extend_tail(L, B, g, LM, cov, layers):
    loops = L.boundary_loops()
    if not loops:
        return
    hem_y = g["_hem_y"]
    cand = [lp for lp in loops if len(lp) > 20 and abs(L.pos[lp, 1].mean() - hem_y) < 0.06 and np.abs(L.pos[lp, 0]).mean() < 0.15]
    if not cand:
        print("  ! no hem loop for tail of", g["type"])
        return
    cz = lambda yy: zc_at(B, yy)
    lp = max(cand, key=len)
    lp = sorted_loop(L.pos, lp, center=np.array([0.0, 0.0, cz(float(L.pos[lp, 1].mean()))]))
    P0 = L.pos[lp]
    ang = np.degrees(np.arctan2(P0[:, 0], P0[:, 2] - cz(P0[:, 1])))
    # orient: angles increasing; start at the back centre (wrap seam hidden in the vent / at the back)
    da = ((np.diff(np.r_[ang, ang[0]]) + 180) % 360) - 180
    if da.sum() < 0:
        lp = lp[::-1]
        P0, ang = P0[::-1], ang[::-1]
    i0 = int(np.argmin(np.abs(((ang - 180) + 180) % 360 - 180)))
    lp = list(lp[i0:]) + list(lp[:i0])
    P0 = L.pos[lp]
    ang = np.degrees(np.arctan2(P0[:, 0], P0[:, 2] - cz(P0[:, 1])))
    M = len(lp)
    H, k = B.H, LM["k"]
    tl = g.get("tail") or {}
    po = g.get("poncho")
    a = np.abs(((ang + 180) % 360) - 180)          # 0 front .. 180 back
    if po:
        fr = po.get("front") if po.get("front") is not None else po.get("side")
        end = np.interp(a, [0, 60, 100, 180], [fr * H, po["side"] * H, po["side"] * H * 0.92 + po["back"] * H * 0.08, po["back"] * H])
    else:
        end = np.full(M, tl.get("end", 0.3) * H)
    end = np.minimum(end, P0[:, 1] - 0.05)
    # what the tail must clear: body hips / legs + the layers under it
    vb = np.array(B.vb)
    sel = np.isin(vb, ["hips", "spine", "thigh_L", "thigh_R", "shin_L", "shin_R"]) & np.isin(np.arange(len(B.P)), B.bodyv)
    pts = [B.P[sel] + B.N[sel] * 0.004]
    for kk, LL in layers.items():
        if LL is not L and LL.g.get("cat") in ("bottom", "limb", "shaft", "skirt") or (LL is not L and kk.startswith("over") and LL.pos[:, 1].min() < hem_y):
            keep = (LL.pos[:, 1] < hem_y + 0.02) & ((B.aw["L"] + B.aw["R"])[np.asarray(LL.base)] < 0.3)
            pts.append(LL.pos[keep])
    pts = np.concatenate(pts)
    ys = np.arange(0.0, hem_y + 0.06, 0.01)
    R = radial_table(pts, cz, ys)
    nb = R.shape[1]
    rows = 11
    tt = np.linspace(0, 1, rows)
    c0z = cz(P0[:, 1])
    r_prev = np.hypot(P0[:, 0], P0[:, 2] - c0z)
    flare = (tl.get("flare", 0.2) if not po else 0.28) * 0.45
    grid = [P0]
    for t in tt[1:]:
        yy = P0[:, 1] + (end - P0[:, 1]) * t
        czz = cz(np.maximum(yy, LM["crotch"])) * (1 - t * 0.0)
        yi = np.clip(np.round((yy - ys[0]) / 0.01).astype(int), 0, len(ys) - 1)
        bi = ((ang + 180) / 360 * nb).astype(int) % nb
        fit = R[yi, bi] + 0.006 + 0.01 * t
        taper = np.where(yy > LM["hip"], 0.985, 1.0)
        r = np.maximum(r_prev * taper, fit)                      # follows the body, never cuts into it
        rr = r * (1 + flare * t ** 1.3)                          # the hem swings out a little (no compounding)
        q = np.stack([np.sin(np.radians(ang)) * rr, yy, czz + np.cos(np.radians(ang)) * rr], 1)
        grid.append(q)
        r_prev = r
    grid = np.stack(grid)                            # rows x M x 3
    # vents / slits: the ring is cut at a column; below the vent top the two edges spread apart along the ring
    length = np.linalg.norm(np.diff(grid, axis=0), axis=2).sum(0)       # per column
    depth = np.concatenate([np.zeros((1, M)), np.cumsum(np.linalg.norm(np.diff(grid, axis=0), axis=2), 0)])
    col_near = lambda deg: int(np.argmin(np.abs(((ang - deg + 180) % 360) - 180)))
    rmean = float(np.hypot(P0[:, 0], P0[:, 2] - c0z).mean())
    cuts = []                     # (column, vent top depth, gap at the hem (m), fast)
    if tl.get("split"):
        cuts.append((col_near(0), tl["split"] * H, 0.11 * k, False))
    if tl.get("vent"):
        cuts.append((col_near(180), tl["vent"] * H, 0.035 * k, False))
    if tl.get("slits"):
        cuts += [(col_near(90), tl["slits"] * H, 0.06 * k, False), (col_near(-90), tl["slits"] * H, 0.06 * k, False)]
    if po and po.get("open"):
        cuts.append((col_near(0), 0.0, 2 * po["open"] * rmean, True))
    cutcols = sorted({c for c, *_ in cuts})
    grid_paint = grid.copy()
    gridL = {c: grid[:, c].copy() for c in cutcols}
    for r in range(1, rows):
        row = grid[r]
        seg = np.linalg.norm(np.roll(row, -1, 0) - row, axis=1)
        sc = np.r_[0, np.cumsum(seg)]
        S = sc[-1]
        sm = sc[:-1]
        dR = np.zeros(M)
        dL = {c: 0.0 for c in cutcols}
        fall = S / (2 * max(len(cuts), 1))
        for c, d0, gmax, fast in cuts:
            dm = depth[r, c]
            u_ = np.clip((dm - d0) / max(length[c] - d0, 1e-3), 0, 1)
            gap = gmax * (ss(0.0, 0.25, u_) if fast else u_)
            if gap <= 0:
                continue
            dl = ((sm - sm[c] + S / 2) % S) - S / 2
            dR += np.where(dl >= 0, gap / 2 * np.clip(1 - dl / fall, 0, 1), -gap / 2 * np.clip(1 + dl / fall, 0, 1))
            for c2 in cutcols:
                d2 = ((sm[c2] - sm[c] + S / 2) % S) - S / 2
                dL[c2] += -gap / 2 if c2 == c else (gap / 2 * max(0, 1 - d2 / fall) if d2 >= 0 else -gap / 2 * max(0, 1 + d2 / fall))
        rowc = np.concatenate([row, row[:1]])
        at = lambda sv: np.stack([np.interp(sv % S, sc, rowc[:, kk]) for kk in range(3)], -1)
        grid[r] = at(sm + dR)
        for c in cutcols:
            gridL[c][r] = at(np.array([sm[c] + dL[c]]))[0]
    # add vertices (rows 1.. of the outer surface) and the lining (all rows, offset inward)
    nv0 = len(L.pos)
    nc = len(cutcols)
    outer_idx = np.zeros((rows, M), int)
    outer_idx[0] = lp
    newp = grid[1:].reshape(-1, 3)
    outer_idx[1:] = (nv0 + np.arange((rows - 1) * M)).reshape(rows - 1, M)
    Lo = {c: np.r_[lp[c], nv0 + (rows - 1) * M + i * (rows - 1) + np.arange(rows - 1)] for i, c in enumerate(cutcols)}
    newpL = np.concatenate([gridL[c][1:] for c in cutcols]) if nc else np.zeros((0, 3))
    nOut = (rows - 1) * (M + nc)

    def normals_of(gr):
        tu = np.roll(gr, -1, axis=1) - np.roll(gr, 1, axis=1)
        tv = np.concatenate([gr[1:2] - gr[0:1], gr[2:] - gr[:-2], gr[-1:] - gr[-2:-1]])
        nn = np.cross(tv, tu)
        radial = gr - np.stack([np.zeros_like(gr[..., 0]), gr[..., 1], cz(gr[..., 1])], -1)
        sg = np.sign((nn * radial).sum(-1, keepdims=True))
        nn = nn * np.where(sg == 0, 1, sg)
        return nn / np.maximum(np.linalg.norm(nn, axis=-1, keepdims=True), 1e-9)
    nrm = normals_of(grid)
    nrmL = {c: nrm[:, c] for c in cutcols}
    thick = 0.0035
    lining = grid - nrm * thick
    liningL = {c: gridL[c] - nrmL[c] * thick for c in cutcols}
    lin_base = nv0 + nOut
    lin_idx = (lin_base + np.arange(rows * M)).reshape(rows, M)
    LiL = {c: lin_base + rows * M + i * rows + np.arange(rows) for i, c in enumerate(cutcols)}
    # weights: the loop vertices' own weights fading into skirt weights
    Wl = L.W[lp]
    top_z = float(P0[:, 1].mean())
    Wsk = BH.skirt_weights(BH.to_bl_np(grid.reshape(-1, 3)), B.J, H, top_z, long=(end.mean() < LM["knee"] + 0.05)).reshape(rows, M, -1)
    blend = ss(0.0, 0.45, tt)[:, None, None]
    Wt = Wl[None] * (1 - blend) + Wsk * blend
    Wt /= np.maximum(Wt.sum(-1, keepdims=True), 1e-9)
    # aux uv: u = arc along the loop (column), v = down the tail
    du = np.linalg.norm(np.diff(np.r_[P0, P0[:1]], axis=0), axis=1)
    ucol = np.r_[0, np.cumsum(du)]                                    # M+1 (closing column)
    width = ucol[-1]
    tail_len = float(length.max())
    pid = aux_piece(f"tail_{g['type']}", width, tail_len, g, dict(tail=1.0))
    gridc = np.concatenate([grid_paint, grid_paint[:, :1]], 1)
    depthc = np.concatenate([depth, depth[:, :1]], 1)
    lengthc = np.r_[length, length[0]]
    AUX[pid]["grid"] = gridc
    AUX[pid]["edge"] = np.maximum(lengthc[None, :] - depthc, 0)
    AUX[pid]["v_of_row"] = depthc / tail_len
    AUX[pid]["u_of_col"] = ucol / width
    enc = lambda r, col: aux_uv(pid, ucol[col] / width, 1 - min(depth[r, col % M] / tail_len, 1.0))
    faces, fuv = [], []
    for r in range(rows - 1):
        for m in range(M):
            m2 = (m + 1) % M
            cu = m + 1      # uv column of the next vertex (the last face uses the closing column)
            if m2 in Lo:     # the next column is a cut: this face uses its left copy
                o2a, o2b = Lo[m2][r], Lo[m2][r + 1]
                l2a, l2b = LiL[m2][r], LiL[m2][r + 1]
            else:
                o2a, o2b = outer_idx[r, m2], outer_idx[r + 1, m2]
                l2a, l2b = lin_idx[r, m2], lin_idx[r + 1, m2]
            q = [outer_idx[r, m], outer_idx[r + 1, m], o2b, o2a]
            uvq = [enc(r, m), enc(r + 1, m), enc(r + 1, cu), enc(r, cu)]
            ql = [lin_idx[r, m], l2a, l2b, lin_idx[r + 1, m]]
            uvl = [enc(r, m), enc(r, cu), enc(r + 1, cu), enc(r + 1, m)]
            faces += [q, ql]
            fuv += [np.array(uvq), np.array(uvl)]
    # orientation check on one quad: outer faces must face outward
    pos_all = np.concatenate([L.pos, newp, newpL, lining.reshape(-1, 3)] + [liningL[c] for c in cutcols])
    if faces:
        q = faces[0]
        a_, b_, d_ = pos_all[q[0]], pos_all[q[1]], pos_all[q[3]]
        nq = np.cross(b_ - a_, d_ - a_)
        rr = a_ - np.array([0, a_[1], cz(a_[1])])
        if nq @ rr < 0:
            faces = [f[::-1] for f in faces]
            fuv = [u[::-1] for u in fuv]
    L.pos = pos_all
    nw = Wt.shape[-1]
    L.W = np.concatenate([L.W, Wt[1:].reshape(-1, nw)] + [Wt[1:, c] for c in cutcols] + [Wt.reshape(-1, nw)] + [Wt[:, c] for c in cutcols])
    lb = np.asarray(L.base)[lp]
    L.base = np.concatenate([L.base, np.repeat(lb[None], rows - 1, 0).ravel()] + [np.repeat(lb[c], rows - 1) for c in cutcols]
                            + [np.repeat(lb[None], rows, 0).ravel()] + [np.repeat(lb[c], rows) for c in cutcols])
    nnew = len(pos_all) - nv0
    L.cov = np.concatenate([L.cov, np.full(nnew, 0.05)])
    L.mask = np.concatenate([L.mask, np.tile(L.mask[lp[:1]], (nnew, 1))])
    tm = np.zeros(len(L.pos), bool)
    tm[nv0:] = True
    tm[lp] = True
    L.tail_mask = tm
    L.tailN = None
    L.tail_thick = thick
    L.faces += faces
    L.fuv += fuv
    L._lining = set(range(lin_base, len(L.pos)))
    g["_tail_len"] = tail_len
    tail_n = np.zeros((len(L.pos), 3))
    tail_n[outer_idx.ravel()] = nrm.reshape(-1, 3)
    tail_n[lin_idx.ravel()] = -nrm.reshape(-1, 3)
    for c in cutcols:
        tail_n[Lo[c]] = nrmL[c]
        tail_n[LiL[c]] = -nrmL[c]
    L.tailN = tail_n[tm]


# ----------------------------------------------------------------------------------------------------------------
# aux atlas region: tails, collars, hood rolls, skirts, helmets (painted from their own 3D rest positions)
# ----------------------------------------------------------------------------------------------------------------
def aux_reset():
    AUX.clear()


def aux_piece(name, w, h, g, flags=None):
    AUX.append(dict(name=name, w=max(w, 0.01), h=max(h, 0.01), g=g, flags=flags or {}, grid=None, edge=None))
    return len(AUX) - 1


def aux_uv(pid, u, v):
    """Encoded uv (u >= 10) remapped into the piece's rectangle once all pieces are packed."""
    return np.array([10.0 + 2 * pid + float(np.clip(u, 0, 1)) * 0.999, float(np.clip(v, 0, 1))])


def aux_pack():
    """Shelf-pack every aux piece into the layout's aux rectangle at one shared texel density."""
    ax, ay, aw, ah = BH.layout()["aux"]
    if not AUX:
        return
    pad = 0.004

    def place(s):
        x, y, shelf, out = 0.0, 0.0, 0.0, {}
        for i in sorted(range(len(AUX)), key=lambda i: -AUX[i]["h"]):
            w, h = AUX[i]["w"] * s, AUX[i]["h"] * s
            if w > aw:
                return None
            if x + w > aw:
                x, y = 0.0, y + shelf + pad
                shelf = 0.0
            if y + h > ah:
                return None
            out[i] = (ax + x, ay + y, w, h)
            x += w + pad
            shelf = max(shelf, h)
        return out
    lo, hi = 0.01, 3.0
    best = None
    for _ in range(30):
        s = (lo + hi) / 2
        p = place(s)
        if p is None:
            hi = s
        else:
            lo, best = s, p
    for i, r in best.items():
        AUX[i]["rect"] = r
        AUX[i]["density"] = lo


def aux_remap(objs):
    for o in objs:
        uvl = o.data.uv_layers.get("UVMap")
        if uvl is None:
            continue
        uv = np.zeros(len(uvl.data) * 2, np.float32)
        uvl.data.foreach_get("uv", uv)
        uv = uv.reshape(-1, 2)
        m = uv[:, 0] >= 9.5
        if not m.any():
            continue
        pid = np.floor((uv[m, 0] - 10.0) / 2 + 1e-6).astype(int)
        lu = uv[m, 0] - 10.0 - 2 * pid
        rects = np.array([AUX[i]["rect"] for i in pid])
        uv[m, 0] = rects[:, 0] + lu * rects[:, 2]
        uv[m, 1] = rects[:, 1] + uv[m, 1] * rects[:, 3]
        uvl.data.foreach_set("uv", uv.ravel())


def grid_piece(name, grid, edge, g, flags):
    """Register a (rows x cols) grid surface as an aux piece; returns per-(r,c) encoded uv."""
    du = np.linalg.norm(np.diff(grid, axis=1), axis=2).mean(0)
    ucol = np.r_[0, np.cumsum(du)]
    dv = np.linalg.norm(np.diff(grid, axis=0), axis=2).mean(1)
    vrow = np.r_[0, np.cumsum(dv)]
    pid = aux_piece(name, ucol[-1], vrow[-1], g, flags)
    AUX[pid]["grid"] = grid
    AUX[pid]["edge"] = edge
    AUX[pid]["u_of_col"] = ucol / max(ucol[-1], 1e-6)
    AUX[pid]["v_of_row"] = np.repeat((vrow / max(vrow[-1], 1e-6))[:, None], grid.shape[1], 1)
    return lambda r, c: aux_uv(pid, ucol[c] / max(ucol[-1], 1e-6), 1 - vrow[r] / max(vrow[-1], 1e-6))


# ----------------------------------------------------------------------------------------------------------------
# extras: collars, hood roll, skirts, belts / buckles, pouches, shoes, hats, hair pieces
# ----------------------------------------------------------------------------------------------------------------
COLLAR = {  # profile (a = out of the opening, o = off the garment surface) metres for a 1.75 m body
    "stand": lambda h, fl, ln: [(-0.006, 0.0012), (h * 0.5, 0.0032 + ln * 0.5 + fl * 0.25), (h * 0.92, 0.0028 + ln + fl * 0.85), (h, 0.0012 + ln + fl)],
    "funnel": lambda h, fl, ln: [(-0.006, 0.0014), (h * 0.45, 0.005 + fl * 0.3), (h * 0.9, 0.006 + fl * 0.8), (h, 0.003 + fl)],
    "mandarin": lambda h, fl, ln: [(-0.005, 0.001), (h * 0.5, 0.0028), (h * 0.95, 0.0022 + ln), (h, 0.0008 + ln)],
    "gorget": lambda h, fl, ln: [(-0.006, 0.0015), (h * 0.5, 0.004 + ln), (h * 0.95, 0.0035 + ln * 2), (h, 0.0015 + ln * 2)],
    "rib": lambda h, fl, ln: [(-0.005, 0.001), (h * 0.5, 0.003), (h * 0.9, 0.0026 + ln), (h, 0.0008 + ln)],
    "turtle": lambda h, fl, ln: [(-0.006, 0.001), (h * 0.35, 0.0055), (h * 0.7, 0.009), (h, 0.0045)],
    "crew": lambda h, fl, ln: [(-0.004, 0.0008), (h * 0.6, 0.0026), (h, 0.0014)],
    "shirt": lambda h, fl, ln: [(-0.004, 0.0008), (h * 0.7, 0.0028), (h, 0.0055), (h * 0.55, 0.0105), (h * 0.05 - fl * 0.4, 0.0085 + fl * 0.35)],
    "notch": lambda h, fl, ln: [(-0.004, 0.0008), (h * 0.7, 0.0028), (h, 0.0055), (h * 0.55, 0.0105), (-fl * 1.2, 0.006 + fl * 0.3)],
}


def collar_piece(L, B, g, LM, cell_flags):
    loops = garment_loops(L)
    if not loops:
        return None
    nl = max(loops, key=lambda lp: L.pos[lp, 1].mean() - 2 * np.abs(L.pos[lp, 0]).mean())
    if L.pos[nl, 1].mean() < B.Jm["chest"][1]:
        return None
    col = g["collar"]
    k = LM["k"]
    prof = COLLAR[col["kind"]](col["h"] * k, col.get("flare", 0.0) * k, col.get("lean", 0.0) * k)
    nl = sorted_loop(L.pos, nl)
    NLall = BH.layer_normals(L, B)
    n = 64
    P0 = resample_loop(L.pos[nl], n, 4)
    near = [nl[int(np.argmin(np.linalg.norm(L.pos[nl] - p, axis=1)))] for p in P0]
    Wl = L.W[near]
    # frames: tangent along the loop, n = garment normal, b = into the garment (away from the opening)
    N = NLall[near]
    N = (np.roll(N, 1, 0) + 2 * N + np.roll(N, -1, 0)) / 4
    N /= np.linalg.norm(N, axis=1, keepdims=True)
    # frames: a = up the neck (vertical), o = out from the neck axis (horizontal); notch lapels fold down the chest
    cen = P0.mean(0)
    up = np.array([0, 1.0, 0])
    radial = P0 - cen
    radial[:, 1] = 0
    radial /= np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-9)
    front = np.clip(np.cos(np.arctan2(P0[:, 0], P0[:, 2] - zc_at(B, P0[:, 1]))), 0, 1) ** 2
    rows = []
    for a_, o_ in prof:
        aa = np.full(n, a_)
        oo = np.full(n, o_)
        dA = np.repeat(up[None], n, 0)
        if col["kind"] == "notch":   # lapels: at the front the profile lies down along the chest
            dA = up[None] * (1 - front[:, None]) + (-up[None] * 0.8 + radial * 0.2) * front[:, None]
            dA /= np.linalg.norm(dA, axis=1, keepdims=True)
        rows.append(P0 + dA * aa[:, None] + radial * oo[:, None] + N * 0.0)
    grid = np.stack(rows)                             # rows x n x 3
    # close the loop in uv: an extra column
    gridc = np.concatenate([grid, grid[:, :1]], 1)
    hgt = np.r_[0, np.cumsum(np.linalg.norm(np.diff(grid, axis=0), axis=2).mean(1))]
    edge = np.repeat((hgt[-1] - hgt)[:, None], n + 1, 1)
    enc = grid_piece(f"collar_{g['type']}", gridc, edge, g, dict(collar=1.0))
    verts = grid.reshape(-1, 3)
    faces, uvs = [], []
    R = len(prof)
    for r in range(R - 1):
        for m in range(n):
            m2 = (m + 1) % n
            faces.append([r * n + m, r * n + m2, (r + 1) * n + m2, (r + 1) * n + m])
            uvs.append([enc(r, m), enc(r, m + 1), enc(r + 1, m + 1), enc(r + 1, m)])
    o = BH.mesh_from("collar", BH.to_bl_np(verts), faces, [u for f in uvs for u in f])
    fix_winding_out(o, BH.to_bl(cen + np.array([0, 0.05, 0])))
    BH.cloth_shell(o, 0.0028)
    BH.set_mask(o, (0, g.get("gloss", 0.0), 0))
    hn = np.r_[[0.0], np.cumsum(np.linalg.norm(np.diff(grid, axis=0), axis=2).mean(1))]
    Wr = []
    for r in range(R):
        t = np.clip(hn[r] / max(hn[-1], 1e-6), 0, 1) * (1 - 0.7 * (col["kind"] == "notch"))
        w = Wl * (1 - 0.45 * t)
        w[:, BH.BI["neck"]] += 0.45 * t
        Wr.append(w)
    Wr = np.concatenate(Wr)
    BH.WSTORE[o.name] = BH.nearest_weights(BH.obj_world_verts(o), BH.to_bl_np(verts), Wr, 2)
    return o


def fix_winding_out(o, inside_bl):
    """Flip faces whose normal points toward `inside_bl` (Blender coords): a tube should face outward."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.normal_update()
    flip = [f for f in bm.faces if f.normal.dot(f.calc_center_median() - inside_bl) < 0]
    if len(flip) > len(bm.faces) / 2:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bm.to_mesh(o.data)
    bm.free()


def hood_roll(L, B, g, LM):
    """A soft rolled hood resting on the upper back, from collarbone to collarbone (it reads from behind)."""
    k = LM["k"]
    P = L.pos
    NL = BH.layer_normals(L, B) if len(L.base) == len(L.pos) else BH.vertex_normals(L.pos, L.faces)
    cz = zc_at(B, LM["nb"])
    angs = np.linspace(100, 260, 22)      # 0 = front; across the back, from shoulder blade to shoulder blade
    path, nrm = [], []
    for a in angs:
        ar = np.radians(a)
        y_t = LM["nb"] - 0.012 * k - 0.045 * k * (1 - np.cos(np.radians(a - 180)) ** 2) * 0.0 - 0.02 * k * np.abs(np.cos(ar)) ** 0.5
        if abs(a - 180) > 60:
            y_t = y_t - 0.01 * k
        d = np.array([np.sin(ar), 0, np.cos(ar)])
        m = (np.abs(P[:, 1] - y_t) < 0.02) & ((P[:, [0, 2]] - [0, cz]) @ d[[0, 2]] > 0)
        cand = P[m]
        if len(cand) == 0:
            cand = P[np.argsort(np.abs(P[:, 1] - y_t))[:30]]
        proj = (cand[:, [0, 2]] - [0, cz]) @ d[[0, 2]]
        lat = np.abs((cand[:, [0, 2]] - [0, cz]) @ np.array([d[2], -d[0]]))
        j = np.argmax(proj - 3 * lat)
        p = cand[j].copy()
        nn = NL[np.nonzero(m)[0][j]] if m.any() else np.array([d[0] * 0.9, 0.4, d[2] * 0.9])
        path.append(p)
        nrm.append(nn)
    path = np.array(path)
    nrm = np.array(nrm)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True)
    t = np.abs(angs - 180) / 80                      # 0 at the back centre, 1 at the ends
    wv = (0.075 - 0.045 * t ** 1.5) * k             # cross-section height (down the back)
    th_ = (0.03 - 0.02 * t ** 1.5) * k             # thickness off the back
    seg = 10
    rows = []
    T = np.gradient(path, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    for i in range(len(path)):
        n_ = nrm[i] - (nrm[i] @ T[i]) * T[i]
        n_ /= np.linalg.norm(n_)
        bdir = np.cross(T[i], n_)
        away = path[i] - np.array([0, path[i][1], cz])
        away[1] = -0.5 * np.linalg.norm(away)
        if bdir @ away < 0:
            bdir = -bdir           # along the surface, away from the neck (down the back, out over the shoulder)
        ring = []
        for s_ in range(seg + 1):
            u = s_ / seg * 2 * math.pi
            # a flattened, slightly asymmetric tube: lies on the back, bulging up and out
            a_, b_ = math.cos(u), math.sin(u)
            pos = path[i] + bdir * (wv[i] * 0.5 * (1 - a_)) + n_ * (th_[i] * 0.5 * (1 + b_) * (0.55 + 0.45 * (1 - a_) * 0.5) + 0.002)
            ring.append(pos)
        rows.append(ring)
    grid = np.array(rows)                          # path x seg+1 x 3
    gridT = np.transpose(grid, (1, 0, 2))           # rows = around, cols = along
    edge = np.full(gridT.shape[:2], 0.05)
    enc = grid_piece("hood_roll", gridT, edge, g, dict(hood=1.0))
    npth = len(path)
    verts = grid[:, :seg].reshape(-1, 3)
    faces, uvs = [], []
    for i in range(npth - 1):
        for s_ in range(seg):
            s2 = (s_ + 1) % seg
            faces.append([i * seg + s_, i * seg + s2, (i + 1) * seg + s2, (i + 1) * seg + s_])
            uvs.append([enc(s_, i), enc(s_ + 1, i), enc(s_ + 1, i + 1), enc(s_, i + 1)])
    for end in (0, npth - 1):       # cap the ends
        c_ = len(verts)
        verts = np.concatenate([verts, grid[end, :seg].mean(0, keepdims=True)])
        for s_ in range(seg):
            s2 = (s_ + 1) % seg
            faces.append([end * seg + s_, end * seg + s2, c_] if end else [end * seg + s2, end * seg + s_, c_])
            uvs.append([enc(s_, end), enc(s_ + 1, end), enc(s_, end)])
    o = BH.mesh_from("hood_roll", BH.to_bl_np(verts), faces, [u for f in uvs for u in f])
    fix_winding_out(o, BH.to_bl(path.mean(0) - np.array([0, 0.03, 0])))
    BH.set_mask(o, (0, g.get("gloss", 0.0) * 0.8, 0))
    BH.WSTORE[o.name] = BH.nearest_weights(BH.obj_world_verts(o), BH.to_bl_np(L.pos), L.W, 4)
    return o


def ring_grid(B, pts, ys, pad, n=40, cz=None):
    """(len(ys) x n x 3) rings around (0, zc) fitted to pts (MH coords) at heights ys (+ pad per ring)."""
    czf = cz or (lambda yy: zc_at(B, yy))
    R = radial_table(pts, czf, np.arange(min(ys) - 0.02, max(ys) + 0.03, 0.01), nb=n)
    ys0 = min(ys) - 0.02
    out = []
    for i, yy in enumerate(ys):
        yi = int(np.clip(round((yy - ys0) / 0.01), 0, R.shape[0] - 1))
        ang = -180 + (np.arange(n) + 0.5) * 360 / n
        r = R[yi] + pad[i]
        out.append(np.stack([np.sin(np.radians(ang)) * r, np.full(n, yy), czf(yy) + np.cos(np.radians(ang)) * r], 1))
    return np.array(out)


def skirt_piece(c, B, g, LM, layers):
    """Pleated tech skirt / leather hip-wrap: a cloth tube from the waist, emerging under the top's hem."""
    k, H = LM["k"], B.H
    top_y = LM["spn"] - 0.01 * k
    length = g.get("length", 0.25) * H
    pts = [B.P[B.bodyv][np.isin(np.array(B.vb)[B.bodyv], ["hips", "spine", "thigh_L", "thigh_R"])]]
    for kk, L in layers.items():
        if L.g.get("cat") in ("bottom", "limb"):
            pts.append(L.pos)
    pts = np.concatenate(pts)
    rows = 9
    ys = [top_y - length * i / (rows - 1) for i in range(rows)]
    pad = [0.004 + 0.006 * i / (rows - 1) for i in range(rows)]
    n = 56
    grid = ring_grid(B, pts, ys, pad, n)
    # monotonic radius + flare + pleats
    cz = zc_at(B, np.array(ys))
    for i in range(1, rows):
        r_prev = np.hypot(grid[i - 1, :, 0], grid[i - 1, :, 2] - cz[i - 1])
        r = np.hypot(grid[i, :, 0], grid[i, :, 2] - cz[i])
        t = i / (rows - 1)
        rn = np.maximum(r, r_prev) * (1 + 0.012 * t * (g.get("flare", 1.0)))
        if g.get("pleats"):
            ang = -180 + (np.arange(n) + 0.5) * 360 / n
            rn = rn + 0.008 * t * np.abs(np.sin(np.radians(ang) * g["pleats"] / 2))
        sc = rn / np.maximum(r, 1e-6)
        grid[i, :, 0] *= sc
        grid[i, :, 2] = cz[i] + (grid[i, :, 2] - cz[i]) * sc
    if g.get("shape") == "hipwrap":     # an overlapping wrap: open at the front-left, with a lapped edge
        pass
    gridc = np.concatenate([grid, grid[:, :1]], 1)
    edge = np.repeat((length - np.array([length * i / (rows - 1) for i in range(rows)]))[:, None], n + 1, 1)
    enc = grid_piece(f"skirt_{g['type']}", gridc, edge, g, dict(tail=1.0))
    verts = grid.reshape(-1, 3)
    faces, uvs = [], []
    for r in range(rows - 1):
        for m in range(n):
            m2 = (m + 1) % n
            if g.get("shape") == "hipwrap":
                ang = -180 + (m + 0.5) * 360 / n
                if abs(ang - 20) < 9 and r > 1:
                    continue
            faces.append([r * n + m, (r + 1) * n + m, (r + 1) * n + m2, r * n + m2])
            uvs.append([enc(r, m), enc(r + 1, m), enc(r + 1, m + 1), enc(r, m + 1)])
    o = BH.mesh_from("skirt", BH.to_bl_np(verts), faces, [u for f in uvs for u in f])
    fix_winding_out(o, BH.to_bl(np.array([0, top_y - length / 2, cz.mean()])))
    BH.cloth_shell(o, 0.004)
    BH.set_mask(o, (0, g.get("gloss", 0.0), 0))
    BH.WSTORE[o.name] = BH.skirt_weights(BH.obj_world_verts(o), B.J, H, top_y, long=False)
    return o


def rbox(name, center, size, rot=None, bevel=0.3):
    import bpy, bmesh
    from mathutils import Vector, Matrix
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.bevel(bm, geom=bm.edges, offset=bevel * 0.5, segments=2, affect="EDGES")
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if rot is not None:
        bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(center))
    o = BH.BC.mesh_obj(name, bm)
    _ = (bpy, Matrix)
    return o


def surface_point(L, x, y, front=True, B=None):
    """Point on a layer's outer surface at (x, y) on the front (or back), with its outward normal (MH coords)."""
    P = L.pos
    zc = zc_at(B, y)
    m = (np.abs(P[:, 1] - y) < 0.02) & (np.abs(P[:, 0] - x) < 0.02) & (((P[:, 2] - zc) > 0) == front)
    if not m.any():
        m = (((P[:, 2] - zc) > 0) == front)
    cand = P[m]
    j = np.argmax(cand[:, 2] if front else -cand[:, 2])
    p = cand[j]
    nrm = np.array([0, 0, 1.0 if front else -1.0])
    return p, nrm


def pieces_over(c, B, cov, layers, LM):
    """Buckles, pouches, knots for the over layers."""
    import bpy
    from mathutils import Matrix
    out = []
    k = LM["k"]
    for key, L in layers.items():
        g = L.g
        if g.get("cat") != "over":
            continue
        shape = g.get("shape")
        if shape == "harness" or (shape == "belt" and g.get("buckle")):
            yb = LM["spn"] - 0.055 * k
            p, n_ = surface_point(L, 0.0 if shape == "belt" else -0.02, yb, True, B)
            o = rbox("buckle", BH.to_bl(p + n_ * 0.004), (0.048 * k, 0.008, 0.034 * k) if shape == "harness" else (0.05 * k, 0.007, (g.get("width", 0.03) + 0.006) * k))
            BH.piece(o, "metal", (0, 0.65, 0), bone="hips")
            out.append(o)
            if shape == "harness":   # strap buckle on the chest and an adjuster at the back
                for (x, y, fr) in ((0.035 * k, LM["ch"] + 0.06 * k, True), (-0.05 * k, LM["ch"] - 0.02 * k, False)):
                    p, n_ = surface_point(L, x, y, fr, B)
                    o = rbox("buckle", BH.to_bl(p + n_ * 0.004), (0.036 * k, 0.007, 0.026 * k), Matrix.Rotation(-0.6 if fr else 0.6, 4, "Y"))
                    BH.piece(o, "metal", (0, 0.65, 0), bone="chest")
                    out.append(o)
        if shape == "carrier" and g.get("pouches", True):
            yb = LM["spn"] - 0.035 * k
            for x in (-0.075, 0.0, 0.075):
                p, n_ = surface_point(L, x * k, yb, True, B)
                o = rbox("pouch", BH.to_bl(p + n_ * 0.021), (0.062 * k, 0.034, 0.078 * k), bevel=0.35)
                BH.piece(o, "acc", (0, 0.1, 0), bone="spine")
                out.append(o)
            p, n_ = surface_point(L, 0.0, LM["ch"] + 0.085 * k, True, B)
            o = rbox("panel", BH.to_bl(p + n_ * 0.003), (0.15 * k, 0.004, 0.05 * k), bevel=0.15)
            BH.piece(o, "acc", (0, 0.2, 0), bone="chest")
            out.append(o)
        if shape == "sash" and g.get("knot"):
            s = 1 if g["knot"] == "L" else -1
            yb = LM["spn"] - 0.01 * k
            P = L.pos
            m = (np.abs(P[:, 1] - yb) < 0.02) & (P[:, 0] * s > 0)
            cand = P[m]
            j = np.argmax(cand[:, 0] * s * 0.7 + cand[:, 2] * 0.7)
            p = cand[j]
            ctr = BH.to_bl(p + np.array([0.012 * s, 0, 0.012]))
            bm = __import__("bmesh").new()
            __import__("bmesh").ops.create_uvsphere(bm, u_segments=10, v_segments=7, radius=1.0)
            from mathutils import Vector
            for v in bm.verts:
                v.co = Vector((v.co.x * 0.022, v.co.y * 0.016, v.co.z * 0.02))
            o = BH.BC.mesh_obj("knot", bm)
            o.data.transform(Matrix.Translation(ctr))
            BH.piece(o, "acc", (0, 0, 0), bone="hips")
            out.append(o)
            for dx in (-0.01, 0.012):
                tl = BH.BC.tube("knot_tail", [ctr + Vector((dx, -0.006, -0.01)), ctr + Vector((dx * 1.6, -0.01, -0.09)), ctr + Vector((dx * 2.0, -0.008, -0.17 - dx))],
                                [(0.026, 0.0035), (0.03, 0.0035), (0.028, 0.003)], seg=8)
                BH.piece(tl, "acc", (0, 0, 0), bone="hips")
                BH.WSTORE[tl.name] = BH.skirt_weights(BH.obj_world_verts(tl), B.J, B.H, B.J["spine"].z, long=False)
                out.append(tl)
    _ = bpy
    return out


def shoes(c, B, cov, feet, LM):
    """Fitted shoes: legacy hull shoe with per-type sole height / lip / toe cap; sandals: sole slab + straps."""
    if feet is None:
        return BH.shoe_objects(B, c, cov)
    if feet.get("sandal"):
        return sandals(c, B, cov, feet, LM)
    return BH.shoe_objects(B, c, cov, params=feet)


def sandals(c, B, cov, feet, LM):
    import bmesh
    from mathutils import Vector
    out = []
    for s in "LR":
        sel = np.array([i for i in B.bodyv if B.vb[i] in (f"foot_{s}", f"toe_{s}")])
        P = B.P[sel]
        low = P[P[:, 1] < P[:, 1].min() + 0.02]
        bm = bmesh.new()
        for p in BH.to_bl_np(np.c_[low[:, 0], np.zeros(len(low)), low[:, 2]]):
            bm.verts.new(p)
            bm.verts.new(p + Vector((0, 0, feet.get("sole_h", 0.012))))
        bmesh.ops.convex_hull(bm, input=bm.verts)
        o = BH.BC.mesh_obj("sandal", bm)
        sc = o.modifiers.new("cast", "SMOOTH")
        sc.factor, sc.iterations = 0.3, 2
        BH.BC.apply_modifiers(o)
        # grow the slab 4 mm around the foot
        co = np.array([v.co for v in o.data.vertices])
        cen = co.mean(0)
        d = co - cen
        d[:, 2] = 0
        nrm = np.linalg.norm(d, axis=1, keepdims=True)
        co = co + d / np.maximum(nrm, 1e-6) * 0.004
        o.data.vertices.foreach_set("co", co.ravel())
        BH.piece(o, "sole", (0, 0.1, 0), proj="yz")
        ref = np.array([i for i in B.bodyv if B.vb[i] in (f"foot_{s}", f"toe_{s}")])
        BH.WSTORE[o.name] = BH.nearest_weights(BH.obj_world_verts(o), BH.to_bl_np(B.P[ref]), B.W[ref], 4)
        out.append(o)
        # straps: ankle thong, instep strap, toe loop (leather tubes hugging the foot)
        J = B.Jm
        ank, ball, toe = J["ankle_" + s], J["ball_" + s], J["toe_" + s]
        sg = 1 if s == "L" else -1
        legp = B.P[B.bodyv][(np.array(B.vb)[B.bodyv] == f"shin_{s}")]
        for yy, rad in ((ank[1] + 0.03, 0.0035),):
            cc, R = BH.ring_fit(BH.to_bl_np(legp), yy, 0.01)
            o = BH.ring_tube("strap", [(yy - 0.006, cc, R, 0.0012), (yy, cc, R, 0.0026), (yy + 0.006, cc, R, 0.0012)])
            BH.piece(o, "shoe", (0, 0.3, 0), bone="shin_" + s)
            out.append(o)
        footp = B.P[sel]
        for t_, w in ((0.35, 0.012), (0.75, 0.01)):
            pc = ank * (1 - t_) + ball * t_
            m = np.abs((footp - pc) @ ((ball - ank) / np.linalg.norm(ball - ank))) < 0.008
            ring = footp[m]
            if len(ring) < 6:
                continue
            ctr = ring.mean(0)
            pts = []
            for a in np.linspace(-1.35, 1.35, 9):
                dirn = np.array([math.sin(a) * sg * 0 + math.sin(a), math.cos(a), 0.0])
                proj = (ring - ctr)[:, :2] @ dirn[:2]
                p = ring[np.argmax(proj)] + np.r_[dirn[:2], 0] * 0.0025
                pts.append(Vector(BH.to_bl(p)))
            tl = BH.BC.tube("strap", pts, [(w * 0.5, 0.0018)] * len(pts), seg=6)
            BH.piece(tl, "shoe", (0, 0.3, 0), bone="foot_" + s)
            BH.WSTORE[tl.name] = BH.nearest_weights(BH.obj_world_verts(tl), BH.to_bl_np(B.P[ref]), B.W[ref], 3)
            out.append(tl)
        _ = toe
    return out


def head_pieces(c, B, cov, layers, cos, LM):
    """Caps, peaked caps, beanies, Continuum helmets, ancient woven headbands."""
    out = []
    k = LM["k"]
    hp = BH.to_bl_np(BH.head_frame(B))
    if layers.get("hair") is not None:
        hp = np.concatenate([hp, BH.to_bl_np(layers["hair"].pos)])
    eye_z = B.L.eye[1]
    top = hp[:, 2].max()
    for h in cos["head"]:
        kind = h["kind"]
        cell = "shirt"
        if kind in ("cap", "peaked", "beanie", "headband"):
            zb = eye_z + {"cap": 0.047, "peaked": 0.047, "beanie": 0.036, "headband": 0.044}[kind] * k
            cc, R = BH.ring_fit(hp, zb, 0.01)
            pad = 0.0045
            if kind == "headband":
                o = BH.loft("headband", [(zb - 0.011 * k, cc, R, 0.002), (zb, cc, R, 0.0045), (zb + 0.011 * k, cc, R, 0.002)])
                BH.piece(o, cell, (0, 0.0, 0), proj="cyl", bone="head")
                out.append(o)
                continue
            rings = [(zb - 0.003, cc, R, pad + (0.004 if kind == "beanie" else 0))]
            if kind == "beanie":
                rings.append((zb + 0.028 * k, cc, R, pad + 0.005))
            for f in (0.3, 0.55, 0.78, 0.93):
                z = zb + (top - zb) * f + 0.003
                ci, Ri = BH.ring_fit(hp, min(z, top - 0.006), 0.008)
                bulge = 1.0 + (0.035 * math.sin(f * math.pi) if kind == "beanie" else 0.015 * math.sin(f * math.pi))
                rings.append((z + (0.008 * f if kind == "beanie" else 0.0), (cc[0], cc[1] + (ci[1] - cc[1]) * 0.5), np.maximum(Ri, R * (1.0 - 0.6 * f ** 1.6)) * bulge, pad + 0.002))
            crown = BH.loft(kind, rings, cap_top=True)
            parts_ = [crown]
            if kind == "cap":
                bill = h.get("bill", 0.07) * k
                visor = BH.loft("visor", [(zb + 0.002, cc, R, pad - 0.002), (zb - 0.006 * k, cc, R, pad + bill * 0.6), (zb - 0.014 * k, cc, R, pad + bill)],
                                n=16, front=(-math.pi / 2 - 0.95, -math.pi / 2 + 0.95))
                parts_.append(visor)
            elif kind == "peaked":
                visor = BH.loft("visor", [(zb + 0.002, cc, R, pad - 0.001), (zb - 0.016 * k, cc, R, pad + 0.05 * k)], n=14, front=(-math.pi / 2 - 1.0, -math.pi / 2 + 1.0))
                rings2 = [(zb - 0.004, cc, R, pad), (zb + 0.03 * k, cc, R * 1.02, pad), (zb + 0.055 * k, cc, R * 1.06, pad)]
                crown = BH.loft("peaked", rings2, cap_top=True)
                band = BH.loft("band", [(zb - 0.004, cc, R, pad + 0.0015), (zb + 0.02 * k, cc, R, pad + 0.0025)])
                BH.piece(band, "acc", (0, 0.3, 0), proj="cyl", bone="head")
                out.append(band)
                parts_ = [crown, visor]
                if h.get("badge"):
                    from mathutils import Vector
                    o = rbox("badge", Vector((cc[0], cc[1] - R[9] - pad - 0.004, zb + 0.032 * k)), (0.022, 0.003, 0.018), bevel=0.5)
                    BH.piece(o, "metal", (0, 0.7, 0), bone="head")
                    out.append(o)
            for o in parts_:
                sol = o.modifiers.new("solid", "SOLIDIFY")
                sol.thickness = 0.003
                BH.BC.apply_modifiers(o)
                BH.BC.smooth(o)
                BH.piece(o, cell, (0, h.get("gloss", 0.08), 0), proj="cyl", bone="head")
                out.append(o)
        elif kind == "helmet":
            out.append(helmet(c, B, h, hp, LM))
    return out


def helmet(c, B, h, hp, LM):
    """Continuum helmet: an enclosed ceramic shell over head + hair down to the gorget, visor slit (or open face)."""
    k = LM["k"]
    eye_z = B.L.eye[1]
    neckp = BH.to_bl_np(B.P[B.bodyv][np.isin(np.array(B.vb)[B.bodyv], ["neck", "head"])])
    pts = np.concatenate([hp, neckp])
    top = hp[:, 2].max()
    zs = [eye_z - 0.115 * k, eye_z - 0.09 * k, eye_z - 0.06 * k, eye_z - 0.03 * k, eye_z, eye_z + 0.03 * k, eye_z + 0.06 * k, eye_z + 0.085 * k, top - 0.01, top + 0.004]
    rings = []
    n = 40
    for i, z in enumerate(zs):
        cc, R = BH.ring_fit(pts, min(z, top - 0.006), 0.012)
        f = i / (len(zs) - 1)
        pad = 0.016 + 0.004 * math.sin(f * math.pi)
        if i == len(zs) - 1:
            R = R * 0.35
        if i == 0:
            R = R * 1.06
        rings.append((z, cc, R, pad))
    # grid in MH coords for the aux painter
    verts = []
    for z, (cx, cy), R, pad in rings:
        for kk in range(n):
            a = -math.pi + (kk + 0.5) * 2 * math.pi / n
            kr = int(((a + math.pi) / (2 * math.pi) * len(R))) % len(R)
            rr = R[kr] + pad
            verts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr, z))
    vb = np.array(verts)
    gridm = BH.from_bl_np(vb).reshape(len(zs), n, 3)
    gridc = np.concatenate([gridm, gridm[:, :1]], 1)
    edge = np.full(gridc.shape[:2], 0.05)
    hg = dict(h, color=h.get("color") or "e6e8ea")
    enc = grid_piece("helmet", gridc, edge, hg, dict(helmet=1.0, visor=h.get("visor", "slit"), eye=B.L.eye.copy()))
    faces, uvs = [], []
    open_face = h.get("visor") == "open"
    for r in range(len(zs) - 1):
        for m in range(n):
            m2 = (m + 1) % n
            a = -math.pi + (m + 0.5) * 2 * math.pi / n
            if open_face and 1 <= r <= 5 and abs(a + math.pi / 2) < 0.75:
                continue
            faces.append([r * n + m, r * n + m2, (r + 1) * n + m2, (r + 1) * n + m])
            uvs.append([enc(r, m), enc(r, m + 1), enc(r + 1, m + 1), enc(r + 1, m)])
    c0 = len(vb)
    vb = np.concatenate([vb, vb[-n:].mean(0, keepdims=True)])
    r = len(zs) - 1
    for m in range(n):
        m2 = (m + 1) % n
        faces.append([r * n + m, r * n + m2, c0])
        uvs.append([enc(r, m), enc(r, m + 1), enc(r, m)])
    o = BH.mesh_from("helmet", vb, faces, [u for f in uvs for u in f])
    from mathutils import Vector
    fix_winding_out(o, Vector((0, BH.to_bl(B.L.eye).y + 0.06, eye_z)))
    sol = o.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.004
    BH.BC.apply_modifiers(o)
    BH.BC.smooth(o)
    BH.set_mask(o, (0, h.get("gloss", 0.85), 0))
    pts_bl = BH.obj_world_verts(o)
    W = np.zeros((len(pts_bl), len(BH.BONE_NAMES)))
    t = np.clip((pts_bl[:, 2] - (eye_z - 0.1 * k)) / (0.06 * k), 0, 1)
    W[:, BH.BI["head"]] = 0.4 + 0.6 * t
    W[:, BH.BI["neck"]] = 0.6 * (1 - t)
    BH.WSTORE[o.name] = W
    return o


def extras(c, B, cov, layers):
    cos = cov["_costume"]
    LM = cov["_lm"]
    out = []
    # ---- collars: the outermost top's; inner collars only where the outer neckline opens deeper ----
    tops = [(k_, L) for k_, L in layers.items() if L.g.get("cat") == "top"]
    outer_dip = None
    hood_up = any(h["kind"] == "hood_up" for h in cos["head"])
    for k_, L in reversed(tops):
        g = L.g
        if not g.get("collar"):
            if outer_dip is None:
                outer_dip = g["neck"][1]
            continue
        if outer_dip is not None and g["neck"][1] >= outer_dip - 0.015:
            continue
        if hood_up and g.get("role") == "outer" and g["collar"]["kind"] not in ("stand", "funnel", "gorget"):
            continue
        o = collar_piece(L, B, g, LM, None)
        if o is not None:
            out.append(o)
        if outer_dip is None:
            outer_dip = g["neck"][1] if g["collar"]["kind"] not in ("stand", "funnel", "mandarin", "gorget", "turtle", "rib") else -1
    # ---- hood roll on the upper back ----
    for h in cos["head"]:
        if h["kind"] == "hood_down":
            src = h.get("src")
            Lsrc = next((L for L in layers.values() if L.g is src), None) or (tops[-1][1] if tops else None)
            if Lsrc is not None:
                out.append(hood_roll(Lsrc, B, dict(src or {}, det=[d for d in (src or {}).get("det", []) if d.startswith(("wear", "patches"))] +
                                                   [d for d in h.get("det", [])]), LM))
    # ---- hood / head-wrap hems ----
    for key, cell, rad in (("scarf", "acc", 0.0045), ("hood", "colA", 0.006)):
        Lx = layers.get(key)
        if Lx is not None:
            loops = Lx.boundary_loops()
            if loops:
                hg = next((h for h in cos["head"] if h["kind"] == ("hood_up" if key == "hood" else "head_wrap")), {})
                cl = "glow" if "led:hood" in (hg.get("src") or {}).get("det", []) + hg.get("det", []) else cell
                out.append(BH.rope_from_loop(key + "_hem", Lx, max(loops, key=len), rad, cl))
    # ---- skirts ----
    for g in cos["skirt"]:
        out.append(skirt_piece(c, B, g, LM, layers))
    # ---- over-layer hardware ----
    out += pieces_over(c, B, cov, layers, LM)
    # ---- rolled edges (mantle wraps) ----
    for key, L in layers.items():
        if L.g.get("roll"):
            for lp in garment_loops(L):
                if len(lp) > 12:
                    out.append(BH.rope_from_loop(key + "_roll", L, lp, 0.005, "acc" if L.g.get("shape") != "belt" else "trim"))
    # ---- shoes, head pieces, hair pieces ----
    out += shoes(c, B, cov, cos["feet"], LM)
    out += head_pieces(c, B, cov, layers, cos, LM)
    out += BH.hair_pieces(c, B, cov, layers)
    out += hair_extra(c, B, cov, layers, LM)
    return out


# ----------------------------------------------------------------------------------------------------------------
# new hair styles: shell shaping / relief + pieces (fringe, side curtains, puffs, locs, wavy lengths)
# ----------------------------------------------------------------------------------------------------------------
def hair_shape(style, rel, shape):
    if style == "waves":
        return shape + 0.55 * g2(((rel[:, 2] - 0.02) / 0.05) ** 2 + ((rel[:, 1] - 0.07) / 0.04) ** 2, 1.0) + 0.25 * ss(-0.03, 0.03, rel[:, 1])
    if style == "undercut":
        return shape * (0.15 + 1.4 * ss(0.045, 0.075, rel[:, 1]))
    if style == "fade":
        return shape * (0.25 + 0.75 * ss(0.03, 0.08, rel[:, 1]))
    if style == "pixie":
        return shape + 0.5 * g2(((rel[:, 0] + 0.03) / 0.05) ** 2 + ((rel[:, 1] - 0.07) / 0.035) ** 2 + ((rel[:, 2] - 0.0) / 0.06) ** 2, 1.0)
    if style == "puffs":
        return shape * 0.5
    return shape


def hair_relief(style, rel, seed):
    """Extra relief (metres) on top of the combed clumps: waves, tight curls."""
    if style == "waves":
        a = np.arctan2(rel[:, 0], rel[:, 1] + 0.03)
        return 0.0028 * np.sin(rel[:, 1] * 2 * math.pi / 0.03 + a * 6 + np.sin(a * 13 + seed)) + 0.0015 * np.sin(a * 41 + seed)
    if style in ("curls", "puffs", "locs"):
        q = rel * (1 / 0.011)
        v = np.sin(q[:, 0] * 2.1 + np.sin(q[:, 1] * 1.7)) * np.sin(q[:, 1] * 2.3 + np.sin(q[:, 2] * 1.9)) * np.sin(q[:, 2] * 1.9 + np.sin(q[:, 0] * 2.2))
        return 0.0032 * v
    return 0.0


def hair_extra(c, B, cov, layers, LM):
    """Hair pieces of the new styles (the legacy styles' pieces come from build_humans.hair_pieces)."""
    import bmesh
    from mathutils import Vector, Matrix
    style = cov["_style"]
    out = []
    L = B.L
    H = B.H
    if style in ("none", "bun_hidden"):
        return out
    ref = [BH.head_frame(B), B.P[B.bodyv][np.isin(np.array(B.vb)[B.bodyv], ["neck", "chest", "clavicle_L", "clavicle_R"])]]
    for kk in layers:
        if kk.startswith("top") or kk == "hood":
            ref.append(layers[kk].pos)
    if layers.get("hair") is not None:
        ref.append(layers["hair"].pos)
    ref = np.concatenate(ref)
    vol = BH.SHELL.get(style, 0.006)
    if style == "waves":
        ln = c.get("hairLen", "short")
        if ln == "short":      # Kai: messy waves over the brow and the tops of the ears
            out.append(BH.hair_sheet(B, c, ref, 120, 240, L.eye[1] + 0.09, L.eye[1] - 0.045, clear=0.003, flare=0.01, rows=7, seg=18, tip=0.008, vol=vol, name="hair_nape"))
        else:                  # chin to shoulder, side part
            out.append(BH.hair_sheet(B, c, ref, 62, 298, L.eye[1] + 0.1, L.eye[1] - 0.15 * H / 1.75, clear=0.003, flare=0.024, rows=13, seg=34, narrow=14, tip=0.03, vol=vol, name="hair_sheet"))
    elif style == "pixie":
        out.append(BH.hair_sheet(B, c, ref, -40, 30, L.eye[1] + 0.105, L.eye[1] + 0.035, clear=0.003, flare=0.004, rows=6, seg=14, narrow=6, tip=0.008, vol=vol, name="hair_fringe"))
    elif style == "puffs":
        hc = BH.to_bl(L.eye)
        for sg in (1, -1):
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
            for v in bm.verts:
                n_ = v.co.normalized()
                bump = 1 + 0.08 * math.sin(n_.x * 17) * math.sin(n_.y * 19) * math.sin(n_.z * 23)
                v.co = n_ * bump * 0.05
            o = BH.BC.mesh_obj("puff", bm)
            o.data.transform(Matrix.Translation(hc + Vector((0.062 * sg, 0.045, 0.085))))
            BH.BC.smooth(o)
            BH.piece(o, "hair", (0, 0, 1), proj="xz", bone="head")
            out.append(o)
    elif style == "locs":
        hc = BH.to_bl(L.eye)
        rng = np.random.default_rng(sum(map(ord, c["id"])))
        n_locs = c.get("locs", 16)
        for i in range(n_locs):
            a = math.radians(70 + 220 * (i + 0.5) / n_locs + rng.normal(0, 4))
            r0 = 0.085
            start = hc + Vector((math.sin(a) * r0 * 0.95, math.cos(a) * r0 + 0.075, 0.075 + rng.normal(0, 0.008)))
            drop = c.get("locLen", 0.16) * (0.8 + 0.4 * rng.random())
            out_dir = Vector((math.sin(a), math.cos(a), 0)) * 0.02
            pts = [start, start + out_dir * 1.2 + Vector((0, 0, -drop * 0.35)), start + out_dir * 1.8 + Vector((0, 0.005, -drop * 0.7)), start + out_dir * 2.0 + Vector((0, 0.01, -drop))]
            o = BH.BC.tube("loc", pts, [(0.0065, 0.0065), (0.006, 0.006), (0.0055, 0.0055), (0.004, 0.004)], seg=6)
            BH.piece(o, "hair", (0, 0, 1), proj="xz", bone="head")
            W = np.zeros((len(o.data.vertices), len(BH.BONE_NAMES)))
            zz = np.array([v.co.z for v in o.data.vertices])
            t = np.clip((start.z - zz) / max(drop, 1e-3), 0, 1)
            W[:, BH.BI["head"]] = 1 - 0.6 * t
            W[:, BH.BI["neck"]] = 0.6 * t
            BH.WSTORE[o.name] = W
            out.append(o)
    return out


# ----------------------------------------------------------------------------------------------------------------
# painting
# ----------------------------------------------------------------------------------------------------------------
def texel_ctx(B, q, **kw):
    """Painter coordinates of points q (MH coords). kw: per-point arrays (f, arm, leg, torso, ny, tail, collar)."""
    chains(B)
    n = len(q)
    vc = vertex_coords(B, q)
    x = q[:, 0]
    sa = side_pick(x, vc["armL"][0], vc["armR"][0])
    aa = side_pick(x, vc["armL"][1], vc["armR"][1])
    ra = side_pick(x, vc["armL"][2], vc["armR"][2])
    sl = side_pick(x, vc["legL"][0], vc["legR"][0])
    la = side_pick(x, vc["legL"][1], vc["legR"][1])
    rl = side_pick(x, vc["legL"][2], vc["legR"][2])
    arm = kw.pop("arm", np.zeros(n))
    leg = kw.pop("leg", np.zeros(n))
    torso = kw.pop("torso", np.clip(1 - arm - leg, 0, 1))
    u = np.where(arm > 0.5, np.radians(aa) * ra, np.where(leg > 0.5, np.radians(la) * rl, np.radians(vc["th"]) * vc["r"]))
    d = dict(n=n, q=q, x=x, y=q[:, 1], z=q[:, 2], zc=vc["zc"], th=vc["th"], r=vc["r"], u=u, sa=sa, aa=aa, ra=ra, sl=sl, la=la, rl=rl,
             arm=arm, leg=leg, torso=torso, side=np.sign(x + 1e-9), J=B.Jm, H=B.H, k=B.H / 1.75,
             armcum=vc["armL"][3], legcum=vc["legL"][3], tail=np.zeros(n), collar=np.zeros(n), ny=None, f=np.full(n, 0.1))
    d.update(kw)
    return G.Ctx(**d)


def paint_body(c, B, cov, pos, fld, part, col, taken, seed):
    """Garment texels of the body atlas (outermost layer wins). Returns height and glow arrays (per texel)."""
    n = len(pos)
    hgt = np.zeros(n)
    glw = np.zeros((n, 3))
    cos = cov["_costume"]
    arm_f = fld(B.arms)
    leg_f = fld(B.legs)
    ny = fld(B.N[:, 1])
    order = []
    for key, gg in (("hood", next((h.get("src") for h in cos["head"] if h["kind"] == "hood_up"), None)),
                    ("scarf", next((h for h in cos["head"] if h["kind"] == "head_wrap"), None))):
        if key in cov:
            order.append((key, gg))
    for key, g, _ in reversed(cov["_stack"]):
        order.append((key, g))
    if "inshoe" in cov and cos["feet"] is not None:
        order.append(("inshoe", dict(color=cos["feet"]["color"], fab="leather", det=[], gloss=0.4)))
    for key, g in order:
        if g is None:
            g = dict(color=c.get("colorA", "444a55"), fab="cotton", det=[])
        f = fld(cov[key])
        m = (f > -0.003) & ~taken
        if key == "inshoe":
            m &= f > 0.0
        if not m.any():
            continue
        taken |= m
        idx = np.nonzero(m)[0]
        fe = f[idx]
        tl = g.get("_tail_len")
        tor_f = np.clip(1 - arm_f[idx] - leg_f[idx], 0, 1)
        if tl and key.startswith("top"):
            fe = np.where((tor_f > 0.5) & (pos[idx, 1] < g.get("_hem_y", 0) + 0.12), fe + tl, fe)
        head = key in ("hood", "scarf")
        X = texel_ctx(B, pos[idx], f=fe, arm=arm_f[idx] * (not head), leg=leg_f[idx] * (not head), ny=ny[idx],
                      torso=np.zeros(len(idx)) if head else tor_f)
        cc, hh, gl = G.paint(g, X, seed + (hash(key) % 7) * 0.13)
        col[idx] = cc
        hgt[idx] = hh
        glw[idx] = gl
    return hgt, glw


def paint_aux(c, B, img, mask, himg, gimg, spx, res, seed):
    """Paint every aux piece (bilinear 3D positions of its grid -> garment painter)."""
    for pc in AUX:
        if pc.get("grid") is None or "rect" not in pc:
            continue
        x0, y0, w, h = pc["rect"]
        px0, px1 = int(math.floor(x0 * res)), int(math.ceil((x0 + w) * res))
        py0, py1 = int(math.floor((1 - y0 - h) * res)), int(math.ceil((1 - y0) * res))
        gx, gy = np.meshgrid(np.arange(px0, px1), np.arange(py0, py1))
        gx, gy = gx.ravel(), gy.ravel()
        ok = (gx >= 0) & (gx < res) & (gy >= 0) & (gy < res)
        gx, gy = gx[ok], gy[ok]
        u = np.clip(((gx + 0.5) / res - x0) / w, 0, 1)
        v = np.clip(((1 - (gy + 0.5) / res) - y0) / h, 0, 1)        # v = 1 at the top row of the piece (row 0)
        grid, edge = pc["grid"], pc["edge"]
        R, C = grid.shape[:2]
        uc = pc["u_of_col"]
        ci = np.clip(np.searchsorted(uc, u) - 1, 0, C - 2)
        fu = np.clip((u - uc[ci]) / np.maximum(uc[ci + 1] - uc[ci], 1e-9), 0, 1)
        vr = pc["v_of_row"]                     # rows x cols: v (0 top .. 1 bottom) per node
        tv = 1 - v
        vcol = vr[:, ci] * (1 - fu) + vr[:, ci + 1] * fu      # rows x N
        ri = np.clip((vcol <= tv[None]).sum(0) - 1, 0, R - 2)
        va = vcol[ri, np.arange(len(tv))]
        vb_ = vcol[ri + 1, np.arange(len(tv))]
        fv = np.clip((tv - va) / np.maximum(vb_ - va, 1e-9), 0, 1)
        P = (grid[ri, ci] * ((1 - fu) * (1 - fv))[:, None] + grid[ri, ci + 1] * (fu * (1 - fv))[:, None]
             + grid[ri + 1, ci] * ((1 - fu) * fv)[:, None] + grid[ri + 1, ci + 1] * (fu * fv)[:, None])
        E = (edge[ri, ci] * (1 - fu) * (1 - fv) + edge[ri, ci + 1] * fu * (1 - fv) + edge[ri + 1, ci] * (1 - fu) * fv + edge[ri + 1, ci + 1] * fu * fv)
        fl = pc["flags"]
        n = len(P)
        X = texel_ctx(B, P, f=E, tail=np.full(n, fl.get("tail", 0.0)), collar=np.full(n, fl.get("collar", 0.0)),
                      torso=np.full(n, 0.0 if (fl.get("hood") or fl.get("helmet")) else 1.0), ny=np.full(n, 0.3 if fl.get("hood") else 0.0))
        if fl.get("helmet"):
            cc, hh, gl = paint_helmet(pc["g"], X, fl, seed)
        else:
            cc, hh, gl = G.paint(pc["g"], X, seed + 0.77)
        if os.environ.get("AUXDBG"):
            cc = cc * 0 + np.array([1.0, 0.1, 0.1])
        img[gy, gx] = np.clip(cc, 0, 1)
        mask[gy, gx] = True
        himg[gy, gx] = hh
        gimg[gy, gx] = gl
        spx[gy, gx] = 1.0 / max(pc["density"] * res, 1e-6)


def paint_helmet(g, X, fl, seed):
    base = G.hexc(g.get("color") or "e6e8ea")
    k, h = G.fabric("ceramic", X, seed)
    col = np.tile(base, (X.n, 1))
    glow = np.zeros((X.n, 3))
    eye = fl["eye"]
    rel = X.q - eye
    front = (rel[:, 2] > -0.02).astype(float)
    # panel lines: a crest line over the top, a jaw line, a brow line
    crest = G.line(X.x, 0.004) * (rel[:, 1] > 0.02)
    jaw = G.line(rel[:, 1] + 0.055 - 0.15 * np.clip(-rel[:, 2], 0, 1), 0.003) * (np.abs(X.x) > 0.02)
    k = k * (1 - 0.35 * np.clip(crest + jaw, 0, 1))
    h = h - 0.0006 * np.clip(crest + jaw, 0, 1)
    if fl.get("visor") == "slit":
        slit = G.box(rel[:, 1], -0.012, 0.012, np.abs(X.x), 0.0, 0.07, 0.003) * front
        col = col * (1 - slit[:, None]) + np.array([0.05, 0.05, 0.06]) * slit[:, None]
        h = h - 0.0012 * slit
        gold = G.hexc(g.get("glow") or "ffd27a")
        ln = G.line(rel[:, 1], 0.0035, 0.001) * G.box(np.abs(X.x), 0.0, 0.06, rel[:, 1], -1, 1) * front
        glow = np.maximum(glow, ln[:, None] * gold[None] * float(g.get("glow_level", 0.6)))
        col = col * (1 - 0.6 * ln[:, None]) + gold * 0.9 * 0.6 * ln[:, None]
    trim = G.line(rel[:, 1] + 0.11, 0.008) * 1.0
    col = col * (1 - trim[:, None]) + G.hexc("8a9098") * trim[:, None]
    col = np.clip(col * k[:, None], 0, 1)
    return col, h, glow


def cell_colors(c, cov):
    """Colours (or painted designs) of the material cells for the costume pipeline."""
    cos = cov["_costume"]
    outer = cos["outer"] or (cos["top"][-1] if cos["top"] else None)
    bottom = cos["bottom"][-1] if cos["bottom"] else None
    over = cos["over"][0] if cos["over"] else None
    belts = [g for g in cos["over"] if g.get("shape") in ("belt", "harness", "strap", "sash")]
    hat = next((h for h in cos["head"] if h["kind"] in ("cap", "peaked", "beanie", "headband")), None)
    feet = cos["feet"]
    d = {}
    if outer:
        d["colA"] = outer["color"]
    if bottom:
        d["colB"] = bottom["color"]
    if over:
        d["acc"] = over["color"]
    elif belts:
        d["acc"] = belts[0]["color"]
    sash = next((g for g in cos["over"] if g.get("shape") == "sash"), None)
    if sash:
        d["acc"] = sash["color"]
    if belts:
        d["trim"] = belts[0]["color"]
    if hat:
        d["shirt"] = hat["color"]
        tp = next((h for h in cos["head"] if h["kind"] == "peaked"), None)
        if tp and tp.get("c2"):
            d["acc"] = tp["c2"]
    if c.get("metalColor"):
        d["metal"] = c["metalColor"]
    elif any(g.get("metal") for g in cos["items"]):
        d["metal"] = next(g["metal"] for g in cos["items"] if g.get("metal"))
    if c.get("glow"):
        d["glow"] = c["glow"]
    if feet:
        d["shoe"] = ("design", feet)
        d["sole"] = ("sole", feet)
    return d


def glow_cell_level(c):
    return float(c.get("glowLevel", 0.5)) if c.get("glow") else 0.0
