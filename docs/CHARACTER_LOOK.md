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
