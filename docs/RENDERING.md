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
| Shadows | One shadow caster per scene (moon / sun directional following Kai, 44–60 m frustum, or one spot); 4096² PCF-soft on high, 1024² PCF on medium, **off on low** | Characters cast; crowd (`Walker`) does not receive. No contact shadows or AO anywhere. |
| Lights | 7–14 unshadowed point/spot lights per scene + hemisphere | Neon only lights through emissive + bloom; lamps light the ground with additive "puddle glow" planes. |
| Materials | Canvas-drawn albedo (+ a roughness map for asphalt) on `MeshStandardMaterial`; no normal maps, no AO maps in missions 1-4 | `realism.js` (3.4k lines: GPU-baked PBR sets, interior-mapped facades, sky IBL, terrain, trees, grass, water, height fog) is **not used by missions 1-4 at all**; only the new missions 5+ import it. |
| Buildings (m1) | Plain `BoxGeometry` towers with a 256×512 canvas facade (6 seeds) and an emissive window texture, stretched by `repeat` | No relief, cornices, mullions, roofs or rooftop plant; every tower reads as a lit cardboard box. |
| Characters | Realistic heads/bodies (src/human, other workflow) lit by the scene's lights only | No dialogue key/fill/rim light, no depth-of-field separation in close-ups. |
| Adaptive | Phones scale resolution 0.6–1.0 to hold ~30 fps and may drop one tier | Disabled under webdriver, so captures are at fixed resolution. |

## 2. Reference views

Twelve fixed camera poses (three per finished mission) are defined in `tools/render/views.json` and captured by
`tools/render/refviews.mjs`. **Never edit a baselined view; add a new one instead**, so every stage compares the
same frame. Missions are addressed by the 0-based `?m=` index (m1 = 0 … m4 = 3).

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
| `m3c_future_2196` | 3 | the same chamber in the overgrown, ruined 2196 era |
| `m4a_establishing` | 4 Ancient valley | elevated establishing shot of the settlement at sunset |
| `m4b_village_people` | 4 | eye-level village street with settlers |
| `m4c_dialogue_niko` | 4 | close dialogue with Niko |

How a view is taken (`tools/render/refhelper.js`, evaluated in the page): the mission loads at quarter size until its
ready condition (SwiftShader is fill-rate bound, so the intro plays much faster), the viewport is set to the capture
size, then the helper **takes over the frame loop**: the game is paused and the engine's per-frame render is held,
the camera is fixed through `game.cine`, the world is stepped 6 × 1/30 s around it, time stops, and the frame is
drawn and read back from the canvas (HUD / dialogue DOM hidden). `REF.measure` then times 4 full frames and 2
scene-pass-only frames, each fenced with `readPixels` and preceded by a yield to the event loop, and records
`renderer.info` counts (calls / triangles include shadow maps and post), light, material and program counts.

Commands (from the repo root; the static server must be up on :8765, one browser at a time):

```sh
# one mission and tier -> <out>/<view>.png + <out>/<mission>_<gfx>[_mobile].json
node tools/render/refviews.mjs m1 high   <out>/high        1280 720
node tools/render/refviews.mjs m1 low    <out>/low_mobile  844 390 --mobile
#   options: --views=m1a_establishing,m1c_dialogue_hale  --resume (skip views already in the json)  --noshot
#            --base=http://localhost:8765/  --ready-timeout=ms
# all twelve views, both tiers, with retries when the shared container OOM-kills a renderer:
bash <scratch>/render/audit/runall.sh "m1 high 1280 720;m2 high 1280 720;m3 high 1280 720;m4 high 1280 720;m1 low 844 390 --mobile;m2 low 844 390 --mobile;m3 low 844 390 --mobile;m4 low 844 390 --mobile"
# markdown table of the measurements, optionally with deltas against the audit baseline
node tools/render/report.mjs <out>/high <scratch>/render/audit/high
# the same views through tools/drive.mjs (writes refviews_m1.json … m4.json steps files)
node tools/render/refviews.mjs --emit-steps=<dir>
node tools/drive.mjs "http://localhost:8765/index.html?m=0&dtcap=0.25&gfx=high&auto" <dir>/refviews_m1.json 1280 720 --outdir=<out>
```

`<scratch>` is `/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad`; the stage-0
images and numbers are in `<scratch>/render/audit/{high,low_mobile}/`, and later stages write
`<scratch>/render/<stage>/{high,low_mobile}/` so images can be compared side by side with the same file names.
The drive.mjs route loads at full size, so it needs generous timeouts but yields the same frames.

Measuring notes: the container renders with CPU SwiftShader shared with other agents' test browsers (load average
4–12 on 4 cores during the audit), so absolute frame times are only good for *relative* comparisons of the same view
on the same run conditions; use the minimum of the 4 samples (`frame min ms`), re-run both before and after in the
same session when a change is close to the noise, and judge phone cost primarily by calls, triangles, passes, render
target sizes and texture taps per pixel. A renderer that is OOM-killed (the memory cgroup is shared) is retried by
`runall.sh`; `--resume` keeps the views already measured.

## 3. Baseline (stage 0)

(Filled from `<scratch>/render/audit/` below.)
