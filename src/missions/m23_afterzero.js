// MISSION 23 · AFTERZERO (Finale) — resolve the emotional conflict and leave a sequel hook.
// Bible beats: cross fragments of the opening streets, settlement, Helix laboratory and future city · cooperate briefly
// with the Witness to hold open a route · reach Mira at the original Chronolith · choose what to preserve and what to
// release. Quote: "I thought the answer was to find the right world." / "And now?" / "Now I think we kept asking the
// world to pay for our answer." Endings: A The Fixed World ("For the first time, tomorrow belonged to tomorrow."),
// B The Infinite War ("We had saved every possible tomorrow. None of them agreed on the future."), C Afterzero, the
// recommended canon ("I finally found a second that belongs to nobody."). Then the credits, and after them a clock
// that starts to tick and a voice: "Version one hundred and eighteen."
// The second started (M22). Every place the Witness ever broke has drifted in around Test Hall Zero: Rain City's opening
// street (three local states and Checkpoint C), the keepers' settlement (three hearths, a mural, the stream), the 2196
// city (a skybridge that exists whole only in 2049), all meeting at the Confluence, whose fracture wall wants three
// threads. Behind it, Helix's laboratory closes behind anyone who walks it unless someone holds it open: Kai and the
// Witness take turns, and at the seam the Witness stays. Mira waits at the original Chronolith.
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { Walker } from '../world/props.js';
import {
  registerM23Cast, registerM23Themes, musicState, buildWorld, buildEpilogue, buildClockScene, P, TEX, COMMUTERS, SETTLERS, SURVIVORS, PASSERS49, shardMesh, pageMesh,
} from '../world/env_m23.js';

const PI = Math.PI;
const THREADS = {
  passengers: { n: 0, name: 'THE 08:14 PASSENGERS', seal: 'avenue', keep: 'The people Kai pulled from the train keep the second he gave them.', lose: 'The 08:14 runs as it always ran. Nobody remembers it nearly didn\'t.' },
  keepers: { n: 1, name: 'THE KEEPERS\' MEMORY', seal: 'settle', keep: 'The valley keeps its story of the seventeen, painted and repainted.', lose: 'The mural is just a mural. The keepers forget the man who came before the first fire.' },
  tomorrow: { n: 2, name: 'SERA\'S TOMORROW', seal: 'future', keep: 'Lantern Hall\'s light stays on, and the roads back stay open.', lose: 'The beacon goes dark. 2196 has only the road it is on.' },
  attempts: { n: 3, name: 'THE WITNESS\'S ATTEMPTS', seal: null, keep: 'One thousand and forty-six tries are remembered as what they were: love that would not let go.', lose: 'The attempts are let go. Nobody has to carry them any more.' },
};
const ENDS = {
  A: { name: 'THE FIXED WORLD', verb: 'Break the ring', quote: 'For the first time, tomorrow belonged to tomorrow.', desc: 'Destroy the Chronolith. The fractures close and history holds still. Mira\'s reconstructed pattern cannot survive it.' },
  B: { name: 'THE INFINITE WAR', verb: 'Split the states', quote: 'We had saved every possible tomorrow. None of them agreed on the future.', desc: 'Separate the states into branches that never touch. Mira survives. Every boundary between them becomes a border.' },
  C: { name: 'AFTERZERO', verb: 'Step into the ring', quote: 'I finally found a second that belongs to nobody.', desc: 'Become the anchor that absorbs the contradictions. Mira wakes in a world where Kai was never born.' },
};

export default {
  id: 'm23', act: 'FINALE', title: 'Afterzero', sub: 'Choose what to preserve',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time, auto = !!game.autoplay;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM23Cast(); registerM23Themes();
    ui.missionTag('MISSION 23 · AFTERZERO'); ui.show('hud', true);
    const kai = pl.char;
    const portraits = (ids) => { try { const need = ids.filter(id => !ui.portraits[id] && CAST[id]?.look); if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]])))); } catch (err) { console.warn('m23 portraits', err); } };
    portraits(['witness', 'mira', 'sera', 'niko', 'tala', 'hale', 'jun', 'm23settler', 'm23scav', 'm23mira']);
    // what earlier missions left
    const iters = F.witnessIterations || 1046, together = F.m22together !== false, trusted = F.trustedHale, metJun = !!F.metJun;
    const seraTrust = F.seraTrust || 0, beacon = !!(F.returnBeacon || F.m14beacon), ally = F.m21ally, miraAns = F.m20answer || F.m19miraAnswer;
    const villageKnown = !!(F.m5complete || F.villageCausalChain || F.nikoCrossedEras);

    // ---------- state ----------
    const G = {
      threads: new Set(), keep: {}, shards: 0, shardsTaken: new Set(), pages: new Set(), ev: new Set(), seen: {}, talks: new Set(), miraTopics: new Set(),
      ember: false, lit: [], hearthMisses: 0, stones: false, beacon: false, plank: false,
      holdFails: 0, plateFails: 0, seamFalls: 0, consoleLocked: false, end: null, falls: 0,
    };
    let S = { phase: 'intro', obj: '', busy: false, main: false, zone: 'hall', zs: { avenue: 'a49', future: 'f96' }, byId: {}, done: false };
    window.__m23 = { G, get S() { return S; }, P, THREADS, ENDS, X: {} };

    // ---------- helpers ----------
    const once = (k) => { if (G.seen[k]) return false; G.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag) => { if (G.ev.has(title)) return; G.ev.add(title); ui.addEvidence(title, text, tag); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const choose = (id, text, opts, def = 0) => { if (auto) game.autoChoice = game.autoQueue?.length ? game.autoQueue.shift() : def; return game.choice(id, text, opts); };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive || S.busy) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u), u); if (u >= 1) { off(); res(); } }); });
    const refresh = () => S.refresh?.();
    const side = async (fn) => {
      if (S.busy || !game.control || game._failing) return; S.busy = true;
      try { await fn(); } catch (err) { if (err?.name === 'Abort' || err?.abort || String(err).includes('Abort')) throw err; console.warn('m23 side', err); } finally { S.busy = false; if (!S.main) { game.control = true; ui.letterbox(false); game.releaseCam(); } refresh(); }
    };
    const act = (o) => {
      const fn = typeof o.pos === 'function' ? o.pos : null;
      const it = game.interact({ radius: 1.8, ...o, pos: fn ? [0, 0, 0] : o.pos, once: false, onUse: (x) => { if (S.busy || game._failing) return; if (o.enabled && !o.enabled()) return; if (o.states && !o.states.includes(T.current)) return; o.onUse(x); } });
      if (fn) it.posFn = fn;
      it.done = () => game.removeInteract(it);
      return it;
    };
    const near = (p, r) => Math.hypot(pl.pos.x - p[0], pl.pos.z - p[2]) < r;
    const posOf = (ch) => (ch === kai ? pl.pos : ch.root.position);
    const faceEach = (a, b) => {
      const pa = posOf(a), pb = posOf(b), ya = Math.atan2(pb.x - pa.x, pb.z - pa.z), yb = Math.atan2(pa.x - pb.x, pa.z - pb.z);
      if (a === kai) { pl.yaw = ya; kai.root.rotation.y = ya; } else a.root.rotation.y = ya;
      if (b === kai) { pl.yaw = yb; kai.root.rotation.y = yb; } else b.root.rotation.y = yb;
      a.lookTarget = b.head; b.lookTarget = a.head;
    };
    const ots = (speaker, listener, dur = 0.8, fov = 36) => {
      const sp = posOf(speaker), l = posOf(listener), dx = sp.x - l.x, dz = sp.z - l.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
      const sd = 0.7 + Math.max(0, 2.2 - d) * 0.45, back = 1.35, ly = l.y + 1.64;
      return game.shot([l.x - ux * back + uz * sd, ly, l.z - uz * back - ux * sd], [sp.x, sp.y + 1.56, sp.z], dur, { fov });
    };
    const convo = async (other, lines) => {
      if (other) {
        const o = other.root.position, dx = pl.pos.x - o.x, dz = pl.pos.z - o.z, d = Math.hypot(dx, dz);
        if (d < 1.4 && d > 0.01 && Math.abs(pl.pos.y - o.y) < 0.5) pl.place(o.x + dx / d * 1.6, pl.pos.y, o.z + dz / d * 1.6, pl.yaw);
        faceEach(kai, other);
      }
      for (const [id, line] of lines) {
        const sp = id === 'kai' ? kai : (S.byId[id] || null);
        if (sp && other && (sp === kai || sp === other)) await ots(sp, sp === kai ? other : kai);
        await game.say(id, line);
      }
      kai.lookTarget = null; if (other) other.lookTarget = null;
    };
    const walkTo = (ch, path, speed = 1.4) => new Promise(res => {
      let i = 0; const tok = ch._walk = (ch._walk || 0) + 1;
      const off = game.onUpdate(dt => {
        const p = ch.root.position, t = path[i]; if (!t || ch._walk !== tok) { ch.speed = 0; off(); res(); return; }
        const dx = t[0] - p.x, dz = t[2] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { i++; if (i >= path.length) { ch.speed = 0; off(); res(); } return; }
        const s = Math.min(d, speed * dt); p.x += dx / d * s; p.z += dz / d * s; p.y += (t[1] - p.y) * Math.min(1, dt * 5);
        let dy = Math.atan2(dx, dz) - ch.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.root.rotation.y += dy * Math.min(1, dt * 8); ch.speed = speed;
      });
    });
    const closeUp = async (p, lines, dist = 1.4, fov = 38, up = 0.7) => {
      const dx = pl.pos.x - p[0], dz = pl.pos.z - p[2], d = Math.hypot(dx, dz) || 1;
      await game.shot([p[0] + dx / d * dist, p[1] + up, p[2] + dz / d * dist], [p[0], p[1], p[2]], 1.0, { fov });
      for (const [id, line] of lines) await game.say(id, line);
    };
    const actor = async (id, x, y, z, ry) => { const ch = game.actor(id, null, x, y, z, ry); S.byId[id] = ch; await tick(); return ch; };
    const story = async (fn) => { S.main = true; cine(true); try { await fn(); } finally { S.main = false; cine(false); refresh(); } };

    // ---------- scene ----------
    const scene = game.newScene({ background: 0xd8b890, fog: [0xd8b890, 0.01], exposure: 1.0, bloom: 0.7, bloomThreshold: 0.82, envIntensity: 0.6, killY: -8, residue: true });
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    game.onUpdate(dt => RZ.update(dt));
    const W = buildWorld(game, scene);
    game.onUpdate((dt, t) => W.update(dt, t));
    await tick();

    // ---------- light: one sun (the shadow caster), a hemisphere, three nearest practicals; a look per place ----------
    const Q = RZ.getQuality(), low = Q === 'low';
    let env = null; try { env = RZ.skyEnvironment(renderer, scene, { preset: 'golden-hour', elevation: 7, azimuth: 60, cover: 0.45, turbidity: 3.4, ground: 0xa88a68, apply: false }); } catch (err) { console.warn('m23 sky', err); }
    const hemi = new THREE.HemisphereLight(0xffe8c8, 0x3a3028, 0.55); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd0a0, 2.0); sun.castShadow = true;
    sun.shadow.mapSize.set(Q === 'high' ? 2048 : low ? 512 : 1024, Q === 'high' ? 2048 : low ? 512 : 1024);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 170 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    const sunDir = new THREE.Vector3(0.6, 0.35, -0.7).normalize();
    const LOOK = {
      hall: { fog: [0xd8b48a, 0.009], env: 0.65, hemi: [0xffe8c8, 0x3a3028, 0.55], sun: [0xffcf9a, 2.1], dir: [0.5, 0.3, -0.8], exp: 1.0, beds: { wind: 0.03 } },
      a26: { fog: [0xc8d0d8, 0.008], env: 0.7, hemi: [0xf0f4ff, 0x3a3a38, 0.7], sun: [0xfff2e0, 2.4], dir: [0.4, 0.6, 0.4], exp: 1.0, beds: { wind: 0.02, crowd: 0.02 } },
      a49: { fog: [0x1a2430, 0.02], env: 0.3, hemi: [0x8aa8c8, 0x141820, 0.45], sun: [0x8aa8c8, 0.35], dir: [0.2, 0.8, 0.3], exp: 1.25, bg: 0x0e1620, beds: { rain: 0.07, hum: 0.02, hz: 60 } },
      a96: { fog: [0x98a29a, 0.012], env: 0.5, hemi: [0xc8d0c8, 0x2a2c24, 0.65], sun: [0xd8e0dc, 1.2], dir: [0.4, 0.6, -0.5], exp: 1.05, beds: { wind: 0.06 } },
      conf: { fog: [0xd0b090, 0.01], env: 0.65, hemi: [0xffe8c8, 0x3a3028, 0.55], sun: [0xffcf9a, 2.0], dir: [0.5, 0.3, -0.8], exp: 1.0, beds: { wind: 0.04 } },
      anc: { fog: [0xc89a68, 0.011], env: 0.55, hemi: [0xffc890, 0x3a2a1a, 0.55], sun: [0xffa860, 1.9], dir: [-0.5, 0.3, -0.6], exp: 1.0, beds: { wind: 0.04, water: 0.05 } },
      f96: { fog: [0xb0a08a, 0.011], env: 0.55, hemi: [0xe8dcc0, 0x2a2620, 0.6], sun: [0xffd8a8, 1.7], dir: [0.7, 0.35, -0.3], exp: 1.0, beds: { wind: 0.07 } },
      f49: { fog: [0x1c2632, 0.016], env: 0.32, hemi: [0x8aa8c8, 0x141820, 0.5], sun: [0x9ab8d8, 0.4], dir: [0.3, 0.8, 0.2], exp: 1.2, bg: 0x101824, beds: { rain: 0.05, hum: 0.02, hz: 60 } },
      lab: { fog: [0x6a7078, 0.007], env: 0.4, hemi: [0xe8eef4, 0x30343a, 0.5], sun: [0xffe0c0, 1.3], dir: [0.3, 0.8, 0.2], exp: 1.0, beds: { hum: 0.05, hz: 50 } },
      chron: { fog: [0xb8a0c0, 0.009], env: 0.6, hemi: [0xffe0f0, 0x2a2030, 0.6], sun: [0xffd0a8, 1.9], dir: [0.3, 0.25, -0.9], exp: 1.02, beds: { wind: 0.03 } },
      epi: { fog: [0xc8d0d8, 0.008], env: 0.7, hemi: [0xf0f4ff, 0x3a3a38, 0.7], sun: [0xfff2e0, 2.2], dir: [0.4, 0.5, 0.5], exp: 1.0, beds: { wind: 0.02 } },
    };
    let lookKey = null, lightT = 0;
    const applyLook = () => {
      const e = T.current, L = LOOK[e] || LOOK.conf; lookKey = e;
      scene.fog.color.set(L.fog[0]); scene.fog.density = L.fog[1];
      if (env) { scene.environment = env.envMap; scene.environmentIntensity = L.env; scene.background = L.bg ? new THREE.Color(L.bg) : (env.background || new THREE.Color(L.fog[0])); } else scene.background = new THREE.Color(L.bg || L.fog[0]);
      hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
      sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; sunDir.set(...L.dir).normalize();
      renderer.toneMappingExposure = L.exp;
      const b = L.beds || {}; audio.rain(b.rain || 0); audio.wind(b.wind || 0); audio.hum(b.hum || 0, b.hz || 52); audio.water?.(b.water || 0); audio.crowd?.(b.crowd || 0);
      lightT = 0;
    };
    const stateOk = (zone, states) => !states || states.includes(S.zs[zone] ?? T.current) || states.includes(T.current);
    const rigLights = () => {
      const p = game.cine ? game.engine.camera.position : pl.pos;
      const list = W.lightSrc.filter(s => !s.states || stateOk(s.zone, s.states)).map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      pts.forEach((l, i) => { const s = list[i]; if (!s || s.dd > 45 * 45) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
    };
    game.onUpdate(() => {
      const p = game.cine ? game.engine.camera.position : pl.pos;
      sun.target.position.set(p.x, p.y, p.z); sun.position.set(p.x + sunDir.x * 70, p.y + sunDir.y * 70 + 4, p.z + sunDir.z * 70);
    });
    game.onUpdate(dt => { lightT -= dt; if (lightT <= 0) { lightT = 0.4; rigLights(); if (T.current !== lookKey) applyLook(); } });

    // ---------- music ----------
    let curTheme = null, musicLock = null;
    const themeFor = () => {
      if (musicLock) return musicLock;
      if (S.zone === 'avenue') return 'm23-rain';
      if (S.zone === 'settle') return 'm23-past';
      if (S.zone === 'future') return 'm23-future';
      if (S.zone === 'lab') return S.phase === 'plate' || S.phase === 'hold1' || S.phase === 'seam' ? 'm23-hold' : 'm23-witness';
      if (S.zone === 'chron') return 'm23-mira';
      return 'm23-confluence';
    };
    const music = (fade = 1.6) => { const th = themeFor(); for (const d of T.defs) d.theme = th; if (th !== curTheme) { curTheme = th; audio.setTheme(th, fade); } };
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    let mT = 0; game.onUpdate(dt => { mT -= dt; if (mT <= 0) { mT = 0.5; musicState.threads = G.threads.size; music(); } });

    // ---------- zones: each place has its own states, and remembers the one it was left in ----------
    const zoneAt = (p) => {
      if (p.z > 48) return 'hall';
      if (p.z <= -54) return 'chron';
      if (p.z < -13.6 && Math.abs(p.x) < 9) return 'lab';
      if (p.x < -16.4) return 'settle';
      if (p.x > 16.4) return 'future';
      if (p.z > 8) return 'avenue';
      return 'plaza';
    };
    const ZDEF = {
      hall: () => [[{ id: 'hall', key: '1', name: 'TEST HALL ZERO', year: '08:14:10', glyph: '◯', color: '#ffd27a' }], 'hall', false],
      avenue: () => [[['a26', '2026', 'THE OPENING STREETS', '◷', '#ffd8a0'], ['a49', '2049', 'THE OPENING STREETS', '◉', '#5fe6ff'], ['a96', '2196', 'THE OPENING STREETS', '☄', '#b6ff8a']].map(([id, year, name, glyph, color], i) => ({ id, key: String(i + 1), name, year, glyph, color })), S.zs.avenue, !!G.seen.avIntroDone],
      plaza: () => [[{ id: 'conf', key: '1', name: 'THE CONFLUENCE', year: 'AFTER ZERO', glyph: '✣', color: '#ffc8a0' }], 'conf', false],
      settle: () => [[{ id: 'anc', key: '1', name: 'THE SETTLEMENT', year: 'c. 1000 BCE', glyph: '☼', color: '#ffc070' }], 'anc', false],
      future: () => [[['f49', '2049', 'RAIN CITY', '◉', '#5fe6ff'], ['f96', '2196', 'THE FUTURE CITY', '☄', '#b6ff8a']].map(([id, year, name, glyph, color], i) => ({ id, key: String(i + 1), name, year, glyph, color })), S.zs.future, !!G.seen.fuIntroDone],
      lab: () => [[{ id: 'lab', key: '1', name: 'HELIX LABORATORY', year: 'FOLDED', glyph: '⌬', color: '#38c8c0' }], 'lab', false],
      chron: () => [[{ id: 'chron', key: '1', name: 'THE ORIGINAL CHRONOLITH', year: 'EVERY ERA', glyph: '◯', color: '#9a7bff' }], 'chron', false],
    };
    const setZone = (z) => {
      if (S.zone === 'avenue' && ['a26', 'a49', 'a96'].includes(T.current)) S.zs.avenue = T.current;
      if (S.zone === 'future' && ['f49', 'f96'].includes(T.current)) S.zs.future = T.current;
      S.zone = z;
      const [defs, initial, unlocked] = ZDEF[z]();
      T.configure(defs, initial); T.unlocked = unlocked; T.refreshHud(); applyLook(); refreshVis(); music(1.2);
      if (game.residueOn && z !== 'settle' && z !== 'avenue') game.setResidue(false);
    };
    T.onSwitch((id) => { if (S.zone === 'avenue') S.zs.avenue = id; if (S.zone === 'future') S.zs.future = id; applyLook(); refreshVis(); });
    let zT = 0;
    game.onUpdate(dt => {
      zT -= dt; if (zT > 0) return; zT = 0.25;
      if (game.cine || T.switching || game._failing || S.phase === 'intro' || S.phase === 'ending') return;
      const z = zoneAt(pl.pos); if (z !== S.zone) setZone(z);
    });
    // local-state objects and people; far zones hide
    const ZC = { hall: [0, 62], avenue: [0, 28], plaza: [0, -3], settle: [-40, -5], future: [42, -6], lab: [0, -34], chron: [0, -76] };
    const ZR = { hall: 40, avenue: 52, plaza: 42, settle: 50, future: 52, lab: 44, chron: 70 };   // hide radius per zone (camera to centre)
    const people = [];   // { ch, zone, s }
    const refreshVis = () => {
      const cam = game.cine ? game.engine.camera.position : pl.pos;
      for (const v of W.sv) v.o.visible = v.s.includes(S.zone === v.z ? T.current : S.zs[v.z]);
      if (W.rain) W.rain.visible = S.zone === 'avenue' && T.current === 'a49';
      if (W.sea) W.sea.material.color.set(T.current === 'a49' || T.current === 'f49' ? 0x182230 : (LOOK[T.current]?.fog[0] ?? 0xc8a27a));
      for (const [k, [x, z]] of Object.entries(ZC)) { const r = W.zones[k]; if (r) r.visible = k === S.zone || (S.phase === 'intro' && k !== 'lab') || Math.hypot(cam.x - x, cam.z - z) < (game.cine ? ZR[k] * 1.6 : ZR[k]); }
      for (const p of people) {
        if (p.ch.hiddenByStory) { p.ch.root.visible = false; continue; }
        const st = !p.s || p.s.includes(S.zone === p.zone ? T.current : S.zs[p.zone]);
        const [x, z] = ZC[p.zone]; p.ch.root.visible = st && Math.hypot(cam.x - x, cam.z - z) < 60;
      }
    };
    let vT = 0; game.onUpdate(dt => { vT -= dt; if (vT <= 0) { vT = 0.5; refreshVis(); } });

    // ---------- switching rules: never into something solid, never onto nothing ----------
    const solidAt = (id) => {
      const p = pl.pos, y0 = p.y + 0.45, y1 = p.y + 1.6; let ground = false;
      for (const b of game.collision.boxes) {
        if (!b.enabled || (b.states && !b.states.includes(id)) || b.walkOnly) continue;
        if (!(p.x > b.min.x - 0.28 && p.x < b.max.x + 0.28 && p.z > b.min.z - 0.28 && p.z < b.max.z + 0.28)) continue;
        if (!b.ramp && b.max.y > y0 && b.min.y < y1) return 'solid';
        if (p.x > b.min.x - 0.05 && p.x < b.max.x + 0.05 && p.z > b.min.z - 0.05 && p.z < b.max.z + 0.05 && b.max.y <= p.y + 0.6 && b.max.y > p.y - 1.6) ground = true;
      }
      return ground ? null : 'void';
    };
    const baseCan = T.canSwitch.bind(T);
    T.canSwitch = (id) => {
      if (!baseCan(id)) return false;
      const s = solidAt(id);
      if (s) { if (once('solid' + id + Math.floor(game.time / 3))) { ui.toast(s === 'solid' ? 'SOMETHING STANDS HERE IN THAT STATE · MOVE' : 'NOTHING TO STAND ON THERE IN THAT STATE', 2200); audio.sfxPlay('fail'); } return false; }
      return true;
    };
    game.onUpdate(() => { if (game._failing && !S.failSeen) { S.failSeen = true; G.falls++; } else if (!game._failing) S.failSeen = false; });

    // =================================================================================================================
    // People
    // =================================================================================================================
    const witness = await actor('witness', ...P.witness0, PI * 0.85);
    const ghost = (ch, color) => { try { ch.setGhost(color); } catch (err) { void err; } };
    const hale = await actor('hale', ...P.hale, PI * 0.6); ghost(hale, 0xff8a9a); hale.pose = 'look'; people.push({ ch: hale, zone: 'avenue', s: ['a49'] });
    const jun = await actor('jun', ...P.jun, PI / 2); ghost(jun, 0xffd34a); people.push({ ch: jun, zone: 'avenue', s: ['a49'] });
    const niko = await actor('niko', ...P.niko, -PI * 0.6); ghost(niko, 0xffc070); people.push({ ch: niko, zone: 'settle' });
    const tala = await actor('tala', ...P.tala, -PI * 0.7); ghost(tala, 0xffc070); people.push({ ch: tala, zone: 'settle' });
    const keeper = await actor('m23settler', -26.5, 0, -10.6, PI * 0.2); keeper.pose = 'look'; people.push({ ch: keeper, zone: 'settle' });
    const sera = await actor('sera', ...P.sera, -PI * 0.6); people.push({ ch: sera, zone: 'future', s: ['f96'] });
    const gardener = await actor('m23scav', 28.6, 6, -11.6, PI * 0.9); gardener.pose = 'work'; people.push({ ch: gardener, zone: 'future', s: ['f96'] });
    const mira = await actor('mira', ...P.mira, 0); mira.pose = 'look'; people.push({ ch: mira, zone: 'chron' });
    for (const c of [witness, hale, jun, niko, tala]) c.noCollide = false;
    // crowds (lod): frozen commuters of 08:14 (2049), working settlers, 2196 survivors at the camp
    const frozenAt = (ch, pose) => { ch.pose = pose; let t = 0; const off = game.onUpdate(dt => { t += dt; if (t > 1.4) { ch.frozen = true; off(); } }); };
    [[-8.4, 44, PI, 'look'], [8.6, 40.5, PI * 1.1, 'look'], [-8.2, 31.5, 0.2, 'look'], [8.4, 33.5, PI, 'nod'], [-2.4, 30.4, PI / 2, 'look'], [-8.8, 26.5, PI * 0.5, 'look']].forEach(([x, z, ry, pose], i) => {
      const c = game.ambient({ ...COMMUTERS[i % COMMUTERS.length], lod: true, shadows: false, seed: 2330 + i }, x, x > 7 || x < -7 ? 0.15 : 0, z, ry); frozenAt(c, pose); people.push({ ch: c, zone: 'avenue', s: ['a49'] });
    });
    [[3.95, 12.2, PI / 2], [3.95, 16.4, PI / 2], [5.6, 14.0, -PI / 2]].forEach(([x, z, ry], i) => { const c = game.ambient({ ...COMMUTERS[(i + 2) % COMMUTERS.length], lod: true, shadows: false, seed: 2340 + i }, x, 0.45, z, ry); frozenAt(c, 'sit'); c.noCollide = true; people.push({ ch: c, zone: 'avenue', s: ['a49'] }); });
    [[-23.5, 4.5, 'work'], [-33.5, -12, 'work'], [-28.6, 6.8, 'look'], [-24.4, -12.6, 'sit']].forEach(([x, z, pose], i) => { const c = game.ambient({ ...SETTLERS[i], lod: true, shadows: false, seed: 2350 + i }, x, 0, z, (i * 1.9) % 6.28); c.pose = pose; people.push({ ch: c, zone: 'settle' }); });
    [[53.6, 6, -14.6, 'work'], [61, 6, -2.2, 'sit']].forEach(([x, y, z, pose], i) => { const c = game.ambient({ ...SURVIVORS[i], lod: true, shadows: false, seed: 2360 + i }, x, y, z, i ? PI : 0.4); c.pose = pose; people.push({ ch: c, zone: 'future', s: ['f96'] }); });

    // =================================================================================================================
    // Threads, seals, collectibles
    // =================================================================================================================
    const sealOn = (k) => { const s = W.seals[k]; if (!s) return; s.ring.material.emissive.set(0xffd27a); tween(1.4, u => { s.ring.material.emissiveIntensity = 0.4 + u * 2.4; s.core.material.color.setRGB(0.12 + u * 0.9, 0.1 + u * 0.7, 0.1 + u * 0.4); }); };
    const addThread = (k) => {
      if (G.threads.has(k)) return; G.threads.add(k); const D = THREADS[k];
      if (D.seal) sealOn(D.seal);
      const m = W.threadLights[D.n]; if (m) { m.visible = true; m.material.emissiveIntensity = 2.4; }
      audio.sfxPlay('success'); ui.toast(`THREAD ${G.threads.size}/4 · ${D.name}`, 3200);
      ev('Thread · ' + D.name, D.keep, 'Afterzero · what Kai carries');
      musicState.threads = G.threads.size;
    };
    const SH = [['the opening streets', P.hoardShard, ['a26']], ['the settlement', P.setShard, null], ['the future city', P.futShard, ['f96', 'f49']], ['the confluence', [-12.1, 0.8, -10.1], null], ['the laboratory', P.labShard, null], ['the Chronolith', P.chronShard, null]];
    for (const [where, p, states] of SH) {
      const m = shardMesh(); m.position.set(p[0], p[1] + 0.9, p[2]); scene.add(m); W.shards[where] = m;
      if (states) W.sv.push({ o: m, z: where === 'the opening streets' ? 'avenue' : 'future', s: states });
      game.onUpdate((dt, t) => { m.rotation.y = t * 1.2; m.position.y = p[1] + 0.9 + Math.sin(t * 2 + p[0]) * 0.08; });
      act({ pos: [p[0], p[1] + 0.9, p[2]], radius: 1.8, prompt: 'Take the temporal shard', states: states || undefined, enabled: () => !G.shardsTaken.has(where), onUse: () => {
        G.shardsTaken.add(where); m.visible = false; W.sv = W.sv.filter(v => v.o !== m); G.shards++; F.shards = (F.shards || 0) + 1;
        audio.sfxPlay('pickup'); ui.toast(`TEMPORAL SHARD ${G.shards}/6 · ${where.toUpperCase()}`, 2400);
      } });
    }
    const PAGES = [
      ['ATTEMPT 0001 · RAIN CITY', 'First time I came back I stood on this street and could not remember which side the station was on. It was always the west. I had forgotten my own city in a week.'],
      ['ATTEMPT 0212 · THE VALLEY', 'The keepers asked me why I wept at their fire. I told them I had come before the first fire. They wrote it down and cut a mark in the stone. Every one of me told them the same thing.'],
      ['ATTEMPT 0730 · 2196', 'Sera\'s grandmother gave me water. She said I looked like the statue. I said I was the statue. She laughed. I did not explain.'],
      ['ATTEMPT 1046 · HELIX', 'If he reads this: I was never trying to save her. I was trying not to be the one who lost her. Those are different. It took me one thousand and forty-six tries to see it.'],
    ];
    P.pages.forEach(([x, y, z, zone], n) => {
      const m = pageMesh(); m.position.set(x, y + 0.5, z); scene.add(m);
      const states = zone === 'avenue' ? ['a26', 'a49'] : zone === 'future' ? ['f96', 'f49'] : null;
      if (states) W.sv.push({ o: m, z: zone, s: states });
      act({ pos: [x, y + 0.6, z], radius: 1.8, prompt: 'Read the Witness\'s page', states: states || undefined, enabled: () => !G.pages.has(n), onUse: () => side(async () => {
        G.pages.add(n); m.visible = false; W.sv = W.sv.filter(v => v.o !== m);
        ev('The Witness\'s page · ' + PAGES[n][0], PAGES[n][1], 'Witness · last pages');
        await story(async () => {
          await closeUp([x, y + 0.4, z], [['kai', ['"I had forgotten my own city in a week." He wrote it like a confession.', '"Every one of me told them the same thing." A mark for each. Niko\'s stars-count.', '"I said I was the statue." Of course he did.', '"I was trying not to be the one who lost her." ...Neither was I.'][n]]]);
        });
        audio.sfxPlay('pickup'); ui.toast(`THE WITNESS'S LAST PAGES ${G.pages.size}/4`, 2200);
      }) });
    });

    // =================================================================================================================
    // THE AVENUE · the opening streets
    // =================================================================================================================
    async function avenueIntro() {
      await story(async () => {
        if (T.current !== 'a49') T.setImmediate('a49');
        await game.shot([0, 6.5, 47], [0, 2, 26], 2.4, { fov: 52 });
        await ui.chapterCard('AFTERZERO · I', 'The Opening Streets', 'Rain City · 2026 · 2049 · 2196', 3400);
        await game.say('m23band', 'Local states: three. Twenty twenty-six. Twenty forty-nine. Twenty-one ninety-six.');
        await game.say('kai', 'My street. The morning it started. Oh eight fourteen and it never got to fifteen.');
        await game.shot([4, 3, 30], [0, 2, 24], 1.8, { fov: 46 });
        await game.say('kai', trusted === false ? 'Checkpoint C. Hale\'s. Last time I didn\'t trust him.' : 'Checkpoint C. Hale\'s checkpoint. Sealed.');
        G.seen.avIntroDone = true; T.unlocked = true; T.refreshHud();
        game.checkpoint(...P.avenueEntry);
      });
      ui.toast('1 · 2 · 3 / Q · SWITCH THE STREET\'S STATE', 3600);
    }
    // the gate, the hoarding, the rubble: each state blocks the street differently
    act({ pos: [-2, 1.2, 25.2], radius: 2.6, prompt: 'Examine Checkpoint C', states: ['a49'], onUse: () => side(async () => {
      await story(async () => { await closeUp([0, 2, 24], [['kai', 'Sealed at oh eight fourteen. Nothing gets through a Helix gate in 2049.'], ['kai', 'In 2026 they hadn\'t built it yet. In 2196 nobody\'s left to close it.']], 3.4, 44, 1); });
      ev('Checkpoint C', 'Sealed in 2049. A building site in 2026; a fallen overpass in 2196. The street is blocked in every state, but not the same way.', 'The opening streets');
    }) });
    act({ pos: [-2, 1.2, 25.0], radius: 2.6, prompt: 'Examine the hoarding', states: ['a26'], onUse: () => side(async () => {
      await story(async () => { await closeUp([-2.6, 1.4, 24.3], [['kai', '"The future starts here." Helix\'s site, twenty-three years before the checkpoint.'], ['kai', 'Solid plywood, fixed in concrete. Not this way either.']], 3, 44, 0.6); });
    }) });
    act({ pos: [6, 1.0, 26.8], radius: 2.2, prompt: 'Examine the gap under the slab', states: ['a96'], onUse: () => side(async () => {
      await story(async () => { await closeUp([6, 0.8, 25], [['kai', 'A gap under the fallen slab. Low. I can get under it if I keep my head down.']], 2.6, 46, 0.6); });
      ui.toast('WALK INTO THE GAP · KAI CROUCHES BY HIMSELF', 3000);
    }) });
    // the stalled tram: the 08:14 passengers
    act({ pos: [P.tramDoor[0], 1.1, P.tramDoor[2]], radius: 2.0, prompt: 'Look at the passengers', states: ['a49'], enabled: () => !G.threads.has('passengers'), onUse: () => side(async () => {
      await story(async () => {
        await game.shot([1.2, 1.9, 12.4], [4.8, 1.3, 14.8], 1.6, { fov: 42 });
        await game.say('kai', 'The 08:14 to Calder Row. They\'re still sitting in it.');
        await game.say('kai', metJun ? 'The people Jun and I got off the train. Here they never had to get off.' : 'The people I pulled off the train. Here they never had to.');
        await game.say('m23band', 'A held second. It can be carried. Thread: the oh eight fourteen passengers.');
        await game.say('kai', 'I\'ll carry it. Whatever happens to it after, I\'ll decide.');
        addThread('passengers');
      });
    }) });
    act({ pos: [P.booth[0] - 1, 1.2, P.booth[2] + 0.6], radius: 2.2, prompt: 'Talk to Hale\'s echo', states: ['a49'], onUse: () => side(async () => {
      if (!G.talks.has('hale')) G.talks.add('hale');
      await story(async () => {
        await convo(hale, trusted === false ? [
          ['hale', 'Varen. You didn\'t trust me last time. You were right not to. You were wrong about why.'],
          ['kai', 'Brandt wiped the logs. You refused.'],
          ['hale', 'I refused once. Nobody writes that down. Go on. The gate\'s not the only way through.'],
        ] : [
          ['hale', 'Varen. You trusted me once. It was the right call. Nobody tells you that, so I will.'],
          ['kai', 'You\'re an echo.'],
          ['hale', 'I\'m a man who stood at a gate at eight fourteen. That\'s all an echo is. The gate\'s not the only way through.'],
        ]);
      });
      ev('Hale\'s echo', 'Officer Hale\'s echo at Checkpoint C, 08:14 in 2049: "The gate\'s not the only way through."', 'The opening streets');
    }) });
    act({ pos: [P.jun[0] + 1, 1.2, P.jun[2]], radius: 2.2, prompt: 'Talk to Jun\'s echo', states: ['a49'], onUse: () => side(async () => {
      G.talks.add('jun');
      await story(async () => {
        await convo(jun, [
          ['jun', 'My phone says 8:14. The station board says tomorrow.'],
          ['kai', metJun ? 'Jun. You got everyone off the platform.' : 'You run this station.'],
          ['jun', 'I keep trying to. Every train I\'ve ever held is still waiting somewhere. Let some of them go, would you?'],
        ]);
      });
      ev('Jun Park\'s echo', '"My phone says 8:14. The station board says tomorrow." Jun at Central Station\'s door, still holding every train he ever held.', 'The opening streets');
    }) });
    act({ pos: [P.statue[0], 0.8, P.statue[2] + 1.6], radius: 2.2, prompt: 'Read the statue\'s plaque', states: ['a96'], onUse: () => side(async () => {
      await story(async () => { await closeUp([P.statue[0], 0.7, 42.6], [['kai', '"Architect of the Fracture." Someone added a line. "He did not mean it. He did it anyway."'], ['kai', 'Fair.']], 1.6, 40, 0.3); });
      ev('The fallen statue', 'Kai\'s bronze statue lies in the 2196 street. Under "Architect of the Fracture" someone has scratched: "He did not mean it. He did it anyway."', 'The opening streets');
    }) });
    act({ pos: [P.hoardShard[0] + 1.2, 1, 28.4], radius: 1.8, prompt: 'Read the site board', states: ['a26'], onUse: () => side(async () => {
      await story(async () => { await closeUp([-8.6, 1.6, 28.4], [['kai', 'Site board. "Open day nineteenth October. Families welcome, eight o\'clock." Mum signed us up for that.']], 2, 42, 0.3); });
      ev('The site board (2026)', 'Helix\'s 2026 site board advertises the open day of 19 October: "Families welcome, 08:00."', 'The opening streets');
    }) });
    // stalls and hints
    hint(() => S.zone === 'avenue' && pl.pos.z > 24.5 && G.seen.avIntroDone, 60, () => { ui.subtitle('kai', G.seen.avH1 ? 'The rubble in 2196 has a low gap on the right. I can get under it.' : 'Gate in 2049. Hoarding in 2026. What does 2196 have here?', 3400); G.seen.avH1 = true; });
    hint(() => S.zone === 'avenue' && T.current === 'a96' && pl.pos.z < 22.2 && pl.pos.z > 19.5, 20, () => ui.subtitle('kai', 'The road\'s gone in 2196. It was there in the other two. Switch here, before I step off.', 3400));
    hint(() => S.zone === 'avenue' && pl.pos.z < 20 && pl.pos.z > 8 && !G.threads.has('passengers') && T.current !== 'a49', 40, () => ui.subtitle('kai', 'The tram. In 2049 it\'s still standing here with the passengers in it.', 3000));

    // =================================================================================================================
    // THE CONFLUENCE · where everything meets
    // =================================================================================================================
    async function plazaIntro() {
      await story(async () => {
        witness.root.position.set(...P.witnessPlaza); witness.root.rotation.y = PI * 0.95; witness.pose = 'look';
        await game.shot([0, 5, 6], [0, 5, -14], 2.6, { fov: 54 });
        await ui.chapterCard('AFTERZERO', 'The Confluence', 'Where every place meets', 3000);
        await game.say('m23band', 'Fracture wall. Seals: three. Threads required: one from each place still holding on.');
        await convo(witness, [
          ['witness', 'The streets. The valley. The city that forgot tomorrow. Each one is holding a second it won\'t give back.'],
          ['kai', 'And behind the wall?'],
          ['witness', 'Helix. Folded up like a letter. The hall closes behind anyone who walks it, unless someone holds it open.'],
          ['kai', 'Then we hold it. Both of us.'],
          ['witness', together ? 'We started the second together. I suppose we can finish a corridor.' : 'You let the second start without me. Fair. This part needs two.'],
        ]);
        await game.shot([-4, 3.5, 2], [-16, 2, -2], 1.6, { fov: 48 });
        await game.say('kai', 'West, the settlement. East, the city. Any order.');
      });
      game.checkpoint(...P.plazaEntry);
      ui.toast('WEST · THE SETTLEMENT    EAST · THE FUTURE CITY', 4000);
    }
    const WTOP = [
      ['The places', [['kai', 'Why these places?'], ['witness', 'Every one is somewhere I tried to stop it. The street I ran down. The valley where I buried the core. The city that put up my statue.'], ['witness', 'They follow me now. Like debts.']]],
      ['Mira', [['kai', 'Is she waiting for us?'], ['witness', 'For you. She stopped waiting for me around attempt six hundred. I didn\'t notice for another two hundred.'], ['witness', 'Ask her things. I only ever told her things.']]],
      ['The attempts', [['kai', `One thousand and forty-six. Did you count every one?`], ['witness', `${iters === 1046 ? 'Every one' : 'Most'}. Count long enough and the number becomes the reason. That was my mistake. Not the first. The longest.`]]],
      ['After', [['kai', 'What happens to you after?'], ['witness', 'Nobody has asked me that in twenty-five years.'], ['witness', 'I don\'t know. That\'s new. I think I like it.']]],
    ];
    act({ pos: () => witness.root.position, radius: 2.2, prompt: 'Talk to the Witness', enabled: () => S.phase === 'explore' && S.zone === 'plaza' && G.talks.size < 99, onUse: () => side(async () => {
      const left = WTOP.filter(([k]) => !G.talks.has('w:' + k));
      if (!left.length) { await story(async () => { await convo(witness, [['witness', G.threads.size >= 3 ? 'The seals are lit. The wall is waiting for you.' : 'The seals, Kai. I\'ll be here.']]); }); return; }
      const opts = left.map(([k]) => k).concat(['Later']);
      const i = await choose('witness', 'Ask me. I\'m not going anywhere. Yet.', opts, 0);
      if (i >= left.length) return;
      G.talks.add('w:' + left[i][0]);
      await story(async () => { await convo(witness, left[i][1]); });
    }) });
    // interactions that follow a moving person (act() with pos as a function)
    game.onUpdate(() => { for (const it of game.interactables) if (it.posFn) { const q = it.posFn(); it.pos.set(q.x, q.y + 1, q.z); } });
    act({ pos: [P.clock[0] + 1, 1.2, P.clock[2]], radius: 2.0, prompt: 'Look at the clock with no hands', onUse: () => side(async () => {
      await story(async () => { await closeUp([P.clock[0], 4.05, P.clock[2]], [['kai', 'A clock with no hands. It isn\'t stopped. It just doesn\'t measure anything.'], ['kai', 'Mira drew one of these when she was ten. She said it was what the machine showed.']], 2.4, 40, 0.2); });
      ev('The clock with no hands', 'A station clock at the Confluence with no hands at all: an event without a measurable duration. Mira drew one at ten.', 'The Confluence');
    }) });
    act({ pos: [0, 1.2, -12.4], radius: 3.2, prompt: 'Touch the fracture wall', enabled: () => S.phase === 'explore', onUse: () => side(async () => {
      if (G.threads.size >= 3) { await openWall(); return; }
      const missing = ['passengers', 'keepers', 'tomorrow'].filter(k => !G.threads.has(k)).map(k => ({ passengers: 'the opening streets (the tram, in 2049)', keepers: 'the settlement (west)', tomorrow: 'the future city (east)' }[k]));
      await story(async () => { await game.shot([0, 2.4, -6], [0, 4, -14], 1.2, { fov: 50 }); await game.say('m23band', `Seals lit: ${G.threads.size} of three. Missing: ${missing.join('; ')}.`); });
    }) });

    // =================================================================================================================
    // THE SETTLEMENT · three hearths, the mural, the stream, the shrine
    // =================================================================================================================
    const ORDER = ['sun', 'ring', 'river'];
    async function settleIntro() {
      await story(async () => {
        await game.shot([-19, 3.2, 6], [-32, 1.2, -4], 2.4, { fov: 50 });
        await ui.chapterCard('AFTERZERO · II', 'The Settlement', 'The keepers\' valley · about three thousand years before Helix', 3400);
        await game.say('m23band', 'Local state: one. No switching here. The valley only has the one past.');
        await game.say('kai', villageKnown ? 'Niko\'s valley. Before the dam, before the reservoir. Before me, supposedly.' : 'A settlement. Three thousand years ago, and it still knows my face.');
        await game.shot([-27, 2.4, -6], [-44, 0, -6], 1.8, { fov: 46 });
        await game.say('kai', 'The shrine\'s across the stream. No bridge. Three cold hearths. A painted wall.');
        game.checkpoint(...P.setEntry);
      });
    }
    act({ pos: [P.ember[0], 1.0, P.ember[2]], radius: 1.8, prompt: 'Take an ember', enabled: () => !G.ember && !G.stones, onUse: () => side(async () => {
      G.ember = true; audio.sfxPlay('pickup'); ui.toast('AN EMBER · LIGHT THE HEARTHS IN THE OLD ORDER', 3000);
      ui.subtitle('kai', 'Still warm. Three thousand years and still warm.', 2600);
    }) });
    const relight = (k, on) => { const h = W.hearths[k]; h.lit = on; h.fire.visible = on; };
    for (const k of ORDER) {
      const h = P.hearths[k];
      act({ pos: [h[0], 0.8, h[2]], radius: 1.9, prompt: `Light the ${k} hearth`, enabled: () => !G.stones && !W.hearths[k].lit, onUse: () => side(async () => {
        if (!G.ember) { ui.subtitle('kai', 'Nothing to light it with. There was a warm bowl by the first house.', 2800); return; }
        relight(k, true); G.lit.push(k); audio.sfxPlay('spark');
        const ok = G.lit.every((x, i) => x === ORDER[i]);
        if (!ok) {
          G.hearthMisses++; await game.wait(0.8);
          for (const kk of ORDER) relight(kk, false); G.lit = []; audio.sfxPlay('fail');
          await story(async () => {
            await game.say('niko', G.hearthMisses < 2 ? 'Not that one. The old story goes another way.' : 'The wall remembers the way. The part that was scrubbed out, too, if you look with the other eyes.');
            if (G.hearthMisses >= 2) ui.toast('F · RESIDUE VISION SHOWS WHAT WAS PAINTED OVER', 3200);
          });
          return;
        }
        if (G.lit.length === 3) await raiseStones();
        else ui.subtitle('kai', G.lit.length === 1 ? 'It took. One.' : 'Two. The river\'s left.', 2200);
      }) });
    }
    act({ pos: [P.mural[0], 1.2, P.mural[2] + 1.6], radius: 2.6, prompt: 'Read the mural', enabled: () => !game.residueOn, onUse: () => side(async () => {
      await story(async () => { await closeUp([P.mural[0], 1.8, P.mural[2]], [['kai', 'Three panels. A fire under the sun. The second scrubbed out. A fire under the river.'], ['kai', 'Somebody scraped panel two on purpose. There\'ll be an echo of the paint.']], 5.2, 46, 0.2); });
      ev('The keepers\' mural', 'Three panels: fire under the sun; a panel scraped away; fire under the river. Residue Vision shows the scraped panel\'s paint.', 'The settlement');
      ui.toast('F · RESIDUE VISION', 2600);
    }) });
    act({ pos: [P.mural[0], 1.2, P.mural[2] + 1.6], radius: 2.6, prompt: 'Read the mural (echo)', enabled: () => game.residueOn, onUse: () => side(async () => {
      G.seen.muralEcho = true;
      await story(async () => { await closeUp([P.mural[0], 1.8, P.mural[2]], [['kai', 'There. Panel two: a fire under a ring. A broken ring.'], ['kai', 'Sun, then the ring, then the river. They scrubbed the ring out after someone told them what it was.']], 5.2, 46, 0.2); });
      ev('The scraped panel', 'Under Residue Vision panel two shows a fire under a broken ring. The order: sun, ring, river.', 'The settlement');
    }) });
    async function raiseStones() {
      G.stones = true; audio.sfxPlay('success');
      await story(async () => {
        lockMusic('m23-past');
        await game.shot([-38, 3, -1], [-43, -0.5, -6.3], 1.6, { fov: 46 });
        await game.say('kai', 'Sun. Ring. River.');
        audio.sfxPlay('rewind');
        const stones = W.stones;
        await tween(2.6, (e) => { for (const s of stones) { s.m.position.y = -1.4 + e * 1.0; } });
        for (const s of stones) s.b.enabled = true;
        await game.say('niko', 'Water crossing stone. That is how the old story ends.');
        musicLock = null;
      });
      game.checkpoint(-39, 0, -6, -PI / 2);
    }
    act({ pos: [P.shrine[0] + 1.4, 1.0, P.shrine[2]], radius: 2.4, prompt: 'Speak with the keepers', enabled: () => !G.threads.has('keepers'), onUse: () => side(async () => {
      await story(async () => {
        lockMusic('m23-mira', 1.2);
        await game.shot([-48.6, 1.8, -2.6], [-51.8, 1.4, -2.2], 1.8, { fov: 44 });
        await game.say('tala', 'You came before the first fire.');
        await game.say('niko', 'That is what the others said.');
        await convo(niko, [
          ['kai', 'How many others?'],
          ['niko', 'Sixteen came before you, wearing your face. The stars-count knew you were the seventeenth. You are the first who asked us something instead of telling us.'],
          ['tala', 'We kept every one of them. The marks are on the stone. Our grandchildren\'s grandchildren will repaint them.'],
          ['kai', 'Can I carry that? What you remember.'],
          ['niko', 'Carry it. Then decide if it is worth keeping. A story you are made to keep is just a wall.'],
        ]);
        await game.say('m23band', 'Thread: the keepers\' memory.');
        addThread('keepers'); musicLock = null;
      });
      ev('The seventeen marks', 'The keepers cut seventeen marks for the men with Kai\'s face; sixteen came before him, and he is the seventeenth. Niko: "You are the first who asked us something instead of telling us."', 'The settlement');
    }) });
    act({ pos: [-27.6, 1.0, -10.4], radius: 2.0, prompt: 'Talk to the keeper', onUse: () => side(async () => {
      G.talks.add('keeper');
      await story(async () => { await convo(keeper, [['m23settler', 'You wear no dust, but the old story knows your face.'], ['kai', 'What does the story say I do?'], ['m23settler', 'It says you light the fires and leave. It never says where you go. We argue about that part at night.']]); });
    }) });
    act({ pos: [P.helixCard[0], 0.6, P.helixCard[2]], radius: 1.8, prompt: 'Look at the threshold stone', onUse: () => side(async () => {
      await story(async () => { await closeUp([P.helixCard[0], 0.05, P.helixCard[2]], [['kai', 'My Helix card. Pressed into the stone. Three thousand years old and still says K. Varen.']], 1.2, 40, 0.6); });
      ev('The Helix card in the stone', 'Kai\'s Helix card set into the shrine\'s threshold stone, 3,000 years old. The same card M4 found.', 'The settlement');
    }) });
    hint(() => S.zone === 'settle' && !G.stones && G.seen.setIntroDone, 75, () => ui.subtitle('kai', !G.ember ? 'The ember bowl by the first house. Fire first.' : !G.seen.muralEcho ? 'The mural knows the order. The scraped panel needs the other eyes.' : 'Sun, ring, river.', 3000));

    // =================================================================================================================
    // THE FUTURE CITY · the skybridge, Lantern Hall
    // =================================================================================================================
    async function futureIntro() {
      await story(async () => {
        if (T.current !== 'f96') T.setImmediate('f96');
        await game.shot([18, 4, 8], [42, 6, -6], 2.4, { fov: 52 });
        await ui.chapterCard('AFTERZERO · III', 'The Future City', 'Rain City · 2196 · and the bridge it lost in 2049', 3400);
        await game.say('m23band', 'Local states: two. Twenty forty-nine. Twenty-one ninety-six.');
        await game.shot([44, 9, 4], [58, 8, -8], 1.8, { fov: 46 });
        await game.say('kai', beacon ? 'Lantern Hall\'s beacon. I fixed it once. It\'s dark again.' : 'A beacon on the roof across the gap. Someone\'s camp.');
        await game.say('kai', 'The fissure has no bottom. The bridge has no middle. Up the ramp first.');
        G.seen.fuIntroDone = true; T.unlocked = true; T.refreshHud();
        game.checkpoint(...P.futEntry);
      });
      ui.toast('1 · 2049    2 · 2196', 3000);
    }
    hint(() => S.zone === 'future' && !G.beacon && pl.pos.y > 5 && pl.pos.x > 33 && pl.pos.x < 37.4 && T.current === 'f96', 18, () => ui.subtitle('kai', 'Six metres. Not even with a run. In 2049 the bridge was whole.', 3000));
    hint(() => S.zone === 'future' && !G.beacon && pl.pos.y > 5 && pl.pos.x > 41 && pl.pos.x < 44.2 && T.current === 'f49', 14, () => ui.subtitle('kai', 'Shutter in 2049. In 2196 there\'s no shutter. And past the gap there\'s bridge.', 3200));
    hint(() => S.zone === 'future' && !G.beacon && pl.pos.y < 1 && G.seen.fuIntroDone, 90, () => ui.subtitle('kai', 'The ramp up the parking deck. Then the bridge.', 2600));
    act({ pos: [P.sera[0] + 0.9, 7.1, P.sera[2] + 0.6], radius: 2.4, prompt: 'Talk to Sera', states: ['f96'], enabled: () => !G.beacon, onUse: () => side(async () => {
      await story(async () => {
        await convo(sera, [
          ['sera', seraTrust > 0 ? 'Varen. You came across the bridge that isn\'t there. Of course you did.' : 'Architect. You came across the bridge that isn\'t there. Of course you did.'],
          ['kai', 'Your beacon\'s dark.'],
          ['sera', 'Since your second started, every light in 2196 flickers between now and never. This one went to never.'],
          ['sera', 'Help me hold the coil while I seat it. It wants two hands and a man who doesn\'t believe in endings.'],
        ]);
      });
      G.talks.add('sera0'); objective('Hold the beacon\'s coil while Sera seats it');
    }) });
    act({ pos: [P.beacon[0] - 0.9, 7.0, P.beacon[2] + 0.4], radius: 2.0, hold: 2.2, prompt: 'Hold the coil', states: ['f96'], enabled: () => !G.beacon && G.talks.has('sera0'), onUse: () => side(async () => {
      G.beacon = true; audio.sfxPlay('success');
      await story(async () => {
        lockMusic('m23-future');
        await tween(2.4, (e) => { W.beaconLamp.material.emissiveIntensity = 0.3 + e * 3.4; });
        await game.shot([52, 9, 4], [58.5, 12.5, -9], 2.0, { fov: 44 });
        await game.say('sera', 'There. The light stays on.');
        await convo(sera, [
          ['sera', seraTrust < 0 ? 'You left people in their loops once and said you\'d come back. You came back. People change. Even statues.' : F.m15choice === 'free' ? 'You freed a city that didn\'t want freeing once. This one wanted it.' : F.m15choice === 'stabilize' ? 'You kept Harrow Reach in its one safe day. This roof wanted tomorrow, and you gave it.' : 'Three times out of Block D4, and now this. People change. Even statues.'],
          ['kai', 'I need something from here. A thread. Something 2196 is holding on to.'],
          ['sera', 'Take tomorrow. It\'s the only thing we ever had too much of. Bring it back if you can. Let it go if you have to.'],
          ['sera', ally === 'sera' || ally === 'lantern' ? 'And I\'ll keep the light on for you. Like at the Bastion.' : 'I\'ll keep the light on. Whatever you decide.'],
        ]);
        addThread('tomorrow');
        W.plank.visible = true; W.plankBox.enabled = true; G.plank = true;
        ui.subtitle('sera', 'Plank\'s across the gap for the way back. Don\'t look down. There\'s no down.', 3400);
        musicLock = null;
      });
      ev('Lantern Hall\'s beacon', 'Kai held the coil while Sera seated it. "The light stays on." She gave him tomorrow to carry.', 'The future city');
      game.checkpoint(46, 6, -6.5, -PI / 2);
    }) });
    act({ pos: () => gardener.root.position, radius: 2.2, prompt: 'Talk to the gardener', states: ['f96'], onUse: () => side(async () => {
      G.talks.add('gardener');
      await story(async () => { await convo(gardener, [['m23scav', 'The channel is running again. Nobody alive remembers who opened it.'], ['kai', 'I might know.'], ['m23scav', 'Then don\'t tell me. I like it as a mystery. Beans don\'t care who dug the ditch.']]); });
    }) });
    act({ pos: [P.garden[0], 7, P.garden[2] + 1.8], radius: 1.8, prompt: 'Read the garden marker', states: ['f96', 'f49'], onUse: () => side(async () => {
      await story(async () => { await closeUp([P.garden[0], 6.7, P.garden[2] + 1.6], [['kai', '"Planted for a tomorrow nobody here will see." Signed W. Wren.']], 1.4, 40, 0.3); });
      ev('The roof garden', 'Lantern Hall\'s roof garden: "Planted for a tomorrow nobody here will see." — W.', 'The future city');
    }) });

    // =================================================================================================================
    // THE FRACTURE WALL OPENS · the laboratory · cooperating with the Witness
    // =================================================================================================================
    async function openWall() {
      S.phase = 'wall';
      await story(async () => {
        lockMusic('m23-witness', 1.2);
        witness.root.position.set(1.4, 0, -10.4); witness.root.rotation.y = PI;
        pl.place(-1.4, 0, -9.6, PI);
        await game.shot([0.2, 2.2, -3.4], [0, 3.6, -14], 2.0, { fov: 54 });
        await game.say('m23band', 'Seals: three of three.');
        audio.sfxPlay('anomaly'); game.shake = 0.04;
        await tween(2.2, (e) => { W.veil.material.uniforms.uC.value.setRGB(1, 0.78 + e * 0.2, 0.62 + e * 0.38); W.veil.scale.x = 1 - e * 0.82; });
        W.wallMid.enabled = false; game.shake = 0;
        await game.shot([3, 2.4, -11], [0, 2, -24], 1.8, { fov: 46 });
        await game.say('kai', 'Helix. The corridor to Test Hall Zero.');
        await convo(witness, [
          ['witness', 'It\'s been folding since the second started. Walk in alone and it closes on you halfway.'],
          ['witness', 'I hold the first door. You lock the console at the far end. Then you hold the plate and I cross.'],
          ['kai', 'Taking turns.'],
          ['witness', 'I\'ve never had anyone to take turns with. Don\'t make me regret it.'],
        ]);
      });
      musicLock = null;
      S.phase = 'hold1'; await startHold1();
    }
    // section 1: the Witness holds D1; Kai crosses the reversed lab hall and locks the console before he lets go
    const HOLD_SEC = auto ? 240 : 32;
    let holdT = 0, lanesOn = false;
    const doorTo = (d, open, dur = 1.0) => { const D = W.doors[d]; D.b.enabled = !open; return tween(dur, (e) => { D.m.position.y = (open ? 1.7 + e * 3.3 : 5.0 - e * 3.3) + (d === 'd3' ? 0.1 : 0); }); };
    async function startHold1() {
      witness.root.position.set(-2.4, 0, -19.2); witness.root.rotation.y = PI; witness.pose = 'work'; witness.hiddenByStory = false;
      await story(async () => {
        pl.place(0, 0, -16.5, PI);
        await game.shot([4, 2.6, -16], [-2.4, 1.6, -19.6], 1.4, { fov: 42 });
        await game.say('witness', 'Door\'s held. The equipment runs backwards in there. Don\'t let it touch you. Go.');
        await doorTo('d1', true, 1.2);
      });
      holdT = HOLD_SEC; lanesOn = true; musicState.hold = 0;
      game.checkpoint(0, 0, -17.2, PI, () => { holdT = HOLD_SEC; musicState.hold = 0; });
    }
    game.onUpdate((dt, t) => {
      // the lanes: equipment sliding along x and back
      for (const L of W.lanes) L.items.forEach((g, i) => {
        if (lanesOn) { const x = Math.sin(t * 0.9 + L.ph + i * PI) * 6.2; g.position.x = x; }
        else if (G.consoleLocked) g.position.x += ((i ? 6.6 : -6.6) - g.position.x) * Math.min(1, dt * 2);
      });
      if (S.phase !== 'hold1' || game._failing || S.busy || !game.control) return;
      holdT -= dt; musicState.hold = 1 - holdT / HOLD_SEC;
      ui.objective(`Reach the anchor console before the Witness lets go · ${Math.max(0, Math.ceil(holdT))} s`);
      for (const L of W.lanes) for (const g of L.items) if (Math.abs(pl.pos.x - g.position.x) < 0.95 && Math.abs(pl.pos.z - L.z) < 0.75 && pl.pos.y < 1.2) { G.holdFails++; game.fail('THE REVERSED HALL THREW YOU BACK'); return; }
      if (holdT <= 0) { G.holdFails++; game.fail('THE WITNESS LET GO · THE HALL CLOSED'); }
    });
    act({ pos: [P.console1[0], 1.1, P.console1[2] + 0.4], radius: 1.8, hold: 1.4, prompt: 'Lock the route', enabled: () => S.phase === 'hold1', onUse: () => side(async () => {
      G.consoleLocked = true; lanesOn = false; S.phase = 'plate'; audio.sfxPlay('success');
      W.consoleGlow.material.emissiveIntensity = 2.6;
      await story(async () => {
        await game.shot([2.6, 2.2, -32.6], [5.2, 1.2, -34.6], 1.2, { fov: 44 });
        await game.say('m23band', 'Route lock: holding. Anchor plate active.');
        await game.say('witness', 'Good. Now the plate. Stand on it and don\'t move. I\'m coming through.');
      });
      W.plate.material.emissive.set(0xffd27a); W.plate.material.emissiveIntensity = 1.2;
      game.checkpoint(P.plate[0], 0, P.plate[2] + 1.2, PI);
      plateCrossing();
    }) });
    // section 2: Kai holds the plate while the Witness crosses
    let wTok = 0;
    async function plateCrossing() {
      const tok = ++wTok;
      witness.root.position.set(-2.4, 0, -19.2); witness.pose = null;
      objective('Stand on the anchor plate while the Witness crosses');
      await game.waitFor(() => near(P.plate, 0.95) || wTok !== tok);
      if (wTok !== tok) return;
      ui.subtitle('witness', 'Hold it.', 1600);
      const path = [[-2.4, 0, -21], [-1.2, 0, -26], [-2.2, 0, -31], [P.witnessHold[0], 0, P.witnessHold[2]]];
      let off = 0, walking = true;
      const watch = game.onUpdate((dt) => {
        if (!walking || game._failing) return;
        if (!near(P.plate, 1.0)) { off += dt; ui.objective(`Back on the plate! ${Math.max(0, Math.ceil(2 - off))}`); if (off > 2) { walking = false; } }
        else if (off > 0) { off = 0; ui.objective('Stand on the anchor plate while the Witness crosses'); S.obj = ''; }
      });
      const arrived = walkTo(witness, path, 1.35).then(() => 'ok');
      const broke = game.waitFor(() => !walking).then(() => 'broke');
      const r = await Promise.race([arrived, broke]); watch();
      if (r === 'broke') {
        witness._walk++; G.plateFails++; audio.sfxPlay('rewind');
        await story(async () => { await game.say('witness', 'Kai! The plate. The hall pushed me back to the door. Again.'); });
        if (wTok === tok) plateCrossing();
        return;
      }
      witness.root.rotation.y = PI;
      await story(async () => {
        await convo(witness, [['witness', 'There. Two people, one corridor. Turns out it\'s easier.'], ['kai', 'The seam\'s next.'], ['witness', 'Things fall upward in there. I\'ll slow it. I can\'t stop it. Go when the stones come up.']]);
      });
      S.phase = 'seam'; seamOn = true; witness.pose = 'work';
      game.checkpoint(0, 0, -36.2, PI, () => { G.seamFalls++; });
    }
    // section 3: the seam: debris that falls upward and back down; the Witness slows it
    let seamOn = false, seamT = 0;
    game.onUpdate((dt, t) => {
      if (seamOn) seamT += dt * (auto ? 0.6 : 0.85);
      const PER = 7.5;
      for (const p of W.plats) {
        if (p.deco) { p.m.position.y = p.y0 + Math.sin(t * 0.5 + p.ph) * 1.4; p.m.rotation.y += dt * 0.2; continue; }
        let y = -6;
        if (seamOn) { const u = ((seamT + p.ph * 0.6) % PER + PER) % PER; y = u < 1.2 ? -6 + 6 * Math.sin(u / 1.2 * PI / 2) : u < 4.8 ? 0 : u < 6.0 ? -6 * (1 - Math.cos((u - 4.8) / 1.2 * PI / 2)) : -6; }
        if (S.seamHold) y = 0;
        if (S.seamDrop) y = Math.max(-8, (p.m.position.y + 0.3) - dt * 6);
        p.m.position.y = y - 0.3; p.b.min.y = y - 0.6; p.b.max.y = y;
      }
    });
    game.onUpdate(() => {
      if (S.phase !== 'seam' || S.busy || game.cine) return;
      if (pl.pos.z < -46.3 && pl.pos.y > -0.5) { S.phase = 'sacrifice'; side(sacrifice); }
    });
    hint(() => S.phase === 'seam' && pl.pos.z > -37.2, 40, () => ui.subtitle('witness', 'When the first stone rises, go. Don\'t wait for all three.', 3000));
    // the Witness stays
    async function sacrifice() {
      await story(async () => {
        lockMusic('m23-witness', 1.0);
        S.seamHold = true;
        await game.shot([3.2, 2.2, -49], [0, 1, -38], 1.8, { fov: 46 });
        await game.say('witness', 'Kai. It\'s closing from my side. I can hold it open for you, or I can cross. Not both.');
        const i = await choose('kai', 'He has the same face. Older. Tired.', ['Come with me. We\'ll find a way.', 'You knew. You knew it would end like this.', 'What do I tell her?'], 2);
        G.witnessAnswer = ['come', 'knew', 'tell'][i];
        if (i === 0) { await game.say('kai', 'Come with me. We\'ll find a way.'); await game.say('witness', 'That sentence is how I got here, Kai. One thousand and forty-six times.'); }
        if (i === 1) { await game.say('kai', 'You knew. You knew it would end like this.'); await game.say('witness', 'I knew it would end. I didn\'t know I\'d choose how. That part\'s new.'); }
        if (i === 2) { await game.say('kai', 'What do I tell her?'); await game.say('witness', 'Nothing from me. Ask her what she wants. I never did.'); }
        await game.shot([0.8, 1.7, -45], [-2.6, 1.5, -36], 1.6, { fov: 36 });
        await game.say('witness', 'Take these. Every attempt. They\'re not a debt any more. Decide what they are.');
        await game.say('m23band', 'Thread: the Witness\'s attempts. One thousand and forty-six.');
        addThread('attempts');
        await game.say('witness', 'I was in every second of this. Let me be in one I chose.');
        await game.say('kai', 'Thank you.');
        await game.say('witness', together ? 'We made the second together. Go and end it well.' : 'Go. She\'s waiting for you. Not for me.');
        ghost(witness, 0xff8a6a);
        await tween(2.4, (e) => { witness.root.position.y = e * 0.2; });
        audio.sfxPlay('rewind'); S.seamHold = false; S.seamDrop = true; seamOn = false;
        await game.wait(0.6);
        witness.hiddenByStory = true; witness.root.visible = false;
        await game.shot([0, 2.2, -49.4], [0, 2, P.d3z], 1.2, { fov: 46 });
        await doorTo('d3', true, 1.4);
        F.witnessFate = 'held-the-seam';
        ev('The Witness held the seam', 'He stayed behind in the folding laboratory so the last door could open. "Let me be in one I chose."', 'The laboratory');
      });
      musicLock = null; S.phase = 'toMira';
      game.checkpoint(0, 0, -51, PI);
    }

    // =================================================================================================================
    // THE ORIGINAL CHRONOLITH · Mira · what to keep · the three ways
    // =================================================================================================================
    async function chronIntro() {
      S.phase = 'mira';
      await story(async () => {
        lockMusic('m23-mira', 1.6);
        await game.shot([0, 14, -50], [0, 3, -80], 0.01, { fov: 56 });
        await game.shot([0, 6, -58], [0, 3.5, -82], 4.0, { fov: 50 });
        await ui.chapterCard('AFTERZERO · IV', 'The Original Chronolith', 'Where the keepers found it · where Helix found it · where it began', 3600);
        pl.place(0, 0, -72.4, PI);
        await game.shot([2.4, 1.7, -71], [0, 1.5, -76.2], 2.2, { fov: 38 });
        mira.root.rotation.y = 0; mira.pose = null;
        await convo(mira, [
          ['mira', 'You came through the corridor. He stayed, didn\'t he.'],
          ['kai', 'He held it open.'],
          ['mira', 'Of course he did. He was always better at holding things than letting them go.'],
        ]);
        const i = await choose('mira', 'So. What did you come here to do, Kai?', ['Ask you what you want.', 'Fix this. Properly, this time.', 'I don\'t know any more.'], 0);
        G.miraOpen = ['ask', 'fix', 'unsure'][i];
        if (i === 0) await convo(mira, [['kai', 'Ask you what you want.'], ['mira', F.m20done || miraAns === 'ask' ? 'You remembered. I told you to come to ask, and you actually did.' : 'That\'s the first time anyone has asked me that in this ring.']]);
        if (i === 1) await convo(mira, [['kai', 'Fix this. Properly, this time.'], ['mira', 'Every one of you said that. The machine has been fixed a thousand times. It\'s the wanting that\'s broken.']]);
        if (i === 2) await convo(mira, [['kai', 'I don\'t know any more.'], ['mira', 'Good. That\'s the most honest a Varen has been in this room.']]);
        // the bible quote
        await game.shot([-1.6, 1.7, -73.4], [0.4, 1.5, -76.2], 1.0, { fov: 36 });
        await game.say('kai', 'I thought the answer was to find the right world.');
        await ots(mira, kai);
        await game.say('mira', 'And now?');
        await ots(kai, mira);
        await game.say('kai', 'Now I think we kept asking the world to pay for our answer.');
        audio.silence?.(2.0);
        await game.wait(1.2);
        await convo(mira, [
          ['mira', 'Then stop asking it to pay. Put down what you carried here. Choose what to keep and what to let go.'],
          ['mira', 'Then the ring. There are three ways out of this second. None of them is free.'],
        ]);
        G.seen.miraIntro = true;
      });
      musicLock = null; S.phase = 'threads';
      game.checkpoint(0, 0, -70.5, PI);
    }
    const MTOP = [
      ['Calder Row', [['kai', 'Do you remember Calder Row? Skipping stones?'], ['mira', 'I remember three Calder Rows. In one of them you won. I let you think it was all of them.']]],
      ['The hall', [['kai', 'The hall. At eight fourteen. Did you let go?'], ['mira', 'I let go so you wouldn\'t follow. You followed anyway. For twenty-three years.']]],
      ['World 0907', [['kai', 'World 0907. The one where you lived and I didn\'t.'], ['mira', 'I built a machine to find you there. I understand him better than you\'d like.']]],
      ['Yourself', [['kai', 'What are you, Mira? Honestly.'], ['mira', 'A pattern that remembers being your sister. Would it be enough if I said that\'s a person?'], ['kai', 'It\'s enough.']]],
    ];
    act({ pos: () => mira.root.position, radius: 2.4, prompt: 'Talk to Mira', enabled: () => (S.phase === 'threads' || S.phase === 'choose') && !S.ending, onUse: () => side(async () => {
      const left = MTOP.filter(([k]) => !G.miraTopics.has(k));
      if (!left.length) { await story(async () => { await convo(mira, [['mira', S.phase === 'choose' ? 'The ring, Kai. I\'ll be here for whichever you choose.' : 'The table. Put them down one by one.']]); }); return; }
      const i = await choose('mira', 'Ask me something. We have a second. It\'s ours.', left.map(([k]) => k).concat(['Later']), 0);
      if (i >= left.length) return;
      G.miraTopics.add(left[i][0]);
      await story(async () => { await convo(mira, left[i][1]); });
    }) });
    // the threads table: preserve or release, one at a time
    act({ pos: [P.table[0], 1.2, P.table[2] + 1.0], radius: 2.4, prompt: 'Choose what to preserve and what to release', enabled: () => S.phase === 'threads', onUse: () => side(async () => {
      await story(async () => {
        await game.shot([0, 2.6, -64.6], [0, 1.0, -67.5], 1.2, { fov: 44 });
        for (const k of ['passengers', 'keepers', 'tomorrow', 'attempts']) {
          if (!G.threads.has(k) || G.keep[k] !== undefined) continue;
          const D = THREADS[k];
          const i = await choose('kai', `${D.name}.`, [`Preserve · ${D.keep}`, `Release · ${D.lose}`], 0);
          G.keep[k] = i === 0; const m = W.threadLights[D.n];
          if (m) { if (G.keep[k]) m.material.emissiveIntensity = 3.2; else { tween(1.4, e => { m.material.emissiveIntensity = 2.4 * (1 - e); }).then(() => { m.visible = false; }); } }
          audio.sfxPlay(G.keep[k] ? 'pickup' : 'rewind');
          const line = {
            passengers: G.keep[k] ? 'Keep them. They earned the second.' : 'Let them go home. They were always going home.',
            keepers: G.keep[k] ? 'Keep it. Somebody should remember the seventeen.' : 'Let it go. A story you\'re made to keep is a wall.',
            tomorrow: G.keep[k] ? 'Keep it. Sera\'s light stays on.' : 'Let 2196 have its own tomorrow. Not mine.',
            attempts: G.keep[k] ? 'Keep them. He shouldn\'t be forgotten for loving her.' : 'Let them go. He carried them long enough.',
          }[k];
          await game.say('kai', line);
        }
        const kept = Object.values(G.keep).filter(Boolean).length;
        await game.say('mira', kept === 4 ? 'You kept everything. That\'s very you.' : kept === 0 ? 'You let it all go. That\'s very me.' : 'Some kept, some released. That\'s what people do. Not machines.');
        await game.say('mira', 'Now the ring.');
      });
      S.phase = 'choose'; for (const m of Object.values(W.endMarks)) m.visible = true;
      ev('What Kai kept', Object.entries(G.keep).map(([k, v]) => `${THREADS[k].name}: ${v ? 'preserved' : 'released'}`).join('. ') + '.', 'The original Chronolith');
      game.checkpoint(0, 0, -74, PI);
    }) });
    // the three ways
    for (const k of ['A', 'B', 'C']) {
      const p = P.ends[k], E = ENDS[k];
      act({ pos: [p[0], 1.2, p[2] + (k === 'C' ? 1.4 : 0)], radius: 2.0, hold: 1.6, prompt: `${E.verb} · ${E.name}`, enabled: () => S.phase === 'choose' && !S.ending, onUse: () => side(async () => {
        let go = 0;
        await story(async () => {
          await game.say('m23band', E.desc);
          go = await choose('kai', `${E.name}. ${k === 'C' ? '(Recommended)' : ''}`.trim(), ['Do it.', 'Not yet.'], window.__m23pick && window.__m23pick !== k ? 1 : 0);
        });
        if (go !== 0) return;
        S.ending = true; G.end = k; S.phase = 'ending';
        await ending(k);
      }) });
    }
    hint(() => S.phase === 'threads', 80, () => ui.subtitle('mira', 'The table, Kai. Put them down.', 2600));
    hint(() => S.phase === 'choose', 100, () => ui.subtitle('mira', 'White to break it. Red to split it. The ring itself, to hold it. Take your time. We have a second.', 4000));

    // =================================================================================================================
    // ENDINGS · epilogues · credits · the clock
    // =================================================================================================================
    async function ending(k) {
      S.main = true; cine(true); musicLock = 'm23-final'; musicState.bloom = 0; musicState.end = k; music(1.4);
      // the choice, played out at the ring
      if (k === 'A') {
        await game.shot([-9.5, 2.2, -76.5], [0, 4, -84], 1.8, { fov: 46 });
        await game.say('mira', 'Then let it be quick. And let it be yours.');
        await game.say('kai', 'I\'m sorry.');
        await game.say('mira', 'Don\'t be. Tomorrow will be strange without me. Let it be strange.');
        audio.sfxPlay('boom'); game.shake = 0.08;
        await tween(2.8, (e) => { W.ring.userData.disc.material.uniforms.uPower.value = 0.5 * (1 - e); W.ring.rotation.z = e * 0.3; W.ring.position.y = P.ring[1] - e * 1.6; });
        game.shake = 0; ghost(mira, 0x9a7bff); await tween(2.0, e => { mira.root.position.y = e * 0.15; });
        mira.hiddenByStory = true; mira.root.visible = false;
      } else if (k === 'B') {
        await game.shot([9.5, 2.2, -76.5], [0, 4, -84], 1.8, { fov: 46 });
        await game.say('mira', 'You\'re keeping me. And every version of everyone else.');
        await game.say('kai', 'Every one of them gets a world. Nobody pays for anybody\'s answer.');
        await game.say('mira', 'They\'ll pay for the borders instead. You know that.');
        audio.sfxPlay('switch'); game.shake = 0.05;
        await tween(2.6, (e) => { W.ring.userData.frags.scale.setScalar(1 + e * 2.4); W.ring.userData.disc.material.uniforms.uColor.value.setRGB(1, 0.42 + e * 0.1, 0.29); });
        game.shake = 0;
      } else {
        await game.shot([2.2, 1.6, -74], [0, 1.8, -80.6], 1.6, { fov: 40 });
        await game.say('mira', 'Kai. No. That\'s not asking. That\'s deciding for me again.');
        await game.say('kai', 'Then I\'m asking. Let me hold it. All of it. The contradictions, the seconds, him, me.');
        await game.say('kai', 'You live. Somewhere I never was. That\'s what I want.');
        await game.say('mira', '...Would it be enough if I said yes?');
        await game.say('kai', 'It\'s enough.');
        pl.place(0, 0, -80.2, PI); kai.pose = null;
        await game.shot([0, 2.4, -74.6], [0, 3, -84], 2.2, { fov: 44 });
        audio.sfxPlay('motif');
        musicState.bloom = 1;
        await tween(3.0, (e) => { W.ring.userData.disc.material.uniforms.uPower.value = 0.5 + e * 0.9; kai.root.position.y = e * 0.3; });
        await tween(1.6, e => { kai.root.position.y = 0.3 + e * 0.2; W.ring.userData.inner.material.emissiveIntensity = 2.5 + e * 4; });
        kai.root.visible = false;
      }
      // flags
      const kept = G.keep;
      F.m23done = true; F.ending = k; F.endingName = ENDS[k].name; F.m23preserved = { ...kept }; F.m23quote = true; F.m23shards = G.shards; F.m23pages = G.pages.size;
      F.m23evidence = G.ev.size; F.m23talks = G.talks.size + G.miraTopics.size; F.m23hearthMisses = G.hearthMisses; F.m23holdFails = G.holdFails; F.m23plateFails = G.plateFails;
      F.m23witnessAnswer = G.witnessAnswer; F.m23miraOpen = G.miraOpen; F.miraSurvives = k !== 'A'; F.kaiExists = k !== 'C'; F.version = 118;
      await ui.fade(1, 2400);
      S.phase = 'ending';
      await epilogue(k);
      await credits();
      await postCredit();
      // completion
      const mins = Math.round((game.time - tStart) / 60);
      await ui.chapterCard('MISSION 23 COMPLETE', 'Afterzero', `${ENDS[k].name} · Threads ${G.threads.size}/4 · Pages ${G.pages.size}/4 · Shards ${G.shards}/6${mins ? ' · ' + mins + ' min' : ''}`, 4200);
      delete T.canSwitch; game.setResidue(false); game.releaseCam(); ui.letterbox(false); audio.allBeds?.(0); audio.setTheme(null);
      pl.char.root.visible = true; kai.pose = null;
      window.__m23 = null; S.main = false; S.busy = false; S.done = true;
    }

    async function epilogue(k) {
      // a new small scene for each ending
      game.control = false;
      const sc = game.newScene({ background: 0xc8d0d8, fog: [0xc8d0d8, 0.008], exposure: k === 'A' ? 1.25 : k === 'C' ? 1.12 : 1.0, bloom: 0.6, bloomThreshold: 0.85, envIntensity: 0.7, killY: -20 });
      game.onUpdate(dt => RZ.update(dt));
      T.configure([{ id: 'epi', key: '1', name: ENDS[k].name, year: k === 'C' ? 'A WORLD WITHOUT KAI' : 'AFTER ZERO', glyph: '◯', color: '#ffd27a' }], 'epi'); T.unlocked = false;
      ui.show('hud', false); ui.letterbox(true);
      const E = buildEpilogue(game, sc, k); game.onUpdate((dt, t) => E.update(dt, t));
      let env2 = null; try { env2 = RZ.skyEnvironment(renderer, sc, { preset: k === 'B' ? 'sunset' : k === 'C' ? 'golden-hour' : 'day', elevation: k === 'C' ? 16 : 30, azimuth: 80, cover: k === 'B' ? 0.6 : 0.3, apply: true }); } catch (err) { console.warn('m23 epi sky', err); }
      const h2 = new THREE.HemisphereLight(0xf0f4ff, 0x4a4640, k === 'B' ? 0.65 : 0.95); sc.add(h2);
      const s2 = new THREE.DirectionalLight(k === 'B' ? 0xff9a6a : 0xfff0d8, k === 'A' ? 3.0 : 2.4); s2.castShadow = true; s2.shadow.mapSize.set(low ? 512 : 1024, low ? 512 : 1024);
      Object.assign(s2.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 140 }); s2.position.set(30, 40, 20); s2.target.position.set(0, 0, -4); sc.add(s2, s2.target);
      if (env2) sc.environmentIntensity = 0.7;
      const beds = k === 'B' ? { wind: 0.06 } : { wind: 0.02, crowd: k === 'A' ? 0.04 : 0.01 }; audio.rain(0); audio.wind(beds.wind); audio.hum(0); audio.crowd?.(beds.crowd || 0);
      if (k === 'B') { sc.fog.color.set(0xb89078); }
      // passers-by
      const walkers = [];
      if (k !== 'B') PASSERS49.forEach((lk, i) => { const w = new Walker(game, { ...lk, seed: 2400 + i }, { x: i % 2 ? 7.6 : -7.6, y: 0.15, z0: -36, z1: 26, speed: 0.9 + (i % 3) * 0.2 }); walkers.push(w); });
      if (walkers.length) game.onUpdate(dt => walkers.forEach(w => w.update(dt)));
      const kept = G.keep, cap = async (text, ms = 4200) => { await ui.subtitle(null, text, auto ? 600 : ms); };
      // the consequences of what was kept
      const consequences = () => Object.entries(kept).map(([kk, v]) => (v ? THREADS[kk].keep : THREADS[kk].lose));
      if (k === 'A') {
        pl.place(7.75, 0.15, 8, -PI / 2); kai.pose = 'sit'; pl.char.root.visible = true;
        await game.shot([-2, 1.6, 14], [7.6, 1.1, 8.4], 0.01, { fov: 40 });
        await ui.fade(0, 2200);
        await ui.chapterCard('ENDING A', 'The Fixed World', 'Rain City · a morning that ends', 3800);
        await game.shot([-4, 7, -18], [0, 2, 6], 5, { fov: 50 });
        await cap('The clocks in Rain City ran to 08:15. Then 08:16. Nobody noticed but one man on a bench.');
        for (const c of consequences()) await cap(c, 3600);
        await game.shot([4.6, 1.5, 10.2], [7.6, 1.1, 8.0], 2.4, { fov: 34 });
        await cap('The seat beside him stayed empty. He let it.');
        musicState.bloom = 2;
        await game.shot([0, 18, 30], [0, 6, -30], 6, { fov: 56 });
        await game.say('kai', ENDS.A.quote);
      } else if (k === 'B') {
        pl.place(-0.8, 0, 2, 0); pl.char.root.visible = true; kai.pose = 'look';
        const m2 = game.actor('mira', null, 0.8, 0, 2.2, -0.2); m2.pose = 'look';
        await game.shot([0, 1.7, 9], [0, 1.6, 2], 0.01, { fov: 38 });
        await ui.fade(0, 2200);
        await ui.chapterCard('ENDING B', 'The Infinite War', 'Every tomorrow, side by side', 3800);
        await game.shot([-6, 9, 22], [0, 4, -20], 5, { fov: 52 });
        await cap('Every state got its own world. The seams between them became borders. The borders became fronts.');
        for (const c of consequences()) await cap(c, 3600);
        await game.shot([1.8, 1.6, 5.4], [0, 1.6, 2], 2.2, { fov: 36 });
        await game.say('mira', 'Which side is ours?');
        await game.say('kai', 'Both. Neither. This one, for now.');
        musicState.bloom = 1;
        await game.shot([0, 20, 34], [0, 6, -40], 6, { fov: 56 });
        await game.say('kai', ENDS.B.quote);
      } else {
        pl.place(0, 0, 25, PI); pl.char.root.visible = false;
        const m3 = game.actor('m23mira', null, 9.6, 0.5, -8, -PI / 2); m3.pose = null; S.byId.m23mira = m3;
        await game.shot([2.6, 1.55, -0.6], [9.4, 1.5, -8], 0.01, { fov: 44 });
        await ui.fade(0, 2600);
        await ui.chapterCard('ENDING C', 'Afterzero', 'Calder Row · a world where Kai was never born', 4000);
        await walkTo(m3, [[8.8, 0.15, -8], [7.2, 0.15, -6], [5.4, 0, -2]], 1.1);
        await cap('Mira Varen, thirty-three, walked to work the way she always did. She had never had a brother.');
        m3.pose = 'look'; await game.shot([3.2, 1.6, 1.6], [5.4, 1.55, -2], 1.8, { fov: 34 });
        audio.silence?.(1.6);
        await game.say('m23whisper', 'Live.');
        await game.wait(0.8);
        await cap('She stopped in the middle of the crossing, as if someone had said her name.');
        for (const c of consequences()) await cap(c, 3600);
        await game.say('m23mira', '...Okay.');
        m3.pose = null; walkTo(m3, [[2.4, 0, 6], [-1, 0, 20]], 1.1);
        musicState.bloom = 2;
        await game.shot([0, 16, 26], [0, 4, -16], 6.5, { fov: 56 });
        await game.say('m23kaivo', ENDS.C.quote);
      }
      audio.silence?.(2.5);
      await game.wait(1.0);
      await ui.fade(1, 2600);
    }

    async function credits() {
      musicLock = 'm23-final'; musicState.bloom = 2; audio.setTheme('m23-final', 1.0);
      const names = (id) => CAST[id]?.name || id.toUpperCase();
      const L = [
        ['h', 'AFTERZERO'], ['s', 'A temporal thriller in twenty-three missions'], ['g'],
        ['t', 'STARRING'], ...['kai', 'mira', 'witness', 'sera', 'rook', 'niko', 'tala', 'iven', 'hale', 'jun', 'brandt'].map(id => ['n', names(id)]), ['g'],
        ['t', 'AND'], ['n', 'Orren · Hensel · Dr. Anja Vale · Joss and Wren Harrow · Edie Lark'], ['n', 'Prefect Ima Adair · Dov Lasker · the keepers of the valley'], ['n', 'the people of Rain City, Lantern Hall and the Sable Yards'], ['g'],
        ['t', 'STORY AND GAMEPLAY BIBLE'], ['n', 'The AFTERZERO team'], ['g'],
        ['t', 'WORLD, PEOPLE, MUSIC AND VOICES'], ['n', 'Generated in code, every one of them'], ['n', 'Three.js · WebGL · Web Audio · Web Speech'], ['g'],
        ['t', 'VERSIONS OF THIS STORY TOLD BEFORE'], ['n', `${iters}`], ['g'],
        ['q', ENDS[G.end || 'C'].quote], ['g'], ['s', 'Thank you for playing.'],
      ];
      const css = { h: 'font:700 44px/1.2 Georgia,serif;letter-spacing:.3em;color:#f2ecdc', s: 'font:400 18px/1.6 Georgia,serif;color:#c8c0b0;font-style:italic', t: 'font:600 13px/2.4 "Atkinson Hyperlegible",Arial,sans-serif;letter-spacing:.35em;color:#9a8a70', n: 'font:400 20px/1.6 "Atkinson Hyperlegible",Arial,sans-serif;color:#ece4d0', q: 'font:400 22px/1.6 Georgia,serif;font-style:italic;color:#ffd8a0', g: 'height:48px' };
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:9000;overflow:hidden;background:#050505;pointer-events:none;';
      const roll = document.createElement('div');
      roll.style.cssText = 'position:absolute;left:0;right:0;top:100%;text-align:center;padding:0 16px;will-change:transform;';
      roll.innerHTML = L.map(([k2, t]) => `<div style='${css[k2]}'>${t ? String(t).replace(/</g, '&lt;') : ''}</div>`).join('');
      wrap.appendChild(roll); document.body.appendChild(wrap);
      await ui.fade(0, 400);
      const dur = auto ? 6 : 52, H = roll.offsetHeight + window.innerHeight;
      try {
        await tween(dur, (e, u) => { roll.style.transform = `translateY(${-u * H}px)`; });
      } finally { await ui.fade(1, 600); wrap.remove(); }
      audio.setTheme(null, 2.0); musicLock = null;
      await game.wait(1.5);
    }

    async function postCredit() {
      // the clock in the dark: no hands, then hands, then it ticks
      const sc = game.newScene({ background: 0x000000, fog: [0x000000, 0.02], exposure: 1.0, bloom: 0.4, bloomThreshold: 0.9, envIntensity: 0.2, killY: -50 });
      T.configure([{ id: 'pc', key: '1', name: '', year: '', glyph: '', color: '#000000' }], 'pc'); T.unlocked = false;
      game.collision.add([-6, -1, -6], [6, 0, 6]); pl.place(0, 0, 3, PI); pl.char.root.visible = false; ui.show('hud', false); ui.letterbox(true);
      const C = buildClockScene(sc); C.g.position.set(0, 1.6, -3);
      const l = new THREE.SpotLight(0xffe8c8, 30, 12, 0.5, 0.6); l.position.set(0.6, 4, 0); l.target = C.g; sc.add(l, new THREE.AmbientLight(0x202020, 0.4));
      await game.shot([0, 1.6, 0.8], [0, 1.6, -3], 0.01, { fov: 40 });
      await ui.fade(0, 2600);
      await game.wait(2.0);
      for (const h of [C.hH, C.hM, C.hS]) h.visible = true;
      C.hH.rotation.z = -(8 + 14 / 60) / 12 * PI * 2; C.hM.rotation.z = -14 / 60 * PI * 2; C.hS.rotation.z = -9 / 60 * PI * 2;
      audio.setTheme('m23-clock', 0.2);
      await game.wait(0.6);
      for (let s = 10; s < 16; s++) { C.hS.rotation.z = -s / 60 * PI * 2; audio.sfxPlay('clock'); await game.wait(1.0); }
      await game.say('m23voice', 'Version one hundred and eighteen.');
      for (let s = 16; s < 19; s++) { C.hS.rotation.z = -s / 60 * PI * 2; audio.sfxPlay('clock'); await game.wait(1.0); }
      audio.setTheme(null, 1.0);
      await ui.fade(1, 2000);
    }

    // =================================================================================================================
    // Objectives
    // =================================================================================================================
    S.refresh = () => {
      if (S.phase === 'explore') {
        const left = [['passengers', 'the opening streets'], ['keepers', 'the settlement (west)'], ['tomorrow', 'the future city (east)']].filter(([k]) => !G.threads.has(k)).map(x => x[1]);
        if (S.zone === 'avenue' && !G.threads.has('passengers')) objective(pl.pos.z > 23 ? 'Get past Checkpoint C: switch the street between 2026, 2049 and 2196' : 'Find the thread of the 08:14 (the stalled tram, in 2049)');
        else if (S.zone === 'settle' && !G.threads.has('keepers')) objective(G.stones ? 'Cross the stream to the keepers\' shrine' : 'Light the three hearths in the old order (the mural knows it)');
        else if (S.zone === 'future' && !G.threads.has('tomorrow')) objective(G.talks.has('sera0') ? 'Hold the beacon\'s coil while Sera seats it' : 'Cross the skybridge to Lantern Hall\'s roof');
        else if (!G.seen.plazaIntro) objective('Cross the opening streets to the Confluence');
        else objective(left.length ? `Bring a thread from each place: ${left.join(' · ')}` : 'Touch the fracture wall at the Confluence');
      } else if (S.phase === 'toMira') objective('Through the last door: reach Mira at the original Chronolith');
      else if (S.phase === 'threads') objective('At the table: choose what to preserve and what to release');
      else if (S.phase === 'choose') objective('Choose: break the ring · split the states · step into the ring');
      else if (S.phase === 'seam') objective('Cross the seam on the rising stones');
    };
    let oT = 0; game.onUpdate(dt => { oT -= dt; if (oT <= 0) { oT = 1; if (S.phase !== 'hold1' && S.phase !== 'plate') refresh(); } });

    // arrivals (first time)
    game.onUpdate(() => {
      if (S.busy || !game.control || game.cine || S.main) return;
      if (S.phase === 'explore') {
        if (S.zone === 'avenue' && !G.seen.avIntro) { G.seen.avIntro = true; side(avenueIntro); }
        else if (S.zone === 'plaza' && !G.seen.plazaIntro) { G.seen.plazaIntro = true; side(plazaIntro); }
        else if (S.zone === 'settle' && !G.seen.setIntro) { G.seen.setIntro = true; side(async () => { await settleIntro(); G.seen.setIntroDone = true; }); }
        else if (S.zone === 'future' && !G.seen.fuIntro) { G.seen.fuIntro = true; side(futureIntro); }
        else if (S.zone === 'plaza' && G.threads.size >= 3 && !G.seen.wallHint && G.seen.plazaIntro) { G.seen.wallHint = true; ui.subtitle('witness', 'Three seals. Touch the wall, Kai.', 2600); }
      } else if (S.phase === 'toMira' && S.zone === 'chron' && !G.seen.chron) { G.seen.chron = true; side(chronIntro); }
    });
    // the Witness waits at the Confluence (a visible walk from the hall while Kai explores)
    window.__m23.X = { W, witness, mira, sera, get holdT() { return holdT; }, set holdT(v) { holdT = v; }, plats: W.plats, setZone };

    // =================================================================================================================
    // RUN
    // =================================================================================================================
    await ui.fade(1, 10);
    S.main = true; cine(true);
    T.configure(ZDEF.hall()[0], 'hall'); T.unlocked = false; applyLook();
    pl.place(...P.start); kai.root.rotation.y = PI;
    await game.wait(1.0);
    refreshVis();
    await game.shot([34, 52, 104], [0, 2, -24], 0.01, { fov: 54 });
    await ui.fade(0, 2400);
    lockMusic('m23-confluence', 1.0);
    const card = ui.chapterCard('FINALE', 'Afterzero', 'Choose what to preserve', 4600);
    await game.shot([12, 30, 86], [0, 4, -40], 7.0, { fov: 52 });
    await card;
    await game.shot([-8, 9, 30], [0, 4, -78], 3.2, { fov: 50 });
    await game.say('m23band', 'Oh eight fourteen and ten seconds. Elapsed: one second. Every state reporting at once.');
    await game.shot([0, 30, -40], [0, 3, -82], 3.0, { fov: 48 });
    await game.say('kai', 'The ring. Out past all of it. And someone standing in front of it.');
    await convo(witness, [
      ['witness', 'She\'s at the first ring. The one the keepers found, and Helix found again. Every place between here and there is one I broke.'],
      ['kai', 'Then we walk through them.'],
      ['witness', 'They\'ll want something back, Kai. Every one of them is holding a second.'],
      ['kai', together ? 'We started this together. We\'ll finish it together.' : 'Then I\'ll give them something back.'],
      ['witness', 'I\'ll go ahead. I know the short way. I always did. Meet me where the places meet.'],
    ]);
    walkTo(witness, [[1.5, 0, 55], [1.5, 0, 50]], 1.3).then(() => { witness.root.position.set(...P.witnessPlaza); witness.root.rotation.y = PI * 0.95; witness.pose = 'look'; });
    S.main = false; cine(false); musicLock = null;
    S.phase = 'explore'; game.checkpoint(...P.start); refresh();
    hint(() => S.phase === 'explore' && S.zone === 'hall', 50, () => ui.subtitle('kai', 'North. Across the bridge, into the street.', 2600));
    void TEX;

    await game.waitFor(() => S.done);
  },
};
