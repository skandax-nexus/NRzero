// MISSION 20 · MIRA'S MEMORY (Act IV) — reveal the emotional truth behind Mira's identity.
// Bible beats: explore Mira's childhood with Kai · replay the original experiment · experience a discarded timeline
// where Mira survives but Kai disappears · align three memories without forcing them into one perfect sequence.
// Quote: "I remember being your sister." / "That's not the same thing." / "Would it be enough if I said it was?"
// Ending: Kai learns that Mira is a reconstructed consciousness carrying memories from multiple possible lives.
// Mira takes Kai to the Threshold at the edge of the Unwritten Second, where she keeps three mornings that do not agree.
// Each memory has two rememberers (keys 1 / 2): what Kai remembers and what she does (in World 0907, what she lived and
// the gap Kai left). Calder Row 2025 (hide and seek, skipping stones, the kitchen, the drawing), Test Hall Zero on
// 19.10.2026 (a replay that rewinds at 08:14:09 until Kai has seen what both children saw), World 0907 (Rain City 2049,
// a world where he vanished: he follows her evening as an absence). The Loom aligns them by what all three share (the
// tune, a hand, the machine) and leaves the endings disagreeing; forcing one ending is refused. Then the reveal.
// Shared system: src/systems/memory.js (Memory, MemoryReplay, MemoryLoom).
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { CAST, pastLook, citizenLook } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { Walker } from '../world/props.js';
import { Memory, MemoryReplay, MemoryLoom } from '../systems/memory.js';
import { disposeGroup } from '../world/env_m18.js';
import { registerM20Cast, registerM20Themes, musicState, P0, P1, P2, P3, TEX, buildThreshold, buildCalder, buildTestHall, buildRainCity } from '../world/env_m20.js';

const PI = Math.PI;
const MIRA_V = 0x9a7bff;
// the three memories' fragments, by anchor (the Loom's rings all share this cyclic order)
const ANCH = ['tune', 'hand', 'machine', 'ending'];
const FRAG = {
  I: { tune: 'The cupboard under the stairs', hand: 'Splashes, not sinking', machine: 'ME · KAI · THE MACHINE', ending: 'Both of us went home' },
  II: { tune: '"It\'s singing"', hand: 'I let go', machine: 'RUN 01 · 08:14:02', ending: 'She was taken; he stayed' },
  III: { tune: 'Three notes on a bench', hand: 'The second bowl', machine: 'Operator: M. Varen', ending: 'He was taken; she stayed' },
};
const STRAND_NAME = { I: 'I · CALDER ROW 2025', II: 'II · TEST HALL ZERO', III: 'III · WORLD 0907' };

export default {
  id: 'm20', act: 'ACT IV · THE UNWRITTEN SECOND', title: 'Mira\'s Memory', sub: 'Memories that contradict',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM20Cast(); registerM20Themes();
    ui.missionTag('MISSION 20 · MIRA\'S MEMORY'); ui.show('hud', true);
    const kai = pl.char;
    const portraits = (ids) => { try { const need = ids.filter(id => !ui.portraits[id] && CAST[id]?.look); if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]])))); } catch (err) { console.warn('m20 portraits', err); } };
    portraits(['mira', 'm20kai6', 'm20mira9', 'm20mother', 'm20kai7', 'm20mira10', 'm20rook26', 'm20mira33']);
    const sawPhoto = !!(F.m16photo || F.photoOlderKaiMira), heardReel = !!F.m17miraReel, carved = !!F.m18carving, metJun = !!F.metJun;
    const pattern = F.miraPattern || 61, iters = F.witnessIterations || 1046;
    const startPart = Math.max(1, Math.min(5, +(new URLSearchParams(location.search).get('m20part') || 1)));

    // ---------- mission-wide state ----------
    const G = {
      shards: 0, shardsTaken: new Set(), ev: new Set(), frags: { I: {}, II: {}, III: {} }, contra: new Set(), done: { I: false, II: false, III: false },
      doorsOpen: 1, found: 0, skips: 0, throws: 0, pebbleKept: false, mum: { kai: false, mira: false }, draw: { kai: false, mira: false }, heights: false, list: false, carving: false, ball: false,
      details: new Set(), loops: 0, visitors: false, rook: false, consoleBoth: { kai: false, mira: false }, frays: 0, jun: false, pages: new Set(), poster: false, window: false,
      loomOff: [0, 2, 1], loomMoves: 0, solved: false, forced: 0, answer: null, talks: new Set(), placed: { I: false, II: false, III: false },
    };
    let S = {}, W = null, mem = null, prevRoot = [];
    const loom = new MemoryLoom({ rings: [ANCH, ANCH, ANCH], offsets: G.loomOff, levers: [[0, 1], [1, 2], [0, 2]], contradictory: ['ending'] });
    window.__m20 = { G, loom, get S() { return S; }, get W() { return W; }, get mem() { return mem; }, P0, P1, P2, P3 };

    // ---------- helpers ----------
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag) => { if (G.ev.has(title)) return; G.ev.add(title); ui.addEvidence(title, text, tag); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const choose = (id, text, opts, correct = 0) => { if (game.autoplay) game.autoChoice = game.autoQueue?.length ? game.autoQueue.shift() : correct; return game.choice(id, text, opts); };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive || S.busy) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u), u); if (u >= 1) { off(); res(); } }); });
    const refresh = () => S.refresh?.();
    const side = async (fn) => {
      if (S.busy || !game.control || game._failing) return; S.busy = true;
      try { await fn(); } catch (err) { if (err?.name === 'Abort' || err?.abort || String(err).includes('Abort')) throw err; console.warn('m20 side', err); } finally { S.busy = false; if (!S.main) { game.control = true; ui.letterbox(false); game.releaseCam(); } refresh(); }
    };
    const act = (o) => {
      const it = game.interact({ radius: 1.8, ...o, once: false, onUse: (x) => { if (S.busy || game._failing) return; if (o.enabled && !o.enabled()) return; if (o.states && !o.states.includes(T.current)) return; o.onUse(x); } });
      it.done = () => game.removeInteract(it);
      return it;
    };
    const near = (p, r) => Math.hypot(pl.pos.x - p[0], pl.pos.z - p[2]) < r;
    const posOf = (ch) => (ch === kai ? pl.pos : ch.root.position);
    const small = new Set();
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
    // a conversation: lines [[id, text]]; speakers with bodies in S.byId get an over-the-shoulder shot
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
        if (ch.hold) { ch.speed = 0; return; }
        const dx = t[0] - p.x, dz = t[2] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { i++; if (i >= path.length) { ch.speed = 0; off(); res(); } return; }
        const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st; p.y += (t[1] - p.y) * Math.min(1, dt * 5);
        let dy = Math.atan2(dx, dz) - ch.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.root.rotation.y += dy * Math.min(1, dt * 8); ch.speed = speed;
      });
    });
    const closeUp = async (p, lines, dist = 1.1, fov = 34) => {
      const dx = pl.pos.x - p[0], dz = pl.pos.z - p[2], d = Math.hypot(dx, dz) || 1;
      await game.shot([p[0] + dx / d * dist, p[1] + 0.7, p[2] + dz / d * dist], [p[0], p[1], p[2]], 1.0, { fov });
      for (const [id, line] of lines) await game.say(id, line);
    };
    const actor = async (id, x, y, z, ry, kid) => { const ch = game.actor(id, null, x, y, z, ry); S.byId[id] = ch; if (kid) small.add(ch); await tick(); return ch; };
    const holderVis = (ch, ...holders) => { ch.root.userData.states = holders; T.objects.push(ch.root); ch.root.visible = holders.includes(T.current); };
    const shard = (where, mesh, states) => act({ pos: [mesh.position.x, mesh.position.y + 0.2, mesh.position.z], radius: 1.6, prompt: 'Take the temporal shard', states,
      enabled: () => !G.shardsTaken.has(where) && (!states || states.includes(T.current)), onUse: () => {
        G.shardsTaken.add(where); mesh.visible = false; T.objects = T.objects.filter(o => o !== mesh); mesh.userData.states = ['none'];
        G.shards++; F.shards = (F.shards || 0) + 1; audio.sfxPlay('pickup'); ui.toast(`TEMPORAL SHARD ${G.shards}/8 · ${where.toUpperCase()}`, 2400);
      } });
    const fragment = (strand, anchor) => {
      if (G.frags[strand][anchor]) return;
      G.frags[strand][anchor] = true;
      const title = `${STRAND_NAME[strand]} · ${anchor.toUpperCase()}`;
      ev('Fragment · ' + FRAG[strand][anchor], `${title}. ${{ tune: 'The three notes (E, B, A).', hand: 'A hand held, or let go.', machine: 'The ring, the machine.', ending: 'Who was left.' }[anchor]} For the Loom.`, 'Memory · ' + STRAND_NAME[strand]);
      mem?.fragment({ key: strand + anchor, strand, anchor });
      audio.sfxPlay('motif'); ui.toast(`MEMORY FRAGMENT · ${FRAG[strand][anchor].toUpperCase()} · ${Object.keys(G.frags[strand]).length}/4`, 2800);
    };
    const contradiction = (key, title, sides) => { if (G.contra.has(key)) return; G.contra.add(key); ev('Contradiction · ' + title, sides.join('  /  '), 'Memory'); ui.toast('CONTRADICTION · ' + title.toUpperCase(), 2600); };

    // ---------- HUD (the replay clock, the loom) ----------
    const hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;right:calc(22px + var(--sr,0px));top:calc(120px + var(--st,0px));padding:8px 12px;border-radius:6px;background:rgba(14,10,22,.58);border:1px solid rgba(190,170,255,.38);color:#ece4ff;font:600 12px/1.45 var(--ui,system-ui);letter-spacing:.16em;pointer-events:none;opacity:0;transition:opacity .4s;text-align:right;min-width:160px;z-index:5';
    if (document.documentElement.classList.contains('touch') || game.touch?.enabled) { hud.style.right = 'auto'; hud.style.left = 'calc(16px + var(--sl,0px))'; hud.style.top = 'calc(66px + var(--st,0px))'; hud.style.textAlign = 'left'; hud.style.minWidth = '130px'; hud.style.fontSize = '11px'; }
    (document.getElementById('hud') || document.body).appendChild(hud);
    let hudKey = '';
    const hudSet = (rows) => {
      const show = rows && rows.length && !game.cine && !ui.dlgActive;
      hud.style.opacity = show ? 1 : 0; if (!show) return;
      const key = rows.map(r => r[0] + (r[1] == null ? '' : Math.round(r[1] * 50))).join('|'); if (key === hudKey) return; hudKey = key;
      hud.innerHTML = rows.map(([t, f, c]) => `<div>${t}</div>` + (f == null ? '' : `<div style="height:4px;margin:3px 0 6px;background:rgba(255,255,255,.12);border-radius:2px"><div style="height:4px;width:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%;background:${c || '#b6a0ff'};border-radius:2px"></div></div>`)).join('');
    };

    // ---------- places: one scene per memory ----------
    let curTheme = null, musicLock = null, themeFor = () => null;
    const music = (fade = 1.6) => { const th = musicLock || themeFor(); if (!th) return; for (const d of T.defs) d.theme = th; if (th !== curTheme) { curTheme = th; audio.setTheme(th, fade); } };
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    async function newPlace(sceneOpts, memOpts) {
      for (const g of prevRoot) disposeGroup(g); prevRoot = [];
      mem?.dispose();
      const scene = game.newScene({ residue: true, ...sceneOpts });
      RZ.init(renderer, { quality: game.engine.quality || 'medium' });
      game.onUpdate(dt => RZ.update(dt));
      mem = new Memory(game, memOpts);
      T.unlocked = false; delete T.canSwitch; curTheme = null; musicLock = null; hudKey = ''; themeFor = () => null;
      S = { seen: {}, obj: '', busy: false, main: false, byId: {}, refresh: null };
      small.clear(); kai.pose = null; kai.lookTarget = null; pl.crouching = false; game.setResidue(false);
      let mT = 0; game.onUpdate(dt => { mT -= dt; if (mT <= 0) { mT = 0.5; music(); } });
      let oT = 0; game.onUpdate(dt => { oT -= dt; if (oT <= 0) { oT = 1; refresh(); } });
      await tick();
      return scene;
    }
    // light: a sky per holder, one sun (the shadow caster), a hemisphere, three nearest practicals
    function rig(Wm, LOOK, skies) {
      const scene = game.scene, Q = RZ.getQuality(), low = Q === 'low', envs = {};
      for (const [e, o] of Object.entries(skies)) { try { envs[e] = RZ.skyEnvironment(renderer, scene, { ...o, apply: false }); } catch (err) { console.warn('m20 sky', err); } }
      const hemi = new THREE.HemisphereLight(0xb8c8d0, 0x2a2a2c, 0.5); scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.castShadow = true;
      sun.shadow.mapSize.set(Q === 'high' ? 2048 : low ? 512 : 1024, Q === 'high' ? 2048 : low ? 512 : 1024);
      Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 170 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
      scene.add(sun, sun.target);
      const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
      const sunDir = new THREE.Vector3(0.5, 0.6, 0.3).normalize();
      let lookKey = null, lightT = 0;
      const apply = () => {
        const e = T.current, L = LOOK[e] || Object.values(LOOK)[0]; lookKey = e;
        scene.fog.color.set(L.fog[0]); scene.fog.density = L.fog[1];
        const env = envs[e] || envs.all;
        if (env) { scene.environment = env.envMap; scene.environmentIntensity = L.env; scene.background = L.bgColor ? new THREE.Color(L.bg) : (env.background || new THREE.Color(L.bg)); } else scene.background = new THREE.Color(L.bg);
        hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
        sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; sunDir.set(...L.dir).normalize();
        renderer.toneMappingExposure = L.exp;
        const b = L.beds || {}; audio.rain(b.rain || 0); audio.wind(b.wind || 0); audio.hum(b.hum || 0, b.hz || 52); audio.water?.(b.water || 0); audio.crowd?.(b.crowd || 0);
        lightT = 0; L.onApply?.();
      };
      const rigLights = () => {
        const p = game.cine ? game.engine.camera.position : pl.pos, e = T.current;
        const list = Wm.lightSrc.filter(s => s.era === e || s.era === 'all' || !s.era).map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
        pts.forEach((l, i) => { const s = list[i]; if (!s || s.dd > 50 * 50) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
      };
      game.onUpdate(dt => {
        const p = game.cine ? game.engine.camera.position : pl.pos;
        sun.target.position.set(p.x, p.y, p.z); sun.position.set(p.x + sunDir.x * 70, p.y + sunDir.y * 70 + 4, p.z + sunDir.z * 70);
        lightT -= dt; if (lightT <= 0) { lightT = 0.4; rigLights(); if (T.current !== lookKey) apply(); }
      });
      T.onSwitch(() => { apply(); });
      apply();
      return { apply, sun, hemi, envs };
    }
    // switching holders: never into something solid (a wall of haze, the crowd), never onto nothing
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
    function holderRules(msgs = {}, extra) {
      const baseCan = T.canSwitch.bind(T);
      T.canSwitch = (id) => {
        if (!baseCan(id)) return false;
        const why = extra ? extra(id) : null;
        if (why) { if (once('rule' + why + Math.floor(game.time / 4))) { ui.toast(why, 2200); audio.sfxPlay('fail'); } return false; }
        const s = solidAt(id);
        if (s) { if (once('solid' + id + Math.floor(game.time / 3))) { ui.toast(s === 'solid' ? (msgs[id] || 'SOMETHING STANDS HERE IN THAT MEMORY · MOVE') : 'NOTHING TO STAND ON THERE', 2000); audio.sfxPlay('fail'); } return false; }
        return true;
      };
    }
    const forceHolder = async (id) => { if (T.current !== id) await T.switchTo(id, { force: true, free: true, dur: 700 }); };
    const chapterTitle = async (num, title, sub) => { await ui.chapterCard(`MIRA'S MEMORY · ${num}`, title, sub, 3600); };

    // =================================================================================================================
    // THE THRESHOLD (hub): the doors, the Loom, Mira
    // =================================================================================================================
    let mira = null;
    async function threshold(arrival) {
      await newPlace({ background: 0x1a1426, fog: [0x2a2238, 0.011], exposure: 1.0, bloom: 0.75, bloomThreshold: 0.82, envIntensity: 0.5, killY: -6 },
        { id: 'threshold', title: 'The Threshold', holders: [{ id: 'loom', key: '1', name: 'THE THRESHOLD', year: 'THE UNWRITTEN SECOND', color: '#c8b4ff', glyph: '◯' }], initial: 'loom' });
      W = buildThreshold(game, game.scene, T); prevRoot.push(W.root);
      game.onUpdate((dt, t) => W.update(dt, t));
      rig(W, { loom: { fog: [0x3a2a44, 0.010], env: 0.7, bg: 0x1a1426, hemi: [0xd8c8ff, 0x2a2030, 0.55], sun: [0xffb890, 1.5], dir: [-0.8, 0.22, -0.3], exp: 1.05, beds: { wind: 0.02, water: 0.03 } } },
        { loom: { preset: 'sunset', elevation: 2.4, azimuth: 250, cover: 0.5, turbidity: 4 } });
      themeFor = () => (G.done.III ? 'm20-loom' : 'm20-threshold');
      // the plaza is round: the lake is where the memory stops
      game.onUpdate(() => { if (game.cine) return; const r = Math.hypot(pl.pos.x, pl.pos.z); if (r > P0.radius) { const k = P0.radius / r; pl.pos.x *= k; pl.pos.z *= k; if (once('lake' + Math.floor(game.time / 6))) ui.subtitle('mira', 'Not the water. There\'s nothing under it.', 2200); } });
      mira = await actor('mira', ...P0.mira, PI * 0.9);
      // the Loom shows what has been placed and how the rings stand
      const placeTablets = () => {
        ['I', 'II', 'III'].forEach((st, i) => ANCH.forEach((a, s) => {
          const sock = W.sockets[i][s], on = G.placed[st] && G.frags[st][a];
          sock.tab.visible = !!on;
          if (on && !sock.tab.material.map) { sock.tab.material.map = TEX.tablet(a, FRAG[st][a], STRAND_NAME[st].split(' · ')[0]); sock.tab.material.needsUpdate = true; }
        }));
        W.rings.forEach((g, i) => { g.rotation.y = -loom.off[i] * PI / 2; });
      };
      const showSpokes = () => {
        const st = loom.state(), all = G.done.I && G.done.II && G.done.III;
        st.spokes.forEach((sp, s) => { const m = W.spokeLights[s].material; if (!all) { m.emissive.set(0x6a5a80); m.emissiveIntensity = 0.5; return; } if (sp.contradictory) { m.emissive.set(MIRA_V); m.emissiveIntensity = 1.8; } else if (sp.aligned) { m.emissive.set(0xfff0d8); m.emissiveIntensity = 2.4; } else { m.emissive.set(0x5a4a60); m.emissiveIntensity = 0.4; } });
        musicState.loom = all ? st.aligned : 0;
      };
      W.place = placeTablets; W.spokes = showSpokes;
      loom.off = G.loomOff; placeTablets(); showSpokes();
      // the doors: open one at a time
      const doorOpen = (i) => i < G.doorsOpen && !G.done[['I', 'II', 'III'][i]];
      game.onUpdate((dt, t) => { W.veils.forEach((v, i) => { const on = doorOpen(i); v.material.uniforms.uOp.value += ((on ? 0.75 : 0.0) - v.material.uniforms.uOp.value) * Math.min(1, dt * 2); v.userData.glow.material.opacity = v.material.uniforms.uOp.value * (0.35 + 0.1 * Math.sin(t * 2)); }); });
      const DOORS = [['Enter the memory · Calder Row, summer 2025', calder], ['Enter the memory · Test Hall Zero, 19.10.2026', testHall], ['Enter the memory · World 0907, Rain City 2049', world0907]];
      P0.doors.forEach(([x, , z], i) => act({ pos: [x * 0.9, 1.2, z * 0.9], radius: 2.4, prompt: DOORS[i][0], enabled: () => doorOpen(i) && S.phase === 'hub', onUse: () => { S.next = DOORS[i][1]; } }));
      // Mira: optional talks
      const TALKS = [
        ['What is this place?', [['kai', 'What is this place?'], ['mira', 'The edge of a second nobody wrote down. I keep my mornings here.'], ['mira', 'It\'s quieter than the ring. In the ring everything I remember talks at once.']]],
        ['The singing.', [['kai', 'The singing. Under the stairs.'], ['mira', 'It started the summer I was nine. Three notes, every night.'], ['mira', 'Mum took me to Halden. They found nothing. It was the ring, Kai. It was calling from under the city.'], ['kai', 'Why you?'], ['mira', 'I used to think because I listened. Now I think because you were going to build it.']]],
        ['Why did you let go?', [['kai', 'Why did you let go?'], ['mira', 'Because you were seven and you were coming with me.'], ['mira', 'I was ten. Ten-year-olds think they can\'t die. They\'re very sure their little brothers can.']]],
        ['World zero nine oh seven.', [['kai', 'Fourteen years without me.'], ['mira', 'I was good at my job. I gave lectures about grief. Full halls.'], ['mira', 'I never once said your name in one. I saved it for the bench.']]],
      ];
      act({ pos: [mira.root.position.x, 1.2, mira.root.position.z], radius: 2.2, prompt: 'Talk to Mira', enabled: () => S.phase === 'hub' && !G.solved, onUse: () => side(async () => {
        const avail = TALKS.filter((t, i) => i === 0 || (i === 1 && G.done.I) || (i === 2 && G.done.II) || (i === 3 && G.done.III)).filter(t => !G.talks.has(t[0]));
        if (!avail.length) { await convo(mira, [['mira', 'Go on. The next door won\'t open itself. Well. It will. But it\'s nicer if you do it.']]); return; }
        S.main = true; cine(true);
        const i = await choose('kai', 'Ask Mira', [...avail.map(t => t[0]), 'Not now.'], 0);
        if (i < avail.length) { G.talks.add(avail[i][0]); await convo(mira, avail[i][1]); }
        S.main = false; cine(false);
      }) });
      W.shards.forEach((m, i) => shard('the Threshold ' + (i ? 'east' : 'west'), m));
      // levers
      W.levers.forEach((h, i) => act({ pos: [P0.levers[i][0], 1.1, P0.levers[i][2]], radius: 1.7, prompt: `Pull the lever · turns rings ${['I and II', 'II and III', 'I and III'][i]}`, enabled: () => S.phase === 'loom' && !S.turning, onUse: () => pull(i) }));
      async function pull(i) {
        S.turning = true; audio.sfxPlay('metal'); G.loomMoves++;
        const before = loom.off.slice(); loom.pull(i); G.loomOff = loom.off;
        await tween(0.35, k => { h0(i).rotation.x = -k * 0.7; });
        await tween(1.1, k => { W.rings.forEach((g, r) => { const a = -before[r] * PI / 2, b = a - ((loom.off[r] - before[r] + 4) % 4) * PI / 2; g.rotation.y = a + (b - a) * k; }); });
        tween(0.4, k => { h0(i).rotation.x = -(1 - k) * 0.7; });
        W.place(); W.spokes(); audio.sfxPlay('door');
        const st = loom.state();
        if (st.solved && !G.solved) { G.solved = true; S.turning = false; await solvedScene(); return; }
        if (st.aligned > 0 && once('partial' + st.aligned)) ui.subtitle('mira', st.aligned === 1 ? 'One thing in common. Keep going.' : 'Closer.', 2200);
        S.turning = false; refresh();
      }
      const h0 = (i) => W.levers[i];
      async function solvedScene() {
        S.busy = true; S.main = true; cine(true);
        try {
          audio.sfxPlay('success');
          await game.shot([0, 9.5, 9.0], [0, 0, 0], 2.2, { fov: 50 });
          await game.say('mira', 'There. Three things that happened in all of them.');
          await game.say('mira', 'The tune. A hand. The machine.');
          await game.shot([5.6, 2.2, -5.6], [0, 0.4, -4.4], 1.6, { fov: 40 });
          await game.say('kai', 'And the endings?');
          await game.say('mira', 'They don\'t agree. They never will. The Loom wants you to fix that.');
          S.phase = 'seal'; game.checkpoint(0, 0, 5.4, PI);
        } finally { S.main = false; S.busy = false; cine(false); }
        refresh();
      }
      act({ pos: [0, 1.0, 0], radius: 2.0, prompt: 'Seal the Loom at the clock', enabled: () => S.phase === 'seal', onUse: () => side(async () => {
        S.main = true; cine(true);
        await game.shot([2.4, 2.2, 2.6], [0, 0.9, 0], 1.2, { fov: 38 });
        await game.say('m20band', 'Three strands aligned. One spoke contradicts: the endings. Resolve the contradiction?');
        const c = await choose('kai', 'The endings disagree', ['Let them disagree. Seal it as it is.', 'Make it one story: choose one ending.'], 0);
        if (c === 1) {
          const e = await choose('kai', 'Keep which ending?', ['Both of us went home (Calder Row)', 'She was taken (Test Hall Zero)', 'He was taken (World 0907)'], 0);
          G.forced++; audio.sfxPlay('anomaly'); game.shake = 0.06;
          mira.setGadget?.('gorget_resonance', 3);
          await game.shot([mira.root.position.x + 1.6, 1.7, mira.root.position.z - 1.4], [mira.root.position.x, 1.5, mira.root.position.z], 1.0, { fov: 34 });
          mira.pose = 'sad';
          await game.say('mira', ["That one never happened, Kai. You'd be choosing a morning nobody lived.", "Then the girl in the cupboard never heard anything. You'd be cutting her out.", 'Then I never let go. Then I never chose anything at all.'][e]);
          await game.say('mira', 'If you cut me down to one story, you cut me.');
          await tween(1.6, k => { W.rings.forEach((g, r) => { g.rotation.y += (r + 1) * 0.06 * (1 - k); }); });
          G.loomOff = [1, 3, 2]; loom.off = G.loomOff; G.solved = false; W.place(); W.spokes();
          mira.pose = null; mira.setGadget?.('gorget_resonance', false);
          await game.say('mira', 'Again. And this time, let me be more than one thing.');
          S.phase = 'loom'; S.main = false; cine(false);
          return;
        }
        S.phase = 'reveal'; S.main = false;
      }) });
      // the Loom at a glance (readable on a phone): what each ring shows on each spoke
      game.onUpdate(() => {
        if (S.phase !== 'loom' || S.main) { if (S.loomHud) { S.loomHud = false; hudSet(null); } return; }
        S.loomHud = true;
        const sp = loom.state().spokes;
        hudSet([['THE LOOM · RINGS I · II · III', null], ...sp.map((o, i) => [`${['NORTH', 'EAST', 'SOUTH', 'WEST'][i]}: ${[0, 1, 2].map(r => loom.anchorAt(r, i).toUpperCase()).join(' · ')}${o.contradictory ? ' · LEFT OPEN' : o.aligned ? ' · ALIGNED' : ''}`, null])]);
      });
      // hints
      hint(() => S.phase === 'hub' && G.doorsOpen === 1 && !G.done.I, 45, () => ui.subtitle('mira', 'The red door. Number fourteen. You know it.', 2600));
      hint(() => S.phase === 'loom', 60, () => { const path = loom.solve(); ui.subtitle('mira', path && path.length <= 2 ? `Try the ${['I-II', 'II-III', 'I-III'][path[0]]} lever.` : 'Each lever turns two rings. Line up the same signs on every spoke.', 3200); });
      S.refresh = () => {
        if (S.main) return;
        if (S.phase === 'hub') { const n = G.doorsOpen; objective(n === 1 ? 'Go through the red door: Calder Row, summer 2025' : n === 2 ? 'The second door: Test Hall Zero, 19.10.2026' : 'The third door: World 0907, Rain City 2049'); }
        else if (S.phase === 'loom') { const st = loom.state(); objective(`Align the three memories at the Loom: pull the levers until the same signs meet on the spokes (${st.aligned}/3 aligned)`); }
        else if (S.phase === 'seal') objective('Seal the Loom at the clock in the middle');
      };
      // arrival
      S.phase = 'hub';
      if (arrival) await arrival();
      return W;
    }
    // bring a finished memory's fragments to the Loom
    async function placeStrand(st, i) {
      S.main = true; cine(true);
      await game.shot([Math.sin(i) * 3, 7.5, 7.5], [0, 0, 0], 1.8, { fov: 46 });
      G.placed[st] = true; W.place(); audio.sfxPlay('motif');
      await tween(1.2, k => { W.rings[i].position.y = Math.sin(k * PI) * 0.2; });
      ui.toast(`RING ${['I', 'II', 'III'][i]} · ${STRAND_NAME[st]} · 4 FRAGMENTS PLACED`, 2600);
      S.main = false;
    }

    // =================================================================================================================
    // I · CALDER ROW, SUMMER 2025 — explore Mira's childhood with Kai
    // =================================================================================================================
    async function calder() {
      await ui.fade(1, 900);
      await newPlace({ background: 0xbcd0e0, fog: [0xd8dce0, 0.006], exposure: 1.0, bloom: 0.5, bloomThreshold: 0.9, envIntensity: 0.9, killY: -8 }, {
        id: 'calder', title: 'Calder Row · summer 2025',
        holders: [{ id: 'kai', key: '1', name: 'AS KAI REMEMBERS', year: 'KAI · 2025', color: '#5fe6ff', glyph: '◐' }, { id: 'mira', key: '2', name: 'AS MIRA REMEMBERS', year: 'MIRA · 2025', color: '#b9a4ff', glyph: '◑' }],
        initial: 'kai',
        bounds: {
          kai: [[-7, -36.6, 7, 34], [7, -7, 14.7, 7], [-9.4, -44.4, -7, -36], [-26, -50, 26, -44.2], [-1.6, -80, 1.6, -36, -0.8]],
          mira: [[-7, -36.6, 7, 34], [7, -7, 14.7, 7], [-9.4, -44.4, -7, -36], [-26, -50, 26, -44.2], [-1.6, -80, 1.6, -36, -0.8], [-3.3, -61, 3.6, -50.2, -3.6]],
        },
        onEdge: (h) => ui.subtitle('mira', h === 'mira' ? 'I don\'t remember past here.' : 'You never went further than this. Not that summer.', 2400),
      });
      W = buildCalder(game, game.scene, T); prevRoot.push(W.root);
      game.onUpdate((dt, t) => W.update(dt, t));
      rig(W, {
        kai: { fog: [0xd8e0e8, 0.006], env: 0.95, bg: 0xbcd0e0, hemi: [0xdfeaf4, 0x6a6458, 0.55], sun: [0xfff4e4, 2.6], dir: [0.3, 0.9, 0.4], exp: 1.0, beds: { wind: 0.012, crowd: 0.01, water: 0.02 }, onApply: () => W.setWater(-2.75) },
        mira: { fog: [0xf0c8a0, 0.009], env: 0.9, bg: 0xf0b890, hemi: [0xffd8b0, 0x5a4434, 0.5], sun: [0xffb070, 2.4], dir: [-0.7, 0.28, -0.35], exp: 1.06, beds: { wind: 0.01, water: 0.03 }, onApply: () => W.setWater(-3.12) },
      }, { kai: { preset: 'day', elevation: 52, azimuth: 160, cover: 0.25 }, mira: { preset: 'golden-hour', elevation: 7, azimuth: 250, cover: 0.3 } });
      holderRules({ kai: 'IN YOUR MEMORY SOMETHING STANDS HERE', mira: 'IN HER MEMORY SOMETHING STANDS HERE' });
      themeFor = () => S.phase === 'hide' ? 'm20-hide' : (pl.pos.x > 7.2 && Math.abs(pl.pos.z) < 7 ? 'm20-kitchen' : 'm20-childhood');
      S.phase = 'intro'; S.round = 0; S.pebbles = 0;
      const kid = await actor('m20mira9', ...P1.lamp, PI / 2, true); const kk = await actor('m20kai6', P1.lamp[0] + 0.5, 0.14, P1.lamp[2] - 0.2, -PI / 2, true);
      const mum = await actor('m20mother', 12.8, 0.02, 5.6, -PI * 0.75);
      mira = await actor('mira', 1.2, 0, 25.6, PI * 0.85);
      // memory figures cast no shadow in her memory (missing shadows)
      T.onSwitch((id) => { for (const ch of [kid, kk, mum]) ch.root.traverse(o => { if (o.isMesh) o.castShadow = id === 'kai'; }); });
      // footprints (Residue Vision) for the hiding rounds
      const prints = new THREE.Group(); game.scene.add(prints);
      const printMat = new THREE.MeshBasicMaterial({ color: MIRA_V, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
      const trail = (path) => {
        for (const c of [...prints.children]) { prints.remove(c); c.geometry.dispose(); }
        let k = 0;
        for (let i = 0; i < path.length - 1; i++) {
          const [ax, ay, az] = path[i], [bx, by, bz] = path[i + 1], d = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
          for (let u = 0; u < d; u += 0.75, k++) {
            const f = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.2), printMat); const side = k % 2 ? 0.09 : -0.09;
            f.rotation.x = -PI / 2; f.rotation.z = -yaw; f.position.set(ax + (bx - ax) * u / d + Math.cos(yaw) * side, ay + (by - ay) * u / d + 0.03, az + (bz - az) * u / d - Math.sin(yaw) * side); prints.add(f);
          }
        }
        game.residue(prints);
      };
      const HIDE = [
        { spot: [-6.3, 0.14, 19.3], ry: PI, path: [[-5.2, 0.14, 8.6], [-5.6, 0.14, 13], [-5.4, 0.14, 19.0], [-6.3, 0.14, 19.3]], holders: ['kai', 'mira'], crouch: 1 },
        { spot: [14.15, 0.02, 0], ry: -PI / 2, path: [[-4.8, 0.14, 8.0], [2, 0, 3], [6.2, 0.14, 0.2], [8.2, 0.02, 0], [14.15, 0.02, 0]], holders: ['mira'], crouch: 1 },
        { spot: P1.bar, ry: PI, path: [[-4.8, 0.14, 7.6], [-6.0, 0.14, -30], [-8.2, 0.14, -36.2], [-8.2, -2.6, -44.2], [-3.6, -2.6, -49.6], [-2.6, -2.95, -51.8], [-1.4, -2.95, -53.6], [-0.2, -2.95, -55.4], P1.bar], holders: ['mira'], pose: 'sit' },
      ];
      const hideState = { hiding: false };
      async function startRound(n) {
        S.round = n; const H = HIDE[n - 1]; S.phase = 'counting';
        kid.pose = null; kid.crouch = 0; holderVis(kid, 'kai', 'mira');
        kid.root.position.set(...P1.lamp); kk.root.position.set(P1.lamp[0] + 0.5, 0.14, P1.lamp[2] - 0.2); kk.root.rotation.y = -PI / 2; kk.pose = 'look';
        await game.say('m20mira9', ['Count to twenty, Kai! No peeking!', 'Again! Count properly this time!', 'Last one. Bet you can\'t.'][n - 1]);
        trail(H.path);
        const run = walkTo(kid, H.path, 2.6);
        await game.say('m20kai6', n === 3 ? 'One, two, three, four... ten... twenty! Coming!' : 'One, two, three... nineteen, twenty! Coming, ready or not!');
        await run;
        kid.root.position.set(...H.spot); kid.root.rotation.y = H.ry; kid.crouch = H.crouch || 0; kid.pose = H.pose || null; holderVis(kid, ...H.holders);
        S.phase = 'hide'; hideState.hiding = true; kk.pose = null;
        game.checkpoint(pl.pos.x, pl.pos.y, pl.pos.z, pl.yaw);
      }
      const foundIt = act({ pos: [0, 0, 0], radius: 1.9, prompt: 'Found you!', enabled: () => S.phase === 'hide' && kid.root.visible && Math.hypot(pl.pos.x - kid.root.position.x, pl.pos.z - kid.root.position.z) < 1.9 && Math.abs(pl.pos.y - kid.root.position.y) < 1.2, onUse: () => side(found) });
      game.onUpdate(() => { foundIt.pos.set(kid.root.position.x, kid.root.position.y + 0.8, kid.root.position.z); });
      async function found() {
        S.main = true; cine(true); hideState.hiding = false; G.found++; audio.sfxPlay('success');
        const n = S.round; kid.crouch = 0; kid.pose = null;
        if (n === 1) {
          await convo(kid, [['m20mira9', 'Not fair! You always look there first!']]);
          mira.root.position.set(-4.4, 0.14, 21.8); holderVis(mira, 'kai', 'mira');
          await convo(mira, [['mira', 'That\'s how you remember it. You found me every time.'], ['kai', 'I did.'], ['mira', 'You found me once. Behind the bins. You\'ve been finding me there for twenty-three years.'], ['mira', 'Look at it the way I do. Two.']]);
          if (!T.unlocked) { T.unlocked = true; T.refreshHud(); ui.toast('MEMORY · 1 AS KAI REMEMBERS · 2 AS MIRA REMEMBERS (Q switches)', 4200); }
          S.main = false; cine(false); await startRound(2);
        } else if (n === 2) {
          await game.shot([12.0, 1.4, 0.6], [14.1, 0.7, 0], 1.2, { fov: 40 });
          await game.say('m20mira9', 'Shh. Listen. It\'s singing again.');
          await game.say('kai', 'What is?');
          audio.sfxPlay('motif');
          await game.say('m20mira9', 'Something far away. Under the city. The same three notes, every night.');
          mira.root.position.set(9.6, 0.02, -0.4); mira.root.rotation.y = PI / 2;
          await convo(mira, [['mira', 'You never looked in here. Not once.'], ['mira', 'I sat in the dark under the stairs and listened to it for a year before the open day.'], ['kai', 'You never told me.'], ['mira', 'You were six. You\'d have told Mum.']]);
          fragment('I', 'tune');
          contradiction('found', 'Hide and seek', ['Kai: "I always found her."', 'Mira: "You found me once."']);
          S.main = false; cine(false); await startRound(3);
        } else {
          await game.shot([3.8, -1.6, -55.4], [1.2, -2.4, -57.6], 1.4, { fov: 40 });
          audio.sfxPlay('motif');
          await game.say('m20mira9', 'Mm-mm-mmm. Hear it? E, B, A.');
          kk.root.position.set(-3.8, -2.6, -49.4); kk.root.rotation.y = PI; holderVis(kk, 'kai', 'mira');
          await game.say('m20kai6', 'Found you! What are you doing in the river?');
          await game.say('m20mira9', 'Teaching you something. You count the splashes, not the sinking. Get a flat one.');
          kid.root.position.set(-5.2, -2.6, -49.2); kid.root.rotation.y = PI; holderVis(kid, 'kai', 'mira');
          S.phase = 'stones'; game.checkpoint(-6, -2.6, -47.4, PI);
          S.main = false; cine(false);
        }
      }
      // ---------- skipping stones ----------
      W.pebbles.forEach((m, i) => act({ pos: [m.position.x, m.position.y + 0.3, m.position.z], radius: 1.5, prompt: 'Pick up a flat stone', enabled: () => S.phase === 'stones' && m.visible, onUse: () => { m.visible = false; S.pebbles++; audio.sfxPlay('pickup'); ui.toast(`FLAT STONES ${S.pebbles}`, 1400); void i; } }));
      const meter = document.createElement('div');
      meter.style.cssText = 'position:absolute;left:50%;bottom:calc(150px + var(--sb,0px));transform:translateX(-50%);width:min(420px,70vw);height:22px;border-radius:11px;background:rgba(14,10,22,.6);border:1px solid rgba(255,230,200,.5);display:none;pointer-events:none;z-index:6';
      meter.innerHTML = '<div style="position:absolute;left:62%;width:20%;top:0;bottom:0;background:rgba(150,230,190,.35);border-radius:11px"></div><div class="m20cur" style="position:absolute;top:-4px;width:6px;height:30px;border-radius:3px;background:#ffe8c8;left:0"></div><div style="position:absolute;top:-24px;width:100%;text-align:center;color:#ffe8c8;font:600 12px var(--ui,system-ui);letter-spacing:.14em">RELEASE IN THE GREEN · E / HAND</div>';
      (document.getElementById('hud') || document.body).appendChild(meter);
      let mu = 0, mOn = false;
      game.onUpdate(dt => { if (!mOn) return; mu += dt * 0.9; const x = (Math.sin(mu * PI) + 1) / 2; meter.querySelector('.m20cur').style.left = `calc(${(x * 100).toFixed(1)}% - 3px)`; S.mx = x; if (game.autoplay && Math.abs(x - 0.72) < 0.04) release.onUse(); });
      const release = game.interact({ pos: [0, -100, 0], radius: 0.1, once: false, prompt: 'Release the stone', enabled: () => mOn, onUse: () => { if (mOn) { mOn = false; S.released = true; } } });
      game.onUpdate(() => { release.pos.set(pl.pos.x, pl.pos.y + 1, pl.pos.z); release.radius = mOn ? 2 : 0.01; });
      act({ pos: [P1.throw[0], -1.6, P1.throw[2]], radius: 1.8, prompt: 'Skip a stone', enabled: () => S.phase === 'stones' && S.pebbles > 0, onUse: () => side(async () => {
        S.pebbles--; G.throws++; pl.yaw = PI; kai.root.rotation.y = PI;
        S.released = false; mu = 0; mOn = true; meter.style.display = 'block';
        await game.waitFor(() => S.released || !mOn);
        meter.style.display = 'none';
        const acc = Math.max(0, 1 - Math.abs((S.mx ?? 0) - 0.72) / 0.3), skips = Math.max(0, Math.round(acc * 6.4 - 0.4));
        S.main = true; cine(true);
        await game.shot([P1.throw[0] + 3.2, -1.2, P1.throw[2] + 1.6], [P1.throw[0] - 1, -2.8, P1.throw[2] - 8], 0.6, { fov: 46 });
        const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.025, 10), new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.4 })); game.scene.add(stone);
        const lvl = T.current === 'mira' ? -3.12 : -2.75, ring = [];
        let x = P1.throw[0], z = P1.throw[2] - 0.6;
        for (let i = 0; i <= skips; i++) {
          const len = 2.6 * Math.pow(0.8, i), x0 = x, z0 = z;
          await tween(0.28 * Math.pow(0.85, i), (k, u) => { stone.position.set(x0 + 0.1 * u, lvl + 0.02 + Math.sin(u * PI) * (0.5 * Math.pow(0.7, i)) + (i === 0 ? (1 - u) * 1.1 : 0), z0 - len * u); stone.rotation.y += 0.6; });
          x = stone.position.x; z = stone.position.z;
          if (i < skips) { const r = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false })); r.rotation.x = -PI / 2; r.position.set(x, lvl + 0.03, z); game.scene.add(r); ring.push(r); audio.sfxPlay('pickup'); }
        }
        await tween(0.5, k => { stone.position.y = lvl - k * 0.3; for (const r of ring) { r.scale.setScalar(1 + k * 5); r.material.opacity = 0.7 * (1 - k); } });
        game.scene.remove(stone); for (const r of ring) game.scene.remove(r);
        G.skips = Math.max(G.skips, skips);
        await game.say('m20mira9', skips >= 4 ? `${['One', 'Two', 'Three', 'Four', 'Five', 'Six'][Math.min(5, skips - 1)]}! See? Count the splashes.` : skips > 0 ? `${['One', 'Two', 'Three'][skips - 1]}. Flatter. And low. Like you're throwing it along the water.` : 'Sinking. Don\'t count that one. Again.');
        if (skips >= 4) { S.main = false; await stonesDone(); return; }
        if (S.pebbles === 0 && W.pebbles.every(m => !m.visible)) { W.pebbles.forEach(m => { m.visible = true; }); ui.subtitle('m20mira9', 'There are more. There are always more.', 2400); }
        S.main = false; cine(false);
      }) });
      async function stonesDone() {
        S.main = true; cine(true);
        kid.root.position.set(-6.6, -2.6, -49.1); kk.root.position.set(-5.9, -2.6, -49.3); kid.root.rotation.y = PI * 0.9; kk.root.rotation.y = PI;
        if (T.current === 'mira') { kid.pose = 'work'; kid.lookTarget = kk.head; }
        await game.shot([-3.0, -1.4, -51.0], [-6.2, -2.0, -49.2], 1.4, { fov: 38 });
        await game.say('kai', 'Five. I taught you that.');
        mira.root.position.set(-9.0, -2.6, -47.8); holderVis(mira, 'kai', 'mira');
        await convo(mira, [['mira', 'You were six. You couldn\'t throw past your own feet.'], ['mira', 'I put my hand over yours and showed you. Look.']]);
        await forceHolder('mira');
        kid.pose = 'work'; kid.lookTarget = kk.head; kk.pose = 'look';
        await game.shot([-4.0, -1.5, -51.4], [-6.2, -1.9, -49.2], 1.6, { fov: 34 });
        await game.say('m20mira9', 'Like this. Flat. Low. Now let go.');
        await game.say('kai', 'I remember teaching her. She remembers teaching me.');
        await game.say('mira', 'Both. That\'s the trouble with me, Kai. Both is all I\'ve got.');
        G.pebbleKept = true;
        ui.toast('YOU KEEP ONE FLAT STONE', 2400);
        fragment('I', 'hand');
        contradiction('taught', 'Who taught whom', ['Kai: "I taught her to skip stones."', 'Mira: "I taught him."']);
        kid.pose = null; kid.lookTarget = null; kk.pose = null;
        S.phase = 'home'; game.checkpoint(0, 0, -30, 0);
        S.main = false; cine(false);
        ui.subtitle('mira', 'Mum will be calling us in. Number fourteen. Look at it both ways.', 3200);
      }
      // ---------- No. 14: the kitchen and the children's room ----------
      kid.root.visible = true;
      act({ pos: [12.6, 1.2, 4.6], radius: 2.0, prompt: 'Mum', states: ['kai'], enabled: () => S.phase === 'home' && !G.mum.kai, onUse: () => side(async () => {
        S.main = true; cine(true); mum.pose = null; mum.talk = 1;
        await game.shot([9.4, 1.6, 2.2], [12.8, 1.4, 5.6], 1.2, { fov: 40 });
        await game.say('m20mother', 'No, they\'re out on the street, the pair of them. Inseparable. ...Kai! Don\'t let her near the river!');
        audio.sfxPlay('success');
        await game.say('kai', 'The radio on. The window open. She laughed all summer. That\'s the summer I remember.');
        G.mum.kai = true; mum.talk = 0; S.main = false; cine(false); checkHome();
      }) });
      act({ pos: [11.4, 1.0, 4.0], radius: 2.0, prompt: 'The letter on the table', states: ['mira'], enabled: () => S.phase === 'home' && !G.mum.mira, onUse: () => side(async () => {
        S.main = true; cine(true); mum.pose = 'sad';
        await closeUp([11.2, 0.8, 4.1], [['m20mother', 'It\'s just headaches, love. The doctor will listen to your singing and tell us you\'re growing.']], 1.0);
        ev('Halden General · Neurology', 'Outpatient appointment, Thursday 14 August 2025, Ward 4, room 4-07 (EEG). Patient: Mira Varen, 9. Referred for recurrent auditory episodes ("singing") and headaches.', 'Memory · I · Calder Row');
        await game.say('kai', 'Ward Four. Room four-oh-seven. The same bed, in twenty thirty-eight.');
        mira.root.position.set(9.4, 0.02, 3.4); holderVis(mira, 'kai', 'mira');
        await convo(mira, [['mira', 'She never told you either. We were good at that, in our family.']]);
        contradiction('summer', 'Summer 2025', ['Kai: "The summer she laughed."', 'Mira: "The summer of the hospital letters."']);
        G.mum.mira = true; F.m20letter = true; mum.pose = null; S.main = false; cine(false); checkHome();
      }) });
      act({ pos: [13.8, 1.0, -6.0], radius: 1.8, prompt: 'The drawing on the desk', enabled: () => S.phase === 'home' && !G.draw[T.current], onUse: () => side(async () => {
        S.main = true; cine(true); const h = T.current;
        await closeUp([13.8, 0.8, -6.2], [], 0.9, 36);
        if (h === 'kai') await game.say('kai', 'ME. MIRA. THE MACHINE. I drew this. Helix found it in a drawer in twenty forty-nine, and I knew my own hand.');
        else { await game.say('kai', 'ME. KAI. THE MACHINE. Her writing. And three lines round the ring: "it sings".'); await game.say('mira', 'I drew it first. You copied me. You copied everything I did that summer.'); }
        G.draw[h] = true;
        if (G.draw.kai && G.draw.mira) { fragment('I', 'machine'); contradiction('drawing', 'The drawing', ['Kai: "ME · MIRA · THE MACHINE. I drew it."', 'Mira: "ME · KAI · THE MACHINE. I drew it first."']); }
        else ui.subtitle('kai', h === 'kai' ? 'And in her memory?' : 'And in mine?', 2200);
        S.main = false; cine(false); checkHome();
      }) });
      // optional: the height marks, Mum's list, the ball, the carving, the shards
      act({ pos: [10.1, 1.2, 1.4], radius: 1.5, prompt: 'Pencil marks on the door frame', enabled: () => !S.seen.heights || (T.current === 'mira' && !G.heights), onUse: () => side(async () => {
        S.seen.heights = true;
        await closeUp([10.02, 1.15, 1.34], [], 0.8, 34);
        if (T.current === 'kai') await game.say('kai', 'K four, five, six. M seven, eight, nine. Mum measured us every birthday.');
        else { G.heights = true; F.m20heights = true; await game.say('kai', 'M ten. M fourteen. M twenty. M thirty-three. M fifty-eight.'); await game.say('kai', 'Heights she never reached. Not here. Not in this world.'); ev('The door frame', 'In Mira\'s memory the pencil marks go on past 2026: M 10, M 14, M 20, M 33, M 58. Birthdays she never had in this world.', 'Memory · I · Calder Row'); }
        game.releaseCam();
      }) });
      act({ pos: [7.5, 1.4, 6.4], radius: 1.4, prompt: 'A list on the fridge', enabled: () => !G.list, onUse: () => side(async () => {
        G.list = true; await closeUp([7.36, 1.5, 6.5], [['kai', 'Mum\'s green ink. "Ask Dr about the singing." It was on the fridge all summer.']], 0.7, 32);
        ev('Mum\'s list', 'Elena Varen\'s shopping list in green ink: milk, plasters (Kai\'s knees), crayons, "ask Dr about the singing".', 'Memory · I · Calder Row');
      }) });
      act({ pos: [8.6, 0.6, -3.6], radius: 1.4, prompt: 'A red ball', states: ['kai'], enabled: () => !G.ball, onUse: () => side(async () => { G.ball = true; await game.say('kai', 'I lost this in the river the same day. In her memory it isn\'t even here.'); }) });
      act({ pos: [-1.3, -1.8, -46.8], radius: 1.6, prompt: 'Letters cut into the bridge post', enabled: () => !G.carving, onUse: () => side(async () => {
        G.carving = true; F.m20carving = true;
        await closeUp([-1.25, -1.6, -46.8], [['kai', carved ? 'K plus M, twenty twenty-five. I saw this in the gorge. We cut it the same afternoon.' : 'K plus M. Twenty twenty-five. Her penknife. My idea.'], ['mira', 'My idea. Your penknife.']], 0.8, 34);
        ev('K + M · 2025', 'Cut into the bridge post on Calder Row the afternoon of the stones. Each of them remembers whose idea it was.', 'Memory · I · Calder Row');
      }) });
      W.shards.forEach((m, i) => shard(i ? 'Calder Row, the bank' : 'Calder Row, the street', m));
      // ---------- the ending of this memory ----------
      async function checkHome() {
        if (!(G.mum.kai && G.mum.mira && G.draw.kai && G.draw.mira) || S.phase !== 'home') return;
        S.phase = 'teatime';
        await game.waitFor(() => !S.busy && game.control && !ui.dlgActive);
        S.busy = true; S.main = true; cine(true);
        try {
          mum.root.position.set(6.4, 0.14, 0.4); mum.root.rotation.y = -PI / 2; holderVis(mum, 'kai', 'mira');
          kid.root.position.set(-2.6, 0, 5.8); kk.root.position.set(-2.0, 0, 6.4); holderVis(kid, 'kai', 'mira'); holderVis(kk, 'kai', 'mira'); kid.pose = null; kk.pose = null;
          await game.shot([0, 2.6, 12], [3, 1.2, 1.5], 1.6, { fov: 46 });
          await game.say('m20mother', 'Kai! Mira! Tea!');
          const a = walkTo(kid, [[2, 0, 2.4], [6.0, 0.14, 0.6], [9.6, 0.02, 0.2]], 2.0), b = walkTo(kk, [[2.6, 0, 3.0], [6.0, 0.14, 1.0], [9.8, 0.02, 0.8]], 2.0);
          await game.say('m20mira9', 'Race you!');
          await Promise.all([a, b]);
          mira.root.position.set(1.6, 0, 6.4); holderVis(mira, 'kai', 'mira');
          await convo(mira, [['mira', 'Both of us. In that one, we both go home.'], ['kai', 'That\'s the one I keep.'], ['mira', 'I know. Keep it. Just don\'t make the others into it.']]);
          fragment('I', 'ending');
          G.done.I = true; F.m20calder = true;
          S.phase = 'exit'; game.checkpoint(0, 0, 26, 0);
        } finally { S.main = false; S.busy = false; cine(false); }
        refresh();
      }
      act({ pos: [P1.exit[0], 1.2, P1.exit[2] - 1.5], radius: 3.0, prompt: 'Go back to the Threshold', enabled: () => S.phase === 'exit', onUse: () => { S.leave = true; } });
      // hints
      hint(() => S.phase === 'hide' && S.round === 1, 40, () => ui.subtitle('mira', 'Behind something. Something that smells. You know where.', 2600));
      hint(() => S.phase === 'hide' && S.round === 2, 40, () => ui.subtitle('mira', T.current === 'kai' ? 'You won\'t find me in your version. Two.' : 'Footprints. F. Follow them in.', 2800));
      hint(() => S.phase === 'hide' && S.round === 3, 45, () => ui.subtitle('mira', T.current === 'kai' ? 'The river\'s too high in yours. In mine there are stones.' : 'Down the steps to the water. The stones under the bridge.', 3000));
      hint(() => S.phase === 'stones', 50, () => ui.subtitle('m20mira9', S.pebbles ? 'At the edge. Throw it low!' : 'Flat ones. On the bank. They shine a bit.', 2400));
      hint(() => S.phase === 'home', 60, () => ui.subtitle('mira', !G.mum.kai || !G.mum.mira ? 'The kitchen. Mum. Yours, then mine.' : 'Our room. The desk. Look at it both ways.', 2800));
      S.refresh = () => {
        if (S.main) return;
        const p = S.phase;
        if (p === 'hide') objective(`Hide and seek: find Mira (round ${S.round}/3)${S.round > 1 ? ' · F shows footprints · 1/2 whose memory' : ''}`);
        else if (p === 'stones') objective(S.pebbles ? `Skip a stone from the bank: count the splashes (best ${G.skips})` : 'Find a flat stone on the bank');
        else if (p === 'home') { const left = []; if (!G.mum.kai) left.push('the kitchen as Kai remembers it (1)'); if (!G.mum.mira) left.push('the kitchen as Mira remembers it (2)'); if (!G.draw.kai || !G.draw.mira) left.push(`the drawing, both ways (${+G.draw.kai + +G.draw.mira}/2)`); objective('Go home to No. 14: ' + left.join(' · ')); }
        else if (p === 'exit') objective('Go back to the Threshold: the south end of the street');
      };
      // intro
      S.main = true; cine(true);
      pl.place(...P1.start); kai.root.rotation.y = PI;
      lockMusic('m20-childhood', 0.5);
      await game.shot([10, 9, 34], [-2, 1.5, 6], 0.01, { fov: 50 });
      await ui.fade(0, 1400);
      const card = chapterTitle('I', 'Calder Row', 'Summer 2025 · the way two children remember it');
      await game.shot([5, 5, 30], [-3, 1.2, 8], 4.6, { fov: 48 });
      await card;
      await game.shot([1.0, 1.8, 30.2], [-4.6, 1.1, 8.2], 1.6, { fov: 40 });
      await game.say('kai', 'Calder Row. The summer before.');
      await convo(mira, [['mira', 'You were six. I was nine. Mum worked from the kitchen. We lived on this street.'], ['kai', 'It\'s exactly how I remember it.'], ['mira', 'That\'s the problem. It\'s exactly how you remember it. Watch.']]);
      musicLock = null;
      S.main = false; cine(false);
      game.checkpoint(...P1.start);
      await startRound(1);
      await game.waitFor(() => S.leave && !S.busy);
      meter.remove();
      await ui.fade(1, 900);
      return threshold(async () => {
        pl.place(P0.doors[0][0] * 0.7, 0, P0.doors[0][2] * 0.7 + 1, PI * 0.7); G.doorsOpen = 2;
        await ui.fade(0, 900);
        await placeStrand('I', 0);
        await convo(mira, [['mira', 'One down. You kept looking at Mum.'], ['kai', 'She was happy. I was sure she was happy.'], ['mira', 'She was. And frightened. People manage both. Next door.']]);
        cine(false); game.checkpoint(0, 0, 6, PI); refresh();
      });
    }

    // =================================================================================================================
    // II · TEST HALL ZERO, 19.10.2026 — replay the original experiment
    // =================================================================================================================
    async function testHall() {
      await ui.fade(1, 900);
      await newPlace({ background: 0x1a1c22, fog: [0x2a2c34, 0.01], exposure: 1.0, bloom: 0.6, bloomThreshold: 0.85, envIntensity: 0.5, killY: -6, dark: false }, {
        id: 'hall', title: 'Test Hall Zero · 19.10.2026',
        holders: [{ id: 'kai', key: '1', name: 'AS KAI REMEMBERS', year: 'KAI · 2026', color: '#5fe6ff', glyph: '◐' }, { id: 'mira', key: '2', name: 'AS MIRA REMEMBERS', year: 'MIRA · 2026', color: '#b9a4ff', glyph: '◑' }],
        initial: 'kai', bounds: [[-16, -36, 16, 16]],
      });
      W = buildTestHall(game, game.scene, T); prevRoot.push(W.root);
      game.onUpdate((dt, t) => W.update(dt, t));
      rig(W, {
        kai: { fog: [0xc8ccd0, 0.008], env: 0.8, bg: 0x9aa0a8, bgColor: true, hemi: [0xf0f4f8, 0x8a8c90, 0.85], sun: [0xf4f8ff, 0.5], dir: [0.2, 1, 0.3], exp: 1.0, beds: { hum: 0.02, hz: 60, crowd: 0.03 } },
        mira: { fog: [0x1a1428, 0.02], env: 0.35, bg: 0x0c0a14, bgColor: true, hemi: [0x8a7ab8, 0x141020, 0.35], sun: [0xb09aff, 0.3], dir: [0, 1, -0.4], exp: 1.08, beds: { hum: 0.04, hz: 110 } },
      }, { all: { preset: 'interior', color: 0xe8eef5, wall: 0x3a3e44 } });
      holderRules({ kai: 'IN YOUR MEMORY THE CROWD STOOD HERE', mira: 'SHE NEVER LOOKED HERE · NOTHING IS THERE' });
      themeFor = () => (T.current === 'mira' ? 'm20-singing' : 'm20-experiment');
      S.phase = 'intro';
      const kk = await actor('m20kai7', ...P2.kidKai, PI, true), km = await actor('m20mira10', ...P2.kidMira, PI, true);
      const mum = await actor('m20mother', ...P2.mother, PI * 0.85), rook = await actor('m20rook26', ...P2.rook, PI / 2 + 0.3);
      mira = await actor('mira', ...P2.mira, PI * 0.8); holderVis(mira, 'kai', 'mira');
      holderVis(mum, 'kai'); holderVis(rook, 'kai');
      // the visitors (Kai's memory): a crowd that fills the hall between the gallery and the rope
      const crowd = []; const r = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(2026);
      for (let i = 0; i < 12; i++) { const w = new Walker(game, pastLook(r), { x: -4.4 + (i % 6) * 1.75, y: 0, z0: -12 + Math.floor(i / 6) * 5.2, z1: -12 + Math.floor(i / 6) * 5.2, idle: true, ry: PI + (r() - 0.5) * 0.6 }); crowd.push(w); w.c.root.position.z = -11.6 + Math.floor(i / 6) * 5.6 + r() * 2; T.only(w.c.root, 'kai'); }
      game.onUpdate(dt => { for (const w of crowd) if (w.c.root.visible) w.update(dt); });
      await tick();
      // the replay
      const say = (id, line, ms = 2600) => ui.subtitle(id, line, ms);
      const replay = new MemoryReplay(game, { from: '08:13:30', to: '08:14:09', seconds: 96, events: [
        { at: '08:13:36', fn: () => say('m20pa', 'Visitors, please remain behind the rope. The demonstration begins at eight-fourteen.', 3200) },
        { at: '08:13:50', fn: () => { if (T.current === 'kai') say('m20mother', 'Kai, hold your sister\'s hand. Stay behind the rope.'); } },
        { at: '08:14:00', fn: () => { if (T.current === 'kai') say('m20rook26', 'Field coming up. Stand clear.'); } },
        { at: '08:14:02', fn: () => { say(T.current === 'kai' ? 'm20rook26' : 'm20mira10', T.current === 'kai' ? 'Field at four point one. Run one.' : 'It\'s singing. Louder.'); audio.sfxPlay('anomaly'); W.ring.userData.disc.material.uniforms.uPower.value = 0.8; } },
        { at: '08:14:05', fn: () => say('m20mira10', 'Kai. It\'s singing. Can you hear it?') },
      ], onEnd: () => { S.endHit = true; } });
      musicState.urgency = 0;
      game.onUpdate(() => {
        const run = replay.running && S.phase === 'loop';
        musicState.urgency = run ? replay.frac : 0;
        hudSet(run ? [[`MEMORY · ${replay.clock}`, 1 - replay.frac, replay.left < 15 ? '#ff9a8a' : '#c8b4ff'], [`DETAILS ${G.details.size}/4${G.details.size === 4 ? ' · STAND WHERE YOU STOOD' : ''}`, null]] : null);
      });
      async function resetLoop(msg) {
        S.busy = true; S.main = true; replay.stop();
        try {
          cine(true); audio.sfxPlay('rewind'); game.shake = 0.05;
          await ui.fade(1, 800);
          G.loops++; W.ring.userData.disc.material.uniforms.uPower.value = 0.35;
          T.setImmediate('kai'); pl.place(...P2.start);
          await game.wait(0.3); await ui.fade(0, 800);
          ui.toast(msg || '08:14:09 · THE MEMORY STOPS HERE · WHAT YOU SAW IS KEPT', 3000);
          replay.start();
        } finally { S.main = false; S.busy = false; cine(false); }
      }
      game.onUpdate(() => { if (S.endHit && !S.busy && S.phase === 'loop') { S.endHit = false; resetLoop(); } });
      // details
      const detail = (key, title, text) => { if (G.details.has(key)) return; G.details.add(key); ev(title, text, 'Memory · II · Test Hall Zero'); ui.toast(`DETAIL ${G.details.size}/4 · ${title.toUpperCase()}`, 2200); if (G.details.size === 4) ui.subtitle('mira', 'That\'s everything we each saw. Now stand where you stood. Before nine seconds past.', 3600); };
      act({ pos: [P2.badge[0], 1.2, P2.badge[2]], radius: 1.7, prompt: 'The visitor badges', states: ['kai'], enabled: () => S.phase === 'loop' && !G.details.has('badge'), onUse: () => side(async () => {
        replay.hold = true;
        await closeUp(P2.badge, [['kai', 'K. VAREN. Visitor, age seven. ACCOMPANIED. Mum signed for me.']], 0.7, 32);
        detail('badge', 'Visitor badge · K. Varen', 'HELIX OPEN DAY 2026 · K. VAREN · VISITOR · AGE 7 · ACCOMPANIED. There is no badge for Mira on the table.'); replay.hold = false;
      }) });
      act({ pos: [P2.list[0], 1.2, P2.list[2]], radius: 1.6, prompt: 'The visitor list', states: ['kai'], enabled: () => !G.visitors, onUse: () => side(async () => {
        replay.hold = true; G.visitors = true; F.m20visitors = true;
        await closeUp(P2.list, [['kai', 'Eight-oh-nine. "Mira Varen, age ten." Her own handwriting. And a little ring drawn after her name.'], ['kai', 'She signed herself in. Nobody stopped a ten-year-old.']], 0.7, 32);
        ev('The visitor list', 'Test Hall Zero, 19.10.2026: "08:02 E. Varen + 1 (K. Varen, 7)" and, in a child\'s hand, "08:09 Mira Varen age 10" with a ring drawn after it.', 'Memory · II · Test Hall Zero'); replay.hold = false;
      }) });
      act({ pos: [P2.console[0], 1.2, P2.console[2]], radius: 1.8, prompt: 'Rook\'s console', enabled: () => S.phase === 'loop' && !G.consoleBoth[T.current], onUse: () => side(async () => {
        replay.hold = true; const h = T.current; G.consoleBoth[h] = true;
        await closeUp([-9.2, 1.36, -14.36], [], 0.9, 34);
        if (h === 'kai') { await game.say('kai', 'RUN 01. Start eight-fourteen oh-two. Field four point one. Collars two, four, one.'); detail('console', 'Field console · RUN 01', 'HELIX FIELD CONTROL · SITE ZERO · RUN 01 · 19.10.2026 · start 08:14:02 · 4.1 kHz · collars II · IV · I · operator E. Rook.'); fragment('II', 'machine'); }
        else { await game.say('kai', 'In her memory the screen says something else. "Audio pickup: three notes. Unexplained." The machine heard her tune.'); ev('The console heard it', 'In Mira\'s memory Rook\'s console logs an unexplained audio pickup: three notes. The ring was singing before the field came up.', 'Memory · II · Test Hall Zero'); }
        replay.hold = false;
      }) });
      act({ pos: [P2.rook[0] + 0.6, 1.4, P2.rook[2] + 0.4], radius: 1.6, prompt: 'Dr. Rook', states: ['kai'], enabled: () => S.phase === 'loop' && !G.rook, onUse: () => side(async () => { G.rook = true; rook.lookTarget = kai.head; await game.say('m20rook26', 'Not now, please. We are four minutes from history.'); await game.say('kai', 'Thirty-nine. He doesn\'t know yet what he\'s going to spend the rest of his life hiding.'); rook.lookTarget = null; }) });
      act({ pos: [P2.listen[0], 1.2, P2.listen[2]], radius: 1.7, prompt: 'Listen to the ring', states: ['mira'], enabled: () => S.phase === 'loop' && !G.details.has('listen'), onUse: () => side(async () => {
        replay.hold = true; S.main = true; cine(true); lockMusic('m20-singing', 0.6);
        await game.shot([1.8, 1.5, -15.2], [0, 3.2, -25], 1.6, { fov: 40 });
        audio.sfxPlay('motif'); await game.wait(1.4); audio.sfxPlay('motif');
        await game.say('kai', 'E. B. A. The tune from under the stairs. In her memory the ring is singing it.');
        await game.say('kai', 'Nobody else in the hall can hear it. Not in mine.');
        detail('listen', 'The ring sings', 'In Mira\'s memory of 19.10.2026 the ring hums three notes, E, B, A: the tune she heard under the stairs all summer. In Kai\'s it is silent.');
        fragment('II', 'tune'); musicLock = null; S.main = false; cine(false); replay.hold = false;
      }) });
      act({ pos: [P2.hook[0], 1.0, P2.hook[2] + 0.4], radius: 1.6, prompt: 'The rope\'s hook', states: ['mira'], enabled: () => S.phase === 'loop' && !G.details.has('hook'), onUse: () => side(async () => {
        replay.hold = true;
        await closeUp([P2.hook[0], 0.9, P2.rope], [['kai', 'Unhooked. Already. A full minute before the field came up.'], ['mira', 'I did it at eight-thirteen while Mum was talking. I\'d planned it for a week.']], 0.8, 34);
        detail('hook', 'The rope\'s hook', 'In Mira\'s memory the rope is unhooked at 08:13, long before the field: she planned it. In Kai\'s she slipped under it at the last second.');
        contradiction('rope', 'The rope', ['Kai: "She slipped under the rope at the last second."', 'Mira: "I unhooked it a minute early. I\'d planned it."']);
        replay.hold = false;
      }) });
      act({ pos: [P2.stand[0], 1.0, P2.stand[2] + 0.6], radius: 1.7, prompt: 'Stand where you stood', enabled: () => S.phase === 'loop' && G.details.size === 4 && replay.running, onUse: () => side(climax) });
      W.shards.forEach((m, i) => shard(i ? 'Test Hall Zero, the press corner' : 'Test Hall Zero, her corridor', m, [i ? 'kai' : 'mira']));
      async function climax() {
        S.main = true; cine(true); replay.hold = true; S.phase = 'climax';
        lockMusic('m20-experiment', 0.5); musicState.urgency = 1;
        await forceHolder('kai');
        pl.place(P2.stand[0] + 0.7, 0, P2.stand[2] + 0.5, PI); kai.root.rotation.y = PI;
        await game.shot([3.4, 1.4, -12.6], [0, 1.0, -16], 1.4, { fov: 42 });
        await game.say('kai', 'Here. Beside myself. Mum behind us. Her hand in mine.');
        km.lookTarget = kk.head;
        await game.shot([1.6, 1.0, -13.8], [0.2, 0.9, -15.6], 1.2, { fov: 36 });
        await game.say('m20mira10', 'Hold on to me.');
        await game.say('m20kai7', 'Mira, the rope! Mum said...');
        audio.sfxPlay('boom'); game.shake = 0.06; W.ring.userData.disc.material.uniforms.uPower.value = 1.2;
        const walk = walkTo(km, [[-0.1, 0, -17.4], [-0.05, 0, -19.6]], 0.8); kk.pose = 'look';
        await game.shot([-3.4, 2.2, -14.6], [0, 2.4, -24], 1.4, { fov: 44 });
        await game.say('m20rook26', 'Who let a child past the... Abort! Cut the field!');
        await walk;
        await game.say('kai', 'And I held on. I held on and it wasn\'t enough.');
        await forceHolder('mira');
        lockMusic('m20-singing', 0.4);
        km.root.position.set(-0.05, 0, -19.6); kk.root.position.set(0.1, 0, -18.4); km.root.rotation.y = 0; kk.root.rotation.y = PI;
        km.lookTarget = kk.head; kk.lookTarget = km.head; kk.pose = 'work';
        await game.shot([1.8, 1.1, -17.8], [0, 0.9, -19.0], 1.4, { fov: 34 });
        await game.say('m20mira10', 'Let go, Kai.');
        audio.sfxPlay('metal');
        kk.pose = 'fall';
        await game.say('m20mira10', 'Let go. You\'re not coming.');
        km.root.rotation.y = PI; km.pose = 'look';
        await game.shot([0.4, 1.4, -13.6], [0, 2.6, -24], 2.2, { fov: 40 });
        audio.silence?.(2.4); game.shake = 0.04;
        await ui.fade(1, 1600);
        km.root.visible = false; kk.pose = 'sad';
        await game.wait(0.6); audio.unsilence?.();
        mira.root.position.set(1.8, 0, -14.6); mira.root.rotation.y = -PI / 2;
        pl.place(0.4, 0, -14.6, PI / 2);
        await ui.fade(0, 1600);
        await convo(mira, [
          ['kai', 'You let go.'],
          ['mira', 'So you wouldn\'t come with me. The cuff tore because I pulled, Kai. Not because you held on.'],
          ['kai', 'I remember holding on. I remember it not being enough.'],
          ['mira', 'Both. You held on, and I let go. That\'s what happened to two people.'],
          ['kai', 'And the ninth second? What happened in it?'],
          ['mira', 'Neither of us has it. Nobody does. That\'s where I\'ve been.'],
        ]);
        fragment('II', 'hand'); fragment('II', 'ending');
        contradiction('hand', 'The hand', ['Kai: "I held on, and it wasn\'t enough."', 'Mira: "I let go, so he wouldn\'t come with me."']);
        G.done.II = true; F.m20experiment = true; F.m20loops = G.loops;
        S.phase = 'exit'; replay.stop(); musicLock = null; musicState.urgency = 0;
        S.main = false; cine(false);
        game.checkpoint(0, 0, 10, PI); refresh();
      }
      act({ pos: [P2.exit[0], 1.2, P2.exit[2] - 1.0], radius: 2.6, prompt: 'Go back to the Threshold', enabled: () => S.phase === 'exit', onUse: () => { S.leave = true; } });
      hint(() => S.phase === 'loop' && G.details.size < 4, 55, () => {
        const need = [];
        if (!G.details.has('badge')) need.push(['kai', 'The cloakroom table. In yours.']); if (!G.details.has('console')) need.push(['kai', 'Rook\'s console. West side. In yours.']);
        if (!G.details.has('listen')) need.push(['mira', 'The ring. Stand at the rope in mine and listen.']); if (!G.details.has('hook')) need.push(['mira', 'The rope\'s hook, left of us. In mine.']);
        const n = need[0]; if (n) ui.subtitle('mira', n[1], 3000);
      });
      hint(() => S.phase === 'loop' && T.current === 'kai' && Math.abs(pl.pos.x) < 6.4 && pl.pos.z < -1 && pl.pos.z > -13, 12, () => ui.subtitle('mira', 'The crowd was in your way. They weren\'t in mine. Two.', 2400));
      S.refresh = () => {
        if (S.main) return;
        if (S.phase === 'loop') {
          const left = []; if (!G.details.has('badge')) left.push('the cloakroom (yours)'); if (!G.details.has('console')) left.push('Rook\'s console (yours)'); if (!G.details.has('listen')) left.push('the ring (hers)'); if (!G.details.has('hook')) left.push('the rope (hers)');
          objective(left.length ? `Replay the experiment: before 08:14:09, find what each of you saw (${G.details.size}/4): ${left.join(' · ')}` : 'Stand where you stood: at the rope, beside yourself, before 08:14:09');
        } else if (S.phase === 'exit') objective('Go back to the Threshold: the foyer doors');
      };
      // intro
      S.main = true; cine(true);
      pl.place(...P2.start); T.unlocked = true; T.refreshHud();
      await game.shot([10, 8, 12], [0, 2.5, -22], 0.01, { fov: 52 });
      await ui.fade(0, 1400);
      const card = chapterTitle('II', 'Test Hall Zero', '19 October 2026 · 08:13:30 · the original experiment');
      await game.shot([6, 6, 4], [0, 2.8, -24], 4.6, { fov: 48 });
      await card;
      await game.shot([-2.4, 1.8, 10.6], [-4.4, 1.5, -10.4], 1.4, { fov: 40 });
      await game.say('mira', 'Eight-thirteen and thirty seconds. This is where it always starts.');
      await game.say('kai', 'And where does it stop?');
      await game.say('mira', 'Eight-fourteen and nine. Neither of us remembers the ninth second. The memory just... ends, and starts again.');
      await game.say('mira', 'You saw things I didn\'t. I saw things you didn\'t. Find them both before it ends. One for yours. Two for mine.');
      S.main = false; cine(false);
      S.phase = 'loop'; replay.start(); game.checkpoint(...P2.start); refresh();
      await game.waitFor(() => S.leave && !S.busy);
      replay.dispose(); hudSet(null);
      await ui.fade(1, 900);
      return threshold(async () => {
        pl.place(P0.doors[1][0] * 0.7, 0, P0.doors[1][2] * 0.7 + 1.2, PI); G.doorsOpen = 3;
        await ui.fade(0, 900);
        await placeStrand('II', 1);
        await convo(mira, [['kai', 'Twenty-three years I\'ve been trying to hold on harder.'], ['mira', 'I know. I watched you. The last door is the one I like least.']]);
        cine(false); game.checkpoint(0, 0, 6, PI); refresh();
      });
    }

    // =================================================================================================================
    // III · WORLD 0907, RAIN CITY 2049 — the discarded timeline where Mira survives and Kai disappears
    // =================================================================================================================
    async function world0907() {
      await ui.fade(1, 900);
      await newPlace({ background: 0x0a0c12, fog: [0x141a24, 0.016], exposure: 1.05, bloom: 0.8, bloomThreshold: 0.75, envIntensity: 0.45, killY: -6, dark: true }, {
        id: 'w0907', title: 'World 0907 · Rain City 2049',
        holders: [{ id: 'mira', key: '1', name: 'AS SHE LIVED IT', year: 'HER LIFE', color: '#b9a4ff', glyph: '◑' }, { id: 'gap', key: '2', name: 'THE SHAPE KAI LEFT', year: 'THE GAP', color: '#5fe6ff', glyph: '○' }],
        initial: 'mira', bounds: [[-8.5, -40.4, 8.5, 44], [8.5, -14, 30, -6], [-10, -68, 10, -40]],
        onEdge: () => ui.subtitle('mira', 'I never went that way. Not in that life.', 2200),
      });
      W = buildRainCity(game, game.scene, T); prevRoot.push(W.root);
      game.onUpdate((dt, t) => W.update(dt, t));
      rig(W, {
        mira: { fog: [0x1a2230, 0.016], env: 0.55, bg: 0x0a0c12, hemi: [0x8a9ab8, 0x1a1418, 0.4], sun: [0x9ab0d8, 0.25], dir: [0.3, 0.8, 0.2], exp: 1.08, beds: { rain: 0.07, crowd: 0.03, hum: 0.01, hz: 50 } },
        gap: { fog: [0x0e2a34, 0.022], env: 0.45, bg: 0x061418, hemi: [0x7feeff, 0x123038, 0.7], sun: [0x8ff0ff, 0.4], dir: [0.3, 0.8, 0.2], exp: 1.12, beds: { hum: 0.03, hz: 120 } },
      }, { mira: { preset: 'night-city', cover: 0.85 }, gap: { preset: 'night-city', cover: 0.95, glowIntensity: 0.2 } });
      game.engine.fx?.uTint?.value && T.onSwitch((id) => { game.engine.fx.uTint.value.set(...(id === 'gap' ? [0.82, 1.02, 1.08] : [1, 1, 1])); });
      holderRules({}, (id) => (id === 'gap' && S.walking && once('gapwalk' + Math.floor(game.time / 5)) ? null : null));
      themeFor = () => (T.current === 'gap' ? 'm20-gap' : 'm20-0907');
      S.phase = 'intro'; S.stop = 0;
      const m33 = await actor('m20mira33', ...P3.m907, PI / 2);
      holderVis(m33, 'mira');
      m33.noCollide = true;
      const jun = await actor('jun', P3.stop[0] - 0.6, 0.15, P3.stop[2] + 1.6, -PI * 0.6); holderVis(jun, 'mira'); jun.noCollide = true;
      // the crowd: people walking home in the rain, straight through Kai
      const crowd = []; const r = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(907);
      for (let i = 0; i < 10; i++) { const w = new Walker(game, citizenLook(r, { umbrella: true }), { x: i % 2 ? 6.6 : -6.6, y: 0.15, z0: -36, z1: 42, speed: 0.8 + r() * 0.5 }); w.c.noCollide = true; crowd.push(w); T.only(w.c.root, 'mira'); }
      game.onUpdate(dt => { for (const w of crowd) if (w.c.root.visible) w.update(dt); });
      await tick();
      // following her: stay close while she walks or the memory frays (soft: Kai is put back near her)
      let far = 0;
      game.onUpdate(dt => {
        if (!S.walking || game.cine || S.busy || game._failing) { far = 0; return; }
        const d = Math.hypot(pl.pos.x - m33.root.position.x, pl.pos.z - m33.root.position.z);
        if (d > 22) far += dt; else far = Math.max(0, far - dt);
        hudSet(d > 15 ? [['STAY WITH HER · THE MEMORY FRAYS', Math.max(0, 1 - far / 4), '#ff9a8a']] : null);
        if (far > 4) { far = 0; fray(); }
      });
      async function fray() {
        S.busy = true; G.frays++;
        try {
          audio.sfxPlay('rewind'); await ui.fade(1, 600);
          const p = m33.root.position, yaw = m33.root.rotation.y; pl.place(p.x - Math.sin(yaw) * 3, 0.15, p.z - Math.cos(yaw) * 3, yaw);
          await ui.fade(0, 600); ui.toast('THE MEMORY FRAYS · STAY WITH HER', 2200);
        } finally { S.busy = false; }
      }
      const walkSeg = async (i) => { S.walking = true; m33.pose = null; await walkTo(m33, P3.path[i], 1.25); S.walking = false; hudSet(null); };
      // stop 0: the tram stop — the bike he never rode here
      act({ pos: [P3.bike[0], 1.0, P3.bike[2]], radius: 1.8, prompt: 'Ring the bell of a bike you never rode here', states: ['gap'], enabled: () => S.phase === 'stop0', onUse: () => side(async () => {
        S.main = true; cine(true); audio.sfxPlay('pickup'); await game.wait(0.3); audio.sfxPlay('pickup');
        await forceHolder('mira');
        await game.shot([P3.stop[0] - 3.2, 1.6, P3.stop[2] - 3.0], [m33.root.position.x, 1.5, m33.root.position.z], 1.2, { fov: 36 });
        m33.lookTarget = kai.head;
        await game.say('m20mira33', '...Kai?');
        await game.say('m20mira33', 'Twenty-three years and I still hear his bell in the rain.');
        m33.lookTarget = null;
        S.phase = 'walk1'; S.main = false; cine(false);
        game.checkpoint(4.6, 0.15, 26, PI);
        await walkSeg(0); m33.pose = 'sit'; S.phase = 'stop1';
        ui.subtitle('m20mira33', 'Two bowls, please. One\'s for my brother. Old habit.', 3200);
      }) });
      // stop 1: the noodle bar — the chair kept for him
      act({ pos: [P3.chair[0], 1.0, P3.chair[2]], radius: 1.7, prompt: 'Sit in the chair she keeps for you', states: ['gap'], enabled: () => S.phase === 'stop1', onUse: () => side(async () => {
        S.main = true; cine(true);
        pl.place(P3.chair[0] + 0.4, 0.15, P3.chair[2], -PI / 2); kai.pose = 'sit';
        await game.wait(0.6);
        await forceHolder('mira');
        W.bowl2.visible = true;
        await game.shot([-4.4, 1.5, 10.6], [-7.0, 1.0, 12.4], 1.4, { fov: 38 });
        m33.lookTarget = kai.head; m33.pose = 'work';
        await game.say('m20mira33', 'Funny. It feels like you\'re here tonight.');
        await game.say('kai', 'I am. Mira, I\'m right here.');
        await game.say('m20mira33', 'Eat, then. It\'s getting cold.');
        await game.say('kai', 'She reached across the counter. To an empty chair. Every night for fourteen years.');
        fragment('III', 'hand');
        m33.lookTarget = null; m33.pose = null; kai.pose = null;
        S.phase = 'walk2'; S.main = false; cine(false);
        game.checkpoint(-4.4, 0.15, 8, PI);
        await walkSeg(1); m33.pose = 'sit'; S.phase = 'stop2';
        audio.sfxPlay('motif');
        ui.subtitle('m20mira33', 'Mm-mm-mmm...', 2400);
      }) });
      // stop 2: the bench on Calder Row — the flat stone
      act({ pos: [P3.bench[0], 1.0, P3.bench[2]], radius: 1.9, prompt: G.pebbleKept ? 'Leave the flat stone from Calder Row on the bench' : 'Leave a flat stone on the bench', states: ['gap'], enabled: () => S.phase === 'stop2', onUse: () => side(async () => {
        S.main = true; cine(true); audio.sfxPlay('pickup');
        W.stone.visible = true; W.stone.material.emissiveIntensity = 1.2;
        await game.wait(0.5); await forceHolder('mira'); W.stone.material.emissiveIntensity = 0.0;
        await game.shot([P3.bench[0] - 2.4, 1.3, P3.bench[2] - 1.4], [P3.bench[0], 0.8, P3.bench[2] - 0.4], 1.4, { fov: 36 });
        m33.pose = 'work';
        await game.say('m20mira33', 'Where did you come from?');
        await game.say('m20mira33', 'Splashes, not sinking.');
        audio.sfxPlay('motif');
        await game.say('m20mira33', 'Who taught who, Kai? I can\'t remember anymore. I remember both.');
        await game.shot([P3.bench[0] - 1.0, 1.2, P3.bench[2] + 1.6], [P3.bench[0] + 0.3, 0.86, P3.bench[2]], 1.2, { fov: 32 });
        await game.say('kai', 'My name on a bench. Twenty nineteen to twenty twenty-six. She hums our tune to a plaque.');
        ev('The bench on Calder Row', 'World 0907: a memorial bench at the corner of Calder Row. "KAI VAREN · 2019 – 2026 · Count the splashes, not the sinking." Mira sits here most nights and hums three notes.', 'Memory · III · World 0907');
        fragment('III', 'tune');
        m33.pose = null; W.stone.visible = false;
        S.phase = 'walk3'; S.main = false; cine(false);
        game.checkpoint(6.4, 0.15, -16, PI);
        await walkSeg(2); m33.pose = 'work'; S.phase = 'door';
        m33.root.position.set(...P3.path[2][P3.path[2].length - 1]); m33.root.rotation.y = PI;
      }) });
      // stop 3: the Helix doors; in the gap his badge still works
      const gapDoor = game.collision.add([-2.0, 0, -40.4], [2.0, 3.2, -40.0], { states: ['gap'] });
      act({ pos: [P3.reader[0], 1.3, P3.reader[2] + 0.4], radius: 1.7, prompt: 'Badge in · K. VAREN', states: ['gap'], enabled: () => S.phase === 'door' && gapDoor.enabled, onUse: () => side(async () => {
        audio.sfxPlay('door');
        await game.say('m20band', 'Band recognised. Operator: K. Varen. Welcome, Doctor Varen.');
        await game.say('kai', 'In a world that never had me, my badge still opens her door.');
        gapDoor.enabled = false; W.reader.material.emissiveIntensity = 3;
        game.checkpoint(0, 0.15, -43, PI);
        S.phase = 'lab'; refresh();
      }) });
      act({ pos: [P3.console[0] - 0.2, 1.2, P3.console[2] + 0.8], radius: 1.8, prompt: 'Her console', states: ['mira'], enabled: () => S.phase === 'lab' && !G.frags.III.machine, onUse: () => side(async () => {
        await closeUp([-4.8, 1.5, -53.95], [['kai', 'Operator: M. Varen. Run zero nine oh seven. Target: Varen, Kai, age seven. Last signature eight-fourteen and nine seconds.'], ['kai', 'She built it. In this world, she\'s the one who built the machine.']], 1.0, 36);
        ev('Recovery protocol · RUN 0907', 'HELIX RECOVERY PROTOCOL · OPERATOR: M. VAREN · RUN 0907 · 14.11.2049 23:40 · TARGET: VAREN, KAI (7) · LAST SIGNATURE 19.10.2026 08:14:09 · ARMED.', 'Memory · III · World 0907');
        fragment('III', 'machine');
      }) });
      P3.pages.forEach((p, i) => act({ pos: [p[0], 1.2, p[2]], radius: 1.5, prompt: 'A page of her notebook', states: ['mira'], enabled: () => !G.pages.has(i), onUse: () => side(async () => {
        G.pages.add(i); audio.sfxPlay('pickup');
        await game.say('kai', ['"Day one. Mum says it took him at nine seconds past. I was holding his hand. Then I wasn\'t."', '"Day four thousand and eighteen. I remember a brother who taught me to skip stones. Mum says I taught him. I remember both."', '"Tonight. If I bring him back, which one comes? The one I remember, or the one who was?"'][i]);
        ev('Her notebook · ' + ['Day 1', 'Day 4,018', 'Tonight'][i], ['Mira, World 0907: "Mum says it took him at nine seconds past. I was holding his hand. Then I wasn\'t."', 'Mira, World 0907: "I remember a brother who taught me to skip stones. Mum says I taught him. I remember both."', 'Mira, World 0907: "If I bring him back, which one comes? The one I remember, or the one who was?"'][i], 'Memory · III · World 0907');
      }) }));
      act({ pos: [-6.6, 1.4, -39.4], radius: 1.6, prompt: 'A lecture poster', states: ['mira'], enabled: () => !G.poster, onUse: () => side(async () => { G.poster = true; await game.say('kai', 'Doctor Mira Varen. "What we owe the people we lost." She gives lectures about grief. Full halls.'); ev('A lecture poster', 'World 0907: HELIX PUBLIC LECTURE · DR. MIRA VAREN · "What we owe the people we lost".', 'Memory · III · World 0907'); }) });
      act({ pos: [-7.8, 1.4, -22], radius: 2.2, prompt: 'A window that would have been yours', states: ['gap'], enabled: () => !G.window, onUse: () => side(async () => { G.window = true; await game.say('kai', 'Third floor. The flat I\'d have rented. In the gap there\'s a light on and a green pen on the sill.'); await game.say('kai', 'A resignation I\'d never have written. Nobody to write it.'); }) });
      act({ pos: [jun.root.position.x, 1.4, jun.root.position.z], radius: 2.0, prompt: 'Jun Park', states: ['mira'], enabled: () => !G.jun && S.phase !== 'intro', onUse: () => side(async () => {
        G.jun = true; F.m20jun = true; jun.lookTarget = m33.head;
        await game.say('jun', 'Evening, Doctor Varen. Line three\'s flooded again. N4\'s at eleven fifty-two.');
        await game.say('kai', metJun ? 'Jun. It\'s me. Kai. Central Station, the train...' : 'Jun Park. Transit. He talks to her like an old friend.');
        await game.say('kai', metJun ? 'He can\'t hear me. In this world we never met.' : 'He doesn\'t see me. Nobody here does.');
        jun.lookTarget = null;
      }) });
      W.shards.forEach((m, i) => shard(i ? 'World 0907, her lab' : 'World 0907, the gap', m, [i ? 'mira' : 'gap']));
      // the ring: step into it before she runs it
      act({ pos: [P3.ringPad[0], 1.0, P3.ringPad[2]], radius: 2.0, prompt: 'Step into the ring', enabled: () => S.phase === 'lab' && G.frags.III.machine, onUse: () => side(ending907) });
      async function ending907() {
        S.main = true; cine(true); S.phase = 'end907';
        await forceHolder('mira'); lockMusic('m20-singing', 0.8);
        pl.place(0, 0.6, -60.6, 0); kai.root.rotation.y = 0;
        m33.root.position.set(-4.6, 0.15, -52.0); m33.root.rotation.y = PI * 0.85;
        await game.shot([-6.4, 1.8, -50.4], [-4.6, 1.4, -53.0], 1.2, { fov: 38 });
        await game.say('m20mira33', 'Run zero nine oh seven. Target: Varen, Kai. Eight-fourteen and nine seconds.');
        audio.sfxPlay('boom'); game.shake = 0.05; W.ringL.userData.disc.material.uniforms.uPower.value = 1.1;
        await game.shot([3.0, 1.7, -55.4], [-0.4, 1.5, -60.2], 1.4, { fov: 42 });
        m33.lookTarget = kai.head; m33.root.rotation.y = PI;
        const step = walkTo(m33, [[-1.6, 0.15, -57.0]], 0.7);
        await game.say('m20mira33', '...Kai? You\'re... older.');
        await game.say('kai', 'Mira.');
        await step; m33.pose = 'work';
        await game.say('m20mira33', 'You came back. I knew if I built it right you\'d...');
        await game.shot([1.4, 1.5, -57.8], [-0.8, 1.4, -58.6], 1.2, { fov: 34 });
        audio.silence?.(2.0);
        await ui.fade(1, 1800);
        await game.say('m20band', 'World zero nine oh seven: discarded. Fifteenth of November, twenty forty-nine, oh-oh-oh-one.');
        audio.unsilence?.();
        m33.root.visible = false; holderVis(m33, 'none'); for (const w of crowd) w.c.root.visible = false;
        mira = await actor('mira', 2.0, 0.15, -56.4, -PI * 0.7);
        W.ringL.userData.disc.material.uniforms.uPower.value = 0.25;
        pl.place(0.6, 0.15, -57.6, PI * 0.25);
        await ui.fade(0, 1600);
        await convo(mira, [
          ['mira', 'He erased it at one minute past midnight.'],
          ['mira', 'A world where you vanished has no Witness in it, Kai. Nobody to come back and try again. It couldn\'t hold itself up.'],
          ['kai', 'You remember it.'],
          ['mira', 'All of it. The lectures. The bowls. Fourteen years of building the thing that took you.'],
          ['kai', 'In that world, it took me.'],
          ['mira', 'And I stayed. In the other one, it took me, and you stayed. You see why I can\'t pick.'],
        ]);
        fragment('III', 'ending');
        contradiction('gone', 'Who was taken', ['Test Hall Zero: "Mira was taken; Kai stayed."', 'World 0907: "Kai was taken; Mira stayed."']);
        G.done.III = true; F.m20world0907 = true; F.m20frays = G.frays;
        musicLock = null; S.phase = 'exit'; S.main = false; cine(false);
        game.checkpoint(0, 0.15, -46, 0); refresh();
      }
      act({ pos: [0, 1.2, -42.6], radius: 2.6, prompt: 'Go back to the Threshold', enabled: () => S.phase === 'exit', onUse: () => { S.leave = true; } });
      hint(() => S.phase === 'stop0', 40, () => ui.subtitle('kai', T.current === 'gap' ? 'Something of mine at the stop. Something she\'d hear.' : 'She can\'t see me. Look at it the other way: two.', 2800));
      hint(() => S.phase === 'stop1', 40, () => ui.subtitle('kai', T.current === 'gap' ? 'The chair next to hers.' : 'Two bowls. One chair empty. In the gap.', 2600));
      hint(() => S.phase === 'stop2', 40, () => ui.subtitle('kai', T.current === 'gap' ? 'The bench. The stone in my pocket.' : 'In the gap. Leave her something only I could.', 2600));
      hint(() => S.phase === 'door', 35, () => ui.subtitle('kai', T.current === 'gap' ? 'The reader, right of the door.' : 'The doors are locked for me. In the gap my badge still works.', 2800));
      hint(() => S.phase === 'lab', 50, () => ui.subtitle('kai', !G.frags.III.machine ? 'Her console. In her version.' : 'The ring. Stand in it before she runs it.', 2600));
      S.refresh = () => {
        if (S.main) return;
        const o = { stop0: 'She can\'t see you. In the gap (2), find something of yours at the tram stop she could hear', walk1: 'Follow her through the rain', stop1: 'At the noodle bar: in the gap (2), sit in the chair she keeps for you', walk2: 'Follow her through the rain', stop2: 'Calder Row: in the gap (2), leave her something on the bench', walk3: 'Follow her to Helix', door: 'Get into her lab: in the gap (2) your own badge still works', lab: G.frags.III.machine ? 'Step into the ring before she runs it (optional: her notebook, 3 pages)' : 'Read her console (1) · then step into the ring', exit: 'Go back to the Threshold: the lab doors' }[S.phase];
        if (o) objective(o);
      };
      // intro
      S.main = true; cine(true);
      pl.place(...P3.start); T.unlocked = true; T.refreshHud();
      await game.shot([-6, 9, 46], [2, 2, 20], 0.01, { fov: 52 });
      await ui.fade(0, 1400);
      const card = chapterTitle('III', 'World 0907', 'Rain City · 14 November 2049 · a world without Kai');
      await game.shot([-3, 5, 42], [4, 1.6, 26], 4.6, { fov: 48 });
      await card;
      await game.say('m20band', 'World zero nine oh seven. Fourteenth of November, twenty forty-nine. Local signature: Varen, Mira. Varen, Kai: none.');
      await game.say('kai', 'None.');
      await game.say('mira', 'This one\'s mine alone. You weren\'t in it. Walk with me anyway.');
      await game.shot([P3.stop[0] - 3.4, 1.7, P3.stop[2] + 3.8], [m33.root.position.x, 1.5, m33.root.position.z], 1.6, { fov: 38 });
      await game.say('m20tram', 'Line three, Calder Row: suspended due to flooding. Night bus N4 at twenty-three fifty-two.');
      await game.say('m20mira33', 'Of course it is.');
      await game.say('kai', 'Thirty-three. Helix lanyard. She lived.');
      S.main = false; cine(false);
      S.phase = 'stop0'; game.checkpoint(...P3.start); refresh();
      ui.toast('WORLD 0907 · 1 AS SHE LIVED IT · 2 THE SHAPE KAI LEFT', 3600);
      await game.waitFor(() => S.leave && !S.busy);
      game.engine.fx?.uTint?.value?.set(1, 1, 1); hudSet(null);
      await ui.fade(1, 900);
      return threshold(async () => {
        pl.place(P0.doors[2][0] * 0.7, 0, P0.doors[2][2] * 0.7 + 1, -PI * 0.7);
        await ui.fade(0, 900);
        await placeStrand('III', 2);
        await game.shot([0, 8.5, 9.5], [0, 0, 0], 1.6, { fov: 48 });
        await convo(mira, [['mira', 'Three of me. Now the Loom will want them to agree.'], ['kai', 'They can\'t.'], ['mira', 'Find what they share. Leave the rest alone. Can you do that? It\'s not your strength.']]);
        S.phase = 'loom'; cine(false); game.checkpoint(0, 0, 9.6, PI); refresh();
      });
    }

    // =================================================================================================================
    // THE REVEAL — the Loom sealed, the endings left open
    // =================================================================================================================
    async function reveal() {
      S.main = true; cine(true); lockMusic('m20-reveal', 2.0);
      mira.root.position.set(1.4, 0, 2.6); mira.root.rotation.y = -PI * 0.7; pl.place(-0.8, 0, 3.6, PI * 0.6);
      await game.shot([0, 6.5, 8], [0, 0.6, 0], 2.0, { fov: 46 });
      audio.sfxPlay('success');
      await tween(2.4, k => { W.rings.forEach((g, i) => { g.position.y = Math.sin(k * PI) * 0.25 * (i + 1); }); W.clockFace.material.emissiveIntensity = 0.18 + k * 1.2; });
      mira.setGadget?.('chronolith_cuff_thin', true); mira.setGadget?.('gorget_resonance', 2.4);
      await game.shot([mira.root.position.x - 1.2, 1.2, mira.root.position.z + 0.9], [mira.root.position.x + 0.2, 1.0, mira.root.position.z], 1.4, { fov: 30 });
      await game.say('kai', 'Your cuff. It\'s never been lit.');
      await convo(mira, [
        ['mira', 'Now you\'ve seen them. A girl who hid under the stairs. A girl who let go. A woman who built a machine to find you.'],
        ['kai', 'Which one are you?'],
        ['mira', `All of them. ${pattern} percent of the girl who died at Site Zero.`],
        ['mira', 'The rest is stitched from every world he made where I lived a little longer.'],
        ...(sawPhoto ? [['mira', 'I remember being fifty-eight on the Haldane sea wall. I remember how cold the stone was.']] : []),
        ...(heardReel ? [['mira', 'I remember a summer recording. "If you find this when you\'re old, I hope you\'re happy." I meant it every time.']] : []),
      ]);
      await game.say('m20band', `Pattern analysis: Varen, Mira. Sources: ${iters === 1046 ? 'one thousand and forty-six' : iters}. Coherent: one.`);
      await convo(mira, [
        ['kai', 'You\'re not her. Not only her.'],
        ['mira', 'I remember being your sister.'],
        ['kai', 'That\'s not the same thing.'],
        ['mira', 'Would it be enough if I said it was?'],
      ]);
      F.m20quote = true;
      audio.silence?.(1.4); await game.wait(1.0); audio.unsilence?.();
      const a = await choose('kai', 'Would it be enough?', ['"It\'s enough."', '"I don\'t know yet."', '(Say nothing. Offer her your hand.)'], 1);
      G.answer = ['enough', 'unsure', 'hand'][a];
      if (a === 0) await convo(mira, [['kai', 'It\'s enough.'], ['mira', 'Liar. A kind one. I\'ll take it.']]);
      else if (a === 1) await convo(mira, [['kai', 'I don\'t know yet.'], ['mira', 'Good. That\'s the first honest thing anyone has said to me in a thousand worlds.']]);
      else { await game.say('kai', '...'); await convo(mira, [['mira', 'Not the hand. Not yet. Ask me what I want.'], ['kai', 'What do you want?'], ['mira', 'To be the one who decides what I am.']]); }
      await game.shot([0, 3.2, 9.6], [0, 1.2, -4], 2.0, { fov: 46 });
      audio.sfxPlay('anomaly'); game.shake = 0.04;
      await game.say('mira', 'He\'s getting ready to run it again. Can you feel it? The Continuum wants one world. He wants one me.');
      await game.say('mira', 'Go, Kai. And this time don\'t come to save me. Come to ask.');
      await game.say('m20band', 'Correction to the record. Varen, Mira: reconstructed consciousness. Lives remembered: more than one.');
      await game.say('kai', 'More than one.');
      // flags
      F.m20done = true; F.miraReconstructed = true; F.miraLives = ['0001', '0207', '0412', '0907'].filter(x => x !== '0412' || sawPhoto); F.m20answer = G.answer; F.m20forced = G.forced; F.m20aligned = true;
      F.m20contradictions = G.contra.size; F.m20fragments = ['I', 'II', 'III'].reduce((n, s) => n + Object.keys(G.frags[s]).length, 0); F.m20shards = G.shards; F.m20found = G.found;
      F.m20skips = G.skips; F.m20loomMoves = G.loomMoves; F.m20talks = G.talks.size; F.m20pages = G.pages.size; F.m20evidence = G.ev.size; F.miraCuffLit = true;
      await game.shot([8, 5.5, 8], [0, 1, 0], 5.0, { fov: 50 });
      await ui.fade(1, 2600);
      const mins = Math.round((game.time - tStart) / 60);
      await ui.chapterCard('MISSION 20 COMPLETE', 'Mira\'s Memory', `Memories 3/3 · Contradictions kept ${G.contra.size} · Fragments ${F.m20fragments}/12 · Shards ${G.shards}/8${mins ? ' · ' + mins + ' min' : ''}`, 4200);
      hud.remove(); mem?.dispose(); kai.lookTarget = null; kai.pose = null;
      game.releaseCam(); ui.letterbox(false); audio.allBeds?.(0); audio.setTheme(null);
      window.__m20 = null;
    }

    // =================================================================================================================
    // RUN
    // =================================================================================================================
    if (startPart >= 2) { G.doorsOpen = Math.min(3, startPart - 1); for (const st of ['I', 'II', 'III'].slice(0, startPart - 2)) { G.done[st] = true; G.placed[st] = true; ANCH.forEach(a => { G.frags[st][a] = true; }); } if (startPart >= 3) G.pebbleKept = true; }
    if (startPart === 5) { G.doorsOpen = 3; }
    await ui.fade(1, 10);
    await threshold(startPart === 1 ? async () => {
      S.main = true; cine(true);
      pl.place(...P0.start); kai.root.rotation.y = PI;
      await game.shot([18, 14, 26], [0, 1, 0], 0.01, { fov: 50 });
      await ui.fade(0, 2000);
      lockMusic('m20-threshold', 1.0);
      const card = ui.chapterCard('ACT IV · THE UNWRITTEN SECOND', 'Mira\'s Memory', 'Memories that contradict', 4400);
      await game.shot([12, 7, 16], [0, 1.2, 0], 6.4, { fov: 48 });
      await card;
      await game.shot([-1.2, 1.8, 14.4], [P0.mira[0], 1.5, P0.mira[2]], 1.6, { fov: 40 });
      await convo(mira, [
        ['mira', 'You came after me.'],
        ['kai', 'You said I\'d been trying to reach the version of you that would forgive me.'],
        ['mira', ({ ask: 'And you said you were asking now. Did you mean it?', live: 'And you said you only wanted me to live. Will you try to understand me as well?', sorry: 'And you said you were sorry. I would rather you understood. Will you try?' })[F.m19miraAnswer] || 'And you said you wanted to understand me instead. Did you mean it?'],
        ['kai', 'Yes.'],
        ['mira', 'Then come and see what I\'m made of.'],
      ]);
      await game.shot([0, 3.0, 10], [0, 2, -12], 2.0, { fov: 54 });
      await game.say('mira', 'Three doors. Three mornings I keep. They don\'t agree with each other.');
      await game.shot([3.2, 2.0, 4.2], [0, 0.4, 0], 1.6, { fov: 44 });
      await game.say('kai', 'And this?');
      await game.say('mira', 'The Loom. When you\'ve seen all three, it\'ll want you to weave them into one story. That\'s the trap.');
      await game.say('m20band', 'Local signature: none. Era: none. Rememberers in range: two. Switching follows whose memory you stand in.');
      await game.say('mira', 'Mind the edges. I don\'t remember everything. Nobody does.');
      musicLock = null; S.main = false; cine(false);
      game.checkpoint(...P0.start); refresh();
    } : async () => {
      pl.place(0, 0, 8, PI); await ui.fade(0, 600);
      if (startPart === 5) { G.placed.I = G.placed.II = G.placed.III = true; ['I', 'II', 'III'].forEach(st => ANCH.forEach(a => { G.frags[st][a] = true; })); G.done.III = true; W.place(); W.spokes(); S.phase = 'loom'; }
      refresh();
    });
    // the hub loop: doors lead into memories; the Loom leads to the reveal
    for (;;) {
      await game.waitFor(() => S.next || S.phase === 'reveal');
      if (S.phase === 'reveal') break;
      const go = S.next; S.next = null;
      await go();
    }
    await reveal();
    void near;
  },
};
