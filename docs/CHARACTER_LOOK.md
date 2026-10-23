# Character look: audit and plan

The owner's request: "character look and walking style, physics in game must be accurate not in difficult way".
This file covers the first part, **how the people look** in close-ups, mid shots and gameplay, in every era and on
both ends of the device range. Walking style and physics are in docs/MOTION.md. This is an audit only: no game code
was changed for it.

Owner rules that bind every item of the plan:
- The people are the owner's own figures, made by tools/characters (MakeHuman + Blender bpy, our code). We use no
  models, textures, scans or motion from the internet.
- `assets/models/anims.glb` is the owner's motion capture. Never overwrite it. Any new clips or face motion are
  authored by us (bpy keyframes, procedural, or derived from the existing clips) and stored in new files.
- Shared code stays backward compatible (`Character`, everything `cast3d.js` exports). Every look change can be
  switched off at run time with `?look=classic`.
- The low and medium phone tiers must not get noticeably slower.

## How this was measured

| what | tool | output (`$LOOK` = `/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/feel/look`) |
|---|---|---|
| studio close-up (head and shoulders), mid shot (head to hips, hands visible), full body, three-quarter view, the cast viewer's lights (RoomEnvironment 0.6, warm key, cool rim), idle clip at 0.7 s | `node tools/feel/look_studio.mjs <out> <ids> 640` | `$LOOK/studio/<id>_{head,mid,full}.png`, contact sheets `$LOOK/studio/sheet_{a,b,c,d}.png` |
| how faces react to the key light (front, side, behind) | `look_studio.mjs ... --light=front,side,back --shots=head,mid` | `$LOOK/studio_light/*.png`, sheet `$LOOK/studio_light/light_sheet.png` |
| idle over 4 s, a head shot every 0.25 s (blinks, eye and face motion) | `look_studio.mjs ... --shots=head --seq` | `$LOOK/studio_seq/<id>_seqNN.png`, `$LOOK/studio_seq/kai_seq_sheet.png` |
| in-game, the mission's own lighting, dialogue rig and depth of field exactly as `game.shot()` gives them | `node tools/feel/look_ingame.mjs tools/feel/look_scenes/mN.json <gfx> W H <out> [--mobile] [--measure]` | `$LOOK/game_high/<scene>_<subject>_<shot>.png` (gfx=high, 1280x720), `$LOOK/game_low/...` (gfx=low, 844x390, `--mobile`), `stats.jsonl` per folder; contact sheets `$LOOK/v_m1_sheet{1,2,3}.png`, `$LOOK/v_m3_sheet.png`, `$LOOK/v_m4_sheet.png`, `$LOOK/v_m2.png`, low `$LOOK/vl_m1_sheet.png`, `$LOOK/vl_m34.png` |
| hands close-up | `look_studio.mjs ... --shots=hand` | `$LOOK/studio_hand/hands_sheet.png` |
| per-character triangles, textures, draw calls | `node tools/feel/look_glbstats.cjs assets/models/cast.glb`, in-game `CAP.stats()` and an A/B frame with the person shown and hidden | numbers below |
| skin and normal-map detail | atlases pulled out of `cast.glb`: `$LOOK/atlas_<id>.png`, `$LOOK/atlas_<id>_n.png` | numbers below |
| likeness targets | `assets/cast/*_face.jpg` (the owner's art) | `$LOOK/refs_faces.png` |

In-game scenes (`tools/feel/look_scenes/`): **m1** Rain City 2049 at night, in the rain, at Officer Hale's dialogue
spot (Kai, Jun, the station child, Mira, the Witness, Hale, crowd `c49_f1`, `c49_m5`, `c49_kid_f`); **m3** the 2196
ruin (Sera, Continuum trooper and officer, survivor `surv_f1`, Kai); **m4** the ancient valley at sunset at Niko's spot
(villager, Niko, settlers `anc_f1`, `anc_m2`, `anc_kid_m`); **m2** the Helix interior (Iven, Rook). Each subject is
spawned with `game.actor` (Kai is the player), faces the camera direction and is shot after 12 settle frames. The idle
clip turns and leans the head, so some head shots sit off-centre; the full shots in m1 and m4 have street furniture
in front of the legs. Neither affects the findings.

The machine was shared with two other workflows and a render farm (load average 30-44), so the in-game frame times
measured here are not usable; draw calls and triangles are exact.

---

# Audit

## 1. What a person is today

At run time every person comes from `assets/models/cast.glb` (66 builds), not from the procedural humans in
`src/human/head.js`, `hair.js`, `body.js` (those are only the fallback when the cast file fails to load, or with
`?procedural`). `Character.build3d()` (src/core/character.js) clones a build with `makePerson()` (src/human/cast3d.js),
recolours its cloth slots and plays the retargeted motion capture.

| part | as shipped | consequence |
|---|---|---|
| mesh | **one skinned mesh per person**: body, face, eyes, lashes, hair, clothes and gadget bodies merged, simplified by meshoptimizer to the budget (Kai 16 000, named 11 000, crowd 9 000 + a 6 000 LOD index list) | the face competes with the coat for triangles |
| skeleton | **21 bones**: hips, spine, chest, clavicles, upper arms, forearms, hands, neck, head, thighs, shins, feet, toes. The generator maps every MakeHuman face bone (jaw, eyes, lids, tongue) to `head` and every finger and metacarpal to `hand_*` (`our_bone()`, tools/characters/build_humans.py) | no jaw, no eye rotation, no lids, no fingers |
| morph targets | **none** in the whole file | no blink, no mouth, no expression |
| material | **one** glTF MeshStandardMaterial (`<id>_atlas`): base colour atlas, normal atlas, emissive atlas, `roughnessFactor 0.82`, `doubleSided`, no roughness / AO / specular map. A per-vertex mask `azMask` (r skin, g gloss, b hair) drives `skinShade()` in cast3d.js | one shading model for skin, hair, eyes, cloth and metal |
| skin shading (`skinShade`) | wrapped diffuse (wrap 0.5 on skin, 0.25 on hair) with a warm terminator tint (1, 0.5, 0.36); roughness forced to **0.5 on all skin**, 0.62 on hair, 0.07 on "gloss" (eyes, leather, metal); and a **constant fill + fresnel rim added to the indirect diffuse of every pixel** (`shade.fill` 0.045-0.058, `shade.rim` 0.07-0.10) whatever the scene's light | see §3.2 |
| eyes | the MakeHuman cornea shell (decimated to 45 %), textured with a painted iris disc in the atlas cell grid, weighted 100 % to `head`, gloss mask. The disc has a **painted white catch-light** (`paint_cells`, build_humans.py) | eyes cannot look anywhere; the highlight sits in the same place under every light |
| lashes | the MakeHuman lash strip, shortened, one flat colour, opaque | a dark band, no fringe |
| hair | a **shell**: the scalp faces offset 1.5-9 mm (`SHELL`), painted with strand stripes; long styles add opaque ribbon sheets (`hair_sheet`), buns / puffs are tubes and spheres. No alpha, no cards | a helmet (§3.4) |
| mouth | painted lips on a closed mouth; no teeth, tongue or mouth interior | the mouth can never open |
| hands | MakeHuman hands with a relaxed curl baked into the rest mesh (`relax_hands`); no nails, knuckle creases or palm lines painted | fixed claw-like spread in every clip (§3.7) |
| textures | one atlas per person: Kai 2048² base + 2048² normal + 1024² emissive; named 1024² + 1024² + 512²; crowd 1024² + 512² + 512². WebP quality 70 (`compress_cast.sh`). Kai's whole 2048² base colour is **83 KB**, the normal 32 KB: there is almost no high-frequency detail to keep | |
| face motion | none. `talk` plays a body clip (`talk`); `lookTarget` turns neck + head bones (yaw only, clamped ±1 rad); the dialogue "lip-sync" (ui.js `onWord` → `character.talk`) only keeps that body clip playing | |
| idle | the mocap `idle` clip: **2.3 s loop**, the same for everyone (random phase, ±7 % rate per person); its feet slide 4.9 cm (anims.glb `az_clips` metadata) | |

## 2. Cost per person (both tiers)

From `cast.glb` (glbstats) and in game (`CAP.stats()`, `$LOOK/game_high/stats.jsonl`, `$LOOK/game_low/stats.jsonl`).

| who | triangles | draw calls (scene) | + shadow pass | textures (decoded, with mips) | low tier |
|---|---|---|---|---|---|
| Kai | 15 999 | 2 (atlas mesh + glow group) | +2 on high / medium (shadows off on low) | 2048² + 2048² + 1024² ≈ **48 MB** | the same 16 000 triangles and 2048² maps (no tier variant) |
| named NPC (Mira, Witness, Sera, Rook, Iven, Jun, Hale, villager ...) | 11 000 | 2 (+1 per visible hand prop) | +2 | 1024² + 1024² + 512² ≈ 12 MB | the same: named builds have no LOD mesh |
| child, crowd, Continuum, settlers | 9 000 | 1 (+1 per hand prop) | +1 | 1024² + 512² + 512² ≈ 7 MB | `look.lod` walkers switch to the 6 000 LOD beyond 14 m and always on `characterDetail: 'low'`; spawned actors do not |
| whole cast file | 66 builds | | | 180 images, 2.3 MB compressed, **≈ 620 MB if every atlas were decoded** (a mission decodes only the builds it uses) | |

Measured A/B in m1 at gfx=high (same view, the person shown / hidden): Kai +4 calls (195 / 191) and +32 000
triangles (409 385 / 377 383: the mesh twice, main pass and shadow map); Jun +3 calls and +21 900 triangles. Low tier:
see §3.12.

What this means for the plan: a person is already cheap in draw calls (1-2) and their triangle cost is dominated by
the body and clothes. Most of the look problems are **shading and texture content, not budget**: they can be fixed at
nearly constant cost. The expensive levers (more face triangles, hair cards, morph targets) are for the few people who
are ever seen up close: Kai and whoever is speaking.

## 3. Defects

Each item: what a viewer sees, where (image), the technical cause, and the evidence.

### 3.1 Skin: plastic, waxy, one tone

Seen: faces look like painted vinyl dolls. Every cheek, forehead and hand is one smooth tone; there are no pores,
no fine lines, no colour variation between the T-zone, cheeks, nose, ears, eyelids and lips beyond a faint blush;
the specular is one broad soft sheen everywhere. Older people (Rook 62, the Witness 58, the elders) have the same
baby-smooth skin as a 30-year-old. Darker skin tones (Sera, Niko, `c49_m5`'s neighbours, settlers) read better only
because the low-contrast flatness is less visible.
- `$LOOK/studio/kai_head.png`, `mira_head.png`, `rook_head.png`, `witness_head.png`, `child_head.png`, `sera_head.png`
- in game: `$LOOK/game_high/m1_2049night_kai_head.png`, `m1_2049night_jun_head.png`, `m3_2196_sera_head.png`

Cause and evidence:
- **The normal map is perfectly flat on all skin.** Standard deviation of the normal atlas inside the face, forehead
  and hand islands: **0.0 / 0.0 / 0.0** for Kai, Mira and `c49_f1` (cloth islands of the same maps: 3-20). The
  generator bakes height only for garments (`costume.paint_body` → `hgt`); `paint()` writes no skin height at all.
- **The base colour has almost no skin variation**: cheek patch std 1.1-2.3 / 255 per channel (Kai 1.8, Mira 1.5,
  `c49_f1` 2.3). The painted luminance noise is ±3.5 % / ±2 % / ±1.2 % (`paint()`, three `vnoise` octaves), redness
  ±2 %. Real skin varies ~10-20 % in luminance across a face (redder cheeks, nose and ears; darker, cooler eye
  sockets; lighter forehead; beard shadow) and has visible pores and creases at a 0.6 m close-up.
- **One roughness for all skin**: `skinShade` sets 0.5 on every skin pixel. Real skin is oilier (≈0.35) on the
  forehead, nose and upper cheeks, matte (≈0.6) on the cheeks and neck, glossy on the lips; the specular is broken
  up by pores. A uniform 0.5 lobe over a flat normal is the classic "plastic" signature.
- **Subsurface warmth is a single wrap term** (wrap 0.5, terminator tint), applied identically on thin (ears, nose
  rim, lids) and thick parts. Ears and nose never glow against a back light (`$LOOK/studio_light/kai_head_back.png`).
- WebP quality 70 on an atlas with little detail: any future fine detail painted into the atlas would be smeared by
  this compression; the face needs its own quality setting.
- Ageing: `wrinkles` in the cast specs only feeds the procedural (fallback) heads; the cast generator paints no
  wrinkles, crow's feet, age spots or eye bags for Rook, the Witness, `c49_m5`, `c49_f5`, `anc_m2`, `anc_f4`.
- The child (`$LOOK/game_high/m1_2049night_child_head.png`) gets chalk-white skin with two dark smudges at the mouth
  corners: the adult mouth-corner shading (`paint()`, "mouth corners", 3.5 mm Gaussian) is not scaled to a child's
  mouth and reads as dirt.

### 3.2 Light response: faces are self-lit and flat

Seen: in the 2049 night street, the 2196 ruin and the studio, faces have the same even, orange-beige brightness
whichever way the light comes from. They do not darken in shadow, do not take the colour of neon or sunset, and never
show a strong form-defining shadow side. They look pasted onto the scene.
- `$LOOK/studio_light/light_sheet.png` (rows Kai, Mira, `c49_f1`; key light in front, at the side, behind)
- `$LOOK/game_high/m3_2196_sera_head.png` and sheet `$LOOK/v_m3_sheet.png` (a dim green-grey ruin: every face
  is evenly lit and warm), `$LOOK/game_high/m2_helix_*.png` (dim red interior, peach faces)

Evidence: with the key moved from in front of the face to behind the head, the mean face luminance only drops
**134 → 109 (-19 %)** for Kai, **136 → 115 (-15 %)** for Mira, **179 → 161 (-10 %)** for `c49_f1`; left / right
halves of the face differ by at most 47 / 255 even with a side key.

Cause:
- `skinShade` adds `diffuse × (fill + rim × fresnel³)` to the indirect light of **every** skin, hair and cloth pixel, a
  constant studio fill independent of the scene, the probe and the time of day (cast3d.js, `shade`). In a dark scene
  this is most of what lights the face.
- The 0.5 wrap on skin pushes light past the terminator so the dark side never gets dark (good for a soft key, but
  together with the constant fill it flattens everything).
- `envMapIntensity` 0.8 on the atlas with a uniform roughness: the env specular is a uniform sheen.
- Rain (realism.js `setWetness`) makes up-facing surfaces darker and glossier for every MeshStandard material: the
  hair shell's top (one smooth surface) becomes a near-mirror **vinyl helmet with a white highlight**, while faces
  stay dry-looking (`$LOOK/game_high/m1_2049night_kai_head.png`).

### 3.3 Eyes: dead

Seen: the eyes look painted on: no wet line along the lower lid, no shadow from the upper lid and lashes onto the iris,
no depth in the iris, a highlight that is either missing or wrong (in the rig's key light there is none; in the studio
it sits where it was painted). Mira's and Sera's irises are saturated discs that look like stickers. Eyes never move:
when the head turns (idle) the eyes stay locked to the skull, and they never look at the camera, at Kai or at a speaker.
- `$LOOK/studio/mira_head.png`, `sera_head.png`, `kai_head.png`; in game `$LOOK/game_high/m3_2196_sera_head.png`,
  `m1_2049night_mira_head.png`; the idle sequence `$LOOK/studio_seq/kai_seq_sheet.png` (head turns ~30°, the eyes do
  not lead or follow)

Cause:
- The eye is one decimated cornea shell, 100 % `head`-weighted: no eyeball, no separate iris plane, no rotation.
- The catch-light is painted into the eye cell (`paint_cells`, `cl = g2(...)`), so it does not follow the lights.
- Eyes share the atlas's gloss mask (roughness 0.07) with leather and metal; no eye-specific shading (no sclera
  wrap, no iris refraction / parallax, no specular occlusion under the lid).
- No eyelid shadow or eye-corner AO (the upper-lid shading in the cell is painted on the disc, so it rotates with the
  UV, not with the lid).
- Lashes are an opaque flat-colour strip.

### 3.4 Hair: helmets

Seen: every haircut is a smooth, shiny cap moulded to the skull. Fringes end in a **sawtooth** of 1-2 cm triangles
(Kai, Mira, the child); grey hair (Rook, the Witness, `c49_m5`) shows regular ribs like a knitted hat; long hair
(Mira, `c49_f1`) is a few flat opaque ribbons; afro puffs (`c49_kid_f`) are two black spheres ("mouse ears");
Sera's "pulled back loosely, strands around the face" is a black swim cap with pale scratch lines. In the rain the
cap becomes vinyl. Silhouettes against the background are hard polygons.
- `$LOOK/studio/kai_head.png` (sawtooth fringe), `mira_head.png`, `rook_head.png` / `witness_head.png` (ribbed grey),
  `child_head.png`, `$LOOK/studio/sheet_d.png` row 2 (`c49_kid_f` puffs), `sera_head.png`;
  in game `$LOOK/game_high/m1_2049night_kai_head.png` (vinyl), `m1_2049night_child_head.png`, `m3_2196_sera_head.png`
- Likeness against the owner's art (`$LOOK/refs_faces.png`): Kai's "thick, black, wavy, messy hair over the brow and
  ears", Mira's "wavy chin-to-shoulder hair with a side part and loose strands", the Witness's "silver hair swept back
  to the collar" and Sera's loose strands are the strongest features of the references and all four are missing.
  This is the single largest likeness gap.

Cause:
- Hair is part of the opaque body mesh: a shell layer cut from the body faces where the hair field is positive
  (`fields()`, `SHELL`), painted with stripes (`hair_strands`). No alpha, no cards, no strands leave the surface.
- The shell's border is cut along the MakeHuman body faces of the forehead (large quads) and then simplified:
  the hairline becomes a row of triangle teeth.
- Grey / blond hair: the stripe painter is replaced by a weaker one (`hair_c.mean() > 0.42`) that still reads as
  a rib; there is no root-to-tip variation, no flyaways.
- Hair shading is the skin model with roughness 0.62 and wrap 0.25: no anisotropic (Kajiya-Kay / Marschner)
  highlight along the strands, no secondary coloured highlight, no transmission at the silhouette.
- Hanging hair (`hair_sheet`) is opaque ribbons with a few rows; buns, braids and puffs are tubes and spheres.

### 3.5 Mouth, teeth and facial life

Seen: the mouth is a painted line on a closed face; it never opens, smiles or tightens. In dialogue only the body
gestures (`talk` clip). No blinks in 4 s of idle (`$LOOK/studio_seq/kai_seq_sheet.png`; a person blinks every 2-6 s).
No brow motion, no saccades, no breathing in the face. Close-ups (dialogue shots at 0.6-0.9 m, fov 30-38) therefore
read as mannequins however good the light is.

Cause: no jaw, eye or lid bones (all mapped to `head`, `our_bone()`), no morph targets in `cast.glb`, no mouth
interior or teeth geometry, nothing in `update3d()` that drives a face. The procedural fallback head
(src/human/head.js) has blink and jaw morphs, eyeball rotation and saccades, but it is never used in play.

### 3.6 Face shape: faceted, mask-like

Seen: jaw lines, cheekbones, ears and the chin show flat polygon facets and a hard silhouette in close-ups (Kai's
jaw and ear, Sera's cheek planes, the Continuum helmets). Mouths are small and thin; noses are soft blobs. At the neck
of jackets the skin ends in a hard horizontal edge (Kai, Sera in game).
- `$LOOK/studio/kai_head.png`, `sera_head.png`, `$LOOK/studio/sheet_c.png` (Continuum helmets)

Cause: the whole person is simplified as one mesh to 9 000-16 000 triangles; the simplifier weighs normals, uv,
mask and skin weights but has no "face importance", so the face gets roughly what its area deserves (the triangle
split per region is measured in §3.13). Normals are also quantised to 8 bits (`compress_cast.sh`: meshopt "normal 8"), which can add
banding on large smooth surfaces (helmets, cheeks); check it when the face budget changes. Helmets and plates are low-segment hard-surface pieces.

### 3.7 Hands and fingers

Seen: in every mid shot the hands hang with stiff, evenly spread, slightly hooked fingers ("claws"); they never close
around a prop (Iven's tools, the staffs and spears, the umbrella handle float in an open hand), never relax, never
gesture. Bare hands are one flat skin colour with no nails, knuckles or creases; gloved hands are the same shape
painted dark.
- close-ups `$LOOK/studio_hand/hands_sheet.png` (Kai, Mira, Iven's fingerless glove with a ragged cut edge, the
  elder `anc_m2`): smooth wax fingers with rounded tips, no nails, no knuckles, no tendons, one tone
- `$LOOK/studio/kai_mid.png`, `mira_mid.png`, `iven_mid.png`, `sheet_d.png` (staff and spear grips),
  in game `$LOOK/game_high/m1_2049night_kai_mid.png`, `m1_2049night_hale_mid.png`

Cause: no finger bones (fingers and metacarpals map to `hand_*`); the relaxed curl is baked into the rest mesh
(`relax_hands`); no hand detail in `paint()`; props are rigid to the hand bone.

### 3.8 Clothing

Seen: garments read as clean, colour-blocked shells: big areas of one flat colour, inflated volumes around the upper
arms and shoulders (Kai's techshell, Jun's uniform, Rook's lab coat), no folds at the elbows, waist or shoulders, no
weave visible at close range, collars that stand off the neck like rings. The ancient linen and the 2196 patched
gear (wear, grime, dye unevenness) are the best-looking cloth in the game. Women's jackets show the bust as a moulded
shape (`c49_f1`, `$LOOK/game_high/m1_2049night_crowd_c49_f1_mid.png`).
- `$LOOK/studio/kai_mid.png`, `jun_mid.png`, `rook_mid.png`, `child_mid.png`, `$LOOK/game_high/m1_2049night_jun_mid.png`

Cause: tops are drawn as the convex hull of each torso slice (`costume.drape_torso`) and loosened outward (`inflate`)
so no anatomy shows through; that also removes every fold. Fold detail exists only as a painted cavity shade in a few
places (`drape_ao`). Fabric detail is "below a texel" at 1024² for the whole body (garments.py note on twill), the
normal atlas is 512² on crowds, so weave never shows. No secondary motion (coat tails, hoods, straps are skinned
to the legs and spine only): see docs/MOTION.md.

### 3.9 Proportions and posture

Seen: adult proportions are believable (≈ 7.5 heads, COSTUMES.md); heads look slightly small against the inflated
shoulders and sleeves. The station child and the kids read as small adults with a doll's face. The mocap idle holds
the elbows bent and the hands forward of the hips, the head swinging up to ~30° away from the body's facing during the loop, so a person facing
the camera in a dialogue looks past it unless the mission sets `lookTarget`.
- `$LOOK/studio/kai_full.png`, `child_full.png`, `$LOOK/game_high/m1_2049night_kai_full.png`,
  `$LOOK/studio_seq/kai_seq_sheet.png`

Cause: garment inflation (§3.8); one mocap idle retargeted onto every body (an adult's stance on a child, a soldier's
"ready" arms on a grandmother).

### 3.10 Idle stiffness

Seen: everyone in a crowd breathes and sways with the same 2.3 s rhythm; there is no weight shift, no fidget, no
glance, no blink. The idle feet slide (4.9 cm per loop in the clip metadata).

Cause: one short idle loop for all; per-person variation is only a random phase and a ±7 % rate. Detail and fixes for
the body are in docs/MOTION.md; the face part (blinks, saccades, glances) belongs to this plan.

### 3.11 Per character

| who | main defects (beyond the common ones above) | images |
|---|---|---|
| Kai | sawtooth helmet fringe instead of thick messy waves; stubble barely visible (spec: heavy); orange-tan skin; vinyl hair in the rain; jacket inflated at the shoulders; the AR monocle reads as a line drawing | `$LOOK/studio/kai_{head,mid,full}.png`, `$LOOK/game_high/m1_2049night_kai_*.png` |
| Mira | bowl helmet with a jagged fringe and flat side ribbons instead of wavy hair with a side part; grey-blue eyes as stickers; pale flat skin | `$LOOK/studio/mira_head.png`, `$LOOK/game_high/m1_2049night_mira_*.png` |
| The Witness | ribbed grey cap instead of swept-back silver hair; the short grey beard and moustache read as white paint on the chin; no age in the skin (spec: hollow cheeks, deep lines); the scar is a faint line | `$LOOK/studio/witness_head.png`, `$LOOK/game_high/m1_2049night_witness_*.png` |
| Rook | knitted-looking grey hair, waxy white skin with no age spots or crow's feet; the rimless glasses are fine; the lab coat is a puffy white column with no folds | `$LOOK/studio/rook_head.png`, `$LOOK/game_high/m2_helix_rook_{head,mid}.png` |
| Iven | chalky skin without the freckles and flushed cheeks of the spec; reddish stubble missing; good hat and vest; in the dim red Helix interior his face keeps the same even peach tone as in the studio | `$LOOK/studio/iven_head.png`, `$LOOK/game_high/m2_helix_iven_{head,mid}.png` |
| Jun | a pale, featureless face under the cap; eyes reduced to slits | `$LOOK/studio/jun_head.png`, `$LOOK/game_high/m1_2049night_jun_head.png` |
| Hale | the best of the buzz cuts; waxy flat face | `$LOOK/game_high/m1_2049night_hale_*.png` |
| the station child | doll face: porcelain skin, dark mouth-corner smudges, a hard straight bob, adult idle stance | `$LOOK/studio/child_head.png`, `$LOOK/game_high/m1_2049night_child_*.png` |
| Sera | black swim cap with pale scratch marks instead of loose pulled-back hair; the scar is two orange paint lines; saturated orange skin; turquoise sticker eyes | `$LOOK/studio/sera_head.png`, `$LOOK/game_high/m3_2196_sera_*.png` |
| Continuum trooper / officer | faceted, plastic-white helmet and plates ("action figure"); the officer's hood frames the face like a rubber cap with crack lines | `$LOOK/studio/continuum_{1,2}_*.png`, `$LOOK/game_high/m3_2196_continuum_*.png` |
| crowds 2049 | the same issues at lower texel density; `c49_f1`'s glasses run wider than the face; `c49_kid_f`'s puffs are spheres | `$LOOK/studio/sheet_c.png`, `sheet_d.png`, `$LOOK/game_high/m1_2049night_crowd_*.png` |
| ancient villager and settlers | best cloth in the game (linen slub, dye unevenness); hair as caps; the villager's and the elder's (`anc_m2`) beards are flat grey / white paint on the jaw; the warm sunset hides the flat skin best of all scenes | `$LOOK/studio/villager_*.png`, `anc_*`, `$LOOK/game_high/m4_ancient_*.png`, sheet `$LOOK/v_m4_sheet.png` (the full shots there have the camera behind a crate: framing only) |

### 3.12 Phone tier (gfx=low, 844x390 `--mobile`)

Images: `$LOOK/game_low/m1_2049night_{kai,jun,child,mira,crowd_c49_f1}_{head,mid,full}.png`,
`$LOOK/game_low/m3_2196_{sera,continuum_1}_*.png`, `$LOOK/game_low/m4_ancient_{villager,crowd_anc_f1}_*.png`,
contact sheets `$LOOK/vl_m1_sheet.png`, `$LOOK/vl_m34.png`.

- Everything in §3.1-3.10 holds, and reads worse: low has no shadow map, no depth of field and only the rim spot of the
  dialogue rig, so faces get the constant fill + rim of `skinShade` and the probe's flat ambient: a uniform orange
  or beige mask with a bright rim on the ear (`$LOOK/game_low/m1_2049night_kai_head.png`).
- No anti-aliasing on low (RENDERING.md G1): the helmet-hair silhouette, the ears and the jaw stair-step and crawl.
- At 844x390 a dialogue close-up still puts the face at ~150 px tall: eyes, mouth and hairline are clearly visible,
  so the face fixes matter on phones too; skin pores (#2) do not, and are gated off there.
- Cost measured in the m1 view (same frame, person shown / hidden): Kai +3 calls (116 / 113), +16 400 triangles
  (no shadow pass on low); Jun and Mira +2 calls, +11 000; the child and `c49_f1` +1 call, +9 000 triangles. The
  spawned `c49_f1` stays on its 9 000-triangle build on low (`lod: 0` in `$LOOK/game_low/stats.jsonl`): only Walker
  looks with `look.lod` use the 6 000 LOD; named and spawned people always render full. Kai's 2048² maps are loaded
  on low as on desktop (48 MB).

### 3.13 Triangles by body region

Measured on the shipped meshes (`node tools/feel/look_meshstats.mjs <ids>`: a triangle belongs to the bone that dominates its first
vertex; "head" includes the neck, hair, eyes and head gadgets):

| build | total | head + neck + hair | hands | feet | body + clothes | skin-mask / hair-mask triangles |
|---|---|---|---|---|---|---|
| kai | 15 999 | 3 906 (24 %) | 1 772 | 1 014 | 9 307 | 2 792 / 1 222 |
| mira | 11 000 | 3 500 (32 %) | 884 | 907 | 5 709 | 2 110 / 1 773 |
| witness | 11 000 | 2 644 (24 %) | 993 | 887 | 6 476 | 1 108 / 647 |
| sera | 11 000 | **1 668 (15 %)** | 639 | 586 | 8 107 | 1 052 / 495 |
| jun | 11 000 | 2 844 (26 %) | 893 | 790 | 6 473 | 2 041 / 569 |
| child | 9 000 | 3 108 (35 %) | 733 | 933 | 4 226 | 1 802 / 1 701 |
| c49_f1 | 8 984 | 3 470 (39 %) | 669 | 720 | 4 125 | 1 630 / 1 804 |
| continuum_1 | 8 999 | 2 488 (28 %) | 557 | 610 | 5 344 | 644 / 383 |

Sera's layered 2196 gear takes the triangles from her face: 1 668 for head, neck, hair and gadgets is why her cheeks
and jaw are visibly faceted (`$LOOK/studio/sera_head.png`). The Witness's long coat does the same to him. A good
real-time hero face needs ~3 000-5 000 triangles for the face and scalp alone; crowd faces seen at 5+ m are fine at
1 500-2 000. Hands get 600-1 800 triangles but no bones, so the triangles buy nothing in motion.

## 4. What already works (keep it)

- Proportions, heights and silhouettes per role and era (COSTUMES.md): people are identifiable from behind.
- Era-correct costumes with readable gadgets; ancient and 2196 cloth painting (weave, wear, dye) is good.
- One draw call per person (two with glow): cheap, batches well with the engine.
- The engine's dialogue rig (key + rim), depth of field on high, contact shadows and GTAO: close-ups already get
  cinematic light and grounding. The faces must now respond to it.
- Motion-capture body motion with sole-locked retargeting.

---

# Plan

Ordered by **visual impact per cost**. "Runtime" items change `cast3d.js` / `character.js` only and ship at once;
"generator" items change tools/characters and need a cast rebuild. Every runtime item hides behind `?look=classic`
(and a `look` flag on `cast.shade`), every rebuilt cast ships as a **new file** (`assets/models/cast2.glb` plus
`cast2_index.json`) that `loadCast()` picks unless `?look=classic`, so the old `cast.glb` keeps working for the
trailer and missions workflows until they have checked the new one. `anims.glb` is never touched; new face motion
is procedural (runtime) or a new file.

| # | change | where | what it fixes | phone cost (low / medium) | gating |
|---|---|---|---|---|---|
| 1 | **Light response**: replace the constant fill + rim with scene-driven light (scale `shade.fill` / `shade.rim` by the engine's probe luminance, or drop them where the probe exists), keep the wrap but narrow it (0.5 → 0.3 on skin), restore a real shadow side | runtime, `skinShade` | §3.2 flat self-lit faces in every shot | none (removes ALU) | all tiers |
| 2 | **Skin micro-detail at run time**: a 256² tiling pore / fine-crease normal and a roughness breakup, generated by our code once (canvas or GPU bake, like realism.textureSet), sampled only on `azSkin > 0.5` pixels with the atlas uv × 40-60; roughness by region from a cheap uv-space mask (T-zone 0.38, cheeks 0.55, lips 0.3) | runtime, `skinShade` | §3.1 plastic skin, uniform specular | one texture fetch on skin pixels; off on low (keep the region roughness) | high, medium; low: region roughness only |
| 3 | **Eye shading**: a dedicated eye branch in `skinShade` for the eye cells (uv inside the eye cell): wet cornea specular from the scene lights (roughness 0.03-0.05, clearcoat-like second lobe), specular occlusion and a soft upper-lid shadow band, iris darkening at the limbus; the generator stops painting the catch-light | runtime + generator (catch-light removal) | §3.3 dead eyes (the highest-value face fix after light) | a few ALU on eye pixels | all tiers |
| 4 | **Face rig**: map MakeHuman's `jaw`, `eye.L/R`, upper / lower `orbicularis` (lids) and `levator` bones to new game bones (`jaw`, `eye_L`, `eye_R`, `lid_L`, `lid_R`) instead of `head`; split the eye proxy weights to the eye bones. Retargeting ignores bones the mocap rig lacks, so the motion capture plays as before | generator (`OURS`, `our_bone`, rig bones), new cast file | §3.3, §3.5 eyes that can look, lids that can blink, a jaw that can talk | +5 bones per person (skinning texture rows); no extra draw | all tiers |
| 5 | **Facial life at run time** on top of #4: blinks every 2-6 s (with a 150 ms close), saccades and gaze to `lookTarget` / the camera in dialogue / the speaker, eye-led head turns, jaw open from the voice's word timing (`onWord`) and a closed-mouth rest, brows raised on questions; LOD by distance and role (Kai, the speaker and anyone within 6 m) | runtime, `Character.update3d` | §3.5, §3.10 face part | negligible (bone rotations) | all tiers; crowds beyond 6 m skip |
| 6 | **Hair you can believe**: (a) fix the sawtooth: cut the hair shell on a densified scalp band and lock that border in the simplifier, fade the last 3-5 mm in the atlas to scalp; (b) anisotropic hair specular in `skinShade` (strand direction from the shell's uv tangent, a primary white and a secondary tinted lobe) and keep hair roughness ≥ 0.35 under rain; (c) for the principals (Kai, Mira, Witness, Sera) and speaking NPCs: alpha-tested strand cards (our own strand textures, as `src/human/hair.js` already draws them) for the fringe, the hairline and the silhouette, styled to the owner's art: Kai's messy waves over the brow and ears, Mira's side-parted waves, the Witness's swept-back silver to the collar, Sera's loose pulled-back strands | (a, c) generator, (b) runtime | §3.4 helmets: the largest likeness gap | (a, b) none; (c) +1 draw call and ~2-4k triangles per principal, alpha-test (alpha-to-coverage on high) | (c) high / medium; low keeps the shell with fixed hairline and shading |
| 7 | **Skin texture content in the generator**: bake skin height into the normal atlas (pores by region, forehead and eye creases scaled by age, nasolabial folds, lip lines, knuckles and nail beds on hands); paint real colour variation (cheek, nose and ear redness, eye-socket shadow, lip border, beard shadow, age spots and eye bags with age), with the child's features scaled to the child's head; store a roughness / cavity term in the normal map's blue channel (rebuilt z in the shader) so it costs no new texture; WebP quality 85-90 on the face island | generator, new cast file | §3.1 (the parts #2 cannot do: region colour, age, hands) | none at run time (same texture count) | all tiers |
| 8 | **Face triangle budget**: give the simplifier a face / hands importance weight (2-3× for the head and hands, taken from the cloth) at the same total; principals: head ≥ 3 500 triangles; 10-bit normals | generator (`simplify_cast.mjs`, `compress_cast.sh`) | §3.6 facets, §3.7 claw hands | none (same totals) | all tiers |
| 9 | **Hands**: map MakeHuman finger bones to 2 curl bones per hand (`fingers_L`, `thumb_L`, ...), rest pose relaxed; at run time a grip pose when a hand prop is shown (staff, spear, umbrella, phone, scanner, tool), a soft relaxed curl in idle, a fist in combat; paint nails and creases (#7) | generator + runtime | §3.7 | +4 bones per person | all tiers; procedural curl only within 10 m |
| 10 | **Cloth folds and weave**: bake fold normals at elbows, inner arms, armpits, waist, knees and the back of the knee (from the joint geometry, our code) into the normal atlas, and a tiling weave detail map per fabric family sampled on cloth pixels near the camera (as #2 for skin); reduce `inflate` on fitted 2049 tops | generator + runtime | §3.8 | detail map: one fetch, high / medium only | high, medium |
| 11 | **Idle variety (face and stance)**: per-person procedural layer on the mocap idle: breathing scale on chest, small weight shifts, glances (with #5); children and elders get stance offsets (shoulders, knee bend). Coordinated with docs/MOTION.md, which owns the body motion | runtime | §3.9, §3.10 | negligible | all tiers |
| 12 | **Phone tier texture and LOD hygiene**: load Kai at 1024² on low and medium phones (RENDERING.md item 11), named NPCs at 512² on low, use the crowd LOD for distant `game.actor` NPCs too | runtime (`loadCast` / `makePerson` options) | memory and bandwidth for #2-#7 | saves memory (≈ 36 MB for Kai alone) | low, medium phones |

Why this order: #1 and #3 change every face in every shot for almost nothing; #2 and #7 kill the plastic look; #4
and #5 bring the faces to life (the biggest "uncanny" factor in dialogue); #6 is the largest likeness gain but the
first item that costs draw calls and triangles, so it is limited to the people who are ever seen close; #8-#10 polish
mid shots; #11-#12 are variety and budget hygiene.

# Implementation (runtime look, no cast rebuild)

The first pass works on the shipped `cast.glb` (66 builds) at run time, so nothing in the cast file, `anims.glb` or the
generator changed. Files: `src/human/skin.js` (shading, facial life, scheduling), `src/human/skin_analyse.js` (the
per-template analysis, plain typed arrays), `src/human/skin_worker.js` (runs it off the main thread). `cast3d.js`
`makePerson()` calls `lookPerson(h, seed)` once at its end (one import, one call); nothing else in the motion code
changed. Switches: `?look=classic` = the old shader and no facial life; `?look=noeyes,nohair,noskin,nopores,nocloth,
nolight,noface` turn single parts off; `?look=dbg:<channel>` paints an analysis channel (oily, red, cav, thin, lips,
brow, crow, nail, tip, bd, tilt, ...); `?looktier=low|medium|high` forces a tier; `?looksync` analyses on the main
thread. `DEFAULT_ON` at the top of skin.js is the master switch (true: the look is the default).

## How it works

- **Per template, once** (`skin_analyse.js`, ~30-500 ms in a worker, ~15-60 ms on the main thread to copy the arrays):
  the atlas mesh in its rest pose gives the eye spheres (sphere fit of the cornea shells), the iris disc in the atlas
  and the upper / lower lid lines, the face frame (eye centres, interocular distance), the nose tip, the lips (redder
  than the face in the atlas), the mouth centre, hands (wrist joint, finger direction), concavity, contact with cloth
  and hair, the hair shell's distance to its edge and its strand direction (from a point above the crown). They are
  stored as four vertex attributes shared by every clone: `azFace` (oily, red, cavity, thin), `azFace2` (lips, brow,
  crow's feet, nail), `azHairT` (strand tangent, root-to-tip; on skin the brow-lift weight), `azDet` (metres per uv
  unit). The person keeps the classic shading until the result is in (the first time a template is used: a few frames).
- **Skin**: roughness by region (T-zone and nose 0.38, cheeks and neck 0.56, lips 0.30, nails 0.28, older skin a little
  rougher); blood colour by region (cheeks, nose tip, ears, knuckles redder, eye sockets darker and cooler, lips,
  paler nail beds); complexion blotches and age spots (rest-space noise); a 3 cm tiling pore and fine-crease detail
  normal map generated by our code (`makeDetailMaps`, 256², with its cavity in blue: pores break up the specular);
  forehead lines and crow's feet whose depth follows the age from `cast_index.json`; subsurface: wrap 0.3 with a red
  terminator, red light through thin skin (ears, nostril wings, lids) from lights behind, a small red shift of the
  ambient; cavity and contact occlusion (collars, cuffs, hairline, creases) on the indirect light.
- **Light response** (audit §3.2): the constant studio fill + rim of `skinShade` is gone; the fresnel sheen is now a
  fraction of the scene's own irradiance and probe, so faces darken in the dark and take the place's colour.
- **Eyes**: the iris disc is read at a gaze-shifted place (the shell is a sphere: reads as the eye turning), with iris
  parallax behind the cornea on high; the painted catch-light is hidden (iris colour) and a real one comes from every
  directional / spot light as a sharp lobe on a wet cornea (roughness 0.06-0.09, 2.2× the dry specular); upper-lid
  shadow on the eye, darker corners, a tear line; the lid closes over the eye shell for blinks (lid skin and lash
  colours taken from the atlas once, so the eye costs one extra texture fetch).
- **Hair**: Kajiya-Kay strand highlights (white primary toward the root, tinted secondary toward the tip) along the
  strand direction; root-to-tip colour; strand streaks; on medium / high ~4 mm clumps that roll the normal (the
  highlight breaks into strands) and **frayed tips** along the shell's edge (each clump ends at its own length and
  tapers: the sawtooth fringe of the audit becomes tufts); wet hair never drops below roughness 0.36 (no vinyl helmet
  in the rain). Alpha-to-coverage does not apply: the scene renders into a non-MSAA target, so the tips are a
  stable per-clump discard smoothed by SMAA (high) / FXAA (medium).
- **Cloth**: a tiling plain-weave detail normal near the camera and a soft sheen at grazing angles (high), cavity
  occlusion in folds (all tiers).
- **Facial life** (`h.face`, optional, feature-detect it): blinks every 2-6 s (75 ms close, 35 ms shut, 160 ms open,
  sometimes double, more often while talking), fixational saccades every 0.4-1.6 s, a glance away every 3-9 s, the
  gaze held on `character.lookTarget` (a speaker's head when the target is a Character) or partly ahead along the
  body, the upper lid following the eye down, brow lifts (more while talking), and speech: while `character.talk` is
  up the lips part in syllables of 90-220 ms (a shaded opening along the mouth line: the cast mouth has no interior).
  API: `face.blink()`, `face.look(point | null)`, `face.say(sec)`, `face.useLook(on)` (A/B).
- **Distance**: beyond 8 m (with hysteresis) a person switches to a variant without the eye branch and the frayed
  tips (both invisible there); the facial life only runs its gaze maths within that range.

## Tiers

| feature | low | medium | high |
|---|---|---|---|
| region colour and roughness, eyes (gaze, lids, blinks), speech mouth, no constant fill, cavity / contact occlusion | yes | yes | yes |
| varyings | 11 floats (no strand tangent, rest position, texel density) | 23 | 23 |
| per-light extras: thin-skin translucency, strand highlights, cornea catch-light (directional / spot lights only, never the many point lights of a street) | no | yes | yes |
| complexion noise, hair streaks, clumps, frayed tips, pore detail map | no | yes | yes |
| wrinkle relief, iris parallax, cloth weave map and sheen | no | no | yes |

## Results

Before / after with the audit's own camera set (`$LOOK` above; after = `look_v2` next to it):
studio `look_v2/s_head1.png`, `s_head2.png`, `s_mid.png` (classic / new pairs), eyes `look_v2/s_F.png`; every one of
the 66 builds with the look `look_v2/all_{0,1,2}.png`; in game, m1 2049 night high `look_v2/gh_m1.png`, m3 2196 high
`look_v2/gh_m3.png`, m1 low 844×390 `--mobile` `look_v2/gl_m1.png`; facial life over 20 s
`look_v2/life_sheet.png` + `life/kai_life.json`, speech `look_v2/say_sheet.png`.

- Every build gets the look: 66 / 66 analysed, 66 / 66 with eyes found, 0 failures, 0 shader errors, 7 programs for
  all of them on one tier (`look_v2/probe_all.out`).
- Blinks: 7 in 20 s of idle (intervals 1.6-4.9 s); saccades and glances visible in the lid / gaze record.
- Analysis cost: median 106 ms, max 497 ms per template in the worker on the loaded machine; main thread 15-60 ms
  per new template (array copies, the 256² atlas read-back). m1 at load: 17 templates.
- Memory: 16 bytes per vertex per template for the attributes (≈ 150-240 KB per build in use) + two 256² detail maps.
- Draw calls and triangles: unchanged (the look is one material per person, the same mesh).
- Frame cost: measured on the shared, overloaded machine (CPU SwiftShader, load average 25-38), so only
  interleaved A/B pairs in one page count (`node tools/feel/look_perf.mjs`: every person's material swapped between
  timed frames, min of 3 fenced frames per sample, 5 samples). m1 2049 night, 844×390 `--mobile`, 31 people:
  gameplay view low 1783 / 1832 ms (look / classic, -3 %), medium 1382 / 1371 ms (+0.8 %); dialogue close-up on Kai
  low frame 1679 / 1352 ms but scene pass 1525 / 1518 ms (+0.5 %: the two disagree, noise), medium 1600 / 1509 ms
  (+6 %), scene pass +2 %. Draw calls, triangles and program count identical. The per-person shading alone
  (`look_v2/probe_perf.js`: Kai alone filling a 422×195 frame, 1 key + 8 coloured point lights, 70 interleaved
  samples, min): low +9 % close-up, medium +18 %, high about 2.5×. SwiftShader runs both sides of every branch, so
  the eye, hair and skin branches cost every pixel there; a phone GPU skips them for whole warps outside the eyes and
  hair, so these are upper bounds. Re-measure on real phones (RENDERING.md `REF.measure`) when one is available.

## Not done in this pass (needs a cast rebuild, see the plan)

Face bones (#4: real jaw, eye and lid rotation), hair cards for the principals' likeness (#6c), skin detail baked in
the generator (#7: e.g. the child's mouth-corner smudges are painted in the atlas), the face triangle budget (#8),
finger bones and grips (#9), cloth fold normals (#10), texture LOD on phones (#12). Breathing and idle variety of the
body belong to the motion step (docs/MOTION.md).

## Rules for every step

- Backward compatible: `makePerson()` still returns the same fields; new bones and morphs are optional for callers;
  `Character` keeps `root, speed, crouch, talk, pose, lookTarget, umbrellaPose, frozen, setGadget, hasGadget,
  showProp, update`. New face controls are added as optional methods (`character.face?.blink()`), feature-detected.
- `?look=classic` restores the old cast file and the old shader. Each runtime feature also has its own off switch
  (`?look=nolight,nopores,noeyes,noface,nohair`) for A/B shots.
- Measure every step with `tools/feel/look_studio.mjs` and `tools/feel/look_ingame.mjs` on the same subjects and
  views as this audit (before / after contact sheets), and the frame cost on gfx=low and gfx=medium `--mobile` with
  `REF.measure` (as RENDERING.md does) on an idle machine. Acceptance targets:
  - the face-luminance ratio key-behind / key-in-front ≤ 0.6 (today 0.81-0.90);
  - skin normal-atlas std in face islands > 0 and region roughness varies (today 0);
  - a blink every 2-6 s and eyes that hold a look target in the idle sequence;
  - no sawtooth on any hairline at 0.6 m; the four principals match their reference hair silhouette;
  - low / medium frame time within +3 % on the m1, m3 and m4 views (draw calls ≤ +1 per principal in view).
- Never edit `assets/models/anims.glb`, the missions, the trailer files or another workflow's files.


---

# Faces: audit, thresholds and briefs

The owner's request (binding, their words): "Characters face still need more attractive and good looking style. Also
other character look similar to hero face. So be precise while choosing character for NPCs and other characters.
[Change] the hero face it looks ugly so need of changes in his face."

What it means for every face step:
1. Faces are attractive and good-looking in the style of a modern premium story game: appealing, well proportioned,
   groomed and expressive; realistic, not stylised cartoons and not uncanny.
2. Every character has their own face. No two different named characters share a face, no NPC or crowd member reuses
   a principal's face.
3. Kai's face is redesigned. The Witness is the new Kai aged (same bone structure, eyes, the wrist scar) and is the
   only face allowed to resemble Kai; young Kai (`kid_kai`) is Kai as a child. Mira, Kai's sister, has a light family
   resemblance (brow line) but clearly her own, attractive face.
4. Casting is precise: each build fits who the person is (age, sex, heritage, build, role, era, personality; the
   briefs below). Heritage mix, age, sex, height, cast ids, rigs, bone names (anims.glb keeps retargeting), triangle
   budgets and the owner's-own-figure rule (MakeHuman + Blender generator, no faces, photos, scans or models from the
   internet) stay as they are.

`$FACES` below is `/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/feel/faces`.

## Machinery (used by every face step)

| what | where | how |
|---|---|---|
| per-character face overrides: details (final values, not softened), face macro terms (proportions, build, ancestry mix), skin, lips, eyes, brows, stubble, beard, hairstyle | `tools/characters/faces/<id>.json` (schema: `tools/characters/faces/README.md`), merged by `cast_nrzero.face_override()` | no file: the entry builds exactly as before (checked: the CAST list is byte-identical to the committed one with no overrides). `FACES_DIR=<folder>` builds a candidate set (its solved heights go to `<folder>/_heights.json`, the repo cache is not touched); `FACES_DIR=none` ignores every override |
| studio portraits | `tools/characters/face_studio.sh NAME` (`face_studio.mjs`, `face_sheet.py`) | `ONLY=a,b [FACES_DIR=...] face_studio.sh NAME` builds only those ids into `$FACE_STAGE/NAME` (default `$FACES/stage`, outside the repo), packs them as the game ships them (`pack_cast2.mjs`: budgets with face importance, phone + HD atlases), serves the stage on port 8793 and renders front, three-quarter (35°) and profile head shots in the rest pose under a neutral studio light (soft white key with a face shadow, fill, rim, grey background) and one in-game light (Rain City night: sodium key from above right, cyan rim, wet blue ambient). Sheets: `shots/sheet_<id>.png`, `shots/overview.png`; `face_sheet.py grid / cluster / pairs` for comparisons. `--no-build --base=<dir>` portrays an existing cast folder (e.g. `assets/models`). `shots.json` keeps eye position, triangles and face-box triangles per id |
| distinctness metric | `tools/characters/face_metric.py OUT` | see below; ~15 s for the 66 builds and a 400-face reference population; writes `faces.json`, `report.md`, `matrix_sim.csv`, `heatmap.png`; `--landmarks` plots the landmark set (`$FACES/metric_cur/landmarks.png`) |

### The metric

Every MakeHuman build shares one topology, so faces compare vertex for vertex, straight from the sculpt (`mh.sculpt`
of the build's macro and details; the same vertices the generator builds from, before packing):
- **geo**: the face region (brow to chin, cheek to cheek, ears excluded; 2 760 vertices) is centred and scaled to the
  neutral face's size; the area-weighted RMS vertex distance in mm (and per region: eyes, brows, forehead, nose,
  mouth, cheeks, jaw, chin);
- **lm**: 22 landmark proportions (nasion, nose tip, subnasale, lips, stomion, pogonion, menton, eye corners, alae,
  mouth corners, cheekbones, jaw angles, brows, head top: face index, jaw width, eye spacing and width, canthal tilt,
  nose length / width / projection, mouth width, lip heights and fullness, lower face, chin height and projection,
  brow height and ridge, forehead, cheekbone depth, mouth-corner tilt), each in standard deviations of the reference
  population; distance = RMS of the differences;
- **reference population**: 400 faces from MakeHuman's own space with a fixed seed (sex, age 19-70 and 15 % children,
  build, a random ancestry mix, a head shape and each symmetric face-detail group at ±0.35 SD with 45 % probability).
  A pair's **percentile** reads "as alike as the closest N % of random strangers of the same group" (men, women,
  children). **sim** = the mean of the geo and lm percentiles (0 = as alike as the closest strangers, 50 = typical
  strangers). Population same-group geo percentiles 5 / 10 / 25 / 50: men 2.68 / 2.96 / 3.47 / 4.18 mm, women
  3.03 / 3.39 / 4.14 / 5.25 mm, children 3.64 / 3.98 / 4.76 / 5.96 mm;
- **app**: shared look (skin ΔE, hair colour ΔE and style, eye colour, facial hair, brows; 0 = nothing shared, 1 =
  identical);
- **same person at another age**: the first build's ancestry and details on the second build's body (age, build),
  compared with the second build: Kai → Witness, Kai → young Kai, Mira → young Mira, Oskar → Oskar at 55.
- **attractive proportions** (`face_metric.CANON`, below).

## Audit of the 66 builds (current generator, no overrides)

Measured: `FACES_DIR=none face_metric.py $FACES/metric_cur` (`report.md`, `faces.json`, `heatmap.png`); portraits of
every build from the current generator (look v2), packed as shipped: `$FACES/shots_cur/<id>_{front,three,profile}_{studio,game}.png`,
per id `$FACES/shots_cur/sheet_<id>.png`, all fronts `$FACES/sheets/overview_front.png`, three-quarters
`$FACES/sheets/overview_three.png`; the shipped classic `cast.glb` (what the game shows today) tells the same story:
`$FACES/sheets/shipped_overview_front.png`, `$FACES/sheets/shipped_lookalikes.png` (`$FACES/stage/shipped/shots/`).

**Result: one face per sex, age band and ancestry mix.** Of the 842 same-group pairs (excluding the same person at two
ages), 589 read as the same face (sim < 10 with both geo and lm under the 20th percentile), 88 more are look-alikes
(sim < 20), and 697 miss the pair target below (sim ≥ 25); the median same-group pair is at sim 0.9, i.e. closer than
99 % of random strangers. The portraits confirm it: the same small almond eyes, straight thin mouth and soft nose on
every face, with only skin, hair and props telling people apart.

### Who resembles Kai (most alike first; geo / population P5, geo mm, macro-only mm)

| other | geo / P5 | geo mm | macro-only mm | shared look |
|---|---|---|---|---|
| `c49_m6` street-food vendor | 0.37 | 1.01 | 0.83 | the same skin b98463, black hair, heavy stubble |
| `continuum_1` trooper (helmeted) | 0.38 | 1.01 | 0.48 | hair colour, eyes |
| `orren` | 0.47 | 1.26 | 1.10 | skin b88560 (ΔE 2.2 from Kai's) |
| `helix_sci_m` | 0.49 | 1.32 | 1.21 | hair colour, eyes |
| (`witness`, allowed) | 0.50 | 1.33 | 1.30 | eyes, brows |
| `surv_m1` | 0.52 | 1.39 | 1.27 | eyes |
| `c49_m3` | 0.53 | 1.41 | 1.25 | |
| `c49_m4`, `neighbor`, `c26_m3`, `brandt`, `c26_m2`, `villager`, `anc_m3`, `iven`, `anc_m1`, `hale`, `anc_m2`, `c49_m1` | 0.60-0.81 | 1.6-2.2 | | |

Of the 29 other adult men, 26 are closer to Kai than the closest 5 % of random men by geometry and 28 read as his face
(sim < 10); only the 78-year-old Oskar (sim 15.9) escapes. Sheet: `$FACES/sheets/kai_lookalikes.png` (Kai, then the seven closest: front, three-quarter, profile).
The Witness vs Kai aged to 58: geo 0.35 mm (his face is Kai's by construction, which is right, but today it inherits
the face the owner rejects). Young Kai vs Kai at 7: 0.69 mm. Mira vs Kai: sim 24.9 (cross-sex), inside the family band.

### Worst look-alike clusters (complete linkage: every pair under 0.6 × the population's P5)

| cluster | mean geo | sheet |
|---|---|---|
| women: `c26_f3`, `c49_f3`, `caretaker`, `mara`, `surv_f2`, `technician` (European women 38-61) | 0.58 mm | `$FACES/sheets/cl_f_mara.png` |
| women: **`mira`**, `c26_f2`, `c49_f6`, `helix_sec_2`, `c49_f4`, `anja` (Mira and `c26_f2` also share waves and hair colour: app 0.71) | 0.79 mm | `$FACES/sheets/cl_f_mira.png` |
| men: **`witness`**, `c26_m3`, `c49_m3`, `c49_m6`, `orren` | 0.83 mm | `$FACES/sheets/cl_m_witness.png` |
| men: `brandt`, `c49_m4`, `helix_sci_m`, `neighbor`, `surv_m1` | 0.89 mm | `$FACES/sheets/cl_m_brandt.png` |
| men: `anc_m1`, `anc_m4`, `c26_m1`, `c49_m2`, `helix_sec_1` (+ `niko` = `anc_m3`, 1.01 mm) | 0.98 mm | `$FACES/sheets/cl_m_african.png` |
| men: `c26_m2`, `hale`, `iven`, `oskar26`; and `rook`, `oskar`, `c49_m5` | 1.03 / 1.19 mm | `$FACES/sheets/cl_m_iven.png` |
| women: `c26_f1`, `c49_f1`, `helix_sci_f`, `transit_worker` (+ `c49_f5`, `continuum_2`) | 1.14 mm | `$FACES/sheets/cl_f_asian.png` |
| women: `tala`, `c49_f2`, `surv_f1`; `potter`, `anc_f2`, `anc_f4`; `anc_f1`, `anc_f3` (0.67 mm) | 0.85 / 0.97 mm | `$FACES/sheets/cl_f_african.png` |
| children: `child`, `lotte`, `kid_mira`; `kid_kai`, `c49_kid_m`, `anc_kid_m`; `c49_kid_f`, `anc_kid_f` (0.85 mm) | 1.05 / 1.76 mm | `$FACES/sheets/cl_kids.png` |
| men: `jun`, `c49_m1` (+ `surv_m2`) | 1.00 mm | `$FACES/sheets/cl_m_asian.png` |

Similarity matrix: `$FACES/metric_cur/heatmap.png` (red = alike, blue = the same person at two ages, grey = different
groups), numbers in `matrix_sim.csv`.

### Why

1. **The details are too weak to make a person.** A face's own detail modifiers move it on average 0.2-1.3 mm (RMS,
   "detail energy") away from the macro face of its sex, age, build and ancestry; a random MakeHuman face carries
   2.7 mm. The entries hold 1-9 detail modifiers (median 3), every value is softened (`× 0.8`, clamped to ±0.4, mean
   |value| 0.23), and the same few are reused: `head-oval` in 34 of 66 entries, `cheek-bones` in 22, `head-round` in
   18, `eye-bag` in 11. So for most pairs the details barely change the distance their macro faces already have
   (Kai vs `c49_m6`: macro-only 0.83 mm, with details 1.01 mm).
2. **Faces are the average of a handful of ancestry mixes.** 16 builds are pure European, 12 the settlement mix
   (0.35 / 0.65 / 0), 8 pure African, 6 pure East Asian, 5 the "Latin" mix (0.6 / 0.15 / 0.25) and 4 the South Asian
   mix; Kai's own mix (0.45 / 0.15 / 0.4) sits between the European, Latin, South Asian and mixed builds, so every
   brown-haired man of a mixed heritage lands on Kai's face (`c49_m6`, `orren`, `c49_m3`, `helix_sci_m`, `continuum_1`).
3. **Identical skin, eyes and hair.** Kai's skin b98463 is also `c49_m6`'s, `c49_f6`'s, `helix_sec_2`'s (and young
   Kai's); 6b4029 is on 7 builds, 8c5a3a on 5, f1c6a8 on 5. Eye colour 2a1a10 is on 29 builds and Kai's 3a2a1c on 9.
   Hair colour 141010 is on 25 builds; styles repeat (`short` 9, `swept` 7, `crop` 7), and from the front `pony`,
   `bun`, `braid` and `crop` all read as the same dark cap with a fringe (portraits). Mira and `c26_f2` share the
   `waves` style and the hair colour 1e1712. One iris paint, one lash ring and one brow stroke on every face finish
   the effect.
4. **Decimation of the face.** The packed builds keep 700-1 800 triangles in the face box (Kai 1 753, named NPCs about
   1 100-1 400, crowds 600-1 500) of about 5 400 in MakeHuman's face, so small shape cues (lip border, nostril, eyelid
   fold, chin) are averaged away; `helix_sec_1`, `sera`, `surv_f2`, `surv_m2`, `anc_m3` and `helix_sec_2` keep fewer than 750.
   Decimation does not create the sameness (the sculpts already coincide) but it removes what little detail there was.
5. **Not attractive by construction.** MakeHuman's macro faces miss the proportions of an attractive face (table
   below): every adult but one has small, wide-set eyes (eye width 25-29 mm against about 30 mm, intercanthal / eye
   width 1.16-1.51 against about 1.07), all 58 adults have a lower lip thinner than the upper, 42 a short upper lip / long
   chin, 26 a retruded chin in profile. Softening the details kept these averages instead of correcting them.

## Thresholds the face steps must meet

Checked by `face_metric.py` (`THRESH`, `CANON`; the "Target failures" list in `report.md` must be empty; today it
holds 808: 672 pair distances, 79 shared looks, 57 builds with more than the allowed `CANON` misses). The face
triangle rule is read from the renderer's `shots.json`:

| rule | threshold |
|---|---|
| different named characters / extras of the same group (men, women, children) | sim ≥ 25 (as far apart as typical strangers' lower quartile) |
| crowd templates among themselves | sim ≥ 15 |
| anyone (but the Witness and young Kai) against Kai | sim ≥ 40, and no "SAME FACE" or "look-alike" verdict across sexes either |
| no pair of different people | verdict "SAME FACE" (sim < 10) or "look-alike" (sim < 20) |
| the Witness against Kai aged to 58 (his details on the Witness's body) | sim ≤ 12, and the same eye colour, brow line and wrist scar |
| young Kai against Kai at 7; young Mira against Mira at 10; Oskar at 55 against Oskar | sim ≤ 12 |
| Mira against Kai | 15 ≤ sim ≤ 45 (family brow line, her own face) |
| shared look between two different people of the same group | app < 0.6 (no identical skin + hair colour + style) |
| every adult principal and named NPC | at most one `CANON` proportion out of range; crowds at most two |
| face triangles after packing (face box in `shots.json`) | Kai ≥ 1 700, named NPCs ≥ 1 100, crowds ≥ 800, within the unchanged total budgets |

A face also passes by eye: the portraits of a candidate set next to its cluster mates on one sheet
(`face_sheet.py cluster`), front, three-quarter and profile, studio and night light.

## What makes a MakeHuman face attractive here

The face steps aim for real, appealing people (premium story-game realism), never for one "pretty" template: the
distinctness rules above apply at the same time. Distinct features go where they do not cost appeal (nose shape and
size, brow shape, face length and width, cheek fullness, jaw and chin form, lip shape, ears, hair, skin, age marks);
the proportions that read as attractive (eyes, lip balance, thirds, chin in profile) are corrected on everyone.

**Proportions** (`face_metric.CANON`, measured with the metric's landmarks; men / women, heritage overrides):

| proportion | target | today (adults) | levers (+0.5 of the modifier, measured on Kai's macro) |
|---|---|---|---|
| eye spacing: intercanthal / eye width | 0.95-1.20 / 0.95-1.18 (East Asian 1.05-1.35) | 1.16-1.51, 57 of 58 out | `eyes/*-eye-trans-in|out` −0.3…−0.5 (−0.10…−0.17), `eyes/*-eye-scale-decr|incr` +0.2…+0.4 (−0.06…−0.13, +1.6 mm eye width), `eyes/*-eye-push1/push2-in|out` +0.3 (+1.1 mm eye width) |
| lower / upper lip (stomion to each lip's fullest point) | 0.95-1.5 / 1.05-1.6 | 0.61-1.05, 58 out | `mouth/mouth-lowerlip-height-decr|incr` +0.4 (+0.17), `mouth/mouth-lowerlip-middle-down|up` +0.3 (+0.13), `mouth/mouth-upperlip-height-decr|incr` −0.2 (+0.12), `mouth-cupidsbow` +0.3 for a defined bow |
| upper lip / lower face: (sn-sto) / (sto-me) | 0.42-0.53 / 0.42-0.55 | 0.36-0.55, 42 out | `chin/chin-height-decr|incr` −0.2…−0.4 (shorter chin), `mouth/mouth-trans-down|up` −0.2 |
| chin in profile: pogonion behind the lower lip | −5…+0.5 mm / −6.5…−1 mm (African −9.5…−2) | −10.5…−2.3 mm, 26 out | `chin/chin-prominent-decr|incr` +0.3…+0.6 (+1.0…+2.0 mm), `chin/chin-prognathism-decr|incr` +0.2 |
| jaw / cheek width | 0.84-0.95 / 0.76-0.87 | 0.76-0.96, 9 out | men: `chin/chin-width-decr|incr` +0.2…+0.4, `head-square` / `head-rectangular` 0.2-0.4, `chin-bones` +0.2; women: `chin-width` −0.2, `head-oval` / `head-invertedtriangular` 0.2-0.4 |
| canthal tilt (outer corner up) | +1.5…+7° / +3…+9° (East Asian +4…+12.5°) | +2.7…+10.9°, in range | `eyes/*-eye-corner1-down|up` +0.2 (outer up), `eyes/*-eye-corner2-down|up` −0.2 |
| mouth / nose width | 1.38-1.75 / 1.4-1.8 (African 1.25-1.6) | 1.28-1.70, in range with the heritage ranges | `mouth/mouth-scale-horiz-decr|incr` +0.2…+0.4 (+0.04…+0.07), `nose/nose-nostrils-width-decr|incr` −0.2 |
| nose / intercanthal width | 0.8-1.06 / 0.76-1.0 (African 0.9-1.25) | in range for most | `nose/nose-scale-horiz-decr|incr`, `nose-nostrils-width`, `nose-width3` |
| midface / lower face: (n-sn) / (sn-me) | 0.72-0.88 / 0.75-0.90 | in range for most | `nose/nose-scale-vert-decr|incr`, `chin-height` |

Full table of what every face modifier moves (geo mm and each proportion, +0.5 on Kai's macro):
`$FACES/modifier_sensitivity.txt`. Avoid `head/head-angle-in|out` (5 mm of change by tilting the whole face),
`head-scale-*` (resizes rather than reshapes) and large `head-trans-*`.

**Concrete guidance, men** (Kai, Brandt, Niko, Sera's male counterparts in the crowds): a defined, slightly squared
jaw with the chin reaching the lower-lip line in profile; cheekbones high and visible (`cheek-bones` +0.3…+0.5,
`cheek-volume` −0.2…−0.4 for lean faces); brows straight and set low over the eyes (`eyebrows-trans-down|up` −0.2,
`eyebrows-angle` −0.1…−0.2), a slight brow ridge (try `eyebrows-trans-backward|forward` and `forehead-nubian`, judged
in profile); deep-set eyes with a slight hood (try `eye-eyefold-down|up`), larger and closer than MakeHuman's average;
a straight, defined nose (`nose-hump` 0…−0.2, `nose-point-width` −0.2); a firm mouth with the lower lip fuller than the
upper. Grooming: designed stubble or a trimmed beard
with a clean neck line and cheek line, clean brows, hair cut with intent (no helmet).

**Women** (Mira, Sera, Anja, Tala, the crowd women): a soft but defined jaw narrower than the cheeks, a chin a little
behind the lip line; high cheekbones with some fullness under them; larger eyes (`eye-scale` +0.3…+0.5) with a
lifted outer corner, softly arched brows set higher (`eyebrows-angle` +0.2…+0.3, `eyebrows-trans` +0.1); a refined,
narrower nose with a slightly lifted tip (`nose-point-up` +0.1…+0.2, `nose-scale-horiz` −0.1…−0.3 where the heritage
allows); full lips with a defined cupid's bow and the lower lip fuller (`lowerlip-volume` +0.2…+0.4, `upperlip-volume`
+0.1…+0.2, `cupidsbow` +0.2…+0.4). Grooming: shaped brows, a light flush (`blush` 0.15-0.3), lip colour a little
deeper than the skin, hair with a part and volume.

**Older people**: age through skin and soft tissue (eye bags, laugh lines, `head-age`, thinner lips, lower brows)
on a well-built skull; elders stay handsome and kind (Rook distinguished, Oskar kind, Mara soft and watchful).
**Children**: round full cheeks, large eyes, small nose and chin; never an adult face scaled down, never a doll.

**Skin, eyes, hair** (painted in the generator, part of the face): even skin with real colour variation (warmer
cheeks, nose and ears, a slightly darker eye socket), no flat single tone; a unique skin hex per person (no two people
of the same group within ΔE 6), the eye colour from the brief with an individual iris; brows by personality (thick and
straight, arched, fine, bushy); a lip colour per person; each person's own hairstyle and colour from the brief, so
that no two people of one group share style and colour; facial hair as grooming (shaped, not dotted squares).

## Face briefs

One line per build: age, heritage (the build's ancestry mix stays as cast), build, personality, and the impression the
face must give in a close-up. "Not like ..." names the faces this one is closest to today (see the audit below).
Every adult is groomed and appealing for their age and role, nobody is a cartoon, nobody is uncanny.

### Principals
| id | brief |
|---|---|
| `kai` | 32, mixed European / East Asian / West African (warm olive-tan), 1.83 m lean-athletic; a temporal engineer who believes every loss can be undone: controlled, intense, private. **Redesign (the owner finds today's face ugly):** a handsome leading man: straight heavy brows set low over deep-set dark eyes with a slight hood, a narrower eye spacing than today, high defined cheekbones and lean cheeks, a clean squared jaw and a chin that comes forward in profile, a straight strong nose with a defined bridge, a firm mouth with a fuller lower lip, heavy groomed stubble and thick messy black waves over the brow; tired but determined, someone you follow. Not like `c49_m6`, `continuum_1`, `orren`, `helix_sci_m`, `c49_m3`, `surv_m1`. |
| `mira` | 29, European with a light East Asian trace (fair, warm flush), 1.69 m slim-athletic; a reconstructed person who refuses to be a rescue object: tender, uncertain, independent. The most memorable face in the game: large grey-blue eyes, softly arched brows (the family brow line she shares with Kai), high cheekbones, a slim oval face with a delicate jaw, a straight refined nose, full lips; luminous, alive, her own face. Not like `c26_f2` (same waves and hair colour today), `c49_f6`, `technician`, `c49_f3`, `anja`, `helix_sec_2`. |
| `witness` | 58, Kai's heritage, 1.81 m lean and slightly stooped; Kai after years without sleep: precise, controlled, haunted. **The new Kai aged 25 years** (same brow, eyes, nose, jaw and wrist scar): hollower cheeks, deep forehead and eye lines, weathered skin, silver hair swept back to the collar, a short grey beard and moustache, the scar across the left brow; piercing, exhausted eyes. The only face allowed to resemble Kai. Not like `c49_m3`, `c26_m3`, `orren`, `c49_m6`. |
| `sera` | 34, European / West African (tan, grimy), 1.72 m athletic and strong; a resistance leader, practical, direct, distrustful. Striking and tough: strong cheekbones, straight determined brows that sit low, grey-green eyes, a firm jaw, a wide mouth that rarely smiles, the fresh scar down the left side; beautiful without trying. Not like `mira`, `anja`, `c49_f4`, `anc_f*`. |
| `rook` | 62, European (pale-warm, age spots), 1.78 m slim and upright; the Helix director, composed, guarded, never a simple villain. Distinguished and cold: a long narrow face, high forehead, a prominent straight nose, thin lips, deep-set pale blue-grey eyes with crow's feet, receding silver hair combed back. Not like `oskar`, `c49_m5`. |
| `niko` | 19, settlement (West African), deep brown, 1.66 m slender; keeper of the settlement's memory, earnest and perceptive. An open, bright young face: youthful round-oval, broad nose, full lips, large dark eyes under soft brows, tight black curls, no facial hair. Not like `anc_m3`, `c49_m2`, `c26_m1`, `helix_sec_1`. |
| `tala` | 41, West African (dark brown), 1.64 m strong; the water keeper, calm authority. A handsome, composed face: strong high cheekbones, a wide nose, full lips, smile lines, a low bun with a few grey strands; warmth held in reserve. Not like `c49_f2`, `surv_f1`, `potter`. |
| `iven` | 45, European (fair, freckled, flushed), 1.76 m solid; a maintenance technician who fears being blamed: tired, decent, likeable. A wide friendly face, snub nose, light green eyes, reddish stubble, ginger-brown crop. Not like `hale`, `c26_m2`, `oskar26`. |
| `jun` | 42, Korean (light warm), 1.74 m average; transit operator, kind but worried. A round warm face, monolid eyes with soft lids, a low flat nose bridge, a gentle mouth, clean-shaven, short straight black hair. Not like `c49_m1`, `surv_m2`. |
| `hale` | 48, European (ruddy), 1.85 m big and broad; night-shift security, steady and by the book. A broad square jaw, thick neck, heavy brows, a slightly broken nose, grey-blue eyes, grey-brown buzz cut; solid, not brutish. Not like `iven`, `c26_m2`, `oskar26`. |
| `brandt` | 37, European (pale), 1.80 m lean; Rook's problem-solver, cold and efficient. Handsome in a hard, chilly way: a long narrow face, high cheekbones, thin lips, cold blue eyes, sandy hair swept back, light stubble; never Kai's warmth. Not like `c49_m4`, `helix_sci_m`, `neighbor`, `surv_m1`. |
| `child` | 8, European (light, freckled), 1.27 m small; the child in the station, frightened but brave. A real child: round full cheeks, big brown eyes, a small button nose, short brown bob; not a doll. Not like `lotte`, `kid_mira`. |
| `anja` | 46, South Asian (brown), 1.70 m slim and wiry; a scientist of temporal memory, intelligent, burdened. Elegant and intelligent: a long oval face, fine laugh lines, large intelligent dark eyes, a refined aquiline nose, a dark braid with a grey streak. Not like `mira`, `c49_f4`, `c49_f6`, `helix_sec_2`. |
| `mara` | 61, European (pale, weathered), 1.62 m slight; the 2196 archivist, watchful and soft. A soft, small, lined face with a small chin, kind watchful pale eyes behind repaired rectangular glasses, cropped silver hair. Not like `caretaker`, `c26_f3`, `surv_f2`, `c49_f3`. |
| `orren` | 50, mixed European / African / East Asian (olive), 1.78 m calm and upright; guide of the Unwritten Second, serene. A calm, symmetric, long face with a broad smooth forehead, wide-set calm eyes, a broad straight nose, clean-shaven, close-cropped dark hair grey at the temples: it must not read as Kai or the Witness (today it is one of Kai's closest matches). |

### Mission extras
| id | brief |
|---|---|
| `caretaker` | 57, Northern European (fair, weathered), 1.66 m sturdy; Ingrid Holt, calm and competent. A broad weathered face, a square jaw, small light eyes behind thin rectangular glasses, short grey-brown pixie. Not like `mara`, `c26_f3`, `surv_f2`, `technician`. |
| `oskar` | 78, European (pale), 1.70 m slight; the clockmaker, kind and patient. A lined, kind face, bushy white brows, a long nose, a white beard, white swept hair, glasses. Same person as `oskar26` (allowed). Not like `rook`, `c49_m5`. |
| `oskar26` | 55, Oskar 23 years younger: the same nose, brows and eyes, brown hair going grey, stubble, glasses. Not like `iven`, `hale`, `c26_m2`. |
| `lotte` | 8, European (fair, freckled), 1.27 m slight; the clockmaker's daughter, bright and curious. A narrow heart-shaped child's face, big blue eyes, a small pointed chin, dark-blonde ponytail. Not like `child`, `kid_mira`. |
| `kid_kai` | 7, Kai's heritage, 1.22 m slight; Kai as a child (residue echo). The new Kai's eyes and brows in a child's face: dark deep-set eyes, straight brows, messy black hair. Allowed to resemble Kai and the Witness only. Not like `c49_kid_m`, `anc_kid_m`. |
| `kid_mira` | 10, Mira's heritage, 1.36 m slim; Mira as a child. Mira's eyes and face shape at ten: large green-grey eyes, a slim oval face, a dark bob. Not like `child`, `lotte`. |
| `neighbor` | 46, European / African (light brown), 1.76 m average; a wary neighbour in the clock quarter. An ordinary, pleasant face: a rounder face, a short wide nose, heavy-lidded brown eyes, short dark hair, stubble. Not like `rook`, `iven`, `brandt`, `kai`. |
| `potter` | 46, settlement (warm dark brown), 1.60 m solid; Iru the potter, warm and humorous. A broad, warm face with full cheeks, deep laugh lines, a wide nose, a bun. Not like `tala`, `anc_f2`, `anc_f4`. |
| `villager` | 52, settlement (deep brown), 1.70 m wiry; the lower-village speaker, weathered and wary. A lean, long face, hollow cheeks, short greying curls, a trimmed beard. Not like `anc_m2`, `orren`. |

### Crowd 2049 civilians
| id | brief |
|---|---|
| `c49_m1` | 24, East Asian (light), slim young professional; a sharp, neat, fashionable young face: narrow jaw, straight brows, black undercut, clean-shaven. Not like `jun`, `surv_m2`. |
| `c49_m2` | 38, West African (deep), athletic commuter; a long handsome face, high forehead, short fade, trimmed beard. Not like `niko`, `c26_m1`, `helix_sec_1`, `anc_m*`. |
| `c49_m3` | 55, South Asian (brown), stocky shop owner; a round, kindly, jowly face, a broad nose, a neat grey beard. Today one of Kai's closest matches: must move well away. |
| `c49_m4` | 31, Nordic (fair), lean bike courier; a narrow, angular, wind-burned face, swept blond hair, light stubble. Not like `brandt`, `hale`, `iven`. |
| `c49_m5` | 67, Mediterranean (olive), retired engineer; a long, lined, gentle face, a strong hooked nose, silver swept hair, glasses. Not like `rook`, `oskar`, `witness`. |
| `c49_m6` | 45, Latin American (tan), heavy-set street-food vendor; a broad, round, cheerful face, full cheeks, a short wide nose, stubble. Today Kai's closest match (same skin, hair colour, stubble): must move furthest from Kai. |
| `c49_f1` | 27, Korean (light), slim designer; a delicate, stylish face, a small chin, long straight black hair. Not like `c26_f1`, `helix_sci_f`, `transit_worker`. |
| `c49_f2` | 34, East African (deep), athletic nurse; a long elegant face, high cheekbones, a narrow nose, braids in a high ponytail. Not like `tala`, `surv_f1`. |
| `c49_f3` | 48, European (fair), soft office worker; a round, soft, friendly face, an auburn bob. Not like `mira`, `caretaker`, `c26_f3`. |
| `c49_f4` | 22, South Asian / European (light brown), slim student; a lively young face, big eyes, a pixie crop with teal tips. Not like `mira`, `anja`. |
| `c49_f5` | 62, Chinese (light), slim grandmother; a small, lined, smiling face, short grey hair, glasses. Not like `helix_sci_f`, `c49_f1`. |
| `c49_f6` | 39, Latina (tan), strong emergency responder; a strong, warm face, a wide jaw, a full mouth, dark wavy low ponytail. Not like `mira` (same hair colour), `helix_sec_2`. |
| `c49_kid_m` | 10, South Asian (brown), schoolboy; a thin, lively child's face, large ears, short black hair. Not like `kid_kai`, `anc_kid_m`. |
| `c49_kid_f` | 6, Black (deep), little girl; a round baby-cheeked face, two curly puffs. Not like `anc_kid_f`. |

### Crowd 2049 Helix and services
| id | brief |
|---|---|
| `helix_sci_m` | 36, Middle Eastern (olive), Helix scientist; a long, thoughtful face, a strong nose, short dark hair, trimmed beard. Today a close Kai match: must move away (longer face, larger nose, rounder brows). |
| `helix_sci_f` | 44, Japanese (light), Helix scientist; a calm oval face, fine features, a black bob with greys. Not like `c49_f1`, `transit_worker`. |
| `helix_sec_1` | 32, Black (deep), muscular guard; a broad, square, heavy-jawed face, short crop, clean-shaven. Not like `niko`, `c49_m2`. |
| `helix_sec_2` | 35, Latina (tan), athletic guard; a hard, high-cheekboned face, a narrow chin, a tight bun. Not like `mira`, `c49_f6`. |
| `transit_worker` | 29, Filipino (warm), transit worker; a friendly round face, a flat wide nose, a low ponytail under a cap. Not like `c49_f1`, `helix_sci_f`. |
| `technician` | 38, Slavic (fair), strong technician; a broad face, wide cheekbones, deep-set eyes, a red-brown braid. Not like `mira`, `caretaker`, `surv_f2`. |

### Crowd 2026
| id | brief |
|---|---|
| `c26_m1` | 29, Black British (deep), athletic young man; a handsome, youthful, clean face, a short fade. Not like `niko`, `c49_m2`. |
| `c26_m2` | 47, European (fair), soft dad build; a soft, round, tired face, a receding short brown hairline, stubble. Not like `iven`, `hale`. |
| `c26_m3` | 63, South Asian (brown), slim older man; a thin, lined, dignified face, grey hair, glasses. Not like `witness`, `c49_m3`. |
| `c26_f1` | 24, East Asian (light), student; a youthful round face, long straight black hair. Not like `c49_f1`. |
| `c26_f2` | 38, Latina (tan), professional; a confident face, strong brows, dark wavy shoulder-length hair. Today Mira's closest match (same waves and hair colour): change hair colour or part and the face. |
| `c26_f3` | 55, European (fair), older woman; a long, refined face, a silver-blonde bob, glasses. Not like `caretaker`, `mara`. |

### Crowd 2196
| id | brief |
|---|---|
| `surv_m1` | 41, Middle Eastern (olive, grime), wiry scavenger; a gaunt, hard face, a hooked nose, a full beard. Not like `kai`, `witness`, `brandt`. |
| `surv_f1` | 28, Black (deep), athletic scout; a lean, sharp, alert face, short locs tied back. Not like `tala`, `c49_f2`. |
| `surv_m2` | 63, East Asian (light, weathered), thin elder mechanic; a lean, lined, wiry face, grey stubble. Not like `jun`, `c49_m1`. |
| `surv_f2` | 45, Slavic (fair, weathered), sturdy medic; a square, practical, weathered face, a greying braid. Not like `caretaker`, `technician`, `mara`. |
| `continuum_1` | 30, East Asian / European (light), athletic trooper behind a sealed helmet; the face underneath is still distinct: a long, hard, narrow face. Today almost Kai's face: must move away. |
| `continuum_2` | 33, East Asian / European (light), athletic officer, visor up; a severe, symmetric, elegant face, a tight low bun. Not like `anja`, `c49_f4`. |

### Crowd ancient settlement
| id | brief |
|---|---|
| `anc_m1` | 32, settlement (brown), muscular farmer / builder; a broad, open, sun-lined face, a shaved head. Not like `anc_m4`, `c49_m2`. |
| `anc_m2` | 64, settlement (brown), slight elder storyteller; a long, deeply lined, expressive face, grey curls and beard. Not like `villager`. |
| `anc_m3` | 22, settlement (brown), lean sentry; a narrow, watchful young face, braided hair at the nape. Not like `niko`. |
| `anc_m4` | 40, settlement (dark brown), stocky bronze smith; a heavy, broad, square face, a full beard. Not like `anc_m1`, `helix_sec_1`. |
| `anc_f1` | 25, settlement (warm brown), slim water carrier; a fresh, oval, pretty face, a single long braid. Not like `anc_f3`, `sera`. |
| `anc_f2` | 50, settlement (brown), soft weaver; a round, soft, cheerful face, a grey-streaked bun. Not like `potter`, `anc_f4`. |
| `anc_f3` | 35, settlement (brown), herbalist / healer; a calm, long, serene face, two braids and a headband. Not like `anc_f1`. |
| `anc_f4` | 68, settlement (deep brown), slight stooped elder; a small, very lined face, a white bun under a head wrap. Not like `anc_f2`, `potter`. |
| `anc_kid_m` | 9, settlement (brown), slim boy; a lively, narrow child's face, short curls. Not like `kid_kai`, `c49_kid_m`. |
| `anc_kid_f` | 7, settlement (warm brown), small girl; a round child's face, two braids. Not like `c49_kid_f`. |

## proto:makehuman: Kai on the MakeHuman route (hair, mouth, three styles)

Candidate faces: `tools/characters/faces_candidates/kai_young|kai_rugged|kai_mature/kai.json` (build with
`FACES_DIR=...`; the shipped cast is unchanged until one is copied to `tools/characters/faces/kai.json`). Shapes found
with the clay loop (fast numpy previews of `mh.sculpt`): compact face, open eyes (eye-height1/3 up, set a little
closer, slight up-tilt), refined narrow nose (flaring, point width, nostrils down), fuller lips with a cupid's bow, eye
bags down; each style keeps its own jaw and brow. Skin albedo `a8806a` (the earlier `a47c52` was ~50 % saturated and
read orange under sodium light). Hair colour `2e2018` (very dark brown: black-brown kept no strand light).

Hair (`look2.py`, messy cuts `lead_messy` / `lead_shag` / `lead_tousle`, `_messy_cards`):
- strand atlas v9 (`HT_VERSION = 9`): clump columns carry ~230 fine strands spread evenly (sub-clumps only bunch
  them a little) that end over the whole last half: a feathered tip, never a converging point (v8's tips were spikes);
- cards 10-10.5 mm wide with a gentle taper (`tipw` 0.74, fringe 0.9); root colour 0.74 of the tip (the shader's
  root occlusion is now 0.72 instead of 0.55, so roots are not darkened twice);
- strand tangents of scalp cards blend 60 % with their 1.2 cm neighbourhood mean (`HAIR_TSMOOTH`, 0 = off): the sheen
  is one band across the cut instead of glossy shards card by card;
- messy: an uneven diagonal fringe (a smooth noise field plus per piece random; short on the whorl side), fringe
  pieces gather (`conv` up on the fringe) and stand a little off the forehead, a shorter hem at the ears with ends
  flicking out, a fuller crown (`hero_T`);
- `rig2.js`: Kajiya-Kay lobes 0.2 / 0.42 (were 0.16 / 0.34), exponents 64 / 22; `skin.js`: the shell under the cards
  0.8 (was 0.64: dark holes between cards).

Mouth (`look2.py` `_teeth_crowns`, `_gum_band`, `mouth_objects`, `_mouth_rims`):
- the upper arch 5 mm further forward (`TEETH_FWD`, sagittal sections showed the incisors 5 mm behind the inner lip, so
  no camera a little above the mouth saw them), the lower arch 2.0 mm behind it (overjet), a flatter, wider arch
  (21 / 17 000 instead of 25 / 25 000: a 1 cm black corridor beside the side teeth), crowns touch (no gum showing
  between teeth), the upper incisal edge 3.6 mm under the lips' contact line;
- the tongue rests 3.5 mm lower and 2.5 mm back (`TONGUE_LOW=0` restores MakeHuman's);
- closed lips overlap 0.1 mm (`RIM_OVERLAP`; the 0.3 mm gap showed a white line of teeth).

Skin paint (`build_humans.py`): light stubble is a soft even shadow with a faint grain (0.4 mm specks aliased to sand);
the short groomed beard (beard < 0.5) has a density gradient (full on chin, jaw, moustache), a noise-broken cheek
line, a faded neckline, darker cooler hair and a fine directional texture; the painted tint under the brow hairs 0.17
(was 0.28: a painted block).

Debugging: `TEETH_DEBUG=1` prints the incisal edges against the lip rim at build time.

Licence of the generator (read in `/home/user/tools/mh/LICENSE.md` and `LICENSE.ASSETS.md`): MakeHuman's bundled
assets (base mesh, proxies, targets and modifiers, textures) are CC0 1.0 Universal; section D: "the MakeHuman project
makes no claim whatsoever over output such as exports to files ... graphical data generated via scripting or plugins";
only the MakeHuman source code is AGPL. Our pipeline reads the CC0 assets with our own scripts and ships only the
generated meshes and textures, which a commercial game may ship. No scan, photo or model of a real person is used, with
one exception the owner asked for: Kai's face is fitted to the owner's own reference photo ("Faces: photo likeness" below);
the photo never enters the repo, only the measurements and look data derived from it ship.

## Faces: photo likeness (Kai from the owner's photo)

The owner sent a selfie and asked "Use this face for kai". The photo stays private: it lives outside the repo
(`/home/user/tools/kai_ref/`, crops in the likeness work folder) and is never published; what ships is derived from it
(the fitted MakeHuman detail values, the beard density and length maps, the brow profile, the mole positions, the
measured colours), as the owner asked.

Pipeline (`tools/characters/likeness/`, an offline venv with MediaPipe 0.10.21 at `/home/user/tools/likeness-venv`):
- `measure.py` (likeness:measure): landmarks, camera and pose, a pose-corrected frontal view in "face mm" (x = his left,
  y up, origin = the midpoint of the inner eye corners), proportions, colours (white-balanced on the T-shirt), beard,
  brow, hair and skin masks, moles. `fit.py` (likeness:fit): the MakeHuman head fitted to the photo at its own camera ->
  `faces_candidates/kai_photo/kai.json` (shape).
- `look_data.py` (likeness:look): `measure.json` + `mask_beard.png` -> `faces_candidates/kai_photo/kai_look.npz`: the
  beard density on a 1 mm grid (left / right averaged, speckles removed, sparse patches filled to about half density,
  carried outward past the face outline for the side of the jaw the frontal view does not see), a hair length factor
  (moustache 1, chin and jaw up to 1.85, cheeks 0.6), the brow profile (top, bottom, thickness per mm, the photo's frown
  undone: medial end up 2.6 mm, lateral 1.4 mm), the moles and faint spots, the measured albedos.
- `tools/characters/likeness_look.py` (numpy, read by the build): binds the data's frame to the sculpted mesh through
  MediaPipe's inner-eye-corner points traced onto the base mesh (`likeness/mp_to_mh.json`), samples the maps, and paints:
  the colour zones (a darker, slightly cool crescent under the deep-set eyes, darker upper lids, the nose bridge, a warmer
  nose tip, the cheekbone band), the moles (the two on his left cheek at full contrast, the faint spots at 55 %), and the
  beard's painted under-layer (nearly solid dark with a fine down-running hair texture where the beard is dense, a
  stubble of fine dots where it thins, a faint shave shadow just past it). The beard map's 3D gates: the front of the ear
  above the lobe (below it the beard runs back along the jaw to its angle), MakeHuman's head weights as the neckline, a
  sideburn band 0-24 mm ahead of the ear up to the hairline.

Face file keys (`faces/README.md`): `likeness` (the look data, relative to the face file), `likenessScale` (photo mm per
build mm, the fit's 1.007), `skinExact` (the skin hex used as is, no `natural_skin` hue / chroma clamp), `lipScale`
([upper, lower] painted lip heights), `greyStrands` (the photo's few grey hairs), and `extends` (a variant face file:
another file's keys first, its own on top; `kai_photo_loose` extends `kai_photo`).

Strand cards (`look2.py`):
- beard (`_beard_cards`, when the entry has `likeness` and `beard` >= 0.5): about 1 400 fine cards rooted where the map
  has beard (sampled area-weighted on the lower face and the under-jaw, kept with probability density^1.3, never on the
  lips or within 1 mm of them), along the growth direction (the moustache down and out from the philtrum and never past
  the lips' contact line, chin and jaw down and a little forward, the under-jaw back along the skin, sideburns down),
  lying at their layer of the beard's volume (6-7 mm under the chin, 4-5 mm on the jaw sides, 2-3 mm on the moustache;
  the fit found his skin outline 3-6 mm inside the beard's), a third of them wider clumps in the deep layers (the mass),
  the rest fine hairs; matte (no strand sheen: on flat cards it read as bright chips), `@split` weights (they follow the
  jaw like the skin under them). About 10 000 triangles on the HD build.
- brows: the measured profile drives both the painted brow (620 strokes, a 0.4 base tint for his dense brows) and the
  brow cards (680 per side).
- curls (`_curl_cards`, cuts `photo_tied` and `photo_loose`): ringlets are helical strand ribbons around a centre line
  that marches along the cut's flow inside the smooth envelope of `_messy_cards` (width along the axis, normal out from
  it, two strand bundles half a turn apart, radius 9-15 mm, pitch 24-34 mm, a little tighter and thinner toward the end,
  8 points per turn), so they read as loops from every side. `photo_tied` (A, the photo): a sleek layer of long strands
  from the hairline over the crown into the tie at the top of the pony tube (no strand ever continues past the tie), the
  nape pulled up into it, a few loose strands lifting off; a halo of ringlets springing out above and behind the ears
  and at the back corners; three temple tendrils (the longest on his left temple); the tail: ringlets round the pony
  tube; fine frizz loops over the halo; three grey strands looping across the front-top on his left. `photo_loose` (B,
  the owner's earlier "messy medium length" pick, his own curls worn down): wavy fill on a dark inner mass (the cut's
  hanging `sheet`, behind the ears only), ringlets over the whole scalp and the inner mass falling to the hem (chin at
  the sides, below the nape at the back), the brows and eyes kept clear, frizz, the grey strands.
- motion: the pony tube (A, `hairDrop` 0.17) and the inner mass (B, down to 13.5 cm below the eyes) hang below the head
  joint, so `springs.js` builds its hair chain and `rig2.prepareCardSprings` hangs the nearby cards on it (checked in
  the viewer: about 6 400 card vertices on the spring bones for A, 13 700 for B).

Budgets: the body builds are unchanged (HD 34 000 with the head at 19 000, phone 16 000); the card mesh is 39 500
triangles for A and 44 200 for B (hair 22 600 / 27 600, beard 10 000, brows and lashes 6 600), well over the ~8 200 of
the earlier hero cuts; the phone build draws its first 45 % (17 800 / 19 900).

