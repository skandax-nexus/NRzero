"""Costume pipeline test cast (CAST=test): one character per era family, built with `wear=[...]` (see garments.py).

    cd tools/characters && CAST=test MH_DATA=... venv/bin/python build_humans.py OUT_DIR
"""
from cast_humans import sym

CAST = [
    # ---- 2049 techwear man (Kai's kit, no gadgets): sealed shell, hood down, harness, tech trousers, tech boots ----
    dict(id="t_kai", era="2049", macro=dict(gender=1.0, age=0.554, muscle=0.62, weight=0.45, height=0.47, caucasian=0.45, african=0.15, asian=0.4),
         details={"head/head-square": 0.4, "chin/chin-prominent-decr|incr": 0.2, "nose/nose-scale-vert-decr|incr": 0.1, **sym(cheek_bones=0.35)},
         skin="b98463", lip="9a5a4c", eyes="3a2a1c", hair="waves", hairColor="141110", stubble=0.85, browThick=0.8,
         glow="5fe6ff", glowLevel=0.6, metalColor="8a9098", tris=16000,
         wear=[("mock_neck", "2a2c2f"), ("techshell", "16181c"), ("hood_down", None), ("chest_harness", "3a3f46"),
               ("tech_trousers", "2e3237"), ("tech_boots", "1b1611", dict(sole="6a6e74")), ("gloves", "1d1a17", dict(side="R", fingerless=True))]),
    # ---- 2049 woman in a long sealed coat (the off-shift nurse): oxblood longshell, LED belt line, leggings, ankle boots ----
    dict(id="t_coat", era="2049", macro=dict(gender=0.0, age=0.57, muscle=0.55, weight=0.42, height=0.62, african=0.9, caucasian=0.1, asian=0.0),
         details={"head/head-oval": 0.4, **sym(cheek_bones=0.4)},
         skin="6b4029", lip="6a3a34", eyes="2a1a10", hair="pony", hairColor="141010", glow="ffb347", glowLevel=0.35,
         wear=[("turtleneck", "2a2c30"), ("longshell", "4a1f24", dict(det_add=["led:belt"])), ("leggings", "1a1d22"), ("ankle_boots", "141210")]),
    # ---- 2196 survivor: hooded poncho over layered knit and a scavenged plate, wrapped legs, knee pads, wrapped boots ----
    dict(id="t_surv", era="2196", macro=dict(gender=1.0, age=0.62, muscle=0.5, weight=0.35, height=0.55, caucasian=0.6, african=0.2, asian=0.2),
         details={"head/head-rectangular": 0.3, "nose/nose-hump-decr|incr": 0.3},
         skin="a77a5d", eyes="3a2a1c", hair="short", hairColor="2a1f19", stubble=1.0, glow="b6ff8a", glowLevel=0.4, wearLevel=0.9,
         wear=[("knit_sweater", "4a4238", dict(det_add=["wear"])), ("scav_plate", "4a4a3a"), ("poncho_hooded", "8a7458"),
               ("cargo_trousers", "5a4a38", dict(det_add=["wear", "patches"])), ("shin_wraps", "8a7a60"), ("knee_pads", "2a2a26"),
               ("wrapped_boots", "2a2018"), ("forearm_wraps", "8a7a60")]),
    # ---- ANCIENT settler (Niko): flax linen tunic, madder sash knotted at the left hip, leg wraps, sandals ----
    dict(id="t_anc", era="ancient", macro=dict(gender=1.0, age=0.47, muscle=0.5, weight=0.4, height=0.42, african=1.0, caucasian=0.0, asian=0.0),
         details={"head/head-round": 0.3, "nose/nose-scale-horiz-decr|incr": 0.3},
         skin="8c5a3a", lip="6a3a30", eyes="2a1a10", hair="curls", hairColor="141010",
         wear=[("tunic", "cdb48a", dict(c2="9b3b24")), ("sash", "9b3b24"), ("leg_wraps", "7a6248"), ("sandals", "5a3e28")]),
]


# ---- coverage set (TEST_ALL=1): every garment type, hair style and footwear of docs/COSTUMES.md in era-coherent outfits ----
M, F = dict(gender=1.0, age=0.5, muscle=0.55, weight=0.45, height=0.5), dict(gender=0.0, age=0.5, muscle=0.5, weight=0.42, height=0.55)
KID = dict(gender=0.3, age=0.16, muscle=0.5, weight=0.42, height=0.45)
mix = lambda base, **kw: dict(base, **kw)
COVERAGE = [
    dict(id="v_mira", era="2049", macro=mix(F, age=0.53, caucasian=0.9, asian=0.1, african=0.0), skin="d9a585", hair="waves", hairLen="mid", hairColor="1e1712",
         glow="9a7bff", glowLevel=0.6, wear=[("mock_neck", "1c1a22"), ("armored_jacket", "1c1a22"), ("tech_trousers", "1f2227", dict(det_add=["knee_patch"])),
                                              ("ankle_boots", "15120f")]),
    dict(id="v_hale", era="2049", macro=mix(M, age=0.62, muscle=0.75, weight=0.7, caucasian=1.0, african=0.0, asian=0.0), skin="c49a7c", hair="fade", hairColor="6a5a48",
         stubble=0.5, glow="ff4d5e", wear=[("duty_shell", "1c2533"), ("plate_carrier", "111820"), ("duty_belt", "111214"), ("tech_trousers", "1c2533", dict(tuck=True)),
                                           ("combat_boots", "0f0f10"), ("gloves", "101010"), ("tactical_cap", "15181c")]),
    dict(id="v_jun", era="2049", macro=mix(M, asian=1.0, caucasian=0.0, african=0.0), skin="d8b08e", hair="short", hairColor="141010", glow="ffd34a",
         wear=[("duty_shell", "1d2a44", dict(c3="d4c21a")), ("smart_vest", "d4c21a"), ("chinos", "1d2a44", dict(det_add=["reflective:ankles"])), ("service_boots", "111111"),
               ("transit_cap", "1d2a44", dict(c2="d4c21a"))]),
    dict(id="v_iven", era="2049", macro=mix(M, age=0.6, weight=0.55, caucasian=1.0, african=0.0, asian=0.0), skin="e0b394", hair="crop", hairColor="8a4a2a", stubble=0.6,
         glow="ff9a3a", wear=[("knit_sweater", "37404a"), ("smart_vest", "d9781e", dict(c3="c8ccd0")), ("work_trousers", "2c333b"), ("safety_boots", "2a2018"),
                               ("gloves", "5a4a3a"), ("tech_cap", "2a3440")]),
    dict(id="v_rook", era="2049", macro=mix(M, age=0.78, muscle=0.4, weight=0.4, caucasian=1.0, african=0.0, asian=0.0), skin="d3a487", hair="swept", hairColor="d6d0c6",
         glow="f2f6ff", glowLevel=0.3, wear=[("mock_neck", "2f3542"), ("labcoat49", "e8eaec"), ("chinos", "2a2e36"), ("derby_boots", "14151a")]),
    dict(id="v_resp", era="2049", macro=mix(F, age=0.6, muscle=0.6, african=0.0, caucasian=0.6, asian=0.4), skin="b98463", hair="pony", hairColor="2a1f19", glow="f2f6ff",
         wear=[("responder_shell", "a8262e"), ("cargo_trousers", "2a2f36"), ("safety_boots", "141210")]),
    dict(id="v_c26a", era="2026", macro=mix(M, age=0.45, african=0.5, caucasian=0.5, asian=0.0), skin="8a5a3c", hair="undercut", hairColor="141010",
         wear=[("tshirt", "e6e2da"), ("hoodie", "6a6e74"), ("jeans", "2e3a4c"), ("sneakers", "e6e2da")]),
    dict(id="v_c26b", era="2026", macro=mix(F, age=0.62, caucasian=1.0, african=0.0, asian=0.0), skin="e6b998", hair="pixie", hairColor="5a3a24",
         wear=[("turtleneck", "e0d8c4"), ("rain_mac", "b08a5a"), ("wide_trousers", "18191d"), ("loafers", "3a2a1c")]),
    dict(id="v_c26c", era="2026", macro=mix(M, age=0.42, asian=0.8, caucasian=0.2, african=0.0), skin="d2a47e", hair="short", hairColor="141010",
         wear=[("tshirt", "18191d"), ("bomber", "4a4a32"), ("chinos", "bcb19c"), ("chunky_sneakers", "e6e2da"), ("beanie", "6a2a3a")]),
    dict(id="v_c26d", era="2026", macro=mix(M, age=0.7, caucasian=1.0, african=0.0, asian=0.0), skin="e2b496", hair="short", hairColor="7a6a5a", stubble=0.6,
         wear=[("flannel_shirt", "6a2a3a", dict(c2="2a1a1a")), ("utility_vest", "5a4a38"), ("jeans", "2e3a4c"), ("leather_work_shoes", "3a2a1c")]),
    dict(id="v_c26e", era="2026", macro=mix(F, age=0.7, caucasian=0.5, asian=0.5, african=0.0), skin="e8c0a0", hair="bob", hairColor="141010",
         wear=[("knit_sweater", "8a8d92"), ("car_coat", "2f4a3a"), ("chinos", "1d2430"), ("ankle_boots", "1c1a18")]),
    dict(id="v_c26f", era="2026", macro=mix(M, age=0.55, african=0.0, caucasian=0.4, asian=0.6), skin="c8916c", hair="crop", hairColor="141010",
         wear=[("denim_shirt", "5a6e8a"), ("labcoat26", "f0eee8"), ("chinos", "4a4e54"), ("sneakers", "e6e2da")]),
    dict(id="v_kid", era="2049", macro=mix(KID, african=1.0, caucasian=0.0, asian=0.0), skin="8c5a3a", hair="puffs", hairColor="141010", glow="ffe6b0", glowLevel=0.35,
         wear=[("padded_jacket", "6abfa8"), ("leggings", "2a2a44"), ("rain_boots", "e8b923")]),
    dict(id="v_kid2", era="2049", macro=mix(KID, gender=0.8, african=0.0, caucasian=0.3, asian=0.7), skin="a16d4c", hair="short", hairColor="141010", glow="38c8c0", glowLevel=0.35,
         wear=[("puffer", "1d2a44"), ("cargo_joggers", "6a6e74"), ("light_up_sneakers", "e6e2da")]),
    dict(id="v_c49a", era="2049", macro=mix(M, age=0.47, asian=0.9, caucasian=0.1, african=0.0), skin="e8c0a0", hair="undercut", hairColor="141010", glow="ff4fa0", glowLevel=0.35,
         wear=[("tshirt", "2a2c2f"), ("cropped_techjacket", "18191d"), ("cargo_joggers", "3a3e44"), ("chunky_sneakers", "141414")]),
    dict(id="v_c49b", era="2049", macro=mix(F, age=0.66, weight=0.5, caucasian=1.0, african=0.0, asian=0.0), skin="e8b996", hair="bob", hairColor="7a3a1e", glow="ffb347",
         glowLevel=0.3, wear=[("mock_neck", "2a2f36"), ("smart_parka", "1d2430", dict(det_add=["led:collar"])), ("wide_trousers", "2d2a26"), ("tech_boots", "141210")]),
    dict(id="v_c49c", era="2049", macro=mix(M, age=0.53, caucasian=1.0, african=0.0, asian=0.0), skin="f1c6a8", hair="swept", hairColor="b08850", glow="6affc8",
         wear=[("leggings", "1a1d22"), ("tech_shorts", "1d2430"), ("techshell", "2d3640"), ("chest_harness", "c8ccd0"), ("sneakers", "202020")]),
    dict(id="v_c49d", era="2049", macro=mix(F, age=0.45, caucasian=0.5, asian=0.5, african=0.0), skin="c8916c", hair="pixie", hairColor="2a1f19", glow="6affc8", glowLevel=0.35,
         wear=[("leggings", "1a1d22"), ("tech_skirt", "3a3e44"), ("hoodie", "2a2a2a", dict(det_add=["led:zip"])), ("chunky_sneakers", "e6e2da")]),
    dict(id="v_sera", era="2196", macro=mix(F, age=0.57, muscle=0.65, caucasian=0.7, african=0.3, asian=0.0), skin="8a5b3c", hair="pony", hairColor="2a1f19", glow="b6ff8a",
         wearLevel=0.85, wear=[("field_jacket_worn", "4a3a28"), ("scav_plate", "3a3a2c"), ("pauldron", "4a4a3a", dict(side="L")), ("sling_strap", "2a2620", dict(side="R")),
                               ("cargo_trousers", "3a3a30", dict(det_add=["wear"])), ("knee_pads", "1e1e1c"), ("forearm_wraps", "8a7a60"), ("combat_boots", "2a2018")]),
    dict(id="v_mara", era="2196", macro=mix(F, age=0.86, muscle=0.4, caucasian=1.0, african=0.0, asian=0.0), skin="e0b8a0", hair="crop", hairColor="b8b2a8", glow="b6ff8a",
         glowLevel=0.3, wearLevel=0.7, wear=[("jerkin", "2a2a28"), ("cloak_hooded", "6a6a64"), ("bandolier", "4a3a28"), ("canvas_trousers", "8a7458"), ("wrapped_boots", "3a2a1c")]),
    dict(id="v_cont", era="2196", macro=mix(M, age=0.55, muscle=0.7, height=0.62, caucasian=0.5, asian=0.5, african=0.0), skin="d8a888", hair="fade", hairColor="141010",
         glow="ffd27a", wear=[("continuum_suit", "202328"), ("suit_trousers", "202328"), ("service_boots", "202328"), ("gloves", "202328"), ("continuum_helmet", "e6e8ea")]),
    dict(id="v_cofc", era="2196", macro=mix(F, age=0.58, muscle=0.6, caucasian=0.5, asian=0.5, african=0.0), skin="e8c0a0", hair="bun", hairColor="141010", glow="ffd27a",
         wear=[("continuum_suit", "202328"), ("suit_trousers", "202328"), ("service_boots", "202328"), ("half_cape", "2a2c30"), ("continuum_helmet_officer", "e6e8ea")]),
    dict(id="v_tala", era="ancient", macro=mix(F, age=0.62, muscle=0.55, african=1.0, caucasian=0.0, asian=0.0), skin="7d4f33", hair="bun", hairColor="141010",
         wear=[("tunic", "3f6a6a", dict(sleeve="elbow", tail=dict(end=0.17, flare=0.2, slits=0.14), c2="d0a24a")), ("mantle_wrap", "d9c9a0"), ("sash", "d0a24a"),
               ("leg_wraps", "5a4632"), ("sandals", "4a3220")]),
    dict(id="v_sentry", era="ancient", macro=mix(M, age=0.5, muscle=0.7, african=0.8, caucasian=0.2, asian=0.0), skin="6b4029", hair="locs", hairColor="141010",
         wear=[("tunic", "b4884e", dict(sleeve="none")), ("leather_cuirass", "5a3e28"), ("forearm_guards", "4a3220", dict(fab="hard_leather")), ("cord_belt", "9b3b24"),
               ("leg_wraps", "5a4632"), ("sandals", "4a3220"), ("woven_headband", "9b3b24")]),
    dict(id="v_elder", era="ancient", macro=mix(F, age=0.86, muscle=0.35, african=1.0, caucasian=0.0, asian=0.0), skin="6b4029", hair="bun", hairColor="d6d0c6",
         wear=[("tunic", "5a2a4a", dict(tail=dict(end=0.07, flare=0.15, slits=0.25))), ("leather_hipwrap", "5a3e28"), ("sandals", "4a3220"), ("head_wrap", "d9c9a0")]),
    dict(id="v_hood", era="2049", macro=mix(M, age=0.6, african=0.2, caucasian=0.8, asian=0.0), skin="c89a7a", hair="short", hairColor="2a1f19",
         wear=[("knit_sweater", "262c32"), ("techshell", "2a3038"), ("hood_up", None), ("cargo_trousers", "1c2026"), ("tech_boots", "141210"),
               ("forearm_guards", "22262c")]),
]
import os as _os
if _os.environ.get("TEST_ALL"):
    CAST = CAST + COVERAGE

for _c in CAST:
    _m = _c["macro"]
    _m.setdefault("proportions", 0.62 if _m.get("age", 0.5) < 0.25 else 0.72)
    _c["details"] = {k: max(-0.4, min(0.4, v * 0.8)) for k, v in _c.get("details", {}).items()}
