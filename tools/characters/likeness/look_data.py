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
from scipy.ndimage import binary_opening, gaussian_filter, label, zoom

HERE = os.path.dirname(os.path.abspath(__file__))
LK = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("LIKENESS_DIR", "/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/feel/faces/likeness")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "faces_candidates", "kai_photo", "kai_look.npz")
FROWN = (2.6, 1.4)           # mm the brows are lifted to undo the photo's frown (medial, lateral)


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
    # length factor: long on the chin, the jaw and the soul patch, short on the cheeks, medium on the moustache
    X, Y = np.meshgrid(xs, ys)
    lip_y = M["features"]["landmarks"]["Sto"][1]
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
    np.savez_compressed(OUT, beard=g.astype(np.float16), beard_len=ln.astype(np.float16), frame=np.array([x0, y0, step]),
                        brows=brows.astype(np.float32), moles=moles.astype(np.float32),
                        colours=json.dumps(col), landmarks=json.dumps(lm))
    print(OUT, g.shape, "beard cells > 0.5:", int((g > 0.5).sum()), "brow x", br[0, 0], br[-1, 0], "moles", len(moles))
    # a preview of the map (scratch, outside the repo)
    prev = (np.stack([g, g, ln / ln.max()], -1) * 255).astype(np.uint8)
    Image.fromarray(prev).save(os.path.join(LK, "look_beard_map.png"))


if __name__ == "__main__":
    main()
