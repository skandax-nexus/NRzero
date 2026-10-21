// Mission 12 environment: Helix Temporal Research, west wing, in three authored states (2026 / 2049 / 2196).
// 2049: Observation Gallery C over Test Hall C, the east research corridor (Rook's office, the lockdown shutter, the
// security node), the north corridor and the bricked-up end of the old west service run.
// 2026: the same service run while Helix is still being built (bare bulbs, hoarding, the cable-vault trench, the
// night watchman's desk at the west stair core).
// 2049 again inside the run: Records Storage B, a room sealed in 2031 with no door.
// 2196: the ruined west atrium (flooded ground floor, broken slabs, a girder, a missing catwalk).
// All three: Core Ring B (the hub where the trail goes cold), the sublevel descent and Chamber II with the second
// Chronolith ("Artefact B"). North = -z. Static geometry is merged per material per era (env_m6 Batch).
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng, chronolith, cableCurve } from './kit.js';
import { Batch } from './env_m6.js';
import { registerCast } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';

export const ERAS = ['2026', '2049', '2196'];
// The Witness's route down the sublevel stair (landing 1..4): what the fragments reconstruct.
export const ROUTE = ['2026', '2196', '2026', '2049'];
export const HUB = { x: -73, z: -84, r: 9 };
export const CH2 = { x: -73, z: -136, r: 10, y: -8 };
// sublevel stair segments (the field is only stable in the state he crossed it in) and the landings between them
export const SEGS = [0, 1, 2, 3].map(k => ({ k, z0: -96 - 8 * k, z1: -102 - 8 * k, y0: -2 * k, y1: -2 * (k + 1) }));
export const LANDINGS = [0, 1, 2, 3].map(k => ({ k, z: k === 0 ? -94.5 : -103 - 8 * (k - 1), y: -2 * k }));

// Key positions used by the script and the playthrough test
export const P = {
  start: [-2.6, 0, -3.2], glass: [0, 0, -7.6], witnessHall: [2.0, 0, -10.4], galleryDoor: [8, 0, -3.5],
  intercom: [-7.6, 1.3, -1.2], rookDoor: [12, 0, -12], rookDesk: [16.6, 0, -13.4], shutter: [10, 0, -21],
  node: [12.5, 0, -30], nodeExit: [10, 0, -38], northStart: [10, 0, -42], deadEnd: [-23.2, 0, -42],
  d1: [-27.5, 0, -42], trench: [-38, 0, -42], records: [-38, 0, -42], d3: [-48.5, 0, -42], lobby: [-55, 0, -42],
  ben: [-55.4, 0, -38.9], book: [-54.2, 0.9, -37.4], breach: [-58.2, 0, -42],
  ledge: [-60, 0, -42], slabA: [-71, 2.4, -45], girder: [-72, 2.4, -56], slabB: [-72, 2.4, -61.5], gapFrom: [-72, 2.4, -63.4], gapTo: [-72, 2.4, -70.6],
  slabC: [-73, 2.4, -72], scout: [-86.5, 2.4, -61.6], hubIn: [-73, 0, -77.2], hubC: [-73, 0, -84], board: [-73, 0, -91.2],
  chamberDoor: [-73, -8, -126.5], witnessCh: [-71.4, -8, -133.2], ch2: [-73, -8, -137],
};
// Residue fragments of the Witness's passage, thrown back up the shaft by the field (repeated, out of order)
export const FRAGS = [
  { id: 'arrive', era: '2196', pos: [-73, 0, -77.8], landing: 0, band: '+0:00', yaw: 0, act: 'look',
    line: 'He came off the slab right here, like me. Looked at his band. Plus zero. He started a clock.' },
  { id: 'l1', era: '2026', pos: [-79.2, 0, -82.0], landing: 1, band: '+0:21', yaw: Math.PI, act: 'walk',
    line: 'Landing one, stencilled on the wall. Bare bulbs, wet formwork. 2026. Band at plus twenty-one.' },
  { id: 'l2', era: '2196', pos: [-66.8, 0, -80.6], landing: 2, band: '+0:44', yaw: Math.PI, act: 'walk',
    line: 'Landing two. Moss on the steps and the handrail hanging off. 2196. Plus forty-four.' },
  { id: 'l3', era: '2026', pos: [-67.4, 0, -88.6], landing: 3, band: '+1:09', yaw: Math.PI, act: 'walk',
    line: 'Landing three. The bulbs again, the timber shuttering. Back in 2026. Plus one minute nine.' },
  { id: 'l4', era: '2049', pos: [-77.6, 0, -90.0], landing: 4, band: '+1:30', yaw: Math.PI, act: 'walk',
    line: 'Landing four. White panels, a Helix exit sign. 2049. Plus one-thirty. Then nothing.' },
  { id: 'rep', era: '2196', pos: [-73.2, 0, -87.2], landing: 2, band: '+0:44', yaw: Math.PI, act: 'walk', repeat: true,
    line: 'Landing two again. The same twenty seconds, again. The field doesn\'t lose what passes through it. It repeats it.' },
];
export const SHARDS = [
  [17.6, 0.9, -9.2, 'Dr. Rook\'s office'], [-36.2, 0.9, -45.2, 'Records Storage B'], [-88.6, 3.3, -58.4, 'the scouts\' ledge in the ruined atrium'],
  [-79.0, 0.9, -80.0, 'Core Ring B'], [-74.4, -3.1, -111.0, 'landing two of the sublevel stair'],
];
// The Witness's notes, in Kai's own handwriting
export const NOTES = [
  { pos: [11.2, 0.95, -23.6], era: '2049', title: 'Note: the shutter', text: '"The shutter on the east run jams at half a metre. It always has. Step through it." Kai\'s handwriting. Older ink.' },
  { pos: [-26.0, 0.95, -40.5], era: '2026', title: 'Note: the bricked door', text: '"West service run. Bricked up March 2031. Walk it in 2026, the trench in 2049, the rest in 2026." Kai\'s handwriting, on a Helix memo slip dated 2049.' },
  { pos: [-69.4, 3.35, -50.6], era: '2196', title: 'Note: the ruin', text: '"Don\'t let him stop in the ruin. Sera\'s people will feed him and he will stay for a week. He always does." The same hand, shakier.' },
];

// ---------------------------------------------------------------------------------------------
// Cast (registerCast never overwrites an existing id)
// ---------------------------------------------------------------------------------------------
export const GUARD49 = { era: '2049', costume: 'helix_sec_1', sex: 0, age: 36, height: 1.84, build: 1.1, skin: 0x8c5a3a, hair: 0x111111, hairStyle: 'buzz', topType: 'uniform', top: 0x1d2a44, topKind: 'synthetic', vest: 0x1b1e23, pantsType: 'cargo', pants: 0x1b1e23, shoes: 'boots', boots: 0x0f0f10, gloves: 0x101010, lod: true };
export const GUARD49F = { era: '2049', costume: 'helix_sec_2', sex: 1, female: true, age: 31, height: 1.71, build: 1.0, skin: 0xe8b996, hair: 0x5a3a22, hairStyle: 'tied-back', topType: 'uniform', top: 0x1d2a44, topKind: 'synthetic', vest: 0x1b1e23, pantsType: 'cargo', pants: 0x1b1e23, shoes: 'boots', boots: 0x0f0f10, gloves: 0x101010, lod: true };
export function registerM12Cast() {
  // Ben Asante: Helix's night watchman while the west wing was being built (COSTUMES.md c26_m3 older man, as a site
  // watchman: a navy padded work jacket over a grey crew-neck, charcoal work trousers, safety boots, a phone)
  registerCast('ben', {
    name: 'BEN ASANTE', role: 'Night watchman · Helix west wing site · 2026',
    bio: 'Fifty-eight. Watches the half-built west wing for a security contractor. Keeps a visitor book nobody signs. Tonight two men walked out of a wall.',
    look: { era: '2026', costume: 'c26_m3', sex: 0, age: 58, height: 1.76, build: 1.08, skin: 0x5a3622, hair: 0x6a6460, hairStyle: 'short', eyes: 0x24160c, stubble: true,
      face: { jaw: 0.25, cheek: 0.2, nose: 0.1, noseWidth: 0.45, lips: 0.3, brow: 0.2, eyeSize: -0.05, faceLength: -0.1, chin: 0.05 }, wrinkles: 0.55,
      topType: 'jacket', top: 0x1d2430, topKind: 'fabric', pantsType: 'trousers', pants: 0x2d2a26, shoes: 'boots', boots: 0x2a1d14, cap: 0x1d2430 },
    rimColor: 0xffc890, glow: 0x201408, bg: 0x0c0a08,
    vp: { sex: 'm', pitch: 0.82, rate: 0.92, langs: ['en-GB', 'en-NG', 'en-US'] },
  });
  // Ife: a scout of Sera's people in 2196 (COSTUMES.md surv_f1: cropped patched field jacket, road-sign pauldron,
  // cargo trousers with shin wraps, combat boots, goggles on the brow, respirator, hand-crank lamp)
  registerCast('ife', {
    name: 'IFE', role: 'Scout · Sera Voss\'s people · 2196',
    bio: 'Twenty-four. Keeps watch over the drowned Helix atrium for the resistance. Calls the long-coated man who crosses it "the Grey Man".',
    look: { era: '2196', costume: 'surv_f1', sex: 1, female: true, age: 24, height: 1.69, build: 0.98, skin: 0x6b4029, hair: 0x0e0a08, hairStyle: 'tied-back', eyes: 0x24160c,
      face: { jaw: -0.05, cheek: 0.45, nose: -0.1, noseWidth: 0.35, lips: 0.35, brow: 0.1, eyeSize: 0.2, faceLength: 0.05, chin: -0.1 },
      topType: 'jacket', top: 0x6a5a44, topKind: 'fabric', pantsType: 'cargo', pants: 0x4a4a32, shoes: 'boots', boots: 0x2a2018 },
    rimColor: 0xb6ff8a, glow: 0x10180a, bg: 0x0a0c08,
    vp: { sex: 'f', pitch: 1.06, rate: 1.04, langs: ['en-GB', 'en-NG', 'en-US'] },
  });
  registerCast('m12guard', { name: 'HELIX SECURITY', role: 'Security node · east run', look: { ...GUARD49, lod: false }, vp: { sex: 'm', pitch: 0.84, rate: 1.02, langs: ['en-US', 'en-GB'] } });
  registerCast('m12radio', { name: 'SECURITY RADIO', role: 'Helix channel 2', voice: true, vp: { sex: 'm', pitch: 0.85, rate: 1.05, langs: ['en-US', 'en-GB'] } });
  registerCast('m12pa', { name: 'HELIX SYSTEMS', role: 'Facility intelligence · automated', voice: true, vp: { sex: 'f', pitch: 1.12, rate: 1.04, langs: ['en-US', 'en-GB'] } });
  registerCast('m12band', { name: 'CHRONOLITH BAND', role: 'Kai\'s wrist · residue reading', voice: true, vp: { sex: 'f', pitch: 1.18, rate: 1.06, langs: ['en-US', 'en-GB'] } });
}

// ---------------------------------------------------------------------------------------------
// Music. The Kai & Mira motif is E-B-A (76-71-69); the Witness plays it slower and lower.
//   m12-glass      the gallery: bowed bass, the motif at 54 BPM a fifth down, metallic resonance
//   m12-chase      the 2049 chase: muted pulse, short piano cells, ticking that drifts off the grid
//   m12-2026       the half-built wing: plucked strings, warm pad, a work-light hum
//   m12-ruin       2196: wind, low cello, glass, a slow heartbeat drum
//   m12-fragments  residue: one tick per second, the motif under glass, more notes per fragment read
//   m12-descent    the stair: a cello ostinato that steps down a tone per landing
//   m12-second     Chamber II: both motifs together, Kai's and the Witness's, never resolving
// ---------------------------------------------------------------------------------------------
export const musicState = { frags: 0, landing: 0, heat: 0 };
export function registerM12Themes() {
  registerTheme('m12-glass', { bpm: 54, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([40, 47, 52], t, d * 16, 0.016, 380); a.cello(28 + (bar % 2 ? 3 : 0), t, d * 16, 0.05); }
    if (bar % 2 === 0 && [0, 6, 12].includes(b)) a.piano([64, 71, 69][b / 6] - 7, t, 0.16, 5);
    if (bar % 4 === 3 && b === 8) a.glass(83, t, 0.014);
    if (b === 10 && bar % 3 === 1) a.tick(t, 0.02, 1800);
  } });
  registerTheme('m12-chase', { bpm: 104, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, heat = musicState.heat;
    if (b % 4 === 0) a.drum(t, 0.13 + heat * 0.05, 90, 44);
    if (b % 2 === 1 || (heat > 0.5 && b % 4 === 2)) a.tick(t + (bar % 3 === 2 ? d * 0.18 : 0), 0.022, 6200);
    if (b === 0) { a.pad([50, 57, 60], t, d * 16, 0.013, 520); a.cello(bar % 2 ? 38 : 41, t, d * 16, 0.05); }
    if ([0, 3, 6].includes(b) && bar % 2 === 0) a.piano([62, 65, 64][b / 3], t, 0.1, 0.8);
    if (b === 14 && bar % 2) a.glass(86, t, 0.016);
  } });
  registerTheme('m12-2026', { bpm: 72, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, CH = [[45, 52, 57, 60], [41, 48, 57, 60], [43, 50, 55, 59], [40, 47, 55, 59]], ch = CH[bar % 4];
    if (b === 0) { a.pad(ch.slice(1), t, d * 16, 0.015, 600); a.cello(ch[0] - 12, t, d * 16, 0.035); }
    if (b % 4 === 2) a.pluck(ch[1 + ((b >> 2) % 3)] + 12, t, 0.05);
    if (b === 12 && bar % 2) a.flute(ch[3] + 12, t, d * 4, 0.02);
  } });
  registerTheme('m12-ruin', { bpm: 60, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([38, 45, 50, 53], t, d * 16, 0.018, 340); a.cello(bar % 4 < 2 ? 26 : 29, t, d * 16, 0.05); }
    if (b === 0 || b === 9) a.drum(t, 0.07, 60, 38);
    if (b === 6 && bar % 2 === 0) a.glass(81 + (bar % 4 ? 0 : 3), t, 0.016);
    if (b === 12 && bar % 4 === 3) a.piano(64, t, 0.08, 4);
  } });
  registerTheme('m12-fragments', { bpm: 60, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, n = musicState.frags;
    if (b % 4 === 0) a.tick(t, 0.03, 3200);
    if (b === 0) { a.pad([52, 59, 64], t, d * 16, 0.014, 420); if (bar % 2 === 0) a.cello(40, t, d * 32, 0.04); }
    const mel = [76, 71, 69, 64, 71], at = [2, 7, 12, 14, 15];
    for (let i = 0; i < Math.min(mel.length, 1 + n); i++) if (b === at[i] && bar % 2 === 1) a.glass(mel[i] - (i > 2 ? 12 : 0), t, 0.018);
  } });
  registerTheme('m12-descent', { bpm: 84, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, dn = musicState.landing * 2;
    if (b % 2 === 0) a.cello([38, 41, 45, 41][(b >> 1) % 4] - dn, t, d * 1.8, 0.045);
    if (b % 8 === 0) a.drum(t, 0.12, 80, 40);
    if (b === 0) a.pad([50 - dn, 53 - dn, 57 - dn], t, d * 16, 0.014, 460);
    if (b === 10 && bar % 2) a.glass(88 - dn, t, 0.014);
    a.tick(t, b % 4 === 2 ? 0.02 : 0.008, 5200);
  } });
  registerTheme('m12-second', { bpm: 54, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0) { a.pad([45, 52, 57, 59], t, d * 16, 0.02, 460); a.cello(33, t, d * 16, 0.055); }
    if (bar % 2 === 0 && [0, 6, 12].includes(b)) a.piano([76, 71, 69][b / 6], t, 0.18, 5);
    if (bar % 2 === 1 && [0, 6, 12].includes(b)) a.piano([64, 59, 57][b / 6] - 12, t, 0.14, 6);
    if (bar % 4 === 3 && b === 4) a.glass(93, t, 0.014);
  } });
}

// ---------------------------------------------------------------------------------------------
// Code-drawn textures
// ---------------------------------------------------------------------------------------------
const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
const lines = (g, list, x, y, size, col, lh = 1.35, weight = 600) => { g.font = `${weight} ${size}px ${FONT}`; list.forEach((l, i) => { g.fillStyle = Array.isArray(l) ? l[1] : col; g.fillText(Array.isArray(l) ? l[0] : l, x, y + i * size * lh); }); };
const plate = (key, w, h, bg, draw) => canvasTex(w, h, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); draw(g, W, H); }, 'm12' + key);
export const TEX = {
  sign: (txt, sub, col = '#e8eaec', bg = '#1a1e24') => plate('sign' + txt + sub, 512, 128, bg, (g) => { lines(g, [txt], 24, 62, 42, col); if (sub) lines(g, [sub], 24, 104, 22, '#9fb4c8', 1.3, 500); }),
  screen: (key, list, col = '#5fe6ff', bg = '#06121a') => plate('scr' + key, 512, 320, bg, (g, W, H) => {
    g.strokeStyle = 'rgba(95,230,255,0.06)'; for (let y = 0; y < H; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    lines(g, list, 22, 46, 24, col, 1.45);
  }),
  hoarding: () => plate('hoarding', 1024, 256, '#e8e6de', (g, W, H) => {
    g.fillStyle = '#1d3a5a'; g.fillRect(0, 0, W, 60); g.fillRect(0, H - 34, W, 34);
    lines(g, ['HELIX TEMPORAL RESEARCH · WEST WING · PHASE 1'], 24, 42, 30, '#e8e6de');
    lines(g, ['SITE BOUNDARY · NO UNAUTHORISED ENTRY', 'Hard hats and hi-vis beyond this point · Night security on site'], 24, 120, 34, '#1a1c20', 1.5);
    lines(g, ['Contractor: Varde & Sons · Completion 2029'], 24, H - 10, 20, '#e8e6de', 1, 500);
  }),
  danger: () => plate('danger', 512, 256, '#e8b020', (g) => { g.fillStyle = '#111'; g.fillRect(14, 14, 484, 228); lines(g, ['DANGER', 'EXCAVATION', 'Cable vault · 4 m deep'], 36, 80, 44, '#e8b020', 1.2, 700); }),
  stencil: (n, era) => plate('sten' + n + era, 256, 256, era === '2049' ? '#d6dade' : era === '2026' ? '#8c8b86' : '#4a4c44', (g) => {
    const c = era === '2049' ? '#1d2a44' : era === '2026' ? '#f0d020' : '#c8c0a8';
    g.fillStyle = c; g.font = `800 150px ${FONT}`; g.textAlign = 'center'; g.fillText('L' + n, 128, 170);
    lines(g, ['SUBLEVEL'], 70, 228, 28, c, 1, 700);
    if (era === '2196') { g.fillStyle = 'rgba(40,60,30,0.6)'; for (let k = 0; k < 40; k++) { g.beginPath(); g.arc(Math.random() * 256, 200 + Math.random() * 56, 4 + Math.random() * 12, 0, 7); g.fill(); } }
  }),
  sealOrder: () => plate('seal', 512, 640, '#efe9da', (g) => {
    g.fillStyle = '#1d2a44'; g.fillRect(0, 0, 512, 70); lines(g, ['HELIX · DIRECTOR\'S ORDER'], 24, 46, 28, '#efe9da');
    lines(g, ['Ref. SZ-B / 2031-03', '', 'Sublevel 3, Chamber II:', 'SITE ZERO ARTEFACT B', '', 'Seal the chamber and the west', 'service run with it. Remove', 'both from the drawings.', 'No access, no log, no staff', 'rotation. Artefact A remains', 'the programme.', '', '14.03.2031   — E. Rook'], 24, 116, 26, '#2a2418', 1.4, 500);
  }),
  bookPage: (signed) => plate('book' + signed, 512, 384, '#f2ecd8', (g) => {
    g.strokeStyle = '#b8c8d8'; for (let y = 60; y < 384; y += 36) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    lines(g, ['VISITORS · WEST WING · 23.10.2026'], 20, 40, 22, '#3a3020', 1, 700);
    g.font = 'italic 26px Georgia, serif'; g.fillStyle = '#2a2a3a';
    g.fillText('23:41   K. Varen        "returning"', 24, 90);
    g.fillStyle = '#20304a'; if (signed === 'name') g.fillText('23:52   K. Varen', 24, 126); else if (signed === 'false') g.fillText('23:52   J. Park', 24, 126);
  }),
  note: () => plate('note', 256, 192, '#f4efe2', (g) => { g.strokeStyle = '#2a2620'; g.lineWidth = 2; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(20, 40 + k * 28); for (let x = 20; x < 230; x += 12) g.lineTo(x, 40 + k * 28 + Math.sin(x * 0.4 + k) * 3); g.stroke(); } }),
  artefact: () => plate('artefact', 512, 160, '#20252b', (g) => { lines(g, ['CHAMBER II · ARTEFACT B'], 22, 58, 36, '#e8eaec'); lines(g, ['SITE ZERO · SEALED 14.03.2031 · E. ROOK'], 22, 112, 24, '#ff9a8a', 1.3, 500); }),
  bandHud: (txt) => plate('band' + txt, 512, 128, 'rgba(0,0,0,0)', (g) => { g.shadowColor = '#ff6a4a'; g.shadowBlur = 16; lines(g, [txt], 16, 80, 54, '#ffb8a0', 1, 700); }),
  gallerySign: () => plate('gal', 512, 128, '#14181e', (g) => { lines(g, ['OBSERVATION GALLERY C'], 24, 64, 40, '#e8eaec'); lines(g, ['Test Hall C below · glass rated 40 MPa'], 24, 106, 22, '#9fb4c8', 1.3, 500); }),
  lockdown: () => plate('lock', 512, 256, '#1a0c0e', (g) => { lines(g, ['LOCKDOWN'], 40, 110, 80, '#ff4d5e', 1, 800); lines(g, ['Temporal dampers engaged · switching inhibited'], 40, 180, 24, '#ffb0b0', 1.3, 500); }),
};

// ---------------------------------------------------------------------------------------------
// Fracture curtain material (red-orange shimmer: the field's unstable edge, the Witness's fracture)
// ---------------------------------------------------------------------------------------------
export function fractureMaterial(color = 0xff6a4a, strength = 0.6) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(color) }, uS: { value: strength } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uS; uniform vec3 uC; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec2 c = vUv - 0.5; float edge = smoothstep(0.5, 0.2, abs(c.x)) * smoothstep(0.5, 0.25, abs(c.y));
        float w = sin(vUv.y * 40.0 + uT * 3.0 + sin(vUv.x * 9.0 + uT) * 2.0) * 0.5 + 0.5;
        float n = h(floor(vUv * vec2(24.0, 60.0)) + floor(uT * 6.0)); float crack = smoothstep(0.03, 0.0, abs(c.x + sin(vUv.y * 13.0 + uT) * 0.06));
        float a = edge * (0.18 + 0.3 * w + 0.25 * step(0.93, n)) * uS + crack * uS;
        gl_FragColor = vec4(uC * (0.8 + w * 0.6 + crack * 2.0), clamp(a, 0.0, 1.0)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------------------------
export function buildHelixWest(game, scene, T) {
  const Q = RZ.getQuality(), low = Q === 'low';
  const col = game.collision;
  const W = { lightSrc: [], updaters: [], screens: {}, groups: {}, fx: [], doors: {} };
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  // ---------- materials ----------
  const M49 = {
    floor: pm('ceramicTile', { color: 0x8a8f94, grout: 0x5a5e62, count: 2, gloss: 0.75, variation: 0.2 }),
    gallery: pm('ceramicTile', { color: 0x3a3e44, grout: 0x24272b, count: 1, gloss: 0.85, marble: 0.2, variation: 0.1 }),
    wall: pm('paintedMetalPanel', { color: 0xd6dade, cols: 1, rows: 3, wear: 0.12, grime: 0.12, gloss: 0.5 }),
    wallDark: pm('paintedMetalPanel', { color: 0x3a4048, cols: 2, rows: 2, wear: 0.2, grime: 0.25, gloss: 0.4 }),
    ceiling: pm('paintedMetalPanel', { color: 0xbfc4c8, cols: 4, rows: 4, wear: 0.05, grime: 0.1, gloss: 0.3 }),
    steel: pm('brushedMetal', { color: 0x9aa0a6, roughness: 0.32 }),
    dark: pm('brushedMetal', { color: 0x3a3f46, roughness: 0.4 }),
    wood: pm('wood', { color: 0x5a3e2a, planks: 6 }),
    rubber: pm('rubber', { color: 0x1a1b1d }),
    dust: pm('concrete', { color: 0x9a968c, formwork: 0, stains: 0.3, slabs: 0 }),
  };
  const M26 = {
    floor: pm('concrete', { color: 0x7c7a74, formwork: 0, stains: 0.7, slabs: 1, wet: 0.3 }),
    wall: pm('concrete', { color: 0x8c8b86, formwork: 1, stains: 0.5 }),
    ply: pm('wood', { color: 0xb08a5a, planks: 2, variation: 0.5 }),
    steel: pm('rust', { color: 0x5a3a24, paint: 0x2a5a8a, amount: 0.3 }),
    hoard: new THREE.MeshStandardMaterial({ map: TEX.hoarding(), roughness: 0.7 }),
    dirt: pm('dirt', { color: 0x4a3a2c, damp: 0.6 }),
  };
  const M96 = {
    floor: pm('concrete', { color: 0x5a5c54, formwork: 0, stains: 0.9, cracks: 1, slabs: 1, wet: 0.6 }),
    wall: pm('concrete', { color: 0x4e5048, formwork: 1, stains: 0.9, cracks: 1 }),
    rubble: pm('concrete', { color: 0x6a685e, formwork: 0, stains: 0.8, cracks: 1 }),
    rust: pm('rust', { color: 0x4a2a14, paint: 0x3d4a52, amount: 0.8 }),
    moss: pm('moss', { color: 0x3d5a1c, tips: 0x7d8a2c, dry: 0.3 }),
    panel: pm('paintedMetalPanel', { color: 0x8a8e88, cols: 1, rows: 3, wear: 0.9, grime: 0.9, gloss: 0.2 }),
  };
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fb8c8, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.5 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.3, metalness: 0.4 });
  const G = { panel: glowMat(0xf2f6ff, 2.6), cyan: glowMat(0x5fe6ff, 2.2), red: glowMat(0xff4d5e, 2.0), amber: glowMat(0xffb347, 2.4), bulb: glowMat(0xffd9a0, 4), green: glowMat(0x6affc8, 1.6), moon: glowMat(0xb8d0ff, 1.2) };
  const B = { '2026': new Batch(), '2049': new Batch(), '2196': new Batch(), all: new Batch() };
  const states = (era) => (era === 'all' ? undefined : [era]);
  const blk = (era, x0, y0, z0, x1, y1, z1) => col.add([Math.min(x0, x1), y0, Math.min(z0, z1)], [Math.max(x0, x1), y1, Math.max(z0, z1)], { states: states(era) });
  const box = (era, mat, x0, y0, z0, x1, y1, z1, collide = true) => { B[era].box(mat, x0, y0, z0, x1, y1, z1); if (collide) return blk(era, x0, y0, z0, x1, y1, z1); return null; };
  // a wall along x or z with door gaps; thickness 0.24
  const wall = (era, x0, z0, x1, z1, h, mat, gaps = [], y = 0, collide = true) => {
    const alongX = Math.abs(z1 - z0) < 0.01, a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
    const cuts = [a0]; for (const [g0, g1] of gaps.slice().sort((p, q) => p[0] - q[0])) cuts.push(g0, g1); cuts.push(a1);
    for (let i = 0; i < cuts.length; i += 2) {
      const s0 = cuts[i], s1 = cuts[i + 1]; if (s1 - s0 < 0.02) continue;
      if (alongX) box(era, mat, s0, y, z0 - 0.12, s1, y + h, z0 + 0.12, collide); else box(era, mat, x0 - 0.12, y, s0, x0 + 0.12, y + h, s1, collide);
    }
    for (const [g0, g1] of gaps) { if (h <= 2.5) continue; if (alongX) B[era].box(mat, g0, y + 2.4, z0 - 0.12, g1, y + h, z0 + 0.12); else B[era].box(mat, x0 - 0.12, y + 2.4, g0, x0 + 0.12, y + h, g1); }
  };
  const floor = (era, mat, x0, z0, x1, z1, y = 0, t = 0.3) => box(era, mat, x0, y - t, z0, x1, y, z1);
  const ceil = (era, mat, x0, z0, x1, z1, y) => B[era].box(mat, x0, y, z0, x1, y + 0.15, z1);
  const src = (era, x, y, z, c = 0xeaf2ff, i = 16, d = 12, zone) => W.lightSrc.push({ era, p: [x, y, z], c, i, d, zone });
  const panel = (era, x, y, z, w = 1.2, d = 0.3, mat = G.panel) => B[era].box(mat, x - w / 2, y - 0.03, z - d / 2, x + w / 2, y, z + d / 2);
  const planeAt = (tex, w, h, x, y, z, ry = 0, era = null, opts = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), opts.basic ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: opts.emit ? 0xffffff : 0x000000, emissiveMap: opts.emit ? tex : null, emissiveIntensity: opts.emit || 0 }));
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); if (era) T.only(m, era); return m;
  };
  const r = rng(1212);

  // =========================================================================================
  // 2049 · Observation Gallery C and Test Hall C
  // =========================================================================================
  floor('2049', M49.gallery, -8, 0.4, 8, -8);
  wall('2049', -8, 0.4, 8, 0.4, 3.4, M49.wallDark); wall('2049', -8, 0.4, -8, -8, 3.4, M49.wallDark); wall('2049', 8, 0.4, 8, -8, 3.4, M49.wallDark, [[-5, -2]]);
  ceil('2049', M49.ceiling, -8, 0.4, 8, -8, 3.4);
  box('2049', M49.wallDark, -8, 0, -8.12, 8, 0.9, -7.88); // sill
  box('2049', glass, -8, 0.9, -8.06, 8, 3.4, -7.94); // the glass (camera can see through, Kai can't pass)
  for (let x = -8; x <= 8.01; x += 4) B['2049'].box(M49.dark, x - 0.06, 0.9, -8.1, x + 0.06, 3.4, -7.9);
  B['2049'].box(M49.steel, -8, 0.88, -8.25, 8, 0.94, -7.75); // handrail ledge
  for (const x of [-5.2, -1.6, 2.0]) { box('2049', M49.dark, x - 1.1, 0, -1.4, x + 1.1, 0.45, -0.6); B['2049'].box(M49.rubber, x - 1.05, 0.45, -1.35, x + 1.05, 0.5, -0.65); }
  for (let x = -6; x <= 6; x += 3) panel('2049', x, 3.38, -4, 2.2, 0.4);
  src('2049', 0, 3.2, -4, 0xeaf2ff, 12, 10, 'gallery');
  planeAt(TEX.gallerySign(), 2.2, 0.55, -4.0, 2.8, 0.27, Math.PI, '2049', { emit: 0.4 });
  W.screens.intercom = planeAt(TEX.screen('icm', ['GALLERY C · INTERCOM', 'Director\'s line', '▮ connected'], '#5fe6ff'), 0.42, 0.28, P.intercom[0] + 0.14, 1.45, P.intercom[2], Math.PI / 2, '2049', { emit: 0.9 });
  // Test Hall C behind the glass: 7 m high, a field rig, consoles, a gantry
  floor('2049', M49.floor, -8, -8, 8, -24, 0);
  wall('2049', -8, -8, -8, -24, 7, M49.wall); wall('2049', 8, -8, 8, -24, 7, M49.wall); wall('2049', -8, -24, 8, -24, 7, M49.wall, [[-1, 1]]);
  ceil('2049', M49.ceiling, -8, -8, 8, -24, 7);
  B['2049'].box(M49.wallDark, -8, 3.4, -8.12, 8, 7, -7.88);
  const rig = new THREE.Group(); rig.position.set(0, 0, -16.5); T.only(rig, '2049'); scene.add(rig);
  const ringM = new THREE.MeshPhysicalMaterial({ color: 0x8a9098, metalness: 1, roughness: 0.22, clearcoat: 1 });
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.22, 16, 64), ringM); r1.position.y = 2.9; rig.add(r1);
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.06, 8, 64), glowMat(0x5fe6ff, 1.8)); r2.position.y = 2.9; rig.add(r2);
  for (const a of [0, 2.1, 4.2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.9, 0.22), ringM); leg.position.set(Math.sin(a) * 2.6, 1.45, Math.cos(a) * 2.6); rig.add(leg); }
  blk('2049', -2.9, 0, -19.4, 2.9, 3.2, -13.6);
  W.rig = { r1, r2 };
  for (const [x, z] of [[-5.5, -11], [5.5, -11], [-5.5, -21], [5.5, -21]]) { box('2049', M49.dark, x - 0.8, 0, z - 0.4, x + 0.8, 1.0, z + 0.4); B['2049'].box(new THREE.MeshStandardMaterial({ color: 0x050a10, emissive: 0x3a9aff, emissiveIntensity: 0.9 }), x - 0.7, 1.0, z - 0.42, x + 0.7, 1.5, z - 0.38); }
  for (let x = -6; x <= 6; x += 4) panel('2049', x, 6.98, -16, 2.4, 0.5);
  src('2049', 0, 6.4, -12, 0xdff4ff, 18, 16, 'gallery'); src('2049', 0, 5.6, -16.5, 0x5fe6ff, 10, 10, 'gallery');
  // hall dressing: hazard ring around the rig, gantry beams, cable trays, the hall sign, a wall of status screens
  const hz = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.7, 48), new THREE.MeshStandardMaterial({ map: canvasTex(512, 32, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = '#e8b020'; g.fillRect(x, 0, 16, h); g.fillStyle = '#16171a'; g.fillRect(x + 16, 0, 16, h); } }, 'm12hz'), roughness: 0.6 }));
  hz.rotation.x = -Math.PI / 2; hz.position.set(0, 0.012, -16.5); scene.add(hz); T.only(hz, '2049');
  for (const z of [-11, -16.5, -22]) { B['2049'].box(M49.dark, -8, 6.2, z - 0.25, 8, 6.7, z + 0.25); B['2049'].box(G.panel, -6, 6.17, z - 0.08, 6, 6.2, z + 0.08); }
  for (const x of [-7.7, 7.7]) { B['2049'].box(M49.steel, x - 0.2, 4.8, -23.8, x + 0.2, 4.9, -8.2); for (let z = -9; z > -24; z -= 1.5) B['2049'].box(M49.dark, x - 0.18, 4.6, z - 0.03, x + 0.18, 4.8, z + 0.03); }
  planeAt(TEX.sign('TEST HALL C', 'Field rig 3 · Chronolith programme · Level 0'), 4.4, 1.1, 0, 5.2, -23.85, 0, '2049', { emit: 0.35 });
  for (const [x, txt] of [[-5.2, 'RIG 3 · FIELD'], [5.2, 'DAMPERS · ARMED']]) planeAt(TEX.screen('hall' + x, [txt, 'coherence 0.997', '23:40:12'], '#5fe6ff'), 1.6, 1.0, x, 3.0, -23.85, 0, '2049', { emit: 0.8 });
  W.screens.galleryLogo = planeAt(TEX.screen('galLogo', ['HELIX TEMPORAL RESEARCH', 'Observation · Level 1', 'Visitors must be escorted'], '#e8eaec', '#14181e'), 1.8, 1.1, 4.0, 1.9, 0.27, Math.PI, '2049', { emit: 0.5 });

  // =========================================================================================
  // 2049 · the east research corridor, Rook's office, the shutter, the security node
  // =========================================================================================
  floor('2049', M49.floor, 8, 3, 12, -44); ceil('2049', M49.ceiling, 8, 3, 12, -44, 3.2);
  wall('2049', 8, 3, 12, 3, 3.2, M49.wall);
  wall('2049', 8, 0.4, 8, 3, 3.2, M49.wall); wall('2049', 8, -24, 8, -40, 3.2, M49.wall); // west side (gallery and hall walls cover -8..-24)
  wall('2049', 12, 3, 12, -8, 3.2, M49.wall); wall('2049', 12, -8, 12, -25, 3.2, M49.wall, [[-13, -11]]); wall('2049', 12, -35, 12, -40, 3.2, M49.wall);
  for (let z = 1; z > -44; z -= 4) panel('2049', 10, 3.18, z, 0.3, 1.6);
  for (let z = 1; z > -24; z -= 8) src('2049', 10, 3.0, z, 0xeaf2ff, 10, 10, 'east');
  W.screens.wayfind = planeAt(TEX.sign('EAST RUN', 'Labs 1–4 · Security node · North corridor'), 1.6, 0.4, 11.86, 2.5, -1.0, -Math.PI / 2, '2049', { emit: 0.35 });
  // Rook's office (optional room off the east run)
  floor('2049', M49.wood, 12, -8, 19, -16); ceil('2049', M49.ceiling, 12, -8, 19, -16, 3.2);
  wall('2049', 12, -8, 19, -8, 3.2, M49.wall); wall('2049', 12, -16, 19, -16, 3.2, M49.wall); wall('2049', 19, -8, 19, -16, 3.2, M49.wallDark);
  box('2049', M49.wood, 15.4, 0, -14.4, 17.8, 0.76, -12.6); B['2049'].box(black, 16.2, 0.76, -14.1, 17.4, 1.3, -14.0);
  W.screens.rook = planeAt(TEX.screen('rook', ['E. ROOK · CALENDAR · THU 23.10', '23:40  Gallery C · K. VAREN', '       (record: deceased 19.10)', '23:41  Test Hall C · badge: —', '23:41  LOCKDOWN · Director'], '#d8e6f0'), 1.14, 0.5, 16.8, 1.05, -13.94, 0, '2049', { emit: 0.8 });
  box('2049', M49.dark, 18.2, 0, -10.0, 18.9, 2.0, -8.4); // filing cabinet
  panel('2049', 15.5, 3.18, -12, 2.0, 0.6); src('2049', 15.5, 2.9, -12, 0xffe8cc, 9, 8, 'east');
  const frame = planeAt(canvasTex(256, 192, (g) => { g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, 256, 192); g.fillStyle = '#8a8676'; g.fillRect(16, 16, 224, 160); g.fillStyle = '#1a1a1a'; g.beginPath(); g.ellipse(128, 96, 70, 46, 0, 0, 7); g.fill(); g.fillStyle = '#8a8676'; g.beginPath(); g.ellipse(128, 96, 44, 26, 0, 0, 7); g.fill(); g.fillStyle = '#222'; g.font = '14px sans-serif'; g.fillText('SITE ZERO · 2029 · A + B', 40, 172); }, 'm12photo'), 0.9, 0.66, 18.86, 1.7, -12.4, -Math.PI / 2, '2049');
  W.photo = frame;
  // the lockdown shutter (jams at 0.5 m)
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(4.0, 3.2, 0.18), M49.dark); shutter.position.set(10, 3.2 + 1.6, -21); scene.add(shutter); T.only(shutter, '2049'); game.blocker(shutter);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.02, 0.1, 0.2), G.red); stripe.position.y = -1.5; shutter.add(stripe);
  B['2049'].box(M49.steel, 7.9, 0, -21.2, 8.1, 3.2, -20.8); B['2049'].box(M49.steel, 11.9, 0, -21.2, 12.1, 3.2, -20.8);
  W.shutter = { mesh: shutter, box: blk('2049', 8, 0, -21.15, 12, 3.2, -20.85), open: 1 };
  W.shutter.box.enabled = false;
  W.screens.lock = planeAt(TEX.lockdown(), 1.0, 0.5, 11.86, 2.2, -19.6, -Math.PI / 2, '2049', { emit: 0.8 }); W.screens.lock.visible = false;
  // the security node (corridor widens east), equipment crates along the west wall for cover
  floor('2049', M49.floor, 12, -25, 17, -35); ceil('2049', M49.ceiling, 12, -25, 17, -35, 3.2);
  wall('2049', 12, -25, 17, -25, 3.2, M49.wall); wall('2049', 12, -35, 17, -35, 3.2, M49.wall); wall('2049', 17, -25, 17, -35, 3.2, M49.wallDark);
  box('2049', M49.dark, 14.2, 0, -31.6, 16.4, 1.05, -30.4); B['2049'].box(new THREE.MeshStandardMaterial({ color: 0x050a10, emissive: 0xff4d5e, emissiveIntensity: 0.7 }), 14.4, 1.05, -31.5, 16.2, 1.5, -31.45);
  for (let z = -25.9; z > -34.5; z -= 1.3) { const h = 1.12 + r() * 0.1; box('2049', z > -30 ? M49.wallDark : M49.wall, 11.0, 0, z - 0.62, 11.9, h, z + 0.62); B['2049'].box(G.amber, 11.0, h, z - 0.05, 11.9, h + 0.01, z + 0.05); }
  panel('2049', 14.5, 3.18, -30, 1.8, 0.6, G.red); src('2049', 14.5, 3.0, -30, 0xff6a70, 10, 10, 'east'); src('2049', 10, 3.0, -36, 0xeaf2ff, 9, 9, 'east');
  W.note0 = null;
  // =========================================================================================
  // 2049 · north corridor (drone), alcoves, the bricked-up end of the west service run
  // =========================================================================================
  floor('2049', M49.floor, -24, -40, 12, -44); ceil('2049', M49.ceiling, -24, -40, 12, -44, 3.2);
  wall('2049', 12, -44, 12, -40, 3.2, M49.wall);
  wall('2049', -24, -40, 8, -40, 3.2, M49.wall);
  wall('2049', -24, -44, 12, -44, 3.2, M49.wall, [[-13, -11], [-3, -1], [5, 7]]);
  for (const [a, b] of [[-13, -11], [-3, -1], [5, 7]]) { floor('2049', M49.floor, a, -44, b, -45.8); wall('2049', a, -45.8, b, -45.8, 3.2, M49.wallDark); wall('2049', a, -44, a, -45.8, 3.2, M49.wallDark); wall('2049', b, -44, b, -45.8, 3.2, M49.wallDark); ceil('2049', M49.ceiling, a, -44, b, -45.8, 3.2); }
  for (let x = 8; x > -24; x -= 5) panel('2049', x, 3.18, -42, 1.6, 0.3);
  for (const x of [4, -8, -19]) src('2049', x, 3.0, -42, 0xeaf2ff, 9, 9, 'north');
  // the dead end: the 2049 brick-up (solid from x=-24 to -31; the run's other blocked parts below)
  box('2049', M49.wall, -31, 0, -44, -24, 3.2, -40);
  W.screens.deadEnd = planeAt(TEX.sign('NO ACCESS', 'Former west service run · closed 2031'), 1.6, 0.4, -23.86, 2.2, -42, Math.PI / 2, '2049', { emit: 0.3 });
  W.screens.deadEnd.rotation.y = Math.PI / 2;
  // 2049 dampers: a field emitter strip at the end of the damped zone
  B['2049'].box(G.cyan, -22.6, 3.0, -40.2, -22.4, 3.15, -43.8);

  // =========================================================================================
  // 2026 · the west service run while the wing is being built
  // =========================================================================================
  floor('2026', M26.floor, -52, -39.5, -20, -44.5);
  wall('2026', -52, -40, -20, -40, 3.0, M26.wall); wall('2026', -52, -44, -20, -44, 3.0, M26.wall);
  ceil('2026', M26.wall, -52, -39.6, -20, -44.4, 3.0);
  box('2026', M26.hoard, -20.2, 0, -44, -20.0, 3.0, -40); // site boundary hoarding (east end)
  planeAt(TEX.hoarding(), 4.0, 1.0, -20.3, 1.6, -42, -Math.PI / 2, '2026');
  // the cable-vault trench across the run, fenced on both sides
  for (const x of [-34.2, -41.8]) { box('2026', M26.steel, x - 0.05, 0, -44, x + 0.05, 1.1, -40); for (let z = -43.8; z <= -40.1; z += 0.6) B['2026'].box(M26.steel, x - 0.03, 0, z - 0.02, x + 0.03, 1.1, z + 0.02); B['2026'].box(G.amber, x - 0.06, 1.1, -43.9, x + 0.06, 1.16, -40.1); }
  B['2026'].box(M26.dirt, -41.7, -0.05, -44, -34.3, 0.01, -40); // dark trench mouth
  B['2026'].box(black, -41.0, -0.02, -43.4, -35.0, 0.012, -40.6);
  planeAt(TEX.danger(), 1.0, 0.5, -34.0, 0.7, -42, Math.PI / 2, '2026');
  planeAt(TEX.danger(), 1.0, 0.5, -42.0, 0.7, -42, -Math.PI / 2, '2026');
  // bulbs on a festoon cable, cable drums, timber, a site radio
  for (let x = -22; x > -52; x -= 4) { B['2026'].geo(G.bulb, new THREE.SphereGeometry(0.07, 8, 6), [x, 2.7, -42]); }
  scene.add(T.only(cableCurve(Array.from({ length: 9 }, (_, i) => [-21 - i * 3.8, 2.82 - (i % 2) * 0.12, -42]), 0.012, black), '2026'));
  for (const x of [-26, -38.0, -46, -50]) src('2026', x, 2.6, -42, 0xffc880, 7, 7, 'run');
  B['2026'].cyl(M26.ply, -29.2, 0.5, -43.2, 0.5, 0.5, 18, [Math.PI / 2, 0, 0]); blk('2026', -29.7, 0, -43.7, -28.7, 1.0, -42.7);
  box('2026', M26.ply, -47.2, 0, -43.8, -44.8, 0.5, -43.0);
  // =========================================================================================
  // 2049 · Records Storage B (sealed 2031, no door) between the run's 2026 sections, and the solid D3
  // =========================================================================================
  floor('2049', M49.dust, -45, -37, -31, -47);
  wall('2049', -45, -37, -31, -37, 3.0, M49.wall); wall('2049', -45, -47, -31, -47, 3.0, M49.wall); wall('2049', -45, -37, -45, -47, 3.0, M49.wall); wall('2049', -31, -37, -31, -47, 3.0, M49.wall);
  ceil('2049', M49.ceiling, -45, -37, -31, -47, 3.0);
  const cardboard = new THREE.MeshStandardMaterial({ color: 0xb8a47e, roughness: 0.92 }), paperM = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.9 });
  for (const z of [-38.0, -46.0]) for (let x = -43.8; x < -32; x += 2.4) {
    blk('2049', x, 0, z - 0.45, x + 2.0, 2.4, z + 0.45);
    for (const ux of [x + 0.03, x + 1.97]) for (const uz of [z - 0.42, z + 0.42]) B['2049'].box(M49.dark, ux - 0.03, 0, uz - 0.03, ux + 0.03, 2.4, uz + 0.03);
    for (let y = 0.12; y < 2.4; y += 0.56) {
      B['2049'].box(M49.steel, x, y, z - 0.45, x + 2.0, y + 0.03, z + 0.45);
      for (let bx = x + 0.08; bx < x + 1.8; bx += 0.5 + r() * 0.1) { if (r() < 0.15) continue; const bh = 0.26 + r() * 0.12; B['2049'].box(r() < 0.8 ? cardboard : paperM, bx, y + 0.03, z - 0.32, bx + 0.42, y + 0.03 + bh, z + 0.32); }
    }
  }
  box('2049', M49.dark, -38.6, 0, -43.0, -37.4, 0.8, -41.0);   // the archive table
  W.sealOrder = planeAt(TEX.sealOrder(), 0.42, 0.52, -38.0, 0.81, -42.4, 0, '2049'); W.sealOrder.rotation.x = -Math.PI / 2;
  W.bookOld = planeAt(TEX.bookPage('none'), 0.46, 0.34, -37.9, 0.81, -41.4, 0, '2049'); W.bookOld.rotation.x = -Math.PI / 2;
  panel('2049', -38, 2.98, -42, 1.0, 0.3, glowMat(0xd8e0d0, 0.9)); src('2049', -38, 2.6, -42, 0xd8e4ea, 7, 9, 'records');
  box('2049', M49.wall, -52, 0, -44, -45, 3.0, -40);       // D3: solid in 2049
  // =========================================================================================
  // the west stair core (all three states)
  // =========================================================================================
  floor('all', M26.floor, -58, -36, -52, -48);
  // 2049 lift lobby: lifts, sealed stair door, glass doors to the atrium (lockdown)
  wall('2049', -58, -36, -52, -36, 3.2, M49.wall); wall('2049', -58, -48, -52, -48, 3.2, M49.wall); wall('2049', -52, -36, -52, -40, 3.2, M49.wall); wall('2049', -52, -44, -52, -48, 3.2, M49.wall);
  box('2049', glass, -58.1, 0, -46, -57.9, 3.2, -38); wall('2049', -58, -36, -58, -38, 3.2, M49.wall); wall('2049', -58, -46, -58, -48, 3.2, M49.wall);
  planeAt(TEX.lockdown(), 1.6, 0.8, -57.8, 1.6, -42, Math.PI / 2, '2049', { emit: 0.7 });
  for (const x of [-56.6, -53.4]) { B['2049'].box(M49.steel, x - 0.8, 0, -47.9, x + 0.8, 2.3, -47.75); B['2049'].box(G.panel, x - 0.1, 2.4, -47.8, x + 0.1, 2.5, -47.7); }
  ceil('2049', M49.ceiling, -58, -36, -52, -48, 3.2); panel('2049', -55, 3.18, -42, 2.0, 0.5); src('2049', -55, 3.0, -42, 0xeaf2ff, 10, 10, 'lobby');
  // 2026 stair core: raw concrete, the watchman's desk, the hoarding to the excavation west
  wall('2026', -58, -36, -52, -36, 3.0, M26.wall); wall('2026', -58, -48, -52, -48, 3.0, M26.wall); wall('2026', -52, -36, -52, -40, 3.0, M26.wall); wall('2026', -52, -44, -52, -48, 3.0, M26.wall);
  box('2026', M26.hoard, -58.2, 0, -48, -58.0, 3.0, -36);
  box('2026', M26.ply, -56.4, 0, -38.0, -54.0, 0.78, -37.0);        // the desk
  B['2026'].box(black, -55.2, 0.78, -37.8, -54.6, 0.86, -37.3);     // the radio
  W.book26 = planeAt(TEX.bookPage('none'), 0.4, 0.3, -54.4, 0.79, -37.45, 0, '2026'); W.book26.rotation.x = -Math.PI / 2;
  for (let k = 0; k < 6; k++) box('2026', M26.wall, -53.8 + 0, 0, -47.6 + k * 0.42, -52.4, 0.2 + k * 0.3, -47.18 + k * 0.42, false);
  B['2026'].geo(G.bulb, new THREE.SphereGeometry(0.1, 8, 6), [-55, 2.5, -42]); src('2026', -55, 2.4, -42, 0xffc070, 9, 9, 'lobby');
  // 2196: the stair core's west wall blown out into the atrium
  wall('2196', -58, -36, -52, -36, 3.0, M96.wall); wall('2196', -58, -48, -52, -48, 3.0, M96.wall); wall('2196', -52, -36, -52, -48, 3.0, M96.wall);
  wall('2196', -58, -36, -58, -38.6, 3.0, M96.wall); wall('2196', -58, -45.4, -58, -48, 3.0, M96.wall);
  box('2196', M96.rubble, -52, 0, -48, -20, 3.0, -36);      // the run is collapsed solid in 2196
  for (let k = 0; k < 7; k++) { const x = -53 - r() * 4, z = -37 - r() * 10.5; B['2196'].boxc(M96.rubble, x, 0.25, z, 0.5 + r() * 0.9, 0.5, 0.5 + r() * 0.8, r() * 3); }

  // =========================================================================================
  // 2196 · the ruined west atrium (flooded ground floor, broken slabs, the girder, the missing catwalk)
  // =========================================================================================
  const AT = { x0: -92, x1: -58, z0: -26, z1: -74 };
  W.atrium = AT;
  box('2196', M96.rubble, AT.x0, -3.4, AT.z1, AT.x1, -3.0, AT.z0);   // the drowned floor, 3 m under water
  floor('2196', M96.floor, -62, -36, -58, -48);                           // entrance ledge
  const wallsAt = [[AT.x0, AT.z0, AT.x1, AT.z0], [AT.x0, AT.z0, AT.x0, AT.z1]];
  for (const [a, b, c, d] of wallsAt) wall('2196', a, b, c, d, 9, M96.wall, [], -3.0);
  wall('2196', AT.x1, AT.z0, AT.x1, -36, 9, M96.wall, [], -3.0); wall('2196', AT.x1, -48, AT.x1, AT.z1, 9, M96.wall, [], -3.0);
  B['2196'].box(M96.wall, AT.x1 - 0.12, 3.0, -48, AT.x1 + 0.12, 6.0, -36);
  wall('2196', AT.x0, AT.z1, -76, AT.z1, 9, M96.wall, [], -3.0); wall('2196', -70, AT.z1, AT.x1, AT.z1, 9, M96.wall, [], -3.0);
  // broken walls (jagged tops) instead of clean boxes where the roof came down
  for (const [x, z, w, h, ry, seed] of [[-75, -26.3, 16, 7.5, 0, 3], [-91.7, -48, 20, 6.5, Math.PI / 2, 5], [-84, -73.8, 14, 5.5, 0, 7]]) {
    const g = RZ.brokenWall({ width: w, height: h, thickness: 0.5, seed, holes: 1, jag: 0.9 }); g.translate(0, 6.0, 0);
    B['2196'].geo(M96.wall, g, [x, 0, z], [0, ry, 0]);
  }
  // the rubble stair from the ledge up to slab A
  for (let i = 0; i < 5; i++) { const x1 = -62 - i * 1.2, top = 0.4 * (i + 1); box('2196', M96.rubble, x1 - 1.25, -3.0, -45.6, x1, top, -40.4); B['2196'].boxc(M96.rubble, x1 - 0.6, top + 0.08, -40.2 - r() * 0.3, 0.9, 0.3, 0.6, r()); }
  // slabs (y = 2.4) with exposed rebar edges and moss
  const slab = (x0, z0, x1, z1) => { box('2196', M96.floor, x0, 2.0, z0, x1, 2.4, z1); B['2196'].box(M96.moss, x0 + 0.4, 2.4, Math.max(z0, z1) - 0.9, x0 + 0.4 + Math.abs(x1 - x0) * 0.4, 2.42, Math.max(z0, z1) - 0.3); };
  slab(-76, -38, -68, -52);                 // A
  slab(-88, -60, -64, -64.2);               // B (girder lands at its south edge; west end is the scouts' ledge)
  slab(-80, -70, -66, -74);                 // C (north, over the hub entrance)
  slab(-90, -54, -84, -60);                 // the scouts' ledge
  for (const [x, z, h] of [[-68, -38, 9], [-76, -52, 9], [-64, -60, 9], [-80, -74, 9]]) box('2196', M96.wall, x - 0.35, -3.0, z - 0.35, x + 0.35, h - 3.0, z + 0.35);
  try { const rb = RZ.rebar({ origin: [-72, 2.2, -52.1], dir: [0, -0.2, -1], count: 10, length: 0.9, spread: [7, 0.1], seed: 4 }); B['2196'].push(M96.rust, rb); } catch (err) { console.warn('m12 rebar', err); }
  // the girder from slab A to slab B (0.6 m flange) and the broken catwalk stubs either side of the gap
  box('2196', M96.rust, -72.3, 2.1, -60, -71.7, 2.4, -52);
  B['2196'].box(M96.rust, -72.08, 1.7, -60, -71.92, 2.1, -52); B['2196'].box(M96.rust, -72.3, 1.55, -60, -71.7, 1.7, -52);
  box('2196', M96.rust, -73.2, 2.25, -64.2, -70.8, 2.4, -64.8, false); box('2196', M96.rust, -73.2, 2.25, -69.4, -70.8, 2.4, -70.0, false);
  const stubA = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 2.0), M96.rust); stubA.position.set(-72, 1.9, -65.5); stubA.rotation.x = 0.55; scene.add(stubA); T.only(stubA, '2196');
  for (const s of [-1, 1]) B['2196'].box(M96.rust, -72 + s * 1.2 - 0.03, 2.4, -64.6, -72 + s * 1.2 + 0.03, 3.4, -64.2);
  // ruined Helix furniture on the slabs, a fallen sign, vines, the moonlit hole in the roof
  for (let k = 0; k < 10; k++) { const sx = -75 + r() * 6, sz = -40 - r() * 11; B['2196'].boxc(r() < 0.5 ? M96.rubble : M96.panel, sx, 2.55, sz, 0.3 + r() * 0.8, 0.3, 0.3 + r() * 0.6, r() * 3); }
  W.fallenSign = planeAt(TEX.sign('HELIX · WEST ATRIUM', 'Level 1 · Records · Core Ring B', '#c8c0a8', '#2a2c28'), 3.2, 0.8, -66.5, 2.75, -62.6, 0.4, '2196'); W.fallenSign.rotation.set(-1.1, 0.4, 0.2);
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x2e5a2a, roughness: 0.85 });
  for (let k = 0; k < 16; k++) { const x = AT.x0 + 1 + r() * 32, z = AT.z0 - 0.4 - (k % 2) * 47.2; const pts = []; for (let j = 0; j < 5; j++) pts.push([x + (r() - 0.5) * 0.5, 6.0 - j * 1.6 - r() * 0.4, z + (k % 2 ? 0.2 : -0.2) * j]); B['2196'].push(vineMat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 12, 0.04 + r() * 0.03, 5)); }
  const shaft = RZ.lightShaft({ from: [-76, 12, -50], to: [-74, -0.5, -56], radius: [2.4, 5.5], color: 0xb8d0ff, intensity: 0.35 }); scene.add(shaft); T.only(shaft, '2196');
  src('2196', -75, 8.0, -54, 0xb8d0ff, 70, 34, 'atrium'); src('2196', -61, 6.0, -43, 0xb8d0ff, 34, 20, 'atrium'); src('2196', -73, 6.5, -68, 0xb8d0ff, 34, 20, 'atrium'); src('2196', -86.5, 3.4, -61.0, 0xffa050, 12, 9, 'atrium');
  // water over the drowned floor
  try {
    const wtr = RZ.water({ rect: [AT.x0, AT.z1, AT.x1 - AT.x0, AT.z0 - AT.z1], level: -0.5, heightAt: () => -3.0, deep: 0x0a1c1e, shallow: 0x22403a, flow: [0.02, 0.01], res: low ? 32 : 64 });
    scene.add(wtr.mesh || wtr); T.only(wtr.mesh || wtr, '2196'); W.water = wtr;
  } catch (err) {
    console.warn('m12 water', err);
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(AT.x1 - AT.x0, AT.z0 - AT.z1), new THREE.MeshStandardMaterial({ color: 0x0c2224, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 }));
    wm.rotation.x = -Math.PI / 2; wm.position.set((AT.x0 + AT.x1) / 2, -0.5, (AT.z0 + AT.z1) / 2); scene.add(wm); T.only(wm, '2196');
  }
  // the scouts' camp on the ledge: a fire drum, bedrolls, a hand-crank lamp
  B['2196'].cyl(M96.rust, -87.6, 2.85, -57.4, 0.32, 0.9, 14); blk('2196', -88, 2.4, -57.8, -87.2, 3.3, -57.0);
  B['2196'].geo(glowMat(0xff8a3a, 3.2), new THREE.IcosahedronGeometry(0.22, 1), [-87.6, 3.36, -57.4], [0, 0, 0], [1, 0.7, 1]);
  for (const [x, z] of [[-89.2, -59.0], [-86.2, -55.4]]) B['2196'].boxc(new THREE.MeshStandardMaterial({ color: 0x6a5a44, roughness: 0.95 }), x, 2.48, z, 1.8, 0.16, 0.7, 0.3);
  // ruined towers beyond the broken roof
  try {
    const towers = RZ.cityBlock([
      { width: 22, depth: 18, height: 40, position: [-108, -3, -40], seed: 121, wall: 'concrete', yaw: Math.PI / 2, ruin: 0.8, moss: 0.5, collapse: true },
      { width: 18, depth: 16, height: 30, position: [-110, -3, -70], seed: 122, wall: 'darkBrick', yaw: Math.PI / 2, ruin: 0.7, moss: 0.4 },
      { width: 26, depth: 20, height: 46, position: [-74, -3, -6], seed: 123, wall: 'panel', ruin: 0.9, moss: 0.6, collapse: true },
    ], { era: '2196', lit: 0, daylight: 0, detail: low ? 'low' : undefined });
    scene.add(towers.mesh); T.only(towers.mesh, '2196'); W.towers = towers.mesh;
  } catch (err) { console.warn('m12 towers', err); }

  // =========================================================================================
  // Core Ring B, the hub (all three states)
  // =========================================================================================
  const HR = HUB.r;
  const disc = (era, mat, y = 0) => { const g = new THREE.CylinderGeometry(HR + 0.3, HR + 0.3, 0.3, 40); g.translate(HUB.x, y - 0.15, HUB.z); B[era].push(mat, g); };
  disc('2026', M26.floor); disc('2049', M49.floor); disc('2196', M96.floor);
  blk('all', HUB.x - HR, -0.3, HUB.z - HR, HUB.x + HR, 0, HUB.z + HR);
  B['all'].box(M96.rubble, -76, -0.3, -76, -70, 0, -73.8); blk('all', -76, -0.3, -76, -70, 0, -73.8);  // the threshold under slab C
  const ringWall = (era, mat, h, gaps) => {
    for (let k = 0; k < 28; k++) {
      const a0 = (k / 28) * Math.PI * 2, a1 = ((k + 1) / 28) * Math.PI * 2, am = (a0 + a1) / 2;
      const deg = ((am * 180 / Math.PI) + 360) % 360; if (gaps.some(([g0, g1]) => deg > g0 && deg < g1)) continue;
      const x = HUB.x + Math.sin(am) * (HR + 0.2), z = HUB.z - Math.cos(am) * (HR + 0.2), len = 2 * Math.PI * (HR + 0.2) / 28 + 0.06;
      B[era].boxc(mat, x, h / 2, z, len, h, 0.4, -am);
      col.addBox(x, 0, z, 1.9, h, 1.9, { states: states(era) });
    }
  };
  // gaps: north (0 deg, the descent) in all; south (180, the atrium) only in 2196
  ringWall('2026', M26.wall, 4.5, [[-8, 8], [352, 368]]); ringWall('2049', M49.wall, 4.5, [[-8, 8], [352, 368]]); ringWall('2196', M96.wall, 4.5, [[-8, 8], [352, 368], [168, 192]]);
  for (const era of ['2026', '2049']) box(era, era === '2049' ? M49.dark : M26.ply, -75.4, 0, -75.4, -70.6, 3.0, -74.6);   // south door (closed)
  ceil('2049', M49.ceiling, HUB.x - HR, HUB.z + HR, HUB.x + HR, HUB.z - HR, 4.5);
  // 2049: ring light, glyph inlay, benches, terminals
  const ringLight = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.06, 8, 64), G.panel); ringLight.rotation.x = Math.PI / 2; ringLight.position.set(HUB.x, 4.3, HUB.z); scene.add(ringLight); T.only(ringLight, '2049');
  const inlay = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.15, 64), G.cyan); inlay.rotation.x = -Math.PI / 2; inlay.position.set(HUB.x, 0.012, HUB.z); scene.add(inlay); T.only(inlay, '2049');
  W.screens.hub49 = planeAt(TEX.sign('CORE RING B', 'Sublevel access (north) · sealed 2031', '#e8eaec', '#1a1e24'), 2.4, 0.6, HUB.x, 3.6, HUB.z - HR + 0.05, 0, '2049', { emit: 0.35 });
  for (const a of [60, 120, 240, 300]) { const x = HUB.x + Math.sin(a * Math.PI / 180) * 7.4, z = HUB.z - Math.cos(a * Math.PI / 180) * 7.4; box('2049', M49.dark, x - 0.5, 0, z - 0.5, x + 0.5, 0.45, z + 0.5); }
  src('2049', HUB.x, 4.0, HUB.z, 0xeaf2ff, 18, 16, 'hub');
  // 2026: foundation ring, rebar starts, scaffolding, a cement mixer, work lamps
  for (let k = 0; k < 6; k++) { const a = 0.5 + k * 1.0, x = HUB.x + Math.sin(a) * 7.6, z = HUB.z - Math.cos(a) * 7.6; for (const dx of [-0.8, 0.8]) for (const dz of [-0.5, 0.5]) B['2026'].box(M26.steel, x + dx - 0.03, 0, z + dz - 0.03, x + dx + 0.03, 4.2, z + dz + 0.03); for (let y = 1.4; y < 4.3; y += 1.4) B['2026'].box(M26.ply, x - 0.9, y, z - 0.55, x + 0.9, y + 0.05, z + 0.55); }
  B['2026'].cyl(new THREE.MeshStandardMaterial({ color: 0xd8a020, roughness: 0.6 }), -79.6, 0.8, -86.6, 0.55, 0.9, 16, [0.5, 0, 0], 0.35); blk('2026', -80.3, 0, -87.3, -78.9, 1.2, -85.9);
  for (const [x, z] of [[-67.2, -79.2], [-79.0, -79.6]]) { B['2026'].box(M26.steel, x - 0.03, 0, z - 0.03, x + 0.03, 2.4, z + 0.03); B['2026'].box(G.bulb, x - 0.2, 2.3, z - 0.12, x + 0.2, 2.55, z + 0.12); }
  src('2026', -67.2, 2.4, -79.2, 0xffc880, 14, 12, 'hub'); src('2026', -79.0, 2.4, -79.6, 0xffc880, 14, 12, 'hub');
  // 2196: broken ceiling, roots, puddles, moonlight
  for (let k = 0; k < 12; k++) { const a = r() * Math.PI * 2, d = 3 + r() * 5; B['2196'].boxc(M96.rubble, HUB.x + Math.sin(a) * d, 0.18, HUB.z - Math.cos(a) * d, 0.4 + r() * 0.9, 0.36, 0.4 + r() * 0.8, r() * 3); }
  for (let k = 0; k < 10; k++) { const a = r() * Math.PI * 2, pts = []; for (let j = 0; j < 5; j++) pts.push(new THREE.Vector3(HUB.x + Math.sin(a + j * 0.04) * (HR - j * 0.1), 4.5 - j * 1.0, HUB.z - Math.cos(a + j * 0.04) * (HR - j * 0.1))); B['2196'].push(vineMat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.05, 5)); }
  const hubShaft = RZ.lightShaft({ from: [HUB.x + 2, 10, HUB.z + 1], to: [HUB.x + 1, 0, HUB.z - 1], radius: [1.6, 3.4], color: 0xb8d0ff, intensity: 0.3 }); scene.add(hubShaft); T.only(hubShaft, '2196');
  src('2196', HUB.x + 1, 6, HUB.z, 0xb8d0ff, 40, 20, 'hub');

  // =========================================================================================
  // the sublevel stair: four segments, landings between (all three states; dressing per state)
  // =========================================================================================
  const SX0 = -75, SX1 = -71;
  W.stencils = [];
  for (const L of LANDINGS) { floor('all', M26.floor, SX0, L.z + 1.5, SX1, L.z - 1.5, L.y, 0.4); }
  for (const s of SEGS) for (let i = 0; i < 5; i++) {
    const z0 = s.z0 - 1.2 * i, z1 = z0 - 1.2, top = s.y0 - 0.4 * (i + 1);
    B['all'].box(M26.floor, SX0, top - 0.4, z1, SX1, top, z0); blk('all', SX0, top - 0.6, z1, SX1, top, z0);
  }
  floor('all', M26.floor, SX0, -126, SX1, -127, -8, 0.4);
  blk('all', SX0 - 0.3, -8.6, -127, SX0, 4.5, -93); blk('all', SX1, -8.6, -127, SX1 + 0.3, 4.5, -93);
  for (const era of ERAS) {
    const m = era === '2049' ? M49.wall : era === '2026' ? M26.wall : M96.wall;
    for (let k = 0; k < 4; k++) B[era].box(m, SX0, LANDINGS[k].y + 3.6, k ? LANDINGS[k].z + 1.0 : -93, SX1, LANDINGS[k].y + 3.9, SEGS[k].z1); // stepped soffits
    B[era].box(m, SX0 - 0.24, -8.6, -93, SX0, 4.0, -127); B[era].box(m, SX1, -8.6, -93, SX1 + 0.24, 4.0, -127);
  }
  // per-state dressing along the stair
  for (const L of LANDINGS) {
    const n = L.k + 1;
    if (L.k > 0) for (const era of ERAS) { const st = planeAt(TEX.stencil(L.k, era), 0.9, 0.9, SX0 + 0.14, L.y + 1.4, L.z, Math.PI / 2, era); W.stencils.push(st); }
    B['2026'].geo(G.bulb, new THREE.SphereGeometry(0.08, 8, 6), [-73, L.y + 2.7, L.z]); src('2026', -73, L.y + 2.5, L.z, 0xffc070, 8, 8, 'stair' + n);
    panel('2049', -73, L.y + 3.15, L.z, 1.4, 0.3); src('2049', -73, L.y + 3.0, L.z, 0xeaf2ff, 9, 9, 'stair' + n);
    B['2049'].box(G.green, SX1 - 0.12, L.y + 2.2, L.z - 0.3, SX1 - 0.08, L.y + 2.45, L.z + 0.3);
    src('2196', -73, L.y + 2.6, L.z, 0x8aa8c8, 5, 8, 'stair' + n);
    B['2196'].box(M96.moss, SX0 + 0.1, L.y + 0.01, L.z - 1.2, SX0 + 1.4, L.y + 0.03, L.z + 0.4);
  }
  for (let z = -97; z > -126; z -= 2.6) { B['2049'].box(M49.steel, SX1 - 0.2, 0, z - 0.03, SX1 - 0.16, 0.01, z + 0.03); }
  for (const s of SEGS) { B['2049'].box(M49.steel, SX1 - 0.14, s.y0 + 0.5, s.z1, SX1 - 0.08, s.y0 + 0.56, s.z0); B['2049'].box(M49.steel, SX1 - 0.14, s.y1 + 0.9, s.z1, SX1 - 0.08, s.y0 + 0.96, s.z1 + 0.06); }
  // the field at each segment: a curtain of shimmer at its top and bottom in every state (only knowledge tells which is stable)
  W.curtains = [];
  for (const s of SEGS) for (const z of [s.z0 - 0.1, s.z1 + 0.1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 3.0), fractureMaterial(0xff6a4a, 0.13)); m.position.set(-73, (z === s.z0 - 0.1 ? s.y0 : s.y1) + 1.7, z); m.userData.noBatch = true; scene.add(m); W.curtains.push(m);
  }
  W.shardL2 = null;

  // =========================================================================================
  // Chamber II and the second Chronolith (all three states)
  // =========================================================================================
  const CR = CH2.r, CY = CH2.y;
  const cdisc = (era, mat) => { const g = new THREE.CylinderGeometry(CR + 0.3, CR + 0.3, 0.4, 44); g.translate(CH2.x, CY - 0.2, CH2.z); B[era].push(mat, g); };
  cdisc('2026', M26.dirt); cdisc('2049', M49.floor); cdisc('2196', M96.floor);
  blk('all', CH2.x - CR, CY - 0.4, CH2.z - CR, CH2.x + CR, CY, CH2.z + CR);
  const chWall = (era, mat) => {
    for (let k = 0; k < 32; k++) {
      const a0 = (k / 32) * Math.PI * 2, a1 = ((k + 1) / 32) * Math.PI * 2, am = (a0 + a1) / 2, deg = am * 180 / Math.PI;
      if (deg > 168 && deg < 192) continue;
      const x = CH2.x + Math.sin(am) * (CR + 0.2), z = CH2.z - Math.cos(am) * (CR + 0.2), len = 2 * Math.PI * (CR + 0.2) / 32 + 0.06;
      B[era].boxc(mat, x, CY + 4.5, z, len, 9, 0.5, -am);
      if (era === '2049') col.addBox(x, CY, z, 2.0, 9, 2.0);
    }
  };
  chWall('2026', M26.wall); chWall('2049', M49.wallDark); chWall('2196', M96.wall);
  ceil('2049', M49.ceiling, CH2.x - CR, CH2.z + CR, CH2.x + CR, CH2.z - CR, CY + 9);
  const ch2 = chronolith(0.85, { color: 0xff6a4a, power: 0.25, stone: 0x161012 });
  ch2.userData.frags.scale.setScalar(0.72);
  ch2.position.set(P.ch2[0], CY + 3.0, P.ch2[2]); scene.add(ch2); W.ch2 = ch2;
  blk('all', CH2.x - 3.2, CY, P.ch2[2] - 0.9, CH2.x + 3.2, CY + 6, P.ch2[2] + 0.9);
  // 2049: Helix cradle and containment ring, plate, consoles; 2026: rock face, survey pegs; 2196: roots and water
  const cradle = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.18, 12, 64), M49.steel); cradle.position.copy(ch2.position); scene.add(cradle); T.only(cradle, '2049');
  for (const s of [-1, 1]) box('2049', M49.dark, CH2.x + s * 3.6 - 0.4, CY, P.ch2[2] - 0.4, CH2.x + s * 3.6 + 0.4, CY + 3.2, P.ch2[2] + 0.4);
  W.screens.artefact = planeAt(TEX.artefact(), 2.6, 0.8, CH2.x, CY + 1.0, P.ch2[2] + 1.0, 0, '2049', { emit: 0.5 });
  box('2049', M49.dark, -70.6, CY, -132.0, -69.0, CY + 1.0, -131.2);
  W.screens.ch2console = planeAt(TEX.screen('ch2', ['ARTEFACT B · FIELD', 'Dormant since 14.03.2031', 'Operator log:', '  K. VAREN · 23:58'], '#ff9a8a', '#140806'), 1.3, 0.8, -69.8, CY + 1.45, -131.18, 0, '2049', { emit: 0.8 });
  for (let k = 0; k < 6; k++) { const a = k * 1.05; panel('2049', CH2.x + Math.sin(a) * 6, CY + 8.9, CH2.z - Math.cos(a) * 6, 1.6, 0.4); }
  src('2049', CH2.x, CY + 8.0, CH2.z, 0xeaf2ff, 24, 20, 'ch2'); src('all', CH2.x, CY + 3.0, P.ch2[2] + 1.6, 0xff6a4a, 12, 10, 'ch2');
  for (let k = 0; k < 14; k++) { const a = r() * Math.PI * 2, d = CR - 1 - r() * 1.5; B['2026'].boxc(M26.dirt, CH2.x + Math.sin(a) * d, CY + 0.4, CH2.z - Math.cos(a) * d, 1 + r() * 2, 0.8 + r() * 1.2, 1 + r() * 2, r() * 3); }
  for (let k = 0; k < 4; k++) B['2026'].box(new THREE.MeshStandardMaterial({ color: 0xd84020, roughness: 0.6 }), -76 + k * 2, CY, -130.5, -75.95 + k * 2, CY + 0.6, -130.45);
  src('2026', CH2.x - 4, CY + 2.5, CH2.z + 4, 0xffc880, 14, 14, 'ch2');
  for (let k = 0; k < 12; k++) { const a = r() * Math.PI * 2, pts = []; for (let j = 0; j < 5; j++) pts.push(new THREE.Vector3(CH2.x + Math.sin(a) * (CR - j * 0.3), CY + 8 - j * 1.9, CH2.z - Math.cos(a) * (CR - j * 0.3))); B['2196'].push(vineMat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.06, 5)); }
  src('2196', CH2.x, CY + 6, CH2.z, 0x8aa8c8, 16, 18, 'ch2');
  // the fracture the Witness leaves through (hidden until the ending)
  const fracture = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.6), fractureMaterial(0xff6a4a, 1.0)); fracture.position.set(-68.4, CY + 1.8, -134.8); fracture.rotation.y = -0.5; fracture.visible = false; fracture.userData.noBatch = true; scene.add(fracture); W.fracture = fracture;

  // =========================================================================================
  // build the batches into per-state groups
  // =========================================================================================
  for (const era of [...ERAS, 'all']) {
    const g = new THREE.Group(); g.name = 'm12-' + era; scene.add(g);
    B[era].build(g, { cast: true, blockers: true, game });
    if (era !== 'all') T.only(g, era);
    W.groups[era] = g;
  }
  W.update = (dt, t) => {
    ch2.userData.update(t);
    r2.rotation.z = t * 0.6; r1.rotation.y = Math.sin(t * 0.2) * 0.05;
    const cam = game.engine.camera.position;
    for (const c of W.curtains) { c.material.uniforms.uT.value = t; const d = Math.abs(cam.z - c.position.z) + Math.max(0, Math.abs(cam.y - c.position.y) - 1.5); c.visible = d > 0.6; c.userData.fade = Math.min(1, Math.max(0, (d - 0.6) / 3)); }
    W.fracture.material.uniforms.uT.value = t;
  };
  return W;
}
