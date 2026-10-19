// MISSION 5 · THE VILLAGE THAT NEVER EXISTED (Act I). Bible target: 55 minutes.
// One valley in three authored states: THRIVING (c. 1000 BCE), ABANDONED (c. 400 CE), FLOODED (2049, a Helix reservoir).
// Persistent cross-era consequences: divert the river in the earliest state (the levee it needs becomes the 2049
// causeway), reinforce the terrace wall in the middle state (the 2049 landslide never happens), release the pressure
// gate in the latest state (the drowned village comes up for air), and open the Keepers' Door to the buried machine.
// Optional: Tala & Niko's water quest (NPC chain B), six temporal shards, residue echoes, the caretaker of Reservoir 7.
import * as THREE from 'three';
import * as RZ from '../world/realism.js';
import { glowMat, canvasTex, rng, Motes, cableCurve } from '../world/kit.js';
import { Walker } from '../world/props.js';
import { Character } from '../core/character.js';
import { settlerLook, registerCast, CAST } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';
import * as V from '../world/env_m5.js';

const { sm, lerp, WALL, DOOR, TERRACE_Y: TY } = V;

// ---------- cast added by this mission ----------
registerCast('caretaker', {
  name: 'INGRID HOLT', role: 'Caretaker · Reservoir 7 · 2049',
  bio: 'Has kept the dam at Reservoir 7 since it was filled. Grows beans on the old terrace. Asks few questions.',
  // 2049 field wear: graphite-olive softshell parka over a technical knit, cargo trousers, work boots; AR earpiece,
  // a ruggedised slate and an AR earpiece are attached in the mission (see dressCaretaker).
  look: { era: '2049', costume: 'caretaker', sex: 'f', template: 'arin', female: true, age: 57, height: 1.66, build: 1.02, skin: 0xcf9f82, hair: 0x6a625a, hairStyle: 'short', eyes: 0x4a5a5a,
    top: 0x3b4441, topKind: 'synthetic', topType: 'jacket', coat: 0x3d4842, coatKind: 'fabric', coatType: 'long', pants: 0x272b30, pantsType: 'cargo', shoes: 'boots', boots: 0x1b1d20,
    glasses: true, wrinkles: 0.55, face: { jaw: 0.1, cheek: 0.2, nose: 0.1, noseWidth: 0, lips: -0.1, brow: 0.1, eyeSize: -0.05, faceLength: 0.15, chin: 0.05 } },
  rimColor: 0x8fd8ff,
  vp: { sex: 'f', pitch: 0.86, rate: 0.92, langs: ['en-GB', 'en-IE', 'en-US'] },
});
registerCast('echo', { name: 'ECHO', role: 'Temporal residue', voice: true, vp: { sex: 'f', pitch: 0.8, rate: 0.86, langs: ['en-GB', 'en-US'] } });
registerCast('echo2049', { name: 'ECHO · 2029', role: 'Temporal residue · Helix survey', voice: true, vp: { sex: 'f', pitch: 1.0, rate: 1.0, langs: ['en-US', 'en-GB'] } });
// the 2029 Helix survey lead, seen only as residue (Helix 2049 lab jacket over a navy mock-neck, headset, wrist slate)
registerCast('surveyor', { name: 'SURVEY LEAD · 2029', role: 'Helix survey · Site Zero',
  look: { era: '2049', costume: 'helix_sci_f', sex: 'f', female: true, age: 44, height: 1.63, build: 0.92, skin: 0xf1c6a8, hair: 0x15130f, hairStyle: 'bob', eyes: 0x2a1c12,
    top: 0x1d2430, topKind: 'synthetic', topType: 'jacket', coat: 0xe8eaec, coatKind: 'fabric', pants: 0x4a4e54, pantsType: 'trousers', shoes: 'shoes', boots: 0xe6e2da },
  vp: { sex: 'f', pitch: 1.0, rate: 1.02, langs: ['en-US', 'en-GB'] } });
registerCast('villager', { name: 'VILLAGER', role: 'The lower village',
  look: { era: 'ancient', costume: 'villager', sex: 'm', female: false, age: 52, height: 1.7, build: 0.92, skin: 0x6b4029, hair: 0x3a3430, hairStyle: 'curly', stubble: 0.6,
    top: 0xd9c9a0, topKind: 'fabric', topType: 'tunic', sash: 0x2f5a5a, pants: 0xb89a6a, pantsType: 'wraps', shoes: 'sandals', boots: 0x4a3220 },
  vp: { sex: 'm', pitch: 0.95, rate: 0.98, langs: ['en-IN', 'en-ZA', 'en-GB'] } });
// ancient settlement wear: undyed linen tunic, red-ochre wrap, leg wraps and sandals
registerCast('potter', { name: 'IRU', role: 'Potter · the upper terrace',
  look: { era: 'ancient', costume: 'potter', sex: 'f', template: 'mirela', female: true, age: 46, height: 1.6, build: 1.0, skin: 0x7d4f33, hair: 0x15100b, hairStyle: 'bun', eyes: 0x24160c, top: 0xb4884e, topKind: 'fabric', topType: 'tunic', sash: 0x9b3b24, pants: 0x5a4632, pantsType: 'wraps', shoes: 'sandals', boots: 0x4a3220, bracelets: 0xc9a050, wrinkles: 0.35 },
  rimColor: 0xffb05a, glow: 0x3a2410, bg: 0x140d08, vp: { sex: 'f', pitch: 1.05, rate: 1.0, langs: ['en-IN', 'en-ZA', 'en-GB'] } });
// every unnamed villager wears the era's clothes (keeps the 3D cast on its settler templates)
// each one names an anc_* archetype from docs/COSTUMES.md so the costume pass can dress it
const ANC_M = ['anc_m1', 'anc_m2', 'anc_m3', 'anc_m4'], ANC_F = ['anc_f1', 'anc_f2', 'anc_f3', 'anc_f4'], ANC_AGE = { anc_m1: 32, anc_m2: 64, anc_m3: 22, anc_m4: 40, anc_f1: 25, anc_f2: 50, anc_f3: 35, anc_f4: 68 };
const ancientLook = (r, o = {}) => {
  const b = settlerLook(r), kid = !!o.child, female = o.female ?? b.female;
  const costume = kid ? (female ? 'anc_kid_f' : 'anc_kid_m') : (female ? ANC_F : ANC_M)[Math.floor(r() * 4)];
  return { ...b, female, sex: female ? 'f' : 'm', age: kid ? (female ? 7 : 9) : ANC_AGE[costume], era: 'ancient', costume, topType: 'tunic', pantsType: 'wraps', shoes: 'sandals', ...o };
};

// ---------- music: one valley motif (A C E D) carried by each state's instruments ----------
// thriving: frame drum, plucked strings, breathy flute and the waterwheel's pulse (82 BPM)
// abandoned: wind, a slow lone flute, long silences (60 BPM)
// flooded 2049: piano and low strings over the dam's electrical hum (70 BPM)
const MOTIF = [69, 72, 76, 74];
registerTheme('m5thrive', { bpm: 82, step(a, s, t, d) {
  const bar = Math.floor(s / 16), b = s % 16, sc = [57, 60, 62, 64, 67, 69, 72];
  if (b === 0) a.pad([45, 52, 57, 64], t, d * 16, 0.016, 520);
  if ([0, 7, 10].includes(b)) a.drum(t, b === 0 ? 0.2 : 0.1, 150, 70);
  if (b % 4 === 0) a.tick(t, 0.018, 2400);
  if (b % 2 === 0) a.pluck(sc[(bar * 5 + b / 2) % 7] - (b % 8 === 0 ? 12 : 0), t, 0.045);
  if (bar % 4 === 0 && b % 4 === 0) a.flute(MOTIF[b / 4], t, d * 3.6, 0.032);
  if (bar % 4 === 2 && b === 0) a.flute(MOTIF[2], t, d * 10, 0.026);
} });
registerTheme('m5empty', { bpm: 60, step(a, s, t, d) {
  const bar = Math.floor(s / 16), b = s % 16;
  if (b === 0 && bar % 2 === 0) a.pad([45, 52, 60], t, d * 32, 0.015, 380);
  if (b === 0 && bar % 4 === 0) a.cello(33, t, d * 16, 0.032);
  if (bar % 4 === 1 && b % 4 === 0) a.flute(MOTIF[b / 4] - 12, t, d * 4.5, 0.024);
  if (b === 8 && bar % 3 === 2) a.glass(81, t, 0.012);
} });
registerTheme('m5drowned', { bpm: 70, step(a, s, t, d) {
  const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62], [40, 55, 59, 64]][bar % 4];
  if (b === 0) { a.pad(ch.slice(1).map(n => n + 12), t, d * 16, 0.02, 900); a.cello(ch[0] - 12, t, d * 16, 0.038); }
  if (bar % 2 === 0 && b % 4 === 0) a.piano(MOTIF[b / 4], t, 0.24, 3.5);
  if (bar % 2 === 1 && b === 6) a.piano(ch[3] + 12, t, 0.14, 3);
} });
registerTheme('m5work', { bpm: 104, step(a, s, t, d) {
  const bar = Math.floor(s / 16), b = s % 16, sc = [57, 60, 62, 64, 67];
  if ([0, 3, 6, 8, 11, 14].includes(b)) a.drum(t, b === 0 ? 0.26 : 0.13, 140, 60);
  if (b % 2 === 0) a.pluck(sc[(b / 2 + bar) % 5] + (b % 4 ? 12 : 0), t, 0.05);
  if (b === 0) a.cello(bar % 2 ? 43 : 45, t, d * 14, 0.05);
  if (b === 8 && bar % 2 === 0) a.flute(MOTIF[(bar >> 1) % 4] + 12, t, d * 6, 0.026);
} });
registerTheme('m5machine', { bpm: 48, step(a, s, t, d) {
  const bar = Math.floor(s / 16), b = s % 16;
  if (b === 0) { a.cello(33, t, d * 16, 0.05); a.pad([57, 64, 69], t, d * 16, 0.016, 480); }
  if (b === 0 && bar % 2 === 0) MOTIF.forEach((n, i) => a.glass(n + 12, t + i * d * 3, 0.022));
  if (b === 8 && bar % 2 === 1) [76, 83, 81].forEach((n, i) => a.glass(n, t + i * d * 2.5, 0.016));
} });
registerTheme('m5end', { bpm: 62, step(a, s, t, d) {
  const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 60, 64], [41, 60, 65], [48, 60, 67], [43, 59, 62]][bar % 4];
  if (b === 0) { a.cello(ch[0], t, d * 16, 0.05); if (bar >= 2) a.pad(ch.slice(1).map(n => n + 12), t, d * 16, 0.016 + Math.min(0.012, bar * 0.002), 800); }
  if (b % 4 === 0) a.piano((bar % 2 ? [76, 83, 81, 79] : MOTIF)[b / 4], t, 0.22, 4);
} });

export default {
  id: 'm5', act: 'ACT I · THE WORLD THAT REMEMBERS', title: 'The Village That Never Existed', sub: 'The village · three states',
  async run(game) {
    const { ui, audio } = game, T = game.temporal, renderer = game.engine.renderer;
    const t0 = performance.now(); let tP = t0; const PERF = (n) => { const t = performance.now(); console.log('m5 build', n, Math.round(t - tP), 'ms'); tP = t; };
    const scene = game.newScene({ background: 0x9ab0c0, exposure: 1.0, bloom: 0.45, bloomThreshold: 0.92, envIntensity: 1, killY: -40, residue: true });
    RZ.init(renderer, { quality: game.engine.quality || 'medium' });
    const Q = RZ.getQuality();
    game.onUpdate(dt => RZ.update(dt));
    const VAL = V.makeValley(5);
    const R = rng(505);
    const F = game.flags;
    // mission-local progress (persisted ones are copied into game.flags as they happen)
    const S = { diverted: false, wall: false, drains: 0, beams: 0, braced: 0, released: false, drained: false, hatch: false, quest: false, gates: [false, true, false], shards: 0, sawAbPost: false, sawFlPost: false, sawFlWall: false, toured: false, sign: false, metTala: false };
    const STATES = ['thriving', 'abandoned', 'flooded'];

    // ======================================================================================
    // visibility / collision bookkeeping driven by state + story flags
    // ======================================================================================
    const visList = [], colList = [], resList = [];
    const vis = (obj, states, cond) => { obj.userData.m5states = states; visList.push({ obj, states, cond }); scene.add(obj); return obj; };
    const col = (min, max, states, cond) => { const b = game.collision.add(min, max, states ? { states } : {}); if (cond) colList.push({ b, cond }); return b; };
    const resid = (obj, state) => { obj.userData.states = [state]; scene.add(obj); game.residue(obj); resList.push(obj); return obj; };
    const refreshWorld = () => {
      const st = T.current;
      for (const v of visList) { v.obj.visible = v.states.includes(st) && (!v.cond || v.cond()); if (v.obj.userData.blockKids) v.obj.children.forEach(c => { c.visible = v.obj.visible; }); }
      for (const c of colList) c.b.enabled = c.cond();
      for (const o of resList) o.visible = game.residueOn && o.userData.states.includes(st);
    };

    // ======================================================================================
    // skies (one per state, swapped on switch), sun, fog
    // ======================================================================================
    const SKY = {
      thriving: { preset: 'golden-hour', elevation: 17, azimuth: 35, turbidity: 2.6, cover: 0.3 },
      abandoned: { preset: 'overcast', elevation: 30, azimuth: 15, cover: 0.8, stratus: 0.5, turbidity: 4 },
      flooded: { preset: 'day', elevation: 33, azimuth: -28, cover: 0.42, turbidity: 2.4 },
    };
    const skies = {};
    for (const k of STATES) {
      const s = RZ.skyEnvironment(renderer, scene, { ...SKY[k], apply: false });
      skies[k] = { s, sunDir: RZ.shared.sunDir.value.clone(), sunColor: RZ.shared.sunColor.value.clone(), fogSun: RZ.shared.fogSun.value.clone() };
    }
    const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = Q !== 'low';
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 220 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
    const hemi = new THREE.HemisphereLight(0xb0c0d0, 0x4a3a2a, 0.35); scene.add(hemi);
    scene.fog = RZ.heightFog({ color: 0xb0b8c0, density: 0.006, falloff: 0.035, base: 0 });
    let sunDir = new THREE.Vector3(0.3, 0.6, 0.3);
    game.onUpdate(() => { const p = game.cine ? game.engine.camera.position : game.player.pos; sun.target.position.set(p.x, 0, p.z); sun.position.copy(sun.target.position).addScaledVector(sunDir, 110); });
    const STYLE = {
      thriving: { exposure: 1.0, fog: 0.0052, fogMul: 1.0, sunMul: 1.0, hemi: 0.3, env: 1.0 },
      abandoned: { exposure: 1.08, fog: 0.0075, fogMul: 1.0, sunMul: 1.25, hemi: 0.42, env: 1.0 },
      flooded: { exposure: 0.96, fog: 0.0058, fogMul: 1.02, sunMul: 1.0, hemi: 0.3, env: 1.0 },
    };
    const applySky = (st) => {
      const k = skies[st], s = k.s, y = STYLE[st];
      scene.background = s.background; scene.environment = s.envMap; scene.environmentIntensity = y.env; scene.backgroundIntensity = 1;
      RZ.shared.sunDir.value.copy(k.sunDir); RZ.shared.sunColor.value.copy(k.sunColor); RZ.shared.fogSun.value.copy(k.fogSun);
      sun.color.copy(s.sunColor); sun.intensity = s.sunIntensity * y.sunMul; sunDir = s.sunDirection.clone();
      hemi.color.copy(s.hemi.sky).multiplyScalar(1.2); hemi.groundColor.copy(s.hemi.ground); hemi.intensity = y.hemi;
      scene.fog.color.copy(s.hazeColor).multiplyScalar(y.fogMul); scene.fog.density = y.fog;
      renderer.toneMappingExposure = y.exposure;
    };

    PERF('sky');
    // ======================================================================================
    // terrain: rectilinear grid with exact lines at the retaining wall and the Keepers' Door
    // ======================================================================================
    const fineStep = Q === 'high' ? 1.0 : Q === 'medium' ? 1.4 : 2.0;
    const xs = V.axis(-260, 260, -42, 44, fineStep, [WALL.x0, WALL.x1, -15.2, -12.8]);
    const zs = V.axis(-300, 230, -74, 58, fineStep, [DOOR.z0, DOOR.z1, WALL.z0, WALL.z1]);
    const hole = [[WALL.x0 - 0.01, DOOR.z0, WALL.x1 + 0.01, DOOR.z1]];
    const terMatHolder = RZ.terrain({ size: 4, segments: 2, heightFn: () => 0, texSize: Q === 'low' ? 256 : undefined, waterLevel: -0.6, rockSlope: 0.4, dirt: 0.32,
      layers: [['grass', { color: 0x58692c, dry: 0x8f8448, dryness: 0.4, bare: 0.55 }], ['dirt', { color: 0x6a5238, damp: 0.3 }], ['rock', { color: 0x8a7c66, color2: 0x675a49 }], ['sand', { color: 0x9c8a6a }]] });
    const terMat = terMatHolder.material, terCfg = terMat.userData.rzUniforms.rzTCfg.value;
    const terBase = new THREE.Mesh(V.gridTerrain(VAL.hBase, xs, zs, hole), terMat); terBase.receiveShadow = true; terBase.name = 'terrain';
    const terEroded = new THREE.Mesh(V.gridTerrain(VAL.hEroded, xs.filter(x => x > -70 && x < 70), zs.filter(z => z > -90 && z < 90), hole), terMat); terEroded.receiveShadow = true;
    vis(terBase, STATES, () => !(T.current === 'abandoned' && !S.diverted));
    // the eroded variant only covers the valley; beyond it the base terrain is identical, so show the base outside
    vis(terEroded, ['abandoned'], () => !S.diverted);
    const terOuter = new THREE.Mesh(V.gridTerrain(VAL.hBase, xs, zs, [[-60, -80, 60, 80]]), terMat); terOuter.receiveShadow = true;
    vis(terOuter, ['abandoned'], () => !S.diverted);
    scene.add(RZ.mountains({ center: [0, -30], radius: [320, 760], height: 190, seed: 8, rock: 0x5e564c, grass: 0x3c4a2c, snowLine: 170 }));
    scene.add(RZ.hazeLayer({ center: [0, -30], radius: 280, height: 90, color: 0xc0c4c4, opacity: 0.4 }));

    // terrain + features under the player / NPCs
    const terrainH = (x, z) => (T.current === 'abandoned' && !S.diverted) ? VAL.hEroded(x, z) : VAL.hBase(x, z);
    const HZ = -50.5, A53 = VAL.A(HZ), B55 = VAL.B(HZ), R64 = VAL.R(-64);
    const TOWER = { x: 29.4, z: 45.0 };
    const dykeX = z => VAL.B(z) - 4.4;
    const dykeCrest = () => T.current === 'thriving' ? 1.15 : 2.6;
    const dykeProfile = (d, c) => d >= -0.9 && d <= 0.9 ? c : d < -0.9 ? c - (-0.9 - d) * 0.7 * (c / 2.6) : c - (d - 0.9) * 18;
    const barH = (x, z) => (x > -17 && x < 25 && Math.abs(z - 30) < 2.4) ? 2.25 - Math.max(0, Math.abs(z - 30) - 1.0) * 0.8 : -Infinity;
    const moundH = (x, z) => 1.85 * Math.exp(-((x + 10.5) ** 2) / 26 - ((z + 4.5) ** 2) / 34) + 1.2 * sm(-9, -13.4, x) * Math.exp(-((z + 4.5) ** 2) / 30) - 0.2;
    const featureH = (x, z) => {
      let h = -Infinity; const st = T.current;
      if (z > -65.3 && z < -62.7 && Math.abs(x - R64) < 5.4) h = 3.38;
      if (Math.abs(z - HZ) < 1.15 && Math.abs(x - A53) < 4.9) h = Math.max(h, 3.38);
      if (S.diverted && Math.abs(z - HZ) < 1.15 && Math.abs(x - B55) < 4.9) h = Math.max(h, 3.38);
      if (st === 'thriving' && Math.abs(z - 12) < 1.0 && x > 8.4 && x < 18.6) h = Math.max(h, 0.32);
      if (S.diverted && z > -48.5 && z < 46.3) { const d = x - dykeX(z); if (d > -5 && d < 1.2) h = Math.max(h, dykeProfile(d, dykeCrest())); }
      if (st === 'flooded') {
        if (S.quest) h = Math.max(h, barH(x, z));
        if (x > 25.0 && x < 26.4 && z > 44.0 && z < 46.0) h = Math.max(h, 2.75);
        const r = Math.hypot(x - TOWER.x, z - TOWER.z); if (r > 2.3 && r < 3.75) h = Math.max(h, 2.8);
        if (!S.wall) h = Math.max(h, moundH(x, z));
      }
      return h;
    };
    // the tunnel behind the Keepers' Door and the machine chamber (under the terrace)
    const CH = { x0: -34, x1: -24.5, z0: -12.5, z1: 0.5, floor: -3, ceil: 2.6 };
    const inInterior = (x, z) => (x < -13.2 && x > -24.6 && z > DOOR.z0 && z < DOOR.z1) || (x >= CH.x0 && x <= CH.x1 && z >= CH.z0 && z <= CH.z1);
    const interiorFloor = x => x > -19 ? 0 : x > -24.5 ? lerp(0, CH.floor, (-19 - x) / 5.5) : CH.floor;
    const groundAt = (x, z, y = 99) => (inInterior(x, z) && y < 2.45) ? interiorFloor(x) : Math.max(terrainH(x, z), featureH(x, z));
    const waterAt = (x, z) => {
      const st = T.current, inA = Math.abs(x - VAL.A(z)) < 4.2, inB = Math.abs(x - VAL.B(z)) < 4.2, shelf = z < -47;
      if (st === 'flooded' && !S.drained && z > -49) return 2.0;
      if (z < -60 && (inA || inB)) return 2.5;
      if (st === 'abandoned' && !S.diverted && VAL.erodeMask(x, z) > 0.25) return -0.35;
      const lvl = shelf ? 2.5 : -0.6;
      if (inA && !S.diverted) return st === 'flooded' && !shelf ? -1.05 : lvl;
      if (inB && S.diverted) return st === 'flooded' && !shelf ? -1.05 : lvl;
      if (st === 'flooded' && S.drained && (inA || inB)) return -1.05;
      return -Infinity;
    };

    PERF('terrain');
    // ======================================================================================
    // materials
    // ======================================================================================
    // shared bakes: one parameter set per recipe, varied per state with tints (keeps scene build quick on phones)
    const pbr = (k, o) => RZ.pbrMaterial(k, o);
    const P = {
      cutStone: { color: 0xb8aa8c, joint: 0x7c705e, rows: 6, weathering: 0.6 }, plaster: { color: 0xd4b68e, under: 0x9a8064, damage: 0.3, dirt: 0.6 },
      wood: { color: 0x8c6644, planks: 3, weathered: 0.6 }, dirt: { color: 0x8a6c4c, damp: 0.3, pebbles: 0.5 }, paintedMetalPanel: { color: 0x9aa0a6, cols: 1, rows: 1, wear: 0.5, grime: 0.6, gloss: 0.4 },
    };
    const mk = (kind, tint, o = {}) => pbr(kind, { mapping: 'world', params: P[kind] || o.params, tint, ...o });
    const MOSS = { kind: 'moss', amount: 0.5, ground: 0.6 };
    const MAT = {
      foot: mk('cutStone', 0xe2dace), plaster: mk('plaster', 0xf6eee2), roof: mk('plaster', 0xa48a72), timber: mk('wood', 0xb09070),
      dark: new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 1 }),
      textile: new THREE.MeshStandardMaterial({ roughness: 0.92, map: canvasTex(128, 256, (g, w, h) => { const c = ['#8a2a1c', '#c89a3a', '#2f5a5a', '#d8c8a0']; for (let y = 0; y < h; y += 16) { g.fillStyle = c[(y / 16) % 4]; g.fillRect(0, y, w, 16); } for (let k = 0; k < 600; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, 'm5textile') }),
      ruin: mk('cutStone', 0xc6bdac, { overlay: MOSS }), timberOld: mk('wood', 0x7a7068),
      drown: mk('cutStone', 0x8a8676, { overlay: { ...MOSS, amount: 0.8, ground: 0.9 } }), wallNew: mk('cutStone', 0xffffff), cave: mk('cutStone', 0x948a7a),
      concrete: mk('concrete', 0xffffff, { params: { color: 0x8a8780, stains: 1, formwork: 1 } }), steel: mk('paintedMetalPanel', 0x4c545a),
      gravel: mk('gravel', 0xffffff, { params: { color: 0x7a7266 } }), mud: mk('dirt', 0x6a5e54, { roughness: 1 }), dirt: mk('dirt', 0xffffff),
    };
    const stoneChunks = tint => pbr('cutStone', { mapping: 'triplanar', space: 'object', vertexColors: true, params: P.cutStone, tint });
    const laneMat = (base, opacity) => { const m = mk('dirt', base); m.alphaMap = V.edgeAlpha('lane'); m.transparent = true; m.opacity = opacity; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };
    const discMat = (base, opacity) => { const m = laneMat(base, opacity); m.alphaMap = V.edgeAlpha('disc'); return m; };

    PERF('materials');
    // ======================================================================================
    // the village: houses, lanes, plaza, props (per state, merged)
    // ======================================================================================
    const hy = h => VAL.hBase(h.x, h.z) - 0.05;
    const binT = new V.MergeBin(), binA = new V.MergeBin(), binAe = new V.MergeBin(), binF = new V.MergeBin(), binFe = new V.MergeBin();
    const rubA = [], rubF = [], rubErode = [];
    V.HOUSES.forEach((h, i) => {
      V.houseThriving(binT, h, hy(h), i + 1);
      (h.east ? rubA.push(...V.houseRuin(binAe, h, hy(h), i + 1, 0.45)) : rubA.push(...V.houseRuin(binA, h, hy(h), i + 1, 0.45)));
      rubF.push(...V.houseRuin(h.east ? binFe : binF, h, hy(h), i + 41, 0.7));
      if (h.east) for (let k = 0; k < 10; k++) rubErode.push({ x: h.x + (R() - 0.2) * 7, z: h.z + (R() - 0.5) * 6, scale: 0.3 + R() * 0.5, sink: 0.1 });
      const cs = Math.cos(h.ry), sn = Math.sin(h.ry), hw = h.w / 2 + 0.12, hd = h.d / 2 + 0.12, ex = Math.abs(hw * cs) + Math.abs(hd * sn), ez = Math.abs(hw * sn) + Math.abs(hd * cs);
      const y = hy(h);
      if (h.east) { col([h.x - ex, y - 1, h.z - ez], [h.x + ex, y + 3.4, h.z + ez], ['thriving', 'abandoned', 'flooded'], () => S.diverted || T.current === 'thriving'); }
      else col([h.x - ex, y - 1, h.z - ez], [h.x + ex, y + 3.4, h.z + ez]);
    });
    const houseMatsT = { foot: MAT.foot, plaster: MAT.plaster, roof: MAT.roof, timber: MAT.timber, dark: MAT.dark, textile: MAT.textile };
    const houseMatsA = { foot: MAT.ruin, ruin: MAT.ruin, timber: MAT.timberOld };
    const houseMatsF = { foot: MAT.drown, ruin: MAT.drown, timber: MAT.timberOld };
    const housesT = vis(binT.build(houseMatsT), ['thriving']);
    const housesA = vis(binA.build(houseMatsA), ['abandoned']);
    vis(binAe.build(houseMatsA), ['abandoned'], () => S.diverted);
    const housesF = vis(binF.build(houseMatsF), ['flooded']);
    vis(binFe.build(houseMatsF), ['flooded'], () => S.diverted);
    for (const g of [housesT, housesA, housesF]) { g.userData.blockKids = true; g.children.forEach(m => game.blocker(m)); }
    vis(RZ.rocks({ shape: 'chunk', placements: rubA, heightAt: VAL.hBase, seed: 4, material: stoneChunks(0xc6bdac) }), ['abandoned']);
    vis(RZ.rocks({ shape: 'chunk', placements: rubF, heightAt: VAL.hBase, seed: 6, material: stoneChunks(0x8a8676) }), ['flooded']);
    vis(RZ.rocks({ shape: 'chunk', placements: rubErode, heightAt: VAL.hEroded, seed: 7 }), ['abandoned'], () => !S.diverted);
    // lanes and the plaza (packed earth); faint in the abandoned state
    const LANES = [[[-2, 3], [-3, 12], [-4.5, 20], [-6, 30], [-12, 34], [-22, 30], [-28, 27]], [[-2, 3], [3, 4], [8.2, 5.5]], [[-2, 3], [-4, -8], [-5, -14], [-4, -24], [-6, -30], [-14, -32], [-22, -34]], [[-2, 3], [6, -8], [8, -14]], [[18.6, 12], [21, 0], [21, -20], [20.5, -38], [20.5, -48]]];
    for (const [st, op, base] of [['thriving', 0.95, 0x7d6448], ['abandoned', 0.45, 0x6a5a40]]) {
      const lm = laneMat(base, op), dm = discMat(base, op);
      for (const L of LANES) vis(new THREE.Mesh(V.laneStrip(L, st === 'thriving' ? 2.4 : 1.6, VAL.hBase, 0.03), lm), [st]).receiveShadow = true;
      vis(new THREE.Mesh(V.groundDisc(-2, 3, 8.5, 7.5, VAL.hBase, 3), dm), [st]).receiveShadow = true;
      vis(new THREE.Mesh(V.groundDisc(-24.5, 0.5, 5.5, 5, VAL.hBase, 5), dm), [st]).receiveShadow = true;
    }
    // jars, baskets, woodpiles, drying racks (thriving); broken jars (abandoned)
    const jarG = V.jarGeometry(1), clay = pbr('plaster', { mapping: 'object', params: P.plaster, tint: 0xd08a62 });
    const jars = [], jarsA = [];
    const jarSpot = (x, z, n) => { for (let k = 0; k < n; k++) { const px = x + (R() - 0.5) * 1.6, pz = z + (R() - 0.5) * 1.2, s = 0.75 + R() * 0.5; jars.push({ x: px, y: VAL.hBase(px, pz), z: pz, s, ry: R() * 6 }); if (R() < 0.5) jarsA.push({ x: px + 0.3, y: VAL.hBase(px, pz) - 0.12, z: pz, s: s * 0.9, rx: 1.3 + R() * 0.3, ry: R() * 6 }); } };
    for (const [x, z, n] of [[-6.4, -14.8, 4], [-6.6, 11.5, 5], [1.8, -15, 3], [-0.6, 13.2, 4], [-22.2, -2.2, 9], [-22.6, 2.8, 7], [7.6, 3.4, 4], [-3.2, 22.2, 3], [-24.5, 6.8, 5]]) jarSpot(x, z, n);
    vis(V.instances(jarG, clay, jars), ['thriving']);
    vis(V.instances(jarG, clay, jarsA), ['abandoned']);
    const logG = new THREE.CylinderGeometry(0.09, 0.1, 1.4, 7); logG.rotateZ(Math.PI / 2);
    const logs = []; for (const [x, z] of [[-11.8, -14.5], [-11.6, 12.5], [0.5, 21.4], [-29.5, 1]]) for (let k = 0; k < 9; k++) logs.push({ x: x + (k % 3) * 0.02, y: VAL.hBase(x, z) + 0.1 + Math.floor(k / 3) * 0.17, z: z + (k % 3) * 0.2 - 0.2, ry: 0.1 });
    vis(V.instances(logG, MAT.timber, logs), ['thriving']);
    // kilns of the potters (domes) and a drying rack
    const kilnG = new THREE.SphereGeometry(1.0, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    for (const [x, z] of [[-21.4, -0.6], [-21.8, 2.6]]) {
      vis(V.instances(kilnG, MAT.roof, [{ x, y: TY, z, s: 1, sy: 1.2 }]), ['thriving']); col([x - 0.95, TY, z - 0.95], [x + 0.95, TY + 1.2, z + 0.95], ['thriving']);
      vis(V.instances(kilnG, MAT.ruin, [{ x, y: TY - 0.2, z, s: 0.9, sy: 0.6 }]), ['abandoned']);
    }
    // the plaza fire with storytellers (thriving)
    const fire = new THREE.PointLight(0xff8a30, 14, 12, 1.6); fire.position.set(-1, 1.0, 6); scene.add(fire);
    const flame = vis(new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.0, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })), ['thriving']); flame.position.set(-1, VAL.hBase(-1, 6) + 0.5, 6);
    const ring = []; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ring.push({ x: -1 + Math.cos(a) * 0.55, y: VAL.hBase(-1, 6) + 0.05, z: 6 + Math.sin(a) * 0.55, s: 0.6 }); }
    vis(V.instances(new THREE.DodecahedronGeometry(0.22, 0), MAT.foot, ring), ['thriving']);
    const embers = new Motes(60, [-1.5, 0.3, 5.5, -0.5, 4, 6.5], 0xff8a30, 0.07, 0.9); vis(embers.mesh, ['thriving']);
    game.onUpdate((dt, t) => { if (T.current !== 'thriving') { fire.intensity = 0; return; } fire.intensity = 12 + Math.sin(t * 13) * 2.5 + Math.sin(t * 7.7) * 2; flame.scale.set(1 + Math.sin(t * 9) * 0.08, 1 + Math.sin(t * 11) * 0.16, 1); embers.update(dt); });
    const smk = V.smoke([[-9, 3.9, -17.2], [-3, 3.9, 15.6], [-27.5, 6.3, 4.2], [-21.4, 4.6, -0.6]]); vis(smk.points, ['thriving']);
    game.onUpdate((dt, t) => { if (T.current === 'thriving') smk.update(dt, t); });
    // the waterwheel on channel A (thriving: turning; abandoned: a broken stump)
    const wheel = new THREE.Group(), AW = { x: VAL.A(-1), z: -1 };
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), MAT.timber); sp.rotation.x = a; wheel.add(sp); const pad = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.45), MAT.timber); pad.position.set(0, Math.cos(a) * 2.15, Math.sin(a) * 2.15); pad.rotation.x = a; wheel.add(pad); }
    for (const s of [-0.5, 0.5]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.06, 6, 36), MAT.timber); rim.rotation.y = Math.PI / 2; rim.position.x = s; wheel.add(rim); }
    wheel.position.set(AW.x, 0.55, AW.z); vis(wheel, ['thriving']);
    for (const s of [-1, 1]) vis(V.instances(new THREE.BoxGeometry(0.3, 2.4, 0.3), MAT.timber, [{ x: AW.x + s * 0.8, y: -0.6, z: AW.z }]), ['thriving']);
    vis(V.instances(new THREE.BoxGeometry(0.3, 1.4, 0.3), MAT.timberOld, [{ x: AW.x - 0.8, y: -0.8, z: AW.z, rz: 0.3 }, { x: AW.x + 0.6, y: -0.8, z: AW.z + 0.3, rz: -0.6 }]), ['abandoned']);
    game.onUpdate(dt => { if (T.current === 'thriving' && !S.diverted) wheel.rotation.x += dt * 0.7; });
    // footbridge over channel A (thriving)
    const fb = new THREE.Group(); for (let k = 0; k < 11; k++) fb.add(V.instances(new THREE.BoxGeometry(0.9, 0.1, 2.0), MAT.timber, [{ x: 8.8 + k * 0.9, y: 0.22, z: 12 }]));
    for (const s of [-1, 1]) fb.add(V.instances(new THREE.BoxGeometry(10, 0.08, 0.08), MAT.timber, [{ x: 13.5, y: 1.1, z: 12 + s * 0.95 }]));
    vis(fb, ['thriving']);
    // the water steps and Tala's mural stone
    const steps = []; for (let k = 0; k < 5; k++) steps.push({ x: 8.9 + k * 0.42, y: -0.15 - k * 0.28, z: 5.2 });
    vis(V.instances(new THREE.BoxGeometry(0.5, 0.3, 2.6), MAT.foot, steps), ['thriving', 'abandoned']);
    const mural = vis(new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.5), new THREE.MeshStandardMaterial({ map: V.muralTex(), roughness: 0.9 })), ['thriving']); mural.position.set(6.3, 1.25, 1.9); mural.rotation.y = -Math.PI / 2 + 0.2;
    vis(V.instances(new THREE.BoxGeometry(0.4, 2.2, 4.0), MAT.foot, [{ x: 6.55, y: VAL.hBase(6.5, 1.9) + 1.0, z: 1.9, ry: 0.2 }]), ['thriving']);
    col([6.2, -0.5, 0], [6.9, 2.2, 3.8], ['thriving']);

    PERF('village');
    // ======================================================================================
    // the retaining wall, the Keepers' Door, the weep holes, the Water Ring
    // ======================================================================================
    const wallT = vis(new THREE.Mesh(V.retainingWall({}), MAT.wallNew), ['thriving']);
    const wallA = vis(new THREE.Mesh(V.retainingWall({ bulge: 0.42, bulgeZone: [-10.5, 1.5] }), MAT.ruin), ['abandoned']);
    const wallFok = vis(new THREE.Mesh(V.retainingWall({ bulge: 0.3, bulgeZone: [-10.5, 1.5] }), MAT.drown), ['flooded'], () => S.wall);
    const wallFgap = vis(new THREE.Mesh(V.retainingWall({ gap: [-11, 1] }), MAT.drown), ['flooded'], () => !S.wall);
    for (const w of [wallT, wallA, wallFok, wallFgap]) { w.castShadow = w.receiveShadow = true; game.blocker(w); }
    const slip = []; for (let k = 0; k < 26; k++) slip.push({ x: -13.4 + R() * 1.8, z: -11 + R() * 12, y: 1.0 + R() * 1.6, scale: 0.5 + R() * 0.7 });
    vis(RZ.rocks({ shape: 'chunk', placements: slip, seed: 11, material: stoneChunks(0x8a8676) }), ['flooded'], () => !S.wall);
    const moundGeo = (() => { const g = new THREE.PlaneGeometry(16, 18, 40, 44); g.rotateX(-Math.PI / 2); g.translate(-8.5, 0, -4.5); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.max(VAL.hBase(x, z) - 0.3, moundH(x, z) + VAL.nz.fbm2(x * 0.5, z * 0.5, 3) * 0.25)); } g.computeVertexNormals(); return g; })();
    vis(new THREE.Mesh(moundGeo, MAT.mud), ['flooded'], () => !S.wall).receiveShadow = true;
    // the door: a carved slab (thriving / abandoned), a Helix hatch (2049)
    const doorMid = (DOOR.z0 + DOOR.z1) / 2;
    const slabT = vis(new THREE.Mesh(new THREE.BoxGeometry(0.3, DOOR.h, DOOR.z1 - DOOR.z0), [MAT.wallNew, MAT.wallNew, MAT.wallNew, MAT.wallNew, MAT.wallNew, MAT.wallNew]), ['thriving']);
    const slabMatT = new THREE.MeshStandardMaterial({ map: V.doorTex('stone'), roughness: 0.9 }), slabMatA = new THREE.MeshStandardMaterial({ map: V.doorTex('roots'), roughness: 0.95 });
    slabT.material[0] = slabMatT; slabT.position.set(DOOR.x - 0.12, DOOR.h / 2, doorMid);
    const slabA = vis(new THREE.Mesh(new THREE.BoxGeometry(0.3, DOOR.h, DOOR.z1 - DOOR.z0), [slabMatA, MAT.ruin, MAT.ruin, MAT.ruin, MAT.ruin, MAT.ruin]), ['abandoned']); slabA.position.copy(slabT.position);
    const hatchPivot = new THREE.Group(); hatchPivot.position.set(DOOR.x + 0.02, 0, DOOR.z0 + 0.05);
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.12, DOOR.h - 0.1, DOOR.z1 - DOOR.z0 - 0.1), [new THREE.MeshStandardMaterial({ map: V.doorTex('hatch'), roughness: 0.6, metalness: 0.5 }), MAT.steel, MAT.steel, MAT.steel, MAT.steel, MAT.steel]);
    hatch.position.set(0, DOOR.h / 2, (DOOR.z1 - DOOR.z0) / 2 - 0.05); hatchPivot.add(hatch); vis(hatchPivot, ['flooded'], () => S.wall);
    col([DOOR.x - 0.4, -0.5, DOOR.z0], [DOOR.x + 0.05, DOOR.h, DOOR.z1], null, () => !(T.current === 'flooded' && S.hatch));
    // weep holes (drains) at y 0.7 in the wall face
    const WEEP = [-9.2, -3.0, 1.0];
    const holeM = new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 1 });
    for (const z of WEEP) for (const [st, x] of [['thriving', WALL.x1 + 0.01], ['abandoned', WALL.x1 + 0.2], ['flooded', WALL.x1 + 0.15]]) vis(V.instances(new THREE.BoxGeometry(0.06, 0.24, 0.3), holeM, [{ x, y: 0.6, z }]), [st], st === 'flooded' ? () => S.wall : null);
    const stainM = new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: 0.4, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const z of WEEP) { const st = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.75), stainM); st.position.set(WALL.x1 + 0.03, 0.35, z); st.rotation.y = Math.PI / 2; vis(st, ['thriving']); }
    const plugs = WEEP.map(z => { const m = vis(new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 1), MAT.mud), ['abandoned'], () => S.drains < 3 && !m.userData.cleared); m.position.set(WALL.x1 + 0.35, 0.62, z); m.scale.set(0.8, 0.9, 1.2); return m; });
    const jetM = new THREE.MeshStandardMaterial({ color: 0x9ab8c0, roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false });
    WEEP.forEach((z, i) => { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(WALL.x1 + 0.3, 0.62, z), new THREE.Vector3(WALL.x1 + 0.7, 0.45, z), new THREE.Vector3(WALL.x1 + 1.0, 0.02, z)]); const m = vis(new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.05, 6), jetM), ['abandoned'], () => plugs[i].userData.cleared || S.wall); return m; });
    WEEP.forEach(z => { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(WALL.x1 + 0.25, 0.62, z), new THREE.Vector3(WALL.x1 + 0.6, 0.4, z), new THREE.Vector3(WALL.x1 + 0.9, 0.02, z)]); const m = new THREE.Mesh(new THREE.TubeGeometry(c, 10, 0.06, 6), new THREE.MeshBasicMaterial({ color: 0x5fe6ff, transparent: true, opacity: 0.6 })); resid(m, 'abandoned'); });
    // braces for the bulge: two timber beams + stone wedges (abandoned once placed; fossil braces in 2049)
    const BRACE = [{ x: -12.2, z: -8.0 }, { x: -12.2, z: -1.6 }];
    BRACE.forEach((b, i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 3.0, 8), MAT.timberOld); m.position.set(b.x, 1.15, b.z); m.rotation.z = -0.62; m.castShadow = true; vis(m, ['abandoned'], () => S.braced > i); return m; });
    BRACE.forEach(b => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.8), MAT.drown); m.position.set(b.x - 0.1, 0.6, b.z); m.rotation.z = -0.25; vis(m, ['flooded'], () => S.wall); });
    vis(V.instances(new THREE.BoxGeometry(0.35, 0.22, 0.5), MAT.foot, BRACE.map(b => ({ x: b.x + 0.75, y: 0, z: b.z }))), ['abandoned'], () => S.wall);
    // the stone platform and the Water Ring above the door
    const ringStone = pbr('cutStone', { mapping: 'object', params: P.cutStone, tint: 0xb4aa98 });
    const plat = vis(V.instances(new THREE.BoxGeometry(3.2, 0.36, 3.6), MAT.foot, [{ x: -15.9, y: TY + 0.0, z: doorMid }]), STATES);
    plat.position.y = 0.18; col([-17.5, TY - 0.2, doorMid - 1.8], [-14.3, TY + 0.36, doorMid + 1.8]);
    const wRing = V.waterRing(ringStone); wRing.position.set(-16.2, TY + 0.36 + 1.6, doorMid); wRing.rotation.y = Math.PI / 2; scene.add(wRing);
    col([-16.6, TY, doorMid - 1.6], [-15.8, TY + 3.2, doorMid + 1.6]);
    const ringLight = new THREE.PointLight(0xffb060, 0, 8, 1.6); ringLight.position.set(-15.4, TY + 2, doorMid); scene.add(ringLight);
    game.onUpdate((dt, t) => { wRing.userData.glyph.material.emissiveIntensity = 0.25 + (ringLight.intensity > 0 ? 2 : 0) + Math.sin(t * 1.3) * 0.08; });

    PERF('wall');
    // ======================================================================================
    // the head works on the shelf: the village sluice, the rockfall, the bridges, the levee
    // ======================================================================================
    const piers = [];
    for (const s of [-1, 1]) piers.push({ x: A53 + s * 4.4, y: 1.0, z: HZ });
    vis(V.instances(new THREE.BoxGeometry(1.1, 2.8, 2.4), MAT.wallNew, piers), ['thriving']);
    vis(V.instances(new THREE.BoxGeometry(1.1, 2.2, 2.4), MAT.ruin, piers.map(p => ({ ...p, y: 0.9 }))), ['abandoned']);
    vis(V.instances(new THREE.BoxGeometry(1.1, 1.9, 2.4), MAT.drown, piers.map(p => ({ ...p, y: 0.8 }))), ['flooded']);
    for (const p of piers) col([p.x - 0.55, 0, HZ - 1.2], [p.x + 0.55, 3.8, HZ + 1.2]);
    const deckG = new THREE.BoxGeometry(9.8, 0.2, 2.2);
    vis(V.instances(deckG, MAT.timber, [{ x: A53, y: 3.28, z: HZ }]), ['thriving']);
    vis(V.instances(deckG, MAT.ruin, [{ x: A53, y: 3.28, z: HZ }]), ['abandoned', 'flooded']);
    const sluice = vis(new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.0, 0.22), MAT.timber), ['thriving']); sluice.position.set(A53, 3.6, HZ - 0.6);
    const windlass = vis(new THREE.Group(), ['thriving']); windlass.position.set(A53 + 4.4, 3.5, HZ);
    const wdrum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 10), MAT.timber); wdrum.rotation.x = Math.PI / 2; wdrum.position.y = 0.5; windlass.add(wdrum);
    for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), MAT.timber); sp.position.y = 0.5; sp.rotation.z = k * Math.PI / 4; wdrum.add(sp); }
    // the B mouth: rockfall (pre-diversion), then a second sluice frame + deck (post)
    const BOULD = [{ x: VAL.B(-53.6) - 0.9, z: -53.6, s: 1.35 }, { x: VAL.B(-52.6) + 1.2, z: -52.6, s: 1.2 }, { x: VAL.B(-51.6) - 0.2, z: -51.6, s: 1.1 }];
    const rockGeo = RZ.rockGeometry({ seed: 21, size: [1, 0.8, 0.9] });
    const rockMat = pbr('rock', { mapping: 'triplanar', space: 'object', scale: 0.35, vertexColors: true, overlay: { kind: 'moss', amount: 0.4 } });
    const boulders = BOULD.map((b, i) => { const m = new THREE.Mesh(rockGeo, rockMat); m.scale.setScalar(b.s); m.position.set(b.x, VAL.hBase(b.x, b.z) + b.s * 0.45, b.z); m.rotation.y = i * 2.1; m.castShadow = m.receiveShadow = true; scene.add(m); m.userData.home = m.position.clone(); return m; });
    const bCols = BOULD.map(b => col([b.x - b.s * 0.8, -1, b.z - b.s * 0.7], [b.x + b.s * 0.8, VAL.hBase(b.x, b.z) + b.s, b.z + b.s * 0.7], null, () => !S.diverted));
    const placeBoulders = () => boulders.forEach((m, i) => { if (S.diverted) { m.position.set(B55 + 5.4 + i * 0.3, TY + 0.55, -55.5 + i * 1.7); } else m.position.copy(m.userData.home); });
    const bPiers = [-1, 1].map(s => ({ x: B55 + s * 4.4, y: 1.0, z: HZ }));
    vis(V.instances(new THREE.BoxGeometry(1.1, 2.8, 2.4), MAT.wallNew, bPiers), ['thriving'], () => S.diverted);
    vis(V.instances(new THREE.BoxGeometry(1.1, 2.2, 2.4), MAT.ruin, bPiers), ['abandoned', 'flooded'], () => S.diverted);
    vis(V.instances(deckG, MAT.timber, [{ x: B55, y: 3.28, z: HZ }]), ['thriving'], () => S.diverted);
    vis(V.instances(deckG, MAT.ruin, [{ x: B55, y: 3.28, z: HZ }]), ['abandoned', 'flooded'], () => S.diverted);
    for (const p of bPiers) col([p.x - 0.55, 0, HZ - 1.2], [p.x + 0.55, 3.8, HZ + 1.2], null, () => S.diverted);
    // the old stone bridge over the river on the shelf (all states)
    const bridgeG = new THREE.BoxGeometry(10.8, 0.36, 2.6);
    vis(V.instances(bridgeG, MAT.wallNew, [{ x: R64, y: 3.02, z: -64 }]), ['thriving']);
    vis(V.instances(bridgeG, MAT.ruin, [{ x: R64, y: 3.02, z: -64 }]), ['abandoned', 'flooded']);
    // the levee along the eastern channel (built after the diversion; 2049: the causeway)
    const dykeGeo = V.sweepZ(dykeX, -48.5, 46.2, 1.0, (z, c) => { const g = VAL.hBase(c - 5, z) - 0.4; return [[-4.6, g], [-3.0, 2.6 - 2.1 * 0.7], [-0.9, 2.6], [0.9, 2.6], [1.2, -1.2]]; });
    const dykeT = vis(new THREE.Mesh(dykeGeo, MAT.wallNew), ['thriving'], () => S.diverted); dykeT.scale.y = 1.15 / 2.6;
    vis(new THREE.Mesh(dykeGeo, MAT.ruin), ['abandoned'], () => S.diverted);
    const dykeF = vis(new THREE.Mesh(dykeGeo, MAT.drown), ['flooded'], () => S.diverted);
    for (const m of [dykeT, dykeF]) { m.castShadow = true; m.receiveShadow = true; }
    // stone piles and a work crew on the new levee (thriving, after the diversion)
    vis(RZ.rocks({ shape: 'chunk', placements: Array.from({ length: 24 }, (_, i) => ({ x: dykeX(-30 + i * 2.5) - 2.6, z: -30 + i * 2.5, scale: 0.3 + R() * 0.25, sink: 0.05 })), heightAt: VAL.hBase, seed: 12 }), ['thriving'], () => S.diverted);

    PERF('headworks');
    // ======================================================================================
    // water: rivers per state and story, the 2049 reservoir, the spring and the field feeders
    // ======================================================================================
    const waters = [];
    const ribbonWater = (cx, z0, z1, level, half, heightAt, o = {}) => {
      let mn = Infinity, mx = -Infinity; for (let z = z0; z <= z1; z += 1) { mn = Math.min(mn, cx(z) - half); mx = Math.max(mx, cx(z) + half); }
      const w = RZ.water({ rect: [mn - 1, z0 - 1, mx - mn + 2, z1 - z0 + 2], level, heightAt, res: o.res ?? 96, deep: o.deep ?? 0x0d2a2c, shallow: o.shallow ?? 0x3b5f50, flow: o.flow ?? [0, 0.06], waves: o.waves ?? 0.5, chop: 0.8 });
      w.mesh.geometry.dispose(); w.mesh.geometry = V.sweepZ(cx, z0, z1, 1.0, () => [[-half, level], [half, level]]);
      waters.push(w); return w.mesh;
    };
    const rectWater = (rect, level, heightAt, o = {}) => { const w = RZ.water({ rect, level, heightAt, res: o.res ?? 128, deep: o.deep ?? 0x0b2426, shallow: o.shallow ?? 0x35574a, flow: o.flow ?? [0.01, 0.02], waves: o.waves ?? 0.45, chop: o.chop ?? 0.8 }); waters.push(w); return w.mesh; };
    const hB = VAL.hBase;
    vis(ribbonWater(VAL.A, -95, -47.2, 2.5, 4.4, hB), STATES, () => !S.diverted);
    vis(ribbonWater(VAL.B, -95, -47.2, 2.5, 4.4, hB), STATES, () => S.diverted);
    vis(ribbonWater(VAL.A, -46.5, 70, -0.6, 4.6, hB), ['thriving'], () => !S.diverted);
    vis(ribbonWater(VAL.B, -46.5, 70, -0.6, 4.6, hB), ['thriving', 'abandoned'], () => S.diverted);
    vis(ribbonWater(VAL.A, -46.5, 70, -1.2, 4.0, hB, { waves: 0.2 }), ['thriving', 'abandoned'], () => S.diverted);
    vis(rectWater([0.5, -46.5, 19.5, 116], -0.35, VAL.hEroded, { flow: [0, 0.05] }), ['abandoned'], () => !S.diverted);
    const reservoir = vis(rectWater([-36, -49, 76, 106], 2.0, hB, { res: 160, deep: 0x0a2024, shallow: 0x2e4c44, waves: 0.55 }), ['flooded'], () => !S.drained);
    vis(rectWater([-14, -46.5, 50, 104], -1.05, hB, { res: 128, deep: 0x1a2a24, shallow: 0x4a5a44, waves: 0.25 }), ['flooded'], () => S.drained);
    // cascades off the shelf
    const cascA = RZ.waterfall({ top: [VAL.A(-47.2), 2.55, -47.2], height: 3.2, width: 4.2, dir: [0, 1], lip: 0.6 });
    const cascB = RZ.waterfall({ top: [VAL.B(-47.2), 2.55, -47.2], height: 3.2, width: 4.2, dir: [0, 1], lip: 0.6 });
    vis(cascA, ['thriving', 'abandoned'], () => !S.diverted); vis(cascB, ['thriving', 'abandoned'], () => S.diverted);
    const cascAF = RZ.waterfall({ top: [VAL.A(-47.2), 2.55, -47.2], height: 1.2, width: 4.2, dir: [0, 1], lip: 0.6 }), cascBF = RZ.waterfall({ top: [VAL.B(-47.2), 2.55, -47.2], height: 1.2, width: 4.2, dir: [0, 1], lip: 0.6 });
    vis(cascAF, ['flooded'], () => !S.diverted && !S.drained); vis(cascBF, ['flooded'], () => S.diverted && !S.drained);
    vis(cascA.clone(), ['flooded'], () => !S.diverted && S.drained); vis(cascB.clone(), ['flooded'], () => S.diverted && S.drained);
    // the spring: cliff waterfall, pool, leat along the terrace foot, and three field feeders
    const springTop = VAL.hBase(-35.4, -33);
    const spring = RZ.waterfall({ top: [-35.2, springTop, -33], height: springTop - 2.6, width: 1.8, dir: [1, 0.1], lip: 0.4 });
    vis(spring, ['thriving', 'flooded'], () => T.current === 'thriving' || S.quest);
    vis(RZ.mist({ center: [-32.5, 2.8, -33], radius: 2.0, height: 2.5, count: 16 }), ['thriving']);
    vis(rectWater([-34.5, -36, 6, 6], 2.75, hB, { res: 32, flow: [0.02, 0.02], waves: 0.3 }), ['thriving', 'flooded'], () => T.current === 'thriving' || S.quest);
    vis(ribbonWater(() => -32, -31, 24, 3.0, 0.5, hB, { res: 64, waves: 0.25, flow: [0, 0.08] }), ['thriving', 'flooded'], () => T.current === 'thriving' || S.quest);
    VAL.FEED.forEach((fz, i) => { const len = i === 1 ? 9.5 : 12; const m = rectWater([-32, fz - 0.6, len, 1.2], 3.03, hB, { res: 32, waves: 0.2, flow: [0.08, 0] }); return vis(m, ['thriving'], () => S.gates[i]); });
    const yardFlood = vis(new THREE.Mesh(V.groundDisc(-23.2, 0.2, 3.2, 2.6, hB, 9, 0.04), (() => { const m = mk('dirt', 0x5a4c40); m.alphaMap = V.edgeAlpha('disc'); m.transparent = true; m.depthWrite = false; m.roughness = 0.1; m.polygonOffset = true; m.polygonOffsetFactor = -3; return m; })()), ['thriving'], () => S.gates[1]);
    yardFlood.receiveShadow = true;

    PERF('water');
    // ======================================================================================
    // crops (thriving) and the caretaker's garden (2049)
    // ======================================================================================
    const crop = (x0, x1, z0, z1, dx, dz, jitter) => { const L = []; for (let x = x0; x < x1; x += dx) for (let z = z0; z < z1; z += dz) { const px = x + (R() - 0.5) * jitter, pz = z + (R() - 0.5) * jitter; L.push({ x: px, y: hB(px, pz) - 0.05, z: pz, s: 0.75 + R() * 0.35, sy: 0.85 + R() * 0.4, ry: R() * 3 }); } return L; };
    const dens = Q === 'low' ? 1.35 : Q === 'medium' ? 1.1 : 0.9;
    vis(V.cropMesh([...crop(-30.5, -20.5, -28, -17, 0.75 * dens, 0.62 * dens, 0.25), ...crop(-30.5, -19.5, 9, 22, 0.75 * dens, 0.62 * dens, 0.25)], { kind: 'barley', hue: 48 }), ['thriving']);
    vis(V.cropMesh(crop(-24, -18.5, 13, 21, 0.9, 1.1, 0.15), { kind: 'garden', hue: 100, seed: 3 }), ['flooded'], () => S.quest);
    vis(V.cropMesh(crop(-24, -18.5, 13, 21, 1.6, 1.4, 0.4).map(p => ({ ...p, s: p.s * 0.6, sy: 0.4 })), { kind: 'garden', hue: 44, seed: 5 }), ['flooded'], () => !S.quest);

    PERF('crops');
    // ======================================================================================
    // 2049: the dam, the outlet tower, the buoy, the signs, the caretaker's cottage, the gravel bar
    // ======================================================================================
    const dam = vis(new THREE.Mesh(V.damGeometry(), MAT.concrete), ['flooded']); dam.castShadow = dam.receiveShadow = true;
    const towerM = vis(new THREE.Mesh(V.towerGeometry(), MAT.concrete), ['flooded']); towerM.position.set(TOWER.x, 0, TOWER.z); towerM.castShadow = true; game.blocker(towerM);
    const railM = MAT.steel;
    const rail = V.railRing(3.6, 2.8, railM); rail.position.set(TOWER.x, 0, TOWER.z); vis(rail, ['flooded']);
    col([TOWER.x - 2.35, -3, TOWER.z - 2.35], [TOWER.x + 2.35, 10, TOWER.z + 2.35], ['flooded']);
    const walk = vis(V.instances(new THREE.BoxGeometry(1.4, 0.12, 2.0), MAT.steel, [{ x: 25.7, y: 2.68, z: 45.0 }]), ['flooded']);
    walk.castShadow = true;
    // valves, gauge, placard on the tower deck
    const valveM = new THREE.MeshStandardMaterial({ color: 0xb8322a, roughness: 0.4, metalness: 0.4 });
    const valve = (ang, r = 0.32) => { const g = new THREE.Group(); const w = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 20), valveM); g.add(w); for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(r * 2, 0.03, 0.03), valveM); s.rotation.z = k * Math.PI / 3; g.add(s); } const px = TOWER.x + Math.cos(ang) * 2.42, pz = TOWER.z + Math.sin(ang) * 2.42; g.position.set(px, 3.9, pz); g.lookAt(TOWER.x + Math.cos(ang) * 4, 3.9, TOWER.z + Math.sin(ang) * 4); vis(g, ['flooded']); return g; };
    const V1 = valve(Math.PI * 0.86), V2 = valve(Math.PI * 1.14), MAIN = valve(Math.PI, 0.55); MAIN.position.y = 3.7;
    const vpos = g => [g.position.x, 3.6, g.position.z];
    const gauge = vis(new THREE.Group(), ['flooded']);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.28, 28), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g) => { g.fillStyle = '#e8e4dc'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.lineWidth = 10; g.strokeStyle = '#3aa050'; g.beginPath(); g.arc(64, 64, 48, Math.PI * 0.75, Math.PI * 1.6); g.stroke(); g.strokeStyle = '#d8a020'; g.beginPath(); g.arc(64, 64, 48, Math.PI * 1.6, Math.PI * 1.95); g.stroke(); g.strokeStyle = '#c8322a'; g.beginPath(); g.arc(64, 64, 48, Math.PI * 1.95, Math.PI * 2.25); g.stroke(); g.fillStyle = '#111'; g.font = '700 18px Rajdhani'; g.fillText('BAR', 50, 100); }, 'm5gauge'), roughness: 0.5 }));
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.01), new THREE.MeshBasicMaterial({ color: 0x111111 })); needle.geometry.translate(0, 0.1, 0.01); dial.add(needle);
    gauge.add(dial); gauge.position.set(TOWER.x - 2.36, 4.6, TOWER.z); gauge.rotation.y = -Math.PI / 2;
    let pressure = 0.93; const setNeedle = () => { needle.rotation.z = -(lerp(-0.75, 1.25, pressure) * Math.PI - Math.PI / 2) + Math.PI; };
    setNeedle();
    const placard = vis(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), new THREE.MeshStandardMaterial({ map: V.placardTex(), roughness: 0.7 })), ['flooded']); placard.position.set(TOWER.x - 2.37, 3.6, TOWER.z - 1.0); placard.rotation.y = -Math.PI / 2 - 0.4;
    // the vortex at the tower foot and the outlet plume (while draining)
    const vortex = vis(new THREE.Mesh(new THREE.RingGeometry(2.5, 6, 48, 1), new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, (g) => { g.translate(128, 128); for (let k = 0; k < 90; k++) { g.rotate(0.21); g.strokeStyle = `rgba(230,240,240,${0.08 + Math.random() * 0.2})`; g.lineWidth = 2 + Math.random() * 3; g.beginPath(); g.arc(0, 0, 40 + Math.random() * 80, 0, 0.9); g.stroke(); } }, 'm5vortex'), transparent: true, depthWrite: false })), ['flooded'], () => S.released && !S.drained);
    vortex.rotation.x = -Math.PI / 2; vortex.position.set(TOWER.x, 2.04, TOWER.z);
    const plume = RZ.waterfall({ top: [29, 4.5, 60.6], height: 7, width: 5, dir: [0, 1], lip: 2.6, speed: 2 }); vis(plume, ['flooded'], () => S.released);
    // the survey buoy over the Keepers' Door
    const buoyM = V.buoy(); vis(buoyM, ['flooded']);
    game.onUpdate((dt, t) => { if (T.current !== 'flooded') return; if (S.drained) { buoyM.position.set(-11.6, hB(-11.6, -6.2) + 0.25, -6.2); buoyM.rotation.set(0.9, 0.4, 0.2); } else { buoyM.position.set(-11.4, 1.9 + Math.sin(t * 1.4) * 0.06, -6.0); buoyM.rotation.set(Math.sin(t * 0.9) * 0.06, t * 0.05, Math.cos(t * 1.1) * 0.06); } buoyM.userData.lamp.material.emissiveIntensity = 2.5 + Math.sin(t * 2) * 0.5; });
    // the north-shore notice: its text depends on whether a levee exists
    const signPost = vis(V.instances(new THREE.BoxGeometry(0.12, 2.4, 0.12), MAT.steel, [{ x: 4.4, y: TY - 0.2, z: -51 }, { x: 6.6, y: TY - 0.2, z: -51 }]), ['flooded']); signPost.castShadow = true;
    const signLines = lev => ['RESERVOIR 7 · NO SWIMMING', 'OUTLET TOWER G-2', 'MANUAL PRESSURE RELEASE AT TOWER ONLY', lev ? 'TOWER ACCESS: ALONG THE OLD LEVEE' : 'TOWER ACCESS: BY BOAT ONLY', 'SURVEY SITE 0 · RESTRICTED'];
    const signA = vis(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: V.signTex(signLines(false), '#e6e2d8', '#1a1c20', 'signBoat', { rust: true }), roughness: 0.7, side: THREE.DoubleSide })), ['flooded'], () => !S.diverted);
    const signB = vis(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: V.signTex(signLines(true), '#e6e2d8', '#1a1c20', 'signLevee', { rust: true }), roughness: 0.7, side: THREE.DoubleSide })), ['flooded'], () => S.diverted);
    for (const s of [signA, signB]) { s.position.set(5.5, TY + 1.65, -50.9); s.rotation.y = 0; }
    // power line from the dam along the east hill
    const poles = []; for (let k = 0; k < 6; k++) poles.push({ x: 39 + k * 0.5, y: hB(39 + k * 0.5, 50 - k * 18) - 0.3, z: 50 - k * 18 });
    vis(V.instances(new THREE.CylinderGeometry(0.12, 0.16, 9, 6), MAT.timberOld, poles.map(p => ({ ...p, y: p.y + 4.5 }))), ['flooded']);
    for (let k = 0; k < 5; k++) { const a = poles[k], b = poles[k + 1]; vis(cableCurve([[a.x, a.y + 8.6, a.z], [(a.x + b.x) / 2, (a.y + b.y) / 2 + 7.2, (a.z + b.z) / 2], [b.x, b.y + 8.6, b.z]], 0.015), ['flooded']); }
    // the caretaker's cottage and garden fence on the west terrace
    const cot = new V.MergeBin();
    cot.add('wall', new THREE.BoxGeometry(5.2, 2.6, 4.2), V.mat4(-27.6, TY + 1.3, 22.4));
    const roofG = new THREE.BoxGeometry(5.8, 0.12, 2.6); cot.add('roof', roofG, V.mat4(-27.6, TY + 2.95, 21.4, 0, 0.28)); cot.add('roof', roofG.clone(), V.mat4(-27.6, TY + 2.95, 23.4, 0, -0.28));
    cot.add('dark', new THREE.BoxGeometry(0.05, 1.9, 0.9), V.mat4(-24.98, TY + 0.95, 21.6)); cot.add('dark', new THREE.BoxGeometry(0.05, 0.9, 1.2), V.mat4(-24.98, TY + 1.6, 23.4));
    cot.add('tank', new THREE.CylinderGeometry(0.7, 0.7, 1.6, 14), V.mat4(-30.7, TY + 0.8, 20.2));
    for (let k = 0; k < 9; k++) cot.add('fence', new THREE.BoxGeometry(0.08, 1.1, 0.08), V.mat4(-18.4, TY + 0.55, 12.5 + k * 1.2));
    cot.add('fence', new THREE.BoxGeometry(0.04, 0.05, 10), V.mat4(-18.4, TY + 0.95, 17.3)); cot.add('fence', new THREE.BoxGeometry(0.04, 0.05, 10), V.mat4(-18.4, TY + 0.5, 17.3));
    vis(cot.build({ wall: mk('plaster', 0xc8ccd0), roof: mk('paintedMetalPanel', 0x8a5a44), dark: MAT.dark, tank: MAT.steel, fence: MAT.timberOld }), ['flooded']);
    col([-30.2, TY - 0.2, 20.3], [-25.0, TY + 2.8, 24.5], ['flooded']);
    const barGeo = V.sweepX(() => 30, -16.8, 24.6, 0.8, (x) => { const g = hB(x, 30) - 0.3; return [[-2.4, Math.min(g, 1.2)], [-1.0, 2.25], [1.0, 2.25], [2.4, Math.min(g, 1.2)]]; });
    vis(new THREE.Mesh(barGeo, MAT.gravel), ['flooded'], () => S.quest).receiveShadow = true;
    // dead trees standing in the reservoir
    const deadSpots = [[-3, -12], [2, 8], [-6, 19], [7.5, -9], [-1, 28], [18, -20], [20.5, 2], [18, 22], [-8, 34], [11, 36]];
    vis(RZ.forest({ species: 'dead', placements: deadSpots.map(([x, z]) => ({ x, z, scale: 0.7 + R() * 0.4 })), heightAt: hB, seed: 13, impostors: false, variants: 2 }), ['flooded']);

    PERF('2049');
    // ======================================================================================
    // vegetation: grass per state, the shared hill forest, village trees, boulders
    // ======================================================================================
    const nz = VAL.nz;
    const inHouse = (x, z) => V.HOUSES.some(h => Math.abs(x - h.x) < h.w / 2 + 0.6 && Math.abs(z - h.z) < h.d / 2 + 0.6);
    const nearLane = (x, z, w) => LANES.some(L => L.some((p, i) => { if (!i) return false; const a = L[i - 1], dx = p[0] - a[0], dz = p[1] - a[1], l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < w; }));
    const wet = (x, z, lvl) => hB(x, z) < lvl;
    const grassMask = st => (x, z) => {
      const h = hB(x, z);
      if (Math.abs(x - (WALL.x0 + WALL.x1) / 2) < 0.8 && z > WALL.z0 && z < WALL.z1) return 0;
      if (st === 'flooded') return h > 2.35 ? Math.max(0, Math.min(1, (nz.fbm2(x * 0.06, z * 0.06, 3) + 0.5) * 1.6)) : 0;
      if (wet(x, z, -0.3)) return 0;
      if (inHouse(x, z)) return st === 'abandoned' ? 0.5 : 0;
      const plaza = Math.hypot((x + 2) / 8.5, (z - 3) / 7.5) < 1;
      if (st === 'thriving') {
        if (plaza || nearLane(x, z, 1.5)) return 0;
        if ((x > -31 && x < -19.5 && ((z > -28.5 && z < -16.5) || (z > 8.5 && z < 22.5))) || Math.hypot(x + 24.5, z - 0.5) < 5) return 0;
        return Math.max(0, Math.min(1, (nz.fbm2(x * 0.07, z * 0.07, 3) + 0.42) * 1.8));
      }
      return Math.max(0, Math.min(1, (nz.fbm2(x * 0.05, z * 0.05, 3) + 0.62) * 1.7)) * (plaza ? 0.7 : 1);
    };
    const grassRect = [-42, -76, 86, 134];
    vis(RZ.instancedGrass({ rect: grassRect, heightAt: hB, mask: grassMask('thriving'), radius: 26, height: 0.38, color: 0x5d7a2c, tipColor: 0xb8b060, seed: 3 }).mesh, ['thriving']);
    vis(RZ.instancedGrass({ rect: grassRect, heightAt: hB, mask: grassMask('abandoned'), radius: 26, height: 0.62, color: 0x667634, tipColor: 0xc4b070, dryColor: 0xa89a60, seed: 4 }).mesh, ['abandoned']);
    vis(RZ.instancedGrass({ rect: grassRect, heightAt: hB, mask: grassMask('flooded'), radius: 26, height: 0.45, color: 0x527230, tipColor: 0xa8a85a, seed: 5 }).mesh, ['flooded']);
    // hills forest (shared): placements outside the playable valley
    const hillTrees = [], hillConifers = [], rr = RZ.rng(77);
    for (let k = 0; k < 1300; k++) {
      const x = -170 + rr() * 340, z = -200 + rr() * 300, h = hB(x, z);
      const inValley = x > -33 && x < 36 && z > -70 && z < 52;
      if (inValley || h < 3.6) continue;
      if (z > 54 && x > 0 && x < 45) continue;
      const d = nz.fbm2(x * 0.02, z * 0.02, 3) + 0.25;
      if (d < 0.1) continue;
      (h > 30 || rr() < 0.4 ? hillConifers : hillTrees).push({ x, z, scale: 0.8 + rr() * 0.6 });
    }
    scene.add(RZ.forest({ species: 'broadleaf', placements: hillTrees, heightAt: hB, focus: [0, 0], lodDistance: 70, seed: 2, budgetScale: 0.45 }));
    scene.add(RZ.forest({ species: 'conifer', placements: hillConifers, heightAt: hB, focus: [0, 0], lodDistance: 70, seed: 5, budgetScale: 0.4 }));
    // village trees: orchard / shade trees (thriving), the forest coming back (abandoned)
    const villageT = [[-12, 30], [6, 20], [10, 28], [-17, 25], [16.5, 4], [17, -12], [-24, -14], [-31, 10], [-6, -26], [22, 26], [23, 10], [-30, -8]];
    vis(RZ.forest({ species: 'broadleaf', placements: villageT.map(([x, z]) => ({ x, z, scale: 0.55 + R() * 0.25 })), heightAt: hB, seed: 7, impostors: false, variants: 2, focus: [0, 0] }), ['thriving']);
    const wildT = [...villageT, [-2, 0], [-6, 8], [1, -9], [-4, 20], [-20, 6], [-26, -20], [-22, 18], [13, 18], [-11, -24], [3, 30], [-16, -30], [5, -22]];
    vis(RZ.forest({ species: 'broadleaf', placements: wildT.map(([x, z]) => ({ x: x + 0.5, z, scale: 0.6 + R() * 0.45 })), heightAt: hB, seed: 9, impostors: false, variants: 2, focus: [0, 0] }), ['abandoned']);
    vis(RZ.forest({ species: 'shrub', placements: Array.from({ length: 30 }, () => ({ x: -30 + R() * 50, z: -30 + R() * 62, scale: 0.6 + R() * 0.6 })).filter(p => !inHouse(p.x, p.z) && hB(p.x, p.z) > -0.2), heightAt: hB, seed: 10, impostors: false, variants: 2 }), ['abandoned']);
    // boulders along the escarpment and the banks (shared)
    const bould = [];
    for (let k = 0; k < 46; k++) { const x = -12 + R() * 48, z = -44.2 - R() * 3.6; if (Math.abs(x - VAL.A(z)) < 4.5 || Math.abs(x - VAL.B(z)) < 4.5 || (x > 16 && x < 25)) continue; bould.push({ x, z, scale: 0.9 + R() * 1.8 }); }
    for (let k = 0; k < 30; k++) { const z = -40 + R() * 90, side = R() < 0.5 ? -1 : 1, x = VAL.A(z) + side * (4.4 + R() * 1.5); if (inHouse(x, z) || x < 8) continue; bould.push({ x, z, scale: 0.4 + R() * 0.7 }); }
    scene.add(RZ.rocks({ placements: bould, heightAt: hB, seed: 3, moss: 0.4 }));

    PERF('vegetation');
    // ======================================================================================
    // the tunnel and the machine chamber (under the terrace)
    // ======================================================================================
    const inner = new THREE.Group(); scene.add(inner);
    const ib = new V.MergeBin();
    const zc = doorMid, zw = (DOOR.z1 - DOOR.z0) / 2;
    ib.add('cave', new THREE.BoxGeometry(5.9, 0.3, 2.6), V.mat4(-16.2, -0.15, zc));
    for (const s of [-1, 1]) ib.add('cave', new THREE.BoxGeometry(11.6, 3.2, 0.3), V.mat4(-19.0, 0.6, zc + s * (zw + 0.15)));
    ib.add('cave', new THREE.BoxGeometry(5.9, 0.3, 2.6), V.mat4(-16.2, 2.45, zc));
    for (let k = 0; k < 11; k++) { const x = -19.25 - k * 0.5, y = -0.27 - k * 0.27; ib.add('cave', new THREE.BoxGeometry(0.5, 0.3, 2.0), V.mat4(x, y - 0.15, zc)); }
    ib.add('cave', new THREE.BoxGeometry(6.2, 0.3, 2.6), V.mat4(-21.75, 2.45 - 1.4, zc, 0, 0, -0.5));
    ib.add('cave', new THREE.BoxGeometry(CH.x1 - CH.x0, 0.3, CH.z1 - CH.z0), V.mat4((CH.x0 + CH.x1) / 2, CH.floor - 0.15, (CH.z0 + CH.z1) / 2));
    ib.add('cave', new THREE.BoxGeometry(CH.x1 - CH.x0 + 0.6, 0.3, CH.z1 - CH.z0 + 0.6), V.mat4((CH.x0 + CH.x1) / 2, CH.ceil + 0.15, (CH.z0 + CH.z1) / 2));
    const wallH = CH.ceil - CH.floor;
    ib.add('cave', new THREE.BoxGeometry(0.4, wallH, CH.z1 - CH.z0), V.mat4(CH.x0 - 0.2, CH.floor + wallH / 2, (CH.z0 + CH.z1) / 2));
    for (const [za, zb] of [[CH.z0, DOOR.z0], [DOOR.z1, CH.z1]]) ib.add('cave', new THREE.BoxGeometry(0.4, wallH, zb - za), V.mat4(CH.x1 + 0.2, CH.floor + wallH / 2, (za + zb) / 2));
    ib.add('cave', new THREE.BoxGeometry(0.4, wallH - 2.6, DOOR.z1 - DOOR.z0), V.mat4(CH.x1 + 0.2, CH.floor + 2.6 + (wallH - 2.6) / 2, zc));
    for (const z of [CH.z0 - 0.2, CH.z1 + 0.2]) ib.add('cave', new THREE.BoxGeometry(CH.x1 - CH.x0 + 0.8, wallH, 0.4), V.mat4((CH.x0 + CH.x1) / 2, CH.floor + wallH / 2, z));
    for (const [x, z] of [[-27.5, -10], [-27.5, -2]]) ib.add('cave', new THREE.CylinderGeometry(0.42, 0.5, wallH, 10), V.mat4(x, CH.floor + wallH / 2, z));
    const innerMesh = ib.build({ cave: MAT.cave }); inner.add(innerMesh); innerMesh.children.forEach(m => game.blocker(m));
    // colliders: tunnel sides, chamber walls, pillars
    for (const s of [-1, 1]) col([-24.6, -4, zc + s * zw + (s > 0 ? 0 : -0.3)], [-13.4, 2.4, zc + s * zw + (s > 0 ? 0.3 : 0)]);
    col([CH.x0 - 0.4, -4, CH.z0], [CH.x0, 2.4, CH.z1]); col([CH.x0, -4, CH.z0 - 0.4], [CH.x1, 2.4, CH.z0]); col([CH.x0, -4, CH.z1], [CH.x1, 2.4, CH.z1 + 0.4]);
    col([CH.x1, -4, CH.z0], [CH.x1 + 0.4, 2.4, DOOR.z0]); col([CH.x1, -4, DOOR.z1], [CH.x1 + 0.4, 2.4, CH.z1]);
    for (const [x, z] of [[-27.5, -10], [-27.5, -2]]) col([x - 0.5, -4, z - 0.5], [x + 0.5, 2.4, z + 0.5]);
    // carvings: the keepers' account of the machine (all states)
    const carve = canvasTex(1024, 256, (g, w, h) => {
      g.fillStyle = '#6a5e4e'; g.fillRect(0, 0, w, h); const r = rng(5); for (let k = 0; k < 3000; k++) { g.fillStyle = `rgba(${r() < 0.5 ? 20 : 200},${r() < 0.5 ? 20 : 180},10,${r() * 0.07})`; g.fillRect(r() * w, r() * h, 3, 3); }
      g.strokeStyle = 'rgba(30,20,12,0.85)'; g.lineWidth = 5;
      for (let k = 0; k < 4; k++) { const x = 90 + k * 250; g.beginPath(); g.arc(x, 120, 50, 0, 7); g.stroke(); g.beginPath(); g.arc(x, 120, 12, 0, 7); g.stroke(); const fx = x + 90; g.beginPath(); g.arc(fx, 70, 10, 0, 7); g.moveTo(fx, 80); g.lineTo(fx, 150); g.moveTo(fx, 100); g.lineTo(fx - 30, 115); g.moveTo(fx, 150); g.lineTo(fx - 14, 200); g.moveTo(fx, 150); g.lineTo(fx + 14, 200); g.stroke(); g.strokeStyle = 'rgba(30,140,160,0.8)'; g.beginPath(); g.arc(fx - 32, 116, 7, 0, 7); g.stroke(); g.strokeStyle = 'rgba(30,20,12,0.85)'; }
      for (let k = 0; k < 16; k++) { g.beginPath(); g.moveTo(30 + k * 18, 230); g.lineTo(30 + k * 18, 250); g.stroke(); }
    }, 'm5carve');
    for (const z of [CH.z0 + 0.02, CH.z1 - 0.02]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 2.1), new THREE.MeshStandardMaterial({ map: carve, roughness: 0.95 })); m.position.set((CH.x0 + CH.x1) / 2, -1.0, z); m.rotation.y = z < -6 ? 0 : Math.PI; inner.add(m); }
    // the machine against the west wall
    const MX = -32.2, MY = -0.85, MZ = -6;
    const mach = V.machine(); mach.position.set(MX, MY, MZ); mach.rotation.y = Math.PI / 2; inner.add(mach);
    col([MX - 0.8, -4, MZ - 3.3], [MX + 0.8, 2.4, MZ + 3.3]);
    const console_ = new THREE.Group(); console_.position.set(-29.4, CH.floor, MZ); inner.add(console_);
    console_.add(V.instances(new THREE.BoxGeometry(0.7, 1.05, 1.3), new THREE.MeshPhysicalMaterial({ color: 0x15171b, metalness: 0.7, roughness: 0.3, clearcoat: 0.6 }), [{ x: 0, y: 0, z: 0 }]));
    const glyphScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x050403, emissive: 0xffb060, emissiveIntensity: 0.9, emissiveMap: canvasTex(256, 128, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#fff'; g.lineWidth = 3; const r = rng(3); for (let k = 0; k < 14; k++) { const x = 14 + k * 17; g.beginPath(); g.moveTo(x, 30 + r() * 20); g.lineTo(x + 8, 40 + r() * 30); g.lineTo(x + 2, 90 + r() * 20); g.stroke(); } g.beginPath(); g.arc(128, 64, 18, 0, 7); g.stroke(); }, 'm5glyphs') }));
    glyphScreen.position.set(0.36, 1.12, 0); glyphScreen.rotation.set(0, Math.PI / 2, 0); glyphScreen.rotation.x = 0; console_.add(glyphScreen); glyphScreen.rotation.z = 0; glyphScreen.rotateX(-0.5);
    col([-29.8, -4, MZ - 0.7], [-29.0, 2.4, MZ + 0.7]);
    // state dressing inside: offerings + lamps (thriving), roots (abandoned), Helix survey kit (2049)
    const offerings = []; for (let k = 0; k < 10; k++) { const a = -1.2 + k * 0.27; offerings.push({ x: MX + 1.8 + Math.cos(a) * 1.3, y: CH.floor, z: MZ + Math.sin(a) * 3.4, s: 0.55 + R() * 0.3, ry: R() * 6 }); }
    const offT = V.instances(jarG, clay, offerings); offT.userData.m5states = ['thriving']; inner.add(offT);
    const offA = V.instances(jarG, clay, offerings.map(o => ({ ...o, rx: 1.4, y: o.y + 0.1 }))); offA.userData.m5states = ['abandoned']; inner.add(offA);
    const lampsT = V.instances(new THREE.SphereGeometry(0.07, 8, 6), glowMat(0xffb060, 4), [{ x: -26, y: -1.4, z: CH.z0 + 0.3 }, { x: -30, y: -1.4, z: CH.z0 + 0.3 }, { x: -26, y: -1.4, z: CH.z1 - 0.3 }, { x: -30, y: -1.4, z: CH.z1 - 0.3 }]); lampsT.userData.m5states = ['thriving']; inner.add(lampsT);
    const rootM = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 });
    const roots = new THREE.Group(); roots.userData.m5states = ['abandoned', 'flooded']; inner.add(roots);
    for (let k = 0; k < 9; k++) { const x = CH.x0 + 1 + R() * 8, z = CH.z0 + 1 + R() * 11; roots.add(cableCurve([[x, CH.ceil, z], [x + (R() - 0.5), CH.ceil - 1.2, z + (R() - 0.5)], [x + (R() - 0.5) * 2, CH.floor + 0.4 + R() * 2, z + (R() - 0.5) * 2]], 0.04 + R() * 0.04, rootM)); }
    const helixKit = new THREE.Group(); helixKit.userData.m5states = ['flooded']; inner.add(helixKit);
    const crateM = pbr('paintedMetalPanel', { mapping: 'object', params: P.paintedMetalPanel, tint: 0x3a9cc4 });
    helixKit.add(V.instances(new THREE.BoxGeometry(1.1, 0.7, 0.8), crateM, [{ x: -25.6, y: CH.floor + 0.35, z: CH.z0 + 1.0, ry: 0.2 }, { x: -25.8, y: CH.floor + 1.05, z: CH.z0 + 1.1, ry: 0.5, s: 0.8 }]));
    for (const [x, z] of [[-27.0, -11.4], [-27.0, -0.6]]) { const lamp = new THREE.Group(); lamp.position.set(x, CH.floor, z); lamp.add(V.instances(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 5), MAT.steel, [{ x: 0, y: 0.9, z: 0 }])); const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.12), glowMat(0xdff4ff, 3.5)); head.position.y = 1.85; head.lookAt(new THREE.Vector3(MX - x, 0.5, MZ - z).add(lamp.position)); lamp.add(head); helixKit.add(lamp); }
    helixKit.add(cableCurve([[-26.6, CH.floor + 0.02, -11.2], [-29, CH.floor + 0.02, -8.6], [MX + 0.7, CH.floor + 0.3, MZ - 1.2], [MX + 0.4, MY, MZ - 0.4]], 0.035));
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.32), new THREE.MeshStandardMaterial({ map: V.surveyTagTex('BRANDT'), roughness: 0.4, side: THREE.DoubleSide }));
    tag.position.set(MX + 0.75, MY - 1.25, MZ + 1.6); tag.rotation.y = Math.PI / 2 - 0.3; helixKit.add(tag);
    const machLight = new THREE.PointLight(0xffb060, 0, 14, 1.7); machLight.position.set(MX + 2.2, MY, MZ); scene.add(machLight);
    const workLight = new THREE.PointLight(0xdff4ff, 0, 16, 1.6); workLight.position.set(-26.6, 0.9, -6); scene.add(workLight);
    const dust = RZ.particles({ kind: 'dust', count: 160, center: [-29, -1, -6], area: [9, 4.5, 12], color: 0xffe6c4, size: 0.02, opacity: 0.45 }); inner.add(dust);
    const machineTune = () => {
      const st = T.current, coreOn = st !== 'flooded';
      mach.userData.core.visible = coreOn; mach.userData.clamp.visible = !coreOn;
      mach.userData.seamM.emissive.set(coreOn ? 0xffb060 : 0x5fe6ff); mach.userData.seamM.emissiveIntensity = coreOn ? 1.7 : 0.45;
      glyphScreen.material.emissive.set(coreOn ? 0xffb060 : 0x5fe6ff); glyphScreen.material.emissiveIntensity = coreOn ? 1.0 : 0.25;
      machLight.color.set(coreOn ? 0xffa850 : 0x5fe6ff); machLight.intensity = inner.visible ? (coreOn ? 18 : 3) : 0;
      workLight.intensity = inner.visible && st === 'flooded' ? 14 : 0;
      inner.traverse(o => { if (o.userData.m5states) o.visible = o.userData.m5states.includes(st); });
    };
    let interiorView = false;
    game.onUpdate((dt, t) => {
      const p = game.player.pos, near = interiorView || (p.x < -10 && p.x > -36 && p.z > -16 && p.z < 4 && p.y < 2.6);
      if (near !== inner.visible) { inner.visible = near; innerMesh.children.forEach(m => { m.visible = near; }); machineTune(); }
      if (inner.visible) mach.userData.update(t);
    });
    inner.visible = false; innerMesh.children.forEach(m => { m.visible = false; });

    PERF('interior');
    // ======================================================================================
    // characters
    // ======================================================================================
    const kai = game.player.char;
    const niko = game.actor('niko', null, -27.5, TY, 31.5, Math.PI);
    const tala = game.actor('tala', null, 7.8, 0, 5.5, Math.PI / 2); vis(tala.root, ['thriving']);
    const ama = game.actor('caretaker', null, -23.6, TY, 19.6, Math.PI / 2 + 0.3); vis(ama.root, ['flooded']); V.dressCaretaker(ama);
    const potter = game.actor('potter', null, -22.8, TY, -1.6, -Math.PI / 2); vis(potter.root, ['thriving']);
    const walkers = [];
    const crowd = (lane, look) => { const w = new Walker(game, look || ancientLook(R), lane); w.c.root.position.y = VAL.hBase(lane.x, lane.z0); vis(w.c.root, ['thriving']); walkers.push(w); return w; };
    // lanes run between the houses (checked against V.HOUSES); everyone stands on the terrain
    crowd({ x: -4.2, z0: -12, z1: 12, speed: 0.9 }); crowd({ x: 1.0, z0: 20, z1: -6, speed: 1.0 }); crowd({ x: -5.6, z0: -10, z1: 10, speed: 0.8 });
    crowd({ x: -25.5, z0: -26, z1: -18, speed: 0.6 }); crowd({ x: -23, z0: 10, z1: 21, speed: 0.7 });
    // by the fire on log seats, at the water steps, the kiln yard, a house door, and a woman weeding the south field
    const SIT = [[-2.45, 6.55, Math.PI / 2 + 0.25], [-1.55, 7.45, Math.PI - 0.2], [-1.9, 4.75, 0.3]];
    for (const [x, z, ry] of SIT) crowd({ x, z0: z, z1: z, idle: true, ry }).c.pose = 'sit';
    const seats = SIT.map(([x, z, ry]) => ({ x: x - Math.sin(ry) * 0.12, y: VAL.hBase(x, z) + 0.2, z: z - Math.cos(ry) * 0.12, ry: ry + Math.PI / 2 }));
    { const sg = new THREE.CylinderGeometry(0.21, 0.23, 1.1, 9); sg.rotateZ(Math.PI / 2); vis(V.instances(sg, MAT.timber, seats), ['thriving']); }
    for (const [x, z, ry, pose] of [[8.4, 4.0, 1.4, 'talk'], [-24.4, -3.0, 2.0, 'work'], [-6.3, -12.6, 2.6, 'look'], [-28, 14, 1.2, 'work']]) crowd({ x, z0: z, z1: z, idle: true, ry }).c.pose = pose;
    crowd({ x: -3.0, z0: -10, z1: 1, speed: 1.7 }, ancientLook(R, { height: 1.12, build: 0.8, child: true }));
    crowd({ x: 2.0, z0: 0, z1: 9, speed: 1.6 }, ancientLook(R, { height: 1.2, build: 0.8, child: true }));
    game.onUpdate(dt => { if (T.current !== 'thriving') return; for (const w of walkers) { w.update(dt); const p = w.c.root.position; p.y = VAL.hBase(p.x, p.z); } });
    // the work crew at the head works (thriving)
    for (const [x, z, ry] of [[B55 + 5.6, -52.6, -1.2], [B55 + 6.2, -50.2, -1.6], [B55 + 5.0, -48.4, -2.2]]) { const c = game.ambient(ancientLook(R, { lod: true }), x, TY, z, ry); c.pose = 'work'; vis(c.root, ['thriving']); }
    // residue echoes (abandoned): the last families leaving with their jars
    const echoes = [];
    for (let k = 0; k < 3; k++) { const w = new Walker(game, ancientLook(R), { x: 0.4 + k * 0.6, z0: -8 + k * 2, z1: 20, speed: 0.55 }); w.c.setGhost(0x9fe8ff); resid(w.c.root, 'abandoned'); echoes.push(w); }
    game.onUpdate(dt => { if (game.residueOn && T.current === 'abandoned') for (const w of echoes) { w.update(dt); const p = w.c.root.position; p.y = VAL.hBase(p.x, p.z); } });

    // ---------- Niko follows Kai across every transition (breadcrumb trail) ----------
    const trail = []; let nIdx = 0, nikoFollow = false;
    const resetTrail = () => { trail.length = 0; nIdx = 0; };
    game.onUpdate(dt => {
      const p = game.player.pos, last = trail[trail.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 0.45) { trail.push({ x: p.x, z: p.z }); if (trail.length > 500) { trail.shift(); nIdx = Math.max(0, nIdx - 1); } }
      if (!nikoFollow) return;
      const n = niko.root.position, dK = Math.hypot(p.x - n.x, p.z - n.z);
      if ((dK > 26 || Math.abs(p.y - n.y) > 4) && trail.length) { const b = trail[Math.max(0, trail.length - 6)]; n.set(b.x, groundAt(b.x, b.z, p.y + 0.5), b.z); nIdx = trail.length - 6; }
      if (dK < 2.1) { niko.speed = 0; niko.faceTowards(p.x, p.z, dt, 4); }
      else {
        nIdx = Math.min(Math.max(nIdx, 0), trail.length - 1);
        let tgt = trail[nIdx];
        while (nIdx < trail.length - 1 && Math.hypot(tgt.x - n.x, tgt.z - n.z) < 0.35) tgt = trail[++nIdx];
        const sp = dK > 7 ? 4.6 : dK > 3.5 ? 3.1 : 1.8, dx = tgt.x - n.x, dz = tgt.z - n.z, dd = Math.hypot(dx, dz) || 1, step = Math.min(dd, sp * dt);
        n.x += dx / dd * step; n.z += dz / dd * step; niko.speed = sp; niko.faceTowards(tgt.x, tgt.z, dt, 8);
      }
      const gy = groundAt(n.x, n.z, n.y + 0.5); n.y += (gy - n.y) * Math.min(1, dt * 12);
      if (dK < 0.55) { n.x += (n.x - p.x) / Math.max(dK, 0.01) * 0.02; n.z += (n.z - p.z) / Math.max(dK, 0.01) * 0.02; }
    });

    PERF('characters');
    // ======================================================================================
    // the ground under Kai: terrain + features, walkability (banks, deep water, bounds), snapping
    // ======================================================================================
    const groundBox = game.collision.add([0, -60, 0], [0, -59, 0], { walkOnly: true });
    const lastGood = new THREE.Vector3().copy(game.player.pos); let barkT = 0;
    const inBounds = (x, z, y) => (inInterior(x, z) && y < 2.45) || (x > -33.6 && x < 36 && z > -71 && z < (T.current === 'flooded' ? 52.5 : 53.5));
    game.onUpdate(dt => {
      const P = game.player, p = P.pos, v = P.vel; barkT -= dt;
      if (p.distanceTo(lastGood) > 4) { lastGood.copy(p); p.y = Math.max(p.y, groundAt(p.x, p.z, p.y + 0.3)); }
      const interior = inInterior(p.x, p.z) && p.y < 2.45;
      const g = groundAt(p.x, p.z, p.y + 0.3);
      let bad = !inBounds(p.x, p.z, p.y) || g - p.y > 0.5 || (T.current === 'flooded' && !S.wall && !interior && p.x > WALL.x0 - 0.3 && p.x < -6 && Math.abs(p.z + 4.5) < 8);
      if (!bad && !interior) {
        const w = waterAt(p.x, p.z); if (w - g > 0.82) { bad = true; if (barkT <= 0) { barkT = 6; ui.subtitle('kai', T.current === 'flooded' && !S.drained ? 'Too deep. I\'d never make it across.' : 'The current\'s too strong there.', 2400); } }
        if (!bad && featureH(p.x, p.z) < terrainH(p.x, p.z)) {
          const e = 0.4, gx = (terrainH(p.x + e, p.z) - terrainH(p.x - e, p.z)) / (2 * e), gz = (terrainH(p.x, p.z + e) - terrainH(p.x, p.z - e)) / (2 * e);
          if (Math.hypot(gx, gz) > 1.25 && gx * (p.x - lastGood.x) + gz * (p.z - lastGood.z) > 0) bad = true;
        }
      }
      if (bad) { p.x = lastGood.x; p.z = lastGood.z; if (p.y < lastGood.y - 0.8) p.y = lastGood.y; v.x = 0; v.z = 0; }
      const g2 = groundAt(p.x, p.z, p.y + 0.3);
      if (v.y <= 0.01 && p.y - g2 < 0.35 && p.y - g2 > -0.75) { p.y = g2; v.y = 0; P.grounded = true; }
      if (!bad && P.grounded) lastGood.copy(p);
      groundBox.min.set(p.x - 2, g2 - 60, p.z - 2); groundBox.max.set(p.x + 2, g2, p.z + 2);
    });

    // ======================================================================================
    // temporal states
    // ======================================================================================
    const BEDS = { thriving: [0.2, 0.12, 0.07, 0], abandoned: [0.09, 0.32, 0, 0], flooded: [0.13, 0.2, 0, 0.035] };
    const beds = st => { const [w, wi, cr, hu] = BEDS[st]; audio.water(w); audio.wind(wi); audio.crowd(cr); audio.hum(hu, 50); };
    const wetLevel = { thriving: -0.6, abandoned: -0.45, flooded: 2.0 };
    const stateDef = (id, key, name, year, glyph, color, theme) => ({ id, key, name, year, glyph, color, theme, apply: () => { applySky(id); beds(id); terCfg.x = wetLevel[id]; refreshWorld(); machineTune(); } });
    T.configure([
      stateDef('thriving', '1', 'THRIVING', 'c. 1000 BCE', '◐', '#ffb060', 'm5thrive'),
      stateDef('abandoned', '2', 'ABANDONED', 'c. 400 CE', '◒', '#c8d08a', 'm5empty'),
      stateDef('flooded', '3', 'FLOODED', '2049 · RESERVOIR 7', '◑', '#5fe6ff', 'm5drowned'),
    ], 'thriving');
    T.onSwitch(() => { refreshWorld(); machineTune(); });
    // residue vision toggles show only this state's echoes
    let lastRes = false; game.onUpdate(() => { if (game.residueOn !== lastRes) { lastRes = game.residueOn; refreshWorld(); } });
    const restoreTheme = () => audio.setTheme(T.def()?.theme || 'm5thrive');
    const stinger = () => { audio.tone(55, 2.4, 'sine', 0.35); audio.tone(82.4, 2.0, 'triangle', 0.08); audio.sfxPlay('anomaly'); audio.silence(0.5); };
    const rewrite = (msg) => { stinger(); game.shake = 0.08; setTimeout(() => { game.shake = 0; }, 500); ui.toast(msg || 'CAUSAL CHANGE · THE LATER STATES HAVE BEEN REWRITTEN', 4200); refreshWorld(); };

    // ======================================================================================
    // script helpers
    // ======================================================================================
    let busy = false;
    const queue = [];
    const cinematic = (fn) => { queue.push(fn); };
    game.onUpdate(() => {
      if (busy || !queue.length || !game.control || game.ui.dlgActive) return;
      const fn = queue.shift(); busy = true;
      (async () => { try { await fn(); } catch (e) { if (!e.abort) console.error(e); } busy = false; })();
    });
    const until = (pred) => game.waitFor(() => !busy && pred());
    const enter = async (shotPos, look, dur = 1.4, fov = 45) => { game.control = false; ui.letterbox(true); T.locked = true; nikoFollow = false; if (shotPos) await game.shot(shotPos, look, dur, { fov }); };
    const leave = () => { game.releaseCam(); ui.letterbox(false); T.locked = false; game.control = true; resetTrail(); nikoFollow = true; };
    const placeNiko = (x, z, ry) => { niko.root.position.set(x, groundAt(x, z, game.player.pos.y + 0.5), z); niko.root.rotation.y = ry ?? niko.root.rotation.y; niko.speed = 0; };
    const nearK = (x, z, r) => Math.hypot(game.player.pos.x - x, game.player.pos.z - z) < r;
    let objText = '', hintT = 0;
    const objective = (t) => { objText = t; hintT = 0; game.objective(t); };
    const mark = b => b ? '●' : '○';
    const mainObjective = () => {
      if (S.diverted && S.wall) return S.released ? (S.hatch ? 'Find what the Keepers\' Door was hiding' : 'Walk down into the drained village. Open the Keepers\' Door') : 'Walk the levee to the outlet tower (2049) and release the pressure gate';
      return `Open the way to the Keepers' Door — ${mark(S.diverted)} a way to the outlet tower (2049) · ${mark(S.wall)} the terrace wall must not fall (c. 400 CE)`;
    };
    const HINTS = () => {
      if (!S.toured) return null;
      if (!S.diverted && !S.sign) return 'In your time there is a tower in the water. There must be a sign that says how to reach it.';
      if (!S.diverted) return T.current === 'thriving' ? 'Tala said the river once ran east. The head works are up on the shelf, where the river splits.' : 'Go back to my time, Kai. The river is still young there.';
      if (!S.wall && S.drains < 3) return T.current === 'abandoned' ? 'The wall is weeping nowhere. In my time those little holes run with water after rain.' : 'The wall above the door. Look at it in the empty years.';
      if (!S.wall) return 'The roofs have fallen. Their beams are lying in the ruins.';
      if (!S.released) return 'Your tower. Walk the old levee — it starts where the east ramp meets the water.';
      if (!S.hatch) return 'The door. It is out of the water now.';
      return null;
    };
    game.onUpdate(dt => { if (!game.control || ui.dlgActive || busy) return; hintT += dt; if (hintT > 85) { hintT = 0; const h = HINTS(); if (h) ui.subtitle('niko', h, 4600); } });
    const act = (o) => game.interact({ once: false, radius: 2.4, ...o });
    const done = (it) => game.removeInteract(it);
    const safe = fn => async (...a) => { try { await fn(...a); } catch (e) { if (!e.abort) console.error(e); } };

    // ======================================================================================
    // collectibles: temporal shards
    // ======================================================================================
    const SHARDS = [
      { st: 'thriving', p: [20.9, 3.75, -50.2], note: 'The head works, where the river chooses.' },
      { st: 'thriving', p: [-20.6, 3.7, 1.0], note: 'Warm from the kilns. It hums like the Water Ring.' },
      { st: 'abandoned', p: [-6.0, 0.7, 12.2], note: 'Among the empty houses. It remembers voices.' },
      { st: 'abandoned', p: [9.4, 0.7, -2.4], note: 'Caught in the waterwheel\'s broken frame.' },
      { st: 'flooded', p: [-19.0, 3.8, 24.4], note: 'On the caretaker\'s fence. She thinks it is sea glass.' },
      { st: 'flooded', p: [17.4, 0.6, 12.0], note: 'In the mud where the footbridge stood. Only out of the water once it drains.', cond: () => S.drained },
    ];
    SHARDS.forEach((s, i) => {
      const m = shardFor(s);
      const it = act({ pos: s.p, radius: 1.8, states: [s.st], prompt: 'Take the temporal shard', enabled: () => !s.cond || s.cond(), onUse: () => {
        if (T.current !== s.st || (s.cond && !s.cond())) return;
        done(it); m.userData.taken = true; refreshWorld(); S.shards++; F.m5_shards = S.shards; audio.sfxPlay('anomaly'); audio.sfxPlay('pickup');
        ui.toast(`TEMPORAL SHARD ${S.shards}/6\n${s.note}`, 4200);
        if (S.shards === 6) ui.addEvidence('Six shards of one valley', 'Every shard resonates at the Water Ring\'s frequency, whatever century it was found in. The valley is one object seen three times.', 'THE VILLAGE · SHARDS');
      } });
      void i;
    });
    function shardFor(s) { const m = V.shardMesh(s.st === 'flooded' ? 0x9fe8ff : s.st === 'abandoned' ? 0xd8f0a0 : 0xffd090); m.position.set(...s.p); vis(m, [s.st], () => !m.userData.taken && (!s.cond || s.cond())); game.onUpdate((dt, t) => { if (m.visible) { m.rotation.y += dt; m.position.y = s.p[1] + Math.sin(t * 2 + s.p[0]) * 0.06; } }); return m; }

    // ======================================================================================
    // optional: Tala & Niko's water (quest chain B), the potter, the caretaker, echoes, memorial
    // ======================================================================================
    let questStarted = false, muralRead = false;
    const GATES = VAL.FEED.map((fz, i) => {
      const x = -31.0, z = fz;
      const g = new THREE.Group(); g.position.set(x + 0.5, TY - 0.25, z); vis(g, ['thriving']);
      for (const s of [-1, 1]) g.add(V.instances(new THREE.BoxGeometry(0.3, 1.1, 0.3), MAT.foot, [{ x: 0, y: 0, z: s * 0.6 }]));
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.95), MAT.foot); slab.castShadow = true; g.add(slab); g.userData.slab = slab;
      // water marks painted on the gate posts: blue hands for the fields, a red barred hand at the kilns
      const markT = canvasTex(64, 64, (c) => { c.fillStyle = i === 1 ? '#a8281c' : '#2f7fa0'; c.beginPath(); c.arc(32, 36, 14, 0, 7); c.fill(); for (let f = 0; f < 4; f++) c.fillRect(20 + f * 7, 8, 5, 20); if (i === 1) { c.strokeStyle = '#a8281c'; c.lineWidth = 6; c.beginPath(); c.moveTo(6, 6); c.lineTo(58, 58); c.stroke(); } }, 'm5mark' + (i === 1 ? 'no' : 'yes'));
      const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshStandardMaterial({ map: markT, transparent: true, roughness: 0.9 })); mk.position.set(0.16, 0.25, 0.6); mk.rotation.y = Math.PI / 2; g.add(mk);
      return g;
    });
    const setGates = () => GATES.forEach((g, i) => { g.userData.slab.position.y = S.gates[i] ? 0.85 : 0.1; });
    setGates();
    GATES.forEach((g, i) => act({ pos: [g.position.x + 0.6, TY + 0.9, g.position.z], radius: 2.0, states: ['thriving'], prompt: ['Move the north field gate', 'Move the kiln yard gate', 'Move the south field gate'][i], enabled: () => questStarted && !S.quest, onUse: safe(async () => {
      if (!questStarted || S.quest || T.current !== 'thriving') return;
      S.gates[i] = !S.gates[i]; setGates(); refreshWorld(); audio.sfxPlay('door');
      if (S.gates[1]) ui.subtitle('potter', 'The kilns! You are drowning my kilns!', 2600);
      if (S.gates[0] && !S.gates[1] && S.gates[2]) {
        S.quest = true; F.m5_waterQuest = true; audio.sfxPlay('success'); refreshWorld();
        objective(mainObjective());
        cinematic(async () => {
          await enter([-25, TY + 4.5, -12], [-25, TY, 2], 2.2, 50);
          await game.talk([['tala', 'The barley drinks. The kilns stay dry. The water went where it remembered to go.'], ['potter', 'Keeper\'s guest, I will fire you a cup.']]);
          ui.addEvidence('The water that remembers', 'Kai and Tala re-set the three stone gates of the terrace leat: both fields watered, the potters\' yard spared. Tala\'s mural at the water steps tells the river\'s history.', 'THE UPPER TERRACE');
          leave(); ui.toast('Read Tala\'s mural at the water steps', 3500);
        });
      } else ui.toast(`GATES  ${S.gates.map((o, k) => (o ? '▮' : '▯') + ' ' + ['north field', 'kilns', 'south field'][k]).join('   ')}`, 3000);
    }) }));
    act({ pos: [-22.8, TY + 1.4, -1.6], radius: 2.6, states: ['thriving'], prompt: 'Talk to Iru the potter', onUse: () => ui.subtitle('potter', S.quest ? 'The yard is dry for the first time this season. The cup will be ready when you come back. Whenever that is.' : 'The leat floods my yard and the barley dies of thirst. The gates are marked, but nobody reads marks anymore.', 4200) });
    // Tala: the water quest hook (after the first conversation)
    act({ pos: [7.8, 1.5, 5.5], radius: 2.6, states: ['thriving'], prompt: 'Ask Tala about the fields', enabled: () => S.metTala && !questStarted && !busy && S.toured && !talaAtHead, onUse: safe(async () => {
      if (questStarted || busy) return; busy = true;
      try {
        await enter([5.2, 1.9, 8.2], [7.8, 1.6, 5.5], 1.2, 42);
        tala.lookTarget = kai.head;
        await game.talk([
          ['tala', 'The spring under the cliff feeds the upper fields. Three stone gates decide where it goes.'],
          ['tala', 'This season the barley is dry and the kilns are flooded. Someone set the gates with their eyes closed.'],
          ['niko', 'The marks are on the posts. Blue for the fields. Red for the houses.'],
          ['kai', 'Water the barley, spare the kilns. I can do that.'],
        ]);
        questStarted = true; ui.toast('OPTIONAL · THE WATER THAT REMEMBERS\nSet the three stone gates on the upper terrace leat', 5000);
      } finally { tala.lookTarget = null; leave(); busy = false; }
    }) });
    act({ pos: [6.4, 1.3, 1.9], radius: 2.4, states: ['thriving'], prompt: 'Read Tala\'s mural', enabled: () => !talaAtHead, onUse: safe(async () => {
      if (busy) return;
      if (muralRead) { ui.subtitle('kai', 'The first road, the hungry road, the road that stays. Seventeen stars along the top.', 3600); return; }
      busy = true;
      try {
        muralRead = true; await enter([4.4, 1.6, 0.6], [6.3, 1.3, 1.9], 1.2, 40);
        tala.root.position.set(5.6, 0, 3.4); tala.lookTarget = kai.head; placeNiko(4.4, 3.2, Math.PI * 0.8);
        await game.talk([
          ['tala', 'You ask where the river began. We ask who taught it to stay.'],
          ['kai', 'A river cannot remember.'],
          ['niko', 'Then you have not listened long enough.'],
        ]);
        if (S.quest) {
          await game.talk([
            ['niko', 'Look at the top of the mural. Seventeen stars in a row, and they rise over the east notch.'],
            ['niko', 'The same count is cut into the steps of the old observatory, beyond the ridge. Whoever made this was counting the same thing.'],
            ['kai', 'Counting arrivals.'],
          ]);
          F.nikoObservatoryClue = true;
          ui.addEvidence('Seventeen stars over the east notch', 'Tala\'s mural counts seventeen stars rising over the east notch, the same count cut into the old observatory\'s steps. Niko: the observatory is beyond the ridge.', 'WATER STEPS · MURAL');
        }
        ui.addEvidence('The river\'s three roads', 'Tala\'s mural: the first road ran east; a rockfall turned the river west, onto the village; a figure with a ring on the wrist turned it back. The third panel was painted before Kai arrived.', 'WATER STEPS · MURAL');
      } finally { tala.lookTarget = null; tala.root.position.set(7.8, 0, 5.5); leave(); busy = false; }
    }) });
    // the caretaker (2049)
    let amaTalks = 0;
    act({ pos: [-23.6, TY + 1.4, 19.6], radius: 2.8, states: ['flooded'], prompt: 'Talk to the caretaker', onUse: safe(async () => {
      if (busy) return; busy = true;
      try {
        ama.lookTarget = kai.head;
        if (amaTalks++ === 0) {
          await game.talk([
            ['caretaker', 'Survey people again? You picked a muddy year. Mind the beans.'],
            ['kai', 'Who built the dam?'],
            ['caretaker', 'Helix. Twenty thirty-one. They said the valley was empty. Nobody ever lived here, they said.'],
            ['niko', 'I lived here.'],
            ['caretaker', 'Then you are older than you look, young man.'],
          ]);
          ui.addEvidence('"Nobody ever lived here"', 'Ingrid Holt, caretaker of Reservoir 7: Helix built the dam in 2031 and declared the valley had never been inhabited.', 'RESERVOIR 7 · 2049');
        } else if (S.quest) {
          await game.talk([['caretaker', 'The channel is running again. Nobody alive remembers who opened it.'], ['caretaker', 'And that gravel bar out to the old levee. Straight as a ruler. Rivers do not do that on their own.']]);
        } else await game.say('caretaker', 'The spring under the cliff dried up before I came. Beans hate me for it.');
      } finally { ama.lookTarget = null; busy = false; }
    }) });
    // residue echo (abandoned)
    act({ pos: [-4.2, 1.2, 8], radius: 3.2, states: ['abandoned'], prompt: 'Listen to the echo', enabled: () => game.residueOn, onUse: safe(async () => {
      if (!game.residueOn) return;
      if (!S.diverted) await game.talk([['echo', 'The river took the lower houses. Then the hill above the door began to lean.'], ['echo', 'We are not staying to be buried. Take the jars. Leave the door.']]);
      else await game.talk([['echo', 'The river keeps its road. But the hill above the door is leaning.'], ['echo', 'The wall weeps no more. My grandmother said a wall that does not weep will fall.']]);
      ui.addEvidence('Why they left', S.diverted ? 'Residue in the empty village: the wall above the Keepers\' Door had stopped "weeping" — its drains were blocked — and the hill behind it was leaning.' : 'Residue in the empty village: the river ate the lower houses, then the hill above the door began to lean. The families left with their jars.', 'THE VILLAGE · c. 400 CE');
    }) });
    // memorial stone (abandoned, only after the diversion)
    const memorial = vis(new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 0.35), [MAT.ruin, MAT.ruin, MAT.ruin, MAT.ruin, new THREE.MeshStandardMaterial({ map: V.memorialTex(), roughness: 0.95 }), MAT.ruin]), ['abandoned'], () => S.diverted);
    memorial.position.set(0.8, VAL.hBase(0.8, -2) + 0.9, -2); memorial.rotation.y = -0.4; memorial.castShadow = true;
    col([0.2, -1, -2.5], [1.4, 2, -1.5], ['abandoned'], () => S.diverted);
    // ---------- optional investigation: the 2029 Helix survey line (2049, Residue Vision) ----------
    // three survey stakes; with Residue Vision on, each replays what the survey lead and Brandt said there in 2029
    const STAKES = [
      { p: [0.6, TY, -55.2], ry: 0.4, label: 'SZ-0 · LINE N · 14.03.2029', lines: [['echo2049', 'Line north, stake one. The readings climb the closer we get to that terrace.'], ['brandt', 'Then mark it and move. Rook wants the core out before the rain.'], ['echo2049', 'The core of what? Nobody has told us what we are looking for.']] },
      { p: [-27.2, TY, -12.4], ry: -0.6, label: 'SZ-0 · LINE W · 15.03.2029', lines: [['echo2049', 'There are terraces up here. Walls, channels, a kiln floor. This was a town.'], ['brandt', 'It was a hillside. Write hillside.'], ['echo2049', 'If we flood this, there is nothing left to study.'], ['brandt', 'That is the idea.']] },
      { p: [-3.2, 0, 1.6], ry: 0.2, label: 'SZ-0 · LINE S · 16.03.2029', cond: () => S.drained, lines: [['echo2049', 'The ring carved over that door. It is the same glyph as the Lab One prototype.'], ['brandt', 'There is no prototype. Helix builds the Chronolith in 2031. From scratch.'], ['echo2049', 'From what we take out of here, you mean.'], ['brandt', 'From scratch. Say it back to me.']] },
    ];
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0xd8dcdf, roughness: 0.45, metalness: 0.6 }), tipMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.5, emissive: 0x401000 });
    const stakeTagMat = new THREE.MeshStandardMaterial({ map: V.signTex(['HELIX TEMPORAL RESEARCH', 'SURVEY · SITE 0', 'DO NOT REMOVE'], '#e8eaec', '#14303a', 'stakeTag'), roughness: 0.5, side: THREE.DoubleSide });
    let echoesHeard = 0;
    const ghostLead = new Character(CAST.surveyor.look), ghostBrandt = new Character(CAST.brandt.look);
    for (const g of [ghostLead, ghostBrandt]) { g.setGhost(0x9fe8ff); g.root.position.set(0, -50, 0); resid(g.root, 'flooded'); game.onUpdate(dt => { if (g.root.visible) g.update(dt); }); }
    ghostLead.pose = 'look';
    STAKES.forEach((k, i) => {
      const y = VAL.hBase(k.p[0], k.p[2]);
      const g = new THREE.Group(); g.position.set(k.p[0], y, k.p[2]); g.rotation.y = k.ry;
      g.add(V.instances(new THREE.BoxGeometry(0.06, 1.1, 0.06), stakeMat, [{ x: 0, y: 0.55, z: 0 }]), V.instances(new THREE.BoxGeometry(0.07, 0.14, 0.07), tipMat, [{ x: 0, y: 1.12, z: 0 }]));
      const tg = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.18), stakeTagMat); tg.position.set(0, 0.86, 0.04); g.add(tg);
      vis(g, ['flooded']); k.y = y;
      const it = act({ pos: [k.p[0], y + 0.9, k.p[2]], radius: 2.0, states: ['flooded'], prompt: 'Read the survey stake', enabled: () => !k.done && (!k.cond || k.cond()), onUse: safe(async () => {
        if (k.done || busy || T.current !== 'flooded') return;
        if (!game.residueOn) { ui.subtitle('kai', `"${k.label}." Helix put this here twenty years ago. There's residue on it — [F].`, 3800); return; }
        busy = true;
        try {
          // stage the echo: the survey lead at the stake, Brandt a step behind her
          const a = k.ry, fx = Math.sin(a), fz = Math.cos(a);
          ghostLead.root.position.set(k.p[0] + fx * 1.0, y, k.p[2] + fz * 1.0); ghostLead.root.rotation.y = a + Math.PI;
          ghostBrandt.root.position.set(k.p[0] + fx * 2.2 + fz * 0.9, VAL.hBase(k.p[0] + fx * 2.2 + fz * 0.9, k.p[2] + fz * 2.2 - fx * 0.9), k.p[2] + fz * 2.2 - fx * 0.9); ghostBrandt.lookTarget = ghostLead.head;
          refreshWorld();
          await enter([k.p[0] + fz * 3.6 + fx * 0.6, y + 1.8, k.p[2] - fx * 3.6 + fz * 0.6], [k.p[0] + fx * 1.4, y + 1.3, k.p[2] + fz * 1.4], 1.4, 44);
          audio.sfxPlay('rewind');
          await game.talk(k.lines);
          k.done = true; done(it); echoesHeard++;
          ui.toast(`SURVEY LINE · ECHO ${echoesHeard}/3`, 2600);
          if (echoesHeard === 3) {
            F.m5_surveyEchoes = true;
            await game.talk([['kai', 'Rook knew. Two years before the Chronolith "existed", Helix was digging it out of a hillside.'], ['niko', 'And your Brandt made them say it back.']]);
            ui.addEvidence('Survey line SZ, March 2029', 'Residue on three Helix survey stakes: a survey lead recognised the village and the Ring glyph from the "Lab One prototype"; Officer Brandt ordered her to record a bare hillside and to repeat that Helix built the Chronolith "from scratch" in 2031.', 'RESERVOIR 7 · 2029');
          }
        } finally { ghostBrandt.lookTarget = null; ghostLead.root.position.set(0, -50, 0); ghostBrandt.root.position.set(0, -50, 0); leave(); busy = false; }
      }) });
    });
    ghostLead.root.position.set(0, -50, 0); ghostBrandt.root.position.set(0, -50, 0);
    // ---------- optional: Iru's cup (abandoned, after the water quest) ----------
    let cupFound = false;
    const cup = new THREE.Mesh(V.jarGeometry(0.6), clay); cup.scale.setScalar(0.42); cup.rotation.set(1.1, 0.4, 0.2); cup.position.set(-22.9, TY + 0.06, 1.2);
    vis(cup, ['abandoned'], () => S.quest && !cupFound);
    act({ pos: [-22.9, TY + 0.8, 1.2], radius: 2.0, states: ['abandoned'], prompt: 'Dig in the kiln ruins', enabled: () => S.quest && !cupFound, onUse: safe(async () => {
      if (cupFound || busy || T.current !== 'abandoned') return; busy = true;
      try {
        cupFound = true; F.m5_iruCup = true; refreshWorld(); audio.sfxPlay('pickup');
        await enter([-20.6, TY + 1.6, 3.0], [-22.9, TY + 0.2, 1.2], 1.2, 38);
        await game.talk([['kai', 'A cup. Fired hard, never used. There\'s a ring pressed into the base.'], ['niko', 'Iru\'s mark beside it. "For the keeper\'s guest. Whenever that is."'], ['kai', 'Fourteen hundred years. She kept her promise.']]);
        ui.addEvidence('Iru\'s cup', 'Buried in the abandoned kiln yard: the cup the potter Iru promised Kai after he re-set the leat gates, marked with the Water Ring and the words "for the keeper\'s guest".', 'KILN YARD · c. 400 CE');
      } finally { leave(); busy = false; }
    }) });
    // the door, examined in each state
    act({ pos: [DOOR.x + 0.8, 1.2, doorMid], radius: 2.4, states: ['thriving', 'abandoned'], prompt: 'Examine the Keepers\' Door', onUse: () => {
      if (T.current === 'thriving') ui.subtitle('niko', 'No one opens the Keepers\' Door. Not even the keepers. It was sealed before the first fire.', 4200);
      else ui.subtitle('kai', 'Solid stone, and the roots have it now. Whoever sealed this didn\'t want it opened in this century.', 4200);
    } });
    act({ pos: [5.5, TY + 1.5, -50.9], radius: 2.6, states: ['flooded'], prompt: 'Read the Helix notice', onUse: safe(async () => {
      S.sign = true;
      if (!S.diverted) {
        await game.talk([['kai', 'Manual release at the tower only. Access by boat only.'], ['kai', 'No boat. Two hundred meters of open water.'], ['niko', 'Tala says the river once ran east, along the other channel. In my time it is a dry ditch.'], ['kai', 'If somebody turned the river back, they\'d have to build a levee to hold it. Stone levees outlast everyone.']]);
        objective(mainObjective()); ui.toast('The earliest state: divert the river into its eastern channel', 4000);
      } else await game.say('kai', 'Tower access along the old levee. Somebody updated the sign three thousand years ago.');
    }) });
    act({ pos: [-12.0, 2.6, -6.0], radius: 4.2, states: ['flooded'], prompt: 'Look at the survey buoy', enabled: () => !S.drained, onUse: () => ui.subtitle('kai', S.wall ? 'Helix survey, site zero. Right above the door. The wall held — the door is under two meters of water now, not under a hill.' : 'Helix survey, site zero. Under it: a hill of mud where the terrace wall came down on the door.', 4600) });

    // ======================================================================================
    // the main beats
    // ======================================================================================
    // --- the river diversion (thriving) ---
    let talaAtHead = false, levered = 0, headTalk = false;
    const TALA_HEAD = [20.6, -49.2], TALA_STEPS = [7.8, 5.5];
    // Tala works at the water steps; once Kai heads up to the shelf she is already waiting at the head works
    // (she only moves while Kai is far from both spots, so nobody sees her teleport)
    game.onUpdate(() => {
      if (busy) return;
      const p = game.player.pos, wantHead = S.toured && !S.diverted && (headTalk || p.z < -30);
      if (wantHead === talaAtHead) return;
      if (Math.hypot(p.x - TALA_STEPS[0], p.z - TALA_STEPS[1]) > 18 && Math.hypot(p.x - TALA_HEAD[0], p.z - TALA_HEAD[1]) > 12) {
        talaAtHead = wantHead;
        if (wantHead) { tala.root.position.set(TALA_HEAD[0], TY, TALA_HEAD[1]); tala.root.rotation.y = Math.PI * 0.85; } else { tala.root.position.set(TALA_STEPS[0], 0, TALA_STEPS[1]); tala.root.rotation.y = Math.PI / 2; }
      }
    });
    act({ pos: [TALA_HEAD[0], TY + 1.5, TALA_HEAD[1]], radius: 2.8, states: ['thriving'], prompt: 'Speak with Tala at the head works', enabled: () => talaAtHead && levered === 0 && !S.diverted, onUse: safe(async () => {
      if (busy || T.current !== 'thriving') return; busy = true;
      try {
        headTalk = true;
        await enter([TALA_HEAD[0] - 1.6, TY + 2.3, TALA_HEAD[1] + 3.2], [B55, TY + 0.6, -53], 1.4, 48);
        tala.lookTarget = kai.head; placeNiko(TALA_HEAD[0] - 1.4, TALA_HEAD[1] + 1.2, Math.PI);
        await game.talk([
          ['kai', 'If we clear the rockfall, the river takes its old road east. Then close the village sluice.'],
          ['tala', 'And the lower houses stop falling into it. We have wanted this for three generations. We never had enough hands.'],
          ['niko', 'Or a man who has seen what happens if we don\'t.'],
          ['tala', 'Ropes are on the boulders. Lever them toward the bank. The crew will pull.'],
        ]);
        audio.setTheme('m5work');
        objective('Lever the boulders out of the eastern channel mouth (0/3)');
      } finally { tala.lookTarget = null; leave(); busy = false; }
    }) });
    boulders.forEach((b, i) => act({ pos: [b.userData.home.x - 1.2, TY + 0.8, b.userData.home.z], radius: 2.6, states: ['thriving'], hold: 1.6, prompt: 'Lever the boulder (hold E)', enabled: () => talaAtHead && objText.startsWith('Lever') && !b.userData.moved, onUse: safe(async (it) => {
      if (b.userData.moved || T.current !== 'thriving') return;
      b.userData.moved = true; done(it); levered++; audio.sfxPlay('metal'); game.shake = 0.12; bCols[i].enabled = false; colList.splice(colList.findIndex(c => c.b === bCols[i]), 1);
      const from = b.position.clone(), to = new THREE.Vector3(B55 + 5.4 + i * 0.3, TY + 0.55, -55.5 + i * 1.7);
      await new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt * 0.8); b.position.lerpVectors(from, to, u); b.position.y += Math.sin(u * Math.PI) * 1.2; b.rotation.x += dt * 3; if (u >= 1) { off(); res(); } }); });
      game.shake = 0;
      objective(levered < 3 ? `Lever the boulders out of the eastern channel mouth (${levered}/3)` : 'Close the village sluice at the windlass');
      if (levered < 3) ui.subtitle('villager', ['Pull! Again!', 'It moves! It moves!'][levered - 1], 2000);
    }) }));
    act({ pos: [A53 + 4.4, TY + 1.0, HZ], radius: 2.6, states: ['thriving'], hold: 2.4, prompt: 'Close the village sluice (hold E)', enabled: () => talaAtHead && !S.diverted && objText.length > 0, onUse: safe(async () => {
      if (S.diverted || T.current !== 'thriving' || busy) return;
      if (levered < 3) { ui.subtitle('tala', 'Not yet! Give it a road first, or it will climb the bank and take the houses tonight.', 3800); return; }
      busy = true;
      try { await diversion(); } finally { busy = false; }
    }) });
    async function diversion() {
      await enter([A53 + 9, TY + 4.5, -42], [A53 + 3, TY, HZ - 1], 1.6, 52);
      audio.sfxPlay('door');
      await new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt * 0.4); sluice.position.y = 3.6 - u * 1.9; wdrum.rotation.y += dt * 5; if (u >= 1) { off(); res(); } }); });
      S.diverted = true; F.m5_riverDiverted = true; placeBoulders();
      audio.sfxPlay('boom'); game.shake = 0.15; audio.water(0.32);
      refreshWorld();
      await game.shot([B55 - 3, TY + 6, -40], [VAL.B(-30), 0, -30], 2.6, { fov: 55 });
      game.shake = 0;
      tala.lookTarget = kai.head; tala.root.position.set(TALA_HEAD[0], TY, TALA_HEAD[1]);
      await game.shot([TALA_HEAD[0] - 2.4, TY + 1.9, TALA_HEAD[1] + 2.6], [TALA_HEAD[0], TY + 1.6, TALA_HEAD[1]], 1.2, { fov: 42 });
      await game.talk([
        ['tala', 'Look at it. It runs east as if it never left.'],
        ['tala', 'We will line the new bank with stone. Every season, a course higher. So the river remembers this road.'],
        ['kai', 'Build it high. Higher than you think you need.'],
      ]);
      tala.lookTarget = null;
      rewrite(); restoreTheme();
      ui.addEvidence('The river turned east', 'In c. 1000 BCE Kai helped Tala\'s people clear the rockfall and close the village sluice. The river returned to its eastern channel; the village began a stone levee along it.', 'HEAD WORKS · c. 1000 BCE');
      leave(); objective('See what the change did to the later states (2 · 3)');
      game.checkpoint(TALA_HEAD[0], TY, TALA_HEAD[1] + 1.5, Math.PI);
    }
    // consequences seen on switching
    T.onSwitch((id) => {
      if (S.diverted && id === 'abandoned' && !S.sawAbPost) { S.sawAbPost = true; cinematic(async () => {
        await enter([3.6, 2.2, 1.4], [0.8, 1.2, -2], 1.6, 44);
        await game.talk([['kai', 'The lower houses are still standing. The river never came for them.'], ['niko', 'And they carved your ring into the stone. "The one who turned the river."']]);
        placeNiko(2.6, -0.4, -2.4); niko.lookTarget = kai.head; kai.lookTarget = niko.head;
        await game.shot([4.2, 1.8, -3.4], [2.6, 1.55, -0.6], 1.2, { fov: 40 });
        await game.talk([['niko', 'You keep changing the world.'], ['kai', 'I\'m trying to get home.'], ['niko', 'Then stop changing it.']]);
        niko.lookTarget = null; kai.lookTarget = null;
        ui.addEvidence('"The one who turned the river"', 'After the diversion, the empty village of c. 400 CE is intact, and a memorial stone shows a figure with a ring on the wrist turning the river. Niko: "You keep changing the world." Kai: "I\'m trying to get home." Niko: "Then stop changing it."', 'THE VILLAGE · c. 400 CE');
        leave(); if (S.sawFlPost) objective(mainObjective());
      }); }
      if (S.diverted && id === 'flooded' && !S.sawFlPost) { S.sawFlPost = true; cinematic(async () => {
        await enter([18, 9, -40], [26, 2.4, 10], 2.0, 50);
        await game.shot([22, 6, -46], [26, 2.4, 30], 2.4, { fov: 46 });
        await game.talk([['kai', 'There\'s my causeway. Three thousand years of stone, two feet above the water.'], ['niko', 'Tala\'s levee. She said a course higher every season.']]);
        if (!S.wall) await game.say('kai', 'And the terrace wall over the door is still a landslide. One problem at a time.');
        leave(); objective(mainObjective());
        game.checkpoint(21, groundAt(21, -47), -47, 0);
      }); }
      if (S.wall && id === 'flooded' && !S.sawFlWall) { S.sawFlWall = true; cinematic(async () => {
        await enter([-6, 4.2, -2], [-13.4, 1.4, -6], 1.8, 46);
        await game.talk([['kai', 'The wall held. Fifteen hundred years later and it\'s still there — under the water.'], ['kai', 'The door\'s lintel. No landslide.']]);
        leave(); objective(mainObjective());
      }); }
    });

    // --- the terrace wall (abandoned) ---
    let wallSeen = false, carrying = null;
    const beamProp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.8, 8), MAT.timberOld); beamProp.rotation.z = Math.PI / 2 - 0.15; beamProp.position.set(0.15, 1.2, 0.45); beamProp.visible = false; kai.root.add(beamProp);
    const BEAMS = [{ x: -6.3, z: -14.0 }, { x: -6.3, z: 12.6 }].map((b, i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.8, 8), MAT.timberOld); m.rotation.set(0, 0.3, Math.PI / 2); m.position.set(b.x, VAL.hBase(b.x, b.z) + 0.15, b.z); m.castShadow = true; vis(m, ['abandoned'], () => !m.userData.taken); m.userData.i = i; return m; });
    game.onUpdate(() => {
      if (!wallSeen && S.toured && T.current === 'abandoned' && nearK(-11.5, -4.5, 6.5) && game.control && !busy) { wallSeen = true; cinematic(async () => {
        await enter([-8.6, 1.8, -1.0], [-13.4, 1.2, -5], 1.4, 46);
        await game.talk([['kai', 'Look at the face. It\'s bulging — the whole middle section is moving.'], ['kai', 'It\'s not the stones that are failing. It\'s the water behind them. Those drain holes are choked solid.'], ['niko', 'In my time they weep after every rain. The keepers clean them at the spring feast.'], ['kai', 'Nobody\'s held a feast here for three hundred years.']]);
        leave(); objective(`Clear the three choked drains in the terrace wall (${S.drains}/3)`); ui.toast('Residue Vision [F] shows where the water used to run', 3500);
        game.checkpoint(-9, 0.02, -5, -Math.PI / 2);
      }); }
      if (carrying) beamProp.visible = true;
    });
    WEEP.forEach((z, i) => act({ pos: [WALL.x1 + 0.6, 0.9, z], radius: 1.9, states: ['abandoned'], hold: 1.6, prompt: 'Clear the choked drain (hold E)', enabled: () => wallSeen && !plugs[i].userData.cleared, onUse: safe(async (it) => {
      if (plugs[i].userData.cleared || T.current !== 'abandoned') return;
      plugs[i].userData.cleared = true; done(it); S.drains++; refreshWorld(); audio.sfxPlay('spark'); audio.water(0.16);
      ui.subtitle('kai', ['There — it\'s running. Brown water. Centuries of it.', 'Second one. Listen to it.', 'Pressure\'s off. Now brace the bulge before it moves again.'][S.drains - 1], 3000);
      objective(S.drains < 3 ? `Clear the three choked drains in the terrace wall (${S.drains}/3)` : 'Brace the bulge with two roof beams from the ruins (0/2)');
    }) }));
    BEAMS.forEach((m) => act({ pos: [m.position.x, 0.9, m.position.z], radius: 2.2, states: ['abandoned'], prompt: 'Take the fallen roof beam', enabled: () => S.drains >= 3 && !carrying && !m.userData.taken, onUse: (it) => {
      if (carrying || S.drains < 3 || T.current !== 'abandoned') return;
      m.userData.taken = true; done(it); carrying = m; beamProp.visible = true; refreshWorld(); audio.sfxPlay('pickup'); ui.toast('Carry the beam to the wall', 2200);
    } }));
    BRACE.forEach((b, i) => act({ pos: [b.x + 0.4, 0.9, b.z], radius: 2.0, states: ['abandoned'], hold: 1.2, prompt: 'Brace the wall with the beam (hold E)', enabled: () => !!carrying && S.braced === i, onUse: (it) => {
      if (!carrying || S.braced !== i || T.current !== 'abandoned') return;
      done(it); carrying = null; beamProp.visible = false; S.braced++; refreshWorld(); audio.sfxPlay('door'); game.shake = 0.06; setTimeout(() => { game.shake = 0; }, 300);
      objective(S.braced < 2 ? 'Brace the bulge with two roof beams from the ruins (1/2)' : 'Drive the stone wedges under the braces');
    } }));
    act({ pos: [-11.6, 0.8, -4.8], radius: 2.4, states: ['abandoned'], hold: 2.0, prompt: 'Drive the wedges (hold E)', enabled: () => S.braced >= 2 && !S.wall, onUse: safe(async () => {
      if (S.braced < 2 || S.wall || busy) return; busy = true;
      try {
        await enter([-7.8, 2.4, -4.6], [-13.3, 1.4, -5], 1.2, 48);
        for (let k = 0; k < 3; k++) { audio.sfxPlay('metal'); game.shake = 0.08; await game.wait(0.45); game.shake = 0; await game.wait(0.2); }
        S.wall = true; F.m5_wallReinforced = true; refreshWorld();
        await game.talk([['kai', 'Drains clear, braces set. That should hold another fifteen hundred years.'], ['niko', 'Should.']]);
        rewrite();
        ui.addEvidence('The wall that weeps again', 'In c. 400 CE Kai cleared the retaining wall\'s three choked drains and braced its bulge with roof beams from the ruins. The landslide that buried the Keepers\' Door in 2049 never happens.', 'TERRACE WALL · c. 400 CE');
        leave(); objective(mainObjective());
        game.checkpoint(-9, 0.02, -5, -Math.PI / 2);
      } finally { busy = false; }
    }) });

    // --- the pressure gate (2049) ---
    let v1 = false, v2 = false, overTries = 0, atTower = false;
    game.onUpdate(() => { if (!atTower && T.current === 'flooded' && Math.hypot(game.player.pos.x - TOWER.x, game.player.pos.z - TOWER.z) < 4.2 && game.player.pos.y > 2.4) { atTower = true; game.checkpoint(25.7, 2.76, 45.0, Math.PI / 2); ui.toast('CHECKPOINT · OUTLET TOWER G-2', 2200); if (!S.wall) cinematic(async () => { await enter([TOWER.x - 6, 6, TOWER.z - 4], [-12, 1.5, -6], 1.8, 40); await game.talk([['kai', 'If I drain it now I uncover a landslide. The terrace wall came down on the door.'], ['kai', 'The wall has to stand first. Back to the empty years.']]); leave(); objective(mainObjective()); }); } });
    const pressureTo = (to, sec) => new Promise(res => { const from = pressure; let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / sec); pressure = lerp(from, to, u); setNeedle(); if (u >= 1) { off(); res(); } }); });
    act({ pos: vpos(V1), radius: 1.8, states: ['flooded'], hold: 1.4, prompt: 'Open bypass valve V1 (hold E)', enabled: () => atTower && !v1, onUse: safe(async () => { if (v1 || T.current !== 'flooded') return; v1 = true; audio.sfxPlay('door'); V1.rotation.z += 2; await pressureTo(0.74, 3); ui.subtitle('kai', 'V1 open. Needle\'s dropping.', 2000); }) });
    act({ pos: vpos(V2), radius: 1.8, states: ['flooded'], hold: 1.4, prompt: 'Open bypass valve V2 (hold E)', enabled: () => atTower && !v2, onUse: safe(async () => { if (v2 || T.current !== 'flooded') return; v2 = true; audio.sfxPlay('door'); V2.rotation.z += 2; await pressureTo(v1 ? 0.52 : 0.76, 3); ui.subtitle('kai', v1 ? 'Below sixty. Now the main gate.' : 'V2 open. One more bypass.', 2200); }) });
    act({ pos: vpos(MAIN), radius: 1.9, states: ['flooded'], hold: 2.6, prompt: 'Release the main gate (hold E)', enabled: () => atTower && !S.released, onUse: safe(async () => {
      if (S.released || T.current !== 'flooded' || busy) return;
      if (!S.wall) { ui.subtitle('kai', 'Not yet. Drain it now and I only uncover a landslide.', 3000); return; }
      if (pressure > 0.6) { overTries++; game.shake = 0.18; audio.sfxPlay('metal'); setTimeout(() => { game.shake = 0; }, 500); ui.subtitle('kai', overTries > 1 ? 'Read the placard, Kai. Bypass valves first — equalize, then the gate.' : 'It won\'t move against that pressure. The needle\'s in the red.', 3200); return; }
      busy = true; try { await drain(); } finally { busy = false; }
    }) });
    async function drain() {
      await enter([TOWER.x - 5.5, 5.2, TOWER.z + 3.5], [TOWER.x - 1, 3.4, TOWER.z], 1.2, 48);
      for (let k = 0; k < 3; k++) { MAIN.rotation.z += 1.2; audio.sfxPlay('metal'); await game.wait(0.4); }
      S.released = true; F.m5_gateReleased = true; refreshWorld();
      audio.sfxPlay('boom'); game.shake = 0.2; audio.water(0.45); audio.setTheme('m5work');
      await game.shot([TOWER.x - 4, 9, TOWER.z - 2], [-6, 0, -10], 2.0, { fov: 52 });
      game.shake = 0.06;
      await new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt / 9); reservoir.position.y = -3.05 * (u * u * (3 - 2 * u)); terCfg.x = 2.0; if (u >= 1) { off(); res(); } }); });
      S.drained = true; F.m5_drained = true; game.shake = 0; audio.water(0.16); refreshWorld();
      await game.shot([-3, 5.5, 4], [-13.4, 1.0, -6], 3.0, { fov: 44 });
      placeNiko(TOWER.x - 3.4, TOWER.z - 1.0, -Math.PI / 2);
      await game.shot([TOWER.x - 6.4, 3.9, TOWER.z - 2.0], [TOWER.x - 3.4, 3.9, TOWER.z - 1.0], 1.2, { fov: 40 });
      niko.lookTarget = kai.head;
      await game.talk([['niko', 'My village. It is still here.'], ['kai', 'Under everything. Mud, water, Helix.'], ['niko', 'The door. Kai — the door has a new face.']]);
      niko.lookTarget = null;
      rewrite('RESERVOIR 7 DRAINED · THE VILLAGE IS ABOVE WATER FOR THE FIRST TIME SINCE 2031');
      ui.addEvidence('Reservoir 7 drained', 'Kai equalized the outlet tower\'s bypasses and released the main gate. The drowned village surfaced — and the Keepers\' Door now carries a Helix steel hatch: SITE 0, SEALED 02.2031.', 'RESERVOIR 7 · 2049');
      restoreTheme(); leave(); objective(mainObjective());
      game.checkpoint(25.0, 2.6, 40, Math.PI);
    }

    // --- the hatch and the machine ---
    let studied = false, compared = { thriving: false, abandoned: false, flooded: false };
    act({ pos: [DOOR.x + 0.9, 1.2, doorMid], radius: 2.4, states: ['flooded'], hold: 1.8, prompt: 'Open the Helix hatch (hold E)', enabled: () => S.drained && !S.hatch, onUse: safe(async () => {
      if (!S.drained || S.hatch || busy) return; busy = true;
      try {
        await enter([DOOR.x + 4.4, 1.7, doorMid + 2.4], [DOOR.x, 1.1, doorMid], 1.2, 46);
        await game.say('kai', 'Helix. Site zero. Sealed February 2031 — the year the dam closed.');
        audio.sfxPlay('door');
        await new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt * 0.6); hatchPivot.rotation.y = -u * 1.7; if (u >= 1) { off(); res(); } }); });
        S.hatch = true; refreshWorld(); audio.setTheme('m5machine'); audio.hum(0.07, 41);
        leave(); objective('Follow the tunnel under the terrace'); game.checkpoint(DOOR.x + 0.8, 0.02, doorMid, -Math.PI / 2);
      } finally { busy = false; }
    }) });
    act({ pos: [-29.0, -1.6, MZ], radius: 3.2, prompt: 'Study the machine', enabled: () => S.hatch && !studied, onUse: safe(async () => {
      if (studied || busy || !S.hatch) return; busy = true;
      try { studied = true; await machineScene(); } finally { busy = false; }
    }) });
    async function machineScene() {
      interiorView = true;
      await enter([-26.2, -1.3, -3.2], [MX, MY, MZ], 1.8, 50);
      await game.shot([-27.8, -1.0, -7.4], [MX + 0.6, MY - 0.4, MZ + 0.6], 2.2, { fov: 40 });
      await game.talk([['kai', 'This isn\'t stone. Ceramic matrix, superconducting seams. Nothing in 2049 is made like this.'], ['kai', 'And the socket in the middle is empty. Someone cut the core out with clamps.']]);
      await game.shot([MX + 1.6, MY - 1.0, MZ + 2.4], [tag.position.x, tag.position.y, tag.position.z], 1.4, { fov: 30 });
      await game.say('kai', 'Helix survey. Site zero, fourteenth of March 2029. Core recovered, sent to Helix Lab 1. Site to be flooded. Authorised: E. Rook.');
      await game.say('kai', F.trustedHale === false ? 'Security escort: Brandt. The man I trusted in the lift.' : 'Security escort: Brandt. Hale was right about him.');
      ui.addEvidence('Survey tag SZ-0', 'Helix surveyed "Site Zero" on 14.03.2029, removed the machine\'s core to Helix Lab 1, and flooded the valley in 2031. Authorised: E. Rook. Security escort: Brandt. Helix says it built the Chronolith in 2031.', 'THE CHAMBER · 2049');
      leave(); objective('Compare the machine in the other states (1 · 2 · 3)');
      ui.toast('The chamber exists in every state. Switch here.', 3500);
      compared[T.current] = true;
      T.unlocked = true;
    }
    T.onSwitch((id) => { if (studied && inInterior(game.player.pos.x, game.player.pos.z) && game.player.pos.y < 0) { compared[id] = true; if (id === 'thriving') ui.subtitle('kai', 'The core. Three thousand years ago it was still in its socket — burning.', 3600); if (id === 'abandoned') ui.subtitle('kai', 'Still here in the empty years. Helix took it in 2029.', 3200); } });

    // ======================================================================================
    // SCRIPT
    // ======================================================================================
    ui.missionTag('MISSION 5 · THE VILLAGE THAT NEVER EXISTED'); ui.show('hud', true);
    const tStart = game.time;
    refreshWorld(); machineTune();
    console.log('m5 build ms', Math.round(performance.now() - t0));
    game.player.place(-28.6, TY, 30.4, Math.PI); game.checkpoint(-28.6, TY, 30.4, Math.PI);
    placeNiko(-27.4, 31.8, Math.PI);
    game.control = false; ui.letterbox(true);
    audio.setTheme('m5thrive'); beds('thriving');
    const cam = game.engine.camera;
    cam.position.set(46, 34, 72); cam.lookAt(-4, 2, -8);
    await game.shot([46, 34, 72], [-4, 2, -8], 0.01, { fov: 50 });
    await ui.fade(0, 2400);
    await game.shot([24, 18, 44], [-6, 2, -12], 6.5, { fov: 48 });
    await ui.chapterCard('ACT I · THE WORLD THAT REMEMBERS', 'The Village That Never Existed', 'One valley · three states', 3800);
    await game.shot([-23.5, TY + 2.4, 27.6], [-28.2, TY + 1.5, 30.6], 2.0, { fov: 44 });
    niko.lookTarget = kai.head; kai.lookTarget = niko.head;
    await game.talk([
      ['niko', 'There. The lower village. My mother\'s sister lives by the water steps.'],
      ['kai', 'I know this valley. I\'ve seen it on a Helix survey map.'],
      ['kai', 'There\'s no village on it. Just a reservoir.'],
      ['niko', 'Then your maps are wrong. Come. Tala is waiting for us.'],
    ]);
    niko.lookTarget = null; kai.lookTarget = null;
    leave();
    objective('Walk down into the lower village. Find Tala at the water steps');
    // ambient barks in the thriving village
    const BARKS = [{ x: -1, z: 6, id: 'villager', line: 'Keeper\'s guest! Sit, the bread is nearly done.' }, { x: -24, z: 0, id: 'potter', line: 'Mind the drying clay, stranger. And the mud. Always the mud.' }, { x: 9, z: -1, id: 'villager', line: 'The wheel turns slower every year. The river is in a hurry to be somewhere else.' }, { x: -5, z: -15, id: 'villager', line: 'You wear no dust, but the old story knows your face.' }];
    game.onUpdate(() => { if (T.current !== 'thriving' || busy || ui.dlgActive) return; for (const b of BARKS) if (!b.done && nearK(b.x, b.z, 5)) { b.done = true; ui.subtitle(b.id, b.line, 3600); } });
    // 1 · Tala at the water steps
    await new Promise(res => { const it = act({ pos: [7.8, 1.5, 5.5], radius: 3.2, states: ['thriving'], prompt: 'Speak with Tala', onUse: () => { done(it); res(); } }); });
    await enter([4.6, 1.9, 8.6], [7.8, 1.6, 5.5], 1.4, 42);
    tala.lookTarget = kai.head; placeNiko(5.0, 3.6, Math.PI * 0.75);
    await game.talk([
      ['tala', 'Niko says the stones knew you.'],
      ['kai', 'They knew my card. I\'m still working out what that means.'],
      ['tala', 'The river is hungry this year. Every flood it eats another hand of the bank.'],
      ['tala', 'My grandmother\'s grandmother said it once ran east, along the other channel. Before the rockfall.'],
      ['niko', 'Kai. Your wrist.'],
      ['kai', 'It\'s pulling. Up there — above that door in the wall.'],
      ['tala', 'The Water Ring. It has not spoken since before the first fire.'],
    ]);
    tala.lookTarget = null; S.metTala = true;
    leave();
    objective('Climb to the Water Ring above the Keepers\' Door');
    kai.wristBoost = 6;
    // 2 · the Water Ring: the forced tour through the three states
    await new Promise(res => { const it = act({ pos: [-15.3, TY + 1.4, doorMid], radius: 2.6, prompt: 'Touch the Water Ring', onUse: () => { done(it); res(); } }); });
    await enter([-12.2, TY + 2.6, doorMid + 3.6], [-16.2, TY + 1.9, doorMid], 1.2, 44);
    kai.pose = 'work'; kai.wristBoost = 12; ringLight.intensity = 8; audio.sfxPlay('switch');
    placeNiko(-14.4, doorMid + 1.6, -Math.PI / 2);
    await game.say('niko', 'Wait—!');
    await T.switchTo('abandoned', { force: true, free: true, dur: 1100 });
    kai.pose = null;
    await game.shot([4, 9, 14], [-6, 1, -6], 3.0, { fov: 50 });
    await game.talk([['niko', 'Where is everyone?'], ['kai', 'Gone. Hundreds of years gone.'], ['niko', 'The lower houses — the river took them.']]);
    await T.switchTo('flooded', { force: true, free: true, dur: 1100 });
    await game.shot([-17, 10, -4], [16, 1, 40], 3.2, { fov: 52 });
    await game.talk([['niko', 'The valley is drowned.'], ['kai', 'This is my time. 2049. That wall across the valley is a dam.']]);
    await game.shot([-14.4, TY + 3.2, -1.5], [-11.4, 1.8, -6], 1.6, { fov: 40 });
    await game.talk([['kai', 'And that\'s a Helix survey buoy. Right over your door.'], ['kai', 'The wall above it came down. The door\'s under a hill of mud and two meters of water.']]);
    await T.switchTo('thriving', { force: true, free: true, dur: 900 });
    ringLight.intensity = 0;
    await game.shot([-12.6, TY + 2.2, doorMid - 2.6], [-14.4, TY + 1.6, doorMid + 1.6], 1.2, { fov: 42 });
    niko.lookTarget = kai.head;
    await game.talk([['niko', 'You brought me into the end of my village.'], ['kai', 'You grabbed my arm.'], ['niko', 'I will keep holding it. Someone should watch what you do.']]);
    niko.lookTarget = null; S.toured = true; F.nikoCrossedEras = true;
    T.unlocked = true; T.refreshHud(); T.stability = 1;
    ui.addEvidence('One valley, three states', 'The Water Ring answers Kai\'s wrist: the village thriving (c. 1000 BCE), abandoned (c. 400 CE), and drowned under Helix\'s Reservoir 7 (2049). A Helix survey buoy marks "Site 0" over the Keepers\' Door.', 'THE WATER RING');
    leave();
    ui.toast('TEMPORAL STATES OF THIS VALLEY\n1 · c. 1000 BCE      2 · c. 400 CE      3 · 2049      (Q cycles)\nNiko holds on: he follows you through every switch', 7000);
    objective(mainObjective());
    game.checkpoint(-15.6, TY + 0.36, doorMid + 2.4, Math.PI / 2);
    // the main beats resolve through the interactions above; wait for the machine and the comparison
    await until(() => studied);
    await until(() => (compared.thriving || compared.abandoned) || game.time > 1e9);
    await game.wait(2.5);
    await until(() => true);
    // ---------- ending: Niko's revelation ----------
    busy = true;
    interiorView = true;
    if (T.current !== 'flooded') await T.switchTo('flooded', { force: true, free: true, dur: 900 });
    await enter([-27.0, -1.0, -8.6], [MX, MY, MZ], 1.6, 46);
    game.player.place(-28.4, CH.floor, -6.8, -Math.PI / 2); placeNiko(-28.0, -4.6, -Math.PI / 2 - 0.3);
    audio.setTheme('m5end');
    await game.shot([-30.3, -1.25, -3.6], [-28.2, -1.35, -5.6], 1.8, { fov: 38 });
    niko.lookTarget = kai.head; kai.lookTarget = niko.head;
    await game.talk([
      ['niko', 'Our Telling ends with people in white. They come after the last flood, and lift the heart of the Ring out of the drowned valley.'],
      ['kai', 'You knew. Before any of this.'],
      ['niko', 'I knew the story. You told it to us, Kai. Sixteen times.'],
      ['niko', 'Your Helix did not invent the machine. It found it. It found it here, and it took the heart away, and it drowned the place that remembered.'],
    ]);
    if (F.m1warning) await game.say('kai', '"Do not build the machine." Maybe nobody built it.');
    await game.shot([-26.4, -1.4, -8.8], [-28.4, -1.3, -6.8], 1.4, { fov: 36 });
    const pick = await game.choice('niko', 'Promise me you will stop changing the world.', ['"I\'ll try."', '"I can\'t promise that. Not until I find Mira."']);
    F.m5_promise = pick === 0 ? 'tried' : 'refused';
    if (pick === 0) await game.talk([['niko', 'Trying is what the sixteen said.'], ['kai', 'Then I\'ll be the first who means it.']]);
    else await game.talk([['niko', 'Mira. The sister in the drawing.'], ['kai', 'She\'s the reason for all of it.'], ['niko', 'Then I will keep holding your arm.']]);
    niko.lookTarget = null; kai.lookTarget = null;
    F.m5_machineFound = true; F.helixFoundMachine = true; F.villageCausalChain = ['river diverted · c. 1000 BCE', 'wall reinforced · c. 400 CE', 'pressure gate released · 2049'];
    ui.addEvidence('Helix found it', 'Niko: "Your Helix did not invent the machine. It found it." The Telling ends with "people in white" lifting the heart of the Ring out of the drowned valley. Kai told the story to the keepers sixteen times before.', 'THE CHAMBER');
    await game.shot([-25.2, -0.6, -6.2], [MX, MY + 0.4, MZ], 3.2, { fov: 52 });
    audio.sfxPlay('motif');
    await game.wait(1.2);
    await ui.fade(1, 2200);
    const mins = Math.round((game.time - tStart) / 60);
    await ui.chapterCard('MISSION 5 COMPLETE', 'The Village That Never Existed', `Shards ${S.shards}/6 · Water quest ${S.quest ? 'done' : 'not done'} · ${F.m5_promise === 'tried' ? 'You promised to try' : 'You refused to promise'}${mins ? ' · ' + mins + ' min' : ''}`, 3600);
    F.m5complete = true;
    busy = false; interiorView = false;
    game.releaseCam(); ui.letterbox(false); audio.allBeds(0); audio.setTheme(null);
  },
};
