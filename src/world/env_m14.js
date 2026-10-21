// Mission 14 environment: the Meridian Reach, Rain City in 2196. A beautiful, devastated morning: overgrown towers,
// the broken Line 4 viaduct, Halcyon Tower's open podium, the Memorial Square and Lantern Hall, the survivors'
// settlement in the old Central Freight shed. Only the 2196 state exists here (Kai's band has no anchor), but the
// unstable temporal zones let 2049 bleed through as cyan ghosts. North = -z, ground at y = 0.
// Layout (x, z):
//   The Landing (z 128..96): the drowned block (pool, west), the fallen-tower avenue start.
//   Canopy Avenue (road x -9..9, z 128..34), towers both sides (x ±12..±44), the leaning slab at z 78.
//   Line 4 viaduct (deck top y 7, z 20..28): the Meridian East platform (x -46..-10, z 19..31) and its stairs from the
//     street (x -24..-21.8, z 40..31); the broken span (x -10..6) with the fallen gantry beam; the east deck and the
//     tram wreck (x 14..34); the east exit stairs down to the north side (x 40.2..43.8, z 20..11).
//   Halcyon Tower podium (x 14..40, z -6..-34; slabs at 4.2 / 8.4 / 12.6), its tower shaft (x 27..40) above the roof.
//   Memorial Square (x -30..10, z -38..-70): the statue, the wall of names, the stopped clock; the drowned underpass
//     (x -48..-34, z -42..-60, floor -2.8, flooded).
//   Lantern Hall (x -30..30, z -76..-132): the gate at z -76, platforms, gardens, cistern, the return beacon (0, -122).
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng } from './kit.js';
import { Batch } from './env_m6.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { streetKit } from './props.js';
import { registerCast } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
export const DECK = 7.0, L1 = 4.2, L2 = 8.4, ROOF = 12.6, PIT = -2.8;
export const P = {
  start: [2, 0, 112, Math.PI], landing: [2, 0, 112],
  trail1: [7.4, 1.0, 92.4], trail2: [-5.6, 0.2, 70.6], trail3: [-10.4, 0.1, 42.6], trail4: [-22.8, 1.4, 41.2],
  herald: [9.4, 0.9, 98.6], poster: [-11.4, 2.0, 64], diary: [5.6, 0.9, 54.4],
  stairsFoot: [-23, 0, 41], platform: [-28, DECK, 27], loop: [-35, DECK, 24.6], loopAnchor: [-43.6, DECK, 20.6],
  beamW: [-11.2, DECK, 24], beamE: [7.4, DECK, 24], tram: [24, DECK, 24], cell: [21.2, DECK, 21.2],
  exitTop: [42, DECK, 20.6], exitFoot: [42, 0, 9.6], lobby: [20, 0, -2.6], directory: [19, 1.5, -5.0],
  flightA: [16.2, 0, -7], flightB: [38.2, L1, -19.4], flightC: [16.2, L2, -14.4], relay: [19.6, ROOF, -30.4],
  plaza: [-4, 0, -40], statue: [-8, 2.4, -55], plaque: [-8, 1.3, -51.8], names: [-8, 1.6, -64.6], clock: [4, 0, -46],
  witnessNote: [-10.6, 0.7, -57.2], underStairs: [-30.5, 0, -50], board: [-47.2, PIT, -51], gate: [0, 0, -77],
  hall: [0, 0, -90], beacon: [0, 0, -121], benchB: [3.4, 0, -118.2], seraHall: [-3.6, 0, -117],
  cistern: [-24, 0, -100], vTop: [-24, 6.0, -102.3], vRun: [-12.6, 0, -102.75], vBeds: [-4.1, 0, -102.75], ama: [-3.5, 0, -98],
  slate: [17.6, 1.6, -94], ledger: [-17.6, 1.6, -88.6],
};
// waymarks: the survivors' green-lantern cairns, built from Continuum damper scrap; standing near one tops up Kai's binding
export const WAYMARKS = [
  [-5, 0, 104], [7.6, 0, 76], [-8.4, 0, 40.6], [-30, DECK, 28.6], [12, DECK, 26.6], [34, 0, 6], [24.6, ROOF, -16], [-1, 0, -42], [3.6, 0, -80],
];
// unstable temporal zones: { x, y, z, rMin, rMax, period, open (fraction of the cycle at rMin), drift, axis }
export const ZONES = [
  { id: 'z1', x: -1, y: 0, z: 88, rMin: 1.6, rMax: 5.4, period: 6, open: 0.4 },
  { id: 'z2', x: 3.6, y: 0, z: 61, rMin: 2.2, rMax: 6.6, period: 7, open: 0.35 },
  { id: 'z3', x: -2, y: 0, z: 47, rMin: 3.0, rMax: 3.0, period: 6, drift: [7, 0.24] },
  { id: 'z4', x: -2, y: DECK, z: 24, rMin: 0, rMax: 3.4, period: 7.5, open: 0.4, axis: 'x', h: 6 },
  { id: 'z5', x: 27, y: L2, z: -21, rMin: 1.2, rMax: 6.6, period: 6.5, open: 0.4, h: 4 },
  { id: 'z6', x: -40.6, y: PIT, z: -51, rMin: 1.0, rMax: 6.0, period: 6, open: 0.42, h: 5 },
  { id: 'z7', x: 2, y: 0, z: -30, rMin: 2.0, rMax: 5.0, period: 8, open: 0.4 },
];
export const SHARDS = [
  [-12.9, 0.6, 117.2, 'on the shore of the drowned block'],
  [-45, DECK + 0.6, 20.4, 'at the far end of the Meridian East platform'],
  [38.6, L1 + 0.6, -7.6, 'in the corner of Halcyon Tower\'s first floor'],
  [-46.4, PIT + 0.7, -58.4, 'in the drowned underpass'],
  [-26.4, 6.3, -98.6, 'on Lantern Hall\'s cistern platform'],
];

// ---------------------------------------------------------------------------------------------------------------------
// Cast (registerCast never overwrites an existing id). Every look carries era, sex/age and a COSTUMES.md archetype.
// ---------------------------------------------------------------------------------------------------------------------
export const SETTLERS = [
  { era: '2196', costume: 'surv_m1', sex: 0, age: 44, height: 1.78, build: 1.0, skin: 0xa77a5d, hair: 0x15100b, hairStyle: 'short', beard: 0x15100b, topType: 'jacket', top: 0x8a7458, topKind: 'fabric', hood: true, vest: 0x4a4a3a, pantsType: 'cargo', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_f1', sex: 1, female: true, age: 29, height: 1.7, build: 0.98, skin: 0x6b4029, hair: 0x0e0a08, hairStyle: 'tied-back', topType: 'jacket', top: 0x6a5a44, topKind: 'fabric', pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_m2', sex: 0, age: 61, height: 1.69, build: 0.9, skin: 0xd8b08e, hair: 0x9a9690, hairStyle: 'short', stubble: true, topType: 'jacket', top: 0x6a6a64, topKind: 'fabric', hood: true, vest: 0x5a3e28, pantsType: 'trousers', pants: 0x8a7458, shoes: 'boots', boots: 0x4a3a2a, lod: true },
  { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 47, height: 1.65, build: 1.02, skin: 0xe0b8a0, hair: 0x8a8278, hairStyle: 'bun', topType: 'jacket', top: 0x6a6a64, topKind: 'fabric', hood: true, vest: 0x4a4a38, pantsType: 'trousers', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_m1', sex: 0, age: 33, height: 1.82, build: 1.06, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'buzz', stubble: true, topType: 'jacket', top: 0x4a3a28, topKind: 'fabric', vest: 0x7a3e22, pantsType: 'cargo', pants: 0x3a3a30, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_f1', sex: 1, female: true, age: 22, height: 1.66, build: 0.94, skin: 0xd9a585, hair: 0x5a3a22, hairStyle: 'short', topType: 'jacket', top: 0xb8ab90, topKind: 'fabric', pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, lod: true },
];
export const CHILD96 = { era: '2196', costume: 'lotte', child: true, sex: 1, female: true, age: 9, height: 1.3, build: 0.9, skin: 0xb98463, hair: 0x2a1c14, hairStyle: 'tied-back', topType: 'jacket', top: 0x8a7458, topKind: 'fabric', hood: true, pantsType: 'cargo', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true };
export function registerM14Cast() {
  // Joss Harrow: Lantern Hall's beacon keeper (COSTUMES.md surv_m2 elder mechanic: patched hooded cloak, leather tool
  // vest, wrapped hands, magnifier goggles, a repaired chest radio)
  registerCast('joss', {
    name: 'JOSS HARROW', role: 'Beacon keeper · Lantern Hall · 2196',
    bio: 'Sixty-six. Has kept the old Helix return beacon in one piece for thirty years without ever hearing it answer. Went out for parts with his daughter two days ago.',
    look: { era: '2196', costume: 'surv_m2', sex: 0, age: 66, height: 1.7, build: 0.92, skin: 0xc49a7c, hair: 0xa8a49e, hairStyle: 'grey-swept', beard: 0xa8a49e, eyes: 0x4a5a6a, wrinkles: 0.75,
      face: { jaw: 0.2, cheek: -0.1, nose: 0.45, noseWidth: 0.25, lips: -0.2, brow: 0.35, eyeSize: -0.15, faceLength: 0.25, chin: 0.1 },
      topType: 'jacket', top: 0x6a6a64, topKind: 'fabric', hood: true, vest: 0x5a3e28, pantsType: 'trousers', pants: 0x8a7458, shoes: 'boots', boots: 0x3a2a1c, gloves: 0xb8ab90 },
    rimColor: 0xb6ff8a, glow: 0x10180a, bg: 0x0a0c08,
    vp: { sex: 'm', pitch: 0.8, rate: 0.9, langs: ['en-GB', 'en-IE', 'en-US'] },
  });
  // Wren Harrow: scavenger, Joss's daughter (surv_f1 scout: cropped patched field jacket, road-sign pauldron, shin wraps,
  // goggles on the brow, rope coil, hand-crank lamp)
  registerCast('wren', {
    name: 'WREN HARROW', role: 'Scavenger · Lantern Hall · 2196',
    bio: 'Thirty-one. Knows every safe line across the Reach and most of the unsafe ones. Lost her lamp to the zone on the Line 4 beam.',
    look: { era: '2196', costume: 'surv_f1', sex: 1, female: true, age: 31, height: 1.71, build: 1.0, skin: 0xc49a7c, hair: 0x6a4a2a, hairStyle: 'tied-back', eyes: 0x4a5a6a, freckles: 0.35,
      face: { jaw: 0.05, cheek: 0.3, nose: 0.25, noseWidth: 0.05, lips: 0.05, brow: 0.2, eyeSize: 0.05, faceLength: 0.15, chin: 0.05 },
      topType: 'jacket', top: 0x6a5a44, topKind: 'fabric', vest: 0x7a6a3a, pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, gloves: 0x3a3028 },
    rimColor: 0xb6ff8a, glow: 0x10180a, bg: 0x0a0c08,
    vp: { sex: 'f', pitch: 1.04, rate: 1.06, langs: ['en-GB', 'en-AU', 'en-US'] },
  });
  // Ama Okonkwo: Lantern Hall's gardener (surv_f2 build as a gardener: grey hooded cloak, padded vest, canvas trousers)
  registerCast('ama', {
    name: 'AMA OKONKWO', role: 'Gardener · Lantern Hall · 2196',
    bio: 'Fifty-four. Grows food for a hundred and twenty people in the track bed of a freight shed. The beds have been dry for nine days.',
    look: { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 54, height: 1.64, build: 1.06, skin: 0x5a3622, hair: 0x2a2420, hairStyle: 'bun', eyes: 0x24160c, wrinkles: 0.45,
      face: { jaw: 0.1, cheek: 0.5, nose: 0.05, noseWidth: 0.45, lips: 0.35, brow: -0.1, eyeSize: 0, faceLength: -0.05, chin: 0 },
      topType: 'jacket', top: 0x4a4a32, topKind: 'fabric', hood: true, vest: 0x8a6a3a, pantsType: 'trousers', pants: 0x6a5a44, shoes: 'boots', boots: 0x2a2018, gloves: 0x5a4a38 },
    rimColor: 0xb6ff8a, glow: 0x10180a, bg: 0x0a0c08,
    vp: { sex: 'f', pitch: 0.94, rate: 0.94, langs: ['en-GB', 'en-NG', 'en-US'] },
  });
  registerCast('m14band', { name: 'CHRONOLITH BAND', role: 'Kai\'s wrist · binding', voice: true, vp: { sex: 'f', pitch: 1.18, rate: 1.06, langs: ['en-US', 'en-GB'] } });
  registerCast('m14settler', { name: 'LANTERN HALL', role: 'Settler · 2196', look: { ...SETTLERS[0], lod: false }, vp: { sex: 'm', pitch: 0.9, rate: 1.0, langs: ['en-GB', 'en-US'] } });
  registerCast('m14trader', { name: 'TRADER', role: 'Lantern Hall market · 2196', look: { ...SETTLERS[3], lod: false }, vp: { sex: 'f', pitch: 1.0, rate: 1.02, langs: ['en-GB', 'en-IE'] } });
  registerCast('m14medic', { name: 'MEDIC', role: 'Lantern Hall · 2196', look: { ...SETTLERS[1], lod: false }, vp: { sex: 'f', pitch: 1.08, rate: 1.0, langs: ['en-GB', 'en-NG'] } });
  registerCast('m14child', { name: 'CHILD', role: 'Lantern Hall school · 2196', look: { ...CHILD96, lod: false }, vp: { sex: 'f', pitch: 1.4, rate: 1.04, langs: ['en-GB', 'en-US'] } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Music (bible: "2196 — Beautiful Catastrophe: awe, grief, resilience; wide strings, distant brass, processed wind,
// slow pulse and sparse piano; 70 BPM, melancholy with quiet hope, broad dynamic space, no heavy drums").
// ---------------------------------------------------------------------------------------------------------------------
export const musicState = { zone: 0, binding: 1, beacon: 0 };
export function registerM14Themes() {
  registerTheme('m14-reach', { bpm: 70, step(a, s, t, d) {          // the overgrown city: wide strings, sparse piano, a slow pulse
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57, 64], [41, 48, 53, 60], [48, 55, 60, 67], [43, 50, 55, 62]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.017, 520 + (bar % 8) * 40); a.cello(ch[0] - 12, t, d * 16, 0.04); }
    if (b === 0 || b === 8) a.drum(t, 0.035, 52, 30);                // the slow pulse, felt more than heard
    if ((b === 4 || b === 11) && bar % 2 === 0) a.piano(ch[(b >> 2) % 4] + 12, t, 0.06, 4.5);
    if (b === 8 && bar % 4 === 2) a.flute(ch[3] + 12, t, d * 7, 0.014);   // distant brass stand-in: a long breathy line
    if (b === 14 && musicState.zone > 0.3) a.glass(ch[2] + 24, t, 0.008 + musicState.zone * 0.01);
  } });
  registerTheme('m14-zone', { bpm: 70, step(a, s, t, d) {           // near the unstable zones: glass, a tick that slips
    const bar = Math.floor(s / 16), b = s % 16, k = s % 7;
    if (b === 0) { a.pad([50, 57, 63], t, d * 16, 0.013, 380); a.cello(38, t, d * 16, 0.035); }
    if (k === 0) a.glass([81, 84, 79][Math.floor(s / 7) % 3], t, 0.011);
    if (b % 4 === 2) a.tick(t, 0.008 + musicState.zone * 0.01, 3000);
    if (b === 12 && bar % 2) a.piano(62, t, 0.05, 3);
  } });
  registerTheme('m14-track', { bpm: 76, step(a, s, t, d) {          // following the survivors: soft plucks, a walking bass
    const bar = Math.floor(s / 16), b = s % 16, ch = [[50, 57, 62], [48, 55, 60], [45, 52, 57], [47, 54, 59]][bar % 4];
    if (b === 0) a.pad(ch, t, d * 16, 0.013, 700);
    if (b % 4 === 0) a.cello(ch[0] - 12 + (b === 8 ? 7 : 0), t, d * 3, 0.03);
    if ([2, 5, 10, 13].includes(b)) a.pluck(ch[(b >> 2) % 3] + 12, t, 0.035);
    if (b === 7 && bar % 2) a.flute(ch[2] + 12, t, d * 4, 0.012);
  } });
  registerTheme('m14-memorial', { bpm: 56, step(a, s, t, d) {       // the square: grief, cello and piano, a lot of air
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 60], [41, 48, 57], [43, 50, 59], [40, 47, 55]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.015, 360); a.cello(ch[0] - 12, t, d * 16, 0.05); }
    if (b === 0 || b === 10) a.piano([69, 67, 64, 62][bar % 4] + (b === 10 ? -5 : 0), t, 0.08, 5.5);
    if (b === 6 && bar % 4 === 3) a.glass(76, t, 0.008);
  } });
  registerTheme('m14-hall', { bpm: 80, step(a, s, t, d) {           // Lantern Hall: resilience, warm plucks and a flute
    const bar = Math.floor(s / 16), b = s % 16, ch = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.014, 900); a.cello(ch[0] - 12, t, d * 16, 0.032); }
    if ([0, 3, 6, 8, 11, 14].includes(b)) a.pluck(ch[b % 4] + 12, t, 0.04);
    if (b === 8 && bar % 2) a.flute(ch[3] + 12, t, d * 6, 0.016);
    if (b % 8 === 4) a.tick(t, 0.008, 2400);
  } });
  registerTheme('m14-beacon', { bpm: 72, step(a, s, t, d) {         // the beacon wakes: layers join with musicState.beacon
    const bar = Math.floor(s / 16), b = s % 16, L = musicState.beacon, ch = [[45, 52, 57, 64], [48, 55, 60, 67], [50, 57, 62, 69], [52, 59, 64, 71]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.016 + L * 0.006, 500 + L * 400); a.cello(ch[0] - 12, t, d * 16, 0.045); }
    if (L > 0.3 && b % 4 === 0) a.pluck(ch[(b >> 2) % 4] + 12, t, 0.04);
    if (L > 0.6 && (b === 6 || b === 14)) a.piano(ch[3] + 12, t, 0.07, 3.5);
    if (L > 0.9 && b === 8) a.flute(ch[2] + 24, t, d * 6, 0.018);
  } });
  registerTheme('m14-reveal', { bpm: 52, step(a, s, t, d) {         // every version of you: piano, a low drone, silence
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0 && bar % 2 === 0) { a.pad([38, 45, 50], t, d * 32, 0.014, 260); a.cello(26, t, d * 32, 0.045); }
    if (b === 0 || (b === 9 && bar % 2)) a.piano([74, 72, 69, 67, 65][bar % 5], t, 0.07, 6);
    if (b === 12 && bar % 4 === 2) a.glass(86, t, 0.007);
  } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Code-drawn signs, plaques and papers
// ---------------------------------------------------------------------------------------------------------------------
const lines = (g, list, x, y, size, col, lh = 1.35, weight = 600) => { g.font = `${weight} ${size}px ${FONT}`; list.forEach((l, i) => { g.fillStyle = Array.isArray(l) ? l[1] : col; g.fillText(Array.isArray(l) ? l[0] : l, x, y + i * size * lh); }); };
const grain = (g, w, h, n, a, seed = 3) => { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * a})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } };
const GIVEN = ['ANA', 'TOMAS', 'LIOR', 'MEI', 'OSKAR', 'NADIA', 'IBRAHIM', 'ELSE', 'KOFI', 'RUTH', 'DMITRI', 'YUKI', 'SAMIR', 'INES', 'PAVEL', 'HANNA', 'TEODOR', 'AMARA', 'JONAS', 'LENA', 'RAFAEL', 'SOO-AH', 'MALIK', 'GRETE', 'ARJUN', 'BEA', 'CORMAC', 'ZOFIA', 'EMEKA', 'LIV'];
const FAMILY = ['ABARA', 'BRENNAN', 'CHO', 'DUVAL', 'EKWUEME', 'FALK', 'GARZA', 'HALVORSEN', 'IMAI', 'JANSSEN', 'KOVAC', 'LINDQVIST', 'MBEKI', 'NORDIN', 'OYELARAN', 'PETROVA', 'QUINTERO', 'ROSSI', 'SATO', 'TAVARES', 'UDOH', 'VASQUEZ', 'WEBER', 'XU', 'YILMAZ', 'ZAMORA'];
export const TEX = {
  names: (seed) => canvasTex(1024, 704, (g, w, h) => {
    g.fillStyle = '#6a6862'; g.fillRect(0, 0, w, h); grain(g, w, h, 4000, 0.07, seed);
    const r = rng(seed * 7 + 1); g.textAlign = 'left';
    for (let c = 0; c < 4; c++) for (let i = 0; i < 30; i++) {
      const name = FAMILY[Math.floor(r() * FAMILY.length)] + ', ' + GIVEN[Math.floor(r() * GIVEN.length)];
      g.font = `600 17px ${FONT}`; g.fillStyle = 'rgba(30,28,26,.85)'; g.fillText(name, 30 + c * 250, 40 + i * 22);
      g.fillStyle = 'rgba(230,226,214,.18)'; g.fillText(name, 31 + c * 250, 41 + i * 22);
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(40,56,30,${0.15 + r() * 0.3})`; g.beginPath(); g.ellipse(r() * w, h - r() * 140, 20 + r() * 60, 8 + r() * 30, 0, 0, 7); g.fill(); }   // lichen at the foot
  }, 'm14names' + seed),
  plaque: () => canvasTex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6a5230'); gr.addColorStop(1, '#3e2e18'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    grain(g, w, h, 2600, 0.12, 41); g.strokeStyle = 'rgba(220,190,120,.5)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.textAlign = 'center'; g.fillStyle = '#e8d29a';
    g.font = `700 84px ${FONT}`; g.fillText('KAI VAREN', w / 2, 132);
    g.font = `700 44px ${FONT}`; g.fillText('ARCHITECT OF THE FRACTURE', w / 2, 206);
    g.font = `600 30px ${FONT}`; g.fillStyle = '#d8c08a';
    g.fillText('HE BUILT THE MACHINE THAT BROKE THE HOUR', w / 2, 290);
    g.fillText('08:14 · THE LAST SECOND OF THE OLD WORLD', w / 2, 340);
    g.font = `600 26px ${FONT}`; g.fillStyle = '#c8b07a'; g.fillText('WE REMEMBER HIS FACE SO IT IS NEVER WELCOMED AGAIN', w / 2, 420);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(70,140,110,${0.15 + Math.random() * 0.25})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 4 + Math.random() * 14, 0, 0, 7); g.fill(); }   // verdigris
  }, 'm14plaque'),
  sign: (t, sub, bg = '#24302e', fg = '#e8eee6', key = '') => canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); grain(g, w, h, 900, 0.12, t.length); g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.textAlign = 'center'; g.font = `700 52px ${FONT}`; g.fillText(t, w / 2, 80); if (sub) { g.font = `600 25px ${FONT}`; g.globalAlpha = 0.7; g.fillText(sub, w / 2, 126); }
  }, 'm14sign' + t + sub + key),
  chalk: (txt, sub = '') => canvasTex(256, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(232,236,226,.9)'; g.fillStyle = 'rgba(232,236,226,.92)'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(40, 120); g.lineTo(200, 120); g.lineTo(176, 100); g.moveTo(200, 120); g.lineTo(176, 140); g.stroke();
    g.textAlign = 'center'; g.font = `700 44px ${FONT}`; g.fillText(txt, w / 2, 70); if (sub) { g.font = `700 22px ${FONT}`; g.fillText(sub, w / 2, 100); }
  }, 'm14chalk' + txt + sub),
  poster: () => canvasTex(384, 512, (g, w, h) => {
    g.fillStyle = '#e6e4dc'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9a441'; g.fillRect(0, 0, w, 90);
    g.fillStyle = '#202328'; g.textAlign = 'center'; g.font = `700 40px ${FONT}`; g.fillText('THE CONTINUUM', w / 2, 60);
    g.beginPath(); g.arc(w / 2, 210, 70, 0, 7); g.lineWidth = 10; g.strokeStyle = '#d9a441'; g.stroke();
    lines(g, ['ONE HISTORY.', 'ONE TIME.', 'REPORT EVERY', 'UNSTABLE ZONE.'], w / 2, 330, 34, '#202328', 1.25, 700);
    g.font = `600 18px ${FONT}`; g.fillText('PREFECTURE OF THE REACH · NOTICE 9', w / 2, 488);
    grain(g, w, h, 3000, 0.22, 9); g.fillStyle = 'rgba(90,70,40,.35)'; g.fillRect(0, 380, 120, 132);
  }, 'm14poster'),
  herald: () => canvasTex(384, 512, (g, w, h) => {
    g.fillStyle = '#d8d2c0'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1a1a'; g.textAlign = 'center';
    g.font = `700 34px ${FONT}`; g.fillText('RAIN CITY HERALD', w / 2, 52); g.font = `600 16px ${FONT}`; g.fillText('SUNDAY 19 OCTOBER 2049 · MORNING EDITION', w / 2, 80);
    g.fillRect(20, 92, w - 40, 3); g.font = `700 30px ${FONT}`; lines(g, ['HELIX TO RUN', 'FIRST FULL-SCALE', 'TEST TODAY'], w / 2, 134, 30, '#1a1a1a', 1.2, 700);
    g.fillStyle = '#7a7466'; g.fillRect(30, 250, w - 60, 130);
    g.fillStyle = '#1a1a1a'; g.textAlign = 'left'; lines(g, ['"Tomorrow, on time," says director', 'Rook. Lead engineer Dr. K. Varen', 'declined to comment.'], 30, 410, 17, '#1a1a1a', 1.35, 600);
    grain(g, w, h, 4000, 0.18, 12); g.fillStyle = 'rgba(120,90,40,.35)'; g.fillRect(0, 0, w, h);
  }, 'm14herald'),
  slate: () => canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#1e2420'; g.fillRect(0, 0, w, h); grain(g, w, h, 1500, 0.1, 21); g.strokeStyle = '#6a4a2a'; g.lineWidth = 16; g.strokeRect(0, 0, w, h);
    g.textAlign = 'left'; lines(g, ['WHO WAS KAI VAREN?', 'He built the machine.', 'He broke the hour.', 'We say his name first', 'so it is never done again.'], 34, 62, 32, 'rgba(232,236,226,.88)', 1.3, 700);
    g.font = `600 20px ${FONT}`; g.fillStyle = 'rgba(232,236,226,.6)'; g.fillText('then: the names of our dead (wall, row 1)', 34, 296);
  }, 'm14slate'),
  ledger: () => canvasTex(384, 384, (g, w, h) => {
    g.fillStyle = '#c8bc9c'; g.fillRect(0, 0, w, h); grain(g, w, h, 2400, 0.12, 31);
    g.textAlign = 'left'; lines(g, ['LANTERN HALL · ARRIVALS', '— 41 from the Sable line (S.V.)', '— 6 from the Reach towers', '— Joss + Wren: OUT (beacon parts)', '   back by 2nd dark, or send', '— "The architect walked out of', '   the Sable fire." (S.V. radio)', '   — do NOT tell the children yet'], 22, 44, 19, '#2a2218', 1.45, 600);
  }, 'm14ledger'),
  directory: () => canvasTex(384, 512, (g, w, h) => {
    g.fillStyle = '#2a2e30'; g.fillRect(0, 0, w, h); grain(g, w, h, 2400, 0.12, 51);
    g.textAlign = 'left'; lines(g, ['HALCYON TOWER', '', 'L40-62  ARGENT LIFE', 'L22-39  MERIDIAN HOLDINGS', 'L8-21   HELIX TEMPORAL', '        RESEARCH · ANNEX', 'PODIUM ROOF', '        CITY RELAY 4', '        (HELIX · RESTRICTED)'], 26, 50, 22, '#c8ccc8', 1.45, 700);
    g.fillStyle = 'rgba(80,110,60,.5)'; g.fillRect(0, 420, w, 92);
  }, 'm14directory'),
  clock: () => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#e8e2d0'; g.beginPath(); g.arc(256, 256, 240, 0, 7); g.fill(); g.strokeStyle = '#2a2a2a'; g.lineWidth = 14; g.stroke();
    g.fillStyle = '#1a1a1a'; for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r0 = i % 5 ? 214 : 196; g.save(); g.translate(256, 256); g.rotate(a); g.fillRect(-(i % 5 ? 2 : 5), -226, i % 5 ? 4 : 10, 226 - r0); g.restore(); }
    const hand = (a, len, wd) => { g.save(); g.translate(256, 256); g.rotate(a); g.fillRect(-wd / 2, -len, wd, len + 24); g.restore(); };
    hand((8 + 14 / 60) / 12 * Math.PI * 2, 130, 14); hand(14 / 60 * Math.PI * 2, 196, 9);
    g.beginPath(); g.arc(256, 256, 14, 0, 7); g.fill();
    g.fillStyle = 'rgba(70,90,50,.35)'; g.beginPath(); g.ellipse(150, 380, 90, 40, 0.4, 0, 7); g.fill(); grain(g, w, h, 1600, 0.12, 61);
  }, 'm14clock'),
  board: () => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#0c1012'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffb040'; g.font = `700 28px ${FONT}`; g.textAlign = 'left';
    lines(g, ['LINE 4 · DEPARTURES', '08:16  MERIDIAN EAST', '08:19  SABLE YARDS', '08:23  HELIX CAMPUS'], 22, 44, 28, '#ffb040', 1.4, 700);
    g.textAlign = 'right'; g.fillStyle = '#ffd890'; g.font = `700 44px ${FONT}`; g.fillText('08:14', w - 22, 52);
    grain(g, w, h, 1200, 0.25, 71);
  }, 'm14board'),
  note: () => canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, w, h); grain(g, w, h, 900, 0.1, 81); g.fillStyle = '#2a2a3a'; g.font = `italic 600 19px ${FONT}`; g.textAlign = 'left';
    lines(g, ['They will tell you', 'it was you. Don\'t', 'argue with them.', 'Argue with me.  — K.'], 18, 44, 19, '#2a2a3a', 1.5, 600);
  }, 'm14note'),
  plate: () => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, w, h); grain(g, w, h, 1600, 0.18, 91); g.fillStyle = '#1a1c20'; g.textAlign = 'left';
    lines(g, ['HELIX TEMPORAL RESEARCH', 'RETURN BEACON · UNIT 7', 'ANCHOR: HELIX SL4 · 2049', 'NEEDS: CELL · PHASE COIL · TIMING XTAL', 'DO NOT RUN WITHOUT A TIMING REFERENCE'], 22, 46, 24, '#1a1c20', 1.4, 700);
    g.fillStyle = 'rgba(120,60,20,.4)'; g.fillRect(380, 0, 132, 256);
  }, 'm14plate'),
  rack: (label, ok) => canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#16181a'; g.fillRect(0, 0, w, h); g.fillStyle = ok ? '#b6ff8a' : '#6a4a3a'; g.font = `700 30px ${FONT}`; g.textAlign = 'center'; g.fillText(label, w / 2, 56);
    g.font = `600 18px ${FONT}`; g.fillStyle = ok ? 'rgba(182,255,138,.7)' : 'rgba(160,120,100,.6)'; g.fillText(ok ? 'PHASE · HOLDING' : 'PHASE · OPEN', w / 2, 96);
  }, 'm14rack' + label + ok),
};

// ---------------------------------------------------------------------------------------------------------------------
// Unstable zone shell: a soft, slowly rolling column of bent light (no strobe; Comfort Mode safe)
// ---------------------------------------------------------------------------------------------------------------------
export function zoneMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmp: { value: 1 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: 'uniform float uTime; uniform float uAmp; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV;\n' +
      'void main(){ float f = 1.0 - abs(dot(normalize(vN), vV)); f = pow(f, 1.6);\n' +
      ' float bands = 0.5 + 0.5 * sin(vUv.y * 22.0 - uTime * 1.6 + sin(vUv.x * 31.4 + uTime * 0.7) * 1.5);\n' +
      ' float a = (0.18 + 0.55 * f) * (0.55 + 0.45 * bands) * pow(1.0 - vUv.y, 1.3) * uAmp;\n' +
      ' gl_FragColor = vec4(uColor * (0.7 + 0.6 * bands), a); }',
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------------------------------------------------
export function buildReach(game, scene) {
  const Q = RZ.getQuality(), low = Q === 'low';
  const W = { lightSrc: [], zones: [], waymarks: [], ups: [] };
  const col = game.collision, R = rng(1414);
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  const M = {
    asphalt: pm('wetAsphalt', { color: 0x3c3a36, puddles: 0.15 }),
    paving: pm('concrete', { color: 0x76716a, slabs: 1, stains: 0.9, formwork: 0, wet: 0 }),
    plaza: pm('cutStone', { color: 0x8a8478 }),
    concrete: pm('concrete', { color: 0x7a766e, formwork: 1, stains: 1 }),
    concreteL: pm('concrete', { color: 0x8e8a80, formwork: 1, stains: 0.6 }),
    dirt: pm('dirt', { color: 0x4a3e2e }),
    moss: pm('moss', { color: 0x4a5a2a }),
    gravel: pm('gravel', { color: 0x6a645a }),
    rust: pm('rust', { color: 0x5a3018, paint: 0x3d4a52, amount: 0.8 }),
    rustHeavy: pm('rust', { color: 0x5a3018, paint: 0x5a3a28, amount: 0.97 }),
    steel: pm('brushedMetal', { color: 0x6a6e70, roughness: 0.5 }),
    wood: pm('wood', { color: 0x5a4430, planks: 6 }),
    brick: pm('brick', { color: 0x7a4a36 }),
    tile: pm('ceramicTile', { color: 0x8a867a, grout: 0x5a564e, count: 2, gloss: 0.3, variation: 0.35 }),
    panel: pm('paintedMetalPanel', { color: 0x4a5a52, cols: 3, rows: 1, wear: 0.8, grime: 0.8, gloss: 0.2 }),
  };
  const bronze = new THREE.MeshStandardMaterial({ color: 0x6a5434, roughness: 0.42, metalness: 0.85, envMapIntensity: 1.1 });
  const verdigris = new THREE.MeshStandardMaterial({ color: 0x4a7a68, roughness: 0.6, metalness: 0.4 });
  const tarp = new THREE.MeshStandardMaterial({ color: 0x6a5a44, roughness: 0.95, side: THREE.DoubleSide });
  const tarpB = new THREE.MeshStandardMaterial({ color: 0x4a5a5a, roughness: 0.95, side: THREE.DoubleSide });
  const tarpR = new THREE.MeshStandardMaterial({ color: 0x7a3e22, roughness: 0.95, side: THREE.DoubleSide });
  const canvasM = new THREE.MeshStandardMaterial({ color: 0xb8ab90, roughness: 0.95, side: THREE.DoubleSide });
  const soil = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 });
  const green = glowMat(0xb6ff8a, 2.6), warm = glowMat(0xffc070, 2.4), ember = glowMat(0xff7a3a, 2.2), cyanGlow = glowMat(0x7fe8ff, 2.2);
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x5fe6ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glassGrime = new THREE.MeshStandardMaterial({ color: 0x8a9a9a, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  W.mats = { bronze, verdigris, green, warm, ghostMat };
  const B = new Batch();
  const box = (x0, y0, z0, x1, y1, z1, o) => col.add([Math.min(x0, x1), y0, Math.min(z0, z1)], [Math.max(x0, x1), y1, Math.max(z0, z1)], o || {});
  const src = (x, y, z, c, i, d) => W.lightSrc.push({ p: [x, y, z], c, i, d });
  const plane = (tex, w, h, x, y, z, ry, emiss = 0.2, parent = scene) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emiss, transparent: true, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m;
  };
  W.plane = plane;

  // ================= ground =================
  const PITR = [-48, -32, -60, -42];                                  // the drowned underpass is carved out of the street
  box(-72, -1, -140, PITR[0], 0, 132); box(PITR[1], -1, -140, 72, 0, 132); box(PITR[0], -1, -140, PITR[1], 0, PITR[2]); box(PITR[0], -1, PITR[3], PITR[1], 0, 132);
  // invisible bounds
  box(-73, 0, -141, -70, 20, 133); box(70, 0, -141, 73, 20, 133); box(-73, 0, 130, 73, 20, 133); box(-73, 0, -141, 73, 20, -138);
  const ground = (mat, x0, z0, x1, z1, y = 0) => { const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); B.push(mat, g); };
  ground(M.asphalt, -9, 34, 9, 130, 0.0);                             // Canopy Avenue
  ground(M.paving, -12, 34, -9, 130, 0.03); ground(M.paving, 9, 34, 12, 130, 0.03);
  ground(M.dirt, -70, -138, -48, 130, -0.06); ground(M.dirt, -32, -138, 70, 130, -0.06); ground(M.dirt, -48, -138, -32, -60, -0.06); ground(M.dirt, -48, -42, -32, 130, -0.06);
  ground(M.asphalt, -46, 10, 46, 34, 0.0);                            // under the viaduct
  ground(M.paving, 10, -38, 46, 10, 0.03);                            // tower forecourt
  ground(M.plaza, -30, -72, 10, -36, 0.045);                          // Memorial Square
  ground(M.concrete, -32, -134, 32, -74, 0.045);                       // Lantern Hall floor
  ground(M.paving, -12, -36, 10, 10, 0.03);                           // the cut between viaduct and square

  // ================= the drowned block (west of the landing): a sunken pool with reflections =================
  try {
    const wat = RZ.water({ rect: [-40, 92, 26, 36], level: -0.25, flow: [0.02, 0.01], deep: 0x16262a, shallow: 0x3a5a4a, heightAt: () => -2 });
    scene.add(wat.mesh); W.water = wat.mesh;
  } catch (e) { console.warn('m14 water', e); }
  box(-40, 0, 92, -14, 0.9, 92.6); box(-14.6, 0, 92, -14, 0.9, 128);   // low broken wall around the pool
  B.box(M.concrete, -40, -0.4, 91.8, -14, 0.9, 92.6); B.box(M.concrete, -14.6, -0.4, 92, -13.8, 0.9, 128);
  for (let i = 0; i < 9; i++) B.geo(M.concrete, new THREE.BoxGeometry(1.4 + R() * 2, 0.5 + R(), 1.2 + R() * 2), [-36 + R() * 20, -0.1, 96 + R() * 28], [R() * 0.4, R() * 3, R() * 0.4]);

  // ================= buildings: overgrown towers (one interior-mapped cityBlock) =================
  const bld = (x0, x1, z0, z1, face, o) => {
    const yaw = face === '+x' ? Math.PI / 2 : face === '-x' ? -Math.PI / 2 : face === '-z' ? Math.PI : 0;
    const w = (face === '+z' || face === '-z') ? x1 - x0 : z1 - z0, d = (face === '+z' || face === '-z') ? z1 - z0 : x1 - x0;
    return { width: Math.abs(w), depth: Math.abs(d), position: [(x0 + x1) / 2, o.y ?? 0, (z0 + z1) / 2], yaw, ...o };
  };
  const FOOT = [
    // avenue west (faces +x) and east (faces -x)
    [-66, -42, 92, 130, '+x', 62, 'concrete'], [-44, -12, 60, 90, '+x', 84, 'panel'], [-44, -12, 44, 56, '+x', 46, 'brick'],
    [12, 44, 102, 130, '-x', 70, 'panel'], [12, 44, 70, 98, '-x', 104, 'concrete'], [12, 44, 36, 66, '-x', 52, 'stone'],
    // north of the viaduct
    [-46, -14, -2, 16, '+x', 38, 'plaster'], [-58, -32, -34, -4, '+x', 58, 'darkBrick'],
    [44, 62, -40, 0, '-x', 44, 'brick'], [12, 34, -66, -40, '-z', 34, 'stone'],
    // around the square and the hall
    [-60, -48, -72, -36, '+x', 30, 'concrete'], [-60, -34, -132, -76, '+x', 40, 'brick'], [34, 62, -132, -72, '-x', 48, 'panel'],
  ];
  for (const [x0, x1, z0, z1] of FOOT) box(x0, 0, z0, x1, 60, z1);
  const tower = [27, 40, -32, -8];
  try {
    const list = FOOT.map(([x0, x1, z0, z1, face, h, wall], i) => bld(x0, x1, z0, z1, face, {
      height: h, seed: 1400 + i, wall, era: '2196', groundFloor: 4.6, faces: ['shop', 'windows', 'blank', 'windows'],
      ruin: 0.55 + (i % 3) * 0.15, moss: 0.45 + (i % 2) * 0.3, collapse: i % 3 === 1, roof: { tank: i % 2 === 0, antenna: i % 3 === 0 },
    }));
    list.push({ width: tower[3] - tower[2], depth: tower[1] - tower[0], position: [(tower[0] + tower[1]) / 2, ROOF, (tower[2] + tower[3]) / 2], yaw: -Math.PI / 2, height: 64, seed: 1488, wall: 'panel', era: '2196', ruin: 0.85, moss: 0.6, collapse: true, groundFloor: 4.2, faces: ['windows', 'windows', 'windows', 'windows'] });
    const block = RZ.cityBlock(list, { era: '2196', lit: 0.0, daylight: 0.55, detail: low ? 'low' : undefined });
    scene.add(block.mesh); W.block = block.mesh;
    const sky = RZ.skyline({ center: [0, -10], radius: [170, 300], count: low ? 30 : 52, height: [30, 150], lit: 0.0, seed: 141 });
    scene.add(sky.mesh || sky);
  } catch (e) { console.warn('m14 city', e); }
  // the leaning slab: a tower's face that fell across the avenue at z 78 (walk under it)
  B.geo(M.concrete, new THREE.BoxGeometry(46, 1.2, 9), [-2, 17, 78], [0, 0, -0.55]);
  B.geo(M.rustHeavy, new THREE.BoxGeometry(44, 0.2, 0.3), [-2, 16.2, 74], [0, 0, -0.55]);
  box(-15, 0, 73.5, -9.5, 3.5, 82.5);                                  // its foot crushes the west pavement
  B.geo(M.concrete, new THREE.BoxGeometry(6, 3.4, 9), [-12.4, 1.7, 78], [0, 0, 0.1]);
  try { scene.add(new THREE.Mesh(RZ.rebar({ origin: [-10, 3.2, 78], dir: [1, 0.6, 0], count: 14, length: 1.8, spread: 4, seed: 3 }), M.rust)); } catch (e) { void e; }

  // ================= the Line 4 viaduct =================
  const deckSlab = (x0, x1, z0, z1) => { B.box(M.concreteL, x0, DECK - 0.8, z0, x1, DECK, z1); box(x0, DECK - 0.8, z0, x1, DECK, z1); };
  deckSlab(-46, -10, 19, 31); deckSlab(6, 46, 20, 28);                // the platform (west) and the east deck
  for (const x of [-40, -28, -16, 12, 24, 36]) { B.box(M.concrete, x - 1.2, 0, 21.4, x + 1.2, DECK - 0.8, 26.6); }
  // parapets (the platform edge stays open on the north side for the track)
  B.box(M.concrete, -46, DECK, 30.6, -24.4, DECK + 1.1, 31); box(-46, DECK, 30.6, -24.4, DECK + 1.1, 31);
  B.box(M.concrete, -21.6, DECK, 30.6, -10, DECK + 1.1, 31); box(-21.6, DECK, 30.6, -10, DECK + 1.1, 31);
  B.box(M.concrete, 6, DECK, 27.6, 46, DECK + 1.1, 28); box(6, DECK, 27.6, 46, DECK + 1.1, 28);
  B.box(M.concrete, 6, DECK, 20, 39.8, DECK + 1.1, 20.4); box(6, DECK, 20, 39.8, DECK + 1.1, 20.4);
  B.box(M.concrete, -46, DECK, 19, -10, DECK + 1.1, 19.4); box(-46, DECK, 19, -10, DECK + 1.1, 19.4);
  box(-46.4, DECK, 19, -46, DECK + 3, 31); box(46, DECK, 20, 46.4, DECK + 3, 28);
  // rails on the deck and catenary masts (rusted, a few leaning)
  for (const z of [22.6, 25.4]) { B.box(M.rust, -46, DECK, z - 0.06, -10, DECK + 0.14, z + 0.06); B.box(M.rust, 6, DECK, z - 0.06, 46, DECK + 0.14, z + 0.06); }
  for (let x = -42; x <= 42; x += 12) { if (x > -12 && x < 8) continue; B.geo(M.rustHeavy, new THREE.BoxGeometry(0.22, 6, 0.22), [x, DECK + 3, 27.2], [0, 0, (R() - 0.5) * 0.12]); B.geo(M.rustHeavy, new THREE.BoxGeometry(0.16, 0.16, 5.4), [x, DECK + 5.8, 24.6], [0, 0, 0]); }
  // the station under the platform (west): a ticket hall with arches, its stairs up from the street
  B.box(M.concrete, -46, 0, 19.4, -24.6, DECK - 0.8, 30.6); box(-46, 0, 19.4, -24.6, DECK - 0.8, 30.6);
  B.box(M.panel, -21.6, 0, 19.4, -10, DECK - 0.8, 30.6); box(-21.6, 0, 19.4, -10, DECK - 0.8, 30.6);
  for (let i = 0; i < 20; i++) {                                    // stairs: street (z 40) up to the platform (z 31)
    const z1 = 40 - i * 0.45, z0 = z1 - 0.45, y = (i + 1) * 0.35;
    B.box(M.concrete, -24.4, 0, z0, -21.8, y, z1); box(-24.4, 0, z0, -21.8, y, z1);
  }
  B.box(M.concrete, -24.6, 0, 31, -24.2, DECK + 1.1, 40.4); box(-24.8, 0, 31, -24.4, DECK + 1.1, 40.4);
  B.box(M.concrete, -21.8, 0, 31, -21.4, DECK + 1.1, 40.4); box(-21.8, 0, 31, -21.4, DECK + 1.1, 40.4);
  B.box(M.concrete, -24.6, 0, 30.6, -21.4, DECK - 0.8, 31);
  // under the gap: the fallen span blocks the avenue; the east depot arches under the east deck
  B.geo(M.concreteL, new THREE.BoxGeometry(17, 0.8, 8), [-2, 2.4, 24], [0.05, 0, 0.32]); box(-10, 0, 18.6, 6, 3.2, 30);
  for (let i = 0; i < 14; i++) B.geo(M.concrete, new THREE.BoxGeometry(1 + R() * 1.8, 0.6 + R(), 1 + R() * 1.5), [-9 + R() * 14, 0.3, 17.6 + R() * 13.6], [R(), R(), R()]);
  B.box(M.brick, 6, 0, 20.4, 46, DECK - 0.8, 27.6); box(6, 0, 20.4, 46, DECK - 0.8, 27.6);
  for (let x = 9; x < 44; x += 6) B.box(M.rustHeavy, x, 0.4, 20.3, x + 4, 4.4, 20.42);
  box(46, 0, 19, 72, 4, 31); B.box(M.concrete, 46, 0, 19, 60, 3.6, 31);          // east: a rubble bank closes the street
  box(-72, 0, 19, -46, 4, 31); B.box(M.concrete, -60, 0, 19, -46, 3.6, 31);
  // the fallen gantry beam across the gap (the only way over)
  B.box(M.rust, -10.2, DECK - 0.32, 23.55, 6.2, DECK, 24.45); box(-10.2, DECK - 0.32, 23.55, 6.2, DECK, 24.45);
  B.box(M.rustHeavy, -10.2, DECK - 0.9, 23.85, 6.2, DECK - 0.32, 24.15);
  for (let x = -9; x < 6; x += 1.6) B.box(M.rustHeavy, x, DECK - 0.9, 23.6, x + 0.1, DECK - 0.32, 24.4);
  // the east exit stairs: down from the deck to the north side of the line
  for (let i = 0; i < 20; i++) {
    const z1 = 20 - i * 0.45, z0 = z1 - 0.45, y = DECK - (i + 1) * 0.35;
    if (y > 0.01) { B.box(M.concrete, 40.2, 0, z0, 43.8, y, z1); box(40.2, 0, z0, 43.8, y, z1); }
  }
  B.box(M.rust, 39.8, 0, 11, 40.1, DECK + 1, 20.4); box(39.7, 0, 11, 40.1, DECK + 1, 20); B.box(M.rust, 43.9, 0, 11, 44.2, DECK + 1, 20.4); box(43.9, 0, 11, 44.3, DECK + 1, 20);
  // station signage
  plane(TEX.sign('MERIDIAN EAST', 'LINE 4 · PLATFORM 1', '#1e3a44', '#d8e8e6'), 4.2, 1.3, -30, DECK + 2.6, 29.94, Math.PI, 0.15);
  plane(TEX.sign('LINE 4', 'MERIDIAN EAST ↑', '#1e3a44', '#d8e8e6', 'st'), 2.6, 0.8, -23, 3.0, 40.7, 0, 0.15);
  B.box(M.rustHeavy, -36, DECK, 30, -24, DECK + 3.4, 30.3);           // platform canopy back wall
  B.geo(M.rustHeavy, new THREE.BoxGeometry(24, 0.18, 6), [-30, DECK + 3.6, 28], [0.12, 0, 0]);
  for (let x = -44; x < -12; x += 5) B.box(M.wood, x, DECK, 29.2, x + 2.2, DECK + 0.45, 29.8);   // benches

  // ================= the tram wreck on the east deck =================
  const tram = new THREE.Group(); scene.add(tram);
  {
    const TB = new Batch(), body = M.rustHeavy, paint = M.panel;
    TB.box(paint, 14.5, DECK + 0.6, 22.6, 33.5, DECK + 3.4, 25.4); TB.box(body, 14.5, DECK + 0.2, 22.8, 33.5, DECK + 0.6, 25.2);
    TB.box(body, 14.5, DECK + 3.4, 22.8, 33.5, DECK + 3.7, 25.2);
    TB.box(paint, 33.5, DECK + 0.6, 22.8, 35.2, DECK + 3.2, 25.2); TB.box(body, 12.8, DECK + 0.6, 22.8, 14.5, DECK + 3.2, 25.2);
    for (let x = 15.2; x < 33; x += 2.4) TB.box(glassGrime, x, DECK + 1.9, 22.55, x + 1.8, DECK + 3.0, 22.6);
    TB.build(tram, { name: 'tram' });
    box(12.8, DECK, 22.6, 35.2, DECK + 3.7, 25.4);
    tram.rotation.z = 0.0;
    const bay = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a2e30, roughness: 0.5, metalness: 0.6 })); bay.position.set(21.2, DECK + 1.0, 22.5); scene.add(bay);
    const cellGlow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.36, 0.06), cyanGlow.clone()); cellGlow.position.set(21.2, DECK + 1.0, 22.44); scene.add(cellGlow);
    W.cellGlow = cellGlow; W.cellBay = bay;
    src(21.2, DECK + 1.6, 21.6, 0x7fe8ff, 6, 8);
  }

  // ================= Halcyon Tower podium: open floors, columns, stairs =================
  const [tx0, tx1, tz0, tz1] = [14, 40, -34, -6];
  for (let x = tx0 + 0.4; x <= tx1; x += 6.4) for (let z = tz1 - 0.4; z >= tz0; z -= 7) {
    if (x < 18 && z > -21) continue;                                          // keep the west stair bay clear
    B.box(M.concrete, x - 0.35, 0, z - 0.35, x + 0.35, ROOF, z + 0.35); box(x - 0.35, 0, z - 0.35, x + 0.35, ROOF, z + 0.35);
  }
  const slab = (y, holes) => {                                        // a slab with rectangular holes (cut as x-strips)
    const xs = [tx0, tx1, ...holes.flatMap(h => [h[0], h[1]])].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i], xb = xs[i + 1]; if (xb - xa < 0.05) continue;
      const cx = (xa + xb) / 2, cut = holes.filter(h => cx > h[0] && cx < h[1]).map(h => [h[2], h[3]]).sort((a, b) => a[0] - b[0]);
      let z = tz0;
      for (const [za, zb] of [...cut, [tz1, tz1]]) { if (za - z > 0.05) { B.box(M.concreteL, xa, y - 0.4, z, xb, y, za); box(xa, y - 0.4, z, xb, y, za); } z = Math.max(z, zb); }
    }
  };
  slab(L1, [[14, 17.8, -13.6, -6], [30, 36, -33, -27]]);             // the hole over flight A, a collapse in the east bay
  slab(L2, [[36.4, 40, -25.4, -21.6], [20, 25, -12, -7]]);             // the hole over flight B, a collapse at the front
  B.box(M.concrete, 24.5, L2, -34, 26.5, L2 + 2.2, -27.6); box(24.5, L2, -34, 26.5, L2 + 2.2, -27.6);   // fallen partitions: the only way west
  B.box(M.concrete, 24.5, L2, -12, 26.5, L2 + 2.2, -6); box(24.5, L2, -12, 26.5, L2 + 2.2, -6);          // on the second floor is past the zone
  slab(ROOF, [[14, 17.8, -20.6, -13]]);                              // the hole over flight C
  const flight = (x0, x1, zStart, dir, y0) => {
    for (let i = 0; i < 12; i++) {
      const za = zStart + dir * i * 0.45, zb = za + dir * 0.45, y = y0 + (i + 1) * 0.35;
      B.box(M.concrete, x0, y0, Math.min(za, zb), x1, y, Math.max(za, zb)); box(x0, y0, Math.min(za, zb), x1, y, Math.max(za, zb));
    }
  };
  flight(14.6, 17.4, -8.2, -1, 0); flight(36.8, 39.6, -20, -1, L1); flight(14.6, 17.4, -15.2, -1, L2);
  // parapets at the open edges of the roof, the rubble at the collapses, rebar
  B.box(M.concrete, 14, ROOF, -34, 27, ROOF + 1.0, -33.6); box(14, ROOF, -34, 27, ROOF + 1.0, -33.6);
  B.box(M.concrete, 14, ROOF, -6.4, 27, ROOF + 1.0, -6); box(14, ROOF, -6.4, 27, ROOF + 1.0, -6);
  B.box(M.concrete, 13.6, ROOF, -34, 14, ROOF + 1.0, -21); box(13.6, ROOF, -34, 14, ROOF + 1.0, -21);
  B.box(M.concrete, 13.6, ROOF, -12.6, 14, ROOF + 1.0, -6); box(13.6, ROOF, -12.6, 14, ROOF + 1.0, -6);
  box(27, ROOF, -34, 40, ROOF + 40, -6);                              // the tower shaft above the roof (east half)
  for (let i = 0; i < 10; i++) B.geo(M.concrete, new THREE.BoxGeometry(1 + R() * 1.6, 0.5 + R() * 0.8, 1 + R() * 1.6), [31 + R() * 4, L1 - 0.3 + 0.3, -32 + R() * 4], [R(), R(), R()]);
  try { const rb = RZ.rebar({ origin: [33, L1, -27], dir: [0, -1, 0.2], count: 18, length: 1.4, spread: 5, seed: 7 }); scene.add(new THREE.Mesh(rb, M.rust)); } catch (e) { void e; }
  plane(TEX.directory(), 0.9, 1.2, 19, 1.6, -5.68, 0, 0.12);
  B.box(M.concrete, 18.4, 0, -5.9, 19.6, 2.4, -5.7); box(18.4, 0, -5.9, 19.6, 2.4, -5.7);
  // the Helix relay on the podium roof: a lattice mast and a three-bay coil cabinet
  B.box(M.steel, 18.2, ROOF, -31.4, 21.2, ROOF + 2.2, -30.6); box(18.2, ROOF, -31.4, 21.2, ROOF + 2.2, -30.6);
  for (let y = 0; y < 9; y += 1.5) { B.geo(M.rust, new THREE.BoxGeometry(0.1, 1.5, 0.1), [22.6, ROOF + y + 0.75, -30.6]); B.geo(M.rust, new THREE.BoxGeometry(0.1, 1.5, 0.1), [23.8, ROOF + y + 0.75, -30.6]); B.geo(M.rust, new THREE.BoxGeometry(1.3, 0.08, 0.08), [23.2, ROOF + y + 1.5, -30.6], [0, 0, 0.6]); }
  B.cyl(M.steel, 23.2, ROOF + 9.6, -30.6, 0.9, 0.12, 16, [Math.PI / 2 - 0.4, 0, 0]);
  W.racks = [0, 1, 2].map(i => {
    const ok = i === 1, m = plane(TEX.rack(['A', 'B', 'C'][i] + '-' + ['0811', '0814', '0817'][i], ok), 0.8, 0.4, 18.9 + i * 0.9, ROOF + 1.7, -30.58, 0, 0.4);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 20), ok ? bronze : M.rustHeavy); coil.position.set(18.9 + i * 0.9, ROOF + 1.0, -30.5); scene.add(coil);
    return { label: m, coil, ok };
  });
  src(19.7, ROOF + 2.4, -29.6, 0xb6ff8a, 3, 6);

  // ================= Memorial Square =================
  const SQ = [-8, -55];
  B.box(M.plaza, SQ[0] - 2.6, 0, SQ[1] - 2.6, SQ[0] + 2.6, 2.4, SQ[1] + 2.6); box(SQ[0] - 2.6, 0, SQ[1] - 2.6, SQ[0] + 2.6, 2.4, SQ[1] + 2.6);
  B.box(M.plaza, SQ[0] - 3.4, 0, SQ[1] - 3.4, SQ[0] + 3.4, 0.35, SQ[1] + 3.4); box(SQ[0] - 3.4, 0, SQ[1] - 3.4, SQ[0] + 3.4, 0.35, SQ[1] + 3.4);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.16, 12, 64), bronze); ring.position.set(SQ[0], 2.4 + 3.2, SQ[1] - 1.0); scene.add(ring); W.ring = ring;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.06, 8, 64), verdigris); ring2.position.copy(ring.position); scene.add(ring2);
  B.box(M.steel, SQ[0] - 0.1, 2.4, SQ[1] - 1.1, SQ[0] + 0.1, 3.0, SQ[1] - 0.9);
  const plaque = plane(TEX.plaque(), 2.6, 1.3, SQ[0], 1.3, SQ[1] + 2.62, 0, 0.12); plaque.material.metalness = 0.6; plaque.material.roughness = 0.45; plaque.material.transparent = false;
  // the wall of names: an arc of panels around the north side
  const nameMats = [0, 1, 2, 3].map(i => new THREE.MeshStandardMaterial({ map: TEX.names(i + 3), roughness: 0.85 }));
  for (let i = 0; i < 9; i++) {
    const a = -1.05 + i * (2.1 / 8), r = 12, x = SQ[0] + Math.sin(a) * r, z = SQ[1] - Math.cos(a) * r;
    const pnl = new THREE.Mesh(new THREE.BoxGeometry(4.3, 3.4, 0.4), nameMats[i % 4]); pnl.position.set(x, 1.7, z); pnl.rotation.y = -a; scene.add(pnl);
    B.geo(M.plaza, new THREE.BoxGeometry(4.5, 0.3, 0.6), [x, 3.55, z], [0, -a, 0]);
    col.addBox(x, 0, z, 3.6, 3.6, 3.6);
  }
  // the stopped clock: a station clock pillar with two faces at 08:14
  B.box(M.steel, 3.75, 0, -46.25, 4.25, 4.0, -45.75); box(3.6, 0, -46.4, 4.4, 4.0, -45.6);
  const clockFace = new THREE.MeshStandardMaterial({ map: TEX.clock(), roughness: 0.5, emissive: 0xffffff, emissiveMap: TEX.clock(), emissiveIntensity: 0.08 });
  for (const s of [1, -1]) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.7, 40), clockFace); f.position.set(4, 4.6, -46 + s * 0.16); f.rotation.y = s > 0 ? 0 : Math.PI; scene.add(f); }
  B.cyl(M.steel, 4, 4.6, -46, 0.76, 0.3, 32, [Math.PI / 2, 0, 0]);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.06), M.rust); hatch.position.set(4, 1.4, -45.7); scene.add(hatch); W.clockHatch = hatch;
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), glowMat(0xd8f6ff, 2.4)); crystal.scale.set(0.8, 1.6, 0.8); crystal.position.set(4, 1.4, -45.62); scene.add(crystal); crystal.visible = false; W.clockCrystal = crystal;
  // offerings: candles, stones, flowers, drawings
  const candleG = new THREE.CylinderGeometry(0.035, 0.04, 0.16, 8), flameG = new THREE.SphereGeometry(0.025, 6, 4);
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, r = 3.6 + R() * 1.4, x = SQ[0] + Math.sin(a) * r, z = SQ[1] + Math.cos(a) * r;
    if (z < SQ[1] - 2) continue;
    B.geo(canvasM, candleG, [x, 0.08, z]); B.geo(warm, flameG, [x, 0.2, z]);
    if (i % 2) B.geo(M.gravel, new THREE.DodecahedronGeometry(0.12 + R() * 0.1, 0), [x + 0.3, 0.08, z + 0.2], [R(), R(), R()]);
  }
  src(SQ[0], 1.0, SQ[1] + 4, 0xffc070, 4, 7);
  // the Witness's note tucked behind a stone on the plinth's west side
  const wn = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), new THREE.MeshStandardMaterial({ map: TEX.note(), roughness: 0.8, side: THREE.DoubleSide })); wn.position.set(-10.66, 0.55, -57.2); wn.rotation.y = -Math.PI / 2; scene.add(wn); W.witnessNote = wn;
  // square furniture: benches, planters gone wild, tilted lamps (streetKit below)

  // ================= the drowned underpass (west of the square) =================
  {
    const [ux0, ux1, uz0, uz1] = [-48, -32, -60, -42];
    // the pit: floor and walls, stairs down on its east side
    box(ux0, PIT - 1, uz0, ux1, PIT, uz1);
    B.box(M.tile, ux0, PIT - 0.2, uz0, ux1, PIT, uz1);
    B.box(M.concrete, ux0 - 0.4, PIT, uz0 - 0.4, ux0, 0.9, uz1 + 0.4); box(ux0 - 0.4, PIT, uz0 - 0.4, ux0, 0.9, uz1 + 0.4);
    B.box(M.concrete, ux0, PIT, uz0 - 0.4, ux1, 0.9, uz0); box(ux0, PIT, uz0 - 0.4, ux1, 0.9, uz0);
    B.box(M.concrete, ux0, PIT, uz1, ux1, 0.9, uz1 + 0.4); box(ux0, PIT, uz1, ux1, 0.9, uz1 + 0.4);
    B.box(M.concrete, ux1, PIT, uz0, ux1 + 0.4, 0.9, -52.6); box(ux1, PIT, uz0, ux1 + 0.4, 0.9, -52.6);
    B.box(M.concrete, ux1, PIT, -47.4, ux1 + 0.4, 0.9, uz1); box(ux1, PIT, -47.4, ux1 + 0.4, 0.9, uz1);
    // fallen ceiling slabs along both walls: the only way to the board is through the middle, where the zone breathes
    B.geo(M.concrete, new THREE.BoxGeometry(3.4, 2.2, 4.6), [-40.6, PIT + 1.1, -57.7], [0.05, 0.2, 0.08]); box(-42.4, PIT, -60, -38.8, PIT + 2.4, -55.4);
    B.geo(M.concrete, new THREE.BoxGeometry(3.4, 2.2, 4.6), [-40.6, PIT + 1.1, -44.3], [-0.06, -0.15, 0.05]); box(-42.4, PIT, -46.6, -38.8, PIT + 2.4, -42);
    for (let i = 0; i < 8; i++) {                                    // stairs down, westward
      const xa = ux1 + 0.4 - i * 0.5, y = -(i + 1) * 0.35;
      B.box(M.concrete, xa - 0.5, PIT, -52.6, xa, y, -47.4); box(xa - 0.5, PIT, -52.6, xa, y, -47.4);
    }
    B.box(M.concrete, ux1 + 0.4, -0.4, -52.6, ux1 + 2.4, 0.02, -47.4);
    plane(TEX.sign('LINE 4 ↓', 'UNDERPASS · CLOSED', '#3a2a1a', '#e8d8b8', 'up'), 2.0, 0.62, ux1 + 2.2, 2.2, -47.0, Math.PI / 2, 0.12);
    // flooded
    try { const uw = RZ.water({ rect: [ux0, uz0, ux1 - ux0, uz1 - uz0], level: PIT + 0.55, flow: [0.01, 0], deep: 0x12201e, shallow: 0x2a4038, heightAt: () => PIT }); scene.add(uw.mesh); } catch (e) { void e; }
    // the departure board with its stopped clock (the second timing crystal)
    B.box(M.steel, ux0 + 0.05, PIT + 1.6, -52.2, ux0 + 0.3, PIT + 3.0, -49.8);
    plane(TEX.board(), 2.2, 1.1, ux0 + 0.34, PIT + 2.3, -51, Math.PI / 2, 0.55);
    const bc = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), glowMat(0xd8f6ff, 2.4)); bc.scale.set(0.8, 1.6, 0.8); bc.position.set(ux0 + 0.45, PIT + 1.4, -51); scene.add(bc); W.boardCrystal = bc;
    src(ux0 + 1.4, PIT + 2.4, -51, 0xffb040, 3, 6);
  }

  // ================= Lantern Hall (the old Central Freight shed) =================
  const H = { x0: -30, x1: 30, z0: -132, z1: -76 };
  // side walls with arched openings
  for (const x of [H.x0, H.x1]) {
    for (let z = H.z0; z < H.z1; z += 8) {
      B.box(M.brick, x - 0.6, 0, z, x + 0.6, 10, z + 2); box(x - 0.6, 0, z, x + 0.6, 10, z + 2);
      B.box(M.brick, x - 0.6, 6.2, z + 2, x + 0.6, 10, z + 8); box(x - 0.6, 0, z + 2, x + 0.6, 2.6, z + 8);
      B.box(M.brick, x - 0.5, 0, z + 2, x + 0.5, 2.6, z + 8);
    }
  }
  B.box(M.brick, H.x0, 0, H.z0 - 0.6, H.x1, 12, H.z0); box(H.x0, 0, H.z0 - 0.6, H.x1, 12, H.z0);
  // the arched trusses (some fallen), roof glazing remains in two bays
  for (let z = H.z0 + 4, k = 0; z < H.z1; z += 8, k++) {
    if (k === 3) { B.geo(M.rustHeavy, new THREE.BoxGeometry(0.4, 0.6, 26), [8, 0.4, z], [0, 0.9, 0.2]); continue; }
    for (let i = 0; i < 12; i++) {
      const a0 = Math.PI * i / 12, a1 = Math.PI * (i + 1) / 12, p0 = [Math.cos(a0) * 30, 10 + Math.sin(a0) * 9], p1 = [Math.cos(a1) * 30, 10 + Math.sin(a1) * 9];
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      B.geo(M.rust, new THREE.BoxGeometry(len, 0.42, 0.32), [mx, my, z], [0, 0, ang]);
    }
    if (k === 1 || k === 4) B.geo(glassGrime, new THREE.BoxGeometry(44, 0.04, 7.6), [0, 18.6, z], [0, 0, 0]);
  }
  // the gate barricade: scrap panels, a gate that opens
  B.box(M.rustHeavy, H.x0, 0, -76.4, -3.2, 3.2, -75.8); box(H.x0, 0, -76.4, -3.2, 3.2, -75.8);
  B.box(M.rustHeavy, 3.2, 0, -76.4, H.x1, 3.2, -75.8); box(3.2, 0, -76.4, H.x1, 3.2, -75.8);
  for (let x = -29; x < 29; x += 3.1) if (Math.abs(x) > 3.5) B.geo(R() < 0.5 ? M.panel : M.wood, new THREE.BoxGeometry(2.8, 2.4 + R() * 0.8, 0.12), [x, 1.5, -75.7], [0, 0, (R() - 0.5) * 0.08]);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.0, 0.2), M.panel); gate.position.set(0, 1.5, -76.1); scene.add(gate); W.gate = gate;
  W.gateBox = box(-3.2, 0, -76.4, 3.2, 3.2, -75.8);
  plane(TEX.sign('LANTERN HALL', 'ALL WHO WALK IN THE NOW', '#2a3424', '#e8f0d8'), 3.8, 1.2, 0, 4.2, -75.6, 0, 0.2);
  B.box(M.rust, -3.4, 0, -76.2, -3.0, 4.8, -75.8); B.box(M.rust, 3.0, 0, -76.2, 3.4, 4.8, -75.8);
  // platforms: homes (west) and the market (east)
  for (const [x0, x1] of [[-22, -14], [14, 22]]) {
    B.box(M.concrete, x0, 0, -126, x1, 1.0, -84); box(x0, 0, -126, x1, 1.0, -84);
    for (let i = 0; i < 3; i++) { B.box(M.concrete, x0 + 2, 0, -84 + i * 0.45, x1 - 2, 1.0 - (i + 1) * 0.33, -83.55 + i * 0.45); box(x0 + 2, 0, -84 + i * 0.45, x1 - 2, 1.0 - (i + 1) * 0.33, -83.55 + i * 0.45); }
  }
  // homes: tarp shelters on the west platform; stalls on the east platform
  for (let z = -122, k = 0; z < -88; z += 7, k++) {
    const T = [tarp, tarpB, tarpR][k % 3];
    B.geo(T, new THREE.BoxGeometry(6.4, 0.06, 4.6), [-18, 3.0, z], [0.18, 0, 0]);
    for (const dx of [-3, 3]) for (const dz of [-2.2, 2.2]) B.box(M.wood, -18 + dx - 0.06, 1, z + dz - 0.06, -18 + dx + 0.06, 3.0 + (dz > 0 ? -0.4 : 0.4), z + dz + 0.06);
    B.box(M.wood, -21.6, 1, z - 2, -14.4, 1.4, z + 2);
    B.geo(T, new THREE.BoxGeometry(5.4, 0.05, 3.6), [18, 2.8, z], [-0.15, 0, 0]);
    for (const dx of [-2.6, 2.6]) B.box(M.wood, 18 + dx - 0.06, 1, z - 1.8, 18 + dx + 0.06, 2.8, z - 1.68);
    B.box(M.wood, 15.4, 1, z - 1.2, 20.6, 1.95, z + 0.4);
    for (let j = 0; j < 4; j++) B.geo([M.gravel, soil, canvasM][j % 3], new THREE.BoxGeometry(0.5, 0.3, 0.4), [16 + j * 1.2, 2.1, z - 0.4], [0, R(), 0]);
  }
  // the track bed: raised garden beds between the platforms
  W.beds = [];
  for (let z = -112; z < -92; z += 4.5) for (const x of [-7, 0, 7]) {
    B.box(M.wood, x - 2.2, 0, z - 1.6, x + 2.2, 0.6, z + 1.6); box(x - 2.2, 0, z - 1.6, x + 2.2, 0.6, z + 1.6);
    const s = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.04, 3.0), soil); s.position.set(x, 0.6, z); scene.add(s); W.beds.push(s);
  }
  // the cistern on stilts (west), its ladder steps and the pipe run to the beds
  B.cyl(M.rust, P.cistern[0], 7.8, P.cistern[2], 1.8, 3.4, 20);
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) B.box(M.rustHeavy, P.cistern[0] + dx - 0.12, 0, P.cistern[2] + dz - 0.12, P.cistern[0] + dx + 0.12, 6, P.cistern[2] + dz + 0.12);
  B.box(M.wood, P.cistern[0] - 3, 5.8, P.cistern[2] - 3, P.cistern[0] + 3, 6.0, P.cistern[2] + 3); box(P.cistern[0] - 3, 5.8, P.cistern[2] - 3, P.cistern[0] + 3, 6.0, P.cistern[2] + 3);
  box(P.cistern[0] - 1.6, 6.0, P.cistern[2] - 1.6, P.cistern[0] + 1.6, 9.5, P.cistern[2] + 1.6);
  for (let i = 0; i < 17; i++) {                                   // steps up the west side of the cistern tower, along the hall wall
    const z1 = -94 - i * 0.42, y = (i + 1) * 0.35, x0 = P.cistern[0] - 4.6;
    B.box(M.wood, x0, y - 0.1, z1 - 0.42, x0 + 1.4, y, z1); box(x0, 0, z1 - 0.42, x0 + 1.4, y, z1);
  }
  B.cyl(M.rust, -22.4, 3, -102.75, 0.12, 6, 8); B.geo(M.rust, new THREE.CylinderGeometry(0.12, 0.12, 18.6, 8), [-13.1, 0.3, -102.75], [0, 0, Math.PI / 2]);
  W.valves = {};
  for (const [k, p] of [['top', [P.vTop[0], P.vTop[1] + 0.7, P.vTop[2] + 0.66]], ['run', [P.vRun[0], 0.6, P.vRun[2]]], ['beds', [P.vBeds[0], 0.7, P.vBeds[2]]]]) {
    const v = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 16), new THREE.MeshStandardMaterial({ color: 0xa83a22, roughness: 0.5, metalness: 0.5 }));
    v.position.set(p[0], p[1], p[2]); v.rotation.y = Math.PI / 2; scene.add(v); W.valves[k] = v;
  }
  plane(TEX.chalk('BEDS·RUN·TOP', 'bottom up or she blows'), 1.2, 0.75, P.cistern[0] - 1.6, 1.6, P.cistern[2] + 1.75, 0, 0.1);
  // the water when the garden runs: a thin glossy line along the beds
  const flowMat = new THREE.MeshStandardMaterial({ color: 0x4a7a8a, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.75 });
  W.flow = new THREE.Group(); scene.add(W.flow); W.flow.visible = false;
  for (let z = -112; z < -92; z += 4.5) for (const x of [-7, 0, 7]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 3.0), flowMat); m.position.set(x, 0.63, z); W.flow.add(m); }
  // the old channel along the hall's east side (runs only if the ancient river was turned, mission 5)
  W.channel = new THREE.Group(); scene.add(W.channel);
  B.box(M.concrete, 24, -0.6, -130, 26.4, 0.05, -78);
  try { const cw = RZ.water({ rect: [24.2, -130, 2.0, 52], level: -0.12, flow: [0, -0.3], deep: 0x16302e, shallow: 0x3a6a5a, heightAt: () => -0.6 }); W.channel.add(cw.mesh); } catch (e) { void e; }
  box(24, 0, -130, 26.4, 0.4, -78);
  // cook fire, lanterns, the school slate, the ledger board
  B.cyl(M.rustHeavy, 0, 0.4, -86.5, 0.7, 0.8, 14); B.geo(ember, new THREE.SphereGeometry(0.42, 10, 6), [0, 0.86, -86.5]); box(-0.8, 0, -87.3, 0.8, 0.9, -85.7);
  src(0, 1.6, -86.5, 0xff9a50, 7, 11);
  const lanternG = new THREE.SphereGeometry(0.13, 8, 6);
  for (let z = -128; z < -80; z += 3) for (const x of [-14, 14]) { B.geo(warm, lanternG, [x + (R() - 0.5) * 0.4, 4.2 + Math.sin(z) * 0.3, z]); }
  for (let x = -12; x <= 12; x += 2) B.geo(warm, lanternG, [x, 5.6 - Math.cos(x / 12 * 1.5) * 0.8, -100]);
  src(-14, 4.4, -110, 0xffc070, 4, 10); src(14, 4.4, -104, 0xffc070, 4, 10);
  B.box(M.wood, 17.2, 1, -94.6, 17.4, 2.4, -93.4); plane(TEX.slate(), 1.4, 0.88, 17.1, 2.0, -94, -Math.PI / 2, 0.12);
  B.box(M.wood, -17.4, 1, -89.2, -17.2, 2.4, -88); plane(TEX.ledger(), 1.0, 1.0, -17.1, 2.0, -88.6, Math.PI / 2, 0.12);

  // ================= the return beacon (north end) =================
  const BX = P.beacon[0], BZ = P.beacon[2];
  B.box(M.concrete, BX - 4, 0, BZ - 4, BX + 4, 0.4, BZ + 4); box(BX - 4, 0, BZ - 4, BX + 4, 0.4, BZ + 4);
  for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) B.geo(M.steel, new THREE.BoxGeometry(0.16, 13, 0.16), [BX + dx * 0.7, 6.9, BZ + dz * 0.7], [dz * 0.04, 0, -dx * 0.04]);
  for (let y = 1.6; y < 12; y += 1.8) B.geo(M.steel, new THREE.BoxGeometry(2.2 - y * 0.08, 0.08, 0.08), [BX, y, BZ + 1.0 - y * 0.03], [0, 0, 0]);
  const emitter = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 10, 40), new THREE.MeshStandardMaterial({ color: 0x2a3036, emissive: 0x7fe8ff, emissiveIntensity: 0.0, roughness: 0.3, metalness: 0.8 }));
  emitter.position.set(BX, 13.2, BZ); emitter.rotation.x = Math.PI / 2; scene.add(emitter); W.emitter = emitter;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 120, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  beam.position.set(BX, 73, BZ); scene.add(beam); W.beam = beam;
  B.box(M.steel, BX - 1.2, 0.4, BZ + 1.6, BX + 1.2, 1.5, BZ + 2.4); box(BX - 1.2, 0.4, BZ + 1.6, BX + 1.2, 1.5, BZ + 2.4);
  plane(TEX.plate(), 1.2, 0.6, BX, 1.0, BZ + 2.42, 0, 0.12);
  W.sockets = [-0.7, 0, 0.7].map((dx, i) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.34), new THREE.MeshStandardMaterial({ color: 0x1a1c20, emissive: [0x7fe8ff, 0xb6ff8a, 0xd8f6ff][i], emissiveIntensity: 0.0, roughness: 0.4 }));
    s.position.set(BX + dx, 1.6, BZ + 2.0); scene.add(s); return s;
  });
  B.box(M.wood, BX + 2.6, 0.4, BZ + 2.4, BX + 3.8, 0.85, BZ + 3.4); box(BX + 2.6, 0.4, BZ + 2.4, BX + 3.8, 0.85, BZ + 3.4);  // Joss's bench
  src(BX, 2.6, BZ + 3, 0xb6ff8a, 3, 8);
  // the beacon's housing: a drum at the mast foot, two Helix field cabinets, collar rings up the mast, cable runs
  B.cyl(M.steel, BX, 0.75, BZ, 1.5, 0.7, 20); B.cyl(M.rustHeavy, BX, 1.2, BZ, 1.15, 0.22, 20);
  for (const sx of [-1, 1]) {
    B.box(M.panel, BX + sx * 2.0 - 0.45, 0.4, BZ + 0.9, BX + sx * 2.0 + 0.45, 2.1, BZ + 1.9); box(BX + sx * 2.0 - 0.45, 0.4, BZ + 0.9, BX + sx * 2.0 + 0.45, 2.1, BZ + 1.9);
    for (let y = 0.7; y < 1.9; y += 0.18) B.box(M.steel, BX + sx * 2.0 - 0.36, y, BZ + 1.9, BX + sx * 2.0 + 0.36, y + 0.06, BZ + 1.94);
    B.cyl(M.rust, BX + sx * 1.1, 0.48, BZ + 1.3, 0.07, 1.6, 6, [0, 0, Math.PI / 2]);
  }
  for (const y of [4.2, 8.0, 11.6]) B.geo(M.steel, new THREE.TorusGeometry(1.15 - y * 0.02, 0.06, 6, 20), [BX, y, BZ], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) B.cyl(M.rustHeavy, BX - 0.4 + i * 0.4, 0.46, BZ + 2.9 + i * 0.5, 0.05, 3.2, 6, [0, 0.4 - i * 0.3, Math.PI / 2]);

  // ================= waymarks (green lantern cairns) =================
  for (const [x, y, z] of WAYMARKS) {
    for (let i = 0; i < 4; i++) B.geo(M.gravel, new THREE.DodecahedronGeometry(0.42 - i * 0.08, 0), [x, y + 0.25 + i * 0.32, z], [R(), R(), R()]);
    B.box(M.rust, x - 0.03, y + 1.2, z - 0.03, x + 0.03, y + 1.9, z + 0.03);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), green.clone()); l.position.set(x, y + 1.95, z); scene.add(l); l.userData.noBatch = true;
    W.waymarks.push({ x, y, z, lamp: l, lit: false });
  }

  // ================= nature: trees, shrubs, grass, ivy =================
  try {
    const avenue = [];
    for (let z = 126; z > 36; z -= 7) { if (Math.abs(z - 78) < 6) continue; avenue.push({ x: -10.8 + R() * 0.8, z: z + R() * 2, scale: 0.7 + R() * 0.4 }); avenue.push({ x: 10.6 + R() * 0.8, z: z - 3 + R() * 2, scale: 0.65 + R() * 0.45 }); }
    for (const [x, z] of [[-4.6, 100], [5.2, 84], [-6.2, 68], [6.6, 52], [-20, -30], [-24, -48], [8, -62], [-26, -66], [20, 2], [-6, -20], [44, 4]]) avenue.push({ x, z, scale: 0.9 + R() * 0.5 });
    scene.add(RZ.forest({ species: 'broadleaf', placements: avenue, heightAt: () => 0, impostors: false, variants: 3, seed: 14, focus: [0, 60] }));
    const shrubs = []; for (let i = 0; i < 50; i++) { const x = (R() - 0.5) * 22, z = 30 + R() * 96; if (Math.abs(x) < 4 && R() < 0.6) continue; shrubs.push({ x, z, scale: 0.5 + R() * 0.6 }); }
    for (let i = 0; i < 20; i++) shrubs.push({ x: -28 + R() * 36, z: -38 - R() * 32, scale: 0.4 + R() * 0.5 });
    scene.add(RZ.forest({ species: 'shrub', placements: shrubs, heightAt: () => 0, impostors: false, variants: 2, seed: 15 }));
    // trees growing out of the towers' roofs and the podium
    const roofTrees = [{ x: -54, z: 112, y: 62 }, { x: -26, z: 76, y: 84 }, { x: 26, z: 52, y: 52 }, { x: 30, z: 116, y: 70 }, { x: 22, z: -24, y: ROOF }, { x: -30, z: 6, y: 38 }];
    for (const t of roofTrees) { const g = RZ.forest({ species: 'broadleaf', placements: [{ x: t.x, z: t.z, scale: 0.8 }], heightAt: () => t.y, impostors: false, variants: 1, seed: 16 + t.x }); scene.add(g); }
  } catch (e) { console.warn('m14 trees', e); }
  try {
    const mask = (x, z) => {
      if (z > 34 && z < 130 && Math.abs(x) < 12) return Math.abs(x) > 7.5 ? 0.9 : 0.16;                   // the avenue's cracked asphalt and verges
      if (z < -36 && z > -72 && x > -30 && x < 10) return Math.hypot(x + 8, z + 55) < 6 ? 0 : 0.35;     // between the square's stones
      if (z < 10 && z > -36 && x > -12 && x < 10) return 0.7;
      if (z < 34 && z > 10 && Math.abs(x) < 46) return 0.4;
      if (z < -76) return 0;
      if (x > -40 && x < -14 && z > 92) return 0;                                                       // the drowned block
      if (x > -48.5 && x < -31.5 && z > -60.5 && z < -41.5) return 0;                                   // the underpass
      return 0.85;
    };
    const gr = RZ.instancedGrass({ heightAt: () => 0, mask, rect: [-70, -76, 140, 206], radius: 26, height: 0.55, color: 0x5a7030, tipColor: 0xc8b870, seed: 141 });
    scene.add(gr.mesh); W.grass = gr.mesh;
  } catch (e) { console.warn('m14 grass', e); }
  try {
    const iv = RZ.ivy({ edges: [
      [[-12.2, 30, 60], [-12.2, 30, 88], [1, 0, 0]], [[-14.2, 24, 98], [-14.2, 24, 128], [1, 0, 0]], [[12.2, 34, 72], [12.2, 34, 96], [-1, 0, 0]], [[12.2, 20, 38], [12.2, 20, 64], [-1, 0, 0]],
      [[14, ROOF - 0.4, -34], [14, ROOF - 0.4, -6], [-1, 0, 0]], [[14, L2 - 0.4, -34], [40, L2 - 0.4, -34], [0, 0, -1]], [[-30.6, 9.6, -130], [-30.6, 9.6, -80], [-1, 0, 0]], [[30.6, 9.6, -130], [30.6, 9.6, -80], [1, 0, 0]],
      [[-46, DECK - 0.8, 31], [-24.6, DECK - 0.8, 31], [0, 0, 1]], [[6, DECK - 0.8, 28], [40, DECK - 0.8, 28], [0, 0, 1]],
    ], length: [1.2, 5.5], density: low ? 1.2 : 2, patches: [{ center: [-12.2, 0, 44], normal: [1, 0, 0], width: 6, height: 5 }, { center: [12.2, 0, 108], normal: [-1, 0, 0], width: 8, height: 6 }, { center: [-8, 0, -51.4], normal: [0, 0, 1], width: 3, height: 1.4 }], seed: 141 });
    scene.add(iv.mesh || iv);
  } catch (e) { console.warn('m14 ivy', e); }

  // ================= streets (props.js streetKit, 2196) =================
  try {
    const k = streetKit({ era: '2196', seed: 96 });
    k.kerb([[-9, 130], [-9, 34]], { weeds: 0.9 }).kerb([[9, 34], [9, 130]], { weeds: 0.9 });
    k.scatter('lamp', [[10.6, 126], [10.6, 40]], { spacing: 18, turn: -Math.PI / 2, y: 0 }).scatter('lamp', [[-10.6, 120], [-10.6, 40]], { spacing: 18, turn: Math.PI / 2, y: 0 });
    k.car([-3.6, 0, 118, 0.3], 0).van([4.2, 0, 104, Math.PI - 0.5]).car([6.2, 0, 92, 2.2]).car([-5.2, 0, 70, 0.9]).car([5.4, 0, 54, Math.PI + 0.2]).van([-6.4, 0, 40, 0.1]);
    k.car([-20, 0, -6, 1.1]).car([30, 0, 2, 0.4]).van([-22, 0, -42, 2.4]).car([7, 0, -60, 0.7]);
    k.overgrowth({ area: [-9, 34, 9, 130] }, { density: 0.8, cracks: 0.9 }).overgrowth({ area: [-46, -70, 46, 34] }, { density: 0.55, cracks: 0.7 });
    k.scatter('rubble', { area: [-9, 36, 9, 128] }, { count: 26 }).scatter('rubble', { area: [-30, -36, 10, 10] }, { count: 14 });
    k.scatter('bench', [[-26, -40], [6, -40]], { spacing: 8, turn: Math.PI, y: 0 }).bins([[9.6, 0, 110], [-9.6, 0, 60]]);
    k.cables([[[-12, 14, 96], [12, 12, 94]], [[-12, 12, 50], [12, 13, 48]]]);
    const built = k.build(); scene.add(built);
    for (const c of k.colliders) col.add(c.min, c.max);
  } catch (e) { console.warn('m14 street', e); }

  // ================= unstable temporal zones =================
  // 2049 ghosts inside the zones (one merged mesh each): a clean street lamp, a car, a commuter under an umbrella
  const gm = (list) => mergeGeometries(list.map(([g, x, y, z]) => { const c = g.clone(); c.translate(x, y, z); return c.index ? c.toNonIndexed() : c; }));
  const ghostLamp = gm([[new THREE.CylinderGeometry(0.06, 0.09, 6, 8), 0, 3, 0], [new THREE.BoxGeometry(1.6, 0.1, 0.18), 0.7, 6, 0]]);
  const ghostCar = gm([[new THREE.BoxGeometry(1.9, 0.7, 4.4), 0, 0.6, 0], [new THREE.BoxGeometry(1.7, 0.5, 2.2), 0, 1.2, -0.2]]);
  const ghostPerson = gm([[new THREE.CapsuleGeometry(0.22, 1.1, 4, 8), 0, 0.85, 0], [new THREE.SphereGeometry(0.13, 10, 8), 0, 1.65, 0], [new THREE.ConeGeometry(0.55, 0.2, 12, 1, true), 0, 2.05, 0]]);
  const debrisG = new THREE.DodecahedronGeometry(0.16, 0), dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), de = new THREE.Euler(), dv = new THREE.Vector3(), ds = new THREE.Vector3();
  for (const zd of ZONES) {
    const g = new THREE.Group(); g.position.set(zd.x, zd.y, zd.z); scene.add(g);
    const mat = zoneMaterial(0x9ad8ff);
    const zh = zd.h || 7, shell = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, zh, 40, 1, true), mat); shell.position.y = zh / 2; shell.userData.noBatch = true; g.add(shell);
    const ringM = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), ringM); ringMesh.rotation.x = -Math.PI / 2; ringMesh.position.y = 0.04; g.add(ringMesh);
    // Residue Vision shows the zone's full reach and its rhythm (a marker sweeping the ring)
    const maxRing = new THREE.Mesh(new THREE.RingGeometry(zd.rMax - 0.08, zd.rMax, 72), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    maxRing.rotation.x = -Math.PI / 2; maxRing.position.y = 0.06; g.add(maxRing); game.residue(maxRing);
    const sweep = new THREE.Mesh(new THREE.CircleGeometry(zd.rMax, 48, 0, 0.0001), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    sweep.rotation.x = -Math.PI / 2; sweep.position.y = 0.05; g.add(sweep); game.residue(sweep);
    const nD = low ? 6 : 10, debris = new THREE.InstancedMesh(debrisG, M.concrete, nD); debris.userData.noBatch = true; debris.frustumCulled = false;
    debris.userData.list = Array.from({ length: nD }, () => ({ a: R() * 6.28, r: 0.3 + R() * 0.6, h: 0.4 + R() * 2.4, s: 0.4 + R() * 0.8, k: 0.6 + R() * 1.4 })); g.add(debris);
    const ghost = new THREE.Mesh(zd.id === 'z4' ? ghostPerson : [ghostLamp, ghostCar, ghostPerson][ZONES.indexOf(zd) % 3], ghostMat); ghost.userData.noBatch = true; ghost.position.set(0.4, 0, -0.3); ghost.rotation.y = R() * 6; g.add(ghost);
    W.zones.push({ ...zd, g, shell, mat, ringMesh, maxRing, sweep, debris, ghost, r: zd.rMax, phase: R() * zd.period, on: true, cx: zd.x, cz: zd.z });
  }

  // ================= atmosphere: haze, dust motes in the sun, birds =================
  try {
    scene.add(RZ.hazeLayer({ center: [0, 0], radius: 220, height: 80, color: 0xd8b890, opacity: 0.5, arc: [-3.2, 3.2] }));
    scene.add(RZ.hazeLayer({ kind: 'sheet', center: [-26, 110], size: [40, 40], y: 0.6, color: 0xe8e0d0, opacity: 0.3 }));
    scene.add(RZ.particles({ kind: 'dust', count: low ? 140 : 320, center: [0, 3, 80], area: [20, 6, 60], color: 0xffe0b0 }));
    scene.add(RZ.particles({ kind: 'dust', count: low ? 80 : 180, center: [0, 4, -104], area: [26, 8, 26], color: 0xffd8a0 }));
    const s1 = RZ.lightShaft({ from: [-6, 19, -100], to: [-2, 0, -106], radius: [2.2, 4.2], color: 0xffd8a8, intensity: 0.32 }); scene.add(s1);
    const s2 = RZ.lightShaft({ from: [6, 19, -116], to: [4, 0, -112], radius: [1.8, 3.4], color: 0xffd8a8, intensity: 0.26 }); scene.add(s2);
    const s3 = RZ.lightShaft({ from: [28, 16, -12], to: [22, L1, -18], radius: [1.6, 3.4], color: 0xffd8a8, intensity: 0.22 }); scene.add(s3);
  } catch (e) { console.warn('m14 atmosphere', e); }
  const birds = new THREE.Group(); scene.add(birds);
  const birdG = new THREE.BufferGeometry(); birdG.setAttribute('position', new THREE.Float32BufferAttribute([-0.35, 0.05, 0, 0, 0, 0.05, 0, 0, -0.05, 0.35, 0.05, 0, 0, 0, 0.05, 0, 0, -0.05], 3));
  const birdM = new THREE.MeshBasicMaterial({ color: 0x1a1612, side: THREE.DoubleSide });
  const flock = []; for (let i = 0; i < (low ? 8 : 16); i++) { const b = new THREE.Mesh(birdG, birdM); b.userData = { r: 18 + R() * 30, h: 34 + R() * 26, s: 0.08 + R() * 0.06, a: R() * 6.28, c: [R() < 0.5 ? -10 : 14, R() < 0.5 ? 80 : -20] }; birds.add(b); flock.push(b); }

  // ================= merge and finish =================
  B.build(scene, { name: 'reach' });

  const cam = game.engine.camera.position;
  W.update = (dt, t) => {
    for (const b of flock) { const u = b.userData; u.a += dt * u.s; b.position.set(u.c[0] + Math.cos(u.a) * u.r, u.h + Math.sin(u.a * 3) * 1.4, u.c[1] + Math.sin(u.a) * u.r); b.rotation.y = -u.a; b.scale.y = 1 + Math.sin(t * 9 + u.r) * 0.8; }
    for (const z of W.zones) {
      z.mat.uniforms.uTime.value = t;
      if (z.drift) { z.cx = z.x + Math.sin(t * z.drift[1]) * z.drift[0]; z.g.position.x = z.cx; }
      const cyc = ((t + z.phase) % z.period) / z.period, o = z.open || 0;
      // closed (rMin) for the first `open` part of the cycle, then a 0.6 s swell, then full, then a soft collapse
      let k;
      if (z.rMin === z.rMax) k = 1;
      else if (cyc < o) k = 0;
      else { const u = (cyc - o) / (1 - o); k = u < 0.18 ? (u / 0.18) ** 2 * (3 - 2 * (u / 0.18)) : u > 0.85 ? 1 - ((u - 0.85) / 0.15) : 1; }
      z.k = k; z.cyc = cyc; z.r = z.on ? z.rMin + (z.rMax - z.rMin) * k : 0;
      z.g.visible = Math.hypot(cam.x - z.cx, cam.z - z.z) < (low ? 70 : 95);
      if (!z.g.visible) continue;
      const vis = z.on && z.r > 0.05;
      z.shell.visible = vis; z.ringMesh.visible = vis;
      z.shell.scale.set(Math.max(0.01, z.r), 1, Math.max(0.01, z.r)); z.ringMesh.scale.setScalar(Math.max(0.01, z.r));
      // telegraph: the shell brightens in the last 0.8 s before it swells
      const before = z.open ? ((o - cyc + 1) % 1) * z.period : 9;
      z.mat.uniforms.uAmp.value = (z.on ? 1 : 0) * (0.6 + 0.4 * k + (before < 0.8 && k < 0.05 ? 0.9 * (1 - before / 0.8) : 0));
      z.ringMesh.material.opacity = 0.25 + 0.35 * k;
      if (z.sweep.visible) { z.sweep.geometry.dispose(); z.sweep.geometry = new THREE.CircleGeometry(z.rMax, 32, Math.PI / 2, Math.max(0.0001, cyc * Math.PI * 2)); }
      z.maxRing.material.color.setHex(cyc < o ? 0x9aff8a : 0xffd27a);
      z.debris.userData.list.forEach((u, i) => { const rr = Math.max(0.4, z.r) * u.r; dv.set(Math.cos(u.a + t * 0.3 * u.s) * rr, u.h + Math.sin(t * u.s + u.a) * 0.4, Math.sin(u.a + t * 0.3 * u.s) * rr); dq.setFromEuler(de.set(t * u.s, t * 0.7 * u.s, 0)); dm.compose(dv, dq, ds.setScalar(u.k)); z.debris.setMatrixAt(i, dm); });
      z.debris.instanceMatrix.needsUpdate = true; z.debris.visible = z.on;
      z.ghost.visible = z.on && k > 0.3;
    }
    for (const w of W.waymarks) w.lamp.material.emissiveIntensity = (w.lit ? 3.2 : 1.6) + Math.sin(t * 1.4 + w.x) * 0.3;
    if (W.cellGlow.visible) W.cellGlow.material.emissiveIntensity = 1.8 + Math.sin(t * 2.6) * 0.5;
    W.ring.rotation.z = Math.sin(t * 0.05) * 0.02;
  };
  return W;
}
