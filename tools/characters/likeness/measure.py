"""likeness:measure - everything a face fit needs from one reference photo (docs/CHARACTER_LOOK.md, "Faces").

    /home/user/tools/likeness-venv/bin/python measure.py PHOTO OUTDIR [--focal-mm=3.61 --pixel-um=0.8]

The venv: python3.12 -m venv /home/user/tools/likeness-venv && .../pip install mediapipe==0.10.21
opencv-python-headless scipy pillow (0.10.21 still ships the Face Mesh model; nothing is downloaded at run time).
MH_DATA (default /home/user/tools/mh/makehuman/data) gives the MakeHuman template used for the head pose.

Writes to OUTDIR (keep it outside the repo: the photo and its crops are private):
  measure.json    pose, camera, frontal proportions (face_metric definitions + absolute mm), colours (linear),
                  feature positions and outlines in face coordinates, mask descriptions, hair notes
  landmarks.png   the landmarks, iris fits, pose axes, moles, hairline and beard line drawn on the photo
  frontal.png     the photo unwarped to a pose-corrected frontal orthographic view in face coordinates
  mask_beard.png, mask_brows.png, mask_hair.png, mask_skin.png   (same frame as frontal.png; 0..255)
  mesh.json       the raw MediaPipe points (detect.py)

Face coordinates ("face mm"): the pose-corrected head frame of geom.py seen from the front (orthographic), in mm,
x = the subject's left (image right), y = up, origin = midpoint of the two inner eye corners (endocanthions). The
masks cover x in [-XR, XR], y in [YB, YT] at PX mm per pixel, row 0 at the top (y = YT).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.interpolate import LinearNDInterpolator
from scipy.ndimage import binary_closing, binary_opening, gaussian_filter, label, median_filter
from scipy.spatial import Delaunay

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import detect  # noqa: E402
import geom  # noqa: E402

XR, YB, YT, PX = 95.0, -150.0, 115.0, 0.25          # face-mm frame of the masks
P3_TO_709 = np.array([[1.2249, -0.2247, 0.0], [-0.0420, 1.0419, 0.0], [-0.0197, -0.0786, 1.0979]])


HAIR = dict(
    seen_in_photo=(
        "Long, dark (near-black, warm brown in the light) hair with a natural ringlet curl, worn pulled straight back off the face and "
        "tied behind (the tie itself is not visible from the front). The top and front are combed smooth and close to the head, "
        "damp-looking and glossy, in long backward strands; the hairline is fairly straight and softly rounded with a mild recession "
        "at the temples, no widow's peak, set about 57 mm above the nasion. Above and behind the ears loose curls spring out of the "
        "pulled-back mass: springy open ringlets of roughly 15-30 mm diameter, a frizzy halo widening the silhouette at the sides and "
        "back corners, with a few curls hanging down over the subject's left temple. A few silver-grey strands: two or three long ones "
        "loop across the front-top on the subject's left (image right), fine single hairs, not a grey patch. Sideburns are full and run "
        "into the beard without a gap."),
    build_tied=(
        "Primary look: tied back. Smooth swept-back shell over the crown (strands running front to back, slight wet sheen), a "
        "low bun / short tied tail at the back of the head, and curl clumps (ringlet cards, 15-30 mm loops) breaking out at the sides "
        "above the ears and at the nape; 2-4 loose curl tendrils at the temples (one falling on the left temple); 2-3 grey strands on "
        "the front left. Colour: base hair_scalp, tips hair_highlight, strands hair_grey_strands.colour."),
    build_loose=(
        "Alternative (the owner's earlier 'messy medium length'): the same curls worn down: chin-to-shoulder-length ringlets "
        "(about 15-25 cm stretched, springing up to 10-15 cm), volume at the sides and back, a loose centre-left part with curls "
        "falling forward over the forehead edges and temples but leaving the brows clear, same colour and grey strands."),
)
FIT_NOTES = [
    "Head pose and perspective are in 'camera' / 'pose'. The most like-for-like fit renders the candidate head with the same camera "
    "(focal_px, principal point, camera_from_eyes_mm, yaw / pitch / roll) and runs this same tool on the render "
    "(measure.py RENDER.png OUT --focal-px=F): every number is then measured the same way on both.",
    "face_metric_canon / face_metric_features use face_metric.py's formulas on MediaPipe points. MediaPipe's Zy (widest point of the "
    "face outline) and Go (jaw outline) are silhouette points about 70-80 mm behind the nasion, face_metric's Zy / Go are anterior "
    "vertices (Zy about 30 mm behind N), so jaw_vs_cheeks, face_index, eye_spacing/zy etc. differ in definition from the MH "
    "column; ratios between eye, nose, mouth and midline landmarks compare directly.",
    "Sn and the philtrum are hidden (camera above: the nose tip covers the subnasale, the moustache covers the philtrum and the top "
    "of the upper lip): their positions are MediaPipe's prior, so nose length and upper-lip numbers are less certain (+-3 mm).",
    "Absolute mm rest on the iris (11.7 mm visible iris diameter, adult mean +-0.5 mm) and the EXIF focal length: +-5 %. Ratios do "
    "not depend on it. The game sets Kai's size from his 1.83 m stature, so use ratios.",
]


def srgb_to_lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(np.asarray(c, float), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def hexs(lin):
    return "".join("%02x" % int(round(v * 255)) for v in lin_to_srgb(lin))


def polygon_mask(shape, poly):
    im = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).polygon([tuple(map(float, p)) for p in poly], fill=255)
    return np.asarray(im) > 0


def main(argv):
    photo, out = argv[0], argv[1]
    opt = dict(a[2:].split("=") for a in argv[2:] if a.startswith("--"))
    focal_mm, pixel_um = float(opt.get("focal-mm", 3.61)), float(opt.get("pixel-um", 0.8))
    os.makedirs(out, exist_ok=True)
    mesh_path = os.path.join(out, "mesh.json")
    if not os.path.exists(mesh_path):
        json.dump(detect.detect(photo), open(mesh_path, "w"))
    det = json.load(open(mesh_path))
    pts = np.array(det["points"])
    W, H = det["photo_size"]
    img8 = np.asarray(Image.open(photo).convert("RGB"))
    gray = np.asarray(Image.fromarray(img8).convert("L"))
    lin = srgb_to_lin(img8 / 255.0) @ P3_TO_709.T            # Display P3 photo -> linear Rec.709 / sRGB primaries
    lin = np.clip(lin, 0, None).astype(np.float32)
    Y = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)

    # ---------------------------------------------------------------- camera, iris scale, pose, lifting
    K = geom.camera(focal_mm, pixel_um, W, H)
    if "focal-px" in opt:                     # renders (a candidate head measured like the photo): focal length in px
        K[0, 0] = K[1, 1] = float(opt["focal-px"])
    FS, Pt = geom.template()
    iris = {}
    for nm, idx in (("right", geom.IRIS_R), ("left", geom.IRIS_L)):
        d, E, dmp, cc = geom.refine_iris(gray, pts, idx)
        iris[nm] = dict(diameter_px=round(d, 1), mediapipe_px=round(dmp, 1), centre_px=[round(cc[0], 1), round(cc[1], 1)], edges=E)
    # the better-supported fit (more limbus edge points) sets the scale; MediaPipe's own rim is reported for reference
    best = max(iris.values(), key=lambda v: len(v["edges"]))
    d_iris = best["diameter_px"]
    pts_s = pts.copy()
    for nm, idx in (("right", geom.IRIS_R), ("left", geom.IRIS_L)):     # use the measured iris for scale only
        c = pts[idx[0], :2]
        pts_s[idx[1], :2] = c + [-d_iris / 2, 0]
        pts_s[idx[3], :2] = c + [d_iris / 2, 0]
    g = geom.solve(pts_s, K, FS, Pt)
    R, t, s = g["R"], g["t"], g["scale"]
    Xh = g["Xh"] * 1000.0                                     # head frame, mm
    yaw, pitch, roll = geom.euler(R)
    yaw2, pitch2, roll2 = geom.euler(g["R_mp"])
    Nh = Xh[168]
    eyes_mid = (Xh[133] + Xh[362]) / 2
    cam = g["cam_in_head"] * 1000 - eyes_mid
    face = lambda i: (Xh[i] - eyes_mid)                     # noqa: E731  face mm (3D, z = depth out of the face)

    def P(k):
        return Xh[geom.MP[k]].mean(0)

    # ---------------------------------------------------------------- proportions (face_metric definitions)
    Lpts = {k: P(k) / 1000.0 for k in geom.MP}
    # Zy: widest point of the face outline 8..32 mm below the eye line (face_metric's band), each side
    ey = (P("En_L")[1] + P("Ex_L")[1] + P("En_R")[1] + P("Ex_R")[1]) / 4
    ovl = np.array(geom.OVAL)
    band = ovl[(Xh[ovl, 1] < ey - 8) & (Xh[ovl, 1] > ey - 32)]
    zl, zr = band[np.argmax(Xh[band, 0])], band[np.argmin(Xh[band, 0])]
    Lpts["Zy_L"], Lpts["Zy_R"] = Xh[zl] / 1000, Xh[zr] / 1000
    # Ft: midline forehead point 45 mm above N (MediaPipe midline 10-151-9-8-168, interpolated)
    mid = [10, 151, 9, 8, 168]
    yy = Xh[mid, 1]
    Lpts["Ft"] = np.array([0, Nh[1] + 45, np.interp(Nh[1] + 45, yy[::-1], Xh[mid, 2][::-1])]) / 1000
    Lpts["Vx"] = Lpts["N"] + np.array([0, 0.111, -0.088])      # not visible (hair): the template's N->Vx, flagged below
    PF = np.zeros((max(FS.L.values()) + 1, 3))
    for k, v in FS.L.items():
        PF[v] = Lpts[k]
    canon, feats = FS.canon(PF), FS.features(PF)
    feats.pop("forehead", None)
    Ptn = Pt.copy()
    canon_t, feats_t = FS.canon(Ptn), FS.features(Ptn)
    feats_t.pop("forehead", None)

    def mm(a, b):
        return float(np.linalg.norm(P(a) - P(b)))

    def dx(a, b):
        return float(abs(P(a)[0] - P(b)[0]))

    def dy(a, b):
        return float(P(a)[1] - P(b)[1])

    ewR = np.linalg.norm(Xh[33] - Xh[133])
    ewL = np.linalg.norm(Xh[263] - Xh[362])
    ehR = np.linalg.norm(Xh[159] - Xh[145])
    ehL = np.linalg.norm(Xh[386] - Xh[374])
    zy_w = float(Xh[zl, 0] - Xh[zr, 0])

    def width_at(yv):
        """Face outline width (mm) at height yv (head frame), linear along the oval's two sides."""
        o = Xh[geom.OVAL]
        Lside = o[:19][::1]          # 10 .. 152 down the subject's left
        Rside = np.r_[o[18:], o[:1]][::-1]
        def side_x(S):
            for a, b in zip(S[:-1], S[1:]):
                if (a[1] - yv) * (b[1] - yv) <= 0 and a[1] != b[1]:
                    f = (yv - a[1]) / (b[1] - a[1])
                    return a[0] + f * (b[0] - a[0])
            return np.nan
        return float(side_x(Lside) - side_x(Rside))

    levels = dict(brow=(P("Br_L")[1] + P("Br_R")[1]) / 2, eyes=ey, zygion=(Xh[zl, 1] + Xh[zr, 1]) / 2,
                  nose_base=P("Sn")[1], mouth=P("Sto")[1], lower_lip=P("Li")[1], chin=P("Pg")[1],
                  menton_plus10=P("Me")[1] + 10)
    widths = {k: round(width_at(v), 1) for k, v in levels.items()}
    absmm = dict(
        bizygomatic=round(zy_w, 1), face_height_N_Me=round(mm("N", "Me"), 1), intercanthal_en_en=round(dx("En_L", "En_R"), 1),
        outer_canthal_ex_ex=round(dx("Ex_L", "Ex_R"), 1), interpupillary=round(float(np.linalg.norm(Xh[468] - Xh[473])), 1),
        eye_width_R=round(float(ewR), 1), eye_width_L=round(float(ewL), 1), eye_opening_R=round(float(ehR), 1),
        eye_opening_L=round(float(ehL), 1), nose_width_al_al=round(dx("Al_L", "Al_R"), 1), nose_length_N_Sn=round(dy("N", "Sn"), 1),
        nose_tip_below_N=round(dy("N", "Prn"), 1), mouth_width_ch_ch=round(dx("Ch_L", "Ch_R"), 1),
        upper_vermilion_Ls_Sto=round(dy("Ls", "Sto"), 1), lower_vermilion_Sto_Li=round(dy("Sto", "Li"), 1),
        philtrum_Sn_Ls=round(dy("Sn", "Ls"), 1), lower_face_Sn_Me=round(dy("Sn", "Me"), 1), chin_Li_Me=round(dy("Li", "Me"), 1),
        jaw_width_go_go=round(dx("Go_L", "Go_R"), 1), widths_at_levels=widths)
    r_ratio = dict(
        face_width_to_height=round(zy_w / mm("N", "Me"), 3), eye_spacing_en_over_eye_width=round(dx("En_L", "En_R") / ((ewR + ewL) / 2), 3),
        eye_opening_over_width=round(float((ehR + ehL) / (ewR + ewL)), 3), nose_width_over_intercanthal=round(dx("Al_L", "Al_R") / dx("En_L", "En_R"), 3),
        nose_width_over_face=round(dx("Al_L", "Al_R") / zy_w, 3), mouth_over_nose=round(dx("Ch_L", "Ch_R") / dx("Al_L", "Al_R"), 3),
        mouth_over_face=round(dx("Ch_L", "Ch_R") / zy_w, 3), lower_over_upper_lip=round(dy("Sto", "Li") / dy("Ls", "Sto"), 3),
        lips_total_over_mouth_width=round((dy("Ls", "Li")) / dx("Ch_L", "Ch_R"), 3), jaw_over_cheeks=round(dx("Go_L", "Go_R") / zy_w, 3),
        mouth_level_width_over_zy=round(widths["mouth"] / zy_w, 3), chin_level_width_over_zy=round(widths["chin"] / zy_w, 3),
        nose_base_width_over_zy=round(widths["nose_base"] / zy_w, 3))
    # skin under the beard (estimate): the outline's chin and jaw sit on the beard surface; a short full beard of about
    # BEARD_CHIN mm below the chin and BEARD_SIDE mm at the jaw sides is taken off
    BEARD_CHIN, BEARD_SIDE = 8.0, 5.0
    me_skin = dy("Sn", "Me") - BEARD_CHIN
    r_ratio["skin_estimate_under_beard"] = dict(
        assumption_mm=dict(below_chin=BEARD_CHIN, jaw_sides=BEARD_SIDE),
        mid_lower_thirds=round(dy("N", "Sn") / me_skin, 3), lip_chin=round(dy("Sn", "Sto") / (dy("Sto", "Me") - BEARD_CHIN), 3),
        face_width_to_height=round(zy_w / (mm("N", "Me") - BEARD_CHIN), 3),
        jaw_over_cheeks=round((dx("Go_L", "Go_R") - 2 * BEARD_SIDE) / zy_w, 3),
        chin_level_width_over_zy=round((widths["chin"] - 2 * BEARD_SIDE) / zy_w, 3))
    # the same ratios measured flat on the photo (no pose / perspective correction), to show what the correction does
    u = pts[:, :2]
    def ui(i):
        return u[np.atleast_1d(i)].mean(0)
    zy_px = float(np.linalg.norm(u[zl] - u[zr]))
    raw = dict(face_width_to_height=round(zy_px / float(np.linalg.norm(ui(168) - ui(152))), 3),
               nose_width_over_intercanthal=round(float(np.linalg.norm(ui(358) - ui(129)) / np.linalg.norm(ui(362) - ui(133))), 3),
               mouth_over_nose=round(float(np.linalg.norm(ui(291) - ui(61)) / np.linalg.norm(ui(358) - ui(129))), 3),
               mid_lower_thirds=round(float(np.linalg.norm(ui(168) - ui(2)) / np.linalg.norm(ui(2) - ui(152))), 3))

    # ---------------------------------------------------------------- frontal unwarp (face mm <-> photo px)
    base = np.arange(468)
    C3 = Xh[geom.OVAL].mean(0) - np.array([0, 0, 70.0])      # roughly the head's centre, behind the face
    ext3, extuv = [], []
    for k in (0.12, 0.25, 0.4, 0.6):
        for i in geom.OVAL:
            X = Xh[i] + (Xh[i] - C3) * k * np.array([1, 1, 0.6])
            Xc = R @ (X / 1000) + t
            q = K @ Xc
            ext3.append(X)
            extuv.append(q[:2] / q[2])
    Fxy = np.r_[Xh[base, :2] - eyes_mid[:2], np.array(ext3)[:, :2] - eyes_mid[:2]]
    Fuv = np.r_[pts[base, :2], np.array(extuv)]
    fwd = LinearNDInterpolator(Delaunay(Fxy), Fuv)              # face mm -> photo px
    inv = LinearNDInterpolator(Delaunay(Fuv), np.r_[Xh[base] - eyes_mid, np.array(ext3) - eyes_mid])   # photo px -> face mm (3D)
    xs = np.arange(-XR, XR + 1e-6, PX)
    ys = np.arange(YT, YB - 1e-6, -PX)
    GX, GY = np.meshgrid(xs, ys)
    UV = fwd(np.c_[GX.ravel(), GY.ravel()]).reshape(GX.shape + (2,))
    valid = np.isfinite(UV[..., 0]) & (UV[..., 0] >= 0) & (UV[..., 0] < W - 1) & (UV[..., 1] >= 0) & (UV[..., 1] < H - 1)
    valid = np.where(np.isfinite(UV[..., 0]), valid, False)
    import cv2
    mu = np.where(valid, UV[..., 0], -1).astype(np.float32)
    mv = np.where(valid, UV[..., 1], -1).astype(np.float32)
    front8 = cv2.remap(img8, mu, mv, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    flin = cv2.remap(lin, mu, mv, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    Image.fromarray(front8).save(os.path.join(out, "frontal.png"))
    inside = polygon_mask(GX.shape, [((Xh[i, 0] - eyes_mid[0] + XR) / PX, (YT - (Xh[i, 1] - eyes_mid[1])) / PX) for i in geom.OVAL])

    def to_px(x, y):
        return (x + XR) / PX, (YT - y) / PX

    def poly_face(idx, grow=0.0):
        p = np.array([face(i)[:2] for i in idx])
        c = p.mean(0)
        p = c + (p - c) * (1 + grow)
        return [to_px(*q) for q in p]

    # ---------------------------------------------------------------- skin model and hair probability
    eye_holes = polygon_mask(GX.shape, poly_face([33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7], 0.25)) | \
        polygon_mask(GX.shape, poly_face([263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249], 0.25))
    lips = polygon_mask(GX.shape, poly_face(geom.LIP_OUT_UP + geom.LIP_OUT_LO[::-1]))
    lip_lo = polygon_mask(GX.shape, poly_face(geom.LIP_IN_LO + geom.LIP_OUT_LO[::-1]))
    lip_up = polygon_mask(GX.shape, poly_face(geom.LIP_OUT_UP + geom.LIP_IN_UP[::-1]))
    fY = flin @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    chroma = (flin[..., 0] - flin[..., 2]) / np.maximum(fY, 1e-4)     # warm skin is strongly red-over-blue; hair is near neutral
    # clear skin: forehead / nose / upper cheeks between the hair and the beard (picked by colour inside the face)
    probe = inside & ~eye_holes & ~lips & (GY > -45) & (GY < 30)
    sk = probe & (chroma > np.percentile(chroma[probe], 40)) & (fY > np.percentile(fY[probe], 30))
    skinY = np.median(fY[sk])
    # local skin brightness (shading) field: masked normalised blur of the clear-skin pixels
    w = gaussian_filter(sk.astype(np.float32), 40)
    skin_field = gaussian_filter(np.where(sk, fY, 0).astype(np.float32), 40) / np.maximum(w, 1e-3)
    skin_field = np.where(w > 0.02, skin_field, skinY)
    rel = fY / np.maximum(skin_field, 1e-4)
    # hair: dark relative to the local skin and low warm chroma. Each cue is a soft ramp; probability = their product
    sk_ch = np.median(chroma[sk])
    # darkness carries it (the beard shows warm skin between the hairs, so chroma alone misses its core); near-neutral
    # colour lets a mid-dark pixel count too (shadowed skin stays warm and is not hair)
    neut = np.clip((sk_ch - chroma) / (0.5 * sk_ch), 0, 1)
    p_dark = np.clip((0.5 + 0.2 * neut - rel) / 0.3, 0, 1)
    # lit hair that reads as mid-brown (the chin under the lip): strands make fine-scale contrast that skin lacks
    lYf = np.log(np.maximum(fY, 1e-3))
    hp_ = lYf - gaussian_filter(lYf, 0.6 / PX)
    tex = np.sqrt(gaussian_filter(hp_ ** 2, 1.0 / PX))
    p_tex = np.clip((tex - 0.06) / 0.08, 0, 1) * (rel < 0.85) * ~eye_holes * ~lips
    hairp = np.maximum(p_dark, p_tex)
    hairp = np.where(valid, hairp, 0)
    hairp_s = gaussian_filter(hairp, 4)           # 1 mm

    # ---------------------------------------------------------------- brows
    def brow_region(up, lo, grow):
        return polygon_mask(GX.shape, poly_face(up + lo[::-1], grow))
    brows = {}
    bmask = np.zeros(GX.shape, bool)
    for side, up, lo in (("left", geom.BROW_L_UP, geom.BROW_L_LO), ("right", geom.BROW_R_UP, geom.BROW_R_LO)):
        reg = brow_region(up, lo, 0.45)
        m = binary_opening(binary_closing((hairp_s > 0.45) & reg, iterations=3), iterations=2)
        lab_, n = label(m)
        if n:
            sizes = np.bincount(lab_.ravel())[1:]
            m = lab_ == (1 + int(np.argmax(sizes)))
        bmask |= m
        cols = np.where(m.any(0))[0]
        prof = []
        for c in cols[:: max(1, int(2 / PX))]:
            r = np.where(m[:, c])[0]
            prof.append([round(float(xs[c]), 1), round(float(ys[r.min()]), 1), round(float(ys[r.max()]), 1), round(float((r.max() - r.min()) * PX), 1)])
        prof = np.array(prof)
        order = np.argsort(np.abs(prof[:, 0]))                 # medial first
        prof = prof[order]
        thick = prof[:, 3]
        n3 = max(1, len(prof) // 3)
        centre_line = (prof[:, 1] + prof[:, 2]) / 2
        A = np.c_[np.abs(prof[:, 0]), np.ones(len(prof))]
        slope, icpt = np.linalg.lstsq(A, centre_line, rcond=None)[0]
        arch = float(np.max(centre_line - (A @ [slope, icpt])))
        brows[side] = dict(
            medial_x=float(prof[0, 0]), lateral_x=float(prof[-1, 0]), length_mm=round(float(abs(prof[-1, 0] - prof[0, 0])), 1),
            thickness_medial_mm=round(float(np.median(thick[:n3])), 1), thickness_centre_mm=round(float(np.median(thick[n3:2 * n3])), 1),
            thickness_lateral_mm=round(float(np.median(thick[2 * n3:])), 1), max_thickness_mm=round(float(thick.max()), 1),
            slope_deg_up_outward=round(float(np.degrees(np.arctan(slope))), 1), arch_above_straight_line_mm=round(arch, 1),
            density=round(float(hairp[m].mean()), 2),
            profile_x_top_bottom_thick=prof[:: max(1, len(prof) // 14)].round(1).tolist())
    eye_c = {"left": (face(362) + face(263)) / 2, "right": (face(133) + face(33)) / 2}
    for side in brows:
        c = eye_c[side]
        pr = np.array(brows[side]["profile_x_top_bottom_thick"])
        k = np.argmin(np.abs(pr[:, 0] - c[0]))
        brows[side]["above_eye_centre_lower_edge_mm"] = round(float(pr[k, 2] - c[1]), 1)
        brows[side]["above_eye_centre_upper_edge_mm"] = round(float(pr[k, 1] - c[1]), 1)
    brows["gap_between_heads_mm"] = round(float(brows["left"]["medial_x"] - brows["right"]["medial_x"]), 1)

    # ---------------------------------------------------------------- beard and moustache
    nose_poly = polygon_mask(GX.shape, poly_face([168, 193, 245, 128, 114, 217, 198, 209, 49, 64, 98, 97, 2, 326, 327, 294, 279, 429, 420, 437, 343, 357, 465, 417], 0.0))
    beard_zone = valid & (GY < face(2)[1] + 2) & ~lips & ~nose_poly
    beard_zone |= valid & (GY < face(205)[1] + 5) & (np.abs(GX) > abs(face(205)[0]) - 4) & ~eye_holes
    bd = np.where(beard_zone, gaussian_filter(hairp, 6), 0)     # density at 1.5 mm
    bd = np.where(beard_zone, bd, 0)
    Image.fromarray((np.clip(bd, 0, 1) * 255).astype(np.uint8)).save(os.path.join(out, "mask_beard.png"))
    Image.fromarray((bmask * 255).astype(np.uint8)).save(os.path.join(out, "mask_brows.png"))

    def zone_density(cx, cy, r):
        m = ((GX - cx) ** 2 + (GY - cy) ** 2 < r * r) & beard_zone
        return round(float(bd[m].mean()), 2) if m.any() else None
    fz = {k: face(v) for k, v in dict(Sn=2, Ls=0, Sto=13, Li=17, Pg=199, Me=152, ChL=291, ChR=61, GoL=397, GoR=172, cL=425, cR=205, eL=346, eR=117).items()}
    beard = dict(
        moustache_centre=zone_density(0, (fz["Sn"][1] + fz["Ls"][1]) / 2, 5),
        moustache_left=zone_density(fz["ChL"][0] * 0.6, fz["Ls"][1] + 2, 5), moustache_right=zone_density(fz["ChR"][0] * 0.6, fz["Ls"][1] + 2, 5),
        mouth_corners_left=zone_density(fz["ChL"][0] + 6, fz["ChL"][1] - 3, 5), mouth_corners_right=zone_density(fz["ChR"][0] - 6, fz["ChR"][1] - 3, 5),
        soul_patch=zone_density(0, fz["Li"][1] - 6, 4), chin=zone_density(0, (fz["Pg"][1] + fz["Me"][1]) / 2, 8),
        chin_sides_left=zone_density(18, fz["Pg"][1] - 4, 7), chin_sides_right=zone_density(-18, fz["Pg"][1] - 4, 7),
        jaw_line_left=zone_density(fz["GoL"][0] - 8, fz["GoL"][1], 7), jaw_line_right=zone_density(fz["GoR"][0] + 8, fz["GoR"][1], 7),
        lower_cheek_left=zone_density((fz["ChL"][0] + fz["GoL"][0]) / 2, fz["ChL"][1] + 6, 7),
        lower_cheek_right=zone_density((fz["ChR"][0] + fz["GoR"][0]) / 2, fz["ChR"][1] + 6, 7),
        high_cheek_left=zone_density(fz["cL"][0] + 8, fz["cL"][1] - 6, 6), high_cheek_right=zone_density(fz["cR"][0] - 8, fz["cR"][1] - 6, 6))
    # cheek line: for each x, the highest point (y) where the beard density passes 0.5 (sideburn to moustache)
    cheek_line = []
    for x in np.arange(-80, 81, 4.0):
        c = int(round((x + XR) / PX))
        col = bd[:, c] > 0.5
        r = np.where(col & (GY[:, c] < fz["Sn"][1] + 8))[0]
        if len(r):
            cheek_line.append([float(x), round(float(ys[r.min()]), 1)])
    beard["cheek_line_x_y"] = cheek_line
    bottom = []
    for x in np.arange(-60, 61, 6.0):
        c = int(round((x + XR) / PX))
        r = np.where((bd[:, c] > 0.5) & valid[:, c])[0]
        if len(r):
            bottom.append([float(x), round(float(ys[r.max()]), 1)])
    beard["lowest_visible_x_y"] = bottom

    # ---------------------------------------------------------------- moles (frontal domain, clear skin only)
    mpp = abs(face(362)[0] - face(133)[0]) / float(np.linalg.norm(pts[362, :2] - pts[133, :2]))   # face mm per photo px near the eyes
    from scipy.ndimage import maximum_filter, binary_dilation
    grow_eyes = binary_dilation(eye_holes, iterations=int(4 / PX))
    near_hair = maximum_filter(hairp_s, size=int(3 / PX)) > 0.35
    nose_edge = binary_dilation(nose_poly, iterations=int(2 / PX)) & ~binary_dilation(~nose_poly, iterations=int(5 / PX))
    nostril = valid & (GY < face(4)[1]) & (GY > face(2)[1] - 3) & (np.abs(GX) < abs(face(129)[0]) + 3)
    clear = valid & inside & ~grow_eyes & ~lips & ~near_hair & ~nose_edge & ~nostril & (GY < face(9)[1] + 20)
    fYs = gaussian_filter(fY, 0.3 / PX)
    bg = median_filter(fY[::4, ::4], size=int(6 / PX / 4) | 1)
    bg = np.kron(bg, np.ones((4, 4)))[:fY.shape[0], :fY.shape[1]]
    contrast = fYs / np.maximum(bg, 1e-4)
    lab_, n = label(clear & (contrast < 0.8))
    moles = []
    for k in range(1, n + 1):
        r = lab_ == k
        area = r.sum() * PX * PX
        vy, vx = np.where(r)
        ext = max(np.ptp(vx), np.ptp(vy)) * PX
        if not 0.25 < area < 7 or ext > 4:
            continue
        fx, fyy = float(GX[vy, vx].mean()), float(GY[vy, vx].mean())
        uv = fwd(np.array([[fx, fyy]]))[0]
        fm = inv(np.array([uv]))[0]
        moles.append(dict(side="left" if fx > 0 else "right", face_mm=[round(fx, 1), round(fyy, 1), round(float(fm[2]), 1)],
                          photo_px=[int(round(uv[0])), int(round(uv[1]))], diameter_mm=round(float(2 * np.sqrt(area / np.pi)), 2),
                          contrast=round(float(contrast[r].min()), 2), colour_lin=[round(float(v), 4) for v in np.median(flin[vy, vx], 0)]))
    moles.sort(key=lambda m: m["contrast"])
    # the owner's "two small moles on his left cheek": the two clearest spots on the left cheek proper; the rest of the
    # cheek spots (faint freckles / small marks) are listed apart; anything else (alar creases, hair tips) is dropped
    for m in moles:
        x_, y_ = m["face_mm"][:2]
        m["kind"] = "cheek" if (25 < abs(x_) < 70 and -45 < y_ < 2) else "other"
    # (a pair: the clearest one and the clearest other within 15 mm of it; the photo shows them 9-10 mm apart below the
    # outer eye corner)
    lc = [m for m in moles if m["kind"] == "cheek" and m["side"] == "left"]
    if lc:
        pair = [lc[0]] + [m for m in lc[1:] if np.hypot(m["face_mm"][0] - lc[0]["face_mm"][0], m["face_mm"][1] - lc[0]["face_mm"][1]) < 15][:1]
        for m in pair:
            m["kind"] = "mole"
    for m in moles:
        if m["kind"] == "cheek" and m["contrast"] < 0.76:
            m["kind"] = "faint_spot"
    moles = [m for m in moles if m["kind"] in ("mole", "faint_spot")]
    Image.fromarray((clear * 255).astype(np.uint8)).save(os.path.join(out, "mask_clear_skin.png"))

    # ---------------------------------------------------------------- hairline (photo, above the forehead)
    hair_line = []
    top_ids = [54, 103, 67, 109, 10, 338, 297, 332, 284]
    gapp = 0.62 * skinY
    Yb = gaussian_filter(Y, 3)
    LIN_R_B = (lin[..., 0] - lin[..., 2]) / np.maximum(Y, 1e-4)
    for a, b in zip(top_ids[:-1], top_ids[1:]):
        for f in (0.0, 0.5):
            p0 = pts[a, :2] * (1 - f) + pts[b, :2] * f
            c = int(p0[0])
            v = int(p0[1])
            # walk up from 25 px below the mesh's top edge until 12 consecutive px are hair (dark and neutral)
            run, hit = 0, None
            for vv in range(v + 25, max(0, v - 900), -1):
                hairish = Yb[vv, c] < gapp and LIN_R_B[vv, c] < sk_ch * 0.9
                run = run + 1 if hairish else 0
                if run >= 12:
                    hit = vv + 11
                    break
            if hit is None:
                continue
            fm = inv(np.array([[c, hit]]))[0]
            hair_line.append(dict(photo_px=[c, hit], face_mm=[round(float(q), 1) for q in fm] if np.all(np.isfinite(fm)) else None,
                                  covered=bool(hit > v - 15)))     # hair already over the skin at the mesh edge (loose curls on the temple)
    hl = [h["face_mm"] for h in hair_line if h["face_mm"] and not h["covered"]]
    hl_cov = [h["face_mm"] for h in hair_line if h["face_mm"] and h["covered"]]
    hl_mid = [h for h in hl if abs(h[0]) < 15]
    trichion = float(np.median([h[1] for h in hl_mid])) if hl_mid else None

    # ---------------------------------------------------------------- colours (linear Rec.709; white reference = T-shirt)
    def disc(i_or_xy, r_mm, mask=None):
        c = pts[i_or_xy, :2] if np.isscalar(i_or_xy) else np.asarray(i_or_xy, float)
        r = r_mm / mpp
        x0, x1 = max(0, int(c[0] - r)), min(lin.shape[1], int(c[0] + r) + 1)
        y0, y1 = max(0, int(c[1] - r)), min(lin.shape[0], int(c[1] + r) + 1)
        yy_, xx_ = np.mgrid[y0:y1, x0:x1]
        m = (xx_ - c[0]) ** 2 + (yy_ - c[1]) ** 2 < r * r
        if mask is not None:
            m &= mask[y0:y1, x0:x1]
        return lin[y0:y1, x0:x1][m]

    def robust(px, lo=15, hi=85):
        Yp = px @ np.array([0.2126, 0.7152, 0.0722])
        a, b = np.percentile(Yp, [lo, hi])
        sel = px[(Yp >= a) & (Yp <= b)]
        return np.median(sel, 0)

    # white reference: brightest unclipped large patch of the T-shirt below the beard
    shirt_px = []
    for du in np.linspace(-0.9, 0.9, 7):
        cu = pts[152, 0] + du * (pts[454, 0] - pts[234, 0]) / 2
        cv = pts[152, 1] + 0.45 * (pts[152, 1] - pts[10, 1])
        if 0 < cu < W and 0 < cv < H:
            q = disc((cu, cv), 10)
            if len(q) and (img8[int(cv), int(cu)] < 250).all():
                shirt_px.append(robust(q, 40, 90))
    shirt_px = np.array(shirt_px)
    shirt = shirt_px[np.argmax(shirt_px.sum(1))]
    wall = robust(disc((W * 0.88, H * 0.15), 10), 30, 70)
    wb = shirt.mean() / shirt                           # neutralise the shirt (treat it as a grey / white card)
    SHIRT_ALBEDO = 0.78                                  # white cotton jersey, diffuse

    def colour(px, name, lo=15, hi=85):
        c = robust(px, lo, hi)
        cb = c * wb
        alb = cb / shirt.mean() * SHIRT_ALBEDO
        return dict(as_shot_lin=[round(float(v), 4) for v in c], balanced_lin=[round(float(v), 4) for v in cb],
                    albedo_lin=[round(float(v), 4) for v in alb], albedo_hex=hexs(alb), n=int(len(px)))

    skin_mask_photo = ~polygon_mask((H, W), [pts[i, :2] for i in geom.LIP_OUT_UP + geom.LIP_OUT_LO[::-1]])
    skinlike = (LIN_R_B > sk_ch * 0.85) & (Y > 0.3 * skinY)

    cols = {}
    cols["skin_forehead_centre"] = colour(disc(151, 9, skinlike), "")
    cols["skin_forehead_left"] = colour(disc(333, 7, skinlike), "")
    cols["skin_forehead_right"] = colour(disc(104, 7, skinlike), "")
    cols["skin_cheek_left"] = colour(disc(425, 7, skinlike), "")
    cols["skin_cheek_right"] = colour(disc(205, 7, skinlike), "")
    cols["skin_cheekbone_left"] = colour(disc(346, 6, skinlike), "")
    cols["skin_cheekbone_right"] = colour(disc(117, 6, skinlike), "")
    cols["skin_under_eye_left"] = colour(disc(450, 3.5, skinlike), "")
    cols["skin_under_eye_right"] = colour(disc(230, 3.5, skinlike), "")
    cols["skin_nose_bridge"] = colour(disc(6, 4, skinlike), "")
    cols["skin_nose_dorsum"] = colour(disc(195, 4, skinlike), "")
    cols["skin_nose_tip"] = colour(disc(4, 4, skinlike), "", 10, 70)
    cols["skin_glabella"] = colour(disc(9, 4, skinlike), "")
    lipLo = polygon_mask((H, W), [pts[i, :2] for i in geom.LIP_IN_LO + geom.LIP_OUT_LO[::-1]])
    lipUp = polygon_mask((H, W), [pts[i, :2] for i in geom.LIP_OUT_UP + geom.LIP_IN_UP[::-1]])
    cols["lip_lower"] = colour(lin[lipLo & (LIN_R_B > sk_ch * 0.6)], "", 30, 80)
    cols["lip_upper_visible"] = colour(lin[lipUp & (LIN_R_B > sk_ch * 0.6) & (Y > 0.4 * skinY)], "", 30, 80)
    for nm, idx, (lid_up, lid_lo) in (("right", geom.IRIS_R, (159, 145)), ("left", geom.IRIS_L, (386, 374))):
        c = np.array(iris[nm]["centre_px"])
        r = iris[nm]["diameter_px"] / 2
        yy_, xx_ = np.mgrid[int(c[1] - r):int(c[1] + r), int(c[0] - r):int(c[0] + r)]
        dd = np.hypot(xx_ - c[0], yy_ - c[1])
        m = (dd > 0.3 * r) & (dd < 0.85 * r) & (yy_ > pts[lid_up, 1] + 0.1 * r) & (yy_ < pts[lid_lo, 1] - 0.05 * r)
        px = lin[yy_[m], xx_[m]]
        cols["iris_" + nm] = colour(px, "", 10, 60)
        sm = polygon_mask((H, W), [pts[i, :2] for i in ([33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7] if nm == "right" else [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249])])
        yy2, xx2 = np.where(sm)
        far = np.hypot(xx2 - c[0], yy2 - c[1]) > 1.08 * r
        cols["sclera_" + nm] = colour(lin[yy2[far], xx2[far]], "", 50, 95)
    # brows / beard / scalp hair: the dark core of each mask, plus the lighter strand tips (highlight colour)
    def mask_px(fmask, thr=0.6):
        yy_, xx_ = np.where(fmask)
        return flin[yy_, xx_]
    cols["brows"] = colour(mask_px(bmask & (hairp > 0.6)), "", 10, 60)
    cols["beard_chin"] = colour(mask_px((bd > 0.75) & (GY < fz["Li"][1] - 5)), "", 10, 60)
    cols["moustache"] = colour(mask_px((bd > 0.75) & (GY > fz["Ls"][1]) & (GY < fz["Sn"][1])), "", 10, 60)
    # scalp hair: dark neutral pixels in a band above the hairline
    yh = int(np.median([h["photo_px"][1] for h in hair_line])) if hair_line else int(pts[10, 1] - 200)
    band_h = img8[max(0, yh - 600):yh - 60, int(pts[67, 0]):int(pts[297, 0])]
    lh = lin[max(0, yh - 600):yh - 60, int(pts[67, 0]):int(pts[297, 0])].reshape(-1, 3)
    Yh = lh @ np.array([0.2126, 0.7152, 0.0722])
    hp = lh[Yh < 0.5 * skinY]
    cols["hair_scalp"] = colour(hp, "", 10, 60)
    cols["hair_highlight"] = colour(hp, "", 85, 98)
    # grey strands: thin bright neutral strands inside the dark hair mass (fraction of the hair area)
    # grey strands: thin, light, near-neutral pixels inside the dark hair mass (2 mm neighbourhood mostly dark hair)
    yh0, yh1 = max(0, int(pts[10, 1] - 1400)), int(pts[10, 1] + 200)
    xh0, xh1 = max(0, int(pts[234, 0] - 300)), min(W, int(pts[454, 0] + 300))
    Lh = lin[yh0:yh1, xh0:xh1]
    Yhh = Lh @ np.array([0.2126, 0.7152, 0.0722])
    sat = (Lh.max(2) - Lh.min(2)) / np.maximum(Lh.max(2), 1e-4)
    darkh = Yhh < 0.25 * skinY
    rr = 2.0 / mpp
    dark_frac = gaussian_filter(darkh.astype(np.float32), rr)
    mass = dark_frac > 0.6
    grey_strand = mass & (Yhh > 6 * np.median(Yhh[darkh])) & (sat < 0.3) & ~darkh
    gy_, gx_ = np.where(grey_strand)
    grey = dict(fraction_of_hair_mass=round(float(grey_strand.sum() / max(1, mass.sum())), 4),
                pixels=int(grey_strand.sum()),
                where_photo_px=[[int(np.median(gx_)) + xh0, int(np.median(gy_)) + yh0]] if len(gx_) else [],
                colour=colour(Lh[grey_strand], "", 30, 90) if len(gx_) > 50 else None)
    if len(gx_):
        cx_ = np.median(gx_) + xh0
        grey["side_of_head"] = "subject's left (image right)" if cx_ > pts[168, 0] else "subject's right (image left)"
        grey["left_right_counts"] = [int((gx_ + xh0 > pts[168, 0]).sum()), int((gx_ + xh0 <= pts[168, 0]).sum())]
    cols["white_reference_shirt"] = dict(as_shot_lin=[round(float(v), 4) for v in shirt], assumed_albedo=SHIRT_ALBEDO, wb_gains=[round(float(v), 3) for v in wb])
    cols["wall_background"] = dict(as_shot_lin=[round(float(v), 4) for v in wall])
    skin_keys = ["skin_forehead_centre", "skin_cheek_left", "skin_cheek_right", "skin_nose_dorsum", "skin_glabella"]   # front-facing, evenly lit
    sk_mean = np.median([cols[k]["albedo_lin"] for k in skin_keys], 0)

    # ---------------------------------------------------------------- feature outlines in face mm
    outline = lambda ids: [[round(float(v), 1) for v in face(i)[:2]] for i in ids]   # noqa: E731
    features = dict(
        landmarks={k: [round(float(v), 1) for v in (P(k) - eyes_mid)] for k in geom.MP} | {
            "Zy_L": [round(float(v), 1) for v in Xh[zl] - eyes_mid], "Zy_R": [round(float(v), 1) for v in Xh[zr] - eyes_mid],
            "pupil_R": [round(float(v), 1) for v in face(468)], "pupil_L": [round(float(v), 1) for v in face(473)]},
        face_oval=outline(geom.OVAL), eye_left=outline([263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249]),
        eye_right=outline([33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7]),
        brow_left_mesh=outline(geom.BROW_L_UP + geom.BROW_L_LO[::-1]), brow_right_mesh=outline(geom.BROW_R_UP + geom.BROW_R_LO[::-1]),
        lips_outer=outline(geom.LIP_OUT_UP + geom.LIP_OUT_LO[::-1][1:-1]), lips_inner=outline(geom.LIP_IN_UP + geom.LIP_IN_LO[::-1][1:-1]),
        nose=outline([168, 6, 197, 195, 5, 4, 1, 2, 98, 64, 129, 49, 131, 134, 51, 45, 4, 275, 281, 363, 360, 279, 358, 294, 327]),
        midline_profile_y_z=[[round(float(face(i)[1]), 1), round(float(face(i)[2]), 1)] for i in geom.MIDLINE])

    res = dict(
        photo=dict(size=[W, H], note="private: never copy into the repo", colour_space="Display P3 (sRGB transfer); converted to linear Rec.709",
                   exif=dict(focal_mm=focal_mm, f_number=2.2, pixel_pitch_um=pixel_um, camera="Nothing A142 front camera (32 MP 1/2.74in)")),
        detection=dict(model="MediaPipe Face Mesh 478 (0.10.21, bundled)", runs=det["runs"], jitter_px_median=round(det["jitter_px_median"], 1),
                       jitter_mm_median=round(det["jitter_px_median"] * mpp, 2), pnp_reprojection_px={k: round(float(v), 1) for k, v in zip(geom.PNP_KEYS, g["reproj_px"])}),
        camera=dict(focal_px=round(float(K[0, 0]), 1), principal_px=[W / 2, H / 2], fov_long_side_deg=round(float(2 * np.degrees(np.arctan(H / 2 / K[0, 0]))), 1),
                    distance_to_eyes_mm=round(float(g["z_eyes_iris"] * 1000), 1),
                    camera_from_eyes_mm=[round(float(v), 1) for v in cam],
                    camera_elevation_deg=round(float(np.degrees(np.arctan2(cam[1], cam[2]))), 1),
                    camera_azimuth_deg=round(float(np.degrees(np.arctan2(cam[0], cam[2]))), 1),
                    perspective_note="the camera is close (about 27 cm) and above the face: the nose and centre of the face are magnified and the "
                                     "upper face is enlarged against the chin in the raw photo; all 'frontal' numbers are corrected for it",
                    iris=iris | {"assumed_hvid_mm": geom.IRIS_MM, "used_px": d_iris},
                    face_scale_vs_template=round(float(s), 3)),
        pose=dict(yaw_deg=round(yaw, 1), pitch_deg=round(pitch, 1), roll_deg=round(roll, 1),
                  weak_perspective_check=dict(yaw_deg=round(yaw2, 1), pitch_deg=round(pitch2, 1), roll_deg=round(roll2, 1)),
                  notes="relative to looking straight into the lens. yaw > 0: face turned toward the subject's left (image right); "
                        "pitch > 0: face pointing down / head tipped forward relative to the camera ray; roll > 0: top of the head tilted toward "
                        "image left. Template: MH neutral male age 32 (face_metric landmarks), perspective PnP on " + ", ".join(geom.PNP_KEYS)),
        frontal=dict(
            face_metric_canon=dict(photo={k: round(float(v), 3) for k, v in canon.items()}, mh_neutral_male_32={k: round(float(v), 3) for k, v in canon_t.items()}),
            face_metric_features=dict(photo={k: round(float(v), 3) for k, v in feats.items()}, mh_neutral_male_32={k: round(float(v), 3) for k, v in feats_t.items()}),
            ratios=r_ratio, raw_photo_ratios_uncorrected=raw, absolute_mm=absmm,
            hairline=dict(trichion_above_endocanthion_mm=round(trichion, 1) if trichion is not None else None,
                          trichion_above_nasion_mm=round(trichion - float(face(168)[1]), 1) if trichion is not None else None,
                          total_face_height_trichion_menton_mm=round(trichion - float(face(152)[1]), 1) if trichion is not None else None,
                          points_face_mm=hl, hair_over_temple_face_mm=hl_cov),
            notes=[
                "Lifted with MediaPipe's relative depth; z (depth) values are approximate (network estimate), x / y are measured.",
                "The chin outline, menton (Me), pogonion (Pg) and gonion (Go) sit on the beard's outer surface, not the skin: the full beard adds "
                "roughly 6-12 mm below the chin and 4-8 mm at the jaw sides; the skin jaw is narrower and the skin chin higher than these values.",
                "The face outline's subject-right side (image left) follows the sideburn / hair edge, the left side the skin edge: widths include a "
                "few mm of sideburn on one side.",
                "Expression: a slight frown (brows drawn down and together, lids a little narrowed, lips closed and pressed). Neutral brows sit higher "
                "(about 2-4 mm) and the eye opening is a little larger than measured.",
                "Vx (head top) is hidden by hair: face_metric 'forehead' is omitted; 'forehead_slope' uses MediaPipe's forehead depth.",
            ]),
        colours=cols | dict(summary=dict(
            skin_albedo_lin=[round(float(v), 4) for v in sk_mean], skin_albedo_hex=hexs(sk_mean),
            note="albedo_lin = balanced pixel / shirt brightness x 0.78 (white cotton): the face and the T-shirt share the same soft indoor "
                 "daylight; balanced_lin is the white-balanced pixel (the shirt made neutral), as_shot_lin the camera's own rendering. Use the "
                 "albedo for the skin texture, the ratios between regions for its variation.")),
        brows=brows, beard=beard, moles=moles,
        masks=dict(frame=dict(x_range_mm=[-XR, XR], y_range_mm=[YB, YT], mm_per_px=PX, origin="endocanthion midpoint", row0_y_mm=YT,
                              size_px=[len(xs), len(ys)]),
                   files=dict(frontal="frontal.png", beard="mask_beard.png (density 0..1 at 1.5 mm)", brows="mask_brows.png (binary)",
                              hair="mask_hair.png (hair probability, whole frame)", skin="mask_skin.png (clear skin used for the shading field)")),
        hair_grey_strands=grey,
        hair=HAIR,
        fit_notes=FIT_NOTES,
        features=features,
    )
    Image.fromarray((np.clip(hairp_s, 0, 1) * 255).astype(np.uint8)).save(os.path.join(out, "mask_hair.png"))
    Image.fromarray((sk * 255).astype(np.uint8)).save(os.path.join(out, "mask_skin.png"))
    json.dump(res, open(os.path.join(out, "measure.json"), "w"), indent=1)
    np.savez_compressed(os.path.join(out, "lifted.npz"), Xh=Xh, eyes_mid=eyes_mid, R=R, t=t, K=K, pts=pts)

    # ---------------------------------------------------------------- annotated landmarks image
    draw_landmarks(img8, pts, iris, R, t, K, Xh, moles, hair_line, bd, fwd, cheek_line, os.path.join(out, "landmarks.png"))
    print(json.dumps(dict(pose=res["pose"], camera={k: res["camera"][k] for k in ("distance_to_eyes_mm", "camera_elevation_deg", "camera_azimuth_deg", "face_scale_vs_template")},
                          ratios=r_ratio, canon=res["frontal"]["face_metric_canon"]["photo"], moles=[(m["side"], m["face_mm"], m["diameter_mm"]) for m in moles],
                          skin=res["colours"]["summary"]), indent=1))


def draw_landmarks(img8, pts, iris, R, t, K, Xh, moles, hair_line, bd, fwd, cheek_line, path):
    import mediapipe as mp
    u = pts[:, :2]
    x0, x1 = max(0, int(u[:, 0].min() - 450)), min(img8.shape[1], int(u[:, 0].max() + 450))
    y0, y1 = max(0, int(u[:, 1].min() - 750)), min(img8.shape[0], int(u[:, 1].max() + 350))
    sc = 1500 / (x1 - x0)
    im = Image.fromarray(img8[y0:y1, x0:x1]).resize((1500, int((y1 - y0) * sc)), Image.LANCZOS)
    dr = ImageDraw.Draw(im, "RGBA")
    T = lambda p: ((p[0] - x0) * sc, (p[1] - y0) * sc)   # noqa: E731
    for a, b in mp.solutions.face_mesh.FACEMESH_TESSELATION:
        dr.line([T(u[a]), T(u[b])], fill=(120, 255, 160, 60), width=1)
    for grp, colr in ((mp.solutions.face_mesh.FACEMESH_FACE_OVAL, (255, 255, 255, 220)), (mp.solutions.face_mesh.FACEMESH_LIPS, (255, 120, 160, 230)),
                      (mp.solutions.face_mesh.FACEMESH_LEFT_EYE, (120, 200, 255, 230)), (mp.solutions.face_mesh.FACEMESH_RIGHT_EYE, (120, 200, 255, 230)),
                      (mp.solutions.face_mesh.FACEMESH_LEFT_EYEBROW, (255, 220, 80, 230)), (mp.solutions.face_mesh.FACEMESH_RIGHT_EYEBROW, (255, 220, 80, 230))):
        for a, b in grp:
            dr.line([T(u[a]), T(u[b])], fill=colr, width=2)
    f = ImageFont.load_default(size=18)
    for k, ids in geom.MP.items():
        p = T(u[ids].mean(0))
        dr.ellipse((p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5), fill=(255, 40, 40, 255))
        dr.text((p[0] + 6, p[1] - 9), k, fill=(255, 255, 0, 255), font=f, stroke_width=2, stroke_fill=(0, 0, 0, 255))
    for nm in ("right", "left"):
        c, r = iris[nm]["centre_px"], iris[nm]["diameter_px"] / 2
        p = T(c)
        dr.ellipse((p[0] - r * sc, p[1] - r * sc, p[0] + r * sc, p[1] + r * sc), outline=(0, 255, 255, 255), width=2)
    for m in moles:
        p = T(m["photo_px"])
        r_ = 14 if m["kind"] == "mole" else 9
        dr.ellipse((p[0] - r_, p[1] - r_, p[0] + r_, p[1] + r_), outline=(255, 0, 255, 255) if m["kind"] == "mole" else (255, 255, 0, 200), width=3)
    for h in hair_line:
        p = T(h["photo_px"])
        dr.ellipse((p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4), fill=(120, 120, 120, 255) if h["covered"] else (255, 140, 0, 255))
    cl = [fwd(np.array([[x, y_]]))[0] for x, y_ in cheek_line]
    cl = [T(q) for q in cl if np.all(np.isfinite(q))]
    if len(cl) > 1:
        dr.line(cl, fill=(255, 140, 0, 255), width=3)
    # head axes at the nasion (40 mm)
    N = Xh[168] / 1000
    for axis, colr in ((np.array([0.04, 0, 0]), (255, 0, 0, 255)), (np.array([0, 0.04, 0]), (0, 255, 0, 255)), (np.array([0, 0, 0.04]), (60, 120, 255, 255))):
        a = K @ (R @ N + t)
        b = K @ (R @ (N + axis) + t)
        dr.line([T(a[:2] / a[2]), T(b[:2] / b[2])], fill=colr, width=4)
    im.save(path)


if __name__ == "__main__":
    main(sys.argv[1:])
