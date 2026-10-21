# AFTERZERO rendering: audit, gaps and plan

Owner request (binding): *"Upgrade the visual to realistic by rendering the graphics; install the software in the
cloud for rendering the game and actions to get the proper outcome"*, with detailed maps, buildings and
infrastructure, and smooth gameplay on phones.

This file is the working contract for the rendering upgrade. It records the baseline (stage 0, the audit), the exact
reference views every later stage re-captures, the gaps against a modern realistic game, and the staged plan.
Art direction and phone budgets come from docs/ART_SPEC.md, the engine API from docs/MISSION_GUIDE.md.

Files owned by the rendering work: `src/core/engine.js` (renderer, composer, quality tiers), `src/world/realism.js`,
`src/world/kit.js`, `src/world/props.js`, `vendor/addons/**`, `tools/render/**`, this file, plus small additive camera
hooks in `src/core/game.js`. Missions, `env_*.js`, systems, characters and tests belong to other workflows, so
everything exported from kit.js / props.js / realism.js stays backward compatible and new behaviour is either opt-in
or a pure quality improvement.

## 1. The pipeline today (stage 0)

| Stage | What it does now | Notes |
|---|---|---|
| Renderer | WebGL2, ACES Filmic, sRGB output, `antialias: true` on desktop only | The scene never draws to the canvas (it goes through the composer), so canvas MSAA is spent on nothing: **no tier has any anti-aliasing**. |
| Composer | RenderPass → UnrealBloomPass → OutputPass → Cinema pass (ripple, chromatic aberration, vignette, grain, era tint) | Render targets are HalfFloat with `samples: 0`. On `medium`/`low` the Cinema pass also does tone mapping + sRGB (`FUSED_OUTPUT`) and drops the always-on aberration (`CHEAP`). |
| Bloom | 5-mip UnrealBloom, full resolution on high, half on medium, off on low | Threshold/strength set per scene by `newScene`. |
| Image-based light | `scene.environment` = PMREM of three's **RoomEnvironment** (a grey indoor studio) for every scene, intensity 0.25–0.6 | A rainy night street, a lab and a sunset valley all reflect the same studio box: reflections and ambient specular do not belong to the place. |
| Shadows | One shadow caster per scene (moon / sun directional following Kai, 44–60 m frustum, or one spot); 4096² PCF-soft on high, 1024² PCF on medium, **off on low** | Characters cast; crowd walkers (`Walker`, LOD looks) neither cast nor receive. No contact shadows or AO anywhere. |
| Lights | 7–19 unshadowed point/spot lights per scene + hemisphere | Neon only lights through emissive + bloom; lamps light the ground with additive "puddle glow" planes. |
| Materials | Canvas-drawn albedo (+ a roughness map for asphalt) on `MeshStandardMaterial`; no normal maps, no AO maps in missions 1-4 | `realism.js` (3.4k lines: GPU-baked PBR sets, interior-mapped facades, sky IBL, terrain, trees, grass, water, height fog) is **not used by missions 1-4 at all**; only the new missions 5+ import it. |
| Buildings (m1) | Plain `BoxGeometry` towers with a 256×512 canvas facade (6 seeds) and an emissive window texture, stretched by `repeat` | No relief, cornices, mullions, roofs or rooftop plant; every tower reads as a lit cardboard box. |
| Characters | Realistic heads/bodies (src/human, other workflow) lit by the scene's lights only | No dialogue key/fill/rim light, no depth-of-field separation in close-ups. |
| Adaptive | Phones scale resolution 0.6–1.0 to hold ~30 fps and may drop one tier | Disabled under webdriver, so captures are at fixed resolution. |

## 2. Reference views

Twelve fixed camera poses (three per finished mission) are defined in `tools/render/views.json` and captured by
`tools/render/refviews.mjs`. They were frozen with the stage-0 audit on 2026-10-20 (the dialogue views place Kai
left of frame so the other speaker is visible; m2c stands Iven up first). **Never edit a baselined view; add a new
one instead**, so every stage compares the same frame. Missions are addressed by the 0-based `?m=` index (m1 = 0 … m4 = 3).

| View | Mission | What it shows |
|---|---|---|
| `m1a_establishing` | 1 Rain City 2049 | elevated establishing shot down the neon street |
| `m1b_street_people` | 1 | eye-level sidewalk: shopfronts, kerb, umbrellas, child + mother |
| `m1c_dialogue_hale` | 1 | over-the-shoulder dialogue with Hale at the transit plaza |
| `m2a_establishing` | 2 Helix lab | lobby / corridor establishing |
| `m2b_interior_people` | 2 | office / lab interior detail |
| `m2c_dialogue_iven` | 2 | close dialogue with Iven |
| `m3a_establishing_2049` | 3 Chronolith chamber | high shot of the chamber in 2049 |
| `m3b_dialogue_iven_2049` | 3 | close dialogue with Iven beside the Chronolith |
| `m3c_future_2196` | 3 | the gallery beyond the chamber in the overgrown, ruined 2196 era |
| `m4a_establishing` | 4 Ancient valley | elevated establishing shot of the settlement at sunset |
| `m4b_village_people` | 4 | eye-level village street with settlers |
| `m4c_dialogue_niko` | 4 | close dialogue with Niko |

How a view is taken (`tools/render/refhelper.js`, evaluated in the page): the mission loads at quarter size until its
ready condition (SwiftShader is fill-rate bound, so the intro plays much faster), the viewport is set to the capture
size, then the helper **takes over the frame loop**: the game is paused and the engine's per-frame render is held,
the camera is fixed through `game.cine`, the world is simulated (not drawn) 6 × 1/30 s around it (a view may ask for
more settle frames with `frames`), time stops, and the frame is drawn and read back from the canvas (HUD / dialogue
DOM hidden). `REF.measure` then times 3 full frames and 1 scene-pass-only frame, each fenced with `readPixels` and
preceded by a yield to the event loop, and records `renderer.info` counts (calls / triangles include shadow maps and
post), light, material and program counts.

**Browser choice (important for every headless capture tool).** refviews.mjs launches Playwright's full Chromium in
new-headless mode (`channel: 'chromium'`). The default `chromium_headless_shell` (old headless, which
`tools/shoot.mjs` and `tools/drive.mjs` use) leaks: whenever the page's main thread is blocked, as it is for every
multi-second SwiftShader frame, its browser and renderer processes grow by 30-70 MB/s (measured with a plain
30 s busy-wait in the game page: +1.1 GB browser, +0.6 GB renderer; the same test under new headless: +0 MB), until
the shared memory cgroup OOM-kills the renderer. This is what crashed the first audit runs on m1 / m2 at
1280×720. New headless also starts the game with a ~600 MB smaller renderer. The helper additionally keeps
full-size draws to the minimum (settle frames are simulated, not drawn) and the launcher passes
`--mute-audio --disable-audio-output`.

Commands (from the repo root; the static server must be up on :8765, one browser at a time):

```sh
# one mission and tier -> <out>/<view>.png + <out>/<mission>_<gfx>[_mobile].json
node tools/render/refviews.mjs m1 high   <out>/high        1280 720
node tools/render/refviews.mjs m1 low    <out>/low_mobile  844 390 --mobile
#   options: --views=m1a_establishing,m1c_dialogue_hale  --resume (skip views already in the json)  --noshot
#            --base=http://localhost:8765/  --ready-timeout=ms
# all twelve views, both tiers, with retries when the shared container OOM-kills a renderer:
bash tools/render/runall.sh <out root> "m1 high 1280 720;m2 high 1280 720;m3 high 1280 720;m4 high 1280 720;m1 low 844 390 --mobile;m2 low 844 390 --mobile;m3 low 844 390 --mobile;m4 low 844 390 --mobile"
# markdown table of the measurements, optionally with deltas against the audit baseline
node tools/render/report.mjs <out>/high <scratch>/render/audit/high
# the same views through tools/drive.mjs (writes refviews_m1.json … m4.json steps files)
node tools/render/refviews.mjs --emit-steps=<dir>
node tools/drive.mjs "http://localhost:8765/index.html?m=0&dtcap=0.25&gfx=high&auto" <dir>/refviews_m1.json 1280 720 --outdir=<out>
```

`<scratch>` is `/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad`; the stage-0
images and numbers are in `<scratch>/render/audit/{high,low_mobile}/`, and later stages write
`<scratch>/render/<stage>/{high,low_mobile}/` so images can be compared side by side with the same file names.
The drive.mjs route loads at full size and runs in old headless (see the browser note above), so it needs generous
timeouts and may be OOM-killed on m1 / m2 at 1280×720; it yields the same frames, but refviews.mjs is the reference.

Measuring notes: the container renders with CPU SwiftShader shared with other agents' test browsers (load average
15–23 on 4 cores during the audit), so absolute frame times are only good for *relative* comparisons of the same view
on the same run conditions; use the minimum of the 3 samples (`frame min ms`), re-run both before and after in the
same session when a change is close to the noise, and judge phone cost primarily by calls, triangles, passes, render
target sizes and texture taps per pixel. A renderer that is OOM-killed (the memory cgroup is shared) is retried by
`runall.sh`; `--resume` keeps the views already measured.

## 3. Baseline (stage 0)

Captured 2026-10-20 with `tools/render/runall.sh <scratch>/render/audit "...all eight sets..."` (new-headless Chromium,
SwiftShader, host load average 15-20 from other workflows' test browsers, so frame times are inflated and only
comparable to runs under similar load; counts are exact; m1b, m1c, m2c, m3b, m4a and m4c at high were re-taken
in a second run after their framing was fixed). Images: `<scratch>/render/audit/high/*.png` (1280×720,
gfx=high, desktop) and `<scratch>/render/audit/low_mobile/*.png` (844×390, gfx=low, `--mobile`); raw numbers in the
`m<N>_<gfx>[_mobile].json` files next to them. Contact sheets of all twelve views per tier:
`<scratch>/render/audit/grid_high.png`, `<scratch>/render/audit/grid_low_mobile.png`. `calls` / `tris` are the whole frame (shadow map + scene + post);
`scene pass ms` is shadow map + main pass only.

**high, 1280×720, desktop**

| view | tier | size | calls | tris | frame min ms | frame med ms | scene pass ms | lights p/s/d | transp. | programs |
|---|---|---|---|---|---|---|---|---|---|---|
| m1a_establishing | high | 1280x720@1 | 488 | 453k | 2833.3 | 3102.1 | 3188.3 | 7/0/1 | 67 | 43 |
| m1b_street_people | high | 1280x720@1 | 381 | 451k | 2359.3 | 2852.5 | 1854.8 | 7/0/1 | 67 | 43 |
| m1c_dialogue_hale | high | 1280x720@1 | 244 | 444k | 1846.3 | 2244.5 | 2349.7 | 7/0/1 | 67 | 43 |
| m2a_establishing | high | 1280x720@1 | 299 | 79k | 2240.8 | 2576.4 | 1512.7 | 10/3/0 | 12 | 37 |
| m2b_interior_people | high | 1280x720@1 | 138 | 75k | 2357.3 | 2600.6 | 1833.6 | 10/3/0 | 12 | 37 |
| m2c_dialogue_iven | high | 1280x720@1 | 67 | 40k | 3468.7 | 3589.5 | 3701 | 10/3/0 | 13 | 37 |
| m3a_establishing_2049 | high | 1280x720@1 | 75 | 35k | 2140.2 | 2273.6 | 1877.7 | 19/0/0 | 3 | 31 |
| m3c_future_2196 | high | 1280x720@1 | 195 | 93k | 1933.4 | 2039.3 | 1573.7 | 1/2/0 | 7 | 41 |
| m3b_dialogue_iven_2049 | high | 1280x720@1 | 41 | 28k | 2979.1 | 3006.5 | 2849.2 | 19/0/0 | 3 | 31 |
| m4b_village_people | high | 1280x720@1 | 399 | 335k | 2475.6 | 3439.3 | 3085.6 | 8/0/1 | 12 | 39 |
| m4a_establishing | high | 1280x720@1 | 479 | 350k | 3826.2 | 4026.9 | 3519.9 | 8/0/1 | 12 | 39 |
| m4c_dialogue_niko | high | 1280x720@1 | 389 | 341k | 4018.9 | 4551.4 | 4107.9 | 8/0/1 | 12 | 39 |

**low, 844×390, mobile (phone tier)**

| view | tier | size | calls | tris | frame min ms | frame med ms | scene pass ms | lights p/s/d | transp. | programs |
|---|---|---|---|---|---|---|---|---|---|---|
| m1a_establishing | low (mobile) | 844x390@1 | 424 | 365k | 817.2 | 1199.1 | 969.8 | 7/0/1 | 67 | 30 |
| m1b_street_people | low (mobile) | 844x390@1 | 328 | 362k | 1060 | 1214.2 | 1188 | 7/0/1 | 67 | 30 |
| m1c_dialogue_hale | low (mobile) | 844x390@1 | 148 | 356k | 864.3 | 1146.2 | 1177.7 | 7/0/1 | 67 | 30 |
| m2a_establishing | low (mobile) | 844x390@1 | 255 | 37k | 523.2 | 677.6 | 1133.2 | 10/3/0 | 12 | 24 |
| m2b_interior_people | low (mobile) | 844x390@1 | 100 | 34k | 499.9 | 803.8 | 1153.1 | 10/3/0 | 12 | 24 |
| m2c_dialogue_iven | low (mobile) | 844x390@1 | 24 | 20k | 752.2 | 843 | 918.6 | 10/3/0 | 13 | 24 |
| m3a_establishing_2049 | low (mobile) | 844x390@1 | 61 | 35k | 755.6 | 827.6 | 1095.7 | 19/0/0 | 3 | 22 |
| m3b_dialogue_iven_2049 | low (mobile) | 844x390@1 | 39 | 33k | 1093.7 | 1835.7 | 1217.1 | 19/0/0 | 3 | 22 |
| m3c_future_2196 | low (mobile) | 844x390@1 | 86 | 36k | 905.2 | 911.1 | 630.8 | 1/2/0 | 7 | 28 |
| m4a_establishing | low (mobile) | 844x390@1 | 276 | 292k | 1364 | 1644 | 1701.3 | 8/0/1 | 12 | 26 |
| m4b_village_people | low (mobile) | 844x390@1 | 203 | 286k | 1486.5 | 1560.5 | 1020.1 | 8/0/1 | 12 | 26 |
| m4c_dialogue_niko | low (mobile) | 844x390@1 | 163 | 282k | 2134.6 | 2971.5 | 1820.5 | 8/0/1 | 12 | 26 |

Reading the numbers:
- **m1 is over the phone budget on every view even on `low`**: 148–424 calls and ~360k triangles (budget ≤ 250
  calls; the triangle count is within 700k). 433 visible meshes, 389 distinct materials, 67 transparent objects
  (neon, puddles, signs) and no instancing at all. m4's establishing view is also over (276 calls on low).
- `low` already drops the shadow pass (m1 453k → 365k triangles) and bloom / OutputPass; its remaining cost is the
  forward-shaded scene: m3 2049 has **19 point lights** visible, m2 13, m1 7 (+1 directional), each evaluated per
  pixel on every lit material.
- The post chain on high is 15 draw calls (bloom mips + output + cinema); on low 1 (cinema with fused output).
- Buildings are cheap boxes (m2 / m3 scenes stay under 100k triangles), so the 280–450k triangles of m1 / m4 are
  mostly the crowds of full characters and the m4 rock / tree blobs.
- Frame time scales mostly with pixels × lights on SwiftShader; on high the scene pass (shadow + main) is most of the
  frame, the post chain the rest.

## 4. Gaps against a modern realistic game

Judged from the twelve stage-0 images (`<scratch>/render/audit/{high,low_mobile}/*.png`) next to what a current
console / high-end mobile third-person game shows for the same kinds of shot. Each gap names where it is visible
and the lever we own that fixes it for the finished missions without editing them.

### 4.1 Image quality
| # | Gap | Where it shows | Lever (file) |
|---|---|---|---|
| G1 | **No anti-aliasing on any tier.** Canvas MSAA is wasted because the scene renders into the composer's non-multisampled targets: stair-stepped building edges, kerb lines, lamp poles, rain streaks and hair/shoulder silhouettes crawl in motion. | every view; worst on m1a (window grid sparkles, kerbs), m2a (tile grout moiré), m1c/m2c silhouettes; on low the minified facade and concrete textures shimmer (m1a, m3c) | engine.js: MSAA on the scene target (high), FXAA fused into the Cinema pass (medium), nothing on low (dpr 1 phones) |
| G2 | **Washed / muddy colour.** ACES Filmic on top of dark albedo crushes the night scenes into a grey-brown haze with a low black point; saturated neon clips to white-yellow cores; m2 is a uniform red wash; the m4 sunset is orange everywhere with no blue in the shadows. No per-era grade apart from a flat `uTint` multiply. | m1a/m1b (milky fog, flat greys), m3a on high (bloom 0.85 + fog turn the whole chamber into white milk; the same view on low is crisper), m2a (all red), m4a/m4b | engine.js: per-era grade fused into the Cinema pass (lift/gamma/gain, saturation, white balance, shadow tint, soft black point); evaluate AgX / Neutral tone mapping for the neon; high may add a 3D LUT |
| G3 | **Grain and chromatic aberration fight detail.** A constant 0.06 grain and always-on CA on high soften textures and make SwiftShader frames look noisier than the content. | all high views | engine.js: scale grain with luminance, CA only at the frame edge |

### 4.2 Lighting, shadows and occlusion
| # | Gap | Where it shows | Lever |
|---|---|---|---|
| G4 | **No ambient occlusion or contact shadows.** Walls meet floors, people meet pavements and props meet the ground with no darkening: everything floats. Crowd walkers neither cast nor receive; `low` has no shadows at all, so phones show no grounding whatsoever. | m1b (walkers, shopfront base), m2b (pipes, wall-floor joins), m4b (houses on the ground), all low views | engine.js: GTAO at half resolution on high; props.js / kit.js: soft contact-shadow decals (one quad, depth-write off) under walkers, characters' feet and props on medium/low; baked AO in kit materials |
| G5 | **Wrong image-based light.** Every scene reflects three's grey RoomEnvironment studio: wet asphalt reflects a white box instead of the neon street, metal reads as grey plastic, the lab and the valley share one reflection. | m1a/m1b street (no neon on the wet road except the additive puddle quads), m3 chronolith metal, m4 stone | engine.js: per-scene procedural environment (realism.skyEnvironment / an interior preset) built from the scene's sky/fog/hemi colours when a mission set none; optional one-time cube capture for the m1 street |
| G6 | **Flat, single-source lighting.** Interiors are lit by unshadowed point lights with no falloff shaping or bounce: walls are evenly lit planes, ceilings black, no light pools; the m1 lamps light the ground only through puddle sprites. | m2a/m2b (flat grey walls), m3a, m1b (shopfront wall), m4a (houses without sky fill / bounce); on low the m1 lamp heads are flat white bars because bloom is off and nothing else conveys emission | engine.js: env + AO do most of it; kit.js lampPost/light helpers: shaped pools, emissive fixtures that actually read as light sources; height fog in-scatter around lights |
| G7 | **Dialogue / character lighting.** Close-ups use whatever gameplay light happens to be there: faces are under-exposed or lit from behind, no key / fill / rim, no catch-lights, no subject separation from the background. | m1c (Hale's face lit flat from the front, Kai a black silhouette), m2c (both characters nearly black), m3b, m4c | engine.js + a small hook in game.shot / talk: a camera-relative dialogue rig (key + rim, unshadowed, only while a close shot is active), depth-of-field on high |

### 4.3 Materials
| # | Gap | Where it shows | Lever |
|---|---|---|---|
| G8 | **Plastic / cardboard materials.** Canvas-drawn albedo only: no normal maps, no roughness variation (except asphalt), no AO maps, no edge wear; tiles are perfect squares with uniform gloss, concrete and stone are flat prints. | m2a/m2b floors and walls, m3 chamber, m4 stone, m1 pavement | kit.js: `tileMaterial`, `stoneMaterial`, `concreteMaterial`, `asphaltMaterial` gain normal + roughness + AO from realism.textureSet (same signatures, tier-sized textures); specular anti-aliasing |
| G9 | **Wet street does not read as wet.** No rain ripples, no streaks of reflected neon, puddles are additive sprites that float above the ground and ignore the camera angle. | m1a, m1b | kit.js asphaltMaterial: realism.rainRipples + env reflections (G5); puddleGlow kept but softened |

### 4.4 Depth and atmosphere
| # | Gap | Where it shows | Lever |
|---|---|---|---|
| G10 | **Uniform exponential fog** with one colour: no height falloff, no light in-scatter, no aerial perspective, so distance reads as grey-out instead of depth; skies are flat two-colour gradients with no clouds. | m1a (the street end dissolves into milk), m4a (no haze layers between hills), m3c | engine.js setScene: swap FogExp2 for realism's HeightFog with the same colour/density (opt-out per scene); kit.js `sky`: cloud layer and horizon glow; lamp light cones on high/medium |
| G11 | **Rain is thin 1 px lines** of one brightness; nothing hits the ground. | m1a, m1b | kit.js Rain: camera-facing streak quads lit by nearby neon, ground splashes on high |

### 4.5 Buildings, maps and infrastructure
| # | Gap | Where it shows | Lever |
|---|---|---|---|
| G12 | **Boxy buildings.** m1 towers are single `BoxGeometry` blocks with a stretched 256×512 facade print: no mullions, window reveals, ledges, cornices, setbacks, balconies, roofs or ground-floor structure; the window grid repeats visibly; the skyline is flat cards. m2/m3 interiors are box rooms; m4 houses are a box + cone. | m1a (both street walls), m1c background, m2a/m2b, m4a | kit.js: `facadeTextures` → higher-resolution facade with frames, sills and lit-interior variation (normal + roughness companions); `box()` recognises facade materials and adds relief / rooftop dressing as merged geometry (one extra draw per building at most); realism.cityBlock for new missions |
| G13 | **Missing street infrastructure.** No kerb stones or gutters, drains, manholes, bollards, railings, traffic lights, crossings, street furniture, overhead wiring, signage poles, rooftop plant (AC units, water tanks, antennas beyond one red stick), transit details (rails, sleepers, platform edges, catenary masts are a few boxes). | m1a/m1b/m1c, m2 corridor (no conduits / signage / doors), m3a (chamber plant), m4b (no fences, carts, wells) | props.js / kit.js: a street-furniture set (lamp post rebuild, bollard, railing, drain, kerb strip, traffic light, cable runs, rooftop units, transit shelter, signage pole) built as instanced / merged meshes; existing `lampPost` upgraded in place. Placing new furniture in missions 1-4 needs the missions workflow (one call each); see Plan 5 |
| G14 | **Vegetation and terrain are primitive.** m4 trees are faceted dodecahedron blobs on cylinders and the cliffs are flat-shaded dodecahedra, both defined inside the mission; the grass is a speckled texture on a plane with no blades, shrubs or ground cover; the 2196 overgrowth of m3 is straight green tubes over flat brown boxes. | m4a, m4b, m4c, m3c | realism.js tree / forest / instancedGrass / ivy exist for new missions; for m4 / m3 the missions workflow must swap the call (we cannot edit missions) |

### 4.6 Characters (other workflows own the models)
| # | Gap | Where it shows | Owner |
|---|---|---|---|
| G15 | Crowd and hero characters read as low-poly CG figures in the gameplay shots: clothing seams/tearing artefacts at the shoulders (Hale's jacket), hard hair silhouettes, no skin specular response to the environment. Rendering helps (env light, AO, rim light, AA) but the meshes belong to src/human + character.js. | m1c, m2c, m4c | costume / human workflows; rendering provides G5/G7 |

### 4.7 Performance (phones)
| # | Gap | Measured | Lever |
|---|---|---|---|
| G16 | **m1 exceeds the phone budget on the phone tier itself**: 424 / 328 / 148 calls on low (488 / 381 / 244 on high) against a budget of ≤ 250; m4a 276 on low. 433 meshes, 389 materials, no instancing; each building, sign and lamp is its own draw, the 13+ umbrella walkers are full characters. | section 3 | kit.js / props.js: merge static meshes per material after a scene is built (opt-in helper, used by the engine only on medium/low where it is invisible), instanced lamps / signs, crowd LOD distances per tier |
| G17 | **Many unshadowed point lights**: m3 2049 has 19 visible point lights, m2 10 + 3 spots, m4 8, m1 7, all forward-shaded per pixel on every lit material, on every tier (the tier hint `maxLights` is not enforced). | lights column | engine tier hints: clamp the per-scene light count on low (fade the weakest into emissive + env) |

## 5. Plan

Rules for every stage: (1) re-capture all twelve reference views at `high` 1280×720 and `low --mobile` 844×390 into
`<scratch>/render/<stage>/` and compare side by side with the audit images; (2) `low` and `medium` may not get
slower: a new pass is tier-gated (high = full quality, medium = a cheap version, low = only what can be fused into
an existing pass), and the stage reports calls / triangles / frame min against the audit with
`node tools/render/report.mjs <stage dir> <audit dir>`; (3) kit.js / props.js / realism.js keep every export and
parameter, new behaviour is opt-in or a pure quality improvement, files are checked with `node --check` + eslint
after each edit because other workflows load them live; (4) nothing is downloaded: textures and meshes are
generated by code, offline bakes come from Blender Cycles running in this container.

| Stage | Content | Tiers | Fixes |
|---|---|---|---|
| **1. Image foundation** (engine.js, vendor/addons) — **done, see section 6** (built with SMAA on high instead of MSAA, plus GTAO, DOF and eye adaptation from stages 2 / 5) | MSAA ×4 on the scene render target on high (WebGL2 multisampled target, resolved before bloom); FXAA fused into the Cinema pass on medium; per-era colour grade fused into the Cinema pass (lift / gamma / gain, saturation, white balance, shadow tint, soft toe) driven by a `grade` preset per scene (defaults derived from the scene's fog / background so missions 1-4 need no change); grain scaled by luminance, CA only near the frame edge; tone-mapping review (ACES vs AgX / Neutral) on the neon views. | high: MSAA; medium: FXAA (+5 taps in the existing pass); low: grade only (ALU in the existing pass) | G1, G2, G3 |
| **2. Light and occlusion** (engine.js, realism.js, props.js) — **done, see section 7** (GTAO already shipped in stage 1; contact shadows are one instanced draw on every tier, plus wet weather, dialogue rig and spot-light shafts) | Per-scene IBL: when a mission did not set `scene.environment`, the engine builds one from the scene (night city / interior / sunset presets of realism.skyEnvironment, or a one-time cube capture at the player start) instead of RoomEnvironment; GTAO (vendored GTAOPass, half resolution, blended before bloom) on high; contact-shadow decals under Walkers, actors and big props on medium / low (and high where GTAO misses off-screen casters); shadow-map bias / normal-bias pass to remove acne and peter-panning; HeightFog swap in setScene with the same colour and density. | high: env + GTAO + soft shadows; medium: env + decals; low: env (zero per-frame cost) + decals | G4, G5, G6, G10 |
| **3. Materials** (kit.js, realism.js) — **done for the kit surfaces, see section 9** (asphalt / tile / stone / concrete; facades were rebuilt by stage 4; ripples come from the stage-2 wet chunk) | `tileMaterial`, `stoneMaterial`, `concreteMaterial`, `asphaltMaterial` return the same material kinds with normal / roughness / AO maps from realism.textureSet (GPU baked once, cached, 256 / 512 / 1024 by tier); asphalt gets rain ripples, puddle masks and darker wet albedo; `facadeTextures` draws 2× resolution facades with frames, sills, blinds and interior variation and returns normal / roughness companions; `glowMat` fixtures get a soft emissive falloff; `chronolith`, `trainCar`, `lampPost`, `Drone` get real metal / glass / rubber breakup. Optional Cycles bakes (AO / curvature) for the chronolith and the train car under `assets/baked/`. | all tiers (texture size by tier); interior-mapped windows high / medium only | G8, G9, G12 (look) |
| **4. Buildings and street infrastructure** (kit.js, props.js) — **done, see section 8** (with static batching on every tier, era variants, the ancient settlement builder and the opt-in street kit) | `box()` recognises a facade material and adds merged relief (window reveals, floor ledges, cornice, roof parapet, rooftop units, water tanks, antennas) for that building: one extra draw at most, skipped on low beyond 60 m; a street-furniture set (`kerb`, `drain`, `bollard`, `railing`, `trafficLight`, `signPole`, `cableRun`, `transitShelter`, `rooftopUnits`) as instanced / merged builders for new missions; `lampPost` rebuilt in place (pole base, arm, luminaire with a lit lens and an optional light cone). Missions 1-4 keep their layout; the missions workflow is offered one-line calls to dress their streets. Static-mesh merging (`mergeStatic(scene)`) after a scene is built cuts m1 below 250 calls on phones. | geometry everywhere, merging on medium / low, light cones high / medium | G12, G13, G16 |
| **5. Characters and cinematics** (engine.js, game.js hook) | `engine.cinematic({ subject, focus, rig })` called from `game.shot` (and when a `talk` starts with a close camera): a camera-relative key + rim light pair (unshadowed, 2 lights on high / medium, 1 rim on low) that fades in only during close shots; depth of field (vendored BokehPass at half resolution) on high only, focused on the speaker's head; subtle eye catch-light via the env. | high: rig + DOF; medium: rig; low: rim | G7, G15 (lighting side) |
| **6. Atmosphere and weather** (kit.js) | `sky()` adds cloud layers and a horizon glow (same signature); Rain becomes lit camera-facing streaks with ground splashes on high; Motes softer; volumetric-looking cones for lamps and the chronolith (additive cones, no ray marching). | streak count / splashes by tier | G10, G11 |
| **7. Vegetation and eras** (realism.js, requests) | realism.tree / forest / instancedGrass / ivy tuned for the m4 valley and the 2196 overgrowth; the missions workflow is asked to swap m4's local `tree()` and m3's 2196 dressing to these builders (we cannot edit missions). | instance counts by tier | G14 |
| **8. Performance pass** | Re-measure every view, cut what does not pay for itself; crowd LOD distances and light clamps per tier; verify ≤ 250 calls / ≤ 700k triangles / ≤ 6 lights / ≤ 1 shadow caster on medium and low; document final numbers here. | — | G16, G17 |

Stage order is by impact per phone millisecond: stages 1-3 change every frame of every mission without touching
mission code; 4-7 add content; 8 closes the budget. Each stage ends with its before / after table appended below.

### Offline rendering in the cloud container

The owner asked for "the software in the cloud for rendering". In this container that is: headless Chromium with
SwiftShader driven by `tools/render/refviews.mjs` for repeatable reference frames and measurements (this document),
Blender with Cycles (`/home/user/tools/venv/bin/python`, `import bpy`) for offline bakes of static hero props (AO /
lightmaps into `assets/baked/`, referenced only by kit.js / props.js) and ffmpeg for turning captured frame
sequences into review videos. The game itself still renders in real time on the player's device; nothing in the
runtime depends on a server.

## 6. Stage 1: post-processing (engine.js) — done 2026-10-20

What was built, per tier (the chain is assembled once in the Engine constructor and gated in `applyPost()`, which
`setQuality()` calls, so a runtime tier switch works and frees the render targets a tier stops using; `render()`
allocates nothing per frame):

| tier | chain | new cost |
|---|---|---|
| **high** (desktop) | RenderPass → scene target with a depth texture → **GTAO** (half resolution, 12 samples, normals reconstructed from depth, 4×4 depth-aware blur, depth-aware upsample, fades with fog / distance, skips emissive pixels) → **eye adaptation** (16×16 + 1×1 targets) → **depth of field** (only while a cinematic shot holds a focus target) → bloom mips (the final bloom blend is now one tap inside Cinema) → **Cinema** (bloom tap + tone mapping + sRGB + **grade** + the existing effects) → **SMAA** (3 passes) | AO 3 passes at ¼ pixels + 1 full-res composite, SMAA 3 passes, DOF 1 pass (24-tap gather) only in cinematics |
| **medium** (phones, desktop fallback) | RenderPass → eye adaptation → half-res bloom mips → Cinema with **FXAA fused into its texture tap** (+4 luma taps, +4 blend taps on edges), grade, bloom tap | no new full-screen pass; the 16×16 / 1×1 exposure passes are ~0 |
| **low** (weak phones) | RenderPass → Cinema (grade as ALU in the existing pass) | nothing new; the grade is ~40 ALU ops per pixel in the one pass low already had |

The pre-upgrade OutputPass is kept in the composer but disabled (tone mapping + sRGB moved into the Cinema
`RawShaderMaterial`, so the pass works the same whether it draws to the screen or into the SMAA input). The bloom
pass no longer writes the frame: `FusedBloomPass` leaves its result in `bloom.texture` and Cinema adds it with one
bilinear tap, which removes the full-resolution read-modify-write blend of UnrealBloomPass on every tier that blooms.
Vendored for this: `vendor/addons/postprocessing/SMAAPass.js`, `vendor/addons/shaders/SMAAShader.js`,
`vendor/addons/shaders/GTAOShader.js` (three r170, unmodified; GTAOPass itself is not used because it re-renders
the scene for normals, the engine's AOPass reads the scene pass's own depth instead).

### APIs (engine.js)

- `engine.setGrade(name | object | null, { instant })` — presets `'rain2049'`, `'helix2026'`, `'ruin2196'`, `'ancient'`,
  `'neutral'` (exported as `GRADES`). An object overrides fields of its `base` preset:
  `{ base: 'rain2049', saturation: 1.3, name: 'alarm' }` (fields: `lift`, `gamma`, `gain`, `shadows`, `highlights` as
  `[r,g,b]`; `saturation`, `contrast`, `pivot`, `shoulder`). Changes blend over ~1 s; `null` returns to the automatic
  choice. `engine.grade` is the current preset name. `setScene()` clears an explicit grade, so a mission sets it after
  `newScene` or, simpler, puts `scene.userData.grade = 'ruin2196'` on the scene.
- Automatic choice (`gradeForScene(scene)`, exported): `scene.userData.grade`, else the hue of the fog (or plain
  background) colour: blue / dark → `rain2049`, amber → `helix2026` (dark) or `ancient` (bright), green → `ruin2196`,
  bright neutral → `neutral`. Missions 1-4 needed no change (m1-m3 2049 → rain2049, m3 2196 → ruin2196, m4 → ancient).
- `engine.focus(point | Object3D | null, { active?: () => bool, dof?: false })` — high tier only: depth of field
  focused on the target while it is held and `active()` is true; the blur fades in / out over ~0.3 s. The focus
  distance is the target's depth along the view axis, so it follows a moving look target. `game.shot()` calls
  `engine.focus(cine.look, { active: () => game.cine === thisShot, dof: opts.dof })` and `game.releaseCam()` calls
  `engine.focus(null)` (two additive lines in src/core/game.js): every dialogue / cutscene shot focuses on its look
  point and gameplay never gets DOF. A mission can opt a shot out with `game.shot(pos, look, dur, { dof: false })`.
  The thin-lens CoC scales with 1/tan²(fov/2), so close-ups (fov 38) separate subject from background strongly and
  wide establishing shots (fov 58) barely blur.
- Eye adaptation is automatic (high: strength 0.5, medium 0.4, clamped to −0.5 … +0.7 EV). The reference exposure is
  the scene's own authored look (re-taken on `setScene` and on a grade change, drifting over ~2 min), so a mission's
  static look is unchanged; only transitions adapt (measured on m2, bright lobby → dark office: +0.03 EV after 0.1 s,
  +0.15 after 0.6 s, +0.21 after 1 s, +0.29 after 2 s; `<scratch>/render/post2/aetest.mjs`).
- `engine.settlePost()` snaps grade, exposure and focus to their targets (deterministic captures, hard cuts).
- Debug / A-B switches: `?post=noao,noaa,nodof,noae,nograde` (or `engine.postOff` + `engine.applyPost()`),
  `aodebug` (final AO factor) and `aoraw` (raw AO buffer) visualise the occlusion. `engine.stats.post` lists the
  active features, e.g. `gtao+eye+dof+bloom+smaa+grade`.

Grade presets (display space, applied after tone mapping): lift / gain per channel, saturation, an S-curve contrast
around a pivot (0 and 1 stay put; no `pow`, phone friendly), a soft shoulder for saturated highlights, and split-tone
balance (normalised to unit luminance so it does not change exposure). Each preset is a richer version of the era's
existing palette, tuned on the reference views with `<scratch>/render/post/gradesheet.py` (exact numpy copy of the
shader grade applied to legacy captures):

| preset | look |
|---|---|
| `rain2049` | deeper blacks under the fog, +22 % saturation for the neon, contrast 1.15 around a low pivot (night), teal shadows, warm lamp / skin highlights |
| `helix2026` | warm amber, tungsten highlights, brown shadows, mild contrast |
| `ruin2196` | slightly bleached (sat 0.98), green-grey shadows, dusty warm highlights, harder contrast |
| `ancient` | golden-hour contrast (1.16), cooler blue shadows for depth, highlights barely warmer (the scene is already orange; a first version at saturation 1.15 pushed m4 to +38 % chroma and was rolled back to +~15 %) |
| `neutral` | +6 % saturation, +8 % contrast, slightly deeper blacks |

### Before / after (stage 1)

Captured with the new `--ab` mode of refviews.mjs: every view is taken twice **in the same page and the same frozen
frame**, once with the new chain and once with the pre-upgrade chain (`post=noao,noaa,nodof,noae,nograde`, the same
image as the old engine up to the fused bloom blend), so the comparison is not polluted by animation or load:

```sh
bash tools/render/runall.sh <scratch>/render/post2/r2 "m1 high 1280 720 --ab;...;m4 low 844 390 --mobile --ab"
# side by side (legacy | new): <scratch>/render/post2/r2/{high,medium_mobile,low_mobile}/sbs/<view>.png
# contact sheets:              <scratch>/render/post2/r2/{high,medium_mobile,low_mobile}/grid_sbs.png
node tools/render/postvariants.mjs m4 m4b_village_people <out> high full: noao:noao aodebug:aodebug   # one view, several switches
node tools/render/postbench.mjs m2 m2c_dialogue_iven <out.json> 1280 720 --configs=high,high:legacy   # per-pass ms
```

What changed in the images:
- **AA**: stair-stepping on silhouettes, poles, kerbs and window grids is gone on high (SMAA) and much reduced on medium
  (FXAA); low is unchanged.
- **Grounding**: characters, crates, consoles and house walls now sit on the ground (GTAO), most visible on m4b, m3a
  (console bases), m1b (crowd feet); faceted rocks / trees get crevice shading. No halos around characters (thickness
  0.8 m, depth-aware blur and upsample; a 2.5 m thickness variant smeared shadows behind legs and was rejected).
- **Colour**: m1 neon reads richer (KAFE, puddle reflections), m3a loses the milky haze (darker cool walls, saturated
  cyan rings), m4 keeps its sunset palette with more depth; low / medium get the same grade.
- **Cinematics**: m1c, m2c, m3b, m4c (fov 38 dialogue) now separate the speaker from the out-of-focus foreground
  shoulder and the background.
- Not fixed here (other stages): dialogue faces in m2c are still dark (stage 5 rig), boxy buildings and materials
  (stages 3-4).

Cost. Draw calls: +8 on high (AO 4, SMAA 3, exposure 2, −1 bloom blend; +1 DOF in cinematics), +2 on medium
(exposure), +0 on low. Frame time on the shared SwiftShader container is dominated by host load (load average 32-36
while these were taken, other workflows' test browsers), so the whole-frame A/B numbers of the `--ab` runs swing
±70 % even on `low` where only ALU changed; the per-pass numbers of postbench.mjs (fenced, minimum over interleaved
rounds) are the meaningful ones:

| view, tier | pass | new ms | legacy ms | note |
|---|---|---|---|---|
| m2c 1280×720, high | AO (GTAO + blur + composite) | 1353 | — | rough desktop-GPU estimate (not measured here) ≈ 0.6 ms at 1080p |
| | DOF (cinematic shots only) | 1658 | — | ≈ 0.7 ms |
| | SMAA | 858 | — | ≈ 0.4 ms |
| | bloom (blend fused away) | 329 | 691 | saved one full-res blend |
| | Cinema (now incl. tone mapping + grade) | 609 | 191 | |
| | exposure | 1.5 | — | |
| m1b 844×390 mobile, medium | Cinema (FXAA + grade + exposure tap) | 49 / 175 | 18 / 56 | two runs (quiet / loaded host); FXAA ≈ ⅔ of the increase |
| | exposure | 1.1-1.4 | — | |
| | bloom | 14-19 | 15-21 | |
| | whole frame | 870 / 2242 | 828 / 2444 | post = 4-8 % of the medium frame |
| m1b 844×390 mobile, low | Cinema (grade fused) | 13 / 43 | 9 / 60 | within noise; ≤ 0.5 % of the low frame |

On real phone GPUs the medium additions are ~10 extra texture taps and ~60 ALU ops per pixel in a pass that
already ran (no new full-screen pass, no new render target beyond 16×16 and 1×1), and low adds ~40 ALU ops only.

## 7. Stage 2: scene lighting (engine.js, realism.js) — done 2026-10-20

Every scene the engine shows now gets its own lighting services, assembled in `Engine._initLighting()` / `_lightScene()`
and updated in `render()` before the composer runs (so they also apply to the finished missions 1-4 without touching
them). Each part is tier-gated in `tierSettings(...).light` and can be switched off for A/B captures with
`?light=noenv,nofog,nowet,nocontact,norig,noshadow,noshafts` (or `engine.lightOff` + `engine.applyLighting()`).

| part | what it does | high | medium | low |
|---|---|---|---|---|
| **env** (image-based light) | `realism.EnvProbe` of the scene itself replaces three's grey RoomEnvironment studio: captured at the camera ~8 frames after `setScene` (characters, rain, particles and the engine's own helpers hidden), re-captured when the place changes (fog / background colour, env intensity or visible light count: era switch, m2 blackout) and when the camera moved 25 m (high) / 40 m (medium desktop; medium phones and low never re-capture on movement, section 11). A capture is spread over ~14 frames (one cube face, the asynchronous luminance read-back, one sanitize face or the prefilter per frame). The probe is scaled to the mean brightness of the studio light every mission was authored with (so `envIntensity`, exposure and the grade still hold), 15 % of it is spread evenly as bounce light, tinted eras are partly desaturated (ancient 0.45, 2196 0.55, 2026 0.8) so an orange sunset sky does not tint every surface twice. Reflections are decoupled from that boost (`realism.setEnvSpecular`, at most 4× physical): at night the wet street mirrors neon and lamps, not a brightened grey. A mission that sets `scene.environment` itself is left alone; `scene.userData.autoEnv = false` opts out. | 256² cube, re-capture on move 25 m | 128², 40 m (phones: place changes only) | 64², place changes only |
| **specular occlusion** | horizon occlusion of image-based specular in three's shared chunk (`installLightingChunks`): a reflection vector bent below the surface by a normal map no longer picks up env light (normal-mapped floors / walls of dark interiors stop reading as shiny plastic). | ✓ | ✓ | ✓ (a few ALU, normal-mapped materials only) |
| **fog** | stock `FogExp2` becomes `realism.HeightFog` in exp2 mode (`heightFogFrom`): same Color object, density linked both ways, the same curve at the ground, thinning with height (falloff per era: rain2049 0.04, helix2026 0.06, ruin2196 0.04, ancient 0.022 /m; `scene.userData.fogFalloff`), the rainy street keeping 60 % of its density at any height (`floor`, `scene.userData.fogFloor`: density(y) = d·(k + (1−k)·e^(−f·y)), section 11). Towers and cliffs rise out of the haze instead of greying out uniformly. Upgraded on the first frame a plain FogExp2 appears, so a mission replacing its fog later is covered. | ✓ | ✓ | ✓ (same fog chunk cost) |
| **wet** | while rain is visible (kit `Rain`, `realism.particles({ kind: 'rain' })`, or `scene.userData.wet`) every MeshStandard / Physical material, characters included, gets wet through three's shared chunk (`realism.setWetness`): up-facing surfaces (shoulders, heads, kerbs, roofs) darker and glossier, walls damp, puddles on flat ground within 0.4 m of `scene.userData.wetGround` (default 0) with near-mirror roughness. One uniform branch when dry. | + puddle ripples, water streaks running down walls / glass | + puddles | gloss / darkening only |
| **contact** | `realism.contactShadows`: a soft AO blob under every character (all `Character` roots, Kai, actors, crowd walkers that cast no shadow), one instanced multiply-blended draw, fading out 16-30 m from the camera. | strength 0.3 (GTAO does the rest) | 0.42 | 0.5 (the only grounding low has) |
| **shadow** | `realism.stabilizeShadow`: following directional shadows (m1 moon, m4 sun) move in whole shadow texels, so edges no longer crawl when Kai walks; `realism.tuneShadow`: normalBias of ~1.3 texels when the author left 0, PCF kernel radius 2 on medium (PCFShadowMap). Cascades were evaluated and not added: each cascade re-draws every caster (m1 ≈ 400 calls), and the 44-60 m following box at 2048² already resolves ~2 cm texels while distant shadow detail disappears into the fog. | ✓ | ✓ | (no shadow maps) |
| **rig** | dialogue light rig: a key spot from the camera side (45°, above) and a rim spot behind the subject, aimed at the focus target of `game.shot()` (`engine.focus`), only for close shots (target < 7 m, fov ≤ 50), fading over ~0.35 s; the spots' range ends ~0.75 m past the subject, so the wall behind a speaker is never lit. No shadows on any tier. Added to the scene only while a shot holds it (no gameplay cost); the program variants are compiled when the scene's probe is first captured, not at the first close-up. `game.shot(pos, look, dur, { rig: false })` opts a shot out, `scene.userData.rigIntensity` scales it. | key + rim | key + rim | rim |
| **shafts** | soft additive light cones (`realism.lightShaft`) under shadow-casting spot lights (m2 reception key, m3 2196 moonlight through the roof), brightness from the haze density and the era (2196 strongest, the valley weakest). +1 draw per such light. | ✓ | 0.8 × | — |

`engine.settleLighting()` (called by `settlePost()`) finishes a pending capture and snaps wet / rig state, so reference
captures are deterministic. `engine.stats` gains `probeMs`, `probes`, `probeLum`, `probeScale`, `roomLum`.

New realism.js exports (all additive; existing signatures unchanged): `EnvProbe`, `setWetness` / `getWetness`,
`setEnvSpecular`, `contactShadows`, `stabilizeShadow`, `tuneShadow`, `installFogChunks`; `HeightFog` / `heightFog`
gained the `exp2` option and `heightFogFrom()` upgrades a FogExp2; `captureEnvironment` gained `hide`, `scale`,
`normalize`, `shadows: false`, `measure`. kit.js `Rain` meshes are tagged `userData.rzRain` + `noCapture`.
game.js: `game.shot()` passes `rig: opts.rig` to `engine.focus` (one additive argument).

Later additions (all opt-in or pure quality): props.js `lampPost()` sets `userData.contactShadow`, and the engine's
contact shadows now also pick up any object carrying `userData.contactShadow = true | radius | { radius, strength,
scale }` (same single instanced draw; missions can tag big props). `contactShadows().track()` entries accept `scale`
(multiplies the tier strength). `setWetness({ mirror })` sets puddle roughness (default 0.1: at 0.05 a point light
reflected in a puddle was a hot blocky dot that bloom turned into a square; at 0.1 it stretches into a vertical streak
like on real wet asphalt). `setEnvSpecular(k, rough)` can exempt rough materials from the night specular cap (default 0,
measured +2 % on m1b, so it stays off). `scene.userData.envFill` / tier `light.envFill` overrides the 15 % bounce fill.

### Before / after (stage 2)

Captured with `refviews.mjs --ab=light`: the same frame of every view, once with the stage-2 lighting and once with
`?light=noenv,nofog,nowet,nocontact,norig,noshadow,noshafts` (the post-processing of stage 1 is on in both).

```
# side by side (before | after): <scratch>/render/light/{r5 (m1 high, medium), r4 (m1 low, m4), r3 (m2, m3)}/<tier>/sbs/<view>.png
# contact sheets:                <scratch>/render/light/r3/<tier>/grid_sbs.png, r4/high/grid_m4.png, r4/<tier>/grid_sbs.png
bash tools/render/runall.sh <out> "m1 high 1280 720 --ab=light;m1 low 844 390 --mobile --ab=light;..."
```

| view | draw calls high, after (before) | medium | low | lights point / spot / dir | mean brightness after vs before, high / medium / low |
|---|---|---|---|---|---|
| m1a_establishing | 491 (490) | 487 (486) | 425 (424) | 7/0/1 | -5% / -6% / -13% |
| m1b_street_people | 393 (392) | 398 (397) | 333 (332) | 7/0/1 | -17% / -20% / -22% |
| m1c_dialogue_hale | 253 (252) | 254 (253) | 149 (148) | 7/2/1 | -2% / -5% / -15% |
| m2a_establishing | 307 (305) | 303 (301) | 258 (257) | 10/3/0 | -12% / -8% / -12% |
| m2b_interior_people | 145 (144) | 145 (144) | 102 (101) | 10/3/0 | -5% / +4% / +7% |
| m2c_dialogue_iven | 75 (74) | 67 (66) | 25 (24) | 10/5/0 | +34% / +51% / +51% |
| m3a_establishing_2049 | 82 (81) | 76 (75) | 62 (61) | 19/0/0 | +2% / +1% / +3% |
| m3b_dialogue_iven_2049 | 49 (48) | 54 (53) | 40 (39) | 19/2/0 | +15% / +11% / +16% |
| m3c_future_2196 | 203 (201) | 197 (195) | 87 (86) | 1/2/0 | -20% / -19% / -17% |
| m4a_establishing | 486 (485) | 492 (491) | 277 (276) | 8/0/1 | -16% / -15% / -13% |
| m4b_village_people | 406 (405) | 422 (421) | 203 (202) | 8/0/1 | -13% / -13% / -13% |
| m4c_dialogue_niko | 397 (396) | 394 (393) | 164 (163) | 8/2/1 | -12% / -10% / -11% |

Draw calls: +1 everywhere (the contact-shadow instanced mesh), +1 per light shaft (m2 and m3 2196, high / medium).
The dialogue rig adds lights, not draws (the close-up light counts above include it: 2 spots on high / medium, 1 on low).

What changed on screen:
- **Rain City (m1)**: the street and pavements are wet: puddles mirror the neon, shop light and street lamps as
  vertical streaks (high / medium), raindrop rings in them and water running down walls and glass (high); shoulders,
  hair and umbrellas get a wet sheen (all tiers). The grey studio sheen that lit the pavement from nowhere is gone,
  which is most of the -17 to -22 % on m1b: the pavement is now dark wet stone lit by the shopfronts and lamps, the
  characters keep their brightness (the walker measured -7 %). Lamp posts and walkers are grounded by contact shadows.
- **Dialogue (m1c, m2c, m3b, m4c)**: the key + rim rig puts light on the speaker's face and a rim on hair and shoulders;
  m2c (formerly nearly black) is +34-51 %. The rig's range stops ~0.75 m behind the subject, so the wall behind Iven
  no longer turns red (an earlier version did; fixed before these captures).
- **Helix 2026 (m2)**: the scene probe replaces the studio, so the dark office reads as a dark office (no grey
  reflections on the floor); the reception gets a soft light cone under its key spot.
- **2196 (m3c)**: darker and moodier (-20 %), moonlight cone through the roof, crates and walls no longer flat-lit.
- **Ancient valley (m4)**: the cliffs and the mountain rise out of the haze instead of greying out (height fog), the
  sunset colour is kept without tinting the grass brown (probe desaturated to 0.45), stable sun shadows. The -13 %
  is the haze veil gone, not darker characters.

### Cost (stage 2)

Wall-clock frame times on the shared container swung by ±30 % (load average 16-18 on 4 cores during these runs,
other workflows rendering at the same time), which hides any difference under ~10 %. The stage-2 cost was therefore
measured as the **CPU time of the browser's GPU process per frame** (the SwiftShader rasterizer's work; it is much
less sensitive to contention), A/B/A/B in one page, same frame, `tools/render/cpuab.mjs`:

```
node tools/render/cpuab.mjs m1 m1b_street_people low 844 390 --mobile 6 2 - noenv+nofog+nowet+nocontact+norig+noshadow+noshafts
```

| view, tier, size | stage-2 on: median (min-max) ms | stage-2 off | difference |
|---|---|---|---|
| m1b, low, 844×390 (rain: wet gloss on) | 1987 (1817-1993) | 1900 (1837-2000) | +4.6 % median, -1 % min: within noise |
| m1b, low, 1688×780 (4× the pixels, fragment-bound) | 6195 (6015-6440) | 6215 (5675-6260) | -0.3 % median |
| m1b, medium, 844×390 (+ puddles) | 2330 (2090-2390) | 2210 (2145-2540) | +5 % median, -3 % min: within noise |
| m1b, high, 1280×720 (+ ripples, streaks) | 6825 (6425-6955) | 6580 (6335-6850) | +3.7 % median, +1.4 % min |
| m4b, low, 844×390 (dry: fog + spec occlusion only) | 1935 (1860-2200) | 2065 (1915-2235) | -6 % median: within noise |

So the per-frame cost of stage 2 is below what this container can resolve (≈ 5 %) on every tier, including the low tier
at 4× pixel count, where a fragment-shader cost would show most. By construction on low: the wet branch is ~15 ALU on
lit pixels when raining (puddles, ripples and streaks are skipped by uniform branches), the height fog replaces one exp
with two, the horizon occlusion is ~6 ALU on normal-mapped materials, the contact shadows are one draw of a few quads,
the rig is one shadowless spot light during close-ups only, and there are no shafts.

One-time costs: the scene probe is captured ~8 frames after a scene starts (and again when the place changes), one cube
face per frame, i.e. six frames each re-draw the scene once more into a 64² (low) / 128² (medium) / 256² (high) face.
`engine.stats.probeMs` on SwiftShader: 0.2-4 s total on low, 0.6-4 s on medium, 0.1-7 s on high (m1 and m4, the
heaviest scenes, at the top); on a phone GPU that is six frames with one extra small-target scene draw each, under the
mission intro. High / medium desktop re-capture after the camera has moved 25 / 40 m; low and medium phones never re-capture on movement (section 11).

### Re-check after stage 4 (2026-10-21)

Stage 4 batched the static meshes and changed kit / props / realism after the stage-2 captures, so all twelve views
were captured again with `--ab=light` on high, low (mobile) and m1 medium (mobile) against the current build
(`<scratch>/render/light/final/{high,medium_mobile,low_mobile}/sbs/`, `grid_sbs.png`). Every stage-2 effect still shows
and nothing regressed: wet puddle streaks of the neon and lamps on m1 (all three tiers; ripples / wall streaks on high),
the key + rim rig on m1c / m2c / m3b / m4c (m2c Iven readable on low too), the scene probe in m2 / m3, the height fog and
desaturated probe in m4. m3b (polished lab floor) now mirrors the bright ring wall: +16 % mean brightness, the same
as in the stage-2 table. Draw calls are lower than in the stage-2 table because of the stage-4 batching (m1a high 313,
low 249); stage 2 still adds +1 (+2 with a light shaft).

GPU-process CPU time per frame (`cpuab.mjs`, stage 2 on vs `noenv+nofog+nowet+nocontact+norig+noshadow+noshafts`,
6 × 2 frames, same page, load average 8-21):

| view, tier, 844×390 mobile | on: median (min-max) ms | off | difference |
|---|---|---|---|
| m1b street, low (raining) | 2005 (1960-2030) | 2005 (1940-2065) | 0 % |
| m1b street, medium (+ puddles) | 2385 (2335-2425) | 2350 (2310-2405) | +1.5 % |
| m4b village, low (dry) | 1810 (1780-1860) | 1835 (1780-1915) | -1.4 % |
| m1c dialogue close-up, low (rim spot of the rig on) | 1975 (1935-1980) | 1885 (1855-1905) | +4.8 % |

Gameplay frames on low / medium are unchanged within noise. The only measurable low-tier cost is the one shadowless rim
spot during close-up dialogue shots (+4.8 %); those frames stay cheaper than the gameplay street frame of the same
mission (1975 vs 2005 ms here, 94 vs 193 draw calls), and `scene.userData.rigIntensity = 0` or `{ rig: false }` on a
shot removes it. The wall-clock frame times of the `--ab=light` captures swung -25 … +155 % with the host load (load
average 28 → 5 during the run), so they are not used as cost numbers.

## 8. Stage 4: buildings and street infrastructure (kit.js, props.js, realism.js, engine.js) — done 2026-10-20

Missions 1-4 get the automatic part without a code change; new missions call the builders documented in
docs/MISSION_GUIDE.md, section "Infrastructure kit". Every export and parameter of kit.js / props.js / realism.js is
unchanged; the upgrade switches off with `?infra=off` (or part by part: `?infra=nofacade,nomasonry,nolamp,nobatch`)
and `engine.setInfraLegacy(true | false)` flips a running scene for same-frame A/B captures.

### What changed

| part | where | what it does |
|---|---|---|
| **facade buildings** | kit.js `box()` + `resolveFacades()` (engine, first frame), realism.js `facadeGeometry` | a `box()` with a `facadeTextures(seed, style, era = '2049')` material, ≥ 8 m tall, becomes a real building: window reveals with frames, mullions, sills and lit interior-mapped rooms, floor ledges / string courses, cornice and parapet, balconies, fire escapes, AC units, downpipes and gutters, rooftop plant (bulkheads, HVAC, water tanks, antennas, dishes), and the era's retrofits (2049: cladding patches, LED strips, LED / holo sign panels, canopies with LED edges, cable runs, aviation lights). It probes what the scene placed around it: faces against a neighbour become party walls, a ground floor the mission dressed itself (shop plane, awning, sign) stays plain wall and every protruding item that would hit a sign, lamp or neighbour is dropped; the other street faces get shop fronts. Camera blockers still ray-test the plain box. |
| **era variants** | realism.js `cityBlock(list, { era })` / `facadeGeometry({ era })` | `'2026'` contemporary (clean walls, aluminium fins, glass balcony fronts, solar roofs), `'2049'` retrofitted Rain City, `'2196'` ruin (blown-out / boarded windows, soot, cracks, moss, broken parapets, a collapsed corner with exposed slabs and rebar, vines, rust, rubble); `settlement()` / `ancientHouse()` for the valley: stone, mud-brick and half-timber houses (rectangular or round) with thatch (new `thatch` recipe), flat or no roofs, doors, shutters, five draws for any number of houses. Without `era` a block looks exactly as before. |
| **masonry** | kit.js `box()` | a house-sized box with `stoneMaterial()` (m4) gets a plinth course, corner quoins, a timber wall plate and beam ends (child meshes sharing the box's material). |
| **lamp posts** | props.js `lampPost(color, h, opts)` | rebuilt in place: cast base, tapered pole, bracket, luminaire with a lit lens and a glow card that reads without bloom on low; `{ era: '2049' }` adds an LED strip. |
| **street kit** | props.js `streetKit({ era })`, `prop(kind)` | opt-in: kerbs, drains, manholes, road markings (lanes, edge lines, zebra crossings, stop lines, arrows), bollards, lamps, traffic lights that cycle, benches, bins, bus / tram shelters, vending / holo kiosks, railings, overhead cables and catenary, embedded tram rails, puddles, parked cars / vans (2049 cars with LED light bars and underglow), scooters, cones, barriers, wrecks and rubble (2196: posts tilted, metal rusted, cars wrecked), and the ancient set (fences, wells, carts, stalls, pots, barrels, crates). `scatter()` places them along paths or in areas; colliders on request. |
| **static batching** | realism.js `StaticBatcher`, engine `_updateInfra()` | on every tier, static meshes that share a material (or an equivalent plain one, or a static canvas texture through a per-cell atlas) merge into a few draws per 50 m cell: snapshot 2 frames after `setScene`, merged at frame 6 if unchanged, new static meshes picked up every 120 frames. A member that moves, changes material / colour, is hidden or removed is released and draws itself again in the same frame (tested: move, hide, re-colour, parent move, removal, raycasts and `Box3.setFromObject` still hit the original). Opt out: `mesh.userData.noBatch`, `scene.userData.batch = false`. |
| **small-prop culling** | engine `_updateInfra()` | instanced street-kit parts carry a per-kind distance (drains 45 m … stalls 120 m) scaled by the tier (`infra.smallCull`: 180 / 120 / 80 → ×1.5 / ×1 / ×0.67). |

Per tier:

| | high | medium | low |
|---|---|---|---|
| facade shader | full interior mapping (ray-box rooms with furniture, curtains / blinds, PBR wall: 3 taps, trilinear) | desktop: lite (frames, mullions, sills, lit rooms with a lamp gradient, Fresnel glass; PBR wall: 3 taps, nearest-mip); **phones: the low path** (since review 1, section 10) | lite with 1 wall tap (nearest-mip), Lambert-only direct light |
| far windows | averaged beyond ~2.5 px | per-cell lit / dark beyond ~3.5 px | per-cell beyond ~5 px |
| facade geometry | balusters, stair treads, ladder rungs | without them (sub-pixel on phones) | without them |
| batching atlas | 2048 | 2048 (phones 1024) | 1024 |
| small-prop cull | ×1.5 | ×1 (phones ×0.71) | ×0.67 |
| batch cell | 50 m | 50 m (phones 200 m) | 50 m (phones 200 m) |
| small props / ground slabs cast shadows | yes | yes (phones: no) | (no shadow maps) |

### Before / after (stage 4)

```
# reference views, before = the build just before this stage (captured 16:00, sources in <scratch>/render/infra/src_before),
# after = this stage, same views.json:
bash tools/render/runall.sh <scratch>/render/infra/after "m1 high 1280 720;m1 low 844 390 --mobile;...;m4 low 844 390 --mobile"
node tools/render/report.mjs <scratch>/render/infra/after/<tier> <scratch>/render/infra/before/<tier>
# side by side (before | after): <scratch>/render/infra/after/{high,low_mobile}/sbs/<view>.png
#   m1 low with the final phone shader: <scratch>/render/infra/after2/low_mobile/sbs/<view>.png, grid_sbs.png
#   same-frame A/B PNGs (new | legacy): <scratch>/render/infra/final/shots/
# same-frame A/B with costs (new | legacy = ?infra=off in the same page), PNGs with --shots:
node tools/render/infraab.mjs m1 m1a_establishing low 844 390 --mobile 5 2 new legacy --shots=<dir>
# the kit's eras in one street each (review scenes):
node tools/render/labshot.mjs "http://localhost:8765/tools/render/infra-lab.html?era=2049|2026|2196|ancient&gfx=high&view=0|1|2" out.png
```

Draw calls and triangles of the twelve reference views (report.mjs; frame times of these runs are not comparable,
the two sets ran hours apart under different container load, see "Cost" for timing):

| view | high calls before → after | high tris | low (phone) calls before → after | low tris |
|---|---|---|---|---|
| m1a_establishing | 495 → 305 (-38 %) | 453k → 622k | 427 → 252 (-41 %) | 365k → 438k |
| m1b_street_people | 392 → 259 (-34 %) | 452k → 618k | 329 → 193 (-41 %) | 363k → 433k |
| m1c_dialogue_hale | 253 → 185 (-27 %) | 445k → 557k | 149 → 109 (-27 %) | 356k → 420k |
| m2a_establishing | 310 → 175 (-44 %) | 101k → 101k | 258 → 127 (-51 %) | 48k → 37k |
| m2b_interior_people | 146 → 111 (-24 %) | 75k → 76k | 103 → 70 (-32 %) | 45k → 34k |
| m2c_dialogue_iven | 74 → 63 (-15 %) | 40k → 41k | 24 → 19 (-21 %) | 20k → 20k |
| m3a_establishing_2049 | 82 → 66 (-20 %) | 35k → 35k | 62 → 46 (-26 %) | 35k → 35k |
| m3b_dialogue_iven_2049 | 50 → 48 (-4 %) | 29k → 29k | 40 → 33 (-18 %) | 33k → 33k |
| m3c_future_2196 | 203 → 77 (-62 %) | 93k → 147k | 87 → 24 (-72 %) | 36k → 46k |
| m4a_establishing | 486 → 253 (-48 %) | 350k → 361k | 277 → 152 (-45 %) | 292k → 298k |
| m4b_village_people | 406 → 212 (-48 %) | 335k → 345k | 204 → 115 (-44 %) | 286k → 290k |
| m4c_dialogue_niko | 397 → 205 (-48 %) | 342k → 349k | 164 → 92 (-44 %) | 282k → 283k |

Triangles grow where a merged 50 m cell is drawn whole once any part of it is visible (m3c) and with the facade
geometry (m1); the m2 low-tier drop comes from other workflows' changes between the two runs (the same-page A/B
below gives equal triangles for new and legacy there). Every view is now inside the phone budget on the phone tier (≤ 250 calls, ≤ 700k triangles: worst m1a 250-252 calls /
438k in the capture runs, 229-239 in the A/B runs; medium m1a 278 calls / 529k), where m1 was at 427 calls before.

What changed on screen:
- **Rain City (m1)**: the two walls of flat window-grid boxes are streets of buildings: brick, concrete, plaster and
  panel facades with real window reveals, frames, mullions and sills, rooms with lamps, blinds and curtains behind the
  glass (lit / dark per window), balconies, fire escapes, AC units, downpipes, ledges and cornices, retrofitted LED
  strips, holo sign panels and canopies, rooftop tanks and antennas against the sky; shop fronts and roller shutters
  at street level where the mission did not dress the ground floor itself; the mission's own neon signs, awnings and
  lamps stay where they were (the builder keeps clear of them). Lamp posts are real street lights.
- **Ancient valley (m4)**: house walls get plinths, quoins, a wall plate and beam ends; the scene draws in half the
  calls (batching of the many small static meshes: stones, fences, steps, props).
- **Helix (m2), 2049 / 2196 chambers (m3)**: no facade boxes, so the look is unchanged (same-frame A/B identical);
  draw calls drop 15-72 % from batching.

The opt-in builders in the Infrastructure Lab (`tools/render/infra-lab.html`: one 100 m street per era, buildings on
both sides through `cityBlock`, the full street kit, rendered through the game's Engine; settlement + ancient kit
for the valley), view 0, after 14 frames:

| era | low calls / tris | high calls / tris | build ms low / high (SwiftShader, incl. texture bakes) |
|---|---|---|---|
| 2049 Rain City (rails, cables, puddles, cars, scooters, kiosks, shelters, traffic lights) | 111 / 66k | 189 / 246k | 9 892 / 26 876 |
| 2026 contemporary | 97 / 39k | 192 / 96k | 6 510 / 21 861 |
| 2196 ruin (wrecks, rubble, tilted posts) | 61 / 40k | 130 / 119k | 6 360 / 15 619 |
| ancient settlement (8 houses, well, cart, stalls, fences, pots, barrels, crates) | 29 / 42k | 75 / 83k | 6 233 / 11 651 |

Captures: `<scratch>/render/infra/lab/final_<era>_<tier>.png` (and the earlier review shots `2049_v0/v1`, `2026_v0`,
`2196_v0`, `ancient_v0`). A complete dressed street stays at well under half the phone budget on low.

Added 2026-10-21: abandoned-street overgrowth (`k.overgrowth()`, instanced weed clumps and sealed asphalt cracks;
with `era: '2196'` kerbs sprout gutter weeds and road paint is faded with missing dashes, `RZ.roadPaint({ wear, drop })`).
The 2196 lab street with overgrowth along the road and both pavements (195 instances, 24 draws for the whole
street kit before culling): low 73 calls / 47k tris (was 61 / 40k), high 159 / 135k (was 130 / 119k), container idle.
Captures `<scratch>/render/infra/lab/og_2196_{high,low}.png` (compare `final_2196_*`).

Playthrough check (2026-10-21, idle container, `?gfx=low`, 960×540, `tools/drive.mjs` with the long-timeout copies of
tools/tests/m1-m4 in `<scratch>/render/infra/verify/`): missions 1, 2, 3 and 4 all play through to the next mission
with the stage-4 kit and batching on (m1 1088 s → mission 2 title, m2 117 s, m3 113 s → mission 4, m4 103 s with all
six evidence items including "A card from 2049, three thousand years old"). Two test-harness timing notes, not
caused by this stage: m1.json waits for 6 evidence items but mission 1 now awards 5 (3 anomalies, badge, Mira),
and m4.json's pedestal step can race the pedestal prompt at SwiftShader frame rates (`m4_robust.json` waits for
the prompt first).

### Cost (stage 4)

Same-frame A/B in one page (`tools/render/infraab.mjs`, `new` vs `legacy` = everything as before stage 4), median of
5 interleaved repetitions of 2 frames. `raster` = CPU time of the browser's GPU process per frame (SwiftShader's
rasterizer: the GPU-side work), `wall` = wall clock per frame, `js submit` = main-thread time of the render call with
the GPU queue drained first (three.js + WebGL command submission: the draw-call side a phone CPU pays).

| view, tier (844×390 mobile unless noted) | calls new / legacy | tris new / legacy | raster ms new / legacy | wall ms | js submit ms |
|---|---|---|---|---|---|
| m1a_establishing, low | 239 / 425 | 439k / 365k | 2210 / 1915 (+15 %) | 825 / 715 (+15 %) | 10.1 / 10.8 (-6 %) |
| m1a_establishing, medium (as first built: lite facade with the PBR wall, RZ_INTERIOR 1) | 278 / 489 | 529k / 453k | 2730 / 2370 (+15 %) — **understated**: three same-page re-runs in review 1 gave 2315 / 1715 (+35 %), 2265 / 1725 (+31 %), 2375 / 1930 (+23 %) | 993 / 851 (+17 %) | 11.9 / 13.1 (-9 %) |
| m1a_establishing, medium **phones since review 1** (low's facade path, RZ_INTERIOR 0; 200 m cells) | 216 / 460 | 392k / 314k | 2430 / 1960 (+24 %) and 2490 / 2195 (+13 %) in two runs; RZ_INTERIOR 1 in the same runs 2630 (+34 %) / 2625 (+20 %) | 2334 / 2350 (load 8-19) | 10.4 / 18.4 (-43 %) |
| m1a_establishing, high (1280×720) | 283 / 495 | 621k / 453k | 11480 / 6020 (+91 %) | 11819 / 6129 (+93 %) | 14.3 / 24.6 (-42 %) |
| m1b_street_people, low | 184 / 325 | 433k / 362k | 2310 / 1925 (+20 %) | 836 / 694 (+20 %) | 8.0 / 10.5 (-24 %) |
| m1b_street_people, medium | 232 / 392 | 525k / 450k | 2535 / 2155 (+18 %) | 932 / 786 (+19 %) | 9.6 / 10.0 (-4 %) |
| m1c_dialogue_hale, low | 103 / 149 | 423k / 356k | 2090 / 1870 (+12 %) | 1354 / 1051 (+29 %, min 561 / 523) | 6.1 / 6.6 (-8 %) |
| m2a_establishing, high (1280×720) | 122 / 308 | 82k / 80k | 3640 / 3650 (0 %) | 5186 / 4553 (2 reps, noisy) | 4.7 / 10.1 (-53 %) |
| m3c_future_2196, low | 24 / 87 | 46k / 36k | 835 / 835 (0 %) | 824 / 937 (-12 %) | 2.5 / 3.2 (-22 %) |
| m4b_village_people, low | 113 / 204 | 290k / 286k | 1745 / 1715 (+2 %) | 1712 / 1726 (-1 %) | 7.8 / 6.6 (+18 %, within noise) |
| m4b_village_people, medium | 219 / 422 | 354k / 344k | 1960 / 1915 (+2 %) | 1971 / 1867 (+6 %) | 8.2 / 10.0 (-18 %) |

Reading the numbers:
- **Draw calls / CPU side: better on every view.** 30-60 % fewer draws on every tier; the submission time per frame
  drops 4-53 % on this desktop CPU (one +18 % on m4b low is within that run's noise). On a phone CPU, where three.js
  plus the WebGL driver cost roughly 20-50 µs per draw, the 90-190 saved draws are several ms of the low-tier frame.
- **Non-facade scenes (m2, m3, m4): equal** in raster time (0 to +2 %, batching, nothing new per pixel; m4's
  masonry adds 4-10k triangles).
- **m1 (the facade-heavy city): +12-24 % raster time on SwiftShader** at the phone sizes on low and (since review 1) on
  medium phones, which now use the low facade path (with the medium desktop path it was +23-35 %; first version: +24-35 %). The old facade was a flat
  print (two 2D texture taps, no arithmetic); the new one computes windows, frames, sills and rooms per pixel. On
  SwiftShader, a CPU rasterizer where every ALU instruction costs, that is the measured difference; on a phone GPU the
  extra ~100-150 instructions per facade pixel are cheap next to texture bandwidth (estimate for a 2019 mid-range
  Adreno at 844×390: well under 1 ms), while the 190 saved draw calls are several ms of CPU. It could not be
  verified on a phone from this container. If a device turns out GPU-bound in m1, `?infra=nofacade` (or `infra`
  tier settings) restores the old print at the old cost while keeping the batching.
- **high (desktop)**: full interior mapping is ALU-heavy by design (ray-box rooms, furniture, curtains): m1a
  +91 % raster on SwiftShader; desktop GPUs run it at a small fraction of the frame.

What was done to bring the phone-tier cost down (each step measured with infraab.mjs probes; the
`RZ_FACADE_PROBE` define cuts the facade shader short for that and is never set in the game):
1. Probes on low m1a (1688×780, fragment-bound): plumbing + new geometry +3 %, wall layer +12 %, windows +13 %
   over legacy (first version +32 % in total).
2. Window work only where a window is: the sill / window AA masks run inside a cheap box test, the room hash and
   Fresnel only inside the window (SwiftShader skips a branch when all four pixels of a quad agree; tested with a
   never-taken expensive branch: +2.5 %).
3. The wall texture is fetched only where wall shows (window glass skips it).
4. Nearest-mip filtering of the facade wall layers on low / medium: -7 % frame, invisible on textured walls.
5. Low only: Lambert direct light on facades (no GGX for the 8 direct lights; env reflections unchanged): -3.6 %.
6. Medium: low-detail facade geometry (no balusters / treads / rungs): -93k triangles on m1a.
7. The aerial-perspective term of every realism material is skipped by a uniform branch at night / overcast.
Tried and dropped: a roughness branch inside the light loop (slower on SwiftShader), anisotropy 1 (no change),
earlier far-window switching alone (no change; kept for its look: far windows now keep their own lit / dark state
instead of a uniform glow).

Build cost (once per scene, `engine.stats.facadeMs`, `kit.facadeStats`; m1 low, 48 buildings, container under load
13-17): geometry 0.40 s, neighbour probes and avoid tests 0.05 s (801 tests), and the first facade material 13.8 s,
which is the one-time GPU bake of the seven wall layers × albedo / normal / ORM (procedural noise shaders read back
with readPixels: ALU-bound, so SwiftShader-slow; on a phone GPU it is 21 small full-screen passes plus 6 shader
compiles, estimated well under a second, not measured). Static batching: 72 batches holding 268 meshes, 0.45 s on
the first merge.

## 9. Stage 3: surface materials (kit.js, realism.js) — done 2026-10-21

`asphaltMaterial`, `tileMaterial`, `stoneMaterial` and `concreteMaterial` keep their signatures and still return a
plain `MeshStandardMaterial`, now with a GPU-baked albedo, tangent-space normal map and ORM map from
`realism.textureSet` instead of one 256² canvas albedo:

| function | recipe | what the surface gains |
|---|---|---|
| `asphaltMaterial(repeat)` | `wetAsphalt` (darker colour to match the old print, puddles 0.4, wet 0.55) | aggregate stones, sealed cracks, oil stains, damp low spots and baked puddles (roughness 0.025 there); no AO map (its specular occlusion dimmed the neon mirrored in the street) |
| `tileMaterial(base, grout, repeat, opts)` | `ceramicTile` (4 × 4 tiles per repeat like the canvas, new `joint` parameter: 5.5 mm grout) | bevelled tile edges and recessed grout in the normal map, per-tile tone and lippage, glossy tiles / rough grout (`opts.roughness` is the tile value), grout AO |
| `stoneMaterial(base, repeat, seed)` | `cutStone` (6 courses per repeat like the canvas) | ashlar blocks with chamfered joints, tooled faces, lichen and dirt, joint AO; still tagged for stage-4 masonry |
| `concreteMaterial(base, repeat, opts)` | `concrete` (formwork 0.35, `opts.stains` → heavy runoff streaks) | pores, pour lines, fine cracks, efflorescence, runoff streaks |

How it stays cheap and compatible:
- **Colour-neutral bakes, shared.** Each recipe is baked once per kind and variant (stone: seed parity; concrete:
  stains on / off) with a neutral grey, the mission's colour goes into `material.color` (authored / neutral). Every
  call with the same arguments gets the same texture objects (per-repeat clones of one GPU texture), so equal
  materials stay equal and static batching still merges them (m4: dozens of stone boxes in a few draws).
- **Texture size by tier** (`realism.TIERS[*].kitTex / kitHero`): 256 on low, 512 on medium and high, the asphalt
  1024 on high. Anisotropy 4 (the canvases had 8).
- **Taps per pixel**: map + normal + ORM (roughness) on low, + the AO map (same ORM texture) on medium / high.
- **Specular anti-aliasing** for these surfaces (`defines.RZ_SPECAA`, realism's shared lighting chunk): roughness is
  widened where the mapped normal varies inside a pixel, so glossy tiles do not sparkle at distance.
- **Plain material**: no `onBeforeCompile`, so batching, `setValues(opts.extra)` and everything that inspects the
  materials keep working.
- **A/B**: `?infra=nomat` (or `off`) builds the canvas versions; `engine.setMaterialsLegacy(true | false)` (kit
  `setKitMaterialsLegacy(scene, legacy)`) flips a running scene, same frame; `tools/render/infraab.mjs … new oldmat`
  measures it, `tools/render/abshots.mjs … old='E.setMaterialsLegacy(true)' new='E.setMaterialsLegacy(false)'`
  captures it.

Cost, same frame, same page (`infraab.mjs`, raster = GPU-process CPU ms per frame, 5 × 2 frames, 844×390 mobile, low):

| view | new / canvas (oldmat) | |
|---|---|---|
| m2a_establishing (tiled lab floor fills half the frame) | 930 / 985 | -6 %, within noise (min 850 / 845) |
| m1b_street_people (asphalt, pavement tiles) | 1915 / 1930 | -1 % |
| m4b_village_people (stone houses) | 1590 / 1635 | -3 % |
| m1a_establishing, medium phones | 2430 / 2400 | +1 %, within noise |

No measurable cost on any tier: the new maps are smaller than the old 512² asphalt canvases and the extra taps hit
256² / 512² textures that stay in cache. One-time cost: 3-4 surface bakes per mission (3 full-screen passes each).


## 10. Fixes after review 1 (look + phone performance) — done 2026-10-21

Every finding of the two review-1 passes, what changed and how it was checked. "Before" is the tree as review 1 saw
it (captures in `scratchpad/render/review1`, a frozen copy of that site for same-machine runs); "after" is this tree.
All frame data are SwiftShader in the shared container (load 15-20), so they are compared within one run or one page.

| # | finding | fix (file) | verification |
|---|---|---|---|
| 1 | Stage 3 (surface materials) missing | built, see section 9 (kit.js, realism.js) | same-page A/B on m1b / m2a / m4b, cost within noise on every tier |
| 2 | probe crushes dark interiors (m2b floor black, legs lost) | `EnvProbe.keepAsFloor()` + `normalize.floor`: no captured direction darker than a share of the studio light the scene was authored with *in that direction* (bright from above). Share 0.5, raised by (0.3 / environmentIntensity)^0.6 (max ×3) when a mission turns the environment far down: m2's blackout (0.06) gets 1.3 (engine.js, realism.js) | m2b low floor luma (sRGB, lower quarter): stage 0 10.6, review 1 3.3 (79 % of pixels black), after 8.3 (38 %); tile grid and Kai's legs readable again; high: black pixels 60 → 50 %, tiles visible. m1 night street unchanged (share 0.5; 1.0 would lift it +11 %, rejected) |
| 3 | sunset probe turns the valley grass ochre | diffuse IBL desaturated separately from reflections (`realism.setEnvDiffuseSaturation`, ancient 0.3; reflections keep 0.75), and the valley keeps the full studio sky from above (floor share 1): its captured sky is darker overhead than the studio, which left the orange key alone on the grass (engine.js, realism.js) | grass (m4b, lower left): stage 0 hue 51-52°, review 1 41° / luma 66-70, after 46-47° / luma 90-92 (stage 0: 86-93); m4a 38° → 45° (stage 0 47°). Same-page A/B showed the hue lag came from brightness, not chroma: desaturating the diffuse fully moved it 1° |
| 4 | hard faceted band across the ceiling inside the reception key-light cone | `realism.lightShaftFade(shaft, camPos)`: 0 inside the cone, smooth to 1 at 1.5 m outside its surface, applied per render in the shaft's `onBeforeRender` (whichever camera draws it). Also fixed: the cone's radii were swapped (it opened toward the light); 24 segments instead of 20 (realism.js) | `verify/m2a_ceiling.png`: the V band is gone, the shaft glow from outside is unchanged |
| 5 | lens chromatic aberration splits thin bright lines | `r2 * 0.0015 * smoothstep(0.35, 1, r2)` instead of `r2 * 0.0055`: ≤ 1 px inside the inner frame (engine.js) | `verify/ca_m1a.png` (edge crop ×2): rain streaks and window frames one colour again |
| 6 | sub-pixel aliasing: dotted LED strips, moiré on shutters / louvres | LED strips (facade region 6) are widened in the vertex shader to ~1.5 px at any distance (`shared.viewH`, per-vertex thin offsets from `MassingBuilder._thinW2`), emission × √(coverage) so the line keeps its energy; shutter ridges and louvres fade to their average once a period spans < ~2 px (screen-space derivative, computed outside the branches) (realism.js, engine.js) | `verify/alias_m1a.png`: distant strips continuous instead of dashed; no added draw calls or passes |
| 7 | after a WebGL context loss / restore the scene probe stayed empty (characters, pavement dark) | `webglcontextrestored` → `Engine._contextRestored()`: new probe + studio fill, scene moved over, re-capture, batches rebuilt, eye adaptation restarted (engine.js) | `perf/ctx2_sbs.png`, m1b medium phones: before the fix the restored frame's pavement luma fell 14.2 → 3.1 (79 % black); after 14.2 → 15.8 (the re-capture is taken where the camera now is) |
| 8 | medium phones slower than before in m1 (facade path) | phones on medium use low's facade path (`setQuality(q, { interior: 0 })`, RZ_INTERIOR 0) | table in section 8 (m1a medium phones +13-24 % raster vs. before stage 4, first build +23-35 %); m1a medium phones vs. review-1 tree, same view: frame min 1599 → 1138 ms, scene 1535 → 1316 ms |
| 9 | medium phones over 250 draw calls in m1 | phones on medium: small-prop cull ×0.71 (85 m), 200 m batch cells, no shadows from small props / flat ground slabs, 3 bloom mips (weights of the dropped ones carried by the rest) (engine.js, realism.js) | reference views m1a / m1b / m1c: 278 / 235 / 182 → 245 / 205 / 161. Gameplay (third-person camera at 9 points along mission 1, 6 frames each, max): 286 / 253 / 247 / 180 / 213 / 211 / 162 / 132 / 249 → 245 / 214 / 204 / 143 / 185 / 176 / 135 / 124 / 200 |
| 10 | a runtime tier change (menu, adaptive downgrade) did not re-tier built content | `setQuality` → `_retier()`: facade materials built from the tier get the new RZ_INTERIOR (going to 0 frees their wall normal / ORM arrays), batches and sign atlases rebuilt at the new size, street-kit shadows follow (engine.js, realism.js `setFacadeInterior`) | m1a medium desktop → low at runtime: facade defines RZ_INTERIOR 1 → 0 on all 52 facade materials, texture memory 509 → 356 MB |
| 11 | texture memory grew on phone tiers | phones on medium: 1024 sign atlases (low's), lite facade never binds the wall normal / ORM arrays (never uploaded) | m1a at ready, glhook accounting (all live GL textures incl. mips): medium phones 503 → 398 MB (-106 MB), low 399 → 371 MB |
| 12 | more shader programs linked at scene ready on low | the dialogue-rig variant warm-up is skipped on 'low' without KHR_parallel_shader_compile (it would be a synchronous compile of every visible material); variants then compile at the first close-up, which starts on a cut (engine.js) | m1a low phones: 84 → 58 programs at ready (96 → 70 linked); medium 101 → 99 |

Phone-tier frame cost of these fixes (m1a, 844×390 mobile, same view, review-1 tree vs. this tree, one run each,
`perfprobe.mjs`): low 240 → 208 calls, frame min 2111 → 1252 ms; medium phones 288 → 249 calls, frame min 1599 →
1138 ms. Nothing in this section adds a pass or a per-pixel cost on low / medium: items 2-3 only change the probe
capture (once per place), item 4 is one uniform per shaft, item 6 adds vertex work on LED strips only.

Captures: `scratchpad/render/fix1/` (`ref_after`, `ref_after2` = all reference views after the fixes; `verify/` side by
sides; `envfloor*`, `grass*` = same-page A/B of the probe floor and diffuse saturation; `perf/` = memory, context-loss
and runtime-tier runs; `gameplay/` = the mission-1 draw-call walk, steps in `gameplay/steps.json`).
