// MISSION 14 · WELCOME TO 2196 (Act III) — make the catastrophe tangible.
// Bible beats: traverse overgrown skyscrapers and ruined transit lines · avoid unstable temporal zones · scavenge
// components to repair a return beacon · track survivors and discover a memorial depicting Kai as the architect of the
// Fracture. Quote: "We teach children your name before they learn the names of the dead." Ending: Sera reveals that
// every version of Kai denies responsibility.
// After the Sable Yards (M13) Kai's band throws him into the Meridian Reach, 2196, with no anchor. The binding bleeds;
// he must reach Lantern Hall, the survivors' settlement, and wake its old Helix return beacon before it fails.
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { glowMat } from '../world/kit.js';
import { sparks } from '../world/props.js';
import { buildReach, registerM14Cast, registerM14Themes, musicState, zoneMaterial, TEX, P, SHARDS, SETTLERS, CHILD96, DECK, L2, ROOF, PIT } from '../world/env_m14.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export default {
  id: 'm14', act: 'ACT III · THE LAST VERSION OF EARTH', title: 'Welcome to 2196', sub: 'A beautiful, devastated world',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM14Cast(); registerM14Themes();
    const m13 = F.m13choice || null, metSera = !!(F.metSera || F.m10metSera || F.m13done);
    try {
      const need = ['sera', 'joss', 'wren', 'ama', 'm14settler', 'm14trader', 'm14medic', 'm14child'].filter(id => !ui.portraits[id] && CAST[id]?.look);
      if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]]))));
    } catch (err) { console.warn('m14 portraits', err); }

    const scene = game.newScene({ background: 0xd8b890, fog: [0xd2b896, 0.0085], exposure: 1.05, bloom: 0.45, bloomThreshold: 0.85, envIntensity: 0.85, killY: -12, residue: true });
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    const Q = RZ.getQuality(), low = Q === 'low';
    game.onUpdate(dt => RZ.update(dt));
    await tick();
    // only one authored state: Kai's band has no anchor here. The HUD names it.
    T.configure([{ id: '2196', key: '3', name: 'FUTURE', year: 'MERIDIAN REACH · 2196 · NO ANCHOR', glyph: '◑', color: '#ffb36a', theme: 'm14-reach', apply: () => {} }], '2196');
    T.unlocked = false;

    const W = buildReach(game, scene);
    game.onUpdate((dt, t) => W.update(dt, t));
    await tick();

    // ---------- light: a low morning sun out of the east (the one shadow caster), sky IBL, three nearest practicals ----------
    const sunDir = V(0.78, 0.24, 0.42).normalize();
    try { const sky = RZ.skyEnvironment(renderer, scene, { preset: 'golden-hour', sunDir: [sunDir.x, sunDir.y, sunDir.z], turbidity: 4.2, cover: 0.38 }); scene.environmentIntensity = 0.85; void sky; } catch (err) { console.warn('m14 sky', err); }
    const hemi = new THREE.HemisphereLight(0xffd8b0, 0x3a3024, 0.5); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffc890, 2.4); sun.castShadow = true;
    sun.shadow.mapSize.set(Q === 'high' ? 2048 : low ? 512 : 1024, Q === 'high' ? 2048 : low ? 512 : 1024);
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 180 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    let lightT = 0;
    const rigLights = () => {
      const p = game.cine ? game.engine.camera.position : pl.pos;
      const list = W.lightSrc.map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      pts.forEach((l, i) => { const s = list[i]; if (!s || s.dd > 45 * 45) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
    };
    game.onUpdate(dt => {
      const p = game.cine ? game.engine.camera.position : pl.pos;
      sun.target.position.set(p.x, 0, p.z); sun.position.set(p.x + sunDir.x * 80, sunDir.y * 80 + 6, p.z + sunDir.z * 80);
      lightT -= dt; if (lightT <= 0) { lightT = 0.4; rigLights(); }
    });
    audio.wind(0.12); audio.rain(0); audio.hum(0, 50);

    // ---------- helpers ----------
    const S = { shards: 0, seen: {}, ev: new Set(), obj: '', phase: 'open', bind: 1, drain: false, way: new Set(), trail: new Set(), comp: { cell: false, coil: false, crystal: null },
      zoneHits: 0, drifts: 0, busy: false, main: false, coilMiss: 0, tuneMiss: 0, garden: 'none', valves: [], talked: new Set(), memorial: false, hall: false, beacon: false, arc: false, gateOpen: false, readNames: false };
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag) => { S.ev.add(title); ui.addEvidence(title, text, tag); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const choose = (id, text, opts, correct = 0) => { if (game.autoplay) game.autoChoice = game.autoQueue?.length ? game.autoQueue.shift() : correct; return game.choice(id, text, opts); };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u)); if (u >= 1) { off(); res(); } }); });
    const idle = () => game.waitFor(() => !ui.dlgActive && !S.busy && !game._failing);
    const side = async (fn) => { if (S.busy || !game.control) return; S.busy = true; try { await fn(); } catch (err) { if (!err?.abort) console.warn('m14 side', err); } finally { S.busy = false; if (!S.main) { game.control = true; ui.letterbox(false); game.releaseCam(); } } };
    const radio = (line, ms = 3600) => ui.subtitle('sera', line, ms);
    const kai = pl.char;
    let mood = 'm14-reach', musicLock = null;
    const music = (fade = 1.6) => { const th = musicLock || mood; T.defs[0].theme = th; audio.setTheme(th, fade); };
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    const setMood = (m) => { if (m !== mood) { mood = m; if (!musicLock) music(); } };
    const posOf = (ch) => (ch === kai ? pl.pos : ch.root.position);
    const faceEach = (a, b) => {
      const pa = posOf(a), pb = posOf(b), ya = Math.atan2(pb.x - pa.x, pb.z - pa.z), yb = Math.atan2(pa.x - pb.x, pa.z - pb.z);
      if (a === kai) { pl.yaw = ya; kai.root.rotation.y = ya; } else a.root.rotation.y = ya;
      if (b === kai) { pl.yaw = yb; kai.root.rotation.y = yb; } else b.root.rotation.y = yb;
      a.lookTarget = b.head; b.lookTarget = a.head;
    };
    const ots = (speaker, listener, dur = 1.0, fov = 36, sd = 0.7) => {
      const sp = posOf(speaker), l = posOf(listener), dx = sp.x - l.x, dz = sp.z - l.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, s2 = sd + (d < 1.8 ? 0.2 : 0);
      return game.shot([l.x - ux * 1.5 + uz * s2, l.y + 1.68, l.z - uz * 1.5 - ux * s2], [sp.x, sp.y + 1.58, sp.z], dur, { fov });
    };
    const walkTo = (ch, path, speed = 1.5) => new Promise(res => {
      let i = 0;
      const off = game.onUpdate(dt => {
        const p = ch.root.position, t = path[i]; const dx = t[0] - p.x, dz = t[2] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { i++; if (i >= path.length) { ch.speed = 0; off(); res(); } return; }
        const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st; p.y += (t[1] - p.y) * Math.min(1, dt * 5);
        let dy = Math.atan2(dx, dz) - ch.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.root.rotation.y += dy * Math.min(1, dt * 8); ch.speed = speed;
      });
    });

    // ---------- the binding: bleeds while Kai is in the open, steadies at the survivors' waymarks ----------
    let lastWay = 0;
    const cp = (x, y, z, yaw, extra) => game.checkpoint(x, y, z, yaw, () => { S.bind = Math.max(S.bind, 0.8); extra?.(); });
    const drift = () => {
      if (game._failing) return;
      S.drifts++; F.m14drifts = S.drifts;
      game.fail('YOUR BINDING SLIPPED · YOU COME TO AT THE LAST WAYMARK');
    };
    game.onUpdate((dt) => {
      const free = game.control && !ui.dlgActive && !game.cine && !game._failing;
      // waymarks: steady the binding, light up, become the checkpoint
      let atWay = false;
      W.waymarks.forEach((w, i) => {
        const d = Math.hypot(pl.pos.x - w.x, pl.pos.z - w.z), dy = Math.abs(pl.pos.y - w.y);
        if (d < 3.4 && dy < 2) {
          atWay = true;
          if (!w.lit) { w.lit = true; S.way.add(i); F.m14waymarks = S.way.size; audio.sfxPlay('anomaly'); ui.toast('WAYMARK · THE BINDING STEADIES', 2000); }
          if (i !== lastWay && free) { lastWay = i; cp(w.x + 1.2, w.y, w.z, pl.yaw); }
        }
      });
      if (free && S.drain) S.bind = Math.max(0, Math.min(1, S.bind + (atWay ? dt * 0.3 : -dt / 540)));
      T.stability = S.bind; musicState.binding = S.bind;
      if (free && S.drain && S.bind < 0.32 && once('low' + Math.floor(S.drifts) + '-' + (S.bind < 0.15 ? 2 : 1))) ui.subtitle('m14band', S.bind < 0.15 ? 'Binding critical. Find a damper now.' : 'Binding thirty percent. Find a waymark.', 3000);
      if (free && S.drain && S.bind <= 0) drift();
    });

    // ---------- unstable zones: contact throws Kai out and strips the binding ----------
    let zoneToastT = 0;
    game.onUpdate((dt) => {
      zoneToastT -= dt;
      let prox = 0;
      for (const z of W.zones) {
        if (!z.on) continue;
        const dx = pl.pos.x - z.cx, dz = pl.pos.z - z.z, d = z.axis === 'x' ? Math.abs(dx) : Math.hypot(dx, dz);
        if (Math.abs(pl.pos.y - z.y) > 2.6 || (z.axis === 'x' && Math.abs(dz) > 1.6)) continue;
        prox = Math.max(prox, 1 - Math.min(1, Math.max(0, d - z.r) / 10));
        if (!game.control || game._failing || ui.dlgActive || z.r < 0.15) continue;
        if (d < z.r + 0.25) {
          const out = z.r + 0.7;
          if (z.axis === 'x') pl.pos.x = z.cx + (dx < 0 ? -out : out);
          else { const k = d > 0.01 ? 1 / d : 1; pl.pos.x = z.cx + (d > 0.01 ? dx * k : 1) * out; pl.pos.z = z.z + (d > 0.01 ? dz * k : 0) * out; }
          pl.vel.set(0, 0, 0);
          S.bind = Math.max(0, S.bind - 0.14); S.zoneHits++; F.m14zoneHits = S.zoneHits;
          game.shake = 0.22; audio.sfxPlay('rewind');
          if (game.engine.fx?.uShift) game.engine.fx.uShift.value = 0.6;
          if (zoneToastT <= 0) { zoneToastT = 3; ui.toast('UNSTABLE ZONE · IT THROWS YOU OUT', 1800); }
          if (S.bind <= 0) drift();
        }
      }
      musicState.zone += (prox - musicState.zone) * Math.min(1, dt * 2);
      if (game.engine.fx?.uShift && game.engine.fx.uShift.value > 0 && !T.switching) game.engine.fx.uShift.value = Math.max(0, game.engine.fx.uShift.value - dt * 1.4);
      if (game.shake > 0 && !game.cine) game.shake = Math.max(0, game.shake - dt * 0.8);
      if (S.drain && !musicLock) setMood(prox > 0.45 ? 'm14-zone' : pl.pos.z < -76 ? 'm14-hall' : S.phase === 'track' ? 'm14-track' : 'm14-reach');
    });

    // ---------- people (drawn only within ~85 m of the camera) ----------
    const shown = new Map();
    const show = (ch, on) => { shown.set(ch, on); ch.root.visible = on; };
    game.onUpdate(() => { const c = game.engine.camera.position; for (const [ch, on] of shown) ch.root.visible = on && Math.hypot(c.x - ch.root.position.x, c.z - ch.root.position.z) < 85; });
    const sera = game.actor('sera', { ...CAST.sera.look, era: '2196' }, 0, -60, 0, 0); show(sera, false);
    const joss = game.actor('joss', null, P.loop[0] - 0.8, DECK, P.loop[2] + 0.4, 0.6);
    const wren = game.actor('wren', null, P.loop[0] + 0.9, DECK, P.loop[2] - 0.3, -2.4);
    show(joss, true); show(wren, true);
    await tick();
    const ama = game.actor('ama', null, P.ama[0], 0, P.ama[2], Math.PI); ama.pose = 'work'; show(ama, true);
    // the statue: Kai, in bronze, on the plinth of the Memorial Square
    const statue = game.ambient({ ...CAST.kai.look, era: '2049', lod: false, shadows: true }, P.statue[0], P.statue[1], P.statue[2] + 0.3, 0);
    statue.root.scale.setScalar(2.05); statue.pose = 'look'; show(statue, true);
    await tick();
    const settlers = [
      [-18, 1.0, -96, Math.PI / 2, 'sit'], [-17, 1.0, -110, 1.2, 'work'], [18.6, 1.0, -100, -Math.PI / 2, 'work'], [17.2, 1.0, -112, -1.4, null],
      [4.4, 0, -88, -0.6, 'work'], [-3, 0, -85.6, 0.4, 'sit'],
    ].map(([x, y, z, ry, pose], i) => { const ch = game.ambient({ ...SETTLERS[i % SETTLERS.length], seed: 1400 + i }, x, y, z, ry); ch.pose = pose; show(ch, false); return ch; });
    const child = game.ambient({ ...CHILD96, seed: 1450 }, 16.2, 1.0, -94.4, -Math.PI / 2); child.pose = 'look'; show(child, false);
    await tick();
    // the survivors' echo (Residue Vision only): two figures walking the trail they took two days ago
    const echoes = [joss, wren].map((src, i) => { const e = game.ambient({ ...src.p, lod: true, seed: 1460 + i }, 0, -60, 0, 0); e.setGhost(0xb6ff8a); game.residue(e.root); return e; });
    const ECHO_PATH = [[-2.6, 0, 66], [-6.4, 0, 54], [-12.4, 0, 45.4], [-20.6, 0, 42.6], [-23, 0, 40.2]];
    let echoT = 0;
    game.onUpdate((dt) => {
      if (!game.residueOn || S.loopFreed) return;
      echoT = (echoT + dt * 0.7) % (ECHO_PATH.length - 1 + 1.5);
      echoes.forEach((e, i) => {
        const tt = Math.max(0, Math.min(ECHO_PATH.length - 1.001, echoT - i * 0.35)), k = Math.floor(tt), f = tt - k, a = ECHO_PATH[k], b = ECHO_PATH[k + 1];
        e.root.position.set(a[0] + (b[0] - a[0]) * f + i * 0.7, 0, a[2] + (b[2] - a[2]) * f); e.root.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]); e.speed = i ? 1.3 : 0.9;
      });
    });
    window.__m14 = { S, W, T, P, sera, joss, wren, ama, statue, refill: () => { S.bind = 1; } };

    // the statue turns to bronze once its pose has settled
    const bronze = new THREE.MeshStandardMaterial({ color: 0x5e4a2e, roughness: 0.38, metalness: 0.9, envMapIntensity: 1.2 });
    setTimeout(() => { try { statue.update(0.6); statue.root.traverse(o => { if (o.isMesh) { o.material = bronze; o.castShadow = true; o.receiveShadow = true; o.userData.noBatch = true; } }); statue.frozen = true; } catch (err) { console.warn('m14 statue', err); } }, 1200);

    // ---------- collectibles: temporal shards ----------
    SHARDS.forEach(([x, y, z, where]) => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), glowMat(0x7fe8ff, 3.2)); m.position.set(x, y, z); m.userData.noBatch = true; scene.add(m);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.01, 6, 32), glowMat(0x7fe8ff, 1.8)); m.add(halo);
      game.onUpdate((dt, t) => { if (m.userData.taken) return; const c = game.engine.camera.position; m.visible = Math.hypot(c.x - x, c.z - z) < 60; if (!m.visible) return; m.rotation.y += dt * 1.4; halo.rotation.x = t; });
      game.interact({ pos: [x, y + 0.3, z], radius: 1.8, prompt: 'Take the temporal shard', onUse: () => {
        m.visible = false; m.userData.taken = true; S.shards++; F.shards = (F.shards || 0) + 1; F.m14shards = S.shards; audio.sfxPlay('anomaly');
        ev('Temporal shard ' + S.shards + '/5', 'Crystallised time, found ' + where + '. It keeps a steadier beat than anything else in the Reach.', 'TEMPORAL SHARD · ' + S.shards + '/5');
      } });
    });

    // ---------- optional discoveries along the way ----------
    const heraldBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.45), new THREE.MeshStandardMaterial({ color: 0x3a5a4a, roughness: 0.6, metalness: 0.5 })); heraldBox.position.set(9.6, 0.5, 98.6); scene.add(heraldBox); game.collision.addBox(9.6, 0, 98.6, 0.55, 1.0, 0.45);
    W.plane(TEX.herald(), 0.36, 0.48, 9.31, 0.78, 98.6, -Math.PI / 2, 0.08);
    game.interact({ pos: P.herald, radius: 1.9, prompt: 'Read the paper under the glass', onUse: () => {
      F.m14herald = true; audio.sfxPlay('pickup');
      ev('Rain City Herald, 19.10.2049', 'Kept under the scratched glass of a newspaper box for a hundred and forty-seven years: "HELIX TO RUN FIRST FULL-SCALE TEST TODAY. \'Tomorrow, on time,\' says director Rook. Lead engineer Dr. K. Varen declined to comment."', 'THE REACH');
      ui.subtitle('kai', 'The morning of the test. Somebody kept it. Like a relic.', 3200);
    } });
    W.plane(TEX.poster(), 0.9, 1.2, -11.94, 2.0, 64, Math.PI / 2, 0.06);
    game.interact({ pos: P.poster, radius: 2.2, prompt: 'Read the Continuum notice', onUse: () => {
      F.m14poster = true; audio.sfxPlay('pickup');
      ev('Continuum notice 9', 'Pasted over older notices on a tower in the Reach: "THE CONTINUUM. ONE HISTORY. ONE TIME. REPORT EVERY UNSTABLE ZONE." Someone has scratched a lantern into the gold circle.', 'THE REACH');
      ui.subtitle('kai', 'They want the zones reported. So they can hold them, like the Yards.', 3000);
    } });
    const diary = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.26), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 })); diary.position.set(5.2, 0.92, 54.6); diary.rotation.y = 0.4; scene.add(diary);
    game.interact({ pos: P.diary, radius: 1.9, prompt: 'Read the scavenger\'s diary', onUse: () => {
      F.m14diary = true; diary.visible = false; audio.sfxPlay('pickup');
      ev('A scavenger\'s diary', '"Day 9,412 by the Hall\'s count. The Reach is quieter. The zones breathe slower in the mornings, so we go out early. Three children born this year. Ruth says the beds will hold if the cistern does." The day count starts at the Fracture.', 'THE REACH');
      ui.subtitle('kai', 'Nine thousand days. They count everything from it.', 3000);
    } });
    // the Witness's note at the memorial (in Kai's handwriting, older)
    game.interact({ pos: P.witnessNote, radius: 1.9, prompt: 'Read the note behind the stone', enabled: () => S.memorial, onUse: () => {
      F.m14witnessNote = true; W.witnessNote.visible = false; audio.sfxPlay('pickup');
      ev('Note behind a memorial stone', 'Tucked behind a stone at the foot of the statue, in Kai\'s own handwriting, older and shakier: "They will tell you it was you. Don\'t argue with them. Argue with me. — K."', 'THE WITNESS\'S NOTES');
      ui.subtitle('kai', 'He stood here too. Under his own face.', 3200);
    } });
    game.interact({ pos: P.plaque, radius: 2.0, prompt: 'Read the plaque', once: false, enabled: () => S.memorial && !S.seen.plaque, onUse: () => {
      S.seen.plaque = true; F.m14plaque = true; audio.sfxPlay('pickup');
      ev('The memorial plaque', 'Bronze, gone green at the edges: "KAI VAREN · ARCHITECT OF THE FRACTURE · HE BUILT THE MACHINE THAT BROKE THE HOUR · 08:14 · THE LAST SECOND OF THE OLD WORLD · WE REMEMBER HIS FACE SO IT IS NEVER WELCOMED AGAIN."', 'THE MEMORIAL');
    } });
    game.interact({ pos: P.names, radius: 2.4, prompt: 'Read the wall of names', once: false, enabled: () => S.memorial && !S.readNames, onUse: () => {
      S.readNames = true; F.m14names = true; audio.sfxPlay('pickup');
      ev('The wall of names', 'Eleven thousand names in the Reach alone, cut by hand, row after row, families together. At the end of the last panel, in newer letters: "AND THE ONES WHO WERE NEVER WRITTEN DOWN."', 'THE MEMORIAL');
      ui.subtitle('kai', 'Families. Whole rows of the same name.', 3000);
    } });
    game.interact({ pos: P.directory, radius: 2.0, prompt: 'Read the tower directory', onUse: () => {
      F.m14directory = true; audio.sfxPlay('pickup');
      ev('Halcyon Tower directory', 'A steel plate in the podium lobby: "L8-21 HELIX TEMPORAL RESEARCH · ANNEX. PODIUM ROOF: CITY RELAY 4 (HELIX · RESTRICTED)." Helix ran a relay on the roof.', 'HALCYON TOWER');
      ui.subtitle('kai', 'City Relay 4. On the podium roof. Up the stairs.', 2800);
    } });

    // =====================================================================================
    // OPENING: the Meridian Reach, 2196, morning
    // =====================================================================================
    ui.missionTag('MISSION 14 · WELCOME TO 2196'); ui.show('hud', true);
    pl.place(...P.start); cp(P.start[0], P.start[1], P.start[2], P.start[3]);
    S.main = true; cine(true); audio.setTheme(null);
    kai.root.visible = false;
    await game.shot([5, 66, 170], [0, 16, 66], 0.01, { fov: 52 });
    await ui.fade(0, 2600);
    lockMusic('m14-reach', 2.4);
    const cc = ui.chapterCard('ACT III · THE LAST VERSION OF EARTH', 'Welcome to 2196', 'The Meridian Reach · Rain City · 2196 · morning', 4800);
    await game.shot([7, 24, 134], [-2, 9, 88], 7.5, { fov: 50 });
    await cc;
    // the tear: a seam of light opens over the plaza and lets Kai fall out of it
    const rift = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.2), new THREE.MeshBasicMaterial({ color: 0x9ae8ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    rift.position.set(P.start[0], 1.9, P.start[2]); scene.add(rift);
    await game.shot([9, 2.2, 104], [2, 1.6, 112], 1.6, { fov: 40 });
    audio.sfxPlay('switch'); audio.sfxPlay('rewind');
    await tween(0.8, u => { rift.material.opacity = u * 0.7; rift.scale.set(0.2 + u, 1, 1); });
    kai.root.visible = true; kai.pose = 'fall'; game.shake = 0.18;
    await tween(0.9, u => { rift.material.opacity = 0.7 * (1 - u); rift.scale.set(1.2 - u, 1 - u * 0.5, 1); });
    rift.visible = false; game.shake = 0;
    await game.wait(1.4);
    kai.pose = null;
    await game.shot([5.4, 1.8, 106.6], [2, 1.5, 112], 1.2, { fov: 38 });
    await game.say('m14band', 'Binding unstable. No anchor in range.');
    await game.say('kai', 'That\'s not the Yards.');
    // the view north: the overgrown avenue
    await game.shot([2.6, 2.2, 116], [0, 9, 80], 3.0, { fov: 54 });
    await game.say('kai', 'Rain City. A hundred and forty-seven years after.');
    await game.say('kai', 'It\'s beautiful. That\'s the worst part.');
    await game.shot([4.4, 1.8, 115], [2, 1.55, 112], 1.0, { fov: 40 });
    kai.lookTarget = V(0, 2, 90);
    await game.talk([
      ['sera', F.m13done ? 'Varen? You were standing next to me and then you weren\'t.' : 'Varen? Your signal just jumped half the city.'],
      ['kai', 'The band pulled me. Towers, trees in them. A tram line overhead, broken in the middle.'],
      ['sera', 'The Meridian Reach. You\'re closer to Lantern Hall than I am. Go north, past the square.'],
      ['m14band', 'Binding at ninety-one percent and falling.'],
      ['sera', 'Hear that? If your band goes out here, you stay in my year. For good.'],
      ['kai', 'Then how do I get back?'],
      ['sera', 'The Hall has an old Helix return beacon. It\'s never worked. Joss says it needs three parts.'],
      ['sera', 'Joss went out for them two days ago, with his daughter. They haven\'t come back. Their marks will be on your road. Chalk. Arrows.'],
      ['sera', 'And Varen: the green lanterns on the stones. Stand by them. They hold a little of now.'],
    ]);
    kai.lookTarget = null;
    ev('The Meridian Reach, 2196', 'Kai\'s band threw him out of the Sable Yards into the Meridian Reach, 2196: overgrown towers, the broken Line 4 viaduct, unstable temporal zones. His binding has no anchor and is bleeding. Sera: reach Lantern Hall, north past the square. Its old Helix return beacon needs three parts.', 'THE REACH');
    ev('Missing: Joss and Wren Harrow', 'Lantern Hall\'s beacon keeper and his daughter went out for beacon parts two days ago and have not come back. Their chalk marks should be on Kai\'s road north.', 'SURVIVORS');
    cine(false); lockMusic(null); S.main = false;
    S.drain = true; S.phase = 'track';
    objective('Reach Lantern Hall before your binding fails · north up Canopy Avenue · follow Joss and Wren\'s marks');
    hint(() => pl.pos.z > 100 && !S.way.has(0), 25, () => ui.subtitle('kai', 'A green lantern on the stones. Sera said to stand by them.', 2600));

    // ---------- the avenue: the zones, the trail ----------
    let zoneIntro = false;
    game.onUpdate(() => {
      if (zoneIntro || !game.control || ui.dlgActive) return;
      const z1 = W.zones[0]; if (Math.hypot(pl.pos.x - z1.cx, pl.pos.z - z1.z) > 13) return;
      zoneIntro = true;
      side(async () => {
        S.main = true; cine(true);
        await game.shot([pl.pos.x + 2.4, 2.2, pl.pos.z + 3.6], [z1.cx, 2.0, z1.z], 2.2, { fov: 42 });
        await game.talk([
          ['kai', 'The air\'s bending. There, in the road.'],
          ['m14band', 'Unstable temporal zone. Contact will strip the binding.'],
          ['kai', 'There\'s a lamp post inside it. A clean one. From my year.'],
          ['kai', 'It breathes. Out, then in. Round it, or through when it\'s small.'],
        ]);
        ui.toast('RESIDUE VISION (F) SHOWS A ZONE\'S FULL REACH AND ITS RHYTHM · GREEN = CLOSED', 4200);
        cine(false); S.main = false;
      });
    });
    const TRAIL = [
      { id: 't1', pos: P.trail1, prompt: 'Read the chalk mark', title: 'Trail: chalk on a wreck', text: 'A chalk arrow on the door of a wrecked car, pointing north: "LH ↑" and two tally marks. Lantern Hall, and two of them.', bark: 'LH. Lantern Hall. Two of them, heading home.', radio: 'That\'s Wren\'s hand. She always draws the arrow too long.' },
      { id: 't2', pos: P.trail2, prompt: 'Pick up the hand-crank lamp', title: 'Trail: a dropped lamp', text: 'A survivor\'s hand-crank lamp in the weeds, its crank snapped off. A strip of tape on the handle: "W. HARROW".', bark: 'Wren\'s. She dropped it and didn\'t come back for it.' },
      { id: 't3', pos: P.trail3, prompt: 'Read the footprints in the dust', residue: true, title: 'Trail: two sets of prints', text: 'In Residue Vision the dust holds two people walking: one long stride, one dragging the left foot. They leave the avenue here and turn west, to the Meridian East stairs.', bark: 'One of them\'s limping. They turned west. To the station stairs.' },
      { id: 't4', pos: P.trail4, prompt: 'Read the chalk at the stairs', title: 'Trail: the stairs', text: 'Chalked on the wall at the foot of the Meridian East stairs: "J+W · CELL FROM THE TRAM ↑ · BEAM" with the word BEAM crossed out twice.', bark: 'They went up for the tram. And never crossed the beam.' },
    ];
    const lamp = new THREE.Group(); { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0x5a5a4a, roughness: 0.6, metalness: 0.4 })); b.rotation.z = Math.PI / 2; lamp.add(b); const l = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), glowMat(0xffd8a0, 0.6)); l.position.x = 0.115; l.rotation.y = Math.PI / 2; lamp.add(l); }
    lamp.position.set(P.trail2[0], 0.08, P.trail2[2]); lamp.rotation.y = 0.7; scene.add(lamp);
    W.plane(TEX.chalk('LH', '| |'), 0.7, 0.44, 7.4, 0.95, 92.95, 0, 0.08);
    W.plane(TEX.chalk('J+W', 'CELL ↑ · BEAM ✕'), 1.1, 0.7, -21.32, 1.5, 41.2, Math.PI / 2, 0.08);
    const prints = new THREE.Group(); scene.add(prints); game.residue(prints);
    { const pm = new THREE.MeshBasicMaterial({ color: 0xb6ff8a, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }); const pg = new THREE.PlaneGeometry(0.12, 0.28); pg.rotateX(-Math.PI / 2);
      for (let i = 0; i < 34; i++) { const t = i / 33, x = -3 + (-23 + 3) * t, z = 62 + (41 - 62) * t; const m = new THREE.Mesh(pg, pm); m.position.set(x + (i % 2 ? 0.16 : -0.16), 0.06, z); m.rotation.y = Math.atan2(-20, -21); prints.add(m); } }
    for (const tr of TRAIL) {
      game.interact({ pos: tr.pos, radius: 2.2, prompt: tr.prompt, once: false, enabled: () => !S.trail.has(tr.id) && (!tr.residue || game.residueOn), onUse: () => {
        S.trail.add(tr.id); F.m14trail = S.trail.size; audio.sfxPlay('pickup'); if (tr.id === 't2') lamp.visible = false;
        ev(tr.title, tr.text, 'SURVIVORS · TRAIL ' + S.trail.size + '/4');
        ui.subtitle('kai', tr.bark, 3200);
        if (tr.radio) setTimeout(() => radio(tr.radio, 3000), 3400);
        if (S.phase === 'track') objective(`Follow Joss and Wren's marks (${S.trail.size}/4) · north, then where they turned`);
      } });
    }
    hint(() => S.phase === 'track' && pl.pos.z < 50 && pl.pos.z > 36 && !S.trail.has('t3'), 30, () => ui.subtitle('kai', 'The dust here is all scuffed. Residue Vision might show who walked it.', 3000));
    hint(() => S.phase === 'track' && pl.pos.z < 36 && Math.abs(pl.pos.x) < 12, 25, () => ui.subtitle('kai', 'The span\'s down across the road. Up the station stairs, on the west side.', 3000));

    // ---------- Meridian East: Joss and Wren in a loop ----------
    const loopMat = zoneMaterial(0xc8ff9a);
    const loopShell = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 4.2, 40, 1, true), loopMat); loopShell.position.set(P.loop[0], DECK + 2.1, P.loop[2]); scene.add(loopShell);
    const loopBox = game.collision.addBox(P.loop[0], DECK, P.loop[2], 5.0, 3.0, 5.0);
    game.onUpdate((dt, t) => { loopMat.uniforms.uTime.value = t; });
    // the anchor: a 2049 ticket post lodged in the platform, a gold thread to the loop in Residue Vision
    const anchor = new THREE.Group(); anchor.position.set(P.loopAnchor[0], DECK, P.loopAnchor[2]); scene.add(anchor);
    { const post = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.1, 0.3), new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.25, metalness: 0.6 })); post.position.y = 0.55; post.rotation.z = 0.18; anchor.add(post);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.8, 0.32), glowMat(0x2ae6ff, 3)); led.position.set(0.18, 0.62, 0); led.rotation.z = 0.18; anchor.add(led); }
    const threadG = new THREE.BufferGeometry().setFromPoints([V(P.loopAnchor[0], DECK + 0.8, P.loopAnchor[2]), V((P.loopAnchor[0] + P.loop[0]) / 2, DECK + 2.2, (P.loopAnchor[2] + P.loop[2]) / 2), V(P.loop[0], DECK + 1.2, P.loop[2])]);
    const thread = new THREE.Line(threadG, new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, toneMapped: false })); scene.add(thread); game.residue(thread);
    const anchorHalo = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })); anchorHalo.rotation.x = Math.PI / 2; anchorHalo.position.set(P.loopAnchor[0], DECK + 0.05, P.loopAnchor[2]); scene.add(anchorHalo); game.residue(anchorHalo);
    // the four seconds they keep living: Wren reaches, Joss stumbles, again
    let loopT = 0;
    game.onUpdate((dt) => {
      if (S.loopFreed) return;
      loopT += dt; const k = loopT % 4.2;
      joss.pose = k < 1.6 ? 'fall' : null; wren.pose = k < 2.4 ? 'look' : null;
      wren.lookTarget = joss.head; joss.lookTarget = wren.head;
      if (k < dt * 1.5 && Math.hypot(pl.pos.x - P.loop[0], pl.pos.z - P.loop[2]) < 16 && pl.pos.y > 5) audio.sfxPlay('rewind');
    });

    await game.waitFor(() => pl.pos.y > DECK - 0.5 && pl.pos.x < -10 && pl.pos.z < 32 && game.control && !S.busy);
    await idle();
    S.phase = 'loop'; S.main = true; cine(true);
    lockMusic('m14-zone', 1.2);
    await game.shot([-26.4, DECK + 2.2, 29.4], [P.loop[0], DECK + 1.2, P.loop[2]], 2.4, { fov: 40 });
    await game.say('kai', 'There. Both of them.');
    await game.shot([P.loop[0] + 3.6, DECK + 1.5, P.loop[2] + 3.4], [P.loop[0], DECK + 1.1, P.loop[2]], 3.2, { fov: 34 });
    await game.talk([
      ['kai', 'They\'re stuck in it. The same four seconds. Again, and again.'],
      ['m14band', 'Local loop. Anchored to an object out of phase.'],
      ['kai', 'Something on this platform doesn\'t belong to this year.'],
    ]);
    cine(false); lockMusic(null); S.main = false;
    cp(-28, DECK, 28.4, -Math.PI / 2);
    S.trail.add('t4'); F.m14trail = S.trail.size;
    objective('Free Joss and Wren · find what anchors their loop (Residue Vision: F)');
    hint(() => S.phase === 'loop' && !game.residueOn, 35, () => ui.subtitle('kai', 'Residue Vision. Whatever holds them will be shining.', 2800));
    hint(() => S.phase === 'loop' && game.residueOn, 30, () => ui.subtitle('kai', 'The gold thread runs west, to the end of the platform.', 2800));
    let freed = false;
    game.interact({ pos: [P.loopAnchor[0], DECK + 1.0, P.loopAnchor[2]], radius: 2.0, prompt: 'Pull the 2049 ticket post (hold)', hold: 2.0, onUse: () => { freed = true; } });
    await game.waitFor(() => freed);
    S.main = true; cine(true);
    S.bind = Math.max(0.1, S.bind - 0.12);
    await game.shot([P.loopAnchor[0] + 2.4, DECK + 1.6, P.loopAnchor[2] + 2.6], [P.loopAnchor[0], DECK + 0.6, P.loopAnchor[2]], 1.0, { fov: 40 });
    audio.sfxPlay('metal'); kai.pose = 'work';
    await tween(0.8, u => { anchor.rotation.z = u * 1.2; anchor.position.y = DECK + u * 0.4; });
    await tween(0.6, u => { anchor.scale.setScalar(1 - u); });
    anchor.visible = false; thread.visible = false; anchorHalo.visible = false; kai.pose = null;
    audio.sfxPlay('rewind'); game.shake = 0.15;
    await game.shot([P.loop[0] + 3.2, DECK + 1.6, P.loop[2] + 3.0], [P.loop[0], DECK + 1.1, P.loop[2]], 0.8, { fov: 38 });
    await tween(1.0, u => { loopShell.scale.set(1 - u * 0.98, 1, 1 - u * 0.98); loopMat.uniforms.uAmp.value = 1 - u; });
    loopShell.visible = false; loopBox.enabled = false; S.loopFreed = true; joss.pose = 'sad'; wren.pose = null; game.shake = 0;
    game.residueObjs = game.residueObjs.filter(o => !echoes.some(e => e.root === o)); for (const e of echoes) e.root.visible = false;
    lockMusic('m14-track', 1.4);
    pl.place(P.loop[0] + 2.4, DECK, P.loop[2] + 1.2, -Math.PI / 2 - 0.3);
    await tick();
    await game.talk([
      ['wren', '—Dad! Dad, the light. It\'s gone.'],
      ['joss', 'How long?'],
    ]);
    joss.pose = null;
    faceEach(kai, joss); wren.lookTarget = kai.head;
    await ots(joss, kai, 0.9, 36);
    await game.talk([
      ['kai', 'Two days. Sera sent me.'],
      ['wren', 'Two days. It felt like one breath. The same breath.'],
      ['joss', '...You\'ve got his face.'],
      ['kai', 'Whose?'],
      ['joss', 'You\'ll see it soon enough. It\'s in the square.'],
    ]);
    await ots(wren, kai, 0.8, 36);
    await game.talk([
      ['wren', 'Dad. He pulled us out.'],
      ['joss', 'He did.'],
    ]);
    await ots(joss, kai, 0.8, 36);
    await game.talk([
      ['joss', 'The cell\'s still in the tram, past the beam. There\'s a zone sat on the middle of that beam. It closes, every few breaths. You go when it closes.'],
      ['wren', 'It took my lamp. Don\'t let it take you.'],
      ['joss', 'The beacon wants three things. That cell. A phase coil from the Helix relay on Halcyon Tower\'s roof. And a timing crystal that still keeps time.'],
      ['joss', 'We\'ll go ahead and tell the Hall you\'re coming. Some of them won\'t like that face walking in.'],
    ]);
    joss.lookTarget = null; wren.lookTarget = null; kai.lookTarget = null;
    F.m14survivors = 'freed'; F.m14metJoss = true;
    ev('Joss and Wren, freed', 'At Meridian East a 2049 ticket post lodged in the platform held Joss and Wren Harrow in a four-second loop for two days. Kai pulled it. Joss looked at his face and said: "You\'ll see it soon enough. It\'s in the square." The beacon needs a power cell (the tram, past the beam), a phase coil (Halcyon Tower\'s roof relay) and a timing crystal.', 'SURVIVORS');
    cine(false); lockMusic(null); S.main = false;
    // they go home ahead of Kai (back down the stairs, then on to the Hall)
    (async () => {
      try {
        await Promise.all([walkTo(joss, [[-24, DECK, 30.4], [-23, DECK, 31.2]], 1.2), walkTo(wren, [[-23.4, DECK, 29.8], [-22.6, DECK, 31.2]], 1.4)]);
        show(joss, false); show(wren, false);
        joss.root.position.set(P.beacon[0] + 3.2, 0.4, P.beacon[2] + 4.4); joss.root.rotation.y = Math.PI; wren.root.position.set(P.beacon[0] - 3.4, 0.4, P.beacon[2] + 4.2); wren.root.rotation.y = Math.PI * 0.8;
      } catch (err) { void err; }
    })();
    S.phase = 'cell';
    objective('Cross the broken span on the fallen beam · go when the zone closes');
    cp(-28, DECK, 28.4, -Math.PI / 2);
    hint(() => S.phase === 'cell' && pl.pos.x < -8 && pl.pos.x > -14 && pl.pos.y > 5, 20, () => ui.subtitle('kai', 'Wait at the end of the beam. When it shrinks to nothing, run.', 2800));
    hint(() => S.phase === 'cell' && pl.pos.y < 2 && pl.pos.z > 30 && pl.pos.z < 44, 12, () => ui.subtitle('kai', 'Fell. Back up the station stairs.', 2400));

    // ---------- the tram's power cell: live, arcing every few seconds ----------
    const sp = sparks(60, 0x9ae8ff); scene.add(sp); const spAt = V(P.cell[0], DECK + 1.0, 22.36);
    let arcT = 2;
    const cellIt = game.interact({ pos: [P.cell[0], DECK + 1.0, 21.6], radius: 1.9, prompt: 'Free the power cell (hold) · wait for the arcs to settle', hold: 2.2, once: false, enabled: () => !S.comp.cell && !S.arc, onUse: () => getCell() });
    game.onUpdate((dt) => {
      sp.userData.update(dt);
      if (S.comp.cell) return;
      arcT -= dt;
      if (arcT <= 0) {
        S.arc = !S.arc; arcT = S.arc ? 1.3 : 4.0;
        if (S.arc) sp.userData.burst(spAt); W.cellGlow.material.emissiveIntensity = S.arc ? 6 : 2;
        if (S.arc && Math.hypot(pl.pos.x - P.cell[0], pl.pos.z - 21.6) < 6 && pl.pos.y > 5) audio.sfxPlay('spark');
        if (S.arc && cellIt.progress > 0.08 && Math.hypot(pl.pos.x - P.cell[0], pl.pos.z - 21.6) < 2.2) {
          cellIt.progress = 0; S.bind = Math.max(0.05, S.bind - 0.08); game.shake = 0.14; ui.subtitle('kai', 'Ah—! Wait for it to settle.', 2000); F.m14shocks = (F.m14shocks || 0) + 1;
        }
      }
    });
    const getCell = () => {
      if (S.comp.cell) return;
      S.comp.cell = true; F.m14cell = true; audio.sfxPlay('success'); W.cellGlow.visible = false;
      ev('Component: the power cell', 'A Line 4 traction cell, still holding charge after a century and a half, freed from the wrecked tram between its arcs.', 'RETURN BEACON · ' + compCount() + '/3');
      ui.subtitle('kai', 'One. Still warm.', 2200);
      setTimeout(() => radio('You\'ve got the cell? Joss won\'t say it, but he\'ll cry.', 3200), 2400);
      nextObjective();
    };
    await game.waitFor(() => pl.pos.x > 6.5 && pl.pos.y > DECK - 0.6);
    F.m14beam = true; cp(12, DECK, 26.6, Math.PI / 2);
    if (!S.comp.cell) { objective('Free the tram\'s power cell · the bay on the north side · between the arcs'); ui.subtitle('kai', 'Across. The cell\'s live. It arcs every few seconds.', 2800); }
    S.phase = 'parts';

    // ---------- Halcyon Tower: the relay's phase coil ----------
    const compCount = () => (S.comp.cell ? 1 : 0) + (S.comp.coil ? 1 : 0) + (S.comp.crystal ? 1 : 0);
    function nextObjective() {
      if (S.beacon) return;
      const left = [];
      if (!S.comp.cell) left.push('the tram\'s power cell');
      if (!S.comp.coil) left.push('the phase coil · Halcyon Tower roof');
      if (!S.comp.crystal) left.push(S.memorial ? 'a timing crystal · the memorial clock or the flooded underpass' : 'a timing crystal');
      if (!left.length) objective(S.hall ? 'Repair the return beacon at the north end of Lantern Hall' : S.gateOpen ? 'Take the parts to Lantern Hall\'s return beacon · north of the square' : 'Take the parts to Lantern Hall · north, past the Memorial Square');
      else objective(`Beacon parts ${compCount()}/3 · ${left.join(' · ')}`);
    }
    W.racks.forEach((r, i) => {
      game.interact({ pos: [r.coil.position.x, ROOF + 1.1, -29.6], radius: 1.1, prompt: `Take coil ${['A', 'B', 'C'][i]}`, enabled: () => !S.comp.coil && !r.gone, once: false, onUse: () => {
        if (!r.ok) {
          r.gone = true; S.coilMiss++; F.m14coilMisses = S.coilMiss; audio.sfxPlay('metal');
          const c = r.coil; tween(0.6, u => { c.position.y = ROOF + 1.0 - u * 0.9; c.rotation.x = u * 2; }).then(() => { c.visible = false; });
          ui.subtitle('kai', 'Rusted through. It comes apart in my hand. Read the panels.', 2800);
          return;
        }
        S.comp.coil = true; F.m14coil = true; r.coil.visible = false; audio.sfxPlay('success');
        ev('Component: the phase coil', 'From City Relay 4 on Halcyon Tower\'s podium roof: coil B, marked 0814, the only one of three whose panel still read "PHASE · HOLDING". It still keeps a faint beat.', 'RETURN BEACON · ' + compCount() + '/3');
        ui.subtitle('kai', 'This one\'s still holding a beat. Eight-fourteen.', 2600);
        setTimeout(() => radio('Joss has been talking about that relay for ten years. Nobody would climb it.', 3200), 2800);
        nextObjective();
      } });
    });
    let towerIntro = false;
    game.onUpdate(() => {
      if (towerIntro || !game.control || ui.dlgActive || S.busy) return;
      if (!(pl.pos.y > ROOF - 0.5 && pl.pos.x < 27 && pl.pos.z < -6)) return;
      towerIntro = true;
      side(async () => {
        S.main = true; cine(true);
        await game.shot([pl.pos.x + 3, ROOF + 3.2, pl.pos.z + 4], [-8, 6, -56], 3.2, { fov: 46 });
        await game.say('kai', 'From up here you can see it. The square. And something standing in the middle of it.');
        await game.shot([22, ROOF + 2.0, -26.6], [19.8, ROOF + 1.3, -30.6], 1.6, { fov: 40 });
        await game.say('kai', 'Three coils. Only one of them can still be holding its phase.');
        cine(false); S.main = false;
      });
    });
    hint(() => S.phase === 'parts' && !S.comp.coil && pl.pos.y < 1 && pl.pos.z < 12 && pl.pos.x > 10, 45, () => ui.subtitle('kai', 'The podium\'s stairs: west side first, then the east corner, then back west.', 3000));
    hint(() => !S.comp.coil && pl.pos.y > L2 - 0.5 && pl.pos.y < ROOF - 1, 30, () => ui.subtitle('kai', 'The only way west on this floor is through the zone. Wait until it pulls in.', 3000));

    // ---------- the Memorial Square: the statue, Sera, the quote ----------
    let memorialDone = false;
    const memorialScene = async () => {
      S.main = true; cine(true); S.memorial = true; F.m14memorial = true;
      lockMusic('m14-memorial', 2.2);
      audio.silence?.(1.2);
      await game.shot([-2, 0.6, -40.6], [-8, 6.2, -55], 0.01, { fov: 46 });
      await game.shot([-5, 0.9, -45.5], [-8, 5.6, -55], 5.0, { fov: 40 });
      await game.say('kai', '...That\'s me.');
      await game.shot([-8.6, 1.6, -48.6], [-8, 1.3, -52.3], 2.6, { fov: 32 });
      await game.say('kai', '"Architect of the Fracture."');
      // Sera, behind him
      show(sera, true); sera.root.position.set(-1.2, 0, -41.2); sera.root.rotation.y = Math.PI;
      pl.place(-6.4, 0, -47.6, Math.PI); await tick();
      walkTo(sera, [[-3.4, 0, -45.6]], 1.3);
      await game.shot([-9.8, 1.7, -50.2], [-4.6, 1.5, -46.4], 2.4, { fov: 40 });
      await game.say('sera', 'It\'s been you for a hundred and forty-seven years.');
      await game.waitFor(() => sera.speed === 0);
      faceEach(kai, sera);
      await ots(sera, kai, 1.0, 36);
      await game.talk([
        ['kai', 'Sera. How did you—'],
        ['sera', 'You walked the Reach. I ran the canal. It\'s shorter when nobody\'s shooting at you.'],
      ]);
      await ots(kai, sera, 0.9, 36);
      await game.talk([
        ['kai', 'I haven\'t built anything. Not like that. It hasn\'t happened.'],
        ['sera', 'Not to you. To everyone on that wall, it happened.'],
        ['kai', 'How many names?'],
        ['sera', 'Eleven thousand, here. Every settlement has a wall like this one.'],
        ['kai', 'And a statue of the man you blame.'],
      ]);
      await game.shot([-4.6, 1.62, -48.2], [-3.4, 1.6, -45.6], 1.4, { fov: 30 });
      await game.say('sera', 'So nobody forgets the face. We teach children your name before they learn the names of the dead.');
      F.m14quote = true;
      audio.silence?.(2.2);
      await game.shot([-11, 0.8, -46], [-8, 6.4, -55], 3.0, { fov: 44 });
      await game.wait(0.6);
      await ots(kai, sera, 0.9, 34);
      await game.say('kai', 'Then they\'re being taught wrong.');
      await ots(sera, kai, 0.9, 34);
      await game.say('sera', 'You\'d be surprised how often I hear that.');
      await game.shot([0.2, 1.8, -42.4], [4, 3.6, -46], 1.8, { fov: 40 });
      await game.talk([
        ['sera', 'Joss\'s timing crystal. There\'s one in that clock. It stopped at 08:14, and people have left stones at its foot ever since.'],
        ['kai', 'And if I take it?'],
        ['sera', 'Then it\'s a clock with a hole in it. They\'ll know who made the hole.'],
        ['sera', 'There\'s another in the old Line 4 underpass, west of the square. Flooded. And the ground down there doesn\'t hold still.'],
        ['sera', 'Lantern Hall is through the north gate. I\'ll go and open it.'],
      ]);
      ev('The memorial', 'In the Memorial Square of the Reach stands a bronze statue of Kai Varen before the ring of a machine, on a plinth that calls him "ARCHITECT OF THE FRACTURE", ringed by a wall of eleven thousand names. Sera: "We teach children your name before they learn the names of the dead."', 'THE MEMORIAL');
      sera.lookTarget = null; kai.lookTarget = null;
      walkTo(sera, [[1, 0, -60], [1.6, 0, -73.6]], 1.6).then(() => { sera.root.rotation.y = 0; S.gateOpen = true; openGate(); });
      cine(false); lockMusic(null); S.main = false; memorialDone = true;
      cp(-1, 0, -43.4, Math.PI);
      nextObjective();
    };
    game.onUpdate(() => {
      if (S.memorial || S.busy || !game.control || ui.dlgActive) return;
      if (pl.pos.z < -37.5 && pl.pos.z > -72 && pl.pos.x > -30 && pl.pos.x < 10 && pl.pos.y < 1) side(memorialScene);
    });
    const openGate = () => {
      if (W.gateBox.enabled === false) return;
      audio.sfxPlay('door'); W.gateBox.enabled = false;
      tween(2.2, u => { W.gate.position.y = 1.5 + u * 2.9; });
    };
    hint(() => S.phase === 'parts' && !S.memorial && S.comp.coil && pl.pos.z > -36, 50, () => ui.subtitle('kai', 'North and west of the tower. The square.', 2600));

    // ---------- the timing crystal: the memorial clock, or the flooded underpass ----------
    game.interact({ pos: [P.clock[0], 1.4, P.clock[2] + 0.8], radius: 1.9, prompt: 'Open the stopped clock', once: false, enabled: () => S.memorial && !S.comp.crystal && !S.busy, onUse: () => side(async () => {
      S.main = true; cine(true);
      await game.shot([P.clock[0] + 1.8, 2.2, P.clock[2] + 2.6], [P.clock[0], 2.8, P.clock[2]], 1.2, { fov: 40 });
      const c = await choose('kai', 'The crystal behind the hatch has kept the square\'s time since 08:14. Take it?', ['Take it. The beacon has to work.', 'Leave the clock. Find the other one.'], 1);
      if (c === 0) {
        audio.sfxPlay('metal'); await tween(0.6, u => { W.clockHatch.rotation.y = -u * 1.6; W.clockHatch.position.x = P.clock[0] + 0.18 * u; });
        W.clockCrystal.visible = true; await game.wait(0.5); W.clockCrystal.visible = false; audio.sfxPlay('success');
        S.comp.crystal = 'memorial'; F.m14crystal = 'memorial';
        ev('Component: the timing crystal (memorial)', 'Taken from behind the hatch of the stopped clock in the Memorial Square. The clock still shows 08:14; now nothing keeps it.', 'RETURN BEACON · ' + compCount() + '/3');
        await game.say('kai', 'I\'m sorry. I\'ll bring it back if I can.');
        setTimeout(() => radio('You opened the clock. ...Fine. If anyone asks, I told you to.', 3600), 600);
      } else {
        await game.say('kai', 'Not this one. The underpass, west of the square.');
        S.underpass = true; F.m14crystalChoice = 'underpass';
      }
      cine(false); S.main = false; nextObjective();
      if (!S.comp.crystal) objective('The flooded Line 4 underpass, west of the square · the departure board · go when the zone pulls in');
    }) });
    game.interact({ pos: [P.board[0] + 0.4, PIT + 1.6, P.board[2]], radius: 1.8, prompt: 'Take the timing crystal from the departure board (hold)', hold: 2.0, once: false, enabled: () => !S.comp.crystal, onUse: () => {
      if (S.comp.crystal) return;
      W.boardCrystal.visible = false; audio.sfxPlay('success');
      S.comp.crystal = 'underpass'; F.m14crystal = 'underpass'; F.seraTrust = (F.seraTrust || 0) + 1;
      ev('Component: the timing crystal (underpass)', 'From the drowned departure board of the Line 4 underpass, stopped at 08:14 like everything else. Kai left the memorial clock alone.', 'RETURN BEACON · ' + compCount() + '/3');
      ui.subtitle('kai', 'Got it. Now out, before it breathes again.', 2600);
      setTimeout(() => radio(S.memorial ? 'You went down there instead of opening the clock. ...Thank you.' : 'You found the underpass board? Good. Leave the clock in the square alone.', 3400), 2800);
      nextObjective();
    } });
    hint(() => S.underpass && !S.comp.crystal && pl.pos.x < -32 && pl.pos.y < -1, 25, () => ui.subtitle('kai', 'There\'s a dry alcove by the board. Run for it when the ring turns green.', 3000));

    // ---------- Lantern Hall ----------
    const hallArrival = async () => {
      S.main = true; cine(true); S.hall = true; F.m14hall = true;
      for (const s of settlers) show(s, true); show(child, true);
      lockMusic('m14-hall', 2);
      await game.shot([0, 9, -78], [0, 3, -110], 0.01, { fov: 54 });
      await game.shot([2, 5, -82], [0, 2.2, -106], 4.0, { fov: 50 });
      settlers.forEach(s => { s.pose = null; s.lookTarget = kai.head; }); child.lookTarget = kai.head;
      await game.shot([-1.4, 1.7, -84.6], [0, 1.5, -92], 1.4, { fov: 42 });
      sera.root.position.set(1.6, 0, -82.4); sera.root.rotation.y = Math.PI * 0.85; show(sera, true);
      const crystalLine = S.comp.crystal === 'memorial' ? [['m14settler', 'He opened the clock. I saw the hatch hanging.'], ['sera', 'I told him to. Take it up with me.']] : [];
      await game.talk([
        ['m14settler', 'That\'s him. That\'s the face from the square.'],
        ['m14medic', 'Don\'t. Not in front of the children.'],
        ['sera', 'He\'s with me. He brought Joss and Wren home.'],
        ...crystalLine,
      ]);
      show(joss, true); show(wren, true);
      joss.root.position.set(-2, 0, -88); joss.root.rotation.y = 0.2; wren.root.position.set(-3.2, 0, -88.6); wren.root.rotation.y = 0.5;
      await game.shot([-0.2, 1.7, -85], [-2, 1.55, -88], 1.2, { fov: 38 });
      await game.say('joss', 'He pulled us out of a loop at Meridian East. Whatever his face did, his hands did that.');
      settlers.forEach((s, i) => { s.lookTarget = null; s.pose = ['sit', 'work', 'work', null, 'work', 'sit'][i]; }); child.lookTarget = null;
      walkTo(joss, [[2.4, 0, -100], [P.beacon[0] + 3.2, 0.4, P.beacon[2] + 4.4]], 1.3).then(() => { joss.root.rotation.y = Math.PI; joss.pose = 'work'; });
      walkTo(wren, [[-2.6, 0, -100], [P.beacon[0] - 3.4, 0.4, P.beacon[2] + 4.2]], 1.4).then(() => { wren.root.rotation.y = Math.PI * 0.8; });
      walkTo(sera, [[3.6, 0, -100], [P.seraHall[0], 0.4, P.seraHall[2]]], 1.5).then(() => { sera.root.rotation.y = Math.PI * 0.2; });
      ev('Lantern Hall', 'The survivors\' settlement in the old Central Freight shed: about a hundred and twenty people, gardens in the track bed, a cistern, a market on the east platform, homes on the west. The return beacon stands at the north end. They know Kai\'s face from the square.', 'LANTERN HALL');
      cine(false); lockMusic(null); S.main = false;
      cp(P.gate[0] + 1, 0, -80, Math.PI);
      nextObjective();
    };
    game.onUpdate(() => {
      if (S.hall || S.busy || !game.control || ui.dlgActive || !W.gateBox || W.gateBox.enabled) return;
      if (pl.pos.z < -78.5) side(hallArrival);
    });
    game.onUpdate(() => { if (!S.gateOpen && S.memorial && memorialDone && Math.hypot(pl.pos.x - P.gate[0], pl.pos.z - P.gate[2]) < 9) { S.gateOpen = true; openGate(); } });

    // optional talks in the Hall
    const talkOnce = (id, pos, prompt, lines, fn) => game.interact({ pos, radius: 2.2, prompt, once: false, enabled: () => S.hall && !S.talked.has(id), onUse: () => side(async () => { S.talked.add(id); F.m14talks = S.talked.size; await game.talk(lines()); fn?.(); }) });
    talkOnce('trader', [17.2, 2.0, -112], 'Talk to the trader', () => [
      ['m14trader', m13 === 'destroy' ? 'They say the Sable spire came down. First good news on the radio in a year.' : m13 === 'free' ? 'They say the Sable spire stands empty, and Lasker\'s spitting nails about it.' : 'Water, salt, lamp oil. Not for you. Sera\'s word or not.'],
      ['kai', m13 ? 'I was there.' : 'I\'m not buying.'],
      ['m14trader', m13 ? 'Course you were. You\'re always there, aren\'t you? Where it breaks.' : 'Good. Then we\'re both happy.'],
    ]);
    talkOnce('medic', [-17, 2.0, -110], 'Talk to the medic', () => [
      ['m14medic', 'If your band\'s bleeding, I can\'t help you. If you are, sit down.'],
      ['kai', 'Do you believe it? What the plaque says?'],
      ['m14medic', 'I believe eleven thousand people. The plaque\'s just bronze.'],
    ]);
    talkOnce('child', [16.2, 2.2, -94.4], 'Talk to the child at the slate', () => [
      ['m14child', 'Are you him? From the wall?'],
      ['kai', 'I don\'t know yet.'],
      ['m14child', 'We learn your name first. Then Ruth. Then everybody else.'],
    ], () => { F.m14child = true; });
    game.interact({ pos: P.slate, radius: 2.2, prompt: 'Read the school slate', enabled: () => S.hall, onUse: () => {
      F.m14slate = true; audio.sfxPlay('pickup');
      ev('The school slate', 'Chalked for the Hall\'s children: "WHO WAS KAI VAREN? He built the machine. He broke the hour. We say his name first so it is never done again." Under it: "then: the names of our dead (wall, row 1)".', 'LANTERN HALL');
      ui.subtitle('kai', 'First lesson of the day.', 2400);
    } });
    game.interact({ pos: P.ledger, radius: 2.2, prompt: 'Read the arrivals ledger', enabled: () => S.hall, onUse: () => {
      F.m14ledger = true; audio.sfxPlay('pickup');
      ev('Lantern Hall ledger', 'The arrivals board: "41 from the Sable line (S.V.) · Joss + Wren: OUT (beacon parts) · \'The architect walked out of the Sable fire.\' (S.V. radio) — do NOT tell the children yet."', 'LANTERN HALL');
      ui.subtitle('kai', 'Sera radioed ahead about me. Before she met me in the square.', 3000);
    } });

    // ---------- optional: the Survivor's Garden (Ama's beds) ----------
    const diverted = !!(F.m5_riverDiverted || F.m5_waterQuest);
    W.channel.visible = diverted;
    talkOnce('ama', [P.ama[0], 1.2, P.ama[2]], 'Talk to the gardener', () => [
      ['ama', 'Nine days the beds have been dry. The cistern\'s full. The line\'s dead.'],
      ['kai', 'Valves?'],
      ['ama', 'Three. The top of the cistern, the run by the west platform, the manifold here at the beds. Ruth knew the order. Ruth\'s on the wall now.'],
      ['ama', 'Open them wrong and the joints blow, and we\'re carrying water by hand again.'],
    ], () => { S.garden = 'active'; F.m14garden = 'asked'; objective(S.obj); ui.toast('OPTIONAL · THE SURVIVOR\'S GARDEN · OPEN AMA\'S THREE VALVES IN THE RIGHT ORDER', 4000); });
    const ORDER = ['beds', 'run', 'top'];
    const valve = (key, pos, label) => game.interact({ pos, radius: 1.9, prompt: `Open the ${label} valve`, once: false, enabled: () => S.garden === 'active' && !S.valves.includes(key) && !S.busy, onUse: () => {
      const v = W.valves[key]; audio.sfxPlay('metal'); tween(0.5, u => { v.rotation.z = u * Math.PI; });
      S.valves.push(key);
      if (S.valves[S.valves.length - 1] !== ORDER[S.valves.length - 1]) {
        game.shake = 0.12; audio.sfxPlay('fail');
        const spray = sparks(80, 0x9ac8e8); scene.add(spray); spray.userData.burst(v.position);
        const off = game.onUpdate(dt => spray.userData.update(dt)); setTimeout(() => { off(); scene.remove(spray); }, 1600);
        ui.subtitle('ama', 'No! She\'s blowing at the joints. Close them all, start again. Read the chalk on the legs.', 3400);
        S.valves = []; F.m14valveMisses = (F.m14valveMisses || 0) + 1;
        for (const k of Object.keys(W.valves)) W.valves[k].rotation.z = 0;
        return;
      }
      if (S.valves.length < 3) { ui.toast(`VALVE ${S.valves.length}/3 OPEN`, 1600); return; }
      S.garden = 'done'; F.m14garden = 'restored'; F.seraTrust = (F.seraTrust || 0) + 1; audio.sfxPlay('success');
      W.flow.visible = true; audio.water?.(0.08);
      side(async () => {
        S.main = true; cine(true);
        await game.shot([-2, 1.8, -94], [-3.5, 0.6, -104], 1.6, { fov: 44 });
        ama.pose = null; ama.lookTarget = kai.head;
        await game.talk([
          ['ama', 'Listen to that. Listen.'],
          ...(diverted ? [['ama', 'And the old channel by the east wall started running a week ago. The channel is running again. Nobody alive remembers who opened it.'], ['kai', 'I might.']] : [['ama', 'Ruth would have cried. I\'m not going to. Not in front of you.']]),
        ]);
        ev('The Survivor\'s Garden', diverted ? 'Kai opened the cistern line in the right order (beds, run, top) and Lantern Hall\'s beds are watered again. The old channel along the east wall runs too: water first turned in a settlement three thousand years ago.' : 'Kai opened the cistern line in the right order (beds, run, top) and Lantern Hall\'s beds are watered again.', 'LANTERN HALL');
        ama.lookTarget = null; ama.pose = 'work';
        cine(false); S.main = false;
      });
    } });
    valve('top', [P.vTop[0], P.vTop[1] + 1, P.vTop[2]], 'cistern top');
    valve('run', [P.vRun[0], 1.0, P.vRun[2]], 'west run');
    valve('beds', [P.vBeds[0], 1.0, P.vBeds[2]], 'beds manifold');
    game.interact({ pos: [P.cistern[0] - 1.6, 1.6, P.cistern[2] + 2.4], radius: 2.0, prompt: 'Read the chalk on the cistern legs', enabled: () => S.hall, onUse: () => {
      F.m14chalk = true; audio.sfxPlay('pickup');
      ev('Ruth\'s chalk', 'On the cistern legs, in old chalk gone over many times: "BEDS · RUN · TOP — bottom up or she blows."', 'LANTERN HALL');
    } });

    // ---------- the return beacon ----------
    let fitted = false;
    game.interact({ pos: [P.beacon[0], 1.4, P.beacon[2] + 3.2], radius: 2.0, prompt: 'Fit the beacon parts', once: false, enabled: () => S.hall && !fitted && !S.busy, onUse: () => {
      if (compCount() < 3) {
        const miss = [!S.comp.cell && 'a power cell', !S.comp.coil && 'a phase coil', !S.comp.crystal && 'a timing crystal'].filter(Boolean);
        ui.subtitle('joss', 'Not yet. It still wants ' + miss.join(' and ') + '.', 3000); return;
      }
      fitted = true;
    } });
    hint(() => S.hall && compCount() === 3 && !fitted, 45, () => ui.subtitle('sera', 'Joss is at the beacon. North end. He\'s been waiting thirty years, Varen.', 3200));
    await game.waitFor(() => fitted && !S.busy && game.control);
    await idle();

    // fitting and tuning
    S.main = true; cine(true); S.drain = false;
    lockMusic('m14-beacon', 1.6); musicState.beacon = 0;
    pl.place(P.beacon[0] + 0.6, 0.4, P.beacon[2] + 3.6, Math.PI);
    joss.root.position.set(P.beacon[0] + 2.0, 0.4, P.beacon[2] + 3.2); joss.root.rotation.y = -1.6; joss.pose = null; show(joss, true);
    sera.root.position.set(P.beacon[0] - 2.4, 0.4, P.beacon[2] + 4.6); sera.root.rotation.y = 2.6; show(sera, true);
    await tick();
    await game.shot([P.beacon[0] - 2.6, 1.9, P.beacon[2] + 4.2], [P.beacon[0] + 0.2, 1.4, P.beacon[2] + 2.0], 1.4, { fov: 40 });
    for (let i = 0; i < 3; i++) { audio.sfxPlay('pickup'); W.sockets[i].material.emissiveIntensity = 2.6; musicState.beacon = (i + 1) * 0.2; await game.wait(0.6); }
    faceEach(kai, joss);
    await ots(joss, kai, 0.9, 36);
    await game.talk([
      ['joss', 'Cell. Coil. Crystal. Thirty years I\'ve waited to see those three lights.'],
      ['joss', 'Now it wants a reference. It calls one second in your year, and it has to know which second.'],
    ]);
    let tuned = false;
    while (!tuned) {
      const c = await choose('kai', 'Set the beacon\'s anchor second (Helix Sub-Level 4, 2049)', ['08:05:00', '08:14:00', '08:23:00'], 1);
      if (c === 1) { tuned = true; break; }
      S.tuneMiss++; F.m14tuneMisses = S.tuneMiss; audio.sfxPlay('fail');
      await game.talk([
        ['joss', 'It doesn\'t know that second. It\'s listening for one it has heard before.'],
        ['kai', 'The clock in the square. The board in the underpass. The coil that still held its beat. Everything here stopped at the same minute.'],
      ]);
    }
    audio.sfxPlay('switch');
    await game.shot([P.beacon[0] + 6, 3, P.beacon[2] + 9], [P.beacon[0], 10, P.beacon[2]], 2.4, { fov: 48 });
    await tween(2.4, u => { W.emitter.material.emissiveIntensity = u * 4; W.emitter.rotation.z = u * 3; musicState.beacon = 0.6 + u * 0.4; });
    await game.shot([24, 46, -40], [0, 40, -121], 0.01, { fov: 56 });
    await tween(3.0, u => { W.beam.material.opacity = u * 0.35; W.beam.scale.set(1, 0.05 + u * 0.95, 1); W.beam.position.y = 13 + 60 * (0.05 + u * 0.95); });
    game.onUpdate((dt, t) => { W.emitter.rotation.z += dt * 0.8; W.beam.material.opacity = 0.3 + Math.sin(t * 0.8) * 0.04; });
    await game.wait(1.2);
    S.bind = 1; T.stability = 1; kai.wristBoost = 6;
    await game.shot([P.beacon[0] + 1.6, 1.8, P.beacon[2] + 6.4], [P.beacon[0] + 0.6, 1.5, P.beacon[2] + 3.6], 1.2, { fov: 38 });
    await game.say('m14band', 'Anchor acquired. Helix Sub-Level 4, 2049. Binding stable.');
    wren.root.position.set(P.beacon[0] - 3.6, 0.4, P.beacon[2] + 6.2); wren.root.rotation.y = 2.8; show(wren, true);
    await game.talk([
      ['joss', 'It\'s talking to something. Thirty years, and it\'s talking.'],
      ['wren', 'It\'s talking to his year, Dad.'],
    ]);
    S.beacon = true; F.returnBeacon = true; F.m14beacon = 'repaired'; F.m14anchorSecond = '08:14:00';
    T.configure([{ id: '2196', key: '3', name: 'FUTURE', year: 'LANTERN HALL · 2196 · ANCHORED', glyph: '◑', color: '#b6ff8a', theme: 'm14-reveal', apply: () => {} }], '2196');
    ev('The return beacon', 'Lantern Hall\'s Helix return beacon (unit 7) runs again with the tram\'s cell, the relay\'s phase coil and a timing crystal, anchored to 08:14:00 at Helix Sub-Level 4 in 2049. It holds a road back to Kai\'s year open, and his binding is stable.', 'RETURN BEACON · 3/3');

    // =====================================================================================
    // ENDING: every version of you
    // =====================================================================================
    lockMusic('m14-reveal', 2.6);
    joss.lookTarget = null; joss.pose = 'work';
    walkTo(wren, [[P.beacon[0] - 3.5, 0, P.beacon[2] + 10]], 1.2);
    sera.root.position.set(P.beacon[0] - 1.6, 0.4, P.beacon[2] + 3.1); pl.place(P.beacon[0] + 1.4, 0.4, P.beacon[2] + 3.4, -Math.PI / 2);
    await tick();
    faceEach(kai, sera);
    await game.shot([P.beacon[0] - 0.1, 1.9, P.beacon[2] + 7.4], [P.beacon[0], 1.5, P.beacon[2] + 3.2], 1.6, { fov: 40 });
    await game.talk([
      ['kai', 'It holds. A road back to 2049, whenever I want it.'],
      ['sera', 'Whenever you want it.'],
    ]);
    audio.silence?.(1.4);
    await game.wait(0.8);
    await ots(sera, kai, 1.0, 32);
    await game.talk([
      ['sera', 'Before you take it. In the square you said they were being taught wrong.'],
      ['kai', 'They are.'],
      ['sera', 'You\'re the seventeenth Kai Varen I\'ve watched stand under that statue.'],
    ]);
    await ots(kai, sera, 0.9, 32);
    await game.talk([
      ['kai', '...Seventeenth.'],
      ['kai', 'Niko said that. In the settlement, three thousand years ago. "You are the seventeenth."'],
    ]);
    await ots(sera, kai, 0.9, 32);
    await game.talk([
      ['sera', 'Different years on their bands. Different scars. The same face. I walked three of them out of Block D4 myself.'],
      ['sera', 'Every one of them read the plaque. And every one of them said the same thing.'],
      ['kai', 'That it wasn\'t me.'],
    ]);
    await game.shot([P.beacon[0] + 0.2, 1.62, P.beacon[2] + 4.6], [P.beacon[0] - 1.6, 1.6, P.beacon[2] + 3.1], 1.2, { fov: 28 });
    await game.say('sera', 'Every version of you denies it. Every single one. It\'s the only thing about you that never changes.');
    F.m14denial = true; F.seraKnowsVersions = true;
    audio.silence?.(2.4);
    await game.shot([P.beacon[0] - 0.6, 1.6, P.beacon[2] + 5.0], [P.beacon[0] + 1.4, 1.55, P.beacon[2] + 3.4], 2.6, { fov: 30 });
    await game.say('kai', 'What happened to them? The others.');
    await ots(sera, kai, 0.9, 30);
    await game.say('sera', 'They went home.');
    await game.wait(0.8);
    await game.say('sera', 'And the Fracture still happened.');
    ev('Every version of you', 'At the beacon Sera told Kai he is the seventeenth Kai Varen she has watched stand under the statue in the square: different years on their bands, different scars, the same face. Every one of them read the plaque and said it wasn\'t him. "Every version of you denies it." They all went home, and the Fracture still happened.', 'SERA VOSS');
    sera.lookTarget = null; kai.lookTarget = null;

    // ---------- completion ----------
    F.m14done = true; F.m14shards = S.shards; F.m14evidence = S.ev.size; F.m14components = 3; F.m14settlement = 'Lantern Hall';
    if (!F.metSera) F.metSera = true; void metSera;
    await game.shot([28, 34, -60], [0, 20, -121], 5.0, { fov: 52 });
    await ui.fade(1, 2600);
    const mins = Math.round((game.time - tStart) / 60);
    await ui.chapterCard('MISSION 14 COMPLETE', 'Welcome to 2196', `The beacon holds · Crystal: ${S.comp.crystal === 'memorial' ? 'the memorial clock' : 'the underpass'} · Garden ${S.garden === 'done' ? 'restored' : 'dry'} · Shards ${S.shards}/5 · Trail ${S.trail.size}/4${mins ? ' · ' + mins + ' min' : ''}`, 4200);
    kai.lookTarget = null; game.releaseCam(); ui.letterbox(false); audio.allBeds?.(0); audio.setTheme(null);
  },
};
