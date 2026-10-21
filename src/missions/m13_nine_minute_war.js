// MISSION 13 · THE NINE-MINUTE WAR (Act II) — the first large-scale battle and a consequential choice.
// Bible beats: cross an active battlefield · disable three devices in different temporal states · recognise that both
// factions are reacting to their own previous attacks · choose to destroy the stabilizer or redirect its energy to free
// civilians. Quote: "This is not the future." / "What is it, then?" / "The future that survives long enough to remember
// us." Ending: the choice changes the district and later support options, but does not block the campaign.
// Sunday 24.10.2049, 05:52. The Witness's trail from Chamber II leads Kai to the Sable Yards, a district held in one
// second since the Zero Second. In its 2196 state the Continuum and the Unwritten fight over the stabilizer that holds it.
// Shared systems: src/systems/factions.js (owner), combat.js, echostep.js.
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { CAST, registerCast, citizenLook } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { glowMat, rng } from '../world/kit.js';
import { Combat } from '../systems/combat.js';
import { EchoStep } from '../systems/echostep.js';
import { Factions } from '../systems/factions.js';
import { registerM10Cast } from '../world/env_m10.js';
import { buildSable, registerM13Cast, registerM13Themes, musicState, P, SHARDS, IMPACTS, CAGES, ANCHOR_CAGE, SPIRE, DOME_R, UNWRITTEN, WORKER26, TEX, Y0, groundY } from '../world/env_m13.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ERA = { '2026': 'PAST', '2049': 'PRESENT', '2196': 'FUTURE' };

export default {
  id: 'm13', act: 'ACT II · THE NINE-MINUTE WAR', title: 'The Nine-Minute War', sub: 'The stabilizer',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM13Cast(); registerM10Cast(); registerM13Themes();
    const haleSide = F.trustedHale !== false, metSera = !!(F.metSera || F.m10metSera);
    registerCast('m13hale', { name: 'OFF. R. HALE · RADIO', role: 'Helix cordon, Sable Yards', portraitOf: 'hale', vp: { sex: 'm', pitch: 0.84, rate: 1.0, langs: ['en-US', 'en-GB'] } });
    registerCast('m13brandt', { name: 'M. BRANDT · RADIO', role: 'Helix cordon, Sable Yards', portraitOf: 'brandt', vp: { sex: 'm', pitch: 0.8, rate: 1.02, langs: ['en-GB', 'en-US'] } });
    registerCast('m13lasker', { name: 'DOV LASKER · RADIO', role: 'Unwritten band', portraitOf: 'lasker', vp: { sex: 'm', pitch: 0.78, rate: 0.95, langs: ['en-GB', 'en-IE', 'en-US'] } });
    registerCast('m13held', { name: 'RESIDENT', role: 'Sable Yards · 2049', vp: { sex: 'f', pitch: 1.06, rate: 1.0, langs: ['en-GB', 'en-US'] } });
    const radioId = haleSide ? 'm13hale' : 'm13brandt';
    try {
      const need = ['lasker', 'nell', 'senn', 'm13foreman', 'prefect', 'sera', 'witness', 'hale', 'brandt', 'm13keeper', 'm13fighter', 'm13worker'].filter(id => !ui.portraits[id] && CAST[id]?.look);
      if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]]))));
    } catch (err) { console.warn('m13 portraits', err); }

    const scene = game.newScene({ background: 0x8a949c, fog: [0x8a949c, 0.012], exposure: 1.0, bloom: 0.5, bloomThreshold: 0.85, envIntensity: 0.8, killY: -9, residue: true });
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    const Q = RZ.getQuality(), low = Q === 'low';
    game.onUpdate(dt => RZ.update(dt));
    await tick();

    // ---------- temporal states ----------
    const S = { shards: 0, seen: {}, ev: new Set(), obj: '', phase: 'open', held: 0, notes: 0, anchors: 0, allow26: false, restrained: 0, falls: 0, hits: 0,
      evid: new Set(), deduceMiss: 0, craneMiss: 0, nell: 'none', senn: 'none', laskerOk: false, adairOk: false, busy: false, choice: null, returns: 0 };
    let mood = 'm13-held', musicLock = null, lookReady = false;
    const themeFor = () => musicLock || (T.current === '2049' ? 'm13-held' : T.current === '2026' ? 'm13-site' : mood);
    const music = (fade = 1.6) => { const th = themeFor(); for (const d of T.defs) d.theme = d.id === '2049' ? (musicLock || 'm13-held') : d.id === '2026' ? (musicLock || 'm13-site') : (musicLock || mood); audio.setTheme(th, fade); };
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    const setMood = (m) => { if (m !== mood) { mood = m; if (!musicLock) music(); } };
    T.configure([
      { id: '2026', key: '1', name: ERA['2026'], year: 'SABLE YARDS · 2026', glyph: '◐', color: '#ffb36a', theme: 'm13-site', apply: () => { if (lookReady) applyLook(); } },
      { id: '2049', key: '2', name: ERA['2049'], year: 'HELD · 2049', glyph: '◎', color: '#5fe6ff', theme: 'm13-held', apply: () => { if (lookReady) applyLook(); } },
      { id: '2196', key: '3', name: ERA['2196'], year: 'THE WAR · 2196', glyph: '◑', color: '#ff8f6a', theme: 'm13-camp', apply: () => { if (lookReady) applyLook(); } },
    ], '2049');
    T.unlocked = false;

    const W = buildSable(game, scene, T);
    game.onUpdate((dt, t) => W.update(dt, t));
    await tick();

    // ---------- light: a sky per state, one sun (the shadow caster), a hemisphere and the three nearest practicals ----------
    const envs = {};
    try {
      envs['2049'] = RZ.skyEnvironment(renderer, scene, { preset: 'overcast', elevation: 5, azimuth: 95, cover: 0.97, apply: false });
      envs['2026'] = RZ.skyEnvironment(renderer, scene, { preset: 'overcast', elevation: 34, azimuth: 160, cover: 0.82, apply: false });
      envs['2196'] = RZ.skyEnvironment(renderer, scene, { preset: 'sunset', elevation: 4, azimuth: 255, turbidity: 6, cover: 0.55, apply: false });
    } catch (err) { console.warn('m13 sky', err); }
    const hemi = new THREE.HemisphereLight(0xb8c8d0, 0x2a2a2c, 0.5); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.castShadow = true;
    sun.shadow.mapSize.set(Q === 'high' ? 2048 : low ? 512 : 1024, Q === 'high' ? 2048 : low ? 512 : 1024);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    const sunDir = V(0.5, 0.6, 0.3).normalize();
    const LOOK = {
      '2049': { fog: [0x8e98a2, 0.011], env: 0.75, hemi: [0xb8c8d6, 0x2a2e32, 0.55], sun: [0xc8d8e8, 0.55], dir: [0.85, 0.22, -0.2], exp: 1.0, bg: 0x8e98a2 },
      '2026': { fog: [0xb8bcbc, 0.008], env: 0.9, hemi: [0xe8eef0, 0x4a4840, 0.6], sun: [0xfff4e4, 1.5], dir: [-0.35, 0.75, 0.5], exp: 1.0, bg: 0xb8bcbc },
      '2196': { fog: [0x6a5446, 0.015], env: 0.7, hemi: [0xffb88a, 0x2a1e18, 0.45], sun: [0xffa060, 2.2], dir: [-0.8, 0.2, 0.25], exp: 1.08, bg: 0x6a5446 },
    };
    function applyLook() {
      const e = T.current, L = LOOK[e] || LOOK['2049'];
      scene.fog.color.set(L.fog[0]); scene.fog.density = L.fog[1];
      const env = envs[e];
      if (env) { scene.environment = env.envMap; scene.environmentIntensity = L.env; scene.background = env.background || new THREE.Color(L.bg); } else scene.background = new THREE.Color(L.bg);
      hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
      sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; sunDir.set(...L.dir).normalize();
      renderer.toneMappingExposure = L.exp;
      audio.rain(e === '2049' && S.freed ? 0.3 : 0); audio.wind(e === '2196' ? 0.14 : e === '2026' ? 0.05 : 0.02);
      audio.crowd?.(e === '2026' ? 0.05 : 0); audio.hum(e === '2049' ? 0.04 : 0, 52);
      lightT = 0;
    }
    let lightT = 0;
    const rigLights = () => {
      const p = game.cine ? game.engine.camera.position : pl.pos, e = T.current;
      const list = W.lightSrc.filter(s => s.era === e || s.era === 'all').map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      pts.forEach((l, i) => { const s = list[i]; if (!s || s.dd > 50 * 50) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
    };
    game.onUpdate(dt => {
      const p = game.cine ? game.engine.camera.position : pl.pos;
      sun.target.position.set(p.x, 0, p.z); sun.position.set(p.x + sunDir.x * 70, sunDir.y * 70 + 4, p.z + sunDir.z * 70);
      lightT -= dt; if (lightT <= 0) { lightT = 0.4; rigLights(); }
    });
    T.onSwitch(() => { lightT = 0; });
    lookReady = true; applyLook();

    // ---------- helpers ----------
    const near = (x, z, r) => Math.hypot(pl.pos.x - x, pl.pos.z - z) < r;
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag) => { S.ev.add(title); ui.addEvidence(title, text, tag); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const choose = (id, text, opts, correct = 0) => { if (game.autoplay) game.autoChoice = game.autoQueue?.length ? game.autoQueue.shift() : correct; return game.choice(id, text, opts); };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u)); if (u >= 1) { off(); res(); } }); });
    const idle = () => game.waitFor(() => !ui.dlgActive && !S.busy && !game._failing);
    const side = async (fn) => { if (S.busy || !game.control) return; S.busy = true; try { await fn(); } catch (err) { if (err?.name !== 'Abort' && !String(err).includes('Abort')) console.warn('m13 side', err); } finally { S.busy = false; if (!S.main) { game.control = true; ui.letterbox(false); game.releaseCam(); } } };
    let shiftPulse = 0;
    game.onUpdate(dt => { if (shiftPulse > 0 && game.engine.fx?.uShift) { shiftPulse = Math.max(0, shiftPulse - dt * 1.2); game.engine.fx.uShift.value = shiftPulse; } });
    const kai = pl.char;

    // era switching: 2026 opens only when the held second stops masking it; never into a wall or onto nothing
    const solidAt = (id) => {
      const p = pl.pos, y0 = p.y + 0.45, y1 = p.y + 1.6; let ground = false;
      for (const b of game.collision.boxes) {
        if (!b.enabled || (b.states && !b.states.includes(id)) || b.walkOnly) continue;
        if (!(p.x > b.min.x - 0.28 && p.x < b.max.x + 0.28 && p.z > b.min.z - 0.28 && p.z < b.max.z + 0.28)) continue;
        if (b.max.y > y0 && b.min.y < y1) return 'solid';
        if (p.x > b.min.x - 0.1 && p.x < b.max.x + 0.1 && p.z > b.min.z - 0.1 && p.z < b.max.z + 0.1 && b.max.y <= p.y + 0.45 && b.max.y > p.y - 1.6) ground = true;
      }
      return ground ? null : 'void';
    };
    const baseCan = T.canSwitch.bind(T);
    T.canSwitch = (id) => {
      if (!baseCan(id)) return false;
      if (id === '2026' && !S.allow26) { if (once('no26' + Math.floor(game.time / 5))) { ui.toast('NO 2026 SIGNATURE · THE HELD SECOND IS SITTING ON IT', 2000); audio.sfxPlay('fail'); } return false; }
      if (id === '2196' && pl.pos.z < -38.6 && !S.adairOpen) { if (once('dampN' + Math.floor(game.time / 5))) { ui.toast('CONTINUUM DAMPERS · NO SHIFTING BEHIND THEIR LINE', 2000); audio.sfxPlay('fail'); } return false; }
      const why = solidAt(id);
      if (why) { if (once('solid' + id + Math.floor(game.time / 3))) { ui.toast(why === 'solid' ? `SOLID HERE IN ${id} · MOVE TO OPEN GROUND` : `NOTHING TO STAND ON HERE IN ${id}`, 1800); audio.sfxPlay('fail'); } return false; }
      return true;
    };

    // ---------- factions, combat, Echo Step ----------
    const FX = new Factions(game);
    const inSmoke = () => W.smoke.some(s => Math.hypot(pl.pos.x - s.x, pl.pos.z - s.z) < 5.6 && s.t > 2);
    const C = new Combat(game, {
      hp: 5, invisible: () => T.current === '2196' && inSmoke(),
      cover: (p) => T.current === '2196' && W.smoke.some(s => Math.hypot(p.x - s.x, p.z - s.z) < 7),
      onDown: () => { C.fail(T.current === '2049' ? 'THE KEEPERS PUT YOU DOWN · BACK TO COVER' : 'STUNNED IN THE OPEN · BACK TO COVER'); },
      onCaught: () => { C.fail('CAUGHT'); },
      onRestrain: () => { S.restrained++; F.m13restrained = S.restrained; },
      onTakedown: () => { S.restrained++; F.m13restrained = S.restrained; ui.subtitle('kai', 'Stay down. It\'s nearly over.', 1800); },
    });
    let echo = null;
    if (F.echoStep !== false) { try { echo = new EchoStep(game, { combat: C, cost: 0.25, cooldown: 5, linger: 4.5 }); echo.unlock(); echo.onStep = () => { F.m13echoUses = (F.m13echoUses || 0) + 1; }; } catch (err) { console.warn('m13 echo', err); } }
    const cp = (x, y, z, yaw, extra) => game.checkpoint(x, y, z, yaw, () => { C.reset(); BR.t = 3; for (const b of BR.pending) b.done = true; BR.pending = []; extra?.(); });

    // ---------- people: visibility follows the era each person lives in ----------
    const people = [];
    const person = (ch, era) => { people.push({ ch, era, on: true }); return ch; };
    const show = (ch, on) => { const p = people.find(q => q.ch === ch); if (p) p.on = on; };
    const eraOf = (ch, era) => { const p = people.find(q => q.ch === ch); if (p) p.era = era; };
    game.onUpdate(() => { for (const p of people) p.ch.root.visible = p.on && (!p.era || p.era === T.current); });
    const walkTo = (ch, path, speed = 1.5) => new Promise(res => {
      let i = 0;
      const off = game.onUpdate(dt => {
        const p = ch.root.position, t = path[i]; const dx = t[0] - p.x, dz = t[2] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { i++; if (i >= path.length) { ch.speed = 0; off(); res(); } return; }
        const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st; p.y += (t[1] - p.y) * Math.min(1, dt * 5);
        let dy = Math.atan2(dx, dz) - ch.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.root.rotation.y += dy * Math.min(1, dt * 8); ch.speed = speed;
      });
    });

    // conversations: turn both people to each other, then an over-the-shoulder shot of whoever speaks
    const posOf = (ch) => (ch === kai ? pl.pos : ch.root.position);
    const faceEach = (a, b) => {
      const pa = posOf(a), pb = posOf(b), ya = Math.atan2(pb.x - pa.x, pb.z - pa.z), yb = Math.atan2(pa.x - pb.x, pa.z - pb.z);
      if (a === kai) { pl.yaw = ya; kai.root.rotation.y = ya; } else a.root.rotation.y = ya;
      if (b === kai) { pl.yaw = yb; kai.root.rotation.y = yb; } else b.root.rotation.y = yb;
      a.lookTarget = b.head; b.lookTarget = a.head;
    };
    const ots = (speaker, listener, dur = 1.0, fov = 36, side = 0.55) => {
      const sp = posOf(speaker), l = posOf(listener), dx = sp.x - l.x, dz = sp.z - l.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
      return game.shot([l.x - ux * 1.35 + uz * side, l.y + 1.68, l.z - uz * 1.35 - ux * side], [sp.x, sp.y + (speaker.crouch > 0.5 ? 1.0 : 1.58), sp.z], dur, { fov });
    };
    // named people
    const sera = person(game.actor('sera', { ...CAST.sera.look, era: '2196' }, P.sera[0], Y0, P.sera[2], -Math.PI / 2), '2196');
    const lasker = person(game.actor('lasker', null, P.lasker[0], Y0, P.lasker[2], -Math.PI / 2), '2196');
    await tick();
    const nell = person(game.actor('nell', null, P.nell[0], Y0, P.nell[2], -Math.PI / 2), '2196'); nell.pose = 'sad'; nell.crouch = 1;
    const senn = person(game.actor('senn', null, P.senn[0], Y0, P.senn[2], Math.PI), '2196'); senn.crouch = 1;
    await tick();
    const adair = person(game.actor('prefect', null, P.adair[0], 0.3, P.adair[2], 0), '2196');
    const foreman = person(game.actor('m13foreman', null, -12.6, Y0, 9.2, -1.2), '2026');
    const witness = person(game.actor('witness', { ...CAST.witness.look, era: '2049' }, -22, 8.4, -49, 0), '2196'); show(witness, false);
    await tick();
    // the Unwritten at the barricade and in the camp, the Continuum sentries at their line
    const fighters = [[-8.2, 43.6, Math.PI, 1], [-4.4, 43.4, Math.PI, 1], [6.2, 43.4, Math.PI, 1], [9.4, 43.6, Math.PI, 1], [-2.6, 64.8, 0.4, 0]].map(([x, z, ry, cr], i) => {
      const ch = person(game.ambient({ ...UNWRITTEN[i % 4], seed: 900 + i }, x, groundY(x, z), z, ry), '2196'); ch.crouch = cr; return ch;
    });
    const sentries = [[-6, -41.4, 0], [5.4, -41.4, 0]].map(([x, z, ry], i) => person(game.ambient({ ...CAST.m13keeper.look, seed: 950 + i, lod: true }, x, Y0, z, ry), '2196'));
    await tick();
    const workers = [[-3, 12.4, 2.6, 'work'], [9.6, -1.0, -1.6, 'look']].map(([x, z, ry, pose], i) => { const ch = person(game.ambient({ ...WORKER26[i], seed: 960 + i }, x, Y0, z, ry), '2026'); ch.pose = pose; return ch; });
    await tick();
    // the held: Sable residents stopped at 08:14:00 (frozen mid-step)
    const HELD = [
      [-8.4, 55.6, Math.PI * 0.9, 'cup'], [6.6, 47.4, Math.PI, 'courier'], [9.3, -4.3, 2.6, 'couple'], [10.0, -4.5, 2.7, 'couple2'], [-13.0, -8, -Math.PI / 2, 'driver'],
      [-9.2, 66, Math.PI, ''], [8.2, 62, 0.2, ''], [-2.6, 52.5, Math.PI / 2, ''], [-9.6, 38, Math.PI, ''], [9.2, 30.5, 0.3, ''], [-12, -11.6, 0.6, ''], [4, -11.3, -0.5, ''], [14, -4.1, 2.8, ''],
    ];
    const R = rng(1349), held = [];
    for (const [x, z, ry, tag] of HELD) {
      const y = tag === 'driver' ? 0.75 : (z < -2 && z > -13.5 && Math.abs(x) < 18) ? 0.35 : groundY(x, z);
      const look = citizenLook(R, { umbrella: tag !== 'driver' && tag !== 'courier' && tag !== 'cup' }); look.lod = true; look.era = '2049';
      const ch = person(game.ambient(look, x, y, z, ry), '2049');
      if (tag === 'driver') ch.pose = 'sit'; else if (tag === 'cup') ch.pose = 'look'; else ch.speed = tag === 'courier' ? 3.2 : 1.1 + R() * 0.3;
      held.push({ ch, tag, hold: 0.25 + R() * 0.6 });
      if (held.length % 4 === 0) await tick();
    }
    game.onUpdate(dt => { for (const h of held) { if (h.ch.frozen || S.freed) continue; h.hold -= dt; if (h.hold <= 0) h.ch.frozen = true; } });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.11, 12), new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.5 }));
    cup.position.set(-8.25, 0.86, 55.15); cup.rotation.z = 0.7; scene.add(cup); T.only(cup, '2049');
    const spill = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.1 })); spill.position.set(-8.2, 0.8, 55.1); spill.scale.set(1.6, 0.6, 1); scene.add(spill); T.only(spill, '2049');

    // the trooper pool: Continuum troopers in 2196, Keepers who walk in the held second in 2049
    const KEEPER = CAST.m13keeper.look;
    const pool = [];
    const mkTrooper = (i) => {
      if (pool[i]) return pool[i];
      const look = { ...KEEPER, seed: 700 + i, female: i % 3 === 2, sex: i % 3 === 2 ? 1 : 0, hairStyle: i % 3 === 2 ? 'bun' : 'buzz', skin: [0xd9a585, 0x8c5a3a, 0xe8b996, 0xb98463, 0x6b4029][i % 5], lod: true };
      const ch = game.ambient(look, 0, -60, 0, 0); person(ch, '2196'); show(ch, false); pool[i] = ch; return ch;
    };
    for (let i = 0; i < 5; i++) { mkTrooper(i); if (i % 2) await tick(); }
    const BARKS = {
      spot: ['Contact! The architect!', 'Varen, in the open!', 'He is out of phase again — watch the gaps!'],
      search: ['He shifted. Hold the line.', 'Gone into the old year. Wait for him.'],
      lost: ['Holding.', 'Back to the line.'],
      yield: ['Enough. I yield.', 'Down. I\'m down.'],
    };
    const KBARKS = {
      spot: ['Moving body in the held field!', 'Something walks in the still. Varen.'],
      search: ['He left the still. Hold.', 'Listen. Nothing moves here but us.'],
      lost: ['The still is clean.'],
      yield: ['I yield. Let me hold my post.'],
    };
    const enemy = (i, x, z, yaw, era, o = {}) => {
      const ch = mkTrooper(i), old = C.enemies.find(q => q.char === ch); if (old) C.removeEnemy(old);
      ch.root.position.set(x, groundY(x, z), z); ch.root.rotation.y = yaw; ch.frozen = false; ch.pose = null; ch.crouch = 0; eraOf(ch, era); show(ch, true);
      return C.addEnemy(ch, { states: [era], voice: 'm13keeper', barks: era === '2049' ? KBARKS : BARKS, yaw, range: era === '2049' ? 10 : 13, ...o });
    };
    const park = (list) => { for (const e of list) { C.removeEnemy(e); e.char.root.position.set(0, -60, 0); show(e.char, false); } };
    window.__m13 = { S, W, C, FX, echo, T, P, sera, lasker, nell, senn, adair, held, pool,
      clear: () => { for (const e of C.standing()) C.restrain(e); }, };

    // ---------- the barrage: the same shells, the same holes, every cycle ----------
    const BR = { on: false, set: null, i: 0, t: 4, n: 0, pending: [], clock: false };
    const fireAt = (x, z, lead = 2.2) => {
      const b = W.telegraph(x, z, lead); const from = z > 0 ? [x * 0.3, 9, -2] : [x * 0.3, 9, -2];
      W.tracer(from, [x, 0.4, z], lead, 6 + Math.random() * 6);
      BR.pending.push({ b, at: game.time + lead, x, z });
    };
    game.onUpdate(dt => {
      // ambient war: tracers between the lines and out of the return ring
      if (S.war && !S.ceasefire) { BR.amb = (BR.amb || 0) - dt; if (BR.amb <= 0) { BR.amb = 0.6 + Math.random() * 1.4; const k = Math.random(); if (k < 0.4) W.tracer([(Math.random() - 0.5) * 16, 1.6, 43], [(Math.random() - 0.5) * 18, 1, -40], 1.8, 3); else if (k < 0.8) W.tracer([(Math.random() - 0.5) * 16, 1.6, -40.5], [(Math.random() - 0.5) * 18, 1, 42], 1.4, 2); else W.tracer([SPIRE[0], 9, SPIRE[1]], [(Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 80], 2.2, 5); } }
      if (BR.on && BR.set && game.control && !game._failing && !ui.dlgActive) {
        BR.t -= dt;
        if (BR.t <= 0) {
          const list = IMPACTS[BR.set]; const [x, z] = list[BR.i % list.length]; BR.i++; BR.n++;
          fireAt(x, z); BR.t = BR.n % list.length === 0 ? 7.5 : 2.7;
          musicState.barrage = Math.min(1, musicState.barrage + 0.25);
        }
      }
      musicState.barrage = Math.max(0, musicState.barrage - dt * 0.08);
      for (const p of BR.pending) {
        if (p.done || game.time < p.at) continue; p.done = true; W.blast(p.b);
        const d = Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z);
        if (T.current === '2196') {
          audio.sfxPlay('boom'); game.shake = Math.max(game.shake || 0, Math.max(0, 0.32 - d * 0.012));
          if (d < 3.4 && game.control && !game._failing) { S.hits++; F.m13shellHits = S.hits; C.hurt(2); ui.subtitle('kai', ['Too close—', 'Move!', 'Same hole. Every time.'][S.hits % 3], 1400); }
        }
      }
      BR.pending = BR.pending.filter(p => !p.done);
      if (game.shake > 0 && !game.cine) game.shake = Math.max(0, game.shake - dt * 0.6);
      // the field clock: nine minutes, then the Return
      if (BR.clock && !S.ceasefire) {
        W.fieldClock -= dt;
        if (W.fieldClock <= 0) { W.fieldClock = 540; S.returns++; F.m13returns = S.returns; theReturn(); }
      }
    });
    const theReturn = () => {
      if (T.current === '2196') { ui.subtitle('m13pa', 'Field return. All posts, hold.', 2400); audio.sfxPlay('alarm'); }
      const list = IMPACTS.field; list.forEach(([x, z], i) => setTimeout(() => { if (BR.on) fireAt(x, z, 2.4); }, i * 260));
      if (S.returns === 1 && T.current === '2196') setTimeout(() => ui.subtitle('kai', 'Nine minutes on the clock, and the sky comes down on both sides at once.', 3400), 3200);
    };
    const barrage = (set, clock = true) => { BR.on = !!set; BR.set = set; BR.i = 0; BR.t = 3; BR.clock = clock; };

    // the Continuum gate stays shut until the Prefect opens it
    const gateBox = game.collision.add([-1.6, 0, -40.7], [1.6, 4.2, -39.9], { states: ['2196'] });
    // ---------- the field dome throws Kai back while the anchors hold ----------
    game.onUpdate(() => {
      if (T.current !== '2196' || !W.dome.visible || !game.control) return;
      const dx = pl.pos.x - SPIRE[0], dz = pl.pos.z - SPIRE[1], d = Math.hypot(dx, dz), r = DOME_R * W.dome.scale.x + 0.4;
      if (d < r && W.dome.scale.x > 0.2) {
        pl.pos.x = SPIRE[0] + dx / Math.max(d, 0.01) * (r + 0.6); pl.pos.z = SPIRE[1] + dz / Math.max(d, 0.01) * (r + 0.6);
        game.shake = 0.12; audio.sfxPlay('spark');
        if (once('domeToast' + Math.floor(game.time / 4))) ui.toast('THE FIELD THROWS YOU BACK', 1600);
      }
    });

    // ---------- collectibles: temporal shards ----------
    SHARDS.forEach(([x, y, z, era, where], i) => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), glowMat(0x7fe8ff, 3.2)); m.position.set(x, y, z); m.userData.noBatch = true; scene.add(m);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.01, 6, 32), glowMat(0x7fe8ff, 1.8)); m.add(halo); T.only(m, era);
      game.onUpdate((dt, t) => { m.rotation.y += dt * 1.4; halo.rotation.x = t; });
      game.interact({ pos: [x, y + 0.3, z], radius: 1.7, prompt: 'Take the temporal shard', states: [era], onUse: () => {
        m.userData.states = []; m.visible = false; S.shards++; F.shards = (F.shards || 0) + 1; F.m13shards = S.shards; audio.sfxPlay('anomaly');
        ev('Temporal shard ' + S.shards + '/5', 'Crystallised time, found ' + where + '. It keeps a slower beat than the war around it.', 'TEMPORAL SHARD · ' + S.shards + '/5'); void i;
      } });
    });
    // the Witness's notes, in Kai's handwriting
    const noteMat = new THREE.MeshStandardMaterial({ map: TEX.note(), roughness: 0.8, side: THREE.DoubleSide });
    const NOTES = [
      { era: '2049', pos: P.note1, mesh: [8.95, 1.15, 50.2, -Math.PI / 2], title: 'Note on the timetable', text: 'Tucked into the held tram timetable at the Sable stop, in Kai\'s own handwriting, older and shakier: "Break it. Whatever she tells you. — K."', bark: 'My handwriting again. He knew I\'d come this way.' },
      { era: '2026', pos: [-15.2, 1.2, 13.2], mesh: [-15.0, 0.96, 13.3, Math.PI / 2], title: 'Note on the site office desk', text: 'Under the pile schedule in the 2026 site office, the same hand: "They\'ll ask you to choose. You always choose them. That is how we got here. — K."', bark: 'Choose who? The people in the rain?' },
    ];
    NOTES.forEach(n => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), noteMat); m.position.set(n.mesh[0], n.mesh[1], n.mesh[2]); m.rotation.y = n.mesh[3]; scene.add(m); T.only(m, n.era);
      game.interact({ pos: n.pos, radius: 1.8, prompt: 'Read the note', states: [n.era], onUse: () => {
        m.userData.states = []; m.visible = false; S.notes++; F.m13notes = S.notes; audio.sfxPlay('pickup');
        ev(n.title, n.text, 'THE WITNESS\'S NOTES · ' + S.notes + '/2'); ui.subtitle('kai', n.bark, 3200);
        if (n.era === '2049') F.m13witnessNote = true;
      } });
    });
    // the held moments (2049)
    const MOMENTS = [
      { tag: 'cup', text: 'A woman in a rain shell has just let go of her coffee. The cup hangs a hand\'s width below her fingers, the coffee leaving it in one brown tongue. Her face has not caught up with the accident yet.', bark: 'Five days, and the cup still hasn\'t landed.' },
      { tag: 'courier', text: 'A courier mid-jump off the kerb, both feet in the air, his bag swung out behind him. The delivery tag reads 08:14 · SABLE ST 40 · LATE.', bark: 'Both feet off the ground. For five days.' },
      { tag: 'couple', text: 'Two people under one umbrella on the tram platform, one of them half-turned to say something. Rain hangs off the umbrella\'s rim in a row of beads that never fall.', bark: 'Whatever she was about to say, she\'s still about to say it.' },
      { tag: 'driver', text: 'The tram driver, hand on the controller, eyes on the platform. A gold stake has been driven through his console a hand\'s width from his fingers. He never saw who did it.', bark: 'Someone stood right here, in the held second, and drove that in next to him.' },
    ];
    MOMENTS.forEach(mo => {
      const h = held.find(q => q.tag === mo.tag); if (!h) return;
      const p = h.ch.root.position;
      game.interact({ pos: mo.tag === 'driver' ? [-15.0, 1.6, -7.4] : [p.x, p.y + 1.0, p.z], radius: mo.tag === 'driver' ? 2.2 : 1.9, prompt: 'Look closer', states: ['2049'], enabled: () => !S.freed, onUse: () => {
        S.held++; F.m13held = S.held; audio.sfxPlay('pickup');
        ev('Held: ' + ({ cup: 'the coffee', courier: 'the courier', couple: 'the umbrella', driver: 'the driver' }[mo.tag]), mo.text, 'THE HELD · ' + S.held + '/4');
        ui.subtitle('kai', mo.bark, 3000);
      } });
    });

    // ---------- optional: the camp (map board, manifesto, tally, talk to Sera / the fighters) ----------
    game.interact({ pos: P.mapBoard, radius: 1.9, prompt: 'Study Lasker\'s map', states: ['2196'], onUse: () => {
      F.m13map = true; audio.sfxPlay('pickup');
      ev('Lasker\'s map', 'A hand-drawn map of the Yards: the spire ringed in the plaza, three red crosses: "tram (in the still year?)", "the hole (when?)", "bridge". Lasker: "3 stakes. no way to reach 2."', 'UNWRITTEN CAMP');
      ui.subtitle('kai', 'He\'s found all three anchors. He just can\'t get to two of them.', 3000);
    } });
    game.interact({ pos: P.manifesto, radius: 2.2, prompt: 'Read the wall', states: ['2196'], onUse: () => {
      F.m13manifesto = true; ev('The Unwritten', 'Painted on the camp wall: "NO HISTORY IS FINAL. WE ARE THE ONES THEY DIDN\'T WRITE DOWN." The Unwritten want the Continuum\'s network of stabilizers broken, every one of them.', 'UNWRITTEN CAMP');
      ui.subtitle('kai', 'The Continuum wants one history. These people want none.', 2800);
    } });
    game.interact({ pos: P.tally, radius: 1.9, prompt: 'Read the battery tally', states: ['2196'], onUse: () => {
      S.tally = true; F.m13tally = true; audio.sfxPlay('pickup');
      ev('Tube 3 tally', 'The Lasker battery\'s chalk tally: "06:12 out ×4 (answering) · 06:21 in ×4 (their reply) · 06:21 out ×4 (answering) · 06:30 in ×4 ..." Every incoming salvo is answered at once. Every one arrives nine minutes after the last one went out.', 'UNWRITTEN CAMP');
      if (S.phase === 'truth') { S.evid.add('tally'); musicState.truth = S.evid.size; }
      ui.subtitle('kai', 'In, out. In, out. Nine minutes apart, like a heartbeat.', 2800);
    } });
    game.interact({ pos: [P.sera[0], 1.1, P.sera[2]], radius: 2.2, prompt: 'Talk to Sera', once: false, states: ['2196'], enabled: () => S.phase !== 'open' && S.phase !== 'camp' && near(P.sera[0], P.sera[2], 4) && !S.seraTalked, onUse: () => side(async () => {
      S.seraTalked = true; F.m13seraTalk = true; S.main = true; cine(true); faceEach(kai, sera);
      await ots(sera, kai, 1.0, 36);
      await game.talk([
        ['kai', 'You were in Block D4 a week ago. Now you\'re here.'],
        ['sera', 'People get caught between these two. Somebody has to walk them out of the middle.'],
        ['kai', 'And the Unwritten? You trust Lasker?'],
        ['sera', 'I trust him to hate the Continuum. That covers most days.'],
        ['sera', metSera ? 'And you. I still haven\'t decided about you.' : 'You, I haven\'t decided about.'],
      ]);
      sera.lookTarget = null; kai.lookTarget = null; sera.root.rotation.y = -Math.PI / 2; cine(false); S.main = false;
    }) });
    game.interact({ pos: [fighters[4].root.position.x, 1.1, fighters[4].root.position.z], radius: 2.0, prompt: 'Talk to the fighter', once: false, states: ['2196'], enabled: () => !S.fighterTalked && S.phase !== 'open', onUse: () => side(async () => {
      S.fighterTalked = true;
      await game.talk([
        ['m13fighter', 'You\'re him. The architect. My gran used to spit when she said your name.'],
        ['kai', 'What did she say I did?'],
        ['m13fighter', 'Built the first one. The machine that taught the Continuum how to hold a minute still.'],
      ]);
    }) });

    // =====================================================================================
    // OPENING: the held district, Sunday 24.10.2049, 05:52
    // =====================================================================================
    ui.missionTag('MISSION 13 · THE NINE-MINUTE WAR'); ui.show('hud', true);
    pl.place(...P.start); cp(P.start[0], P.start[1], P.start[2], P.start[3]);
    S.main = true; cine(true); lockMusic(null); audio.setTheme(null);
    await game.shot([16, 24, 94], [0, 4, 30], 0.01, { fov: 50 });
    await ui.fade(0, 2400);
    lockMusic('m13-held', 2);
    const cc = ui.chapterCard('ACT II · THE NINE-MINUTE WAR', 'The Nine-Minute War', 'Sable Yards · Rain City · Sunday 24.10.2049 · 05:52', 4600);
    await game.shot([9, 9, 76], [0, 3, 46], 6.5, { fov: 46 });
    await cc;
    await game.shot([4.2, 1.5, 61], [-8.2, 1.1, 55.4], 3.2, { fov: 36 });
    await game.shot([2.6, 1.7, 82.6], [0, 1.5, 78], 1.8, { fov: 40 });
    kai.lookTarget = V(0, 1.5, 60);
    await game.talk([
      [radioId, haleSide ? 'Varen. You\'re at the Sable cordon. Nobody goes past that tape. Nobody\'s come back out.' : 'Helix security. Step away from the Sable cordon, Dr. Varen. That district is closed.'],
      ['kai', F.m12witnessEscaped || F.metWitness ? 'The man from Chamber Two came this way. My band followed his signature here.' : 'Something with my signature walked in here. My band followed it.'],
      [radioId, haleSide ? 'The Yards stopped at 08:14 on Sunday and stayed stopped. Three hundred people in there. Rain\'s still in the air.' : 'The Yards have been held since 08:14 on the nineteenth. Three hundred residents. No one gets in.'],
      ['kai', 'Then I\'ll be the one who does.'],
    ]);
    kai.lookTarget = null;
    ev('The Sable Yards', 'Sunday 24.10.2049. A rail and tram district on Rain City\'s east side, held in a single second (08:14:00, 19.10) since the Zero Second: rain in the air, traffic and about three hundred residents stopped mid-step. Helix has cordoned it.', 'SABLE YARDS · 2049');
    cine(false); lockMusic(null); S.main = false;
    S.phase = 'open';
    objective('Walk into the held district · follow your band\'s signature north');
    hint(() => pl.pos.z > 70, 30, () => ui.subtitle('kai', 'Under the tape. North, where the band pulls.', 2400));
    await game.waitFor(() => pl.pos.z < 51.5 || (F.m13witnessNote && pl.pos.z < 56));
    await idle();

    // ---------- the band flares: a 2196 signature; the war ----------
    S.main = true; cine(true);
    kai.wristBoost = 8; audio.sfxPlay('anomaly');
    await game.shot([pl.pos.x + 2.2, 1.6, pl.pos.z - 1.6], [pl.pos.x, 1.2, pl.pos.z], 1.2, { fov: 40 });
    await game.say('m13band', 'Signature in field: K. Varen. State: 2196. Distance: here.');
    await game.say('kai', 'Here. And a hundred and forty-seven years from now.');
    T.unlocked = true; T.refreshHud();
    shiftPulse = 1; await T.switchTo('2196', { force: true, free: true, dur: 1400 });
    pl.place(...P.arrive96); setMood('m13-war'); S.war = true;
    await game.shot([-6, 14, 46], [0, 6, -4], 0.01, { fov: 52 });
    lockMusic('m13-war', 0.6);
    await game.shot([-3, 8.5, 40], [0, 9, -6], 4.6, { fov: 48 });
    W.tracer([SPIRE[0], 9, SPIRE[1]], [-4, 0.5, 42], 1.6, 7); W.tracer([SPIRE[0], 9, SPIRE[1]], [3, 0.5, -40], 1.6, 7);
    await game.say('m13pa', 'Sable line. Return in two minutes. Hold your positions.');
    await game.shot([4, 2.0, 49], [0, 5, 0], 2.6, { fov: 44 });
    await game.say('kai', 'A war. Where the interchange was, a war.');
    // the Unwritten find him
    const f0 = fighters[1]; f0.crouch = 0; f0.root.rotation.y = 0; f0.lookTarget = kai.head;
    fighters[0].crouch = 0; fighters[0].root.rotation.y = 0.3;
    await game.shot([P.arrive96[0] - 3.2, 1.7, P.arrive96[2] - 4.2], [P.arrive96[0], 1.5, P.arrive96[2]], 1.4, { fov: 40 });
    await game.say('m13fighter', 'Hands! Hands where I— Commander! It\'s him. It\'s Varen.');
    lockMusic('m13-camp', 1.2); S.phase = 'camp';
    await walkTo(lasker, [[-4.6, Y0, 56.4], [-1.6, Y0, 54.2]], 1.6); lasker.lookTarget = kai.head; kai.lookTarget = lasker.head;
    await game.shot([-3.4, 1.65, 51.6], [-1.6, 1.6, 54.2], 1.4, { fov: 36 });
    await game.say('lasker', 'The architect. Of all the mornings to walk into.');
    const seraWalk = walkTo(sera, [[5.2, Y0, 55.8], [2.6, Y0, 54.0]], 2.0);
    await game.shot([5.4, 1.7, 50.0], [1.6, 1.5, 54.2], 1.6, { fov: 42 });
    await seraWalk; sera.lookTarget = kai.head;
    await game.talk([
      ['sera', metSera ? 'Lower it, Dov. He walked out of Block D4 with me. He\'s owed one morning.' : 'Lower it, Dov. If he wanted us dead, all he\'d have to do is wait.'],
      ['lasker', 'That spire is the Continuum\'s stabilizer. It pins the Yards in one second. In your year, everyone\'s standing in the rain.'],
      ['kai', 'I walked through them. Three hundred people, held mid-step.'],
      ['sera', 'That\'s what it\'s for. At full charge it holds the whole district for good. A fixed point. Adair\'s word.'],
      ['lasker', 'So we break it. Every nine minutes it screams, the sky comes down on us, and we answer.'],
      ['kai', 'Answer who?'],
      ['lasker', 'Them. It\'s all shrapnel by the time it lands.'],
      ['sera', 'It\'s staked in three years, Kai. Dov\'s scouts can see the stakes. Nobody can reach them. You can.'],
    ]);
    F.m13metLasker = true;
    FX.show(true);
    await game.shot([-2.8, 1.7, 52.2], [-1.6, 1.6, 54.2], 1.0, { fov: 34 });
    await game.talk([
      ['lasker', 'Pull their stakes and the Unwritten owe you. Cross that yard on my smoke.'],
      ['kai', 'And then?'],
      ['lasker', 'Then we break the spire, and nobody gets to hold a minute still again.'],
    ]);
    FX.offer({ id: 'smoke', faction: 'unwritten', label: 'UNWRITTEN SMOKE', min: -1, uses: 1, why: 'SMOKE ONLY REACHES THE YARD', enabled: () => T.current === '2196' && pl.pos.z < 46 && pl.pos.z > -36,
      onCall: () => { const fw = V(Math.sin(pl.yaw), 0, Math.cos(pl.yaw)); for (let k = 0; k < 3; k++) W.smokeAt(pl.pos.x + fw.x * (3 + k * 6), pl.pos.z + fw.z * (3 + k * 6), 32); ui.subtitle('m13lasker', 'Smoke out. You\'ve got thirty seconds, architect.', 2600); F.m13smoke = (F.m13smoke || 0) + 1; } });
    ui.toast(game.touch?.enabled ? 'FACTION SUPPORT · TAP SUPPORT TO CALL IT' : 'FACTION SUPPORT · PRESS G TO CALL IT', 3200);
    sera.lookTarget = null; await game.shot([3.4, 1.6, 51.4], [2.6, 1.5, 54.0], 1.0, { fov: 36 });
    await game.talk([
      ['sera', 'Here. You left this with us in D4.'],
      ['kai', 'The displacer.'],
      ['sera', 'Tap to freeze them, hold to throw them back three seconds. Nobody dies on my side of the yard.'],
    ]);
    C.giveWeapon(); F.m13weapon = true;
    lasker.lookTarget = null; kai.lookTarget = null; f0.lookTarget = null; f0.crouch = 1; f0.root.rotation.y = Math.PI; fighters[0].crouch = 1; fighters[0].root.rotation.y = Math.PI;
    walkTo(lasker, [[P.lasker[0], Y0, P.lasker[2]]], 1.4).then(() => { lasker.root.rotation.y = -Math.PI / 2; });
    walkTo(sera, [[P.sera[0], Y0, P.sera[2]]], 1.4).then(() => { sera.root.rotation.y = -Math.PI / 2; });
    ev('The stabilizer', 'The Continuum\'s stabilizer stands where the Sable interchange was, in 2196. It holds the Yards in one second across their states; at full charge it would hold the district for good, a fixed point. Its field is staked in three years. The Unwritten under Dov Lasker want it broken.', 'THE WAR · 2196');
    cine(false); S.main = false; lockMusic(null); setMood('m13-camp');
    cp(2.5, Y0, 46.5, Math.PI);
    objective('Cross the yard to the interchange · through the barricade gap');
    hint(() => pl.pos.z > 44, 60, () => ui.subtitle('sera', 'The gap in the barricade, Kai. Low and fast. Watch where the red rings open.', 3200));

    // =====================================================================================
    // CROSS AN ACTIVE BATTLEFIELD
    // =====================================================================================
    await game.waitFor(() => pl.pos.z < 41.4);
    S.phase = 'cross'; setMood('m13-war'); barrage('south'); C.showHud(true);
    const post = [enemy(0, -4.2, 14.0, 0, '2196', { patrol: [[-4.2, 14.0], [-1.0, 14.0]], fov: 0.7 }), enemy(1, 4.8, 13.8, 0, '2196', { patrol: [[4.8, 13.8], [8.4, 13.8]], fov: 0.7 })];
    const keepersS = [enemy(2, -3, 37, Math.PI, '2049', { patrol: [[-3, 37], [-3, 22], [3.5, 22], [3.5, 37]], speed: 1.1, fov: 0.75 })];
    if (once('crossTip')) ui.subtitle('kai', 'The rings. Shells land where the red rings close. In the same places, in the same order.', 3600);
    cp(2.5, 0, 40.4, Math.PI);
    let crossCp = 0;
    const offCrossCp = game.onUpdate(() => {
      if (!game.control || game._failing) return;
      if (crossCp < 1 && pl.pos.z < 34 && T.current === '2196') { crossCp = 1; cp(pl.pos.x, groundY(pl.pos.x, pl.pos.z), pl.pos.z, Math.PI); ui.toast('CHECKPOINT', 1000); }
      if (crossCp < 2 && pl.pos.z < 26 && T.current === '2196') { crossCp = 2; cp(pl.pos.x, groundY(pl.pos.x, pl.pos.z), pl.pos.z, Math.PI); ui.toast('CHECKPOINT', 1000); }
    });
    hint(() => S.phase === 'cross' && pl.pos.z > 24, 70, () => ui.subtitle('kai', game.touch?.enabled ? 'Count the shells. Or slip into 2049 — the held street has only one Keeper. Or call Lasker\'s smoke: SUPPORT.' : 'Count the shells. Or slip into 2049 — the held street has only one Keeper. Or call Lasker\'s smoke: G.', 3800));
    hint(() => S.phase === 'cross' && pl.pos.z < 24 && !C.allDown(post), 55, () => ui.subtitle('kai', 'The post faces south. Stun one, the other will turn. Or go round them in the still year.', 3200));
    // Nell, under the balcony
    let nellCall = 0;
    const offNell = game.onUpdate(dt => {
      if (S.nell !== 'none' || T.current !== '2196' || !game.control) return;
      if (Math.hypot(pl.pos.x - P.nell[0], pl.pos.z - P.nell[2]) < 16) { nellCall -= dt; if (nellCall <= 0) { nellCall = 14; ui.subtitle('nell', 'Help — anyone! Under the balcony, west side!', 2600); } }
    });
    game.interact({ pos: [P.nell[0] + 0.6, 1.0, P.nell[2]], radius: 2.4, prompt: 'Talk to the trapped medic', once: false, states: ['2196'], enabled: () => S.nell === 'none' || S.nell === 'met', onUse: () => side(async () => {
      nell.lookTarget = kai.head; S.main = true; cine(true); kai.lookTarget = nell.head;
      await game.shot([P.nell[0] + 2.4, 1.2, P.nell[2] + 1.8], [P.nell[0], 0.8, P.nell[2]], 1.0, { fov: 40 });
      if (S.nell === 'none') {
        S.nell = 'met'; F.m13nell = 'met';
        await game.talk([
          ['nell', 'Don\'t pull at it — it\'s the only thing holding my leg together. Nell. Medic. Unwritten.'],
          ['kai', 'It\'s a balcony. A whole balcony.'],
          ['nell', 'Came off the wall in the last return. That wall\'s been standing since before your time. Don\'t ask me how it\'s still got balconies.'],
          ['kai', 'Before my time. Then I know when it went up.'],
        ]);
        ev('Nell Ashby', 'An Unwritten medic pinned under a fallen concrete balcony on the west side of Sable Street, no-man\'s land. The balcony was hung on that building in 2026; a scaffold stands there in the 2026 state.', 'SIDE · THE MEDIC');
        ui.toast('SIDE · FREE THE MEDIC (2026 OPENS LATER)', 2600);
      } else await game.say('nell', S.allow26 ? 'Whatever you\'re doing, do it in the year it was built.' : 'Still here. Not going anywhere, funnily enough.');
      nell.lookTarget = null; kai.lookTarget = null; cine(false); S.main = false;
    }) });
    // Nell, freed through 2026 (if Kai found her): the balcony's anchor bolts on the scaffold
    game.interact({ pos: [P.bolts[0], 1.2, P.bolts[2]], radius: 2.2, hold: 1.6, prompt: 'Back off the balcony\'s anchor bolts', states: ['2026'], enabled: () => S.nell === 'met' && S.allow26, onUse: () => {
      S.nell = 'freed'; F.m13nell = 'freed'; audio.sfxPlay('metal');
      W.bolts.forEach(b => { b.visible = false; }); W.balcony26.rotation.z = -0.25; W.balcony26.position.y = 0.4;
      W.nellSlab.visible = false; W.nellSlab.userData.states = []; W.nellSlabBox.enabled = false;
      ui.subtitle('m13worker', 'Oi! Who let the balcony down? It\'s not even grouted!', 2600);
      setTimeout(() => ui.subtitle('kai', 'It never goes up now. Not in 2049. Not in 2196.', 3000), 2800);
    } });
    game.onUpdate(() => {
      if (S.nell !== 'freed' || S.nellThanked || T.current !== '2196' || !game.control || S.busy || ui.dlgActive) return;
      if (!near(P.nell[0], P.nell[2], 6)) return;
      S.nellThanked = true;
      side(async () => {
        nell.pose = null; nell.crouch = 0; S.main = true; cine(true); faceEach(kai, nell);
        await ots(nell, kai, 1.0, 38);
        await game.talk([
          ['nell', 'The slab... it was never there. I\'m standing. Who— you did that.'],
          ['kai', 'The balcony never got hung. You\'re welcome.'],
          ['nell', 'I\'ll tell Dov. He owes you smoke. I owe you more than that.'],
        ]);
        nell.lookTarget = null; kai.lookTarget = null; cine(false); S.main = false;
        FX.adjust('unwritten', +1, 'You freed Nell'); F.seraTrust = (F.seraTrust || 0) + 1;
        const sm = FX.offers.find(o => o.id === 'smoke'); if (sm) sm.uses++; else FX.offer({ id: 'smoke', faction: 'unwritten', label: 'UNWRITTEN SMOKE', min: -1, uses: 1, enabled: () => T.current === '2196', onCall: () => { const fw = V(Math.sin(pl.yaw), 0, Math.cos(pl.yaw)); for (let k = 0; k < 3; k++) W.smokeAt(pl.pos.x + fw.x * (3 + k * 6), pl.pos.z + fw.z * (3 + k * 6), 32); } });
        ev('Nell Ashby, freed', 'Kai backed off the anchor bolts of a balcony being hung in 2026. It was never hung, so in 2196 it never fell on Nell. The Unwritten owe him; Lasker\'s battery gives him a second smoke screen.', 'SIDE · THE MEDIC');
        walkTo(nell, [[-6, Y0, 38], [2.5, Y0, 42.6], [6, Y0, 56]], 2.4).then(() => show(nell, false));
      });
    });
    // Senn, the loop-aware trooper pinned by Unwritten fire
    game.interact({ pos: [P.senn[0], 1.0, P.senn[2]], radius: 2.4, prompt: 'Talk to the pinned trooper', once: false, states: ['2196'], enabled: () => S.senn === 'none', onUse: () => side(async () => {
      S.main = true; cine(true); faceEach(kai, senn);
      await ots(senn, kai, 1.0, 38, 0.7);
      await game.talk([
        ['senn', 'Don\'t — I know. You\'re going to say "stay down". You did that already.'],
        ['senn', 'No — you\'re about to do it. I hate that I know the difference.'],
        ['kai', 'How many times have you lived this morning?'],
        ['senn', 'Since the spire? Forty. Fifty. Every return it throws me back here, behind this block, without my helmet.'],
      ]);
      const c = await choose('kai', 'The trooper is pinned between the lines.', ['Tell him when the shells land and walk him out', 'Leave him behind his block'], 0);
      if (c === 0) {
        S.senn = 'helped'; F.m13senn = 'helped';
        await game.talk([
          ['kai', 'They land in the same holes every time. Count three after the ring closes, then run. Left of the tram, not right.'],
          ['senn', 'Three, then left.'],
          ['senn', 'I\'ll tell the Prefect the architect counted for me. She won\'t believe it.'],
        ]);
        senn.crouch = 0; senn.lookTarget = null;
        walkTo(senn, [[16, Y0, 6], [14, Y0, -20], [4, Y0, -36]], 3.6).then(() => show(senn, false));
        FX.adjust('continuum', +1, 'You walked Senn out');
        FX.offer({ id: 'holdfire', faction: 'continuum', label: 'SENN\'S WORD · A POST HOLDS FIRE', min: 1, uses: 1, why: 'NO CONTINUUM POST NEAR YOU', enabled: () => T.current === '2196' && C.standing().some(e => e.char.root.position.distanceTo(pl.pos) < 22 && e.states?.includes('2196')),
          onCall: () => { const list = C.standing().filter(e => e.char.root.position.distanceTo(pl.pos) < 26 && e.states?.includes('2196')); for (const e of list) { e.enabled = false; e.char.speed = 0; } ui.subtitle('senn', 'Post, this is Senn. Let the architect through. Twenty seconds. Please.', 3000); F.m13holdFire = true; setTimeout(() => { for (const e of list) e.enabled = true; }, 20000); } });
        ev('Trooper Senn', 'Arvid Senn, Continuum trooper, twenty-four, loop-aware: "You did that already. No — you\'re about to do it. I hate that I know the difference." Kai talked him out between the shells. He promised the Prefect would hear about it.', 'SIDE · THE TROOPER');
      } else {
        S.senn = 'left'; F.m13senn = 'left';
        await game.say('senn', 'Right. You did that already, too.');
        senn.lookTarget = null;
      }
      cine(false); S.main = false;
    }) });

    // the forward post, or round it: Kai reaches the dome
    await game.waitFor(() => pl.pos.z < 17.5 && Math.abs(pl.pos.x - SPIRE[0]) < 20 && (T.current !== '2196' || C.allDown(post) || pl.pos.z < 13.5 || C.alerted().length === 0));
    await game.waitFor(() => pl.pos.z < 17.5 && !game._failing);
    await idle();
    offCrossCp(); F.m13crossed = true; F.m13crossRoute = T.current === '2049' ? 'held' : (F.m13smoke ? 'smoke' : 'open');
    FX.route('m13crossing', { unwritten: F.m13smoke ? 'smoke' : null }, F.m13crossRoute);
    S.main = true; cine(true); barrage(null);
    if (T.current !== '2196') { shiftPulse = 1; await T.switchTo('2196', { force: true, free: true }); }
    pl.place(Math.max(-8, Math.min(8, pl.pos.x)), Y0, 17.0, Math.PI);
    park(keepersS);
    await game.shot([7, 3.2, 20], [0, 6, -2], 2.6, { fov: 50 });
    audio.sfxPlay('spark'); game.shake = 0.1;
    await game.say('m13band', 'Field anchored in three states. One: 2049, the interchange. Two: 2026, masked. Three: 2196, Sable Bridge.');
    game.shake = 0;
    await game.shot([2.4, 1.6, 17.6], [0, 4, -2], 1.6, { fov: 40 });
    await game.talk([
      ['kai', 'Three stakes. The tram, the foundations, the bridge.'],
      ['kai', '2026 won\'t open while the held second sits on top of it. The tram first.'],
    ]);
    ev('Three anchors', 'Kai\'s band reads the stabilizer\'s field as staked in three states: 2049 at the held tram in the interchange, 2026 at the foundations (masked while the 2049 anchor holds), 2196 on Sable Bridge.', 'THE STABILIZER');
    cine(false); S.main = false;
    park(post.filter(e => e.state !== 'down'));

    // =====================================================================================
    // ANCHOR ONE: 2049, the held tram
    // =====================================================================================
    S.phase = 'anchor1'; barrage('plaza'); BR.clock = true;
    cp(0, Y0, 16.4, Math.PI);
    objective(game.touch?.enabled ? 'Anchor 1 · the gold stake in the held tram · switch to 2049' : 'Anchor 1 · the gold stake in the held tram · switch to 2049 (2)');
    const tramK = [enemy(2, -16, -1.9, Math.PI / 2, '2049', { patrol: [[-16, -1.9], [16, -1.9]], speed: 1.0, fov: 0.7, range: 10 }), enemy(3, 16, -14.6, -Math.PI / 2, '2049', { patrol: [[16, -14.6], [-17, -14.6], [-17, -8], [-17, -14.6]], speed: 1.0, fov: 0.7, range: 10 })];
    hint(() => S.phase === 'anchor1' && T.current === '2196', 40, () => ui.subtitle('kai', 'The tram\'s in 2049. Switch.', 2200));
    hint(() => S.phase === 'anchor1' && T.current === '2049', 70, () => ui.subtitle('kai', 'Two Keepers walk the still. The driver\'s cab is at the west end. Use the held people for cover, crouch.', 3400));
    let a1 = false;
    game.interact({ pos: [-15.2, 1.4, -8.2], radius: 2.1, hold: 2.2, prompt: 'Pull the gold stake from the driver\'s console', states: ['2049'], onUse: () => { a1 = true; } });
    await game.waitFor(() => a1);
    C.noise(V(-15.6, 0, -8), 30, 'stake', 6, tramK);
    S.anchors = 1; F.m13anchor49 = true; musicState.anchors = 1;
    await idle();
    S.main = true; cine(true);
    W.anchor49.stake.visible = false; W.anchor49.ring.visible = false;
    await game.shot([-17.6, 1.7, -5.8], [-14.4, 1.6, -7.4], 1.0, { fov: 38 });
    audio.sfxPlay('rewind'); game.shake = 0.08;
    // the held second slips: every drop falls a centimetre, the held twitch, then stop again
    const rp = W.heldRainPos; for (let i = 1; i < rp.length; i += 3) rp[i] -= 0.04; W.heldRain.geometry.attributes.position.needsUpdate = true;
    for (const h of held) { h.ch.frozen = false; h.hold = 0.12; }
    await game.wait(0.4);
    for (const h of held) h.ch.frozen = true;
    game.shake = 0;
    await game.say('kai', 'The rain moved. A centimetre. For everyone.');
    if (T.current === '2049') { await T.switchTo('2196', { force: true, free: true }); }
    pl.place(-17.2, Y0, -1.2, Math.PI * 0.75);
    await game.shot([-22, 6, 14], [0, 5, -2], 1.8, { fov: 50 });
    await tween(1.2, u => { W.dome.scale.setScalar(1 - u * 0.12); W.dome.material.opacity = 0.16 - u * 0.05; });
    await game.say('m13band', 'Anchor one released. 2026 signature: open. Foundations, under the interchange.');
    S.allow26 = true; ui.toast('2026 OPEN · THE FOUNDATIONS', 2400);
    await game.say('kai', 'The foundations. Whatever they pinned there, they pinned it before the concrete went in.');
    park(tramK); cine(false); S.main = false;

    // =====================================================================================
    // ANCHOR TWO: 2026, the foundation works
    // =====================================================================================
    S.phase = 'anchor2';
    cp(-17.2, Y0, -1.2, Math.PI * 0.75);
    objective(game.touch?.enabled ? 'Anchor 2 · the foundations · switch to 2026 inside the interchange' : 'Anchor 2 · the foundations · switch to 2026 inside the interchange (1)');
    hint(() => S.phase === 'anchor2' && T.current !== '2026', 40, () => ui.subtitle('kai', game.touch?.enabled ? '2026 is open. Tap the 2026 button.' : '2026 is open. Press 1.', 2200));
    await game.waitFor(() => T.current === '2026' && Math.abs(pl.pos.x) < 26 && pl.pos.z < 22 && pl.pos.z > -24);
    await idle();
    S.main = true; cine(true);
    foreman.lookTarget = kai.head;
    await game.shot([-14, 6, 18], [0, 1, -2], 2.4, { fov: 50 });
    await game.say('kai', 'Bare ground. Six pile cages and a crane. 2026, before there was anything to hold.');
    await walkTo(foreman, [[pl.pos.x - 2.4, Y0, pl.pos.z + 1.6]], 1.8); foreman.lookTarget = kai.head; kai.lookTarget = foreman.head;
    faceEach(kai, foreman); await ots(foreman, kai, 1.2, 36);
    await game.talk([
      ['m13foreman', 'Oi. Hard hat. Where did you come from? I\'ve had the gate locked since six.'],
      ['kai', 'Somebody fitted something into one of your pile cages. Gold. Not yours.'],
      ['m13foreman', 'The client\'s man. White suit, at dawn, didn\'t sign in. Told my lads not to touch it. It\'s on the schedule.'],
      ['m13foreman', 'I\'ve a pour at twenty past eleven. Whatever you\'re doing, do it before my concrete does.'],
    ]);
    F.m13foreman = true; foreman.lookTarget = null; kai.lookTarget = null;
    walkTo(foreman, [[-12.6, Y0, 9.2]], 1.4);
    cine(false); S.main = false; setMood('m13-war');
    objective('Find the client\'s fitting · the pile schedule in the site office · the crane panel');
    game.checkpoint(pl.pos.x, Y0, pl.pos.z, pl.yaw);
    // the cage that hums in Residue Vision
    const hum = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 8, 32), glowMat(0xffd27a, 2.6)); hum.rotation.x = Math.PI / 2; hum.position.set(CAGES[ANCHOR_CAGE][0], 0.4, CAGES[ANCHOR_CAGE][1]); scene.add(hum); game.residue(hum); T.only(hum, '2026');
    game.onUpdate((dt, t) => { hum.scale.setScalar(1 + Math.sin(t * 3) * 0.08); });
    game.interact({ pos: P.pileBoard, radius: 2.0, prompt: 'Read the pile schedule', states: ['2026'], onUse: () => {
      S.pileRead = true; F.m13pileSchedule = true; audio.sfxPlay('pickup');
      ev('Pile schedule', 'Sable Yards Interchange, foundation works: six Ø900 pile cages, C-1 to C-6 (north row C-1 C-2 C-3, south row C-4 C-5 C-6). Five "checked". C-5: "CLIENT FITTING · DO NOT MOVE".', 'SITE OFFICE · 2026');
      ui.subtitle('kai', 'C-5. South row, the middle one. Right under where the spire will stand.', 3000);
    } });
    game.interact({ pos: P.deliveryNote, radius: 1.8, prompt: 'Read the delivery note', states: ['2026'], onUse: () => {
      F.m13delivery = true; audio.sfxPlay('pickup');
      ev('Delivery note', '14.04.2026, 05:48. "Additional fitting supplied by client, installed in cage C-5 by client\'s contractor. Gold-finish, approx. 1.4 m. Not to be moved. Signed: —". There is no client contractor on the site register.', 'SITE OFFICE · 2026');
    } });
    hint(() => S.phase === 'anchor2' && !S.pileRead, 60, () => ui.subtitle('kai', 'The site office, west side. Builders write everything down.', 2600));
    hint(() => S.phase === 'anchor2' && S.pileRead && !S.cageUp, 60, () => ui.subtitle('kai', game.touch?.enabled ? 'The crane panel by the mast, east side. Lift C-5. Residue Vision shows the hum too.' : 'The crane panel by the mast, east side. Lift C-5. Residue Vision (F) shows the hum too.', 3200));
    let craneBusy = false;
    game.interact({ pos: [P.cranePanel[0] - 0.4, 1.1, P.cranePanel[2] + 0.4], radius: 2.0, prompt: 'Work the crane panel', once: false, states: ['2026'], enabled: () => !S.cageUp && !craneBusy, onUse: () => side(async () => {
      craneBusy = true;
      const c = await choose('kai', 'The crane panel. Which cage do you lift?', ['C-1', 'C-2', 'C-3', 'C-4', 'C-5', 'C-6'], ANCHOR_CAGE);
      const [cx, cz] = CAGES[c], cg = W.cages[c];
      audio.sfxPlay('metal'); S.main = true; cine(true);
      game.shot([cx + 5.5, 4.6, cz + 9.0], [cx, 2.2, cz], 1.4, { fov: 46 });
      await tween(1.6, u => W.setHook(cx * u, -2 + (cz + 2) * u, 6 - u * 4.2));
      await tween(2.0, u => { cg.position.y = cg.userData.home.y + u * 3.6; W.setHook(cx, cz, 1.8 + u * 3.6); });
      if (c === ANCHOR_CAGE) {
        S.cageUp = true; F.m13cage = 'C-' + (c + 1); audio.sfxPlay('success');
        ui.subtitle('kai', 'There. Gold, through the middle of the cage. Pinned before the concrete.', 3000);
      } else {
        S.craneMiss++; F.m13craneMisses = S.craneMiss;
        ui.subtitle('m13worker', ['Oi! That\'s C-' + (c + 1) + ', mate, put it back!', 'Who\'s on the crane? Not that one!'][S.craneMiss % 2], 2400);
        await game.wait(1.6);
        ui.subtitle('kai', S.craneMiss > 1 ? 'Steel and tie wire. The schedule said C-5.' : 'Steel and tie wire. Not this one.', 2600);
        await tween(1.8, u => { cg.position.y = cg.userData.home.y + (1 - u) * 3.6; W.setHook(cx, cz, 5.4 - u * 3.6); });
      }
      if (c === ANCHOR_CAGE) await game.wait(1.6);
      cine(false); S.main = false; craneBusy = false;
    }) });
    await game.waitFor(() => S.cageUp);
    objective('Pull the client\'s fitting from cage C-5 · the pit edge');
    let a2 = false;
    game.interact({ pos: [P.cageEdge[0], 1.4, P.cageEdge[2]], radius: 2.2, hold: 2.0, prompt: 'Pull the gold fitting out of the cage', states: ['2026'], onUse: () => { a2 = true; } });
    await game.waitFor(() => a2);
    S.anchors = 2; F.m13anchor26 = true; musicState.anchors = 2;
    await idle();
    S.main = true; cine(true);
    W.anchor26.spike.visible = false; W.anchor26.ring.visible = false; hum.visible = false; hum.userData.states = [];
    await game.shot([3.2, 2.6, 9.2], [0, 2.4, 2], 1.0, { fov: 40 });
    await game.say('m13foreman', 'What was that? What did you just take out of my cage?');
    await game.say('kai', 'Something that would have stood here for a hundred and seventy years.');
    await T.switchTo('2196', { force: true, free: true });
    pl.place(2.0, Y0, 16.4, Math.PI);
    await game.shot([14, 5, 22], [0, 5, -2], 1.6, { fov: 50 });
    await tween(1.4, u => { W.dome.scale.setScalar(0.88 - u * 0.2); W.dome.material.opacity = 0.11 - u * 0.04; });
    await game.say('m13pa', 'Stabilizer field at one third. Sable line, report. Bridge post, hold the stake.');
    await game.say('m13band', 'Anchor two released. One remains: 2196, Sable Bridge.');
    cine(false); S.main = false;

    // =====================================================================================
    // ANCHOR THREE: 2196, Sable Bridge
    // =====================================================================================
    S.phase = 'anchor3'; barrage('bridge'); setMood('m13-war');
    cp(14, Y0, 12, -Math.PI / 2);
    objective('Anchor 3 · the pylon on Sable Bridge · 2196');
    const bridgeE = [
      enemy(0, 29.6, -2.0, -Math.PI / 2, '2196', { patrol: [[29.6, -2.0]], fov: 0.8, range: 15 }),
      enemy(1, 29.6, 2.0, -Math.PI / 2, '2196', { patrol: [[29.6, 2.0]], fov: 0.8, range: 15 }),
      enemy(4, 33.0, 0, -Math.PI / 2, '2196', { patrol: [[33.0, 0]], kind: 'officer', shield: true, fov: 0.9, range: 16, name: 'CONTINUUM OFFICER' }),
    ];
    hint(() => S.phase === 'anchor3' && pl.pos.x < 24, 70, () => ui.subtitle('kai', 'Three on the bridge, all facing west. The held bridge in 2049 has a walkway on the north side. Come up behind them.', 3600));
    hint(() => S.phase === 'anchor3' && pl.pos.x > 24, 60, () => ui.subtitle('kai', 'The officer\'s shield only faces one way. Behind him, or throw him back with a held shot.', 3200));
    let a3 = false;
    game.interact({ pos: [35, 1.4, 1.0], radius: 2.2, hold: 2.4, prompt: 'Unseat the bridge stake', states: ['2196'], onUse: () => { a3 = true; } });
    let bridgeCp = false;
    const offBCp = game.onUpdate(() => { if (!bridgeCp && pl.pos.x > 27 && game.control && !game._failing && C.alerted().length === 0) { bridgeCp = true; cp(pl.pos.x, Y0, pl.pos.z, Math.PI / 2); } });
    await game.waitFor(() => a3);
    offBCp();
    F.m13bridgeRoute = F.m13holdFire ? 'senn' : C.allDown(bridgeE) ? 'cleared' : 'stake';
    S.anchors = 3; F.m13anchor96 = true; musicState.anchors = 3;
    await idle();
    S.main = true; cine(true); barrage(null);
    park(bridgeE);
    W.anchor96core.visible = false;
    await game.shot([39, 2.2, 6], [35, 2, 0], 1.0, { fov: 40 });
    audio.sfxPlay('rewind');
    await game.shot([36, 9, 14], [0, 6, -2], 2.0, { fov: 52 });
    await tween(1.6, u => { W.dome.scale.setScalar(0.68 * (1 - u)); W.dome.material.opacity = 0.07 * (1 - u); });
    W.dome.visible = false; W.dome.userData.states = [];
    audio.sfxPlay('boom'); game.shake = 0.18; await game.wait(0.6); game.shake = 0;
    await game.say('m13band', 'Field anchors: none. Stabilizer core exposed.');

    // =====================================================================================
    // RECOGNISE THAT BOTH FACTIONS ARE REACTING TO THEIR OWN PREVIOUS ATTACKS
    // =====================================================================================
    pl.place(30, Y0, 1.6, -Math.PI / 2);
    lockMusic('m13-silence', 1.2);
    await game.shot([28.4, 1.7, 3.6], [0, 3, 10], 1.6, { fov: 44 });
    await game.say('kai', 'Both lines are quiet. Nobody\'s reloading. Nobody\'s firing.');
    // and still a salvo comes, out of the ring
    for (const [x, z] of [[-4, 42], [5, 41.6], [-1, 43], [3, 42.4]]) W.tracer([SPIRE[0], 9, SPIRE[1]], [x, 0.5, z], 1.8, 6);
    await game.shot([16, 10, 18], [0, 6, 20], 1.8, { fov: 54 });
    audio.sfxPlay('boom'); game.shake = 0.1;
    await game.wait(0.4); game.shake = 0;
    for (const [x, z] of [[-5, -40.6], [4, -40.2]]) W.tracer([SPIRE[0], 9, SPIRE[1]], [x, 1, z], 1.4, 4);
    await game.wait(1.4); audio.sfxPlay('boom');
    await game.shot([24, 2.0, 4], [0, 8, -2], 1.4, { fov: 40 });
    await game.talk([
      ['kai', 'Nobody fired. I was watching both lines. Nobody fired.'],
      ['kai', 'It came out of the ring.'],
    ]);
    cine(false); S.main = false; lockMusic(null);
    S.phase = 'truth'; setMood('m13-truth'); barrage('field', true);
    if (W.fieldClock > 200) W.fieldClock = 200;
    objective(game.touch?.enabled ? 'Find out where the shells come from · Residue Vision (eye button) · both lines, the ring' : 'Find out where the shells come from · Residue Vision (F) · both lines, the ring');
    cp(26, Y0, 1.6, -Math.PI / 2);
    // E1: the Unwritten round inside the Unwritten line
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 8), W.mats.graphite); fin.position.set(P.e1[0], 0.35, P.e1[2]); fin.rotation.z = 0.6; scene.add(fin); T.only(fin, '2196');
    game.interact({ pos: [P.e1[0], 1.0, P.e1[2]], radius: 2.0, prompt: 'Examine the dud round', states: ['2196'], enabled: () => S.phase === 'truth', onUse: () => {
      S.evid.add('round'); musicState.truth = S.evid.size; audio.sfxPlay('pickup'); F.m13evRound = true;
      ev('The dud round', 'A mortar round stuck nose-down inside the Unwritten\'s own barricade. The tail fin is stamped "LASKER BTY · T3 · 0412": an Unwritten round, from their own tube three, that landed on the Unwritten.', 'THE NINE-MINUTE WAR');
      ui.subtitle('kai', 'Lasker\'s stamp. His own round, in his own wall.', 2800);
    } });
    // E2: the Continuum bolt scorch on the Continuum barrier
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: TEX.scorch(), transparent: true, depthWrite: false })); sc.position.set(P.e2[0], 0.75, -39.85); scene.add(sc); T.only(sc, '2196');
    const boltEcho = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glowMat(0xffd27a, 3)); boltEcho.position.set(P.e2[0], 1.0, -38); scene.add(boltEcho); game.residue(boltEcho); T.only(boltEcho, '2196');
    game.onUpdate((dt, t) => { const k = (t * 0.45) % 1; boltEcho.position.set(P.e2[0] + (SPIRE[0] - P.e2[0]) * (1 - k), 1 + Math.sin(k * Math.PI) * 6, -39.4 + (SPIRE[1] + 39.4) * (1 - k)); });
    game.interact({ pos: [P.e2[0], 1.0, -38.6], radius: 2.2, prompt: 'Read the scorch on the pearl', states: ['2196'], enabled: () => S.phase === 'truth', onUse: () => {
      S.evid.add('scorch'); musicState.truth = S.evid.size; audio.sfxPlay('pickup'); F.m13evScorch = true;
      ev('The scorch on the pearl', 'A Continuum stun bolt burned into the Continuum\'s own barrier, on the side facing the spire. In Residue Vision its echo arrives out of the spire\'s ring, not from the south: the Continuum\'s own salvo, coming home.', 'THE NINE-MINUTE WAR');
      ui.subtitle('kai', game.residueOn ? 'Their own gold. Coming out of the ring, not from the Unwritten.' : 'Their own gold, on their own wall. Residue Vision — where did it come from?', 3000);
    } });
    // E3: the return ring in Residue Vision: shells go in, the same shells come out nine minutes later
    const ringEcho = new THREE.Group(); scene.add(ringEcho); game.residue(ringEcho); T.only(ringEcho, '2196');
    const shellM = glowMat(0xff8f6a, 3), shellG = glowMat(0xffd27a, 3);
    const echoShells = [];
    for (let k = 0; k < 4; k++) { const a = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), shellM); ringEcho.add(a); const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), shellM); ringEcho.add(b); echoShells.push([a, b, k]); }
    const lbl = (txt, x, y, z) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.sign(txt, '', 'rgba(0,0,0,0)', '#ffd27a', 'lbl'), transparent: true, depthTest: false, toneMapped: false })); s.scale.set(2.6, 0.8, 1); s.position.set(x, y, z); ringEcho.add(s); };
    lbl('IN 06:12:00', -3, 11.5, 6); lbl('OUT 06:21:00', 3, 11.5, 6);
    game.onUpdate((dt, t) => {
      for (const [a, b, k] of echoShells) {
        const u = ((t * 0.3) + k * 0.25) % 1;
        a.position.set(-2 + k * 1.2 + (SPIRE[0] - (-2 + k * 1.2)) * u, 1 + Math.sin(u * Math.PI) * 10 + u * 8, 42 + (SPIRE[1] - 42) * u);   // in, from the Unwritten line
        b.position.set(SPIRE[0] + (-2 + k * 1.2 - SPIRE[0]) * u, 9 + Math.sin(u * Math.PI) * 6 - u * 8.5, SPIRE[1] + (42 - SPIRE[1]) * u);   // out, back onto it
      }
    });
    game.interact({ pos: [P.e3[0], 1.2, P.e3[2]], radius: 2.6, prompt: 'Watch the ring in Residue Vision', states: ['2196'], enabled: () => S.phase === 'truth' && game.residueOn, onUse: () => {
      S.evid.add('ring'); musicState.truth = S.evid.size; audio.sfxPlay('pickup'); F.m13evRing = true;
      ev('The return ring', 'In Residue Vision the ring around the spire swallows four Unwritten shells at 06:12:00 and throws the same four out again at 06:21:00, back the way they came. It does the same to the Continuum\'s bolts. Nothing fired at the spire ever reaches it: it comes home nine minutes later.', 'THE NINE-MINUTE WAR');
      ui.subtitle('kai', 'In at twelve past. Out at twenty-one past. The same four shells.', 3000);
    } });
    game.interact({ pos: [P.e3[0], 1.2, P.e3[2]], radius: 2.6, prompt: 'Look at the ring', once: false, states: ['2196'], enabled: () => S.phase === 'truth' && !game.residueOn && !S.evid.has('ring'), onUse: () => { ui.subtitle('kai', game.touch?.enabled ? 'Just a gold hoop, turning. Residue Vision — the eye.' : 'Just a gold hoop, turning. Residue Vision. F.', 2400); } });
    hint(() => S.phase === 'truth' && S.evid.size < 3, 70, () => ui.subtitle('kai', !S.evid.has('ring') ? 'The ring first. South of the spire, in Residue Vision.' : !S.evid.has('round') ? 'Something stuck in the Unwritten barricade. Their side of it.' : 'The Continuum\'s barrier. Where their own bolts hit.', 3000));
    await game.waitFor(() => S.evid.has('round') && S.evid.has('scorch') && S.evid.has('ring'));
    await idle();
    // the deduction
    S.main = true; cine(true); setResidueOff();
    await game.shot([pl.pos.x + 1.8, 1.7, pl.pos.z + 1.8], [pl.pos.x, 1.5, pl.pos.z], 1.0, { fov: 40 });
    const QS = [
      ['The shells that land on the Unwritten barricade at 06:21 —', ['The Continuum fires them', 'The Unwritten fired them, nine minutes earlier', 'The spire makes its own'], 1,
        ['They\'re stamped tube three. Lasker\'s own.', '', 'The ring makes nothing. It swallowed four shells at 06:12 and gave the same four back.']],
      ['So why does it never stop?', ['Each side answers its own returned fire', 'Adair wants the war to go on', 'The district resets every nine minutes'], 0,
        ['', 'She\'s logging the same nine minutes he is. Neither of them is winning anything.', 'Nothing resets. The tally keeps counting. Only the shells come back.']],
      ['Then what breaks it?', ['Silence the Unwritten guns for good', 'One loop where nobody fires', 'Destroy the return ring'], 1,
        ['Then the Continuum\'s own bolts come home and they blame the silence.', '', 'With the anchors gone the ring is the stabilizer. Break it now and nobody gets a choice.']],
    ];
    for (const [q, opts, right, why] of QS) {
      for (;;) {
        const c = await choose('kai', q, opts, right);
        if (c === right) { audio.sfxPlay('success'); break; }
        S.deduceMiss++; F.m13deductionMisses = S.deduceMiss; audio.sfxPlay('fail');
        await game.say('kai', why[c] || 'No. Look at it again.');
      }
    }
    S.recognized = true; F.m13recognized = true; musicState.truth = 4;
    await game.say('kai', 'They\'re not fighting each other. They\'re fighting themselves, nine minutes ago.');
    ev('The nine-minute war', 'The stabilizer\'s return ring catches everything fired at it and throws it back where it came from nine minutes later. Each side is shelled by its own previous salvo, takes it for the enemy\'s, and answers at once, which arrives nine minutes later on itself. One loop with nobody firing would break it.', 'THE NINE-MINUTE WAR');
    cine(false); S.main = false;

    // =====================================================================================
    // BOTH SIDES: Lasker (south) and Adair (north) hold fire for one loop
    // =====================================================================================
    S.phase = 'talks';
    objective('Get both sides to hold fire for one loop · Lasker in the camp · Adair behind the Continuum line');
    cp(0, Y0, 22, 0);
    game.interact({ pos: [P.lasker[0] + 0.8, 1.2, P.lasker[2]], radius: 2.6, prompt: 'Talk to Lasker', once: false, states: ['2196'], enabled: () => S.phase === 'talks' && !S.laskerOk, onUse: () => side(async () => {
      S.main = true; cine(true); faceEach(kai, lasker);
      await ots(lasker, kai);
      await game.say('lasker', 'You pulled all three. Now break it, before Adair works out how to re-stake it.');
      for (;;) {
        const opts = ['Show him his own round', 'Tell him the Continuum is behind the returns', FX.get('unwritten') >= 1 ? 'Ask him for one loop of silence, on your word' : 'Ask him for one loop of silence'];
        const c = await choose('kai', 'Lasker has to hold fire for nine minutes.', opts, 0);
        if (c === 0) {
          await game.talk([
            ['kai', 'This was in your barricade. Tube three. Round four-one-two.'],
            ['lasker', '...That\'s my stamp.'],
            ['kai', 'Your round went into the ring at twelve past and came out on you at twenty-one. And you answered it.'],
            ['lasker', 'And they answered that. And we answered them.'],
            ['lasker', 'Nine minutes. One loop. If the sky comes down on us anyway, architect, I\'ll put you under it.'],
          ]);
          FX.adjust('unwritten', +1, 'Lasker saw his own round'); break;
        } else if (c === 1) {
          await game.say('lasker', 'Then we hit them harder. Thank you for the encouragement.');
          FX.adjust('unwritten', -1, 'You fed Lasker\'s war'); F.m13laskerLie = true;
          await game.say('kai', 'No. That\'s not what I meant. Look at this.');
        } else {
          if (FX.get('unwritten') >= 1) {
            await game.talk([['kai', 'Nine minutes. Nobody fires. If I\'m wrong, you lose nothing but a loop.'], ['lasker', 'Nell says you\'re worth a loop. One. Then the guns.']]);
            break;
          }
          await game.say('lasker', 'On your word? Your word ended the world, Varen. Show me something.');
        }
      }
      S.laskerOk = true; F.m13laskerHolds = true; lasker.lookTarget = null; kai.lookTarget = null; lasker.root.rotation.y = -Math.PI / 2;
      ui.subtitle('m13lasker', 'All tubes, Lasker. Hold fire. You heard me. Hold.', 2600);
      cine(false); S.main = false;
    }) });
    // the Continuum gate: the sentries stop him, then the Prefect lets him through
    game.interact({ pos: [0, 1.2, -38.8], radius: 2.6, prompt: 'Ask for the Prefect at the gate', once: false, states: ['2196'], enabled: () => S.phase === 'talks' && !S.adairOpen, onUse: () => side(async () => {
      S.main = true; cine(true);
      await game.shot([3.4, 2.2, -35.6], [0, 1.6, -41], 1.0, { fov: 40 });
      await game.talk([
        ['m13keeper', 'That\'s far enough, architect.'],
        ['prefect', F.m10done ? 'Let him through. I want to see which version of him this is.' : 'Let him through. I\'ve been waiting a long time to meet this one.'],
      ]);
      S.adairOpen = true; gateBox.enabled = false;
      cine(false); S.main = false;
      objective('Get both sides to hold fire for one loop · the Prefect\'s pavilion');
    }) });
    game.interact({ pos: P.contLog, radius: 1.8, prompt: 'Read the Continuum fire record', states: ['2196'], enabled: () => S.adairOpen, onUse: () => {
      S.evid.add('log'); F.m13contLog = true; audio.sfxPlay('pickup');
      ev('Sable line fire record', 'The Continuum\'s own record: "06:15:00 OUT salvo 212 · 06:24:00 IN 4 rounds, origin S · 06:24:00 OUT salvo 213 · 06:33:00 IN ..." The interval between every OUT and the next IN is exactly 09:00:00. They log it as Unwritten fire.', 'CONTINUUM PAVILION');
      ui.subtitle('kai', 'Exactly nine minutes, every time. She\'s been writing it down for weeks.', 3000);
    } });
    game.interact({ pos: [0, 1.4, -58.6], radius: 2.6, prompt: 'Talk to the Prefect', once: false, states: ['2196'], enabled: () => S.phase === 'talks' && S.adairOpen && !S.adairOk, onUse: () => side(async () => {
      S.main = true; cine(true); faceEach(kai, adair);
      await ots(adair, kai);
      await game.talk([
        ['prefect', F.m10released ? 'Varen. Last time you emptied my loop cells. Now my anchors.' : F.m10done ? 'Varen. You walked out of Block D4. Now you walk into my command.' : 'Kai Varen. Every version of you ends up in front of me eventually.'],
        ['prefect', 'Without the stakes the spire holds nothing. You\'ve made it a target. Both sides will want it now.'],
      ]);
      if (S.senn === 'helped') await game.say('prefect', 'Trooper Senn says you counted the shells for him. I didn\'t believe him.');
      await ots(kai, adair, 0.8, 38);
      for (;;) {
        const opts = ['Show her her own fire record', 'Threaten to break the spire if she fires', FX.get('continuum') >= 1 ? 'Ask her for one loop, for Senn' : 'Ask her for one loop'];
        const c = await choose('kai', 'Adair has to hold fire for nine minutes.', opts, 0);
        if (c === 0) {
          await game.talk([
            ['kai', 'Your record. Out at fifteen past. In at twenty-four past. Every time, nine minutes.'],
            ['prefect', 'The Unwritten keep a steady rhythm.'],
            ['kai', 'Origin south. Your bolts. Your gold. Your scorch on your wall. The ring is sending your own fire back to you.'],
            ['prefect', '...The Continuum built the ring to keep the spire safe.'],
            ['kai', 'It kept it safe. It\'s been keeping you at war with yourselves.'],
            ['prefect', 'One loop. Nine minutes of nothing. If anything lands on my line, Varen, I will hold you responsible in every version.'],
          ]);
          FX.adjust('continuum', +1, 'Adair read her own record'); break;
        } else if (c === 1) {
          await game.say('prefect', 'Then I fire on you first. Try again, architect.');
          FX.adjust('continuum', -1, 'You threatened the Prefect'); F.m13adairThreat = true;
        } else {
          if (FX.get('continuum') >= 1) { await game.talk([['kai', 'You owe Senn his next morning. Give him one where nobody fires.'], ['prefect', 'One loop. For the boy. Then we see.']]); break; }
          await game.say('prefect', 'The Continuum does not stop because a man asks politely. Show me why.');
        }
      }
      S.adairOk = true; F.m13adairHolds = true; adair.lookTarget = null; kai.lookTarget = null;
      ui.subtitle('m13pa', 'Sable line. Hold fire. Repeat: hold fire for one return.', 2800);
      cine(false); S.main = false;
    }) });
    hint(() => S.phase === 'talks' && !S.laskerOk && !S.adairOk, 90, () => ui.subtitle('kai', 'Lasker in the camp, south. Adair behind the pearl line, north. Both of them.', 3000));
    await game.waitFor(() => S.laskerOk && S.adairOk);
    await idle();

    // =====================================================================================
    // THE CEASEFIRE: one loop with nobody firing
    // =====================================================================================
    S.main = true; cine(true);
    W.fieldClock = Math.min(W.fieldClock, 14); BR.set = null;
    pl.place(0, Y0, 22, Math.PI);
    lockMusic('m13-silence', 1.4);
    await game.shot([10, 7, 30], [0, 3, -2], 2.4, { fov: 52 });
    await game.say('kai', 'The last thing either of them fired is still in the ring. It has to come back first.');
    const ret0 = S.returns; BR.clock = true;
    await game.waitFor(() => S.returns > ret0);
    await game.wait(3.2);
    S.ceasefire = true; F.m13ceasefire = true; BR.on = false;
    W.clockCanvas && (() => { const g = W.clockCanvas.getContext('2d'); g.fillStyle = '#0c0c10'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#e6e8ea'; g.font = '700 58px sans-serif'; g.textAlign = 'center'; g.fillText('—:——', 128, 68); W.clockTex.needsUpdate = true; })();
    audio.silence(3);
    await game.shot([4, 1.6, 40], [0, 2.6, 0], 3.0, { fov: 42 });
    for (const f of fighters) { f.crouch = 0; f.root.rotation.y = Math.PI; }
    await game.say('m13fighter', '...Nothing. Nothing\'s coming.');
    await game.shot([0, 3, -32], [0, 2, 0], 2.2, { fov: 46 });
    ui.subtitle('m13pa', 'Sable line. No return. I repeat: no return.', 3000);
    await game.wait(2.6);
    ev('One loop of silence', 'Both sides held fire for one loop. The last returned salvo landed, and then nothing came back. The field clock stopped. For the first time since the spire went up, the Sable Yards were quiet.', 'THE NINE-MINUTE WAR');
    // Sera walks him to the spire: the quote
    show(sera, true); sera.root.position.set(-1.2, Y0, 21); sera.root.rotation.y = Math.PI; sera.lookTarget = null;
    pl.place(0.8, Y0, 20.4, Math.PI);
    await game.shot([3.4, 1.7, 17.2], [0, 1.6, 21], 1.6, { fov: 40 });
    await game.say('sera', 'Listen to that.');
    await game.shot([-3.6, 2.4, 26], [0, 5, -2], 2.6, { fov: 48 });
    kai.lookTarget = V(0, 6, -2);
    await game.say('kai', 'The ruins. The craters. Your people living in the cracks. So this is the future.');
    sera.lookTarget = kai.head; kai.lookTarget = sera.head;
    await game.shot([2.0, 1.66, 19.0], [-1.2, 1.62, 21], 1.4, { fov: 32 });
    audio.silence(1.2);
    await game.say('sera', 'This is not the future.');
    await game.shot([-2.6, 1.66, 22.6], [0.8, 1.62, 20.4], 1.2, { fov: 32 });
    await game.say('kai', 'What is it, then?');
    await game.shot([1.6, 1.62, 18.8], [-1.2, 1.64, 21], 1.6, { fov: 28 });
    await game.say('sera', 'The future that survives long enough to remember us.');
    F.m13quote = true;
    await game.wait(1.0);
    sera.lookTarget = null; kai.lookTarget = null;
    cine(false); S.main = false; lockMusic('m13-choice', 2.0);
    S.phase = 'spire';
    objective('Climb the stabilizer · the heart');
    cp(0, Y0, 14, Math.PI);
    walkTo(sera, [[-1.6, Y0, 12], [-1.4, 2.4, 4.6]], 1.4);
    await game.waitFor(() => pl.pos.y > 2.2 && pl.pos.z < 6.5 && Math.abs(pl.pos.x) < 6);
    await idle();

    // =====================================================================================
    // THE CHOICE: destroy the stabilizer, or redirect its energy to free the held
    // =====================================================================================
    S.main = true; cine(true);
    pl.place(0.8, 2.4, 4.6, Math.PI);
    sera.root.position.set(-1.4, 2.4, 4.6); sera.lookTarget = kai.head;
    await game.shot([2.6, 4.2, 7.4], [0, 3.6, 1.0], 1.8, { fov: 44 });
    await game.say('m13band', 'Stabilizer charge: ninety-four percent. Held population, 2049: three hundred and twelve.');
    await game.shot([-2.4, 3.6, 7.0], [0.4, 3.4, 1.4], 1.4, { fov: 38 });
    await game.talk([
      ['sera', 'Every joule it took to hold them is in that heart. Turn it around and give it back. Let them walk.'],
      ['kai', 'If I redirect it, the spire stays standing. Adair keeps it.'],
      ['sera', 'Then she keeps an empty spire.'],
      ['m13lasker', 'Varen. I can see you up there. Break it. Or it\'ll be holding another district by winter.'],
    ]);
    if (F.m13witnessNote) await game.say('kai', '"Break it. Whatever she tells you." He knew she\'d be standing here.');
    else await game.say('kai', 'Break it, and nobody ever holds a district with it again. Free them, and it\'s still here.');
    const pick = await choose('kai', 'The heart of the stabilizer.', ['Destroy the stabilizer', 'Redirect its energy to free the held civilians'], 1);
    S.choice = pick === 0 ? 'destroy' : 'free';
    F.m13choice = S.choice; FX.record('m13', S.choice);
    sera.lookTarget = null;
    cine(false); S.main = false;
    const order = S.choice === 'destroy' ? [0, 1, 2] : [2, 0, 1];
    objective(S.choice === 'destroy' ? 'Overload the three couplings · the lit one first' : 'Turn the three couplings toward the ground · the lit one first');
    cp(0.8, 2.4, 4.6, Math.PI);
    const cplDone = [false, false, false];
    let cplNext = 0;
    game.onUpdate((dt, t) => { W.couplings.forEach((c, i) => { const lit = order[cplNext] === i; c.userData.ring.scale.setScalar(lit ? 1.2 + Math.sin(t * 6) * 0.15 : 1); c.userData.ring.material = cplDone[i] ? W.mats.graphite : W.mats.goldGlow; }); });
    P.couplings.forEach(([x, y, z], i) => {
      game.interact({ pos: [x, y + 1.0, z], radius: 1.8, hold: 1.4, prompt: S.choice === 'destroy' ? 'Overload the coupling' : 'Turn the coupling toward the ground', once: false, states: ['2196'], enabled: () => !cplDone[i], onUse: () => {
        if (order[cplNext] !== i) { audio.sfxPlay('fail'); ui.subtitle('kai', 'Not that one. The lit one.', 1600); return; }
        cplDone[i] = true; cplNext++; audio.sfxPlay('metal'); game.shake = 0.08; kai.wristBoost = 6;
        W.heart.scale.setScalar(1 + cplNext * (S.choice === 'destroy' ? 0.25 : -0.15));
      } });
    });
    await game.waitFor(() => cplNext >= 3);
    F.m13couplings = 3;

    if (S.choice === 'destroy') {
      // ---------- the stabilizer comes apart: get clear ----------
      lockMusic('m13-break', 0.8); audio.sfxPlay('alarm');
      S.main = true; cine(true);
      await game.shot([3.0, 4.6, 8.0], [0, 3.6, 1.0], 1.0, { fov: 40 });
      await game.say('sera', 'It\'s going critical. Down the steps — run!');
      walkTo(sera, [[-1.4, Y0, 10.6], [-3, Y0, 24]], 4.2);
      cine(false); S.main = false;
      objective('Get clear of the spire');
      let runT = 22;
      const failRun = game.onUpdate(dt => { if (!game.control || game._failing) return; runT -= dt; game.shake = Math.min(0.12, 0.03 + (22 - runT) * 0.004); if (runT <= 0) { runT = 22; game.fail('CAUGHT IN THE COLLAPSE'); } });
      cp(0.8, 2.4, 4.6, 0, () => { runT = 22; });
      await game.waitFor(() => Math.hypot(pl.pos.x - SPIRE[0], pl.pos.z - SPIRE[1]) > 20);
      failRun(); game.shake = 0;
      S.main = true; cine(true);
      await game.shot([18, 4, 34], [0, 10, -2], 1.2, { fov: 52 });
      audio.sfxPlay('boom'); game.shake = 0.3;
      const sp = W.spire;
      await tween(3.4, u => { sp.position.y = -u * 9; sp.rotation.z = u * 0.22; sp.rotation.x = u * 0.08; W.heart.scale.setScalar(1.75 + u * 2); });
      sp.visible = false; sp.userData.states = []; game.shake = 0;
      for (const b of game.collision.boxes) if (b.states && b.states.length === 1 && b.states[0] === '2196' && Math.hypot((b.min.x + b.max.x) / 2 - SPIRE[0], (b.min.z + b.max.z) / 2 - SPIRE[1]) < 9) b.enabled = false;
      audio.silence(2.4);
      await game.wait(1.6);
      await game.shot([6, 2.2, 30], [0, 2, 0], 2.6, { fov: 46 });
      await game.talk([
        ['m13lasker', 'It\'s down. It\'s down! Sable Yards, the spire is down!'],
        ['m13pa', 'Sable line. Stabilizer lost. Fall back to the viaduct.'],
      ]);
      // and the held, in 2049: still held
      await T.switchTo('2049', { force: true, free: true });
      pl.place(-6.4, Y0, 55.2, Math.PI);
      await game.shot([-6.8, 1.6, 53.4], [-8.3, 1.2, 55.5], 2.0, { fov: 34 });
      await game.say('kai', 'Still held. The spire\'s gone and the second it took is still here.');
      await game.say('kai', 'I\'m sorry. Nobody else gets held like this. I\'ll find another way for you.');
      F.m13stabilizer = 'destroyed'; F.m13civiliansFreed = false; F.m13districtHeld = true;
      FX.adjust('unwritten', +2, 'The stabilizer is gone'); FX.adjust('continuum', -2, 'You broke their spire');
      FX.grant('unwritten-sappers', 'unwritten', 'Lasker\'s sappers will break one Continuum line for you');
      F.seraTrust = (F.seraTrust || 0) - 1;
      ev('The spire, broken', 'Kai overloaded the stabilizer and it came apart. The nine-minute war at the Sable Yards is over and the Continuum lost its fixed point; Lasker\'s Unwritten owe him a favour. The three hundred and twelve residents in 2049 are still held in their second.', 'THE CHOICE');
      await T.switchTo('2196', { force: true, free: true });
      pl.place(0, Y0, 22, Math.PI);
      sera.root.position.set(-2.6, Y0, 23.4); sera.lookTarget = kai.head; kai.lookTarget = sera.head;
      await game.shot([2.4, 1.7, 19.4], [-1.2, 1.6, 22.8], 1.4, { fov: 36 });
      await game.talk([
        ['sera', 'You chose the war over the people in the rain.'],
        ['kai', 'I chose that nobody gets to hold a district again.'],
        ['sera', 'I hope it was the right sum. Somebody in your year will have to live with the answer.'],
      ]);
    } else {
      // ---------- the energy goes down, into the held second: they walk ----------
      lockMusic('m13-free', 1.2);
      S.main = true; cine(true);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 12, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      beam.position.set(0, -2, SPIRE[1] + 3); scene.add(beam); T.only(beam, '2196');
      await game.shot([5, 4, 10], [0, 1, 1], 1.4, { fov: 44 });
      await tween(1.8, u => { beam.scale.set(1 + u, 1, 1 + u); W.heart.scale.setScalar(1.3 - u * 0.9); });
      await game.say('m13band', 'Redirect complete. Held field, 2049: releasing.');
      W.heart.visible = false; beam.visible = false; beam.userData.states = [];
      await T.switchTo('2049', { force: true, free: true, dur: 1600 });
      pl.place(-6.4, Y0, 55.2, Math.PI);
      S.freed = true; F.m13civiliansFreed = true; F.m13stabilizer = 'redirected'; F.m13districtHeld = false;
      audio.rain(0.3); audio.sfxPlay('rewind');
      await game.shot([-6.8, 1.6, 53.4], [-8.3, 1.2, 55.5], 0.01, { fov: 34 });
      // the cup lands — and she catches it
      for (const h of held) { h.ch.frozen = false; if (h.tag === 'driver') continue; h.ch.speed = h.tag === 'courier' ? 2.6 : 1.1; }
      const heldWalk = game.onUpdate(dt => { for (const h of held) { if (['driver', 'cup', 'couple', 'couple2'].includes(h.tag)) continue; const r = h.ch.root; r.position.x += Math.sin(r.rotation.y) * h.ch.speed * dt * 0.5; r.position.z += Math.cos(r.rotation.y) * h.ch.speed * dt * 0.5; } });
      await tween(0.5, u => { cup.position.y = 0.86 - u * 0.12; spill.position.y = 0.8 - u * 0.75; spill.scale.set(1.6 + u * 4, 0.2, 1.6 + u * 4); });
      const cupH = held.find(h => h.tag === 'cup'); if (cupH) { cupH.ch.pose = null; cupH.ch.speed = 0; }
      const rp2 = W.heldRainPos; const fall = game.onUpdate(dt => { for (let i = 1; i < rp2.length; i += 3) { rp2[i] -= dt * 9; if (rp2[i] < 0.1) rp2[i] += 9; } W.heldRain.geometry.attributes.position.needsUpdate = true; });
      await game.wait(1.2);
      await game.say('m13held', 'Oh — oh, no, my coffee. ...Why is it so dark? It was morning a second ago.');
      await game.shot([4, 2.0, 46], [0, 1.6, 56], 2.6, { fov: 48 });
      await game.say('kai', 'It was. Five days ago.');
      await game.shot([18, 4.0, -18], [0, 1.6, -6], 2.4, { fov: 50 });
      if (W.tram) await tween(2.4, u => { W.tram.position.x = -u * 3; });
      await game.say(radioId, haleSide ? 'Varen? The Yards— people are walking out of the Yards. They\'re walking out!' : 'Cordon to Helix. Movement in the Sable district. Movement everywhere.');
      heldWalk(); fall();
      FX.adjust('unwritten', -1, 'You left the spire standing'); FX.adjust('continuum', -1, 'You emptied their fixed point');
      FX.grant('sable-civilians', 'sera', 'The freed Sable residents know every back route in the Yards');
      F.seraTrust = (F.seraTrust || 0) + 1;
      ev('The held, freed', 'Kai turned the stabilizer\'s stored charge back into the held second. At 05:58 on Sunday 24.10.2049 three hundred and twelve Sable residents finished the step they had started at 08:14 on the nineteenth. The spire stands, empty, and the Continuum still hold it. Lasker\'s Unwritten feel betrayed.', 'THE CHOICE');
      await T.switchTo('2196', { force: true, free: true });
      pl.place(0, Y0, 22, Math.PI);
      sera.root.position.set(-2.6, Y0, 23.4); sera.lookTarget = kai.head; kai.lookTarget = sera.head;
      await game.shot([2.4, 1.7, 19.4], [-1.2, 1.6, 22.8], 1.4, { fov: 36 });
      await game.talk([
        ['m13lasker', 'You gave them the spire, architect. Remember that I asked.'],
        ['sera', 'You gave three hundred people their morning back. He\'ll come round. Or he won\'t.'],
        ['kai', 'Adair will re-stake it.'],
        ['sera', 'Then we\'ll be here. That\'s what surviving is.'],
      ]);
    }
    sera.lookTarget = null; kai.lookTarget = null;

    // ---------- the Witness on the viaduct ----------
    show(witness, true); eraOf(witness, '2196'); witness.root.position.set(-14, 8.4, -49); witness.root.rotation.y = 0.2; witness.lookTarget = kai.head;
    await game.shot([-4, 2.2, 14], [-14, 9.4, -49], 2.2, { fov: 26 });
    if (S.choice === 'destroy') { witness.pose = 'nod'; await game.wait(1.4); witness.pose = null; }
    else { witness.lookTarget = null; await tween(1.0, u => { witness.root.rotation.y = 0.2 + u * 2.6; }); }
    await game.say('kai', S.choice === 'destroy' ? 'He nodded. As if I\'d passed something.' : 'He turned his back. As if I\'d failed something.');
    audio.sfxPlay('switch'); witness.wristBoost = 8;
    await game.wait(0.5); show(witness, false);
    F.m13witnessSeen = true;
    ev('The man on the viaduct', S.choice === 'destroy' ? 'After the spire fell, the Witness watched from the broken viaduct in 2196, nodded once, and changed state. His note had said "Break it."' : 'After the held walked free, the Witness watched from the broken viaduct in 2196, turned his back, and changed state. His note had said "Break it."', 'THE WITNESS');

    // ---------- ending ----------
    F.m13done = true; F.m13anchors = S.anchors; F.m13shards = S.shards; F.m13evidence = S.ev.size;
    F.m13support = (F.factionSupport || []).map(s => s.id);
    FX.save();
    await game.shot([22, 26, 52], [0, 2, -6], 5.0, { fov: 52 });
    await ui.fade(1, 2600);
    const mins = Math.round((game.time - tStart) / 60);
    const stand = { neutral: 'Neutral', continuum: 'Continuum-aligned', unwritten: 'Unwritten-sympathetic' }[FX.standing()];
    await ui.chapterCard('MISSION 13 COMPLETE', 'The Nine-Minute War', `${S.choice === 'destroy' ? 'The spire is down' : 'The held walk free'} · ${stand} · Shards ${S.shards}/5 · Held ${S.held}/4${mins ? ' · ' + mins + ' min' : ''}`, 4200);
    C.dispose(); echo?.dispose(); FX.dispose(); delete T.canSwitch; kai.lookTarget = null;
    game.releaseCam(); ui.letterbox(false); audio.allBeds?.(0); audio.setTheme(null);

    function setResidueOff() { if (game.residueOn) game.setResidue(false); }
  },
};
