// MISSION 11 · THE INVERTED HOSPITAL (Act II) — a tense non-combat puzzle mission; introduces Inversion.
// Bible beats: follow sound that becomes quieter as Kai approaches · avoid hazards returning to original positions ·
// compare medical records to identify a missing patient · dismantle a reversing lock in the correct order.
// Quote: "Temporal discontinuity." Ending: Mira's file lists an age of 32, though the record predates the present by
// 23 years; her death date is blank.
// Halden General's East Wing has been caught in localized inversion since the Zero Second: some rooms run forward,
// others reverse. Kai learns to reverse one selected motion at a time (src/systems/inversion.js).
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { Walker } from '../world/props.js';
import { Rain, glowMat } from '../world/kit.js';
import { Inversion } from '../systems/inversion.js';
import { EchoStep } from '../systems/echostep.js';
import { KID_KAI } from '../world/env_m6.js';
import { buildHospital, registerM11Cast, registerM11Themes, musicState, P, SHARDS, TEX, PARAMEDIC, PARAMEDIC_M, EVACUEE, NURSE, TECH_GHOST, MOTHER_2026 } from '../world/env_m11.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export default {
  id: 'm11', act: 'ACT II · THE NINE-MINUTE WAR', title: 'The Inverted Hospital', sub: 'Some rooms run backward',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM11Cast(); registerM11Themes();
    const brandtRoute = F.trustedHale === false;
    const guardId = brandtRoute ? 'brandt' : (CAST.hale ? 'hale' : 'hguard');
    try {
      const need = ['raman', 'bell', 'mother', 'paramedic', guardId, 'mira'].filter(id => !ui.portraits[id] && CAST[id]?.look);
      if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]]))));
    } catch (err) { console.warn('m11 portraits', err); }

    const scene = game.newScene({ background: 0x080b10, fog: [0x10141a, 0.014], exposure: 1.05, bloom: 0.55, bloomThreshold: 0.86, envIntensity: 0.7, killY: -10, residue: true });
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    const Q = RZ.getQuality(), low = Q === 'low';
    game.onUpdate(dt => RZ.update(dt));
    await tick();
    const W = buildHospital(game, scene);
    game.onUpdate((dt, t) => W.update(dt, t));
    await tick();
    const rain = new Rain(low ? 2200 : 4200, 56); scene.add(rain.mesh);
    game.onUpdate(dt => { if (rain.mesh.visible) rain.update(dt, game.engine.camera); });

    // ---------- environment light ----------
    let night = null, interior = null, interiorWarm = null;
    try {
      night = RZ.skyEnvironment(renderer, scene, { preset: 'night-city', cover: 0.9, apply: false });
      interior = RZ.skyEnvironment(renderer, scene, { preset: 'interior', color: 0xeaf4ff, wall: 0x3a4448, window: 0x5a6a7a, apply: false });
      interiorWarm = RZ.skyEnvironment(renderer, scene, { preset: 'interior', color: 0xffe2c0, wall: 0x3a3028, window: 0x6a5a48, apply: false });
    } catch (err) { console.warn('m11 sky', err); }
    const hemi = new THREE.HemisphereLight(0xb8c8d0, 0x181a1c, 0.3); scene.add(hemi);
    const key = new THREE.SpotLight(0xf0f6ff, 60, 18, 0.95, 0.6, 1.5); key.castShadow = !low;
    key.shadow.mapSize.set(Q === 'high' ? 1024 : 512, Q === 'high' ? 1024 : 512); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; scene.add(key, key.target);
    const pts = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    const zoneOf = (p) => p.z > 14.2 ? 'out' : p.x < -14 ? 'chapel' : p.x < 14 && p.z > -2 ? 'lobby' : p.x < 46 && p.z > -2.6 ? 'corr' : p.x < 46 ? 'vault' : p.z > -14 ? 'ward' : 'rec';
    const ZONE = {
      out: { fog: [0x161b22, 0.012], env: 0.8, hemi: [0x8aa0b8, 0x101214, 0.4], exp: 1.08, sky: true },
      lobby: { fog: [0x1a2024, 0.012], env: 0.65, hemi: [0xd8e4ea, 0x2a2c2c, 0.34], exp: 1.0 },
      chapel: { fog: [0x1a1410, 0.02], env: 0.55, hemi: [0xffd8b0, 0x1a1410, 0.22], exp: 1.08, warm: true },
      corr: { fog: [0x0c1218, 0.03], env: 0.45, hemi: [0x9ab0c8, 0x101216, 0.2], exp: 1.0 },
      ward: { fog: [0x0a0e14, 0.04], env: 0.28, hemi: [0x6a8aa8, 0x08090a, 0.14], exp: 0.95 },
      rec: { fog: [0x12161a, 0.02], env: 0.65, hemi: [0xd8e0e8, 0x1a1c1e, 0.34], exp: 1.05 },
      vault: { fog: [0x0c1014, 0.03], env: 0.5, hemi: [0x9ab8d0, 0x0c0e10, 0.22], exp: 1.1 },
    };
    let zone = null, lightT = 0, wardDark = 1;
    const applyZone = (z) => {
      zone = z; const c = ZONE[z];
      scene.fog.color.set(c.fog[0]); scene.fog.density = c.fog[1];
      if (night) scene.background = c.sky || z === 'lobby' ? night.background : new THREE.Color(0x080b10);
      const e = c.sky ? night : c.warm ? interiorWarm : interior;
      if (e) { scene.environment = e.envMap; scene.environmentIntensity = c.env; }
      hemi.color.set(c.hemi[0]); hemi.groundColor.set(c.hemi[1]); hemi.intensity = c.hemi[2];
      renderer.toneMappingExposure = c.exp;
      rain.mesh.visible = z === 'out';
      W.rain.rise.mesh.visible = z === 'out' || z === 'lobby';
      if (W.block) W.block.visible = z === 'out' || z === 'lobby';
      audio.rain(z === 'out' ? 0.5 : z === 'lobby' ? 0.16 : 0.03);
      audio.hum(z === 'ward' ? 0.06 : z === 'rec' || z === 'vault' ? 0.1 : z === 'corr' ? 0.08 : 0.04, z === 'vault' ? 48 : 60);
      audio.wind(z === 'out' ? 0.14 : 0);
      lightT = 0; moodFor(z);
    };
    const rigLights = () => {
      const p = game.cine ? game.engine.camera.position : pl.pos;
      const z = zone || 'out';
      const list = W.lightSrc.filter(s => s.zone === z || Math.hypot(s.p[0] - p.x, s.p[2] - p.z) < 10)
        .map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      const dim = z === 'ward' ? 0.55 + 0.45 * (1 - wardDark) : 1;
      const k = list[0];
      if (k) { key.position.set(...k.p); key.target.position.set(k.p[0], 0, k.p[2] - 0.4); key.color.set(k.c); key.intensity = k.i * 3.0 * dim; key.distance = k.d * 1.6; }
      pts.forEach((l, i) => { const s = list[i + 1]; if (!s) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i * dim; l.distance = s.d; });
    };
    game.onUpdate(dt => {
      const z = zoneOf(game.cine ? game.engine.camera.position : pl.pos); if (z !== zone) applyZone(z);
      lightT -= dt; if (lightT <= 0) { lightT = 0.4; rigLights(); }
    });

    // ---------- music that follows the beats ----------
    let musicLock = null, mood = 'm11-rain';
    const ZMOOD = { out: 'm11-rain', lobby: 'm11-lobby', chapel: 'm11-lobby', corr: 'm11-inverted', ward: 'm11-ward', rec: 'm11-records', vault: 'm11-records' };
    const music = (fade = 1.8) => { const th = musicLock || mood; for (const d of T.defs) d.theme = th; audio.setTheme(th, fade); };
    function moodFor(z) { const m = ZMOOD[z]; if (m && m !== mood) { mood = m; if (!musicLock) music(); } }
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    T.configure([{ id: '2049', key: '1', name: 'PRESENT', year: 'HALDEN · 2049', glyph: '◎', color: '#5fe6ff', theme: 'm11-rain', apply: () => {} }], '2049');
    T.unlocked = false;

    // ---------- state + helpers ----------
    const S = { shards: 0, seen: {}, ev: new Set(), obj: '', bellTalked: 0, bellForward: 0, lockFails: 0, misses: 0, fails: 0, records: new Set() };
    const near = (x, z, r) => Math.hypot(pl.pos.x - x, pl.pos.z - z) < r;
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag) => { S.ev.add(title); ui.addEvidence(title, text, tag); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const choose = (id, text, opts, correct = 0) => { if (game.autoplay) game.autoChoice = game.autoQueue?.length ? game.autoQueue.shift() : correct; return game.choice(id, text, opts); };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u)); if (u >= 1) { off(); res(); } }); });
    let shiftPulse = 0;
    game.onUpdate(dt => { if (shiftPulse > 0 && game.engine.fx?.uShift) { shiftPulse = Math.max(0, shiftPulse - dt * 1.2); game.engine.fx.uShift.value = shiftPulse; } });
    const kai = pl.char;

    // ---------- the inversion system: zones, tracks, the inverted tone ----------
    const inv = new Inversion(game, { cost: 0.25, duration: 4.5, range: 7, key: 'KeyX' });
    inv.onHit = (tr) => { S.fails++; F.m11hazardHits = (F.m11hazardHits || 0) + 1; game.fail(tr.o.hazard.msg); };
    inv.zone({ id: 'out', min: [-60, -1, 14.2], max: [100, 30, 48], dir: 1 });
    inv.zone({ id: 'lobby', min: [-14, -1, -2], max: [14, 7, 14.2], dir: 1, label: 'LOBBY' });
    inv.zone({ id: 'chapel', min: [-26, -1, 0], max: [-14, 4, 12], dir: 1, label: 'CHAPEL' });
    const zCorr = inv.zone({ id: 'corr', min: [14, -1, -2.6], max: [46, 3.4, 9.4], dir: -1, label: 'EAST CORRIDOR', doors: [{ at: [14.5, 4], axis: 'x', width: 4, depth: 0.9 }] });
    const zWard = inv.zone({ id: 'ward', min: [46, -1, -14], max: [72, 3.6, 14], dir: -1, label: 'WARD 4', doors: [{ at: [46.6, 4], axis: 'x', width: 4, depth: 0.9 }] });
    inv.zone({ id: 'bell', min: [56, -1, 8.6], max: [61, 3.6, 14], dir: () => (S.bellForward > 0 ? 1 : -1), label: 'BAY 4-03', doors: [{ at: [58.5, 8.3], axis: 'z', width: 2.4, depth: 0.6, flip: true }] });
    const zRec = inv.zone({ id: 'rec', min: [46, -1, -32], max: [72, 3.4, -14], dir: 1, label: 'MEDICAL RECORDS', doors: [{ at: [69, -14.6], axis: 'z', width: 3, depth: 0.8 }] });
    inv.zone({ id: 'bin', min: [49.2, -1, -18.2], max: [52.2, 2.4, -15.0], dir: -1, label: 'BURN BIN · 2026' });
    const zLock = inv.zone({ id: 'lock', min: [45.4, -1, -24.4], max: [47.6, 3.0, -19.6], dir: -1, label: 'REVERSING LOCK' });
    const zVault = inv.zone({ id: 'vault', min: [38, -1, -28], max: [46, 3.2, -17], dir: 1, label: 'RESTRICTED RECORDS' });
    inv.enabled = false;
    // the lobby panel (tutorial): fallen across the east door; an inversion puts it back in the ceiling (and it stays)
    const panelTr = inv.track(W.movers.panel, { label: 'the fallen ceiling panel', from: W.movers.panelFrom, to: W.movers.panelTo, drift: true, u: 1, latch: true, dur: 1.4,
      pose: (u, o) => { o.position.lerpVectors(V(...W.movers.panelFrom), V(...W.movers.panelTo), u); o.rotation.set(0, 0, Math.PI / 2 + (0.32 - Math.PI / 2) * u); },
      onLatch: () => { W.panelBox.enabled = false; audio.sfxPlay('metal'); } });
    // the café cup: coffee that pours itself back (forward room, inversion leaking through the door)
    inv.track(W.movers.cup, { selectable: false, schedule: [2.5, 2.2, 3.0, 0.4], phase: 1, pose: (u, o) => {
      o.rotation.set(0, 0, -1.45 * u); o.position.set(8.1 + 0.08 * u, 0.84 - 0.05 * u, 1.3);
      W.movers.spill.scale.setScalar(0.05 + u * 0.95); W.movers.spill.position.x = 8.0 + 0.2 * u; } });
    // corridor hazards: everything here returns to where it was at 08:14, then lands again
    const corrTracks = W.hazards.map((h) => {
      const o = { label: h.label, zone: zCorr, schedule: h.schedule, phase: h.phase || 0, hazard: { radius: h.radius, msg: h.msg }, collide: h.collide };
      if (h.glass) {
        h.mesh.position.set(...h.origin);
        Object.assign(o, { pose: (u, g) => { for (const s of g.userData.pieces) { s.position.lerpVectors(s.userData.home, s.userData.land, u); s.position.y += Math.sin(u * Math.PI) * 0.5; s.rotation.set(s.userData.spin[0] * u, s.userData.spin[1] * u, s.userData.spin[2] * u + (u > 0.98 ? Math.PI / 2 : 0)); } } });
        o.hazard.pos = () => V(32, 1.0, 4.0);
      } else Object.assign(o, { from: h.from, to: h.to, arc: h.arc, spin: h.spin });
      if (h.slab) o.hazard.pos = () => { const w = h.mesh.position; return V(w.x, w.y + 0.3, Math.max(1.6, Math.min(6.4, pl.pos.z))); };
      const tr = inv.track(h.mesh, o);
      // telegraph: a floor ring that brightens just before the motion starts
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.82, 32), new THREE.MeshBasicMaterial({ color: 0xa8d8ff, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(h.radius / 0.8); ring.userData.noBatch = true; scene.add(ring); tr.tele = ring;
      return tr;
    });
    let corrCue = 0;
    game.onUpdate((dt) => {
      const inCorr = zoneOf(pl.pos) === 'corr';
      for (const tr of corrTracks) {
        const w = inv.worldPos(tr, V()), n = inv.nextMove(tr), r = tr.tele;
        r.position.set(w.x, 0.03, w.z);
        const warn = n > 0 && n < 0.8, moving = tr.speed > 0.05;
        r.material.opacity = !tr.enabled ? 0 : moving ? 0.75 : warn ? 0.35 + 0.4 * Math.abs(Math.sin(game.time * 12)) : 0.08;
        r.material.color.setHex(tr.inv > 0 ? 0xffd8a0 : 0xa8d8ff);
        if (warn && inCorr && audio.ctx && Math.hypot(w.x - pl.pos.x, w.z - pl.pos.z) < 9) { corrCue -= dt; if (corrCue <= 0) { corrCue = 0.25; audio.tick(audio.ctx.currentTime, 0.04, 2600, audio.sfx); } }
      }
    });
    // the alcove panel (optional shard): an inversion lifts it back to the ceiling for a few seconds
    const alcoveTr = inv.track(W.movers.alcove, { label: 'the fallen alcove panel', from: W.movers.alcoveFrom, to: W.movers.alcoveTo, drift: true, u: 1, dur: 1.0, driftRate: 1 / 0.9, zone: zCorr,
      hazard: { radius: 1.3, msg: 'THE PANEL CAME DOWN AGAIN', minSpeed: 0.2 }, spin: [0.12, 0, 0.08] });
    // the ward: an IV pole drifting back to the bed it left; chart pages climbing back to the desk
    inv.track(W.movers.iv, { selectable: false, zone: zWard, from: [62.9, 0, -9.4], to: [60.4, 0, -5.6], schedule: [4, 6, 3, 2], spin: [0, 0.8, 0] });
    W.movers.pages.forEach((pg, k) => inv.track(pg, { selectable: false, zone: zWard, schedule: [1.5 + k * 0.4, 2.4, 2 + k * 0.3, 1.1], phase: k * 1.3,
      pose: (u, o) => { const a = k * 1.1; o.position.set(57.4 + Math.cos(a) * (0.4 + 1.6 * u), 1.12 - 1.1 * u + Math.sin(u * Math.PI) * 0.4, -1.1 + Math.sin(a) * (0.3 + 1.4 * u)); o.rotation.set(-Math.PI / 2 + u * 0.3, a + u * 2, u * 0.4); } }));
    // Bell's clock: runs backward with his bay; inverting it lets the bay run forward for a while
    const clk = W.movers.clock; let clockT = 8 * 3600 + 14 * 60;
    const bellClockTr = inv.track(clk.g, { label: 'Mr. Bell\'s clock', invertFor: 16, range: 6, canInvert: () => S.bellTalked > 0 && S.bellForward <= 0,
      step: (dt, tr, back) => { const fwd = back || S.bellForward > 0; clockT += (fwd ? 1 : -1) * dt * 6; const s = clockT % 60, m = (clockT / 60) % 60, h = (clockT / 3600) % 12; clk.sc.rotation.z = -s / 60 * Math.PI * 2; clk.mn.rotation.z = -m / 60 * Math.PI * 2; clk.hr.rotation.z = -h / 12 * Math.PI * 2; },
      onInvert: () => { S.bellForward = 16; audio.sfxPlay('rewind'); ui.subtitle('kai', 'His bay\'s running forward. Talk to him — now.', 3000); } });
    game.onUpdate(dt => { if (S.bellForward > 0) S.bellForward = Math.max(0, S.bellForward - dt); });
    let lobbyT = 8 * 3600 + 14 * 60 + 30; const LC = W.movers.lobbyClock;
    game.onUpdate(dt => { if (zone !== 'lobby' && zone !== 'out') return; lobbyT -= dt; const s2 = lobbyT % 60, m = (lobbyT / 60) % 60, h = (lobbyT / 3600) % 12; LC.sc.rotation.z = -Math.floor(s2) / 60 * Math.PI * 2; LC.mn.rotation.z = -m / 60 * Math.PI * 2; LC.hr.rotation.z = -h / 12 * Math.PI * 2; });
    // the burn bin: the night book page burned at 08:40 in 2026; inverted far enough, it un-burns (and stays)
    const binTr = inv.track(W.movers.page, { label: 'the burned night book', drift: true, u: 1, latch: true, dur: 2.6, range: 5,
      pose: (u, o) => { o.scale.setScalar(Math.max(0.001, 1 - u)); o.position.y = 0.76 + (1 - u) * 0.45; o.rotation.z = (1 - u) * 0.6; W.movers.ash.material.emissiveIntensity = 0.15 + u * 0.5; W.movers.ash.scale.setScalar(0.2 + u * 0.8); },
      onLatch: () => { S.pageWhole = true; audio.sfxPlay('pickup'); ui.subtitle('kai', 'It went all the way back. The page from 2026, whole again.', 3200); } });
    // the inverted tone (a heart monitor in 4-07): loudest far away, silent at the source
    const tone = inv.sound({ pos: [P.bed407[0], 1.0, P.bed407[2]], maxD: 30, r0: 1.3, period: 0.92, freq: 988, vol: 0.2, inverted: () => true });
    tone.on = false;
    game.onUpdate(() => { musicState.quiet = zone === 'ward' && tone.on ? Math.max(0, 1 - tone.gain * 1.25) : 0; });
    let echo = null;
    if (F.echoStep) { try { echo = new EchoStep(game, { cost: 0.3, cooldown: 6, linger: 3 }); echo.unlock(); } catch (err) { console.warn('m11 echo', err); } }
    window.__m11 = { S, W, inv, tone, panelTr, corrTracks, alcoveTr, binTr, bellClockTr, zones: { zCorr, zWard, zRec, zLock, zVault } };

    // ---------- people ----------
    const guardLook = CAST[guardId]?.look ? null : CAST.hguard.look;
    const guard = game.actor(guardId, guardLook, P.guard[0], 0.12, P.guard[2], 0);
    const raman = game.actor('raman', null, P.raman[0], 0.12, P.raman[2], 0.2);
    const bell = game.actor('bell', null, 57.1, 0, 11.5, Math.PI / 2); bell.pose = 'sit';
    const walkers = [
      new Walker(game, PARAMEDIC, { x: 10.6, y: 0.12, z0: 17.6, z1: 17.6, idle: true, ry: -0.6 }),
      new Walker(game, PARAMEDIC_M, { x: 14.2, y: 0.12, z0: 16.4, z1: 16.4, idle: true, ry: 2.2 }),
      new Walker(game, EVACUEE, { x: -6.4, y: 0.12, z0: 19.8, z1: 19.8, idle: true, ry: 0.4 }),
      new Walker(game, NURSE, { x: -10.6, y: 0.12, z0: 16.5, z1: 23.5, speed: 0.7 }),
    ];
    game.onUpdate(dt => { const on = zone === 'out' || zone === 'lobby'; for (const w of walkers) { w.c.root.visible = on; if (on) w.update(dt); } });
    // residue echoes: the chapel in October 2026 (Elena Varen and Kai, seven), the technician fitting the lock
    const mother = game.actor('mother', MOTHER_2026, -18.6, 0, 8.6, -Math.PI / 2); mother.pose = 'sit'; mother.setGhost(0xffd8a8);
    const kidKai = game.actor('kidkai11', { ...KID_KAI }, -18.6, 0, 9.4, -Math.PI / 2); kidKai.pose = 'sit'; kidKai.setGhost(0xffd8a8);
    game.residue(mother.root); game.residue(kidKai.root);
    const tech = game.actor('techghost', TECH_GHOST, 47.0, 0, -22.2, -Math.PI / 2); tech.pose = 'work'; tech.setGhost(0x9fe8ff); game.residue(tech.root);
    const miraGhost = game.actor('miraghost', { ...CAST.mira.look, role: 'mira' }, P.bed407[0], 0.3, -11.5, 0); miraGhost.setGhost(0x9a7bff); miraGhost.root.visible = false;

    // ---------- collectibles: temporal shards ----------
    const shardMesh = [];
    const shard = (i, enabled = () => true) => {
      const [x, y, z, where] = SHARDS[i];
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), glowMat(0x7fe8ff, 3.2)); m.position.set(x, y, z); scene.add(m); m.userData.noBatch = true; shardMesh.push(m);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.01, 6, 32), glowMat(0x7fe8ff, 1.8)); m.add(halo);
      game.onUpdate((dt, t) => { m.rotation.y += dt * 1.4; halo.rotation.x = t; m.visible = !m.userData.taken; });
      game.interact({ pos: [x, y, z], radius: 1.7, prompt: 'Take the temporal shard', enabled: () => !m.userData.taken && enabled(), onUse: () => {
        m.userData.taken = true; S.shards++; F.shards = (F.shards || 0) + 1; F.m11shards = S.shards; audio.sfxPlay('anomaly');
        ev('Temporal shard ' + S.shards + '/5', 'Crystallised time, found at ' + where + '. It hums a little slower than the room around it.', 'TEMPORAL SHARD · ' + S.shards + '/5');
      } });
    };
    shard(0); shard(1, () => alcoveTr.u < 0.3); shard(2); shard(3, () => !!S.pageWhole); shard(4);

    // =====================================================================================
    // OPENING: Rain City at night, Halden General, rain that falls up past the East Wing
    // =====================================================================================
    ui.missionTag('MISSION 11 · THE INVERTED HOSPITAL'); ui.show('hud', true);
    pl.place(...P.start); game.checkpoint(...P.start);
    applyZone('out'); audio.setTheme(null);
    cine(true);
    game.engine.camera.position.set(-26, 16, 60);
    await game.shot([-26, 16, 60], [12, 9, 6], 0.01, { fov: 50 });
    await ui.fade(0, 2600);
    lockMusic('m11-rain', 2);
    const cc = ui.chapterCard('ACT II · THE NINE-MINUTE WAR', 'The Inverted Hospital', 'Halden General · East Wing · Rain City · 22.10.2049', 4400);
    await game.shot([-8, 9, 44], [20, 10, 8], 6.5, { fov: 44 });
    await cc;
    await game.shot([24, 1.4, 25], [34, 9, 15], 3.2, { fov: 40 });
    await game.shot([-2.2, 1.7, 49.4], [-3.4, 1.55, 45.6], 1.6, { fov: 40 });
    kai.lookTarget = V(30, 8, 14);
    if (F.m10done) await game.say('kai', 'Sera\'s evening was a real one. Here, even the rain can\'t agree which way to fall.');
    await game.talk([
      ['kai', 'Halden General. Twenty-three years ago they told my parents Mira died on the fourth floor of the East Wing.'],
      ['kai', 'Three days ago, at eight-fourteen, the East Wing started running backward.'],
    ]);
    kai.lookTarget = null;
    ev('Halden General, East Wing', 'Rain City\'s public hospital. Since 08:14 on 19.10.2049 rain has fallen upward past the East Wing. Twenty-three years ago Mira Varen was declared dead on its fourth floor.', 'HALDEN · 2049');
    cine(false); lockMusic(null);
    objective('Reach the cordon at the hospital doors');
    hint(() => pl.pos.z > 30, 60, () => ui.subtitle('kai', 'The cordon. Across the road, under the canopy.', 2800));
    game.onUpdate(() => { if (zone === 'out' && near(12, 18, 4) && once('medics')) ui.subtitle('paramedic', 'We got eleven out. The twelfth door just kept closing itself.', 3600); });
    await game.waitFor(() => pl.pos.z < 25.4 && Math.abs(pl.pos.x) < 9);

    // ---------- the cordon: Dr. Raman, and Hale or Brandt ----------
    cine(true);
    pl.place(-0.4, 0.12, 24.6, Math.PI);
    guard.lookTarget = kai.head; raman.lookTarget = kai.head; kai.lookTarget = raman.head;
    await game.shot([3.4, 1.8, 26.2], [-0.4, 1.5, 21.6], 1.4, { fov: 42 });
    F.metRaman = true;
    if (!brandtRoute) {
      await game.talk([
        [guardId, 'Varen. I wondered when you\'d turn up.'],
        [guardId, 'Rook calls it a system failure. Helix sent nobody. I\'m on this door because nobody else would stand here.'],
        ['raman', 'Priya Raman. Temporal medicine, what there is of it. You\'re the Varen who was on the station platform.'],
      ]);
    } else {
      await game.talk([
        ['brandt', 'Helix property, Varen. This wing is under directive. Walk away.'],
        ['raman', 'It\'s a hospital, officer. It was a hospital before Helix ever paid for a wall in it.'],
        ['brandt', 'Then it can be a hospital again when Dr. Rook says so.'],
      ]);
    }
    await game.shot([-3.4, 1.7, 25.2], [-1.4, 1.55, 21.4], 1.2, { fov: 38 });
    await game.talk([
      ['kai', 'Is anyone still inside?'],
      ['raman', 'Three patients on Ward 4, and something on a monitor nobody can find. Some rooms in there run forward. Some run back.'],
      ['raman', 'Walk into the wrong one and the thing that fell on you three days ago falls off you again. Back up to where it came from.'],
      ['kai', 'And the sound?'],
      ['raman', 'A heart monitor. It\'s loudest out here. The closer you get to Ward 4, the quieter it is. Nobody has found the bed.'],
    ]);
    tone.on = true;
    if (!brandtRoute) {
      await game.say(guardId, 'Go on. I didn\'t see you.');
      W.cordonGate.enabled = false; guard.root.rotation.y = -1.2;
      cine(false);
      objective('Go into the hospital · follow the tone');
    } else {
      {
        await game.say('raman', 'The ambulance bay. Its side door hasn\'t locked since eight-fourteen. Keep the van between you and him.');
        cine(false);
        objective('Get in through the ambulance-bay door · stay out of Brandt\'s sight');
        guard.lookTarget = null;
        let pushT = 0;
        const off = game.onUpdate(dt => {
          // Brandt watches the cordon gap and the pavement in front of it; the van hides the bay door
          const dx = pl.pos.x - guard.root.position.x, dz = pl.pos.z - guard.root.position.z;
          const seen = game.control && pl.pos.z > 14.3 && pl.pos.z < 27 && Math.abs(dx) < 7.5 && dz > -0.5 && !(pl.pos.x > 9 && pl.pos.z < 19.8);
          guard.faceTowards(seen ? pl.pos.x : guard.root.position.x, seen ? pl.pos.z : guard.root.position.z + 3, dt, 3);
          pushT = seen && Math.hypot(dx, dz) < 3.2 ? pushT + dt : Math.max(0, pushT - dt);
          if (pushT > 0.6 && !game._failing) { pushT = 0; ui.subtitle('brandt', 'Back behind the line. Last warning.', 2400); pl.place(-0.4, 0.12, 27.6, Math.PI); }
        });
        game.interact({ pos: [11.2, 1.2, 14.6], radius: 1.8, prompt: 'Slip through the ambulance-bay door', onUse: () => { S.bayIn = true; } });
        await game.waitFor(() => S.bayIn);
        off();
        audio.sfxPlay('door'); W.bayDoorBox.enabled = false;
        await tween(0.6, u => { W.bayDoor.position.x = 11.2 + 2.7 * u; });
        pl.place(11.2, 0, 12.4, Math.PI);
        F.m11bayDoor = true;
      }
    }
    game.checkpoint(0, 0, 11.6, Math.PI);

    // =====================================================================================
    // THE LOBBY: the coffee that pours itself back; the panel across the east door; Inversion
    // =====================================================================================
    await game.waitFor(() => pl.pos.z < 13.2 && zoneOf(pl.pos) === 'lobby');
    cine(true);
    await game.shot([5.6, 1.5, 3.6], [8.1, 0.8, 1.4], 2.4, { fov: 34 });
    await game.say('kai', 'That coffee is pouring itself back into the cup.');
    await game.shot([9.4, 1.7, 7.4], [14, 1.4, 4], 1.6, { fov: 44 });
    await game.say('kai', 'Louder out here, Raman said. She\'s right. The further I am from it, the louder it gets.');
    await game.say('kai', 'And the clock over the East Wing door is ticking backward.');
    cine(false);
    objective('Find the way into the East Wing corridor');
    ui.toast('THE TONE\nIn the East Wing a sound gets quieter as you approach it · the SOUND meter shows its level', 5200);
    hint(() => zone === 'lobby' && !near(14, 4, 4), 45, () => ui.subtitle('kai', 'East Wing. The door past the waiting seats.', 2600));
    // optional: the chapel in residue
    game.interact({ pos: [P.prayer[0], 1.1, P.prayer[2]], radius: 1.8, prompt: 'Read the book of intentions', onUse: async () => {
      cine(true); pl.place(-22.4, 0, 4.0, -Math.PI / 2);
      await game.shot([-21.8, 1.6, 2.0], [-23.2, 1.05, 3.0], 1.0, { fov: 34 });
      await game.talk([
        ['kai', '"For M., ten years old, taken in the morning. They will not let us see her."'],
        ['kai', '"Kai keeps asking what time it is." E.V., nineteenth of October.'],
        ['kai', 'Mum\'s handwriting. October 2026.'],
      ]);
      F.m11prayer = true;
      ev('Book of intentions, October 2026', 'In the Halden chapel, Elena Varen\'s note: "For M., ten years old, taken in the morning. They will not let us see her. Kai keeps asking what time it is." 19 October 2026.', 'HALDEN CHAPEL · 2026');
      cine(false);
      if (!game.residueOn) ui.toast('RESIDUE VISION (F) · something happened in this room', 3200);
    } });
    game.onUpdate(() => {
      if (zone === 'chapel' && once('chapelIn')) ui.subtitle('kai', 'The candles are getting taller. Burning backward.', 3000);
      if (zone === 'chapel' && game.residueOn && once('chapelEcho')) {
        F.m11chapel = true;
        ui.subtitle('kai', 'Mum. And me, seven years old, asking what time it is. This is the morning they told us.', 4600);
        ev('Residue: the chapel, 19.10.2026', 'Residue Vision in the Halden chapel: Elena Varen in the second pew and Kai, seven, beside her, swinging his feet. The morning Mira was taken onto Ward 4.', 'HALDEN CHAPEL · RESIDUE');
      }
    });
    await game.waitFor(() => near(14, 4, 3.4));
    // the panel blocks the door; the band reads the field
    cine(true);
    pl.place(11.6, 0, 4, Math.PI / 2);
    await game.shot([10.2, 1.9, 6.6], [13.8, 1.3, 4], 1.4, { fov: 42 });
    await game.say('kai', 'The ceiling came down across the door at eight-fourteen. In there, everything wants to go back to where it was.');
    kai.wristBoost = 10; audio.sfxPlay('switch'); shiftPulse = 0.4;
    await game.shot([12.3, 1.35, 4.9], [11.6, 1.05, 4.1], 1.2, { fov: 30 });
    await game.talk([
      ['kai', 'The band\'s reading the field. Not a state. A direction.'],
      ['kai', 'If that corridor can run backward, maybe I can push one thing the same way. Just one.'],
    ]);
    inv.enabled = true; inv.unlock(); F.inversion = true; F.m11inversion = true;
    cine(false);
    ui.toast('INVERSION\nX (touch: INVERT) reverses ONE selected motion for a few seconds\nThe ring shows the pick · the dashed line, where it goes back to · costs stability', 7000);
    objective('Invert the fallen ceiling panel (X)');
    hint(() => panelTr.u > 0.5, 25, () => ui.subtitle('kai', 'Face the panel and invert it. X.', 2400));
    await game.waitFor(() => panelTr.done);
    await game.wait(0.6);
    await game.say('kai', 'Back in the ceiling. Just that one thing — the rest of the room didn\'t even notice.');
    ev('Inversion', 'Kai\'s Chronolith band can push one selected motion backward for a few seconds, at a cost in stability. Local only: nothing else in the room rewinds. The fallen panel went back into the ceiling.', 'SYSTEM · INVERSION');
    const restoreCorr = () => { inv.setHazards(false); setTimeout(() => inv.setHazards(true), 1800); T.stability = Math.max(T.stability, 0.6); };
    game.checkpoint(...P.corrStart, restoreCorr);

    // =====================================================================================
    // THE EAST CORRIDOR: hazards returning to their original positions
    // =====================================================================================
    objective('Cross the East Corridor · things return to where they were at 08:14 · the floor ring glows before they move');
    await game.waitFor(() => pl.pos.x > 15.2);
    cine(true); lockMusic('m11-inverted', 1);
    await game.shot([16.4, 2.4, 2.2], [24, 0.8, 4.6], 2.6, { fov: 48 });
    await game.shot([28.6, 1.6, 5.8], [32, 1.4, 1.4], 2.6, { fov: 40 });
    await game.say('kai', 'The gurney, the cylinder, the glass… all of it going home to eight-fourteen. And then landing again.');
    cine(false); lockMusic(null);
    const offCorr = game.onUpdate(() => {
      if (zone !== 'corr' || !game.control) return;
      if (pl.pos.x > 30 && S.cpMid !== 1) { S.cpMid = 1; game.checkpoint(...P.corrMid, restoreCorr); }
      if (pl.pos.x > 34.4 && once('cartsBark')) ui.subtitle('kai', 'The carts run in lanes. Read where they go home to.', 3000);
      if (pl.pos.x > 41.5 && once('ceilBark')) ui.subtitle('kai', 'The ceiling goes up, waits, comes down. Go under it while it\'s up.', 3400);
      if (near(28, 7.6, 2.6) && once('alcove')) ui.subtitle('kai', 'Something under that panel is glowing. If I lift it back up… I won\'t have long.', 3600);
    });
    hint(() => zone === 'corr' && S.fails > 2, 30, () => ui.subtitle('kai', 'If it\'s coming at me, invert it. It goes back the way it came.', 3000));
    await game.waitFor(() => pl.pos.x > 45.2 && pl.pos.z > 1.2 && pl.pos.z < 7);
    offCorr();
    F.m11corridorFails = S.fails;
    game.checkpoint(...P.wardIn);

    // =====================================================================================
    // WARD 4: follow the tone to where it is silent
    // =====================================================================================
    await game.waitFor(() => zone === 'ward');
    cine(true);
    await game.shot([47.8, 2.6, 6.4], [58, 1.0, -4], 2.8, { fov: 50 });
    await game.say('kai', 'Ward 4. The tone was loudest at the hospital doors. In here it\'s… thinning out.');
    await game.shot([60, 1.4, -3.6], [60.8, 0.6, -6.4], 1.8, { fov: 38 });
    await game.say('kai', 'That IV pole is walking itself back to a bed.');
    cine(false);
    objective('Follow the tone · in Ward 4 it gets QUIETER as you get closer · find the bay where it stops');
    let wardT = 0, lastG = 1, louderBark = 0;
    const intercom = ['Handover night. Seven bay checked I. Again.', 'Fourteen past eight. Failed lights the. Back them came.', 'Breathing is she. Empty it call they.', 'Seven bay. Seven bay. Seven bay.'];
    let icI = 0;
    const offWard = game.onUpdate(dt => {
      if (zone !== 'ward' || !game.control) return;
      wardT += dt; louderBark -= dt;
      if (wardT > 24) { wardT = 0; ui.subtitle('intercom', intercom[icI++ % intercom.length], 3600); }
      if (!S.found && louderBark <= 0 && tone.gain > lastG + 0.18) { louderBark = 14; ui.subtitle('kai', ['Louder. Wrong way — in here louder means further.', 'Getting louder. Turn back.', 'The tone\'s swelling. I\'m moving away from it.'][Math.floor(Math.random() * 3)], 2800); lastG = tone.gain; }
      if (tone.gain < lastG - 0.15) lastG = tone.gain;
      if (pl.pos.z > 8.4 && near(58.5, 11.2, 3) && once('bellSeen')) ui.subtitle('kai', 'Someone\'s in this bay. An old man, talking to nobody.', 3000);
    });
    hint(() => zone === 'ward' && !S.found, 70, () => ui.subtitle('kai', tone.gain > 0.5 ? 'Too loud here. Head for the north bays.' : 'Quieter… keep going the way it fades.', 3000));
    game.interact({ pos: [P.bed407[0], 1.0, -11.4], radius: 2.4, prompt: 'Listen: the tone stops here', enabled: () => tone.gain < 0.2 && !S.found, onUse: () => { S.found = true; } });
    // optional: Arturo Bell, bay 4-03 (his bay runs backward: he says goodbye first)
    bell.lookTarget = null;
    game.interact({ pos: [57.6, 1.2, 11.2], radius: 2.2, once: false, prompt: 'Talk to the man in bay 4-03', enabled: () => !F.m11bell, onUse: async () => {
      cine(true); pl.place(59.0, 0, 11.0, -Math.PI / 2); bell.lookTarget = kai.head; kai.lookTarget = bell.head;
      await game.shot([58.3, 1.5, 8.9], [58.0, 1.1, 11.3], 1.0, { fov: 44 });
      if (S.bellForward > 0) {
        await game.talk([
          ['bell', 'Hello. Are you the new porter? No… you\'ve got his face. The man who visits seven.'],
          ['kai', 'Who visits bay seven?'],
          ['bell', 'Every October. A little older every time, grey by now. A scar here. He sits with her and he never signs out.'],
          ['kai', 'Sits with who?'],
          ['bell', 'The girl in seven. I was the orderly then. She drew machines on the menu cards. A black ring, taller than a man.'],
          ['bell', 'She said her brother would come back for her. And that he\'d look younger than her when he did. She was very sure about that.'],
          ['bell', 'Thank you for sitting with me. Goodbye, son. Mind the stairs.'],
        ]);
        F.m11bell = 'forward'; S.bellForward = 0;
        ev('Arturo Bell, orderly in 2026', 'Bay 4-03. In 2026 he was the Ward 4 orderly. The girl in bay seven drew a black ring on the menu cards and said her brother would come back for her looking younger than her. A grey man with a scar visits seven every October and never signs out.', 'WARD 4 · BAY 4-03');
      } else if (!S.bellTalked) {
        await game.talk([
          ['bell', 'Goodbye, son. Mind the stairs.'],
          ['bell', 'Thank you for sitting with me.'],
          ['bell', 'She said her brother would come back for her.'],
          ['bell', 'The girl in seven. She drew machines.'],
          ['bell', 'Hello. Are you the new porter?'],
        ]);
        await game.talk([
          ['kai', 'He said goodbye first. His bay runs backward — everything comes out the wrong way round.'],
          ['kai', 'That clock on his wall is running back with him. If I invert it, his bay might run forward long enough to talk.'],
        ]);
        S.bellTalked = 1;
        ui.toast('OPTIONAL · THE MAN WHO SAYS GOODBYE FIRST\nInvert Mr. Bell\'s clock (X), then talk to him while his bay runs forward', 5600);
      } else {
        await game.talk([['bell', 'Goodbye, son.'], ['kai', 'Backward again. The clock first.']]);
      }
      bell.lookTarget = null; kai.lookTarget = null; cine(false);
    } });
    await game.waitFor(() => S.found);
    offWard();
    // ---------- bay 4-07: the silent bed ----------
    cine(true); lockMusic('m11-mira', 2);
    tone.on = false; wardDark = 0.6; W.screens.monitor.material.map = TEX.monitor(true); W.screens.monitor.material.needsUpdate = true;
    pl.place(53.5, 0, -9.6, Math.PI);
    await game.shot([55.6, 1.9, -9.2], [53.4, 0.8, -12.2], 2.4, { fov: 42 });
    audio.silence(1.4); await game.wait(1.4);
    await game.talk([
      ['kai', 'Silent. Right at the source.'],
      ['kai', 'The bed is made. But the mattress is pressed down, like someone\'s lying in it.'],
    ]);
    await game.shot([54.9, 0.95, -10.9], [54.0, 0.45, -11.6], 1.4, { fov: 30 });
    await game.say('kai', 'Bed sensor: fifty-four kilos. Continuous. Since eight-fourteen on the nineteenth of October — 2026.');
    S.records.add('sensor');
    ev('Bed 4-07 sensor', 'The load sensor under bed 4-07 reads 54 kg, continuously, since 08:14 on 19.10.2026. The bed is made and empty to the eye. The monitor beside it is the tone that grows quieter as you approach.', 'WARD 4 · BAY 4-07');
    await game.shot([54.2, 1.7, -7.6], [53.5, 1.2, -12.6], 1.6, { fov: 44 });
    await game.say('raman', 'Varen? The tone just stopped out here. What did you find?');
    await game.talk([
      ['kai', 'Bay 4-07. An empty bed that weighs fifty-four kilos.'],
      ['raman', 'Four-seven? That bay\'s been empty since before I trained. The census has never had anyone in it.'],
      ['kai', 'Then the census is wrong. Where are the records kept?'],
      ['raman', 'Medical Records, north end of the ward. The restricted archive is Helix\'s. Hospital staff can\'t open it.'],
    ]);
    cine(false); lockMusic(null);
    game.checkpoint(69, 0, -12.6, Math.PI);
    objective('Medical Records: compare the records to find the missing patient · optional: the man in bay 4-03');

    // =====================================================================================
    // MEDICAL RECORDS: compare the records, identify the missing patient
    // =====================================================================================
    const recIt = (pos, prompt, k, fn, r = 1.8, cond = () => true) => game.interact({ pos, radius: r, once: false, prompt, enabled: () => !S.records.has(k) && cond(), onUse: async () => { if (S.records.has(k)) return; await fn(); } });
    recIt([P.census[0], 1.1, -15.2], 'Read the Ward 4 census', 'census', async () => {
      cine(true); pl.place(P.census[0] - 0.9, 0, -15.7, Math.PI); await game.shot([P.census[0] + 0.5, 1.55, -16.0], [P.census[0], 1.1, -14.44], 1.0, { fov: 32 });
      await game.talk([['kai', 'Ward 4 census, tonight. Osei in 4-01, Bell in 4-03, Kovac in 4-05.'], ['kai', '"4-07: unoccupied since 19.10.2026." Twenty-three years empty.']]);
      S.records.add('census'); ev('Ward 4 census', 'Tonight\'s census: three patients (Osei 4-01, Bell 4-03, Kovac 4-05). Bay 4-07 is listed "unoccupied since 19.10.2026".', 'MEDICAL RECORDS · 2049'); cine(false);
    });
    recIt([P.pharmacy[0], 1.1, -15.2], 'Read the dispensing log', 'pharmacy', async () => {
      cine(true); pl.place(P.pharmacy[0] - 0.9, 0, -15.7, Math.PI); await game.shot([P.pharmacy[0] + 0.5, 1.55, -16.0], [P.pharmacy[0], 1.1, -14.44], 1.0, { fov: 32 });
      await game.talk([['kai', 'Pharmacy. Bed 4-07, every night since October 2026. Eight thousand four hundred and four doses. None returned.'], ['kai', 'Ordered by the Helix medical liaison. For an empty bed.']]);
      S.records.add('pharmacy'); ev('Dispensing log, bed 4-07', '8,404 nightly doses (neural stabiliser, saline, sedative) to bed 4-07 since 19.10.2026, none returned. Ordered by the Helix medical liaison; countersigned automatically.', 'MEDICAL RECORDS · PHARMACY'); cine(false);
    });
    recIt([P.bin[0], 1.0, P.bin[2]], 'Look into the burn bin', 'binLook', async () => {
      cine(true); pl.place(P.bin[0] - 0.9, 0, P.bin[2] + 0.4, Math.PI / 2); await game.shot([P.bin[0] + 1.0, 1.6, P.bin[2] + 0.9], [P.bin[0], 0.7, P.bin[2]], 1.0, { fov: 36 });
      await game.talk([['kai', 'Ash, still glowing at the edges. Night book pages — burned in 2026 and never finished burning.'], ['kai', 'This corner runs backward on its own. If I push it, it might go all the way back to paper.']]);
      S.records.add('binLook'); cine(false);
    }, 1.6, () => !S.pageWhole);
    recIt([P.bin[0], 1.0, P.bin[2]], 'Read the night book page', 'nightbook', async () => {
      if (!S.pageWhole) return;
      cine(true); pl.place(P.bin[0] - 0.9, 0, P.bin[2] + 0.4, Math.PI / 2); await game.shot([P.bin[0] + 0.6, 1.7, P.bin[2] + 0.6], [P.bin[0], 1.15, P.bin[2]], 1.0, { fov: 32 });
      await game.talk([
        ['kai', '"08:14. Lights failed, all bays. 08:15. Bay seven occupied. No admission. No porter."'],
        ['kai', '"Adult woman, about thirty. Calm. Asked what year it was."'],
        ['kai', '"08:40. Helix liaison on the ward. Name withheld at their request. File to Restricted Records, drawer 4-07."'],
        ['kai', '"09:05. Told to record bay seven as empty." Signed, Staff Nurse Okoye.'],
      ]);
      S.records.add('nightbook'); ev('Ward 4 night book, 19.10.2026', 'Un-burned from the bin: at 08:15 bay seven was occupied with no admission: an adult woman, about thirty, who asked what year it was. At 08:40 Helix withheld her name and took her file to Restricted Records, drawer 4-07. At 09:05 the nurse was told to record the bay as empty.', 'MEDICAL RECORDS · 2026'); cine(false);
    }, 1.6, () => !!S.pageWhole);
    // optional: the Helix liaison office
    game.interact({ pos: [P.memo[0], 1.0, P.memo[2]], radius: 1.8, prompt: 'Read the memo on the liaison\'s desk', onUse: async () => {
      cine(true); pl.place(P.memo[0] + 0.9, 0, P.memo[2] + 1.0, Math.PI); await game.shot([P.memo[0] - 0.4, 1.6, P.memo[2] + 1.0], [P.memo[0], 0.8, P.memo[2] + 0.2], 1.0, { fov: 34 });
      await game.talk([['kai', '"Classify the East Wing event as a system failure. Do not open Restricted Records. Do not move the occupant of 4-07."'], ['kai', '"Helix will attend." E. Rook, nine-oh-two. Forty-eight minutes after the Zero Second, he already knew who was in that bed.']]);
      F.m11memo = true; ev('Rook\'s memo, 19.10.2049', 'Helix to Halden Facilities, 09:02 on the morning of the Zero Second: classify the East Wing as a system failure, do not open Restricted Records, do not move the occupant of 4-07. Signed E. Rook.', 'HELIX LIAISON OFFICE'); cine(false);
    } });
    game.interact({ pos: [71.2, 1.4, P.visitors[2]], radius: 1.8, prompt: 'Read the bay 4-07 visitors\' log', onUse: async () => {
      cine(true); pl.place(70.6, 0, P.visitors[2] - 1.0, Math.PI / 2); await game.shot([70.0, 1.6, P.visitors[2] + 0.4], [71.85, 1.5, P.visitors[2]], 1.0, { fov: 32 });
      await game.talk([['kai', 'Visitors to 4-07. "K. Varen, brother." Every nineteenth of October, 2027 to 2048.'], ['kai', '"Older than the photo on his ID. Same scar every year. Never signs out."'], ['kai', 'I have never been on this ward in my life.']]);
      F.m11visitors = true; ev('Visitors\' log, bay 4-07', 'Every 19 October from 2027 to 2048: "K. Varen, brother". The desk noted he was older than his ID photo, had the same scar every year and never signed out. Kai has never visited.', 'HELIX LIAISON OFFICE'); cine(false);
    } });
    // the incident board: compare, then deduce
    const board = { n: 0 };
    game.onUpdate(() => { const n = ['census', 'sensor', 'pharmacy', 'nightbook'].filter(k => S.records.has(k)).length; if (n !== board.n) { board.n = n; W.screens.board.material.map = TEX.board(n); W.screens.board.material.needsUpdate = true; } });
    game.onUpdate(() => { if (zone === 'rec' && once('recIn')) ui.subtitle('kai', 'Census, pharmacy, the archive. If she was here, somebody wrote it down somewhere.', 3600); });
    hint(() => zone === 'rec' && !S.records.has('nightbook') && S.records.has('binLook'), 40, () => ui.subtitle('kai', 'The bin. Invert the burned page and let it go all the way back.', 3000));
    let deduced = false;
    game.interact({ pos: [P.board[0], 1.5, -31.0], radius: 2.2, once: false, prompt: 'Compare the records on the incident board', enabled: () => !deduced, onUse: async () => {
      const have = ['census', 'sensor', 'nightbook'].filter(k => S.records.has(k));
      cine(true); pl.place(P.board[0] - 1.6, 0, -30.2, Math.PI); await game.shot([P.board[0] + 0.4, 1.7, -28.6], [P.board[0], 1.6, -31.86], 1.0, { fov: 40 });
      if (have.length < 3) {
        const miss = [!S.records.has('census') && 'the ward census', !S.records.has('nightbook') && (S.records.has('binLook') ? 'what\'s left of the 2026 night book' : 'the 2026 night book'), !S.records.has('sensor') && 'the bed itself'].filter(Boolean);
        await game.say('kai', 'Not enough yet. I still need ' + miss.join(' and ') + '.');
        cine(false); return;
      }
      await game.say('kai', 'The census says empty. The bed says fifty-four kilos. The pharmacy has fed it for twenty-three years. The night book says a woman.');
      for (;;) {
        const i = await choose('kai', 'Which patient is missing from Ward 4?', ['Ruth Osei, bay 4-01', 'Arturo Bell, bay 4-03', 'The woman in 4-07, in no census since 2026', 'Nobody: the bed sensor is faulty'], 2);
        if (i === 2) break;
        S.misses++; audio.sfxPlay('fail');
        await game.say('kai', ['Osei is on the census and in her bed. She isn\'t missing.', 'Bell\'s here, talking backward. He\'s the one who remembers.', '', 'A faulty sensor doesn\'t get eight thousand doses.'][i]);
      }
      for (;;) {
        const i = await choose('kai', 'Who made her disappear from the records?', ['Staff Nurse Okoye, who wrote "empty"', 'The Helix medical liaison', 'The hospital board'], 1);
        if (i === 1) break;
        S.misses++; audio.sfxPlay('fail');
        await game.say('kai', ['Okoye wrote it down. Somebody told her to write "empty". She said so.', '', 'The board signs what Helix sends it. Somebody sent it.'][i]);
      }
      deduced = true; F.m11missing = '4-07'; F.m11deductionMisses = S.misses;
      audio.sfxPlay('success');
      await game.talk([
        ['kai', 'A woman nobody admitted, in a bed nobody counts, fed by Helix for twenty-three years. Name withheld.'],
        ['kai', 'Her file went to Restricted Records. Drawer 4-07.'],
        ['raman', 'That vault has a Helix lock on it. Since the nineteenth it\'s been… running backward too. Our technician gave up.'],
      ]);
      ev('The missing patient', 'Compared on the incident board: the census, the bed sensor, the pharmacy log and the 2026 night book all describe a woman in bay 4-07 that no record admits. Helix withheld her name. Her file is in Restricted Records, drawer 4-07.', 'DEDUCTION');
      cine(false);
    } });
    await game.waitFor(() => deduced);

    // =====================================================================================
    // THE REVERSING LOCK: dismantle it in the correct order
    // =====================================================================================
    objective('Open Restricted Records: dismantle the reversing lock in the right order · Residue Vision (F) may help');
    game.checkpoint(48.6, 0, -22, -Math.PI / 2);
    const LK = W.lock, ORDER = ['seal', 'upper', 'lower', 'cam', 'core'];
    let removed = [], lockOpen = false;
    game.interact({ pos: [47.0, 1.3, -22], radius: 1.9, prompt: 'Read the work order', onUse: async () => {
      cine(true); pl.place(47.6, 0, -22.6, -Math.PI / 2); await game.shot([47.4, 1.5, -23.6], [46.2, 1.3, -24.4], 1.0, { fov: 30 });
      await game.talk([['kai', 'A Helix work order. Fitted on the nineteenth: core pin, cam plate, lower bolt, upper bolt, seal ring.'], ['kai', '"Inside the zone it only comes apart the way it went together." Backward.']]);
      F.m11workOrder = true; S.knowOrder = true; cine(false);
    } });
    game.onUpdate(() => { if (game.residueOn && near(46.6, -22, 4) && once('techEcho')) { ui.subtitle('kai', 'A technician, fitting the lock. Watch the order she puts it together.', 3400); S.knowOrder = true; } });
    // the residue technician mutters the fit order on a loop; each part glows as she fits it
    let techT = 0;
    const FIT = ['core', 'cam', 'lower', 'upper', 'seal'], FIT_NAME = { core: 'Core pin.', cam: 'Cam plate.', lower: 'Lower bolt.', upper: 'Upper bolt.', seal: 'Seal ring. Done.' };
    const partGlow = new Map(LK.parts.map(p => [p.id, p.mesh.material]));
    game.onUpdate(dt => {
      if (lockOpen) return;
      const show = game.residueOn && near(46.6, -22, 5);
      techT = show ? techT + dt : 0;
      const k = Math.floor(techT / 2.4) % 6;
      LK.parts.forEach((p) => { const m = partGlow.get(p.id); if (m.emissive) { m.emissive.setHex(0x9fe8ff); m.emissiveIntensity = show && FIT[k] === p.id ? 1.2 : 0; } });
      if (show && Math.abs(techT % 2.4) < dt * 1.01 && k < 5) ui.subtitle('techghost', FIT_NAME[FIT[k]], 2000);
    });
    const partBack = async () => {
      audio.sfxPlay('rewind'); game.shake = 0.12; shiftPulse = 0.35;
      const list = LK.parts.filter(p => p.removed);
      await tween(0.7, u => { for (const p of list) p.mesh.position.lerpVectors(p.out, p.home, u); });
      for (const p of list) { p.removed = false; p.mesh.position.copy(p.home); }
      game.shake = 0; removed = []; musicState.lock = 0;
    };
    game.interact({ pos: [46.6, 1.3, -22], radius: 1.8, once: false, prompt: 'Work the reversing lock', enabled: () => !lockOpen, onUse: async () => {
      if (lockOpen) return;
      lockMusic('m11-lock', 1);
      cine(true); pl.place(47.3, 0, -23.0, -Math.PI / 2); await game.shot([48.0, 1.55, -21.2], [46.16, 1.3, -22], 0.9, { fov: 30 });
      const left = LK.parts.filter(p => !p.removed);
      const names = left.map(p => 'Take out the ' + p.name);
      const want = ORDER[removed.length], wantIdx = left.findIndex(p => p.id === want);
      const i = await choose('kai', removed.length ? 'Next part. ' + removed.length + ' of 5 out.' : 'Five parts on the drum. Which comes out first?', [...names, 'Step back'], wantIdx);
      if (i >= left.length) { cine(false); return; }
      const p = left[i];
      audio.sfxPlay('metal');
      await tween(0.5, u => { p.mesh.position.lerpVectors(p.home, p.out, u); });
      p.removed = true; removed.push(p.id);
      if (p.id !== want) {
        S.lockFails++; F.m11lockFails = S.lockFails;
        await game.wait(0.3);
        ui.toast('THE LOCK REVERSED\nEvery part you took out went back where it was', 2600);
        await partBack();
        const hints = ['Wrong. It put itself back together. Everything I took out.', 'It only comes apart in one order. Last in, first out — the plate\'s written backward.', S.knowOrder ? 'The work order. The technician. Reverse what she did.' : 'Somebody fitted this. The work order on the wall… or her residue, if it\'s still here.'];
        await game.say('kai', hints[Math.min(S.lockFails - 1, 2)]);
        cine(false); return;
      }
      musicState.lock = removed.length;
      if (removed.length < 5) { await game.say('kai', ['The seal ring. It stayed out.', 'Upper bolt. Holding.', 'Lower bolt.', 'Cam plate. One left.'][removed.length - 1]); cine(false); return; }
      // open
      lockOpen = true; F.m11lock = true;
      LK.lamp.material.color?.setHex(0x000000); LK.lamp.material.emissive?.setHex(0x6aff9a);
      audio.sfxPlay('success'); audio.sfxPlay('door');
      zLock.dir0 = 1;
      await game.shot([49.2, 1.8, -19.6], [46, 1.3, -22], 1.0, { fov: 46 });
      await tween(1.6, u => { W.vaultDoor.position.z = -22 - 2.9 * u; LK.g.position.z = -22 - 2.9 * u; });
      W.vaultBox.enabled = false;
      await game.say('kai', 'Core pin. And it stays apart.');
      cine(false); lockMusic(null);
    } });
    hint(() => !lockOpen && near(47, -22, 5), 60, () => ui.subtitle('kai', S.knowOrder ? 'Reverse the fit order. Seal ring first.' : 'Read the work order, or look with Residue Vision.', 3000));
    await game.waitFor(() => lockOpen);
    game.checkpoint(...P.vaultIn);
    objective('Find drawer 4-07 in Restricted Records');

    // =====================================================================================
    // MIRA'S FILE
    // =====================================================================================
    let opened = false;
    game.interact({ pos: [39.0, 1.2, -20.2], radius: 1.8, prompt: 'Open drawer 4-07', onUse: () => { opened = true; } });
    hint(() => zone === 'vault' && !opened, 40, () => ui.subtitle('kai', 'Drawer 4-07. West wall, chest height.', 2600));
    await game.waitFor(() => opened);
    cine(true); lockMusic('m11-mira', 2.4);
    pl.place(40.4, 0, -21.4, Math.PI / 2);
    audio.sfxPlay('door');
    await game.shot([40.6, 1.6, -19.0], [38.6, 1.2, -20.2], 1.2, { fov: 40 });
    await tween(0.8, u => { W.drawer.position.x = 38.32 + 0.45 * u; });
    await game.say('kai', 'One slim file. And a terminal that wants it.');
    pl.place(40.6, 0, -23.4, Math.PI);
    W.screens.file.material.color.setScalar(1.15);
    await game.shot([41.3, 1.6, -22.6], [40.6, 1.4, -24.84], 1.6, { fov: 34 });
    await game.talk([
      ['records', 'Record four-zero-seven. Varen, Mira.'],
      ['records', 'Record integrity check.'],
    ]);
    audio.silence(1.0); await game.wait(1.0);
    await game.say('records', 'Temporal discontinuity.');
    await game.shot([40.85, 1.5, -24.25], [40.6, 1.42, -24.84], 1.4, { fov: 24 });
    await game.talk([
      ['kai', 'Age: thirty-two. Admitted the nineteenth of October, 2026. Eight-fourteen.'],
      ['kai', 'This record was made twenty-three years ago. She was ten years old.'],
      ['kai', 'Thirty-two is my age. Now.'],
    ]);
    await game.shot([40.75, 1.32, -24.4], [40.72, 1.24, -24.84], 1.4, { fov: 18 });
    await game.say('kai', 'Date of death…');
    audio.silence(2.0); await game.wait(2.0);
    await game.say('kai', 'Blank.');
    F.m11miraFile = true; F.miraFileAge = 32; F.miraDeathBlank = true;
    ev('Restricted record 4-07: VAREN, MIRA', 'Helix custody, drawer 4-07. Varen, Mira, F. Age 32. Admitted 19.10.2026 at 08:14 to Ward 4, bay 7. Record created 19.10.2026, twenty-three years before the present, when Mira was ten. Next of kin: Varen, K. Date of death: blank. Integrity: temporal discontinuity.', 'RESTRICTED RECORDS · HELIX');
    await game.shot([42.6, 1.7, -21.0], [40.6, 1.3, -23.8], 2.0, { fov: 44 });
    await game.talk([
      ['kai', 'They gave us a date. They gave us a box to bury.'],
      ['kai', 'And all this time they kept her bed made and fed it every night.'],
    ]);

    // ---------- the East Wing lets go; bay 4-07 one last time ----------
    await ui.fade(1, 1400);
    for (const tr of corrTracks) { tr.frozen = true; inv.remove(tr); tr.tele.visible = false; }
    for (const z of [zCorr, zWard]) z.dir0 = 1;
    inv.unlock(false); inv.enabled = false;
    pl.place(53.6, 0, -8.6, Math.PI); kai.lookTarget = null;
    W.screens.monitor.material.map = TEX.monitor(false); W.screens.monitor.material.needsUpdate = true; wardDark = 0.3;
    miraGhost.root.visible = true; miraGhost.pose = 'sit';
    const gm = miraGhost.ghostMat; if (gm?.uniforms?.uAlpha) gm.uniforms.uAlpha.value = 0;
    applyZone('ward');
    await game.shot([55.2, 1.6, -8.2], [53.6, 1.0, -12.2], 0.01, { fov: 40 });
    await ui.fade(0, 1600);
    audio.sfxPlay('heartbeat');
    await tween(2.2, u => { if (gm?.uniforms?.uAlpha) gm.uniforms.uAlpha.value = u * 0.75; });
    miraGhost.lookTarget = kai.head; F.m11sawMira = true;
    await game.shot([53.9, 1.25, -9.6], [53.6, 1.05, -12.5], 2.4, { fov: 30 });
    if (audio.ctx) audio.tone(988, 0.14, 'sine', 0.18, audio.sfx, audio.ctx.currentTime, 0.004);
    await game.wait(1.0);
    await game.say('kai', 'Mira?');
    await tween(1.8, u => { if (gm?.uniforms?.uAlpha) gm.uniforms.uAlpha.value = 0.75 * (1 - u); });
    miraGhost.root.visible = false;
    await game.wait(0.6);
    raman.root.position.set(51.2, 0, -6.4); raman.root.rotation.y = 2.4; raman.lookTarget = kai.head; kai.lookTarget = raman.head;
    await game.shot([56.2, 1.7, -7.2], [52.4, 1.5, -7.6], 1.4, { fov: 40 });
    await game.talk([
      ['raman', 'Varen. The corridor — the gurney\'s just standing there. The East Wing is running forward again. All of it.'],
      ['kai', 'Not all of it.'],
      ['raman', 'What was in the drawer?'],
      ['kai', 'My sister. Thirty-two years old in 2026. And nobody ever wrote down that she died.'],
    ]);
    await game.shot([47.6, 2.8, 8.6], [56, 1.0, -10], 4.6, { fov: 50 });
    await ui.fade(1, 2400);
    const mins = Math.round((game.time - tStart) / 60);
    await ui.chapterCard('MISSION 11 COMPLETE', 'The Inverted Hospital', `Inversion learned · Mira's file: age 32, death date blank · Shards ${S.shards}/5${F.m11bell === 'forward' ? ' · Mr. Bell heard forward' : ''}${mins ? ' · ' + mins + ' min' : ''}`, 3800);
    F.m11done = true; F.m11shards = S.shards; F.m11records = [...S.records];
    inv.dispose(); echo?.dispose();
    game.releaseCam(); ui.letterbox(false); audio.allBeds(0); audio.setTheme(null);
  },
};
