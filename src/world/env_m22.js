// Mission 22 environment: THE FIRST SECOND. One scene (north = -z, ground y = 0 unless stated).
//   THE HALL (hub)  Test Hall Zero, 19.10.2026, 08:14:09: the original activation point, its roof torn off, hanging in a
//     gold dawn above the unbuilt city. The open-day tableau stands frozen around the ring (x -15..15, z -18..14).
//     Holders (keys 1/2/3 once unlocked): 'kai' (the hall as Kai remembers it), 'witness' (as the Witness remembers it),
//     'record' (no people: only what the room itself kept). Under the ring: the stair to the Chronolith's final chamber
//     (antechamber z -24..-29, iris door at z -29, chamber z -29..-38, floor y -5).
//   I · THE VALLEY (west island, x -80..-44)  the terrace of M5's village and the Keepers' Door in its retaining wall
//     (x -61..-60), in three states: 'bce' (c. 1000 BCE, the night of the burial), 'ce400' (c. 400 CE, ruins, the seal),
//     'v2049' (Reservoir 7, flooded, Helix's survey raft).
//   II · THE OLD QUARTER (east island, x 44..80)  Hensel's lane on the morning of 19.10.2026, 07:52: three rows of drop
//     hammers spilled out of the house (x 50 / 56 / 62) and the shop (x 66..78).
//   III · WARD 4 (south island, z 44..80)  Halden General's Ward 4 at night, reversed; bay 4-07 and the call.
//   OPTIONAL · CENTRAL STATION (north island, x -22..2, z -72..-50)  the platform of 08:14 in 2049, the frozen train.
// Static geometry is merged per material and per state set (env_m6 Batch). Objects that belong to one zone's state
// carry that zone's states, plus every other zone's state when they are the zone's default look (st()).
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng, chronolith } from './kit.js';
import { Batch, registerM6Cast } from './env_m6.js';
import { signTex, paperTex, shardMesh } from './env_m18.js';
import { skyCity, fragments, veilMaterial, registerM19Cast, VISITORS26, CHILD_LOOK } from './env_m19.js';
import { streetKit, trainCar } from './props.js';
import { registerCast, CAST } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const PI = Math.PI;
export { shardMesh, CHILD_LOOK, VISITORS26 };

// ---------------------------------------------------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------------------------------------------------
export const HUB_S = ['kai', 'witness', 'record'];
export const VIL_S = ['bce', 'ce400', 'v2049'];
export const SOLO_S = ['clock', 'ward', 'station', 'chamber', 'free'];
export const ALL_S = [...HUB_S, ...VIL_S, ...SOLO_S];
const ZONES = [{ ids: HUB_S, def: 'kai' }, { ids: VIL_S, def: 'bce' }];
/** States an object tagged for zone states `s` is visible in: its own, plus every other zone's when it is the default look. */
export function st(...s) {
  s = s.flat(); const out = new Set(s);
  for (const z of ZONES) if (s.some(x => z.ids.includes(x)) && s.includes(z.def)) for (const id of ALL_S) if (!z.ids.includes(id)) out.add(id);
  return [...out];
}

// ---------------------------------------------------------------------------------------------------------------------
// Places (positions the mission script and the test use)
// ---------------------------------------------------------------------------------------------------------------------
export const P = {
  start: [0, 0, 9.5, PI],
  ring: [0, 3.5, -11.2], cradle: [0, 0, -11.2], rope: -6.2, gap: [-0.9, 0.9],
  kidMira: [0.1, 0, -7.1], kidKai: [0.55, 0, -5.7], mother: [2.3, 0, -4.7], rook: [-8.1, 0, -9.4], console: [-8.1, 0, -8.2],
  witness: [-3.0, 0, -2.6], ghost: [1.1, 0, -4.7], prints: [1.0, 0, -4.9], post: [0.9, 0, -6.2],
  board: [6.2, 0, -1.6], orren: [-10.0, 0.02, 9.85], hubShard: [12.6, 0.45, -15.6], page: [9.4, 0.98, 9.6],
  seamW: [-15, 0, 0], seamE: [15, 0, 0], seamS: [0, 0, 14], seamN: [-10, 0, -18],
  collar: [[-2.2, 1.2, -11.2], [2.2, 1.2, -11.2], [0, 6.0, -11.2], [0, 1.0, -9.4]],   // where each link's thread lands on the ring
  stairTop: [0, 0, -12.4], stairBot: [0, -5, -23.8], ante: [0, -5, -26.4], iris: [0, -5, -29], core: [0, -5, -37.6], stairShard: [1.3, -2.6, -18.6],
  visitors: [[-3.4, 0.2, 0.15], [-1.6, 0.0, 0.05], [-4.6, 0.8, 0.3], [3.6, 0.3, -0.2], [4.8, -0.3, -0.35], [-2.4, 1.0, 0.1], [2.6, 1.0, -0.1]],
};
export const V = {          // I · the valley
  cx: -62, entry: [-46, 0, 0, -PI / 2], wallX: -61, door: [-61, -4, 0], basinY: -4, waterY: -0.9,
  ring: [-53.5, 0, -3.5], sockets: [[-55.1, 0.9, -3.5], [-53.5, 0.9, -5.1], [-51.9, 0.9, -3.5]], endStone: [-53.5, 0.9, -1.9],
  raft: [-71, -0.5, 0], board: [-71.2, -0.5, -1.6], notice: [-49.8, 0, -6.2], seal: [-61.2, -4, 0], echo: [-62.6, -4, 0.2],
  core: [-57.4, -4, 0], card: [-60.4, -4, 0.9], page: [-46.0, 0, 3.0], shard: [-56.0, -3.55, 1.9], tala: [-66.5, -4, 3.4],
  stepsZ: [11, 14.2], slideZ: [-15, -10], keepers: [[-63.4, -4, -1.6, -PI / 2], [-64.6, -4, 1.4, -PI / 2], [-66.2, -4, -0.4, PI / 2], [-63.0, -4, 2.6, -PI * 0.6]],
};
export const C = {          // II · the Old Quarter
  entry: [46, 0, 0, PI / 2], gates: [50, 56, 62], gateDepth: 0.9, laneZ: 2.0, restarts: [[46.5, 0, 0, PI / 2], [53, 0, 0, PI / 2], [59, 0, 0, PI / 2]],
  door: [66, 0, 0], counter: [72.6, 0, 0], drawer: [72.0, 0.95, -2.0], ledger: [72.0, 0.98, 1.4], hensel: [74.0, 0, 0.3], clocks: 77.5,
  kids: [[64.6, 0, -0.5], [64.7, 0, 0.6]], mother: [60.5, 0, 3.6], page: [68.2, 0.92, 4.6], shard: [58.4, 0.5, -2.9], tower: [70.0, 13.4, 0],
};
export const H = {          // III · Ward 4
  entry: [0, 0, 47.6, 0], bed: [7.4, 0, 66], monitor: [8.6, 1.45, 64.7], window: [0, 1.9, 77.6],
  relays: [[8.6, 1.85, 64.7], [5.4, 2.95, 65.2], [0.6, 2.95, 71.0], [0, 2.55, 77.5]],
  station: [-4.2, 0, 64.6], chart: [-3.4, 1.02, 63.6], page: [-4.8, 1.02, 66.0], shard: [-6.2, 0.25, 51.4], mira: [7.4, 0.72, 66],
  hazards: { gurney: [[0.6, 0, 51.2], [0.6, 0, 55.4]], cart: [[-6.2, 0, 58.2], [-0.6, 0, 58.2]], pole: [[-1.2, 0, 60.4], [1.4, 0, 60.4]] },
};
export const N = {          // the station (optional)
  entry: [-10, 0, -50, PI], child: [-5.2, 0, -62.4], bench: [-4.0, 0, -63.6], clock: [-8, 4.3, -67.6], board: [-1.6, 2.2, -58.0],
  speaker: [-10.6, 3.6, -60.2], shard: [-12.8, 0.4, -69.0], train: [-17.4, -1.1, -61],
};

// ---------------------------------------------------------------------------------------------------------------------
// Cast (registerCast never overwrites). Every look carries era, sex/age and a COSTUMES.md archetype.
// ---------------------------------------------------------------------------------------------------------------------
const KID_KAI7 = { era: '2026', costume: 'kid_kai', sex: 0, height: 1.22, build: 0.82, age: 7, skin: 0xb98463, hair: 0x15100c, hairStyle: 'messy', eyes: 0x3d2a18, topType: 'jacket', hood: true, top: 0x2a4a6a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2f3a4e, shoes: 'shoes', boots: 0x3a2a1a };
const KID_MIRA10 = { era: '2026', costume: 'kid_mira', sex: 1, female: true, height: 1.36, build: 0.84, age: 10, skin: 0xd9a585, hair: 0x120d0b, hairStyle: 'bob', eyes: 0x2f4a3a, topType: 'sweater', top: 0x6a2a3a, topKind: 'fabric', pantsType: 'trousers', pants: 0x1f2227, shoes: 'shoes', boots: 0x3a2a1a };
const MOTHER = { era: '2026', costume: 'c26_f2', sex: 1, female: true, age: 38, height: 1.68, build: 0.98, skin: 0xc8916c, hair: 0x1e1612, hairStyle: 'bob', eyes: 0x3d2a18,
  face: { jaw: -0.2, cheek: 0.35, nose: 0.05, noseWidth: 0.0, lips: 0.2, brow: 0.0, eyeSize: 0.15, faceLength: 0.1, chin: -0.1 },
  topType: 'sweater', top: 0x4a5a6a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2a2e36, shoes: 'shoes', boots: 0x2a1d14 };
// the keepers of the valley (c. 1000 BCE): handmade tunics and wraps, frozen mid-step on the night of the burial
export const KEEPERS = [
  { era: 'ancient', costume: 'anc_m1', sex: 0, age: 34, height: 1.72, skin: 0x8c5a3a, hair: 0x15100b, hairStyle: 'short', topType: 'tunic', top: 0xb89a6a, topKind: 'fabric', sash: 0x9b3b24, pantsType: 'wraps', pants: 0x7a6248, shoes: 'sandals', boots: 0x4a3220, lod: true },
  { era: 'ancient', costume: 'anc_f1', sex: 1, female: true, age: 27, height: 1.62, skin: 0x7d4f33, hair: 0x0e0a08, hairStyle: 'long', topType: 'tunic', top: 0x3f6a6a, topKind: 'fabric', pantsType: 'wraps', pants: 0x8a7458, shoes: 'sandals', boots: 0x4a3220, lod: true },
  { era: 'ancient', costume: 'anc_m2', sex: 0, age: 61, height: 1.68, skin: 0x6b4029, hair: 0x8a8278, hairStyle: 'messy', beard: 0x8a8278, topType: 'tunic', top: 0xcdb48a, topKind: 'fabric', coat: 0x8a6a4a, coatType: 'long', pantsType: 'wraps', pants: 0x5a4632, shoes: 'sandals', boots: 0x4a3220, lod: true },
  { era: 'ancient', costume: 'anc_f2', sex: 1, female: true, age: 44, height: 1.6, skin: 0xa06a46, hair: 0x2a1c14, hairStyle: 'bun', topType: 'tunic', top: 0x9b3b24, topKind: 'fabric', sash: 0xd0a24a, pantsType: 'wraps', pants: 0x7a6248, shoes: 'sandals', boots: 0x4a3220, lod: true },
];
export const COMMUTERS49 = [
  { era: '2049', costume: 'c49_m2', sex: 0, age: 44, height: 1.78, skin: 0xc89a7a, hair: 0x2a2018, hairStyle: 'short', topType: 'jacket', top: 0x262c32, topKind: 'synthetic', coat: 0x2a3038, coatKind: 'synthetic', pantsType: 'trousers', pants: 0x1c2026, shoes: 'boots', boots: 0x141210, lod: true },
  { era: '2049', costume: 'c49_f3', sex: 1, female: true, age: 31, height: 1.66, skin: 0xe0b8a0, hair: 0x1a120e, hairStyle: 'long', topType: 'jacket', top: 0x3a2a4a, topKind: 'synthetic', pantsType: 'trousers', pants: 0x1d2430, shoes: 'boots', boots: 0x1a1612, umbrella: 0x2a3a4a, lod: true },
  { era: '2049', costume: 'transit_worker', sex: 0, age: 52, height: 1.75, skin: 0x8c5a3a, hair: 0x2a2420, hairStyle: 'buzz', topType: 'jacket', top: 0x2a3a4a, topKind: 'synthetic', vest: 0xffd34a, pantsType: 'cargo', pants: 0x23262b, shoes: 'boots', boots: 0x141210, lod: true },
];
export function registerM22Cast() {
  registerM19Cast(); registerM6Cast();
  registerCast('m22mira10', { name: 'MIRA, 10', role: 'Test Hall Zero · 19.10.2026 · 08:14:09', look: { ...KID_MIRA10 }, rimColor: 0x9a7bff, glow: 0x23183a, vp: { sex: 'f', pitch: 1.42, rate: 1.04, langs: ['en-GB', 'en-US'] } });
  registerCast('m22kai7', { name: 'KAI, 7', role: 'Test Hall Zero · 19.10.2026 · 08:14:09', look: { ...KID_KAI7 }, rimColor: 0xffd8a0, vp: { sex: 'm', pitch: 1.5, rate: 1.1, langs: ['en-GB', 'en-US'] } });
  registerCast('m22mother', { name: 'ELENA VAREN', role: 'Test Hall Zero · their mother', look: { ...MOTHER }, vp: { sex: 'f', pitch: 1.0, rate: 0.92, langs: ['en-GB', 'en-US'] } });
  registerCast('m22rook', { name: 'DR. ELIAS ROOK', role: 'Test Hall Zero · 2026',
    look: { ...(CAST.rook?.look || {}), role: 'rook', era: '2026', costume: 'rook', sex: 0, age: 39, hair: 0x3a2a20, hairStyle: 'swept', wrinkles: 0.25, recede: 0.3, glasses: true,
      topType: 'jacket', top: 0x2f3542, coat: 0xe8eaec, coatKind: 'fabric', pantsType: 'trousers', pants: 0x2a2e36, shoes: 'shoes' },
    vp: { sex: 'm', pitch: 0.96, rate: 1.02, langs: ['en-GB', 'en-US'] } });
  registerCast('m22band', { name: 'CHRONOLITH BAND', role: 'Kai\'s wrist · the first second', voice: true, vp: { sex: 'f', pitch: 1.18, rate: 1.06, langs: ['en-US', 'en-GB'] } });
  registerCast('m22wband', { name: 'THE WITNESS\'S BAND', role: '1,046 notches', voice: true, vp: { sex: 'f', pitch: 0.98, rate: 1.0, langs: ['en-GB', 'en-US'] } });
  registerCast('m22echo', { name: 'THE WITNESS · ECHO', role: 'Residue · an earlier attempt', portraitOf: 'witness', voice: true, vp: { sex: 'm', pitch: 0.72, rate: 0.86, langs: ['en-GB', 'en-US'] } });
  registerCast('m22keeper', { name: 'KEEPER', role: 'The valley · c. 1000 BCE', look: { ...KEEPERS[2], lod: false }, vp: { sex: 'm', pitch: 0.82, rate: 0.9, langs: ['en-GB', 'en-IE'] } });
  registerCast('m22pa', { name: 'CENTRAL STATION PA', role: 'Rain City · 08:14 · 2049', voice: true, vp: { sex: 'm', pitch: 0.72, rate: 0.86, langs: ['en-GB', 'en-US'] } });
  registerCast('m22nurse', { name: 'NIGHT NURSE · ECHO', role: 'Halden General · Ward 4', voice: true, vp: { sex: 'f', pitch: 1.04, rate: 0.98, langs: ['en-GB', 'en-US'] } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Music. The Unwritten Second (bible: sparse glass tones, prepared piano, low drones, silence as rhythm, motif
// fragments, 48 BPM or free time) and its rooms. Mira's three notes are E-B-A (64, 71, 69); here they come together.
// ---------------------------------------------------------------------------------------------------------------------
export const musicState = { links: 0, loop: 0, latched: 0, claims: 0, chamber: 0 };
export function registerM22Themes() {
  const motif = (a, b, t, vol, base = 64, upto = 3) => { if (b === 0 && upto > 0) a.piano(base, t, vol, 3); if (b === 6 && upto > 1) a.piano(base + 7, t, vol * 0.9, 3); if (b === 12 && upto > 2) a.piano(base + 5, t, vol, 4.4); };
  registerTheme('m22-second', { bpm: 48, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, L = musicState.links;
    if (b === 0 && bar % 2 === 0) { a.pad([28, 35, 40], t, d * 32, 0.02, 380); a.cello(28, t, d * 30, 0.03); }
    if (b === 0 && bar % 2 === 1) a.pad([31, 38, 43, 47], t, d * 16, 0.012, 520);
    if (bar % 4 === 1) motif(a, b, t, 0.03, 64, Math.min(3, 1 + L));
    if ((b === 4 || b === 11) && (bar * 7 + b) % 5 === 1) a.glass(76 + ((bar + b) % 3) * 7, t, 0.007);
    if (b === 9 && bar % 3 === 2) a.glass(83, t, 0.005);
    if (L >= 2 && b === 8 && bar % 2 === 0) a.cello(40, t, d * 8, 0.018);
  } });
  registerTheme('m22-village', { bpm: 60, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57], [43, 50, 55], [41, 48, 53], [40, 47, 52]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.013, 600); a.cello(ch[0] - 12, t, d * 16, 0.03); }
    if (b === 0 || b === 10) a.drum(t, 0.05, 110, 45);
    if (b % 4 === 2 && bar % 2) a.pluck(ch[(b >> 2) % 3] + 12, t, 0.03);
    if (b === 4 && bar % 2 === 0) a.flute(ch[2] + 12, t, d * 7, 0.014);
    if (bar % 4 === 3) motif(a, b, t, 0.02, 64, 2);
  } });
  registerTheme('m22-clock', { bpm: 72, step(a, s, t, d) {
    // nine beats to the cycle, the ninth silent (the house skips the ninth minute)
    const beat = Math.floor(s / 4), c = beat % 9, sub = s % 4, cyc = Math.floor(beat / 9);
    if (sub === 0 && c < 8) a.tick(t, 0.045, c === 0 ? 2600 : 4200);
    if (sub === 2 && c < 8) a.tick(t, 0.016, 7000);
    if (sub === 0 && c === 0) { const ch = [[50, 57, 62], [48, 55, 60], [46, 53, 58], [45, 52, 57]][cyc % 4]; a.pad(ch, t, d * 36, 0.011, 700); a.cello(ch[0] - 12, t, d * 32, 0.028); }
    if (sub === 0 && (c === 2 || c === 5)) a.pluck(62 + (c === 5 ? 3 : 0) + (cyc % 2) * 2, t, 0.03);
    if (sub === 0 && c === 8 && musicState.loop > 0) a.glass(81, t, 0.008);
  } });
  registerTheme('m22-ward', { bpm: 54, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[38, 45, 50, 53], [36, 43, 48, 52], [34, 41, 46, 50], [33, 40, 45, 48]][bar % 4];
    if (b === 0) a.pad(ch, t, d * 16, 0.016, 420);
    if (b === 12) a.pad([ch[3] + 12], t, d * 4, 0.01, 900);
    if (b === 0 || b === 8) a.tick(t, 0.02, 1800);
    if (bar % 2 === 1 && (b === 2 || b === 6 || b === 10)) a.piano([76, 71, 69][(b - 2) / 4], t, 0.018 + 0.006 * musicState.latched, 2.4);
    if (b === 14 && bar % 4 === 3) a.glass(88, t, 0.006);
  } });
  registerTheme('m22-evidence', { bpm: 66, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, root = [40, 41, 38, 36][bar % 4];
    if (b === 0) { a.pad([root, root + 7, root + 12], t, d * 16, 0.012, 500); a.cello(root - 12, t, d * 14, 0.03); }
    if (b % 4 === 0) a.tick(t, 0.025, 3200);
    if (b === 6 || b === 14) a.pluck(root + 19 + (bar % 2) * 2, t, 0.02);
    if (bar % 4 === 2) motif(a, b, t, 0.018, 64, 1 + Math.min(2, musicState.claims >> 1));
  } });
  registerTheme('m22-chamber', { bpm: 56, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[40, 47, 52, 56], [45, 52, 57, 60], [36, 43, 48, 52], [38, 45, 50, 54]][bar % 4], k = musicState.chamber;
    if (b === 0) { a.pad(ch, t, d * 16, 0.016 + k * 0.004, 500 + k * 200); a.cello(ch[0] - 12, t, d * 16, 0.04); }
    if (k >= 1 && b === 8) a.cello(ch[1], t, d * 8, 0.026);
    motif(a, b, t, 0.03 + k * 0.006, 64, 3);
    if (k >= 2 && b % 2 === 0) a.pluck(ch[(b >> 1) % 4] + 24, t, 0.012);
    if (b === 0 && bar % 2) a.drum(t, 0.04, 80, 36);
  } });
  registerTheme('m22-reveal', { bpm: 62, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = [[40, 47, 52, 55], [36, 43, 48, 52], [43, 50, 55, 59], [38, 45, 50, 54]][bar % 4];
    if (b === 0) { a.cello(ch[0] - 12, t, d * 16, 0.05); if (bar >= 2) a.pad(ch, t, d * 16, 0.012 + Math.min(0.02, bar * 0.002), 700); }
    if (b === 0 || b === 8) a.piano(ch[2] + 12, t, 0.03, 3);
    if (b === 4 || b === 12) a.piano(ch[3] + 12, t, 0.02, 2.4);
    if (bar % 2 === 1) motif(a, b, t, 0.034, 64, 3);
  } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Code-drawn signs, papers, screens
// ---------------------------------------------------------------------------------------------------------------------
const grain = (g, w, h, n, a, seed = 3) => { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * a})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } };
const wrap = (g, text, x, y, maxW, lh) => { const words = text.split(' '); let line = '', yy = y; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; } if (line) g.fillText(line, x, yy); return yy; };
export const TEX = {
  banner: () => signTex('m22banner', [['HELIX TEMPORAL RESEARCH', 34, '#1a1a1a'], ['OPEN DAY · 19 · 10 · 2026', 52, '#1a1a1a'], ['Test Hall Zero · RUN 01 · 08:14', 26, '#2a2a2a']], { bg: '#f2f0ea', border: '#5fa8c8', w: 1024, h: 256 }),
  hallSign: () => signTex('m22hall', [['TEST HALL ZERO', 46, '#1a1a1a'], ['STAY BEHIND THE ROPE', 26, '#8a1a1a']], { bg: '#e8c020', border: '#1a1a1a', h: 192 }),
  siteZero: () => signTex('m22site', [['SITE ZERO', 52, '#e8eef0'], ['NO VISITORS BEYOND THIS POINT', 22, '#ffd34a']], { bg: '#1c2228', border: '#ffd34a', h: 192 }),
  console: (log) => canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#071216'; g.fillRect(0, 0, w, h); g.fillStyle = '#5fe6ff'; g.font = `700 22px ${FONT}`; g.fillText('HELIX · TEST HALL ZERO · RUN 01', 18, 34);
    g.fillRect(18, 44, w - 36, 2); g.font = `600 19px ${FONT}`;
    const rows = log ? ['08:14:00  RUN 01 start (scheduled)', '08:14:02  field 4.1 kHz · nominal', '08:14:02  AUDIO INPUT, UNSCHEDULED:', '          3 tones  E · B · A  source: FIELD', '08:14:07  visitor barrier: OPEN', '08:14:09  OPERATOR OVERRIDE: K. VAREN', '08:14:09  field: — — —'] : ['RUN 01 · 08:14:00', 'FIELD  4.1 kHz', 'STATUS  —'];
    rows.forEach((r, i) => { g.fillStyle = /OVERRIDE|UNSCHEDULED|OPEN|E · B/.test(r) ? '#ffb070' : '#bfeefa'; g.fillText(r, 18, 78 + i * 33); });
  }, 'm22console' + log),
  rope: () => signTex('m22rope', [['PLEASE STAY BEHIND', 30, '#f0e0c0'], ['THE ROPE', 30, '#f0e0c0']], { bg: '#3a1a1a', h: 128, w: 384 }),
  survey: () => paperTex('m22survey', 'RESERVOIR 7 · DAM INSPECTION', ['02.2031 · sonar run 14, old east channel', 'Rectangular opening in the retaining wall.', 'Carved lintel. Lime seal intact, CHAMBER DRY.', '', 'Divers recovered: one core, ceramic matrix,', 'superconducting seams. INTACT. Still warm.', '', 'Designation: SITE 0. Core to Helix Lab 1.', 'Authorised: E. Rook.'], { bg: '#e8ecee', ink: '#14202a' }),
  notice: () => signTex('m22notice', [['HELIX WATER AUTHORITY', 30, '#e8eef0'], ['RESERVOIR 7 · NO SWIMMING', 40, '#ffffff'], ['Survey raft: authorised staff only', 22, '#ffd34a']], { bg: '#1a3a5a', border: '#e8eef0', h: 256 }),
  seal: () => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d8d0bc'; g.fillRect(0, 0, w, h); grain(g, w, h, 3000, 0.1, 9);
    g.strokeStyle = '#6a5a44'; g.lineWidth = 10; g.beginPath(); g.arc(256, 230, 130, 0, PI * 2); g.stroke();
    for (let i = 0; i < 212; i++) { const a = i / 212 * PI * 2; g.lineWidth = i % 10 === 9 ? 5 : 2.4; g.beginPath(); g.moveTo(256 + Math.cos(a) * 140, 230 + Math.sin(a) * 140); g.lineTo(256 + Math.cos(a) * (i % 10 === 9 ? 172 : 160), 230 + Math.sin(a) * (i % 10 === 9 ? 172 : 160)); g.stroke(); }
    g.fillStyle = '#5a4a34'; g.font = `700 40px ${SERIF}`; g.textAlign = 'center'; g.fillText('LET NO ONE OPEN IT', 256, 440);
    g.font = `600 26px ${SERIF}`; g.fillText('not even the one who closed it', 256, 482);
  }, 'm22seal'),
  ledger: () => paperTex('m22ledger', 'HENSEL · REPAIRS · OCTOBER 2026', ['19.10  Varen. Boy\'s watch, new crystal.', '       Collect 08:30, Mrs V. with both children.', '', '19.10  07:52. The Varen children at the door.', '       Did as the man with his face asked.', '       Not inside. Not today. Told them to go', '       up the hill to the Helix open day.', '       God forgive me if that was wrong.'], { hand: true, ink: '#2a1a10', bg: '#e8dcc0' }),
  letter: () => paperTex('m22letter', 'Oskar,', ['On the nineteenth the Varen children will', 'come to your door at ten to eight.', 'Do not let them in. Send them away.', 'Keep the boy from the ninth minute.', '', 'You will not believe me. Do it anyway.', '', '                   K.   (attempt 1)'], { hand: true, ink: '#1a2a48', bg: '#ece4d2' }),
  chart: () => paperTex('m22chart', 'WARD 4 · BAY 4-07 · OBSERVATIONS', ['Occupied since 19.10.2026 08:14 (no patient)', 'Bed load 54 kg · HR monitor: 3 tones, repeating', 'Tone source: NOT this bay. Check line.', '', 'Night note: the tone gets QUIETER as you walk in.', 'Same every night. Same three notes.', 'Somebody is calling her.'], { ink: '#14202a', bg: '#eef0ee' }),
  journal: (n) => paperTex('m22jr' + n, ['ATTEMPT 0001', 'ATTEMPT 0212', 'ATTEMPT 0730', 'ATTEMPT 1045'][n], [
    ['Wrote to the clockmaker. If they never reach', 'the hall, there is no hall. Simple.', 'They reached the hall. Earlier than before.'],
    ['Took the core back three thousand years.', 'Had the keepers wall it in. Nobody will dig', 'in a valley that floods. Helix dug in 2031.'],
    ['Went into the hall myself. Pulled the boy', 'back from the ring. He let go of her hand.', 'She went alone. That is my first memory.'],
    ['Calling her pattern home through Halden.', 'Three notes. She always came to that tune.', 'Tomorrow: attempt 1046. The last one.'],
  ][n], { hand: true, ink: '#3a1a10', bg: '#dcd2bc' }),
  departures: () => signTex('m22dep', [['CENTRAL · PLATFORM 2', 28, '#ffd34a'], ['08:14  METRO LINE 4  — — —', 30, '#e8eef0'], ['DELAYED · TIME UNKNOWN', 26, '#ff6a4a']], { bg: '#06080c', border: '#ffd34a', h: 220 }),
  childNote: () => paperTex('m22child', 'A drawing in crayon', ['A girl in a yellow coat at a front door.', 'A man in grey at the end of the street,', 'humming. Three little notes over his head.', '', '"THANK YOU FOR THE SONG"'], { hand: true, ink: '#a02020', bg: '#f4eedc' }),
  wardSign: () => signTex('m22ward', [['HALDEN GENERAL', 30, '#e8eef0'], ['WARD 4 · NEUROLOGY', 40, '#ffffff'], ['Bays 4-01 – 4-08', 22, '#a8d8ff']], { bg: '#14324a', border: '#a8d8ff', h: 256 }),
  bay: (id) => signTex('m22bay' + id, [[id, 64, '#14202a']], { bg: '#eef2f4', border: '#5a7a8a', h: 160, w: 256 }),
  shop: () => signTex('m22shop', [['O. HENSEL', 54, '#e8d8b0', 700, SERIF], ['Uhrmacher · Clockmaker · est. 1961', 24, '#c8b890', 600, SERIF]], { bg: '#2a1a10', border: '#b89a5a', w: 1024, h: 220 }),
  link: (n, title, sub) => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#0e0c12'; g.fillRect(0, 0, w, h); g.strokeStyle = ['#e8c070', '#ffd8a0', '#a8d8ff', '#ff8a6a'][n]; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = g.strokeStyle; g.textAlign = 'center'; g.font = `700 30px ${FONT}`; g.fillText(['I', 'II', 'III', 'IV'][n], w / 2, 54);
    g.font = `700 36px ${FONT}`; g.fillText(title, w / 2, 118); g.fillStyle = '#e8e4f0'; g.font = `500 22px ${FONT}`; wrap(g, sub, w / 2, 168, w - 40, 28);
  }, 'm22link' + n + title),
  claim: (title, verdict) => canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = verdict === 'record' ? '#0c1a14' : verdict === 'memory' ? '#1a1024' : '#101418'; g.fillRect(0, 0, w, h);
    g.strokeStyle = verdict === 'record' ? '#b6ff8a' : verdict === 'memory' ? '#c8a8ff' : '#5a6a7a'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#e8eef0'; g.font = `600 24px ${FONT}`; g.textAlign = 'left'; wrap(g, title, 20, 48, w - 40, 30);
    g.font = `700 18px ${FONT}`; g.fillStyle = g.strokeStyle; g.fillText(verdict === 'record' ? 'BACKED BY THE RECORD' : verdict === 'memory' ? 'MEMORY ONLY' : 'UNSORTED', 20, h - 20);
  }, 'm22claim' + title + verdict),
};
/** A clock face with hands (h, m; null for no hands). opts: aged, dark (a stopped, unlit face), label, nine (a count dial 1..9). */
export function dialTex(h, m, o = {}) {
  return canvasTex(256, 256, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#2a2016'; g.fillRect(0, 0, w, w);
    g.beginPath(); g.arc(c, c, c - 4, 0, PI * 2); g.fillStyle = o.dark ? '#3a342c' : o.aged ? '#e2d2a8' : '#f0e8d4'; g.fill();
    g.strokeStyle = o.dark ? '#5a5046' : '#1c1610'; g.lineWidth = 5; g.beginPath(); g.arc(c, c, c - 10, 0, PI * 2); g.stroke();
    const n = o.nine ? 9 : 60;
    for (let k = 0; k < n; k++) { const a = k / n * PI * 2, big = o.nine || k % 5 === 0, r0 = c - (big ? 34 : 22); g.lineWidth = big ? 5 : 2; g.beginPath(); g.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0); g.lineTo(c + Math.sin(a) * (c - 14), c - Math.cos(a) * (c - 14)); g.stroke(); }
    g.fillStyle = o.dark ? '#5a5046' : '#1c1610'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 ${o.nine ? 30 : 24}px ${SERIF}`;
    const nums = o.nine ? 9 : 12;
    for (let k = 0; k < nums; k++) { const a = (o.nine ? k : k) / nums * PI * 2, rr = c - (o.nine ? 58 : 52); const t = o.nine ? String(k + 1) : ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][k]; if (o.nine && k === 8) { g.fillStyle = '#a0281c'; } g.fillText(t, c + Math.sin(a) * rr, c - Math.cos(a) * rr); g.fillStyle = o.dark ? '#5a5046' : '#1c1610'; }
    if (o.label) { g.font = `700 22px ${SERIF}`; g.fillText(o.label, c, c + 40); }
    if (h != null) {
      const hand = (a, l, wd) => { g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(a) * l, c - Math.cos(a) * l); g.stroke(); };
      g.strokeStyle = '#1c1610'; hand(((h % 12) + m / 60) / 12 * PI * 2, c * 0.45, 9); hand(m / 60 * PI * 2, c * 0.68, 5);
    }
    if (o.aged) { const r = rng(7); for (let k = 0; k < 200; k++) { g.fillStyle = `rgba(90,60,20,${r() * 0.07})`; g.beginPath(); g.arc(r() * w, r() * w, 4 + r() * 20, 0, 7); g.fill(); } }
  }, 'm22dial' + h + '_' + m + JSON.stringify(o));
}
export function pictureMat(tex, emiss = 0.25, o = {}) { return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emiss, side: THREE.DoubleSide, ...o }); }

// ---------------------------------------------------------------------------------------------------------------------
// Kit: per-state batches (state lists), collision, light sources, planes
// ---------------------------------------------------------------------------------------------------------------------
function mkKit(game, scene, T, name, parent = scene) {
  const col = game.collision, root = new THREE.Group(); root.name = name; parent.add(root);
  const BS = new Map();
  const norm = (e) => (e && e !== 'all' ? [].concat(e) : null);
  const bat = (e) => { const s = norm(e), k = s ? s.join('|') : 'all'; let b = BS.get(k); if (!b) BS.set(k, b = { b: new Batch(), s }); return b.b; };
  const box = (x0, y0, z0, x1, y1, z1, e, o = {}) => { const s = norm(e); return col.add([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], s ? { states: s, ...o } : o); };
  const solid = (mat, x0, y0, z0, x1, y1, z1, e) => { bat(e).box(mat, x0, y0, z0, x1, y1, z1); return box(x0, y0, z0, x1, y1, z1, e); };
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  const lightSrc = [];
  const src = (x, y, z, c, i, d, e) => lightSrc.push({ p: [x, y, z], c, i, d, states: norm(e) });
  const add = (obj, e, p = root) => { p.add(obj); const s = norm(e); if (s) T.only(obj, ...s); return obj; };
  const plane = (tex, w, h, x, y, z, ry, emiss = 0.25, e, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pictureMat(tex, emiss, { transparent: true }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ'); m.userData.noBatch = true; return add(m, e);
  };
  const ramp = (min, max, dir, low, e) => { const s = norm(e); return col.addRamp(min, max, dir, { low, ...(s ? { states: s } : {}) }); };
  const finish = () => { for (const { b, s } of BS.values()) { const g = new THREE.Group(); b.build(g, { name: name + '-' + (s ? s[0] : 'all') }); add(g, s); } BS.clear(); };
  return { root, bat, box, solid, pm, src, lightSrc, add, plane, ramp, finish };
}

// shared materials (one cache per scene build)
function materials(K) {
  const { pm } = K;
  return {
    floor: pm('concrete', { color: 0x9a9a96, formwork: 0, stains: 0.35, pores: 0.02 }), wall: pm('concrete', { color: 0xb4b6b4, formwork: 1, stains: 0.25 }),
    dark: pm('concrete', { color: 0x3a3c40, formwork: 0, stains: 0.45 }), rock: pm('rock', { color: 0x6a645c, color2: 0x4a443c, lichen: 0.2 }),
    panel: pm('paintedMetalPanel', { color: 0xdfe3e6, cols: 4, rows: 2, wear: 0.08, grime: 0.15, gloss: 0.5 }), steel: pm('brushedMetal', { color: 0x8a8e92, roughness: 0.35 }),
    yellow: pm('paintedMetalPanel', { color: 0xd8b020, cols: 1, rows: 1, wear: 0.25, grime: 0.25, gloss: 0.5 }), desk: pm('wood', { color: 0xc8b49a, planks: 1 }),
    rubber: pm('rubber', { color: 0x1a1a1a }), red: new THREE.MeshStandardMaterial({ color: 0x8a1a2a, roughness: 0.7 }),
    stone: pm('cutStone', { color: 0xb3a58c, joint: 0x857c6e, weathering: 0.6 }), stoneDark: pm('cutStone', { color: 0x7a7060, joint: 0x5a5248, weathering: 0.8 }),
    plaster: pm('plaster', { color: 0xc9bca4, damage: 0.3, dirt: 0.4 }), dirt: pm('dirt', { color: 0x5a4532, damp: 0.4 }), grass: pm('grass', { color: 0x4f6a2a, dryness: 0.35 }),
    wood: pm('wood', { color: 0x6a4a2e, planks: 6, weathered: 0.6 }), moss: pm('moss', { color: 0x3d5a1c }), rust: pm('rust', { color: 0x5a2a12, amount: 0.5 }),
    brick: pm('brick', { color: 0x7d3a26, soot: 0.3 }), cobble: pm('cutStone', { color: 0x6a645a, joint: 0x3a3630, rows: 12, weathering: 0.4 }),
    tile: pm('ceramicTile', { color: 0xd8dcd8 }), wardFloor: pm('concrete', { color: 0x8a948e, formwork: 0, stains: 0.15, pores: 0.01 }),
    asphalt: pm('wetAsphalt', { color: 0x2e3032, puddles: 0.4 }), gravel: pm('gravel', { color: 0x6e6a64 }),
    brass: pm('brushedMetal', { color: 0xb08a4a, roughness: 0.3 }), glass: new THREE.MeshPhysicalMaterial({ color: 0x9ab4c0, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.25 }),
    curtain: new THREE.MeshStandardMaterial({ color: 0x8ab0b8, roughness: 0.9, side: THREE.DoubleSide }), sheet: new THREE.MeshStandardMaterial({ color: 0xe8ecee, roughness: 0.9 }),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Small parts
// ---------------------------------------------------------------------------------------------------------------------
function footprints(K, list, mat, e) {
  for (const [x, z, ry, s = 1] of list) { const g = new THREE.Mesh(new THREE.PlaneGeometry(0.12 * s, 0.28 * s), mat); g.rotation.set(-PI / 2, 0, ry); g.position.set(x, 0.012, z); g.userData.noBatch = true; K.add(g, e); }
}
function thread(points, color, radius = 0.025) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  m.userData.noBatch = true; m.frustumCulled = false; return m;
}
function hammer(K, M, x, z, e) {   // a clockwork drop hammer: frame, the head (animated), the anvil plate
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const head = new THREE.Group(); g.add(head);
  const hm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.2), M.brass); hm.position.y = 0.28; hm.castShadow = true; head.add(hm);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), M.steel); rod.position.y = 1.75; head.add(rod);
  K.add(g, e);
  g.userData.head = head;
  return g;
}

// =====================================================================================================================
// BUILD: the whole world (hub, islands, chamber, station, sky)
// =====================================================================================================================
export function buildWorld(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low';
  const W = { lightSrc: [], islands: {}, threads: [], updaters: [] };
  const mk = (name, parent) => { const K = mkKit(game, scene, T, name, parent); W.lightSrc.push(K.lightSrc); return K; };
  const K0 = mk('m22-hub');
  const M = materials(K0);
  buildSky(scene, W, low);
  buildHub(game, K0, M, W, low);
  buildChamber(game, mk('m22-chamber'), M, W);
  W.islands.village = buildVillage(game, mk('m22-village'), M, W, low, T);
  W.islands.clock = buildClock(game, mk('m22-clock'), M, W, low);
  W.islands.ward = buildWard(game, mk('m22-ward'), M, W);
  W.islands.station = buildStation(game, mk('m22-station'), M, W, low);
  W.lightSrc = W.lightSrc.flat();
  W.update = (dt, t) => { for (const f of W.updaters) f(dt, t); };
  return W;
}

function buildSky(scene, W, low) {
  const sc = skyCity(low, 2201, 260); scene.add(sc);
  const fr = fragments([[-34, 14, -40, 4], [38, 18, -32, 5], [-30, 22, 36, 3.5], [42, 9, 34, 3], [0, 26, -70, 6], [-70, 16, 30, 4], [72, 20, -30, 4.5], [22, -14, 30, 5], [-22, -16, -24, 6], [70, -12, 26, 4], [-74, -10, -26, 4], [8, 32, 20, 3]], 2203);
  scene.add(fr); W.updaters.push((dt, t) => fr.userData.update(t));
  // motes of stopped rain in the first second (a few hundred points, no per-frame cost but a time uniform)
  const n = low ? 260 : 600, pos = new Float32Array(n * 3), r = rng(2209);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 70; pos[i * 3 + 1] = r() * 16; pos[i * 3 + 2] = (r() - 0.5) * 60 - 2; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff0d8, size: 0.06, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.userData.noBatch = true; scene.add(pts); W.motes = pts;
}

// ---------------------------------------------------------------------------------------------------------------------
// THE HALL: Test Hall Zero at 08:14:09, roof torn away, its four walls broken where other places lean in
// ---------------------------------------------------------------------------------------------------------------------
function buildHub(game, K, M, W, low) {
  const { solid, box, bat, add, plane, src } = K, R = rng(2210);
  // the slab the hall stands on: a floating block of concrete and rock (its underside hangs into the void)
  bat().box(M.rock, -17.5, -9, -47.5, 17.5, -0.62, 16.5);
  bat().box(M.rock, -12, -14, -32, 10, -9, 8); bat().box(M.rock, -6, -19, -20, 5, -14, -2);
  // floor (a hole for the stair behind the ring: x -1.6..1.6, z -18..-12.6)
  solid(M.floor, -15, -0.6, -12.6, 15, 0, 14); solid(M.floor, -15, -0.6, -18, -1.6, 0, -12.6); solid(M.floor, 1.6, -0.6, -18, 15, 0, -12.6);
  W.stairCover = box(-1.6, -0.6, -18, 1.6, 0, -12.6);
  W.coverMesh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 5.4), M.steel); W.coverMesh.position.set(0, -0.15, -15.3); W.coverMesh.userData.noBatch = true; W.coverMesh.receiveShadow = true; add(W.coverMesh);
  // the yard north of the hall (thin slab: the stair passes under it)
  solid(M.dark, -17, -0.3, -47, 17, 0, -18.4);
  // safety lines on the floor
  for (const [x0, z0, x1, z1] of [[-7.4, -6.35, 7.4, -6.05], [-7.4, -16.8, -7.1, -6.2], [7.1, -16.8, 7.4, -6.2], [-7.4, -16.8, 7.4, -16.5]]) bat().box(M.yellow, x0, 0, z0, x1, 0.012, z1);
  // walls: concrete with broken tops, gaps where the other places come in (W z -4..4, E z -4..4, S x -4..4, N x -12..-8)
  const wallRun = (axis, c, a0, a1, top, thick = 0.5) => {
    let a = a0; while (a < a1 - 0.01) { const len = Math.min(a1 - a, 1.6 + R() * 2.2), h = top - R() * 3.4 * (R() < 0.6 ? 1 : 0.3);
      if (axis === 'x') solid(M.wall, a, 0, c - thick / 2, a + len, h, c + thick / 2); else solid(M.wall, c - thick / 2, 0, a, c + thick / 2, h, a + len); a += len; }
  };
  wallRun('z', -15.25, -18, -4, 9); wallRun('z', -15.25, 4, 14, 8);
  wallRun('z', 15.25, -18, -4, 9); wallRun('z', 15.25, 4, 14, 8);
  wallRun('x', -18.2, -15.5, -12, 9.5); wallRun('x', -18.2, -8, 15.5, 9.5);
  wallRun('x', 14.25, -15.5, -4, 7); wallRun('x', 14.25, 4, 15.5, 7);
  // broken edges at the seams: rebar stubs, a fallen truss, cable trays
  for (const [x, z] of [[-15.2, -4], [-15.2, 4], [15.2, -4], [15.2, 4], [-4, 14.2], [4, 14.2], [-12, -18.2], [-8, -18.2]]) for (let k = 0; k < 4; k++) bat().cyl(M.rust, x + (R() - 0.5) * 0.4, 1.2 + k * 1.3, z + (R() - 0.5) * 0.4, 0.018, 0.9, 5, [R() * 0.6, 0, R() * 0.6]);
  for (let zz = -16; zz < 13; zz += 6) bat().box(M.steel, -15, 8.2 + (zz % 4) * 0.1, zz - 0.14, -6 + R() * 3, 8.5, zz + 0.14);
  bat().boxc(M.steel, 6.5, 1.1, 9.5, 9, 0.3, 0.3, 0.3, 0, 0.12); bat().boxc(M.steel, -9.5, 0.5, -15.6, 7, 0.28, 0.28, -0.5, 0, 0.08);
  // floating roof pieces and trusses above (the roof is rising away)
  for (let i = 0; i < 9; i++) { const x = (R() - 0.5) * 26, z = -16 + R() * 28, y = 12 + R() * 9; bat().boxc(i % 3 ? M.dark : M.steel, x, y, z, 3 + R() * 5, 0.35, 1.2 + R() * 2, R() * PI, (R() - 0.5) * 0.4, (R() - 0.5) * 0.3); }
  // the cradle and the ring
  solid(M.steel, -2.6, 0, -12.4, 2.6, 0.6, -10.0); bat().box(M.dark, -0.7, 0.6, -11.6, 0.7, 1.05, -10.8);
  for (const s of [-1, 1]) { solid(M.steel, s * 2.9 - 0.25, 0, -11.45, s * 2.9 + 0.25, 4.0, -10.95); bat().boxc(M.steel, s * 2.55, 3.9, -11.2, 0.9, 0.3, 0.4, 0, 0, s * 0.4); }
  const ring = chronolith(1.2, { color: 0x5fe6ff, power: 0.35 }); ring.position.set(...P.ring); add(ring); W.ring = ring;
  W.updaters.push((dt, t) => ring.userData.update?.(t * 0.05));
  // the rope line (posts, the rope, the open hook) and the gap the children stand in
  for (let x = -7; x <= 7.01; x += 1.4) { if (Math.abs(x) < 0.5) continue; bat().cyl(M.steel, x, 0.48, P.rope, 0.035, 0.96, 8); bat().cyl(M.steel, x, 0.02, P.rope, 0.16, 0.04, 12); }
  bat().cyl(M.steel, 0.9, 0.48, P.rope, 0.035, 0.96, 8); bat().cyl(M.steel, -0.9, 0.48, P.rope, 0.035, 0.96, 8);
  const rope = (x0, x1, e) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, Math.abs(x1 - x0), 6), M.red); m.rotation.z = PI / 2; m.position.set((x0 + x1) / 2, 0.86, P.rope); m.userData.noBatch = true; return add(m, e); };
  rope(-7, -0.9); rope(0.9, 7);
  W.ropeGapKai = rope(-0.9, 0.9, st('kai'));                      // Kai remembers the rope closed
  W.ropeGapWit = rope(-0.9, 0.9, ['witness']);                  // ... so does the Witness
  const hookLie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12), M.steel); hookLie.position.set(1.25, 0.02, P.rope + 0.35); hookLie.rotation.x = PI / 2; add(hookLie, ['record']);
  const ropeLie = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), M.red); ropeLie.rotation.set(0, 0.35, PI / 2); ropeLie.position.set(0.25, 0.03, P.rope + 0.2); add(ropeLie, ['record']);
  box(-7.2, 0, P.rope - 0.08, -0.9, 1.0, P.rope + 0.08); box(0.9, 0, P.rope - 0.08, 7.2, 1.0, P.rope + 0.08);
  plane(TEX.rope(), 1.2, 0.4, -4.5, 1.25, P.rope + 0.05, 0, 0.2);
  // the cuff thread on the post (record), at a seven-year-old's hand height
  W.cuff = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 4, 10), glowMat(0x2a6aa8, 0.8)); W.cuff.position.set(0.92, 0.88, P.rope + 0.05); add(W.cuff, ['record']);
  // footprints in the record: two children, the mother, and a man's heavy boots behind the boy
  const fpMat = new THREE.MeshBasicMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  const bootMat = new THREE.MeshBasicMaterial({ color: 0xffa080, transparent: true, opacity: 0.65, depthWrite: false, toneMapped: false });
  footprints(K, [[0.2, -5.0, 0, 0.7], [0.05, -5.8, 0, 0.7], [0.2, -6.6, 0, 0.7], [0.1, -7.2, 0, 0.7], [0.7, -4.6, 0, 0.62], [0.55, -5.4, 0, 0.62], [2.4, -4.2, 0.2], [2.3, -4.9, 0.2]], fpMat, ['record']);
  footprints(K, [[1.35, -3.6, 0.15, 1.25], [1.15, -4.3, 0.1, 1.25], [1.25, -5.05, 0.05, 1.25], [1.05, -4.8, -0.2, 1.25]], bootMat, ['record']);
  // the ghost of the hand (as the Witness remembers it: a man's shape behind him, no face)
  // the console desk (Rook's), the screen per holder; the evidence board
  solid(M.desk, -9.4, 0.92, -8.9, -6.8, 0.98, -7.5); bat().box(M.steel, -9.3, 0, -8.8, -6.9, 0.92, -7.6);
  W.screen = plane(TEX.console(false), 0.9, 0.56, P.console[0], 1.36, P.console[2] - 0.62, 0, 0.9, st('kai', 'witness'));
  W.screenRec = plane(TEX.console(true), 0.9, 0.56, P.console[0], 1.36, P.console[2] - 0.62, 0, 1.0, ['record']);
  bat().box(M.steel, P.console[0] - 0.5, 0.98, P.console[2] - 0.7, P.console[0] + 0.5, 1.05, P.console[2] - 0.55);
  // the evidence board (a Helix display stand)
  solid(M.steel, P.board[0] - 1.3, 0, P.board[2] - 0.12, P.board[0] + 1.3, 0.12, P.board[2] + 0.12);
  bat().box(M.dark, P.board[0] - 1.25, 0.12, P.board[2] - 0.05, P.board[0] + 1.25, 2.4, P.board[2] + 0.05);
  W.claimCards = [0, 1, 2, 3, 4].map(i => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.34), pictureMat(TEX.claim('—', 'none'), 0.6)); m.position.set(P.board[0] - 0.58 + (i % 2) * 1.16, 2.05 - Math.floor(i / 2) * 0.42, P.board[2] + 0.07); m.userData.noBatch = true; add(m); return m; });
  // banners, signs, the foyer partition stubs and the visitors' benches
  plane(TEX.banner(), 7, 1.75, 0, 7.4, -17.9, 0, 0.35); plane(TEX.hallSign(), 2.4, 0.9, -12.5, 2.6, -17.9, 0, 0.3); plane(TEX.siteZero(), 1.8, 0.68, 4.2, 1.5, -17.9, 0, 0.3);
  for (const [a, b] of [[-15, -11], [-8, -5], [5, 8], [11, 15]]) solid(M.panel, a, 0, 6.2, b, 3.2 + R() * 1.0, 6.5);
  for (const x of [-10, -4, 4, 10]) { solid(M.desk, x - 1.4, 0.42, 9.6, x + 1.4, 0.48, 10.2); bat().box(M.steel, x - 1.3, 0, 9.7, x - 1.2, 0.42, 10.1); bat().box(M.steel, x + 1.2, 0, 9.7, x + 1.3, 0.42, 10.1); }
  solid(M.desk, 8.6, 0.9, 9.2, 10.2, 0.96, 10.2); bat().box(M.steel, 8.7, 0, 9.3, 10.1, 0.9, 10.1);
  for (const [x, zz] of [[9.4, -10], [10.2, -6]]) { bat().cyl(M.dark, x, 1.3, zz, 0.03, 1.4, 6); bat().box(M.dark, x - 0.15, 1.95, zz - 0.25, x + 0.15, 2.2, zz + 0.1); }
  // cable runs from the cradle to the console and the gantry
  for (const s of [-1, 1]) bat().box(M.rubber, s * 2.6, 0, -10.4, s * 2.6 + s * 5.2, 0.06, -10.2);
  bat().box(M.rubber, -7.8, 0, -10.4, -7.6, 0.06, -8.9);
  // crates and a gantry ladder in the corners (cover / dressing; Orren sits on a crate)
  for (const [x, zz] of [[-12.4, 8.6], [-13.2, 10.6], [12.8, -14.6], [13.2, -12.4], [-13, -15.8]]) solid(M.wood, x - 0.6, 0, zz - 0.5, x + 0.6, 0.9, zz + 0.5);
  // lab equipment: racks on the east wall with status LEDs, the gantry crane over the cradle, cable trench covers
  for (let i = 0; i < 5; i++) { const z = -16.4 + i * 2.1; solid(M.panel, 13.4, 0, z, 14.9, 2.3, z + 1.7); for (let k = 0; k < 4; k++) bat().box(glowMat(k % 3 ? 0x5fe6ff : 0xffb347, 0.9), 13.36, 0.6 + k * 0.42, z + 0.25, 13.4, 0.66 + k * 0.42, z + 0.55); }
  for (const s of [-1, 1]) solid(M.yellow, s * 9.2 - 0.3, 0, -13.2, s * 9.2 + 0.3, 7.6, -12.6);
  bat().box(M.yellow, -9.5, 7.6, -13.3, 9.5, 8.2, -12.5); bat().box(M.dark, -0.6, 6.6, -13.1, 0.6, 7.6, -12.7); bat().cyl(M.steel, 0, 5.6, -12.9, 0.02, 2.0, 4);
  for (const [x0, x1] of [[-7.4, -3.0], [3.0, 7.4]]) bat().box(M.steel, x0, 0, -10.9, x1, 0.02, -10.5);
  bat().box(M.steel, -7.7, 0, -10.6, -7.3, 0.02, -6.4);
  for (const [x, zz] of [[11.6, 2.4], [12.6, 3.6], [-12.8, 3.2]]) { solid(M.panel, x - 0.55, 0, zz - 0.45, x + 0.55, 1.1, zz + 0.45); bat().box(M.yellow, x - 0.56, 0.9, zz - 0.46, x + 0.56, 0.98, zz + 0.46); }
  // broken guard rails along the bridges
  for (const [x0, x1] of [[-42, -34], [-28, -22], [18, 26], [32, 40]]) for (const sz of [-1.75, 1.75]) { bat().box(M.steel, x0, 1.0, sz - 0.03, x1, 1.06, sz + 0.03); for (let x = x0; x <= x1; x += 2) bat().box(M.steel, x - 0.03, 0, sz - 0.03, x + 0.03, 1.06, sz + 0.03); }
  for (const [z0, z1] of [[18, 26], [32, 40]]) for (const sx of [-1.75, 1.75]) { bat().box(M.steel, sx - 0.03, 1.0, z0, sx + 0.03, 1.06, z1); for (let z = z0; z <= z1; z += 2) bat().box(M.steel, sx - 0.03, 0, z - 0.03, sx + 0.03, 1.06, z + 0.03); }
  // the visitors' pen in Kai's memory (people stand there: block it in his holder)
  box(-5.2, 0, -1.2, 5.6, 2, 1.4, st('kai'));
  // the threads of the found links: from each collar into the sky (alpha animated by the mission)
  const TH = [[0xe8c070, [[-2.4, 3.6, -11.2], [-6, 11, -9], [-24, 16, -3], [-50, 9, 0]]], [0xffd8a0, [[2.4, 3.6, -11.2], [6, 11, -9], [24, 16, -3], [50, 9, 0]]], [0xa8d8ff, [[0, 6.3, -11.2], [0, 13, -6], [0, 16, 18], [0, 8, 50]]], [0xff8a6a, [[0, 0.9, -11.2], [0.4, 0.5, -8.6], [0.9, 0.3, -6.4], [1.1, 0.05, -4.8]]]];
  W.threads = TH.map(([c, pts], i) => { const m = thread(pts, c, i < 3 ? 0.05 : 0.025); add(m); return m; });
  // the seams: haze veils where other places begin (one draw each)
  W.veils = [];
  for (const [x, z, ry, w] of [[-15.4, 0, PI / 2, 8], [15.4, 0, PI / 2, 8], [0, 14.4, 0, 8], [-10, -18.4, 0, 4]]) { const v = new THREE.Mesh(new THREE.PlaneGeometry(w, 6), veilMaterial(0xfff0d8)); v.position.set(x, 3, z); v.rotation.y = ry; v.userData.noBatch = true; add(v); W.veils.push(v); }
  W.updaters.push((dt, t) => { for (const v of W.veils) v.material.uniforms.uTime.value = t; });
  // bridges: pieces of other places, laid end to end (asphalt, setts, ward tiles, platform concrete)
  const bridge = (x0, z0, x1, z1, mats) => {
    const n = mats.length, horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n, xa = x0 + (x1 - x0) * a, xb = x0 + (x1 - x0) * b, za = z0 + (z1 - z0) * a, zb = z0 + (z1 - z0) * b;
      if (horiz) { solid(mats[i], Math.min(xa, xb), -0.5, -1.9, Math.max(xa, xb), 0, 1.9); bat().box(M.rock, Math.min(xa, xb) + 0.3, -2.6 - R() * 2, -1.5, Math.max(xa, xb) - 0.3, -0.5, 1.5); }
      else { solid(mats[i], Math.min(x0, x1) - 1.9, -0.5, Math.min(za, zb), Math.max(x0, x1) + 1.9, 0, Math.max(za, zb)); bat().box(M.rock, Math.min(x0, x1) - 1.5, -2.6 - R() * 2, Math.min(za, zb) + 0.3, Math.max(x0, x1) + 1.5, -0.5, Math.max(za, zb) - 0.3); }
    }
  };
  bridge(-44, 0, -15.2, 0, [M.dirt, M.stone, M.cobble, M.floor, M.asphalt, M.floor]);
  bridge(15.2, 0, 44, 0, [M.floor, M.asphalt, M.cobble, M.cobble, M.stone, M.cobble]);
  bridge(0, 14.2, 0, 44, [M.floor, M.tile, M.asphalt, M.wardFloor, M.tile, M.wardFloor]);
  bridge(-10, -40, -10, -50, [M.dark, M.asphalt]);
  // low kerbs along the bridges (a lip, not a wall: they are walkable edges)
  for (const s of [-1, 1]) { bat().box(M.stoneDark, -44, 0, s * 1.9 - 0.1, -15.2, 0.12, s * 1.9 + 0.1); bat().box(M.stoneDark, 15.2, 0, s * 1.9 - 0.1, 44, 0.12, s * 1.9 + 0.1); bat().box(M.stoneDark, s * 1.9 - 0.1, 0, 14.2, s * 1.9 + 0.1, 0.12, 44); }
  // shard and the Witness's page (hub)
  W.hubShard = shardMesh(); W.hubShard.position.set(...P.hubShard); add(W.hubShard);
  W.hubPage = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), pictureMat(TEX.journal(2), 0.4)); W.hubPage.rotation.set(-PI / 2, 0, 0.4); W.hubPage.position.set(...P.page); W.hubPage.userData.noBatch = true; add(W.hubPage);
  // light: the dawn comes through the broken roof; strip lights still burn in Kai's memory
  src(0, 6, -11, 0x9fe8ff, 4, 16); src(-8, 4, -8, 0xf4f8ff, 2.2, 10, st('kai', 'witness')); src(6, 4, -2, 0xffe0b0, 1.8, 12); src(0, 5, 8, 0xffe8c8, 2.0, 14);
  K.finish();
}

// ---------------------------------------------------------------------------------------------------------------------
// The final chamber under the ring (opened at the end): stair, antechamber with the iris, the chamber, the core
// ---------------------------------------------------------------------------------------------------------------------
function buildChamber(game, K, M, W) {
  const { solid, bat, add, src } = K;
  // the stair: 20 steps from z -12.6 (y 0) to z -23.6 (y -5)
  for (let i = 0; i < 20; i++) { const za = -12.6 - i * 0.55, y = -0.25 * (i + 1); solid(M.floor, -1.6, y - 0.4, za - 0.55, 1.6, y, za); }
  solid(M.wall, -2.1, -5.4, -24, -1.6, -0.6, -12.6); solid(M.wall, 1.6, -5.4, -24, 2.1, -0.6, -12.6);
  // antechamber (z -29..-23.6) and the chamber beyond the iris (z -46..-29, round, 4 m high)
  solid(M.dark, -6, -5.6, -29.2, 6, -5, -23.6); solid(M.stoneDark, -9.6, -5.6, -46.4, 9.6, -5, -29.2);
  solid(M.wall, -6.4, -5, -29.2, -6, -0.6, -23.6); solid(M.wall, 6, -5, -29.2, 6.4, -0.6, -23.6);
  bat().box(M.dark, -6.4, -0.9, -29.2, 6.4, -0.6, -23.6);
  solid(M.stoneDark, -10, -5, -46.4, -9.6, -0.6, -29.2); solid(M.stoneDark, 9.6, -5, -46.4, 10, -0.6, -29.2); solid(M.stoneDark, -10, -5, -46.8, 10, -0.6, -46.4);
  bat().box(M.stoneDark, -10, -0.9, -46.8, 10, -0.6, -29.2);
  solid(M.wall, -6, -5, -29.2, -2.2, -0.6, -28.8); solid(M.wall, 2.2, -5, -29.2, 6, -0.6, -28.8); solid(M.wall, -2.2, -2.2, -29.2, 2.2, -0.6, -28.8);
  solid(M.stoneDark, -9.6, -5, -29.6, -6, -0.6, -29.2); solid(M.stoneDark, 6, -5, -29.6, 9.6, -0.6, -29.2);
  // the iris: six brass blades and four collars on the door; animated by the mission
  W.iris = new THREE.Group(); W.iris.position.set(0, -3.6, -28.9);
  W.irisBlades = [];
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.4, 0.12), M.brass); b.userData.a = i / 6 * PI * 2; b.position.set(Math.cos(b.userData.a) * 0.6, Math.sin(b.userData.a) * 0.6, 0); b.rotation.z = b.userData.a + PI / 2; W.iris.add(b); W.irisBlades.push(b); }
  W.collars = [0.7, 0.95, 1.2, 1.45].map((r, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 48), glowMat([0xe8c070, 0xffd8a0, 0xa8d8ff, 0xff8a6a][i], 0.2)); m.position.z = 0.1 + i * 0.02; W.iris.add(m); return m; });
  add(W.iris);
  W.irisBox = K.box(-2.2, -5, -29.2, 2.2, -2.2, -28.8);
  // the chamber: a ring of standing stones carved with the Telling, the core in its socket (the valley's core)
  const C0 = [P.core[0], P.core[2]];
  for (let i = 0; i < 14; i++) { const a = i / 14 * PI * 2; if (Math.abs(Math.sin(a) - 1) < 0.15) continue; solid(M.stone, C0[0] + Math.cos(a) * 7 - 0.35, -5, C0[1] + Math.sin(a) * 7 - 0.35, C0[0] + Math.cos(a) * 7 + 0.35, -1.4, C0[1] + Math.sin(a) * 7 + 0.35); }
  bat().cyl(M.stone, C0[0], -4.9, C0[1], 4.2, 0.2, 40); K.box(C0[0] - 3, -5, C0[1] - 3, C0[0] + 3, -4.8, C0[1] + 3); bat().cyl(M.stoneDark, C0[0], -4.78, C0[1], 2.6, 0.08, 36);
  solid(M.stoneDark, C0[0] - 0.9, -4.8, C0[1] - 0.9, C0[0] + 0.9, -4.0, C0[1] + 0.9);
  W.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), glowMat(0xffb070, 2.2)); W.core.position.set(C0[0], -3.2, C0[1]); W.core.userData.noBatch = true; add(W.core);
  W.coreRing = chronolith(0.42, { color: 0xffb070, power: 0.5 }); W.coreRing.position.set(C0[0], -3.2, C0[1]); add(W.coreRing);
  W.updaters.push((dt, t) => { W.core.rotation.y = t * 0.4; W.core.rotation.x = t * 0.17; W.coreRing.userData.update?.(t * 0.3); });
  W.stairShard = shardMesh(); W.stairShard.position.set(...P.stairShard); add(W.stairShard);
  src(0, -2.2, P.core[2], 0xffb070, 4, 14, ['chamber', 'free']); src(0, -2.5, -25.5, 0x9fe8ff, 1.8, 9, ['chamber']); src(0, -1.6, -42, 0xffc890, 2.0, 12, ['chamber']);
  K.finish();
}

// ---------------------------------------------------------------------------------------------------------------------
// I · THE VALLEY (west island)
// ---------------------------------------------------------------------------------------------------------------------
function buildVillage(game, K, M, W, low, T) {
  const { solid, box, bat, add, plane, src, ramp } = K, R = rng(2220);
  const I = { root: K.root, near: [] };
  const B = st('bce'), C4 = ['ce400'], W9 = ['v2049'];
  // the rock the island stands on
  bat().box(M.rock, -80.5, -12, -16.5, -43.5, -4.6, 16.5); bat().box(M.rock, -76, -18, -12, -50, -12, 12);
  // upper terrace (y 0) and the basin (y -4)
  solid(M.dirt, -60, -4.6, -16, -44, 0, 16);
  solid(M.dirt, -80, -4.6, -16, -61, -4, 16);
  ground(K, M.grass, -59.6, -15.6, -44.4, 15.6, 0.01, st('bce', 'ce400'));
  ground(K, M.grass, -59.6, -15.6, -44.4, 15.6, 0.01, W9);
  // the retaining wall with the Keepers' Door (z -1..1, y -4..-1.7)
  solid(M.stone, -61, -4, -16, -60, 0, -1); solid(M.stone, -61, -4, 1, -60, 0, 16); solid(M.stone, -61, -1.7, -1, -60, 0, 1);
  bat().box(M.stoneDark, -61.25, -1.9, -1.3, -60.9, -1.6, 1.3);   // the lintel
  // the door: open in bce, sealed with lime plaster in ce400 (the seal texture), drowned in 2049
  W.sealMesh = plane(TEX.seal(), 2, 2.3, -61.06, -2.85, 0, -PI / 2, 0.15, C4);
  box(-61.1, -4, -1, -60.9, -1.7, 1, ['ce400', 'v2049']);
  // the chamber under the terrace (x -60..-55)
  solid(M.stoneDark, -60, -4.6, -2.6, -55, -4, 2.6); solid(M.stoneDark, -60, -4, -2.9, -55, -0.6, -2.6); solid(M.stoneDark, -60, -4, 2.6, -55, -0.6, 2.9); solid(M.stoneDark, -55.3, -4, -2.6, -55, -0.6, 2.6);
  bat().box(M.stoneDark, -60, -1.4, -2.6, -55, -0.6, 2.6);
  solid(M.stone, -58.2, -4, -0.6, -56.8, -3.2, 0.6);   // the socket plinth
  W.vCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), glowMat(0xffb070, 2.4)); W.vCore.position.set(-57.5, -2.75, 0); W.vCore.userData.noBatch = true; add(W.vCore, ['bce', 'ce400']);
  src(-57.5, -2.4, 0, 0xffa060, 2.6, 7, ['bce', 'ce400']);
  // carvings inside: the Telling (M5) and the people in white
  plane(canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#5a5248'; g.fillRect(0, 0, w, h); grain(g, w, h, 1600, 0.12, 4); g.strokeStyle = '#c8b898'; g.lineWidth = 4; for (let i = 0; i < 5; i++) { const x = 60 + i * 95; g.beginPath(); g.arc(x, 90, 16, 0, 7); g.moveTo(x, 106); g.lineTo(x, 170); g.moveTo(x - 24, 130); g.lineTo(x + 24, 130); g.moveTo(x, 170); g.lineTo(x - 18, 220); g.moveTo(x, 170); g.lineTo(x + 18, 220); g.stroke(); } g.beginPath(); g.arc(430, 80, 34, 0, 7); g.stroke(); g.font = `700 28px ${SERIF}`; g.fillStyle = '#d8c8a8'; g.fillText('THE SEVENTEENTH', 150, 248); }, 'm22carve'), 4.6, 2.2, -57.5, -2.4, -2.55, 0, 0.12);
  // BCE steps down to the basin (z 11..14.2) and the CE400 landslide (z -15..-10)
  for (let i = 0; i < 16; i++) { const x0 = -61 - (i + 1) * 0.5, y = -0.25 * (i + 1); bat(B).box(M.stone, x0, y - 0.3, V.stepsZ[0], x0 + 0.5, y, V.stepsZ[1]); }
  ramp([-69, -4.6, V.stepsZ[0]], [-61, 0, V.stepsZ[1]], '+x', -4, B);
  bat(C4).box(M.stoneDark, -69, -4.2, 10.6, -61, -2.4, 14.6);   // the steps lie broken in 400 CE
  for (let i = 0; i < 16; i++) bat(C4).boxc(i % 2 ? M.stoneDark : M.dirt, -70 + R() * 9, -3.4 + (R() - 0.2) * 2.4 * (1 - (R() * 0.5)), -15 + R() * 5, 1 + R() * 1.8, 0.8 + R(), 1 + R() * 1.6, R() * PI, R() * 0.4, R() * 0.4);
  for (let i = 0; i < 8; i++) { const a = i / 7, x = -70 + a * 9, y = -4 + a * 3.8; bat(C4).box(M.dirt, x - 0.7, -4.4, -15, x + 0.7, y, -10); }
  ramp([-70, -4.6, -15], [-61, -0.2, -10], '+x', -4, C4);
  // the river channel in the basin (bce: running water; ce400: a dry bed; 2049: under the lake)
  bat(st('bce', 'ce400')).box(M.gravel, -79.4, -4.02, -16, -76.6, -3.99, 16);
  if (!low) { try { const riv = RZ.water({ rect: [-79.4, -16, 2.8, 32], level: -3.92, heightAt: () => -4.4, flow: [0, 0.4], res: 32 }).mesh; riv.userData.noBatch = true; add(riv, B); } catch (err) { console.warn('m22 river', err); } }
  // houses: the terrace village (bce), its ruins (ce400), the survey cabin (2049)
  const housesUp = [{ position: [-50.5, 0, -10.5], yaw: 0.2, width: 6, depth: 5, height: 2.6, wall: 'mud', roof: 'flat', seed: 1 }, { position: [-48.5, 0, 8.6], yaw: -0.3, width: 5.4, depth: 4.6, height: 2.5, wall: 'stone', roof: 'thatch', seed: 2 }, { position: [-55.5, 0, 11.5], yaw: 0.5, round: true, radius: 2.6, wall: 'mud', roof: 'thatch', seed: 3 }, { position: [-47.2, 0, -1.8], yaw: 1.5, width: 4.4, depth: 4, height: 2.4, wall: 'mud', roof: 'flat', seed: 4 }];
  const housesLow = [{ position: [-71.5, -4, -8.4], yaw: 0.1, width: 5, depth: 4, height: 2.4, wall: 'mud', roof: 'flat', seed: 5 }, { position: [-72.5, -4, 7.6], yaw: -0.2, round: true, radius: 2.4, wall: 'mud', roof: 'thatch', seed: 6 }, { position: [-67.4, -4, 10.6], yaw: 0.4, width: 4.2, depth: 3.6, height: 2.3, wall: 'stone', roof: 'thatch', seed: 7 }];
  try {
    const sv = RZ.settlement([...housesUp, ...housesLow], { colors: { thatch: 0x9a7a45 } }); add(sv.group, B);
    const ru = RZ.settlement([...housesUp, ...housesLow].map(h => ({ ...h, height: (h.height || 2.4) * 0.45, roof: 'none', door: true })), { colors: { stone: 0x8a8070, mud: 0x8a7458 } }); add(ru.group, C4);
  } catch (err) { console.warn('m22 settlement', err); }
  const houseBox = (h, e) => { const w = h.round ? h.radius * 2 : h.width, d = h.round ? h.radius * 2 : h.depth; box(h.position[0] - w / 2 + 0.2, h.position[1], h.position[2] - d / 2 + 0.2, h.position[0] + w / 2 - 0.2, h.position[1] + (e === C4 ? 1.1 : 2.6), h.position[2] + d / 2 - 0.2, e); };
  for (const h of [...housesUp, ...housesLow]) { houseBox(h, B); houseBox(h, C4); }
  // 2049: survey cabin, notice, power pole
  solid(M.panel, -52.6, 0, -11.4, -48.4, 2.7, -8.0, W9); bat(W9).box(M.dark, -52.8, 2.7, -11.6, -48.2, 2.9, -7.8);
  plane(TEX.notice(), 1.6, 0.8, V.notice[0], 1.5, V.notice[2] + 0.02, 0, 0.3, W9);
  bat(W9).cyl(M.wood, -46, 4, 5, 0.12, 8, 8); bat(W9).box(M.wood, -47.2, 7.4, 4.9, -44.8, 7.55, 5.1);
  // trees: grown back in 400 CE, dead in the lake in 2049
  const hAt = (x) => (x < -61 ? -4 : 0);
  try {
    add(RZ.forest({ species: 'broadleaf', placements: [{ x: -66, z: 3, scale: 0.8 }, { x: -74, z: -4, scale: 1.0 }, { x: -52, z: 13.5, scale: 0.7 }, { x: -57, z: -13, scale: 0.8 }, { x: -45.5, z: -13, scale: 0.7 }], heightAt: (x) => hAt(x), impostors: false, variants: 2, seed: 2221 }), C4);
    add(RZ.forest({ species: 'shrub', placements: [{ x: -58, z: 6 }, { x: -45.6, z: 12 }, { x: -73, z: 13 }, { x: -64, z: -7 }, { x: -46, z: -8 }], heightAt: (x) => hAt(x), impostors: false, variants: 2, seed: 2222 }), st('bce', 'ce400'));
    add(RZ.forest({ species: 'dead', placements: [{ x: -68, z: 4 }, { x: -75, z: -6 }, { x: -70, z: -12 }, { x: -77, z: 10 }], heightAt: () => -4, impostors: false, variants: 2, seed: 2223 }), W9);
  } catch (err) { console.warn('m22 trees', err); }
  try { const rk = RZ.rocks({ placements: [{ x: -59, z: -14.6, scale: 1.2 }, { x: -44.8, z: 14.6, scale: 1.0 }, { x: -79.2, z: -14.8, scale: 1.4 }, { x: -79.4, z: 14.2, scale: 1.2 }, { x: -44.6, z: -15, scale: 0.9 }], heightAt: (x) => hAt(x), seed: 2224 }); add(rk.mesh || rk); } catch (err) { console.warn('m22 rocks', err); }
  // 2049: the reservoir, the pontoon and the survey raft, the buoy over the door
  try { const lake = RZ.water({ rect: [-80, -16, 19, 32], level: V.waterY, heightAt: () => -4, deep: 0x0d2a30, shallow: 0x2f5a54, res: 32 }).mesh; lake.userData.noBatch = true; add(lake, W9); } catch (err) { console.warn('m22 lake', err); }
  solid(M.wood, -70, -0.85, -0.9, -60.9, -0.55, 0.9, W9);
  for (let x = -69.5; x < -61; x += 1.5) bat(W9).cyl(M.steel, x, -0.9, 0.95, 0.12, 0.5, 8);
  solid(M.panel, -73.4, -0.9, -3, -69.4, -0.5, 3, W9);
  bat(W9).box(M.yellow, -73.4, -0.5, -3, -73.2, 0.6, 3); bat(W9).box(M.yellow, -73.4, 0.6, -3, -69.4, 0.7, -2.8); bat(W9).box(M.yellow, -73.4, 0.6, 2.8, -69.4, 0.7, 3);
  bat(W9).box(M.steel, V.board[0] - 0.5, -0.5, V.board[2] - 0.05, V.board[0] + 0.5, 0.6, V.board[2] + 0.05);
  plane(TEX.survey(), 0.8, 1.0, V.board[0], 0.6, V.board[2] + 0.07, 0, 0.3, W9);
  const buoy = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 12), M.yellow); buoy.position.set(-62.5, V.waterY + 0.3, 0); add(buoy, W9);
  // Water Ring on the terrace: the causal chain board (three sockets and the fixed end stone), every state
  bat().cyl(M.stone, V.ring[0], 0.12, V.ring[2], 2.7, 0.24, 28); box(V.ring[0] - 2.4, 0, V.ring[2] - 2.4, V.ring[0] + 2.4, 0.24, V.ring[2] + 2.4);
  bat().cyl(M.stoneDark, V.ring[0], 0.3, V.ring[2], 0.9, 0.14, 20);
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, h = 0.9 + R() * 0.9; if (i % 3 === 1) continue; bat().geo(M.stone, new THREE.DodecahedronGeometry(0.42, 0), [V.ring[0] + Math.cos(a) * 3.0, h / 2, V.ring[2] + Math.sin(a) * 3.0], [R(), R() * PI, R() * 0.2], [0.8, h / 0.84, 0.7]); }
  W.vSockets = V.sockets.map(p => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.06), pictureMat(TEX.link(0, '—', 'empty'), 0.3)); m.position.set(...p); m.lookAt(V.ring[0], p[1], V.ring[2]); m.userData.noBatch = true; add(m); return m; });
  const end = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.06), pictureMat(TEX.link(0, 'THE MACHINE', 'is switched on · 2026'), 0.35)); end.position.set(...V.endStone); end.lookAt(V.ring[0], V.endStone[1], V.ring[2]); end.userData.noBatch = true; add(end);
  // keepers' things (bce): lime baskets, stones on sledges; the card under the threshold
  for (const [x, z] of [[-63.8, -2.4], [-64.4, 2.4], [-65.8, 0.8]]) { bat(B).cyl(M.wood, x, -3.75, z, 0.32, 0.5, 10); bat(B).cyl(M.plaster, x, -3.48, z, 0.28, 0.06, 10); }
  for (const [x, z] of [[-66.8, -2.2], [-68.2, 1.6]]) { bat(B).box(M.wood, x - 0.8, -4, z - 0.4, x + 0.8, -3.85, z + 0.4); bat(B).boxc(M.stone, x, -3.45, z, 0.9, 0.7, 0.8, R()); }
  W.vCard = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), pictureMat(canvasTex(256, 160, (g, w, h) => { g.fillStyle = '#e8eef0'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a3a5a'; g.fillRect(0, 0, w, 36); g.fillStyle = '#fff'; g.font = `700 22px ${FONT}`; g.fillText('HELIX', 12, 26); g.fillStyle = '#14202a'; g.font = `700 26px ${FONT}`; g.fillText('K. VAREN', 12, 84); g.font = `500 18px ${FONT}`; g.fillText('TEMPORAL SYSTEMS · L5', 12, 116); }, 'm22card'), 0.3));
  W.vCard.rotation.x = -PI / 2; W.vCard.position.set(V.card[0], -3.98, V.card[2]); W.vCard.userData.noBatch = true; add(W.vCard, B);
  W.vPage = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), pictureMat(TEX.journal(1), 0.35)); W.vPage.rotation.set(-PI / 2, 0, 0.3); W.vPage.position.set(V.page[0], 0.62, V.page[2]); W.vPage.userData.noBatch = true; add(W.vPage, C4);
  bat(C4).cyl(M.plaster, V.page[0], 0.3, V.page[2], 0.28, 0.6, 10);
  W.vShard = shardMesh(); W.vShard.position.set(...V.shard); add(W.vShard, B);
  // light: fires in the village (bce), daylight in the others
  src(-64, -3, 0, 0xffa050, 2.4, 10, B); src(-52, 1.6, -6, 0xffb060, 1.6, 9, B); src(-71, 1, 0, 0xe8f0ff, 1.2, 10, W9);
  K.finish();
  return I;
}
function ground(K, mat, x0, z0, x1, z1, y, e) { const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)); g.rotateX(-PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); K.bat(e).push(mat, g); }

// ---------------------------------------------------------------------------------------------------------------------
// II · THE OLD QUARTER (east island): Hensel's lane, 19.10.2026, 07:52
// ---------------------------------------------------------------------------------------------------------------------
function buildClock(game, K, M, W, low) {
  const { solid, box, bat, add, plane, src } = K;
  const I = { root: K.root };
  bat().box(M.rock, 43.5, -11, -16.5, 80.5, -0.6, 16.5); bat().box(M.rock, 48, -16, -12, 76, -11, 12);
  solid(M.cobble, 44, -0.6, -16, 80, 0, 16);
  // pavements and the lane narrowed by stalls and cars (walkable lane: z -2..2 between x 47 and 66)
  solid(M.stone, 46, 0, -16, 66, 0.15, -4.2); solid(M.stone, 46, 0, 4.2, 66, 0.15, 16);
  for (const x of [47.5, 53.0, 59.0]) { solid(M.wood, x - 1.0, 0.15, -4.2, x + 1.0, 1.0, -2.1); solid(M.wood, x - 1.0, 0.15, 2.1, x + 1.0, 1.0, 4.2); bat().box(M.red, x - 1.1, 2.0, -4.3, x + 1.1, 2.08, -2.0); bat().box(M.red, x - 1.1, 2.0, 2.0, x + 1.1, 2.08, 4.3); }
  for (const x of [50, 56, 62]) { box(x - 1.2, 0, -5.6, x + 1.2, 3, -2.05); box(x - 1.2, 0, 2.05, x + 1.2, 3, 5.6); }
  // terraced houses (2026): real facades along both sides of the lane
  try {
    const blk = RZ.cityBlock([
      { width: 7, depth: 9, height: 11, position: [49.5, 0.15, -10], yaw: 0, seed: 22, wall: 'brick', faces: ['shop', 'blank', 'windows', 'blank'], roof: { solar: true } },
      { width: 6.5, depth: 9, height: 13, position: [56.5, 0.15, -10], yaw: 0, seed: 23, wall: 'plaster', faces: ['shop', 'blank', 'windows', 'blank'] },
      { width: 6.5, depth: 9, height: 10, position: [63, 0.15, -10], yaw: 0, seed: 24, wall: 'brick', faces: ['windows', 'blank', 'windows', 'blank'] },
      { width: 7, depth: 9, height: 12, position: [49.5, 0.15, 10], yaw: PI, seed: 25, wall: 'plaster', faces: ['shop', 'blank', 'windows', 'blank'] },
      { width: 6.5, depth: 9, height: 10.5, position: [56.5, 0.15, 10], yaw: PI, seed: 26, wall: 'brick', faces: ['windows', 'blank', 'windows', 'blank'] },
      { width: 6.5, depth: 9, height: 12.5, position: [63, 0.15, 10], yaw: PI, seed: 27, wall: 'darkBrick', faces: ['shop', 'blank', 'windows', 'blank'] },
    ], { era: '2026', lit: 0.35, daylight: 0.6 });
    add(blk.mesh);
  } catch (err) { console.warn('m22 block', err); }
  box(46, 0, -16.5, 66.5, 12, -5.5); box(46, 0, 5.5, 66.5, 12, 16.5);
  // Hensel's house (x 66..78) with its tower and the dial at 07:52
  solid(M.brick, 66, 0, -6.2, 78, 0.15, 6.2);
  solid(M.brick, 66, 0, -6.2, 66.4, 10.6, -0.9); solid(M.brick, 66, 0, 0.9, 66.4, 10.6, 6.2); solid(M.brick, 66, 2.5, -0.9, 66.4, 10.6, 0.9);
  solid(M.brick, 77.6, 0, -6.2, 78, 10.6, 6.2); solid(M.brick, 66, 0, -6.2, 78, 10.6, -5.8); solid(M.brick, 66, 0, 5.8, 78, 10.6, 6.2);
  bat().box(M.dark, 65.8, 10.6, -6.4, 78.2, 11, 6.4); solid(M.wood, 66.4, 3.6, -5.8, 77.6, 3.8, 5.8);
  solid(M.brick, 68, 10.6, -2.2, 72.4, 16.6, 2.2); bat().box(M.dark, 67.8, 16.6, -2.4, 72.6, 17.0, 2.4);
  const towerFace = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), pictureMat(dialTex(7, 52, { aged: true }), 0.25)); towerFace.position.set(67.98, 14, 0); towerFace.rotation.y = -PI / 2; add(towerFace);
  // shopfront: windows with clocks, the sign, the door frame
  plane(TEX.shop(), 6.4, 1.3, 65.94, 3.0, 0, -PI / 2, 0.25);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.6), M.glass); m.position.set(65.95, 1.5, s * 3.3); m.rotation.y = -PI / 2; m.userData.noBatch = true; add(m); bat().box(M.wood, 65.8, 0.15, s * 3.3 - 1.9, 66.0, 0.7, s * 3.3 + 1.9); }
  bat().box(M.wood, 65.8, 0, -1.0, 66.1, 2.6, -0.9); bat().box(M.wood, 65.8, 0, 0.9, 66.1, 2.6, 1.0); bat().box(M.wood, 65.8, 2.5, -1.0, 66.1, 2.65, 1.0);
  // the shop: counter, shelves, the clock wall (12 faces, the ninth dark)
  solid(M.wood, 71.6, 0, -3.4, 72.6, 1.0, 3.4); bat().box(M.desk, 71.5, 0.95, -3.5, 72.7, 1.0, 3.5);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) bat().box(M.wood, 67, 0.6 + i * 0.8, s * 5.2 - 0.3, 71, 0.66 + i * 0.8, s * 5.2 + 0.3);
  solid(M.wood, 67, 0, -5.8, 71, 0.6, -4.9); solid(M.wood, 67, 0, 4.9, 71, 0.6, 5.8);
  W.clockWall = [];
  for (let i = 0; i < 12; i++) {
    const col = i % 4, row = Math.floor(i / 4), z = -3.3 + col * 2.2, y = 3.0 - row * 0.85;
    const mat = pictureMat(dialTex(i === 8 ? 0 : 7, i === 8 ? 0 : (i + 1) * 5, { dark: i === 8, label: ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][i] }), 0.2);
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.34, 28), mat); f.position.set(C.clocks - 0.02, y, z); f.rotation.y = -PI / 2; f.userData.noBatch = true; add(f); W.clockWall.push(f);
    bat().cyl(M.brass, C.clocks + 0.04, y, z, 0.38, 0.06, 20, [0, 0, PI / 2]);
  }
  plane(canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8d8b0'; g.font = `700 26px ${SERIF}`; g.textAlign = 'center'; g.fillText('I  II  III ... VIII  ·  X', w / 2, 40); }, 'm22wallplate'), 1.6, 0.4, C.clocks - 0.03, 3.65, 0, -PI / 2, 0.2);
  W.drawer = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.6), M.desk); W.drawer.position.set(C.drawer[0] + 0.1, 0.8, C.drawer[2]); add(W.drawer);
  W.drawerDial = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16), M.brass); W.drawerDial.rotation.z = PI / 2; W.drawerDial.position.set(C.drawer[0] - 0.17, 0.8, C.drawer[2]); add(W.drawerDial);
  plane(TEX.ledger(), 0.32, 0.4, C.ledger[0], 1.005, C.ledger[2], PI / 2, 0.25, null, -PI / 2);
  W.cPage = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), pictureMat(TEX.journal(0), 0.35)); W.cPage.rotation.set(-PI / 2, 0, 0.5); W.cPage.position.set(...C.page); W.cPage.userData.noBatch = true; add(W.cPage);
  solid(M.wood, 67.6, 0, 4.0, 68.8, 0.9, 5.2);
  // the hammers (three rows across the lane; heads animated by the mission's loop)
  W.hammers = [];
  for (const x of C.gates) {
    bat().box(M.brass, x - 0.2, 0, -2.3, x + 0.2, 4.6, -2.05); bat().box(M.brass, x - 0.2, 0, 2.05, x + 0.2, 4.6, 2.3); bat().box(M.brass, x - 0.25, 4.4, -2.3, x + 0.25, 4.7, 2.3);
    bat().box(M.steel, x - 0.6, 0, -2.0, x + 0.6, 0.04, 2.0);
    const row = [-1.3, 0, 1.3].map(z => hammer(K, M, x, z));
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), pictureMat(dialTex(null, null, { nine: true }), 0.35)); dial.position.set(x, 3.9, -2.32); dial.userData.noBatch = true; add(dial);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.02), new THREE.MeshBasicMaterial({ color: 0x1a1410 })); hand.geometry.translate(0, 0.15, 0); hand.position.set(x, 3.9, -2.30); add(hand);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), glowMat(0x9fe8ff, 0.2)); lamp.position.set(x, 4.85, 0); add(lamp);
    W.hammers.push({ x, row, hand, lamp });
  }
  // street furniture
  try { const k = streetKit({ era: '2026', seed: 22 }); k.scatter('lamp', [[46.6, -4.4], [65, -4.4]], { spacing: 6.5, turn: PI / 2, y: 0.15 }).add('bin', [46.8, 0.15, 4.8], 0).add('bench', [55, 0.15, 4.9], PI); add(k.build()); } catch (err) { console.warn('m22 street', err); }
  W.cShard = shardMesh(); W.cShard.position.set(...C.shard); add(W.cShard);
  src(70, 3, 0, 0xffd8a0, 2.2, 10); src(56, 5.2, 0, 0xffe8c8, 2.6, 14); src(50, 5.2, 0, 0xffe8c8, 2.0, 12); src(62, 5.2, 0, 0xffe8c8, 2.0, 12);
  K.finish();
  return I;
}

// ---------------------------------------------------------------------------------------------------------------------
// III · WARD 4 (south island): Halden General at night, reversed; bay 4-07
// ---------------------------------------------------------------------------------------------------------------------
function buildWard(game, K, M, W) {
  const { solid, box, bat, add, plane, src } = K;
  const I = { root: K.root };
  bat().box(M.rock, -12.5, -10, 43.5, 12.5, -0.6, 80.5); bat().box(M.rock, -8, -15, 48, 8, -10, 76);
  solid(M.wardFloor, -10, -0.6, 44, 10, 0, 80);
  // outer walls (the south doors x -1.6..1.6; the north window x -2..2, y 1..2.8)
  solid(M.panel, -10, 0, 46, -1.6, 3.4, 46.3); solid(M.panel, 1.6, 0, 46, 10, 3.4, 46.3); solid(M.panel, -1.6, 2.6, 46, 1.6, 3.4, 46.3);
  solid(M.panel, -10, 0, 46, -9.7, 3.4, 78.3); solid(M.panel, 9.7, 0, 46, 10, 3.4, 78.3);
  solid(M.panel, -10, 0, 78, -2, 3.4, 78.3); solid(M.panel, 2, 0, 78, 10, 3.4, 78.3); solid(M.panel, -2, 0, 78, 2, 1.0, 78.3); solid(M.panel, -2, 2.8, 78, 2, 3.4, 78.3);
  box(-2, 1.0, 78, 2, 2.8, 78.3);
  const view = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a3a5a'); gr.addColorStop(0.55, '#e8a868'); gr.addColorStop(1, '#5a3a2a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,30,24,0.9)'; g.fillRect(150, 150, 212, 70); for (let i = 0; i < 9; i++) g.fillRect(150 + i * 24, 120 + (i * 37) % 28, 16, 40);
    g.strokeStyle = '#1a1410'; g.lineWidth = 12; g.beginPath(); g.arc(256, 118, 38, 0, PI * 2); g.stroke(); g.strokeStyle = 'rgba(95,230,255,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(256, 118, 30, 0, PI * 2); g.stroke();
  }, 'm22wardview'), fog: false, toneMapped: false }));
  view.position.set(0, 2.0, 80.5); view.rotation.y = PI; view.userData.noBatch = true; add(view);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.8), M.glass); win.position.set(0, 1.9, 78.1); win.rotation.y = PI; win.userData.noBatch = true; add(win);
  bat().box(M.dark, -10, 3.4, 46, 10, 3.6, 78.3);
  for (let z = 48; z < 78; z += 4) bat().box(glowMat(0xd8ecff, 0.7), -0.8, 3.36, z - 0.6, 0.8, 3.4, z + 0.6);
  // bays: partitions every 8 m, curtains, beds, monitors
  const bays = [['4-01', -6.2, 50], ['4-02', -6.2, 58], ['4-03', -6.2, 66], ['4-04', -6.2, 74], ['4-05', 6.2, 50], ['4-06', 6.2, 58], ['4-07', 6.2, 66], ['4-08', 6.2, 74]];
  for (const z of [46.3, 54, 62, 70]) { solid(M.panel, -9.7, 0, z - 0.06, -3.0, 2.4, z + 0.06); solid(M.panel, 3.0, 0, z - 0.06, 9.7, 2.4, z + 0.06); }
  for (const [id, x, z] of bays) {
    const s = Math.sign(x);
    plane(TEX.bay(id), 0.6, 0.38, x - s * 3.1, 2.6, z - 3.4, s > 0 ? -PI / 2 : PI / 2, 0.2);
    if (id !== '4-07') { const cu = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.2), M.curtain); cu.position.set(x - s * 3.0, 1.25, z + 0.3); cu.rotation.y = PI / 2; cu.scale.x = id === '4-03' ? 0.5 : 0.85; cu.userData.noBatch = true; add(cu); }
    { const bx = x + s * 1.2; K.box(bx - 1.0, 0, z - 1.1, bx + 1.0, 0.72, z + 1.1);
      for (const [lx, lz] of [[-0.9, -1.0], [0.9, -1.0], [-0.9, 1.0], [0.9, 1.0]]) bat().box(M.steel, bx + lx - 0.04, 0, z + lz - 0.04, bx + lx + 0.04, 0.5, z + lz + 0.04);
      bat().box(M.steel, bx - 0.98, 0.42, z - 1.08, bx + 0.98, 0.5, z + 1.08); bat().box(M.sheet, bx - 0.92, 0.5, z - 1.02, bx + 0.92, 0.7, z + 1.02);
      bat().box(M.sheet, bx + s * 0.55 - 0.3, 0.7, z - 0.45, bx + s * 0.55 + 0.3, 0.8, z + 0.45); bat().box(M.steel, bx + s * 0.98 - 0.04, 0.42, z - 1.08, bx + s * 0.98 + 0.04, 1.15, z + 1.08); }
    bat().box(M.dark, x + s * 2.4 - 0.15, 1.1, z - 1.6, x + s * 2.4 + 0.15, 1.7, z - 1.0);
  }
  // nurses' station (in front of 4-03)
  solid(M.desk, -3.0, 0, 62.8, -2.4, 1.0, 66.4); bat().box(M.desk, -3.1, 0.96, 62.7, -2.3, 1.02, 66.5);
  plane(TEX.chart(), 0.3, 0.38, H.chart[0] + 0.5, 1.03, H.chart[2], PI / 2, 0.25, null, -PI / 2);
  W.hPage = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), pictureMat(TEX.journal(3), 0.35)); W.hPage.rotation.set(-PI / 2, 0, 0.2); W.hPage.position.set(H.page[0] + 1.6, 1.03, H.page[2]); W.hPage.userData.noBatch = true; add(W.hPage);
  plane(TEX.wardSign(), 1.8, 0.9, 0, 2.95, 46.4, 0, 0.3);
  // outside: the doors' canopy and sign, and the floors above (Halden's east wing, broken off at the fourth floor)
  plane(TEX.wardSign(), 3.2, 1.6, 0, 4.6, 45.9, PI, 0.35);
  bat().box(M.steel, -3.2, 3.0, 44.6, 3.2, 3.2, 46.0); bat().cyl(M.steel, -3.0, 1.5, 44.8, 0.06, 3.0, 8); bat().cyl(M.steel, 3.0, 1.5, 44.8, 0.06, 3.0, 8);
  try { const blk = RZ.cityBlock([{ width: 20.4, depth: 32.6, height: 11, position: [0, 3.6, 62.15], yaw: PI, seed: 41, wall: 'panel', faces: ['windows', 'windows', 'windows', 'windows'], roof: { hvac: true, antenna: true } }], { era: '2049', lit: 0.45, daylight: 0.2 }); add(blk.mesh); } catch (err) { console.warn('m22 ward block', err); }
  // the line: from the window along the ceiling to the bed (relay boxes; the pulse is drawn by the mission)
  const pts = [H.window, [0, 2.95, 77.2], H.relays[2], [3.2, 2.95, 66.8], H.relays[1], [8.6, 2.95, 64.7], H.relays[0]].map(p => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05);
  add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.025, 5), M.rubber)); W.lineCurve = curve;
  W.relays = H.relays.map((p, i) => { const g = new THREE.Group(); g.position.set(...p); const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.2), M.steel); g.add(b); const flap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.24), glowMat(0xa8d8ff, 0.8)); flap.position.y = -0.14; g.add(flap); const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16), pictureMat(signTex('m22relay' + i, [['R' + (i + 1), 80, '#14202a']], { bg: '#eef2f4', h: 128, w: 256 }), 0.3)); lab.position.set(0, 0.2, 0.11); g.add(lab); add(g); g.userData.flap = flap; return g; });
  W.pulse = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), glowMat(0xa8d8ff, 3)); W.pulse.userData.noBatch = true; add(W.pulse);
  // hazards (the mission tracks them with Inversion): a gurney, a crash cart, an IV pole
  const mk = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; const g = new THREE.Group(); g.add(m); add(g); return g; };
  W.gurney = mk(new THREE.BoxGeometry(0.8, 0.8, 2.0), M.steel, 0.5); W.gurney.children[0].castShadow = true;
  W.cart = mk(new THREE.BoxGeometry(0.8, 1.1, 0.6), M.red, 0.6);
  W.pole = mk(new THREE.CylinderGeometry(0.03, 0.03, 2, 6), M.steel, 1.0);
  W.hShard = shardMesh(); W.hShard.position.set(...H.shard); add(W.hShard);
  src(0, 3, 50, 0xd8ecff, 1.4, 12); src(0, 3, 64, 0xb8d0ff, 1.2, 12); src(6.3, 2.4, 65.6, 0x9a7bff, 1.0, 7); src(0, 2, 76.5, 0xffe0b0, 1.2, 8);
  K.finish();
  return I;
}

// ---------------------------------------------------------------------------------------------------------------------
// OPTIONAL · CENTRAL STATION (north island): Platform 2 at 08:14, 2049, the train that was derailing
// ---------------------------------------------------------------------------------------------------------------------
function buildStation(game, K, M, W, low) {
  const { solid, bat, add, plane, src } = K;
  const I = { root: K.root }; void low;
  bat().box(M.rock, -22.5, -9, -72.5, 2.5, -0.6, -49.5);
  solid(M.floor, -14, -0.6, -72, 2, 0, -50); solid(M.dark, -22, -1.8, -72, -14, -1.2, -50);
  bat().box(M.yellow, -14.2, 0, -72, -13.8, 0.012, -50);
  for (const z of [-55, -61, -67]) { solid(M.steel, -12.2, 0, z - 0.2, -11.8, 5.6, z + 0.2); solid(M.steel, 0.2, 0, z - 0.2, 0.6, 5.6, z + 0.2); }
  bat().box(M.panel, -13, 5.6, -72, 1.4, 5.9, -50);
  try { const car = trainCar(14, 0xe9edf2, 0x2ae6ff); car.position.set(N.train[0], N.train[1], N.train[2]); car.rotation.set(0.0, 0.08, 0.12); add(car); } catch (err) { console.warn('m22 train', err); }
  game.collision.add([-20.6, -1.2, -68], [-15.6, 2.6, -54]);
  plane(TEX.departures(), 2.4, 1.1, N.board[0], N.board[1], N.board[2], -PI / 2, 0.6);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), pictureMat(dialTex(8, 14, {}), 0.4)); face.position.set(...N.clock); add(face);
  bat().cyl(M.dark, -8, 5.1, -67.6, 0.05, 1.2, 6);
  solid(M.wood, -5.4, 0, -64.0, -2.6, 0.48, -63.2); bat().box(M.steel, -5.3, 0, -64, -5.2, 0.48, -63.2); bat().box(M.steel, -2.8, 0, -64, -2.7, 0.48, -63.2);
  bat().box(M.dark, N.speaker[0] - 0.2, N.speaker[1] - 0.15, N.speaker[2] - 0.2, N.speaker[0] + 0.2, N.speaker[1] + 0.15, N.speaker[2] + 0.2);
  W.childNote = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38), pictureMat(TEX.childNote(), 0.35)); W.childNote.rotation.set(-PI / 2, 0, 0.3); W.childNote.position.set(N.bench[0], 0.5, N.bench[2] + 0.4); W.childNote.userData.noBatch = true; add(W.childNote);
  W.nShard = shardMesh(); W.nShard.position.set(...N.shard); add(W.nShard);
  src(-6, 5, -61, 0xd8ecff, 1.6, 14); src(-17, 2, -61, 0xff6a4a, 1.0, 8);
  K.finish();
  return I;
}
