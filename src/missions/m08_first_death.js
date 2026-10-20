// MISSION 8 · THE FIRST DEATH (Act I) — reveal that the present has changed.
// Bible beats: investigate an altered facility · find a missing researcher · recover a corrupted security log ·
// reconstruct the final ten minutes before the Zero Second · escape a temporal containment chamber.
// Quote: "Don't save me." / "Why?" / "Because I am not the one who died."
// Ending: the system identifies the current timeline as VERSION 17; no surviving record of the previous sixteen.
// Kai comes home from the Sky House to a Helix where a version of him led the project and died at 08:14 holding the
// second, and where Dr. Yara Lind, a colleague he has never met, has been missing ever since. Reflects flags.trustedHale.
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { Rain, canvasTex } from '../world/kit.js';
import { Drone } from '../world/props.js';
import { CAST } from '../story/cast.js';
import { renderPortraits } from '../core/character.js';
import { buildHelix, registerM8Cast, registerM8Themes, musicState, P, CH, CLAMPS, polarC, SHARDS, STAFF, TECHS, TEX } from '../world/env_m8.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
const Y0 = 0.12;

// The six lost segments of SEC-LOG 1 (08:04-08:14). `order` is the true chronology; the board lists them shuffled.
const SEGS = {
  a: { cam: 'C1', order: 0, time: '08:04', title: 'Lobby · he runs in, on the phone', why: 'he\'s on the phone saying he\'s coming up. That\'s where it starts.' },
  b: { cam: 'C2', order: 1, time: '08:06', title: 'Security · she orders the antechamber sealed', why: 'her badge read the security office at 08:06.' },
  c: { cam: 'C3', order: 2, time: '08:09', title: 'Maintenance · every bus to containment', why: 'her badge read maintenance at 08:09. That\'s when the log went dark.' },
  d: { cam: 'C4', order: 3, time: '08:10', title: 'Corridor north · someone at the door', why: 'they walk north after the power\'s rerouted, and before the seal.' },
  e: { cam: 'C5', order: 4, time: '08:12', title: 'Antechamber · "seal it behind me"', why: 'her last badge read was the antechamber, 08:12.' },
  f: { cam: 'C6', order: 5, time: '08:14', title: 'Chamber One · the second', why: 'that\'s 08:14. Everything else comes first.' },
};
const BOARD_ORDER = ['c', 'f', 'a', 'e', 'b', 'd'];

export default {
  id: 'm8', act: 'ACT I · THE WORLD THAT REMEMBERS', title: 'The First Death', sub: 'Helix · an altered present',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, F = game.flags, pl = game.player, renderer = game.engine.renderer;
    const tStart = game.time, tok = game.token;
    const tick = () => new Promise(r => setTimeout(r, 0));
    registerM8Cast(); registerM8Themes();
    try {
      const need = ['yara', 'm8guard', 'm8staff', 'm8tech'].filter(id => !ui.portraits[id] && CAST[id]?.look);
      if (need.length) Object.assign(ui.portraits, renderPortraits(Object.fromEntries(need.map(id => [id, CAST[id]]))));
    } catch (err) { console.warn('m8 portraits', err); }

    const scene = game.newScene({ background: 0x05070a, fog: [0x10141a, 0.012], exposure: 1.1, bloom: 0.6, bloomThreshold: 0.86, envIntensity: 0.7, killY: -20, residue: true });
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    const Q = RZ.getQuality(), low = Q === 'low';
    game.onUpdate(dt => RZ.update(dt));
    await tick();
    const W = buildHelix(game, scene, { trusted: F.trustedHale !== false, aligned: !!F.m7aligned });
    game.onUpdate((dt, t) => W.update(dt, t));
    for (const g of Object.values(W.ghosts)) game.residue(g);   // the previous version shows through in Residue Vision
    await tick();

    // ---------- sky, image-based light, rain ----------
    let night = null, interior = null, chamberEnv = null;
    try {
      night = RZ.skyEnvironment(renderer, scene, { preset: 'night-city', cover: 0.88, apply: false });
      interior = RZ.skyEnvironment(renderer, scene, { preset: 'interior', color: 0xeaf2ff, wall: 0x30363e, window: 0x6a7a90, apply: false });
      chamberEnv = RZ.skyEnvironment(renderer, scene, { preset: 'interior', color: 0x7fe0ff, wall: 0x1a2026, window: 0x3a6a80, intensity: 3, apply: false });
    } catch (err) { console.warn('m8 sky', err); }
    const rain = new Rain(low ? 1800 : 4200, 40); scene.add(rain.mesh);
    game.onUpdate(dt => { if (rain.mesh.visible) rain.update(dt, game.engine.camera); });

    // ---------- lights: hemi + one shadowed key + four points re-rigged to the nearest fixtures (6 total) ----------
    const hemi = new THREE.HemisphereLight(0x9fb4c8, 0x14161a, 0.3); scene.add(hemi);
    const key = new THREE.SpotLight(0xeaf2ff, 60, 18, 0.9, 0.6, 1.5); key.castShadow = !low;
    key.shadow.mapSize.set(Q === 'high' ? 1024 : 512, Q === 'high' ? 1024 : 512); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; scene.add(key, key.target);
    const pts = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); return l; });
    const zoneOf = (p) => p.z < -60.4 ? 'chamber' : (p.z > 0.25 || p.x > 16.6) ? 'out' : 'in';
    const ZONE = {
      out: { fog: [0x161a20, 0.014], env: 0.75, hemi: [0x40506a, 0x0c0c0e, 0.35], exp: 1.15 },
      in: { fog: [0x1a1e24, 0.008], env: 0.85, hemi: [0xb8c4d0, 0x2a2c30, 0.35], exp: 1.05 },
      chamber: { fog: [0x061418, 0.02], env: 0.7, hemi: [0x5fe6ff, 0x0a1014, 0.3], exp: 1.1 },
    };
    let zone = null, emergency = 0;
    const applyZone = (z) => {
      zone = z; const c = ZONE[z];
      scene.fog.color.set(c.fog[0]); scene.fog.density = c.fog[1];
      const e = z === 'out' ? night : z === 'chamber' ? chamberEnv : interior;
      if (night) scene.background = night.background;
      if (e) { scene.environment = e.envMap; scene.environmentIntensity = c.env; }
      hemi.color.set(c.hemi[0]); hemi.groundColor.set(c.hemi[1]); hemi.intensity = c.hemi[2];
      renderer.toneMappingExposure = c.exp;
      rain.mesh.visible = z === 'out';
      audio.rain(z === 'out' ? 0.6 : 0.1); audio.hum(z === 'chamber' ? 0.22 : z === 'in' ? 0.08 : 0, z === 'chamber' ? 41 : 55);
      lightT = 0;
    };
    let lightT = 0;
    const rigLights = () => {
      const p = game.cine ? game.engine.camera.position : pl.pos;
      const z = zone || 'out';
      const list = W.lightSrc.filter(s => s.zone === z || (z === 'in' && s.zone === 'out' && p.z > -3)).map(s => ({ ...s, dd: (s.p[0] - p.x) ** 2 + (s.p[1] - p.y) ** 2 + (s.p[2] - p.z) ** 2 })).sort((a, b) => a.dd - b.dd);
      const k = list[0];
      if (k) { key.position.set(...k.p); key.target.position.set(k.p[0], 0, k.p[2] - 0.5); key.color.set(emergency ? 0xff6a5a : k.c); key.intensity = k.i * 3.2; key.distance = k.d * 1.6; }
      pts.forEach((l, i) => { const s = list[i + 1]; if (!s) { l.intensity = 0; return; } l.position.set(...s.p); l.color.set(emergency && s.zone !== 'out' ? 0xff7a6a : s.c); l.intensity = s.i; l.distance = s.d; });
    };
    game.onUpdate(dt => {
      const z = zoneOf(game.cine ? game.engine.camera.position : pl.pos); if (z !== zone) applyZone(z);
      lightT -= dt; if (lightT <= 0) { lightT = 0.45; rigLights(); }
    });

    // ---------- music ----------
    let musicLock = null, hunting = false;
    const themeFor = () => musicLock || (hunting ? 'm8-hunt' : 'm8-altered');
    const music = (fade = 1.6) => { for (const d of T.defs) d.theme = themeFor(); audio.setTheme(themeFor(), fade); };
    const lockMusic = (th, fade) => { musicLock = th; music(fade); };

    T.configure([{ id: '2049', key: '1', name: 'PRESENT', year: 'HELIX · THU 21.10.2049', glyph: '◎', color: '#5fe6ff', theme: 'm8-altered', apply: () => {} }], '2049');
    T.unlocked = false;

    // ---------- people ----------
    const trustedNow = () => F.trustedHale !== false;
    const kai = pl.char;
    const people = {};
    const hale = game.actor('hale', null, 0.4, Y0, -8.5, 0); people.hale = hale;
    const guard = game.actor('m8guard', null, -0.6, Y0, -8.5, 0);
    hale.root.visible = trustedNow(); guard.root.visible = !trustedNow();
    const staffA = game.ambient({ ...STAFF[0] }, -8.6, Y0, -2.6, Math.PI); staffA.pose = 'sit';
    const staffB = game.actor('m8staff', null, 8.2, Y0, -9.6, -Math.PI / 2); staffB.pose = 'work';
    const iven = game.actor('iven', null, -3.6, Y0, -46, Math.PI / 2); iven.root.visible = false;
    const techs = TECHS.map((lk, i) => { const t = game.ambient({ ...lk }, -6.5 - i * 1.2, Y0, -44.5 - i * 1.4, Math.PI / 2); t.root.visible = false; return t; });
    await tick();
    // echoes of the 08:04-08:14 log (shown only during a re-synced segment)
    const echo = {};
    const mkEcho = (id, look, col) => { try { const c = game.actor(id, look, 0, -50, 0, 0); c.setGhost(col); c.root.visible = false; return c; } catch (err) { console.warn('m8 echo', id, err); return null; } };
    echo.kai = mkEcho('kai17', { ...CAST.kai.look, role: 'kai', era: '2049' }, 0x5fe6ff);
    echo.yara = mkEcho('yaraecho', { ...CAST.yara.look }, 0x9fe8ff);
    echo.fig = mkEcho('figure', { ...CAST.witness.look, era: '2049' }, 0x9a7bff);
    await tick();
    const yara = game.actor('yara', null, -0.6, Y0, -66.6, Math.PI);
    yara.speed = 3.4; yara.lookTarget = null;
    setTimeout(() => { if (game.token === tok) yara.frozen = true; }, 900);
    await tick();

    // Kai's portrait on the memorial easel
    try {
      const src = ui.portraits.kai;
      if (src) {
        const tex = new THREE.TextureLoader().load(src); tex.colorSpace = THREE.SRGBColorSpace;
        const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, color: 0xd8d4cc }));
        ph.position.set(W.portraitPos[0], W.portraitPos[1], W.portraitPos[2] + 0.07); ph.rotation.x = -0.12; scene.add(ph);
      }
    } catch (err) { console.warn('m8 portrait', err); }

    // ---------- state + helpers ----------
    const S = { diffs: new Set(), segs: new Set(), cards: new Set(), shards: 0, seen: {}, hits: 0, clamps: 0, board: [], ended: false };
    window.__m8 = { S, W, echo, yara, iven, people };
    const near = (x, z, r) => Math.hypot(pl.pos.x - x, pl.pos.z - z) < r;
    const once = (k) => { if (S.seen[k]) return false; S.seen[k] = true; return true; };
    const cine = (on) => { game.control = !on; ui.letterbox(on); if (!on) game.releaseCam(); };
    const tween = (sec, fn) => new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); fn(u * u * (3 - 2 * u)); if (u >= 1) { off(); res(); } }); });
    const hint = (cond, secs, fn) => { let t = 0; return game.onUpdate(dt => { if (!game.control || ui.dlgActive) return; if (cond()) { t += dt; if (t > secs) { t = -secs; fn(); } } else t = 0; }); };
    const walkTo = (ch, to, dur) => new Promise(res => {
      if (!ch) { res(); return; }
      const from = ch.root.position.clone(), tgt = new THREE.Vector3(...to), dist = from.distanceTo(tgt); let u = 0;
      const off = game.onUpdate(dt => {
        u = Math.min(1, u + dt / dur); ch.root.position.lerpVectors(from, tgt, u);
        ch.speed = u < 1 ? dist / dur : 0; if (u < 0.98 && dist > 0.05) ch.faceTowards(tgt.x, tgt.z, dt, 8);
        if (u >= 1) { off(); ch.speed = 0; res(); }
      });
    });
    let shiftPulse = 0;
    game.onUpdate(dt => { if (shiftPulse > 0) { shiftPulse = Math.max(0, shiftPulse - dt * 1.4); game.engine.fx.uShift.value = shiftPulse; } });
    const ev = (title, text, tag) => ui.addEvidence(title, text, tag);
    // choices (tests may queue answers in game.autoQueue)
    const choose = (id, text, opts) => { if (game.autoplay && game.autoQueue?.length) game.autoChoice = game.autoQueue.shift(); return game.choice(id, text, opts); };
    const objective = (t) => { if (S.obj !== t) { S.obj = t; game.objective(t); } };

    // shards (five; positions from env)
    const SHARD_TXT = [
      ['Temporal shard: the forecourt', 'Under the planter by the HELIX monolith, where the rain does not fall straight: a shard of crystallised time.'],
      ['Temporal shard: the lobby', 'Behind the logo wall, where the new letters meet the old: a shard of crystallised time.'],
      ['Temporal shard: Lab B', 'On Iven\'s bench, among parts that were never ordered in any version Kai remembers: a shard of crystallised time.'],
      ['Temporal shard: the loading yard', 'Among the crates in the yard, wedged against the fence: a shard of crystallised time.'],
      ['Temporal shard: the service passage', 'At the dead end of the service passage, humming against the chamber wall: a shard of crystallised time.'],
    ];
    SHARDS.forEach((p, i) => {
      game.interact({ pos: [p[0], 1.0, p[2]], radius: 1.7, prompt: 'Take the temporal shard', enabled: () => !(i === 2 && !S.labOpen), onUse: () => {
        const m = W.shardMeshes[i]; m.parent?.remove(m);
        S.shards++; F.shards = (F.shards || 0) + 1; F.m8shards = S.shards;
        audio.sfxPlay('anomaly'); ev(SHARD_TXT[i][0], SHARD_TXT[i][1], 'TEMPORAL SHARD · ' + S.shards + '/5');
      } });
    });

    // doors: the lobby entrance opens for anyone; the service door and the antechamber on conditions
    game.onUpdate(() => {
      W.doors.entrance.target = (Math.abs(pl.pos.x) < 4 && Math.abs(pl.pos.z) < 4.2) ? 1 : 0;
      W.doors.ante.target = S.power && (near(0, -50, 3.6) || S.anteHeld) ? 1 : 0;
      W.doors.turnstile.target = S.gateOpen ? 1 : 0;
      W.doors.service.target = S.serviceOpen && near(16.5, -10, 3.4) ? 1 : 0;
    });

    // checkpoints: on entering each room once the drones are up (and at key beats)
    const ROOMS = [
      { k: 'lobby', test: () => pl.pos.z > -15.8 && pl.pos.z < 0 && Math.abs(pl.pos.x) < 12, at: [0, Y0, -12.6, 0] },
      { k: 'sec', test: () => pl.pos.x < -2.4 && pl.pos.z < -16.4 && pl.pos.z > -27.8, at: [-4.0, Y0, -22.0, -Math.PI / 2] },
      { k: 'rec', test: () => pl.pos.x < -2.4 && pl.pos.z < -28.2 && pl.pos.z > -41.8, at: [-4.0, Y0, -35.0, -Math.PI / 2] },
      { k: 'yara', test: () => pl.pos.x > 2.4 && pl.pos.x < 12 && pl.pos.z < -16.4 && pl.pos.z > -24.8, at: [4.0, Y0, -20.0, Math.PI / 2] },
      { k: 'kai', test: () => pl.pos.x > 2.4 && pl.pos.x < 12 && pl.pos.z < -25.2 && pl.pos.z > -32.8, at: [4.0, Y0, -29.0, Math.PI / 2] },
      { k: 'maint', test: () => pl.pos.x > 2.4 && pl.pos.x < 12.4 && pl.pos.z < -33.2 && pl.pos.z > -45.8, at: [4.0, Y0, -39.0, Math.PI / 2] },
      { k: 'ante', test: () => pl.pos.z < -50.6 && pl.pos.z > -59.8, at: [0, Y0, -52.0, Math.PI] },
    ];
    let lastRoom = null;
    game.onUpdate(() => {
      if (!game.control || S.inChamber) return;
      for (const r of ROOMS) if (r.test()) { if (lastRoom !== r.k) { lastRoom = r.k; if (S.power) game.checkpoint(...r.at, resetDrones); } return; }
      lastRoom = null;
    });

    // ---------- drones (wake with the security bus) ----------
    const drones = [
      new Drone(game, [[0, 2.6, -17.6], [0, 2.6, -48.4]], { speed: 1.25, range: 7.5 }),
      new Drone(game, [[0, 2.6, -48.4], [0, 2.6, -17.6]], { speed: 1.05, range: 7.0 }),
    ];
    drones.forEach(d => { d.mesh.visible = false; d.disabled = true; d.pool.visible = false; });
    window.__m8.drones = drones;
    const resetDrones = () => { drones.forEach((d, i) => { d.mesh.position.copy(d.path[0]); d.i = 0; d.alert = 0; d.wait = i * 2; }); };
    const setDrones = (on) => { drones.forEach(d => { d.mesh.visible = on; d.disabled = !on; d.pool.visible = on; }); hunting = on; music(); };
    game.onUpdate(dt => {
      if (!game.control || S.dronesOff || drones[0].disabled) { if (!drones[0].disabled) ui.detection(0); return; }
      let a = 0; for (const d of drones) a = Math.max(a, d.update(dt));
      ui.detection(a);
      if (a >= 1) { resetDrones(); game.fail('DETECTED BY A SECURITY DRONE'); }
    });

    // ---------- the cameras: residue LEDs + re-sync ----------
    game.onUpdate((dt, t) => {
      for (const c of W.cams) {
        const seg = Object.keys(SEGS).find(k => SEGS[k].cam === c.id);
        const live = S.serverRead && !S.segs.has(seg) && game.residueOn;
        c.led.material.color.set(live ? 0x5fe6ff : S.segs.has(seg) ? 0x7fffb0 : 0xff4d5e);
        c.led.scale.setScalar(live ? 2.2 + Math.sin(t * 5) * 0.6 : 1);
      }
    });

    // =====================================================================================================
    // EXTERIOR: the memorial and its cards
    // =====================================================================================================
    const cardTexts = [
      ['J. Park', 'My train stopped one second before the platform. I walked home. Somebody held that second for me. Thank you, Doctor.'],
      ['M.', 'You promised you would come back for the drawing. I kept it for you. I always keep it.'],
      [trustedNow() ? 'R. Hale' : 'Helix Security', trustedNow() ? 'You told me once to trust you. I did. Night shift will keep the light on.' : 'From the night shift. For the man who stayed when we were told to leave.'],
    ];
    W.cards.forEach((p, i) => {
      game.interact({ pos: [p[0], 0.8, p[2]], radius: 1.3, prompt: `Read the card from ${cardTexts[i][0]}`, enabled: () => S.memorial, onUse: async () => {
        S.cards.add(i); F.m8cards = S.cards.size;
        ui.addEvidence(`Memorial card · ${cardTexts[i][0]}`, cardTexts[i][1], 'THE MEMORIAL · ' + S.cards.size + '/3');
        if (i === 0) ui.subtitle('kai', 'Jun. In my version I pulled him off that platform myself.', 3600);
        if (i === 1) { ui.subtitle('kai', 'M. ...Mira kept the drawing. Mira, who died in 2026.', 3800); F.m8miraCard = true; }
        if (i === 2) ui.subtitle('kai', trustedNow() ? 'Hale. He remembers something he shouldn\'t.' : 'The night shift. Whoever I was here, they liked him.', 3400);
      } });
    });
    game.interact({ pos: [P.memorial[0], 1.0, P.memorial[2] + 0.6], radius: 2.2, prompt: 'Look at the memorial', enabled: () => !S.memorial, onUse: () => { S.memorialUse = true; } });
    game.interact({ pos: [P.kiosk[0] + 1.6, 1.0, P.kiosk[2]], radius: 1.8, prompt: 'Look into the gate kiosk', onUse: () => {
      ev('The gate kiosk', 'An empty gatehouse with the visitor log open on Tuesday: "19.10 · 07:58 · VAREN, K. — on foot, running." The pen is still on the page.', 'HELIX · FORECOURT');
      ui.subtitle('kai', '07:58, on foot, running. He knew it was coming.', 3200);
    } });

    // =====================================================================================================
    // LOBBY: what changed
    // =====================================================================================================
    const diffNeed = ['directory', 'plaque'];
    const diff = (k) => { S.diffs.add(k); F.m8differences = S.diffs.size; };
    game.interact({ pos: [P.directory[0], 1.2, P.directory[2] + 0.6], radius: 1.7, prompt: 'Read the staff directory', onUse: async () => {
      W.screens.dir.material.map = TEX.directory(trustedNow()); W.screens.dir.material.needsUpdate = true;
      cine(true);
      await game.shot([P.directory[0] + 0.9, 1.75, P.directory[2] + 1.5], [P.directory[0], 1.45, P.directory[2]], 1.0, { fov: 36 });
      await game.talk([
        ['kai', '"VAREN, K. Project lead. Deceased, 08:14."'],
        ['kai', 'I was a systems engineer. Here I ran the project.'],
        ['kai', '"LIND, Y. Containment. Missing, 08:14." I\'ve never heard that name in my life.'],
        ['kai', trustedNow() ? '"HALE, R. Night shift." Hale\'s here.' : '"HALE, R. Transferred, Checkpoint C." Not here, then.'],
      ]);
      cine(false); diff('directory');
      ev('The staff directory', `Level 1, this version: Rook (director), VAREN, K. (project lead, deceased 08:14), LIND, Y. (containment physicist, missing since 08:14), Brandt, ${trustedNow() ? 'Hale (night shift)' : 'Hale (transferred to Checkpoint C)'}, Marr. In Kai's Helix there was no Dr. Lind.`, 'WHAT CHANGED');
      if (once('dirResidue')) ui.toast(ui.words('RESIDUE VISION (F)\nShows what used to be here'), 3200);
    } });
    game.interact({ pos: [-11.0, 1.4, -6.0], radius: 1.8, prompt: 'Read the founding plaque', onUse: async () => {
      cine(true);
      await game.shot([-9.6, 1.8, -5.0], [-11.8, 1.9, -6.0], 1.0, { fov: 38 });
      await game.talk([
        ['kai', '"Founded 2029 by Dr. Elias Rook. Programme lead: Dr. Kai Varen."'],
        F.m7aligned ? ['kai', '"Raised on the count kept by the keepers of Site 3." The Sky House. Somebody here knows what I did up there.'] : ['kai', '"Raised on the work of the Site Zero survey, and those who came before it."'],
        ['kai', 'Same bronze, same font. Different history.'],
      ]);
      cine(false); diff('plaque');
      ev('The founding plaque', 'Founded 2029 by Dr. Elias Rook, with Dr. Kai Varen as programme lead. In Kai\'s version the plaque named Rook alone. Residue Vision shows the old one.', 'WHAT CHANGED');
    } });
    game.interact({ pos: [P.logo[0], 1.2, P.logo[2] + 1.2], radius: 2.2, prompt: 'Look at the Helix logo', once: false, onUse: () => {
      diff('logo');
      ui.subtitle('kai', game.residueOn ? 'Three broken arcs. That\'s the logo I know. Here somebody drew it closed.' : 'That\'s not our logo. Same name. Different hand drew it.', 3600);
      ev('The logo wall', 'Helix\'s logo is a closed ring of four orbits here. In Residue Vision the old one shows through: three broken arcs, the logo of Kai\'s Helix.', 'WHAT CHANGED');
    } });
    // the scientists react to a dead man walking
    hint(() => near(-8.6, -2.6, 3.2) && !S.seen.staffA, 0.2, () => { S.seen.staffA = true; ui.subtitle(null, 'SCIENTIST: Dr. Varen? ...No. Sorry. You look like someone.', 3400); });
    game.interact({ pos: [8.2, 1.0, -9.6], radius: 1.6, prompt: 'Talk to the scientist', onUse: async () => {
      staffB.pose = null; staffB.lookTarget = kai.head;
      await game.talk([
        ['m8staff', 'Oh God. You\'re— no. You\'re his brother? Nobody said he had a brother.'],
        ['kai', 'Something like that. Did you know Dr. Lind?'],
        ['m8staff', 'Yara? Everyone knows Yara. She went into the antechamber with him on Tuesday and never badged out.'],
        ['m8staff', 'Rook says she\'s on leave. Rook says a lot of things.'],
      ]);
      staffB.lookTarget = null; staffB.pose = 'work'; F.m8staffTalk = true;
      ev('A scientist on the late shift', '"She went into the antechamber with him on Tuesday and never badged out. Rook says she\'s on leave."', 'HELIX · LOBBY');
    } });

    // the turnstile: Kai's own card
    game.interact({ pos: [0, 1.0, -13.2], radius: 1.6, prompt: 'Use your Helix card at the turnstile', enabled: () => !S.gateOpen && !S.cardTried, onUse: () => { S.cardTried = true; } });

    // =====================================================================================================
    // THE SERVICE ROUTE (if Hale isn't here): the loading yard keypad remembers the last hand
    // =====================================================================================================
    game.onUpdate(() => { if (game.residueOn && near(16.6, -8.6, 3.2) && !S.codeSeen) { S.codeSeen = true; ui.subtitle('kai', 'Four keys still warm in the residue. 0, 8, 1, 4. In that order.', 3600); } });
    game.interact({ pos: [16.0, 1.2, -8.6], radius: 1.6, prompt: 'Enter a code on the service keypad', once: false, enabled: () => !S.serviceOpen, onUse: async () => {
      if (!S.codeSeen) { ui.toast(ui.words('ACCESS CODE REQUIRED\nResidue Vision (F) shows what the last hand did here'), 3400); audio.sfxPlay('fail'); return; }
      const i = await choose('kai', 'The service keypad. Four digits.', ['0 8 1 4', '1 4 0 8', '8 0 4 1', 'Step back']);
      if (i === 3) return;
      if (i !== 0) { audio.sfxPlay('fail'); ui.toast('ACCESS DENIED', 1800); ui.subtitle('kai', 'No. The residue had an order. 0 first.', 2600); return; }
      audio.sfxPlay('door'); S.serviceOpen = true; ui.toast('SERVICE DOOR · OPEN', 2000);
      ui.subtitle('kai', '08:14 with the numbers turned round. Of course.', 3000);
    } });

    // =====================================================================================================
    // OFFICES
    // =====================================================================================================
    game.interact({ pos: [P.yaraDesk[0] - 1.0, 1.0, P.yaraDesk[2]], radius: 1.8, prompt: 'Check Dr. Lind\'s desk', onUse: () => { S.yaraDeskUse = true; } });
    game.interact({ pos: [11.0, 1.4, -17.0], radius: 1.4, prompt: 'Look at the coat on the hook', onUse: () => {
      ui.subtitle('kai', 'Her coat. Card wallet still in the pocket. She meant to come back for it.', 3400);
      ev('Yara\'s coat', 'Her lab coat on the hook, a card wallet in the pocket: a photo of a woman on a mountain path, and a folded note in Kai\'s handwriting: "If it holds, don\'t follow me in."', 'DR. LIND\'S OFFICE');
    } });
    game.interact({ pos: [P.kaiDesk[0] - 1.0, 1.0, P.kaiDesk[2]], radius: 1.8, prompt: 'Play the voice memo on your desk', onUse: () => { S.memoUse = true; } });
    game.interact({ pos: [11.0, 1.4, -29.0], radius: 1.5, prompt: 'Look at the framed drawing', once: false, onUse: () => {
      diff('drawing'); F.m8drawing = true;
      ui.subtitle('kai', game.residueOn ? 'And there it is in the residue: on the floor, where I found it. Here somebody framed it.' : 'ME. MIRA. THE MACHINE. In my Helix this was lying on a lift-shaft floor. Here it\'s framed.', 4000);
      ev('The drawing, framed', 'The child\'s drawing from 2026 hangs framed in Dr. K. Varen\'s office. In Kai\'s version it lay on the floor below the main lift. Residue Vision shows it there.', 'WHAT CHANGED');
    } });
    game.interact({ pos: [2.8, 1.4, -27.4], radius: 1.3, prompt: 'Look at the door plate', once: false, onUse: () => {
      diff('office');
      ui.subtitle('kai', game.residueOn ? '"STORAGE 2B." That\'s what this room was in my version. A cupboard.' : '"DR. K. VAREN. Project lead." With a black ribbon in the corner.', 3600);
    } });
    game.interact({ pos: [P.records[0] + 0.9, 1.0, P.records[2]], radius: 1.6, prompt: 'Search the personnel records', onUse: async () => {
      await game.talk([
        ['kai', '"VAREN, K. Closed 19.10.2049. Cause: containment event. Remains: none recovered."'],
        ['kai', trustedNow() ? '"HALE, R. Commendation pending, 19.10. Refused to leave the antechamber corridor."' : '"HALE, R. Transferred 19.10. Refused an order from M. Brandt."'],
        ['kai', 'Every record has a version field. Every one of them is blank.'],
      ]);
      F.m8records = true;
      ev('Personnel records', `Varen, K.: closed 19.10.2049, containment event, no remains recovered. Lind, Y.: open, missing. ${trustedNow() ? 'Hale, R.: commendation pending, "refused to leave the antechamber corridor".' : 'Hale, R.: transferred after refusing an order from Brandt.'} Every record carries a VERSION field, left blank.`, 'HELIX · RECORDS');
    } });

    // =====================================================================================================
    // THE TECHNICIAN'S KEY (optional): Iven Marr's team behind the jammed Lab B door
    // =====================================================================================================
    game.interact({ pos: [-1.6, 1.2, -46], radius: 1.6, prompt: 'Press the Lab B intercom', once: false, enabled: () => !S.labOpen, onUse: async () => {
      if (S.ivenCalled) { ui.subtitle('iven', 'The red wheel in Records, south wall. Put your back into it.', 3200); return; }
      S.ivenCalled = true; audio.sfxPlay('blip');
      await game.talk([
        ['iven', 'Hello? Someone out there? Lab B. The doors locked at six when the field spiked again. Four of us in here.'],
        ['kai', 'Iven? It\'s Kai.'],
        ['iven', '...Kai Varen is dead. I helped carry the flowers.'],
        ['iven', 'Whoever you are: there\'s a manual release in Records. Red wheel, south wall. It\'s stiff.'],
      ]);
      ev('Lab B', 'Iven Marr and three technicians are trapped behind a blast door that locked when the containment field spiked at 18:00. A manual release wheel sits in the Records room, on the south wall.', 'OPTIONAL · THE TECHNICIAN\'S KEY');
    } });
    game.interact({ pos: [P.labValve[0], 1.1, P.labValve[2] + 0.7], radius: 1.4, hold: 2.2, prompt: 'Turn the manual release (hold)', enabled: () => S.ivenCalled && !S.labOpen, onUse: async () => {
      S.labOpen = true; audio.sfxPlay('metal'); game.shake = 0.12; setTimeout(() => { game.shake = 0; }, 500);
      tween(1.6, u => { W.wheel.rotation.z = u * Math.PI * 3; });
      W.doors.lab.target = 1; W.labLight.material.emissive.set(0x5fffa0);
      iven.root.visible = true; techs.forEach(t => { t.root.visible = true; });
      ui.toast('LAB B · DOOR RELEASED', 2200);
      await game.wait(1.2);
      walkTo(iven, [-1.0, Y0, -46.0], 2.4);
      ui.subtitle('m8tech', 'Air. Thank God. Iven, it\'s him— it\'s his face.', 3000);
    } });
    game.interact({ pos: [-0.6, 1.0, -46.0], radius: 1.8, prompt: 'Talk to Iven', once: false, enabled: () => S.labOpen && !S.ivenTalked, onUse: async () => {
      S.ivenTalked = true; iven.lookTarget = kai.head; kai.lookTarget = iven.head;
      cine(true);
      await game.shot([1.2, 1.7, -44.6], [-0.9, 1.6, -46.0], 1.0, { fov: 40 });
      await game.talk([
        ['iven', 'It is you. Or it\'s your face. Either way, thanks.'],
        ['iven', 'You want the truth about Tuesday? Rook scheduled the test for 08:00. You — he — tried to stop it at seven.'],
        ['iven', 'When Rook wouldn\'t, he wrote the containment plan himself. Every watt to Chamber One. He knew what that meant.'],
        ['iven', 'Rook signed it afterwards. Says it was his plan. Remember that when he gives the eulogy.'],
      ]);
      const c = await choose('iven', 'What do you need?', ['Get your team out. The service passage is clear.', 'Your override. I need the corridor drones parked.']);
      if (c === 0) {
        await game.talk([['iven', 'Then take the override anyway. You always gave us the way out first. Both of you.']]);
        F.m8ivenChoice = 'team';
      } else {
        await game.talk([['iven', 'Here. They\'ll park for my badge. We\'ll find our own way out — we always do.']]);
        F.m8ivenChoice = 'drones';
      }
      S.override = true; F.m8ivenRescued = true; F.ivenOverride = true;
      if (S.power) { S.dronesOff = true; setDrones(false); ui.detection(0); ui.toast('IVEN\'S OVERRIDE\nCorridor drones parked', 2600); }
      else ui.toast('IVEN\'S OVERRIDE\nThe corridor drones will park for it', 2600);
      ev('Iven\'s testimony', 'Rook scheduled the test for 08:00 on 19.10. This version\'s Kai tried to stop it at 07:00, then wrote the containment plan himself: every watt to Chamber One. Rook signed it afterwards and calls it his own.', 'OPTIONAL · THE TECHNICIAN\'S KEY');
      cine(false); iven.lookTarget = null; kai.lookTarget = null;
      walkTo(iven, [-0.6, Y0, -30], 9).then(() => { iven.root.visible = false; });
      techs.forEach((t, i) => { const from = t.root.position.clone(); let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / (10 + i * 2)); const k = Math.min(1, u * 1.8); t.root.position.set(from.x + (-0.4 - from.x) * k, Y0, from.z + ((-30 + i) - from.z) * u); t.speed = u < 1 ? 1.4 : 0; t.faceTowards(-0.4, -30 + i, dt, 6); if (u >= 1) { off(); t.root.visible = false; } }); });
    } });

    // =====================================================================================================
    // SECURITY OFFICE, MAINTENANCE, ANTECHAMBER
    // =====================================================================================================
    game.interact({ pos: [P.server[0] + 1.1, 1.0, P.server[2] + 0.8], radius: 1.7, prompt: 'Check the log server', once: false, enabled: () => S.yaraDesk && S.memo && (!S.serverDark || (S.consoleTried && !S.serverRead)), onUse: () => { S.serverUse = true; } });
    game.interact({ pos: [P.breakers[0] - 0.9, 1.2, P.breakers[2]], radius: 1.8, prompt: 'Open the breaker panel', once: false, enabled: () => S.serverDark, onUse: async () => {
      if (S.power) { ui.subtitle('kai', 'A and B on the security bus. D still feeds the chamber. Leave it.', 3000); return; }
      cine(true);
      await game.shot([P.breakers[0] - 1.6, 1.8, P.breakers[2] + 1.0], [12.2, 1.6, P.breakers[2]], 0.9, { fov: 40 });
      if (once('breakerIntro')) await game.talk([['kai', '"D · CONTAINMENT. All buses to Chamber One. Set 08:09, 19.10. VAREN, K."'], ['kai', 'He gave the chamber everything. Security, the labs, the log.']]);
      for (;;) {
        const i = await choose('kai', 'Breaker panel · Level 1', ['A · SEC-LOG 1 — reset', 'B · Security bus', 'C · Lab B doors', 'D · Containment — all buses', 'Close the panel']);
        if (i === 4) break;
        if (i === 1) { await game.say('kai', 'B is slaved to A. The log and the security bus come back together, or not at all.'); continue; }
        if (i === 2) { await game.say('kai', 'C\'s tripped. Overload. Lab B will need its manual release.'); continue; }
        if (i === 3) { await game.say('kai', 'No. Whatever that field is holding, it\'s held it for three days. I\'m not dropping it blind.'); continue; }
        S.power = true; break;
      }
      if (S.power) {
        audio.sfxPlay('metal'); W.breakerLeds.forEach((m, k) => m.material.emissive.set(k < 2 ? 0x5fffa0 : k === 3 ? 0x5fe6ff : 0xff4d5e));
        W.screens.server.material.map = TEX.server('bad'); W.screens.server.material.needsUpdate = true;
        for (let i = 0; i < 40; i++) W.serverLeds.setColorAt(i, new THREE.Color(i % 3 ? 0x2aff8a : 0xffb030)); W.serverLeds.instanceColor.needsUpdate = true;
        W.readerAnte.material.emissive.set(0x5fffa0);
        await game.shot([0.8, 2.0, -36.5], [0, 2.4, -46], 1.4, { fov: 50 });
        audio.sfxPlay('drone');
        ui.subtitle('helixai', 'Security bus restored. Corridor patrol units active.', 3200);
        if (!S.override) { setDrones(true); resetDrones(); } else { S.dronesOff = true; }
        await game.wait(1.6);
      }
      cine(false);
    } });
    game.interact({ pos: [P.window[0], 1.3, P.window[2] + 0.6], radius: 1.8, prompt: 'Look through the observation window', enabled: () => S.power && !S.foundYara, onUse: () => { S.windowUse = true; } });
    game.interact({ pos: [P.anteConsole[0], 1.2, P.anteConsole[2] + 0.9], radius: 1.8, prompt: 'Use the containment console', once: false, enabled: () => S.foundYara && !S.released && (!S.consoleTried || S.boardDone), onUse: () => { S.consoleUse = true; } });
    // the six cameras
    const camInteracts = {};
    const CAMSPOT = { C1: [2.4, 1.0, -12.4], C2: [-4.5, 1.0, -19.0], C3: [4.6, 1.0, -36.4], C4: [0.8, 1.0, -46.6], C5: [5.0, 1.0, -53.0], C6: [P.window[0], 1.0, P.window[2] + 0.7] };
    for (const k of Object.keys(SEGS)) {
      const seg = SEGS[k], spot = CAMSPOT[seg.cam];
      camInteracts[k] = game.interact({ pos: spot, radius: 1.7, prompt: `Re-sync camera ${seg.cam}`, once: false, enabled: () => S.serverRead && !S.segs.has(k) && !S.playing, onUse: () => {
        if (!game.residueOn) { ui.toast(ui.words('RESIDUE VISION (F)\nThe lost segment only survives as residue'), 3000); audio.sfxPlay('fail'); return; }
        playSeg(k).catch(err => { if (!err?.abort) console.warn('m8 seg', err); });
      } });
    }
    game.interact({ pos: [P.board[0], 1.2, P.board[2] + 1.0], radius: 1.8, prompt: 'Reconstruct the log on the board', enabled: () => S.segs.size === 6 && !S.boardDone, once: false, onUse: () => { S.boardUse = true; } });

    // ---------- echo playback ----------
    const camOf = (id) => W.cams.find(c => c.id === id);
    const place = (ch, x, z, ry, y = Y0) => { if (!ch) return; ch.root.position.set(x, y, z); ch.root.rotation.y = ry; ch.root.visible = true; ch.speed = 0; ch.pose = null; ch.lookTarget = null; };
    const hideEchoes = () => { for (const c of Object.values(echo)) if (c) { c.root.visible = false; c.speed = 0; c.pose = null; } if (S.guardEcho) S.guardEcho.root.visible = false; };
    const getGuardEcho = () => {
      if (S.guardEcho) return S.guardEcho;
      const id = trustedNow() ? 'haleecho' : 'brandtecho';
      S.guardEcho = mkEcho(id, { ...CAST[trustedNow() ? 'hale' : 'brandt'].look }, 0x5fe6ff);
      return S.guardEcho;
    };
    const SEG_PLAY = {
      a: async () => {
        place(echo.kai, -0.2, 2.5, Math.PI);
        const go = walkTo(echo.kai, [0.0, Y0, -15.6], 6.5);
        await game.talk([['kai17', 'Yara. It\'s early. The counter says ten minutes, not forty.'], ['kai17', 'Lock the antechamber. I\'m coming up.']]);
        await go;
      },
      b: async () => {
        const g = getGuardEcho();
        place(echo.yara, -10.3, -22.6, -Math.PI / 2); place(g, -7.8, -21.0, -Math.PI * 0.75);
        echo.yara.pose = 'work';
        if (trustedNow()) await game.talk([['yaraecho', 'Seal N0 behind us. Nobody follows him in.'], ['haleecho', 'Doctor, that\'s the Director\'s call.'], ['yaraecho', 'The Director isn\'t here. Kai is.'], ['haleecho', '...Done. Go. I\'ll hold the corridor.']]);
        else await game.talk([['yaraecho', 'Seal N0 behind us. Nobody follows him in.'], ['brandtecho', 'Not without the Director\'s code.'], ['yaraecho', 'Then I\'ll badge it myself, Brandt.']]);
        echo.yara.pose = null; await walkTo(echo.yara, [-3.0, Y0, -22.0], 2.6);
      },
      c: async () => {
        place(echo.kai, 11.3, -42.0, Math.PI / 2); place(echo.yara, 9.8, -40.8, Math.PI * 0.7);
        echo.kai.pose = 'work';
        await game.talk([['kai17', 'Everything to containment. Security, the labs, the log. All of it.'], ['yaraecho', 'If the field takes the whole bus, the log goes dark.'], ['kai17', 'Good. Nobody should watch this.']]);
        echo.kai.pose = null; audio.sfxPlay('metal');
      },
      d: async () => {
        place(echo.kai, 0.3, -40.5, Math.PI); place(echo.yara, -0.5, -39.5, Math.PI); place(echo.fig, 0.2, -49.2, 0);
        F.m8figureSeen = true;
        const a = walkTo(echo.kai, [0.3, Y0, -45.4], 3.2), b = walkTo(echo.yara, [-0.5, Y0, -44.6], 3.4); await a; await b;
        await game.talk([['kai17', 'Who\'s there?'], ['figure', 'Ten minutes. It is always ten minutes.']]);
        await tween(1.2, u => { if (echo.fig) echo.fig.root.position.y = Y0 - u * 0.02; }); if (echo.fig) echo.fig.root.visible = false; audio.sfxPlay('rewind');
        await game.talk([['yaraecho', 'Kai? There\'s no one there.']]);
      },
      e: async () => {
        place(echo.kai, 0.8, -56.9, Math.PI); place(echo.yara, -0.9, -56.6, Math.PI * 0.8);
        echo.yara.pose = 'work'; echo.kai.lookTarget = echo.yara.head; echo.yara.lookTarget = echo.kai.head;
        await game.talk([['kai17', 'When I\'m in, seal it. Whatever you hear.'], ['yaraecho', 'And if it holds?'], ['kai17', 'Then nobody remembers there was anything to hold.']]);
        echo.kai.lookTarget = null; echo.yara.lookTarget = null; echo.yara.pose = null;
      },
      f: async () => {
        yara.root.visible = false;
        place(echo.kai, 0.0, -62.0, Math.PI); place(echo.yara, 0.3, -61.2, Math.PI);
        const a = walkTo(echo.kai, [0.0, Y0, -68.4], 4.0);
        await game.wait(1.6);
        const b = walkTo(echo.yara, [-0.6, Y0, -66.6], 3.0);
        await game.talk([['yaraecho', 'Kai! Wait—'], ['kai17', 'Don\'t follow me, Yara.']]);
        await a; echo.kai.pose = 'work';
        await b;
        audio.sfxPlay('boom'); game.shake = 0.25; shiftPulse = 0.7;
        await tween(1.4, u => { W.field.material.opacity = 0.05 + Math.sin(u * Math.PI) * 0.4; if (echo.kai) echo.kai.root.scale.setScalar(1 - u * 0.999); });
        game.shake = 0; if (echo.kai) { echo.kai.root.visible = false; echo.kai.root.scale.setScalar(1); }
        await game.wait(0.6); yara.root.visible = true;
      },
    };
    const playSeg = async (k) => {
      const seg = SEGS[k], c = camOf(seg.cam);
      S.playing = true; cine(true); lockMusic('m8-echo', 0.8); audio.sfxPlay('rewind'); shiftPulse = 0.5;
      game.engine.fx.uTint.value.set(0.82, 1.0, 1.08);
      ui.toast(`${seg.cam} · ${c.name}\nSEGMENT RECOVERED · TIMESTAMP LOST`, 2600);
      if (seg.cam === 'C6') await game.shot([P.window[0] + 0.6, 2.1, -59.6], [0, 1.2, -67.5], 1.2, { fov: 52 });
      else await game.shot(c.pos.map((v, i) => v + (i === 1 ? -0.3 : 0)), [c.at[0], 1.2, c.at[2]], 1.2, { fov: 60 });
      try { await SEG_PLAY[k](); } catch (err) { if (err && err.abort) throw err; console.warn('m8 seg', k, err); }
      hideEchoes();
      game.engine.fx.uTint.value.set(1, 1, 1);
      S.segs.add(k); musicState.segs = S.segs.size; F.m8segments = S.segs.size;
      ev(`Log segment ${seg.cam}: ${seg.title}`, segText(k), 'SEC-LOG 1 · ' + S.segs.size + '/6');
      audio.sfxPlay('success'); ui.toast(`SEGMENT ${S.segs.size}/6 RE-SYNCED`, 1800);
      lockMusic(null); cine(false); S.playing = false;
    };
    const segText = (k) => ({
      a: 'Lobby: Kai Varen runs through the turnstiles on the phone to Yara. "The counter says ten minutes, not forty. Lock the antechamber."',
      b: trustedNow() ? 'Security office: Yara orders the antechamber (N0) sealed behind them. Hale objects that it\'s the Director\'s call, then does it and holds the corridor.' : 'Security office: Yara orders the antechamber (N0) sealed. Brandt refuses without the Director\'s code; Yara badges it herself.',
      c: 'Maintenance: Kai routes every bus to containment. Yara: "the log goes dark." Kai: "Good. Nobody should watch this." That is why SEC-LOG 1 is corrupted.',
      d: 'Corridor north: a long-coated figure waits at the antechamber door. "Ten minutes. It is always ten minutes." Yara sees no one there.',
      e: 'Antechamber: "When I\'m in, seal it. Whatever you hear." / "And if it holds?" / "Then nobody remembers there was anything to hold."',
      f: 'Chamber One, 08:14: Kai walks to the vessel. Yara runs in after him. The field flares: Kai is gone. Yara stops mid-stride and stays there.',
    })[k];

    // =====================================================================================================
    // SCRIPT
    // =====================================================================================================
    ui.missionTag('MISSION 8 · THE FIRST DEATH'); ui.show('hud', true);
    pl.place(...P.start, Math.PI); game.checkpoint(...P.start, Math.PI);
    applyZone('out'); rigLights();
    lockMusic(null); audio.setTheme(null);
    game.control = false; ui.letterbox(true);
    await game.shot([-26, 22, 46], [0, 6, -10], 0.01, { fov: 50 });
    await ui.fade(0, 1600);
    audio.setTheme('m8-altered', 2);
    const cc = ui.chapterCard('ACT I · THE WORLD THAT REMEMBERS', 'The First Death', 'Helix Temporal Research · Rain City · Thursday 21.10.2049 · 22:40', 4400);
    await game.shot([-12, 12, 34], [0, 5, -6], 6.0, { fov: 46 });
    await cc;
    await game.shot([9, 3.2, 16], [2, 2.4, -2], 2.6, { fov: 44 });
    // Kai arrives out of the switch
    audio.sfxPlay('switch'); shiftPulse = 0.9; kai.wristBoost = 8;
    await game.shot([5.6, 1.8, 12.6], [3.2, 1.4, 9.5], 1.2, { fov: 40 });
    await game.talk([
      ['kai', 'Rain. Concrete. Helix.'],
      ['kai', 'Home. Three thousand years and one switch later.'],
    ]);
    await game.shot([4.2, 1.8, 11.8], [P.memorial[0], 1.2, P.memorial[2]], 1.8, { fov: 40 });
    await game.say('kai', 'Candles. Somebody died here.');
    cine(false);
    objective('Look at the memorial by the entrance');
    hint(() => !S.memorialUse, 40, () => ui.subtitle('kai', 'The candles by the doors.', 2400));
    await game.waitFor(() => S.memorialUse);

    // ---------- the memorial ----------
    cine(true); lockMusic(null); audio.setTheme(null, 0.8);
    pl.place(P.memorial[0] - 0.2, Y0, P.memorial[2] + 1.9, Math.PI);
    await game.shot([P.memorial[0] + 1.2, 1.5, P.memorial[2] + 2.6], [P.memorial[0], 1.4, P.memorial[2]], 1.6, { fov: 36 });
    audio.sfxPlay('heartbeat');
    await game.shot([P.memorial[0] + 0.1, 1.6, P.memorial[2] + 1.0], [W.portraitPos[0], W.portraitPos[1], W.portraitPos[2]], 2.4, { fov: 30 });
    await game.talk([
      ['kai', '"Dr. Kai Varen. 2018 to 2049."'],
      ['kai', '"The first life lost to the Zero Second. He held the anchor so the city could keep its second."'],
    ]);
    audio.silence(1.5); await game.wait(1.2);
    await game.shot([P.memorial[0] - 1.6, 1.7, P.memorial[2] + 3.2], [P.memorial[0] - 0.2, 1.5, P.memorial[2] + 1.9], 2.0, { fov: 38 });
    kai.pose = 'sad';
    await game.talk([
      ['kai', 'That\'s my face.'],
      ['kai', 'Whatever I changed back there — the river, the stones, the sky — it came home before I did.'],
    ]);
    kai.pose = null;
    S.memorial = true; F.m8memorial = true; F.kaiDeadInV17 = true; diff('memorial');
    ev('The memorial', 'Outside Helix: candles, flowers, cards and a portrait of Kai. "Dr. Kai Varen, 2018-2049. The first life lost to the Zero Second. He held the anchor so the city could keep its second." In this version of the present, Kai died on Tuesday at 08:14.', 'WHAT CHANGED');
    lockMusic(null, 2);
    cine(false);
    if (once('cardsTip')) ui.toast('Three cards among the flowers', 2400);

    // ---------- the lobby: what changed ----------
    objective('Find out what changed: the staff directory and the founding plaque');
    hint(() => !S.diffs.has('directory') && pl.pos.z > 0, 70, () => ui.subtitle('kai', 'Inside. The lobby will have a directory.', 2600));
    hint(() => pl.pos.z < 0 && diffNeed.some(k => !S.diffs.has(k)), 80, () => ui.subtitle('kai', !S.diffs.has('directory') ? 'The directory kiosk, left of the desk.' : 'The bronze plaque on the west wall.', 2800));
    await game.waitFor(() => diffNeed.every(k => S.diffs.has(k)) && game.control);
    await game.talk([
      ['kai', 'In this version I ran the project, I died at 08:14, and someone called Lind went missing the same second.'],
      ['kai', 'Her office is past the gates.'],
    ]);

    // ---------- getting in ----------
    game.onUpdate(() => { if (!S.inside && pl.pos.z < -16.4 && pl.pos.x > -12.5 && pl.pos.x < 12.4) S.inside = true; });
    objective('Get past the turnstiles');
    hint(() => !S.cardTried && !S.gateOpen, 45, () => ui.subtitle('kai', 'My card still opens the gates. Probably.', 2600));
    await game.waitFor(() => S.cardTried || S.inside);
    const trusted = trustedNow(); F.m8route = trusted ? 'hale' : 'service';
    if (!S.inside) {
      cine(true);
      await game.shot([1.8, 1.7, -11.6], [0, 1.1, -14.2], 0.9, { fov: 40 });
      audio.sfxPlay('fail'); W.gateLights.forEach(m => m.material.emissive.set(0xff2030));
      ui.toast('CARD 0001 · VAREN, K.\nHOLDER DECEASED · CARD VOID', 3200);
      await game.wait(1.6);
      if (trusted) {
        hale.lookTarget = kai.head; kai.lookTarget = hale.head; guard.root.visible = false;
        await walkTo(hale, [1.4, Y0, -12.4], 1.8);
        hale.faceTowards(pl.pos.x, pl.pos.z, 1, 30);
        await game.shot([2.6, 1.75, -10.6], [1.0, 1.6, -12.8], 1.2, { fov: 38 });
        await game.talk([
          ['hale', 'The card says you\'re dead, Doctor.'],
          ['hale', 'I stood at that memorial on Tuesday night. Ten minutes in the rain.'],
          ['kai', 'Hale. I don\'t know what I am right now.'],
          ['hale', 'You\'re the man who told me to trust him at Checkpoint C. I remember that. I shouldn\'t — I was never there. But I do.'],
          ['hale', 'Whatever you are, you came back for her. Dr. Lind. Nobody\'s looked since Rook said "leave".'],
          ['hale', 'Go. I\'ll keep channel two quiet.'],
        ]);
        audio.sfxPlay('door'); S.gateOpen = true; W.gateLights.forEach(m => m.material.emissive.set(0x5fffa0));
        F.m8haleHelped = true; hale.lookTarget = null; kai.lookTarget = null;
        ev('Officer Hale', 'Night shift in this version. He remembers Kai telling him to trust him at Checkpoint C — something that happened only in Kai\'s version. He let Kai through and keeps channel two quiet.', 'HELIX · LOBBY');
        cine(false);
      } else {
        hale.root.visible = false;
        guard.lookTarget = kai.head;
        await game.shot([1.6, 1.7, -10.2], [-0.2, 1.6, -8.6], 1.0, { fov: 40 });
        await game.talk([
          ['m8guard', 'Sir. The building is closed.'],
          ['m8guard', '...That card belongs to a dead man. Step back from the gate before I call it in.'],
          ['kai', 'Of course it does.'],
        ]);
        guard.lookTarget = null; cine(false);
        await game.say('kai', 'Deliveries come in round the side. The loading yard.');
        objective('Find another way in: the loading yard, east of the forecourt');
        hint(() => !S.serviceOpen && pl.pos.x < 14, 70, () => ui.subtitle('kai', 'The loading yard. East, past the truck.', 2600));
        hint(() => !S.serviceOpen && near(16.6, -8.6, 5) && !S.codeSeen, 25, () => ui.subtitle('kai', ui.words('A keypad. Residue Vision (F) — somebody\'s hand used it last.'), 3200));
        await game.waitFor(() => S.serviceOpen || S.inside);
        objective('Through the service passage into maintenance');
      }
    }
    await game.waitFor(() => S.inside);
    S.gateOpen = true; // from inside the gates open for you
    if (!trusted) { hale.root.visible = false; }
    game.checkpoint(0, Y0, -18.0, Math.PI);

    // ---------- the offices ----------
    objective('Search the offices: Dr. Lind\'s, and the one with your name on the door');
    hint(() => !S.yaraDeskUse, 80, () => ui.subtitle('kai', 'DR. Y. LIND — the first door on the right of the corridor.', 2800));
    hint(() => S.yaraDesk && !S.memoUse, 70, () => ui.subtitle('kai', 'My office. Next door to hers. Black ribbon on the plate.', 2800));
    await game.waitFor(() => S.yaraDeskUse || S.memoUse);
    for (let pass = 0; pass < 2; pass++) {
      if (S.yaraDeskUse && !S.yaraDesk) {
        cine(true);
        await game.shot([P.yaraDesk[0] - 1.6, 1.8, P.yaraDesk[2] + 1.0], [P.yaraDesk[0] + 0.28, 1.2, P.yaraDesk[2]], 1.0, { fov: 38 });
        await game.talk([
          ['kai', '"Badge 4471. Lind, Y." Her last reads.'],
          ['kai', '08:02 here. 08:06 the security office. 08:09 maintenance. 08:12 the containment antechamber.'],
          ['kai', 'Then nothing. She walked into the second with him and didn\'t walk out.'],
        ]);
        cine(false); S.yaraDesk = true; F.m8badgeTrail = true;
        ev('Badge 4471 · Lind, Y.', 'Her last badge reads on 19.10: 08:02 office E1 · 08:06 security office · 08:09 maintenance · 08:12 containment antechamber · 08:14 — no further reads.', 'DR. LIND\'S OFFICE');
      }
      if (S.memoUse && !S.memo) {
        cine(true); lockMusic(null); audio.setTheme('m8-version', 1.2);
        await game.shot([P.kaiDesk[0] - 1.8, 1.7, P.kaiDesk[2] + 1.2], [P.kaiDesk[0] + 0.3, 1.0, P.kaiDesk[2]], 1.2, { fov: 36 });
        audio.sfxPlay('rewind');
        await game.talk([
          ['kaimemo', 'Yara. It\'s Monday, late. If the counter\'s right, it comes tomorrow at 08:14.'],
          ['kaimemo', 'If the field holds, the second holds. And nobody remembers there was anything to hold.'],
          ['kaimemo', 'If I\'m wrong, tell Rook it was my plan. He\'ll want it to be his anyway.'],
          ['kaimemo', 'And Yara — don\'t follow me in.'],
        ]);
        await game.shot([P.kaiDesk[0] - 0.4, 1.7, P.kaiDesk[2] + 1.6], [P.kaiDesk[0] - 0.9, 1.5, P.kaiDesk[2]], 1.4, { fov: 40 });
        await game.say('kai', 'My voice. Saying goodbye to someone I\'ve never met.');
        cine(false); lockMusic(null, 2); S.memo = true; F.m8memo = true; diff('office');
        ev('Voice memo · Dr. K. Varen', 'Recorded Monday 18.10.2049, 23:41: "If the field holds, the second holds, and nobody remembers there was anything to hold. If I\'m wrong, tell Rook it was my plan. And Yara: don\'t follow me in."', 'YOUR OFFICE');
      }
      if (S.yaraDesk && S.memo) break;
      objective(S.yaraDesk ? 'Search the office with your name on the door' : 'Search Dr. Lind\'s office');
      await game.waitFor(() => (S.yaraDeskUse && !S.yaraDesk) || (S.memoUse && !S.memo));
    }

    // ---------- the badge trail: security office ----------
    objective('Follow her badge trail: the security office (08:06)');
    hint(() => !S.serverUse, 70, () => ui.subtitle('kai', 'Security office. Across the corridor, first door on the left.', 2800));
    await game.waitFor(() => S.serverUse);
    cine(true);
    await game.shot([P.server[0] + 2.2, 1.8, P.server[2] + 1.8], [P.server[0] + 0.6, 1.3, P.server[2]], 1.0, { fov: 40 });
    await game.talk([
      ['kai', '"SEC-LOG 1. No power." The log of Tuesday morning, and it\'s dark.'],
      ['kai', 'Her next read was maintenance. 08:09. Somebody moved the power.'],
    ]);
    cine(false); S.serverDark = true;

    // ---------- maintenance: the power ----------
    objective('Maintenance (08:09): find where the power went');
    hint(() => !S.power, 80, () => ui.subtitle('kai', 'Maintenance is the third door on the right. Breaker panel on the far wall.', 3000));
    await game.waitFor(() => S.power && game.control);
    game.checkpoint(4.0, Y0, -39.0, Math.PI / 2, resetDrones);
    if (!S.dronesOff) {
      if (trusted) ui.subtitle('radio', 'HALE: Kai, two drones on the research corridor. They pause at each end. Move when they turn.', 4400);
      else ui.subtitle('radio', 'BRANDT: All units, an intruder wearing Dr. Varen\'s face. Detain on sight.', 4200);
      ui.toast(ui.words('STEALTH\nStay out of the drones\' red cones · crouch (C) to shrink them'), 3600);
    }

    // ---------- antechamber: find the missing researcher ----------
    objective('Follow her badge trail: the containment antechamber (08:12)');
    hint(() => !S.windowUse && pl.pos.z < -50.5, 40, () => ui.subtitle('kai', 'The observation window. Left of the blast door.', 2600));
    hint(() => !S.windowUse && pl.pos.z > -50.5, 90, () => ui.subtitle('kai', 'The antechamber is at the north end of the corridor.', 2600));
    await game.waitFor(() => S.windowUse);
    cine(true); lockMusic(null); audio.setTheme(null, 0.6);
    pl.place(P.window[0], Y0, P.window[2] + 0.9, Math.PI);
    await game.shot([P.window[0] + 0.9, 1.75, P.window[2] + 1.8], [P.window[0], 1.5, P.window[2] - 1], 1.2, { fov: 40 });
    await game.shot([P.window[0] + 0.2, 1.7, -59.75], [yara.root.position.x, 1.4, yara.root.position.z], 2.6, { fov: 30 });
    audio.sfxPlay('heartbeat');
    await game.shot([-1.6, 1.5, -64.4], [yara.root.position.x, 1.45, yara.root.position.z - 0.2], 3.0, { fov: 34, dof: true });
    await game.talk([
      ['kai', 'There\'s someone in there.'],
      ['kai', 'Mid-step. Hair still lifting. Like a photograph of a person.'],
      ['kai', 'Yara Lind. Three days inside one second.'],
    ]);
    S.foundYara = true; F.m8foundYara = true;
    ev('Dr. Yara Lind, found', 'Through the antechamber window: Dr. Lind inside Chamber One, stopped mid-stride inside the containment field. The console reads "FIELD HELD SINCE 08:14:00 · OCCUPANT: 1 · UNRESOLVED".', 'CONTAINMENT · CHAMBER ONE');
    await game.shot([P.window[0] + 1.2, 1.7, P.window[2] + 2.0], [0, 1.2, -57.8], 1.4, { fov: 46 });
    cine(false); lockMusic(null, 1.5);
    game.checkpoint(0, Y0, -52.5, Math.PI, resetDrones);
    objective('Use the containment console');
    await game.waitFor(() => S.consoleUse);
    cine(true);
    await game.shot([1.4, 1.8, -55.6], [0, 1.3, -57.4], 1.0, { fov: 40 });
    ui.subtitle('helixai', 'Release denied. A verified record of 08:04 to 08:14 is required. SEC-LOG 1: corrupted.', 4200);
    await game.wait(3.6);
    await game.talk([
      ['kai', 'It won\'t let her go without a record of how she got in.'],
      ['kai', 'The log. Back to the security office — it has power now.'],
    ]);
    cine(false); S.consoleUse = false; S.consoleTried = true;

    // ---------- recover the corrupted security log ----------
    objective('Recover the corrupted security log (security office)');
    S.serverUse = false;
    await game.waitFor(() => S.serverUse);
    cine(true);
    await game.shot([P.server[0] + 2.0, 1.7, P.server[2] + 1.6], [P.server[0] + 1.1, 1.35, P.server[2] + 0.2], 1.0, { fov: 36 });
    await game.talk([
      ['kai', '"08:04 to 08:14. Corrupted. Six segments, timestamps lost. Re-sync at source cameras."'],
      ['kai', 'The field took the bus at 08:09 and the log fell apart. But the cameras saw it happen.'],
      ['kai', 'And what a place sees, it keeps. Residue.'],
    ]);
    cine(false); S.serverRead = true; F.m8logFound = true;
    ui.toast(ui.words('RE-SYNC THE SIX CAMERAS\nStand under each one in Residue Vision (F)'), 3600);
    const camsLeft = () => Object.keys(SEGS).filter(k => !S.segs.has(k)).map(k => SEGS[k].cam);
    const segObj = () => `Re-sync the six cameras in Residue Vision (${S.segs.size}/6) · left: ${camsLeft().join(' ')}`;
    hint(() => S.segs.size < 6 && !game.residueOn, 50, () => ui.subtitle('kai', ui.words('Residue Vision (F). The cameras I still need will show.'), 3000));
    hint(() => S.segs.size < 6, 110, () => {
      const left = camsLeft()[0]; const where = { C1: 'the lobby, over the turnstiles', C2: 'right here, over the security office door', C3: 'maintenance, by the door', C4: 'the north end of the corridor', C5: 'the antechamber, east corner', C6: 'the antechamber — it looks through the window' }[left];
      ui.subtitle('kai', `${left}: ${where}.`, 3000);
    });
    while (S.segs.size < 6) { objective(segObj()); const n = S.segs.size; await game.waitFor(() => S.segs.size > n); }

    // ---------- reconstruct the final ten minutes ----------
    objective('Reconstruct the final ten minutes on the board (security office)');
    for (;;) {
      S.boardUse = false;
      await game.waitFor(() => S.boardUse);
      cine(true);
      await game.shot([P.board[0] + 0.4, 1.8, P.board[2] + 2.4], [P.board[0], 1.9, P.board[2]], 1.0, { fov: 44 });
      if (once('boardIntro')) await game.say('kai', 'Six segments. No timestamps. Her badge times, and what they say. In order.');
      let quit = false;
      while (S.board.length < 6) {
        const left = BOARD_ORDER.filter(k => !S.board.includes(k));
        const i = await choose('kai', `Segment ${S.board.length + 1} of 6 — what comes next?`, [...left.map(k => SEGS[k].title), 'Step back']);
        if (i === left.length) { quit = true; break; }
        const k = left[i], want = Object.keys(SEGS).find(x => SEGS[x].order === S.board.length);
        if (k === want) {
          S.board.push(k); audio.sfxPlay('pickup');
          setCard(S.board.length - 1, k);
        } else {
          audio.sfxPlay('fail'); S.boardMiss = (S.boardMiss || 0) + 1;
          await game.say('kai', `Not yet. That one's later — ${SEGS[k].why}`);
        }
      }
      if (!quit) break;
      cine(false);
    }
    S.boardDone = true; F.m8logRestored = true; F.m8reconstructed = true;
    W.screens.server.material.map = TEX.server('ok'); W.screens.server.material.needsUpdate = true;
    lockMusic('m8-echo', 1);
    await game.talk([
      ['kai', '08:04, he runs in. 08:06, she has the antechamber sealed. 08:09, every watt to the chamber, and the log goes dark.'],
      ['kai', '08:10, someone at the door who isn\'t there. 08:12, "seal it behind me". 08:14—'],
      ['kai', 'He went in to hold the second. She went in after him. The field kept her, and it didn\'t keep him.'],
    ]);
    ui.subtitle('helixai', 'SEC-LOG 1 verified. Containment release available at the antechamber console.', 3800);
    ev('The final ten minutes', 'Reconstructed SEC-LOG 1, 19.10.2049: 08:04 Kai runs in. 08:06 Yara has antechamber N0 sealed. 08:09 every bus routed to containment; the log goes dark. 08:10 a long-coated figure at the door. 08:12 "Seal it behind me." 08:14 Kai holds the field and is gone; Yara follows him in and is held mid-stride.', 'SEC-LOG 1 · RESTORED');
    await game.wait(1.2);
    cine(false); lockMusic(null, 1.5);
    if (drones.some(d => !d.disabled) && !S.dronesOff) { S.dronesOff = true; setDrones(false); ui.detection(0); ui.subtitle('helixai', 'Patrol units recalled to Level 2.', 2800); }

    // ---------- into Chamber One ----------
    objective('Release the containment field (antechamber console)');
    S.consoleUse = false;
    await game.waitFor(() => S.consoleUse);
    cine(true);
    await game.shot([1.4, 1.8, -55.6], [0, 1.3, -57.4], 1.0, { fov: 40 });
    await game.talk([
      ['helixai', 'Record verified. Project lead authorisation required.'],
      ['kai', 'Card 0001. Containment doesn\'t read the personnel file. It reads the card.'],
    ]);
    audio.sfxPlay('door'); W.screens.ante.material.map = TEX.ante('idle');
    S.released = true; S.anteHeld = true;
    W.doors.chamber.target = 1;
    await game.shot([2.4, 2.2, -54.4], [0, 1.6, -61], 2.4, { fov: 48 });
    cine(false);
    objective('Go to Yara');
    let reach = null;
    reach = game.interact({ pos: [yara.root.position.x, 1.2, yara.root.position.z + 0.8], radius: 1.8, prompt: 'Reach for Yara', onUse: () => { S.reachUse = true; } });
    void reach;
    await game.waitFor(() => S.reachUse);

    // ---------- "Don't save me." ----------
    S.inChamber = true;
    cine(true); lockMusic(null); audio.setTheme(null, 0.6); audio.silence(1.2);
    pl.place(yara.root.position.x + 0.2, Y0, yara.root.position.z + 1.3, Math.PI);
    kai.pose = 'reach';
    await game.shot([yara.root.position.x + 1.6, 1.6, yara.root.position.z + 0.6], [yara.root.position.x - 0.1, 1.5, yara.root.position.z + 0.6], 1.6, { fov: 34 });
    shiftPulse = 0.6; audio.sfxPlay('rewind');
    yara.frozen = false; yara.speed = 0; yara.pose = 'look'; yara.lookTarget = kai.head; kai.lookTarget = yara.head; kai.pose = null;
    await game.shot([yara.root.position.x + 0.9, 1.62, yara.root.position.z + 2.4], [yara.root.position.x, 1.55, yara.root.position.z], 1.6, { fov: 32, dof: true });
    lockMusic('m8-version', 1.2);
    await game.talk([
      ['yara', 'Kai? ...No. You\'re not him. You\'re wearing his face.'],
      ['kai', 'Dr. Lind. Yara. I can get you out. Take my hand.'],
    ]);
    await game.shot([yara.root.position.x - 0.7, 1.6, yara.root.position.z - 0.9], [pl.pos.x, 1.6, pl.pos.z], 1.4, { fov: 34, dof: true });
    await game.talk([['yara', 'Don\'t save me.']]);
    await game.shot([pl.pos.x + 0.8, 1.7, pl.pos.z + 0.9], [yara.root.position.x, 1.55, yara.root.position.z], 1.2, { fov: 32, dof: true });
    await game.talk([['kai', 'Why?']]);
    await game.shot([yara.root.position.x + 0.5, 1.58, yara.root.position.z + 1.1], [yara.root.position.x, 1.56, yara.root.position.z], 1.6, { fov: 28, dof: true });
    audio.sfxPlay('motif');
    await game.talk([['yara', 'Because I am not the one who died.']]);
    F.m8dontSaveMe = true;
    await game.talk([
      ['yara', 'He went in to hold the second. I came after him. One step. The field kept me. It didn\'t keep him.'],
      ['yara', 'For me it\'s still 08:14. He\'s still gone half a second ago.'],
      ['yara', 'If you pull me out of here, you\'ll do what he did. Trade yourself for somebody. That\'s how this keeps happening.'],
    ]);
    // the facility rejects a dead man inside its chamber
    audio.sfxPlay('alarm'); emergency = 1; lightT = 0;
    W.doors.chamber.target = 0; S.anteHeld = false;
    W.screens.ante.material.map = TEX.ante('sealed'); W.screens.ante.material.needsUpdate = true;
    await game.shot([0, 3.2, -62.6], [0, 1.4, -70], 1.4, { fov: 58 });
    await game.talk([
      ['helixai', 'Unregistered occupant in Chamber One. Identity: VAREN, K. Status: deceased.'],
      ['helixai', 'Anomaly protocol. Containment engaged. Field collapse in two minutes.'],
      ['yara', 'The clamps — three of them, in the walls. Release them and the field opens instead of closing. Go!'],
    ]);
    yara.lookTarget = null; kai.lookTarget = null;
    W.beams.forEach(b => { b.visible = true; });
    cine(false);

    // ---------- escape the temporal containment chamber ----------
    lockMusic('m8-containment', 0.6); musicState.escape = 0;
    const COLLAPSE = 120;
    S.collapse = COLLAPSE; S.hits = 0; S.escaping = true;
    const beamA = [0, Math.PI];
    const resetEscape = () => { S.collapse = COLLAPSE; S.hits = 0; beamA[0] = 0; beamA[1] = Math.PI; };
    game.checkpoint(0, Y0, -62.4, Math.PI, resetEscape);
    const clampDone = new Set();
    let hitCD = 0, failing = false;
    game.onUpdate((dt) => {
      if (!S.escaping) return;
      const speedUp = 1 + clampDone.size * 0.28;
      beamA[0] += dt * 0.55 * speedUp; beamA[1] -= dt * 0.42 * speedUp;
      W.beams.forEach((b, i) => { b.rotation.y = beamA[i]; b.material.opacity = 0.32 + Math.sin(game.time * 9 + i) * 0.06; });
      W.field.material.opacity = 0.05 + (1 - S.collapse / COLLAPSE) * 0.18; W.field.scale.setScalar(0.55 + 0.45 * (S.collapse / COLLAPSE));
      if (!game.control) return;
      S.collapse -= dt; hitCD -= dt;
      const secs = Math.max(0, Math.ceil(S.collapse));
      if (secs !== S.lastSecs || clampDone.size !== S.lastClamps) { S.lastSecs = secs; S.lastClamps = clampDone.size; ui.objective(`Release the three clamps (${clampDone.size}/3) · field collapse ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`); }
      if (S.collapse <= 0 && !failing) { failing = true; game.fail('THE FIELD COLLAPSED').then(() => { failing = false; }); return; }
      // beam hit test (beam k lies along the local +x axis of its plane, rotated by beamA[k] about y)
      const vx = pl.pos.x - CH.x, vz = pl.pos.z - CH.z, r = Math.hypot(vx, vz);
      if (r < 1.25 || r > CH.r - 0.1 || hitCD > 0) return;
      for (const a of beamA) {
        const dx = Math.cos(a), dz = -Math.sin(a);
        const along = vx * dx + vz * dz, perp = Math.abs(vx * dz - vz * dx);
        if (along > 0 && perp < 0.42) {
          hitCD = 1.4; S.hits++; shiftPulse = 0.7; audio.sfxPlay('spark'); game.touch.buzz([40, 30, 60]);
          // push Kai off the beam to the side it has already swept (beam 0 turns one way, beam 1 the other)
          const k = beamA.indexOf(a), back = k === 0 ? 1 : -1, tx = -dz * back, tz = dx * back;
          pl.place(pl.pos.x + tx * 0.9, pl.pos.y, pl.pos.z + tz * 0.9, pl.yaw);
          if (S.hits >= 3 && !failing) { failing = true; game.fail('CAUGHT IN THE FIELD SWEEP').then(() => { failing = false; }); }
          else ui.toast(`FIELD SWEEP · ${3 - S.hits} more and the field takes you`, 1600);
          break;
        }
      }
    });
    CLAMPS.forEach((deg) => {
      const [x, z] = polarC(deg, CH.r + 0.3);
      game.interact({ pos: [x, 1.1, z], radius: 1.7, hold: 1.0, prompt: `Release the ${deg === 0 ? 'north' : deg === 90 ? 'east' : 'west'} clamp (hold)`, enabled: () => S.escaping && !clampDone.has(deg), once: false, onUse: () => {
        clampDone.add(deg); S.clamps = clampDone.size; musicState.escape = clampDone.size;
        const cm = W.clampMeshes.find(c => c.deg === deg);
        if (cm) { cm.core.material = cm.core.material.clone(); cm.core.material.emissiveIntensity = 0.2; tween(0.8, u => { cm.group.position.set(...polarC(deg, CH.r + 1.0 + u * 0.7)).setY(Y0); }); }
        audio.sfxPlay('metal'); game.shake = 0.18; setTimeout(() => { game.shake = 0; }, 400);
        ui.toast(`CLAMP ${clampDone.size}/3 RELEASED`, 1600);
        if (clampDone.size === 1) ui.subtitle('yara', 'One! The field\'s fighting you — it sweeps faster.', 2800);
        if (clampDone.size === 2) ui.subtitle('yara', 'Two. Stay in the alcoves till the light passes.', 2800);
        S.collapse = Math.max(S.collapse, 45);
      } });
    });
    hint(() => S.escaping && clampDone.size < 3, 30, () => ui.subtitle('yara', 'The alcoves are safe — the sweep can\'t reach into them. Move between passes.', 3200));
    await game.waitFor(() => clampDone.size >= 3 && game.control);
    S.escaping = false; W.beams.forEach(b => { b.visible = false; });
    emergency = 0; lightT = 0;

    // ---------- the field opens; a choice ----------
    cine(true);
    audio.sfxPlay('success'); lockMusic('m8-version', 1.6);
    await tween(1.8, u => { W.field.scale.setScalar(0.55 + u * 0.6); W.field.material.opacity = 0.23 * (1 - u) + 0.03; });
    W.doors.chamber.target = 1; S.anteHeld = true;
    W.screens.ante.material.map = TEX.ante('open'); W.screens.ante.material.needsUpdate = true;
    pl.place(yara.root.position.x + 0.3, Y0, yara.root.position.z + 1.4, Math.PI);
    yara.lookTarget = kai.head; kai.lookTarget = yara.head;
    await game.shot([yara.root.position.x + 1.4, 1.65, yara.root.position.z + 2.6], [yara.root.position.x, 1.5, yara.root.position.z + 0.6], 1.6, { fov: 36 });
    await game.talk([
      ['helixai', 'Field released. Occupant resolution pending.'],
      ['yara', 'It\'s opening. When it does, the second ends for me too. Whatever I am on the other side of it.'],
    ]);
    const pick = await choose('yara', 'Kai. Don\'t.', ['Take her hand', 'Do as she asks. Let the second end where she is']);
    if (pick === 0) {
      F.m8yara = 'saved';
      kai.pose = 'reach';
      await game.shot([yara.root.position.x - 1.2, 1.5, yara.root.position.z + 1.8], [yara.root.position.x + 0.1, 1.3, yara.root.position.z + 0.8], 1.4, { fov: 34 });
      shiftPulse = 0.8; audio.sfxPlay('rewind');
      await walkTo(yara, [yara.root.position.x + 0.3, Y0, yara.root.position.z + 0.9], 1.2);
      kai.pose = null; yara.pose = 'sad';
      await game.talk([
        ['yara', 'You did it anyway.'],
        ['kai', 'I know.'],
        ['yara', 'He always did, too. Every time.'],
      ]);
      ev('Yara Lind, saved', 'Kai took her hand as the field opened, against what she asked. She stepped out of 08:14 into Thursday night. "He always did, too. Every time."', 'CHAMBER ONE');
    } else {
      F.m8yara = 'held';
      yara.pose = 'nod';
      await game.talk([
        ['yara', 'Thank you.'],
        ['kai', 'I\'ll come back for you.'],
        ['yara', 'That\'s what he said.'],
      ]);
      yara.setGhost?.(0xffd8a0); await tween(2.4, u => { yara.root.scale.setScalar(1 - u * 0.02); });
      yara.frozen = true;
      ev('Yara Lind, held', 'Kai did as she asked. The field opened and the second ended where she stood: she remains in Chamber One, a figure held in amber light, neither saved nor lost. "That\'s what he said."', 'CHAMBER ONE');
    }
    yara.lookTarget = null; kai.lookTarget = null;

    // ---------- VERSION 17 ----------
    S.ended = true; S.inChamber = false;
    pl.place(0, Y0, -55.4, 0);
    if (F.m8yara === 'saved') { yara.frozen = false; yara.pose = null; yara.root.position.set(-1.2, Y0, -56.2); yara.root.rotation.y = 0; }
    await game.shot([0.6, 1.6, -58.8], [0, 2.6, -50.4], 1.6, { fov: 50 });
    audio.sfxPlay('anomaly');
    await tween(2.4, u => { W.screens.version.material.opacity = u; });
    await game.shot([0.3, 1.9, -54.0], [0, 3.2, -50.3], 2.4, { fov: 40 });
    await game.talk([
      ['helixai', 'Timeline audit complete.'],
      ['helixai', 'Current timeline: VERSION 17.'],
      ['helixai', 'No surviving record of the previous sixteen.'],
    ]);
    F.timelineVersion = 17; F.m8version = 17;
    T.defs[0].year = 'HELIX · VERSION 17'; T.refreshHud();
    audio.silence(1.4); await game.wait(1.2);
    await game.shot([1.4, 1.75, -52.6], [0, 1.65, -55.4], 1.6, { fov: 36 });
    await game.talk([
      ['kai', '"You are the seventeenth." Niko wasn\'t counting my visits.'],
      ['kai', 'Sixteen of me before this one. And not a single page left to say how it went.'],
    ]);
    if (trusted) {
      const h = hale; h.root.visible = true; h.root.position.set(0.4, Y0, -48.5); h.root.rotation.y = Math.PI; S.anteHeld = true;
      walkTo(h, [0.6, Y0, -52.2], 2.6);
      await game.shot([-1.8, 1.7, -55.8], [0.4, 1.6, -52.6], 2.0, { fov: 42 });
      h.lookTarget = kai.head;
      await game.talk([
        ['hale', 'Kai. Rook\'s people are on the lift, and Brandt\'s with them.'],
        ['hale', 'I buried you on Tuesday. I\'m not doing it twice. Service passage. Now.'],
      ]);
    } else {
      await game.talk([
        ['radio', 'BRANDT: Containment breach, Chamber One. All units to Level 1. The impostor does not leave this building.'],
        ['kai', 'The service passage. Same way I came in.'],
      ]);
    }
    if (F.m8yara === 'saved') await game.talk([['yara', 'Kai — the other one. He said if you ever came, you\'d ask the wrong question first. Ask the right one.']]);
    else await game.talk([['kai', 'Yara. Held in a second nobody else remembers. Like every version before this one.']]);
    ev('VERSION 17', 'The Helix timeline audit: "Current timeline: VERSION 17. Previous versions: 16. Surviving records: none." Niko\'s "You are the seventeenth" was a count of versions, not visits.', 'HELIX · TIMELINE AUDIT');
    audio.sfxPlay('motif');
    await game.shot([0, 4.0, -58.5], [0, 2.8, -50.3], 3.4, { fov: 54 });
    await ui.fade(1, 2400);
    const mins = Math.round((game.time - tStart) / 60);
    await ui.chapterCard('MISSION 8 COMPLETE', 'The First Death', `Current timeline: VERSION 17 · Log 6/6 · Shards ${S.shards}/5${mins ? ' · ' + mins + ' min' : ''}`, 3600);
    F.m8done = true; F.m8shards = S.shards;
    hideEchoes(); setDrones(false); ui.detection(0);
    game.releaseCam(); ui.letterbox(false); audio.allBeds?.(0); audio.setTheme(null);
  },
};

// a board card for a placed segment (drawn once per segment)
function setCard(slot, k) {
  const seg = SEGS[k], W = window.__m8?.W; if (!W) return;
  const m = W.boardCards[slot]; if (!m) return;
  m.material.map = canvasTex(256, 180, (g, w, h) => {
    g.fillStyle = '#0c1a22'; g.fillRect(0, 0, w, h); g.strokeStyle = '#5fe6ff'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#5fe6ff'; g.font = `700 40px ${FONT}`; g.fillText(seg.time, 16, 56);
    g.fillStyle = '#d8e6f0'; g.font = `600 18px ${FONT}`; const words = seg.title.split(' '); let line = '', y = 96;
    for (const wd of words) { if (g.measureText(line + wd).width > 220) { g.fillText(line, 16, y); y += 24; line = ''; } line += wd + ' '; }
    g.fillText(line, 16, y); g.fillStyle = '#7fffb0'; g.font = `600 14px ${FONT}`; g.fillText(seg.cam + ' · RE-SYNCED', 16, h - 16);
  }, 'm8card' + k);
  m.material.color.set(0xffffff); m.material.needsUpdate = true;
}
