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
