// Mission 9 environment: the Meridian district of Rain City, 2049, caught in the nine minutes before the Zero Second
// (Sunday 19.10.2049, 08:05:00-08:14:00, over and over). Rain City's visual language in daylight: an overcast, wet
// Sunday morning. North = -z.
//   South: the loop boundary (a standing shimmer under the tram viaduct) and Café Ostra, the safe zone.
//   Meridian Avenue (shops, the bakery awning, a TV shop) runs north into Meridian Square (fountain, tram stop).
//   West of the square: the old tram station with Clock A on its roof tower (observation post, external stair).
//   East: the Bank of Meridian, Clock B over its portico (on Patrol B's route).
//   North: the Market Hall, Clock C hanging under its glass roof (the loop trigger, shutter opens 08:10).
//   North-east: the substation yard with the Continuum transmitter mast and the cabin where the engineer is trapped.
//   North-west: Meridian Tower (control tower) with its glass lift and the observation ring at 48 m.
// Static geometry is merged per material (env_m6 Batch); buildings are one cityBlock mesh.
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng, neonSign } from './kit.js';
import { Batch, clockFace, settableClock, textPlate } from './env_m6.js';
import { lampPost, streetKit, trainCar } from './props.js';
import { registerCast } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';
import { loopState } from '../systems/loops.js';

export const Y0 = 0.15;   // pavement / plaza level
// Key positions used by the mission script and the playthrough test
export const P = {
  start: [2, 0, 50], cafe: [-9.0, Y0, 40], radio: [-10.6, 1.2, 37.6], waitBench: [-7.6, Y0, 42.5],
  fountain: [0, Y0, -31], stairBottom: [-26.6, Y0, -16.8], roof: [-31, 7.2, -24], scope: [-28.9, 7.2, -30], nodeA: [-31.75, 7.2, -30],
  bankSteps: [24.5, Y0, -30], cabinetB: [27.2, 1.65, -30.25], bStand: [26.95, 1.65, -30],
  shutter: [0, Y0, -56], hallIn: [0, Y0, -62], galleryStair: [-12.2, Y0, -64], nodeC: [-2.0, 4.0, -80.4], backDoor: [9, Y0, -82],
  gate: [30, 0, -68], cStand: [28.6, 0, -68], mast: [44, 0, -71], cabin: [51, 0, -80], cabinDoor: [47.7, 0, -80], intercom: [51, 0, -86.6],
  guardPost: [33.5, 0, -59.5], crate: [37.5, 0, -83.5],
  lane: [0, 0, -90], towerDoor: [-36.4, 0, -96], deck: [-35.5, 48, -96], anchor: [-36.2, 48, -91.6],
  officer: [-23, Y0, -60], awning: [10.8, Y0, -2.5], tv: [-10.4, Y0, 4],
};
export const CORES = [[41.6, -71], [46.4, -71], [44, -74.6]];
export const SHARDS = [[-18.5, 0.9, 12.2], [-34.5, 8.1, -40.5], [3.2, 0.9, -31.2], [13.2, 0.9, -74.5], [-44.5, 0.9, -84.5]];
// the patrol box around the fountain (Patrol A walks it clockwise)
export const SQUARE_LOOP = [[-11, -19], [11, -19], [11, -44], [-11, -44]];

// ---------------------------------------------------------------------------------------------------------------------
// Cast (registerCast never overwrites an existing id). Every look carries era, sex/age and a COSTUMES.md archetype.
// ---------------------------------------------------------------------------------------------------------------------
export const TROOPER = { era: '2196', costume: 'continuum_1', sex: 0, age: 30, height: 1.88, build: 1.05, skin: 0xd9a585, hair: 0x111111, hairStyle: 'buzz', topType: 'armored', top: 0xe6e8ea, topKind: 'synthetic', armor: true, pantsType: 'cargo', pants: 0x202328, shoes: 'boots', boots: 0x202328, gloves: 0x202328, belt: 0x8a9098 };
export const CIVS = [
  { era: '2049', costume: 'c49_m2', sex: 0, age: 38, height: 1.84, build: 1.05, skin: 0x6b4029, hair: 0x111111, hairStyle: 'buzz', topType: 'jacket', top: 0x2a2f36, coat: 0x2a2f36, pantsType: 'trousers', pants: 0x1a1d22, shoes: 'boots', boots: 0x141210, lod: true },
  { era: '2049', costume: 'c49_f3', sex: 1, female: true, age: 31, height: 1.66, build: 0.95, skin: 0xe8b996, hair: 0x5a3a22, hairStyle: 'bob', topType: 'jacket', top: 0x3a4048, pantsType: 'trousers', pants: 0x23262b, shoes: 'shoes', boots: 0x141210, lod: true },
  { era: '2049', costume: 'c49_m1', sex: 0, age: 24, height: 1.76, build: 0.92, skin: 0xe8c0a0, hair: 0x0e0a08, hairStyle: 'short', topType: 'jacket', top: 0x18191d, pantsType: 'cargo', pants: 0x3a3e44, shoes: 'shoes', boots: 0x141414, glasses: true, lod: true },
  { era: '2049', costume: 'c49_f4', sex: 1, female: true, age: 20, height: 1.63, build: 0.9, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'curly', topType: 'sweater', top: 0x4a1f24, pantsType: 'cargo', pants: 0x2e3338, shoes: 'shoes', boots: 0xd8dce0, lod: true },
  { era: '2049', costume: 'c49_m5', sex: 0, age: 68, height: 1.72, build: 1.0, skin: 0xf1c6a8, hair: 0xb8b4ae, hairStyle: 'grey-swept', topType: 'jacket', top: 0x3b4441, coat: 0x3b4441, pantsType: 'trousers', pants: 0x2a2e36, shoes: 'shoes', boots: 0x14151a, lod: true },
  { era: '2049', costume: 'c49_f2', sex: 1, female: true, age: 42, height: 1.68, build: 1.0, skin: 0xa16d4c, hair: 0x15100b, hairStyle: 'tied-back', topType: 'jacket', top: 0x1d2a44, pantsType: 'trousers', pants: 0x1a1d22, shoes: 'shoes', boots: 0x141210, lod: true },
];
export function registerM9Cast() {
  registerCast('ines', {
    name: 'INES CALDER', role: 'Grid engineer · Meridian substation · loop-aware',
    bio: 'City grid engineer on the Sunday shift at the Meridian substation. She was in the control cabin when the Continuum mast came up and has lived the same nine minutes ever since, locked in behind a blast door that the mast powers.',
    look: { era: '2049', costume: 'technician', sex: 1, female: true, age: 46, height: 1.69, build: 1.02, skin: 0xc8916c, hair: 0x2a1c14, hairStyle: 'bun', eyes: 0x4a3a2a,
      face: { jaw: 0.15, cheek: 0.2, nose: 0.15, noseWidth: 0.2, lips: -0.1, brow: 0.2, eyeSize: -0.1, faceLength: 0.1, chin: 0.1 },
      topType: 'jacket', top: 0x2c333b, topKind: 'synthetic', vest: 0xd9781e, pantsType: 'cargo', pants: 0x2c333b, shoes: 'boots', boots: 0x2a2018, gloves: 0x5a4a3a, wrinkles: 0.3 },
    rimColor: 0xffb070, glow: 0x2a1a08, bg: 0x101014,
    vp: { sex: 'f', pitch: 0.96, rate: 1.0, langs: ['en-GB', 'en-IE', 'en-US'] },
  });
  registerCast('m9trooper', { name: 'CONTINUUM TROOPER', role: 'Meridian array · patrol', look: { ...TROOPER }, vp: { sex: 'm', pitch: 0.8, rate: 0.98, langs: ['en-GB', 'en-US'] } });
  registerCast('rhee', {
    name: 'OFFICER RHEE', role: 'Continuum · Meridian array · starting to remember',
    look: { era: '2196', costume: 'continuum_2', sex: 1, female: true, age: 33, height: 1.76, build: 1.0, skin: 0xe8c0a0, hair: 0x0e0a08, hairStyle: 'bun',
      face: { jaw: -0.05, cheek: 0.3, nose: -0.1, noseWidth: -0.1, lips: 0.05, brow: -0.1, eyeSize: 0.05, faceLength: 0.05, chin: 0.0 },
      topType: 'armored', top: 0xe6e8ea, topKind: 'synthetic', armor: true, coat: null, pantsType: 'cargo', pants: 0x202328, shoes: 'boots', boots: 0x202328, gloves: 0x202328, sash: null },
    vp: { sex: 'f', pitch: 1.0, rate: 0.98, langs: ['en-GB', 'en-US'] },
  });
  registerCast('dev', {
    name: 'DEV, CAFÉ OSTRA', role: 'Owner · Meridian Avenue',
    look: { era: '2049', costume: 'c49_m3', sex: 0, age: 55, height: 1.72, build: 1.12, skin: 0xa16d4c, hair: 0x3a3634, hairStyle: 'short', beard: 0x6a6662, topType: 'sweater', top: 0x3a4048, vest: 0x1b1e23, pantsType: 'trousers', pants: 0x23262b, shoes: 'shoes', boots: 0x141210 },
    vp: { sex: 'm', pitch: 0.9, rate: 0.98, langs: ['en-IN', 'en-GB', 'en-US'] },
  });
  registerCast('m9vendor', { name: 'MARKET VENDOR', role: 'Market Hall · noodle stall', look: { era: '2049', costume: 'c49_m6', sex: 0, age: 34, height: 1.78, build: 1.0, skin: 0xb98463, hair: 0x111111, hairStyle: 'messy', topType: 'jacket', top: 0x2e3338, vest: 0x3a4048, pantsType: 'cargo', pants: 0x2a2f36, shoes: 'boots', boots: 0x141210, cap: 0x2a2f36 }, vp: { sex: 'm', pitch: 1.0, rate: 1.05, langs: ['en-US', 'en-GB'] } });
  registerCast('m9mother', { name: 'A MOTHER ON THE AVENUE', role: 'Meridian Avenue · 08:13', look: { era: '2049', costume: 'c49_f1', sex: 1, female: true, age: 36, height: 1.67, build: 0.96, skin: 0xd9a585, hair: 0x2a1c14, hairStyle: 'long', topType: 'jacket', top: 0x3b4441, pantsType: 'trousers', pants: 0x1d2430, shoes: 'boots', boots: 0x141210 }, vp: { sex: 'f', pitch: 1.08, rate: 1.02, langs: ['en-GB', 'en-US'] } });
  registerCast('m9boy', { name: 'HER SON', role: 'Meridian Avenue', look: { era: '2049', costume: 'c49_kid_m', sex: 0, age: 7, height: 1.22, child: true, build: 0.9, skin: 0xd9a585, hair: 0x2a1c14, hairStyle: 'short', topType: 'jacket', top: 0x1f6aa8, pantsType: 'trousers', pants: 0x3a3e44, shoes: 'boots', boots: 0xb0262c, lod: true }, vp: { sex: 'm', pitch: 1.5, rate: 1.08, langs: ['en-GB', 'en-US'] } });
  registerCast('m9voice', { name: '— — —', role: 'Meridian public address · unidentified', voice: true, vp: { sex: 'm', pitch: 0.72, rate: 0.86, langs: ['en-GB', 'en-US'] } }); // the voice from M1/M3/M8
  registerCast('m9pa', { name: 'CONTINUUM ARRAY', role: 'Meridian · automated', voice: true, vp: { sex: 'f', pitch: 1.1, rate: 1.02, langs: ['en-GB', 'en-US'] } });
  registerCast('m9command', { name: 'CONTINUUM COMMAND', role: 'Meridian array · channel open', voice: true, vp: { sex: 'm', pitch: 0.78, rate: 0.96, langs: ['en-GB', 'en-US'] } });
  registerCast('m9radio', { name: 'HELIX RADIO', role: 'Channel 2 · outside the cordon', voice: true, vp: { sex: 'm', pitch: 0.86, rate: 1.0, langs: ['en-US', 'en-GB'] } });
  registerCast('m9figure', { name: '— — —', role: 'A rooftop across the square', voice: true, vp: { sex: 'm', pitch: 0.72, rate: 0.86, langs: ['en-GB', 'en-US'] } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Music: the Nine-Minute War theme gains one layer per loop (loop memory), a calm café cue, the alarm and the ending.
// ---------------------------------------------------------------------------------------------------------------------
export const musicState = { alarm: 0, final: 0 };
export function registerM9Themes() {
  registerTheme('m9-loop', { bpm: 118, step(a, s, t, d) { // urgency and tactical adaptation; one more layer every reset
    const bar = Math.floor(s / 16), b = s % 16, L = loopState.layer || 0, late = (loopState.t || 0) > 500;
    const slip = bar % 7 === 6 && b >= 12;                  // the tempo "slips": the last steps of every 7th bar drop out
    if (slip) { if (b === 12) a.glass(91, t, 0.012); return; }
    a.tick(t, b % 4 === 0 ? 0.03 : 0.012, 6200);
    const ost = [38, 41, 45, 43, 38, 45, 41, 40];             // short string ostinato in changing groupings (3+3+2)
    if ([0, 3, 6, 8, 11, 14].includes(b)) a.cello(ost[(bar * 6 + [0, 3, 6, 8, 11, 14].indexOf(b)) % 8], t, d * 2.4, 0.05);
    if (L >= 1 && (b === 0 || b === 6 || b === 10)) a.drum(t, 0.15, 90, 40);
    if (L >= 2 && b === 0) a.pad([50, 57, 60], t, d * 16, 0.014, 520);
    if (L >= 3 && b % 2 === 1 && bar % 2 === 0) a.pluck([62, 65, 69, 67][(b >> 1) % 4], t, 0.05);
    if (L >= 4 && bar % 4 === 3 && [2, 7, 12].includes(b)) a.piano([76, 83, 81][[2, 7, 12].indexOf(b)], t, 0.1, 2.6); // the three-note motif
    if (L >= 5 && (b === 4 || b === 13)) a.drum(t, 0.1, 160, 52);
    if (L >= 6 && b === 8) a.glass(86 + (bar % 3) * 2, t, 0.014);
    if (late && b % 4 === 2) a.drum(t, 0.12, 60, 36);        // the last half-minute before 08:14 pounds
  } });
  registerTheme('m9-safe', { bpm: 72, step(a, s, t, d) { // Café Ostra: warm, unhurried, with the clock still audible
    const bar = Math.floor(s / 16), b = s % 16, CH = [[45, 52, 57, 60], [41, 48, 57, 60], [43, 50, 55, 59], [40, 47, 55, 59]], ch = CH[bar % 4];
    if (b % 4 === 0) a.tick(t, 0.02, 3000);
    if (b === 0) { a.pad(ch.slice(1), t, d * 16, 0.013, 480); a.cello(ch[0] - 12, t, d * 16, 0.03); }
    if (b === 0 || b === 7 || b === 10) a.piano(ch[1 + (b % 3)] + 12, t, 0.09, 3.0);
    if ((loopState.layer || 0) >= 3 && b === 14 && bar % 2) a.flute(72, t, d * 2, 0.02);
  } });
  registerTheme('m9-alarm', { bpm: 134, step(a, s, t, d) { // the mast is down; the array hunts
    const bar = Math.floor(s / 16), b = s % 16;
    if (b % 2 === 0) a.cello([38, 38, 41, 43][(b >> 1) % 4] + (bar % 2 ? 2 : 0), t, d * 1.6, 0.055);
    if (b % 4 === 0) a.drum(t, 0.18, 110, 42);
    if (b === 6 || b === 14) a.drum(t, 0.1, 180, 56);
    a.tick(t, b % 4 === 2 ? 0.035 : 0.014, 7200);
    if (b === 0) a.pad([62, 65, 69], t, d * 16, 0.016, 700);
    if (bar % 2 === 1 && b === 8) a.glass(88, t, 0.02);
  } });
  registerTheme('m9-reset', { bpm: 50, step(a, s, t, d) { // 08:14: everything stops, then pours backwards
    const b = s % 16;
    if (b === 0) { a.pad([45, 52, 57, 64], t, d * 16, 0.02, 380); a.cello(33, t, d * 16, 0.05); }
    if (b === 4 || b === 12) a.glass(81 + (b === 12 ? 2 : 0), t, 0.016);
  } });
  registerTheme('m9-outside', { bpm: 56, step(a, s, t, d) { // the ending: the motif, slowly, Kai outside the loop
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([57, 64, 69, 71], t, d * 16, 0.02, 520); a.cello(33 + (bar % 2 ? 5 : 0), t, d * 16, 0.05); }
    if (bar % 2 === 0 && [0, 6, 12].includes(b)) a.piano([76, 83, 81][b / 6], t, 0.18, 5);
    if (bar % 2 === 1 && b === 8) a.flute(76, t, d * 6, 0.02);
    if (b % 8 === 4) a.tick(t, 0.012, 2400);
  } });
}

// ---------------------------------------------------------------------------------------------------------------------
// Code-drawn textures
// ---------------------------------------------------------------------------------------------------------------------
const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
export function screenTex(key, w, h, draw, bg = '#0a0c10') {
  return canvasTex(w, h, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); draw(g, W, H); }, 'm9' + key);
}
export const TEX = {
  nodePlate: () => screenTex('nodePlate', 512, 384, (g, w) => {
    g.fillStyle = '#c8a050'; g.fillRect(10, 10, w - 20, 364); g.fillStyle = '#1a140c'; g.fillRect(18, 18, w - 36, 348);
    g.fillStyle = '#ffd27a'; g.font = `700 30px ${FONT}`; g.fillText('MERIDIAN ARRAY · SYNC NODE A', 34, 62);
    g.font = `500 22px ${FONT}`; g.fillStyle = '#e8d8b0';
    ['NODE A · STATION CLOCK · OBSERVATION', 'NODE B · BANK OF MERIDIAN · PORTICO', 'NODE C · MARKET HALL · TRIGGER', '', 'C RESET REFERENCE  08:05:00', 'LOCK: 3/3 NODES IN STEP', 'SOURCE: SUBSTATION MAST'].forEach((l, i) => g.fillText(l, 34, 110 + i * 34));
    g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(w - 70, 70, 26, 0, 7); g.lineWidth = 5; g.strokeStyle = '#ffd27a'; g.stroke();
  }),
  order: () => screenTex('order', 512, 320, (g, w) => {
    g.fillStyle = '#ffd27a'; g.font = `700 26px ${FONT}`; g.fillText('CONTINUUM · STANDING ORDER 0001', 24, 46);
    g.fillStyle = '#e6e8ea'; g.font = `500 21px ${FONT}`;
    ['MERIDIAN IS THE FIRST DISTRICT.', 'HOLD THE NINE MINUTES. DO NOT LET', 'THE NINTH MINUTE COMPLETE.', 'ARRAY POWER: HELIX RESONANCE RELAY', 'ANCHOR: TOWER RING (DO NOT TOUCH)', 'AUTH: PREFECT · REPEAT INDEFINITELY'].forEach((l, i) => g.fillText(l, 24, 92 + i * 34));
    g.strokeStyle = 'rgba(255,210,122,0.5)'; g.lineWidth = 2; g.strokeRect(10, 10, w - 20, 300);
  }, '#0c0e12'),
  crate: () => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#d8dce0'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1e24'; g.font = `700 40px ${FONT}`; g.fillText('HELIX', 26, 66);
    g.font = `600 22px ${FONT}`; ['CHRONOLITH RESONANCE RELAY · 3 OF 3', 'AUTHORISED: E. ROOK', 'DELIVERED 18.10.2049 · MERIDIAN SUBSTN.'].forEach((l, i) => g.fillText(l, 26, 116 + i * 38));
    g.strokeStyle = '#38c8c0'; g.lineWidth = 8; g.beginPath(); g.arc(w - 80, 64, 34, 0.4, 5.6); g.stroke();
  }, 'm9crate'),
  cafe: () => textPlate([{ text: 'CAFÉ OSTRA', font: '700 70px "Cinzel", Georgia, serif' }, 'COFFEE · SINCE 2031'], { bg: '#1c2a26', ink: '#e8c890', w: 512, h: 192 }),
  bakery: () => textPlate([{ text: 'BRØD & CO', font: '700 64px "Cinzel", Georgia, serif' }, 'BAKERY · OPEN SUNDAYS'], { bg: '#3a1e18', ink: '#f0d8a8', w: 512, h: 192 }),
  hall: () => textPlate([{ text: 'MERIDIAN MARKET HALL', font: '700 46px "Cinzel", Georgia, serif' }, '1928 · RESTORED 2040'], { bg: '#2a2620', ink: '#e0c890', w: 768, h: 192 }),
  bank: () => textPlate([{ text: 'BANK OF MERIDIAN', font: '700 50px "Cinzel", Georgia, serif' }], { bg: '#c8c0b0', ink: '#3a3428', w: 768, h: 128 }),
  station: () => textPlate([{ text: 'MERIDIAN · TRAM STATION', font: '700 46px "Cinzel", Georgia, serif' }], { bg: '#24302c', ink: '#e8d8a8', w: 768, h: 128 }),
  tv: (t = 0) => screenTex('tv' + t, 512, 288, (g, w) => {
    const grd = g.createLinearGradient(0, 0, w, 288); grd.addColorStop(0, '#16324a'); grd.addColorStop(1, '#0a1420'); g.fillStyle = grd; g.fillRect(0, 0, w, 288);
    g.fillStyle = '#b8262e'; g.fillRect(0, 222, w, 40); g.fillStyle = '#fff'; g.font = `700 22px ${FONT}`; g.fillText('LIVE · RAIN CITY 1 · SUN 19.10.2049 08:1' + (t ? '2' : '0'), 14, 248);
    g.font = `700 30px ${FONT}`; g.fillText(t ? 'HELIX: "NO RISK TO THE PUBLIC"' : 'HELIX TEST SCHEDULED FOR 08:00', 18, 60);
    g.font = `500 22px ${FONT}`; g.fillStyle = '#d8e4ee'; g.fillText(t ? 'Director E. Rook: the Meridian relay is' : 'Meridian substation lends its grid to', 18, 104); g.fillText(t ? 'a routine resonance study.' : 'the Chronolith programme this morning.', 18, 134);
  }),
  sign: (txt, sub) => screenTex('sign' + txt, 512, 128, (g, w) => { g.fillStyle = '#e8eaec'; g.font = `700 40px ${FONT}`; g.fillText(txt, 20, 58); if (sub) { g.font = `500 22px ${FONT}`; g.fillStyle = '#9aa4ae'; g.fillText(sub, 20, 98); } g.fillStyle = '#5fe6ff'; g.fillRect(w - 26, 18, 8, 92); }, '#1a1e24'),
  cordon: () => canvasTex(512, 128, (g, w) => { for (let x = -128; x < w + 128; x += 64) { g.fillStyle = '#d8b020'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 160, 128); g.lineTo(x + 128, 128); g.fill(); } g.fillStyle = '#111'; g.fillRect(0, 44, w, 40); g.fillStyle = '#ffd34a'; g.font = `700 26px ${FONT}`; g.fillText('HELIX CORDON · DO NOT CROSS · MERIDIAN', 18, 74); }, 'm9cordon'),
  shimmer: () => canvasTex(256, 256, (g, w, h) => {
    const r = rng(9); g.clearRect(0, 0, w, h);
    for (let k = 0; k < 90; k++) { const x = r() * w, gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(220,240,255,${0.15 + r() * 0.35})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, 0, 8, h); }
  }, 'm9shimmer'),
  fence: () => canvasTex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(160,168,176,0.95)'; g.lineWidth = 2.2; for (let k = -128; k < 256; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 128, 128); g.stroke(); g.beginPath(); g.moveTo(k + 128, 0); g.lineTo(k, 128); g.stroke(); } }, 'm9fence'),
  poster: (i) => canvasTex(256, 384, (g, w, h) => {
    const P = [['#1d2a44', '#ffd34a', 'RAIN CITY', 'TRAM 9 · MERIDIAN'], ['#4a1f24', '#f2f6ff', 'HELIX', 'TIME IS SAFE WITH US'], ['#1f3a3a', '#6affc8', 'NOODLES', 'MARKET HALL · STALL 14']][i % 3];
    g.fillStyle = P[0]; g.fillRect(0, 0, w, h); g.fillStyle = P[1]; g.font = `700 44px ${FONT}`; g.fillText(P[2], 18, 90); g.font = `500 20px ${FONT}`; g.fillText(P[3], 18, 130);
    g.strokeStyle = P[1]; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, 250, 60, 0, 5); g.stroke();
  }, 'm9poster' + i),
};

// ---------------------------------------------------------------------------------------------------------------------
// The district
// ---------------------------------------------------------------------------------------------------------------------
export function buildMeridian(game, scene) {
  const Q = RZ.getQuality(), low = Q === 'low';
  const W = { clocks: {}, lightSrc: [], damage: [], cores: [], speakers: [], shards: [] };
  const col = game.collision, R = rng(919);
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  const M = {
    asphalt: pm('wetAsphalt', { color: 0x34363a, puddles: 0.55 }),
    paving: pm('concrete', { color: 0x7a7a76, slabs: 1, stains: 0.45, formwork: 0, wet: 0.7 }),
    plaza: pm('cutStone', { color: 0x8c8880 }),
    kerb: pm('cutStone', { color: 0x9a968e }),
    stone: pm('cutStone', { color: 0xb8b0a0 }),
    brick: pm('brick', { color: 0x7a3e2c }),
    concrete: pm('concrete', { color: 0x8c8c88, formwork: 1, stains: 0.35 }),
    steel: pm('brushedMetal', { color: 0x9aa0a6, roughness: 0.32 }),
    dark: pm('brushedMetal', { color: 0x30353c, roughness: 0.45 }),
    paint: pm('paintedMetalPanel', { color: 0x2e4a44, cols: 2, rows: 2, wear: 0.3, grime: 0.3, gloss: 0.45 }),
    rust: pm('rust', { color: 0x4a2a14, paint: 0x3d4a52, amount: 0.3 }),
    wood: pm('wood', { color: 0x6a4a30, planks: 8 }),
    rubber: pm('rubber', { color: 0x1a1b1d }),
    tile: pm('ceramicTile', { color: 0xa8a49a, grout: 0x6a6660, count: 2, gloss: 0.6, variation: 0.25 }),
  };
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fb8c8, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe0e2e4, roughness: 0.4 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.35, metalness: 0.4 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc89a4a, metalness: 0.7, roughness: 0.32 });
  const warm = glowMat(0xffd8a0, 1.6), gold = glowMat(0xffd27a, 2.4), cyan = glowMat(0x5fe6ff, 2.2), red = glowMat(0xff4d5e, 2.0);
  const awningMat = new THREE.MeshStandardMaterial({ color: 0x7a1f1f, roughness: 0.85, side: THREE.DoubleSide });
  const B = new Batch();
  const box = (x0, y0, z0, x1, y1, z1, o) => col.add([Math.min(x0, x1), y0, Math.min(z0, z1)], [Math.max(x0, x1), y1, Math.max(z0, z1)], o);
  const src = (x, y, z, c, i, d, zone = 'out') => W.lightSrc.push({ p: [x, y, z], c, i, d, zone });
  const signPlane = (tex, w, h, x, y, z, ry, emiss = 0.25) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emiss })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };

  // ================= ground: roads at 0, pavements and the plaza at Y0 =================
  B.box(M.asphalt, -90, -0.3, -125, 90, 0, 80); box(-90, -1, -125, 90, 0, 80);
  const pave = (x0, z0, x1, z1, mat = M.paving) => { B.box(mat, x0, 0, Math.min(z0, z1), x1, Y0, Math.max(z0, z1)); box(x0, 0, z0, x1, Y0, z1); };
  pave(-10, 58, -6, -10); pave(6, 58, 10, -10);                               // avenue pavements
  pave(-26, -10, 26, -50, M.plaza);                                            // Meridian Square
  pave(-26, -50, 26, -56); pave(-26, -56, -16, -84); pave(16, -56, 22, -84);   // Hall Street, Station Lane, Gate Street walk
  pave(-58, -84, -16, -108, M.plaza);                                          // tower plaza
  pave(-16, -82.3, 30, -86.2);                                                  // north lane walk (behind the hall)
  const kit = streetKit({ era: '2049', seed: 9 });
  kit.kerb([[-6, 58], [-6, -10]]).kerb([[6, -10], [6, 58]])
    .markings({ lanes: [{ from: [0, 56], to: [0, -9] }], crossings: [{ at: [0, 24], yaw: Math.PI / 2, width: 11 }, { at: [0, -8.4], yaw: Math.PI / 2, width: 11 }] })
    .rails([[-90, -12.6], [90, -12.6]], { embedded: true })
    .scatter('lamp', [[8.6, 54], [8.6, -6]], { spacing: 15, turn: -Math.PI / 2, y: Y0 })
    .scatter('lamp', [[-8.6, 54], [-8.6, -6]], { spacing: 15, turn: Math.PI / 2, y: Y0, offset: 7 })
    .shelter([14, Y0, -10.8], Math.PI).bins([[7.4, Y0, 18], [-7.4, Y0, 6], [-20, Y0, -48], [20, Y0, -20]])
    .benches([[-16, Y0, -24, Math.PI / 2], [16, Y0, -38, -Math.PI / 2], [-7.4, Y0, 30, Math.PI / 2]])
    .bollards([[-5, Y0, -9.4], [-2.5, Y0, -9.4], [2.5, Y0, -9.4], [5, Y0, -9.4]])
    .car([-3.2, 0, 34, 0.02], 0).car([3.4, 0, 12, Math.PI]).van([3.3, 0, 40, Math.PI]).scooter([-8.2, Y0, 20, 0.4])
    .puddles([[-2, 30, 1.6], [2.4, 6, 1.2], [-6, -20, 1.8], [8, -40, 1.4], [20, -70, 1.6], [-30, -92, 2.0], [0, -90, 1.6]])
    .cables([[[-10, 9, 30], [10, 8.5, 28]], [[-10, 9, 4], [10, 9, 2]], [[-26, 10, -52], [26, 10, -53]]])
    .catenary([[-90, -12.6], [90, -12.6]], { height: 6.2, spacing: 18 });
  scene.add(kit.build()); kit.collide(game);

  // ================= buildings: one interior-mapped cityBlock mesh =================
  const bld = (x0, x1, z0, z1, face, o) => {
    const yaw = face === '+x' ? Math.PI / 2 : face === '-x' ? -Math.PI / 2 : face === '-z' ? Math.PI : 0;
    const w = (face === '+z' || face === '-z') ? x1 - x0 : z1 - z0, d = (face === '+z' || face === '-z') ? z1 - z0 : x1 - x0;
    if (!o.noCol) box(x0, 0, z0, x1, o.height + (o.y || 0), z1);
    return { width: Math.abs(w), depth: Math.abs(d), position: [(x0 + x1) / 2, o.y ?? 0, (z0 + z1) / 2], yaw, era: '2049', ...o };
  };
  const walls = ['brick', 'plaster', 'concrete', 'darkBrick', 'panel', 'stone'];
  const L = [];
  // avenue rows (west faces +x, east faces -x); the café block and the bakery block keep their ground floors for our fronts
  [[58, 46], [46, 31], [31, 14], [10, -8]].forEach(([a, b], i) => L.push(bld(-24, -10, b, a, '+x', i === 1
    ? { y: 4.2, noCol: true, height: 20, seed: 101, wall: 'plaster', groundFloor: 0.3, floorHeight: 3.2, faces: ['windows', 'windows', 'blank', 'blank'], led: 0.3 }   // the café block: our own ground floor below
    : { height: 18 + R() * 14, seed: 100 + i, wall: walls[i % 6], groundFloor: 4.2, faces: ['shop', 'windows', 'blank', 'blank'], groundBlank: i === 3 ? [true, false, false, false] : undefined, led: 0.4, holo: i % 2, cables: true })));
  [[58, 45], [45, 30], [30, 12], [12, -8]].forEach(([a, b], i) => L.push(bld(10, 24, b, a, '-x', { height: 16 + R() * 18, seed: 120 + i, wall: walls[(i + 2) % 6], groundFloor: 4.2, faces: ['shop', 'windows', 'blank', 'blank'], groundBlank: i === 3 ? [true, false, false, false] : undefined, led: 0.5, holo: 1, cables: true })));
  // square frame: corner blocks south of the square, the bank, the far east and west, beyond the hall and the tower
  L.push(bld(-46, -24, -8, 14, '-z', { height: 24, seed: 140, wall: 'stone', faces: ['windows', 'windows', 'blank', 'windows'], groundFloor: 4.4 }));
  L.push(bld(24, 50, -8, 14, '-z', { height: 28, seed: 141, wall: 'plaster', faces: ['shop', 'windows', 'blank', 'windows'], groundFloor: 4.4, led: 0.4 }));
  L.push(bld(28, 46, -40, -20, '-x', { height: 15, seed: 142, wall: 'stone', faces: ['blank', 'windows', 'windows', 'windows'], groundBlank: [true, false, false, false], groundFloor: 5.2, floorHeight: 4.2, roof: { tank: false, antenna: 1, hvac: 1 } }));
  L.push(bld(28, 52, -50, -40.6, '-x', { height: 20, seed: 143, wall: 'brick', faces: ['shop', 'windows', 'blank', 'windows'], groundFloor: 4.2 }));
  L.push(bld(47, 66, -40, -18, '-x', { height: 30, seed: 144, wall: 'panel', faces: ['windows', 'windows', 'windows', 'windows'], led: 0.6, holo: 2 }));
  L.push(bld(-66, -46, -46, -20, '+x', { height: 26, seed: 145, wall: 'darkBrick', faces: ['windows', 'windows', 'blank', 'windows'] }));
  L.push(bld(-70, -28, -82, -47, '+x', { height: 22, seed: 146, wall: 'brick', faces: ['windows', 'blank', 'blank', 'windows'] }));
  L.push(bld(58, 80, -96, -54, '-x', { height: 24, seed: 147, wall: 'concrete', faces: ['windows', 'blank', 'blank', 'blank'] }));
  L.push(bld(-14, 58, -124, -96.5, '+z', { height: 30, seed: 148, wall: 'brick', faces: ['windows', 'windows', 'blank', 'windows'], led: 0.4 }));
  L.push(bld(-80, -58, -120, -84, '+x', { height: 34, seed: 149, wall: 'panel', faces: ['windows', 'windows', 'blank', 'blank'], led: 0.5 }));
  // the station hall (Clock A); its roof is the observation terrace at 7.2 m (parapet 1.0 m)
  L.push(bld(-44, -28, -44, -18, '+x', { noCol: true, height: 8.2, seed: 150, wall: 'stone', faces: ['windows', 'windows', 'blank', 'windows'], groundFloor: 7.6, floorHeight: 4, roof: { parapet: 1.0, tank: false, hvac: 0, antenna: 0, bulkhead: false } }));
  // the clock tower on the station roof
  L.push(bld(-38, -32, -33, -27, '+x', { y: 7.2, height: 14.5, seed: 151, wall: 'stone', faces: ['blank', 'blank', 'blank', 'blank'], groundFloor: 3, roof: { parapet: 0.8, tank: false, hvac: 0, antenna: 1, bulkhead: false } }));
  // Meridian Tower (control tower): 64 m concrete with the observation ring at 48 m
  L.push(bld(-50, -38, -102, -90, '+x', { height: 64, seed: 152, wall: 'concrete', faces: ['windows', 'windows', 'windows', 'windows'], groundFloor: 5, floorHeight: 3.8, led: 0.3, roof: { antenna: 3, dish: 2, hvac: 1, bulkhead: true } }));
  try {
    const block = RZ.cityBlock(L, { era: '2049', lit: 0.18, daylight: 1 });
    scene.add(block.mesh); W.block = block.mesh;
    const sky = RZ.skyline({ center: [0, -30], radius: [170, 300], count: low ? 36 : 64, height: [40, 170], lit: 0.08, seed: 19 }); scene.add(sky.mesh || sky);
  } catch (e) { console.warn('m9 city', e); }

  // ================= perimeter (the loop's edge) =================
  box(57.5, 0, -125, 62, 40, -18); box(-62, 0, -84, -57.5, 40, -20); box(-62, 0, -112, -14, 40, -108);
  box(-62, 0, -20, -60, 40, -8); box(60, 0, -20, 62, 40, -8);
  W.edges = [];
  for (const x of [-60, 60]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(12, 14), new THREE.MeshBasicMaterial({ map: TEX.shimmer(), color: 0xbfe8ff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); e.position.set(x, 7, -14); e.rotation.y = Math.PI / 2; scene.add(e); W.edges.push(e); }
  // ================= the loop boundary + the tram viaduct (south) =================
  for (const x of [-16, 16]) { B.box(M.concrete, x - 0.9, 0, 42.8, x + 0.9, 7, 45.2); box(x - 0.9, 0, 42.8, x + 0.9, 7, 45.2); }
  B.box(M.concrete, -90, 7, 42.4, 90, 8.2, 45.6); B.box(M.dark, -90, 8.2, 42.4, 90, 9.2, 42.6); B.box(M.dark, -90, 8.2, 45.4, 90, 9.2, 45.6);
  for (let x = -84; x <= 84; x += 12) B.box(M.dark, x - 0.06, 7, 42.3, x + 0.06, 7.6, 42.5);
  const shimmer = new THREE.Mesh(new THREE.PlaneGeometry(60, 22, 1, 1), new THREE.MeshBasicMaterial({ map: TEX.shimmer(), color: 0xbfe8ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  shimmer.position.set(0, 10, 55.5); scene.add(shimmer); W.boundary = shimmer; shimmer.material.map.wrapS = THREE.RepeatWrapping;
  box(-60, 0, 55.4, 60, 30, 56.2);   // the boundary is solid for the player from the inside
  const cord = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.5), new THREE.MeshStandardMaterial({ map: TEX.cordon(), roughness: 0.6, side: THREE.DoubleSide })); cord.position.set(0, 1.0, 57.5); scene.add(cord);
  for (const x of [-7, 7]) B.cyl(M.dark, x, 0.55, 57.5, 0.05, 1.1, 8);

  // ================= Café Ostra (safe zone): our own ground floor under the café block (x -18..-10, z 31..46) =================
  const cx = -10, cb = -18;
  B.box(M.tile, cb, 0, 31, cx, Y0, 46); box(cb, 0, 31, cx, Y0, 46);
  B.box(M.plaster ?? M.concrete, cb - 0.3, 0, 31, cb, 4.2, 46); box(cb - 0.3, 0, 31, cb, 4.2, 46);                           // back wall
  for (const z of [31, 46]) { B.box(M.wood, cb, 0, z - 0.15, cx, 4.2, z + 0.15); box(cb, 0, z - 0.2, cx, 4.2, z + 0.2); }   // side walls
  B.box(M.wood, cb - 0.3, 4.05, 30.8, cx + 0.05, 4.3, 46.2);                                                                // ceiling under the block
  B.box(M.wood, cx - 0.3, 0, 31, cx, 0.7, 37.6); B.box(M.wood, cx - 0.3, 0, 40.4, cx, 0.7, 46); B.box(M.wood, cx - 0.3, 3.3, 31, cx, 4.2, 46);
  for (const z of [31.15, 34.5, 37.6, 40.4, 43.2, 45.85]) B.box(M.wood, cx - 0.32, 0.7, z - 0.1, cx + 0.02, 3.3, z + 0.1);
  B.box(glass, cx - 0.15, 0.7, 31, cx - 0.1, 3.3, 37.5); B.box(glass, cx - 0.15, 0.7, 40.5, cx - 0.1, 3.3, 46);
  box(cx - 0.3, 0, 31, cx, 4.2, 37.6); box(cx - 0.3, 0, 40.4, cx, 4.2, 46);                                               // front, door gap z 37.6..40.4
  B.box(warm, -16.5, 3.98, 33.5, -11.5, 4.02, 43.5); src(-14, 3.6, 38.5, 0xffd8a0, 10, 9, 'cafe');
  B.box(M.wood, -16.6, Y0, 33.0, -15.8, 1.1, 40.0); B.box(M.steel, -16.7, 1.1, 33.0, -15.7, 1.16, 40.0); box(-16.7, 0, 33.0, -15.7, 1.2, 40.0);   // counter
  B.box(M.steel, -17.7, 1.2, 33.4, -17.1, 1.9, 34.6); B.box(black, -17.85, 1.6, 35.2, -17.4, 2.2, 36.6);                   // espresso machine, menu
  for (let k = 0; k < 4; k++) B.box(M.wood, -17.95, 1.5 + k * 0.5, 41, -17.7, 1.54 + k * 0.5, 45);                         // shelves
  const awn = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 15.4), new THREE.MeshStandardMaterial({ color: 0x1c3a34, roughness: 0.8 })); awn.position.set(cx + 1.4, 3.5, 38.5); awn.rotation.z = -0.18; scene.add(awn);
  signPlane(TEX.cafe(), 4.2, 1.6, cx + 0.05, 5.0, 38.5, Math.PI / 2, 0.3);
  for (const [x, z] of [[-8.4, 33.5], [-8.4, 36.4], [-8.4, 42.5], [-13, 35.5], [-13, 42.5]]) { B.cyl(M.dark, x, Y0 + 0.37, z, 0.04, 0.74, 8); B.cyl(M.steel, x, Y0 + 0.75, z, 0.38, 0.03, 18); for (const sz of [-1, 1]) B.boxc(M.wood, x, Y0 + 0.24, z + sz * 0.6, 0.4, 0.48, 0.4); box(x - 0.4, 0, z - 0.4, x + 0.4, 0.8, z + 0.4); }
  B.box(M.dark, -16.4, 1.16, 35.7, -15.9, 1.42, 36.3); W.radioLed = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), glowMat(0x6affc8, 3)); W.radioLed.position.set(-15.88, 1.36, 36.0); scene.add(W.radioLed);

  // ================= avenue shopfronts: bakery (east, with the awning that falls at 08:13:20) and the TV shop =================
  const bx = 9.7;   // the bakery front stands proud of the block's plain ground floor
  const shopInt = new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffc890, emissiveIntensity: 0.32, roughness: 0.8 });
  B.box(shopInt, bx + 0.22, 0.6, -7.6, bx + 0.28, 3.4, 11.6);
  B.box(M.brick, bx, 0, -8, bx + 0.3, 0.6, 12); B.box(M.brick, bx, 3.4, -8, bx + 0.3, 4.2, 12);
  for (const z of [-7.75, -4, 0, 4, 8, 11.75]) B.box(M.brick, bx - 0.04, 0.6, z - 0.25, bx + 0.3, 3.4, z + 0.25);
  B.box(glass, bx + 0.1, 0.6, -8, bx + 0.14, 3.4, 12);
  for (let k = 0; k < 5; k++) B.box(M.wood, bx + 0.15, 1.0 + k * 0.45, -6 + k * 0.2, bx + 0.21, 1.04 + k * 0.45, 9.6);
  box(bx - 0.05, 0, -8, 10, 4.2, 12); src(8, 3.4, 2, 0xffd0a0, 6, 7, 'bakery');
  signPlane(TEX.bakery(), 3.6, 1.3, bx - 0.06, 4.9, 2, -Math.PI / 2, 0.3);
  const awning = new THREE.Group(); awning.position.set(bx - 0.05, 3.6, P.awning[2]); scene.add(awning);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 6), awningMat); cloth.position.set(-1.3, -0.25, 0); cloth.rotation.z = 0.2; awning.add(cloth);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 0.05), M.dark); arm.position.set(-1.3, -0.25, s * 2.9); arm.rotation.z = 0.2; awning.add(arm); }
  W.awning = awning;
  const tvx = -9.7;
  B.box(new THREE.MeshStandardMaterial({ color: 0x0c1016, emissive: 0x2a4a6a, emissiveIntensity: 0.25, roughness: 0.8 }), tvx - 0.28, 0.7, -5.8, tvx - 0.22, 3.3, 9.8);
  B.box(M.dark, tvx - 0.3, 0, -6, tvx, 0.7, 10); B.box(M.dark, tvx - 0.3, 3.3, -6, tvx, 4.2, 10); B.box(glass, tvx - 0.14, 0.7, -6, tvx - 0.1, 3.3, 10); box(-10, 0, -6, tvx + 0.05, 4.2, 10);
  for (const z of [-5.9, -1, 4, 9.9]) B.box(M.dark, tvx - 0.32, 0.7, z - 0.1, tvx + 0.02, 3.3, z + 0.1);
  W.tv = [0, 1, 2].map(i => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.96), new THREE.MeshBasicMaterial({ map: TEX.tv(0), toneMapped: false })); m.position.set(tvx - 0.18, 1.9, 1.6 + i * 2.2); m.rotation.y = Math.PI / 2; scene.add(m); return m; });
  signPlane(TEX.sign('VOLTA · SCREENS', 'MERIDIAN AVE 44'), 3.2, 0.8, tvx + 0.06, 4.7, 2, Math.PI / 2, 0.4);
  // Lantern Alley (west, z 10..14): shard + bins + steam
  B.box(M.paving, -24, 0, 10, -10, Y0, 14); box(-24, 0, 10, -10, Y0, 14);
  for (const [x, z] of [[-20.5, 13.2], [-16, 10.8]]) { B.box(M.rust, x - 0.8, Y0, z - 0.5, x + 0.8, Y0 + 1.3, z + 0.5); box(x - 0.8, 0, z - 0.5, x + 0.8, 1.45, z + 0.5); }
  box(-24.5, 0, 10, -24, 20, 14);
  // posters + street signs
  [[-9.9, 2.2, 22, Math.PI / 2, 0], [9.9, 2.2, 20, -Math.PI / 2, 1], [-25.9, 2.0, -48, Math.PI / 2, 2]].forEach(([x, y, z, ry, i]) => signPlane(TEX.poster(i), 1.0, 1.5, x, y, z, ry, 0.15));
  for (const [t, c, x, y, z, ry] of [['MERIDIAN', '#ff4fa0', 9.95, 8, 26, -Math.PI / 2], ['NOODLE 14', '#6affc8', -9.95, 7, 18, Math.PI / 2], ['24H', '#ffb347', 9.95, 6.5, -4, -Math.PI / 2]]) { const s = neonSign(t, c, 2.6, 0.7, {}); s.position.set(x, y, z); s.rotation.y = ry; scene.add(s); }

  // ================= Meridian Square =================
  // fountain: stone basin, a bronze ring sculpture, water disc
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; B.boxc(M.stone, Math.sin(a) * 4.5, Y0 + 0.35, -31 + Math.cos(a) * 4.5, 1.9, 0.7, 0.45, a); }
  box(-4.6, 0, -35.6, 4.6, 0.85, -26.4);
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.3, 32), new THREE.MeshPhysicalMaterial({ color: 0x405a64, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, envMapIntensity: 1.5 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, Y0 + 0.55, -31); scene.add(water); W.water = water;
  const ringS = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 10, 40, Math.PI * 1.7), brass); ringS.position.set(0, 2.8, -31); ringS.rotation.set(0.2, 0.5, 0.4); scene.add(ringS);
  B.cyl(M.stone, 0, Y0 + 0.9, -31, 0.35, 1.6, 12);
  // planters + trees
  const planters = [[-15, -20], [15, -20], [-15, -44], [15, -44]];
  for (const [x, z] of planters) { B.box(M.concrete, x - 1.3, Y0, z - 1.3, x + 1.3, Y0 + 0.6, z + 1.3); box(x - 1.3, 0, z - 1.3, x + 1.3, 0.75, z + 1.3); B.box(M.rubber, x - 1.15, Y0 + 0.6, z - 1.15, x + 1.15, Y0 + 0.62, z + 1.15); }
  if (!low) {
    try {
      const bark = pm('bark', {}, { mapping: 'triplanar', space: 'object' }), leaf = RZ.foliageMaterial('broadleaf');
      planters.forEach(([x, z], i) => { const t = RZ.tree({ species: 'broadleaf', height: 6, seed: 40 + i }); const g = new THREE.Group(); g.add(new THREE.Mesh(t.trunk, bark), new THREE.Mesh(t.leaves, leaf)); g.children.forEach(c => { c.castShadow = true; }); g.position.set(x, Y0 + 0.6, z); scene.add(g); });
    } catch (e) { console.warn('m9 trees', e); }
  }
  // PA speakers on poles (the voice comes from them)
  for (const [x, z] of [[-6.6, 26], [8, -18], [-8, -46], [0, -52.8]]) { B.cyl(M.dark, x, 2.4, z, 0.06, 4.8, 8); B.boxc(M.dark, x, 4.6, z, 0.36, 0.5, 0.36); B.boxc(black, x, 4.6, z + 0.19, 0.28, 0.4, 0.02); W.speakers.push([x, 4.6, z]); }

  // ================= the station (Clock A) =================
  signPlane(TEX.station(), 9, 1.5, -27.9, 5.6, -31, Math.PI / 2, 0.2);
  for (const z of [-24, -31, -38]) { B.box(M.dark, -28.1, Y0, z - 1.6, -27.9, 3.6, z + 1.6); }
  // external stair along the south face: 24 steps from (-27, Y0) west to the landing at 8.25 over the parapet
  const steps = 24, run = 0.38, x0s = -27.0, rise = (8.25 - Y0) / steps;
  for (let i = 0; i < steps; i++) { const xa = x0s - i * run, y = Y0 + (i + 1) * rise; B.box(M.stone, xa - run, 0, -17.9, xa, y, -15.7); box(xa - run, 0, -17.9, xa, y, -15.7); }
  const xl = x0s - steps * run;   // landing x end
  B.box(M.stone, xl - 2.2, 0, -19.3, xl, 8.25, -15.7); box(xl - 2.2, 0, -19.3, xl, 8.25, -15.7);
  for (let i = 0; i < 3; i++) { const y = 8.25 - (i + 1) * 0.35; B.box(M.stone, xl - 2.2, 7.2, -19.3 - (i + 1) * 0.4, xl, Math.max(7.25, y), -19.3 - i * 0.4); box(xl - 2.2, 0, -19.3 - (i + 1) * 0.4, xl, Math.max(7.25, y), -19.3 - i * 0.4); }
  for (let i = 0; i <= steps; i += 2) { const xa = x0s - i * run, y = Y0 + i * rise + 1.0; B.cyl(M.dark, xa, y - 0.5, -15.75, 0.025, 1.0, 6); }
  B.geo(M.dark, new THREE.BoxGeometry(steps * run + 0.4, 0.05, 0.05), [x0s - steps * run / 2, Y0 + 8.1 / 2 + 1.0, -15.75], [0, 0, -Math.atan2(8.1, steps * run)]);
  box(-27.1, 0, -15.75, xl, 9.3, -15.55);
  // the roof terrace (7.2) inside the parapet; colliders for the parapet edges (gap at the stile)
  box(-44, 0, -44, -28, 7.2, -18);
  box(-44, 7.2, -18.25, xl - 2.2, 8.2, -18); box(xl, 7.2, -18.25, -28, 8.2, -18);
  box(-28.25, 7.2, -44, -28, 8.2, -18); box(-44, 7.2, -44, -43.75, 8.2, -18); box(-44, 7.2, -44, -28, 8.2, -43.75);
  box(-38, 7.2, -33, -32, 22, -27);   // tower
  // Clock A faces (east + south) + the sync cabinet under it + the observation scope at the east parapet
  const faceA = clockFace({ name: 'MERIDIAN', sub: 'STATION', aged: true });
  const mkClock = (r, tex, x, y, z, ry) => { const c = settableClock(r, tex, { h: 8, m: 5, glow: 0.18, depth: 0.2 }); c.position.set(x, y, z); c.rotation.y = ry; scene.add(c); return c; };
  W.clocks.A = [mkClock(1.9, faceA, -31.85, 17.2, -30, Math.PI / 2), mkClock(1.9, faceA, -35, 17.2, -26.85, 0)];
  B.box(brass, -31.95, 7.2, -31.0, -31.6, 9.2, -29.0); W.nodeA = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.35), new THREE.MeshStandardMaterial({ map: TEX.nodePlate(), roughness: 0.45, emissive: 0xffffff, emissiveMap: TEX.nodePlate(), emissiveIntensity: 0.25 })); W.nodeA.position.set(-31.58, 8.4, -30); W.nodeA.rotation.y = Math.PI / 2; scene.add(W.nodeA);
  W.nodeALamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), gold.clone()); W.nodeALamp.position.set(-31.55, 9.35, -30); scene.add(W.nodeALamp);
  box(-32, 7.2, -31.0, -31.55, 9.2, -29.0);
  B.cyl(M.dark, -29.0, 7.2 + 0.6, -30, 0.05, 1.2, 8); B.geo(M.steel, new THREE.CylinderGeometry(0.09, 0.12, 0.6, 12), [-29.0, 8.45, -30], [0, 0, Math.PI / 2]);
  box(-29.2, 7.2, -30.2, -28.8, 8.4, -29.8);
  B.box(M.wood, -36.5, 7.2, -40.6, -33, 7.65, -39.6); // a bench on the roof
  src(-31, 9.5, -30, 0xffd8a0, 6, 8, 'roof');

  // ================= the Bank of Meridian (Clock B) =================
  B.box(M.stone, 22.2, 0, -37.6, 28, Y0 + 0.3, -22.4);
  for (let i = 1; i <= 4; i++) B.box(M.stone, 22.2 + i * 0.95, 0, -37.6, 28, Y0 + 0.3 * (i + 1), -22.4);
  for (let i = 0; i <= 4; i++) box(22.2 + i * 0.95, 0, -37.6, 28, Y0 + 0.3 * (i + 1), -22.4);
  const PY = Y0 + 1.5;
  for (let k = 0; k < 6; k++) { const z = -36 + k * 2.4 + (k > 2 ? 0.4 : 0) - 0.2; B.cyl(M.stone, 26.4, PY + 2.9, z, 0.36, 5.8, 16); B.box(M.stone, 25.9, PY, z - 0.5, 26.9, PY + 0.25, z + 0.5); box(26.05, 0, z - 0.36, 26.75, 7.6, z + 0.36); }
  B.box(M.stone, 25.6, PY + 5.8, -37.8, 28.1, PY + 6.7, -22.2); // entablature
  const pedS = new THREE.Shape(); pedS.moveTo(-7.8, 0); pedS.lineTo(7.8, 0); pedS.lineTo(0, 2.3); pedS.closePath();
  const pedG = new THREE.ExtrudeGeometry(pedS, { depth: 1.2, bevelEnabled: false }); pedG.rotateY(Math.PI / 2);
  B.geo(M.stone, pedG, [25.7, PY + 6.7, -30]);
  signPlane(TEX.bank(), 8, 1.1, 25.58, PY + 6.25, -30, -Math.PI / 2, 0.08);
  const faceB = clockFace({ name: 'BANK OF', sub: 'MERIDIAN', paper: '#f2ead8' });
  W.clocks.B = [mkClock(1.05, faceB, 25.55, PY + 7.75, -30, -Math.PI / 2)];
  B.box(M.wood, 27.9, PY, -32.2, 28.05, PY + 3.4, -27.8); // bank doors
  B.box(brass, 27.6, PY + 0.6, -30.9, 27.95, PY + 1.9, -29.6); W.cabB = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), gold.clone()); W.cabB.position.set(27.58, PY + 2.05, -30.25); scene.add(W.cabB);
  box(27.6, 0, -30.9, 28.1, PY + 1.9, -29.6);
  src(26.8, 6.6, -30, 0xfff0d8, 6, 10, 'bank');

  // ================= the Market Hall (Clock C) x -16..16, z -56..-82 =================
  const HZ0 = -56, HZ1 = -82, HH = 9.0;
  const hallWall = (x0, z0, x1, z1, gaps = []) => {
    const alongX = Math.abs(z1 - z0) < 0.01, a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
    const cuts = [a0]; for (const [g0, g1] of gaps) cuts.push(g0, g1); cuts.push(a1);
    for (let i = 0; i < cuts.length; i += 2) { const s0 = cuts[i], s1 = cuts[i + 1]; if (s1 - s0 < 0.02) continue; if (alongX) { B.box(M.brick, s0, 0, z0 - 0.3, s1, HH, z0 + 0.3); box(s0, 0, z0 - 0.3, s1, HH, z0 + 0.3); } else { B.box(M.brick, x0 - 0.3, 0, s0, x0 + 0.3, HH, s1); box(x0 - 0.3, 0, s0, x0 + 0.3, HH, s1); } }
    for (const [g0, g1] of gaps) { if (alongX) B.box(M.brick, g0, 4.6, z0 - 0.3, g1, HH, z0 + 0.3); else B.box(M.brick, x0 - 0.3, 4.6, g0, x0 + 0.3, HH, g1); }
  };
  hallWall(-16, HZ0, 16, HZ0, [[-3.2, 3.2]]); hallWall(-16, HZ1, 16, HZ1, [[7.6, 10.4]]); hallWall(-16, HZ0, -16, HZ1); hallWall(16, HZ0, 16, HZ1);
  // arched window strips (dark glass) + piers outside
  for (let x = -14; x <= 14; x += 4) if (Math.abs(x) > 4) { B.box(glass, x - 1.1, 2.0, HZ0 + 0.31, x + 1.1, 7.6, HZ0 + 0.34); B.box(M.stone, x - 1.25, 1.8, HZ0 + 0.3, x + 1.25, 2.0, HZ0 + 0.5); }
  for (let z = -60; z >= -78; z -= 4) for (const s of [-1, 1]) B.box(glass, s * 16.3 - 0.02, 2.0, z - 1.1, s * 16.34, 7.6, z + 1.1);
  B.box(M.stone, -16.4, HH, HZ1 - 0.4, 16.4, HH + 0.5, HZ0 + 0.4);
  // pitched glass roof on steel trusses
  for (const s of [-1, 1]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(26.4, 17.6), glass); g.position.set(s * 8.2, HH + 2.6, (HZ0 + HZ1) / 2); g.rotation.set(-Math.PI / 2, s * -0.34, Math.PI / 2); scene.add(g); }
  for (let z = HZ0 - 2; z > HZ1; z -= 4) { for (const s of [-1, 1]) B.geo(M.steel, new THREE.BoxGeometry(17.4, 0.22, 0.18), [s * 8.2, HH + 2.6, z], [0, 0, s * 0.34]); B.box(M.steel, -0.1, HH + 0.5, z - 0.09, 0.1, HH + 5.6, z + 0.09); }
  signPlane(TEX.hall(), 12, 3, 0, HH - 1.6, HZ0 + 0.34, 0, 0.12);
  // the shutter (opens 08:10)
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4.6, 0.12), M.paint); shutter.position.set(0, 2.3, HZ0 + 0.1); scene.add(shutter); W.shutter = shutter;
  W.shutterBox = box(-3.2, 0, HZ0 - 0.25, 3.2, 4.6, HZ0 + 0.25);
  const backDoor = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.2, 0.1), M.rust); backDoor.position.set(9, 1.6, HZ1); scene.add(backDoor); W.backDoor = backDoor;
  W.backDoorBox = box(7.6, 0, HZ1 - 0.25, 10.4, 4.6, HZ1 + 0.25);
  // floor + stalls
  B.box(M.tile, -15.7, 0, HZ1 + 0.3, 15.7, Y0, HZ0 - 0.3); box(-15.7, 0, HZ1 + 0.3, 15.7, Y0, HZ0 - 0.3);
  const stall = (x, z, w = 3, d = 2) => { B.box(M.wood, x - w / 2, Y0, z - d / 2, x + w / 2, Y0 + 0.95, z + d / 2); B.box(M.steel, x - w / 2 - 0.05, Y0 + 0.95, z - d / 2 - 0.05, x + w / 2 + 0.05, Y0 + 1.0, z + d / 2 + 0.05); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cyl(M.dark, x + sx * (w / 2 - 0.05), Y0 + 1.6, z + sz * (d / 2 - 0.05), 0.03, 1.3, 6); B.box(awningMat, x - w / 2 - 0.1, Y0 + 2.25, z - d / 2 - 0.1, x + w / 2 + 0.1, Y0 + 2.3, z + d / 2 + 0.1); box(x - w / 2, 0, z - d / 2, x + w / 2, 1.1, z + d / 2); };
  for (const [x, z] of [[-9, -62], [-9, -68], [-9, -74], [9, -62], [9, -68], [5, -76], [-3.5, -64], [3.5, -64]]) stall(x, z);
  // gallery along the north wall at 4.0 with a stair up the west wall (x -15.2 .. -13.2)
  B.box(M.wood, -15.7, 3.8, -81.7, 15.7, 4.0, -78.4); box(-15.7, 3.8, -81.7, 15.7, 4.0, -78.4);
  B.box(M.dark, -13.0, 4.0, -78.45, 15.7, 5.0, -78.35); box(-13.0, 4.0, -78.5, 15.7, 5.1, -78.3);
  for (let i = 0; i < 12; i++) { const z = -64 - i * 1.2, y = Y0 + (i + 1) * ((4.0 - Y0) / 12); B.box(M.wood, -15.6, 0, z - 1.2, -13.0, y, z); box(-15.6, 0, z - 1.2, -13.0, y, z); }
  B.box(M.wood, -15.6, 0, -79.0, -13.0, 4.0, -78.4); box(-15.6, 0, -79.0, -13.0, 4.0, -78.4);
  // Clock C: four faces hanging under the roof on a steel frame, its sync panel on the gallery
  const faceC = clockFace({ name: 'MARKET', sub: 'HALL · 1928', paper: '#efe4c8', aged: true });
  W.clocks.C = [0, 1, 2, 3].map(k => { const a = k * Math.PI / 2, c = mkClock(1.2, faceC, Math.sin(a) * 1.25, 6.6, -68 + Math.cos(a) * 1.25, a); return c; });
  B.box(M.dark, -1.25, 5.3, -69.25, 1.25, 7.9, -66.75); B.cyl(M.steel, 0, 9.6, -68, 0.05, 3.4, 6);
  B.box(brass, -2.9, 4.0, -81.6, -1.1, 5.6, -81.25); W.nodeCLamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), gold.clone()); W.nodeCLamp.position.set(-2.0, 5.8, -81.2); scene.add(W.nodeCLamp);
  B.geo(M.dark, new THREE.CylinderGeometry(0.03, 0.03, 15, 6), [-1.0, 5.6, -74.5], [Math.PI / 2 - 0.12, 0, 0.12]);
  src(0, 7.4, -68, 0xfff0d0, 10, 14, 'hall'); src(-9, 3, -68, 0xffd8a0, 5, 8, 'hall'); src(9, 3, -70, 0xffd8a0, 5, 8, 'hall');
  // the soup pot steam / lamps over stalls
  for (const [x, z] of [[-9, -62], [9, -68], [-3.5, -64]]) B.box(warm, x - 0.3, Y0 + 2.2, z - 0.3, x + 0.3, Y0 + 2.24, z + 0.3);

  // ================= the substation yard: fence, transmitter mast, cores, cabin, guard post =================
  const fenceMat = new THREE.MeshStandardMaterial({ map: TEX.fence(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 });
  fenceMat.map.wrapS = fenceMat.map.wrapT = THREE.RepeatWrapping;
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), m = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.6), fenceMat.clone()); m.material.map = fenceMat.map.clone(); m.material.map.repeat.set(len / 1.6, 1.6); m.material.map.needsUpdate = true;
    m.position.set((x0 + x1) / 2, 1.3, (z0 + z1) / 2); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); scene.add(m);
    for (let k = 0; k <= len; k += 3) B.cyl(M.dark, x0 + (x1 - x0) * k / len, 1.35, z0 + (z1 - z0) * k / len, 0.04, 2.7, 6);
    box(Math.min(x0, x1) - 0.1, 0, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, 2.7, Math.max(z0, z1) + 0.1);
  };
  fence(30, -56, 56, -56); fence(56, -56, 56, -86); fence(30, -86, 56, -86); fence(30, -56, 30, -65.5); fence(30, -70.5, 30, -86);
  B.box(M.concrete, 30, 0, -86, 56, 0.06, -56);
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.4), fenceMat); gate.position.set(32.4, 1.2, -65.3); scene.add(gate); W.gate = gate;
  // guard post
  B.box(white, 32, 0, -61.4, 35, 2.8, -58); B.box(glass, 31.98, 1.0, -61.2, 32.0, 2.4, -58.2); box(32, 0, -61.4, 35, 2.8, -58);
  W.orderScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.39), new THREE.MeshBasicMaterial({ map: TEX.order(), toneMapped: false })); W.orderScreen.position.set(31.9, 1.25, -59.6); W.orderScreen.rotation.y = -Math.PI / 2 + 0.3; scene.add(W.orderScreen);
  B.box(M.steel, 31.2, 0, -60.2, 31.9, 1.0, -59.0);
  // Helix crate
  B.box(white, 36.5, 0, -84.4, 38.6, 1.3, -82.6); const crateLbl = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95), new THREE.MeshStandardMaterial({ map: TEX.crate(), roughness: 0.6 })); crateLbl.position.set(37.55, 0.7, -82.58); scene.add(crateLbl); box(36.5, 0, -84.4, 38.6, 1.3, -82.6);
  for (const [x, z] of [[34, -78], [40, -62], [52, -62]]) { B.box(M.rust, x - 1, 0, z - 0.7, x + 1, 1.4, z + 0.7); box(x - 1, 0, z - 0.7, x + 1, 1.4, z + 0.7); }
  // transformers
  for (const [x, z] of [[36, -68], [52, -70]]) { B.box(M.paint, x - 1.4, 0, z - 1.1, x + 1.4, 2.4, z + 1.1); for (let k = -1; k <= 1; k++) B.cyl(white, x + k * 0.8, 2.8, z, 0.12, 0.8, 8); box(x - 1.4, 0, z - 1.1, x + 1.4, 2.6, z + 1.1); }
  // mast: a lattice tower, three gold emitter rings, a dish at the top
  const mx = P.mast[0], mz = P.mast[2], MH = 28;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.geo(M.steel, new THREE.CylinderGeometry(0.08, 0.12, MH, 6), [mx + sx * 0.9, MH / 2, mz + sz * 0.9], [sz * 0.03, 0, -sx * 0.03]);
  for (let y = 2; y < MH; y += 2.4) { const s = 1 - y / MH * 0.06; for (const [a, b] of [[[-1, -1], [1, 1]], [[1, -1], [-1, 1]]]) B.geo(M.steel, new THREE.BoxGeometry(2.6 * s, 0.05, 0.05), [mx, y + 1.2, mz + (a[1] + b[1]) * 0.0], [0, Math.atan2(b[1] - a[1], b[0] - a[0]), 0.6]); }
  box(mx - 1.1, 0, mz - 1.1, mx + 1.1, MH, mz + 1.1);
  W.rings = [9, 16, 23].map((y, i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(2.2 - i * 0.4, 0.09, 8, 48), gold.clone()); r.position.set(mx, y, mz); r.rotation.x = Math.PI / 2; scene.add(r); return r; });
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.4, 20, 10, 0, Math.PI * 2, 0, 1.0), M.steel); dish.position.set(mx, MH + 0.3, mz); dish.rotation.x = Math.PI; scene.add(dish);
  W.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), red.clone()); W.beacon.position.set(mx, MH + 1.0, mz); scene.add(W.beacon);
  // the shield (array lock) and the three power cores
  W.shield = new THREE.Mesh(new THREE.SphereGeometry(4.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  W.shield.position.set(mx, 0, mz - 1.3); scene.add(W.shield);
  W.shieldBox = box(mx - 3.3, 0, mz - 4.6, mx + 3.3, 3, mz + 2.0);
  CORES.forEach(([x, z]) => { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.7), M.dark); base.position.y = 0.45; g.add(base); const core = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 12), gold.clone()); core.position.y = 1.35; g.add(core); W.cores.push({ g, core, x, z, home: 1.35 }); });
  // the cabin (Ines inside) with the blast door facing west and an intercom grille on the north wall
  B.box(M.paint, 48, 0, -83, 54, 3.4, -77); B.box(M.dark, 47.8, 3.4, -83.2, 54.2, 3.6, -76.8); box(48, 0, -83, 54, 3.6, -77);
  B.box(glass, 53.0, 1.2, -76.98, 53.8, 2.4, -76.95);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 1.8), M.rust); door.position.set(47.9, 1.2, -80); scene.add(door); W.cabinDoor = door;
  W.cabinLamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), red.clone()); W.cabinLamp.position.set(47.75, 2.75, -81.2); scene.add(W.cabinLamp);
  B.box(M.dark, 50.6, 1.2, -83.12, 51.4, 1.7, -83.0);
  src(mx, 9, mz, 0xffd27a, 8, 14, 'yard');

  // ================= north lane and the tower plaza (final approach) =================
  for (const [x, z, s] of [[-2, -89, 1.1], [6, -92.5, 1], [-12, -91, 1.2], [20, -90.5, 1], [-26, -93, 1.1], [12, -88.6, 0.9]]) { B.box(M.wood, x - 0.7 * s, 0, z - 0.6 * s, x + 0.7 * s, 1.25 * s, z + 0.6 * s); box(x - 0.7 * s, 0, z - 0.6 * s, x + 0.7 * s, 1.25 * s, z + 0.6 * s); }
  for (const [x, z] of [[-6, -95], [28, -94]]) { B.box(M.rust, x - 1.5, 0, z - 0.9, x + 1.5, 1.6, z + 0.9); box(x - 1.5, 0, z - 0.9, x + 1.5, 1.6, z + 0.9); }
  // tower base: lobby glass + the glass lift shaft on the east face
  B.box(glass, -38.05, Y0, -101, -37.95, 4.8, -91); B.box(M.dark, -38.3, 4.8, -102, -37.7, 5.3, -90);
  const sh0 = -35.4, sh1 = -38.0, sz0 = -94.4, sz1 = -97.6;
  for (const [x, z] of [[sh0, sz0], [sh0, sz1]]) B.box(M.steel, x - 0.12, 0, z - 0.12, x + 0.12, 49.6, z + 0.12);
  B.box(glass, sh0 - 0.03, Y0, sz1, sh0 + 0.03, 49.6, sz0); B.box(glass, sh1 + 0.3, Y0, sz0 - 0.03, sh0, 49.6, sz0 + 0.03); B.box(glass, sh1 + 0.3, Y0, sz1 - 0.03, sh0, 49.6, sz1 + 0.03);
  for (let y = 6; y < 49; y += 6) B.box(M.steel, sh1 + 0.3, y, sz1, sh0 + 0.1, y + 0.12, sz0);
  box(sh0 - 0.1, 0, sz1, sh0 + 0.1, 50, sz0 - 1.6); box(sh1, 0, sz0 - 0.1, sh0, 50, sz0 + 0.1); box(sh1, 0, sz1 - 0.1, sh0, 50, sz1 + 0.1);
  const cab = new THREE.Group(); cab.position.set(-36.7, 0, -96); scene.add(cab);
  const cabFloor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 2.9), M.dark); cabFloor.position.y = Y0 - 0.05; cab.add(cabFloor);
  const cabRoof = cabFloor.clone(); cabRoof.position.y = 2.75; cab.add(cabRoof);
  const cabLight = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.3), cyan); cabLight.position.y = 2.66; cab.add(cabLight);
  W.liftCab = cab; W.liftPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42), new THREE.MeshStandardMaterial({ color: 0x0a0c10, emissive: 0xff4d5e, emissiveIntensity: 1.2 })); W.liftPanel.position.set(-35.1, 1.4, -93.7); scene.add(W.liftPanel);
  B.box(M.dark, -35.15, 0.9, -93.95, -35.05, 1.9, -93.45);
  // the observation ring at 48 m: a deck around the tower with a railing and the anchor pedestal on the east side
  const DY = 48;
  B.box(M.concrete, -53, DY - 0.3, -105, -35, DY, -87); box(-53, DY - 0.3, -105, -35, DY, -87);
  for (const [x0, z0, x1, z1] of [[-53, -105, -35, -104.8], [-53, -87.2, -35, -87], [-53.2, -105, -53, -87], [-35, -105, -34.8, -87]]) { B.box(glass, x0, DY, z0, x1, DY + 1.1, z1); B.box(M.steel, x0, DY + 1.1, z0, x1, DY + 1.18, z1); box(x0, DY, z0, x1, DY + 1.3, z1); }
  const ped = new THREE.Group(); ped.position.set(P.anchor[0], DY, P.anchor[2]); scene.add(ped);
  const pBase = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.0, 16), M.dark); pBase.position.y = 0.5; ped.add(pBase);
  const pRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 28), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.8, roughness: 0.4, emissive: 0xff6a4a, emissiveIntensity: 0.9 })); pRing.position.y = 1.08; pRing.rotation.x = Math.PI / 2; ped.add(pRing);
  W.anchorRing = pRing; box(P.anchor[0] - 0.5, DY, P.anchor[2] - 0.5, P.anchor[0] + 0.5, DY + 1.0, P.anchor[2] + 0.5);
  src(-36, DY + 3, -96, 0xeaf2ff, 4, 10, 'deck');
  // tower door sign
  signPlane(TEX.sign('MERIDIAN TOWER', 'CONTROL · OBSERVATION RING 48 M'), 4, 1, -37.9, 6.0, -96, Math.PI / 2, 0.35);

  // ================= damage that changes from loop to loop (the loop is wearing out) =================
  const dmg = (it, mesh, x, y, z, ry = 0) => { mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.visible = false; mesh.userData.noBatch = true; scene.add(mesh); W.damage.push({ it, mesh }); return mesh; };
  const crackTex = canvasTex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); const r = rng(3); g.strokeStyle = 'rgba(20,18,16,0.9)'; for (let k = 0; k < 7; k++) { g.lineWidth = 1 + r() * 3; g.beginPath(); let x = w / 2, y = h / 2; g.moveTo(x, y); for (let j = 0; j < 9; j++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); } }, 'm9crack');
  const crackMat = new THREE.MeshStandardMaterial({ map: crackTex, transparent: true, depthWrite: false, roughness: 0.9 });
  const crack = (it, x, z, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), crackMat); m.rotation.x = -Math.PI / 2; dmg(it, m, x, Y0 + 0.02, z); m.rotation.x = -Math.PI / 2; };
  crack(3, 2, -24, 5); crack(4, -6, -38, 6); crack(5, 12, -28, 7); crack(6, -2, 8, 6);
  const rub = (it, x, z, n) => { const g = new THREE.Group(); const r = rng(it * 7 + n); for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.3 + r() * 0.6, 0.2 + r() * 0.4, 0.3 + r() * 0.6), M.concrete); m.position.set((r() - 0.5) * 3, 0.15, (r() - 0.5) * 3); m.rotation.set(r(), r(), r()); g.add(m); } dmg(it, g, x, Y0, z); };
  rub(4, -18, -12, 10); rub(5, 20, -46, 12); rub(6, -4, 18, 9); rub(7, 0, -52, 14);
  const lampFallen = lampPost(0xffe0b0, 6.5); lampFallen.rotation.z = Math.PI / 2 - 0.15; dmg(5, lampFallen, -8.6, Y0, -2); lampFallen.rotation.z = Math.PI / 2 - 0.15;
  // the tram (stops at the square 08:09:20-08:09:50, eastbound)
  try {
    const tram = new THREE.Group(); const car = trainCar(18, 0xe9edf2, 0xffd34a); tram.add(car); car.scale.setScalar(0.92);
    tram.position.set(-110, 0.0, -12.6); tram.rotation.y = Math.PI / 2; scene.add(tram); W.tram = tram;
    tram.traverse(o => { o.userData.noBatch = true; });
    W.tramBox = box(-200, 0, -14.2, -199, 3.6, -11.0);
  } catch (e) { console.warn('m9 tram', e); }

  // ================= shards =================
  const shardMat = glowMat(0x9fe8ff, 3.2);
  SHARDS.forEach(p => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), shardMat); m.position.set(...p); m.userData.noBatch = true; scene.add(m); W.shards.push(m); });

  // ================= street lights in daylight: a few lamps still on (Sunday morning, overcast) =================
  for (const [x, z, ry] of [[-24, -50, 0], [24, -50, 0], [-20, -86, 0], [26, -86, 0], [-30, -84, Math.PI]]) { const l = lampPost(0xffe0b0, 6.5, { era: '2049' }); l.position.set(x, Y0, z); l.rotation.y = ry; scene.add(l); box(x - 0.12, 0, z - 0.12, x + 0.12, 6, z + 0.12); }

  B.build(scene, { game, blockers: false });
  W.update = (dt, t) => {
    if (W.boundary) { W.boundary.material.map.offset.x = (t * 0.02) % 1; W.boundary.material.opacity = 0.28 + Math.sin(t * 0.8) * 0.06; }
    W.shards.forEach((m, i) => { if (m.parent) { m.rotation.y = t * 1.4 + i; m.position.y = SHARDS[i][1] + Math.sin(t * 2 + i) * 0.06; } });
    if (W.water) W.water.material.opacity = 0.82 + Math.sin(t * 1.3) * 0.03;
  };
  return W;
}
