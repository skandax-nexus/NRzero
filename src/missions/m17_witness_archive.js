// MISSION 17 · THE WITNESS'S ARCHIVE (Act III) — explain the original tragedy and the Witness's motive.
// Bible beats: navigate shifting corridors · match recordings to physical evidence · fight security systems that mimic
// Kai's combat behaviour · use temporal echoes to access earlier rooms · reconstruct the original Chronolith experiment.
// Quote: "You kept bringing her back." / "I kept finding a world where she could exist." / "And what happened to those
// worlds?" / "They became the price."
// Ending: Mira's original body died, but an incomplete neural pattern persisted in the Chronolith.
// Site Zero, the sealed level under Helix where the ring was found. In 2196 the Witness has filled it with recordings of
// Kai's lives; in 2049 it is Rook's sealed evidence store; in 2026 (only while an echo lens plays a reel) it is the lab
// of the open day. Kai hears four lives in the Reading Room, gathers what answers them (2049 cages, the Stacks), files
// them at the Concordance, beats mimics that learn his fighting, uses echo lenses to walk rooms that only existed in
// 2026, anchors the echo in Test Hall Zero and rebuilds RUN 01 from the evidence. Then the Witness tells him why.
// Optional: REC 0112 (the father) and REC 0000 (Mira's own reel), four journal pages, six temporal shards, the
// unfiled death certificate, the 2031 seal order, the Witness's coat, the map of the Stacks.
import * as THREE from 'three';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { Combat, combatState } from '../systems/combat.js';
import { EchoStep } from '../systems/echostep.js';
import { buildArchive, registerM17Cast, registerM17Themes, musicState, P, RECS, OBJECTS, CERT, SEAL, SHARDS, JOURNAL, cellOf } from '../world/env_m17.js';

const PI = Math.PI;
const ECHO_I = 40, ECHO_II = 50;
const GHOST = 0xffd8a0, GHOST_MIRA = 0x9a7bff, GHOST_WIT = 0xff6a4a, MIMIC = 0xc8dcff;
const TACTIC = { takedown: 'takedowns from behind', stun: 'stun bolts', displace: 'displacement', decoy: 'echo decoys' };
const COUNTER = { takedown: 'THEY WATCH THEIR BACKS', stun: 'SHIELDS RAISED · DISPLACE OR FLANK', displace: 'ANCHORED · DISPLACE WILL NOT MOVE THEM', decoy: 'THEY IGNORE YOUR ECHO' };

export default {
  id: 'm17', act: 'ACT III · THE LAST VERSION OF EARTH', title: 'The Witness\'s Archive', sub: 'Every version of Kai\'s life',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM17Cast(); registerM17Themes();
    try {
      const need = ['m17kai7', 'm17mira10', 'm17mother', 'm17rook26', 'm17kai19', 'm17nurse', 'm17kai32', 'm17witrec', 'witness', 'sera'].filter(id => !ui.portraits[id] && CAST[id]?.look);
      if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]]))));
    } catch (err) { console.warn('m17 portraits', err); }
    const metWitness = !!(F.metWitness || F.m12witnessSeen), sawPhoto = !!(F.m16photo || F.photoOlderKaiMira), knewBed = !!(F.m11miraFile || F.m11done);
    const iters = F.witnessIterations || 1046;

    const scene = game.newScene({ background: 0x0b0907, fog: [0x16110c, 0.028], exposure: 1.05, bloom: 0.6, bloomThreshold: 0.8, envIntensity: 0.32, killY: -6, residue: true, dark: true });
    await tick();

    // ---------- state ----------
    const S = {
      phase: 'intro', obj: '', seen: {}, ev: new Set(), busy: false, main: false,
      played: [false, false, false, false], got: new Set(), matched: [false, false, false, false], matchMiss: 0, filed: false,
      stacksOpen: false, inStacks: false, layoutsSeen: new Set(),
      wave: 0, waveList: [], tact: { takedown: 0, stun: 0, displace: 0, decoy: 0 }, waveTact: null, counters: [], fightDone: false,
      reels: new Set(), echoT: 0, echoLens: 0, echoes: 0, collapses: 0, anchored: false, sheet: false, breaker: false, keypad: false, keyMiss: 0,
      recon: { console: false, collars: [0, 0, 0], people: new Set(), rope: false }, reconMiss: 0, ran: false, readRing: false,
      shards: 0, journal: new Set(), cert: false, seal: false, coat: false, father: false, miraReel: false, mapRead: false, plate: false,
    };
    const COLLAR_OK = [1, 3, 0];   // II · IV · I
    let musicLock = null, lookReady = false;
    const D96 = { id: '2196', key: '3', name: 'FUTURE', year: 'THE ARCHIVE · 2196', glyph: '◑', color: '#ffb070', theme: 'm17-archive', apply: () => { if (lookReady) applyLook(); } };
    const D49 = { id: '2049', key: '2', name: 'PRESENT', year: 'SITE ZERO · SEALED · 2049', glyph: '◎', color: '#5fe6ff', theme: 'm17-vault', apply: () => { if (lookReady) applyLook(); } };
    const D26 = { id: '2026', key: '1', name: 'PAST', year: 'ECHO · 19.10.2026', glyph: '◐', color: '#ffe9c0', theme: 'm17-echo', apply: () => { if (lookReady) applyLook(); } };
    T.configure([D96, D49, D26], '2196');
    T.unlocked = false;

    const W = buildArchive(game, scene, T);
    game.onUpdate((dt, t) => W.update(dt, t));
    await tick();

    // ---------- where Kai is ----------
    const zone = (p = pl.pos) => {
      if (p.z > -6.2) return p.x > 14 ? 'quarters' : 'hub';
      if (p.z > -30.2) return 'stacks';
      if (p.z > -42.2) return 'sort';
      if (p.z > -70.2) return 'mirror';
      if (p.z < -106.2) return 'zero';
      if (p.x < -8.1) return 'vault';
      if (p.z < -82.2) return 'past';          // the Control Room and the corridor: only in 2026
      return 'ante';
    };
    const inSeal = () => ['ante', 'past', 'vault', 'zero'].includes(zone());
    const echoOpen = () => S.echoT > 0 || (S.anchored && zone() === 'zero');

    // ---------- light: amber reels (2196), strip light (2049), a white lab (2026) ----------
    const hemi = new THREE.HemisphereLight(0xffd8b0, 0x2a2018, 0.35); scene.add(hemi);
    const pts = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    const LOOK = {
      '2196': { fog: [0x16110c, 0.028], hemi: [0xffd8b0, 0x2a2018, 0.42], exp: 1.08, bg: 0x0b0907 },
      '2049': { fog: [0x1a1e22, 0.024], hemi: [0xe8f0ff, 0x30343a, 0.62], exp: 1.0, bg: 0x101316 },
      '2026': { fog: [0xdce4ea, 0.012], hemi: [0xf4f8ff, 0x9aa0a6, 0.85], exp: 0.95, bg: 0xdfe6ec },
    };
    let lookKey = null, lightT = 0;
    function applyLook() {
      const k = T.current; lookKey = k; const L = LOOK[k] || LOOK['2196'];
      scene.fog.color.set(L.fog[0]); scene.fog.density = L.fog[1]; scene.background = new THREE.Color(L.bg);
      hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
      renderer.toneMappingExposure = L.exp;
      audio.hum(k === '2049' ? 0.03 : k === '2026' ? 0.012 : 0.014, k === '2049' ? 60 : k === '2026' ? 120 : 44);
      audio.wind(k === '2196' ? 0.035 : 0);
      lightT = 0; music();
    }
    const rigLights = () => {
      const p = game.cine ? game.engine.camera.position : pl.pos, e = T.current;
      const list = W.lightSrc.filter(s => s.era === e || s.era === 'all').map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      pts.forEach((l, i) => { const s = list[i]; if (!s || s.dd > 36 * 36) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
    };
    game.onUpdate(dt => { lightT -= dt; if (lightT <= 0) { lightT = 0.3; rigLights(); if (T.current !== lookKey) applyLook(); } });
    T.onSwitch(() => { lightT = 0; });

    // ---------- helpers ----------
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag) => { if (S.ev.has(title)) return; S.ev.add(title); ui.addEvidence(title, text, tag); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const choose = (id, text, opts, correct = 0) => { if (game.autoplay) game.autoChoice = game.autoQueue?.length ? game.autoQueue.shift() : correct; return game.choice(id, text, opts); };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive || S.busy) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u)); if (u >= 1) { off(); res(); } }); });
    const side = async (fn) => {
      if (S.busy || !game.control) return; S.busy = true;
      try { await fn(); } catch (err) { if (!err?.abort) console.warn('m17 side', err); else throw err; } finally { S.busy = false; if (!S.main) { game.control = true; ui.letterbox(false); game.releaseCam(); } refreshObjective(); }
    };
    const kai = pl.char;
    const act = (o) => {
      const it = game.interact({ radius: 1.8, ...o, once: false, onUse: (x) => { if (S.busy || game._failing) return; if (o.enabled && !o.enabled()) return; if (o.states && !o.states.includes(T.current)) return; o.onUse(x); } });
      it.done = () => game.removeInteract(it);
      return it;
    };
    const near = (x, z, r) => Math.hypot(pl.pos.x - x, pl.pos.z - z) < r;

    // era switching: 2049 only in the Reading Room and the quarters, 2026 only while an echo plays (the Seal and beyond)
    const solidAt = (id) => {
      const p = pl.pos, y0 = p.y + 0.45, y1 = p.y + 1.6;
      for (const b of game.collision.boxes) {
        if (!b.enabled || (b.states && !b.states.includes(id)) || b.walkOnly) continue;
        if (!(p.x > b.min.x - 0.28 && p.x < b.max.x + 0.28 && p.z > b.min.z - 0.28 && p.z < b.max.z + 0.28)) continue;
        if (b.max.y > y0 && b.min.y < y1) return true;
      }
      return false;
    };
    const allowed = () => {
      const z = zone();
      if (z === 'hub' || z === 'quarters') return S.phase === 'intro' ? [D96] : [D96, D49];
      if (inSeal()) return echoOpen() ? [D96, D26] : [D96];
      return [D96];
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
      if (!allowed().find(d => d.id === id)) return false;
      if (solidAt(id)) { if (once('solid' + id + Math.floor(game.time / 3))) { ui.toast(`SOLID HERE IN ${id} · MOVE TO OPEN FLOOR`, 1800); audio.sfxPlay('fail'); } return false; }
      return true;
    };

    // ---------- music follows the beats and the place ----------
    let curTheme = null;
    const themeFor = () => {
      if (musicLock) return musicLock;
      if (T.current === '2049') return 'm17-vault';
      if (T.current === '2026') return zone() === 'zero' ? 'm17-zero' : 'm17-echo';
      const z = zone();
      if (z === 'stacks') return 'm17-stacks';
      if (z === 'mirror' && S.wave > 0 && !S.fightDone) return 'm17-mimic';
      if (z === 'zero') return 'm17-zero';
      return 'm17-archive';
    };
    function music(fade = 1.6) { const th = themeFor(); for (const d of [D96, D49, D26]) d.theme = th; if (th !== curTheme) { curTheme = th; audio.setTheme(th, fade); } }
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    let musT = 0; game.onUpdate(dt => { musT -= dt; if (musT <= 0) { musT = 0.5; musicState.tension = combatState.threat || 0; music(); } });
    lookReady = true; applyLook();

    // ---------- conversations ----------
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
    const closeUp = async (obj, lines, dist = 0.9, fov = 32) => {
      const p = obj.position.clone ? obj.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(...obj);
      const dx = pl.pos.x - p.x, dz = pl.pos.z - p.z, d = Math.hypot(dx, dz) || 1;
      await game.shot([p.x + dx / d * dist, p.y + 0.75, p.z + dz / d * dist], [p.x, p.y, p.z], 1.1, { fov });
      for (const [id, line] of lines) await game.say(id, line);
    };

    // ---------- people: the recordings' ghosts, the Witness, the mimics ----------
    const ghosts = {};
    const mkGhost = async (id, color, kidH) => {
      const ch = game.actor(id, null, 0, 0, 200, 0); try { ch.setGhost(color); } catch (err) { console.warn('m17 ghost', err); }
      ch.root.visible = false; ch.mode = null; if (kidH) small.add(ch); ghosts[id] = ch; await tick(); return ch;
    };
    await mkGhost('m17kai7', GHOST, true); await mkGhost('m17mira10', GHOST_MIRA, true); await mkGhost('m17rook26', GHOST); await mkGhost('m17mother', GHOST);
    await mkGhost('m17kai19', GHOST); await mkGhost('m17nurse', GHOST); await mkGhost('m17kai32', GHOST); await mkGhost('m17witrec', GHOST_WIT);
    const witness = game.actor('witness', null, P.wDesk0[0] + 0.2, 0, P.wDesk0[2] + 1.0, PI); witness.root.visible = false; witness.mode = null;
    await tick();
    // visibility: 'rec' ghosts live on a booth stage (2196); 'recon' ghosts in Test Hall Zero (2026); the Witness in 2196
    game.onUpdate(() => {
      for (const ch of Object.values(ghosts)) { const v = ch.mode === 'rec' ? T.current === '2196' : ch.mode === 'recon' ? T.current === '2026' : false; if (ch.root.visible !== v) ch.root.visible = v; }
      const wv = witness.mode === 'here' && T.current === '2196'; if (witness.root.visible !== wv) witness.root.visible = wv;
    });
    const stage = (id, x, z, ry, pose = null, mode = 'rec') => { const ch = ghosts[id]; ch.root.position.set(x, 0, z); ch.root.rotation.y = ry; ch.pose = pose; ch.frozen = false; ch.speed = 0; ch.crouch = 0; ch.mode = mode; return ch; };
    const unstage = (...ids) => { for (const id of ids) { const ch = ghosts[id]; ch.mode = null; ch.pose = null; ch.frozen = false; ch.lookTarget = null; } };

    // ---------- HUD: the echo timer and the Stacks layout ----------
    const hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;right:calc(22px + var(--sr,0px));top:calc(120px + var(--st,0px));padding:8px 12px;border-radius:6px;background:rgba(10,8,6,.55);border:1px solid rgba(255,200,140,.35);color:#ffe2b8;font:600 12px/1.45 var(--ui,system-ui);letter-spacing:.16em;pointer-events:none;opacity:0;transition:opacity .4s;text-align:right;min-width:150px';
    (document.getElementById('hud') || document.body).appendChild(hud);
    const bar = '<div style="height:4px;margin-top:5px;background:rgba(255,255,255,.12);border-radius:2px"><div class="m17bar" style="height:4px;width:0;background:#ffd27a;border-radius:2px"></div></div>';
    let hudKey = '';
    game.onUpdate(() => {
      let txt = '', frac = -1;
      if (S.anchored && zone() === 'zero') txt = 'ECHO · 19.10.2026<br>ANCHORED';
      else if (S.echoT > 0) { txt = `ECHO · 19.10.2026<br>${Math.ceil(S.echoT)} s`; frac = S.echoT / (S.echoLens === 2 ? ECHO_II : ECHO_I); }
      else if (zone() === 'stacks' && W.stacks.running) { const left = Math.ceil(W.stacks.period - W.stacks.t); txt = `STACKS · LAYOUT ${W.stacks.layout}<br>${W.stacks.next} IN ${left} s`; frac = 1 - W.stacks.t / W.stacks.period; }
      const show = !!txt && !game.cine && !ui.dlgActive;
      hud.style.opacity = show ? 1 : 0;
      const key = txt + (frac >= 0 ? '|b' : '');
      if (key !== hudKey) { hudKey = key; hud.innerHTML = txt + (frac >= 0 ? bar : ''); }
      if (frac >= 0) { const b = hud.querySelector('.m17bar'); if (b) b.style.width = Math.round(frac * 100) + '%'; }
    });

    // ---------- objectives ----------
    const nPlayed = () => S.played.filter(Boolean).length, nMatched = () => S.matched.filter(Boolean).length;
    const hubItems = ['run01', 'run00', 'green', 'black'];
    const nHub = () => hubItems.filter(k => S.got.has(k)).length;
    const missingRecon = () => {
      const r = S.recon, out = [];
      if (!r.console) out.push('set RUN 01 at the console');
      if (r.collars.some((v, i) => v !== COLLAR_OK[i])) out.push('turn the collar dials to the run\'s phases');
      if (!r.rope) out.push('unhook the rope as it was');
      if (r.people.size < 4) out.push(`restore where everyone stood (Residue Vision F, ${r.people.size}/4)`);
      return out;
    };
    function refreshObjective() {
      if (S.main) return;
      switch (S.phase) {
        case 'hub': {
          if (S.stacksOpen) { objective(`Cross the shifting Stacks to the Sorting Room (out at C4) · find what answers REC 0233 and REC 1046 (${['pass38', 'pass26', 'notched', 'newband'].filter(k => S.got.has(k)).length}/4)`); break; }
          const parts = [];
          if (nPlayed() < 4) parts.push(`Play the four recordings in the booths (${nPlayed()}/4)`);
          if (nHub() < 4) parts.push(`Search Rook's evidence cages in 2049 (${nHub()}/4)`);
          objective(parts.length ? parts.join(' · ') : 'The Stacks door is open: cross the Stacks to the Sorting Room');
          break;
        }
        case 'sort': objective(S.filed ? 'Take the reel from the Concordance, then go through to the Mirror Hall' : `Match each recording to its physical evidence at the Concordance (${nMatched()}/4)`); break;
        case 'mirror': objective(S.fightDone ? 'Go through the gate to the Seal' : S.wave ? `Stop the mimics · wave ${S.wave}/3 · they learn how you fight` : 'Cross the Mirror Hall'); break;
        case 'seal': {
          if (zone() === 'zero' || S.keypad) { objective(S.anchored ? 'Reconstruct RUN 01 in 2026' : 'Reach Test Hall Zero · anchor the echo at the master lens (2196)'); break; }
          if (S.echoT <= 0) objective(S.echoes ? 'Replay an echo at a lens (2196), then switch to 2026 (1)' : 'Load the reel into Echo Lens I · then switch to 2026 (1) while it plays');
          else objective(`2026 is open for ${Math.ceil(S.echoT)} s · ${!S.sheet ? 'read the run sheet in the Control Room' : !S.breaker ? 'restore corridor power in the Cable Vault (CV-3)' : 'open the corridor door'}`);
          break;
        }
        case 'zero': {
          if (!S.anchored) { objective('Anchor the echo: play the first recording at the master lens (2196)'); break; }
          if (S.ran && !S.readRing) { objective('Read the ring\'s memory'); break; }
          const m = missingRecon(); objective(m.length ? 'Reconstruct RUN 01 (2026): ' + m.join(' · ') : 'Run the reconstruction at the console');
          break;
        }
        default: break;
      }
    }
    let objT = 0; game.onUpdate(dt => { objT -= dt; if (objT <= 0) { objT = 1; refreshObjective(); } });

    // ---------- the recordings ----------
    const playDeck = (i, on) => { const b = W.booths[i]; if (b) b.ring.material = on ? W.mats.red : W.mats.amber; };
    const recShot = (i, fov = 40) => { const [sx, sz] = P.stage[i]; return game.shot([sx + 5.4, 1.9, sz + 1.6], [sx - 0.4, 1.2, sz], 1.6, { fov }); };
    const playRec = (i) => side(async () => {
      S.main = true; cine(true); lockMusic(i === 3 ? 'm17-witness' : 'm17-record', 1.2); playDeck(i, true); audio.sfxPlay('rewind');
      const [sx, sz] = P.stage[i];
      if (i === 0) {
        stage('m17rook26', sx + 1.6, sz - 1.6, -PI / 2 - 0.4, 'work'); stage('m17mother', sx - 1.2, sz + 1.6, PI / 2 + 0.3);
        stage('m17kai7', sx - 0.3, sz + 0.5, PI / 2); stage('m17mira10', sx + 0.3, sz - 0.1, PI / 2 + 0.2);
        await recShot(i);
        await game.say('m17label', 'Recording zero zero zero one. The ring\'s own pickup. Site Zero, the nineteenth of October, twenty twenty-six.');
        await game.shot([sx + 3.4, 1.7, sz - 2.6], [sx + 1.6, 1.5, sz - 1.6], 1.2, { fov: 34 });
        await game.say('m17rook26', 'Field at four point one. Stable. Run one, start oh-eight-fourteen-oh-two.');
        await game.say('m17mother', 'Kai, hold your sister\'s hand. Stay behind the rope.');
        await game.shot([sx + 2.2, 1.2, sz + 0.6], [sx, 1.0, sz + 0.2], 1.2, { fov: 34 });
        ghosts.m17mira10.lookTarget = ghosts.m17kai7.head;
        await game.say('m17mira10', 'Kai. It\'s singing. Can you hear it?'); audio.sfxPlay('motif');
        await game.say('m17kai7', 'Mira, the rope! Mum said...');
        await game.say('m17mira10', 'Just one look. Hold on to me.');
        ghosts.m17mira10.pose = 'look'; ghosts.m17mira10.root.position.x += 0.4;
        await game.shot([sx + 3.4, 1.7, sz - 2.6], [sx + 1.6, 1.5, sz - 1.6], 0.8, { fov: 34 });
        await game.say('m17rook26', 'Who let a child past the... Abort! Cut the field!');
        audio.sfxPlay('anomaly'); game.shake = 0.05;
        ghosts.m17mira10.pose = 'fall'; ghosts.m17kai7.pose = 'sad'; ghosts.m17mother.pose = 'sad';
        await game.say('m17rook26', 'Abort at oh-eight-fourteen-eleven. Get the lights up. Get the lights up!');
        await recShot(i, 44);
        await game.say('m17label', `I have played this ${iters === 1046 ? 'one thousand and forty-six' : iters} times. It never ends differently.`);
        await game.say('kai', 'Run one. Abort at eight-fourteen and eleven seconds. Rook at the console. And me, holding her hand.');
        ev('REC 0001 · The First Morning', 'Site Zero, 19.10.2026. RUN 01 started 08:14:02, field 4.1 kHz. Mira slipped under the rope and reached into the ring holding Kai\'s hand. Rook aborted at 08:14:11.', 'Recording');
        unstage('m17rook26', 'm17mother', 'm17kai7', 'm17mira10');
      } else if (i === 1) {
        stage('m17kai19', sx - 0.2, sz + 0.7, PI / 2 + 0.6); stage('m17nurse', sx + 0.9, sz - 0.4, -PI / 2 - 0.6);
        faceEach(ghosts.m17kai19, ghosts.m17nurse);
        await recShot(i);
        await game.say('m17label', 'Recording zero two three three. Halden General, Ward Four. The third of November, twenty thirty-eight.');
        await ots(ghosts.m17kai19, ghosts.m17nurse);
        await game.say('m17kai19', 'Mira Varen. Ten years old. She was brought here on the nineteenth of October, twenty twenty-six.');
        await ots(ghosts.m17nurse, ghosts.m17kai19);
        await game.say('m17nurse', 'There\'s no Varen on this ward, love. There never was.');
        await ots(ghosts.m17kai19, ghosts.m17nurse);
        await game.say('m17kai19', 'Then why is bed four-oh-seven made? Why does the board say occupied?');
        await ots(ghosts.m17nurse, ghosts.m17kai19);
        await game.say('m17nurse', 'Visiting\'s over. I\'ll stamp your pass.'); audio.sfxPlay('metal');
        await game.say('m17nurse', 'No admission. In red, see? Don\'t come back.');
        await ots(ghosts.m17kai19, ghosts.m17nurse);
        await game.say('m17kai19', 'I\'ll keep it. So I know I was here.');
        await recShot(i, 44);
        await game.say('m17label', 'He was nineteen. He kept the pass. So did I.');
        await game.say('kai', knewBed ? 'Bed four-oh-seven. It was waiting for her even then. A pass from November thirty-eight, stamped in red.' : 'I never went to Halden. Not in this life. A pass from November thirty-eight, stamped in red.');
        ev('REC 0233 · The Boy Who Went to Halden', 'A Kai of nineteen at Halden General, Ward 4, 03.11.2038. No Varen on the ward, bed 4-07 made and "occupied". The nurse stamped his pass NO ADMISSION in red; he kept it.', 'Recording');
        unstage('m17kai19', 'm17nurse');
      } else if (i === 2) {
        stage('m17kai32', sx, sz, PI / 2, 'work');
        await recShot(i);
        await game.say('m17label', 'Recording zero six four oh. World zero six four oh. March, twenty forty-nine.');
        await game.shot([sx + 1.8, 1.6, sz + 0.9], [sx, 1.4, sz], 1.2, { fov: 32 });
        await game.say('m17kai32', 'Dear Doctor Rook. I resign, effective today.');
        await game.say('m17kai32', 'I will not build the machine.');
        await game.say('m17kai32', 'Mum\'s pen. Green ink. She\'d have laughed at me.');
        await recShot(i, 44);
        await game.say('m17label', 'He refused. He never sent it. The Fracture came anyway, eleven years later, from somebody else\'s hands.');
        await game.say('kai', 'Green ink. Mum\'s pen. It\'s in my desk at Helix. I wrote that letter in March. I never sent it either.');
        ev('REC 0640 · The Engineer Who Said No', 'World 0640, March 2049: a Kai writes his resignation to Rook, "I will not build the machine", in his mother\'s green ink. Never sent. The Fracture came anyway.', 'Recording');
        unstage('m17kai32');
      } else {
        stage('m17witrec', sx, sz, PI / 2, 'work');
        await recShot(i);
        await game.shot([sx + 1.9, 1.7, sz - 0.8], [sx, 1.5, sz], 1.2, { fov: 32 });
        await game.say('m17witrec', `Iteration ${iters === 1046 ? 'one thousand and forty-six' : iters}. Room zero zero zero one.`);
        await game.say('m17witrec', 'I tried the rain. The fever. The hospital. I tried being someone else.');
        await game.say('m17witrec', 'Every time, she reaches. Every time, it ends at eight-fourteen.');
        ghosts.m17witrec.pose = 'sad'; audio.sfxPlay('metal');
        await game.say('m17witrec', 'One more notch.');
        await game.say('m17witrec', 'Next time I won\'t change the morning. I\'ll change him.');
        await recShot(i, 44);
        await game.say('kai', metWitness ? '"Him." He means me. The man from Chamber Two has been keeping score with a knife.' : '"Him." He means me. Somebody old enough to be my father, with my voice, keeping score with a knife.');
        ev('REC 1046 · The Last Try', 'The Witness, recorded in Room 0001: 1,046 iterations; he scratches a notch into his band for each. "Next time I won\'t change the morning. I\'ll change him."', 'Recording');
        unstage('m17witrec');
      }
      playDeck(i, false); S.played[i] = true; musicLock = null;
      if (nPlayed() === 4 && once('all4')) { await game.say('kai', 'Four lives. Each one left something behind. Rook kept half of it in a cage. He kept the rest.'); }
      S.main = false; cine(false);
      checkStacksDoor();
    });
    RECS.forEach((rec, i) => {
      const [bx, bz] = P.booths[i];
      act({ pos: [bx + 0.6, 1.1, bz], radius: 1.9, states: ['2196'], prompt: `Play REC ${rec.num} · ${rec.title}`, enabled: () => !S.played[i], onUse: () => playRec(i) });
      act({ pos: [bx + 0.6, 1.1, bz], radius: 1.9, states: ['2196'], prompt: `Replay REC ${rec.num}`, enabled: () => S.played[i] && S.phase !== 'intro', onUse: () => { S.played[i] = false; playRec(i); } });
    });

    // ---------- physical evidence ----------
    const takeItem = (key, extra) => side(async () => {
      const o = OBJECTS[key], m = W.items[key];
      S.main = true; cine(true);
      await closeUp(m, []);
      await game.say('kai', extra || o.title + '.');
      ui.toast(o.text, 5200);
      await game.say('m17band', o.text);
      ev(o.title, o.text, o.era === '2049' ? 'Site Zero · 2049' : 'The Archive · 2196');
      S.got.add(key); m.visible = false; audio.sfxPlay('pickup');
      S.main = false; cine(false);
      checkStacksDoor();
    });
    const ITEM_LINES = {
      run01: 'Run one. Nineteenth of October. Somebody wrote "visitor inside rope" in the margin, and nothing else.',
      run00: 'A dry run the day before. Same field. No abort. Nobody inside the rope.',
      green: 'Green ink. My handwriting.',
      black: 'Rook, closing the case. Black ink, a firm hand.',
      pass38: 'My face at nineteen. NO ADMISSION, in red.',
      pass26: 'Mum\'s pass. The same day. Admitted at nine-forty. Admitted to what?',
      notched: 'Notches in rows of ten. Someone counted with a blade.',
      newband: 'A clean band. Never worn. Nobody counted anything on this one.',
    };
    for (const key of Object.keys(OBJECTS)) {
      const m = W.items[key], o = OBJECTS[key]; if (!m) continue;
      act({ pos: [m.position.x, m.position.y, m.position.z], radius: 1.7, states: [o.era], prompt: 'Examine · ' + o.title, enabled: () => !S.got.has(key), onUse: () => takeItem(key, ITEM_LINES[key]) });
    }
    // optional 2049: the death certificate (cage C) and the seal order (the annex)
    act({ pos: [W.items.cert.position.x, 1.4, W.items.cert.position.z], radius: 1.7, states: ['2049'], prompt: 'Examine · a registry form, never filed', enabled: () => !S.cert, onUse: () => side(async () => {
      S.main = true; cine(true); await closeUp(W.items.cert, []);
      await game.say('kai', 'A death certificate. Her name. Her age. Eight-fourteen and nine seconds.');
      await game.say('kai', 'Cause: blank. "Do not file." That\'s why Halden has no date of death. Rook never let anyone write it down.');
      ev(CERT.title, CERT.text, 'Site Zero · 2049'); S.cert = true; W.items.cert.visible = false; F.m17certificate = true;
      S.main = false; cine(false);
    }) });
    act({ pos: [21.4, 1.6, 14.6], radius: 1.8, states: ['2049'], prompt: 'Read the order on the wall', enabled: () => !S.seal, onUse: () => side(async () => {
      S.main = true; cine(true); await closeUp(W.sealDoc, [['kai', 'Order thirty-one oh seven. Seal Site Zero. Move the ring upstairs. Don\'t catalogue the second one.'], ['kai', '"Records of RUN 01 are to be stored, not destroyed." He couldn\'t bring himself to burn it.']], 1.0);
      ev(SEAL.title, SEAL.text, 'Site Zero · 2049'); S.seal = true; F.m17sealOrder = true; S.main = false; cine(false);
    }) });

    // ---------- the Stacks door ----------
    const stacksDoor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.6, metalness: 0.5 }));
    stacksDoor.position.set(-3, 1.8, -6); T.only(stacksDoor, '2196'); scene.add(stacksDoor);
    const stacksBox = game.collision.add([-4.2, 0, -6.25], [-1.8, 3.6, -5.75], { states: ['2196'] });
    const stacksPlate = act({ pos: [-3, 1.4, -5.2], radius: 1.8, states: ['2196'], prompt: 'Read the plate on the Stacks door', enabled: () => !S.stacksOpen, onUse: () => side(async () => {
      S.plate = true;
      await game.say('m17label', 'Listen to all four. Then bring what answers them. The answers are not all in this year.');
      await game.say('kai', nPlayed() < 4 ? 'Four recordings first.' : 'Rook\'s cages. In 2049 this room is his evidence store.');
    }) });
    async function checkStacksDoor() {
      if (S.stacksOpen || nPlayed() < 4 || nHub() < 4) return;
      S.stacksOpen = true; stacksPlate.done();
      await game.waitFor(() => !S.busy && game.control && !ui.dlgActive);
      S.busy = true; S.main = true;
      try {
        if (T.current !== '2196') await T.switchTo('2196', { force: true, free: true });
        cine(true);
        await game.shot([-0.6, 2.2, -1.4], [-3, 1.8, -6], 1.4, { fov: 46 });
        audio.sfxPlay('door'); audio.sfxPlay('metal');
        await tween(2.2, k => { stacksDoor.position.y = 1.8 + k * 3.7; });
        stacksBox.enabled = false; W.stacks.running = true;
        await game.shot([-3, 2.0, -3.2], [-3, 1.2, -12], 1.8, { fov: 50 });
        await game.say('kai', 'Shelves on rails. They move.');
        await game.say('m17band', 'The walls of the Stacks change every sixteen seconds. Three layouts, in turn. The floor slots glow before a wall moves.');
        await game.say('kai', 'He wants me to bring the answers through his maze. Fine.');
        game.checkpoint(-3, 0, -4.4, PI);
      } finally { S.main = false; S.busy = false; cine(false); }
      S.phase = 'hub'; refreshObjective();
    }

    // ---------- the Stacks ----------
    W.stacks.onShift = (k) => {
      audio.sfxPlay('metal'); if (zone() === 'stacks') { game.shake = Math.max(game.shake, 0.03); audio.sfxPlay('door'); }
      S.layoutsSeen.add(k);
    };
    act({ pos: [P.lectern[0], 1.2, P.lectern[2]], radius: 1.8, states: ['2196'], prompt: 'Read the map on the lectern', enabled: () => !S.mapRead, onUse: () => side(async () => {
      S.mapRead = true;
      await game.say('kai', 'His map. A, B, C. In at B1, out at C4. The far corners only open one layout at a time.');
      await game.say('kai', '"Wait in a cell. The walls move. You do not have to."');
      ev('The map of the Stacks', 'Three layouts in turn (A → B → C, 16 s each). A opens the west run to A4. B opens the front row east to D2 and C4 → D4. C opens the middle, B2 → D2, and the way down to C4. Out at C4.', 'The Archive · 2196');
    }) });
    act({ pos: [-5.6, 1.6, -5.2], radius: 1.6, states: ['2196'], prompt: 'Study the Witness\'s map by the door', enabled: () => !S.mapRead, onUse: () => side(async () => {
      S.mapRead = true;
      await game.say('kai', 'A map of the Stacks. Three layouts, turning. In at B1, out at C4. Wait in a cell when the way is shut.');
      ev('The map of the Stacks', 'Three layouts in turn (A → B → C, 16 s each). A opens the west run to A4. B opens the front row east to D2 and C4 → D4. C opens the middle, B2 → D2, and the way down to C4. Out at C4.', 'The Archive · 2196');
    }) });
    act({ pos: [W.items.reel0000.position.x, 1.0, W.items.reel0000.position.z], radius: 1.7, states: ['2196'], prompt: 'Play the small reel · REC 0000', enabled: () => !S.miraReel, onUse: () => side(async () => {
      S.main = true; cine(true); lockMusic('m17-record', 1.0); S.miraReel = true; W.items.reel0000.visible = false;
      const [x, , z] = P.cell(3, 3);
      stage('m17mira10', x - 0.6, z - 0.8, PI * 0.25); stage('m17kai7', x + 0.5, z - 1.2, -PI * 0.25);
      await game.shot([x + 1.8, 1.4, z + 1.6], [x, 1.0, z - 1.0], 1.4, { fov: 40 });
      audio.sfxPlay('motif');
      await game.say('m17mira10', 'Kai? Is it recording? ...Okay.');
      await game.say('m17mira10', 'This is Mira Varen, age ten, and this is my brother, who is seven and annoying.');
      await game.say('m17kai7', 'Am not.');
      await game.say('m17mira10', 'If you find this when you\'re old, I hope you\'re happy. That\'s all. Bye.');
      await game.say('m17label', 'The only recording here I did not make.');
      await game.say('kai', 'Her phone. The summer before. I\'d forgotten she ever did that.');
      ev('REC 0000 · Mira\'s own reel', 'A family recording from summer 2026: Mira, ten, and Kai, seven. "If you find this when you\'re old, I hope you\'re happy." The Witness kept it apart from the rest.', 'Optional');
      F.m17miraReel = true; unstage('m17mira10', 'm17kai7'); musicLock = null; S.main = false; cine(false);
    }) });

    // ---------- the quarters (optional) ----------
    act({ pos: [P.qBooth[0], 1.1, P.qBooth[2]], radius: 1.7, states: ['2196'], prompt: 'Play REC 0112 · The Father', enabled: () => !S.father, onUse: () => side(async () => {
      S.main = true; cine(true); lockMusic('m17-record', 1.0); S.father = true;
      const [x, , z] = P.quarters;
      stage('m17kai32', x - 0.2, z - 0.6, PI * 0.15, 'sit'); stage('m17mira10', x + 0.5, z + 0.4, PI + 0.6);
      await game.shot([x + 2.4, 1.6, z - 2.0], [x, 1.0, z], 1.4, { fov: 40 });
      await game.say('m17label', 'Recording zero one one two. Calder Row, twenty forty-seven. Kept. Not for study.');
      await game.say('m17kai32', 'Mira. Bedtime.');
      await game.say('m17mira10', 'Tell me about Aunt Mira again.');
      await game.say('m17kai32', 'She was brave. Braver than me. She hummed when she was scared.');
      await game.say('m17mira10', 'Like this?'); audio.sfxPlay('motif');
      await game.say('m17kai32', 'Exactly like that.');
      await game.say('m17label', 'In world zero one one two he named his daughter after her. World zero one one two lasted nine years.');
      await game.say('kai', 'He had a whole life. A child. And he spent it again.');
      ev('REC 0112 · The Father', 'World 0112, 2047: a Kai with a daughter named Mira, after his sister. The world lasted nine years before the Witness moved on.', 'Optional');
      F.m17father = true; unstage('m17kai32', 'm17mira10'); musicLock = null; S.main = false; cine(false);
    }) });
    act({ pos: [21.4, 1.4, 17.2], radius: 1.6, states: ['2196'], prompt: 'Look at the coat on the hook', enabled: () => !S.coat, onUse: () => side(async () => {
      S.coat = true; F.m17coat = true;
      await game.say('kai', 'My jacket. Twenty-five years older. Patched at the elbow with something blue.');
      await game.say('kai', 'The cuff from the coat. The one torn on the ring. He sewed it on.');
      ev('The Witness\'s coat', 'Kai\'s own jacket, decades older. Patched at the left elbow with a scrap of blue wool: the cuff torn from a child\'s coat on 19.10.2026.', 'Optional');
    }) });

    // ---------- journal pages and shards ----------
    JOURNAL.forEach((j, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0xe6dcc2, roughness: 0.9, emissive: 0x3a2a1a, emissiveIntensity: 0.3 }));
      m.rotation.x = -PI / 2; m.rotation.z = 0.3; m.position.set(...j.p); if (j.era) T.only(m, j.era); scene.add(m);
      act({ pos: j.p, radius: 1.6, states: j.era ? [j.era] : null, prompt: 'Read the journal page', enabled: () => !S.journal.has(i), onUse: () => side(async () => {
        S.journal.add(i); m.visible = false; if (m.userData.states) m.userData.states = ['none'];
        audio.sfxPlay('pickup'); ui.toast('THE WITNESS\'S JOURNAL ' + S.journal.size + '/4', 2200);
        await game.say('m17label', j.text.replace(/^"|"$/g, ''));
        ev('Journal page · ' + j.where, j.text, 'The Witness');
      }) });
    });
    const shardMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x5fe6ff, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.3 });
    const shardMeshes = SHARDS.map((s, i) => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), shardMat); m.position.set(...s.p); if (s.era) T.only(m, s.era); scene.add(m);
      act({ pos: s.p, radius: 1.5, states: s.era ? [s.era] : null, prompt: 'Take the temporal shard', enabled: () => !m.userData.got, onUse: () => {
        if (m.userData.got) return; m.userData.got = true; m.visible = false; if (m.userData.states) m.userData.states = ['none'];
        S.shards++; F.shards = (F.shards || 0) + 1; audio.sfxPlay('pickup'); ui.toast(`TEMPORAL SHARD ${S.shards}/6 · ${s.where.toUpperCase()}`, 2400);
        void i;
      } });
      return m;
    });
    game.onUpdate((dt, t) => { for (const m of shardMeshes) if (m.visible) { m.rotation.y += dt * 1.2; m.position.y = SHARDS[shardMeshes.indexOf(m)].p[1] + Math.sin(t * 2 + m.position.x) * 0.06; } });

    // ---------- the Concordance ----------
    const fileOne = async (i) => {
      const rec = RECS[i], have = [...S.got].filter(k => OBJECTS[k]);
      const truth = rec.obj;
      if (!S.got.has(truth)) {
        await game.say('kai', `REC ${rec.num}. I haven't found what answers it yet. ${i === 1 || i === 3 ? 'It must be somewhere in the Stacks.' : 'It should be in Rook\'s cages, in 2049.'}`);
        return false;
      }
      // options: the candidates Kai holds, the true one and its decoy first, at most four
      const pairs = { run01: 'run00', green: 'black', pass38: 'pass26', notched: 'newband' };
      let opts = [truth, pairs[truth]].filter(k => S.got.has(k));
      for (const k of have) if (!opts.includes(k) && opts.length < 4 && !S.matched.some((m, j) => m && RECS[j].obj === k)) opts.push(k);
      opts = opts.slice(0, 4);
      const order = [...opts].sort((a, b) => OBJECTS[a].short.localeCompare(OBJECTS[b].short));
      const pick = await choose('kai', `REC ${rec.num} · ${rec.title}. Which piece of evidence answers it?`, order.map(k => OBJECTS[k].short), order.indexOf(truth));
      const k = order[pick];
      if (k === truth) {
        S.matched[i] = true; audio.sfxPlay('success');
        const tr = W.trays[i]; tr.lamp.material = W.mats.amber; const m = W.items[truth]; m.visible = true; m.position.set(tr.x, 1.05, tr.z); m.rotation.set(m.rotation.x, 0.2, 0); if (m.parent !== W.groups['2196']) W.groups['2196'].add(m);
        const why = [
          'RUN 01: started 08:14:02, aborted 08:14:11, "visitor inside rope". The dry run had no abort and no visitor.',
          'November 2038, stamped NO ADMISSION in red. Mum\'s pass is from 2026 and says admitted.',
          'Green ink, my resignation. Rook\'s letter is black and it closes the case instead.',
          'One thousand and forty-six notches. He scratches one for every try. The new band has none.',
        ][i];
        await game.say('kai', why);
        return true;
      }
      S.matchMiss++; audio.sfxPlay('fail');
      const why = {
        run00: 'No. The recording has an abort, at eight-fourteen and eleven. The dry run never aborted, and nobody was inside the rope.',
        black: 'No. The voice in the recording says green ink, his mother\'s pen. This one is black, and it\'s Rook\'s.',
        pass26: 'No. The boy in the recording was nineteen and stamped NO ADMISSION. This pass is Mum\'s, from 2026, admitted.',
        newband: 'No. He scratches a notch for every try. This band has never been worn.',
      }[k] || `No. That belongs to another recording. REC ${rec.num} needs something it actually mentions.`;
      await game.say('kai', why);
      return false;
    };
    const conc = act({ pos: [P.conc[0], 1.1, P.conc[2] + 1.0], radius: 2.2, states: ['2196'], prompt: 'File the recordings at the Concordance', enabled: () => !S.filed, onUse: () => side(async () => {
      S.main = true; cine(true);
      await game.shot([P.conc[0] + 1.6, 2.4, P.conc[2] + 2.6], [P.conc[0], 1.0, P.conc[2]], 1.2, { fov: 46 });
      if (once('concIntro')) { await game.say('m17label', 'Four trays. Four lives. Lay on each what proves it. I will know if you are guessing.'); }
      for (let i = 0; i < 4; i++) { if (S.matched[i]) continue; await fileOne(i); }
      if (nMatched() === 4) {
        S.filed = true; conc.done();
        audio.sfxPlay('success'); lockMusic('m17-archive');
        await game.shot([3, 2.4, -38.6], [3, 1.7, -42], 1.4, { fov: 46 });
        await game.say('m17label', 'Filed. You were faster than I was. Take the reel on the table. You will need the room as it was.');
        audio.sfxPlay('door'); W.doors.mirrorLamp.material = W.mats.amber;
        await tween(2.0, k => { W.doors.mirror.position.y = 1.7 + k * 3.6; }); W.doors.mirrorBox.enabled = false;
        await game.say('kai', 'Each life left one true thing. He kept them all, and he still couldn\'t keep her.');
        musicLock = null; F.m17matched = 4; F.m17matchMisses = S.matchMiss;
      }
      S.main = false; cine(false);
    }) });
    act({ pos: [W.items.reelCorr.position.x, 1.0, W.items.reelCorr.position.z], radius: 1.8, states: ['2196'], prompt: 'Take the reel · SITE ZERO, 07:40', enabled: () => S.filed && !S.reels.has('corr'), onUse: () => side(async () => {
      S.reels.add('corr'); W.items.reelCorr.visible = false; audio.sfxPlay('pickup');
      await game.say('m17band', 'Reel: "Site Zero, 19.10.2026, 07:40." An echo. A recorded room, not a recorded person.');
      ev('Echo reel · Site Zero, 07:40', 'A brass reel holding the seal corridor and the Control Room as they were at 07:40 on 19.10.2026, before the open day. Played on an echo lens, it lets the band hold 2026 for a short time.', 'The Archive · 2196');
    }) });

    // ---------- the Mirror Hall: mimics that learn how Kai fights ----------
    const C = new Combat(game, {
      hp: 5,
      onDown: () => { C.fail('THE MIMICS PUT YOU DOWN · THEY KNEW WHAT YOU WOULD DO'); },
      onCaught: () => { C.fail('TAKEN DOWN · FROM BEHIND, THE WAY YOU WOULD'); },
      onTakedown: () => { S.tact.takedown++; },
      onHit: (e, mode) => { if (mode === 'stun') S.tact.stun++; else if (mode === 'displace') S.tact.displace++; },
      onDisplace: (e, from) => { if (e.o.anchored) { const p = from.clone(); setTimeout(() => { e.char.root.position.copy(p); if (e.state === 'displaced') { e.dazeT = 0.4; } ui.subtitle('m17mimic', 'Anchored. I remember where I was.', 1800); }, 60); } },
    });
    let echo = null;
    if (F.echoStep !== false) { try { echo = new EchoStep(game, { combat: C, cost: 0.25, cooldown: 5, linger: 4.5 }); echo.unlock(false); echo.onStep = () => { if (zone() === 'mirror') S.tact.decoy++; }; } catch (err) { console.warn('m17 echo', err); } }
    const MBARKS = {
      spot: ['There you are. I know this part.', 'You always come round the left.', 'I know how this goes.'],
      search: ['You shifted. I would have.', 'Behind the glass. I always hide behind the glass.'],
      lost: ['Holding. You\'ll come back. I always do.'],
      yield: ['Stay down. It\'s nearly over.', 'Enough. You win this one.'],
    };
    const mimics = [];
    for (let i = 0; i < 4; i++) {
      const look = { ...CAST.kai.look, role: 'kai', era: '2049', costume: 'kai', lod: true, seed: 1700 + i };
      const ch = game.ambient(look, 0, 0, 220, 0); try { ch.setGhost(MIMIC); } catch (err) { console.warn('m17 mimic', err); }
      ch.root.visible = false; mimics.push(ch); await tick();
    }
    const WAVES = [
      [[-5, -60, 0, { patrol: [[-5, -60], [-5, -50]] }], [5.4, -64, PI * 0.9, { patrol: [[5.4, -64], [9, -56]] }]],
      [[-8, -58, 0, { patrol: [[-8, -58], [-1, -52]] }], [6, -62, PI, { patrol: [[6, -62], [6, -52]] }], [0, -66, PI, {}]],
      [[-6, -62, 0, { patrol: [[-6, -62], [-6, -52]] }], [6.5, -60, PI, { patrol: [[6.5, -60], [2, -54]] }], [0, -67, PI, { armed: false, run: 3.7, grab: true, name: 'MIMIC (UNARMED)' }]],
    ];
    const traitsFor = (wave) => {
      const t = { dodge: wave >= 2 };
      for (const c of S.counters) {
        if (c === 'takedown') { t.noTakedown = true; t.fov = 1.25; t.watch = true; }
        if (c === 'stun') t.shield = true;
        if (c === 'displace') t.anchored = true;
        if (c === 'decoy') t.ignoreDecoy = true;
      }
      return t;
    };
    const spawnWave = (n) => {
      for (const e of [...S.waveList]) C.removeEnemy(e);
      S.waveList = []; S.waveTact = { ...S.tact };
      const tr = traitsFor(n);
      WAVES[n - 1].forEach(([x, z, ry, o], i) => {
        const ch = mimics[i]; ch.root.position.set(x, 0, z); ch.root.rotation.y = ry; ch.root.visible = true; ch.frozen = false; ch.pose = null; ch.crouch = 0; ch.speed = 0;
        ch.root.userData.states = ['2196'];
        const e = C.addEnemy(ch, { states: ['2196'], voice: 'm17mimic', barks: MBARKS, yaw: ry, range: 12, speed: 1.5, run: 3.4, keep: 6, rate: 2.5, telegraph: 0.8, stunTime: 7, armed: true, kind: 'trooper', surrenders: true,
          noTakedown: !!tr.noTakedown, fov: tr.fov ?? 0.7, shield: !!tr.shield && o.armed !== false, anchored: !!tr.anchored, ...o });
        e.mim = { dodgeT: 2 + i, watchT: 3 + i * 1.3, tr, fade: 0 };
        S.waveList.push(e);
      });
    };
    const wavePos = [3, 0, -43.8, PI];
    const cpWave = () => game.checkpoint(...wavePos, () => { C.reset({ all: true }); spawnWave(S.wave); });
    // mimic behaviour on top of Combat: they Echo Step away from Kai's bolts, watch their backs, ignore his echo, and
    // come apart when they are restrained
    game.onUpdate((dt, t) => {
      if (!S.waveList.length) return;
      for (const e of S.waveList) {
        const m = e.mim, p = e.char.root.position;
        if (e.state === 'down' || e.state === 'surrender') {
          m.fade += dt; if (e.state === 'surrender' && m.fade > 1.6) { C.setState(e, 'down'); C.downed_(e); }
          if (m.fade > 1.2 && e.char.root.visible) { e.char.root.visible = false; audio.sfxPlay('rewind'); }
          continue;
        }
        if (m.tr.ignoreDecoy && e.gotTarget) { e.gotTarget = null; if (e.state === 'alert' && once('ign' + S.wave)) ui.subtitle('m17mimic', 'That\'s an echo. I used to do that.', 2000); }
        if (m.tr.watch && (e.state === 'patrol')) { m.watchT -= dt; if (m.watchT < 0) { e.look = e.look > 1 ? 0 : PI; m.watchT = 2.6; } }
        if (m.tr.dodge && ['alert', 'search', 'patrol', 'suspicious'].includes(e.state)) {
          m.dodgeT -= dt;
          if (m.dodgeT <= 0) for (const b of C.bolts) {
            if (b.owner !== 'kai') continue;
            const bp = b.mesh.position, dx = p.x - bp.x, dz = p.z - bp.z, d = Math.hypot(dx, dz);
            if (d > 6 || d < 1) continue;
            if ((dx * b.dir.x + dz * b.dir.z) / d < 0.85) continue;
            const s = Math.random() < 0.5 ? 1 : -1, nx = -b.dir.z * s * 2.4, nz = b.dir.x * s * 2.4;
            const to = new THREE.Vector3(p.x + nx, p.y, p.z + nz);
            if (game.collision.blocked(p, to, p.y + 1, '2196')) continue;
            p.copy(to); m.dodgeT = 6.5; audio.sfxPlay('switch');
            if (once('dodge' + S.wave)) ui.subtitle('m17mimic', 'Echo Step. You taught me that.', 2000);
            break;
          }
        }
      }
      // wave end
      if (S.wave && !S.fightDone && !S.busy && !game._failing && S.waveList.every(e => e.state === 'down' || e.state === 'surrender')) endWave();
    });
    let waveEnding = false;
    async function endWave() {
      if (waveEnding) return; waveEnding = true;
      try {
        const d = {}; for (const k of Object.keys(S.tact)) d[k] = S.tact[k] - (S.waveTact?.[k] || 0);
        let top = Object.keys(d).sort((a, b) => d[b] - d[a]).find(k => !S.counters.includes(k) && d[k] > 0);
        if (!top) top = ['stun', 'takedown', 'displace', 'decoy'].find(k => !S.counters.includes(k)) || 'stun';
        await game.wait(1.2);
        if (S.wave < 3) {
          S.counters.push(top);
          await game.say('m17warden', `Profile updated. Subject favours ${TACTIC[top]}. Countermeasure applied.`);
          ui.toast(COUNTER[top] + (S.wave === 1 ? '\nTHEY ALSO ECHO STEP AWAY FROM BOLTS' : ''), 3600);
          if (S.wave === 1) await game.say('kai', 'They\'re learning me. Then I\'d better stop being me.');
          else await game.say('kai', 'Two lessons. I\'ve still got a few habits they haven\'t seen.');
          S.wave++; C.reset({ all: true }); spawnWave(S.wave); cpWave(); audio.sfxPlay('alarm');
        } else {
          S.fightDone = true; S.waveList.forEach(e => { e.char.root.visible = false; }); C.showHud(false);
          F.m17mimicWaves = 3; F.m17counters = [...S.counters]; F.m17tactic = Object.keys(S.tact).sort((a, b) => S.tact[b] - S.tact[a])[0]; F.m17tactics = { ...S.tact };
          S.busy = true; S.main = true; cine(true);
          try {
            await game.shot([0, 2.6, -64], [0, 1.7, -70], 1.6, { fov: 46 });
            await game.say('m17warden', 'Profile exhausted. Subject exceeds samples.');
            await game.say('kai', 'Nobody ever got past their own habits before. Apparently.');
            audio.sfxPlay('door'); W.doors.gateLamp.material = W.mats.amber;
            await tween(2.0, k => { W.doors.gate.position.y = 1.7 + k * 3.6; }); W.doors.gateBox.enabled = false;
            if (F.metSera || F.m10metSera || F.m14metSera) await game.say('m17sera', 'Kai? Your signal just went very quiet and then very loud. Talk to me.');
            if (F.metSera || F.m10metSera || F.m14metSera) await game.say('kai', 'Mirrors that fight like me. They\'re down. I\'m going under the seal.');
          } finally { S.main = false; S.busy = false; cine(false); }
          S.phase = 'seal'; game.checkpoint(0, 0, -72.4, PI, () => { S.echoT = 0; }); refreshObjective();
        }
      } finally { waveEnding = false; }
    }

    // ---------- the Seal: echo lenses ----------
    const lensOn = (idx, on) => { const l = W.lenses[idx]; if (l) l.userData.on = on; };
    const startEcho = (lens, sec) => {
      S.echoT = sec; S.echoLens = lens; S.echoes++; lensOn(0, lens === 1); lensOn(1, lens === 2); audio.sfxPlay('rewind'); audio.sfxPlay('anomaly');
      ui.toast(`ECHO RUNNING · 2026 OPEN FOR ${sec} s · SWITCH: 1`, 3000);
    };
    const lens1 = act({ pos: [P.lens1[0], 1.2, P.lens1[2]], radius: 1.9, states: ['2196'], prompt: 'Load the reel into Echo Lens I', enabled: () => S.reels.has('corr'), onUse: () => side(async () => {
      if (S.echoes === 0) {
        S.main = true; cine(true);
        await game.shot([P.lens1[0] + 2.2, 1.8, P.lens1[2] + 1.6], [P.lens1[0], 1.2, P.lens1[2]], 1.2, { fov: 40 });
        await game.say('m17band', 'Echo lens. It plays a recorded room into the field around it. While it plays, the year 2026 is a state I can hold here.');
        await game.say('kai', 'Rooms that only existed back then. Forty seconds of them.');
        S.main = false; cine(false);
      }
      startEcho(1, ECHO_I); lens1.prompt = 'Replay the echo at Lens I';
    }) });
    act({ pos: [W.items.reelVault.position.x, 0.6, W.items.reelVault.position.z], radius: 1.7, states: ['2196'], prompt: 'Take the reel on the cot · THE CORRIDOR, 07:40', enabled: () => !S.reels.has('vault'), onUse: () => side(async () => {
      S.reels.add('vault'); W.items.reelVault.visible = false; audio.sfxPlay('pickup');
      await game.say('kai', 'He slept here. In a cupboard of cables, with a reel of a corridor for a pillow.');
    }) });
    const lens2 = act({ pos: [P.lens2[0], 1.2, P.lens2[2]], radius: 1.9, states: ['2196'], prompt: 'Load the reel into Echo Lens II', enabled: () => S.reels.has('vault'), onUse: () => side(async () => {
      startEcho(2, ECHO_II); lens2.prompt = 'Replay the echo at Lens II';
      game.checkpoint(-12.4, 0, -87.6, 0, () => { S.echoT = 0; });
    }) });
    // the echo runs down; in a room that only exists in 2026 the end of the echo throws Kai back to the lens
    game.onUpdate(dt => {
      if (S.echoT <= 0 || S.main) return;
      if (S.anchored && zone() === 'zero') return;
      S.echoT -= dt;
      if (S.echoT <= 6 && S.echoT + dt > 6) { audio.sfxPlay('heartbeat'); ui.toast('THE ECHO IS ENDING', 1600); }
      if (S.echoT <= 0) { S.echoT = 0; lensOn(0, false); lensOn(1, false); endEcho(); }
    });
    async function endEcho() {
      if (T.current !== '2026') return;
      if (zone() === 'past' || solidAt('2196')) {
        S.collapses++; game.control = false; audio.sfxPlay('rewind');
        ui.toast('THE ECHO ENDED · THE ROOM WAS NEVER THERE', 2400);
        await ui.fade(1, 700);
        T.setImmediate('2196');
        if (S.echoLens === 2) pl.place(-12.4, 0, -87.6, 0); else pl.place(-2.6, 0, -74.6, PI);
        await game.wait(0.3); await ui.fade(0, 700); game.control = true;
        if (once('collapse1')) ui.subtitle('kai', 'Too slow. The room ran out from under me. Again, faster.', 3000);
      } else await T.switchTo('2196', { force: true, free: true });
    }
    // the Control Room (2026)
    act({ pos: [P.runSheet[0] + 0.2, 1.0, P.runSheet[2]], radius: 1.7, states: ['2026'], prompt: 'Read the run sheet', enabled: () => !S.sheet, onUse: () => {
      S.sheet = true; audio.sfxPlay('pickup');
      ui.subtitle('kai', 'Run one. Field four point one, collars two, four, one. Door code: run number and the hour, oh-one-oh-eight. Power from CV-3.', 5200);
      ev('Run sheet · RUN 01', 'Control Room, 07:40 on 19.10.2026: start 08:14:02, field 4.1 kHz, collar phases II · IV · I. Corridor door code: 0108 (run 01, hour 08). Corridor power from breaker CV-3 in the cable vault.', 'Echo · 2026');
    } });
    act({ pos: [P.breaker[0], 1.4, P.breaker[2]], radius: 1.7, states: ['2026'], prompt: 'Throw breaker CV-3', enabled: () => !S.breaker, onUse: () => {
      S.breaker = true; audio.sfxPlay('spark'); audio.sfxPlay('metal'); W.breakerLever.rotation.z = 0.9; W.breakerLever.material = W.mats.amber; W.keypadLamp.material = W.mats.amber;
      ui.subtitle('kai', 'Corridor power. Now the door.', 2400);
    } });
    act({ pos: [P.keypad[0], 1.4, P.keypad[2] + 0.4], radius: 1.7, states: ['2026'], prompt: 'Enter the corridor code', enabled: () => !S.keypad, onUse: () => side(async () => {
      if (!S.breaker) { await game.say('kai', 'Dead. No power to the corridor. The breaker must be in the cable vault.'); return; }
      if (!S.sheet) { await game.say('kai', 'Four digits. I need the run sheet.'); return; }
      const pick = await choose('kai', 'Corridor code?', ['0814', '0108', '0101'], 1);
      if (pick !== 1) { S.keyMiss++; audio.sfxPlay('fail'); await game.say('kai', 'No. Run number, then the hour. Run oh-one, eight o\'clock: oh-one-oh-eight.'); return; }
      S.keypad = true; audio.sfxPlay('success'); audio.sfxPlay('door');
      tween(1.2, k => { W.doors.keypad.position.x = k * 2.4; }).then(() => { W.doors.keypadBox.enabled = false; });
      ui.subtitle('kai', 'Open. Go.', 1600);
    }) });
    // Test Hall Zero
    const master = act({ pos: [P.master[0], 1.3, P.master[2] + 0.6], radius: 2.0, states: ['2196'], prompt: 'Play the first recording at the master lens', enabled: () => !S.anchored && zone() === 'zero', onUse: () => side(async () => {
      S.main = true; cine(true); lockMusic('m17-zero', 1.2);
      await game.shot([3.2, 2.2, -116.4], [0, 1.3, -120.2], 1.6, { fov: 44 });
      await game.say('m17band', 'Master lens. Recording zero zero zero one: the ring\'s own pickup, made in this room.');
      W.master.userData.on = true; audio.sfxPlay('rewind'); audio.sfxPlay('anomaly');
      await game.say('m17band', 'The room recognises itself. Echo anchored. In this hall, 2026 holds as long as you need it.');
      await game.say('kai', 'His first room. He came back here a thousand times to listen. I\'m going to rebuild it instead.');
      S.anchored = true; S.echoT = 0; master.done(); F.m17anchored = true;
      musicLock = null; S.main = false; cine(false);
      game.checkpoint(0, 0, -109, PI);
    }) });
    game.onUpdate(() => {
      if (S.phase === 'seal' && zone() === 'zero' && !S.busy && !S.main) { S.phase = 'zero'; enterZero(); }
    });
    async function enterZero() {
      S.busy = true; S.main = true;
      try {
        cine(true); lockMusic('m17-zero', 1.0);
        await game.shot([7.6, 3.6, -108.6], [0, 2.4, -123], 2.4, { fov: 50 });
        await game.say('kai', T.current === '2026' ? 'Test Hall Zero. Clean. Lights on. Twenty-three years before anyone sealed it.' : 'Room zero zero zero one.');
        await game.say('m17band', 'Note: this hall survives in 2196. Switching is safe here.');
        await game.shot([2.4, 1.8, -112.4], [0, 2.9, -123], 1.6, { fov: 42 });
        await game.say('kai', 'The ring. Right here. Before anyone knew what it was.');
      } finally { musicLock = null; S.main = false; S.busy = false; cine(false); }
      game.checkpoint(0, 0, -109, PI, () => { if (!S.anchored) { S.echoT = 0; } });
      refreshObjective();
    }

    // ---------- the reconstruction of RUN 01 ----------
    const reconOn = () => S.anchored && !S.ran && T.current === '2026';
    act({ pos: [P.console[0], 1.2, P.console[2] + 0.9], radius: 1.9, states: ['2026'], prompt: 'Set up RUN 01 at the console', enabled: () => reconOn() && !S.recon.console, onUse: () => side(async () => {
      S.main = true; cine(true);
      await game.shot([P.console[0] + 1.6, 1.9, P.console[2] + 2.0], [P.console[0], 1.3, P.console[2] - 0.3], 1.2, { fov: 40 });
      const qs = [
        ['Field frequency for RUN 01?', ['3.8 kHz', '4.1 kHz', '4.4 kHz'], 1, 'The run log, the run sheet and Rook\'s voice all say four point one.'],
        ['Start time?', ['08:12:40', '08:14:02', '08:14:09'], 1, 'Start was oh-eight-fourteen-oh-two. Eight-fourteen and nine is when it happened, not when it started.'],
        ['Abort?', ['08:14:09', '08:14:11', 'No abort'], 1, 'Rook aborted at eight-fourteen and eleven. Two seconds too late. The log says so in his own hand.'],
      ];
      for (const [q, opts, ok, why] of qs) {
        for (;;) {
          const a = await choose('kai', q, opts, ok);
          if (a === ok) { audio.sfxPlay('pickup'); break; }
          S.reconMiss++; audio.sfxPlay('fail'); await game.say('kai', why);
        }
      }
      S.recon.console = true; W.consoleScreen.material = W.mats.amber;
      await game.say('kai', 'Four point one. Oh-eight-fourteen-oh-two. Abort at eleven. The machine is ready to do it again.');
      S.main = false; cine(false);
    }) });
    W.collars.forEach((c, i) => {
      const [x, y, z] = P.collars[i];
      const it = act({ pos: [x, y, z + 0.4], radius: 1.4, states: ['2026'], prompt: `Turn collar dial ${['I', 'II', 'III'][i]}`, enabled: () => reconOn(), onUse: () => {
        c.v = (c.v + 1) % 4; S.recon.collars[i] = c.v; c.ptr.rotation.z = -c.v * PI / 2; audio.sfxPlay('metal');
        it.prompt = `Turn collar dial ${['I', 'II', 'III'][i]} · now ${['I', 'II', 'III', 'IV'][c.v]}`;
        if (S.recon.collars.every((v, j) => v === COLLAR_OK[j]) && once('collarsOk')) { audio.sfxPlay('success'); ui.subtitle('kai', 'Two, four, one. The ring\'s collars, as they were.', 2400); }
      } });
      it.prompt = `Turn collar dial ${['I', 'II', 'III'][i]} · now I`;
    });
    act({ pos: [0.6, 0.9, P.rope], radius: 1.7, states: ['2026'], prompt: 'Unhook the rope, as she did', enabled: () => reconOn() && !S.recon.rope, onUse: () => {
      S.recon.rope = true; W.ropeHung.visible = false; W.ropeLoose.visible = true; audio.sfxPlay('metal');
      ui.subtitle('kai', 'She unhooked it herself. Ten years old, and nobody saw.', 2600);
    } });
    W.ropeHung.visible = true; W.ropeLoose.visible = false;
    const PEOPLE = {
      mira: ['m17mira10', 'Where Mira stood', 'Mira. Inside the rope, a step from the ring.', PI],
      kai: ['m17kai7', 'Where Kai stood', 'Me. Seven. Right behind her, holding on.', PI],
      rook: ['m17rook26', 'Where Rook stood', 'Rook, at the console. Watching the numbers, not the children.', PI],
      elena: ['m17mother', 'Where Mum stood', 'Mum. At the desk, signing us in. She looked up too late.', PI],
    };
    for (const [k, [id, label, line, ry]] of Object.entries(PEOPLE)) {
      const m = W.prints[k];
      act({ pos: [m.position.x, 0.6, m.position.z], radius: 1.5, states: ['2026'], prompt: 'Restore the moment · ' + label, enabled: () => reconOn() && game.residueOn && !S.recon.people.has(k), onUse: () => {
        S.recon.people.add(k); audio.sfxPlay('anomaly');
        const ch = stage(id, m.position.x, m.position.z, ry, k === 'rook' ? 'work' : null, 'recon'); ch.frozen = false;
        setTimeout(() => { ch.frozen = true; }, 400);
        ui.subtitle('kai', line, 2600);
        if (S.recon.people.size === 4 && once('people4')) setTimeout(() => ui.subtitle('m17band', 'Every person at 08:14:00 is placed.', 2400), 2800);
      } });
    }
    game.onUpdate(() => { const v = game.residueOn && T.current === '2026' && S.anchored; for (const m of Object.values(W.prints)) if (m.visible !== v) m.visible = v; });
    const runIt = act({ pos: [P.console[0], 1.2, P.console[2] + 0.9], radius: 1.9, states: ['2026'], prompt: 'Run the reconstruction', enabled: () => reconOn() && missingRecon().length === 0, onUse: () => side(async () => {
      runIt.done(); await runReconstruction();
    }) });
    const readRing = act({ pos: [0, 1.4, -120.6], radius: 2.2, states: ['2026'], prompt: 'Read the ring\'s memory', enabled: () => S.ran && !S.readRing, onUse: () => side(async () => { readRing.done(); await ringMemory(); }) });

    async function runReconstruction() {
      S.main = true; cine(true); lockMusic('m17-814', 1.2); game.setResidue(false);
      const g = ghosts, uni = W.ring.userData.disc.material.uniforms;
      for (const id of ['m17mira10', 'm17kai7', 'm17rook26', 'm17mother']) g[id].frozen = false;
      await game.shot([8.4, 2.6, -110.6], [0, 1.6, -119], 2.0, { fov: 50 });
      await game.say('m17band', 'Reconstruction: RUN 01. Eight-fourteen and two seconds.');
      await tween(2.0, k => { uni.uPower.value = 0.35 + k * 0.5; });
      await game.say('m17rook26', 'Field at four point one. Stable.');
      g.m17mira10.lookTarget = null; g.m17kai7.lookTarget = g.m17mira10.head;
      await game.shot([3.0, 1.2, -115.0], [0.6, 1.0, -119.4], 1.4, { fov: 38 });
      audio.sfxPlay('motif');
      await game.say('m17mira10', 'It\'s singing, Kai.');
      const walkM = walkTo(g.m17mira10, [[0.6, 0, -120.4]], 0.7), walkK = walkTo(g.m17kai7, [[0.4, 0, -119.4]], 0.7);
      await game.say('m17kai7', 'Mira, come back!');
      await Promise.all([walkM, walkK]);
      g.m17mira10.pose = 'look'; g.m17kai7.pose = 'look';
      await game.say('m17band', 'Eight-fourteen and nine seconds.');
      audio.sfxPlay('boom'); game.shake = 0.08;
      await tween(1.2, k => { uni.uPower.value = 0.85 + k * 0.7; uni.uColor.value.lerp(new THREE.Color(0x9a7bff), k * 0.5); });
      g.m17mira10.pose = 'fall'; g.m17kai7.pose = 'sad';
      await game.shot([-5.6, 2.2, -110.4], [-7.4, 1.5, -112.4], 0.9, { fov: 36 });
      await game.say('m17rook26', 'Abort! Cut the field!');
      g.m17mother.pose = 'sad';
      await game.say('m17mother', 'Mira!');
      await tween(2.4, k => { uni.uPower.value = 1.55 - k * 1.3; });
      audio.silence?.(2.2);
      await game.shot([1.8, 1.0, -116.4], [0.6, 0.4, -120.4], 2.4, { fov: 34 });
      await game.wait(1.4);
      audio.unsilence?.();
      await game.say('kai', 'That\'s what happened. That\'s all that happened. She reached, and I held on, and it took her anyway.');
      await game.say('kai', 'The ring kept something. Look at it. It\'s still lit.');
      S.ran = true; F.m17reconstructed = true; F.m17reconMisses = S.reconMiss;
      ev('RUN 01, reconstructed', 'Test Hall Zero, 19.10.2026: field 4.1 kHz from 08:14:02, collars II · IV · I. Mira unhooked the rope and reached into the ring at 08:14:09 holding Kai\'s hand; Rook aborted at 08:14:11. Her body fell. The ring stayed lit, violet.', 'Reconstruction');
      musicLock = null; S.main = false; cine(false);
      lockMusic('m17-witness', 2.0);
    }
    async function ringMemory() {
      S.main = true; cine(true);
      await game.shot([4.2, 2.4, -112.8], [0, 2.6, -123], 1.6, { fov: 46 });
      await game.say('m17band', 'Reading the ring. Biological signature: Varen, Mira, age ten. Ceased: eight-fourteen and nine point six seconds.');
      await game.say('m17band', 'Neural pattern: captured at the same instant. Completeness: sixty-one percent. Status: persisting.');
      await game.say('kai', 'Her body died here. Twenty-three years ago, on this floor.');
      await game.say('kai', 'But part of her didn\'t. It\'s been in the machine the whole time. Unfinished.');
      ev('The ring\'s memory', 'Mira Varen\'s body died at 08:14:09.6 on 19.10.2026 in Test Hall Zero. At the same instant the Chronolith captured her neural pattern: 61 % complete, persisting inside the ring.', 'Reconstruction');
      S.readRing = true; F.miraBodyDied = true; F.miraPattern = 61; F.m17ringRead = true;
    }
    async function toWitness() {
      // the echo lets go; the Witness is waiting in Room 0001
      S.main = true; cine(true);
      await ui.fade(1, 1400);
      unstage('m17mira10', 'm17kai7', 'm17rook26', 'm17mother');
      T.setImmediate('2196'); applyLook();
      witness.mode = 'here'; witness.root.position.set(P.wDesk0[0] + 0.2, 0, P.wDesk0[2] + 1.15); witness.root.rotation.y = PI; witness.pose = 'sit';
      pl.place(-4.6, 0, -121.8, -PI * 0.65);
      await game.wait(0.4); await ui.fade(0, 1400);
    }

    // ---------- ending: the Witness ----------
    async function ending() {
      S.phase = 'end'; lockMusic('m17-witness', 1.5);
      await game.shot([-1.6, 1.9, -119.6], [P.wDesk0[0], 1.3, P.wDesk0[2] + 1.1], 2.4, { fov: 42 });
      await game.say('witness', 'You rebuilt it faster than I did. I needed three hundred tries before I could watch it to the end.');
      witness.pose = null;
      await walkTo(witness, [[-7.0, 0, -124.4]], 0.9);
      await convo(witness, [
        ['kai', 'You built all this to watch her die.'],
        ['witness', 'I built it so I would never forget how.'],
        ['kai', 'Sixty-one percent. That\'s what\'s in the ring.'],
        ['witness', 'Sixty-one percent of a ten-year-old girl. The rest of her is what I have been looking for.'],
        ['kai', 'You kept bringing her back.'],
        ['witness', 'I kept finding a world where she could exist.'],
        ['kai', 'And what happened to those worlds?'],
        ['witness', 'They became the price.'],
      ]);
      audio.silence?.(1.6); await game.wait(1.2); audio.unsilence?.();
      await convo(witness, [
        ['kai', `${iters === 1046 ? 'One thousand and forty-six' : iters} of them. Their mornings. Their children. The father in zero one one two.`],
        ['witness', 'I remember every one. That is the only payment I can make.'],
        ...(sawPhoto ? [['kai', 'World zero four one two. Haldane sea wall. She lived to fifty-eight. You left it.'], ['witness', 'She was happy there. She was not finished there either.']] : []),
        ['kai', 'You told me not to build the machine.'],
        ['witness', 'Every one of you builds it anyway. The difference is that you know, now, what it costs.'],
        ['kai', 'Then why show me?'],
        ['witness', 'Because I am tired, Kai. And because you are the first one who came down here to understand her, not to save her.'],
      ]);
      await game.shot([0.8, 2.4, -117.0], [-7.0, 1.5, -124.4], 1.8, { fov: 46 });
      audio.sfxPlay('anomaly');
      W.master.userData.on = true;
      await game.say('witness', 'When you are ready to finish her, the ring will know. Do not keep her waiting another thousand years.');
      await tween(2.6, k => { witness.root.position.x = -7.0 + k * 1.2; witness.root.position.z = -124.4 - k * 3.6; witness.speed = 1.0; });
      witness.speed = 0;
      await ui.fade(1, 900); witness.mode = null; await game.wait(0.3); await ui.fade(0, 900);
      await game.shot([-3.0, 1.7, -119.2], [-6.6, 1.3, -126], 1.8, { fov: 42 });
      await game.say('kai', 'Gone. Same as Chamber Two. He takes the long way out.');
      await game.say('m17band', 'Correction to the record. Varen, Mira: died 19.10.2026, 08:14:09, Site Zero. Neural pattern: incomplete, sixty-one percent. Location: the Chronolith.');
      await game.say('kai', 'Not alive. Not dead. Unfinished.');
      if (F.metSera || F.m10metSera || F.m14metSera) {
        await game.say('m17sera', 'Kai. You\'re back on my screen. What did you find down there?');
        await game.say('kai', 'My sister. Most of her. And the man who keeps paying for the rest with other people\'s worlds.');
        await game.say('m17sera', 'Then come up. Before he finds out what you\'ll do with it.');
      }
      F.m17done = true; F.m17quote = true; F.witnessMotive = true; F.metWitness = true; F.m17witnessTalk = true;
      F.m17shards = S.shards; F.m17journal = S.journal.size; F.m17evidence = S.ev.size; F.m17echoes = S.echoes; F.m17collapses = S.collapses;
      F.m17lives = (S.father ? 1 : 0) + (S.miraReel ? 1 : 0); F.m17recordings = 4 + F.m17lives;
      await game.shot([6.6, 4.2, -110.6], [0, 1.6, -124], 5.0, { fov: 48 });
      await ui.fade(1, 2600);
      const mins = Math.round((game.time - tStart) / 60);
      await ui.chapterCard('MISSION 17 COMPLETE', 'The Witness\'s Archive', `Recordings ${4 + F.m17lives}/6 · Evidence filed 4/4 · Mimic waves 3/3 · Journal ${S.journal.size}/4 · Shards ${S.shards}/6${mins ? ' · ' + mins + ' min' : ''}`, 4200);
      C.dispose(); echo?.unlock(false);
      delete T.canSwitch; hud.remove(); kai.lookTarget = null; kai.pose = null;
      game.releaseCam(); ui.letterbox(false); audio.allBeds?.(0); audio.setTheme(null);
      window.__m17 = null;
    }

    // ---------- hints ----------
    hint(() => S.phase === 'hub' && zone() === 'hub' && nPlayed() < 4 && S.played.some(Boolean) === false, 50, () => ui.subtitle('kai', 'Four booths on the west wall. Four lives. I should hear them.', 3200));
    hint(() => S.phase === 'hub' && nPlayed() === 4 && nHub() < 4, 55, () => ui.subtitle('kai', 'The rest is in Rook\'s cages. This room, 2049. Switch: 2.', 3200));
    hint(() => zone() === 'stacks' && S.phase === 'hub', 45, () => ui.subtitle('kai', S.mapRead ? 'Wait in a cell. The walls move. I don\'t have to.' : 'Watch the slots in the floor. They glow before a wall moves. And there\'s a lectern somewhere.', 3400));
    hint(() => S.phase === 'sort' && !S.filed, 60, () => ui.subtitle('kai', 'The Concordance. Each recording mentions something. Find the object that agrees with it.', 3400));
    hint(() => S.phase === 'mirror' && S.wave > 0 && !S.fightDone, 70, () => ui.subtitle('kai', S.counters.length ? 'They counter what I did last. So do the other thing.' : 'Stun, displace, take them from behind, or leave an echo for them to shoot.', 3400));
    hint(() => S.phase === 'seal' && zone() === 'ante' && S.echoT <= 0, 40, () => ui.subtitle('kai', 'The lens. Load the reel, then switch to 2026 while it plays. One.', 3200));
    hint(() => S.phase === 'seal' && T.current === '2026' && zone() === 'past', 25, () => ui.subtitle('kai', !S.sheet ? 'The run sheet. On the desk.' : !S.breaker ? 'Cable vault. West door. Breaker CV-3.' : 'The door. Oh-one-oh-eight.', 2600));
    hint(() => S.phase === 'zero' && S.anchored && !S.ran && T.current === '2026', 70, () => { const m = missingRecon(); if (m.length) ui.subtitle('kai', 'Still to do: ' + m[0] + '.', 3200); });
    hint(() => S.phase === 'zero' && !S.anchored, 40, () => ui.subtitle('kai', 'The echo won\'t hold here on its own. The master lens, in 2196.', 3000));

    // ---------- phase triggers by place ----------
    game.onUpdate(() => {
      if (S.main || S.busy) return;
      const z = zone();
      if (S.stacksOpen && S.phase === 'hub' && z === 'stacks' && once('stacksIn')) { ui.subtitle('kai', 'In at B1. Out at C4. Somewhere in here: a pass and a band.', 3000); }
      if (z === 'sort' && S.phase === 'hub') { S.phase = 'sort'; game.checkpoint(3, 0, -31.6, PI); refreshObjective(); if (once('sortIn')) ui.subtitle('kai', 'Four brass trays. A table for sorting lives.', 2600); }
      if (z === 'mirror' && S.phase === 'sort' && S.filed) { S.phase = 'mirror'; cpWave(); refreshObjective(); }
      if (S.phase === 'mirror' && S.wave === 0 && pl.pos.z < -45) startFight();
    });
    async function startFight() {
      S.wave = 1; S.busy = true; S.main = true;
      try {
        cine(true); lockMusic('m17-mimic', 0.8);
        spawnWave(1); for (const e of S.waveList) e.char.frozen = true;
        await game.shot([3, 2.0, -46], [0, 1.4, -58], 1.6, { fov: 50 });
        await game.say('m17warden', 'Intruder: K. Varen. Matching profile: K. Varen, one thousand and forty-six samples. Countermeasures adapt.');
        await game.shot([-2, 1.8, -54], [-5, 1.5, -60], 1.2, { fov: 36 });
        await game.say('kai', 'They\'re me. Wearing my jacket, standing how I stand.');
        await game.say('m17band', 'Displacer online. Tap to stun, hold to displace. Take them from behind, or leave an echo.');
        C.giveWeapon(); echo?.unlock(true);
        for (const e of S.waveList) e.char.frozen = false;
        cpWave();
      } finally { musicLock = null; S.main = false; S.busy = false; cine(false); }
      refreshObjective();
    }

    // ---------- test hooks ----------
    window.__m17 = { S, W, C, T, P, ghosts, witness, mimics, zone, refreshObjective, echo, get echoOpen() { return echoOpen(); } };

    // ---------- intro ----------
    S.main = true; game.control = false; ui.letterbox(true);
    pl.place(...P.start); kai.root.rotation.y = PI;
    W.stacks.setLayout('A', true);
    game.checkpoint(0, 0, 16, PI);
    await ui.fade(1, 10);
    await game.shot([9.6, 8.4, -4.6], [-2, 2.4, 14], 0.01, { fov: 52 });
    await ui.fade(0, 1800);
    S.phase = 'intro';
    const cardP = ui.chapterCard('ACT III · THE LAST VERSION OF EARTH', 'The Witness\'s Archive', 'Every version of Kai\'s life', 4200);
    await game.shot([6.4, 6.6, -2.0], [-1, 2.0, 16], 6.0, { fov: 50 });
    await cardP;
    await game.shot([0, 2.2, 17.2], [0, 1.6, 22.6], 1.6, { fov: 44 });
    audio.sfxPlay('metal'); audio.sfxPlay('door');
    await tween(2.4, k => { W.doors.lift.position.y = 1.7 + k * 3.6; });
    W.doors.liftBox.enabled = false;
    if (F.metSera || F.m10metSera || F.m14metSera) {
      await game.say('m17sera', F.seraTrust != null && F.seraTrust < 0 ? 'You\'re under the old Helix. If he\'s down there, don\'t make a deal you can\'t pay for.' : 'You\'re under the old Helix now. Nobody comes back up from Site Zero with the same face.');
    }
    await game.say('kai', 'He left an empty case for this world in his museum. I want to know what he means to put in it.');
    await game.shot([-1.6, 1.8, 18.6], [0.6, 1.6, 22.6], 1.2, { fov: 38 });
    await game.say('m17band', `Local signature: Site Zero, Helix sub-level six. Recorded presence: ${iters === 1046 ? 'one thousand and forty-six' : iters}.`);
    await game.say('kai', 'Recordings. All of them me.');
    pl.place(0, 0, 18.4, PI);
    await game.shot([-4.2, 3.2, 11.8], [-11, 1.6, 6], 2.2, { fov: 48 });
    await game.say('m17label', 'If you are hearing this, you are the next one. Listen to the four on the west wall. Then come down. Do not be long. It is a bad place to be young.');
    await game.shot([4.0, 2.2, 13.4], [11, 1.6, 4], 1.6, { fov: 48 });
    await game.say('m17band', 'Second signature: Site Zero, sealed, 2049. The same room. Switching available here.');
    T.unlocked = true; S.phase = 'hub'; T.refreshHud();
    ui.toast('TEMPORAL STATE · THE ARCHIVE 2196 (3) · SITE ZERO, SEALED 2049 (2)', 3600);
    S.main = false; cine(false);
    refreshObjective();
    game.checkpoint(0, 0, 16, PI);

    // the mission runs from its interactions until the ring has been read; then the Witness
    await game.waitFor(() => S.readRing && !S.busy);
    await toWitness();
    await ending();
    void near; void cellOf;
  },
};
