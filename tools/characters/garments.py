"""AFTERZERO garment catalogue and garment painters (used by costume.py / build_humans.py).

Every garment type in docs/COSTUMES.md is a parameter set here. A costume is a list of worn items, innermost first:

    wear=[("mock_neck", "2a2c2f"), ("techshell", "16181c", dict(det_add=["led:zip"])), ("tech_trousers", "2e3237"),
          ("tech_boots", "1b1611", dict(sole="6a6e74")), ("gloves", "1d1a17", dict(side="R", fingerless=True))]

An item is (type, colour) or (type, colour, options); options override the catalogue entry (c2 / c3 secondary colours,
glow colour, det_add / det_del detail edits, length, side ...). Categories (`cat`):
  top     body layer over torso + sleeves; role inner / outer; optional cloth tail (long coats, tunics, ponchos)
  over    body layers over the tops: vests, carriers, harnesses, straps, plates, gorgets, capes, mantles, belts, sashes
  bottom  body layer over hips + legs (trousers, shorts, leggings, leg wraps)
  limb    body layers on the limbs (forearm guards / wraps, shin wraps, knee pads)
  hands   gloves (a 1.5 mm shell that keeps the finger weights; fingerless or full)
  feet    the fitted shoe (hull of the foot) + an optional painted / layered shaft; sole height, lip, toe cap
  skirt   cloth tubes from the waist (pleated tech skirt, leather hip-wrap)
  head    hoods (up / down), caps, beanie, Continuum helmet, ancient head wrap / headband
Painters return (albedo sRGB, height metres, glow sRGB*level); the height becomes the normal map and the glow the
emissive map of the character's single atlas material.
"""
import math
import numpy as np


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def ss(e0, e1, x):
    t = np.clip((np.asarray(x, float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def vnoise(p, f, seed=0.0):
    x, y, z = p[:, 0] * f + seed, p[:, 1] * f + seed * 0.7, p[:, 2] * f - seed * 0.3
    n = (np.sin(x * 1.7 + np.sin(y * 2.3)) + np.sin(y * 1.9 + np.sin(z * 2.9)) + np.sin(z * 2.1 + np.sin(x * 3.1))
         + 0.5 * np.sin(x * 4.3 + y * 3.7) + 0.5 * np.sin(z * 4.1 - y * 3.3))
    return n / 8 + 0.5


def hash01(p, f, seed=0.0):
    q = np.floor(p * f)
    h = np.sin(q[:, 0] * 12.9898 + q[:, 1] * 78.233 + q[:, 2] * 37.719 + seed * 4.1) * 43758.5453
    return h - np.floor(h)


def line(d, w, soft=0.0012):
    """1 on a line of width w (metres) at d == 0, soft edges."""
    return 1 - ss(w * 0.5, w * 0.5 + soft, np.abs(d))


def box(a, a0, a1, b, b0, b1, soft=0.002):
    return ss(a0 - soft, a0 + soft, a) * ss(a1 + soft, a1 - soft, a) * ss(b0 - soft, b0 + soft, b) * ss(b1 + soft, b1 - soft, b)


def box_edge(a, a0, a1, b, b0, b1, w=0.0016, inset=0.0):
    """Outline (stitch / seam) of a box, `inset` metres inside its border."""
    inside = box(a, a0 - w, a1 + w, b, b0 - w, b1 + w, 0.0005)
    d = np.minimum(np.minimum(a - a0, a1 - a), np.minimum(b - b0, b1 - b)) - inset
    return line(d, w, 0.0008) * inside


# ----------------------------------------------------------------------------------------------------------------
# catalogue
# ----------------------------------------------------------------------------------------------------------------
def T(**kw):
    # (inflate / loose / ease halved after review: sleeves and shoulders ballooned, the silhouette went soft)
    d = dict(cat="top", role="outer", z=50, neck=(0.02, 0.03), collar=None, hem=-0.05, sleeve="long", cuff=None, thick=0.010,
             loose=6, inflate=0.5, fab="shell", gloss=0.3, det=[], tail=None, rim=0.004, ease=0.005)
    d.update(kw)
    return d


def I(**kw):   # inner tops
    d = T(role="inner", z=40, neck=(0.022, 0.02), hem=-0.03, thick=0.005, loose=5, inflate=0.55, fab="knit", gloss=0.0, rim=0.0, ease=0.004)
    d.update(kw)
    return d


def O(**kw):   # over layers (vests, carriers, straps, plates)
    d = dict(cat="over", z=60, thick=0.006, loose=4, inflate=0.0, fab="webbing", gloss=0.15, det=[], rim=0.005)
    d.update(kw)
    return d


def Bt(**kw):  # bottoms
    d = dict(cat="bottom", z=20, shape="trousers", thick=0.0058, loose=4, fab="twill", gloss=0.0, det=["fly", "side_seams"], tuck=False, flare=0.0,
             top=0.012, rim=0.0025, ease=0.008)
    d.update(kw)
    return d


def Ft(**kw):  # footwear
    d = dict(cat="feet", shaft=0.0, sole_h=0.016, lip=0.0025, toe=0.0, gloss=0.42, sole_gloss=0.1, design="boot", sole="3a3a3a", fab="leather")
    d.update(kw)
    return d


def L_(**kw):  # limb pieces
    d = dict(cat="limb", z=55, thick=0.004, loose=2, fab="canvas", gloss=0.0, det=[], rim=0.003)
    d.update(kw)
    return d


def Hd(**kw):  # head
    d = dict(cat="head", z=90, fab="knit", gloss=0.05, det=[])
    d.update(kw)
    return d


STAND = lambda h, flare=0.0, lean=0.0, kind="stand": dict(kind=kind, h=h, flare=flare, lean=lean)

GARMENTS = {
    # ---------------- 2049 outer layers ----------------
    "techshell": T(neck=(0.03, 0.018), collar=STAND(0.056, 0.002, -0.002), hem=-0.065, cuff="sealed", thick=0.0115, fab="shell", gloss=0.28, ease=0.006,
                   det=["taped_seams", "zip:storm", "pocket:chest_lam", "elbow_darts", "hem_cord"], hood_ok=True),
    "longshell": T(neck=(0.032, 0.018), collar=STAND(0.06, 0.006, -0.001), hem=-0.03, cuff="sealed", thick=0.012, fab="shell", gloss=0.28, ease=0.006,
                   tail=dict(end=0.30, flare=0.2, split=0.012, vent=0.11), det=["taped_seams", "zip:placket", "pocket:hip_slash", "elbow_darts", "belt_line"]),
    "cropped_techjacket": T(neck=(0.03, 0.02), collar=STAND(0.05, 0.003), hem=0.075, cuff="sealed", thick=0.0105, fab="shell", gloss=0.38, inflate=0.55,
                            det=["taped_seams", "zip", "led:zip", "pocket:sleeve", "hem_band"]),
    "smart_parka": T(neck=(0.034, 0.02), collar=STAND(0.07, 0.012, 0.004, "funnel"), hem=-0.09, cuff="rib", thick=0.019, loose=10, inflate=0.75, fab="nylon",
                     gloss=0.3, det=["quilt_h", "zip:placket", "pocket:hip_flap"]),
    "armored_jacket": T(neck=(0.03, 0.02), collar=STAND(0.03), hem=-0.035, cuff="sealed", thick=0.0085, loose=6, inflate=0.4, fab="softshell", gloss=0.22,
                        det=["princess_seams", "quilt_side", "led:princess", "zip:hidden", "elbow_darts"], gorget=True, shoulder_caps=True),
    "duty_shell": T(neck=(0.03, 0.02), collar=STAND(0.05, 0.002), hem=-0.05, cuff="sealed", thick=0.011, fab="shell", gloss=0.36,
                    det=["taped_seams", "zip:placket", "sleeve_stripe", "chevrons:sleeve"], epaulettes=True, c3="a8262e"),
    "responder_shell": T(neck=(0.03, 0.02), collar=STAND(0.052, 0.003), hem=-0.065, cuff="sealed", thick=0.0115, fab="shell", gloss=0.36,
                         det=["two_tone", "taped_seams", "zip:placket", "reflective:torso,arms", "chevrons:back"], c2="2a2f36", c3="c8ccd0"),
    "labcoat49": T(neck=(0.024, 0.018), collar=STAND(0.03, 0.0, -0.001, "mandarin"), hem=-0.035, cuff="band", thick=0.0085, loose=3, inflate=0.12, ease=0.004,
                   fab="lab_twill", gloss=0.08, tail=dict(end=0.31, flare=0.12, split=0.03, vent=0.13, panel=0.6),
                   det=["placket:concealed", "piping:princess", "piping:placket", "piping:collar", "bonded_cuffs", "bonded_seams", "pocket:hip_slash"],
                   c2="3a4048", c3="38c8c0"),
    "labcoat26": T(neck=(0.02, 0.17), collar=STAND(0.02, 0.016, 0.0, "notch"), hem=-0.03, cuff=None, thick=0.0085, loose=6, inflate=0.45, fab="cotton",
                   gloss=0.0, tail=dict(end=0.31, flare=0.2, split=0.02, vent=0.12), open_front=0.045, det=["lapels", "pocket:patch_hip", "pocket:patch_chest", "buttons"]),
    "hoodie": T(neck=(0.02, 0.02), collar=None, hem=-0.055, cuff="rib", thick=0.0085, inflate=0.6, fab="fleece", gloss=0.0, det=["kangaroo", "rib_hem", "raglan"],
                hood_auto="hood_down"),
    "bomber": T(neck=(0.024, 0.024), collar=STAND(0.026, 0.0, 0.0, "rib"), hem=0.045, cuff="rib", thick=0.012, inflate=0.6, fab="nylon", gloss=0.32,
                det=["zip", "rib_hem", "pocket:sleeve", "pocket:welt"]),
    "puffer": T(neck=(0.03, 0.02), collar=STAND(0.05, 0.006), hem=-0.05, cuff="band", thick=0.022, loose=10, inflate=0.75, fab="nylon", gloss=0.38,
                det=["quilt_h:0.075", "zip"]),
    "utility_jacket": T(neck=(0.016, 0.05), collar=STAND(0.03, 0.02, 0.0, "shirt"), hem=-0.05, cuff="band", thick=0.0095, fab="canvas", gloss=0.0,
                        det=["placket", "pocket:utility4", "side_seams", "topstitch"]),
    "padded_jacket": T(neck=(0.02, 0.03), collar=STAND(0.028, 0.012, 0.0, "shirt"), hem=-0.05, cuff="band", thick=0.013, inflate=0.6, fab="nylon", gloss=0.25,
                       det=["quilt_diamond", "placket", "pocket:hip_flap"]),
    "car_coat": T(neck=(0.02, 0.14), collar=STAND(0.022, 0.018, 0.0, "notch"), hem=-0.03, cuff=None, thick=0.012, loose=7, inflate=0.55, fab="wool", gloss=0.0,
                  tail=dict(end=0.40, flare=0.16, split=0.03, vent=0.1), det=["lapels", "placket:concealed", "buttons:3", "pocket:hip_flap", "side_seams"],
                  button="2a1e16"),
    "rain_mac": T(neck=(0.02, 0.07), collar=STAND(0.04, 0.025, 0.0, "shirt"), hem=-0.03, cuff="strap", thick=0.0105, loose=7, inflate=0.6, fab="gabardine", gloss=0.12,
                  tail=dict(end=0.30, flare=0.22, split=0.02, vent=0.12), det=["storm_flap_trench", "placket:double", "belt_line", "pocket:hip_slash"], belt=True, epaulettes=True),
    "field_jacket_worn": T(neck=(0.024, 0.03), collar=STAND(0.032, 0.012, 0.0, "shirt"), hem=-0.06, cuff="band", thick=0.011, fab="canvas", gloss=0.0,
                           det=["placket", "pocket:utility4", "patches", "wear", "elbow_patches", "side_seams"], hood_auto="hood_down", wear=0.85, c2="8a6a3a"),
    "poncho_hooded": T(neck=(0.03, 0.02), collar=None, hem=-0.02, sleeve="poncho", thick=0.016, loose=14, inflate=1.0, fab="canvas", gloss=0.0, z=80,
                       det=["patches", "wear", "fray"], poncho=dict(front=0.43, back=0.24, side=0.37), hood_auto="hood_up", wear=0.9, c2="6a5a44"),
    # the 2196 survivors' long hooded cloak: open down the front (about 20 cm, the jerkin / vest and trousers show
    # through), a short cape over the shoulders and upper arms, knee-length in front and calf-length behind, a full
    # hood lying on the upper back, a leather clasp strap at the hips; felted, patched, frayed along the opening
    "cloak_hooded": T(neck=(0.03, 0.05), collar=None, hem=-0.02, sleeve="cape", thick=0.012, loose=10, inflate=0.7, fab="felt", gloss=0.0, z=80,
                      det=["wear", "fray", "stitch_edges", "patches", "clasp_band"], tail=dict(end=0.2, end_front=0.3, flare=0.14, open=0.1, vent=0.12),
                      open_front=0.1, open_full=True, hood_auto="hood_up", hood_wrap=96, hood_T=0.068, hood_D=0.22, wear=0.6, c2="4a3a2a"),
    # graphite under-suit, matte satin (roughness ~0.62); the ceramic plates are rigid gadget geometry (continuum_armor)
    "continuum_suit": T(neck=(0.04, 0.03), collar=STAND(0.045, 0.0, -0.003, "gorget"), hem=-0.06, cuff=None, thick=0.0035, loose=3, inflate=0.35, fab="softshell", gloss=0.1,
                        det=["suit_lines"], plates=False, c2="e6e8ea", c3="d9a441"),
    "tunic": T(neck=(0.012, 0.035), collar=None, hem=-0.035, sleeve="short", thick=0.006, loose=12, inflate=0.45, fab="linen", gloss=0.0,
               tail=dict(end=0.27, flare=0.2, split=0.0, vent=0.0, slits=0.11), det=["border", "dye", "neck_roll"]),
    # ---------------- inner tops ----------------
    "mock_neck": I(neck=(0.045, 0.035), collar=STAND(0.028, 0.0, -0.002, "rib"), det=["rib_cuffs"]),
    "turtleneck": I(neck=(0.05, 0.04), collar=STAND(0.045, 0.004, -0.001, "turtle"), det=["rib", "rib_cuffs"]),
    "tshirt": I(neck=(0.012, 0.035), collar=STAND(0.008, 0.0, 0.0, "crew"), sleeve="short", fab="jersey", det=["side_seams"]),
    "flannel_shirt": I(neck=(0.014, 0.05), collar=STAND(0.026, 0.016, 0.0, "shirt"), fab="flannel", det=["plaid", "placket", "pocket:shirt2"], c2="3a2a2a", c3="d8d0c4",
                       thick=0.0055),
    "knit_sweater": I(neck=(0.018, 0.02), collar=STAND(0.014, 0.0, 0.0, "crew"), thick=0.0075, fab="knit", det=["rib", "rib_cuffs", "rib_hem"], hem=-0.05),
    "denim_shirt": I(neck=(0.014, 0.05), collar=STAND(0.026, 0.016, 0.0, "shirt"), fab="chambray", det=["placket", "pocket:shirt2", "topstitch"], thick=0.0055),
    "jerkin": I(neck=(0.02, 0.03), collar=STAND(0.02), thick=0.009, fab="nylon", det=["quilt_h:0.05", "placket"], sleeve="none", hem=-0.05),
    "wipe_shell": T(neck=(0.03, 0.02), collar=STAND(0.04), hem=-0.06, cuff="band", thick=0.010, fab="shell", gloss=0.5, det=["zip", "sleeve_guards"]),
    # ---------------- over layers ----------------
    "smart_vest": O(shape="vest", thick=0.0065, fab="hivis", gloss=0.2, det=["reflective:vest", "led:bands", "back_panel"], c3="d8dce0", hem=-0.04, bind=0.32),
    "plate_carrier": O(shape="carrier", thick=0.016, fab="cordura", gloss=0.05, rim=0.014, det=["molle", "chest_panel", "edge_bind"], pouches=True, c3="c8ccd0"),
    "chest_harness": O(shape="harness", thick=0.0035, fab="webbing", gloss=0.1, rim=0.003, det=["webbing", "edge_bind"], buckles=True, z=65),
    "scav_plate": O(shape="carrier", thick=0.015, fab="polymer", gloss=0.2, rim=0.012, det=["scav_plates", "wear", "scratches"], wear=0.9, pouches=False,
                    c2="4a4a3a", c3="1c2533", c4="b0a050"),
    "pauldron": O(shape="pauldron", side="L", thick=0.012, fab="polymer", gloss=0.25, rim=0.01, det=["lames", "wear", "scratches"], wear=0.8, z=70),
    "utility_vest": O(shape="vest", thick=0.006, fab="waxed_canvas", gloss=0.12, rim=0.004, det=["zip", "yoke", "pocket:vest", "tool_loops", "edge_bind"], hem=-0.05,
                      yoke=True),
    "padded_vest": O(shape="vest", thick=0.012, fab="canvas", gloss=0.0, rim=0.008, det=["quilt_h:0.06", "pocket:vest", "wear"], hem=-0.05, wear=0.7),
    "vendor_vest": O(shape="vest", thick=0.005, fab="shell", gloss=0.45, rim=0.004, det=["pocket:vest", "edge_bind"], hem=-0.05),
    "leather_cuirass": O(shape="cuirass", thick=0.008, fab="hard_leather", gloss=0.3, rim=0.006, det=["stitch_edges", "tooling"], hem=0.02),
    "leather_hipwrap": dict(cat="skirt", shape="hipwrap", fab="leather", gloss=0.25, length=0.17, det=["stitch_edges", "clay"], z=72),
    "gorget": O(shape="gorget", thick=0.009, fab="metal", gloss=0.6, rim=0.006, det=["gorget_lines"], z=72),
    "half_cape": O(shape="half_cape", side="L", thick=0.014, loose=10, fab="satin", gloss=0.3, rim=0.003, det=["cape_trim"], z=75),
    "mantle_wrap": O(shape="mantle", side="L", thick=0.009, loose=10, fab="linen", gloss=0.0, rim=0.0, det=["dye", "fold_lines", "stitch_edges"], z=70, roll=True),
    "sash": O(shape="sash", thick=0.007, loose=4, fab="linen", gloss=0.0, rim=0.0, det=["dye", "fold_lines"], z=74, knot="L", width=0.085),
    "cord_belt": O(shape="belt", thick=0.004, fab="cord", gloss=0.0, rim=0.0, z=75, width=0.012, roll=True),
    "leather_belt": O(shape="belt", thick=0.0045, fab="leather", gloss=0.35, rim=0.004, z=75, width=0.032, buckle=True),
    "duty_belt": O(shape="belt", thick=0.008, fab="cordura", gloss=0.15, rim=0.006, z=75, width=0.05, buckle=True, det=["webbing"]),
    "epaulettes": O(shape="epaulettes", thick=0.004, fab="shell", gloss=0.3, rim=0.003, z=62),
    "sling_strap": O(shape="strap", side="R", thick=0.003, fab="webbing", gloss=0.1, rim=0.003, det=["webbing"], z=78, width=0.038),
    "bandolier": O(shape="strap", side="L", thick=0.006, fab="leather", gloss=0.25, rim=0.005, det=["shards"], z=78, width=0.06),
    # ---------------- limb pieces ----------------
    "forearm_guards": L_(shape="forearm_guard", thick=0.0065, fab="polymer", gloss=0.25, rim=0.006, det=["guard_lines"]),
    "forearm_wraps": L_(shape="forearm_wrap", thick=0.0035, fab="canvas", det=["wraps", "wear"], wear=0.7),
    "shin_wraps": L_(shape="shin_wrap", thick=0.004, fab="canvas", det=["wraps", "wear"], wear=0.7, z=32),
    "knee_pads": L_(shape="knee_pad", thick=0.013, fab="polymer", gloss=0.2, rim=0.012, det=["pad_lines", "wear"], z=34, wear=0.4),
    "sleeve_guards": L_(shape="forearm_wrap", thick=0.004, fab="shell", gloss=0.5, det=[]),
    # ---------------- bottoms ----------------
    "tech_trousers": Bt(fab="stretch_twill", det=["fly", "side_seams", "knee_darts", "seat_panel", "pocket:thigh_zip"], thick=0.0055),
    "cargo_trousers": Bt(fab="ripstop", det=["fly", "side_seams", "pocket:cargo", "knee_patch"], thick=0.0085, loose=6),
    "cargo_joggers": Bt(fab="softshell", det=["side_seams", "pocket:cargo", "rib_ankle"], thick=0.0075, loose=6, cinch=True),
    "work_trousers": Bt(fab="canvas", det=["fly", "side_seams", "pocket:kneepad", "topstitch", "pocket:cargo"], thick=0.0085, loose=6),
    "jeans": Bt(fab="denim", det=["fly", "side_seams", "jeans", "topstitch"], thick=0.0055),
    "chinos": Bt(fab="twill", det=["fly", "side_seams", "pocket:slant"], thick=0.0058),
    "wide_trousers": Bt(fab="twill", det=["fly", "side_seams", "pleat_line"], thick=0.008, loose=8, flare=0.035),
    "leggings": Bt(z=10, shape="leggings", fab="stretch", det=["side_seams"], thick=0.0022, loose=2, gloss=0.12, rim=0.0, ease=0.0),
    "tech_shorts": Bt(shape="shorts", fab="softshell", det=["side_seams", "pocket:cargo_short"], thick=0.008, loose=6),
    "leg_wraps": Bt(z=18, shape="leg_wraps", fab="linen", det=["wraps", "dye"], thick=0.0035, loose=2, rim=0.002, ease=0.0),
    "canvas_trousers": Bt(fab="canvas", det=["fly", "side_seams", "patches", "wear"], thick=0.008, loose=6, wear=0.8),
    "suit_trousers": Bt(fab="softshell", det=["suit_lines"], thick=0.0032, loose=2, gloss=0.1, rim=0.0, ease=0.0),
    "soft_trousers": Bt(fab="linen", det=["side_seams"], thick=0.0075, loose=8),
    # ---------------- skirts ----------------
    "tech_skirt": dict(cat="skirt", shape="pleated", fab="shell", gloss=0.3, length=0.25, pleats=14, det=["hem_band_thin"], z=26),
    # ---------------- footwear ----------------
    "tech_boots": Ft(shaft=0.085, sole_h=0.026, lip=0.003, toe=0.002, gloss=0.35, design="tech_boot", sole="6a6e74", fab="leather"),
    "combat_boots": Ft(shaft=0.17, sole_h=0.026, lip=0.004, toe=0.002, gloss=0.3, design="lace_boot", sole="1a1a1a", fab="leather"),
    "safety_boots": Ft(shaft=0.1, sole_h=0.028, lip=0.0045, toe=0.006, gloss=0.25, design="safety", sole="2a2a2a", fab="leather"),
    "service_boots": Ft(shaft=0.12, sole_h=0.02, lip=0.003, toe=0.002, gloss=0.6, design="smooth_boot", sole="141414", fab="leather"),
    "sneakers": Ft(shaft=0.0, sole_h=0.022, lip=0.0035, toe=0.001, gloss=0.15, design="sneaker", sole="e8e4dc", fab="mesh"),
    "chunky_sneakers": Ft(shaft=0.0, sole_h=0.036, lip=0.0055, toe=0.002, gloss=0.15, design="sneaker", sole="e8e4dc", fab="mesh"),
    "light_up_sneakers": Ft(shaft=0.0, sole_h=0.024, lip=0.004, toe=0.001, gloss=0.15, design="sneaker", sole="e8e4dc", fab="mesh", glow_sole=True),
    "ankle_boots": Ft(shaft=0.07, sole_h=0.016, lip=0.0025, toe=0.0, gloss=0.5, design="chelsea", sole="1c1a18", fab="leather"),
    "derby_boots": Ft(shaft=0.075, sole_h=0.016, lip=0.003, toe=0.0, gloss=0.65, design="lace_boot", sole="141210", fab="leather"),
    "loafers": Ft(shaft=0.0, sole_h=0.012, lip=0.002, toe=0.0, gloss=0.6, design="loafer", sole="1a1210", fab="leather"),
    "leather_work_shoes": Ft(shaft=0.0, sole_h=0.018, lip=0.003, toe=0.001, gloss=0.3, design="lace_shoe", sole="2a2420", fab="leather"),
    "rain_boots": Ft(shaft=0.2, sole_h=0.02, lip=0.004, toe=0.002, gloss=0.7, design="rubber", sole="", fab="rubber"),
    "wrapped_boots": Ft(shaft=0.16, sole_h=0.02, lip=0.004, toe=0.002, gloss=0.08, design="wrapped", sole="2a2620", fab="canvas", wear=0.9),
    "sandals": Ft(shaft=0.0, sole_h=0.012, lip=0.003, gloss=0.2, design="sandal", sole="4a3220", fab="leather", sandal=True),
    "tactical_boots": Ft(shaft=0.15, sole_h=0.026, lip=0.004, toe=0.002, gloss=0.3, design="lace_boot", sole="141414", fab="leather"),
    # ---------------- hands ----------------
    "gloves": dict(cat="hands", z=35, side="both", fingerless=False, fab="leather", gloss=0.3, thick=0.0016),
    # ---------------- head ----------------
    "hood_down": Hd(kind="hood_down"),
    "hood_up": Hd(kind="hood_up"),
    "tech_cap": Hd(kind="cap", fab="softshell", gloss=0.12, crown=0.075, bill=0.07, lamp_mount=False),
    "transit_cap": Hd(kind="peaked", fab="twill", gloss=0.2, badge=True),
    "tactical_cap": Hd(kind="cap", fab="cordura", gloss=0.05, crown=0.065, bill=0.062, patch=True),
    "beanie": Hd(kind="beanie", fab="knit"),
    "continuum_helmet": Hd(kind="helmet", fab="ceramic", gloss=0.62, visor="slit"),
    "continuum_helmet_officer": Hd(kind="helmet", fab="ceramic", gloss=0.62, visor="open"),
    "head_wrap": Hd(kind="head_wrap", fab="linen", gloss=0.0),
    "woven_headband": Hd(kind="headband", fab="woven", gloss=0.0),
}
HAIR_STYLES = ["waves", "curls", "puffs", "locs", "undercut", "fade", "pixie"]


def plant_dye(hx):
    import colorsys
    r, gg, b = hexc(hx)
    h, s, v = colorsys.rgb_to_hsv(r, gg, b)
    r, gg, b = colorsys.hsv_to_rgb(h, s * 0.72, v * 0.92)
    return "%02x%02x%02x" % tuple(int(round(min(max(x, 0), 1) * 255)) for x in (r, gg, b))


def resolve(c):
    """The character's costume: worn items with catalogue params merged with per-item options, grouped by category."""
    out = dict(items=[], top=[], over=[], bottom=[], limb=[], hands=[], feet=None, skirt=[], head=[])
    for it in c.get("wear", []):
        if isinstance(it, str):
            t, col, opt = it, None, {}
        else:
            t, col, opt = it[0], (it[1] if len(it) > 1 else None), (it[2] if len(it) > 2 else {})
        if t not in GARMENTS:
            raise KeyError(f"{c['id']}: unknown garment type {t!r}")
        g = {k: (list(v) if isinstance(v, list) else dict(v) if isinstance(v, dict) else v) for k, v in GARMENTS[t].items()}
        g["det"] = [d for d in g.get("det", []) if d not in opt.get("det_del", [])] + list(opt.get("det_add", []))
        g.update({k: v for k, v in opt.items() if k not in ("det_add", "det_del")})
        g["type"] = t
        g["color"] = col or g.get("color", "444a55")
        if str(c.get("era")) == "ancient":       # plant dyes: about 25 % less saturated and a little darker, soiled
            for kk in ("color", "c2", "c3"):
                if g.get(kk):
                    g[kk] = plant_dye(g[kk])
            if g.get("cat") in ("top", "bottom", "over", "skirt") and "soil" not in g["det"]:
                g["det"] = g["det"] + ["soil"]
        g.setdefault("glow", c.get("glow"))
        g.setdefault("glow_level", c.get("glowLevel", 0.5))
        g.setdefault("wear", c.get("wearLevel", 0.0))
        out["items"].append(g)
        if g["cat"] == "feet":
            out["feet"] = g
        else:
            out[g["cat"]].append(g)
    tops = out["top"]
    outer = [g for g in tops if g["role"] == "outer"]
    out["outer"] = outer[-1] if outer else (tops[-1] if tops else None)
    heads = {g["kind"] for g in out["head"]}
    for g in tops:     # hoodies / field jackets / ponchos bring their hood unless the spec chose one
        if g.get("hood_auto") and not heads & {"hood_down", "hood_up", "helmet"} and not c.get("noHood"):
            h = dict(GARMENTS[g["hood_auto"]], type=g["hood_auto"], color=g["color"], det=[])
            out["head"].append(h)
            heads.add(h["kind"])
    for h in out["head"]:
        if h["kind"] in ("hood_down", "hood_up"):
            src = out["outer"] if out["outer"] is not None else (tops[-1] if tops else None)
            h.setdefault("src", src)
    return out


# ----------------------------------------------------------------------------------------------------------------
# painting
# ----------------------------------------------------------------------------------------------------------------
class Ctx:
    """Per-texel coordinates for the garment painters (all arrays share the texel order).
    q (N,3) MakeHuman metres (x left, y up, z forward); f distance inside the garment border (m);
    th torso azimuth (deg, 0 = front, +90 = left side); r radius from the torso axis; u arc length around the torso;
    arm / leg membership (0..1); sa / aa arm arc length from the shoulder and angle around the arm (0 front, 90 up);
    sl / la leg arc length from the hip and angle around the leg (0 front, 90 outer side); side +1 left / -1 right."""

    def __init__(self, **kw):
        self.__dict__.update(kw)

    def sub(self, m):
        d = {}
        for k, v in self.__dict__.items():
            d[k] = v[m] if isinstance(v, np.ndarray) and v.shape[:1] == (self.n,) else v
        d["n"] = int(np.count_nonzero(m)) if m.dtype == bool else len(m)
        return Ctx(**d)


FAB = {  # base roughness feel is per vertex (gloss); here: luminance texture k and micro height
    "shell": dict(n=0.035, f=90, h=0.00008), "nylon": dict(n=0.04, f=120, h=0.0001), "softshell": dict(n=0.05, f=200, h=0.00012),
    "ripstop": dict(n=0.05, f=160, grid=0.011), "cordura": dict(n=0.07, f=260, h=0.00015), "knit": dict(n=0.07, f=240, rib=0.0045),
    "fleece": dict(n=0.07, f=180, h=0.0002), "jersey": dict(n=0.05, f=220, h=0.0001), "cotton": dict(n=0.045, f=180, h=0.00008),
    "coated_twill": dict(n=0.08, f=160, twill=True, tw=0.09, h=0.00012),
    "lab_twill": dict(n=0.018, f=220, twill=True, tw=0.022, h=0.00016),     # Helix lab coat: crisp, fine twill (no mottling) "twill": dict(n=0.06, f=180, twill=True), "stretch_twill": dict(n=0.05, f=170, twill=True),
    "denim": dict(n=0.1, f=150, twill=True, denim=True), "chambray": dict(n=0.08, f=200, h=0.0001), "flannel": dict(n=0.07, f=140, h=0.0002),
    "canvas": dict(n=0.09, f=130, weave=0.004), "waxed_canvas": dict(n=0.1, f=110, weave=0.004), "wool": dict(n=0.08, f=150, h=0.0002),
    "felt": dict(n=0.11, f=90, h=0.0003), "gabardine": dict(n=0.05, f=180, twill=True), "linen": dict(n=0.08, f=100, linen=True),
    "leather": dict(n=0.1, f=260, h=0.0002), "suede": dict(n=0.13, f=200, h=0.0003), "hard_leather": dict(n=0.12, f=220, h=0.0003), "polymer": dict(n=0.04, f=60, h=0.00005),
    "ceramic": dict(n=0.012, f=40, h=0.0), "satin": dict(n=0.03, f=120, h=0.00005), "metal": dict(n=0.03, f=300, h=0.0),
    "webbing": dict(n=0.05, f=300, web=True), "hivis": dict(n=0.03, f=160, h=0.00006, weave=0.0024), "stretch": dict(n=0.03, f=200, h=0.00005),
    "cord": dict(n=0.1, f=400, h=0.0002), "woven": dict(n=0.1, f=200, weave=0.003), "mesh": dict(n=0.06, f=300, h=0.0001),
    "rubber": dict(n=0.02, f=60, h=0.0),
}


def fabric(fab, X, seed):
    p = FAB.get(fab, FAB["cotton"])
    q = X.q
    k = 1 + p["n"] * (vnoise(q, p["f"], seed) - 0.5) * 2 + 0.25 * p["n"] * (vnoise(q, p["f"] * 6, seed + 2) - 0.5)
    h = p.get("h", 0.0001) * (vnoise(q, p["f"] * 4, seed + 5) - 0.5)
    if p.get("twill"):     # (the weave itself is below a texel: only its diagonal mottling shows)
        tw = vnoise(q * np.array([1.0, 1.0, 0.5]) + (q[:, 0] + q[:, 1])[:, None] * 3.0, 260, seed + 9) - 0.5
        k = k + p.get("tw", 0.04) * tw
        h = h + 0.00008 * tw * (p.get("tw", 0.04) / 0.04)
    if p.get("denim"):
        k = k * (0.9 + 0.2 * vnoise(q * np.array([3.0, 0.4, 3.0]), 60, seed + 1))        # vertical slub streaks
    if p.get("rib"):
        ru = X.u if X.u is not None else q[:, 0]
        rib = np.sin(ru * 2 * math.pi / max(p["rib"], 0.008))
        k = k + 0.05 * rib
        h = h + 0.0003 * rib
    if p.get("grid"):
        gx = np.abs(((X.u + 10) / p["grid"]) % 1 - 0.5)
        gy = np.abs(((q[:, 1] + 10) / p["grid"]) % 1 - 0.5)
        gr = np.maximum(ss(0.42, 0.5, gx), ss(0.42, 0.5, gy))
        k = k * (1 + 0.04 * gr)
        h = h + 0.00008 * gr
    if p.get("weave"):
        w = np.sin(X.u * 2 * math.pi / p["weave"]) * np.sin(q[:, 1] * 2 * math.pi / p["weave"])
        k = k + 0.03 * w
        h = h + 0.00012 * w
    if p.get("linen"):    # slub weave: thick and thin threads, horizontal and vertical streaks
        sl = vnoise(q * np.array([1.0, 30.0, 1.0]), 25, seed + 3) - 0.5
        sv = vnoise(q * np.array([25.0, 1.0, 25.0]), 25, seed + 7) - 0.5
        k = k + 0.09 * sl + 0.07 * sv
        h = h + 0.0002 * (sl + sv)
    if p.get("web"):
        k = k * (0.97 + 0.03 * vnoise(q, 500, seed + 4))
    return k, h


def side_seams(X, w=0.0016):
    return line(np.radians(np.abs(X.th) - 90) * X.r, w) * X.torso


def princess_x(X):
    return 0.072 + 0.03 * np.clip((X.J["chest"][1] - X.y) / 0.25, -0.6, 1.4)


def zip_x(X, kind):
    """x of the front closure line (asymmetric storm flap: off-centre to the right at the collar, centre at the hem)."""
    if kind == "storm":
        t = np.clip((X.y - X.J["spine"][1]) / max(X.J["shoulder_L"][1] - X.J["spine"][1] + 0.05, 1e-3), 0, 1)
        return -0.045 * t ** 1.2
    return np.zeros(X.n)


def paint(g, X, seed):
    """Albedo (N,3), height (N), glow (N,3) of garment g at texels X."""
    n = X.n
    base = hexc(g["color"])
    c2 = hexc(g.get("c2") or g["color"]) if g.get("c2") else base * 0.8
    c3 = hexc(g.get("c3") or "c8ccd0")
    glow_c = hexc(g["glow"]) if g.get("glow") else None
    glvl = float(g.get("glow_level", 0.5))
    k, h = fabric(g.get("fab", "cotton"), X, seed)
    col = np.tile(base, (n, 1)).astype(float)
    glow = np.zeros((n, 3))
    J, y = X.J, X.y
    front = (X.z > X.zc).astype(float)
    det = g.get("det", [])

    def mix(m, rgb):
        nonlocal col
        m = np.clip(m, 0, 1)[:, None]
        col = col * (1 - m) + np.asarray(rgb)[None, :] * m if np.ndim(rgb) == 1 else col * (1 - m) + rgb * m

    def shade(m, f):
        nonlocal k
        k = k * (1 + (f - 1) * np.clip(m, 0, 1))

    def seam(m, depth=0.00035, dark=0.82):
        nonlocal h
        shade(m, dark)
        h = h - depth * np.clip(m, 0, 1)

    def lit(m, rgb=None, level=None):
        """LED / light line: emissive + a lit albedo."""
        if glow_c is None and rgb is None:
            return
        cc = hexc(rgb) if isinstance(rgb, str) else (rgb if rgb is not None else glow_c)
        m = np.clip(m, 0, 1)
        glow[:] = np.maximum(glow, m[:, None] * cc[None, :] * (level if level is not None else glvl))
        mix(m * 0.7, cc * 0.85 + 0.15)

    tor, arm, leg = X.torso, X.arm, X.leg
    for d in det:
        name, _, arg = d.partition(":")
        if name in ("taped_seams", "bonded_seams"):
            w = 0.011 if name == "taped_seams" else 0.006
            lines = []
            lines.append(np.radians(np.abs(X.th) - 92) * X.r * tor)                                                   # side seams
            lines.append(np.where(tor > 0.5, (y - (J["shoulder_L"][1] - 0.085 * X.k)), 9) * (np.abs(X.x) < 0.17))    # yoke
            lines.append(np.where(arm > 0.5, np.radians(X.aa + 95) * X.ra, 9))                                         # under-sleeve
            lines.append(np.where((arm > 0.2) & (arm < 0.8), (arm - 0.5) * 0.07, 9))                                    # armhole
            lines.append(np.where(tor > 0.5, np.radians(180 - np.abs(X.th)) * X.r, 9) * (1 - front))                     # centre back
            dd = np.min(np.abs(np.stack(lines)), 0)
            tape = line(dd, w, 0.0015)
            shade(tape, 1.06 if name == "taped_seams" else 0.97)
            h = h + 0.00025 * tape
            seam(line(dd, 0.0012, 0.0006), 0.0003, 0.78)
        elif name in ("side_seams", "raglan", "princess_seams", "suit_lines"):
            if name == "side_seams":
                seam(side_seams(X) + line(np.where(leg > 0.5, np.radians(np.abs(X.la) - 90) * X.rl, 9), 0.0016))
            elif name == "raglan":
                rag = np.where(tor > 0.3, (y - J["shoulder_L"][1] + 0.02) + 0.55 * (np.abs(X.x) - 0.06), 9)
                seam(line(rag, 0.0016) * (np.abs(X.x) > 0.05) + line(np.where(arm > 0.5, np.radians(X.aa + 95) * X.ra, 9), 0.0016))
            elif name == "princess_seams":
                seam(line(np.abs(X.x) - princess_x(X), 0.0016) * tor * (y < J["shoulder_L"][1] - 0.02))
            else:   # under-suit: panel lines (Continuum)
                l1 = line(np.abs(X.x) - princess_x(X), 0.002) * tor
                l2 = line(np.where(leg > 0.5, np.radians(np.abs(X.la) - 90) * X.rl, 9), 0.002)
                l3 = line(np.where(arm > 0.5, np.radians(X.aa - 90) * X.ra, 9), 0.002)
                seam(l1 + l2 + l3, 0.0004, 0.7)
        elif name == "zip":
            xl = zip_x(X, arg)
            d0 = np.where((front > 0) & (tor > 0.5), X.x - xl, 9.0)
            if arg == "hidden":
                seam(line(d0, 0.0015), 0.0003, 0.8)
            elif arg == "placket":
                seam(line(d0 - 0.022, 0.0014))
                shade(line(d0 - 0.011, 0.02, 0.002), 0.97)
                seam(line(d0, 0.0012), 0.0002, 0.85)
            else:
                tape = line(d0, 0.009, 0.001)
                mix(tape * 0.6, base * 0.45)
                h = h + 0.0005 * line(d0, 0.004)
                if arg == "storm":   # the flap closes over the zip toward the right: a shadow line at its edge
                    seam(line(d0 + 0.028, 0.0018), 0.0007, 0.65)
                    h = h + 0.0006 * ss(0.03, 0.026, -d0) * ss(-0.002, 0.002, -d0)
        elif name == "piping":     # thin contrast piping in c2 (lab coat: princess seams, front edge, collar edge)
            if arg == "princess":
                m = line(np.abs(X.x) - princess_x(X), 0.0022, 0.0006) * tor * (y < J["shoulder_L"][1] - 0.02)
            elif arg == "placket":
                m = line(np.where((front > 0) & ((tor + X.tail) > 0.5), X.x - 0.022, 9.0), 0.0018, 0.0006) * (y < J["neck"][1] - 0.04)
            else:
                m = line(X.f - 0.0035, 0.0018, 0.0006) * X.collar
            mix(m * 0.9, c2)
            h = h + 0.00015 * m
        elif name == "wrap_cross":     # a closed crossed wrap: the overlap edge runs from the left collarbone to the right hip
            nb_, hp_ = J["neck"][1] - 0.03, J["pelvis"][1]
            tt = np.clip((nb_ - y) / max(nb_ - hp_, 1e-3), 0, 1.4)
            d = X.x - (0.075 - 0.2 * tt)
            ok = front * (tor + X.tail) * (y < nb_ + 0.01)
            seam(line(d, 0.0022, 0.0008) * ok, 0.0009, 0.62)
            shade(ss(0.0, -0.025, d) * ss(-0.05, -0.025, d) * ok, 0.88)       # the under-layer's shadow beside the edge
            h = h + 0.0012 * ss(-0.002, 0.004, d) * ok
        elif name == "soil":       # worn plant-dyed cloth: earth at the hems and over the knees, a little everywhere
            hem_m = ss(0.1, 0.0, X.f) * (y < J["chest"][1])
            knee = np.exp(-((y - 0.285 * X.H) / 0.055) ** 2) * (leg if leg is not None else 0) * front
            m = np.clip(0.55 * hem_m + 0.4 * knee + 0.12, 0, 1) * (0.5 + 0.5 * vnoise(X.q, 30, seed + 21))
            mix(m * 0.42, hexc("6e5c44") * (0.9 + 0.2 * vnoise(X.q, 90, seed + 22)[:, None]))
        elif name == "soot_tips":      # a smith's hide glove: soot and scorch darkening toward the fingertips
            m = ss(0.06, 0.17, X.f) * (0.75 + 0.25 * vnoise(X.q, 60, seed + 8))
            mix(m * 0.8, hexc("1c1610") * (0.85 + 0.3 * vnoise(X.q, 140, seed + 9)[:, None]))
            shade(ss(0.6, 0.8, vnoise(X.q, 90, seed + 10)) * 0.5, 1.12)                       # worn, lighter scuffs
        elif name == "lace_wrap":      # a rawhide lace wound round the gauntlet cuff
            d = X.f - 0.03
            band = box(d, -0.016, 0.016, X.x, -9, 9, 0.002)
            ru = X.u if X.u is not None else X.q[:, 0]
            lace = line(np.sin((ru * 60.0 + X.f * 180.0)) * 0.01, 0.0035, 0.001) * band
            mix(lace, hexc("a08860"))
            h = h + 0.0006 * lace
        elif name == "clasp_band":     # the leather strap closing an open-front cloak at the hem loop (c2), a buckle
            hy = g.get("_hem_y", J["pelvis"][1])
            m = box(y, hy - 0.004, hy + 0.036, np.abs(X.x), 0, 0.2, 0.0015) * front * tor
            mix(m, c2 * (0.9 + 0.2 * vnoise(X.q, 200, seed + 4)[:, None]))
            h = h + 0.0008 * m
            bk = box(np.abs(X.x) - 0.11, -0.016, 0.016, y, hy, hy + 0.032, 0.001) * front * tor
            mix(bk * 0.9, hexc("6a645a"))
            h = h + 0.0012 * bk
        elif name == "bonded_cuffs":   # bonded dark cuff band with a thin emissive seam (the coat stays 2049)
            m = ss(0.052, 0.048, X.f) * arm
            mix(m, c2 * (0.96 + 0.04 * vnoise(X.q, 300, seed + 3)[:, None]))
            h = h + 0.0003 * m
            lit(line(X.f - 0.05, 0.0012, 0.0005) * arm, rgb=c3, level=0.45)
        elif name == "placket":
            d0 = np.where((front > 0) & (tor > 0.5), X.x, 9.0)
            if arg == "concealed":
                seam(line(d0 - 0.018, 0.0012), 0.00025, 0.88)
            elif arg == "double":
                seam(line(d0 - 0.06, 0.0015) * (y > J["chest"][1] - 0.15))
                for i in range(4):
                    for xb in (-0.045, 0.045):
                        bd = np.hypot(X.x - xb, y - (J["chest"][1] + 0.08 - i * 0.09))
                        mix(ss(0.009, 0.007, bd) * front * tor, base * 0.4)
                        h = h + 0.0012 * ss(0.009, 0.004, bd) * front * tor
            else:
                seam(line(d0 - 0.014, 0.0012))
                seam(line(d0 + 0.014, 0.0012), 0.0002, 0.9)
                for i in range(7):
                    bd = np.hypot(X.x, y - (J["neck"][1] - 0.1 - i * 0.085 * X.k))
                    mix(ss(0.0065, 0.005, bd) * front * tor, base * 0.55 + 0.05)
                    h = h + 0.0008 * ss(0.0065, 0.003, bd) * front * tor
        elif name == "buttons":
            nbut = int(arg) if arg else 4
            big = nbut <= 3                       # a coat: 3 large horn buttons, wider spaced
            bcol = hexc(g["button"]) if g.get("button") else np.array([0.85, 0.85, 0.83])
            rb = 0.0105 if big else 0.008
            for i in range(nbut):
                yb = J["chest"][1] + (0.0 if big else 0.02) - i * (0.115 if big else 0.1) * X.k
                bd = np.hypot(X.x + (0.016 if big else 0.012), y - yb)
                mix(ss(rb, rb - 0.002, bd) * front * tor, bcol * (0.9 + 0.2 * ss(rb, 0.0, bd))[:, None])
                h = h + 0.0013 * ss(rb, rb * 0.4, bd) * front * tor
                seam(line(bd - rb, 0.0012) * front * tor, 0.0003, 0.7)
                if big:   # four thread holes
                    for hx, hy in ((-0.0022, -0.0022), (0.0022, -0.0022), (-0.0022, 0.0022), (0.0022, 0.0022)):
                        mix(ss(0.0011, 0.0006, np.hypot(X.x + 0.016 - hx, y - yb - hy)) * front * tor, bcol * 0.4)
        elif name == "pocket":
            ch, sp = J["chest"][1], J["spine"][1]
            boxes = []
            if arg == "chest_lam":
                boxes = [(0.035, 0.12, ch + 0.02, ch + 0.14, "lam")]
            elif arg == "patch_chest":
                boxes = [(0.04, 0.13, ch + 0.0, ch + 0.11, "patch")]
            elif arg == "shirt2":
                boxes = [(0.03, 0.11, ch + 0.02, ch + 0.11, "patch"), (-0.11, -0.03, ch + 0.02, ch + 0.11, "patch")]
            elif arg == "utility4":
                boxes = [(0.03, 0.12, ch + 0.0, ch + 0.11, "flap"), (-0.12, -0.03, ch + 0.0, ch + 0.11, "flap"),
                         (0.03, 0.15, sp - 0.17, sp - 0.04, "flap"), (-0.15, -0.03, sp - 0.17, sp - 0.04, "flap")]
            elif arg in ("hip_flap", "patch_hip"):
                boxes = [(0.05, 0.17, sp - 0.2, sp - 0.07, "flap" if arg == "hip_flap" else "patch"),
                         (-0.17, -0.05, sp - 0.2, sp - 0.07, "flap" if arg == "hip_flap" else "patch")]
            elif arg == "vest":
                boxes = [(0.03, 0.12, ch - 0.02, ch + 0.08, "flap"), (-0.12, -0.03, ch - 0.02, ch + 0.08, "flap"),
                         (0.03, 0.13, sp - 0.13, sp - 0.02, "flap"), (-0.13, -0.03, sp - 0.13, sp - 0.02, "patch")]
            elif arg in ("hip_slash", "welt"):
                for sg in (1, -1):
                    sl_ = (X.x * sg - 0.1) * 0.9 - (y - (sp - 0.12 if arg == "hip_slash" else sp - 0.08))
                    m = line(sl_, 0.0025) * box(X.x * sg, 0.07, 0.14, y, sp - 0.19, sp - 0.03) * front * tor
                    seam(m, 0.0006, 0.6)
            elif arg == "sleeve":
                m = box(X.sa, 0.07, 0.17, X.aa, 40, 130, 0.003) * (arm > 0.5)
                seam(box_edge(X.sa, 0.07, 0.17, X.aa * X.ra * 0.0175, 40 * X.ra * 0.0175, 130 * X.ra * 0.0175, 0.0018) * (arm > 0.5) * (X.side > 0))
                h = h + 0.0006 * m * (X.side > 0)
            elif arg in ("cargo", "cargo_short", "thigh_zip", "kneepad", "slant"):
                kl = X.legcum[1]
                if arg in ("cargo", "cargo_short"):
                    s0, s1 = (kl * 0.45, kl * 0.82) if arg == "cargo" else (kl * 0.3, kl * 0.62)
                    m = box(X.sl, s0, s1, X.la, 58, 122, 0.003) * leg
                    h = h + 0.0012 * m
                    shade(m, 0.96)
                    arc = X.la * 0.0175 * X.rl
                    seam(box_edge(X.sl, s0, s1, arc, 58 * 0.0175 * X.rl, 122 * 0.0175 * X.rl, 0.0018) * leg)
                    seam(line(X.sl - s0 - 0.035, 0.0018) * box(X.la, 58, 122, X.sl, s0, s1 + 0.01, 0.003) * leg, 0.0006, 0.6)   # flap
                elif arg == "thigh_zip":
                    m = line(np.radians(X.la - 40) * X.rl, 0.004) * box(X.sl, kl * 0.25, kl * 0.55, X.la, 20, 60) * leg * (X.side > 0)
                    mix(m * 0.6, base * 0.5)
                    h = h + 0.0004 * m
                elif arg == "kneepad":
                    m = box(X.sl, kl - 0.07, kl + 0.1, X.la, -45, 45, 0.003) * leg
                    shade(m, 0.92)
                    h = h + 0.001 * m
                    arc = X.la * 0.0175 * X.rl
                    seam(box_edge(X.sl, kl - 0.07, kl + 0.1, arc, -45 * 0.0175 * X.rl, 45 * 0.0175 * X.rl, 0.0016) * leg)
                else:
                    for sg in (1, -1):
                        m = line((X.x * sg - 0.11) - 0.45 * (y - (X.J["hip_L"][1] + 0.06)), 0.0018) * box(y, J["hip_L"][1] - 0.02, J["hip_L"][1] + 0.1, X.x * sg, 0.07, 0.17) * front
                        seam(m, 0.0005, 0.65)
            for x0, x1, y0, y1, kind in boxes:
                m = box(X.x, x0, x1, y, y0, y1, 0.0025) * front * (tor + X.tail)
                h = h + 0.0008 * m
                shade(m, 0.97)
                seam(box_edge(X.x, x0, x1, y, y0, y1, 0.0016, 0.003) * front * (tor + X.tail), 0.0003, 0.8)
                if kind == "flap":
                    fl = box(X.x, x0, x1, y, y1 - 0.04, y1, 0.002) * front * (tor + X.tail)
                    h = h + 0.0006 * fl
                    seam(line(y - (y1 - 0.04), 0.0018) * box(X.x, x0, x1, y, y0, y1) * front * (tor + X.tail), 0.0007, 0.62)
                elif kind == "lam":     # laminated: taped edges and a zip across the top
                    seam(line(y - (y1 - 0.012) + 0.12 * (X.x - x0), 0.004) * box(X.x, x0, x1, y, y0, y1 + 0.02) * front * tor, 0.0005, 0.55)
        elif name == "yoke":     # shoulder yoke: a seam across the upper chest and back, the yoke a shade darker
            sh = J["shoulder_L"][1]
            yk = ss(sh - 0.055 * X.k, sh - 0.05 * X.k, y) * tor
            shade(yk, 0.9)
            seam(line(y - (sh - 0.053 * X.k), 0.0016) * tor, 0.0005, 0.72)
        elif name == "elbow_darts":
            for dd in (-0.03, 0.03):
                da = X.sa - X.armcum[1] - dd - 0.015 * np.cos(np.radians(X.aa - 180))
                seam(line(da, 0.0015) * (np.abs(np.abs(X.aa) - 180) < 70) * arm, 0.0004, 0.8)
        elif name == "knee_darts":
            kl = X.legcum[1]
            for dd in (-0.045, 0.05):
                dk = X.sl - kl - dd + 0.02 * (np.clip(X.la, -80, 80) / 80) ** 2
                seam(line(dk, 0.0015) * (np.abs(X.la) < 80) * leg, 0.0004, 0.8)
        elif name == "knee_patch":
            kl = X.legcum[1]
            m = box(X.sl, kl - 0.06, kl + 0.08, X.la, -50, 50, 0.004) * leg
            shade(m, 0.93)
            h = h + 0.0006 * m
        elif name == "seat_panel":
            back = 1 - front
            hp = J["hip_L"][1]
            m = box(np.abs(X.x), 0.0, 0.16, y, hp - 0.1, hp + 0.07, 0.004) * back
            shade(m, 0.95)
            seam(box_edge(np.abs(X.x), -0.01, 0.16, y, hp - 0.1, hp + 0.07, 0.0016) * back)
        elif name in ("quilt_h", "quilt_side"):
            pitch = float(arg) if arg else 0.065
            ph = np.where(arm > 0.5, X.sa / pitch, (y + 0.013) / pitch)
            fr = ph - np.floor(ph)
            m = np.ones(n) if name == "quilt_h" else ss(55, 65, np.abs(X.th)) * ss(125, 115, np.abs(X.th)) * tor
            pillow = np.sin(np.pi * fr) ** 0.5
            h = h + 0.0028 * pillow * m * (pitch / 0.065)
            shade(m * (1 - pillow), 0.78)
            k = k * (1 + 0.06 * (pillow - 0.7) * m)
            if name == "quilt_side":
                seam(line(np.radians(np.abs(X.th) - 55) * X.r, 0.0016) * tor + line(np.radians(np.abs(X.th) - 125) * X.r, 0.0016) * tor)
        elif name == "quilt_diamond":
            pitch = 0.07
            a = (X.u + y) / pitch
            b = (X.u - y) / pitch
            da = np.abs(a - np.round(a)) * pitch
            db = np.abs(b - np.round(b)) * pitch
            dmin = np.minimum(da, db)
            seam(line(dmin, 0.0018), 0.0012, 0.75)
            h = h + 0.0016 * ss(0.0, 0.02, dmin)
        elif name == "reflective":
            parts = arg.split(",") if arg else ["torso"]
            m = np.zeros(n)
            ch, sp = J["chest"][1], J["spine"][1]
            if "torso" in parts:
                m = m + (line(y - (ch + 0.0), 0.035, 0.001) + line(y - (sp - 0.06), 0.035, 0.001)) * tor
            if "vest" in parts:
                m = m + (line(y - (ch - 0.02), 0.04, 0.001) + line(y - (sp + 0.045), 0.04, 0.001)) * tor     # lower band above the belt line (at sp - 0.08 it sat under tool belts as a ragged fringe)
            if "arms" in parts:
                m = m + line(X.sa - X.armcum[1] - 0.07, 0.03, 0.001) * arm + line(X.sa - 0.11, 0.03, 0.001) * arm
            if "ankles" in parts:
                m = m + line(X.sl - X.legcum[2] + 0.12, 0.03, 0.001) * leg
            m = np.clip(m, 0, 1)
            mix(m, c3 * (0.97 + 0.03 * vnoise(X.q, 400, seed)[:, None]))
            h = h + 0.0002 * m
            if "vest" in parts:      # retroreflective tape: catches a little light (a faint emissive), smooth
                glow[:] = np.maximum(glow, m[:, None] * c3[None, :] * 0.07)
                k = np.where(m > 0.5, 1.0, k)
            seam(line(np.abs(m - 0.5) - 0.48, 0.002) * (m > 0.02), 0.0002, 0.85)
        elif name == "chevrons":
            if arg == "back":
                back = (1 - front) * tor
                for i in range(2):
                    v0 = J["chest"][1] + 0.08 - i * 0.07
                    m = line((y - v0) + 0.6 * np.abs(X.x), 0.026, 0.001) * (np.abs(X.x) < 0.15) * back
                    mix(m, c3)
                    h = h + 0.0002 * m
            arm_m = (arm > 0.5) & (X.aa > 20) & (X.aa < 160)
            for i in range(2 if arg in ("sleeve", "back") else 0):
                s0 = 0.1 + i * 0.03
                m = line(X.sa - s0 - 0.25 * np.abs(np.radians(X.aa - 90) * X.ra), 0.012, 0.0008) * arm_m
                mix(m, c3)
        elif name == "two_tone":
            sh = J["shoulder_L"][1]
            m = ss(sh - 0.15, sh - 0.13, y) * tor + ss(0.26, 0.24, X.sa) * arm
            mix(np.clip(1 - m, 0, 1), hexc(g["c2"]))
            seam(line(y - sh + 0.14, 0.0016) * tor + line(X.sa - 0.25, 0.0016) * arm)
        elif name == "armband":     # a cloth band round the left upper arm (the medic's red armband): arg = colour
            m = line(X.sa - 0.13, 0.05, 0.001) * arm * (X.side > 0)
            mix(m, hexc(arg or "a8262e") * (0.92 + 0.08 * vnoise(X.q, 300, seed + 7)[:, None]))
            h = h + 0.0012 * m
            seam(line(np.abs(X.sa - 0.13) - 0.025, 0.0015) * arm * (X.side > 0), 0.0004, 0.75)
        elif name == "sleeve_stripe":
            m = line(np.radians(X.aa - 80) * X.ra, 0.012, 0.001) * arm
            mix(m, c3)
            h = h + 0.0002 * m
        elif name == "led":
            if arg == "zip":
                lit(line(np.where((front > 0) & (tor > 0.5), X.x - zip_x(X, ""), 9.0), 0.0045, 0.0015))
            elif arg == "princess":
                lit(line(np.abs(X.x) - princess_x(X), 0.0035, 0.0015) * tor * (y < J["shoulder_L"][1] - 0.03))
            elif arg == "edges":
                lit(line(X.f - 0.005, 0.003, 0.001))
            elif arg == "bands":       # hi-vis vest: a thin LED line along the top edge of each reflective band
                ch_, sp_ = J["chest"][1], J["spine"][1]
                lit((line(y - (ch_ - 0.02) - 0.024, 0.0028, 0.0008) + line(y - (sp_ + 0.045) - 0.024, 0.0028, 0.0008)) * tor * ss(0.02, 0.03, X.f))
            elif arg == "hem":
                lit(line(X.f - 0.008, 0.004, 0.0015) * (y < J["chest"][1]))
            elif arg == "belt":
                lit(line(y - J["spine"][1] + 0.02, 0.004, 0.0015) * (tor + X.tail))
            elif arg == "collar":
                lit(np.ones(n) * X.collar, level=glvl * 0.6)
            elif arg == "hood":
                lit(line(X.f - 0.005, 0.006, 0.002))
            elif arg == "sleeve":      # a thin seam light down the outer sleeve (shoulder to cuff)
                lit(line(np.radians(X.aa - 85) * X.ra, 0.0022, 0.0008) * arm * (X.sa > 0.04), level=glvl * 0.8)
            elif arg == "collar_edge":
                lit(line(X.f - 0.004, 0.0022, 0.0008) * X.collar, level=glvl * 0.8)
            elif arg == "cords":
                pass
        elif name in ("rib", "rib_cuffs", "rib_hem", "rib_ankle", "hem_band", "hem_band_thin"):
            if name == "rib":
                continue    # knit rib is the fabric
            if name == "rib_cuffs":
                m = ss(0.065, 0.06, X.f) * arm
            elif name == "rib_ankle":
                m = ss(0.06, 0.055, X.f) * leg
            elif name == "hem_band_thin":
                m = ss(0.022, 0.018, X.f)
            else:
                m = ss(0.06, 0.055, X.f) * (y < J["chest"][1]) * tor
            rib = np.sin(X.u * 2 * math.pi / 0.008) if name != "rib_ankle" else np.sin(X.la * X.rl * 0.0175 * 2 * math.pi / 0.008)
            k = k * (1 + 0.06 * rib * m)
            h = h + 0.00035 * rib * m
            if name == "hem_band":
                mix(m, hexc(g["c2"]) if g.get("c2") else base * 0.9)
            seam(line(X.f - 0.058, 0.0016) * (m > 0) * (name != "hem_band_thin"), 0.0004, 0.8)
        elif name == "kangaroo":
            sp = J["spine"][1]
            ww = 0.13 - 0.25 * (y - (sp - 0.12))
            m = box(np.abs(X.x), 0, ww, y, sp - 0.14, sp + 0.03) * front * tor
            h = h + 0.0009 * m
            seam(line(np.abs(X.x) - ww, 0.0018) * box(y, sp - 0.14, sp + 0.03, X.x, -1, 1) * front * tor + line(y - sp - 0.03, 0.0018) * (np.abs(X.x) < ww) * front * tor)
        elif name == "lapels":
            nk = J["neck"][1]
            shade(X.collar, 0.9)                                    # the lapels and collar: a shade darker (they catch less light)
            seam(line(X.f - 0.004, 0.0016) * X.collar, 0.0004, 0.75)  # their edge
            for sg in (1, -1):
                lx = 0.02 + 0.36 * (nk - 0.06 - y)
                ln = line(X.x * sg - lx - 0.045 + 0.2 * ss(nk - 0.12, nk - 0.05, y) * 0.2, 0.0022) * box(y, J["chest"][1] - 0.05, nk, X.x * sg, 0, 0.2) * front
                seam(ln, 0.0008, 0.7)
                notch = line(y - (nk - 0.085), 0.002) * box(X.x * sg, 0.05, 0.1, y, 0, 3) * front
                seam(notch, 0.0006, 0.75)
        elif name == "storm_flap_trench":
            sh = J["shoulder_L"][1]
            m = box(X.x, 0.0, 0.16, y, sh - 0.17, sh, 0.003) * front * tor
            h = h + 0.0009 * m
            seam(line(y - (sh - 0.17), 0.0018) * box(X.x, 0, 0.16, y, -9, 9) * front * tor, 0.0007, 0.7)
            mb = box(np.abs(X.x), 0, 0.2, y, sh - 0.14, sh + 0.05, 0.003) * (1 - front) * tor
            h = h + 0.0009 * mb
            seam(line(y - (sh - 0.14), 0.0018) * (np.abs(X.x) < 0.2) * (1 - front) * tor, 0.0007, 0.7)
        elif name == "belt_line":
            sp = J["spine"][1]
            m = line(y - sp + 0.01, 0.035, 0.0015) * (tor + X.tail)
            h = h + 0.0004 * m
            seam(line(np.abs(y - sp + 0.01) - 0.0175, 0.0015) * (tor + X.tail), 0.0004, 0.75)
        elif name == "hem_cord":
            seam(line(X.f - 0.022, 0.0016) * (y < J["chest"][1]) * tor, 0.0004, 0.8)
        elif name == "drape_ao":   # soft drape: cavity shade and folds where cloth bunches (elbows, armpits, waist, back vent, tail)
            ny_ = np.where(arm > 0.5, 1.0, 0.0)
            inner_el = g2d(X.sa - X.armcum[1], 0.035) * g2d((np.abs(X.aa) - 180) / 70.0, 1.0) * arm
            fold_el = inner_el * (0.5 + 0.5 * np.sin((X.sa - X.armcum[1]) * 2 * math.pi / 0.022 + X.aa * 0.02))
            shade(inner_el * 0.9, 0.8)
            seam(fold_el * 0.6, 0.0006, 0.9)
            pit = g2d(X.sa - 0.02, 0.05) * g2d((np.abs(X.aa) - 180) / 60.0, 1.0) * arm
            pit_t = g2d(np.abs(X.th) - 90, 18.0) * g2d(y - (J["shoulder_L"][1] - 0.13), 0.05) * tor
            shade(np.clip(pit + pit_t, 0, 1), 0.82)
            sleeve_f = arm * (0.5 + 0.5 * np.sin(X.aa * 0.0175 * 3 + X.sa * 40)) * ss(0.25, 0.6, X.sa / np.maximum(X.armcum[2], 1e-3))
            h = h + 0.0006 * sleeve_f
            shade(sleeve_f, 0.95)
            waist = g2d(y - J["spine"][1] + 0.02, 0.035) * tor * (0.6 + 0.4 * np.sin(X.u * 2 * math.pi / 0.06))
            shade(waist, 0.93)
            h = h - 0.0004 * waist
            ph = X.u * 2 * math.pi / 0.09 + 1.7 * vnoise(X.q * np.array([1.0, 0.15, 1.0]), 12, seed + 41)
            drape = X.tail * (0.5 + 0.5 * np.sin(ph)) * ss(0.0, 0.25, -(y - g.get("_hem_y", y.max())))
            h = h + 0.0016 * drape
            shade(X.tail * (1 - (0.5 + 0.5 * np.sin(ph))), 0.9)
            vent_ao = X.tail * (1 - front) * g2d(X.x, 0.012)
            shade(vent_ao, 0.82)
            hollow = g2d(np.abs(X.x) - 0.07, 0.03) * (1 - front) * tor * g2d(y - J["chest"][1] - 0.04, 0.08)
            shade(hollow * 0.6, 0.93)
            _ = ny_
        elif name == "tech_panel":
            ch = J["chest"][1]
            x0, x1, y0, y1 = 0.05, 0.095, ch - 0.01, ch + 0.16
            m = box(X.x, x0, x1, y, y0, y1, 0.0012) * front * tor
            mix(m, hexc(g.get("c2") or "1a1e24") * (0.9 + 0.2 * ss(y0, y1, y))[:, None])
            h = h + 0.0005 * m
            gy = y1 - 0.025
            gd = np.hypot(X.x - (x0 + x1) / 2, y - gy)
            ring = line(gd - 0.011, 0.0028, 0.0008) * front * tor
            lit(ring + line(X.x - (x0 + x1) / 2, 0.0025, 0.0006) * box(y, gy - 0.008, gy + 0.008, X.x, -1, 1) * front * tor, g.get("c3", "38c8c0"), glvl)
            lit(line(X.x - x0 - 0.004, 0.0012, 0.0006) * box(y, y0 + 0.01, y1 - 0.05, X.x, -1, 1) * front * tor, "f2f6ff", glvl * 0.4)
        elif name in ("back_panel", "chest_panel"):
            ch = J["chest"][1]
            if name == "back_panel":
                sel = (1 - front) * tor
                x0, x1, y0, y1 = -0.13, 0.13, ch + 0.02, ch + 0.12
            else:
                sel = front * tor
                x0, x1, y0, y1 = -0.075, 0.075, ch + 0.06, ch + 0.11
            m = box(X.x, x0, x1, y, y0, y1, 0.0015) * sel
            mix(m * 0.9, base * 0.25 if name == "back_panel" else base * 0.5)
            # block lettering: a fixed word (g["text"]), stroke glyphs, read left to right from where the panel is seen
            text = str(g.get("text") or ("HELIX" if name == "back_panel" else "SECURITY")).upper()
            xx = -X.x if name == "back_panel" else X.x          # seen from behind, the character's left is the viewer's left
            rows_ = text.split("|")
            rh = (y1 - y0) / len(rows_)
            letter = np.zeros(n)
            for ri, rt in enumerate(rows_):
                big = ri == 0 and len(rows_) > 1
                letter = np.maximum(letter, text_mask(xx, y, rt, x0 + 0.01, x1 - 0.01, y1 - (ri + 1) * rh, y1 - ri * rh,
                                                      (0.021 if name == "back_panel" else 0.013) * (1.25 if big else 1.0)))
            mix(letter * m * 0.95, c3)
        elif name == "patches":
            pts = [("torso", (0.06, J["chest"][1] + 0.05), (0.07, 0.05)), ("torso", (-0.09, J["spine"][1] - 0.02), (0.06, 0.07)),
                   ("back", (0.05, J["chest"][1] - 0.04), (0.09, 0.07))]
            pcols = [hexc(g.get("c2") or "6a5a44"), hexc("5a5040"), hexc("7a6a50")]
            for i, (where, (px, py), (hx, hy)) in enumerate(pts):
                sel = (front if where == "torso" else 1 - front) * (tor + X.tail)
                xx = X.x if where == "torso" else -X.x
                m = box(xx, px - hx / 2, px + hx / 2, y, py - hy / 2, py + hy / 2, 0.002) * sel
                mix(m * 0.85, pcols[i % 3] * (0.9 + 0.2 * vnoise(X.q, 300, seed + i)[:, None]))
                h = h + 0.0005 * m
                st = box_edge(xx, px - hx / 2, px + hx / 2, y, py - hy / 2, py + hy / 2, 0.0014, 0.003) * sel
                dash = (np.sin((xx + y) * 2 * math.pi / 0.006) > 0)
                seam(st * dash, 0.0002, 0.6)
        elif name == "elbow_patches":
            m = box(X.sa, X.armcum[1] - 0.06, X.armcum[1] + 0.06, np.abs(np.abs(X.aa) - 180), 0, 75, 0.004) * arm
            mix(m * 0.85, hexc(g.get("c2") or "8a6a3a") * (0.9 + 0.2 * vnoise(X.q, 300, seed + 9)[:, None]))
            h = h + 0.0005 * m
            seam(line(np.abs(X.sa - X.armcum[1]) - 0.057, 0.0014) * (np.abs(np.abs(X.aa) - 180) < 75) * arm, 0.0002, 0.6)
        elif name == "sleeve_guards":
            m = box(X.sa, X.armcum[1] + 0.03, X.armcum[2] - 0.02, X.aa, -400, 400, 0.003) * arm
            mix(m, base * 0.7)
        elif name == "plaid":
            cc2, cc3 = hexc(g.get("c2") or "3a2a2a"), hexc(g.get("c3") or "d8d0c4")
            uu = np.where(arm > 0.5, X.aa * 0.0175 * X.ra, X.u)
            vv = np.where(arm > 0.5, X.sa, y)
            a = (np.sin(uu * 2 * math.pi / 0.06) > 0.35).astype(float)
            b = (np.sin(vv * 2 * math.pi / 0.06) > 0.35).astype(float)
            thin = np.maximum(line(((uu / 0.06) % 1 - 0.5) * 0.06, 0.003), line(((vv / 0.06) % 1 - 0.5) * 0.06, 0.003))
            mix(0.45 * a + 0.45 * b, cc2)
            mix(thin * 0.6, cc3)
        elif name == "jeans":
            hp = J["hip_L"][1]
            whisk = sum(line(y - (hp - 0.02 - i * 0.025) - 0.25 * (np.abs(X.x) - 0.09), 0.006, 0.004) for i in range(3)) * front * box(np.abs(X.x), 0.05, 0.14, y, 0, 9)
            mix(np.clip(whisk, 0, 1) * 0.25, base * 1.5 + 0.05)
            kl = X.legcum[1]
            fade = g2d(X.sl - kl * 0.5, 0.18) * leg * (np.abs(X.la) < 60) + g2d(X.sl - kl, 0.06) * leg * (np.abs(X.la) < 50)
            mix(np.clip(fade, 0, 1) * 0.22, base * 1.6 + 0.08)
            back = 1 - front
            for sg in (1, -1):
                m = box(X.x * sg, 0.03, 0.14, y, hp - 0.07, hp + 0.04) * back
                seam(box_edge(X.x * sg, 0.03, 0.14, y, hp - 0.07, hp + 0.04, 0.0016, 0.0) * back, 0.0005, 0.7)
                h = h + 0.0004 * m
            seam(line(y - J["spine"][1] + 0.0, 0.0016) * (tor + leg), 0.0003, 0.8)
        elif name == "topstitch":
            ts = hexc(g.get("stitch", "c09a50" if g.get("fab") == "denim" else "%02x%02x%02x" % tuple((base * 255 * 1.35).clip(0, 255).astype(int))))
            dd = np.min(np.abs(np.stack([np.radians(np.abs(X.th) - 90) * X.r * tor + (1 - tor) * 9,
                                          np.where(leg > 0.5, np.radians(np.abs(X.la) - 90) * X.rl - 0.004, 9),
                                          X.f - 0.006])), 0)
            mix(line(dd, 0.0012, 0.0005) * 0.55, ts)
        elif name == "fly":
            m = line(X.x - 0.018, 0.0014) * box(y, J["hip_L"][1] - 0.05, J["spine"][1] - 0.01, X.x, 0.0, 0.03) * front * (1 - leg * 0.5)
            seam(m, 0.0004, 0.75)
        elif name == "pleat_line":
            seam(line(np.radians(X.la) * X.rl, 0.0015) * leg, 0.0003, 0.85)
        elif name == "molle":
            rows = ((y - J["spine"][1]) / 0.025)
            fr = rows - np.floor(rows)
            # soft-edged rows (a hard 0/1 step aliases at atlas density: the normal map read as crumpled rubber)
            web = ss(0.0, 0.1, fr) * ss(0.5, 0.4, fr) * (np.abs(X.x) < 0.12) * (y < J["chest"][1] + 0.02)
            gap = ss(0.1, 0.06, np.abs(((X.x + 1) / 0.038) % 1 - 0.5))
            m = web * (1 - gap)
            shade(m, 0.88)
            h = h + 0.0006 * m
            seam(line((fr - 0.45) * 0.025, 0.0012) * (np.abs(X.x) < 0.12) * (y < J["chest"][1] + 0.02), 0.0003, 0.8)
        elif name == "webbing":      # edge stitch rows and a raised centre
            seam(line(X.f - 0.0045, 0.0014), 0.00025, 0.7)
            k = k * (1 + 0.05 * ss(0.006, 0.0, X.f))
        elif name == "edge_bind":
            m = ss(0.009, 0.007, X.f)
            shade(m, 0.8)
            seam(line(X.f - 0.009, 0.0012), 0.0003, 0.7)
        elif name == "scav_plates":
            # mismatched plates: patch id from position; each its own colour, a gap groove between them
            ch, sp = J["chest"][1], J["spine"][1]
            px_, py_ = 0.165, 0.16
            cx_ = np.floor((X.x + 0.33) / px_ + 0.15 * np.sin(y * 9))
            cy_ = np.floor((y - sp + 0.02) / py_)
            cid = (cx_ * 3 + cy_ * 5 + 2 * (X.z > X.zc)).astype(int) % 4
            pal = np.stack([base, hexc(g.get("c2", "4a4a3a")), hexc(g.get("c3", "1c2533")), hexc(g.get("c4", "b0a050"))])
            pc = pal[cid]
            col = pc * (0.88 + 0.22 * vnoise(X.q, 18, seed + 3)[:, None])
            gx_ = np.abs(((X.x + 0.33) / px_ + 0.15 * np.sin(y * 9)) % 1 - 0.5) * px_
            gy_ = np.abs(((y - sp + 0.02) / py_) % 1 - 0.5) * py_
            groove = np.maximum(ss(px_ / 2 - 0.006, px_ / 2 - 0.002, gx_), ss(py_ / 2 - 0.006, py_ / 2 - 0.002, gy_))
            seam(groove, 0.002, 0.4)
            rivet = (np.hypot(((X.x + 0.33) / px_ % 1 - 0.5) * px_ - 0.0, 0) < 1) * 0
            _ = rivet
            # a salvaged Helix security plate: real stencil letters, half scraped off (no pseudo-glyphs)
            st_ = text_mask(X.x, y, str(g.get("stencil", "HELIX SEC")), -0.12, 0.04, ch - 0.038, ch - 0.006, 0.017) * front * tor
            scrape = ss(0.48, 0.62, vnoise(X.q, 70, seed + 11)) + ss(0.6, 0.75, vnoise(X.q, 260, seed + 12))
            mix(st_ * np.clip(1 - scrape, 0, 1) * 0.85, hexc("c8ccd0") * (0.9 + 0.1 * vnoise(X.q, 400, seed)[:, None]))
            road = (cid == 3) * (np.sin((X.x + y) * 2 * math.pi / 0.07) > 0.55)
            mix(road * 0.45, hexc("c8bfa8"))
        elif name == "lames":
            ph = (y - X.J["shoulder_L"][1]) / 0.035
            fr = ph - np.floor(ph)
            seam(ss(0.88, 0.97, fr), 0.0012, 0.6)
            h = h + 0.0012 * fr
        elif name == "pad_lines":
            seam(line(X.f - 0.012, 0.0018), 0.0006, 0.75)
            h = h + 0.0015 * ss(0.0, 0.03, X.f)
        elif name == "guard_lines":
            seam(line(X.f - 0.007, 0.0015) + line(X.sa - X.armcum[1] - 0.12, 0.0015), 0.0005, 0.7)
        elif name == "gorget_lines":
            ph = (X.y - X.J["shoulder_L"][1]) / 0.03
            fr = ph - np.floor(ph)
            seam(ss(0.9, 0.98, fr), 0.0008, 0.7)
            h = h + 0.0008 * fr
            two = (np.floor(ph) >= -2) & (np.floor(ph) <= -1)        # the resonance lines: two lames over the collarbones
            lit(line((fr - 0.5) * 0.03, 0.0016, 0.0008) * (np.abs(X.x) < 0.075) * two)
            k = k * (0.92 + 0.12 * fr)
        elif name == "wraps":
            # a hand-wound spiral: the pitch wanders (irregular overlap), each turn lies over the previous one (a step,
            # not an evenly ribbed hose), turns differ a little in tone
            wob = 0.006 * (vnoise(X.q, 14, seed + 5) - 0.5) * 2
            if X.leg is not None and np.any(X.leg > 0.5):
                ph = ((X.sl + wob) / 0.036 + X.la / 360.0)
            else:
                ph = (X.sa + wob) / 0.036 + X.aa / 360.0
            ph = np.where(arm > 0.5, (X.sa + wob) / 0.036 + X.aa / 360.0, ph)
            fr = ph - np.floor(ph)
            band = np.floor(ph)
            k = k * (0.9 + 0.16 * hash01(np.stack([band, band * 0.3, band * 0.7], 1), 1.0, seed))
            seam(ss(0.9, 0.99, fr) * (0.6 + 0.4 * vnoise(X.q, 40, seed + 6)), 0.0011, 0.68)
            h = h + 0.0012 * fr ** 1.5
        elif name in ("dye", "border", "fold_lines", "neck_roll", "tooling", "stitch_edges", "clay", "cape_trim", "tool_loops", "shards", "fray", "wear", "scratches"):
            if name == "dye":       # natural dye unevenness
                k = k * (0.94 + 0.12 * vnoise(X.q, 9, seed + 11))
            elif name == "border":  # one flat tablet-woven band at hem, sleeve ends and neckline: irregular width, uneven dye
                wob = vnoise(X.q, 14, seed + 31) - 0.5
                wd = 0.017 + 0.006 * wob
                m = line(X.f - 0.006 - wd / 2 - 0.003 * (vnoise(X.q, 9, seed + 37) - 0.5), wd, 0.0025) * (1 - X.collar)
                dye_ = 0.82 + 0.26 * vnoise(X.q, 11, seed + 33) + 0.06 * (vnoise(X.q, 70, seed + 35) - 0.5)
                mix(m * 0.92, hexc(g.get("c2") or "9b3b24") * dye_[:, None])
                h = h + 0.00035 * m
            elif name == "fold_lines":
                seam(line(np.sin(X.u * 2 * math.pi / 0.11 + X.y * 9) * 0.01, 0.003, 0.004) * 0.5, 0.0008, 0.9)
            elif name == "neck_roll":   # a plain rolled hem at the neckline: a soft raised roll, a faint shadow under it
                nk = (y > J["chest"][1] + 0.04) * (1 - X.collar)
                roll = ss(0.0, 0.003, X.f) * ss(0.011, 0.006, X.f) * nk
                h = h + 0.0009 * roll
                shade(line(X.f - 0.0115, 0.002, 0.0015) * nk, 0.88)
            elif name == "tooling":
                m = line(np.sin(X.x * 2 * math.pi / 0.05) * 0.012 - (y - J["chest"][1]) % 0.04 + 0.02, 0.002) * tor
                seam(m * 0.6, 0.0003, 0.85)
            elif name == "stitch_edges":
                dash = (np.sin((X.u + X.y) * 2 * math.pi / 0.006) > 0)
                seam(line(X.f - 0.007, 0.0014) * dash, 0.0002, 0.65)
            elif name == "clay":
                m = ss(0.62, 0.72, vnoise(X.q, 18, seed + 13)) * ss(J["chest"][1], J["hip_L"][1], y)
                mix(m * 0.75, hexc("9a7a5a"))
            elif name == "cape_trim":
                mix(line(X.f - 0.008, 0.008, 0.001), hexc(g.get("c3") or "d9a441"))
            elif name == "tool_loops":
                for xl in (0.05, 0.09, -0.07):
                    m = box(X.x, xl, xl + 0.012, y, J["spine"][1] - 0.18, J["spine"][1] - 0.1, 0.0015) * front
                    h = h + 0.0008 * m
                    shade(m, 0.85)
            elif name == "shards":
                cell = ((X.f * 0 + X.u) / 0.018)
                fr = cell - np.floor(cell)
                m = box(fr, 0.25, 0.75, X.f, 0.012, 0.045, 0.002)
                mix(m * 0.9, hexc("2a3a34"))
                lit(m * line(X.f - 0.04, 0.004, 0.001), "b6ff8a", 0.25)
            elif name == "fray":
                fr_ = ss(0.03, 0.0, X.f) * (vnoise(X.q, 700, seed + 4) > 0.45)
                shade(fr_, 1.12)
                h = h - 0.0004 * fr_
            elif name == "wear":
                wl = float(g.get("wear", 0.7))
                ny = X.ny if X.ny is not None else np.zeros(n)
                bleach = ss(0.2, 0.8, ny) * wl * (0.6 + 0.4 * vnoise(X.q, 14, seed + 21))        # sun-bleached shoulders
                lum = col.mean(1, keepdims=True)
                col = col * (1 - 0.35 * bleach[:, None]) + (lum * 1.25 + 0.04) * 0.35 * bleach[:, None]
                edge = ss(0.03, 0.0, X.f) * wl * vnoise(X.q, 300, seed + 22)                    # worn hems / cuffs
                shade(edge, 1.18)
                dust = ss(0.45 * X.H, 0.05, y) * wl * 0.45 + ss(0.6, 0.75, vnoise(X.q, 22, seed + 23)) * wl * 0.3
                mix(dust, hexc("8a7458") * (0.9 + 0.2 * vnoise(X.q, 80, seed)[:, None]))
                stains = ss(0.7, 0.8, vnoise(X.q, 35, seed + 24)) * wl
                shade(stains, 0.8)
            elif name == "scratches":
                sc = line(np.sin(X.q[:, 0] * 300 + X.q[:, 1] * 220) * 0.001, 0.0002, 0.0002) * (hash01(X.q, 60, seed + 5) > 0.6)
                shade(sc, 1.35)
                edge = ss(0.012, 0.0, X.f)
                shade(edge * vnoise(X.q, 200, seed), 1.3)
    h = h * 2.2      # seams / pockets / quilting read in the normal map at game distance
    # hem / edge shade (a thin darker line where the garment ends) and soft light at the top
    k = k * (1 - 0.1 * ss(0.012, 0.0, X.f))
    k = k * (0.95 + 0.05 * np.clip(y / (0.5 * X.H), 0, 1.6) / 1.6)
    col = np.clip(col * k[:, None], 0, 1)
    return col, h, glow


_GL, _GR, _GC, _GB, _GT, _GM = 0.16, 0.84, 0.5, 0.2, 0.8, 0.5
GLYPHS = {  # stroke segments in a cell (x 0..1 across, y 0..1 up)
    "A": [((_GL, _GB), (_GC, _GT)), ((_GC, _GT), (_GR, _GB)), ((0.3, 0.42), (0.7, 0.42))],
    "C": [((_GR, _GT), (_GL, _GT)), ((_GL, _GT), (_GL, _GB)), ((_GL, _GB), (_GR, _GB))],
    "E": [((_GL, _GB), (_GL, _GT)), ((_GL, _GT), (_GR, _GT)), ((_GL, _GM), (0.72, _GM)), ((_GL, _GB), (_GR, _GB))],
    "H": [((_GL, _GB), (_GL, _GT)), ((_GR, _GB), (_GR, _GT)), ((_GL, _GM), (_GR, _GM))],
    "I": [((_GC, _GB), (_GC, _GT))],
    "K": [((_GL, _GB), (_GL, _GT)), ((_GL, _GM), (_GR, _GT)), ((0.36, 0.6), (_GR, _GB))],
    "L": [((_GL, _GB), (_GL, _GT)), ((_GL, _GB), (_GR, _GB))],
    "M": [((_GL, _GB), (_GL, _GT)), ((_GL, _GT), (_GC, 0.45)), ((_GC, 0.45), (_GR, _GT)), ((_GR, _GT), (_GR, _GB))],
    "N": [((_GL, _GB), (_GL, _GT)), ((_GL, _GT), (_GR, _GB)), ((_GR, _GB), (_GR, _GT))],
    "O": [((_GL, _GB), (_GL, _GT)), ((_GL, _GT), (_GR, _GT)), ((_GR, _GT), (_GR, _GB)), ((_GR, _GB), (_GL, _GB))],
    "P": [((_GL, _GB), (_GL, _GT)), ((_GL, _GT), (_GR, _GT)), ((_GR, _GT), (_GR, _GM)), ((_GR, _GM), (_GL, _GM))],
    "R": [((_GL, _GB), (_GL, _GT)), ((_GL, _GT), (_GR, _GT)), ((_GR, _GT), (_GR, _GM)), ((_GR, _GM), (_GL, _GM)), ((0.42, _GM), (_GR, _GB))],
    "S": [((_GR, _GT), (_GL, _GT)), ((_GL, _GT), (_GL, _GM)), ((_GL, _GM), (_GR, _GM)), ((_GR, _GM), (_GR, _GB)), ((_GR, _GB), (_GL, _GB))],
    "T": [((_GL, _GT), (_GR, _GT)), ((_GC, _GT), (_GC, _GB))],
    "U": [((_GL, _GT), (_GL, _GB)), ((_GL, _GB), (_GR, _GB)), ((_GR, _GB), (_GR, _GT))],
    "X": [((_GL, _GB), (_GR, _GT)), ((_GL, _GT), (_GR, _GB))],
    "Y": [((_GL, _GT), (_GC, _GM)), ((_GR, _GT), (_GC, _GM)), ((_GC, _GM), (_GC, _GB))],
    "7": [((_GL, _GT), (_GR, _GT)), ((_GR, _GT), (0.4, _GB))],
    "-": [((0.25, _GM), (0.75, _GM))],
}


def text_mask(xx, y, text, x0, x1, y0, y1, cw_max, stroke=None):
    """Anti-aliased mask of `text` in block stroke letters, centred in the box x0..x1, y0..y1 (metres)."""
    nch = max(len(text), 1)
    cw = min(cw_max, (x1 - x0) / nch)
    ch_h = (y1 - y0)
    xs = (x0 + x1) / 2 - cw * nch / 2
    sw = stroke if stroke is not None else max(0.0024, min(0.0042, cw * 0.18))
    out = np.zeros(len(xx))
    ci = np.floor((xx - xs) / cw).astype(int)
    lx = (xx - xs) / cw - ci
    ly = (y - y0) / ch_h
    inside = (ci >= 0) & (ci < nch) & (ly > -0.1) & (ly < 1.1)
    for i, chr_ in enumerate(text):
        segs = GLYPHS.get(chr_)
        if not segs:
            continue
        sel = inside & (ci == i)
        if not sel.any():
            continue
        px, py = lx[sel] * cw, ly[sel] * ch_h
        d = np.full(len(px), 9.0)
        for (ax, ay), (bx, by) in segs:
            ax, ay, bx, by = ax * cw, ay * ch_h, bx * cw, by * ch_h
            vx, vy = bx - ax, by - ay
            t = np.clip(((px - ax) * vx + (py - ay) * vy) / max(vx * vx + vy * vy, 1e-12), 0, 1)
            d = np.minimum(d, np.hypot(px - ax - t * vx, py - ay - t * vy))
        out[sel] = 1 - ss(sw * 0.5, sw * 0.5 + 0.0009, d)
    return out


def g2d(d, s):
    return np.exp(-(d / s) ** 2)


# ----------------------------------------------------------------------------------------------------------------
# small cell designs (shoes, soles, hats): painted into the atlas cells (a, b in 0..1 across the cell)
# ----------------------------------------------------------------------------------------------------------------
def shoe_cell(g, a, b, seed):
    """Side view of the shoe upper: a = heel (0) .. toe (1), b = sole (0) .. collar (1)."""
    base = hexc(g["color"])
    design = g.get("design", "boot")
    p3 = np.stack([a, b, np.zeros_like(a)], -1).reshape(-1, 3)
    k = (0.9 + 0.12 * vnoise(p3, 9, seed).reshape(a.shape))
    col = base[None, None, :] * k[..., None]
    if design in ("tech_boot", "safety", "lace_boot", "sneaker", "lace_shoe"):
        lace = (a > 0.45) & (a < 0.78) & (b > 0.55)
        st = (np.sin(a * 2 * math.pi * 14) > 0.4) & lace
        col[st] = col[st] * 0.55
    if design in ("tech_boot", "sneaker"):
        c2 = hexc(g.get("c2")) if g.get("c2") else (base * 1.35 + 0.02 if design == "tech_boot" else hexc("d8d4cc"))
        panel = ((a - 0.3) ** 2 / 0.06 + (b - 0.45) ** 2 / 0.08) < 1
        col[panel] = c2 * 0.9 * k[panel][:, None]
        heel = a < 0.12
        col[heel] = col[heel] * 0.8
    if design == "safety":
        toe = a > 0.78
        col[toe] = col[toe] * 0.75
    if design == "chelsea":
        gus = (np.abs(a - 0.35) < 0.08) & (b > 0.5)
        col[gus] = col[gus] * 0.6
    if design == "wrapped":
        band = (np.sin((b * 3 + a * 0.6) * 2 * math.pi * 3) > 0.6)
        col[band] = col[band] * 0.75
    if design == "sandal":
        col = col * 1.0
    return np.clip(col, 0, 1)


def sole_cell(g, a, b, seed):
    sc = hexc(g.get("sole") or g["color"]) if g.get("sole") else hexc(g["color"]) * 0.6
    p3 = np.stack([a, b, np.zeros_like(a)], -1).reshape(-1, 3)
    k = 0.92 + 0.1 * vnoise(p3, 12, seed).reshape(a.shape)
    col = sc[None, None, :] * k[..., None]
    tread = b < 0.3                      # outsole a shade darker, a groove line above it
    col[tread] = col[tread] * 0.6
    groove = np.abs(b - 0.32) < 0.03
    col[groove] = col[groove] * 0.5
    return np.clip(col, 0, 1)
