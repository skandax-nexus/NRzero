"""likeness:look - the look data of a photo likeness (docs/CHARACTER_LOOK.md, "Faces"): what the build needs from
measure.py's results to paint and groom the face, written next to the face file so it can ship (the owner asked for
this face: textures derived from the photo may ship; the photo itself and its crops never enter the repo).

    /home/user/tools/likeness-venv/bin/python look_data.py [LIKENESS_DIR] [OUT.npz]

Reads LIKENESS_DIR/measure.json and mask_beard.png (face-mm frame of measure.py: x = the subject's left, y up,
origin = the midpoint of the inner eye corners, 0.25 mm per pixel) and writes OUT.npz (default
../faces_candidates/kai_photo/kai_look.npz):
  beard      (H, W) float16  beard density 0..1 on a 1 mm grid of the same frame (left / right averaged: a groomed,
                              even beard; small speckles removed; carried outward past the face outline so the side
                              of the jaw, which the frontal view does not see, gets the density of its outline)
  beard_len  (H, W) float16  hair length factor (moustache 1, chin and jaw 1.6-1.9, cheeks 0.6)
  beard_light (H, W) float16 fix round 3: where the beard's hair is lighter and warmer (under the lower lip, the philtrum)
  beard_rim  (H, W) float16  fix round 3: the beard's dark, dense rim (jaw and neck edge, the chin's bottom)
  frame      [x0, y0, step]  mm of grid cell (0, 0) and the step (row 0 at the top: y = y0 - row * step)
  brows      (2, n, 4)       per side (0 = left, 1 = right): x (mm, outward from the midline), top, bottom, thickness;
                              the two sides averaged (mirrored), the frown undone (FROWN: medial end up 1.3 mm,
                              lateral 1.4 mm; the fit found the frown lowers the brows 1.5-3 mm)
  moles      (n, 6)          x, y, z (mm), diameter (mm), contrast (0..1, darker = lower), kind (1 mole, 0 faint spot)
  colours    json string     the measured albedos (linear) used for the colour zones
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import binary_closing, binary_fill_holes, gaussian_filter, label, zoom

HERE = os.path.dirname(os.path.abspath(__file__))
LK = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("LIKENESS_DIR", "/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/feel/faces/likeness")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "faces_candidates", "kai_photo", "kai_look.npz")
FROWN = (1.3, 1.4)           # mm the brows are lifted to undo the photo's frown (medial, lateral; fix round 3: medial 2.6 -> 1.3,
                             # his inner brows sit low and heavy over the eyes even unfrowned)
FILL = 0.62                  # density floor inside the beard's closed outline (likeness:final)
MOUSTACHE = 0.97             # moustache density, philtrum included (likeness:final)
UNDERLIP = 0.78              # fix round 3: the density floor of the lighter zone under the lower lip (it is lighter HAIR, not skin:
                             # round 1 capped it at 0.5, round 2 at 0.35, which painted a skin window with hard edges)
UNDERLIP_E = (25.0, 14.0, 12.0)  # its ellipse: half width, half height (mm) and its centre below Li (the whole inner chin between
                             # the horseshoe's arms down to the rim), feathered radially over ~10 mm
SOUL = 0.12                  # the soul strip down its middle: a soft, slightly denser (darker) gradient on top of the floor
PHILTRUM = 0.74              # fix round 3: the moustache is thinner and lighter over the philtrum (|x| < 4 mm): two dense wings
UNDERJAW = 14.0              # fix round 3: mm the chin's bottom rim is carried further down beside the centre (|x| 10-30 mm)
HORSESHOE = 5.0              # fix round 1: mm the moustache's down-turned ends run further down past the mouth corners
SIDEBAND = (0.88, 10.0, 8.0)  # fix round 2: the beard's outer band above the nose base (density, width at the nose base and
                             # at eye level, mm inside the photo's face outline), from the nose base up to eye level


def main():
    M = json.load(open(os.path.join(LK, "measure.json")))
    fr = M["masks"]["frame"]
    px = fr["mm_per_px"]
    x0, y0 = fr["x_range_mm"][0], fr["row0_y_mm"]
    m = np.asarray(Image.open(os.path.join(LK, "mask_beard.png")), np.float32) / 255.0
    # 1 mm grid
    step = 1.0
    k = px / step
    g = zoom(gaussian_filter(m, 1.0 / px * 0.5), k, order=1)
    H, W = g.shape
    xs = x0 + (np.arange(W) + 0.5) * step
    ys = y0 - (np.arange(H) + 0.5) * step
    # left / right averaged (the photo's small yaw moves one side's outline a few mm)
    g = 0.5 * (g + g[:, ::-1])
    # the mask was cut at the nose base (y = -38): nothing above it is beard (the sideburns are added in 3D, at
    # the build, from the hairline down to here)
    # speckles: drop isolated blobs under 12 mm^2
    lab, n = label(g > 0.35)
    for i in range(1, n + 1):
        if (lab == i).sum() < 12:
            g[lab == i] = 0
    # carried outward past the outline: each row's outermost dense value spreads to the frame's edge (the side of
    # the jaw and the sideburn, seen edge-on from the front)
    out = g.copy()
    for r in range(H):
        for side in (1, -1):
            cols = np.arange(W // 2, W) if side > 0 else np.arange(W // 2, -1, -1)
            row = g[r, cols]
            dense = np.nonzero(row > 0.55)[0]
            if not len(dense):
                continue
            j = dense[-1]
            v = float(row[max(0, j - 6):j + 1].mean())
            out[r, cols[j:]] = np.maximum(out[r, cols[j:]], v)
    g = gaussian_filter(out, 1.1)
    g = np.clip((g - 0.12) / 0.78, 0, 1)
    # the sparse patches inside the beard (beside the soul patch, under the lip corners) carry thin hair, not bare
    # skin: filled to about half density from the surrounding beard
    g = np.maximum(g, 0.62 * gaussian_filter(g, 4.0) * (gaussian_filter(g, 4.0) > 0.45))
    # likeness:final: a full short beard, not a goatee plus a chin strap. The lighter chin under the lower lip (skin
    # glinting through the hair) was measured as low density; everything inside the beard's closed outline (lip line to
    # the jaw band, mouth corner to jaw) gets a floor of FILL, so only the outer edge keeps the measured gradient (the
    # upper cheek line, the shave halo). The lips themselves are masked at the build (paint and cards).
    X, Y = np.meshgrid(xs, ys)
    F = M["features"]["landmarks"]
    inside = binary_fill_holes(binary_closing(g > 0.4, structure=np.ones((7, 7)), iterations=1))
    inside = gaussian_filter(inside.astype(np.float32), 1.2)
    g = np.maximum(g, FILL * np.clip((inside - 0.25) / 0.6, 0, 1))
    # the moustache, his densest, darkest feature: nose base to the vermilion, philtrum included, out past the mouth
    # corners, and the "horseshoe" down from each corner into the jaw band
    sn_y, ls_y, sto_y = F["Sn"][1], F["Ls"][1], F["Sto"][1]
    chx = 0.5 * (abs(F["Ch_L"][0]) + abs(F["Ch_R"][0]))
    ax_ = np.abs(X)
    sm = lambda e0, e1, v: np.clip((v - e0) / (e1 - e0), 0, 1) ** 2 * (3 - 2 * np.clip((v - e0) / (e1 - e0), 0, 1))
    # fix round 3: the moustache's top edge follows the nostril base and rises along the alar base (sn + 1 mm at the
    # midline, sn + 2.5 mm under the alae at |x| 14-18 mm), then runs down and out along the nasolabial line into the
    # horseshoe, so its outer ends are rounded, not square corners; feathered over ~2.5 mm (the cards add single hairs)
    al_x = 0.5 * (abs(F["Al_L"][0]) + abs(F["Al_R"][0]))
    top = sn_y + 1.0 + 1.5 * sm(3.0, al_x - 6.0, ax_)
    top = top - np.clip(ax_ - (al_x - 4.0), 0, None) * ((sn_y + 2.5) - (ls_y - 7.0)) / max(chx + 6.0 - (al_x - 4.0), 4.0)
    mo = sm(top + 1.0, top - 1.5, Y) * sm(ls_y - 3.0, ls_y + 0.5, Y) * sm(chx + 9.0, chx + 3.0, ax_)
    # the moustache's lower edge follows the lip line out to the corners and turns down there
    drop = (sm(chx - 11.0, chx - 1.0, ax_) * sm(chx + 11.0, chx + 6.0, ax_) * sm(ls_y + 0.5, ls_y - 3.0, Y)
            * sm(sto_y - 34.0 - HORSESHOE, sto_y - 26.0 - HORSESHOE, Y))
    # fix round 3: under the lower lip his beard is lighter, finer HAIR (no skin window): a soft ellipse about 8 mm below Li,
    # radially feathered (no vertical edges at the mouth-corner columns, no flat top or bottom), filled to UNDERLIP; its
    # light look comes from lighter hair in the build (`beard_light`: the cards and the painted mat tinted toward
    # beardWarm), and the soul strip down the middle is a soft, slightly denser gradient
    li_y, pg_y = F["Li"][1], F["Pg"][1]
    rx_, ry_, dy_ = UNDERLIP_E
    de_ = np.sqrt((X / rx_) ** 2 + ((Y - (li_y - dy_)) / ry_) ** 2)
    ul = sm(1.5, 0.75, de_) * sm(li_y + 0.5, li_y - 2.5, Y)
    soul = np.exp(-(X / 4.5) ** 2) * sm(li_y + 0.5, li_y - 3.0, Y) * sm(li_y - 16.0, li_y - 6.0, Y)
    g = np.maximum(g, UNDERLIP * ul)
    g = np.minimum(1.0, g + SOUL * soul * ul)
    g = np.maximum(g, MOUSTACHE * mo)
    g = np.maximum(g, 0.92 * drop)
    # fix round 3: the philtrum notch (the moustache's two dense wings meet in a thinner, lighter middle above the lip's
    # fringe)
    notch = np.exp(-(X / 3.6) ** 2) * sm(ls_y + 1.0, ls_y + 5.0, Y) * sm(top + 1.0, top - 2.5, Y)
    g = g * (1 - notch) + np.minimum(g, PHILTRUM) * notch
    # fix round 3: the chin's bottom rim beside the centre carried UNDERJAW mm lower (the photo's beard hangs ~14 mm
    # further at |x| 10-30 mm than the build's)
    sh_ = int(round(UNDERJAW / step))
    gd = np.zeros_like(g)
    gd[sh_:] = g[:-sh_]
    wj = sm(4.0, 10.0, ax_) * sm(38.0, 28.0, ax_) * sm(pg_y + 4.0, pg_y - 4.0, Y)
    g = np.maximum(g, gaussian_filter(gd, 1.5) * wj)
    # fix round 2: the mask was cut at the nose base, but in the photo his beard runs as one continuous dark band down
    # the face outline from the sideburn at eye level to the jaw: the outermost 8-10 mm inside the outline (the
    # measured widths at the eye, cheekbone, nose-base and mouth levels; carried out to the frame edge for the side of
    # the face the frontal view does not see) get SIDEBAND density, fading out just above eye level into the sideburn
    wl = M["frontal"]["absolute_mm"]["widths_at_levels"]
    lv_y = [F["Me"][1] + 10.0, F["Sto"][1], F["Sn"][1], 0.5 * (F["Zy_L"][1] + F["Zy_R"][1]), 0.5 * (F["pupil_L"][1] + F["pupil_R"][1]), 0.5 * (F["Br_L"][1] + F["Br_R"][1])]
    lv_w = [wl["menton_plus10"], wl["mouth"], wl["nose_base"], wl["zygion"], wl["eyes"], wl["brow"]]
    o_ = np.argsort(lv_y)
    half = 0.5 * np.interp(Y, np.array(lv_y)[o_], np.array(lv_w)[o_])
    bw = np.interp(Y, [sn_y, lv_y[4]], [SIDEBAND[1], SIDEBAND[2]])
    band = sm(half - bw - 2.5, half - bw + 1.5, ax_) * sm(lv_y[4] + 6.0, lv_y[4] + 1.0, Y) * sm(sn_y - 14.0, sn_y + 2.0, Y)
    g = np.maximum(g, SIDEBAND[0] * band)
    g = gaussian_filter(g, 0.6)
    # fix round 3: where the beard's hair is lighter (under the lower lip, the philtrum: tinted toward beardWarm in the
    # build) and its dark, dense rim (along the jaw and the neck, the chin's bottom edge: darker cards and mat)
    light = np.clip(ul * sm(pg_y - 2.0, li_y - 6.0, Y) * (1 - 0.7 * soul) + 0.3 * notch, 0, 1)
    rim = np.clip(sm(pg_y + 3.0, pg_y - 6.0, Y) + sm(half - 16.0, half - 5.0, ax_) * sm(sn_y + 6.0, sn_y - 12.0, Y), 0, 1) * (1 - ul)
    rim = gaussian_filter(rim * (g > 0.25), 1.5)
    # length factor: long on the chin, the jaw and the soul patch, short on the cheeks, medium on the moustache
    lip_y = F["Sto"][1]
    chin = np.clip((lip_y - 6 - Y) / 30.0, 0, 1)
    ln = 1.0 + 0.85 * chin * (1 - 0.35 * np.clip((np.abs(X) - 30) / 40, 0, 1))
    ln = ln * (0.6 + 0.4 * np.clip(g / 0.6, 0, 1))
    # brows: the two sides averaged on a common x (mm outward from the midline)
    B = M["brows"]
    prof = []
    for s in ("left", "right"):
        p = np.array(B[s]["profile_x_top_bottom_thick"], float)
        p[:, 0] = np.abs(p[:, 0])
        prof.append(p[np.argsort(p[:, 0])])
    xa = np.arange(max(prof[0][0, 0], prof[1][0, 0]) - 0.5, min(prof[0][-1, 0], prof[1][-1, 0]) + 1.5, 1.0)
    rows = []
    for p in prof:
        rows.append(np.stack([xa, np.interp(xa, p[:, 0], p[:, 1]), np.interp(xa, p[:, 0], p[:, 2])], 1))
    br = 0.5 * (rows[0] + rows[1])
    t = (br[:, 0] - br[0, 0]) / (br[-1, 0] - br[0, 0])
    lift = FROWN[0] + (FROWN[1] - FROWN[0]) * np.clip(t / 0.6, 0, 1)
    br[:, 1] += lift
    br[:, 2] += lift
    th = np.maximum(br[:, 1] - br[:, 2], 0.0)
    brows = np.stack([np.concatenate([br, th[:, None]], 1)] * 2)
    moles = np.array([[*mo["face_mm"], mo["diameter_mm"], mo["contrast"], 1.0 if mo["kind"] == "mole" else 0.0] for mo in M["moles"]], float)
    C = M["colours"]
    col = {k: C[k]["albedo_lin"] for k in C if isinstance(C[k], dict) and "albedo_lin" in C[k]}
    col["hair_grey"] = M["hair_grey_strands"]["colour"]["albedo_lin"]
    lm = {k: M["features"]["landmarks"][k] for k in M["features"]["landmarks"]}
    # fix round 2: the photo's camera (face mm, from the eye midpoint): the build finds the face outline as the photo
    # saw it (a close selfie camera, 27 cm away and above: its outline lies well forward of a frontal view's)
    cam = np.zeros(3)
    cp = os.path.join(LK, "fit", "photo_camera.json")
    if os.path.exists(cp):
        cam = np.array(json.load(open(cp))["cam_from_eyes"], float) * 1000.0
    np.savez_compressed(OUT, beard=g.astype(np.float16), beard_len=ln.astype(np.float16), frame=np.array([x0, y0, step]),
                        beard_light=light.astype(np.float16), beard_rim=rim.astype(np.float16),
                        brows=brows.astype(np.float32), moles=moles.astype(np.float32),
                        colours=json.dumps(col), landmarks=json.dumps(lm), photo_cam=cam.astype(np.float32))
    print(OUT, g.shape, "beard cells > 0.5:", int((g > 0.5).sum()), "brow x", br[0, 0], br[-1, 0], "moles", len(moles))
    # a preview of the map (scratch, outside the repo)
    prev = (np.stack([g, g * (1 - 0.5 * light), np.clip(ln / ln.max() * 0.5 + 0.5 * rim, 0, 1)], -1) * 255).astype(np.uint8)
    Image.fromarray(prev).save(os.path.join(LK, "look_beard_map.png"))


# ---------------------------------------------------------------------------------------------------------------
# Kai v3 (docs/CHARACTER_LOOK.md "Kai v3: the three photos"): the look data from the 2026 FRONT photo's measurement
# (likeness:measure v3: front_look.json, front_maps.npz, moles_front.json, measure.json) and the two SIDE photos
# (sides_targets.json; side_beard.npz: the beard the side photos see, per base-mesh vertex), in the front photo's head
# frame (mm: origin the inner canthi midpoint, x HIS left, y up, z forward). The 2024 photo is not used.
#
#     python look_data.py --v3 FRONT_DIR SIDES_DIR LOOK_WORK OUT.npz
#
# LOOK_WORK holds anchors.npz (the fit's final pose: the head-frame mm of 600 base-mesh vertices, so the build finds
# the exact similarity from its own vertices; likeness_look.Look.bind) and side_beard.npz. Keys beyond the 2024 set:
#   version 3; anchor_v (k,) int32 / anchor_mm (k, 3): the frame;
#   beard: the FRONT photo's measured density (no fills: the 2026 map is dense where the beard is), mirrored about the
#     midline and averaged (a groomed beard); beard_thick (H, W) the standoff of the beard's surface off the skin (mm)
#     in the frontal view (front_maps: measured on the silhouette, interpolated inside), mirrored and averaged;
#   beard_side (n_vertices,) float16: the side photos' beard coverage per base-mesh vertex (-1 unseen);
#   beard_prof (k, 2): the side photo's midline beard outline (y, z mm: the moustache, the chin front, the underside);
#   beard_bottom (k, 2): the front photo's dense beard bottom (x, y mm), mirrored and averaged;
#   brows: the brows AT REST (front_look brows_at_rest: straight, gently rising, no frown to undo), his two sides
#     averaged; brow_z (k, 2): the brow's depth along its length (x, z mm: the side photos' brow head / mid / tail);
#   moles: kind 1 a mole, 0 a faint spot, 2 the raised mole (his right cheek), on the side the photos show them;
#   under_eye (2, k, 4): per side [x mm, first and last mm below the upper-lid margin, peak darkness] of the crescent;
#   colours: the de-lit zone albedos (linear) and their ratios to the skin reference, lips, iris, beard, hair.
# ---------------------------------------------------------------------------------------------------------------
def _mirror_cols(g, x0, step):
    """g (H, W) sampled at x = x0 + (c + 0.5) step: the same map mirrored about x = 0 (linear interpolation)."""
    W = g.shape[1]
    xs = x0 + (np.arange(W) + 0.5) * step
    c = (-xs - x0) / step - 0.5
    c0 = np.clip(np.floor(c).astype(int), 0, W - 2)
    t = np.clip(c - c0, 0, 1)
    out = g[:, c0] * (1 - t) + g[:, c0 + 1] * t
    out[:, (c < -0.5) | (c > W - 0.5)] = 0.0
    return out


def main_v3(argv):
    front, sides, work, out = argv[:4]
    FL = json.load(open(os.path.join(front, "front_look.json")))
    FM = np.load(os.path.join(front, "front_maps.npz"))
    MJ = json.load(open(os.path.join(front, "measure.json")))
    MO = json.load(open(os.path.join(front, "moles_front.json")))
    ST = json.load(open(os.path.join(sides, "sides_targets.json")))
    AN = np.load(os.path.join(work, "anchors.npz"))
    SB = np.load(os.path.join(work, "side_beard.npz"))
    x0, y0, step = (float(v) for v in FM["frame"])
    sym = lambda g: 0.5 * (g + _mirror_cols(g, x0, step))      # noqa: E731
    D = sym(FM["beard_density"].astype(np.float64))
    D = np.clip(gaussian_filter(D, 0.6), 0, 1)
    T = FM["beard_thickness_mm"].astype(np.float64)
    T = sym(T)
    Hh, Ww = D.shape
    xs = x0 + (np.arange(Ww) + 0.5) * step
    ys = y0 - (np.arange(Hh) + 0.5) * step
    X, Y = np.meshgrid(xs, ys)
    F = MJ["features"]["landmarks"]
    ss = lambda e0, e1, v: np.clip((v - e0) / (e1 - e0), 0, 1) ** 2 * (3 - 2 * np.clip((v - e0) / (e1 - e0), 0, 1))     # noqa: E731
    li_y, sto_y, sn_y, pg_y = F["Li"][1], F["Sto"][1], F["Sn"][1], F["Pg"][1]
    ax_ = np.abs(X)
    # the lighter, warmer band of finer hair right under the lower lip (front_look beard density note), and the
    # moustache's lit tips (its lower edge): where the cards and the mat are tinted toward the warm brown
    light = np.exp(-(X / 17.0) ** 2) * ss(li_y + 1.0, li_y - 1.5, Y) * ss(li_y - 13.0, li_y - 5.0, Y)
    light = np.clip(light * (D > 0.2), 0, 1)
    # the dark, dense rim: the beard's outer edge along the jaw, the chin's bottom and the neck (not its upper cheek
    # line, where it thins out into skin)
    ins = (D > 0.45).astype(np.float64)
    rim = np.clip((1.0 - gaussian_filter(ins, 3.0)) * 2.2, 0, 1) * ins * ss(sto_y + 2.0, sto_y - 12.0, Y)
    rim = gaussian_filter(rim, 1.2)
    # hair length factor (cards): long where the beard stands far off the skin (the chin's hang), short on the cheeks
    ln = np.clip(0.75 + T / 11.0, 0.6, 2.6) * (0.6 + 0.4 * np.clip(D / 0.6, 0, 1))
    # side photos: per base-mesh vertex (nan -> -1)
    bs = SB["dens"].astype(np.float64)
    bs = np.where(np.isfinite(bs), np.clip(bs, 0, 1), -1.0)
    # the midline beard outline of the level side photo (side2): the moustache front, the chin front, the underside
    pc = ST["profile_curves_sagittal"]["curves"]["side2"]["beard_profile"]
    prof = np.concatenate([np.array(s_, float) for s_ in pc], 0)
    # the front photo's dense beard bottom per x, mirrored and averaged
    bb = np.array([[r["x_mm"], r["dense_bottom_y_mm"]] for r in FL["beard"]["bottom"]], float)
    bb = bb[np.argsort(bb[:, 0])]
    xb = np.arange(-58.0, 58.5, 2.0)
    yb = 0.5 * (np.interp(xb, bb[:, 0], bb[:, 1]) + np.interp(-xb, bb[:, 0], bb[:, 1]))
    bottom = np.stack([xb, yb], 1)
    # brows at rest: the two sides averaged on a common x (outward), no frown to undo
    B = FL["brows_at_rest"]
    prof_b = []
    for s_ in ("left", "right"):
        p = np.array(B[s_]["profile_x_top_bottom_thick_density"], float)
        p[:, 0] = np.abs(p[:, 0])
        prof_b.append(p[np.argsort(p[:, 0])])
    xa = np.arange(max(prof_b[0][0, 0], prof_b[1][0, 0]), min(prof_b[0][-1, 0], prof_b[1][-1, 0]) + 0.01, 1.0)
    rows = [np.stack([xa, np.interp(xa, p[:, 0], p[:, 1]), np.interp(xa, p[:, 0], p[:, 2]), np.interp(xa, p[:, 0], p[:, 4])], 1) for p in prof_b]
    br = 0.5 * (rows[0] + rows[1])
    th = np.maximum(br[:, 1] - br[:, 2], 0.0)
    # the medial end: the photo's first mm is a few sparse hairs (density 0.44-0.58); keep the measured thickness
    brows = np.stack([np.stack([br[:, 0], br[:, 1], br[:, 2], th], 1)] * 2)
    brow_dens = br[:, 3]
    # the brow's depth along its length (the side photos: head, over the eye, tail), for the build's frame
    cb = ST["combined"]
    zb_ = [[7.0, cb["brow_head"]["mm"][2] + 1.5], [abs(cb["brow_head"]["mm"][0]), cb["brow_head"]["mm"][2]],
           [32.0, 0.5 * (cb["brow_top"]["mm"][2] + cb["brow_bot"]["mm"][2])], [abs(cb["brow_tail"]["mm"][0]), cb["brow_tail"]["mm"][2]],
           [60.0, cb["brow_tail"]["mm"][2] - 6.0]]
    brow_z = np.array(zb_, float)
    # moles (moles_front.json, reviewed at 6x): x, y, z, diameter, contrast, kind
    mol = []
    for grp in ("his_left_cheek", "his_right_cheek"):
        for m_ in MO[grp]["moles"]:
            kind = {"mole": 1.0, "faint_spot": 0.0, "dot": 0.0}[m_["kind"]]
            if grp == "his_right_cheek" and m_["kind"] == "mole":
                kind = 2.0          # raised (a papule with a pale specular top: light, not paint)
            mol.append([*m_["face_mm"], m_["diameter_mm"], m_["contrast"], kind])
    moles = np.array(mol, float)
    # under-eye crescent rows
    ue = []
    for s_ in ("left", "right"):
        r_ = np.array(FL["under_eye"][s_]["depth_below_lid_mm_at_darkness_gt_0p25"]["rows"], float)
        r_[:, 0] = np.abs(r_[:, 0])
        ue.append(r_[np.argsort(r_[:, 0])])
    xu = np.arange(16.0, 48.5, 4.0)
    under_eye = np.stack([np.stack([xu] + [np.interp(xu, r_[:, 0], r_[:, k]) for k in (1, 2, 3)], 1) for r_ in ue])
    # colours: the de-lit zones (linear albedo) and their ratio to the skin reference
    ref = np.array(FL["skin_summary"]["delit_albedo_lin"], float)
    zones = {}
    for k, z in FL["skin_zones"].items():
        if k.startswith("upper_lid") or k == "temple_right":      # (the lids' samples hit the lashes; his right temple is against the dark window)
            continue
        zones[k] = dict(mm=z["face_mm"], lin=z["delit_albedo_lin"], ratio=(np.array(z["delit_albedo_lin"]) / ref).round(4).tolist(),
                        lightness=z["lightness_vs_skin"], sheen=[z["sheen_fraction_median"], z["sheen_fraction_p90"]])
    col = dict(skin_ref=ref.tolist(), zones=zones, lip_lower=FL["lips"]["lower"]["delit_albedo_lin"], lip_upper=FL["lips"]["upper"]["delit_albedo_lin"],
               iris=FL["eyes"]["right"]["iris_albedo_lin"], iris_left=FL["eyes"]["left"]["iris_albedo_lin"], limbal=FL["eyes"]["right"]["limbal_ring_albedo_lin"],
               beard=FL["beard"]["colour"]["core_albedo_lin"], moustache=FL["beard"]["colour"]["moustache_albedo_lin"],
               hair=FL["hair"]["colour"]["core_albedo_lin"], hair_grey=FL["hair"]["grey_strands"]["colour"]["albedo_lin"],
               under_eye_core=[FL["under_eye"][s_]["core_colour_albedo_lin"] for s_ in ("left", "right")],
               under_eye_lightness=[FL["under_eye"][s_]["core_lightness_vs_skin"] for s_ in ("left", "right")])
    lm = {k: F[k] for k in F}
    cam = np.array(FL["camera"]["camera_from_eyes_mm"], float)
    np.savez_compressed(out, version=np.array(3), beard=D.astype(np.float16), beard_len=ln.astype(np.float16), frame=np.array([x0, y0, step]),
                        beard_light=light.astype(np.float16), beard_rim=rim.astype(np.float16), beard_thick=T.astype(np.float16),
                        beard_side=bs.astype(np.float16), beard_prof=prof.astype(np.float32), beard_bottom=bottom.astype(np.float32),
                        brows=brows.astype(np.float32), brow_dens=brow_dens.astype(np.float32), brow_z=brow_z.astype(np.float32),
                        moles=moles.astype(np.float32), under_eye=under_eye.astype(np.float32),
                        colours=json.dumps(col), landmarks=json.dumps(lm), photo_cam=cam.astype(np.float32),
                        anchor_v=AN["anchor_v"].astype(np.int32), anchor_mm=AN["anchor_mm"].astype(np.float32))
    print(out, D.shape, "beard cells > 0.5:", int((D > 0.5).sum()), "side vertices seen:", int((bs >= 0).sum()),
          "brow x", br[0, 0], br[-1, 0], "moles", len(moles), "zones", len(zones))
    prev = (np.stack([D, D * (1 - 0.5 * light), np.clip(T / 30.0 + 0.5 * rim, 0, 1)], -1) * 255).astype(np.uint8)
    Image.fromarray(prev).save(os.path.join(work, "look_beard_map.png"))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--v3":
        main_v3(sys.argv[2:])
    else:
        main()
