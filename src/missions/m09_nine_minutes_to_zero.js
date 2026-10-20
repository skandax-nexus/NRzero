// MISSION 9 · NINE MINUTES TO ZERO (Act II · The Nine-Minute War) — introduce knowledge-based looping.
// Bible beats: observe two loops and map enemy patrols · find three synchronized clocks · sabotage the central
// transmitter · rescue a trapped engineer and reach the tower before reset.
// Quote: "You have nine minutes." / "To do what?" / "To become me."
// Ending: the city resets, but Kai retains his knowledge and no longer resets with it.
// The Meridian district has been living 08:05:00-08:14:00 on Sunday 19.10.2049 (the nine minutes before the Zero
// Second) since Sunday. A Continuum array holds it there: three public clocks kept in step by a transmitter mast.
// Every repetition the patrols, the civilians and the damage shift a little; Kai keeps only what he learns
// (src/systems/loops.js: LocalLoop, LoopPatrol, syncClocks). Optional: The Ninth Minute: Evidence (five pieces),
// the mother under the bakery awning, the loop-aware officer, Café Ostra, five temporal shards.
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { Rain } from '../world/kit.js';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { LocalLoop, LoopPatrol, loopRoutine, syncClocks } from '../systems/loops.js';
import { buildMeridian, registerM9Cast, registerM9Themes, musicState, P, Y0, SHARDS, SQUARE_LOOP, TROOPER, CIVS, TEX } from '../world/env_m9.js';

const CLOCK0 = 8 * 3600 + 5 * 60, DUR = 540;
const AT = (m, s = 0) => (m - 5) * 60 + s;               // wall clock 08:mm:ss -> loop time
const B_WIN = { 1: [AT(6, 30), AT(9, 0)], 0: [AT(9, 0), AT(12, 0)] };   // Patrol B on the bank steps (odd / even loops)
const C_AWAY = [AT(11, 0), AT(12, 10)];                 // Patrol C leaves the substation gate
const SHUTTER = AT(10, 0), TRAM = [AT(9, 0), AT(9, 20), AT(9, 50), AT(10, 10)], AWNING = AT(13, 20), RHEE = [AT(7, 0), AT(9, 20)];
const KN = {
  reset: '08:14:00 · The district resets. So do I.',
  pA: 'Patrol A walks the fountain · 1:25 a lap',
  pB1: 'Odd loops: Patrol B on the bank steps 08:06:30-08:09',
  pB0: 'Even loops: Patrol B on the bank steps 08:09-08:12',
  pC: '08:11:00 · Patrol C leaves the gate for 1:10',
  tram: '08:09:20 · The tram stops at the square',
  shutter: '08:10:00 · The Market Hall shutter opens',
  clockA: 'Clock A · station roof · hold the relay',
  plate: 'Node C resets to 08:05:00',
  clockB: 'Clock B · bank portico · pull the fuse',
  clockC: 'Clock C · hall gallery · the trigger',
  ines: 'Ines Calder · locked in the substation cabin',
  plan: 'One loop: A, B and C out of step · then the cores',
  family: '08:13:20 · The bakery awning falls',
  rhee: '08:07 · An officer without her helmet, Station Lane',
};

export default {
  id: 'm9', act: 'ACT II · THE NINE-MINUTE WAR', title: 'Nine Minutes to Zero', sub: 'The looping city',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time, tok = game.token;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM9Cast(); registerM9Themes();
    try {
      const need = ['ines', 'rhee', 'dev', 'm9vendor', 'm9mother', 'm9trooper'].filter(id => !ui.portraits[id] && CAST[id]?.look);
      if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]]))));
    } catch (err) { console.warn('m9 portraits', err); }

    const scene = game.newScene({ background: 0x8a949e, fog: [0x9aa4ae, 0.008], exposure: 1.05, bloom: 0.45, bloomThreshold: 0.9, envIntensity: 0.9, killY: -20, residue: true });
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    const Q = RZ.getQuality(), low = Q === 'low';
    game.onUpdate(dt => RZ.update(dt));
    await tick();
    const W = buildMeridian(game, scene);
    game.onUpdate((dt, t) => W.update(dt, t));
    await tick();

    // ---------- sky, sun, wet streets, drizzle ----------
    let sun = null;
    try {
      const sky = RZ.skyEnvironment(renderer, scene, { preset: 'overcast', elevation: 16, azimuth: 115, envIntensity: 0.9 });
      sun = sky.addSun(scene, { shadow: true, area: low ? 26 : 38, distance: 70, intensity: 1.5, mapSize: low ? 512 : 1024 });
      scene.fog = RZ.heightFog({ color: 0x9aa4ae, density: 0.0075, falloff: 0.03, base: 0 });
      RZ.setWetness?.({ amount: 0.65, puddles: 0.55 });
    } catch (err) { console.warn('m9 sky', err); }
    const sunDir = sun ? sun.position.clone().sub(sun.target.position).normalize() : new THREE.Vector3(0.4, 0.8, 0.3);
    const hemi = new THREE.HemisphereLight(0xb8c4d0, 0x3a3830, 0.55); scene.add(hemi);
    const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    let lightT = 0;
    game.onUpdate(dt => {
      const p = game.cine ? game.engine.camera.position : pl.pos;
      if (sun) { sun.target.position.set(p.x, 0, p.z); sun.position.copy(sun.target.position).addScaledVector(sunDir, 70); }
      lightT -= dt; if (lightT > 0) return; lightT = 0.5;
      const list = W.lightSrc.map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      pts.forEach((l, i) => { const s = list[i]; if (!s || s.dd > 900) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
    });
    const rain = new Rain(low ? 900 : 2200, 40); scene.add(rain.mesh);
    game.onUpdate(dt => rain.update(dt, game.engine.camera));
    audio.rain(0.25); audio.wind(0.12); audio.crowd?.(0.05);

    T.configure([{ id: '2049', key: '1', name: 'MERIDIAN', year: 'SUN 19.10.2049 · THE NINE MINUTES', glyph: '◎', color: '#5fe6ff', theme: 'm9-loop', apply: () => {} }], '2049');
    T.unlocked = false;

    // =====================================================================================================
    // state + helpers
    // =====================================================================================================
    const S = { seen: {}, ev: new Set(), shards: 0, run: null, alarm: false, inesMet: false, warned: {}, god: false, final: false, phase: 'arrive' };
    const kai = pl.char;
    const near = (x, z, r) => Math.hypot(pl.pos.x - x, pl.pos.z - z) < r;
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u)); if (u >= 1) { off(); res(); } }); });
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const ev = (title, text, tag) => ui.addEvidence(title, text, tag);
    const choose = (id, text, opts) => { if (game.autoplay && game.autoQueue?.length) game.autoChoice = game.autoQueue.shift(); return game.choice(id, text, opts); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const onRoof = () => pl.pos.y > 6.8 && pl.pos.x < -27.5 && pl.pos.x > -44 && pl.pos.z < -18 && pl.pos.z > -44;
    const inSafe = () => pl.pos.z > 28;
    const inHall = () => pl.pos.x > -16 && pl.pos.x < 16 && pl.pos.z < -56.3 && pl.pos.z > -81.7;
    let shiftPulse = 0;
    game.onUpdate(dt => { if (shiftPulse > 0) { shiftPulse = Math.max(0, shiftPulse - dt * 1.3); game.engine.fx.uShift.value = shiftPulse; } });

    // =====================================================================================================
    // THE LOOP (08:05:00 + t, nine minutes)
    // =====================================================================================================
    const loop = new LocalLoop(game, { id: 'm9-meridian', label: 'MERIDIAN · NINE MINUTES', duration: DUR, restart: [2, 0, 49, Math.PI], clock: CLOCK0, maxKnown: 4, maxLayer: 6, autoStart: false });
    loop.iterLabel = (l) => 'LOOP ' + l.iteration + ((l.knows('pB1') || l.knows('pB0')) ? (l.iteration % 2 ? ' · ODD' : ' · EVEN') : '');
    const parity = () => loop.iteration % 2;
    const knows = (k) => loop.knows(k);
    const learn = (k, o) => loop.learn(k, KN[k], o);
    game.checkpoint(2, 0, 49, Math.PI);

    // ---------- people ----------
    const mkTrooper = (id, x, z, ry, lod = false) => { const c = game.actor(id, { ...TROOPER, lod, role: 'm9trooper' }, x, 0, z, ry); return c; };
    const trA = mkTrooper('trA', SQUARE_LOOP[0][0], SQUARE_LOOP[0][1], 0);
    const trB = mkTrooper('trB', 22, -47, -Math.PI / 2);
    const trC = mkTrooper('trC', P.cStand[0], P.cStand[2], -Math.PI / 2);
    await tick();
    const trD = mkTrooper('trD', 2, -91, 0, true), trE = mkTrooper('trE', -16, -93.5, 0, true);
    trD.root.visible = false; trE.root.visible = false;
    const ines = game.actor('ines', null, 51, 0, -80, -Math.PI / 2); ines.root.visible = false;
    const rhee = game.actor('rhee', null, P.officer[0], Y0, P.officer[2], Math.PI / 2); rhee.root.visible = false;
    const dev = game.actor('dev', null, -17.0, Y0, 37.0, Math.PI / 2); dev.pose = 'work';
    await tick();
    const vendor = game.actor('m9vendor', null, 5, Y0, -52, Math.PI);
    const mother = game.actor('m9mother', null, 8.2, Y0, 40, Math.PI);
    const boy = game.actor('m9boy', null, 7.4, Y0, 40.6, Math.PI);
    const figure = game.actor('m9fig', { ...CAST.witness.look, era: '2049' }, -35, 20.9, -30, Math.PI * 0.75); figure.root.visible = false;
    await tick();
    const civs = CIVS.map((lk, i) => game.ambient({ ...lk }, 0, Y0, 0, 0));
    await tick();

    // ---------- routes ----------
    const route = (pts, speed, pause, t0 = 0, t1 = DUR, y = Y0) => {           // closed patrol loop, starting at t0
      const K = []; let t = t0, i = 0;
      const P3 = (p) => [p[0], p[2] !== undefined ? p[1] : y, p[2] !== undefined ? p[2] : p[1]];
      while (t < t1) {
        const a = P3(pts[i % pts.length]), b = P3(pts[(i + 1) % pts.length]);
        K.push({ t, pos: a }); t += pause; K.push({ t, pos: a });
        t += Math.hypot(b[0] - a[0], b[2] - a[2]) / speed; i++;
      }
      return K.filter(k => k.t < t1);
    };
    const KEYS_A = route(SQUARE_LOOP, 1.3, 3);
    const NORTH = [[22, -47], [8, -47]];
    const B_STEPS = (t0) => [{ t: t0, pos: [22, Y0, -47] }, { t: t0 + 11, pos: [21.4, Y0, -30.2] }, { t: t0 + 14, pos: P.bStand, ry: -Math.PI / 2 }];
    const B_OFF = (t1) => [{ t: t1, pos: P.bStand, ry: -Math.PI / 2 }, { t: t1 + 3, pos: [21.4, Y0, -30.2] }, { t: t1 + 14, pos: [22, Y0, -47] }];
    const keysB = (it) => {
      const [w0, w1] = B_WIN[it % 2];
      const K = [...route(NORTH, 1.2, 2, 0, w0 - 14), ...B_STEPS(w0 - 14), ...B_OFF(w1), ...route(NORTH, 1.2, 2, w1 + 14, DUR)];
      return K.sort((a, b) => a.t - b.t);
    };
    const KEYS_C = [
      { t: 0, pos: P.cStand, ry: -Math.PI / 2 }, { t: C_AWAY[0], pos: P.cStand, ry: -Math.PI / 2 },
      { t: C_AWAY[0] + 5, pos: [24, 0, -74] }, { t: C_AWAY[0] + 15, pos: [24, 0, -88] }, { t: C_AWAY[0] + 27, pos: [8, 0, -89.5], ry: Math.PI },
      { t: C_AWAY[1] - 27, pos: [8, 0, -89.5], ry: Math.PI }, { t: C_AWAY[1] - 15, pos: [24, 0, -88] }, { t: C_AWAY[1] - 5, pos: [24, 0, -74] }, { t: C_AWAY[1], pos: P.cStand, ry: -Math.PI / 2 },
    ];
    const keysC = () => (S.alarm ? [{ t: 0, pos: [33.5, 0, -64], ry: -Math.PI * 0.6 }] : KEYS_C);
    const sweep = (x, z, a0, a1, per) => { const K = []; for (let t = 0; t < DUR; t += per) { K.push({ t, pos: [x, 0, z], ry: a0 }); K.push({ t: t + per / 2, pos: [x, 0, z], ry: a1 }); } return K; };
    const patrols = [
      new LoopPatrol(loop, trA, { keys: KEYS_A, range: 10, fov: 0.55, near: 1.6, name: 'A' }),
      new LoopPatrol(loop, trB, { keys: keysB, range: 10, fov: 0.5, near: 1.5, name: 'B' }),
      new LoopPatrol(loop, trC, { keys: keysC, range: 11, fov: 0.5, near: 1.8, name: 'C' }),
      new LoopPatrol(loop, trD, { keys: sweep(2, -91, Math.PI * 0.35, Math.PI * 0.85, 9), range: 9, fov: 0.45, near: 1.4, name: 'D' }),
      new LoopPatrol(loop, trE, { keys: sweep(-16, -93.5, -Math.PI * 0.6, -Math.PI * 0.1, 11), range: 8.5, fov: 0.45, near: 1.4, name: 'E' }),
    ];
    patrols[3].enabled = false; patrols[4].enabled = false;
    // the officer who is starting to remember: off her helmet on Station Lane 08:07-08:09:20
    loopRoutine(loop, rhee, [{ t: 0, pos: [-21, Y0, -82] }, { t: RHEE[0] - 14, pos: [-21, Y0, -82] }, { t: RHEE[0], pos: P.officer, ry: Math.PI / 2 }, { t: RHEE[1], pos: P.officer, ry: Math.PI / 2 }, { t: RHEE[1] + 14, pos: [-21, Y0, -82] }]);
    game.onUpdate(() => { rhee.root.visible = loop.window(RHEE[0] - 14, RHEE[1] + 14) && !S.alarm; if (rhee.root.visible && loop.window(RHEE[0], RHEE[1])) rhee.pose = 'look'; });
    // the vendor opens the hall shutter at 08:10
    loopRoutine(loop, vendor, [{ t: 0, pos: [5, Y0, -52], ry: Math.PI }, { t: SHUTTER - 14, pos: [5, Y0, -52], ry: Math.PI }, { t: SHUTTER - 6, pos: [1.6, Y0, -55.2], ry: Math.PI, pose: 'work' }, { t: SHUTTER + 4, pos: [1.6, Y0, -55.2], ry: Math.PI }, { t: SHUTTER + 14, pos: [9, Y0, -60.4], ry: Math.PI, pose: 'work' }, { t: DUR - 1, pos: [9, Y0, -60.4], ry: Math.PI, pose: 'work' }]);
    // the mother and her son walk the east pavement under the bakery awning (or, warned, cross the avenue)
    const famKeys = (dx) => (it) => {
      const alt = S.warned[it];
      const K = [{ t: 0, pos: [8.2 + dx, Y0, 46], ry: Math.PI }, { t: AWNING - 70, pos: [8.2 + dx, Y0, 46], ry: Math.PI }, { t: AWNING - 30, pos: [8.2 + dx, Y0, 12] }];
      if (alt) K.push({ t: AWNING - 22, pos: [-3 + dx, 0, 9] }, { t: AWNING - 14, pos: [-7.6 + dx, Y0, 6] }, { t: AWNING + 10, pos: [-7.6 + dx, Y0, -8] }, { t: DUR - 1, pos: [-7.6 + dx, Y0, -8], ry: Math.PI });
      else K.push({ t: AWNING, pos: [8.2 + dx, Y0, -2.5] }, { t: AWNING + 1, pos: [8.2 + dx, Y0, -2.5] }, { t: DUR - 1, pos: [8.2 + dx, Y0, -2.5] });
      return K;
    };
    loopRoutine(loop, mother, famKeys(0)); loopRoutine(loop, boy, famKeys(-0.7));
    game.onUpdate(() => { if (!S.warned[loop.iteration] && loop.t > AWNING + 0.5) { mother.pose = 'fall'; boy.pose = 'sad'; } });
    // civilians: commuters who repeat the same nine minutes, with small deviations each loop
    const CIV_KEYS = [
      it => [{ t: 0, pos: [-7.6, Y0, 50] }, { t: 70 + (it % 3) * 4, pos: [-7.6, Y0, -6] }, { t: 90, pos: [-12, Y0, -14] }, { t: 150, pos: [-20, Y0, -40] }, { t: 210, pos: [-20, Y0, -50], ry: Math.PI }, { t: DUR - 1, pos: [-20, Y0, -50], ry: Math.PI }],
      it => [{ t: 0, pos: [-16, Y0, -24.4], ry: Math.PI / 2, pose: 'sit' }, { t: 250 + (it % 2) * 20, pos: [-16, Y0, -24.4], ry: Math.PI / 2, pose: 'sit' }, { t: 262 + (it % 2) * 20, pos: [-6, Y0, -13.8] }, { t: DUR - 1, pos: [-6, Y0, -13.8], ry: 0 }],
      it => [{ t: 0, pos: [12, Y0, -11.2], ry: Math.PI }, { t: TRAM[1] + 6 + (it % 2), pos: [12, Y0, -11.2], ry: Math.PI }, { t: TRAM[1] + 9, pos: [10.4, Y0, -11.6] }, { t: DUR - 1, pos: [10.4, Y0, -11.6] }],
      it => [{ t: 0, pos: [7.6, Y0, 30] }, { t: 60, pos: [7.6, Y0, -6] }, { t: 100 + it % 4, pos: [18, Y0, -24] }, { t: 160, pos: [18, Y0, -48] }, { t: 220, pos: [-12, Y0, -52] }, { t: 302, pos: [-1, Y0, -53.5] }, { t: 315, pos: [-1, Y0, -60] }, { t: 330, pos: [-6, Y0, -66], ry: Math.PI, pose: 'look' }, { t: DUR - 1, pos: [-6, Y0, -66], ry: Math.PI, pose: 'look' }],
      () => [{ t: 0, pos: [-13, Y0, 35.5], ry: Math.PI / 2, pose: 'sit' }, { t: DUR - 1, pos: [-13, Y0, 35.5], ry: Math.PI / 2, pose: 'sit' }],
      it => [{ t: 0, pos: [3, Y0, -44] }, { t: 40, pos: [-4, Y0, -36.4] }, { t: 44, pos: [-4, Y0, -36.4], ry: 0, pose: 'look' }, { t: 140 + (it % 3) * 10, pos: [-4, Y0, -36.4], ry: 0, pose: 'look' }, { t: 200, pos: [-24, Y0, -12] }, { t: DUR - 1, pos: [-24, Y0, -12] }],
    ];
    civs.forEach((c, i) => loopRoutine(loop, c, CIV_KEYS[i]));
    game.onUpdate(() => { civs[2].root.visible = loop.t < TRAM[1] + 9 || S.outside; });   // she boards the tram

    // ---------- the three synchronized clocks ----------
    const lamp = (m, on) => { m.material.emissive.set(on ? 0xff4d5e : 0xffd27a); };
    const clocks = syncClocks(loop, [
      { id: 'A', set: (h, m, s) => W.clocks.A.forEach(c => c.userData.set(h, m + s / 60)), onDesync: () => lamp(W.nodeALamp, true), onResync: () => lamp(W.nodeALamp, false) },
      { id: 'B', set: (h, m, s) => W.clocks.B.forEach(c => c.userData.set(h, m + s / 60)), onDesync: () => lamp(W.cabB, true), onResync: () => lamp(W.cabB, false) },
      { id: 'C', set: (h, m, s) => W.clocks.C.forEach(c => c.userData.set(h, m + s / 60)), onDesync: () => lamp(W.nodeCLamp, true), onResync: () => lamp(W.nodeCLamp, false) },
    ]);
    window.__m9 = { S, W, loop, patrols, clocks, ines, rhee, mother, skip: (t) => loop.skipTo(t) };

    // ---------- the world inside one repetition ----------
    const setShutter = (u) => { W.shutter.position.y = 2.3 + u * 4.4; W.shutterBox.enabled = u < 0.7; };
    const setBackDoor = (open) => { W.backDoor.position.x = open ? 10.6 : 9; W.backDoor.rotation.y = open ? Math.PI / 2 : 0; W.backDoorBox.enabled = !open; };
    const setAwning = (fallen) => { W.awning.rotation.z = fallen ? 0.12 : 0; W.awning.position.y = fallen ? 0.62 : 3.6; };
    const damageFor = (it) => { W.damage.forEach(d => { d.mesh.visible = it >= d.it; }); };
    const setShield = (on) => {
      S.lockLost = !on; W.shieldBox.enabled = on; W.shield.visible = on;
      W.rings.forEach(r => { r.material.emissiveIntensity = on ? 2.4 : 0.25; });
    };
    const setCore = (c, pulled) => { c.pulled = pulled; c.core.position.y = pulled ? 0.5 : c.home; c.core.material.emissiveIntensity = pulled ? 0.15 : 2.4; };
    const restoreRepetition = () => {
      setShutter(0); setBackDoor(false); setAwning(false); setShield(true);
      W.cores.forEach(c => setCore(c, false));
      W.beacon.material.emissiveIntensity = 2; W.cabinDoor.position.z = -80; W.cabinLamp.material.emissive.set(0xff4d5e);
      W.tv.forEach(m => { m.material.map = TEX.tv(0); });
      mother.pose = null; boy.pose = null;
      S.run = { A: false, B: false, C: false, cores: 0, sabotaged: false, freed: false, back: false };
      S.alarm = false; musicState.alarm = 0; patrols[3].enabled = false; patrols[4].enabled = false; trD.root.visible = false; trE.root.visible = false;
      ines.root.visible = false; S.inesWith = false; ines.root.position.set(51, 0, -80); ines.speed = 0;
      patrols.forEach(p => p.reset());
      damageFor(loop.iteration);
      if (W.tram) W.tram.position.x = -110;
    };
    restoreRepetition();
    loop.onWrap(restoreRepetition);
    loop.onReset(() => { restoreRepetition(); });
    loop.at(SHUTTER, () => { tween(3.5, u => setShutter(u)); if (inHall() || near(0, -54, 14)) audio.sfxPlay('metal'); }, { learn: ['shutter', KN.shutter], when: () => near(0, -56, 22) || onRoof() });
    loop.at(AT(12, 0), () => { W.tv.forEach(m => { m.material.map = TEX.tv(1); }); });
    loop.at(AWNING, () => {
      setAwning(true); if (near(10, -2, 30)) { audio.sfxPlay('boom'); game.shake = 0.12; setTimeout(() => { game.shake = 0; }, 400); }
      if (near(10, -2, 30) && !S.warned[loop.iteration]) ui.subtitle('kai', 'The awning. Right on top of them.', 2600);
    }, { learn: ['family', KN.family], when: () => near(10, -2, 30) });
    loop.onSkip((a, b) => { if (b > SHUTTER && a < SHUTTER) setShutter(1); if (b > AWNING) setAwning(true); });
    // the tram (eastbound, every loop): enters through the boundary, stops at the square, leaves
    game.onUpdate(() => {
      if (!W.tram) return;
      const t = loop.t; let x = -110;
      if (t >= TRAM[0] && t < TRAM[1]) x = -60 + (t - TRAM[0]) / 20 * 66; else if (t >= TRAM[1] && t < TRAM[2]) x = 6; else if (t >= TRAM[2] && t < TRAM[3]) x = 6 + (t - TRAM[2]) / 20 * 70; else if (t >= TRAM[3]) x = 110;
      W.tram.position.x = x;
      const bx = W.tramBox; bx.min.x = x - 9; bx.max.x = x + 9;
    });
    loop.at(TRAM[1], () => { if (near(6, -13, 40)) audio.sfxPlay('door'); }, { learn: ['tram', KN.tram], when: () => near(6, -13, 34) || onRoof() });
    // patrol knowledge: watched from the station roof (or seen up close)
    const watchB = (it) => () => (onRoof() || near(26, -30, 16)) && parity() === it;
    loop.at(B_WIN[1][0] + 2, null, { learn: ['pB1', KN.pB1], when: watchB(1) });
    loop.at(B_WIN[0][0] + 2, null, { learn: ['pB0', KN.pB0], when: watchB(0) });
    loop.at(C_AWAY[0] + 4, null, { learn: ['pC', KN.pC], when: () => onRoof() || near(28, -68, 20) || near(24, -86, 12) });
    loop.at(RHEE[0] + 10, null, { learn: ['rhee', KN.rhee], when: () => near(P.officer[0], P.officer[2], 18) });
    // the reset at 08:14:00
    loop.at(DUR - 1.4, () => { if (S.final) { S.zeroNow = true; loop.paused = true; } else zeroReset().catch(() => {}); });
    let zeroing = false;
    const freezeAll = (on) => { for (const c of [trA, trB, trC, trD, trE, ines, rhee, dev, vendor, mother, boy, ...civs]) c.frozen = on; };
    async function zeroReset() {
      if (zeroing || loop._resetting) return;
      zeroing = true; loop.paused = true; game.control = false;
      audio.setTheme('m9-reset', 0.4); audio.silence(1.4); freezeAll(true);
      ui.toast('08:14:00', 1600); audio.sfxPlay('heartbeat');
      let k = 0; const off = game.onUpdate(dt => { k = Math.min(1, k + dt * 1.5); game.engine.fx.uFreeze.value = k * 0.8; });
      await game.wait(1.6);
      off(); game.engine.fx.uFreeze.value = 0; freezeAll(false);
      zeroing = false; loop.paused = false;
      await loop.reset(S.resets ? '08:14:00 · THE DISTRICT RESET\nYou keep what you learned' : '08:14:00 · THE ZERO SECOND\nThe district resets. So do you.');
    }
    // detection: their emitters don't shoot; they send you back to 08:05
    let caught = false;
    game.onUpdate((dt) => {
      if (!game.control || ui.dlgActive || loop._resetting || zeroing || S.god || S.final) { ui.detection(0); return; }
      let a = 0, who = null;
      for (const p of patrols) { const v = p.update(dt); if (v > a) { a = v; who = p; } }
      ui.detection(a);
      if (a >= 1 && !caught) {
        caught = true; S.caught = (S.caught || 0) + 1; F.m9caught = S.caught;
        audio.sfxPlay('rewind'); shiftPulse = 0.8;
        loop.reset(`PATROL ${who.name} SAW YOU\nTheir emitters send you back to 08:05`).finally(() => { caught = false; });
      }
    });
    loop.onReset((n) => {
      S.resets = n; F.m9loops = loop.iteration; ui.detection(0);
      if (n === 1) S.firstReset = true;
      if (loop.iteration === 4 && once('wear')) setTimeout(() => { if (game.token === tok) ui.subtitle('kai', 'Cracks in the square that weren\'t there last time. Every loop it comes back a little more broken.', 4600); }, 3500);
      if (n >= 2 && S.caught && once('waitTip')) setTimeout(() => { if (game.token === tok) ui.toast(ui.words('WAITING\nAt the café or on the station roof you can wait for a time you know'), 4200); }, 4200);
      if (S.inesMet && S.inesFreedOnce && once('inesBack')) setTimeout(() => { if (game.token === tok) ui.subtitle('kai', 'Ines is back in her box. She\'ll remember. I\'ll remember.', 3600); }, 5200);
    });

    // ---------- music: safe zone / loop / alarm (loop memory: one layer per reset, from loopState.layer) ----------
    let musicLock = null;
    game.onUpdate(() => {
      const th = musicLock || (S.alarm ? 'm9-alarm' : inSafe() ? 'm9-safe' : 'm9-loop');
      if (th !== S.theme && !zeroing) { S.theme = th; audio.setTheme(th, 1.6); }
    });
    const lockMusic = (th) => { musicLock = th; };

    // =====================================================================================================
    // interactions
    // =====================================================================================================
    // --- waiting: knowledge lets you skip to a time you know (safe zone and the roof) ---
    const waitOpts = () => {
      const L = [];
      const add = (t, label, k) => { if ((!k || knows(k)) && t > loop.t + 4) L.push({ t, label: loop.clockAt(t).slice(0, 8) + ' · ' + label }); };
      add(B_WIN[1][0] - 20, 'Patrol B goes to the bank steps (odd loops)', 'pB1');
      add(B_WIN[1][1] + 3, 'Patrol B leaves the steps (odd loops)', 'pB1');
      add(B_WIN[0][0] - 20, 'Patrol B goes to the bank steps (even loops)', 'pB0');
      add(B_WIN[0][1] + 3, 'Patrol B leaves the steps (even loops)', 'pB0');
      add(TRAM[1] - 10, 'the tram', 'tram');
      add(SHUTTER - 8, 'the Market Hall shutter', 'shutter');
      add(C_AWAY[0] - 8, 'Patrol C leaves the gate', 'pC');
      add(AWNING - 50, 'the mother on the avenue', 'family');
      if (!knows('pB1') && !knows('pB0')) add(B_WIN[parity()][0] - 10, 'see what Patrol B does next');
      if (!knows('pC')) add(C_AWAY[0] - 10, 'watch the substation gate');
      L.sort((a, b) => a.t - b.t);
      L.push({ t: DUR - 6, label: '08:14:00 · let the loop run out' });
      return L;
    };
    const doWait = async () => {
      if (S.run?.sabotaged) { ui.subtitle('kai', 'No waiting now. Not with the mast down.', 2400); return; }
      const L = waitOpts();
      const i = await choose('kai', `It's ${loop.clockAt().slice(0, 8)}. Wait until…`, [...L.map(o => o.label), 'Don\'t wait']);
      if (i >= L.length) return;
      cine(true); await ui.fade(1, 500);
      loop.skipTo(L[i].t); S.waited = (S.waited || 0) + 1;
      await game.wait(0.3); await ui.fade(0, 600); cine(false);
      ui.toast(`${loop.clockAt()} · LOOP ${loop.iteration}`, 1800);
    };
    game.interact({ pos: [P.waitBench[0] + 0.6, 0.9, P.waitBench[2]], radius: 2.0, prompt: 'Sit and wait (skip to a time you know)', once: false, enabled: () => S.phase !== 'arrive' && !S.final, onUse: () => { doWait(); } });
    game.interact({ pos: [-34.7, 8.0, -40.1], radius: 2.0, prompt: 'Sit on the roof bench and wait', once: false, enabled: () => S.phase !== 'arrive' && !S.final, onUse: () => { doWait(); } });

    // --- the scope on the station roof: observe the square and map patrols ---
    game.interact({ pos: [P.scope[0], 8.2, P.scope[2]], radius: 1.8, prompt: 'Watch the square through the scope', once: false, enabled: () => !S.scoping, onUse: async () => {
      S.scoping = true; S.scopeUsed = true; cine(true);
      const look = async (ch, txt) => { const p = ch.root.position; await game.shot([P.scope[0] + 0.4, 8.7, P.scope[2]], [p.x, p.y + 1.2, p.z], 1.6, { fov: 22 }); if (txt) ui.subtitle('kai', txt, 2200); await game.wait(1.0); };
      await look(trA, 'Patrol A. Round the fountain, the same lap, every lap.'); learn('pA', { time: 0 });
      const bOn = loop.window(B_WIN[parity()][0], B_WIN[parity()][1]);
      await look(trB, bOn ? 'Patrol B, parked on the bank steps. Right in front of the clock.' : 'Patrol B, pacing the north side. He\'ll go back to the bank.');
      if (bOn) learn(parity() ? 'pB1' : 'pB0');
      const cAway = loop.window(C_AWAY[0], C_AWAY[1]);
      await look(trC, cAway ? 'The substation gate. Nobody on it. He walked off.' : 'Patrol C. The substation gate. He doesn\'t move.');
      if (cAway) learn('pC');
      await game.shot([P.scope[0] + 0.3, 8.6, P.scope[2] - 0.2], [-4, 4, -66], 1.4, { fov: 30 });
      if (!S.seen.scopeHall) { S.seen.scopeHall = true; ui.subtitle('kai', 'And beyond: the Market Hall, the mast in the substation, the tower. All of it on the same nine minutes.', 3600); await game.wait(2.4); }
      cine(false); S.scoping = false;
    } });

    // --- Clock A: the station clock's sync cabinet ---
    game.interact({ pos: [P.nodeA[0] + 0.7, 8.2, P.nodeA[2]], radius: 1.7, prompt: 'Inspect the station clock\'s cabinet', once: false, enabled: () => !knows('clockA') || !S.seen.plateRead, onUse: async () => {
      cine(true);
      await game.shot([P.nodeA[0] + 1.6, 8.9, P.nodeA[2] + 1.2], [P.nodeA[0], 8.4, P.nodeA[2]], 1.0, { fov: 38 });
      await game.talk([
        ['kai', '"Meridian array. Sync node A." Not a clock. A node.'],
        ['kai', '"Node B: the bank. Node C: the Market Hall. Trigger." Three clocks, held in step by the mast in the substation.'],
        ['kai', '"C reset reference: 08:05:00." That\'s what drags the district back.'],
      ]);
      cine(false); S.seen.plateRead = true;
      learn('clockA'); learn('plate');
      ev('Sync node A · the station clock', 'A brass Continuum cabinet under the station clock: "Meridian array. Node A station (observation), node B Bank of Meridian (portico), node C Market Hall (trigger). C reset reference 08:05:00. Lock: 3/3 nodes in step. Source: substation mast."', 'MERIDIAN · CLOCK A');
      ui.toast(ui.words('CLOCK A FOUND\nHold the relay (hold E) to knock it out of step'), 3200);
    } });
    game.interact({ pos: [P.nodeA[0] + 0.7, 8.2, P.nodeA[2] - 0.6], radius: 1.4, hold: 2.0, prompt: 'Hold the sync relay open (hold)', once: false, enabled: () => knows('clockA') && S.seen.plateRead && !S.run.A, onUse: () => desync('A', 'stop') });

    // --- Clock B: the bank portico (Patrol B stands in front of it in his window) ---
    const bAtCab = () => Math.hypot(trB.root.position.x - P.bStand[0], trB.root.position.z - P.bStand[2]) < 2.2;
    game.interact({ pos: [P.cabinetB[0], 2.4, P.cabinetB[2]], radius: 1.7, prompt: 'Inspect the bank clock\'s cabinet', once: false, enabled: () => !knows('clockB'), onUse: async () => {
      if (bAtCab()) { ui.subtitle('kai', 'He\'s standing right in front of it.', 2200); return; }
      cine(true);
      await game.shot([P.cabinetB[0] - 1.8, 2.9, P.cabinetB[2] + 1.4], [P.cabinetB[0] + 0.5, 2.5, P.cabinetB[2]], 1.0, { fov: 40 });
      await game.talk([
        ['kai', '"Node B." Same brass. A fuse instead of a relay. Pull it and the bank clock races.'],
        ['kai', 'So that\'s why B parks here. He isn\'t guarding the bank. He\'s guarding the time.'],
      ]);
      cine(false); learn('clockB');
      ev('Sync node B · the bank clock', 'Under the Bank of Meridian\'s pediment clock, a second Continuum cabinet with a sync fuse. Patrol B stands in front of it for two and a half minutes of every loop.', 'MERIDIAN · CLOCK B');
    } });
    game.interact({ pos: [P.cabinetB[0], 2.4, P.cabinetB[2] + 0.3], radius: 1.5, hold: 2.5, prompt: 'Pull the sync fuse (hold)', once: false, enabled: () => knows('clockB') && !S.run.B, onUse: () => {
      if (bAtCab()) { ui.subtitle('kai', 'Not with him standing on it.', 2000); return; }
      desync('B', 'spin');
    } });

    // --- Clock C: the trigger, on the Market Hall gallery ---
    game.interact({ pos: [P.nodeC[0], 5.0, P.nodeC[2]], radius: 1.8, prompt: 'Open the trigger panel (Clock C)', once: false, enabled: () => !S.run.C, onUse: async () => {
      if (!knows('clockC')) {
        cine(true);
        await game.shot([P.nodeC[0] + 2.4, 5.6, P.nodeC[2] + 2.4], [0, 6.6, -68], 1.4, { fov: 44 });
        await game.talk([
          ['kai', 'Four faces, one movement. Node C. The trigger.'],
          ['kai', 'When these hands reach 08:14 the whole district is told it\'s 08:05 again.'],
          ['kai', 'Stopping it won\'t help. It wants its reference. If I set it to the reference early, it\'ll argue with the other two.'],
        ]);
        cine(false); learn('clockC');
        ev('Sync node C · the trigger', 'The four-faced clock under the Market Hall roof is the loop\'s trigger: when its hands reach 08:14:00 it tells the array the time is 08:05:00 and the district resets. Its panel can set the hands by hand.', 'MERIDIAN · CLOCK C');
      }
      const opts = ['08:05:00 — the reset reference', '08:14:00', '08:09:00', 'Close the panel'];
      const i = await choose('kai', knows('plate') ? 'Set the trigger\'s hands. The cabinet on the station roof said…' : 'Set the trigger\'s hands to…', opts);
      if (i === 3) return;
      if (i !== 0) { audio.sfxPlay('fail'); ui.subtitle('kai', i === 1 ? 'That just fires it early. The array would love that.' : 'It slides back into step. It only answers to its own reference.', 3000); return; }
      desync('C', CLOCK0);
    } });
    // the hall's back door (from inside): a short way north to the lane
    game.interact({ pos: [9, 1.2, -81.0], radius: 1.6, prompt: 'Unbar the back door', once: false, enabled: () => !S.run.back, onUse: () => { S.run.back = true; setBackDoor(true); audio.sfxPlay('door'); } });

    const desync = (id, mode) => {
      const c = clocks.byId[id]; if (!c.desync(mode)) return;
      S.run[id] = true; audio.sfxPlay('metal'); shiftPulse = 0.5;
      const n = clocks.count();
      ui.toast(`CLOCK ${id} OUT OF STEP · ${n}/3`, 2000);
      if (n === 1 && once('desync1')) ui.subtitle('kai', 'One clock wrong. The array will just drag it back at 08:14. Unless all three are wrong at once.', 3600);
      F.m9desyncs = Math.max(F.m9desyncs || 0, n);
    };
    // the array lock drops when all three clocks are out of step in the same repetition
    game.onUpdate(() => {
      if (!S.lockLost && clocks.allDesynced()) {
        setShield(false); audio.sfxPlay('anomaly'); shiftPulse = 0.6;
        ui.subtitle('m9pa', 'Array lock lost. Nodes out of step. Mast unshielded.', 3600);
        S.lockLostOnce = true; F.m9lockLost = true;
      }
    });
    // the transmitter's three cores
    W.cores.forEach((c, i) => {
      game.interact({ pos: [c.x, 1.2, c.z], radius: 1.6, hold: 1.4, prompt: 'Pull the transmitter core (hold)', once: false, enabled: () => S.lockLost && !c.pulled, onUse: () => {
        setCore(c, true); S.run.cores = W.cores.filter(x => x.pulled).length; audio.sfxPlay('spark'); game.shake = 0.1; setTimeout(() => { game.shake = 0; }, 300);
        ui.toast(`CORE ${S.run.cores}/3`, 1400);
        if (S.run.cores === 3) sabotage();
        void i;
      } });
    });
    game.interact({ pos: [W.shield.position.x - 4.8, 1.2, W.shield.position.z], radius: 2.2, prompt: 'Look at the transmitter', once: false, enabled: () => !S.lockLost && !S.seen.mastLook2, onUse: () => {
      S.seen.mastLook2 = true;
      ui.subtitle('kai', 'A shield around the base, gold like their emitters. While the three clocks agree, I can\'t touch it.', 3600);
    } });

    // --- the substation cabin: the trapped engineer ---
    game.onUpdate((dt, t) => {
      if (S.run?.freed || !game.control) return;
      if (near(51, -84, 16) && Math.floor(t / 7) !== S.knockT) { S.knockT = Math.floor(t / 7); if (S.knockT % 3 === 0) { audio.sfxPlay('metal'); if (!S.inesMet && once('knockBark')) ui.subtitle(null, '(knocking, from inside the substation cabin: three, then three)', 3200); } }
    });
    game.interact({ pos: [P.intercom[0], 1.2, P.intercom[2] + 0.3], radius: 2.0, prompt: 'Answer the knocking (cabin intercom)', once: false, enabled: () => !S.run?.freed && !S.talkingInes, onUse: () => { talkInes(); } });
    const talkInes = async () => {
      S.talkingInes = true; audio.sfxPlay('blip');
      if (!S.inesMet) {
        cine(true);
        await game.shot([P.intercom[0] - 2.2, 1.9, P.intercom[2] - 1.6], [51, 1.4, -83], 1.2, { fov: 40 });
        const L = loop.iteration;
        await game.talk([
          ['ines', 'Somebody\'s there. Somebody\'s actually there. Say something.'],
          ['kai', 'My name is Kai. I came in through the boundary.'],
          ['ines', L > 3 ? 'Kai. You\'ve said that before. This is the first time you\'ve stayed to the end of it.' : 'Nobody comes in through the boundary. They just — arrive, at 08:05, and forget.'],
          ['ines', 'Ines Calder. City grid. I was in this cabin when their mast came up on Sunday. The blast door runs off it.'],
          ['ines', 'Nine minutes, then the floor tips and I\'m back at 08:05 with my hand on the door. I\'ve stopped counting at four hundred.'],
          ['kai', 'You remember. The loops.'],
          ['ines', 'Engineers remember. It\'s a curse of the job. Listen, because I\'ve had a lot of time to work this out.'],
          ['ines', 'The mast keeps three clocks in step: the station, the bank, the hall. Knock all three out of step in one loop and the array loses its lock.'],
          ['ines', 'Then the shield\'s down. Pull the three cores and the mast dies, and this door with it.'],
          ['ines', 'The gate guard walks off at eleven minutes past for a minute and ten. That\'s your window for the cores.'],
          ['kai', 'And then?'],
          ['ines', 'Then the district still resets. The mast only holds the loop on us. The loop is older.'],
          ['ines', 'But their tower has a ring up top, above the reset. Whoever stands on it at 08:14 doesn\'t go back.'],
          ['ines', 'Get me out, get me up there, and I\'ll give you the lift code. Deal?'],
        ]);
        cine(false); S.inesMet = true; F.m9metInes = true; learn('ines');
        if (!knows('pC')) learn('pC');
        ev('Ines Calder', 'Grid engineer, locked in the substation cabin since the mast came up on Sunday; she remembers every loop. Her plan: knock clocks A, B and C out of step in one loop, pull the mast\'s three cores while the gate guard is away (08:11:00-08:12:10), free her, and reach the ring on Meridian Tower before 08:14:00. Whoever stands on the ring at 08:14 does not reset.', 'MERIDIAN · THE SUBSTATION');
      } else {
        const lines = S.run.A || S.run.B || S.run.C ? ['ines', `${clocks.count()} of three out of step. Keep going. The cores, then me.`] : ['ines', 'Three clocks, one loop. Station, bank, hall. Then the cores at eleven past. I\'m not going anywhere.'];
        await game.talk([lines]);
      }
      S.talkingInes = false;
    };

    // --- sabotage: the mast dies, the cabin opens, the array hunts ---
    const sabotage = () => {
      S.run.sabotaged = true; F.m9sabotaged = true; S.alarm = true; musicState.alarm = 1;
      audio.sfxPlay('boom'); game.shake = 0.25; setTimeout(() => { game.shake = 0; }, 700); shiftPulse = 0.9;
      W.beacon.material.emissiveIntensity = 0.1; W.rings.forEach(r => { r.material.emissiveIntensity = 0.05; });
      ui.subtitle('m9pa', 'Mast failure. Array open. All units: the anomaly is inside the substation.', 3600);
      tween(1.6, u => { W.cabinDoor.position.z = -80 + u * 1.9; }); W.cabinLamp.material.emissive.set(0x5fffa0);
      patrols[3].enabled = true; patrols[4].enabled = true; trD.root.visible = true; trE.root.visible = true;
      ines.root.visible = true; ines.root.position.set(50.6, 0, -80);
      setTimeout(() => { if (game.token === tok) freeInes(); }, 900);
    };
    const freeInes = async () => {
      S.run.freed = true; S.inesFreedOnce = true; F.m9inesFreed = true;
      // she limps out through the door to Kai
      const from = ines.root.position.clone(), to = new THREE.Vector3(46.4, 0, -80); let u = 0;
      await new Promise(res => { const off = game.onUpdate(dt => { u = Math.min(1, u + dt / 2.2); ines.root.position.lerpVectors(from, to, u); ines.speed = u < 1 ? 1.4 : 0; ines.faceTowards(to.x, to.z, dt, 8); if (u >= 1) { off(); res(); } }); });
      S.inesWith = true;
      if (!S.inesMet) {
        await game.talk([['ines', 'You — you got the door. Whoever you are, I\'m Ines. The tower. The lift code\'s mine. Move!']]);
        S.inesMet = true; F.m9metInes = true; learn('ines');
      } else await game.talk([['ines', 'Air. Real air. Don\'t look at me, look at the clock. The tower, Kai. Go!']]);
    };
    // Ines follows Kai (she limps; she catches up when out of sight)
    game.onUpdate((dt) => {
      if (!S.inesWith || S.lifting) return;
      const r = ines.root.position, dx = pl.pos.x - r.x, dz = pl.pos.z - r.z, d = Math.hypot(dx, dz);
      ines.lookTarget = null;
      if (d > 26) { r.set(pl.pos.x - dx / d * 3, pl.pos.y, pl.pos.z - dz / d * 3); return; }
      if (d > 2.2) { const sp = Math.min(d > 8 ? 4.6 : 3.4, d * 1.5); r.x += dx / d * sp * dt; r.z += dz / d * sp * dt; ines.speed = sp; ines.faceTowards(pl.pos.x, pl.pos.z, dt, 6); }
      else ines.speed = 0;
      r.y += (pl.pos.y - r.y) * Math.min(1, dt * 4);
    });

    // --- the tower lift ---
    game.interact({ pos: [-35.0, 1.2, -95.2], radius: 1.8, prompt: 'Call the tower lift', once: false, enabled: () => !S.lifting && !S.top, onUse: () => {
      if (!S.inesWith) { audio.sfxPlay('fail'); ui.toast('MERIDIAN TOWER · CONTROL STAFF ONLY\nACCESS CODE REQUIRED', 2600); ui.subtitle('kai', S.inesMet ? 'Ines has the code. I need her out of that cabin first.' : 'Locked. Somebody who works here would know the code.', 3000); return; }
      if (Math.hypot(ines.root.position.x - pl.pos.x, ines.root.position.z - pl.pos.z) > 6) { ui.subtitle('kai', 'Ines! The lift!', 1800); return; }
      rideLift();
    } });
    const rideLift = async () => {
      S.lifting = true; cine(true); audio.sfxPlay('door');
      ui.subtitle('ines', '0-8-1-4. They never change it. Nobody here ever gets a tomorrow to change it in.', 3400);
      W.liftPanel.material.emissive.set(0x5fffa0);
      pl.place(-36.4, Y0, -95.6, 0); ines.root.position.set(-37.1, Y0, -96.6); ines.speed = 0; ines.faceTowards(-37.1, -90, 1, 30);
      await game.shot([-30.5, 3.0, -99.5], [-36.6, 1.6, -96], 1.2, { fov: 44 });
      const y0 = 0, y1 = 48 - Y0;
      await tween(6.5, u => {
        const y = y0 + (y1 - y0) * u;
        W.liftCab.position.y = y; pl.pos.y = Y0 + y; pl.char.root.position.y = Y0 + y; ines.root.position.y = Y0 + y;
        game.engine.camera.position.set(-30.5 + u * 2, 3 + y * 1.02, -99.5 + u * 1.5); game.cine.look.set(-36.6, 1.6 + y, -96); game.cine.to.l.set(-36.6, 1.6 + y, -96); game.cine.to.p.copy(game.engine.camera.position);
      });
      pl.place(P.deck[0], 48, -93.6, 0); ines.root.position.set(-37.2, 48, -93.2);
      S.top = true; S.lifting = false; F.m9tower = true;
      cine(false);
    };
    game.interact({ pos: [P.anchor[0], 49.2, P.anchor[2] + 0.4], radius: 1.8, prompt: 'Put your band to the ring', enabled: () => S.top && !S.final, onUse: () => { S.anchorUse = true; } });

    // --- residue at the tower door: the ninth minute of the first loop (Residue Vision) ---
    W.ghost = (() => { try { const c = game.actor('m9echo', { ...CAST.witness.look, era: '2049' }, -35.6, Y0, -95.2, -Math.PI / 2); c.setGhost(0xff6a4a); c.pose = 'work'; game.residue(c.root); return c; } catch (err) { console.warn('m9 echo', err); return null; } })();
    game.interact({ pos: [-35.0, 1.2, -96.6], radius: 2.0, prompt: 'Read the residue at the lift', once: false, enabled: () => game.residueOn && !S.ev.has('echo'), onUse: async () => {
      cine(true); lockMusic('m9-reset');
      await game.shot([-31.5, 2.0, -97.5], [-35.6, 1.4, -95.2], 1.4, { fov: 36 });
      await game.talk([
        ['kai', 'Residue. Older than all the loops. 08:13:59, the very first time.'],
        ['m9figure', 'Here. Hold it here. Until he is ready.'],
        ['kai', 'A long coat. A band on his wrist like mine. He rode the lift to the ring one second before the first reset.'],
      ]);
      lockMusic(null); cine(false); evidence('echo');
    } });

    // --- The Ninth Minute: Evidence (optional, five pieces) ---
    const EV = {
      order: ['Continuum standing order', 'On the guard post\'s slate: "Meridian is the first district. Hold the nine minutes. Do not let the ninth minute complete. Array power: Helix resonance relay. Anchor: tower ring, do not touch. Auth: Prefect. Repeat indefinitely."'],
      crate: ['A Helix crate in the yard', '"HELIX · Chronolith resonance relay · 3 of 3 · Authorised: E. Rook · Delivered 18.10.2049, Meridian substation." The Continuum array runs on Helix hardware, delivered the night before the Zero Second.'],
      tv: ['Rain City 1, Sunday morning', 'The TV shop runs the same bulletin every loop: "Helix test scheduled for 08:00. Meridian substation lends its grid to the Chronolith programme." At 08:12 Rook: "a routine resonance study, no risk to the public."'],
      rhee: ['Officer Rhee, Continuum', '"Every district that loops starts like this one. Nine minutes, then the war. This is where it began: the first nine minutes, and somebody anchored them from the tower before we ever came."'],
      echo: ['Residue at the tower lift', 'At 08:13:59 of the first loop a long-coated man with a Chronolith band like Kai\'s rode the lift to the tower ring: "Here. Hold it here. Until he is ready." The loop was anchored before the Continuum arrived.'],
    };
    const evidence = (k) => {
      if (S.ev.has(k)) return; S.ev.add(k); F.m9ninthEvidence = S.ev.size;
      ev(EV[k][0], EV[k][1], `THE NINTH MINUTE · EVIDENCE ${S.ev.size}/5`);
      audio.sfxPlay('pickup');
      if (S.ev.size === 5 && once('ninthDone')) setTimeout(async () => {
        if (game.token !== tok) return;
        F.m9ninthMinute = true;
        ui.subtitle('kai', 'Helix built the relay. The Continuum run the array. But the anchor was here first. The war repeats because someone keeps holding the ninth minute open.', 6000);
        ev('The Ninth Minute', 'The hidden cause of the repeating war: Meridian was the first district to loop, and its anchor on Meridian Tower was set at 08:13:59 of the first repetition by a man wearing a Chronolith band like Kai\'s. Helix supplied the power; the Continuum only hold what was already held.', 'OPTIONAL · THE NINTH MINUTE');
      }, 1200);
    };
    game.interact({ pos: [31.4, 1.2, -59.6], radius: 1.6, prompt: 'Read the slate in the guard post', once: false, enabled: () => !S.ev.has('order'), onUse: () => { evidence('order'); ui.subtitle('kai', '"Do not let the ninth minute complete." Hensel stopped his dial one minute short, too.', 3800); } });
    game.interact({ pos: [37.5, 1.0, -82.0], radius: 1.7, prompt: 'Read the label on the white crate', once: false, enabled: () => !S.ev.has('crate'), onUse: () => { evidence('crate'); ui.subtitle('kai', 'Helix. Rook signed for the thing that keeps this district in a box.', 3200); } });
    game.interact({ pos: [-8.8, 1.4, 3.8], radius: 2.2, prompt: 'Watch the news in the shop window', once: false, enabled: () => !S.ev.has('tv'), onUse: () => { evidence('tv'); ui.subtitle('kai', loop.t > AT(12) ? '"No risk to the public." Two minutes before it.' : '"Lends its grid to the Chronolith programme." My programme. In some version.', 3600); } });
    game.interact({ pos: [P.officer[0] + 1.2, 1.2, P.officer[2]], radius: 2.2, prompt: 'Talk to the officer without a helmet', once: false, enabled: () => rhee.root.visible && loop.window(RHEE[0], RHEE[1]) && !S.alarm && !S.talkingRhee, onUse: async () => {
      S.talkingRhee = true; rhee.lookTarget = kai.head; kai.lookTarget = rhee.head;
      cine(true);
      await game.shot([P.officer[0] + 2.4, 1.8, P.officer[2] + 1.6], [P.officer[0], 1.6, P.officer[2]], 1.2, { fov: 38 });
      if (!S.seen.rhee1) {
        await game.talk([
          ['rhee', 'Stay where you are. — No. Don\'t. Sit down. You make me tired.'],
          ['rhee', 'You did that already. No — you\'re about to do it. I hate that I know the difference.'],
          ['kai', 'You remember the loops.'],
          ['rhee', 'Pieces. We\'re issued emitters so the loop slides off us. It\'s stopped sliding.'],
        ]);
        const c = await choose('rhee', 'What do you want, anomaly?', ['Why are you holding this district?', 'Let me pass. Don\'t report me.', 'Nothing. Take your break.']);
        if (c === 0) {
          await game.talk([
            ['rhee', 'Because it\'s the first. Every district that loops starts like this one. Nine minutes, then the war.'],
            ['rhee', 'We didn\'t make it loop. Somebody anchored it from the tower before we ever came. We just keep it from spreading.'],
          ]);
          evidence('rhee'); F.m9rhee = 'asked';
        } else if (c === 1) {
          await game.talk([['rhee', 'I never saw you. I never see anyone. In nine minutes neither of us will have been here.'], ['rhee', 'B parks on the bank steps on odd loops early, even loops late. Don\'t ask me how I know which this is.']]);
          if (!knows('pB1')) learn('pB1'); if (!knows('pB0')) learn('pB0');
          F.m9rhee = 'spared';
        } else { await game.talk([['rhee', 'Thank you. That\'s the first thing in four hundred loops that went differently.']]); F.m9rhee = 'left'; }
        S.seen.rhee1 = true; F.m9awareTalk = true;
      } else await game.talk([['rhee', 'Again? Fine. Odd loops early, even loops late. And the tower: nobody touches the ring.']]);
      rhee.lookTarget = null; kai.lookTarget = null; cine(false); S.talkingRhee = false;
    } });

    // --- the mother and her son: warn them before 08:13:20 ---
    game.interact({ pos: [0, 1.2, 0], radius: 2.4, prompt: 'Warn the mother away from the awning', once: false, enabled: () => mother.root.visible && loop.window(AWNING - 70, AWNING - 2) && !S.warned[loop.iteration] && Math.hypot(pl.pos.x - mother.root.position.x, pl.pos.z - mother.root.position.z) < 3, onUse: async () => {
      S.warned[loop.iteration] = true; F.m9familySaved = (F.m9familySaved || 0) + 1;
      mother.lookTarget = kai.head;
      const first = !S.seen.mom1; S.seen.mom1 = true;
      await game.talk(first ? [
        ['kai', 'Excuse me — cross here. Please. Not under the bakery awning.'],
        ['m9mother', 'The awning? ...Do I know you? I keep dreaming this street. Something falls.'],
        ['m9mother', 'Come on, love. We\'ll cross. The nice man says so.'],
      ] : [['kai', 'Cross here. Not under the awning.'], ['m9mother', 'You again. I knew you\'d say that.']]);
      mother.lookTarget = null;
      if (first) ev('A mother on Meridian Avenue', 'Every loop at 08:13:20 the bakery awning falls on a mother and her son. Warned, they cross the avenue instead. "Do I know you? I keep dreaming this street."', 'OPTIONAL · MERIDIAN AVENUE');
    } });
    game.onUpdate(() => { const it = game.interactables.find(i => i.prompt.startsWith('Warn the mother')); if (it) it.pos.set(mother.root.position.x, 1.2, mother.root.position.z); });

    // --- Café Ostra: Dev, who notices a little more each loop ---
    game.interact({ pos: [-15.2, 1.2, 37], radius: 2.0, prompt: 'Talk to Dev behind the counter', once: false, onUse: async () => {
      dev.lookTarget = kai.head; const it = loop.iteration;
      const L = [
        [['dev', 'Morning! Sunday special, flat white and a cardamom bun. You look like you walked through rain that isn\'t here.'], ['kai', 'Something like that.']],
        [['dev', 'Morning. Second coffee? ...Why did I say second. You haven\'t had a first.']],
        [['dev', 'I keep putting out the same cup. Same chip in the rim. Same time on the clock. 08:05. Every time I look.'], ['kai', 'It\'s always 08:05 here, Dev.'], ['dev', 'Don\'t say that. I\'ve got a kid starting school tomorrow.']],
        [['dev', 'You\'re the one who comes in from the rain. I\'ve started leaving a cup for you.'], ['kai', 'Thank you.'], ['dev', 'Whatever you\'re doing out there — do it. I\'d like a Monday.']],
      ];
      await game.talk(L[Math.min(L.length - 1, Math.max(0, it - 2))]);
      dev.lookTarget = null; F.m9dev = Math.max(F.m9dev || 0, it);
    } });
    game.interact({ pos: [P.radio[0], P.radio[1], P.radio[2]], radius: 1.6, prompt: 'Listen to the café radio', once: false, onUse: () => {
      ui.subtitle(null, loop.t < AT(8) ? 'RADIO: …Sunday morning, eight minutes past, and Rain City is waking up wet…' : loop.t < AT(12) ? 'RADIO: …Helix says this morning\'s test is routine. Traffic is light on the avenue…' : 'RADIO: …thirteen minutes past eight on a quiet Sunday— (the voice catches, like a needle)', 4200);
    } });

    // --- shards ---
    SHARDS.forEach((p, i) => {
      game.interact({ pos: [p[0], p[1], p[2]], radius: 1.6, prompt: 'Take the temporal shard', onUse: () => {
        W.shards[i].parent?.remove(W.shards[i]); S.shards++; F.shards = (F.shards || 0) + 1; F.m9shards = S.shards;
        audio.sfxPlay('anomaly');
        ev(`Temporal shard · ${['Lantern Alley', 'the station roof', 'the fountain', 'the Market Hall', 'the tower plaza'][i]}`, ['Behind the bins in Lantern Alley, the one thing in the district that does not move back at 08:14.', 'Against the station parapet, where the nine minutes fold over the square.', 'In the fountain basin, under water that never finishes falling.', 'Under a stall in the Market Hall, humming in step with nothing.', 'At the foot of Meridian Tower, where the first loop was anchored.'][i], `TEMPORAL SHARD · ${S.shards}/5`);
        ui.toast(`TEMPORAL SHARD ${S.shards}/5\nIt stays when the loop resets`, 2200);
      } });
    });

    // =====================================================================================================
    // SCRIPT
    // =====================================================================================================
    ui.missionTag('MISSION 9 · NINE MINUTES TO ZERO'); ui.show('hud', true);
    pl.place(2, 0, 54.0, Math.PI);
    game.control = false; ui.letterbox(true);
    loop.hudWanted = false; loop.start(AT(9, 40)); loop.paused = true;
    audio.setTheme(null);
    await game.shot([-30, 46, -112], [0, 8, -30], 0.01, { fov: 52 });
    await ui.fade(0, 1600);
    lockMusic('m9-loop'); audio.setTheme('m9-loop', 2);
    const cc = ui.chapterCard('ACT II · THE NINE-MINUTE WAR', 'Nine Minutes to Zero', 'The Meridian district · Rain City · Sunday 19.10.2049 · 08:09', 4400);
    await game.shot([-6, 30, -70], [4, 6, -20], 6.0, { fov: 48 });
    await cc;
    await game.shot([12, 12, -20], [-31, 17, -30], 2.6, { fov: 40 });   // the station clock, the bank clock
    await game.shot([12, 4, 30], [2, 3, 54], 2.4, { fov: 46 });          // down the avenue to the boundary
    // Kai through the boundary: the radio from the cordon dies as he crosses
    const trusted = F.trustedHale !== false;
    await game.talk([
      [trusted ? 'hale' : 'm9radio', trusted ? 'Kai, that\'s the Meridian cordon. It\'s been sealed since Sunday. People walk in at nine minutes past eight—' : 'Helix cordon. Meridian is sealed. Turn back, sir. Turn—'],
      ...(F.m8yara === 'saved' && CAST.yara ? [['yara', 'Kai, it\'s Yara. It\'s holding the nine minutes before 08:14. Like the field held me. Don\'t let it keep you—']] : []),
    ]);
    audio.sfxPlay('switch'); shiftPulse = 0.9;
    loop.paused = false;
    await tween(2.0, u => { pl.place(2, 0, 54 - u * 3.2, Math.PI); kai.speed = 1.6; });
    kai.speed = 0;
    await game.shot([4.2, 1.7, 47.6], [2, 1.5, 50.8], 1.2, { fov: 40 });
    await game.talk([
      ['kai', 'The radio\'s dead. And the sky — it\'s morning.'],
      ['kai', 'Sunday morning. Nine minutes past eight. Five minutes before the Zero Second.'],
    ]);
    if (F.ninthMinute) await game.say('kai', '"Do not let him see the ninth minute." The reel in Hensel\'s tower. I\'m standing in it.');
    cine(false); lockMusic(null);
    loop.hudWanted = true;
    ui.toast(ui.words('THE MERIDIAN LOOP\nThe ring shows where you are in the nine minutes · what you learn stays'), 5200);
    S.phase = 'loop1';
    objective('Climb to the station clock (west of the square) and watch the district');
    hint(() => !onRoof() && !S.firstReset, 70, () => ui.subtitle('kai', 'The station on the west side of the square. The stair runs up its south wall.', 3000));
    hint(() => !S.firstReset && near(0, -30, 30) && !onRoof(), 40, () => ui.subtitle('kai', ui.words('Gold cones on the ground. Their eyes. Crouch (C) and they see less.'), 3000));
    await game.waitFor(() => onRoof() || S.firstReset);
    if (onRoof() && !S.firstReset) {
      cine(true);
      await game.shot([-29.4, 9.2, -21.5], [8, 2, -34], 2.2, { fov: 50 });
      await game.talk([
        ['kai', 'Soldiers in white armour. Not Helix. Not police. Those emitters on their chests...'],
        ['kai', 'Everyone else is just living a Sunday morning. The same one, by the look of them.'],
      ]);
      cine(false);
      objective('Watch the square through the scope at the east parapet');
      await game.waitFor(() => S.scopeUsed || S.firstReset);
      if (!S.firstReset) {
        objective(`Wait. It's ${loop.clockAt().slice(0, 5)}. Something happens at 08:14`);
        const t = setInterval(() => { if (game.token !== tok || S.firstReset) { clearInterval(t); return; } if (game.control && !S.scoping) objective(`Wait for 08:14 · ${loop.clockAt()}`); }, 1000);
        hint(() => !S.firstReset && loop.t < DUR - 60, 40, () => ui.subtitle('kai', 'The clocks are all counting toward the same minute. I\'ll wait and see what they\'re counting to.', 3200));
      }
    }
    await game.waitFor(() => S.firstReset && game.control);
    learn('reset');
    // the voice from the speakers
    cine(true); lockMusic('m9-reset');
    S.phase = 'map';
    await game.shot([4.0, 1.7, 46.6], [-6.6, 4.4, 26], 1.6, { fov: 40 });
    audio.sfxPlay('spark');
    await game.talk([['kai', 'I was on the roof. Now I\'m back at the boundary, and it\'s five past eight again.']]);
    await game.shot([-4.4, 2.4, 30.0], [-6.6, 4.6, 26], 1.6, { fov: 30 });
    audio.sfxPlay('motif');
    await game.talk([['m9voice', 'You have nine minutes.']]);
    await game.shot([-3.4, 1.7, 33.2], [pl.pos.x, 1.6, pl.pos.z], 1.0, { fov: 36 });
    await game.talk([['kai', 'To do what?']]);
    await game.shot([-6.0, 3.8, 28.4], [-6.6, 4.6, 26], 1.4, { fov: 26 });
    await game.talk([['m9voice', 'To become me.']]);
    audio.silence(1.2); await game.wait(1.0);
    F.m9voice = true;
    await game.shot([5.0, 1.8, 44.5], [1.5, 1.5, 48.8], 1.4, { fov: 40 });
    await game.talk([
      ['kai', 'That voice. The station. The catwalk. Helix.'],
      ['kai', 'Nine minutes, and then it all goes back. Me with it. Only what I know comes through.'],
    ]);
    ev('"You have nine minutes."', 'At 08:05 the Meridian public address speakers carried a voice Kai has heard before (Central Station, the catwalk, the security log): "You have nine minutes." / "To do what?" / "To become me."', 'MERIDIAN · THE PA');
    lockMusic(null); cine(false);
    ui.toast(ui.words('LOOP MEMORY\nEach loop the patrols, people and damage shift a little · you keep what you learn'), 4600);

    // ---------- observe two loops, map the patrols, find the three clocks, find the engineer ----------
    const mapped = () => ['pA', 'pB1', 'pB0', 'pC'].filter(k => knows(k)).length;
    const found = () => ['clockA', 'clockB', 'clockC'].filter(k => knows(k)).length;
    const prepObj = () => `Map the patrols (${mapped()}/4) · find the three clocks (${found()}/3)${S.inesMet ? '' : (knows('clockA') ? ' · the knocking in the substation' : '')}`;
    hint(() => mapped() < 4 && !onRoof(), 120, () => ui.subtitle('kai', mapped() < 1 ? 'The roof scope. From up there I can see all three of them.' : !knows('pC') ? 'The substation guard. He\'ll have to move sometime. The roof or the gate, at eleven past.' : 'Patrol B changes from loop to loop. I need to see him on the bank steps in an odd loop and an even one.', 3600));
    hint(() => found() < 3 && mapped() >= 2, 150, () => ui.subtitle('kai', !knows('clockA') ? 'The station clock. There was a cabinet under it.' : !knows('clockB') ? 'The bank clock. The cabinet\'s on the portico — when B isn\'t standing on it.' : 'Clock C is inside the Market Hall. The shutter opens at ten past.', 3400));
    hint(() => !S.inesMet && knows('clockA'), 160, () => ui.subtitle('kai', 'Someone keeps knocking in the substation. The lane behind the yard runs right past the cabin.', 3400));
    while (!(mapped() === 4 && found() === 3 && S.inesMet)) {
      objective(prepObj());
      const sig = mapped() + found() * 10 + (S.inesMet ? 100 : 0);
      await game.waitFor(() => mapped() + found() * 10 + (S.inesMet ? 100 : 0) !== sig);
      if (mapped() === 4 && once('mapDone')) {
        F.m9patrolsMapped = true;
        ev('The patrol map', 'Two loops of watching: Patrol A laps the fountain every 1:25. Patrol B guards the bank clock 08:06:30-08:09 on odd loops and 08:09-08:12 on even loops. Patrol C holds the substation gate except 08:11:00-08:12:10.', 'MERIDIAN · KNOWLEDGE');
        ui.subtitle('kai', 'Odd loops early, even loops late. And the gate, once, at eleven past. I have them.', 3200);
      }
      if (found() === 3 && once('clocksDone')) { F.m9clocks = 3; ui.subtitle('kai', 'Three clocks. Station, bank, hall. All of them ticking the same nine minutes.', 3000); }
    }

    // ---------- the plan ----------
    await game.waitFor(() => game.control && !ui.dlgActive);
    S.phase = 'plan';
    cine(true);
    await game.shot([pl.pos.x + 2.4, pl.pos.y + 1.9, pl.pos.z + 2.4], [pl.pos.x, pl.pos.y + 1.5, pl.pos.z], 1.2, { fov: 40 });
    await game.talk([
      ['kai', 'All right. One loop. Everything in order.'],
      ['kai', 'Clock A on the station roof — any time. Clock B when Patrol B isn\'t on the steps. Clock C once the hall opens at ten past.'],
      ['kai', 'Then the cores while the gate is empty, eleven past to twelve-ten. Ines. The tower. Before 08:14.'],
      ['kai', 'Miss one step and I start again at 08:05. Knowing a little more.'],
    ]);
    learn('plan');
    ev('The plan', 'In one loop: knock clocks A (station roof, hold the relay), B (bank portico, pull the fuse, outside Patrol B\'s window) and C (Market Hall gallery, set the trigger to 08:05:00) out of step; pull the mast\'s three cores while Patrol C is away (08:11:00-08:12:10); free Ines; take the lift to the ring on Meridian Tower before 08:14:00.', 'MERIDIAN · THE PLAN');
    cine(false);
    S.phase = 'run';
    const runObj = () => {
      const r = S.run;
      if (S.top) return 'The ring on Meridian Tower: put your band to it before 08:14:00';
      if (r.freed) return `Get Ines to Meridian Tower (north-west) before 08:14:00 · ${loop.clockAt().slice(0, 8)}`;
      if (r.sabotaged) return 'Get Ines out of the cabin';
      if (S.lockLost) return `Pull the three transmitter cores (${r.cores}/3) · gate empty 08:11:00-08:12:10 · ${loop.clockAt().slice(0, 8)}`;
      return `In one loop: clocks out of step A${r.A ? '✓' : '·'} B${r.B ? '✓' : '·'} C${r.C ? '✓' : '·'} · then the cores · ${loop.clockAt().slice(0, 8)}`;
    };
    const objT = setInterval(() => { if (game.token !== tok || S.phase === 'end') { clearInterval(objT); return; } if (game.control && !ui.dlgActive) objective(runObj()); }, 500);
    hint(() => S.phase === 'run' && !S.run.A && !S.run.B && !S.run.C && loop.t > 120, 60, () => ui.subtitle('kai', 'Clock A first. It doesn\'t care when.', 2600));
    hint(() => S.lockLost && !S.run.sabotaged && !loop.window(C_AWAY[0], C_AWAY[1]) && loop.t < C_AWAY[0], 45, () => ui.subtitle('kai', 'The shield\'s down. Now I wait for the gate guard to walk. Eleven past.', 3000));
    hint(() => S.run.freed && !S.top, 40, () => ui.subtitle('ines', 'North lane, then west to the tower! Stay low behind the crates!', 3000));
    hint(() => S.phase === 'run' && loop.t > C_AWAY[1] && !S.run.sabotaged && clocks.count() < 3, 30, () => ui.subtitle('kai', 'Too late for the cores this loop. Use it: practise the route, learn something. Or wait for the reset.', 3600));

    // ---------- the ring: hold it through 08:14 ----------
    await game.waitFor(() => S.anchorUse);
    S.final = true; S.phase = 'end';
    cine(true); lockMusic('m9-outside');
    pl.place(P.anchor[0], 48, P.anchor[2] + 1.0, Math.PI);
    await game.shot([P.anchor[0] + 2.4, 49.8, P.anchor[2] + 2.2], [P.anchor[0], 49.0, P.anchor[2]], 1.4, { fov: 36 });
    kai.pose = 'work'; audio.sfxPlay('switch'); shiftPulse = 0.6; kai.wristBoost = 8;
    await game.talk([
      ['kai', 'A band in the ring. Worn through to the metal. Somebody scratched letters into it.'],
      ['kai', '"K.V." ...It\'s mine. It\'s my band, twenty years older.'],
    ]);
    F.m9anchorKV = true;
    ev('The anchor on the ring', 'Set into the ring on Meridian Tower: a Chronolith wrist band, worn through to the metal and scratched "K.V.". Kai\'s own band, much older. It has been holding the district\'s nine minutes since the first loop.', 'MERIDIAN TOWER');
    await game.shot([P.anchor[0] - 2.6, 49.6, P.anchor[2] + 3.4], [P.anchor[0], 49.0, P.anchor[2]], 1.6, { fov: 40 });
    ines.lookTarget = kai.head; kai.lookTarget = ines.head;
    await game.talk([
      ['ines', 'Is that your face when you\'re scared? Put your hand on it. Whatever it is, it\'s above the line.'],
      ['kai', 'If this works, you\'ll remember everything. All four hundred.'],
      ['ines', 'I already do. I\'d just like the four hundred and first to be a Monday.'],
    ]);
    kai.lookTarget = null; ines.lookTarget = null; kai.pose = null;
    if (loop.t < DUR - 24) { await ui.fade(1, 500); loop.skipTo(DUR - 24); await game.wait(0.3); await ui.fade(0, 600); }
    await game.shot([-30, 52, -84], [-2, 8, -40], 2.4, { fov: 52 });
    ui.subtitle(null, 'The district below: the tram at the square, the vendor at his stall, the clocks on the last minute.', 4000);
    await game.waitFor(() => S.zeroNow);
    // ---------- 08:14:00 — the city resets; Kai does not ----------
    audio.silence(1.6); audio.sfxPlay('heartbeat'); freezeAll(true);
    ui.toast('08:14:00', 1800);
    let fz = 0; const offF = game.onUpdate(dt => { fz = Math.min(1, fz + dt); game.engine.fx.uFreeze.value = fz * 0.7; });
    await game.wait(1.8);
    offF(); game.engine.fx.uFreeze.value = 0;
    audio.sfxPlay('rewind'); shiftPulse = 1.0;
    // the reset wave washes the district back to 08:05 below the ring
    const wave = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    wave.position.set(0, 0, -68); scene.add(wave);
    await game.shot([-40, 55, -80], [0, 4, -45], 0.01, { fov: 56 });
    await tween(3.2, u => { wave.scale.setScalar(1 + u * 120); wave.material.opacity = 0.24 * (1 - u * 0.9); });
    wave.parent?.remove(wave);
    freezeAll(false);
    // the city below goes back; Kai and Ines do not
    loop.paused = false; S.outside = true;
    loop.t = 0; loop.iteration++; for (const e of loop.events) e.fired = false; loop.restoreTracked(); restoreRepetition();
    ines.root.visible = true; ines.root.position.set(-37.2, 48, -93.2);
    const lbl = loop.hud?.querySelector('.lh-label'); if (lbl) lbl.textContent = 'OUTSIDE THE LOOP';
    loop.iterLabel = () => 'YOU: 08:14:01 · THE DISTRICT';
    F.m9outsideLoop = true; F.kaiOutsideLoop = true; F.m9done = true;
    await game.shot([P.anchor[0] + 1.8, 49.7, P.anchor[2] + 2.6], [P.anchor[0], 49.3, P.anchor[2] + 0.6], 1.6, { fov: 36 });
    await game.talk([
      ['kai', 'It reset.'],
      ['kai', 'I didn\'t.'],
      ['ines', 'Down there it\'s five past eight again. Up here it\'s — what is it up here?'],
      ['kai', 'Fourteen minutes past. And one second. The first second after.'],
    ]);
    // the long coat on the station tower: he didn't reset either
    figure.root.visible = true; figure.lookTarget = null;
    await game.shot([P.anchor[0] - 0.6, 49.9, P.anchor[2] + 1.4], [-35, 22.2, -30], 2.4, { fov: 18 });
    audio.sfxPlay('motif');
    await game.talk([['kai', 'On the station clock. A long coat. He\'s not moving back with the rest of them, either.']]);
    await tween(1.6, u => { figure.root.position.y = 20.9 - u * 0.02; }); figure.root.visible = false;
    await game.shot([P.anchor[0] + 2.2, 49.8, P.anchor[2] + 3.0], [P.anchor[0], 49.2, P.anchor[2]], 1.4, { fov: 40 });
    await game.talk([
      ['m9command', 'Meridian array to all units. Two signatures outside the loop. Meridian Tower ring.'],
      ['m9command', 'They remember. Retrieve them.'],
      ['ines', 'They\'re coming up.'],
      ['kai', 'Let them. Everything I learned down there, I still have. Every patrol. Every minute.'],
      ['kai', 'Nine minutes. To become him.'],
    ]);
    F.m9ines = 'outside';
    ev('Outside the loop', 'At 08:14:00 the Meridian district reset to 08:05 again. Kai and Ines, on the ring above the reset, did not: Kai keeps everything he learned and no longer resets with the city. The long-coated figure on the station clock did not reset either. The Continuum array: "Two signatures outside the loop. They remember. Retrieve them."', 'MERIDIAN TOWER');
    audio.sfxPlay('alarm');
    await game.shot([-36.5, 53, -84], [-36, 47, -96], 3.0, { fov: 54 });
    await ui.fade(1, 2400);
    loop.dispose();
    const mins = Math.round((game.time - tStart) / 60);
    await ui.chapterCard('MISSION 9 COMPLETE', 'Nine Minutes to Zero', `Loops lived ${F.m9loops || loop.iteration} · Evidence ${S.ev.size}/5 · Shards ${S.shards}/5${mins ? ' · ' + mins + ' min' : ''}`, 3600);
    ui.letterbox(false); game.releaseCam();
  },
};
