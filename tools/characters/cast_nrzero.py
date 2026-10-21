"""AFTERZERO's cast (CAST=nrzero): every principal, mission extra and crowd template of the costume bible, built with
the costume pipeline (`wear=[...]`, garments.py / costume.py) and the gadget kit (`gear=[...]`, gadgets.py).

    cd tools/characters
    CAST=nrzero MH_DATA=.../makehuman/data ../../../tools/venv/bin/python build_humans.py OUT_DIR
    ./compress_cast.sh OUT_DIR/cast.glb ../../assets/models/staging/cast.glb

Template ids are the spec ids (kai, mira, c49_m1, anc_f2 ...). Each entry carries `era` (2049 / 2026 / 2196 /
ancient / unwritten: garments and gadgets are checked against it), `group` and `role` (written to cast_index.json).

Bodies: `macro` (MakeHuman gender / muscle / weight / ancestry mix), `years` (age in years -> MakeHuman age) and
`metres` (standing height; the MakeHuman height parameter is solved for it once and cached in
cast_nrzero_heights.json). Faces come from softened detail modifiers (see the end of the file), so every face is
distinct and pleasant without extremes. Painted face extras: stubble, beard, freckles, scars (build_humans.paint).
Budgets: Kai 16 000 triangles (2048 atlas); named NPCs 11 000 (one glow group mesh); crowds and children 9 000
(gadget glow baked into the atlas emissive, no extra draw call) plus a 6 000-triangle low LOD. The build exports full
density; compress_cast.sh (simplify_cast.mjs, meshoptimizer) lands every character on its budget.
"""
import json
import os

from cast_humans import sym

# ---------------------------------------------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------------------------------------------


def anc(caucasian=0.0, african=0.0, asian=0.0):
    t = caucasian + african + asian
    return dict(caucasian=caucasian / t, african=african / t, asian=asian / t)


def M(muscle=0.55, weight=0.45, **a):     # adult man
    return dict(gender=1.0, muscle=muscle, weight=weight, **anc(**a))


def F(muscle=0.5, weight=0.42, **a):      # adult woman
    return dict(gender=0.0, muscle=muscle, weight=weight, **anc(**a))


def KID(boy, muscle=0.5, weight=0.42, **a):
    return dict(gender=0.85 if boy else 0.15, muscle=muscle, weight=weight, **anc(**a))


def mh_age(years):
    """Years -> MakeHuman age (0 = 1 y, 0.1875 = 11 y, 0.5 = 25 y, 1 = 90 y)."""
    if years <= 11:
        return max(0.0, (years - 1) / 10 * 0.1875)
    if years <= 25:
        return 0.1875 + (years - 11) / 14 * 0.3125
    return min(1.0, 0.5 + (years - 25) / 65 * 0.5)


EU, AF, EA = dict(caucasian=1.0), dict(african=1.0), dict(asian=1.0)
SA = dict(caucasian=0.55, asian=0.25, african=0.2)          # South Asian
ME = dict(caucasian=0.8, african=0.12, asian=0.08)          # Middle Eastern / Mediterranean
LAT = dict(caucasian=0.6, african=0.15, asian=0.25)         # Latin American
ANC = dict(african=0.65, caucasian=0.35)                    # the settlement (warm brown skins, varied features)

# era palettes (hex) used below
SEC = dict(shell="1c2533", carrier="111820", boots="0f0f10", gloves="101010")

CAST = [
    # =============================================== PRINCIPALS ===============================================
    # ---- Kai Varen, the player: sealed techshell, hood down, slim harness carrying every gadget ----
    dict(id="kai", group="Principals", era="2049", role="Player: Kai Varen, temporal systems engineer", years=32, metres=1.83,
         macro=M(muscle=0.6, weight=0.45, caucasian=0.45, african=0.15, asian=0.4),
         details={"head/head-square": 0.4, "chin/chin-prominent-decr|incr": 0.2, "nose/nose-scale-vert-decr|incr": 0.1, "eyebrows/eyebrows-trans-down|up": -0.2,
                  **sym(cheek_bones=0.35)},
         skin="b98463", lip="9a5a4c", eyes="3a2a1c", hair="waves", hairColor="141110", stubble=0.85, browThick=0.8,
         glow="5fe6ff", glowLevel=0.6, metalColor="8a9098", tris=16000,
         # a desaturated teal-grey shell over the charcoal base, with a thin cyan seam light along the zip, collar and
         # sleeves: the player reads apart from the black 2049 crowd on a rainy street
         wear=[("mock_neck", "2a2c2f"), ("techshell", "34454f", dict(det_add=["led:zip", "led:collar_edge", "led:sleeve"])), ("hood_down", None), ("chest_harness", "23272c"),
               ("tech_trousers", "2e3237"), ("tech_boots", "1b1611", dict(sole="6a6e74")), ("gloves", "1d1a17", dict(side="R", fingerless=True))],
         gear=["chronolith_band", ("ar_monocle", dict(idle=0.12)), "earpiece", "belt_scanner", "shoulder_lamp", "echo_emitter", "harness_pouches", "chest_slate_pocket"]),
    # ---- Mira Varen: armoured softshell with gorget and shoulder caps; carries nothing ----
    dict(id="mira", group="Principals", era="2049", role="Mira Varen, the impossible sister", years=29, metres=1.69,
         macro=F(muscle=0.52, weight=0.4, caucasian=0.9, asian=0.1),
         details={"head/head-oval": 0.5, "eyes/l-eye-scale-decr|incr": 0.25, "eyes/r-eye-scale-decr|incr": 0.25, "mouth/mouth-lowerlip-volume-decr|incr": 0.3,
                  "mouth/mouth-upperlip-volume-decr|incr": 0.2, "eyebrows/eyebrows-angle-down|up": 0.2, **sym(cheek_bones=0.4)},
         skin="d9a585", lip="b8706a", eyes="6a7f8e", hair="waves", hairLen="mid", hairColor="1e1712", blush=0.3,
         glow="9a7bff", glowLevel=0.6,
         wear=[("mock_neck", "1c1a22"), ("armored_jacket", "1c1a22"), ("tech_trousers", "1f2227", dict(det_add=["knee_patch"])), ("ankle_boots", "15120f")],
         gear=["gorget_resonance", ("chronolith_cuff_thin", dict(idle=0.0))]),
    # ---- The Witness: Kai 25 years on; faded longshell, collar up, patched harness, cracked red-orange kit ----
    dict(id="witness", group="Principals", era="2049", role="The Witness, older Kai", years=58, metres=1.81,
         macro=M(muscle=0.5, weight=0.38, caucasian=0.45, african=0.15, asian=0.4),
         details={"head/head-square": 0.4, "chin/chin-prominent-decr|incr": 0.2, "nose/nose-scale-vert-decr|incr": 0.1, **sym(cheek_bones=0.4, cheek_volume=-0.4),
                  "eyebrows/eyebrows-trans-down|up": -0.2, "head/head-age-decr|incr": 0.3},
         skin="a77a5d", lip="8a5a4c", eyes="3a2a1c", hair="swept", hairColor="a8a49c", stubble=1.0, beard=0.85, beardColor="9a968e", browThick=0.75,
         scars=[((0.022, 0.045), (0.05, 0.002))],
         glow="ff6a4a", glowLevel=0.5, wearLevel=0.6,
         wear=[("mock_neck", "1c1c1e"), ("longshell", "2a2724", dict(det_add=["wear"], c2="4a3a2c")),   # his patched harness is under the sealed coat
               ("tech_trousers", "202020"), ("tech_boots", "141210", dict(sole="4a4844")), ("gloves", "111111")],
         gear=[("chronolith_band", dict(cracked=True, glow="ff6a4a")), ("ar_monocle", dict(cracked=True, idle=0.06)), ("echo_emitter", dict(scorched=True, glow="ff6a4a")),
               "recorder_spool"]),
    # ---- Sera Voss: patched field jacket, scavenged plate, left pauldron, rifle sling (2196) ----
    dict(id="sera", group="Principals", era="2196", role="Sera Voss, resistance leader", years=34, metres=1.72,
         macro=F(muscle=0.68, weight=0.44, caucasian=0.7, african=0.3),
         details={"head/head-oval": 0.3, "chin/chin-prominent-decr|incr": 0.25, "eyebrows/eyebrows-angle-down|up": -0.2, **sym(cheek_bones=0.4)},
         skin="8a5b3c", lip="7a4a3c", eyes="5d6e58", hair="pony", hairColor="2a1f19", blush=0.12, scars=[((0.035, 0.06), (0.045, -0.055))],
         glow="b6ff8a", wearLevel=0.85,
         wear=[("field_jacket_worn", "4a3a28", dict(c2="6a5a44")), ("scav_plate", "3a3a2c", dict(c3="2e3540", c4="5e5c40")), ("pauldron", "4a4a3a", dict(side="L")),
               ("sling_strap", "2a2620", dict(side="R")), ("cargo_trousers", "3a3a30", dict(det_add=["wear"])), ("knee_pads", "1e1e1c"),
               ("forearm_wraps", "8a7a60"), ("combat_boots", "2a2018")],
         gear=[("respirator", dict(worn="neck")), ("goggles", dict(worn="neck")), "wrist_scanner_scav", ("radio_chest_rig", dict(rig=False)),
               ("harness_pouches", dict(color="4a4232"))]),
    # ---- Dr. Elias Rook: the Helix director's white technical lab coat, a long clean column ----
    dict(id="rook", group="Principals", era="2049", role="Dr. Elias Rook, Director of Helix Temporal Research", years=62, metres=1.78,
         macro=M(muscle=0.42, weight=0.38, **EU),
         details={"head/head-oval": 0.4, "head/head-scale-vert-decr|incr": 0.25, "forehead/forehead-scale-vert-decr|incr": 0.3, "nose/nose-scale-vert-decr|incr": 0.3,
                  "nose/nose-point-width-decr|incr": -0.2, "mouth/mouth-upperlip-volume-decr|incr": -0.3, **sym(eye_bag=0.2)},
         skin="d3a487", lip="a8706a", eyes="7a8c9a", hair="swept", hairColor="d6d0c6", glow="f2f6ff", glowLevel=0.3,
         wear=[("mock_neck", "2f3542"), ("labcoat49", "e9ecec"), ("chinos", "2a2e36"), ("derby_boots", "14151a")],
         gear=[("coat_tech_panel", dict(glow="38c8c0")), ("ar_glasses", dict(rimless=True, glow="f2f6ff", idle=0.3)), ("id_badge", dict(mount="clip", edge="gold")),
               ("earpiece", dict(color="e6e8ea", small=True)), ("wrist_slate", dict(color="e6e8ea"))]),
    # ---- Niko, keeper of the settlement: flax tunic, madder sash, tally cords ----
    dict(id="niko", group="Principals", era="ancient", role="Niko, keeper of the settlement", years=19, metres=1.66,
         macro=M(muscle=0.48, weight=0.38, african=1.0),
         details={"head/head-round": 0.3, "nose/nose-scale-horiz-decr|incr": 0.3, "mouth/mouth-lowerlip-volume-decr|incr": 0.2,
                  "eyes/l-eye-scale-decr|incr": 0.2, "eyes/r-eye-scale-decr|incr": 0.2},
         skin="8c5a3a", lip="6a3a30", eyes="2a1a10", hair="curls", hairColor="141010",
         wear=[("tunic", "cdb48a", dict(c2="9b3b24")), ("leather_belt", "5a3e28", dict(width=0.02)), ("sash", "9b3b24"), ("leg_wraps", "7a6248"),
               ("sandals", "5a3e28")],
         gear=[("period:bronze_bracelets", dict(color="c9a050")), "period:tally_cords", "period:leather_satchel", "period:staff"]),
    # ---- Tala, water keeper: teal-indigo calf tunic, saffron sash, linen mantle ----
    dict(id="tala", group="Principals", era="ancient", role="Tala, water keeper", years=41, metres=1.64,
         macro=F(muscle=0.6, weight=0.5, african=1.0),
         details={"nose/nose-scale-horiz-decr|incr": 0.3, "mouth/mouth-laugh-lines-in|out": 0.3, **sym(cheek_bones=0.45)},
         skin="7d4f33", lip="5a3028", eyes="2a1a10", hair="bun", hairColor="1a1614",
         wear=[("tunic", "3f6a6a", dict(sleeve="elbow", tail=dict(end=0.17, flare=0.2, slits=0.14), c2="d0a24a")), ("mantle_wrap", "d9c9a0"),
               ("sash", "d0a24a"), ("leg_wraps", "5a4632"), ("sandals", "4a3220")],
         gear=[("period:bronze_armlet", dict(color="d9b25c")), ("period:bronze_bracelets", dict(sides="L", count=3, color="d9b25c")), "period:water_gourd",
               "period:bead_necklace"]),
    # ---- Iven Marr, Helix maintenance: knit, orange smart vest, tool belt, cap headlamp ----
    dict(id="iven", group="Principals", era="2049", role="Iven Marr, Helix maintenance technician", years=45, metres=1.76,
         macro=M(muscle=0.55, weight=0.58, **EU),
         details={"head/head-round": 0.3, "nose/nose-scale-vert-decr|incr": -0.25, "nose/nose-point-down|up": 0.25, "head/head-scale-horiz-decr|incr": 0.2},
         skin="e0b394", lip="b07a6a", eyes="6a8a62", hair="crop", hairColor="8a4a2a", stubble=0.65, freckles=0.6, blush=0.24,
         glow="ff9a3a",
         wear=[("knit_sweater", "37404a"), ("smart_vest", "d8741e", dict(c3="d8dce0", text="HELIX|MAINTENANCE")), ("work_trousers", "2c333b"), ("safety_boots", "2a2018"),
               ("gloves", "2a2f36", dict(fingerless=True)), ("tech_cap", "2a3440")],
         gear=["tool_belt", "diagnostic_probe", "forearm_tablet", "cap_headlamp", "headset_neck", ("keycard_reel", dict(side="R"))]),
    # ---- Jun Park, transit operator: navy shell, yellow smart vest, peaked cap ----
    dict(id="jun", group="Principals", era="2049", role="Jun Park, Rain City transit operator", years=42, metres=1.74,
         macro=M(muscle=0.5, weight=0.5, **EA),
         details={"head/head-round": 0.35, "eyes/l-eye-epicanthus-in|out": 0.2, "eyes/r-eye-epicanthus-in|out": 0.2, "mouth/mouth-angles-down|up": -0.1},
         skin="d8b08e", lip="a8706a", eyes="2a1c14", hair="short", hairColor="141010", glow="ffd34a",
         wear=[("duty_shell", "1d2a44", dict(c3="d4c21a", det_del=["chevrons:sleeve"])), ("smart_vest", "d9cf3a", dict(text="TRANSIT")),
               ("chinos", "1d2a44", dict(det_add=["reflective:ankles"])), ("service_boots", "111111"), ("transit_cap", "1d2a44", dict(c2="d4c21a"))],
         gear=["transit_tablet", "signal_wand", "earpiece", ("shoulder_radio", dict(side="L", glow="ffd34a")), ("id_badge", dict(header="d4c21a", lanyard="d4c21a"))]),
    # ---- Officer Hale, Helix security: duty shell, plate carrier, flashlight, radio ----
    dict(id="hale", group="Principals", era="2049", role="Officer Hale, Helix security (night shift)", years=48, metres=1.85,
         macro=M(muscle=0.78, weight=0.68, **EU),
         details={"chin/chin-width-decr|incr": 0.5, "head/head-square": 0.6, "nose/nose-scale-horiz-decr|incr": 0.25, "nose/nose-hump-decr|incr": 0.3,
                  "neck/neck-scale-horiz-decr|incr": 0.4, "eyebrows/eyebrows-trans-down|up": -0.25},
         skin="c49a7c", lip="9a6a5a", eyes="6a7a86", hair="fade", hairColor="6a5a48", stubble=0.5, browThick=0.85, glow="ff4d5e",
         wear=[("duty_shell", SEC["shell"]), ("plate_carrier", SEC["carrier"]), ("duty_belt", "111214"), ("tech_trousers", SEC["shell"], dict(tuck=True)),
               ("tactical_boots", SEC["boots"]), ("gloves", SEC["gloves"])],
         gear=[("shoulder_radio", dict(glow="ff4d5e")), "stun_baton", "body_cam", "vest_flashlight", ("earpiece", dict(side="R"))]),
    # ---- Officer Brandt: the same kit cut leaner, forearm guards, cap pushed back, AR half-visor ----
    dict(id="brandt", group="Principals", era="2049", role="Officer Brandt, Helix security (Rook's problem-solver)", years=37, metres=1.80,
         macro=M(muscle=0.68, weight=0.42, **EU),
         details={"head/head-oval": 0.4, "head/head-scale-vert-decr|incr": 0.2, "mouth/mouth-upperlip-volume-decr|incr": -0.3, "mouth/mouth-lowerlip-volume-decr|incr": -0.2,
                  "chin/chin-prominent-decr|incr": 0.25, **sym(cheek_bones=0.35)},
         skin="e2b896", lip="a8706a", eyes="5a7a9a", hair="swept", hairColor="b08850", stubble=0.4, glow="ff4d5e",
         wear=[("duty_shell", SEC["shell"]), ("plate_carrier", SEC["carrier"], dict(pouches=False)), ("duty_belt", "111214"), ("forearm_guards", "22262c"),
               ("tech_trousers", SEC["shell"], dict(tuck=True)), ("tactical_boots", SEC["boots"]), ("gloves", SEC["gloves"])],
         gear=["ar_half_visor", "stun_baton", "restraint_cuffs", ("shoulder_radio", dict(glow="ff4d5e")), ("earpiece", dict(side="R"))]),
    # ---- The Child in the Station: yellow hooded smart raincoat, locator band ----
    dict(id="child", group="Principals", era="2049", role="The Child in the Station (Rain City)", years=8, metres=1.27,
         macro=KID(False, weight=0.4, **EU), details={"head/head-round": 0.3, "eyes/l-eye-scale-decr|incr": 0.2, "eyes/r-eye-scale-decr|incr": 0.2},
         skin="f0c8a8", lip="c27a72", eyes="5a3a22", hair="bob", hairColor="5a3a24", freckles=0.7, glow="ffe6b0", glowLevel=0.4, tris=9000,
         wear=[("techshell", "e8b923", dict(det=["zip:placket", "reflective:arms", "hem_cord"], hem=-0.1)),
               ("hood_down", None), ("cargo_joggers", "6a6e74"), ("rain_boots", "b0262c")],
         gear=[("kid_locator_band", dict(glow="ffd34a"))]),
    # ---- Dr. Anja Vale (2196): cut-down lab coat as a hooded field coat, padded instrument vest ----
    dict(id="anja", group="Principals", era="2196", role="Dr. Anja Vale, 2196 temporal scientist", years=46, metres=1.70,
         macro=F(muscle=0.45, weight=0.36, **SA),
         details={"head/head-oval": 0.35, "mouth/mouth-laugh-lines-in|out": 0.25, "nose/nose-scale-vert-decr|incr": 0.15, **sym(cheek_bones=0.3)},
         skin="a06a46", lip="7a4a3c", eyes="2a1a10", hair="braid", hairColor="231a14", glow="b6ff8a", wearLevel=0.6,
         wear=[("knit_sweater", "4a4a40"), ("field_jacket_worn", "c8c4b8", dict(c2="8a6a3a")), ("padded_vest", "4a4a38"), ("canvas_trousers", "6a5a44"),
               ("shin_wraps", "8a7a60"), ("combat_boots", "2a2018")],
         gear=["magnifier_goggles", ("handheld_scanner", dict(mount="vest")), ("respirator", dict(worn="neck")), "sample_rig"]),
    # ---- Mara Quill (2196): grey felt cloak, quilted jerkin, shard bandolier ----
    dict(id="mara", group="Principals", era="2196", role="Mara Quill, 2196 archivist", years=61, metres=1.62,
         macro=F(muscle=0.38, weight=0.38, **EU),
         details={"head/head-round": 0.25, "mouth/mouth-laugh-lines-in|out": 0.3, **sym(eye_bag=0.2)},
         skin="e0b8a0", lip="b07a70", eyes="6a7a7a", hair="crop", hairColor="b8b2a8", glow="b6ff8a", glowLevel=0.3, wearLevel=0.7,
         wear=[("knit_sweater", "48443c", dict(det_add=["wear", "elbow_patches"], c2="5a5040")), ("jerkin", "2a2a28"), ("cloak_hooded", "6a6a64"), ("hood_down", None),
               ("canvas_trousers", "8a7458"), ("wrapped_boots", "3a2a1c")],
         gear=[("glasses", dict(shape="rect", wire=0.0019, taped=True, mismatch="6a5a44", clip=True, color="2e2a26")), "shard_bandolier", "crank_lamp", "archive_reader"]),
    # ---- Orren, guide of the Unwritten Second: eraless ash wrap, no seams, no tech ----
    dict(id="orren", group="Principals", era="unwritten", role="Orren, guide of the Unwritten Second", years=50, metres=1.78,
         macro=M(muscle=0.5, weight=0.42, caucasian=0.6, african=0.2, asian=0.2),
         details={"head/head-oval": 0.4, **sym(cheek_bones=0.3)},
         skin="b88560", lip="8a5a4c", eyes="4a3a2a", hair="crop", hairColor="2a2420", glow="e8eef8", glowLevel=0.2,
         # a closed, crossed ash-grey wrap (two value steps under the Helix white), darker soft trousers: no lab-coat column
         wear=[("tunic", "9a968c", dict(sleeve="long", det=[], tail=None)),
               ("cloak_hooded", "66665f", dict(det=["stitch_edges", "wrap_cross"], open_full=False, open_front=0.03, sleeve="cape",
                                               tail=dict(end=0.13, flare=0.12, slits=0.24), hood_T=0.06, hood_D=0.2)), ("hood_down", None),
               ("soft_trousers", "3f3f3b"), ("wrapped_boots", "4a4a46", dict(det=[]))],
         gear=[("chronolith_cuff_thin", dict(color="b8bcc4", glow="e8eef8", idle=0.25))]),

    # ============================================ MISSION EXTRAS ==============================================
    dict(id="caretaker", group="Mission extras", era="2049", role="Ingrid Holt, caretaker of Reservoir 7 (mission 5)", years=57, metres=1.66,
         macro=F(muscle=0.55, weight=0.55, **EU), details={"head/head-square": 0.25, **sym(eye_bag=0.2)},
         skin="cf9f82", lip="a8706a", eyes="5a6a6a", hair="pixie", hairColor="7a6a5a", glow="7fd8d0", glowLevel=0.35,
         wear=[("knit_sweater", "3b4441"), ("smart_parka", "3d4842", dict(fab="softshell", det=["taped_seams", "zip:placket", "pocket:hip_flap"])),
               ("hood_down", None), ("cargo_trousers", "272b30"), ("tech_boots", "1b1d20")],
         gear=[("glasses", dict(shape="rect", wire=0.0009, color="8a9098")), ("earpiece", dict(glow="7fd8d0")), ("rugged_slate", dict(glow="7fd8d0")), ("keycard_reel", dict(header="7fd8d0"))]),
    dict(id="oskar", group="Mission extras", era="2049", role="Oskar Hensel, clockmaker of the Old Quarter (mission 6)", years=78, metres=1.70,
         macro=M(muscle=0.4, weight=0.4, **EU), details={"head/head-oval": 0.3, "nose/nose-scale-vert-decr|incr": 0.2, **sym(eye_bag=0.3)},
         skin="e6bea4", lip="b07a70", eyes="5a6a7a", hair="swept", hairColor="e4e0da", stubble=1.0, beard=0.9, beardColor="e8e4de", glow="ffc070",
         glowLevel=0.35,
         wear=[("mock_neck", "2a2e33"), ("utility_vest", "3a3e44", dict(fab="softshell", c2="2a2d31")), ("tech_trousers", "2e3338"), ("leather_work_shoes", "1c1a18")],
         gear=[("ar_glasses", dict(glow="ffc070", idle=0.35, color="2a2c30", loupe=True)), "micro_drivers", ("fitness_band", dict(idle=0.15))]),
    dict(id="oskar26", group="Mission extras", era="2026", role="Oskar Hensel at 55, clockmaker (mission 6, 2026 state)", years=55, metres=1.71,
         macro=M(muscle=0.5, weight=0.5, **EU), details={"head/head-oval": 0.3, "nose/nose-scale-vert-decr|incr": 0.2},
         skin="e2b496", lip="b07a6a", eyes="5a6a7a", hair="swept", hairColor="6a5a4a", stubble=0.6,
         wear=[("denim_shirt", "5a6e8a"), ("knit_sweater", "bcb19c"), ("utility_vest", "5a4a38", dict(fab="canvas")), ("jeans", "2e3a4c"),
               ("leather_work_shoes", "3a2a1c")],
         gear=[("glasses", dict(color="3a3430")), "loupe_cord", ("smartphone", dict(mount="pocket")), "smartwatch"]),
    dict(id="lotte", group="Mission extras", era="2026", role="Lotte Hensel, the clockmaker's daughter, age 8 (mission 6)", years=8, metres=1.27,
         macro=KID(False, **EU), details={"head/head-round": 0.3, "eyes/l-eye-scale-decr|incr": 0.2, "eyes/r-eye-scale-decr|incr": 0.2},
         skin="f2cdb2", lip="c27a72", eyes="5a7a9a", hair="pony", hairColor="9a7a4a", freckles=0.6, tris=9000,
         wear=[("tshirt", "e6e2da"), ("hoodie", "b03a44"), ("jeans", "3a5078"), ("sneakers", "e6e2da")],
         gear=[("smartwatch", dict(color="7a4a9a", case="e6e2da")), ("school_backpack", dict(color="3a5a9a"))]),
    dict(id="kid_kai", group="Mission extras", era="2026", role="Kai at 7 (residue echo, mission 6)", years=7, metres=1.22,
         macro=KID(True, caucasian=0.45, african=0.15, asian=0.4), details={"head/head-square": 0.2},
         skin="b98463", lip="a8706a", eyes="3a2a1c", hair="waves", hairColor="141110", tris=9000,
         wear=[("tshirt", "8a8d92"), ("techshell", "2a4a6a", dict(det=["zip", "hem_cord"], collar=None)), ("hood_down", None), ("chinos", "2f3a4e"),
               ("sneakers", "3a2a1a", dict(sole="d8d0c4"))],
         gear=[("fitness_band", dict(color="1a1a1c", idle=0.15))]),
    dict(id="kid_mira", group="Mission extras", era="2026", role="Mira at 10 (residue echo, mission 6)", years=10, metres=1.36,
         macro=KID(False, caucasian=0.9, asian=0.1), details={"head/head-oval": 0.3},
         skin="d9a585", lip="b8706a", eyes="6a7a6a", hair="bob", hairColor="1e1712", tris=9000,
         wear=[("denim_shirt", "e8e4dc", dict(det=["placket"], fab="cotton")), ("knit_sweater", "6a2a3a"), ("chinos", "1f2227"), ("leather_work_shoes", "3a2a1a")],
         gear=[]),
    dict(id="neighbor", group="Mission extras", era="2049", role="Neighbour, clock quarter (mission 6)", years=46, metres=1.76,
         macro=M(muscle=0.5, weight=0.5, caucasian=0.8, african=0.2), details={"head/head-rectangular": 0.3},
         skin="c89a7a", lip="9a6a5a", eyes="3a2a1c", hair="short", hairColor="2a1f19", stubble=0.7, glow="f2f6ff", glowLevel=0.3,
         wear=[("knit_sweater", "262c32"), ("techshell", "3b4441"), ("hood_down", None), ("tech_trousers", "1c2026"), ("tech_boots", "141210")],
         gear=[("wrist_device", dict(idle=0.35)), "earbuds", ("led_umbrella", dict(color="1e2a36"))]),
    dict(id="potter", group="Mission extras", era="ancient", role="Iru, potter of the upper terrace (mission 5)", years=46, metres=1.60,
         macro=F(muscle=0.62, weight=0.55, **ANC), details={"head/head-round": 0.3, "mouth/mouth-laugh-lines-in|out": 0.3, **sym(cheek_volume=0.2)},
         skin="7d4f33", lip="5a3028", eyes="2a1a10", hair="bun", hairColor="141010",
         wear=[("tunic", "b4884e", dict(sleeve="elbow", c2="9b3b24")), ("sash", "9b3b24", dict(width=0.11)), ("leather_hipwrap", "5a3e28", dict(det=["stitch_edges"])),
               ("leg_wraps", "5a4632"), ("sandals", "4a3220")],
         gear=[("period:bronze_bracelets", dict(color="c9a050"))]),
    dict(id="villager", group="Mission extras", era="ancient", role="Villager of the lower village (mission 5 speaker)", years=52, metres=1.70,
         macro=M(muscle=0.5, weight=0.36, **ANC), details={"head/head-oval": 0.3, "nose/nose-scale-horiz-decr|incr": 0.2},
         skin="6b4029", lip="5a3028", eyes="2a1a10", hair="curls", hairColor="5a5450", stubble=1.0, beard=0.8, beardColor="4a4440",
         wear=[("tunic", "d9c9a0", dict(c2="2f5a5a")), ("sash", "2f5a5a", dict(width=0.06)), ("mantle_wrap", "b89a6a"), ("leg_wraps", "7a6248"),
               ("sandals", "4a3220")],
         gear=["period:leather_pouch", "period:flint_knife", ("period:staff", dict(above=0.25))]),

    # ========================================= CROWD 2049 CIVILIANS ===========================================
    dict(id="c49_m1", group="Crowd 2049 civilians", era="2049", role="Civilian: young professional", years=24, metres=1.76,
         macro=M(muscle=0.5, weight=0.38, asian=0.9, caucasian=0.1), details={"head/head-oval": 0.3, "eyes/l-eye-epicanthus-in|out": 0.2, "eyes/r-eye-epicanthus-in|out": 0.2},
         skin="e8c0a0", lip="b07a6a", eyes="2a1c14", hair="undercut", hairColor="141010", glow="ff4fa0", glowLevel=0.35,
         wear=[("tshirt", "2a2c2f"), ("cropped_techjacket", "18191d"), ("cargo_joggers", "3a3e44"), ("chunky_sneakers", "141414", dict(sole="2a2a2a"))],
         gear=[("ar_glasses", dict(glow="38c8c0")), "wrist_device", "earbuds"]),
    dict(id="c49_m2", group="Crowd 2049 civilians", era="2049", role="Civilian: commuter", years=38, metres=1.84,
         macro=M(muscle=0.62, weight=0.45, **AF), details={"head/head-oval": 0.3, "nose/nose-scale-horiz-decr|incr": 0.25, **sym(cheek_bones=0.3)},
         skin="6b4029", lip="5a3028", eyes="2a1a10", hair="fade", hairColor="141010", stubble=0.9, beard=0.6, glow="f2f6ff", glowLevel=0.3,
         wear=[("mock_neck", "1d2026"), ("longshell", "6f6656"), ("tech_trousers", "1a1d22"), ("ankle_boots", "141210")],
         gear=["wrist_device", ("led_umbrella", dict(color="22262c"))]),
    dict(id="c49_m3", group="Crowd 2049 civilians", era="2049", role="Civilian: shop owner", years=55, metres=1.72,
         macro=M(muscle=0.5, weight=0.6, **SA), details={"head/head-round": 0.3, "nose/nose-scale-vert-decr|incr": 0.2},
         skin="a16d4c", lip="7a4a3c", eyes="2a1a10", hair="short", hairColor="4a4644", stubble=1.0, beard=0.75, beardColor="8a8680", glow="ffb347", glowLevel=0.3,
         wear=[("knit_sweater", "3a3630"), ("smart_parka", "3c4430", dict(det_add=["led:collar"])), ("chinos", "3a2f2a"), ("tech_boots", "1c1612")],
         gear=[("ar_glasses", dict(color="3a3430", idle=0.25)), ("id_badge", dict(header="ffb347", lanyard="2a2e36")), ("rugged_slate", dict(hand=True))]),
    dict(id="c49_m4", group="Crowd 2049 civilians", era="2049", role="Civilian: bike courier", years=31, metres=1.86,
         macro=M(muscle=0.6, weight=0.36, **EU), details={"head/head-rectangular": 0.3, "chin/chin-prominent-decr|incr": 0.2},
         skin="f1c6a8", lip="b8786a", eyes="5a7a9a", hair="swept", hairColor="c8a060", stubble=0.4, glow="6affc8",
         wear=[("leggings", "1a1d22"), ("tech_shorts", "1d2430"), ("techshell", "1d2a44"), ("chest_harness", "4a5058"),
               ("sneakers", "202020", dict(shaft=0.06, sole="3a3a3a"))],
         gear=["cube_backpack", "ar_visor_clip", "wrist_device"]),
    dict(id="c49_m5", group="Crowd 2049 civilians", era="2049", role="Civilian: retired engineer", years=67, metres=1.70,
         macro=M(muscle=0.42, weight=0.48, **ME), details={"head/head-oval": 0.3, "nose/nose-hump-decr|incr": 0.25, **sym(eye_bag=0.25)},
         skin="d9a585", lip="a8706a", eyes="3a2a1c", hair="swept", hairColor="c8c4bc", glow="f2f6ff", glowLevel=0.2,
         wear=[("turtleneck", "6a6e74"), ("longshell", "4a4e54", dict(fab="wool", gloss=0.1, det=["zip:placket", "pocket:hip_slash"])), ("chinos", "23262b"),
               ("leather_work_shoes", "141210")],
         gear=[("ar_glasses", dict(color="2a2c30", idle=0.2)), ("fitness_band", dict(idle=0.2)), ("led_umbrella", dict(closed=True, color="1d2430"))]),
    dict(id="c49_m6", group="Crowd 2049 civilians", era="2049", role="Civilian: street-food vendor", years=45, metres=1.78,
         macro=M(muscle=0.55, weight=0.68, **LAT), details={"head/head-round": 0.35, **sym(cheek_volume=0.25)},
         skin="b98463", lip="8a5a4c", eyes="2a1a10", hair="short", hairColor="141010", stubble=0.8, glow="6affc8", glowLevel=0.35,
         wear=[("wipe_shell", "3a3f46"), ("vendor_vest", "1f3a3a"), ("sleeve_guards", "2a2e33"), ("work_trousers", "23262b"), ("safety_boots", "141210")],
         gear=["payment_terminal", "earpiece"]),
    dict(id="c49_f1", group="Crowd 2049 civilians", era="2049", role="Civilian: designer", years=27, metres=1.65,
         macro=F(muscle=0.48, weight=0.36, **EA), details={"head/head-oval": 0.4, "eyes/l-eye-epicanthus-in|out": 0.2, "eyes/r-eye-epicanthus-in|out": 0.2, **sym(cheek_bones=0.3)},
         skin="f1c6a8", lip="c27a72", eyes="2a1c14", hair="long", hairColor="141010", glow="38c8c0", glowLevel=0.35,
         wear=[("mock_neck", "18191d"), ("techshell", "c4c4c8"), ("hood_down", None), ("tech_trousers", "18191d"), ("chunky_sneakers", "e0e0e0", dict(sole="202020"))],
         gear=[("ar_glasses", dict(glow="38c8c0")), "wrist_device"]),
    dict(id="c49_f2", group="Crowd 2049 civilians", era="2049", role="Civilian: nurse off shift", years=34, metres=1.74,
         macro=F(muscle=0.58, weight=0.42, **AF), details={"head/head-oval": 0.4, **sym(cheek_bones=0.4)},
         skin="6b4029", lip="5a3028", eyes="2a1a10", hair="pony", hairColor="141010", glow="ffb347", glowLevel=0.35,
         wear=[("turtleneck", "2a2c30"), ("longshell", "4a1f24", dict(det_add=["led:belt"])), ("leggings", "1a1d22"), ("ankle_boots", "141210")],
         gear=["wrist_device", ("keycard_reel", dict(header="d0d4d8"))]),
    dict(id="c49_f3", group="Crowd 2049 civilians", era="2049", role="Civilian: office worker", years=48, metres=1.68,
         macro=F(muscle=0.45, weight=0.55, **EU), details={"head/head-round": 0.3},
         skin="e8b996", lip="b8706a", eyes="5a7a5a", hair="bob", hairColor="7a3a1e", glow="f2f6ff", glowLevel=0.3,
         wear=[("mock_neck", "2a2f36"), ("smart_parka", "2e3a4e"), ("wide_trousers", "2d2a26"), ("tech_boots", "141210")],
         gear=["earpiece", ("led_umbrella", dict(color="2a2a30")), "tablet_bag"]),
    dict(id="c49_f4", group="Crowd 2049 civilians", era="2049", role="Civilian: student", years=22, metres=1.62,
         macro=F(muscle=0.45, weight=0.36, caucasian=0.6, asian=0.25, african=0.15), details={"head/head-oval": 0.3, **sym(cheek_bones=0.3)},
         skin="c8916c", lip="a86a5c", eyes="3a2a1c", hair="pixie", hairColor="2a1f19", glow="6affc8", glowLevel=0.35,
         wear=[("leggings", "1a1d22"), ("tech_shorts", "3a3e44"), ("hoodie", "2a2a2a", dict(det_add=["led:zip"])), ("chunky_sneakers", "e6e2da")],
         gear=[("ar_glasses", dict(glow="6affc8")), "sling_bag", "earbuds"]),
    dict(id="c49_f5", group="Crowd 2049 civilians", era="2049", role="Civilian: grandmother", years=62, metres=1.60,
         macro=F(muscle=0.4, weight=0.45, **EA), details={"head/head-round": 0.3, **sym(eye_bag=0.2)},
         skin="e8c0a0", lip="b07a70", eyes="2a1c14", hair="pixie", hairColor="a8a4a0", glow="6affc8", glowLevel=0.2,
         wear=[("mock_neck", "2a2a2a"), ("smart_parka", "3a2f2a", dict(tail=dict(end=0.27, flare=0.16, split=0.02, vent=0.1))), ("chinos", "23262b"),
               ("sneakers", "2a2a2a", dict(sole="d8d4cc"))],
         gear=[("fitness_band", dict(idle=0.2)), ("led_umbrella", dict(closed=True, color="3a2f2a")), ("ar_glasses", dict(color="3a3430", idle=0.2))]),
    dict(id="c49_f6", group="Crowd 2049 civilians", era="2049", role="Civilian: emergency responder", years=39, metres=1.70,
         macro=F(muscle=0.62, weight=0.5, **LAT), details={"head/head-oval": 0.3, **sym(cheek_bones=0.3)},
         skin="b98463", lip="8a5a4c", eyes="2a1a10", hair="pony", hairColor="1e1712", glow="f2f6ff",
         wear=[("responder_shell", "a8262e"), ("cargo_trousers", "2a2f36"), ("safety_boots", "141210")],
         gear=["med_pack", ("shoulder_radio", dict(glow="f2f6ff")), "pen_light"]),
    dict(id="c49_kid_m", group="Crowd 2049 civilians", era="2049", role="Civilian child: schoolboy", years=10, metres=1.38,
         macro=KID(True, **SA), details={"head/head-round": 0.2},
         skin="a16d4c", lip="8a5a4c", eyes="2a1a10", hair="short", hairColor="141010", glow="38c8c0", glowLevel=0.35,
         wear=[("tshirt", "6a6e74"), ("techshell", "1d2a44", dict(det=["zip", "reflective:arms", "hem_cord"])), ("hood_down", None), ("cargo_joggers", "6a6e74"),
               ("light_up_sneakers", "e6e2da")],
         gear=["kid_locator_band", ("school_backpack", dict(color="2a7a6a", tablet=True))]),
    dict(id="c49_kid_f", group="Crowd 2049 civilians", era="2049", role="Civilian child: little girl", years=6, metres=1.15,
         macro=KID(False, **AF), details={"head/head-round": 0.3},
         skin="8c5a3a", lip="6a3a30", eyes="2a1a10", hair="puffs", hairColor="141010", glow="ffe6b0", glowLevel=0.35,
         wear=[("padded_jacket", "6abfa8"), ("hood_down", None), ("leggings", "2a2a44"), ("rain_boots", "e8b923")],
         gear=["kid_locator_band", ("led_umbrella", dict(color="e8b923"))]),

    # ====================================== CROWD 2049 HELIX AND SERVICES =====================================
    dict(id="helix_sci_m", group="Crowd 2049 Helix and services", era="2049", role="Helix scientist", years=36, metres=1.79,
         macro=M(muscle=0.5, weight=0.45, **ME), details={"head/head-oval": 0.3, "nose/nose-scale-vert-decr|incr": 0.2},
         skin="c8916c", lip="8a5a4c", eyes="3a2a1c", hair="short", hairColor="1a1512", stubble=0.9, beard=0.55, glow="38c8c0",
         wear=[("knit_sweater", "6a6e74"), ("labcoat49", "e9ecec"), ("chinos", "23262b"), ("sneakers", "d8dce0")],
         gear=[("coat_tech_panel", dict(glow="38c8c0")), ("ar_glasses", dict(glow="38c8c0")), ("id_badge", dict(header="38c8c0", mount="clip")), ("rugged_slate", dict(hand=True))]),
    dict(id="helix_sci_f", group="Crowd 2049 Helix and services", era="2049", role="Helix scientist", years=44, metres=1.63,
         macro=F(muscle=0.45, weight=0.38, **EA), details={"head/head-oval": 0.35, "eyes/l-eye-epicanthus-in|out": 0.2, "eyes/r-eye-epicanthus-in|out": 0.2},
         skin="f1c6a8", lip="b8706a", eyes="2a1c14", hair="bob", hairColor="1a1818", glow="38c8c0",
         wear=[("mock_neck", "1d2430"), ("labcoat49", "e9ecec", dict(tail=dict(end=0.37, flare=0.14, split=0.03, vent=0.12, panel=0.6))), ("chinos", "4a4e54"), ("sneakers", "e6e2da")],
         gear=[("coat_tech_panel", dict(glow="38c8c0")), ("headset_neck", dict(worn="head")), "wrist_slate", ("id_badge", dict(header="38c8c0", mount="clip"))]),
    dict(id="helix_sec_1", group="Crowd 2049 Helix and services", era="2049", role="Helix security guard", years=32, metres=1.88,
         macro=M(muscle=0.8, weight=0.55, **AF), details={"head/head-square": 0.4, "chin/chin-width-decr|incr": 0.3},
         skin="5a3622", lip="4a2a22", eyes="2a1a10", hair="crop", hairColor="141010", glow="ff4d5e",
         wear=[("duty_shell", SEC["shell"]), ("plate_carrier", SEC["carrier"]), ("duty_belt", "111214"), ("tech_trousers", SEC["shell"], dict(tuck=True)),
               ("tactical_boots", SEC["boots"]), ("gloves", SEC["gloves"]), ("tactical_cap", "15181c")],
         gear=[("shoulder_radio", dict(glow="ff4d5e")), "stun_baton", "body_cam", "vest_flashlight"]),
    dict(id="helix_sec_2", group="Crowd 2049 Helix and services", era="2049", role="Helix security guard", years=35, metres=1.75,
         macro=F(muscle=0.7, weight=0.46, **LAT), details={"head/head-oval": 0.3, "chin/chin-prominent-decr|incr": 0.2},
         skin="b98463", lip="8a5a4c", eyes="2a1a10", hair="bun", hairColor="141010", glow="ff4d5e",
         wear=[("duty_shell", SEC["shell"]), ("plate_carrier", SEC["carrier"]), ("duty_belt", "111214"), ("forearm_guards", "22262c"),
               ("tech_trousers", SEC["shell"], dict(tuck=True)), ("tactical_boots", SEC["boots"])],
         gear=["ar_half_visor", ("shoulder_radio", dict(glow="ff4d5e")), "stun_baton", "restraint_cuffs"]),
    dict(id="transit_worker", group="Crowd 2049 Helix and services", era="2049", role="Rain City transit worker", years=29, metres=1.64,
         macro=F(muscle=0.5, weight=0.45, asian=0.75, caucasian=0.15, african=0.1), details={"head/head-round": 0.3},
         skin="c8916c", lip="a06a5c", eyes="2a1a10", hair="pony", hairColor="141010", glow="ffd34a",
         wear=[("duty_shell", "1d2a44", dict(c3="d4c21a", det_del=["chevrons:sleeve"])), ("smart_vest", "d9cf3a", dict(text="TRANSIT")),
               ("chinos", "1d2a44", dict(det_add=["reflective:ankles"])), ("service_boots", "111111"), ("transit_cap", "1d2a44", dict(c2="d4c21a"))],
         gear=["transit_tablet", "signal_wand", "earpiece", ("shoulder_radio", dict(side="L", glow="ffd34a"))]),
    dict(id="technician", group="Crowd 2049 Helix and services", era="2049", role="Helix / city maintenance technician", years=38, metres=1.70,
         macro=F(muscle=0.62, weight=0.48, **EU), details={"head/head-square": 0.2, **sym(cheek_bones=0.3)},
         skin="f1c6a8", lip="b8706a", eyes="5a6a5a", hair="braid", hairColor="7a3a20", glow="ff9a3a",
         wear=[("knit_sweater", "2c333b"), ("wipe_shell", "2c333b", dict(gloss=0.35)), ("smart_vest", "d8741e", dict(c3="d8dce0", text="HELIX|TECHNICIAN")), ("work_trousers", "2c333b"),
               ("safety_boots", "2a2018"), ("tech_cap", "2a3440")],
         gear=["tool_belt", "forearm_tablet", "cap_headlamp", "diagnostic_probe"]),

    # =============================================== CROWD 2026 ===============================================
    dict(id="c26_m1", group="Crowd 2026", era="2026", role="2026 civilian: young man", years=29, metres=1.82,
         macro=M(muscle=0.65, weight=0.42, **AF), details={"head/head-oval": 0.3, **sym(cheek_bones=0.3)},
         skin="6b4029", lip="5a3028", eyes="2a1a10", hair="fade", hairColor="141010", stubble=0.3,
         wear=[("hoodie", "8a8d92", dict(role="inner", z=45)), ("bomber", "18191d"), ("jeans", "2e3a4c"), ("sneakers", "e6e2da")],
         gear=["earbuds", "smartphone", "smartwatch"]),
    dict(id="c26_m2", group="Crowd 2026", era="2026", role="2026 civilian: father", years=47, metres=1.78,
         macro=M(muscle=0.45, weight=0.62, **EU), details={"head/head-round": 0.3},
         skin="e8b996", lip="b07a6a", eyes="5a6a7a", hair="short", hairColor="5a3a24", stubble=0.7,
         wear=[("flannel_shirt", "6a3a3a", dict(c2="2f4a3a")), ("padded_jacket", "1f2a36"), ("chinos", "a89a7a"), ("derby_boots", "5a3e28")],
         gear=["fitness_band", ("smartphone", dict(mount="pocket"))]),
    dict(id="c26_m3", group="Crowd 2026", era="2026", role="2026 civilian: older man", years=63, metres=1.70,
         macro=M(muscle=0.42, weight=0.4, **SA), details={"head/head-oval": 0.3, **sym(eye_bag=0.2)},
         skin="a16d4c", lip="7a4a3c", eyes="2a1a10", hair="short", hairColor="9a968e",
         wear=[("knit_sweater", "6a6e74"), ("car_coat", "b08a5a"), ("chinos", "2d2a26"), ("leather_work_shoes", "2a1d14")],
         gear=[("glasses", dict(shape="rect", wire=0.0017, color="1c1a18")), "smartphone"]),
    dict(id="c26_f1", group="Crowd 2026", era="2026", role="2026 civilian: student", years=24, metres=1.62,
         macro=F(muscle=0.45, weight=0.36, **EA), details={"head/head-oval": 0.4, "eyes/l-eye-epicanthus-in|out": 0.2, "eyes/r-eye-epicanthus-in|out": 0.2},
         skin="e8c0a0", lip="c27a72", eyes="2a1c14", hair="long", hairColor="141010",
         wear=[("knit_sweater", "e0d8c4"), ("puffer", "18191d"), ("wide_trousers", "6a7a94", dict(fab="denim")), ("chunky_sneakers", "e6e2da")],
         gear=["earbuds", "crossbody_bag"]),
    dict(id="c26_f2", group="Crowd 2026", era="2026", role="2026 civilian: professional", years=38, metres=1.68,
         macro=F(muscle=0.5, weight=0.44, **LAT), details={"head/head-oval": 0.3, **sym(cheek_bones=0.3)},
         skin="c8916c", lip="a06a5c", eyes="2a1a10", hair="waves", hairLen="mid", hairColor="1e1712",
         wear=[("turtleneck", "18191d"), ("utility_jacket", "4a4a32"), ("jeans", "1a1d22"), ("ankle_boots", "2a1d14")],
         gear=["smartwatch", "tote_bag"]),
    dict(id="c26_f3", group="Crowd 2026", era="2026", role="2026 civilian: older woman", years=55, metres=1.65,
         macro=F(muscle=0.45, weight=0.45, **EU), details={"head/head-oval": 0.3, **sym(eye_bag=0.15)},
         skin="f1c6a8", lip="b8706a", eyes="5a7a8a", hair="bob", hairColor="d8c8a0",
         wear=[("tshirt", "e8e4dc", dict(sleeve="long")), ("rain_mac", "1d2430"), ("chinos", "2d2a26"), ("loafers", "3a2a1c")],
         gear=[("glasses", dict(shape="rect", wire=0.0018, color="5a3a24")), ("smartphone", dict(mount="pocket")), ("led_umbrella", dict(closed=True, color="1d2430"))]),

    # =============================================== CROWD 2196 ===============================================
    dict(id="surv_m1", group="Crowd 2196", era="2196", role="Survivor: scavenger", years=41, metres=1.78,
         macro=M(muscle=0.55, weight=0.35, **ME), details={"head/head-rectangular": 0.3, "nose/nose-hump-decr|incr": 0.3},
         skin="a77a5d", eyes="3a2a1c", hair="short", hairColor="2a1f19", stubble=1.0, beard=0.85, glow="b6ff8a", glowLevel=0.4, wearLevel=0.9,
         wear=[("knit_sweater", "4a4238", dict(det_add=["wear"])), ("scav_plate", "4a4a3a"), ("poncho_hooded", "8a7458"),
               ("cargo_trousers", "5a4a38", dict(det_add=["wear", "patches"])), ("shin_wraps", "8a7a60"), ("knee_pads", "2a2a26"),
               ("wrapped_boots", "2a2018"), ("forearm_wraps", "8a7a60")],
         gear=[("respirator", dict(worn="face")), ("goggles", dict(worn="brow")), "handheld_scanner", "salvage_backpack"]),
    dict(id="surv_f1", group="Crowd 2196", era="2196", role="Survivor: scout", years=28, metres=1.70,
         macro=F(muscle=0.62, weight=0.38, **AF), details={"head/head-oval": 0.35, **sym(cheek_bones=0.35)},
         skin="6b4029", lip="5a3028", eyes="2a1a10", hair="locs", hairColor="141010", glow="b6ff8a", wearLevel=0.85,
         wear=[("field_jacket_worn", "6a5a44", dict(hem=0.05, c2="4a3a28")), ("pauldron", "7a6a3a", dict(side="R")), ("cargo_trousers", "4a4a32", dict(det_add=["wear"])),
               ("shin_wraps", "8a7a60"), ("combat_boots", "2a2018")],
         gear=[("goggles", dict(worn="brow")), ("respirator", dict(worn="neck")), "wrist_scanner_scav", "rope_coil", "crank_lamp"]),
    dict(id="surv_m2", group="Crowd 2196", era="2196", role="Survivor: elder mechanic", years=63, metres=1.68,
         macro=M(muscle=0.45, weight=0.32, **EA), details={"head/head-oval": 0.3, **sym(eye_bag=0.25, cheek_volume=-0.3)},
         skin="d8b08e", lip="a8706a", eyes="2a1c14", hair="crop", hairColor="9a968e", stubble=0.9, glow="b6ff8a", glowLevel=0.3, wearLevel=0.85,
         wear=[("knit_sweater", "4a4238", dict(det_add=["wear"])), ("utility_vest", "5a3e28", dict(fab="leather", det_add=["wear"])), ("cloak_hooded", "5e5a50"),
               ("hood_down", None), ("forearm_wraps", "b8ab90"), ("canvas_trousers", "8a7458"), ("wrapped_boots", "3a2a1c")],
         gear=["magnifier_goggles", "radio_chest_rig"]),
    dict(id="surv_f2", group="Crowd 2196", era="2196", role="Survivor: medic", years=45, metres=1.66,
         macro=F(muscle=0.55, weight=0.48, **EU), details={"head/head-square": 0.2, **sym(cheek_bones=0.3)},
         skin="e0b8a0", lip="a8706a", eyes="5a6a6a", hair="braid", hairColor="6a645c", glow="b6ff8a", wearLevel=0.8,
         wear=[("knit_sweater", "4a4a40", dict(det_add=["wear"])), ("padded_vest", "4a4a38"), ("cloak_hooded", "70746a", dict(det_add=["armband:a8262e"])), ("hood_down", None),
               ("canvas_trousers", "5a4a38"), ("combat_boots", "2a2018")],
         gear=[("med_pack", dict(color="5a4a38")), ("respirator", dict(worn="neck")), "handheld_scanner"]),
    dict(id="continuum_1", group="Crowd 2196", era="2196", role="Continuum trooper", years=30, metres=1.88,
         macro=M(muscle=0.72, weight=0.45, caucasian=0.5, asian=0.5), details={"head/head-oval": 0.3},
         skin="d8a888", eyes="3a2a1c", hair="fade", hairColor="141010", glow="ffd27a",
         wear=[("continuum_suit", "2a2d32"), ("suit_trousers", "2a2d32"), ("service_boots", "202328"), ("gloves", "202328"), ("continuum_helmet", "a7acb1")],
         gear=["continuum_armor", "continuum_chest_emitter", "continuum_forearm_emitter", "continuum_visor", "stabilizer_fins"]),
    dict(id="continuum_2", group="Crowd 2196", era="2196", role="Continuum officer", years=33, metres=1.76,
         macro=F(muscle=0.62, weight=0.4, caucasian=0.5, asian=0.5), details={"head/head-oval": 0.4, **sym(cheek_bones=0.35)},
         skin="e8c0a0", lip="b06a62", eyes="2a1c14", hair="bun", hairColor="141010", glow="ffd27a",
         wear=[("continuum_suit", "2a2d32"), ("suit_trousers", "2a2d32"), ("service_boots", "202328"), ("gloves", "202328"), ("half_cape", "2a2c30"),
               ("continuum_helmet_officer", "a7acb1")],
         gear=[("continuum_armor", dict(pauldrons="R")), "continuum_chest_emitter", ("continuum_forearm_emitter", dict(slate=True)),
               ("continuum_visor", dict(parked=True)), "rank_bar"]),

    # ========================================= CROWD ANCIENT SETTLEMENT =======================================
    dict(id="anc_m1", group="Crowd ancient settlement", era="ancient", role="Settler: farmer / builder", years=32, metres=1.74,
         macro=M(muscle=0.72, weight=0.45, **ANC), details={"head/head-square": 0.3, "chin/chin-width-decr|incr": 0.2},
         skin="6b4029", lip="5a3028", eyes="2a1a10", hair="crop", hairColor="141010", stubble=0.5,
         wear=[("tunic", "d9c9a0", dict(sleeve="cap", c2="8a6a44")), ("leather_belt", "4a3220"), ("leg_wraps", "7a6248"), ("sandals", "4a3220")],
         gear=["period:leather_pouch", "period:flint_knife"]),
    dict(id="anc_m2", group="Crowd ancient settlement", era="ancient", role="Settler: elder storyteller", years=64, metres=1.68,
         macro=M(muscle=0.4, weight=0.36, **ANC), details={"head/head-oval": 0.3, **sym(eye_bag=0.25)},
         skin="7d4f33", lip="5a3028", eyes="2a1a10", hair="curls", hairColor="8a8680", stubble=1.0, beard=0.9, beardColor="9a968e",
         wear=[("tunic", "8a3a3a", dict(sleeve="elbow", tail=dict(end=0.07, flare=0.15, slits=0.22), c2="c9a050")), ("mantle_wrap", "b89a6a"), ("sandals", "4a3220")],
         gear=[("period:bronze_pin", dict(color="c9a050")), "period:staff"]),
    dict(id="anc_m3", group="Crowd ancient settlement", era="ancient", role="Settler: sentry", years=22, metres=1.80,
         macro=M(muscle=0.7, weight=0.4, **ANC), details={"head/head-oval": 0.3, **sym(cheek_bones=0.3)},
         skin="8c5a3a", lip="6a3a30", eyes="2a1a10", hair="locs", hairColor="141010",
         wear=[("tunic", "cdb48a", dict(sleeve="cap")), ("leather_cuirass", "5a3e28"), ("forearm_guards", "4a3220", dict(fab="hard_leather")), ("cord_belt", "9b3b24"),
               ("leg_wraps", "5a4632"), ("sandals", "4a3220")],
         gear=["period:spear", "period:horn"]),
    dict(id="anc_m4", group="Crowd ancient settlement", era="ancient", role="Settler: bronze smith", years=40, metres=1.70,
         macro=M(muscle=0.78, weight=0.55, **ANC), details={"head/head-square": 0.35, "neck/neck-scale-horiz-decr|incr": 0.3},
         skin="5a3622", lip="4a2a22", eyes="2a1a10", hair="crop", hairColor="141010", stubble=1.0, beard=0.85,
         wear=[("tunic", "8a6a4a", dict(sleeve="cap")), ("leather_hipwrap", "4a3220", dict(det=["stitch_edges"])), ("leg_wraps", "5a4632"), ("sandals", "4a3220"),
               ("gloves", "5a3e28", dict(side="R", fab="suede", gloss=0.0, thick=0.0042, gauntlet=0.07, det=["soot_tips", "lace_wrap", "stitch_edges"]))],
         gear=[("period:bronze_armlet", dict(color="c9a050"))]),
    dict(id="anc_f1", group="Crowd ancient settlement", era="ancient", role="Settler: water carrier", years=25, metres=1.62,
         macro=F(muscle=0.52, weight=0.38, **ANC), details={"head/head-oval": 0.4, **sym(cheek_bones=0.35)},
         skin="a06a46", lip="7a4a3c", eyes="2a1a10", hair="braid", hairColor="141010",
         wear=[("tunic", "b4884e", dict(sleeve="cap", tail=dict(end=0.17, flare=0.2, slits=0.14), c2="2f5a5a")), ("sash", "2f5a5a"), ("sandals", "4a3220")],
         gear=["period:clay_jar", ("period:bronze_bracelets", dict(color="c9a050"))]),
    dict(id="anc_f2", group="Crowd ancient settlement", era="ancient", role="Settler: weaver", years=50, metres=1.58,
         macro=F(muscle=0.42, weight=0.55, **ANC), details={"head/head-round": 0.3, "mouth/mouth-laugh-lines-in|out": 0.25},
         skin="7d4f33", lip="5a3028", eyes="2a1a10", hair="bun", hairColor="3a3634",
         wear=[("tunic", "d9c9a0", dict(sleeve="elbow", tail=dict(end=0.08, flare=0.16, slits=0.22), c2="9b3b24")), ("mantle_wrap", "d0a24a"), ("sandals", "4a3220")],
         gear=["period:distaff", ("period:bead_necklace", dict(color="9b3b24"))]),
    dict(id="anc_f3", group="Crowd ancient settlement", era="ancient", role="Settler: herbalist / healer", years=35, metres=1.66,
         macro=F(muscle=0.5, weight=0.42, **ANC), details={"head/head-oval": 0.3, **sym(cheek_bones=0.3)},
         skin="8c5a3a", lip="6a3a30", eyes="2a1a10", hair="braid", hairColor="141010",
         wear=[("tunic", "6a7a3a", dict(sleeve="elbow", c2="d9c9a0")), ("leg_wraps", "7a6248"), ("sandals", "4a3220"), ("woven_headband", "9b3b24")],
         gear=["period:leather_satchel", ("period:bronze_pin", dict(color="c9a050"))]),
    dict(id="anc_f4", group="Crowd ancient settlement", era="ancient", role="Settler: elder", years=68, metres=1.55,
         macro=F(muscle=0.35, weight=0.4, **ANC), details={"head/head-oval": 0.2, **sym(eye_bag=0.3)},
         skin="6b4029", lip="5a3028", eyes="2a1a10", hair="bun", hairColor="d6d0c6",
         wear=[("tunic", "5a2a4a", dict(tail=dict(end=0.07, flare=0.15, slits=0.25))), ("mantle_wrap", "b89a6a"), ("sandals", "4a3220"), ("head_wrap", "d9c9a0")],
         gear=[("period:staff", dict(above=0.15))]),
    dict(id="anc_kid_m", group="Crowd ancient settlement", era="ancient", role="Settler child: boy", years=9, metres=1.30,
         macro=KID(True, **ANC), details={"head/head-round": 0.25},
         skin="8c5a3a", lip="6a3a30", eyes="2a1a10", hair="curls", hairColor="141010",
         wear=[("tunic", "d9c9a0", dict(tail=dict(end=0.3, flare=0.2, slits=0.08))), ("cord_belt", "9b3b24"), ("sandals", "4a3220")],
         gear=["period:sling"]),
    dict(id="anc_kid_f", group="Crowd ancient settlement", era="ancient", role="Settler child: girl", years=7, metres=1.20,
         macro=KID(False, **ANC), details={"head/head-round": 0.3},
         skin="a06a46", lip="7a4a3c", eyes="2a1a10", hair="braid", hairColor="141010",
         wear=[("tunic", "b4884e", dict(tail=dict(end=0.27, flare=0.2, slits=0.08))), ("sash", "9b3b24", dict(width=0.06)), ("sandals", "4a3220")],
         gear=[]),
]

# ---------------------------------------------------------------------------------------------------------------
# finishing: ages, proportions, softened details, budgets, solved heights
# ---------------------------------------------------------------------------------------------------------------
CROWD_PREFIX = ("c49_", "c26_", "surv_", "continuum_", "anc_", "helix_", "transit_worker", "technician")

for _c in CAST:
    _m = _c["macro"]
    _m["age"] = round(mh_age(_c["years"]), 4)
    _m.setdefault("proportions", 0.62 if _c["years"] < 14 else 0.72)
    _c["details"] = {k: max(-0.4, min(0.4, v * 0.8)) for k, v in _c.get("details", {}).items()}
    if _c["id"].startswith(CROWD_PREFIX) or _c["years"] < 14:
        _c.setdefault("tris", 9000)
        _c.setdefault("normalDiv", 2)      # crowd / child atlases: half-resolution normal map, a lighter JPEG
        _c.setdefault("jpegQ", 84)
    if not _c.get("gear"):
        _c.pop("gear", None)

_HCACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cast_nrzero_heights.json")


def _solve_heights(cast):
    """MakeHuman `height` for each character's target standing height (bisection on the sculpted body, cached)."""
    try:
        cache = json.load(open(_HCACHE))
    except (OSError, ValueError):
        cache = {}
    only = os.environ.get("ONLY")
    dirty = False
    for c in cast:
        key = json.dumps([c["metres"], c["macro"], c["details"]], sort_keys=True)
        if key not in cache:
            if only and c["id"] not in only.split(","):
                c["macro"]["height"] = 0.5
                continue
            import mh
            import numpy as np
            body = np.array(mh.group_vertices("body"))
            lo, hi = 0.0, 1.0
            for _ in range(10):
                h = (lo + hi) / 2
                P = mh.sculpt(dict(c["macro"], height=h), c["details"])
                if P[body, 1].max() - P[body, 1].min() < c["metres"]:
                    lo = h
                else:
                    hi = h
            cache[key] = round((lo + hi) / 2, 4)
            dirty = True
        c["macro"]["height"] = cache[key]
    if dirty:
        json.dump(cache, open(_HCACHE, "w"), indent=0, sort_keys=True)


_solve_heights(CAST)

INDEX = [dict(id=c["id"], era=c["era"], group=c["group"], role=c["role"], sex="m" if c["macro"]["gender"] >= 0.5 else "f", age=c["years"],
              height=c["metres"], tris=c.get("tris", 11000), lod=6000 if c.get("tris", 11000) <= 9000 else 0) for c in CAST]

if __name__ == "__main__":     # python cast_nrzero.py OUT.json: the cast index (id, era, group, role, sex, age, height, tris, lod)
    import sys
    json.dump(dict(cast="nrzero", count=len(INDEX), characters=INDEX), open(sys.argv[1], "w"), indent=1)
    print(len(INDEX), "->", sys.argv[1])
