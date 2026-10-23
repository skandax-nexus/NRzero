"""likeness:fit check in the shipping pipeline: build Kai from the candidate face file, pack it as the game ships it and
render him in face_studio with the reference photo's own camera (fit.py's fitted pose), beside the photo.

    /home/user/tools/likeness-venv/bin/python game_compare.py [NAME] [--no-build] [--faces=../faces_candidates/kai_photo]

Writes LIKENESS_DIR/fit_compare_game.png (photo | game build, photo camera | 50 / 50 | front, three, profile) and
LIKENESS_DIR/fit/photo_camera.json. The photo stays outside the repo; the staging build is face_studio's folder.
"""
import json
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fit  # noqa: E402

LK = fit.LK
STAGE = os.environ.get("FACE_STAGE", "/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/feel/faces/stage")
HALF_PX = 1850.0          # half side of the square photo crop (photo px) = the game camera's vertical fov


def photo_camera():
    """Camera of the photo in Kai's head frame (metres from the eye-helper midpoint, x his left, y up, z forward)."""
    x = np.load(os.path.join(LK, "fit", "x.npy"))
    m = dict(zip(fit.MACRO_KEYS, x[:4]))
    P0 = fit.mh.sculpt(fit.macro_dict(m))
    model = fit.Model(P0)
    log = json.load(open(os.path.join(LK, "fit.json")))
    model.height = log["rounds"][-1]["height"]
    n = len(model.params)
    d, pose = x[4:4 + n], x[4 + n:]
    P = model.full(m, d)
    eyes = 0.5 * (P[fit.mh.group_vertices("helper-l-eye")].mean(0) + P[fit.mh.group_vertices("helper-r-eye")].mean(0))
    _, c = model.heads(m, d)
    R = fit.rodrigues(pose[:3])
    t, s = pose[3:6], pose[6]
    cam = c + R.T @ (-t) / s                        # camera centre, model frame
    fwd, right, down = R[2], R[0], R[1]             # camera axes in the model frame (OpenCV)
    # three.js lookAt with up = +y: its x axis; the photo's roll about the view axis relative to it
    zc = -fwd
    xl = np.cross([0, 1, 0], zc)
    xl /= np.linalg.norm(xl)
    roll = np.degrees(np.arctan2(np.cross(xl, right) @ fwd, xl @ right))
    K = np.load(os.path.join(LK, "lifted.npz"))["K"]
    fov = 2 * np.degrees(np.arctan(HALF_PX / K[1, 1]))
    out = dict(cam_from_eyes=(cam - eyes).round(5).tolist(), aim_from_eyes=(cam - eyes + fwd * 0.3).round(5).tolist(),
               fov_deg=round(float(fov), 3), roll_deg=round(float(roll), 3), principal_px=K[:2, 2].tolist(), half_px=HALF_PX,
               distance_m=round(float(np.linalg.norm(cam - eyes)), 4), scale=round(float(s), 4))
    json.dump(out, open(os.path.join(LK, "fit", "photo_camera.json"), "w"), indent=1)
    return out


def photo_square(pc, size):
    from PIL import Image
    im = Image.open(fit.PHOTO).convert("RGB")
    cx, cy = pc["principal_px"]
    h = pc["half_px"]
    box = (int(cx - h), int(cy - h), int(cx + h), int(cy + h))
    canvas = Image.new("RGB", (box[2] - box[0], box[3] - box[1]), (128, 128, 128))
    canvas.paste(im, (-box[0], -box[1]))
    return canvas.resize((size, size), Image.LANCZOS)


def main(argv):
    name = next((a for a in argv if not a.startswith("--")), "kai_photo_fit")
    faces = dict(a[2:].split("=", 1) for a in argv if a.startswith("--") and "=" in a).get("faces", os.path.join(fit.CHAR, "faces_candidates", "kai_photo"))
    pc = photo_camera()
    print(json.dumps(pc))
    env = dict(os.environ, ONLY="kai", FACES_DIR=os.path.abspath(faces), FS_PHOTO_CAM=",".join(map(str, pc["cam_from_eyes"])),
               FS_PHOTO_AIM=",".join(map(str, pc["aim_from_eyes"])), FS_PHOTO_FOV=str(pc["fov_deg"]), FS_PHOTO_ROLL=str(pc["roll_deg"]))
    cmd = [os.path.join(fit.CHAR, "face_studio.sh"), name, "--views=photo,front,three,profile", "--lights=studio", "--size=768"]
    if "--no-build" in argv:
        cmd.append("--no-build")
    subprocess.run(cmd, env=env, check=True, cwd=fit.CHAR)
    from PIL import Image, ImageDraw
    shots = os.path.join(STAGE, name, "shots")
    S = 640
    ph = photo_square(pc, S)
    gm = Image.open(os.path.join(shots, "kai_photo_studio.png")).convert("RGB").resize((S, S), Image.LANCZOS)
    tiles = [ph, gm, Image.blend(ph, gm, 0.5)] + [Image.open(os.path.join(shots, f"kai_{v}_studio.png")).convert("RGB").resize((S, S), Image.LANCZOS)
                                                 for v in ("front", "three", "profile")]
    labels = ["photo", "game build (kai_photo), the photo's camera", "50 / 50", "game build, front", "three-quarter", "profile"]
    out = Image.new("RGB", (S * 3 + 20, (S + 28) * 2), (20, 20, 20))
    dr = ImageDraw.Draw(out)
    for i, (t_, lb) in enumerate(zip(tiles, labels)):
        x0, y0 = (i % 3) * (S + 10), (i // 3) * (S + 28)
        out.paste(t_, (x0, y0 + 28))
        dr.text((x0 + 6, y0 + 8), lb, fill=(255, 255, 255))
    out.save(os.path.join(LK, "fit_compare_game.png"))
    print(os.path.join(LK, "fit_compare_game.png"))


if __name__ == "__main__":
    main(sys.argv[1:])
