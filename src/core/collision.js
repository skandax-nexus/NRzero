import * as THREE from 'three';

// Axis-aligned box collision world. Boxes may be restricted to temporal states.
// Box shape (missions read and write these fields directly): { min, max (Vector3), states, enabled, tag, walkOnly }.
// Opt-in extras (docs/MISSION_GUIDE.md "Physics API"):
//   carry: true          a moving platform: the player standing on it is carried by its per-frame movement
//   ramp: {axis, c0, c1, y0, y1}  (made by addRamp) a sloped top surface: height y0 at axis coordinate c0, y1 at c1
// The player's own movement lives in physics.js (Motor); resolve() below is the original solver, kept for the
// NPC bodies that missions move with it (the m2 Warden, m10 Sera, combat enemies) and for ?phys=classic.
export class Collision {
  constructor() { this.boxes = []; }
  clear() { this.boxes = []; }
  add(min, max, opts = {}) {
    const b = { min: new THREE.Vector3(...min), max: new THREE.Vector3(...max), states: opts.states || null, enabled: true, tag: opts.tag, walkOnly: !!opts.walkOnly };
    if (opts.carry) b.carry = true;
    this.boxes.push(b); return b;
  }
  // Box centred at (x,y-bottom,z) with size
  addBox(x, y, z, sx, sy, sz, opts) { return this.add([x - sx / 2, y, z - sz / 2], [x + sx / 2, y + sy, z + sz / 2], opts); }
  fromObject(obj, opts) {
    const bb = new THREE.Box3().setFromObject(obj);
    return this.add(bb.min.toArray(), bb.max.toArray(), opts);
  }
  /**
   * A ramp (sloped walkable surface) filling the box min..max: solid from min.y up to a top that rises linearly
   * along `dir` ('+x', '-x', '+z' or '-z'): from opts.low (default min.y) at the low side to max.y at the high side.
   * It is an ordinary box in `boxes` (missions that scan boxes see its bounds); the player and groundHeight() walk
   * on the slope. Example: a 3 m long ramp rising 1 m towards -z: collision.addRamp([0, 0, -3], [2, 1, 0], '-z').
   */
  addRamp(min, max, dir = '+z', opts = {}) {
    const b = this.add(min, max, opts), axis = dir[1] === 'x' ? 'x' : 'z', up = dir[0] !== '-';
    const lo = b.min[axis], hi = b.max[axis];
    b.ramp = { axis, c0: up ? lo : hi, c1: up ? hi : lo, y0: opts.low ?? b.min.y, y1: b.max.y };
    return b;
  }
  isActive(b, state) { return b.enabled && (!b.states || b.states.includes(state)); }
  /** Height of box b's walkable top at (x, z) (clamped into the box): max.y, or the slope height for a ramp. */
  topAt(b, x, z) {
    const r = b.ramp; if (!r) return b.max.y;
    const c = r.axis === 'x' ? x : z, t = Math.max(0, Math.min(1, (c - r.c0) / (r.c1 - r.c0 || 1)));
    return r.y0 + (r.y1 - r.y0) * t;
  }
  /**
   * Ground under a point: the highest walkable top (boxes and ramps, walkOnly included) containing (x, z) that is
   * at most 0.5 m above yHint (pass null for no limit), in temporal state `state` (default: every active box
   * regardless of state). Returns the height, or null when there is nothing underneath. For foot IK and NPC grounding.
   */
  groundHeight(x, z, yHint = null, state) {
    let top = null; const lim = yHint == null ? Infinity : yHint + 0.5;
    for (const b of this.boxes) {
      if (!b.enabled || (state !== undefined && b.states && !b.states.includes(state))) continue;
      if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue;
      const t = b.ramp ? this.topAt(b, x, z) : b.max.y;
      if (t <= lim && (top === null || t > top)) top = t;
    }
    return top;
  }
  /** Active boxes whose bounds touch the XZ rectangle (out: an array to fill, reused by the caller). */
  gather(out, minx, maxx, minz, maxz, state) {
    out.length = 0;
    for (const b of this.boxes) {
      if (!this.isActive(b, state)) continue;
      if (b.max.x < minx || b.min.x > maxx || b.max.z < minz || b.min.z > maxz) continue;
      out.push(b);
    }
    return out;
  }
  /**
   * First hit distance of a ray (origin o, unit direction d, length far) against active solid boxes grown by
   * `radius` (a cheap sphere cast, for the camera arm). walkOnly boxes count only as floors (when o is above them);
   * boxes that already contain o are skipped. Returns the distance or Infinity.
   */
  rayCast(o, d, far, radius, state) {
    let best = far;
    const ox = o.x, oy = o.y, oz = o.z;
    const ix = Math.abs(d.x) < 1e-9 ? 0 : 1 / d.x, iy = Math.abs(d.y) < 1e-9 ? 0 : 1 / d.y, iz = Math.abs(d.z) < 1e-9 ? 0 : 1 / d.z;
    let hit = Infinity;
    for (const b of this.boxes) {
      if (!b.enabled || (b.states && !b.states.includes(state))) continue;
      if (b.walkOnly && oy <= b.max.y) continue;
      const mn = b.min, mx = b.max;
      if (ox > mn.x && ox < mx.x && oy > mn.y && oy < mx.y && oz > mn.z && oz < mx.z) continue;
      // slab test against the box grown by radius (no allocation: this runs for every box, twice a frame)
      let t0 = 0, t1 = best, ta, tb, s;
      if (ix === 0) { if (ox < mn.x - radius || ox > mx.x + radius) continue; }
      else { ta = (mn.x - radius - ox) * ix; tb = (mx.x + radius - ox) * ix; if (ta > tb) { s = ta; ta = tb; tb = s; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) continue; }
      if (iy === 0) { if (oy < mn.y - radius || oy > mx.y + radius) continue; }
      else { ta = (mn.y - radius - oy) * iy; tb = (mx.y + radius - oy) * iy; if (ta > tb) { s = ta; ta = tb; tb = s; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) continue; }
      if (iz === 0) { if (oz < mn.z - radius || oz > mx.z + radius) continue; }
      else { ta = (mn.z - radius - oz) * iz; tb = (mx.z + radius - oz) * iz; if (ta > tb) { s = ta; ta = tb; tb = s; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) continue; }
      if (t0 < hit) { hit = t0; best = t0; }
    }
    return hit;
  }

  // Resolve a vertical cylinder (pos = feet). Returns { grounded, groundY }. (The original solver: see the header.)
  resolve(pos, vel, radius, height, state, dt, prevY = pos.y) {
    let grounded = false, groundY = -Infinity;
    const step = 0.42;
    // ground probe
    for (const b of this.boxes) {
      if (!this.isActive(b, state)) continue;
      if (pos.x + radius * 0.5 < b.min.x || pos.x - radius * 0.5 > b.max.x || pos.z + radius * 0.5 < b.min.z || pos.z - radius * 0.5 > b.max.z) continue;
      const top = b.ramp ? this.topAt(b, pos.x, pos.z) : b.max.y;
      if (top <= Math.max(pos.y, prevY) + step && top > groundY) groundY = top;
    }
    if (vel.y <= 0 && pos.y <= groundY + 0.05) { pos.y = groundY; vel.y = 0; grounded = true; }
    // horizontal push-out
    for (let it = 0; it < 2; it++) {
      for (const b of this.boxes) {
        if (!this.isActive(b, state) || b.walkOnly) continue;
        const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
        const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
        const top = b.ramp ? this.topAt(b, cx, cz) : b.max.y;
        if (top <= pos.y + step || b.min.y >= pos.y + height) continue;
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = radius - d;
          pos.x += dx / d * push; pos.z += dz / d * push;
        } else {
          // inside: push along smallest axis
          const pxs = [pos.x - b.min.x, b.max.x - pos.x, pos.z - b.min.z, b.max.z - pos.z];
          const m = Math.min(...pxs), i = pxs.indexOf(m);
          if (i === 0) pos.x = b.min.x - radius; else if (i === 1) pos.x = b.max.x + radius;
          else if (i === 2) pos.z = b.min.z - radius; else pos.z = b.max.z + radius;
        }
      }
    }
    // ceiling
    for (const b of this.boxes) {
      if (!this.isActive(b, state)) continue;
      if (pos.x < b.min.x || pos.x > b.max.x || pos.z < b.min.z || pos.z > b.max.z) continue;
      if (vel.y > 0 && b.min.y > pos.y && b.min.y < pos.y + height) { vel.y = 0; }
    }
    return { grounded, groundY };
  }

  // Segment (2D, XZ) vs boxes, for line-of-sight checks at a given height.
  blocked(a, b, y, state) {
    for (const bx of this.boxes) {
      if (!this.isActive(bx, state) || bx.walkOnly) continue;
      if (y < bx.min.y || y > bx.max.y) continue;
      if (segAabb2(a.x, a.z, b.x, b.z, bx.min.x, bx.min.z, bx.max.x, bx.max.z)) return true;
    }
    return false;
  }
}

function segAabb2(x0, z0, x1, z1, minx, minz, maxx, maxz) {
  let t0 = 0, t1 = 1; const dx = x1 - x0, dz = z1 - z0;
  const p = [-dx, dx, -dz, dz], q = [x0 - minx, maxx - x0, z0 - minz, maxz - z0];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) { if (q[i] < 0) return false; }
    else { const t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
  }
  return t0 > 0.02 && t0 < 0.98;
}
