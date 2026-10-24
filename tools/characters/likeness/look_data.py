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
  frame      [x0, y0, step]  mm of grid cell (0, 0) and the step (row 0 at the top: y = y0 - row * step)
  brows      (2, n, 4)       per side (0 = left, 1 = right): x (mm, outward from the midline), top, bottom, thickness;
                              the two sides averaged (mirrored), the frown undone (FROWN: medial end up 2.6 mm,
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
FROWN = (2.6, 1.4)           # mm the brows are lifted to undo the photo's frown (medial, lateral)
FILL = 0.62                  # density floor inside the beard's closed outline (likeness:final)
MOUSTACHE = 0.97             # moustache density, philtrum included (likeness:final)
UNDERLIP = 0.35              # the lighter zone under the lower lip (hair with skin showing through; fix round 1 0.5, round 2 0.35)
SOUL = 0.6                   # the narrow darker strip down the middle of it (fix round 1 0.72, round 2 0.6)
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
    mo = sm(sn_y + 1.0, sn_y - 2.5, Y) * sm(ls_y - 3.0, ls_y + 0.5, Y) * sm(chx + 7.0, chx + 2.0, ax_)
    # the moustache's lower edge follows the lip line out to the corners and turns down there
    drop = (sm(chx - 6.0, chx - 1.0, ax_) * sm(chx + 11.0, chx + 6.0, ax_) * sm(ls_y + 0.5, ls_y - 3.0, Y)
            * sm(sto_y - 34.0 - HORSESHOE, sto_y - 26.0 - HORSESHOE, Y))
    # fix round 1: under the lower lip, between the horseshoe's arms and above the dense bottom rim of the chin, his
    # beard is lighter and sparser (skin shows through), with a narrow darker strip down the middle; the densest part is
    # the bottom edge (kept: the rim rows below Pg + 4 mm are untouched)
    li_y, pg_y = F["Li"][1], F["Pg"][1]
    ul = sm(li_y + 1.0, li_y - 3.0, Y) * sm(pg_y + 2.0, pg_y + 8.0, Y) * sm(chx - 2.0, chx - 7.0, ax_)
    cap = UNDERLIP + (SOUL - UNDERLIP) * sm(7.0, 3.5, ax_)
    g = np.where(ul > 0, g * (1 - ul) + np.minimum(g, cap) * ul, g)
    g = np.maximum(g, MOUSTACHE * mo)
    g = np.maximum(g, 0.92 * drop)
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
                        brows=brows.astype(np.float32), moles=moles.astype(np.float32),
                        colours=json.dumps(col), landmarks=json.dumps(lm), photo_cam=cam.astype(np.float32))
    print(OUT, g.shape, "beard cells > 0.5:", int((g > 0.5).sum()), "brow x", br[0, 0], br[-1, 0], "moles", len(moles))
    # a preview of the map (scratch, outside the repo)
    prev = (np.stack([g, g, ln / ln.max()], -1) * 255).astype(np.uint8)
    Image.fromarray(prev).save(os.path.join(LK, "look_beard_map.png"))


if __name__ == "__main__":
    main()
