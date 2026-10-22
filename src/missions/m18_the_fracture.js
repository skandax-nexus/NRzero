// MISSION 18 · THE FRACTURE (Act III) — combine traversal, survival and cross-era consequences.
// Bible: "Temporal storms appear around the planet and the landscape changes across the three main states."
// Playable sequence (each a chapter with its own map, built when Kai gets there):
//   I   Evacuate a settlement before its anchor fails ......... Lantern Hall, 2196 (the M14 settlement)
//   II  Cross a canyon that exists only in the past ........... Varrow Gorge, 2026 (filled and torn in 2049)
//   III Navigate a flooded highway in the present ............. the Eastway, 2049 (with the 2026 fill pit under it)
//   IV  Traverse a collapsing future skyscraper ............... the Corran Building, 2196 (2049 holds 12 s at a time)
//   V   Defend a stabilizer while Sera repairs the Chronolith . Helix Test Hall C, 2196 / 2049
//   VI  Reach a planetary transmission tower .................. the Helix Long Array, Halcyon Hill, 2196 / 2049
// Quote: "I remember the first world." / "Which one?" / "The one before you tried to save me."
// Ending: Mira's message points Kai toward the Unwritten Second.
// Optional: Ruth and her husband at the wall of names, Joss's beacon log, the Varen carving in the gorge (a residue
// memory), the site whiteboard, Jun Park's bus (and its seven passengers), the Corran manifest, the Test Hall C run
// sheet, the Array plaque, the Witness's echo on the crown, six temporal shards (one per place).
// Test hooks: window.__m18; ?m18part=1..6 starts at a chapter (development only).
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { Combat, combatState } from '../systems/combat.js';
import { EchoStep } from '../systems/echostep.js';
import { buildReach, registerM14Cast } from '../world/env_m14.js';
import { registerM10Cast, TROOPER, TROOPER_F } from '../world/env_m10.js';
import {
  registerM18Cast, registerM18Themes, musicState, P1, P2, P3, P4, P5, P6, SURV, KID96, PASSENGERS, NOTE_NAMES, NOTE_MIDI, HORN_OK,
  dressHall, buildGorge, buildEastway, buildTower, buildHallC, buildArray, roadY, disposeGroup, shardMesh,
} from '../world/env_m18.js';
import { Rain } from '../world/kit.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const GHOST_KID = 0xffd8a0, GHOST_MIRA = 0x9a7bff, GHOST_WIT = 0xff6a4a;
const FALL = 7.2;          // metres: a longer fall than this is a failure (checkpoint)

export default {
  id: 'm18', act: 'ACT III · THE LAST VERSION OF EARTH', title: 'The Fracture', sub: 'A collapsing world',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM14Cast(); registerM10Cast(); registerM18Cast(); registerM18Themes();
    const kai = pl.char;
    const metSera = !!(F.metSera || F.m10metSera || F.m14metSera || F.m13done);
    const trust = F.seraTrust ?? 0, haleSide = F.trustedHale !== false, radioId = haleSide ? 'hale' : 'brandt';
    const pattern = F.miraPattern || 61;
    const startPart = Math.max(1, Math.min(6, +(new URLSearchParams(location.search).get('m18part') || 1)));
    const portraits = (ids) => { try { const need = ids.filter(id => !ui.portraits[id] && CAST[id]?.look); if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]])))); } catch (err) { console.warn('m18 portraits', err); } };

    // ---------- mission-wide state ----------
    const G = { shards: 0, shardList: [], ev: new Set(), ch: 0, out: 0, jossChoice: null, elders: null, carving: false, jun: false, passengers: 0, collapses: 0, surges: 0, swept: 0,
      memo: false, runFalls: 0, waves: 0, integMin: 1, ally: null, tune: 0, witnessEcho: false, witnessGlimpse: false, heart: false, collar: false, plaque: false, log49: false, board: false, josslog: false, whiteboard: false };
    let S = {}, W = null, prevRoot = [];
    window.__m18 = { G, get S() { return S; }, get W() { return W; }, P1, P2, P3, P4, P5, P6 };

    // ---------- helpers (per chapter they read S) ----------
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag) => { if (G.ev.has(title)) return; G.ev.add(title); ui.addEvidence(title, text, tag); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const choose = (id, text, opts, correct = 0) => { if (game.autoplay) game.autoChoice = game.autoQueue?.length ? game.autoQueue.shift() : correct; return game.choice(id, text, opts); };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive || S.busy) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u), u); if (u >= 1) { off(); res(); } }); });
    const side = async (fn) => {
      if (S.busy || !game.control || game._failing) return; S.busy = true;
      try { await fn(); } catch (err) { if (err?.name === 'Abort' || String(err).includes('Abort')) throw err; console.warn('m18 side', err); } finally { S.busy = false; if (!S.main) { game.control = true; ui.letterbox(false); game.releaseCam(); } refresh(); }
    };
    const act = (o) => {
      const it = game.interact({ radius: 1.8, ...o, once: false, onUse: (x) => { if (S.busy || game._failing) return; if (o.enabled && !o.enabled()) return; if (o.states && !o.states.includes(T.current)) return; o.onUse(x); } });
      it.done = () => game.removeInteract(it);
      return it;
    };
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
    const convo = async (other, lines) => {
      if (other) {
        const o = other.root.position, dx = pl.pos.x - o.x, dz = pl.pos.z - o.z, d = Math.hypot(dx, dz);
        if (d < 1.4 && d > 0.01 && Math.abs(pl.pos.y - o.y) < 0.5) pl.place(o.x + dx / d * 1.6, pl.pos.y, o.z + dz / d * 1.6, pl.yaw);
        faceEach(kai, other);
      }
      for (const [id, line] of lines) {
        const sp = id === 'kai' ? kai : (other && CAST[id] && !CAST[id].voice ? (S.byId[id] || null) : null);
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
        const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st; p.y += (t[1] - p.y) * Math.min(1, dt * 5);
        let dy = Math.atan2(dx, dz) - ch.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.root.rotation.y += dy * Math.min(1, dt * 8); ch.speed = speed;
      });
    });
    const closeUp = async (p, lines, dist = 1.1, fov = 34) => {
      const dx = pl.pos.x - p[0], dz = pl.pos.z - p[2], d = Math.hypot(dx, dz) || 1;
      await game.shot([p[0] + dx / d * dist, p[1] + 0.7, p[2] + dz / d * dist], [p[0], p[1], p[2]], 1.0, { fov });
      for (const [id, line] of lines) await game.say(id, line);
    };
    // a temporal shard: an existing mesh, or a position (a new mesh is made); states limit where it can be seen and taken
    const shard = (where, meshOrPos, states) => {
      let mesh = meshOrPos;
      if (Array.isArray(meshOrPos)) { mesh = shardMesh(); mesh.position.set(...meshOrPos); game.scene.add(mesh); if (states) T.only(mesh, ...states); game.onUpdate((dt, t) => { mesh.rotation.y = t * 1.5; }); }
      return act({ pos: [mesh.position.x, mesh.position.y + 0.2, mesh.position.z], radius: 1.6, prompt: 'Take the temporal shard', states, enabled: () => !mesh.userData.taken && (!states || states.includes(T.current)), onUse: () => {
        mesh.userData.taken = true; mesh.visible = false; T.objects = T.objects.filter(o => o !== mesh); G.shards++; G.shardList.push(where); F.shards = (F.shards || 0) + 1; audio.sfxPlay('pickup');
        ui.toast(`TEMPORAL SHARD ${G.shards}/7 · ${where.toUpperCase()}`, 2400);
      } });
    };

    // ---------- HUD (anchor, surge, hold, integrity, repair, gust) ----------
    const hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;right:calc(22px + var(--sr,0px));top:calc(120px + var(--st,0px));padding:8px 12px;border-radius:6px;background:rgba(10,8,14,.55);border:1px solid rgba(190,170,255,.35);color:#e6dcff;font:600 12px/1.45 var(--ui,system-ui);letter-spacing:.16em;pointer-events:none;opacity:0;transition:opacity .4s;text-align:right;min-width:160px;z-index:5';
    (document.getElementById('hud') || document.body).appendChild(hud);
    let hudKey = '';
    const hudSet = (rows) => {   // rows: [[label, frac|null, colour]]
      const show = rows && rows.length && !game.cine && !ui.dlgActive;
      hud.style.opacity = show ? 1 : 0; if (!show) return;
      const key = rows.map(r => r[0] + (r[1] == null ? '' : Math.round(r[1] * 50))).join('|'); if (key === hudKey) return; hudKey = key;
      hud.innerHTML = rows.map(([t, f, c]) => `<div>${t}</div>` + (f == null ? '' : `<div style="height:4px;margin:3px 0 6px;background:rgba(255,255,255,.12);border-radius:2px"><div style="height:4px;width:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%;background:${c || '#b6a0ff'};border-radius:2px"></div></div>`)).join('');
    };

    // ---------- places: one scene per chapter ----------
    let curTheme = null, musicLock = null, themeFor = () => null;
    const music = (fade = 1.6) => { const th = musicLock || themeFor(); if (!th) return; for (const d of T.defs) d.theme = th; if (th !== curTheme) { curTheme = th; audio.setTheme(th, fade); } };
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    async function newPlace(sceneOpts, defs, initial) {
      for (const g of prevRoot) disposeGroup(g); prevRoot = [];
      const scene = game.newScene({ residue: true, ...sceneOpts });
      RZ.init(renderer, { quality: game.engine.quality || 'medium' });
      game.onUpdate(dt => RZ.update(dt));
      T.configure(defs, initial); T.unlocked = false;
      delete T.canSwitch; curTheme = null; musicLock = null; hudKey = '';
      S = { seen: {}, obj: '', busy: false, main: false, phase: 'intro', actors: {}, byId: {} };
      kai.pose = null; kai.lookTarget = null; pl.crouching = false;
      let mT = 0; game.onUpdate(dt => { mT -= dt; if (mT <= 0) { mT = 0.5; musicState.threat = combatState.threat || 0; music(); } });
      await tick();
      return scene;
    }
    // light: a sky per state, one sun (the shadow caster), a hemisphere, three nearest practicals
    function rig(Wm, LOOK, skies) {
      const scene = game.scene, Q = RZ.getQuality(), low = Q === 'low', envs = {};
      for (const [e, o] of Object.entries(skies)) { try { envs[e] = RZ.skyEnvironment(renderer, scene, { ...o, apply: false }); } catch (err) { console.warn('m18 sky', err); } }
      const hemi = new THREE.HemisphereLight(0xb8c8d0, 0x2a2a2c, 0.5); scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.castShadow = true;
      sun.shadow.mapSize.set(Q === 'high' ? 2048 : low ? 512 : 1024, Q === 'high' ? 2048 : low ? 512 : 1024);
      Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 170 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
      scene.add(sun, sun.target);
      const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
      const sunDir = V(0.5, 0.6, 0.3).normalize();
      let lookKey = null, lightT = 0;
      const apply = () => {
        const e = T.current, L = LOOK[e] || Object.values(LOOK)[0]; lookKey = e;
        scene.fog.color.set(L.fog[0]); scene.fog.density = L.fog[1];
        const env = envs[e];
        if (env) { scene.environment = env.envMap; scene.environmentIntensity = L.env; scene.background = env.background || new THREE.Color(L.bg); } else scene.background = new THREE.Color(L.bg);
        hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
        sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; sunDir.set(...L.dir).normalize();
        renderer.toneMappingExposure = L.exp;
        const b = L.beds || {}; audio.rain(b.rain || 0); audio.wind(b.wind || 0); audio.hum(b.hum || 0, b.hz || 52); audio.water?.(b.water || 0); audio.crowd?.(b.crowd || 0);
        lightT = 0;
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
    // era switching: never into something solid or onto nothing; chapters add their own rules
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
    function eraRules(extra) {
      const baseCan = T.canSwitch.bind(T);
      T.canSwitch = (id) => {
        if (!baseCan(id)) return false;
        const why = extra ? extra(id) : null;
        if (why) { if (once('rule' + why + Math.floor(game.time / 4))) { ui.toast(why, 2200); audio.sfxPlay('fail'); } return false; }
        const s = solidAt(id);
        if (s) { if (once('solid' + id + Math.floor(game.time / 3))) { ui.toast(s === 'solid' ? `SOLID HERE IN ${id} · MOVE TO OPEN GROUND` : `NOTHING TO STAND ON HERE IN ${id}`, 1900); audio.sfxPlay('fail'); } return false; }
        return true;
      };
    }
    // falls longer than FALL fail; storm cells throw Kai a few seconds back along his own path
    function fallRule(limit = FALL, msg = 'THE FALL WAS TOO FAR') {
      let top = null, settle = 0;
      game.onUpdate(dt => {
        if (!game.control || game._failing || game.cine) { top = null; settle = 0.3; return; }
        if (settle > 0) { settle -= dt; top = null; return; }
        if (!pl.grounded) top = Math.max(top ?? pl.pos.y, pl.pos.y);
        else { if (top != null && top - pl.pos.y > limit) { top = null; game.fail(msg); return; } top = null; }
      });
    }
    function rewindRule(cells) {
      const hist = []; let ht = 0, cool = 0;
      game.onUpdate(dt => {
        cells.update(game.time);
        if (!game.control || game._failing) return;
        ht -= dt; cool -= dt;
        if (ht <= 0 && pl.grounded) { ht = 0.25; hist.push([pl.pos.x, pl.pos.y, pl.pos.z, pl.yaw]); if (hist.length > 24) hist.shift(); }
        if (cool > 0) return;
        const c = cells.hit(pl.pos);
        if (c) {
          cool = 1.6; const back = hist.find(h => Math.hypot(h[0] - c.cx, h[2] - c.cz) > c.r + 1.2) || hist[0];
          if (back) pl.place(back[0], back[1] + 0.05, back[2], back[3]);
          T.stability = Math.max(0.05, T.stability - 0.2); audio.sfxPlay('rewind'); game.shake = 0.12; S.cellHits = (S.cellHits || 0) + 1;
          ui.toast('STORM CELL · THROWN BACK THREE SECONDS', 1800);
        }
      });
    }
    const chapterTitle = async (num, title, sub) => { await ui.chapterCard(`THE FRACTURE · ${num}`, title, sub, 3600); };

    // =================================================================================================================
    // I · LANTERN HALL — evacuate a settlement before its anchor fails
    // =================================================================================================================
    async function chapter1() {
      G.ch = 1; portraits(['sera', 'joss', 'wren', 'ama', 'm18teacher', 'm18lio', 'm18medic', 'm18tomas', 'm18ruth']);
      const D96 = { id: '2196', key: '3', name: 'FUTURE', year: 'LANTERN HALL · 2196', glyph: '◑', color: '#c8a0ff', theme: 'm18-storm', apply: () => {} };
      const scene = await newPlace({ background: 0x5a4a6a, fog: [0x6a5a76, 0.0095], exposure: 1.05, bloom: 0.5, bloomThreshold: 0.85, envIntensity: 0.8, killY: -12 }, [D96], '2196');
      const R = buildReach(game, scene); game.onUpdate((dt, t) => R.update(dt, t)); await tick();
      const H = dressHall(game, scene, T); game.onUpdate((dt, t) => H.update(dt, t)); await tick();
      W = { R, H, lightSrc: [...R.lightSrc, ...H.lightSrc] }; prevRoot.push(H.root);
      for (const z of R.zones) z.on = false;                                   // the storm has swallowed the Reach's zones
      R.gate.position.y = 4.6; R.gateBox.enabled = false;                      // the gate stands open: the convoy is going
      if (R.flow && F.m14garden) R.flow.visible = true;
      rig(W, { '2196': { fog: [0x6a5a76, 0.0095], env: 0.75, hemi: [0xd8b8ff, 0x2a2430, 0.5], sun: [0xffa070, 1.9], dir: [-0.6, 0.22, 0.5], exp: 1.06, bg: 0x6a5a76, beds: { wind: 0.16, hum: 0.02, hz: 44 } } },
        { '2196': { preset: 'sunset', elevation: 6, azimuth: 235, turbidity: 7, cover: 0.78 } });
      themeFor = () => (S.phase === 'escape' ? 'm18-storm' : S.phase === 'evac' ? (S.anchor < 0.35 ? 'm18-storm' : 'm18-hall') : 'm18-storm');
      fallRule(8);
      Object.assign(S, { anchor: 0.72, out: 21, groups: { beds: 'ask', school: 'ask', medic: 'ask', joss: 'ask', elders: 'ask' }, heart: false, escaped: false, gust: 18 });
      const TOTAL = 34;
      H.setTally(S.out);
      const front = () => -132 - 150 * S.anchor;
      game.onUpdate(() => { musicState.anchor = S.anchor; if (S.phase !== 'escape') H.setFront(front()); });

      // ---------- people ----------
      const A = S.actors;
      A.sera = game.actor('sera', null, ...P1.sera, PI * 0.9); A.wren = game.actor('wren', null, ...P1.wren, PI * 1.1);
      A.joss = game.actor('joss', null, ...P1.joss, -PI * 0.8); A.joss.pose = 'work';
      A.ama = game.actor('ama', null, ...P1.ama, PI); A.ama.pose = 'work';
      A.teacher = game.actor('m18teacher', null, ...P1.teacher, -PI / 2);
      A.lio = game.actor('m18lio', null, ...P1.lio, PI / 2); A.lio.crouch = 1; small.add(A.lio);
      A.medic = game.actor('m18medic', null, ...P1.medic, PI * 0.8); A.medic.pose = 'work';
      A.tomas = game.actor('m18tomas', null, ...P1.patient, PI * 0.6); A.tomas.pose = 'sit';
      A.ruth = game.actor('m18ruth', null, ...P1.elders[0], PI); A.ruth.pose = 'sad';
      Object.assign(S.byId, { sera: A.sera, wren: A.wren, joss: A.joss, ama: A.ama, m18teacher: A.teacher, m18lio: A.lio, m18medic: A.medic, m18tomas: A.tomas, m18ruth: A.ruth });
      await tick();
      const gard = P1.gard.map(([x, y, z], i) => { const c = game.ambient({ ...SURV[i * 2], seed: 1810 + i }, x, y, z, PI); c.pose = 'work'; return c; });
      const kids = P1.kids.map(([x, y, z], i) => { const c = game.ambient({ ...KID96[i], seed: 1820 + i }, x, y, z, -PI / 2); small.add(c); return c; });
      const husband = game.ambient({ ...SURV[2], seed: 1830, age: 77 }, ...P1.elders[1], PI); husband.pose = 'sad';
      // the people already on their way out when Kai arrives
      const leavers = [[-18, 1, -96], [-18, 1, -116], [18, 1, -104], [16, 1, -120], [-6, 0, -110], [8, 0, -94], [-24, 0, -88], [12, 0, -84]].map(([x, y, z], i) => game.ambient({ ...SURV[i % SURV.length], seed: 1840 + i }, x, y, z, 0));
      await tick();
      const exitPath = (from) => [...from, ...P1.out];
      const leave = async (chs, paths, n, speed = 1.5) => {
        await Promise.all(chs.map((c, i) => { c.pose = null; c.crouch = 0; return walkTo(c, paths[i] || paths[0], speed + (i % 2) * 0.12); }));
        for (const c of chs) c.root.visible = false;
        S.out += n; H.setTally(Math.min(TOTAL, S.out)); audio.sfxPlay('success'); refresh();
      };
      const leavePaths = (x, y, z) => (y > 0.5 ? (x < 0 ? [[x, 1, -86], [-18, 1, -85], [-18, 0, -82.2], [-4, 0, -80]] : [[x, 1, -86], [18, 1, -85], [18, 0, -82.2], [4, 0, -80]]) : [[x, 0, -88], [x > 0 ? 4 : -4, 0, -84], [x > 0 ? 3 : -3, 0, -80]]);
      leavers.forEach((c, i) => { const p = c.root.position; setTimeout(() => { walkTo(c, exitPath(leavePaths(p.x, p.y, p.z)), 1.6 + (i % 3) * 0.15).then(() => { c.root.visible = false; }).catch(() => {}); }, 400 + i * 900); });

      // ---------- the anchor ----------
      const anchorFail = () => { if (game._failing) return; game.fail('THE ANCHOR FAILED · THE STORM TOOK THE HALL'); };
      game.onUpdate(dt => {
        if (S.phase !== 'evac' || !game.control || S.busy || game._failing) return;
        S.anchor = Math.max(0, S.anchor - dt * (game.autoplay ? 0.0006 : 0.00105));
        if (S.anchor <= 0) anchorFail();
        S.gust -= dt; if (S.gust <= 0) { S.gust = 16 + Math.random() * 12; audio.sfxPlay('anomaly'); game.shake = 0.1; if (S.anchor < 0.4 && once('gustbark' + Math.floor(S.anchor * 10))) ui.subtitle('joss', 'Hear that? She\'s losing the north wall.', 2600); }
      });
      game.onUpdate(() => {
        if (S.phase === 'evac') hudSet([[`ANCHOR ${Math.round(S.anchor * 100)} %`, S.anchor, S.anchor < 0.3 ? '#ff8a7a' : '#b6a0ff'], [`OUT THROUGH THE GATE ${Math.min(TOTAL, S.out)}/${TOTAL}`, null]]);
        else if (S.phase === 'escape') hudSet([['STORM FRONT · RUN FOR THE GATE', Math.max(0, Math.min(1, (pl.pos.z - H.front) / 50)), '#ff8a7a']]);
        else hudSet(null);
      });
      const cpEvac = (x, y, z, yaw) => { const a = S.anchor; game.checkpoint(x, y, z, yaw, () => { S.anchor = Math.max(a, 0.3); }); };

      // ---------- objectives ----------
      const left = () => Object.entries(S.groups).filter(([k, v]) => k !== 'elders' && v !== 'out' && v !== 'stays').map(([k]) => k);
      function refresh1() {
        if (S.main || S.phase !== 'evac') return;
        const g = S.groups, parts = [];
        if (g.beds !== 'out') parts.push(g.beds === 'tin' ? 'bring Ama her seed tin (cistern platform)' : g.beds === 'go' ? 'the gardeners are leaving' : 'the gardeners in the track beds');
        if (g.school !== 'out') parts.push(g.school === 'search' ? 'find Lio (Residue Vision F shows his trail)' : g.school === 'go' ? 'the school is leaving' : 'the school on the east platform');
        if (g.medic !== 'out') parts.push(g.medic === 'escort' ? 'walk Nadia and Tomas to the gate (stay close)' : 'the medic on the west platform');
        if (g.joss !== 'out' && g.joss !== 'stays') parts.push(g.joss === 'shunt' ? `shunt the beacon cabinets (${S.shunts || 0}/2)` : 'Joss at the beacon');
        objective(parts.length ? 'Get everyone out before the anchor fails: ' + parts.join(' · ') : 'Everyone is out. Joss\'s last request: take the anchor\'s heart from the beacon');
      }
      refresh = refresh1;
      let oT = 0; game.onUpdate(dt => { oT -= dt; if (oT <= 0) { oT = 1; refresh(); } });

      // ---------- Sera and Wren at the gate ----------
      act({ pos: [P1.sera[0], 1.2, P1.sera[2]], prompt: 'Talk to Sera', enabled: () => S.phase === 'evac', onUse: () => side(async () => {
        S.main = true; cine(true);
        if (!S.seen.sera1) {
          S.seen.sera1 = true;
          await convo(A.sera, [['kai', 'How long has the sky been doing this?'], ['sera', 'Three days. Every settlement with a Helix anchor is losing it at once. Harrow Reach went dark this morning.'],
            ['kai', 'Three days. The Zero Second was eight days ago, my time.'], ['sera', 'Your time is not the problem. Everybody\'s time is coming loose.'],
            ['kai', 'Where does the convoy go?'], ['sera', 'Test Hall C, under the old Helix. When the sky does this, my people go there. The ring still holds it.']]);
        } else {
          await convo(A.sera, [['kai', 'Who\'s still inside?'], ['sera', left().length ? `${left().length === 1 ? 'One lot' : left().length + ' lots'}. Check the beds, the school, Nadia\'s corner and Joss. Joss will be last. He always is.` : 'Nobody who can still be asked. Get Joss\'s heart and run.']]);
        }
        S.main = false;
      }) });
      act({ pos: [P1.wren[0], 1.2, P1.wren[2]], prompt: 'Talk to Wren', enabled: () => S.phase === 'evac' && !S.seen.wren, onUse: () => side(async () => {
        S.seen.wren = true; S.main = true; cine(true);
        await convo(A.wren, [['wren', 'Dad won\'t come. You know that already.'], ['kai', 'Then I\'ll ask him in a way he can say yes to.'], ['wren', 'Ask him to save something. He can\'t say no to saving something.'],
          ['wren', 'And Ruth goes to the wall of names every evening. Out in the square. If she\'s there now, she\'ll stay till she\'s finished.']]);
        ev('Ruth at the wall of names', 'Wren: Ruth Abara reads her mother\'s name at the Memorial Square every evening and does not leave until she has finished.', 'Lantern Hall · 2196');
        S.main = false;
      }) });

      // ---------- the gardeners: Ama will not go without the seed stock ----------
      act({ pos: [P1.ama[0], 1.2, P1.ama[2]], prompt: 'Talk to Ama', enabled: () => S.phase === 'evac' && (S.groups.beds === 'ask' || (S.groups.beds === 'tin' && S.tin)), onUse: () => side(async () => {
        S.main = true; cine(true);
        if (S.groups.beds === 'ask') {
          await convo(A.ama, [['ama', 'Kai Varen. You brought the water back to these beds.'], ['kai', 'And now I\'m asking you to leave them. The anchor won\'t hold.'],
            ['ama', 'Beds are just wood and dirt. The seed stock is not. Thirty years of it, in a tin, on the cistern platform. My knees won\'t do those steps fast.'],
            ['kai', 'I\'ll get it. Start walking.'], ['ama', 'I\'ll start walking when I can hear the tin rattle.']]);
          S.groups.beds = 'tin';
        } else {
          await convo(A.ama, [['kai', 'Thirty years of seed. Rattling.'], ['ama', 'Then the garden comes with us. All right. Up, you two. We\'re going.']]);
          S.groups.beds = 'go'; S.main = false; cine(false);
          leave([A.ama, ...gard], [exitPath([[-4, 0, -92], [-4, 0, -82]]), exitPath([[2, 0, -92], [3, 0, -82]]), exitPath([[6, 0, -92], [4, 0, -82]])], 3).then(() => { S.groups.beds = 'out'; }).catch(() => {});
        }
        S.main = false;
      }) });
      act({ pos: [P1.tin[0], P1.tin[1] + 0.6, P1.tin[2]], radius: 1.6, prompt: 'Take Ama\'s seed tin', enabled: () => S.groups.beds === 'tin' && !S.tin, onUse: () => {
        S.tin = true; H.tin.visible = false; audio.sfxPlay('pickup'); ui.toast('SEED TIN · AMA OKONKWO\'S SEED STOCK', 2200); ui.subtitle('kai', 'Heavier than it looks. Thirty years usually are.', 2600); refresh();
      } });

      // ---------- the school: Lio is hiding ----------
      act({ pos: [P1.teacher[0], 2.2, P1.teacher[2]], prompt: 'Talk to Hedda', enabled: () => S.phase === 'evac' && S.groups.school === 'ask', onUse: () => side(async () => {
        S.main = true; cine(true);
        await convo(A.teacher, [['m18teacher', 'Eleven this morning. Ten now. Lio\'s gone. He hides when the sky goes purple.'], ['kai', 'Where does he hide?'],
          ['m18teacher', 'Somewhere small. His grandmother told him the storm only takes children who are outside.'], ['kai', 'Then he thinks he\'s doing the right thing.'],
          ['m18teacher', 'He always does. Find him and I\'ll walk them all out.']]);
        S.groups.school = 'search';
        ui.toast('RESIDUE VISION (F) SHOWS RECENT FOOTPRINTS', 2600);
        S.main = false;
      }) });
      // Lio's trail: small residue footprints from the slate to the market stall
      const printM = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
      const printG = new THREE.PlaneGeometry(0.16, 0.3);
      const trail = [[17.4, -97.4], [18.0, -99.2], [17.2, -100.8], [17.8, -102.6], [18.6, -104.4], [18.0, -106.2], [18.8, -108.0], [18.2, -109.8], [18.8, -111.6], [18.8, -112.8]];
      trail.forEach(([x, z], i) => { const m = new THREE.Mesh(printG, printM); m.rotation.x = -PI / 2; m.rotation.z = (i % 2 ? 0.2 : -0.2); m.position.set(x + (i % 2 ? 0.12 : -0.12), 1.02, z); scene.add(m); game.residue(m); });
      act({ pos: [P1.lio[0] - 0.6, 1.8, P1.lio[2]], radius: 2.0, prompt: 'Look under the tarp', enabled: () => S.groups.school === 'search', onUse: () => side(async () => {
        S.main = true; cine(true);
        await game.shot([P1.lio[0] - 2.4, 2.2, P1.lio[2] + 2.0], [P1.lio[0], 1.4, P1.lio[2]], 1.4, { fov: 38 });
        await game.say('m18lio', 'Go away. If you\'re outside it gets you.');
        const c = await choose('kai', 'Lio, under the stall', ['"Your gran was right. So we\'re going somewhere with a roof. A big one."', '"The storm doesn\'t care where you hide. Come on."'], 0);
        if (c === 0) { await game.say('kai', 'Your gran was right. So we\'re going somewhere with a roof. A big one. With a ring in it.'); await game.say('m18lio', '...A ring?'); await game.say('kai', 'Bigger than this stall. Come and see.'); }
        else { await game.say('kai', 'The storm doesn\'t care where you hide. Come on.'); await game.say('m18lio', 'You\'re not supposed to say that to kids.'); await game.say('kai', 'No. I\'m not. Sorry. Come on anyway.'); }
        A.lio.crouch = 0; G.lio = c === 0 ? 'roof' : 'blunt';
        S.groups.school = 'go'; S.main = false; cine(false);
        walkTo(A.lio, [[18.4, 1, -110], [18.4, 1, -104], [17.2, 1, -97]], 2.0).then(() => leave([A.teacher, A.lio, ...kids], [16.4, 17, 17.6, 16, 18.4].map(x => exitPath([[x, 1, -86], [x > 17 ? 18 : 17, 1, -85], [17.5, 0, -82.2], [4, 0, -80]])), 5, 1.4)).then(() => { S.groups.school = 'out'; }).catch(() => {});
      }) });

      // ---------- the medic: walk them out ----------
      const escortPath = [[-17.2, 1, -100], [-17.4, 1, -88], [-17.6, 1, -85.2], [-17.6, 0, -82.4], [-6, 0, -80.4], [-1.5, 0, -78], [-1, 0, -70], [0, 0, -58]];
      act({ pos: [P1.medic[0], 2.2, P1.medic[2]], prompt: 'Talk to Nadia', enabled: () => S.phase === 'evac' && S.groups.medic === 'ask', onUse: () => side(async () => {
        S.main = true; cine(true);
        await convo(A.medic, [['m18medic', 'Tomas broke his leg on the Line 4 beam. He can walk if somebody takes his other side, and he won\'t let me.'],
          ['m18tomas', 'You\'ve got a hall to empty, Nadia. Leave me the rest of the painkillers and a good view.'], ['kai', 'You can have a good view from the convoy.'],
          ['m18tomas', 'The man from the beam. You owe me, you know. That zone took my lamp.'], ['kai', 'Then take my shoulder instead.']]);
        S.groups.medic = 'lift'; S.main = false;
      }) });
      act({ pos: [P1.patient[0], 2.0, P1.patient[2]], prompt: 'Help Tomas up', hold: 0.8, enabled: () => S.groups.medic === 'lift', onUse: () => side(async () => {
        A.tomas.pose = null; A.medic.pose = null; S.groups.medic = 'escort'; S.esc = 0; audio.sfxPlay('metal');
        ui.subtitle('m18tomas', 'Ah. Ah. Fine. Slowly. If you leave me I\'m going to sit back down.', 3000);
        cpEvac(-16, 1, -104, PI);
      }) });
      // the escort moves only while Kai stays close
      game.onUpdate(dt => {
        if (S.groups.medic !== 'escort') return;
        const lead = A.tomas.root.position, d = Math.hypot(pl.pos.x - lead.x, pl.pos.z - lead.z), t = escortPath[S.esc];
        if (!t) { S.groups.medic = 'goneout'; A.tomas.root.visible = false; A.medic.root.visible = false; S.out += 2; H.setTally(S.out); audio.sfxPlay('success'); S.groups.medic = 'out'; refresh(); return; }
        if (d > 7.5) { A.tomas.speed = 0; A.medic.speed = 0; if (once('escwait' + S.esc)) ui.subtitle('m18medic', 'Kai! We can\'t go any faster on our own.', 2400); return; }
        for (const [ch, off] of [[A.tomas, 0], [A.medic, 0.8]]) {
          const p = ch.root.position, tx = t[0] + off, dx = tx - p.x, dz = t[2] - p.z, dd = Math.hypot(dx, dz), sp = game.autoplay ? 3.2 : 1.05;
          if (dd > 0.05) { const st = Math.min(dd, sp * dt); p.x += dx / dd * st; p.z += dz / dd * st; p.y += (t[1] - p.y) * Math.min(1, dt * 4); ch.root.rotation.y = Math.atan2(dx, dz); ch.speed = sp; }
          if (ch === A.tomas && dd < 0.12) S.esc++;
        }
      });

      // ---------- Joss and the beacon ----------
      act({ pos: [P1.joss[0], 1.6, P1.joss[2]], prompt: 'Talk to Joss', enabled: () => S.phase === 'evac' && S.groups.joss === 'ask', onUse: () => side(async () => {
        S.main = true; cine(true);
        await game.shot([4.6, 2.2, -114.6], [0, 6, -121], 1.6, { fov: 46 });
        await convo(A.joss, [['joss', 'Thirty years I kept her lit. She answered once. For you.'], ['kai', 'She\'s failing, Joss. Everything with a Helix anchor is.'], ['joss', 'I know what she\'s doing. I\'m asking what I\'m doing.']]);
        const c = await choose('kai', 'Joss at the beacon', ['"Then help me keep her alive long enough for the last of them."', '"The hall needs you more than it needs the beacon."', '"Then stay with her."'], 0);
        if (c === 0) {
          await convo(A.joss, [['kai', 'Then help me keep her alive long enough for the last of them.'], ['joss', '...The two field cabinets. Shunt them both and she\'ll burn everything she has left on the north wall. It buys time. Not much.'], ['joss', 'Then I\'ll walk. And you\'ll take her heart.']]);
          S.groups.joss = 'shunt'; S.shunts = 0; G.jossChoice = 'shunt';
        } else if (c === 1) {
          await convo(A.joss, [['kai', 'The hall needs you more than it needs the beacon.'], ['joss', 'That\'s what Wren says.'], ['kai', 'Wren\'s right.'], ['joss', '...She usually is. Take her heart when she goes. The core. It\'s what holds.']]);
          G.jossChoice = 'leave'; S.groups.joss = 'go'; S.main = false; cine(false);
          leave([A.joss], [exitPath([[4, 0, -112], [4, 0, -90], [3, 0, -82]])], 1, 1.2).then(() => { S.groups.joss = 'out'; }).catch(() => {});
        } else {
          await convo(A.joss, [['kai', 'Then stay with her.'], ['joss', 'Thank you. Nobody ever lets me.'], ['joss', 'When she goes, take her heart. The core. It\'s what holds. Give it to Sera.']]);
          G.jossChoice = 'stay'; S.groups.joss = 'stays';
          F.seraTrust = (F.seraTrust || 0) - 1;
        }
        S.main = false;
      }) });
      P1.cabs.forEach((p, i) => act({ pos: [p[0], 1.2, p[2]], prompt: `Shunt field cabinet ${i ? 'B' : 'A'}`, hold: 1.0, enabled: () => S.groups.joss === 'shunt' && !S['cab' + i], onUse: () => {
        S['cab' + i] = true; S.shunts = (S.shunts || 0) + 1; S.anchor = Math.min(0.92, S.anchor + 0.11); audio.sfxPlay('spark'); audio.sfxPlay('switch'); game.shake = 0.08;
        ui.toast(`CABINET ${i ? 'B' : 'A'} SHUNTED · ANCHOR ${Math.round(S.anchor * 100)} %`, 2200);
        if (S.shunts === 2) {
          side(async () => {
            S.main = true; cine(true);
            await convo(A.joss, [['joss', 'There. She\'s throwing everything north. Listen to her.'], ['kai', 'Your turn, Joss.'], ['joss', 'My turn.']]);
            S.groups.joss = 'go'; S.main = false; cine(false);
            leave([A.joss], [exitPath([[4, 0, -112], [4, 0, -90], [3, 0, -82]])], 1, 1.2).then(() => { S.groups.joss = 'out'; }).catch(() => {});
          });
        }
        refresh();
      } }));
      act({ pos: [P1.jossLog[0], 1.2, P1.jossLog[2]], radius: 1.5, prompt: 'Read Joss\'s beacon log', enabled: () => !G.josslog, onUse: () => side(async () => {
        G.josslog = true; S.main = true; cine(true);
        await closeUp(P1.jossLog, [['kai', 'Day two ninety. She answered. A road to Helix, eight fourteen. That was me.'], ['kai', 'Day two ninety-eight. "A hum in the coil like a voice saying a name."']]);
        ev('Beacon log · J. Harrow', 'Joss\'s log: the beacon answered on day 290 (a road to Helix SL4, 08:14:00, Kai\'s). Anchor 99 to 71 in eight days. Day 298: "a hum in the coil like a voice saying a name". If she goes, take her heart: it holds.', 'Lantern Hall · 2196');
        S.main = false;
      }) });

      // ---------- Ruth and her husband at the wall of names (optional) ----------
      act({ pos: [P1.elders[0][0], 1.2, P1.elders[0][2] + 0.6], prompt: 'Talk to Ruth', enabled: () => S.phase === 'evac' && S.groups.elders === 'ask', onUse: () => side(async () => {
        S.main = true; cine(true);
        await game.shot([-3.2, 1.8, -59], [-8, 1.8, -66], 1.4, { fov: 42 });
        await convo(A.ruth, [['m18ruth', 'Adaeze Abara. Adaeze Abara. I read it every evening, so the city hears it once more.'], ['kai', 'The storm is coming through the hall, Ruth. It will come through here.'],
          ['m18ruth', 'Then it can read it too.'], ['kai', 'Read it on the road. Out loud. I\'ll listen.'], ['m18ruth', '...You\'re the boy from the statue. The one we teach the children about.'], ['kai', 'I am. Today I\'m the one asking you to walk.'],
          ['m18ruth', 'Adaeze Abara. Come on, Emeka. The architect wants us to go.']]);
        S.groups.elders = 'go'; G.elders = 'kai'; S.main = false; cine(false);
        leave([A.ruth, husband], [[[-4, 0, -61], [-2.4, 0, -59.2]], [[-6, 0, -60.6], [-3.4, 0, -58.6]]], 2, 1.0).then(() => { S.groups.elders = 'out'; }).catch(() => {});
      }) });
      shard('the south-west corner of Lantern Hall', H.shard);

      // ---------- hints ----------
      hint(() => S.phase === 'evac' && S.groups.beds === 'tin' && !S.tin, 50, () => ui.subtitle('kai', 'The cistern platform. Steps up the west side, along the wall.', 3000));
      hint(() => S.phase === 'evac' && S.groups.school === 'search', 45, () => ui.subtitle('kai', game.residueOn ? 'Small prints. Towards the market stalls.' : 'Residue Vision. F. Children leave prints too.', 3000));
      hint(() => S.phase === 'evac' && S.groups.medic === 'escort', 60, () => ui.subtitle('kai', 'Stay close. They stop when I get too far ahead.', 2800));
      hint(() => S.phase === 'evac' && left().length && S.anchor < 0.3, 30, () => ui.subtitle('kai', 'Not much left in her. Move.', 2000));

      // ---------- intro ----------
      S.main = true; game.control = false; ui.letterbox(true);
      pl.place(...P1.start); game.checkpoint(...P1.start);
      lockMusic('m18-storm', 0.5);
      await ui.fade(1, 10);
      await game.shot([16, 22, -46], [0, 8, -110], 0.01, { fov: 52 });
      await ui.fade(0, 2000);
      const cardP = ui.chapterCard('ACT III · THE LAST VERSION OF EARTH', 'The Fracture', 'A collapsing world', 4600);
      await game.shot([10, 16, -62], [-2, 6, -118], 6.4, { fov: 50 });
      await cardP;
      await chapterTitle('I', 'Lantern Hall', 'The anchor is failing');
      await game.shot([-5, 3.6, -70], [0, 9, -160], 2.6, { fov: 48 });
      await game.say('m18band', `Binding: Lantern Hall beacon. Anchor stability ${Math.round(S.anchor * 100)} percent and falling.`);
      await game.say('kai', 'That\'s not weather. That\'s a front of loose time, and it\'s walking south.');
      await convo(A.sera, [
        ['sera', metSera ? 'You came back through the beacon. Good. You can help me empty the hall.' : 'You\'re Varen. I\'m Sera Voss. Lantern Hall is mine to empty. You can help.'],
        ['kai', 'The beacon is failing.'], ['sera', 'The beacon was holding the storm off this whole valley. When it goes, the hall goes. Twenty-one are out. Thirteen are still inside.'],
        ...(trust < 0 ? [['sera', 'And before you ask: no, I don\'t think you did this. Not this part.']] : trust >= 2 ? [['sera', 'I\'m glad it\'s you. That\'s a strange thing to say to a man on a memorial.']] : []),
        ['kai', 'Who\'s still inside?'], ['sera', 'Ama\'s gardeners in the beds. Hedda\'s school. Nadia and Tomas, he\'s got a broken leg. And Joss. Joss won\'t leave the beacon.'],
        ['sera', 'I hold the gate and the carts. You bring them to me.'],
      ]);
      S.main = false; musicLock = null; cine(false);
      S.phase = 'evac'; cpEvac(...P1.start);
      refresh();
      window.__m18.ch1 = { A, H, R, leave };

      // ---------- run until everyone (who will go) is out ----------
      await game.waitFor(() => left().length === 0 && !S.busy && !game._failing);
      // Ruth: if Kai never went to her, Wren does
      if (S.groups.elders === 'ask') {
        S.main = true; cine(true);
        await game.shot([1, 2.2, -84], [P1.wren[0], 1.5, P1.wren[2]], 1.2, { fov: 40 });
        await game.say('wren', 'Ruth! She\'s still at the wall. I\'ll get her. Do what Dad asked.');
        A.wren.root.visible = false; A.ruth.root.visible = false; husband.root.visible = false; S.out += 2; H.setTally(S.out); G.elders = 'wren'; S.groups.elders = 'out';
        S.main = false; cine(false);
      }
      S.phase = 'heart'; objective('Take the anchor\'s heart from the beacon, then run for the gate');
      const heartIt = act({ pos: [0, 1.6, -118.6], radius: 2.2, prompt: 'Take the anchor\'s heart', hold: 1.2, enabled: () => S.phase === 'heart', onUse: () => { S.heart = true; } });
      await game.waitFor(() => S.heart);
      heartIt.done();
      // the anchor dies; the front comes through the hall
      S.main = true; cine(true); G.heart = true;
      audio.sfxPlay('boom'); game.shake = 0.35;
      await game.shot([5, 3, -112], [0, 5, -121], 1.4, { fov: 46 });
      R.emitter.material.emissiveIntensity = 0; if (R.beam) R.beam.material.opacity = 0;
      await game.say('m18band', 'Anchor lost. Storm front advancing. Binding: no anchor.');
      if (G.jossChoice === 'stay') {
        await game.say('joss', 'There she goes. Go on, lad. I\'ll be along.');
        await game.say('sera', 'Joss! JOSS! I\'m coming in for him. Kai, run!');
      } else await game.say('sera', 'Kai! It\'s through the north wall! RUN!');
      lockMusic('m18-storm', 0.3);
      S.phase = 'escape'; H.setFront(-136);
      game.checkpoint(0, 0, -116.5, 0, () => { H.setFront(-136); });
      S.main = false; cine(false);
      objective('Run for the gate');
      await new Promise((res) => {
        const off = game.onUpdate(dt => {
          if (S.phase !== 'escape' || game._failing) return;
          if (game.control) H.setFront(H.front + dt * (game.autoplay ? 1.0 : 3.4));
          if (pl.pos.z < H.front + 0.6 && pl.pos.z < -70) { game.fail('THE STORM CAUGHT YOU'); return; }
          if (pl.pos.z > -66) { off(); res(); }
        });
      });
      S.phase = 'out'; S.main = true; cine(true); hudSet(null);
      await game.shot([6, 3, -52], [0, 6, -90], 2.0, { fov: 50 });
      audio.sfxPlay('anomaly'); game.shake = 0.25;
      await tween(3.4, k => H.setFront(-100 + k * 30));
      if (G.jossChoice === 'stay') { await game.say('sera', 'Got him! I\'ve got him. He\'s swearing. He\'s fine.'); await game.say('joss', 'Thirty years. Thirty years and you drag me out by my collar.'); }
      await game.say('kai', 'Sera, my band. It was anchored to the beacon.');
      await game.say('sera', 'Then hold on to something.');
      await game.say('m18band', 'Binding fracture. Forced shift. Nearest stable signature: Varrow Gorge.');
      await game.say('sera', 'Test Hall C, Kai! If we lose each other, Test Hall C! Bring the heart!');
      audio.sfxPlay('switch'); audio.sfxPlay('rewind');
      F.lanternHall = 'evacuated'; F.m18evacuated = S.out; F.m18jossChoice = G.jossChoice; F.m18elders = G.elders; F.m18lio = G.lio || 'roof';
      await ui.fade(1, 1600);
      cine(false); game.control = false;
    }

    // =================================================================================================================
    // II · VARROW GORGE — cross a canyon that exists only in the past
    // =================================================================================================================
    async function chapter2() {
      G.ch = 2; portraits(['sera', 'm18kai6', 'm18mira9']);
      const D26 = { id: '2026', key: '1', name: 'PAST', year: 'GORGE · 2026', glyph: '◐', color: '#ffc890', theme: 'm18-gorge', apply: () => {} };
      const D49 = { id: '2049', key: '2', name: 'PRESENT', year: 'EASTWAY · 2049', glyph: '◎', color: '#5fe6ff', theme: 'm18-tear', apply: () => {} };
      const scene = await newPlace({ background: 0x1a1c2a, fog: [0x2a2c3a, 0.012], exposure: 1.0, bloom: 0.55, bloomThreshold: 0.85, envIntensity: 0.7, killY: -30 }, [D26, D49], '2049');
      W = buildGorge(game, scene, T); prevRoot.push(W.root); game.onUpdate((dt, t) => W.update(dt, t)); await tick();
      rig(W, {
        '2026': { fog: [0xc8b8a0, 0.006], env: 0.9, hemi: [0xffe8c8, 0x5a4a38, 0.55], sun: [0xffd8a0, 2.4], dir: [-0.55, 0.42, 0.35], exp: 1.0, bg: 0xc8b8a0, beds: { wind: 0.07, water: 0.12 } },
        '2049': { fog: [0x2a2c3a, 0.012], env: 0.7, hemi: [0x8a90c0, 0x22222c, 0.62], sun: [0x9ab0ff, 0.75], dir: [0.4, 0.5, -0.3], exp: 1.18, bg: 0x2a2c3a, beds: { rain: 0.18, wind: 0.14, hum: 0.03, hz: 40 } },
      }, { '2026': { preset: 'golden-hour', elevation: 16, azimuth: 240, turbidity: 4, cover: 0.35 }, '2049': { preset: 'overcast', elevation: 6, azimuth: 120, cover: 0.96 } });
      themeFor = () => (S.memory ? 'm18-memory' : T.current === '2026' ? 'm18-gorge' : 'm18-tear');
      fallRule(); rewindRule(W.storm);
      eraRules(null);
      Object.assign(S, { gen: false, girder: false, hoist: false, deck: false, inside: false });
      const zoneOf = () => (pl.pos.y < -10 ? (pl.pos.x > 2.5 ? 'east' : 'floor') : pl.pos.x < -34 ? 'road' : pl.pos.x < -14 ? 'site' : pl.pos.x > 14 ? 'rim' : pl.pos.y < -0.6 ? 'ramp' : 'deck');
      game.onUpdate(() => {   // the river
        if (game._failing || !game.control) return;
        if (T.current === '2026' && Math.abs(pl.pos.x) < 2.5 && pl.pos.y < -16.4) game.fail('THE RIVER TOOK YOU');
      });
      const refreshObj = () => {
        if (S.main) return;
        const z = zoneOf();
        if (!S.inside) objective(T.current === '2049' ? 'The Eastway ends in a tear. Switch to 2026 (1) and look at what was here' : 'A site hoarding blocks the gorge in 2026. In 2049 there is no fence: cross the line in 2049, then switch back');
        else if (!S.gen) objective('Start the site generator (2026): the crane and the hoist need power');
        else if (!S.girder) objective(z === 'floor' ? 'Use the crane remote to lay girder G-7 across the river' : 'Take the haul ramp down into the gorge (2026) · storm cells throw you back');
        else if (!S.hoist) objective('Cross the girder · ride the hoist up the pier');
        else if (!S.deck) objective('Climb the pier ladder to the deck');
        else objective('The deck ends short of the east rim. In 2049 the fill is there: switch (2) and walk on');
      };
      refresh = refreshObj; let oT = 0; game.onUpdate(dt => { oT -= dt; if (oT <= 0) { oT = 1; refreshObj(); } });
      game.onUpdate(() => { if (!S.inside && T.current === '2026' && pl.pos.x > -33.6) { S.inside = true; game.checkpoint(-30, 0, 0, PI / 2); refreshObj(); } });

      // ---------- site: generator, board, whiteboard ----------
      act({ pos: [P2.gen[0] - 2.2, 1.2, P2.gen[2]], radius: 1.9, states: ['2026'], prompt: 'Start the site generator', hold: 1.4, enabled: () => !S.gen && T.current === '2026', onUse: () => side(async () => {
        S.gen = true; W.genLamp.material = W.mats.amber; audio.sfxPlay('metal'); audio.hum(0.05, 60); game.shake = 0.05; W.remoteLamp.material = W.mats.amber; W.cageLamp.material = W.mats.amber;
        ui.subtitle('kai', 'Crane two, the hoist. Somebody planned a crossing here. In twenty twenty-six.', 3200);
        game.checkpoint(-24, 0, -12, PI / 2); refreshObj();
      }) });
      act({ pos: [P2.board[0] + 0.5, 1.6, P2.board[2]], radius: 2.2, states: ['2026'], prompt: 'Read the site board', enabled: () => !G.board && T.current === '2026', onUse: () => side(async () => {
        G.board = true; S.main = true; cine(true);
        await closeUp([P2.board[0], P2.board[1], P2.board[2]], [['kai', 'Varrow Fill. Gorge filled by twenty thirty-one. Sponsor: Helix.'], ['kai', 'A logistics corridor. For carrying what, Rook?']], 2.4, 40);
        ev('Site board · Varrow Fill', 'Eastway contract 7, Corran & Vey Civil. Sponsor: Helix Temporal Research (logistics corridor). The gorge to be filled by 2031: the year Rook sealed Site Zero.', 'Varrow Gorge · 2026');
        S.main = false;
      }) });
      act({ pos: [-25.6, 1.4, 13.9], radius: 1.6, states: ['2026'], prompt: 'Read the whiteboard in the site office', enabled: () => !G.whiteboard && T.current === '2026', onUse: () => side(async () => {
        G.whiteboard = true; S.main = true; cine(true);
        await closeUp([-24.96, 1.5, 13.9], [['kai', '"Culvert C-3 pour Friday. Strike formwork." "Kids seen at the river again."'], ['kai', 'Kids at the river. In twenty twenty-five that was us.']], 1.2, 38);
        ev('Site office whiteboard', 'Week 41, 2026: pier 2 to deck Monday; culvert C-3 pour Friday ("strike formwork!"); crane 2 load girder G-7 over the river; Helix trucks to use the fill from 2031; "Kids seen at the river again."', 'Varrow Gorge · 2026');
        S.main = false;
      }) });

      // ---------- the gorge floor: crane remote, carving ----------
      act({ pos: [P2.remote[0], -14.8, P2.remote[2]], radius: 1.8, states: ['2026'], prompt: 'Use the crane remote', enabled: () => !S.girder && T.current === '2026', onUse: () => side(async () => {
        if (!S.gen) { audio.sfxPlay('fail'); ui.toast('NO POWER · SITE GENERATOR G-2 (TOP OF THE GORGE)', 2400); return; }
        S.main = true; cine(true); lockMusic('m18-gorge', 0.5);
        await game.shot([-9.6, -12.6, -2], [-1, -11, -10], 1.4, { fov: 50 });
        audio.sfxPlay('metal'); audio.hum(0.06, 48);
        await game.say('kai', 'Slew left. Lower. Easy.');
        await tween(game.autoplay ? 2 : 6.5, k => W.setGirder(k));
        audio.sfxPlay('boom'); game.shake = 0.12; W.girderBox.enabled = true; S.girder = true;
        await game.shot([4, -13.6, -3], [0, -15.6, -8.1], 1.4, { fov: 44 });
        await game.say('kai', 'Girder G-7. Across the river, twenty-three years early.');
        musicLock = null; S.main = false; game.checkpoint(-5, -16, -7.4, PI / 2);
      }) });
      act({ pos: [P2.carving[0] + 1.3, -15.2, P2.carving[2]], radius: 1.8, states: ['2026'], prompt: 'Look at the carving on the rock', enabled: () => !G.carving && T.current === '2026', onUse: () => side(async () => {
        G.carving = true; S.main = true; S.memory = true; cine(true); music(0.8);
        const k6 = game.actor('m18kai6', null, -3.6, -16, 18.4, PI / 2), m9 = game.actor('m18mira9', null, -4.4, -16, 17.2, PI / 2);
        try { k6.setGhost(GHOST_KID); m9.setGhost(GHOST_MIRA); } catch (err) { void err; }
        small.add(k6); small.add(m9);
        pl.place(P2.carving[0] + 1.7, -16, P2.carving[2] + 1.5, -PI / 2 - 0.5);
        await game.shot([P2.carving[0] + 2.6, -14.7, P2.carving[2] - 2.2], [P2.carving[0] + 0.95, -15.2, P2.carving[2]], 1.4, { fov: 36 });
        await game.say('kai', 'K plus M. Twenty twenty-five. Dad\'s penknife. She did the M.');
        await game.shot([-7.6, -14.6, 21.6], [-3.8, -15.2, 17.6], 1.6, { fov: 40 });
        m9.pose = 'look'; await game.say('m18mira9', 'Four skips! That\'s four! You saw it!');
        await game.say('m18kai6', 'It sank on three.');
        await game.say('m18mira9', 'It sank after four. You count the splashes, not the sinking. That\'s the rule.');
        audio.sfxPlay('motif');
        await game.shot([P2.carving[0] + 3.4, -14.5, P2.carving[2] - 1.6], [P2.carving[0] + 1.4, -15.0, P2.carving[2] + 1.0], 1.2, { fov: 40 });
        await game.say('kai', 'Count the splashes, not the sinking. I\'d forgotten she said that.');
        ev('K + M · 2025', 'A carving on a boulder by the Varrow river: "K + M · 2025". Kai and Mira, the summer before the open day. Residue: Mira counting stone skips. "You count the splashes, not the sinking."', 'Varrow Gorge · 2026');
        k6.root.visible = false; m9.root.visible = false; S.memory = false; S.main = false; music();
      }) });

      // ---------- the hoist and the pier ladder ----------
      act({ pos: [P2.hoist[0] - 1.0, -14.8, P2.hoist[2]], radius: 1.8, states: ['2026'], prompt: 'Ride the hoist up the pier', enabled: () => !S.hoist && T.current === '2026', onUse: () => side(async () => {
        if (!S.gen) { audio.sfxPlay('fail'); ui.toast('NO POWER · SITE GENERATOR G-2', 2200); return; }
        S.main = true; cine(true);
        pl.place(P2.hoist[0], -16 + 0.12, P2.hoist[2], PI / 2); audio.sfxPlay('metal'); audio.sfxPlay('door');
        await game.shot([0.6, -9, 7.6], [6.4, -14.5, 0], 0.8, { fov: 52, follow: pl.pos });
        await tween(game.autoplay ? 1.5 : 5.0, k => { const y = -16 + k * 11.4; W.cage.position.y = y; pl.pos.y = y + 0.12; pl.vel.set(0, 0, 0); });
        S.hoist = true; game.checkpoint(P2.hoist[0], -4.48, P2.hoist[2], PI / 2);
        W.cageBox.min.y = -4.8; W.cageBox.max.y = -4.48; W.cageBox.enabled = true;
        S.main = false;
      }) });
      act({ pos: [7.6, -3.4, 0], radius: 1.8, states: ['2026'], prompt: 'Climb the pier ladder', enabled: () => S.hoist && !S.deck && T.current === '2026', onUse: () => side(async () => {
        S.main = true; cine(true);
        await game.shot([3.6, -2.6, 3.4], [7.9, -2, 0], 0.6, { fov: 50 });
        pl.yaw = PI / 2; kai.root.rotation.y = PI / 2;
        await tween(game.autoplay ? 1 : 2.6, k => { pl.pos.set(7.45, -4.48 + k * 4.5, 0); pl.vel.set(0, 0, 0); });
        pl.place(8.4, 0.02, 0, PI / 2); S.deck = true; game.checkpoint(8.4, 0, 0, PI / 2);
        await game.shot([4.6, 2.2, 4.6], [14, 0, 0], 1.6, { fov: 46 });
        await game.say('kai', 'The deck stops. The rim doesn\'t start for five metres.');
        await game.say('m18band', 'Present signature here: the fill. Twenty forty-nine has ground at this height.');
        S.main = false;
      }) });
      for (const q of P2.shards) shard(q[3], q.slice(0, 3), [q[4]]);

      // ---------- hints, barks ----------
      hint(() => !S.inside && T.current === '2026', 35, () => ui.subtitle('kai', 'The hoarding\'s only here in twenty twenty-six. Walk through where it isn\'t. Two.', 3000));
      hint(() => S.inside && !S.gen, 50, () => ui.subtitle('kai', 'The site cabin by the south fence. Generator G-2.', 2800));
      hint(() => S.gen && !S.girder && zoneOf() !== 'floor', 60, () => ui.subtitle('kai', 'The haul ramp starts at the north end of the rim. Down the west wall.', 3000));
      hint(() => S.girder && !S.hoist && zoneOf() === 'east', 40, () => ui.subtitle('kai', 'The hoist cage. Beside the pier.', 2400));
      hint(() => S.deck && T.current === '2026' && pl.pos.x > 7 && pl.pos.y > -0.5, 25, () => ui.subtitle('kai', 'Twenty forty-nine filled this in. Two.', 2400));
      game.onUpdate(() => {
        if (S.main || S.busy) return;
        if (zoneOf() === 'ramp' && once('rampSera') && metSera) side(async () => { await game.say('m18sera', 'Kai? ... Kai. You fell off my scanner. The convoy\'s on the freight road.'); await game.say('kai', 'I\'m twenty-three years before the road. Going down a canyon nobody remembers.'); await game.say('m18sera', 'Then come forward. Test Hall C. I mean it.'); });
        if (zoneOf() === 'floor' && S.gen && once('floorIn')) { game.checkpoint(-5.2, -16, -24, 0); ui.subtitle('kai', 'The river. Fast, and colder than it looks.', 2600); }
        if (zoneOf() === 'east' && once('eastIn')) game.checkpoint(4.6, -16, -6.6, 0);
      });

      // ---------- intro ----------
      S.main = true; game.control = false; ui.letterbox(true);
      pl.place(...P2.start); game.checkpoint(...P2.start);
      await ui.fade(1, 10);
      await game.shot([-46, 4, 10], [-14, -1, 0], 0.01, { fov: 50 });
      await ui.fade(0, 1800);
      await chapterTitle('II', 'Varrow Gorge', 'A canyon that exists only in the past');
      await game.shot([-40, 3, -6], [-6, -4, 2], 3.0, { fov: 48 });
      await game.say('m18band', 'Binding: twenty forty-nine. The Eastway, Varrow section. Ground ahead: missing.');
      await game.say('kai', 'The storm took the fill. The whole embankment. There\'s nothing under the road.');
      await game.say('m18band', 'Past signature under this road: twenty twenty-six. The ground was different then.');
      T.unlocked = true; T.refreshHud();
      await T.switchTo('2026', { force: true, free: true });
      await game.shot([-18, 4, 30], [4, -14, -4], 3.6, { fov: 52 });
      await game.say('kai', 'Varrow Gorge. Dad used to drive us out here. They filled it in when I was eleven.');
      await game.say('kai', 'A canyon that only exists in the past. And my way to Helix is on the other side of it.');
      await T.switchTo('2049', { force: true, free: true });
      ui.toast('SWITCH · 2026 (1) · 2049 (2)', 3000);
      S.main = false; cine(false); S.phase = 'cross'; refreshObj();
      window.__m18.ch2 = { W };
      await game.waitFor(() => pl.pos.x > P2.exitX && !S.busy);
      S.main = true; cine(true);
      await game.shot([20, 2.4, 6], [40, 3, -2], 1.6, { fov: 46 });
      await game.say('kai', 'Across. Halden four, Helix nine. The sign\'s still pointing.');
      await game.say('m18band', 'Present signature stable to the south-east. The Eastway continues.');
      F.m18gorge = true; F.m18carving = G.carving;
      await ui.fade(1, 1400);
    }
    let refresh = () => {};

    // =================================================================================================================
    // III · THE EASTWAY — navigate a flooded highway in the present
    // =================================================================================================================
    async function chapter3() {
      G.ch = 3; portraits(['jun', radioId, 'm18pass']);
      const D49 = { id: '2049', key: '2', name: 'PRESENT', year: 'EASTWAY · 2049', glyph: '◎', color: '#5fe6ff', theme: 'm18-flood', apply: () => {} };
      const D26 = { id: '2026', key: '1', name: 'PAST', year: 'THE FILL · 2026', glyph: '◐', color: '#ffc890', theme: 'm18-pit', apply: () => {} };
      const scene = await newPlace({ background: 0x141a22, fog: [0x1c242e, 0.016], exposure: 1.05, bloom: 0.6, bloomThreshold: 0.82, envIntensity: 0.6, killY: -14 }, [D26, D49], '2049');
      W = buildEastway(game, scene, T); prevRoot.push(W.root); game.onUpdate((dt, t) => W.update(dt, t)); await tick();
      const rain = new Rain(RZ.getQuality() === 'low' ? 2200 : 4200, 46); scene.add(rain.mesh); T.only(rain.mesh, '2049');
      game.onUpdate(dt => { if (rain.mesh.visible) rain.update(dt, game.engine.camera); });
      rig(W, {
        '2049': { fog: [0x26303c, 0.014], env: 0.75, hemi: [0x9ab0d0, 0x1c2026, 0.75], sun: [0xa8c0ff, 0.6], dir: [0.3, 0.6, -0.4], exp: 1.2, bg: 0x1c242e, beds: { rain: 0.38, water: 0.22, wind: 0.08 } },
        '2026': { fog: [0xa8acac, 0.009], env: 0.85, hemi: [0xe0e4e8, 0x4a4840, 0.6], sun: [0xfff0dc, 1.4], dir: [-0.3, 0.7, 0.4], exp: 1.0, bg: 0xa8acac, beds: { wind: 0.06, hum: 0.02, hz: 70 } },
      }, { '2049': { preset: 'overcast', elevation: 4, azimuth: 80, cover: 0.98 }, '2026': { preset: 'overcast', elevation: 30, azimuth: 160, cover: 0.85 } });
      themeFor = () => (T.current === '2026' ? 'm18-pit' : S.drained ? 'm18-gorge' : 'm18-flood');
      fallRule();
      eraRules(null);
      Object.assign(S, { t: 0, period: 34, L: W.waterBase, swept: 0, e7: false, pumpTried: false, formwork: false, drained: false, jun: 'none', surges: 0, firstSurge: false, high: 0 });
      // the surge cycle (2049): calm, rise, hold, ebb. Drained: the level falls below the road and stays there
      const levelAt = (u) => (u < 0.55 ? 0 : u < 0.66 ? (u - 0.55) / 0.11 : u < 0.84 ? 1 : 1 - (u - 0.84) / 0.16);
      game.onUpdate(dt => {
        const run = game.control && !S.busy && S.firstSurge;
        if (run) S.t += dt;
        const u = (S.t % S.period) / S.period, k = S.drained ? 0 : levelAt(u);
        const target = S.drained ? -1.7 : W.waterBase + k * 1.05;
        S.L += (target - S.L) * Math.min(1, dt * (S.drained ? 0.25 : 3));
        musicState.surge = S.drained ? 0 : k; W.level = S.L; W.setLevel(S.L);
        if (run && u > 0.55 && !S.inSurge) { S.inSurge = true; S.surges++; G.surges++; audio.sfxPlay('alarm'); game.shake = 0.08; }
        if (u < 0.55) S.inSurge = false;
        S.u = u;
      });
      const onRoad = () => pl.pos.x > -15.4 && pl.pos.x < 15.4 && pl.pos.z < 36 && pl.pos.z > -118;
      game.onUpdate(dt => {
        if (!game.control || game._failing || S.busy) { S.swept = Math.max(0, S.swept - dt); return; }
        if (T.current === '2026' && pl.pos.y < -2.5) { game.fail('INTO THE FILL PIT · 2026'); return; }
        if (T.current !== '2049' || !onRoad()) { S.swept = Math.max(0, S.swept - dt * 2); return; }
        const depth = S.L - pl.pos.y;
        if (depth > 0.85) {
          S.swept += dt; pl.pos.x += dt * 1.1; pl.pos.z += dt * 0.5;
          if (S.swept > 1.7) { G.swept++; game.fail('THE SURGE TOOK YOU · GET TO HIGH GROUND WHEN IT COMES'); return; }
          if (once('sweptbark' + Math.floor(game.time / 6))) ui.subtitle('kai', 'It\'s taking my feet. Up. Get up!', 1600);
        } else S.swept = Math.max(0, S.swept - dt * 2);
        // the live water around the fallen column, until E-7 is isolated
        const dz = Math.abs(pl.pos.z - P3.cable[2]);
        if (!S.e7 && dz < 6 && depth > 0.02) { game.fail('ELECTROCUTED · THE WATER UNDER THE FALLEN COLUMN IS LIVE'); return; }
        if (!S.e7 && dz < 12 && once('livebark')) ui.subtitle('kai', 'That column\'s cable is lying in the water, right across the road. It\'s live. Isolator on the east shoulder.', 3400);
      });
      game.onUpdate(() => {
        if (S.main) { hudSet(null); return; }
        if (T.current !== '2049' || !S.firstSurge || S.drained) { hudSet(S.drained ? null : T.current === '2026' ? [['2026 · THE FILL PIT · STAY ON THE STRIPS', null]] : null); return; }
        const left = (0.55 - S.u) * S.period;
        hudSet([[S.u < 0.55 ? `SURGE IN ${Math.max(0, Math.ceil(left))} s` : 'SURGE · GET HIGH', S.u < 0.55 ? 1 - S.u / 0.55 : 1, S.u < 0.55 ? '#7fd8ff' : '#ff8a7a'], [`WATER ${Math.max(0, S.L).toFixed(1)} m`, null]]);
      });
      // high ground: climb onto cars, the lorry, the bus
      for (const c of W.high) act({ pos: [c.x + (c.x > 0 ? -1.3 : 1.3), 0.9, c.roofZ], radius: 1.7, states: ['2049'], prompt: c.kind === 'van' ? 'Climb onto the van' : 'Climb onto the car roof', enabled: () => T.current === '2049' && pl.pos.y < c.top - 0.5, onUse: () => side(async () => {
        await tween(0.45, k => { pl.pos.set(pl.pos.x + (c.x - pl.pos.x) * k, pl.pos.y + (c.top + 0.02 - pl.pos.y) * k, pl.pos.z + (c.roofZ - pl.pos.z) * k); pl.vel.set(0, 0, 0); });
        audio.sfxPlay('metal');
      }) });
      act({ pos: [P3.cab[0], 1.2, P3.cab[2]], radius: 1.9, states: ['2049'], prompt: 'Climb up the lorry cab', enabled: () => T.current === '2049' && pl.pos.y < 2.5, onUse: () => side(async () => {
        await tween(0.8, k => { pl.pos.set(-12.4, k * 3.12, -22.2 + (1 - k) * 2.6); pl.vel.set(0, 0, 0); }); audio.sfxPlay('metal');
        if (once('cabTop')) ui.subtitle('kai', 'Onto the trailer and along it. Drop down on the far side.', 2600);
        game.checkpoint(-12.4, 3.12, -22.2, PI);
      }) });
      act({ pos: [-11.6, 3.6, -23.6], radius: 1.8, states: ['2049'], prompt: 'Climb onto the trailer', enabled: () => T.current === '2049' && pl.pos.y > 2.8 && pl.pos.y < 3.6, onUse: () => side(async () => { await tween(0.5, k => { pl.pos.set(-11.6 + k * 1.4, 3.12 + k * 0.8, -23.6 - k * 2.2); pl.vel.set(0, 0, 0); }); audio.sfxPlay('metal'); }) });

      // ---------- isolator E-7 ----------
      act({ pos: [P3.e7[0] - 0.8, 1.0, P3.e7[2]], radius: 1.8, states: ['2049'], prompt: 'Isolate feeder E-7', hold: 1.2, enabled: () => !S.e7 && T.current === '2049', onUse: () => side(async () => {
        if (S.L > 0.62) { audio.sfxPlay('fail'); ui.toast('THE CABINET IS UNDER WATER · WAIT FOR THE SURGE TO DROP', 2400); return; }
        S.e7 = true; W.e7Lamp.material = W.mats.green; W.spark.visible = false; audio.sfxPlay('spark'); audio.sfxPlay('switch');
        ui.subtitle('kai', 'Feeder E-7, isolated. The water\'s just water again.', 2600);
        game.checkpoint(10.6, 0, -50, PI);
      }) });
      // ---------- the bus and Jun Park ----------
      const jun = game.actor('jun', null, P3.busRoof[0] - 0.6, P3.busRoof[1], P3.busRoof[2] - 2.6, 0); S.byId.jun = jun;
      const pas = PASSENGERS.map((l, i) => { const c = game.ambient({ ...l, seed: 1860 + i }, P3.busRoof[0] + (i % 2 ? 0.6 : -0.5), P3.busRoof[1], P3.busRoof[2] - 4 - i * 1.1, i % 2 ? -PI / 2 : PI / 2); c.pose = 'sit'; return c; });
      await tick();
      act({ pos: [P3.bus[0], 1.2, P3.bus[2] + 6.6], radius: 1.8, states: ['2049'], prompt: 'Climb the bus ladder', enabled: () => T.current === '2049' && pl.pos.y < 2.8, onUse: () => side(async () => {
        await tween(1.0, k => { pl.pos.set(P3.bus[0], k * 3.22, P3.bus[2] + 6.4 - k * 1.8); pl.vel.set(0, 0, 0); }); audio.sfxPlay('metal');
        game.checkpoint(P3.bus[0], 3.22, P3.bus[2] + 4.2, PI);
      }) });
      act({ pos: [jun.root.position.x, 4.4, jun.root.position.z], radius: 2.0, states: ['2049'], prompt: 'Talk to the driver', enabled: () => S.jun === 'none' && T.current === '2049', onUse: () => side(async () => {
        S.main = true; cine(true);
        await convo(jun, [
          ...(F.metJun ? [['jun', 'Kai? Kai Varen. Central Station. You pulled my passengers off a train that wasn\'t there any more.'], ['kai', 'Jun. You drive buses now?'], ['jun', 'They gave me the N4 after the station. Nobody wanted the nights.']]
            : [['jun', 'You\'re not the rescue crew. You\'re a man in a wet jacket.'], ['kai', 'Kai Varen. Helix. Sort of.'], ['jun', 'Jun Park. Night N4. Seven of us, if you count the driver.']]),
          ['jun', 'Pump three is dead and the dip under the rail bridge is full. Two metres. If we wade for the off-ramp in a surge, we lose someone.'],
          ['kai', 'Then the pump has to run.'], ['jun', 'It\'s been tripping all night. The engineers on the radio said the outfall\'s blocked. Has been since the road was built.'],
          ['kai', 'Since it was built.'], ['jun', 'That\'s what I said. Who builds a drain that doesn\'t drain?'],
        ]);
        S.jun = 'met'; G.jun = true; S.main = false;
        ev('Night bus N4', 'Jun Park\'s night bus, stalled on the Eastway at the dip under the Line 6 bridge: six passengers on the roof. Pump station 3 keeps tripping; the outfall has been blocked "since the road was built".', 'The Eastway · 2049');
      }) });
      // ---------- pump station 3 and culvert C-3 ----------
      act({ pos: [P3.pump[0] + 1.1, 1.6, P3.pump[2]], radius: 1.9, states: ['2049'], prompt: 'Restart the drainage pumps', hold: 1.0, enabled: () => !S.drained && T.current === '2049', onUse: () => side(async () => {
        S.main = true; cine(true);
        await game.shot([-17.2, 2.4, -93.4], [-21.4, 1.6, -95], 1.0, { fov: 44 });
        audio.sfxPlay('metal'); audio.hum(0.07, 46);
        if (!S.formwork) {
          await game.wait(0.8); audio.sfxPlay('fail'); W.pumpLamp.material = W.mats.red;
          await game.say('m18band', 'Pump station three: outfall obstructed. Culvert C-3. Obstruction logged at commissioning, twenty twenty-six.');
          await game.say('kai', 'Blocked since the day it was built. Then whatever\'s in it went in before the concrete did.');
          await game.say('kai', 'The fill pit. Twenty twenty-six. The culvert would still be open.');
          ev('Pump station 3 · culvert C-3', 'The Eastway drainage pumps trip because culvert C-3 has been obstructed since commissioning (2026). The culvert runs under the west shoulder at the pump station.', 'The Eastway · 2049');
          S.pumpTried = true; S.main = false; game.checkpoint(-17.6, 0.6, -95, -PI / 2);
          return;
        }
        W.pumpLamp.material = W.mats.green; audio.sfxPlay('success');
        await game.say('m18band', 'Pump station three: running. Outfall clear.');
        S.drained = true; lockMusic('m18-gorge', 2);
        await game.shot([-6, 7, -86], [4, 0, -104], 2.0, { fov: 50 });
        W.grateFoam.material.opacity = 0.7;
        await tween(game.autoplay ? 2 : 6, () => {});
        await game.say('kai', 'There it goes. Twenty-three years of water, and a plank of wood.');
        F.m18causal = 'culvert';
        musicLock = null; S.main = false;
      }) });
      act({ pos: [P3.culvert26[0] + 0.6, 0.9, P3.culvert26[2]], radius: 2.0, states: ['2026'], prompt: 'Pull the formwork out of culvert C-3', hold: 1.6, enabled: () => !S.formwork && T.current === '2026', onUse: () => side(async () => {
        S.main = true; cine(true);
        await game.shot([-8.6, 1.4, -97.2], [-12.8, -0.4, -99.4], 1.0, { fov: 44 });
        audio.sfxPlay('metal'); W.formwork.visible = false; T.objects = T.objects.filter(o => o !== W.formwork); S.formwork = true;
        await game.say('kai', 'Timber shuttering, still wedged in the pipe. They pour on Friday. Nobody struck it.');
        audio.sfxPlay('anomaly'); await game.say('m18band', 'Causal change. Culvert C-3, twenty forty-nine: clear.');
        ev('Formwork in culvert C-3', 'In 2026 the timber formwork was never struck from culvert C-3 before the pour: the Eastway drain was blocked from the first day. Kai pulled it out in 2026; in 2049 the culvert is clear.', 'Varrow Fill · 2026');
        S.main = false; game.checkpoint(-11, 0, -94, PI);
      }) });
      // ---------- objectives, hints ----------
      const refreshObj = () => {
        if (S.main) return;
        if (S.drained) { objective('The dip is draining. Walk the passengers out: the off-ramp past the rail bridge'); return; }
        const parts = [];
        if (pl.pos.z > -22) parts.push('get past the jack-knifed lorry (over it, or in 2026 along the haul strip)');
        else if (!S.e7 && pl.pos.z > -60) parts.push('isolate feeder E-7 on the east shoulder (only when the water is low)');
        if (S.jun === 'none' && pl.pos.z < -40) parts.push('the bus at the dip');
        if (S.pumpTried && !S.formwork) parts.push('clear culvert C-3 in 2026 (switch on the west haul strip near the pump station)');
        else if (S.formwork) parts.push('restart pump station 3 (2049)');
        else if (pl.pos.z < -60) parts.push('pump station 3 behind the west wall');
        objective('Follow the Eastway south · at a surge, get onto high ground · ' + parts.join(' · '));
      };
      refresh = refreshObj; let oT = 0; game.onUpdate(dt => { oT -= dt; if (oT <= 0) { oT = 1; refreshObj(); } });
      hint(() => S.firstSurge && S.u > 0.4 && S.u < 0.55 && pl.pos.y < 0.5 && T.current === '2049', 3, () => ui.subtitle('kai', 'Surge coming. Car roof, the barrier, anything high.', 2200));
      hint(() => pl.pos.z < -18 && pl.pos.z > -24 && pl.pos.y < 2, 30, () => ui.subtitle('kai', 'The cab has a ladder. Or in twenty twenty-six there was no lorry: the haul strip on the east side.', 3400));
      hint(() => S.pumpTried && !S.formwork, 45, () => ui.subtitle('kai', 'The culvert mouth. Twenty twenty-six, on the haul strip by the west shoulder.', 3000));
      shard('on the roof of the N4 night bus', P3.shard, ['2049']);

      // ---------- intro ----------
      S.main = true; game.control = false; ui.letterbox(true);
      pl.place(...P3.start); game.checkpoint(...P3.start);
      await ui.fade(1, 10);
      await game.shot([10, 9, 58], [0, 0, 10], 0.01, { fov: 50 });
      await ui.fade(0, 1800);
      await chapterTitle('III', 'The Eastway', 'A flooded highway in the present');
      await game.shot([8, 6, 40], [-2, 0, -20], 3.6, { fov: 50 });
      await game.say('kai', 'The storm brought the sea. A hundred and fifty years of altered coastline, pouring into twenty forty-nine.');
      await game.say(radioId, haleSide ? 'Helix units, Eastway is closed. Water at one point four metres and rising in surges. Nobody walks it.' : 'All units, the Eastway is lost. Anyone on it is on their own.');
      await game.say('kai', haleSide ? 'Hale. It\'s Varen. I\'m on it.' : 'Brandt. It\'s Varen. I\'m on it.');
      await game.say(radioId, haleSide ? 'Of course you are. The surges come every half a minute. Get high when you hear the siren.' : 'Then you\'d better be good at climbing. The surges come every thirty seconds.');
      S.main = false; cine(false); T.unlocked = true; T.refreshHud(); S.phase = 'flood';
      window.__m18.ch3 = { W, jun, pas };
      await game.waitFor(() => pl.pos.z < 30 || S.busy);
      S.firstSurge = true; S.t = S.period * 0.3;
      ui.subtitle('kai', 'Siren. Here it comes. High ground.', 2400);
      // the bus scene when drained: everyone walks out
      await game.waitFor(() => S.drained && !S.busy);
      if (S.jun !== 'none') {
        S.main = true; cine(true);
        await game.shot([P3.bus[0] - 6, 4.6, P3.bus[2] - 4], [P3.bus[0], 3.4, P3.bus[2]], 1.6, { fov: 44 });
        await game.say('jun', 'It\'s going down. It\'s going DOWN. All right, everyone, down the ladder, one at a time. Slowly!');
        for (const c of pas) c.pose = null;
        S.main = false; cine(false);
        const paths = pas.map((c, i) => [[P3.bus[0], 3.22, P3.bus[2] + 5.6], [P3.bus[0] + 0.4, 0, P3.bus[2] + 6.6], [4 + i * 0.7, 0, -96], [3 + i * 0.7, -1.4, -106], [2.5 + i * 0.6, 0, -118], [2 + i * 0.6, 2.4, -132]]);
        Promise.all(pas.map((c, i) => game.wait(i * 1.6).then(() => walkTo(c, paths[i], 1.4)))).then(() => { G.passengers = pas.length + 1; }).catch(() => {});
        game.wait(7).then(() => walkTo(jun, [[P3.bus[0], 3.22, P3.bus[2] + 5.6], [P3.bus[0] + 0.4, 0, P3.bus[2] + 6.6], [3.2, 0, -96], [2.6, -1.4, -106], [2, 0, -118], [1.6, 2.6, -133]], 1.4)).catch(() => {});
        S.jun = 'out';
      }
      await game.waitFor(() => pl.pos.z < P3.exitZ && !S.busy);
      S.main = true; cine(true);
      if (S.jun === 'out') {
        jun.root.position.set(1.6, roadY(-136), -136.6); jun.root.rotation.y = 0; jun.speed = 0;
        await convo(jun, [['jun', 'Seven. All seven. That\'s twice, Varen.'], ['kai', 'Get them to Halden. It\'s high.'], ['jun', 'And you?'], ['kai', 'Helix. The other side of the river, the other side of a lot of things.'],
          ['jun', 'The Corran bridge is down. There\'s nothing over the Varrow south of here but sky.'], ['kai', 'Then I\'ll go through the sky.']]);
      }
      await game.shot([0, 6, -128], [0, 3, -150], 1.4, { fov: 50 });
      audio.sfxPlay('boom'); game.shake = 0.3;
      await game.say('m18band', 'Storm front on the off-ramp. Binding pulled forward. Twenty one ninety-six.');
      await game.say('kai', 'Not again. Not...');
      F.m18eastway = true; F.m18jun = S.jun === 'out' ? 'saved' : 'unmet'; F.m18surges = G.surges; F.m18swept = G.swept; if (F.metJun) F.junSecondRescue = S.jun === 'out';
      await ui.fade(1, 1200);
    }

    // =================================================================================================================
    // IV · THE CORRAN BUILDING — traverse a collapsing future skyscraper
    // =================================================================================================================
    async function chapter4() {
      G.ch = 4; portraits(['witness']);
      const D96 = { id: '2196', key: '3', name: 'FUTURE', year: 'CORRAN · 2196', glyph: '◑', color: '#ffb070', theme: 'm18-tower', apply: () => {} };
      const D49 = { id: '2049', key: '2', name: 'PRESENT', year: 'CORRAN · 2049', glyph: '◎', color: '#5fe6ff', theme: 'm18-office', apply: () => {} };
      const scene = await newPlace({ background: 0x3a2a30, fog: [0x5a4040, 0.012], exposure: 1.05, bloom: 0.55, bloomThreshold: 0.85, envIntensity: 0.7, killY: -12 }, [D49, D96], '2196');
      W = buildTower(game, scene, T); prevRoot.push(W.root); game.onUpdate((dt, t) => W.update(dt, t)); await tick();
      rig(W, {
        '2196': { fog: [0x5a4040, 0.012], env: 0.7, hemi: [0xffb890, 0x2a1e1a, 0.5], sun: [0xff9a60, 2.2], dir: [-0.7, 0.28, 0.4], exp: 1.06, bg: 0x5a4040, beds: { wind: 0.2, hum: 0.02, hz: 38 } },
        '2049': { fog: [0x8a96a2, 0.006], env: 0.9, hemi: [0xe8f0ff, 0x4a4e56, 0.65], sun: [0xe8f0ff, 1.0], dir: [0.4, 0.7, 0.3], exp: 1.0, bg: 0x8a96a2, beds: { hum: 0.04, hz: 60, rain: 0.08 } },
      }, { '2196': { preset: 'sunset', elevation: 5, azimuth: 250, turbidity: 6, cover: 0.62 }, '2049': { preset: 'overcast', elevation: 30, azimuth: 160, cover: 0.9 } });
      themeFor = () => (T.current === '2049' ? 'm18-office' : 'm18-tower');
      fallRule(); rewindRule(W.storm);
      Object.assign(S, { hold: 12, run: 0, runOn: false, ranOut: false, boom: false, crown: false });
      eraRules((id) => (id === '2049' && pl.pos.y > 12 ? 'NO PRESENT SIGNATURE ABOVE THE SECOND FLOOR · THE STORM HAS IT' : null));
      T.onSwitch((id) => { if (id === '2049') S.hold = 12; T.stability = Math.min(1, T.stability + 0.14); });
      // the present holds for 12 s, then lets go
      game.onUpdate(dt => {
        if (T.current !== '2049') return;
        if (game.control && !S.busy) S.hold -= dt;
        if ((S.hold <= 0 || (pl.pos.y > 13.2 && pl.pos.z < -9.55)) && !T.switching) { T.switchTo('2196', { force: true, free: true }); ui.toast(pl.pos.y > 13.2 ? 'THE PRESENT LETS GO' : 'TWELVE SECONDS · THE PRESENT LETS GO', 1800); }
      });
      game.onUpdate(() => {
        if (S.main) { hudSet(null); return; }
        if (T.current === '2049') hudSet([[`2049 HOLDS ${Math.max(0, Math.ceil(S.hold))} s`, S.hold / 12, '#5fe6ff']]);
        else if (S.runOn) hudSet([['THE FLOOR IS GOING · RUN', Math.max(0, 1 - S.run / 11), '#ff8a7a']]);
        else hudSet(null);
      });
      // ---------- the collapse run on the third floor ----------
      const FALLS = [3.0, 5.4, 7.8, 10.2];
      const startRun = () => { S.runOn = true; S.run = 0; musicState.collapse = 0.6; audio.sfxPlay('boom'); game.shake = 0.25; ui.subtitle('kai', 'It\'s going. The whole floor. Run!', 1800); };
      const cpL3 = () => game.checkpoint(0.4, P4.L[3], -10.6, -PI / 2, () => { W.resetSections(); S.runOn = false; S.run = 0; S.ranOut = false; musicState.collapse = 0.2; });
      game.onUpdate(dt => {
        if (S.ranOut) return;
        if (!S.runOn && pl.pos.y > P4.L[3] - 0.3 && pl.pos.y < P4.L[3] + 1 && T.current === '2196' && game.control && !S.busy) { cpL3(); startRun(); }
        if (!S.runOn || !game.control || game._failing) return;
        S.run += dt;
        FALLS.forEach((t, i) => { const s = W.sections[i]; if (S.run > t && !s.fall) { s.fall = 0.001; s.b.enabled = false; audio.sfxPlay('boom'); game.shake = 0.2; G.collapses++; } else if (S.run > t - 0.9 && !s.warned) { s.warned = true; audio.sfxPlay('metal'); } });
        if (pl.pos.y < P4.L[3] - 1.4) { G.runFalls++; game.fail('THE FLOOR WENT FROM UNDER YOU'); return; }
        if (pl.pos.z > 2.2 && pl.pos.y > P4.L[3] + 0.3) { S.runOn = false; S.ranOut = true; musicState.collapse = 0.3; ui.subtitle('kai', 'Made it. Up. Don\'t look down.', 2000); game.checkpoint(-9.5, P4.L[4], 9, PI); }
      });
      // ---------- the memo, the shard, the 2049 office ----------
      act({ pos: [P4.memo[0], P4.L[2] + 1.2, P4.memo[2] + 0.9], radius: 1.7, prompt: 'Read the manifest on the desk', enabled: () => !G.memo, onUse: () => side(async () => {
        G.memo = true; S.main = true; cine(true);
        await closeUp([P4.memo[0], P4.memo[1] + 0.8, P4.memo[2]], [['kai', '"Artefact A. Ring, one unit. Site Zero to the main laboratory. Escort: E. Rook in person."'], ['kai', 'Order thirty-one oh-seven. They moved the ring down the Eastway, over the filled gorge.'], ['kai', 'Helix paid for that fill to carry one thing.']], 1.0, 34);
        ev('Corran & Vey manifest 31/07', 'Consignor Helix Temporal Research: "Artefact A" (the ring), moved from Site Zero to the main laboratory by the Eastway over the Varrow fill, escorted by E. Rook in person. "Do not open, do not log." The fill Helix sponsored was built to carry the Chronolith.', 'The Corran Building · 2196');
        F.m18manifest = true; S.main = false;
      }) });
      shard('on the second floor of the Corran Building', W.shard);
      // ---------- objectives and hints ----------
      const floor = () => (pl.pos.y < 3 ? 0 : pl.pos.y < 7.5 ? 1 : pl.pos.y < 12 ? 2 : pl.pos.y < 17 ? 3 : 4);
      const refreshObj = () => {
        if (S.main) return;
        const f = floor();
        if (pl.pos.z < -12.2 && f >= 3) { objective('Cross the crane boom to the Helix terrace'); return; }
        objective(['Climb the Corran Building: the stair in the east bay', 'First floor: the middle has fallen. Cross it in 2049 (2), and pass the 2049 walls in 2196 (3)', 'Second floor: the north stair to the third floor only exists in 2049', 'Third floor: it is collapsing. Run for the roof stair (west)', 'The roof: the fallen crane boom on the north edge crosses the river'][f]);
      };
      refresh = refreshObj; let oT = 0; game.onUpdate(dt => { oT -= dt; if (oT <= 0) { oT = 1; refreshObj(); } });
      hint(() => floor() === 1 && pl.pos.x > 4, 40, () => ui.subtitle('kai', 'No floor in the middle. The offices are still there in twenty forty-nine. Two.', 3000));
      hint(() => floor() === 1 && pl.pos.x < 0 && pl.pos.x > -6 && T.current === '2049', 20, () => ui.subtitle('kai', 'Glass wall in twenty forty-nine. The beam under me is still there in twenty one ninety-six.', 3000));
      hint(() => floor() === 1 && pl.pos.x < -6, 30, () => ui.subtitle('kai', 'Fire door\'s locked in twenty forty-nine. It\'s gone in twenty one ninety-six. Three.', 2800));
      hint(() => floor() === 2 && T.current === '2196', 45, () => ui.subtitle('kai', 'The north stair. Only the twenty forty-nine flight is still standing.', 2800));
      game.onUpdate(() => {
        if (S.main || S.busy) return;
        const f = floor();
        if (f === 1 && once('cp1')) game.checkpoint(9.6, P4.L[1], -4, -PI / 2);
        if (f === 2 && once('cp2')) game.checkpoint(-9.5, P4.L[2], 5, PI / 2);
        if (f === 4 && once('roof')) roofScene();
        if (pl.pos.z < -24 && pl.pos.y > 12 && !S.crown) crownScene();
      });
      async function roofScene() {
        await side(async () => {
          S.main = true; cine(true);
          await game.shot([-4, P4.L[4] + 2.2, 10], [0, 14, -36], 1.8, { fov: 46 });
          const wit = game.actor('witness', null, 1.6, 12, -42, PI);
          await game.shot([0.6, P4.L[4] + 1.8, -10.6], [1.6, 13.4, -42], 1.6, { fov: 30 });
          await game.say('m18band', 'Second signature on the terrace. Same binding as yours.');
          await game.say('kai', 'You.');
          await tween(1.2, k => { wit.root.position.x = 1.6 + k * 2; }); wit.root.visible = false; G.witnessGlimpse = true; F.m18witnessSeen = true;
          await game.say('kai', 'Gone again. He knew I\'d come this way. He always knows.');
          await game.say('m18band', 'Helix Test Hall C: north-east, three hundred metres. Chronolith signature: unstable.');
          S.main = false;
        });
      }
      async function crownScene() {
        S.crown = true;
        await side(async () => {
          S.main = true; cine(true);
          await game.shot([5, 15, -30], [0, 18, -2], 1.4, { fov: 50 });
          audio.sfxPlay('boom'); game.shake = 0.4; musicState.collapse = 1;
          await tween(game.autoplay ? 1.2 : 3.2, k => { W.crown.position.y = -k * k * 22; W.crown.rotation.x = k * 0.5; });
          W.crown.visible = false;
          await game.say('kai', 'There goes the rest of the Corran Building. Forty floors, and I only ever saw five.');
          S.main = false; musicState.collapse = 0.2;
        });
      }
      // ---------- intro ----------
      S.main = true; game.control = false; ui.letterbox(true);
      pl.place(...P4.start); game.checkpoint(...P4.start);
      await ui.fade(1, 10);
      await game.shot([14, 2, 40], [0, 18, 0], 0.01, { fov: 54 });
      await ui.fade(0, 1800);
      await chapterTitle('IV', 'The Corran Building', 'A future skyscraper, coming down');
      await game.shot([8, 1.6, 34], [0, 20, -2], 4.0, { fov: 54 });
      await game.say('m18band', 'Binding: twenty one ninety-six. Chronolith signature: north, beyond the river.');
      await game.say('kai', 'The bridge is in the river. The Corran Building lost its top thirty floors last night, and what\'s left is still going.');
      await game.shot([-10, 22, 6], [0, 18, -24], 2.4, { fov: 50 });
      await game.say('kai', 'Its roof crane fell across the river onto the Helix terrace. That\'s my bridge. Five floors up.');
      await game.say('m18band', 'Present signature in this building: unstable. Twenty forty-nine will hold for twelve seconds at a time, below the third floor.');
      S.main = false; cine(false); T.unlocked = true; T.refreshHud(); S.phase = 'tower';
      window.__m18.ch4 = { W };
      await game.waitFor(() => pl.pos.z < P4.terraceZ && pl.pos.y > 11 && !S.busy);
      S.main = true; cine(true);
      await game.shot([6, 14, -44], [0, 13, -60], 1.4, { fov: 48 });
      await game.say('kai', 'Helix. Test Hall C is under this terrace.');
      F.m18tower = true; F.m18collapses = G.collapses; F.m18runFalls = G.runFalls;
      await ui.fade(1, 1200);
    }

    // =================================================================================================================
    // V · HELIX TEST HALL C — defend a stabilizer while Sera repairs the Chronolith
    // =================================================================================================================
    async function chapter5() {
      G.ch = 5; portraits(['sera', 'wren', 'joss', 'prefect']);
      const D96 = { id: '2196', key: '3', name: 'FUTURE', year: 'HALL C · 2196', glyph: '◑', color: '#ffd27a', theme: 'm18-defend', apply: () => {} };
      const D49 = { id: '2049', key: '2', name: 'PRESENT', year: 'HALL C · 2049', glyph: '◎', color: '#5fe6ff', theme: 'm18-office', apply: () => {} };
      const scene = await newPlace({ background: 0x2a2430, fog: [0x3a3038, 0.012], exposure: 1.05, bloom: 0.6, bloomThreshold: 0.82, envIntensity: 0.7, killY: -10 }, [D49, D96], '2196');
      W = buildHallC(game, scene, T); prevRoot.push(W.root); game.onUpdate((dt, t) => W.update(dt, t)); await tick();
      rig(W, {
        '2196': { fog: [0x3a3038, 0.012], env: 0.65, hemi: [0xd0b8ff, 0x1e1a20, 0.5], sun: [0xffa070, 1.6], dir: [-0.5, 0.5, 0.5], exp: 1.06, bg: 0x3a3038, beds: { wind: 0.12, hum: 0.04, hz: 41 } },
        '2049': { fog: [0xdce4ea, 0.006], env: 1.0, hemi: [0xf4f8ff, 0x9aa0a6, 0.8], sun: [0xffffff, 0.6], dir: [0.2, 0.9, 0.2], exp: 0.95, bg: 0xdce4ea, beds: { hum: 0.05, hz: 120 } },
      }, { '2196': { preset: 'sunset', elevation: 3, azimuth: 260, turbidity: 7, cover: 0.7 }, '2049': { preset: 'overcast', elevation: 40, azimuth: 160, cover: 0.9 } });
      themeFor = () => (T.current === '2049' ? 'm18-office' : S.fight ? 'm18-defend' : 'm18-tower');
      fallRule();
      Object.assign(S, { fight: false, wave: 0, integ: 1, integ0: 1, rep: 0, stage: 0, allow49: false, collarDone: false, waveList: [], done: false });
      eraRules((id) => (id === '2049' && !S.allow49 ? 'THE STABILIZER HOLDS THIS HALL IN 2196 · STAY WITH IT' : null));
      const A = S.actors;
      A.sera = game.actor('sera', null, ...P5.sera, PI * 0.15); A.sera.pose = 'work'; S.byId.sera = A.sera;
      A.wren = game.actor('wren', null, -5.6, 0, -13.4, PI * 0.25); A.wren.pose = 'look'; S.byId.wren = A.wren;
      A.joss = game.actor('joss', null, 4.0, 0, -13.0, -PI * 0.3); A.joss.pose = 'sit'; S.byId.joss = A.joss;
      for (const ch of [A.sera, A.wren, A.joss]) { ch.root.userData.states = ['2196']; T.only(ch.root, '2196'); }
      await tick();
      // ---------- combat ----------
      const C = new Combat(game, { hp: 5, onDown: () => C.fail('YOU WENT DOWN · THE STABILIZER WAS LEFT ALONE') });
      let echo = null;
      if (F.echoStep !== false) { try { echo = new EchoStep(game, { combat: C, cost: 0.25, cooldown: 5, linger: 4.5 }); echo.unlock(false); } catch (err) { console.warn('m18 echo', err); } }
      const pool = [TROOPER, TROOPER_F, TROOPER, TROOPER_F].map((l, i) => { const ch = game.ambient({ ...l, seed: 1880 + i }, 0, -60, 0, 0); ch.root.visible = false; ch.root.userData.states = ['2196']; return ch; });
      await tick();
      const BARKS = { spot: ['Varen at the instrument!', 'Contact. The architect.', 'There he is.'], search: ['He shifted. Watch the gallery.', 'Lost him behind the crates.'], lost: ['Holding the breach.'], yield: ['Yielding. Yielding!', 'All right. Enough.'] };
      const APPROACH = { n: [2.4, 1.4], w: [-4.2, 5.4], e: [4.4, 7.4], n2: [-2.4, 1.8] };
      const WAVES = [['n', 'w'], ['e', 'w', 'n'], ['n', 'e', 'w', 'n2']];
      const spawnWave = (n) => {
        for (const e of [...S.waveList]) C.removeEnemy(e);
        S.waveList = []; S.wave = n; G.waves = Math.max(G.waves, n);
        WAVES[n - 1].forEach((k, i) => {
          const sp = P5.spawns[k === 'n2' ? 'n' : k], ch = pool[i], off = k === 'n2' ? 2.4 : 0;
          ch.root.position.set(sp[0] + off, 0, sp[2]); ch.root.rotation.y = Math.atan2(-sp[0], -sp[2]); ch.root.visible = true; ch.frozen = false; ch.pose = null; ch.crouch = 0; ch.speed = 0;
          const e = C.addEnemy(ch, { states: ['2196'], patrol: [APPROACH[k]], wait: 3, range: 15, fov: 0.75, speed: 1.7, run: 3.3, keep: 7, rate: 2.6, telegraph: 0.85, stunTime: 8, armed: true, kind: 'trooper', voice: 'm18trooper', barks: BARKS, surrenders: true, shield: n === 2 && k === 'n', name: 'CONTINUUM' });
          S.waveList.push(e);
        });
        audio.sfxPlay('alarm');
      };
      const standing = () => (S.waveList || []).filter(e => !['down', 'surrender'].includes(e.state));
      const cpWave = () => { const ig = Math.max(0.6, S.integ); game.checkpoint(0, 0, 14.5, PI, () => { C.reset({ all: true }); spawnWave(S.wave); S.integ = ig; S.rep = [0, 0, 0.34, 0.67][S.wave] || S.rep; }); };
      // the stabilizer: troopers near it pull its field down; Sera works while it holds
      game.onUpdate(dt => {
        if (!S.fight || game._failing || !game.control || S.busy) return;
        let drain = 0;
        for (const e of standing()) { const p = e.char.root.position; if (['stunned', 'displaced'].includes(e.state)) continue; if (Math.hypot(p.x - P5.spire[0], p.z - P5.spire[2]) < 5.4) drain += 0.017; }
        if (drain) { S.integ = Math.max(0, S.integ - drain * dt); if (once('drainbark' + S.wave)) ui.subtitle('sera', 'They\'re on the stabilizer! Get them off it!', 2200); }
        G.integMin = Math.min(G.integMin, S.integ);
        W.field.material.opacity = 0.03 + S.integ * 0.06; W.spin = 0.4 + (1 - S.integ) * 3;
        if (S.integ <= 0) { game.fail('THE STABILIZER FAILED · THE RING SHOOK ITSELF APART'); return; }
        const cap = [0, 0.34, 0.67, 1.0][S.stage];
        if (T.current === '2196') S.rep = Math.min(cap, S.rep + dt * (standing().length ? 1 / 75 : 1 / 20) * (game.autoplay ? 3 : 1));
        musicState.repair = S.rep;
      });
      game.onUpdate(() => {
        if (S.main || !S.fight) { hudSet(null); return; }
        hudSet([[`STABILIZER ${Math.round(S.integ * 100)} %`, S.integ, S.integ < 0.35 ? '#ff8a7a' : '#ffd27a'], [`CHRONOLITH REPAIR ${Math.round(S.rep * 100)} %`, S.rep, '#9a7bff'], [S.wave ? `WAVE ${S.wave}/3 · STANDING ${standing().length}` : '', null]]);
      });
      const refreshObj = () => {
        if (S.main) return;
        if (!S.fight) { objective('Go down to Sera at the ring'); return; }
        if (S.stage === 2 && !S.collarDone) { objective('Collar C slipped in 2049: switch to 2049 (2) and reseat it at the ring console'); return; }
        if (S.stage === 2 && S.collarDone && T.current === '2049') { objective('Back to 2196 (3): the stabilizer is alone'); return; }
        objective(`Keep the Continuum off the stabilizer while Sera repairs the Chronolith · wave ${S.wave}/3 · stun or displace them, restrain the ones who yield`);
      };
      refresh = refreshObj; let oT = 0; game.onUpdate(dt => { oT -= dt; if (oT <= 0) { oT = 1; refreshObj(); } });
      hint(() => S.fight && standing().length && S.integ < 0.7, 25, () => ui.subtitle('kai', 'The ones at the spire first. Stun, then restrain.', 2600));
      // ---------- the 2049 console, the run sheet, the shard ----------
      act({ pos: [P5.console49[0], 1.2, P5.console49[2] + 0.9], radius: 1.8, states: ['2049'], prompt: 'Reseat collar C at the ring console', hold: 1.4, enabled: () => T.current === '2049' && S.stage === 2 && !S.collarDone, onUse: () => side(async () => {
        S.collarDone = true; G.collar = true; audio.sfxPlay('metal'); audio.sfxPlay('success'); W.consoleScreen.material = W.mats.gold;
        await game.say('m18band', 'Collar C: seated, twenty forty-nine. Causal change carried forward: the ring holds its phase in twenty one ninety-six.');
        await game.say('kai', 'Back. Three. Before they notice the spire\'s alone.');
      }) });
      act({ pos: [P5.log49[0], 1.2, P5.log49[2] + 0.8], radius: 1.6, states: ['2049'], prompt: 'Read the run sheet', enabled: () => T.current === '2049' && !G.log49, onUse: () => side(async () => {
        G.log49 = true;
        await game.say('kai', '"Collar C slipped half a phase at eight fourteen and two tenths. Reseat by hand." Operator on shift: K. Varen.');
        await game.say('kai', 'Me. Eleven days ago. I don\'t remember a slip.');
        ev('Test Hall C run sheet · 19.10.2049', 'At 08:14:00.2, the second after the Zero Second, collar C of the ring slipped half a phase. Operator on shift: K. VAREN. The slip is the crack the storms run through.', 'Test Hall C · 2049');
      }) });
      shard('on the gallery of Test Hall C', W.shard, ['2196']);
      // ---------- intro ----------
      S.main = true; game.control = false; ui.letterbox(true);
      pl.place(...P5.start); game.checkpoint(...P5.start);
      await ui.fade(1, 10);
      await game.shot([16, 10, 30], [0, 3, -10], 0.01, { fov: 52 });
      await ui.fade(0, 1800);
      await chapterTitle('V', 'Test Hall C', 'Hold the field while the ring is mended');
      await game.shot([10, 8, 22], [0, 3.4, -10], 3.2, { fov: 46 });
      await game.say('kai', 'The Chronolith. Cracked right through. And something holding the hall together around it.');
      await game.shot([3, 2.0, -4], [P5.sera[0], 1.4, P5.sera[2]], 1.4, { fov: 40 });
      await game.say('sera', 'You took the long way.');
      pl.place(0, 0, 12, PI);
      await convo(A.sera, [
        ['kai', 'Four floors of one century and a motorway of another.'], ['sera', 'Did you bring it?'], ['kai', 'Joss\'s heart.'],
        ['sera', 'The anchor core. Same metal as the ring\'s couplings, Joss always said. He used to say a lot of things.'],
        ...(G.jossChoice === 'stay' ? [['joss', 'I\'m sitting right here, Voss. Dragged by the collar, but here.']] : [['joss', 'I\'m sitting right here, Voss.']]),
        ['sera', 'Three couplings. I seat them, the ring stops bleeding, the storms lose their door. It takes time.'],
        ['sera', 'That stabilizer is Continuum. We stole it. It\'s the only thing keeping this hall in one year. If they pull it down, the ring shakes itself to bits.'],
      ]);
      G.heart = false;
      await game.say('m18adair', 'Kai Varen. Step away from the instrument. The Continuum will hold one timeline, and that ring is how we hold it.');
      await game.say('kai', 'Your one timeline is coming apart over the whole planet, Prefect.');
      await game.say('m18adair', F.m10released ? 'You let my people walk once. I remember that. It does not change this.' : 'Then it will come apart in one direction. Ours.');
      await game.shot([0, 3, 16], [0, 3, -28], 1.4, { fov: 50 });
      C.giveWeapon(); echo?.unlock(true);
      await game.say('m18band', 'Displacer online. Tap to stun, hold to displace.');
      S.main = false; cine(false); S.fight = true; S.stage = 1; spawnWave(1); cpWave(); refreshObj(); S.phase = 'defend';
      window.__m18.ch5 = { W, C, pool, spawnWave, standing };
      // stage 1 -> collar -> stage 2 -> heart -> stage 3
      await game.waitFor(() => S.rep >= 0.34 && !standing().length && !S.busy && !game._failing);
      S.main = true; cine(true);
      await game.shot([-4, 2.4, -2], [P5.sera[0], 1.4, P5.sera[2]], 1.2, { fov: 40 });
      await game.say('sera', 'First coupling. And now collar C won\'t take. It\'s slipped. Not here, not now. It slipped in your year.');
      await game.say('kai', 'Then I\'ll reseat it there.');
      S.main = false; cine(false); S.stage = 2; S.allow49 = true; refreshObj();
      await game.waitFor(() => S.collarDone && T.current === '2196' && !S.busy);
      S.allow49 = false; spawnWave(2); cpWave();
      ui.subtitle('sera', 'It took! The ring\'s holding phase. Here they come again!', 2400);
      await game.waitFor(() => S.rep >= 0.67 && !standing().length && !S.busy && !game._failing);
      S.main = true; cine(true);
      await game.say('m18adair', 'You stopped them without killing them. You always do, in the versions that matter. It never helps.');
      await game.say('sera', 'Last one. Joss\'s heart. When it seats, the ring will sing, and everything with a Continuum badge for a mile will hear it.');
      S.main = false; cine(false); S.stage = 3; spawnWave(3); cpWave();
      const sup = Array.isArray(F.factionSupport) ? F.factionSupport : [];
      if (sup.length) {
        const a = sup[0]; G.ally = a.id || a.label || 'ally';
        await game.wait(2.5);
        const e = standing()[0]; if (e) C.stun(e, 12);
        ui.subtitle('m18sera', a.faction === 'unwritten' ? 'Lasker\'s sappers on the east breach! He said he owed you one!' : a.faction === 'anja' ? 'Harrow\'s lantern crew! Anja sent them!' : 'People from the Yards! They came!', 3200);
      }
      await game.waitFor(() => S.rep >= 1 && !standing().length && !S.busy && !game._failing);
      // ---------- the ring sings ----------
      S.fight = false; S.main = true; cine(true); C.showHud(false); lockMusic('m18-mira', 2);
      await game.shot([5, 2.2, 0], [0, 3.4, -10], 2.0, { fov: 44 });
      audio.sfxPlay('motif'); audio.sfxPlay('success');
      await tween(3.0, k => { W.ring.userData.disc.material.uniforms.uPower.value = 0.15 + k * 0.85; W.cracks.forEach(c => { c.scale.setScalar(1 - k); }); });
      W.cracks.forEach(c => { c.visible = false; });
      await game.say('sera', 'Done. Three for three. Listen to it.');
      await game.say('m18mira', 'Kai.');
      await game.say('kai', 'Did you hear that?');
      await game.say('m18band', `Pattern detected in the ring: Varen, Mira. ${pattern} percent. The pattern is not here. It is being carried.`);
      await game.shot([0, 2.6, 10], [-30, 40, -120], 2.4, { fov: 40 });
      W.farLight.material.emissiveIntensity = 3.2;
      await game.say('m18band', 'Source: the Helix Long Array, Halcyon Hill. Planetary transmission. Every clock on Earth.');
      await game.say('sera', 'The Long Array. Helix built it to put the whole world on one second. Yours.');
      await game.say('kai', 'That\'s how the storm goes round the planet. And it\'s how she\'s calling.');
      await convo(A.sera, [['sera', 'Then go. I\'ll hold the ring.'], ['kai', 'Sera. Thank you.'], ['sera', trust >= 1 ? 'Don\'t. Come back and I\'ll let you say it properly.' : 'Don\'t thank me. Just don\'t end the world on the way.']]);
      await game.say('m18adair', 'Keep your ring, Varen. When it is finished with you, we will still be here.');
      C.dispose(); echo?.unlock(false); window.__m18.ch5 = null;
      F.chronolithRepaired = true; F.m18stabilizer = Math.round(G.integMin * 100); F.m18waves = 3; F.m18collar = true; F.m18ally = G.ally;
      musicLock = null;
      await ui.fade(1, 1400);
    }

    // =================================================================================================================
    // VI · THE LONG ARRAY — reach a planetary transmission tower; Mira's message
    // =================================================================================================================
    async function chapter6() {
      G.ch = 6; portraits(['m18mira', 'witness', 'sera']);
      const D96 = { id: '2196', key: '3', name: 'FUTURE', year: 'HALCYON · 2196', glyph: '◑', color: '#c8a0ff', theme: 'm18-array', apply: () => {} };
      const D49 = { id: '2049', key: '2', name: 'PRESENT', year: 'ARRAY · 2049', glyph: '◎', color: '#5fe6ff', theme: 'm18-tear', apply: () => {} };
      const scene = await newPlace({ background: 0x1a1630, fog: [0x2a2240, 0.011], exposure: 1.06, bloom: 0.65, bloomThreshold: 0.8, envIntensity: 0.6, killY: -30 }, [D49, D96], '2196');
      W = buildArray(game, scene, T); prevRoot.push(W.root); game.onUpdate((dt, t) => W.update(dt, t)); await tick();
      rig(W, {
        '2196': { fog: [0x2a2240, 0.011], env: 0.55, hemi: [0xb8a0ff, 0x16121e, 0.5], sun: [0xc0a8ff, 0.7], dir: [0.3, 0.55, -0.5], exp: 1.1, bg: 0x2a2240, beds: { wind: 0.24, hum: 0.02, hz: 36 } },
        '2049': { fog: [0x1a2230, 0.008], env: 0.6, hemi: [0x9ab0d0, 0x14181e, 0.5], sun: [0xa0b8ff, 0.5], dir: [0.3, 0.6, 0.4], exp: 1.05, bg: 0x1a2230, beds: { wind: 0.1, hum: 0.05, hz: 60 } },
      }, { '2196': { preset: 'overcast', elevation: 3, azimuth: 300, cover: 0.95 }, '2049': { preset: 'overcast', elevation: 2, azimuth: 120, cover: 0.7 } });
      themeFor = () => (S.mira ? 'm18-mira' : T.current === '2049' ? 'm18-tear' : 'm18-array');
      fallRule(); rewindRule(W.storm);
      eraRules((id) => (id === '2049' && pl.pos.y > 31 ? 'NO PRESENT SIGNATURE ABOVE THE RADOME' : null));
      Object.assign(S, { gustT: 0, gust: false, climbing: false, p1: false, p2: false, p3: false, notes: [0, 0, 0], listened: false, mira: false, solved: false });
      // gusts: every 15 s, 4 s of warning, 3 s of wind
      game.onUpdate(dt => {
        if (!game.control || S.mira) return;
        S.gustT += dt; const c = S.gustT % 15, was = S.gust; S.gust = c > 12; S.warn = c > 8 && c <= 12;
        if (S.gust && !was) { audio.sfxPlay('anomaly'); audio.wind(0.5); game.shake = 0.12; } if (!S.gust && was) audio.wind(0.24);
        if (S.gust && !S.climbing && !S.busy) { const k = pl.pos.y > 10 ? 1.3 : 0.6; pl.pos.x += dt * k; }
        musicState.climb = Math.min(1, pl.pos.y / 44);
      });
      game.onUpdate(() => {
        if (S.main) { hudSet(null); return; }
        const c = S.gustT % 15;
        hudSet([[S.gust ? 'GUST · HOLD ON' : `GUST IN ${Math.max(0, Math.ceil(12 - c))} s`, S.gust ? 1 : c / 12, S.gust ? '#ff8a7a' : '#b6a0ff'], [`HEIGHT ${Math.max(0, Math.round(pl.pos.y))} m`, null]]);
      });
      const climb = (y0, y1, z, endPos, dur) => side(async () => {
        if (S.gust || S.warn) { audio.sfxPlay('fail'); ui.toast('A GUST IS COMING · WAIT FOR THE LULL', 2000); return; }
        S.climbing = true; S.main = true; cine(true);
        pl.yaw = z > 0 ? PI : 0; kai.root.rotation.y = pl.yaw;
        const camZ = z + (z > 0 ? 9 : -9);
        await game.shot([6, (y0 + y1) / 2, camZ], [0, y0 + 1.5, z], 0.6, { fov: 52, follow: pl.pos });
        let ok = true;
        await tween(game.autoplay ? 1.6 : dur, (k) => {
          if (!ok) return;
          if (S.gust && !game.autoplay) { ok = false; return; }
          pl.pos.set(0, y0 + (y1 - y0) * k, z + (z > 0 ? 0.35 : -0.35)); pl.vel.set(0, 0, 0);
        });
        if (!ok) {
          audio.sfxPlay('fail'); ui.toast('THE GUST TORE YOU OFF THE RUNGS · WAIT FOR THE LULL', 2400);
          pl.place(0, y0, z + (z > 0 ? 1.0 : -1.0), pl.yaw);
        } else { pl.place(...endPos); }
        S.climbing = false; S.main = false;
        return ok;
      });
      act({ pos: [0, 1.2, 6.0], radius: 1.8, prompt: 'Climb the ladder to the first platform', enabled: () => pl.pos.y < 2, onUse: async () => { await climb(0.4, P6.P1y, 5.15, [0, P6.P1y, 4.2, PI], 5); if (pl.pos.y > 10) { S.p1 = true; game.checkpoint(0, P6.P1y, 4.2, PI); } } });
      act({ pos: [P6.lift[0], P6.P1y + 1.2, P6.lift[2] + 0.4], radius: 1.8, states: ['2049'], prompt: 'Call the service lift', enabled: () => T.current === '2049' && Math.abs(pl.pos.y - P6.P1y) < 1 && !S.p2, onUse: () => side(async () => {
        S.main = true; cine(true);
        await game.say('m18array', 'Service lift. Operator access only. Identify.');
        await game.say('m18array', 'Band recognised. Operator: K. Varen. Welcome back, Doctor Varen.');
        await game.say('kai', 'Back? I\'ve never been up here.');
        audio.sfxPlay('door'); audio.sfxPlay('metal');
        await tween(game.autoplay ? 1 : 3, k => { W.lift.position.y = 0.4 + k * (P6.P1y - 0.4); });
        pl.place(0, P6.P1y + 0.12, 0, 0);
        await game.shot([9, (P6.P1y + P6.P2y) / 2, 9], [0, P6.P1y + 1.5, 0], 0.8, { fov: 50, follow: pl.pos });
        await tween(game.autoplay ? 1.5 : 5, k => { const y = P6.P1y + k * (P6.P2y - P6.P1y); W.lift.position.y = y; pl.pos.set(0, y + 0.12, 0); pl.vel.set(0, 0, 0); });
        pl.place(0, P6.P2y, 1.8, PI); S.p2 = true; game.checkpoint(0, P6.P2y, 1.8, PI);
        await game.say('m18array', 'Platform two. The crown is sealed under storm protocol.');
        S.main = false;
      }) });
      act({ pos: [0, P6.P2y + 1.2, -3.4], radius: 1.8, states: ['2196'], prompt: 'Climb to the crown', enabled: () => T.current === '2196' && Math.abs(pl.pos.y - P6.P2y) < 1, onUse: async () => { await climb(P6.P2y, P6.P3y, -4.15, [0, P6.P3y, -2.0, PI], 5.5); if (pl.pos.y > 40) { S.p3 = true; game.checkpoint(0, P6.P3y, -1.4, PI); } } });
      // ---------- the crown: three horns, the carrier, the Witness's echo ----------
      const sides = ['west', 'east', 'north'];
      W.horns.forEach((h, i) => {
        W.setDial(i, NOTE_NAMES[S.notes[i]], false);
        act({ pos: [h.pos[0], P6.P3y + 1.0, h.pos[2]], radius: 1.5, prompt: `Tune the ${sides[i]} horn`, enabled: () => S.p3 && !S.solved, onUse: () => {
          S.notes[i] = (S.notes[i] + 1) % 7; const n = S.notes[i]; G.tune++;
          W.setDial(i, NOTE_NAMES[n], n === HORN_OK[i]);
          try { audio.piano(NOTE_MIDI[n], audio.ctx.currentTime, 0.5, 2.2); } catch (err) { void err; }
          ui.toast(`${sides[i].toUpperCase()} HORN · ${NOTE_NAMES[n]}`, 1000);
          if (S.notes.every((v, j) => v === HORN_OK[j])) S.solved = true;
        } });
      });
      const playTune = async () => { for (const n of [64, 71, 69]) { try { audio.piano(n, audio.ctx.currentTime, 0.55, 2.4); } catch (err) { void err; } await game.wait(0.9); } };
      act({ pos: [0.8, P6.P3y + 1.2, 0.8], radius: 1.6, prompt: 'Listen to the carrier', enabled: () => S.p3 && !S.solved, onUse: () => side(async () => {
        S.listened = true;
        await playTune();
        await game.say('kai', 'Three notes, over and over. Low, high, one step down. Low from the west, high from the north, then the east.');
        await game.say('kai', 'Mira\'s tune. The one she hummed at the ring. E, B, A.');
      }) });
      const wEcho = game.actor('witness', null, -1.6, P6.P3y, 0.4, -PI / 2); try { wEcho.setGhost(GHOST_WIT); } catch (err) { void err; } game.residue(wEcho.root); wEcho.pose = 'work';
      act({ pos: [-1.6, P6.P3y + 1.2, 0.4], radius: 1.8, prompt: 'Watch the echo', enabled: () => S.p3 && game.residueOn && !G.witnessEcho, onUse: () => side(async () => {
        G.witnessEcho = true; S.main = true; cine(true);
        await game.shot([-2.6, P6.P3y + 1.75, 2.0], [-1.6, P6.P3y + 1.45, 0.3], 1.2, { fov: 44 });
        await game.say('witness', 'E, on the west. B, on the north. A, on the east. She always started low.');
        await game.say('witness', 'Iteration one thousand and forty-six. She called me up here too. I tuned it. I listened. Then I went back down and tried again.');
        await game.say('kai', 'You heard her. And you still went back to the morning.');
        ev('The Witness on the crown', 'A residue echo on the Long Array\'s crown: the Witness tuning the horns E (west), B (north), A (east). "She called me up here too. I tuned it. I listened. Then I went back down and tried again."', 'The Long Array · 2196');
        F.m18witnessEcho = true; S.main = false;
      }) });
      shard('on the Array\'s first platform', W.shard);
      act({ pos: [P6.booth[0] + 2.6, 1.2, P6.booth[2]], radius: 2.0, prompt: 'Read the plaque on the booth', enabled: () => !G.plaque, onUse: () => side(async () => {
        G.plaque = true;
        await game.say('kai', '"Helix Long Array. Halcyon Hill. One second for every clock on Earth."');
        await game.say('kai', 'Rook\'s idea of a gift. One second. Mine.');
        ev('Helix Long Array plaque', 'Commissioned 2041. "One second for every clock on Earth." The Array keeps the world\'s clocks on Helix time: on 19.10.2049 it carried the Zero Second to the whole planet, and now it carries the storms.', 'Halcyon Hill');
      }) });
      const refreshObj = () => {
        if (S.main) return;
        if (!S.p1) objective('Cross Halcyon Hill to the Long Array · climb the south ladder between gusts');
        else if (!S.p2) objective(T.current === '2049' ? 'Call the service lift (2049) to platform two' : 'The ladder above is gone. In 2049 the Array had a service lift: switch (2)');
        else if (!S.p3) objective(T.current === '2049' ? 'The crown is sealed in 2049. Switch to 2196 (3) and climb the north ladder' : 'Climb the north ladder to the crown between gusts');
        else objective('Tune the three horns to the carrier\'s notes · listen to it, or watch for an echo (Residue Vision F)');
      };
      refresh = refreshObj; let oT = 0; game.onUpdate(dt => { oT -= dt; if (oT <= 0) { oT = 1; refreshObj(); } });
      hint(() => S.p3 && !S.solved && !S.listened, 40, () => ui.subtitle('kai', 'The carrier\'s humming something. Listen to it.', 2600));
      hint(() => S.p3 && !S.solved && S.listened, 60, () => ui.subtitle('kai', 'E on the west horn. B on the north. A on the east.', 3000));
      hint(() => S.p1 && !S.p2 && T.current === '2196', 35, () => ui.subtitle('kai', 'Lift doors. Twenty forty-nine.', 2400));
      // ---------- intro ----------
      S.main = true; game.control = false; ui.letterbox(true);
      pl.place(...P6.start); game.checkpoint(...P6.start);
      await ui.fade(1, 10);
      await game.shot([18, 5, 96], [0, 30, 0], 0.01, { fov: 54 });
      await ui.fade(0, 1800);
      await chapterTitle('VI', 'The Long Array', 'A tower that speaks to every clock on Earth');
      await game.shot([10, 4, 78], [0, 34, 0], 4.2, { fov: 50 });
      await game.say('m18band', 'Helix Long Array. Transmitting. Carrier: three tones. Payload: a pattern.');
      await game.say('kai', 'Forty-four metres of it. And the wind\'s trying to take the hill off the map.');
      if (metSera) await game.say('m18sera', 'Kai, the ring\'s holding. Every storm on my scanner just turned to face your hill.');
      S.main = false; cine(false); T.unlocked = true; T.refreshHud(); refreshObj(); S.phase = 'array';
      window.__m18.ch6 = { W };
      await game.waitFor(() => S.solved && !S.busy);
      // ---------- Mira's message ----------
      S.mira = true; S.main = true; cine(true); lockMusic('m18-mira', 1.5); hudSet(null);
      audio.sfxPlay('motif'); W.beam.material.opacity = 0.8;
      await game.shot([8.5, P6.P3y + 2.6, 8.5], [0, P6.P3y + 7, 0], 2.2, { fov: 54 });
      await game.say('m18band', `Pattern: Varen, Mira. ${pattern} percent. Transmitting on every clock on Earth.`);
      // south side of the crown, clear of the emitter post and the horns: the beam rises behind them
      const mira = game.actor('m18mira', null, 1.5, P6.P3y, 2.0, -PI / 2); S.byId.m18mira = mira;
      try { mira.setGhost(GHOST_MIRA); } catch (err) { void err; }
      pl.place(-1.5, P6.P3y, 2.0, PI / 2);
      audio.silence?.(1.2); await game.wait(0.8); audio.unsilence?.();
      await game.shot([0.3, P6.P3y + 1.8, 5.4], [0, P6.P3y + 1.5, 1.6], 2.0, { fov: 40 });
      await convo(mira, [
        ['m18mira', 'Kai.'],
        ['kai', 'Mira. I found the ring. I found... what\'s in it.'],
        ['m18mira', 'Sixty-one percent. You count me in percentages now.'],
        ['kai', 'I count what I can find.'],
        ['m18mira', 'I remember the first world.'],
        ['kai', 'Which one?'],
        ['m18mira', 'The one before you tried to save me.'],
      ]);
      audio.silence?.(1.6); await game.wait(1.2); audio.unsilence?.();
      await convo(mira, [
        ['kai', 'What was it like?'],
        ['m18mira', 'Ordinary. I was ten. I went under a rope. That was all of it. Everything since is you, trying again.'],
        ['m18mira', 'The storms are the worlds you left open. They\'re looking for somewhere to close.'],
        ['kai', 'Then tell me where.'],
        ['m18mira', 'There\'s a second nobody wrote. Between the ninth and the tenth. The machine skips it every time. That\'s where the rest of me is.'],
        ['m18mira', 'The Unwritten Second. Come and find me there. Not to fix me. To ask me.'],
      ]);
      await game.shot([10, P6.P3y - 6, 18], [0, P6.P3y + 30, -40], 3.0, { fov: 54 });
      audio.sfxPlay('anomaly');
      if (W.unbuilt) { W.unbuilt.visible = true; await tween(3.0, k => W.unbuilt.traverse(o => { if (o.material) o.material.opacity = k * 0.45; })); }
      mira.root.visible = false;
      await game.say('m18band', 'Coordinates received. Nineteenth October, twenty twenty-six. Eight fourteen and nine seconds. Then a second that has no number.');
      await game.say('kai', 'A city in the clouds. Nobody ever built that.');
      if (metSera) {
        await game.say('m18sera', 'Kai. The storms stopped. All of them. For one second every clock on my hill said nothing at all.');
        await game.say('kai', 'She isn\'t in the Chronolith. Not all of her.');
        await game.say('m18sera', 'Then where?');
        await game.say('kai', 'In a second nobody wrote.');
      } else await game.say('kai', 'Not in the Chronolith. Not all of her. In a second nobody wrote.');
      F.m18done = true; F.m18quote = true; F.miraFirstWorld = true; F.unwrittenSecond = true; F.m18miraMessage = true; F.m18array = true;
      F.m18shards = G.shards; F.m18evidence = G.ev.size; F.m18tunes = G.tune;
      await game.shot([24, 8, 40], [0, 40, -20], 5.0, { fov: 54 });
      await ui.fade(1, 2600);
      const mins = Math.round((game.time - tStart) / 60);
      await ui.chapterCard('MISSION 18 COMPLETE', 'The Fracture', `Lantern Hall ${Math.min(34, F.m18evacuated || 34)}/34 out · Jun's bus ${F.m18jun === 'saved' ? 'saved' : '—'} · Chronolith repaired · Evidence ${G.ev.size} · Shards ${G.shards}/7${mins ? ' · ' + mins + ' min' : ''}`, 4400);
    }

    // =================================================================================================================
    // run
    // =================================================================================================================
    try {
      if (startPart <= 1) await chapter1();
      if (startPart <= 2) await chapter2();
      if (startPart <= 3) await chapter3();
      if (startPart <= 4) await chapter4();
      if (startPart <= 5) await chapter5();
      await chapter6();
    } finally {
      hud.remove(); delete T.canSwitch; kai.lookTarget = null; kai.pose = null;
      game.releaseCam(); ui.letterbox(false); audio.allBeds?.(0); audio.setTheme(null);
      window.__m18 = null;
    }
  },
};
