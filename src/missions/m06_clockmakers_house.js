// MISSION 6 · THE CLOCKMAKER'S HOUSE (Act I) — teaches Local Loops.
// Bible beats: observe a repeating mechanical arm and cross the workshop · reveal a hidden staircase by comparing
// room states · set clock mechanisms to different positions in past, present and future · find a recording left by
// older Kai ("When the child returns, do not let him see the ninth minute."). Optional: The Clockmaker's Debt.
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { buildHouse, registerM6Cast, registerM6Themes, P, TY, towerState, KID_KAI, KID_MIRA, NEIGHBOR_LOOK } from '../world/env_m6.js';
import { LocalLoop, loopRoutine } from '../systems/loops.js';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { Walker } from '../world/props.js';
import { glowMat } from '../world/kit.js';

const HOURS = ['III', 'VIII', 'IX', 'XII'];
const HOUR_VAL = { III: 3, VIII: 8, IX: 9, XII: 0 };

export default {
  id: 'm6', act: 'ACT I · THE WORLD THAT REMEMBERS', title: 'The Clockmaker\'s House', sub: 'A workshop that repeats itself',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player;
    registerM6Cast(); registerM6Themes();
    try {
      const need = ['oskar', 'oskar26', 'lotte'].filter(id => !ui.portraits[id] && CAST[id]?.look);
      if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]]))));
    } catch (err) { console.warn('m6 portraits', err); }

    const scene = game.newScene({ background: 0x0a0d12, fog: [0x141820, 0.016], exposure: 1.05, bloom: 0.6, bloomThreshold: 0.86, envIntensity: 0.75, killY: -12, residue: true });
    towerState.set = 0;
    const W = buildHouse(game, T, { brokenDoor: F.trustedHale === false });
    const G = W.groups;
    game.onUpdate((dt, t) => W.update(dt, t));

    // ---------- skies + image-based light ----------
    const rr = game.engine.renderer, skies = {};
    let interior = null;
    try {
      skies['2049'] = RZ.skyEnvironment(rr, scene, { preset: 'night-city', cover: 0.86, apply: false });
      skies['2026'] = RZ.skyEnvironment(rr, scene, { preset: 'golden-hour', azimuth: 200, apply: false });
      skies['2196'] = RZ.skyEnvironment(rr, scene, { preset: 'overcast', elevation: 14, apply: false });
      interior = RZ.skyEnvironment(rr, scene, { preset: 'interior', color: 0xffe2c0, wall: 0x3a2e24, window: 0x8aa0c0, apply: false });
    } catch (err) { console.warn('m6 sky', err); }

    // ---------- lights: a constant set, re-rigged per zone and era (no shader recompiles) ----------
    const hemi = new THREE.HemisphereLight(0x6a5a48, 0x1a120c, 0.3); scene.add(hemi);
    const key = new THREE.SpotLight(0xffd8a8, 40, 34, 0.9, 0.6, 1.4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; scene.add(key, key.target);
    const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.7); scene.add(l); return l; });
    const RIG = {
      street: { '2049': { k: [[2.6, 7, 17], [0, 0, 9], 0xffb070, 160, 0.95], p: [[[-3.6, 1.8, 9.4], 0xffc98a, 16, 9], [[-2.8, 5.0, 28], 0xffd0a0, 26, 16], [[3.6, 3.0, 22], 0x7fb8ff, 10, 10]], h: [0x2a3448, 0x0c0a08, 0.4] } },
      shop: {
        '2026': { k: [[-3, 7.5, 17], [-1.5, 0, 3], 0xffd49a, 300, 0.5], p: [[[0, 3.1, 3.5], 0xffe2b8, 14, 12], [[-6, 1.6, 1.5], 0xffc070, 5, 5], [[5.8, 1.6, 3.5], 0xfff0d0, 4, 5]], h: [0xffe0c0, 0x3a2a1a, 0.6] },
        '2049': { k: [[0, 3.6, 3.5], [0, 0, 3.4], 0xffd8a8, 34, 1.2], p: [[[-6, 1.6, 1.5], 0xffb060, 6, 6], [[5.8, 1.5, 3.5], 0xfff0d0, 5, 5], [[0, 2.4, 9.6], 0xff9a50, 9, 10]], h: [0x6a5a48, 0x1a120c, 0.32] },
        '2196': { k: [[2, 10, 3], [0, 0, 3.6], 0xb8c8e0, 140, 0.55], p: [[[0, 3, 6], 0x9ab0c8, 6, 10], [[-5, 1.4, 1], 0x6a7a68, 3, 6], [[4, 2, 0], 0x8aa0b0, 3, 8]], h: [0x8090a0, 0x1a2018, 0.55] },
      },
      workshop: { '2049': { k: [[0, 8.7, -11], [0, 0, -11], 0xffe0b0, 260, 1.05], p: [[[0, 5.5, -21.8], 0xffb070, 34, 14], [[0, 4.5, -27], 0xffc890, 22, 12], [[0, 2.8, -2.6], 0xffd8a8, 9, 8]], h: [0x6a5a48, 0x1a120c, 0.32] } },
      study: {
        '2026': { k: [[-1, 7.5, -47], [0, 0, -36], 0xffd8a0, 260, 0.55], p: [[[-6.3, 0.7, -35.5], 0xff8a40, 14, 7], [[2.4, 1.4, -38.4], 0xffd090, 6, 5], [[0, 4.2, -34], 0xffe2b8, 10, 12]], h: [0xffe0c0, 0x3a2a1a, 0.55] },
        '2049': { k: [[0, 4.4, -35], [0, 0, -35.4], 0xffd8a8, 42, 1.2], p: [[[-6.4, 0.6, -35.5], 0xff7a30, 8, 7], [[2.4, 1.3, -38.3], 0xffd090, 6, 5], [[0, 3, -40.4], 0x8aa0c0, 6, 10]], h: [0x6a5a48, 0x1a120c, 0.3] },
        '2196': { k: [[3, 13, -37], [0, 0, -36], 0xc0d0e8, 200, 0.6], p: [[[0, 3, -44], 0xc8d8e8, 10, 14], [[5, 2, -34], 0x8aa0b0, 4, 8], [[-4, 2, -32], 0x7a8a7a, 3, 8]], h: [0x8090a0, 0x1a2018, 0.6] },
      },
      tower: {
        '2026': { k: [[-0.4, 15, -24], [-0.4, TY, -37], 0xffe0b0, 320, 0.7], p: [[[0, 13, -35], 0xffe8c8, 14, 16], [[5.6, TY + 1.6, -34.4], 0xffd8a8, 7, 6], [[1.4, TY + 3.8, -35], 0xffc070, 8, 6]], h: [0xffe0c0, 0x3a2a1a, 0.5] },
        '2049': { k: [[-0.4, 15, -25], [-0.5, TY, -37], 0xffb070, 240, 0.65], p: [[[1.4, TY + 2.4, -33], 0xffd8a8, 10, 8], [[5.6, TY + 1.6, -34.4], 0xffd8a8, 6, 6], [[-0.5, 16, -35], 0x9ab0d0, 8, 14]], h: [0x5a5048, 0x140e0a, 0.3] },
        '2196': { k: [[4, 32, -30], [-0.5, TY, -35], 0xd0e0f0, 280, 0.5], p: [[[-2, TY + 6, -35], 0xc0d8ff, 9, 10], [[5.6, TY + 1.6, -34.4], 0xa8b8c8, 5, 6], [[2, TY + 2, -31], 0xa8b8c8, 5, 8]], h: [0x8a9aa8, 0x1a2018, 0.65] },
      },
    };
    const zoneOf = (p) => {
      if (p.z > 8.3) return 'street';
      if (p.z > -1.15) return 'shop';
      if (p.z > -29.5 && p.y < 9) return 'workshop';
      if (p.y > 3.2 || (p.x > 6.2 && p.y > 2.4)) return 'tower';
      return 'study';
    };
    const FOG = { street: { '2049': [0x1a1c22, 0.011] }, shop: { '2026': [0x6a5a48, 0.02], '2049': [0x1a1612, 0.03], '2196': [0x5a6a70, 0.03] }, workshop: { '2049': [0x1c1814, 0.024] }, study: { '2026': [0x6a5a48, 0.018], '2049': [0x16120e, 0.03], '2196': [0x6a7a80, 0.025] }, tower: { '2026': [0x8a7a60, 0.018], '2049': [0x1a1612, 0.022], '2196': [0x8a9aa8, 0.016] } };
    let zone = null, rigKey = '';
    const applyRig = (force) => {
      const z = zoneOf(pl.pos), e = T.current, k = z + e;
      if (!force && k === rigKey) return; rigKey = k; const prevZone = zone; zone = z;
      const cfg = RIG[z][e] || RIG[z]['2049'] || RIG.shop[e];
      key.position.set(...cfg.k[0]); key.target.position.set(...cfg.k[1]); key.color.set(cfg.k[2]); key.intensity = cfg.k[3]; key.angle = cfg.k[4];
      pts.forEach((l, i) => { const c = cfg.p[i]; l.position.set(...c[0]); l.color.set(c[1]); l.intensity = c[2]; l.distance = c[3]; });
      hemi.color.set(cfg.h[0]); hemi.groundColor.set(cfg.h[1]); hemi.intensity = cfg.h[2];
      const fg = (FOG[z] && (FOG[z][e] || FOG[z]['2049'])) || [0x141820, 0.02]; scene.fog.color.set(fg[0]); scene.fog.density = fg[1];
      const sk = skies[e] || skies['2049'];
      if (sk) scene.background = sk.background;
      scene.environment = z === 'street' ? (skies['2049']?.envMap || null) : (interior?.envMap || sk?.envMap || null);
      scene.environmentIntensity = z === 'street' ? 0.7 : e === '2026' ? 0.9 : 0.6;
      if (W.rain) W.rain.visible = z === 'street';
      audio.rain(e === '2049' ? (z === 'street' ? 0.55 : z === 'workshop' ? 0.18 : 0.12) : 0);
      audio.wind(e === '2196' ? 0.3 : z === 'street' ? 0.12 : 0.04);
      audio.hum(z === 'workshop' ? 0.12 : 0, 47);
      if (prevZone !== z || force) music();
    };
    // music follows the beats: era themes in the house, the loop in the workshop, the tower in the tower
    const ERA_THEME = { '2026': 'm6-house-past', '2049': 'm6-house', '2196': 'm6-ruin' };
    let musicLock = null;
    const themeFor = (z, e) => musicLock || (z === 'workshop' ? 'm6-loop' : z === 'tower' ? 'm6-tower' : ERA_THEME[e]);
    const music = () => { const th = themeFor(zone, T.current); for (const d of T.defs) d.theme = themeFor(zone, d.id); audio.setTheme(th, 1.6); };
    const lockMusic = (th) => { musicLock = th; music(); };

    // ---------- eras ----------
    const state = { workOpen: false, crossed: false, observed: false, bookcase: false, tower: false, debt: 0, debtTalked: false, shards: 0, seen: {} };
    const applyEra = (e) => {
      if (W.facade?.userData.facade) { const f = W.facade.userData.facade; f.daylight = e === '2026' ? 1 : e === '2196' ? 0.65 : 0; f.lit = e === '2049' ? 0.45 : e === '2026' ? 0.12 : 0; }
      W.lampMat.emissiveIntensity = e === '2049' ? 4 : 0.2;
      W.embers.material.emissiveIntensity = e === '2026' ? 4 : e === '2049' ? 1.2 : 0;
      W.workDoor.position.x = e === '2049' && state.workOpen ? -1.62 : 0;
      W.workDoor.visible = e !== '2196';
      W.bracketClock.visible = true;
      rigKey = ''; applyRig(true);
    };
    T.configure([
      { id: '2026', key: '1', name: 'PAST', year: '2026', glyph: '◐', color: '#ffb060', theme: 'm6-house-past', apply: () => applyEra('2026') },
      { id: '2049', key: '2', name: 'PRESENT', year: '2049', glyph: '◎', color: '#5fe6ff', theme: 'm6-house', apply: () => applyEra('2049') },
      { id: '2196', key: '3', name: 'FUTURE', year: '2196', glyph: '◑', color: '#9affb0', theme: 'm6-ruin', apply: () => applyEra('2196') },
    ], '2049');
    game.onUpdate(() => applyRig(false));

    // ---------- people ----------
    const oskar = game.actor('oskar', null, 0, 0, 6.6, 0); T.only(oskar.root, '2049'); oskar.root.visible = false;
    const oskar26 = game.actor('oskar26', null, 2.4, 0, -37.4, Math.PI); T.only(oskar26.root, '2026');
    const lotte = game.actor('lotte', null, -4.05, 0, 3.0, -Math.PI / 2); T.only(lotte.root, '2026');
    const kidKai = game.actor('kidkai', KID_KAI, -3.95, 0, 4.4, -Math.PI / 2), kidMira = game.actor('kidmira', KID_MIRA, -3.95, 0, 5.15, -Math.PI / 2);
    for (const k of [kidKai, kidMira]) { k.setGhost(0x9fe8ff); k.root.visible = false; }
    kidMira.lookTarget = kidKai.head;
    const neighbor = new Walker(game, NEIGHBOR_LOOK, { x: -3.95, y: 0.14, z0: 22, z1: 22, idle: true, ry: Math.PI / 2 });
    game.onUpdate(dt => { neighbor.c.root.visible = zone === 'street'; if (zone === 'street') neighbor.update(dt); });
    game.onUpdate(() => {
      const show = game.residueOn && T.current === '2026' && zone === 'shop';
      kidKai.root.visible = kidMira.root.visible = show;
      if (show && !state.seen.kids) { state.seen.kids = true; ui.subtitle('kai', 'Two children at this counter. A boy with a stopped watch… and a girl drawing. That\'s Mira.', 4200); ui.addEvidence('Two children at the counter', 'Residue Vision in the 2026 shop: a boy and a girl at Hensel\'s counter. The boy is holding a watch. The girl is drawing. Kai and Mira, twenty-three years ago.', 'HENSEL & SON · 2026'); F.m6sawKids = true; }
    });

    // ---------- helpers ----------
    const near = (x, z, r) => Math.hypot(pl.pos.x - x, pl.pos.z - z) < r;
    const once = (k) => { if (state.seen[k]) return false; state.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const hint = (cond, secs, fn) => { let t = 0; const off = game.onUpdate(dt => { if (!game.control || game.ui.dlgActive) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); return off; };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u)); if (u >= 1) { off(); res(); } }); });
    const shard = (era, pos, title, text) => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), glowMat(0x7fe8ff, 3.4)); m.position.set(...pos); (era ? G[era] : G.all).add(m);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.01, 6, 32), glowMat(0x7fe8ff, 2)); m.add(halo);
      game.onUpdate((dt, t) => { m.rotation.y += dt * 1.4; m.position.y = pos[1] + Math.sin(t * 2.2) * 0.05; halo.rotation.x = t; });
      game.interact({ pos, radius: 1.7, states: era ? [era] : undefined, prompt: 'Take the temporal shard', onUse: () => {
        m.parent?.remove(m); state.shards++; F.shards = (F.shards || 0) + 1; F.m6shards = state.shards;
        audio.sfxPlay('anomaly'); ui.addEvidence(title, text, 'TEMPORAL SHARD · ' + state.shards + '/3');
      } });
    };

    // =====================================================================================
    // THE WORKSHOP LOOP (20 s): the great arm, the drop-hammers, the escapement gate
    // =====================================================================================
    const inWorkshop = (p = pl.pos) => p.z < -1.2 && p.z > -29.5 && p.y < 8;
    const loop = new LocalLoop(game, { id: 'm6-workshop', label: 'WORKSHOP LOOP', duration: 20, restart: [0, 0.36, -2.4, Math.PI], region: inWorkshop, resetToast: 'THE LOOP REWOUND\nNothing lost but time. You keep what you learned.' });
    loop.hudWanted = false;
    const arm = { phi: Math.PI / 2, prev: Math.PI / 2, jammed: false };
    const ease = x => x * x * (3 - 2 * x);
    const armAt = (t) => t < 4 ? Math.PI / 2 : t < 8 ? Math.PI / 2 - Math.PI * ease((t - 4) / 4) : t < 12 ? -Math.PI / 2 : t < 16 ? -Math.PI / 2 - Math.PI * ease((t - 12) / 4) : -1.5 * Math.PI;
    const HS = [0, 1.6, 3.2];
    const hammerY = (k, t) => { const p = ((t - HS[k]) % 5 + 5) % 5; return p < 0.25 ? 3 - 2.95 * (p / 0.25) ** 2 : p < 1.05 ? 0.05 : p < 2.25 ? 0.05 + 2.95 * ease((p - 1.05) / 1.2) : 3; };
    const hammerPhase = (k, t) => ((t - HS[k]) % 5 + 5) % 5;
    loop.track(arm, ['jammed']); loop.track(W.wedge, ['position', 'rotation']);
    loop.onWrap(() => { if (state.wedgeUsed && once('wedgeBack')) { ui.subtitle('kai', 'It put the wedge back on the bench. The room resets. Only I remember.', 4200); loop.learn('objects', 'The loop puts things back. Only what you know stays.'); } });
    game.onUpdate((dt) => {
      const t = loop.t;
      arm.prev = arm.phi;
      if (!arm.jammed && !loop.frozen) arm.phi = armAt(t);
      W.arm.rotation.y = Math.PI / 2 - arm.phi;
      const moving = Math.abs(arm.phi - arm.prev) > 1e-5, warn = !arm.jammed && (loop.window(3, 4) || loop.window(11, 12));
      W.armLamp.material.emissiveIntensity = moving ? 6 : warn ? 3 + Math.sin(t * 30) * 0 + 2 : 0.4;
      W.armBoxes.forEach((b, i) => { const r = 1.0 + i, cx = P.pivot[0] + Math.sin(arm.phi) * r, cz = P.pivot[1] + Math.cos(arm.phi) * r; b.min.set(cx - 0.38, 0.5, cz - 0.38); b.max.set(cx + 0.38, 1.35, cz + 0.38); });
      W.hammers.forEach((h, k) => {
        const y = loop.frozen ? h.y : hammerY(k, t), ph = hammerPhase(k, t);
        if (h.y > 0.06 && y <= 0.06 && Math.abs(pl.pos.z - h.z) < 16 && audio.ctx) { const a = audio.ctx.currentTime; audio.drum(a, 0.32, 120, 38); audio.tick(a, 0.12, 2400, audio.sfx); if (inWorkshop() && Math.abs(pl.pos.z - h.z) < 3) game.shake = 0.06; }
        h.y = y; h.g.position.y = y; h.box.min.y = y; h.box.max.y = y + 0.9;
        h.lamp.material.emissiveIntensity = (ph > 4.4 || ph < 0.25) && !loop.frozen ? 5 : 0.2;
      });
      if (game.shake > 0 && game.shake < 0.1) game.shake = Math.max(0, game.shake - dt * 0.6);
      // gate
      const open = loop.frozen ? 1 : loop.window(9, 12.5) ? 1 : 0, g = W.gate;
      g.open += (open - g.open) * Math.min(1, dt * 4);
      g.L.position.x = -1.12 - g.open * 1.15; g.R.position.x = 0 + g.open * 1.15; g.col.enabled = g.open < 0.7;
      g.lamp.material.emissive.set(open ? 0x40ff70 : loop.window(7, 9) ? 0xffa030 : 0xff3020);
      g.anchor.rotation.z = Math.sin(t * Math.PI) * 0.12;
      // drive gear, wall gears
      if (!arm.jammed && !loop.frozen) { W.driveGear.rotation.z += dt * (moving ? 2.4 : 0.3); for (const gr of W.gears) gr.m.rotation.z += dt * gr.s * (moving ? 1.6 : 0.25); }
      for (const tg of W.topGears) tg.m.rotation.z += dt * tg.s * 0.4;
      W.pendulum['2026'].rotation.z = Math.sin(game.time * Math.PI / 2) * 0.12;
    });
    // hazards — the arm sweeps a wedge each frame; the hammers fall
    const wrap2 = a => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    loop.hazard(() => {
      const dx = pl.pos.x - P.pivot[0], dz = pl.pos.z - P.pivot[1], r = Math.hypot(dx, dz);
      if (arm.jammed || r > P.armR + 0.32 || r < 0.3 || pl.pos.y > 1.3) return false;
      const sweep = arm.prev - arm.phi; if (sweep < 1e-5) return false;
      const m = 0.52 / Math.max(r, 0.6), psi = Math.atan2(dx, dz);
      return wrap2(psi - (arm.phi - m)) <= sweep + 2 * m ? 'THE ARM CAUGHT YOU' : false;
    });
    loop.hazard(() => {
      if (Math.abs(pl.pos.x) > 1.52) return false;
      for (let k = 0; k < 3; k++) { const h = W.hammers[k]; if (Math.abs(pl.pos.z - h.z) < 0.77 && hammerPhase(k, loop.t) < 1.05 && h.y < 1.9) return 'THE HAMMER CAME DOWN'; }
      return false;
    });
    // knowledge the player gains by watching (kept across resets; ring markers on the loop HUD)
    const watching = () => inWorkshop() && loop.hudWanted;
    loop.at(3, () => { if (inWorkshop()) audio.sfxPlay('clock'); });
    loop.at(4.2, null, { learn: ['arm1', '0:04  The arm sweeps the near side'], when: watching, warn: true });
    loop.at(11, () => { if (inWorkshop()) audio.sfxPlay('clock'); });
    loop.at(12.2, null, { learn: ['arm2', '0:12  The arm sweeps the far side'], when: watching, warn: true });
    loop.at(2.0, null, { learn: ['hammers', 'Hammers fall front to back every 5 s · wait on yellow'], when: () => watching() && pl.pos.z < -6 || (watching() && loop.iteration > 1) });
    loop.at(9.1, () => { if (inWorkshop()) audio.sfxPlay('door'); }, { learn: ['gate', '0:09  The gate opens for three seconds'], when: watching });
    loop.onReset((n) => {
      const lines = ['Back at the start. And I remember every second of it.', 'Again. The room doesn\'t learn. I do.', 'The arm rests on one side while it sweeps the other.', 'On the hammers: wait on the yellow, go when the one ahead lifts.'];
      ui.subtitle('kai', lines[Math.min(n - 1, lines.length - 1)], 3600);
      if (n === 3 && !arm.jammed) ui.toast('HINT · The drive gearbox on the landing can be jammed — until the loop puts things back', 5200);
    });
    game.onUpdate(() => { // restart anchors move with the player's progress
      if (!state.crossed && inWorkshop()) {
        if (pl.pos.z < -25.2) loop.setRestart(0, 0, -25.8, Math.PI);
        else if (pl.pos.z < -18.7 && loop.restart[2] > -18) loop.setRestart(0, 0, -18.7, Math.PI);
      }
      // the loop pins the workshop to 2049
      const pinned = inWorkshop(); if (pinned !== T.locked) T.locked = pinned;
    });
    // the wedge (optional route: jam the arm until the loop resets)
    game.interact({ pos: [2.65, 1.5, -1.6], radius: 1.7, once: false, enabled: () => !arm.jammed && state.workOpen, prompt: 'Jam the drive gear with the wedge', onUse: () => {
      arm.jammed = true; state.wedgeUsed = true; W.wedge.position.set(2.5, 1.62, -1.9); W.wedge.rotation.set(0, 0, 0.5);
      audio.sfxPlay('metal'); loop.frozen = false;
      if (once('jam')) ui.subtitle('kai', 'That should hold the arm. For a while.', 2600);
    } });
    // optional: the date drum on the pivot column flips to a year at 0:17; Hensel's drawer on the landing has a year lock.
    // The loop closes the drawer again at every wrap; what Kai read stays with him.
    loop.track(W.dateDrum.year, ['visible']); loop.track(W.dateDrum.blank, ['visible']); loop.track(W.drawer, ['position']);
    loop.at(17, () => { W.dateDrum.year.visible = true; W.dateDrum.blank.visible = false; if (inWorkshop()) audio.sfxPlay('clock'); },
      { learn: ['year', '0:17  The date drum on the column reads 2031'], when: () => watching() && pl.pos.z > -18 });
    loop.at(19.4, () => { W.dateDrum.year.visible = false; W.dateDrum.blank.visible = true; });
    game.onUpdate(() => { if (loop.knows('year') && inWorkshop() && !F.m6survey && once('yearBark')) ui.subtitle('kai', '2031. The year of the Helix surveys. That drawer on the landing has a year lock.', 4200); });
    const YEARS = ['2026', '2031', '2049', '2196'];
    game.interact({ pos: [-2.55, 1.05, -2.45], radius: 1.35, once: false, states: ['2049'], enabled: () => state.workOpen && !F.m6survey, prompt: 'Try Hensel\'s locked drawer', onUse: async () => {
      if (T.current !== '2049' || F.m6survey) return;
      const i = await game.choice('kai', loop.knows('year') ? 'A brass year lock: 20··. The drum on the column showed…' : 'A brass year lock: 20··. Four wheels, two already set.', [...YEARS, 'Leave it']);
      if (i >= YEARS.length) return;
      audio.sfxPlay('clock');
      if (YEARS[i] !== '2031') { audio.sfxPlay('fail'); ui.subtitle('kai', loop.knows('year') ? 'Not that year.' : 'It won\'t give. Something in this room must know the year.', 2600); return; }
      cine(true);
      await game.shot([-1.2, 1.7, -3.2], [-2.55, 0.95, -2.0], 1.0, { fov: 38 });
      audio.sfxPlay('door'); await tween(0.7, u => { W.drawer.position.z = -2.03 - u * 0.32; });
      await game.talk([
        ['kai', '"Helix Temporal Survey, March 2031. Property: Hensel and Son. Anomaly: local recurrence, twenty seconds, stable."'],
        ['kai', '"Recommendation: preserve. Do not demolish. Do not interview the occupant. Ask Hensel only if the child returns."'],
        ['kai', 'Signed, E. Rook. And countersigned underneath… K. Varen. In 2031 I was twelve years old.'],
      ]);
      F.m6survey = true; audio.sfxPlay('pickup');
      ui.addEvidence('Helix survey, March 2031', 'Locked in Hensel\'s workshop drawer: a Helix survey of the house, "local recurrence, twenty seconds, stable". Preserve, do not interview the occupant. Signed E. Rook, countersigned K. Varen, when Kai was twelve.', 'THE NINTH MINUTE · EVIDENCE');
      cine(false);
    } });
    shard(null, [-6.9, 1.6, -8.6], 'Temporal shard: the arm\'s reach', 'A shard of crystallised time on a lathe bed, inside the sweep of the great arm. It hums at twenty-second intervals.');

    // =====================================================================================
    // STUDY · 2026 routine: young Oskar unlatches the stair gate with the mantel clock, then thinks better of it
    // =====================================================================================
    const inStudy = () => pl.pos.z < -29.6 && pl.pos.y < 3 && pl.pos.x < 6.2 && pl.pos.z > -41.2;
    const sLoop = new LocalLoop(game, { id: 'm6-study26', label: 'STUDY · 2026 · A ROUTINE', duration: 20, region: () => inStudy() && T.current === '2026', maxKnown: 2 });
    const gate26 = { open: 0, target: 0 };
    const routine = [
      { t: 0, pos: [2.4, 0, -37.4], ry: Math.PI }, { t: 2.6, pos: [2.4, 0, -37.4], ry: Math.PI },
      { t: 6.0, pos: [-5.8, 0, -35.5], ry: -Math.PI / 2, pose: 'work' }, { t: 7.6, pos: [-5.8, 0, -35.5], ry: -Math.PI / 2 },
      { t: 10.8, pos: [5.3, 0, -34.5], ry: Math.PI / 2 }, { t: 12.6, pos: [5.3, 0, -34.5], ry: Math.PI / 2 },
      { t: 15.4, pos: [-5.8, 0, -35.5], ry: -Math.PI / 2, pose: 'work' }, { t: 16.2, pos: [-5.8, 0, -35.5], ry: -Math.PI / 2 },
      { t: 19.6, pos: [2.4, 0, -37.4], ry: Math.PI },
    ];
    for (let i = 0; i < routine.length; i++) { const a = routine[i], b = routine[(i + 1) % routine.length]; if (Math.abs(a.pos[0] - b.pos[0]) + Math.abs(a.pos[2] - b.pos[2]) < 0.05) a.hold = true; }
    loopRoutine(sLoop, oskar26, routine);
    const watching26 = () => inStudy() && T.current === '2026';
    sLoop.at(6.8, () => { W.mantel['2026'].userData.set(9, 0); if (watching26()) audio.sfxPlay('clock'); });
    sLoop.at(7.2, () => { gate26.target = 1; if (watching26()) audio.sfxPlay('door'); }, { learn: ['mantelIX', '0:07  Mantel clock set to IX → the stair gate unlatches'], when: watching26 });
    sLoop.at(12.0, () => { gate26.target = 0; if (watching26()) audio.sfxPlay('metal'); }, { learn: ['closes', '0:12  He looks up the stairs, then shuts the gate'], when: watching26 });
    sLoop.at(15.8, () => { W.mantel['2026'].userData.set(4, 0); });
    sLoop.at(11.4, () => { if (watching26() && !talking26) ui.subtitle('oskar26', ['Not yet. He said not yet.', 'Not until the clock is ready.', 'Tomorrow, perhaps. He always says tomorrow.'][sLoop.iteration % 3], 2600); });
    game.onUpdate(dt => { gate26.open += (gate26.target - gate26.open) * Math.min(1, dt * 3); W.ironGate.rotation.y = gate26.open * 0.75; W.ironGateCol.enabled = true; });
    let talking26 = false;
    window.__m6 = { loop, sLoop, state, arm, W, zoneOf };
    oskar26.lookTarget = null;

    // =====================================================================================
    // SCRIPT
    // =====================================================================================
    ui.missionTag('MISSION 6 · THE CLOCKMAKER\'S HOUSE'); ui.show('hud', true);
    T.unlocked = false; T.refreshHud();
    const kai = pl.char;
    pl.place(...P.streetStart, Math.PI); game.checkpoint(...P.streetStart, Math.PI);
    applyRig(true); lockMusic(null); audio.setTheme(null);
    audio.rain(0.55);
    cine(true);
    game.engine.camera.position.set(0, 17, 47);
    await game.shot([0, 17, 47], [0, 12, -10], 0.01, { fov: 50 });
    await ui.fade(0, 2400);
    audio.setTheme('m6-house', 2);
    const cc = ui.chapterCard('ACT I · THE WORLD THAT REMEMBERS', 'The Clockmaker\'s House', 'Rain City · the old clock quarter · 2049', 4200);
    await game.shot([0.6, 7.2, 31], [-0.4, 14.2, -28], 6.5, { fov: 44 });
    await cc;
    await game.shot([-2.0, 2.0, 41.5], [0, 1.6, 37.6], 2.2, { fov: 40 });
    kai.lookTarget = new THREE.Vector3(-0.4, 15, -28.8);
    await game.talk([
      ['kai', 'Every Helix site survey from 2031 has the same pencil note in the margin. "Ask Hensel."'],
      ['kai', 'Hensel fixes clocks. And every clock in this city stopped at eight-fourteen.'],
    ]);
    kai.lookTarget = null;
    ui.addEvidence('"Ask Hensel"', 'Every Helix site survey from 2031 carries the same pencilled note in the margin. Hensel is a clockmaker in Rain City\'s old quarter. His tower clock still reads 8:14.', 'CLOCK QUARTER · 2049');
    cine(false);
    game.objective('Find Hensel\'s clock shop at the end of the lane');
    // street barks + optional anomaly
    game.onUpdate(() => {
      if (zone !== 'street') return;
      if (near(-3.9, 22, 4.2) && once('neighbor')) { neighbor.c.lookTarget = kai.head; ui.subtitle('neighbor', 'Old Hensel? He hasn\'t opened that door in twenty-three years. His clocks still sell themselves.', 4600); }
      if (pl.pos.z < 12 && once('court')) ui.subtitle('kai', 'The shop window is full of clocks. All of them running.', 3000);
    });
    game.interact({ pos: [-2.4, 1.8, 10.6], radius: 2.4, prompt: 'Look up at the bracket clock', onUse: async () => {
      cine(true);
      await game.shot([-1.6, 4.8, 12.4], [-2.4, 5.9, 10.0], 1.4, { fov: 30 });
      await game.say('kai', 'Eight-fourteen. Stopped since the Zero Second — like the station, like my phone. But the shop window\'s clocks are all running.');
      cine(false);
    } });
    let knocked = false;
    game.interact({ pos: [0, 1.2, 9.2], radius: 2.2, prompt: 'Knock on the door', onUse: () => { knocked = true; } });
    hint(() => !knocked && pl.pos.z > 20, 70, () => ui.subtitle('kai', 'The house at the end of the lane. The one with the tower.', 3000));
    await game.waitFor(() => knocked);

    // ---------- the clockmaker opens before Kai knocks ----------
    cine(true);
    pl.place(0, 0, 10.0, Math.PI);
    await game.shot([2.6, 1.8, 12.6], [0, 1.5, 8.4], 1.2, { fov: 42 });
    audio.sfxPlay('door'); oskar.root.visible = true; oskar.root.position.set(0.1, 0, 7.3); oskar.root.rotation.y = 0;
    await tween(1.1, u => { W.door.rotation.y = u * 1.7; });
    W.doorCol.enabled = false;
    oskar.lookTarget = kai.head; kai.lookTarget = oskar.head;
    await tween(0.8, u => { oskar.root.position.z = 7.3 + u * 0.6; oskar.speed = u < 1 ? 0.9 : 0; }); oskar.speed = 0;
    await game.shot([1.5, 1.75, 11.3], [0.1, 1.62, 7.9], 1.0, { fov: 36 });
    await game.talk([
      ['oskar', 'You\'re late.'],
      ['kai', 'I didn\'t say I was coming.'],
      ['oskar', 'You said it in 2026. Sat on my counter and told me the very minute. Then you told me not to let you in.'],
      ['kai', 'In 2026 I was seven years old.'],
      ['oskar', 'Not the first time you came.'],
    ]);
    if (F.trustedHale === true) await game.talk([['oskar', 'A Helix guard came asking after you this morning. A big man, Hale. Polite. I told him clocks don\'t keep visitors.']]);
    else if (F.trustedHale === false) await game.talk([['oskar', 'Helix sent a man called Brandt. He put his fist through my door when it didn\'t open fast enough.'], ['kai', 'Brandt works for Rook.'], ['oskar', 'Then Rook is in a hurry. Hurry is a poor way to arrive anywhere.']]);
    await game.say('oskar', 'Come in. Before the rain remembers you.');
    await ui.fade(1, 600);
    pl.place(0.4, 0, 5.6, Math.PI); oskar.root.position.set(-1.6, 0, 3.7); oskar.root.rotation.y = 0.7;
    W.door.rotation.y = 0; W.doorCol.enabled = true;
    applyRig(true);
    await game.shot([3.4, 2.2, 6.6], [6.6, 1.9, 2.8], 0.01, { fov: 48 });
    await ui.fade(0, 700);
    await game.shot([4.6, 2.0, 4.4], [7.0, 2.1, 2.4], 3.2, { fov: 38 });
    await game.talk([
      ['kai', 'They\'re racing. And every one of them skips a minute — eight past, then nine past, nothing in between.'],
      ['oskar', 'Only the ones I love. The ninth minute does not come into my house.'],
    ]);
    await game.shot([1.6, 1.7, 6.6], [-1.4, 1.62, 3.9], 1.4, { fov: 40 });
    await game.talk([
      ['kai', 'Mr. Hensel. What time is it? Really.'],
      ['oskar', 'You ask what time it is. Wrong question.'],
      ['kai', 'What\'s the right one?'],
      ['oskar', 'Which version of the question are you asking?'],
      ['oskar', 'This house has three of them. The one that was, the one that is, the one that will be. He said your wrist could read all three.'],
      ['kai', 'Who said?'],
      ['oskar', 'The man who left something for you in the tower. The way up is through my workshop. It repeats itself — watch it once before you cross.'],
    ]);
    ui.addEvidence('Clocks that skip a minute', 'Every clock in Hensel\'s 2049 shop races, and every one jumps from eight minutes past to nine past. "The ninth minute does not come into my house."', 'HENSEL & SON · 2049');
    T.unlocked = true; T.stability = 1; T.refreshHud();
    kai.wristBoost = 10; audio.sfxPlay('switch');
    state.workOpen = true; audio.sfxPlay('door');
    W.workDoorCol.enabled = false;
    const blockOther = game.collision.add([-0.85, 0, -1.2], [0.85, 2.45, -0.8], { states: ['2026', '2196'] });
    void blockOther;
    tween(1.0, u => { if (T.current === '2049') W.workDoor.position.x = -1.62 * u; });
    oskar.lookTarget = null; kai.lookTarget = null;
    cine(false);
    ui.toast('THIS HOUSE HAS THREE STATES\n1 · 2026      2 · 2049      3 · 2196      (Q cycles)', 6000);
    game.objective('Go through to the workshop · optional: see the shop in its other states');
    game.checkpoint(0.4, 0, 5.6, Math.PI);

    // ---------- optional: the shop in 2026 and 2196 ----------
    let lotteTalked = false;
    lotte.lookTarget = kai.head;
    game.interact({ pos: [-4.05, 1.1, 3.0], radius: 2.2, once: false, states: ['2026'], prompt: 'Talk to the girl at the counter', onUse: async () => {
      if (T.current !== '2026') return;
      cine(true); lotte.lookTarget = kai.head; kai.lookTarget = lotte.head;
      await game.shot([pl.pos.x + 1.2, 1.5, pl.pos.z + 1.4], [-4.05, 1.0, 3.0], 1.0, { fov: 40 });
      await game.talk([
        ['lotte', 'Papa\'s in the back. He\'s building a clock that never gets to the end.'],
        ['kai', 'Why would anyone want a clock like that?'],
        ['lotte', 'He says if it never gets to the end, nobody has to say goodbye.'],
        ['lotte', 'You look like the man with the sad coat. Are you his son?'],
        ['kai', '…Something like that.'],
      ]);
      if (!state.lieQuest && !F.m6boyWatch) {
        await game.talk([
          ['lotte', 'Papa says one of the clocks on the glass case is lying.'],
          ['lotte', 'It tells a time that hasn\'t happened yet. Whoever finds it can keep what\'s inside. I never can.'],
        ]);
        state.lieQuest = true;
        ui.toast('OPTIONAL · THE LYING CLOCK\nFive carriage clocks on the 2026 display case', 5200);
      }
      kai.lookTarget = null; cine(false);
      if (!lotteTalked) { lotteTalked = true; state.debt++; F.m6debtLotte = true; ui.addEvidence('Lotte, eight years old', '2026: the clockmaker\'s daughter does her homework on the counter. "If it never gets to the end, nobody has to say goodbye." She remembers a man in a sad coat.', 'THE CLOCKMAKER\'S DEBT · 1'); }
    } });
    game.interact({ pos: [-5.15, 1.2, 3.7], radius: 1.8, once: false, states: ['2026'], enabled: () => !F.varenLedger, prompt: 'Read the open ledger', onUse: async () => {
      if (T.current !== '2026' || F.varenLedger) return;
      await game.talk([
        ['kai', '"Fourteenth of June, 2026. Varen, two children. Boy\'s watch, stopped at eight-fourteen. No charge — the girl paid with a drawing."'],
        ['kai', 'My watch. I lost it that summer. And the drawing… Mira drew the machine.'],
        ['kai', 'And underneath, the same evening: "He came again. Same face."'],
      ]);
      F.varenLedger = true;
      ui.addEvidence('Hensel\'s ledger, June 2026', 'Varen, two children: a boy\'s watch stopped at 8:14 — in 2026, twenty-three years before the Zero Second. The girl paid with a drawing. That evening: "He came again. Same face."', 'HENSEL & SON · 2026');
      if (!game.residueOn) ui.toast('Residue Vision [F] shows what a room remembers', 4200);
    } });
    // optional: the lying clock (2026). Four carriage clocks tell the truth in their way; one shows 8:14, a minute
    // that, in 2026, has not happened yet. Inside it: the boy's watch from the ledger.
    const ORD = ['first', 'second', 'third', 'fourth', 'fifth'];
    const LIE_BARK = [
      'Three o\'clock. Same as the sun outside. Honest.',
      'Eight minutes slow. Late isn\'t lying.',
      'Stopped at twenty to twelve. It isn\'t lying. It\'s asleep.',
      null,
      'Running backwards. A joke clock. Still the truth, just in a mirror.',
    ];
    game.onUpdate((dt, t) => { const c = W.carriage[4]; if (T.current === '2026' && zone === 'shop') { const m = 180 - (t * 3) % 720; c.face.userData.set(Math.floor(m / 60), m % 60); } });
    W.carriage.forEach((c, i) => game.interact({ pos: c.pos, radius: 0.85, once: false, states: ['2026'], enabled: () => (state.lieQuest || F.varenLedger) && !F.m6boyWatch, prompt: `Open the ${ORD[i]} carriage clock`, onUse: async () => {
      if (T.current !== '2026' || F.m6boyWatch) return;
      cine(true);
      await game.shot(c.cam, c.look, 0.9, { fov: 30 });
      if (i !== 3) {
        await game.wait(0.6); await game.say('kai', LIE_BARK[i]);
        cine(false); return;
      }
      await game.say('kai', 'Eight-fourteen. In 2026 that minute hasn\'t happened yet. Not for twenty-three years.');
      audio.sfxPlay('door'); await tween(0.6, u => { c.door.rotation.y = u * 1.8; c.door.position.x = -u * 0.12; });
      W.boyWatch.visible = true; audio.sfxPlay('anomaly');
      tween(1.2, u => { W.boyWatch.position.y = 1.5 + u * 0.12; W.boyWatch.rotation.y = 0.4 + u * 1.2; });
      await game.talk([
        ['kai', 'And inside… a child\'s watch. Blue strap. A K scratched into the back.'],
        ['kai', 'Mine. The watch in the ledger. I lost it the summer we came here. It stopped at eight-fourteen before anything had happened.'],
      ]);
      if (state.lieQuest) await game.talk([['lotte', 'Papa said a man would come for it one day. He said you\'d know the time.']]);
      F.m6boyWatch = true; W.boyWatch.visible = false; audio.sfxPlay('pickup');
      ui.addEvidence('The boy\'s watch, 2026', 'Hidden in the carriage clock that "tells a time that hasn\'t happened yet": Kai\'s childhood watch, stopped at 8:14 in 2026, twenty-three years before the Zero Second.', 'THE LYING CLOCK · 2026');
      cine(false);
    } }));
    shard('2196', [-3.2, 0.5, 6.9], 'Temporal shard: the fallen shop', 'In 2196 the shop\'s ceiling has fallen in. A shard of crystallised time rests where the girl used to sit — still warm.');
    game.onUpdate(() => {
      if (zone !== 'shop' || !game.control) return;
      if (T.current === '2026' && once('shop26')) ui.subtitle('kai', 'Sunlight. Twenty-three years ago. And the clocks keep honest time.', 3400);
      if (T.current === '2196' && once('shop96')) ui.subtitle('kai', '2196. The roof came in. One clock is still on the wall — stopped at nine.', 3400);
    });

    // ---------- the workshop ----------
    await game.waitFor(() => inWorkshop() && T.current === '2049');
    cine(true);
    pl.place(0, 0.36, -2.0, Math.PI);
    await game.shot([0, 5.2, -1.8], [0, 0.8, -13], 2.4, { fov: 56 });
    await game.shot([5.6, 2.2, -7.5], [0, 1, -12], 3.0, { fov: 48, follow: null });
    await game.say('kai', 'A local loop. The whole room is repeating itself.');
    await game.shot([-1.2, 1.2, -18.0], [0, 1.6, -22], 2.0, { fov: 44 });
    await game.talk([
      ['oskar', 'Twenty seconds. Over and over, since the night he left.'],
      ['oskar', 'The room repeats. You don\'t. Watch it once — it never changes. That is its only kindness.'],
    ]);
    await game.shot([0.8, 2.0, -1.6], [0, 1.2, -9], 1.4, { fov: 52 });
    cine(false);
    loop.hudWanted = true;
    ui.toast('LOCAL LOOP\nThe ring shows where you are in the loop. What you learn stays on it.', 6000);
    game.objective('Observe one full loop: the arm, the hammers, the gate');
    game.checkpoint(0, 0.36, -2.4, Math.PI);
    const obsStart = loop.iteration;
    await game.waitFor(() => loop.iteration >= obsStart + 1 && loop.t > 0.5 || (loop.knows('arm1') && loop.knows('arm2') && loop.knows('gate') && loop.knows('hammers')) || pl.pos.z < -29.6);
    state.observed = true;
    game.objective('Cross the workshop to the escapement gate');
    hint(() => inWorkshop() && !state.crossed && pl.pos.z > -4, 50, () => ui.subtitle('kai', 'When the arm has passed the near side, the right-hand side is clear until 0:12.', 3800));
    hint(() => inWorkshop() && !state.crossed && pl.pos.z < -18.6 && pl.pos.z > -25, 45, () => ui.subtitle('kai', 'Follow the wave. Wait on the yellow until the hammer ahead lifts.', 3600));
    hint(() => inWorkshop() && !state.crossed && pl.pos.z < -25.2, 40, () => ui.subtitle('kai', 'The gate opens at nine seconds. Be standing in front of it.', 3400));
    await game.waitFor(() => pl.pos.z < -29.7);
    state.crossed = true; T.locked = false;

    // ---------- the study ----------
    cine(true);
    oskar.root.position.set(-4.3, 0, -33.4); oskar.root.rotation.y = 2.4; oskar.lookTarget = kai.head;
    await game.shot([3.6, 2.4, -31.2], [-3.4, 1.4, -34.4], 1.6, { fov: 46 });
    const tries = loop.resets;
    await game.talk([
      ['oskar', tries === 0 ? 'First try. He said you would be good at it. I hated him a little for that.' : `${tries + 1} tries. I needed four hundred, the first year.`],
      ['kai', 'How did you get in here before me?'],
      ['oskar', 'I have a key to my own house, Mr. Varen. You\'re the one who has to earn it.'],
      ['oskar', 'The stairs to the tower are where they always were. I hid them for him. Find them yourself — I promised.'],
    ]);
    ui.addEvidence('A loop that keeps the room', 'Hensel\'s workshop repeats the same twenty seconds — arm, hammers, gate — and has for twenty-three years. It puts objects back. It cannot take back what you have learned.', 'THE WORKSHOP');
    F.m6loopResets = tries;
    oskar.lookTarget = null; cine(false);
    game.checkpoint(0, 0, -30.6, Math.PI);
    game.objective('Find the hidden way up: compare the study across its three states');
    // compare the room
    const knowsIX = () => sLoop.knows('mantelIX') || state.seen.ledgerIX;
    game.interact({ pos: [5.6, 1.2, -34.5], radius: 2.0, once: false, states: ['2049'], enabled: () => !state.bookcase, prompt: 'Examine the bookcase', onUse: () => {
      if (T.current !== '2049') return;
      if (once('bookcase')) { ui.subtitle('kai', 'The floor is scratched in a quarter circle in front of it. This bookcase swings.', 3600); W.scratch.material.opacity = 1; }
      else ui.subtitle('kai', state.seen.arch ? 'In 2026 this was an archway with a gate. Something opened that gate.' : 'It swings — but from where?', 3000);
    } });
    game.interact({ pos: [5.6, 1.2, -34.5], radius: 2.0, once: false, states: ['2026'], prompt: 'Examine the iron gate', onUse: () => {
      if (T.current !== '2026') return;
      state.seen.arch = true; ui.subtitle('kai', 'An archway, a stair going up — and in 2049 a bookcase stands right here. The gate is latched from somewhere else.', 4200);
    } });
    game.interact({ pos: [5.2, 1.0, -34.5], radius: 2.4, once: false, states: ['2196'], prompt: 'Look through the collapsed wall', onUse: () => {
      if (T.current !== '2196') return;
      state.seen.ruinStair = true; ui.subtitle('kai', 'The wall is gone. Behind it, a stairwell — the bottom steps have fallen. In 2049, it\'s behind the bookcase.', 4200);
    } });
    game.interact({ pos: [-5.9, 1.6, -35.5], radius: 1.8, once: false, states: ['2049'], enabled: () => !state.bookcase, prompt: 'Set the mantel clock', onUse: async () => {
      if (T.current !== '2049') return;
      const i = await game.choice('kai', knowsIX() ? 'In 2026 he set it to nine. Set the hands to…' : 'A mantel clock, hands loose on the arbor. Set them to…', [...HOURS, 'Leave it']);
      if (i >= HOURS.length) return;
      const hv = HOUR_VAL[HOURS[i]]; W.mantel['2049'].userData.set(hv, 0); audio.sfxPlay('clock');
      if (hv !== 9) { audio.sfxPlay('fail'); ui.subtitle('kai', 'Nothing. Not that hour.', 2000); return; }
      await openBookcase();
    } });
    game.interact({ pos: [2.6, 1.2, -38.4], radius: 1.8, once: false, states: ['2049'], enabled: () => !F.m6debtLetters, prompt: 'Read the letters on the desk', onUse: async () => {
      if (T.current !== '2049' || F.m6debtLetters) return;
      await game.talk([
        ['kai', 'Letters. Dozens, all stamped "returned unopened". All from Lotte.'],
        ['kai', '"Papa, Ana turned five today. She asks why Grandpa lives inside a clock. Will you ever come out?"'],
      ]);
      state.debt++; F.m6debtLetters = true;
      ui.addEvidence('Letters, returned unopened', '2031 to 2048: letters from Lotte Hensel to her father, every one refused at the door. Oskar has a granddaughter he has never met.', 'THE CLOCKMAKER\'S DEBT · 2');
    } });
    game.interact({ pos: [P.plaque[0], 1.0, P.plaque[2] + 0.6], radius: 2.0, once: false, states: ['2196'], enabled: () => !F.m6debtPlaque, prompt: 'Read the plaque under the tree', onUse: async () => {
      if (T.current !== '2196' || F.m6debtPlaque) return;
      await game.talk([['kai', '"Lotte Hensel. 2018 to 2101. Who waited for the clock to stop."'], ['kai', 'She lived to eighty-three. Long enough to plant a tree in her father\'s ruin.']]);
      state.debt++; F.m6debtPlaque = true;
      ui.addEvidence('A plaque in the garden, 2196', '"Lotte Hensel, 2018–2101, who waited for the clock to stop." In the house\'s last state, a tree grows through the study wall over her name.', 'THE CLOCKMAKER\'S DEBT · 3');
    } });
    // young Oskar (2026): the man who remembers a visit Kai is making right now
    const o26pos = new THREE.Vector3();
    game.onUpdate(() => o26pos.copy(oskar26.root.position).setY(1.2));
    game.interact({ pos: o26pos, radius: 2.2, once: false, states: ['2026'], prompt: 'Talk to the clockmaker (2026)', onUse: async () => {
      if (T.current !== '2026') return;
      talking26 = true; sLoop.paused = true; oskar26.speed = 0; oskar26.lookTarget = kai.head; kai.lookTarget = oskar26.head;
      cine(true);
      const o = oskar26.root.position;
      await game.shot([pl.pos.x + (o.x - pl.pos.x) * 0.5 + 1.4, 1.75, pl.pos.z + (o.z - pl.pos.z) * 0.5 + 1.2], [o.x, 1.6, o.z], 1.0, { fov: 40 });
      if (once('o26')) {
        await game.talk([
          ['oskar26', 'You again. You said you would come back looking younger. I didn\'t believe you.'],
          ['kai', 'I need to get up to the tower.'],
          ['oskar26', 'You told me — you, older — never to let you up there. Not until the clock is ready.'],
          ['kai', 'When will it be ready?'],
          ['oskar26', 'Ask the old man I\'ll become. He\'ll have had the time.'],
        ]);
        F.metYoungHensel = true;
        ui.addEvidence('Hensel, 2026', 'In 2026 the clockmaker recognises Kai — "You said you would come back looking younger." Kai\'s visit now is the visit old Hensel remembers. The older visitor told him to keep the tower closed.', 'STUDY · 2026');
      } else await game.say('oskar26', knowsIX() ? 'You watched me. You know which hour. Don\'t make me watch you do it.' : 'He said not yet. I keep my promises, even the ones I don\'t understand.');
      cine(false); kai.lookTarget = null; oskar26.lookTarget = null; sLoop.paused = false; talking26 = false;
    } });
    // study barks + stall hints
    game.onUpdate(() => {
      if (zone !== 'study' && !(pl.pos.z < -41.2)) return;
      if (!game.control) return;
      if (T.current === '2026' && inStudy() && once('study26')) ui.subtitle('kai', 'Afternoon. And him — younger. He\'s walking the same path again and again.', 3800);
      if (T.current === '2196' && once('study96')) ui.subtitle('kai', 'The tower came down through the ceiling. There\'s a garden where the wall was.', 3600);
    });
    hint(() => zone === 'study' && !state.bookcase && T.current === '2049' && !state.seen.study26, 60, () => ui.subtitle('kai', 'This room was different in 2026. Maybe the way up was too.', 3400));
    hint(() => zone === 'study' && !state.bookcase && sLoop.knows('mantelIX'), 50, () => ui.subtitle('kai', 'He set the mantel clock to nine and the gate unlatched. The same clock is here in 2049.', 3800));
    game.onUpdate(() => { if (T.current === '2026' && inStudy()) state.seen.study26 = true; });

    async function openBookcase() {
      state.bookcase = true;
      cine(true);
      await game.shot([1.2, 1.9, -31.0], [6.0, 1.4, -34.6], 1.2, { fov: 44 });
      audio.sfxPlay('door'); game.shake = 0.05;
      await tween(2.2, u => { W.bookcase.rotation.y = u * Math.PI / 2 * 0.92; });
      game.shake = 0;
      W.bookcaseCol.enabled = false; if (W.archBlock) W.archBlock.enabled = false;
      game.collision.add([1.9, 0, -32.45], [6.1, 3.3, -31.95], { states: ['2049'] });
      audio.sfxPlay('success');
      await game.shot([3.4, 1.6, -33.0], [8.2, 2.4, -38], 1.6, { fov: 50 });
      oskar.lookTarget = kai.head;
      await game.talk([
        ['oskar', 'Nine. Of course it was nine. I set that clock myself and still couldn\'t have told you.'],
        ['kai', 'You watched yourself do it, in 2026. Every twenty seconds.'],
        ['oskar', 'Then I was more honest at fifty-five than I am now. Go on up.'],
      ]);
      oskar.lookTarget = null;
      ui.addEvidence('The stair behind the bookcase', 'Compared across three states: an archway with a gate in 2026, a bookcase in 2049, a broken stairwell in 2196. The mantel clock at IX releases the old latch.', 'STUDY');
      cine(false);
      game.objective('Climb to the clock tower');
    }
    await game.waitFor(() => state.bookcase);

    // optional: the Clockmaker's Debt — ask once Kai knows enough (two of three pieces)
    game.interact({ pos: [-4.3, 1.3, -33.4], radius: 2.4, once: false, states: ['2049'], enabled: () => state.debt >= 2 && !state.debtTalked && !state.ended, prompt: 'Ask Oskar about Lotte', onUse: async () => {
      if (T.current !== '2049') return;
      state.debtTalked = true;
      cine(true); oskar.lookTarget = kai.head; kai.lookTarget = oskar.head; lockMusic('memory');
      await game.shot([-1.6, 1.7, -32.2], [-4.3, 1.4, -33.4], 1.2, { fov: 40 });
      await game.talk([
        ['kai', 'Your daughter. Lotte. The letters on your desk — you never opened one.'],
        ['oskar', 'If I open the door to the post, the loop slips. He said the house needs a keeper until the child returns.'],
        ['kai', 'So you stayed. Twenty-three years.'],
        ['oskar', 'She was eight when he came. She\'s thirty-one now, somewhere out there. I have a granddaughter I have only met in handwriting.'],
        ['oskar', 'That is the debt, Mr. Varen. Not money. Years.'],
      ]);
      const opts = F.m6debtPlaque ? ['Tell him Lotte lives a long life (the plaque in 2196)', 'Say nothing. It isn\'t yours to tell.'] : ['Tell him to open the letters when this is over', 'Say nothing. It isn\'t yours to tell.'];
      const pick = await game.choice('kai', 'He kept a promise to someone with my face. What do I owe him?', opts);
      if (pick === 0 && F.m6debtPlaque) {
        await game.talk([['kai', 'In a later version of this house there\'s a plaque in the garden. Lotte Hensel, 2018 to 2101. She lives a long life.'], ['oskar', '…Eighty-three years.'], ['oskar', '"Who waited for the clock to stop." Then I had better stop it.']]);
        F.clockmakerDebt = 'told';
      } else if (pick === 0) {
        await game.talk([['kai', 'When this is over, open the door. Read the letters. All of them.'], ['oskar', 'When this is over. Yes. That is what he said, too.']]);
        F.clockmakerDebt = 'urged';
      } else {
        await game.talk([['kai', '…'], ['oskar', 'You have his silence as well as his face. Never mind. I know what I paid.']]);
        F.clockmakerDebt = 'kept';
      }
      await game.say('oskar', 'Take this. A keeper\'s watch. It never skips a minute — which is why I could never wear it in here.');
      F.keepersWatch = true; audio.sfxPlay('pickup');
      ui.addEvidence('The Clockmaker\'s Debt', 'Oskar Hensel built a clock that cannot finish for a man with Kai\'s face, and paid for it with twenty-three years of his daughter\'s life. He gave Kai his keeper\'s watch — the only clock in the house that keeps the ninth minute.', 'OPTIONAL · THE CLOCKMAKER\'S DEBT');
      kai.lookTarget = null; oskar.lookTarget = null; lockMusic(null); cine(false);
    } });
    game.onUpdate(() => { if (state.debt >= 2 && !state.debtTalked && once('debtHint')) ui.toast('OPTIONAL · THE CLOCKMAKER\'S DEBT\nAsk Oskar about Lotte (study, 2049)', 5200); });

    // ---------- the tower ----------
    await game.waitFor(() => pl.pos.y > TY - 0.3 && pl.pos.z < -29.6);
    cine(true);
    state.tower = true;
    await game.shot([5.6, TY + 2.4, -31.6], [-0.5, TY + 5, -35], 2.2, { fov: 52 });
    await game.shot([3.2, TY + 1.4, -33.6], [-0.4, 15, -29.6], 2.6, { fov: 48 });
    await game.say('kai', 'The tower clock. From in here the numbers run backwards. Stopped at eight-fourteen, like the rest of the city.');
    await game.shot([1.4, TY + 1.4, -34.0], [-0.1, TY + 0.9, -35], 1.6, { fov: 38 });
    await game.talk([
      ['kai', '"Each age keeps its own hour." Three collars on one shaft — one low, one in the middle, one near the top.'],
      ['kai', 'And a service dial that reads… eight-fourteen. Here, now.'],
    ]);
    cine(false);
    game.checkpoint(...P.stairTop, -Math.PI / 2);
    const collarObjective = () => game.objective(`Set the three collars · each age keeps its own hour (${towerState.set}/3)`);
    collarObjective();
    const ANSWER = [8, 3, 9], CERA = ['2049', '2026', '2196'], CNAME = ['lower', 'middle', 'upper'];
    const setCollar = async (i) => {
      if (T.current !== CERA[i]) { ui.subtitle('kai', 'I can\'t reach it from here — not in this state.', 2200); return; }
      const c = W.collars[i];
      const pick = await game.choice('kai', `The ${CNAME[i]} collar. Turn it to…`, HOURS);
      const hv = HOUR_VAL[HOURS[pick]];
      const was = c.value === ANSWER[i];
      c.value = hv; audio.sfxPlay('clock'); await tween(0.5, u => { c.pv.rotation.y = -((c.prevV ?? 0) + ((hv / 12) * Math.PI * 2 - (c.prevV ?? 0)) * u); }); c.prevV = (hv / 12) * Math.PI * 2;
      const ok = hv === ANSWER[i];
      c.lamp.material.emissiveIntensity = ok ? 5 : 0.2;
      towerState.set = W.collars.filter((cc, k) => cc.value === ANSWER[k]).length;
      if (ok && !was) { audio.sfxPlay('success'); ui.subtitle('kai', ['Eight. The present stopped at eight-fourteen.', 'Three. In 2026 this tower was striking three.', 'Nine. Whatever happens to this house, it stops at nine.'][i], 3000); }
      else if (!ok) audio.sfxPlay('fail');
      collarObjective();
    };
    W.collars.forEach((c, i) => { c.pv.rotation.y = -((c.value / 12) * Math.PI * 2); c.prevV = (c.value / 12) * Math.PI * 2; });
    game.interact({ pos: [P.shaft[0] + 0.6, P.lowCollar, P.shaft[1]], radius: 1.9, once: false, states: ['2049'], prompt: 'Turn the lower collar', onUse: () => setCollar(0) });
    game.interact({ pos: [P.shaft[0] + 0.7, P.midCollar, P.shaft[1]], radius: 1.8, once: false, states: ['2026'], prompt: 'Turn the middle collar', onUse: () => setCollar(1) });
    game.interact({ pos: [P.shaft[0] - 0.75, P.highCollar, P.shaft[1]], radius: 1.8, once: false, states: ['2196'], prompt: 'Turn the upper collar', onUse: () => setCollar(2) });
    shard('2026', [1.9, P.scaffoldTop + 0.5, -34.0], 'Temporal shard: the scaffold', 'On Hensel\'s 2026 scaffold, beside the middle collar, a shard of crystallised time. Below it, chalk on a plank: "for K.V. — not yet".');
    game.onUpdate(() => {
      if (zone !== 'tower' || !game.control) return;
      if (T.current === '2026' && once('tower26')) ui.subtitle('kai', 'Three o\'clock in 2026 — the dial is running. And he left scaffolding up to the middle collar.', 4000);
      if (T.current === '2196' && once('tower96')) ui.subtitle('kai', 'No roof. The hands have rusted at nine. That beam climbs all the way up to the top collar.', 4000);
    });
    hint(() => zone === 'tower' && towerState.set === 0, 70, () => ui.subtitle('kai', 'The service dial reads a different hour in every state. Each collar answers to its own age.', 3800));
    hint(() => zone === 'tower' && towerState.set > 0 && towerState.set < 3, 90, () => ui.subtitle('kai', 'Lower collar in 2049, middle from the 2026 scaffold, upper from the 2196 beam.', 3800));
    await game.waitFor(() => towerState.set >= 3 && !game.ui.dlgActive);

    // ---------- the mechanism engages: the house lets go ----------
    state.ended = true;
    cine(true); lockMusic(null); audio.setTheme(null, 0.4);
    await game.shot([3.6, TY + 3.4, -32.4], [-0.5, TY + 3, -35], 1.6, { fov: 50 });
    audio.sfxPlay('switch'); kai.wristBoost = 12; game.shake = 0.12;
    for (const st of ['2026', '2196', '2049']) await T.switchTo(st, { force: true, free: true, dur: 520 });
    game.shake = 0;
    loop.stop(); loop.frozen = true; sLoop.stop();
    audio.sfxPlay('boom');
    await tween(2.0, u => { W.collars.forEach((c, i) => { c.g.rotation.y = u * Math.PI * (i % 2 ? -2 : 2); }); W.dialIn['2049'].userData.set(8, 14 * (1 - u)); W.dialOut['2049'].userData.set(8, 14 * (1 - u)); });
    W.shopClocks.update = () => {}; // every racing clock in the house stops at once
    audio.silence(1.0); await game.wait(1.0);
    audio.sfxPlay('door');
    await tween(1.0, u => { W.compDoor.position.z = P.shaft[1] - u * 0.62; });
    W.recorder.visible = true;
    await game.shot([P.shaft[0] + 1.6, TY + 1.3, P.shaft[1] + 0.9], [P.shaft[0] + 0.55, TY + 0.62, P.shaft[1]], 1.6, { fov: 34 });
    await game.say('kai', 'The workshop\'s gone quiet. The whole house just… let go. And there\'s something inside the shaft.');
    cine(false);
    game.objective('Play the recording');
    let played = false;
    game.interact({ pos: [P.shaft[0] + 0.8, TY + 1.0, P.shaft[1]], radius: 2.0, prompt: 'Play the recording', onUse: () => { played = true; } });
    await game.waitFor(() => played);

    // ---------- the recording ----------
    cine(true); lockMusic('m6-witness');
    pl.place(P.shaft[0] + 1.3, TY, P.shaft[1] + 0.2, -Math.PI / 2);
    kai.pose = 'work';
    await game.shot([P.shaft[0] + 2.6, TY + 1.6, P.shaft[1] + 1.4], [P.shaft[0] + 0.6, TY + 1.0, P.shaft[1]], 1.4, { fov: 36 });
    kai.pose = null; audio.sfxPlay('rewind');
    await game.wait(0.6);
    await game.talk([
      ['recording', 'Oskar. If this is playing, the escapement held, and he found it. Good.'],
      ['recording', 'He will ask what I asked you to build. Tell him the truth. A clock that cannot finish.'],
      ['recording', 'You kept your end. I am sorry about Lotte. I am sorry about all of it.'],
    ]);
    await game.shot([P.shaft[0] + 3.2, TY + 1.7, P.shaft[1] - 0.6], [P.shaft[0] + 1.2, TY + 1.6, P.shaft[1] + 0.2], 2.2, { fov: 30 });
    await game.say('recording', 'And Oskar — when the child returns, do not let him see the ninth minute.');
    audio.silence(1.6); await game.wait(1.6);
    oskar.root.position.set(5.7, TY, -34.3); oskar.root.rotation.y = -Math.PI / 2; oskar.lookTarget = kai.head; kai.lookTarget = oskar.head;
    await game.shot([2.6, TY + 1.6, -36.4], [5.6, TY + 1.6, -34.3], 1.4, { fov: 40 });
    await game.talk([
      ['kai', 'That\'s my voice.'],
      ['oskar', 'He had your face. Thirty years more of it. He wore a long coat in July.'],
      ['kai', 'The man on the catwalk…'],
      ['kai', 'What happens in the ninth minute?'],
      ['oskar', 'I never asked. I only kept it out of my house.'],
    ]);
    ui.addEvidence('A recording from 2026', 'Hidden in the tower escapement: a reel in Kai\'s own voice, decades older. "When the child returns, do not let him see the ninth minute." Hensel: "He had your face. Thirty years more of it."', 'THE TOWER');
    F.ninthMinute = true; F.m6recording = true; F.metHensel = true;
    // the great dial starts to move toward the ninth minute
    lockMusic(null); audio.setTheme(null, 0.3);
    await game.shot([1.0, TY + 2.2, -33.2], [-0.4, 15, -29.4], 1.6, { fov: 40 });
    for (let m = 0; m < 8; m++) { W.dialIn['2049'].userData.set(8, m); W.dialOut['2049'].userData.set(8, m); audio.sfxPlay('clock'); if (audio.ctx) audio.tick(audio.ctx.currentTime, 0.2, 1800, audio.sfx); await game.wait(0.55 - m * 0.03); }
    await tween(1.2, u => { W.dialIn['2049'].userData.set(8, 7 + u * 0.92); });
    audio.sfxPlay('heartbeat');
    oskar.root.position.set(P.shaft[0] + 1.0, TY, P.shaft[1] - 0.9); oskar.lookTarget = W.collars[0].g.position; oskar.pose = 'work';
    await game.shot([P.shaft[0] + 2.4, TY + 1.5, P.shaft[1] - 2.2], [P.shaft[0] + 0.6, TY + 1.3, P.shaft[1] - 0.6], 0.8, { fov: 38 });
    await game.say('oskar', F.clockmakerDebt === 'told' ? 'Not today. Not before I see her.' : 'Not today.');
    audio.sfxPlay('metal'); game.shake = 0.18; audio.silence(2.2);
    await game.wait(0.5); game.shake = 0;
    W.dialIn['2049'].userData.set(8, 7.95);
    await game.wait(1.2);
    await ui.fade(1, 2200);
    ui.subtitle('recording', '…do not let him see the ninth minute.', 3200);
    await game.wait(2.4);
    oskar.pose = null;
    game.releaseCam(); ui.letterbox(false); audio.allBeds(0); audio.setTheme(null);
    loop.dispose(); sLoop.dispose(); T.locked = false;
    F.m6done = true;
  },
};
