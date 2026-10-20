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
| **3. Materials** (kit.js, realism.js) | `tileMaterial`, `stoneMaterial`, `concreteMaterial`, `asphaltMaterial` return the same material kinds with normal / roughness / AO maps from realism.textureSet (GPU baked once, cached, 256 / 512 / 1024 by tier); asphalt gets rain ripples, puddle masks and darker wet albedo; `facadeTextures` draws 2× resolution facades with frames, sills, blinds and interior variation and returns normal / roughness companions; `glowMat` fixtures get a soft emissive falloff; `chronolith`, `trainCar`, `lampPost`, `Drone` get real metal / glass / rubber breakup. Optional Cycles bakes (AO / curvature) for the chronolith and the train car under `assets/baked/`. | all tiers (texture size by tier); interior-mapped windows high / medium only | G8, G9, G12 (look) |
| **4. Buildings and street infrastructure** (kit.js, props.js) | `box()` recognises a facade material and adds merged relief (window reveals, floor ledges, cornice, roof parapet, rooftop units, water tanks, antennas) for that building: one extra draw at most, skipped on low beyond 60 m; a street-furniture set (`kerb`, `drain`, `bollard`, `railing`, `trafficLight`, `signPole`, `cableRun`, `transitShelter`, `rooftopUnits`) as instanced / merged builders for new missions; `lampPost` rebuilt in place (pole base, arm, luminaire with a lit lens and an optional light cone). Missions 1-4 keep their layout; the missions workflow is offered one-line calls to dress their streets. Static-mesh merging (`mergeStatic(scene)`) after a scene is built cuts m1 below 250 calls on phones. | geometry everywhere, merging on medium / low, light cones high / medium | G12, G13, G16 |
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
| **env** (image-based light) | `realism.EnvProbe` of the scene itself replaces three's grey RoomEnvironment studio: captured at the camera ~8 frames after `setScene` (characters, rain, particles and the engine's own helpers hidden), re-captured when the place changes (fog / background colour, env intensity or visible light count: era switch, m2 blackout) and when the camera moved 25 / 40 m. The probe is scaled to the mean brightness of the studio light every mission was authored with (so `envIntensity`, exposure and the grade still hold), 15 % of it is spread evenly as bounce light, tinted eras are partly desaturated (ancient 0.45, 2196 0.55, 2026 0.8) so an orange sunset sky does not tint every surface twice. Reflections are decoupled from that boost (`realism.setEnvSpecular`, at most 4× physical): at night the wet street mirrors neon and lamps, not a brightened grey. A mission that sets `scene.environment` itself is left alone; `scene.userData.autoEnv = false` opts out. | 256² cube, re-capture on move 25 m | 128², 40 m | 64², place changes only |
| **specular occlusion** | horizon occlusion of image-based specular in three's shared chunk (`installLightingChunks`): a reflection vector bent below the surface by a normal map no longer picks up env light (normal-mapped floors / walls of dark interiors stop reading as shiny plastic). | ✓ | ✓ | ✓ (a few ALU, normal-mapped materials only) |
| **fog** | stock `FogExp2` becomes `realism.HeightFog` in exp2 mode (`heightFogFrom`): same Color object, density linked both ways, the same curve at the ground, thinning with height (falloff per era: rain2049 0.05, helix2026 0.06, ruin2196 0.04, ancient 0.022 /m; `scene.userData.fogFalloff`). Towers and cliffs rise out of the haze instead of greying out uniformly. Upgraded on the first frame a plain FogExp2 appears, so a mission replacing its fog later is covered. | ✓ | ✓ | ✓ (same fog chunk cost) |
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
mission intro. High / medium re-capture after the camera has moved 25 / 40 m; low never re-captures on movement.
