"""Costume pipeline test cast (CAST=test): one character per era family, built with `wear=[...]` (see garments.py).

    cd tools/characters && CAST=test MH_DATA=... venv/bin/python build_humans.py OUT_DIR
"""
from cast_humans import sym

CAST = [
    # ---- 2049 techwear man (Kai's kit, no gadgets): sealed shell, hood down, harness, tech trousers, tech boots ----
    dict(id="t_kai", era="2049", macro=dict(gender=1.0, age=0.554, muscle=0.62, weight=0.45, height=0.62, caucasian=0.45, african=0.15, asian=0.4),
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

for _c in CAST:
    _m = _c["macro"]
    _m.setdefault("proportions", 0.62 if _m.get("age", 0.5) < 0.25 else 0.72)
    _c["details"] = {k: max(-0.4, min(0.4, v * 0.8)) for k, v in _c.get("details", {}).items()}
