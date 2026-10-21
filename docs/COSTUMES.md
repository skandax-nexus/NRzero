# AFTERZERO costume and gadget bible

This is the design source for every character costume. The character generator (`tools/characters/build_humans.py`) builds what this file describes. Story and roles come from `docs/BIBLE.md` and `src/story/cast.js`; face likeness comes from `assets/cast/LIKENESS.md`.

## The owner's rules

1. Costumes are realistic, futuristic gear with useful gadgets, and every costume matches the year of its scene.
2. No out-of-era pieces. In 2026, 2049 and 2196 that means no top hats, Victorian coats or tailcoats, aprons, headscarves, bonnets, period dresses or corsets. In the ancient settlement it means no technology of any kind.
3. The look is a premium game look. Proportions are realistic, silhouettes are clean, gadgets are readable, and emissive accents are subtle. Costumes must read well while the character walks, runs and moves their hands.
4. Everything stays smooth on phones (see the budgets in "Mobile budgets").
5. Faces are attractive and believable, with no extremes (see `cast_humans.py`: bodies lean toward MakeHuman's ideal proportions, and detail modifiers are softened).

## Era style guides

### 2026: the Helix lab in the past and the city of Kai's childhood

| | |
|---|---|
| Feel | Contemporary and realistic: what people really wore in 2026, with an early wearable here and there |
| Silhouettes | Hoodies, bomber, puffer and utility jackets, padded jackets, car coats, belted rain macs (modern trench), crew-neck and turtleneck knits, denim and flannel shirts, jeans, chinos, wide-leg jeans, sneakers, chelsea or ankle boots, loafers |
| Helix staff in 2026 | A plain white cotton lab coat with notch lapels (`labcoat26`), worn over any 2026 archetype, plus a lanyard ID, safety glasses and a clip-on badge reel. No tech panels: the Chronolith project is still young. |
| Materials | Cotton jersey and fleece (roughness 0.85), denim (0.8, twill noise), wool knit (0.9, rib or cable), nylon puffer (0.45 with a soft sheen), leather (0.45 to 0.55), rubber soles |
| Palette | Denim 2e3a4c / 6a7a94, grey marl 8a8d92, black 18191d, oatmeal bcb19c, cream e0d8c4, camel b08a5a, olive 4a4a32, forest 2f4a3a, burgundy 6a2a3a, navy 1d2430, white sneakers e6e2da |
| Wearables | Smartphone in the hand or a pocket, smartwatch or fitness band, white earbuds, crossbody phone bag. No emissive light, apart from a tiny watch screen at most. |
| Forbidden | Everything in 2049 (LED piping, AR glasses, sealed techshells), aprons (Oskar's shop apron becomes a canvas work vest), headscarves, top hats, period coats and dresses |

### 2049: Rain City and Helix Temporal Research (the present)

| | |
|---|---|
| Feel | Near-future cyberpunk techwear that works in rain. Function first and matte, with light used as information, not decoration. |
| Silhouettes | Sealed rain shells with taped seams (`techshell`, hip length), knee-length sealed coats with storm plackets and split vents (`longshell`; these replace every 'coat'), high stand or funnel collars, cropped tech jackets, quilted heated parkas, modular chest harnesses, tapered tech trousers with articulated knees, cargo joggers, tech skirts over thermal leggings, waterproof tech boots and sneaker-boots |
| Uniforms | **Helix security**: a navy duty shell with epaulettes and red chevrons, a black plate carrier, a duty belt and boots. **Transit and maintenance crews**: hi-vis smart vests with reflective bands and LED piping. **Helix lab**: a white technical lab coat with a mandarin collar and a dark glass tech panel carrying the Helix glyph. **Emergency responders**: red and graphite shells with reflective chevrons. |
| Materials | Coated nylon or polyurethane shell (roughness 0.32 to 0.4; it darkens and gains specular when wet, through the existing rain wetness), ripstop (0.55, grid noise), softshell (0.65), merino (0.85), technical knit, polymer plate (0.3), brushed gunmetal hardware (metalness 1, roughness 0.35), reflective bands (roughness 0.25, light grey) |
| Palette | Graphite 1b1e23, charcoal 2a2f36, gunmetal 3a4048, deep navy 1d2a44, slate 2e3338, olive-graphite 3b4441, oxblood 4a1f24, white-grey c4c4c8, Helix white e8eaec |
| Emissive accents | Small and low: no more than 2 % of the visible silhouette, intensity 0.35 or less for crowds and 0.6 for NPCs. Civilian colours are amber ffb347, magenta ff4fa0, mint 6affc8, teal 38c8c0 and white f2f6ff. **Reserved colours**: cyan 5fe6ff (Kai and the Chronolith), violet 9a7bff (Mira), red-orange ff6a4a (the Witness), security red ff4d5e, transit yellow ffd34a, maintenance amber ff9a3a. |
| Wearables | AR glasses or a clip-on visor, wrist devices (a slim band with a soft screen glow), earpieces and earbuds, slates, LED-rim umbrellas (prop) |
| Forbidden | Top hats, fedoras, Victorian or Edwardian coats and tailcoats, waistcoats with watch chains, aprons (vendors wear wipe-clean vests, the clockmaker a utility vest), headscarves, bonnets, long period skirts and dresses, satchels in the period style (use sling bags, tablet bags or backpacks). Nothing glossy-neon or costume-like: no cosplay armour on civilians. |

### 2196: the devastated future

| | |
|---|---|
| Feel | A beautiful, devastated world. Survivors wear decades of repair; the Continuum wears a sterile perfection that does not belong to the ruin. |
| Survivor silhouettes | Hooded ponchos and cloaks, patched field jackets, scavenged plate carriers built from mismatched plates (old Helix security armour, road signs, tyre rubber), a single pauldron, cloth-wrapped forearms and shins, knee pads, resoled combat boots, respirators, dust goggles, salvage backpacks, sling straps. Asymmetry is encouraged. |
| Survivor materials | Faded canvas (roughness 0.9) with sun-bleached shoulders, patches in a different weave and colour, frayed hems (alpha-free: painted on the atlas), scratched and chipped polymer (0.5 with edge wear), rust on metal, dust in the folds (an atlas AO-driven dust tint) |
| Survivor palette | Dust ochre 8a7458, rust 7a3e22, faded olive 4a4a32, ash grey 6a6a64, bleached canvas b8ab90, worn brown 4a3a28, scorched black 1a1816. Emissive: resistance green b6ff8a, on screens only. |
| Continuum silhouettes | Sleek armoured suits: a graphite under-suit with segmented pearl ceramic plates, a high gorget, a fully enclosed helmet with a horizontal visor slit, back stabilizer fins and a chest temporal emitter. Officers wear a half-cape over one shoulder. Symmetric and smooth, with no patches. |
| Continuum materials | Ceramic plate (roughness 0.18 with a clearcoat feel), satin graphite under-suit (0.5), polished trim |
| Continuum palette | Pearl e6e8ea, graphite 202328, trim 8a9098, Continuum gold d9a441 with the emissive ffd27a |
| Forbidden | Clean modern 2049 civilian clothes on survivors (everything must look repaired), Kai's cyan on anyone else, period costume, high-fashion pieces |

### ANCIENT settlement (about 3000 years ago)

| | |
|---|---|
| Feel | A living Bronze Age society with its own goals: practical, handmade and warm. Not a museum diorama. |
| Silhouettes | Linen tunics (knee length for workers and youths, calf or ankle length for elders and keepers; sleeveless, short or elbow sleeves), shoulder mantles and wraps pinned with bronze, wide wrapped sashes knotted at the hip, leather belts, leg wraps, leather sandals with ankle thongs, hardened-leather cuirasses for sentries, leather hip-wraps for potters and smiths, head wraps and woven headbands |
| Materials | Undyed and natural-dyed linen (roughness 0.92 with a slub weave noise), wool felt, vegetable-tanned leather (0.6), bronze (metalness 1, roughness 0.35, warm, with a slight green patina in the crevices), clay beads, wood |
| Palette | Undyed linen d9c9a0, flax cdb48a, ochre b4884e, red ochre and madder 9b3b24 / 8a3a3a, indigo-teal 3f6a6a / 2f5a5a, saffron d0a24a, weld green 6a7a3a, plum 5a2a4a, leather 5a3e28 / 4a3220, bronze c9a050. No emissive, ever. |
| Props | Clay water jars, gourds, staffs, tally cords, clay tablets in leather satchels, distaffs, flint knives, bronze-tipped spears, slings, clay toys |
| Forbidden | Any technology, LEDs or emissive light, zips, synthetics, printed logos, modern footwear, trousers with a fly (use leg wraps or a wrapped skirt), Kai's gear on anyone local. Kai himself keeps his 2049 techwear, and the settlers notice it ("You wear no dust..."). |

## Gadgets and gameplay

Every gadget is visible on the body and tied to a real mechanic. Each one is a rigid mesh weighted 100 % to a single bone, so it never stretches. Its emissive part is a separate small mesh named `gx_<type>` (with `userData.gadget = '<type>'` and `userData.slot = 'glow'`), so the runtime can drive its intensity without new materials.

### Kai's kit (the player)

| Gadget | Where | Mechanic | Behaviour |
|---|---|---|---|
| Chronolith band (`chronolith_band`) | Left wrist (`forearm_L`, at the wrist) | Temporal State Switching (Q) and stability | Idles at 0.15 cyan; flashes to 3.0 over 0.4 s on each switch; the lit segments (7) follow `temporal.stability`; flickers when stability is too low to switch |
| AR monocle visor (`ar_monocle`) | Right temple, an arm from the right ear (`head`) | Temporal Residue / Residue Vision (F) | A dark smoked lens at rest; turns cyan with a scan-grid texture while residue is on |
| Comm earpiece (`earpiece`) | Left ear (`head`) | Calls from Rook, the Helix PA and the Unknown Voice (the `phone` cast entry) | A pin-point LED that blinks while a call line is active |
| Belt scanner (`belt_scanner`) | Front-right of the harness belt (`hips`), ahead of the arm swing | Evidence (inspect and the journal) | Its ring pulses when evidence is in interaction range and flashes once on `addEvidence` |
| Shoulder lamp (`shoulder_lamp`) | Harness strap, high on the left shoulder (`chest`) | Dark areas (maintenance tunnels, the hospital, ruins) | The lens glows and a cool-white SpotLight (at most one in the scene) turns on in dark zones |
| Echo Step emitter (`echo_emitter`) | Upper back, between the shoulder blades (`chest`) | Echo Step (unlocked in mission 10) | Dark before the unlock; vent brightness shows the charge; flares when Echo Step fires. It is the gadget the third-person camera sees most. |
| Harness pouches (`harness_pouches`) | Two pouches at the back hips (`hips`) and a slate pocket on the left chest (`chest`) | Carried items: keycards, the Helix access card from mission 4, recordings | Static, no emissive |

### Role gadgets for NPCs

| Gadget | Who | Mechanic or readability |
|---|---|---|
| `shoulder_radio` with a status LED | Helix security, responders, Jun | Steady while patrolling and pulsing once alerted: a stealth cue readable at 20 m |
| `stun_baton` (holstered at the back hip) | Helix security | Shows a threat level; the tip glows when drawn |
| `body_cam` | Hale (and security crowds) | A red dot means recording (evidence: "the logs do not show what he was ordered to do") |
| `vest_flashlight` | Hale and security crowds | The cone is the guard's vision cone in the dark |
| `ar_half_visor` | Brandt and security crowds | A red scan line while searching; locks solid on detection |
| `restraint_cuffs` | Brandt and security crowds | Silhouette detail |
| `tool_belt` and `diagnostic_probe` | Iven and technicians | Maintenance access, power reroute |
| `forearm_tablet` | Iven and technicians | Access codes (the Technician's Key quest) |
| `cap_headlamp` | Iven and technicians | A warm light in dark maintenance areas (an emissive lens only; no real light for NPCs) |
| `transit_tablet` and `signal_wand` | Jun and transit workers | The station schedule, guiding passengers (Last Train Home) |
| `id_badge` / `keycard_reel` | Helix staff, Rook (the gold-edged director badge) | Access gates: the badge that can be cloned or stolen |
| `rugged_slate` | Ingrid Holt | Reservoir controls |
| `wrist_device`, `ar_glasses`, `earbuds`, `led_umbrella` | 2049 civilians | Era readability (the Zero Second: wrist screens show the wrong time) |
| `kid_locator_band` | 2049 children | The station child's band dims when the timeline forgets her |
| `respirator`, `goggles`, `wrist_scanner_scav`, `handheld_scanner` | 2196 survivors and Sera | Toxic or dust zones; tracking survivors and unstable zones |
| `radio_chest_rig` | Sera and survivors | Squad support calls (faction tasks) |
| `continuum_chest_emitter`, `continuum_forearm_emitter`, `continuum_visor`, `stabilizer_fins` | Continuum troops | The emitter brightens and pulses just before a temporal attack (a telegraph); the visor scan line is the vision cone |
| `recorder_spool` | The Witness | His recordings |

## The game look: rules for motion and readability

- **Proportions**: adults are about 7.5 heads tall and children follow their age; there is no heroic exaggeration. Continuum armour adds at most 3 cm at the shoulders.
- **Silhouette first**: each principal must be identifiable as a flat black shape from behind (the third-person camera). Kai has a hood roll, a diagonal harness and the back emitter. Mira has the gorget and shoulder caps with no gear. The Witness is a long vertical coat. Sera is asymmetric (pauldron and sling). Rook is a long white column. Security wear chunky carriers, transit staff yellow vests and the Continuum smooth helmets.
- **Hand and arm clearance**: no rigid piece sits in the arm-swing corridor (the side of the hip, from 4 cm in front of the hip joint to 4 cm behind it). Hip gear goes at the front buckle area or the back (kidney) position. Wrist pieces are 1.2 cm thick or less, so fingers and the opposite hand do not clip.
- **Legs**: coat tails end at the knee or above (`longshell`), always with a split back vent and skirt weights. Ancient long tunics have side slits. Ponchos and cloaks end above mid-thigh at the front and below the knee at the back, so running reads clearly.
- **Hands**: gloves follow the hand mesh (a shell offset of 2 mm or less) and keep the finger weights. Fingerless gloves are preferred where hands gesture in dialogue.
- **Gadget readability**: every gadget has one bright, simple shape (a ring, bar, dot or lens) and a dark body. Emissive is used as information: it changes state with gameplay and is never a constant neon outline.
- **Wear and story**: 2049 civilians are clean and rain-wet; Kai's kit is used but cared for; the Witness's is the same kit 25 years older; 2196 is patched; ancient wear is handmade with dye unevenness.

## Mobile budgets

| | Triangles (body + clothes + gadgets) | Atlas | Draw calls |
|---|---|---|---|
| Kai | 16 000 (gadgets 2 500 or less) | 2048 | atlas plus at most one glow mesh group |
| Named NPCs | 11 000 (role gadgets 800 or less) | 1024 | atlas plus glow |
| Crowds and children | 9 000 or less (gadgets 300 or less); low LOD 6 000 | 1024 (512 for crowd LOD) | atlas only at low LOD (glow baked into the atlas emissive cell) |

All emissive glow meshes of one colour share a single material per scene, so they batch together. Fine detail (taped seams, quilting, MOLLE webbing, patches, reflective bands, Helix glyphs, plate panel lines) is painted into the atlas colour and normal maps, not modelled.

## New garment types the generator must support

The current vocabulary is `top`: coat, jacket, robe, dress, sweater, uniform, vest, shirt; `bottom`: trousers, skirt, longskirt; `hat`: hood, headscarf, cap, warden, fedora, tophat; `acc`: apron, belt, scarf, buttons, satchel, glasses, mask.

New tops and outer layers:
- `techshell`: a hip-length sealed hooded rain shell with a high stand collar, taped seams, an asymmetric storm flap and articulated elbows
- `longshell`: a knee-length sealed coat or trench with a stand or funnel collar, storm placket and split back vent (replaces `coat` in 2049)
- `cropped_techjacket`: a waist-length jacket with a high collar and LED piping at the zip
- `smart_parka`: a quilted, heated parka at hip or calf length with a funnel collar
- `armored_jacket`: Mira's fitted softshell with gorget, shoulder caps and side rib panels
- `duty_shell`: a security or transit uniform shell with epaulettes and sleeve stripes
- `responder_shell`: a two-tone shell with reflective chevrons
- `labcoat49`: the Helix technical lab coat (mandarin collar, concealed placket, chest tech panel; knee and hip-length variants)
- `labcoat26`: a plain cotton lab coat with notch lapels
- `hoodie`, `bomber`, `puffer`, `utility_jacket`, `padded_jacket`, `car_coat`, `rain_mac` (2026)
- `mock_neck`, `turtleneck`, `tshirt`, `flannel_shirt`, `knit_sweater` (inner layers)
- `field_jacket_worn`: a 2196 patched field jacket with a hood
- `poncho_hooded`, `cloak_hooded`: 2196 and the Unwritten Second (with a shorter front hem)
- `continuum_suit`: a graphite under-suit with segmented ceramic plates (chest, back, pauldrons, bracers, thigh and shin plates, gorget)
- `half_cape`: a shoulder cape to mid-back (Continuum officer)
- `tunic`: ancient, knee, calf or ankle length, sleeveless, short or elbow sleeves, with optional side slits
- `mantle_wrap`: an ancient shoulder wrap or shawl pinned at the shoulder

Vests, harnesses and armour:
- `smart_vest`: hi-vis with two reflective bands, LED edge piping and a back panel
- `plate_carrier`: a security vest with a front panel and low MOLLE pouches
- `chest_harness`: a diagonal shoulder strap and waist belt that give the gadget mount points (Kai and the Witness)
- `scav_plate`: a 2196 carrier built from mismatched plates
- `pauldron`: a single shoulder plate, left or right
- `utility_vest`: a work vest with tool loops (Oskar), a padded instrument vest (Anja), a vendor vest with a card reader
- `leather_cuirass`, `leather_hipwrap`: ancient
- `forearm_guards`, `forearm_wraps`, `shin_wraps`, `knee_pads`

Bottoms:
- `tech_trousers` (articulated knees), `cargo_trousers`, `cargo_joggers`, `work_trousers`, `jeans`, `chinos`, `wide_trousers`, `leggings`, `tech_shorts` (over leggings), `tech_skirt` (pleated, over leggings), `leg_wraps` (ancient)

Footwear:
- `tech_boots`, `combat_boots`, `safety_boots`, `service_boots`, `sneakers`, `chunky_sneakers`, `light_up_sneakers`, `ankle_boots`, `derby_boots`, `loafers`, `leather_work_shoes`, `rain_boots` (children), `wrapped_boots` (2196), `sandals` (ancient, with ankle thongs)

Headwear and hair:
- `hood_down` (a soft rolled hood resting on the upper back; it reads from behind) and `hood_up`
- `tech_cap` (with an optional headlamp mount), `transit_cap` (peaked, with a badge), `tactical_cap`, `beanie`
- `continuum_helmet` (enclosed, with a visor slit; an officer variant has the visor retracted)
- `head_wrap`, `woven_headband` (ancient)
- New hair styles: `waves` (Kai, Mira), `curls` (tight curls), `puffs`, `locs`, `undercut`, `fade`, `pixie`

## New gadget types the generator must support

These sit alongside the existing `glasses` and `mask`.

- Kai and the Witness: `chronolith_band`, `ar_monocle`, `earpiece`, `belt_scanner`, `shoulder_lamp`, `echo_emitter`, `harness_pouches`, `chest_slate_pocket`, `recorder_spool`
- Mira: `gorget_resonance` (glow lines on the collar plate), `chronolith_cuff_thin`
- 2049 crowds: `ar_glasses`, `ar_visor_clip`, `wrist_device`, `kid_locator_band`, `earbuds`, `headset_neck`, `id_badge`, `keycard_reel`, `led_umbrella`, `cube_backpack`, `sling_bag`, `tablet_bag`, `payment_terminal`, `med_pack`, `pen_light`
- Helix security: `shoulder_radio`, `stun_baton`, `body_cam`, `vest_flashlight`, `ar_half_visor`, `restraint_cuffs`
- Maintenance and transit: `tool_belt`, `diagnostic_probe`, `forearm_tablet`, `cap_headlamp`, `transit_tablet`, `signal_wand`, `rugged_slate`, `wrist_slate`
- 2026: `smartphone`, `smartwatch`, `fitness_band`, `crossbody_bag`, `tote_bag`, `school_backpack`, `loupe_cord`
- 2196 survivors: `respirator`, `goggles`, `magnifier_goggles`, `wrist_scanner_scav`, `handheld_scanner`, `radio_chest_rig`, `salvage_backpack`, `rope_coil`, `crank_lamp`, `shard_bandolier`, `sample_rig`
- Continuum: `continuum_chest_emitter`, `continuum_forearm_emitter`, `continuum_visor`, `stabilizer_fins`, `rank_bar`
- Ancient period props (no tech): `bronze_bracelets`, `bronze_armlet`, `bronze_pin`, `bead_necklace`, `tally_cords`, `leather_satchel`, `leather_pouch`, `water_gourd`, `clay_jar`, `staff`, `spear`, `sling`, `flint_knife`, `distaff`, `horn`

## Runtime contract (for the Integrate stage)

- Rigs keep the current bone names and rest orientation, so `assets/models/anims.glb` (the owner's motion capture) keeps retargeting. Never overwrite it.
- Materials keep `userData.slot` (`atlas`, `clothA`, `clothB`, `skin`). Gadget glow meshes use `slot: 'glow'` and `userData.gadget`, and their node names start with `gx_`.
- `ROLE_TEMPLATE` maps each story role to its new build id (the ids below). The crowd `POOLS` change to era pools: `c49_*` for 2049 streets, `helix_*` / `transit_worker` / `technician` for Helix and services, `c26_*` for 2026, `surv_*` / `continuum_*` for 2196 and `anc_*` for the settlement. The pool is picked from `look.era`, so no person shows up in the wrong year.
- `citizenLook` / `settlerLook` recolouring keeps to each era's palette above.

### As integrated (src/core/character.js, src/core/game.js)

- Template choice, first match wins: `look.costume`, `look.template`, `ROLE_TEMPLATE[look.role]`, `look.role` (any of them only when the id is in the cast file), else the era pool. The era comes from `look.era` (`2026` / `past`, `2049` / `present`, `2196` / `future`, `ancient`); looks without one are 2049 unless they wear a sash or leg wraps (ancient). `look.faction` (`helix`, `security`, `transit`, `tech`, `continuum`) picks a uniformed pool; a lab coat in 2049 means `helix` and armour in 2196 means `continuum`. Strangers are dealt round-robin from their pool. Umbrella looks get a build that carries the LED umbrella half the time (the rest wear sealed rain shells); 2026 and 2196 children use `kid_kai` / `lotte`.
- Look helpers in `src/story/cast.js`: `citizenLook` (2049), `settlerLook` (ancient), `survivorLook` (2196, `opts.faction = 'continuum'` for troops) and `pastLook` (2026).
- `character.setGadget(type, on)`: `true` lights a gadget at its "on" level, `false` returns it to idle, a number sets the level; levels ease in `update()`. `character.hasGadget(type)`.
- Hooks: the Chronolith band flashes on every era switch (`temporal.js` sets `wristBoost`); the AR monocle lights while Residue Vision is on (`game.setResidue`); the shoulder lamp is offered in dark scenes (`newScene({ dark })`, or a near-black background; missions can call `game.setLampAvailable(on)`), toggled with L or the touch LAMP button (`game.setLamp(on)`). It is one real SpotLight on the lens (`character.attachLamp`), kept in the scene at zero while off so switching never recompiles shaders; it casts shadows on the high tier only, and its shadow map is only redrawn while it shines.
- Kai's kit, also wired (`game.kitGadgets`): the belt scanner pulses while an interactable is in range and flashes for 0.7 s when evidence reaches the case board; the earpiece blinks while a voice with no body in the scene speaks (`phone`, the PA, radios: `ui.callLine`). Not wired yet: the Echo Step emitter (dark at idle; `src/systems/echostep.js` should call `game.player.char.setGadget('echo_emitter', ...)` on unlock and on each step) and the Chronolith band's stability segments.
- Continuum squads are dealt one officer (`continuum_2`) in four; the rest are helmeted troopers (`continuum_1`).
- Speakers registered without a look (a mission's `neighbor`, the station `child`) get their portrait from their role's build on their first line (`portraitFor`).
- Crowd LOD: people with `look.lod` switch to the 6 000-triangle build beyond 14 m from the camera, and always on tiers whose `characterDetail` hint is `low` (phones).

## Character specs

Body values follow `src/story/cast.js` and `assets/cast/LIKENESS.md`. Ancestries, ages, builds and hair vary across each pool. Voice-only cast (`voice`, `speaker`, `phone`, `echo`, `echo2049`, `recording`) has no costume.


### Principals

#### `kai`: Player: Kai Varen, temporal systems engineer

- **Era**: 2049 (the same techwear in every era he visits) | **Sex**: m | **Age**: 32
- **Body**: 1.83 m, lean-athletic (muscle 0.6, weight 0.45). Warm olive/tan skin b98463. Thick black wavy hair, messy, falling over the brow and ears (new 'waves' style). Heavy dark stubble. Square jaw, straight strong nose, defined cheekbones, deep-set dark eyes under straight heavy brows (likeness: assets/cast/kai_ref.png).
- **Costume**: Hip-length sealed hooded rain shell (techshell) in black coated synthetic with a waxed-leather sheen. It has a high stand collar zipped to the jaw, the hood down in a soft roll on the upper back, taped seams painted as thin satin lines, articulated elbows, an asymmetric storm flap closing on the right and a laminated chest pocket on the left. Under it: a charcoal merino mock-neck. Slate tapered tech trousers with articulated knees and a reinforced seat. Black waterproof tech boots with sculpted grey soles. A fingerless glove on the right hand only, so the left wrist stays bare for the Chronolith band. A slim modular harness (one strap from the left shoulder to the right hip, plus a waist belt with gunmetal buckles) carries every gadget. Silhouette: broad shoulders tapering to narrow hips, hood volume on the back, no coat tails, so the legs read clearly when he runs and climbs.
- **Gadgets**:
  - Chronolith band (left wrist): a segmented gunmetal cuff, 7 cm wide, with a ring of cyan 5fe6ff glyph segments. It idles at 0.15 and flashes to 3.0 over 0.4 s on every era switch (Q). The number of lit segments follows Chronolith stability.
  - AR monocle visor (right temple): a smoked lens on a slim arm from the right ear. It is dark at rest and lights cyan with a faint scan grid while Residue Vision (F) is on.
  - Comm earpiece (left ear): a graphite bud with a pin-point LED that blinks on incoming calls (Rook, Helix PA, the Unknown Voice).
  - Belt scanner (front-right of the harness belt, ahead of the arm-swing path): a palm-size puck with a cyan ring. It pulses when evidence is in interaction range and flashes once when evidence is added to the journal.
  - Shoulder lamp (on the harness strap, high on the left shoulder): a compact hex lamp that casts a cool-white cone in dark areas. The lens glows while it is on.
  - Echo Step emitter (upper back, between the shoulder blades, on the harness): a flat 12 cm hexagonal module with two cyan vents. It stays dark until unlocked (mission 10), shows its charge as vent brightness and flares when Echo Step fires. The third-person camera can see it.
  - Utility harness pouches: two low-profile pouches at the back hips (kidney position, clear of the hands) and a slim slate pocket on the left chest.
- **Palette**: shell 16181c, knit 2a2c2f, trousers 2e3237, boots 1b1611, harness 3a3f46 with brushed buckles 8a9098, glove 1d1a17; emissive cyan 5fe6ff (reserved for Kai)

#### `mira`: Mira Varen, the impossible sister

- **Era**: 2049 / Chronolith (reconstructed; appears in every state) | **Sex**: f | **Age**: 29
- **Body**: 1.69 m, slim-athletic. Fair warm skin d9a585 with a light flush. Dark brown-black wavy hair between chin and shoulder, side part, loose strands. Large grey-blue eyes, arched brows, high cheekbones, slim oval face, full lips (likeness: assets/cast/mira_ref.png).
- **Costume**: A fitted, armoured techwear jacket in matte black-plum softshell. A polished gunmetal collar plate (gorget) wraps the front of the neck and the collarbones. Segmented shoulder caps, quilted rib panels down the sides and a cropped hem at the hip. Hairline violet light piping along the princess seams 'breathes' slowly. Dark slim stretch trousers with bonded knee panels. Low black ankle boots. No harness and no pouches: she carries nothing, so her silhouette reads clean and different from Kai's kit.
- **Gadgets**:
  - Collar-plate resonance: violet 9a7bff light lines etched into the gorget. They brighten when she talks about memory and flicker when she glitches between states (a cue for her dialogue and memory scenes).
  - Unpowered Chronolith cuff (left wrist): a thin echo of Kai's band in tarnished silver. It is dark until the reveal in mission 20, then glows violet.
  - Deliberately unequipped: no earpiece, no visor, no lamp.
- **Palette**: jacket 1c1a22, gorget 8a9098 polished, trousers 1f2227, boots 15120f; emissive violet 9a7bff (reserved for Mira)

#### `witness`: The Witness, older Kai

- **Era**: Future Kai (2049 gear worn for about 25 years) | **Sex**: m | **Age**: 58
- **Body**: 1.81 m, lean and slightly stooped, the same bone structure as Kai but weathered. Skin a77a5d. Silver-grey hair swept back to the collar. Short grey beard and moustache. A scar across the left brow and forehead. Hollow cheeks, deep forehead and eye lines (likeness: assets/cast/witness_ref.png).
- **Costume**: A knee-length sealed coat (longshell) in faded black 2a2724 that turns brown at the wear points (elbows, cuffs, pocket edges, hem). Its high stand collar is turned up, with a storm placket and a split back vent so the legs stay free. Underneath: a darker, patched version of Kai's harness, with one strap re-stitched in a different webbing. Black tech trousers, scuffed tech boots with resoled heels, black gloves on both hands. Silhouette: a tall vertical column (collar to hem), clearly Kai's shape stretched by time.
- **Gadgets**:
  - Chronolith band (left wrist): Kai's cuff, cracked, with two segments permanently dark. It glows red-orange ff6a4a; the light is drawn from his switches and escapes through fractures.
  - Cracked AR monocle (right temple): mostly dark, with one flicker when he scans Kai.
  - Scorched Echo Step emitter on the back: his afterimages are tinted red-orange.
  - Recorder spool clip on the left chest: the recordings he leaves (missions 6 and 17).
- **Palette**: coat 2a2724 worn to 4a3a2c, harness 2a2a2c, trousers 202020, boots 141210, gloves 111111; emissive red-orange ff6a4a (reserved for the Witness)

#### `sera`: Sera Voss, resistance leader

- **Era**: 2196 | **Sex**: f | **Age**: 34
- **Body**: 1.72 m, athletic and strong. Tan skin 8a5b3c with grime. Dark brown hair pulled back loosely with strands falling around the face. A fresh scar from the forehead down across the left side of the face. Grey-green eyes, determined brows (likeness: assets/cast/sera_ref.png).
- **Costume**: A worn brown canvas-ripstop field jacket with a hood down on the back. The elbows are patched in different cloth, the hems are faded and the cuffs frayed. Over it: a scavenged chest plate (a carrier built from mismatched olive polymer plates and old Helix security armour, its stencil half scraped off) and a single left pauldron. Cargo trousers with knee pads (one is cut from tyre rubber). Cloth-wrapped forearms. Worn lace-up combat boots. A rifle-sling strap runs diagonally across the back. Silhouette: asymmetric (the pauldron on one side, the sling on the other) and practical.
- **Gadgets**:
  - Respirator half-mask hanging at the neck: it snaps up over the face in dust and toxic zones.
  - Dust goggles around the neck, the lenses scratched amber.
  - Scavenged wrist scanner (right forearm, in a padded sleeve): a cracked screen with a green b6ff8a readout. It tracks survivors and unstable temporal zones (mission 14 'track survivors').
  - Short-range radio clipped to the chest plate: squad support calls, with a green blink when her squad answers.
  - Salvage belt: a tool roll, a rolled map and two canvas pouches at the back hips.
- **Palette**: jacket 4a3a28 faded to 6a5a44, plates 3a3a2c / 4a4a3a scratched, trousers 3a3a30, wraps 8a7a60, boots 2a2018; emissive resistance green b6ff8a

#### `rook`: Dr. Elias Rook, Director of Helix Temporal Research

- **Era**: 2049 | **Sex**: m | **Age**: 62
- **Body**: 1.78 m, slim and upright. Pale-warm skin d3a487 with age spots. Long narrow face, high forehead, receding silver-white hair combed back neatly, thin lips, a prominent straight nose and deep-set pale blue-grey eyes with crow's feet.
- **Costume**: The Helix director's lab coat: a knee-length white technical coat in matte coated twill. It has a high mandarin collar, a concealed placket, bonded seams, a split back vent and a slim tech panel down the left chest (a dark glass strip with the Helix glyph and a faint white light). Under it: a navy-slate fine-knit mock-neck. Tailored charcoal trousers and polished black derby boots. Silhouette: a long, clean white column with no straps, so authority reads at a distance.
- **Gadgets**:
  - Rimless AR glasses: a thin white HUD edge glow while he reads data or calls Kai.
  - Director's access badge: a gold-edged keycard held magnetically on the coat pocket. It is the badge the player clones or steals for access gates.
  - Comm earpiece (small, white).
  - Wrist slate (left wrist, white band): it lights when he is on a call to Kai.
- **Palette**: coat e8eaec, panel 1a1e24 with Helix teal 38c8c0 glyph, knit 2f3542, trousers 2a2e36, boots 14151a; emissive white f2f6ff, low

#### `niko`: Niko, keeper of the settlement

- **Era**: ANCIENT settlement (about 3000 years ago) | **Sex**: m | **Age**: 19
- **Body**: 1.66 m, slender (build 0.92). Deep brown skin 8c5a3a. Short tight black curls (new 'curls' style). A youthful round-oval face, broad nose, full lips, large dark eyes, no facial hair.
- **Costume**: A knee-length undyed flax linen tunic with short sleeves and a rolled neck edge. A wide red-madder sash wrapped twice and knotted at the left hip, over a narrow leather belt. Linen leg wraps to below the knee and leather sandals with ankle thongs. A woven cord over the right shoulder carries knotted tally cords, the keeper's memory record.
- **Gadgets**:
  - No technology. Keeper's items: bronze cuff bracelets on both wrists.
  - Knotted tally cords on the shoulder cord (the oral-history clues).
  - A small leather satchel at the back hip holding clay tablets (observatory clues).
  - A carved wooden staff (hand prop for idle and talk poses only).
- **Palette**: tunic cdb48a, sash 9b3b24, wraps 7a6248, leather 5a3e28, bronze c9a050

#### `tala`: Tala, water keeper

- **Era**: ANCIENT settlement | **Sex**: f | **Age**: 41
- **Body**: 1.64 m, strong and grounded. Dark brown skin 7d4f33. Strong cheekbones, wide nose, full lips, smile lines. Black hair in a low bun with a few grey strands.
- **Costume**: A calf-length teal-indigo linen tunic with elbow sleeves and a side slit for walking. A saffron-gold sash. A short undyed linen mantle wrapped over the left shoulder and pinned. Leg wraps and leather sandals.
- **Gadgets**:
  - No technology. Water keeper's kit: a bronze armlet on the upper right arm and bronze bracelets.
  - A gourd water flask on a cord at the right hip.
  - A bronze measuring rod hung from the sash (the water-routing clue).
  - A clay-bead necklace.
- **Palette**: tunic 3f6a6a, sash d0a24a, mantle d9c9a0, wraps 5a4632, leather 4a3220, bronze d9b25c

#### `iven`: Iven Marr, Helix maintenance technician

- **Era**: 2049 | **Sex**: m | **Age**: 45
- **Body**: 1.76 m, average-solid build. Fair freckled skin e0b394, flushed at the cheeks. Short ginger-brown hair and reddish stubble. A wide face, snub nose and tired light-green eyes.
- **Costume**: A grey technical knit sweater with reinforced shoulder patches, under an orange smart hi-vis vest. The vest has two silver reflective bands, amber LED piping along its edges and a 'HELIX MAINTENANCE' panel on the back. Charcoal work trousers with knee-pad pockets. Scuffed safety boots with toe caps. Brown work gloves. A graphite tech cap with a clip-on headlamp.
- **Gadgets**:
  - Tool belt: a multi-driver, a torque driver, a cable spool and a holstered diagnostic probe (power-reroute puzzles).
  - Forearm tablet (left forearm): a rugged slate with an orange bumper that shows maintenance access codes.
  - Cap headlamp (warm white): it lights in dark maintenance tunnels.
  - An ear-defender headset around the neck with a boom mic (team radio).
  - A keycard on a retractable reel at the belt (the 'Technician's Key' quest).
- **Palette**: knit 37404a, vest d9781e with reflective c8ccd0, trousers 2c333b, boots 2a2018, gloves 5a4a3a, cap 2a3440; emissive amber ff9a3a

#### `jun`: Jun Park, Rain City transit operator

- **Era**: 2049 | **Sex**: m | **Age**: 42
- **Body**: 1.74 m, average build. East Asian, light warm skin d8b08e. A round face, monolid eyes and short straight black hair, clean-shaven; kind but worried.
- **Costume**: The transit service uniform: a sealed navy rain shell with a high collar and the transit-line stripe on both sleeves. Over it, a yellow smart hi-vis vest with LED strips that pulse during station announcements. Navy trousers with reflective ankle bands, black service boots, and a navy peaked cap with the transit badge.
- **Gadgets**:
  - Transit tablet (chest clip, or held in the left hand while talking): the station schedule and the repeating 41-second announcement.
  - Signal wand at the belt: an amber light baton for guiding passengers (Last Train Home).
  - Earpiece and shoulder mic (station comms).
  - A staff ID on a lanyard.
- **Palette**: shell 1d2a44, vest d4c21a with reflective c8ccd0, trousers 1d2a44, boots 111111, cap 1d2a44; emissive transit yellow ffd34a

#### `hale`: Officer Hale, Helix security (night shift)

- **Era**: 2049 | **Sex**: m | **Age**: 48
- **Body**: 1.85 m, big and heavy (build 1.08). Ruddy skin c49a7c. Grey-brown buzz cut, broad square jaw, thick neck, heavy brows, a slightly broken nose, grey-blue eyes.
- **Costume**: Helix security duty uniform: a sealed navy duty shell with a high collar and shoulder epaulettes carrying red Helix chevrons. A black tactical plate carrier with a Helix SECURITY panel and low MOLLE pouches. A duty belt. Navy trousers bloused into black tactical boots. Black gloves.
- **Gadgets**:
  - Shoulder radio with a red ff4d5e status LED: steady while he patrols, pulsing red once he is alerted (a readable stealth cue).
  - Stun baton holstered at the right back hip: a blue-white tip glow when drawn.
  - Body cam on the chest: a red dot while recording (the logs that do not show his orders).
  - Vest flashlight on the left shoulder: its cone is his vision cone in dark patrols.
  - Comm earpiece.
- **Palette**: shell 1c2533, carrier 111820, trousers 1c2533, boots 0f0f10, gloves 101010, chevrons a8262e; emissive security red ff4d5e

#### `brandt`: Officer Brandt, Helix security (Rook's problem-solver)

- **Era**: 2049 | **Sex**: m | **Age**: 37
- **Body**: 1.80 m, lean and hard (build 1.0). Pale skin e2b896. A long narrow face, thin lips, sandy-blond hair swept back, light stubble, cold blue eyes.
- **Costume**: The same Helix duty shell and plate carrier as Hale, but cut leaner. He also wears tactical forearm guards and a slim tactical cap pushed back, without a peak badge. His carrier has a single magazine-style scanner pouch instead of Hale's flashlight, which keeps the two silhouettes distinct.
- **Gadgets**:
  - Tactical AR half-visor (a red-tinted bar across the brow): a red scan line sweeps across it while he searches, and it locks solid when he spots the player.
  - Holstered stun baton at the right back hip.
  - Restraint cuffs on the back of the belt.
  - Shoulder radio with a red LED.
  - Comm earpiece.
- **Palette**: shell 1c2533, carrier 111820, guards 22262c, trousers 1c2533, boots 0f0f10, gloves 101010; emissive security red ff4d5e

#### `child`: The Child in the Station (Rain City)

- **Era**: 2049 | **Sex**: f | **Age**: 8
- **Body**: About 1.27 m, a slight child. Light skin f0c8a8 with freckles. A round face, big brown eyes and short brown hair (bob).
- **Costume**: A yellow hooded smart raincoat: sealed, knee-length on a child, hood up or down, with reflective strips at the cuffs and hem and a soft warm-white LED trim along the hood edge (kids' safety wear in 2049). Grey thermal joggers and red rubber rain boots.
- **Gadgets**:
  - A child locator band (left wrist): a soft yellow glow that dims when the timeline 'forgets' her.
  - A small tune toy (a palm-size music box): the familiar-tune clue and the toy that jumps back into her hand in mission 1.
- **Palette**: raincoat e8b923, reflective d8dce0, joggers 6a6e74, boots b0262c; emissive warm white ffe6b0

#### `anja`: Dr. Anja Vale, 2196 temporal scientist (bible NPC; not yet registered)

- **Era**: 2196 | **Sex**: f | **Age**: 46
- **Body**: 1.70 m, slim and wiry. South Asian, brown skin a06a46. Dark hair with a grey streak in a practical braid. Fine laugh lines and intelligent dark eyes.
- **Costume**: A survivor's field lab coat: a hip-length, faded white-grey hooded coat cut down from an old lab coat, its hem cut and re-bound in canvas and its sleeves patched with ochre cloth. Over it, a padded utility vest of scavenged instrument pockets. Canvas trousers with wraps at the shins, and repaired boots.
- **Gadgets**:
  - Head-mounted magnifier goggles with a green readout lens (anomaly diagnosis).
  - A handheld temporal sensor on a coiled cable at the vest: a rebuilt Helix probe with a green b6ff8a screen.
  - A respirator at the neck.
  - Sample vials in a chest rig.
- **Palette**: coat c8c4b8 worn, patches 8a6a3a, vest 4a4a38, trousers 6a5a44, boots 2a2018; emissive green b6ff8a

#### `mara`: Mara Quill, 2196 archivist (bible NPC; not yet registered)

- **Era**: 2196 | **Sex**: f | **Age**: 61
- **Body**: 1.62 m, slight. Caucasian, pale weathered skin e0b8a0. Silver hair cropped short, rectangular repaired glasses and a soft, watchful face.
- **Costume**: A long, hooded, layered cloak of grey felted wool with hand-stitched pockets inside the front edges (for records). Under it, a quilted dark jerkin, wide canvas trousers and wrapped boots.
- **Gadgets**:
  - Repaired reading glasses with a clip-on magnifier.
  - A data-shard bandolier: a diagonal strap holding rows of recovered memory shards, each with a faint green index light.
  - A hand-crank archive reader (a palm slate) on a cord.
- **Palette**: cloak 6a6a64, jerkin 2a2a28, trousers 8a7458, boots 3a2a1c; emissive green b6ff8a, low

#### `orren`: Orren, guide of the Unwritten Second (bible NPC; not yet registered)

- **Era**: Unwritten Second (outside time) | **Sex**: m | **Age**: 50
- **Body**: 1.78 m, calm and upright. Mixed ancestry, olive skin b88560. Close-cropped dark hair with grey at the temples and a calm, symmetric face.
- **Costume**: Deliberately eraless: a plain ash-grey hooded long wrap over a simple high-necked tunic, soft trousers and soft wrapped boots. No seams, logos or tech. The garment edges dissolve into faint white light particles (done in the shader, not in geometry).
- **Gadgets**:
  - None (by design). A thin ring of pale light around the left wrist echoes the Chronolith without being one.
- **Palette**: wrap 8a8a86, tunic b8b4ac, boots 5a5a56; emissive pale white e8eef8, very low


### Mission extras

#### `caretaker`: Ingrid Holt, caretaker of Reservoir 7 (mission 5)

- **Era**: 2049 | **Sex**: f | **Age**: 57
- **Body**: 1.66 m, sturdy (build 1.02). Fair skin cf9f82. Short grey-brown hair, glasses, weathered and calm.
- **Costume**: A graphite-olive softshell field parka to mid-thigh (hood down, taped seams, high collar) over a technical knit. Cargo trousers and waterproof work boots.
- **Gadgets**:
  - An AR earpiece (dam telemetry).
  - A ruggedised slate on a chest strap (dam controls and the reservoir log).
  - A key ring on a belt clip (the service doors).
- **Palette**: parka 3d4842, knit 3b4441, trousers 272b30, boots 1b1d20; emissive soft teal 7fd8d0, low

#### `oskar`: Oskar Hensel, clockmaker of the Old Quarter (mission 6)

- **Era**: 2049 | **Sex**: m | **Age**: 78
- **Body**: 1.70 m, slight (build 0.94). Pale skin e6bea4. White swept hair, a white beard and glasses, with a kind, lined face.
- **Costume**: A graphite thermal knit under a waxed-canvas utility vest with tool loops, a loupe pocket and a pen sleeve. This replaces the bench apron: no aprons in 2049. Slate technical trousers and soft-soled leather work shoes.
- **Gadgets**:
  - AR loupe spectacles: a flip-down magnifier lens that glows faint amber when he inspects a movement.
  - A micro-driver roll in the vest.
  - An old smartband on the left wrist, its screen cracked and set to the wrong time.
- **Palette**: knit 3a3f45, vest 4a3a2a, trousers 2e3338, shoes 1c1a18; emissive amber ffc070, low

#### `oskar26`: Oskar Hensel at 55, clockmaker (mission 6, 2026 state)

- **Era**: 2026 | **Sex**: m | **Age**: 55
- **Body**: 1.71 m, average build. Fair skin e2b496. Swept brown hair going grey, stubble and glasses.
- **Costume**: An oatmeal crew-neck jumper over a denim work shirt with the sleeves pushed up and ink on the cuffs. A brown canvas work vest with pockets replaces the shop apron. Dark jeans and leather work shoes.
- **Gadgets**:
  - A jeweller's loupe on a cord around the neck.
  - A 2026 smartphone in the vest pocket.
  - A plain smartwatch.
- **Palette**: jumper bcb19c, shirt 5a6e8a, vest 5a4a38, jeans 2e3a4c, shoes 3a2a1c; no emissive

#### `lotte`: Lotte Hensel, the clockmaker's daughter, age 8 (mission 6)

- **Era**: 2026 | **Sex**: f | **Age**: 8
- **Body**: 1.27 m, slight child. Fair skin f2cdb2 with freckles. Dark-blonde hair tied back and big blue eyes.
- **Costume**: A red zip hoodie (hood down), a white T-shirt, blue jeans and white trainers.
- **Gadgets**:
  - A kids' smartwatch (purple band, small screen).
  - A small school backpack with a keyring charm.
- **Palette**: hoodie b03a44, jeans 3a5078, trainers e6e2da; no emissive

#### `kid_kai`: Kai at 7 (residue echo, mission 6)

- **Era**: 2026 | **Sex**: m | **Age**: 7
- **Body**: 1.22 m, a slight child. Skin b98463. Messy black hair and Kai's dark eyes.
- **Costume**: A blue hooded rain jacket, a grey T-shirt, navy trousers and brown kids' shoes with Velcro straps.
- **Gadgets**:
  - A cheap digital watch, one size too big (a family-memory detail).
- **Palette**: jacket 2a4a6a, trousers 2f3a4e, shoes 3a2a1a; rendered as cyan residue ghost

#### `kid_mira`: Mira at 10 (residue echo, mission 6)

- **Era**: 2026 | **Sex**: f | **Age**: 10
- **Body**: 1.36 m, slim child. Skin d9a585. A dark bob and green-grey eyes.
- **Costume**: A burgundy knit sweater over a white collar, dark trousers and brown shoes.
- **Gadgets**:
  - A hair clip and a sketchbook (a hand prop; the drawing of the black circular machine).
- **Palette**: sweater 6a2a3a, trousers 1f2227, shoes 3a2a1a; rendered as cyan residue ghost

#### `neighbor`: Neighbour, clock quarter (mission 6)

- **Era**: 2049 | **Sex**: m | **Age**: 46
- **Body**: 1.76 m, average build. Skin c89a7a. Short dark hair and stubble.
- **Costume**: A sealed charcoal rain shell with a hood and a high collar over a dark knit. Dark trousers and waterproof boots.
- **Gadgets**:
  - A wrist device (smartband, a soft white notification glow).
  - An earbud.
  - An LED-rim umbrella (2049 street prop).
- **Palette**: shell 2a3038, knit 262c32, trousers 1c2026, boots 141210, umbrella 1e2a36; emissive white, low

#### `potter`: Iru, potter of the upper terrace (mission 5)

- **Era**: ANCIENT settlement | **Sex**: f | **Age**: 46
- **Body**: 1.60 m, solid (build 1.0). Dark brown skin 7d4f33. Black hair in a bun, strong forearms and laugh lines.
- **Costume**: An ochre linen tunic with the sleeves tied back at the elbow, a red-ochre wrap at the hips, leg wraps and sandals. A short leather hip-wrap, clay-stained, protects the tunic (period-correct, not a modern apron).
- **Gadgets**:
  - No technology. Bronze bracelets.
  - Clay slip stains on the hands and forearms (painted on the atlas).
  - A wooden potter's rib tucked into the wrap.
- **Palette**: tunic b4884e, wrap 9b3b24, leather 5a3e28 clay-stained 9a7a5a, wraps 5a4632, bronze c9a050

#### `villager`: Villager of the lower village (mission 5 speaker)

- **Era**: ANCIENT settlement | **Sex**: m | **Age**: 52
- **Body**: 1.70 m, wiry. Deep brown skin 6b4029. Short greying curls and a trimmed beard.
- **Costume**: A knee-length undyed tunic with a woven indigo-teal belt sash, a rolled shoulder wrap and leg wraps with sandals.
- **Gadgets**:
  - No technology. A leather pouch and a flint knife in a sheath at the sash.
  - A wooden walking stick (hand prop).
- **Palette**: tunic d9c9a0, sash 2f5a5a, wrap b89a6a, leather 4a3220


### Crowd 2049 civilians

#### `c49_m1`: Civilian: young professional

- **Era**: 2049 | **Sex**: m | **Age**: 24
- **Body**: 1.76 m, slim. East Asian, light skin e8c0a0. Black undercut hair, clean-shaven.
- **Costume**: A cropped black techwear jacket with a high collar and magenta LED piping at the zip. Grey cargo joggers with cinched ankles and chunky black sneaker-boots.
- **Gadgets**:
  - AR glasses (thin teal edge).
  - A wrist device.
  - Earbuds.
- **Palette**: jacket 18191d, joggers 3a3e44, shoes 141414; emissive magenta ff4fa0, low

#### `c49_m2`: Civilian: commuter

- **Era**: 2049 | **Sex**: m | **Age**: 38
- **Body**: 1.84 m, athletic. West African ancestry, deep skin 6b4029. A short fade and a trimmed beard.
- **Costume**: A long charcoal sealed rain coat to the knee (longshell) with a high collar, storm placket and split vent. Slim dark trousers and waterproof chelsea-style tech boots.
- **Gadgets**:
  - A wrist device (white glow).
  - An LED-rim umbrella.
- **Palette**: coat 2a2f36, trousers 1a1d22, boots 141210; emissive white, low

#### `c49_m3`: Civilian: shop owner

- **Era**: 2049 | **Sex**: m | **Age**: 55
- **Body**: 1.72 m, stocky. South Asian, brown skin a16d4c. Short black-grey hair and a neat grey beard.
- **Costume**: An olive quilted smart parka, hip length, with heated collar panels (a faint amber glow at the collar). Brown trousers and leather tech boots.
- **Gadgets**:
  - AR reading glasses.
  - A transit pass on a lanyard.
  - A rugged phone-slate in hand.
- **Palette**: parka 3c4430, trousers 3a2f2a, boots 1c1612; emissive amber ffb347, low

#### `c49_m4`: Civilian: bike courier

- **Era**: 2049 | **Sex**: m | **Age**: 31
- **Body**: 1.86 m, lean. Nordic ancestry, fair skin f1c6a8. Swept blond hair and light stubble.
- **Costume**: A sealed graphite rain shell with a reflective chest harness, black tech shorts over thermal leggings, and high-top waterproof sneakers.
- **Gadgets**:
  - An insulated cube backpack with a green delivery-status light.
  - A clip-on AR visor.
  - A wrist device.
- **Palette**: shell 2d3640, harness c8ccd0 reflective, shorts 1d2430, sneakers 202020; emissive mint 6affc8

#### `c49_m5`: Civilian: retired engineer

- **Era**: 2049 | **Sex**: m | **Age**: 67
- **Body**: 1.70 m, average build. Mediterranean, olive skin d9a585. Silver swept hair and glasses.
- **Costume**: A navy wool-blend smart overcoat (knee length, sealed, with a modern stand collar; no lapels or tails), a grey knit scarf, charcoal trousers and black leather tech shoes.
- **Gadgets**:
  - AR glasses.
  - A health-monitor wrist band.
  - An umbrella that doubles as a walking cane.
- **Palette**: coat 202833, scarf 6a6e74, trousers 23262b, shoes 141210; emissive white, very low

#### `c49_m6`: Civilian: street-food vendor

- **Era**: 2049 | **Sex**: m | **Age**: 45
- **Body**: 1.78 m, heavy-set. Latino, tan skin b98463. Short black hair and stubble.
- **Costume**: A wipe-clean waterproof work shell with wipe-down sleeve guards and a vendor vest with a card-reader panel instead of an apron. Dark work trousers and non-slip boots.
- **Gadgets**:
  - A belt payment terminal (green tap light).
  - An earpiece for order calls.
- **Palette**: shell 3a3f46, vest 1f3a3a, trousers 23262b, boots 141210; emissive green 6affc8, low

#### `c49_f1`: Civilian: designer

- **Era**: 2049 | **Sex**: f | **Age**: 27
- **Body**: 1.65 m, slim. Korean, light skin f1c6a8. Long straight black hair.
- **Costume**: An asymmetric white-grey rain shell with a translucent smoked hood and a high collar, slim black trousers and platform sneaker-boots.
- **Gadgets**:
  - AR glasses (teal edge).
  - A wrist device.
- **Palette**: shell c4c4c8, trousers 18191d, boots e0e0e0 soles 202020; emissive teal 38c8c0, low

#### `c49_f2`: Civilian: nurse off shift

- **Era**: 2049 | **Sex**: f | **Age**: 34
- **Body**: 1.74 m, athletic. East African, deep skin 6b4029. Braids gathered in a high ponytail.
- **Costume**: An oxblood sealed trench (longshell) with a belt line of soft LED piping, black thermal leggings and ankle boots.
- **Gadgets**:
  - A wrist device.
  - A hospital ID on a retractable reel.
- **Palette**: coat 4a1f24, leggings 1a1d22, boots 141210; emissive amber ffb347, low

#### `c49_f3`: Civilian: office worker

- **Era**: 2049 | **Sex**: f | **Age**: 48
- **Body**: 1.68 m, soft build. Caucasian, fair skin e8b996. An auburn bob.
- **Costume**: A navy smart parka with a high funnel collar (hip length, sealed), wide charcoal trousers and waterproof boots.
- **Gadgets**:
  - An earpiece.
  - An LED-rim umbrella.
  - A slim tablet bag across the body.
- **Palette**: parka 1d2430, trousers 2d2a26, boots 141210; emissive white, low

#### `c49_f4`: Civilian: student

- **Era**: 2049 | **Sex**: f | **Age**: 22
- **Body**: 1.62 m, slim. Mixed South Asian and European, skin c8916c. A dark-brown pixie crop with teal-tipped ends.
- **Costume**: An oversized techwear hoodie-shell with mint LED drawcords, a pleated tech skirt over thermal leggings (a modern skirt, not a period dress) and chunky sneakers.
- **Gadgets**:
  - AR glasses.
  - A sling bag with a tablet.
  - Earbuds.
- **Palette**: shell 2a2a2a, skirt 3a3e44, leggings 1a1d22, sneakers e6e2da; emissive mint 6affc8, low

#### `c49_f5`: Civilian: grandmother

- **Era**: 2049 | **Sex**: f | **Age**: 62
- **Body**: 1.60 m, slim. Chinese, light skin e8c0a0. Short grey hair and glasses.
- **Costume**: A long quilted heated coat to below the knee (sealed, stand collar), soft dark trousers and cushioned walking shoes.
- **Gadgets**:
  - A health-monitor wrist band (soft green).
  - A cane umbrella.
  - AR glasses.
- **Palette**: coat 3a2f2a, trousers 23262b, shoes 2a2a2a; emissive green 6affc8, very low

#### `c49_f6`: Civilian: emergency responder

- **Era**: 2049 | **Sex**: f | **Age**: 39
- **Body**: 1.70 m, curvy and strong. Latina, tan skin b98463. Long dark wavy hair in a low ponytail.
- **Costume**: A red-and-graphite responder shell with reflective chevrons on the back and sleeves, graphite cargo trousers and safety boots.
- **Gadgets**:
  - A trauma med pack on the hip.
  - A shoulder radio (white LED).
  - A pen-light.
- **Palette**: shell a8262e / 2a2f36, reflective c8ccd0, trousers 2a2f36, boots 141210; emissive white f2f6ff

#### `c49_kid_m`: Civilian child: schoolboy

- **Era**: 2049 | **Sex**: m | **Age**: 10
- **Body**: 1.38 m, slim child. South Asian, skin a16d4c. Short black hair.
- **Costume**: A navy kids' rain shell with a reflective strip, grey joggers and light-up sneakers (a small soft glow at the soles).
- **Gadgets**:
  - A child locator band.
  - A school tablet backpack.
- **Palette**: shell 1d2a44, joggers 6a6e74, sneakers e6e2da; emissive teal 38c8c0, low

#### `c49_kid_f`: Civilian child: little girl

- **Era**: 2049 | **Sex**: f | **Age**: 6
- **Body**: 1.15 m, small child. Black, deep skin 8c5a3a. Two curly puffs.
- **Costume**: A mint rain cape-jacket with a hood and snap sleeves, leggings and yellow rain boots.
- **Gadgets**:
  - A child locator band.
  - A small LED-rim umbrella.
- **Palette**: jacket 6abfa8, leggings 2a2a44, boots e8b923; emissive warm white, low


### Crowd 2049 Helix and services

#### `helix_sci_m`: Helix scientist

- **Era**: 2049 | **Sex**: m | **Age**: 36
- **Body**: 1.79 m, average build. Middle Eastern, olive skin c8916c. Short dark hair and a trimmed beard.
- **Costume**: The Helix 2049 lab coat: knee-length white technical coat with a mandarin collar, a tech panel strip on the left chest and the Helix teal glyph. A grey knit underneath, dark trousers and white-grey tech sneakers.
- **Gadgets**:
  - AR glasses.
  - A Helix staff badge (the keycard tier below Rook's).
  - A data slate in hand.
- **Palette**: coat e8eaec, panel 1a1e24, knit 6a6e74, trousers 23262b, sneakers d8dce0; emissive Helix teal 38c8c0

#### `helix_sci_f`: Helix scientist

- **Era**: 2049 | **Sex**: f | **Age**: 44
- **Body**: 1.63 m, slim. Japanese, light skin f1c6a8. A black bob with a few greys.
- **Costume**: The Helix lab jacket (the hip-length variant of the coat, with the same mandarin collar and tech panel) over a navy mock-neck. Slim grey trousers and white tech sneakers.
- **Gadgets**:
  - A headset with a boom mic.
  - A wrist slate.
  - A Helix staff badge.
  - A sealed sample case (hand prop).
- **Palette**: jacket e8eaec, knit 1d2430, trousers 4a4e54, sneakers e6e2da; emissive Helix teal 38c8c0

#### `helix_sec_1`: Helix security guard

- **Era**: 2049 | **Sex**: m | **Age**: 32
- **Body**: 1.88 m, muscular. Black, deep skin 5a3622. Short crop, clean-shaven.
- **Costume**: The Helix duty shell, black plate carrier, duty belt, navy trousers bloused into tactical boots, and a black tactical cap.
- **Gadgets**:
  - A shoulder radio with a red alert LED.
  - A holstered stun baton.
  - A body cam.
  - A vest flashlight.
- **Palette**: shell 1c2533, carrier 111820, trousers 1c2533, boots 0f0f10; emissive security red ff4d5e

#### `helix_sec_2`: Helix security guard

- **Era**: 2049 | **Sex**: f | **Age**: 35
- **Body**: 1.75 m, athletic. Latina, tan skin b98463. Dark hair in a tight bun.
- **Costume**: The Helix duty shell and plate carrier (fitted cut) with forearm guards, navy trousers and tactical boots.
- **Gadgets**:
  - A tactical AR half-visor (red scan line).
  - A shoulder radio.
  - A holstered stun baton.
  - Restraint cuffs.
- **Palette**: shell 1c2533, carrier 111820, guards 22262c, boots 0f0f10; emissive security red ff4d5e

#### `transit_worker`: Rain City transit worker

- **Era**: 2049 | **Sex**: f | **Age**: 29
- **Body**: 1.64 m, average build. Filipino, warm skin c8916c. Black hair in a low ponytail under a cap.
- **Costume**: A navy transit rain shell with the line stripe, a yellow smart hi-vis vest with LED strips, navy trousers with reflective ankle bands, service boots and a navy cap.
- **Gadgets**:
  - A transit tablet on a chest clip.
  - A signal wand.
  - An earpiece and shoulder mic.
- **Palette**: shell 1d2a44, vest d4c21a, trousers 1d2a44, boots 111111; emissive transit yellow ffd34a

#### `technician`: Helix / city maintenance technician

- **Era**: 2049 | **Sex**: f | **Age**: 38
- **Body**: 1.70 m, strong. Slavic, fair skin f1c6a8. A red-brown braid.
- **Costume**: A charcoal work shell with an orange smart hi-vis vest (reflective bands and amber LED edge piping), knee-pad work trousers and safety boots.
- **Gadgets**:
  - A tool belt.
  - A forearm tablet.
  - A cap headlamp (or a helmet lamp).
  - A diagnostic probe.
- **Palette**: shell 2c333b, vest d9781e, trousers 2c333b, boots 2a2018; emissive amber ff9a3a


### Crowd 2026

#### `c26_m1`: 2026 civilian: young man

- **Era**: 2026 | **Sex**: m | **Age**: 29
- **Body**: 1.82 m, athletic. Black British, deep skin 6b4029. A short fade.
- **Costume**: A grey marl hoodie under a black bomber jacket, dark-wash jeans and white sneakers.
- **Gadgets**:
  - White earbuds.
  - A smartphone in hand.
  - A smartwatch.
- **Palette**: hoodie 8a8d92, bomber 18191d, jeans 2e3a4c, sneakers e6e2da; no emissive

#### `c26_m2`: 2026 civilian: father

- **Era**: 2026 | **Sex**: m | **Age**: 47
- **Body**: 1.78 m, a soft dad build. Caucasian, fair skin e8b996. Receding short brown hair and stubble.
- **Costume**: A navy padded jacket over a checked flannel shirt, khaki chinos and brown leather boots.
- **Gadgets**:
  - A fitness band.
  - A smartphone.
- **Palette**: jacket 1f2a36, shirt 6a3a3a / 2f4a3a check, chinos a89a7a, boots 5a3e28; no emissive

#### `c26_m3`: 2026 civilian: older man

- **Era**: 2026 | **Sex**: m | **Age**: 63
- **Body**: 1.70 m, slim. South Asian, brown skin a16d4c. Grey hair and glasses.
- **Costume**: A camel car coat (a modern mid-thigh overcoat), a grey crew-neck, charcoal trousers and leather shoes.
- **Gadgets**:
  - Reading glasses.
  - A smartphone.
- **Palette**: coat b08a5a, knit 6a6e74, trousers 2d2a26, shoes 2a1d14; no emissive

#### `c26_f1`: 2026 civilian: student

- **Era**: 2026 | **Sex**: f | **Age**: 24
- **Body**: 1.62 m, slim. East Asian, light skin e8c0a0. Long straight black hair.
- **Costume**: An oversized cream knit sweater under a black puffer jacket, wide-leg light jeans and chunky white sneakers.
- **Gadgets**:
  - Wireless earbuds.
  - A crossbody phone bag.
- **Palette**: knit e0d8c4, puffer 18191d, jeans 6a7a94, sneakers e6e2da; no emissive

#### `c26_f2`: 2026 civilian: professional

- **Era**: 2026 | **Sex**: f | **Age**: 38
- **Body**: 1.68 m, average build. Latina, tan skin c8916c. Dark wavy shoulder-length hair.
- **Costume**: An olive utility jacket over a black turtleneck, black jeans and leather ankle boots.
- **Gadgets**:
  - A smartwatch.
  - A tote bag with a laptop.
- **Palette**: jacket 4a4a32, turtleneck 18191d, jeans 1a1d22, boots 2a1d14; no emissive

#### `c26_f3`: 2026 civilian: older woman

- **Era**: 2026 | **Sex**: f | **Age**: 55
- **Body**: 1.65 m, average build. Caucasian, fair skin f1c6a8. A silver-blonde bob and glasses.
- **Costume**: A navy rain mac (a modern belted trench to the knee), a Breton-striped top, slim trousers and loafers.
- **Gadgets**:
  - Glasses.
  - A smartphone.
  - A compact umbrella.
- **Palette**: mac 1d2430, top e8e4dc / 1d2430 stripe, trousers 2d2a26, loafers 3a2a1c; no emissive


### Crowd 2196

#### `surv_m1`: Survivor: scavenger

- **Era**: 2196 | **Sex**: m | **Age**: 41
- **Body**: 1.78 m, wiry. Middle Eastern, olive skin a77a5d with grime. Short dark hair and a full beard.
- **Costume**: A patched, hooded dust-ochre poncho over layered rags and a scavenged chest plate, wrapped cargo trousers and resoled boots.
- **Gadgets**:
  - A respirator worn on the face.
  - Goggles.
  - A handheld scanner (green screen) for salvage and anomalies.
  - A salvage backpack.
- **Palette**: poncho 8a7458, plate 4a4a3a, trousers 5a4a38, boots 2a2018; emissive green b6ff8a

#### `surv_f1`: Survivor: scout

- **Era**: 2196 | **Sex**: f | **Age**: 28
- **Body**: 1.70 m, athletic. Black, deep skin 6b4029. Short locs tied back.
- **Costume**: A cropped, patched field jacket with a pauldron cut from a road sign, cargo trousers with shin wraps and combat boots.
- **Gadgets**:
  - Goggles on the brow.
  - A respirator at the neck.
  - A wrist scanner.
  - A rope coil.
  - A hand-crank lamp.
- **Palette**: jacket 6a5a44, pauldron 7a6a3a faded yellow, trousers 4a4a32, boots 2a2018; emissive green b6ff8a

#### `surv_m2`: Survivor: elder mechanic

- **Era**: 2196 | **Sex**: m | **Age**: 63
- **Body**: 1.68 m, thin. East Asian, light skin d8b08e, weathered. Cropped grey hair and grey stubble.
- **Costume**: A long patched hooded cloak over a leather work vest with tools, wrapped hands, canvas trousers and wrapped boots.
- **Gadgets**:
  - Magnifier goggles.
  - A repaired radio on a chest rig.
  - A tool roll.
- **Palette**: cloak 6a6a64, vest 5a3e28, trousers 8a7458, wraps b8ab90; emissive green b6ff8a, low

#### `surv_f2`: Survivor: medic

- **Era**: 2196 | **Sex**: f | **Age**: 45
- **Body**: 1.66 m, sturdy. Slavic, fair skin e0b8a0, weathered. A greying braid.
- **Costume**: A grey hooded cloak with a red-cloth medic armband, a padded vest, canvas trousers and boots.
- **Gadgets**:
  - A med satchel.
  - A respirator.
  - A handheld scanner.
- **Palette**: cloak 6a6a64, armband a8262e, vest 4a4a38, trousers 5a4a38; emissive green b6ff8a

#### `continuum_1`: Continuum trooper

- **Era**: 2196 | **Sex**: m | **Age**: 30
- **Body**: 1.88 m, athletic. The face is hidden by a sealed helmet (the body underneath is still a full human mesh for rigging).
- **Costume**: A sleek armoured suit: a graphite under-suit with segmented pearl-white ceramic plates at the chest, back, shoulders, forearms, thighs and shins, and a high gorget. A fully enclosed helmet with a horizontal gold visor slit. Silhouette: smooth, symmetric and clean-edged, the opposite of the patched survivors.
- **Gadgets**:
  - Chest temporal emitter: a circular gold d9a441 ring that brightens to ffd27a and pulses fast just before a 'freeze' or 'rewind' attack (a telegraph).
  - A forearm emitter (right forearm).
  - The helmet visor: a gold scan line sweeps across it (vision-cone cue) and locks solid on detection.
  - Back stabilizer fins: two short blades with gold edge light.
- **Palette**: plates e6e8ea, under-suit 202328, trim 8a9098; emissive Continuum gold ffd27a

#### `continuum_2`: Continuum officer

- **Era**: 2196 | **Sex**: f | **Age**: 33
- **Body**: 1.76 m, athletic. Mixed East Asian and European, light skin e8c0a0. Black hair in a tight low bun. The helmet visor is retracted, so the face shows.
- **Costume**: The Continuum armoured suit with an officer's graphite half-cape over the left shoulder (to mid-back, not trailing), a gold rank bar at the gorget and an open helmet collar.
- **Gadgets**:
  - A chest temporal emitter.
  - A forearm command slate.
  - A gold AR eye-line across the retracted visor.
- **Palette**: plates e6e8ea, under-suit 202328, cape 2a2c30, rank d9a441; emissive Continuum gold ffd27a


### Crowd ancient settlement

#### `anc_m1`: Settler: farmer / builder

- **Era**: ANCIENT settlement | **Sex**: m | **Age**: 32
- **Body**: 1.74 m, muscular. Brown skin 6b4029. A shaved head.
- **Costume**: A short knee tunic in undyed linen with sleeves rolled to the shoulder, a leather belt, leg wraps and sandals.
- **Gadgets**:
  - No technology. A leather pouch.
  - A flint knife in a sheath.
- **Palette**: tunic d9c9a0, belt 4a3220, wraps 7a6248

#### `anc_m2`: Settler: elder storyteller

- **Era**: ANCIENT settlement | **Sex**: m | **Age**: 64
- **Body**: 1.68 m, slight. Brown skin 7d4f33. Short grey curls and a grey beard.
- **Costume**: An ankle-length madder tunic with a woven wool mantle over the left shoulder, fastened with a bronze pin, and sandals.
- **Gadgets**:
  - No technology. A bronze cloak pin.
  - A carved staff (hand prop).
- **Palette**: tunic 8a3a3a, mantle b89a6a, bronze c9a050

#### `anc_m3`: Settler: sentry

- **Era**: ANCIENT settlement | **Sex**: m | **Age**: 22
- **Body**: 1.80 m, lean. Brown skin 8c5a3a. Braided hair tied at the nape.
- **Costume**: A knee tunic under a hardened-leather cuirass, leather bracers, a belt sash and sandals with leg wraps.
- **Gadgets**:
  - No technology. A bronze-tipped spear (a prop carried in the hand while idle; slung while walking).
  - A horn on a cord.
- **Palette**: tunic cdb48a, leather 5a3e28, sash 9b3b24, bronze c9a050

#### `anc_m4`: Settler: bronze smith

- **Era**: ANCIENT settlement | **Sex**: m | **Age**: 40
- **Body**: 1.70 m, stocky. Brown skin 5a3622. Short black hair and a full beard.
- **Costume**: A sleeveless tunic, a leather smith's hip wrap, leg wraps and sandals.
- **Gadgets**:
  - No technology. A bronze arm ring.
  - A soot-stained leather glove on one hand.
- **Palette**: tunic 8a6a4a, leather 4a3220, bronze c9a050

#### `anc_f1`: Settler: water carrier

- **Era**: ANCIENT settlement | **Sex**: f | **Age**: 25
- **Body**: 1.62 m, slim. Brown skin a06a46. Long black hair in a single braid.
- **Costume**: A sleeveless ochre tunic to the calf, an indigo-teal sash and sandals.
- **Gadgets**:
  - No technology. A clay water jar (a hand prop on the hip).
  - Bronze bracelets.
- **Palette**: tunic b4884e, sash 2f5a5a, bronze c9a050

#### `anc_f2`: Settler: weaver

- **Era**: ANCIENT settlement | **Sex**: f | **Age**: 50
- **Body**: 1.58 m, soft build. Brown skin 7d4f33. A grey-streaked bun.
- **Costume**: A long undyed tunic, a saffron shoulder wrap, a bead necklace and sandals.
- **Gadgets**:
  - No technology. A distaff with wool (a hand prop).
  - A clay-bead necklace.
- **Palette**: tunic d9c9a0, wrap d0a24a, beads 9b3b24

#### `anc_f3`: Settler: herbalist / healer

- **Era**: ANCIENT settlement | **Sex**: f | **Age**: 35
- **Body**: 1.66 m, average build. Brown skin 8c5a3a. Two braids and a woven headband.
- **Costume**: A weld-green dyed linen tunic with elbow sleeves, a leather satchel strap across the body and sandals with leg wraps.
- **Gadgets**:
  - No technology. An herb satchel.
  - A bronze pin.
  - A woven headband.
- **Palette**: tunic 6a7a3a, satchel 5a3e28, headband 9b3b24

#### `anc_f4`: Settler: elder

- **Era**: ANCIENT settlement | **Sex**: f | **Age**: 68
- **Body**: 1.55 m, slight and stooped. Brown skin 6b4029. A white bun under a light linen head wrap.
- **Costume**: A long dark madder tunic, a shawl wrap and sandals.
- **Gadgets**:
  - No technology. A walking cane (a hand prop).
  - Bronze earrings.
- **Palette**: tunic 5a2a4a, shawl b89a6a, wrap d9c9a0

#### `anc_kid_m`: Settler child: boy

- **Era**: ANCIENT settlement | **Sex**: m | **Age**: 9
- **Body**: 1.30 m, slim child. Brown skin 8c5a3a. Short curls.
- **Costume**: A short undyed tunic with a cord belt and sandals.
- **Gadgets**:
  - No technology. A woven sling tucked in the belt.
- **Palette**: tunic d9c9a0, cord 9b3b24

#### `anc_kid_f`: Settler child: girl

- **Era**: ANCIENT settlement | **Sex**: f | **Age**: 7
- **Body**: 1.20 m, small child. Brown skin a06a46. Two braids.
- **Costume**: A small ochre tunic with a red sash and sandals.
- **Gadgets**:
  - No technology. A clay animal toy (a hand prop).
- **Palette**: tunic b4884e, sash 9b3b24
