"""Dense face landmarks on a photo with MediaPipe Face Mesh (its bundled offline model, mediapipe 0.10.21).

    /home/user/tools/likeness-venv/bin/python detect.py PHOTO OUT.json

Runs the 478-point mesh (468 + 10 iris) on several crops of the face (shifted and scaled a little: test-time
augmentation) and keeps the per-point median, so the landmarks are steadier than one 192 px network pass.
Returns full-resolution pixel coordinates (u right, v down) and MediaPipe's relative depth z (same units as u, larger
= farther from the camera).
"""
import json
import sys

import numpy as np
from PIL import Image

import mediapipe as mp


def run_mesh(img):
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True,
                                         min_detection_confidence=0.3) as fm:
        r = fm.process(img)
    if not r.multi_face_landmarks:
        return None
    return np.array([[p.x, p.y, p.z] for p in r.multi_face_landmarks[0].landmark])


def detect(photo, n_aug=3):
    im = photo if isinstance(photo, Image.Image) else Image.open(photo)
    im = im.convert("RGB")
    W, H = im.size
    full = np.asarray(im)
    s = 1600 / max(W, H)
    small = np.asarray(im.resize((round(W * s), round(H * s)), Image.LANCZOS))
    p = run_mesh(small)
    if p is None:
        raise SystemExit("no face found")
    u, v = p[:, 0] * W, p[:, 1] * H
    cx, cy = (u.min() + u.max()) / 2, (v.min() + v.max()) / 2
    size = max(u.max() - u.min(), v.max() - v.min())
    runs = []
    for k, (dx, dy, sc) in enumerate([(0, 0, 1.6)] + [(dx, dy, sc) for sc in (1.45, 1.75) for dx, dy in
                                                     ((-.04, -.04), (.04, -.04), (-.04, .04), (.04, .04))][: 4 * (n_aug - 1)]):
        half = size * sc / 2
        x0, y0 = int(cx + dx * size - half), int(cy + dy * size - half)
        x1, y1 = int(cx + dx * size + half), int(cy + dy * size + half)
        pad = np.zeros((y1 - y0, x1 - x0, 3), np.uint8) + 128
        sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
        pad[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = full[sy0:sy1, sx0:sx1]
        side = x1 - x0
        crop = np.asarray(Image.fromarray(pad).resize((768, round(768 * (y1 - y0) / side)), Image.LANCZOS))
        q = run_mesh(crop)
        if q is None:
            continue
        cw, ch = crop.shape[1], crop.shape[0]
        runs.append(np.stack([x0 + q[:, 0] * (x1 - x0), y0 + q[:, 1] * (y1 - y0), q[:, 2] * (x1 - x0)], 1))
    R = np.array(runs)
    med = np.median(R, 0)
    spread = np.median(np.linalg.norm(R[:, :, :2] - med[None, :, :2], axis=2), 0)
    return dict(photo_size=[W, H], runs=len(runs), points=med.round(2).tolist(),
                jitter_px_median=float(np.median(spread)), jitter_px_p90=float(np.percentile(spread, 90)))


if __name__ == "__main__":
    d = detect(sys.argv[1])
    json.dump(d, open(sys.argv[2], "w"))
    print(d["runs"], "runs; jitter px median %.1f p90 %.1f" % (d["jitter_px_median"], d["jitter_px_p90"]))
