// Locomotion and body dynamics for the 3D cast (docs/MOTION.md, "Locomotion & secondary motion").
// One `Motion` per person (cast3d.js makePerson, unless ?motion=classic) drives the animation mixer itself:
// - a speed blend space over the owner's gait clips (walk_slow / walk, jog / run / sprint, crouch) with one shared,
//   distance-matched gait phase: every clip is aligned on its left heel strike and played so the feet travel exactly
//   as far as the body does (stride from each clip's measured speed and cycle), so planted feet do not slide;
//   a walk / run family switch with hysteresis (the walk-run transition near Froude 0.5) and stride warping toward a
//   human cadence for the speed, height and gait profile (age, sex, build, uniform, a child);
// - start, stop (the stride finishes on a foot plant), pivot and turn-in-place steps, banking into turns, a lean with
//   acceleration, crouch transitions, a jump / fall pose and a landing that dips the pelvis by the impact;
// - foot IK (ik.js) against the collision world's ground (feet planted on stairs, slopes and kerbs, the pelvis lowered
//   to the lower foot, knees keep their direction) with foot locking while a foot is in contact;
// - idle life: breathing that follows exertion, glances, a head that leads turns, look-at for head and neck
//   (the eyes are skin.js's); secondary motion comes from springs.js.
// Quality steps down with distance and tier (full near the camera, no IK further away, the bare blend space for far
// crowds); the player is always full quality.
// Inputs (the physics <-> motion interface): the Character's speed, vel, accel, turnRate, grounded, airTime, landing
// (set by the player every frame). For everyone else they are derived from root motion, so a mission that only moves
// `root.position` / `rotation.y` (and sets `speed`) gets the same walk.
// Switches: ?motion=classic (the old crossfade player), ?motion=noik,nolock,nolean,nowarp,noprofile,nohead,noidle,
// nospring (single parts off for A/B).
import * as THREE from 'three';
import { twoBoneIK, rotateWorld, setWorldQuat } from './ik.js';
import { getQuality } from '../world/realism.js';

const Q = new globalThis.URLSearchParams(globalThis.location ? globalThis.location.search : '');
const MQ = (Q.get('motion') || '').split(',').filter(Boolean);
// DEFAULT_ON: the new motion is the default; false keeps it behind ?motion=new while it is being verified
const DEFAULT_ON = false;
export const MOTION = {
  classic: MQ.includes('classic') || (!DEFAULT_ON && !MQ.includes('new')),
  off: new Set(MQ.filter(s => s.startsWith('no')).map(s => s.slice(2))),
  stats: { people: 0, full: 0, mid: 0, far: 0, ms: 0, frames: 0, errors: 0 },
};
const on = k => !MOTION.off.has(k);
// The world the feet stand in. The game may set these; otherwise window.__game is used.
export const motionWorld = { collision: null, scene: null, state: undefined, wind: null };   // wind: a Vector3 (m/s^2) for cloth and hair
// Camera and tier for the level of detail (character.js copies charView here every frame).
export const motionView = { camera: null, low: false };

const key = n => n.replace(/_\d+$/, '');
const WALKS = ['walk_slow', 'walk'], RUNS = ['jog', 'run', 'sprint'];
export const GAIT_CLIPS = new Set([...WALKS, ...RUNS, 'crouch']);
const NO_IK = new Set(['sit', 'fall']);       // poses whose feet are not on the ground under the root
const AIR = new Set(['jump', 'jump_run']);    // our authored air clips (anims_extra.glb), sampled by vertical speed
const NS = 48;                                // samples per clip loop (contact curves)
const G = 9.81;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const len2 = (x, z) => Math.max(1e-6, Math.hypot(x, z));
const approach = (x, to, rate, dt) => x + (to - x) * (1 - Math.exp(-rate * dt));
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// critically damped spring toward `to` (o = { x, v }), angular frequency w
function spring(o, to, w, dt) {
  if (!(dt > 0)) return o.x;
  const e = Math.exp(-w * dt), x = o.x - to, k = o.v + w * x;
  o.x = to + (x + k * dt) * e; o.v = (o.v - w * k * dt) * e;
  return o.x;
}

// ---------------- per template: what the clips do (sampled once, after retargeting) ----------------
/**
 * Measure the retargeted clips of template t ({ root, clips, speeds }): for each clip its loop duration, gait cycles
 * per loop, the loop fraction of the left heel strike, foot contact curves, a double-support ("stand") phase, arm swing
 * per side and the mean arm pose; for the template the planted ankle / toe heights and leg length.
 */
export function analyseTemplate(t) {
  if (t.motionInfo !== undefined) return t.motionInfo;
  t.motionInfo = null;
  const root = t.root, B = {};
  root.traverse(o => { if (o.isBone) B[key(o.name)] = o; });
  const need = ['hips', 'thigh_L', 'shin_L', 'foot_L', 'toe_L', 'thigh_R', 'shin_R', 'foot_R', 'toe_R'];
  if (need.some(k => !B[k])) return null;
  const saved = [];
  root.traverse(o => { if (o.isBone) saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
  const r0 = [root.position.clone(), root.quaternion.clone(), root.scale.clone()];
  root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.set(1, 1, 1);
  const mixer = new THREE.AnimationMixer(root), v = new THREE.Vector3();
  const pts = ['foot_L', 'toe_L', 'foot_R', 'toe_R', 'hips', 'hand_L', 'hand_R'].filter(k => B[k]);
  const ARMS = ['upperarm_L', 'forearm_L', 'upperarm_R', 'forearm_R'].filter(k => B[k]);
  const raw = {};
  for (const name in t.clips) {
    const clip = t.clips[name], D = clip.duration || 1, a = mixer.clipAction(clip);
    a.play();
    const P = {}; for (const k of pts) P[k] = new Float32Array(NS * 3);
    const qs = {}; for (const k of ARMS) qs[k] = new THREE.Quaternion(0, 0, 0, 0);
    for (let i = 0; i < NS; i++) {
      mixer.setTime(D * i / NS); root.updateMatrixWorld(true);
      for (const k of pts) { B[k].getWorldPosition(v); P[k][i * 3] = v.x; P[k][i * 3 + 1] = v.y; P[k][i * 3 + 2] = v.z; }
      for (const k of ARMS) { const q = B[k].quaternion, s = qs[k]; const sg = (s.x * q.x + s.y * q.y + s.z * q.z + s.w * q.w) < 0 ? -1 : 1; s.x += q.x * sg; s.y += q.y * sg; s.z += q.z * sg; s.w += q.w * sg; }
    }
    for (const k of ARMS) qs[k].normalize();
    a.stop(); mixer.uncacheAction(clip);
    raw[name] = { D, P, qs };
  }
  mixer.uncacheRoot(root);
  for (const [o, p, q, s] of saved) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }
  root.position.copy(r0[0]); root.quaternion.copy(r0[1]); root.scale.copy(r0[2]);
  root.updateMatrixWorld(true);
  // planted heights: the lowest ankle / toe of the steady gaits
  const low = (k, side) => { let m = Infinity; for (const n of ['walk', 'walk_slow', 'jog', 'run']) { const r = raw[n]; if (!r) continue; const A = r.P[k + '_' + side]; for (let i = 0; i < NS; i++) m = Math.min(m, A[i * 3 + 1]); } return isFinite(m) ? m : 0.08; };
  const ank = { L: low('foot', 'L'), R: low('foot', 'R') }, toe = { L: low('toe', 'L'), R: low('toe', 'R') };
  // rest leg length (thigh -> shin -> foot)
  root.updateMatrixWorld(true);
  const w = k => B[k].getWorldPosition(new THREE.Vector3());
  const leg = w('thigh_L').distanceTo(w('shin_L')) + w('shin_L').distanceTo(w('foot_L'));
  const clips = {};
  for (const name in raw) {
    const { D, P, qs } = raw[name];
    // gaits: against the gaits' planted heights; other clips (idle stands 2-4 cm higher at the ankle): their own lowest
    const sole = side => {
      const out = new Float32Array(NS), F = P['foot_' + side], T = P['toe_' + side];
      let a0 = ank[side], t0 = toe[side];
      if (!GAIT_CLIPS.has(name) && !AIR.has(name)) { a0 = Infinity; t0 = Infinity; for (let i = 0; i < NS; i++) { a0 = Math.min(a0, F[i * 3 + 1]); t0 = Math.min(t0, T[i * 3 + 1]); } }
      for (let i = 0; i < NS; i++) out[i] = Math.min(F[i * 3 + 1] - a0, T[i * 3 + 1] - t0);
      return out;
    };
    const sL = sole('L'), sR = sole('R');
    // the planted ankle / ball heights this clip means by "on the ground" (gaits: the gaits' own; poses: their lowest)
    const ref = { L: [ank.L, toe.L], R: [ank.R, toe.R] };
    if (!GAIT_CLIPS.has(name) && !AIR.has(name)) for (const side of ['L', 'R']) { const F = P['foot_' + side], T = P['toe_' + side]; let a0 = Infinity, t0 = Infinity; for (let i = 0; i < NS; i++) { a0 = Math.min(a0, F[i * 3 + 1]); t0 = Math.min(t0, T[i * 3 + 1]); } ref[side] = [a0, t0]; }
    // contact: the sole within ~2 cm of its planted height and the foot (nearly) still on the ground: in the clip the
    // body travels at the clip's speed along +z, so a planted foot moves back at that speed
    // the speed a planted foot really moves back at in the clip (the trial's mean root speed is 5-13 % off it, which
    // is what made every gait slide): the median foot speed over the frames where the sole is down
    let speed0 = (t.speeds && t.speeds[name]) || 0;
    if (GAIT_CLIPS.has(name) && speed0 > 0) {
      const vs = [], dtS = D / NS;
      for (const side of ['L', 'R']) {
        const F = P['foot_' + side], T = P['toe_' + side], s = side === 'L' ? sL : sR;
        for (let i = 0; i < NS; i++) {
          if (s[i] > 0.012) continue;
          const j = (i + 1) % NS, k = (i + NS - 1) % NS;
          const heelDown = F[i * 3 + 1] - ank[side] < 0.015;
          const A = heelDown ? F : T;      // heel down: the ankle is planted; heel up: the ball is
          vs.push(-(A[j * 3 + 2] - A[k * 3 + 2]) / (2 * dtS));
        }
      }
      vs.sort((x, y) => x - y);
      if (vs.length >= 4) { const m = vs[vs.length >> 1]; if (m > 0.3 * speed0 && m < 1.5 * speed0) speed0 = m; }
    }
    const con = (s, side) => {
      const c = new Float32Array(NS), F = P['foot_' + side], dtS = D / NS;
      for (let i = 0; i < NS; i++) {
        const j = (i + 1) % NS, k = (i + NS - 1) % NS;
        const vx = (F[j * 3] - F[k * 3]) / (2 * dtS), vz = (F[j * 3 + 2] - F[k * 3 + 2]) / (2 * dtS) + speed0;
        c[i] = clamp((0.045 - s[i]) / 0.02, 0, 1) * clamp((1.6 - Math.hypot(vx, vz)) / 0.6, 0, 1);
      }
      return c;
    };
    const cL = con(sL, 'L'), cR = con(sR, 'R');
    const onsets = c => { const o = []; for (let i = 0; i < NS; i++) { const p = c[(i + NS - 1) % NS]; if (p < 0.5 && c[i] >= 0.5) o.push(i); } return o; };
    // gait cycles and strikes from the sole height alone (a strike: the sole comes down into the lowest quarter)
    const low = s => { let a = Infinity, b = -Infinity; for (let i = 0; i < NS; i++) { a = Math.min(a, s[i]); b = Math.max(b, s[i]); } const th = a + Math.max(0.012, 0.25 * (b - a)); const c = new Float32Array(NS); for (let i = 0; i < NS; i++) c[i] = s[i] < th ? 1 : 0; return c; };
    // strikes: where the contact begins (gaits), else where the sole comes down into its lowest quarter
    let oL = onsets(cL), oR = onsets(cR);
    if (!oL.length || !oR.length) { oL = onsets(low(sL)); oR = onsets(low(sR)); }
    const n = Math.max(1, oL.length);
    let stand = 0, best = Infinity;
    for (let i = 0; i < NS; i++) { const m = Math.max(sL[i], sR[i]); if (m < best) { best = m; stand = i / NS; } }
    let ampL = 0, ampR = 0;
    if (P.hand_L && P.hand_R) {
      const rng = k => { let a = Infinity, b = -Infinity; const H = P[k], Hp = P.hips; for (let i = 0; i < NS; i++) { const z = H[i * 3 + 2] - Hp[i * 3 + 2]; a = Math.min(a, z); b = Math.max(b, z); } return b - a; };
      ampL = rng('hand_L'); ampR = rng('hand_R');
    }
    const speed = speed0;
    clips[name] = { D, n, ref, o: oL.length ? oL[0] / NS : 0, oR: oR.length ? oR[0] / NS : 0.5, cL, cR, stand, speed, dist: speed * D, stride: speed * D / n, ampL, ampR, qs };
  }
  t.motionInfo = { clips, ank, toe, leg, hipH: w('hips').y };
  return t.motionInfo;
}
// contact (0..1) of curve c at loop fraction f
const contactAt = (c, f) => { const x = (f - Math.floor(f)) * NS, i = Math.floor(x), j = (i + 1) % NS, u = x - i; return c[i % NS] * (1 - u) + c[j] * u; };

// ---------------- gait profiles ----------------
/**
 * Per-person gait from the cast index (sex, age, height) and the look (build, age, uniform): cadence and stride
 * scale, arm swing, posture. Values near 1 / 0 are neutral; nothing here changes how far anyone travels.
 */
export function gaitProfile(id, meta = {}, look = {}) {
  const P = { cadence: 1, stride: 1, arm: 1, stoop: 0, upright: 0, sway: 1, runAt: 2.1, bounce: 1, width: 0, glance: 1, child: false };
  if (!on('profile')) return P;
  const h = meta.height || look.height || 1.75, age = look.age ?? meta.age ?? 30;
  const female = meta.sex ? meta.sex === 'f' : !!look.female;
  const child = h < 1.45 || /kid|child/.test(id || '');
  const old = clamp((age - 50) / 25, 0, 1);
  const build = look.build ?? 1, heavy = clamp((build - 1) / 0.15, 0, 1) + (/heavy|stocky/.test(look.body || '') ? 0.5 : 0);
  const uniform = /continuum|helix_sec|security|^sec_/.test(id || '');
  P.child = child;
  P.cadence = Math.sqrt(1.8 / h) * (1 + 0.03 * (female ? 1 : 0) + 0.05 * old - 0.04 * heavy + (child ? 0.04 : 0));
  P.stride = 1 - 0.1 * old - 0.03 * heavy;
  P.arm = (1 - 0.3 * old) * (uniform ? 0.82 : 1) * (child ? 1.12 : 1) * (female ? 0.92 : 1);
  P.stoop = 0.1 * old + (id === 'witness' ? 0.04 : 0);
  P.upright = uniform ? 0.035 : 0;
  P.sway = female ? 1.25 : 1;
  P.runAt = 2.1 * Math.sqrt(h / 1.8) * (1 + 0.1 * old);
  P.bounce = child ? 1.25 : 1 - 0.3 * old;
  P.width = 0.025 * heavy;
  P.glance = child ? 1.6 : 1 - 0.3 * old;
  return P;
}

// ---------------- the world under the feet ----------------
const fallbackWorld = { collision: null, scene: null, state: undefined };
function theWorld() {
  if (motionWorld.collision) return motionWorld;
  const g = globalThis.__game;
  if (!g || !g.collision) return null;
  motionWorld._g = g;
  fallbackWorld.collision = g.collision; fallbackWorld.scene = g.scene; fallbackWorld.state = g.temporal ? g.temporal.current : undefined;
  return fallbackWorld;
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _hipP = new THREE.Vector3(), _e = new THREE.Euler(), UP = new THREE.Vector3(0, 1, 0), _right = new THREE.Vector3(), _fwd = new THREE.Vector3();

class Foot {
  constructor(B, side) {
    this.side = side; this.th = B['thigh_' + side]; this.sh = B['shin_' + side]; this.ft = B['foot_' + side]; this.toe = B['toe_' + side];
    // lock: the planted ankle; ball: the planted ball of the foot (pivot 1: the heel has come up, the foot rolls on
    // the ball); pin: where the ankle is held this frame; lockGY / lockBox: the ground under the plant (a lift moves it)
    this.lock = new THREE.Vector3(); this.ball = new THREE.Vector3(); this.pin = new THREE.Vector3(); this.pivot = 0;
    this.locked = false; this.lockW = 0; this.lockYaw = 0; this.lockG = 0; this.lockGY = 0; this.lockBox = null; this.lockBoxY = 0;
    this.step = null; this.delta = 0; this.c = 0; this.heelH = 0; this.ballH = 0; this.prevSole = 1; this.prevC = 0;
    this.shX = 0; this.shZ = 0; this.shW = 0; this.shSign = 0;     // landing moved onto one tread (stairs, kerbs)
    this.anim = new THREE.Vector3(); this.prev = new THREE.Vector3(); this.prevOk = false; this.toeP = new THREE.Vector3(); this.target = new THREE.Vector3(); this.q = new THREE.Quaternion();
  }
}

/** The motion of one person (see the file comment). h = makePerson handle, info = analyseTemplate(t). */
export class Motion {
  constructor(h, info, seed = 1, profile = null) {
    this.h = h; this.info = info; this.B = h.bones; this.rng = mulberry(seed * 977 + 11);
    this.P = profile || gaitProfile(h.id);
    this.ch = null; this.cmd = { speed: 0, crouch: false, pose: 'idle' };
    this.phi = 0.05; this.wLoco = 0; this.wAir = 0; this.F = 0; this.runMode = false; this.k = 1; this.cr = 0;
    this.poses = new Map(); this.poseName = null; this.poseFade = 0.35;
    this.feet = [new Foot(this.B, 'L'), new Foot(this.B, 'R')];
    this.dip = { x: 0, v: 0 }; this.drop = 0; this.roll = { x: 0, v: 0 }; this.pitch = { x: 0, v: 0 }; this.yawOff = 0;
    this.prevP = new THREE.Vector3(); this.prevYaw = 0; this.valid = false;
    this.v = 0; this.vel = new THREE.Vector3(); this.acc = 0; this.turn = 0; this.grounded = true; this.airT = 0; this.landing = 0; this.inPlace = false;
    this.vSm = 0; this.accSm = 0; this.turnSm = 0; this.hero = false;
    this.head = { yaw: { x: 0, v: 0 }, pitch: { x: 0, v: 0 }, gy: 0, gp: 0, gT: 1 + this.rng() * 3, hold: 0 };
    this.breath = this.rng() * 6; this.exert = 0;
    this.lod = 0; this.lodT = this.rng() * 0.25; this.ikW = 1; this.springs = null;
    this.ground = { boxes: [], x: 1e9, z: 1e9, t: 0, world: null, inWorld: false, wt: 0 };
    this.vy = 0; this.stopping = false; this.err = 0;
    this.rootQ = new THREE.Quaternion();
    MOTION.stats.people++;
    // every clip action is driven here: managed actions run with timeScale 0 and get their time and weight each frame
    for (const n in h.actions) { const a = h.actions[n]; a.stopFading(); a.weight = 0; }
  }

  // ---- inputs ----
  sense(dt) {
    const ch = this.ch, h = this.h;
    const R = ch ? ch.root : h.root;
    h.root.getWorldPosition(_v);
    const yaw = R.rotation.y;
    this.hero = !!(ch && ch.vel && ch.vel.isVector3 && typeof ch.airTime === 'number');
    let tele = !this.valid;
    const dx = _v.x - this.prevP.x, dz = _v.z - this.prevP.z, dy = _v.y - this.prevP.y, dist = Math.hypot(dx, dz);
    if (this.valid && dt > 0 && (dist > Math.max(1.0, 15 * dt) || Math.abs(dy) > 2)) tele = true;
    let dyaw = this.valid ? wrap(yaw - this.prevYaw) : 0;
    if (tele) { dyaw = 0; this.yawOff = 0; this.resetFeet(); }
    // a yaw snap (a 180 at a lane end, a mission facing someone at once): the body turns over ~0.4 s instead
    else if (dt > 0 && Math.abs(dyaw) / dt > 14 && on('lean')) { this.yawOff = wrap(this.yawOff - dyaw); dyaw = 0; }
    if (this.hero) {
      this.v = ch.speed || 0; this.vel.copy(ch.vel); this.acc = ch.accel || 0; this.turn = ch.turnRate || 0;
      this.grounded = ch.grounded !== false; this.airT = ch.airTime || 0; this.landing = ch.landing || 0; this.inPlace = false;
    } else {
      const cmd = ch ? (ch.speed || 0) : this.cmd.speed;
      if (dt > 0 && !tele) {
        const vi = dist / dt;
        this.vSm = approach(this.vSm, vi, 14, dt);
        const vNew = this.vSm < 0.03 ? 0 : this.vSm;
        this.accSm = approach(this.accSm, (vNew - this.v) / dt, 8, dt);
        this.turnSm = approach(this.turnSm, dyaw / dt, 10, dt);
        if (vi > 0.02) this.vel.set(dx / dt, dy / dt, dz / dt); else this.vel.set(0, 0, 0);
      }
      // a mission that sets speed but leaves the root in place (walking on the spot, carried by a parent) still walks
      this.inPlace = this.vSm < 0.1 && cmd > 0.05;
      this.v = this.inPlace ? cmd : (this.vSm < 0.03 ? 0 : this.vSm);
      this.acc = this.accSm; this.turn = this.turnSm; this.grounded = true; this.airT = 0; this.landing = 0;
    }
    // the drawn body moved by more than its velocity explains (a carrying platform): planted feet ride along
    if (this.valid && !tele && this.hero && dt > 0) {
      const ex = dx - this.vel.x * dt, ez = dz - this.vel.z * dt;
      if (Math.hypot(ex, ez) > 0.012 + 0.3 * this.v * dt) for (const f of this.feet) { f.lock.x += ex; f.lock.z += ez; }
    }
    this.prevP.copy(_v); this.prevYaw = yaw; this.valid = true;
    this.yawOff = clamp(this.yawOff, -Math.PI, Math.PI);
    return tele;
  }

  resetFeet() { for (const f of this.feet) { f.locked = false; f.lockW = 0; f.step = null; f.delta = 0; } this.drop = 0; }

  // ---- level of detail: 0 full (IK, locks, head, springs), 1 no IK, 2 far crowd (blend space only) ----
  pickLOD(dt) {
    if (this.hero) { this.lod = 0; return; }
    if ((this.lodT -= dt) > 0) return;
    this.lodT = 0.3;
    const cam = motionView.camera, low = motionView.low || tierName() === 'low';
    let d = 0;
    if (cam) { this.h.root.getWorldPosition(_v); d = _v.distanceTo(cam.position); }
    const near = low ? 6 : 12, mid = low ? 18 : 32;
    this.lod = (this.h.lod === 1 && low) ? 2 : d < near ? 0 : d < mid ? 1 : 2;
    this.camDist = d;
  }

  // ---- the frame ----
  update(dt) {
    const t0 = globalThis.performance ? globalThis.performance.now() : 0;
    try { this.frame(dt); } catch (e) {
      if (!this.err++) console.warn('motion: falling back to the plain mixer for', this.h.id, e && e.message);
      MOTION.stats.errors++;
      this.h.mixer.update(dt);
    }
    if (t0) { MOTION.stats.ms += globalThis.performance.now() - t0; }
    // missions turn their people after the people have been updated (game.js runs actors before updaters): a yaw
    // snap made then is caught just before the render (lateYaw) so it never shows for a frame
    if (!this.hero && this.valid && this.ch) { LATE.push(this); const sc = this.ground.world && this.ground.world.scene; if (sc && !sc.userData.azMotionLate) installLate(sc); }
  }

  lateYaw() {
    const R = this.ch.root, d = wrap(R.rotation.y - this.prevYaw);
    if (Math.abs(d) < 0.35 || !on('lean')) return;
    this.yawOff = wrap(this.yawOff - d); this.prevYaw = R.rotation.y;
    _e.set(this.pitch.x, this.yawOff, this.roll.x, 'YZX');
    this.h.root.quaternion.setFromEuler(_e);
    this.h.root.updateMatrixWorld(true);
  }

  frame(dt) {
    dt = Math.max(0, Math.min(dt || 0, 0.25));
    const h = this.h, A = h.actions, I = this.info, ch = this.ch;
    const tele = this.sense(dt);
    this.pickLOD(dt);
    const P = this.P, v = this.v;
    // ---- what the body wants: pose, crouch, air
    const crouch = clamp(ch ? +ch.crouch || 0 : (this.cmd.crouch ? 1 : 0), 0, 1);
    this.cr = crouch;
    let pose = ch ? (ch.pose && A[ch.pose] && !GAIT_CLIPS.has(ch.pose) ? ch.pose : ch.talk > 0 ? 'talk' : 'idle') : this.cmd.pose;
    if (!A[pose]) pose = 'idle';
    const air = this.hero && !this.grounded && (this.airT > 0.09 || this.vel.y > 1.0);
    this.wAir = approach(this.wAir, air ? 1 : 0, air ? 7 : 16, dt);
    if (tele) this.wAir = air ? 1 : 0;
    // locomotion weight: on with speed; stopping lets the stride finish on a plant
    const locoT = smooth(0.05, 0.45, v);
    this.wLoco = tele ? locoT : approach(this.wLoco, locoT, locoT > this.wLoco ? 14 : 7, dt);
    if (this.wLoco < 0.004) this.wLoco = 0;
    // ---- gait family (walk / run) with hysteresis
    const runAt = P.runAt;
    if (!this.runMode && v > runAt * 1.07) this.runMode = true;
    else if (this.runMode && v < runAt * 0.92) this.runMode = false;
    // a quick switch when the speed is well past the walk-run speed (a sprint start does not jog through a walk)
    const fT = this.runMode ? (v > runAt * 1.5 ? 0.12 : 0.28) : (v < runAt * 0.6 ? 0.15 : 0.28);
    this.F = tele ? (this.runMode ? 1 : 0) : clamp(this.F + (this.runMode ? 1 : -1) * dt / fT, 0, 1);
    // ---- weights inside each family (by the template's clip speeds)
    const C = I.clips, sp = n => (C[n] ? C[n].speed : 0);
    const ww = {};
    let s1 = sp('walk_slow'), s2 = sp('walk');
    if (C.walk && C.walk_slow && s2 > s1) { const u = clamp((v - s1) / (s2 - s1), 0, 1); ww.walk_slow = 1 - u; ww.walk = u; } else if (C.walk) ww.walk = 1; else if (C.walk_slow) ww.walk_slow = 1;
    const wr = {};
    const rn = RUNS.filter(n => C[n]);
    if (rn.length) {
      if (v <= sp(rn[0])) wr[rn[0]] = 1;
      else if (v >= sp(rn[rn.length - 1])) wr[rn[rn.length - 1]] = 1;
      else for (let i = 0; i < rn.length - 1; i++) { const a = sp(rn[i]), b = sp(rn[i + 1]); if (v >= a && v <= b) { const u = (v - a) / (b - a); wr[rn[i]] = 1 - u; wr[rn[i + 1]] = u; break; } }
    }
    // ---- stride (per gait cycle) and the human cadence it is warped toward
    const fam = (W) => { let s = 0, t = 0; for (const n in W) { s += W[n] * C[n].stride; t += W[n]; } return t > 0 ? s / t : 1; };
    const Sw = fam(ww), Sr = rn.length ? fam(wr) : Sw, Sc = C.crouch ? C.crouch.stride : Sw;
    let Sgeo = Sw * (1 - this.F) + Sr * this.F;
    Sgeo = Sgeo * (1 - crouch) + Sc * crouch;
    const vv = Math.max(v, 0.05);
    const fW = 1.0 + 0.6 * vv, fR = 2.4 + 0.12 * vv, fC = 0.8 + 0.6 * vv;           // steps per second
    let f = fW * (1 - this.F) + fR * this.F; f = f * (1 - crouch) + fC * crouch;
    f *= P.cadence;
    // stairs and steep ground: shorter, quicker steps (fewer treads skipped per step)
    const stairs = smooth(0.15, 0.5, this.slope || 0);
    const Stgt = 2 * vv / f * P.stride * (1 - 0.35 * stairs);
    const warp = this.lod === 0 && !this.inPlace && on('warp') && on('ik');
    const kT = warp ? clamp(Stgt / Math.max(0.2, Sgeo), 0.82 - 0.2 * stairs, 1.14 + 0.24 * crouch) : 1;     // a crouched sneak takes longer steps, not a scuttle
    this.k = tele || !warp ? kT : approach(this.k, kT, 5, dt);
    const S = Math.max(0.2, Sgeo * this.k);
    // ---- the gait phase (cycles; 0 = left heel strike)
    if (this.wLoco <= 0.004) {
      this.phi = crouch > 0.02 && C.crouch ? (C.crouch.stand - C.crouch.o) * C.crouch.n : 0.05;
      this.stopping = false;
    } else if (this.grounded) {
      let dphi = v * dt / S;
      // stopping: keep stepping until the next foot plant (either foot), then hold
      this.stopping = locoT < 0.5 && this.wLoco > 0.05;
      if (this.stopping) {
        const half = this.phi * 2, next = Math.ceil(half - 0.02) / 2;
        if (next - this.phi > 0.005) dphi = Math.max(dphi, Math.min(next - this.phi, 1.1 * dt));
      }
      this.phi += dphi;
    }
    if (this.phi > 1e4) this.phi -= Math.floor(this.phi);
    // ---- action weights (they sum to 1)
    const wA = this.wAir * (1 - 0.4 * this.wLoco);
    const wl = this.wLoco * (1 - wA), wp = (1 - this.wLoco) * (1 - wA);
    const W = this._w || (this._w = {});
    for (const n in A) W[n] = 0;
    for (const n in ww) W[n] += wl * (1 - crouch) * (1 - this.F) * ww[n];
    for (const n in wr) W[n] += wl * (1 - crouch) * this.F * wr[n];
    if (A.crouch) W.crouch += (wl + wp) * crouch;
    else W[pose] += (wl + wp) * crouch;
    // the pose layer: its own fades between poses
    this.fadePoses(pose, dt, tele);
    let pw = 0; for (const [, e] of this.poses) pw += e.w;
    for (const [n, e] of this.poses) W[n] += wp * (1 - crouch) * (pw > 0 ? e.w / pw : 0);
    // in the air: our jump clips (a standing jump or a stride in the air, by ground speed), else the old fall / idle
    if (A.jump && A.jump_run) { const r = smooth(1.2, 3.8, v); W.jump += wA * (1 - r); W.jump_run += wA * r; }
    else if (A.fall) W.fall += wA; else W.idle += wA;
    // times: gait clips from the shared phase, the fall clip from the vertical speed
    const timeOf = n => { const c = C[n]; const fr = c.o + this.phi / c.n; return (fr - Math.floor(fr)) * c.D; };
    for (const n of GAIT_CLIPS) {
      const a = A[n]; if (!a) continue;
      if (W[n] > 0 || a.isScheduled()) { a.timeScale = 0; a.time = timeOf(n); }
    }
    this.vy = this.hero ? this.vel.y : 0;
    if (!air) this.airJump = false; else if (this.airT < 0.12 && this.vy > 1.5) this.airJump = true;
    if (A.fall && W.fall > 0) { A.fall.timeScale = 0; A.fall.time = clamp(0.5 - this.vy * 0.07, 0, 0.5) * C.fall.D; }
    // phase: 0 take-off, 0.5 apex, 1 reaching for the ground (a step off a ledge starts with the legs down)
    const ph = this.airJump ? clamp(0.5 - this.vy * 0.125, 0, 1) : clamp(0.8 - this.vy * 0.05, 0.8, 1);
    for (const n of AIR) { const a = A[n]; if (a && (W[n] > 0 || a.isScheduled())) { a.timeScale = 0; a.time = ph * C[n].D * 0.999; } }
    let top = 0, topN = h.current;
    for (const n in A) {
      const a = A[n], w = W[n];
      if (w > 0.0005) { if (!a.isScheduled()) { a.play(); if (!GAIT_CLIPS.has(n) && n !== 'fall' && !AIR.has(n)) a.time = this.poseStart(n); } a.enabled = true; a.weight = w; if (w > top) { top = w; topN = n; } }
      else if (a.isScheduled()) { a.weight = 0; a.stop(); }
    }
    if (topN !== h.current) { const prev = h.current; h.current = topN; if (h.postureChanged) h.postureChanged(prev, topN); }
    h.mixer.update(dt);
    // contact per foot (weighted over the clips in play)
    for (const ft of this.feet) {
      let c = 0, cw = 0;
      for (const n in A) {
        const w = W[n]; if (!(w > 0.0005)) continue;
        const ci = C[n]; cw += w;
        if (!ci || NO_IK.has(n) || AIR.has(n)) continue;
        const a = A[n], fr = a.time / ci.D;
        c += w * contactAt(ft.side === 'L' ? ci.cL : ci.cR, fr);
      }
      ft.c = cw > 0 ? c / cw : 0;
    }
    // the planted heights of the clips in play (idle stands 2-4 cm higher at the ankle than a walking plant)
    const R = this.ref || (this.ref = { L: [0, 0], R: [0, 0] });
    for (const side of ['L', 'R']) {
      let a = 0, t = 0, w = 0;
      for (const n in A) { const wn = W[n], ci = C[n]; if (!(wn > 0.0005) || !ci || !ci.ref || NO_IK.has(n)) continue; a += wn * ci.ref[side][0]; t += wn * ci.ref[side][1]; w += wn; }
      R[side][0] = w > 0 ? a / w : I.ank[side]; R[side][1] = w > 0 ? t / w : I.toe[side];
    }
    this.poseNoIK = NO_IK.has(topN) || NO_IK.has(pose) && wp > 0.5;
    this.layers(dt, tele, pose);
  }

  poseStart(n) { const c = this.info.clips[n]; return c ? this.rng() * c.D : 0; }

  fadePoses(pose, dt, tele) {
    const A = this.h.actions;
    if (!this.poses.has(pose)) this.poses.set(pose, { w: this.poses.size ? 0 : 1 });
    for (const [n, e] of this.poses) {
      const to = n === pose ? 1 : 0;
      e.w = tele ? to : clamp(e.w + (to ? 1 : -1) * dt / this.poseFade, 0, 1);
      if (e.w <= 0 && n !== pose) { this.poses.delete(n); continue; }
      const a = A[n]; if (a) a.timeScale = this.h.pace || 1;
    }
  }

  // ---- procedural layers on top of the clips ----
  layers(dt, tele, pose) {
    const h = this.h;
    const v = this.v;
    // body lean (banking into turns, pitching with acceleration) and the eased yaw snap, about the feet
    let roll = 0, pitch = 0;
    if (on('lean') && this.grounded) {
      roll = -clamp(Math.atan(v * this.turn / G) * 0.62, -0.3, 0.3);
      pitch = clamp(Math.atan(this.acc / G) * 0.45, -0.1, 0.13) * smooth(0.2, 1.2, Math.max(v, Math.abs(this.acc) * 0.2));
    }
    if (tele) { this.roll.x = roll; this.roll.v = 0; this.pitch.x = pitch; this.pitch.v = 0; }
    spring(this.roll, roll, 9, dt); spring(this.pitch, pitch, 7, dt);
    if (dt > 0 && this.yawOff !== 0) {
      const r = Math.min(Math.abs(this.yawOff), (1.5 + 2.6 * Math.abs(this.yawOff)) * dt);     // a half turn takes about 0.6 s
      this.yawOff -= Math.sign(this.yawOff) * r;
      if (Math.abs(this.yawOff) < 1e-3) this.yawOff = 0;
    }
    _e.set(this.pitch.x, this.yawOff, this.roll.x, 'YZX');
    h.root.quaternion.setFromEuler(_e);
    // the landing: the pelvis dips by the impact (knees take it through the leg IK)
    if (this.landing > 0.5 && this.hero) this.dip.v -= clamp(0.01 + this.landing * 0.022, 0, 0.15) * 13 * Math.E;
    spring(this.dip, 0, 13, dt);
    if (this.dip.x < -0.17) { this.dip.x = -0.17; this.dip.v = Math.max(0, this.dip.v); }
    this.exert = clamp(this.exert + (v > 2.5 ? (v / 5.6) * 0.25 : -0.06) * dt, 0, 1);
    h.root.updateWorldMatrix(true, true);       // parents too: the root moved this frame
    // the feet, the pelvis and the legs
    const ikOn = on('ik') && !this.poseNoIK && this.lod === 0 && !this.inPlace;
    this.ikW = tele ? (ikOn ? 1 : 0) : clamp(this.ikW + (ikOn ? 1 : -1) * dt / 0.3, 0, 1);
    if (this.ikW > 0 || this.dip.x < -0.002) this.legs(dt, tele);
    // upper body: posture, arm swing, breathing, head
    if (this.lod < 2) this.upper(dt, pose);
    // secondary motion (springs.js): full dynamics near the camera, collision only further away, nothing on a low LOD
    if (this.springs && this.h.lod !== 1) {
      if (tele) this.springs.reset();
      if (motionWorld.wind) this.springs.wind.copy(motionWorld.wind);
      this.springs.update(dt, this.lod === 0 && on('spring'));
    }
  }

  // ground height under (x, z) near the plane y0, or null
  groundAt(x, z, y0) {
    const G0 = this.ground, W = G0.world;
    if (!W) return null;
    const col = W.collision, st = W.state;
    let top = null, box = null; const lim = y0 + 0.5;
    for (const b of G0.boxes) {
      if (!b.enabled || (st !== undefined && b.states && !b.states.includes(st))) continue;
      if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue;
      const t = b.ramp && col.topAt ? col.topAt(b, x, z) : b.max.y;
      if (t <= lim && (top === null || t > top)) { top = t; box = b; }
    }
    this.gbox = box;
    return top;
  }
  refreshGround(dt, x, z) {
    const G0 = this.ground;
    if ((G0.wt -= dt) <= 0) {           // is this person standing in the game world (not a portrait or a tool scene)?
      G0.wt = 1;
      const W = theWorld();
      let top = this.h.root; while (top.parent) top = top.parent;
      G0.world = W && W.scene && top === W.scene ? W : null;
    }
    const W = G0.world;
    if (!W) { G0.boxes.length = 0; return; }
    const g = motionWorld._g;
    if (g && W === fallbackWorld) { W.state = g.temporal ? g.temporal.current : undefined; W.collision = g.collision; }
    const moved = Math.abs(x - G0.x) > 0.6 || Math.abs(z - G0.z) > 0.6;
    if (this.hero || moved || (G0.t -= dt) <= 0) {
      G0.t = 0.4; G0.x = x; G0.z = z;
      const col = W.collision, r = 1.6;
      G0.boxes.length = 0;
      for (const b of col.boxes) if (!(b.max.x < x - r || b.min.x > x + r || b.max.z < z - r || b.min.z > z + r)) G0.boxes.push(b);
    }
  }

  legs(dt, tele) {
    const h = this.h, B = this.B, I = this.info, feet = this.feet;
    const hips = B.hips; if (!hips) return;
    const root = h.root;
    root.getWorldPosition(_v3);
    const plane = _v3.y, sc = root.getWorldScale(_v2).y;
    this.refreshGround(dt, _v3.x, _v3.z);
    // how steep the ground ahead is (stairs, ramps): rise over 0.6 m along the motion
    if (this.ground.world && this.v > 0.3 && this.vel) {
      const vh = Math.hypot(this.vel.x, this.vel.z) || 1, ax = _v3.x + this.vel.x / vh * 0.6, az = _v3.z + this.vel.z / vh * 0.6;
      const g0 = this.groundAt(_v3.x, _v3.z, _v3.y), g1 = this.groundAt(ax, az, _v3.y + 0.3);
      this.slope = approach(this.slope || 0, g0 !== null && g1 !== null ? Math.min(1, Math.abs(g1 - g0) / 0.6) : 0, 6, dt);
    } else this.slope = approach(this.slope || 0, 0, 6, dt);
    const grounded = this.grounded && this.wAir < 0.5, world = !!this.ground.world;
    // forward axis of the body, for stride warping
    root.getWorldQuaternion(_q);
    _fwd.set(0, 0, 1).applyQuaternion(_q); _fwd.y = 0; _fwd.normalize();
    const yawW = Math.atan2(_fwd.x, _fwd.z);
    const hipP = hips.getWorldPosition(_hipP);
    const kw = (this.k - 1) * this.wLoco;
    const lockOn = on('lock') && grounded;
    // gait style on the pelvis (before the feet are read, the leg IK keeps them planted): more pelvic rotation and
    // side sway for a female gait profile, the chest counter-rotating
    const sw = (this.P.sway - 1) * 4 * this.wLoco * (1 - this.F) * (1 - this.cr);
    if (sw > 0.01 && on('profile')) {
      const c2 = Math.cos(2 * Math.PI * this.phi), s2 = Math.sin(4 * Math.PI * this.phi);
      rotateWorld(hips, _q2.setFromAxisAngle(UP, -0.07 * sw * c2));
      rotateWorld(hips, _q2.setFromAxisAngle(_fwd, 0.035 * sw * s2 * (c2 > 0 ? 1 : -1)));
      if (B.chest) rotateWorld(B.chest, _q2.setFromAxisAngle(UP, 0.08 * sw * c2));
      hipP.copy(hips.getWorldPosition(_v));
    }
    for (const f of feet) {
      f.ft.getWorldPosition(f.anim); f.toe.getWorldPosition(f.toeP); f.ft.getWorldQuaternion(f.q);
      // stride warp: the foot's distance ahead of / behind the hips grows or shrinks by k
      if (kw !== 0) {
        const along = (f.anim.x - hipP.x) * _fwd.x + (f.anim.z - hipP.z) * _fwd.z;
        f.anim.x += _fwd.x * along * kw; f.anim.z += _fwd.z * along * kw;
        f.toeP.x += _fwd.x * along * kw; f.toeP.z += _fwd.z * along * kw;
      }
      // the clip's own heel and ball heights above the plane the body stands on (what it means by "down")
      const ah = this.ref[f.side][0] * sc, th = this.ref[f.side][1] * sc;
      f.heelH = f.anim.y - plane - ah; f.ballH = f.toeP.y - plane - th;
      const sole = Math.min(f.heelH, f.ballH);
      // a foot coming down across a step edge (stairs, kerbs) lands on one tread: its landing point slides forward
      // (heel past the edge) or back (toe short of it), whichever is nearer, as it comes down
      const ox = f.toeP.x - f.anim.x, oz = f.toeP.z - f.anim.z;
      if (world && grounded && !f.locked && !f.step && on('tread')) {
        const gh = this.groundAt(f.anim.x - ox * 0.25, f.anim.z - oz * 0.25, plane), gt = this.groundAt(f.anim.x + ox * 1.4, f.anim.z + oz * 1.4, plane);
        let want = 0;
        if (gh !== null && gt !== null && Math.abs(gt - gh) > 0.04 && sole < 0.2) {
          // where along heel -> tip the ground changes
          const x0 = f.anim.x - ox * 0.25, z0 = f.anim.z - oz * 0.25, x1 = f.anim.x + ox * 1.4, z1 = f.anim.z + oz * 1.4;
          let lo = 0, hi = 1;
          for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2, gm = this.groundAt(x0 + (x1 - x0) * m, z0 + (z1 - z0) * m, plane); if (gm !== null && Math.abs(gm - gh) < 0.02) lo = m; else hi = m; }
          const len = Math.hypot(x1 - x0, z1 - z0), e = (lo + hi) / 2;
          const fwdS = e * len + 0.03, backS = (1 - e) * len + 0.03;
          if (!f.shSign) f.shSign = fwdS <= backS * 1.3 ? 1 : -1;
          want = f.shSign > 0 ? fwdS : -backS;
          if (Math.abs(want) > 0.24) want = 0;
        } else if (sole > 0.2) f.shSign = 0;
        const ux = len2(ox, oz);
        const sx = want ? ox / ux * want : 0, sz = want ? oz / ux * want : 0;
        f.shX = sx; f.shZ = sz;
        f.shW = want ? clamp(1 - sole / 0.14, 0, 1) : approach(f.shW, 0, 10, dt);
      } else if (!f.locked) { f.shW = approach(f.shW, 0, 10, dt); if (f.shW < 0.01) { f.shW = 0; f.shSign = 0; } }
      const sx = f.shX * f.shW, sz = f.shZ * f.shW;
      // the ground under heel and toe (and ahead of a swinging foot), relative to the drawn plane
      let d = 0;
      if (world) {
        const gh = this.groundAt(f.anim.x + sx, f.anim.z + sz, plane), gt = this.groundAt(f.toeP.x + sx, f.toeP.z + sz, plane);
        let g = gh === null ? gt : gt === null ? gh : Math.max(gh, gt);
        if (f.c < 0.5 && this.v > 0.3 && this.vel) {
          const la = 0.16, ga = this.groundAt(f.toeP.x + this.vel.x * la, f.toeP.z + this.vel.z * la, plane);
          if (ga !== null && (g === null || ga > g)) g = ga;
        }
        if (!grounded) d = g !== null ? Math.max(0, g + 0.005 - Math.min(f.anim.y - ah, f.toeP.y - th)) : 0;     // air: never through the floor
        else if (g !== null && Math.abs(g - plane) < 0.55) d = g - plane;
      }
      if (tele || f.c > 0.6) f.delta = d;
      else f.delta = d > f.delta ? approach(f.delta, d, 28, dt) : approach(f.delta, d, 14, dt);
      f.target.set(f.anim.x + sx, f.anim.y + f.delta, f.anim.z + sz);
      // a swinging foot that moves fast clears the ground (blended starts can drag a low swing along the floor)
      if (grounded && !f.locked && f.prevOk && dt > 0) {
        const fv = Math.hypot(f.anim.x - f.prev.x, f.anim.z - f.prev.z) / dt;
        if (fv > 1.2 && sole < 0.04) f.target.y += smooth(1.2, 2.4, fv) * (0.04 - Math.max(0, sole)) + (sole < 0 ? -sole : 0) * smooth(1.2, 2.4, fv);
      }
      if (tele) f.prevOk = false;
      // foot locking: a foot is pinned where it touched down (no blend-in: it is already there) and lets go when the
      // clip lifts both heel and ball off
      if (lockOn && !tele) {
        const down = sole < 0.02 || (sole < 0.035 && f.prevOk && sole < f.prevSole - 0.004 && f.c > 0.05);
        if (!f.locked && !f.step && down && (f.c > 0.2 || (f.c > 0.05 && f.c > f.prevC))) {
          if (f.lockW > 0) f.target.lerp(_v.set(f.pin.x, f.target.y, f.pin.z), f.lockW);    // re-planted while letting go
          f.locked = true; f.lockW = 1; f.pivot = 0; f.lock.copy(f.target); f.pin.copy(f.target); f.lockYaw = yawW;
          f.lockGY = plane + f.delta; f.lockBox = null;
          if (world) { const g = this.groundAt(f.target.x, f.target.z, plane); if (g !== null && Math.abs(g - f.lockGY) < 0.03 && this.gbox) { f.lockBox = this.gbox; f.lockBoxY = this.gbox.max.y; } }
          f.shSign = 0;
        } else if (f.locked && f.heelH > 0.03 && f.ballH > 0.025 && f.c < 0.6) f.locked = false;
      } else if (!lockOn || tele) { f.locked = false; f.step = null; if (tele) f.lockW = 0; }
      if (!f.locked) f.lockW = Math.max(0, f.lockW - dt / 0.1);
      if (f.locked) f.lockG = f.lockGY + (f.lockBox ? f.lockBox.max.y - f.lockBoxY : 0) - plane;
      f.prev.copy(f.anim); f.prevOk = true; f.prevSole = sole; f.prevC = f.c;
      if (f.lockW > 0) {
        if (f.locked) {
          // heel-down: the ankle is pinned; heel-off: the ball is, and the ankle turns about it with the clip's roll
          const yc = wrap(f.lockYaw - yawW), cy = Math.cos(yc), sy = Math.sin(yc);
          const rx = ox * cy + oz * sy, rz = -ox * sy + oz * cy;
          if (!f.pivot && f.heelH > 0.012 && f.ballH < 0.03) { f.pivot = 1; f.ball.set(f.lock.x + rx, 0, f.lock.z + rz); }
          if (f.pivot) f.pin.set(f.ball.x - rx, 0, f.ball.z - rz); else f.pin.copy(f.lock);
        }
        _v.set(f.pin.x, f.anim.y + (f.locked ? f.lockG : f.delta), f.pin.z);
        f.target.lerp(_v, f.lockW);
      }
    }
    // a planted foot that the body has left behind (or turned away from) steps to where the clip wants it
    const moving = this.wLoco > 0.3, maxD = moving ? 0.3 : 0.16;
    for (const f of feet) {
      const o = f === feet[0] ? feet[1] : feet[0];
      if (f.step) {
        // the clip lifts this foot higher than the step would: the clip's own swing takes over
        const ah = this.ref[f.side][0] * sc, base = plane + f.delta;
        if (moving && f.anim.y - base - ah > f.step.lift + 0.03) {
          // the clip's own swing takes over: let go from where the step has got to (a short blend, no jump)
          _v.set(f.anim.x, f.anim.y + f.delta, f.anim.z);
          f.pin.copy(f.step.from).lerp(_v, f.step.e); f.target.copy(f.pin);
          f.lockYaw = yawW + f.step.yaw * (1 - f.step.e); f.locked = false; f.lockW = 1; f.step = null;
          continue;
        }
        f.step.t += dt;
        const s = clamp(f.step.t / f.step.dur, 0, 1), e = s * s * (3 - 2 * s); f.step.e = e;
        _v.set(f.anim.x, f.anim.y + f.delta, f.anim.z);
        f.target.lerpVectors(f.step.from, _v, e); f.target.y += Math.sin(Math.PI * s) * f.step.lift;
        if (s >= 1) {
          f.step = null; f.locked = lockOn && f.c > 0.5; f.lockW = f.locked ? 1 : 0; f.lock.copy(_v); f.pin.copy(_v); f.pivot = 0; f.lockYaw = yawW;
          f.lockGY = plane + f.delta; f.lockBox = null; f.lockG = f.delta;
        }
        continue;
      }
      if (!f.locked) continue;
      const dx = f.pin.x - f.anim.x - f.shX * f.shW, dz = f.pin.z - f.anim.z - f.shZ * f.shW, drift = Math.hypot(dx, dz);
      const twist = Math.abs(wrap(yawW - f.lockYaw));
      // a planted foot the body has left behind (or turned away from) takes a step to where the clip wants it:
      // settling after a stop, turning on the spot, a start from an odd stance
      if (drift > maxD || twist > (moving ? 1.2 : 0.7)) {
        if (o.step && drift < maxD + 0.2) continue;
        // the foot keeps its planted heading and turns to the clip's over the step (no snap)
        f.step = { from: f.target.clone(), t: 0, e: 0, yaw: wrap(f.lockYaw - yawW) * f.lockW, dur: clamp(0.16 + drift * 0.3, 0.18, 0.3), lift: clamp(0.04 + drift * 0.12, 0.04, 0.09) };
        f.locked = false; f.lockW = 0;
      }
    }
    // the pelvis: low enough for the lower foot to reach its ground, plus the landing dip
    const Lmax = (I.leg || 0.85) * sc * 0.985;
    let need = 0, reach = 0;
    for (const f of feet) {
      const dy = f.target.y - f.anim.y;
      if (dy < 0) need = Math.max(need, -dy);
    }
    for (const f of feet) {
      f.th.getWorldPosition(_v);
      const hx = f.target.x - _v.x, hz = f.target.z - _v.z, hd = Math.hypot(hx, hz);
      if (hd < Lmax) { const vy = Math.sqrt(Lmax * Lmax - hd * hd), cur = _v.y - need - f.target.y; if (cur > vy) reach = Math.max(reach, cur - vy); }
    }
    need += Math.min(reach, 0.05 * sc);
    need = Math.min(need * this.ikW, 0.3 * sc);       // deeper than this, the trailing foot pushes off from its toes
    this.drop = tele ? need : need > this.drop ? approach(this.drop, need, 30, dt) : approach(this.drop, need, 10, dt);
    const dy = -this.drop + this.dip.x;
    if (Math.abs(dy) > 1e-4) {
      hips.getWorldPosition(_v); _v.y += dy;
      hips.parent.updateWorldMatrix(true, false);
      hips.position.copy(hips.parent.worldToLocal(_v));
      hips.updateMatrixWorld(true);
    }
    // legs onto their targets (knees keep the clip's bend plane), feet keep the clip's orientation (and a locked
    // foot its heading)
    if (this.ikW > 0) for (const f of feet) {
      if (this.wLoco > 0 || this.wAir > 0.99 || f.lockW > 0 || f.step || Math.abs(f.delta) > 1e-3 || Math.abs(dy) > 1e-4) {
        twoBoneIK(f.th, f.sh, f.ft, f.target, _fwd, this.ikW);
        const yc = f.step ? f.step.yaw * (1 - f.step.e) : f.lockW > 0 ? wrap(f.lockYaw - yawW) * f.lockW : 0;
        if (yc) { _q2.setFromAxisAngle(UP, yc); f.q.premultiply(_q2); }
        setWorldQuat(f.ft, f.q);
      }
    }
  }

  upper(dt, pose) {
    const B = this.B, P = this.P, ch = this.ch, h = this.h;
    const root = h.root;
    root.getWorldQuaternion(_q);
    _right.set(1, 0, 0).applyQuaternion(_q);
    // posture: age stoop, uniform bearing, a slump when sad, a forward lean when tired
    const sad = pose === 'sad' || (ch && ch.mood === 'sad') ? 1 : 0;
    const stoop = P.stoop - P.upright + 0.12 * sad * this.wLoco + 0.03 * this.exert * this.wLoco - this.dip.x * 1.6;     // a landing folds the trunk too
    // breathing: slow at rest, deeper and quicker after running
    this.breath += dt * (1.45 + 2.6 * this.exert) * (on('idle') ? 1 : 0);
    const br = Math.sin(this.breath) * (0.012 + 0.025 * this.exert) * (1 - 0.6 * this.wLoco);
    if (B.spine && Math.abs(stoop) > 1e-4) rotateWorld(B.spine, _q2.setFromAxisAngle(_right, stoop * 0.55));
    if (B.chest && (Math.abs(stoop) > 1e-4 || br)) rotateWorld(B.chest, _q2.setFromAxisAngle(_right, stoop * 0.45 - br));
    // arm swing: scaled around the clip's mean arm pose (per side, which also evens out the mocap's lopsided swing)
    if (this.wLoco > 0.05 && on('arms')) {
      const C = this.info.clips;
      let best = null, bw = 0;
      for (const n of GAIT_CLIPS) { const a = h.actions[n]; if (a && a.weight > bw) { bw = a.weight; best = n; } }
      const c = best && C[best];
      if (c && c.ampL > 0 && c.ampR > 0) {
        const m = Math.sqrt(c.ampL * c.ampR);
        for (const side of ['L', 'R']) {
          const g = clamp(P.arm * clamp(m / (side === 'L' ? c.ampL : c.ampR), 0.75, 1.35), 0.5, 1.5);
          const gw = 1 + (g - 1) * this.wLoco;
          if (Math.abs(gw - 1) < 0.01) continue;
          for (const k of ['upperarm_', 'forearm_']) {
            const b = B[k + side], ref = c.qs[k + side];
            if (!b || !ref) continue;
            _q2.copy(ref).slerp(b.quaternion, gw);
            b.quaternion.copy(_q2);
          }
        }
        if (B.clavicle_L) B.clavicle_L.updateMatrixWorld(true);
        if (B.clavicle_R) B.clavicle_R.updateMatrixWorld(true);
      }
    }
    if (on('head')) this.look(dt, pose);
  }

  look(dt, pose) {
    const B = this.B, ch = this.ch, H = this.head, h = this.h;
    if (!B.head || !B.neck) return;
    let yaw = 0, pitch = 0;
    const lt = ch && ch.lookTarget;
    B.head.getWorldPosition(_v);
    h.root.getWorldQuaternion(_q);
    _fwd.set(0, 0, 1).applyQuaternion(_q);
    const bodyYaw = Math.atan2(_fwd.x, _fwd.z);
    if (lt) {
      const p = lt.isVector3 ? lt : lt.getWorldPosition ? lt.getWorldPosition(_v2) : lt.position;
      if (p) {
        let tx = p.x, ty = p.y ?? _v.y, tz = p.z;
        const c2 = lt.userData && lt.userData.character;
        if (c2 && c2.head) { c2.head.getWorldPosition(_v2); tx = _v2.x; ty = _v2.y; tz = _v2.z; }
        const ang = wrap(Math.atan2(tx - _v.x, tz - _v.z) - bodyYaw);
        if (Math.abs(ang) < 2.1) {
          yaw = clamp(ang, -1.2, 1.2);
          pitch = clamp(-Math.atan2(ty - _v.y, Math.hypot(tx - _v.x, tz - _v.z)), -0.45, 0.5);
        }
      }
    } else if (on('idle')) {
      // glances: now and then a look aside and back (less while walking); the head leads a turn
      if ((H.gT -= dt) <= 0) {
        const busy = this.wLoco > 0.5 || (ch && ch.talk > 0);
        if (H.gy !== 0 || H.gp !== 0) { H.gy = 0; H.gp = 0; H.gT = (busy ? 4 : 2) + this.rng() * 5 / this.P.glance; }
        else { H.gy = (this.rng() - 0.5) * (busy ? 0.5 : 1.0); H.gp = (this.rng() - 0.6) * 0.25; H.gT = 0.7 + this.rng() * 1.6; }
      }
      yaw = H.gy + clamp(this.turn * 0.16, -0.4, 0.4); pitch = H.gp + (pose === 'sad' ? 0.3 : 0);
    }
    spring(H.yaw, yaw, 7, dt); spring(H.pitch, pitch, 7, dt);
    const y = H.yaw.x, pt = H.pitch.x;
    if (Math.abs(y) < 1e-4 && Math.abs(pt) < 1e-4) return;
    _right.set(1, 0, 0).applyQuaternion(_q);
    for (const [b, ky, kp] of [[B.chest, 0.18, 0], [B.neck, 0.32, 0.4], [B.head, 0.5, 0.6]]) {
      if (!b) continue;
      _q2.setFromAxisAngle(UP, y * ky); rotateWorld(b, _q2);
      if (kp) { _v.copy(_right).applyAxisAngle(UP, y); _q2.setFromAxisAngle(_v, pt * kp); rotateWorld(b, _q2); }
    }
  }
}

const LATE = [];
function installLate(scene) {
  scene.userData.azMotionLate = true;
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (...args) {
    if (prev) prev.apply(this, args);
    for (const m of LATE) try { m.lateYaw(); } catch { /* never break a render */ }
    LATE.length = 0;
  };
}
let tierCache = 'medium', tierT = 0;
function tierName() {
  const now = globalThis.performance ? globalThis.performance.now() : 0;
  if (now - tierT > 1000) { tierT = now; try { tierCache = getQuality() || 'medium'; } catch { tierCache = 'medium'; } }
  return tierCache;
}
