// Player physics (docs/MOTION.md "Physics & controls", ART_SPEC section 6): a fixed-timestep capsule motor.
//   - fixed 120 Hz steps with an accumulator; the caller renders an interpolated position (Motor.renderOffset)
//   - capsule (feet point, radius, height) against the Collision boxes and ramps: clean wall sliding (the velocity
//     into a wall is removed, so the animation sees the real speed), ceilings that stop a jump (never a sideways
//     push), smooth step-up and step-down with ground snapping (the visual pop is smoothed in Motor.stepOff),
//     ledge support of half the radius, opt-in carrying platforms
//   - human movement: acceleration and braking curves, a turn-rate limit on the velocity, a plant-and-pivot for
//     reversals, real gravity (9.81 m/s^2) with a jump tuned to keep the traversal reach envelope
//   - forgiveness: coyote time, jump buffering, an edge brake at big drops, soft collision with people
// ?phys=classic keeps the original player code (Player.updateClassic) and camera.
import * as THREE from 'three';

let qs; try { qs = new URLSearchParams(location.search); } catch { qs = new URLSearchParams(''); }
export const PHYS_CLASSIC = qs.get('phys') === 'classic';

export const PHYS = {
  hz: 120, maxSteps: 40,             // fixed step 1/120 s; at most 40 steps (0.33 s) per frame
  g: 9.81, jumpV: 4.0, termV: 30,    // jump apex 0.815 m, air time 0.815 s on flat ground
  sprintJumpKeep: 0.91,              // a sprint take-off trades some run speed for lift (sprint jump 4.16 m)
  airMin: 2.2, airK: 3,              // air control: steer and slow, never faster than the take-off speed (or airMin)
  accel: 20, accelK: 14,             // speeding up: m/s^2 cap, and the rate that eases into the target speed
  brake: 13, brakeK: 10, brakeMin: 1.5,   // slowing down (brakeMin: the last few cm/s end in finite time)
  pivotAng: 2.4, pivotBrake: 25,     // reversals (> 137 degrees) plant and brake, then go the other way
  turnMax: 14, latAccel: 24,         // velocity turn rate: min(turnMax, latAccel / speed) rad/s
  stepUp: 0.45, stepAir: 0.42,       // step-up height on the ground / in the air (jump-climb, as before)
  stepAirFast: 0.2, catchV: -2.2,    // ...but only 0.2 m once falling faster than 2.2 m/s: a long jump that drops past a
                                     // ledge no longer 'catches' it from 0.42 m below (keeps sprint gaps under 5 m)
  snapDown: 0.45,                    // stay on the ground over drops up to this (stairs, ramps, lifts going down)
  support: 0.5,                      // ledge support: the footprint is +-radius*support (0.16 m)
  smoothMin: 0.035,                  // vertical snaps larger than this are smoothed on screen (stairs, kerbs)
  coyote: 0.12, coyoteDist: 0.36,    // jump after leaving an edge: 0.12 s, but never more than 0.36 m past it
  coyoteDistSprint: 0.2,             // ...0.2 m at a sprint (from 3.5 to 5 m/s the limit eases from 0.36 to 0.2 m)
  buffer: 0.15,                      // a jump pressed up to 0.15 s before landing still happens
  edgeDrop: 2.5, edgeIdleDrop: 0.6,  // edge brake: drops this deep stop a walker (with no input: any drop over 0.6 m)
  edgeHold: 0.4,                     // ...unless the player keeps pushing over the edge for this long (never into a void)
  personR: 0.26, personK: 30, personSoft: 0.08, personTrap: 0.8,
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** A capsule motor for one body (the player). Holds the fixed-step state between frames. */
export class Motor {
  constructor(col) {
    this.col = col; this.cands = []; this.cn = new Float64Array(8); this.cnN = 0; this._tv = new THREE.Vector3();
    this.pn = new Float64Array(8); this.pk = []; this.pnN = 0;      // people touched in the last step (normals, keys)
    this.prev = new THREE.Vector3(); this.renderOffset = new THREE.Vector3();
    this.reset();
  }
  reset(pos) {
    this.acc = 0; this.grounded = true; this.coyote = 0; this.jumpBuf = 0; this.airT = 0; this.airCap = 9;
    this.landing = 0; this.jumped = false; this.groundBox = null; this.edgeHold = 0; this.edgeFree = 0; this.edgeBlocked = false;
    this.stepOff = 0; this.stepVel = 0; this.snaps = 0; this.people = []; this.ignore = new Map();
    this.pnN = 0; this.cnN = 0; this.side = 0; this.pBlock = 0;
    if (pos) this.prev.copy(pos);
    this.renderOffset.set(0, 0, 0);
  }

  /**
   * Advance one frame. c = { pos, vel, dt, state, tv (target horizontal velocity, Vector3), hasInput, sprint,
   * radius, height, canJump, assist (edge brake on), killY, people: [{ x, y, z, r, key }] }.
   * Returns the number of fixed steps taken. Afterwards: renderOffset (interpolated minus simulated position),
   * stepOff (smoothed vertical snap, for the body), landing (impact speed this frame, else 0), jumped (this frame).
   */
  frame(c) {
    const P = PHYS, h = 1 / P.hz, pos = c.pos, v = c.vel;
    this.acc += c.dt;
    let n = Math.floor(this.acc / h + 1e-7);
    if (n > P.maxSteps) { n = P.maxSteps; this.acc = n * h; }
    this.acc = Math.max(0, this.acc - n * h);
    this.landing = 0; this.jumpedFrame = false; this.snaps = 0;
    const reach = c.radius + 1 + (Math.hypot(v.x, v.z) + 2) * n * h;
    this.col.gather(this.cands, pos.x - reach, pos.x + reach, pos.z - reach, pos.z + reach, c.state);
    for (let i = 0; i < n; i++) { this.prev.copy(pos); this.step(h, c); }
    // render interpolation between the last two fixed steps
    const a = clamp(this.acc / h, 0, 1);
    this.renderOffset.copy(this.prev).sub(pos).multiplyScalar(1 - a);
    if (this.renderOffset.lengthSq() > 0.25) this.renderOffset.set(0, 0, 0);
    // smoothed vertical snaps: a critically damped spring back to zero (about 0.15 s)
    const w = 30, dt = c.dt;
    if (dt > 0) {
      const ex = Math.exp(-w * dt), x0 = this.stepOff, v0 = this.stepVel, k = v0 + w * x0;
      this.stepOff = (x0 + k * dt) * ex; this.stepVel = (v0 - w * k * dt) * ex;
      if (Math.abs(this.stepOff) < 1e-4 && Math.abs(this.stepVel) < 1e-3) this.stepOff = this.stepVel = 0;
    }
    return n;
  }

  step(h, c) {
    const P = PHYS, pos = c.pos, v = c.vel, r = c.radius, H = c.height;
    const wasG = this.grounded;
    const hs0 = Math.hypot(v.x, v.z);
    if (wasG) {
      const cd = P.coyoteDist + (P.coyoteDistSprint - P.coyoteDist) * clamp((hs0 - 3.5) / 1.5, 0, 1);
      this.coyote = Math.min(P.coyote, cd / Math.max(hs0, 0.1)); this.airT = 0; this.airCap = Math.max(hs0, P.airMin);
    }
    else { this.coyote -= h; this.airT += h; }
    // jump (buffered press, coyote window)
    let jumped = false;
    if (this.jumpBuf > 0 && c.canJump && (wasG || this.coyote > 0)) {
      if (hs0 > 3.5) { const k = 1 - (1 - P.sprintJumpKeep) * Math.min(1, (hs0 - 3.5) / 2.1); v.x *= k; v.z *= k; }
      v.y = P.jumpV; jumped = true; this.grounded = false; this.coyote = 0; this.jumpBuf = 0;
      this.airCap = Math.max(Math.hypot(v.x, v.z), P.airMin); this.jumpedFrame = true;
    }
    this.jumpBuf = Math.max(0, this.jumpBuf - h);
    // horizontal velocity; the target is projected along the walls / people touched in the last step, so pushing
    // into a wall at an angle slides along it at the matching share of the speed (none in a corner)
    const tv = this._tv.copy(c.tv), ts = Math.hypot(tv.x, tv.z);
    // people first: slide around them, and step aside (at half the speed, on a side kept while in contact) when one
    // stands straight in the way, as a walker would
    let pc = false;
    for (let i = 0; i < this.pnN; i++) {
      const nx = this.pn[2 * i], nz = this.pn[2 * i + 1], d = tv.x * nx + tv.z * nz;
      if (d >= 0) continue;
      pc = true; tv.x -= nx * d; tv.z -= nz * d;
      const tx = -nz, tz = nx, ta = tv.x * tx + tv.z * tz, want = 0.5 * ts;
      if (Math.abs(ta) < want) {
        if (!this.side) this.side = Math.abs(ta) > 0.05 * ts ? Math.sign(ta) : 1;
        const k = this.side * want - ta; tv.x += tx * k; tv.z += tz * k;
      }
    }
    if (!pc) this.side = 0;
    for (let i = 0; i < this.cnN; i++) {
      const nx = this.cn[2 * i], nz = this.cn[2 * i + 1], d = tv.x * nx + tv.z * nz;
      if (d < 0) { tv.x -= nx * d; tv.z -= nz * d; }
    }
    this.cnN = 0; this.pnN = 0;
    if (this.grounded) this.groundAccel(v, tv, h); else this.airAccel(v, tv, h);
    // gravity (exact for a constant g within the step)
    let dy = 0; const vy0 = v.y;
    if (this.grounded && !jumped) v.y = 0;
    else { dy = v.y * h - 0.5 * P.g * h * h; v.y = Math.max(-P.termV, v.y - P.g * h); }
    const y0 = pos.y, ox = pos.x, oz = pos.z;
    const stepH = this.grounded ? P.stepUp : v.y > P.catchV ? P.stepAir : P.stepAirFast;
    // horizontal move: people (soft), then walls (hard)
    pos.x += v.x * h; pos.z += v.z * h;
    if (c.people.length) this.pushPeople(pos, v, r, h, c.people);
    this.pushWalls(pos, v, r, H, stepH, this.grounded && !c.crouching);
    // never trapped by people: pushing on while hardly moving for P.personTrap s lets Kai squeeze past them
    if (this.pnN && ts > 0.1) {
      this.pBlock = Math.hypot(pos.x - ox, pos.z - oz) / h < 0.3 * ts ? this.pBlock + h : Math.max(0, this.pBlock - 2 * h);
      if (this.pBlock > P.personTrap) {
        for (let i = 0; i < this.pnN; i++) { const k = this.pk[i], st = this.ignore.get(k) || { t: 0, off: false }; st.off = true; this.ignore.set(k, st); }
        this.pBlock = 0;
      }
    } else this.pBlock = Math.max(0, this.pBlock - h);
    // edge brake (never while jumping or sprinting; a held push goes over after P.edgeHold)
    this.edgeBlocked = false;
    if (wasG && !jumped && c.assist) this.edgeAssist(pos, v, ox, oz, r, H, h, c);
    if (!this.edgeBlocked) { this.edgeFree += h; if (this.edgeFree > 0.25 || !c.hasInput) this.edgeHold = 0; }
    // vertical move and ceilings
    pos.y += dy;
    if (v.y > 0 || dy > 0) this.ceiling(pos, v, r, H, y0, stepH);
    // ground: land, step up, snap down, or leave
    const lim = Math.max(pos.y, y0) + stepH;
    const gt = this.groundTop(pos.x, pos.z, r, lim);
    if (gt !== null && v.y <= 0 && pos.y <= gt + 0.02) {
      const d = gt - pos.y;
      if (!wasG) this.landing = Math.max(this.landing, -Math.min(vy0, v.y));
      if (d > P.smoothMin && !jumped) { this.stepOff -= d; this.snaps -= d; this.prev.y += d; }   // smoothed by stepOff, not interpolated
      pos.y = gt; v.y = 0; this.grounded = true; this.groundBox = this._gbox;
    } else if (wasG && !jumped && gt !== null && pos.y - gt <= P.snapDown) {
      const d = pos.y - gt;
      if (d > P.smoothMin) { this.stepOff += d; this.snaps += d; this.prev.y -= d; }
      pos.y = gt; v.y = 0; this.grounded = true; this.groundBox = this._gbox;
    } else { this.grounded = false; this.groundBox = null; }
    this.stepOff = clamp(this.stepOff, -0.5, 0.5);
    this.jumped = jumped || (this.jumped && !this.grounded);
  }

  groundAccel(v, tv, h) {
    const P = PHYS, hs = Math.hypot(v.x, v.z), ts = Math.hypot(tv.x, tv.z);
    if (ts < 1e-3) {                                   // no input: brake to a stop
      if (hs < 1e-4) { v.x = v.z = 0; return; }
      const k = Math.max(0, hs - Math.max(P.brakeMin, Math.min(P.brake, P.brakeK * hs)) * h) / hs; v.x *= k; v.z *= k; return;
    }
    if (hs < 0.4) {                                    // from (nearly) standing: accelerate straight at the target
      const dx = tv.x - v.x, dz = tv.z - v.z, dm = Math.hypot(dx, dz), a = Math.min(P.accel, P.accelK * dm) * h;
      if (dm <= a) { v.x = tv.x; v.z = tv.z; } else { v.x += dx / dm * a; v.z += dz / dm * a; }
      return;
    }
    let ux = v.x / hs, uz = v.z / hs; const tx = tv.x / ts, tz = tv.z / ts;
    const ang = Math.atan2(ux * tz - uz * tx, ux * tx + uz * tz);
    let s;
    if (Math.abs(ang) > P.pivotAng) s = Math.max(0, hs - P.pivotBrake * h);      // plant and pivot
    else {
      const wm = Math.min(P.turnMax, P.latAccel / hs) * h, a = clamp(ang, -wm, wm), ca = Math.cos(a), sa = Math.sin(a);
      const nx = ux * ca - uz * sa, nz = ux * sa + uz * ca; ux = nx; uz = nz;
      s = ts > hs ? Math.min(ts, hs + Math.min(P.accel, P.accelK * (ts - hs)) * h) : Math.max(ts, hs - Math.min(P.brake, P.brakeK * (hs - ts)) * h);
    }
    v.x = ux * s; v.z = uz * s;
  }

  airAccel(v, tv, h) {
    const k = Math.min(1, h * PHYS.airK);
    v.x += (tv.x - v.x) * k; v.z += (tv.z - v.z) * k;
    const hs = Math.hypot(v.x, v.z);
    if (hs > this.airCap) { const s = this.airCap / hs; v.x *= s; v.z *= s; }
  }

  // Highest walkable top under the footprint (+-r*support), at most `lim`. Sets this._gbox. null: nothing.
  groundTop(x, z, r, lim) {
    const s = r * PHYS.support, col = this.col; let top = null, box = null;
    for (const b of this.cands) {
      if (x + s < b.min.x || x - s > b.max.x || z + s < b.min.z || z - s > b.max.z) continue;
      const t = b.ramp ? col.topAt(b, clamp(x, b.min.x, b.max.x), clamp(z, b.min.z, b.max.z)) : b.max.y;
      if (t <= lim && (top === null || t > top)) { top = t; box = b; }
    }
    this._gbox = box; return top;
  }

  // Push the capsule out of solid boxes; the velocity into each contact is removed (wall sliding).
  // standing: a box whose underside is in the top band of a standing capsule (but clears a crouch) is left to the
  // ceiling / auto-crouch logic instead of being a wall.
  pushWalls(pos, v, r, H, stepH, standing) {
    const col = this.col, y = pos.y, rs = r + 0.01;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const b of this.cands) {
        if (b.walkOnly || b.min.y >= y + H - 0.02) continue;
        if (standing && b.min.y >= y + 1.12 && b.min.y > y + H - 0.25) continue;
        const cx = clamp(pos.x, b.min.x, b.max.x), cz = clamp(pos.z, b.min.z, b.max.z);
        const top = b.ramp ? col.topAt(b, cx, cz) : b.max.y;
        if (top <= y + stepH) continue;
        let dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
        if (d2 >= rs * rs) continue;
        if (d2 >= r * r) { const d = Math.sqrt(d2); if (it === 0) this.contact(dx / d, dz / d); continue; }   // touching: a contact, no push
        let nx, nz;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), push = r - d; nx = dx / d; nz = dz / d;
          pos.x += nx * push; pos.z += nz * push;
        } else {                                       // centre inside the box: out along the shortest axis
          const px = [pos.x - b.min.x, b.max.x - pos.x, pos.z - b.min.z, b.max.z - pos.z];
          const m = Math.min(...px), i = px.indexOf(m);
          if (i === 0) { pos.x = b.min.x - r; nx = -1; nz = 0; } else if (i === 1) { pos.x = b.max.x + r; nx = 1; nz = 0; }
          else if (i === 2) { pos.z = b.min.z - r; nx = 0; nz = -1; } else { pos.z = b.max.z + r; nx = 0; nz = 1; }
        }
        const vn = v.x * nx + v.z * nz;
        if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; }
        this.contact(nx, nz);
        moved = true;
      }
      if (!moved) break;
    }
  }

  contact(nx, nz) { if (this.cnN < 4) { this.cn[2 * this.cnN] = nx; this.cn[2 * this.cnN + 1] = nz; this.cnN++; } }

  // A rising head stops under the first box above the step band that it would enter.
  ceiling(pos, v, r, H, y0, stepH) {
    const rr = r * r * 0.8;
    for (const b of this.cands) {
      if (b.walkOnly || b.min.y < y0 + stepH || b.min.y < y0 + H - 0.05 || b.min.y >= pos.y + H) continue;
      const cx = clamp(pos.x, b.min.x, b.max.x), cz = clamp(pos.z, b.min.z, b.max.z);
      if ((pos.x - cx) ** 2 + (pos.z - cz) ** 2 >= rr) continue;
      pos.y = b.min.y - H; if (v.y > 0) v.y = 0;
    }
  }

  /** Lowest box underside above the feet that a capsule of height H standing at pos would hit (null: headroom). */
  headroom(pos, r, fromH, H) {
    const rr = r * r * 0.8; let low = null;
    for (const b of this.cands) {
      if (b.walkOnly || b.min.y < pos.y + fromH - 0.02 || b.min.y >= pos.y + H) continue;
      const cx = clamp(pos.x, b.min.x, b.max.x), cz = clamp(pos.z, b.min.z, b.max.z);
      if ((pos.x - cx) ** 2 + (pos.z - cz) ** 2 >= rr) continue;
      if (low === null || b.min.y < low) low = b.min.y;
    }
    return low;
  }

  supported(pos, r) { const t = this.groundTop(pos.x, pos.z, r, pos.y + PHYS.stepUp); return t !== null && pos.y - t <= PHYS.snapDown; }

  edgeAssist(pos, v, ox, oz, r, H, h, c) {
    const P = PHYS;
    if (this.supported(pos, r)) return;
    // how deep is the drop under the centre?
    let below = null;
    for (const b of this.cands) {
      if (pos.x < b.min.x || pos.x > b.max.x || pos.z < b.min.z || pos.z > b.max.z) continue;
      const t = b.ramp ? this.col.topAt(b, pos.x, pos.z) : b.max.y;
      if (t <= pos.y + 0.05 && (below === null || t > below)) below = t;
    }
    const drop = below === null || below < c.killY + 0.5 ? Infinity : pos.y - below;
    // a walker is held at a deep drop until he keeps pushing for P.edgeHold s; at a void (nothing below, or only the
    // kill plane) he is held for as long as he walks: only a sprint or a jump goes over
    const block = c.hasInput ? (!c.sprint && drop >= P.edgeDrop && (this.edgeHold < P.edgeHold || drop === Infinity)) : drop > P.edgeIdleDrop;
    if (!block) return;
    if (c.hasInput) this.edgeHold += h;
    this.edgeBlocked = true; this.edgeFree = 0;
    const nz = pos.z;
    pos.z = oz; if (this.supported(pos, r)) { v.z = 0; return; }
    pos.x = ox; pos.z = nz; if (this.supported(pos, r)) { v.x = 0; return; }
    pos.x = ox; pos.z = oz; v.x = 0; v.z = 0;
  }

  // People are soft cylinders: the velocity into them is (mostly) removed and the overlap eases out, so the player
  // slides around a person and never passes through; anyone overlapping for P.personTrap s, or blocking a player who
  // keeps pushing (see step), is ignored until clear.
  pushPeople(pos, v, r, h, people) {
    const P = PHYS;
    for (const p of people) {
      const dx = pos.x - p.x, dz = pos.z - p.z, minD = r + p.r, d2 = dx * dx + dz * dz;
      const st = this.ignore.get(p.key);
      if (Math.abs(pos.y - p.y) > 1.5 || d2 >= (minD + 0.01) ** 2) { if (st && d2 > (minD + 0.2) ** 2) this.ignore.delete(p.key); else if (st && !st.off) st.t = 0; continue; }
      if (st?.off) continue;
      const d = Math.sqrt(d2), nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0, ov = minD - d;
      if (this.pnN < 4) { this.pn[2 * this.pnN] = nx; this.pn[2 * this.pnN + 1] = nz; this.pk[this.pnN++] = p.key; }
      if (ov <= 0) { if (st) st.t = 0; continue; }                       // touching
      const vn = v.x * nx + v.z * nz;
      if (vn < 0) { v.x -= nx * vn * 0.9; v.z -= nz * vn * 0.9; }
      const push = ov * Math.min(1, h * P.personK) + Math.max(0, ov - P.personSoft);
      pos.x += nx * push; pos.z += nz * push;
      const s = st || { t: 0, off: false }; if (!st) this.ignore.set(p.key, s);
      s.t = ov > 0.05 ? s.t + h : 0;
      if (s.t > P.personTrap) s.off = true;
    }
  }
}
