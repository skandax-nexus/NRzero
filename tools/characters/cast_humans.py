"""The AfterZero cast, designed on the MakeHuman body (see build_humans.py). All values are ours.

macro: gender (0 woman .. 1 man), age (0.1875 = 11 y, 0.5 = 25 y, 1 = 90 y), muscle, weight, height, proportions,
       african / asian / caucasian (ancestry mix, normalised).
details: MakeHuman modifiers 'group/name' -> -1..1 (see mh.list_modifiers()); sym() mirrors l-/r- pairs.
Look: skin (sRGB hex), lip, eyes (iris), hairColor, browColor, hair (crop/short/swept/bob/long/bun/braid/pony/none),
browThick 0..1, browLift (m), irisR / pupilR (eye disc fractions), shirtColor,
stubble 0..1, blush; clothing: top (coat/jacket/robe/dress/sweater/uniform/vest/shirt), bottom (trousers/skirt/
longskirt), sleeve, colorA/colorB/shoeColor/accentColor/trimColor/metalColor (hex), hat, acc, boots, tris (default by
role: arin 16000, named 11000, townsfolk and children 9000), res (atlas size; arin 2048, others 1024).
Faces are kept pleasant and believable: every body leans toward MakeHuman's "ideal" proportions (see the end of the
file) and detail modifiers are softened, so character comes from the mix of features rather than extremes.
"""


def sym(**kw):
    """sym(eye_bag=-0.3) -> {'eyes/l-eye-bag-decr|incr': -0.3, 'eyes/r-eye-bag-decr|incr': -0.3}"""
    groups = {"eye": "eyes", "ear": "ears", "cheek": "cheek"}
    out = {}
    for k, v in kw.items():
        part, rest = k.split("_", 1)
        name = rest.replace("_", "-")
        for side in "lr":
            key = None
            for suffix in ("decr|incr", "in|out", "down|up", "backward|forward", "concave|convex", "pointed|triangle", "square|round"):
                cand = f"{groups[part]}/{side}-{part}-{name}-{suffix}"
                key = cand
                if _exists(cand):
                    break
            out[key] = v
    return out


def _exists(k):
    import mh
    return k in mh.modifier_table()


CAST = [
    # ---- the player: Arin Vale, late twenties, a winter coat in the wrong season ----
    dict(id="arin", macro=dict(gender=0.5, age=0.53, muscle=0.55, weight=0.42, height=0.55, african=0.25, asian=0.25, caucasian=0.5),
         details={"nose/nose-scale-horiz-decr|incr": -0.2, "chin/chin-prominent-decr|incr": 0.2, "head/head-oval": 0.5, "eyebrows/eyebrows-trans-down|up": -0.2,
                  **sym(cheek_bones=0.3)},
         skin="c8916c", lip="a56258", eyes="4f6b58", hair="swept", hairColor="2a1f19", top="coat", bottom="trousers",
         colorA="2f4a4f", colorB="23252a", shoeColor="2a1d16", accentColor="9a3a24", acc=["scarf"]),
    # ---- Pell Ashgrove, the courier who notices Arin "again" ----
    dict(id="pell", macro=dict(gender=1.0, age=0.68, muscle=0.5, weight=0.6, height=0.55, caucasian=1, african=0, asian=0),
         details={"nose/nose-scale-vert-decr|incr": 0.3, "nose/nose-hump-decr|incr": 0.4, "chin/chin-width-decr|incr": 0.3, "head/head-square": 0.4, **sym(eye_bag=0.4)},
         skin="dfae8e", lip="a8706a", eyes="5a6a78", hair="short", hairColor="5a3a24", stubble=0.5, top="jacket", bottom="trousers",
         colorA="4a3a5c", colorB="2d2a26", hat="cap", hatMat="clothA", acc=["satchel"], trimColor="5a3820"),
    dict(id="lise", macro=dict(gender=0.0, age=0.18, muscle=0.5, weight=0.45, height=0.5, caucasian=1, african=0, asian=0),
         skin="e9c0a3", lip="c27a72", eyes="5a7a5a", hair="braid", hairColor="7a3a1e", top="dress", colorA="8a3a3a", colorB="8a3a3a",
         acc=["apron"], accentColor="e8e0d0", boots=0.05),
    dict(id="mirela", macro=dict(gender=0.0, age=0.62, muscle=0.45, weight=0.65, height=0.42, caucasian=0.6, asian=0.0, african=0.4),
         details={"nose/nose-scale-horiz-decr|incr": 0.2, "mouth/mouth-scale-horiz-decr|incr": 0.2, "head/head-round": 0.4, **sym(cheek_volume=0.3)},
         skin="b88560", lip="9c5a50", eyes="3a2a1c", hair="bun", hairColor="1e1712", top="sweater", bottom="longskirt",
         colorA="9a6a2a", colorB="4a2c2a", hat="headscarf", hatMat="accent", accentColor="2a6a6a", acc=["apron"]),
    dict(id="hale", macro=dict(gender=1.0, age=0.6, muscle=0.75, weight=0.7, height=0.7, caucasian=0.6, african=0.4, asian=0),
         details={"chin/chin-width-decr|incr": 0.5, "head/head-square": 0.6, "nose/nose-scale-horiz-decr|incr": 0.3, "neck/neck-scale-horiz-decr|incr": 0.4},
         skin="b07d58", eyes="3a2a1c", hair="crop", hairColor="1a1512", stubble=0.9, top="vest", bottom="trousers", colorA="5a4a32", colorB="33302c", acc=["belt"]),
    dict(id="vossel", macro=dict(gender=0.0, age=0.7, muscle=0.4, weight=0.45, height=0.6, caucasian=1, african=0, asian=0),
         details={"nose/nose-scale-vert-decr|incr": 0.3, "head/head-oval": 0.5, "mouth/mouth-scale-horiz-decr|incr": -0.3, **sym(cheek_bones=0.5)},
         skin="e8c4ac", lip="9a6a64", eyes="6a7a86", hair="none", top="robe", colorA="4e5058", colorB="4e5058", hat="hood", hatMat="clothA", acc=["belt"], trimColor="6a5030"),
    dict(id="calder", macro=dict(gender=1.0, age=0.6, muscle=0.55, weight=0.5, height=0.75, african=0.8, caucasian=0.2, asian=0),
         details={"head/head-oval": 0.4, "chin/chin-prominent-decr|incr": 0.3},
         skin="7a4e34", eyes="2a1c12", hair="crop", hairColor="141010", stubble=0.8, top="robe", colorA="4e5058", colorB="4e5058", hat="hood", hatMat="clothA",
         acc=["belt"], trimColor="6a5030"),
    dict(id="ondine", macro=dict(gender=0.0, age=0.85, muscle=0.35, weight=0.55, height=0.5, caucasian=1, african=0, asian=0),
         details={"nose/nose-scale-vert-decr|incr": 0.3, "nose/nose-hump-decr|incr": 0.3, "head/head-rectangular": 0.3, **sym(eye_bag=0.5)},
         skin="e6c2aa", lip="94605a", eyes="4a5a68", hair="bun", hairColor="b8b2a8", top="dress", colorA="1e1a24", colorB="1e1a24", acc=["buttons"], metalColor="c0a060"),
    dict(id="aurel", macro=dict(gender=1.0, age=0.92, muscle=0.35, weight=0.45, height=0.6, caucasian=1, african=0, asian=0),
         details={"nose/nose-scale-vert-decr|incr": 0.4, "nose/nose-greek-decr|incr": 0.3, "chin/chin-prominent-decr|incr": 0.3, "head/head-rectangular": 0.5,
                  "eyebrows/eyebrows-angle-down|up": -0.3, **sym(eye_bag=0.6)},
         skin="e3bba3", lip="a0726a", eyes="6a7a86", hair="short", hairColor="d6d0c6", browColor="bdb6aa", stubble=0.6, top="coat", bottom="trousers",
         colorA="1c1c22", colorB="2a2a30", hat="tophat", hatMat="trim", trimColor="101014", metalColor="d0b070"),
    dict(id="odile", macro=dict(gender=0.0, age=0.58, muscle=0.4, weight=0.4, height=0.48, caucasian=0.7, asian=0.3, african=0),
         details={"head/head-oval": 0.5, "nose/nose-scale-horiz-decr|incr": -0.3, "mouth/mouth-scale-horiz-decr|incr": -0.2},
         skin="eac6ad", lip="a8706a", eyes="4a3a2c", hair="bun", hairColor="7a3a1e", top="sweater", bottom="skirt", colorA="6a7a5a", colorB="3a3a44",
         acc=["glasses"], metalColor="b09060"),
    dict(id="ilse", macro=dict(gender=0.0, age=0.75, muscle=0.5, weight=0.5, height=0.5, caucasian=1, african=0, asian=0),
         details={"head/head-round": 0.3, **sym(cheek_volume=0.2, eye_bag=0.3)},
         skin="e4bc9f", lip="9a6460", eyes="5a6a50", hair="braid", hairColor="9a948c", top="jacket", bottom="longskirt", colorA="6a4a30", colorB="3a2c24",
         acc=["apron", "glasses"], accentColor="7a5a3a", metalColor="c0a060"),
    dict(id="ignatz", macro=dict(gender=1.0, age=0.8, muscle=0.4, weight=0.4, height=0.45, caucasian=1, african=0, asian=0),
         details={"nose/nose-scale-vert-decr|incr": 0.5, "head/head-triangular": 0.4, **sym(ear_scale=0.3)},
         skin="dcb294", eyes="4a5a68", hair="short", hairColor="a8a29a", stubble=0.4, top="vest", bottom="trousers", colorA="3a3028", colorB="2a2420",
         acc=["glasses", "apron"], accentColor="6a4a2a"),
    dict(id="maren", macro=dict(gender=0.0, age=0.16, muscle=0.5, weight=0.45, height=0.45, african=0.7, caucasian=0.3, asian=0),
         skin="8a5a3c", lip="7a4a40", eyes="2a1a10", hair="pony", hairColor="141010", top="dress", colorA="3a5a8a", colorB="3a5a8a",
         acc=["scarf"], accentColor="e0c060", boots=0.05),
    dict(id="edda", macro=dict(gender=0.0, age=0.6, muscle=0.5, weight=0.5, height=0.5, african=0.7, caucasian=0.3, asian=0),
         details={"head/head-oval": 0.4, **sym(cheek_bones=0.4)},
         skin="8f5f40", lip="7a4a42", eyes="2a1a10", hair="long", hairColor="141010", top="coat", bottom="longskirt", colorA="4a5a6a", colorB="2a2a30",
         acc=["scarf"], accentColor="c0a050"),
    dict(id="witness", macro=dict(gender=0.0, age=0.55, muscle=0.55, weight=0.4, height=0.62, african=0.6, caucasian=0.4, asian=0),
         details={"head/head-oval": 0.6, **sym(cheek_bones=0.5)},
         skin="905f40", lip="7a4a42", eyes="7ab8c8", hair="long", hairColor="141010", top="robe", colorA="1a2030", colorB="1a2030", hat="hood", hatMat="clothA",
         acc=["scarf"], accentColor="40d0e0", trimColor="40d0e0", metalColor="60e0ff"),
    dict(id="wren", macro=dict(gender=0.8, age=0.17, muscle=0.5, weight=0.45, height=0.45, caucasian=0.5, asian=0.5, african=0),
         skin="d8a888", eyes="3a2a1c", hair="short", hairColor="3a2a1c", top="sweater", bottom="trousers", colorA="8a6a2a", colorB="3a3a44",
         hat="cap", hatMat="clothB", boots=0.05),
    dict(id="roe", macro=dict(gender=0.3, age=0.6, muscle=0.7, weight=0.5, height=0.7, african=1, caucasian=0, asian=0),
         details={"head/head-oval": 0.3, "chin/chin-prominent-decr|incr": 0.4},
         skin="5e3b28", lip="5a3a32", eyes="1a1008", hair="crop", hairColor="141010", top="uniform", bottom="trousers", colorA="2a3448", colorB="1e2230",
         hat="warden", hatMat="clothA", metalColor="d0a848", boots=0.2),
    dict(id="sefa", macro=dict(gender=1.0, age=0.55, muscle=0.6, weight=0.55, height=0.6, african=0.9, asian=0.1, caucasian=0),
         details={"head/head-square": 0.3, "nose/nose-scale-horiz-decr|incr": 0.3},
         skin="6a4430", eyes="1a1008", hair="crop", hairColor="141010", stubble=1.0, top="uniform", bottom="trousers", colorA="5a2a30", colorB="26222a",
         hat="warden", hatMat="clothA", metalColor="c8a040"),
    dict(id="oriel", macro=dict(gender=0.0, age=0.7, muscle=0.4, weight=0.7, height=0.4, caucasian=0.8, asian=0.2, african=0),
         details={"head/head-round": 0.6, **sym(cheek_volume=0.4)},
         skin="dcae90", lip="a06a62", eyes="4a3a2c", hair="bun", hairColor="5a3a24", top="dress", colorA="5a6a7a", colorB="5a6a7a", hat="headscarf", hatMat="accent",
         accentColor="e8e4dc", acc=["apron"]),
    # ---- Keepers ----
    dict(id="keeper", macro=dict(gender=0.85, age=0.55, muscle=0.75, weight=0.5, height=0.8, caucasian=0.5, african=0.25, asian=0.25),
         details={"eyebrows/eyebrows-angle-down|up": -0.6, "eyebrows/eyebrows-trans-down|up": -0.4, "chin/chin-prominent-decr|incr": 0.4, "head/head-square": 0.5, **sym(cheek_bones=0.4)},
         stubble=0.7, eyes="3a3028", lip="8a5a50",
         skin="c09070", hair="none", top="robe", colorA="15141a", colorB="15141a", hat="hood", hatMat="clothA", acc=["belt"],
         metalColor="3a3530", trimColor="3a2a18", boots=0.2),
    dict(id="keeper_b", macro=dict(gender=0.4, age=0.5, muscle=0.6, weight=0.45, height=0.65, caucasian=0.4, african=0.3, asian=0.3),
         details={"eyebrows/eyebrows-angle-down|up": -0.5, "head/head-oval": 0.4, "mouth/mouth-scale-horiz-decr|incr": -0.2, **sym(cheek_bones=0.5)},
         eyes="2a2018", lip="8a5a50",
         skin="b08060", hair="none", top="robe", colorA="221a14", colorB="221a14", hat="hood", hatMat="clothA", acc=["belt"],
         metalColor="4a4e56", trimColor="2a2018", boots=0.2),
    # ---- townsfolk ----
    dict(id="town_m1", macro=dict(gender=1.0, age=0.6, muscle=0.5, weight=0.55, height=0.55, caucasian=0.8, african=0.2, asian=0),
         details={"head/head-rectangular": 0.4}, skin="d8a888", hair="short", hairColor="3a2a1c", stubble=0.6, top="coat", bottom="trousers",
         colorA="3a4a3a", colorB="2a2620", hat="fedora", hatMat="trim", acc=["scarf"], accentColor="7a6a5a"),
    dict(id="town_m2", macro=dict(gender=1.0, age=0.45, muscle=0.7, weight=0.7, height=0.5, african=0.6, caucasian=0.4, asian=0),
         skin="8a5a3c", hair="crop", hairColor="141010", stubble=0.8, top="vest", bottom="trousers", colorA="6a4a2a", colorB="2c2c30", hat="cap", hatMat="clothB", acc=["belt"]),
    dict(id="town_m3", macro=dict(gender=1.0, age=0.5, muscle=0.45, weight=0.4, height=0.7, asian=0.8, caucasian=0.2, african=0),
         skin="d2a47e", hair="swept", hairColor="141010", top="jacket", bottom="trousers", colorA="2f3b57", colorB="23262b", acc=["satchel"]),
    dict(id="town_m4", macro=dict(gender=1.0, age=0.7, muscle=0.5, weight=0.75, height=0.45, caucasian=1, african=0, asian=0),
         skin="e2b496", hair="short", hairColor="7a5a3a", stubble=1.0, top="sweater", bottom="trousers", colorA="6a2430", colorB="33302c", hat="cap", hatMat="trim"),
    dict(id="town_m5", macro=dict(gender=1.0, age=0.4, muscle=0.6, weight=0.5, height=0.6, african=0.3, asian=0.3, caucasian=0.4),
         skin="b58a66", hair="crop", hairColor="2a1f19", top="shirt", bottom="trousers", colorA="c8c0b0", colorB="3a3a44", acc=["apron"], accentColor="5a4a3a"),
    dict(id="town_m6", macro=dict(gender=1.0, age=0.85, muscle=0.35, weight=0.5, height=0.45, caucasian=0.7, african=0.3, asian=0),
         skin="c89a7a", hair="short", hairColor="cfcac2", stubble=0.6, top="coat", bottom="trousers", colorA="54545c", colorB="2a2a30", acc=["scarf", "glasses"]),
    dict(id="town_f1", macro=dict(gender=0.0, age=0.55, muscle=0.45, weight=0.55, height=0.5, caucasian=0.8, asian=0.2, african=0),
         skin="e6b998", hair="bun", hairColor="5a3a24", top="coat", bottom="longskirt", colorA="6a2430", colorB="2a2420", hat="headscarf", hatMat="accent",
         accentColor="8a7a5a", acc=["scarf"]),
    dict(id="town_f2", macro=dict(gender=0.0, age=0.45, muscle=0.45, weight=0.6, height=0.45, african=0.7, caucasian=0.3, asian=0),
         skin="7a4e34", hair="long", hairColor="141010", top="dress", colorA="2a6464", colorB="2a6464", acc=["apron"], accentColor="d8d0c0"),
    dict(id="town_f3", macro=dict(gender=0.0, age=0.5, muscle=0.5, weight=0.4, height=0.65, asian=0.8, caucasian=0.2, african=0),
         skin="e0b090", hair="bob", hairColor="141010", top="jacket", bottom="skirt", colorA="5a6a7a", colorB="2a2a30", acc=["satchel"]),
    dict(id="town_f4", macro=dict(gender=0.0, age=0.35, muscle=0.5, weight=0.5, height=0.55, caucasian=0.6, african=0.2, asian=0.2),
         skin="d8a888", hair="pony", hairColor="b08850", top="sweater", bottom="trousers", colorA="8a7a5a", colorB="3a2a4a"),
    dict(id="town_f5", macro=dict(gender=0.0, age=0.8, muscle=0.4, weight=0.55, height=0.4, caucasian=1, african=0, asian=0),
         skin="e8c4ac", hair="bun", hairColor="b8b2a8", top="coat", bottom="longskirt", colorA="3a2a4a", colorB="2a2420", hat="fedora", hatMat="trim", acc=["glasses"]),
    dict(id="town_kid", macro=dict(gender=0.7, age=0.15, muscle=0.5, weight=0.45, height=0.5, caucasian=0.5, african=0.5, asian=0),
         skin="b58a66", hair="crop", hairColor="1e1712", top="sweater", bottom="trousers", colorA="9a6a2a", colorB="3a3a44", boots=0.05),
]


# ---- pleasant, believable faces: proportions toward 'ideal', no extreme detail modifiers ----
for _c in CAST:
    _m = _c["macro"]
    _m.setdefault("proportions", 0.62 if _m.get("age", 0.5) < 0.25 else 0.72)
    _c["details"] = {k: max(-0.4, min(0.4, v * 0.8)) if "eye-bag" not in k else max(-0.5, min(0.5, v * 0.8)) for k, v in _c.get("details", {}).items()}
