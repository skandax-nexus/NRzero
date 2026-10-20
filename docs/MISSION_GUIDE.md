# Mission builder guide

How to build one AFTERZERO mission. Read docs/BIBLE.md (the owner's gameplay bible, binding for story),
docs/ART_SPEC.md (art, physics, comfort, budgets), and the four finished missions in src/missions/
(m1_last_normal_day.js … m4_man_from_last_day.js) as worked examples.

## Files you own
- `src/missions/mNN_<slug>.js` — your mission (replace the stub; delete the `stub: true` flag).
- `src/world/env_mNN.js` — optional helpers for your map's visuals.
- `src/systems/<name>.js` — only if your brief assigns you a shared system (see below).
- `tools/tests/mNN.json` — an automated playthrough that completes your mission under `?auto`.
- `docs/missions/mNN.md` — short design notes: beats, flags read/written, playtime estimate.
Never edit other missions, `src/core/*`, `src/human/*`, `src/story/cast.js`, `src/world/kit.js|props.js|realism.js`
or `src/missions/index.js`. Report needed changes to shared code instead.

## Mission module
```js
import * as THREE from 'three';
export default {
  id: 'm9', act: 'ACT II · THE NINE-MINUTE WAR', title: 'Nine Minutes to Zero', sub: 'The looping city',
  async run(game) { /* build scene, then script the mission with awaits; return when the mission ends */ },
};
```
The runner calls missions in order; when `run` returns, the next mission starts. Fade to black at the end.

## Engine API (window.__game in tests)
- Scene: `game.newScene({ background, fog: [color, density], exposure, bloom, bloomThreshold, envIntensity, killY, residue })` returns a THREE.Scene and resets collision, interactables, actors, updaters.
- Collision (axis-aligned boxes, optional era restriction): `game.collision.add([minx,miny,minz],[maxx,maxy,maxz],{ states:['2049'] })`, `game.collision.addBox(x, yBottom, z, sx, sy, sz, opts)`; returned box has `.enabled`. Camera collision: `game.blocker(mesh)`.
- Player: `game.player.place(x, y, z, yaw)`, `game.player.pos`, `game.player.char` (Kai). Kill plane: `newScene({ killY })`.
- Characters: `game.actor(id, lookOrNull, x, y, z, ry)` (uses CAST[id] look when null) returns a Character with `.root .head .lookTarget .talk .speed .crouch .frozen .faceTowards(x,z,dt,rate) .setGhost(color)`. Crowd: `new Walker(game, citizenLook(rng)|settlerLook(rng), { x, y, z0, z1, idle, ry, speed })` from src/world/props.js and src/story/cast.js. New characters: `registerCast(id, { name, role, bio, look, vp: { sex, pitch, rate, langs } })` from src/story/cast.js. Characters are being upgraded to realistic humans behind the same API, so just use the API.
- Interactions: `game.interact({ pos:[x,y,z], radius, prompt, hold, once, enabled:()=>bool, states:['2196'], onUse })`; `game.removeInteract(it)`; tests can call `__game.use('prompt text')`.
- Script helpers (all abortable): `await game.wait(s)`, `await game.waitFor(() => cond)`, `await game.talk([[id, line], ...])`, `await game.say(id, line)`, `const i = await game.choice(id, prompt, ['A', 'B'])`, `game.objective(text)`, `game.ui.subtitle(id|null, line, ms)` (non-blocking bark), `game.ui.toast(text)`, `game.ui.addEvidence(title, text, tag)`, `await game.ui.chapterCard(act, title, sub)`, `await game.ui.fade(0|1, ms)`, `game.ui.letterbox(on)`, `await game.shot([camPos], [lookAt], seconds, { fov, follow })`, `game.releaseCam()`, `game.shake = 0.3`, `game.control = true|false`, `game.checkpoint(x,y,z,yaw,onRestore)`, `game.fail(message)`, `const stop = game.onUpdate((dt, t) => …)`.
- Dialogue is voiced automatically (device speech) and lip-synced; keep lines short and natural.
- Story flags persist across missions in a run: `game.flags.<name>` (e.g. `trustedHale`). Read earlier flags to reflect consequences; document what you write.
- Temporal states: `game.temporal.configure([{ id, key, name, year, glyph, color, theme, apply(first, prev) }], initial)`, `game.temporal.only(obj, ...stateIds)`, `game.temporal.unlocked = true`, `await game.temporal.switchTo(id, { force, free, dur })`, `game.temporal.setImmediate(id)`, `game.temporal.onSwitch(fn)`, `game.temporal.stability` (0..1). Keys 1/2/3 and Q switch; touch has era buttons.
- Residue Vision: `newScene({ residue: true })` keeps it unlocked; `game.residue(object)` shows an object only in Residue Vision (F).
- Stealth: `new Drone(game, [[x,y,z], ...], { speed, range })` and the detection loop pattern in m2.
- Audio: `game.audio.setTheme('title'|'city'|'stealth'|'tension'|'chronolith'|'past'|'future'|'memory'|null)`; add your own with `registerTheme(name, { bpm, step(a, step, time, sixteenth) })` from src/core/audio.js (instruments: a.piano, a.pad, a.cello, a.flute, a.pluck, a.drum, a.tick, a.glass). Beds: `game.audio.rain(v) wind(v) hum(v, hz) water(v) crowd(v)`. Stingers: `game.audio.sfxPlay('switch'|'anomaly'|'pickup'|'success'|'fail'|'alarm'|'boom'|'metal'|'door'|'spark'|'heartbeat'|'motif'|'rewind'|'drone')`. Silence as storytelling: `game.audio.silence(sec)`.
- Visual kits: src/world/kit.js (sky, Rain, Motes, box, glowMat, neonSign, puddleGlow, facade textures, asphalt/tile/stone/concrete materials, chronolith, cableCurve, canvasTex, rng) and src/world/realism.js (PBR texture sets, sky-driven lighting, environment captures, interior-mapped windows, city blocks, terrain, grass, trees, water, fog; read its header comments).

## Shared systems (owner builds it; later missions import it)
| System | File | Owner mission |
|---|---|---|
| Local loops (repeating sequences, loop reset with retained knowledge) | src/systems/loops.js | M6 (extended by M9) |
| Celestial alignment helpers | src/systems/alignment.js | M7 |
| Combat-lite (temporal weapon, enemies that react, takedowns, health, non-lethal surrender) | src/systems/combat.js | M10 |
| Echo Step (afterimage decoy / gap crossing, stability cost) | src/systems/echostep.js | M10 |
| Inversion (local reverse of selected motion) | src/systems/inversion.js | M11 |
| Faction support & choices | src/systems/factions.js | M13 |
| Memory scenes (subjective, contradictory environments) | src/systems/memory.js | M20 |

## Quality bar
- Cinematic: opening establishing shot with letterbox and chapter card, music that follows the beats, short voiced exchanges, at least two staged camera moments, a strong mission ending.
- Gameplay: implement every bullet of the mission's "Playable sequence" in the bible as a real beat, plus at least one optional discovery (evidence, side conversation, collectible "temporal shard"), clear objectives, checkpoints before every hard section, hints via barks if the player stalls.
- Length: aim for the bible's target duration through content and challenge, not padding.
- Consequences: honor flags from earlier missions and the bible's choices; choices change content, never block the campaign.
- Phones: <= 250 draw calls, <= 700k triangles, <= 6 dynamic lights, 1 shadow caster at gfx=low/medium; quick scene build.
- Comfort: no full-screen white flashes or strobing; use soft fades.
- Proof: `node tools/drive.mjs "http://localhost:8765/index.html?m=<index>&dtcap=0.25&gfx=low&auto" tools/tests/mNN.json 960 540 --outdir=<dir>` must complete your mission; lint must be clean.


## Infrastructure kit
Buildings, streets and street furniture with real depth, built by code and kept inside the phone budget. Missions
1-4 get the automatic part for free (kit `box()` buildings, stone houses, `lampPost`); new missions call the builders
below. Everything is opt-in or a pure quality upgrade; nothing here changes collision (add your own boxes, or use
`k.collide(game)` for street props). Review scenes: `tools/render/infra-lab.html?era=2049|2026|2196|ancient&view=0|1|2`.

**Automatic (no code change)**
- `box(w, h, d, mat, …)` with a `facadeTextures(seed, style, era = '2049')` material and h ≥ 8 m becomes a real
  building on the first frame its scene renders: interior-mapped windows with frames, sills and lit rooms, cornices,
  ledges, fire escapes, balconies, AC units, pipes, rooftop plant, and the era's retrofits. It keeps clear of what the
  scene put around it (signs, awnings, lamps, neighbours): faces against a neighbour become party walls, a ground
  floor you dressed yourself (shopfront plane, awning) stays plain wall, other street faces get shops. Camera blockers
  still ray-test the plain box. `box(..., { detail: false })` keeps a plain box.
- `box(...)` with a `stoneMaterial()` and house size (2.4-12 m tall, ≥ 2.5 m wide) gets a plinth course, corner
  quoins, a timber wall plate and beam ends.
- `lampPost(color, h, { era })` is a real street light (base, tapered pole, bracket, luminaire, lit lens, glow card
  that reads without bloom on low); `era: '2049'` adds a cyan LED strip.
- The engine merges static meshes that share a material (or an equal plain material, or a static canvas texture
  such as `neonSign`) into a few draws per 50 m cell on every tier. Anything you move, re-material, hide or remove
  later draws itself again automatically. Opt out: `mesh.userData.noBatch = true`, `scene.userData.batch = false`.

**Buildings (src/world/realism.js)**
```js
const block = RZ.cityBlock([
  { width: 14, depth: 16, height: 38, position: [-19, 0, -20], yaw: Math.PI / 2, seed: 3, wall: 'brick',
    faces: ['shop', 'blank', 'windows', 'blank'] },          // front, right, back, left
], { era: '2049', lit: 0.4, daylight: 0 });                 // one mesh, one draw for the whole block
scene.add(block.mesh);
```
- `era`: `'2026'` contemporary (clean walls, aluminium fins, glass balcony fronts, solar roofs), `'2049'` Rain City
  retrofit (cladding patches, LED strips, LED / holo sign panels, metal canopies with LED edges, AC units, cable runs,
  dishes, aviation lights, rooftop screens), `'2196'` ruin (blown-out / boarded windows, soot, cracks, moss, broken
  parapet, collapsed corner with exposed slabs and rebar, hanging vines, rust, rubble). Without `era` a block looks as
  before.
- Per building: `ruin`, `moss` (0..1), `led` (0..1), `ledColors`, `holo` (sign panel count), `awnings`, `signBand`,
  `fins`, `cables`, `collapse`, `groundBlank: true | [f, r, b, l]`, `roof: { solar, dish, billboard, tank, hvac,
  antenna, bulkhead, parapet }`, `detail: 'low'`, `avoid(min, max) -> true` (drop protruding items that would hit your
  props; world AABBs). Block-wide defaults: `cityBlock(list, { era, avoid, detail })`.
- `RZ.facadeGeometry(o)` one building's geometry for your own mesh (use `RZ.windowInteriorMaterial()`).
- Ancient: `RZ.settlement([{ position, yaw, width, depth, height, wall: 'stone'|'mud'|'timber', roof: 'thatch'|'flat'|'none',
  door, windows, seed }, { position, round: true, radius, wall: 'mud' }], { colors: { stone, mud, wood, thatch } })`
  → `{ group }` (five draws for any number of houses: stone, mud render, timber, thatch, dark openings);
  `RZ.ancientHouse(o)` for one; `RZ.pbrMaterial('thatch')` is a new surface.

**Streets (src/world/props.js)**
```js
import { streetKit } from '../world/props.js';
const k = streetKit({ era: '2049', seed: 4 });             // '2026' | '2049' | '2196' | 'ancient'
k.kerb([[-6, 15], [-6, -95]]).kerb([[6, -95], [6, 15]])   // left side of the path is the raised pavement
 .markings({ lanes: [{ from: [0, 15], to: [0, -95] }], crossings: [{ at: [0, -30], yaw: Math.PI / 2, width: 11 }],
             stops: [{ from: [0.2, -27.6], to: [5.2, -27.6] }], arrows: [{ at: [2.7, -20], yaw: Math.PI }] })
 .scatter('lamp', [[6.6, 12], [6.6, -90]], { spacing: 14, turn: Math.PI / 2, y: 0.15 })
 .trafficLight([6.5, 0.15, -27], 0).shelter([8.6, 0.15, -12], -Math.PI / 2)
 .car([-4.4, 0, -4], 0).scooter([-7.4, 0.15, -21, 0.5]).puddles([[-2, -9, 1.6]])
 .rails([[3, 15], [3, -95]], { embedded: true }).cables([[[-11, 9, -2], [11, 8.5, -3]]]);
scene.add(k.build()); k.collide(game);                     // or use k.colliders yourself
```
- Props (`k.add(kind, [x, y, z], yaw, opts)` or the shorthands): `lamp`, `bollard`, `bin`, `bench`, `drain`,
  `manhole`, `trafficLight` (cycles by itself), `shelter` (bus / tram stop), `kiosk` (vending / holo kiosk), `railing`,
  `car`, `van`, `wreck`, `scooter`, `cone`, `barrier`, `rubble`; ancient: `fence`, `well`, `cart`, `stall`, `pot`,
  `barrel`, `crate`. Merged runs: `kerb`, `markings`, `puddles`, `cables`, `catenary`, `rails`, `railing(path)`.
  `scatter(kind, path | { area: [x0, z0, x1, z1] }, { spacing, count, offset, jitter, turn, y })`.
- `prop(kind, { era, color })` one prop as a plain Group (one-off placement).
- Cost: one InstancedMesh per prop part per 48 m cell (a 100 m street of the lab: ~40 draws for all furniture);
  small props are distance-culled by the engine (45-120 m per kind, x1.5 on high, x0.67 on low). 2196 tilts posts, rusts metal and turns
  cars into wrecks; parked 2049 cars have LED light bars and underglow.
- Debug / A/B: `?infra=off` builds the kit exactly as before the upgrade; `?infra=nofacade,nomasonry,nolamp,nobatch`
  switches single parts off; `game.engine.setInfraLegacy(true|false)` flips a running scene; `engine.stats.batches`,
  `engine.stats.batched` report the merge.
- Phone cost (docs/RENDERING.md, stage 4 "Cost"): batching halves a street's draw calls on every tier, but a view
  filled with facade buildings costs ~12-20 % more GPU time on the phone tiers than flat-printed boxes did (the
  windows are drawn per pixel). Give far skyline towers a material with only the `facadeTextures` emissive map (no
  `map`): they build in `far` mode (glass curtain walls, no shops, few protrusions, low detail). Budget ~250 calls /
  700k triangles on `?gfx=low`.
