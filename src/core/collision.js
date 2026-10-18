import * as THREE from 'three';

// Axis-aligned box collision world. Boxes may be restricted to temporal states.
export class Collision {
  constructor() { this.boxes = []; }
  clear() { this.boxes = []; }
  add(min, max, opts = {}) {
    const b = { min: new THREE.Vector3(...min), max: new THREE.Vector3(...max), states: opts.states || null, enabled: true, tag: opts.tag, walkOnly: !!opts.walkOnly };
    this.boxes.push(b); return b;
  }
  // Box centred at (x,y-bottom,z) with size
  addBox(x, y, z, sx, sy, sz, opts) { return this.add([x - sx / 2, y, z - sz / 2], [x + sx / 2, y + sy, z + sz / 2], opts); }
  fromObject(obj, opts) {
    const bb = new THREE.Box3().setFromObject(obj);
    return this.add(bb.min.toArray(), bb.max.toArray(), opts);
  }
  isActive(b, state) { return b.enabled && (!b.states || b.states.includes(state)); }

  // Resolve a vertical cylinder (pos = feet). Returns { grounded, groundY }.
  resolve(pos, vel, radius, height, state, dt, prevY = pos.y) {
    let grounded = false, groundY = -Infinity;
    const step = 0.42;
    // ground probe
    for (const b of this.boxes) {
      if (!this.isActive(b, state)) continue;
      if (pos.x + radius * 0.5 < b.min.x || pos.x - radius * 0.5 > b.max.x || pos.z + radius * 0.5 < b.min.z || pos.z - radius * 0.5 > b.max.z) continue;
      if (b.max.y <= Math.max(pos.y, prevY) + step && b.max.y > groundY) groundY = b.max.y;
    }
    if (vel.y <= 0 && pos.y <= groundY + 0.05) { pos.y = groundY; vel.y = 0; grounded = true; }
    // horizontal push-out
    for (let it = 0; it < 2; it++) {
      for (const b of this.boxes) {
        if (!this.isActive(b, state) || b.walkOnly) continue;
        if (b.max.y <= pos.y + step || b.min.y >= pos.y + height) continue;
        const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
        const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
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
