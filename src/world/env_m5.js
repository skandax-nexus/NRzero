// Mission 5 environment helpers: the village valley in three states (thriving c. 1000 BCE, abandoned c. 400 CE,
// flooded 2049). Everything is generated here at scene-build time: terrain on a rectilinear grid (so the retaining
// wall and the Keepers' Door get exact edges), merged house geometry per material (few draw calls), props, the
// buried machine, the 2049 dam and outlet tower, and canvas textures for murals, signs and tags.
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, rng } from './kit.js';

export const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------------------------
// Valley layout (meters). North is -Z (upstream), the village plaza sits around (-2, 0, 3).
//   west terrace  y 3.2 for x < -14.35 (retaining wall face at x = -13.45, z -24 .. 15)
//   valley floor  y 0, the shelf to the north y 3.2 (escarpment z -44 .. -48.5, east-bank ramp)
//   channel A     the village channel (the river's course in the earliest state)
//   channel B     the old eastern channel (dry until the river is diverted)
// ---------------------------------------------------------------------------------------------
export const WALL = { x0: -14.35, x1: -13.45, z0: -24, z1: 15, top: 3.2 };
export const DOOR = { z0: -7.0, z1: -5.0, x: -13.45, h: 2.3 };
export const TERRACE_Y = 3.2;

export function makeValley(seed = 5) {
  const nz = RZ.makeNoise(seed);
  const R = z => 21 + 2.5 * Math.sin(z * 0.07);
  const fork = z => sm(-60, -48, z);
  const A = z => lerp(R(z), 13 + 1.1 * Math.sin(z * 0.05), fork(z));
  const B = z => lerp(R(z), 29 + Math.sin(z * 0.045 + 1), fork(z));
  const wallZone = z => sm(WALL.z0 - 5, WALL.z0, z) * (1 - sm(WALL.z1, WALL.z1 + 5, z));
  const shelf = (x, z) => {
    const s = sm(-44.5, -47.5, z), ramp = sm(-37, -52, z), mask = sm(15.5, 17.5, x) * (1 - sm(24.2, 25.8, x));
    return lerp(s, ramp, mask);
  };
  const terrace = (x, z) => {
    const sharp = x <= WALL.x0 ? 1 : x >= WALL.x1 ? 0 : sm(WALL.x1, WALL.x0, x), soft = sm(-9, -19, x);
    return lerp(soft, sharp, wallZone(z));
  };
  const bump = (w, H, sg) => w <= 0 ? 0 : H * (1 - Math.exp(-(w * w) / (2 * sg * sg)));
  const hills = (x, z) => {
    const w = Math.max(0, -33 - x), e = Math.max(0, x - 35.5), n = Math.max(0, -68 - z), s = Math.max(0, z - 52);
    const gorge = z < -58 ? sm(4, 15, Math.abs(x - R(z))) : 1;
    let h = bump(w, 70, 30) + bump(e, 60, 28) + bump(n, 55, 32) * gorge + bump(s, 50, 22) * sm(6, 16, Math.abs(x - 21));
    // the spring cliff above the north end of the west terrace
    h += 10 * sm(-33.2, -35.4, x) * sm(-43, -38, z) * (1 - sm(-28, -23, z));
    const m = Math.min(1, (w + e + n * gorge + s) / 14);
    if (m > 0) h += (nz.fbm2(x * 0.018, z * 0.018, 5) * 10 + nz.ridged2(x * 0.01, z * 0.01, 4) * 16) * m;
    return h;
  };
  // spring pool, the irrigation leat along the foot of the hill, and the field feeders (quest B)
  const FEED = [-22, 0, 15];
  const irrigation = (x, z) => {
    if (x > -17 || z < -38 || z > 26) return 0;
    let c = 0.9 * (1 - sm(1.4, 3.0, Math.hypot(x + 31.5, z + 33)));
    if (z > -32 && z < 24) c = Math.max(c, 0.46 * (1 - sm(0.35, 0.85, Math.abs(x + 32))));
    for (const fz of FEED) if (x > -32 && x < (fz === 0 ? -22.5 : -20)) c = Math.max(c, 0.4 * (1 - sm(0.3, 0.7, Math.abs(z - fz))));
    return c;
  };
  const carve = (x, z) => {
    const deep = lerp(1.75, 1.6, sm(-44, -48, z));
    const cA = deep * (1 - sm(1.8, 4.6, Math.abs(x - A(z))));
    const cB = deep * 0.95 * (1 - sm(1.8, 4.6, Math.abs(x - B(z))));
    return Math.max(cA, cB);
  };
  const fine = (x, z) => nz.fbm2(x * 0.09, z * 0.09, 3) * 0.1;
  const hBase = (x, z) => TERRACE_Y * Math.max(shelf(x, z), terrace(x, z)) + hills(x, z) + fine(x, z) - carve(x, z) - irrigation(x, z);
  // abandoned state before the diversion: the river in channel A has eaten the east half of the lower village
  const erodeMask = (x, z) => sm(1.5, 4.5, x) * sm(-30, -22, z) * (1 - sm(30, 36, z)) * (x < A(z) ? 1 : 0);
  const hEroded = (x, z) => { const h = hBase(x, z), e = erodeMask(x, z); return e > 0 ? lerp(h, Math.min(h, -1.35 + fine(x, z) * 2), e) : h; };
  return { nz, A, B, R, fork, hBase, hEroded, erodeMask, carve, wallZone, FEED };
}

// Non-uniform axis samples: `fine` spacing inside [f0, f1], growing outside to the bounds, plus exact extra lines.
export function axis(min, max, f0, f1, fine, extra = []) {
  const s = new Set();
  for (let v = f0; v <= f1 + 1e-6; v += fine) s.add(+v.toFixed(3));
  let step = fine; for (let v = f0 - fine; v > min; v -= step) { s.add(+v.toFixed(3)); step *= 1.22; } s.add(min);
  step = fine; for (let v = f1 + fine; v < max; v += step) { s.add(+v.toFixed(3)); step *= 1.22; } s.add(max);
  for (const e of extra) s.add(+e.toFixed(3));
  return [...s].sort((a, b) => a - b);
}

/** Rectilinear terrain grid -> BufferGeometry (position + normal). holes: [[x0, z0, x1, z1]] cells removed exactly. */
export function gridTerrain(heightFn, xs, zs, holes = []) {
  const nx = xs.length, nzc = zs.length, P = new Float32Array(nx * nzc * 3), N = new Float32Array(nx * nzc * 3), I = [];
  const e = 0.25, v = new THREE.Vector3();
  for (let j = 0; j < nzc; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], z = zs[j], k = (j * nx + i) * 3;
    P[k] = x; P[k + 1] = heightFn(x, z); P[k + 2] = z;
    v.set(heightFn(x - e, z) - heightFn(x + e, z), 2 * e, heightFn(x, z - e) - heightFn(x, z + e)).normalize();
    N[k] = v.x; N[k + 1] = v.y; N[k + 2] = v.z;
  }
  for (let j = 0; j < nzc - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    if (holes.some(h => cx > h[0] && cx < h[2] && cz > h[1] && cz < h[3])) continue;
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    I.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setIndex(nx * nzc > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

// ---------------------------------------------------------------------------------------------
// Geometry merging: one draw call per material per state
// ---------------------------------------------------------------------------------------------
export function mergeGeometries(list) {
  let nV = 0, nI = 0;
  for (const g of list) { if (!g.attributes.normal) g.computeVertexNormals(); nV += g.attributes.position.count; nI += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(nV * 3), N = new Float32Array(nV * 3), U = new Float32Array(nV * 2);
  const I = nV > 65535 ? new Uint32Array(nI) : new Uint16Array(nI);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, c = p.count;
    for (let i = 0; i < c; i++) {
      const k = (vo + i) * 3; P[k] = p.getX(i); P[k + 1] = p.getY(i); P[k + 2] = p.getZ(i);
      N[k] = n.getX(i); N[k + 1] = n.getY(i); N[k + 2] = n.getZ(i);
      if (uv) { U[(vo + i) * 2] = uv.getX(i); U[(vo + i) * 2 + 1] = uv.getY(i); }
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) I[io + i] = g.index.getX(i) + vo;
    else for (let i = 0; i < c; i++) I[io + i] = i + vo;
    io += g.index ? g.index.count : c; vo += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  out.setIndex(new THREE.BufferAttribute(I, 1)); out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}
export class MergeBin {
  constructor() { this.lists = new Map(); }
  add(key, geo, m) { if (m) geo.applyMatrix4(m); if (!this.lists.has(key)) this.lists.set(key, []); this.lists.get(key).push(geo); return geo; }
  /** mats: { key: material } -> Group with one mesh per key */
  build(mats, opts = {}) {
    const g = new THREE.Group();
    for (const [k, list] of this.lists) {
      if (!list.length || !mats[k]) continue;
      const mesh = new THREE.Mesh(mergeGeometries(list), mats[k]);
      mesh.castShadow = opts.cast ?? true; mesh.receiveShadow = true; mesh.name = 'm5:' + k; g.add(mesh);
    }
    return g;
  }
}
const Q4 = new THREE.Quaternion(), V4 = new THREE.Vector3(), S4 = new THREE.Vector3(), E4 = new THREE.Euler();
export function mat4(x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) { return new THREE.Matrix4().compose(V4.set(x, y, z), Q4.setFromEuler(E4.set(rx, ry, rz)), S4.set(sx, sy, sz)); }
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// ---------------------------------------------------------------------------------------------
// Houses (flat-roofed mud-plaster on stone footings, timber beam ends; ruins for the later states)
// ---------------------------------------------------------------------------------------------
export const HOUSES = [
  { x: -9.0, z: -17.0, w: 5.4, d: 4.6, ry: 0.06, h: 2.7, door: 'e', up: 1 },
  { x: -1.5, z: -17.5, w: 5.0, d: 4.4, ry: -0.05, h: 2.6, door: 's' },
  { x: 4.6, z: -13.5, w: 4.6, d: 5.2, ry: 0.08, h: 2.8, door: 'w', east: true },
  { x: -9.4, z: -0.8, w: 4.2, d: 4.6, ry: 0.0, h: 2.6, door: 'e' },
  { x: 4.8, z: -3.0, w: 4.4, d: 5.6, ry: -0.05, h: 2.7, door: 'w', east: true, up: 1 },
  { x: -9.2, z: 9.5, w: 5.0, d: 5.6, ry: 0.03, h: 2.8, door: 'e' },
  { x: -3.0, z: 15.8, w: 5.6, d: 4.6, ry: -0.04, h: 2.7, door: 'n', up: 1 },
  { x: 4.2, z: 13.2, w: 4.8, d: 4.8, ry: 0.1, h: 2.6, door: 'w', east: true },
  { x: -5.5, z: 25.0, w: 5.2, d: 4.8, ry: 0.05, h: 2.7, door: 'n' },
  { x: 2.0, z: 24.5, w: 5.6, d: 5.0, ry: -0.06, h: 2.8, door: 'n' },
  { x: -27.0, z: -3.5, w: 5.0, d: 4.4, ry: 0.0, h: 2.6, door: 'e', terrace: true },
  { x: -27.5, z: 4.2, w: 4.6, d: 4.6, ry: 0.05, h: 2.5, door: 'e', terrace: true, up: 1 },
];
const DOOR_ROT = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 };

/** Thriving house into a MergeBin (keys: foot, plaster, roof, timber, dark, textile). y = ground at the house. */
export function houseThriving(bin, h, y, seed) {
  const r = rng(seed), base = mat4(h.x, y, h.z, h.ry);
  const add = (key, geo, x, yy, z, ry = 0, rx = 0, rz = 0) => bin.add(key, geo, base.clone().multiply(mat4(x, yy, z, ry, rx, rz)));
  const { w, d } = h, H = h.h;
  add('foot', boxG(w + 0.24, 0.65, d + 0.24), 0, 0.1, 0);
  add('plaster', boxG(w, H, d), 0, 0.42 + H / 2, 0);
  add('roof', boxG(w + 0.28, 0.22, d + 0.28), 0, 0.42 + H + 0.11, 0);
  for (const [px, pz, pw, pd] of [[0, d / 2 + 0.06, w + 0.28, 0.16], [0, -d / 2 - 0.06, w + 0.28, 0.16], [w / 2 + 0.06, 0, 0.16, d], [-w / 2 - 0.06, 0, 0.16, d]]) add('plaster', boxG(pw, 0.3, pd), px, 0.42 + H + 0.37, pz);
  const nb = Math.round(w / 0.8);
  for (let k = 0; k < nb; k++) for (const s of [1, -1]) {
    const c = new THREE.CylinderGeometry(0.075, 0.085, 0.45, 6); c.rotateX(Math.PI / 2);
    add('timber', c, -w / 2 + 0.4 + k * (w - 0.8) / Math.max(1, nb - 1), 0.42 + H - 0.12, s * (d / 2 + 0.12));
  }
  if (h.up) { const uw = w * 0.45, ud = d * 0.5; add('plaster', boxG(uw, 2.0, ud), -w / 2 + uw / 2 + 0.1, 0.42 + H + 1.2, -d / 2 + ud / 2 + 0.1); add('roof', boxG(uw + 0.24, 0.18, ud + 0.24), -w / 2 + uw / 2 + 0.1, 0.42 + H + 2.29, -d / 2 + ud / 2 + 0.1); }
  // the door side
  const dr = DOOR_ROT[h.door] ?? 0, half = (h.door === 'e' || h.door === 'w') ? w / 2 : d / 2, len = (h.door === 'e' || h.door === 'w') ? d : w;
  const dm = base.clone().multiply(mat4(0, 0, 0, dr));
  const addD = (key, geo, x, yy, z) => bin.add(key, geo, dm.clone().multiply(mat4(x, yy, z)));
  const dx = (r() - 0.5) * len * 0.3;
  addD(r() < 0.6 ? 'textile' : 'dark', boxG(1.0, 1.85, 0.06), dx, 0.42 + 0.93, half + 0.02);
  addD('timber', boxG(1.45, 0.16, 0.22), dx, 0.42 + 1.95, half + 0.05);
  addD('plaster', boxG(len * 0.55, 0.42, 0.5), dx + (dx > 0 ? -1 : 1) * len * 0.2, 0.42 + 0.21, half + 0.25);
  for (const s of [-1, 1]) { addD('dark', boxG(0.45, 0.4, 0.05), dx + s * len * 0.32, 0.42 + 1.55, half + 0.02); addD('timber', boxG(0.62, 0.08, 0.14), dx + s * len * 0.32, 0.42 + 1.8, half + 0.04); }
}

/** Ruined house (abandoned / drowned). keys: foot, ruin, timber. Returns rubble placements for RZ.rocks. */
export function houseRuin(bin, h, y, seed, decay = 0.5) {
  const r = rng(seed * 3 + 1), base = mat4(h.x, y, h.z, h.ry), rubble = [];
  const add = (key, geo, x, yy, z, ry = 0, rx = 0, rz = 0) => bin.add(key, geo, base.clone().multiply(mat4(x, yy, z, ry, rx, rz)));
  const { w, d } = h, H = h.h;
  add('foot', boxG(w + 0.24, 0.6, d + 0.24), 0, 0.1, 0);
  const walls = [[0, d / 2, w, 0], [0, -d / 2, w, Math.PI], [w / 2, 0, d, Math.PI / 2], [-w / 2, 0, d, -Math.PI / 2]];
  walls.forEach(([x, z, len, ry], i) => {
    const hh = H * (1 - decay * (0.3 + r() * 0.6));
    const g = RZ.brokenWall({ width: len, height: Math.max(0.8, hh), thickness: 0.42, seed: seed * 11 + i, holes: r() < 0.3 ? 1 : 0, jag: 0.5 + decay * 0.5 });
    add('ruin', g, x, 0.38, z, ry);
  });
  for (let k = 0; k < 2; k++) if (r() < 0.75) { const c = new THREE.CylinderGeometry(0.08, 0.09, w * (0.6 + r() * 0.4), 6); add('timber', c, (r() - 0.5) * w * 0.4, 0.5 + r() * 0.6, (r() - 0.5) * d * 0.5, r() * 3, 0.2 + r() * 0.5, Math.PI / 2 + (r() - 0.5) * 0.6); }
  const cs = Math.cos(h.ry), sn = Math.sin(h.ry);
  for (let k = 0; k < 7; k++) { const lx = (r() - 0.5) * (w + 1.6), lz = (r() - 0.5) * (d + 1.6); rubble.push({ x: h.x + lx * cs + lz * sn, z: h.z - lx * sn + lz * cs, scale: 0.18 + r() * 0.35, sink: 0.05 }); }
  return rubble;
}

// ---------------------------------------------------------------------------------------------
// Retaining wall (with the Keepers' Door, weep holes, optional bulge / collapsed gap)
// ---------------------------------------------------------------------------------------------
export function retainingWall(o = {}) {
  const { bulge = 0, gap = null, z0 = WALL.z0, z1 = WALL.z1 } = o;
  const th = WALL.x1 - WALL.x0, cx = (WALL.x0 + WALL.x1) / 2, y0 = -0.5, top = WALL.top + 0.3;
  const parts = [];
  const seg = (za, zb, ya, yb) => {
    if (zb - za < 0.05) return;
    const g = new THREE.BoxGeometry(th, yb - ya, zb - za, 1, Math.max(1, Math.round((yb - ya) / 0.4)), Math.max(1, Math.round((zb - za) / 0.5)));
    g.translate(cx, (ya + yb) / 2, (za + zb) / 2); parts.push(g);
  };
  const spans = [];
  let a = z0;
  const cuts = [[DOOR.z0, DOOR.z1, 'door']]; if (gap) cuts.push([gap[0], gap[1], 'gap']);
  cuts.sort((p, q) => p[0] - q[0]);
  for (const [c0, c1, kind] of cuts) { spans.push([a, c0]); if (kind === 'door') { seg(c0, c1, DOOR.h, top); seg(c0, c1, top, top + 0.18); } a = c1; }
  spans.push([a, z1]);
  for (const [za, zb] of spans) seg(za, zb, y0, top);
  // coping stones
  for (const [za, zb] of spans) seg(za, zb, top, top + 0.18);
  const g = mergeGeometries(parts);
  if (bulge) { // push the face out (+x) around the middle of the bulge zone
    const p = g.attributes.position, [b0, b1] = o.bulgeZone || [-10, 0];
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i), y = p.getY(i);
      const k = Math.sin(Math.PI * Math.min(1, Math.max(0, (z - b0) / (b1 - b0)))) * Math.sin(Math.PI * Math.min(1, Math.max(0, (y + 0.3) / (top + 0.3)))) ;
      p.setX(i, p.getX(i) + bulge * k * (0.75 + 0.25 * Math.sin(z * 3.1 + y * 2.3)));
    }
    g.computeVertexNormals();
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// Ribbons swept along a path (dyke, gravel bar, dirt lanes)
// ---------------------------------------------------------------------------------------------
/** Sweep a cross-section along z (x = cx(z)): section = [[dx, y(z, x)]...] returned by profile(z, cx). */
export function sweepZ(cx, z0, z1, step, profile) {
  const P = [], U = [], I = []; let rows = 0, cols = 0;
  for (let z = z0; z <= z1 + 1e-6; z += step) {
    const c = cx(z), sec = profile(z, c); cols = sec.length;
    sec.forEach(([dx, y], i) => { P.push(c + dx, y, z); U.push(i / (sec.length - 1), z); });
    rows++;
  }
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) { const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1; I.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
  return g;
}
/** Sweep along x (z = cz(x)). */
export function sweepX(cz, x0, x1, step, profile) {
  const P = [], U = [], I = []; let rows = 0, cols = 0;
  for (let x = x0; x <= x1 + 1e-6; x += step) {
    const c = cz(x), sec = profile(x, c); cols = sec.length;
    sec.forEach(([dz, y], i) => { P.push(x, y, c + dz); U.push(i / (sec.length - 1), x); });
    rows++;
  }
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) { const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1; I.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
  return g;
}
/** Ground-hugging strip along a polyline [[x,z],...] (lanes): uv.x across 0..1 for an edge alpha. */
export function laneStrip(points, width, heightAt, lift = 0.03) {
  const P = [], U = [], I = []; let d = 0;
  const pts = points.map(p => new THREE.Vector2(p[0], p[1]));
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(a.distanceTo(b) / 1.2)); for (let k = 0; k < n; k++) dense.push(a.clone().lerp(b, k / n)); }
  dense.push(pts[pts.length - 1]);
  dense.forEach((p, i) => {
    const q = dense[Math.min(dense.length - 1, i + 1)], o = dense[Math.max(0, i - 1)], t = new THREE.Vector2().subVectors(q, o).normalize(), nrm = new THREE.Vector2(-t.y, t.x);
    if (i) d += p.distanceTo(dense[i - 1]);
    for (const s of [-1, 1]) { const x = p.x + nrm.x * width / 2 * s, z = p.y + nrm.y * width / 2 * s; P.push(x, heightAt(x, z) + lift, z); U.push(s < 0 ? 0 : 1, d / width); }
  });
  for (let i = 0; i < dense.length - 1; i++) { const a = i * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
  return g;
}
/** Irregular ground decal disc (plaza, yards) following the terrain. */
export function groundDisc(cx, cz, rx, rz, heightAt, seed = 1, lift = 0.025) {
  const r = rng(seed), seg = 40, rings = 6, P = [], U = [], I = [];
  const wob = Array.from({ length: seg }, () => 0.82 + r() * 0.3);
  P.push(cx, heightAt(cx, cz) + lift, cz); U.push(0.5, 0.5);
  for (let j = 1; j <= rings; j++) for (let i = 0; i < seg; i++) {
    const a = i / seg * Math.PI * 2, t = j / rings, k = t * (j === rings ? wob[i] : lerp(1, wob[i], t));
    const x = cx + Math.cos(a) * rx * k, z = cz + Math.sin(a) * rz * k; P.push(x, heightAt(x, z) + lift, z); U.push(t, 0.5);
  }
  for (let i = 0; i < seg; i++) I.push(0, 1 + (i + 1) % seg, 1 + i);
  for (let j = 1; j < rings; j++) for (let i = 0; i < seg; i++) { const a = 1 + (j - 1) * seg + i, b = 1 + (j - 1) * seg + (i + 1) % seg, c = a + seg, d = b + seg; I.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
  return g;
}
/** Alpha mask for lanes / discs: opaque centre, ragged soft edges (uv.x = across or radius). */
export function edgeAlpha(kind = 'lane') {
  return canvasTex(128, 128, (g, w, h) => {
    const r = rng(kind === 'lane' ? 3 : 4), img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / (w - 1), e = kind === 'lane' ? 1 - Math.abs(u - 0.5) * 2 : 1 - u;
      const n = (Math.sin(y * 0.31 + x * 0.05) + Math.sin(y * 0.11 - x * 0.13)) * 0.08 + (r() - 0.5) * 0.12;
      const a = Math.max(0, Math.min(1, (e + n - 0.08) * 3.2)); const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = a * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, 'm5edge' + kind, { linear: true });
}

// ---------------------------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------------------------
export function jarGeometry(tall = 1) {
  const pts = [[0, 0], [0.16, 0.02], [0.24, 0.16], [0.27, 0.32], [0.22, 0.5], [0.12, 0.6], [0.1, 0.66], [0.13, 0.7]].map(([x, y]) => new THREE.Vector2(x, y * tall));
  const g = new THREE.LatheGeometry(pts, 12); return g;
}
/** InstancedMesh from placements [{x,y,z,s,ry,rx,rz}] */
export function instances(geo, mat, list, opts = {}) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((p, i) => im.setMatrixAt(i, mat4(p.x, p.y, p.z, p.ry ?? 0, p.rx ?? 0, p.rz ?? 0, p.s ?? 1, p.sy ?? p.s ?? 1, p.s ?? 1)));
  im.count = list.length; im.castShadow = opts.cast ?? true; im.receiveShadow = true; im.computeBoundingSphere();
  return im;
}

/** Barley / garden crop cards: instanced crossed quads with a drawn alpha texture. */
export function cropMesh(list, opts = {}) {
  const tex = canvasTex(256, 256, (g, w, h) => {
    const r = rng(opts.seed ?? 9); g.clearRect(0, 0, w, h);
    const leafy = opts.kind === 'garden';
    for (let k = 0; k < (leafy ? 26 : 70); k++) {
      const x = 10 + r() * (w - 20), top = h * (leafy ? 0.35 + r() * 0.35 : 0.08 + r() * 0.25), lean = (r() - 0.5) * 30;
      g.strokeStyle = `hsl(${opts.hue ?? (leafy ? 95 : 50)},${leafy ? 45 : 50}%,${(leafy ? 28 : 45) + r() * 15}%)`; g.lineWidth = leafy ? 7 + r() * 6 : 2 + r() * 1.5;
      g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top); g.stroke();
      if (!leafy) { g.fillStyle = `hsl(${(opts.hue ?? 46) - 4},${55}%,${55 + r() * 15}%)`; g.beginPath(); g.ellipse(x + lean, top + 8, 3, 13, lean * 0.01, 0, 7); g.fill(); }
    }
  }, 'm5crop' + (opts.kind || 'barley') + (opts.hue ?? ''));
  const P = [], UV = [], I = [];
  for (let k = 0; k < 2; k++) { const a = k * Math.PI / 2, dx = Math.cos(a) * 0.45, dz = Math.sin(a) * 0.45, v = P.length / 3; P.push(-dx, 0, -dz, dx, 0, dz, dx, 1, dz, -dx, 1, -dz); UV.push(0, 0, 1, 0, 1, 1, 0, 1); I.push(v, v + 1, v + 2, v, v + 2, v + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
  return instances(g, mat, list, { cast: false });
}

/** A rising smoke system (one draw call). sources: [[x,y,z]]. Returns { points, update(dt) } */
export function smoke(sources, color = 0xb8b0a6) {
  const per = 10, n = sources.length * per, pos = new Float32Array(n * 3), life = new Float32Array(n), r = rng(7);
  for (let i = 0; i < n; i++) life[i] = r();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tex = canvasTex(64, 64, (c) => { const grd = c.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = grd; c.fillRect(0, 0, 64, 64); }, 'm5smoke');
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 2.6, map: tex, transparent: true, opacity: 0.32, depthWrite: false, sizeAttenuation: true }));
  pts.frustumCulled = false;
  const update = (dt, t) => {
    for (let i = 0; i < n; i++) {
      life[i] += dt * 0.09; if (life[i] > 1) life[i] -= 1;
      const s = sources[Math.floor(i / per)], L = life[i];
      pos[i * 3] = s[0] + Math.sin(L * 5 + i) * 0.5 + L * 3.5; pos[i * 3 + 1] = s[1] + L * 9; pos[i * 3 + 2] = s[2] + Math.cos(L * 4 + i) * 0.4 + L * 1.2;
    }
    g.attributes.position.needsUpdate = true;
  };
  update(0, 0);
  return { points: pts, update };
}

/** Collectible temporal shard (emissive crystal cluster). */
export function shardMesh(color = 0x9fe8ff) {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color: 0x0a1418, emissive: color, emissiveIntensity: 2.2, roughness: 0.12, metalness: 0.1, transmission: 0, clearcoat: 1 });
  for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.12 + k * 0.03, 0), m); c.scale.set(0.6, 1.8, 0.6); c.position.set((k - 1) * 0.08, 0.05 * k, (k % 2) * 0.06); c.rotation.z = (k - 1) * 0.35; g.add(c); }
  return g;
}

// ---------------------------------------------------------------------------------------------
// Water Ring (small stone ring above the Keepers' Door) and the buried machine
// ---------------------------------------------------------------------------------------------
export function waterRing(stoneMat, glowColor = 0xffb060) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.24, 14, 56), stoneMat); ring.castShadow = true; g.add(ring);
  const glyph = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.025, 6, 64), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: glowColor, emissiveIntensity: 0.2 }));
  g.add(glyph);
  for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.6, 0.55), stoneMat); post.position.set(s * 1.25, -1.15, 0); post.castShadow = true; g.add(post); }
  g.userData.glyph = glyph;
  return g;
}

/** The machine: segmented rings of dark ceramic, glowing seams, a cradle for the core. */
export function machine() {
  const g = new THREE.Group();
  const shell = new THREE.MeshPhysicalMaterial({ color: 0x121418, metalness: 0.75, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.25 });
  const seamM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb060, emissiveIntensity: 1.6 });
  const outer = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.34, 20, 120), shell); outer.castShadow = true; g.add(outer);
  const segs = new THREE.Group(); g.add(segs);
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, s = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.5), shell); s.position.set(Math.cos(a) * 2.3, Math.sin(a) * 2.3, 0); s.rotation.z = a; segs.add(s);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.52), seamM); seam.position.set(Math.cos(a + 0.2) * 2.3, Math.sin(a + 0.2) * 2.3, 0); seam.rotation.z = a; segs.add(seam);
  }
  const inner = [];
  for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.75 - k * 0.32, 0.03, 6, 96), seamM); t.rotation.set(k * 0.5, k * 0.7, 0); g.add(t); inner.push(t); }
  const cradle = new THREE.Group(); g.add(cradle);
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4, p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.9, 0.12), shell); p.position.set(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0); p.rotation.z = a - Math.PI / 2; cradle.add(p); }
  const coreM = new THREE.MeshStandardMaterial({ color: 0x1a0c02, emissive: 0xffa040, emissiveIntensity: 3.2, roughness: 0.2 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), coreM); g.add(core);
  const clamp = new THREE.Group(); g.add(clamp); // Helix clamp marks around the empty socket (2049)
  const clampM = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.6, roughness: 0.4 });
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const c = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.3), clampM); c.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.18); c.rotation.z = a; clamp.add(c); }
  g.userData = { core, coreM, seamM, inner, clamp, update(t) { inner.forEach((m, i) => { m.rotation.z = t * 0.12 * (i + 1) * (i % 2 ? -1 : 1); }); core.rotation.y = t * 0.3; core.rotation.x = t * 0.17; } };
  return g;
}

// ---------------------------------------------------------------------------------------------
// 2049: the dam, the outlet tower, the survey buoy
// ---------------------------------------------------------------------------------------------
export function damGeometry() {
  const parts = [];
  const body = new THREE.BoxGeometry(90, 9.5, 5, 18, 2, 1); body.translate(3, 1.75, 58); parts.push(body);
  const crest = new THREE.BoxGeometry(90, 0.5, 6.5, 18, 1, 1); crest.translate(3, 6.75, 58.2); parts.push(crest);
  for (let k = 0; k < 12; k++) { const b = new THREE.BoxGeometry(1.2, 9.8, 1.4); b.translate(-38 + k * 7.6, 1.9, 55.2); parts.push(b); }
  return mergeGeometries(parts);
}
export function towerGeometry() {
  const parts = [];
  const core = new THREE.CylinderGeometry(2.3, 2.6, 12, 24); core.translate(0, 3, 0); parts.push(core);
  const deck = new THREE.CylinderGeometry(3.7, 3.7, 0.25, 32); deck.translate(0, 2.68, 0); parts.push(deck);
  const roof = new THREE.CylinderGeometry(2.9, 2.6, 0.5, 24); roof.translate(0, 9.25, 0); parts.push(roof);
  const hut = new THREE.BoxGeometry(2.2, 2.3, 1.6); hut.translate(0, 10.6, 0); parts.push(hut);
  return mergeGeometries(parts);
}
export function railRing(r, y, mat) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 48), mat); top.rotation.x = Math.PI / 2; top.position.y = y + 1.05; g.add(top);
  const mid = top.clone(); mid.position.y = y + 0.55; g.add(mid);
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 5), mat); p.position.set(Math.cos(a) * r, y + 0.52, Math.sin(a) * r); g.add(p); }
  return g;
}
export function buoy() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xc8322a, roughness: 0.45 }), white = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.5 });
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.9, 16), red); b.position.y = 0.2; g.add(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.6, 8), white); m.position.y = 1.4; g.add(m);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd040, emissiveIntensity: 3 })); lamp.position.y = 2.3; g.add(lamp);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: signTex(['HELIX SURVEY', 'SITE 0', 'DO NOT ANCHOR'], '#e8e4dc', '#1a1c20', 'buoy'), roughness: 0.6, side: THREE.DoubleSide })); sign.position.set(0, 1.2, 0.18); g.add(sign);
  g.userData.lamp = lamp;
  return g;
}

// ---------------------------------------------------------------------------------------------
// Canvas textures
// ---------------------------------------------------------------------------------------------
export function signTex(lines, bg = '#e8e4dc', fg = '#1a1c20', key = 'sign', opts = {}) {
  return canvasTex(opts.w || 512, opts.h || 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const r = rng(lines.join('').length); for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(60,40,20,${r() * 0.08})`; g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6); }
    g.fillStyle = opts.band || '#2a8aaa'; g.fillRect(0, 0, w, h * 0.16);
    g.fillStyle = '#f2f4f6'; g.font = `700 ${Math.round(h * 0.1)}px Rajdhani, sans-serif`; g.textBaseline = 'middle'; g.fillText(opts.title || 'HELIX TEMPORAL RESEARCH', w * 0.05, h * 0.08);
    g.fillStyle = fg; const fs = opts.fs || Math.round(h / (lines.length + 2.5));
    lines.forEach((l, i) => { g.font = `${i === 0 ? 700 : 600} ${i === 0 ? fs * 1.15 : fs}px Rajdhani, sans-serif`; g.fillText(l, w * 0.05, h * 0.28 + i * fs * 1.12); });
    if (opts.rust) { for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(120,60,20,${r() * 0.25})`; g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 14, 0, 7); g.fill(); } }
  }, 'm5' + key);
}
/** Tala's oral-history mural: the river's three roads. */
export function muralTex() {
  return canvasTex(768, 320, (g, w, h) => {
    const r = rng(41); g.fillStyle = '#c4a272'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2400; k++) { g.fillStyle = `rgba(${90 + r() * 70},${60 + r() * 40},${30 + r() * 20},${r() * 0.14})`; g.fillRect(r() * w, r() * h, 3, 3); }
    const ink = '#3a2416', teal = '#2b6c70', ochre = '#9a3a1a';
    const river = (pts, col, wid) => { g.strokeStyle = col; g.lineWidth = wid; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
    const panel = (x0, title) => { g.strokeStyle = '#5a3a20'; g.lineWidth = 5; g.strokeRect(x0 + 6, 8, w / 3 - 12, h - 16); g.fillStyle = ink; g.font = '600 18px Rajdhani, sans-serif'; g.fillText(title, x0 + 18, h - 22); };
    // 1: the river runs east, the village is whole
    panel(0, 'THE FIRST ROAD');
    river([[160, 20], [190, 120], [200, 290]], teal, 18);
    for (let k = 0; k < 6; k++) { g.fillStyle = ochre; g.fillRect(40 + (k % 3) * 34, 80 + Math.floor(k / 3) * 60, 22, 18); }
    // 2: the rockfall turns the river west, houses fall
    panel(w / 3, 'THE HUNGRY ROAD');
    river([[w / 3 + 160, 20], [w / 3 + 140, 90], [w / 3 + 90, 180], [w / 3 + 70, 290]], teal, 22);
    g.fillStyle = '#6a5a4a'; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(w / 3 + 190 + r() * 30, 60 + r() * 30, 6 + r() * 6, 0, 7); g.fill(); }
    for (let k = 0; k < 3; k++) { g.save(); g.translate(w / 3 + 60 + k * 26, 170 + k * 18); g.rotate(0.6); g.fillStyle = ochre; g.fillRect(-11, -9, 22, 18); g.restore(); }
    // 3: a figure with a ring on the wrist turns the river back; water marks on three gates
    panel(2 * w / 3, 'THE ROAD THAT STAYS');
    river([[2 * w / 3 + 160, 20], [2 * w / 3 + 190, 120], [2 * w / 3 + 200, 290]], teal, 18);
    g.fillStyle = ink; const fx = 2 * w / 3 + 110, fy = 190; g.beginPath(); g.arc(fx, fy - 40, 9, 0, 7); g.fill(); g.fillRect(fx - 7, fy - 30, 14, 34); g.fillRect(fx - 8, fy + 4, 5, 22); g.fillRect(fx + 3, fy + 4, 5, 22);
    g.strokeStyle = '#2ad0e0'; g.lineWidth = 3; g.beginPath(); g.arc(fx - 12, fy - 14, 6, 0, 7); g.stroke();
    for (let k = 0; k < 3; k++) { const gx = 2 * w / 3 + 30 + k * 24, gy = 70 + k * 40; g.fillStyle = '#5a4a3a'; g.fillRect(gx, gy, 14, 20); g.fillStyle = k === 1 ? '#a8281c' : '#2f7fa0'; g.beginPath(); g.arc(gx + 7, gy - 8, 6, 0, 7); g.fill(); if (k === 1) { g.strokeStyle = '#a8281c'; g.lineWidth = 3; g.beginPath(); g.moveTo(gx - 4, gy - 16); g.lineTo(gx + 18, gy + 2); g.stroke(); } }
    // the star count along the top
    g.fillStyle = '#e8d9a8'; for (let k = 0; k < 17; k++) { g.beginPath(); g.arc(30 + k * 42, 18, k === 16 ? 5 : 3, 0, 7); g.fill(); }
  }, 'm5mural');
}
/** Carved glyph on the Keepers' Door: the ring and the river. */
export function doorTex(kind = 'stone') {
  return canvasTex(256, 320, (g, w, h) => {
    const r = rng(kind.length * 7);
    if (kind === 'hatch') {
      g.fillStyle = '#5c6268'; g.fillRect(0, 0, w, h); for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(${110 + r() * 60},${50 + r() * 30},20,${r() * 0.2})`; g.fillRect(r() * w, r() * h, 3 + r() * 8, 2 + r() * 6); }
      g.strokeStyle = '#2a2e32'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
      g.fillStyle = '#e8b020'; for (let x = -40; x < w; x += 40) { g.save(); g.beginPath(); g.rect(0, h - 46, w, 26); g.clip(); g.fillRect(x, h - 46, 20, 26); g.restore(); }
      g.fillStyle = '#e8eaec'; g.font = '700 30px Rajdhani, sans-serif'; g.fillText('HELIX', 30, 70); g.font = '600 20px Rajdhani, sans-serif'; g.fillText('SITE 0 · ACCESS SZ-0', 30, 100); g.fillText('SEALED 02.2031', 30, 126);
      g.strokeStyle = '#2a8aaa'; g.lineWidth = 5; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(w / 2, 200, 18 + k * 10, k, k + 4.6); g.stroke(); }
      return;
    }
    g.fillStyle = '#8a7a62'; g.fillRect(0, 0, w, h); for (let k = 0; k < 1500; k++) { g.fillStyle = `rgba(${r() < 0.5 ? 40 : 200},${r() < 0.5 ? 30 : 180},20,${r() * 0.08})`; g.fillRect(r() * w, r() * h, 2 + r() * 4, 2 + r() * 4); }
    g.strokeStyle = 'rgba(40,26,14,0.85)'; g.lineWidth = 7; g.beginPath(); g.arc(w / 2, 120, 62, 0.25, Math.PI * 2 - 0.25); g.stroke();
    g.beginPath(); g.arc(w / 2, 120, 10, 0, 7); g.stroke();
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(40, 220 + k * 22); g.bezierCurveTo(90, 205 + k * 22, 160, 240 + k * 22, 216, 220 + k * 22); g.stroke(); }
    if (kind === 'roots') { g.strokeStyle = 'rgba(50,40,24,0.95)'; g.lineWidth = 5; for (let k = 0; k < 9; k++) { g.beginPath(); let x = r() * w, y = 0; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 40; y += 30 + r() * 25; g.lineTo(x, y); } g.stroke(); } }
  }, 'm5door' + kind);
}
/** The memorial stone carved after the river was turned. */
export function memorialTex() {
  return canvasTex(256, 384, (g, w, h) => {
    const r = rng(17); g.fillStyle = '#8f8670'; g.fillRect(0, 0, w, h); for (let k = 0; k < 1600; k++) { g.fillStyle = `rgba(${r() < 0.5 ? 50 : 210},${r() < 0.5 ? 60 : 200},${40},${r() * 0.08})`; g.fillRect(r() * w, r() * h, 3, 3); }
    g.strokeStyle = 'rgba(36,26,16,0.9)'; g.lineWidth = 6;
    const fx = w / 2, fy = 210; g.beginPath(); g.arc(fx, fy - 70, 16, 0, 7); g.stroke(); g.beginPath(); g.moveTo(fx, fy - 54); g.lineTo(fx, fy + 30); g.moveTo(fx, fy - 30); g.lineTo(fx - 40, fy - 70); g.moveTo(fx, fy - 30); g.lineTo(fx + 40, fy - 10); g.moveTo(fx, fy + 30); g.lineTo(fx - 22, fy + 80); g.moveTo(fx, fy + 30); g.lineTo(fx + 22, fy + 80); g.stroke();
    g.strokeStyle = 'rgba(30,140,160,0.9)'; g.lineWidth = 5; g.beginPath(); g.arc(fx - 44, fy - 74, 12, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(36,26,16,0.9)'; g.lineWidth = 6; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(30 + k * 10, 320 - k * 6); g.bezierCurveTo(90, 300, 160, 340, 226 - k * 10, 315 - k * 6); g.stroke(); }
  }, 'm5memorial');
}
/** The laminated Helix survey tag left on the machine. */
export function surveyTagTex(security = 'BRANDT') {
  return canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#eef0ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a8aaa'; g.fillRect(0, 0, w, 54);
    g.fillStyle = '#fff'; g.font = '700 30px Rajdhani, sans-serif'; g.fillText('HELIX TEMPORAL · SURVEY', 20, 38);
    g.fillStyle = '#1a1c20'; g.font = '700 28px Rajdhani, sans-serif'; g.fillText('SITE ZERO · ASSET SZ-0', 20, 96);
    g.font = '600 22px Rajdhani, sans-serif';
    ['SURVEYED 14.03.2029', 'CORE: RECOVERED  →  HELIX LAB 1', 'SITE STATUS: TO BE FLOODED (RES. 7, 2031)', 'AUTHORISED: E. ROOK', 'SECURITY ESCORT: ' + security].forEach((l, i) => g.fillText(l, 20, 136 + i * 34));
    g.strokeStyle = '#a8281c'; g.lineWidth = 4; g.strokeRect(330, 70, 160, 50); g.fillStyle = '#a8281c'; g.font = '700 24px Rajdhani, sans-serif'; g.fillText('NO RECORD', 346, 104);
  }, 'm5tag' + security);
}
/** Valve placard at the outlet tower. */
export function placardTex() {
  return signTex(['OUTLET G-2 · MANUAL RELEASE', '1  OPEN BYPASS V1', '2  OPEN BYPASS V2', '3  WAIT: GAUGE BELOW 60', '4  RELEASE MAIN GATE', 'NEVER RELEASE AGAINST PRESSURE'], '#e6e2d8', '#1a1c20', 'placard', { band: '#c8322a', title: 'RESERVOIR 7 · HELIX HYDRO', rust: true });
}

// ---------------------------------------------------------------------------------------------
// 2049 field kit for the caretaker (attached to the realistic cast's bones; no edits to the cast itself):
// a ruggedised slate in the right hand with a live screen, and an AR earpiece with a status LED.
// ---------------------------------------------------------------------------------------------
export function dressCaretaker(ch) {
  const out = [];
  const hand = ch.arms?.[0]?.hand, head = ch.head;
  const shell = new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.45, metalness: 0.35 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x050708, emissive: 0x7fd8ff, emissiveIntensity: 0.9, roughness: 0.2,
    emissiveMap: canvasTex(128, 192, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a7a9a'; g.fillRect(0, 0, w, 18);
      g.strokeStyle = '#9fe8ff'; g.lineWidth = 3; g.beginPath(); for (let x = 8; x < w - 8; x += 4) g.lineTo(x, 70 + Math.sin(x * 0.12) * 14 + Math.sin(x * 0.05) * 10); g.stroke();
      g.fillStyle = '#d8f4ff'; for (let k = 0; k < 6; k++) g.fillRect(10, 110 + k * 13, 40 + (k * 37) % 60, 6);
    }, 'm5slate') });
  if (hand) {
    const slate = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.21), shell); slate.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.18), screen); face.rotation.x = -Math.PI / 2; face.position.y = 0.0065; slate.add(face);
    slate.position.set(0.0, 0.09, 0.03); slate.rotation.set(0.2, 0, Math.PI / 2);
    hand.add(slate); out.push(slate);
  }
  if (head) {
    const bud = new THREE.Group();
    const shellM = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.35, metalness: 0.4 });
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.018, 4, 8), shellM); pod.rotation.x = Math.PI / 2; bud.add(pod);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.07, 5), shellM); boom.rotation.x = Math.PI / 2 - 0.35; boom.position.set(0, -0.012, 0.035); bud.add(boom);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 6, 4), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x5fe6ff, emissiveIntensity: 3 })); led.position.set(-0.009, 0.004, 0); bud.add(led);
    bud.position.set(-0.078, 0.07, 0.0);
    head.add(bud); out.push(bud);
  }
  return out;
}
