// MISSION 22 · THE FIRST SECOND (Act IV) — combine all major skills in the final causal puzzle.
// Bible beats: infer a causal chain from the ancient village · read a repeating pattern learned in the clockmaker's house
// · use inversion knowledge from the hospital · distinguish reliable evidence from subjective memory · open the
// Chronolith's final chamber. Quote: "You were trying to stop me from becoming you." / "I was trying to find a version
// of me that didn't have to." Ending: the Witness's attempts to prevent the Zero Second helped cause it.
// The Witness began the final experiment (M21) and Kai went in with him: they stand in Test Hall Zero at 08:14:09 on
// 19.10.2026, the first second, which nobody has ever let start. Every place where the Witness tried to stop it leans
// into the hall: the valley where he buried the core (states c. 1000 BCE / 400 CE / 2049), Hensel's lane on the
// morning he warned the clockmaker (a local loop of drop hammers that rest on the ninth count, a shop whose clocks skip
// the ninth), Halden's Ward 4 (reversed: Inversion traces his call back to the ring). Back in the hall Kai sorts what
// people remember from what the room kept (holders: Kai, the Witness, the record) and finds the fourth link: the hand
// that pulled the boy back was the Witness's own. The four links open the iris to the final chamber; set in the order
// the second felt them and in the order he made them, they close into a loop with no first cause.
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { Inversion } from '../systems/inversion.js';
import { LocalLoop } from '../systems/loops.js';
import {
  registerM22Cast, registerM22Themes, musicState, buildWorld, st, HUB_S, VIL_S, P, V, C, H, N, TEX, KEEPERS, COMMUTERS49, VISITORS26, CHILD_LOOK, pictureMat,
} from '../world/env_m22.js';

const PI = Math.PI;
const LINKS = {
  burial: { n: 0, title: 'THE BURIAL', sub: 'He hid the core; the seal kept it whole for Helix', when: 'c. 1000 BCE', attempt: '0212', at: 1 },
  warning: { n: 1, title: 'THE WARNING', sub: 'He told Hensel to turn them away; they went to the hall early', when: '07:52', attempt: '0001', at: 0 },
  call: { n: 2, title: 'THE CALL', sub: 'His call home through Halden is the song the ring sang', when: '08:14:02', attempt: '1046', at: 3 },
  hand: { n: 3, title: 'THE HAND', sub: 'He opened the rope and pulled the boy back; she went alone', when: '08:14:09', attempt: '0730', at: 2 },
};
const ORDER_SECOND = ['burial', 'warning', 'call', 'hand'];
const ORDER_MADE = ['warning', 'burial', 'hand', 'call'];
const CLAIMS = [
  { id: 'rope', who: 'Kai and the Witness', text: '"The rope was closed. She climbed over it."', verdict: 'memory', spot: 'rope',
    why: 'The record has the hook open on the floor and the rope down. Nobody climbed. Someone opened it.' },
  { id: 'cuff', who: 'Kai', text: '"I held on to her. My cuff tore."', verdict: 'record', spot: 'cuff',
    why: 'A thread of blue cuff on the post at a seven-year-old\'s hand height. He held on.' },
  { id: 'hand', who: 'The Witness', text: '"Someone pulled me back. A man\'s hand."', verdict: 'record', spot: 'prints',
    why: 'A third set of prints behind the boy: a man\'s heavy boots, worn, a sole nobody made in 2026.' },
  { id: 'song', who: 'Mira (as she told it)', text: '"The ring sang. She went to it."', verdict: 'record', spot: 'console',
    why: 'Rook\'s console logged it: unscheduled audio input at 08:14:02, three tones, source the field.' },
  { id: 'rook', who: 'Kai and the Witness', text: '"Rook started it early, before the warning."', verdict: 'memory', spot: 'console',
    why: 'RUN 01 started on schedule at 08:14:00. At 08:14:09 the log shows an operator override: K. Varen.' },
];

export default {
  id: 'm22', act: 'ACT IV · THE UNWRITTEN SECOND', title: 'The First Second', sub: 'The original activation',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM22Cast(); registerM22Themes();
    ui.missionTag('MISSION 22 · THE FIRST SECOND'); ui.show('hud', true);
    const kai = pl.char;
    const portraits = (ids) => { try { const need = ids.filter(id => !ui.portraits[id] && CAST[id]?.look); if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]])))); } catch (err) { console.warn('m22 portraits', err); } };
    portraits(['witness', 'm22mira10', 'm22kai7', 'm22mother', 'm22rook', 'orren', 'oskar26', 'm22keeper']);
    // what earlier missions left
    const iters = F.witnessIterations || 1046, metOrren = !!F.metOrren, childHome = F.m19child === 'home', m5done = !!(F.m5complete || F.villageCausalChain);
    const sawHensel = !!(F.metHensel || F.m6done), sawHalden = !!(F.m11done || F.m11miraFile), miraAns = F.m20answer, trusted = F.trustedHale;

    // ---------- state ----------
    const G = {
      links: new Set(), shards: 0, shardsTaken: new Set(), ev: new Set(), pages: new Set(), seen: {},
      vTokens: new Set(), vMisses: 0, chainDone: false,
      gateResets: 0, gatesPassed: 0, drawer: false, letter: false, ledger: false, shopMisses: 0, drawerMisses: 0, hensel: false,
      relayFails: 0, latched: 0, hazardHits: 0, bay: false, traced: false,
      examined: new Set(), sorted: new Set(), sortMisses: 0, whoMisses: 0, evidenceOpen: false,
      irisA: false, irisB: false, irisMisses: 0, together: null, orren: new Set(), wtalks: new Set(), child: childHome ? 'home' : 'none', pa: false, falls: 0,
    };
    let S = { phase: 'intro', obj: '', busy: false, main: false, zone: 'hub', hubState: 'kai', vilState: 'v2049', byId: {} };
    const small = new Set();
    window.__m22 = { G, get S() { return S; }, P, V, C, H, N, LINKS, X: {} };

    // ---------- helpers ----------
    const once = (k) => { if (G.seen[k]) return false; G.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag) => { if (G.ev.has(title)) return; G.ev.add(title); ui.addEvidence(title, text, tag); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const choose = (id, text, opts, correct = 0) => { if (game.autoplay) game.autoChoice = game.autoQueue?.length ? game.autoQueue.shift() : correct; return game.choice(id, text, opts); };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive || S.busy) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u), u); if (u >= 1) { off(); res(); } }); });
    const refresh = () => S.refresh?.();
    const side = async (fn) => {
      if (S.busy || !game.control || game._failing) return; S.busy = true;
      try { await fn(); } catch (err) { if (err?.name === 'Abort' || err?.abort || String(err).includes('Abort')) throw err; console.warn('m22 side', err); } finally { S.busy = false; if (!S.main) { game.control = true; ui.letterbox(false); game.releaseCam(); } refresh(); }
    };
    const act = (o) => {
      const it = game.interact({ radius: 1.8, ...o, once: false, onUse: (x) => { if (S.busy || game._failing) return; if (o.enabled && !o.enabled()) return; if (o.states && !o.states.includes(T.current)) return; o.onUse(x); } });
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
      const sd = 0.7 + Math.max(0, 2.2 - d) * 0.45, back = 1.35, sy = small.has(speaker) ? 1.05 : 1.56, ly = l.y + (small.has(listener) ? 1.15 : 1.64);
      return game.shot([l.x - ux * back + uz * sd, ly, l.z - uz * back - ux * sd], [sp.x, sp.y + sy, sp.z], dur, { fov });
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
      let i = 0;
      const off = game.onUpdate(dt => {
        const p = ch.root.position, t = path[i]; if (!t) { off(); res(); return; }
        const dx = t[0] - p.x, dz = t[2] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { i++; if (i >= path.length) { ch.speed = 0; off(); res(); } return; }
        const s = Math.min(d, speed * dt); p.x += dx / d * s; p.z += dz / d * s; p.y += (t[1] - p.y) * Math.min(1, dt * 5);
        let dy = Math.atan2(dx, dz) - ch.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.root.rotation.y += dy * Math.min(1, dt * 8); ch.speed = speed;
      });
    });
    const closeUp = async (p, lines, dist = 1.2, fov = 36, up = 0.7) => {
      const dx = pl.pos.x - p[0], dz = pl.pos.z - p[2], d = Math.hypot(dx, dz) || 1;
      await game.shot([p[0] + dx / d * dist, p[1] + up, p[2] + dz / d * dist], [p[0], p[1], p[2]], 1.0, { fov });
      for (const [id, line] of lines) await game.say(id, line);
    };
    const actor = async (id, x, y, z, ry, kid) => { const ch = game.actor(id, null, x, y, z, ry); S.byId[id] = ch; if (kid) small.add(ch); await tick(); return ch; };
    const holderVis = (ch, states) => { ch.root.userData.states = states; T.objects.push(ch.root); ch.root.visible = states.includes(T.current); };
    const freezeLater = (ch) => { let t = 0; const off = game.onUpdate(dt => { t += dt; if (t > 1.4) { ch.frozen = true; off(); } }); };
    const freeze = (ch, pose) => { ch.pose = pose; freezeLater(ch); };
    const shard = (where, mesh, states, total = 6) => act({ pos: [mesh.position.x, mesh.position.y + 0.2, mesh.position.z], radius: 1.7, prompt: 'Take the temporal shard', states,
      enabled: () => !G.shardsTaken.has(where), onUse: () => {
        G.shardsTaken.add(where); mesh.visible = false; T.objects = T.objects.filter(o => o !== mesh); mesh.userData.states = ['none'];
        G.shards++; F.shards = (F.shards || 0) + 1; audio.sfxPlay('pickup'); ui.toast(`TEMPORAL SHARD ${G.shards}/${total} · ${where.toUpperCase()}`, 2400);
      } });
    const page = (n, mesh, where, states) => act({ pos: [mesh.position.x, mesh.position.y + 0.3, mesh.position.z], radius: 1.8, prompt: 'Read the Witness\'s page', states,
      enabled: () => !G.pages.has(n) && (n !== 2 || G.links.size >= 3), onUse: () => side(async () => {
        G.pages.add(n); mesh.visible = false; T.objects = T.objects.filter(o => o !== mesh); mesh.userData.states = ['none'];
        S.main = true; cine(true);
        const text = [['ATTEMPT 0001', 'Wrote to the clockmaker. If they never reach the hall, there is no hall. They reached the hall. Earlier than before.'],
          ['ATTEMPT 0212', 'Took the core back three thousand years and had the keepers wall it in. Nobody digs in a valley that floods. Helix dug in 2031.'],
          ['ATTEMPT 0730', 'Went into the hall myself. Pulled the boy back from the ring. He let go of her hand. She went alone. That is my first memory.'],
          ['ATTEMPT 1045', 'Calling her pattern home through Halden. Three notes. She always came to that tune. Tomorrow: attempt 1046. The last one.']][n];
        ev('The Witness\'s page · ' + text[0], text[1], 'Witness · ' + where);
        await closeUp([mesh.position.x, mesh.position.y, mesh.position.z], [['kai', ['His handwriting. Mine. "If they never reach the hall, there is no hall."', '"Nobody digs in a valley that floods." Helix did.', '"He let go of her hand." He writes it like it happened to someone else.', '"Tomorrow: the last one." He\'s written that before.'][n]]], 1.0, 34, 0.6);
        audio.sfxPlay('pickup'); ui.toast(`THE WITNESS'S PAGES ${G.pages.size}/4`, 2200);
        S.main = false; cine(false);
      }) });
    const chapterTitle = (num, title, sub) => ui.chapterCard(`THE FIRST SECOND · ${num}`, title, sub, 3600);

    // ---------- scene ----------
    const scene = game.newScene({ background: 0xd8b890, fog: [0xd8b890, 0.011], exposure: 1.0, bloom: 0.7, bloomThreshold: 0.82, envIntensity: 0.6, killY: -26, residue: true });
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    game.onUpdate(dt => RZ.update(dt));
    T.configure(HUB_S.map((id, i) => ({ id, key: String(i + 1), name: ['AS KAI REMEMBERS', 'AS THE WITNESS REMEMBERS', 'THE RECORD'][i], year: '08:14:09', glyph: ['◐', '◑', '◎'][i], color: ['#5fe6ff', '#ff8a6a', '#b6ff8a'][i] })), 'kai');
    T.unlocked = false;
    const W = buildWorld(game, scene, T);
    game.onUpdate((dt, t) => W.update(dt, t));
    await tick();

    // ---------- light: one sun (the shadow caster), a hemisphere, three nearest practicals; a look per state ----------
    const Q = RZ.getQuality(), low = Q === 'low';
    let env = null; try { env = RZ.skyEnvironment(renderer, scene, { preset: 'golden-hour', elevation: 6, azimuth: 70, cover: 0.45, turbidity: 3.4, apply: false }); } catch (err) { console.warn('m22 sky', err); }
    const hemi = new THREE.HemisphereLight(0xffe8c8, 0x3a3028, 0.55); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd0a0, 2.0); sun.castShadow = true;
    sun.shadow.mapSize.set(Q === 'high' ? 2048 : low ? 512 : 1024, Q === 'high' ? 2048 : low ? 512 : 1024);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 170 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    const sunDir = new THREE.Vector3(0.6, 0.35, -0.7).normalize();
    const LOOK = {
      kai: { fog: [0xd8b48a, 0.0105], env: 0.65, hemi: [0xffe8c8, 0x3a3028, 0.55], sun: [0xffcf9a, 2.1], dir: [0.6, 0.32, -0.7], exp: 1.0, beds: { wind: 0.03 } },
      witness: { fog: [0xc88a64, 0.012], env: 0.55, hemi: [0xffc8a0, 0x3a2420, 0.5], sun: [0xff9a68, 1.9], dir: [0.6, 0.22, -0.7], exp: 0.95, beds: { wind: 0.04, hum: 0.02, hz: 44 } },
      record: { fog: [0xa8b2b8, 0.0105], env: 0.5, hemi: [0xdce6ee, 0x2a3034, 0.6], sun: [0xe8f0ff, 1.4], dir: [0.5, 0.5, -0.6], exp: 1.02, beds: { hum: 0.03, hz: 60 } },
      bce: { fog: [0xc89060, 0.012], env: 0.55, hemi: [0xffc890, 0x3a2a1a, 0.5], sun: [0xff9a50, 1.8], dir: [-0.3, 0.2, -0.9], exp: 1.0, beds: { wind: 0.04, water: 0.04 } },
      ce400: { fog: [0x98a29a, 0.013], env: 0.5, hemi: [0xc8d0c8, 0x2a2c24, 0.65], sun: [0xd8e0dc, 1.0], dir: [0.4, 0.6, -0.5], exp: 1.05, beds: { wind: 0.06 } },
      v2049: { fog: [0x8a98a4, 0.012], env: 0.55, hemi: [0xc8d4de, 0x2a3034, 0.6], sun: [0xdce6f0, 1.2], dir: [0.5, 0.5, -0.5], exp: 1.0, beds: { wind: 0.05, water: 0.06 } },
      clock: { fog: [0xc8c0b0, 0.011], env: 0.6, hemi: [0xffefd8, 0x3a342c, 0.6], sun: [0xffe2b8, 2.0], dir: [-0.7, 0.35, 0.3], exp: 1.0, beds: { wind: 0.02, crowd: 0.02 } },
      ward: { fog: [0x16202c, 0.02], env: 0.25, hemi: [0x8aa0c0, 0x101418, 0.35], sun: [0x8aa0c0, 0.25], dir: [0.2, 0.8, 0.3], exp: 1.2, bg: 0x101820, beds: { hum: 0.05, hz: 50 } },
      station: { fog: [0x6a7480, 0.013], env: 0.5, hemi: [0xb8c8d8, 0x20242a, 0.55], sun: [0xb8c8d8, 0.8], dir: [0.3, 0.6, 0.5], exp: 1.05, beds: { rain: 0.03, wind: 0.03 } },
      chamber: { fog: [0x1a100a, 0.022], env: 0.35, hemi: [0xb08a6a, 0x1a120c, 0.55], sun: [0xffb070, 0.2], dir: [0.1, 0.9, 0.1], exp: 1.25, bg: 0x0c0806, beds: { hum: 0.05, hz: 40 } },
      free: { fog: [0xe8c8a0, 0.009], env: 0.7, hemi: [0xfff0d8, 0x3a3028, 0.6], sun: [0xffe0b0, 2.4], dir: [0.6, 0.4, -0.7], exp: 1.05, beds: { wind: 0.03 } },
    };
    let lookKey = null, lightT = 0;
    const applyLook = () => {
      const e = T.current, L = LOOK[e] || LOOK.kai; lookKey = e;
      scene.fog.color.set(L.fog[0]); scene.fog.density = L.fog[1];
      if (env) { scene.environment = env.envMap; scene.environmentIntensity = L.env; scene.background = L.bg ? new THREE.Color(L.bg) : (env.background || new THREE.Color(L.fog[0])); } else scene.background = new THREE.Color(L.bg || L.fog[0]);
      hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
      sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; sunDir.set(...L.dir).normalize();
      renderer.toneMappingExposure = L.exp;
      const b = L.beds || {}; audio.rain(b.rain || 0); audio.wind(b.wind || 0); audio.hum(b.hum || 0, b.hz || 52); audio.water?.(b.water || 0); audio.crowd?.(b.crowd || 0);
      lightT = 0;
    };
    const rigLights = () => {
      const p = game.cine ? game.engine.camera.position : pl.pos, e = T.current;
      const list = W.lightSrc.filter(s => !s.states || s.states.includes(e)).map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      pts.forEach((l, i) => { const s = list[i]; if (!s || s.dd > 45 * 45) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
    };
    game.onUpdate(dt => {
      const p = game.cine ? game.engine.camera.position : pl.pos;
      sun.target.position.set(p.x, p.y, p.z); sun.position.set(p.x + sunDir.x * 70, p.y + sunDir.y * 70 + 4, p.z + sunDir.z * 70);
      lightT -= dt; if (lightT <= 0) { lightT = 0.4; rigLights(); if (T.current !== lookKey) applyLook(); }
    });
    T.onSwitch(() => applyLook());
    applyLook();

    // ---------- music ----------
    let curTheme = null, musicLock = null;
    const themeFor = () => {
      if (musicLock) return musicLock;
      if (S.zone === 'village') return 'm22-village';
      if (S.zone === 'clock') return 'm22-clock';
      if (S.zone === 'ward') return 'm22-ward';
      if (S.zone === 'chamber') return 'm22-chamber';
      if (S.zone === 'station') return 'm22-second';
      return G.evidenceOpen && !G.links.has('hand') ? 'm22-evidence' : 'm22-second';
    };
    const music = (fade = 1.6) => { const th = themeFor(); for (const d of T.defs) d.theme = th; if (th !== curTheme) { curTheme = th; audio.setTheme(th, fade); } };
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    let mT = 0; game.onUpdate(dt => { mT -= dt; if (mT <= 0) { mT = 0.5; musicState.links = G.links.size; music(); } });

    // ---------- zones: each island has its own states; the hall's holders are kept while Kai is away ----------
    const zoneAt = (p) => {
      if (p.y < -0.9 && p.z < -12.4 && Math.abs(p.x) < 10.5 && p.z > -47.5) return 'chamber';
      if (p.x < -45.2) return 'village';
      if (p.x > 45.2) return 'clock';
      if (p.z > 45.6) return 'ward';
      if (p.z < -49) return 'station';
      return 'hub';
    };
    const ZDEF = {
      hub: () => [HUB_S.map((id, i) => ({ id, key: String(i + 1), name: ['AS KAI REMEMBERS', 'AS THE WITNESS REMEMBERS', 'THE RECORD'][i], year: '08:14:09', glyph: ['◐', '◑', '◎'][i], color: ['#5fe6ff', '#ff8a6a', '#b6ff8a'][i] })), S.hubState, G.evidenceOpen],
      village: () => [VIL_S.map((id, i) => ({ id, key: String(i + 1), name: ['THE VALLEY', 'THE VALLEY', 'RESERVOIR 7'][i], year: ['c. 1000 BCE', 'c. 400 CE', '2049'][i], glyph: ['☼', '◔', '≈'][i], color: ['#ffc070', '#c8d0b0', '#9fd8ff'][i] })), S.vilState, !!G.seen.vIntroDone],
      clock: () => [[{ id: 'clock', key: '1', name: 'HENSEL\'S LANE', year: '19.10.2026 · 07:52', glyph: '◷', color: '#ffd8a0' }], 'clock', false],
      ward: () => [[{ id: 'ward', key: '1', name: 'HALDEN · WARD 4', year: 'REVERSED', glyph: '◁', color: '#a8d8ff' }], 'ward', false],
      station: () => [[{ id: 'station', key: '1', name: 'CENTRAL STATION', year: '08:14 · 2049', glyph: '◫', color: '#ffd34a' }], 'station', false],
      chamber: () => [[{ id: 'chamber', key: '1', name: 'THE FINAL CHAMBER', year: '08:14:09', glyph: '◯', color: '#ffb070' }], 'chamber', false],
    };
    const setZone = (z) => {
      if (S.zone === 'hub' && HUB_S.includes(T.current)) S.hubState = T.current;
      if (S.zone === 'village' && VIL_S.includes(T.current)) S.vilState = T.current;
      S.zone = z;
      const [defs, initial, unlocked] = ZDEF[z]();
      T.configure(defs, initial); T.unlocked = unlocked; T.refreshHud(); applyLook(); refreshVis(); music(1.2);
      if (game.residueOn && z !== 'village' && z !== 'ward' && z !== 'hub') game.setResidue(false);
    };
    let zT = 0;
    game.onUpdate(dt => {
      zT -= dt; if (zT > 0) return; zT = 0.25;
      if (game.cine || T.switching || game._failing) return;
      const z = zoneAt(pl.pos); if (z !== S.zone) setZone(z);
    });
    // islands far away draw less: whole islands hide beyond 95 m; their people hide beyond 55 m
    const ISL = { village: [V.cx, 0], clock: [62, 0], ward: [0, 62], station: [-10, -61], hub: [0, -4] };
    const people = { village: [], clock: [], ward: [], station: [], hub: [] };
    const refreshVis = () => {
      const cam = game.cine ? game.engine.camera.position : pl.pos;
      for (const [k, [x, z]] of Object.entries(ISL)) {
        const d = Math.hypot(cam.x - x, cam.z - z), I = W.islands[k];
        if (I?.root && !S.merging) I.root.visible = d < 95;
        for (const ch of people[k]) { if (ch.hiddenByStory) { ch.root.visible = false; continue; } const sOk = !ch.root.userData.states || ch.root.userData.states.includes(T.current); ch.root.visible = (k === 'hub' ? d < 42 : d < 55) && sOk; }
      }
    };
    let vT = 0; game.onUpdate(dt => { vT -= dt; if (vT <= 0) { vT = 0.5; refreshVis(); } });

    // ---------- switching rules: never into something solid, never onto nothing, never under the reservoir ----------
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
      if (S.zone === 'village' && id === 'v2049' && pl.pos.y < -1.3 && pl.pos.x < -60.4) { if (once('wet' + Math.floor(game.time / 4))) { ui.toast('IN 2049 THIS IS THE BOTTOM OF THE RESERVOIR · CLIMB TO THE TERRACE FIRST', 2600); audio.sfxPlay('fail'); } return false; }
      const s = solidAt(id);
      if (s) { if (once('solid' + id + Math.floor(game.time / 3))) { ui.toast(s === 'solid' ? 'SOMETHING STANDS HERE IN THAT STATE · MOVE' : 'NOTHING TO STAND ON THERE', 2000); audio.sfxPlay('fail'); } return false; }
      return true;
    };
    // the reservoir: walking off the pontoon in 2049 puts Kai back on it
    game.onUpdate(() => {
      if (S.zone !== 'village' || T.current !== 'v2049' || game.cine || game._failing || S.busy) return;
      if (pl.pos.y < -1.3 && pl.pos.x < -60.4) { G.falls++; side(async () => { await ui.fade(1, 300); pl.place(-61.6, -0.55, 0, -PI / 2); await ui.fade(0, 400); ui.subtitle('kai', 'Deep water. Twenty-forty-nine has a lake here. Stay on the pontoon.', 2600); }); }
    });

    // =================================================================================================================
    // THE HALL: the frozen tableau, the Witness, Orren
    // =================================================================================================================
    const kidMira = await actor('m22mira10', ...P.kidMira, PI, true); freeze(kidMira, 'look'); holderVis(kidMira, st('kai', 'witness'));
    const kidKai = await actor('m22kai7', ...P.kidKai, PI * 0.96, true); freeze(kidKai, 'look'); holderVis(kidKai, st('kai', 'witness'));
    const mother = await actor('m22mother', ...P.mother, PI * 0.92); freeze(mother, 'look'); holderVis(mother, st('kai'));
    const rook = await actor('m22rook', ...P.rook, PI * 0.55); freeze(rook, 'work'); holderVis(rook, st('kai', 'witness'));
    people.hub.push(kidMira, kidKai, mother, rook);
    for (let i = 0; i < P.visitors.length; i++) {
      const [x, z, ry] = P.visitors[i];
      const c = game.ambient({ ...VISITORS26[i % VISITORS26.length], seed: 2240 + i }, x, 0, z, PI + ry); c.pose = 'look'; freezeLater(c);
      holderVis(c, st('kai')); people.hub.push(c);
    }
    const ghost = game.ambient({ ...CAST.witness.look, era: '2049', costume: 'witness', lod: true }, P.ghost[0], 0, P.ghost[2], PI * 0.9);
    try { ghost.setGhost(0xff8a6a); } catch (err) { void err; }
    ghost.pose = 'look'; freezeLater(ghost); holderVis(ghost, ['witness']); people.hub.push(ghost);
    const witness = await actor('witness', ...P.witness, PI * 0.8);
    const orren = await actor('orren', ...P.orren, PI); orren.pose = 'sit';
    for (const c of [kidMira, kidKai, mother, rook, witness, orren]) c.noCollide = false;

    // the four links light their threads on the ring
    const linkThread = (k, on = true) => { const m = W.threads[LINKS[k].n]; if (m) tween(1.6, (u) => { m.material.opacity = (on ? u : 1 - u) * 0.75; }); };
    const addLink = async (k) => {
      if (G.links.has(k)) return; G.links.add(k); F['m22link_' + k] = true;
      const L = LINKS[k]; linkThread(k);
      ev('Link ' + ['I', 'II', 'III', 'IV'][L.n] + ' · ' + L.title, `${L.sub}. ${L.when}. The Witness's attempt ${L.attempt}.`, 'The first second · causal chain');
      audio.sfxPlay('success'); ui.toast(`CAUSAL LINK ${G.links.size}/4 · ${L.title}`, 3000);
      musicState.links = G.links.size;
    };

    // Orren: an optional guide (bible: fears being erased by a final choice)
    const ORREN = [
      ['Who are you here?', [['orren', metOrren ? 'The same as on the avenue. Company for the roads. They come here at the end, you know. All of them.' : 'Orren. I keep the roads company. Most of them end up here, in this second.'], ['kai', 'You\'re not frozen.'], ['orren', 'Nothing that was never written down can be stopped. That\'s the one advantage of not existing.']]],
      ['What happens when it starts?', [['kai', 'If the second starts. What happens to this place?'], ['orren', 'Somebody chooses. Choosing is tidy. It puts things where they belong.'], ['orren', 'Things like me don\'t belong anywhere. I\'d rather you were untidy.']]],
      ['Why won\'t he look at the places?', [['kai', 'He won\'t go out there. Not once.'], ['orren', 'He knows what they say. He\'s been hoping they\'d say something else if he didn\'t listen.'], ['orren', 'Don\'t follow the footsteps. Follow what they refuse to step on.']]],
    ];
    act({ pos: [P.orren[0], 1.0, P.orren[2]], radius: 2.2, prompt: 'Talk to Orren', enabled: () => S.phase !== 'intro' && G.orren.size < ORREN.length && S.zone === 'hub', onUse: () => side(async () => {
      S.main = true; cine(true); orren.pose = null;
      const avail = ORREN.filter(t => !G.orren.has(t[0]));
      const i = await choose('kai', 'Ask Orren', [...avail.map(t => t[0]), 'Not now.'], 0);
      if (i < avail.length) { G.orren.add(avail[i][0]); await convo(orren, avail[i][1]); }
      orren.pose = 'sit'; S.main = false; cine(false);
    }) });
    // the Witness: optional conversations, one per link found
    const WTALK = [
      ['How many times?', () => true, [['kai', 'How many times have you stood here?'], ['witness', `${iters === 1046 ? 'One thousand and forty-six' : iters}. Every one of them on this floor, at this second, looking at her hand.`], ['witness', 'You think I haven\'t tried everything. I have tried everything twice.']]],
      ['The valley.', () => G.links.has('burial'), [['kai', 'You took the core three thousand years back.'], ['witness', 'The furthest I could carry it. A valley that would flood. Who digs under a lake?'], ['kai', 'Someone building a dam.'], ['witness', '...Yes.']]],
      ['The letter to Hensel.', () => G.links.has('warning'), [['kai', 'Your first letter. To Hensel.'], ['witness', 'Before I had grey hair. I thought one closed door would be enough.'], ['kai', 'It was. It just opened another one.']]],
      ['The song.', () => G.links.has('call'), [['kai', 'You\'ve been calling her through Halden.'], ['witness', 'Her pattern is in the ring. She answers to that tune. She always did.'], ['kai', 'She was ten. She answered it here.']]],
    ];
    act({ pos: [P.witness[0], 1.0, P.witness[2]], radius: 2.2, prompt: 'Talk to the Witness', enabled: () => S.phase === 'explore' && S.zone === 'hub' && WTALK.some(t => t[1]() && !G.wtalks.has(t[0])), onUse: () => side(async () => {
      S.main = true; cine(true);
      const avail = WTALK.filter(t => t[1]() && !G.wtalks.has(t[0]));
      const i = await choose('kai', 'Ask the Witness', [...avail.map(t => t[0]), 'Not now.'], 0);
      if (i < avail.length) { G.wtalks.add(avail[i][0]); await convo(witness, avail[i][2]); }
      S.main = false; cine(false);
    }) });
    shard('the hall', W.hubShard);
    page(2, W.hubPage, 'Test Hall Zero');

    // =================================================================================================================
    // I · THE VALLEY: infer a causal chain (cause in the earliest state, effect in the latest)
    // =================================================================================================================
    const keepers = V.keepers.map(([x, y, z, ry], i) => { const c = game.ambient({ ...KEEPERS[i], seed: 2250 + i }, x, y, z, ry); c.pose = i === 2 ? 'look' : 'work'; freezeLater(c); holderVis(c, st('bce')); people.village.push(c); return c; });
    const echo = game.ambient({ ...CAST.witness.look, era: '2049', costume: 'witness', lod: true, age: 50 }, V.echo[0], V.echo[1], V.echo[2], PI / 2);
    try { echo.setGhost(0xff8a6a); } catch (err) { void err; } echo.root.visible = false; echo.pose = 'look';
    game.onUpdate(() => { echo.root.visible = game.residueOn && T.current === 'bce' && S.zone === 'village'; });
    void keepers;
    // residue footprints in 400 CE: the keepers' feet from the old steps to the door, and one pair of boots
    {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
      const g = new THREE.Group();
      for (let i = 0; i < 14; i++) { const t = i / 13, x = -68.5 + t * 6.6, z = 12.4 - t * 12; const f = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.28), mat); f.rotation.set(-PI / 2, 0, Math.atan2(6.6, -12) + PI); f.position.set(x + (i % 2 ? 0.15 : -0.15), -3.98, z); g.add(f); }
      scene.add(g); g.visible = false;
      game.onUpdate(() => { g.visible = game.residueOn && T.current === 'ce400' && S.zone === 'village'; });
    }
    const vTok = {
      found: { title: 'HELIX FINDS IT WHOLE', sub: '2031 · dam inspection · the core intact' },
      seal: { title: 'THE SEAL HOLDS', sub: '400 CE · lime and 212 notches' },
      hide: { title: 'HE HIDES THE CORE', sub: 'c. 1000 BCE · "Let no one open it"' },
      rot: { title: 'THE CORE ROTS', sub: 'the chamber floods · nothing left' },
    };
    const vGot = (k, line) => { if (G.vTokens.has(k)) return; G.vTokens.add(k); audio.sfxPlay('motif'); ui.toast(`CAUSE TOKEN · ${vTok[k].title}`, 2600); if (line) ui.subtitle('kai', line, 3200); };
    act({ pos: [V.board[0], 0.6, V.board[2]], radius: 2.0, prompt: 'Read the Helix survey board', states: ['v2049'], onUse: () => side(async () => {
      S.main = true; cine(true);
      await closeUp([V.board[0], 0.6, V.board[2]], [['kai', '"Dam inspection, February twenty thirty-one. Rectangular opening in the retaining wall. Lime seal intact. Chamber dry."'], ['kai', '"Divers recovered one core. Intact. Still warm." Sent to Helix Lab 1.']], 1.1, 34, 0.5);
      ev('Survey board · Reservoir 7, 02.2031', 'Helix\'s dam inspection found a sealed chamber in the old retaining wall, dry, and recovered an intact core, still warm. Designation SITE 0. Authorised: E. Rook.', 'The valley · 2049');
      vGot('found'); vGot('rot');
      await game.say('kai', 'Three thousand years in a wall and it comes out whole. Things don\'t stay whole by accident.');
      S.vstep = Math.max(S.vstep || 0, 1);
      S.main = false; cine(false);
    }) });
    act({ pos: [V.seal[0] - 0.5, -3.0, V.seal[2]], radius: 2.0, prompt: 'Examine the seal on the Keepers\' Door', states: ['ce400'], onUse: () => side(async () => {
      S.main = true; cine(true);
      await closeUp([V.seal[0], -2.85, V.seal[2]], [['kai', 'Lime plaster. Still hard after fourteen hundred years. Someone mixed it to last.'], ['kai', '"Let no one open it. Not even the one who closed it."']], 1.4, 38, 0.2);
      await game.say('m22band', 'Tally around the seal: two hundred and twelve marks. Pattern matches: the Witness\'s band, notch spacing.');
      await game.say('kai', 'Two hundred and twelve. His band counts attempts. He was here on the two hundred and twelfth.');
      ev('The Keepers\' seal · c. 400 CE', '"LET NO ONE OPEN IT · not even the one who closed it." Lime plaster, unbroken, ringed by 212 tally marks spaced like the Witness\'s band.', 'The valley · 400 CE');
      vGot('seal'); S.vstep = Math.max(S.vstep || 0, 2);
      S.main = false; cine(false);
    }) });
    act({ pos: [V.echo[0], -3.0, V.echo[2]], radius: 2.2, prompt: 'Read the echo at the door (Residue Vision)', states: ['bce'], enabled: () => game.residueOn, onUse: () => side(async () => {
      S.main = true; cine(true);
      pl.place(V.echo[0] - 1.4, -4, V.echo[2] + 2.2, PI * 0.8);
      await game.shot([V.echo[0] - 3.4, -2.5, V.echo[2] - 1.6], [V.echo[0], -2.4, V.echo[2]], 1.2, { fov: 40 });
      await game.say('m22echo', 'Seal it. Lime, then stone. Let nobody open it.');
      await game.say('m22keeper', 'And the fire inside the stone? It sings at night.');
      await game.say('m22echo', 'Let it sing in the dark. Nobody digs in a valley that floods.');
      await game.say('m22echo', 'And if a man with my face comes back younger, don\'t let him in either.');
      await game.shot([V.echo[0] - 1.6, -2.4, V.echo[2] + 1.0], [V.echo[0] + 0.4, -2.3, V.echo[2]], 1.0, { fov: 34 });
      await game.say('kai', 'Him. Older than me, younger than now. He brought the core here to bury it.');
      ev('Residue · the night of the burial', 'c. 1000 BCE: an earlier Witness tells the keepers to wall the singing core into the terrace and never open it. "Nobody digs in a valley that floods."', 'The valley · c. 1000 BCE');
      vGot('hide'); S.vstep = Math.max(S.vstep || 0, 3);
      S.main = false; cine(false);
    }) });
    act({ pos: [V.core[0], -3.0, V.core[2]], radius: 2.0, prompt: 'Look at the core in its socket', states: ['bce', 'ce400'], onUse: () => side(async () => {
      if (!once('vcore')) { ui.subtitle('kai', 'Still burning. In 2049 the socket is empty.', 2400); return; }
      S.main = true; cine(true);
      await closeUp([V.core[0], -2.75, V.core[2]], [['kai', 'The core. Burning in a stone socket, three thousand years before anybody could make one.'], ['kai', T.current === 'bce' ? 'The same seams as the ring in the hall. It\'s the heart of it.' : 'Fourteen hundred years later and it hasn\'t dimmed.']], 1.3, 38, 0.2);
      ev('The core in the valley', 'A ceramic core with superconducting seams, burning in a stone socket under the terrace. The same make as the ring\'s heart in Test Hall Zero.', 'The valley');
      S.main = false; cine(false);
    }) });
    act({ pos: [V.card[0], -3.4, V.card[2]], radius: 1.7, prompt: 'Pick up the card under the threshold', states: ['bce'], enabled: () => !G.seen.vcard, onUse: () => side(async () => {
      G.seen.vcard = true; W.vCard.visible = false; T.objects = T.objects.filter(o => o !== W.vCard);
      S.main = true; cine(true);
      await closeUp([V.card[0], -3.98, V.card[2]], [['kai', 'A Helix card. K. Varen. The same one Niko\'s people kept for three thousand years.'], ['kai', 'It wasn\'t a prophecy. He dropped it.']], 0.9, 34, 0.7);
      ev('The card under the threshold', 'The Helix access card "K. VAREN" from M4 lies under the Keepers\' threshold on the night of the burial. The Witness lost it here.', 'The valley · optional');
      audio.sfxPlay('pickup'); S.main = false; cine(false);
    }) });
    page(1, W.vPage, 'the valley', ['ce400']);
    shard('the valley', W.vShard, ['bce']);
    act({ pos: [V.notice[0], 1.4, V.notice[2]], radius: 1.8, prompt: 'Read the Helix notice', states: ['v2049'], enabled: () => !G.seen.vnotice, onUse: () => { G.seen.vnotice = true; ui.subtitle('kai', m5done ? 'Reservoir 7. I drained this once. In another hour of my life.' : 'Reservoir 7. A whole village under the water, and a notice about swimming.', 3200); } });
    // the Water Ring: the chain board
    const placeTokens = (list) => list.forEach((k, i) => { const m = W.vSockets[i]; m.material.map = m.material.emissiveMap = k ? TEX.link(0, vTok[k].title, vTok[k].sub) : TEX.link(0, '—', 'empty'); m.material.needsUpdate = true; });
    act({ pos: [V.ring[0], 1.0, V.ring[2]], radius: 3.0, prompt: 'Build the causal chain at the Water Ring', enabled: () => !G.chainDone && S.zone === 'village', onUse: () => side(async () => {
      if (G.vTokens.size < 4) { ui.subtitle('kai', G.vTokens.size === 0 ? 'Nothing to set yet. Start with what Helix found: the lake, 2049.' : 'Not enough to go on yet. Each state of the valley holds one more piece.', 3000); return; }
      S.main = true; cine(true);
      await game.shot([V.ring[0] + 3.4, 2.6, V.ring[2] + 3.4], [V.ring[0], 0.8, V.ring[2]], 1.0, { fov: 44 });
      await game.say('kai', 'What made Helix\'s machine possible? Three causes, in order, ending at the machine.');
      const chosen = [], keys = ['hide', 'seal', 'found', 'rot'];
      for (let s = 0; s < 3; s++) {
        const left = keys.filter(k => !chosen.includes(k));
        const want = ['hide', 'seal', 'found'][s];
        const i = await choose('kai', `Socket ${s + 1} of 3${s === 2 ? ' · then: THE MACHINE IS SWITCHED ON' : ''}`, left.map(k => vTok[k].title + ' · ' + vTok[k].sub), left.indexOf(want));
        chosen.push(left[i]); placeTokens([...chosen, null, null].slice(0, 3)); audio.sfxPlay('metal');
      }
      const ok = chosen.join() === 'hide,seal,found';
      if (!ok) {
        G.vMisses++; audio.sfxPlay('fail'); game.shake = 0.05;
        const why = chosen.includes('rot') ? 'The chamber was dry and the core came out warm. It never rotted. The survey says so.' : chosen[0] !== 'hide' ? 'Nothing can be sealed before it\'s hidden. Start with the night of the burial.' : 'A seal holding is what lets it be found whole. Not the other way round.';
        await game.say('kai', why);
        placeTokens([null, null, null]);
        if (G.vMisses >= 2) ui.toast('EARLIEST STATE FIRST · THEN WHAT KEPT IT · THEN WHAT FOUND IT', 3600);
        S.main = false; cine(false); return;
      }
      G.chainDone = true; F.m22chainMisses = G.vMisses;
      musicLock = null; audio.sfxPlay('success');
      await game.shot([V.ring[0] + 5, 4.5, V.ring[2] + 5], [V.ring[0], 0.5, V.ring[2]], 1.6, { fov: 46 });
      await game.say('kai', 'He hid it to stop it. The seal held. The lake kept people away until a dam needed inspecting, and they pulled out a perfect machine.');
      await game.say('witness', 'I put it where no one could use it.');
      await game.say('kai', 'You put it where it would stay whole. You kept it safe for them.');
      await game.shot([-30, 9, 10], [0, 4, -8], 2.2, { fov: 50 });
      await addLink('burial');
      S.main = false; cine(false);
      game.checkpoint(...V.entry);
      ui.subtitle('kai', G.links.size < 3 ? 'One. Back across. The others are waiting.' : 'That\'s the third. Back to the hall.', 3200);
    }) });
    hint(() => S.zone === 'village' && !G.chainDone && (S.vstep || 0) === 0, 50, () => ui.subtitle('kai', T.current === 'v2049' ? 'The raft. Helix leaves notes on everything.' : 'Twenty forty-nine first: what Helix found. Key 3.', 2800));
    hint(() => S.zone === 'village' && !G.chainDone && S.vstep === 1, 60, () => ui.subtitle('kai', T.current === 'ce400' ? 'The door. The landslide on the north side goes down into the basin.' : 'Four hundred CE. The door in the wall, before the lake. Key 2.', 3000));
    hint(() => S.zone === 'village' && !G.chainDone && S.vstep === 2, 60, () => ui.subtitle('kai', T.current === 'bce' ? (game.residueOn ? 'Someone stood at the door that night.' : 'Residue Vision. Someone stood at the door that night.') : 'The night they sealed it. The earliest state, key 1.', 3000));
    hint(() => S.zone === 'village' && !G.chainDone && S.vstep >= 3, 50, () => ui.subtitle('kai', 'The Water Ring on the terrace. Set the chain.', 2600));

    // =================================================================================================================
    // II · THE OLD QUARTER: read a repeating pattern (the house skips the ninth)
    // =================================================================================================================
    const OFF = [0, 3, 6];
    const gateCount = (g, t) => Math.floor(((t - OFF[g]) % 9 + 9) % 9);
    const gateFrac = (g, t) => (((t - OFF[g]) % 9 + 9) % 9) % 1;
    const gates = new LocalLoop(game, { id: 'm22gates', label: 'HENSEL\'S LANE · THE HAMMERS', duration: 9, restart: C.restarts[0], region: p => p.x > 45.2 && p.x < 65.6 && Math.abs(p.z) < 4.6, resetToast: 'THE LOOP REWINDS · YOU KEEP WHAT YOU LEARNED', autoStart: true });
    gates.at(0.2, () => {}, { learn: ['strike', '1–8 · each row of hammers strikes eight times'], when: () => S.zone === 'clock' && pl.pos.x < 49 });
    gates.at(8.2, () => {}, { learn: ['ninth', '9 · on the ninth count every hammer rests'], when: () => S.zone === 'clock' && G.seen.cIntro });
    gates.at(3.2, () => {}, { learn: ['offset', 'Each row counts from its own first strike: the dial over it'], when: () => S.zone === 'clock' && G.seen.cIntro && gates.knows('ninth') });
    const headY = (g, t) => { const c = gateCount(g, t), f = gateFrac(g, t); if (c === 8) return 3.2; if (f < 0.22) return 3.2 * (1 - f / 0.22); if (f < 0.55) return 0; return 3.2 * ((f - 0.55) / 0.45); };
    game.onUpdate(() => {
      if (S.zone !== 'clock' && W.islands.clock.root.visible === false) return;
      const t = gates.t;
      W.hammers.forEach((h, g) => { const y = headY(g, t); h.row.forEach(r => { r.userData.head.position.y = y; }); h.hand.rotation.z = -gateCount(g, t) / 9 * PI * 2; h.lamp.material.emissiveIntensity = gateCount(g, t) === 8 ? 2.4 : 0.15; });
    });
    gates.hazard(() => {
      if (G.gatesPassed >= 3 || S.zone !== 'clock') return false;
      for (let g = 0; g < 3; g++) { if (Math.abs(pl.pos.x - C.gates[g]) < 0.75 && Math.abs(pl.pos.z) < 2.05 && headY(g, gates.t) < 1.4) { G.gateResets++; return 'THE HAMMER CAME DOWN · THE LANE REWINDS'; } }
      return false;
    });
    gates.onReset(n => { musicState.loop = n; if (n === 1) ui.subtitle('kai', 'Again. Watch the dials over the rows. Count with them.', 3200); if (n === 3) ui.subtitle('kai', 'Eight strikes. Then nothing. The ninth is the gap.', 3000); });
    game.onUpdate(() => {
      if (S.zone !== 'clock' || G.gatesPassed >= 3) return;
      const x = pl.pos.x;
      for (let g = G.gatesPassed; g < 3; g++) if (x > C.gates[g] + 0.9) { G.gatesPassed = g + 1; gates.setRestart(...C.restarts[Math.min(2, g + 1)]); game.checkpoint(...C.restarts[Math.min(2, g + 1)]); if (g === 2) { gates.hudWanted = false; ui.subtitle('kai', 'Through. Hensel\'s door.', 2200); } }
    });
    // the shop: a thirty-second loop of the morning he turned them away
    const shopIn = (p) => p.x > 66.4 && p.x < 77.6 && Math.abs(p.z) < 5.8;
    const hensel = await actor('oskar26', ...C.hensel, -PI / 2); people.clock.push(hensel);
    const kidEchoes = C.kids.map((p, i) => { const c = game.ambient({ ...(i ? CAST.m22kai7.look : CAST.m22mira10.look), lod: true }, p[0], 0, p[2], -PI / 2); try { c.setGhost(0xffd8a0); } catch (err) { void err; } c.root.visible = false; return c; });
    const shop = new LocalLoop(game, { id: 'm22shop', label: 'HENSEL\'S SHOP · 07:52', duration: 30, region: shopIn, autoStart: true });
    shop.at(0.5, () => { kidEchoes.forEach(c => { c.root.visible = S.zone === 'clock'; }); audio.sfxPlay('door'); });
    shop.at(1.0, () => { if (S.zone === 'clock' && !S.busy) walkTo(hensel, [[69.5, 0, 0.3], [67.0, 0, 0]], 1.3); });
    shop.at(4.0, () => { if (S.zone === 'clock' && near(C.door, 14) && !S.busy) ui.subtitle('oskar26', 'Not today, you two. Go on up the hill. It\'s the Helix open day this morning.', 3800); });
    shop.at(8.0, () => { if (S.zone === 'clock' && near(C.door, 14) && !S.busy) ui.subtitle('m22mira10', 'But Kai\'s watch. Mum said half past eight.', 2800); });
    shop.at(11.0, () => { if (S.zone === 'clock' && near(C.door, 14) && !S.busy) ui.subtitle('oskar26', 'Tomorrow. Go on. Your mother\'s waiting by the bridge.', 3000); });
    shop.at(13.0, () => { kidEchoes.forEach(c => { c.root.visible = false; }); if (S.zone === 'clock' && !S.busy) walkTo(hensel, [[69.5, 0, 0.3], [C.hensel[0], 0, C.hensel[2]]], 1.2).then(() => { hensel.root.rotation.y = -PI / 2; hensel.pose = 'work'; }); });
    shop.at(19.5, () => { hensel.pose = null; hensel.lookTarget = null; });
    shop.at(20.0, () => {}, { learn: ['skip', '0:20 · the ninth clock on the wall never lights: the house skips it'], when: () => shopIn(pl.pos) });
    shop.at(23.0, () => { if (shopIn(pl.pos)) { hensel.lookTarget = kai.head; } });
    shop.onWrap(() => { hensel.root.position.set(...C.hensel); hensel.root.rotation.y = -PI / 2; hensel.pose = null; hensel.lookTarget = null; });
    // the clock wall: each face lights for 2.5 s in turn, the ninth (index 8) stays dark
    game.onUpdate(() => { if (S.zone !== 'clock') return; const i = Math.floor(shop.t / 2.5) % 12; W.clockWall.forEach((f, k) => { f.material.emissiveIntensity = k === i && k !== 8 ? 1.1 : 0.12; }); });
    const ninthNow = () => shop.t >= 20 && shop.t < 22.5;
    act({ pos: [C.drawer[0], 1.0, C.drawer[2]], radius: 1.8, prompt: 'Stop the drawer dial', enabled: () => !G.drawer && S.zone === 'clock', onUse: () => {
      if (!ninthNow()) { G.drawerMisses++; audio.sfxPlay('metal'); W.drawerDial.rotation.x += 0.6; ui.subtitle('kai', G.drawerMisses === 1 ? 'It slips past. The drawer wants a particular minute.' : 'Not that one. The one the wall skips.', 2600); if (G.drawerMisses === 3) ui.toast('WATCH THE CLOCK WALL · STOP THE DIAL WHEN THE DARK FACE IS DUE', 3400); return; }
      side(async () => {
        G.drawer = true; S.main = true; cine(true); audio.sfxPlay('door');
        await tween(0.6, k => { W.drawer.position.x = C.drawer[0] + 0.1 - k * 0.42; });
        await closeUp([C.drawer[0] - 0.3, 0.8, C.drawer[2]], [['kai', 'On the ninth. The house only opens on the minute it pretends isn\'t there.'], ['kai', 'A letter. My handwriting. Older.']], 1.0, 34, 0.6);
        await game.say('kai', '"Oskar. On the nineteenth the Varen children will come to your door at ten to eight. Do not let them in. Send them away."');
        await game.say('kai', '"Keep the boy from the ninth minute. You will not believe me. Do it anyway. K. Attempt one."');
        ev('Letter to Hensel · attempt 0001', '"On the nineteenth the Varen children will come to your door at ten to eight. Do not let them in. Send them away. Keep the boy from the ninth minute. — K. (attempt 1)"', 'The Old Quarter · 2026');
        G.letter = true; S.main = false; cine(false);
      });
    } });
    act({ pos: [C.ledger[0], 1.0, C.ledger[2]], radius: 1.8, prompt: 'Read Hensel\'s repair ledger', enabled: () => !G.ledger && S.zone === 'clock', onUse: () => side(async () => {
      G.ledger = true; S.main = true; cine(true);
      await closeUp([C.ledger[0], 1.0, C.ledger[2]], [['kai', '"Varen. Boy\'s watch, new crystal. Collect eight thirty, Mrs V. with both children."'], ['kai', '"Seven fifty-two. The Varen children at the door. Did as the man with his face asked. Told them to go up the hill to the Helix open day."']], 0.9, 34, 0.7);
      ev('Hensel\'s ledger · 19.10.2026', 'Booked: Varen, boy\'s watch, collect 08:30 with both children. Then, 07:52: the children at the door; Hensel sends them away, "up the hill to the Helix open day", as the man with Kai\'s face asked.', 'The Old Quarter · 2026');
      S.main = false; cine(false);
    }) });
    act({ pos: [C.counter[0] - 0.8, 1.0, C.counter[2]], radius: 2.4, prompt: 'Work it out: where would they have been at 08:14?', enabled: () => G.letter && G.ledger && !G.links.has('warning') && S.zone === 'clock', onUse: () => side(async () => {
      S.main = true; cine(true);
      await game.shot([70.4, 2.0, 2.6], [72.4, 1.0, 0], 1.0, { fov: 40 });
      const i = await choose('kai', 'If Hensel had let them in, where were the children at 08:14?', ['Here, at the counter. The watch was booked for 08:30.', 'At the Helix open day anyway.', 'At home with their mother.'], 0);
      if (i !== 0) { G.shopMisses++; audio.sfxPlay('fail'); await game.say('kai', i === 1 ? 'Not "anyway". The ledger has them booked here till half past. The hall was for later, if at all.' : 'Mum was bringing them here. Both children, eight thirty. It\'s in his hand.'); S.main = false; cine(false); return; }
      await game.say('kai', 'Here. Watching the clocks with Hensel till half past eight. Nowhere near the ring.');
      await game.say('kai', 'He shut the door to keep us out of the ninth minute, and Mum took us up the hill instead. He sent us to the hall.');
      await game.say('witness', 'I wrote that before I had grey hair. One closed door. I thought it would be enough.');
      await game.shot([58, 9, 6], [0, 4, -8], 2.2, { fov: 50 });
      await addLink('warning');
      F.m22shopMisses = G.shopMisses;
      S.main = false; cine(false);
      game.checkpoint(...C.restarts[2]);
    }) });
    act({ pos: [C.hensel[0] - 1.0, 1.0, C.hensel[2]], radius: 2.2, prompt: 'Talk to the clockmaker', enabled: () => !G.hensel && S.zone === 'clock' && shop.t > 20 && shop.t < 29, onUse: () => side(async () => {
      G.hensel = true; S.main = true; cine(true); hensel.lookTarget = kai.head;
      await convo(hensel, [['oskar26', 'You again. You said you\'d come back looking younger.'], ['kai', 'You can see me.'], ['oskar26', 'In this house a minute goes round and round. I\'ve had a long time to notice who stands in it.'], ['kai', 'Did you believe the letter?'], ['oskar26', 'I believed the face. I\'m sorry. I sent them up the hill.']]);
      ev('Oskar Hensel, 2026', 'In the loop of 07:52 Hensel sees Kai: "You said you\'d come back looking younger." He believed the face, not the letter.', 'The Old Quarter · optional');
      S.main = false; cine(false);
    }) });
    page(0, W.cPage, 'Hensel\'s shop');
    shard('Hensel\'s lane', W.cShard);
    hint(() => S.zone === 'clock' && G.gatesPassed < 3 && pl.pos.x < 49.5, 45, () => ui.subtitle('kai', 'Watch a row a whole cycle. Count the strikes.', 2600));
    hint(() => S.zone === 'clock' && G.gatesPassed >= 3 && !G.drawer, 60, () => ui.subtitle('kai', G.ledger ? 'The drawer under the counter. The clock wall knows when.' : 'The counter. His ledger, and the drawer.', 2800));

    // =================================================================================================================
    // III · WARD 4: use inversion (the call runs backward; undo it last-in, first-out)
    // =================================================================================================================
    const inv = new Inversion(game, { cost: 0.22, duration: 4.5, range: 6.5 });
    const wz = inv.zone({ id: 'ward', min: [-9.7, 0, 46.3], max: [9.7, 3.4, 78], dir: -1, label: 'WARD 4', doors: [{ at: [0, 46.8], axis: 'z', width: 3.2 }] });
    const HZ = H.hazards;
    const hz = window.__m22.X.hz = [
      inv.track(W.gurney, { from: HZ.gurney[0], to: HZ.gurney[1], schedule: [2.0, 1.4, 1.4, 0.9], phase: 0.4, hazard: { radius: 1.05, msg: 'THE GURNEY CAME BACK' }, label: 'gurney', zone: wz }),
      inv.track(W.cart, { from: HZ.cart[0], to: HZ.cart[1], schedule: [1.8, 1.2, 1.6, 0.8], phase: 2.2, hazard: { radius: 0.8, msg: 'THE CRASH CART CAME BACK' }, label: 'crash cart', zone: wz }),
      inv.track(W.pole, { from: HZ.pole[0], to: HZ.pole[1], arc: 0.2, spin: [0, 0, 0.3], schedule: [1.4, 1.0, 1.2, 0.7], phase: 1.0, hazard: { radius: 0.6, msg: 'THE IV POLE CAME BACK' }, label: 'IV pole', zone: wz }),
    ];
    void hz;
    inv.onHit = (tr) => { if (S.zone !== 'ward' || G.traced) return; G.hazardHits++; game.fail(tr.o.hazard.msg); };
    inv.enabled = false;
    // the relays: each rests "fired" (u = 1); an inversion carries it back and latches it
    const relayTr = W.relays.map((g, i) => inv.track(g.userData.flap, { drift: true, u: 1, latch: true, dur: 1.0, range: 5.5, label: 'relay R' + (i + 1), selectable: true,
      pose: (u, o) => { o.rotation.x = (1 - u) * 1.2; o.material.emissive.setHex(u < 0.5 ? 0xffd8a0 : 0xa8d8ff); },
      hazard: null, canInvert: () => G.bay && !G.traced, onLatch: () => relayLatched(i) }));
    Object.assign(window.__m22.X, { inv, relayTr, gates, shop, W });
    const relayReset = () => { for (const tr of relayTr) { tr.done = false; tr.inv = 0; tr.u = 1; inv.pose(tr, 1); } G.latched = 0; musicState.latched = 0; };
    function relayLatched(i) {
      const want = 3 - G.latched;
      if (i !== want) { G.relayFails++; audio.sfxPlay('fail'); game.shake = 0.04; ui.toast('THE LINE SNAPS BACK · LAST IN, FIRST OUT', 2600); setTimeout(relayReset, 300); if (G.relayFails === 1) ui.subtitle('kai', 'Wrong end. The pulse reaches the window last. Undo that one first.', 3200); return; }
      G.latched++; musicState.latched = G.latched; audio.sfxPlay('switch'); ui.toast(`RELAY R${i + 1} · TRUE DIRECTION · ${G.latched}/4`, 1800);
      if (G.latched >= 4) side(traced);
    }
    // the pulse along the line: bed -> window while reversed; window -> bed once traced
    const curve = W.lineCurve;
    game.onUpdate((dt, t) => { if (S.zone !== 'ward') { W.pulse.visible = false; return; } W.pulse.visible = G.bay; const u = (t / 3.2) % 1; W.pulse.position.copy(curve.getPointAt(G.traced ? u : 1 - u)); W.pulse.material.emissive.setHex(G.traced ? 0xffd8a0 : 0xa8d8ff); });
    // the tone: three notes, inverted acoustics (quieter as Kai gets closer)
    const tone = inv.sound({ pos: H.monitor, maxD: 30, r0: 1.0, period: 2.2, inverted: () => !G.traced, play: (gn) => {
      if (!audio.ctx || gn < 0.04 || S.zone !== 'ward') return; const a = audio.ctx.currentTime;
      [329.6, 493.9, 440.0].forEach((f, k) => audio.tone(f, 0.22, 'sine', 0.16 * gn, audio.sfx, a + k * 0.26, 0.004));
    } });
    tone.on = false;
    act({ pos: [H.bed[0] - 3.0, 1.0, H.bed[2]], radius: 2.8, prompt: 'Look at bed 4-07', enabled: () => S.zone === 'ward' && !G.bay, onUse: () => side(bayScene) });
    async function bayScene() {
      G.bay = true; S.main = true; cine(true);
      await game.shot([2.6, 1.8, 63.0], [H.bed[0], 0.7, H.bed[2]], 1.4, { fov: 42 });
      await game.say('m22band', 'Bay four oh seven. Bed load fifty-four kilograms. Patient: none. Tone source: not this bay.');
      await game.say('kai', 'Silent right next to it. Then it isn\'t coming from here. It\'s arriving here.');
      await game.shot([0.2, 1.6, 66.4], [4.6, 2.9, 70.0], 1.6, { fov: 50 });
      await game.say('kai', 'The line. Bed, bay, corridor, window. The pulse runs out to the window.');
      await game.say('kai', 'Everything in here runs backwards. So it doesn\'t run out. It runs in.');
      await game.say('m22band', 'Relays in range: four. Inversion carries a relay back to before it fired.');
      await game.say('kai', 'Like the lock at Halden. Last in, first out.');
      S.main = false; cine(false);
      game.checkpoint(0.8, 0, 66.6, 0);
    }
    async function traced() {
      G.traced = true; S.main = true; cine(true); inv.setHazards(false);
      audio.sfxPlay('success');
      await game.shot([0.4, 1.7, 73.4], [0, 2.2, 78.2], 1.4, { fov: 44 });
      await game.say('m22band', 'Line traced. Source: a band. Varen, K. One thousand and forty-six notches.');
      await game.say('m22band', 'Content: three tones. E, B, A. Destination: Test Hall Zero, nineteenth of October twenty twenty-six, oh eight fourteen and two seconds.');
      await game.shot([5.0, 1.5, 63.0], [H.bed[0], 0.8, H.bed[2]], 1.6, { fov: 40 });
      await game.say('kai', 'The ring sang because he was calling her. Every attempt, the same three notes, home through her bed at Halden.');
      await game.say('witness', 'I was calling her home.');
      await game.say('kai', 'You were calling her to the ring. She was ten. She followed the song.');
      await game.shot([0, 6, 40], [0, 4, -8], 2.2, { fov: 50 });
      await addLink('call');
      tone.on = false; S.main = false; cine(false);
      game.checkpoint(...H.entry);
    }
    act({ pos: [H.mira[0] - 1.2, 1.0, H.mira[2] + 0.6], radius: 2.0, prompt: 'Look at the bed with Residue Vision', enabled: () => S.zone === 'ward' && game.residueOn && !G.seen.wmira, onUse: () => side(async () => {
      G.seen.wmira = true; S.main = true; cine(true);
      W.miraEcho = W.miraEcho || (() => { const c = game.ambient({ ...CAST.m22mira10.look, lod: true }, H.mira[0], 0.62, H.mira[2], -PI / 2); try { c.setGhost(0x9a7bff); } catch (err) { void err; } c.pose = 'sit'; return c; })();
      W.miraEcho.root.visible = true;
      await game.shot([3.4, 1.4, 64.4], [H.mira[0], 1.1, H.mira[2]], 1.4, { fov: 36 });
      await game.say('kai', 'Mira. Ten years old, sitting on the bed in the dark, listening.');
      await game.say('kai', 'She can hear it from here too.');
      ev('Residue · bay 4-07', 'Mira (10) as residue on bed 4-07, sitting up, listening to the three notes.', 'Ward 4 · optional');
      W.miraEcho.root.visible = false;
      S.main = false; cine(false);
    }) });
    act({ pos: [H.chart[0], 1.0, H.chart[2]], radius: 1.8, prompt: 'Read the 4-07 chart', enabled: () => S.zone === 'ward' && !G.seen.wchart, onUse: () => side(async () => {
      G.seen.wchart = true; S.main = true; cine(true);
      await closeUp([H.chart[0] + 0.5, 1.03, H.chart[2]], [['kai', '"Tone source: not this bay. Check line." "The tone gets quieter as you walk in." "Somebody is calling her."']], 0.9, 34, 0.7);
      ev('Ward 4 chart · bay 4-07', 'Occupied since 19.10.2026 08:14 with no patient; three repeating tones; "Tone source NOT this bay. Check line." "Somebody is calling her."', 'Ward 4');
      S.main = false; cine(false);
    }) });
    page(3, W.hPage, 'Ward 4');
    shard('Ward 4', W.hShard);
    hint(() => S.zone === 'ward' && !G.bay, 55, () => ui.subtitle('kai', 'The notes. Loud at the door, quiet near the source. Walk where they fade.', 3000));
    hint(() => S.zone === 'ward' && G.bay && !G.traced, 60, () => ui.subtitle('kai', G.latched ? 'Next one back along the line, towards the bed.' : 'Start at the window end: R4. Face it, X to invert.', 3000));

    // =================================================================================================================
    // OPTIONAL · CENTRAL STATION: the platform of 08:14, the child who wanted a song
    // =================================================================================================================
    const commuters = COMMUTERS49.map((lk, i) => { const c = game.ambient({ ...lk, seed: 2260 + i }, -9 + i * 3.4, 0, -56 - i * 3.2, PI * (0.6 + i * 0.3)); c.pose = 'look'; freezeLater(c); people.station.push(c); return c; });
    void commuters;
    let child = null;
    if (!childHome) { child = game.ambient({ ...CHILD_LOOK }, ...N.child, PI * 0.2); child.pose = 'look'; people.station.push(child); S.byId.m19child = child; small.add(child); }
    W.childNote.visible = childHome;
    act({ pos: [N.child[0], 1.0, N.child[2]], radius: 2.2, prompt: childHome ? 'Read the drawing on the bench' : 'Talk to the child', enabled: () => S.zone === 'station' && G.child !== 'helped' && G.child !== 'read', onUse: () => side(async () => {
      S.main = true; cine(true);
      if (childHome) {
        await closeUp([N.bench[0], 0.5, N.bench[2] + 0.4], [['kai', 'A drawing. The girl in the yellow coat at her front door, and a man in grey humming.'], ['kai', '"Thank you for the song." She got home.']], 1.0, 34, 0.7);
        G.child = 'read'; ev('The child\'s drawing', 'She got home: a girl at her front door and a man in grey humming three notes. "THANK YOU FOR THE SONG".', 'Central Station · optional');
      } else {
        await convo(child, [['m19child', 'You\'re the man from the trains. Everything stopped again.'], ['kai', 'Not for long. I promise.'], ['m19child', 'Mum hums a song when the trains are late. I can\'t remember how it goes.']]);
        const i = await choose('kai', 'Hum her the song', ['E, B, A. Mira\'s three notes.', 'The station chime.', 'Something made up.'], 0);
        if (i === 0) { await game.say('kai', '(hums) E... B... A.'); await game.say('m19child', 'That one! That\'s it. That\'s the going-home one.'); G.child = 'helped'; await tween(1.6, k => { child.root.scale.setScalar(1 - k * 0.98); }); child.root.visible = false; child.hiddenByStory = true; ev('The child in the station', 'Kai hums Mira\'s three notes; the child remembers her mother\'s going-home song and is gone.', 'Central Station · optional'); }
        else { await game.say('m19child', 'No... that\'s not it. It goes up, then down a little.'); G.child = 'met'; }
      }
      S.main = false; cine(false);
    }) });
    act({ pos: [N.speaker[0] + 1, 1.0, N.speaker[2]], radius: 3.0, prompt: 'Listen to the PA speaker', enabled: () => S.zone === 'station' && !G.pa, onUse: () => side(async () => {
      G.pa = true; S.main = true; cine(true);
      await game.shot([N.speaker[0] + 2.4, 2.4, N.speaker[2] + 2.2], [N.speaker[0], N.speaker[1], N.speaker[2]], 1.2, { fov: 38 });
      await game.say('m22pa', 'Kai Varen. Do not build the machine.');
      await game.say('kai', 'The voice from the station. The first thing I ever heard from him.');
      await game.say('witness', 'Attempt three hundred and four. You didn\'t listen then, either.');
      ev('Central Station PA · 08:14', 'The station speaker still holds the Witness\'s warning from M1: "Kai Varen. Do not build the machine." Attempt 304.', 'Central Station · optional');
      S.main = false; cine(false);
    }) });
    shard('Central Station', W.nShard);
    shard('the stair', W.stairShard);

    // =================================================================================================================
    // IV · THE SECOND ITSELF: reliable evidence vs subjective memory (holders 1/2/3)
    // =================================================================================================================
    const SPOTS = {
      rope: { pos: [0, 0.9, P.rope], prompt: 'Examine the gap in the rope',
        kai: [['kai', 'Closed. I remember the rope closed. She climbed over it, and I went after her.']],
        witness: [['kai', 'He remembers it the same: closed, and her climbing.']],
        record: [['kai', 'In the record the hook is on the floor, open. The rope\'s down. Nobody climbed. Somebody unhooked it.']] },
      cuff: { pos: [0.9, 0.9, P.rope], prompt: 'Examine the rope post',
        kai: [['kai', 'I held on to her. Hard enough to tear my cuff.']],
        witness: [['kai', 'He remembers holding on, too. Then letting go.']],
        record: [['kai', 'A blue thread on the post. Seven-year-old height. The cuff tore here. I did hold on.']] },
      prints: { pos: [1.1, 0.4, -4.7], prompt: 'Examine the floor behind the boy',
        kai: [['kai', 'Nobody behind me. Mum was to my right. That\'s all.']],
        witness: [['kai', 'In his memory there\'s a man behind the boy. A shape. No face. A hand on the shoulder.']],
        record: [['kai', 'Four children\'s prints, the mother\'s. And a man\'s boots behind the boy. Heavy, worn down at the heel. Nobody in 2026 made that sole.']] },
      console: { pos: [P.console[0], 1.2, P.console[2] - 0.4], prompt: 'Examine Rook\'s console',
        kai: [['kai', 'I always told myself Rook pressed it early. Before the warning tone.']],
        witness: [['kai', 'He remembers the same. Rook, early. Forty years of blaming Rook.']],
        record: [['kai', 'Run one, eight fourteen exactly, on schedule. Unscheduled audio, oh-two: three tones, source the field.'], ['kai', 'Oh-nine: operator override. K. Varen.']] },
    };
    for (const [k, sp] of Object.entries(SPOTS)) {
      act({ pos: sp.pos, radius: 1.9, prompt: sp.prompt, enabled: () => G.evidenceOpen && S.zone === 'hub' && !G.links.has('hand'), onUse: () => side(async () => {
        const h = T.current; S.main = true; cine(true);
        await closeUp(sp.pos, sp[h] || sp.kai, 1.5, 40, 0.8);
        if (h === 'record') {
          const nw = CLAIMS.filter(c => c.spot === k && !G.examined.has(c.id));
          nw.forEach(c => { G.examined.add(c.id); ev('Record · ' + c.text, c.why, 'The first second · the record'); });
          if (nw.length) ui.toast(`THE RECORD · ${G.examined.size}/5 CLAIMS CHECKED`, 2200);
        } else if (once('mem' + k + h)) ui.toast('A MEMORY · CHECK IT AGAINST THE RECORD (3)', 2200);
        S.main = false; cine(false);
      }) });
    }
    const updateCards = () => CLAIMS.forEach((c, i) => { const m = W.claimCards[i]; m.material.map = m.material.emissiveMap = TEX.claim(c.text, G.sorted.has(c.id) ? c.verdict : 'none'); m.material.needsUpdate = true; });
    act({ pos: [P.board[0], 1.2, P.board[2] + 0.8], radius: 2.2, prompt: 'Sort the claims at the evidence board', enabled: () => G.evidenceOpen && S.zone === 'hub' && !G.links.has('hand'), onUse: () => side(async () => {
      const todo = CLAIMS.filter(c => G.examined.has(c.id) && !G.sorted.has(c.id));
      if (!todo.length) { ui.subtitle('kai', G.sorted.size >= 5 ? 'All five sorted. Who stood behind the boy?' : 'Nothing checked against the record yet. Switch to it: key 3.', 2800); if (G.sorted.size < 5) return; }
      S.main = true; cine(true);
      await game.shot([P.board[0] - 1.4, 1.7, P.board[2] + 2.8], [P.board[0], 1.6, P.board[2]], 0.8, { fov: 40 });
      for (const c of todo) {
        const i = await choose('kai', `${c.who}: ${c.text}`, ['Backed by the record', 'Memory only'], c.verdict === 'record' ? 0 : 1);
        const v = i === 0 ? 'record' : 'memory';
        if (v !== c.verdict) { G.sortMisses++; audio.sfxPlay('fail'); await game.say('kai', c.verdict === 'record' ? 'No. The room kept that. Whatever I feel about it.' : 'No. Two people remembering it the same way doesn\'t make it true.'); continue; }
        G.sorted.add(c.id); musicState.claims = G.sorted.size; audio.sfxPlay('pickup'); updateCards();
        await game.say('kai', c.why);
      }
      if (G.sorted.size >= 5) {
        const who = ['Elena Varen, their mother', 'Dr. Rook', 'A visitor from the crowd', 'The Witness'];
        const i = await choose('kai', 'The record has a man behind the boy, and an override by K. Varen. Who pulled the boy back?', who, 3);
        if (i !== 3) { G.whoMisses++; audio.sfxPlay('fail'); await game.say('kai', ['Her prints are to the right, a step behind. She never reached him.', 'Rook never left his console. The log has him there the whole second.', 'The visitors were penned behind the gallery line. Nobody crossed it.'][i]); S.main = false; cine(false); return; }
        S.main = false; await revealHand(); return;
      }
      S.main = false; cine(false);
    }) });
    async function evidenceIntro() {
      S.busy = true; S.main = true; cine(true); S.phase = 'evidence';
      try {
        await game.shot([pl.pos.x + 2.5, 2.4, pl.pos.z + 3.5], [P.witness[0], 1.4, P.witness[2]], 1.2, { fov: 46 });
        await game.say('witness', 'Kai. Over here. Let\'s get this over with.');
        pl.place(P.witness[0] + 1.6, 0, P.witness[2] + 2.2, PI * 1.1);
        await game.shot([P.witness[0] + 4, 2.2, P.witness[2] + 4], [P.witness[0], 1.5, P.witness[2]], 1.6, { fov: 44 });
        await convo(witness, [
          ['witness', 'Three places. Three of my attempts. And you think that\'s the reason.'],
          ['kai', 'Three of the reasons. The fourth is here. What happened in this room at nine seconds.'],
          ['witness', 'I know what happened in this room. I was here. I remember every—'],
          ['kai', 'You remember. So do I. Let\'s see what the room remembers.'],
        ]);
        await game.say('m22band', 'Holders in range: three. One, Kai Varen. Two, the Witness. Three, the record: what the room itself kept.');
        G.evidenceOpen = true; T.unlocked = true; T.refreshHud();
        ui.toast('1 AS KAI REMEMBERS · 2 AS THE WITNESS REMEMBERS · 3 THE RECORD', 4200);
        game.checkpoint(P.witness[0] + 1.6, 0, P.witness[2] + 2.2, PI);
      } finally { S.main = false; S.busy = false; cine(false); }
      refresh();
    }
    async function revealHand() {
      S.busy = true; S.main = true; cine(true); lockMusic('m22-chamber', 1.4);
      try {
        if (T.current !== 'witness') await T.switchTo('witness', { force: true, free: true, dur: 700 });
        await game.shot([P.ghost[0] + 2.2, 1.6, P.ghost[2] + 2.2], [P.ghost[0], 1.4, P.ghost[2]], 1.6, { fov: 38 });
        await game.say('kai', 'The boots in the record are yours. The override is yours. The man behind the boy is you.');
        await game.say('witness', 'No. I\'d remember.');
        await game.say('kai', 'You do. A man\'s hand on your shoulder. You never saw his face because it\'s yours.');
        await T.switchTo('record', { force: true, free: true, dur: 700 });
        await game.shot([1.8, 0.9, -3.2], [1.1, 0.0, -4.8], 1.4, { fov: 40 });
        await game.say('kai', 'Attempt seven hundred and thirty. You came into the hall to reach the console. You unhooked the rope to get past, and you pulled the boy out of the way.');
        await game.say('kai', 'He let go of her hand. She went to the ring alone.');
        await T.switchTo('kai', { force: true, free: true, dur: 700 });
        witness.pose = 'sad';
        await game.shot([P.witness[0] - 1.6, 1.5, P.witness[2] + 1.6], [P.witness[0], 1.4, P.witness[2]], 1.4, { fov: 34 });
        await game.say('witness', 'My first memory. I made my own first memory.');
        await game.shot([0, 4.2, 4.5], [0, 3, -11], 2.0, { fov: 50 });
        await addLink('hand');
        witness.pose = null;
        await game.say('m22band', 'Causal links: four. The chamber below the ring is answering.');
        F.m22sortMisses = G.sortMisses; F.m22whoMisses = G.whoMisses;
      } finally { S.main = false; S.busy = false; cine(false); musicLock = null; }
      refresh();
    }

    // =================================================================================================================
    // THE FINAL CHAMBER
    // =================================================================================================================
    async function openStair() {
      S.busy = true; S.main = true; cine(true); lockMusic('m22-chamber', 1.2); musicState.chamber = 0;
      try {
        await game.shot([4.6, 3.2, -6.6], [0, 0.2, -14.6], 1.4, { fov: 46 });
        audio.sfxPlay('boom'); game.shake = 0.08;
        W.threads.forEach(m => { m.material.opacity = 0.9; });
        await tween(2.4, k => { W.coverMesh.position.z = -15.3 - k * 5.6; W.coverMesh.position.y = -0.15 - k * 0.5; });
        W.coverMesh.visible = false; W.stairCover.enabled = false;
        await game.say('witness', 'Under the ring. In a thousand and forty-six attempts it has never opened.');
        await game.say('kai', 'You never gave it the reason. Only reasons.');
        S.phase = 'chamber'; objective('Go down under the ring and open the Chronolith\'s final chamber');
        game.checkpoint(0, 0, -11.6 + 2.4, PI);
      } finally { S.main = false; S.busy = false; cine(false); }
      walkTo(witness, [[-1.2, 0, -9.0], [-0.6, 0, -12.6], [-0.6, -2.5, -17.6], [-0.9, -5, -24.4], [-1.6, -5, -26.2]], 1.3);
      musicLock = null; refresh();
    }
    const LNAMES = (k) => `${LINKS[k].title} · ${LINKS[k].when} · attempt ${LINKS[k].attempt}`;
    const orderPuzzle = async (label, want, whyWrong) => {
      const chosen = [];
      for (let s = 0; s < 3; s++) {
        const left = ORDER_SECOND.filter(k => !chosen.includes(k));
        const i = await choose('kai', `${label} · collar ${s + 1} of 4`, left.map(LNAMES), left.indexOf(want[s]));
        chosen.push(left[i]); W.collars[s].material.emissiveIntensity = 1.6; audio.sfxPlay('metal');
        if (left[i] !== want[s]) { G.irisMisses++; audio.sfxPlay('fail'); game.shake = 0.05; W.collars.forEach(c => { c.material.emissiveIntensity = 0.2; }); await game.say('kai', whyWrong(want[s], left[i])); return false; }
      }
      W.collars[3].material.emissiveIntensity = 1.6;
      return true;
    };
    act({ pos: [P.iris[0], -4.0, P.iris[2] + 1.0], radius: 2.4, prompt: 'Set the collars of the iris', enabled: () => S.phase === 'chamber' && !(G.irisA && G.irisB), onUse: () => side(async () => {
      S.main = true; cine(true);
      await game.shot([2.2, -3.4, -24.6], [0, -3.6, -28.9], 1.0, { fov: 42 });
      if (!G.irisA) {
        if (once('irisA')) { await game.say('m22band', 'Four collars. Inner ring: the causes, in the order the first second felt them.'); }
        const ok = await orderPuzzle('As the second felt them', ORDER_SECOND, (w, got) => `Not ${LINKS[got].title.toLowerCase()} yet. ${LINKS[w].when} comes first.`);
        if (!ok) { S.main = false; cine(false); return; }
        G.irisA = true; musicState.chamber = 1; audio.sfxPlay('success');
        await game.say('kai', 'The burial, three thousand years ago. The warning at seven fifty-two. The call at oh-two. The hand at nine.');
        W.collars.forEach(c => { c.material.emissiveIntensity = 0.2; });
        await game.say('m22band', 'Outer ring: the causes, in the order he made them.');
        await game.say('witness', 'I don\'t... the attempts. One. Two hundred and twelve. Seven thirty. Ten forty-six.');
      }
      const okB = await orderPuzzle('As he made them', ORDER_MADE, (w, got) => `He didn't do ${LINKS[got].title.toLowerCase()} then. Attempt ${LINKS[w].attempt} came first.`);
      if (!okB) { S.main = false; cine(false); return; }
      G.irisB = true; musicState.chamber = 2;
      S.main = false; await finale();
    }) });
    hint(() => S.phase === 'chamber' && !G.irisA && pl.pos.y > -1, 40, () => ui.subtitle('kai', 'Under the ring. The stair.', 2200));

    async function finale() {
      S.busy = true; S.main = true; cine(true); lockMusic('m22-reveal', 2.0);
      await game.say('kai', 'The letter put us in the hall. So you took the core away, and it was kept whole for Helix. So you went in yourself and pulled me back. So you called her home, and she came to the song.');
      await game.say('kai', 'Every attempt answered the last one. And every one is a reason it happened.');
      audio.sfxPlay('boom'); game.shake = 0.06;
      await tween(2.6, k => { W.irisBlades.forEach(b => { const a = b.userData.a, r = 0.6 + k * 1.8; b.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); b.rotation.z = a + PI / 2 + k * 0.6; }); });
      W.irisBox.enabled = false;
      witness.root.position.set(-1.7, -4.7, P.core[2] + 2.6); witness.root.rotation.y = PI * 0.85; pl.place(1.7, -4.7, P.core[2] + 2.6, PI * 1.15);
      await game.shot([0, -2.6, -29.8], [0, -3.4, P.core[2]], 2.6, { fov: 50 });
      await game.shot([4.6, -2.8, P.core[2] + 4.2], [0, -3.4, P.core[2]], 2.0, { fov: 46 });
      await game.say('m22band', 'The final chamber. Causal chain: closed. First cause: none.');
      await convo(witness, [
        ['witness', 'There was never a first time.'],
        ['kai', 'Only a first second. And you kept it from starting a thousand times, by making it.'],
        ['kai', 'You were trying to stop me from becoming you.'],
        ['witness', 'I was trying to find a version of me that didn\'t have to.'],
      ]);
      F.m22quote = true;
      audio.silence?.(1.6); await game.wait(1.2); audio.unsilence?.();
      await game.say('kai', 'There isn\'t one. Not while one of us is still trying to stop it.');
      const c = await choose('kai', 'The core. The second waits to start.', ['"Together. Put your hand on it with mine."', '"Stand back. I\'ll do it."'], 0);
      G.together = c === 0;
      await game.shot([2.6, -3.0, P.core[2] + 2.8], [0, -3.2, P.core[2]], 1.4, { fov: 38 });
      if (G.together) { await game.say('kai', 'Together. You\'ve done every one of these alone.'); await game.say('witness', 'Every one of them.'); witness.root.position.set(-0.9, -4.7, P.core[2] + 1.3); }
      else { await game.say('kai', 'Stand back. This one\'s mine.'); await game.say('witness', 'That is exactly what I said. Every time.'); }
      W.core.material.emissiveIntensity = 4.4; audio.sfxPlay('anomaly'); game.shake = 0.1;
      await game.say('m22band', 'Oh eight fourteen and nine seconds.');
      await game.wait(0.6);
      await game.say('m22band', 'Oh eight fourteen and ten seconds.');
      ui.toast('08:14:10', 3200);
      await game.say('witness', 'It started. I made it. Trying to stop it, I made it.');
      await game.say('kai', 'We made it.');
      await game.say('m22band', 'Zero Second: cause identified. Operator: K. Varen. Attempts: one thousand and forty-six. Every attempt: a cause.');
      // the places begin to merge: the islands drift in, the hall's walls fall outward
      T.configure([{ id: 'free', key: '1', name: 'THE FIRST SECOND', year: '08:14:10', glyph: '◯', color: '#ffe0b0' }], 'free'); T.unlocked = false; S.zone = 'free'; applyLook();
      pl.place(0, 0, -2, PI); witness.root.position.set(-1.6, 0, -3.2); witness.root.rotation.y = PI * 0.8;
      for (const ch of [kidMira, kidKai, mother, rook]) { ch.frozen = false; }
      await game.shot([0, 14, 22], [0, 2, -8], 0.01, { fov: 56 });
      await game.shot([0, 18, 30], [0, 0, -10], 5.0, { fov: 58 });
      S.merging = true;
      tween(5.5, k => { for (const I of Object.values(W.islands)) { const r = I.root; const p0 = r.userData.p0 || (r.userData.p0 = r.position.clone()); r.position.set(p0.x * (1 - k * 0.35), p0.y + Math.sin(k * PI) * 2, p0.z * (1 - k * 0.35)); r.visible = true; } });
      await game.say('kai', 'The valley. Hensel\'s lane. Halden. They\'re coming in.');
      await game.say('witness', 'Everything I touched. It all comes back to where it started.');
      await game.say('kai', 'Then that\'s where she is.');
      // flags
      F.m22done = true; F.witnessCausedZero = true; F.zeroSecondCause = 'witness-attempts'; F.firstSecondStarted = true; F.m22together = G.together;
      F.m22links = G.links.size; F.m22chain = ORDER_SECOND.slice(); F.m22madeOrder = ORDER_MADE.slice(); F.m22evidence = G.ev.size; F.m22shards = G.shards; F.m22pages = G.pages.size;
      F.m22orren = G.orren.size; F.m22child = G.child; F.m22hensel = G.hensel; F.m22pa = G.pa; F.m22gateResets = G.gateResets; F.m22drawerMisses = G.drawerMisses;
      F.m22hazardHits = G.hazardHits; F.m22relayFails = G.relayFails; F.m22irisMisses = G.irisMisses; F.m22witnessTalks = G.wtalks.size; F.m22falls = G.falls;
      await ui.fade(1, 2600);
      const mins = Math.round((game.time - tStart) / 60);
      await ui.chapterCard('MISSION 22 COMPLETE', 'The First Second', `Causal links 4/4 · Claims sorted ${G.sorted.size}/5 · Pages ${G.pages.size}/4 · Shards ${G.shards}/6${mins ? ' · ' + mins + ' min' : ''}`, 4200);
      inv.dispose?.(); gates.dispose(); shop.dispose(); delete T.canSwitch;
      kai.lookTarget = null; kai.pose = null; game.setResidue(false);
      game.releaseCam(); ui.letterbox(false); audio.allBeds?.(0); audio.setTheme(null);
      window.__m22 = null;
      S.main = false; S.busy = false; S.done = true;
    }

    // ---------- objectives ----------
    S.refresh = () => {
      if (S.main || S.done) return;
      if (S.phase === 'explore') {
        if (S.zone === 'village' && !G.chainDone) objective(['2049 (3): read what Helix found on the survey raft', 'Why was it still whole? The door in 400 CE (2): down the landslide', 'Who sealed it? The earliest state (1), at the door: Residue Vision (F)', 'Build the causal chain at the Water Ring on the terrace'][Math.min(3, S.vstep || 0)]);
        else if (S.zone === 'clock' && !G.links.has('warning')) objective(G.gatesPassed < 3 ? 'Cross the lane: the hammers strike eight times, then rest on the ninth' : !G.drawer || !G.ledger ? 'Hensel\'s shop: read the ledger; stop the drawer dial on the minute the house skips' : 'At the counter: where would the children have been at 08:14?');
        else if (S.zone === 'ward' && !G.links.has('call')) objective(!G.bay ? 'Follow the three notes to the bay where they fall silent' : `Invert the relays in reverse: the last the pulse reaches, first (${G.latched}/4)`);
        else { const left = [['burial', 'the valley (west)'], ['warning', 'Hensel\'s lane (east)'], ['call', 'Ward 4 (south)']].filter(([k]) => !G.links.has(k)).map(x => x[1]); objective(left.length ? `Find the links: ${left.join(' · ')}` : 'Back to the hall: the Witness, by the ring'); }
      } else if (S.phase === 'evidence') objective(`Sort memory from the record: examine in 1/2/3, then the evidence board (${G.sorted.size}/5)`);
      else if (S.phase === 'chamber') objective(G.irisA ? 'Set the outer collars: the order he made them' : 'Open the Chronolith\'s final chamber: set the iris collars');
    };
    let oT = 0; game.onUpdate(dt => { oT -= dt; if (oT <= 0) { oT = 1; refresh(); } });

    // island arrivals (first time): staged shots, the band reading the place
    game.onUpdate(() => {
      if (S.busy || !game.control || game.cine || S.phase !== 'explore') return;
      if (S.zone === 'village' && !G.seen.vIntro) { G.seen.vIntro = true; side(villageIntro); }
      else if (S.zone === 'clock' && !G.seen.cIntro) { G.seen.cIntro = true; side(clockIntro); }
      else if (S.zone === 'ward' && !G.seen.wIntro) { G.seen.wIntro = true; side(wardIntro); }
      else if (S.zone === 'station' && !G.seen.nIntro) { G.seen.nIntro = true; ui.subtitle('kai', 'Central Station. Platform two, eight fourteen. Where this started for me.', 3400); }
      else if (S.zone === 'hub' && G.links.size >= 3 && !G.evidenceOpen && S.phase === 'explore' && Math.abs(pl.pos.x) < 14.5 && pl.pos.z > -17.5 && pl.pos.z < 13.5) side(evidenceIntro);
    });
    async function villageIntro() {
      S.main = true; cine(true);
      if (T.current !== 'v2049') await T.switchTo('v2049', { force: true, free: true, dur: 800 });
      await game.shot([-50, 6, 8], [-66, -1, -2], 2.2, { fov: 50 });
      await chapterTitle('I', 'The Valley', 'Reservoir 7 · c. 1000 BCE · c. 400 CE · 2049');
      await game.say('m22band', 'Local states: three. Earliest, about one thousand BCE. Middle, about four hundred CE. Latest, twenty forty-nine.');
      await game.say('kai', m5done ? 'Niko\'s valley. The Keepers\' Door under the terrace. I\'ve been here in all three.' : 'A drowned valley. A door in the wall under the water.');
      await game.say('kai', 'Cause in the earliest, effect in the latest. Start at the end.');
      G.seen.vIntroDone = true; T.unlocked = true; T.refreshHud(); S.vstep = S.vstep || 0;
      game.checkpoint(...V.entry);
      S.main = false; cine(false);
    }
    async function clockIntro() {
      S.main = true; cine(true);
      await game.shot([46, 4.2, 5.5], [64, 4, 0], 2.2, { fov: 48 });
      await chapterTitle('II', 'The Old Quarter', 'Hensel\'s lane · 19 October 2026 · 07:52');
      await game.shot([66, 12, 3], [70, 14, 0], 1.6, { fov: 40 });
      await game.say('kai', sawHensel ? 'Hensel\'s tower. Eight minutes to eight. The morning I don\'t remember coming here.' : 'A clockmaker\'s shop. Eight minutes to eight, the morning of the nineteenth.');
      await game.shot([47, 2.2, 1.4], [56, 1.4, 0], 1.6, { fov: 46 });
      await game.say('kai', 'His house has spilled into the street. Hammers. Rows of them, on a loop.');
      await game.say('kai', 'His house used to skip the ninth minute. Let\'s see what the hammers skip.');
      game.checkpoint(...C.restarts[0]);
      S.main = false; cine(false);
    }
    async function wardIntro() {
      S.main = true; cine(true);
      await game.shot([0, 2.4, 47.2], [0, 1.2, 70], 2.2, { fov: 52 });
      await chapterTitle('III', 'Ward 4', 'Halden General · the night that runs backward');
      await game.say('m22nurse', '...bay seven. Seven bay. Seven bay...');
      await game.say('kai', sawHalden ? 'Halden. Bed four oh seven. The rooms still run backwards.' : 'A hospital ward, running backwards.');
      await game.say('m22band', 'Field reversed. Inversion available: one selected motion.');
      inv.unlock(); inv.enabled = true; tone.on = true;
      ui.toast('X / INVERT · reverses the selected motion', 3400);
      game.checkpoint(...H.entry);
      S.main = false; cine(false);
    }
    // Inversion works only in the ward
    game.onUpdate(() => { const on = S.zone === 'ward'; if (inv.enabled !== on && G.seen.wIntro) { inv.enabled = on; inv.unlock(on); } inv.setHazards(on && !G.traced); tone.on = on && G.seen.wIntro && !G.traced; });

    // =================================================================================================================
    // RUN
    // =================================================================================================================
    await ui.fade(1, 10);
    S.main = true; cine(true);
    pl.place(...P.start); kai.root.rotation.y = PI;
    await game.wait(1.0);
    await game.shot([22, 16, 30], [0, 2, -6], 0.01, { fov: 52 });
    await ui.fade(0, 2200);
    lockMusic('m22-second', 1.0);
    const card = ui.chapterCard('ACT IV · THE UNWRITTEN SECOND', 'The First Second', 'The original activation', 4400);
    await game.shot([14, 9, 18], [0, 2.4, -8], 6.0, { fov: 50 });
    await card;
    await game.say('m22band', 'Location: Test Hall Zero. Nineteenth of October, twenty twenty-six. Oh eight fourteen and nine seconds. Elapsed: none.');
    await game.shot([P.kidMira[0] + 2.4, 1.2, P.kidMira[2] + 2.6], [P.kidMira[0], 1.0, P.kidMira[2]], 2.0, { fov: 34 });
    await game.say('kai', 'Mira. Her hand out to the ring. And me, holding the other one.');
    await convo(witness, [
      ['witness', 'This is it. The first second. I have stood on this floor one thousand and forty-six times.'],
      ['kai', 'You started the experiment.'],
      ['witness', 'I started it again. That is what it does. It starts again, and I stand here, and I stop it.'],
    ]);
    await game.shot([0, 7, 6], [-30, 4, 0], 2.0, { fov: 54 });
    await game.say('kai', 'The walls are gone. There\'s a valley out there. A street. A ward.');
    await game.say('witness', 'Every place I ever tried to stop this. They follow me in.');
    await game.shot([3.4, 2.0, -6.4], [0, 0.4, -14.4], 1.6, { fov: 44 });
    await game.say('m22band', 'Below the ring: a sealed chamber. Lock type: causal. Links required: four.');
    await game.say('witness', 'It wants the reason. I\'ve given it a thousand. Rook. The Continuum. You. It has never opened.');
    await game.say('kai', 'Then you\'ve been giving it the wrong one.');
    await game.say('witness', 'Go on, then. Ask the places. I won\'t come. I\'ve seen them.');
    if (miraAns === 'unsure' || miraAns === 'hand') await game.say('kai', 'She told me not to come to save her. To come to ask. So I\'m asking.');
    S.main = false; cine(false); musicLock = null;
    S.phase = 'explore'; game.checkpoint(...P.start); refresh();
    ui.toast('WEST · THE VALLEY    EAST · HENSEL\'S LANE    SOUTH · WARD 4', 4200);
    hint(() => S.phase === 'explore' && S.zone === 'hub' && G.links.size === 0, 70, () => ui.subtitle('kai', 'The gaps in the walls. West, east, south. Any order.', 2800));
    void trusted; void pictureMat;

    await game.waitFor(() => G.links.has('hand') && !S.busy);
    await openStair();
    await game.waitFor(() => S.done);
  },
};
