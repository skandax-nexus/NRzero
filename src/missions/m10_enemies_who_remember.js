// MISSION 10 · ENEMIES WHO REMEMBER (Act II) — introduce faction conflict and Echo Step.
// Bible beats: escape a detention block using stealth · switch power systems across states to distract guards ·
// use a captured temporal weapon · fight through a testing chamber · choose whether to release prisoners trapped in
// unstable loops. Quote: "In my time, your face is on every memorial." / "For saving the world?" / "For ending it."
// Ending: Kai unlocks Echo Step, a limited-use temporal afterimage.
// The Continuum (2196) has taken Kai after the nine-minute city let him go; they remember sixteen versions of him.
// Block D4 is built into the ruin of Helix Sub-Level 4: the 2049 substation still feeds the Continuum's cells.
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { Combat } from '../systems/combat.js';
import { EchoStep } from '../systems/echostep.js';
import { buildBlock, registerM10Cast, registerM10Themes, musicState, P, KAI_CELL, SERA_CELL, TEO_CELL, TC, LOOP_ANG, loopCellPos, SHARDS, TROOPER, TROOPER_F, PRISONERS, TEX } from '../world/env_m10.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export default {
  id: 'm10', act: 'ACT II · THE NINE-MINUTE WAR', title: 'Enemies Who Remember', sub: 'Continuum detention · 2196',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time, tok = game.token;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM10Cast(); registerM10Themes();
    try {
      const need = ['prefect', 'teo', 'trooper', 'looper', 'sera'].filter(id => !ui.portraits[id] && CAST[id]?.look);
      if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]]))));
    } catch (err) { console.warn('m10 portraits', err); }

    const scene = game.newScene({ background: 0x07080a, fog: [0x0c0d10, 0.018], exposure: 1.05, bloom: 0.55, bloomThreshold: 0.86, envIntensity: 0.6, killY: -8, residue: false });
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    const Q = RZ.getQuality(), low = Q === 'low';
    game.onUpdate(dt => RZ.update(dt));
    await tick();
    const W = buildBlock(game, scene);
    game.onUpdate((dt, t) => W.update(dt, t));
    await tick();

    // ---------- environment light ----------
    let dusk = null, interior = null, interior49 = null;
    try {
      dusk = RZ.skyEnvironment(renderer, scene, { preset: 'sunset', cover: 0.55, turbidity: 6, azimuth: 70, elevation: 2.5, glow: 0x6a3a24, apply: false });
      interior = RZ.skyEnvironment(renderer, scene, { preset: 'interior', color: 0xffecd0, wall: 0x2a2a2c, window: 0x6a5a40, apply: false });
      interior49 = RZ.skyEnvironment(renderer, scene, { preset: 'interior', color: 0xeaf2ff, wall: 0x30363e, window: 0x6a7a90, apply: false });
    } catch (err) { console.warn('m10 sky', err); }
    const hemi = new THREE.HemisphereLight(0xb8c4d0, 0x18181a, 0.32); scene.add(hemi);
    const key = new THREE.SpotLight(0xfff0d8, 60, 18, 0.95, 0.6, 1.5); key.castShadow = !low;
    key.shadow.mapSize.set(Q === 'high' ? 1024 : 512, Q === 'high' ? 1024 : 512); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; scene.add(key, key.target);
    const pts = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    const zoneOf = (p) => p.x >= 113.6 ? 'out' : p.x > 85.4 ? 'shaft' : Math.hypot(p.x - TC[0], p.z - TC[1]) < 19 ? 'test' : p.x > 24 ? 'spine'
      : p.z < -9.1 ? (p.x < 0 ? 'pow' : 'arm') : 'gal';
    const ZONE = {
      gal: { fog: [0x0e0f12, 0.02], env: 0.6, hemi: [0xc8ccd0, 0x18181a, 0.3], exp: 1.05 },
      pow: { fog: [0x0c0d10, 0.026], env: 0.55, hemi: [0xa8b0b8, 0x141416, 0.28], exp: 1.05 },
      arm: { fog: [0x0e0f12, 0.024], env: 0.6, hemi: [0xc8ccd0, 0x18181a, 0.3], exp: 1.05 },
      spine: { fog: [0x0e0f12, 0.02], env: 0.6, hemi: [0xc8ccd0, 0x18181a, 0.3], exp: 1.05 },
      test: { fog: [0x101012, 0.012], env: 0.65, hemi: [0xd8d4c8, 0x1a1a1c, 0.32], exp: 1.05 },
      shaft: { fog: [0x16120e, 0.02], env: 0.6, hemi: [0xc8b8a0, 0x141210, 0.32], exp: 1.08 },
      out: { fog: [0x5a3a2c, 0.0035], env: 0.9, hemi: [0xffb080, 0x2a2420, 0.45], exp: 1.1 },
    };
    let zone = null, lightT = 0, forceZone = null;
    const applyZone = (z) => {
      zone = z; const c = ZONE[z];
      scene.fog.color.set(c.fog[0]); scene.fog.density = c.fog[1];
      const outside = z === 'out' || z === 'shaft' || forceZone === 'out';
      if (dusk) scene.background = outside ? dusk.background : new THREE.Color(0x07080a);
      const e = outside && z === 'out' ? dusk : T.current === '2049' ? interior49 : interior;
      if (e) { scene.environment = e.envMap; scene.environmentIntensity = c.env; }
      hemi.color.set(c.hemi[0]); hemi.groundColor.set(c.hemi[1]); hemi.intensity = c.hemi[2];
      renderer.toneMappingExposure = c.exp;
      W.ext.visible = outside;
      audio.hum(z === 'test' ? 0.14 : z === 'pow' && T.current === '2049' ? 0.2 : 0.07, z === 'pow' ? 50 : 44);
      audio.wind(z === 'out' ? 0.35 : z === 'shaft' ? 0.16 : 0);
      lightT = 0;
    };
    const power = { A: true, B: true, C: true };   // 2049 breakers: true = live
    const rigLights = () => {
      const p = game.cine ? game.engine.camera.position : pl.pos;
      const z = zone || 'gal', era = T.current;
      const list = W.lightSrc.filter(s => (!s.era || s.era === era) && (s.zone === z || Math.hypot(s.p[0] - p.x, s.p[2] - p.z) < 14))
        .map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      const emergency = era === '2196' && !power.A && (z === 'gal');
      const k = list[0];
      if (k) { key.position.set(...k.p); key.target.position.set(k.p[0], 0, k.p[2] - 0.5); key.color.set(emergency ? 0xff5a4a : k.c); key.intensity = k.i * (emergency ? 1.6 : 3.0); key.distance = k.d * 1.6; }
      pts.forEach((l, i) => { const s = list[i + 1]; if (!s) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(emergency ? 0xff6a5a : s.c); l.intensity = s.i * (emergency ? 0.5 : 1); l.distance = s.d; });
    };
    game.onUpdate(dt => {
      const z = forceZone || zoneOf(game.cine ? game.engine.camera.position : pl.pos); if (z !== zone) applyZone(z);
      lightT -= dt; if (lightT <= 0) { lightT = 0.45; rigLights(); }
    });

    // ---------- temporal states ----------
    let musicLock = null, mood = 'm10-cell';
    const themeFor = () => musicLock || mood;
    const music = (fade = 1.6) => { for (const d of T.defs) d.theme = themeFor(); audio.setTheme(themeFor(), fade); };
    const setMood = (m, fade) => { mood = m; if (!musicLock) music(fade); };
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    T.configure([
      { id: '2049', key: '1', name: 'HELIX', year: 'SL4 · 2049', glyph: '◎', color: '#5fe6ff', theme: 'm10-cell', apply: () => { W.M.shell.color.set(0xffffff); applyZone(zone || 'gal'); } },
      { id: '2196', key: '2', name: 'CONTINUUM', year: 'BLOCK D4 · 2196', glyph: '✦', color: '#ffd27a', theme: 'm10-cell', apply: () => { W.M.shell.color.set(0xc8c0b4); applyZone(zone || 'gal'); } },
    ], '2196');
    T.unlocked = false;

    // ---------- state ----------
    const S = { shards: 0, seen: {}, restrained: 0, ev: new Set(), section: 'cell' };
    const C = new Combat(game, {
      hp: 4, darkness: () => (!power.A && zone === 'gal' ? 0.65 : 0),
      onDown: () => { C.fail('YOU WERE STUNNED · THE CONTINUUM DRAGS YOU BACK'); },
      onCaught: () => { C.fail('CAPTURED'); },
      onState: (e, s) => { if (s === 'alert' && !C.weapon.owned && !game._failing && S.stealthFail) { S.spotted = (S.spotted || 0) + 1; C.fail('SPOTTED · THE CONTINUUM PUTS YOU BACK'); } },
      onRestrain: () => { S.restrained++; },
      onTakedown: () => { S.restrained++; ui.subtitle('kai', 'Sleep. Nobody\'s dying today.', 2000); },
    });
    const echo = new EchoStep(game, { combat: C, cost: 0.3, cooldown: 6, linger: 4.5 });
    window.__m10 = { S, W, C, echo, power };
    const near = (x, z, r) => Math.hypot(pl.pos.x - x, pl.pos.z - z) < r;
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag) => { S.ev.add(title); ui.addEvidence(title, text, tag); };
    const choose = (id, text, opts) => { if (game.autoplay && game.autoQueue?.length) game.autoChoice = game.autoQueue.shift(); return game.choice(id, text, opts); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const walkTo = (ch, to, dur) => new Promise(res => {
      if (!ch) { res(); return; }
      const from = ch.root.position.clone(), tgt = V(...to), dist = from.distanceTo(tgt); let u = 0;
      const off = game.onUpdate(dt => {
        u = Math.min(1, u + dt / dur); ch.root.position.lerpVectors(from, tgt, u);
        ch.speed = u < 1 ? dist / dur : 0; if (u < 0.98 && dist > 0.05) ch.faceTowards(tgt.x, tgt.z, dt, 8);
        if (u >= 1) { off(); ch.speed = 0; res(); }
      });
    });
    let shiftPulse = 0;
    game.onUpdate(dt => { if (shiftPulse > 0) { shiftPulse = Math.max(0, shiftPulse - dt * 1.4); game.engine.fx.uShift.value = shiftPulse; } });

    // ---------- people (2196 only unless noted; visibility follows the era) ----------
    const people = [];
    const person = (ch, era = '2196') => { people.push({ ch, era, on: true }); return ch; };
    game.onUpdate(() => { for (const p of people) p.ch.root.visible = p.on && (!p.era || p.era === T.current); });
    const show = (ch, on) => { const p = people.find(q => q.ch === ch); if (p) p.on = on; };
    const kai = pl.char;
    // Continuum armour details on top of the human (helmet with the gold visor slit, stabilizer fins, gorget)
    const pearlM = W.mats.pearl, goldM = W.mats.gold;
    const visorM = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false });
    const attachRigid = (ch, bone, obj, off) => {
      ch.root.updateMatrixWorld(true);
      const target = bone || ch.root;
      const rq = ch.root.getWorldQuaternion(new THREE.Quaternion());
      const wp = (bone ? bone.getWorldPosition(V()) : ch.root.getWorldPosition(V())).add(off.clone().applyQuaternion(rq));
      const wm = new THREE.Matrix4().compose(wp, rq, V(1, 1, 1));
      const local = target.matrixWorld.clone().invert().multiply(wm);
      local.decompose(obj.position, obj.quaternion, obj.scale); target.add(obj);
    };
    const armour = (ch, kind) => {
      if (/contin/.test(ch.template || '')) return;           // the costume build already wears the suit
      try {
        const g = new THREE.Group();
        if (kind === 'trooper') {
          const helm = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 14), pearlM); helm.scale.set(1, 1.12, 1.15); helm.position.set(0, 0.11, 0.0); g.add(helm);
          const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.022, 0.05), visorM); visor.position.set(0, 0.105, 0.14); g.add(visor);
          const chin = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.07, 0.1), pearlM); chin.position.set(0, 0.0, 0.1); g.add(chin);
          const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.14), goldM); fin.position.set(0, 0.25, -0.03); g.add(fin);
        }
        const gor = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 20), pearlM); gor.rotation.x = Math.PI / 2; gor.position.set(0, -0.06, 0.0); g.add(gor);
        attachRigid(ch, ch.head || null, g, ch.head ? V(0, 0, 0) : V(0, 1.62, 0));
        const back = new THREE.Group();
        for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.12), pearlM); f.position.set(s * 0.09, 0, 0); f.rotation.z = s * 0.25; back.add(f); const e = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.3, 0.012), goldM); e.position.set(s * 0.09, 0, -0.06); e.rotation.z = s * 0.25; back.add(e); }
        if (kind === 'officer') { const rank = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), goldM); rank.position.set(0.0, 0.2, 0.28); back.add(rank); }
        attachRigid(ch, ch.chest || ch.spine || null, back, ch.chest || ch.spine ? V(0, 0.05, -0.17) : V(0, 1.3, -0.17));
      } catch (err) { console.warn('m10 armour', err); }
    };
    // Kai's suppression collar
    const collar = new THREE.Group();
    { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 8, 24), new THREE.MeshStandardMaterial({ color: 0x202328, roughness: 0.4, metalness: 0.6 })); ring.rotation.x = Math.PI / 2; collar.add(ring);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4d5e, toneMapped: false })); led.position.set(0, 0, 0.08); collar.add(led); }
    try { attachRigid(kai, kai.neck || kai.head || null, collar, kai.neck || kai.head ? V(0, -0.02, 0.01) : V(0, 1.52, 0)); } catch (err) { console.warn('m10 collar', err); }

    const sera = person(game.actor('sera', null, 2.6, 0, 7.6, -Math.PI / 2)); sera.pose = 'sad';
    const prefect = person(game.actor('prefect', null, -12, 0, 1.2, Math.PI / 2)); armour(prefect, 'officer');
    await tick();
    const teo = person(game.actor('teo', null, 16.4, 0, 7.8, Math.PI)); teo.pose = 'sad';
    const cellmate = person(game.ambient({ ...PRISONERS[0] }, 7.4, 0, 7.6, Math.PI)); cellmate.pose = 'sad';
    await tick();
    const troopers = [];
    const mkTrooper = (i) => {
      if (troopers[i]) return troopers[i];
      const look = { ...(i % 3 === 2 ? TROOPER_F : TROOPER), seed: 400 + i, skin: [0xd9a585, 0x8c5a3a, 0xe8b996, 0xb98463, 0x6b4029][i % 5] };
      const ch = game.ambient(look, 0, -60, 0, 0); armour(ch, 'trooper'); person(ch); troopers[i] = ch; return ch;
    };
    for (let i = 0; i < 3; i++) { mkTrooper(i); await tick(); }
    const placeCh = (ch, x, z, yaw = 0) => { ch.root.position.set(x, 0, z); ch.root.rotation.y = yaw; ch.frozen = false; ch.pose = null; ch.crouch = 0; show(ch, true); };
    const parkCh = (ch) => { ch.root.position.set(0, -60, 0); show(ch, false); };
    const enemy = (i, x, z, yaw, o = {}) => {
      const ch = mkTrooper(i); const old = C.enemies.find(q => q.char === ch); if (old) C.removeEnemy(old); placeCh(ch, x, z, yaw);
      const e = C.addEnemy(ch, { states: ['2196'], voice: 'trooper', barks: BARKS, yaw, ...o }); return e;
    };
    const CH_BARKS = {
      spot: ['Assessment contact. Engage.', 'Intake seventeen, by the barriers!', 'He is in the old year again — watch the gaps!'],
      search: ['He shifted. Hold the ring.', 'Where did he go? Sweep the benches.'],
      lost: ['Holding.'],
      yield: ['I yield! The assessment is over for me.', 'Down — I\'m down.'],
    };
    const BARKS = {
      spot: ['Contact! Intake seventeen!', 'There — by the pillars!', 'Varen is out of his cell!'],
      search: ['He was here. Spread out.', 'Check the shadows. He likes the shadows.', 'Lost him. Again.'],
      lost: ['Nothing. Back to the line.', 'Holding the line.'],
      yield: ['Enough — I yield. I yield!', 'Down. I\'m down. Don\'t freeze me again.'],
    };

    // ---------- era rules in the block: dampers in 2049, no switching into solid matter ----------
    let drainK = 0.12, dampWarn = false;
    const solidIn = (state) => {
      const p = pl.pos;
      for (const b of game.collision.boxes) {
        if (!b.enabled || !b.states || !b.states.includes(state) || b.walkOnly) continue;
        if (p.x + 0.3 > b.min.x && p.x - 0.3 < b.max.x && p.z + 0.3 > b.min.z && p.z - 0.3 < b.max.z && p.y + 1.6 > b.min.y && p.y + 0.3 < b.max.y) return true;
      }
      return false;
    };
    game.onUpdate(dt => {
      if (!T.unlocked) { T.locked = false; return; }
      const other = T.current === '2049' ? '2196' : '2049';
      const blocked = solidIn(other);
      T.locked = blocked || S.eraLock;
      if (blocked && game.control && (game.input.hit('Digit1') || game.input.hit('Digit2') || game.input.hit('KeyQ')) && once('solidTip' + Math.floor(game.time / 6))) ui.toast(`SOLID MATTER HERE IN ${other} · MOVE CLEAR TO SHIFT`, 1800);
      if (T.current === '2049' && game.control && !ui.dlgActive && !T.switching) {
        T.stability = Math.max(0, T.stability - dt * drainK);
        if (!dampWarn && T.stability < 0.35) { dampWarn = true; ui.toast('CONTINUUM DAMPERS · STABILITY FALLING', 1800); }
        if (T.stability < 0.08 && !solidIn('2196')) { dampWarn = false; ui.toast('THE DAMPERS PULL YOU BACK TO 2196', 2000); T.switchTo('2196', { force: true, free: true }); }
      } else if (T.current === '2196') dampWarn = false;
    });

    // ---------- shards ----------
    const SHARD_TXT = [
      ['Temporal shard: the bunk', 'Under the bunk in cell 3, wedged where sixteen other prisoners never looked: a shard of crystallised time.'],
      ['Temporal shard: the substation', 'Behind the 2049 transformer, humming at the same pitch as the copper: a shard of crystallised time.'],
      ['Temporal shard: the armoury', 'Behind the Continuum weapon racks: a shard of crystallised time.'],
      ['Temporal shard: the alcove', 'In a 2049 maintenance alcove the Continuum later bricked shut: a shard of crystallised time.'],
      ['Temporal shard: the observation window', 'Under the Prefect\'s window in Chamber Two: a shard of crystallised time.'],
    ];
    SHARDS.forEach(([x, y, z, era], i) => {
      game.interact({ pos: [x, Math.max(1.0, y + 0.4), z], radius: 1.7, prompt: 'Take the temporal shard', states: [era], onUse: () => {
        const m = W.shardMeshes[i]; m.parent?.remove(m);
        S.shards++; F.shards = (F.shards || 0) + 1; F.m10shards = S.shards;
        audio.sfxPlay('anomaly'); ev(SHARD_TXT[i][0], SHARD_TXT[i][1], 'TEMPORAL SHARD · ' + S.shards + '/5');
      } });
    });

    // ---------- doors ----------
    game.onUpdate(() => {
      W.doors.vault.target = !power.C ? 1 : 0;
      W.doors.armoury.target = S.armouryOpen ? 1 : 0;
      W.doors.east.target = S.eastOpen ? 1 : 0;
      W.doors.chamber.target = (S.chamberOpen && near(55.2, 0, 4.5) && !S.inChamber) ? 1 : 0;
      W.doors.exit.target = S.exitOpen ? 1 : 0;
    });
    const setBars = (i, on) => { W.bars[i].userData.off = !on; W.bars[i].visible = on && T.current === '2196'; W.bars[i].userData.states = on ? ['2196'] : []; W.barBoxes[i].enabled = on; };

    // ---------- Sera follows (2196 only) ----------
    let seraFollow = false, seraWas = false;
    const seraV = V();
    game.onUpdate((dt) => {
      if (!seraFollow || game.cine || T.current !== '2196') { if (seraFollow || seraWas) sera.speed = 0; seraWas = false; return; }
      seraWas = true;
      const fw = V(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
      const tgt = pl.pos.clone().addScaledVector(fw, -1.8).add(V(Math.cos(pl.yaw) * 0.9, 0, -Math.sin(pl.yaw) * 0.9));
      const p = sera.root.position, d = Math.hypot(tgt.x - p.x, tgt.z - p.z);
      if (d > 16) { p.set(tgt.x, 0, tgt.z); return; }
      sera.crouch += ((pl.crouching ? 1 : 0) - sera.crouch) * Math.min(1, dt * 6);
      if (d > 0.6) {
        const sp = Math.min(d > 4 ? 5.2 : 3.0, d * 3); const before = p.clone();
        p.x += (tgt.x - p.x) / d * sp * dt; p.z += (tgt.z - p.z) / d * sp * dt;
        game.collision.resolve(p, seraV.set(0, 0, 0), 0.3, 1.7, '2196', dt, 0); p.y = 0;
        sera.speed = Math.hypot(p.x - before.x, p.z - before.z) / Math.max(dt, 1e-3); sera.faceTowards(tgt.x, tgt.z, dt, 6);
      } else { sera.speed = 0; sera.faceTowards(pl.pos.x, pl.pos.z, dt, 3); }
    });

    // ---------- checkpoints ----------
    const cp = (x, z, yaw, extra) => game.checkpoint(x, 0, z, yaw, () => { C.reset(); extra?.(); });

    // =====================================================================================================
    // OPENING: the Continuum spire over the Helix ruin, dusk 2196
    // =====================================================================================================
    ui.missionTag('MISSION 10 · ENEMIES WHO REMEMBER'); ui.show('hud', true);
    pl.place(...P.start); kai.pose = 'sad';
    cp(P.start[0], P.start[2], P.start[3]);
    forceZone = 'out'; applyZone('out'); rigLights();
    lockMusic(null); audio.setTheme(null);
    game.control = false; ui.letterbox(true);
    await game.shot([250, 34, 120], [70, 34, 0], 0.01, { fov: 48 });
    await ui.fade(0, 1800);
    setMood('m10-cell', 2);
    const cc = ui.chapterCard('ACT II · THE NINE-MINUTE WAR', 'Enemies Who Remember', 'Continuum Block D4 · beneath the ruin of Helix · Rain City · 2196', 4400);
    await game.shot([180, 26, 70], [70, 40, 0], 6.0, { fov: 44 });
    await cc;
    ui.subtitle('pa', 'Intake seventeen received. Subject Varen, K. Hold for assessment.', 3800);
    await game.shot([128, 18, 30], [70, 14, 0], 3.4, { fov: 40 });
    await ui.fade(1, 900);
    forceZone = null; applyZone('gal');
    // inside: the cell, through the bars
    prefect.root.position.set(-12, 0, 1.2); prefect.speed = 0;
    await game.shot([-2.4, 1.55, 1.2], [-2.6, 0.9, 6.6], 0.01, { fov: 46 });
    await ui.fade(0, 1200);
    audio.sfxPlay('door');
    await Promise.all([walkTo(prefect, [-2.4, 0, 2.5], 4.2), game.shot([-0.6, 1.7, 1.6], [-2.4, 1.3, 4.6], 4.2, { fov: 44 })]);
    prefect.faceTowards(-2.6, 6.6, 1, 1); prefect.lookTarget = kai.head || null;
    kai.pose = null; kai.lookTarget = prefect.head || null;
    await game.shot([-3.6, 1.55, 5.2], [-2.4, 1.6, 2.6], 1.6, { fov: 38 });
    await game.talk([
      ['prefect', 'Kai Varen. Awake at last.'],
      ['kai', 'Where is this? The city reset — I was at the tower. Nine minutes...'],
      ['prefect', 'The city resets. You don\'t, any more. That is why we could finally hold you.'],
      ['kai', 'Who\'s "we"?'],
    ]);
    await game.shot([-1.2, 1.7, 3.6], [-2.4, 1.62, 2.5], 1.4, { fov: 34 });
    await game.talk([
      ['prefect', 'The Continuum. One time. One line. Held.'],
      ['prefect', 'You have stood in this cell sixteen times, Varen. You walked out of it in four.'],
      ['kai', 'I\'ve never seen you before in my life.'],
      ['prefect', 'No. You never remember us.'],
    ]);
    audio.silence(1.0); await game.wait(0.8);
    await game.shot([-2.0, 1.66, 3.2], [-2.4, 1.62, 2.5], 1.2, { fov: 28 });
    await game.say('prefect', 'We remember you.');
    if (F.timelineVersion === 17 || F.m8version === 17) await game.say('prefect', 'Version seventeen. Your machine counts them too, I hear.');
    if (F.m8yara === 'saved') await game.say('prefect', 'And the physicist you pulled out of her second. Lind. She is on our list now.');
    if (F.m9ines) await game.talk([   // continuity with M9: Ines was on the ring with him
      ['kai', 'There was a woman with me on the tower. Ines Calder.'],
      ['prefect', 'The engineer took the stairs while we were taking you. She is not the one we came for.'],
    ]);
    await game.say('prefect', 'At first light the Assessor tests your binding in Chamber Two. Then we decide if there is an eighteenth.');
    prefect.lookTarget = null;
    walkTo(prefect, [-14, 0, 0.6], 4.5).then(() => { if (game.token === tok) parkCh(prefect); });
    await game.shot([-3.4, 1.4, 7.8], [-2.4, 1.2, 3.4], 2.6, { fov: 42 });
    kai.lookTarget = null;
    F.m10captured = true; F.metPrefect = true;
    ev('The Continuum', 'Prefect Ima Adair of the Continuum holds Kai in Block D4. "One time. One line. Held." They remember sixteen versions of him; he has escaped this block in four. "You never remember us. We remember you."', 'FACTION · CONTINUUM');
    cine(false);

    // =====================================================================================================
    // THE CELL: Sera through the vent, the collar
    // =====================================================================================================
    // gallery guards start their patrol (stealth rules: being seen before Kai is armed puts him back in the cell)
    const g1 = enemy(0, -18, 0.6, Math.PI / 2, { patrol: [[-18, 0.6], [18, 0.6]], wait: 3, speed: 1.15, range: 11 });
    const g2 = enemy(1, -21.0, -0.6, Math.PI / 2, { patrol: [[-21.0, -0.6]], range: 11, fov: 0.6 });
    const g3 = enemy(2, 17.2, -17.6, Math.PI - 0.3, { patrol: [[17.2, -17.6]], range: 7, fov: 0.55 });   // the armoury guard, watching the monitors
    S.stealthFail = true;
    objective('Search the cell');
    let tapT = 0;
    game.interact({ pos: [-1.6, 1.0, 8.9], radius: 1.6, prompt: 'Count the marks on the bunk', onUse: async () => {
      await game.talk([['kai', 'Tally marks. Scratched into the edge. Sixteen of them.'], ['kai', 'Some of them are in my handwriting.']]);
      F.m10tally = true; ev('Sixteen marks', 'The bunk in cell 3 carries sixteen scratched tally marks. Some are in Kai\'s own handwriting, though he has never been here.', 'CELL 3');
    } });
    game.interact({ pos: [P.conduit[0], 1.1, 9.0], radius: 1.4, prompt: 'Look at the old conduit box', enabled: () => !S.metSera, onUse: () => ui.subtitle('kai', 'Helix conduit. SL4. A hundred and forty-seven years old and still warm.', 3200) });
    const tapOff = game.onUpdate(dt => {
      if (S.metSera || !game.control) return; tapT += dt;
      if (tapT > 7 && once('tap1')) { ui.subtitle(null, '(tap · tap-tap · tap — from the vent by the floor)', 3000); audio.sfxPlay('clock'); objective('Answer the tapping at the vent'); }
      if (tapT > 7 && Math.floor(tapT) % 9 === 0 && Math.floor(tapT - dt) % 9 !== 0) audio.sfxPlay('clock');
    });
    game.interact({ pos: [P.vent[0], 0.9, P.vent[2]], radius: 1.7, prompt: 'Knock back on the vent', enabled: () => tapT > 4, onUse: () => { S.ventUse = true; } });
    hint(() => !S.ventUse && tapT > 7, 40, () => ui.subtitle('kai', 'The vent. Low on the right-hand wall.', 2400));
    await game.waitFor(() => S.ventUse);
    tapOff();
    cine(true); lockMusic('m10-sera', 1.4);
    pl.place(-0.75, 0, 7.4, Math.PI / 2); pl.crouching = true;
    sera.pose = null; sera.root.position.set(0.75, 0, 7.4); sera.root.rotation.y = -Math.PI / 2; sera.crouch = 1;
    sera.lookTarget = kai.head || null; kai.lookTarget = sera.head || null;
    await game.shot([-1.6, 1.0, 6.2], [0.4, 0.8, 7.4], 1.4, { fov: 40 });
    await game.talk([['sera', 'Seventeen. You awake?'], ['kai', 'Who\'s there?']]);
    const seraHead = () => { const h = sera.head ? sera.head.getWorldPosition(V()) : V(0.75, 1.25, 7.4); h.y = Math.max(0.7, Math.min(1.5, h.y + 0.06)); return h; };
    let sh = seraHead();
    // over Kai's shoulder, through the vent grate (the line of sight passes the open grate at x = 0)
    const ots = (h, fov, dur) => game.shot([h.x - 1.2, h.y + 0.26, h.z - 0.62], [h.x, h.y + 0.02, h.z], dur, { fov });
    await ots(sh, 36, 1.8);
    await game.talk([
      ['sera', 'Sera Voss. Cell four. I run the people the Continuum hasn\'t caught yet. Mostly.'],
      ['sera', 'They dragged you in shouting a name. Mira.'],
      ['kai', 'My sister. I\'m Kai. Kai Varen.'],
    ]);
    audio.silence(1.2); await game.wait(1.0);
    await game.talk([['sera', '...Say that again.'], ['kai', 'Kai Varen. Why?']]);
    sh = seraHead();
    await ots(sh, 28, 1.2);
    audio.sfxPlay('heartbeat');
    await game.say('sera', 'In my time, your face is on every memorial.');
    { const kh = kai.head ? kai.head.getWorldPosition(V()) : V(-0.33, 1.28, 7.4); await game.shot([kh.x + 1.18, kh.y + 0.2, kh.z + 0.55], [kh.x, kh.y, kh.z], 1.0, { fov: 30 }); }
    await game.say('kai', 'For saving the world?');
    await ots(sh, 24, 1.0);
    audio.silence(1.4); await game.wait(1.1);
    await game.say('sera', 'For ending it.');
    await game.wait(0.8);
    await game.shot([-1.8, 1.3, 6.6], [0.2, 0.9, 7.6], 2.0, { fov: 40 });
    await game.talk([
      ['sera', 'Doesn\'t matter in here. They put a collar on you because you can do the thing. Walk between years.'],
      ['kai', 'The binding. It\'s dead. I can\'t feel it.'],
      ['sera', 'The collar damps it. There\'s old Helix conduit behind your bunk. Still live, God knows why. Short the collar on it.'],
      ['sera', 'Then walk out through whatever this place used to be. And come back for me, memorial man.'],
    ]);
    S.metSera = true; F.m10metSera = true; F.metSera = true;
    sera.lookTarget = null; kai.lookTarget = null; sera.crouch = 0; sera.pose = 'sad'; sera.root.position.set(2.6, 0, 7.6);
    ev('Sera Voss', 'A survivor leader held in cell 4. In her time Kai\'s face is on every memorial, not for saving the world but for ending it. She told him to short the collar on the old Helix conduit and come back for her.', 'CAST · 2196');
    lockMusic(null); setMood('m10-cell'); cine(false); pl.crouching = false;

    objective('Short the suppression collar on the old conduit (hold E)');
    game.interact({ pos: [P.conduit[0], 1.1, 9.0], radius: 1.5, hold: 1.4, prompt: 'Short the collar on the conduit', onUse: () => { S.collarOff = true; } });
    hint(() => !S.collarOff, 45, () => ui.subtitle('sera', 'Behind your bunk. The rusted box. Collar to the contacts.', 2800));
    await game.waitFor(() => S.collarOff);
    cine(true);
    await game.shot([-2.2, 1.5, 7.4], [P.conduit[0], 1.2, 9.3], 1.0, { fov: 38 });
    audio.sfxPlay('spark'); game.shake = 0.08; shiftPulse = 0.7; kai.wristBoost = 10;
    await game.wait(0.8); audio.sfxPlay('boom'); game.shake = 0;
    collar.parent?.remove(collar);
    await game.say('kai', 'Agh — there. It\'s gone quiet. And the binding... there it is.');
    T.unlocked = true; T.refreshHud();
    ui.toast('TEMPORAL SWITCHING RESTORED\n1 · HELIX 2049    2 · CONTINUUM 2196', 3400);
    await game.talk([
      ['kai', 'Two times in one room. In 2049 this was Helix\'s archive. No bars.'],
      ['sera', 'Their dampers bleed you if you sit in the old year. Don\'t stay long.'],
    ]);
    ev('Suppression collar', 'Kai burnt out the Continuum\'s collar on a live 2049 Helix conduit. Switching is back: 2049 (Helix SL4, the archive) and 2196 (Block D4). In 2049 the Continuum\'s dampers drain stability; when it runs out, they pull Kai back.', 'SYSTEM');
    cine(false);
    cp(-2.2, 6.2, Math.PI);

    // =====================================================================================================
    // STEALTH: out of the cell through 2049, along the pillars, into the substation
    // =====================================================================================================
    objective('Walk out of your cell through 2049 (1)');
    setMood('m10-stealth');
    hint(() => !S.outOfCell && T.current === '2196', 30, () => ui.subtitle('kai', 'In 2049 there are no bars. Switch, then walk.', 2600));
    await game.waitFor(() => pl.pos.z < 3.0);
    S.outOfCell = true;
    if (T.current === '2049') {
      await game.talk([['kai', 'Helix sealed this bay at 08:14. I can\'t get any further in 2049.'], ['kai', 'Back to 2196 behind a pillar. Then the substation door, north-west.']]);
    }
    objective('Return to 2196 behind cover, then reach the substation door (north-west) unseen');
    ui.toast('CROUCH (C) TO STAY LOW · PILLARS BLOCK THEIR VISORS', 2800);
    cp(-0.2, -5.9, Math.PI);
    hint(() => !near(P.powerDoor[0], P.powerDoor[2], 3), 70, () => ui.subtitle('sera', 'North side, behind the pillars. Their visors don\'t see through concrete.', 3000));
    // the loop-aware guard: a bark the first time Kai is near g1 unseen
    game.onUpdate(() => { if (!S.loopBark && T.current === '2196' && g1.state === 'patrol' && Math.hypot(pl.pos.x - g1.char.root.position.x, pl.pos.z - g1.char.root.position.z) < 8 && game.control) { S.loopBark = true; ui.subtitle('trooper', 'You did that already. No — you\'re about to do it. I hate that I know the difference.', 4600); } });
    await game.waitFor(() => near(P.powerDoor[0], -8.6, 2.2) || pl.pos.z < -9.4);
    cp(-14, -7.6, Math.PI);
    objective('Switch to 2049: the substation door is open there');
    await game.waitFor(() => pl.pos.z < -9.6 && T.current === '2049');
    cp(-14, -10.6, Math.PI, () => { if (T.current !== '2049') T.setImmediate('2049'); T.stability = 1; });

    // =====================================================================================================
    // POWER ACROSS STATES: the 2049 breakers feed the Continuum's 2196 block
    // =====================================================================================================
    setMood('m10-cell');
    await game.talk([
      ['helix49', 'SL4 substation. Lockdown in effect since 08:14.'],
      ['kai', 'Three breakers. Gallery services. Row circuit, cells three and four. Vault and east gate maglocks.'],
      ['kai', 'They built their whole block on Helix copper and never rewired it. What I throw here, they lose there.'],
    ]);
    objective('Throw the breakers: A draws the guards, B opens Sera\'s cell, C the vault');
    game.interact({ pos: [-21.6, 1.4, -15.5], radius: 1.6, prompt: 'Read Iven\'s maintenance note', states: ['2049'], onUse: () => { F.m10ivenNote = true; ev('Iven\'s note (2049)', 'I. Marr, 20.10.49: "Re-cabled SL4 after the 08:14 lockdown. Row circuit, services and maglocks still on the original copper. Whoever designed this level wired it to last a hundred years. Didn\'t ask why."', 'HELIX · SL4'); ui.subtitle('kai', 'Iven. Wired to last a hundred years. Someone knew.', 3000); } });
    const throwBreaker = (i) => {
      const id = 'ABC'[i]; power[id] = false;
      W.breakerFaces[i].material.map = TEX.breaker(id, [['GALLERY', 'SERVICES'], ['ROW', 'CIRCUIT 3-4'], ['VAULT &', 'EAST GATE']][i], false); W.breakerFaces[i].material.needsUpdate = true;
      W.levers[i].rotation.x = 1.1; W.levers[i].position.y = 1.15;
      audio.sfxPlay('metal'); audio.sfxPlay('spark'); game.shake = 0.03; setTimeout(() => { game.shake = 0; }, 300);
      audio.sfxPlay('success');
    };
    for (let i = 0; i < 3; i++) {
      const [x, z] = P.breakers[i];
      game.interact({ pos: [x, 1.2, z + 1.0], radius: 1.4, prompt: `Throw breaker SL4-${'ABC'[i]}`, once: false, states: ['2049'], enabled: () => power['ABC'[i]], onUse: async () => {
        if (i === 1 && power.A) { ui.subtitle('kai', 'If her bars drop with their lights on, both of them come running. Services first.', 3200); return; }
        throwBreaker(i);
        if (i === 0) {
          ui.toast('SL4-A ISOLATED · 2196: GUARD POST CONSOLE SHORTED', 2600);
          // in 2196 the guard post console dies: both gallery guards walk over to look at it, in the dark
          C.noise(W.consoleSparkPos, 60, 'console', 55, [g1, g2]);
          S.distractAt = game.time;
          await game.say('kai', 'Their console shares this line. That should pull them both to the west end. And the lights.');
        } else if (i === 1) {
          ui.toast('SL4-B ISOLATED · 2196: CELLS 3-4 OPEN', 2600);
          setBars(KAI_CELL, false); setBars(SERA_CELL, false);
          await game.say('kai', 'Row circuit. Sera\'s bars are down in 2196. Go, Sera.');
        } else {
          ui.toast('SL4-C ISOLATED · 2049: VAULT DOOR RELEASED', 2600);
          await game.say('kai', 'The vault maglock. In 2196 that\'s where they keep their weapons.');
        }
      } });
    }
    hint(() => power.A || power.B, 50, () => ui.subtitle('kai', power.A ? 'SL4-A first: gallery services.' : 'SL4-B: the row circuit.', 2400));
    await game.waitFor(() => !power.A && !power.B);
    objective('Get back to 2196 and find Sera (the guards are at their console)');
    hint(() => !S.seraFree, 50, () => ui.subtitle('kai', 'Out of the substation in 2049, then switch in the gallery.', 2600));
    // Sera slips out once Kai is back in 2196 and the guards are looking the other way
    await game.waitFor(() => T.current === '2196' && pl.pos.z > -9 && game.control);
    if (!S.seraOut) {
      S.seraOut = true; sera.pose = null;
      await walkTo(sera, [2.2, 0, 3.0], 2.0);
      walkTo(sera, [1.2, 0, -5.6], 3.0).then(() => { sera.crouch = 1; });
    }
    await game.waitFor(() => Math.hypot(pl.pos.x - sera.root.position.x, pl.pos.z - sera.root.position.z) < 3.4 && T.current === '2196' && game.control);
    S.seraFree = true; F.m10seraFreed = true;
    sera.crouch = 0; sera.lookTarget = kai.head || null;
    await game.talk([['sera', 'You came back.'], ['kai', 'I said I would.'], ['sera', 'People say things.'], ['sera', 'Armoury. North-east. They took something of ours.']]);
    sera.lookTarget = null; seraFollow = true;
    cp(pl.pos.x, pl.pos.z, pl.yaw, () => { sera.root.position.set(pl.pos.x + 1, 0, pl.pos.z); });
    // the guards come back to their beat when the console has been looked at long enough (55 s)

    // ---------- optional: Teo in cell 7, the roster ----------
    game.interact({ pos: [P.roster[0] + 0.6, 1.3, P.roster[2]], radius: 1.7, prompt: 'Read the intake roster', states: ['2196'], onUse: async () => {
      F.m10roster = true; ev('Block D4 intake roster', 'C3 VAREN, K. "17th intake". C4 VOSS, S. C5 MARR, D. C7 OKAFOR, T. (manual hold). Testing Chamber 2: four held in loops.', 'CONTINUUM · D4');
      await game.talk([['kai', 'Okafor, T. Cell seven, manual hold.'], ...(S.seraFree ? [['sera', 'Teo. My scout. Eleven days.']] : [])]);
      if (S.seraFree) objective('Optional: release cell 7 at the guard post · then the armoury (north-east)');
    } });
    game.interact({ pos: [P.roster[0] + 0.6, 1.3, P.roster[2] - 1.4], radius: 1.7, prompt: 'Release cell 7 (manual)', states: ['2196'], enabled: () => !S.teoFree && S.seraFree, onUse: async () => {
      S.teoFree = true; setBars(TEO_CELL, false); W.screens.roster.material.map = TEX.roster(true); W.screens.roster.material.needsUpdate = true; audio.sfxPlay('door');
      await game.wait(0.5); teo.pose = null; await walkTo(teo, [15.4, 0, 3.0], 2.4);
      walkTo(teo, [12, 0, -6.2], 3.0).then(() => { teo.crouch = 1; });
      await game.talk([['teo', 'Sera? Sera!'], ['sera', 'Quiet. Breathe. Behind the cases, stay low, wait for us.'], ['teo', 'Is that — that\'s him. Varen. They talk about you like weather.'], ['teo', 'Like something that keeps coming back.']]);
      F.m10teo = true; F.seraTrust = (F.seraTrust || 0) + 1;
      ev('Teo Okafor', 'Sera\'s scout, freed from cell 7 by the manual release at the guard post. "They talk about you like weather. Like something that keeps coming back."', 'SIDE QUEST · SERA\'S SCOUT');
    } });

    // =====================================================================================================
    // THE ARMOURY: through the 2049 vault, a takedown, the captured temporal weapon
    // =====================================================================================================
    objective(power.C ? 'The armoury door is sealed: throw SL4-C in the substation (2049), then go in through the vault' : 'Into the armoury through the 2049 vault (north-east), then switch inside');
    S.stealthFail = true;
    game.onUpdate(() => { if (!power.C && S.obj && S.obj.startsWith('The armoury door is sealed')) objective('Into the armoury through the 2049 vault (north-east), then switch inside'); });
    hint(() => !S.inArmoury, 80, () => ui.subtitle('sera', power.C ? 'Their door won\'t open for us. Your breakers might.' : 'The old vault door. Your year, then mine.', 2800));
    await game.waitFor(() => pl.pos.z < -10.6 && pl.pos.x > 8 && T.current === '2196');
    S.inArmoury = true;
    cp(12.4, -11.6, Math.PI);
    objective('Take down the armoury guard from behind (hold E) or slip past him to the locker');
    ui.subtitle('kai', 'One guard. Watching his screens. Behind him, quietly.', 2600);
    game.interact({ pos: [P.locker[0], 1.2, P.locker[2] + 0.9], radius: 1.5, prompt: 'Take the displacer from the locker', states: ['2196'], onUse: () => { S.gotWeapon = true; } });
    await game.waitFor(() => S.gotWeapon);
    W.displacer.visible = false; W.lockerDoor.rotation.y = -1.2; W.lockerDoor.position.x += 0.6;
    C.giveWeapon(); S.stealthFail = false; F.m10weapon = true;
    audio.sfxPlay('pickup');
    ui.toast('CAPTURED TEMPORAL WEAPON · DISPLACER\nR / CLICK / FIRE · STUN    HOLD · DISPLACE', 3600);
    ev('The displacer', 'A survivor-built weapon around a Continuum emitter, confiscated back by the Continuum. A tap stuns (holds a target in its own second); a held shot displaces (throws a target back to where it stood three seconds ago). Stunned or yielding enemies can be restrained.', 'WEAPON');
    if (g3.state !== 'down') { await game.say('kai', 'And if he turns around, I\'m armed now.'); }
    objective('Open the armoury door for Sera (the console by the door)');
    game.interact({ pos: [14, 1.2, -10.2], radius: 1.6, prompt: 'Open the armoury door', states: ['2196'], onUse: () => { S.armouryOpen = true; audio.sfxPlay('door'); } });
    game.interact({ pos: [P.gateConsole[0] - 0.6, 1.3, -14.1], radius: 1.6, prompt: 'Read the Continuum file on the screen', states: ['2196'], onUse: async () => {
      F.m10dossier = true; ev('Continuum file: VAREN, K.', 'Recorded versions: 16. Escaped this block: 4. Escape aid: VOSS, S. (three times). Classification: Architect of the Fracture. Disposition: assess, Test 2. "He does not remember us. We remember him."', 'CONTINUUM · D4');
      await game.talk([['kai', 'Escape aid: Voss, S. Three times.'], ...(S.seraFree ? [['sera', 'Then this is the fourth. I don\'t remember the others either.']] : [])]);
    } });
    await game.waitFor(() => S.armouryOpen);
    await game.wait(1.2);
    seraFollow = false;
    if (sera.root.position.distanceTo(V(14, 0, -8)) > 4) sera.root.position.set(14, 0, -7.6);
    await walkTo(sera, [14.4, 0, -12.4], 1.8);
    cine(true); lockMusic('m10-sera', 1.2);
    pl.place(13.4, 0, -13.2, 0.4);
    sera.lookTarget = kai.head || null; kai.lookTarget = sera.head || null;
    await game.shot([12.4, 1.7, -15.2], [14.0, 1.4, -12.6], 1.4, { fov: 40 });
    await game.talk([
      ['sera', 'That\'s ours. We pulled it off a Continuum patrol last winter. It cost us two people.'],
      ['sera', 'Tap it and they freeze in their own second for a while. Hold it and it throws them back where they stood three seconds ago.'],
      ['sera', 'Frozen ones you restrain. Nobody dies in here today. Not by us.'],
      ['kai', 'Agreed.'],
    ]);
    sera.lookTarget = null; kai.lookTarget = null; lockMusic(null); cine(false); seraFollow = true;
    // the gallery guards heard the door
    S.weaponFight = true;
    const galGuards = [g1, g2].filter(e => e.state !== 'down');
    for (const e of galGuards) { e.char.root.position.set(e === g1 ? 6 : 0, 0, e === g1 ? -6.4 : -2.6); e.last.set(14, 0, -9); C.setState(e, 'alert'); }
    if (g3.state !== 'down') { g3.last.copy(pl.pos); C.setState(g3, 'alert'); }
    setMood('m10-combat');
    objective('Stun the guards (R / FIRE), then restrain them (hold E)');
    cp(14, -12.4, Math.PI, () => { for (const e of galGuards) if (e.state !== 'down') { e.char.root.position.set(e === g1 ? 6 : 0, 0, e === g1 ? -6.4 : -2.6); e.last.set(14, 0, -9); C.setState(e, 'alert'); } });
    hint(() => !C.allDown(galGuards), 50, () => ui.subtitle('sera', 'Gold ring on the chest brightens — that\'s their shot coming. Move, then answer.', 3200));
    await game.waitFor(() => C.allDown([...galGuards, g3]));
    setMood('m10-stealth');
    ui.toast('NON-LETHAL · ' + S.restrained + ' RESTRAINED', 2200);
    await game.say('sera', 'Clean. The east gate opens from their console in there.');

    // question a restrained guard (optional)
    for (const e of [g1, g2, g3]) game.interact({ pos: e.restrain.pos, radius: 1.8, prompt: 'Question the trooper', states: ['2196'], enabled: () => e.state === 'down' && !S.questioned, onUse: async () => {
      S.questioned = true; F.m10questioned = true;
      await game.talk([
        ['kai', 'How do you know me?'],
        ['trooper', 'The gold. On the chest. It keeps what the resets take. Every version, we wake up remembering.'],
        ['trooper', 'Sixteen times you\'ve looked down at one of us and asked that. Same words.'],
        ['kai', 'And the Continuum? What are you for?'],
        ['trooper', 'One line. No more versions. Every time you run, the line frays. Enemies who remember, Varen. That\'s all we are.'],
      ]);
      ev('Enemies who remember', 'A restrained trooper: the gold emitter on the Continuum\'s chests keeps what the resets take, so they remember every version. "Every time you run, the line frays."', 'CONTINUUM');
    } });
    objective('Open the east gate from the armoury console');
    game.interact({ pos: [P.gateConsole[0] - 0.6, 1.3, -12.8], radius: 1.6, prompt: 'Open the east gate', states: ['2196'], onUse: () => { S.eastOpen = true; audio.sfxPlay('door'); ui.toast('EAST GATE · OPEN', 1800); } });
    hint(() => !S.eastOpen, 50, () => ui.subtitle('sera', 'The console by the east wall of the armoury.', 2600));
    await game.waitFor(() => S.eastOpen);
    objective('Through the east gate: the transit spine to Testing Chamber 2');

    // =====================================================================================================
    // THE TRANSIT SPINE: three troopers; fight, or flank through 2049
    // =====================================================================================================
    await game.waitFor(() => pl.pos.x > 23.4);
    cp(25.6, 0, Math.PI / 2);
    S.section = 'spine'; setMood('m10-stealth');
    for (let i = 3; i < 6; i++) { mkTrooper(i); await tick(); }
    const sp1 = enemy(3, 31, 0.6, -Math.PI / 2, { patrol: [[31, 0.6], [46, 0.6]], wait: 2.6, speed: 1.2, barks: { ...BARKS, spot: ['You did that already. No — you\'re about to do it.', 'Intake seventeen in the spine!'] } });
    const sp2 = enemy(4, 50.6, -1.4, -Math.PI / 2, { patrol: [[50.6, -1.4]], yaw: -Math.PI / 2, range: 12 });
    const sp3 = enemy(5, 47.4, 2.2, -Math.PI / 2, { patrol: [[47.4, 2.2], [38, 2.2]], wait: 3, speed: 1.0 });
    const spine = [sp1, sp2, sp3];
    ui.subtitle('sera', 'Three. The barricades are new — your year might not have them.', 3000);
    game.interact({ pos: [38, 1.4, 2.4], radius: 1.8, prompt: 'Read the doctrine panel', states: ['2196'], onUse: async () => {
      F.m10doctrine = true; ev('The Continuity Protocol', '"ONE TIME · ONE LINE · HELD." Article I of the Continuum\'s doctrine, "adopted from Helix directive E-ROOK-2049".', 'CONTINUUM · DOCTRINE');
      await game.talk([['kai', 'E-ROOK-2049. Rook wrote their creed.'], ['sera', 'Your people built ours a cage and called it a law. Keep walking.']]);
    } });
    objective('Get through the transit spine to the chamber door (fight, or flank through 2049)');
    hint(() => pl.pos.x < 50, 120, () => ui.subtitle('kai', 'Stun, then restrain. Or switch past the barricades and come back up behind them.', 3000));
    S.chamberOpen = true;
    await game.waitFor(() => pl.pos.x > 54.4 && T.current === '2196');
    for (const e of spine) if (e.state !== 'down' && e.state !== 'surrender') { e.enabled = false; e.char.speed = 0; }
    F.m10spine = C.allDown(spine) ? 'cleared' : 'slipped';

    // =====================================================================================================
    // TESTING CHAMBER 2: the assessment
    // =====================================================================================================
    S.inChamber = true; seraFollow = false;
    sera.root.position.set(57.6, 0, 1.2);
    cine(true); lockMusic(null, 1);
    pl.place(58.6, 0, -0.4, Math.PI / 2);
    audio.sfxPlay('door');
    placeCh(prefect, TC[0], TC[1] - 16.6, 0); prefect.lookTarget = kai.head || null; people.find(p => p.ch === prefect).on = true; prefect.root.position.y = 5.4;
    await game.shot([57, 3.2, 6], [70, 3, -2], 2.6, { fov: 52 });
    await game.shot([64, 2.4, -6], [TC[0], 6.4, TC[1] - 16], 2.2, { fov: 36 });
    await game.talk([
      ['prefect', 'Testing Chamber Two. Assessment of intake seventeen.'],
      ['prefect', 'Show us how you leave, Varen. You always do. We would like to know how.'],
      ['sera', 'She wants to watch you fight. Give her something boring.'],
    ]);
    cine(false); setMood('m10-combat');
    walkTo(sera, [57.8, 0, 2.6], 1.2).then(() => { sera.crouch = 1; });
    T.stability = 1; drainK = 0.2;
    for (let i = 6; i < 8; i++) { mkTrooper(i); await tick(); }
    // free the earlier guards for reuse: restrained bodies stay where they lie, spine ones are re-used
    const W1 = [[83, -3.2, -Math.PI / 2], [83, 3.2, -Math.PI / 2], [82, 0, -Math.PI / 2]];
    const W2 = [[82, -2.6, -Math.PI / 2], [82, 2.6, -Math.PI / 2], [83.4, 0, -Math.PI / 2]];
    const waveRun = async (n, spots, opts) => {
      const list = [];
      S.exitOpen = true; audio.sfxPlay('door'); await game.wait(0.6);
      spots.forEach(([x, z, yaw], k) => {
        const idx = [3, 4, 5, 6, 7, 0][(n * 3 + k) % 6];
        const old = C.enemies.find(e => e.char === troopers[idx]); if (old) C.removeEnemy(old);
        const o = (opts && opts[k]) || {};
        const e = enemy(idx, x, z, yaw, { patrol: [[x - 6, z]], range: 22, fov: 1.0, keep: 7, rate: 2.8, barks: CH_BARKS, ...o });
        e.last.copy(pl.pos); C.setState(e, 'alert'); list.push(e);
      });
      await game.wait(1.4); S.exitOpen = false;
      return list;
    };
    objective('Survive the assessment: wave 1 of 2');
    ui.toast('2049 HIDES YOU FROM THEM · THE CHAMBER DRAINS STABILITY FAST', 3000);
    let wave = await waveRun(0, W1);
    const reWave = (spots, opts) => () => { wave.forEach((e, k) => { if (e.state === 'down' || e.state === 'surrender') return; const [x, z, yaw] = spots[k]; e.char.root.position.set(x, 0, z); e.char.root.rotation.y = yaw; e.home = { x, y: 0, z, yaw }; e.last.copy(pl.pos); e.state = 'patrol'; C.setState(e, 'alert'); void opts; }); T.stability = 1; };
    cp(58.6, -0.4, Math.PI / 2, reWave(W1));
    hint(() => !C.allDown(wave), 70, () => ui.subtitle('sera', 'Use the barriers. Switch to 2049 to flank — but not for long.', 3000));
    await game.waitFor(() => C.allDown(wave));
    ui.subtitle('prefect', 'Again.', 1800);
    await game.wait(1.6);
    objective('Survive the assessment: wave 2 of 2 · the Assessor is shielded from the front');
    wave = await waveRun(1, W2, [{}, {}, { kind: 'officer', shield: true, nerve: 2, run: 2.4, keep: 5, telegraph: 0.7, rate: 2.2 }]);
    cp(58.6, -0.4, Math.PI / 2, reWave(W2));
    hint(() => !C.allDown(wave), 70, () => ui.subtitle('sera', 'The shield only faces one way. Get behind it — or throw it back with a held shot.', 3200));
    await game.waitFor(() => C.allDown(wave));
    F.m10assessment = true; F.m10restrained = S.restrained;
    setMood('m10-loop', 2);
    await game.shot([66, 2.2, 4], [TC[0], 6.2, TC[1] - 16], 1.6, { fov: 38 });
    await game.talk([['prefect', 'Noted.'], ['prefect', 'Sixteen times you left this room, and every time you left someone in it.']]);
    parkCh(prefect);
    game.releaseCam();
    drainK = 0.12;

    // =====================================================================================================
    // THE LOOP CELLS: release the prisoners or leave them
    // =====================================================================================================
    const LOOP_DUR = [6.0, 5.2, 6.8, 5.6];
    const loopers = LOOP_DUR.map((dur, i) => {
      const look = { ...PRISONERS[(i + 1) % 4], seed: 900 + i };
      const ch = game.ambient(look, ...loopCellPos(i, 17.4), 0); person(ch); return { ch, dur, t: Math.random() * dur, free: false, i };
    });
    await tick();
    game.onUpdate((dt, t) => {
      loopers.forEach((L, i) => {
        if (L.free) return;
        L.t = (L.t + dt) % L.dur; const k = L.t / L.dur;
        const a = LOOP_ANG[i], r = 17.6 - Math.min(1, k / 0.7) * 2.0;       // walks to the glass, then snaps back
        L.ch.root.position.set(TC[0] + Math.cos(a) * r, 0, TC[1] + Math.sin(a) * r);
        L.ch.root.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
        L.ch.speed = k < 0.7 ? 2.0 / (0.7 * L.dur) : 0; L.ch.pose = k > 0.7 ? 'look' : null;
        const win = k > 0.6 && k < 0.82;
        const ring = W.loopRings[i]; ring.material.color.set(win ? 0x6aff9a : 0xffd27a); ring.material.opacity = win ? 0.85 : 0.4 + Math.sin(t * 3) * 0.1;
        W.loopGlass[i].material.opacity = 0.18 + (k > 0.94 ? 0.3 : 0);
      });
    });
    seraFollow = false; sera.crouch = 0;
    await walkTo(sera, [P.loopPanel[0] - 1.2, 0, P.loopPanel[2] - 0.8], 3.0);
    objective('Look at the loop cells on the south side');
    ui.subtitle('looper', '— is it morning? — is it morning? — is it morning?', 3600);
    game.interact({ pos: [P.loopPanel[0], 1.2, P.loopPanel[2] - 0.6], radius: 1.8, prompt: 'Read the loop panel', states: ['2196'], onUse: () => { S.loopRead = true; } });
    hint(() => !S.loopRead, 45, () => ui.subtitle('sera', 'The panel. By me.', 2000));
    await game.waitFor(() => S.loopRead);
    cine(true); lockMusic('m10-loop');
    await game.shot([P.loopPanel[0] + 2.6, 1.7, P.loopPanel[2] - 3.2], [P.loopPanel[0], 1.3, P.loopPanel[2]], 1.6, { fov: 40 });
    await game.talk([
      ['kai', 'Four people in loops. Five, six seconds each. That\'s what Chamber Two is for.'],
      ['sera', 'They test the binding on survivors first. Nobody\'s ever come back out.'],
      ['sera', 'Cutting them loose takes the stabilizer feed for the lift. The whole block will know exactly where we are.'],
    ]);
    const rel = await choose('kai', 'The prisoners in the loops:', ['Release them. All four.', 'Leave them. We come back with help.']);
    S.release = rel === 0; F.m10released = S.release;
    if (S.release) {
      await game.talk([['sera', 'Then we do it properly. Cut each loop the moment they touch the glass, or it snaps them back.'], ['kai', 'Watch the ring. Green when they reach it.']]);
      F.seraTrust = (F.seraTrust || 0) + 1;
    } else {
      await game.talk([['kai', 'We can\'t carry four people through a block that remembers us. We come back.'], ['sera', 'Nobody comes back.'], ['sera', '...Remember that you chose this. I will.']]);
      F.seraTrust = (F.seraTrust || 0) - 1;
    }
    lockMusic(null); cine(false);
    if (S.release) {
      objective('Cut each loop when the prisoner reaches the glass (ring turns green) · 0 / 4');
      cp(70, 10.8, 0);
      loopers.forEach((L, i) => {
        const fr = loopCellPos(i, 13.6);
        game.interact({ pos: [fr[0], 1.0, fr[2]], radius: 1.8, prompt: `Cut loop L${i + 1}`, once: false, states: ['2196'], enabled: () => !L.free, onUse: () => cutLoop(i) });
      });
      const cutLoop = (i, force) => {
        const L = loopers[i]; if (L.free) return; const k = L.t / L.dur;
        if (!force && !(k > 0.58 && k < 0.84)) { audio.sfxPlay('rewind'); ui.toast('TOO EARLY · THE LOOP PULLED THEM BACK · WATCH FOR GREEN', 2000); return; }
        L.free = true; musicState.loops++; audio.sfxPlay('success'); audio.sfxPlay('switch');
        W.loopGlass[i].visible = false; for (const b of W.loopBoxes[i]) b.enabled = false; W.loopRings[i].visible = false;
        L.ch.pose = null; L.ch.speed = 0;
        walkTo(L.ch, [TC[0] + Math.cos(LOOP_ANG[i]) * 12.4, 0, TC[1] + Math.sin(LOOP_ANG[i]) * 12.4], 1.6).then(() => { L.ch.pose = 'sad'; });
        const n = loopers.filter(q => q.free).length;
        ui.subtitle('looper', ['It\'s... it\'s not morning. Is it?', 'I kept reaching for the door.', 'How long? How long was I—', 'Thank you. Whoever you are.'][n - 1], 2800);
        objective(`Cut each loop when the prisoner reaches the glass (ring turns green) · ${n} / 4`);
        W.screens.loop.material.map = TEX.loopPanel(n); W.screens.loop.material.needsUpdate = true;
      };
      window.__m10.cutLoop = (i) => cutLoop(i, true);
      hint(() => loopers.some(L => !L.free), 60, () => ui.subtitle('sera', 'They walk up to the glass and touch it. That\'s the moment. Cut it then.', 3000));
      await game.waitFor(() => loopers.every(L => L.free));
      F.m10freed = 4;
      audio.sfxPlay('alarm'); setMood('m10-escape', 1);
      ui.subtitle('pa', 'Stabilizer breach, Chamber Two. All units to the east shaft.', 3200);
      await game.talk([['sera', 'There it is. Everyone up — follow me, stay close, don\'t look at the gold.'], ...(S.teoFree ? [['teo', 'Ladder in the shaft room! I\'ll take them up!']] : [['sera', 'There\'s a service ladder in the shaft room. You four, up it, now.']])]);
      ev('The loop subjects', 'Kai cut four survivors out of the Continuum\'s test loops in Chamber Two. Releasing them took the lift\'s stabilizer feed and told the whole block where he was.', 'CHOICE · RELEASED');
    } else {
      ev('The loop subjects', 'Kai left four survivors in the Continuum\'s test loops in Chamber Two, to keep the lift and the escape quiet. "Nobody comes back." — Sera.', 'CHOICE · LEFT');
      setMood('m10-escape', 2);
    }
    // =====================================================================================================
    // THE SHAFT: the lift is dead either way; the broken gantry; Echo Step
    // =====================================================================================================
    S.exitOpen = true;
    objective('East, through the exit to the shaft');
    seraFollow = true;
    await game.waitFor(() => pl.pos.x > 87);
    S.exitOpen = false;
    loopers.forEach(L => { if (L.free) show(L.ch, false); });
    if (S.teoFree) show(teo, false);
    cp(88, 0, Math.PI / 2);
    S.section = 'shaft';
    // a shielded sentry at the near platform; and the squad on Kai's heels if the block knows where he is
    const sentry = enemy(6, 91.4, -2.0, -Math.PI / 2, { patrol: [[91.4, -2.0]], yaw: -Math.PI / 2, shield: true, kind: 'officer', range: 14, fov: 0.7, keep: 5, telegraph: 0.8 });
    sentry.char.root.position.set(91.4, 0, -2.0);
    await game.talk([['sera', 'The lift\'s dead. Gantry. And that one\'s shielded.'], ['kai', 'The gantry\'s broken in the middle. Six metres of nothing.']]);
    objective('Get past the shielded sentry to the gantry');
    hint(() => sentry.state !== 'down' && sentry.state !== 'surrender', 60, () => ui.subtitle('sera', 'Hold the shot — throw him back, then get behind him.', 2600));
    await game.waitFor(() => pl.pos.x > 93.4 || C.allDown([sentry]));
    await game.waitFor(() => pl.pos.x > 93.4);
    // the squad arrives behind them: the Echo Step is born
    cp(94.2, 0, Math.PI / 2);
    cine(true); lockMusic(null, 0.6);
    pl.place(95.4, 0, 0.2, Math.PI / 2);
    seraFollow = false; sera.root.position.set(94.2, 0, 0.6); sera.crouch = 0;
    for (const e of C.enemies) if (e !== sentry) e.enabled = false;
    placeCh(prefect, 87.4, 0.6, Math.PI / 2); people.find(p => p.ch === prefect).on = true;
    const sq = [];
    for (const [k, z] of [[0, -1.6], [1, 1.6], [2, -3.2]]) { const old = C.enemies.find(e => e.char === troopers[k]); if (old) C.removeEnemy(old); const ch = mkTrooper(k); placeCh(ch, 87.6, z, Math.PI / 2); sq.push(ch); }
    await game.shot([92.4, 2.0, 3.6], [87.6, 1.6, 0], 1.8, { fov: 44 });
    await game.talk([['prefect', 'Seventeen times, Varen. The ending is always the same.'], ['prefect', 'Freeze him.']]);
    await game.shot([97.6, 1.6, 2.4], [95.4, 1.3, 0.2], 0.9, { fov: 40 });
    // the troopers fire; time stutters; the afterimage takes the bolts
    sq.forEach(ch => { ch.faceTowards(95.4, 0.2, 1, 1); });
    audio.sfxPlay('heartbeat'); shiftPulse = 1; kai.wristBoost = 14;
    echo.unlock(true); echo.cool = 0; T.stability = 1;
    const sx = pl.pos.clone();
    if (echo.ghost) { echo.ghost.root.position.copy(sx); echo.ghost.root.rotation.y = pl.yaw; echo.ghost.root.visible = true; echo.ghost.frozen = false; echo.ghost.update(0.016); echo.ghost.frozen = true; echo.ghostT = 3.6; }
    pl.place(95.6, 0, -0.9, Math.PI / 2);
    for (const ch of sq) { const from = V(ch.root.position.x, 1.36, ch.root.position.z); C.spawnBolt(from, sx.clone().setY(1.1).sub(from).normalize(), 11, 'enemy', 'stun', { pos: sx.clone(), t: 4 }); }
    await game.shot([98.4, 1.8, -3.4], [95.2, 1.2, -0.2], 2.2, { fov: 42 });
    await game.talk([['kai', '...That was me. A second ago. They shot where I was.'], ['sera', 'Whatever that was — do it again! Across the gap! I\'ve got a line!']]);
    echo.hideGhost();
    ui.toast('ECHO STEP UNLOCKED\nV / ECHO · leave an afterimage and slip through the same second', 3800);
    F.echoStep = true;
    ev('Echo Step', 'Under fire on the broken gantry, Kai\'s binding left an afterimage of him where he stood while he slipped a few metres through the same second. Enemies see the afterimage and fire on it. Facing a gap, the step carries him across. It costs stability and needs a few seconds to recover.', 'ABILITY');
    lockMusic('m10-escape'); cine(false);
    // the squad is live now, and keeps distance on the near platform
    const sqE = sq.map((ch, k) => { const e = C.addEnemy(ch, { states: ['2196'], voice: 'trooper', barks: BARKS, patrol: [[87.6, ch.root.position.z]], range: 20, fov: 1.2, keep: 8, rate: 3.0, telegraph: 1.0, surrenders: true }); e.last.copy(pl.pos); C.setState(e, 'alert'); void k; return e; });
    echo.gap({ from: P.gapFrom, to: P.gapTo, radius: 2.6, id: 'gantry' });
    objective('Echo Step (V / ECHO) across the broken gantry · face the gap at its edge');
    cp(95.6, -0.4, Math.PI / 2, () => { sqE.forEach((e, k) => { if (e.state === 'down') return; e.char.root.position.set(87.6, 0, [-1.6, 1.6, -3.2][k]); e.last.copy(pl.pos); e.state = 'patrol'; C.setState(e, 'alert'); }); T.stability = 1; echo.cool = 0; });
    hint(() => pl.pos.x < 100, 25, () => ui.subtitle('sera', 'Edge of the gantry, face across, and do the thing!', 2400));
    await game.waitFor(() => pl.pos.x > 103 && pl.pos.y > -0.5 && game.control);
    F.m10echoUses = echo.uses;
    for (const e of C.enemies) e.enabled = false;
    C.clearBolts();
    // Sera follows on her line
    cine(true);
    await game.shot([106.6, 2.2, 3.2], [100.2, 1.2, 0], 1.4, { fov: 44 });
    audio.sfxPlay('metal');
    await walkTo(sera, [96.8, 0, 0], 0.5);
    { const from = sera.root.position.clone(), to = V(104.6, 0, 0.8); let u = 0; await new Promise(res => { const off = game.onUpdate(dt => { u = Math.min(1, u + dt / 1.1); sera.root.position.lerpVectors(from, to, u); sera.root.position.y = Math.sin(u * Math.PI) * 1.2 - (u > 0.2 && u < 0.8 ? 0.6 : 0); sera.speed = 4; if (u >= 1) { off(); sera.speed = 0; sera.root.position.y = 0; res(); } }); }); }
    await game.say('sera', 'Go! The breach!');
    cine(false); seraFollow = true;
    objective('Out through the breach');
    await game.waitFor(() => pl.pos.x > 114.4);

    // =====================================================================================================
    // ENDING: the ruined city at dusk, the skiff
    // =====================================================================================================
    cine(true); lockMusic('m10-echo', 2.4);
    seraFollow = false;
    pl.place(116.4, 0, -0.8, Math.PI / 2); sera.root.position.set(116.2, 0, 1.1); sera.root.rotation.y = Math.PI / 2; sera.speed = 0; sera.crouch = 0;
    W.skiff.visible = true;
    const skFrom = V(150, 8, 10), skTo = V(124.4, -0.6, 0); W.skiff.position.copy(skFrom);
    { let u = 0; game.onUpdate(dt => { if (u >= 1) return; u = Math.min(1, u + dt / 6); const k = 1 - Math.pow(1 - u, 3); W.skiff.position.lerpVectors(skFrom, skTo, k); W.skiff.position.y += Math.sin(game.time * 1.3) * 0.08; }); }
    await game.shot([112.6, 2.4, 4.6], [150, 14, -12], 3.4, { fov: 50 });
    await game.shot([114.7, 1.62, -2.6], [117.2, 1.5, 0.4], 2.0, { fov: 40 });
    sera.lookTarget = kai.head || null; kai.lookTarget = sera.head || null;
    await game.talk([
      ['sera', 'That trick. The afterimage.'],
      ['kai', 'An echo step. It\'s me, a second behind myself.'],
      ['sera', 'The memorials never mentioned that.'],
      ['kai', 'Maybe the memorials are wrong about more than that.'],
      ['sera', 'Maybe. You get one ride, memorial man. Don\'t make me regret it.'],
    ]);
    if (S.release) await game.talk([['looper', 'Is it morning?'], ['sera', 'It\'s evening. A real one. Get in.']]);
    else await game.talk([['kai', 'Four people in Chamber Two.'], ['sera', 'I know. I counted too.']]);
    ui.subtitle('prefect', 'We\'ll remember this one too, Varen.', 3600);
    await game.shot([126, 9, 14], [116, 1.5, 0], 4.2, { fov: 46 });
    await ui.fade(1, 2400);
    const mins = Math.round((game.time - tStart) / 60);
    await ui.chapterCard('MISSION 10 COMPLETE', 'Enemies Who Remember', `Echo Step unlocked · Prisoners ${S.release ? 'released' : 'left in the loops'} · ${S.restrained} restrained, none killed · Shards ${S.shards}/5${mins ? ' · ' + mins + ' min' : ''}`, 3800);
    F.m10done = true; F.m10shards = S.shards; F.m10restrained = S.restrained; F.m10nonLethal = true; F.continuumAware = true;
    C.dispose(); echo.dispose(); ui.detection(0);
    game.releaseCam(); ui.letterbox(false); audio.wind(0); audio.hum(0); audio.setTheme(null);
  },
};
