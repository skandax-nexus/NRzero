// MISSION 7 · THE BROKEN OBSERVATORY (Act I) — vertical exploration and celestial logic.
// Bible beats: align three instruments using the sun and stars in different states · traverse rooftops, rotating
// platforms and an exterior ring · fight temporal scavengers whose attacks displace objects backward · discover dates
// that span thousands of years, including Kai's birth date ("How could they know when I would be born?" / "They
// didn't know when. They knew who.") · ending: Mira's hidden recording implies the Chronolith has been anticipating
// Kai, not merely recording him. Shared system owned here: src/systems/alignment.js.
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { buildObservatory, registerM7Cast, registerM7Themes, P, Y, DC, SCAV_LOOKS, ACOLYTES, musicState, hallState, ERAS } from '../world/env_m7.js';
import { Instrument, StarField, OrreryRing, bearingDir, rzAzimuth, relativeWords, angleBetween, ask } from '../systems/alignment.js';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { glowMat } from '../world/kit.js';

const { C, ET, R1, R2, R3, T1, RING, TOP } = Y;
const DEG = Math.PI / 180;
const polar = (th, r) => [DC[0] + Math.sin(th * DEG) * r, DC[1] - Math.cos(th * DEG) * r];
const bearingAround = (x, z) => { let b = Math.atan2(x - DC[0], -(z - DC[1])) / DEG; if (b < 0) b += 360; return b; };

// Where things are in each sky (compass bearing, altitude), latitude 38.2 N
const SUN = { bearing: 62, alt: 6 };            // c. 1000 BCE, a summer dawn: the sun at the eastern notch
const POLE = { bearing: 0, alt: 38.2 };          // the celestial pole; Polaris sits on it in 2049
const VENUS = { bearing: 272, alt: 14 };         // 2196 dusk: the evening star after sunset
const DUSK_SUN = { bearing: 292, alt: -1.5 };

// The Hall of Dates: sixteen dates and the seventeenth stone
const DATES = [
  ['c. 1130 BCE', 'The first fire. The house is raised around the black stone.', 'The first fire. They built this house around the Chronolith — or it was already here and they built around it.'],
  ['c. 1000 BCE', 'The river is taught to turn east.', 'The river taught to turn east.'],
  ['15 June 763 BCE', 'The sun goes dark at midday.', 'An eclipse. Fifteenth of June, 763 BC. They saw it from this roof.'],
  ['28 May 585 BCE', 'Two armies stop fighting when the sun goes out.', 'Another eclipse. 585 BC — the one that stopped a battle.'],
  ['240 BCE', 'A star with a tail crosses the house.', 'A comet. 240 BC. Halley\'s, if the count is right.'],
  ['4 July 1054', 'A new star, bright enough to see by day.', 'Fourth of July, 1054. A supernova — the Crab. Two thousand years after the first fire, and they\'re still counting.'],
  ['11 November 1572', 'Another new star in the queen\'s chair.', 'November 1572. Tycho\'s star. The house was a ruin by then, and still somebody carved it.'],
  ['1883', 'The sky burns red for a whole year.', 'Krakatoa. The sunsets turned red all over the world.'],
  ['20 July 1969', 'A footprint on the white stone of the night.', 'The Moon landing. A footprint on the white stone of the night.'],
  ['14 June 2026', 'The clockmaker\'s door. Two children.', 'Fourteenth of June, 2026. Hensel\'s ledger. Mira and me at his counter.'],
  ['2029', 'People in white find the heart of the ring.', '2029. Helix\'s survey of Site Zero. "People in white."'],
  ['February 2031', 'The valley drowns.', 'February 2031. Reservoir 7. Niko\'s village under the water.'],
  ['2041', 'A sister returns who should not.', '2041. "A sister returns who should not." Mira died in 2026.'],
  ['2049 · 08:14', 'The second that does not end.', 'The Zero Second. Eight-fourteen. They carved it three thousand years early.'],
  ['2196', 'The sky breaks.', '2196. "The sky breaks." The future — the one I keep switching into.'],
  ['—', 'Blank. Not worn away: smoothed, and left ready.', 'This one is blank. Not worn. Smoothed — waiting for a date that hasn\'t happened.'],
];
const KAI_BIRTH = '3 November 2018';

export default {
  id: 'm7', act: 'ACT I · THE WORLD THAT REMEMBERS', title: 'The Broken Observatory', sub: 'Celestial alignment',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time, tok = game.token;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM7Cast(); registerM7Themes();
    try {
      const need = ['sefa', 'dace'].filter(id => !ui.portraits[id] && CAST[id]?.look);
      if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]]))));
    } catch (err) { console.warn('m7 portraits', err); }

    const scene = game.newScene({ background: 0x20242c, exposure: 1.0, bloom: 0.5, bloomThreshold: 0.88, envIntensity: 1, killY: -60, residue: true });
    const blank = new THREE.Scene(); blank.background = new THREE.Color(0x000000); game.engine.setScene(blank);
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    const Q = RZ.getQuality();
    game.onUpdate(dt => RZ.update(dt));
    await tick();
    const W = buildObservatory(game, T, scene);
    game.onUpdate((dt, t) => W.update(dt, t));
    W.groups.hall.visible = false;
    await tick();

    // ---------- skies, stars, light ----------
    const SKY = {
      past: { preset: 'golden-hour', elevation: SUN.alt, azimuth: rzAzimuth(SUN.bearing), cover: 0.28, turbidity: 2.8 },
      '2049': { preset: 'night-city', glowIntensity: 0.32, cover: 0.18, stars: 0.0, moon: { elevation: 34, azimuth: rzAzimuth(150), intensity: 0.08 } },
      '2196': { preset: 'sunset', elevation: DUSK_SUN.alt + 3, azimuth: rzAzimuth(DUSK_SUN.bearing), cover: 0.36, turbidity: 4.2 },
    };
    const skies = {};
    for (const e of ERAS) {
      try {
        const s = RZ.skyEnvironment(renderer, scene, { ...SKY[e], apply: false });
        skies[e] = { s, sunDir: RZ.shared.sunDir.value.clone(), sunColor: RZ.shared.sunColor.value.clone(), fogSun: RZ.shared.fogSun.value.clone() };
      } catch (err) { console.warn('m7 sky', e, err); }
      await tick();
    }
    const night = new StarField({ seed: 49, background: Q === 'low' ? 650 : 1100, pole: [POLE.bearing, POLE.alt], stars: [
      { name: 'Polaris', bearing: 0, alt: 38.2, mag: 1.2, color: 0xfff4e0 },
      { name: 'Kochab', bearing: 18, alt: 50, mag: 1.4, color: 0xffc890 }, { name: 'Pherkad', bearing: 24, alt: 46, mag: 2.4 },
      { name: 'Dubhe', bearing: 330, alt: 52, mag: 1.2, color: 0xffd8a0 }, { name: 'Merak', bearing: 326, alt: 47, mag: 1.9 }, { name: 'Phecda', bearing: 314, alt: 49, mag: 2.1 },
      { name: 'Megrez', bearing: 318, alt: 54, mag: 2.6 }, { name: 'Alioth', bearing: 310, alt: 58, mag: 1.4 }, { name: 'Mizar', bearing: 304, alt: 62, mag: 1.6 }, { name: 'Alkaid', bearing: 292, alt: 64, mag: 1.4 },
      { name: 'Vega', bearing: 70, alt: 64, mag: 0.0, color: 0xcfe0ff }, { name: 'Deneb', bearing: 52, alt: 40, mag: 1.2 }, { name: 'Altair', bearing: 110, alt: 42, mag: 0.8 },
      { name: 'Arcturus', bearing: 262, alt: 36, mag: -0.1, color: 0xffc080 }, { name: 'Capella', bearing: 340, alt: 12, mag: 0.1, color: 0xfff0c0 },
    ] });
    night.group.renderOrder = -1; scene.add(night.group); T.only(night.group, '2049');
    const dusk = new StarField({ seed: 96, background: 140, opacity: 0.55, stars: [
      { name: 'Venus', bearing: VENUS.bearing, alt: VENUS.alt, mag: -3.6, color: 0xfff6e8 }, { name: 'Jupiter', bearing: 132, alt: 28, mag: -2.0, color: 0xfff0d8 },
      { name: 'Vega', bearing: 64, alt: 52, mag: 0.0, color: 0xcfe0ff }, { name: 'Arcturus', bearing: 236, alt: 48, mag: -0.1, color: 0xffc080 },
    ] });
    scene.add(dusk.group); T.only(dusk.group, '2196');
    game.onUpdate((dt, t) => { night.update(dt, t, game.engine.camera); dusk.update(dt, t, game.engine.camera); });

    // valley haze: a sheet over the valley floor and a band around the spur (aerial perspective)
    const hazes = [];
    try {
      hazes.push(RZ.hazeLayer({ kind: 'sheet', center: [0, 10], size: [620, 620], y: -26, opacity: 0.9, nearFade: 45 }));
      hazes.push(RZ.hazeLayer({ center: [0, 10], radius: 250, height: 120, y: -70, opacity: 0.6 }));
      for (const h of hazes) scene.add(h);
    } catch (err) { console.warn('m7 haze', err); }
    const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.castShadow = Q !== 'low';
    sun.shadow.mapSize.set(Q === 'high' ? 2048 : 1024, Q === 'high' ? 2048 : 1024); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
    const hemi = new THREE.HemisphereLight(0xb0c0d0, 0x4a3a2a, 0.35); scene.add(hemi);
    const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 12, 1.6); scene.add(l); return l; });
    scene.fog = RZ.heightFog({ color: 0xb0b8c0, density: 0.006, falloff: 0.03, base: 0 });
    let lightDir = bearingDir(SUN.bearing, 20);
    game.onUpdate(() => { const p = game.cine ? game.engine.camera.position : pl.pos; sun.target.position.set(p.x, p.y, p.z); sun.position.copy(sun.target.position).addScaledVector(lightDir, 90); });
    const STYLE = {
      past: { exposure: 1.02, fog: 0.0055, sun: 2.6, sunCol: null, hemi: 0.42, env: 1.0, dir: bearingDir(SUN.bearing, 16) },
      '2049': { exposure: 1.25, fog: 0.004, sun: 0.75, sunCol: 0x9ab8e8, hemi: 0.42, env: 0.8, dir: bearingDir(150, 40) },
      '2196': { exposure: 1.12, fog: 0.007, sun: 2.1, sunCol: 0xffa070, hemi: 0.45, env: 1.0, dir: bearingDir(DUSK_SUN.bearing, 9) },
    };
    let inHall = false;
    const applySky = (e) => {
      const k = skies[e], y = STYLE[e];
      if (k) {
        const s = k.s; scene.background = s.background; scene.environment = s.envMap; scene.environmentIntensity = y.env;
        RZ.shared.sunDir.value.copy(k.sunDir); RZ.shared.sunColor.value.copy(k.sunColor); RZ.shared.fogSun.value.copy(k.fogSun);
        sun.color.copy(y.sunCol ? new THREE.Color(y.sunCol) : s.sunColor); hemi.color.copy(s.hemi.sky); hemi.groundColor.copy(s.hemi.ground);
        scene.fog.color.copy(s.hazeColor);
        for (const h of hazes) h.material.uniforms.uCol.value.copy(s.hazeColor).multiplyScalar(e === '2049' ? 0.8 : 1.0);
      }
      sun.intensity = inHall ? 0 : y.sun; hemi.intensity = inHall ? 0.38 : y.hemi; lightDir = y.dir; scene.fog.density = inHall ? 0.006 : y.fog;
      renderer.toneMappingExposure = y.exposure;
    };
    // three point lights follow the nearest light sources of the state (constant light count)
    const SOURCES = {
      past: () => [...(W.braziers || []).map(([x, z]) => ({ p: [x, (x > 9 ? ET : C) + 1.4, z], c: 0xff9a40, i: 10, d: 11 })), { p: [-13.5, C + 3, 24], c: 0xffb060, i: 6, d: 12 }],
      '2049': () => [...(W.floods || []).map(([x, y, z]) => ({ p: [x, y + 6.6, z], c: 0xf0f4ff, i: 320, d: 44 })), { p: [-11, 2.5, 62], c: 0x9fd8ff, i: 6, d: 8 }, { p: [P.poleSight[0], RING + 2.6, P.poleSight[2] + 1], c: 0xd0e4ff, i: 30, d: 14 }, { p: [17.5, R2 + 3.2, -3.5], c: 0xffe8c0, i: 26, d: 14 }],
      '2196': () => [{ p: [W.barrel[0], C + 1.3, W.barrel[2]], c: 0xff8a3a, i: 16, d: 14 }, ...scavs.filter(s => s.state !== 'down').map(s => ({ p: [s.c.root.position.x, s.c.root.position.y + 1.6, s.c.root.position.z], c: 0xb6ff8a, i: 3, d: 5 })), { p: [0, TOP + 2.5, -16], c: 0xffb080, i: 6, d: 12 }],
    };
    const HALL_SRC = { past: { c: 0xff9a40, i: 60 }, '2049': { c: 0x8aa0d0, i: 26 }, '2196': { c: 0x9ab09a, i: 32 } };
    let lightT = 0;
    const rigLights = (force) => {
      if (inHall) { W.hallLights.forEach((p, k) => { const h = HALL_SRC[T.current]; pts[k].position.set(...p); pts[k].color.set(k === 2 ? 0x7fe8ff : h.c); pts[k].intensity = k === 2 ? 40 : h.i; pts[k].distance = 22; }); return; }
      if (!SOURCES[T.current]) return;
      const list = SOURCES[T.current]().map(s => ({ ...s, dd: (s.p[0] - pl.pos.x) ** 2 + (s.p[1] - pl.pos.y) ** 2 + (s.p[2] - pl.pos.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      pts.forEach((l, k) => { const s = list[k]; if (!s) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
      void force;
    };
    game.onUpdate(dt => { lightT -= dt; if (lightT <= 0) { lightT = 0.5; rigLights(); } });
    await tick();

    // ---------- music ----------
    const ERA_THEME = { past: 'm7-dawn', '2049': 'm7-night', '2196': 'm7-dusk' };
    let musicLock = null;
    const themeFor = (e) => musicLock || (inHall ? 'm7-dates' : musicState.fight ? 'm7-fight' : ERA_THEME[e]);
    const music = () => { for (const d of T.defs) d.theme = themeFor(d.id); audio.setTheme(themeFor(T.current), 1.4); };
    const lockMusic = (th) => { musicLock = th; music(); };

    // ---------- states ----------
    const residueObjs = [], scavs = [];
    const S = { sun: false, pole: false, arm: false, fight1: false, fight2: false, shards: 0, read: new Set(), seen: {}, scavOutcome: null, firstSwitch: {}, ended: false };
    const applyEra = (e) => {
      W.tint(e); applySky(e); hallState(W, e);
      W.setDoor(W.doorOpenFor(e, S.pole));
      W.starDoorCol.later.enabled = !S.pole;
      for (const o of residueObjs) o.visible = game.residueOn && o.userData.states.includes(e);
      audio.wind(e === 'past' ? 0.18 : e === '2049' ? 0.12 : 0.3);
      lightT = 0; music();
    };
    T.configure([
      { id: 'past', key: '1', name: 'IN USE', year: 'c. 1000 BCE · DAWN', glyph: '◐', color: '#ffb060', theme: 'm7-dawn', apply: () => applyEra('past') },
      { id: '2049', key: '2', name: 'HELIX SITE 3', year: '2049 · NIGHT', glyph: '◎', color: '#5fe6ff', theme: 'm7-night', apply: () => applyEra('2049') },
      { id: '2196', key: '3', name: 'RUIN', year: '2196 · DUSK', glyph: '◑', color: '#9affb0', theme: 'm7-dusk', apply: () => applyEra('2196') },
    ], 'past');
    // a switch that would leave Kai standing on nothing is refused (the wrist reads the ground of the other state)
    const baseCan = Object.getPrototypeOf(T).canSwitch;
    let refuseT = 0;
    const groundIn = (id) => {
      const p = pl.pos; let ground = -Infinity;
      for (const b of game.collision.boxes) {
        if (!b.enabled || (b.states && !b.states.includes(id))) continue;
        if (p.x < b.min.x - 0.1 || p.x > b.max.x + 0.1 || p.z < b.min.z - 0.1 || p.z > b.max.z + 0.1) continue;
        if (b.max.y <= p.y + 0.45 && b.max.y > ground) ground = b.max.y;
        if (!b.walkOnly && b.min.y < p.y + 1.2 && b.max.y > p.y + 0.6) return false;   // a wall stands here in that state
      }
      return ground > p.y - 2.2;
    };
    T.canSwitch = (id) => {
      if (game.token !== tok) { delete T.canSwitch; return baseCan.call(T, id); }
      if (!baseCan.call(T, id)) return false;
      if (S.lockReason) { if (game.time > refuseT) { refuseT = game.time + 2; ui.toast(S.lockReason, 2600); audio.sfxPlay('fail'); } return false; }
      if (!groundIn(id)) { if (game.time > refuseT) { refuseT = game.time + 2; ui.toast('NO GROUND THERE IN THAT STATE\nMove somewhere that exists in both', 2600); audio.sfxPlay('fail'); } return false; }
      return true;
    };
    T.onSwitch((id) => {
      if (!S.firstSwitch[id] && game.control && S.unlocked) { S.firstSwitch[id] = true; firstLook(id); }
    });

    // ---------- people ----------
    const kai = pl.char;
    const niko = game.actor('niko', null, -1.2, 0, 70, Math.PI); T.only(niko.root, 'past');
    const sefa = game.actor('sefa', null, 12.2, ET, 28.2, -Math.PI / 2); T.only(sefa.root, 'past');
    const acolytes = ACOLYTES.map((look, i) => { const a = game.ambient(look, i ? 16.4 : 12.6, ET, i ? 24.6 : 31.4, i ? -2.4 : 2.6); T.only(a.root, 'past'); return a; });
    acolytes[0].pose = 'work';
    let miraEcho = null;
    try { miraEcho = game.actor('miraecho', { ...CAST.mira.look, era: '2049', costume: 'mira' }, P.poleSight[0] - 0.9, RING, P.poleSight[2] + 1.1, Math.PI); miraEcho.setGhost(0x9a7bff); miraEcho.pose = 'look'; } catch (err) { console.warn('m7 mira echo', err); }
    if (miraEcho) { miraEcho.root.userData.states = ['2049']; game.residue(miraEcho.root); residueObjs.push(miraEcho.root); }

    // ---------- helpers ----------
    const near = (x, z, r) => Math.hypot(pl.pos.x - x, pl.pos.z - z) < r;
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u)); if (u >= 1) { off(); res(); } }); });
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const shardAt = (era, pos, title, text) => shard(era, pos, title, text);
    const shard = (era, pos, title, text) => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), glowMat(0x7fe8ff, 3.4)); m.position.set(...pos); scene.add(m); if (era) T.only(m, era);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.01, 6, 32), glowMat(0x7fe8ff, 2)); m.add(halo);
      game.onUpdate((dt, t) => { m.rotation.y += dt * 1.4; m.position.y = pos[1] + Math.sin(t * 2.2) * 0.05; halo.rotation.x = t; });
      game.interact({ pos, radius: 1.7, states: era ? [era] : undefined, prompt: 'Take the temporal shard', onUse: () => {
        m.parent?.remove(m); S.shards++; F.shards = (F.shards || 0) + 1; F.m7shards = S.shards;
        audio.sfxPlay('anomaly'); ui.addEvidence(title, text, 'TEMPORAL SHARD · ' + S.shards + '/5');
      } });
    };
    // where Kai was: grounded positions for temporal displacement
    const trail = [];
    game.onUpdate(() => { if (pl.grounded && game.control) { trail.push([game.time, pl.pos.x, pl.pos.y, pl.pos.z, T.current]); while (trail.length && trail[0][0] < game.time - 6) trail.shift(); } });
    let shiftPulse = 0;
    game.onUpdate(dt => { if (shiftPulse > 0) { shiftPulse = Math.max(0, shiftPulse - dt * 1.6); game.engine.fx.uShift.value = shiftPulse; } });
    const displaceKai = (sec = 3) => {
      const want = game.time - sec; let pick = null;
      for (let i = trail.length - 1; i >= 0; i--) { if (trail[i][0] <= want && trail[i][4] === T.current) { pick = trail[i]; break; } }
      if (!pick) pick = trail.find(t => t[4] === T.current) || null;
      audio.sfxPlay('rewind'); shiftPulse = 0.55; game.touch.buzz([30, 30, 60]);
      if (pick) pl.place(pick[1], pick[2], pick[3], pl.yaw);
      trail.length = 0;
      S.hits = (S.hits || 0) + 1;
      if (once('dispTip')) ui.toast('DISPLACED · −3 s\nThe pulse threw you back to where you were three seconds ago', 3400);
      else ui.toast('DISPLACED · −3 s', 1200);
    };

    // =====================================================================================
    // INSTRUMENTS (src/systems/alignment.js)
    // =====================================================================================
    const B8 = (list) => list.map(v => ({ v, label: String(Math.round(v)).padStart(3, '0') + '°' }));
    const A8 = (list) => list.map(v => ({ v, label: (Math.round(v * 10) / 10) + '°' }));
    const inView = (inst, t, r = 22) => t && angleBetween(inst.bearing, inst.alt, t.bearing, t.alt) < r;
    let sunLooks = 0, poleLooks = 0, armLooks = 0;
    const sunGate = new Instrument(game, {
      name: 'THE SUN GATE', yaw: W.sunGate.yaw, pitch: W.sunGate.pitch, eyeNode: W.sunGate.pitch, eyeOffset: [0, 0, 0],
      bearings: B8([0, 30, 62, 90, 120]), alts: A8([0, 6, 15, 30, 45]), bearing: 120, alt: 30, tolerance: 3,
      target: () => (T.current === 'past' ? { ...SUN, name: 'the sun' } : null),
      describe: (inst, t) => {
        sunLooks++;
        if (!t) return 'No sun in this sky. The gate was built for a dawn three thousand years ago.';
        if (inst.aligned) return 'The sun, dead centre in the ring.';
        if (inView(inst, t)) return `There — the sun, ${relativeWords(inst.bearing, inst.alt, t.bearing, t.alt)}.`;
        return sunLooks > 1 ? 'Only sky. The sun came up over the notch in the eastern ridge — low, just above it. North of east.' : 'Only sky. The sun must be somewhere else.';
      },
    });
    const poleSight = new Instrument(game, {
      name: 'THE POLE SIGHT', yaw: W.poleSight.yaw, pitch: W.poleSight.pitch, eyeNode: W.poleSight.pitch, eyeOffset: [0, 0.25, 0], frameDist: 0.8, frameSide: 2.2, frameUp: 0.6,
      bearings: B8([0, 45, 90, 270, 315]), alts: A8([10, 25, 38.2, 52, 70]), bearing: 315, alt: 52, tolerance: 3,
      target: () => (T.current === '2049' ? { ...POLE, name: 'Polaris' } : null),
      describe: (inst, t) => {
        poleLooks++;
        if (!t) return '';
        night.spin(0.35); setTimeout(() => night.spin(0), 2600);
        if (inst.aligned) { night.mark('Polaris', 0x9fe8ff); return 'Everything wheels around one star — and that one doesn\'t move. Polaris. Dead centre.'; }
        if (inView(inst, t, 26)) return `The stars are turning around one point, ${relativeWords(inst.bearing, inst.alt, t.bearing, t.alt)}. The star there stays put.`;
        return poleLooks > 1 ? 'Stars, all sliding the same way. The pivot is north — and the pole stands as high as the latitude. The survey board said 38.2.' : 'Stars, sliding across the sight. Whatever they turn around, it isn\'t here.';
      },
    });
    const armillary = new Instrument(game, {
      name: 'THE WANDERING RING', yaw: W.armillary.yaw, pitch: W.armillary.pitch, eyeNode: W.armillary.core, eyeOffset: [0, 0.05, 0],
      bearings: B8([90, 180, 250, 272, 292]), alts: A8([5, 14, 25, 40]), bearing: 180, alt: 40, tolerance: 3,
      target: () => (T.current === '2196' ? { ...VENUS, name: 'the evening star' } : null),
      describe: (inst, t) => {
        armLooks++;
        if (!t) return '';
        if (inst.aligned) { dusk.mark('Venus', 0xffe0b0); return 'The evening star. The wanderer. Dead centre.'; }
        if (inView(inst, t, 24)) return `The brightest thing in the sky, ${relativeWords(inst.bearing, inst.alt, t.bearing, t.alt)}. Not a star. A planet.`;
        return armLooks > 1 ? 'Just dusk. The wanderer follows the sun down — west, a little south of where it set, a hand and a half above the horizon.' : 'Just dusk.';
      },
    });
    W.setBeam(false);
    window.__m7 = { W, S, sunGate, poleSight, armillary, T, scavs: null, ring: null, night, dusk };

    // =====================================================================================
    // SCAVENGERS: rewind gauntlets; their pulses throw whatever they hit three seconds back
    // =====================================================================================
    const orbs = [];
    const orbMat = glowMat(0xb6ff8a, 5);
    class Scav {
      constructor(id, look, pos, o = {}) {
        this.id = id; this.c = game.actor(id, look, pos[0], pos[1], pos[2], o.ry || 0); T.only(this.c.root, '2196');
        this.home = new THREE.Vector3(...pos); this.state = 'idle'; this.t = Math.random() * 1.5; this.aware = false; this.active = false;
        this.range = o.range ?? 17; this.name = o.name || 'scav'; this.boss = !!o.boss;
        this.glow = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), glowMat(0xb6ff8a, 1));
        const hand = this.c.arms?.[0]?.hand; (hand || this.c.root).add(this.glow); if (!hand) this.glow.position.set(0.3, 1.1, 0.2);
        this.ip = new THREE.Vector3();
        this.it = game.interact({ pos: this.ip, radius: 2.3, once: false, states: ['2196'], prompt: o.prompt || 'Take down the scavenger',
          enabled: () => this.active && (this.state === 'vent' || this.state === 'idle') && !S.taking, onUse: () => takedown(this) });
        scavs.push(this);
      }
      update(dt) {
        const c = this.c, p = c.root.position; this.ip.set(p.x, p.y + 1.0, p.z);
        if (this.state === 'down') { this.glow.material.emissiveIntensity = 0; return; }
        if (!this.active || T.current !== '2196' || !game.control || ui.dlgActive) { this.glow.material.emissiveIntensity = 0.8; return; }
        const k = pl.pos, d = Math.hypot(k.x - p.x, k.z - p.z), dy = Math.abs(k.y - p.y);
        const ly = Math.max(k.y, p.y) + 1.3;
        this.aware = d < this.range && dy < 9 && !game.collision.blocked(p, k, ly, '2196');
        if (this.aware || this.state !== 'idle') c.faceTowards(k.x, k.z, dt, 5);
        this.t += dt;
        const m = this.glow.material;
        if (this.state === 'idle') {
          m.emissive.set(0xb6ff8a); m.emissiveIntensity = 1;
          c.pose = null;
          if (this.aware && this.t > (d < 4 ? 0.6 : this.boss ? 1.2 : 1.8)) { this.state = 'aim'; this.t = 0; audio.sfxPlay('drone'); c.pose = 'look'; if (once('aimBark')) ui.subtitle('kai', 'The gauntlet is charging — get out of its line!', 2400); }
        } else if (this.state === 'aim') {
          m.emissive.set(0xb6ff8a); m.emissiveIntensity = 2 + this.t * 6;
          if (this.t > 1.3) { this.fire(); this.state = 'vent'; this.t = 0; c.pose = 'work'; }
        } else if (this.state === 'vent') {
          m.emissive.set(0xffa040); m.emissiveIntensity = 2.5 + Math.sin(this.t * 14) * 1.2;
          if (this.t > (this.boss ? 2.6 : 3.2)) { this.state = 'idle'; this.t = 0; c.pose = null; }
        }
      }
      fire() {
        const p = this.c.root.position, from = new THREE.Vector3(p.x, p.y + 1.35, p.z);
        const to = new THREE.Vector3(pl.pos.x + pl.vel.x * 0.35, pl.pos.y + 1.1, pl.pos.z + pl.vel.z * 0.35);
        const v = to.sub(from).normalize().multiplyScalar(this.boss ? 7.5 : 6.5);
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), orbMat); mesh.position.copy(from); scene.add(mesh);
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 24), orbMat); mesh.add(halo);
        orbs.push({ mesh, halo, v, life: 3.2 }); audio.sfxPlay('rewind');
      }
    }
    const killOrb = (o) => { scene.remove(o.mesh); o.dead = true; };
    let ring = null;
    game.onUpdate((dt) => {
      for (const s of scavs) s.update(dt);
      for (const o of orbs) {
        if (o.dead) continue;
        if (T.current !== '2196') { killOrb(o); continue; }
        o.life -= dt; o.mesh.position.addScaledVector(o.v, dt); o.halo.rotation.x += dt * 8; o.halo.rotation.y += dt * 5;
        const q = o.mesh.position;
        if (o.life <= 0) { killOrb(o); continue; }
        if (Math.hypot(q.x - pl.pos.x, q.z - pl.pos.z) < 0.55 && q.y > pl.pos.y + 0.2 && q.y < pl.pos.y + 1.9 && game.control) { killOrb(o); displaceKai(3); continue; }
        if (ring && Math.abs(q.y - TOP) < 0.6 && ring.onSegment(q.x, q.z, 0)) { killOrb(o); ringDisplaced(); continue; }
        for (const b of game.collision.boxes) { if (!b.enabled || (b.states && !b.states.includes('2196'))) continue; if (q.x > b.min.x && q.x < b.max.x && q.y > b.min.y && q.y < b.max.y && q.z > b.min.z && q.z < b.max.z) { killOrb(o); break; } }
      }
      for (let i = orbs.length - 1; i >= 0; i--) if (orbs[i].dead) orbs.splice(i, 1);
    });
    const scav1 = new Scav('scav1', SCAV_LOOKS[0], [...(() => { const [x, z] = polar(100, 8.6); return [x, RING, z]; })()], { ry: -Math.PI / 2, range: 15, prompt: 'Take down the scout' });
    const scav2 = new Scav('scav2', SCAV_LOOKS[1], [...(() => { const [x, z] = polar(250, 6.3); return [x, TOP, z]; })()], { ry: Math.PI / 2, range: 16 });
    const scav3 = new Scav('scav3', { ...SCAV_LOOKS[0], hair: 0x2a1c14, skin: 0x8c5a3a, age: 31 }, [...(() => { const [x, z] = polar(170, 6.3); return [x, TOP, z]; })()], { ry: 0, range: 16, prompt: 'Take down the lookout' });
    const dace = new Scav('dace', null, [DC[0] + 0.9, TOP, DC[1] + 1.4], { boss: true, range: 14, name: 'dace', ry: Math.PI, prompt: 'Take down Dace' });
    window.__m7.scavs = scavs;
    window.__m7.dbgHall = (on) => { inHall = on; W.groups.hall.visible = on; applySky(T.current); hallState(W, T.current); lightT = 0; rigLights(); };
    const takedown = async (s) => {
      if (s.state === 'down' || S.taking) return;
      S.taking = true; cine(true);
      const p = s.c.root.position;
      const dir = new THREE.Vector3(pl.pos.x - p.x, 0, pl.pos.z - p.z).normalize();
      pl.place(p.x + dir.x * 0.9, p.y, p.z + dir.z * 0.9, Math.atan2(-dir.x, -dir.z));
      await game.shot([p.x + dir.x * 2.4 + dir.z * 1.6, p.y + 1.7, p.z + dir.z * 2.4 - dir.x * 1.6], [p.x, p.y + 1.1, p.z], 0.5, { fov: 42 });
      kai.pose = 'work'; audio.sfxPlay('metal'); game.shake = 0.08;
      await game.wait(0.35); game.shake = 0;
      s.state = 'down'; s.c.pose = 'fall'; s.active = false; audio.sfxPlay('spark');
      await game.wait(0.7); kai.pose = null;
      S.downs = (S.downs || 0) + 1; musicState.fight = Math.min(3, (musicState.fight || 1) + 1);
      cine(false); S.taking = false;
    };

    // the rotating orrery ring on the summit (2196): carries Kai, and can be thrown back by a pulse
    ring = new OrreryRing(game, { center: DC, y: TOP, r0: 3.4, r1: 5.4, arcs: W.orreryArcs, speed: 0.22, states: ['2196'], mesh: W.orrery });
    window.__m7.ring = ring;
    let ghostT = 0;
    const ringDisplaced = () => {
      W.orreryGhost.rotation.y = W.orrery.rotation.y; W.orreryGhost.visible = true; ghostT = 1.2;
      ring.displace(3); audio.sfxPlay('rewind');
      if (once('ringTip')) ui.subtitle('kai', 'The pulse hit the ring — and threw it back where it was three seconds ago.', 3600);
    };
    game.onUpdate(dt => { if (ghostT > 0) { ghostT -= dt; W.orreryGhost.children.forEach(m => { m.material.opacity = Math.max(0, ghostT) * 0.25; }); if (ghostT <= 0) W.orreryGhost.visible = false; } });
    // falling into the drum's pit (2196) is a failure: the drum is a forty-foot drop into the dark
    game.onUpdate(() => {
      if (T.current !== '2196' || !game.control || S.ended) return;
      const r = Math.hypot(pl.pos.x - DC[0], pl.pos.z - DC[1]);
      if (r < 5.55 && pl.pos.y < TOP - 1.4 && pl.pos.y > T1 - 2) game.fail('YOU FELL INTO THE DRUM');
    });

    // =====================================================================================
    // OPTIONAL CONTENT
    // =====================================================================================
    // shards
    shard('past', [-17.4, C + 0.9, 30.6], 'Temporal shard: the West Hall', 'Under the mural of the seventeen, in the keepers\' hall: a shard of crystallised time, warm as a hand.');
    shard('2049', [17.8, R2 + 0.6, -1.9], 'Temporal shard: the scaffold roof', 'On the second roof, at the foot of Helix\'s scaffold. The survey crew walked past it for eighteen years.');
    shard('2196', [6.8, C + 0.7, 12.4], 'Temporal shard: the scavengers\' pile', 'In the scavengers\' salvage, among bronze they will never keep: a shard of crystallised time.');
    shard('2196', [-5.6, C + 0.7, -9.2], 'Temporal shard: the roots', 'In the Hall of Dates, where the roots came through: a shard that hums with the count.');
    // the mural of the seventeen (West Hall)
    game.interact({ pos: [-17.2, C + 1.4, 24], radius: 2.6, once: false, enabled: () => !S.ended, prompt: 'Study the mural', onUse: async () => {
      const e = T.current;
      cine(true);
      await game.shot([-14.6, C + 1.8, 24], [-18.4, C + 2.2, 24], 1.2, { fov: 44 });
      if (e === 'past') {
        await game.talk([
          ['kai', 'Seventeen figures, walking toward a ring. The last one has a light on his wrist.'],
          ['kai', 'And a sign next to him. The same mark as my wrist.'],
        ]);
        if (once('muralNiko')) {
          niko.root.position.set(-14.8, C, 22.6); niko.lookTarget = kai.head;
          await game.talk([
            ['niko', 'The keepers paint him every time he comes. They never know which time it is.'],
            F.nikoObservatoryClue ? ['kai', 'Seventeen stars over the east notch on Tala\'s wall. Seventeen steps. Seventeen of me.'] : ['kai', 'Seventeen steps outside. Seventeen men on the wall.'],
            ['niko', 'Sixteen came and went. Sefa says the seventeenth is the one who reads the end of the count.'],
          ]);
          niko.lookTarget = null;
        }
        ui.addEvidence('The mural of the seventeen', 'In the West Hall (c. 1000 BCE): seventeen figures walking toward a ring. The last wears a light on his wrist and Kai\'s mark. "The keepers paint him every time he comes."', 'THE SKY HOUSE · MURAL');
        F.m7mural = true;
      } else if (e === '2049') await game.say('kai', 'Helix has photographed every centimetre. The last figure is under a conservation patch. Somebody didn\'t want it seen.');
      else await game.say('kai', 'Most of it has flaked away. One figure is left. Mine.');
      cine(false);
    } });
    // the sky table: three star plates scattered across three ages, set back on the West Hall table (past)
    const PLATES = [
      { era: 'past', pos: [10.8, R1 + 0.15, 8.9], name: 'the plate of the sun', found: 'A bronze plate engraved with a rising sun, wedged in the parapet. A boy\'s hiding place.' },
      { era: '2049', pos: [3.5, C + 0.9, 31.2], name: 'the plate of the pole', found: 'In a Helix finds tray: "FIND 3-117, bronze disc, star motif". The pole star in its seat.' },
      { era: '2196', pos: [8.6, C + 0.3, 8.8], name: 'the plate of the wanderer', found: 'In the scavengers\' salvage: a plate with a single bright point low in the west. The wanderer.' },
    ];
    S.plates = 0; S.platesSet = 0;
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xd8b060, metalness: 1, roughness: 0.25, emissive: 0x3a2a08, emissiveIntensity: 0.6 });
    PLATES.forEach((pt, k) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 20), plateMat); m.position.set(...pt.pos); m.rotation.x = 0.3; scene.add(m); T.only(m, pt.era);
      game.onUpdate((dt, t) => { m.rotation.y = t * 0.6 + k; });
      game.interact({ pos: pt.pos, radius: 1.8, states: [pt.era], prompt: `Pick up ${pt.name}`, onUse: () => {
        m.parent?.remove(m); T.objects = T.objects.filter(o => o !== m); S.plates++; audio.sfxPlay('pickup');
        ui.subtitle('kai', pt.found, 4200);
        ui.addEvidence(`Star plate ${S.plates}/3`, pt.found, 'OPTIONAL · THE SKY TABLE');
        if (S.plates === 1 && S.platesSet === 0) ui.toast('OPTIONAL · THE SKY TABLE\nSet the star plates on the table in the West Hall (c. 1000 BCE)', 5200);
      } });
    });
    game.interact({ pos: [-13.5, C + 1.0, 24], radius: 2.2, once: false, states: ['past'], enabled: () => S.plates > S.platesSet && !S.ended, prompt: 'Set the star plates on the sky table', onUse: async () => {
      if (T.current !== 'past') return;
      S.platesSet = S.plates; audio.sfxPlay('metal');
      if (S.platesSet < 3) { ui.subtitle('kai', `${S.platesSet} of 3 sockets filled. The table wants the rest of its sky.`, 3000); return; }
      cine(true);
      await game.shot([-12.0, C + 2.6, 25.2], [-13.5, C + 0.9, 24], 1.2, { fov: 40 });
      audio.sfxPlay('success');
      await game.talk([
        ['kai', 'Sun below the horizon. The pole star in its seat. The wanderer low in the west.'],
        ['kai', 'It isn\'t a calendar. It\'s one sky — one particular night, over this house.'],
        ['kai', 'Venus in the west after sunset, Polaris on the pole… November. Early November.'],
        ['kai', 'The night the count ends.'],
      ]);
      F.m7skyTable = true;
      ui.addEvidence('The sky table', 'Three star plates set back into the West Hall table show a single sky: the sun just set, Polaris in the seat the keepers kept empty, Venus low in the west. Early November, Kai\'s era. The night the count ends.', 'OPTIONAL · THE SKY TABLE');
      cine(false);
      shardAt('past', [-13.5, C + 1.15, 24], 'Temporal shard: the sky table', 'When the last plate went in, the centre of the sky table opened on a shard of crystallised time.');
    } });
    // the Helix site office (2049): the site log
    game.interact({ pos: [-12.2, 1.2, 62], radius: 2.4, once: false, states: ['2049'], enabled: () => !F.m7siteLog, prompt: 'Read the Helix site log', onUse: async () => {
      if (T.current !== '2049') return;
      cine(true);
      await game.shot([-9.2, 2.2, 64.6], [-11.6, 1.4, 62], 1.0, { fov: 42 });
      await game.talk([
        ['helixlog', 'Site 3, log. March 2031. Site closed by order of Director E. Rook. Excavation suspended.'],
        ['helixlog', 'Radiocarbon, Sun Gate pin: one thousand and ten BCE, plus or minus forty years. The pin has not moved since.'],
        ['helixlog', 'Pole Sight: altitude ring found reset every night. Cameras show no one present.'],
        ['helixlog', 'Addendum, E.R.: the chamber beneath the drum is not to be opened. By anyone. Ever.'],
      ]);
      await game.say('kai', 'Rook knew there was a hall under the drum. And he locked it before I was old enough to open it.');
      F.m7siteLog = true;
      ui.addEvidence('Helix Site 3 log', 'March 2031: the observatory closed by order of E. Rook. Sun Gate pin dated 1010 BCE ± 40. The Pole Sight is "reset every night; cameras show no one". Addendum: "the chamber beneath the drum is not to be opened."', 'HELIX · SITE 3');
      cine(false);
    } });
    // Sefa: optional conversations (past)
    const sefaPos = new THREE.Vector3(); game.onUpdate(() => sefaPos.copy(sefa.root.position).setY(sefa.root.position.y + 1.2));
    let sefaTalks = 0;
    game.interact({ pos: sefaPos, radius: 2.4, once: false, states: ['past'], enabled: () => S.metSefa && !S.ended && !S.inHallScene, prompt: 'Talk to Sefa', onUse: async () => {
      if (T.current !== 'past') return;
      cine(true); sefa.lookTarget = kai.head; kai.lookTarget = sefa.head;
      const sp = sefa.root.position;
      await game.shot([sp.x + 2.2, sp.y + 1.7, sp.z + 1.4], [sp.x, sp.y + 1.5, sp.z], 1.0, { fov: 40 });
      const topics = [
        [['kai', 'Tala thinks this place will be used as a weapon.'], ['sefa', 'Tala thinks a knife is a weapon. It is also how we cut bread.'], ['sefa', 'The house only listens. It is what the listening is for that frightens her.']],
        [['kai', 'Who built the house?'], ['sefa', 'My mother\'s mother\'s mothers. The stone told them where. The sky told them how.'], ['sefa', 'And a stranger with your wrist told them when to stop building. He said: leave room for one more.']],
        [['kai', 'What happens when the count ends?'], ['sefa', 'Then nobody has to keep it any more.'], ['sefa', 'I would like to sleep one dawn through, Seventeenth.']],
      ];
      await game.talk(topics[sefaTalks % topics.length]); sefaTalks++;
      if (sefaTalks === 3) { F.m7sefaTalks = true; ui.addEvidence('The Sky Keeper', 'Sefa has counted the sun\'s risings for fifty years. A stranger with Kai\'s wrist told the first keepers to "leave room for one more". When the count ends, "nobody has to keep it any more."', 'THE SKY HOUSE'); }
      sefa.lookTarget = null; kai.lookTarget = null; cine(false);
    } });
    // the Pole Sight in other states (past: pinned; 2196: seized)
    game.interact({ pos: [P.poleSight[0], RING + 1.4, P.poleSight[2]], radius: 2.2, once: false, states: ['past'], enabled: () => !S.ended, prompt: 'Look through the pinned sight', onUse: async () => {
      if (T.current !== 'past') return;
      cine(true);
      await game.shot([P.poleSight[0] + 0.3, RING + 2.5, P.poleSight[2] + 1.6], [P.poleSight[0] - 3, RING + 9, P.poleSight[2] - 20], 1.6, { fov: 36 });
      await game.talk([
        ['kai', 'Pinned with bronze, aimed due north at thirty-eight degrees. At an empty patch of sky.'],
        ['kai', 'Kochab circles beside it. No star sits on the pole — not for another two thousand years.'],
        ['kai', 'They aimed it at a seat nobody was sitting in. And kept the seat.'],
      ]);
      if (!F.m7emptySeat) { F.m7emptySeat = true; ui.addEvidence('An empty seat in the sky', 'c. 1000 BCE, the Pole Sight is pinned on the celestial pole — where, in that age, no star stands. Precession brings Polaris to that seat only in Kai\'s era. The keepers built for a sky three thousand years away.', 'THE POLE SIGHT · PAST'); }
      cine(false);
    } });
    game.interact({ pos: [P.poleSight[0], RING + 1.4, P.poleSight[2]], radius: 2.2, once: false, states: ['2196'], enabled: () => !S.ended, prompt: 'Try the rusted sight', onUse: () => {
      if (T.current !== '2196') return;
      ui.subtitle('kai', S.pole ? 'Rusted solid — still on the pole, where I left it in 2049.' : 'Rusted solid. Whatever it points at, it chose a long time ago.', 3400);
    } });
    // residue: someone aimed the Pole Sight in 2041
    game.onUpdate(() => {
      if (!miraEcho || !game.residueOn || T.current !== '2049' || !near(P.poleSight[0], P.poleSight[2], 7) || pl.pos.y < RING - 1) return;
      if (once('miraEcho')) {
        ui.subtitle('kai', 'Residue at the sight. Someone stood here, at night, adjusting it. A woman. …Mira?', 4600);
        F.m7miraEcho = true;
        ui.addEvidence('Residue at the Pole Sight', 'Residue Vision (2049): a woman\'s echo at the Pole Sight, adjusting the altitude ring at night — the reason Helix found it "reset every night". She looks like Mira.', 'THE POLE SIGHT · RESIDUE');
      }
    });
    // first looks at each state (barks + staged moments where it matters)
    const firstLook = (id) => {
      if (id === '2049') ui.subtitle('kai', 'Night. Floodlights, fences, a Helix site sign. They found this place — and they closed it.', 4200);
      if (id === '2196') ui.subtitle('kai', 'Dusk. The house is a ruin… and somebody\'s camping in the court.', 3800);
      if (id === 'past' && S.sun) ui.subtitle('kai', 'Dawn again. The fires are still lit.', 2600);
    };
    // checkpoints as Kai reaches each level
    const CPS = [
      { k: 'r1', test: () => pl.pos.z < 15.6 && pl.pos.z > 8.4 && pl.pos.x > 10 && Math.abs(pl.pos.y - R1) < 0.2, at: [14.5, R1, 12, Math.PI] },
      { k: 'r2', test: () => pl.pos.z < 4.6 && pl.pos.z > -2.6 && pl.pos.x > 13 && Math.abs(pl.pos.y - R2) < 0.2, at: [15.8, R2, 1, Math.PI] },
      { k: 'r3', test: () => pl.pos.z < -6.4 && pl.pos.z > -13.6 && pl.pos.x > 15 && Math.abs(pl.pos.y - R3) < 0.2, at: [17, R3, -10, -Math.PI / 2] },
      { k: 't1', test: () => pl.pos.x < 9.6 && pl.pos.x > -9.6 && pl.pos.z < -4.4 && Math.abs(pl.pos.y - T1) < 0.2, at: [9.2, T1, -10, -Math.PI / 2] },
      { k: 'ring', test: () => Math.abs(pl.pos.y - RING) < 0.2 && Math.hypot(pl.pos.x - DC[0], pl.pos.z - DC[1]) > 7, at: [P.ringStairTop[0], RING, P.ringStairTop[2], Math.PI] },
    ];
    game.onUpdate(() => { if (!game.control || S.ended) return; for (const c of CPS) if (!S.seen['cp' + c.k] && c.test()) { S.seen['cp' + c.k] = true; game.checkpoint(...c.at); } });

    // =====================================================================================
    // SCRIPT
    // =====================================================================================
    ui.missionTag('MISSION 7 · THE BROKEN OBSERVATORY'); ui.show('hud', true);
    T.unlocked = false; T.setImmediate('past'); applyEra('past');
    pl.place(...P.start, Math.PI); game.checkpoint(...P.start, Math.PI);
    niko.root.position.set(-1.3, 0, 76.6); niko.root.rotation.y = Math.PI;
    lockMusic(null); audio.setTheme(null);
    game.engine.setScene(scene);
    cine(true);
    game.engine.camera.position.set(40, 24, 120);
    await game.shot([40, 24, 120], [0, 10, 20], 0.01, { fov: 50 });
    await ui.fade(0, 2400);
    audio.setTheme('m7-dawn', 2);
    const cc = ui.chapterCard('ACT I · THE WORLD THAT REMEMBERS', 'The Broken Observatory', 'The Sky House · above the settlement · c. 1000 BCE', 4400);
    await game.shot([22, 18, 72], [2, 10, -10], 6.5, { fov: 46 });
    await cc;
    await game.shot([-9, 26, -2], [12, 4, 30], 3.6, { fov: 48 });   // over the drum toward the dawn
    await game.shot([3.2, 1.7, 73.4], [-0.6, 1.5, 76.8], 2.0, { fov: 40 });
    niko.lookTarget = kai.head; kai.lookTarget = niko.head;
    // bridge from M5 (Niko promised to wait here) and M6 (the tower clock in Rain City)
    if (F.m6done) await game.talk([
      ['niko', 'You came back. I said I would wait at the foot of the steps.'],
      ['kai', 'A clockmaker in my city stopped his tower clock just short of the ninth minute. Then the stone pulled me back here.'],
      ['niko', 'Then it wants you to climb.'],
    ]);
    else if (F.m5complete) await game.say('niko', 'You came back. I said I would wait at the foot of the steps.');
    await game.talk([
      ['niko', 'Seventeen steps. Count them when you climb. The keepers cut one for every time the stranger came.'],
      ['kai', 'And the eighteenth?'],
      ['niko', 'There is no eighteenth. That is what frightens Sefa.'],
    ]);
    if (F.nikoObservatoryClue) await game.talk([['kai', 'Seventeen stars over the east notch, on Tala\'s wall. The same count.'], ['niko', 'Then you have been listening.']]);
    if (F.m5_promise === 'tried') await game.say('niko', 'You promised to try not to change the world. Up there, the world is only a sky. Change nothing but where things point.');
    niko.lookTarget = null; kai.lookTarget = null;
    cine(false);
    game.objective('Climb the seventeen steps to the Sky House');
    // Niko walks up ahead and waits in the court
    const nikoGoal = new THREE.Vector3(-4.6, C, 30.5);
    let nikoGo = false;
    game.onUpdate(dt => {
      if (!nikoGo || T.current !== 'past') { niko.speed = 0; return; }
      const p = niko.root.position, dx = nikoGoal.x - p.x, dz = nikoGoal.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { niko.speed = 0; return; }
      niko.faceTowards(nikoGoal.x, nikoGoal.z, dt, 6); const sp = Math.min(1.5, d); p.x += dx / d * sp * dt; p.z += dz / d * sp * dt; niko.speed = sp;
      p.y = p.z > 46 ? 0 : p.z < 40.6 ? C : Math.min(C, (46 - p.z) / 0.32 * 0.18);
    });
    setTimeout(() => { nikoGo = true; }, 2500);
    let stepCount = 0;
    game.onUpdate(() => { const n = Math.max(0, Math.min(17, Math.floor((46 - pl.pos.z) / 0.32) + 1)); if (pl.pos.z < 46 && pl.pos.z > 40.4 && n > stepCount) { stepCount = n; if (n === 17 && once('seventeen')) ui.subtitle('kai', 'Seventeen.', 1600); } });
    hint(() => pl.pos.z > 46, 60, () => ui.subtitle('kai', 'The steps. Up to the house.', 2600));
    await game.waitFor(() => pl.pos.z < 39.5 && pl.pos.y > C - 0.3);

    // ---------- the Sky Keeper ----------
    cine(true);
    await game.shot([4, C + 6, 44], [10, C + 3, 22], 2.6, { fov: 50 });
    await game.shot([9.6, ET + 1.8, 31.6], [12.2, ET + 1.5, 28.2], 1.6, { fov: 40 });
    sefa.lookTarget = kai.head;
    await game.say('sefa', 'Come up, Seventeenth. The sun is being born and I am too old to climb down to you.');
    pl.place(10.6, ET, 27.4, -Math.PI / 2 + 0.4);
    kai.lookTarget = sefa.head;
    await game.shot([9.4, ET + 1.7, 30.0], [12.2, ET + 1.55, 28.2], 1.2, { fov: 38 });
    await game.talk([
      ['sefa', 'You wear no dust. Niko said you would not.'],
      ['kai', 'I need to know what this place is.'],
      ['sefa', 'The Sky House. It listens to the sky, and tells the stone beneath what it hears.'],
      ['kai', 'The stone. A black ring, taller than a man?'],
      ['sefa', 'We do not say its name. It was here before the first fire. We built the house around it, so it would have someone to talk to.'],
    ]);
    await game.shot([12.0, ET + 2.4, 31.2], [14.5, ET + 2.6, 27], 1.6, { fov: 44 });
    await game.talk([
      ['sefa', 'Three instruments. The Sun Gate, the Pole Sight, the Wandering Ring. Each must be told its star, at its hour.'],
      ['sefa', 'The sun\'s hour is now. The others are not in my sky.'],
      ['kai', 'The sun now. The stars at night. A wanderer at dusk. Different skies — different states of this place.'],
    ]);
    sefa.lookTarget = null; kai.lookTarget = null;
    S.metSefa = true; S.unlocked = true; S.firstSwitch.past = true;
    T.unlocked = true; T.stability = 1; T.refreshHud(); kai.wristBoost = 10; audio.sfxPlay('switch');
    ui.addEvidence('The Sky House', 'An observatory built around the Chronolith "so it would have someone to talk to". Three instruments must each be told their star at their hour: the Sun Gate (dawn), the Pole Sight, the Wandering Ring.', 'THE SKY HOUSE · c. 1000 BCE');
    cine(false);
    ui.toast('THIS PLACE HAS THREE STATES\n1 · c. 1000 BCE · dawn     2 · 2049 · night     3 · 2196 · dusk', 6000);
    game.objective('Align the Sun Gate with the rising sun');
    game.checkpoint(10.6, ET, 27.4, -Math.PI / 2);
    // Sun Gate interaction
    let sunBusy = false;
    game.interact({ pos: [13.2, ET + 1.2, 27], radius: 2.4, once: false, enabled: () => !S.sun && !sunBusy, prompt: 'Work the Sun Gate', onUse: async () => {
      if (T.current !== 'past') { ui.subtitle('kai', T.current === '2049' ? 'Seized. Pinned since the Bronze Age — Helix measured the pin.' : 'Rusted into place. Whatever it points at, it pointed at three thousand years ago.', 3400); return; }
      sunBusy = true; game.control = false;
      try { await sunGate.operate(); } finally { sunBusy = false; game.control = true; game.releaseCam(); ui.letterbox(false); }
    } });
    hint(() => !S.sun && T.current === 'past' && near(14, 27, 9), 70, () => ui.subtitle('sefa', 'Where the sun is born: the notch in the eastern ridge. A hand above the stone.', 4000));
    hint(() => !S.sun && T.current !== 'past', 50, () => ui.subtitle('kai', 'The Sun Gate needs a sunrise. Back to the dawn.', 3000));
    await game.waitFor(() => sunGate.aligned && sunGate.locked && !ui.dlgActive);

    // ---------- the sun is told ----------
    S.sun = true; musicState.aligned = 1; F.m7sunGate = true;
    cine(true);
    await game.shot([16.8, ET + 2.4, 31.2], [13.8, ET + 2.6, 26.4], 1.0, { fov: 40 });
    audio.sfxPlay('success'); W.sunBeam.visible = true;
    await tween(1.4, u => { W.sunSpot.material.opacity = u * 0.8; });
    await game.shot([-6.4, C + 2.6, 33.6], [-3.5, C, 27.6], 2.2, { fov: 46 });
    await game.say('kai', 'The light goes through the ring and lands on the sun stone. Exactly.');
    sefa.lookTarget = kai.head;
    await game.shot([9.4, ET + 1.7, 30.0], [12.2, ET + 1.55, 28.2], 1.0, { fov: 38 });
    await game.talk([
      ['sefa', 'The sun has been told.'],
      ['sefa', 'Pin the gate. Lower the weight-beam. It will not move again — not for a thousand years and more.'],
    ]);
    acolytes[1].pose = 'work';
    await game.shot([17.2, ET + 3.2, 24.4], [14.5, ET + 1.4, 18.4], 1.2, { fov: 46 });
    audio.sfxPlay('metal');
    await game.wait(1.2); W.setBeam(true); audio.sfxPlay('door'); game.shake = 0.1;
    await game.wait(0.4); game.shake = 0; acolytes[1].pose = null;
    await game.say('kai', 'Pinned for a thousand years. A bridge onto that roof — in every age after this one.');
    await game.shot([9.4, ET + 1.7, 30.0], [12.2, ET + 1.55, 28.2], 1.0, { fov: 38 });
    await game.talk([
      ['sefa', 'Now the star that does not move. Its seat is on the ring around the drum. But there is no star in that seat. Not in my sky.'],
      ['sefa', 'We keep the seat for it. It comes in the far time.'],
      ['kai', 'Precession. The pole drifts. In my time Polaris sits on it.'],
      ['sefa', 'Then go to the far time, Seventeenth. The roofs will take you up. They were built for a man who walks between ages.'],
    ]);
    sefa.lookTarget = null;
    ui.addEvidence('The Sun Gate', 'Aligned to the summer sunrise at the eastern notch (bearing 062°, 6° up), c. 1000 BCE. The keepers pinned it and lowered its weight-beam — a bridge to the first roof in every later age.', 'INSTRUMENT 1/3 · DAWN');
    cine(false);
    game.checkpoint(14.5, ET, 22.0, Math.PI);
    game.objective('Climb the east roofs to the ziggurat · use the state where each crossing stands');
    // rooftop barks
    game.onUpdate(() => {
      if (!game.control || S.ended) return;
      if (Math.abs(pl.pos.y - R1) < 0.3 && pl.pos.z < 10 && pl.pos.x > 13 && T.current !== 'past' && once('gap1')) ui.subtitle('kai', 'The stair-bridge to the next roof has fallen. In Sefa\'s time it stood.', 3600);
      if (Math.abs(pl.pos.y - R2) < 0.3 && pl.pos.z < -1.5 && pl.pos.x > 15 && T.current !== '2049' && once('gap2')) ui.subtitle('kai', 'No way up from here. Helix would have scaffolded a roof like this.', 3600);
      if (Math.abs(pl.pos.y - R3) < 0.3 && pl.pos.x < 16.5 && pl.pos.z < -8 && T.current !== '2196' && once('gap3')) ui.subtitle('kai', 'Five metres to the terrace. Too far to jump. Somebody in the ruin must have bridged it.', 3600);
    });
    hint(() => !S.fight1 && pl.pos.y < ET + 0.5 && pl.pos.z < 24 && pl.pos.x > 9, 70, () => ui.subtitle('kai', 'The weight-beam from the Sun Gate reaches the first roof.', 3000));
    hint(() => !S.fight1 && Math.abs(pl.pos.y - R1) < 0.4, 80, () => ui.subtitle('kai', 'Each crossing exists in a different state. Past for the stone bridge, 2049 for scaffolding, 2196 for whatever the scavengers built.', 4200));
    await game.waitFor(() => T.current === '2196' && ((pl.pos.x < 15.4 && Math.abs(pl.pos.y - R3) < 0.5 && pl.pos.z < -8.6 && pl.pos.z > -11.4) || (Math.abs(pl.pos.y - T1) < 0.5 && pl.pos.z < -4.5 && pl.pos.x < 10.5)));

    // ---------- the scavengers ----------
    cine(true);
    const [s1x, s1z] = polar(100, 8.6);
    await game.shot([13.6, R3 + 2.2, -6.4], [s1x, RING + 1.2, s1z], 1.8, { fov: 44 });
    scav1.c.lookTarget = kai.head;
    await game.shot([14.2, R3 + 6.5, -2], [0, TOP + 1, -16], 2.4, { fov: 50 });
    await game.say('kai', 'People. On the ring, and on the summit — stripping the bronze.');
    await game.shot([s1x + 3.0, RING + 1.8, s1z + 2.4], [s1x, RING + 1.4, s1z], 1.4, { fov: 36 });
    await game.say('scav', 'Oi! Another one come to pray to the house? Pray to this.');
    scav1.c.lookTarget = null;
    cine(false);
    lockMusic(null); musicState.fight = 1; music();
    ui.toast('TEMPORAL SCAVENGERS\nTheir gauntlet pulse throws whatever it hits three seconds back — you too.\nSidestep the pulse. When the gauntlet vents amber, close in and take them down.', 7200);
    game.checkpoint(9.2, T1, -10, -Math.PI / 2, () => { scav1.state = 'idle'; scav1.t = 0; });
    if (pl.pos.x > 15.3) pl.place(14.8, R3, -10, -Math.PI / 2);
    scav1.active = true;
    game.objective('Take down the scavenger on the ring');
    hint(() => scav1.state !== 'down', 40, () => ui.subtitle('kai', 'Wait for the pulse, step aside, then go for him while the gauntlet vents.', 3600));
    await game.waitFor(() => scav1.state === 'down' && game.control);
    S.fight1 = true; musicState.fight = 0; music();
    cine(true);
    const s1p = scav1.c.root.position;
    await game.shot([s1p.x + 2.2, s1p.y + 1.4, s1p.z + 1.6], [s1p.x, s1p.y + 0.5, s1p.z], 1.0, { fov: 40 });
    await game.talk([
      ['scav', 'Ow. Fine! Take it. It all comes back anyway.'],
      ['kai', 'What comes back?'],
      ['scav', 'The bronze. We strip it every week. Every morning it\'s back on the house. Dace says it\'s haunted.'],
    ]);
    F.m7firstScav = true;
    ui.addEvidence('Rewind gauntlets', '2196 scavengers strip the observatory\'s bronze with gauntlets whose pulses throw whatever they hit three seconds back in time. "Every morning it\'s back on the house."', 'SCAVENGERS · 2196');
    cine(false);
    game.checkpoint(P.ringStairTop[0], RING, P.ringStairTop[2], Math.PI);
    game.objective('Follow the exterior ring north to the Pole Sight');
    // ring barks
    game.onUpdate(() => {
      if (!game.control || Math.abs(pl.pos.y - RING) > 0.6 || S.ended) return;
      const th = bearingAround(pl.pos.x, pl.pos.z);
      if (th < 52 && th > 46 && T.current === '2196' && once('rb96')) ui.subtitle('kai', 'The ring\'s fallen away ahead. In the other states it\'s whole here.', 3200);
      if (th < 84 && th > 78 && T.current === '2049' && once('rb49')) ui.subtitle('kai', 'Helix\'s ring is broken here. The ruin\'s isn\'t — not this part.', 3200);
    });
    hint(() => !S.pole && Math.abs(pl.pos.y - RING) < 0.6, 90, () => ui.subtitle('kai', 'Wherever the ring is broken in one state, try another. The Pole Sight is at the north.', 3600));
    await game.waitFor(() => near(P.poleSight[0], P.poleSight[2], 4.5) && Math.abs(pl.pos.y - RING) < 0.8);
    game.checkpoint(P.poleSight[0] + 1.6, RING, P.poleSight[2] + 0.6, -Math.PI / 2);
    if (once('psFirst')) {
      cine(true);
      await game.shot([P.poleSight[0] + 3.2, RING + 2.0, P.poleSight[2] + 2.6], [P.poleSight[0], RING + 1.6, P.poleSight[2] - 1], 1.4, { fov: 42 });
      await game.say('kai', T.current === '2049' ? 'The Pole Sight. And stars — a whole night of them.' : T.current === 'past' ? 'The Pole Sight, pinned with bronze. I need the night of 2049 for this.' : 'Rusted. The night sky I need is in 2049.');
      cine(false);
    }
    game.objective('Align the Pole Sight with the star that does not move (2049, night)');
    let poleBusy = false;
    game.interact({ pos: [P.poleSight[0], RING + 1.4, P.poleSight[2]], radius: 2.2, once: false, states: ['2049'], enabled: () => !S.pole && !poleBusy, prompt: 'Work the Pole Sight', onUse: async () => {
      if (T.current !== '2049') return;
      poleBusy = true; game.control = false;
      try { await poleSight.operate(); } finally { poleBusy = false; game.control = true; game.releaseCam(); ui.letterbox(false); }
    } });
    hint(() => !S.pole && T.current === '2049' && near(P.poleSight[0], P.poleSight[2], 8), 75, () => ui.subtitle('kai', 'The pole sits due north, as high above the horizon as the latitude. The survey board has the latitude.', 4000));
    hint(() => !S.pole && T.current !== '2049' && near(P.poleSight[0], P.poleSight[2], 8), 45, () => ui.subtitle('kai', 'I need the stars. 2049 — the night.', 2600));
    await game.waitFor(() => poleSight.aligned && poleSight.locked && !ui.dlgActive);

    // ---------- the star that does not move ----------
    S.pole = true; musicState.aligned = 2; F.m7poleSight = true;
    cine(true);
    night.mark('Polaris', 0x9fe8ff);
    await game.shot([P.poleSight[0] + 1.6, RING + 1.9, P.poleSight[2] + 3.4], [P.poleSight[0] - 6, RING + 22, P.poleSight[2] - 30], 2.4, { fov: 46 });
    await game.say('kai', 'Polaris. They kept its seat for three thousand years, and it came.');
    audio.sfxPlay('door'); game.shake = 0.08;
    await game.shot([2.6, RING + 2.2, -21.6], [-0.7, RING + 1.4, -24.1], 1.2, { fov: 44 });
    W.setDoor(true); W.starDoorCol.later.enabled = false; audio.sfxPlay('success');
    await game.wait(0.6); game.shake = 0;
    await game.say('kai', 'The star door opened. Chains in the wall — the sight was the key.');
    ui.addEvidence('The Pole Sight', 'Aligned in 2049 on Polaris (due north, 38.2° up — the site\'s latitude). The keepers pinned it on the empty pole c. 1000 BCE; the star arrived in Kai\'s age. The alignment opens the star door to the summit in every later state.', 'INSTRUMENT 2/3 · NIGHT');
    cine(false);
    game.checkpoint(-0.2, RING, -22.4, Math.PI);
    game.objective('Climb the star stair to the summit');
    game.onUpdate(() => { if (game.control && T.current === '2049' && pl.pos.y > TOP - 0.5 && pl.pos.x < -6 && once('canopy')) ui.subtitle('kai', 'Helix sealed the summit under a canopy. In 2196 there\'s no canopy left.', 3400); });
    hint(() => !S.fight2 && pl.pos.y > RING + 3, 70, () => ui.subtitle('kai', 'The summit is sealed in 2049. Try the ruin.', 2800));
    await game.waitFor(() => T.current === '2196' && pl.pos.y > TOP - 0.4 && (Math.hypot(pl.pos.x - DC[0], pl.pos.z - DC[1]) < 7.4 || (pl.pos.x < -5 && pl.pos.z < -18)));

    // ---------- the summit: Dace's crew and the turning floor ----------
    cine(true);
    S.lockReason = 'THEIR GAUNTLETS ANCHOR THE SUMMIT\nNo switching until the scavengers are down';
    pl.place(-7.6, TOP, -21.2, Math.PI / 2);
    await game.shot([-9.0, TOP + 5.5, -26], [0, TOP, -14], 2.6, { fov: 52 });
    await game.shot([-3.2, TOP + 3.0, -22.6], [DC[0] + 0.9, TOP + 1.5, DC[1] + 1.4], 1.6, { fov: 44 });
    dace.c.lookTarget = kai.head;
    await game.talk([
      ['dace', 'Another one for the house. Get in line.'],
      ['kai', 'That instrument has to point at the evening star.'],
      ['dace', 'That instrument is six weeks of food for my people. Point at that.'],
    ]);
    dace.c.lookTarget = null;
    await game.shot([-6.0, TOP + 2.2, -17.8], [0, TOP, -16], 1.6, { fov: 50 });
    await game.say('kai', 'The floor is turning — rings around the pillar. I\'ll have to ride them.');
    cine(false);
    musicState.fight = 1; music();
    game.checkpoint(-7.6, TOP, -21.2, Math.PI / 2, () => { for (const s of scavs) if (s.state !== 'down') { s.state = 'idle'; s.t = 0; } });
    for (const s of [scav2, scav3, dace]) s.active = true;
    const fightObj = () => game.objective(`Take down Dace's crew (${[scav2, scav3, dace].filter(s => s.state === 'down').length}/3) · ride the turning rings to the pillar`);
    fightObj();
    let downsSeen = 0;
    game.onUpdate(() => { const n = [scav2, scav3, dace].filter(s => s.state === 'down').length; if (n !== downsSeen && !S.fight2) { downsSeen = n; fightObj(); if (n === 2 && dace.state !== 'down') ui.subtitle('dace', 'Stay off my ring!', 2200); } });
    hint(() => !S.fight2 && pl.pos.y > TOP - 0.5, 75, () => ui.subtitle('kai', 'Step onto a ring segment as it passes, ride it in, step off onto the pillar. Their pulses throw the ring back — watch for it.', 4400));
    await game.waitFor(() => [scav2, scav3, dace].every(s => s.state === 'down') && game.control);

    // ---------- parley ----------
    S.fight2 = true; S.lockReason = null; musicState.fight = 0;
    cine(true); lockMusic('m7-dusk');
    const dp = dace.c.root.position;
    dace.c.pose = 'sad'; dace.c.lookTarget = kai.head; kai.lookTarget = dace.c.head;
    await game.shot([dp.x + 2.4, dp.y + 1.5, dp.z - 1.6], [dp.x, dp.y + 0.9, dp.z], 1.2, { fov: 40 });
    await game.talk([
      ['dace', 'Every week we strip it. Every morning it\'s back. The house puts itself back.'],
      ['kai', 'Your gauntlets push things back in time. Every pulse you\'ve fired up here — you\'ve been feeding it.'],
      ['dace', 'Feeding what?'],
      ['kai', 'Whatever is under this house.'],
    ]);
    const pick = await ask(game, 'kai', 'What do I do with them?', ['Let them go. Take nothing.', 'Take Dace\'s gauntlet.', 'Tell them to leave the bronze and never come back.']);
    if (pick === 0) { await game.talk([['kai', 'Go. Eat. Find something that doesn\'t come back.'], ['dace', '…You\'re a strange kind of priest.']]); S.scavOutcome = 'spared'; }
    else if (pick === 1) { await game.talk([['kai', 'The gauntlet. Give it to me.'], ['dace', 'Take it. It never did anything but give back what we took.']]); S.scavOutcome = 'disarmed'; F.rewindGauntlet = true; }
    else { await game.talk([['kai', 'Leave the bronze. Don\'t come back to this hill.'], ['dace', 'There\'s nothing else on this hill. …Fine. The house wins.']]); S.scavOutcome = 'banished'; }
    F.m7scavengers = S.scavOutcome;
    ui.addEvidence('Dace\'s crew', `The summit crew stripped the Wandering Ring for food; every morning the bronze was back. Kai's choice: ${S.scavOutcome === 'spared' ? 'let them go' : S.scavOutcome === 'disarmed' ? 'took Dace\'s rewind gauntlet' : 'sent them off the hill'}.`, 'SCAVENGERS · 2196');
    await ui.fade(1, 700);
    for (const s of [scav1, scav2, scav3, dace]) { s.c.root.visible = false; s.c.root.position.y = -200; T.objects = T.objects.filter(o => o !== s.c.root); }
    dace.c.lookTarget = null; kai.lookTarget = null;
    pl.place(DC[0] - 1.6, TOP, DC[1] + 0.6, -Math.PI / 2);
    await ui.fade(0, 700);
    lockMusic(null);
    cine(false);
    game.checkpoint(DC[0] - 1.6, TOP, DC[1] + 0.6, -Math.PI / 2);
    game.objective('Align the Wandering Ring with the evening star (2196, dusk)');
    let armBusy = false;
    game.interact({ pos: [P.armillary[0], TOP + 1.6, P.armillary[2]], radius: 2.5, once: false, states: ['2196'], enabled: () => !S.arm && !armBusy, prompt: 'Work the Wandering Ring', onUse: async () => {
      if (T.current !== '2196') return;
      armBusy = true; game.control = false;
      try { await armillary.operate(); } finally { armBusy = false; game.control = true; game.releaseCam(); ui.letterbox(false); }
    } });
    hint(() => !S.arm && near(DC[0], DC[1], 4), 70, () => ui.subtitle('kai', 'The wanderer follows the sun down. West, a little south of where it set, low.', 3600));
    await game.waitFor(() => armillary.aligned && armillary.locked && !ui.dlgActive);

    // ---------- the triad: the house speaks to the stone ----------
    S.arm = true; musicState.aligned = 3; F.m7armillary = true; F.m7aligned = true;
    cine(true);
    dusk.mark('Venus', 0xffe0b0);
    await game.shot([DC[0] + 6, TOP + 3, DC[1] + 6], [DC[0], TOP + 2.4, DC[1]], 1.6, { fov: 46 });
    audio.sfxPlay('success'); kai.wristBoost = 14; game.shake = 0.1;
    ui.addEvidence('The Wandering Ring', 'Aligned in 2196 on the evening star (Venus, bearing 272°, 14° up) after Dace\'s crew was stopped. With three instruments told their stars, the house answered the stone beneath it.', 'INSTRUMENT 3/3 · DUSK');
    for (const st of ['past', '2049', '2196']) {
      await T.switchTo(st, { force: true, free: true, dur: 650 });
      if (st === 'past') await game.shot([-6.4, C + 2.6, 33.6], [-3.5, C, 27.6], 1.2, { fov: 46 });
      else if (st === '2049') await game.shot([P.poleSight[0] + 1.6, RING + 1.9, P.poleSight[2] + 3.4], [P.poleSight[0] - 6, RING + 22, P.poleSight[2] - 30], 1.2, { fov: 46 });
      else await game.shot([DC[0] + 6, TOP + 3, DC[1] + 6], [DC[0] - 8, TOP + 3, DC[1]], 1.2, { fov: 46 });
    }
    game.shake = 0; audio.sfxPlay('boom');
    await game.say('kai', 'All three — in three different skies. And under my feet, something just answered.');
    pl.place(DC[0] - 1.2, TOP, DC[1] + 0.4, -Math.PI / 2);
    await game.shot([DC[0] + 7.5, TOP + 2.0, DC[1] + 4], [DC[0], TOP + 0.8, DC[1]], 1.2, { fov: 44 });
    audio.sfxPlay('door'); game.shake = 0.06;
    await tween(3.2, u => { W.pillar.position.y = -u * 4; W.armillary.group.position.y = TOP - u * 4; pl.pos.y = TOP - u * 4; for (const b of W.pillarCols) b.enabled = false; });
    game.shake = 0;
    await ui.fade(1, 1200);

    // =====================================================================================
    // THE HALL OF DATES
    // =====================================================================================
    inHall = true; W.groups.hall.visible = true; applySky(T.current); hallState(W, T.current); lightT = 0; rigLights();
    W.pillar.position.y = 0; W.armillary.group.position.y = TOP;
    pl.place(0, C, -8.0, Math.PI);
    game.checkpoint(0, C, -8.0, Math.PI);
    lockMusic(null); music();
    await game.shot([0, C + 2.2, -6.0], [0, C + 2.6, -22], 0.01, { fov: 52 });
    await ui.fade(0, 1200);
    await game.shot([4.6, C + 3.4, -7.2], [0, C + 2.2, -24.5], 3.0, { fov: 50 });
    await game.talk([
      ['kai', 'Under the drum. Seventeen stones around the walls… and the Chronolith at the end of them.'],
      ['kai', 'Every stone is a count of sunrises. My wrist turns the counts into dates.'],
    ]);
    cine(false);
    const readObj = () => game.objective(S.read.size < 5 ? `Read the stones in the Hall of Dates (${S.read.size}/5)` : 'Read the seventeenth stone, beside the Chronolith');
    readObj();
    W.steles.forEach((s, i) => {
      if (i === 16) return;
      const [date, carved, kaiLine] = DATES[i];
      game.interact({ pos: [s.pos[0], C + 1.2, s.pos[2]], radius: 1.9, once: false, enabled: () => !S.ended && !S.inHallScene, prompt: `Read stone ${i + 1}`, onUse: async () => {
        cine(true);
        await game.shot([s.pos[0] + s.n.x * 1.3, C + 1.8, s.pos[2] + s.n.z * 1.3], s.face, 0.8, { fov: 40 });
        await game.say('kai', T.current === '2196' && i % 4 === 1 ? `Half the count is under moss… ${kaiLine}` : kaiLine);
        if (i === 1 && F.m5_riverDiverted) await game.say('kai', 'Tala\'s river. I did that.');
        if (!S.read.has(i)) { S.read.add(i); ui.addEvidence(`Stone ${i + 1} · ${date}`, `"${carved}" — counted in sunrises from the first fire.`, 'THE HALL OF DATES'); }
        F.m7datesRead = S.read.size;
        cine(false); readObj();
      } });
    });
    hint(() => S.read.size < 5, 70, () => ui.subtitle('kai', 'The stones run in order around the hall. The count ends at the black stone.', 3400));
    // the seventeenth
    let read17 = false;
    const s17 = W.steles[16];
    game.interact({ pos: [s17.pos[0], C + 1.2, s17.pos[2]], radius: 2.0, once: false, enabled: () => S.read.size >= 5 && !read17, prompt: 'Read the seventeenth stone', onUse: () => { read17 = true; } });
    hint(() => S.read.size >= 5 && !read17, 50, () => ui.subtitle('kai', 'The seventeenth stone. Next to the Chronolith.', 2600));
    await game.waitFor(() => read17);

    // ---------- "They knew who." ----------
    S.inHallScene = true;
    cine(true);
    await game.shot([s17.pos[0] + 1.0, C + 1.7, s17.pos[2] + 1.2], s17.face, 1.2, { fov: 34 });
    kai.wristBoost = 12; audio.sfxPlay('anomaly');
    await game.talk([
      ['kai', 'No sky event on this one. A mark — the same mark as my wrist.'],
      ['kai', `And the count converts to… ${KAI_BIRTH}.`],
      ['kai', 'That\'s my birthday.'],
    ]);
    if (T.current !== 'past') await T.switchTo('past', { force: true, free: true, dur: 900 });
    sefa.root.position.set(-1.6, C, -20.6); sefa.root.rotation.y = 0.6; sefa.lookTarget = kai.head; sefa.pose = null;
    niko.root.position.set(-3.4, C, -18.4); niko.root.rotation.y = 0.9; niko.lookTarget = kai.head; nikoGo = false;
    pl.place(1.6, C, -23.6, -2.4);
    kai.lookTarget = sefa.head;
    await game.shot([3.6, C + 1.8, -21.0], [-1.6, C + 1.5, -20.6], 1.4, { fov: 40 });
    await game.say('sefa', 'You found your stone.');
    await game.shot([-0.6, C + 1.7, -19.4], [1.6, C + 1.6, -23.6], 1.0, { fov: 36 });
    await game.say('kai', 'How could they know when I would be born?');
    audio.silence(1.2); await game.wait(0.9);
    await game.shot([2.6, C + 1.65, -22.6], [-1.6, C + 1.55, -20.6], 1.2, { fov: 32 });
    await game.say('sefa', 'They didn\'t know when. They knew who.');
    await game.talk([
      ['sefa', 'The black stone gave the first keepers a name before it gave them a date. We counted the sunrises until the count reached you.'],
      ['niko', 'You are the seventeenth.'],
      ['kai', 'And the sixteen before me?'],
      ['sefa', 'Before you, the count was always you.'],
    ]);
    await game.talk([
      ['sefa', 'One more thing, Seventeenth. Someone else came to read your stone. In the far time — a woman with your eyes.'],
      ['sefa', 'She left something behind it, for you. Not in my age.'],
    ]);
    F.m7birthDate = KAI_BIRTH; F.m7knewWho = true;
    ui.addEvidence('The seventeenth stone', `Beside the Chronolith, the last stone carries no sky event — only Kai's mark, and a count that converts to ${KAI_BIRTH}: his birth date, carved three thousand years early. Sefa: "They didn't know when. They knew who."`, 'THE HALL OF DATES');
    sefa.lookTarget = null; niko.lookTarget = null; kai.lookTarget = null;
    cine(false); S.inHallScene = false;
    game.objective('Find what she left behind the seventeenth stone (2049)');
    let foundRec = false;
    game.interact({ pos: [s17.pos[0], C + 0.8, s17.pos[2]], radius: 2.0, once: false, states: ['2049'], enabled: () => !foundRec, prompt: 'Look behind the seventeenth stone', onUse: () => { foundRec = true; } });
    game.interact({ pos: [s17.pos[0], C + 0.8, s17.pos[2]], radius: 2.0, once: false, states: ['past', '2196'], enabled: () => !foundRec && !S.inHallScene, prompt: 'Look behind the seventeenth stone', onUse: () => ui.subtitle('kai', T.current === 'past' ? 'Only dust and the wall. "Not in my age."' : 'Roots. Whatever was here, the ruin took it. Or it was never left in this year.', 3400) });
    hint(() => !foundRec && T.current !== '2049', 45, () => ui.subtitle('kai', '"The far time." Mira — if it\'s Mira — would have come here in my time. 2049.', 3600));
    await game.waitFor(() => foundRec);

    // ---------- Mira's hidden recording ----------
    S.ended = true;
    cine(true); lockMusic(null); audio.setTheme(null, 0.6);
    pl.place(s17.pos[0] + 0.2, C, s17.pos[2] + 0.5, Math.PI); kai.pose = 'work';
    await game.shot([s17.pos[0] + 1.2, C + 1.3, s17.pos[2] + 0.9], [2.95, C + 0.6, -25.9], 1.4, { fov: 34 });
    await tween(0.8, u => { W.recorder.position.set(2.95, C + 0.53 + Math.sin(u * Math.PI) * 0.12, -26.62 + u * 0.7); });
    W.recLed.material.emissiveIntensity = 8; audio.sfxPlay('pickup');
    await game.say('kai', 'A recorder. Wedged behind the stone. "REC 14.08.2041 · M. VAREN."');
    kai.pose = null;
    await game.say('kai', '2041. She\'d been dead for fifteen years.');
    lockMusic('m7-mira');
    await game.shot([s17.pos[0] - 1.6, C + 1.7, s17.pos[2] + 2.6], [s17.pos[0], C + 1.4, s17.pos[2]], 2.0, { fov: 40 });
    audio.sfxPlay('rewind'); await game.wait(0.5);
    await game.talk([
      ['mirarec', 'Kai. It\'s me. If you\'re hearing this, you told all three of them their stars, and you found your birthday on a wall three thousand years old.'],
      ['mirarec', 'I was scared too. The first time.'],
      ['mirarec', 'Helix thinks the Chronolith records us. Every switch, every second, written down after it happens.'],
      ['mirarec', 'It doesn\'t record you, Kai. It\'s been waiting for you. Every instrument in this house points at one night — the night you were born.'],
      ['mirarec', 'It was counting toward you before they lit the first fire.'],
    ]);
    await game.shot([0, C + 1.4, -21.0], [0, C + 2.6, -25.4], 2.4, { fov: 46 });
    await game.talk([
      ['mirarec', 'I don\'t know yet if that\'s a promise or a trap. Come and find me.'],
      ['mirarec', 'I\'ll be at the end of the count. I always am.'],
    ]);
    audio.silence(1.6); await game.wait(1.4);
    await game.shot([1.6, C + 1.7, -20.8], [2.6, C + 1.5, -25.6], 1.6, { fov: 38 });
    await game.talk([
      ['kai', 'Not recording me.'],
      ['kai', 'Waiting for me.'],
    ]);
    F.m7miraRecording = true; F.chronolithAnticipates = true;
    ui.addEvidence('Mira\'s recording, 2041', 'Hidden behind the seventeenth stone, dated 14.08.2041 — fifteen years after Mira\'s official death: "It doesn\'t record you. It\'s been waiting for you. Every instrument in this house points at one night — the night you were born."', 'THE HALL OF DATES · 2049');
    audio.sfxPlay('motif');
    await game.shot([0, C + 3.2, -8.5], [0, C + 2.4, -25.4], 3.6, { fov: 52 });
    await ui.fade(1, 2400);
    const mins = Math.round((game.time - tStart) / 60);
    await ui.chapterCard('MISSION 7 COMPLETE', 'The Broken Observatory', `Instruments 3/3 · Dates read ${S.read.size + 1}/17 · Shards ${S.shards}/5${mins ? ' · ' + mins + ' min' : ''}`, 3600);
    F.m7done = true;
    delete T.canSwitch;
    ring.dispose();
    game.releaseCam(); ui.letterbox(false); audio.allBeds(0); audio.setTheme(null);
  },
};
