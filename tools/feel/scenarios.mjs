// Scenarios for tools/feel/audit.mjs (run on the feel course of tools/feel/feelhelper.js).
// A scenario: { name, dt, frames, place:[x,y,z,yaw], camYaw, timeline:[{ f, down, up, press, stick:[x,y,mag], camYawRate, camYaw, eval }],
//               setup (JS run in the page after the reset), render: { every, views, from, to, size }, sideDir, npc, meta }
// Directions: yaw th means travel along (sin th, cos th); the chase camera sits behind (camYaw = th + PI), so W moves along th.
const PI = Math.PI;
const SHEET = (every, views = ['side', 'chase'], extra = {}) => ({ every, views, size: [480, 270], ...extra });
const CLIP = (views = ['side'], extra = {}) => ({ every: 1, views, size: [480, 270], ...extra });

export function scenarios() {
  const L = [];
  const add = (s) => { L.push({ dt: 1 / 30, settle: 20, ...s }); };
  const z0 = -22;  // runway start (x = 0, along +z)
  // ---------------- locomotion (rendered) ----------------
  add({ name: 'idle', frames: 90, place: [0, 0, z0, 0], render: SHEET(15) });
  add({ name: 'walk_start_stop', frames: 150, place: [0, 0, z0, 0], timeline: [{ f: 10, down: ['KeyW'] }, { f: 100, up: ['KeyW'] }], render: CLIP(['side']), meta: { gait: 'keyboard walk 3.1 m/s' } });
  add({ name: 'stick_slow', frames: 150, place: [0, 0, z0, 0], touch: true, timeline: [{ f: 10, stick: [0, 0.2, 0.2] }, { f: 120, stick: [0, 0, 0] }], render: SHEET(6, ['side']), meta: { gait: 'stick 20 %' } });
  add({ name: 'stick_mid', frames: 150, place: [0, 0, z0, 0], touch: true, timeline: [{ f: 10, stick: [0, 0.5, 0.5] }, { f: 120, stick: [0, 0, 0] }], render: SHEET(6, ['side']), meta: { gait: 'stick 50 %' } });
  add({ name: 'sprint', frames: 120, place: [0, 0, z0, 0], timeline: [{ f: 10, down: ['KeyW', 'ShiftLeft'] }, { f: 90, up: ['KeyW', 'ShiftLeft'] }], render: CLIP(['side'], { size: [480, 270] }), sideDist: 5.5, meta: { gait: 'sprint 5.6 m/s' } });
  add({ name: 'turn90', frames: 130, place: [0, 0, z0, 0], timeline: [{ f: 10, down: ['KeyW'] }, { f: 60, up: ['KeyW'], down: ['KeyD'] }, { f: 110, up: ['KeyD'] }], render: SHEET(3, ['chase']), meta: { turn: 90 } });
  add({ name: 'turn180', frames: 130, place: [0, 0, z0, 0], timeline: [{ f: 10, down: ['KeyW'] }, { f: 60, up: ['KeyW'], down: ['KeyS'] }, { f: 110, up: ['KeyS'] }], render: SHEET(3, ['side']), meta: { turn: 180 } });
  add({ name: 'circle', frames: 200, place: [0, 0, -5, 0], timeline: [{ f: 10, down: ['KeyW'], camYawRate: 1.0 }, { f: 190, up: ['KeyW'], camYawRate: 0 }], render: SHEET(10, ['chase']), meta: { omega: 1.0 } });
  add({ name: 'crouch_walk', frames: 140, place: [0, 0, z0, 0], timeline: [{ f: 2, press: ['KeyC'] }, { f: 25, down: ['KeyW'] }, { f: 115, up: ['KeyW'] }], render: SHEET(5, ['side']), meta: { gait: 'crouch 1.7 m/s' } });
  add({ name: 'jump_in_place', frames: 60, place: [0, 0, z0, 0], timeline: [{ f: 10, press: ['Space'] }], render: CLIP(['side']) });
  add({ name: 'jump_sprint', frames: 110, place: [0, 0, z0, 0], timeline: [{ f: 5, down: ['KeyW', 'ShiftLeft'] }, { f: 55, press: ['Space'] }, { f: 95, up: ['KeyW', 'ShiftLeft'] }], render: CLIP(['side'], { from: 45, to: 90 }), sideDist: 6 });
  add({ name: 'jump_walk', frames: 90, place: [0, 0, z0, 0], timeline: [{ f: 5, down: ['KeyW'] }, { f: 45, press: ['Space'] }, { f: 80, up: ['KeyW'] }] });
  add({ name: 'drop_3m', frames: 90, place: [28.6, 3.0, -2, PI / 2], camYaw: PI / 2 + PI, timeline: [{ f: 5, down: ['KeyW'] }, { f: 40, up: ['KeyW'] }], render: CLIP(['side'], { from: 10, to: 60 }), sideDir: [0, 1], sideDist: 6, sideH: 0.5 });
  add({ name: 'stairs', frames: 160, place: [11.2, 0, 1.5, PI], camYaw: 0, timeline: [{ f: 5, down: ['KeyW'] }, { f: 150, up: ['KeyW'] }], render: CLIP(['side'], { every: 2 }), sideDir: [1, 0] });
  add({ name: 'stairs_slow', frames: 300, place: [11.2, 0, 1.5, PI], camYaw: 0, touch: true, timeline: [{ f: 5, stick: [0, 0.35, 0.35] }, { f: 295, stick: [0, 0, 0] }], render: SHEET(6, ['side']), sideDir: [1, 0] });
  add({ name: 'risers40', frames: 90, place: [17, 0, 1.5, PI], camYaw: 0, timeline: [{ f: 5, down: ['KeyW'] }, { f: 80, up: ['KeyW'] }], render: SHEET(3, ['side']) });
  add({ name: 'ramp', frames: 110, place: [21.2, 0, 1.5, PI], camYaw: 0, timeline: [{ f: 5, down: ['KeyW'] }, { f: 100, up: ['KeyW'] }], render: SHEET(4, ['side']) });
  for (const a of [30, 80]) {
    const th = -a * PI / 180;   // along +z, turned toward the wall (-x)
    add({ name: 'wall_' + a, frames: 120, place: [-8.5, 0, -6, th], camYaw: th + PI, timeline: [{ f: 5, down: ['KeyW'] }, { f: 110, up: ['KeyW'] }], render: SHEET(10, ['chase']), meta: { angle: a } });
  }
  add({ name: 'corner', frames: 120, place: [-17.5, 0, -17.5, Math.atan2(-1, -1)], camYaw: Math.atan2(-1, -1) + PI, timeline: [{ f: 5, down: ['KeyW'] }, { f: 115, up: ['KeyW'] }], render: SHEET(20, ['chase']) });
  add({ name: 'ceiling_jump', frames: 50, place: [-28, 0, 8, 0], timeline: [{ f: 5, press: ['Space'] }], render: SHEET(4, ['side']) });
  add({ name: 'npc_bump', frames: 120, place: [0, 0, z0, 0], setup: `FEEL.actor('hale', 0, 0, ${z0 + 5}, Math.PI)`, timeline: [{ f: 5, down: ['KeyW'] }, { f: 110, up: ['KeyW'] }], render: SHEET(8, ['side', 'chase']), npc: true });
  add({ name: 'cam_wall', frames: 90, place: [24.6, 0, -2, -PI / 2], camYaw: -PI / 2 + PI, timeline: [{ f: 5, down: ['KeyS'] }, { f: 60, up: ['KeyS'] }, { f: 61, camYawRate: 2 }, { f: 85, camYawRate: 0 }], render: SHEET(6, ['chase']), meta: { note: 'backing toward the 3 m platform wall (camera blocker) with the camera behind' } });
  add({ name: 'crowd', frames: 180, place: [-3, 0, 14, PI], npc: true,
    setup: `for (let i = 0; i < 6; i++) FEEL.walker({ x: 1.5 + i * 1.2, z0: 2, z1: 12, speed: 0.9 + 0.12 * i }, 11 + i * 7); FEEL.actor('iven', -1.5, 0, 6, 0.4);`,
    wide: { p: [-1.5, 1.5, 13.5], l: [4.5, 0.9, 6.5], fov: 42 }, render: SHEET(6, ['wide']), meta: { note: 'Walker crowd (props.js) + a standing NPC' } });
  // ---------------- physics only (no render) ----------------
  for (const fps of [15, 30, 60, 144]) {
    const dt = 1 / fps, F = s => Math.round(s * fps);
    add({ name: 'phys_jump_' + fps, dt, frames: F(1.6), place: [0, 0, z0, 0], timeline: [{ f: F(0.3), press: ['Space'] }] });
    add({ name: 'phys_jumpwalk_' + fps, dt, frames: F(2.5), place: [0, 0, z0, 0], timeline: [{ f: 1, down: ['KeyW'] }, { f: F(1.2), press: ['Space'] }, { f: F(2.4), up: ['KeyW'] }] });
    add({ name: 'phys_jumpsprint_' + fps, dt, frames: F(2.5), place: [0, 0, z0, 0], timeline: [{ f: 1, down: ['KeyW', 'ShiftLeft'] }, { f: F(1.2), press: ['Space'] }, { f: F(2.4), up: ['KeyW', 'ShiftLeft'] }] });
    add({ name: 'phys_accel_' + fps, dt, frames: F(3), place: [0, 0, z0, 0], timeline: [{ f: F(0.2), down: ['KeyW'] }, { f: F(1.5), up: ['KeyW'] }] });
    add({ name: 'phys_sprintstop_' + fps, dt, frames: F(3), place: [0, 0, z0, 0], timeline: [{ f: F(0.2), down: ['KeyW', 'ShiftLeft'] }, { f: F(1.7), up: ['KeyW', 'ShiftLeft'] }] });
    add({ name: 'phys_tunnel_' + fps, dt, frames: F(2), place: [36.5, 0, 5, PI / 2], camYaw: PI / 2 + PI, timeline: [{ f: 1, down: ['KeyW', 'ShiftLeft'] }] });
    add({ name: 'phys_fall30_' + fps, dt, frames: F(3), place: [0, 30, -14, 0], setup: 'FEEL.dynSolid([-1, 0, -15], [1, 0.05, -13])' });
    add({ name: 'phys_stairs_' + fps, dt, frames: F(4.5), place: [11.2, 0, 1.5, PI], camYaw: 0, timeline: [{ f: 1, down: ['KeyW'] }] });
    add({ name: 'phys_corner_' + fps, dt, frames: F(3), place: [-17.5, 0, -17.5, Math.atan2(-1, -1)], camYaw: Math.atan2(-1, -1) + PI, timeline: [{ f: 1, down: ['KeyW'] }] });
    add({ name: 'phys_wall30_' + fps, dt, frames: F(3), place: [-8.5, 0, -6, -PI / 6], camYaw: -PI / 6 + PI, timeline: [{ f: 1, down: ['KeyW'] }] });
  }
  // step-up and jump-climb scans: a box 2 m ahead (z0 + 2 .. z0 + 4)
  for (const h of [0.2, 0.3, 0.4, 0.42, 0.43, 0.45, 0.5]) add({ name: 'stepup_' + h, frames: 75, place: [0, 0, z0, 0], setup: `FEEL.dynSolid([-1, 0, ${z0 + 2}], [1, ${h}, ${z0 + 4}])`, timeline: [{ f: 1, down: ['KeyW'] }], meta: { h } });
  for (const mode of ['walk', 'sprint']) for (const h of [0.6, 0.8, 0.9, 1.0, 1.1, 1.15, 1.2, 1.23, 1.25, 1.3, 1.4]) {
    // jump from a running start: the jump is pressed 0.9 m (walk) / 1.6 m (sprint) before the face
    const keys = mode === 'sprint' ? ['KeyW', 'ShiftLeft'] : ['KeyW'];
    add({ name: `climb_${mode}_${h}`, frames: 110, place: [0, 0, z0 - 6, 0], setup: `FEEL.dynSolid([-1, 0, ${z0 + 2}], [1, ${h}, ${z0 + 4}]); FEEL.jumpAt = ${z0 + 2 - (mode === 'sprint' ? 1.6 : 0.9)}; FEEL.jumped = false;`,
      timeline: [{ f: 1, down: keys }, ...Array.from({ length: 80 }, (_, i) => ({ f: 2 + i, eval: 'if (!FEEL.jumped && __game.player.pos.z >= FEEL.jumpAt) { __game.input.pressed.add("Space"); FEEL.jumped = true; }' }))], meta: { h, mode } });
  }
  // standing jump-climb (the m18 van: the roof is 1.15 m above a 1 m deep bonnet): start 0.7 m from the face
  for (const h of [1.0, 1.15, 1.2]) add({ name: `climb_stand_${h}`, frames: 90, place: [0, 0, z0 + 0.3, 0], setup: `FEEL.dynSolid([-1, 0, ${z0 + 1}], [1, ${h}, ${z0 + 3}])`, timeline: [{ f: 1, down: ['KeyW'] }, { f: 3, press: ['Space'] }], meta: { h } });
  // upper bound: sprinted gaps between two 2 m slabs (the authored Echo Step gaps are 5 m and more). 'late' presses
  // the jump as late as the sprint coyote window allows (airborne for 0.03 s), 'edge' on the last grounded frame.
  for (const w of [4.0, 4.4, 4.6, 4.8, 5.0]) for (const mode of ['late', 'edge']) add({ name: `gap_${mode}_${w}`, dt: 1 / 60, frames: 280, place: [50, 2, -14, 0],
    setup: `FEEL.dynSolid([48, 0, -20], [52, 2, 0]); FEEL.dynSolid([48, 0, ${w}], [52, 2, ${w + 6}]); FEEL.jumped = false; FEEL.air = 0;`,
    timeline: [{ f: 1, down: ['KeyW', 'ShiftLeft'] }, ...Array.from({ length: 260 }, (_, i) => ({ f: 2 + i, eval: mode === 'late'
      ? 'if (!FEEL.jumped && !__game.player.grounded && __game.player.vel.y <= 0 && __game.player.pos.z > -0.5) { FEEL.air = (FEEL.air || 0) + 1 / 60; if (FEEL.air >= 0.03) { __game.input.pressed.add("Space"); FEEL.jumped = true; } }'
      : 'if (!FEEL.jumped && __game.player.grounded && __game.player.pos.z + __game.player.vel.z / 60 > 0.16) { __game.input.pressed.add("Space"); FEEL.jumped = true; }' }))],
    meta: { w, mode } });
  // ledge tolerance: walk slowly off the 1.0 m platform edge (x = 36) and record where Kai starts to fall
  for (const [nm, tl] of [['ledge_key', [{ f: 1, down: ['KeyW'] }]], ['ledge_stick', [{ f: 1, stick: [0, 0.15, 0.15] }]]]) add({ name: nm, frames: 120, place: [34.5, 1.0, -2, PI / 2], camYaw: PI / 2 + PI, touch: nm === 'ledge_stick', timeline: tl });
  // jump buffering / coyote time probes: Space pressed 2 frames before landing, and 3 frames after walking off a ledge
  add({ name: 'buffer_probe', frames: 70, place: [0, 0, z0, 0], timeline: [{ f: 2, press: ['Space'] }, ...Array.from({ length: 60 }, (_, i) => ({ f: 5 + i, eval: 'if (!FEEL.b2 && __game.player.vel.y < 0 && __game.player.pos.y < 0.12) { __game.input.pressed.add("Space"); FEEL.b2 = __game.time; }' }))], setup: 'FEEL.b2 = 0' });
  add({ name: 'coyote_probe', frames: 70, place: [35.2, 1.0, -2, PI / 2], camYaw: PI / 2 + PI, setup: 'FEEL.c2 = 0', timeline: [{ f: 1, down: ['KeyW'] }, ...Array.from({ length: 60 }, (_, i) => ({ f: 2 + i, eval: 'if (!__game.player.grounded && !FEEL.c2) FEEL.c2 = 1; else if (FEEL.c2 > 0 && FEEL.c2 < 4) { FEEL.c2++; if (FEEL.c2 === 4) __game.input.pressed.add("Space"); }' }))] });
  // lifts: a box lift rising 3 m at 1.6 m/s then falling at 2.4 m/s (the m2 / m3 lift speeds)
  add({ name: 'lift', frames: 150, place: [-40, 0.05, 0, 0], setup: `const b = FEEL.dynSolid([-41, -0.2, -1], [-39, 0.05, 1], 0x5a7a9a); FEEL.lift = (dt, t) => { const k = FEEL.liftT = (FEEL.liftT || 0) + dt; const y = k < 0.5 ? 0 : k < 2.375 ? (k - 0.5) * 1.6 : k < 3.5 ? 3 : Math.max(0, 3 - (k - 3.5) * 2.4); b.max.y = y + 0.05; b.min.y = y - 0.2; b.mesh.position.y = y - 0.075; }; FEEL.liftT = 0;` });
  // ---- physics & controls step additions (new physics; most are no-ops or show the old behaviour under ?phys=classic) ----
  // a true ramp (collision.addRamp, 1.2 m over 6 m, 11 degrees) walked up and down; classic has no addRamp (skipped)
  add({ name: 'ramp_true', place: [45, 0, -15, 0], setup: `if (__game.collision.addRamp) { FEEL.dyn.push(__game.collision.addRamp([44, 0, -12], [46, 1.2, -6], '+z')); FEEL.dyn.push(__game.collision.add([44, 0, -6], [46, 1.2, -3])); }`,
    timeline: [{ f: 1, down: ['KeyW'] }, { f: 100, up: ['KeyW'], down: ['KeyS'] }, { f: 190, up: ['KeyS'] }], frames: 200 });
  // an opt-in carrying platform (box option carry: true) sliding 3 m along x at 1.5 m/s and back, Kai idle on it
  add({ name: 'carry_x', frames: 150, place: [-40, 0.05, 6, 0], setup: `const b = FEEL.dynSolid([-41, -0.2, 5], [-39, 0.05, 7], 0x5a7a9a, { carry: true }); FEEL.lift = (dt) => { const k = FEEL.liftT = (FEEL.liftT || 0) + dt; const x = k < 0.5 ? 0 : k < 2.5 ? (k - 0.5) * 1.5 : k < 3 ? 3 : Math.max(0, 3 - (k - 3) * 1.5); b.min.x = -41 + x; b.max.x = -39 + x; b.mesh.position.x = -40 + x; }; FEEL.liftT = 0;` });
  // edge brake at the 3 m platform (edge x = 30): a short push (stays), a long push (goes over after the hold), a coast
  // after releasing a sprint 0.4 m before the edge (stays)
  add({ name: 'edge_brief', frames: 60, place: [28.6, 3.0, -2, PI / 2], camYaw: PI / 2 + PI, timeline: [{ f: 1, down: ['KeyW'] }, { f: 22, up: ['KeyW'] }] });
  add({ name: 'edge_hold', frames: 90, place: [28.6, 3.0, -2, PI / 2], camYaw: PI / 2 + PI, timeline: [{ f: 1, down: ['KeyW'] }, { f: 80, up: ['KeyW'] }] });
  add({ name: 'edge_coast', frames: 90, place: [26.4, 3.0, -2, PI / 2], camYaw: PI / 2 + PI, timeline: [{ f: 1, down: ['KeyW', 'ShiftLeft'] }, ...Array.from({ length: 40 }, (_, i) => ({ f: 2 + i, eval: 'if (__game.player.pos.x > 29.6) __game.input.down.clear();' }))] });
  // a void edge (kill plane just under the platform top): walking never goes over; sprinting over respawns at the last
  // safe spot after a short fade (no fail)
  add({ name: 'void_walk', frames: 120, place: [28.6, 3.0, -2, PI / 2], camYaw: PI / 2 + PI, setup: 'FEEL.killY0 = __game.killY; __game.killY = 2.0;', timeline: [{ f: 1, down: ['KeyW'] }, { f: 110, up: ['KeyW'] }] });
  add({ name: 'void_respawn', frames: 150, place: [27, 3.0, -2, PI / 2], camYaw: PI / 2 + PI, setup: 'FEEL.killY0 = __game.killY; __game.killY = 2.0; FEEL.fails = 0; FEEL.fail0 = FEEL.fail0 || __game.fail; __game.fail = (...a) => { FEEL.fails++; return FEEL.fail0.apply(__game, a); };',
    timeline: [{ f: 30, down: ['KeyW', 'ShiftLeft'] }, { f: 75, up: ['KeyW', 'ShiftLeft'] }, ...Array.from({ length: 50 }, (_, i) => ({ f: 60 + i, sleep: 40 })), { f: 148, eval: '__game.fail = FEEL.fail0; FEEL.out = { fails: FEEL.fails };' }] });
  // three people standing close around Kai (a 0.9 m triangle): he must be able to walk out
  add({ name: 'people_trap', frames: 120, place: [0, 0, z0, 0], npc: true, setup: `FEEL.actor('hale', 0, 0, ${z0 + 0.55}, Math.PI); FEEL.actor('iven', 0.5, 0, ${z0 - 0.3}, 0); FEEL.actor('mira', -0.5, 0, ${z0 - 0.3}, 0);`, timeline: [{ f: 5, down: ['KeyW'] }, { f: 110, up: ['KeyW'] }] });
  // CPU cost of one game step: Kai alone, and Kai + 12 walkers (no render)
  add({ name: 'cost_kai', frames: 120, place: [0, 0, z0, 0], timeline: [{ f: 1, down: ['KeyW'] }] });
  add({ name: 'cost_crowd12', frames: 120, place: [0, 0, z0, 0], setup: 'for (let i = 0; i < 12; i++) FEEL.walker({ x: 3 + (i % 6) * 1.2, z0: -20 + (i >> 1), z1: 10, speed: 1.0 + 0.04 * i }, 5 + i * 3);', timeline: [{ f: 1, down: ['KeyW'] }] });
  return L;
}
