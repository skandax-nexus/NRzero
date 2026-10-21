// MISSION 15 · THE CITY THAT FORGOT TOMORROW (Act III) — memory loss as a societal consequence.
// Bible beats: investigate a train station reliving an evacuation · explore a school reliving its abandonment ·
// investigate a market reliving an undocumented disaster · separate causes, consequences and fabricated evidence in a
// central archive. Quote: "That depends on whether you count the worlds that never finished becoming worlds."
// Ending: the player stabilizes the city or frees it from the loop; later allies and dialogue change.
// Optional: Mara Quill's quest chain "Two Records, One Disaster" (NPC bible, quest chain C), temporal shards, notes to
// tomorrow, side conversations.
// 2196. Sera brings Kai to Harrow Reach, a survivor city that Dr. Anja Vale's Lantern has held in one day, Thursday
// 14 May 2193, for three years. The lock is fraying: three places replay the same minute and a half (LocalLoop tears).
// Shared systems used: src/systems/loops.js (LocalLoop, loopRoutine).
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { CAST, survivorLook } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { glowMat, rng } from '../world/kit.js';
import { LocalLoop, loopRoutine } from '../systems/loops.js';
import { buildHarrow, registerM15Cast, registerM15Themes, musicState, P, SHARDS, NOTES, CARDS, COLS, COL_NAME, RESIDENT, KIDS, TEX, drawRingScreen } from '../world/env_m15.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DTAG = { station: 'HARROW NORTH', school: 'LARKFIELD SCHOOL', market: 'THE SALTMARKET' };
const RINGS = [
  { id: 'station', label: 'RING I · HARROW NORTH', short: 'Harrow North', q: 'Ring I · Harrow North. What really happened at the station?', opts: ['Everyone left on the 08:14', 'The train left early, at 07:56', 'There never was a train'], ok: 1, time: '07:56' },
  { id: 'school', label: 'RING II · LARKFIELD', short: 'Larkfield', q: 'Ring II · Larkfield. What really happened at the school?', opts: ['It closed early for the summer', 'The council ordered it abandoned at 07:40', 'The children never came'], ok: 1, time: '07:40' },
  { id: 'market', label: 'RING III · SALTMARKET', short: 'Saltmarket', q: 'Ring III · the Saltmarket. What really happened in the hall?', opts: ['The roof failed from age', 'Nothing happened', 'The Lantern\'s first ignition aged the iron'], ok: 2, time: '16:40' },
];
const FREE_ORDER = ['school', 'station', 'market'];   // the order the day happened: 07:40, 07:56, 16:40

export default {
  id: 'm15', act: 'ACT III · THE LAST VERSION OF EARTH', title: 'The City That Forgot Tomorrow', sub: 'Harrow Reach · 2196',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM15Cast(); registerM15Themes();
    const seraTrust = F.seraTrust || 0, metSera = !!(F.metSera || F.m10metSera || F.m14metSera || F.m13done);
    try {
      const need = ['anja', 'mara', 'wren', 'okafor', 'tully', 'pip', 'm15teo', 'sera'].filter(id => !ui.portraits[id] && CAST[id]?.look);
      if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]]))));
    } catch (err) { console.warn('m15 portraits', err); }

    const scene = game.newScene({ background: 0xc89a6a, fog: [0xc8a07a, 0.0075], exposure: 1.0, bloom: 0.5, bloomThreshold: 0.86, envIntensity: 0.8, killY: -6, residue: true });
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    const Q = RZ.getQuality(), low = Q === 'low';
    game.onUpdate(dt => RZ.update(dt));
    await tick();

    // ---------- state ----------
    const S = {
      phase: 'intro', obj: '', seen: {}, ev: new Set(), cards: new Set(), sorted: {}, sortMiss: 0, nSorted: 0, allSorted: false,
      tearDone: { station: false, school: false, market: false }, visited: {}, girders: [false, false, false], dug: false,
      shards: 0, notes: 0, mara: 0, maraCompared: false, cylinder: false, cylPlayed: false, museum: false, dual: false,
      busy: false, main: false, choice: null, rings: {}, ringsDone: false, freeNext: 0, resets: 0, lastProgress: 0,
    };
    let mood = 'm15-city', musicLock = null, lookReady = false;
    const L = {};
    T.configure([
      { id: '2049', key: '2', name: 'PRESENT', year: 'CIVIC MUSEUM · 2049', glyph: '◎', color: '#5fe6ff', theme: 'm15-museum', apply: () => { if (lookReady) applyLook(); } },
      { id: '2196', key: '3', name: 'FUTURE', year: 'HARROW REACH · 2196', glyph: '◑', color: '#ffc890', theme: 'm15-city', apply: () => { if (lookReady) applyLook(); } },
    ], '2196');
    T.unlocked = false;

    const W = buildHarrow(game, scene, T);
    game.onUpdate((dt, t) => W.update(dt, t));
    await tick();

    // ---------- light: the lock's late gold (2196), the museum's cool white (2049) ----------
    const envs = {};
    try {
      envs['2196'] = RZ.skyEnvironment(renderer, scene, { preset: 'golden-hour', elevation: 13, azimuth: 235, turbidity: 5, cover: 0.5, apply: false });
      envs['2049'] = RZ.skyEnvironment(renderer, scene, { preset: 'overcast', elevation: 40, azimuth: 160, cover: 0.9, apply: false });
    } catch (err) { console.warn('m15 sky', err); }
    const hemi = new THREE.HemisphereLight(0xffd8b0, 0x2a2420, 0.5); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffc890, 2.0); sun.castShadow = true;
    sun.shadow.mapSize.set(Q === 'high' ? 2048 : low ? 512 : 1024, Q === 'high' ? 2048 : low ? 512 : 1024);
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 170 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    const sunDir = V(-0.7, 0.36, 0.45).normalize();
    const LOOK = {
      '2196': { fog: [0xc8a07a, 0.0075], env: 0.75, hemi: [0xffd8b0, 0x2a2420, 0.5], sun: [0xffc890, 2.0], dir: [-0.7, 0.36, 0.45], exp: 1.0, bg: 0xc89a6a },
      '2049': { fog: [0xd8dce0, 0.006], env: 1.0, hemi: [0xf0f4ff, 0x4a4a4c, 0.95], sun: [0xf4f6ff, 0.6], dir: [0.3, 0.8, 0.3], exp: 1.05, bg: 0xd0d4d8 },
    };
    function applyLook() {
      const e = T.current, L = LOOK[e] || LOOK['2196'];
      scene.fog.color.set(L.fog[0]); scene.fog.density = L.fog[1];
      const env = envs[e];
      if (env) { scene.environment = env.envMap; scene.environmentIntensity = L.env; scene.background = env.background || new THREE.Color(L.bg); } else scene.background = new THREE.Color(L.bg);
      hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
      sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; sunDir.set(...L.dir).normalize();
      renderer.toneMappingExposure = L.exp;
      audio.wind(e === '2196' ? 0.12 : 0); audio.hum(e === '2049' ? 0.03 : 0.015, e === '2049' ? 60 : 48); audio.crowd?.(e === '2196' ? 0.04 : 0);
      lightT = 0; music();
    }
    let lightT = 0;
    const rigLights = () => {
      const p = game.cine ? game.engine.camera.position : pl.pos, e = T.current;
      const list = W.lightSrc.filter(s => s.era === e || s.era === 'all').map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      pts.forEach((l, i) => { const s = list[i]; if (!s || s.dd > 45 * 45) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
    };
    game.onUpdate(dt => {
      const p = game.cine ? game.engine.camera.position : pl.pos;
      sun.target.position.set(p.x, 0, p.z); sun.position.set(p.x + sunDir.x * 80, sunDir.y * 80 + 4, p.z + sunDir.z * 80);
      lightT -= dt; if (lightT <= 0) { lightT = 0.4; rigLights(); }
    });
    T.onSwitch(() => { lightT = 0; });

    // ---------- helpers ----------
    const near = (x, z, r) => Math.hypot(pl.pos.x - x, pl.pos.z - z) < r;
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag) => { S.ev.add(title); ui.addEvidence(title, text, tag); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const choose = (id, text, opts, correct = 0) => { if (game.autoplay) game.autoChoice = game.autoQueue?.length ? game.autoQueue.shift() : correct; return game.choice(id, text, opts); };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive || S.busy) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u)); if (u >= 1) { off(); res(); } }); });
    const side = async (fn) => {
      if (S.busy || !game.control) return; S.busy = true;
      try { await fn(); } catch (err) { if (!err?.abort) console.warn('m15 side', err); else throw err; } finally { S.busy = false; if (!S.main) { game.control = true; ui.letterbox(false); game.releaseCam(); } }
    };
    const kai = pl.char;
    const inArchive = (p = pl.pos) => p.x > -19.6 && p.x < 19.6 && p.z > -45.6 && p.z < -10.4;
    const region = (p = pl.pos) => p.x < -49.5 ? 'station' : (p.x > 35.5 && p.z < 8.6 && p.z > -37) ? 'school' : (Math.abs(p.x) < 24 && p.z > 30 && p.z < 71) ? 'market' : inArchive(p) ? 'archive' : 'city';
    const progress = () => { S.lastProgress = game.time; };

    // era switching: the Civic Museum (2049) is the only other signature inside the lock, and never into a wall
    const solidAt = (id) => {
      const p = pl.pos, y0 = p.y + 0.45, y1 = p.y + 1.6;
      for (const b of game.collision.boxes) {
        if (!b.enabled || (b.states && !b.states.includes(id)) || b.walkOnly) continue;
        if (!(p.x > b.min.x - 0.28 && p.x < b.max.x + 0.28 && p.z > b.min.z - 0.28 && p.z < b.max.z + 0.28)) continue;
        if (b.max.y > y0 && b.min.y < y1) return true;
      }
      return false;
    };
    const baseCan = T.canSwitch.bind(T);
    T.canSwitch = (id) => {
      if (!baseCan(id)) return false;
      if (id === '2049' && !inArchive()) { if (once('no49' + Math.floor(game.time / 4))) { ui.toast('THE LOCK HOLDS THIS STREET IN ONE DAY · NO OTHER SIGNATURE HERE', 2200); audio.sfxPlay('fail'); } return false; }
      if (solidAt(id)) { if (once('solid' + id + Math.floor(game.time / 3))) { ui.toast(`SOLID HERE IN ${id} · MOVE TO OPEN FLOOR`, 1800); audio.sfxPlay('fail'); } return false; }
      return true;
    };

    // ---------- music follows the beats and the place ----------
    let curTheme = null;
    const themeFor = () => {
      if (musicLock) return musicLock;
      if (T.current === '2049') return 'm15-museum';
      const r = region();
      if (r === 'market' && L.market && L.market.t > 58 && L.market.t < 84 && Math.abs(pl.pos.x) < 22.5 && pl.pos.z > 39) return 'm15-wave';
      if (r === 'station' || r === 'school' || r === 'market') return 'm15-tear';
      if (r === 'archive' && pl.pos.x < -12.2 && S.mara > 0) return 'm15-mara';
      if (r === 'archive' && (S.phase === 'archive' || S.phase === 'tears')) return 'm15-archive';
      return mood;
    };
    function music(fade = 1.6) { const th = themeFor(); for (const d of T.defs) d.theme = d.id === '2049' ? (musicLock || 'm15-museum') : th; if (th !== curTheme) { curTheme = th; audio.setTheme(th, fade); } }
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    let musT = 0; game.onUpdate(dt => { musT -= dt; if (musT <= 0) { musT = 0.5; music(); } });
    lookReady = true; applyLook();

    // conversations: turn both people to each other, then an over-the-shoulder shot of whoever speaks
    const posOf = (ch) => (ch === kai ? pl.pos : ch.root.position);
    const faceEach = (a, b) => {
      const pa = posOf(a), pb = posOf(b), ya = Math.atan2(pb.x - pa.x, pb.z - pa.z), yb = Math.atan2(pa.x - pb.x, pa.z - pb.z);
      if (a === kai) { pl.yaw = ya; kai.root.rotation.y = ya; } else a.root.rotation.y = ya;
      if (b === kai) { pl.yaw = yb; kai.root.rotation.y = yb; } else b.root.rotation.y = yb;
      a.lookTarget = b.head; b.lookTarget = a.head;
    };
    const ots = (speaker, listener, dur = 1.0, fov = 36, sideOff = 0.7) => {
      const sp = posOf(speaker), l = posOf(listener), dx = sp.x - l.x, dz = sp.z - l.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
      const small = speaker === pip || speaker === teo, sd = sideOff + Math.max(0, 2.2 - d) * 0.45, back = 1.35;
      const sy = small ? 1.12 : speaker === mara ? 1.48 : 1.58, ly = l.y + (small ? 1.3 : speaker === mara ? 1.56 : 1.66);
      return game.shot([l.x - ux * back + uz * sd, ly, l.z - uz * back - ux * sd], [sp.x, sp.y + sy, sp.z], dur, { fov });
    };
    const convo = async (other, lines) => {
      if (other) {   // keep a conversational distance so the over-the-shoulder shots can see both faces
        const o = other.root.position, dx = pl.pos.x - o.x, dz = pl.pos.z - o.z, d = Math.hypot(dx, dz);
        if (d < 1.55 && d > 0.01 && Math.abs(pl.pos.y - o.y) < 0.5) pl.place(o.x + dx / d * 1.7, pl.pos.y, o.z + dz / d * 1.7, pl.yaw);
      }
      faceEach(kai, other);
      for (const [id, line] of lines) {
        const sp = id === 'kai' ? kai : (other && CAST[id] && !CAST[id].voice ? other : null);
        if (sp && other) await ots(sp, sp === kai ? other : kai, 0.8);
        await game.say(id, line);
      }
      kai.lookTarget = null; if (other) other.lookTarget = null;
    };
    const walkTo = (ch, path, speed = 1.4) => new Promise(res => {
      let i = 0;
      const off = game.onUpdate(dt => {
        const p = ch.root.position, t = path[i]; const dx = t[0] - p.x, dz = t[2] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { i++; if (i >= path.length) { ch.speed = 0; off(); res(); } return; }
        const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st; p.y += (t[1] - p.y) * Math.min(1, dt * 5);
        let dy = Math.atan2(dx, dz) - ch.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.root.rotation.y += dy * Math.min(1, dt * 8); ch.speed = speed;
      });
    });
    let shiftPulse = 0;
    game.onUpdate(dt => { if (shiftPulse > 0 && game.engine.fx?.uShift) { shiftPulse = Math.max(0, shiftPulse - dt * 1.2); game.engine.fx.uShift.value = shiftPulse * 0.6; } });
    // an interactable that stays until done() (guards against use while busy or out of its conditions)
    const act = (o) => {
      const it = game.interact({ radius: 1.8, ...o, once: false, onUse: (x) => { if (S.busy || game._failing) return; if (o.enabled && !o.enabled()) return; if (o.states && !o.states.includes(T.current)) return; o.onUse(x); } });
      it.done = () => game.removeInteract(it);
      return it;
    };

    // ---------- people (all of them live in 2196: the museum of 2049 is empty) ----------
    const people = [];
    const person = (ch) => { people.push(ch); return ch; };
    game.onUpdate(() => { const on = T.current === '2196'; for (const ch of people) if (ch.root.visible !== (on && !ch.hidden)) ch.root.visible = on && !ch.hidden; });
    const sera = person(game.actor('sera', { ...CAST.sera.look, era: '2196' }, 73.6, 0, 11.4, -Math.PI / 2));
    const anja = person(game.actor('anja', null, 3.4, 0, -25.6, Math.PI));
    await tick();
    const mara = person(game.actor('mara', null, -12.9, 0, -18.4, Math.PI / 2)); mara.pose = 'look';
    const wren = person(game.actor('wren', null, ...P.wrenGate, -Math.PI / 2));
    await tick();
    const okafor = person(game.actor('okafor', null, ...P.okDesk, Math.PI / 2));
    const tully = person(game.actor('tully', null, ...P.tully, Math.PI));
    await tick();
    const pip = person(game.actor('pip', null, ...P.pip, -Math.PI / 2)); pip.pose = 'look';
    const teo = person(game.actor('m15teo', null, 6.4, 0, 15.6, -2.4));
    await tick();
    const R = rng(1515);
    const resLook = (i, seed) => ({ ...survivorLook(R), ...RESIDENT[i % RESIDENT.length], seed, female: !!RESIDENT[i % RESIDENT.length].female, skin: [0xa77a5d, 0x6b4029, 0xd8b08e, 0xe0b8a0, 0x8c5a3a, 0xc49a7c][i % 6], lod: true });
    const amb = (look, x, y, z, ry) => person(game.ambient(look, x, y, z, ry));

    // ---------- the three tears (LocalLoop): the same minute and a half, again and again ----------
    const loopActors = { station: [], school: [], market: [] };
    const pauseLoop = (k, on) => { L[k].paused = on; if (on) for (const a of loopActors[k]) a.speed = 0; };
    L.station = new LocalLoop(game, { id: 'm15station', label: 'HARROW NORTH · TEAR', duration: 90, clock: 8 * 3600 + 12 * 60, restart: [-53, 0, 0, -Math.PI / 2], region: p => p.x < -49.5, resetToast: 'THE TEAR REWINDS · YOU KEEP WHAT YOU LEARNED' });
    L.school = new LocalLoop(game, { id: 'm15school', label: 'LARKFIELD · TEAR', duration: 80, clock: 10 * 3600 + 29 * 60, restart: [53.6, 0, -20, Math.PI / 2], region: p => p.x > 35.5 && p.z < 8.6 && p.z > -37, resetToast: 'THE TEAR REWINDS · YOU KEEP WHAT YOU LEARNED' });
    L.market = new LocalLoop(game, { id: 'm15market', label: 'SALTMARKET · TEAR', duration: 90, clock: 16 * 3600 + 39 * 60, restart: [0, 0, 36.4, 0], region: p => Math.abs(p.x) < 24 && p.z > 30 && p.z < 71, resetToast: 'THE TEAR REWINDS · YOU KEEP WHAT YOU LEARNED' });
    for (const k of ['station', 'school', 'market']) L[k].onReset(() => { S.resets++; F.m15resets = S.resets; });
    const inRegion = (k) => region() === k && T.current === '2196';
    const pa = (line) => { if (inRegion('station')) ui.subtitle('m15pa', line, 3600); };

    // --- Harrow North: the crowd goes through the gates to Platform Two for a train that left at 07:56 ---
    {
      const lanes = [-3.6, -1.2, 1.2, 3.6], lp = L.station;
      for (let i = 0; i < 8; i++) {
        const ln = lanes[i % 4], d = i * 1.5, sx = -60 - (i % 3) * 3.2, sz = -9 + i * 2.3, wx = -81.6 - (i % 2) * 2.2, wz = -9 + i * 2.4;
        const ch = amb(resLook(i, 1500 + i), sx, 0, sz, -Math.PI / 2); loopActors.station.push(ch);
        loopRoutine(lp, ch, [
          { t: 0, pos: [sx, 0, sz], ry: -Math.PI / 2, hold: true }, { t: 12 + d, pos: [sx, 0, sz] },
          { t: 17 + d, pos: [-74.4, 0, ln] }, { t: 18.6 + d, pos: [-77.4, 0, ln] }, { t: 23 + d, pos: [wx, 0, wz], ry: -Math.PI / 2, hold: true },
          { t: 64 + d * 0.5, pos: [wx, 0, wz], ry: -Math.PI / 2, pose: 'look' }, { t: 68 + d * 0.5, pos: [-77.4, 0, ln] }, { t: 69.6 + d * 0.5, pos: [-74.4, 0, ln] },
          { t: 76 + d * 0.5, pos: [sx, 0, sz], ry: -Math.PI / 2, hold: true },
        ]);
        if (i % 3 === 2) await tick();
      }
      loopActors.station.push(wren);
      loopRoutine(lp, wren, [
        { t: 0, pos: P.wrenGate, ry: -Math.PI / 2, hold: true }, { t: 46, pos: P.wrenGate }, { t: 47.4, pos: [-74.4, 0, -3.6] }, { t: 48.6, pos: [-77.4, 0, -3.6] },
        { t: 53, pos: [-78, 0, -39.6] }, { t: 57.4, pos: [-78, 3.6, -50.6] }, { t: 58.6, pos: [-78.6, 3.6, -53.2] }, { t: 60.6, pos: [-82.4, 3.6, -56.2], ry: Math.PI, pose: 'work', hold: true },
      ]);
      // the signal box door: open while Wren goes in (57.6 .. 62)
      const door = W.doors.signal;
      let doorOpen = false;
      S.sigInside = false;
      const setDoor = (open) => { if (open === doorOpen) return; doorOpen = open; door.col.enabled = !open; door.mesh.rotation.y = open ? -1.4 : 0; door.mesh.position.set(open ? -79.5 : -78.6, 3.6 + 1.15, open ? -52.9 : -52); if (open) audio.sfxPlay('door'); };
      W.setSigDoor = setDoor;
      game.onUpdate(() => { const t = lp.t; const inside = pl.pos.y > 3.2 && pl.pos.z < -52.2 && pl.pos.x < -76 && pl.pos.x > -86; S.sigInside = inside; if (!S.sigDoorHeld) setDoor(t > 57.6 && t < 62); });
      lp.at(6, () => pa('Attention, please. All residents to Platform Two. Walk. Do not run.'), { learn: ['pa', '08:12:06 · The PA sends everyone to Platform Two'], when: () => inRegion('station') });
      lp.at(12, () => {}, { learn: ['surge', '08:12:12 · The crowd floods the gates for twenty seconds'], when: () => inRegion('station') });
      lp.at(28, () => pa('The 08:14 coast service is approaching Platform Two.'), { learn: ['train', '08:12:36 · An echo train runs the track bed to :44'], when: () => inRegion('station'), warn: true });
      lp.at(46, () => {}, { learn: ['wren', '08:12:46 · Wren climbs to the signal box · door open :58 to :62'], when: () => inRegion('station') && pl.pos.x < -60 });
      lp.at(60, () => { pa('The 08:14 coast service has departed. There are no further services today.'); if (inRegion('station') && near(P.pip[0], P.pip[2], 14)) ui.subtitle('pip', 'He said Platform Two. He said wait.', 3000); }, { learn: ['gone', '08:13:00 · "Departed." Nobody boarded.'], when: () => inRegion('station') });
      // the crowd pushes back anyone standing in the gates while it surges
      lp.hazard(() => {
        const t = lp.t, inGate = pl.pos.x > -77.6 && pl.pos.x < -74.2 && Math.abs(pl.pos.z) < 6;
        if (inGate && ((t > 15 && t < 31) || (t > 66 && t < 78))) {
          const back = t < 40 ? -72.6 : -79.2; pl.pos.x = back; pl.vel?.set?.(0, 0, 0); game.shake = 0.15;
          if (once('push' + Math.floor(game.time / 3))) { ui.toast('THE CROWD CARRIES YOU BACK · WAIT FOR IT TO PASS', 2000); audio.sfxPlay('metal'); }
        }
        return false;
      });
      // the echo train: stands at 26..36, runs north 36..44 (the track bed is deadly while it runs)
      game.onUpdate(() => {
        const t = lp.t, tr = W.train;
        if (t >= 26 && t < 46) { tr.visible = true; const k = t < 36 ? 0 : (t - 36) / 8; tr.position.z = 10 - k * k * 170; } else tr.visible = false;
      });
      lp.hazard(() => {
        const t = lp.t; if (t < 36 || t > 44.5) return false;
        const z = W.train.position.z;
        if (pl.pos.y < -0.5 && pl.pos.x > -93.6 && pl.pos.x < -86.4 && pl.pos.z < z + 10 && pl.pos.z > z - 48) return 'THE ECHO TRAIN TAKES YOU WITH IT';
        return false;
      });
      lp.onReset(() => { setDoor(false); });
    }

    // --- Larkfield: the class is led out at 10:29 every time; the corridor tear pulses every seven seconds ---
    {
      const lp = L.school;
      const out = [[59, 0, -17], [59, 0, -20], [52.6, 0, -20], [46, 0, -16], [43, 0, 6]];
      loopActors.school.push(okafor);
      loopRoutine(lp, okafor, [
        { t: 0, pos: P.okDesk, ry: Math.PI / 2, hold: true }, { t: 9, pos: P.okDesk }, { t: 11, pos: [59, 0, -17] }, { t: 12, pos: [59, 0, -20] }, { t: 16, pos: [73, 0, -20] },
        { t: 17, pos: [73, 0, -16] }, { t: 19, pos: [76.6, 0, -11.8], ry: Math.PI / 2, pose: 'work', hold: true }, { t: 22, pos: [76.6, 0, -11.8] }, { t: 24, pos: [73, 0, -16] }, { t: 25, pos: [73, 0, -20] },
        { t: 29, pos: [59, 0, -20] }, { t: 30, pos: [59, 0, -17] }, { t: 33, pos: [56.4, 0, -12.4], ry: Math.PI / 2, hold: true },
        { t: 38, pos: [56.4, 0, -12.4] }, { t: 40, pos: out[0] }, { t: 41, pos: out[1] }, { t: 44, pos: out[2] }, { t: 47, pos: out[3] }, { t: 55, pos: out[4] }, { t: 56, pos: [43, 0, 9.2], ry: Math.PI, pose: 'look', hold: true },
        { t: 66, pos: [43, 0, 9.2] }, { t: 67, pos: out[4] }, { t: 74, pos: out[3] }, { t: 76.4, pos: out[2] }, { t: 78, pos: out[1] }, { t: 78.6, pos: out[0] }, { t: 79.6, pos: [55, 0, -10.4], ry: Math.PI / 2, pose: 'sad', hold: true },
      ]);
      const desks = [[58, -14.4], [60, -12.6], [62, -14.4], [58, -10.8], [62, -9.0], [64, -12.6]];
      for (let i = 0; i < 6; i++) {
        const [dx, dz] = desks[i], d = (i + 1) * 0.9, lk = { ...KIDS[i % 2], seed: 1550 + i, skin: [0x8c5a3a, 0xe0b394, 0x6b4029, 0xd9a585, 0xb98463, 0xe8c0a0][i], hair: [0x0e0a08, 0x5a3a22, 0x0e0a08, 0x8a6a4a, 0x2a1c14, 0x3a2418][i], height: 1.24 + (i % 3) * 0.06 };
        const ch = amb(lk, dx + 0.8, 0, dz, Math.PI / 2); loopActors.school.push(ch);
        loopRoutine(lp, ch, [
          { t: 0, pos: [dx + 0.8, 0, dz], ry: Math.PI / 2, hold: true }, { t: 34 + i * 0.3, pos: [dx + 0.8, 0, dz] }, { t: 37 + i * 0.3, pos: [59.0, 0, -15.6 + i * 0.62], ry: Math.PI, hold: true },
          { t: 38 + d, pos: [59.0, 0, -15.6 + i * 0.62] }, { t: 40 + d, pos: [59.2, 0, -17] }, { t: 41 + d, pos: [59, 0, -20] }, { t: 44 + d, pos: [52.6, 0, -20] }, { t: 47 + d, pos: [46, 0, -16] },
          { t: 55 + d, pos: [41.4 + (i % 3) * 1.1, 0, 10.6 + (i >> 1) * 0.9], ry: -Math.PI / 2, hold: true }, { t: 64 + i * 0.4, pos: [41.4 + (i % 3) * 1.1, 0, 10.6 + (i >> 1) * 0.9] },
          { t: 76 + i * 0.4, pos: [28 - i, 0, 13.4 + (i % 2)], hold: true },
        ]);
      }
      await tick();
      // the office door: locked until Okafor opens it at 10:29:16, then left open until the tear rewinds
      const od = W.doors.office; let open = false;
      const setOffice = (o) => { if (o === open) return; open = o; od.col.enabled = !o; od.mesh.rotation.y = o ? 1.4 : 0; od.mesh.position.set(o ? 72.1 : 73, 1.2, o ? -17.1 : -18); if (o) audio.sfxPlay('door'); };
      W.setOffice = setOffice;
      game.onUpdate(() => { if (!S.officeHeld) setOffice(lp.t > 16.4); });
      lp.at(8, () => { if (inRegion('school')) { audio.sfxPlay('motif'); ui.subtitle('okafor', 'That\'s the bell. Coats on, everyone. Quickly now.', 2800); } }, { learn: ['bell', '10:29:08 · The bell. Ms Okafor goes to the office'], when: () => inRegion('school') });
      lp.at(16.4, () => {}, { learn: ['office', '10:29:16 · The office door opens, and stays open'], when: () => inRegion('school') && pl.pos.z < -6 });
      lp.at(38, () => { if (inRegion('school')) ui.subtitle('okafor', 'Hold hands. Don\'t look back. We\'re going to the Archive.', 3000); }, { learn: ['line', '10:29:38 · She leads them out to the gate'], when: () => inRegion('school') });
      lp.at(57, () => { if (inRegion('school') && pl.pos.z > -8) ui.subtitle('okafor', '...thirteen, fourteen, fifteen. Fifteen. Good.', 3000); }, { learn: ['count', '10:29:57 · She counts fifteen at the gate'], when: () => inRegion('school') });
      // the fray in the corridor: 1.2 s of warning, 1.2 s of ageing, every seven seconds
      const phase = () => lp.t % 7;
      game.onUpdate(() => {
        const ph = phase(), warnK = ph > 4.4 && ph < 5.6 ? (ph - 4.4) / 1.2 : 0, pulse = ph >= 5.6 && ph < 6.8;
        W.fray.material.opacity = pulse ? 0.55 : 0.04 + warnK * 0.22; W.frayFloor.material.opacity = pulse ? 0.9 : 0.25 + warnK * 0.4;
        if (pulse && once('frayS' + Math.floor(lp.t / 7) + '_' + lp.iteration) && inRegion('school') && near(65.75, -20, 12)) audio.sfxPlay('rewind');
      });
      lp.hazard(() => {
        const ph = phase();
        if (ph >= 5.75 && ph < 6.8 && pl.pos.x > 63 && pl.pos.x < 68.5 && pl.pos.z > -22 && pl.pos.z < -18) return 'THE TEAR AGES THE CORRIDOR TEN YEARS · AND YOU WITH IT';
        if (pl.pos.x > 55 && pl.pos.x < 72 && pl.pos.z > -22 && pl.pos.z < -18 && once('frayLearn')) lp.learn('fray', 'The corridor tear pulses every 7 s: go just after one');
        return false;
      });
      lp.onReset(() => { setOffice(false); });
    }

    // --- the Saltmarket: at 16:40:12 the iron ages a century in one second; everybody runs from a roof already gone ---
    {
      const lp = L.market;
      const stalls = [[-12.8, 46.6], [-12.8, 52.4], [-7.2, 58.8], [-12.6, 60.4], [-2.6, 52.4], [1.0, 47.4], [-7.4, 64.8]];
      for (let i = 0; i < 7; i++) {
        const [x, z] = stalls[i], ox = -8 + i * 2.6, oz = 33 + (i % 3) * 1.6;
        const ch = amb(resLook(i + 3, 1580 + i), x, 0, z, i * 1.3); loopActors.market.push(ch);
        const wander = [x + (i % 2 ? 1.4 : -1.2), 0, z + (i % 3) - 1];
        loopRoutine(lp, ch, [
          { t: 0, pos: [x, 0, z], ry: i * 1.3, hold: true }, { t: 18 + i * 3, pos: [x, 0, z] }, { t: 24 + i * 3, pos: wander, ry: -i, hold: true },
          { t: 40 + i * 2, pos: wander }, { t: 46 + i * 2, pos: [x, 0, z], ry: i * 1.3, hold: true },
          { t: 66, pos: [x, 0, z], pose: 'look', hold: true }, { t: 68, pos: [x, 0, z] }, { t: 70.6 + i * 0.2, pos: [Math.max(-3, Math.min(3, x * 0.3)), 0, 41.5] }, { t: 73 + i * 0.3, pos: [ox, 0, oz], ry: 0, pose: 'look', hold: true },
        ]);
        if (i % 3 === 2) await tick();
      }
      loopActors.market.push(tully);
      loopRoutine(lp, tully, [
        { t: 0, pos: P.tully, ry: Math.PI, hold: true }, { t: 66, pos: P.tully, ry: Math.PI, pose: 'look', hold: true }, { t: 68, pos: P.tully }, { t: 70.4, pos: [-1.6, 0, 41.5] }, { t: 72.6, pos: [-1.4, 0, 35.2], ry: 0, pose: 'look', hold: true },
      ]);
      lp.at(52, () => { if (inRegion('market')) { audio.sfxPlay('motif'); ui.subtitle('tully', 'Hear that? The hall bell. Means nothing.', 2600); } }, { learn: ['bell52', '16:39:52 · The hall bell'], when: () => inRegion('market') });
      lp.at(60, () => { if (inRegion('market')) { audio.sfxPlay('metal'); game.shake = 0.12; } }, { learn: ['groan', '16:40:00 · The iron groans'], when: () => inRegion('market') });
      lp.at(68, () => { if (inRegion('market')) ui.subtitle('m15resf', 'The roof! Out — get out!', 2200); }, { learn: ['run', '16:40:08 · Everyone runs for the north door'], when: () => inRegion('market') });
      lp.at(72, () => { W.waveT = 0; if (inRegion('market')) { audio.sfxPlay('boom'); game.shake = 0.3; } }, { learn: ['wave', '16:40:12 · The ageing wave fills the hall · be outside'], when: () => inRegion('market'), warn: true });
      W.waveT = -1;
      game.onUpdate(dt => {
        if (W.waveT >= 0) {
          W.waveT += dt; const k = W.waveT / 2.6, r = 1 + k * 34;
          W.wave.scale.setScalar(r); W.wave.material.opacity = Math.max(0, 0.75 - k * 0.6);
          W.dust.material.opacity = Math.max(0, 0.4 * Math.sin(Math.min(1, W.waveT / 5) * Math.PI)); W.dust.scale.set(6 + W.waveT * 3, 3 + W.waveT, 6 + W.waveT * 3);
          if (k > 1.6 && W.waveT > 5) { W.waveT = -1; W.wave.material.opacity = 0; W.dust.material.opacity = 0; }
        }
      });
      lp.hazard(() => {
        if (W.waveT < 0 || W.waveT > 2.8) return false;
        const r = 1 + (W.waveT / 2.6) * 34, d = Math.hypot(pl.pos.x - P.epic[0], pl.pos.z - P.epic[2]);
        if (Math.abs(pl.pos.x) < 22 && pl.pos.z > 40.2 && pl.pos.z < 70 && d < r) return 'THE IRON AGES A CENTURY IN ONE SECOND · AND SO DO YOU';
        return false;
      });
    }
    window.__m15 = { S, W, L, T, P, anja, mara, wren, okafor, tully, pip, sera, teo };

    // ---------- the records (cards) ----------
    const cardOf = (id) => CARDS.find(c => c.id === id);
    const nCards = (d) => CARDS.filter(c => c.d === d && S.cards.has(c.id)).length;
    const gotCard = (id) => {
      if (S.cards.has(id)) return; const c = cardOf(id); S.cards.add(id); progress();
      ev(c.title, c.text, DTAG[c.d] + ' · ' + nCards(c.d) + '/3');
      W.cardMeshes[id].visible = true; audio.sfxPlay('pickup');
      F.m15cards = S.cards.size; refreshObjective();
    };

    // ---------- objectives ----------
    function refreshObjective() {
      if (S.phase !== 'tears') return;
      const r = region(), mark = (d) => S.tearDone[d] ? ' ✓' : ` ${nCards(d)}/3`;
      if (r === 'station' && !S.tearDone.station) objective(nCards('station') < 3 ? `Harrow North: find what the station relives (records ${nCards('station')}/3)` : 'Harrow North: read the tear on Platform Two, where Pip waits');
      else if (r === 'school' && !S.tearDone.school) objective(nCards('school') < 3 ? `Larkfield School: find what the school relives (records ${nCards('school')}/3)` : 'Larkfield: read the tear at the yard gate');
      else if (r === 'market' && !S.tearDone.market) objective(nCards('market') < 3 ? `The Saltmarket: find what the hall relives (records ${nCards('market')}/3)` : 'The Saltmarket: read the tear at the crossing of the lines');
      else objective(`Read the three tears · Station (west)${mark('station')} · School (east)${mark('school')} · Market (south)${mark('market')}`);
    }
    let objT = 0; game.onUpdate(dt => { objT -= dt; if (objT <= 0) { objT = 0.8; refreshObjective(); } });

    // ---------- first visit to each tear: a staged look and the band's reading ----------
    const firstVisit = (k) => side(async () => {
      S.visited[k] = true; progress(); cine(true);
      if (k === 'station') {
        game.checkpoint(-53, 0, 0, -Math.PI / 2);
        await game.shot([-54, 4.2, 9], [-75, 1.4, -2], 2.4, { fov: 50 });
        await game.say('m15band', 'Tear detected. Harrow North. Repeat: ninety seconds, from 08:12.');
        await game.shot([-70, 2.0, 7], [-82, 1.3, 3], 2.0, { fov: 40 });
        await game.say('kai', 'Same minute and a half. The same crowd at the same gates, for a train that isn\'t coming.');
      } else if (k === 'school') {
        game.checkpoint(44, 0, 6, -Math.PI / 2 + 0.3);
        await game.shot([38, 3.4, 4], [52, 2.6, -20], 2.4, { fov: 48 });
        await game.say('m15band', 'Tear detected. Larkfield School. Repeat: eighty seconds, from 10:29.');
        await game.shot([45, 1.7, -8], [52, 2.2, -20], 1.8, { fov: 40 });
        await game.say('kai', 'A school on a Thursday morning. Leaving, every eighty seconds.');
      } else {
        game.checkpoint(0, 0, 36.4, 0);
        await game.shot([-6, 5.5, 34], [6, 3, 58], 2.6, { fov: 50 });
        await game.say('m15band', 'Tear detected. Saltmarket Hall. Repeat: ninety seconds, from 16:39.');
        await game.shot([3, 2.0, 38], [8, 4, 60], 1.8, { fov: 42 });
        await game.say('kai', 'Half a roof, and they\'re selling pears under it. Nobody\'s written down what happened here.');
      }
      cine(false);
    });
    game.onUpdate(() => {
      if (S.phase !== 'tears' || S.busy || !game.control || ui.dlgActive || T.current !== '2196') return;
      const r = region();
      if ((r === 'station' && pl.pos.x < -51) || (r === 'school' && pl.pos.x < 50 && pl.pos.z < 7) || (r === 'market' && pl.pos.z > 34)) if (!S.visited[r]) firstVisit(r);
    });

    // ================= Harrow North: interactions =================
    act({ pos: [P.depBoard[0], 1.6, P.depBoard[2]], radius: 3.2, prompt: 'Read the departure board', states: ['2196'], onUse: (it) => side(async () => {
      it.done(); ev('Departure board, Harrow North', '"08:14 · COAST SERVICE · ALL STOPS · PLATFORM 2 · ON TIME." It has been on time for three years. "Today: Thursday 14 May 2193."', DTAG.station);
      await game.say('kai', 'Eight-fourteen, on time. It\'s been on time for three years.'); L.station.learn('board', 'The board: 08:14 from Platform Two, "on time"');
    }) });
    act({ pos: [P.notice[0], 1.4, P.notice[2]], radius: 2.0, prompt: 'Read the council notice', states: ['2196'], onUse: (it) => side(async () => {
      it.done(); cine(true); await game.shot([-55.4, 1.7, 13.0], [-55.4, 1.6, 15.6], 0.8, { fov: 40 });
      await game.say('kai', 'Posted the fifteenth of May. In a city where the fifteenth never comes.'); gotCard('st_fake');
    }) });
    act({ pos: [P.pip[0] + 0.6, 1, P.pip[2]], radius: 2.0, prompt: 'Talk to the girl on the platform', states: ['2196'], onUse: (it) => side(async () => {
      it.done(); cine(true); pip.pose = null;
      await convo(pip, [
        ['pip', 'Are you here for the eight-fourteen? I\'m first in the queue.'],
        ['kai', 'Who are you waiting for?'],
        ['pip', 'My dad. He drives it. He said, Platform Two, eight-fourteen, I\'ll come back for you.'],
        ['pip', 'He gave me his pass to hold. So he has to come back for it.'],
      ]);
      await game.shot([P.pip[0] + 1.2, 1.1, P.pip[2] + 0.6], [P.pip[0] + 0.3, 0.9, P.pip[2] - 0.1], 1.2, { fov: 30 });
      await game.say('kai', 'Driver R. Ashe. Departs seven fifty-six. Platform One.');
      await convo(pip, [['kai', 'Can I borrow this, Pip? I\'ll bring it back.'], ['pip', 'Before eight-fourteen?'], ['kai', '...Before tomorrow.']]);
      pip.pose = 'look'; pip.root.rotation.y = -Math.PI / 2; F.m15pip = true; gotCard('st_cons');
    }) });
    // the signal box: the log on the desk, Wren
    act({ pos: [P.sigDoor[0], 4.6, P.sigDoor[2] + 0.4], radius: 1.6, prompt: 'Try the signal box door', states: ['2196'], enabled: () => !S.sigInside && W.doors.signal.col.enabled, onUse: () => {
      if (once('doorTry' + Math.floor(game.time / 6))) { ui.subtitle('kai', L.station.knows('wren') ? 'Locked. Wren opens it at fifty-eight past. I need to be here then.' : 'Locked. Somebody has the key.', 2800); audio.sfxPlay('metal'); }
    } });
    act({ pos: [-78.6, 4.6, -53.4], radius: 1.4, prompt: 'Open the door from inside', states: ['2196'], enabled: () => S.sigInside && W.doors.signal.col.enabled, onUse: () => { S.sigDoorHeld = true; W.setSigDoor(true); setTimeout(() => { S.sigDoorHeld = false; }, 4000); } });
    act({ pos: [P.sigLog[0], 4.6, P.sigLog[2]], radius: 2.4, prompt: 'Read the signal log', states: ['2196'], enabled: () => S.sigInside, onUse: (it) => side(async () => {
      it.done(); cine(true); pauseLoop('station', true);
      await game.shot([-81.2, 5.4, -55.6], [-82.5, 3.9, -57.2], 1.0, { fov: 38 });
      await game.say('kai', 'Seven fifty-six. "Sent the coast service early from Platform One. Two hundred and twelve aboard. Could not hold it."');
      const wasIn = wren.root.position.y > 3; wren.root.position.set(-79.0, 3.6, -53.6); wren.root.rotation.y = Math.PI; wren.pose = null; wren.speed = 0;
      if (!wasIn) { audio.sfxPlay('door'); await game.wait(0.4); }
      pl.place(-81.6, 3.6, -56.0, 0);
      await convo(wren, [
        ['wren', 'Who— you shouldn\'t be up here. First time in Harrow?'],
        ['kai', 'Seven fifty-six. You sent the train early.'],
        ['wren', 'The line was going. The rails ahead were forgetting they were rails. If I\'d held it, nobody would have left.'],
        ['kai', 'And Platform Two?'],
        ['wren', 'I announced it anyway. Every morning I announce it, and every morning I think I\'ve made a mistake. Then the day ends.'],
        ['wren', S.cards.has('st_cons') ? 'You\'ve got Ashe\'s pass. Then you\'ve met Pip. Don\'t tell her. Not today.' : 'There\'s a girl on Two waiting for her dad. Don\'t tell her. Not today.'],
      ]);
      F.m15wren = 'talked'; gotCard('st_cause');
      pauseLoop('station', false);
    }) });
    act({ pos: [-85.4, 1.2, 0], radius: 10, prompt: 'Read the echo train', states: ['2196'], enabled: () => game.residueOn && W.train.visible, onUse: (it) => side(async () => {
      it.done(); progress();
      ev('The echo train', 'In Residue Vision the echo on the track carries its own board: "07:56 COAST · P1". An echo from earlier that morning, running through the tear.', DTAG.station);
      await game.say('kai', 'Seven fifty-six, Platform One. The train was real. It just left before anyone was told.');
    }) });
    act({ pos: [P.tearSt[0], 1, P.tearSt[2]], radius: 2.4, prompt: 'Read the tear (Harrow North)', states: ['2196'], enabled: () => nCards('station') === 3, onUse: (it) => side(async () => {
      it.done(); await readTear('station');
    }) });

    // ================= Larkfield: interactions =================
    act({ pos: [P.register[0], 1.2, P.register[2]], radius: 1.8, prompt: 'Read the class register', states: ['2196'], onUse: (it) => side(async () => {
      it.done(); cine(true); await game.shot([56.4, 1.8, -10.8], [55.0, 0.9, -12.0], 0.8, { fov: 40 });
      await game.say('kai', 'Twenty-four names. Nine marked "not arrived, coast train". Someone else\'s handwriting.'); gotCard('sc_cons');
    }) });
    act({ pos: [P.order[0], 1.2, P.order[2]], radius: 1.8, prompt: 'Read the council order', states: ['2196'], onUse: (it) => side(async () => {
      it.done(); cine(true); await game.shot([76.4, 1.8, -10.6], [77.6, 0.9, -9.6], 0.8, { fov: 40 });
      await game.say('kai', 'Seven-forty. "Abandon the school. All children to the Archive by ten-forty. Do not wait for stragglers."'); gotCard('sc_cause');
    }) });
    act({ pos: [P.yardBoard[0], 1.4, P.yardBoard[2] + 0.4], radius: 2.0, prompt: 'Read the term poster', states: ['2196'], onUse: (it) => side(async () => {
      it.done(); await game.say('kai', '"Reopens the fifteenth of May. All pupils accounted for." Neither of those happened.'); gotCard('sc_fake');
    }) });
    act({ pos: [79, 1.6, -28], radius: 2.2, prompt: 'Look at the drawings', states: ['2196'], onUse: (it) => side(async () => {
      it.done(); progress(); cine(true); await game.shot([77.2, 1.8, -28], [79.7, 1.8, -28], 0.8, { fov: 34 });
      ev('"He made the sky break"', 'A child\'s drawing in the Larkfield library: a man with a glowing wrist under a breaking sky. "By Nia, age 8." The children of 2196 learn his face from the memorials.', DTAG.school);
      await game.say('kai', 'A man with a glowing wrist. Even the children here know my face.'); F.m15drawing = true;
    }) });
    act({ pos: [P.tearSc[0], 1, P.tearSc[2]], radius: 2.6, prompt: 'Read the tear (Larkfield)', states: ['2196'], enabled: () => nCards('school') === 3, onUse: (it) => side(async () => { it.done(); await readTear('school'); }) });
    act({ pos: [0, 1, 0], radius: 1.8, prompt: 'Talk to Ms Okafor', states: ['2196'], onUse: () => side(async () => {
      const t = L.school.t;
      if (t > 8 && t < 55.5) { ui.subtitle('okafor', 'Not now, love — we have to go. Hold hands, everyone.', 2400); return; }
      cine(true); pauseLoop('school', true); okafor.pose = null;
      if (t <= 8) await convo(okafor, [
        ['okafor', 'Oh! Hello. First time in Harrow? We\'re doing rivers today.'],
        ['kai', '"Where does water go when it forgets?"'],
        ['okafor', 'Downhill, mostly. Like everything.'],
      ]);
      else if (t < 66) await convo(okafor, [
        ['okafor', 'Thirteen, fourteen, fifteen. Fifteen. Good.'],
        ['kai', 'How many chairs in your classroom?'],
        ['okafor', 'Twenty-four. Why?'],
        ['kai', 'And you count fifteen.'],
        ['okafor', '...I always count fifteen. Why do I always set out twenty-four?'],
      ]);
      else await convo(okafor, [
        ['okafor', 'They\'ve gone ahead to the Archive. I\'ll follow in a minute.'],
        ['okafor', 'I always follow in a minute.'],
      ]);
      F.m15okafor = (F.m15okafor || 0) + 1; progress();
      pauseLoop('school', false);
    }) });
    { const it = game.interactables[game.interactables.length - 1]; game.onUpdate(() => { it.pos.set(okafor.root.position.x, 1, okafor.root.position.z); }); }

    // ================= the Saltmarket: interactions =================
    P.girders.forEach(([gx, , gz], i) => {
      act({ pos: [gx, 1.2, gz], radius: 1.8, prompt: 'Read the aged girder', states: ['2196'], onUse: (it) => side(async () => {
        it.done(); S.girders[i] = true; progress(); audio.sfxPlay('anomaly');
        const n = S.girders.filter(Boolean).length;
        await tween(0.8, u => { W.girderLines[i].material.opacity = u * 0.7; });
        await game.say('m15band', ['Ageing gradient: one hundred and twelve years on the far face, forty on this one. Source: along the line.', 'Second gradient. Same source, another bearing.', 'Third gradient. The three bearings cross.'][n - 1]);
        if (n === 3) { await game.say('kai', 'Three lines. They cross in the middle of the hall, where nothing\'s standing.'); L.market.learn('cross', 'The three girders point at one spot: dig there'); }
      }) });
    });
    act({ pos: [P.epic[0], 1, P.epic[2]], radius: 2.0, hold: 3.0, prompt: 'Dig at the crossing', states: ['2196'], enabled: () => S.girders.every(Boolean) && !S.dug, onUse: (it) => side(async () => {
      it.done(); S.dug = true; W.pit.visible = true; audio.sfxPlay('metal'); cine(true);
      await game.shot([P.epic[0] + 2.2, 2.0, P.epic[2] + 2.0], [P.epic[0], 0.1, P.epic[2] - 0.6], 1.0, { fov: 38 });
      await game.say('kai', 'A cable. Rubber-clad, running north. "Lantern feed L-1. First ignition sixteen-forty and twelve seconds."');
      await game.shot([P.epic[0] + 1.0, 1.6, P.epic[2] + 3.0], [0, 6, -30], 1.8, { fov: 46 });
      await game.say('kai', 'It wasn\'t the storm. It was the Lantern.');
      F.m15marketCause = true; gotCard('mk_cause');
    }) });
    act({ pos: [P.epic[0] - 1, 1, P.epic[2] + 1.6], radius: 3.4, prompt: 'Read the echo of 16:40', states: ['2196'], enabled: () => game.residueOn, onUse: (it) => side(async () => {
      it.done(); cine(true);
      await game.shot([P.epic[0] - 6, 2.4, P.epic[2] - 6], [P.epic[0], 1, P.epic[2]], 1.4, { fov: 46 });
      await game.say('kai', 'They\'re still here. Forty-one of them, under a roof that isn\'t there any more.');
      await game.say('kai', 'No names on any wall. No ledger. Just the echo.');
      gotCard('mk_cons');
    }) });
    act({ pos: [P.warden[0], 1.1, P.warden[2]], radius: 1.8, prompt: 'Read the warden\'s ledger', states: ['2196'], onUse: (it) => side(async () => {
      it.done(); await game.say('kai', '"Inspected on the fifteenth. No casualties." Somebody wrote a tomorrow so they wouldn\'t have to write the names.'); gotCard('mk_fake');
    }) });
    act({ pos: [P.tully[0], 1, P.tully[2]], radius: 2.0, prompt: 'Talk to the fruit seller', states: ['2196'], onUse: () => side(async () => {
      const t = L.market.t; if (t > 66 && t < 88) { ui.subtitle('tully', 'Out! Everyone out!', 1800); return; }
      cine(true); pauseLoop('market', true);
      await convo(tully, [
        ['tully', 'Afternoon! First time in Harrow? Pears, fresh this morning.'],
        ['kai', 'Are they always fresh?'],
        ['tully', 'Every single afternoon. Funny, that. You\'d think a man would get sick of pears.'],
        ...(t > 50 ? [['tully', 'And that bell means nothing. The hall settling. It does that around now.']] : [['kai', 'What happens at twenty to five?'], ['tully', 'Twenty to five? Nothing. I pack up at five.']]),
      ]);
      F.m15tully = true; progress(); pauseLoop('market', false);
    }) });
    { const it = game.interactables[game.interactables.length - 1]; game.onUpdate(() => { it.pos.set(tully.root.position.x, 1, tully.root.position.z); }); }
    act({ pos: [P.epic[0], 1, P.epic[2] - 1.5], radius: 2.4, prompt: 'Read the tear (Saltmarket)', states: ['2196'], enabled: () => nCards('market') === 3 && S.dug, onUse: (it) => side(async () => { it.done(); await readTear('market'); }) });

    // the band reads a tear once its three records are found
    async function readTear(k) {
      cine(true); progress(); shiftPulse = 1; audio.sfxPlay('switch');
      const loop = L[k];
      const cam = { station: [[-80, 2.4, 9], [-86, 1.2, 2]], school: [[38, 2.6, 14], [44, 1.4, 4]], market: [[2, 3.4, 52], [8, 0.6, 60]] }[k];
      await game.shot(cam[0], cam[1], 1.6, { fov: 44 });
      const L1 = {
        station: ['Tear: Harrow North. Record: all aboard the 08:14. The day: the train left at 07:56, six hundred left behind.', 'That\'s the fray. The record and the day don\'t match, and the place can\'t hold both.'],
        school: ['Tear: Larkfield. Record: closed for summer, all accounted for. The day: abandoned at 07:40, nine children never came.', 'She counts fifteen every morning because the record says she should count twenty-four.'],
        market: ['Tear: Saltmarket. Record: no casualties, roof failed from age. The day: the Lantern\'s first ignition. Forty-one dead.', 'And she sent me to find it.'],
      }[k];
      await game.say('m15band', L1[0]); await game.say('kai', L1[1]);
      S.tearDone[k] = true; F['m15tear_' + k] = true; loop.learn('read', 'Tear read: the records are with you');
      const n = Object.values(S.tearDone).filter(Boolean).length; F.m15tears = n;
      ev('Tear read: ' + DTAG[k], L1[0], 'THE TEARS · ' + n + '/3');
      audio.sfxPlay('success');
      if (n < 3) ui.toast(`TEAR READ · ${n}/3`, 2200);
      cine(false); refreshObjective();
    }

    // ================= the archive: Anja, Mara, the board, the Lantern =================
    // Mara's chain: "Two Records, One Disaster"
    act({ pos: [-13.6, 1, -18.6], radius: 2.2, prompt: 'Talk to Mara Quill', states: ['2196'], enabled: () => S.phase !== 'intro' && S.phase !== 'find' && S.phase !== 'brief', onUse: () => side(async () => { await maraTalk(); }) });
    { const it = game.interactables[game.interactables.length - 1]; game.onUpdate(() => { it.pos.set(mara.root.position.x, 1, mara.root.position.z); }); }
    async function maraTalk() {
      cine(true); mara.pose = null;
      if (S.mara === 0) {
        S.mara = 1; F.m15mara = 'met';
        await convo(mara, [
          ['mara', 'Mara Quill. I keep the other archive, the one that disagrees with itself.'],
          ['mara', 'Two records in this building name the first hand on the Chronolith. They don\'t name the same hand.'],
          ['mara', 'A clean history is usually a history someone has cleaned.'],
          ['kai', 'Which record is true?'],
          ['mara', 'Start with the question: true for whom?'],
          ['mara', 'They\'re on my light table. Compare them. Then we\'ll talk about a cylinder I lost in the Saltmarket.'],
        ]);
        ui.toast('SIDE QUEST · TWO RECORDS, ONE DISASTER', 3000); progress();
      } else if (S.mara < 6 && S.maraCompared && S.cylPlayed && S.museum) {
        await convo(mara, [['mara', 'You went into the old museum. What did the wall say?'], ['kai', 'Both names. Twenty-three years apart, at the same second.']]);
        let i;
        for (;;) {
          i = await choose('mara', 'So which record is true?', ['The Lock Archive: K. Varen', 'The testimony: M. Varen', 'Both. For different branches'], 2);
          if (i === 2) break;
          await game.say('mara', i === 0 ? 'Then my survivors are liars, and Ren\'s grandmother saw nothing. Try again.' : 'Then the official archive is a forgery, and the museum wall too. Try again.');
        }
        await convo(mara, [
          ['kai', 'Both are true. In one branch a girl touched the ring in 2026. In another, I did, in 2049.'],
          ['mara', 'Then neither archive lied. Each one was only one branch long.'],
          ['mara', 'Write it that way. Incomplete is not the same as false. Remember that, when they call you the architect.'],
        ]);
        S.mara = 6; S.dual = true; F.m15dualArchive = true; F.m15mara = 'done'; F.dualArchive = true;
        ev('Two records, one disaster', 'The Lock Archive names K. Varen (19.10.2049, 08:14:00); Mara\'s testimony names M. Varen (19.10.2026, 08:14:00); the 2049 museum shows both. Both records are accurate, for different branches. The archive is incomplete, not false.', 'TWO RECORDS · SOLVED');
        audio.sfxPlay('success');
      } else if (S.mara >= 6) {
        await convo(mara, [['mara', 'I\'ll read it again tomorrow morning. If there is one.']]);
      } else {
        const todo = !S.maraCompared ? 'Compare the two records on my table first.' : !S.cylinder ? 'Ren Halloway\'s cylinder. It was in his record stall in the Saltmarket, west side, under the fallen roof.' : !S.cylPlayed ? 'Put the cylinder on the player by the shelves. Mind the speed: Ren never recorded anything the normal way.' : 'Ren said his grandmother saw it on a museum wall. This building was a museum, once. Your wrist might remember.';
        await convo(mara, [['mara', todo]]);
      }
      mara.pose = 'look';
    }
    act({ pos: [P.lightTable[0], 1.2, P.lightTable[2] + 1.4], radius: 2.0, prompt: 'Compare the two records', states: ['2196'], enabled: () => S.mara >= 1 && !S.maraCompared, onUse: () => side(async () => {
      cine(true);
      await game.shot([-16.2, 2.3, -29.2], [-16.2, 0.95, -30.6], 1.0, { fov: 38 });
      for (;;) {
        const i = await choose('kai', 'K. VAREN · 19.10.2049 · 08:14:00 — M. VAREN · 19.10.2026 · 08:14:00. What do the two records share?', ['The same date', 'The same operator', 'The same second of the day, twenty-three years apart', 'Nothing at all'], 2);
        if (i === 2) break;
        await game.say('kai', ['No. Different years.', 'No. One says K, one says M.', 'No. Look at the time.'][i === 3 ? 2 : i]);
      }
      await game.say('kai', 'Eight-fourteen and nothing. Twenty-three years apart. One a K, one an M.');
      S.maraCompared = true; S.mara = Math.max(S.mara, 2); F.m15mara = 'compared'; progress();
      ev('Two records', 'The Lock Archive\'s Register of First Causes: "First operator of the Chronolith: K. VAREN, 19.10.2049, 08:14:00." Mara\'s testimony ledger: "M. VAREN, 19.10.2026, 08:14:00." The same second of the day, twenty-three years apart.', 'TWO RECORDS');
    }) });
    act({ pos: [P.cylinder[0], 1.1, P.cylinder[2]], radius: 1.8, hold: 2.4, prompt: 'Dig out the cylinder', states: ['2196'], onUse: (it) => side(async () => {
      it.done(); S.cylinder = true; W.cylinderObj.visible = false; audio.sfxPlay('pickup'); progress();
      ev('Ren Halloway\'s cylinder', 'A wax-and-wire recording cylinder in a cracked case, from the record stall in the Saltmarket. The case is stencilled: "REN H. · TESTIMONY 7 · 160".', 'TWO RECORDS');
      await game.say('kai', S.mara ? '"Ren H. Testimony seven. One-sixty." Mara\'s cylinder.' : '"Ren H. Testimony seven. One-sixty." Somebody\'s life, on a wax tube.');
      F.m15cylinder = true;
    }) });
    act({ pos: [P.cylBench[0], 1.2, P.cylBench[2]], radius: 1.9, prompt: 'Play the cylinder', states: ['2196'], enabled: () => S.cylinder && S.mara >= 1 && !S.cylPlayed, onUse: () => side(async () => {
      cine(true);
      await game.shot([-16.4, 1.9, -20.6], [-18.4, 1.2, -21.7], 1.0, { fov: 36 });
      for (;;) {
        const i = await choose('kai', 'The player\'s speed lever', ['78 turns a minute', '120 turns a minute', '160 turns a minute'], 2);
        if (i === 2) break;
        audio.sfxPlay('rewind'); await game.say('m15ren', i === 0 ? 'Mmmmyyyy gggrrrraaaannnndddmmmooootthhhherrr…' : 'My-grand-moth-er-wor-ked-the-He…');
        await game.say('kai', 'Wrong speed. The case said something.');
      }
      lockMusic('m15-mara', 1);
      await game.say('m15ren', 'Testimony seven. Ren Halloway, Saltmarket, the year twenty-one fifty.');
      await game.say('m15ren', 'My grandmother worked the Helix front desk in twenty twenty-six. She said a girl walked into the hall at eight-fourteen and put her hand on the ring.');
      await game.say('m15ren', 'Varen, the badge said. Mira Varen. And the whole world went quiet for nine seconds.');
      await game.say('m15ren', 'She saw the badge again, years later. On a museum wall.');
      musicLock = null; music();
      S.cylPlayed = true; S.mara = Math.max(S.mara, 4); F.m15mara = 'played'; progress();
      ev('Testimony 7', 'Ren Halloway, 2150: his grandmother worked the Helix front desk in 2026; at 08:14 a girl with a badge reading "Mira Varen" put her hand on the ring, and the world went quiet for nine seconds. She saw the badge again years later, on a museum wall.', 'TWO RECORDS');
      await game.say('kai', 'Mira. In twenty twenty-six. At eight-fourteen.');
    }) });
    act({ pos: [P.museumCase[0], 1.4, P.museumCase[2] + 1.6], radius: 2.2, prompt: 'Examine the Helix display', states: ['2049'], onUse: (it) => side(async () => {
      it.done(); cine(true); S.museum = true; F.m15museum = true; progress();
      await game.shot([-15.4, 1.9, -34.4], [-16, 1.05, -36.4], 1.0, { fov: 36 });
      await game.say('kai', 'A visitor\'s badge. "M. Varen." Recovered from the hall floor after the founding test.');
      await game.shot([-15.6, 2.2, -42.6], [-15.6, 2.3, -45.1], 1.4, { fov: 42 });
      await game.say('kai', 'And beside it: "First operational test, nineteenth of October twenty forty-nine. Operator, K. Varen."');
      await game.say('kai', 'In 2049 they\'re on the same wall. Both of us. Nobody ever read them together.');
      ev('Gallery 3 · Helix: twenty-three years (2049)', 'In the 2049 Civic Museum: the founding test, 19.10.2026, 08:14, aborted, with a recovered visitor\'s badge "M. VAREN"; and the first operational test, 19.10.2049, 08:14, "Operator: K. Varen".', 'TWO RECORDS');
      if (S.mara >= 1) S.mara = Math.max(S.mara, 5);
    }) });

    // Anja's lab (after the briefing she works at her bench)
    act({ pos: [0, 1, 0], radius: 2.0, prompt: 'Talk to Dr. Vale', states: ['2196'], enabled: () => ['tears', 'archive'].includes(S.phase), onUse: () => side(async () => {
      cine(true); anja.pose = null;
      const n = Object.values(S.tearDone).filter(Boolean).length;
      const opt = await choose('kai', 'Dr. Vale', ['"How does the Lantern work?"', '"What was the storm?"', n ? '"About what I\'ve found…"' : '"Where do I start?"'], 2);
      if (opt === 0) await convo(anja, [['anja', 'A stabilizer core from old Helix, a city\'s worth of cable, and one rule: the day it holds has to be a day people can live again.'], ['kai', 'And if they can\'t?'], ['anja', 'Then it tears. You\'ve seen where.']]);
      else if (opt === 1) await convo(anja, [['anja', 'Loose time. What the Fracture left lying about. It rolls over the hills like weather, and whatever it touches forgets what it was.'], ['anja', 'A rail forgets it\'s a rail. A roof forgets it\'s a roof.']]);
      else if (n === 0) await convo(anja, [['anja', 'The station\'s west, the school\'s east past the road, the market\'s south down the avenue. Each tear repeats. Learn the repeat, and it\'ll let you in.']]);
      else await convo(anja, [['anja', S.tearDone.market ? 'You went to the Saltmarket.' : 'Keep going. Bring me all three.'], ...(S.tearDone.market ? [['kai', 'I did.'], ['anja', '...Finish the other two. Then show me on the board.']] : [])]);
      anja.pose = 'work';
    }) });
    const anjaIt = game.interactables[game.interactables.length - 1]; game.onUpdate(() => { anjaIt.pos.set(anja.root.position.x, 1, anja.root.position.z); });

    // the Separation Board
    act({ pos: [0, 1.2, -39.6], radius: 2.4, prompt: 'Sort the records on the Separation Board', states: ['2196'], enabled: () => S.phase === 'archive' && !S.allSorted, onUse: () => side(async () => { await sortBoard(); }) });
    const explain = (c, wrong) => c.col === 'fabricated' ? 'No. It\'s dated the fifteenth of May. In this city there is no fifteenth.'
      : wrong === 'fabricated' ? 'No. Nothing about this one is dated after the day. It\'s real, however much it hurts.'
        : c.col === 'cause' ? 'No. This happened first. Everything else follows from it.' : 'No. This is what was left afterwards. Something else made it happen.';
    async function sortBoard() {
      cine(true); lockMusic('m15-archive', 1);
      await game.shot([0, 2.6, -36.6], [0, 2.6, -45.2], 1.2, { fov: 50 });
      for (const c of CARDS) {
        if (S.sorted[c.id]) continue;
        const m = W.cardMeshes[c.id];
        await tween(0.5, u => { m.position.y = 0.95 + u * 0.9; m.rotation.x = -Math.PI / 2 + 0.35 + u * (Math.PI / 2 - 0.35); m.position.z = -40.8 + u * 0.6; });
        let placed = false;
        while (!placed) {
          const i = await choose('kai', `${c.title} — ${c.text}`, ['Cause', 'Consequence', 'Fabricated', 'Stop sorting for now'], COLS.indexOf(c.col));
          if (i === 3) { await tween(0.4, u => { m.position.y = 1.85 - u * 0.9; m.rotation.x = -u * (Math.PI / 2 - 0.35); m.position.z = -40.2 - u * 0.6; }); m.rotation.x = -Math.PI / 2 + 0.35; musicLock = null; music(); cine(false); return; }
          if (COLS[i] === c.col) placed = true;
          else { S.sortMiss++; F.m15sortMisses = S.sortMiss; audio.sfxPlay('fail'); await game.say('kai', explain(c, COLS[i])); }
        }
        const nIn = CARDS.filter(q => q.col === c.col && S.sorted[q.id]).length;
        const tx = W.boardCols[c.col] + (nIn % 2 ? 0.7 : -0.7), ty = 3.9 - nIn * 1.0, from = m.position.clone();
        await tween(0.7, u => { m.position.set(from.x + (tx - from.x) * u, from.y + (ty - from.y) * u, from.z + (-45.05 - from.z) * u); m.rotation.x = 0; });
        S.sorted[c.id] = true; S.nSorted++; musicState.sorted = S.nSorted; audio.sfxPlay('pickup');
        ui.toast(`${COL_NAME[c.col]} · ${S.nSorted}/9`, 1400);
      }
      S.allSorted = true; F.m15sorted = true; progress();
      for (const c of CARDS) if (c.col === 'fabricated' || c.id === 'mk_cause') { const m = W.cardMeshes[c.id]; m.material.emissive.set(c.col === 'fabricated' ? 0xff8f6a : 0xffc890); m.material.emissiveIntensity = 0.35; }
      await game.shot([2.4, 3.4, -38.6], [0, 3.0, -45.1], 1.6, { fov: 44 });
      await game.say('kai', 'Every fabrication is dated the fifteenth of May. Every one of them describes a tomorrow that never came.');
      await game.say('kai', 'Two of the causes are the storm and the people running from it. The third one\'s a cable.');
      musicLock = null; cine(false);
    }

    // the Lantern console (the choice) and the ring levers (the finale)
    act({ pos: [P.console[0], 1.2, P.console[2] + 0.6], radius: 2.0, prompt: 'Speak with Anja at the Lantern', states: ['2196'], enabled: () => S.phase === 'lantern' && !S.choice, onUse: () => side(async () => { await lanternChoice(); }) });
    RINGS.forEach((rg, i) => {
      const [x, , z] = P.rings[i];
      drawRingScreen(W.ringScreens[i], rg.label, '— : —', false);
      act({ pos: [x, 1.2, z], radius: 1.7, prompt: `Set Ring ${['I', 'II', 'III'][i]} (${rg.short})`, states: ['2196'], enabled: () => S.phase === 'rings' && !S.rings[rg.id], onUse: () => side(async () => { await setRing(i); }) });
    });

    // ---------- collectibles: temporal shards, notes to tomorrow ----------
    SHARDS.forEach(([x, y, z, era, where]) => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), glowMat(0x7fe8ff, 3.2)); m.position.set(x, y, z); m.userData.noBatch = true; scene.add(m);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.01, 6, 32), glowMat(0x7fe8ff, 1.8)); m.add(halo); T.only(m, era);
      game.onUpdate((dt, t) => { m.rotation.y += dt * 1.4; halo.rotation.x = t; });
      act({ pos: [x, y + 0.3, z], radius: 1.8, prompt: 'Take the temporal shard', states: [era], onUse: (it) => {
        it.done(); m.userData.states = []; m.visible = false; S.shards++; F.shards = (F.shards || 0) + 1; F.m15shards = S.shards; audio.sfxPlay('anomaly'); progress();
        ev('Temporal shard ' + S.shards + '/5', 'Crystallised time, found ' + where + '. Inside the lock it beats once a day.', 'TEMPORAL SHARD · ' + S.shards + '/5');
      } });
    });
    NOTES.forEach(([x, y, z, where, text], i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.2), new THREE.MeshStandardMaterial({ map: TEX.note(i), roughness: 0.85, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: TEX.note(i), emissiveIntensity: 0.12 }));
      m.position.set(x, y, z); m.rotation.set(-Math.PI / 2 + 0.2, 0, i * 0.7); scene.add(m); T.only(m, '2196');
      act({ pos: [x, y + 0.4, z], radius: 1.7, prompt: 'Read the note to tomorrow', states: ['2196'], onUse: (it) => {
        it.done(); m.visible = false; m.userData.states = []; S.notes++; F.m15notes = S.notes; audio.sfxPlay('pickup'); progress();
        ev(`Note to tomorrow ${S.notes}/6`, `Found on ${where}: "${text}"`, 'NOTES TO TOMORROW · ' + S.notes + '/6');
        ui.subtitle('kai', ['Written to a morning that never read it.', 'He wrote it down and never found it.', 'Wren knew. Every morning, for a minute.', 'Somebody has been trying to tell her.', 'Even the pears know.', 'Mara. Of course.'][i], 2600);
      } });
    });
    // Teo on the plaza: "What day is it tomorrow?"
    act({ pos: [6.4, 1, 15.6], radius: 2.0, prompt: 'Talk to the boy', states: ['2196'], enabled: () => S.phase !== 'intro', onUse: (it) => side(async () => {
      it.done(); cine(true);
      await convo(teo, [['m15teo', 'Mister. What day is it tomorrow?']]);
      const i = await choose('kai', 'Teo asks what day it is tomorrow', ['"The fifteenth."', '"I don\'t know yet."', '"What day was yesterday?"'], 1);
      await convo(teo, [['m15teo', ['Everyone says that. Nobody\'s ever been.', 'Me neither. I think about it at night, and then it\'s morning.', '…Thursday? It\'s always Thursday.'][i]]]);
      F.m15teo = i;
    }) });
    // Sera, outside the veil (she will not come in)
    act({ pos: [68.4, 1, 11.6], radius: 2.6, prompt: 'Talk to Sera (through the veil)', states: ['2196'], enabled: () => S.phase !== 'intro', onUse: () => side(async () => {
      cine(true);
      const i = await choose('kai', 'Sera, on the far side of the veil', ['"Why won\'t you come in?"', '"What do you know about Vale?"', '"Where should I look?"'], 2);
      if (i === 0) await convo(sera, [['sera', 'Last time I lost a whole day and found it written on my arm. In my own hand. I didn\'t like what I\'d written.']]);
      else if (i === 1) await convo(sera, [['sera', 'She saved eleven hundred people the night the weather came. Then she kept saving them. Every day. That\'s the part I don\'t trust.']]);
      else await convo(sera, [['sera', Object.values(S.tearDone).filter(Boolean).length === 3 ? 'You\'ve read them all. Go and make her look at it.' : 'Where it hurts. The station, the school, the market. Every city has the same three.']]);
    }) });
    // greeters: a resident on the road and one on the plaza, with the city's one question
    const greeters = [];
    {
      const g1 = amb(resLook(2, 1590), 48, 0, 16, -Math.PI / 2), g2 = amb(resLook(1, 1591), -16, 0, 14, 0.4);
      const lp = { t: 0 }; void lp;
      greeters.push({ ch: g1, a: [48, 0, 16.6], b: [30, 0, 13.4], id: 'm15res' }, { ch: g2, a: [-16, 0, 16], b: [-2, 0, 20.4], id: 'm15resf' });
      let tg = 0;
      game.onUpdate(dt => {
        tg += dt;
        for (const [k, g] of greeters.entries()) {
          if (g.hold) continue;
          const u = (Math.sin(tg * 0.05 + k * 2) + 1) / 2, x = g.a[0] + (g.b[0] - g.a[0]) * u, z = g.a[2] + (g.b[2] - g.a[2]) * u;
          const p = g.ch.root.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
          if (d > 0.002) { g.ch.root.rotation.y = Math.atan2(dx, dz); g.ch.speed = Math.min(1.6, d / Math.max(dt, 1e-3)); } else g.ch.speed = 0;
          p.x = x; p.z = z;
          if (S.phase !== 'intro' && game.control && !S.busy && T.current === '2196' && near(x, z, 3.2) && once('greet' + k + Math.floor(game.time / 40))) {
            ui.subtitle(g.id, ['Morning! First time in Harrow?', 'Lovely day for it. Same as always.', 'You look lost, love. Archive\'s north. Station\'s west.', 'Morning! First time in Harrow?'][(S.greet = (S.greet || 0) + 1) % 4], 2600);
            g.ch.lookTarget = kai.head; setTimeout(() => { g.ch.lookTarget = null; }, 2600);
          }
        }
      });
    }

    // ---------- hints when the player stalls ----------
    hint(() => S.phase === 'find', 60, () => ui.subtitle('kai', 'The dome with the light in it. The Archive\'s north of the plaza.', 3000));
    let hs = 0, hc = 0, hm = 0;
    hint(() => S.phase === 'tears' && region() === 'station' && !S.tearDone.station && game.time - S.lastProgress > 50, 70, () => ui.subtitle('kai', ['Everybody\'s watching the gates. Nobody\'s watching the signal box.', 'Wren goes up to the box at forty-six past. If I\'m on the landing when he opens it…', 'There\'s another way up: along the track bed to the north end. Not while the echo train runs.', 'The girl on Platform Two hasn\'t moved since I got here.'][hs++ % 4], 3400));
    hint(() => S.phase === 'tears' && region() === 'school' && !S.tearDone.school && game.time - S.lastProgress > 50, 70, () => ui.subtitle('kai', ['The office opens when the bell goes. The corridor\'s the problem.', 'Seven seconds between pulses. Go right after one.', 'Her register\'s on the desk. The yard has a notice board.'][hc++ % 3], 3400));
    hint(() => S.phase === 'tears' && region() === 'market' && !S.tearDone.market && game.time - S.lastProgress > 50, 70, () => ui.subtitle('kai', ['Three girders, aged from one side. Read them all.', 'Whatever happens at 16:40, I want to be outside for it.', 'The warden kept a booth by the door. And Residue Vision might show me what nobody wrote down.'][hm++ % 3], 3400));
    hint(() => S.phase === 'tears' && region() === 'city' && game.time - S.lastProgress > 90, 90, () => ui.subtitle('kai', 'Station west. School east, past the road. The market south, down the avenue.', 3200));
    hint(() => S.phase === 'archive' && !S.allSorted, 60, () => ui.subtitle('kai', 'The board in the Archive. Nine records, three columns.', 2800));
    hint(() => S.phase === 'lantern', 50, () => ui.subtitle('kai', 'Anja\'s waiting at the Lantern.', 2400));
    hint(() => S.phase === 'rings', 45, () => ui.subtitle('anja', S.choice === 'free' ? 'In the order the day happened, Kai. Seven-forty first.' : 'Each ring holds what really happened. Tell it the truth.', 3000));

    // ======================================================================================================
    // THE SCRIPT
    // ======================================================================================================
    // ---------- opening: the establishing shot, the chapter card, the veil ----------
    S.phase = 'intro'; S.main = true;
    pl.place(73.0, 0, 14.6, -Math.PI / 2); kai.root.rotation.y = -Math.PI / 2;
    cine(true); lockMusic('m15-city', 0.5);
    await game.shot([118, 46, 70], [0, 16, -30], 0.01, { fov: 50 });
    const card = ui.chapterCard('ACT III · THE LAST VERSION OF EARTH', 'The City That Forgot Tomorrow', 'Harrow Reach · 2196');
    await ui.fade(0, 2200);
    await game.shot([96, 26, 40], [0, 14, -30], 6.5, { fov: 46 });
    await card;
    await game.shot([80, 2.0, 19.6], [69, 1.6, 12.6], 2.2, { fov: 40 });
    sera.lookTarget = kai.head; kai.lookTarget = sera.head;
    await convo(sera, [
      ['sera', 'Harrow Reach. Eleven hundred people, one day.'],
      ['sera', 'Every morning in there is the fourteenth of May, twenty-one ninety-three. They\'ll meet you today and lose you tonight.'],
      ['kai', 'A loop?'],
      ['sera', 'A lock. Dr. Vale built it. She asked for an engineer.'],
      ['sera', seraTrust > 0 ? 'I said I\'d bring her the only one who might understand it.' : 'I said I\'d bring her the worst one alive. She said that was the qualification.'],
      ['kai', 'You\'re not coming in.'],
      ['sera', 'I go in, I come out not knowing why my hands are shaking. I\'ll be here.'],
      ...(F.m13done ? [['sera', F.m13choice === 'free' ? 'You gave the Sable Yards their morning back. Let\'s see what you do with a city that doesn\'t want one.' : 'You broke the spire at the Sable Yards. This lock is gentler. Be gentler.']] : metSera ? [] : [['sera', 'Sera Voss. Remember it. They won\'t.']]),
    ]);
    // through the veil
    await game.shot([64, 1.8, 18.6], [70, 1.6, 14], 1.0, { fov: 44 });
    audio.sfxPlay('switch'); shiftPulse = 1; W.gateBar.enabled = false;
    await tween(1.6, u => { pl.place(73 - u * 10.4, 0, 14.6, -Math.PI / 2); });
    W.gateBar.enabled = true;
    kai.root.rotation.y = -Math.PI / 2; ui.toast('THE LOCK · THURSDAY 14 MAY 2193', 2600);
    await game.shot([56, 1.7, 12.4], [61, 1.5, 15.6], 1.4, { fov: 40 });
    const g1 = greeters[0].ch; greeters[0].hold = true;
    g1.root.position.set(58.6, 0, 15.8); g1.root.rotation.y = Math.PI / 2; g1.lookTarget = kai.head;
    await game.say('m15res', 'Morning! First time in Harrow?');
    await game.say('kai', 'First time.');
    await game.say('m15res', 'Lovely. It\'s the fourteenth, you know. Lovely day for it.');
    g1.lookTarget = null; greeters[0].hold = false;
    await game.shot([30, 7, 22], [0, 12, -24], 2.4, { fov: 48 });
    await game.say('kai', 'The fourteenth. For three years.');
    S.main = false; musicLock = null; cine(false); kai.lookTarget = null; sera.lookTarget = null;
    game.checkpoint(62.4, 0, 14.6, -Math.PI / 2);
    S.phase = 'find'; objective('Find Dr. Anja Vale in the Hollow Archive (the dome, north of the plaza)');
    await game.waitFor(() => pl.pos.z < -12.6 && Math.abs(pl.pos.x) < 11.6 && T.current === '2196' && !S.busy && !ui.dlgActive && game.control);

    // ---------- the briefing at the Lantern ----------
    S.phase = 'brief'; S.main = true; cine(true); lockMusic('m15-anja', 1.4);
    game.checkpoint(0, 0, -14, Math.PI);
    await game.shot([-6, 1.4, -15.5], [0, 7, -30], 2.6, { fov: 54 });
    await game.say('anja', 'You\'re the engineer. Over here, by the light.');
    pl.place(0.6, 0, -22.4, Math.PI); anja.root.position.set(2.6, 0, -24.6);
    await convo(anja, [
      ['anja', 'Kai Varen. Sera said you\'d look less like the statues.'],
      ['kai', 'I get that a lot this week.'],
      ['anja', 'Anja Vale. This is the Lantern. Three years ago a storm of loose time came over the Keld hills. Everything it touched forgot what it was.'],
      ['anja', 'So I locked the city inside the last day I could be sure of. Thursday, the fourteenth of May.'],
      ['kai', 'And everyone lives it again.'],
      ['anja', 'Eleven hundred people. Fed, safe, and new every morning. They don\'t remember. I do.'],
      ['kai', 'That\'s a cage.'],
      ['anja', 'It\'s a lock. Cages keep things in. Locks keep things out.'],
    ]);
    await game.shot([4.4, 3.0, -21], [0, 5, -30], 1.6, { fov: 46 });
    await convo(anja, [
      ['anja', 'But it\'s fraying. The day used to hold. Now three places replay the same minute and a half: the station, the school, the market.'],
      ['anja', 'Tears. Go and read them. Find what each place is reliving, and bring the records here. The board will show where the record and the day disagree.'],
      ['kai', 'And if the archive disagrees with you?'],
      ['anja', 'Then you\'ll have done the job properly.'],
      ['anja', 'One more thing. This building is older than the lock. Your band might find another year in here. Nowhere else in the city.'],
    ]);
    T.unlocked = true; T.refreshHud();
    ui.toast('TEMPORAL STATE · CIVIC MUSEUM 2049 · INSIDE THE ARCHIVE ONLY (2 / 3)', 3600);
    await game.shot([-6.2, 1.7, -17.0], [-12.9, 1.6, -18.4], 1.2, { fov: 38 });
    mara.lookTarget = kai.head;
    await game.say('mara', 'Engineer. When you\'re done being useful to her, come and be useful to me.');
    mara.lookTarget = null;
    S.main = false; musicLock = null; cine(false);
    // Anja goes back to her bench
    walkTo(anja, [[8, 0, -19], [12.4, 0, -18.8], [15.4, 0, -24], P.anja], 1.3).then(() => { anja.root.rotation.y = Math.PI / 2; anja.pose = 'work'; });
    S.phase = 'tears'; S.lastProgress = game.time; F.m15briefed = true; refreshObjective();
    game.checkpoint(0, 0, -8, 0);

    // ---------- the three tears (free order) ----------
    await game.waitFor(() => S.tearDone.station && S.tearDone.school && S.tearDone.market && !S.busy && !ui.dlgActive && game.control);
    S.phase = 'archive'; objective('Return to the Archive: sort the nine records on the Separation Board');
    await game.say('kai', 'Three tears, nine records. Time to show Anja her own board.');
    await game.waitFor(() => S.allSorted && !S.busy && !ui.dlgActive && game.control);

    // ---------- the truth at the board, and the quote ----------
    S.main = true; cine(true); lockMusic('m15-anja', 1.2); if (T.current !== '2196') T.setImmediate('2196');
    anja.root.position.set(1.8, 0, -38.6); anja.pose = null; pl.place(-1.2, 0, -37.6, Math.PI);
    if (S.dual) { mara.root.position.set(-3.6, 0, -37.0); mara.root.rotation.y = 2.2; }
    await game.shot([4.6, 2.2, -35.2], [0, 2.6, -44], 1.8, { fov: 46 });
    await convo(anja, [
      ['anja', 'Show me.'],
      ['kai', 'Two of the tears are the storm, and the people who ran from it. The third is your Lantern.'],
    ]);
    await game.shot([0.4, 1.7, -36.4], [1.8, 1.6, -38.6], 2.0, { fov: 30 });
    await game.say('anja', '...Sixteen-forty and twelve seconds. I felt the hall go. I told myself it was the storm.');
    await convo(anja, [
      ['kai', 'And the fifteenth of May? Every lie on this board is dated tomorrow.'],
      ['anja', 'A lock can only hold a day people can bear to live again. So I gave them one they could bear.'],
      ['kai', 'The Fracture made your storm. How many has it killed, Anja? The real number.'],
    ]);
    audio.silence?.(1.2);
    await game.shot([2.6, 1.68, -37.2], [1.8, 1.62, -38.6], 1.6, { fov: 26 });
    await game.say('anja', 'That depends on whether you count the worlds that never finished becoming worlds.');
    F.m15quote = true;
    ev('"Worlds that never finished"', 'Anja Vale, at the Separation Board: "That depends on whether you count the worlds that never finished becoming worlds." The market\'s forty-one dead were the Lantern\'s first ignition, and she wrote them out of the record.', 'THE ARCHIVE');
    if (S.dual) {
      await convo(mara, [
        ['mara', 'She\'s right, and so are the survivors. That\'s the trouble with records: they can all be true at once.'],
        ['kai', 'The archive isn\'t lying. It\'s incomplete.'],
      ]);
      await convo(anja, [['anja', 'Then let\'s not make it any more incomplete than it is.']]);
    } else await convo(anja, [['kai', 'Then count this one.']]);
    await convo(anja, [['anja', 'The Lantern won\'t survive another month like this. Come to the console. You\'ve earned a say in what happens to them.']]);
    walkTo(anja, [[2.6, 0, -25.6]], 1.4).then(() => { anja.root.rotation.y = Math.PI; });
    S.main = false; musicLock = null; cine(false);
    S.phase = 'lantern'; objective('Decide Harrow Reach\'s tomorrow: speak with Anja at the Lantern console');
    await game.waitFor(() => S.choice && !S.busy && !ui.dlgActive && game.control);

    async function lanternChoice() {
      S.main = true; cine(true); lockMusic('m15-anja', 1);
      anja.root.position.set(2.6, 0, -25.6); pl.place(-0.6, 0, -23.4, Math.PI);
      await game.shot([3.6, 6.4, -20], [0, 5.6, -30], 2.0, { fov: 50 });
      await convo(anja, [
        ['anja', 'Stabilize it, and the tears close. They keep their day: safe, fed, forgetting. I go on remembering for them.'],
        ['anja', 'Or open it. Tomorrow comes. They remember three years at once: the train, the children, the hall. And whatever the storm left outside.'],
        ...(seraTrust > 0 ? [['kai', 'Sera\'s people remember everything. It hasn\'t killed them.'], ['anja', 'It hasn\'t made them gentle, either.']] : [['kai', 'Out there they teach children my name before the names of the dead.'], ['anja', 'Then you know what remembering costs.']]),
        ...(S.dual ? [['kai', 'Whatever we choose, the board stays. In the right columns.'], ['anja', 'Mara will see to that.']] : []),
      ]);
      await game.shot([-2.2, 1.7, -21.6], [-0.6, 1.6, -23.4], 1.2, { fov: 34 });
      const i = await choose('kai', 'Harrow Reach: what does tomorrow hold?', ['Stabilize the city: they keep their day', 'Free it from the loop: let tomorrow come'], 0);
      S.choice = i === 0 ? 'stabilize' : 'free'; F.m15choice = S.choice;
      F.factionChoices = F.factionChoices || {}; F.factionChoices.m15 = S.choice;
      if (S.choice === 'stabilize') await convo(anja, [['kai', 'Stabilize it. But tune it to the truth this time, not the record.'], ['anja', 'The rings. One for each tear. Set each one to what really happened, and the lock will hold a day that isn\'t a lie.']]);
      else await convo(anja, [['kai', 'Let them have tomorrow. All of it.'], ['anja', 'Then release the rings in the order the day happened. Let them remember it the way it came: one hour at a time.']]);
      S.phase = 'rings'; S.main = false; musicLock = null; cine(false);
      objective(S.choice === 'stabilize' ? 'Tune the three Lantern rings to what really happened (0/3)' : 'Release the three Lantern rings in the order the day happened (0/3)');
    }
    async function setRing(i) {
      const rg = RINGS[i];
      if (S.choice === 'free' && FREE_ORDER[S.freeNext] !== rg.id) {
        audio.sfxPlay('fail'); await game.say('anja', 'Not that one yet. Let them remember it in the order it happened.'); S.ringOrderMiss = (S.ringOrderMiss || 0) + 1; F.m15ringOrderMiss = S.ringOrderMiss; return;
      }
      cine(true);
      const [x, , z] = P.rings[i];
      await game.shot([x * 1.5 + (z < -30 ? 1.2 : 0), 2.2, z + (z < -30 ? -1.4 : 2.0)], [x, 1.2, z], 0.8, { fov: 40 });
      for (;;) {
        const k = await choose('kai', rg.q, rg.opts, rg.ok);
        if (k === rg.ok) break;
        audio.sfxPlay('fail'); S.ringMiss = (S.ringMiss || 0) + 1; F.m15ringMiss = S.ringMiss;
        await game.say('anja', 'The ring slips. That\'s what the record says, not what happened.');
      }
      S.rings[rg.id] = true; if (S.choice === 'free') S.freeNext++;
      drawRingScreen(W.ringScreens[i], rg.label, rg.time + (S.choice === 'free' ? ' · OPEN' : ' · TRUE'), true);
      audio.sfxPlay('success'); W.ringSpeed = S.choice === 'free' ? Math.max(0.2, (W.ringSpeed ?? 1) - 0.3) : (W.ringSpeed ?? 1) + 0.3;
      const ring = W.lanternRings[i]; await tween(0.8, u => { ring.rotation.x = Math.PI / 2 + ((i - 1) * 0.35) * (1 - u); });
      const n = Object.keys(S.rings).length; F.m15truthRings = n;
      objective(S.choice === 'stabilize' ? `Tune the three Lantern rings to what really happened (${n}/3)` : `Release the three Lantern rings in the order the day happened (${n}/3)`);
      cine(false);
      if (n === 3) S.ringsDone = true;
    }
    await game.waitFor(() => S.ringsDone && !S.busy && !ui.dlgActive && game.control);

    // ---------- the ending ----------
    S.main = true; cine(true); if (T.current !== '2196') T.setImmediate('2196'); T.unlocked = false;
    for (const k of ['station', 'school', 'market']) { L[k].stop(); L[k].paused = true; for (const a of loopActors[k]) { a.speed = 0; a.pose = null; } }
    W.train.visible = false; W.fray.visible = false; W.frayFloor.visible = false;
    const wave = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 96), new THREE.MeshBasicMaterial({ color: 0xffc890, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    wave.rotation.x = -Math.PI / 2; wave.position.set(0, 1.2, -30); scene.add(wave);
    const clockTex = (a, b) => { for (const f of W.clocks) { f.material.map = TEX.clockFace(a, b); f.material.emissiveMap = f.material.map; f.material.needsUpdate = true; } };
    if (S.choice === 'stabilize') {
      lockMusic('m15-lock', 1.4);
      await game.shot([5, 2.0, -21], [0, 6, -30], 1.6, { fov: 46 });
      W.lanternPulse = 0.2; W.coreHalo.material.opacity = 0.3;
      await tween(2.4, u => { wave.scale.setScalar(1 + u * 140); wave.material.opacity = 0.7 * (1 - u); });
      await game.say('anja', 'It\'s holding. Steadier than it has in a year. It will hold for a long time now.');
      // the tears close: the station waits calmly, the school counts properly, the market sells its pears
      wren.root.position.set(-83.6, 0, 4.6); wren.root.rotation.y = -Math.PI / 2; pip.root.position.set(-84.6, 0, 5.2); pip.pose = null; wren.lookTarget = pip.head; pip.lookTarget = wren.head;
      await game.shot([-79.4, 1.5, 9.4], [-84.2, 1.2, 4.8], 2.6, { fov: 38 });
      await game.say('wren', 'Let\'s wait together, shall we? The eight-fourteen\'s never early.');
      okafor.root.position.set(43, 0, 9.2); okafor.root.rotation.y = Math.PI; okafor.pose = null;
      await game.shot([46, 1.6, 13.2], [43, 1.4, 9.2], 2.2, { fov: 38 });
      await game.say('okafor', '...twenty-two, twenty-three, twenty-four. Twenty-four. Good.');
      await game.say('kai', 'She counts twenty-four now. Nine of them are still on the coast. But the record finally knows.');
      F.m15cityFreed = false; F.m15lantern = 'stable'; F.harrowFreed = false; F.anjaAlly = 'keeper'; F.m15anja = 'stays';
      F.seraTrust = (F.seraTrust || 0) - 1;
      F.factionSupport = F.factionSupport || [];
      if (!F.factionSupport.some(s => s.id === 'harrow-lantern')) F.factionSupport.push({ id: 'harrow-lantern', faction: 'anja', label: 'Anja Vale lends Kai the Lantern key: one held second of stability in the finale' });
      ev('The lock holds', 'Kai tuned the Lantern\'s three rings to what really happened: 07:56 at the station, 07:40 at the school, the Lantern\'s own ignition at 16:40. The tears closed. Harrow Reach keeps its day and forgets; Anja keeps remembering for it.', 'THE CHOICE');
      // the plaza, the next morning that is the same morning
      teo.root.position.set(4.2, 0, 12.4); pl.place(2.4, 0, 10.6, Math.PI * 0.75);
      await game.shot([0, 1.7, 7.6], [4.2, 1.2, 12.4], 1.6, { fov: 36 });
      await game.say('m15teo', 'Mister. What day is it tomorrow?');
      await game.say('kai', 'Thursday. It\'s a good one.');
      // the gate
      pl.place(64.2, 0, 13.8, -Math.PI / 2); anja.root.position.set(63.6, 0, 11.6); anja.root.rotation.y = -Math.PI / 2; anja.pose = null; sera.root.position.set(69.4, 0, 12.6);
      await game.shot([60.4, 1.8, 17.4], [67, 1.6, 12.6], 2.0, { fov: 42 });
      await convo(sera, [
        ['sera', 'They\'ll never know you were here.'],
        ['kai', 'Someone will. It\'s in the archive now, in the right column.'],
        ['sera', 'You let them forget. Like the world forgot what you did.'],
      ]);
      await convo(anja, [
        ['anja', 'If you ever need the world to hold still for one second, Varen, call me. I\'ll be here. I\'m always here.'],
      ]);
      S.choiceLine = 'The lock holds';
    } else {
      lockMusic('m15-free', 1.4);
      await game.shot([5, 2.0, -21], [0, 6, -30], 1.6, { fov: 46 });
      await tween(3.2, u => { W.lanternPulse = 1 - u; W.core.material.opacity = 0.75 * (1 - u); W.coreHalo.material.opacity = 0.18 * (1 - u); W.beamOn = 1 - u; W.ringSpeed = 1 - u; W.haze.material.opacity = 0.1 * (1 - u); W.gateVeil.material.opacity = 0.16 * (1 - u); });
      await tween(2.4, u => { wave.scale.setScalar(1 + u * 140); wave.material.opacity = 0.5 * (1 - u); });
      audio.sfxPlay('motif');
      await game.say('anja', 'There. Listen. That\'s the first second of the fifteenth of May.');
      clockTex('15 MAY', '2193 · 00:00');
      await game.shot([16, 4.6, 12], [10, 5.4, 6], 1.8, { fov: 30 });
      await game.wait(0.8); clockTex('?? 2196', 'TOMORROW');
      // the city remembers
      wren.root.position.set(-83.4, 0, 4.4); wren.root.rotation.y = -Math.PI / 2; wren.crouch = 1; pip.root.position.set(-84.6, 0, 5.2); pip.root.rotation.y = Math.PI / 2; pip.pose = null; wren.lookTarget = pip.head; pip.lookTarget = wren.head;
      await game.shot([-79.6, 1.3, 8.8], [-84, 1.0, 4.8], 2.6, { fov: 36 });
      await game.say('wren', 'Pip. Your dad\'s train left early. I sent it. I\'m sorry.');
      await game.say('pip', '...I know. I remembered. I think I always knew.');
      okafor.root.position.set(51.2, 0, -16.6); okafor.root.rotation.y = -Math.PI / 2; okafor.pose = 'sad';
      await game.shot([46.6, 1.2, -13.6], [51.2, 1.0, -16.6], 2.2, { fov: 36 });
      await game.say('okafor', 'Twenty-four. Nine went to the coast. Nine. I have to write to them.');
      tully.root.position.set(P.epic[0] + 1.4, 0, P.epic[2] - 1.6); tully.root.rotation.y = 0.6; tully.pose = 'sad';
      await game.shot([P.epic[0] + 5, 2.2, P.epic[2] - 6], [P.epic[0], 0.6, P.epic[2]], 2.4, { fov: 40 });
      await game.say('tully', 'Forty-one. I knew every one of them by what they bought.');
      F.m15cityFreed = true; F.m15lantern = 'dark'; F.harrowFreed = true; F.anjaAlly = 'free'; F.m15anja = 'joins';
      F.seraTrust = (F.seraTrust || 0) + 1;
      F.factionSupport = F.factionSupport || [];
      if (!F.factionSupport.some(s => s.id === 'harrow-reach')) F.factionSupport.push({ id: 'harrow-reach', faction: 'sera', label: 'The people of Harrow Reach remember, and march with Sera\'s survivors' });
      if (!F.factionSupport.some(s => s.id === 'anja-diagnosis')) F.factionSupport.push({ id: 'anja-diagnosis', faction: 'anja', label: 'Dr. Anja Vale reads unstable temporal zones for Kai in the finale' });
      ev('Tomorrow', 'Kai and Anja released the Lantern\'s rings in the order the day happened: 07:40, 07:56, 16:40. The lock opened. Harrow Reach remembers three years at once, the train, the nine children and the forty-one under the roof, and the fifteenth of May finally came.', 'THE CHOICE');
      // the gate
      W.gateBar.enabled = false;
      pl.place(64.2, 0, 13.8, -Math.PI / 2); anja.root.position.set(63.6, 0, 11.6); anja.root.rotation.y = -Math.PI / 2; anja.pose = null; sera.root.position.set(68.6, 0, 12.6);
      const marchers = [0, 1, 2, 3].map(k => { const ch = loopActors.market[k] || loopActors.station[k]; ch.root.position.set(58 - k * 1.3, 0, 16.4 - (k % 2) * 1.2); ch.root.rotation.y = Math.PI / 2; ch.pose = null; return ch; });
      void marchers;
      await game.shot([60.4, 1.8, 17.4], [67, 1.6, 12.6], 2.0, { fov: 42 });
      await convo(sera, [
        ['sera', 'You let them remember. Even the parts with your name in them.'],
        ['kai', 'Especially those.'],
      ]);
      await game.say('m15res', 'We\'re coming with you. Whoever you are, Varen. We\'ve had enough of one day.');
      await convo(anja, [['anja', 'And me. Someone has to explain to your Sera how a Lantern works, before somebody builds another one.']]);
      S.choiceLine = 'Tomorrow came';
    }
    kai.lookTarget = null; sera.lookTarget = null;

    // ---------- completion ----------
    F.m15done = true; F.m15shards = S.shards; F.m15notes = S.notes; F.m15evidence = S.ev.size; F.m15tears = 3;
    F.m15mara = F.m15mara || 'none'; F.m15dualArchive = !!S.dual;
    F.factionStanding = F.factionStanding || 'neutral';
    await game.shot([90, 34, 50], [0, 10, -30], 5.0, { fov: 50 });
    await ui.fade(1, 2600);
    const mins = Math.round((game.time - tStart) / 60);
    await ui.chapterCard('MISSION 15 COMPLETE', 'The City That Forgot Tomorrow', `${S.choiceLine} · Records 9/9 · Shards ${S.shards}/5 · Notes ${S.notes}/6${S.dual ? ' · Two records: solved' : ''}${mins ? ' · ' + mins + ' min' : ''}`, 4200);
    for (const k of ['station', 'school', 'market']) L[k].dispose();
    delete T.canSwitch; kai.lookTarget = null;
    game.releaseCam(); ui.letterbox(false); audio.allBeds?.(0); audio.setTheme(null);
    window.__m15 = null;
  },
};
