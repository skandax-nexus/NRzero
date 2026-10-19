"""The AfterZero cast: every character is a parameter set for build_characters.py (no external models).

Fields: id, height (m), fem (0 masc .. 1 fem build), build (width), child (0..1), headScale,
skin / colorA (top) / colorB (bottom) / hairColor / trimColor (boots, belts) / accentColor (scarf, apron) / metalColor,
top: coat | jacket | robe | dress | sweater | uniform | vest | shirt,   bottom: trousers | skirt | longskirt,
sleeve: long | mid | short, hair: short | crop | swept | bob | long | bun | braid | pony | none,
facial: mustache | beard | fullbeard, hat: cap | fedora | tophat | warden | hood | headscarf,
acc: scarf, satchel, belt, apron, buttons, glasses, mask, lapels;  face: {jaw, nose, cheek, brow} in 0..1,
eyes (iris colour), lip, stubble, boots (shaft height / H), tris (budget).
Townsfolk ("town_*") are tinted per person at runtime (skin / clothA / clothB), named characters keep their colours.
"""


def c(hexstr):
    """sRGB hex -> linear tuple (Blender and glTF colours are linear)."""
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        v = int(h[i:i + 2], 16) / 255
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return tuple(out)


SKIN = {"pale": c("f1d3bf"), "fair": c("e6b998"), "warm": c("c98e68"), "olive": c("b07d55"), "brown": c("8a5a3c"), "deep": c("5e3b28")}
HAIR = {"black": c("1a1512"), "dark": c("2e2119"), "brown": c("5a3a24"), "auburn": c("7a3a1e"), "blond": c("b08850"), "grey": c("8a8580"), "white": c("cfcac2")}

REF = dict(id="rig", height=1.75)

CAST = [
    # ---- the player ----
    dict(id="arin", height=1.74, fem=0.45, build=0.95, skin=SKIN["warm"], top="coat", bottom="trousers", colorA=c("37525a"), colorB=c("23262b"),
         accentColor=c("b0472c"), trimColor=c("2a1d16"), hair="swept", hairColor=HAIR["dark"], acc=["scarf"], eyes=c("6a8c7a"),
         face=dict(jaw=0.45, nose=0.5, cheek=0.6, brow=0.4), tris=11000),
    # ---- named characters ----
    dict(id="pell", height=1.78, fem=0.0, build=1.05, skin=SKIN["fair"], top="jacket", bottom="trousers", colorA=c("4a3a5c"), colorB=c("2d2a26"),
         hat="cap", hatMat="clothA", hair="short", hairColor=HAIR["brown"], facial="mustache", acc=["satchel"], trimColor=c("5a3820"), stubble=0.6,
         face=dict(jaw=0.7, nose=0.6, brow=0.6)),
    dict(id="lise", height=1.2, child=1.0, fem=1.0, build=0.9, headScale=1.12, skin=SKIN["fair"], top="dress", colorA=c("8a3a3a"), colorB=c("8a3a3a"),
         hair="braid", hairColor=HAIR["auburn"], acc=["apron"], accentColor=c("e8e0d0"), boots=0.06, face=dict(jaw=0.2, nose=0.3, cheek=0.4)),
    dict(id="mirela", height=1.66, fem=1.0, build=1.12, skin=SKIN["olive"], top="sweater", bottom="longskirt", colorA=c("9a6a2a"), colorB=c("4a2c2a"),
         hat="headscarf", hatMat="accent", accentColor=c("2a6a6a"), hair="bun", hairColor=HAIR["dark"], acc=["apron"], face=dict(jaw=0.4, cheek=0.7)),
    dict(id="hale", height=1.82, fem=0.0, build=1.18, skin=SKIN["olive"], top="vest", sleeve="mid", bottom="trousers", colorA=c("5a4a32"), colorB=c("33302c"),
         hair="crop", hairColor=HAIR["black"], facial="fullbeard", acc=["belt"], face=dict(jaw=0.8, nose=0.7, brow=0.7)),
    dict(id="vossel", height=1.7, fem=0.9, build=0.95, skin=SKIN["pale"], top="robe", colorA=c("4e5058"), colorB=c("4e5058"), hat="hood", hatMat="clothA",
         hair="none", acc=["belt"], trimColor=c("6a5030"), face=dict(jaw=0.3, nose=0.6, cheek=0.6)),
    dict(id="calder", height=1.84, fem=0.0, build=1.0, skin=SKIN["brown"], top="robe", colorA=c("4e5058"), colorB=c("4e5058"), hat="hood", hatMat="clothA",
         hair="crop", hairColor=HAIR["black"], facial="beard", hairColorBeard=HAIR["grey"], acc=["belt"], trimColor=c("6a5030")),
    dict(id="ondine", height=1.68, fem=1.0, build=1.0, skin=SKIN["fair"], top="dress", sleeve="long", colorA=c("1e1a24"), colorB=c("1e1a24"),
         hair="bun", hairColor=HAIR["grey"], acc=["buttons"], metalColor=c("c0a060"), face=dict(jaw=0.5, nose=0.65, cheek=0.75, brow=0.5)),
    dict(id="aurel", height=1.8, fem=0.0, build=0.95, skin=SKIN["pale"], top="coat", bottom="trousers", colorA=c("1c1c22"), colorB=c("2a2a30"),
         hat="tophat", hatMat="trim", trimColor=c("101014"), hair="short", hairColor=HAIR["white"], facial="fullbeard", metalColor=c("d0b070"),
         face=dict(jaw=0.6, nose=0.75, brow=0.7)),
    dict(id="odile", height=1.64, fem=1.0, build=0.92, skin=SKIN["pale"], top="sweater", bottom="skirt", colorA=c("6a7a5a"), colorB=c("3a3a44"),
         hair="bun", hairColor=HAIR["auburn"], acc=["glasses"], metalColor=c("b09060"), face=dict(jaw=0.3, nose=0.55)),
    dict(id="ilse", height=1.67, fem=1.0, build=1.0, skin=SKIN["fair"], top="jacket", bottom="longskirt", colorA=c("6a4a30"), colorB=c("3a2c24"),
         hair="braid", hairColor=HAIR["grey"], acc=["apron", "glasses"], accentColor=c("7a5a3a"), metalColor=c("c0a060"), face=dict(cheek=0.6, nose=0.5)),
    dict(id="ignatz", height=1.72, fem=0.0, build=0.9, skin=SKIN["fair"], top="vest", sleeve="long", bottom="trousers", colorA=c("3a3028"), colorB=c("2a2420"),
         hair="short", hairColor=HAIR["grey"], facial="mustache", acc=["glasses", "apron"], accentColor=c("6a4a2a")),
    dict(id="maren", height=1.12, child=1.0, fem=1.0, build=0.85, headScale=1.15, skin=SKIN["brown"], top="dress", colorA=c("3a5a8a"), colorB=c("3a5a8a"),
         hair="pony", hairColor=HAIR["black"], acc=["scarf"], accentColor=c("e0c060"), boots=0.06, face=dict(jaw=0.2, nose=0.3)),
    dict(id="edda", height=1.65, fem=1.0, build=1.0, skin=SKIN["brown"], top="coat", bottom="longskirt", colorA=c("4a5a6a"), colorB=c("2a2a30"),
         hair="long", hairColor=HAIR["black"], acc=["scarf"], accentColor=c("c0a050")),
    dict(id="witness", height=1.7, fem=0.95, build=0.92, skin=SKIN["brown"], top="robe", colorA=c("1a2030"), colorB=c("1a2030"), hat="hood", hatMat="clothA",
         hair="long", hairColor=HAIR["black"], acc=["scarf"], accentColor=c("40d0e0"), trimColor=c("40d0e0"), metalColor=c("60e0ff")),
    dict(id="wren", height=1.18, child=1.0, fem=0.2, build=0.9, headScale=1.12, skin=SKIN["warm"], top="sweater", bottom="trousers", colorA=c("8a6a2a"), colorB=c("3a3a44"),
         hat="cap", hatMat="clothB", hair="short", hairColor=HAIR["brown"], boots=0.07),
    dict(id="roe", height=1.79, fem=0.6, build=1.05, skin=SKIN["deep"], top="uniform", bottom="trousers", colorA=c("2a3448"), colorB=c("1e2230"),
         hat="warden", hatMat="clothA", hair="crop", hairColor=HAIR["black"], metalColor=c("d0a848"), boots=0.2, face=dict(jaw=0.6, cheek=0.7)),
    dict(id="sefa", height=1.76, fem=0.0, build=1.0, skin=SKIN["deep"], top="uniform", bottom="trousers", colorA=c("5a2a30"), colorB=c("26222a"),
         hat="warden", hatMat="clothA", hair="crop", hairColor=HAIR["black"], facial="beard", metalColor=c("c8a040")),
    dict(id="oriel", height=1.6, fem=1.0, build=1.1, skin=SKIN["warm"], top="dress", colorA=c("5a6a7a"), colorB=c("5a6a7a"), hat="headscarf", hatMat="accent",
         accentColor=c("e8e4dc"), hair="bun", hairColor=HAIR["brown"], acc=["apron"]),
    # ---- Keepers (the order that enforces the loop) ----
    dict(id="keeper", height=1.86, fem=0.2, build=1.1, skin=SKIN["pale"], top="robe", colorA=c("15141a"), colorB=c("15141a"), hat="hood", hatMat="clothA",
         hair="none", acc=["mask", "belt"], metalColor=c("3a3530"), glowColor=c("ffb050"), trimColor=c("3a2a18"), boots=0.2),
    dict(id="keeper_b", height=1.8, fem=0.6, build=1.0, skin=SKIN["pale"], top="robe", colorA=c("221a14"), colorB=c("221a14"), hat="hood", hatMat="clothA",
         hair="none", acc=["mask", "belt"], metalColor=c("4a4e56"), glowColor=c("ffb050"), trimColor=c("2a2018"), boots=0.2),
    # ---- townsfolk (tinted per person at runtime) ----
    dict(id="town_m1", height=1.78, fem=0.0, build=1.0, top="coat", bottom="trousers", hair="short", hat="fedora", hatMat="trim", facial="mustache", acc=["scarf"]),
    dict(id="town_m2", height=1.74, fem=0.0, build=1.15, top="vest", sleeve="mid", bottom="trousers", hair="crop", hat="cap", hatMat="clothB", acc=["belt"], stubble=0.7),
    dict(id="town_m3", height=1.83, fem=0.0, build=0.92, top="jacket", bottom="trousers", hair="swept", facial="beard", acc=["satchel"]),
    dict(id="town_m4", height=1.7, fem=0.0, build=1.05, top="sweater", bottom="trousers", hair="short", hat="cap", hatMat="trim", facial="fullbeard"),
    dict(id="town_m5", height=1.76, fem=0.0, build=1.0, top="shirt", sleeve="mid", bottom="trousers", hair="crop", acc=["apron"]),
    dict(id="town_f1", height=1.66, fem=1.0, build=1.0, top="coat", bottom="longskirt", hair="bun", hat="headscarf", hatMat="accent", acc=["scarf"]),
    dict(id="town_f2", height=1.62, fem=1.0, build=1.08, top="dress", hair="long", acc=["apron"]),
    dict(id="town_f3", height=1.7, fem=1.0, build=0.92, top="jacket", bottom="skirt", hair="bob", acc=["satchel"]),
    dict(id="town_f4", height=1.64, fem=1.0, build=1.0, top="sweater", bottom="trousers", hair="pony"),
    dict(id="town_f5", height=1.68, fem=1.0, build=0.96, top="coat", bottom="longskirt", hair="braid", hat="fedora", hatMat="trim"),
    dict(id="town_old", height=1.66, fem=0.2, build=0.92, top="coat", bottom="trousers", hair="short", hairColor=HAIR["white"], facial="beard", acc=["scarf", "glasses"]),
    dict(id="town_kid", height=1.15, child=1.0, fem=0.5, build=0.9, headScale=1.12, top="sweater", bottom="trousers", hair="crop", boots=0.06),
]

# townsfolk default to neutral cloth (runtime tint) — give hair colour / skin variety at build time
_hair = [HAIR["dark"], HAIR["brown"], HAIR["black"], HAIR["auburn"], HAIR["blond"], HAIR["grey"]]
for i, ch in enumerate(CAST):
    if ch["id"].startswith("town_"):
        ch.setdefault("hairColor", _hair[i % len(_hair)])
        ch.setdefault("colorA", (0.8, 0.8, 0.8))
        ch.setdefault("colorB", (0.8, 0.8, 0.8))
        ch.setdefault("skin", SKIN["warm"])
        ch["townsfolk"] = True
