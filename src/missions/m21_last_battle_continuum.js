// MISSION 21 · THE LAST BATTLE OF THE CONTINUUM (Act IV) — bring factions and combat systems together.
// Bible: "The Continuum wants one permanent timeline; the Witness wants to preserve Mira; the Unwritten wants to destroy
// the network." Playable sequence:
//   I    Infiltrate the command structure ........ the Bastion wall has no gap in 2196; Helix's 2049 fence has one, under
//                                                   a camera. The yard officer carries the door seal (stealth or fight).
//   II   Fight elite enemies who rewind injuries and restore armor ... Wardens of the Fixed Point (stun cracks a plate,
//                                                   displacement breaks the three seconds the suit keeps, then stun and
//                                                   restrain): the Register, then two waves on the Proving Floor.
//   III  Solve a multi-stage causal puzzle during an arena collapse .. the Unwritten blow the floor: lock damper N2 in
//                                                   2049 (the floor stops falling), balance the Halo's ballast in 2049 (the
//                                                   Cradle stops listing), set transfer beam TB-7 in 2026 (a span in 2196).
//   IV   Call on an ally earned through earlier choices .. trustedHale (Hale cuts the Helix grid that feeds the Wardens'
//                                                   armour), m10released (Teo and the freed prisoners), m13choice (Lasker's
//                                                   sappers / the Sable residents), m13senn, m15choice (Anja's frequency or
//                                                   the Lantern's held second), Sera's crew.
//   V    Confront the Witness ...................... a mirrored duel (he blocks from the front and rewinds like a Warden),
//                                                   then the bible quote. Ending: the Witness begins the final experiment.
// Quote: "I was trying to find a version of me that didn't have to." / "And did you?" / "No."
// Optional: Sera and Maeve Dunn at the forward post, Lasker's charge map, the loop-aware trooper's diary, the Order of
// the Last Lock, the corrected worlds, the Register (VAREN, K.), Rook's 2049 transfer memo, the archivist (let go or
// restrain), the three people held as fixed points (2049 floor sockets), the green-ink note on the 2026 site board, six
// temporal shards. Test hooks: window.__m21.
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { Combat, combatState } from '../systems/combat.js';
import { EchoStep } from '../systems/echostep.js';
import { Factions, hasSupport, factionStanding } from '../systems/factions.js';
import { registerM10Cast, TROOPER, TROOPER_F } from '../world/env_m10.js';
import { registerM13Cast } from '../world/env_m13.js';
import { registerM15Cast } from '../world/env_m15.js';
import { buildBastion, registerM21Cast, registerM21Themes, musicState, P, SHARDS, SLABS, WARDEN, WARDEN_F, HELD, ALLY_LOOKS, GUARD49, TEX } from '../world/env_m21.js';
import { Rain } from '../world/kit.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const GHOST_WIT = 0xff6a4a;

export default {
  id: 'm21', act: 'ACT IV · THE UNWRITTEN SECOND', title: 'The Last Battle of the Continuum', sub: 'One machine, three hands on it',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM10Cast(); registerM13Cast(); registerM15Cast(); registerM21Cast(); registerM21Themes();
    ui.missionTag('MISSION 21 · THE LAST BATTLE OF THE CONTINUUM');
    const portraits = (ids) => { try { const need = ids.filter(id => !ui.portraits[id] && CAST[id]?.look); if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]])))); } catch (err) { console.warn('m21 portraits', err); } };
    portraits(['sera', 'witness', 'prefect', 'lasker', 'anja', 'teo', 'senn', 'm21clerk', 'm21sapper', 'm21held', 'mira', 'hale', 'brandt']);
    const kai = pl.char;
    // ---------- what earlier missions left ----------
    const metSera = !!(F.metSera || F.m10metSera || F.m14metSera || F.m13done);
    const trust = F.seraTrust ?? 0, haleSide = F.trustedHale !== false;
    const iters = F.witnessIterations || 1046, pattern = F.miraPattern || 61;
    const m13 = F.m13choice || F.factionChoices?.m13 || null, m15 = F.m15choice || F.factionChoices?.m15 || null;

    const scene = game.newScene({ background: 0x5a4a50, fog: [0x5a4a50, 0.012], exposure: 1.05, bloom: 0.55, bloomThreshold: 0.82, envIntensity: 0.7, killY: -5, residue: false });
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    game.onUpdate(dt => RZ.update(dt));
    await tick();

    // ---------- state ----------
    const S = {
      phase: 'intro', obj: '', seen: {}, busy: false, main: false, ev: new Set(),
      seal: false, doorOpen: false, regDone: false, w1: false, w2: false,
      collapse: 0, damper: false, list: 18, tear: 0, level: false, plaque: false, slew: 2, beam: false, crossed: false,
      ally: null, allyCalled: false, standDone: false, wHits: 0, duelDone: false, readNoRewind: 0,
      shards: 0, pods: 0, clerk: null, alcove: false, seraTalk: false, sapper: false, diary: false, order: false, register: false, worlds: false, memo: false, board: false, camSeen: 0,
      elites: 0, restrained: 0, falls: 0, fails: 0, misses: 0, echoUses: 0,
    };
    const D96 = { id: '2196', key: '3', name: 'FUTURE', year: 'THE BASTION · 2196', glyph: '◑', color: '#ffd27a', theme: 'm21-dusk' };
    const D49 = { id: '2049', key: '2', name: 'PRESENT', year: 'HELIX HQ · 2049', glyph: '◎', color: '#5fe6ff', theme: 'm21-helix' };
    const D26 = { id: '2026', key: '1', name: 'PAST', year: 'THE SITE · 21.10.2026', glyph: '◐', color: '#ffe9c0', theme: 'm21-site' };
    T.configure([D96, D49, D26], '2196'); T.unlocked = false;

    const W = buildBastion(game, scene, T);
    game.onUpdate((dt, t) => W.update(dt, t));
    await tick();
    const rain = new Rain(RZ.getQuality() === 'low' ? 900 : 2200, 44); scene.add(rain.mesh); T.only(rain.mesh, '2049');
    game.onUpdate(dt => { const c = game.engine.camera.position; rain.mesh.visible = T.current === '2049' && c.z > -14.6; if (rain.mesh.visible) rain.update(dt, game.engine.camera); });

    // ---------- zones ----------
    const zone = (p = pl.pos) => {
      if (p.z > 34) return 'post';
      if (p.z > 9.5) return 'approach';
      if (p.z > -14.5) return 'yard';
      if (p.z > -41) return 'register';
      if (p.z > -76) return 'arena';
      if (p.z > -82) return 'chasm';
      return 'dais';
    };

    // ---------- light: a sky per state, one sun, a hemisphere, four nearest practicals ----------
    const LOOK = {
      '2196': { fog: [0x6a5260, 0.011], env: 0.72, hemi: [0xffc8a8, 0x2a2026, 0.55], sun: [0xff9a62, 1.9], dir: [-0.6, 0.24, 0.45], exp: 1.06, bg: 0x6a5260, beds: { wind: 0.14, hum: 0.02, hz: 46 } },
      '2049': { fog: [0x1e2632, 0.016], env: 0.75, hemi: [0x8aa0c8, 0x1a1c24, 0.6], sun: [0x9ab0ff, 0.55], dir: [0.3, 0.6, -0.4], exp: 1.2, bg: 0x1e2632, beds: { rain: 0.32, hum: 0.03, hz: 60, wind: 0.05 } },
      '2026': { fog: [0xb8b8b0, 0.008], env: 0.9, hemi: [0xf0ece0, 0x6a6458, 0.62], sun: [0xfff0d8, 1.8], dir: [-0.3, 0.75, 0.35], exp: 1.0, bg: 0xb8b8b0, beds: { wind: 0.06, hum: 0.02, hz: 90 } },
    };
    const LOOK_IN = {   // inside the Bastion / Helix HQ: cooler, cleaner light than the dusk outside
      '2196': { fog: [0x4a474c, 0.009], hemi: [0xeef0ff, 0x4a4438, 0.75], sun: [0xffc8a0, 1.4], exp: 1.02 },
      '2049': { fog: [0x1a2028, 0.010], hemi: [0xdde8ff, 0x3a3e46, 0.95], exp: 1.15 },
    };
    const skies = { '2196': { preset: 'sunset', elevation: 5, azimuth: 245, turbidity: 6, cover: 0.7 }, '2049': { preset: 'night-city', cover: 0.95 }, '2026': { preset: 'overcast', elevation: 34, azimuth: 160, cover: 0.7 } };
    const envs = {};
    for (const [e, o] of Object.entries(skies)) { try { envs[e] = RZ.skyEnvironment(renderer, scene, { ...o, apply: false }); } catch (err) { console.warn('m21 sky', err); } }
    const Q = RZ.getQuality();
    const hemi = new THREE.HemisphereLight(0xb8c8d0, 0x2a2a2c, 0.5); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.castShadow = true;
    sun.shadow.mapSize.set(Q === 'high' ? 2048 : Q === 'low' ? 512 : 1024, Q === 'high' ? 2048 : Q === 'low' ? 512 : 1024);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 170 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    const pts = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    const sunDir = V(0.5, 0.6, 0.3).normalize();
    let lookKey = null, lightT = 0, indoor = null;
    const applyLook = () => {
      const e = T.current, inside = pl.pos.z < -14.6, L = inside && LOOK_IN[e] ? { ...LOOK[e], ...LOOK_IN[e] } : LOOK[e]; lookKey = e; indoor = inside;
      scene.fog.color.set(L.fog[0]); scene.fog.density = L.fog[1] * (inside ? 0.7 : 1);
      const env = envs[e];
      if (env) { scene.environment = env.envMap; scene.environmentIntensity = L.env * (inside && e === '2049' ? 0.8 : 1); scene.background = env.background || new THREE.Color(L.bg); } else scene.background = new THREE.Color(L.bg);
      hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2] * (inside ? 0.85 : 1);
      sun.color.set(L.sun[0]); sun.intensity = L.sun[1] * (inside && e !== '2026' ? 0.6 : 1); sunDir.set(...L.dir).normalize();
      renderer.toneMappingExposure = L.exp;
      const b = L.beds; audio.rain(b.rain || 0); audio.wind(inside ? (b.wind || 0) * 0.4 : (b.wind || 0)); audio.hum(b.hum || 0, b.hz || 52);
      lightT = 0; music();
    };
    const rigLights = () => {
      const p = game.cine ? game.engine.camera.position : pl.pos, e = T.current;
      const list = W.lightSrc.filter(s => s.era === e || s.era === 'all' || !s.era).map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      pts.forEach((l, i) => { const s = list[i]; if (!s || s.dd > 44 * 44) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
    };
    game.onUpdate(dt => {
      const p = game.cine ? game.engine.camera.position : pl.pos;
      sun.target.position.set(p.x, p.y, p.z); sun.position.set(p.x + sunDir.x * 70, p.y + sunDir.y * 70 + 4, p.z + sunDir.z * 70);
      lightT -= dt; if (lightT <= 0) { lightT = 0.35; rigLights(); if (T.current !== lookKey || (pl.pos.z < -14.6) !== indoor) applyLook(); }
    });
    T.onSwitch(() => applyLook());

    // ---------- music follows the beats ----------
    let curTheme = null, musicLock = null;
    const themeFor = () => {
      if (musicLock) return musicLock;
      const e = T.current, z = zone(), fight = combatState.fighting || combatState.threat > 0.25;
      if (e === '2026') return 'm21-site';
      if (S.phase.startsWith('collapse')) return e === '2049' ? 'm21-helix' : 'm21-collapse';
      if (e === '2049') return 'm21-helix';
      if (S.phase === 'stand') return S.allyCalled ? 'm21-ally' : 'm21-battle';
      if (S.phase === 'duel' || S.phase === 'end') return 'm21-witness';
      if (S.phase === 'arena') return 'm21-battle';
      if (z === 'register') return fight ? 'm21-battle' : 'm21-register';
      if (z === 'yard' || (z === 'approach' && pl.pos.z < 30) || fight) return 'm21-stealth';
      return 'm21-dusk';
    };
    function music(fade = 1.6) { const th = themeFor(); for (const d of [D96, D49, D26]) d.theme = th; if (th !== curTheme) { curTheme = th; audio.setTheme(th, fade); } }
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    let mT = 0; game.onUpdate(dt => { mT -= dt; if (mT <= 0) { mT = 0.5; musicState.threat = combatState.threat || 0; musicState.alert = combatState.alert || 0; music(); } });

    // ---------- helpers ----------
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag) => { if (S.ev.has(title)) return; S.ev.add(title); ui.addEvidence(title, text, tag); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const choose = (id, text, opts, correct = 0) => { if (game.autoplay) game.autoChoice = game.autoQueue?.length ? game.autoQueue.shift() : correct; return game.choice(id, text, opts); };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive || S.busy || S.main) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u), u); if (u >= 1) { off(); res(); } }); });
    const side = async (fn) => {
      if (S.busy || !game.control || game._failing) return; S.busy = true;
      try { await fn(); } catch (err) { if (err?.abort || err?.name === 'Abort') throw err; console.warn('m21 side', err); } finally { S.busy = false; if (!S.main) { game.control = true; ui.letterbox(false); game.releaseCam(); } refresh(); }
    };
    const act = (o) => {
      const it = game.interact({ radius: 1.8, ...o, once: false, onUse: (x) => { if (S.busy || game._failing) return; if (o.enabled && !o.enabled()) return; if (o.states && !o.states.includes(T.current)) return; o.onUse(x); } });
      it.done = () => game.removeInteract(it);
      return it;
    };
    const faceEach = (a, b) => {
      const pa = a === kai ? pl.pos : a.root.position, pb = b === kai ? pl.pos : b.root.position;
      const ya = Math.atan2(pb.x - pa.x, pb.z - pa.z), yb = Math.atan2(pa.x - pb.x, pa.z - pb.z);
      if (a === kai) { pl.yaw = ya; kai.root.rotation.y = ya; } else a.root.rotation.y = ya;
      if (b === kai) { pl.yaw = yb; kai.root.rotation.y = yb; } else b.root.rotation.y = yb;
      a.lookTarget = b.head; b.lookTarget = a.head;
    };
    const convo = async (who, lines) => { faceEach(kai, who); who.talk = true; await game.talk(lines); who.talk = false; kai.lookTarget = null; who.lookTarget = null; };
    const walkTo = (ch, pts, speed = 1.3) => new Promise(res => {
      let i = 0; const off = game.onUpdate(dt => {
        const p = ch.root.position, q = pts[i]; if (!q) { ch.speed = 0; off(); res(); return; }
        const dx = q[0] - p.x, dz = q[2] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.15) { i++; return; }
        const s = Math.min(speed, d / Math.max(dt, 1e-3)); p.x += dx / d * s * dt; p.z += dz / d * s * dt; ch.speed = s; ch.faceTowards(q[0], q[2], dt, 6);
      });
    });
    const stage = (id, look, x, y, z, ry) => { const c = game.actor(id, look, x, y, z, ry); c.update?.(0); return c; };
    const unstage = (c) => { if (!c) return; c.root.parent?.remove(c.root); for (const k in game.actors) if (game.actors[k] === c && k !== 'kai') delete game.actors[k]; };

    // ---------- era rules ----------
    const solidAt = (id) => {
      const p = pl.pos, y0 = p.y + 0.45, y1 = p.y + 1.6; let ground = false;
      for (const b of game.collision.boxes) {
        if (!b.enabled || (b.states && !b.states.includes(id)) || b.walkOnly) continue;
        if (!(p.x > b.min.x - 0.28 && p.x < b.max.x + 0.28 && p.z > b.min.z - 0.28 && p.z < b.max.z + 0.28)) continue;
        if (b.max.y > y0 && b.min.y < y1) return 'solid';
        if (p.x > b.min.x - 0.05 && p.x < b.max.x + 0.05 && p.z > b.min.z - 0.05 && p.z < b.max.z + 0.05 && b.max.y <= p.y + 0.45 && b.max.y > p.y - 1.6) ground = true;
      }
      return ground ? null : 'void';
    };
    const allowed = () => {
      if (T.locked) return [T.def() || D96];
      const z = zone();
      if (S.phase.startsWith('collapse')) return S.plaque && (z === 'arena' || z === 'chasm') ? [D96, D49, D26] : [D96, D49];
      return [D96, D49];
    };
    let defsKey = '';
    game.onUpdate(() => {
      const list = allowed(); if (!list.find(d => d.id === T.current)) list.push(T.def() || D96);
      const key = list.map(d => d.id).join();
      if (key !== defsKey) { defsKey = key; T.defs = list.sort((a, b) => a.key.localeCompare(b.key)); T.refreshHud(); }
    });
    const baseCan = T.canSwitch.bind(T);
    T.canSwitch = (id) => {
      if (!baseCan(id)) return false;
      if (!allowed().find(d => d.id === id)) { if (id === '2026' && once('no26' + Math.floor(game.time / 5))) ui.toast('THE BAND CAN\'T FIND 2026 HERE YET', 1800); return false; }
      const s = solidAt(id);
      if (s) { if (once('solid' + id + Math.floor(game.time / 3))) { ui.toast(s === 'solid' ? `SOLID HERE IN ${id} · MOVE TO OPEN FLOOR` : `NOTHING TO STAND ON HERE IN ${id}`, 1800); audio.sfxPlay('fail'); } return false; }
      return true;
    };
    const lockEras = (on) => { T.locked = on; T.refreshHud(); };

    // ---------- combat: troopers, Wardens (rewind + armour), the Witness ----------
    const C = new Combat(game, {
      hp: 5, cellRegen: 2.4,
      onDown: () => C.fail('YOU WERE TAKEN DOWN'),
      onCaught: () => C.fail('CAPTURED'),
      onHit: (e, mode) => { if (e.el) eliteHit(e, mode); else if (e.wit) witnessHit(e, mode); },
      onDisplace: (e) => { if (e.wit) { e.shieldUp = false; e.shieldMesh && (e.shieldMesh.visible = false); e.wDown = 3; } },
      onTakedown: (e) => { S.restrained++; if (e.officer) takeSeal(); },
      onRestrain: (e) => { S.restrained++; if (e.el) { S.elites++; e.el.label.visible = false; } if (e.officer) takeSeal(); },
    });
    C.showHud(false);
    const echo = new EchoStep(game, { combat: C, cost: 0.3, cooldown: 7, linger: 4 });
    echo.onStep = () => { S.echoUses++; };
    const FX = new Factions(game, { factions: { allies: { name: 'ALLIES', short: 'ALLIES', color: '#b6ff8a', glyph: '✚', blurb: 'People who remember what you did for them.' } } });
    FX.show(false);
    const cp = (x, y, z, yaw, extra) => { game.checkpoint(x, y, z, yaw, () => { C.reset(); resetElites(); S.fails++; extra?.(); refresh(); }); };

    // Wardens of the Fixed Point: plates and a memory of the last three seconds
    const LABELS = {};
    const labelTex = (armor, max, mem) => {
      const k = armor + '/' + max + (mem ? 'm' : '');
      if (LABELS[k]) return LABELS[k];
      const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
      g.fillStyle = 'rgba(8,10,14,0.6)'; g.fillRect(0, 8, 256, 48);
      for (let i = 0; i < max; i++) { g.fillStyle = i < armor ? '#ffd27a' : 'rgba(255,210,122,0.18)'; g.beginPath(); const x = 22 + i * 34; g.moveTo(x, 18); g.lineTo(x + 13, 25); g.lineTo(x + 13, 39); g.lineTo(x, 46); g.lineTo(x - 13, 39); g.lineTo(x - 13, 25); g.closePath(); g.fill(); }
      g.font = '700 20px "Atkinson Hyperlegible", Arial, sans-serif'; g.textBaseline = 'middle'; g.fillStyle = mem ? '#9fe8ff' : '#ffd27a';
      g.fillText(mem ? 'REWIND BROKEN' : '↺ REWIND', 22 + max * 34, 33);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; LABELS[k] = t; return t;
    };
    const plateMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85, toneMapped: false });
    const plateGeo = new THREE.CircleGeometry(0.075, 6);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const ringGeo = new THREE.TorusGeometry(0.9, 0.04, 6, 40);
    const elites = [];
    const makeElite = (e, max = 2) => {
      const plates = [];
      for (let i = 0; i < max; i++) { const m = new THREE.Mesh(plateGeo, plateMat); m.position.set(i === 0 ? -0.1 : 0.1, 1.48, 0.2); e.char.root.add(m); plates.push(m); }
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(max, max, false), transparent: true, depthTest: false, toneMapped: false }));
      label.scale.set(1.2, 0.3, 1); label.renderOrder = 11; scene.add(label);
      const ring = new THREE.Mesh(ringGeo, ringMat.clone()); ring.rotation.x = PI / 2; ring.visible = false; scene.add(ring);
      e.el = { armor: max, max, mem: 0, rewindAt: 0, regen: 0, plates, label, ring, ringT: 0, home: max };
      elites.push(e); return e;
    };
    const paintElite = (e) => { const el = e.el; el.plates.forEach((p, i) => { p.visible = i < el.armor; }); el.label.material.map = labelTex(el.armor, el.max, el.mem > 0 || S.noRewind); el.label.material.needsUpdate = true; };
    const pulse = (e) => { e.el.ring.visible = true; e.el.ringT = 1; };
    function eliteHit(e, mode) {
      const el = e.el;
      if (mode === 'displace') {
        el.mem = 12; paintElite(e);
        ui.toast('REWIND BROKEN · 12 s · NOW STUN AND RESTRAIN', 1900);
        return;
      }
      if (el.armor > 0) {
        el.armor--; el.regen = 0;
        e.state = 'alert'; e.stunT = 0; e.char.frozen = false; e.bubble.visible = false; e.alert = 1; e.last.copy(pl.pos); e.cool = Math.max(e.cool, 0.6);
        audio.sfxPlay('metal'); paintElite(e);
        ui.toast(el.armor > 0 ? `PLATE CRACKED · ${el.armor} LEFT` : 'PLATES DOWN · DISPLACE IT (HOLD) BEFORE IT REWINDS', 1900);
        return;
      }
      if (el.mem <= 0 && !S.noRewind) { el.rewindAt = 1.8; if (once('rwTip')) ui.toast('IT KEEPS ITS LAST THREE SECONDS · THROW IT BACK FIRST (HOLD)', 2600); }
      else el.rewindAt = 0;
    }
    function rewindElite(e, restoreArmor = true) {
      const el = e.el; el.rewindAt = 0;
      if (e.state === 'stunned') { e.state = 'alert'; e.stunT = 0; e.char.frozen = false; e.bubble.visible = false; e.last.copy(pl.pos); }
      if (restoreArmor && !S.noArmor) el.armor = el.max;
      S.readNoRewind++; audio.sfxPlay('rewind'); pulse(e); paintElite(e);
      ui.subtitle('m21band', restoreArmor ? 'It rewound. The plates are back.' : 'It rewound the stun.', 2200);
    }
    function resetElites() { for (const e of elites) { if (e.state === 'down') continue; const el = e.el; el.armor = S.noArmor ? 0 : el.max; el.mem = 0; el.rewindAt = 0; el.regen = 0; paintElite(e); } }
    game.onUpdate((dt) => {
      for (const e of elites) {
        const el = e.el, rp = e.char.root.position;
        el.label.visible = e.enabled && e.state !== 'down' && e.char.root.visible && T.current === '2196' && !!e.char.root.parent;
        el.label.position.set(rp.x, rp.y + 2.55, rp.z);
        if (el.ringT > 0) { el.ringT = Math.max(0, el.ringT - dt * 1.4); el.ring.position.set(rp.x, rp.y + 1.0 + (1 - el.ringT) * 0.8, rp.z); el.ring.scale.setScalar(0.6 + (1 - el.ringT) * 1.4); el.ring.material.opacity = el.ringT * 0.7; el.ring.visible = el.ringT > 0; }
        if (!e.enabled || e.state === 'down') continue;
        if (!game.control || ui.dlgActive) continue;
        const memBefore = el.mem > 0; el.mem = Math.max(0, el.mem - dt); if (memBefore && el.mem <= 0) paintElite(e);
        if (e.state === 'stunned') { if (el.rewindAt > 0 && el.mem <= 0 && !S.noRewind && !(S.lanternT > 0)) { el.rewindAt -= dt; if (el.rewindAt <= 0) rewindElite(e, true); } continue; }
        el.regen += dt;
        if (el.regen > 9 && el.armor < el.max && el.mem <= 0 && !S.noArmor && !S.noRewind) { el.armor++; el.regen = 0; pulse(e); paintElite(e); audio.sfxPlay('rewind'); if (once('armorTip')) ui.toast('ARMOUR RESTORED · IT REWOUND ITS PLATES', 1900); }
      }
      if (S.lanternT > 0) S.lanternT -= dt;
    });
    const enemy = (look, x, z, yaw, o = {}) => {
      const ch = stage(o.id || ('m21e' + Math.random().toString(36).slice(2, 7)), { ...look }, x, 0, z, yaw); T.only(ch.root, '2196');
      const e = C.addEnemy(ch, { states: ['2196'], range: 12, fov: 0.66, speed: 1.2, run: 3.0, keep: 7, rate: 2.8, telegraph: 0.9, stunTime: 8, kind: 'trooper',
        barks: { spot: ['Contact. It\'s him.', 'Varen. On the floor.', 'There. By the pods.'], search: ['He was here a second ago.', 'Check the shadows.'], lost: ['Nothing. Back to the line.'], yield: ['Enough. I yield.'] }, voice: 'm21trooper', ...o });
      return e;
    };
    const warden = (x, z, yaw, o = {}) => {
      const e = enemy(o.female ? WARDEN_F : WARDEN, x, z, yaw, { kind: 'warden', surrenders: false, noTakedown: true, range: 15, rate: 2.2, telegraph: 0.75, stunTime: 7, run: 3.2, keep: 8,
        barks: { spot: ['Varen. We have kept this second for you.', 'Again, then.'], search: ['You cannot hide from a fixed point.'], lost: ['He will come back. He always does.'] }, voice: 'm21warden', ...o });
      return makeElite(e, o.armor ?? 2);
    };
    const clearWave = (list) => { for (const e of list) { if (e.el) { e.el.label.parent?.remove(e.el.label); e.el.ring.parent?.remove(e.el.ring); elites.splice(elites.indexOf(e), 1); } C.removeEnemy(e); unstage(e.char); } };

    // ---------- shards ----------
    W.shards.forEach((s) => act({ pos: [s.x, s.y + 0.4, s.z], radius: 1.7, prompt: 'Take the temporal shard', states: [s.e], enabled: () => !s.got && T.current === s.e,
      onUse: () => { s.got = true; s.m.visible = false; S.shards++; F.shards = (F.shards || 0) + 1; audio.sfxPlay('pickup'); ui.toast(`TEMPORAL SHARD · ${S.shards}/${SHARDS.length}`, 2200); } }));

    // ---------- the cast at the forward post ----------
    const sera = stage('sera', null, ...P.sera, PI * 0.15); sera.root.userData.states = ['2196']; T.only(sera.root, '2196');
    const sapper = stage('m21sapper', null, ...P.sapper, -PI * 0.7); T.only(sapper.root, '2196'); sapper.pose = 'work';
    const fighters = [stage('m21post1', { ...ALLY_LOOKS[0] }, -7.6, 0, 36.2, PI), stage('m21post2', { ...ALLY_LOOKS[1] }, 8.4, 0, 36.4, PI)];
    fighters.forEach(f => { T.only(f.root, '2196'); f.crouch = 1; });

    // ---------- I · the Approach and the wall ----------
    const outside = [
      enemy(TROOPER, -14, 18, PI / 2, { patrol: [[-14, 18], [-3, 18]] }),
      enemy(TROOPER_F, 14, 21, -PI / 2, { patrol: [[14, 21], [3, 21]] }),
    ];
    // the 2049 dock camera: a footprint that sweeps the gap
    const camFoot = V(14, 0, 12.7); let camT = 0, camDet = 0;
    const _q = new THREE.Quaternion(), _down = V(0, -1, 0), _d = V();
    game.onUpdate((dt) => {
      camT += dt; camFoot.set(14 + Math.sin(camT * 0.55) * 2.9, 0, 12.4 + Math.cos(camT * 0.55 * 2) * 0.8);
      const apex = V(...P.camera); _d.copy(camFoot).sub(apex); const len = _d.length(); _d.normalize();
      _q.setFromUnitVectors(_down, _d); W.camCone.quaternion.copy(_q); W.camCone.scale.set(1, len / 5.2, 1);
      W.cam.lookAt(camFoot);
      if (S.phase !== 'approach' || T.current !== '2049' || !game.control || game._failing) { if (camDet > 0) { camDet = Math.max(0, camDet - dt); ui.detection(camDet); } return; }
      const d = Math.hypot(pl.pos.x - camFoot.x, pl.pos.z - camFoot.z);
      if (d < 1.9 && pl.pos.z < 16 && pl.pos.z > 9.5) { camDet = Math.min(1, camDet + dt * (pl.crouching ? 0.9 : 1.6)); if (once('camBark' + Math.floor(game.time / 6))) audio.sfxPlay('drone'); }
      else camDet = Math.max(0, camDet - dt * 0.6);
      ui.detection(camDet);
      if (camDet >= 1) { camDet = 0; S.camSeen++; ui.detection(0); game.fail('HELIX SECURITY · THE CAMERA SAW YOU'); }
    });

    // ---------- the yard ----------
    const yard = [
      enemy(TROOPER, -12, 4, PI, { patrol: [[-12, 4], [-12, -8]], wait: 2.6 }),
      enemy(TROOPER_F, 12, -8, 0, { patrol: [[12, -8], [12, 4]], wait: 2.6 }),
      enemy(TROOPER, -6, 1.2, PI / 2, { patrol: [[-6, 1.2], [6, 1.2]], wait: 3.0 }),
    ];
    const officer = enemy({ ...TROOPER, costume: 'continuum_2', belt: 0xd9a441, age: 46, hair: 0x6a6a64, hairStyle: 'short', skin: 0xe2b896 }, -4, -11.6, PI / 2, { id: 'm21officer', kind: 'officer', patrol: [[-4, -11.6], [4, -11.6]], speed: 0.9, wait: 3.4, range: 10, name: 'PRIOR HALVARD' });
    officer.officer = true;
    function takeSeal() { if (S.seal) return; S.seal = true; audio.sfxPlay('pickup'); ui.toast('ACCESS SEAL TAKEN · PRIOR HALVARD', 2200); W.doorReader.material.color?.set(0x000000); W.doorReader.material.emissive?.set(0xffd27a); refresh(); }

    // ---------- the door ----------
    act({ pos: [0, 1.2, -13.4], radius: 2.4, prompt: 'Open the Bastion door with the seal', states: ['2196'], enabled: () => S.seal && !S.doorOpen, onUse: () => side(openDoor) });
    act({ pos: [0, 1.2, -13.4], radius: 2.4, prompt: 'The door reads a seal', states: ['2196'], enabled: () => !S.seal && !S.doorOpen && S.phase !== 'approach',
      onUse: () => side(async () => { await game.say('kai', 'A seal reader. Gold. The officer pacing by the door wears one.'); }) });
    async function openDoor() {
      S.main = true; cine(true);
      await game.shot([3.2, 2.2, -9.2], [0, 2.6, -14.5], 1.2, { fov: 46 });
      audio.sfxPlay('door');
      await tween(2.0, k => { W.door.position.y = 3.1 + k * 6.0; });
      W.doorBox.enabled = false; S.doorOpen = true;
      await game.say('m21band', 'Seal accepted. Prior Halvard, Register access.');
      S.main = false; cine(false);
    }

    // ---------- optional: the forward post ----------
    act({ pos: [P.sera[0], 1.2, P.sera[2]], radius: 2.2, prompt: 'Talk to Sera', states: ['2196'], enabled: () => !S.seraTalk && S.phase !== 'intro',
      onUse: () => side(async () => {
        S.seraTalk = true;
        await convo(sera, [
          ['kai', 'You stayed at the ring three days waiting for me to come out of it.'],
          ['sera', 'Somebody had to. You were talking in your sleep with your eyes open.'],
          ['kai', 'What did I say?'],
          ['sera', 'Her name. And numbers. Sixty-one, mostly.'],
          ...(trust < 0 ? [['sera', 'I still don\'t trust you, Varen. But I trust Adair less, and Lasker has stopped listening to anyone.']] : [['sera', 'Get her out of that machine if you can. Then get yourself out. In that order, if you have to choose.']]),
          ['kai', 'And if I can\'t do both?'],
          ['sera', 'Then you\'ll be the first man in history I\'ve ever wanted to be wrong about.'],
        ]);
        F.seraTrust = (F.seraTrust ?? 0) + 0; ev('Sera at the forward post', 'Sera Voss waited three days at the ring in Test Hall C for Kai to come back out of the Unwritten Second. The Continuum took the ring the next morning.', 'People');
      }) });
    act({ pos: [P.sapper[0], 1.2, P.sapper[2]], radius: 2.2, prompt: 'Talk to the sapper', states: ['2196'], enabled: () => !S.sapper && S.phase !== 'intro',
      onUse: () => side(async () => {
        S.sapper = true; sapper.pose = null;
        await convo(sapper, [
          ['m21sapper', 'Maeve Dunn. Don\'t step on the blue wire, it\'s not mine and I don\'t know whose it is.'],
          ['kai', 'Lasker\'s charges. Where are they?'],
          ['m21sapper', 'Under the Proving Floor. The four columns of the old atrium and the bridge to the Cradle. When they go, the whole anchor network goes with them.'],
          ['kai', 'There\'s a person inside that ring.'],
          ['m21sapper', 'There\'s a person inside every ring, Varen. That\'s how they work. Dov says that\'s the reason to break them.'],
          ['m21sapper', 'If you\'re in there when he presses the button, stay off the edges. The floor goes from the outside in.'],
        ]);
        sapper.pose = 'work';
        ev('Lasker\'s charge map', 'Maeve Dunn\'s map: charges under the four atrium columns (S1, S2, N1, N2) and the bridge to the Cradle. "The floor goes from the outside in."', 'Unwritten');
      }) });

    // ---------- optional: the yard diary, the Register ----------
    act({ pos: [-14, 1.0, -4.2], radius: 1.8, prompt: 'Read the trooper\'s diary on the pod', states: ['2196'], enabled: () => !S.diary,
      onUse: () => side(async () => {
        S.diary = true;
        await game.say('kai', 'A trooper\'s pocket book, left on a supply pod.');
        await game.say('kai', '"Seventeenth time tonight. He comes over the wall without using the wall. I wrote it down last time and the page was blank this morning."');
        await game.say('kai', '"If the Lock works, this is the last time I write this. If it doesn\'t, I\'ll write it again."');
        ev('A loop-aware trooper\'s diary', 'Found on a supply pod in the Bastion yard: "Seventeenth time tonight. He comes over the wall without using the wall." The Continuum remembers versions of tonight.', 'Continuum');
      }) });
    const orderStand = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), W.mats.glass); orderStand.position.set(-3, 0.6, -17.6); scene.add(orderStand); T.only(orderStand, '2196');
    const orderScr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshBasicMaterial({ map: TEX.emblem(), transparent: true, toneMapped: false })); orderScr.position.set(-3, 1.6, -17.4); scene.add(orderScr); T.only(orderScr, '2196');
    game.collision.add([-3.4, 0, -17.8], [-2.6, 1.2, -17.4], { states: ['2196'] });
    act({ pos: [-3, 1.2, -17.0], radius: 1.8, prompt: 'Read the Order of the Last Lock', states: ['2196'], enabled: () => !S.order && S.regDone,
      onUse: () => side(async () => {
        S.order = true;
        await game.say('kai', '"By the Prefect\'s order. At nightfall the Chronolith is fired once, at full field, from the Cradle."');
        await game.say('kai', '"Every variance is closed. Every branch is pruned. What is, remains. Nothing that has happened can unhappen."');
        await game.say('kai', 'Signed, Ima Adair. One timeline. Forever. And everything else, including whatever is left of Mira, cut off.');
        ev('The Order of the Last Lock', 'Prefect Ima Adair: at nightfall the Chronolith is fired once at full field from the Cradle; every variance closed, every branch pruned. "Nothing that has happened can unhappen."', 'Continuum');
      }) });
    act({ pos: [-6, 1.2, -19.2], radius: 1.8, prompt: 'Read the corrected worlds', states: ['2196'], enabled: () => !S.worlds && S.regDone,
      onUse: () => side(async () => {
        S.worlds = true;
        await game.say('kai', 'Fixed points. Every place the Continuum ever corrected.');
        await game.say('kai', m13 === 'free' ? '"Sable Yards: variance escaped. Stabilizer redirected. Residents at large." That was me.' : m13 === 'destroy' ? '"Sable Yards: stabilizer destroyed. Variance open." That was me too.' : '"Sable Yards: under review."');
        await game.say('kai', m15 === 'free' ? '"Harrow Reach: lock broken. Population restored to the line." They count waking people up as a fault.' : m15 === 'stabilize' ? '"Harrow Reach: held by a private lock. Tolerated." They like Anja\'s lock. Of course they do.' : '"Harrow Reach: unknown."');
        await game.say('kai', '"Meridian. Block D4. Lantern Hall. The Corran Building." Every place I\'ve been, and a line through it.');
        ev('The corrected worlds', 'The Register\'s plinths list every place the Continuum has fixed. Sable Yards and Harrow Reach are there, with what Kai did to them written down as variance.', 'Continuum');
      }) });
    act({ pos: [-10.4, 1.2, -34.2], radius: 1.9, prompt: 'Read the Register', states: ['2196'], enabled: () => !S.register && S.regDone,
      onUse: () => side(async () => {
        S.register = true;
        await game.say('kai', 'Volume nineteen, open at the last page. Gold ink.');
        await game.say('kai', '"VAREN, K. Versions met: seventeen. Status: unresolved. Instruction: close at the Last Lock."');
        await game.say('kai', 'And under it, in a different hand. "VAREN, K., the elder. Versions met: one. Came in by the front door. Let him."');
        ev('The Register: VAREN, K.', 'VAREN, K.: versions met 17, unresolved, "close at the Last Lock". Below, in another hand: "VAREN, K., the elder. Versions met: one. Came in by the front door. Let him." The Continuum let the Witness in.', 'Witness');
      }) });
    act({ pos: [-2.4, 1.2, -23.2], radius: 1.9, prompt: 'Read the memo on the reception desk', states: ['2049'], enabled: () => !S.memo,
      onUse: () => side(async () => {
        S.memo = true;
        await game.say('kai', 'Helix internal. From the Director\'s office.');
        await game.say('kai', '"Artefact A is to be moved from the main laboratory to the Grand Atrium for the unveiling. Hang it from the Halo anchors. Nobody is to call it a weapon. E. Rook."');
        await game.say('kai', F.m18manifest ? 'Same as the Corran manifest. Rook moved the ring here. The Continuum just kept it where he left it.' : 'Rook hung the ring in this atrium. A hundred and forty-seven years later the Continuum hung it in the same place.');
        ev('Rook\'s transfer memo, 2049', 'E. Rook: Artefact A (the ring) to be moved to the Grand Atrium and hung from the Halo anchors for the unveiling. "Nobody is to call it a weapon." The Cradle in 2196 hangs on the same anchors.', 'Helix');
      }) });

    // ---------- optional: the people held as fixed points (the 2049 floor sockets) ----------
    act({ pos: [P.panel49[0] - 0.4, 1.2, P.panel49[2]], radius: 1.9, prompt: 'Pull a floor socket', states: ['2049'], enabled: () => S.regDone && S.pods < 3,
      onUse: () => side(async () => {
        const i = await choose('kai', 'Lobby floor services. Six sockets.', ['L-1', 'L-2', 'L-3', 'L-4', 'L-5', 'L-6', 'Leave them'], game.autoQueue?.length ? 0 : 2);
        if (i >= 6) return;
        const name = 'L-' + (i + 1), pod = W.pods.find(p => p.socket === name);
        W.sockets[i].material.emissiveIntensity = 0.1; audio.sfxPlay('spark');
        if (!pod) { S.misses++; await game.say('kai', `${name}. A dead socket. Nothing hangs off it on the other side.`); return; }
        if (pod.open) { await game.say('kai', `${name} is already out.`); return; }
        pod.open = true; pod.pending = true;
        await game.say('kai', `${name}. A hundred and forty-seven years of current, gone. If the pod sat on this socket, it's dark now.`);
      }) });
    const heldPeople = [];
    T.onSwitch((id) => {
      if (id !== '2196') return;
      const newly = W.pods.filter(p => p.pending); if (!newly.length) return;
      for (const p of newly) { p.pending = false; p.field.visible = false; p.ring.material.emissiveIntensity = 0.2; p.top.visible = false; const k = W.pods.indexOf(p); const h = stage('m21held' + k, { ...HELD[k], lod: true }, p.g.position.x, 0, p.g.position.z, p.g.position.x < 0 ? PI / 2 : -PI / 2); T.only(h.root, '2196'); heldPeople.push(h); S.pods++; }
      side(async () => {
        await game.wait(0.6);
        const h = heldPeople[heldPeople.length - 1]; h.pose = 'sad';
        await game.say('m21held', S.pods === 3 ? 'Is it still the fourteenth? They told us it would always be the fourteenth.' : 'I can move. I couldn\'t move. How long was I standing here?');
        await game.say('kai', S.pods === 3 ? 'It\'s over. Go out the front, the yard is clear. Sera\'s people are on the ridge.' : 'Long enough. Stay down. There are others.');
        if (S.pods === 3) { FX.adjust('unwritten', 1, 'You freed the held'); ev('The held', 'Three people held as fixed points in the Register (0412-A, 0907-C, 1046-F). Their pods drew on Helix lobby floor sockets L-3, L-5 and L-1, still live after 147 years. Kai cut them in 2049.', 'People'); }
        h.pose = null;
      });
    });

    // ---------- optional: the archivist ----------
    let clerk = null;
    act({ pos: [P.clerk[0], 1.2, P.clerk[2] + 1.0], radius: 2.0, prompt: 'Talk to the archivist', states: ['2196'], enabled: () => S.regDone && !S.clerk && !!clerk,
      onUse: () => side(async () => {
        clerk.crouch = 0; clerk.pose = null;
        await convo(clerk, [
          ['m21clerk', 'Don\'t. I\'m a recorder. I write things down. I have never held one of those.'],
          ['kai', 'Then tell me what you wrote down about the man in the long coat.'],
          ['m21clerk', 'He came to the front gate yesterday and said your name. The Prefect let him in. She said a Varen who wants the Lock fired is a Varen worth having.'],
          ['kai', 'He doesn\'t want it fired. He wants it pointed.'],
          ['m21clerk', 'I know. I watched him at the Cradle. He was singing something to it. Three notes.'],
        ]);
        const i = await choose('kai', 'The archivist.', ['Let her go', 'Restrain her'], 0);
        if (i === 0) {
          S.clerk = 'freed'; FX.adjust('continuum', 1, 'You let the recorder go');
          await game.say('m21clerk', 'The alcove behind the plinths. My key. There\'s something in there of yours. We took it from the ring when it came in.');
          await game.say('kai', 'Go. The yard door is open.');
          S.alcove = true; W.alcove.enabled = false; audio.sfxPlay('door'); tween(1.2, k => { W.alcoveMesh.position.y = 1.6 + k * 3.2; });
          walkTo(clerk, [[-6, 0, -30], [0, 0, -18], [0, 0, -13]], 1.4).then(() => unstage(clerk));
        } else {
          S.clerk = 'restrained'; clerk.pose = 'sit'; clerk.crouch = 0.6;
          await game.say('m21clerk', 'Then write this down yourself, Varen. Whatever you do in there, you\'ve done it seventeen times.');
        }
        F.m21clerk = S.clerk;
      }) });
    act({ pos: [12.3, 1.2, -37.0], radius: 1.8, prompt: 'Take what the Continuum took from the ring', states: ['2196'], enabled: () => S.alcove && !S.seen.alcoveItem,
      onUse: () => side(async () => {
        once('alcoveItem');
        await game.say('kai', 'A child\'s hair clip. Plastic. A violet star. It was caught in the ring\'s collar.');
        await game.say('kai', 'Mira wore one like this on the open day. Nineteenth of October, 2026.');
        ev('The violet star clip', 'A child\'s plastic hair clip found caught in the Chronolith\'s collar when the Continuum moved it. Mira wore one on 19.10.2026.', 'Mira');
      }) });

    // ---------- III · the collapse: the survey plate, the damper, the gauge, the ballast, the plaque, the crane ----------
    act({ pos: [P.plateN2[0], 1.2, P.plateN2[2]], radius: 2.0, prompt: 'Read the survey plate on column N2', states: ['2196'], enabled: () => S.phase === 'collapse1',
      onUse: () => side(async () => {
        await game.say('kai', '"Column N2. Load one hundred and forty percent. Base shear progressing. Cause: damper failed open, 2049."');
        await game.say('kai', 'Failed open in 2049. Then it can be shut in 2049. Two.');
        once('plate'); ev('Survey: column N2', 'Continuum survey plate on atrium column N2: load 140 %, base shear progressing. Cause: seismic damper failed open in 2049.', 'Collapse');
      }) });
    for (const [nm, [x, z]] of Object.entries(P.cols)) {
      act({ pos: [x + (x < 0 ? 1.6 : -1.6), 0.8, z], radius: 1.9, prompt: `Check the damper on ${nm}`, states: ['2049'], enabled: () => S.phase === 'collapse1' && !S.damper,
        onUse: () => side(async () => {
          if (nm !== 'N2') { await game.say('kai', `${nm}: locked. Green. Not this one.`); S.misses++; return; }
          await game.say('kai', 'N2. Maintenance mode. Open. Someone left it like this in 2049 and nobody ever came back.');
          audio.sfxPlay('metal'); S.damper = true; F.m21damper = true;
          await game.say('kai', 'Shut. Locked. Now let\'s see if it\'s still shut a hundred and forty-seven years from now.');
          ev('Seismic damper N2', 'Kai locked the seismic damper on atrium column N2 in 2049. In 2196 the Proving Floor stopped falling.', 'Collapse');
        }) });
    }
    act({ pos: [P.gauge[0], 1.2, P.gauge[2]], radius: 2.2, prompt: 'Read the Cradle gauge', states: ['2196'], enabled: () => S.phase === 'collapse2',
      onUse: () => side(async () => {
        const deg = Math.round(listNow());
        await game.say('kai', deg > 1 ? `Listing ${deg} degrees east. It hangs from the old Helix anchors, the same as Rook's Halo did.` : deg < -1 ? `${-deg} degrees west now. I overdid it.` : 'Level.');
        if (once('gaugeHint')) await game.say('kai', 'In 2049 the Halo had ballast trays at the floor anchors. West wall and east wall.');
      }) });
    const moveBlock = async (from) => {
      const to = from === 'W' ? 'E' : 'W', list = W.ballast[from];
      if (!list.length) { await game.say('kai', 'This tray is empty.'); return; }
      const opts = [...list.map(k => `Move the ${k} kg block to the ${to === 'W' ? 'west' : 'east'} tray`), 'Leave it'];
      const auto = from === 'E' ? (list.includes(20) ? list.indexOf(20) : list.indexOf(10)) : opts.length - 1;
      const i = await choose('kai', `Halo ballast · ${from === 'W' ? 'west' : 'east'} tray: ${list.join(' + ')} kg.`, opts, Math.max(0, auto));
      if (i >= list.length) return;
      const kg = list.splice(i, 1)[0]; W.ballast[to].push(kg); W.drawBallast(); audio.sfxPlay('metal');
      const diff = sum(W.ballast.E) - sum(W.ballast.W);
      await game.say('kai', `${kg} kilos to the ${to === 'W' ? 'west' : 'east'}. East ${sum(W.ballast.E)}, west ${sum(W.ballast.W)}. ${diff === 0 ? 'Even.' : 'The Halo moves.'}`);
    };
    const sum = (a) => a.reduce((s, k) => s + k, 0);
    act({ pos: [P.ballastW[0] + 1.0, 1.0, P.ballastW[2]], radius: 2.0, prompt: 'Work the west ballast tray', states: ['2049'], enabled: () => S.phase === 'collapse2', onUse: () => side(() => moveBlock('W')) });
    act({ pos: [P.ballastE[0] - 1.0, 1.0, P.ballastE[2]], radius: 2.0, prompt: 'Work the east ballast tray', states: ['2049'], enabled: () => S.phase === 'collapse2', onUse: () => side(() => moveBlock('E')) });
    act({ pos: [P.plaque49[0], 1.2, P.plaque49[2] + 1.0], radius: 2.0, prompt: 'Read the skybridge plaque', states: ['2049'], enabled: () => S.phase === 'collapse3' && !S.plaque,
      onUse: () => side(async () => {
        await game.say('kai', '"Skybridge carried on transfer beam TB-7, set by hand, twenty-first of October 2026."');
        await game.say('kai', 'TB-7. The seats at the edge of the chasm in 2196 are stamped TB-7. And they\'re empty.');
        S.plaque = true; F.m21plaque = true; T.refreshHud();
        await game.say('m21band', 'Twenty-first of October, 2026. I can reach it from this room. One.');
        ev('The skybridge plaque', 'Helix Grand Atrium: the skybridge was carried on transfer beam TB-7, set by hand on 21.10.2026. In 2196 the TB-7 seats at the chasm are empty.', 'Collapse');
      }) });
    act({ pos: [P.seat[0], 0.6, P.seat[2] + 0.8], radius: 2.0, prompt: 'Look at the empty beam seat', states: ['2196'], enabled: () => S.phase === 'collapse3' && !S.beam,
      onUse: () => side(async () => { await game.say('kai', 'A rusted seat for a beam. Stamped TB-7. Both sides. The light-bridge sat on top of whatever used to be here.'); }) });
    act({ pos: [P.board26[0], 1.2, P.board26[2] + 1.0], radius: 2.0, prompt: 'Read the site board', states: ['2026'], enabled: () => !S.board,
      onUse: () => side(async () => {
        S.board = true;
        await game.say('kai', '"Today: set TB-7. Crane TC-2. Set out marked on the slab."');
        await game.say('kai', 'And pinned under it, green ink. "Centre. Not east. You always swing it east first. K."');
        await game.say('kai', 'His handwriting. My handwriting. He stood here before me and left me the answer.');
        ev('A note on the 2026 site board', 'Pinned under the site plan for 21.10.2026, in green ink: "Centre. Not east. You always swing it east first. — K." The Witness was on the building site before Kai.', 'Witness');
      }) });
    act({ pos: [P.crane[0], 1.2, P.crane[2] + 1.0], radius: 2.0, prompt: 'Work the crane panel', states: ['2026'], enabled: () => S.phase === 'collapse3' && !S.beam,
      onUse: () => side(async () => {
        const i = await choose('kai', 'TC-2 · slew the jib, then lower the hook.', ['Slew west', 'Slew to the centre', 'Slew east', 'Lower the hook'], game.autoQueue?.length ? 0 : (S.slew === 1 ? 3 : 1));
        if (i < 3) {
          const to = i, from = S.slew; S.slew = to; audio.sfxPlay('metal');
          W.slewScreen.material.map = TEX.slew(to); W.slewScreen.material.emissiveMap = W.slewScreen.material.map; W.slewScreen.material.needsUpdate = true;
          await tween(2.2, k => { W.beam26.position.x = [-8, 0, 8][from] + ([-8, 0, 8][to] - [-8, 0, 8][from]) * k; });
          await game.say('kai', ['West. Over the planters.', 'Centre. Right over the paint on the slab.', 'East. Over the hole.'][to]);
          return;
        }
        if (S.slew !== 1) {
          S.misses++;
          await tween(1.6, k => { W.beam26.position.y = 4.0 - k * 1.2; });
          await game.say('kai', 'It swings and won\'t seat. Wrong place. Back up.');
          await tween(1.2, k => { W.beam26.position.y = 2.8 + k * 1.2; });
          return;
        }
        await tween(3.2, k => { W.beam26.position.y = 4.0 - k * 4.0; });
        audio.sfxPlay('metal'); game.shake = 0.12;
        S.beam = true; F.m21beam = true; W.beamBox.enabled = true;
        await game.say('kai', 'Seated. Both ends on the marks. TB-7, set by hand, twenty-first of October.');
        ev('Transfer beam TB-7', 'Kai lowered TB-7 onto its seats in 2026. In 2196 the beam is still there, rusted, across the chasm to the Cradle.', 'Collapse');
      }) });

    // ---------- the collapse simulation (2196) ----------
    const listNow = () => (sum(W.ballast.E) - sum(W.ballast.W)) * 0.3;
    const debris = [0, 1, 2].map(() => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 28), new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      ring.rotation.x = -PI / 2; ring.userData.noBatch = true; scene.add(ring);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), W.mats.glass.clone()); rock.material = new THREE.MeshStandardMaterial({ color: 0xc8c4bc, roughness: 0.8 }); rock.visible = false; scene.add(rock);
      return { ring, rock, t: -1, x: 0, z: 0 };
    });
    let debrisT = 4;
    const debrisOn = () => S.phase.startsWith('collapse') && !S.beam && T.current === '2196' && game.control && !ui.dlgActive;
    game.onUpdate((dt) => {
      if (S.phase === 'collapse1' && !S.damper && game.control && !game._failing) {
        S.collapse = Math.min(1, S.collapse + dt / 220); musicState.collapse = S.collapse;
        W.slabs.forEach((s, i) => {
          const at = [0.25, 0.45, 0.65, 0.85][i];
          s.crack.material.opacity = S.collapse > at - 0.12 && !s.fallen ? 0.4 + Math.sin(game.time * 8) * 0.3 : 0;
          if (!s.fallen && S.collapse >= at) { s.fallen = true; s.box.enabled = false; s.vy = 0; audio.sfxPlay('boom'); game.shake = 0.18; if (T.current === '2196') ui.subtitle('m21band', 'Floor section gone. The next one is cracking.', 2000); }
        });
        if (S.collapse >= 1) { S.collapse = 0.9; game.fail('THE PROVING FLOOR WENT INTO THE CHASM'); }
      }
      for (const s of W.slabs) if (s.fallen && s.m.position.y > -14) { s.vy += 9.8 * dt; s.m.position.y -= s.vy * dt; s.m.rotation.x += dt * 0.3; s.crack.material.opacity = 0; }
      if (S.phase === 'collapse2' && !S.level && game.control && !game._failing) {
        const target = listNow(); S.list += (target - S.list) * Math.min(1, dt * 0.8);
        if (Math.abs(target) > 1.5) { S.tear = Math.min(1, S.tear + dt * Math.abs(target) / 18 / 200); }
        musicState.list = S.tear;
        if (S.tear >= 1) { S.tear = 0.75; game.fail('THE CRADLE TORE LOOSE'); }
        const g = Math.round(S.list); if (g !== S.gaugeShown) { S.gaugeShown = g; W.gaugeScreen.material.map = TEX.gauge(g); W.gaugeScreen.material.emissiveMap = W.gaugeScreen.material.map; W.gaugeScreen.material.needsUpdate = true; }
        if (Math.abs(target) < 0.5 && Math.abs(S.list) < 1.2) { S.level = true; F.m21ballast = true; ev('The Halo ballast', 'In 2049 Kai moved the Halo sculpture\'s ballast until both trays matched (40 kg each). The Cradle hangs from the same anchors in 2196 and stopped listing.', 'Collapse'); }
      }
      const tilt = -S.list * PI / 180; W.cradle.rotation.z += (tilt - W.cradle.rotation.z) * Math.min(1, dt * 1.2); W.halo.rotation.z = -listNow() * PI / 180;
      // debris
      if (debrisOn()) { debrisT -= dt; if (debrisT <= 0) { debrisT = 5 + Math.random() * 3; const d = debris.find(x => x.t < 0); if (d) { const a = Math.random() * PI * 2, r = 1 + Math.random() * 3; d.x = pl.pos.x + Math.cos(a) * r; d.z = Math.max(-75.5, Math.min(-47, pl.pos.z + Math.sin(a) * r)); d.t = 0; d.ring.position.set(d.x, 0.05, d.z); } } }
      W.beam96.visible = S.beam && T.current === '2196';
      for (const d of debris) {
        d.ring.visible = T.current === '2196' && d.t >= 0; d.rock.visible = d.rock.visible && T.current === '2196';
        if (d.t < 0) continue; d.t += dt;
        d.ring.material.opacity = d.t < 1.6 ? 0.25 + 0.4 * (d.t / 1.6) : 0;
        if (d.t > 0.9 && d.t < 1.6) { d.rock.visible = T.current === '2196'; const k = (d.t - 0.9) / 0.7; d.rock.position.set(d.x, 14 - k * 13.6, d.z); d.rock.rotation.x += dt * 4; }
        if (d.t >= 1.6 && !d.hit) { d.hit = true; audio.sfxPlay('boom'); game.shake = Math.max(game.shake || 0, 0.08); if (T.current === '2196' && Math.hypot(pl.pos.x - d.x, pl.pos.z - d.z) < 1.25 && game.control) C.hurt(1); }
        if (d.t > 3.2) { d.t = -1; d.hit = false; d.rock.visible = false; }
      }
    });
    const resetSlabs = () => { for (const s of W.slabs) { s.fallen = false; s.vy = 0; s.box.enabled = true; s.m.position.y = -0.28; s.m.rotation.x = 0; } };

    // ---------- objectives ----------
    function refresh() {
      if (S.main) return;
      const ph = S.phase;
      if (ph === 'approach') objective(zone() === 'post' && !S.seen.leftPost ? 'Get inside the Bastion wall (the hill was Helix in 2049 · 2)' : 'Get inside the Bastion wall · the 2049 fence has a gap at the loading dock');
      else if (ph === 'yard') objective(S.seal ? 'Open the Bastion door with the seal (2196)' : 'Take the access seal from the officer by the door · from behind, or stun and restrain');
      else if (ph === 'register') objective(S.regDone ? 'Through the Register to the Proving Floor' : 'Bring down the Warden · stun its plates, hold to throw it back, then stun and restrain');
      else if (ph === 'arena') objective('Hold the Proving Floor · restrain the Wardens');
      else if (ph === 'collapse1') objective(S.damper ? 'Back to 2196 · see if the floor holds' : 'Stop the floor falling · column N2 (the survey plates, 2049 dampers)');
      else if (ph === 'collapse2') objective('Level the Cradle before it tears loose · the gauge (2196) and the Halo\'s ballast (2049)');
      else if (ph === 'collapse3') objective(S.beam ? 'Cross the chasm on TB-7 (2196)' : S.plaque ? 'Set transfer beam TB-7 (2026 · 1) · the crane and the paint on the slab' : 'Find a way across the chasm · the empty seats (2196), the skybridge (2049)');
      else if (ph === 'stand') objective(S.allyCalled ? 'Break the Last Lock\'s guard' : 'Call your ally (G / SUPPORT)');
      else if (ph === 'duel') objective('Stop the Witness · he blocks from the front: flank him, throw him back, or leave an echo');
    }
    game.onUpdate(() => { if (!S.main && !S.busy && game.control) refresh(); });

    // ---------- hints ----------
    hint(() => S.phase === 'approach' && T.current === '2196' && pl.pos.z < 30, 40, () => ui.subtitle('kai', 'No gaps in their wall. In 2049 this was Helix\'s plaza. Two.', 3000));
    hint(() => S.phase === 'approach' && T.current === '2049', 45, () => ui.subtitle('kai', 'The loading dock on the right. Watch the camera\'s light on the ground, then go.', 3200));
    hint(() => S.phase === 'yard' && !S.seal, 60, () => ui.subtitle('kai', T.current === '2049' ? 'Walk the forecourt in 2049, come back to 2196 behind him. Three.' : 'The officer by the door. Get behind him, or stun him and restrain.', 3200));
    hint(() => S.phase === 'register' && !S.regDone, 50, () => ui.subtitle('kai', 'Crack the plates with stuns, hold to throw it back, then stun it and restrain it before it remembers.', 3400));
    hint(() => S.phase === 'collapse1' && !S.damper, 45, () => ui.subtitle('kai', S.seen.plate ? 'N2 failed open in 2049. Switch: two. The damper at its base.' : 'The columns have survey plates. The far right one, N2.', 3200));
    hint(() => S.phase === 'collapse2' && !S.level, 50, () => ui.subtitle('kai', T.current === '2049' ? `East ${sum(W.ballast.E)}, west ${sum(W.ballast.W)}. Even them out.` : 'The gauge says east. In 2049, the Halo\'s ballast trays.', 3200));
    hint(() => S.phase === 'collapse3' && !S.beam, 55, () => ui.subtitle('kai', !S.plaque ? 'The skybridge in 2049. There\'ll be a plaque.' : T.current !== '2026' ? 'TB-7 was set in 2026. Switch: one.' : 'The paint on the slab marks where it goes. The crane panel.', 3200));
    hint(() => S.phase === 'stand' && !S.allyCalled && S.allyReady, 18, () => ui.subtitle('kai', game.touch?.enabled ? 'SUPPORT. Call them.' : 'G. Call them.', 2200));

    // ---------- phase triggers by place ----------
    game.onUpdate(() => {
      if (S.main || S.busy || game._failing) return;
      const z = zone();
      if (S.phase === 'approach' && z === 'approach' && once('leftPost')) refresh();
      if (S.phase === 'approach' && pl.pos.z < 9.4) { S.phase = 'yard'; cp(T.current === '2049' ? 14 : 0, 0, 8.4, PI); C.showHud(true); refresh(); if (once('yardIn')) ui.subtitle('kai', 'Inside. The officer by the door carries the seal.', 2800); }
      if (S.phase === 'yard' && S.doorOpen && pl.pos.z < -15.6) startRegister();
      if (S.phase === 'register' && S.regDone && pl.pos.z < -44.6) startArena();
      if (S.phase === 'collapse1' && S.damper && T.current === '2196' && once('damperSeen')) side(damperHeld);
      if (S.phase === 'collapse2' && S.level && T.current === '2196' && once('levelSeen')) side(cradleLevel);
      if (S.phase === 'collapse3' && S.beam && T.current === '2196' && once('beamSeen')) side(beamSeen);
      if (S.phase === 'collapse3' && S.beam && pl.pos.z < -83.2 && T.current === '2196') startStand();
    });

    // ---------- II · the Register: the first Warden ----------
    let regWave = [];
    async function startRegister() {
      S.phase = 'register'; S.main = true; cine(true);
      const hide = (e) => { e.enabled = false; e.char.root.userData.states = []; e.char.root.visible = false; };
      outside.forEach(hide); yard.forEach(e => { if (e.state !== 'down' && e.state !== 'surrender') hide(e); });
      clerk = stage('m21clerk', null, P.clerk[0], 0, P.clerk[2] + 0.4, PI * 0.2); clerk.crouch = 1; T.only(clerk.root, '2196');
      const wd = warden(0, -31, 0, { patrol: [[-3, -31], [3, -31]], wait: 2.4 }), tr = enemy(TROOPER_F, 8, -22, -PI / 2, { patrol: [[8, -22], [8, -34]] });
      regWave = [wd, tr]; wd.char.frozen = true; tr.char.frozen = true;
      lockMusic('m21-register', 1.0);
      await game.shot([8, 4.4, -16.4], [0, 1.6, -30], 2.6, { fov: 50 });
      await game.say('kai', 'The Hall of Fixed Points. Every world they ever corrected, written down.');
      await game.shot([2.4, 1.8, -26.6], [0, 1.4, -31], 1.8, { fov: 38 });
      await game.say('m21band', 'Warden-class suit. It is recording its own last three seconds. Injuries, plates, position.');
      await game.say('kai', 'So it never stays hurt.');
      await game.say('m21band', 'Unless the three seconds are gone. A displacement throws them away.');
      musicLock = null; S.main = false; cine(false);
      wd.char.frozen = false; tr.char.frozen = false;
      C.giveWeapon(); echo.unlock(true); lockEras(true);
      ui.toast('WARDEN · STUN CRACKS A PLATE · HOLD TO DISPLACE: BREAKS ITS REWIND · THEN STUN AND RESTRAIN', 4200);
      cp(0, 0, -17.2, PI, () => { lockEras(true); });
      refresh();
      await game.waitFor(() => C.allDown(regWave) && !S.busy && !game._failing);
      await game.wait(0.8);
      S.main = true; cine(true); lockEras(false);
      await game.shot([0, 2.2, -36.6], [0, 2.8, -40.5], 1.2, { fov: 46 });
      audio.sfxPlay('door'); await tween(1.8, k => { W.regDoor.position.y = 3 + k * 5.6; }); W.regDoorBox.enabled = false;
      await game.say('m21adair', 'Kai Varen. You have walked into the Register seventeen times. You have never read it. Read it this time. Then come to the Proving Floor.');
      S.regDone = true; S.main = false; cine(false);
      cp(0, 0, -36, PI, () => { lockEras(false); });
      refresh();
    }

    // ---------- the Proving Floor: two waves ----------
    let arenaWave = [];
    async function startArena() {
      S.phase = 'arena'; S.main = true; cine(true); lockEras(true);
      clearWave(regWave); regWave = [];
      arenaWave = [warden(-6, -68, 0, { patrol: [[-6, -68], [6, -68]] }), enemy(TROOPER, -14, -62, 0, { patrol: [[-14, -62], [-14, -54]] }), enemy(TROOPER_F, 14, -60, 0, { patrol: [[14, -60], [14, -54]] }), enemy(TROOPER, 0, -72, 0, {})];
      for (const e of arenaWave) { e.char.frozen = true; e.state = 'alert'; e.last.copy(pl.pos); }
      lockMusic('m21-battle', 0.8);
      await game.shot([16, 9, -48], [0, 4, -78], 3.0, { fov: 54 });
      await game.shot([0, 3.4, -66], [0, 7.2, -90.5], 2.2, { fov: 44 });
      await game.say('kai', 'The ring. Hanging over the old atrium like a chandelier.');
      await game.say('m21mira', 'Kai. I can hear you. He\'s been singing to me all day.');
      await game.shot([4, 2.2, -50], [-6, 1.5, -68], 1.6, { fov: 44 });
      await game.say('m21adair', 'The Proving Floor. Every Warden here has beaten you before. Wardens: prove it again.');
      musicLock = null; S.main = false; cine(false);
      for (const e of arenaWave) e.char.frozen = false;
      cp(0, 0, -47.6, PI, () => { lockEras(true); });
      refresh();
      await game.waitFor(() => C.allDown(arenaWave) && !game._failing);
      S.w1 = true; await game.wait(1.0);
      ui.subtitle('m21adair', 'Enough. Both of you. Together.', 2600);
      const w2 = [warden(-8, -72, 0, { patrol: [[-8, -72], [-2, -66]], female: true }), warden(8, -72, 0, { patrol: [[8, -72], [2, -66]] }), enemy(TROOPER_F, -16, -66, PI / 2, {}), enemy(TROOPER, 16, -64, -PI / 2, {})];
      for (const e of w2) { e.state = 'alert'; e.last.copy(pl.pos); }
      arenaWave = arenaWave.concat(w2);
      cp(0, 0, -50, PI, () => { lockEras(true); });
      await game.waitFor(() => C.allDown(w2) && !game._failing);
      S.w2 = true; await game.wait(0.8);
      await collapseStart();
    }

    // ---------- III · the collapse ----------
    let witness = null;
    async function collapseStart() {
      S.main = true; cine(true); lockMusic('m21-collapse', 0.6);
      witness = stage('witness', null, 0, 0.6, -92.6, 0); T.only(witness.root, '2196');
      await game.shot([0, 3.0, -70], [0, 2.2, -92], 2.0, { fov: 40 });
      await game.say('witness', 'You were quicker than the last one. Good.');
      await game.say('kai', 'Get away from her.');
      await game.say('m21lasker', 'Varen, if you\'re on the Proving Floor, get off it. Charges in five. Four.');
      await game.say('kai', 'Lasker, don\'t!');
      audio.sfxPlay('boom'); game.shake = 0.4; audio.silence?.(0.8);
      await game.shot([10, 5, -62], [0, 0, -79], 1.4, { fov: 52 });
      await tween(1.6, k => { W.lightBridge.position.y = -0.12 - k * 12; W.lightBridge.rotation.z = k * 0.4; });
      W.lightBridgeBox.enabled = false; W.lightBridge.userData.states = []; W.lightBridge.visible = false; audio.unsilence?.();
      audio.sfxPlay('boom'); game.shake = 0.3;
      await game.shot([0, 3.0, -70], [0, 2.2, -92], 1.2, { fov: 40 });
      await game.say('witness', 'The floor first. Then the Cradle. If the floor goes, she goes with it. Make it hold.');
      await tween(3.0, k => { witness.root.position.y = 0.6 + k * 5.6; W.lift.position.y = 0.45 + k * 5.6; });
      unstage(witness);
      await game.say('m21band', 'Structural failure under the Proving Floor. The outer sections are going first.');
      S.phase = 'collapse1'; S.collapse = 0; musicLock = null; lockEras(false); T.unlocked = true; T.refreshHud();
      S.main = false; cine(false);
      cp(0, 0, -60, PI, () => { S.collapse = 0; resetSlabs(); lockEras(false); });
      refresh();
    }
    async function damperHeld() {
      S.main = true; cine(true);
      await game.shot([18, 3.4, -64], [14, 0.4, -73], 1.6, { fov: 44 });
      audio.sfxPlay('metal');
      await game.say('kai', 'The base of N2. The damper is still locked. A hundred and forty-seven years, and it held.');
      await game.say('m21band', 'Floor stable. New load: the Cradle. It is listing east.');
      S.phase = 'collapse2'; S.list = listNow(); S.tear = 0; musicState.collapse = 0;
      S.main = false; cine(false);
      cp(0, 0, -66, PI, () => { S.tear = 0; lockEras(false); });
      refresh();
    }
    async function cradleLevel() {
      S.main = true; cine(true);
      await game.shot([0, 2.6, -72], [0, 7.2, -90.5], 2.0, { fov: 42 });
      await game.say('kai', 'Level. It hangs on Rook\'s anchors, and it listened to Rook\'s ballast.');
      await game.say('m21mira', 'Thank you. It was like standing on a ship.');
      S.phase = 'collapse3'; musicState.list = 0;
      S.main = false; cine(false);
      cp(0, 0, -72, PI, () => { lockEras(false); });
      refresh();
    }
    async function beamSeen() {
      S.main = true; cine(true);
      await game.shot([3.2, 1.6, -73.4], [0, -0.2, -80], 1.8, { fov: 46 });
      await game.say('kai', 'There. Rusted through on top, but there. TB-7.');
      S.main = false; cine(false);
      cp(0, 0, -74.6, PI, () => { lockEras(false); });
      refresh();
    }

    // ---------- IV · the last stand on the dais, the ally ----------
    let standWave = [], adair = null;
    const allies = () => {
      const out = [];
      if (haleSide) out.push({ id: 'hale', label: 'OFFICER HALE · CUT THE HELIX GRID', why: 'Hale, in 2049', line: 'Hale. In 2049. The grid under the atrium.' });
      if (F.m10released) out.push({ id: 'prisoners', label: 'TEO AND THE FREED PRISONERS', why: 'the people you let out of Testing Chamber 2', line: 'Teo. And the people from Chamber Two.' });
      if (m13 === 'destroy' || hasSupport(F, 'unwritten-sappers')) out.push({ id: 'sappers', label: 'LASKER\'S SAPPERS · THE ANCHOR PYLON', why: 'the Unwritten, since the Sable Yards', line: 'Maeve. The pylon behind the Cradle.' });
      if (m13 === 'free' || hasSupport(F, 'sable-civilians')) out.push({ id: 'civilians', label: 'THE SABLE RESIDENTS · SERVICE CODES', why: 'the people you freed at the Sable Yards', line: 'The Sable residents. They know the Continuum\'s service codes.' });
      if (F.m13senn === 'helped') out.push({ id: 'senn', label: 'TROOPER SENN · STAND DOWN ORDER', why: 'the trooper you walked out between the shells', line: 'Senn. On their own channel.' });
      if (m15 === 'free' || F.anjaAlly === 'free' || hasSupport(F, 'anja-diagnosis')) out.push({ id: 'anja', label: 'DR. ANJA VALE · THE WARDENS\' FREQUENCY', why: 'Anja, who walked out of Harrow with you', line: 'Anja. She can name the frequency.' });
      if (m15 === 'stabilize' || F.anjaAlly === 'keeper' || hasSupport(F, 'harrow-lantern')) out.push({ id: 'lantern', label: 'THE LANTERN · A HELD SECOND', why: 'Harrow\'s Lantern, which you left burning', line: 'Anja. The Lantern.' });
      if (!out.length || trust >= 1) out.push({ id: 'sera', label: 'SERA\'S CREW · COVERING FIRE', why: 'Sera Voss', line: 'Sera. Now.' });
      return out;
    };
    async function startStand() {
      S.phase = 'stand'; S.main = true; cine(true); lockEras(true); T.unlocked = false; T.refreshHud();
      clearWave(arenaWave); arenaWave = [];
      if (T.current !== '2196') T.setImmediate('2196');
      adair = stage('prefect', null, 0, 0.3, -94.2, 0);
      standWave = [warden(-9, -93, 0, { female: true }), warden(9, -93, 0, {}), enemy(TROOPER, -14, -90, PI / 2, {}), enemy(TROOPER_F, 14, -90, -PI / 2, {}), enemy(TROOPER, -4, -94, 0, {})];
      for (const e of standWave) { e.char.frozen = true; e.state = 'alert'; e.last.copy(pl.pos); }
      lockMusic('m21-battle', 0.8);
      await game.shot([5, 2.4, -82.6], [0, 1.7, -94], 2.2, { fov: 44 });
      adair.talk = true;
      await game.say('prefect', 'You fixed my floor for me, Varen. Thank you.');
      await game.say('kai', 'Let me past, Adair.');
      await game.say('prefect', 'There is one world left that works. I will not let you make another. And I will not let him.');
      await game.say('prefect', F.m10done ? 'Block D4. Sixteen versions of that cell. This is the seventeenth, and it is the last.' : 'We have met seventeen times. This is the last.');
      adair.talk = false;
      const list = allies();
      await game.shot([-3.0, 1.9, -81.0], [0.2, 1.6, -83.6], 1.4, { fov: 40 });
      await game.say('kai', 'I didn\'t come alone.');
      let pick = 0;
      if (list.length > 1) pick = await choose('kai', 'Who do you call?', list.map(a => `${a.label} (${a.why})`), 0);
      S.ally = list[pick].id; F.m21ally = S.ally; F.m21allies = list.map(a => a.id);
      FX.record('m21', S.ally);
      await game.say('kai', list[pick].line);
      musicLock = null; S.main = false; cine(false);
      for (const e of standWave) e.char.frozen = false;
      FX.show(true);
      FX.offer({ id: 'm21ally', faction: 'allies', min: -3, uses: 1, label: list[pick].label, onCall: () => side(callAlly) });
      S.allyReady = true;
      cp(0, 0, -83.6, PI, () => { lockEras(true); if (!S.allyCalled) FX.offer({ id: 'm21ally', faction: 'allies', min: -3, uses: 1, label: list[pick].label, onCall: () => side(callAlly) }); });
      refresh();
      ui.toast(game.touch?.enabled ? 'SUPPORT · CALL YOUR ALLY' : 'G · CALL YOUR ALLY', 2600);
      await game.waitFor(() => S.allyCalled && C.allDown(standWave) && !game._failing && !S.busy);
      S.standDone = true; await game.wait(0.6);
      await witnessDuel();
    }
    const troopers = () => standWave.filter(e => !e.el && e.state !== 'down');
    async function callAlly() {
      S.allyCalled = true; musicState.ally = 1; F.factionCalls = F.factionCalls || 0;
      const id = S.ally;
      S.main = true; cine(true);
      if (id === 'hale') {
        await game.say('m21hale', 'Varen? I\'m in the atrium sub-basement. Twenty forty-nine. You said the big breaker.');
        await game.say('kai', 'All of it. Every circuit under the Halo.');
        await game.say('m21hale', 'Pulling it. Whatever\'s still drinking from this grid in a hundred years can go thirsty.');
        audio.sfxPlay('spark'); S.noArmor = true; for (const e of elites) { e.el.armor = 0; paintElite(e); }
        await game.say('m21band', 'The Wardens\' suits were drawing on the old Helix grid. Plates gone. They cannot restore them.');
      } else if (id === 'prisoners') {
        const t = stage('teo', null, -2.2, 0, -82.6, PI); const a = stage('m21freed', { ...ALLY_LOOKS[1] }, 2.2, 0, -82.8, PI); T.only(t.root, '2196'); T.only(a.root, '2196');
        await game.shot([0, 2.0, -86], [0, 1.4, -82], 1.2, { fov: 46 });
        await game.say('teo', 'You let us out of the loops in Chamber Two. We said we\'d remember. Down!');
        for (const e of troopers()) { C.stun(e, 10); e.timesStunned = 3; }
        await game.say('kai', 'Teo. The troopers are yours. The Wardens are mine.');
      } else if (id === 'sappers') {
        await game.say('m21sapper', 'The gold pylon behind the Cradle. That\'s what keeps their three seconds. Heads down.');
        audio.sfxPlay('boom'); game.shake = 0.3; S.noRewind = true; for (const e of elites) paintElite(e);
        await game.say('m21lasker', 'That one was for the Sable Yards, Varen. You owe me nothing. Break their Lock.');
      } else if (id === 'civilians') {
        await game.say('m21sera', 'Kai. The Sable people are in their service channel. They say thank you, and to duck.');
        for (const e of standWave) { if (e.state === 'down') continue; if (!e.el) e.armed = false; e.state = 'search'; e.last.set(e.char.root.position.x * 0.5, 0, -94); e.alert = 0; }
        await game.say('m21band', 'Their emitters are jammed. The troopers can\'t fire. The Wardens have lost you.');
      } else if (id === 'senn') {
        await game.say('senn', 'All Bastion units, this is Trooper Senn, Sable forward post. Stand down. I\'ve lived this night before. It doesn\'t end well for us.');
        for (const e of troopers()) C.setState(e, 'surrender');
        await game.say('kai', 'Thank you, Arvid.');
      } else if (id === 'anja') {
        await game.say('m21anja', 'Kai, I have the Wardens on the Lantern\'s old instruments. Their suits keep three seconds at one point one kilohertz. I\'m sending you the null.');
        S.noRewind = true; for (const e of elites) { e.el.armor = Math.max(0, e.el.armor - 1); paintElite(e); }
        await game.say('m21band', 'Rewind suppressed. One plate down on each.');
      } else if (id === 'lantern') {
        await game.say('m21anja', 'Kai. The Lantern can hold a second. Just one, just here. Take it.');
        S.lanternT = 9; for (const e of standWave) if (e.state !== 'down' && e.state !== 'surrender') C.stun(e, 9);
        await game.say('m21band', 'Held. Nine seconds. They cannot rewind inside a held second.');
      } else {
        await game.say('m21sera', 'Covering fire. Now!');
        for (const e of troopers()) { C.stun(e, 8); e.timesStunned = 3; }
        await game.say('sera', 'Go, Varen. I\'ll hold the bridge.');
      }
      if (id === 'hale' || !haleSide) { if (!haleSide) await game.say('m21brandt', 'Varen. Director Rook says you\'re not to touch the ring. In any year.'); }
      FX.adjust('allies', 1, 'They came');
      S.main = false; cine(false); refresh();
    }

    // ---------- V · the Witness ----------
    let wEnemy = null;
    function witnessHit(e, mode) {
      if (mode === 'displace') { ui.subtitle('witness', ['You learned that from me.', 'Good. Again.'][S.wHits % 2], 2000); return; }
      S.wHits++;
      const p = e.char.root.position, back = e.hist[0] ? e.hist[0].clone() : p.clone().add(V(Math.random() * 4 - 2, 0, -2));
      back.x = Math.max(-11, Math.min(11, back.x)); back.z = Math.max(-95, Math.min(-84, back.z));
      const gh = stage('m21wghost' + S.wHits, CAST.witness.look, p.x, p.y, p.z, e.char.root.rotation.y); gh.setGhost?.(GHOST_WIT); setTimeout(() => unstage(gh), 1400);
      p.copy(back); e.hist = [];
      e.state = 'alert'; e.stunT = 0; e.char.frozen = false; e.bubble.visible = false; e.last.copy(pl.pos); e.shieldUp = true; if (e.shieldMesh) e.shieldMesh.visible = true;
      audio.sfxPlay('rewind');
      ui.subtitle('witness', ['You lead with your right. You always did.', 'I taught you that in another life. You were slower.', 'Enough.'][Math.min(2, S.wHits - 1)], 2400);
      if (S.wHits >= 3) S.duelDone = true;
    }
    async function witnessDuel() {
      S.phase = 'duel'; S.main = true; cine(true);
      FX.show(false);
      for (const e of standWave) if (e.state === 'surrender') { e.char.crouch = 1; }
      lockMusic('m21-witness', 1.2);
      witness = stage('witness', null, 0, 6.2, -92.6, 0);
      await game.shot([3.4, 2.0, -84], [0, 3.0, -92.6], 1.6, { fov: 44 });
      audio.sfxPlay('metal');
      await tween(3.0, k => { witness.root.position.y = 6.2 - k * 5.6; W.lift.position.y = 6.05 - k * 5.6; });
      witness.root.position.y = 0.6;
      await walkTo(witness, [[0, 0.6, -89.5]], 1.0); witness.root.position.y = 0.3;
      faceEach(kai, witness);
      await game.say('witness', 'Put the displacer down, Kai.');
      await game.say('kai', 'Come and take it.');
      await game.say('witness', 'I have had this fight with you before. You will not like how it goes.');
      unstage(witness);
      const wl = { ...CAST.witness.look };
      const ch = stage('witness', wl, 0, 0.3, -89.5, 0);
      wEnemy = C.addEnemy(ch, { states: ['2196'], kind: 'officer', name: 'THE WITNESS', armed: true, shield: true, surrenders: false, noTakedown: true, range: 22, fov: 1.2, speed: 1.6, run: 3.4, keep: 8, rate: 2.0, telegraph: 0.8, stunTime: 2, boltSpeed: 13,
        barks: { spot: ['There you are.'], search: ['Hiding was always my idea.'] }, voice: 'witness' });
      wEnemy.wit = true; wEnemy.state = 'alert'; wEnemy.last.copy(pl.pos);
      if (wEnemy.shieldMesh) wEnemy.shieldMesh.material.color.set(GHOST_WIT);
      if (wEnemy.emitter) { wEnemy.emitter.material.color.set(GHOST_WIT); }
      game.onUpdate(dt => { if (wEnemy && wEnemy.wDown > 0) { wEnemy.wDown -= dt; if (wEnemy.wDown <= 0) { wEnemy.shieldUp = true; if (wEnemy.shieldMesh) wEnemy.shieldMesh.visible = true; } } });
      C.heal(); C.weapon.cells = C.weapon.max;
      musicLock = null; S.main = false; cine(false);
      ui.toast('HE BLOCKS FROM THE FRONT · FLANK HIM, THROW HIM BACK (HOLD), OR LEAVE AN ECHO (V)', 3600);
      cp(0, 0, -83.8, PI, () => { lockEras(true); S.wHits = Math.min(S.wHits, 2); wEnemy.shieldUp = true; });
      refresh();
      await game.waitFor(() => S.duelDone && !game._failing && !S.busy);
      await ending();
    }

    // ---------- ending: the quote, the final experiment ----------
    async function ending() {
      S.phase = 'end'; S.main = true; cine(true); objective('');
      lockMusic('m21-witness', 1.0);
      const wp = wEnemy.char.root.position.clone();
      C.removeEnemy(wEnemy); unstage(wEnemy.char); C.showHud(false); echo.unlock(false);
      witness = stage('witness', null, Math.max(-6, Math.min(6, wp.x)), 0.3, -90.4, 0);
      pl.place(witness.root.position.x * 0.3, 0.3, -86.4, PI);
      faceEach(kai, witness);
      await game.shot([3.2, 1.8, -86.0], [witness.root.position.x, 1.6, -90.4], 1.8, { fov: 40 });
      await convo(witness, [
        ['witness', 'Enough. I have had this fight with you in sixteen worlds. I win it when I want to.'],
        ['kai', 'You let the Continuum carry the ring here. You let Lasker blow the floor.'],
        ['witness', 'I needed the Lock\'s power and the Unwritten\'s noise. Nobody watches the Cradle while the floor is falling.'],
        ['kai', 'Mira says you\'ve been singing to her.'],
        ['witness', 'Tuning. To the first second. Nineteenth of October, eight-fourteen and nine. Not a copy, this time. The first one.'],
        ['kai', 'You\'ve been there a thousand times.'],
        ['witness', `${iters === 1046 ? 'One thousand and forty-six' : iters}. Each time I came out older, and she came out less. ${pattern} percent of her is what is left.`],
        ['kai', 'Then why warn me? "Do not build the machine." Why bring me all the way here?'],
      ]);
      await game.shot([-1.6, 1.7, -87.2], [witness.root.position.x, 1.65, -90.4], 1.4, { fov: 34 });
      witness.talk = true;
      await game.say('witness', 'I was trying to find a version of me that didn\'t have to.');
      witness.talk = false;
      await game.shot([1.8, 1.7, -88.6], [0, 1.6, -86.4], 1.0, { fov: 34 });
      await game.say('kai', 'And did you?');
      await game.shot([-1.6, 1.7, -87.2], [witness.root.position.x, 1.65, -90.4], 0.8, { fov: 32 });
      witness.talk = true;
      await game.say('witness', 'No.');
      witness.talk = false;
      audio.silence?.(2.0); await game.wait(1.6); audio.unsilence?.();
      F.m21quote = true;
      await game.say('witness', 'You might still. It is the only thing about you I envy.');
      if (F.m20answer === 'hand') { await game.say('kai', 'I offered her my hand in there. She told me to ask what she wants. She wants to decide what she is. Not you. Not me.'); await game.say('witness', 'Then come and tell her yourself.'); }
      else if (F.m20answer === 'unsure') { await game.say('kai', 'I told her I didn\'t know yet if it was enough. You never even asked her.'); await game.say('witness', 'I asked her a thousand times. She always said yes. That is how I knew I was doing it wrong.'); }
      else if (F.m20answer === 'enough') { await game.say('kai', 'I told her who she is now is enough. She called me a liar. A kind one.'); await game.say('witness', 'It was never enough for me. That is the difference between us, for one more minute.'); }
      else { await game.say('kai', 'She asked me if it would be enough, being who she is now. You never let her ask.'); await game.say('witness', 'It was never enough for me. That is the difference between us, for one more minute.'); }
      // he begins the final experiment
      lockMusic('m21-experiment', 1.2); musicState.ring = 0;
      await walkTo(witness, [[0, 0.3, -93]], 1.1);
      await game.shot([4, 2.6, -84], [0, 4.0, -92], 1.6, { fov: 46 });
      if (adair) { adair.root.position.set(-5, 0.3, -88); adair.crouch = 1; adair.talk = true; }
      await game.say('prefect', 'Varen, the Lock is still live. If he fires it pointed at one second, he takes the whole line with him.');
      if (adair) adair.talk = false;
      audio.sfxPlay('anomaly');
      await tween(3.2, k => { witness.root.position.y = 0.3 + k * 5.0; W.lift.position.y = 0.45 + k * 5.0; musicState.ring = k * 0.6; });
      witness.root.rotation.y = 0;
      W.ghosts.visible = true;
      await game.shot([10, 4, -70], [0, 5, -90], 2.6, { fov: 56 });
      await tween(3.0, k => { W.ghostMat.opacity = k * 0.22; W.clock.material.opacity = k * 0.8; W.ring.scale.setScalar(1 + k * 0.12); W.cradle.rotation.z *= 0.9; musicState.ring = 0.6 + k * 0.4; });
      await game.say('m21band', 'Temporal signature: every place you have been. Central Station. The settlement. The observatory. Rain City.');
      await game.say('m21band', 'Converging on one second. Nineteenth of October, 2026. Eight-fourteen.');
      await game.say('m21mira', 'Kai. He\'s opened it. I can see the hall where I died. I can see you, seven years old, holding on.');
      await game.shot([0, 3.0, -82.8], [0, 6.0, -91], 1.8, { fov: 44 });
      await game.say('witness', 'This is where it began. Follow me, if you want to see how.');
      await tween(1.6, k => { witness.root.position.z = -93 + k * 2.4; witness.root.position.y = 5.3 + k * 1.6; witness.speed = 0.6; });
      witness.setGhost?.(GHOST_WIT); await game.wait(0.6); unstage(witness);
      game.shake = 0.15;
      await game.say('kai', 'Not without me.');
      F.m21done = true; F.witnessBegan = true; F.finalExperiment = true; F.lastLock = 'broken'; F.m21adair = 'yielded'; F.continuumFallen = true;
      F.m21elites = S.elites; F.m21restrained = S.restrained; F.m21pods = S.pods; F.m21shards = S.shards; F.m21evidence = S.ev.size; F.m21fails = S.fails;
      F.m21witnessDuel = S.wHits; F.m21echoUses = S.echoUses; F.m21misses = S.misses; F.m21camSeen = S.camSeen; F.m21tear = Math.round(S.tear * 100);
      FX.adjust('continuum', -2, 'You broke the Last Lock');
      F.metWitness = true;
      pl.place(0, 0.3, -86, PI);
      await game.shot([0, 1.6, -80.6], [0, 5.6, -91], 2.4, { fov: 48 });
      await ui.fade(1, 2400);
      const mins = Math.round((game.time - tStart) / 60);
      await ui.chapterCard('MISSION 21 COMPLETE', 'The Last Battle of the Continuum', `Ally: ${({ hale: 'Hale', prisoners: 'Teo & the freed', sappers: 'Lasker\'s sappers', civilians: 'the Sable residents', senn: 'Trooper Senn', anja: 'Anja Vale', lantern: 'the Lantern', sera: 'Sera' })[S.ally] || '—'} · Wardens restrained ${S.elites}/7 · Held freed ${S.pods}/3 · Evidence ${S.ev.size} · Shards ${S.shards}/${SHARDS.length}${mins ? ' · ' + mins + ' min' : ''}`, 4200);
      C.dispose(); echo.dispose(); FX.dispose();
      delete T.canSwitch; T.locked = false; kai.lookTarget = null; kai.pose = null;
      game.releaseCam(); ui.letterbox(false); audio.allBeds?.(0); audio.setTheme(null);
      window.__m21 = null;
    }

    // ---------- test hooks ----------
    const behind = (e, d = 1.1) => { const p = e.char.root.position, y = e.char.root.rotation.y; pl.place(p.x - Math.sin(y) * d, p.y, p.z - Math.cos(y) * d, y); return 'behind ' + (e.o.name || e.kind); };
    const hit = (e, mode = 'stun', fromBehind = true) => { const y = e.char.root.rotation.y; const dir = fromBehind ? V(Math.sin(y), 0, Math.cos(y)) : V(-Math.sin(y), 0, -Math.cos(y)); C.hitEnemy(e, { mode, dir }); return e.state + (e.el ? ' armor ' + e.el.armor + ' mem ' + e.el.mem.toFixed(1) : ''); };
    const standing = () => C.standing().filter(e => e.char.root.parent && e.enabled);
    const near = (e, dx = 1.0) => { const p = e.char.root.position; pl.place(p.x + dx, p.y, p.z, -PI / 2); return 'near'; };
    const subdue = (e) => { if (e.el) { let k = 0; while (e.el.armor > 0 && k++ < 5) hit(e, 'stun'); hit(e, 'displace'); } if (!e.wit) hit(e, 'stun'); return e.state; };
    const restrainAll = () => { const list = standing().filter(e => !e.wit); for (const e of list) { subdue(e); C.restrain(e); } return list.length + ' restrained'; };
    window.__m21 = { S, W, C, T, P, FX, echo, zone, behind, hit, standing, near, subdue, restrainAll, camFoot, get officer() { return officer; }, get regWave() { return regWave; }, get arenaWave() { return arenaWave; }, get standWave() { return standWave; }, get witness() { return wEnemy; }, elites, refresh, listNow };

    // ---------- intro ----------
    S.main = true; game.control = false; ui.letterbox(true);
    pl.place(...P.start);
    game.checkpoint(...P.start);
    sera.root.rotation.y = PI * 0.15;
    applyLook();
    await ui.fade(1, 10);
    await game.shot([22, 16, 52], [0, 12, -30], 0.01, { fov: 50 });
    await ui.fade(0, 1800);
    lockMusic('m21-dusk', 0.5);
    const cardP = ui.chapterCard('ACT IV · THE UNWRITTEN SECOND', 'The Last Battle of the Continuum', 'One machine, three hands on it', 4200);
    await game.shot([14, 10, 40], [0, 10, -40], 6.0, { fov: 48 });
    await cardP;
    await game.say('m21adair', 'Citizens of the last timeline. At nightfall the Continuum closes the Last Lock. After tonight, nothing that has happened can unhappen.');
    await game.shot([-6.5, 2.2, 43.8], [-1.2, 1.5, 40.0], 1.8, { fov: 40 });
    await convo(sera, [
      ...(metSera ? [] : [['sera', 'Sera Voss. I run the people the Continuum hasn\'t caught yet. You\'re the face on the memorials.']]),
      ['sera', 'You came out of that ring three days ago talking about your sister. The next morning the Continuum came for the ring.'],
      ['kai', 'And brought it here.'],
      ['sera', 'Into the Bastion. Adair means to fire it once and lock this world the way it is. No more switching. No more second chances.'],
      ['kai', 'What\'s left of Mira is in that ring.'],
    ]);
    await game.say('m21lasker', 'And while Adair locks it, my charges go off under her feet. The whole anchor network goes with the Bastion. No more fixed points. No more Varen.');
    await game.shot([3.4, 1.9, 41.6], [-1.6, 1.6, 39.6], 1.4, { fov: 40 });
    await convo(sera, [
      ['sera', 'Lasker wants it all gone. Adair wants it all frozen. And your old man in the long coat walked in through their front gate yesterday like he owned it.'],
      ['kai', 'The Witness.'],
    ]);
    await game.say('m21mira', 'Kai. He\'s tuning the ring. To me. To the second before I let go.');
    await game.say('kai', 'He\'s going to run it again. One more time.');
    await game.shot([-1.2, 1.6, 41.4], [-3.0, 1.2, 39.6], 1.2, { fov: 36 });
    await game.say('sera', 'Then you\'d better get there first. Take this. Same as Block D4. Tap to stun, hold to throw them back.');
    await game.say('sera', 'Their wall has no door you can use. But that hill was Helix before it was theirs.');
    await game.shot([4, 3.2, 30], [0, 3.5, 11], 1.8, { fov: 46 });
    await game.say('m21band', 'Second signature here: Helix Headquarters, 2049. Switching available.');
    C.giveWeapon(); echo.unlock(true); C.showHud(true);
    ui.missionTag('MISSION 21 · THE LAST BATTLE OF THE CONTINUUM'); ui.show('hud', true);
    T.unlocked = true; S.phase = 'approach'; T.refreshHud();
    ui.toast('TEMPORAL STATE · THE BASTION 2196 (3) · HELIX HQ 2049 (2)', 3600);
    musicLock = null; S.main = false; cine(false);
    cp(0, 0, 37.0, PI, () => { lockEras(false); });
    F.m21started = true;
    void factionStanding; void SLABS; void GUARD49;
    refresh();
    await game.waitFor(() => S.phase === 'end' && !window.__m21);
  },
};
