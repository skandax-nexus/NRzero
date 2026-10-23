# Motion, walking style and physics

The owner's request: "character look and walking style, physics in game must be accurate not in difficult way".
This file holds the audit of today's walking style and physics (Kai, NPCs, crowds), what the missions depend on,
the traversal reach envelope that any new system must keep, and the plan. Binding references:
docs/ART_SPEC.md section 6 (physics and movement) and section 5 (mobile), docs/COSTUMES.md (runtime contract).
The motion capture in `assets/models/anims.glb` is the owner's and is never overwritten; new clips go in new files.

## Audit

### How it was measured

All numbers come from the live game code, driven frame by frame with a fixed dt. Nothing in the game was changed.

- `tools/feel/feelhelper.js` runs in the game page (title screen loaded, cast ready). It holds the game loop, builds a
  test course with the real `Collision` class, and feeds input through `Input`'s own key and stick state:
  - a gridded floor (1 m lines)
  - stairs with 0.18 m risers and 0.30 m treads, and m13-style 0.40 m risers
  - a micro-stepped 18-degree ramp
  - a 3 m and a 1 m platform
  - a long wall, an inside corner and a 2.2 m ceiling
  - a 5 cm thin wall and a box lift
  - NPCs (`game.actor` and `props.Walker`)
- `tools/feel/scenarios.mjs` has about 100 scenarios: locomotion at 30 fps with renders, and physics at 15, 30, 60
  and 144 fps without renders.
- `tools/feel/audit.mjs` drives the scenarios in headless Chromium:
  `node tools/feel/audit.mjs --out=<dir> [--only=a,b] [--query=phys=classic]`.
- `tools/feel/analyze.mjs <dir>` turns the samples into `<dir>/metrics.json`.
- `tools/feel/sheet.py <dir> <scenario> <view>` makes labelled contact sheets. Add `--mp4` to make a clip instead.
- `tools/feel/touch.mjs --out=<dir>` drives the real touch controls at 844x390 with `--mobile` and CDP touch events.

**Foot metrics.** A foot point is planted while it is within 2.5 cm of the collision ground under it. It leaves
contact above 4 cm, and a contact must last at least 3 frames. The heel point is the `foot` bone and the ball point
is the `toe` bone, each minus its lowest height during a steady gait on flat ground. The idle pose cannot serve as
the reference: in idle the ankle stands 1.7 to 4.3 cm higher than at a walking foot plant.
- **Slide** is the horizontal travel of the planted point during one contact, in cm per step.
- **Pops** are the peak bone angular velocity in world space.

**Where the output is.** Below, `$A` stands for
`/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/feel/audit/base`. It holds:
- the per-frame samples, as `<scenario>.json`
- `metrics.json`
- the frames, as `<scenario>/<view>_<frame>.jpg`
- the contact sheets, as `<scenario>_<view>_sheet.jpg`
- the clips, as `<scenario>_side.mp4`

Touch results are in `/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/feel/touch/`.

**Conditions.** The machine was shared, with a load average of about 30. CPU step costs are therefore indicative only.
SwiftShader render times say nothing about phones, so the render baseline for phones has to be taken with
`tools/render` before and after each change, on the same views.

**Kai's speeds as built today:**

| Input | Speed |
|---|---|
| Keyboard | 3.1 m/s |
| Sprint | 5.6 m/s |
| Crouch | 1.7 m/s |
| Touch stick | 0.93 to 3.1 m/s |

**Clip speeds after retargeting onto Kai** (hip ratio 1.115):

| Clip | Speed |
|---|---|
| walk_slow | 1.02 m/s |
| walk | 1.31 m/s |
| jog | 3.23 m/s |
| run | 4.76 m/s |
| sprint | 7.09 m/s |
| crouch | 0.94 m/s |

### Locomotion (Kai)

| Item | Today | Real world / spec | Evidence |
|---|---|---|---|
| Keyboard "walk" | 3.1 m/s and plays the **jog** clip at timeScale 0.94. Kai never walks on a keyboard. | A walk is 1.2 to 1.5 m/s and a jog 2.5 to 3.5 m/s | `$A/walk_start_stop_side_sheet.jpg`, `$A/walk_start_stop_side.mp4` |
| Steady jog at 3.1 m/s | Foot slide 5.3 cm per step (median), p90 7.5 cm. Stride 2.53 m, cadence 145 to 163 spm. Head bob 11.8 cm, pelvis bob 10.9 cm. Arm swing (hand fore-aft) L 22.9 cm, R 14.7 cm. | Slide under 2 cm. A jog runs at 155 to 170 spm with a 2.0 to 2.5 m stride and 6 to 9 cm of bob. Arms are roughly symmetric (within 10 %). | `metrics.json` walk_start_stop.steady |
| Stick 20 % (1.0 m/s) | walk_slow at timeScale 0.96. Slide 4.2 cm per step, stride 1.48 m, about 100 spm. Arm swing L 35 cm, R 22 cm. Head bob 3.8 cm. | A walk is 100 to 120 spm with 4 to 5 cm of bob | `$A/stick_slow_side_sheet.jpg` |
| Stick 50 % (2.08 m/s) | The **walk** clip plays at timeScale **1.56**: a speeded-up walk at 175 spm (gait-selection hysteresis keeps it there). Slide 5.7 cm median, 25 cm at the worst point. | A brisk walk or slow jog: at 2 m/s people break into a jog | `$A/stick_mid_side_sheet.jpg` |
| Sprint (5.6 m/s) | Plays the **run** clip at timeScale 1.15. The sprint clip is never used by the player. Stride 3.2 m at about 210 spm, slide 4.0 cm median, p90 18 cm. Trunk lean 15 degrees. Arm swing L 32 cm, R 47 cm. | A run is 170 to 190 spm with a 2.8 to 3.8 m stride | `$A/sprint_side.mp4` |
| Start (0 to 3.1 m/s) | 10 % to 90 % speed in **0.13 s**, so idle snaps into a full jog stride. The worst foot slide in the first second is **29 cm** (keyboard), 34 cm (stick 20 %), 44 cm (stick 50 %) and **77 cm** (sprint). | Reaching jog speed takes about 0.5 to 0.8 s over 2 to 3 steps, with feet planted | sheets above |
| Stop | 0.23 s and 0.10 m from 3.1 m/s, a deceleration of about 13 m/s² (1.4 g). The jog, walk, walk_slow and idle crossfades run while the body stands still, so the feet skate **33 cm** (jog) and **57 cm** (sprint). A frozen mid-stride pose holds for about 0.3 s before idle. | Stopping from a jog takes about 0.5 s and 0.7 to 1 m over 1 to 2 steps | `$A/walk_stop_side_sheet.jpg` |
| Turn 90 degrees (D after W) | Peak yaw rate 1080 deg/s, 90 % turned in 0.13 s, speed dips to 2.2 m/s. Slide 6.7 cm. No lean. | Turning on an arc takes 0.3 to 0.5 s and the body leans into the turn | `$A/turn90_chase_sheet.jpg` |
| Turn 180 degrees (S after W) | 2160 deg/s: Kai spins in place in 0.13 s. Speed dips to 0.54 m/s, the gait flips jog to walk_slow to walk to jog in 3 frames, and the feet slide 16 cm. Bone spike 39 rad/s. | A plant-and-pivot takes about 0.4 to 0.6 s | `$A/turn180_side_sheet.jpg` |
| Circle (1 rad/s at 3.1 m/s) | Steady jog, slide 5.6 cm median. **No banking**: the root stays vertical. | A lean of atan(v·ω/g) ≈ 17 degrees | `$A/circle_chase_sheet.jpg` |
| Crouch walk (1.7 m/s) | The crouch clip at timeScale **1.78** gives a 194 spm scuttle. Slide 1.7 cm median, arm swing 3.5 to 4 cm, trunk lean 26 degrees. | A sneak is about 0.8 to 1.2 m/s at 90 to 110 spm | `$A/crouch_walk_side_sheet.jpg` |
| Idle | The mocap weight shift sways the head 24 cm sideways over a 2.3 s loop. The feet drift 2.4 cm (L) and 8.1 cm (R). No pop (peak 2.6 rad/s). | Natural sway, but the feet should stay locked | `$A/idle_side_sheet.jpg` |
| Transition pops | Within a gait the p95 is 12 rad/s (jog) and 23 rad/s (run). Clip switches peak at 20 to 25 rad/s on toe and hand bones, and the 180-degree turn at 39 rad/s. Clip crossfades last 0.25 to 0.4 s. | Peaks should stay at the within-gait p95 | `metrics.json` *.pops |
| Jump in place | The **idle** clip plays in the air. There is no takeoff, tuck or fall pose, and the landing has no knee bend (pelvis dip 0.1 cm). The feet hang at 9.9 cm in the idle stance. | Crouch, extend, tuck, then absorb the landing (5 to 15 cm) | `$A/jump_in_place_side.mp4` |
| Sprint jump | The **run** cycle keeps playing in the air (20 frames). The landing hits at 4.1 m/s with a 2.4 cm dip. | | `$A/jump_sprint_side_sheet.jpg`, `.mp4` |
| Drop from 3 m | Kai jogs through the air and lands at 6.7 m/s with a 6.4 cm dip, then stops dead. No landing reaction. | Absorb with knees and hips, then a recovery step | `$A/drop_3m_side_sheet.jpg`, `.mp4` |
| Stairs (0.18 m risers) at 3.1 m/s | The capsule pops up **18 cm in one frame** on each step. Going down, Kai is **airborne for 27 frames**: each step is a small fall. The flat-ground jog cycle runs on the stairs: the lower foot floats a median 2.8 cm, p90 16 cm and max 25 cm above its tread, and the toes go up to **17 cm** into the risers. Speed on the stairs stays 3.1 m/s. | Feet planted on the treads and pelvis lowered, with no clipping | `$A/stairs_side_sheet.jpg`, `$A/stairs_side.mp4` |
| Stairs at stick 35 % | Float p90 9.6 cm and max 21 cm. Penetration 19 cm. | | `$A/stairs_slow_side_sheet.jpg` |
| 0.40 m risers (m13) | 40 cm capsule pops. Penetration **33 cm**. | | `$A/risers40_side_sheet.jpg` |
| Ramp (micro-steps of 0.05 m) | The capsule rises smoothly (5 cm a frame) and reads well. The stance is not adapted to the slope, and the platform edge at the end drops as a fall. | | `$A/ramp_side_sheet.jpg` |
| Walking into a wall at 80 degrees | Real speed **0.44 m/s**, but the velocity fed to the animation is 2.55 m/s: Kai **jogs on the spot against the wall** (a treadmill). | Slow down and brace | `$A/wall_80_chase_sheet.jpg` |
| Pressed into a corner | Real speed 0, but the animation still gets 2.86 m/s and jogs in place. | | `$A/corner_chase_sheet.jpg` |

### NPCs and crowds

| Item | Today | Evidence |
|---|---|---|
| Walker crowd (props.js, speeds 0.9 to 1.5 m/s) | walk_slow or walk at timeScale 0.97 to 1.31. Slide 4.5 to 5.6 cm per step (median), p90 5 to 21 cm: steady walking is acceptable. | `$A/crowd_wide_sheet.jpg` |
| Lane ends | Every Walker turns **180 degrees in one frame**, with a bone spike of **94 rad/s**: the worst pop in the game. | metrics crowd[].maxTurnPerFrameDeg |
| Per-person gait | Everyone shares the same five mocap gaits. A per-person `pace` (0.93 to 1.07) applies only to non-locomotion clips. Height scales stride through the hip ratio, but sex, age, mood and children have no gait of their own. | cast3d.js `makePerson` |
| Mission NPCs | Missions move `root.position` and `rotation.y` themselves and set `.speed`. Turning is `faceTowards(rate)` or direct. No accel, turnRate or grounded data reaches the animation. | grep `.speed =` in 22 files |
| NPCs and Kai, NPCs and NPCs | No collision. Kai walks **straight through** Hale (minimum distance 0 m), and Walkers overlap each other. | `$A/npc_bump_side_sheet.jpg` |
| Secondary motion | **None.** The cast rig has 21 bones (hips, spine, chest, neck, head, clavicles, arms, hands, legs, feet, toes): no finger, face, hair, hood, coat-tail, strap or sash bones. Coats, hair, the harness and sashes move rigidly with the body. | `assets/models/cast.glb` skins |

### Physics against the real world and ART_SPEC section 6

| Item | 15 fps | 30 fps | 60 fps | 144 fps | Real / spec |
|---|---|---|---|---|---|
| Gravity (m/s²) | 13.0 | 13.0 | 13.0 | 13.0 | 9.81 |
| Jump takeoff speed | 4.6 | 4.6 | 4.6 | 4.6 | |
| Jump apex | 0.78 m | 0.78 m | 0.78 m | 0.80 m | Standing jump 0.4 to 0.5 m (athlete 0.6 m) |
| Air time (flat) | 0.73 s | 0.70 s | 0.68 s | 0.69 s | about 0.6 s |
| Jump distance at walk speed (3.1 m/s) | 2.27 m | 2.17 m | 2.12 m | 2.15 m | |
| Jump distance at sprint (5.6 m/s) | 4.11 m | 3.92 m | 3.83 m | 3.89 m | Untrained long jump 3 to 4.5 m |
| 0 to 90 % speed (keyboard and sprint) | 0.20 s | 0.17 s | 0.15 s | 0.16 s | 0.5 to 0.8 s |
| Stopping distance and time from 3.1 m/s | 0.17 m, 0.33 s | 0.17 m, 0.33 s | 0.17 m, 0.33 s | 0.20 m, 0.35 s | 0.7 to 1 m |
| Stopping distance and time from 5.6 m/s | 0.31 m, 0.40 s | 0.31 m, 0.37 s | 0.31 m, 0.37 s | 0.36 m, 0.39 s | 1.5 to 2.5 m |
| Time airborne walking down 10 steps | 0.87 s | 0.90 s | 0.88 s | 0.94 s | Grounded all the way |
| Tunnelling: sprint into a 5 cm wall, 30 m fall onto a 5 cm slab | none | none | none | none | none ✓ |
| Corner jitter | 0 cm | 0 cm | 0 cm | 0 cm | none ✓ |

- **Sub-stepping.** `n = ceil(dt / 0.02)` equal substeps, so 50 to 144 Hz, with no render interpolation. Results
  depend on frame rate (jump distance varies by 7 %). The spec asks for a fixed timestep (for example 120 Hz) with
  interpolation. ✗
- **Step-up.** Boxes up to **0.42 m** are climbed instantly (a 1-frame pop of 20, 30, 40 or 42 cm). 0.43 m blocks.
  The spec asks for smooth step-up and step-down. ✗
- **Jump-climb.** Kai can mount a ledge up to **1.15 m** from a walking or sprinting jump. 1.20 m fails, because
  apex 0.78 m + step 0.42 m is 1.20 m.
- **Ledge tolerance.** Kai stays grounded until his centre is 0.16 m past the edge (radius × 0.5). He falls at
  0.17 to 0.19 m of overhang.
- **Coyote time and jump buffering.** Neither exists: a jump pressed 3 frames after leaving a ledge, or 1 to 2
  frames before landing, is lost. ✗
- **Ground snapping.** Only within 5 cm. Walking down stairs and lifts is a fall. ✗
- **Wall sliding.** Kai keeps 71 % of his input speed at 30 degrees and 14 % at 80 degrees. No jitter or sticking ✓.
  But the velocity is never projected onto the wall, so it stays at full speed into it, and the animation shows that
  as a treadmill. ✗
- **Ceiling.** Jumping under a 2.2 m ceiling **teleports Kai 2.32 m sideways in one frame**: the horizontal push-out
  treats the ceiling as a wall once the head enters it. ✗ (`$A/ceiling_jump_side_sheet.jpg`)
- **Lifts and moving platforms.** A box lift rising at 1.6 m/s carries Kai (grounded 50 of 50 frames). One
  descending at 2.4 m/s does not: Kai is grounded on only **3 of 29 frames** and flickers between falling and
  landing (8 toggles). The missions' own lifts (m2, m3, m9, m18) and the m07 orrery ring write `player.pos` every
  frame instead, and they work.
- **NPC collisions.** None: Kai passes through people. The spec asks for soft collision with NPCs. ✗
- **Camera.** Backing into a wall puts the camera **27 cm inside the wall** for 54 of 90 frames, at 0.64 m from the
  pivot: the frame fills with Kai's shoulder (`$A/cam_wall_chase_sheet.jpg`). The ray only tests `camBlockers`
  meshes, with a 0.6 m minimum distance and no sphere radius. The camera never snaps: its peak speed is 7.5 m/s,
  smoothed at a rate of 14/s. ✗
- **Fall damage.** None in the core: a 30 m fall lands safely at the 27.7 m/s velocity cap. m18 alone fails falls
  over 7.2 m (8 m in one zone) with `fallRule` and a checkpoint.
- **CPU cost of one game step** (Kai, mixer and collision, without rendering): about 0.02 to 0.3 ms (machine under
  load). 12 Walkers add about 0.07 ms. The animation CPU budget has room for foot IK and a few springs per nearby
  person. GPU skinning and shading dominate on phones, so measure with `tools/render` on low and medium.

### Touch feel (844x390, `--mobile`, mission 1)

The data is in `touch/touch.json`, with screenshots `touch/touch_hud.png` and `touch/touch_after.png`.

**Stick.** The radius is 59 px (15 % of the short side). The dead zone is the inner 12 %, about 7 px.

| Thumb travel | Stick magnitude | Result |
|---|---|---|
| 8 px | 0.018 | Kai already walks at the 0.93 m/s floor (30 % of 3.1) |
| 20 px | 0.25 | |
| 40 px | 0.63 | 2.6 m/s |
| 50 px | 0.83 | 3.1 m/s |
| 54 px | 0.904 | **Sprint** (5.6 m/s) |

- Full walk and sprint are only about **4 px apart**: a thumb resting near the rim flickers between 3.1 and 5.6 m/s.
- There is no gradual band between walking and sprinting.

**Camera drag.** 26.7 degrees per 100 px of yaw (225 degrees across the long side) and 12.8 degrees per 60 px of
pitch. A 180-degree turn needs **675 px** of drag, more than the about 490 px look area on the right, so it takes two
swipes.

**Buttons.**

| Button | Size | Centre |
|---|---|---|
| JUMP | 66 px | (791, 339) |
| CROUCH | 56 px | (716, 348) |
| Interact | 71 px | (785, 251) |

- JUMP sits in the natural thumb arc. A tap made Kai rise 0.61 m.
- CROUCH is only **14 px** away (edge to edge). A mis-tap toggles crouch, and a crouched Kai cannot jump.
- With no jump buffer, a JUMP tap that lands a frame before touchdown is lost. That happens more often on touch.

## Mission dependencies

These are the inventory from `src/missions/*`, `src/world/*` and `src/systems/*` (missions 1 to 18 checked; 19 to 23 are
being built now). Every item here must keep working, bit for bit, under the new physics and motion.

### Player
- `player.pos` is **the same Vector3 as `player.char.root.position`**.
  - Missions write either one, every frame:
    - lifts in m2 (`pos.y` at 2.4 m/s down), m3 (1.6 m/s up), m9 (`pl.pos.y` and `pl.char.root.position.y`) and m18 (tween)
    - Echo Step dashes (`echostep.js`)
    - the m07 orrery ring carry (`alignment.js` rotates `pos` and `yaw`)
    - the m14 zone push-out, the m15 throw-back, and the m18 gust and sweep (`pos.x +=`)
  - Render interpolation must therefore not separate `pos` from `root.position`. Interpolate a child offset (for
    example `char.person.root`), and treat any outside write as a teleport, with no smoothing or carry.
- `player.vel` is zeroed by missions after their writes (`vel.set(0, 0, 0)`: m2, m3, m15, m18, `echostep.js`).
- `player.grounded` is read and **written**:
  - m05 sets it after its own terrain snap
  - `echostep.js` sets it on landing
  - m07 records grounded positions for displacement
  - m18 `fallRule` measures falls between grounded frames, and `rewindRule` samples grounded positions
  - Coyote time must therefore not change what `grounded` reports: keep `grounded` = touching the ground, and keep
    the coyote timer apart from it.
- `player.yaw` is written by `alignment.js` and `combat.js`. `player.crouching` is read by stealth (`loops.js`,
  `props.js` Drone, `combat.js`, m12) and written by m10 and m18. `player.place()` and `checkpoint` / `restoreCheckpoint`
  are used everywhere. `update(dt, allowMove)`, `updateCamera` and `camBlockers` (`game.blocker`) stay as they are.
- `STICK_SPRINT` is exported from `player.js` and imported by `touch.js`.

### Collision
- Missions iterate **`collision.boxes` directly**:
  - m07, m10, m12, m13, m15, m16, m17 and m18 read `b.min`, `b.max`, `b.enabled`, `b.states` and `b.walkOnly` for
    era-switch solid checks
  - m13 filters by `states`
  - The box object shape must stay: `min` and `max` are Vector3, plus `states`, `enabled`, `tag` and `walkOnly`.
- Missions **mutate boxes every frame**:
  - m05 moves a `walkOnly` ground box under Kai to follow its terrain height field
  - `alignment.js` (m07) moves its ring segments
  - m3 moves `liftCol.min.y` and `max.y`
  - `.enabled` toggles in 28 files
  - A platform-carry feature must not carry these a second time (`alignment.js` already carries), so make carry
    opt-in per box (`opts.carry`).
- `collision.resolve(pos, vel, radius, height, state, dt, prevY)` is called for non-player bodies: the m2 Warden
  (radius 0.7, height 2.6), m10 Sera, and `combat.js` enemies. Its return value `{ grounded, groundY }` is used only
  by `player.js` today. Keep the signature and the result (new fields may be added).
- `collision.blocked(a, b, y, state)` is used for sight lines in m07, m12, m17, `props.js`, `combat.js`,
  `echostep.js` and `loops.js`.
- `add`, `addBox` and `walkOnly` / `states` / `tag` options are used widely. `fromObject`, `isActive` and `clear` are
  used by core code only.
- **New:** `collision.groundHeight(x, z, yHint, state)` (ground y or null) must also respect `walkOnly` boxes moved
  by missions. m05's terrain only exists as that moving box under Kai, so NPC grounding there must stay the
  mission's own (m05 snaps Niko with its own `groundAt`).

### Characters
Missions use these members of the Character API:
- `speed` (set every frame by 22 files)
- `crouch` (as a 0 to 1 number: m10 eases Sera's)
- `pose`: `work` (35 uses), `look` (26), `sad` (22), `sit` (15), `fall` (8), `reach` (3, procedural), `nod` (2)
- `talk`, `lookTarget`, `frozen`
- `faceTowards(x, z, dt, rate)`
- `root.position` and `root.rotation.y` (written directly)
- `wristBoost`, `setGhost`, `head`
- `p` and `constructor` (Echo Step clones Kai's look)

`umbrellaPose`, `setGadget` and `showProp` are not used by missions; they are used by core and `cast.js`.

NPC movement is always scripted, through the mission's own `walkTo` helpers (m08, m12) or by advancing
`root.position` and setting `speed`:
- m05 Niko follows Kai at 1.8, 3.1 or 4.6 m/s
- m07 Niko climbs the 17 steps with `p.y` set from z
- `props.js` Walkers (m1, m4, m05, m06, m11) do the same

Grounding and IK must therefore adapt the feet to the root the mission sets: they must not move the root. NPC
collision must not push scripted NPCs off their paths. It may only push Kai, or an idle crowd extra.

### Timed sections and chases (no traversal may get slower)
| Mission | Section |
|---|---|
| m2 | Warden chase: it lerps to 2.7 m/s and catches within 1.4 m. Kai's walk speed of 3.1 m/s escapes. |
| m16 | The unmaking front runs at 4.2 m/s after a 9.5 s wait. Only a sprint (5.6 m/s) outruns it. |
| m17 | Echo windows of 40 and 50 s, and Stacks layouts every 16 s. |
| m18 | Surges every 34 s (climb onto cars, the lorry or the bus through interactions), gusts that push Kai 0.6 to 1.3 m/s, storm cells that throw Kai back, and `fallRule` 7.2 m. |
| m15 | Loop tears of 80 to 90 s, a corridor tear every 7 s, and a crowd surge of 20 s. |
| m9 and m13 | Nine-minute loops. |
| m14 | A power cell that arcs every few seconds. |
| combat.js | Enemies patrol at 1.3 m/s and run at 3.2 m/s. |

### Traversal content
- **Stairs.** The 0.18 m and 0.32 m stairs of m07 (17 steps). The m9 tower stair: 24 steps of 0.38 m tread. The m13
  plinth stair: **0.40 m risers**. m15 has rubble steps up to a sill at 4.0 m. `realism.js` terrain steps by 0.3 m.
- **Climbs.** Car bonnets at 0.82 and 1.0 m, roofs at 1.42 and 2.15 m, the lorry and the bus in m18. The van roof is
  1.15 m above its bonnet: exactly today's jump-climb limit. Ladders and climbs in m18 are interaction tweens.
- **Gaps.** All are Echo Step crossings: m10 gantry (7.8 m between endpoints), m12 catwalk (7.2 m) and shutter. The
  m07 terrace gap is "five metres, too far to jump". Running jumps must stay **below about 4.6 m**, or these
  authored crossings could be skipped.
- **Crouch sections.** Stealth in m2, m10, m12 and m13 shortens sight range to 60 to 62 %. No crouch-only passages
  were found: a jammed shutter in m12 is too low to crawl under, by design.
- **Kill planes.** `killY` is set in 15 missions. `game.fail` is used in 11.

## Reach envelope (today's values = the minimums)

Any new physics must meet or beat every row on every frame rate, and also stay under the upper bounds.

| Quantity | Today | Minimum to keep | Upper bound |
|---|---|---|---|
| Jump apex | 0.78 m (0.80 at 144 fps; 0.81 analytic) | **0.81 m** | none |
| Air time on flat ground | 0.68 to 0.73 s | 0.73 s | |
| Jump distance at walk speed (takeoff to landing, same level) | 2.12 to 2.27 m | **2.27 m** | |
| Jump distance at sprint | 3.83 to 4.11 m | **4.11 m** | 4.6 m (Echo Step gaps: m07 5 m, m10, m12) |
| Step-up without jumping | 0.42 m | **0.42 m** (0.40 m risers in m13) | |
| Ledge you can jump-climb (walk or sprint) | 1.15 m (1.20 fails) | **1.15 m** (m18 van roof from its bonnet) | |
| Ledge tolerance (grounded overhang) | 0.16 m (falls at 0.17 to 0.19 m) | **0.16 m** | |
| Speeds (crouch / keyboard / sprint / stick floor) | 1.7 / 3.1 / 5.6 / 0.93 m/s | top speeds 3.1 and 5.6 m/s (m2 Warden 2.7 m/s, m16 front 4.2 m/s) | |
| Time to top speed | 0.15 to 0.20 s | no more than 0.35 s to 90 % (chases, surges) | |
| Fall damage | none (m18 `fallRule` 7.2 m is mission-owned) | none in the core | |

## Plan

Everything below ships behind run-time switches. `?phys=classic` keeps today's `Player` and `Collision`, and
`?motion=classic` keeps today's `Character.update3d` and `makePerson.move` (`?look=classic` belongs to the look work).
The next steps re-run `tools/feel/audit.mjs` with and without the switch, and compare against `$A/metrics.json`.

Interface between physics and motion, set every frame on the Character:
- `speed`: the **real** horizontal displacement speed, not the input target
- `vel`, `accel`, `turnRate`, `grounded`, `airTime`
- `landing`: the impact speed on the landing frame

`collision.groundHeight(x, z, yHint, state)` serves foot IK and NPC grounding. For NPCs, the Character derives any
missing field from its own root motion.

### Physics and controls (ordered by impact)
1. **Velocity that tells the truth.**
   - After push-out, remove the velocity component into the contact normal: wall sliding keeps the along-wall
     component.
   - Report the displacement speed to the animation. That ends jogging on the spot into walls and corners (0.44 and
     0 m/s real against 2.55 and 2.86 m/s animated).
   - Fix the **ceiling teleport**: vertical overlap from above stops upward velocity and never pushes Kai sideways.
2. **Fixed 120 Hz simulation with interpolation.**
   - Accumulator, at most 8 steps per frame, `dtcap` respected. Interpolate a visual child, never `pos`.
   - The result is the same jump and stop at 15 to 144 fps. Tune it to the top of today's spread: walk jump at least
     2.27 m, sprint jump at least 4.11 m.
3. **Grounding.**
   - Ground snapping down to 0.45 m while grounded, so stairs, ramps and descending lifts no longer register as
     falls (today 0.9 s airborne on 10 steps, and 3 of 29 frames grounded on a lift going down).
   - Step-up stays instant for the capsule, so reach stays the same (allow 0.45 m). The *visual* root eases over
     about 0.1 s (no 18 to 42 cm pops on screen).
   - Add `groundHeight()`.
4. **Forgiveness.** None of these changes the reach envelope downward.
   - Coyote time 0.15 s and a jump buffer 0.15 s (both keep `grounded` honest).
   - Ledge tolerance kept at 0.16 m or more.
   - A gentle edge brake: at speeds under 1.5 m/s, Kai stops at drops over 1.2 m unless the stick is still held for
     0.3 s. It never acts while sprinting, during missions' scripted moves, or where a mission wants a drop.
   - A step-assist that lets a jump at a ledge within 0.15 m of the reach climb it.
5. **Camera spring arm.**
   - A sphere cast (radius 0.25) against `camBlockers` *and* the collision boxes.
   - The shoulder offset slides to the centre when cramped. Kai fades out when the camera is under 0.7 m.
   - The arm pulls in fast and eases out slowly, so the camera is never inside walls (today 54 of 90 frames, 27 cm
     deep).
6. **Soft NPC collision.**
   - Kinematic capsules (radius 0.3) for actors and Walkers near Kai.
   - Kai is pushed out softly and slides around people. The spring (stiffness × overlap) caps at 1 m/s, so there are
     no hard stops.
   - Scripted NPCs are never moved. Idle extras may sidestep.
   - Off during `cine` and while `game.control` is false.
7. **Acceleration, braking and turning that read as human, without losing responsiveness.**
   - Ground acceleration about 12 m/s²: 90 % in 0.3 s at 3.1 m/s and 0.35 s to sprint.
   - Braking about 12 m/s²: from 3.1 m/s, 0.4 m in 0.3 s.
   - Turning rotates the velocity vector (no speed dip to 0.5 m/s in reversals).
   - The facing rate is capped at about 720 deg/s, with a quick-turn of 0.3 s or less for reversals.
   - Air control as today.
8. **Gravity.**
   - Option A (recommended): real g 9.81 m/s² with takeoff 3.99 m/s, giving apex 0.81 m and air time 0.81 s. Jump
     distances become 2.52 m (walk) and 4.56 m (sprint): more generous than today and still under the 4.6 m bound.
     Falls take real time: a 3 m drop takes 0.78 s instead of 0.68 s.
   - Option B: keep 13 m/s² rising, 15 m/s² falling.
   - Pick by feel in A/B. Either way the apex stays at 0.81 m or more.
9. **Platforms.**
   - Opt-in `carry` boxes move Kai by their per-step delta.
   - Mission-written `pos` stays authoritative (alignment.js, m2, m3, m9, m18 keep working unchanged).
10. **Touch.**
    - A sprint latch with hysteresis: enter at magnitude 0.92 or more for 0.15 s, leave below 0.75.
    - A smoother walk curve starting at 0.5 m/s.
    - Camera drag at about 33 degrees per 100 px (180 degrees within one swipe), with mild acceleration.
    - Jump buffering covers late taps.
    - Move CROUCH 10 to 14 px further from JUMP.

### Locomotion and secondary motion (ordered by impact)
1. **Starts, stops and turns without skating** (today 29 to 77 cm at starts and 33 to 57 cm at stops).
   - A speed-driven blend space over walk_slow, walk, jog, run and sprint with synchronised normalised phase,
     instead of discrete crossfades (no more walk at timeScale 1.56).
   - Stops that finish on a foot plant.
   - Foot locking (two-bone leg IK) during transitions and idle. Feet drift up to 8 cm in idle today.
   - Target: under 2 cm per step everywhere.
2. **Foot IK and pelvis adjustment on stairs, slopes and edges.**
   - Uses `groundHeight` under heel and ball, and lowers the pelvis to the lower foot.
   - Fixes the 17 to 33 cm toe penetration into risers and the 10 to 25 cm floating.
   - The full version runs for Kai and people within about 10 m on medium and high. Low gets a pelvis-only offset for
     NPCs, and none for LOD crowds.
3. **Air and landing states**, procedural or derived from the existing clips (`crouch` for anticipation and
   absorption, `fall` for the airborne pose), keyframed in new files only if needed:
   - takeoff, rise and tuck, then fall
   - a landing absorption scaled by `landing` impact (5 to 15 cm of pelvis dip, and a recovery step after hard drops)
   - Today the idle or run cycle plays in the air.
4. **Body dynamics.** Lean into turns (atan(v·ω/g), about 17 degrees at 3.1 m/s and 1 rad/s), pitch with
   acceleration and braking, the head leading the turn, and counter-rotation of the shoulders. All of it is layered
   procedurally on the mocap.
5. **Readable gaits.**
   - The keyboard default stays at 3.1 m/s (chases) and is presented as an easy jog.
   - A real walk (1.4 m/s) comes from the stick's lower range and an optional walk toggle.
   - Crouch-walk gets a longer stride: stride scale about 1.3 and timeScale about 1.35 instead of 1.78, at the same
     1.7 m/s.
   - Arm-swing symmetry correction: today jog L 23 cm and R 15 cm; walk_slow L 35 cm and R 22 cm.
6. **Per-character gait** from look and cast data:
   - stride and cadence from leg length, ±5 % cadence
   - arm-swing amplitude, pelvis sway and rotation by build
   - posture by age (forward lean, shorter stride, less swing) and mood (`sad`: slumped and slower)
   - children: higher cadence, shorter stride
   - These are bone offsets layered on the shared clips. Missions keep setting only `speed`.
7. **NPC turning and spacing.** Walkers turn on a short arc over about 0.6 s at lane ends (today 180 degrees in one
   frame, 94 rad/s). NPC accel and turnRate come from root motion. NPCs avoid each other in lanes.
8. **Secondary motion.**
   - Spring bones for the hood roll, harness strap, coat tails and vents, sashes and mantles, and hair clumps.
   - New bones authored in the character generator (Blender) and weighted to those garment parts, keeping the 21
     body bones and their rest orientation (`anims.glb` keeps retargeting).
   - Simulated with damped Verlet springs that collide with the hip and thigh capsules.
   - Kai always gets them, and named NPCs within about 8 m on medium and high. Low tier: Kai only, with fewer chains.
     Crowd LOD: none.
9. **Camera feel.** An optional subtle head-bob mirror (off by default; Comfort Mode). The landing dip is reflected
   in the camera height at 20 % of the pelvis dip.

### Notes for the look step
Faces in the cast builds have no face bones. Talking is a body clip, and there is no blink or lip-sync on the 3D cast
(the procedural head had them). Hands are a single bone with no finger articulation. Both limit "facial life" and
hand realism in close-ups and are worth planning together with the generator work.

### Re-running the audit
```
cd /home/user/NRzero
node tools/feel/audit.mjs --out=<dir>                      # all scenarios (about 25 min under load); --only=a,b for a subset
node tools/feel/audit.mjs --out=<dir> --query=phys=classic  # the same against a switch, for A/B
node tools/feel/analyze.mjs <dir>                           # writes <dir>/metrics.json
python3 tools/feel/sheet.py <dir> stairs side [--mp4]
node tools/feel/touch.mjs --out=<dir>                       # phone touch probe (844x390, mission 1)
```

## Physics & controls

What was built from the physics half of the plan, with before / after numbers from `tools/feel` (base = the audit's
`metrics.json`; new = this build; classic = this build with `?phys=classic`, which must match base). Files:
`src/core/physics.js` (new: the motor and `PHYS`), `src/core/player.js`, `src/core/collision.js`,
`src/core/touch.js` and `src/core/input.js`. The mission-facing API is in docs/MISSION_GUIDE.md "Physics API".

### How it works
- **Fixed step.** `Motor.frame()` runs 120 Hz steps from an accumulator (at most 40 per frame, so `dtcap=0.25`
  still works). The player's `pos` is the simulated feet point. The drawn body, `char.person.root`, gets
  `player.visOffset`: render interpolation between the last two steps plus a smoothed step offset. The camera uses the
  same offset. Because `pos` is still `char.root.position`, a mission that writes `pos` is a teleport. The motor sees
  the change, and there is no smoothing or carry across it.
- **Capsule against boxes.** The capsule is radius 0.32 m, height 1.75 m (1.1 m crouched).
  - Walls push it out, and the velocity into the contact normal is removed. The next step's target is projected
    along the contacts, so pushing into a wall at an angle slides along it, with no jitter.
  - Ceilings only stop upward motion and never push sideways.
  - Step-up is 0.45 m on the ground. Snapping holds the ground over drops up to 0.45 m (stairs, ramps, lifts going
    down). Every vertical snap larger than 3.5 cm is removed from the interpolation and eased back by a critically
    damped spring (about 0.15 s) on the body and, a little slower, on the camera.
  - `Collision.addRamp` adds true slopes, and the original `resolve()` also walks them.
  - Boxes with `carry: true` carry Kai by their per-frame movement.
- **Movement.**
  - Acceleration is capped at 20 m/s², easing into the target speed at a rate of 14/s. Braking is 13 m/s² (rate
    10/s).
  - A reversal of more than 137 degrees plants and pivots.
  - The velocity turns at most min(14, 24 / speed) rad/s, which is 7.7 rad/s at a walk and 4.3 rad/s at a sprint.
    Facing eases at 14/s, up to 12 rad/s.
  - Gravity is 9.81 m/s² and the jump take-off speed is 4.0 m/s. A sprint take-off keeps 91 % of the run speed.
  - Air control steers and slows, but never adds speed beyond the take-off speed.
  - Speeds are the same as before: walk 3.1, sprint 5.6 and crouch 1.7 m/s. Alt walks at 1.5 m/s. There is no
    stamina.
- **Forgiveness.**
  - Coyote time is 0.12 s, but never more than 0.36 m past the edge, or 0.2 m at a sprint. Jump buffering is
    0.15 s. `grounded` stays honest: it is only true when Kai touches the ground.
  - An air step-up of 0.42 m (a jump-climb) works while rising or near the apex. It drops to 0.2 m once Kai falls
    faster than 2.2 m/s, so a long jump no longer "catches" a ledge from 0.42 m below it.
  - Edge brake: see the Physics API.
  - Safe respawn after falling below `killY`.
  - Auto-crouch under ceilings 1.12 m or more above the feet. A crouched jump stands up first if there is headroom.
  - People are soft cylinders (radius 0.26 m). The target velocity slides around them. When someone stands straight
    in the way, Kai steps aside at half speed, on a side he keeps while in contact. After 0.8 s of pushing with no
    progress, he squeezes past.
- **Camera.**
  - The spring arm sphere-casts (radius 0.2 m) against the collision boxes as well as `camBlockers`. It pulls in
    at once and eases back out at a rate of 4/s.
  - The shoulder offset shrinks when a wall is close on that side.
  - People between Kai and the camera: the camera cranes up (up to 1.2 m, easing in at 8/s and out at 2/s, checked
    against ceilings) so the line of sight passes over their heads, and the arm keeps its length. Only someone too
    close behind Kai to look over pulls the arm in front of them, over about 0.1 s, to no closer than 0.7 m.
  - When the arm is shorter than 0.6 m (backed into a wall), Kai's model hides until the arm reaches 0.75 m.
  - Hard landings (over 2 m/s) dip the pivot gently.
  - `Collision.rayCast` allocates nothing, so the camera's two casts per frame stay cheap on phones.
- **Animation interface.** Set on `player.char` every frame: `speed` (the real horizontal speed), `vel`, `accel`,
  `turnRate`, `grounded`, `airTime` and `landing`. `collision.groundHeight(x, z, yHint, state)` serves foot IK and
  NPC grounding.

### Before and after
Physics scenarios at 15, 30, 60 and 144 fps. The ranges cover all four rates; the spread left in the new column
comes from sampling take-off and landing at frame granularity, not from the simulation.

| Quantity | Base (and classic) | New | Envelope |
|---|---|---|---|
| Gravity | 13.0 m/s² | 9.81 m/s² | real |
| Jump apex | 0.78 to 0.80 m | 0.82 m at every rate | ≥ 0.81 m ✓ |
| Air time | 0.68 to 0.73 s | 0.81 to 0.87 s | ≥ 0.73 s ✓ |
| Walk jump distance | 2.12 to 2.27 m | 2.53 to 2.69 m | ≥ 2.27 m ✓ |
| Sprint jump distance | 3.83 to 4.11 m | 4.16 to 4.43 m | ≥ 4.11 m and ≤ 4.6 m ✓ |
| Sprinted gap crossed (60 fps, jump on the last grounded frame) | 4.6 m (not 4.8) | 4.6 m (not 4.8) | same ✓ |
| Sprinted gap crossed with the latest coyote jump | (no coyote time) | 4.8 m (never 5.0) | < 5 m (m07 terrace) ✓ |
| 0 to 90 % speed, walk / sprint | 0.15 to 0.20 s | 0.19 to 0.20 / 0.27 to 0.33 s | ≤ 0.35 s ✓ |
| Stop from walk / sprint | 0.17 m, 0.33 s / 0.31 m, 0.4 s | 0.41 m, 0.43 s / 1.24 m, 0.63 s | (real: 0.7 to 1 m / 1.5 to 2.5 m) |
| Step-up without a jump | 0.42 m | 0.45 m | ≥ 0.42 m ✓ |
| Step-up pop on screen (0.42 m box, 30 fps) | 42 cm in one frame | 14 cm per frame at most (eased over about 0.15 s) | smooth ✓ |
| Stairs 0.18 m: largest drawn rise per frame at 15 / 30 / 60 / 144 fps | 26 / 18 / 18 / 18 cm | 18 / 9 / 4 / 2 cm | smooth ✓ |
| Airborne frames walking down 10 steps | 13 to 136 | 0 | grounded ✓ |
| Jump-climb walk / sprint / standing | 1.15 / 1.15 / 1.15 m | 1.15 / 1.20 / 1.15 m | ≥ 1.15 m ✓ |
| Ledge tolerance, key / stick | 0.19 / 0.17 m | 0.19 / 0.18 m | ≥ 0.16 m ✓ |
| Coyote jump 0.1 s after walking off (30 fps) | lost | jumps ✓ | |
| Jump pressed 2 frames before landing | lost | jumps ✓ | |
| Lift down at 2.4 m/s: grounded frames, toggles | 3 of 29, 8 | 29 of 29, 0 | ✓ |
| Carry platform (3 m along x and back) | Kai left behind | rides along, grounded 150 of 150 | ✓ |
| True ramp (11 degrees, `addRamp`) | n/a | grounded 108 of 108, 0 cm error | ✓ |
| Ceiling jump (2.2 m) | 2.32 m sideways teleport | 0 m; the head stops at 2.2 m | ✓ |
| Walk 30 / 80 degrees into a wall: real speed / speed fed to the animation | 2.21 / 2.55; 0.44 / 2.55 m/s | 2.31 / 2.30; 0.45 / 0.45 m/s | truthful ✓ |
| Corner: speed fed to the animation | 2.86 m/s (jogging on the spot) | 0 (idle) | ✓ |
| Tunnelling (sprint into a 5 cm wall, 30 m fall onto a 5 cm slab) | none | none at 15 to 144 fps | ✓ |
| Walk into a standing NPC | passes through (0 m) | steps around at ≥ 0.33 m/s, never closer than 0.57 m | ✓ |
| Boxed in by three people (0.47 m gaps) | walks through | squeezes out after 0.8 s | never trapped ✓ |
| Camera backed into a wall: frames inside the wall | 54 of 90 (27 cm deep) | 0; Kai hides while the arm is under 0.6 m | ✓ |
| Short push (0.7 s) at a 3 m drop | walks off | stops at the edge | ✓ |
| Held push at a 3 m drop | walks off | goes over after 0.4 s | intentional drops still work |
| Coast after releasing a sprint 0.4 m from a 3 m drop | stops (its braking was near instant) | stops at the edge (1.2 m braking is held by the edge brake) | ✓ |
| Walk at a void edge (kill plane below) | falls, fail and checkpoint | held at the edge for as long as he walks | ✓ |
| Sprint off into the void | fail and checkpoint | fade back to the last safe spot, 0 fails | ✓ |
| CPU per game step, Kai / Kai and 12 walkers (no render, load average about 28) | 0.018 to 0.019 / 0.093 to 0.172 ms | 0.028 to 0.087 / 0.143 to 0.267 ms | under 0.1 ms more; see "Phone budget" |

Clips, contact sheets and data are in
`/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/feel/phys2/`:
- `n1` to `n4`: the new physics, without renders
- `c1`: classic
- `r1` to `r3`: rendered stairs, NPC bump, camera at a wall, drop and ceiling, with `*_sheet.jpg` sheets

### Touch and keyboard
- The stick sprints from a push of 0.90 and keeps sprinting down to 0.78 (hysteresis), so a thumb at the rim no
  longer flickers between 3.1 and 5.6 m/s.
- The walk curve starts at 0.6 m/s at the dead zone and reaches a full 3.1 m/s jog at 72 % of the travel, which
  leaves a 10 px full-walk band before the sprint.
- A slow camera drag turns about 270 degrees across the long side (225 before). A quick swipe turns up to 1.5 times
  as far, so a half turn fits in one swipe of the right half of the screen.
- CROUCH sits 12 to 16 px further from JUMP.
- Jump buffering and coyote time cover late and early taps.
- Keyboard:
  - Shift sprints in any direction (before, only forward).
  - Shift stands a crouched Kai up.
  - Alt walks.
  - A jump while crouched stands up and jumps.
- `?phys=classic` restores the old stick curve, sprint threshold, drag and layout.

### Verification of the final build
- **Audit re-run** (`tools/feel/audit.mjs --norender`, all scenarios, final code): every number in "Before and after"
  reproduces. `?phys=classic` matches the base audit on all 34 shared behaviour metrics. Only the CPU timings
  differ, and those are noise. The airborne frames in the `risers40` and micro-step `ramp` scenarios come from
  walking off the far end of the structure (1.6 m and 1.0 m drops), never from the climb.
- **Camera over people** (changed after the first sheets): someone between Kai and the camera used to pull the arm in
  to 0.7 m, so Kai's back filled the screen for about 0.3 s whenever he passed a person. Now the camera cranes up to
  1.2 m so the sight line clears their head, and the arm keeps its 3.4 m length. In the NPC bump scenario the camera
  rises from 2.16 m to 2.38 m at full arm length. Only a person right beside or just behind Kai still causes a brief
  pull-in.
- **Phone budget** (`tools/feel/cost.mjs`, mission 7 (411 boxes) at 844x390, 120 frames at a fixed 1/30 s, median ms
  per frame, CPU SwiftShader on a machine at load average about 28; an earlier 150-frame run on mission 1 agrees):

  | Tier | Player update, new / classic | Camera, new / classic | Whole game step, new / classic |
  |---|---|---|---|
  | low | 0.1 / 0.1 | 4.6 / 4.7 | 5.0 / 5.1 |
  | medium | 0.1 / 0.1 | 5.2 / 4.6 (p90 11.7 / 15.5) | 5.8 / 5.4 |

  The camera's cost is mostly the three.js raycast against `camBlockers`, which both builds share. The new sphere casts
  against the boxes allocate nothing. Low and medium are not measurably slower.
- Data: `/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/feel/phys3/`. This holds
  `new`, `classic` (audit data and `metrics.json`), `r1` and `r2` (rendered sheets: NPC bump, camera at a wall, the
  3 m drop and the 0.40 m risers), `cost.jsonl`, and `play/` (playthroughs).

## Locomotion & secondary motion

What was built from the locomotion half of the plan. It is the default; `?motion=classic` restores the old crossfade
player and rigid cloth exactly (the classic audit reproduces the base numbers to the digit). Single parts can be
switched off for A/B: `?motion=noik`, `nolock`, `nolean`, `nowarp`, `noprofile`, `nohead`, `noidle`, `nospring`,
`notread` (comma separated, e.g. `?motion=noik,nospring`).

Files:
- `src/human/locomotion.js` (new): the `Motion` class, one per cast person, that drives the animation mixer itself;
  `gaitProfile()`; `MOTION` (switches and `stats`), `motionWorld` (collision, scene, `wind`), `motionView` (camera, tier).
- `src/human/ik.js` (new): two-bone leg IK that keeps the knee's bend plane, world-space bone rotation helpers and fast
  `matrixWorld` reads.
- `src/human/springs.js` (new): spring bones for loose cloth and long hair.
- `src/human/cast3d.js`: loads `anims_extra.glb` and the cast index, analyses each template once, rigs its springs,
  attaches a `Motion` to every person. The classic path is untouched.
- `src/core/character.js`: `updateMotion()` (the umbrella arm and gadgets on top); `update3d()` stays for classic.
- `assets/models/anims_extra.glb` (new, 30 KB): our own clips `jump` and `jump_run` on the same rig as `anims.glb`,
  keyframed by `tools/feel/author_clips.mjs` (joint angles on the idle base pose, eased, 20 fps). `anims.glb` is only
  read. Re-author with `node tools/feel/author_clips.mjs`.

No mission code changed and the Character API is the same: missions keep setting `speed`, `crouch`, `pose`, `talk`,
`lookTarget` and moving `root.position` / `rotation.y`.

### How it works
- **Speed blend space with distance matching.** Every retargeted gait clip is measured once per body
  (`analyseTemplate`): loop length, gait cycles per loop, left heel strike, foot contact curves, planted ankle and ball
  heights and the speed a planted foot really moves back at. All gait clips share one gait phase that advances by
  `ground speed × dt / stride`, so the feet travel as far as the body. walk_slow and walk blend by speed inside the walk
  family, jog, run and sprint inside the run family. The walk-run switch has hysteresis around a Froude-based speed
  (2.1 m/s for Kai, by leg length, a little later for older people), and it is quick when the speed is far past it, so
  a sprint start does not jog through a walk.
- **Human cadence.** The stride is warped (feet placed further from or nearer to the hips, 0.82 to 1.14) toward a
  human cadence for the speed, scaled by the gait profile. On stairs and steep ground the steps get shorter and
  quicker. Crouched, the stride lengthens instead (a sneak, not a scuttle): 157 spm at 1.7 m/s, was 197.
- **Foot locking.** A foot is pinned where it touches down (no blend-in, it is already there). It rolls on the heel,
  then on the ball once the clip lifts the heel, keeps its planted heading, and lets go when the clip lifts heel and
  ball. A foot the body has left behind or turned away from takes a small corrective step (stops, turns on the spot,
  odd stances). A fast low swing is lifted clear of the floor.
- **Foot IK and pelvis.** The ground under heel and toe comes from the collision boxes (ramps through `topAt`). The
  pelvis lowers to the lower foot (at most 0.3 m; deeper, the trailing foot pushes off from its toes), legs are solved
  with two-bone IK that keeps the clip's knee direction, and a foot landing across a step edge slides onto one tread
  (heel past the edge or toe short of it, whichever is nearer). The ground under a plant is frozen, or follows the box
  it stands on (lifts).
- **Air and landing.** In the air the new `jump` clip (standing) and `jump_run` (a stride in the air) are blended by
  ground speed and sampled by vertical speed: take-off, apex tuck, legs reaching for the ground. A step off a ledge
  starts with the legs down. Feet never go through the floor in the air. A landing dips the pelvis by the impact
  (about 2.2 cm per m/s, at most 15 cm) and folds the trunk with it.
- **Body dynamics.** Banking into turns (0.62 × atan(v·ω/g)), pitch with acceleration and braking, the head leading
  turns, breathing that follows exertion. Yaw snaps (a mission facing someone at once, a Walker's 180 at a lane end)
  are eased over about 0.6 s, including snaps a mission makes after the people were updated (caught in the scene's
  `onBeforeRender`, so they never show for a frame).
- **Per-character gait** (`gaitProfile`, from the cast index sex, age, height and the look's build, age and uniform):
  cadence by leg length, stride, arm swing, stoop, uniform bearing, the walk-run speed, a female pelvic rotation and
  side sway with the chest counter-rotating, more glances for a child. Examples: Kai cadence ×0.99; Mira ×1.06 with
  sway; the Witness stride ×0.97, arm swing ×0.90, stoop 0.07 rad; Rook stride ×0.95, arms ×0.86; the child (kid_kai,
  1.27 m) cadence ×1.26, arms ×1.12, runs from 1.7 m/s. The arm swing is also evened out per side (the mocap swings
  the left arm 50 % more than the right).
- **Idle life.** Weight shifts come from the owner's idle clip (with the feet now locked, a shift is a real step),
  breathing, glances aside and back (fewer while walking or talking), look-at for head and neck (eyes: skin.js).
- **NPCs.** People moved by missions get speed, acceleration and turn rate from their root motion; a person whose
  root does not move but who has a `speed` walks on the spot as before. The same system runs for everyone.
- **Secondary motion** (`springs.js`). The rig has no cloth bones, so each template gets spring bones at run time:
  a ring of 8 bones hung from the hips for loose cloth (only when there is a real loose garment: coat tails, tunics,
  skirts, sash ends; the seat and wide trousers keep their leg weights), and 3 bones hung from the head for long
  hair. The loose cloth below the hip joints and the hair below ear level are re-weighted toward them (more toward
  the hem). Each bone's tip is a damped Verlet particle: it lags behind the body (starts, stops, turns, landings),
  is pulled back to its rest shape, keeps its distance to its neighbours (the hem stays a ring) and is pushed out of
  the thigh capsules, so the cloth never passes through the legs. `motionWorld.wind` (a Vector3) blows it.
  Templates with springs today: the Witness, Rook, Niko and Tala (coats and tunics) and Mira (hair). Kai's hip-length
  shell and short hair, Sera, Iven, Hale and the children have none.
- **Level of detail** (re-chosen every 0.3 s): LOD 0 (Kai always; others within 12 m, 6 m on the low tier) has
  everything; LOD 1 (to 32 m, 18 m on low) has no IK or foot locks, and the cloth is only pushed aside by the legs;
  LOD 2 (further, or a crowd person on its low build on the low tier) is the blend space alone, the cloth at rest.

### Before and after
Same scenarios as the audit, Kai at a fixed 30 fps on the low tier, both columns with today's physics. Classic =
`?motion=classic` (it reproduces the earlier classic run to the digit); new = the default. Niko and the child were
measured before the last cost work; everything else is the final build.

| Quantity | Classic | New | Target |
|---|---|---|---|
| Steady jog 3.1 m/s: foot slide per step, median / p90 | 5.7 / 8.2 cm | 0 / 3.3 cm | < 2 cm |
| Stick 20 % (walk): slide median / p90 | 4.3 / 4.9 cm | 2.6 / 3.4 cm | |
| Stick 50 %: slide median / p90 | 5.2 / 8.6 cm | 0 / 3.9 cm | |
| Sprint 5.6 m/s: slide median / p90 | 3.5 / 20 cm | 0 / 10 cm | |
| Circle (banked turn at 3.1 m/s): slide median | 6.7 cm | 0 cm | |
| Crouch walk 1.7 m/s: slide median, cadence | 1.4 cm, 197 spm | 0.3 cm, 157 spm | a sneak |
| Worst slide in the first second, keyboard / stick 50 % / sprint | 41 / 43 / 46 cm | 5.3 / 1.9 / 9.4 cm | |
| Worst slide during the stop, keyboard / stick 50 % / sprint | 37 / 39 / 55 cm | 0 / 0.6 / 3.4 cm | |
| Turn 90 / 180 degrees: worst slide | 13 / 40 cm | 2.0 / 3.6 cm | |
| Turn 180: peak bone angular velocity | 31 rad/s | 27 rad/s | |
| Idle: foot drift L / R | 2.4 / 8.1 cm | 0 / 5.5 cm (one weight-shift step) | locked |
| Jump in place: clips in the air, landing dip | idle; 3.3 cm | jump; 13 cm | 5-15 cm |
| Sprint jump: clips in the air, landing dip | run; 6 cm | jump_run; 17 cm | |
| 3 m drop (6.7 m/s): landing dip | 6 cm | 21 cm (pelvis 15 + trunk) | |
| Stairs 0.18 m at 3.1 m/s: toe penetration into risers | 26 cm | 2.9 cm | none |
| Stairs: planted-foot slide median | 7.1 cm | 0 | |
| Stairs at stick 35 %: penetration, lower foot above its tread p90 | 29 cm, 8.2 cm | 5.2 cm, 1.6 cm | |
| 0.40 m risers (m13): penetration, slide | 34 cm, 30 cm | 2.0 cm, 0 | |
| Ramp: penetration, slide | 11 cm, 7 cm | 2.0 cm, 0 | |
| Walker crowd lane ends: peak bone angular velocity | 94 rad/s | 14 to 22 rad/s | |
| Walkers within 12 m (high tier): slide median | 4.5 to 5.6 cm | 0.3 to 1.8 cm (LOD 0) | |
| Mission-style NPCs (root moved, speed set) at LOD 0: slide median / p90 | | Witness 0.6 / 2.5, Mira 1.0 / 2.8, Niko 0.8 / 2.9, child 1.9 / 2.8 cm | |

The within-gait peak bone speeds are 14 to 22 rad/s; the remaining peaks of about 32 rad/s are in the first steps
of a sprint start and in the jump take-off (base 26 there).

### Frame cost
CPU of one game step without rendering, the machine under a load average of about 27 (indicative only):

| View | Classic | New |
|---|---|---|
| Feel course, Kai alone (low) | 0.023 ms | 0.11 ms |
| Feel course, Kai + 12 Walkers (low) | 0.14 ms | 0.55 ms |
| Mission 1 (30 crowd people at LOD 2, low): all Character.update, median | 0.4 ms | 0.5 ms (+0.2 ms Kai) |
| Mission 6 (6 NPCs, medium): all Character.update, median | 0.1 ms | 0.3 ms (+0.2 ms Kai) |

The GPU work is the same: the same meshes and 4 bone influences per vertex; the spring bones only add 8 or 3 matrices
to a person's bone texture. SwiftShader render times on this machine (80 ms to 3 s a frame, swinging with the load)
say nothing about phones and did not change measurably. Measure with `node tools/feel/motion_cost.mjs --m=N --gfx=low
[--query=motion=classic]` (per-person CPU) and `tools/feel/cost.mjs` (whole frame).

### Evidence
Below, `$M` stands for `/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/feel/motion`.
- `$M/fc` (classic) and `$M/fn` (new): audit data and `metrics.json` for the table; `$M/summ.py fc fn` prints it.
- `$M/fr`: rendered Kai clips and sheets: `walk_start_stop_side.mp4`, `start_sheet.jpg`, `stop_sheet.jpg`,
  `stairs_side.mp4`, `stairs_sheet.jpg`, `circle_sheet.jpg` (banking), `turn180_sheet.jpg`, `crouch_sheet.jpg`,
  `jump_in_place_side.mp4`, `jump_sprint_side.mp4`.
- `$M/fh` and `$M/fh3` (high tier): `cast_sheet.jpg` (six principals walked the way missions do it), `crowd_sheet.jpg`,
  `npc_witness_npc.mp4` and `witness_sheet.jpg` (the coat swinging), `npc_mira_npc.mp4`.
- Missions 2 and 5 played through with the new motion as the default (`tools/tests/m2.json`, `m5.json`; both complete,
  no page errors): `$M/play_m2`, `$M/play_m5`.

New measuring tools: `tools/feel/author_clips.mjs` (writes `anims_extra.glb`), `tools/feel/motion_cost.mjs`,
`tools/feel/motion_probe.mjs` (what a template's clips measure and the gait profile). `feelhelper.js` gained
`FEEL.pacer(id, x, z0, z1, speed)` (a mission-style NPC), `FEEL.childLook`, the `npc` view and the motion state per
sample; `scenarios.mjs` gained `cast_walk` and `npc_<id>`; `analyze.mjs` reports per-NPC slide, turn snaps and pops.

### Limits and notes for the other steps
- Physics: on stairs Kai keeps his full flat-ground speed (3.1 m/s), so he runs up two to four treads a step; a
  slower stair speed (people climb at 0.5 to 0.7 m/s horizontally) would let the walk take one tread a step.
- The rig has no finger, face, hood or strap bones, so hands stay as the mocap holds them and Kai's hood roll and
  harness do not swing. Spring bones for those would need bones (or tags) from the character generator.
- Turning on the spot is done with corrective steps, not a turn clip; there is still no anticipation crouch before a
  jump (the physics takes off on the frame it is pressed, and a delay would cost responsiveness).
- People at LOD 1 and 2 have no foot locks: 3 to 6 cm of slide per step at 12 m and beyond.
