// MISSION 12 · THE MAN BEHIND THE GLASS (Act II) — reveal the Witness without resolving the mystery.
// Bible beats: chase through Helix in 2049 · use a corridor that existed only in 2026 · traverse the ruined facility
// in 2196 · reconstruct the Witness's route from repeated fragments · enter a chamber containing a second Chronolith.
// Quote: "The person you become when you refuse to let go." Ending: the Witness bears the same wrist scar as Kai and
// escapes through a fracture. Uses Echo Step (src/systems/echostep.js).
// Saturday 23.10.2049, 23:40. Kai has come to Helix to make Rook explain bed 4-07; a long-coated man is waiting for
// him behind the glass of Test Hall C instead, and he changes states to get away.
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { CAST, registerCast } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { Drone } from '../world/props.js';
import { glowMat } from '../world/kit.js';
import { EchoStep } from '../systems/echostep.js';
import { buildHelixWest, registerM12Cast, registerM12Themes, musicState, P, FRAGS, SHARDS, NOTES, ROUTE, SEGS, LANDINGS, HUB, TEX, GUARD49F } from '../world/env_m12.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ERA_NAME = { '2026': 'PAST', '2049': 'PRESENT', '2196': 'FUTURE' };

export default {
  id: 'm12', act: 'ACT II · THE NINE-MINUTE WAR', title: 'The Man Behind the Glass', sub: 'Helix · three states',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM12Cast(); registerM12Themes();
    const haleSide = F.trustedHale !== false;
    registerCast('m12rook', { name: 'DR. ELIAS ROOK', role: 'Gallery C intercom · director\'s line', portraitOf: 'rook', vp: { sex: 'm', pitch: 0.9, rate: 0.94, langs: ['en-GB', 'en-US'] } });
    registerCast('m12hale', { name: 'OFF. R. HALE · RADIO', role: 'Helix channel 2', portraitOf: 'hale', vp: { sex: 'm', pitch: 0.84, rate: 1.0, langs: ['en-US', 'en-GB'] } });
    registerCast('m12brandt', { name: 'M. BRANDT · RADIO', role: 'Helix channel 2', portraitOf: 'brandt', vp: { sex: 'm', pitch: 0.8, rate: 1.02, langs: ['en-GB', 'en-US'] } });
    const radioId = haleSide ? 'm12hale' : 'm12brandt';
    try {
      const need = ['ben', 'ife', 'witness', 'm12guard', 'rook', 'hale', 'brandt'].filter(id => !ui.portraits[id] && CAST[id]?.look);
      if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]]))));
    } catch (err) { console.warn('m12 portraits', err); }

    const scene = game.newScene({ background: 0x07090c, fog: [0x10141a, 0.02], exposure: 1.05, bloom: 0.6, bloomThreshold: 0.85, envIntensity: 0.6, killY: -14, residue: true });
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    const Q = RZ.getQuality(), low = Q === 'low';
    game.onUpdate(dt => RZ.update(dt));
    await tick();

    // ---------- temporal states (configured before the map so T.only works on the build) ----------
    let mood = 'm12-glass', musicLock = null, lookReady = false;
    const music = (fade = 1.6) => { const th = musicLock || mood; for (const d of T.defs) d.theme = th; audio.setTheme(th, fade); };
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    const setMood = (m) => { if (m !== mood) { mood = m; if (!musicLock) music(); } };
    T.configure(['2026', '2049', '2196'].map((id, i) => ({ id, key: String(i + 1), name: ERA_NAME[id], year: 'HELIX · ' + id, glyph: ['◐', '◎', '◑'][i], color: ['#ffb36a', '#5fe6ff', '#9fe0a0'][i], theme: 'm12-glass', apply: () => { if (lookReady) applyLook(); } })), '2049');
    T.unlocked = false;

    const W = buildHelixWest(game, scene, T);
    game.onUpdate((dt, t) => W.update(dt, t));
    await tick();

    // ---------- light: per-state environment, a key spot and three nearest points ----------
    let night = null, cool = null, warm = null;
    try {
      night = RZ.skyEnvironment(renderer, scene, { preset: 'night-city', cover: 0.6, apply: false });
      cool = RZ.skyEnvironment(renderer, scene, { preset: 'interior', color: 0xeaf4ff, wall: 0x3a4448, window: 0x5a6a7a, apply: false });
      warm = RZ.skyEnvironment(renderer, scene, { preset: 'interior', color: 0xffe2c0, wall: 0x3a3028, window: 0x6a5a48, apply: false });
    } catch (err) { console.warn('m12 sky', err); }
    const hemi = new THREE.HemisphereLight(0xb8c8d0, 0x181a1c, 0.3); scene.add(hemi);
    const key = new THREE.SpotLight(0xf0f6ff, 60, 18, 0.95, 0.6, 1.5); key.castShadow = !low;
    key.shadow.mapSize.set(Q === 'high' ? 1024 : 512, Q === 'high' ? 1024 : 512); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; scene.add(key, key.target);
    const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    const zoneOf = (p) => {
      if (p.z < -126.5) return 'ch2';
      if (p.z < -93.2) return 'stair';
      if (p.x < -58.3 && p.z > -74.2) return 'atrium';
      if (p.x < -62 || p.z < -74.2) return 'hub';
      if (p.x < -52) return 'lobby';
      if (p.x < -20 && p.z < -36) return 'run';
      if (p.z < -39.6) return 'north';
      if (p.x > 8) return 'east';
      return 'gallery';
    };
    let zone = 'gallery', lightT = 0;
    function applyLook() {
      const e = T.current, z = zone;
      const open = e === '2196' && (z === 'atrium' || z === 'hub' || z === 'lobby');
      const L = e === '2196' ? { fog: open ? [0x161c24, 0.014] : [0x0c1014, 0.03], env: open ? 0.85 : 0.45, hemi: [0x8aa0c0, 0x1a1c1e, open ? 0.6 : 0.24], exp: open ? 1.3 : 1.15 }
        : e === '2026' ? { fog: [0x1a1610, 0.032], env: 0.5, hemi: [0xffd8b0, 0x1a1410, 0.2], exp: 1.06 }
          : { fog: [0x10141a, z === 'gallery' ? 0.012 : 0.02], env: 0.62, hemi: [0xd8e4ea, 0x22262a, 0.28], exp: 1.0 };
      scene.fog.color.set(L.fog[0]); scene.fog.density = L.fog[1];
      const env = e === '2196' ? (open ? night : cool) : e === '2026' ? warm : cool;
      if (env) { scene.environment = env.envMap; scene.environmentIntensity = L.env; }
      scene.background = open && night ? night.background : new THREE.Color(e === '2026' ? 0x0c0a08 : 0x07090c);
      hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
      renderer.toneMappingExposure = L.exp;
      audio.wind(open ? 0.16 : 0); audio.water(e === '2196' && z === 'atrium' ? 0.12 : 0);
      audio.rain(open ? 0.22 : 0.02); audio.hum(e === '2049' ? 0.07 : e === '2026' ? 0.03 : 0.0, e === '2049' ? 60 : 50);
      lightT = 0;
    }
    const rigLights = () => {
      const p = game.cine ? game.engine.camera.position : pl.pos, e = T.current;
      const list = W.lightSrc.filter(s => s.era === e || s.era === 'all').map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 * 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      const k = list[0];
      if (k) { key.position.set(...k.p); key.target.position.set(k.p[0], k.p[1] - 4, k.p[2] - 0.4); key.color.set(k.c); key.intensity = k.i * 2.2; key.distance = k.d * 1.7; }
      pts.forEach((l, i) => { const s = list[i + 1]; if (!s) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
    };
    game.onUpdate(dt => {
      const z = zoneOf(game.cine ? game.engine.camera.position : pl.pos); if (z !== zone) { zone = z; applyLook(); }
      lightT -= dt; if (lightT <= 0) { lightT = 0.35; rigLights(); }
    });
    T.onSwitch(() => { lightT = 0; });
    lookReady = true; applyLook();

    // ---------- state + helpers ----------
    const S = { shards: 0, seen: {}, ev: new Set(), obj: '', notes: 0, fragsRead: new Set(), detained: 0, falls: 0, boardMisses: 0, fieldFails: 0, phase: 'gallery', routeKnown: false, book: 'none', inst: 0 };
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

    // era switching never drops Kai into a wall or onto nothing
    const solidAt = (id) => {
      const p = pl.pos, y0 = p.y + 0.45, y1 = p.y + 1.6; let ground = false;
      for (const b of game.collision.boxes) {
        if (!b.enabled || (b.states && !b.states.includes(id)) || b.walkOnly) continue;
        const inXZ = p.x > b.min.x - 0.28 && p.x < b.max.x + 0.28 && p.z > b.min.z - 0.28 && p.z < b.max.z + 0.28;
        if (!inXZ) continue;
        if (b.max.y > y0 && b.min.y < y1) return 'solid';
        if (p.x > b.min.x - 0.1 && p.x < b.max.x + 0.1 && p.z > b.min.z - 0.1 && p.z < b.max.z + 0.1 && b.max.y <= p.y + 0.45 && b.max.y > p.y - 1.6) ground = true;
      }
      return ground ? null : 'void';
    };
    const baseCan = T.canSwitch.bind(T);
    T.canSwitch = (id) => {
      if (!baseCan(id)) { if (T.locked && T.unlocked && id !== T.current && once('lockToast' + Math.floor(game.time / 6))) ui.toast(S.phase === 'atrium' ? 'FRACTURE INTERFERENCE · SWITCHING LOCKED' : 'SWITCHING LOCKED', 1600); return false; }
      const why = solidAt(id);
      if (why) { if (once('solid' + id + Math.floor(game.time / 3))) { ui.toast(why === 'solid' ? `SOLID HERE IN ${id} · MOVE TO OPEN GROUND` : `NOTHING TO STAND ON HERE IN ${id}`, 1800); audio.sfxPlay('fail'); } return false; }
      return true;
    };

    // ---------- people ----------
    const witness = game.actor('witness', { ...CAST.witness.look, era: '2049' }, P.witnessHall[0], 0, P.witnessHall[2], 0);
    const wristMat = witness.wrist?.material; if (wristMat?.emissive) { witness.wrist.material = wristMat.clone(); witness.wrist.material.emissive.setHex(0xff6a4a); witness.wrist.material.color?.setHex(0x331008); }
    let wEra = '2049', wShown = true;
    // the Witness bleeding through from the state he is in: a faint red-orange outline when Kai is in another one
    const wGhost = game.actor('m12wghost', { ...CAST.witness.look, era: '2049', lod: true }, 0, -50, 0, 0); wGhost.setGhost(0xff6a4a);
    const fragGhost = game.actor('m12frag', { ...CAST.witness.look, era: '2049', lod: true }, 0, -50, 0, 0); fragGhost.setGhost(0xff8a5a); fragGhost.root.visible = false;
    const setAlpha = (ch, a) => { const u = ch.ghostMat?.uniforms; if (u?.uAlpha) u.uAlpha.value = a; };
    game.onUpdate(() => {
      witness.root.visible = wShown && T.current === wEra;
      wGhost.root.visible = wShown && T.current !== wEra;
      if (wGhost.root.visible) { wGhost.root.position.copy(witness.root.position); wGhost.root.rotation.y = witness.root.rotation.y; wGhost.speed = witness.speed; wGhost.pose = witness.pose; setAlpha(wGhost, 0.38); }
    });
    const scarMat = new THREE.MeshStandardMaterial({ color: 0xc89080, roughness: 0.55 });
    // the scar sits at the left wrist joint, just past the band (hand_L bone; old builds: next to the ring)
    const wristNode = (ch) => { const hb = ch.arms?.[1]?.hand; if (hb?.parent) return hb; if (ch.wrist?.isObject3D) return ch.wrist; return ch.head; };
    const addScar = (ch) => {
      const hb = ch.arms?.[1]?.hand;
      if (hb?.parent) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 24), scarMat); s.rotation.x = Math.PI / 2; s.position.set(0, 0.022, 0); s.scale.set(1, 0.85, 1); hb.add(s); return; }
      const w = ch.wrist; if (!w?.isObject3D || !w.parent) return; const s = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.007, 6, 24), scarMat); s.position.copy(w.position).multiplyScalar(0.9); s.quaternion.copy(w.quaternion); w.parent.add(s);
    };
    addScar(kai); addScar(witness);
    // walk a character along a path (each point [x, y, z]); resolves at the end
    const walkTo = (ch, path, speed = 1.5) => new Promise(res => {
      let i = 0;
      const off = game.onUpdate(dt => {
        const p = ch.root.position, t = path[i]; const dx = t[0] - p.x, dz = t[2] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { i++; if (i >= path.length) { ch.speed = 0; off(); res(); } return; }
        const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st; p.y += (t[1] - p.y) * Math.min(1, dt * 5);
        let dy = Math.atan2(dx, dz) - ch.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.root.rotation.y += dy * Math.min(1, dt * 8); ch.speed = speed;
      });
    });
    const witnessSwitch = async (toEra) => {
      audio.sfxPlay('switch'); witness.wristBoost = 8;
      const flare = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 10), new THREE.MeshBasicMaterial({ color: 0xff6a4a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      flare.position.copy(witness.root.position).add(V(0, 1.1, 0)); scene.add(flare);
      await tween(0.7, u => { flare.scale.setScalar(1 + u * 2.4); flare.material.opacity = 0.5 * (1 - u); });
      scene.remove(flare); flare.geometry.dispose(); wEra = toEra;
    };
    const guardA = game.actor('m12guard', null, 14.2, 0, -27.4, -Math.PI / 2);
    const guardB = game.actor('m12guardb', { ...GUARD49F, lod: true }, 15.4, 0, -32.6, -2.4);
    for (const g of [guardA, guardB]) T.only(g.root, '2049');
    const ben = game.actor('ben', null, P.ben[0], 0, P.ben[2], 0.9); T.only(ben.root, '2026'); ben.pose = 'sit';
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.46, 12), new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.7 })); stool.position.set(P.ben[0], 0.23, P.ben[2]); scene.add(stool); T.only(stool, '2026');
    const ife = game.actor('ife', null, P.scout[0], 2.4, P.scout[2], 0.6); T.only(ife.root, '2196'); ife.pose = 'sit';
    // Echo Step (unlocked in mission 10; always available here)
    let echo = null;
    try { echo = new EchoStep(game, { cost: 0.25, cooldown: 4, linger: 4.5 }); echo.unlock(); F.echoStep = true; } catch (err) { console.warn('m12 echo', err); }
    const shutterGap = echo?.gap({ from: [10, 0, -19.9], to: [10, 0, -22.7], radius: 2.6, enabled: () => S.shutterJammed });
    const catwalkGap = echo?.gap({ from: P.gapFrom, to: P.gapTo, radius: 2.4 });
    void shutterGap; void catwalkGap;
    if (echo) echo.onStep = (info) => { F.m12echoUses = (F.m12echoUses || 0) + 1; if (info.gap) audio.sfxPlay('success'); };
    // the drone in the north corridor
    const drone = new Drone(game, [[6, 2.5, -42], [-19, 2.5, -42]], { speed: 1.9, range: 9.5 });
    drone.mesh.visible = false; drone.disabled = true; drone.pool.visible = false; T.only(drone.mesh, '2049');
    window.__m12 = { S, W, echo, drone, witness, ben, ife, guards: [guardA, guardB], P, FRAGS };

    // ---------- collectibles: shards and notes ----------
    const shardAt = (i, era, enabled = () => true) => {
      const [x, y, z, where] = SHARDS[i];
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), glowMat(0x7fe8ff, 3.2)); m.position.set(x, y, z); m.userData.noBatch = true; scene.add(m);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.01, 6, 32), glowMat(0x7fe8ff, 1.8)); m.add(halo);
      if (era) T.only(m, era);
      game.onUpdate((dt, t) => { m.rotation.y += dt * 1.4; halo.rotation.x = t; if (m.userData.taken) m.visible = false; });
      game.interact({ pos: [x, y, z], radius: 1.7, prompt: 'Take the temporal shard', states: era ? [era] : undefined, enabled: () => !m.userData.taken && enabled(), onUse: () => {
        m.userData.taken = true; m.visible = false; S.shards++; F.shards = (F.shards || 0) + 1; F.m12shards = S.shards; audio.sfxPlay('anomaly');
        ev('Temporal shard ' + S.shards + '/5', 'Crystallised time, found in ' + where + '. It hums a little slower than the room around it.', 'TEMPORAL SHARD · ' + S.shards + '/5');
      } });
    };
    shardAt(0, '2049'); shardAt(1, '2049'); shardAt(2, '2196'); shardAt(3, '2026'); shardAt(4, '2049');
    const noteMat = new THREE.MeshStandardMaterial({ map: TEX.note(), roughness: 0.8, side: THREE.DoubleSide });
    NOTES.forEach((n) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), noteMat); m.position.set(n.pos[0], n.pos[1] - 0.93, n.pos[2]); m.rotation.x = -Math.PI / 2; m.rotation.z = 0.4; scene.add(m); T.only(m, n.era);
      game.interact({ pos: n.pos, radius: 1.6, prompt: 'Pick up the note', states: [n.era], onUse: () => {
        m.visible = false; m.userData.states = []; S.notes++; F.m12notes = S.notes; audio.sfxPlay('pickup');
        ev(n.title, n.text, 'THE WITNESS\'S NOTES · ' + S.notes + '/3');
        ui.subtitle('kai', S.notes === 1 ? 'That\'s my handwriting. I never wrote this.' : S.notes === 2 ? 'Mine again. He writes to me like I\'m late.' : 'He knew I\'d find all three. Of course he did.', 3200);
      } });
    });

    // =====================================================================================
    // OPENING: Test Hall C behind the glass of Observation Gallery C, Saturday 23.10.2049, 23:40
    // =====================================================================================
    ui.missionTag('MISSION 12 · THE MAN BEHIND THE GLASS'); ui.show('hud', true);
    pl.place(...P.start, Math.PI); game.checkpoint(...P.start, Math.PI);
    witness.root.visible = false; wShown = false;
    cine(true);
    await game.shot([5.5, 6.4, -22.5], [0, 2.6, -14], 0.01, { fov: 52 });
    await ui.fade(0, 2400);
    lockMusic('m12-glass', 2);
    const cc = ui.chapterCard('ACT II · THE NINE-MINUTE WAR', 'The Man Behind the Glass', 'Helix Temporal Research · Test Hall C · Saturday 23.10.2049 · 23:40', 4400);
    await game.shot([-4.5, 4.2, -18.5], [0, 2.0, -6], 6.5, { fov: 46 });
    await cc;
    await game.shot([3.4, 1.7, -0.8], [-2.6, 1.55, -5.2], 2.0, { fov: 40 });
    kai.lookTarget = V(0, 1.5, -12);
    await game.talk([
      ['kai', F.m11miraFile ? 'Halden kept her bed made for twenty-three years. Helix paid for the sheets.' : 'Twenty-three years of answers nobody would give me. Tonight Rook gives one.'],
      ['kai', 'He said five minutes. Gallery C. Midnight.'],
    ]);
    kai.lookTarget = null;
    ev('Gallery C, 23:40', 'Saturday 23.10.2049. Rook agreed to meet Kai in Observation Gallery C, over Test Hall C, "for five minutes". Helix\'s own records still list Dr. K. Varen as deceased.', 'HELIX · 2049');
    cine(false); lockMusic(null);
    objective('Wait for Rook at the glass · or use the intercom');
    game.interact({ pos: P.intercom, radius: 1.8, prompt: 'Call the director\'s line', onUse: () => { S.calledRook = true; } });
    hint(() => !S.calledRook, 45, () => ui.subtitle('kai', 'The intercom by the door. Let\'s not wait for him.', 2600));
    await game.waitFor(() => S.calledRook || near(P.glass[0], P.glass[2], 2.6));

    // ---------- the man behind the glass ----------
    cine(true);
    pl.place(1.8, 0, -6.6, Math.PI);
    await game.shot([-0.8, 1.7, -3.4], [1.8, 1.4, -8.6], 1.2, { fov: 42 });
    audio.sfxPlay('blip');
    await game.talk([
      ['m12rook', 'Varen. Or whoever is wearing his face this week. You have four minutes left.'],
      ['kai', 'Bed four-oh-seven. Your memo. "Do not move the occupant."'],
      ['m12rook', 'I write a great many memos. Look down, Varen. I didn\'t put the lights on for myself.'],
    ]);
    // the hall lights come up on a man standing at the glass
    wShown = true; witness.root.position.set(...P.witnessHall); witness.root.rotation.y = 0; witness.lookTarget = kai.head;
    audio.silence(1.4); audio.sfxPlay('heartbeat');
    await game.shot([3.4, 1.6, -13.6], [1.8, 1.55, -8.4], 2.4, { fov: 34 });
    lockMusic('m12-glass', 0.6);
    await game.shot([1.0, 1.66, -6.5], [2.0, 1.62, -10.4], 1.8, { fov: 30 });
    await game.say('kai', 'A long coat.');
    // he taps the glass three times: the three notes of the motif
    witness.pose = 'look';
    for (const n of [76, 71, 69]) { if (audio.ctx) audio.glass(n, audio.ctx.currentTime, 0.08); game.shake = 0.02; await game.wait(0.55); game.shake = 0; }
    witness.pose = null;
    await game.shot([2.6, 1.5, -12.6], [1.8, 1.6, -7.2], 1.6, { fov: 32 });
    await game.talk([
      ['kai', 'Those three notes. Mira used to hum those.'],
      ['m12rook', 'That man is not one of mine. Varen. Who is in my test hall?'],
      ['kai', 'I was going to ask you.'],
    ]);
    audio.sfxPlay('alarm'); W.screens.lock.visible = true;
    await game.say('m12pa', 'Intruder, Test Hall C. Lockdown. Temporal dampers engaged.');
    witness.lookTarget = null;
    const exitWalk = walkTo(witness, [[4.0, 0, -12.2], [4.2, 0, -21.0], [0, 0, -23.6], [0, 0, -26]], 1.6);
    await game.shot([-3.0, 2.2, -2.0], [1.2, 1.4, -14], 2.6, { fov: 44, follow: witness.root });
    await game.talk([['m12rook', 'Stay exactly where you are, Varen.'], ['kai', 'No.']]);
    await exitWalk; wShown = false;
    F.m12witnessSeen = true;
    ev('The man behind the glass', 'At 23:41 a grey-haired man in a long coat stood inside Test Hall C, behind the glass of Gallery C, and tapped three notes on it: the tune Mira used to hum. Rook: "That man is not one of mine." Helix locked down. His wrist band glows red-orange.', 'TEST HALL C');
    cine(false); lockMusic(null);
    S.phase = 'chase'; setMood('m12-chase'); musicState.heat = 0.3;
    objective('Chase him · east door, the east run');
    game.checkpoint(5.5, 0, -3.5, -Math.PI / 2);
    hint(() => zone === 'gallery', 25, () => ui.subtitle('kai', 'The east door. He came out of the hall\'s far side. Go.', 2600));

    // optional: Rook's office (the door was left open in the lockdown)
    game.interact({ pos: [16.8, 1.1, -13.4], radius: 1.8, prompt: 'Read Rook\'s calendar', onUse: () => {
      F.m12rookOffice = true; audio.sfxPlay('blip');
      ev('Rook\'s calendar', 'Sat 23.10, 23:40: "Gallery C · K. VAREN (record: deceased 19.10)". 23:41: "Test Hall C · badge: —". 23:41: "LOCKDOWN · Director". Rook booked the meeting with a man his own system calls dead.', 'ROOK\'S OFFICE');
      ui.subtitle('kai', 'He booked the meeting. And the hall. A minute apart.', 3000);
    } });
    game.interact({ pos: [18.6, 1.7, -12.4], radius: 1.6, prompt: 'Look at the framed photograph', onUse: () => {
      F.m12photo = true;
      ev('Site Zero, 2029', 'A framed photograph in Rook\'s office: a survey trench in 2029 with two dark rings in the ground. Captioned "SITE ZERO · 2029 · A + B". Helix only ever spoke of one Chronolith.', 'ROOK\'S OFFICE');
      ui.subtitle('kai', 'Two rings in the ground. A and B. Helix only ever showed the world one.', 3600);
    } });

    // ---------- the east run: glimpse, the shutter, Echo Step ----------
    await game.waitFor(() => pl.pos.x > 8.2 && pl.pos.z < 1);
    if (once('glimpse1')) {
      cine(true);
      wShown = true; wEra = '2049'; witness.root.position.set(10, 0, -33); witness.root.rotation.y = Math.PI;
      const w1 = walkTo(witness, [[10, 0, -39.5], [6, 0, -42]], 1.6);
      await game.shot([9.2, 1.7, 1.6], [10, 1.4, -30], 1.8, { fov: 30, follow: witness.root });
      await game.say('kai', 'There. He isn\'t even running.');
      await w1; wShown = false;
      cine(false);
    }
    await game.waitFor(() => pl.pos.z < -15.5 && pl.pos.x > 7.8);
    // the lockdown shutter drops and jams at half a metre
    audio.sfxPlay('metal'); game.shake = 0.12;
    await tween(1.4, u => { W.shutter.mesh.position.y = 4.8 - u * 2.7; });
    game.shake = 0; audio.sfxPlay('boom');
    W.shutter.box.min.y = 0.5; W.shutter.box.enabled = true; S.shutterJammed = true;
    game.checkpoint(10, 0, -17.5, Math.PI);
    ui.subtitle('kai', 'Jammed at half a metre. Not enough to crawl.', 2600);
    await game.wait(1.6);
    ui.subtitle('kai', 'But enough for one second to slip through. Echo Step.', 3000);
    objective(game.touch?.enabled ? 'Echo Step through the jammed shutter · ECHO' : 'Echo Step through the jammed shutter · V');
    hint(() => pl.pos.z > -21, 30, () => ui.subtitle('kai', game.touch?.enabled ? 'Face the gap, close to it. ECHO.' : 'Right up to the gap, facing it. V.', 2600));
    await game.waitFor(() => pl.pos.z < -21.6 && pl.pos.x > 7.8);
    F.m12shutter = true;
    game.checkpoint(10, 0, -23, Math.PI);
    await game.talk([
      [radioId, 'Node two, lockdown\'s up. Anything on the east run?'],
      ['m12guard', 'Nothing came past us. Nothing on the cameras.'],
      [radioId, haleSide ? 'Then keep your eyes open. Rook says the man in the hall has Varen\'s face. Older.' : 'Rook wants the intruder and anyone with him. Detain on sight.'],
    ]);

    // ---------- the security node: crouch behind the crates, or leave them an afterimage ----------
    objective('Get past the security node · stay low behind the crates · or leave them an Echo to look at');
    const watch = { det: 0, focus: 0, focusAt: null };
    const guardEye = (g) => V(g.root.position.x, 1.62, g.root.position.z);
    const offGuards = game.onUpdate(dt => {
      if (T.current !== '2049' || !game.control || game._failing) return;
      const ghost = echo?.ghost?.root;
      // an afterimage in the open draws both of them for as long as it lingers
      if (ghost?.visible && Math.hypot(ghost.position.x - 14.5, ghost.position.z - 30) < 13) { watch.focus = 2.0; watch.focusAt = ghost.position.clone(); }
      watch.focus = Math.max(0, watch.focus - dt * (ghost?.visible ? 0 : 1));
      let seen = 0;
      for (const g of [guardA, guardB]) {
        const tgt = watch.focus > 0 && watch.focusAt ? watch.focusAt : null;
        if (tgt) g.faceTowards(tgt.x, tgt.z, dt, 3); else g.faceTowards(g === guardA ? 8 : 9, g === guardA ? -27.4 : -26, dt, 1.2);
        const eye = guardEye(g), chest = pl.pos.y + (pl.crouching ? 0.75 : 1.3);
        const dx = pl.pos.x - eye.x, dz = pl.pos.z - eye.z, d = Math.hypot(dx, dz);
        if (d > 12 || pl.pos.z > -24.4 || pl.pos.z < -36.5) continue;
        const fwd = V(Math.sin(g.root.rotation.y), 0, Math.cos(g.root.rotation.y)), ang = Math.acos(Math.max(-1, Math.min(1, (dx * fwd.x + dz * fwd.z) / Math.max(d, 1e-3))));
        if (ang > 0.75 && d > 2.4) continue;
        if (tgt && d > 2.6) continue;
        if (game.collision.blocked(eye, pl.pos, chest, '2049')) continue;
        seen = Math.max(seen, 1.4 - d / 12);
      }
      watch.det = Math.max(0, Math.min(1, watch.det + (seen > 0 ? dt * (0.35 + seen * 0.6) : -dt * 0.4)));
      ui.detection(watch.det);
      if (watch.det >= 1) {
        S.detained++; F.m12detained = S.detained; watch.det = 0;
        ui.subtitle('m12guard', 'Stop! Hands where I can see them!', 2000);
        game.fail('HELIX SECURITY · DETAINED');
      }
    });
    hint(() => pl.pos.z > -25 && pl.pos.z < -21.5, 40, () => ui.subtitle('kai', 'Crouch behind the crates and they won\'t see over them. Or give them something else to look at.', 3200));
    await game.waitFor(() => pl.pos.z < -36.4);
    offGuards(); ui.detection(0);
    F.m12node = true;
    game.checkpoint(10, 0, -38.6, Math.PI);

    // ---------- the north corridor: he waits at the end, then walks into the wall ----------
    await game.waitFor(() => pl.pos.z < -39.8);
    cine(true);
    wShown = true; wEra = '2049'; witness.root.position.set(-21.6, 0, -42); witness.root.rotation.y = Math.PI / 2; witness.lookTarget = kai.head;
    pl.place(9.6, 0, -41.6, -Math.PI / 2);
    await game.shot([10.6, 1.65, -40.8], [-21.6, 1.5, -42], 1.6, { fov: 22 });
    await game.say('kai', 'He\'s waiting for me.');
    witness.lookTarget = null;
    await walkTo(witness, [[-23.3, 0, -42]], 1.2);
    await witnessSwitch('2026');
    await walkTo(witness, [[-26, 0, -42]], 1.5); wShown = false;
    await game.say('kai', 'Into the wall. He walked into the wall.');
    audio.sfxPlay('drone');
    drone.mesh.visible = true; drone.disabled = false; drone.mesh.position.set(-19, 2.5, -42); drone.i = 1;
    await game.shot([4, 2.4, -41.0], [-16, 2.3, -42], 1.6, { fov: 38 });
    await game.say('m12pa', 'Pursuit drone deployed. North corridor.');
    cine(false);
    musicState.heat = 0.8;
    objective('Reach the end of the north corridor · duck into the doorways when the drone turns');
    let droneCaught = 0;
    const offDrone = game.onUpdate(dt => {
      if (T.current !== '2049' || game._failing || !game.control) return;
      const a = drone.update(dt); ui.detection(Math.min(1, a));
      if (a >= 1) { droneCaught++; S.detained++; F.m12detained = S.detained; drone.alert = 0; drone.mesh.position.set(-19, 2.5, -42); drone.i = 1; game.fail('DRONE LOCK · DETAINED'); }
    });
    hint(() => zone === 'north' && pl.pos.x > -20, 50, () => ui.subtitle('kai', droneCaught ? 'Doorway to doorway. Wait in each one until it\'s gone past.' : 'Three recessed doorways on the left. Use them.', 3000));
    await game.waitFor(() => pl.pos.x < -21.2 && pl.pos.z < -39.5);
    offDrone(); ui.detection(0); drone.disabled = true; drone.mesh.visible = false; drone.pool.visible = false;
    F.m12chase = true;

    // =====================================================================================
    // THE DEAD END: the dampers end where the old wing begins; a corridor that existed only in 2026
    // =====================================================================================
    cine(true);
    pl.place(-21.8, 0, -42, -Math.PI / 2);
    await game.shot([-19.4, 1.8, -40.8], [-24, 1.4, -42.2], 1.4, { fov: 42 });
    await game.talk([
      ['kai', 'A wall. In 2049, a wall.'],
      [radioId, haleSide ? 'Varen? I\'ve got you on the north camera. That\'s the old west service run. Bricked up in thirty-one.' : 'North corridor, intruder at the old west run. It\'s a dead end, Varen. Turn around.'],
      ['kai', 'The run was built in 2026. Before the wall.'],
    ]);
    await game.shot([-22.0, 2.9, -41.0], [-22.5, 3.05, -42], 1.0, { fov: 34 });
    await game.say('kai', 'And the dampers end here. This is the old wing. The band\'s free.');
    T.unlocked = true; T.locked = false; T.refreshHud();
    kai.wristBoost = 8; audio.sfxPlay('anomaly');
    cine(false);
    S.phase = 'run'; musicState.heat = 0; setMood('m12-glass');
    objective(game.touch?.enabled ? 'Use the corridor that existed only in 2026 · tap 2026' : 'Use the corridor that existed only in 2026 · press 1');
    game.checkpoint(-21.8, 0, -42, -Math.PI / 2);
    hint(() => T.current === '2049' && zone === 'north' && pl.pos.x < -16, 30, () => ui.subtitle('kai', 'Switch to 2026. The run is still open there.', 2600));
    await game.waitFor(() => T.current === '2026' && zone !== 'gallery');
    setMood('m12-2026');
    if (once('run26')) {
      cine(true);
      wShown = true; wEra = '2026'; witness.root.position.set(-33.2, 0, -42); witness.root.rotation.y = -Math.PI / 2;
      await game.shot([-22.8, 1.7, -41.2], [-33, 1.3, -42], 1.4, { fov: 36 });
      await game.say('kai', 'Bulbs on a cable. Wet concrete. 2026, and the run goes on.');
      witness.lookTarget = kai.head; await game.wait(0.8); witness.lookTarget = null;
      await witnessSwitch('2049');
      await walkTo(witness, [[-37, 0, -42]], 1.5); wShown = false;
      await game.say('kai', 'And he changed again. At the fence.');
      cine(false);
      objective('Follow the run west');
    }
    F.m12corridor2026 = true;

    // ---------- the trench: Records Storage B (2049, a room with no door) ----------
    await game.waitFor(() => pl.pos.x < -32.4 && zone === 'run');
    if (T.current === '2026') ui.subtitle('kai', 'A trench. Four metres down. In 2049 this part of the run is... something else.', 3200);
    objective('Cross the trench in another state');
    game.checkpoint(-32.8, 0, -42, -Math.PI / 2);
    hint(() => T.current === '2026' && pl.pos.x < -31 && pl.pos.x > -34.4, 30, () => ui.subtitle('kai', 'He switched to 2049 right here. Press 2.', 2400));
    await game.waitFor(() => T.current === '2049' && pl.pos.x < -31.2 && pl.pos.x > -45 && zone === 'run');
    if (once('records')) {
      cine(true);
      await game.shot([-32.4, 2.2, -38.4], [-40, 0.8, -43], 1.6, { fov: 48 });
      await game.talk([
        ['kai', 'A room with no door. Dust a centimetre deep.'],
        ['kai', 'And one set of footprints across it, going west.'],
      ]);
      cine(false);
    }
    objective('Cross Records Storage B · find where the run goes on in 2026');
    game.interact({ pos: [-38.0, 1.1, -42.3], radius: 1.8, prompt: 'Read the sealed order', states: ['2049'], onUse: () => {
      F.m12sealOrder = true; audio.sfxPlay('pickup');
      ev('Director\'s order SZ-B / 2031-03', '14.03.2031, E. Rook: "Sublevel 3, Chamber II: SITE ZERO ARTEFACT B. Seal the chamber and the west service run with it. Remove both from the drawings. No access, no log, no staff rotation. Artefact A remains the programme."', 'RECORDS STORAGE B');
      ui.subtitle('kai', 'Artefact B. Rook buried a second one, and bricked up the corridor that led to it.', 3600);
    } });
    game.interact({ pos: [-37.9, 1.1, -41.2], radius: 1.6, prompt: 'Read the 2026 visitor book', once: false, states: ['2049'], onUse: () => {
      F.m12book2049 = true; audio.sfxPlay('pickup');
      const txt = S.book === 'name' ? 'Two entries in the same hand, decades apart: "23:41 K. Varen, returning" in faded ink, and "23:52 K. Varen", which is how you signed it tonight. The first one is shakier.'
        : S.book === 'false' ? 'Two entries: "23:41 K. Varen, returning", and "23:52 J. Park", the name you gave the watchman tonight.'
          : 'One entry: "23:41 K. Varen, returning". Kai\'s own handwriting, older and shakier.';
      ev('The watchman\'s book', 'The 2026 west-wing visitor book, filed in Records Storage B. ' + txt, 'RECORDS STORAGE B');
      ui.subtitle('kai', S.book === 'name' ? 'My signature from ten minutes ago, twenty-three years old. And his, above it.' : '"K. Varen, returning." My handwriting. Not my hand.', 3600);
    } });
    await game.waitFor(() => pl.pos.x < -41.8 && zone === 'run');
    game.checkpoint(-43.4, 0, -42, -Math.PI / 2);
    hint(() => T.current === '2049' && pl.pos.x < -42, 30, () => ui.subtitle('kai', 'The west wall is solid in 2049. In 2026 the run carries on. Press 1.', 2600));
    await game.waitFor(() => T.current === '2026' && pl.pos.x < -45.5);
    objective('Follow the run to the west stair core');

    // ---------- Ben Asante, the 2026 night watchman ----------
    await game.waitFor(() => T.current === '2026' && pl.pos.x < -51.6);
    cine(true);
    ben.pose = null; ben.root.rotation.y = 1.9; ben.lookTarget = kai.head; kai.lookTarget = ben.head;
    pl.place(-52.6, 0, -41.4, -Math.PI / 2 - 0.5);
    lockMusic('m12-2026', 1);
    await game.shot([-51.2, 1.7, -42.8], [-55.4, 1.5, -38.2], 1.4, { fov: 40 });
    await game.talk([
      ['ben', 'Stop there. Hands where I can — ...you.'],
      ['ben', 'You\'re the second one tonight.'],
      ['kai', 'A man in a long coat. Older than me.'],
      ['ben', 'Walked out of that wall at twenty to midnight. Signed my book. Nobody signs my book.'],
      ['ben', 'Then he walked into the hoarding. Into the dig. There\'s nothing out there but a hole and Monday\'s concrete.'],
      ['kai', 'Not in every year there isn\'t.'],
    ]);
    F.m12ben = true;
    await game.shot([-53.4, 1.6, -40.0], [-54.5, 0.9, -37.4], 1.2, { fov: 36 });
    await game.say('ben', 'He wrote "returning". Like he\'d been here before. You look like his son.');
    kai.lookTarget = null; ben.lookTarget = null; ben.pose = 'sit';
    cine(false); lockMusic(null);
    ev('Ben Asante, west wing, 2026', 'The west wing\'s night watchman in 2026. At 23:40 a man in a long coat walked out of the run\'s east wall, signed the visitor book "K. Varen, returning", and walked into the west hoarding, toward the excavation.', 'WEST WING · 2026');
    game.checkpoint(-55, 0, -42, -Math.PI / 2);
    // optional: the visitor book, and more of Ben
    game.interact({ pos: P.book, radius: 1.6, prompt: 'Sign the visitor book', states: ['2026'], onUse: async () => {
      cine(true);
      await game.shot([-53.6, 1.5, -38.8], [-54.4, 0.8, -37.45], 1.0, { fov: 30 });
      await game.say('kai', '23:41. "K. Varen, returning." My handwriting. Older.');
      const c = await choose('kai', 'Sign the book?', ['Sign it: K. Varen', 'Sign a false name', 'Leave it'], 0);
      S.book = ['name', 'false', 'none'][c]; F.m12book = S.book;
      W.book26.material.map = TEX.bookPage(S.book); W.book26.material.needsUpdate = true;
      W.bookOld.material.map = TEX.bookPage(S.book); W.bookOld.material.needsUpdate = true;
      await game.say('ben', c === 0 ? 'Varen. Same as him. Of course it is.' : c === 1 ? 'Park. Right. And I\'m the King of Rain City.' : 'Suit yourself. He didn\'t mind.');
      cine(false);
    } });
    game.interact({ pos: [P.ben[0] + 0.6, 1.2, P.ben[2] - 0.4], radius: 2.0, prompt: 'Talk to Ben', states: ['2026'], enabled: () => !S.benTalk, onUse: async () => {
      S.benTalk = true; F.m12benTalk = true;
      ben.lookTarget = kai.head;
      await game.talk([
        ['kai', 'What are they building down here?'],
        ['ben', 'Whatever they\'re digging for, it\'s under my feet, and they pay me not to ask.'],
        ['ben', 'Some nights the radio picks up a station that isn\'t on yet. Weather for 2049. Rain, mostly.'],
        ['kai', 'Mostly.'],
      ]);
      ben.lookTarget = null;
    } });
    objective('Find where he went · the hoarding was a wall in 2026');
    hint(() => zone === 'lobby' && T.current !== '2196', 40, () => ui.subtitle('kai', T.current === '2049' ? 'Lockdown glass in 2049, hoarding in 2026. In 2196 that wall\'s just... gone. Press 3.' : 'In 2196 that wall\'s gone. Press 3.', 3200));
    await game.waitFor(() => T.current === '2196' && (zone === 'lobby' || zone === 'atrium'));

    // =====================================================================================
    // 2196: the ruined west atrium (switching locked by fracture interference)
    // =====================================================================================
    S.phase = 'atrium'; setMood('m12-ruin');
    cine(true);
    wShown = true; wEra = '2196'; witness.root.position.set(-72.5, 2.4, -71.5); witness.root.rotation.y = Math.PI; witness.lookTarget = kai.head;
    await game.shot([-56.4, 2.2, -41.2], [-72, 3.0, -58], 2.2, { fov: 50 });
    await game.say('kai', 'Helix. A hundred and fifty years from now.');
    await game.shot([-60.0, 3.4, -44.0], [-72.5, 3.6, -71.5], 2.0, { fov: 22 });
    await game.say('kai', 'And him. On the far slab. Still waiting.');
    witness.lookTarget = null;
    await walkTo(witness, [[-73, 2.4, -73.6], [-73, 0, -76]], 1.4); wShown = false;
    await game.shot([-60.0, 2.0, -43.0], [-66, 0.2, -50], 1.4, { fov: 46 });
    await game.say('kai', 'The ground floor\'s under three metres of water. Up the rubble, along the slabs.');
    cine(false);
    objective('Cross the ruined atrium · stay on the slabs');
    game.checkpoint(...P.ledge, -Math.PI / 2);
    let atriumCp = 0;
    const offAtrium = game.onUpdate(() => {
      const inA = zone === 'atrium';
      T.locked = inA;
      if (inA && T.current === '2196' && pl.pos.y < -1.0 && !game._failing) { S.falls++; F.m12falls = S.falls; game.fail('YOU WENT UNDER'); }
      if (pl.pos.y > 2.2 && pl.pos.x < -66.5 && pl.pos.z < -38 && pl.pos.z > -52 && atriumCp < 1) { atriumCp = 1; game.checkpoint(-71, 2.4, -46, Math.PI); }
      if (pl.pos.y > 2.2 && pl.pos.z < -60.2 && pl.pos.z > -64.2 && atriumCp < 2) { atriumCp = 2; game.checkpoint(-72, 2.4, -61.8, Math.PI); }
    });
    hint(() => zone === 'atrium' && pl.pos.y < 1 && pl.pos.x > -62, 35, () => ui.subtitle('kai', 'The rubble on the left climbs to the first slab.', 2600));
    hint(() => zone === 'atrium' && atriumCp === 1, 60, () => ui.subtitle('kai', 'The girder at the far end of the slab. One foot after the other.', 2600));
    if (!game.touch?.enabled) game.onUpdate(() => { if (zone === 'atrium' && atriumCp === 2 && pl.pos.z < -62.6 && once('gapBark')) ui.subtitle('kai', 'The catwalk\'s gone. Six metres. Echo Step, facing the far slab.', 3000); });
    else game.onUpdate(() => { if (zone === 'atrium' && atriumCp === 2 && pl.pos.z < -62.6 && once('gapBark')) ui.subtitle('kai', 'The catwalk\'s gone. Six metres. ECHO, facing the far slab.', 3000); });
    // Ife, a scout of Sera's people (optional)
    game.onUpdate(() => { if (T.current === '2196' && near(P.scout[0], P.scout[2], 7) && pl.pos.y > 2 && once('ifeBark')) ui.subtitle('ife', 'Easy. Hands. You\'re not the Grey Man. You\'re the young one.', 3200); });
    game.interact({ pos: [P.scout[0] + 0.6, 3.4, P.scout[2] - 0.2], radius: 2.2, prompt: 'Talk to the scout', states: ['2196'], enabled: () => !S.ifeTalk, onUse: async () => {
      S.ifeTalk = true; F.m12ife = true;
      ife.lookTarget = kai.head; kai.lookTarget = ife.head;
      cine(true);
      await game.shot([P.scout[0] + 2.4, 4.1, P.scout[2] - 1.2], [P.scout[0], 3.2, P.scout[2]], 1.2, { fov: 40 });
      await game.talk([
        ['ife', 'Ife. I keep the atrium for Sera. You\'re the one with his face, before it got old.'],
        ['kai', 'A man in a long coat. You\'ve seen him.'],
        ['ife', 'The Grey Man. Comes through every few nights. Never eats. Never sleeps here. Goes down into the ring and the ring goes quiet.'],
        F.metSera || F.m10metSera ? ['ife', 'Sera said one day there\'d be two of you. She said don\'t feed either.'] : ['ife', 'Sera says men with that band are why the sky looks like this.'],
        ['kai', 'Down. How?'],
        ['ife', 'Down\'s easy. It\'s the stair that won\'t hold you. He counts on it, out loud. Twenty-one. Forty-four. Then something with a minute in it.'],
        ['ife', 'Take the shiny thing by the drum if you want it. It hums. I hate it.'],
      ]);
      ev('Ife: the Grey Man', 'A scout of Sera Voss\'s people keeps watch over the drowned atrium in 2196. The "Grey Man" crosses it every few nights and goes down from Core Ring B. On the stair he counts out loud: "twenty-one, forty-four, then something with a minute in it."', 'WEST ATRIUM · 2196');
      ife.lookTarget = null; kai.lookTarget = null;
      cine(false);
    } });
    await game.waitFor(() => pl.pos.z < -74.6 && pl.pos.y < 1.2 && zone === 'hub');
    offAtrium(); T.locked = false;
    F.m12atrium = true;

    // =====================================================================================
    // CORE RING B: the trail goes cold; fragments of his route, thrown back up the shaft
    // =====================================================================================
    S.phase = 'hub'; setMood('m12-fragments');
    game.checkpoint(...P.hubIn, Math.PI);
    cine(true);
    await game.shot([-66.8, 3.4, -79.4], [-73, 0.8, -88], 2.0, { fov: 50 });
    await game.talk([
      ['kai', 'Gone. One room, three doors, three years, and no Witness.'],
      ['kai', 'Then where he went is in the room. Somewhere.'],
    ]);
    cine(false);
    objective(game.touch?.enabled ? 'Look for his trace · Residue Vision (eye button)' : 'Look for his trace · Residue Vision (F)');
    // fragment markers: red-orange swirls only seen in Residue Vision, in the state each one happened in
    FRAGS.forEach(f => {
      const g = new THREE.Group(); g.position.set(f.pos[0], 0.05, f.pos[2]); g.userData.noBatch = true;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 40), new THREE.MeshBasicMaterial({ color: 0xff6a4a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; g.add(ring);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 2.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xff6a4a, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); col.position.y = 1.1; g.add(col);
      g.visible = false; scene.add(g); f.g = g; return g;
    });
    const stencilCard = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending })); stencilCard.visible = false; scene.add(stencilCard);
    let loopT = 0, loopF = null;
    game.onUpdate((dt, t) => {
      for (const f of FRAGS) { f.g.visible = S.phase === 'hub' && game.residueOn && T.current === f.era && !S.playing; f.g.rotation.y = t * 0.6; f.g.children[0].material.opacity = f.read ? 0.3 : 0.7 + 0.2 * Math.sin(t * 4); }
      // the nearest fragment in this state repeats its few seconds on a loop (one ghost, reused)
      if (S.playing) return;
      let best = null, bd = 9;
      if (S.phase === 'hub' && game.residueOn) for (const f of FRAGS) { if (f.era !== T.current) continue; const d = Math.hypot(pl.pos.x - f.pos[0], pl.pos.z - f.pos[2]); if (d < bd) { bd = d; best = f; } }
      if (best !== loopF) { loopF = best; loopT = 0; }
      fragGhost.root.visible = !!best;
      if (best) {
        loopT = (loopT + dt) % 5;
        const u = best.act === 'walk' ? Math.min(1, loopT / 3.2) : 0.5, dir = V(Math.sin(best.yaw), 0, Math.cos(best.yaw));
        fragGhost.root.position.set(best.pos[0] - dir.x * 1.4 + dir.x * 2.8 * u, 0, best.pos[2] - dir.z * 1.4 + dir.z * 2.8 * u); fragGhost.root.rotation.y = best.yaw;
        fragGhost.speed = best.act === 'walk' && loopT < 3.2 ? 1.2 : 0; fragGhost.pose = loopT > 3.4 ? 'look' : null;
        setAlpha(fragGhost, Math.min(1, loopT * 2, (5 - loopT) * 2) * 0.6);
      }
    });
    const playFragment = async (f) => {
      S.playing = true; cine(true);
      const dir = V(Math.sin(f.yaw), 0, Math.cos(f.yaw)), inward = V(HUB.x - f.pos[0], 0, HUB.z - f.pos[2]).normalize();
      if (inward.lengthSq() < 0.5) inward.set(0, 0, 1);
      fragGhost.root.visible = true; fragGhost.root.position.set(f.pos[0] - dir.x * 1.4, 0, f.pos[2] - dir.z * 1.4); fragGhost.root.rotation.y = f.yaw; setAlpha(fragGhost, 0.7);
      const perp = V(inward.z, 0, -inward.x), kp = [f.pos[0] + inward.x * 1.9 + perp.x * 1.3, f.pos[2] + inward.z * 1.9 + perp.z * 1.3];
      pl.place(kp[0], 0, kp[1], Math.atan2(f.pos[0] - kp[0], f.pos[2] - kp[1]));
      const camP = [f.pos[0] + inward.x * 3.6 - perp.x * 1.0, 1.75, f.pos[2] + inward.z * 3.6 - perp.z * 1.0];
      if (f.landing) { stencilCard.material.map = TEX.stencil(f.landing, f.era); stencilCard.material.needsUpdate = true; stencilCard.position.set(f.pos[0] - inward.x * 0.9 - dir.x * 1.2, 1.6, f.pos[2] - inward.z * 0.9 - dir.z * 1.2); stencilCard.lookAt(camP[0], 1.6, camP[2]); stencilCard.visible = true; }
      await game.shot(camP, [f.pos[0], 1.3, f.pos[2]], 1.0, { fov: 40 });
      audio.sfxPlay('rewind');
      fragGhost.speed = f.act === 'walk' ? 1.2 : 0;
      const mv = f.act === 'walk' ? 1 : 0;
      if (!mv) fragGhost.root.position.set(f.pos[0], 0, f.pos[2]);
      await tween(2.4, u => { if (mv) fragGhost.root.position.set(f.pos[0] - dir.x * 1.4 + dir.x * 2.8 * u, 0, f.pos[2] - dir.z * 1.4 + dir.z * 2.8 * u); });
      fragGhost.speed = 0; fragGhost.pose = 'look';
      await game.say('m12band', 'Fragment ' + (f.landing ? 'landing ' + f.landing + ' · ' + f.era : 'arrival · ' + f.era) + ' · his band: ' + f.band + (f.repeat ? ' · repeat' : ''));
      await game.say('kai', f.line);
      fragGhost.pose = null; stencilCard.visible = false;
      cine(false); S.playing = false;
    };
    FRAGS.forEach(f => {
      f.it = game.interact({ pos: [f.pos[0], 1.0, f.pos[2]], radius: 2.0, prompt: 'Read the fragment', once: false, states: [f.era], enabled: () => game.residueOn && !f.read && !S.playing, onUse: async () => {
        if (f.read) return; f.read = true; S.fragsRead.add(f.id); musicState.frags = S.fragsRead.size; F.m12frags = S.fragsRead.size;
        await playFragment(f);
        ev('Fragment: ' + (f.landing ? 'landing ' + f.landing : 'arrival') + (f.repeat ? ' (repeat)' : ''), `Seen in ${f.era}, in Residue Vision, in Core Ring B: the Witness ${f.landing ? 'on landing ' + f.landing + ' of the sublevel stair' : 'arriving in the ring'}. His band reads ${f.band}. ${f.line}`, 'HIS ROUTE · ' + f.era);
        if (f.repeat) { F.m12repeat = true; }
        if (f.id === 'arrive') { await game.say('kai', 'The field down there throws back everything that passes through it, out of order. The rest of his trail is here, in this room. In other years.'); objective('Find the fragments of his route · in every state (1 · 2 · 3) with Residue Vision on'); }
        const landings = ['l1', 'l2', 'l3', 'l4'].filter(id => S.fragsRead.has(id)).length;
        if (landings >= 4 && !S.routeKnown) { objective('Reconstruct his route · at the north arch'); ui.subtitle('kai', 'Four landings. Four readings. Put them in order.', 2800); }
        else if (!S.routeKnown && f.id !== 'arrive') ui.toast(`LANDINGS FOUND ${landings}/4`, 1600);
      } });
    });
    hint(() => S.phase === 'hub' && !game.residueOn && S.fragsRead.size < 2, 30, () => ui.subtitle('kai', game.touch?.enabled ? 'Residue Vision. The eye.' : 'Residue Vision. F.', 2200));
    hint(() => S.phase === 'hub' && game.residueOn && S.fragsRead.size >= 1 && S.fragsRead.size < 5 && !S.routeKnown, 70, () => {
      const missing = FRAGS.find(f => !f.read && f.landing);
      if (missing) ui.subtitle('kai', `Nothing more in ${T.current}. Try ${missing.era}.`, 2600);
    });
    // the stair before the route is known: the field throws Kai straight back
    game.onUpdate(() => {
      if (S.routeKnown || game._failing || !game.control) return;
      if (pl.pos.z < -96.4 && pl.pos.z > -103) { pl.place(-73, 0, -94.4, Math.PI); audio.sfxPlay('rewind'); shiftPulse = 0.6; if (once('stairBack' + Math.floor(game.time / 8))) ui.subtitle('kai', 'It threw me straight back. I need to know how he crossed it.', 2800); }
    });

    // ---------- the reconstruction ----------
    game.interact({ pos: [P.board[0], 1.2, P.board[2]], radius: 2.2, prompt: 'Reconstruct the Witness\'s route', once: false, enabled: () => ['l1', 'l2', 'l3', 'l4'].every(id => S.fragsRead.has(id)) && !S.routeKnown && !S.boarding, onUse: async () => {
      S.boarding = true; cine(true);
      await game.shot([-70.6, 1.8, -89.6], [-73, 0.4, -96], 1.2, { fov: 46 });
      await game.say('kai', 'His band started at zero up here. Twenty-one, forty-four, one-oh-nine, one-thirty. One reading for every landing.');
      const opts = ['2026 · bulbs and wet formwork', '2049 · white panels', '2196 · moss and a hanging rail'], ids = ['2026', '2049', '2196'];
      for (let k = 0; k < 4; k++) {
        for (;;) {
          const c = await choose('kai', `Landing ${k + 1}: which state did he cross it in?`, opts, ids.indexOf(ROUTE[k]));
          if (ids[c] === ROUTE[k]) { audio.sfxPlay('success'); break; }
          S.boardMisses++; F.m12boardMisses = S.boardMisses; audio.sfxPlay('fail');
          const f = FRAGS.find(x => x.landing === k + 1);
          await game.say('kai', `No. The fragment with landing ${k + 1} on the wall played in ${f.era}. His band read ${f.band} there.`);
        }
      }
      S.routeKnown = true; S.boarding = false; F.m12route = ROUTE.join('-'); F.m12reconstructed = true;
      ev('His route down', 'Reconstructed from the fragments in Core Ring B: landing 1 in 2026 (+0:21), landing 2 in 2196 (+0:44), landing 3 in 2026 (+1:09), landing 4 in 2049 (+1:30). The field on the sublevel stair only holds in the state he crossed it in.', 'HIS ROUTE');
      await game.say('kai', 'One: 2026. Two: 2196. Three: 2026. Four: 2049. Cross each flight in his year, or the field throws me back up it.');
      cine(false);
      S.phase = 'descent'; setMood('m12-descent');
      objective('Follow his route down · L1 2026 · L2 2196 · L3 2026 · L4 2049');
      game.checkpoint(-73, 0, -94.4, Math.PI);
    } });
    await game.waitFor(() => S.routeKnown && !S.boarding);
    F.m12fragsRead = S.fragsRead.size;

    // =====================================================================================
    // THE DESCENT: four flights; each holds only in the state he crossed it in
    // =====================================================================================
    let lastLanding = 0;
    const offDescent = game.onUpdate(dt => {
      if (game._failing || !game.control) { S.inst = 0; return; }
      const z = pl.pos.z; let seg = -1;
      for (const s of SEGS) if (z < s.z0 - 0.2 && z > s.z1 + 0.2) seg = s.k;
      if (seg >= 0 && T.current !== ROUTE[seg]) S.inst = Math.min(1, S.inst + dt * 0.9); else S.inst = Math.max(0, S.inst - dt * 1.5);
      ui.detection(S.inst);
      for (const L of LANDINGS) if (Math.abs(z - L.z) < 1.2 && L.k > lastLanding) { lastLanding = L.k; musicState.landing = L.k; game.checkpoint(-73, L.y, L.z, Math.PI); }
      if (S.inst >= 1) {
        S.inst = 0; S.fieldFails++; F.m12fieldFails = S.fieldFails; ui.detection(0);
        game.fail('THE FIELD THREW YOU BACK');
        setTimeout(() => ui.subtitle('kai', `Flight ${seg + 1}. He crossed it in ${ROUTE[seg]}.`, 2600), 1500);
      }
      // the curtains glow calmer in the state each flight holds in, once Kai has crossed it
      W.curtains.forEach((c, i) => { const k = i >> 1; c.material.uniforms.uS.value = (k < lastLanding && T.current === ROUTE[k]) ? 0.05 : 0.13; });
    });
    hint(() => S.phase === 'descent' && S.inst > 0.3, 4, () => ui.subtitle('kai', 'Wrong year for this flight. Switch.', 1800));
    await game.waitFor(() => pl.pos.z < -126.4 && pl.pos.y < -7.5);
    offDescent(); ui.detection(0);
    F.m12descent = true;

    // =====================================================================================
    // CHAMBER II: the second Chronolith; the Witness; the scar; the fracture
    // =====================================================================================
    S.phase = 'chamber';
    cine(true); T.locked = true;
    if (T.current !== '2049') await T.switchTo('2049', { force: true, free: true, dur: 600 });
    lockMusic('m12-second', 1.2);
    wShown = true; wEra = '2049'; witness.root.position.set(...P.witnessCh); witness.root.rotation.y = Math.PI * 0.85; witness.pose = 'work';
    pl.place(-73, -8, -127.6, Math.PI); kai.lookTarget = null;
    await game.shot([-79.5, -3.4, -128.4], [-73, -5.2, -137], 0.01, { fov: 56 });
    await game.shot([-78.0, -4.6, -129.2], [-73, -5.0, -137], 4.0, { fov: 48 });
    await game.say('kai', 'A second one.');
    await game.shot([-72.2, -6.3, -127.8], [-71.4, -6.6, -133.2], 1.6, { fov: 38 });
    await game.talk([
      ['witness', 'You took the stairs in the right order. Good.'],
      ['kai', 'You\'ve held every door for me since the gallery.'],
      ['witness', 'Since long before the gallery.'],
    ]);
    witness.pose = null; witness.lookTarget = kai.head; kai.lookTarget = witness.head;
    pl.place(-72.6, -8, -129.6, Math.PI - 0.15);
    await tween(1.4, u => { witness.root.rotation.y = Math.PI * 0.85 + (-0.32 - Math.PI * 0.85) * u; });
    await game.shot([-73.4, -6.35, -128.6], [-71.4, -6.45, -133.2], 1.6, { fov: 30 });
    await game.say('kai', 'Who are you?');
    await game.shot([-71.9, -6.4, -131.6], [-71.4, -6.42, -133.3], 1.8, { fov: 24 });
    audio.silence(1.0); await game.wait(1.0);
    await game.say('witness', 'The person you become when you refuse to let go.');
    F.m12quote = true;
    audio.silence(1.6); await game.wait(1.6);
    await game.shot([-74.4, -6.2, -129.0], [-71.6, -6.5, -132.6], 1.2, { fov: 40 });
    const pick = await choose('kai', '...', ['Take hold of his wrist', 'Ask him about Mira'], 0);
    F.m12choice = pick === 0 ? 'grab' : 'ask';
    if (pick === 0) {
      kai.speed = 1.2; await tween(1.2, u => { pl.pos.set(-72.6 + 0.9 * u, -8, -129.6 - 2.1 * u); }); kai.speed = 0;
      await game.talk([
        ['witness', 'Careful. That arm has been broken in four different years.'],
        ['kai', 'Then one more won\'t matter. Show me.'],
      ]);
    } else {
      await game.talk([
        ['kai', 'Halden. Bed four-oh-seven. Is my sister alive?'],
        ['witness', '...Don\'t say her name in here.'],
        ['witness', 'Everything this thing touches, it keeps. I would rather it didn\'t keep her.'],
        ['witness', 'You want to know who I am. Look.'],
      ]);
    }
    // the wrist: his band, and under it the same burn
    witness.pose = 'look';
    const wristShot = async (ch, dist, fov) => {
      const wp = V(); wristNode(ch).getWorldPosition(wp);
      await game.shot([wp.x + dist, wp.y + 0.22, wp.z + dist * 0.6], [wp.x, wp.y, wp.z], 1.6, { fov });
    };
    await wristShot(witness, 0.55, 22);
    audio.sfxPlay('heartbeat');
    await game.say('kai', 'That scar. Under the band.');
    kai.pose = 'look';
    await wristShot(kai, -0.55, 22);
    await game.talk([
      ['kai', 'The Chronolith burned that into me when it bound to my wrist.'],
      ['witness', 'It doesn\'t heal. You just stop looking at it.'],
    ]);
    kai.pose = null; witness.pose = null;
    F.witnessScar = true; F.m12scar = true;
    ev('The same scar', 'Under the Witness\'s red-orange band: the same ring-shaped burn the Chronolith left on Kai\'s left wrist when it bound to him. "It doesn\'t heal. You just stop looking at it."', 'CHAMBER II');
    await game.shot([-75.2, -5.6, -129.8], [-72.4, -5.6, -136], 1.6, { fov: 44 });
    await game.talk([
      ['witness', 'Rook found two. He showed the world one, and buried the other under his own feet.'],
      ['kai', 'What are you doing with it?'],
      ['witness', 'Keeping a door open.'],
    ]);
    witness.lookTarget = null; witness.pose = 'work';
    await game.wait(0.6);
    // the fracture opens
    audio.sfxPlay('boom'); game.shake = 0.25; W.fracture.visible = true; W.fracture.scale.set(0.05, 1, 1);
    W.ch2.userData.disc.material.uniforms.uPower.value = 0.9;
    await tween(1.4, u => { W.fracture.scale.set(0.05 + 0.95 * u, 1, 1); });
    game.shake = 0.06;
    await game.say('m12pa', 'Field event. Chamber Two. Chamber Two is not on any drawing.');
    witness.pose = null; witness.lookTarget = kai.head;
    await game.shot([-70.6, -6.3, -129.6], [-70.4, -6.4, -133.6], 1.2, { fov: 34 });
    await game.talk([
      ['witness', 'You heard me once already. In the station, through every speaker in the city.'],
      ['witness', 'You didn\'t listen then, either.'],
      ['kai', 'Wait —'],
    ]);
    F.m12stationVoice = true;
    witness.lookTarget = null;
    // a moment of control: he walks; Kai runs
    cine(false); ui.letterbox(true);
    objective('Stop him');
    const fx = W.fracture.position;
    const wEscape = walkTo(witness, [[fx.x - 0.6, -8, fx.z + 0.6], [fx.x + 0.2, -8, fx.z - 0.2]], 1.3);
    const tEsc = game.time;
    await Promise.race([wEscape, game.waitFor(() => Math.hypot(pl.pos.x - fx.x, pl.pos.z - fx.z) < 2.6 || game.time - tEsc > 9)]);
    cine(true);
    kai.lookTarget = witness.head;
    await game.shot([-73.6, -6.0, -130.6], [fx.x, -6.4, fx.z], 0.5, { fov: 46 });
    await wEscape;
    witnessSwitch('2196');
    await tween(0.8, u => { W.fracture.scale.set(1 - 0.97 * u, 1, 1); witness.root.position.addScaledVector(V(0.4, 0, -0.5), 0.02); });
    wShown = false; W.fracture.visible = false;
    audio.sfxPlay('boom'); game.shake = 0.35; shiftPulse = 1.0; kai.pose = 'fall';
    W.ch2.userData.disc.material.uniforms.uPower.value = 0.08;
    await game.wait(0.9); game.shake = 0;
    audio.silence(2.2);
    await game.shot([-71.0, -7.2, -128.6], [-72.4, -7.6, -130.6], 2.0, { fov: 40 });
    await game.wait(1.0);
    kai.pose = null;
    await game.say('m12band', 'Signatures in field: two. Operator: K. Varen. Operator: K. Varen.');
    await game.shot([-74.6, -6.4, -128.4], [-73, -5.2, -137], 2.0, { fov: 42 });
    await game.talk([
      ['kai', 'Same band. Same scar. Same name.'],
      [radioId, haleSide ? 'Varen? Sublevel three just lit up on every board in the building. Rook\'s coming down himself.' : 'Varen. Sublevel three is lit on every board. Stay where you are. The director is coming down.'],
      ['kai', 'Good. Let him see what he buried.'],
    ]);
    F.secondChronolith = true; F.m12witnessEscaped = true; F.metWitness = true;
    ev('Chamber II', 'Under the west wing, below the stair the field guards: a second Chronolith, "Artefact B", sealed by Rook in 2031. The Witness: "The person you become when you refuse to let go." He bears Kai\'s wrist scar, said he was the voice in the station, opened a fracture with the second Chronolith and went through it. The band logged two operators: K. Varen, and K. Varen.', 'CHAMBER II');
    await game.shot([-66.8, -2.4, -126.8], [-73, -5.4, -137], 4.4, { fov: 52 });
    await ui.fade(1, 2400);
    const mins = Math.round((game.time - tStart) / 60);
    await ui.chapterCard('MISSION 12 COMPLETE', 'The Man Behind the Glass', `Fragments ${S.fragsRead.size}/6 · Shards ${S.shards}/5 · Notes ${S.notes}/3${S.book !== 'none' ? ' · You signed the book' : ''}${mins ? ' · ' + mins + ' min' : ''}`, 3800);
    F.m12done = true; F.m12shards = S.shards; F.m12evidence = S.ev.size;
    echo?.dispose(); T.locked = false; delete T.canSwitch; kai.lookTarget = null;
    game.releaseCam(); ui.letterbox(false); audio.allBeds(0); audio.setTheme(null);
  },
};
