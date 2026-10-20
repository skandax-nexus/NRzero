import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry } from '../core/character.js';
import * as RZ from './realism.js';

export const rng = mulberry;
const texCache = new Map();

// Infrastructure upgrade switches (docs/RENDERING.md, stage 4): ?infra=off builds the shared kit exactly as before the
// upgrade (A/B captures); ?infra=nofacade,nomasonry,nolamp,nobatch switch single parts off.
const INFRA = (() => { try { return new Set(String(new URLSearchParams(window.location.search).get('infra') || '').split(',').filter(Boolean)); } catch { return new Set(); } })();
/** false when ?infra=off or ?infra=no<part> switched an upgrade part off (facade, masonry, lamp, batch). */
export function infraOn(part) { return !INFRA.has('off') && !INFRA.has('no' + part); }

export function canvasTex(w, h, draw, key, opts = {}) {
  if (key && texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); }
  if (key) texCache.set(key, t);
  return t;
}

// Building facade: returns {map, emissive}. Both carry userData.rzFacade, so a box() built with them becomes a real
// building (see box()); era: '2049' (default, Rain City) | '2026' | '2196' picks the facade variant.
export function facadeTextures(seed, style = 'modern', era = '2049') {
  const key = 'facade' + seed + style + era;
  if (texCache.has(key)) return texCache.get(key);
  const r = rng(seed);
  const W = 256, H = 512, cols = 6 + Math.floor(r() * 4), rows = 18 + Math.floor(r() * 10);
  const cw = W / cols, rh = H / rows;
  const warm = ['#ffd9a0', '#ffc070', '#ffe8c8', '#ffb060'], cool = ['#a8e8ff', '#7fd0ff', '#d8f4ff', '#c0b0ff'];
  const lit = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) lit.push(r() < 0.32 ? (r() < 0.7 ? warm : cool)[Math.floor(r() * 4)] : null);
  const map = canvasTex(W, H, (g) => {
    g.fillStyle = style === 'glass' ? '#141c26' : '#1a1d22'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      g.fillStyle = style === 'glass' ? '#1d2a38' : '#0d1015';
      g.fillRect(x * cw + 2, y * rh + 2, cw - 4, rh - 4);
    }
    g.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < rows; y += 4) g.fillRect(0, y * rh, W, 2);
  });
  const emissive = canvasTex(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    let i = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const c = lit[i++]; if (!c) continue;
      const grd = g.createLinearGradient(0, y * rh, 0, (y + 1) * rh);
      grd.addColorStop(0, c); grd.addColorStop(1, '#00000000');
      g.globalAlpha = 0.5 + r() * 0.5; g.fillStyle = grd; g.fillRect(x * cw + 3, y * rh + 3, cw - 6, rh - 6);
      if (r() < 0.3) { g.fillStyle = '#000'; g.globalAlpha = 0.6; g.fillRect(x * cw + 3 + r() * cw * 0.5, y * rh + 3, cw * 0.15, rh - 6); }
    }
    g.globalAlpha = 1;
  });
  map.userData.rzFacade = emissive.userData.rzFacade = { seed, style, era };
  const out = { map, emissive }; texCache.set(key, out); return out;
}

export function neonTexture(text, color, opts = {}) {
  const key = 'neon' + text + color + (opts.vertical ? 'v' : '');
  const font = opts.font || '700 72px Rajdhani, sans-serif';
  let W = opts.vertical ? 128 : 512;
  if (!opts.vertical) { const m = document.createElement('canvas').getContext('2d'); m.font = font; W = Math.min(2048, Math.max(512, Math.ceil(m.measureText(text).width + 90))); }
  return canvasTex(W, opts.vertical ? 512 : 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = color;
    if (opts.vertical) { [...text].forEach((ch, i, a) => g.fillText(ch, w / 2, h / (a.length + 1) * (i + 1))); }
    else { g.fillText(text, w / 2, h / 2); g.shadowBlur = 4; g.fillStyle = '#fff'; g.globalAlpha = 0.6; g.fillText(text, w / 2, h / 2); }
    g.globalAlpha = 1; g.strokeStyle = color; g.lineWidth = 4; g.shadowBlur = 12; g.strokeRect(6, 6, w - 12, h - 12);
  }, key);
}

export function neonSign(text, color, w = 3, h = 0.75, opts = {}) {
  const tex = neonTexture(text, color, opts);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(opts.intensity ?? 2.2, opts.intensity ?? 2.2, opts.intensity ?? 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  m.userData.flicker = opts.flicker ? Math.random() * 10 : null;
  return m;
}

// Wet asphalt with puddles: roughness + color variation
export function asphaltMaterial(repeat = [6, 30]) {
  const rough = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},0.06)`; g.fillRect(r() * w, r() * h, 2, 2); }
    for (let i = 0; i < 9; i++) {
      const x = r() * w, y = r() * h, rr = 40 + r() * 90;
      const grd = g.createRadialGradient(x, y, 0, x, y, rr); grd.addColorStop(0, 'rgba(40,40,40,0.9)'); grd.addColorStop(0.6, 'rgba(90,90,90,0.5)'); grd.addColorStop(1, 'rgba(154,154,154,0)');
      g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, rr * 1.4, rr, r() * 3, 0, 7); g.fill();
    }
  }, 'asphaltR', { repeat, linear: true });
  const col = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#1b1d20'; g.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 9000; i++) { const v = 20 + r() * 30; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
  }, 'asphaltC', { repeat });
  return new THREE.MeshStandardMaterial({ map: col, roughnessMap: rough, roughness: 0.85, metalness: 0.15, envMapIntensity: 1.2 });
}

export function tileMaterial(base = '#3a3d42', grout = '#202226', repeat = [8, 8], opts = {}) {
  const map = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = grout; g.fillRect(0, 0, w, h);
    const r = rng(base.length * 13);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const c = new THREE.Color(base).offsetHSL(0, 0, (r() - 0.5) * 0.04);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
  }, 'tile' + base + grout, { repeat });
  return new THREE.MeshStandardMaterial({ map, roughness: opts.roughness ?? 0.35, metalness: opts.metalness ?? 0.1, ...opts.extra });
}

export function stoneMaterial(base = '#9a8466', repeat = [2, 2], seed = 3) {
  const map = canvasTex(256, 256, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 6; row++) {
      let x = row % 2 ? -20 : 0; const y = row * 43;
      while (x < w) {
        const bw = 40 + r() * 40, c = new THREE.Color(base).offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12);
        g.fillStyle = '#' + c.getHexString(); g.fillRect(x + 2, y + 2, bw - 4, 39);
        for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(x + r() * bw, y + r() * 40, 3, 3); }
        x += bw;
      }
    }
  }, 'stone' + base + seed, { repeat });
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0 });
  m.userData.rzKit = 'stone';   // box() adds masonry detail to house-sized stone boxes
  return m;
}

export function concreteMaterial(base = '#6d6e70', repeat = [2, 2], opts = {}) {
  const map = canvasTex(256, 256, (g, w, h) => {
    const r = rng(base.charCodeAt(2));
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); }
    if (opts.stains) for (let i = 0; i < 8; i++) { const x = r() * w; const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, 'rgba(20,30,10,0.0)'); grd.addColorStop(1, 'rgba(20,30,10,0.35)'); g.fillStyle = grd; g.fillRect(x, 0, 6 + r() * 20, h); }
  }, 'conc' + base + !!opts.stains, { repeat });
  return new THREE.MeshStandardMaterial({ map, roughness: opts.roughness ?? 0.85, metalness: 0.02 });
}

export function sky(top, horizon, opts = {}) {
  const geo = new THREE.SphereGeometry(opts.radius || 600, 32, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(top) }, uHor: { value: new THREE.Color(horizon) }, uSun: { value: new THREE.Color(opts.sun || 0x000000) }, uSunDir: { value: new THREE.Vector3(...(opts.sunDir || [0, 0.2, -1])).normalize() }, uStars: { value: opts.stars || 0 }, uTime: { value: 0 }, uLeft: { value: new THREE.Color(opts.left ?? horizon) } },
    vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uTop,uHor,uSun,uSunDir,uLeft; uniform float uStars,uTime; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ float y=max(vD.y,0.0); vec3 hor=mix(uLeft,uHor,smoothstep(-0.6,0.6,vD.x)); vec3 c=mix(hor,uTop,pow(y,0.55));
        float s=max(dot(vD,uSunDir),0.0); c+=uSun*(pow(s,8.0)*0.6+pow(s,300.0)*4.0);
        vec3 q=floor(vD*420.0); float st=step(0.9975,h(q))*uStars*smoothstep(0.05,0.4,vD.y)*(0.6+0.4*sin(uTime*2.0+h(q)*40.0));
        c+=vec3(st);
        gl_FragColor=vec4(c,1.0); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

// Rain as streak lines around the camera. Can freeze (Zero Second).
export class Rain {
  constructor(count = 5000, area = 40, color = 0x9fc4dd) {
    this.count = count; this.area = area; this.frozen = false;
    const pos = new Float32Array(count * 6); this.vel = new Float32Array(count);
    const r = rng(42);
    for (let i = 0; i < count; i++) {
      const x = (r() - 0.5) * area, y = r() * 30, z = (r() - 0.5) * area;
      pos.set([x, y, z, x + 0.02, y + 0.55, z], i * 6); this.vel[i] = 18 + r() * 8;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false }));
    this.mesh.frustumCulled = false; this.center = new THREE.Vector3();
    // the engine makes the scene wet while rain is visible; env-probe captures skip the streaks
    this.mesh.userData.rzRain = true; this.mesh.userData.noCapture = true;
  }
  update(dt, cam) {
    const p = this.mesh.geometry.attributes.position.array, A = this.area, cx = cam.position.x, cz = cam.position.z, cy = cam.position.y;
    if (this.frozen) return;
    for (let i = 0; i < this.count; i++) {
      const o = i * 6; let y = p[o + 1] - this.vel[i] * dt;
      let x = p[o], z = p[o + 2];
      if (y < cy - 6 || x - cx > A / 2 || cx - x > A / 2 || z - cz > A / 2 || cz - z > A / 2) {
        y = cy + 10 + Math.random() * 14;
        if (x - cx > A / 2 || cx - x > A / 2) x = cx + (Math.random() - 0.5) * A;
        if (z - cz > A / 2 || cz - z > A / 2) z = cz + (Math.random() - 0.5) * A;
      }
      p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = x + 0.02; p[o + 4] = y + 0.55; p[o + 5] = z;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

// Floating dust / spores / embers
export class Motes {
  constructor(count, box, color = 0xffd9a0, size = 0.06, speed = 0.3) {
    const pos = new Float32Array(count * 3); const r = rng(5);
    for (let i = 0; i < count; i++) pos.set([box[0] + r() * (box[3] - box[0]), box[1] + r() * (box[4] - box[1]), box[2] + r() * (box[5] - box[2])], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tex = canvasTex(64, 64, (c) => { const grd = c.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, '#fff'); grd.addColorStop(0.3, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = grd; c.fillRect(0, 0, 64, 64); }, 'mote');
    this.mesh = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.box = box; this.speed = speed; this.t = 0; this.frozen = false;
  }
  update(dt) {
    if (this.frozen) return; this.t += dt;
    const p = this.mesh.geometry.attributes.position.array, b = this.box;
    for (let i = 0; i < p.length; i += 3) {
      p[i] += Math.sin(this.t * 0.5 + i) * dt * this.speed; p[i + 1] += Math.cos(this.t * 0.3 + i * 0.7) * dt * this.speed * 0.6 + dt * this.speed * 0.2;
      if (p[i + 1] > b[4]) p[i + 1] = b[1];
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

// Level box. Two kinds are upgraded in place (opts.detail = false keeps the plain box):
//  * a box textured with facadeTextures() and at least 8 m tall becomes a real building: interior-mapped windows with
//    frames and sills, cornices, ledges, fire escapes, balconies, AC units, pipes, rooftop plant and the era's retrofits
//    (LED strips, sign panels, canopies). Its geometry is built on the first frame its scene renders
//    (resolveFacades(), called by the engine), so it can keep clear of what the scene placed around it (signs, awnings,
//    lamps, neighbours): faces against a neighbour become party walls, a ground floor the scene dressed is left plain,
//    the other street faces get shops. Camera blockers still ray-test the plain box.
//  * a house-sized box with a stoneMaterial() gets a plinth course, corner quoins, a timber wall plate and beam ends
//    (child meshes that share the box's material; the engine merges them across houses).
export function box(w, h, d, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true;
  if (opts.detail !== false && mat && !Array.isArray(mat)) detailBox(m, w, h, d, mat, opts);
  return m;
}

// ---------- facade buildings and masonry (docs/RENDERING.md, stage 4) ----------
const FACADES = [];   // facade boxes waiting for their scene's first frame
function detailBox(m, w, h, d, mat, opts) {
  const fac = mat.map?.userData?.rzFacade || mat.emissiveMap?.userData?.rzFacade;
  if (fac && infraOn('facade') && h >= 8 && Math.min(w, d) >= 4) {
    m.userData.rzFacadeBox = { w, h, d, seed: fac.seed, style: fac.style, era: opts.era || fac.era || '2049', far: !mat.map, legacy: mat, built: false };
    m.raycast = boxRaycast;
    FACADES.push(m);
    return;
  }
  if (mat.userData?.rzKit === 'stone' && infraOn('masonry') && h >= 2.4 && h <= 12 && Math.min(w, d) >= 2.5) masonry(m, w, h, d, mat);
}
const _ray = new THREE.Ray(), _inv = new THREE.Matrix4(), _bb = new THREE.Box3(), _hit = new THREE.Vector3();
// Camera blockers (player.js) ray-test the building's plain box, not every rung of its fire escapes.
function boxRaycast(raycaster, hits) {
  const b = this.userData.rzFacadeBox;
  if (!b) { THREE.Mesh.prototype.raycast.call(this, raycaster, hits); return; }
  _inv.copy(this.matrixWorld).invert(); _ray.copy(raycaster.ray).applyMatrix4(_inv);
  _bb.min.set(-b.w / 2, -b.h / 2, -b.d / 2); _bb.max.set(b.w / 2, b.h / 2, b.d / 2);
  if (!_ray.intersectBox(_bb, _hit)) return;
  _hit.applyMatrix4(this.matrixWorld);
  const dist = raycaster.ray.origin.distanceTo(_hit);
  if (dist < raycaster.near || dist > raycaster.far) return;
  hits.push({ distance: dist, point: _hit.clone(), object: this });
}
const rootOf = o => { while (o.parent) o = o.parent; return o; };
// world AABB of a mesh from its geometry's bounding box (cheap, no vertex walk)
function meshAABB(o, out = new THREE.Box3()) {
  if (o.isInstancedMesh) { if (!o.boundingBox) o.computeBoundingBox(); return out.copy(o.boundingBox).applyMatrix4(o.matrixWorld); }
  const g = o.geometry; if (!g) return out.makeEmpty();
  if (!g.boundingBox) g.computeBoundingBox();
  return out.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
}
function facadeAABB(o, out = new THREE.Box3()) {
  const b = o.userData.rzFacadeBox;
  out.min.set(-b.w / 2, -b.h / 2, -b.d / 2); out.max.set(b.w / 2, b.h / 2, b.d / 2);
  return out.applyMatrix4(o.matrixWorld);
}
/**
 * Build the facade boxes of `scene` that are still plain (called by the engine every frame; returns at once when
 * none are waiting). Missions that render without the engine can call it once after building the scene.
 */
/** Timings of the last resolveFacades() that built something (ms): scan, probes + avoid tests, geometry, material. */
export const facadeStats = { n: 0, scan: 0, probe: 0, geometry: 0, material: 0, total: 0, avoidCalls: 0 };
export function resolveFacades(scene) {
  if (!FACADES.length) return 0;
  const mine = [];
  for (let i = FACADES.length - 1; i >= 0; i--) {
    const m = FACADES[i], ud = m.userData.rzFacadeBox;
    if (!ud || ud.built) { FACADES.splice(i, 1); continue; }
    if (rootOf(m) === scene) { mine.push(m); FACADES.splice(i, 1); }
    else if ((ud.wait = (ud.wait || 0) + 1) > 1800) FACADES.splice(i, 1);   // never added to a rendered scene
  }
  if (!mine.length) return 0;
  const t0 = performance.now();
  scene.updateMatrixWorld(true);
  // every other mesh of the scene is an obstacle the new geometry keeps clear of (characters, sky domes, ground
  // planes and other huge things excluded); facade boxes count with their plain box
  const obst = [], fac = [];
  const visit = o => {
    if (o.userData.character || o.userData.rzBatch) return;   // characters move; merged copies duplicate their sources
    if (o.userData.rzFacadeBox) { fac.push({ o, b: facadeAABB(o) }); return; }
    if ((o.isMesh || o.isInstancedMesh) && !o.userData.noCapture) {
      const b = meshAABB(o), s = b.getSize(_hit);
      // sprawling things (ground planes, merged street runs, skies: two sides over 12 m) are too coarse to test against
      const big = (s.x > 12) + (s.y > 12) + (s.z > 12);
      if (isFinite(s.x) && Math.max(s.x, s.z) <= 80 && big < 2 && !(s.y < 0.3 && b.max.y < 0.35)) obst.push({ o, b, s: s.clone() });
    }
    for (const c of o.children) visit(c);
  };
  visit(scene);
  Object.assign(facadeStats, { n: mine.length, scan: performance.now() - t0, probe: 0, geometry: 0, material: 0, avoidCalls: 0 });
  for (const m of mine) {
    try { buildFacade(m, obst, fac); } catch (e) { console.warn('kit: facade upgrade failed, keeping the plain box', e); }
  }
  facadeStats.total = performance.now() - t0;
  return facadeStats.total;
}
const FACE_DIRS = [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0]];   // building front (+z), right (+x), back, left
const _v = new THREE.Vector3(), _q = new THREE.Box3();
function buildFacade(m, obst, fac) {
  const tb = performance.now();
  const ud = m.userData.rzFacadeBox, { w, h, d } = ud;
  const self = facadeAABB(m), M = m.matrixWorld, R3 = new THREE.Matrix3().setFromMatrix4(M);
  // probe slab in front of a local face direction k: out from the face by [o0, o1], across `span` of its width, y [y0, y1]
  const probe = (k, o0, o1, y0, y1, span = 0.9) => {
    const [dx, , dz] = FACE_DIRS[k], half = (dx ? d : w) / 2 * span, ext = (dx ? w : d) / 2;
    const c = new THREE.Vector3(dx * (ext + (o0 + o1) / 2), -h / 2 + (y0 + y1) / 2, dz * (ext + (o0 + o1) / 2));
    const e = new THREE.Vector3(dx ? (o1 - o0) / 2 : half, (y1 - y0) / 2, dz ? (o1 - o0) / 2 : half);
    _q.min.copy(c).sub(e); _q.max.copy(c).add(e);
    return _q.clone().applyMatrix4(M);
  };
  const along = (k) => { const [dx, , dz] = FACE_DIRS[k]; return _v.set(dz ? 1 : 0, 0, dx ? 1 : 0).applyMatrix3(R3).normalize().clone(); };
  const coverage = (k, box, list) => {   // fraction of the face's width covered by boxes in `list` overlapping `box`
    const a = along(k), segs = [];
    const fc = self.getCenter(new THREE.Vector3()), L = (FACE_DIRS[k][0] ? d : w);
    for (const it of list) {
      if (it.o === m || !it.b.intersectsBox(box)) continue;
      const lo = Math.max(-L / 2, Math.min(it.b.min.clone().sub(fc).dot(a), it.b.max.clone().sub(fc).dot(a))), hi = Math.min(L / 2, Math.max(it.b.min.clone().sub(fc).dot(a), it.b.max.clone().sub(fc).dot(a)));
      if (hi > lo) segs.push([lo, hi]);
    }
    segs.sort((p, q) => p[0] - q[0]); let cov = 0, cur = -Infinity;
    for (const [lo, hi] of segs) { if (hi <= cur) continue; cov += hi - Math.max(lo, cur); cur = hi; }
    return cov / L;
  };
  const info = [0, 1, 2, 3].map(k => {
    const party = coverage(k, probe(k, 0.02, 0.6, 0.5, Math.min(h - 0.5, 12)), fac) > 0.5;
    const dressed = !ud.far && coverage(k, probe(k, -0.05, 1.3, 0.3, 5.2), obst.filter(it => Math.max(it.s.x, it.s.z) > 1.8)) > 0.3;
    const street = obst.reduce((n, it) => n + (it.b.intersectsBox(probe(k, 0, 12, 0, 8)) ? 1 : 0), 0);
    return { party, dressed, street };
  });
  // the main (street) face becomes the building's front: most scene dressing in front of it, open, longest
  let main = 0, best = -1;
  info.forEach((f, k) => { const sc = (f.party ? -1000 : 0) + f.street * 10 + (FACE_DIRS[k][0] ? d : w) * 0.01; if (sc > best) { best = sc; main = k; } });
  const yaw = [0, Math.PI / 2, Math.PI, -Math.PI / 2][main];
  const width = FACE_DIRS[main][0] ? d : w, depth = FACE_DIRS[main][0] ? w : d;
  // building-local face j (front, right, back, left) -> box face index (FACE_DIRS[k] = R_y(k * 90 deg) * +z)
  const toBox = j => (main + j) % 4;
  const r = rng((ud.seed + 1) * 7919 + Math.round(self.min.x * 13 + self.min.z * 7 + h * 3));
  const glass = ud.style === 'glass' || ud.far;
  const wall = glass ? (r() < 0.75 ? 'panel' : 'concrete') : ['concrete', 'darkBrick', 'brick', 'panel', 'plaster', 'darkBrick'][Math.floor(r() * 6)];
  const faces = [0, 1, 2, 3].map(j => { const f = info[toBox(j)]; return f.party ? 'blank' : (j === 0 && !ud.far ? 'shop' : 'windows'); });
  const groundBlank = [0, 1, 2, 3].map(j => info[toBox(j)].dressed);
  const pad = 0.04;
  const avoid = (mn, mx) => {
    facadeStats.avoidCalls++;
    _q.min.copy(mn).addScalar(-pad); _q.max.copy(mx).addScalar(pad);
    for (const it of obst) if (it.b.intersectsBox(_q)) return true;
    for (const it of fac) if (it.o !== m && it.b.intersectsBox(_q)) return true;
    return false;
  };
  // building-local avoid: the builder hands world AABBs relative to its own frame, which is the box's local frame
  const avoidLocal = (mn, mx) => {
    const b = new THREE.Box3(mn, mx).applyMatrix4(M);
    return avoid(b.min, b.max);
  };
  const tall = h > 60, low = RZ.getQuality() !== 'high';   // phone tiers: no balusters / treads / rungs (sub-pixel there)
  const o = {
    width, depth, height: h, base: -h / 2, yaw, seed: ud.seed * 17 + Math.floor(r() * 1000), era: ud.era, wall, faces, groundBlank, avoid: avoidLocal,
    detail: low || ud.far ? 'low' : 'high', groundLedge: !groundBlank[0],
  };
  if (glass) Object.assign(o, { floorHeight: 3.5 + r() * 0.4, bay: 2.6 + r() * 0.8, windowWidth: undefined, mullion: 3, ledges: 0, balconies: 0, cornice: false, fireEscape: false });
  if (glass) { const bay = o.bay; o.windowWidth = bay * 0.86; o.windowHeight = o.floorHeight * 0.74; o.sill = o.floorHeight * 0.13; }
  if (ud.far) Object.assign(o, { ac: 0, pipes: 0, holo: tall ? 0 : (r() < 0.3 ? 1 : 0), cables: 0, roof: { bulkhead: r() < 0.5, hvac: 1, tank: false, antenna: r() < 0.5 ? 1 : 0, billboard: false, dish: false } });
  const tg = performance.now(); facadeStats.probe += tg - tb;
  const geo = RZ.facadeGeometry(o);
  const tm = performance.now(); facadeStats.geometry += tm - tg;   // includes the avoid() tests
  ud.legacyGeo = m.geometry; ud.geo = geo;   // the plain box is kept for A/B captures (setInfraLegacy)
  m.geometry = geo;
  m.material = ud.mat = RZ.windowInteriorMaterial({ lit: 0.42, daylight: 0, interior: 1.25 });
  facadeStats.material += performance.now() - tm;
  ud.built = true; ud.info = { faces, groundBlank, main, wall, triangles: geo.index.count / 3 };
}

/**
 * A/B switch for captures and cost measurements: legacy = true shows the scene's upgraded kit objects as they were
 * before the infrastructure upgrade (plain facade boxes with the mission's material, no masonry, legacy lamp posts),
 * false shows the upgrade again. Returns the number of objects switched.
 */
export function setInfraLegacy(scene, legacy) {
  let n = 0; const swaps = [];
  scene.traverse(o => {
    const f = o.userData.rzFacadeBox;
    if (f && f.built) { o.geometry = legacy ? f.legacyGeo : f.geo; o.material = legacy ? f.legacy : f.mat; n++; }
    if (o.userData.rzMasonry) { o.userData.rzMasonry.visible = !legacy; n++; }
    if (o.userData.rzSwap) swaps.push(o);
  });
  for (const o of swaps) { o.userData.rzSwap(legacy); n++; }
  return n;
}

// Masonry detail for house-sized stone boxes (m.userData.rzMasonry = the child group).
let woodMat = null;
function masonry(m, w, h, d, mat) {
  const stone = [], wood = [], add = (list, sx, sy, sz, x, y, z) => { const g = new THREE.BoxGeometry(sx, sy, sz); worldUV(g, sx, sy, sz); g.translate(x, y, z); list.push(g); };
  const hw = w / 2, hd = d / 2, y0 = -h / 2;
  add(stone, w + 0.1, 0.36, d + 0.1, 0, y0 + 0.18, 0);   // plinth course
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (let y = 0.4, k = 0; y < h - 0.5; y += 0.44, k++) {   // quoins
    const lx = k % 2 ? 0.5 : 0.32, lz = k % 2 ? 0.32 : 0.5;
    add(stone, lx, 0.4, lz, sx * (hw - lx / 2 + 0.03), y0 + y + 0.2, sz * (hd - lz / 2 + 0.03));
  }
  add(wood, w + 0.12, 0.16, d + 0.12, 0, y0 + h - 0.08, 0);   // timber wall plate under the roof
  if (Math.max(w, d) < 9) {
    const longX = w >= d, n = Math.max(3, Math.round((longX ? w : d) / 0.85));
    for (let i = 0; i < n; i++) {
      const t = -0.5 + (i + 0.5) / n;
      for (const s of [-1, 1]) {
        if (longX) add(wood, 0.15, 0.15, 0.42, t * (w - 0.5), y0 + h - 0.32, s * (hd + 0.14)); else add(wood, 0.42, 0.15, 0.15, s * (hw + 0.14), y0 + h - 0.32, t * (d - 0.5));
      }
    }
  }
  const grp = new THREE.Group(); grp.name = 'masonry';
  const sm = new THREE.Mesh(mergeGeometries(stone), mat); sm.castShadow = m.castShadow; sm.receiveShadow = true;
  if (!woodMat) woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3322, map: woodTexture(), roughness: 0.88, metalness: 0 });
  const wm = new THREE.Mesh(mergeGeometries(wood), woodMat); wm.castShadow = m.castShadow; wm.receiveShadow = true;
  grp.add(sm, wm); m.add(grp); m.userData.rzMasonry = grp;
}
// box uvs in meters / 3 (close to the repeat the missions give their stone textures on house walls)
function worldUV(g, sx, sy, sz) {
  const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const su = ax > 0.5 ? sz : sx, sv = ay > 0.5 ? sz : sy;
    uv.setXY(i, uv.getX(i) * su / 3, uv.getY(i) * sv / 3);
  }
}
function woodTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const r = rng(77); g.fillStyle = '#6e5038'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${40 + r() * 30},${25 + r() * 20},${12 + r() * 10},${0.25 + r() * 0.3})`; g.fillRect(0, y, w, 1 + r() * 2); }
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(20,12,6,0.35)'; g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 5, 1.5, 0, 0, 7); g.fill(); }
  }, 'kitWood', { repeat: [1, 1] });
}

export function glowMat(color, intensity = 3) { return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(color), emissiveIntensity: intensity }); }

// Fake reflection streak on wet ground beneath a light source
export function puddleGlow(color, w = 1.2, l = 6, opacity = 0.35) {
  const tex = canvasTex(64, 256, (g, W, H) => {
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const gx = g.createLinearGradient(0, 0, W, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, W, H);
  }, 'puddle');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
}

// Black stone ring with glowing runes: the Chronolith
export function chronolith(scale = 1, opts = {}) {
  const g = new THREE.Group();
  const stone = new THREE.MeshPhysicalMaterial({ color: opts.stone || 0x0b0c0f, roughness: 0.25, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.2 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.42, 24, 96), stone); ring.castShadow = true; g.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.08, 12, 96), glowMat(opts.color || 0x5fe6ff, 2.5)); g.add(inner);
  const runes = new THREE.Group();
  const runeTex = canvasTex(1024, 64, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 3; const r = rng(11);
    for (let x = 10; x < w; x += 26) { c.beginPath(); for (let k = 0; k < 4; k++) { const px = x + r() * 16, py = 12 + r() * 40; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); if (r() < 0.4) { c.beginPath(); c.arc(x + 8, 32, 6, 0, 7); c.stroke(); } }
  }, 'runes');
  runeTex.wrapS = THREE.RepeatWrapping; runeTex.repeat.set(3, 1);
  const runeBand = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 96, 1, true), new THREE.MeshBasicMaterial({ map: runeTex, color: new THREE.Color(opts.color || 0x5fe6ff).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  runeBand.rotation.x = Math.PI / 2; runeBand.scale.set(1.0, 1, 1.0); runes.add(runeBand); g.add(runes);
  // event horizon disc
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.85, 64), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(opts.color || 0x5fe6ff) }, uPower: { value: opts.power ?? 0.4 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime,uPower; uniform vec3 uColor; varying vec2 vUv;
      void main(){ vec2 c=vUv-0.5; float r=length(c)*2.0; float a=atan(c.y,c.x);
        float sw=sin(a*6.0+r*14.0-uTime*2.5)*0.5+0.5; float core=smoothstep(1.0,0.0,r);
        float rings=sin(r*40.0-uTime*4.0)*0.5+0.5;
        vec3 col=uColor*(sw*0.6+rings*0.3)*core*uPower*2.0 + vec3(1.0)*pow(core,6.0)*uPower;
        gl_FragColor=vec4(col, (core*0.85)*uPower); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  g.add(disc);
  // floating halo fragments ("broken halos")
  const frags = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.TorusGeometry(3.1 + i * 0.45, 0.04, 6, 80, Math.PI * (0.6 + i * 0.3)), glowMat(opts.color || 0x5fe6ff, 1.2 + i * 0.3));
    f.rotation.set(Math.random() * 3, Math.random() * 3, 0); frags.add(f);
  }
  g.add(frags);
  g.scale.setScalar(scale);
  g.userData = { disc, runes, frags, inner, update(t) { disc.material.uniforms.uTime.value = t; runeTex.offset.x = t * 0.02; frags.children.forEach((f, i) => { f.rotation.x += 0.003 * (i + 1); f.rotation.y += 0.002 * (i + 1); }); } };
  return g;
}

export function cableCurve(points, radius = 0.05, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 8, false), mat || new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
  m.castShadow = true; return m;
}
