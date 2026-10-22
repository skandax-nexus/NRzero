// MISSION 16 · THE MUSEUM OF FAILED WORLDS (Act III) — humanize erased timelines.
// Bible beats: play three short memories from different versions of one event · compare artifacts with the current
// world · determine which version best explains the museum evidence · find a photograph of older Kai and Mira.
// Quote: "We had a thousand chances. We only needed one that was ours."
// Ending: the museum proves the Witness has repeated the experiment many times.
// 2196. Under the Hollow Archive of Harrow Reach lies an undercroft where things from erased worlds wash up: Edie Lark
// keeps them. Its Founder (the Witness) built three listening rooms that each replay 19.10.2026, 08:12-08:14, from a
// world that no longer exists. In 2049 the same rooms are Store B-3 of the Rain City Civic Museum, where the current
// world's copies of the same objects sit in crates. Memories are LocalLoops (src/systems/loops.js): miss what matters
// and the morning slips back to 08:12, keeping what Kai noticed.
// Optional: the eight strays in the Hall of Ordinary Things, five temporal shards, the visitors' book, the catalogue,
// Edie's music box (her own accession card), the echo of world 0412, talks with Edie and Mara.
import * as THREE from 'three';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { glowMat } from '../world/kit.js';
import { LocalLoop, loopRoutine } from '../systems/loops.js';
import { buildMuseum, registerM16Cast, registerM16Themes, musicState, P, EXHIBITS, SHARDS, MEMS, COMPARE, VISITORS_2026, TEX, photoTexture } from '../world/env_m16.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const HALL = [300, 0, 10, PI], KITCHEN = [296.6, 0, 50.4, PI];
const CHAIR_OUT = [[-13.5, 0, -1.4, PI / 2], [13.5, 0, -1.4, -PI / 2], [-13.5, 0, -21.4, PI / 2]];
const TRAY_AT = [[12, 1, -16.6], [8.6, 1, -19.9], [15.4, 1, -19.9]];
const FRONT_SPEED = 4.2, FRONT_WAIT = 9.5;

export default {
  id: 'm16', act: 'ACT III · THE LAST VERSION OF EARTH', title: 'The Museum of Failed Worlds', sub: 'Erased timelines',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM16Cast(); registerM16Themes();
    try {
      const need = ['edie', 'mara', 'mother', 'm16kai7', 'm16mira10', 'm16desk', 'm16guide'].filter(id => !ui.portraits[id] && CAST[id]?.look);
      if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]]))));
    } catch (err) { console.warn('m16 portraits', err); }
    const metMara = !!(F.m15mara && F.m15mara !== 'none'), dual = !!(F.m15dualArchive || F.dualArchive);
    const metWitness = !!(F.metWitness || F.m12witnessSeen);

    const scene = game.newScene({ background: 0x0c0a08, fog: [0x17120d, 0.03], exposure: 1.05, bloom: 0.55, bloomThreshold: 0.82, envIntensity: 0.3, killY: -6, residue: true });
    await tick();

    // ---------- state ----------
    const S = {
      phase: 'intro', obj: '', seen: {}, ev: new Set(), busy: false, main: false, lastProgress: 0,
      mem: [false, false, false], inMem: -1, tray: [false, false, false], crate: [false, false, false], cmp: [false, false, false], cmpMiss: 0,
      zero: { looked: false, prints: false }, version: null, versionMiss: 0, ledger: false, dialMiss: 0, studyOpen: false,
      front: { x: 31, mode: 'wait', t: FRONT_WAIT }, rewinds: 0, box: false, photo: false, register: false, bands: false, emptyCase: false, echo: false,
      strays: new Set(), shards: 0, book: false, catalogue: false, edieTalk: 0, maraTalk: 0, coat: false,
    };
    let musicLock = null, lookReady = false;
    T.configure([
      { id: '2049', key: '2', name: 'PRESENT', year: 'STORE · 2049', glyph: '◎', color: '#5fe6ff', theme: 'm16-store', apply: () => { if (lookReady) applyLook(); } },
      { id: '2196', key: '3', name: 'FUTURE', year: 'MUSEUM · 2196', glyph: '◑', color: '#ffc890', theme: 'm16-museum', apply: () => { if (lookReady) applyLook(); } },
    ], '2196');
    T.unlocked = false;

    const W = buildMuseum(game, scene, T);
    game.onUpdate((dt, t) => W.update(dt, t));
    await tick();

    // ---------- light: lantern amber (2196), strip-light white (2049), a bright Sunday (the hall), rain (the kitchen) ----------
    const memPlace = (p = pl.pos) => (p.x > 200 ? (p.z > 30 ? 'kitchen' : 'hall') : null);
    const hemi = new THREE.HemisphereLight(0xffd8b0, 0x2a2018, 0.35); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d8, 0); sun.position.set(320, 30, 40); sun.target.position.set(300, 0, 0); scene.add(sun, sun.target);
    const pts = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    const LOOK = {
      '2196': { fog: [0x17120d, 0.03], hemi: [0xffd8b0, 0x2a2018, 0.42], sun: 0, exp: 1.08, bg: 0x0c0a08 },
      '2049': { fog: [0x1a1e22, 0.026], hemi: [0xe8f0ff, 0x30343a, 0.6], sun: 0, exp: 1.0, bg: 0x101316 },
      hall: { fog: [0xd8dde0, 0.008], hemi: [0xfff6e8, 0x8a8478, 0.7], sun: 1.0, exp: 0.92, bg: 0xdce8f0 },
      kitchen: { fog: [0x6a747a, 0.02], hemi: [0xb8c4cc, 0x4a443c, 0.75], sun: 0, exp: 1.0, bg: 0x4a545a },
    };
    let lookKey = null;
    function applyLook() {
      const k = memPlace() || T.current; lookKey = k;
      const L = LOOK[k] || LOOK['2196'];
      scene.fog.color.set(L.fog[0]); scene.fog.density = L.fog[1]; scene.background = new THREE.Color(L.bg);
      hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2]; sun.intensity = L.sun;
      renderer.toneMappingExposure = L.exp;
      audio.rain(k === 'kitchen' ? 0.3 : 0); audio.hum(k === '2049' ? 0.03 : k === '2196' ? 0.012 : 0, k === '2049' ? 60 : 46);
      audio.wind(k === '2196' ? 0.04 : 0); audio.crowd?.(k === 'hall' ? 0.06 : 0);
      lightT = 0; music();
    }
    let lightT = 0;
    const rigLights = () => {
      const p = game.cine ? game.engine.camera.position : pl.pos, e = memPlace() ? 'mem' : T.current;
      const list = W.lightSrc.filter(s => s.era === e || (s.era === 'all' && e !== 'mem')).map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      pts.forEach((l, i) => { const s = list[i]; if (!s || s.dd > 40 * 40) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
    };
    game.onUpdate(dt => { lightT -= dt; if (lightT <= 0) { lightT = 0.35; rigLights(); if ((memPlace() || T.current) !== lookKey) applyLook(); } });
    T.onSwitch(() => { lightT = 0; });

    // ---------- helpers ----------
    const near = (x, z, r) => Math.hypot(pl.pos.x - x, pl.pos.z - z) < r;
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag) => { if (S.ev.has(title)) return; S.ev.add(title); ui.addEvidence(title, text, tag); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const choose = (id, text, opts, correct = 0) => { if (game.autoplay) game.autoChoice = game.autoQueue?.length ? game.autoQueue.shift() : correct; return game.choice(id, text, opts); };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive || S.busy) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u)); if (u >= 1) { off(); res(); } }); });
    const progress = () => { S.lastProgress = game.time; };
    const side = async (fn) => {
      if (S.busy || !game.control) return; S.busy = true;
      try { await fn(); } catch (err) { if (!err?.abort) console.warn('m16 side', err); else throw err; } finally { S.busy = false; if (!S.main) { game.control = true; ui.letterbox(false); game.releaseCam(); } }
    };
    const kai = pl.char;
    const inMuseum = (p = pl.pos) => p.x < 45;
    const act = (o) => {
      const it = game.interact({ radius: 1.8, ...o, once: false, onUse: (x) => { if (S.busy || game._failing) return; if (o.enabled && !o.enabled()) return; if (o.states && !o.states.includes(T.current)) return; o.onUse(x); } });
      it.done = () => game.removeInteract(it);
      return it;
    };
    const follow = (it, ch, y = 1) => game.onUpdate(() => { it.pos.set(ch.root.position.x, y, ch.root.position.z); });

    // era switching: only in the museum, and never into something solid in the other year
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
      if (!inMuseum()) return false;
      if (solidAt(id)) { if (once('solid' + id + Math.floor(game.time / 3))) { ui.toast(`SOLID HERE IN ${id} · MOVE TO OPEN FLOOR`, 1800); audio.sfxPlay('fail'); } return false; }
      return true;
    };

    // ---------- music follows the beats and the place ----------
    let curTheme = null;
    const themeFor = () => {
      if (musicLock) return musicLock;
      const mp = memPlace(); if (mp) return mp === 'kitchen' ? 'm16-rain' : 'm16-memory';
      if (T.current === '2049') return 'm16-store';
      if (S.phase === 'stacks') return 'm16-stacks';
      if (S.phase === 'study') return 'm16-founder';
      if (S.phase === 'zero' && pl.pos.z < -35) return 'm16-reveal';
      return 'm16-museum';
    };
    function music(fade = 1.6) { const th = themeFor(); for (const d of T.defs) d.theme = th; if (th !== curTheme) { curTheme = th; audio.setTheme(th, fade); } }
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    let musT = 0; game.onUpdate(dt => { musT -= dt; if (musT <= 0) { musT = 0.5; music(); } });
    lookReady = true; applyLook();

    // conversations: both people turn to each other, then an over-the-shoulder shot of whoever speaks
    const small = new Set();
    const posOf = (ch) => (ch === kai ? pl.pos : ch.root.position);
    const faceEach = (a, b) => {
      const pa = posOf(a), pb = posOf(b), ya = Math.atan2(pb.x - pa.x, pb.z - pa.z), yb = Math.atan2(pa.x - pb.x, pa.z - pb.z);
      if (a === kai) { pl.yaw = ya; kai.root.rotation.y = ya; } else a.root.rotation.y = ya;
      if (b === kai) { pl.yaw = yb; kai.root.rotation.y = yb; } else b.root.rotation.y = yb;
      a.lookTarget = b.head; b.lookTarget = a.head;
    };
    const ots = (speaker, listener, dur = 0.8, fov = 36) => {
      const sp = posOf(speaker), l = posOf(listener), dx = sp.x - l.x, dz = sp.z - l.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
      const sd = 0.7 + Math.max(0, 2.2 - d) * 0.45, back = 1.35, sy = small.has(speaker) ? 1.1 : 1.56, ly = l.y + (small.has(listener) ? 1.2 : 1.64);
      return game.shot([l.x - ux * back + uz * sd, ly, l.z - uz * back - ux * sd], [sp.x, sp.y + sy, sp.z], dur, { fov });
    };
    const convo = async (other, lines) => {
      if (other) {
        const o = other.root.position, dx = pl.pos.x - o.x, dz = pl.pos.z - o.z, d = Math.hypot(dx, dz);
        if (d < 1.55 && d > 0.01 && Math.abs(pl.pos.y - o.y) < 0.5) pl.place(o.x + dx / d * 1.7, pl.pos.y, o.z + dz / d * 1.7, pl.yaw);
        faceEach(kai, other);
      }
      for (const [id, line] of lines) {
        const sp = id === 'kai' ? kai : (other && CAST[id] && !CAST[id].voice ? other : null);
        if (sp && other) await ots(sp, sp === kai ? other : kai);
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
    game.onUpdate(dt => { if (shiftPulse > 0 && game.engine.fx?.uShift) { shiftPulse = Math.max(0, shiftPulse - dt * 1.2); game.engine.fx.uShift.value = shiftPulse * 0.5; } });

    // ---------- people ----------
    const museumPeople = [], memPeople = [];
    game.onUpdate(() => {
      const inMem = !!memPlace(), on96 = T.current === '2196' && !inMem;
      for (const ch of museumPeople) { const v = on96 && !ch.hidden; if (ch.root.visible !== v) ch.root.visible = v; }
      for (const ch of memPeople) { const v = inMem && !ch.hidden; if (ch.root.visible !== v) ch.root.visible = v; }
    });
    const edie = game.actor('edie', null, ...P.edie, -PI / 2); museumPeople.push(edie);
    await tick();
    const mara = game.actor('mara', null, ...P.maraStart, PI); museumPeople.push(mara);
    await tick();
    const mother = game.actor('mother', null, 292.6, 0, 3.8, PI / 2); memPeople.push(mother);
    const mira = game.actor('m16mira10', null, 293.8, 0, 3.4, -PI / 2); memPeople.push(mira); small.add(mira);
    await tick();
    const kid = game.actor('m16kai7', null, 293.4, 0, 4.4, -PI / 2); memPeople.push(kid); small.add(kid);
    const guide = game.actor('m16guide', null, 303.6, 0, -3.0, -PI / 2); memPeople.push(guide);
    await tick();
    const desk = game.actor('m16desk', null, 309.5, 0, 4.2, -PI / 2); memPeople.push(desk); desk.pose = 'work';
    const visitors = VISITORS_2026.map((lk, i) => { const ch = game.ambient(lk, 288 + i * 3, 0, 8 - i * 2, PI); memPeople.push(ch); return ch; });
    await tick();
    window.__m16 = { S, W, T, P, edie, mara, mother, mira, kid, guide, desk };

    // ---------- objectives ----------
    const nMem = () => S.mem.filter(Boolean).length, nCmp = () => S.cmp.filter(Boolean).length;
    function refreshObjective() {
      if (S.inMem >= 0 || S.main) return;
      if (S.phase === 'memories') {
        if (nMem() < 3 || nCmp() < 3) {
          const ready = [0, 1, 2].filter(i => S.mem[i] && !S.cmp[i]);
          objective(`Play the memories in the Listening Rooms (${nMem()}/3) · compare each artifact in the Concordance (${nCmp()}/3)` + (ready.length ? (S.crate[ready[0]] ? '' : ' · its crate is in Store B-3 (2049)') : ''));
        }
      } else if (S.phase === 'zero') {
        if (!S.zero.looked) objective('Examine Accession Zero in the rotunda');
        else if (!S.zero.prints) objective('Accession Zero: look at the fragment with Residue Vision (F)');
        else objective('Decide which morning explains Accession Zero');
      } else if (S.phase === 'stacks') objective(S.ledger ? 'Cross the stacks to the Founder\'s study · the register says shelf STUDY: world 0412' : 'Cross the stacks to the Founder\'s study · hide in the alcoves from the unmaking');
      else if (S.phase === 'study') {
        const left = [!S.photo && 'the desk', !S.register && 'the lectern', !S.bands && 'the wall of bands'].filter(Boolean);
        objective(left.length ? 'Search the Founder\'s study: ' + left.join(', ') : 'The Founder\'s study');
      }
    }
    let objT = 0; game.onUpdate(dt => { objT -= dt; if (objT <= 0) { objT = 0.8; refreshObjective(); } });

    // ======================================================================================================
    // THE MEMORIES: 19.10.2026, 08:12 - 08:14, three times (LocalLoops on the memory stage)
    // ======================================================================================================
    const memLoops = [];
    const cast = [[mother, mira, guide, desk, ...visitors], [mother, mira, kid, guide, desk, ...visitors], [mother, mira, kid]];
    const routinePeople = new Map();
    const memRoutine = (lp, ch, keys) => { loopRoutine(lp, ch, keys); };
    for (let i = 0; i < 3; i++) {
      const kitchen = i === 2;
      const lp = new LocalLoop(game, {
        id: 'm16mem' + MEMS[i].id, label: 'WORLD ' + MEMS[i].world + ' · ' + MEMS[i].name.toUpperCase(), duration: kitchen ? 120 : 129, clock: 8 * 3600 + 12 * 60,
        restart: kitchen ? KITCHEN : HALL, region: p => p.x > 200, autoStart: false, persist: false, resetToast: 'THE MORNING SLIPS BACK TO 08:12 · YOU KEEP WHAT YOU NOTICED',
      });
      lp.need = 3; lp.memIndex = i;
      memLoops.push(lp);
    }
    void routinePeople; window.__m16.L = memLoops;
    // the hall: visitors drift between the banner, the benches and the ring
    for (const lp of [memLoops[0], memLoops[1]]) {
      visitors.forEach((v, k) => {
        const a = [[288.6, 0, 9 - k], [304.6, 0, 8.4 - k * 0.6], [290.6, 0, -6 - k], [297 + k, 0, -2.6]][k], b = [[296.6, 0, -1.4], [295.2, 0, 1.2 + k], [303.2, 0, -1.6], [289.6, 0, 8.6]][k];
        memRoutine(lp, v, [{ t: 0, pos: a, hold: true, pose: 'look' }, { t: 16 + k * 7, pos: a }, { t: 34 + k * 7, pos: b, hold: true, pose: k % 2 ? 'look' : null }, { t: 70 + k * 6, pos: b }, { t: 90 + k * 6, pos: a, hold: true }]);
      });
      memRoutine(lp, guide, [{ t: 0, pos: [303.6, 0, -3.0], ry: -PI / 2, hold: true }]);
      memRoutine(lp, desk, [{ t: 0, pos: [309.5, 0, 4.2], ry: -PI / 2, hold: true, pose: 'work' }]);
    }
    // World 0031: Mira and her mother; Kai stayed home with a fever
    memRoutine(memLoops[0], mother, [{ t: 0, pos: [292.6, 0, 3.8], ry: PI / 2, hold: true }, { t: 66, pos: [292.6, 0, 3.8] }, { t: 74, pos: [306.4, 0, 5.2], ry: PI / 2, hold: true }, { t: 112, pos: [306.4, 0, 5.2], ry: PI, pose: 'look', hold: true }]);
    memRoutine(memLoops[0], mira, [{ t: 0, pos: [293.8, 0, 3.4], ry: -PI / 2, hold: true }, { t: 44, pos: [293.8, 0, 3.4] }, { t: 50, pos: [299.2, 0, -3.3], ry: PI, pose: 'look', hold: true }, { t: 123, pos: [299.2, 0, -3.3] }, { t: 125, pos: [299.4, 0, -5.6], ry: PI, pose: 'look', hold: true }]);
    // World 0207: both children, their mother at the desk
    memRoutine(memLoops[1], mother, [{ t: 0, pos: [292.6, 0, 3.8], ry: PI / 2, hold: true }, { t: 30, pos: [292.6, 0, 3.8] }, { t: 38, pos: [306.4, 0, 5.0], ry: PI / 2, hold: true }, { t: 104, pos: [306.4, 0, 5.0] }, { t: 112, pos: [296.4, 0, 0.6], ry: PI, pose: 'look', hold: true }]);
    memRoutine(memLoops[1], mira, [{ t: 0, pos: [293.8, 0, 3.4], ry: -PI / 2, hold: true }, { t: 36, pos: [293.8, 0, 3.4] }, { t: 44, pos: [299.0, 0, -3.3], ry: PI, pose: 'look', hold: true }, { t: 123, pos: [299.0, 0, -3.3] }, { t: 125, pos: [299.3, 0, -5.6], ry: PI, pose: 'look', hold: true }]);
    memRoutine(memLoops[1], kid, [{ t: 0, pos: [293.4, 0, 4.4], ry: -PI / 2, hold: true }, { t: 36, pos: [293.4, 0, 4.4] }, { t: 44, pos: [300.0, 0, -3.3], ry: PI, pose: 'look', hold: true }]);
    // World 0388: the rain morning in the kitchen on Calder Row
    memRoutine(memLoops[2], mother, [{ t: 0, pos: [298.4, 0, 45.6], ry: PI / 2, hold: true, pose: 'work' }, { t: 100, pos: [298.4, 0, 45.6], ry: PI / 2, hold: true }, { t: 104, pos: [297.0, 0, 48.8], ry: -PI / 2, hold: true }]);
    memRoutine(memLoops[2], kid, [{ t: 0, pos: [296.2, 0, 47.8], ry: -PI / 2, hold: true, pose: 'sit' }]);
    memRoutine(memLoops[2], mira, [{ t: 0, pos: [295.0, 0, 43.3], ry: PI, pose: 'look', hold: true }, { t: 56, pos: [295.0, 0, 43.3] }, { t: 64, pos: [291.4, 0, 47.8], ry: -PI / 2, pose: 'look', hold: true }]);

    const memLp = () => (S.inMem >= 0 ? memLoops[S.inMem] : null);
    const clue = (i, key, text) => { const lp = memLoops[i]; if (lp.learn(key, text)) { progress(); audio.sfxPlay('pickup'); } };
    // a memory conversation: the loop holds its breath while Kai listens
    const memTalk = (fn) => side(async () => { const lp = memLp(); if (lp) lp.paused = true; try { await fn(); } finally { if (lp) lp.paused = false; } });
    const inLoop = (i, t0, t1) => S.inMem === i && memLoops[i].t >= t0 && memLoops[i].t < t1 && !memLoops[i]._resetting;
    // --- 0031 ---
    act({ pos: [307.0, 1.1, 3.0], radius: 1.7, prompt: 'Read the front-desk log', enabled: () => S.inMem === 0 && !memLoops[0].knows('log'), onUse: () => memTalk(async () => {
      W.mem.log1.visible = true; W.mem.log2.visible = false;
      await game.shot([306.4, 1.8, 3.6], [308.2, 1.1, 3.0], 1.0, { fov: 34 });
      await game.say('kai', 'E. Varen, escort. M. Varen, visitor. That\'s all. No K.');
      await game.say('m16desk', 'Just the one today? Shame about your little boy. A fever on open day.');
      clue(0, 'log', 'The desk log: one Varen child · Kai is not here');
    }) });
    { const it = act({ pos: [292.6, 1, 3.8], radius: 2.0, prompt: 'Listen to Elena Varen', enabled: () => inLoop(0, 0, 44) && !memLoops[0].knows('fever'), onUse: () => memTalk(async () => {
      await game.shot([290.4, 1.5, 5.6], [293.2, 1.3, 3.6], 1.0, { fov: 38 });
      mother.lookTarget = mira.head; mira.lookTarget = mother.head;
      await game.say('m16mira10', 'He\'ll be so cross. He wanted to see the ring more than me.');
      await game.say('mother', 'Kai\'s got a temperature, love. He\'ll see it next year.');
      await game.say('m16mira10', 'You always say next year.');
      mother.lookTarget = null; mira.lookTarget = null;
      clue(0, 'fever', '08:12 · Kai stayed home with a fever');
    }) }); follow(it, mother); }
    { const it = act({ pos: [299.2, 1, -3.3], radius: 2.2, prompt: 'Listen at the rope', enabled: () => inLoop(0, 50, 124) && !memLoops[0].knows('rope'), onUse: () => memTalk(async () => {
      await game.shot([301.6, 1.4, -0.6], [299.6, 1.2, -4.6], 1.0, { fov: 38 });
      mira.lookTarget = guide.head; guide.lookTarget = mira.head;
      await game.say('m16mira10', 'Does it hum for everybody?');
      await game.say('m16guide', 'Only for the people who listen. Behind the rope, please.');
      await game.say('m16mira10', 'I am listening.');
      mira.lookTarget = null; guide.lookTarget = null;
      clue(0, 'rope', '08:13 · Mira alone at the rope, listening to the ring');
    }) }); follow(it, mira); }
    // --- 0207 ---
    act({ pos: [307.0, 1.1, 3.0], radius: 1.7, prompt: 'Read the front-desk log ', enabled: () => S.inMem === 1 && !memLoops[1].knows('log'), onUse: () => memTalk(async () => {
      W.mem.log1.visible = false; W.mem.log2.visible = true;
      await game.shot([306.4, 1.8, 3.6], [308.2, 1.1, 3.0], 1.0, { fov: 34 });
      await game.say('kai', 'Two badges. M. Varen. K. Varen, accompanied. Eight-oh-two.');
      await game.say('kai', 'That\'s me. I\'m in this one.');
      clue(1, 'log', 'The desk log: two Varen children · K. VAREN, accompanied');
    }) });
    { const it = act({ pos: [306.4, 1, 5.0], radius: 2.0, prompt: 'Listen to Elena at the desk', enabled: () => inLoop(1, 38, 104) && !memLoops[1].knows('desk'), onUse: () => memTalk(async () => {
      await game.shot([304.4, 1.6, 7.4], [307.4, 1.3, 4.6], 1.0, { fov: 38 });
      mother.lookTarget = desk.head; desk.lookTarget = mother.head;
      await game.say('mother', 'Sorry. His badge says accompanied, but he\'s run off with his sister.');
      await game.say('m16desk', 'They all go straight to the ring. It\'s roped off, they\'ll be fine.');
      await game.say('mother', 'Five minutes, you two! Stay where I can see you!');
      mother.lookTarget = null; desk.lookTarget = null;
      clue(1, 'desk', '08:12 · Elena at the desk · the children alone at the ring');
    }) }); follow(it, mother); }
    { const it = act({ pos: [299.5, 1, -3.3], radius: 2.2, prompt: 'Listen to the children', enabled: () => inLoop(1, 44, 123) && !memLoops[1].knows('kids'), onUse: () => memTalk(async () => {
      await game.shot([302.2, 1.1, -0.8], [299.5, 1.0, -3.6], 1.0, { fov: 40 });
      mira.lookTarget = kid.head; kid.lookTarget = mira.head;
      await game.say('m16mira10', 'Kai. It\'s humming. Can you hear it?');
      await game.say('m16kai7', 'Mum said don\'t.');
      await game.say('m16mira10', 'Mum\'s at the desk. Hold my hand. Then it\'s both of us, and nobody\'s in trouble.');
      mira.lookTarget = null; kid.lookTarget = null;
      await game.say('kai', 'The blue coat. I remember the coat. I don\'t remember this.');
      clue(1, 'kids', '08:13 · Mira asks Kai to hold her hand');
    }) }); follow(it, mira); }
    // --- 0388 ---
    act({ pos: [298.6, 1.2, 44.4], radius: 1.8, prompt: 'Listen to the radio', enabled: () => inLoop(2, 6, 112) && !memLoops[2].knows('radio'), onUse: () => memTalk(async () => {
      await game.shot([297.0, 1.6, 46.0], [299.0, 1.0, 44.4], 1.0, { fov: 36 });
      await game.say('m16radio', 'Storm warnings across Rain City this morning. Helix Temporal Research has cancelled today\'s open day.');
      await game.say('m16mira10', 'Cancelled? They can\'t cancel it. It\'s been there for ever.');
      await game.say('mother', 'It\'ll be there next year, love.');
      clue(2, 'radio', '08:12 · The radio: a storm · the open day is cancelled');
    }) });
    act({ pos: [298.2, 1.3, 49.1], radius: 1.8, prompt: 'Look at the drawing on the fridge', enabled: () => S.inMem === 2 && !memLoops[2].knows('drawing'), onUse: () => memTalk(async () => {
      await game.shot([297.0, 1.5, 50.2], [298.8, 1.3, 49.1], 1.0, { fov: 30 });
      await game.say('kai', 'Me, Mira, the machine. Rook kept this in a file. Here it\'s still on the fridge.');
      await game.say('m16kai7', 'That\'s the machine. It makes it so nobody has to go to hospital.');
      clue(2, 'drawing', 'The drawing on the fridge · ME · MIRA · THE MACHINE');
    }) });
    { const it = act({ pos: [291.4, 1, 47.8], radius: 2.0, prompt: 'Watch Mira at the clock', enabled: () => inLoop(2, 64, 115) && !memLoops[2].knows('clock'), onUse: () => memTalk(async () => {
      await game.shot([293.4, 1.5, 49.6], [290.6, 2.0, 47.8], 1.0, { fov: 36 });
      await game.say('m16mira10', 'It\'s slow. It\'s always slow. Kai, what time is it really?');
      await game.say('m16kai7', 'Eight... thirteen?');
      await game.say('m16mira10', 'Then it\'s nearly the time they open the ring. Without us.');
      clue(2, 'clock', '08:13 · Mira at the kitchen clock, minutes before 08:14');
    }) }); follow(it, mira); }

    // what happens at 08:14 (only when Kai has seen enough; otherwise the morning slips back)
    let memEnding = null;
    memLoops.forEach((lp, i) => {
      lp.at(lp.duration - 3.5, () => {
        if (S.inMem !== i) return;
        if (lp.known >= lp.need) { lp.paused = true; memEnding = i; } else lp.reset('THE MORNING SLIPS BACK TO 08:12 · YOU KEEP WHAT YOU NOTICED');
      });
      lp.onReset(() => { W.mem.halo.material.opacity = 0; mira.pose = null; kid.pose = null; W.mem.clock.material.map = TEX.clock(8, 13, false); W.mem.clock.material.emissiveMap = W.mem.clock.material.map; });
      lp.at(30, () => { if (S.inMem === i && lp.known === 0 && lp.iteration === 1) ui.subtitle('kai', ['Same hall. Same morning. Find out how this one is different.', 'Different people at the ring this time. Watch them.', 'Our kitchen. It\'s raining.'][i], 3000); });
      lp.at(lp.duration - 20, () => { if (S.inMem === i && lp.known < lp.need) ui.subtitle('kai', 'Nearly 08:14. I haven\'t seen enough of this one yet.', 2600); });
    });

    async function playMemory(i) {
      const lp = memLoops[i], m = MEMS[i];
      S.main = true; S.inMem = i; cine(true); progress();
      lockMusic('m16-814', 1.2);
      const chair = i === 0 ? P.chairI : i === 1 ? P.chairII : P.chairIII, cs = i === 0 ? P.caseI : i === 1 ? P.caseII : P.caseIII;
      const out = CHAIR_OUT[i];
      pl.place(out[0], 0, out[2], Math.atan2(cs[0] - out[0], cs[2] - out[2])); kai.pose = 'look';
      await game.shot([out[0] + (i === 1 ? -2.2 : 2.2), 1.7, out[2] + 2.4], [chair[0], 1.2, chair[2]], 1.4, { fov: 40 });
      await game.say('m16band', `World ${m.world}. Signature: 19 October 2026. Replaying.`);
      audio.sfxPlay('rewind'); shiftPulse = 1;
      await ui.fade(1, 900);
      kai.pose = null; T.unlocked = false; if (game.residueOn) game.setResidue(false);
      for (const ch of memPeople) ch.hidden = !cast[i].includes(ch);
      mira.pose = null; kid.pose = null; W.mem.halo.material.opacity = 0;
      W.mem.log1.visible = i === 0; W.mem.log2.visible = i === 1;
      W.mem.clock.material.map = TEX.clock(8, 13, false); W.mem.clock.material.emissiveMap = W.mem.clock.material.map; W.mem.clock.material.needsUpdate = true;
      const R = lp.restart; pl.place(R[0], R[1], R[2], R[3]);
      lp.start(0); lp.paused = false; memEnding = null;
      applyLook(); musicLock = null; music(0.6);
      await game.shot(i === 2 ? [291.4, 1.9, 50.8] : [312, 5.2, 12.4], i === 2 ? [297, 1.2, 44] : [298, 2.2, -8], 0.01, { fov: 46 });
      await ui.fade(0, 1100);
      await game.shot(i === 2 ? [292.2, 1.7, 50.6] : [309, 3.8, 11], i === 2 ? [296.5, 1.3, 44.6] : [299, 2.0, -8], 2.6, { fov: 44 });
      ui.toast(`WORLD ${m.world} · ${m.name.toUpperCase()} · SUNDAY 19.10.2026`, 3000);
      if (lp.iteration === 1 && lp.resets === 0) {
        await game.say('kai', i === 0 ? 'Helix. The open day. Eight-twelve.' : i === 1 ? 'The same morning. Again.' : 'Calder Row. Our kitchen.');
        if (i === 0) await game.say('m16band', 'You are a visitor here. They cannot see you. Notice what this morning is made of before 08:14.');
      }
      S.main = false; cine(false);
      objective(`World ${m.world}: notice what this morning is made of before 08:14 (the loop keeps what you notice)`);
      await game.waitFor(() => memEnding === i && !S.busy && !ui.dlgActive);
      // ---------- 08:14 ----------
      S.main = true; cine(true); lockMusic('m16-814', 0.8);
      if (i < 2) {
        await game.shot([295.2, 1.5, 0.4], [299.6, 1.6, -7.6], 1.6, { fov: 40 });
        await walkTo(mira, [[299.4, 0, -6.6]], 0.9); mira.root.rotation.y = PI; mira.pose = 'look';
        if (i === 1) { await walkTo(kid, [[299.9, 0, -6.2]], 1.4); kid.root.rotation.y = PI; kid.pose = 'look'; }
        await game.say('m16mira10', i === 0 ? 'Just once. Nobody\'s looking.' : 'Don\'t let go.');
        if (i === 1) await game.say('m16kai7', 'I won\'t.');
        await game.shot([302.6, 2.2, -4.2], [299.6, 2.4, -9.4], 1.0, { fov: 34 });
        audio.sfxPlay('heartbeat');
        if (W.mem.ring.userData.inner?.material) W.mem.ring.userData.inner.material.emissiveIntensity = 4;
        await tween(1.6, u => { W.mem.halo.material.opacity = 0.42 * u; });
        audio.sfxPlay('anomaly'); game.shake = 0.25;
        mira.pose = 'fall';
        if (i === 1) { kid.pose = 'sad'; walkTo(kid, [[300.6, 0, -4.0]], 2.6); }
        await tween(2.0, u => { W.mem.halo.material.opacity = 0.42 * (1 - u); });
        await game.shot([296.4, 1.0, -2.4], [299.6, 0.4, -6.6], 2.0, { fov: 36 });
        await game.say('m16band', `World ${m.world} ends at 08:14:09.`);
        await game.say('kai', i === 0 ? 'She touched it alone. I wasn\'t there to hold on.' : 'She reached. I held on. My cuff caught on the ring.');
      } else {
        await game.shot([293.8, 1.6, 50.0], [290.6, 2.0, 47.8], 1.6, { fov: 36 });
        await game.say('m16mira10', 'Kai? My hands are buzzing.');
        audio.sfxPlay('heartbeat');
        W.mem.clock.material.map = TEX.clock(8, 14, true); W.mem.clock.material.emissiveMap = W.mem.clock.material.map; W.mem.clock.material.needsUpdate = true;
        await tween(1.2, u => { renderer.toneMappingExposure = 1.0 - 0.35 * u; });
        mira.pose = 'fall'; game.shake = 0.15; audio.sfxPlay('anomaly');
        await game.shot([294.4, 1.3, 50.4], [291.4, 0.5, 47.8], 2.0, { fov: 38 });
        await game.say('mother', 'Mira? Mira!');
        await game.say('m16band', 'World 0388 ends at 08:14:00.');
        await game.say('kai', 'No ring. No open day. She fell anyway, at eight-fourteen, in our kitchen.');
        renderer.toneMappingExposure = 1.0;
      }
      await ui.fade(1, 1200);
      lp.stop(); S.inMem = -1; mira.pose = null; kid.pose = null; W.mem.halo.material.opacity = 0;
      for (const ch of memPeople) ch.hidden = true;
      pl.place(out[0], 0, out[2], out[3]); T.unlocked = true; T.refreshHud?.();
      S.mem[i] = true; F.m16memories = nMem(); musicState.found = nMem();
      W.covers[i].visible = false; W.artifacts[i].visible = true;
      applyLook(); musicLock = null; music(1);
      await game.shot([cs[0] + (i === 1 ? -1.8 : 1.8), 1.7, cs[2] + 1.8], [cs[0], 1.1, cs[2]], 0.01, { fov: 34 });
      await ui.fade(0, 1000);
      await game.shot([cs[0] + (i === 1 ? -1.4 : 1.4), 1.6, cs[2] + 1.4], [cs[0], 1.1, cs[2]], 1.6, { fov: 32 });
      ui.toast(`MEMORY ${nMem()}/3 · ${m.artifact.toUpperCase()}`, 2600);
      ev(`World ${m.world} · ${m.name}`, [
        'Kai stayed home with a fever. Mira went with their mother, slipped under the rope alone and touched the ring at 08:14:09. One badge was issued: M. Varen. It came back scorched.',
        'Kai and Mira were both there. Their mother was at the desk. Mira reached for the ring and asked Kai to hold her hand; at 08:14:09 he held on and his right cuff tore on the ring.',
        'A storm cancelled the Helix open day. Nobody went near the ring. At 08:14:00 Mira collapsed in the kitchen on Calder Row anyway, and the kitchen clock stopped.',
      ][i], 'MEMORY · ' + nMem() + '/3');
      await game.say('kai', ['A world where I wasn\'t there. She still fell.', 'A world where I was there and held on. That one feels like mine.', 'A world without the ring. She still fell. Eight-fourteen finds her wherever she is.'][i]);
      if (nMem() === 1) {
        await game.say('edie', 'You\'ll want the Concordance next door to the third room. Theirs on my trays, ours in the crates. The crates are only there in the other year.');
      } else if (nMem() === 3) {
        await game.say('mara', 'Three mornings, one girl, one minute. The trays will tell you which of them we live in.');
      }
      S.main = false; cine(false); progress(); refreshObjective();
    }
    const chairAt = [P.chairI, P.chairII, P.chairIII];
    chairAt.forEach((c, i) => act({ pos: [c[0] + (i === 1 ? -0.8 : 0.8), 1, c[2]], radius: 1.9, prompt: `Sit in the listening chair · World ${MEMS[i].world}`, states: ['2196'],
      enabled: () => S.phase === 'memories' && !S.mem[i] && S.inMem < 0, onUse: () => { if (!game.control || S.main) return; playMemory(i).catch(err => { if (!err?.abort) console.warn('m16 memory', err); }); } }));

    // ======================================================================================================
    // THE CONCORDANCE: theirs (trays, 2196) against ours (crates, Store B-3, 2049)
    // ======================================================================================================
    const trayCopies = W.artifacts.map((a, i) => { const c = a.clone(); const t = W.trays[i].position; c.position.set(t.x, t.y + 0.05, t.z); c.visible = false; W.groups['2196'].add(c); return c; });
    [0, 1, 2].forEach(i => {
      const cmp = COMPARE.find(c => c.mem === i);
      act({ pos: TRAY_AT[i], radius: 2.1, prompt: `Lay ${MEMS[i].artifact} on the tray`, states: ['2196'], enabled: () => S.mem[i] && !S.tray[i], onUse: () => side(async () => {
        S.tray[i] = true; trayCopies[i].visible = true; audio.sfxPlay('pickup'); progress();
        ui.toast(`THEIRS · ${MEMS[i].artifact.toUpperCase()} · WORLD ${MEMS[i].world}`, 2400);
        if (!S.crate[i]) ui.subtitle('kai', 'Ours is in the crate. In 2049 this room is Store B-3.', 3000);
      }) });
      act({ pos: TRAY_AT[i], radius: 2.1, prompt: 'Open the crate: ' + cmp.crate.split('·').pop().trim().toLowerCase(), states: ['2049'], enabled: () => !S.crate[i], onUse: () => side(async () => {
        S.crate[i] = true; audio.sfxPlay('door'); progress();
        const lid = W.lids[i], y0 = lid.position.y;
        await tween(0.8, u => { lid.position.y = y0 + u * 0.3; lid.rotation.z = u * 0.5; });
        lid.visible = false; W.copies[i].visible = true;
        ui.toast('OURS · ' + cmp.crate, 3000);
        if (!S.mem[i]) await game.say('kai', 'Ours. I need theirs to compare it with. The ' + MEMS[i].room + '.');
        else if (!S.tray[i]) await game.say('kai', 'Now theirs, on the tray. In 2196.');
      }) });
      act({ pos: TRAY_AT[i], radius: 2.1, prompt: 'Compare theirs with ours', enabled: () => S.tray[i] && S.crate[i] && !S.cmp[i], onUse: () => side(async () => {
        cine(true);
        const tp = TRAY_AT[i];
        await game.shot([tp[0] + (i === 2 ? -1.4 : 1.4), 2.0, tp[2] + 1.6], [tp[0], 0.95, tp[2] - 0.6], 1.0, { fov: 38 });
        for (;;) {
          const k = await choose('kai', cmp.q, cmp.opts, cmp.ok);
          if (k === cmp.ok) break;
          S.cmpMiss++; F.m16compareMisses = S.cmpMiss;
          await game.say('kai', ['No. Look at it again: what does ours have that theirs doesn\'t?', 'That\'s not it. The difference is in what happened, not in the object.', 'Not that. Compare the morning, not the label.'][S.cmpMiss % 3]);
        }
        S.cmp[i] = true; F.m16compare = nCmp(); audio.sfxPlay('success'); progress();
        ev('Concordance · ' + MEMS[i].artifact, cmp.why, 'CONCORDANCE · ' + nCmp() + '/3');
        await game.say('kai', cmp.why);
        if (i === 1) await game.say('kai', 'Same tear. Same cuff. Their morning and ours agree.');
        cine(false); refreshObjective();
      }) });
    });

    // ======================================================================================================
    // ACCESSION ZERO: which morning explains the evidence
    // ======================================================================================================
    game.onUpdate(dt => {
      const want = game.residueOn && T.current === '2196' && !memPlace() ? 0.95 : 0;
      W.prints.material.opacity += (want - W.prints.material.opacity) * Math.min(1, dt * 3);
    });
    act({ pos: [0, 1.2, -42.2], radius: 2.2, prompt: 'Examine Accession Zero', states: ['2196'], enabled: () => S.phase === 'zero' && !S.zero.looked, onUse: () => side(async () => {
      cine(true); lockMusic('m16-reveal', 1.2);
      await game.shot([1.8, 1.9, -41.4], [0, 1.25, -44], 1.4, { fov: 34 });
      await game.say('edie', 'Accession Zero. The first thing he ever kept. It turns up in every world on the shelves, the same three pieces.');
      await game.shot([0.9, 1.5, -42.8], [0.45, 1.05, -44.25], 1.2, { fov: 28 });
      await game.say('kai', 'A badge. K. Varen, accompanied. Mine.');
      await game.shot([-1.0, 1.5, -42.6], [-0.4, 1.06, -43.7], 1.2, { fov: 28 });
      await game.say('kai', 'A thread of blue wool. From a cuff.');
      await game.shot([1.2, 1.7, -42.0], [0, 1.3, -44], 1.2, { fov: 32 });
      await game.say('kai', 'And a piece of the ring. There\'s something on the stone I can\'t see.');
      await game.say('edie', 'He used to look at it with his eye half shut, like he was seeing yesterday.');
      S.zero.looked = true; progress();
      ev('Accession Zero', 'A fragment of the Chronolith ring, a thread of blue wool and a visitor badge "K. VAREN · ACCOMPANIED". Found in every world the Founder kept. Label: "Which morning is it? — K."', 'MUSEUM EVIDENCE');
      lockMusic(null); musicLock = null; cine(false); refreshObjective();
      if (!game.residueOn) ui.toast('RESIDUE VISION · F (or the eye button)', 3200);
    }) });
    act({ pos: [0, 1.2, -42.2], radius: 2.2, prompt: 'Read the hand prints on the fragment', states: ['2196'], enabled: () => S.zero.looked && !S.zero.prints && game.residueOn, onUse: () => side(async () => {
      cine(true);
      await game.shot([0.9, 1.6, -42.6], [0.18, 1.5, -43.68], 1.4, { fov: 26 });
      await game.say('kai', 'Two hands. A right hand, ten years old, over a smaller left hand. Seven.');
      await game.say('kai', 'She reached, and I held on.');
      S.zero.prints = true; progress();
      ev('Two hands on the ring', 'In Residue Vision the fragment shows two palm prints: a ten-year-old\'s right hand laid over a seven-year-old\'s left.', 'MUSEUM EVIDENCE');
      cine(false); refreshObjective();
    }) });
    act({ pos: [0, 1.2, -42.2], radius: 2.2, prompt: 'Decide which morning explains Accession Zero', states: ['2196'], enabled: () => S.zero.prints && !S.version, onUse: () => side(async () => {
      cine(true);
      await game.shot([-2.4, 1.8, -40.6], [0, 1.3, -44], 1.0, { fov: 40 });
      for (;;) {
        const k = await choose('kai', 'Which version of 19.10.2026 best explains Accession Zero?', ['World 0031 · The Quiet Morning: Mira alone', 'World 0207 · The Reaching Morning: both of us', 'World 0388 · The Rain Morning: no ring at all'], 1);
        if (k === 1) break;
        S.versionMiss++; F.m16versionMisses = S.versionMiss;
        await game.say('kai', k === 0 ? 'No. In 0031 I stayed home. Then why is my badge here, and two hands on the stone?' : 'No. In 0388 nobody went near the ring. The prints are on the ring.');
      }
      S.version = '0207'; F.m16version = '0207'; audio.sfxPlay('success'); progress();
      lockMusic('m16-reveal', 1.0);
      edie.root.position.set(2.4, 0, -40.6); edie.lookTarget = kai.head;
      await convo(edie, [
        ['kai', 'The Reaching Morning. Two children. Her hand over mine, my badge, a thread from my cuff.'],
        ['edie', 'That\'s what he said too. Every world he keeps has this in it.'],
        ['kai', 'And ours matches. The coat in the crate is missing the same cuff.'],
        ['kai', 'So every one of these worlds started from the same morning. Ours. The others are what came after somebody changed it.'],
        ['edie', 'He never said changed. He said tried.'],
      ]);
      ev('The Reaching Morning', 'Accession Zero, the coat in Store B-3 and the desk log agree with world 0207: Kai was at the ring and held Mira\'s hand. The original morning is ours; every other world in the museum branched from it.', 'DETERMINATION');
      await convo(edie, [
        ['edie', 'The rest of what he kept is in the stacks. His study is at the far end. I\'ve never been past the third alcove.'],
        ['edie', 'The stacks unmake themselves. Something comes down the aisle from his door, like a page being wiped. Stand in a side bay when it comes.'],
      ]);
      await game.shot([5.6, 2.4, -41.2], [9.2, 1.6, -44], 1.4, { fov: 42 });
      audio.sfxPlay('door'); W.doors.stacks.col.enabled = false;
      await tween(1.2, u => { W.doors.stacks.mesh.position.y = u * 3.1; });
      edie.lookTarget = null;
      S.phase = 'stacks'; F.m16determined = true;
      game.checkpoint(12.4, 0, -44, PI / 2);
      musicLock = null; cine(false); refreshObjective();
    }) });

    // ======================================================================================================
    // THE STACKS: the unmaking sweeps the aisle; a collapse in 2196, a security grille in 2049
    // ======================================================================================================
    const inAisle = (p = pl.pos) => p.x > 10.6 && p.x < 31 && p.z > -45.7 && p.z < -42.3;
    let frontWarned = false;
    game.onUpdate(dt => {
      const f = S.front, front = W.front;
      if (S.phase !== 'stacks') { front.visible = false; return; }
      if (!game.control || ui.dlgActive || S.busy || game._failing) return;
      if (f.mode === 'wait') {
        f.t -= dt; front.visible = f.t < 2.2; front.position.x = 30.8; front.material.uniforms.uA.value = Math.max(0, (2.2 - f.t) / 2.2) * 0.6;
        if (f.t < 2.2 && !f.warn) { f.warn = true; if (pl.pos.x > 10.6) audio.sfxPlay('rewind'); }
        if (f.t <= 0) { f.mode = 'run'; f.x = 30.8; f.warn = false; }
      } else {
        const px = f.x; f.x -= FRONT_SPEED * dt; front.position.x = f.x; front.visible = true; front.material.uniforms.uA.value = 1;
        if (inAisle() && pl.pos.x > f.x - 0.45 && pl.pos.x < px + 0.45) {
          S.rewinds++; F.m16stackRewinds = S.rewinds; f.mode = 'wait'; f.t = FRONT_WAIT; front.visible = false;
          game.fail('THE UNMAKING TAKES YOU BACK · WAIT IN A SIDE BAY WHILE IT PASSES');
          return;
        }
        if (f.x < 10.8) { f.mode = 'wait'; f.t = FRONT_WAIT; front.visible = false; }
      }
      if (!frontWarned && pl.pos.x > 11.5 && f.mode === 'run') { frontWarned = true; ui.subtitle('m16band', 'Unmaking front. It runs the aisle every fifteen seconds. Get into a side bay.', 3600); }
    });
    // mid-way checkpoints in the side bays
    let stackCp = 0;
    game.onUpdate(() => {
      if (S.phase !== 'stacks') return;
      if (stackCp < 1 && pl.pos.x > 21.5 && pl.pos.x < 23 && pl.pos.z < -46.4) { stackCp = 1; game.checkpoint(22.25, 0, -48.6, 0); ui.toast('CHECKPOINT', 1400); }
      if (stackCp < 2 && pl.pos.x > 27.5 && pl.pos.x < 29 && pl.pos.z < -46.4) { stackCp = 2; game.checkpoint(28.25, 0, -48.6, 0); ui.toast('CHECKPOINT', 1400); }
    });
    act({ pos: [11.9, 1.1, -43.5], radius: 1.8, prompt: 'Read the register of worlds', states: ['2196'], enabled: () => S.phase === 'stacks' || S.phase === 'study', onUse: () => side(async () => {
      cine(true);
      await game.shot([11.0, 1.9, -44.2], [11.9, 1.1, -42.9], 1.0, { fov: 34 });
      await game.say('kai', 'A register. World, when it ended, how old she was. Ten years. Ten years. Ten years and a day.');
      await game.say('kai', 'World 0412. Ended: nothing. She reached fifty-eight. Shelf: study.');
      await game.say('kai', 'One thousand and forty-six worlds. One of them ours, he says.');
      S.ledger = true; F.m16ledger = true; progress();
      ev('The register of worlds', '1,046 worlds, each with the second it ended and how old Mira was. Almost every one: 08:14, ten years old. World 0412 has no end date: Mira lived to 58. Its shelf is the Founder\'s study.', 'THE STACKS');
      cine(false); refreshObjective();
    }) });
    act({ pos: [22.25, 1, -49.4], radius: 1.6, prompt: 'Take the music box', states: ['2196'], enabled: () => !S.box, onUse: () => side(async () => {
      S.box = true; W.musicBox.visible = false; F.m16musicBox = true; audio.sfxPlay('pickup'); progress();
      ui.toast('A MUSIC BOX · TAG: "D-04 · KEPT FOR E. — K."', 3200);
      await game.say('kai', 'Kept for E. Edie said she came out of the dark holding one of these.');
      ev('A music box', 'Red lacquer, a brass lid, a tag in the Founder\'s hand: "D-04 · kept for E." Found in a side bay of the stacks.', 'STRAY');
    }) });
    // the dial lock on the study door
    act({ pos: [30.3, 1.2, -43.4], radius: 1.7, prompt: 'Turn the dial lock on the study door', enabled: () => S.phase === 'stacks' && !S.studyOpen, onUse: () => side(async () => {
      cine(true);
      await game.shot([29.2, 1.6, -42.4], [31.0, 1.3, -43.2], 0.8, { fov: 30 });
      if (!S.ledger) await game.say('kai', 'Four numbers. A world, probably. The register by the entrance would know which.');
      for (;;) {
        const k = await choose('kai', 'The dial takes four numbers.', ['0031', '0207', '0388', '0412', 'Step back'], 3);
        if (k === 4) { cine(false); return; }
        if (k === 3) break;
        S.dialMiss++; audio.sfxPlay('fail');
        await game.say('kai', S.ledger ? 'No. The register gave this shelf one world. The one with no end.' : 'Not that one. I need the register of worlds at the entrance.');
      }
      S.studyOpen = true; audio.sfxPlay('door'); W.doors.study.col.enabled = false; progress();
      W.dial.rotation.x = 1.2;
      await tween(1.4, u => { W.doors.study.mesh.position.z = -44 - u * 3.0; });
      S.phase = 'study'; W.front.visible = false;
      game.checkpoint(33, 0, -44, PI / 2);
      cine(false); refreshObjective();
    }) });

    // ======================================================================================================
    // THE FOUNDER'S STUDY: the photograph, the register of iterations, the wall of bands
    // ======================================================================================================
    let photoTex = null;
    act({ pos: [35.4, 1, -40.2], radius: 1.8, prompt: 'Open the desk drawer', states: ['2196'], enabled: () => S.phase === 'study' && !S.photo, onUse: () => side(async () => {
      cine(true); lockMusic('m16-photo', 1.2);
      pl.place(34.6, 0, -40.6, PI / 2);
      await game.shot([34.6, 1.9, -41.9], [35.7, 0.7, -40.3], 1.2, { fov: 34 });
      audio.sfxPlay('door'); W.drawer.position.x -= 0.25;
      await game.say('kai', 'One thing in the drawer. A photograph, face down.');
      try { const pp = renderPortraits({ m16miraold: CAST.m16miraold, m16kaiold: CAST.m16kaiold }, 256); photoTex = photoTexture(pp.m16miraold, pp.m16kaiold); } catch (err) { console.warn('m16 photo', err); photoTex = TEX.photoFrame(); }
      W.photo.material.map = photoTex; W.photo.material.emissiveMap = photoTex; W.photo.material.emissiveIntensity = 0.06; W.photo.material.needsUpdate = true; W.photo.visible = true;
      await game.shot([35.45, 1.5, -39.55], [36.08, 0.88, -39.65], 1.6, { fov: 30 });
      await game.wait(1.2);
      await game.say('kai', 'Mira. Older than I ever saw her. Laughing at whoever\'s holding the camera.');
      await game.say('kai', 'And him. Me. Old. A sea wall behind us.');
      audio.sfxPlay('motif');
      W.photo.material.map = TEX.photoBack(); W.photo.material.emissiveMap = W.photo.material.map; W.photo.material.emissiveIntensity = 0.02; W.photo.material.needsUpdate = true;
      await game.shot([35.5, 1.45, -39.6], [36.08, 0.88, -39.65], 1.4, { fov: 28 });
      await game.say('kai', 'M. and K. Haldane sea wall, twenty seventy-four. World 0412.');
      await game.say('kai', 'And in her hand: We had a thousand chances. We only needed one that was ours.');
      audio.silence?.(2.0); await game.wait(1.4);
      S.photo = true; F.m16photo = true; F.photoOlderKaiMira = true; F.m16quote = true; progress();
      ev('A photograph · world 0412', 'Older Mira, 58, and older Kai on the Haldane sea wall in 2074, a world where she lived. On the back, in her hand: "We had a thousand chances. We only needed one that was ours." Kept face down in the Founder\'s desk.', 'THE PHOTOGRAPH');
      W.photo.material.map = photoTex; W.photo.material.emissiveMap = photoTex; W.photo.material.needsUpdate = true;
      musicLock = null; cine(false); refreshObjective();
    }) });
    act({ pos: [38.3, 1.2, -47.6], radius: 1.8, prompt: 'Read the register on the lectern', states: ['2196'], enabled: () => S.phase === 'study' && !S.register, onUse: () => side(async () => {
      cine(true);
      await game.shot([38.8, 1.9, -46.8], [37.6, 1.1, -47.6], 1.2, { fov: 34 });
      await game.say('kai', 'Iterations. One thousand and thirty. Same. One thousand and thirty-one. Reached first. Tried the hospital. Rain.');
      await game.say('kai', 'One thousand and forty-six. Ten years.');
      await game.say('kai', 'One thousand and forty-seven. This one. Kai, thirty-two. And then dots.');
      S.register = true; F.m16register = true; progress();
      ev('The register of iterations', 'The Founder\'s lectern log: iteration after iteration of 19.10.2026, each with one change and its result. The last line: "1047 · this one · Kai, 32 · ………"', 'THE STUDY');
      cine(false); refreshObjective();
    }) });
    act({ pos: [40.0, 1.4, -45.0], radius: 2.0, prompt: 'Look at the wall of bands', states: ['2196'], enabled: () => S.phase === 'study' && !S.bands, onUse: () => side(async () => {
      cine(true); lockMusic('m16-founder', 1.0);
      await game.shot([38.6, 1.6, -38.2], [40.6, 1.2, -50.0], 2.4, { fov: 46 });
      await game.say('kai', 'Chronolith bands. Hundreds of them. Every one tagged with a number.');
      await game.shot([39.6, 1.3, -44.4], [40.9, 1.2, -45.4], 1.2, { fov: 28 });
      await game.say('m16band', 'Count: one thousand and forty-six. Every signature matches yours.');
      audio.sfxPlay('motif');
      await game.say('m16rec', 'Iteration one thousand and forty-six. Nineteenth of October. She reached. I held on. Same as always.');
      await game.say('m16rec', 'I have tried the fever. I have tried the rain. I have tried being somebody else\'s son.');
      await game.say('m16rec', 'Every world I change ends at eight-fourteen, or later and worse. I bring back what is left and put it on a shelf.');
      await game.say('m16rec', 'Edie thinks this is a museum. It is a lab notebook.');
      await game.say('m16rec', 'If you are hearing this, Kai, you are one thousand and forty-seven. Leave room for the coat.');
      S.bands = true; F.m16bands = true; F.witnessIterations = 1046; progress();
      ev('The wall of bands', '1,046 Chronolith bands on pegs in the Founder\'s study, every one with Kai\'s signature. A recording in the Founder\'s voice: every world he changes ends at 08:14 or later and worse; "Edie thinks this is a museum. It is a lab notebook."', 'THE STUDY');
      musicLock = null; cine(false); refreshObjective();
    }) });
    act({ pos: [34.4, 1.1, -49.9], radius: 1.7, prompt: 'Read the card in the empty case', states: ['2196'], enabled: () => S.phase === 'study' && !S.emptyCase, onUse: () => side(async () => {
      await game.shot([33.6, 1.7, -49.0], [34.4, 0.8, -50.5], 1.0, { fov: 30 });
      await game.say('kai', 'Accession one thousand and forty-seven. This world. K. Varen, thirty-two. Pending.');
      await game.say('kai', 'Leave room for the coat.');
      S.emptyCase = true; F.m16accession1047 = true; progress();
      ev('Accession 1047', 'An empty case in the study, already labelled: "This world. K. Varen, 32. Pending. (leave room for the coat)".', 'THE STUDY');
    }) });
    act({ pos: [32.6, 1.3, -37.6], radius: 1.7, prompt: 'Look at the coat on the hook', states: ['2196'], enabled: () => S.phase === 'study' && !S.coat, onUse: () => side(async () => {
      await game.shot([33.8, 1.7, -38.6], [32.0, 1.5, -37.0], 1.0, { fov: 32 });
      await game.say('kai', metWitness ? 'A long grey coat. The man behind the glass wore this. The Grey Man. The Founder.' : 'A long grey coat, worn through at the elbows. Somebody wore it for a very long time.');
      S.coat = true; F.m16coat = true; progress();
    }) });
    // the echo of world 0412 (Residue Vision)
    let echo = null;
    try { echo = game.actor('m16miraold', null, 32.6, 0, -49.0, PI / 2); echo.setGhost(0x9a7bff); echo.root.userData.states = ['2196']; game.residue(echo.root); echo.pose = 'look'; } catch (err) { console.warn('m16 echo', err); }
    const echoIt = act({ pos: [32.6, 1, -49.0], radius: 2.0, prompt: 'Listen to the echo', states: ['2196'], enabled: () => S.phase === 'study' && !S.echo && game.residueOn && !!echo, onUse: () => side(async () => {
      cine(true); lockMusic('m16-photo', 1.0);
      pl.place(34.1, 0, -50.2, -PI / 2 - 0.5);
      await game.shot([35.0, 1.6, -47.6], [32.6, 1.45, -49.0], 1.6, { fov: 34 });
      await game.say('m16miraold', 'You\'re soaked again. You always come back from the wall soaked.');
      await game.say('m16miraold', 'Stop counting which morning was right. This one was. We had it.');
      await game.say('kai', 'Mira...');
      await game.say('m16miraold', 'Go home, Kai. Whichever one is yours.');
      S.echo = true; F.m16miraEcho = true; progress();
      ev('The echo of world 0412', 'In Residue Vision the study still holds an echo of Mira at fifty-eight, from the world on the photograph: "Stop counting which morning was right. This one was."', 'RESIDUE');
      musicLock = null; cine(false);
    }) });
    void echoIt;

    // ======================================================================================================
    // OPTIONAL: the strays, the visitors' book, the catalogue, the shards, Edie and Mara
    // ======================================================================================================
    EXHIBITS.forEach(([, , , title, story], i) => {
      const e = W.exhibits[i];
      act({ pos: [e.pos[0], 1, e.pos[2]], radius: 1.5, prompt: 'Read the label: ' + title.toLowerCase(), states: ['2196'], enabled: () => !S.strays.has(i), onUse: () => side(async () => {
        S.strays.add(i); F.m16strays = S.strays.size; progress();
        ev(title, story, 'STRAY · ' + S.strays.size + '/8');
        ui.toast(`STRAY ${S.strays.size}/8 · ${title.toUpperCase()}`, 2400);
        await game.say('kai', ['Port Hale. A town that never was, and a ring worn thin for thirty years.', 'Ana, who drew in maths. In a bay that never was.', 'Line 9 to Sunward. Clipped twice. Somebody took the ride.', 'From the sea we had. Theirs came to the door.', 'Let the machine sleep. In that world they listened, and it still came to this.', 'Happy eleventh, Mira. Love from Kai. In that world I got to write that.', 'Dr. M. Varen, Director. She ran Helix. Somebody scratched out her face.', 'A trooper\'s helmet with flowers on it.'][i]);
        if (S.strays.size === 4) await game.say('edie', 'You read them. Most people walk past. Thank you.');
        if (S.strays.size === 8) { await game.say('kai', 'Eight lives, eight worlds. Nobody here gets to say they didn\'t matter.'); ev('The Hall of Ordinary Things', 'Kai read all eight strays. Every one is from a world that stopped, and every one was somebody\'s.', 'STRAYS · 8/8'); }
      }) });
    });
    act({ pos: [5.0, 1.1, 12.0], radius: 1.4, prompt: 'Read the visitors\' book', states: ['2196'], enabled: () => !S.book, onUse: () => side(async () => {
      S.book = true; F.m16visitors = true; progress();
      await game.shot([4.2, 1.9, 11.2], [5.0, 1.1, 12.6], 1.0, { fov: 32 });
      await game.say('kai', 'K.V. K.V. K.V. Every line, the same two letters.');
      await game.say('edie', 'He signs it every time he comes back. I stopped asking which one of him it is.');
      ev('The visitors\' book', 'Every signature in the museum\'s visitors\' book is the same: "K.V."', 'MUSEUM');
    }) });
    act({ pos: [-7.2, 1.1, 14.0], radius: 1.6, prompt: 'Open the catalogue', states: ['2196'], enabled: () => !S.catalogue, onUse: () => side(async () => {
      S.catalogue = true; F.m16catalogue = true; progress();
      await game.shot([-5.6, 1.8, 15.2], [-7.6, 1.0, 14.0], 1.0, { fov: 36 });
      await game.say('kai', 'Index cards in one hand. World 0001 to 1046. Each one a morning, each one a girl of ten.');
      await game.say('kai', 'And under 0640: A girl, nine. Living. Came out of the dark under the stair, holding one music box.');
      ev('Accession 0640', 'In the catalogue, under world 0640 (Rain City with a sea wall): "A girl, nine. Living. Came out of the dark under the stair, 11.03.2151, holding one music box. Box: Stacks D-04, kept for her. — K." Edie is catalogued too.', 'MUSEUM');
    }) });
    SHARDS.forEach((s, k) => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), glowMat(0x5fe6ff, 2.2)); m.position.set(...s.p); scene.add(m);
      if (s.era) T.only(m, s.era);
      game.onUpdate((dt, t) => { m.rotation.y = t * 1.6 + k; m.position.y = s.p[1] + Math.sin(t * 2 + k) * 0.05; });
      const it = act({ pos: s.p, radius: 1.3, prompt: 'Take the temporal shard', states: s.era ? [s.era] : undefined, onUse: () => {
        it.done(); m.visible = false; m.userData.states = []; S.shards++; F.shards = (F.shards || 0) + 1; F.m16shards = S.shards; audio.sfxPlay('anomaly'); progress();
        ev('Temporal shard ' + S.shards + '/5', 'Crystallised time, found in ' + s.where + '. It is cold, the way the stacks are cold.', 'TEMPORAL SHARD · ' + S.shards + '/5');
        ui.toast(`TEMPORAL SHARD ${S.shards}/5`, 2000);
      } });
    });
    // Edie and Mara (side talks)
    const edieIt = act({ pos: [P.edie[0], 1, P.edie[2]], radius: 2.2, prompt: 'Talk to Edie', states: ['2196'], enabled: () => S.phase === 'memories' && S.inMem < 0, onUse: () => side(async () => {
      cine(true);
      const opts = ['Who are you?', 'Where do the strays come from?', 'Who is the Founder?', 'Nothing for now'];
      const k = await choose('kai', 'Ask Edie', opts, 3);
      if (k === 0) await convo(edie, [['edie', 'Edie Lark. I came out of the dark under that stair when I was nine. From a Rain City with a sea wall and no Helix.'], ['edie', 'I had a music box. He said he\'d keep it for me. He never said where.'], ['kai', 'And you stayed.'], ['edie', 'Somebody has to dust them.']]);
      else if (k === 1) await convo(edie, [['edie', 'When a world stops, most of it goes. Some things don\'t. They come out of the dark down here. Strays.'], ['edie', 'A ring. A ticket. Once a dog, very confused. We found it a home upstairs.']]);
      else if (k === 2) await convo(edie, [['edie', 'He built the first rooms, the listening chairs, the Concordance. He comes and goes. He wears a long coat and he never takes it off.'], ['edie', 'He signs the book K.V. Same as your band, I noticed. I\'m not asking.']]);
      if (k < 3) { S.edieTalk++; F.m16edieTalks = S.edieTalk; }
      cine(false);
    }) });
    follow(edieIt, edie);
    const maraIt = act({ pos: [13.5, 1, -16.2], radius: 2.2, prompt: 'Talk to Mara', states: ['2196'], enabled: () => S.phase !== 'intro' && S.inMem < 0, onUse: () => side(async () => {
      cine(true);
      const opts = ['What do you make of this place?', dual ? 'Two records, again' : 'The archive upstairs', 'Who\'s minding Harrow?', 'Nothing for now'];
      const k = await choose('kai', 'Ask Mara', opts, 3);
      if (k === 0) await convo(mara, [['mara', 'An archive of the losers. Every history I know was written by a world that won. This is everybody else.'], ['mara', 'Look at the strays. Nobody here lied. They were just unlucky in what got kept.']]);
      else if (k === 1) await convo(mara, dual ? [['mara', 'You told me both my records were accurate for different branches. K. Varen, M. Varen.'], ['mara', 'Now we know where the branches go when somebody cuts them. Down here.']] : [['mara', 'Upstairs we argue about which record is true. Down here they\'re all true, just not for us.'], ['kai', 'True for whom.'], ['mara', 'You were listening.']]);
      else if (k === 2) await convo(mara, F.anjaAlly === 'free' ? [['mara', 'Nobody. Anja went off with your Sera\'s people. Harrow remembers now, and it\'s doing it loudly.']] : F.anjaAlly === 'keeper' ? [['mara', 'Anja. She\'s keeping her Lantern lit and her day steady. She asked me to tell you not to touch anything.']] : [['mara', 'The same people who always do. Me, mostly.']]);
      if (k < 3) { S.maraTalk++; F.m16maraTalks = S.maraTalk; }
      cine(false);
    }) });
    follow(maraIt, mara);

    // ---------- hints ----------
    let hm = 0;
    hint(() => S.phase === 'memories' && S.inMem < 0 && game.time - S.lastProgress > 60, 70, () => ui.subtitle('kai', nMem() < 3 ? ['Three listening rooms off the hall. The chairs.', 'Room I and II are by the first cases. Room III is further down, on the left.'][hm++ % 2] : ['The crates are only there in 2049. Switch, open them, switch back.', 'Theirs on the trays, ours in the crates.'][hm++ % 2], 3200));
    hint(() => S.inMem >= 0 && game.time - S.lastProgress > 45, 50, () => { const i = S.inMem; ui.subtitle('kai', [['The front desk keeps a log of badges.', 'Mum and Mira by the benches. Before Mira goes to the rope.', 'Mira at the rope with the guide, after eight-twelve and fifty.'], ['The desk log. Who has a badge this time?', 'Mum goes to the desk. What does she say?', 'Both of them at the rope. Get close.'], ['The radio\'s on. Listen to it.', 'Something on the fridge.', 'Mira goes to the clock after eight-thirteen.']][i][(hm++) % 3], 3200); });
    hint(() => S.phase === 'zero' && game.time - S.lastProgress > 50, 60, () => ui.subtitle('kai', !S.zero.looked ? 'The rotunda at the end of the hall. Accession Zero.' : !S.zero.prints ? 'Residue Vision. The stone remembers who touched it.' : 'Which morning had both of us at the ring?', 3000));
    hint(() => S.phase === 'stacks' && game.time - S.lastProgress > 50, 60, () => ui.subtitle('kai', ['Side bays. Wait for the front to pass, then move.', 'The fallen shelf is only fallen in 2196. The grille is only there in 2049.', 'The register at the entrance names the study\'s shelf.'][hm++ % 3], 3200));
    hint(() => S.phase === 'study' && game.time - S.lastProgress > 50, 60, () => ui.subtitle('kai', 'The desk, the lectern, the wall at the back.', 2600));

    // ======================================================================================================
    // THE SCRIPT
    // ======================================================================================================
    // ---------- opening: the establishing shot, the chapter card, the stair ----------
    S.phase = 'intro'; S.main = true;
    ui.missionTag('MISSION 16 · THE MUSEUM OF FAILED WORLDS'); ui.show('hud', true);
    pl.place(...P.start); kai.root.rotation.y = PI;
    cine(true); lockMusic('m16-museum', 0.5);
    await game.shot([0, 4.6, -31], [0, 2.2, 10], 0.01, { fov: 50 });
    const card = ui.chapterCard('ACT III · THE LAST VERSION OF EARTH', 'The Museum of Failed Worlds', 'Beneath the Hollow Archive · Harrow Reach · 2196');
    await ui.fade(0, 2200);
    await game.shot([0, 3.0, -8], [0, 2.0, 14], 7.0, { fov: 46 });
    await card;
    await game.shot([3.2, 2.6, 18.4], [0, 2.6, 28], 1.6, { fov: 44 });
    walkTo(mara, [[-1.2, 3, 30.0], [-1.2, 2.25, 28], [-1.2, 1.5, 26], [-1.2, 0.75, 24], [-1.2, 0, 22], [-2.6, 0, 18.6]], 1.2).then(() => { mara.root.rotation.y = PI / 2 + 0.4; });
    await tween(4.2, u => { const z = 31.4 - u * 11.4, y = z > 30 ? 3 : z < 22 ? 0 : (z - 22) / 8 * 3; pl.place(0, y, z, PI); });
    kai.speed = 0;
    await convo(mara, [
      ...(metMara ? [['mara', F.anjaAlly === 'free' ? 'Under the Archive. Anja\'s packing for the road with your Sera\'s people. She never came down here anyway. She says the floor hums.' : 'Under the Archive. Anja doesn\'t come down here. She says the floor hums.']] : [['mara', 'Mara Quill. I keep the archive upstairs that disagrees with itself. Sera said you\'d want to see what\'s under it.']]),
      ['kai', 'What is it?'],
      ['mara', 'Edie calls it a museum. I call it the other side of every argument I\'ve ever had.'],
    ]);
    edie.lookTarget = kai.head;
    await game.shot([1.6, 1.7, 17.2], [4.4, 1.6, 14.4], 1.2, { fov: 38 });
    await game.say('edie', 'Wipe your feet. Some of what you\'re carrying isn\'t from here.');
    pl.place(2.4, 0, 15.6, PI / 2 + 0.3);
    await convo(edie, [
      ['edie', 'Edie Lark. Keeper. Welcome to the Museum of Failed Worlds.'],
      ['kai', 'Failed how?'],
      ['edie', 'Stopped. Unmade. Somebody\'s whole Tuesday, gone. The things don\'t always go with it. They come out of the dark down here, and I keep them.'],
      ['edie', 'The Founder built three listening rooms. Each one holds a memory of the same morning, from a world that isn\'t there any more.'],
      ['kai', 'Which morning?'],
      ['edie', 'The nineteenth of October, twenty twenty-six. Eight-fourteen. You know it, by your face.'],
      ['kai', 'My sister.'],
      ['edie', 'Then sit in the chairs. And when you come out, take what they leave you to the Concordance. Theirs against ours.'],
    ]);
    edie.lookTarget = null;
    await game.shot([-2.6, 2.4, 6.6], [0, 1.4, -12], 2.0, { fov: 48 });
    await game.say('kai', 'A wedding ring. A school report. A ticket for a tram line that never ran.');
    await game.say('m16band', 'Local signature: Rain City Civic Museum, Store B-3, 2049. Switching available.');
    T.unlocked = true; T.refreshHud?.();
    ui.toast('TEMPORAL STATE · STORE B-3 · 2049 (2) · THE MUSEUM · 2196 (3)', 3600);
    walkTo(mara, [[-2.6, 0, 6], [0, 0, -12], [4.6, 0, -16.4], [13.5, 0, -16.2]], 1.3).then(() => { mara.root.rotation.y = -PI / 2; mara.pose = 'look'; });
    S.main = false; musicLock = null; cine(false);
    game.checkpoint(0, 0, 12, PI);
    S.phase = 'memories'; S.lastProgress = game.time; refreshObjective();

    // ---------- the three memories and the Concordance (free order) ----------
    await game.waitFor(() => nMem() === 3 && nCmp() === 3 && !S.busy && !ui.dlgActive && game.control);
    S.main = true; cine(true);
    await game.shot([13.8, 1.9, -18.4], [12, 1.0, -20.6], 1.6, { fov: 44 });
    await convo(mara, [
      ['mara', 'Badge: ours has you in it. Clock: ours had sunshine. Coat: ours is torn the same.'],
      ['kai', 'Only one of their mornings agrees with ours.'],
      ['mara', 'Then go and ask the oldest thing in the building. Edie keeps it in the rotunda.'],
    ]);
    S.main = false; cine(false);
    S.phase = 'zero'; game.checkpoint(0, 0, -36, PI); refreshObjective();
    edie.root.position.set(2.4, 0, -40.6); edie.root.rotation.y = PI;

    // ---------- Accession Zero, the stacks, the study ----------
    await game.waitFor(() => S.phase === 'study' && S.photo && S.register && S.bands && !S.busy && !ui.dlgActive && game.control);

    // ---------- ending: the museum proves the Witness has repeated the experiment many times ----------
    S.main = true; S.phase = 'end'; cine(true); lockMusic('m16-founder', 1.4);
    edie.root.position.set(32.2, 0, -44.6); edie.root.rotation.y = PI / 2; mara.root.position.set(32.4, 0, -42.8); mara.root.rotation.y = PI / 2; mara.pose = null;
    pl.place(35.0, 0, -44.0, -PI / 2);
    await game.shot([38.6, 2.2, -45.6], [32.6, 1.4, -43.8], 2.0, { fov: 42 });
    await convo(edie, [
      ['edie', 'He told me this was the end of the stacks.'],
      ['kai', 'It\'s the end of a lot more than that.'],
    ]);
    await convo(mara, [
      ['mara', 'One thousand and forty-six worlds. One hand writing every label.'],
      ['kai', 'He isn\'t collecting them. He\'s repeating. The same morning, a thousand times, changing one thing each time.'],
      ['kai', 'The fever. The rain. The hospital. Every time, she reaches, and every time it ends.'],
      // M14: Sera counted seventeen Kais under the statue; the museum counts every try
      ...(F.seraKnowsVersions || F.m14denial ? [['kai', 'Sera counted seventeen of me under that statue. Those were only the ones who got as far as her century.']] : []),
      ...(dual ? [['mara', 'Both of my records were true for different branches. He\'s the one cutting the branches.']] : [['mara', 'Then the archive upstairs is one page of his notebook.']]),
    ]);
    if (S.box) {
      await convo(edie, [
        ['kai', 'Edie. This was in bay D-04. Kept for E.'],
        ['edie', '...He kept it. All this time, three bays from my desk.'],
      ]);
      audio.sfxPlay('motif');
      await game.say('edie', 'I\'m in his catalogue, aren\'t I? A girl, nine. One of the experiment\'s leftovers.');
      await game.say('kai', 'You\'re the one who dusted them. That\'s not a leftover. That\'s a keeper.');
      F.m16edie = 'box';
    }
    await game.shot([34.0, 1.6, -48.6], [34.4, 0.9, -51.0], 1.6, { fov: 34 });
    await game.say('kai', S.emptyCase ? 'And there\'s a case waiting for this world. Accession one thousand and forty-seven. He\'s already made room.' : 'There\'s an empty case. Accession one thousand and forty-seven. This world. He\'s already made room for it.');
    await game.say('m16band', 'Correction to the record: the Founder of this museum is the Witness. Iterations logged: one thousand and forty-six. This is the next.');
    await game.shot([33.0, 1.9, -46.4], [40.9, 1.4, -45.0], 1.6, { fov: 40 });
    await game.say('kai', 'Not this time. Not mine.');
    F.m16done = true; F.m16strays = S.strays.size; F.m16shards = S.shards; F.m16evidence = S.ev.size; F.witnessExperiments = 1046; F.m16museumSeen = true;
    F.m16edie = F.m16edie || (S.catalogue ? 'card' : S.edieTalk ? 'met' : 'met');
    await game.shot([33.6, 3.0, -40.6], [40.9, 1.4, -48.0], 5.0, { fov: 46 });
    await ui.fade(1, 2600);
    const mins = Math.round((game.time - tStart) / 60);
    await ui.chapterCard('MISSION 16 COMPLETE', 'The Museum of Failed Worlds', `Memories 3/3 · Concordance 3/3 · Strays ${S.strays.size}/8 · Shards ${S.shards}/5${S.box ? ' · The music box: home' : ''}${mins ? ' · ' + mins + ' min' : ''}`, 4200);
    memLoops.forEach(l => l.dispose());
    delete T.canSwitch; kai.lookTarget = null; kai.pose = null;
    game.releaseCam(); ui.letterbox(false); audio.allBeds?.(0); audio.setTheme(null);
    window.__m16 = null;
    void V; void near; void echo;
  },
};
