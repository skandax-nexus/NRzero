# Face overrides (docs/CHARACTER_LOOK.md, "Faces")

`<id>.json` in this folder overrides the face of cast entry `<id>` in `cast_nrzero.py` (merged at import, after the
entry's own details are softened). No file: the entry builds exactly as before. `FACES_DIR=/other/folder` reads a
candidate set instead (its solved heights go to `/other/folder/_heights.json`), `FACES_DIR=none` ignores overrides.

```json
{
  "notes": "free text",
  "replace_details": true,
  "details": {"chin/chin-prominent-decr|incr": 0.45, "eyes/l-eye-trans-in|out": -0.25, "eyes/r-eye-trans-in|out": -0.25},
  "macro": {"muscle": 0.62, "caucasian": 0.45, "african": 0.15, "asian": 0.40},
  "skin": "b07a58", "lip": "9a5a4c", "eyes": "3a2a1c", "browThick": 0.8, "stubble": 0.85, "beard": null,
  "hair": "waves", "hairColor": "141110"
}
```

- `details`: final MakeHuman detail values (not softened), merged over the entry's softened details; `replace_details`
  drops the entry's own details first. Names: `mh.list_modifiers()`; left / right pairs go in together.
- `macro`: face-relevant macro terms only (`proportions muscle weight caucasian african asian`; the ancestry mix is
  renormalised). Sex, age and height stay the entry's (height is re-solved for `metres`).
- look keys: `skin lip eyes irisR pupilR browColor browLift browThick stubble beard beardColor blush freckles scars
  hair hairLen hairColor hairDrop locs locLen hairPart lashLen`; `null` unsets one.
- `hair` picks a cut from the library (`look2.CUTS`, docs/CHARACTER_LOOK.md "Faces: hero pipeline"): `crop`
  (textured crop), `fade` (skin fade, textured top), `quiff` (modern quiff), `sideswept`, `swept` / `slick`
  (swept-back), `tousled` (tousled medium), `short`, `undercut`, `waves`, `pixie`, `bob`, `long`, `pony`, `bun`,
  `braid` / `braids`, `curls`, `puffs`, `locs`. `hairPart`: `left` / `right` (side-swept cuts and parts);
  `lashLen`: lash length factor (1 = default; women get 1.15 on top).
- hero cuts (proto:makehuman, the lead's looks): `lead_quiff` (textured modern quiff, faded sides), `lead_crop` (short
  textured crop, fringe pushed up, faded sides), `lead_part` (side part swept across and back, scissor-tapered sides;
  `hairPart` picks the side). The cut is a sculpted volume (`look2.hero_T`): its inner half is the shell, its outer
  half layered strand cards that stay inside the envelope (no card leaves it: no spikes). `HERO_HAIR=0` builds them
  with the plain cut cards.
- `skinSmooth` (0..1): finer painted pores for clear, even skin (the leads); `beard` under 0.5 is painted only (a
  groomed short beard with a crisp cheek line and moustache, no cards); 0.5 and over adds beard cards.

Check a set before it ships:

    FACES_DIR=... MH_DATA=... ../../../tools/venv/bin/python face_metric.py OUT     # distinctness + proportions
    ONLY=kai,mira FACES_DIR=... ./face_studio.sh NAME                               # build, pack, portraits
- photo likeness (docs/CHARACTER_LOOK.md "Faces: photo likeness"): `likeness` (the look data `.npz` that
  `likeness/look_data.py` writes, relative to the face file), `likenessScale`, `skinExact` (the skin hex as measured, no
  natural-skin clamp), `lipScale` ([upper, lower] painted lip heights), `greyStrands` (a few grey hairs), `extends` (a
  variant: another face file's keys first). Cuts `photo_tied` / `photo_loose`: curly ringlet cards (`look2._curl_cards`).
  Since likeness:final also `underEye` / `lidShade` (painted under-eye and upper-lid shade strength), `faintSpots`
  (faint-spot strength), `tzoneGloss` (the T-zone's gloss factor, 1 = default) and `skinMatte` (added face roughness).
- Kai (docs/CHARACTER_LOOK.md "Kai's face (from the owner's photo)"): `kai.json` + `kai_look.npz` here are hair A
  (tied, as in the photo); `cp ../faces_candidates/kai_photo_B/* .` switches to hair B (loose, messy medium length).

- Fix round 1 (docs/CHARACTER_LOOK.md "Kai's face", "Fix round 1"): `browShape` ({flat, rise, tail, tailThin, head,
  thick}: the measured brow reshaped for the painted brow and the brow cards alike), `irisWarm` / `irisGain`,
  `underEyeDesat`, `lipEdge` / `lipLines` / `lipGloss` / `lipParted` / `upperLipDark`, `beardPaint` / `beardDark` /
  `beardWarm` / `moHang` (the painted beard mat and the moustache over the upper lip), `noseMatte`, `foreheadShade`,
  `moleSoft`, `hairline` ({centre, temple} m: a rounded front hairline), and two run-time values written into the
  build's look metadata for `src/human/skin.js`: `skinScatter` (the skin's scatter tint, 1 = default) and `lipRough`.
- Fix round 2 (docs/CHARACTER_LOOK.md "Kai's face", "Fix round 2"): `moHangCorner` (the moustache's hang at the mouth
  corners), `beardCardGain` / `moPaintDark` (lighter beard cards over a darker moustache mat), `sideburnTop` (mm: the
  sideburn's top), `sclera` (hex), `caruncle`, `lashWing` / `lashLowerOut` / `lashLenLower` (no outer wing; lower lashes
  rooted outside the eye), `browCards` / `browHairW` / `browBase` / `browEdge` / `browCardGain` / `browPaintGain` (the
  brow as one dense, soft bar; `browShape.latDrop` mm), `underEyeBlur` / `underEyeLift`, `lidHood` (the hooded lid's
  shade), `lipLower` (hex: the lower lip's rose centre) / `lipAsym`, `moleTweak` ([index, dx, dy mm, size, strength]),
  `bridgeMatte`, `alarSoften` (smoothing passes over the nose wings' crease), `foreheadRamp` ([mm, mm]; `foreheadShade`
  is now the tone's exponent), `hairline.arch` ([azimuth deg, height m] pairs: the front hairline as measured).
