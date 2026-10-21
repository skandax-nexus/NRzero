// Mission 16 environment: the Museum of Failed Worlds, the undercroft beneath the Hollow Archive (Harrow Reach, 2196).
// In 2049 the same rooms are Store B-3, the Rain City Civic Museum's deep reserve (built 2031): racking, crates,
// strip lights. North = -z, the museum floor is at y = 0.
//   Entry stair (x -2..2, z 22..33, top landing y 3) into the Keeper's hall (x -9..9, z 8..22: Edie's desk, the
//   catalogue cabinet, the visitors' book).
//   The nave, the Hall of Ordinary Things (x -6..6, z -34..8): eight cases of strays.
//   Listening Room I (x -18..-6, z -7..5), Listening Room II (x 6..18, z -7..5), Listening Room III (x -18..-6,
//   z -27..-15), the Concordance (x 6..18, z -27..-15: three trays; in 2049 the crates of the current world).
//   The rotunda, Accession Zero (centre 0, -44, radius 8.6), the stacks (x 11..31, z -58..-30: one main aisle
//   z -45.5..-42.5 with hiding alcoves; a 2196 collapse at x 18.5..20.5, a 2049 security grille at x 25.7), the
//   Founder's study (x 31..41, z -54..-36).
//   The memory stage, far east: the Helix hall on 19.10.2026 (x 284..316, z -16..14) and the Varen kitchen
//   (x 288..302, z 42..56).
// Static geometry is merged per material (env_m6 Batch): one shared batch plus one per temporal state.
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng, chronolith } from './kit.js';
import { Batch } from './env_m6.js';
import { registerCast, CAST } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
const SERIF = '"Cormorant Garamond", Georgia, serif';
const HAND = '"Caveat", "Segoe Print", "Bradley Hand", cursive';
const MEM_X = 300;

export const P = {
  start: [0, 3, 31.4, Math.PI], hall: [0, 0, 16, Math.PI], edieDesk: [5.6, 0, 14.2], edie: [4.4, 0, 14.4], maraStart: [-1.2, 3, 32.2],
  catalogue: [-8.0, 0, 14], visitors: [5.0, 0, 12.6], shard0: [-7.4, 0, 20.4],
  roomI: [-12, 0, -1], roomII: [12, 0, -1], roomIII: [-12, 0, -21], conc: [12, 0, -21],
  chairI: [-15.4, 0, -1], chairII: [15.4, 0, -1], chairIII: [-15.4, 0, -21],
  caseI: [-12, 0, -5.2], caseII: [12, 0, -5.2], caseIII: [-12, 0, -25.2],
  trays: [[12, 0, -17.6], [9.0, 0, -21], [15.0, 0, -21]],       // tray for memory I (badge), II (coat), III (clock)
  crates: [[12, 0, -16.6], [8.2, 0, -21], [15.8, 0, -21]],
  rotunda: [0, 0, -44], zeroCase: [0, 0, -44], stackGate: [9.6, 0, -44], ledger: [11.9, 0, -42.85],
  stacksIn: [12.2, 0, -44, -Math.PI / 2], alcoveN2: [22.25, 0, -48.4], musicBox: [22.25, 0, -49.8], shardS1: [17.25, 0, -40.0],
  studyDoor: [30.6, 0, -44], studyIn: [33, 0, -44, -Math.PI / 2], desk: [36.2, 0, -39.6], drawer: [36.2, 0, -40.4], lectern: [37.6, 0, -47.6],
  bands: [40.6, 0, -45], emptyCase: [34.4, 0, -51.0], studyCoat: [32.0, 0, -37.0], shardStudy: [39.6, 0, -37.2],
  // memory stage
  memHall: [MEM_X, 0, 10, Math.PI], ring: [MEM_X, 3.0, -9.4], rope: -4.2, memDesk: [MEM_X + 8.2, 0, 4.2],
  memKitchen: [MEM_X - 3.4, 0, 50.4, Math.PI], kTable: [MEM_X - 5, 0, 47.8], kWindow: [MEM_X - 5, 1.6, 42.4], kClock: [MEM_X - 9.4, 2.2, 47.8], kRadio: [MEM_X - 1.0, 0.95, 44.4],
};

// The Hall of Ordinary Things: eight strays (optional). [x, z, ry, title, story]
export const EXHIBITS = [
  [-4.7, 5, Math.PI / 2, 'A wedding ring', 'Gold, worn thin on one side. Engraved inside: "T & R · Port Hale · 2058". There has never been a Port Hale. Somebody wore this for thirty years.', 'ring'],
  [4.7, 5, -Math.PI / 2, 'A school report', 'Skelling Bay Primary, Year 4. "Ana is kind to everyone and needs to stop drawing in maths." The school, the bay and Ana: none of them ever were.', 'report'],
  [-4.7, -10, Math.PI / 2, 'A tram ticket', 'Rain City Transit, Line 9 to Sunward, single, 19.10.2049. Rain City never had a Line 9. The ticket was clipped twice: someone took the ride.', 'ticket'],
  [4.7, -10, -Math.PI / 2, 'A jar of seawater', 'Hand label: "From the sea we had. Harrow front, 2112." In our 2196 the sea is forty kilometres from Harrow. In theirs it came to the door.', 'jar'],
  [-4.7, -14, Math.PI / 2, 'A placard', 'Painted on a door panel: "LET THE MACHINE SLEEP". A protest outside a Helix that, in that world, listened. It still came to this shelf.', 'placard'],
  [4.7, -14, -Math.PI / 2, 'A birthday card', '"Happy 11th Mira!!! Love from Kai (and Mum)". A seven-year-old\'s capitals, eleven candles in red crayon. In that world she got one more birthday.', 'card'],
  [-4.7, -29, Math.PI / 2, 'A Helix identity card', '"DR. M. VAREN · DIRECTOR · HELIX TEMPORAL RESEARCH · 2047". A world where Mira grew up to run Helix. The photo on it has been scratched out.', 'id'],
  [4.7, -29, -Math.PI / 2, 'A painted helmet', 'A Continuum trooper\'s helmet, white paint flowers over the visor. Edie\'s label: "From a world where they lost. Somebody\'s child grew flowers in it."', 'helmet'],
];
export const SHARDS = [
  { p: [-7.4, 0.9, 20.4], where: 'the Keeper\'s hall', era: null },
  { p: [16.6, 0.9, 3.6], where: 'Listening Room II', era: null },
  { p: [17.25, 0.9, -40.0], where: 'the stacks (2049)', era: '2049' },
  { p: [-6.2, 0.9, -48.6], where: 'Accession Zero', era: null },
  { p: [39.6, 0.9, -37.2], where: 'the Founder\'s study', era: null },
];
// the three memories: the same morning, 19.10.2026, from three erased worlds
export const MEMS = [
  { id: 'I', world: '0031', name: 'The Quiet Morning', room: 'Listening Room I', place: 'hall', artifact: 'Mira\'s visitor badge',
    label: ['WORLD 0031 · THE QUIET MORNING', 'A visitor\'s badge, scorched at one corner.', 'Helix open day, 19.10.2026.', 'Kept by the Founder. Do not wear.'] },
  { id: 'II', world: '0207', name: 'The Reaching Morning', room: 'Listening Room II', place: 'hall', artifact: 'a child\'s blue coat',
    label: ['WORLD 0207 · THE REACHING MORNING', 'A child\'s blue coat, age 7.', 'The right cuff is torn away.', 'Kept by the Founder. Kept the longest.'] },
  { id: 'III', world: '0388', name: 'The Rain Morning', room: 'Listening Room III', place: 'kitchen', artifact: 'a kitchen clock',
    label: ['WORLD 0388 · THE RAIN MORNING', 'A kitchen clock, stopped at 08:14.', 'Varen flat, Calder Row, Rain City.', 'Kept by the Founder.'] },
];
// the Concordance: each erased artifact against the current world's copy (2049 crate). ok = the true difference
export const COMPARE = [
  { mem: 0, crate: 'HELIX OPEN DAY 2026 · DESK LOG (COPY)', q: 'World 0031\'s badge against our world\'s desk log. What is different?',
    opts: ['Our log has the wrong date', 'Our log issued two badges: Kai was there too', 'Our log has no badges at all'], ok: 1,
    why: 'In world 0031 Kai stayed home with a fever and only Mira had a badge. Our log lists two at 08:02: M. VAREN, and K. VAREN, accompanied.' },
  { mem: 2, crate: 'HELIX PRESS OFFICE · OPEN DAY PHOTOGRAPH, 19.10.2026', q: 'World 0388\'s stopped clock against our world\'s press photo. What is different?',
    opts: ['In our world the open day went ahead, in sunshine', 'In our world the clock stopped at 08:15', 'In our world the Varens moved away'], ok: 0,
    why: 'In world 0388 a storm cancelled the open day and Mira fell at home. Our photo is stamped 08:09, the hall full and the sky clear.' },
  { mem: 1, crate: 'VAREN BEQUEST · 2041 · CHILD\'S COAT, BLUE', q: 'World 0207\'s torn coat against our world\'s coat. What is different?',
    opts: ['Ours is a different colour', 'Ours is an adult\'s coat', 'Nothing: ours is missing the same right cuff'], ok: 2,
    why: 'The coat Elena Varen gave the museum in 2041 is missing its right cuff, torn the same way. World 0207 and ours agree.' },
];

// ---------------------------------------------------------------------------------------------------------------------
// Cast (registerCast never overwrites an existing id). Every look carries era, sex/age and a COSTUMES.md archetype.
// ---------------------------------------------------------------------------------------------------------------------
export const KID_KAI = { era: '2026', costume: 'kid_kai', sex: 0, height: 1.22, build: 0.82, age: 7, skin: 0xb98463, hair: 0x15100c, hairStyle: 'messy', eyes: 0x3d2a18, topType: 'jacket', hood: true, top: 0x2a4a6a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2f3a4e, shoes: 'shoes', boots: 0x3a2a1a };
export const KID_MIRA = { era: '2026', costume: 'kid_mira', sex: 1, female: true, height: 1.36, build: 0.84, age: 10, skin: 0xd9a585, hair: 0x120d0b, hairStyle: 'bob', eyes: 0x2f4a3a, topType: 'sweater', top: 0x6a2a3a, topKind: 'fabric', pantsType: 'trousers', pants: 0x1f2227, shoes: 'shoes', boots: 0x3a2a1a };
const MOTHER = { era: '2026', costume: 'c26_f2', sex: 1, female: true, age: 38, height: 1.68, build: 0.98, skin: 0xc8916c, hair: 0x1e1612, hairStyle: 'bob', eyes: 0x3d2a18,
  face: { jaw: -0.2, cheek: 0.35, nose: 0.05, noseWidth: 0.0, lips: 0.2, brow: 0.0, eyeSize: 0.15, faceLength: 0.1, chin: -0.1 },
  topType: 'jacket', top: 0x4a5a6a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2a2e36, shoes: 'shoes', boots: 0x2a1d14 };
export const VISITORS_2026 = [
  { era: '2026', costume: 'c26_m2', sex: 0, age: 41, height: 1.79, build: 1.05, skin: 0xe0b394, hair: 0x3a2418, hairStyle: 'short', topType: 'jacket', top: 0x2e3a4c, topKind: 'fabric', pantsType: 'trousers', pants: 0x2a3040, shoes: 'shoes', boots: 0x1a1410, lod: true },
  { era: '2026', costume: 'c26_f1', sex: 1, female: true, age: 22, height: 1.66, build: 0.92, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'tied-back', topType: 'sweater', top: 0xbcb19c, topKind: 'fabric', pantsType: 'trousers', pants: 0x2e3a4c, shoes: 'shoes', boots: 0xe6e2da, lod: true },
  { era: '2026', costume: 'c26_m3', sex: 0, age: 67, height: 1.72, build: 1.0, skin: 0xd8b08e, hair: 0xb8b4ae, hairStyle: 'short', topType: 'jacket', top: 0x4a4a32, topKind: 'fabric', pantsType: 'trousers', pants: 0x5a4a3a, shoes: 'shoes', boots: 0x2a1d14, lod: true },
  { era: '2026', costume: 'c26_f3', sex: 1, female: true, age: 63, height: 1.62, build: 1.02, skin: 0xf1c6a8, hair: 0x9a948a, hairStyle: 'bob', topType: 'jacket', top: 0x6a2a3a, topKind: 'fabric', pantsType: 'trousers', pants: 0x1d2430, shoes: 'shoes', boots: 0x2a1d14, lod: true },
];
export function registerM16Cast() {
  registerCast('edie', {
    name: 'EDIE LARK', role: 'Keeper · the Museum of Failed Worlds',
    bio: 'Came out of the dark under the Hollow Archive in 2151, nine years old, holding a music box, from a Rain City that had a sea wall and no Helix. She has kept the strays ever since. She is catalogued, too.',
    look: { era: '2196', costume: 'surv_f2', sex: 1, female: true, age: 54, height: 1.64, build: 0.92, skin: 0xd9a585, hair: 0x7a6a5a, hairStyle: 'bun', eyes: 0x4a6a5a, freckles: 0.3,
      face: { jaw: -0.1, cheek: 0.3, nose: -0.05, noseWidth: 0.05, lips: 0.1, brow: -0.15, eyeSize: 0.2, faceLength: 0.05, chin: -0.05 },
      topType: 'jacket', top: 0x5a4e44, topKind: 'fabric', coat: 0x6a5a48, coatKind: 'fabric', vest: 0x3e3a30, pantsType: 'trousers', pants: 0x4a4436, shoes: 'boots', boots: 0x2a2018, wrinkles: 0.45 },
    rimColor: 0xffd8a0, glow: 0x2a1c10, bg: 0x100c08,
    vp: { sex: 'f', pitch: 1.06, rate: 0.95, langs: ['en-IE', 'en-AU', 'en-GB'] },
  });
  registerCast('mara', {
    name: 'MARA QUILL', role: 'Archivist · the Second Archive, Harrow Reach',
    bio: 'Keeps the records the official archive will not: testimonies that disagree.',
    look: { era: '2196', costume: 'mara', sex: 1, female: true, age: 61, height: 1.62, build: 0.86, skin: 0xe0b8a0, hair: 0xb8b4ae, hairStyle: 'short', eyes: 0x4a5a6a, glasses: true,
      face: { jaw: -0.2, cheek: 0.1, nose: 0.1, noseWidth: -0.05, lips: -0.1, brow: -0.1, eyeSize: 0.05, faceLength: 0.05, chin: -0.1 },
      topType: 'jacket', top: 0x2a2a28, topKind: 'fabric', coat: 0x6a6a64, coatKind: 'fabric', hood: true, pantsType: 'trousers', pants: 0x8a7458, shoes: 'boots', boots: 0x3a2a1c, wrinkles: 0.7 },
    rimColor: 0xb6ff8a, glow: 0x14180e, bg: 0x0e0e0c,
    vp: { sex: 'f', pitch: 0.92, rate: 0.94, langs: ['en-GB', 'en-IE', 'en-US'] },
  });
  registerCast('mother', { name: 'ELENA VAREN', role: 'Memory · 19.10.2026', look: { ...MOTHER }, vp: { sex: 'f', pitch: 1.0, rate: 0.9, langs: ['en-GB', 'en-US'] } });
  registerCast('m16kai7', { name: 'KAI, 7', role: 'Memory · 19.10.2026', look: { ...KID_KAI }, rimColor: 0xffd8a0, vp: { sex: 'm', pitch: 1.5, rate: 1.1, langs: ['en-GB', 'en-US'] } });
  registerCast('m16mira10', { name: 'MIRA, 10', role: 'Memory · 19.10.2026', look: { ...KID_MIRA }, rimColor: 0x9a7bff, glow: 0x23183a, vp: { sex: 'f', pitch: 1.42, rate: 1.04, langs: ['en-GB', 'en-US'] } });
  registerCast('m16desk', { name: 'HELIX FRONT DESK', role: 'Memory · open day, 2026',
    look: { era: '2026', costume: 'c26_f2', sex: 1, female: true, age: 47, height: 1.66, build: 1.0, skin: 0x6b4029, hair: 0x15100b, hairStyle: 'tied-back', topType: 'jacket', top: 0x1d2430, topKind: 'fabric', pantsType: 'trousers', pants: 0x18191d, shoes: 'shoes', boots: 0x18191d, glasses: true },
    vp: { sex: 'f', pitch: 0.98, rate: 1.02, langs: ['en-GB', 'en-US'] } });
  registerCast('m16guide', { name: 'HELIX GUIDE', role: 'Memory · open day, 2026',
    look: { era: '2026', costume: 'c26_m1', sex: 0, age: 29, height: 1.78, build: 0.95, skin: 0xe8b996, hair: 0x5a3a22, hairStyle: 'swept', topType: 'jacket', top: 0x2a3a4e, topKind: 'fabric', coat: 0xe8e6e0, coatKind: 'fabric', pantsType: 'trousers', pants: 0x3a3a3a, shoes: 'shoes', boots: 0x1a1410 },
    vp: { sex: 'm', pitch: 1.04, rate: 1.06, langs: ['en-US', 'en-GB'] } });
  registerCast('m16miraold', { name: 'MIRA VAREN', role: 'World 0412 · residue',
    look: { ...(CAST.mira?.look || {}), role: 'mira', era: '2049', costume: 'mira', age: 58, hair: 0x8a8580, hairStyle: 'bob', wrinkles: 0.55, armor: false },
    rimColor: 0x9a7bff, glow: 0x23183a, vp: { sex: 'f', pitch: 0.98, rate: 0.9, langs: ['en-GB', 'en-US'] } });
  registerCast('m16kaiold', { name: 'KAI VAREN', role: 'World 0412 · photograph',
    look: { ...(CAST.witness?.look || {}), role: 'witness', era: '2049', costume: 'witness', age: 55, scar: false, wrinkles: 0.5 },
    rimColor: 0xffd8a0, glow: 0x2a1c10, vp: { sex: 'm', pitch: 0.86, rate: 0.92, langs: ['en-GB', 'en-US'] } });
  registerCast('m16band', { name: 'CHRONOLITH BAND', role: 'Kai\'s wrist', voice: true, vp: { sex: 'f', pitch: 1.18, rate: 1.06, langs: ['en-US', 'en-GB'] } });
  registerCast('m16radio', { name: 'RADIO · RAIN CITY', role: 'Memory · 19.10.2026, 08:11', voice: true, vp: { sex: 'm', pitch: 0.94, rate: 1.04, langs: ['en-GB', 'en-US'] } });
  registerCast('m16rec', { name: 'THE FOUNDER', role: 'Recording · the study', portraitOf: 'witness', voice: true, vp: { sex: 'm', pitch: 0.8, rate: 0.88, langs: ['en-GB', 'en-US'] } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Music. Act III / the museum: grief held still; the memories: Kai's childhood in warm piano and flute; the stacks:
// a slow pulse under ticking; the photograph: Mira's three notes (E-B-A).
// ---------------------------------------------------------------------------------------------------------------------
export const musicState = { found: 0 };
export function registerM16Themes() {
  registerTheme('m16-museum', { bpm: 60, step(a, s, t, d) {           // the museum: low strings, far glass, a music box that forgets its tune
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 62], [40, 47, 52, 59]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.014, 480); a.cello(ch[0] - 12, t, d * 16, 0.028); }
    if (b === 4 || (b === 10 && bar % 2)) a.pluck([81, 79, 76, 74][(bar + (b >> 2)) % 4], t, 0.025);
    if (b === 8 && bar % 2 === 0) a.piano(ch[2] + 12, t, 0.05, 3.4);
    if (b === 14 && bar % 4 === 3) a.glass(ch[3] + 24, t, 0.008);
    if (musicState.found > 1 && b === 12 && bar % 2 === 1) a.flute(ch[1] + 12, t, d * 4, 0.01);
  } });
  registerTheme('m16-store', { bpm: 56, step(a, s, t, d) {            // 2049, Store B-3: fluorescent and far away
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0 && bar % 2 === 0) a.pad([57, 64, 69, 71], t, d * 32, 0.01, 1300);
    if (b === 0) a.glass([86, 84, 83, 81][bar % 4], t, 0.009);
    if (b % 8 === 4) a.tick(t, 0.006, 7000);
  } });
  registerTheme('m16-memory', { bpm: 74, step(a, s, t, d) {           // a memory: a Sunday morning in 2026, warm and a little too bright
    const bar = Math.floor(s / 16), b = s % 16, ch = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]][bar % 4];
    if (b === 0) a.pad(ch, t, d * 16, 0.013, 900);
    if (b % 2 === 0) a.piano(ch[(b >> 1) % 4] + 12 + (b > 7 ? 12 : 0), t, 0.035, 1.6);
    if (b === 6 && bar % 2 === 0) a.flute(ch[3] + 12, t, d * 6, 0.012);
    if (b === 14 && bar % 4 === 3) a.glass(88, t, 0.008);
  } });
  registerTheme('m16-rain', { bpm: 66, step(a, s, t, d) {             // world 0388: the rain morning in the kitchen
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57, 60], [43, 50, 55, 58], [41, 48, 53, 57], [40, 47, 52, 56]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.013, 520); a.cello(ch[0] - 12, t, d * 16, 0.026); }
    if (b % 4 === 0) a.tick(t, 0.01, 2400);
    if (b === 3 || b === 11) a.piano(ch[2] + 12, t, 0.045, 2.4);
  } });
  registerTheme('m16-814', { bpm: 50, step(a, s, t, d) {              // 08:14: everything holds its breath
    const b = s % 16;
    if (b === 0) { a.pad([40, 47, 52, 59], t, d * 16, 0.018, 360); a.cello(28, t, d * 16, 0.05); }
    if (b === 8) a.glass(76, t, 0.012);
  } });
  registerTheme('m16-stacks', { bpm: 88, step(a, s, t, d) {           // the stacks: the unmaking sweeps the aisle
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([38, 45, 50], t, d * 16, 0.014, 300); a.cello(26, t, d * 16, 0.04); }
    if (b % 4 === 0) a.tick(t, 0.012, 3000);
    if (b === 8) a.drum(t, 0.05, 70, 32);
    if (b === 14 && bar % 2) a.pluck(62, t, 0.03);
  } });
  registerTheme('m16-reveal', { bpm: 62, step(a, s, t, d) {           // Accession Zero: cello and piano
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57, 60], [41, 48, 53, 57], [38, 45, 50, 53], [40, 47, 52, 56]][bar % 4];
    if (b === 0) { a.pad(ch, t, d * 16, 0.015, 420); a.cello(ch[0] - 12, t, d * 16, 0.05); }
    if (b === 0 || b === 6 || b === 10) a.piano(ch[(b / 2 | 0) % 4] + 12, t, 0.07, 3.2);
  } });
  registerTheme('m16-photo', { bpm: 58, step(a, s, t, d) {            // the photograph: Mira's three notes, E-B-A
    const bar = Math.floor(s / 16), b = s % 16, ch = [[45, 52, 57, 64], [41, 48, 57, 60], [43, 50, 55, 59], [45, 52, 57, 61]][bar % 4];
    if (b === 0) a.pad(ch, t, d * 16, 0.016, 700);
    if (b === 0) a.piano(76, t, 0.08, 3); if (b === 4) a.piano(71, t, 0.07, 3); if (b === 8) a.piano(69, t, 0.08, 5);
    if (b === 12 && bar % 2) a.flute(64, t, d * 4, 0.012);
  } });
  registerTheme('m16-founder', { bpm: 54, step(a, s, t, d) {          // the Founder's study: a count that never ends
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([33, 40, 45, 52, 57], t, d * 16, 0.016, 380); a.cello(33, t, d * 16, 0.045); }
    if (b % 4 === 0) a.glass(81 - (bar % 3) * 2, t, 0.007 + (b === 0 ? 0.004 : 0));
    if (b === 10 && bar % 2 === 0) a.piano(64, t, 0.05, 4);
  } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Code-drawn documents, labels, signs
// ---------------------------------------------------------------------------------------------------------------------
const grain = (g, w, h, n, a, seed = 3) => { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * a})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } };
const wrap = (g, text, x, y, maxW, lh) => { const words = String(text).split(' '); let line = '', yy = y; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; } if (line) g.fillText(line, x, yy); return yy; };
const vignette = (g, w, h, a = 0.35) => { const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(70,40,15,${a})`); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
const hand = (g, x, y, s, rot, left, col) => {   // a palm print: palm, four fingers, thumb
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(left ? -s : s, s); g.fillStyle = col;
  g.beginPath(); g.ellipse(0, 0, 26, 32, 0, 0, 7); g.fill();
  [[-18, -48, 7, 22], [-6, -56, 7, 26], [7, -54, 7, 25], [19, -44, 6, 19]].forEach(([fx, fy, rx, ry]) => { g.beginPath(); g.ellipse(fx, fy, rx, ry, (fx / 90), 0, 7); g.fill(); });
  g.beginPath(); g.ellipse(32, -2, 7, 17, -0.8, 0, 7); g.fill(); g.restore();
};
export const TEX = {
  label: (lines, o = {}) => canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = o.bg || '#e6dcc2'; g.fillRect(0, 0, w, h); grain(g, w, h, 700, 0.07, lines[0].length + 7); vignette(g, w, h, 0.3);
    g.strokeStyle = 'rgba(60,40,20,.5)'; g.lineWidth = 3; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = o.ink || '#2a2018'; g.font = `700 25px ${o.founder ? HAND : FONT}`; wrap(g, lines[0], 30, 52, w - 60, 28);
    g.font = o.founder ? `500 30px ${HAND}` : `500 27px ${HAND}`; let y = 104;
    for (const l of lines.slice(1)) y = wrap(g, l, 30, y, w - 60, 32) + 36;
  }, 'm16label' + lines.join('|') + (o.key || '')),
  sign: (t, sub, o = {}) => canvasTex(1024, 192, (g, w, h) => {
    g.fillStyle = o.bg || '#2a221a'; g.fillRect(0, 0, w, h); grain(g, w, h, 1600, 0.1, t.length + 3);
    g.strokeStyle = o.rule || 'rgba(230,210,170,.4)'; g.lineWidth = 5; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = o.fg || '#ecdcb8'; g.textAlign = 'center'; g.font = `600 ${o.size || 70}px ${o.font || SERIF}`; g.fillText(t, w / 2, sub ? 96 : 120);
    if (sub) { g.font = `500 32px ${o.subFont || SERIF}`; g.globalAlpha = 0.75; g.fillText(sub, w / 2, 152); }
  }, 'm16sign' + t + sub + (o.key || '')),
  stencil: (t, sub) => canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = '#c8ccd0'; g.fillRect(0, 0, w, h); grain(g, w, h, 500, 0.05, 9);
    g.fillStyle = '#e8c020'; g.fillRect(0, 0, w, 24); g.fillStyle = '#1a1c20'; for (let x = 0; x < w; x += 40) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x + 20, 0); g.lineTo(x + 34, 0); g.lineTo(x + 14, 24); g.fill(); }
    g.fillStyle = '#1b1e23'; g.font = `700 46px ${FONT}`; g.fillText(t, 22, 84); if (sub) { g.font = `600 22px ${FONT}`; g.fillStyle = '#3a4048'; g.fillText(sub, 22, 128); }
  }, 'm16sten' + t + sub),
  crateLabel: (t) => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d2a44'; g.fillRect(0, 0, w, 40);
    g.fillStyle = '#fff'; g.font = `700 20px ${FONT}`; g.fillText('RAIN CITY CIVIC MUSEUM · STORE B-3', 16, 28);
    g.fillStyle = '#1b1e23'; g.font = `700 26px ${FONT}`; wrap(g, t, 16, 84, w - 32, 32);
    g.fillStyle = '#5a6066'; g.font = `500 18px ${FONT}`; g.fillText('Reserve collection · handle with gloves', 16, 226);
    for (let i = 0; i < 26; i++) g.fillRect(360 + i * 5, 190, i % 3 ? 2 : 3, 46);
  }, 'm16crate' + t),
  badge: (name, sub, scorched) => canvasTex(256, 384, (g, w, h) => {
    g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0e3a5a'; g.fillRect(0, 0, w, 86); g.fillStyle = '#ffffff'; g.font = `700 30px ${FONT}`; g.fillText('HELIX', 22, 52); g.font = `500 14px ${FONT}`; g.fillText('TEMPORAL RESEARCH', 22, 74);
    g.fillStyle = '#e8c020'; g.fillRect(0, 86, w, 34); g.fillStyle = '#1a1c20'; g.font = `700 18px ${FONT}`; g.fillText('OPEN DAY · 19.10.2026', 18, 110);
    g.fillStyle = '#1b1e23'; g.font = `700 34px ${FONT}`; g.fillText(name, 18, 190); g.font = `600 22px ${FONT}`; g.fillStyle = '#3a4048'; g.fillText('VISITOR', 18, 226); if (sub) g.fillText(sub, 18, 258);
    g.font = `500 18px ${FONT}`; g.fillText('Issued 08:02 · front desk', 18, 330);
    if (scorched) { const gr = g.createRadialGradient(w, 0, 10, w, 0, 170); gr.addColorStop(0, 'rgba(20,10,4,1)'); gr.addColorStop(0.45, 'rgba(60,30,10,.85)'); gr.addColorStop(1, 'rgba(120,70,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  }, 'm16badge' + name + sub + scorched),
  deskLog: (two) => canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#ecebe4'; g.fillRect(0, 0, w, h); grain(g, w, h, 500, 0.04, 31);
    g.fillStyle = '#1b1e23'; g.font = `700 22px ${FONT}`; g.fillText('HELIX TEMPORAL RESEARCH · FRONT DESK', 24, 40); g.fillRect(24, 52, w - 48, 2);
    g.font = `600 18px ${FONT}`; g.fillText('OPEN DAY · SUNDAY 19.10.2026 · VISITOR BADGES', 24, 82);
    const rows = [['07:58', 'R. OYELARAN', 'VISITOR'], ['08:01', 'H. + J. MORROW', 'VISITOR ×2'], ['08:02', 'E. VAREN', 'ESCORT'], ['08:02', 'M. VAREN', 'VISITOR'], ...(two ? [['08:02', 'K. VAREN', 'VISITOR · ACCOMPANIED']] : []), ['08:05', 'T. ADEYEMI', 'PRESS']];
    g.font = `500 20px ${HAND}`; rows.forEach((r, i) => { const y = 124 + i * 36; g.fillText(r[0], 30, y); g.fillText(r[1], 110, y); g.fillText(r[2], 300, y); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(24, y + 10, w - 48, 1); g.fillStyle = '#1b1e23'; });
    if (two) { g.strokeStyle = 'rgba(200,40,30,.7)'; g.lineWidth = 3; g.beginPath(); g.ellipse(200, 124 + 4 * 36 - 7, 186, 20, 0, 0, 7); g.stroke(); }
  }, 'm16log' + two),
  pressPhoto: () => canvasTex(512, 384, (g, w, h) => {
    const r = rng(77);
    const sky = g.createLinearGradient(0, 0, 0, h * 0.6); sky.addColorStop(0, '#cfd6d8'); sky.addColorStop(1, '#f4ecd8'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,40,40,.85)'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 6, h * 0.62);          // atrium mullions
    g.fillStyle = '#8a8478'; g.fillRect(0, h * 0.62, w, h * 0.38);
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 22; g.beginPath(); g.arc(w / 2, h * 0.42, 86, 0, 7); g.stroke();
    for (let i = 0; i < 26; i++) { const x = r() * w, s = 0.6 + r() * 0.7, y = h * 0.66 + r() * 70; g.fillStyle = `rgba(${20 + r() * 40},${20 + r() * 30},${20 + r() * 30},.9)`; g.beginPath(); g.arc(x, y - 52 * s, 9 * s, 0, 7); g.fill(); g.fillRect(x - 10 * s, y - 42 * s, 20 * s, 46 * s); }
    g.fillStyle = 'rgba(255,240,200,.25)'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.fillRect(0, h - 40, w, 40); g.fillStyle = '#1b1e23'; g.font = `600 16px ${FONT}`; g.fillText('HELIX PRESS · OPEN DAY · 19.10.2026 · 08:09 · DRY, 14°C · photo T. Adeyemi', 12, h - 14);
  }, 'm16press'),
  clock: (hh, mm, cracked) => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#efe8d6'; g.beginPath(); g.arc(128, 128, 122, 0, 7); g.fill(); g.strokeStyle = '#c84a2a'; g.lineWidth = 10; g.stroke();
    g.fillStyle = '#2a2018'; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.fillRect(128 + Math.sin(a) * 100 - 3, 128 - Math.cos(a) * 100 - 9, 6, 18); }
    const ha = ((hh % 12) + mm / 60) / 12 * Math.PI * 2, ma = mm / 60 * Math.PI * 2;
    g.lineCap = 'round'; g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(ha) * 58, 128 - Math.cos(ha) * 58); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(ma) * 90, 128 - Math.cos(ma) * 90); g.stroke();
    g.font = `600 18px ${FONT}`; g.textAlign = 'center'; g.fillText('VAREN', 128, 184);
    if (cracked) { g.strokeStyle = 'rgba(30,20,10,.8)'; g.lineWidth = 2; const r = rng(5); for (let k = 0; k < 6; k++) { g.beginPath(); let x = 150, y = 90; g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); } }
  }, 'm16clock' + hh + ':' + mm + cracked),
  hands: () => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.filter = 'blur(3px)';
    hand(g, 236, 150, 0.95, -0.2, false, 'rgba(255,200,140,.9)');          // Mira, ten: right hand, over
    hand(g, 278, 168, 0.62, 0.15, true, 'rgba(140,220,255,.9)');           // Kai, seven: left hand, under
    g.filter = 'none';
  }, 'm16hands'),
  ledger: () => canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = '#ddd0b0'; g.fillRect(0, 0, w, h); grain(g, w, h, 1500, 0.08, 51); vignette(g, w, h, 0.35);
    g.fillStyle = '#2a2018'; g.font = `700 24px ${FONT}`; g.fillText('REGISTER OF WORLDS · STACKS', 24, 42); g.fillRect(24, 54, w - 48, 2);
    g.font = `600 17px ${FONT}`; g.fillText('WORLD', 26, 84); g.fillText('ENDED', 120, 84); g.fillText('SHE REACHED', 260, 84); g.fillText('SHELF', 420, 84);
    const rows = [['0001', '08:14:09', '10 y', 'A-01'], ['0031', '08:14:09', '10 y', 'A-03'], ['0119', '08:15:40', '10 y 1 d', 'B-11'], ['0207', '08:14:09', '10 y', 'B-20'], ['0388', '08:14:00', '10 y', 'C-02'],
      ['0401', '19.10.2027', '11 y', 'C-08'], ['0412', '—', '58 y', 'STUDY'], ['0640', '08:15:40', '10 y 1 d', 'D-04'], ['0733', '08:14:09', '10 y', 'D-19'], ['0912', '03.11.2026', '10 y 15 d', 'E-02'], ['1046', '08:14:09', '10 y', 'F-30']];
    g.font = `500 22px ${HAND}`;
    rows.forEach((r, i) => { const y = 122 + i * 42; const hi = r[0] === '0412'; g.fillStyle = hi ? '#7a1a10' : '#2a2018'; g.fillText(r[0], 26, y); g.fillText(r[1], 120, y); g.fillText(r[2], 260, y); g.fillText(r[3], 420, y); if (hi) { g.strokeStyle = 'rgba(122,26,16,.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(70, y - 7, 52, 18, 0, 0, 7); g.stroke(); } });
    g.fillStyle = '#2a2018'; g.font = `500 21px ${HAND}`; g.fillText('…1,046 worlds. One of them ours. — K.', 26, h - 34);
  }, 'm16ledger'),
  register: () => canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = '#d8cca8'; g.fillRect(0, 0, w, h); grain(g, w, h, 1500, 0.08, 61); vignette(g, w, h, 0.4);
    g.fillStyle = '#2a2018'; g.font = `600 22px ${HAND}`;
    const r = rng(9); let y = 36;
    for (let i = 0; i < 17; i++) { const n = 1030 + i; const age = n === 1046 ? '10 y' : ['10 y', '10 y', '10 y 1 d', '10 y', '11 y'][Math.floor(r() * 5)]; g.fillText(`${n} · 19.10.2026 · ${age} · ${['same', 'reached first', 'rain', 'same', 'tried the hospital'][Math.floor(r() * 5)]}`, 22, y); y += 34; }
    g.font = `700 26px ${HAND}`; g.fillStyle = '#5a1a10'; g.fillText('1047 · this one · Kai, 32 · ………', 22, y + 10);
  }, 'm16register'),
  combo: (n) => canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#1a1612'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8c890'; g.font = `700 64px ${FONT}`; g.textAlign = 'center'; g.fillText(n, w / 2, 86); }, 'm16combo' + n),
  caseCard: () => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#e6dcc2'; g.fillRect(0, 0, w, h); grain(g, w, h, 600, 0.07, 71);
    g.fillStyle = '#2a2018'; g.font = `700 30px ${HAND}`; g.fillText('ACCESSION 1047', 26, 56);
    g.font = `600 28px ${HAND}`; g.fillText('This world. K. Varen, 32.', 26, 110); g.fillText('Pending.', 26, 160);
    g.font = `500 22px ${HAND}`; g.fillStyle = '#5a4a3a'; g.fillText('(leave room for the coat)', 26, 214);
  }, 'm16casecard'),
  banner: () => canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#0e3a5a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8c020'; g.fillRect(0, h - 26, w, 26);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.font = `700 88px ${FONT}`; g.fillText('OPEN DAY', w / 2, 112);
    g.font = `600 36px ${FONT}`; g.fillText('HELIX TEMPORAL RESEARCH · SUNDAY 19 OCTOBER 2026', w / 2, 178);
  }, 'm16banner'),
  helixSign: () => canvasTex(512, 160, (g, w, h) => { g.fillStyle = '#e8eaec'; g.fillRect(0, 0, w, h); g.fillStyle = '#0e3a5a'; g.font = `700 70px ${FONT}`; g.fillText('HELIX', 26, 90); g.font = `600 22px ${FONT}`; g.fillText('TEMPORAL RESEARCH · RECEPTION', 28, 130); }, 'm16helix'),
  artefactSign: () => canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#0e3a5a'; g.fillRect(0, 0, 12, h); g.fillStyle = '#1b1e23'; g.font = `700 30px ${FONT}`; g.fillText('SITE ZERO ARTEFACT', 30, 56); g.font = `500 20px ${FONT}`; g.fillStyle = '#3a4048'; wrap(g, 'Recovered beneath the Helix site in 2024. Age unknown. Please stay behind the rope. Do not touch the ring.', 30, 96, w - 56, 28); }, 'm16art'),
  window: (rain) => canvasTex(256, 256, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, rain ? '#5a6672' : '#bcd8ee'); s.addColorStop(1, rain ? '#8a949a' : '#f6ead0'); g.fillStyle = s; g.fillRect(0, 0, w, h);
    g.fillStyle = rain ? '#3a424a' : '#8a9aa8'; const r = rng(rain ? 4 : 3); for (let x = 0; x < w; x += 18 + r() * 20) { const bh = 40 + r() * 90; g.fillRect(x, h - bh, 14 + r() * 14, bh); }
    if (rain) { g.fillStyle = '#ffcf80'; g.fillRect(150, 160, 4, 4); g.fillRect(190, 150, 3, 3); g.strokeStyle = 'rgba(220,230,240,.35)'; g.lineWidth = 1; for (let k = 0; k < 120; k++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 10); g.stroke(); } }
  }, 'm16win' + rain),
  photoFrame: () => canvasTex(512, 384, (g, w, h) => { g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, w, h); g.fillStyle = '#6a5a48'; g.font = `500 26px ${HAND}`; g.textAlign = 'center'; g.fillText('(face down)', w / 2, h / 2); }, 'm16photoback0'),
  photoBack: () => canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#ece4d0'; g.fillRect(0, 0, w, h); grain(g, w, h, 600, 0.06, 81);
    g.fillStyle = '#2a2a4a'; g.font = `600 32px ${HAND}`; wrap(g, 'We had a thousand chances. We only needed one that was ours.', 30, 90, w - 60, 40);
    g.font = `500 26px ${HAND}`; g.fillText('M. & K. · Haldane sea wall · 2074', 30, 280); g.fillText('(world 0412)', 30, 320);
  }, 'm16photoback'),
  edieCard: () => canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#e8dfc8'; g.fillRect(0, 0, w, h); grain(g, w, h, 600, 0.07, 91);
    g.fillStyle = '#2a2018'; g.font = `700 24px ${FONT}`; g.fillText('ACCESSION 0640 · A GIRL, NINE', 24, 46); g.fillRect(24, 58, w - 48, 2);
    g.font = `500 26px ${HAND}`; let y = 98; for (const l of ['Living. Came out of the dark under the', 'stair, 11.03.2151, holding one music box.', 'World 0640: Rain City with a sea wall.', 'Box: Stacks D-04, kept for her. — K.']) { g.fillText(l, 24, y); y += 40; }
  }, 'm16ediecard'),
};
// the photograph of world 0412: two portraits (data URLs from renderPortraits) on a warm print with a sea wall
export function photoTexture(urlA, urlB) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 384; const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const base = () => {
    const s = g.createLinearGradient(0, 0, 0, 384); s.addColorStop(0, '#9cb4c4'); s.addColorStop(0.55, '#e8d8b8'); s.addColorStop(1, '#7a6a56'); g.fillStyle = s; g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#5a6a74'; g.fillRect(0, 150, 512, 40);   // the sea
    g.fillStyle = '#8a7a66'; g.fillRect(0, 300, 512, 84);   // the wall
  };
  base();
  const draw = [];
  const finish = () => {
    for (const d of draw) if (d.img.complete && d.img.naturalWidth) { g.save(); g.beginPath(); g.ellipse(d.x + 115, d.y + 125, 112, 138, 0, 0, 7); g.clip(); g.drawImage(d.img, 0, 0, d.img.naturalWidth, d.img.naturalHeight, d.x, d.y, 230, 250); g.restore(); }
    g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(255,220,170,.5)'; g.fillRect(0, 0, 512, 384); g.globalCompositeOperation = 'source-over';
    vignette(g, 512, 384, 0.55); grain(g, 512, 384, 2500, 0.08, 4);
    g.fillStyle = 'rgba(250,245,235,1)'; g.fillRect(0, 0, 512, 10); g.fillRect(0, 374, 512, 10); g.fillRect(0, 0, 10, 384); g.fillRect(502, 0, 10, 384);
    tex.needsUpdate = true;
  };
  [[urlA, 40, 70], [urlB, 240, 82]].forEach(([u, x, y]) => { if (!u) return; const img = new Image(); img.onload = () => { base(); finish(); }; img.src = u; draw.push({ img, x, y }); });
  finish();
  return tex;
}

// ---------------------------------------------------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------------------------------------------------
export function buildMuseum(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low';
  const W = { lightSrc: [], exhibits: [], trays: [], crates: [], lids: [], cases: [], doors: {}, mem: {}, glows: [] };
  const col = game.collision, R = rng(1616);
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  const M = {
    brick: pm('brick', { color: 0x6a3a28, soot: 0.7 }),
    brickPale: pm('brick', { color: 0x8a5a40, soot: 0.4 }),
    flags: pm('cutStone', { color: 0x8a8070, weathering: 0.8, rows: 3 }),
    stone: pm('cutStone', { color: 0xa09482, weathering: 0.6, rows: 4 }),
    plaster: pm('plaster', { color: 0xa89a82, damage: 0.3, dirt: 0.6 }),
    conc49: pm('concrete', { color: 0x8c8e90, formwork: 1, stains: 0.25 }),
    floor49: pm('concrete', { color: 0x6c7074, slabs: 1, stains: 0.2, formwork: 0 }),
    wood: pm('wood', { color: 0x5a3c24, planks: 6, weathered: 0.5 }),
    woodDark: pm('wood', { color: 0x3a2618, planks: 4, weathered: 0.3 }),
    steel: pm('brushedMetal', { color: 0x7a7e82, roughness: 0.45 }),
    steelDark: pm('brushedMetal', { color: 0x3a3e44, roughness: 0.5 }),
    rust: pm('rust', { color: 0x5a2a12, paint: 0x2e3a3e, amount: 0.7 }),
    tileHelix: pm('ceramicTile', { color: 0xd8d8d4, grout: 0x9a9a96, count: 2, gloss: 0.85, variation: 0.06 }),
    kitchenTile: pm('ceramicTile', { color: 0xc8c0a8, grout: 0x8a8270, count: 6, gloss: 0.6, variation: 0.2 }),
    paint26: new THREE.MeshStandardMaterial({ color: 0xdedcd6, roughness: 0.88 }),
    kitchenWall: new THREE.MeshStandardMaterial({ color: 0xcdbb94, roughness: 0.9 }),
  };
  const mat = (c, r = 0.8, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
  const dark = mat(0x14120f, 0.95), cloth = mat(0x5a2a22, 0.95, 0, { side: THREE.DoubleSide }), cloth2 = mat(0x2a3a3a, 0.95, 0, { side: THREE.DoubleSide });
  const crateMat = mat(0x8a9096, 0.6, 0.3), crateDark = mat(0x40464c, 0.6, 0.3), cardboard = mat(0x9a7a52, 0.95), paperMat = mat(0xd8ccb0, 0.9), brass = mat(0xb08a4a, 0.35, 0.8);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xc8d4d0, roughness: 0.06, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const amber = glowMat(0xffc27a, 2.4), cool = glowMat(0xe8f4ff, 2.6);
  W.mats = { amber, cool, dark };
  const S = { common: new Batch(), '2049': new Batch(), '2196': new Batch() };
  const g49 = new THREE.Group(), g96 = new THREE.Group(); scene.add(g49, g96); T.only(g49, '2049'); T.only(g96, '2196');
  const G = { '2049': g49, '2196': g96 }; W.groups = G;
  const box = (x0, y0, z0, x1, y1, z1, states) => col.add([Math.min(x0, x1), y0, Math.min(z0, z1)], [Math.max(x0, x1), y1, Math.max(z0, z1)], states ? { states } : {});
  const src = (x, y, z, c, i, d, era = 'all') => W.lightSrc.push({ p: [x, y, z], c, i, d, era });
  const plane = (tex, w, h, x, y, z, ry, parent = scene, emiss = 0.2, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emiss, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.order = 'YXZ'; m.rotation.set(rx, ry, 0); parent.add(m); return m;
  };
  const wallX = (B, mtl, z, x0, x1, y0, y1, t, gaps = [], states) => {
    let x = x0; const gs = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [a, b, top] of gs) { if (a > x) { B.box(mtl, x, y0, z - t / 2, a, y1, z + t / 2); box(x, y0, z - t / 2, a, y1, z + t / 2, states); } if (top < y1) { B.box(mtl, a, top, z - t / 2, b, y1, z + t / 2); box(a, top, z - t / 2, b, y1, z + t / 2, states); } x = b; }
    if (x < x1) { B.box(mtl, x, y0, z - t / 2, x1, y1, z + t / 2); box(x, y0, z - t / 2, x1, y1, z + t / 2, states); }
  };
  const wallZ = (B, mtl, x, z0, z1, y0, y1, t, gaps = [], states) => {
    let z = z0; const gs = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [a, b, top] of gs) { if (a > z) { B.box(mtl, x - t / 2, y0, z, x + t / 2, y1, a); box(x - t / 2, y0, z, x + t / 2, y1, a, states); } if (top < y1) { B.box(mtl, x - t / 2, top, a, x + t / 2, y1, b); box(x - t / 2, top, a, x + t / 2, y1, b, states); } z = b; }
    if (z < z1) { B.box(mtl, x - t / 2, y0, z, x + t / 2, y1, z1); box(x - t / 2, y0, z, x + t / 2, y1, z1, states); }
  };
  // the same wall in both eras: collision once, brick in 2196, painted concrete in 2049
  const wX = (z, x0, x1, y1, t, gaps) => { wallX(S['2196'], M.brick, z, x0, x1, 0, y1, t, gaps); const B = S['2049']; let x = x0; for (const [a, b, top] of [...(gaps || [])].sort((p, q) => p[0] - q[0])) { if (a > x) B.box(M.conc49, x, 0, z - t / 2, a, y1, z + t / 2); if (top < y1) B.box(M.conc49, a, top, z - t / 2, b, y1, z + t / 2); x = b; } if (x < x1) B.box(M.conc49, x, 0, z - t / 2, x1, y1, z + t / 2); };
  const wZ = (x, z0, z1, y1, t, gaps) => { wallZ(S['2196'], M.brick, x, z0, z1, 0, y1, t, gaps); const B = S['2049']; let z = z0; for (const [a, b, top] of [...(gaps || [])].sort((p, q) => p[0] - q[0])) { if (a > z) B.box(M.conc49, x - t / 2, 0, z, x + t / 2, y1, a); if (top < y1) B.box(M.conc49, x - t / 2, top, a, x + t / 2, y1, b); z = b; } if (z < z1) B.box(M.conc49, x - t / 2, 0, z, x + t / 2, y1, z1); };
  const C = S.common, B96 = S['2196'], B49 = S['2049'];

  // ================= floors, ceilings =================
  box(-22, -1, -62, 44, 0, 24);                                              // the museum floor
  B96.box(M.flags, -22, -0.2, -62, 44, 0, 24); B49.box(M.floor49, -22, -0.2, -62, 44, 0, 24);
  // yellow safety lines (2049) down the nave and the stacks aisle
  const yellow = mat(0xd8b020, 0.6);
  for (const x of [-3.6, 3.6]) B49.box(yellow, x - 0.06, 0, -34, x + 0.06, 0.012, 8);
  for (const z of [-45.2, -42.8]) B49.box(yellow, 11, 0, z - 0.06, 31, 0.012, z + 0.06);
  const ceil = (x0, z0, x1, z1, y) => { B96.box(M.brick, x0, y, z0, x1, y + 0.4, z1); B49.box(M.conc49, x0, y, z0, x1, y + 0.4, z1); };
  ceil(-9, 8, 9, 22, 5.4); ceil(-18.2, -7.2, -6, 5.2, 4.6); ceil(6, -7.2, 18.2, 5.2, 4.6); ceil(-18.2, -27.2, -6, -14.8, 4.6); ceil(6, -27.2, 18.2, -14.8, 4.6);
  ceil(11, -58.2, 31, -29.8, 6.0); ceil(31, -54.2, 41.2, -35.8, 4.2); ceil(9, -46.2, 11, -41.8, 3.6);
  // the nave: a brick barrel vault in 2196, a flat slab with strip lights in 2049
  {
    const vault = new THREE.CylinderGeometry(6, 6, 42.4, 28, 1, true, Math.PI / 2, Math.PI);
    vault.rotateX(Math.PI / 2); vault.scale(1, 0.48, 1); vault.translate(0, 4.4, -13);
    const vm = M.brick.clone(); vm.side = THREE.BackSide; vm.color?.setScalar?.(0.6);
    B96.push(vm, vault);
    for (let z = -32; z <= 6; z += 6.4) B96.geo(M.stone, new THREE.TorusGeometry(5.9, 0.16, 6, 24, Math.PI), [0, 4.4, z], [0, 0, 0], [1, 0.48, 1]);
    B49.box(M.conc49, -6, 6.2, -34, 6, 6.6, 8);
    for (let z = -30; z <= 6; z += 6) { B49.box(cool, -0.12, 6.1, z - 1.2, 0.12, 6.2, z + 1.2); src(0, 5.6, z, 0xe8f4ff, 5, 12, '2049'); }
    // the rotunda: a shallow dome over a drum
    const drum = new THREE.CylinderGeometry(8.7, 8.7, 6.2, 36, 1, true); drum.translate(0, 3.1, -44);
    const dm = M.brick.clone(); dm.side = THREE.BackSide; B96.push(dm, drum);
    const dm2 = M.conc49.clone(); dm2.side = THREE.BackSide; B49.push(dm2, drum.clone());
    const dome = new THREE.SphereGeometry(8.7, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.4, 1); dome.translate(0, 6.2, -44);
    B96.push(dm, dome); B49.push(dm2, dome.clone());
  }
  // ================= walls =================
  // entry stair well and its landing
  wZ(-2.2, 22, 34, 6.2, 0.4); wZ(2.2, 22, 34, 6.2, 0.4); wX(33.6, -2.2, 2.2, 6.2, 0.4);
  B96.box(M.brick, -2.2, 6.0, 22, 2.2, 6.4, 34); B49.box(M.conc49, -2.2, 6.0, 22, 2.2, 6.4, 34);
  for (let i = 0; i < 10; i++) { const y = 3 - i * 0.3, z0 = 30 - i * 0.8; C.box(M.stone, -2, y - 0.3, z0 - 0.8, 2, y, z0); box(-2, 0, z0 - 0.8, 2, y, z0); }
  C.box(M.stone, -2, 0, 30, 2, 3, 33.4); box(-2, 0, 30, 2, 3, 33.4);
  W.doors.top = C.box(M.woodDark, -1.0, 3, 33.3, 1.0, 5.2, 33.4);
  for (const x of [-1.95, 1.95]) C.cyl(brass, x, 3.9, 27, 0.04, 9, 6, [0.36, 0, 0]);          // handrails
  // the Keeper's hall
  wX(22, -9, 9, 5.4, 0.6, [[-2.2, 2.2, 5.4]]); wZ(-9, 8, 22, 5.4, 0.6); wZ(9, 8, 22, 5.4, 0.6);
  wX(8, -9, 9, 5.4, 0.6, [[-4, 4, 4.4]]);
  // the nave walls with the room doors
  wZ(-6, -34, 8, 6.2, 0.5, [[-3, 1, 3.0], [-23, -19, 3.0]]); wZ(6, -34, 8, 6.2, 0.5, [[-3, 1, 3.0], [-23, -19, 3.0]]);
  wX(-34, -6, 6, 6.2, 0.5, [[-2, 2, 3.4]]);
  // the four side rooms
  for (const [x0, x1, z0, z1] of [[-18.2, -6, -7.2, 5.2], [6, 18.2, -7.2, 5.2], [-18.2, -6, -27.2, -14.8], [6, 18.2, -27.2, -14.8]]) {
    wX(z0, x0, x1, 4.6, 0.4); wX(z1, x0, x1, 4.6, 0.4);
    if (x0 < 0) wZ(x0, z0, z1, 4.6, 0.4); else wZ(x1, z0, z1, 4.6, 0.4);
  }
  // the rotunda: a square of collision around the drum, corners filled
  wX(-35, -9, 9, 6.2, 0.4, [[-2, 2, 3.4]]); wX(-53, -9, 9, 6.2, 0.4); wZ(-9, -53, -35, 6.2, 0.4); wZ(9, -53, -35, 6.2, 0.4, [[-46, -42, 3.4]]);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let k = 0; k < 3; k++) { const cx = sx * (8.4 - k * 0.9), cz = -44 + sz * (6.6 + k * 0.9); box(cx - 0.9, 0, cz - 0.9, cx + 0.9, 6, cz + 0.9); }
  // the stacks hall and the corridor to it
  wX(-46.2, 9, 11, 3.6, 0.4); wX(-41.8, 9, 11, 3.6, 0.4);
  wX(-58.2, 11, 31, 6, 0.4); wX(-29.8, 11, 31, 6, 0.4); wZ(11, -58.2, -29.8, 6, 0.4, [[-45.5, -42.5, 3.2]]); wZ(31, -58.2, -29.8, 6, 0.4, [[-45.5, -42.5, 3.0]]);
  // the Founder's study
  wX(-54.2, 31, 41.2, 4.2, 0.4); wX(-35.8, 31, 41.2, 4.2, 0.4); wZ(41.2, -54.2, -35.8, 4.2, 0.4);
  wallZ(B96, M.plaster, 31.25, -54, -36, 0, 4.2, 0.1, [[-45.5, -42.5, 3.0]]); wallZ(B49, M.conc49, 31.25, -54, -36, 0, 4.2, 0.1, [[-45.5, -42.5, 3.0]]);

  // ================= the Keeper's hall =================
  {
    plane(TEX.sign('THE MUSEUM OF FAILED WORLDS', 'Please do not touch what you remember'), 7.2, 1.35, 0, 4.4, 8.32, 0, g96, 0.25);
    plane(TEX.stencil('STORE B-3 · DEEP RESERVE', 'Rain City Civic Museum · authorised staff only · 2031'), 4.6, 1.44, 0, 4.4, 8.32, 0, g49, 0.3);
    // Edie's desk: a counter built from old display cases, a lamp, the visitors' book, the catalogue cabinet
    const [dx, , dz] = P.edieDesk;
    B96.box(M.wood, dx - 0.45, 0, dz - 1.6, dx + 0.45, 1.0, dz + 1.6); B96.box(M.woodDark, dx - 0.55, 1.0, dz - 1.7, dx + 0.55, 1.06, dz + 1.7); box(dx - 0.45, 0, dz - 1.6, dx + 0.45, 1.0, dz + 1.6, ['2196']);
    B96.box(paperMat, P.visitors[0] - 0.2, 1.06, P.visitors[2] - 0.28, P.visitors[0] + 0.2, 1.1, P.visitors[2] + 0.28);
    B96.cyl(brass, dx, 1.3, dz + 1.1, 0.03, 0.5, 6); B96.cyl(amber, dx, 1.58, dz + 1.1, 0.1, 0.12, 10); src(dx - 0.4, 1.9, dz + 1, 0xffc27a, 6, 8, '2196');
    const [cx, , cz] = P.catalogue;
    B96.box(M.woodDark, cx - 0.5, 0, cz - 1.8, cx + 0.5, 1.5, cz + 1.8); box(cx - 0.5, 0, cz - 1.8, cx + 0.5, 1.5, cz + 1.8);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) B96.box(brass, cx + 0.5, 0.25 + r * 0.33, cz - 1.5 + c * 0.6, cx + 0.53, 0.33 + r * 0.33, cz - 1.2 + c * 0.6);
    B49.box(crateMat, cx - 0.5, 0, cz - 1.8, cx + 0.5, 1.5, cz + 1.8);
    // 2049: racking and crates along the walls; 2196: benches, rugs, lantern strings
    for (const z of [11, 15, 19]) { B49.box(crateDark, 7.4, 0, z - 1.4, 8.7, 2.6, z + 1.4); box(7.4, 0, z - 1.4, 8.7, 2.6, z + 1.4, ['2049']); }
    B96.box(cloth, -3.5, 0.01, 10.5, 3.5, 0.03, 19.5); B96.box(M.wood, -7.8, 0, 18.6, -5.4, 0.45, 20.8);
    for (let k = 0; k < 6; k++) { const x = -6 + k * 2.4; B96.cyl(amber, x, 4.7 - Math.abs(Math.sin(k)) * 0.3, 15, 0.08, 0.16, 8); }
    src(-3, 4.2, 15, 0xffc890, 8, 12, '2196'); src(3, 5.0, 15, 0xe8f4ff, 6, 12, '2049');
    // shelves of strays along the walls (2196): boards, uprights and the small things nobody has a case for yet
    {
      const shelfW = mat(0x4a3424, 0.8), things = [mat(0x8a6a4a, 0.9), mat(0x6a7a7a, 0.5, 0.3), mat(0xb8a888, 0.85), mat(0x5a2a22, 0.7), brass, mat(0x3a4a5a, 0.6)];
      for (const [x0, x1, z0, z1] of [[-8.7, -8.15, 16.4, 21.4], [-8.7, -8.15, 8.6, 11.6], [8.15, 8.7, 8.6, 12.2], [8.15, 8.7, 16.4, 21.4]]) {
        box(x0, 0, z0, x1, 2.6, z1, ['2196']);
        for (const z of [z0, z1]) B96.box(shelfW, x0, 0, z - 0.04, x1, 2.6, z + 0.04);
        for (let y = 0.3; y < 2.6; y += 0.62) {
          B96.box(shelfW, x0, y, z0, x1, y + 0.04, z1);
          let z = z0 + 0.1;
          while (z < z1 - 0.3) {
            const w = 0.14 + R() * 0.3, m = things[Math.floor(R() * things.length)], h = 0.1 + R() * 0.34, cx = (x0 + x1) / 2;
            if (R() < 0.45) B96.cyl(m, cx, y + 0.04 + h / 2, z + w / 2, w * 0.45, h, 8); else if (R() < 0.85) B96.box(m, cx - 0.18, y + 0.04, z, cx + 0.18, y + 0.04 + h, z + w);
            z += w + 0.06 + R() * 0.12;
          }
          for (let k = 0; k < 3; k++) B96.box(paperMat, x0 < 0 ? x1 : x0 - 0.002, y - 0.1, z0 + 0.6 + k * 1.5, x0 < 0 ? x1 + 0.002 : x0, y - 0.02, z0 + 0.78 + k * 1.5);
        }
      }
    }
    W.visitorBook = plane(TEX.label(['VISITORS', 'K.V. · K.V. · K.V. · K.V. · K.V. · K.V.', '(every line, the same two letters)'], { founder: true }), 0.38, 0.24, P.visitors[0], 1.115, P.visitors[2], 0, g96, 0.1, -Math.PI / 2);
  }
  // ================= the nave: eight cases =================
  const mkCase = (x, z, ry, parent = B96, w = 1.2, d = 0.9, h = 1.0) => {
    const c = Math.cos(ry), s = Math.sin(ry), hw = Math.abs(c) * w / 2 + Math.abs(s) * d / 2, hd = Math.abs(s) * w / 2 + Math.abs(c) * d / 2;
    parent.box(M.woodDark, x - hw, 0, z - hd, x + hw, h, z + hd); parent.box(brass, x - hw - 0.02, h, z - hd - 0.02, x + hw + 0.02, h + 0.04, z + hd + 0.02);
    parent.push(glass, new THREE.BoxGeometry(hw * 2, 0.7, hd * 2).translate(x, h + 0.39, z));
    box(x - hw, 0, z - hd, x + hw, h + 0.75, z + hd, parent === B96 ? ['2196'] : parent === B49 ? ['2049'] : undefined);
    return { x, y: h + 0.05, z };
  };
  EXHIBITS.forEach(([x, z, ry, title, , kind], i) => {
    const cs = mkCase(x, z, ry);
    // the object itself, small and particular
    const o = new THREE.Group(); o.position.set(cs.x, cs.y, cs.z); o.rotation.y = ry; g96.add(o);
    const add = (geo, m, px = 0, py = 0, pz = 0, rx = 0, rz = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.rotation.set(rx, 0, rz); o.add(me); return me; };
    if (kind === 'ring') add(new THREE.TorusGeometry(0.06, 0.012, 8, 24), mat(0xd8b050, 0.25, 1), 0, 0.03, 0, Math.PI / 2.4);
    else if (kind === 'report' || kind === 'card' || kind === 'ticket') add(new THREE.PlaneGeometry(kind === 'ticket' ? 0.16 : 0.42, kind === 'ticket' ? 0.08 : 0.3), new THREE.MeshStandardMaterial({ map: TEX.label([title.toUpperCase(), kind === 'card' ? 'Happy 11th Mira!!!' : kind === 'report' ? 'Skelling Bay Primary' : 'LINE 9 · SUNWARD'], { key: kind }), roughness: 0.8 }), 0, 0.02, 0, -Math.PI / 2);
    else if (kind === 'jar') { add(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 16), new THREE.MeshPhysicalMaterial({ color: 0x6a9aa8, roughness: 0.05, transmission: 0.5, transparent: true, opacity: 0.6 }), 0, 0.13); add(new THREE.CylinderGeometry(0.115, 0.115, 0.04, 16), brass, 0, 0.28); }
    else if (kind === 'placard') add(new THREE.BoxGeometry(0.62, 0.42, 0.03), new THREE.MeshStandardMaterial({ map: TEX.sign('LET THE MACHINE SLEEP', '', { bg: '#d8ccb0', fg: '#8a1a10', font: HAND, size: 92, key: 'plac' }), roughness: 0.9 }), 0, 0.24, 0, -0.2);
    else if (kind === 'id') add(new THREE.PlaneGeometry(0.2, 0.13), new THREE.MeshStandardMaterial({ map: TEX.badge('DR. M. VAREN', 'DIRECTOR · 2047', false), roughness: 0.6 }), 0, 0.02, 0, -Math.PI / 2);
    else if (kind === 'helmet') { add(new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(0xd8d8d0, 0.4, 0.2), 0, 0.12); for (let k = 0; k < 5; k++) add(new THREE.SphereGeometry(0.03, 6, 4), mat([0xd84a6a, 0xf0d040, 0x6ab0e0][k % 3], 0.6), Math.sin(k * 1.3) * 0.14, 0.2 + (k % 2) * 0.05, 0.12); }
    // the label (Edie's hand) on the case front
    plane(TEX.label([title.toUpperCase(), 'Stray · ' + ['Port Hale', 'Skelling Bay', 'Line 9', 'Harrow front', 'Helix gates', 'Calder Row', 'Helix', 'unknown'][i]], { key: 'ex' + i }), 0.42, 0.26, cs.x + Math.sin(ry) * (ry > 0 ? 0.47 : 0.47), 0.72, cs.z + Math.cos(ry) * 0.47, ry, g96, 0.15, -0.35);
    W.exhibits.push({ i, pos: [x + Math.sin(ry) * 1.1, 0, z + Math.cos(ry) * 1.1] });
    src(x + Math.sin(ry) * 0.3, 2.0, z, 0xffd8a0, 2.2, 4.5, '2196');
    // 2049: grey racking in the same place
    B49.box(crateMat, x - 0.6, 0, z - 1.2, x + 0.6, 2.2, z + 1.2); box(x - 0.6, 0, z - 1.2, x + 0.6, 2.2, z + 1.2, ['2049']);
    B49.box(cardboard, x - 0.5, 2.2, z - 1.0, x + 0.4, 2.7, z - 0.1);
  });
  // nave benches and lantern strings (2196), extra crates (2049)
  for (const z of [-4, -24]) { B96.box(M.wood, -1.6, 0, z - 0.3, 1.6, 0.46, z + 0.3); box(-1.6, 0, z - 0.3, 1.6, 0.46, z + 0.3, ['2196']); }
  for (let z = -30; z <= 6; z += 6) { B96.cyl(amber, -3.4, 3.6, z, 0.07, 0.15, 8); B96.cyl(amber, 3.4, 3.6, z + 3, 0.07, 0.15, 8); src(0, 3.6, z, 0xffc890, 5.5, 11, '2196'); }
  for (let z = -30; z <= 6; z += 12) { B96.box(cloth2, -5.7, 3.0, z - 1, -5.68, 5.0, z + 1); }
  // roots through the vault in 2196 (the world above grows down)
  for (let k = 0; k < 6; k++) { const z = -30 + k * 6.6, x = (k % 2 ? 1 : -1) * (2 + R() * 2); B96.geo(mat(0x4a3a28, 0.95), new THREE.CylinderGeometry(0.02, 0.08, 2.4, 5), [x, 5.6, z], [R() * 0.4, 0, R() * 0.4 - 0.2]); }
  plane(TEX.sign('HALL OF ORDINARY THINGS', 'strays · kept by E. Lark'), 4.4, 0.83, 0, 5.0, 7.7, Math.PI, g96, 0.2);

  // ================= the listening rooms (memory chairs + the artifact cases) =================
  const room = (x, z, title, m) => {
    const sgn = x < 0 ? 1 : -1;
    // the chair: a worn leather armchair facing the case
    const [chx, , chz] = m === 0 ? P.chairI : m === 1 ? P.chairII : P.chairIII;
    B96.box(mat(0x4a2a1a, 0.6), chx - 0.45, 0.0, chz - 0.45, chx + 0.45, 0.48, chz + 0.45); B96.box(mat(0x4a2a1a, 0.6), chx - (x < 0 ? 0.45 : -0.3), 0.48, chz - 0.45, chx - (x < 0 ? 0.3 : -0.45), 1.15, chz + 0.45);
    box(chx - 0.45, 0, chz - 0.45, chx + 0.45, 0.5, chz + 0.45, ['2196']);
    const [cx, , cz] = m === 0 ? P.caseI : m === 1 ? P.caseII : P.caseIII;
    const cs = mkCase(cx, cz, 0, B96, 1.4, 0.9, 1.05);
    W.cases[m] = cs;
    plane(TEX.label(MEMS[m].label, { founder: true, key: 'mem' + m }), 0.62, 0.39, cx, 0.78, cz + 0.47, 0, g96, 0.18, -0.35);
    plane(TEX.sign(title, MEMS[m].name, { size: 64, key: 'room' + m }), 3.2, 0.6, x + sgn * -5.8, 3.4, z, sgn * Math.PI / 2, g96, 0.18);
    // the room's speaker horn and lamp; the walls hang with fabric to deaden sound
    B96.box(cloth, x - 5.8, 0.6, z - 5.9, x + 5.8, 3.8, z - 5.86); B96.cyl(brass, chx + sgn * 0.8, 1.2, chz, 0.03, 2.4, 6);
    B96.cyl(amber, chx + sgn * 0.8, 2.45, chz, 0.16, 0.2, 10); src(chx + sgn * 0.8, 2.6, chz, 0xffc27a, 5, 8, '2196');
    src(cx, 3.6, cz + 1, 0xffd8a0, 4, 7, '2196');
    // 2049: crates
    for (let k = 0; k < 3; k++) { const zz = z - 4 + k * 3.6; B49.box(crateMat, x + sgn * -4.6 - 0.7, 0, zz - 0.9, x + sgn * -4.6 + 0.7, 1.4, zz + 0.9); box(x + sgn * -4.6 - 0.7, 0, zz - 0.9, x + sgn * -4.6 + 0.7, 1.4, zz + 0.9, ['2049']); }
    src(x, 4.2, z, 0xe8f4ff, 4, 9, '2049'); B49.box(cool, x - 0.1, 4.48, z - 1.5, x + 0.1, 4.58, z + 1.5);
  };
  room(-12, -1, 'LISTENING ROOM I', 0); room(12, -1, 'LISTENING ROOM II', 1); room(-12, -21, 'LISTENING ROOM III', 2);
  // the artifacts in their cases (shown once their memory has been listened to; until then a cloth covers them)
  {
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.21), new THREE.MeshStandardMaterial({ map: TEX.badge('M. VAREN', '', true), roughness: 0.6 }));
    badge.rotation.x = -Math.PI / 2; badge.rotation.z = 0.3; badge.position.set(P.caseI[0], 1.12, P.caseI[2]);
    const coat = new THREE.Group(); const coatM = mat(0x2a4a6a, 0.95, 0, { side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.42), coatM); coat.add(body);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.4, 8), coatM); sl.rotation.z = Math.PI / 2; sl.position.set(-0.4, 0, 0.1); coat.add(sl);
    const sr = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 8), coatM); sr.rotation.z = Math.PI / 2.4; sr.position.set(0.36, 0, 0.12); coat.add(sr);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), coatM); hood.position.set(0, 0, -0.26); hood.scale.set(1, 0.3, 1); coat.add(hood);
    coat.position.set(P.caseII[0], 1.1, P.caseII[2]);
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 24), [mat(0xc84a2a, 0.5), new THREE.MeshStandardMaterial({ map: TEX.clock(8, 14, true), roughness: 0.4 }), mat(0xc84a2a, 0.5)]);
    clock.position.set(P.caseIII[0], 1.2, P.caseIII[2]); clock.rotation.x = -1.1;
    W.artifacts = [badge, coat, clock];
    W.covers = [];
    W.artifacts.forEach((a, i) => {
      g96.add(a); a.visible = false;
      const c = W.cases[i], cov = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.6), mat(0x6a4a3a, 0.95)); cov.position.set(c.x, c.y + 0.06, c.z); g96.add(cov); W.covers.push(cov);
    });
  }
  // ================= the Concordance: trays (2196), crates of the current world (2049) =================
  {
    const [x, , z] = P.conc;
    plane(TEX.sign('THE CONCORDANCE', 'theirs · ours', { size: 64, key: 'conc' }), 3.2, 0.6, x + 5.8, 3.4, z, -Math.PI / 2, g96, 0.18);
    B96.box(M.wood, 8.4, 0, -22, 15.6, 0.9, -20); box(8.4, 0, -22, 15.6, 0.9, -20, ['2196']);    // the long bench
    B96.box(M.wood, 11.2, 0, -18.2, 12.8, 0.9, -17.0); box(11.2, 0, -18.2, 12.8, 0.9, -17.0, ['2196']);
    for (let i = 0; i < 3; i++) { const [tx, , tz] = P.trays[i]; const tr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.6), brass); tr.position.set(tx, 0.93, i === 0 ? tz - 0.0 : tz); g96.add(tr); W.trays.push(tr); }
    for (const zz of [-26, -16]) for (const xx of [8, 16]) { B96.cyl(amber, xx, 3.6, zz + (zz < -20 ? 1 : -1), 0.08, 0.16, 8); }
    src(12, 3.4, -21, 0xffc890, 6, 9, '2196');
    // 2049: three crates on pallets, a lid each (opened in 2049), a museum strip light
    const crateLabels = COMPARE.map(c => c.crate);
    const order = [0, 2, 1];   // crate i holds the current-world copy for COMPARE entry order[i]... crates are placed at the memory's tray
    void order;
    for (let i = 0; i < 3; i++) {
      const [cx, , cz] = P.crates[i], rot = i === 0 ? 0 : Math.PI / 2;
      B49.box(M.wood, cx - 0.7, 0, cz - 0.55, cx + 0.7, 0.14, cz + 0.55);
      B49.box(crateMat, cx - 0.6, 0.14, cz - 0.45, cx + 0.6, 0.94, cz + 0.45); box(cx - 0.6, 0, cz - 0.45, cx + 0.6, 0.94, cz + 0.45, ['2049']);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.06, 0.94), crateDark); lid.position.set(cx, 0.97, cz); g49.add(lid); W.lids.push(lid);
      const lab = COMPARE.find(c => c.mem === i).crate;
      plane(TEX.crateLabel(lab), 0.5, 0.25, cx + (i === 0 ? 0 : (i === 1 ? 0.62 : -0.62)), 0.6, cz + (i === 0 ? 0.47 : 0), rot * (i === 2 ? -1 : 1), g49, 0.12);
      void crateLabels;
    }
    // the current-world copies (inside the crates, shown when the lid comes off)
    const log = plane(TEX.deskLog(true), 0.5, 0.375, P.crates[0][0], 0.95, P.crates[0][2], 0, g49, 0.1, -Math.PI / 2);
    const coat49 = W.artifacts[1].clone(); coat49.position.set(P.crates[1][0], 0.95, P.crates[1][2]); coat49.rotation.y = Math.PI / 2; g49.add(coat49);
    const photo49 = plane(TEX.pressPhoto(), 0.5, 0.375, P.crates[2][0], 0.95, P.crates[2][2], Math.PI / 2, g49, 0.1, -Math.PI / 2);
    W.copies = [log, coat49, photo49]; W.copies.forEach(c => { c.visible = false; });
    B49.box(crateDark, 7.0, 0, -26.4, 17.4, 2.8, -25.8);
    src(12, 4.2, -21, 0xe8f4ff, 6, 10, '2049'); B49.box(cool, 11.9, 4.48, -23, 12.1, 4.58, -19);
  }
  // ================= the rotunda: Accession Zero =================
  {
    const [x, , z] = P.rotunda;
    B96.cyl(M.stone, x, 0.5, z, 1.3, 1.0, 24); B96.cyl(brass, x, 1.02, z, 1.32, 0.04, 24); box(x - 1.3, 0, z - 1.3, x + 1.3, 1.6, z + 1.3);
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.2, 24, 1, true), glass); dome.position.set(x, 1.64, z); g96.add(dome);
    // a fragment of the ring: a third of a black torus, standing, with two hand prints that glow when lit
    const frag = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.13, 12, 32, Math.PI * 0.6), new THREE.MeshPhysicalMaterial({ color: 0x0b0c0f, roughness: 0.25, metalness: 0.6, clearcoat: 1 }));
    frag.position.set(x, 1.2, z); frag.rotation.set(0, 0.3, Math.PI * 0.2); g96.add(frag); W.fragment = frag;
    const prints = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshBasicMaterial({ map: TEX.hands(), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    prints.position.set(x + 0.18, 1.5, z + 0.32); prints.rotation.y = 0.3; g96.add(prints); W.prints = prints;
    const thread = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.008, 6, 16), mat(0x2a4a6a, 0.9)); thread.position.set(x - 0.4, 1.06, z + 0.3); thread.rotation.x = Math.PI / 2; g96.add(thread);
    const sb = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.18), new THREE.MeshStandardMaterial({ map: TEX.badge('K. VAREN', 'ACCOMPANIED', false), roughness: 0.6 })); sb.rotation.x = -Math.PI / 2; sb.rotation.z = -0.5; sb.position.set(x + 0.45, 1.05, z - 0.25); g96.add(sb);
    plane(TEX.label(['ACCESSION ZERO', 'Found in every world I have kept: this, and a thread of blue wool, and his badge.', 'Which morning is it? — K.'], { founder: true, key: 'zero' }), 0.66, 0.41, x, 0.62, z + 1.32, 0, g96, 0.18, -0.2);
    // plaques of the first accessions round the drum, candles at the plinth
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + 0.3; if (Math.abs(Math.sin(a)) > 0.9 || Math.cos(a) > 0.82) continue; const px = x + Math.sin(a) * 8.5, pz = z + Math.cos(a) * 8.5; B96.boxc(M.woodDark, px, 1.7, pz, 0.9, 0.6, 0.05, a); }
    for (let k = 0; k < 9; k++) { const a = k * 0.7; B96.cyl(mat(0xe8dcc0, 0.8), x + Math.sin(a) * 1.55, 0.08, z + Math.cos(a) * 1.55, 0.03, 0.16 + (k % 3) * 0.05, 6); B96.cyl(amber, x + Math.sin(a) * 1.55, 0.2 + (k % 3) * 0.05, z + Math.cos(a) * 1.55, 0.012, 0.03, 4); }
    src(x, 3.6, z + 1.5, 0xffd8a0, 7, 10, '2196'); src(x, 1.2, z, 0xffb070, 2.5, 4, '2196');
    // a sealed drum in 2049: an unopened concrete core, "no access" — the room in 2049 is an empty round tank
    B49.cyl(M.conc49, x, 0.5, z, 1.3, 1.0, 24);
    plane(TEX.stencil('SEALED · DO NOT OPEN', 'core sample S-0 · Helix custody since 2031'), 1.6, 0.5, x, 0.55, z + 1.32, 0, g49, 0.2);
    src(x, 5, z, 0xe8f4ff, 5, 14, '2049');
    // the gate to the stacks (opened after the determination)
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.2, 3.8), mat(0x2a2620, 0.6, 0.7, { wireframe: false })); gate.position.set(9.1, 1.6, -44); scene.add(gate);
    const bars = new THREE.Group(); for (let k = 0; k < 10; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.2, 5), brass); b.position.set(9.0, 1.6, -45.8 + k * 0.4); bars.add(b); } scene.add(bars); gate.visible = false;
    W.doors.stacks = { col: box(8.9, 0, -46, 9.3, 3.4, -42), mesh: bars };
    plane(TEX.sign('THE STACKS', 'the Founder\'s study beyond', { size: 60, key: 'stk' }), 2.4, 0.45, 8.6, 3.75, -44, -Math.PI / 2, g96, 0.2);
  }
  // ================= the stacks =================
  {
    const shelfMat = mat(0x5a4a3a, 0.8, 0.1), shelf49 = mat(0x3a5a8a, 0.55, 0.4), boxes = [mat(0x8a6a4a, 0.9), mat(0x6a5a48, 0.9), mat(0x9a8a6a, 0.9), mat(0x4a3a2a, 0.9)];
    const unit = (x0, z0, x1, z1, h = 3.2, era49 = false) => {   // a shelving unit with boxes, visual only
      const Bx = era49 ? B49 : B96, sm = era49 ? shelf49 : shelfMat;
      const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      for (let y = 0.1; y < h; y += 0.8) Bx.box(sm, x0, y, z0, x1, y + 0.05, z1);
      for (const [px, pz] of along ? [[x0, z0], [x1, z0]] : [[x0, z0], [x0, z1]]) Bx.box(sm, px - 0.04, 0, pz - 0.04, px + 0.04, h, pz + 0.04);
      for (let y = 0.15; y < h - 0.5; y += 0.8) {
        let t = 0; const L = along ? x1 - x0 : z1 - z0;
        while (t < L - 0.3) { const w = 0.25 + R() * 0.45; if (R() < 0.82) { const bh = 0.3 + R() * 0.35, m = era49 ? crateMat : boxes[Math.floor(R() * 4)]; if (along) Bx.box(m, x0 + t, y, z0 + 0.05, x0 + t + w - 0.04, y + bh, z1 - 0.05); else Bx.box(m, x0 + 0.05, y, z0 + t, x1 - 0.05, y + bh, z0 + t + w - 0.04); } t += w; }
      }
    };
    // the aisle faces (collision common) with alcove gaps: N1 13.5..15, N2 21.5..23, N3 27.5..29 | S1 16.5..18, S2 24..25.5
    const north = [[11, 13.5], [15, 21.5], [23, 27.5], [29, 31]], south = [[11, 16.5], [18, 24], [25.5, 31]];
    for (const [a, b] of north) { box(a, 0, -46.3, b, 3.4, -45.5); unit(a, -46.3, b, -45.5); unit(a, -46.3, b, -45.5, 3.0, true); }
    for (const [a, b] of south) { box(a, 0, -42.5, b, 3.4, -41.7); unit(a, -42.5, b, -41.7); unit(a, -42.5, b, -41.7, 3.0, true); }
    // the alcoves (side pockets 1.5 m wide, 3.6 m deep), closed at their back
    for (const [a, b] of [[13.5, 15], [21.5, 23], [27.5, 29]]) { box(a - 0.3, 0, -50.2, a, 3.4, -46.3); box(b, 0, -50.2, b + 0.3, 3.4, -46.3); box(a, 0, -50.5, b, 3.4, -50.2); unit(a, -50.5, b, -50.2); }
    for (const [a, b] of [[16.5, 18], [24, 25.5]]) { box(a - 0.3, 0, -41.7, a, 3.4, -38.0); box(b, 0, -41.7, b + 0.3, 3.4, -38.0); box(a, 0, -38.0, b, 3.4, -37.7); unit(a, -38.0, b, -37.7); }
    // the deep rows behind the faces (visual: rows along z)
    for (let x = 12; x < 30.5; x += 2.2) { unit(x, -57.6, x + 0.6, -51); unit(x, -37.2, x + 0.6, -30.4); }
    // 2196: the collapse at x 18.5..20.5 (a fallen unit and rubble), passable in 2049
    const rub = mat(0x5a5046, 0.95);
    for (let k = 0; k < 14; k++) B96.geo(rub, new THREE.DodecahedronGeometry(0.25 + R() * 0.45, 0), [18.6 + R() * 1.8, R() * 1.4, -45.3 + R() * 2.6], [R(), R(), R()]);
    B96.boxc(shelfMat, 19.5, 1.2, -44, 0.3, 3.2, 3.2, 0, 0, 0.9);
    B96.geo(M.brick, new THREE.BoxGeometry(1.6, 0.5, 2.8), [19.6, 2.6, -44], [0.3, 0.2, 0.4]);
    W.collapse = box(18.5, 0, -45.5, 20.5, 3.4, -42.5, ['2196']);
    // 2049: the security grille at x 25.7, passable in 2196 (rusted away)
    for (let k = 0; k <= 12; k++) B49.box(M.steelDark, 25.66, 0, -45.5 + k * 0.25 - 0.015, 25.74, 3.2, -45.5 + k * 0.25 + 0.015);
    B49.box(M.steelDark, 25.6, 3.1, -45.5, 25.8, 3.25, -42.5); B49.box(M.steelDark, 25.6, 1.5, -45.5, 25.8, 1.6, -42.5);
    plane(TEX.stencil('SECURE CAGE · HELIX CUSTODY', 'Key holder: Dr. E. Rook'), 1.4, 0.44, 25.62, 1.9, -44, -Math.PI / 2, g49, 0.25);
    W.grille = box(25.6, 0, -45.5, 25.8, 3.4, -42.5, ['2049']);
    B96.box(M.rust, 25.66, 0, -45.5, 25.74, 0.3, -45.2); B96.box(M.rust, 25.66, 2.9, -42.8, 25.74, 3.2, -42.5);   // what is left of it in 2196
    // lights: 2196 a few lanterns hung from the shelving; 2049 strip lights
    for (const x of [13, 20, 27]) { B96.cyl(amber, x, 3.6, -44, 0.08, 0.16, 8); src(x, 3.4, -44, 0xffc890, 4.5, 9, '2196'); B49.box(cool, x - 1.2, 5.9, -44.1, x + 1.2, 6.0, -43.9); src(x, 5.2, -44, 0xe8f4ff, 4, 10, '2049'); }
    // the ledger stand at the entrance (the register of worlds)
    const [lx, , lz] = P.ledger;
    C.box(M.woodDark, lx - 0.3, 0, lz - 0.2, lx + 0.3, 1.05, lz + 0.2); box(lx - 0.3, 0, lz - 0.2, lx + 0.3, 1.1, lz + 0.2);
    plane(TEX.ledger(), 0.44, 0.55, lx, 1.14, lz, Math.PI, g96, 0.15, -1.1);
    // the music box (Edie's) on the alcove N2 back shelf
    const mb = new THREE.Group(); const mbB = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), mat(0x7a3a22, 0.4)); mb.add(mbB);
    const mbL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.16), brass); mbL.position.y = 0.075; mb.add(mbL);
    mb.position.set(P.musicBox[0], 0.95, P.musicBox[2]); g96.add(mb); W.musicBox = mb;
    // the unmaking front: a pale sheet that sweeps the aisle from the study door
    const frontMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uA: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uT,uA; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){ vec2 g=floor(vUv*vec2(60.0,70.0)+vec2(0.0,uT*30.0)); float n=h(g+floor(uT*12.0)); float edge=smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x)*smoothstep(1.0,0.7,vUv.y);
          vec3 c=mix(vec3(0.85,0.9,1.0), vec3(1.0,0.95,0.85), n); gl_FragColor=vec4(c*(0.35+0.65*n), (0.25+0.55*n)*edge*uA); }`,
    });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.4), frontMat); front.rotation.y = Math.PI / 2; front.position.set(31, 1.7, -44); front.visible = false; scene.add(front);
    W.front = front;
  }
  // ================= the Founder's study =================
  {
    const [dx, , dz] = P.desk;
    // the door with its dial lock
    W.doors.study = { col: box(31.0, 0, -45.5, 31.4, 3.0, -42.5) };
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.95, 2.95), mat(0x3a2618, 0.7)); doorMesh.position.set(31.2, 1.48, -44); scene.add(doorMesh); W.doors.study.mesh = doorMesh;
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 20), brass); dial.rotation.z = Math.PI / 2; dial.position.set(31.0, 1.3, -43.2); scene.add(dial); W.dial = dial;
    // the desk, the chair, the drawer, the lamp
    B96.box(M.woodDark, dx - 0.5, 0, dz - 1.0, dx + 0.5, 0.8, dz + 1.0); B96.box(M.wood, dx - 0.55, 0.8, dz - 1.05, dx + 0.55, 0.85, dz + 1.05); box(dx - 0.5, 0, dz - 1.0, dx + 0.5, 0.85, dz + 1.0);
    B96.box(mat(0x3a2a20, 0.7), dx + 0.7, 0, dz - 0.3, dx + 1.3, 0.48, dz + 0.3); B96.box(mat(0x3a2a20, 0.7), dx + 1.2, 0.48, dz - 0.3, dx + 1.3, 1.1, dz + 0.3);
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.6), mat(0x4a3020, 0.6)); drawer.position.set(dx - 0.52, 0.65, P.drawer[2]); g96.add(drawer); W.drawer = drawer;
    B96.cyl(brass, dx, 1.05, dz + 0.8, 0.02, 0.4, 6); B96.cyl(amber, dx, 1.28, dz + 0.8, 0.1, 0.1, 10); src(dx - 0.3, 1.8, dz + 0.4, 0xffc27a, 6, 7, '2196');
    for (let k = 0; k < 4; k++) B96.box(paperMat, dx - 0.4 + R() * 0.4, 0.85, dz - 0.8 + k * 0.3, dx - 0.1 + R() * 0.4, 0.86 + k * 0.003, dz - 0.55 + k * 0.3);
    // the photograph: face down in the drawer until found
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.225), new THREE.MeshStandardMaterial({ map: TEX.photoFrame(), roughness: 0.6, emissive: 0xffffff, emissiveMap: TEX.photoFrame(), emissiveIntensity: 0.12, side: THREE.DoubleSide }));
    photo.rotation.x = -Math.PI / 2; photo.rotation.z = 0.12; photo.position.set(dx - 0.12, 0.886, dz - 0.05); photo.visible = false; g96.add(photo); W.photo = photo;
    // the lectern with the register of iterations
    const [lx, , lz] = P.lectern;
    B96.box(M.woodDark, lx - 0.3, 0, lz - 0.3, lx + 0.3, 1.1, lz + 0.3); box(lx - 0.3, 0, lz - 0.3, lx + 0.3, 1.1, lz + 0.3);
    plane(TEX.register(), 0.5, 0.62, lx, 1.16, lz, Math.PI / 2, g96, 0.18, -1.05);
    // the wall of bands: 1,046 Chronolith bands on pegs, each tagged
    {
      const n = 1046, cols = 62, rows = Math.ceil(n / cols);
      const geo = new THREE.TorusGeometry(0.045, 0.012, 4, 10); geo.rotateY(Math.PI / 2);
      const im = new THREE.InstancedMesh(geo, mat(0x2a2c30, 0.4, 0.8), n); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); e.set(0, 0, (R() - 0.5) * 0.4); q.setFromEuler(e); m4.compose(new THREE.Vector3(40.9, 0.5 + r * 0.19, -53.4 + c * 0.27), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); }
      im.userData.noBatch = true; g96.add(im); W.bands = im;
      const dots = new THREE.InstancedMesh(new THREE.BoxGeometry(0.01, 0.012, 0.012), glowMat(0x5fe6ff, 1.2), n);
      for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); m4.makeTranslation(40.86, 0.5 + r * 0.19 + 0.045, -53.4 + c * 0.27); dots.setMatrixAt(i, m4); }
      dots.userData.noBatch = true; g96.add(dots); W.bandDots = dots;
      B96.box(M.wood, 41.0, 0.3, -53.6, 41.1, 0.4 + rows * 0.19, -36.4);
      src(39, 3.2, -45, 0xffd0a0, 5, 9, '2196');
    }
    // the empty case: accession 1047
    const ec = mkCase(P.emptyCase[0], P.emptyCase[2], 0, B96, 1.4, 0.9, 1.05);
    plane(TEX.caseCard(), 0.5, 0.25, ec.x, 0.76, ec.z + 0.47, 0, g96, 0.2, -0.35);
    // his coat on a hook, maps and pinned pages, a cot
    const coatHang = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.3, 10, 1, true), mat(0x2a2724, 0.7, 0, { side: THREE.DoubleSide })); coatHang.position.set(P.studyCoat[0], 1.5, P.studyCoat[2]); g96.add(coatHang);
    B96.box(mat(0x4a4038, 0.9), 37.2, 0, -37.0, 40.6, 0.45, -36.2);
    for (let k = 0; k < 7; k++) plane(TEX.label([['19.10.2026', '08:14:09', 'she reached for me', 'not the hospital', 'try the rain', 'try earlier', 'try being someone else'][k]], { founder: true, key: 'pin' + k }), 0.36, 0.22, 31.4 + 0.02, 1.4 + (k % 3) * 0.45, -52.4 + k * 0.8, Math.PI / 2, g96, 0.12);
    // 2049: an empty plant room
    B49.box(crateDark, 36, 0, -40.8, 40.6, 2.4, -38.2); box(36, 0, -40.8, 40.6, 2.4, -38.2, ['2049']); src(36, 3.6, -45, 0xe8f4ff, 4, 10, '2049');
  }

  // ================= the memory stage: the Helix hall, 19.10.2026, 08:10 =================
  {
    const X = MEM_X, x0 = X - 16, x1 = X + 16, z0 = -16, z1 = 14, H = 8.5;
    box(x0 - 2, -1, z0 - 2, x1 + 2, 0, z1 + 2);
    C.box(M.tileHelix, x0, -0.2, z0, x1, 0, z1);
    wallX(C, M.paint26, z0, x0, x1, 0, H, 0.4); wallZ(C, M.paint26, x0, z0, z1, 0, H, 0.4); wallZ(C, M.paint26, x1, z0, z1, 0, H, 0.4);
    box(x0, 0, z1, x1, H, z1 + 0.4);   // the glass front (collision)
    C.box(M.paint26, x0, H, z0, x1, H + 0.3, z1);
    const sky = new THREE.MeshBasicMaterial({ map: TEX.window(false), toneMapped: false, color: 0xd8d8d8 });
    for (let k = 0; k < 8; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.4), sky); p.position.set(x0 + 2.1 + k * 4, 3.4, z1 + 0.3); p.rotation.y = Math.PI; scene.add(p); C.box(M.steelDark, x0 + 0.1 + k * 4, 0, z1 + 0.1, x0 + 0.25 + k * 4, H, z1 + 0.25); }
    for (let k = 0; k < 6; k++) C.box(cool, x0 + 3 + k * 5.2, H - 0.06, -4, x0 + 3.3 + k * 5.2, H - 0.02, 6);
    // the ring (Site Zero Artefact) on its plinth, behind the rope
    const ring = chronolith(0.9, { color: 0x9ad8ff, power: 0.08 }); ring.position.set(...P.ring); scene.add(ring); W.mem.ring = ring;
    C.box(M.stone, X - 3.2, 0, -12.2, X + 3.2, 0.5, -7.0); box(X - 3.2, 0, -12.2, X + 3.2, 0.5, -7.0);
    C.box(M.steelDark, X - 0.5, 0.5, -9.8, X + 0.5, 0.9, -9.0);
    for (let k = 0; k <= 6; k++) { const sx = X - 6 + k * 2; C.cyl(brass, sx, 0.5, P.rope, 0.04, 1.0, 8); C.cyl(brass, sx, 0.04, P.rope, 0.18, 0.06, 12); }
    const ropeGeo = new THREE.CylinderGeometry(0.03, 0.03, 12, 6); ropeGeo.rotateZ(Math.PI / 2); C.geo(mat(0x8a1a22, 0.8), ropeGeo, [X, 0.92, P.rope]);
    W.mem.ropeCol = box(X - 6, 0, P.rope - 0.1, X + 6, 1.0, P.rope + 0.1);
    plane(TEX.artefactSign(), 1.2, 0.6, X - 4.6, 1.3, P.rope + 0.2, 0, scene, 0.2);
    plane(TEX.banner(), 9, 2.25, X, 6.6, -15.75, 0, scene, 0.35);
    // the reception desk, the badge printer, the log on its clipboard
    const [dx, , dz] = P.memDesk;
    C.box(M.paint26, dx - 0.6, 0, dz - 2.4, dx + 0.6, 1.1, dz + 2.4); C.box(M.woodDark, dx - 0.7, 1.1, dz - 2.5, dx + 0.7, 1.16, dz + 2.5); box(dx - 0.6, 0, dz - 2.4, dx + 0.6, 1.16, dz + 2.4);
    plane(TEX.helixSign(), 2.4, 0.75, dx - 0.62, 0.6, dz, -Math.PI / 2, scene, 0.15);
    plane(TEX.helixSign(), 3.6, 1.12, x1 - 0.22, 4.2, dz, -Math.PI / 2, scene, 0.3);
    W.mem.log1 = plane(TEX.deskLog(false), 0.42, 0.32, dx, 1.18, dz - 1.2, -Math.PI / 2, scene, 0.15, -Math.PI / 2);
    W.mem.log2 = plane(TEX.deskLog(true), 0.42, 0.32, dx, 1.18, dz - 1.2, -Math.PI / 2, scene, 0.15, -Math.PI / 2);
    C.box(M.steelDark, dx - 0.2, 1.16, dz + 1.0, dx + 0.2, 1.36, dz + 1.4);
    for (const zz of [-2, 2]) { C.box(mat(0x2a3a4e, 0.8), X - 11, 0, zz - 0.4, X - 7, 0.45, zz + 0.4); box(X - 11, 0, zz - 0.4, X - 7, 0.45, zz + 0.4); }
    for (const [px, pz] of [[X - 14, -13], [X + 14, -13], [X - 14, 11], [X + 13.8, 11]]) { C.cyl(mat(0x5a4030, 0.9), px, 0.4, pz, 0.4, 0.8, 12); C.geo(mat(0x3a5a2a, 0.9), new THREE.IcosahedronGeometry(0.8, 1), [px, 1.5, pz]); }
    src(X, 6, -9, 0xd8ecff, 10, 16, 'mem'); src(X, 6, 4, 0xfff0d8, 9, 16, 'mem'); src(X + 7, 3, 4, 0xfff0d8, 4, 8, 'mem');
    // the ring's flash at 08:14 (a soft bloom, never a white-out)
    const halo = new THREE.Mesh(new THREE.SphereGeometry(3.2, 24, 16), new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.position.set(...P.ring); scene.add(halo); W.mem.halo = halo;
  }
  // ================= the memory stage: the Varen kitchen, Calder Row, world 0388 =================
  {
    const X = MEM_X - 5, x0 = X - 4.6, x1 = X + 4.6, z0 = 42, z1 = 51.5, H = 2.7;
    box(x0 - 1, -1, z0 - 1, x1 + 1, 0, z1 + 1);
    C.box(M.kitchenTile, x0, -0.2, z0, x1, 0, z1);
    wallX(C, M.kitchenWall, z0, x0, x1, 0, H, 0.3, [[X - 2, X + 2, 2.3]]); wallX(C, M.kitchenWall, z1, x0, x1, 0, H, 0.3); wallZ(C, M.kitchenWall, x0, z0, z1, 0, H, 0.3); wallZ(C, M.kitchenWall, x1, z0, z1, 0, H, 0.3);
    C.box(M.kitchenWall, X - 2, 0, z0 - 0.15, X + 2, 0.9, z0 + 0.15);
    box(X - 2, 0.9, z0 - 0.2, X + 2, 2.3, z0 + 0.1);
    C.box(M.paint26, x0, H, z0, x1, H + 0.2, z1);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.4), new THREE.MeshBasicMaterial({ map: TEX.window(true), toneMapped: false, color: 0xb0b0b0 })); win.position.set(X, 1.6, z0 - 0.2); scene.add(win);
    C.box(M.wood, X - 2.1, 0.88, z0 + 0.1, X + 2.1, 0.94, z0 + 0.4);
    // the table, chairs, breakfast
    const [tx, , tz] = P.kTable;
    C.box(M.wood, tx - 0.8, 0.72, tz - 0.55, tx + 0.8, 0.78, tz + 0.55); for (const [a, b] of [[-0.7, -0.45], [0.7, -0.45], [-0.7, 0.45], [0.7, 0.45]]) C.box(M.woodDark, tx + a - 0.03, 0, tz + b - 0.03, tx + a + 0.03, 0.72, tz + b + 0.03);
    box(tx - 0.8, 0, tz - 0.55, tx + 0.8, 0.78, tz + 0.55);
    for (const [cx, cz] of [[tx - 1.1, tz], [tx + 1.1, tz], [tx, tz + 0.95]]) { C.box(M.woodDark, cx - 0.22, 0.42, cz - 0.22, cx + 0.22, 0.46, cz + 0.22); }
    for (let k = 0; k < 3; k++) C.cyl(mat(0xe8e4d8, 0.4), tx - 0.4 + k * 0.4, 0.8, tz - 0.1 + (k % 2) * 0.2, 0.09, 0.04, 12);
    // counters along the east wall, the fridge, the radio, the clock
    C.box(mat(0xd8d0c0, 0.5), x1 - 0.7, 0, z0 + 0.3, x1 - 0.1, 0.9, z1 - 3); C.box(mat(0x5a5048, 0.4), x1 - 0.72, 0.9, z0 + 0.3, x1 - 0.08, 0.94, z1 - 3); box(x1 - 0.7, 0, z0 + 0.3, x1 - 0.1, 0.94, z1 - 3);
    C.box(mat(0xe8e8e8, 0.3, 0.2), x1 - 0.8, 0, z1 - 2.8, x1 - 0.1, 1.9, z1 - 2.0); box(x1 - 0.8, 0, z1 - 2.8, x1 - 0.1, 1.9, z1 - 2.0);
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.12), mat(0x6a2a22, 0.5)); radio.position.set(...P.kRadio); scene.add(radio); W.mem.radio = radio;
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.24, 32), new THREE.MeshStandardMaterial({ map: TEX.clock(8, 13, false), roughness: 0.4, emissive: 0xffffff, emissiveMap: TEX.clock(8, 13, false), emissiveIntensity: 0.15 }));
    clockFace.position.set(P.kClock[0] + 0.18, P.kClock[1], P.kClock[2]); clockFace.rotation.y = Math.PI / 2; scene.add(clockFace); W.mem.clock = clockFace;
    C.cyl(mat(0xc84a2a, 0.5), P.kClock[0] + 0.14, P.kClock[1], P.kClock[2], 0.26, 0.06, 24, [0, 0, Math.PI / 2]);
    // the child's drawing on the fridge: ME · MIRA · THE MACHINE
    plane(TEX.label(['ME · MIRA · THE MACHINE', 'by Kai'], { key: 'fridge', bg: '#f0ead8' }), 0.36, 0.24, x1 - 0.82, 1.3, z1 - 2.4, -Math.PI / 2, scene, 0.15);
    src(tx, 2.4, tz, 0xffe0b0, 6, 7, 'mem'); src(X, 1.6, z0 + 0.8, 0xa8b8c8, 3, 6, 'mem');
    // a lived-in kitchen: wall cupboards, sink and hob, a door to the hall, a coat on its hook, a fruit bowl
    {
      const cup = mat(0xe8e0cc, 0.6), dk = mat(0x2a2a2c, 0.4, 0.3), steel = mat(0xb8bcc0, 0.3, 0.8);
      C.box(cup, x1 - 0.42, 1.55, z0 + 0.3, x1 - 0.1, 2.3, z1 - 3.1);
      for (let z = z0 + 0.3; z < z1 - 3.2; z += 0.7) C.box(mat(0xb8a888, 0.5), x1 - 0.43, 1.6, z + 0.32, x1 - 0.42, 2.25, z + 0.36);
      C.box(steel, x1 - 0.62, 0.9, z0 + 1.6, x1 - 0.18, 0.95, z0 + 2.4); C.cyl(steel, x1 - 0.2, 1.1, z0 + 2.0, 0.02, 0.3, 6);
      C.box(dk, x1 - 0.66, 0.94, z0 + 3.6, x1 - 0.14, 0.96, z0 + 4.2);
      for (const [a, b] of [[0.2, 0.15], [0.2, 0.45], [0.45, 0.15], [0.45, 0.45]]) C.cyl(mat(0x5a5a5a, 0.5), x1 - 0.66 + a, 0.965, z0 + 3.6 + b, 0.09, 0.01, 12);
      C.box(M.woodDark, x0 + 0.15, 0, z1 - 2.6, x0 + 0.2, 2.15, z1 - 2.5); C.box(M.woodDark, x0 + 0.15, 0, z1 - 1.3, x0 + 0.2, 2.15, z1 - 1.2); C.box(M.woodDark, x0 + 0.15, 2.05, z1 - 2.6, x0 + 0.2, 2.15, z1 - 1.2);
      C.box(mat(0x6a4a32, 0.6), x0 + 0.16, 0, z1 - 2.5, x0 + 0.19, 2.05, z1 - 1.3);
      C.geo(mat(0x2a4a6a, 0.95), new THREE.CylinderGeometry(0.12, 0.2, 0.62, 8), [x0 + 0.32, 1.5, z1 - 0.7]);
      C.cyl(mat(0xd8d0c0, 0.4), tx, 0.83, tz, 0.16, 0.08, 14); for (let k = 0; k < 4; k++) C.geo(mat([0xc83a2a, 0xd8b030, 0x6aa040, 0xc83a2a][k], 0.5), new THREE.SphereGeometry(0.045, 8, 6), [tx - 0.06 + (k % 2) * 0.1, 0.9, tz - 0.05 + (k >> 1) * 0.1]);
      C.box(mat(0x8a3a2a, 0.9), tx - 1.4, 0.005, tz - 1.0, tx + 1.4, 0.012, tz + 1.0);
    }
    // rain on the window
    W.mem.rainWin = win;
  }

  // ---------- build the batches ----------
  S.common.build(scene, { blockers: true, game }); S['2049'].build(g49, { blockers: true, game }); S['2196'].build(g96, { blockers: true, game });
  // dust in the lantern light (2196)
  try { const dust = RZ.particles({ kind: 'dust', count: low ? 90 : 220, center: [0, 3, -14], area: [6, 3, 22], color: 0xffe0b0 }); g96.add(dust); } catch (err) { console.warn('m16 dust', err); }
  W.update = (dt, t) => {
    if (W.mem.ring?.userData?.update) W.mem.ring.userData.update(t);
    if (W.front.visible) W.front.material.uniforms.uT.value = t;
  };
  return W;
}
