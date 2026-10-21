// Mission 15 environment: Harrow Reach, a 2196 survivor city built into the north end of old Rain City, held in one
// day (Thursday 14 May 2193) by Dr. Anja Vale's Lantern. North = -z, everything at ground level y = 0.
//   The Archive Plaza (x -24..24, z -10..24) with the Hollow Archive north of it (x -20..20, z -46..-10): the main
//   hall (the Separation Board, the stacks, the Lantern under the dome), Mara Quill's Second Archive in the west wing,
//   Anja's lab in the east wing. In 2049 the same building is the Rain City Civic Museum (the only 2049 signature in
//   the lock: the "thin spot"), with the Helix gallery in the west wing.
//   West: Harrow North station (concourse x -76..-50, the turnstiles at x -76, Platform Two x -86..-76, the track bed
//   x -94..-86 one metre down, Platform One x -100..-94, the signal box over Platform Two's north end).
//   East: Larkfield School (x 52..80, z -34..-6) and its yard (x 36..52, z -36..8), the arrival road (z 8..20) to the
//   Lock Gate at x 66.
//   South: the Saltmarket Hall (x -22..22, z 40..70), its east half collapsed.
// Static geometry is merged per material (env_m6 Batch): one shared batch plus one per temporal state.
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng } from './kit.js';
import { Batch } from './env_m6.js';
import { streetKit } from './props.js';
import { registerCast } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';
import { loopState } from '../systems/loops.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
const SERIF = '"Cormorant Garamond", Georgia, serif';
const HAND = '"Caveat", "Segoe Print", "Bradley Hand", cursive';

export const P = {
  gate: [62, 0, 14, -Math.PI / 2], sera: [61.2, 0, 11.4], archiveDoor: [0, 0, -8.6], plaza: [0, 0, 6],
  anja: [16.4, 0, -33.2], anjaDesk: [17.6, 0, -30], mara: [-15.4, 0, -27.4], lightTable: [-16.2, 0, -30.6], cylBench: [-18.2, 0, -21.6],
  museumCase: [-16, 0, -36.4], board: [0, 0, -41.2], lantern: [0, 0, -30], console: [0, 0, -24.6],
  rings: [[-3.6, 0, -27.8], [3.6, 0, -27.8], [0, 0, -34.6]],
  // station
  concourse: [-56, 0, 0, -Math.PI / 2], depBoard: [-63, 0, -13.4], notice: [-55.4, 0, 13.4], pip: [-84.6, 0, 5.2], tearSt: [-84.2, 0, 2.6],
  sigDoor: [-79, 3.6, -51.0], sigLog: [-82.6, 3.6, -57.2], sigWindow: [-82, 4.0, -61.0], rampSouth: [-88.5, -1.2, 36], trackNorth: [-90, -1.2, -66],
  wrenGate: [-73.6, 0, -8.4],
  // school
  schoolGate: [43, 0, 8], yardBoard: [44, 0, -32.6], okDesk: [54.4, 0, -10.0], register: [55.2, 0, -10.6], officeDoor: [73, 0, -18.8], order: [77.6, 0, -9.4],
  schoolDoor: [51, 0, -20, Math.PI / 2], fray: [63, 68.5], drawings: [79.2, 0, -28], tearSc: [43, 0, 4],
  // market
  marketDoor: [0, 0, 38, Math.PI], warden: [-20.2, 0, 42.6], epic: [8, 0, 60], girders: [[-8, 0, 50], [20, 0, 46], [16, 0, 67]],
  cylinder: [-16.4, 0, 65.4], tully: [-5.2, 0, 47.6],
};
export const SHARDS = [
  [-90, -0.6, 22, '2196', 'the station track bed'],
  [58.2, 1.75, -30.4, '2196', 'on the fallen beam in the north classroom'],
  [19.4, 0.5, 62.4, '2196', 'under the rubble of the collapsed market roof'],
  [-3.2, 1.35, -13.9, '2049', 'on the museum\'s welcome desk (2049)'],
  [-9.4, 0.95, 9.0, '2196', 'on the rim of the dry plaza fountain'],
];
export const NOTES = [
  [-3.2, 0.52, 19.6, 'a bench on the Archive Plaza', 'If you are reading this, it is not the fourteenth. It only feels like it. Find Mara at the Archive. — You'],
  [-60.6, 0.9, 13.6, 'the station waiting room', 'Tomorrow I will tell Ines I\'m sorry about the boat. (Written 14 May. Found 14 May. Again.)'],
  [-80.2, 4.5, -54.2, 'the signal box', 'Pip — your father is not coming back on the 08:14. I\'m sorry. I couldn\'t say it out loud. — T.W.'],
  [64.2, 0.8, -7.2, 'a desk at the back of Larkfield classroom one', 'Ms O: you count fifteen every morning. There were twenty-four chairs. Write it down.'],
  [-4.4, 1.0, 50.6, 'Bram Tully\'s fruit stall', 'The pears are always fresh. Nothing is always fresh. — B.'],
  [18.4, 0.97, -35.2, 'Anja\'s lab bench', 'Anja, you said one day. It has been a thousand and ninety. — M.Q.'],
];

// The nine cards of the Separation Board (the archive puzzle). col: 'cause' | 'consequence' | 'fabricated'
export const CARDS = [
  { id: 'st_cause', d: 'station', col: 'cause', title: 'Signal log, 07:56', text: '"Line unmaking at the Keld cutting. Sent the coast service early from Platform One, 212 aboard. Could not hold it." — T. Wren, signal box, 14 May 2193.' },
  { id: 'st_cons', d: 'station', col: 'consequence', title: 'Driver\'s pass, Platform One', text: 'Pip\'s father drove the early train. He told her to wait for the 08:14. Six hundred people waited on Platform Two for a train that had already gone.' },
  { id: 'st_fake', d: 'station', col: 'fabricated', title: 'Council notice', text: '"The evacuation was completed without loss. All residents departed safely on the 08:14 coast service." Dated 15 May 2193.' },
  { id: 'sc_cause', d: 'school', col: 'cause', title: 'Council order, 07:40', text: '"Storm front at Keld. Abandon Larkfield School. All children to the Archive by 10:40." Signed, the Council of Harrow, 14 May 2193.' },
  { id: 'sc_cons', d: 'school', col: 'consequence', title: 'The register', text: 'Twenty-four names. Nine marked "not arrived" in another hand: their families took them onto the early train. Ms Okafor counts fifteen every morning.' },
  { id: 'sc_fake', d: 'school', col: 'fabricated', title: 'Term poster', text: '"Larkfield closes early for summer. Reopens 15 May 2193. All pupils accounted for."' },
  { id: 'mk_cause', d: 'market', col: 'cause', title: 'Lantern feed L-1', text: 'A cable tag under the hall floor: "LANTERN FEED L-1 · FIRST IGNITION 16:40:12 · 14.05.2193". The iron aged a century in one second.' },
  { id: 'mk_cons', d: 'market', col: 'consequence', title: 'The echo under the roof', text: 'In Residue Vision: forty-one people under the roof when it came down. No record in the city names them.' },
  { id: 'mk_fake', d: 'market', col: 'fabricated', title: 'Warden\'s ledger', text: '"Saltmarket: normal trading. Roof failure from age, inspected 15 May 2193. No casualties."' },
];
export const COLS = ['cause', 'consequence', 'fabricated'];
export const COL_NAME = { cause: 'CAUSE', consequence: 'CONSEQUENCE', fabricated: 'FABRICATED' };

// ---------------------------------------------------------------------------------------------------------------------
// Cast (registerCast never overwrites an existing id). Every look carries era, sex/age and a COSTUMES.md archetype.
// ---------------------------------------------------------------------------------------------------------------------
export const RESIDENT = [
  { era: '2196', costume: 'surv_m1', sex: 0, age: 44, height: 1.77, build: 1.0, skin: 0xa77a5d, hair: 0x2a1c14, hairStyle: 'short', stubble: true, topType: 'jacket', top: 0x8a7458, topKind: 'fabric', hood: true, pantsType: 'cargo', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_f1', sex: 1, female: true, age: 31, height: 1.68, build: 0.95, skin: 0x6b4029, hair: 0x0e0a08, hairStyle: 'tied-back', topType: 'jacket', top: 0x6a5a44, topKind: 'fabric', pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_m2', sex: 0, age: 66, height: 1.69, build: 0.92, skin: 0xd8b08e, hair: 0x9a948a, hairStyle: 'short', topType: 'jacket', top: 0x6a6a64, topKind: 'fabric', hood: true, pantsType: 'trousers', pants: 0x8a7458, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 49, height: 1.65, build: 1.02, skin: 0xe0b8a0, hair: 0x6a5a4a, hairStyle: 'bun', topType: 'jacket', top: 0x6a6a64, topKind: 'fabric', hood: true, pantsType: 'cargo', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, lod: true },
];
export const KIDS = [
  { era: '2196', costume: 'lotte', sex: 1, female: true, age: 9, height: 1.3, build: 0.82, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'tied-back', topType: 'jacket', top: 0x7a6a3a, topKind: 'fabric', hood: true, pantsType: 'trousers', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, lod: true },
  { era: '2196', costume: 'kid_kai', sex: 0, age: 8, height: 1.26, build: 0.8, skin: 0xe0b394, hair: 0x5a3a22, hairStyle: 'messy', topType: 'jacket', top: 0x5a5444, topKind: 'fabric', hood: true, pantsType: 'trousers', pants: 0x3a3a30, shoes: 'boots', boots: 0x2a2018, lod: true },
];
export function registerM15Cast() {
  registerCast('anja', {
    name: 'DR. ANJA VALE', role: 'Temporal scientist · keeper of the Lantern, Harrow Reach',
    bio: 'Studies temporal memory and the human cost of erased timelines. Three years ago she locked Harrow Reach in one day to save it from a storm of loose time. She is the only one inside the lock who remembers.',
    look: { era: '2196', costume: 'anja', sex: 1, female: true, age: 46, height: 1.7, build: 0.9, skin: 0xa06a46, hair: 0x1a1410, hairStyle: 'tied-back', eyes: 0x2a1a0e,
      face: { jaw: -0.15, cheek: 0.35, nose: 0.15, noseWidth: 0.05, lips: 0.1, brow: 0.15, eyeSize: 0.1, faceLength: 0.15, chin: 0.05 },
      topType: 'jacket', top: 0xc8c4b8, topKind: 'fabric', coat: 0xc8c4b8, coatKind: 'fabric', vest: 0x4a4a38, pantsType: 'trousers', pants: 0x6a5a44, shoes: 'boots', boots: 0x2a2018, wrinkles: 0.35 },
    rimColor: 0xb6ff8a, glow: 0x16200e, bg: 0x0e100a,
    vp: { sex: 'f', pitch: 1.0, rate: 0.98, langs: ['en-IN', 'en-GB', 'en-US'] },
  });
  registerCast('mara', {
    name: 'MARA QUILL', role: 'Archivist · the Second Archive, Harrow Reach',
    bio: 'Keeps the records the official archive will not: testimonies that disagree. Beats the lock by reading her own notes every morning.',
    look: { era: '2196', costume: 'mara', sex: 1, female: true, age: 61, height: 1.62, build: 0.86, skin: 0xe0b8a0, hair: 0xb8b4ae, hairStyle: 'short', eyes: 0x4a5a6a, glasses: true,
      face: { jaw: -0.2, cheek: 0.1, nose: 0.1, noseWidth: -0.05, lips: -0.1, brow: -0.1, eyeSize: 0.05, faceLength: 0.05, chin: -0.1 },
      topType: 'jacket', top: 0x2a2a28, topKind: 'fabric', coat: 0x6a6a64, coatKind: 'fabric', hood: true, pantsType: 'trousers', pants: 0x8a7458, shoes: 'boots', boots: 0x3a2a1c, wrinkles: 0.7 },
    rimColor: 0xb6ff8a, glow: 0x14180e, bg: 0x0e0e0c,
    vp: { sex: 'f', pitch: 0.92, rate: 0.94, langs: ['en-GB', 'en-IE', 'en-US'] },
  });
  registerCast('wren', {
    name: 'TOBIAS WREN', role: 'Stationmaster · Harrow North',
    bio: 'Has sent the last train out of Harrow North every morning for three years, and every morning he has forgotten that he sent it early.',
    look: { era: '2196', costume: 'surv_m2', sex: 0, age: 58, height: 1.75, build: 1.04, skin: 0xc49a7c, hair: 0x8a8278, hairStyle: 'short', beard: 0x8a8278, eyes: 0x4a5a6a,
      face: { jaw: 0.3, cheek: 0.05, nose: 0.3, noseWidth: 0.2, lips: -0.2, brow: 0.3, eyeSize: -0.15, faceLength: 0.1, chin: 0.2 },
      topType: 'jacket', top: 0x2e3440, topKind: 'fabric', coat: 0x3a3a34, coatKind: 'fabric', pantsType: 'trousers', pants: 0x3a3a30, shoes: 'boots', boots: 0x2a2018, cap: 0x2e3440, wrinkles: 0.6 },
    rimColor: 0xffc890, vp: { sex: 'm', pitch: 0.86, rate: 0.96, langs: ['en-GB', 'en-US'] },
  });
  registerCast('okafor', {
    name: 'ADAEZE OKAFOR', role: 'Teacher · Larkfield School',
    bio: 'Leads her class to the Archive every morning at ten-thirty and counts them at the gate. She always counts fifteen.',
    look: { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 39, height: 1.69, build: 0.98, skin: 0x6b4029, hair: 0x0e0a08, hairStyle: 'bun', eyes: 0x2a1a0e,
      face: { jaw: -0.05, cheek: 0.5, nose: 0.05, noseWidth: 0.35, lips: 0.35, brow: 0, eyeSize: 0.1, faceLength: 0, chin: 0 },
      topType: 'jacket', top: 0x4a5a5a, topKind: 'fabric', coat: 0x6a6a64, coatKind: 'fabric', pantsType: 'trousers', pants: 0x5a4a38, shoes: 'boots', boots: 0x2a2018, wrinkles: 0.2 },
    rimColor: 0xffc890, vp: { sex: 'f', pitch: 1.04, rate: 1.0, langs: ['en-NG', 'en-GB', 'en-US'] },
  });
  registerCast('tully', {
    name: 'BRAM TULLY', role: 'Fruit seller · Saltmarket Hall',
    bio: 'Sells the same pears every afternoon in a hall with half a roof.',
    look: { era: '2196', costume: 'surv_m1', sex: 0, age: 51, height: 1.8, build: 1.14, skin: 0xe2b896, hair: 0x6a3f22, hairStyle: 'bald', beard: 0x6a4a32, eyes: 0x4a6a5a,
      face: { jaw: 0.4, cheek: 0.3, nose: 0.25, noseWidth: 0.35, lips: 0.1, brow: 0.1, eyeSize: -0.1, faceLength: -0.1, chin: 0.1 },
      topType: 'jacket', top: 0x5a4a38, topKind: 'fabric', vest: 0x4a4a38, pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018, wrinkles: 0.4 },
    rimColor: 0xffc890, vp: { sex: 'm', pitch: 0.82, rate: 1.04, langs: ['en-GB', 'en-AU', 'en-US'] },
  });
  registerCast('pip', {
    name: 'PIP ASHE', role: 'Platform Two · Harrow North',
    bio: 'Nine. Waits for the 08:14 every morning because her father told her to.',
    look: { era: '2196', costume: 'lotte', sex: 1, female: true, age: 9, height: 1.31, build: 0.82, skin: 0xe8c0a0, hair: 0x8a5a2a, hairStyle: 'tied-back', eyes: 0x4a6a5a, freckles: 0.45,
      topType: 'jacket', top: 0x8a6a3a, topKind: 'fabric', hood: true, pantsType: 'trousers', pants: 0x4a4a32, shoes: 'boots', boots: 0x3a2a1a },
    rimColor: 0xffc890, vp: { sex: 'f', pitch: 1.45, rate: 1.06, langs: ['en-GB', 'en-US'] },
  });
  registerCast('m15res', { name: 'RESIDENT', role: 'Harrow Reach · 14 May 2193', vp: { sex: 'm', pitch: 0.96, rate: 1.02, langs: ['en-GB', 'en-US'] } });
  registerCast('m15resf', { name: 'RESIDENT', role: 'Harrow Reach · 14 May 2193', vp: { sex: 'f', pitch: 1.08, rate: 1.02, langs: ['en-GB', 'en-AU'] } });
  registerCast('m15pa', { name: 'STATION PA', role: 'Harrow North · Tobias Wren', voice: true, vp: { sex: 'm', pitch: 0.84, rate: 0.92, langs: ['en-GB', 'en-US'] } });
  registerCast('m15band', { name: 'CHRONOLITH BAND', role: 'Kai\'s wrist · lock tuner', voice: true, vp: { sex: 'f', pitch: 1.18, rate: 1.06, langs: ['en-US', 'en-GB'] } });
  registerCast('m15ren', { name: 'REN HALLOWAY', role: 'Testimony 7 · wax-and-wire cylinder, 2150', voice: true, vp: { sex: 'm', pitch: 0.74, rate: 0.88, langs: ['en-GB', 'en-IE'] } });
  registerCast('m15teo', { name: 'TEO', role: 'Archive Plaza · asks about tomorrow', look: { ...KIDS[1], age: 10, height: 1.34, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'curly', lod: false }, vp: { sex: 'm', pitch: 1.4, rate: 1.08, langs: ['en-GB', 'en-US'] } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Music (bible: "2196 — Beautiful Catastrophe: awe, grief, resilience; wide strings, distant brass, processed wind,
// slow pulse and sparse piano, 70 BPM, no heavy drums". Loop memory: "a musical phrase that gains or loses one layer
// each repetition").
// ---------------------------------------------------------------------------------------------------------------------
export const musicState = { sorted: 0, layer: 0 };
export function registerM15Themes() {
  registerTheme('m15-city', { bpm: 70, step(a, s, t, d) {           // Harrow Reach: wide strings, slow pulse, sparse piano
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.016, 520); a.cello(ch[0] - 12, t, d * 16, 0.035); }
    if (b === 0 || b === 8) a.drum(t, 0.035, 60, 34);                  // the slow pulse, felt not heard
    if ((b === 4 && bar % 2 === 0) || (b === 10 && bar % 4 === 3)) a.piano(ch[2] + 12, t, 0.07, 3.6);
    if (b === 12 && bar % 4 === 1) a.flute(ch[3] + 12, t, d * 4, 0.012);
    if (b === 0 && bar % 8 === 6) a.glass(81, t, 0.01);                // the Lantern's bell, far away
  } });
  registerTheme('m15-tear', { bpm: 76, step(a, s, t, d) {           // a tear: the phrase gains one layer per repetition
    const bar = Math.floor(s / 16), b = s % 16, L = Math.min(4, loopState.layer + (loopState.iteration > 1 ? 1 : 0));
    const ch = [[50, 57, 60], [48, 55, 58], [46, 53, 57], [45, 52, 57]][bar % 4];
    if (b === 0) a.pad(ch, t, d * 16, 0.014, 420);
    if (b % 4 === 0) a.tick(t, 0.012, 3200);
    if ([0, 3, 6].includes(b)) a.pluck(ch[b / 3] + 12, t, 0.04);
    if (L > 0 && b === 8) a.piano(ch[2] + 12, t, 0.06, 2.6);
    if (L > 1 && b % 8 === 4) a.cello(ch[0] - 12, t, d * 4, 0.03);
    if (L > 2 && b === 12) a.flute(ch[1] + 24, t, d * 3, 0.012);
    if (L > 3 && b === 14) a.glass(ch[2] + 24, t, 0.01);
  } });
  registerTheme('m15-archive', { bpm: 84, step(a, s, t, d) {        // the Archive: dry piano cells, ticking that drifts
    const bar = Math.floor(s / 16), b = s % 16, k = musicState.sorted;
    if (b === 0) { a.pad([50, 57, 62], t, d * 16, 0.012, 380); if (bar % 2 === 0) a.cello(38, t, d * 16, 0.03); }
    if (b % 4 === (bar % 3 === 2 ? 1 : 0)) a.tick(t, 0.012, 2600);
    if (b === 2 || b === 7) a.piano([62, 65, 69, 67][(bar + b) % 4], t, 0.05, 1.8);
    if (k > 2 && b === 11) a.pluck(69 + (k % 3) * 2, t, 0.035);
    if (k > 5 && b === 14) a.glass(81, t, 0.01);
  } });
  registerTheme('m15-anja', { bpm: 64, step(a, s, t, d) {           // Anja: cello and piano, comfort with a crack in it
    const bar = Math.floor(s / 16), b = s % 16, ch = [[48, 55, 60, 63], [44, 51, 56, 60], [46, 53, 58, 62], [43, 50, 55, 59]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.014, 460); a.cello(ch[0] - 12, t, d * 16, 0.045); }
    if (b === 0 || b === 6 || b === 10) a.piano(ch[(b / 2 | 0) % 4] + 12, t, 0.08, 3.2);
    if (b === 13 && bar % 2) a.glass(ch[3] + 24, t, 0.01);
  } });
  registerTheme('m15-mara', { bpm: 72, step(a, s, t, d) {           // Mara and the Second Archive: two voices that disagree kindly
    const bar = Math.floor(s / 16), b = s % 16, ch = [[52, 59, 64], [50, 57, 62], [48, 55, 60], [47, 55, 59]][bar % 4];
    if (b === 0) a.pad(ch, t, d * 16, 0.013, 600);
    if ([0, 4, 8, 12].includes(b)) a.pluck(ch[(b >> 2) % 3] + 12, t, 0.04);
    if (b === 6 && bar % 2 === 0) a.flute(ch[2] + 12, t, d * 5, 0.014);
    if (b === 10 && bar % 2 === 1) a.flute(ch[1] + 12, t, d * 5, 0.012);
  } });
  registerTheme('m15-museum', { bpm: 58, step(a, s, t, d) {         // 2049: the Civic Museum, clean and far away
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0 && bar % 2 === 0) a.pad([57, 64, 69, 76], t, d * 32, 0.012, 1200);
    if (b === 0) a.glass([88, 86, 84, 83][bar % 4], t, 0.011);
    if (b === 8 && bar % 2) a.piano(76, t, 0.04, 4);
  } });
  registerTheme('m15-lock', { bpm: 60, step(a, s, t, d) {           // stabilized: a held chord, warm and closed
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57, 61], [45, 52, 57, 64]][bar % 2];
    if (b === 0) { a.pad(ch, t, d * 16, 0.018, 540); a.cello(33, t, d * 16, 0.04); }
    if (b === 8) a.piano(ch[3] + 12, t, 0.06, 5);
    if (b === 0 && bar % 4 === 3) a.glass(81, t, 0.012);
  } });
  registerTheme('m15-free', { bpm: 66, step(a, s, t, d) {           // freed: piano and cello, then the strings bloom
    const bar = Math.floor(s / 16), b = s % 16, ch = [[48, 55, 60, 64], [45, 52, 57, 64], [41, 48, 53, 60], [43, 50, 55, 62]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.016 + Math.min(0.012, bar * 0.002), 600 + bar * 70); a.cello(ch[0] - 12, t, d * 16, 0.05); }
    if ([0, 6, 12].includes(b)) a.piano([76, 79, 74][b / 6] - (bar % 2 ? 2 : 0), t, 0.1, 4);
    if (b === 8 && bar > 1) a.flute(ch[3] + 12, t, d * 6, 0.016);
  } });
  registerTheme('m15-wave', { bpm: 96, step(a, s, t, d) {           // 16:40 in the Saltmarket: the iron groans
    const b = s % 16;
    if (b === 0) { a.pad([38, 45, 49], t, d * 16, 0.016, 260); a.cello(26, t, d * 16, 0.05); }
    if (b % 4 === 0) a.drum(t, 0.07, 70, 30);
    if (b === 14) a.glass(74, t, 0.012);
    a.tick(t, b % 2 ? 0.006 : 0.012, 5200);
  } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Code-drawn documents, signs, cards and screens
// ---------------------------------------------------------------------------------------------------------------------
const grain = (g, w, h, n, a, seed = 3) => { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * a})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } };
const wrap = (g, text, x, y, maxW, lh) => { const words = String(text).split(' '); let line = '', yy = y; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; } if (line) g.fillText(line, x, yy); return yy; };
export const TEX = {
  sign: (t, sub, bg = '#2a2620', fg = '#e8dcc0', key = '') => canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); grain(g, w, h, 600, 0.1, t.length);
    g.strokeStyle = 'rgba(232,220,192,.35)'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.textAlign = 'center'; g.font = `700 52px ${FONT}`; g.fillText(t, w / 2, 80); if (sub) { g.font = `600 24px ${FONT}`; g.globalAlpha = 0.7; g.fillText(sub, w / 2, 126); }
  }, 'm15sign' + t + sub + key),
  carved: (t, sub) => canvasTex(1024, 160, (g, w, h) => {
    g.fillStyle = '#a89a80'; g.fillRect(0, 0, w, h); grain(g, w, h, 2400, 0.12, 5);
    g.textAlign = 'center'; g.font = `600 70px ${SERIF}`; g.fillStyle = 'rgba(40,30,20,.75)'; g.fillText(t, w / 2 + 2, 92); g.fillStyle = 'rgba(255,245,220,.25)'; g.fillText(t, w / 2 - 1, 89);
    if (sub) { g.font = `600 26px ${SERIF}`; g.fillStyle = 'rgba(40,30,20,.6)'; g.fillText(sub, w / 2, 134); }
  }, 'm15carved' + t),
  paper: (title, lines, o = {}) => canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = o.bg || '#e2d6b8'; g.fillRect(0, 0, w, h); grain(g, w, h, 900, 0.07, title.length + 3);
    const gr = g.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, 360); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(80,50,20,.35)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = o.ink || '#2a2018'; g.font = `700 26px ${FONT}`; g.fillText(title, 28, 46);
    g.fillRect(28, 58, w - 56, 2);
    g.font = o.hand ? `500 27px ${HAND}` : `500 21px ${FONT}`; let y = 92;
    for (const l of lines) { if (Array.isArray(l)) { g.fillStyle = l[1]; y = wrap(g, l[0], 28, y, w - 56, o.hand ? 30 : 26) + (o.hand ? 34 : 30); g.fillStyle = o.ink || '#2a2018'; } else y = wrap(g, l, 28, y, w - 56, o.hand ? 30 : 26) + (o.hand ? 34 : 30); }
    if (o.stamp) { g.save(); g.translate(w - 120, h - 70); g.rotate(-0.2); g.strokeStyle = o.stampCol || 'rgba(150,30,20,.75)'; g.lineWidth = 4; g.strokeRect(-90, -26, 180, 52); g.fillStyle = o.stampCol || 'rgba(150,30,20,.75)'; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.fillText(o.stamp, 0, 8); g.restore(); }
  }, 'm15paper' + title + lines.length + (o.key || '')),
  depBoard: () => canvasTex(1024, 320, (g, w, h) => {
    g.fillStyle = '#0c0d0a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffc890'; g.font = `700 34px ${FONT}`; g.fillText('HARROW NORTH · DEPARTURES', 30, 52);
    g.fillStyle = 'rgba(255,200,144,.25)'; g.fillRect(30, 66, w - 60, 2);
    const rows = [['08:14', 'COAST SERVICE · ALL STOPS', '2', 'ON TIME'], ['—', 'NO FURTHER SERVICES TODAY', '', ''], ['', 'TODAY: THURSDAY 14 MAY 2193', '', '']];
    g.font = `700 40px ${FONT}`;
    rows.forEach((r, i) => { const y = 124 + i * 66; g.fillStyle = '#ffd9a8'; g.fillText(r[0], 30, y); g.fillText(r[1], 190, y); g.fillText(r[2], 820, y); g.fillStyle = '#b6ff8a'; g.fillText(r[3], 870, y); });
  }, 'm15dep'),
  card: (c) => canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#d8ccb0'; g.fillRect(0, 0, w, h); grain(g, w, h, 300, 0.08, c.id.length * 7);
    g.fillStyle = { station: '#5a6a7a', school: '#6a7a4a', market: '#8a5a3a' }[c.d]; g.fillRect(0, 0, w, 30);
    g.fillStyle = '#f4ecd8'; g.font = `700 15px ${FONT}`; g.fillText({ station: 'HARROW NORTH', school: 'LARKFIELD', market: 'SALTMARKET' }[c.d], 10, 21);
    g.fillStyle = '#2a2018'; g.font = `700 19px ${FONT}`; wrap(g, c.title, 10, 56, w - 20, 22);
    g.font = `500 13px ${FONT}`; wrap(g, c.text, 10, 92, w - 20, 16);
  }, 'm15card' + c.id),
  boardHead: () => canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#2a2620'; g.fillRect(0, 0, w, h); grain(g, w, h, 800, 0.1, 11);
    g.textAlign = 'center'; g.font = `700 34px ${FONT}`;
    [['CAUSE', '#ffc890'], ['CONSEQUENCE', '#b6d8ff'], ['FABRICATED', '#ff8f6a']].forEach(([t, c], i) => { g.fillStyle = c; g.fillText(t, (i + 0.5) * w / 3, 78); });
    g.fillStyle = 'rgba(232,220,192,.3)'; g.fillRect(w / 3 - 1, 14, 2, 100); g.fillRect(2 * w / 3 - 1, 14, 2, 100);
  }, 'm15boardhead'),
  records: (kind) => canvasTex(512, 384, (g, w, h) => {
    const A = kind === 'A';
    g.fillStyle = A ? '#e8e2d2' : '#cbbf9e'; g.fillRect(0, 0, w, h); grain(g, w, h, 1100, A ? 0.04 : 0.1, A ? 21 : 22);
    g.fillStyle = '#2a2018'; g.font = `700 22px ${FONT}`; g.fillText(A ? 'THE LOCK ARCHIVE · REGISTER OF FIRST CAUSES' : 'THE SECOND ARCHIVE · TESTIMONY LEDGER', 24, 40);
    g.fillRect(24, 52, w - 48, 2);
    g.font = A ? `500 22px ${FONT}` : `500 26px ${HAND}`;
    const L = A ? ['Entry 1. The Fracture.', 'First operator of the Chronolith:', '', 'K. VAREN', '', 'Helix Temporal Research, Rain City', '19.10.2049 · 08:14:00']
      : ['Testimony 7, from Ren Halloway\'s cylinder:', '"The first hand on the ring was a Varen girl."', '', 'M. VAREN', '', 'Helix hall, Rain City', '19.10.2026 · 08:14:00'];
    L.forEach((l, i) => { g.font = (i === 3 ? `700 44px ` : A ? `500 22px ` : `500 26px `) + (A || i === 3 ? FONT : HAND); g.fillText(l, 24, 96 + i * 38); });
    if (A) { g.save(); g.translate(w - 110, h - 60); g.rotate(-0.15); g.strokeStyle = 'rgba(40,90,40,.7)'; g.lineWidth = 3; g.strokeRect(-80, -22, 160, 44); g.fillStyle = 'rgba(40,90,40,.7)'; g.font = `700 18px ${FONT}`; g.textAlign = 'center'; g.fillText('OFFICIAL', 0, 7); g.restore(); }
  }, 'm15rec' + kind),
  museum: (kind) => canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d2a44'; g.fillRect(0, 0, 10, h);
    g.fillStyle = '#1b1e23'; g.font = `700 26px ${FONT}`;
    if (kind === 'title') { g.font = `700 44px ${FONT}`; g.fillText('HELIX', 34, 110); g.font = `600 30px ${FONT}`; g.fillText('Twenty-three years of time', 34, 160); g.font = `500 20px ${FONT}`; g.fillStyle = '#5a6066'; g.fillText('Gallery 3 · Rain City Civic Museum · 2049', 34, 220); return; }
    if (kind === 'founding') {
      g.fillText('THE FOUNDING TEST', 34, 54); g.font = `500 20px ${FONT}`; g.fillStyle = '#3a4048';
      wrap(g, '19 October 2026, 08:14. The first resonance test in the old Helix hall was aborted after nine seconds. Recovered from the hall floor afterwards: a visitor\'s badge.', 34, 96, w - 64, 26);
      g.fillStyle = '#1b1e23'; g.font = `700 30px ${FONT}`; g.fillText('M. VAREN · VISITOR', 34, 262);
    } else {
      g.fillText('THE FIRST OPERATIONAL TEST', 34, 54); g.font = `500 20px ${FONT}`; g.fillStyle = '#3a4048';
      wrap(g, 'Scheduled for 19 October 2049, 08:14, in Test Hall C. The Chronolith\'s first full binding, under the direction of Dr. Elias Rook.', 34, 96, w - 64, 26);
      g.fillStyle = '#1b1e23'; g.font = `700 30px ${FONT}`; g.fillText('OPERATOR: K. VAREN', 34, 262);
    }
  }, 'm15mus' + kind),
  ticket: () => canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#e8d8b0'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2018'; g.font = `700 18px ${FONT}`; g.fillText('HARROW NORTH · CREW', 12, 26); g.font = `600 16px ${FONT}`; g.fillText('DRIVER R. ASHE', 12, 56); g.fillText('COAST SVC · DEP 07:56 · P1', 12, 84); g.fillStyle = '#8a2a1a'; g.fillText('14.05.2193', 12, 112); }, 'm15ticket'),
  drawing: () => canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#f0ead8'; g.fillRect(0, 0, w, h);
    g.lineWidth = 6; g.lineCap = 'round';
    g.strokeStyle = '#2a4a8a'; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(40 + k * 80, 60); g.lineTo(80 + k * 80, 120); g.stroke(); }   // the sky breaking
    g.strokeStyle = '#2a2018'; g.beginPath(); g.arc(256, 190, 26, 0, 7); g.moveTo(256, 216); g.lineTo(256, 300); g.moveTo(256, 240); g.lineTo(206, 270); g.moveTo(256, 240); g.lineTo(306, 260); g.moveTo(256, 300); g.lineTo(226, 350); g.moveTo(256, 300); g.lineTo(286, 350); g.stroke();
    g.strokeStyle = '#22c8e0'; g.lineWidth = 10; g.beginPath(); g.arc(306, 260, 12, 0, 7); g.stroke();
    g.fillStyle = '#8a2a1a'; g.font = `700 34px ${HAND}`; g.fillText('HE MADE THE SKY BREAK', 70, 40);
    g.fillStyle = '#2a2018'; g.font = `500 22px ${HAND}`; g.fillText('by Nia, age 8', 330, 370);
  }, 'm15draw'),
  clockFace: (txt, sub) => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e8e0cc'; g.beginPath(); g.arc(128, 128, 122, 0, 7); g.fill(); g.strokeStyle = '#2a2018'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#2a2018'; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.fillRect(128 + Math.sin(a) * 100 - 3, 128 - Math.cos(a) * 100 - 8, 6, 16); }
    g.textAlign = 'center'; g.font = `700 30px ${FONT}`; g.fillText(txt, 128, 100); if (sub) { g.font = `600 20px ${FONT}`; g.fillText(sub, 128, 186); }
  }, 'm15clock' + txt + sub),
  shimmer: () => canvasTex(256, 256, (g, w, h) => {
    const r = rng(15); g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 160; k++) { const x = r() * w, y = r() * h, l = 30 + r() * 140; const gr = g.createLinearGradient(x, y, x, y + l); gr.addColorStop(0, 'rgba(255,220,160,0)'); gr.addColorStop(0.5, `rgba(255,220,160,${0.2 + r() * 0.5})`); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(x, y, 1 + r() * 3, l); }
  }, 'm15shimmer', { repeat: [8, 1] }),
  ring: () => canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 126); gr.addColorStop(0, 'rgba(255,200,140,0)'); gr.addColorStop(0.75, 'rgba(255,200,140,.15)'); gr.addColorStop(0.93, 'rgba(255,230,190,.9)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, 'm15ring'),
  screen: (lines, col = '#b6ff8a') => canvasTex(256, 160, (g, w, h) => { g.fillStyle = '#081008'; g.fillRect(0, 0, w, h); g.fillStyle = col; g.font = `600 18px ${FONT}`; lines.forEach((l, i) => g.fillText(l, 12, 30 + i * 24)); }, 'm15scr' + lines.join('|') + col),
  poster: () => canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#e8c86a'; g.fillRect(0, 0, w, h); grain(g, w, h, 1000, 0.1, 31);
    g.fillStyle = '#2a2018'; g.textAlign = 'center'; g.font = `700 44px ${FONT}`; g.fillText('LARKFIELD SCHOOL', w / 2, 70);
    g.font = `700 34px ${FONT}`; g.fillText('CLOSES EARLY FOR SUMMER', w / 2, 140);
    g.font = `600 28px ${FONT}`; g.fillText('Reopens 15 May 2193', w / 2, 200); g.fillText('All pupils accounted for', w / 2, 246);
    g.font = `500 20px ${FONT}`; g.fillText('— the Council of Harrow', w / 2, 320);
  }, 'm15poster'),
  note: (i) => canvasTex(256, 192, (g, w, h) => { g.fillStyle = '#efe6cc'; g.fillRect(0, 0, w, h); grain(g, w, h, 200, 0.06, 40 + i); g.strokeStyle = 'rgba(80,110,160,.3)'; for (let y = 40; y < h; y += 26) { g.beginPath(); g.moveTo(10, y); g.lineTo(w - 10, y); g.stroke(); } g.fillStyle = '#2a2a4a'; g.font = `600 22px ${HAND}`; wrap(g, NOTES[i][4], 14, 34, w - 28, 26); }, 'm15note' + i),
};

// ---------------------------------------------------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------------------------------------------------
export function buildHarrow(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low';
  const W = { lightSrc: [], cards: [], girderLines: [], clocks: [], lanternRings: [], doors: {}, ghosts: [], frayMats: [] };
  const col = game.collision, R = rng(1515);
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  const M = {
    asphalt: pm('wetAsphalt', { color: 0x3c3934, puddles: 0.04, cracks: 0.9, wear: 0.9, wet: 0.15 }),
    paving: pm('concrete', { color: 0x76705f, slabs: 1, stains: 0.8, formwork: 0, cracks: 0.8 }),
    plaza: pm('cutStone', { color: 0x9a8e78, weathering: 0.85 }),
    stone: pm('cutStone', { color: 0xa89a80, weathering: 0.7, rows: 4 }),
    concrete: pm('concrete', { color: 0x7a746a, formwork: 1, stains: 0.9 }),
    brick: pm('brick', { color: 0x7a3e28, soot: 0.6 }),
    brickDark: pm('brick', { color: 0x5a3426, soot: 0.8 }),
    plaster: pm('plaster', { color: 0xb0a48c, damage: 0.22, dirt: 0.55 }),
    plasterIn: pm('plaster', { color: 0xb8ae96, damage: 0.12, dirt: 0.35 }),
    tile: pm('ceramicTile', { color: 0x6e675c, grout: 0x3e3a34, count: 4, gloss: 0.25, variation: 0.45 }),
    tileW: pm('ceramicTile', { color: 0xd8d6cc, grout: 0x8a887e, count: 6, gloss: 0.7, variation: 0.15 }),
    wood: pm('wood', { color: 0x6a4a30, planks: 10, weathered: 0.6 }),
    floor: pm('wood', { color: 0x7a5a38, planks: 14, weathered: 0.3 }),
    steel: pm('brushedMetal', { color: 0x6a6e72, roughness: 0.5 }),
    rust: pm('rust', { color: 0x5a2a12, paint: 0x2e3a3e, amount: 0.75 }),
    rustHeavy: pm('rust', { color: 0x6a3418, paint: 0x4a3a2a, amount: 1.0 }),
    gravel: pm('gravel', { color: 0x6a645a }),
    dirt: pm('dirt', { color: 0x5a4a38 }),
    copper: pm('brushedMetal', { color: 0x5e8a78, roughness: 0.55 }),
  };
  const dark = new THREE.MeshStandardMaterial({ color: 0x14120f, roughness: 0.95 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fb0a8, roughness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const cloth = [0x7a3e22, 0x4a5a5a, 0x8a7458, 0x5a4a6a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, side: THREE.DoubleSide }));
  const amber = glowMat(0xffc890, 2.2), green = glowMat(0xb6ff8a, 1.6);
  W.mats = { amber, green, dark };
  const S = { common: new Batch(), '2049': new Batch(), '2196': new Batch() };
  const g49 = new THREE.Group(), g96 = new THREE.Group(); scene.add(g49, g96); T.only(g49, '2049'); T.only(g96, '2196');
  const G = { '2049': g49, '2196': g96 }; W.groups = G;
  const box = (x0, y0, z0, x1, y1, z1, states) => col.add([Math.min(x0, x1), y0, Math.min(z0, z1)], [Math.max(x0, x1), y1, Math.max(z0, z1)], states ? { states } : {});
  const src = (x, y, z, c, i, d, era = 'all') => W.lightSrc.push({ p: [x, y, z], c, i, d, era });
  const plane = (tex, w, h, x, y, z, ry, parent = scene, emiss = 0.2, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emiss, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); parent.add(m); return m;
  };
  // a wall along x (at z) or along z (at x) with openings [a, b, top]; collision follows the openings
  const wallX = (B, mat, z, x0, x1, y0, y1, t, gaps = [], states) => {
    let x = x0; const gs = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [a, b, top] of gs) { if (a > x) { B.box(mat, x, y0, z - t / 2, a, y1, z + t / 2); box(x, y0, z - t / 2, a, y1, z + t / 2, states); } if (top < y1) { B.box(mat, a, top, z - t / 2, b, y1, z + t / 2); box(a, top, z - t / 2, b, y1, z + t / 2, states); } x = b; }
    if (x < x1) { B.box(mat, x, y0, z - t / 2, x1, y1, z + t / 2); box(x, y0, z - t / 2, x1, y1, z + t / 2, states); }
  };
  const wallZ = (B, mat, x, z0, z1, y0, y1, t, gaps = [], states) => {
    let z = z0; const gs = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [a, b, top] of gs) { if (a > z) { B.box(mat, x - t / 2, y0, z, x + t / 2, y1, a); box(x - t / 2, y0, z, x + t / 2, y1, a, states); } if (top < y1) { B.box(mat, x - t / 2, top, a, x + t / 2, y1, b); box(x - t / 2, top, a, x + t / 2, y1, b, states); } z = b; }
    if (z < z1) { B.box(mat, x - t / 2, y0, z, x + t / 2, y1, z1); box(x - t / 2, y0, z, x + t / 2, y1, z1, states); }
  };
  const C = S.common;

  // ================= ground =================
  const GROUND = box(-140, -1, -110, 120, 0, 110);
  C.box(M.asphalt, -140, -0.3, -110, 120, 0, 110);
  const pave = (mat, x0, z0, x1, z1, y = 0.02) => C.box(mat, x0, -0.1, z0, x1, y, z1);
  pave(M.plaza, -24, -10, 24, 24);                                   // the Archive Plaza
  pave(M.paving, -50, -8, -24, 8); pave(M.paving, 24, 8, 66, 20);    // west street pavement edges / arrival road verges
  pave(M.gravel, 36, -36, 52, 8, 0.03);                              // the school yard
  pave(M.paving, -11, 24, 11, 40);                                   // the avenue to the market
  // the boundary of the lock (collision ring) and the haze wall
  box(-140, 0, -110, 120, 30, -96); box(-140, 0, 96, 120, 30, 110); box(-140, 0, -110, -126, 30, 110); box(106, 0, -110, 120, 30, 110);
  box(69, 0, -110, 70, 12, 8); box(69, 0, 20, 70, 12, 110);              // the east edge of the lock (the gate is the only way through)

  // ================= the Hollow Archive (2049: the Rain City Civic Museum) =================
  {
    const H = 12;
    // outer walls (door in the south face x -2.6..2.6)
    wallX(C, M.stone, -10, -20, 20, 0, H, 0.8, [[-2.6, 2.6, 5.2]]);
    wallX(C, M.stone, -46, -20, 20, 0, H, 0.8);
    wallZ(C, M.stone, -20, -46, -10, 0, H, 0.8); wallZ(C, M.stone, 20, -46, -10, 0, H, 0.8);
    // inner walls to the wings, doors at z -20.5..-17
    wallZ(C, M.plasterIn, -12, -45.6, -10.4, 0, 9, 0.4, [[-20.5, -17, 3.4]]);
    wallZ(C, M.plasterIn, 12, -45.6, -10.4, 0, 9, 0.4, [[-20.5, -17, 3.4]]);
    // floors
    C.box(M.tile, -19.6, 0, -45.6, 19.6, 0.04, -10.4);
    // ceilings: wings at 9, the hall roof at 12 with the oculus under the dome
    C.box(M.plasterIn, -19.6, 9, -45.6, -12, 9.4, -10.4); C.box(M.plasterIn, 12, 9, -45.6, 19.6, 9.4, -10.4);
    for (const [x0, z0, x1, z1] of [[-12, -45.6, 12, -37], [-12, -23, 12, -10.4], [-12, -37, -7, -23], [7, -37, 12, -23]]) C.box(M.concrete, x0, H - 0.6, z0, x1, H, z1);
    C.box(M.stone, -21, H, -47, 21, H + 0.8, -9.2);                  // cornice / roof slab
    // the dome (copper, patinated) over the oculus
    const dome = new THREE.Mesh(new THREE.SphereGeometry(8.2, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), M.copper); dome.position.set(0, H + 0.6, -30); dome.material.side = THREE.DoubleSide; dome.castShadow = true; scene.add(dome); game.blocker(dome);
    C.cyl(M.stone, 0, H + 1.2, -30, 8.6, 1.2, 40);
    C.cyl(M.copper, 0, H + 9.2, -30, 0.6, 1.6, 12);                    // lantern-house on the dome
    // portico: six columns, steps, pediment
    for (let k = 0; k < 6; k++) { const x = -10 + k * 4; if (Math.abs(x) < 3) continue; C.cyl(M.stone, x, 4.5, -7.6, 0.55, 9, 16); box(x - 0.55, 0, -8.15, x + 0.55, 9, -7.05); }
    C.cyl(M.stone, -2.9, 4.5, -7.6, 0.5, 9, 16); C.cyl(M.stone, 2.9, 4.5, -7.6, 0.5, 9, 16); box(-3.4, 0, -8.1, -2.4, 9, -7.1); box(2.4, 0, -8.1, 3.4, 9, -7.1);
    C.box(M.stone, -12, 9, -9, 12, 10.2, -6.6);
    C.geo(M.stone, new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-12.4, 0), new THREE.Vector2(12.4, 0), new THREE.Vector2(0, 2.6)]), { depth: 1.6, bevelEnabled: false }), [0, 10.2, -9.0]);
    C.box(M.stone, -12, 0, -7.2, 12, 0.2, -5.6); box(-12, 0, -7.2, 12, 0.2, -5.6);
    const sign = plane(TEX.carved('THE HOLLOW ARCHIVE', 'CIVIC MUSEUM · MMXXXI'), 10, 1.55, 0, 7.6, -9.55, 0, g96, 0.05);
    sign.material.emissiveIntensity = 0.04;
    plane(TEX.carved('RAIN CITY CIVIC MUSEUM', 'MMXXXI'), 10, 1.55, 0, 7.6, -9.55, 0, g49, 0.05);
    // 2049: the doors are shut ("closed for installation"): the museum is a thin spot, not a way out
    S['2049'].box(M.wood, -2.6, 0, -10.2, 2.6, 5.2, -9.8); box(-2.6, 0, -10.4, 2.6, 5.2, -9.6, ['2049']);
    plane(TEX.sign('CLOSED FOR INSTALLATION', 'GALLERY 3 OPENS 01.11.2049', '#1d2a44', '#f2f2ee'), 3.2, 1.0, 0, 2.2, -10.8, Math.PI, g49, 0.3);
    // archive stacks along the hall (2196) / museum plinths (2049)
    for (const sx of [-1, 1]) {
      for (let z = -44; z < -12; z += 4.2) {
        if (z > -22 && z < -16) continue;
        const x = sx * 10.6;
        S['2196'].box(M.wood, x - 0.6, 0, z, x + 0.6, 4.2, z + 3.2); box(x - 0.6, 0, z, x + 0.6, 4.2, z + 3.2, ['2196']);
        for (let y = 0.5; y < 4; y += 0.85) S['2196'].box(cloth[((y * 7 + z) | 0) & 3], x - 0.64, y, z + 0.12, x + 0.64, y + 0.55, z + 3.08);
      }
    }
    // 2196: the scrap-wood mezzanine gallery along the north end
    S['2196'].box(M.wood, -12, 4.2, -45.6, 12, 4.5, -43); for (const x of [-11, -4, 4, 11]) S['2196'].box(M.steel, x - 0.1, 0, -43.2, x + 0.1, 4.2, -43);
    // the Separation Board on the north wall, the sorting table in front of it
    S['2196'].box(M.wood, -9, 0.9, -45.5, 9, 6.2, -45.2);
    const head = plane(TEX.boardHead(), 15, 1.6, 0, 5.4, -45.12, 0, g96, 0.25); head.material.emissiveIntensity = 0.3;
    S['2196'].box(M.wood, -6.5, 0, -41.4, 6.5, 0.92, -40.2); box(-6.5, 0, -41.4, 6.5, 0.92, -40.2, ['2196']);
    W.boardCols = { cause: -5, consequence: 0, fabricated: 5 };
    // the cards: lying on the table until sorted
    const cardGeo = new THREE.PlaneGeometry(1.15, 0.86);
    W.cardMeshes = {};
    CARDS.forEach((c, i) => {
      const tex = TEX.card(c);
      const m = new THREE.Mesh(cardGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12, side: THREE.DoubleSide }));
      m.position.set(-5.6 + i * 1.4, 0.95, -40.8); m.rotation.set(-Math.PI / 2 + 0.35, 0, 0); m.visible = false; g96.add(m);
      W.cardMeshes[c.id] = m;
    });
    // the Lantern: plinth, brass cage, a core of held light, three phase rings
    const lan = new THREE.Group(); lan.position.set(0, 0, -30); g96.add(lan); W.lantern = lan;
    const brass = new THREE.MeshStandardMaterial({ color: 0xb08a4a, metalness: 0.9, roughness: 0.35 });
    S['2196'].cyl(M.stone, 0, 0.5, -30, 2.6, 1.0, 32); box(-2.4, 0, -32.4, 2.4, 1.0, -27.6, ['2196']);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; S['2196'].geo(brass, new THREE.CylinderGeometry(0.08, 0.08, 8.6, 8), [Math.sin(a) * 1.6, 5.2, -30 + Math.cos(a) * 1.6]); }
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffd6a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 7.4, 20, 1, true), coreMat); core.position.y = 5; lan.add(core); W.core = core;
    const coreHalo = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 7.6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); coreHalo.position.y = 5; lan.add(coreHalo); W.coreHalo = coreHalo;
    [2.2, 4.4, 6.6].forEach((y, i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(2.0 + i * 0.25, 0.09, 8, 48), brass); r.position.y = y; r.rotation.x = Math.PI / 2 + (i - 1) * 0.35; lan.add(r); W.lanternRings.push(r); });
    // the three ring levers (the finale) and the console
    W.ringScreens = [];
    P.rings.forEach(([x, , z], i) => {
      S['2196'].box(M.steel, x - 0.3, 0, z - 0.3, x + 0.3, 1.1, z + 0.3); box(x - 0.3, 0, z - 0.3, x + 0.3, 1.1, z + 0.3, ['2196']);
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.24), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false })); scr.position.set(x, 1.22, z); scr.rotation.order = 'YXZ'; scr.rotation.y = Math.atan2(x, z + 30); scr.rotation.x = -0.6; g96.add(scr);
      W.ringScreens.push({ cv, tx, scr });
    });
    S['2196'].box(M.steel, -1.2, 0, -24.9, 1.2, 1.0, -24.3); box(-1.2, 0, -24.9, 1.2, 1.0, -24.3, ['2196']);
    W.consoleScreen = plane(TEX.screen(['LANTERN · LOCK 14.05.2193', 'DAY 1,090', 'PHASE DRIFT: 3 TEARS', 'HOLD: 96 %'], '#ffc890'), 1.6, 0.9, 0, 1.45, -24.22, 0, g96, 0.9); W.consoleScreen.rotation.x = -0.35;
    src(0, 3, -30, 0xffc890, 14, 22, '2196'); src(0, 7, -30, 0xffd6a0, 8, 18, '2196');
    // the beam above the dome (seen across the city)
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 90, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc890, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
    beam.position.set(0, H + 10 + 45, -30); g96.add(beam); W.beam = beam;
    // ---- west wing (2196): Mara's Second Archive ----
    S['2196'].box(M.wood, -17.4, 0, -32, -15, 0.95, -29.2); box(-17.4, 0, -32, -15, 0.95, -29.2, ['2196']);     // the light table
    W.recA = plane(TEX.records('A'), 1.0, 0.75, -16.8, 0.98, -30.6, 0, g96, 0.35, -Math.PI / 2);
    W.recB = plane(TEX.records('B'), 1.0, 0.75, -15.6, 0.98, -30.6, 0, g96, 0.35, -Math.PI / 2);
    const lt = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.6), new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.25, toneMapped: false })); lt.rotation.x = -Math.PI / 2; lt.position.set(-16.2, 0.96, -30.6); g96.add(lt);
    for (const z of [-44.8, -39, -33.4]) { S['2196'].box(M.wood, -19.4, 0, z, -18.4, 3.6, z + 4.6); box(-19.4, 0, z, -18.4, 3.6, z + 4.6, ['2196']); for (let y = 0.4; y < 3.4; y += 0.7) S['2196'].box(cloth[(y * 3 | 0) % 4], -19.3, y, z + 0.1, -18.5, y + 0.45, z + 4.5); }
    S['2196'].box(M.wood, -19.4, 0, -23, -17.2, 0.9, -20.4); box(-19.4, 0, -23, -17.2, 0.9, -20.4, ['2196']);     // the cylinder bench
    S['2196'].cyl(brass, -18.4, 1.25, -21.7, 0.22, 0.7, 16, [0, 0, Math.PI / 2]); S['2196'].geo(brass, new THREE.ConeGeometry(0.4, 0.8, 16, 1, true), [-17.8, 1.4, -21.2], [0.4, 0, -1.0]);
    src(-16.2, 2.6, -30.6, 0xfff0d0, 5, 9, '2196'); src(-18, 2.4, -21.6, 0xffc890, 3, 6, '2196'); src(-15.6, 5.2, -19.4, 0xffd8b0, 4, 13, '2196'); src(-15.6, 5.2, -40, 0xffd8b0, 3, 12, '2196');
    // ---- east wing (2196): Anja's lab ----
    S['2196'].box(M.steel, 17.4, 0, -36, 19.4, 0.95, -26); box(17.4, 0, -36, 19.4, 0.95, -26, ['2196']);
    S['2196'].box(M.steel, 13, 0, -45, 19, 0.95, -43); box(13, 0, -45, 19, 0.95, -43, ['2196']);
    for (let k = 0; k < 4; k++) plane(TEX.screen([['LOCK FIELD', 'STATION TEAR', 'SCHOOL TEAR', 'MARKET TEAR'][k], ['HOLD 96 %', '90 s REPEAT', '80 s REPEAT', '90 s REPEAT'][k], 'DRIFT +0.4 %/DAY']), 0.9, 0.56, 19.3, 1.6 + (k % 2) * 0.7, -34.5 + (k >> 1) * 2.6 + (k % 2) * 0.9, -Math.PI / 2, g96, 0.9);
    for (let k = 0; k < 7; k++) S['2196'].cyl(green, 17.8 + (k % 2) * 0.6, 1.1, -33 + k * 0.9, 0.05, 0.3, 8);
    S['2196'].box(M.wood, 13, 0, -14, 19, 2.4, -11); box(13, 0, -14, 19, 2.4, -11, ['2196']);     // crates of instruments
    src(17.6, 2.4, -31, 0xb6ff8a, 4, 9, '2196'); src(15, 6, -20, 0xffe0c0, 3, 12, 'all');
    // ---- 2049: the museum ----
    S['2049'].box(M.tileW, -19.6, 0.04, -45.6, 19.6, 0.06, -10.4);
    for (const [x, z] of [[-6, -16], [6, -16], [-6, -38], [6, -38], [-8, -30], [8, -30]]) { S['2049'].box(M.plasterIn, x - 0.7, 0, z - 0.7, x + 0.7, 1.1, z + 0.7); S['2049'].box(glass, x - 0.6, 1.1, z - 0.6, x + 0.6, 1.9, z + 0.6); box(x - 0.7, 0, z - 0.7, x + 0.7, 1.9, z + 0.7, ['2049']); }
    S['2049'].box(M.wood, -4.6, 0, -14.6, -1.8, 1.1, -13.2); box(-4.6, 0, -14.6, -1.8, 1.1, -13.2, ['2049']);     // welcome desk
    S['2049'].cyl(M.steel, 0, 0.6, -30, 3.4, 1.2, 32); box(-3, 0, -33, 3, 1.2, -27, ['2049']);     // the museum's centrepiece: a model of the city
    plane(TEX.sign('RAIN CITY · 1890-2049', 'THE CITY IN MINIATURE', '#1d2a44', '#f2f2ee'), 2.6, 0.8, 0, 1.5, -26.5, 0, g49, 0.35);
    // Gallery 3 (west wing): HELIX · TWENTY-THREE YEARS
    plane(TEX.museum('title'), 3.2, 2.0, -19.1, 2.6, -28, Math.PI / 2, g49, 0.3);
    S['2049'].box(M.plasterIn, -17.2, 0, -37.2, -14.8, 1.0, -35.6); S['2049'].box(glass, -17.1, 1.0, -37.1, -14.9, 1.8, -35.7); box(-17.2, 0, -37.2, -14.8, 1.8, -35.6, ['2049']);
    W.badge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.2), new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.5 })); W.badge.position.set(-16, 1.05, -36.4); g49.add(W.badge);
    plane(TEX.museum('founding'), 1.6, 1.0, -16.6, 2.3, -45.1, 0, g49, 0.3);
    plane(TEX.museum('operational'), 1.6, 1.0, -14.6, 2.3, -45.1, 0, g49, 0.3);
    S['2049'].box(M.plasterIn, -19.4, 0, -45.6, -12.2, 9, -45.3);
    // 2049 linings: clean painted walls over the old stone, ceiling light strips, banners, a bench, a photo wall
    const paint49 = pm('plaster', { color: 0xdedcd4, under: 0xcac6bc, damage: 0, dirt: 0.04 }), dark49 = new THREE.MeshStandardMaterial({ color: 0x1d2a44, roughness: 0.6 }), strip49 = glowMat(0xf4f6ff, 1.6);
    S['2049'].box(paint49, -19.6, 0, -45.55, -19.25, 9, -10.45); S['2049'].box(paint49, 19.25, 0, -45.55, 19.6, 9, -10.45);
    S['2049'].box(paint49, -19.6, 0, -45.6, 19.6, 9, -45.25); S['2049'].box(paint49, -19.6, 0, -10.75, 19.6, 9, -10.4);
    for (const x of [-12.45, 11.95]) { S['2049'].box(paint49, x, 0, -45.6, x + 0.5, 9, -20.5); S['2049'].box(paint49, x, 0, -17, x + 0.5, 9, -10.4); S['2049'].box(paint49, x, 3.4, -20.5, x + 0.5, 9, -17); }
    S['2049'].box(dark49, -19.6, 0, -45.55, 19.6, 0.25, -45.2);
    for (const [x0, x1] of [[-18.6, -13], [-10, 10], [13, 18.6]]) for (let z = -43; z < -12; z += 6) S['2049'].box(strip49, x0, 8.9, z, x1, 8.98, z + 0.25);
    for (const [x, z, ry, t, sub] of [[-11.9, -30, Math.PI / 2, 'RAIN CITY CIVIC MUSEUM', 'THE CITY IN TIME'], [11.9, -30, -Math.PI / 2, 'GALLERY 4 · CLOSED', 'INSTALLATION IN PROGRESS']]) plane(TEX.sign(t, sub, '#1d2a44', '#f2f2ee', 'b' + x), 4.2, 1.3, x, 6.4, z, ry, g49, 0.35);
    S['2049'].box(M.wood, -15.4, 0.42, -24.6, -13.2, 0.5, -23.8); S['2049'].box(M.steel, -15.2, 0, -24.5, -13.4, 0.42, -23.9); box(-15.4, 0, -24.6, -13.2, 0.5, -23.8, ['2049']);
    for (let k = 0; k < 4; k++) plane(TEX.paper('HELIX · ' + ['2026', '2031', '2040', '2049'][k], [['The founding team', 'The first ring', 'Test Hall C', 'Binding day'][k], ['Old Helix hall, Rain City.', 'Cast from a template nobody could date.', 'Director: Dr. E. Rook.', 'Operator: K. Varen (scheduled).'][k]], { bg: '#f2f2ee', ink: '#1b1e23', key: 'ph' + k }), 1.3, 0.98, -19.2, 2.3, -40.2 + k * 3.2 + (k > 1 ? 2.4 : 0), Math.PI / 2, g49, 0.25);
    src(-16, 3, -36, 0xffffff, 5, 10, '2049'); src(0, 6, -30, 0xf0f4ff, 6, 22, '2049'); src(0, 6, -16, 0xf0f4ff, 4, 16, '2049');
    src(0, 4, -12, 0xffd8b0, 4, 12, '2196');
  }

  // ================= the plaza =================
  {
    // dry fountain (shard) and the public clock (stopped in the lock)
    C.cyl(M.stone, -12, 0.35, 9, 3.4, 0.7, 28); C.cyl(M.stone, -12, 0.6, 9, 2.9, 0.12, 28); C.cyl(M.stone, -12, 1.4, 9, 0.4, 2.0, 10);
    box(-15, 0, 6, -9, 0.7, 12);
    C.cyl(M.rust, 10, 2.5, 6, 0.22, 5, 10); C.box(M.rust, 9.2, 4.6, 5.2, 10.8, 6.2, 6.8);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; const f = plane(TEX.clockFace('14 MAY', '2193 · 10:41'), 1.3, 1.3, 10 + Math.sin(a) * 0.81, 5.4, 6 + Math.cos(a) * 0.81, a, g96, 0.25); W.clocks.push(f); }
    box(9.7, 0, 5.7, 10.3, 5, 6.3);
    // benches and a few scrap planters
    for (const [x, z, r] of [[-3.2, 19.6, 0], [3.2, 19.6, 0], [-18, -2, Math.PI / 2], [18, 14, -Math.PI / 2]]) { C.boxc(M.wood, x, 0.45, z, 1.8, 0.08, 0.5, r); C.boxc(M.steel, x, 0.22, z, 1.6, 0.44, 0.3, r); box(x - 0.9, 0, z - 0.4, x + 0.9, 0.5, z + 0.4); }
    for (const [x, z] of [[-20, 20], [20, 20], [-20, -6], [20, -6]]) { C.cyl(M.concrete, x, 0.4, z, 1.0, 0.8, 16); box(x - 1, 0, z - 1, x + 1, 0.8, z + 1); }
    src(10, 4, 6, 0xffc890, 2, 9, '2196');
  }

  // ================= Harrow North station =================
  {
    const x0 = -76, x1 = -50, z0 = -16, z1 = 16, H = 10;
    wallX(C, M.brick, z0, x0, x1, 0, H, 0.6); wallX(C, M.brick, z1, x0, x1, 0, H, 0.6);
    wallZ(C, M.brick, x1, z0, z1, 0, H, 0.6, [[-4.5, 4.5, 5]]);
    wallZ(C, M.brick, x0, z0, z1, 0, H, 0.6, [[-6, 6, 4.2]]);
    C.box(M.tile, x0, 0, z0, x1, 0.04, z1);
    // the arched glass roof: iron ribs, some panes left, the rest open sky
    for (let x = x0 + 1; x < x1; x += 3.2) { const rib = new THREE.TorusGeometry(16, 0.14, 6, 24, Math.PI); C.geo(M.rust, rib, [x, H - 6.4, 0], [0, Math.PI / 2, 0], [1, 0.5, 1]); }
    for (let x = x0 + 1; x < x1 - 3; x += 6.4) if (R() < 0.6) C.geo(glass, new THREE.CylinderGeometry(16, 16, 3.1, 10, 1, true, -1.2 + R() * 0.6, 0.7), [x + 1.6, H - 6.4, 0], [0, 0, Math.PI / 2], [1, 0.5, 1]);
    C.box(M.rust, x0, H - 0.3, -16.3, x1, H, -15.7); C.box(M.rust, x0, H - 0.3, 15.7, x1, H, 16.3);
    plane(TEX.sign('HARROW NORTH', 'COAST LINE · ALL STOPS'), 6, 1.9, -49.6, 6.6, 0, Math.PI / 2, scene, 0.15);
    // departure board, the waiting room (council notice), benches, ticket office
    const dep = plane(TEX.depBoard(), 4.6, 1.44, -63, 4.0, -15.6, 0, scene, 0.9); dep.material.emissiveIntensity = 0.9;
    C.box(M.rust, -65.4, 3.2, -15.7, -60.6, 4.8, -15.6);
    wallZ(C, M.brickDark, -62, 8, 16, 0, 3.4, 0.3, [[9.5, 11.5, 2.4]]); C.box(M.wood, -62, 3.4, 8, -50, 3.6, 16);   // waiting room
    W.noticeBoard = plane(TEX.paper('COUNCIL OF HARROW · NOTICE', ['15 May 2193', 'The evacuation of 14 May was completed without loss.', 'All residents departed safely on the 08:14 coast service.', 'Harrow Reach thanks its stationmaster.'], { stamp: 'POSTED 15.05', key: 'n' }), 1.3, 0.98, -55.4, 1.7, 15.66, Math.PI, scene, 0.2);
    for (const z of [-10, -4, 4]) { C.boxc(M.wood, -58, 0.45, z, 3.2, 0.1, 0.6); C.boxc(M.steel, -58, 0.22, z, 3.0, 0.44, 0.4); box(-59.6, 0, z - 0.4, -56.4, 0.5, z + 0.4); }
    C.box(M.wood, -74, 0, 10, -68, 2.6, 15.4); box(-74, 0, 10, -68, 2.6, 15.4); C.box(glass, -74, 1.1, 9.95, -68, 2.6, 10.05);   // ticket office
    // the turnstiles at x -76 (lanes between the posts)
    for (const z of [-4.8, -2.4, 0, 2.4, 4.8]) { C.box(M.steel, -76.4, 0, z - 0.18, -75.2, 1.05, z + 0.18); box(-76.4, 0, z - 0.18, -75.2, 1.05, z + 0.18); C.cyl(M.steel, -75.8, 0.95, z + 0.5, 0.03, 0.9, 6, [Math.PI / 2, 0, 0]); }
    C.box(M.steel, -76.4, 0, -6, -75.2, 1.05, -5.6); C.box(M.steel, -76.4, 0, 5.6, -75.2, 1.05, 6); box(-76.4, 0, -6, -75.2, 1.05, -5.6); box(-76.4, 0, 5.6, -75.2, 1.05, 6);
    // Platform Two (x -86..-76), the track bed (x -94..-86, floor -1.2), Platform One (x -100..-94)
    box(-94, -2, -110, -86, -1.2, 110);
    C.box(M.gravel, -94, -1.5, -110, -86, -1.2, 110);
    for (const xr of [-91.6, -88.4]) C.box(M.rust, xr - 0.06, -1.2, -110, xr + 0.06, -1.05, 110);
    for (let z = -108; z < 108; z += 0.9) C.box(M.wood, -92.4, -1.2, z, -87.6, -1.13, z + 0.26);
    // the ground at y 0 is one box; the track bed is a slot cut into it: rebuild the ground collision around the slot
    GROUND.enabled = false;
    box(-140, -1, -110, -100, 0, 110); box(-86, -1, -110, 120, 0, 110);
    box(-100, -1, -110, -94, 0, 110);                                  // Platform One
    C.box(M.concrete, -100, -1.3, -110, -94, 0.02, 110); C.box(M.concrete, -86, -1.3, -110, -76, 0.02, 40);
    C.box(M.paving, -94.6, 0, -110, -94, 0.04, 110); C.box(M.paving, -86, 0, -70, -85.4, 0.04, 40);
    // platform edges: the edge of Platform Two is railed except the south steps (z 34..38)
    for (const [z0e, z1e] of [[-50, 34], [38, 40]]) { C.box(M.rust, -86.05, 0, z0e, -85.95, 1.0, z1e); C.box(M.rust, -86.08, 0.95, z0e, -85.92, 1.05, z1e); box(-86.2, 0, z0e, -85.8, 1.2, z1e); }
    for (let z = -50; z < 34; z += 2) C.box(M.rust, -86.06, 0, z, -85.94, 1.0, z + 0.08);
    // the steps down into the track bed and up onto Platform One (south end), and up onto Platform Two's north end
    for (let k = 0; k < 3; k++) { C.box(M.concrete, -86 - (k + 1) * 0.6, -1.2, 34, -86 - k * 0.6, -0.4 * (k + 1) + 0.02, 38); box(-86 - (k + 1) * 0.6, -1.2, 34, -86 - k * 0.6, -0.4 * (k + 1), 38); }
    for (let k = 0; k < 3; k++) { C.box(M.concrete, -94 + k * 0.6, -1.2, 30, -94 + (k + 1) * 0.6, -0.4 * (k + 1) + 0.02, 34); box(-94 + k * 0.6, -1.2, 30, -94 + (k + 1) * 0.6, -0.4 * (k + 1), 34); }
    for (let k = 0; k < 3; k++) { C.box(M.concrete, -86 - (k + 1) * 0.6, -1.2, -68, -86 - k * 0.6, -0.4 * (k + 1) + 0.02, -64); box(-86 - (k + 1) * 0.6, -1.2, -68, -86 - k * 0.6, -0.4 * (k + 1), -64); }
    // Platform Two runs to z -70 (north end beyond the signal box), concrete on top
    box(-86, -1, -70, -76, 0, 40);
    // the gate under the signal box: Platform Two north of z -50 is fenced off (the box's legs, a locked mesh gate)
    C.box(M.rust, -86, 0, -50.2, -80.2, 2.4, -50); box(-86, 0, -50.4, -80.2, 2.6, -49.8);
    // canopy over Platform Two (posts, a roof with holes)
    for (let z = -46; z <= 36; z += 8) { C.box(M.rust, -80.6, 0, z - 0.12, -80.4, 5.4, z + 0.12); box(-80.7, 0, z - 0.15, -80.3, 5.4, z + 0.15); }
    for (let z = -46; z < 36; z += 8) if (R() < 0.75) C.box(M.rust, -85, 5.4, z, -76, 5.6, z + 8 - (R() < 0.3 ? 3 : 0));
    // the station's east boundary wall (the concourse is the only way onto Platform Two), a table in the waiting room
    for (const [za, zb] of [[-96, -16], [16, 96]]) { C.box(M.brickDark, -76.3, 0, za, -75.7, 4, zb); box(-76.3, 0, za, -75.7, 4, zb); }
    C.box(M.wood, -61.4, 0, 13, -59.8, 0.8, 14.2); box(-61.4, 0, 13, -59.8, 0.8, 14.2);
    // the walls west of Platform One (old retaining wall) and the far end
    C.box(M.concrete, -101, 0, -110, -100, 4, 110); box(-101, 0, -110, -100, 4, 110);
    // the signal box: elevated cabin x -86..-76, z -60..-52, floor 3.6, stair along x -78..-76 from z -40 up to the landing
    const fy = 3.6;
    C.box(M.wood, -86, fy - 0.3, -60, -76, fy, -52); box(-86, fy - 0.3, -60, -76, fy, -52);
    for (const [x, z] of [[-85.6, -59.6], [-76.4, -59.6], [-85.6, -52.4], [-76.4, -52.4]]) { C.box(M.rust, x - 0.2, 0, z - 0.2, x + 0.2, fy - 0.3, z + 0.2); box(x - 0.2, 0, z - 0.2, x + 0.2, fy - 0.3, z + 0.2); }
    wallX(C, M.brickDark, -52, -86, -76, fy, fy + 3.2, 0.3, [[-79.6, -77.6, fy + 2.3]]);
    wallX(C, M.brickDark, -60, -86, -76, fy, fy + 3.2, 0.3, [[-83.6, -80.4, fy + 3.2]]);    // the north window (glass long gone)
    C.box(M.brickDark, -83.6, fy, -60.15, -80.4, fy + 0.4, -59.85); box(-83.6, fy, -60.15, -80.4, fy + 0.4, -59.85);
    wallZ(C, M.brickDark, -86, -60, -52, fy, fy + 3.2, 0.3); wallZ(C, M.brickDark, -76, -60, -52, fy, fy + 3.2, 0.3);
    C.box(M.rust, -86.4, fy + 3.2, -60.4, -75.6, fy + 3.5, -51.6);
    for (let k = 0; k < 9; k++) { const x = -84.8 + k * 0.9; C.box(M.rust, x - 0.05, fy, -58.8, x + 0.05, fy + 1.1, -58.6); C.geo(k % 3 ? M.steel : M.rust, new THREE.BoxGeometry(0.06, 1.0, 0.06), [x, fy + 1.0, -58.3], [0.4, 0, 0]); }
    C.box(M.wood, -84, fy, -57.8, -81, fy + 0.95, -56.6); box(-84, fy, -57.8, -81, fy + 0.95, -56.6);     // the desk with the log
    W.sigLogMesh = plane(TEX.paper('SIGNAL LOG · HARROW NORTH', [['07:40  Council order: evacuate. Coast service 08:14, P2.', '#2a2018'], ['07:52  Keld cutting reports the line unmaking. Ahead, the rails forget they are rails.', '#2a2018'], ['07:56  Sent the coast service early from Platform ONE. 212 aboard. Could not hold it. Could not call the others back.', '#8a1a10'], ['08:14  Announced P2 anyway. God forgive me.  — T. Wren', '#2a2018']], { hand: true, key: 'log' }), 0.9, 0.68, -82.5, fy + 0.97, -57.2, 0, scene, 0.25, -Math.PI / 2);
    // the door: a plank door that Wren opens
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.3, 0.08), M.wood); door.position.set(-78.6, fy + 1.15, -52); door.castShadow = true; scene.add(door);
    W.doors.signal = { mesh: door, col: box(-79.6, fy, -52.2, -77.6, fy + 2.3, -51.8) };
    // stair: 9 steps of 0.4 from z -40 (y 0) to the landing z -50..-52 (y 3.6)
    for (let k = 0; k < 9; k++) { const za = -40 - k * 1.1, y = (k + 1) * 0.4; C.box(M.rust, -79.8, y - 0.12, za - 1.1, -76.2, y, za); box(-79.8, 0, za - 1.1, -76.2, y, za); }
    C.box(M.rust, -79.8, fy - 0.12, -52, -76.2, fy, -50); box(-79.8, 0, -52, -76.2, fy, -50);
    C.box(M.rust, -80, 0, -50, -79.8, fy + 1, -40); box(-80.05, 0, -50, -79.75, fy + 1.1, -40);
    // the collapsed footbridge north of the box: rubble steps from Platform Two's north end up to the window sill (4.0)
    for (let k = 0; k < 10; k++) { const z1r = -60.15 - k * 0.85, y = 4.0 - k * 0.4; if (y <= 0.1) break; C.geo(M.concrete, new THREE.BoxGeometry(3.2 + R() * 0.6, 0.5, 0.95), [-82, y - 0.25, z1r - 0.42], [R() * 0.08, R() * 0.2, R() * 0.08]); box(-83.6, 0, z1r - 0.85, -80.4, y, z1r); }
    C.geo(M.rust, new THREE.BoxGeometry(0.4, 0.5, 12), [-84.2, 2.4, -66], [0.42, 0.05, 0]); C.geo(M.rust, new THREE.BoxGeometry(0.4, 0.5, 12), [-79.8, 2.2, -66.5], [0.4, -0.04, 0.05]);
    src(-81, fy + 2.4, -56, 0xffc890, 3, 8, '2196'); src(-63, 5, 0, 0xffe0c0, 4, 18, '2196'); src(-82, 4.6, 0, 0xffd8b0, 3, 16, '2196');
    // the echo train (an echo from 07:56): three ghost cars on the track, seen by everyone, read in Residue Vision
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const train = new THREE.Group(); train.position.set(-90, -1.2, 10); g96.add(train); W.train = train;
    for (let k = 0; k < 3; k++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.4, 18), ghostMat); car.position.set(0, 1.9, -k * 19); train.add(car);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.0, 3.4, 18)), new THREE.LineBasicMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.45, toneMapped: false })); edges.position.copy(car.position); train.add(edges);
      for (let w = 0; w < 5; w++) { const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), ghostMat); win.position.set(-1.52, 2.4, -k * 19 - 7 + w * 3.5); win.rotation.y = -Math.PI / 2; train.add(win); }
    }
    const ghostBoard = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ map: TEX.sign('07:56 COAST · P1', 'AN ECHO FROM THIS MORNING', '#0c1418', '#d8f0ff', 'g'), transparent: true, opacity: 0.85, toneMapped: false, side: THREE.DoubleSide }));
    ghostBoard.position.set(-1.6, 3.2, 8.6); ghostBoard.rotation.y = -Math.PI / 2; train.add(ghostBoard); game.residue(ghostBoard); W.ghostBoard = ghostBoard;
    train.visible = false;
  }

  // ================= Larkfield School =================
  {
    const H = 4.6;
    wallX(C, M.plaster, -6, 52, 80, 0, H + 3, 0.5); wallX(C, M.plaster, -34, 52, 80, 0, H + 3, 0.5);
    wallZ(C, M.plaster, 52, -34, -6, 0, H + 3, 0.5, [[-22, -18, 3.2]]); wallZ(C, M.plaster, 80, -34, -6, 0, H + 3, 0.5);
    C.box(M.floor, 52, 0, -34, 80, 0.05, -6);
    // corridor walls (z -18 south side, z -22 north side), doors at x 58..60 and 72..74
    wallX(C, M.plasterIn, -18, 52, 80, 0, H, 0.25, [[58, 60, 2.4], [72, 74, 2.4]]);
    wallX(C, M.plasterIn, -22, 52, 80, 0, H, 0.25, [[58, 60, 2.4], [72, 74, 2.4]]);
    wallZ(C, M.plasterIn, 66, -18, -6, 0, H, 0.25); wallZ(C, M.plasterIn, 70, -18, -6, 0, H, 0.25); wallZ(C, M.plasterIn, 66, -34, -22, 0, H, 0.25);
    // roof: whole except over the north classroom (collapsed)
    C.box(M.concrete, 52, H, -22, 80, H + 0.3, -6); C.box(M.concrete, 66, H, -34, 80, H + 0.3, -22);
    C.box(M.concrete, 52, H + 3, -22, 80, H + 3.3, -5.8); C.box(M.concrete, 66, H + 3, -34.2, 80, H + 3.3, -22);
    C.geo(M.concrete, new THREE.BoxGeometry(14, 0.3, 6), [59, 2.0, -31], [0.42, 0, 0.05]);           // the fallen slab in the north classroom
    C.geo(M.rust, new THREE.BoxGeometry(0.3, 0.3, 13), [58.2, 1.5, -28.4], [0.12, 0, 0]);             // the beam (shard on top at y 1.9)
    box(52.5, 0, -34, 65.6, 0.8, -28); box(55, 0, -28, 62, 0.4, -26.8); C.box(M.concrete, 55, 0, -28, 62, 0.4, -26.8);
    // windows: dark panes on the outside walls
    for (let x = 54; x < 80; x += 3.2) { for (const z of [-5.7, -34.3]) { C.box(dark, x, 1.2, z - 0.06, x + 1.8, 3.4, z + 0.06); C.box(M.wood, x - 0.08, 1.12, z - 0.1, x + 1.88, 1.2, z + 0.1); } }
    plane(TEX.sign('LARKFIELD SCHOOL', 'EST. 2160 · ALL WELCOME', '#3a4a3a', '#efe6cc'), 5, 1.6, 51.7, 5.4, -20, -Math.PI / 2, scene, 0.12);
    // classroom one (x 52..66, z -18..-6): board, teacher's desk, twenty-four chairs
    C.box(dark, 52.3, 1.2, -16, 52.4, 3.2, -8); plane(TEX.paper('THURSDAY 14 MAY', ['Today: the river.', 'Where does water go when it forgets?', '— Ms Okafor'], { bg: '#26302a', ink: '#e8e4d8', hand: true, key: 'cb' }), 6.4, 1.8, 52.45, 2.2, -12, Math.PI / 2, scene, 0.15);
    C.box(M.wood, 53.6, 0, -13.4, 55.6, 0.85, -11.2); box(53.6, 0, -13.4, 55.6, 0.85, -11.2);
    W.registerMesh = plane(TEX.paper('REGISTER · CLASS 3 · 14 MAY 2193', ['24 names.', ['Asha, Bram, Corin, Dele, Eli, Femi, Gus, Hana, Ivo — "not arrived · coast train"', '#8a1a10'], 'Present at gate: 15.'], { key: 'reg' }), 0.6, 0.45, 55.0, 0.87, -12.0, 0, scene, 0.2, -Math.PI / 2);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const x = 58 + r * 2, z = -16.2 + c * 1.8; C.box(M.wood, x - 0.5, 0.7, z - 0.35, x + 0.5, 0.76, z + 0.35); C.box(M.steel, x - 0.45, 0, z - 0.3, x + 0.45, 0.7, z + 0.3); C.box(M.wood, x + 0.55, 0.42, z - 0.2, x + 0.95, 0.46, z + 0.2); box(x - 0.5, 0, z - 0.35, x + 0.5, 0.76, z + 0.35); }
    // the head's office (x 70..80, z -18..-6): desk, the order, cabinets; door panel at x 72..74 (opened by Okafor at 10:29:14)
    C.box(M.wood, 76, 0, -11, 79.4, 0.85, -8.4); box(76, 0, -11, 79.4, 0.85, -8.4);
    W.orderMesh = plane(TEX.paper('COUNCIL OF HARROW · ORDER', ['14 May 2193 · 07:40', 'Storm front at Keld. Abandon Larkfield School.', 'All children to the Archive by 10:40.', 'Do not wait for stragglers.'], { stamp: 'URGENT', key: 'ord' }), 0.6, 0.45, 77.6, 0.87, -9.6, 0, scene, 0.2, -Math.PI / 2);
    for (const z of [-17, -15.6]) { C.box(M.steel, 79, 0, z, 79.8, 1.9, z + 1.2); box(79, 0, z, 79.8, 1.9, z + 1.2); }
    const od = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.4, 0.08), M.wood); od.position.set(73, 1.2, -18); od.castShadow = true; scene.add(od);
    W.doors.office = { mesh: od, col: box(72, 0, -18.2, 74, 2.4, -17.8) };
    // the library (x 70..80, z -34..-22): the drawings wall
    plane(TEX.drawing(), 1.6, 1.2, 79.7, 1.8, -28, -Math.PI / 2, scene, 0.18);
    for (let k = 0; k < 5; k++) plane(TEX.paper('DRAWING', ['the river', 'by ' + ['Femi', 'Hana', 'Corin', 'Ivo', 'Asha'][k]], { bg: ['#f0e8d0', '#e8eef0', '#f0e0e0', '#e8f0e0', '#f0eadc'][k], hand: true, key: 'dr' + k }), 0.9, 0.7, 79.7, 1.7 + (k % 2) * 0.9, -32.4 + k * 1.0 + (k > 2 ? 6 : 0), -Math.PI / 2, scene, 0.12);
    for (const x of [72, 76]) { C.box(M.wood, x, 0, -33.6, x + 3, 2.2, -33); box(x, 0, -33.6, x + 3, 2.2, -33); }
    // the fray: an unstable patch across the corridor (x 63..68.5), a floor decal and a column of shimmer
    const frayMat = new THREE.MeshBasicMaterial({ color: 0xffc890, map: TEX.shimmer(), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    frayMat.map.wrapS = frayMat.map.wrapT = THREE.RepeatWrapping;
    const fray = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.4, 3.9), frayMat); fray.position.set(65.75, 2.2, -20); g96.add(fray); W.fray = fray;
    const frayFloor = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3.9), new THREE.MeshBasicMaterial({ map: TEX.ring(), color: 0xffb070, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false })); frayFloor.rotation.x = -Math.PI / 2; frayFloor.position.set(65.75, 0.07, -20); g96.add(frayFloor); W.frayFloor = frayFloor;
    // the yard: fence, gate posts at z 8 (x 40..46), the notice board
    for (const [xa, xb] of [[36, 40], [46, 52]]) { C.box(M.rust, xa, 0, 7.9, xb, 1.8, 8.1); box(xa, 0, 7.8, xb, 2, 8.2); }
    C.box(M.rust, 35.9, 0, -36, 36.1, 1.8, 8); box(35.8, 0, -36, 36.2, 2, 8); C.box(M.rust, 36, 0, -36.1, 52, 1.8, -35.9); box(36, 0, -36.2, 52, 2, -35.8);
    for (const x of [40, 46]) C.box(M.brick, x - 0.3, 0, 7.7, x + 0.3, 2.6, 8.3);
    C.box(M.wood, 42.6, 0, -33.4, 45.4, 2.6, -33.0); box(42.6, 0, -33.4, 45.4, 2.6, -33.0);
    W.posterMesh = plane(TEX.poster(), 1.3, 0.98, 44, 1.6, -32.95, 0, scene, 0.15);
    src(59, 3.6, -12, 0xffe0c0, 4, 12, '2196'); src(66, 3.6, -20, 0xffc890, 2, 8, '2196'); src(75, 3.4, -12, 0xffe0c0, 3, 9, '2196'); src(75, 3.4, -28, 0xffe0c0, 3, 10, '2196');
  }

  // ================= the Saltmarket Hall =================
  {
    const x0 = -22, x1 = 22, z0 = 40, z1 = 70, H = 4.2;
    wallX(C, M.brick, z0, x0, x1, 0, H, 0.6, [[-4, 4, 3.6]]); wallX(C, M.brick, z1, x0, x1, 0, H, 0.6);
    wallZ(C, M.brick, x0, z0, z1, 0, H, 0.6, [[52, 58, 3.4]]); wallZ(C, M.brick, x1, z0, z1, 0, H, 0.6);
    C.box(M.paving, x0, 0, z0, x1, 0.04, z1);
    // iron columns and roof trusses; the west half keeps its glass roof, the east half is down
    for (let x = -18; x <= 18; x += 6) for (let z = 44; z <= 66; z += 6) {
      const aged = x > 2;
      if (aged && R() < 0.45) continue;
      C.cyl(aged ? M.rustHeavy : M.rust, x, 4.5, z, 0.18, 9, 10); box(x - 0.2, 0, z - 0.2, x + 0.2, 9, z + 0.2);
    }
    for (let x = -18; x <= 0; x += 6) { C.box(M.rust, x - 0.1, 9, z0, x + 0.1, 9.4, z1); }
    for (let z = 44; z <= 66; z += 6) C.box(M.rust, x0, 9, z - 0.1, 0, 9.4, z + 0.1);
    C.geo(glass, new THREE.BoxGeometry(22, 0.05, 30), [-11, 9.5, 55]);
    C.box(M.brick, x0, H, z0 - 0.3, x1, 7, z0 + 0.3); C.box(M.brick, -6, 7, z0 - 0.3, 6, 9, z0 + 0.3);    // the north gable
    C.box(M.brick, x0, H, z1 - 0.3, 0, 6.4, z1 + 0.3);
    // fallen trusses and rubble in the east half
    for (let k = 0; k < 7; k++) C.geo(M.rustHeavy, new THREE.BoxGeometry(0.3, 0.4, 7 + R() * 5), [4 + R() * 16, 0.6 + R() * 1.6, 46 + R() * 22], [R() * 0.5 - 0.25, R() * 3, R() * 0.6 - 0.3]);
    for (const [x, z, r, h] of [[12, 52, 2.6, 1.2], [17, 63, 3.2, 1.5], [6, 68, 2.4, 1.0], [-15, 66, 2.0, 0.9]]) { C.geo(M.concrete, new THREE.DodecahedronGeometry(1, 0), [x, h * 0.3, z], [R(), R(), R()], [r, h, r * 0.8]); box(x - r * 0.6, 0, z - r * 0.5, x + r * 0.6, h, z + r * 0.5); }
    // stalls (west and middle rows intact; the epicentre clear)
    const k = streetKit({ era: '2196', seed: 151 });
    for (const [x, z, yaw] of [[-15, 46, 0], [-15, 52, 0], [-15, 60, 0], [-5, 46, Math.PI], [-5, 52, Math.PI], [-5, 60, Math.PI], [3, 46, 0], [-9, 66, 0]]) k.add('stall', [x, 0, z], yaw);
    k.add('crate', [-12.6, 0, 47.2], 0.3).add('crate', [-12.2, 0, 48], 0).add('barrel', [-7.4, 0, 50.6]).add('barrel', [-3.4, 0, 57.8]).add('crate', [1.6, 0, 47.6], 0.6).add('cart', [-18, 0, 61], 1.2);
    k.add('pot', [-15.4, 0.9, 45.8]).add('pot', [-4.6, 0.9, 52.4]);
    const built = k.build(); g96.add(built); for (const c of k.colliders) col.add(c.min, c.max, { states: ['2196'] });
    // the warden's booth (north-west corner)
    wallX(C, M.wood, 46, -22, -16, 0, 2.6, 0.12, [[-19.6, -18.2, 2.2]]); wallZ(C, M.wood, -16, 40, 46, 0, 2.6, 0.12); C.box(M.wood, -22, 2.6, 40, -16, 2.75, 46);
    C.box(M.wood, -21.4, 0, 41, -19, 0.85, 42.4); box(-21.4, 0, 41, -19, 0.85, 42.4);
    W.ledgerMesh = plane(TEX.paper('MARKET WARDEN · LEDGER', ['14 May 2193 · Saltmarket: normal trading.', '15 May 2193 · Roof failure from age. Inspected. No casualties. Hall closed for repairs.', '— Warden, for the Council'], { key: 'led' }), 0.6, 0.45, -20.2, 0.87, 41.7, 0, scene, 0.2, -Math.PI / 2);
    // the clock over the north door (stopped) and stall clocks
    W.marketClock = plane(TEX.clockFace('16:40', '12 s'), 1.8, 1.8, 0, 7.4, 39.6, Math.PI, scene, 0.2);
    plane(TEX.clockFace('16:40', ''), 0.5, 0.5, -15, 2.2, 45.2, 0, scene, 0.15);
    plane(TEX.carved('SALTMARKET HALL', 'MMCXX'), 7, 1.1, 0, 5.6, 39.6, Math.PI, scene, 0.05);
    // the three aged girders (standing iron columns with a rust gradient) and the floor lines they cast toward the epicentre
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffc890, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (const [gx, , gz] of P.girders) {
      C.cyl(M.rustHeavy, gx, 4.5, gz, 0.24, 9, 12); box(gx - 0.26, 0, gz - 0.26, gx + 0.26, 9, gz + 0.26);
      const dx = P.epic[0] - gx, dz = P.epic[2] - gz, L = Math.hypot(dx, dz);
      const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.16, L + 2.0), lineMat.clone());
      ln.position.set(gx + dx / 2, 0.08, gz + dz / 2); ln.rotation.set(-Math.PI / 2, 0, Math.atan2(-dx, -dz)); g96.add(ln); W.girderLines.push(ln);
    }
    // the epicentre: a scorched patch; the dug pit and the Lantern feed (hidden until dug)
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1, transparent: true, opacity: 0.7, depthWrite: false })); scorch.rotation.x = -Math.PI / 2; scorch.position.set(P.epic[0], 0.06, P.epic[2]); g96.add(scorch);
    const pit = new THREE.Group(); pit.position.set(P.epic[0], 0, P.epic[2]); pit.visible = false; g96.add(pit); W.pit = pit;
    pit.add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 0.12, 16), dark)).position.y = 0.04;
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 30, 8), new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.6, emissive: 0xffa060, emissiveIntensity: 0.25 })); feed.rotation.x = Math.PI / 2; feed.position.set(0, 0.1, -15); pit.add(feed);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.18), amber); tag.position.set(0.3, 0.2, -0.2); pit.add(tag);
    // the residue echo of 16:40:12: figures under the roof (Residue Vision only)
    const echoMat = new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const echoes = new THREE.Group(); echoes.userData.states = ['2196'];
    for (let i = 0; i < 0; i++) {   // (the mission adds ghosted residents instead)
      const a = R() * Math.PI * 2, r = 1.5 + R() * 8, x = P.epic[0] + Math.sin(a) * r, z = P.epic[2] + Math.cos(a) * r;
      if (x > 21 || z > 69) continue;
      const fig = new THREE.Group(); fig.position.set(x, 0, z); fig.rotation.y = R() * 6;
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.0, 4, 8), echoMat); body.position.y = 0.9; fig.add(body);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), echoMat); hd.position.y = 1.62; fig.add(hd);
      if (R() < 0.5) { fig.rotation.x = -0.3; fig.position.y = -0.1; }
      echoes.add(fig);
    }
    scene.add(echoes); game.residue(echoes); W.echoes = echoes;
    // the aging wave (16:40:12): a ring that sweeps out from the epicentre
    const wave = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 64), new THREE.MeshBasicMaterial({ color: 0xffc890, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    wave.rotation.x = -Math.PI / 2; wave.position.set(P.epic[0], 0.3, P.epic[2]); g96.add(wave); W.wave = wave;
    const dust = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: 0x8a7a64, transparent: true, opacity: 0, depthWrite: false, roughness: 1 })); dust.position.set(P.epic[0], 3, P.epic[2]); g96.add(dust); W.dust = dust;
    // the record stall (Mara's cylinder under the rubble)
    C.box(M.wood, -18.4, 0, 64, -15.4, 0.9, 66.6); box(-18.4, 0, 64, -15.4, 0.9, 66.6);
    const cyl = new THREE.Group(); cyl.position.set(P.cylinder[0], 0.95, P.cylinder[2]); g96.add(cyl); W.cylinderObj = cyl;
    cyl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 14), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.5 }))).rotation.z = Math.PI / 2;
    src(-10, 6, 55, 0xffe0c0, 4, 18, '2196'); src(8, 3, 60, 0xffb070, 2, 10, '2196'); src(-19, 2.2, 43, 0xffc890, 2, 6, '2196');
  }

  // ================= the arrival road and the Lock Gate =================
  {
    for (const z of [7.6, 20.4]) C.box(M.concrete, 52, 0, z - 0.2, 66, 0.3, z + 0.2);
    C.box(M.concrete, 66, 0, 4, 68, 9, 8); C.box(M.concrete, 66, 0, 20, 68, 9, 24); box(66, 0, 4, 68, 9, 8); box(66, 0, 20, 68, 9, 24);
    C.box(M.rust, 66, 8, 7, 68, 9, 21);
    plane(TEX.sign('HARROW REACH', 'THE LOCK HOLDS · 14 MAY 2193', '#2a2620', '#ffc890'), 6, 1.9, 65.9, 7.0, 14, -Math.PI / 2, scene, 0.3);
    const gateMat = new THREE.MeshBasicMaterial({ color: 0xffc890, map: TEX.shimmer(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    gateMat.map.wrapS = gateMat.map.wrapT = THREE.RepeatWrapping;
    const gateVeil = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), gateMat); gateVeil.position.set(67, 4, 14); gateVeil.rotation.y = Math.PI / 2; g96.add(gateVeil); W.gateVeil = gateVeil;
    // beyond the gate: the open road out (collision keeps the player inside the lock unless the mission opens it)
    W.gateBar = box(70, 0, 8, 71, 6, 20);
    src(66, 6, 14, 0xffc890, 3, 12, '2196');
  }

  // ================= the lock haze (the edge of the day) =================
  {
    const hazeMat = new THREE.MeshBasicMaterial({ color: 0xffc890, map: TEX.shimmer(), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false });
    hazeMat.map.wrapS = hazeMat.map.wrapT = THREE.RepeatWrapping; hazeMat.map.repeat.set(24, 1);
    const haze = new THREE.Mesh(new THREE.CylinderGeometry(150, 150, 60, 64, 1, true), hazeMat); haze.position.set(-10, 24, 0); g96.add(haze); W.haze = haze;
  }

  // ================= the city around (one interior-mapped cityBlock, 2196 ruin) =================
  const FOOT = [
    // [x0, x1, z0, z1, face, height, wall]
    [-48, -24, -60, -12, '+x', 22, 'brick'], [-48, -26, 10, 36, '+x', 18, 'plaster'], [-48, -26, 40, 76, '+x', 16, 'brick'],
    [-74, -52, -60, -22, '-z', 20, 'darkBrick'], [-74, -52, 22, 56, '+z', 15, 'concrete'],
    [24, 34, -60, -12, '-x', 26, 'concrete'], [26, 60, 26, 76, '-z', 20, 'brick'], [52, 86, -70, -40, '+z', 18, 'plaster'],
    [84, 100, -34, 4, '-x', 22, 'brick'], [-30, 30, -90, -60, '+z', 30, 'concrete'], [-24, 24, 76, 92, '-z', 14, 'stone'],
    [-122, -102, -60, 0, '+x', 24, 'brick'], [-122, -102, 6, 60, '+x', 20, 'darkBrick'], [68, 100, 26, 70, '-x', 16, 'stone'],
  ];
  for (const [x0, x1, z0, z1] of FOOT) box(x0, 0, z0, x1, 40, z1);
  const bld = (x0, x1, z0, z1, face, o) => {
    const yaw = face === '+x' ? Math.PI / 2 : face === '-x' ? -Math.PI / 2 : face === '-z' ? Math.PI : 0;
    const w = (face === '+z' || face === '-z') ? x1 - x0 : z1 - z0, d = (face === '+z' || face === '-z') ? z1 - z0 : x1 - x0;
    return { width: Math.abs(w), depth: Math.abs(d), position: [(x0 + x1) / 2, 0, (z0 + z1) / 2], yaw, ...o };
  };
  try {
    const list = FOOT.map(([x0, x1, z0, z1, face, h, wall], i) => bld(x0, x1, z0, z1, face, {
      height: h, seed: 1500 + i, wall, era: '2196', groundFloor: 4.2, faces: ['shop', 'windows', 'blank', 'windows'],
      ruin: 0.4 + (i % 3) * 0.12, moss: 0.35 + (i % 2) * 0.25, collapse: i % 4 === 1,
    }));
    const b = RZ.cityBlock(list, { era: '2196', lit: 0.12, daylight: 0.7, detail: low ? 'low' : undefined });
    g96.add(b.mesh); W.block = b.mesh;
    const sky = RZ.skyline({ center: [-10, 0], radius: [170, 300], count: low ? 26 : 44, height: [24, 120], lit: 0.0, seed: 151 }); g96.add(sky.mesh || sky);
  } catch (e) { console.warn('m15 city', e); }

  // ================= streets (props.js streetKit, 2196) =================
  {
    const k = streetKit({ era: '2196', seed: 1596 });
    k.scatter('lamp', [[-24, -9], [-24, 23]], { spacing: 16, turn: Math.PI / 2, y: 0 }).scatter('lamp', [[24, -9], [24, 23]], { spacing: 16, turn: -Math.PI / 2, y: 0 });
    k.scatter('lamp', [[-46, 7.4], [-26, 7.4]], { spacing: 10, turn: Math.PI, y: 0 }).scatter('lamp', [[28, 21.4], [62, 21.4]], { spacing: 12, turn: Math.PI, y: 0 });
    k.car([-36, 0, 3, 1.4], 1.4).car([30, 0, 14, 0.2]).van([-12, 0, 31, 0.1]).car([12, 0, 34, 2.8]).car([50, 0, 17, 1.6]);
    k.bins([[-22, 0, 22], [22, 0, -8], [-30, 0, -7]]).benches([[-30, 0, 7.2, Math.PI]]);
    k.overgrowth({ area: [-50, -8, -24, 8] }, { density: 0.4, cracks: 0.8 }).overgrowth({ area: [24, 8, 66, 20] }, { density: 0.45, cracks: 0.8 }).overgrowth({ area: [-11, 24, 11, 40] }, { density: 0.35, cracks: 0.7 });
    k.overgrowth({ area: [36, -36, 52, 8] }, { density: 0.6, cracks: 0.2 });
    k.scatter('rubble', { area: [-50, -8, -24, 8] }, { count: 6 }).scatter('rubble', { area: [24, 8, 66, 20] }, { count: 6 });
    const built = k.build(); g96.add(built);
    for (const c of k.colliders) col.add(c.min, c.max, { states: ['2196'] });
  }

  // ================= build the batches =================
  C.build(scene, { blockers: true, game });
  for (const e of ['2049', '2196']) S[e].build(G[e], { blockers: true, game });

  // ================= per-frame =================
  W.update = (dt, t) => {
    if (W.haze) W.haze.material.map.offset.x = t * 0.004;
    if (W.gateVeil) W.gateVeil.material.map.offset.x = t * 0.05;
    if (W.core) { W.core.material.opacity = 0.7 + Math.sin(t * 0.9) * 0.12 * (W.lanternPulse ?? 1); W.coreHalo.scale.setScalar(1 + Math.sin(t * 0.6) * 0.05); }
    W.lanternRings.forEach((r, i) => { r.rotation.z += dt * (0.15 + i * 0.07) * (W.ringSpeed ?? 1); });
    if (W.beam) W.beam.material.opacity = (W.beamOn ?? 1) * (0.1 + Math.sin(t * 0.5) * 0.02);
    if (W.fray?.visible) W.fray.material.map.offset.y = t * 0.3;
  };
  return W;
}

/** Draw a ring lever screen (the finale). */
export function drawRingScreen(s, label, value, ok) {
  const g = s.cv.getContext('2d'); g.fillStyle = '#100c08'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = ok ? '#b6ff8a' : '#ffc890'; g.font = `700 20px ${FONT}`; g.fillText(label, 12, 28); g.font = `700 40px ${FONT}`; g.fillText(value, 12, 78);
  s.tx.needsUpdate = true;
}
