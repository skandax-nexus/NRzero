// MISSION 19 · THE PLACE OUTSIDE TIME (Act IV) — test player mastery without ordinary wayfinding.
// Bible: "Kai enters a region beyond the Chronolith's normal states; roads loop, rooms connect impossibly, and the sky
// shows an unbuilt city." Playable sequence (no objective markers anywhere; objectives are only what Kai notices):
//   I   Navigate using recurring symbols ........ Meridian Avenue returns on itself; the clockmaker's mark picks the turn
//   II  Recognize the clockmaker's mark, the observatory pattern and the Helix badge ... the House of Rooms (decoys
//       loop back to the workshop) and the Gallery of Three's great door
//   III Cross a bridge visible only in reflections .. the mirror gorge (the deck exists only in the lake)
//   IV  Reach a door that appears in several locations .. the Concourse of Doors ("Don't follow the footsteps. Follow
//       what they refuse to step on."): Residue Vision shows where every earlier Kai walked
// Quote: "You've been trying to reach the version of me that would forgive you."
// Ending: Mira challenges Kai's assumption that saving her is the same as understanding her.
// Orren (bible NPC): navigation hints, rule-discovery scenes, optional conversations; never confirmed as person,
// memory or pattern. Optional: the Unwritten Record (four pages), the timetable, the Courier, the square's plaque,
// Kai's ID card, the Varen kitchen (a residue memory), the Child in the Station (the three-note tune), six shards.
// Test hooks: window.__m19; ?m19part=1..4 starts at a chapter (development only).
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import {
  registerM19Cast, registerM19Themes, musicState, AV, LAPS, SQ, ROOMS, ROOM_X, DOORS, SIDE, DIAL, BR, PLZ, HALL, LAKE, VISITORS26,
  buildAvenue, buildSquare, buildRooms, buildMirror, buildHall, stripInfo, disposeGroup, shardMesh, pageMesh,
} from '../world/env_m19.js';

const PI = Math.PI;
const GHOST_MIRA = 0x9a7bff, GHOST_KID = 0xffd8a0;
const SHARDS = 6, PAGES = 4;
const DIAL_TEXT = {
  clock: { true: 'Hands at 8:14 · MCMLXI above · HENSEL below', mirror: 'Hands at 3:46 · the lettering reversed', nine: 'Hands at 9:00 · MCMLXI above · HENSEL below', late: 'Hands at 8:41 · MCMLXI above · HENSEL below' },
  star: { true: 'Seven stars · the pole star centred · the notch to the east', six: 'Six stars · the pole star centred · the notch to the east', mirror: 'Seven stars · the pole star centred · the notch to the west', shift: 'Seven stars · the pole star off centre · the notch to the east' },
  helix: { true: 'Four white orbits round a dot', gold: 'Four gold orbits inside a hexagon', three: 'Three white orbits round a dot' },
};
const DIAL_NAME = { clock: 'The clock dial', star: 'The star dial', helix: 'The badge dial' };

export default {
  id: 'm19', act: 'ACT IV · THE UNWRITTEN SECOND', title: 'The Place Outside Time', sub: 'Impossible architecture',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM19Cast(); registerM19Themes();
    game.ui.missionTag('MISSION 19 · THE PLACE OUTSIDE TIME'); game.ui.show('hud', true);
    const kai = pl.char;
    const pattern = F.miraPattern || 61;
    const witnessEcho = !!F.m18witnessEcho, iterations = F.witnessIterations || 1046;
    const startPart = Math.max(1, Math.min(4, +(new URLSearchParams(location.search).get('m19part') || 1)));
    const portraits = (ids) => { try { const need = ids.filter(id => !ui.portraits[id] && CAST[id]?.look); if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]])))); } catch (err) { console.warn('m19 portraits', err); } };

    // ---------- mission-wide state ----------
    const G = { ch: 0, shards: 0, shardList: [], ev: new Set(), pages: new Set(), laps: 0, wrong: 0, endLoops: 0, roomLoops: 0, lockMisses: 0, falls: 0, hops: 0,
      offPath: 0, orren: new Set(), child: 'none', kitchen: false, idCard: false, symbols: new Set(), residueUsed: false, answer: null };
    let S = {}, W = null, prevRoot = [];
    window.__m19 = { G, get S() { return S; }, get W() { return W; }, AV, LAPS, SQ, ROOM_X, DOORS, BR, PLZ, HALL };

    // ---------- helpers (per chapter they read S) ----------
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const ev = (title, text, tag = 'OUTSIDE TIME') => { if (G.ev.has(title)) return; G.ev.add(title); ui.addEvidence(title, text, tag); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };
    const choose = (id, text, opts, correct = 0) => { if (game.autoplay) game.autoChoice = game.autoQueue?.length ? game.autoQueue.shift() : correct; return game.choice(id, text, opts); };
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive || S.busy) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u), u); if (u >= 1) { off(); res(); } }); });
    const side = async (fn) => {
      if (S.busy || !game.control || game._failing) return; S.busy = true;
      try { await fn(); } catch (err) { if (err?.name === 'Abort' || String(err).includes('Abort')) throw err; console.warn('m19 side', err); } finally { S.busy = false; if (!S.main) { game.control = true; ui.letterbox(false); game.releaseCam(); } }
    };
    const act = (o) => {
      const it = game.interact({ radius: 1.8, ...o, once: false, onUse: (x) => { if (S.busy || game._failing) return; if (o.enabled && !o.enabled()) return; o.onUse(x); } });
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
      const sd = 0.7 + Math.max(0, 2.2 - d) * 0.45, back = 1.35, sy = small.has(speaker) ? 1.0 : 1.56, ly = l.y + (small.has(listener) ? 1.1 : 1.64);
      return game.shot([l.x - ux * back + uz * sd, ly, l.z - uz * back - ux * sd], [sp.x, sp.y + sy, sp.z], dur, { fov });
    };
    const convo = async (other, lines, { face = true } = {}) => {
      if (other && face) {
        const o = other.root.position, dx = pl.pos.x - o.x, dz = pl.pos.z - o.z, d = Math.hypot(dx, dz);
        if (d < 1.4 && d > 0.01 && Math.abs(pl.pos.y - o.y) < 0.5) pl.place(o.x + dx / d * 1.6, pl.pos.y, o.z + dz / d * 1.6, pl.yaw);
        faceEach(kai, other);
      }
      for (const [id, line] of lines) {
        const sp = id === 'kai' ? kai : (other && S.byId[id] === other ? other : null);
        if (sp && other && face) await ots(sp, sp === kai ? other : kai);
        await game.say(id, line);
      }
      kai.lookTarget = null; if (other) other.lookTarget = null;
    };
    const walkTo = (ch, path, speed = 1.3) => new Promise(res => {
      let i = 0;
      const off = game.onUpdate(dt => {
        const p = ch.root.position, t = path[i]; if (!t) { off(); res(); return; }
        const dx = t[0] - p.x, dz = t[2] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { i++; if (i >= path.length) { ch.speed = 0; off(); res(); } return; }
        const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st; p.y += (t[1] - p.y) * Math.min(1, dt * 5);
        let dy = Math.atan2(dx, dz) - ch.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.root.rotation.y += dy * Math.min(1, dt * 8); ch.speed = speed;
      });
    });
    const closeUp = async (p, lines, dist = 1.2, fov = 36) => {
      const dx = pl.pos.x - p[0], dz = pl.pos.z - p[2], d = Math.hypot(dx, dz) || 1;
      await game.shot([p[0] + dx / d * dist, p[1] + 0.5, p[2] + dz / d * dist], [p[0], p[1], p[2]], 1.0, { fov });
      for (const [id, line] of lines) await game.say(id, line);
    };
    const shard = (where, pos) => {
      const mesh = shardMesh(); mesh.position.set(...pos); game.scene.add(mesh);
      game.onUpdate((dt, t) => { mesh.rotation.y = t * 1.5; mesh.position.y = pos[1] + Math.sin(t * 2) * 0.05; });
      const it = act({ pos: [pos[0], pos[1] + 0.2, pos[2]], radius: 1.6, prompt: 'Take the temporal shard', enabled: () => !mesh.userData.taken, onUse: () => {
        mesh.userData.taken = true; mesh.visible = false; G.shards++; G.shardList.push(where); F.shards = (F.shards || 0) + 1; audio.sfxPlay('pickup');
        ui.toast(`TEMPORAL SHARD ${G.shards}/${SHARDS} · ${where.toUpperCase()}`, 2400); it.done();
      } });
      return it;
    };
    const RECORD = [
      ['Page I · the road', 'Meridian Avenue. The Varen Library: approved 2041, never built. The second spire: approved, never built. Here they stand, upside down in the sky, the way a plan looks from underneath.'],
      ['Page II · the kitchen', 'A child\'s drawing of a machine, made a year before anyone showed her one. Nobody wrote down who told her what it was.'],
      ['Page III · the platform', 'Platform Two, Harrow North. Six hundred people were left here in one world. In this second it is only a bench, and the bench is empty.'],
      ['Page IV · the clock', 'Every clock here stops between the ninth and the tenth. A second can be written once. Not by the one who wants it fixed: by the one who will live in it.'],
    ];
    const page = (k, pos) => {
      const mesh = pageMesh(); mesh.position.set(...pos); game.scene.add(mesh);
      const it = act({ pos: [pos[0], pos[1] + 0.4, pos[2]], radius: 1.7, prompt: 'Read the loose page', enabled: () => !mesh.userData.taken, onUse: () => side(async () => {
        mesh.userData.taken = true; mesh.visible = false; it.done(); G.pages.add(k); audio.sfxPlay('pickup');
        ev(`The Unwritten Record · ${RECORD[k][0]}`, RECORD[k][1], 'THE UNWRITTEN RECORD');
        ui.toast(`THE UNWRITTEN RECORD · ${G.pages.size}/${PAGES}`, 2400);
        if (G.pages.size === 1) await game.say('kai', 'Same paper every time. Same hand. Somebody\'s keeping a record of what never happened.');
        if (G.pages.size === PAGES) {
          F.m19unwrittenRecord = true;
          ev('The Unwritten Record', 'Four pages, one hand, no name. Read together: "A second can be written once. Not by the one who wants it fixed: by the one who will live in it."', 'THE UNWRITTEN RECORD');
          await game.say('kai', 'Four pages. "Not by the one who wants it fixed." That\'s me. That\'s every one of me.');
          if (S.byId.orren) await game.say('orren', 'You found all of it. Most of you never read past the first page.');
        }
      }) });
      return it;
    };
    const talkOrren = (key, prompt, pos, lines, after) => {
      const it = act({ pos: [pos[0], pos[1] + 1, pos[2]], radius: 2.2, prompt, enabled: () => !G.orren.has(key) && S.byId.orren?.root.visible, onUse: () => side(async () => {
        G.orren.add(key); it.done(); cine(true); lockMusic('m19-orren', 1.2);
        await convo(S.byId.orren, lines); if (after) await after();
        lockMusic(null, 1.6);
      }) });
      return it;
    };

    // ---------- places: one scene per chapter ----------
    let curTheme = null, musicLock = null, themeFor = () => null;
    const music = (fade = 1.6) => { const th = musicLock || themeFor(); if (!th) return; for (const d of T.defs) d.theme = th; if (th !== curTheme) { curTheme = th; audio.setTheme(th, fade); } };
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };
    const DEF = { id: 'none', key: '1', name: 'NO STATE', year: '08:14:07', glyph: '∅', color: '#e8eef8', theme: 'm19-outside', apply: () => {} };
    const setSecond = (label) => { DEF.year = label; T.refreshHud(); };
    async function newPlace(sceneOpts) {
      for (const g of prevRoot) disposeGroup(g); prevRoot = [];
      const scene = game.newScene({ residue: true, ...sceneOpts });
      RZ.init(renderer, { quality: game.engine.quality || 'medium' });
      game.onUpdate(dt => RZ.update(dt));
      T.configure([DEF], 'none'); T.unlocked = false;
      curTheme = null; musicLock = null;
      S = { seen: {}, obj: '', busy: false, main: false, phase: 'intro', byId: {} };
      kai.pose = null; kai.lookTarget = null; pl.crouching = false; game.fallRespawn = true; pl.edgeAssist = true;
      let mT = 0; game.onUpdate(dt => { mT -= dt; if (mT <= 0) { mT = 0.5; music(); } });
      game.onUpdate(() => { if (game.residueOn) G.residueUsed = true; });
      await tick();
      return scene;
    }
    // one sun (the shadow caster), a hemisphere, three nearest practicals
    function rig(Wm, L, skyOpts) {
      const scene = game.scene, Q = RZ.getQuality(), low = Q === 'low';
      let env = null; try { env = RZ.skyEnvironment(renderer, scene, { ...skyOpts, apply: false }); } catch (err) { console.warn('m19 sky', err); }
      const hemi = new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]); scene.add(hemi);
      const sun = new THREE.DirectionalLight(L.sun[0], L.sun[1]); sun.castShadow = true;
      const sz = Q === 'high' ? 2048 : low ? 512 : 1024; sun.shadow.mapSize.set(sz, sz);
      Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 170 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
      scene.add(sun, sun.target);
      const sunDir = new THREE.Vector3(...L.dir).normalize();
      const pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
      if (env) { scene.environment = env.envMap; scene.environmentIntensity = L.env; scene.background = L.bg != null ? new THREE.Color(L.bg) : env.background; }
      scene.fog.color.set(L.fog[0]); scene.fog.density = L.fog[1]; renderer.toneMappingExposure = L.exp;
      const b = L.beds || {}; audio.rain(0); audio.wind(b.wind || 0); audio.hum(b.hum || 0, b.hz || 48); audio.water?.(b.water || 0); audio.crowd?.(0);
      let lt = 0;
      game.onUpdate(dt => {
        const p = game.cine ? game.engine.camera.position : pl.pos;
        sun.target.position.set(p.x, p.y, p.z); sun.position.set(p.x + sunDir.x * 70, p.y + sunDir.y * 70 + 4, p.z + sunDir.z * 70);
        lt -= dt; if (lt > 0) return; lt = 0.4;
        const list = Wm.lightSrc.filter(s => s.room == null || s.room === Wm.cur).map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, c) => a.dd - c.dd);
        pts.forEach((l, i) => { const s = list[i]; if (!s || s.dd > 45 * 45) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(s.c); l.intensity = s.i; l.distance = s.d; });
      });
      return { sun, hemi, env };
    }
    const chapterTitle = async (num, title, sub) => { await ui.chapterCard(`THE PLACE OUTSIDE TIME · ${num}`, title, sub, 3600); };
    const fadeMove = async (fn, ms = 380) => { await ui.fade(1, ms); await fn(); await tick(); await ui.fade(0, ms); };

    // =================================================================================================================
    // I · THE ROAD THAT RETURNS — navigate by recurring symbols
    // =================================================================================================================
    async function chapter1() {
      G.ch = 1; portraits(['orren']);
      const scene = await newPlace({ background: 0xc4c8d0, fog: [0xc4c8d2, 0.019], exposure: 1.0, bloom: 0.45, bloomThreshold: 0.88, envIntensity: 0.8, killY: -20 });
      const low = RZ.getQuality() === 'low';
      const A = buildAvenue(game, scene, low); await tick();
      const Q = buildSquare(game, scene, low); await tick();
      W = { A, Q, lightSrc: [...A.lightSrc, ...Q.lightSrc] }; prevRoot.push(A.root, Q.root);
      game.onUpdate((dt, t) => { A.update(dt, t); Q.update(dt, t); });
      rig(W, { fog: [0xc4c8d2, 0.019], env: 0.85, hemi: [0xe8ecf4, 0x4a4a52, 0.55], sun: [0xffe6cc, 1.5], dir: [-0.35, 0.42, 0.62], exp: 1.0, beds: { wind: 0.05, hum: 0.02, hz: 41 } },
        { preset: 'golden-hour', elevation: 8, azimuth: 165, turbidity: 3, cover: 0.45, stratus: 0.25 });
      themeFor = () => (S.phase === 'square' ? 'm19-square' : 'm19-outside');
      Object.assign(S, { lap: 0, lapT: 0, phase: 'intro' });
      setSecond('08:14:07'); musicState.lap = 0;
      const orren = game.actor('orren', null, ...AV.orren, -PI / 2); orren.pose = 'sit'; S.byId.orren = orren;
      pl.place(...AV.start); game.checkpoint(...AV.start);
      // ---------- opening ----------
      cine(true); S.main = true;
      await game.shot([1.5, 7, 60], [0, 22, -40], 0.01, { fov: 54 });
      await ui.fade(0, 2200);
      lockMusic('m19-outside', 0.5);
      await ui.chapterCard('ACT IV · THE UNWRITTEN SECOND', 'The Place Outside Time', 'Mission 19 · beyond the Chronolith', 4200);
      await game.shot([-2, 3.5, 51], [0, 44, -60], 4.6, { fov: 56 });
      await game.say('m19band', 'No state. No year. Time index: eight fourteen and seven seconds. Holding.');
      await game.shot([3.2, 1.7, 44.5], [0, 1.6, 40], 2.4, { fov: 40 });
      await game.say('kai', 'I walked into the ring at Test Hall C. I came out on Meridian Avenue. And the rain\'s stopped in mid-air.');
      await game.shot([-2.5, 1.2, 43], [4, 40, -30], 3.0, { fov: 58 });
      await game.say('kai', 'And there\'s a city in the sky. Upside down. That\'s the second spire. They never built the second spire.');
      if (F.unwrittenSecond || F.m18miraMessage) await game.say('kai', 'Between the ninth and the tenth, she said. A second nobody wrote.');
      await game.shot([5.0, 1.8, 35.6], [8.4, 1.0, 30.6], 2.4, { fov: 38 });
      await game.say('kai', 'Someone\'s at the tram stop.');
      S.main = false; cine(false); lockMusic(null);
      S.phase = 'meet'; objective('Someone is sitting at the tram stop.');
      // ---------- Orren ----------
      await new Promise(res => {
        const it = act({ pos: [AV.orren[0] - 0.6, 1.0, AV.orren[2]], radius: 2.6, prompt: 'Talk to the man at the shelter', onUse: () => side(async () => {
          it.done(); cine(true); S.main = true; lockMusic('m19-orren', 1.0);
          orren.pose = null; await game.wait(0.6);
          await convo(orren, [
            ['orren', 'You\'re early. Or late. Here it comes to the same thing.'],
            ['kai', 'Who are you?'],
            ['orren', 'Orren. I keep the roads company. They get lonely, going round.'],
            ['kai', 'I\'m looking for my sister.'],
            ['orren', 'Everyone who comes here is looking for someone. Most of them follow the road. The road goes round.'],
            ['kai', 'Then which way?'],
            ['orren', 'Nothing here points. Things repeat. Learn what repeats, and you\'ll know where you are.'],
            ['orren', 'And stop asking the place how it works. It isn\'t a machine. It\'s a habit.'],
            ['kai', 'Everything\'s a machine if you look closely enough.'],
            ['orren', `That's what the last one said. Sixteen of you have sat on this bench, and every one of you brought a toolkit.`],
          ]);
          G.orren.add('meet'); F.metOrren = true;
          ev('Orren', 'Sits at the Meridian tram stop as if he has always been there. "Nothing here points. Things repeat. Learn what repeats." Sixteen Kais came before.', 'PEOPLE');
          S.main = false; lockMusic(null); res();
        }) });
      });
      S.phase = 'road';
      objective('The road returns. Find what repeats.');
      // optional: ask about the sky
      talkOrren('sky', 'Ask Orren about the city in the sky', AV.orren, [
        ['kai', 'The city up there. What is it?'],
        ['orren', 'Everything they drew and never built. The library, the second spire, the river park. Plans have to go somewhere.'],
        ['kai', 'Plans aren\'t places.'],
        ['orren', 'Neither is this, and here you are standing on it.'],
      ], async () => { ev('The unbuilt city', 'Hanging upside down in the sky: every Rain City plan approved and never built. "Plans have to go somewhere."'); });
      // ---------- optional: timetable, the Courier ----------
      act({ pos: [AV.timetable[0] - 0.6, 1.2, AV.timetable[2]], radius: 1.6, prompt: 'Read the timetable', enabled: () => !S.seen.tt, onUse: () => side(async () => {
        S.seen.tt = true; cine(true);
        await closeUp(AV.timetable, [['kai', 'Every service leaves at eight fourteen. Nothing ever arrives.']], 1.4);
        ev('Meridian Line 4 timetable', 'All departures 08:14. "No service arrives." One destination has no name.');
      }) });
      page(0, [AV.paper[0], AV.paper[1] - 0.1, AV.paper[2] + 0.7]);
      act({ pos: [AV.paper[0] + 0.6, 1.1, AV.paper[2]], radius: 1.6, prompt: 'Read the Courier', enabled: () => !S.seen.paper, onUse: () => side(async () => {
        S.seen.paper = true; cine(true);
        await closeUp(AV.paper, [['kai', 'Three dates on one front page. And a library that opened on Meridian.'], ['kai', 'It never opened. It\'s up there, hanging off the clouds.']], 1.2);
        ev('The Rain City Courier', '"VAREN LIBRARY OPENS ON MERIDIAN." Dated 19 October 2026, 14 May 2193 and 31 July 2049 at once. Approved in 2041, never built.');
      }) });
      shard('the alley that goes nowhere', [19.2, 0.75, -30.8]);
      // ---------- the loop ----------
      const MARKTEXT = {
        true: [['kai', 'Hensel\'s mark. A clock face at eight fourteen, MCMLXI over the top. Oskar painted that on every clock he ever fixed.']],
        mirror: [['kai', 'His mark, backwards. The hands at three forty-six. That\'s a reflection of it, not the mark.']],
        nine: [['kai', 'Nine o\'clock sharp. Somebody wants me to think of the war.']],
        late: [['kai', 'Eight forty-one. The right digits in the wrong order.']],
      };
      const lapCfg = () => LAPS[Math.min(S.lap, LAPS.length - 1)];
      game.onUpdate(() => {
        if (S.phase !== 'road' || !game.control || S.busy || ui.dlgActive) return;
        const p = pl.pos, cfg = lapCfg();
        // recognition barks (one per lap and plate)
        for (const [id, m] of Object.entries(A.marks)) {
          const v = cfg.marks[id], [mx, , mz] = AV.marks[id];
          const near = Math.hypot(p.x - mx, p.z - mz) < 7;
          if (near && v && once(`mark${S.lap}${id}`)) { side(async () => { for (const [sp, l] of MARKTEXT[v]) await game.say(sp, l); if (v === 'true') { G.symbols.add('clock'); ev('The clockmaker\'s mark', 'Oskar Hensel\'s mark: a clock face at 8:14, MCMLXI above, HENSEL below. Every clock he ever repaired carries it. Decoys: the mark reversed (3:46), 9:00, 8:41.', 'SYMBOLS'); } }); return; }
          if (near && m.chalkOn && game.residueOn && once(`chalk${S.lap}`)) { side(async () => { await game.say('kai', 'Chalk. His mark, drawn by hand at this corner.'); await game.say('kai', 'That\'s my handwriting. One of me came through here and marked the turn for the next.'); }); return; }
        }
        // the avenue's ends fold back on each other
        if (p.z < -AV.endZ || p.z > AV.endZ + 1) {
          const dz = p.z < 0 ? AV.len : -AV.len; pl.place(p.x, p.y, p.z + dz, pl.yaw); G.endLoops++;
          audio.sfxPlay('rewind'); ui.toast('THE ROAD RETURNS', 1800);
          if (G.endLoops === 1) side(async () => { await game.say('kai', 'I walked off the end of the road and onto the start of it.'); ui.subtitle('orren', 'The road always returns. It\'s very loyal.', 3200); });
          return;
        }
        // the alleys
        for (const [id, [sd, zc]] of Object.entries(AV.alleys)) if (sd * p.x > 21.0 && Math.abs(p.z - zc) < 4) { enterAlley(id); return; }
      });
      const enterAlley = (id) => side(async () => {
        const ok = id === lapCfg().ok;
        audio.sfxPlay(ok ? 'switch' : 'rewind');
        if (!ok) {
          G.wrong++;
          await fadeMove(async () => { pl.place(...AV.start); });
          ui.toast('THE ROAD RETURNS', 1800);
          const lines = ['That turn goes back to the start.', 'Back at the tram stop. The road keeps its own counsel.', 'Wrong turn. Same morning.'];
          await game.say('kai', lines[G.wrong % lines.length]);
          if (G.wrong === 2) ui.subtitle('orren', 'You\'re following the road. Follow the thing that keeps turning up on it.', 3600);
          return;
        }
        S.lap++; G.laps = S.lap; musicState.lap = S.lap; S.lapT = 0;
        if (S.lap >= LAPS.length) { await toSquare(); return; }
        await fadeMove(async () => { A.setLap(S.lap); setSecond(`08:14:0${LAPS[S.lap].second}`); pl.place(...AV.start); game.checkpoint(...AV.start); });
        cine(true);
        await game.shot([AV.clocks[0][0] - 2.4, 3.6, AV.clocks[0][2] + 2.6], [AV.clocks[0][0], 3.75, AV.clocks[0][2]], 1.6, { fov: 32 });
        audio.sfxPlay('motif');
        await game.say('m19band', `Time index: eight fourteen and ${['seven', 'eight', 'nine'][LAPS[S.lap].second - 7]} seconds.`);
        await game.say('kai', S.lap === 1 ? 'The clocks moved. One second. The right turn moves the second.' : 'Another second. Eight fourteen and nine. One more and I\'m at the edge of it.');
        if (S.lap === 2) await game.say('kai', 'No mark I trust out there this time. Every one I can see is wrong.');
        cine(false);
      });
      const toSquare = async () => {
        await fadeMove(async () => {
          S.phase = 'square'; setSecond('08:14:09 · —'); pl.place(...SQ.start); game.checkpoint(...SQ.start);
          orren.root.position.set(...SQ.orren); orren.root.rotation.y = PI * 0.85; orren.pose = null;
        }, 600);
        cine(true); S.main = true;
        await game.shot([SQ.x - 8, 5, SQ.z + 16], [SQ.x, 4, SQ.z - 12], 3.4, { fov: 50 });
        await game.say('m19band', 'Time index: eight fourteen and nine. And then... no number.');
        await game.shot([SQ.x + 2.8, 3.0, SQ.z - 8], [SQ.x + 5.75, 3.0 + 1.0, SQ.z - 13.1], 2.2, { fov: 30 });
        await game.say('kai', 'The second hand\'s stuck between the nine and the ten. Trying to move and it can\'t.');
        S.main = false; cine(false);
        objective('Hensel\'s shop. The clock square.');
      };
      // ---------- hints on the road ----------
      hint(() => S.phase === 'road', 75, () => {
        const l = [['You walked past it. It was the only thing that turned up twice.'], ['Not every mark that looks right is his.'], ['The marks you can see are lies this time. Look the way you look for the past.']][Math.min(S.lap, 2)];
        ui.subtitle('orren', l[0], 4200);
        if (S.lap === 2) ui.toast('RESIDUE VISION · F (or the eye button)', 3200);
      });
      // ---------- the square ----------
      await game.waitFor(() => S.phase === 'square' && !S.main);
      talkOrren('square', 'Talk to Orren', SQ.orren, [
        ['kai', 'You got here before me.'],
        ['orren', 'I was always here. You were the one who had to arrive.'],
        ['kai', 'The clock. Eight fourteen and nine, and then nothing. Where\'s the tenth second?'],
        ['orren', 'Not after. Beside. You keep looking for it at the end of something.'],
        ['orren', 'Hensel\'s shop. The rooms in there aren\'t joined by walls. They\'re joined by what you recognise.'],
        ['kai', 'And if I don\'t recognise it?'],
        ['orren', 'Then you\'ll see a lot of the workshop.'],
      ]);
      talkOrren('self', 'Ask Orren what he is', SQ.orren, [
        ['kai', 'Are you from here? Or did you come through, like me?'],
        ['orren', 'I was a man once, I think. Or a road. It\'s hard to tell from inside.'],
        ['kai', 'That isn\'t an answer.'],
        ['orren', 'No. It\'s the truth. Those are different things, and you\'re going to need to know the difference.'],
      ], async () => { ev('Orren, at the square', '"I was a man once, I think. Or a road. It\'s hard to tell from inside." He will not say more.', 'PEOPLE'); });
      act({ pos: [SQ.plaque[0], 1.1, SQ.plaque[2] + 0.6], radius: 1.5, prompt: 'Read the plaque', enabled: () => !S.seen.plaque, onUse: () => side(async () => {
        S.seen.plaque = true; cine(true);
        await closeUp(SQ.plaque, [['kai', '"Approved 2041 for the Old Quarter. Never built. Here anyway."']], 1.1);
        ev('Clock Square plaque', 'A square that was approved and never built. "Here anyway."');
      }) });
      shard('the stopped fountain', SQ.shard);
      await new Promise(res => {
        const it = act({ pos: [SQ.door[0], 1.0, SQ.door[2] + 0.8], radius: 1.8, prompt: 'Open Hensel\'s door', onUse: () => side(async () => {
          it.done(); S.main = true; cine(true);
          await game.shot([SQ.x + 2.2, 1.7, SQ.z - 10.4], [SQ.x, 1.6, SQ.z - 13.8], 1.6, { fov: 40 });
          if (!G.orren.has('square')) await game.say('orren', 'The rooms in there are joined by what you recognise. Not by walls.');
          audio.sfxPlay('door'); await tween(0.8, k => { Q.door.rotation.y = -k * 1.2; Q.door.position.x = SQ.x - k * 0.35; Q.door.position.z = SQ.z - 13.86 + k * 0.5; });
          await ui.fade(1, 900); S.main = false; res();
        }) });
      });
      F.m19laps = G.laps; F.m19wrongTurns = G.wrong;
    }

    // =================================================================================================================
    // II · THE HOUSE OF ROOMS — recognise the clockmaker's mark, the observatory pattern and the Helix badge
    // =================================================================================================================
    async function chapter2() {
      G.ch = 2; portraits(['orren', 'm19child', 'm19kidmira', 'm19kidkai']);
      const scene = await newPlace({ background: 0x14110e, fog: [0x14110e, 0.01], exposure: 1.05, bloom: 0.5, bloomThreshold: 0.86, envIntensity: 0.7, killY: -20 });
      const low = RZ.getQuality() === 'low';
      const R = buildRooms(game, scene, low); await tick();
      W = R; prevRoot.push(...R.rooms.map(r => r.g));
      game.onUpdate((dt, t) => R.update(dt, t));
      rig(R, { fog: [0x14110e, 0.01], env: 0.6, bg: 0x14110e, hemi: [0xfff0dc, 0x2a241c, 0.45], sun: [0xfff0dc, 0.0], dir: [0.3, 1, 0.2], exp: 1.05, beds: { hum: 0.02, hz: 52 } },
        { preset: 'interior', color: 0xffe2c0, wall: 0x3a2e24, window: 0x8aa0c0 });
      themeFor = () => (S.room === 4 ? 'm19-orren' : 'm19-rooms');
      setSecond('08:14:09 · —');
      Object.assign(S, { room: 0, phase: 'rooms', visited: new Set([0]), mistakes: {} });
      const inside = (i, sd, d = 3.7) => { const [dx, dz] = SIDE[sd], cx = ROOM_X(i); return [cx + dx * d, 0, dz * d, Math.atan2(-dx, -dz)]; };
      const enter = (i, sd) => { R.show(i); S.room = i; musicState.rooms = i; const p = inside(i, sd); pl.place(...p); game.checkpoint(...p, () => { R.show(i); S.room = i; }); };
      enter(0, 'S'); R.cur = 0;
      const orren = game.actor('orren', null, ROOM_X(3) + 2.4, 0, 1.2, -PI * 0.75); S.byId.orren = orren; orren.root.visible = false;
      cine(true); S.main = true;
      await ui.fade(0, 1400);
      await game.shot([ROOM_X(0) - 3.4, 2.6, 3.8], [ROOM_X(0) + 1.5, 1.6, -4.5], 3.0, { fov: 52 });
      await chapterTitle('II', 'The House of Rooms', 'Joined by what you recognise');
      await game.say('kai', 'Hensel\'s workshop. The real one, in 2049. Except the door I came through is painted on the wall.');
      await game.shot([ROOM_X(0), 1.7, 1.0], [ROOM_X(0), 2.9, -4.8], 2.0, { fov: 40 });
      await game.say('kai', 'His mark over every door. Not all of them are his.');
      S.main = false; cine(false);
      objective('Three doors with his mark. One of them is true.');
      // ---------- doors ----------
      const wrongLine = { mirror: 'That was his mark reversed. Hands at three forty-six.', nine: 'Nine o\'clock. Not his hour.', six: 'Six stars. The ring was missing one.', gold: 'Continuum gold. That isn\'t Helix, that\'s someone wearing it.', late: 'Eight forty-one. Wrong order.' };
      const useDoor = (i, sd) => side(async () => {
        const d = DOORS[i][sd];
        if (d.to === 'seal') { await game.say('kai', 'Painted shut. From this side it was never a door.'); return; }
        if (d.to === 'great') return;
        audio.sfxPlay('door');
        if (d.to === 'loop') {
          G.roomLoops++; S.mistakes[d.sym[1]] = true;
          await fadeMove(async () => enter(0, 'S'));
          ui.toast(`HENSEL'S WORKSHOP · AGAIN`, 1800);
          await game.say('kai', wrongLine[d.sym[1]] || 'Back in the workshop.');
          if (G.roomLoops === 3) ui.subtitle('orren', 'The house isn\'t lying to you. You\'re just not looking long enough.', 3800);
          return;
        }
        const [ti, ts] = d.to;
        await fadeMove(async () => enter(ti, ts));
        if (!S.visited.has(ti)) { S.visited.add(ti); await firstVisit(ti); }
      });
      for (const r of R.rooms) for (const [sd, d] of Object.entries(r.doors)) {
        if (d.to === 'great') continue;
        act({ pos: [d.pos[0], 1.0, d.pos[2]], radius: 1.5, prompt: d.to === 'seal' ? 'Try the painted door' : 'Open the door', enabled: () => S.room === r.i, onUse: () => useDoor(r.i, sd) });
      }
      const firstVisit = async (i) => {
        ui.toast(ROOMS[i].name, 2200);
        if (i === 1) {
          cine(true); await game.shot([ROOM_X(1) + 1.5, 1.4, 2.5], [ROOM_X(1), 5.2, 0], 2.2, { fov: 52 });
          await game.say('kai', 'The observatory pattern. Seven stars round the pole, the notch cut on the east. Niko\'s people carved that before anyone had a word for east.');
          await game.say('kai', 'It\'s over the doors too. Three versions.');
          G.symbols.add('star'); ev('The observatory pattern', 'Seven stars: six in a ring round the pole star, the pole star centred, a notch cut on the east side. Decoys: six stars, the notch on the west, the pole star off centre.', 'SYMBOLS');
          cine(false); objective('The pattern over the doors. One is the sky\'s.');
        }
        if (i === 2) {
          await game.say('kai', 'Helix. Test Lab Four. Badges over every door.');
          G.symbols.add('helix'); ev('The Helix badge', 'Four white orbits round a dot: the badge on every Helix door and on Kai\'s card. Decoys: Continuum gold in a hexagon, three orbits.', 'SYMBOLS');
          objective('The badge over the doors. Only one is the one on your card.');
        }
        if (i === 3) await gallery();
        if (i === 4) await kitchen();
        if (i === 5) await hall();
      };
      // Kai's card (optional)
      act({ pos: [ROOM_X(2) - 2.2, 1.0, -3.4], radius: 1.4, prompt: 'Pick up the ID card', enabled: () => S.room === 2 && !G.idCard, onUse: () => side(async () => {
        G.idCard = true; cine(true);
        await closeUp([ROOM_X(2) - 2.2, 0.93, -3.8], [['kai', 'K. Varen. Access all levels. Valid until... a dash.'], ['kai', 'Even the card doesn\'t know when I am.']], 1.0);
        ev('K. VAREN · VALID: —', 'Kai\'s Helix card, lying on a bench in a lab that is also a room in a clock shop. The expiry date is a dash.');
        W.rooms[2].idCard.visible = false;
      }) });
      // ---------- the kitchen (optional, behind the mirrored pattern) ----------
      const kitchen = async () => {
        cine(true); S.main = true;
        await game.shot([ROOM_X(4) + 3.2, 1.5, 3.4], [ROOM_X(4), 0.9, 0.4], 2.0, { fov: 48 });
        await game.say('kai', 'Our kitchen. Twenty twenty-six. The blind still sticks on the left.');
        const km = game.actor('m19kidmira', null, ROOM_X(4) - 0.9, 0, 0.4, PI / 2); km.pose = 'work'; small.add(km); S.byId.m19kidmira = km;
        const kk = game.actor('m19kidkai', null, ROOM_X(4) + 0.9, 0, 0.6, -PI / 2); small.add(kk); S.byId.m19kidkai = kk;
        try { km.setGhost(GHOST_MIRA); kk.setGhost(GHOST_KID); } catch (err) { void err; }
        audio.sfxPlay('anomaly');
        await game.shot([ROOM_X(4) + 0.2, 1.3, 2.6], [ROOM_X(4) - 0.4, 0.9, 0.4], 1.6, { fov: 40 });
        await game.say('m19kidmira', 'This is you. This is me. And this is the machine.');
        await game.say('m19kidkai', 'What does the machine do?');
        await game.say('m19kidmira', 'It keeps things. So you can\'t lose them.');
        await game.say('m19kidkai', 'Can it keep you?');
        await game.say('m19kidmira', 'Don\'t be stupid. I\'m not a thing.');
        await tween(1.2, k => { km.root.position.y = -k * 0.02; }); km.root.visible = false; kk.root.visible = false;
        await game.say('kai', 'She drew it a year before the open day. Before anyone showed her a ring.');
        G.kitchen = true; ev('The kitchen, 2026', 'A residue memory: Mira, nine, drawing "ME · MIRA · THE MACHINE". "It keeps things. So you can\'t lose them." "Can it keep you?" "I\'m not a thing."', 'MEMORIES');
        S.main = false; cine(false);
      };
      page(1, [ROOM_X(4) + 0.3, 0.8, 0.5]);
      shard('the Varen kitchen', [ROOM_X(4) - 3.6, 1.1, -4.5]);
      // ---------- the ticket hall and the Child in the Station (optional, behind the three-orbit badge) ----------
      let child = null;
      const hall = async () => {
        child = game.actor('m19child', null, ROOM_X(5) - 1.2, 0, -1.6, PI * 0.2); small.add(child); S.byId.m19child = child;
        await game.say('kai', 'Central Station. The ticket hall. And a kid on her own.');
        objective('A child in the ticket hall.');
      };
      act({ pos: [ROOM_X(5) - 1.2, 1.0, -1.6], radius: 2.2, prompt: 'Talk to the child', enabled: () => S.room === 5 && child && G.child !== 'home', onUse: () => side(async () => {
        cine(true);
        const met = !!(F.m1child || F.metJun);
        await convo(child, [
          ['m19child', met ? 'Mister, your wrist is glowing again.' : 'Mister, your wrist is glowing.'],
          ['kai', 'Are you lost?'],
          ['m19child', 'I\'m trying to get home. There\'s a song that opens the gate. A lady with a purple light used to hum it on the platform.'],
          ['m19child', 'Three notes. Up, then down a little. I can\'t remember them.'],
        ]);
        let ok = false, tries = 0;
        while (!ok && tries < 3) {
          const c = await choose('kai', 'Three notes. Up, then a step down. Hum them.', ['E · B · A', 'A · B · E', 'C · E · G'], 0);
          tries++;
          if (c === 0) {
            ok = true; audio.sfxPlay('motif');
            await game.say('kai', 'E. B. A.');
            await game.say('m19child', 'That\'s it! That\'s the one. That\'s the way home.');
          } else await game.say('m19child', c === 1 ? 'No... that\'s backwards.' : 'That\'s a happy one. Hers was sad.');
        }
        if (ok) {
          G.child = 'home'; F.m19child = 'home';
          ev('The Child in the Station', 'In the ticket hall that is not there, the child from Central Station asked for the sad song the lady with the purple light hummed on the platform. Mira\'s three notes, E-B-A, opened her gate.', 'PEOPLE');
          cine(true); await game.shot([ROOM_X(5) + 2.0, 1.4, 3.6], [ROOM_X(5) - 1.0, 1.0, 1.6], 1.4, { fov: 44 });
          await walkTo(child, [[ROOM_X(5) - 0.8, 0, 1.6], [ROOM_X(5) - 0.8, 0, 3.2]], 1.1);
          await tween(1.0, k => { child.root.position.y = -k * 0.02; }); child.root.visible = false;
          await game.say('kai', 'She knew Mira\'s tune. Everybody in this place knows Mira\'s tune.');
          shard('the ticket hall', [ROOM_X(5) + 2.6, 1.4, 4.0]);
        } else { G.child = 'met'; F.m19child = 'met'; await game.say('m19child', 'It\'s all right. I\'ll keep trying. I\'m good at waiting.'); }
      }) });
      // ---------- the Gallery of Three ----------
      const gallery = async () => {
        cine(true); S.main = true; orren.root.visible = true;
        await game.shot([ROOM_X(3) - 3.0, 2.0, 4.2], [ROOM_X(3), 3.4, -4.8], 2.8, { fov: 54 });
        await game.say('kai', 'One door. Three dials in the frame. A clock, the stars and a badge.');
        lockMusic('m19-orren', 1.0);
        await convo(orren, [
          ['orren', 'You made it through without breaking anything. That\'s new.'],
          ['kai', 'I worked out the rule. Every room points to the next by its mark.'],
          ['orren', 'There. You\'re doing it again. "The rule." As if the house had a manual.'],
          ['orren', 'It isn\'t a rule. The house just remembers what you\'ve been. You walked through what you knew.'],
          ['kai', 'Then what\'s the difference between that and a rule?'],
          ['orren', 'A rule works the same for everyone. This only works for you.'],
        ]);
        lockMusic(null);
        S.main = false; cine(false);
        objective('The great door. Set the dials to the true marks.');
      };
      // the three reference alcoves (optional reading)
      for (const [x, , z, kind] of R.rooms[3].alcoves) act({ pos: [x, 1.2, z], radius: 1.3, prompt: 'Study the carving', enabled: () => S.room === 3 && !S.seen['alc' + kind], onUse: () => side(async () => {
        S.seen['alc' + kind] = true;
        await game.say('kai', { clock: 'The clock at eight fourteen. MCMLXI, HENSEL.', star: 'Seven stars. The notch on the east.', helix: 'Four orbits. White.' }[kind]);
      }) });
      await new Promise(res => {
        const it = act({ pos: [ROOM_X(3), 1.0, -3.9], radius: 1.8, prompt: 'Set the three dials', enabled: () => S.room === 3, onUse: () => side(async () => {
          cine(true);
          await game.shot([ROOM_X(3) + 0.4, 2.4, -1.4], [ROOM_X(3), 3.1, -4.7], 1.0, { fov: 42 });
          const pick = [];
          for (const [k, kind] of ['clock', 'star', 'helix'].entries()) {
            const vars = DIAL[kind], correct = vars.indexOf('true');
            const c = await choose('kai', DIAL_NAME[kind], vars.map(v => DIAL_TEXT[kind][v]), correct);
            W.dials.set(k, c); pick.push(vars[c]); audio.sfxPlay('metal');
          }
          if (pick.every(v => v === 'true')) {
            it.done(); audio.sfxPlay('success'); S.main = true;
            await game.say('kai', 'His clock. Niko\'s stars. My badge.');
            await tween(1.6, k => { W.dials.leaf.position.x = -k * 2.6; });
            await game.say('orren', 'Mind the step. It\'s further down than it looks.');
            await ui.fade(1, 900); S.main = false; res();
          } else {
            G.lockMisses++; audio.sfxPlay('fail'); ui.toast('THE DOOR HOLDS', 1800);
            const wrong = pick.map((v, k) => (v === 'true' ? null : ['clock', 'star', 'helix'][k])).filter(Boolean);
            await game.say('kai', wrong.length === 1 ? `The ${wrong[0] === 'clock' ? 'clock' : wrong[0] === 'star' ? 'stars' : 'badge'}. That one's wrong.` : 'Not right. Think about what I actually saw.');
            if (G.lockMisses >= 2) await game.say('orren', 'You\'ve seen the true ones. They\'re carved on the west wall if you\'ve let them go.');
          }
        }) });
      });
      F.m19roomLoops = G.roomLoops; F.m19lockMisses = G.lockMisses;
    }

    // =================================================================================================================
    // III · THE MIRROR GORGE — cross a bridge visible only in reflections
    // IV  · THE CONCOURSE OF DOORS — reach a door that appears in several locations
    // =================================================================================================================
    async function chapter34(part4) {
      G.ch = part4 ? 4 : 3; portraits(['orren', 'm19mira', 'm19lake', 'm19kidmira']);
      const scene = await newPlace({ background: 0xc8d0da, fog: [0xc0c8d4, 0.0085], exposure: 1.0, bloom: 0.5, bloomThreshold: 0.86, envIntensity: 0.85, killY: -6.0 });
      const low = RZ.getQuality() === 'low';
      const M = buildMirror(game, scene, low); await tick();
      M.door.position.set(PLZ.spots[0][0], 0, PLZ.spots[0][1]); M.door.rotation.y = PLZ.spots[0][2];   // on the concourse from the start
      const Hh = buildHall(game, scene, low); await tick();
      W = { M, Hh, lightSrc: [...M.lightSrc, ...Hh.lightSrc] }; prevRoot.push(M.root, Hh.root);
      game.onUpdate((dt, t) => { M.update(dt, t); if (Hh.root.visible) Hh.update(dt, t); });
      rig(W, { fog: [0xc0c8d4, 0.0085], env: 0.9, hemi: [0xe8eef8, 0x40444c, 0.55], sun: [0xffe2c8, 1.7], dir: [-0.5, 0.36, 0.55], exp: 1.0, beds: { wind: 0.07, water: 0.04, hum: 0.015, hz: 40 } },
        { preset: 'golden-hour', elevation: 6, azimuth: 150, turbidity: 2.5, cover: 0.35, stratus: 0.2 });
      themeFor = () => (S.phase === 'door' ? 'm19-door' : 'm19-mirror');
      setSecond('08:14:09 · —');
      const orren = game.actor('orren', null, 1.8, 0, 17.6, PI); S.byId.orren = orren;
      // ---------- feedback: the air ripples where Kai stands on the deck that isn't there ----------
      const ringM = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.46, 32), new THREE.MeshBasicMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      ringM.rotation.x = -PI / 2; ringM.userData.noBatch = true; scene.add(ringM);
      const onDeck = () => { const p = pl.pos; if (Math.abs(p.y) > 0.3) return false; if (p.z > 16.3 || p.z < -56.4) return false; const [ix0, ix1, iz0, iz1] = BR.island; return !(p.x > ix0 && p.x < ix1 && p.z > iz0 && p.z < iz1); };
      game.onUpdate((dt, t) => { const on = onDeck() && pl.grounded; ringM.material.opacity += ((on ? 0.45 + Math.sin(t * 5) * 0.1 : 0) - ringM.material.opacity) * Math.min(1, dt * 6); ringM.position.set(pl.pos.x, pl.pos.y + 0.03, pl.pos.z); ringM.scale.setScalar(1 + Math.sin(t * 3) * 0.08); });
      // falls: the core returns Kai to his last safe spot; count them for barks
      let falling = false;
      game.onUpdate(() => {
        if (pl.pos.y < -2.5 && !falling) { falling = true; G.falls++; }
        if (falling && pl.grounded && pl.pos.y > -0.5) {
          falling = false;
          if (S.phase === 'bridge' && (G.falls === 1 || G.falls === 4)) side(async () => { await game.say('kai', G.falls === 1 ? 'Don\'t look at the air. Look at the water.' : 'The water shows where the deck is. Not where I want it to be.'); });
        }
      });
      // on the bridge the edge brake is off: the water, not an invisible wall, tells Kai where the deck ends
      game.onUpdate(() => { pl.edgeAssist = S.phase !== 'bridge'; });
      const toPlaza = async () => {
        S.phase = 'door'; G.ch = 4; game.checkpoint(0, 0, -58, PI);
        cine(true); S.main = true;
        await game.shot([18, 9, -50], [0, 2, -100], 3.6, { fov: 56 });
        await chapterTitle('IV', 'The Concourse of Doors', 'One door, everywhere');
        await game.shot([4, 2.2, -60], [M.door.position.x, 1.4, M.door.position.z], 2.2, { fov: 40 });
        await game.say('kai', 'That\'s the door to Test Hall Zero. Out here, on its own.');
        orren.root.position.set(-2.4, 0, -58.6); orren.root.rotation.y = PI * 0.9; orren.root.visible = true; orren.pose = null;
        lockMusic('m19-orren', 1.0);
        await convo(orren, [
          ['orren', 'It won\'t let you walk up to it. Sixteen of you tried. It moves.'],
          ['kai', 'Then how do I reach it?'],
          ['orren', 'Don\'t follow the footsteps. Follow what they refuse to step on.'],
          ['kai', 'What footsteps? There\'s nobody here.'],
          ['orren', 'There was. Look the way you look for the past.'],
        ]);
        lockMusic(null);
        S.main = false; cine(false);
        objective('The door. Follow what the footsteps refuse to step on.');
      };
      // ---------- III · the bridge ----------
      if (!part4) {
        pl.place(...BR.start); game.checkpoint(...BR.start);
        S.phase = 'intro';
        cine(true); S.main = true;
        await ui.fade(0, 1400);
        await game.shot([9, 4, 30], [0, LAKE, -10], 3.2, { fov: 56 });
        await chapterTitle('III', 'The Mirror Gorge', 'A bridge that was never built');
        await game.shot([0.6, 2.4, 19.6], [0, LAKE - 2, 2], 3.2, { fov: 50 });
        await game.say('kai', 'There\'s a bridge in the water. Not over it. In it.');
        await convo(orren, [
          ['orren', 'Things that were never built can\'t stand in the air. Here they can only be seen in what reflects.'],
          ['kai', 'Then I walk where the water says.'],
          ['orren', 'And don\'t look for yourself in it.'],
        ]);
        await game.shot([0.4, 1.4, 17.2], [0, LAKE - 1.6, 12], 2.0, { fov: 42 });
        await game.say('kai', 'I don\'t have a reflection.');
        await game.say('orren', 'No. You were never written here. Neither was I.');
        await walkTo(orren, [[1.2, 0, 19], [0, 0, 24]], 1.2); orren.root.visible = false;
        S.main = false; cine(false); S.phase = 'bridge';
        objective('Across the gorge. Walk where the water says.');
        hint(() => S.phase === 'bridge' && pl.pos.z > 15, 45, () => ui.subtitle('orren', 'Look down. The water has been trying to tell you.', 3800));
        hint(() => S.phase === 'bridge' && pl.pos.z < -33 && pl.pos.z > -38.2, 50, () => ui.subtitle('orren', 'The reflection moves. Ride it, don\'t chase it.', 3800));
        // Mira in the reflection, walking beside him
        const lakeMira = game.actor('m19mira', null, 0, 2 * LAKE, 0, 0); S.byId.m19mira = lakeMira; lakeMira.root.visible = false;
        try { lakeMira.setGhost(GHOST_MIRA); } catch (err) { void err; }
        let follow = false;
        game.onUpdate((dt) => {
          if (!follow) return; const r = lakeMira.root, tx = pl.pos.x + 1.3, tz = pl.pos.z - 2.6;
          const dx = tx - r.position.x, dz = tz - r.position.z, d = Math.hypot(dx, dz);
          r.position.x += dx * Math.min(1, dt * 2); r.position.z += dz * Math.min(1, dt * 2); r.position.y = 2 * LAKE;
          r.rotation.set(0, 0, PI); if (d > 0.05) r.rotation.y = Math.atan2(dx, dz);
          lakeMira.speed = Math.min(3, d * 2);
        });
        game.onUpdate(() => {
          if (S.phase !== 'bridge' || S.busy || !game.control || ui.dlgActive) return;
          if (pl.pos.z < -3 && pl.pos.z > -16 && onDeck() && once('lakeMira')) side(async () => {
            lakeMira.root.position.set(pl.pos.x + 1.3, 2 * LAKE, pl.pos.z - 2.6); lakeMira.root.visible = true; follow = true; audio.sfxPlay('anomaly');
            await game.say('m19lake', 'Kai.');
            // staged: look down through the still water at her, walking upside down on the bridge that is only there
            cine(true); { const m = lakeMira.root.position; await game.shot([pl.pos.x - 0.8, 2.4, pl.pos.z + 1.8], [m.x, 2 * LAKE - 1.0, m.z], 1.4, { fov: 46 }); }
            await game.say('kai', 'Mira? Where are you?');
            await game.say('m19lake', 'Down here. Where the bridge is. Don\'t stop walking. You never liked heights.');
            await game.say('kai', 'I was seven.');
            await game.say('m19lake', 'You walked like Dad even then. Like the ground owed you something.');
            cine(false);
          });
          if (pl.pos.z < -24 && pl.pos.z > -34 && pl.pos.y > -0.5 && follow && once('lakeMiraGo')) side(async () => {
            await game.say('m19lake', 'The rest of me is past the doors. Come and ask.');
            follow = false; await tween(1.0, k => { lakeMira.root.position.y = 2 * LAKE - k * 2; }); lakeMira.root.visible = false;
          });
          // the island: a checkpoint and Orren on the bench
          if (pl.pos.z < -24.4 && pl.pos.z > -33.8 && pl.pos.x > BR.island[0] && pl.pos.x < BR.island[1] && pl.grounded && once('island')) {
            game.checkpoint(-4, 0, -28.5, PI); orren.root.position.set(...BR.orren); orren.root.rotation.y = PI / 2; orren.root.visible = true; orren.pose = 'sit';
            ui.toast('PLATFORM TWO · HARROW NORTH', 2200);
          }
          if (pl.pos.z < -56.4 && pl.grounded) toPlaza();
        });
        talkOrren('island', 'Sit with Orren', BR.orren, [
          ['kai', 'You got here first again.'],
          ['orren', 'I like this bench. Six hundred people waited on it in one of your worlds. In this one, nobody had to.'],
          ['kai', 'What happens to you when this is over?'],
          ['orren', 'When you make your last choice, a lot of places like this get decided. I\'d like to still be here after.'],
          ['kai', 'Are you real?'],
          ['orren', 'Are you? A man, a memory or a road that learned to talk. Would it change what I said?'],
          ...(witnessEcho ? [['orren', `The other one came through here. The man with the notches. ${iterations.toLocaleString('en-GB')} of them. He never sat down.`]] : []),
        ], async () => { ev('Orren, on the platform', '"When you make your last choice, a lot of places like this get decided. I\'d like to still be here after." He fears the final choice will erase him.', 'PEOPLE'); });
        page(2, BR.page);
        shard('Platform Two, in the gorge', BR.shard);
        await game.waitFor(() => S.phase === 'door' && !S.main);
      } else {
        pl.place(0, 0, -58, PI); orren.root.visible = false; await ui.fade(0, 900); await toPlaza();
      }
      F.m19bridgeFalls = G.falls;
      // ---------- IV · the door ----------
      const D = M.door, len = stripInfo(0, 0).len;
      Object.assign(S, { spot: 0, prog: 0, arrived: false, hopCool: 0 });
      const placeDoor = (x, z, ry) => { D.position.set(x, 0, z); D.rotation.y = ry; };
      placeDoor(...PLZ.spots[0]);
      const doorBox = game.collision.add([0, 0, 0], [0, 0, 0]);
      const syncBox = () => { const c = Math.cos(D.rotation.y), s = Math.sin(D.rotation.y), hx = Math.abs(c) * 0.85 + Math.abs(s) * 0.15, hz = Math.abs(s) * 0.85 + Math.abs(c) * 0.15; doorBox.min.set(D.position.x - hx, 0, D.position.z - hz); doorBox.max.set(D.position.x + hx, 2.7, D.position.z + hz); };
      syncBox();
      const hop = () => {
        S.hopCool = 1.4; G.hops++; audio.sfxPlay('rewind');
        // the spot furthest from Kai that is not the current one
        let best = 0, bd = -1; PLZ.spots.forEach(([x, z], i) => { if (i === S.spot) return; const d = Math.hypot(x - pl.pos.x, z - pl.pos.z); if (d > bd) { bd = d; best = i; } });
        S.spot = best; placeDoor(...PLZ.spots[best]); syncBox();
        if (G.hops === 1) side(async () => { await game.say('kai', 'It moved. The moment I got close, it was somewhere else.'); });
        if (G.hops === 4) side(async () => { await game.say('kai', 'Walking at it doesn\'t work. Sixteen of me must have tried that.'); });
      };
      game.onUpdate((dt) => {
        if (S.phase !== 'door' || S.arrived) return;
        S.hopCool -= dt;
        const p = pl.pos, info = stripInfo(p.x, p.z);
        if (info.d < 1.9 && info.s <= S.prog + 4.5) S.prog = Math.max(S.prog, info.s);
        else if (info.d > 2.7 && S.prog > 0) { if (S.prog > 8) { G.offPath++; ui.toast('OFF THE PATH · THE FOOTSTEPS CLOSE IN', 1800); audio.sfxPlay('fail'); } S.prog = 0; }
        musicState.progress = S.prog / len;
        if (!game.control || S.busy) return;
        if (S.prog > len - 2.5) { S.arrived = true; arrive(); return; }
        if (S.hopCool <= 0 && Math.hypot(p.x - D.position.x, p.z - D.position.z) < 4.5) hop();
        for (const [x, z, kind] of PLZ.inlays) if (Math.hypot(p.x - x, p.z - z) < 1.2 && once('inlay' + kind)) side(async () => {
          await game.say('kai', { clock: 'Hensel\'s mark. Set into the paving.', star: 'The observatory pattern. In the stone.', helix: 'The Helix badge. On the ground, where nobody walked.' }[kind]);
          if (kind === 'clock' && !game.residueOn) ui.subtitle('orren', 'Look the way you look for the past.', 3000);
        });
      });
      hint(() => S.phase === 'door' && !S.arrived && !game.residueOn && !G.residueUsed, 50, () => { ui.subtitle('orren', 'Look the way you look for the past.', 3800); ui.toast('RESIDUE VISION · F (or the eye button)', 3200); });
      hint(() => S.phase === 'door' && !S.arrived && G.residueUsed && S.prog < 6, 70, () => ui.subtitle('orren', 'Not where they walked. Where they didn\'t. The marks on the ground are yours.', 4200));
      game.onUpdate(() => { if (S.phase === 'door' && game.residueOn && once('prints')) side(async () => { await game.say('kai', 'Footprints. Hundreds of them. Every one of me, heading for a door.'); await game.say('kai', 'And a lane nobody stepped in.'); }); });
      const arrive = async () => { await game.waitFor(() => !S.busy && game.control && !ui.dlgActive); await side(async () => {
        cine(true); S.main = true;
        placeDoor(...PLZ.final); syncBox(); D.visible = true; audio.sfxPlay('motif');
        await game.shot([pl.pos.x + 2.4, 2.0, pl.pos.z + 3.2], [PLZ.final[0], 1.4, PLZ.final[1]], 1.8, { fov: 44 });
        await tween(1.4, k => { M.doorHalo.material.opacity = k * 0.35; });
        await game.say('kai', 'It stayed.');
        S.main = false; cine(false);
        objective('The door stayed.');
      }); S.stayed = true; };
      // optional at the concourse
      talkOrren('fate', 'Ask Orren what happens to him', [-2.4, 0, -58.6], [
        ['kai', 'If I go through that door, what happens to you?'],
        ['orren', 'I go on keeping the roads company. Unless somebody decides there shouldn\'t be roads here.'],
        ['kai', 'Who would decide that?'],
        ['orren', 'You, Kai. Or one of you. That\'s what a final choice is: someone deciding which gaps get filled in.'],
      ]);
      page(3, PLZ.page);
      shard('under the observatory dome', PLZ.shard);
      act({ pos: [-2.4, 1.0, -58.6], radius: 2.0, prompt: 'Look back across the gorge', enabled: () => S.phase === 'door' && !S.seen.lookback, onUse: () => side(async () => {
        S.seen.lookback = true; cine(true);
        await game.shot([0, 2.4, -58], [0, LAKE - 3, -10], 2.4, { fov: 52 });
        await game.say('kai', 'From this side you can see the whole bridge in the water. Every lamp. Nobody ever built a single one of them.');
      }) });
      await game.waitFor(() => S.stayed && !S.main && !S.busy);
      await new Promise(res => {
        const it = act({ pos: [PLZ.final[0], 1.0, PLZ.final[1] + 1.2], radius: 1.8, prompt: 'Open the door', onUse: () => side(async () => {
          it.done(); cine(true); S.main = true;
          orren.root.position.set(PLZ.final[0] + 2.4, 0, PLZ.final[1] + 3.0); orren.root.rotation.y = -PI * 0.75; orren.root.visible = true; orren.pose = null;
          await convo(orren, [
            ['orren', 'I\'ll wait here. Doors like that don\'t let me through.'],
            ['kai', 'Will you still be here after?'],
            ['orren', 'Depends what you choose. Choose like somebody lives in the gaps.'],
          ]);
          audio.sfxPlay('door');
          await game.shot([PLZ.final[0] - 1.6, 1.7, PLZ.final[1] + 3.4], [PLZ.final[0], 1.4, PLZ.final[1]], 1.4, { fov: 40 });
          await tween(1.0, k => { M.doorLeaf.rotation.y = -k * 1.3; M.doorLeaf.position.x = -k * 0.4; M.doorHalo.material.opacity = 0.35 + k * 0.4; });
          await ui.fade(1, 1400); res();
        }) });
      });
      F.m19doorHops = G.hops; F.m19offPath = G.offPath;
      await finale(M, Hh);
    }

    // =================================================================================================================
    // Test Hall Zero, 08:14:09 and a half — Mira
    // =================================================================================================================
    async function finale(M, Hh) {
      S.phase = 'mira'; G.ch = 5;
      M.root.visible = false; Hh.root.visible = true;
      pl.place(...HALL.start); game.checkpoint(...HALL.start);
      const visitors = [];
      [[-6, -3.6, 0.1], [-4.4, -4.2, -0.2], [4.6, -3.8, 0.3], [6.2, -4.4, 0], [-2.6, -2.4, 0.4], [3.0, -2.2, -0.3]].forEach(([x, z, ry], i) => {
        const c = game.ambient({ ...VISITORS26[i % VISITORS26.length], seed: 1990 + i }, HALL.x + x, 0, HALL.z + z, PI + ry); c.pose = 'look';
        try { c.setGhost(0xe8eef8); } catch (err) { void err; } c.frozen = true; visitors.push(c);
      });
      const kid = game.actor('m19kidmira', null, ...HALL.kid, PI); small.add(kid); kid.pose = 'look'; S.byId.m19kidmira = kid;
      const kidKai = game.actor('m19kidkai', null, ...HALL.kidKai, PI * 0.9); small.add(kidKai);
      try { kid.setGhost(GHOST_MIRA); kidKai.setGhost(GHOST_KID); } catch (err) { void err; }
      kid.frozen = true; kidKai.frozen = true;
      const mira = game.actor('m19mira', null, ...HALL.mira, PI * 0.85); S.byId.m19mira = mira;
      await tick();
      cine(true); S.main = true; lockMusic('m19-mira', 2.0);
      await game.shot([HALL.x + 7, 4.4, HALL.z + 9], [HALL.x, 2.6, HALL.z - 8], 0.01, { fov: 52 });
      await ui.fade(0, 2200);
      await game.shot([HALL.x + 4, 3.0, HALL.z + 6], [HALL.x - 0.4, 1.4, HALL.z - 6], 3.6, { fov: 48 });
      await game.say('m19band', 'Test Hall Zero. Nineteenth October, twenty twenty-six. Eight fourteen and nine seconds... and a half.');
      await game.shot([HALL.x - 1.4, 1.1, HALL.z - 2.6], [HALL.kid[0], 0.9, HALL.kid[2]], 2.6, { fov: 36 });
      await game.say('kai', 'That\'s us. She\'s under the rope. I\'ve still got her hand.');
      audio.silence?.(1.2); await game.wait(0.8); audio.unsilence?.();
      pl.place(HALL.x - 0.4, 0, HALL.z - 1.0, PI * 0.9);
      await game.shot([HALL.x - 2.2, 1.6, HALL.z + 0.6], [HALL.mira[0], 1.55, HALL.mira[2]], 2.0, { fov: 40 });
      await convo(mira, [
        ['m19mira', 'You came.'],
        ['kai', 'I came to bring you back.'],
        ['m19mira', 'Back to what? You keep saying back as if it\'s a place.'],
        ['kai', 'To before. To a morning where you don\'t go under the rope. Where I hold on.'],
        ['m19mira', 'Where you\'re not the reason.'],
        ['kai', 'I let go of your hand.'],
        ['m19mira', 'I know. I was there. I\'m still there.'],
      ]);
      audio.silence?.(1.6); await game.wait(1.0); audio.unsilence?.();
      await game.shot([HALL.mira[0] - 0.9, 1.6, HALL.mira[2] + 1.4], [HALL.mira[0], 1.58, HALL.mira[2]], 1.6, { fov: 32 });
      await game.say('m19mira', 'Kai. You\'ve been trying to reach the version of me that would forgive you.');
      await game.wait(0.6);
      await game.say('kai', 'Is there one?');
      await convo(mira, [
        ['m19mira', `There are more versions of me than you can count. You saved most of them. ${pattern} percent of me remembers every one.`],
        ['m19mira', 'You never asked any of them what she was reaching for.'],
      ]);
      const c = await choose('kai', 'What do you tell her?', ['I\'m asking now.', 'I only wanted you to live.', 'I\'m sorry.'], 0);
      G.answer = ['ask', 'live', 'sorry'][c];
      if (c === 0) await convo(mira, [['kai', 'I\'m asking now.'], ['m19mira', 'Then don\'t answer for me. Come and see it. Not to fix it. To see it.']]);
      if (c === 1) await convo(mira, [['kai', 'I only wanted you to live.'], ['m19mira', 'I know. You saved me the way a machine saves a file. Every copy perfect. None of them asked.']]);
      if (c === 2) await convo(mira, [['kai', 'I\'m sorry.'], ['m19mira', 'I know you are. Sorry is about you, Kai. I\'m asking about me.']]);
      await convo(mira, [
        ['m19mira', 'Saving me and understanding me aren\'t the same thing. You\'ve got very good at the first one.'],
        ['kai', 'Then help me with the second.'],
        ['m19mira', 'Look at her. Ten years old, reaching into a ring of light. What was she reaching for?'],
        ['kai', 'The light. The machine. I always thought it was the machine.'],
        ['m19mira', 'You always thought. Come and remember with me. Mine, not yours. Some of them won\'t agree with each other.'],
      ]);
      await game.shot([HALL.x + 1.6, 1.3, HALL.z - 3.4], [HALL.kid[0], 0.9, HALL.kid[2]], 2.2, { fov: 38 });
      await walkTo(mira, [[HALL.kid[0] + 0.6, 0, HALL.kid[2] + 0.5]], 1.0);
      mira.lookTarget = kid.head;
      await game.say('m19mira', 'She wasn\'t afraid. That\'s the first thing you got wrong.');
      audio.sfxPlay('anomaly');
      await game.shot([HALL.x + 6, 5.2, HALL.z + 8], [HALL.x, 3.0, HALL.z - 10], 4.0, { fov: 54 });
      try { Hh.ring.userData.disc.material.uniforms.uPower.value = 0.8; } catch (err) { void err; }
      await game.say('m19band', 'Time index: eight fourteen and nine and a half. Holding. Pattern: Varen, Mira. More than sixty-one percent.');
      // flags
      F.m19done = true; F.m19quote = true; F.miraChallenged = true; F.unwrittenSecondReached = true; F.m19miraAnswer = G.answer;
      F.m19shards = G.shards; F.m19evidence = G.ev.size; F.m19pages = G.pages.size; F.m19orrenTalks = G.orren.size; F.m19kitchen = G.kitchen; F.m19idCard = G.idCard;
      F.m19symbols = 3; F.m19residue = G.residueUsed;
      await ui.fade(1, 2600);
      const mins = Math.round((game.time - tStart) / 60);
      await ui.chapterCard('MISSION 19 COMPLETE', 'The Place Outside Time', `Wrong turns ${G.wrong} · Rooms looped ${G.roomLoops} · Falls ${G.falls} · Record ${G.pages.size}/${PAGES} · Evidence ${G.ev.size} · Shards ${G.shards}/${SHARDS}${mins ? ' · ' + mins + ' min' : ''}`, 4400);
    }

    // =================================================================================================================
    // run
    // =================================================================================================================
    try {
      if (startPart <= 1) await chapter1();
      if (startPart <= 2) await chapter2();
      await chapter34(startPart >= 4);
    } finally {
      kai.lookTarget = null; kai.pose = null; game.fallRespawn = true; pl.edgeAssist = true;
      game.releaseCam(); ui.letterbox(false); audio.allBeds?.(0); audio.setTheme(null);
      window.__m19 = null;
    }
  },
};
