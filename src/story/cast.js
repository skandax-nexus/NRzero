// Character definitions drawn from the AFTERZERO character bible and NPC roster.
export const CAST = {
  kai: {
    name: 'KAI VAREN', role: 'Temporal systems engineer · 2049',
    bio: 'Believes every event has a discoverable cause. His greatest weakness is his belief that every loss can be reversed.',
    look: { height: 1.83, skin: 0xb98463, hair: 0x15100c, hairStyle: 'messy', eyes: 0x3d2a18, stubble: true, top: 0x24282e, topKind: 'leather', pants: 0x2a2c2f, boots: 0x1b1611, gloves: 0x1d1a17, strap: true, wristMark: true },
    rimColor: 0x5fe6ff,
  },
  mira: {
    name: 'MIRA VAREN', role: 'The impossible sister',
    bio: 'Officially dead for 23 years. A reconstructed consciousness carrying memories from more than one possible life. She understands the Chronolith better than anyone.',
    look: { female: true, height: 1.69, skin: 0xd9a585, hair: 0x120d0b, hairStyle: 'long', eyes: 0x2f4a3a, top: 0x1c2026, topKind: 'leather', armor: true, pants: 0x1f2227, boots: 0x15120f },
    rimColor: 0x9a7bff, glow: 0x23183a,
  },
  witness: {
    name: 'THE WITNESS', role: 'A future that refused to let go',
    bio: 'An older Kai who has repeatedly tried to save Mira, creating new timelines and guiding his younger self toward the same experiment.',
    look: { height: 1.81, skin: 0xa77a5d, hair: 0x8d8780, hairStyle: 'grey-swept', eyes: 0x3d2a18, beard: 0x6d6862, scar: true, top: 0x1e1e1f, topKind: 'leather', coat: 0x2a2724, coatKind: 'leather', pants: 0x202020, boots: 0x141210, gloves: 0x111111, wristMark: true },
    rimColor: 0xff6a4a, glow: 0x3a1610,
  },
  sera: {
    name: 'SERA VOSS', role: 'Resistance leader · 2196',
    bio: 'A survivor from 2196 who distrusts Kai because he is remembered as the architect of the Fracture.',
    look: { female: true, height: 1.72, skin: 0x8a5b3c, hair: 0x2a1c14, hairStyle: 'bun', eyes: 0x2b1b10, top: 0x4a4636, topKind: 'fabric', vest: 0x3a3a2c, pants: 0x3a3a30, boots: 0x2a2018, strap: true, scar: true },
    rimColor: 0xb6ff8a,
  },
  rook: {
    name: 'DR. ELIAS ROOK', role: 'Director, Helix Temporal Research',
    bio: 'Director of the Helix project. Hides the early history of the Chronolith — and evidence that it predates the project.',
    look: { height: 1.78, skin: 0xd3a487, hair: 0xb8b4ae, hairStyle: 'grey-swept', eyes: 0x45566a, glasses: true, top: 0x2f3542, topKind: 'fabric', coat: 0xe8eaec, coatKind: 'fabric', pants: 0x2a2e36, boots: 0x14151a },
    rimColor: 0xffffff,
  },
  niko: {
    name: 'NIKO', role: 'Keeper of the settlement',
    bio: 'A young keeper who protects communal memory. Recognizes Kai from a history he should not know.',
    look: { height: 1.66, build: 0.92, skin: 0x8c5a3a, hair: 0x0e0a08, hairStyle: 'short', eyes: 0x2a1a0e, top: 0xcdb48a, topKind: 'fabric', sash: 0x9b3b24, pants: 0x7a6248, boots: 0x5a3e28, belt: 0x5a3e28, bracelets: 0xc9a050 },
    rimColor: 0xffb05a, glow: 0x3a2410, bg: 0x140d08,
  },
  tala: {
    name: 'TALA', role: 'Water keeper',
    bio: 'Wants the settlement\'s water system restored; fears the observatory will be weaponized.',
    look: { female: true, height: 1.64, skin: 0x7d4f33, hair: 0x15100b, hairStyle: 'bun', eyes: 0x24160c, top: 0x3f6a6a, topKind: 'fabric', sash: 0xd0a24a, pants: 0x5a4632, boots: 0x4a3220, belt: 0x4a3220, bracelets: 0xd9b25c },
    rimColor: 0xffb05a, glow: 0x3a2410, bg: 0x140d08,
  },
  iven: {
    name: 'IVEN MARR', role: 'Helix maintenance technician',
    bio: 'Wants to get his team out safely; fears being blamed for a test he did not approve.',
    look: { height: 1.76, skin: 0xe0b394, hair: 0x6a3f22, hairStyle: 'short', eyes: 0x3a5a2a, stubble: true, top: 0x37404a, topKind: 'fabric', vest: 0xd9781e, pants: 0x2c333b, boots: 0x2a2018, cap: 0x2a3440, gloves: 0x5a4a3a },
    rimColor: 0xff9a3a,
  },
  hale: {
    name: 'OFFICER HALE', role: 'Helix security',
    bio: 'Night-shift security. Follows orders. Logs do not show what he was ordered to do.',
    look: { height: 1.85, build: 1.08, skin: 0xc49a7c, hair: 0x2a2a2a, hairStyle: 'short', eyes: 0x2a2a2a, top: 0x1c2533, topKind: 'fabric', vest: 0x111820, pants: 0x1c2533, boots: 0x0f0f10, gloves: 0x101010 },
    rimColor: 0xff4d5e,
  },
  brandt: {
    name: 'OFFICER BRANDT', role: 'Helix security',
    bio: 'Helix security. Rook\'s preferred problem-solver.',
    look: { height: 1.8, build: 1.1, skin: 0xe2b896, hair: 0xa8743a, hairStyle: 'short', eyes: 0x3a5a7a, stubble: true, top: 0x1c2533, topKind: 'fabric', vest: 0x111820, pants: 0x1c2533, boots: 0x0f0f10, gloves: 0x101010 },
    rimColor: 0xff4d5e,
  },
  jun: {
    name: 'JUN PARK', role: 'Rain City transit operator',
    bio: 'Wants to keep a station running during the Zero Second fallout; fears leaving passengers behind.',
    look: { height: 1.74, skin: 0xd8b08e, hair: 0x0c0c0e, hairStyle: 'short', eyes: 0x1a1410, top: 0x1d2a44, topKind: 'fabric', pants: 0x1d2a44, boots: 0x111111, cap: 0x1d2a44, vest: 0xd4c21a },
    rimColor: 0xffd34a,
  },
  voice: { name: 'UNKNOWN VOICE', role: 'Every speaker in the city', voice: true },
  speaker: { name: 'HELIX PA SYSTEM', role: 'Automated', voice: true },
  phone: { name: 'DR. ELIAS ROOK', role: 'Incoming call · encrypted', portraitOf: 'rook' },
  child: { name: 'CHILD', role: 'Rain City' },
};

const CITIZEN_SKINS = [0xf1c6a8, 0xd9a585, 0xb98463, 0x8c5a3a, 0x6b4029, 0xe8b996, 0xa16d4c];
const CITIZEN_HAIR = [0x111111, 0x2a1c14, 0x5a3a22, 0x8a6a4a, 0x0e0a08, 0xb8b4ae, 0x3a2418];
const COATS = [0x1f2a36, 0x2a2a2a, 0x3a2f2a, 0x14202a, 0x2d3640, 0x3c3226, 0x202833, 0x4a1f24];
const UMBRELLAS = [0x1a1a1f, 0x2a3a5a, 0x7a1f2a, 0x1f3a3a, 0x3a3a3a, 0xc4c4c8, 0x2a2a44];

export function citizenLook(rng, opts = {}) {
  const pick = a => a[Math.floor(rng() * a.length)];
  const female = rng() < 0.5;
  return {
    female, height: female ? 1.6 + rng() * 0.12 : 1.7 + rng() * 0.15, build: 0.9 + rng() * 0.2,
    skin: pick(CITIZEN_SKINS), hair: pick(CITIZEN_HAIR),
    hairStyle: female ? pick(['long', 'bun', 'long', 'short']) : pick(['short', 'messy', 'short', 'bald', 'swept']),
    top: pick(COATS), topKind: rng() < 0.5 ? 'fabric' : 'leather',
    coat: rng() < 0.55 ? pick(COATS) : null, coatKind: 'fabric',
    pants: pick([0x1a1d22, 0x23262b, 0x2d2a26, 0x1d2430]), boots: 0x141210,
    umbrella: opts.umbrella && rng() < 0.6 ? pick(UMBRELLAS) : null,
    glasses: rng() < 0.15, stubble: !female && rng() < 0.4, cap: rng() < 0.12 ? pick(COATS) : null,
    ...opts.override,
  };
}

export function settlerLook(rng) {
  const pick = a => a[Math.floor(rng() * a.length)];
  const female = rng() < 0.5;
  return {
    female, height: female ? 1.58 + rng() * 0.1 : 1.66 + rng() * 0.12, build: 0.9 + rng() * 0.2,
    skin: pick([0x8c5a3a, 0x6b4029, 0x7d4f33, 0xa06a46, 0x5a3622]), hair: pick([0x0e0a08, 0x15100b, 0x2a1c14]),
    hairStyle: female ? pick(['long', 'bun']) : pick(['short', 'bald', 'messy']),
    top: pick([0xcdb48a, 0xb89a6a, 0x8a6a4a, 0x3f6a6a, 0x9b3b24, 0xd9c9a0]), topKind: 'fabric',
    sash: rng() < 0.6 ? pick([0x9b3b24, 0xd0a24a, 0x2f5a5a, 0x5a2a4a]) : null,
    pants: pick([0x7a6248, 0x5a4632, 0x8a7458]), boots: 0x4a3220, belt: 0x4a3220,
    bracelets: rng() < 0.5 ? 0xc9a050 : null,
  };
}
