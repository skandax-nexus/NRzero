import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Character } from '../core/character.js';
import { glowMat, canvasTex, rng, infraOn } from './kit.js';
import * as RZ from './realism.js';

// Ambient pedestrian walking back and forth along a lane.
export class Walker {
  constructor(game, look, lane) {
    this.c = new Character({ ...look, lod: true, shadows: false });
    this.lane = lane; // {x, z0, z1, speed}
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.z = lane.z0 + Math.random() * (lane.z1 - lane.z0);
    this.speed = lane.speed ?? (0.9 + Math.random() * 0.6);
    this.c.root.position.set(lane.x + (Math.random() - 0.5) * 0.8, lane.y || 0, this.z);
    game.scene.add(this.c.root);
    this.idle = lane.idle || false;
    if (this.idle) this.c.root.rotation.y = lane.ry ?? Math.random() * 6;
  }
  update(dt) {
    if (this.c.frozen) return;
    if (!this.idle) {
      this.z += this.dir * this.speed * dt;
      if (this.z > Math.max(this.lane.z0, this.lane.z1)) this.dir = -1;
      if (this.z < Math.min(this.lane.z0, this.lane.z1)) this.dir = 1;
      this.c.root.position.z = this.z;
      this.c.root.rotation.y = this.dir > 0 ? 0 : Math.PI;
      this.c.speed = this.speed;
    } else this.c.speed = 0;
    this.c.update(dt);
  }
}

export function trainCar(len = 16, livery = 0xe9edf2, accent = 0x2ae6ff) {
  const g = new THREE.Group();
  const body = new THREE.MeshPhysicalMaterial({ color: livery, metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.3, metalness: 0.5 });
  const shell = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, len - 3, 6, 16), body);
  shell.rotation.x = Math.PI / 2; shell.scale.set(1, 1, 1.15); shell.position.y = 2.0; shell.castShadow = true; g.add(shell);
  const win = new THREE.Mesh(new THREE.BoxGeometry(3.08, 0.8, len - 3), new THREE.MeshStandardMaterial({ color: 0x1a2028, emissive: 0xffe9c8, emissiveIntensity: 1.3, roughness: 0.1 }));
  win.position.y = 2.4; g.add(win);
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, len - 2), glowMat(accent, 4)); strip.position.set(s * 1.55, 1.5, 0); g.add(strip);
  }
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, len - 2), dark); skirt.position.y = 0.6; g.add(skirt);
  g.userData.len = len;
  return g;
}
export function trainNose(accent = 0x2ae6ff) {
  const g = new THREE.Group();
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), glowMat(0xffffff, 8)); lamp.position.set(-0.8, 1.5, 0); g.add(lamp);
  const lamp2 = lamp.clone(); lamp2.position.x = 0.8; g.add(lamp2);
  const sp = new THREE.SpotLight(0xdff4ff, 60, 60, 0.5, 0.6, 1.4); sp.position.set(0, 1.6, 0); sp.target.position.set(0, 0, 10); g.add(sp, sp.target);
  return g;
}

// Street light (same signature and placement as before: pole at the origin, arm reaching along +z, lens at the end).
// Rebuilt for stage 4: base plinth, tapered pole with an access hatch, curved bracket arm, luminaire housing with a lit
// lens and a soft glow card cross (visible without bloom on the low tier). Materials are shared by every lamp, so the
// engine merges a street's lamps into three draws. opts.era: '2049' adds a cyan LED strip; ?infra=nolamp = legacy.
const LAMP_MATS = new Map();
function lampMat(kind, color, intensity) {
  const key = kind + color + '|' + intensity;
  if (!LAMP_MATS.has(key)) { const m = streetMaterials('2049')[kind].clone(); m.color.set(color).multiplyScalar(intensity); LAMP_MATS.set(key, m); }
  return LAMP_MATS.get(key);
}
export function lampPost(color = 0xffd9a8, h = 6.5, opts = {}) {
  if (!infraOn('lamp')) return legacyLamp(color, h);
  const g = new THREE.Group(); g.name = 'lampPost';
  const build = () => {
    const M = streetMaterials('2049');
    for (const part of partsOf('lamp', '2049', { height: h, color, accent: opts.era === '2049' ? (opts.accent ?? 0x2ae6ff) : null })) {
      const mat = part.mat === 'emissive' || part.mat === 'halo' ? lampMat(part.mat, part.color, part.intensity) : M[part.mat];
      const m = new THREE.Mesh(part.geo, mat); m.castShadow = part.mat === 'metal'; m.receiveShadow = part.mat === 'metal'; g.add(m);
    }
  };
  build();
  g.userData.contactShadow = { radius: 0.3, scale: 0.8 };   // the engine's contact shadows ground the pole (docs/RENDERING.md)
  // A/B (kit.setInfraLegacy): swap the children for the pre-upgrade lamp and back
  g.userData.rzSwap = (legacy) => { g.clear(); if (legacy) { const l = legacyLamp(color, h); for (const c of [...l.children]) g.add(c); } else build(); };
  return g;
}
function legacyLamp(color, h) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.8, roughness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, h, 10), metal); pole.position.y = h / 2; pole.castShadow = true; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), metal); arm.position.set(0, h - 0.1, 0.7); g.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.7), glowMat(color, 5)); head.position.set(0, h - 0.17, 1.3); g.add(head);
  g.userData.contactShadow = { radius: 0.3, scale: 0.8 };   // the engine's contact shadows ground the pole (docs/RENDERING.md)
  return g;
}

// Security drone with a vision cone. Patrols waypoints, detects player in cone with line-of-sight.
export class Drone {
  constructor(game, path, opts = {}) {
    this.game = game; this.path = path.map(p => new THREE.Vector3(...p)); this.i = 0; this.speed = opts.speed || 1.6;
    this.range = opts.range || 8; this.fov = opts.fov || 0.42; this.alert = 0; this.wait = 0; this.disabled = false;
    const g = this.mesh = new THREE.Group();
    const shellM = new THREE.MeshPhysicalMaterial({ color: 0x2a2f36, metalness: 0.8, roughness: 0.3, clearcoat: 1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), shellM); body.scale.set(1, 0.7, 1.2); body.castShadow = true; g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), shellM); ring.rotation.x = Math.PI / 2; g.add(ring);
    this.eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), glowMat(0xff3344, 6)); this.eye.position.set(0, -0.02, 0.36); g.add(this.eye);
    for (const s of [-1, 1]) { const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16), new THREE.MeshBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.25 })); rotor.position.set(s * 0.5, 0.12, 0); g.add(rotor); }
    // cone
    const coneGeo = new THREE.ConeGeometry(Math.tan(this.fov) * this.range, this.range, 32, 1, true);
    coneGeo.translate(0, -this.range / 2, 0); coneGeo.rotateX(-Math.PI / 2 + 0.35);
    this.coneMat = new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.cone = new THREE.Mesh(coneGeo, this.coneMat); this.cone.position.z = 0.3; g.add(this.cone);
    // a cheap floor pool instead of a real spotlight keeps the light count low
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; this.pool = pool; game.scene.add(pool);
    this.light = { visible: true, color: new THREE.Color() };
    g.position.copy(this.path[0]); game.scene.add(g);
    this.t = Math.random() * 10;
  }
  update(dt) {
    this.t += dt; const g = this.mesh, p = this.game.player;
    g.position.y = this.path[0].y + Math.sin(this.t * 2) * 0.08;
    this.pool.position.set(g.position.x + Math.sin(g.rotation.y) * 6, 0.03, g.position.z + Math.cos(g.rotation.y) * 6); this.pool.visible = !this.disabled && g.visible;
    if (this.disabled) { this.cone.visible = false; this.light.visible = false; this.eye.material.emissiveIntensity = 0.3; return 0; }
    // movement
    if (this.wait > 0) { this.wait -= dt; g.rotation.y += Math.sin(this.t * 1.2) * dt * 0.8; }
    else {
      const tgt = this.path[(this.i + 1) % this.path.length]; const d = new THREE.Vector3(tgt.x - g.position.x, 0, tgt.z - g.position.z);
      const dist = d.length();
      if (dist < 0.1) { this.i = (this.i + 1) % this.path.length; this.wait = 1.6; }
      else {
        d.normalize(); const sp = this.speed * (this.alert > 0.3 ? 0.3 : 1);
        g.position.x += d.x * Math.min(dist, sp * dt); g.position.z += d.z * Math.min(dist, sp * dt);
        const yaw = Math.atan2(d.x, d.z); let dy = yaw - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * Math.min(1, dt * 4);
      }
    }
    // detection
    const pp = p.pos.clone(); pp.y += p.crouching ? 0.7 : 1.2;
    const to = pp.clone().sub(g.position); const dist = to.length();
    const fwd = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
    const flat = to.clone().setY(0).normalize();
    const ang = Math.acos(Math.max(-1, Math.min(1, flat.dot(fwd))));
    const range = this.range * (p.crouching ? 0.62 : 1);
    let seen = dist < range && ang < this.fov * 1.25 && !this.game.collision.blocked(g.position, pp, 1.0, this.game.temporal.current);
    if (this.game.residueOn) seen = seen && dist < range * 0.9;
    this.alert = Math.max(0, Math.min(1.2, this.alert + (seen ? dt * (1.6 - dist / range) * 1.2 : -dt * 0.5)));
    const a = Math.min(1, this.alert);
    this.coneMat.opacity = 0.06 + a * 0.12; this.coneMat.color.setRGB(1, 0.2 + (1 - a) * 0.5, 0.25 + (1 - a) * 0.3);
    this.light.color.copy(this.coneMat.color);
    if (seen) { const yaw = Math.atan2(to.x, to.z); let dy = yaw - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * Math.min(1, dt * 2 * a); }
    return this.alert;
  }
}

// Diegetic animated screen texture
export function screenTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const g = c.getContext('2d');
  tex.userData.redraw = (t) => { draw(g, w, h, t); tex.needsUpdate = true; };
  tex.userData.redraw(0);
  return tex;
}

export function sparks(count = 120, color = 0xffb060) {
  const pos = new Float32Array(count * 3), vel = [];
  for (let i = 0; i < count; i++) vel.push(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tex = canvasTex(32, 32, (c) => { const grd = c.createRadialGradient(16, 16, 0, 16, 16, 16); grd.addColorStop(0, '#fff'); grd.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = grd; c.fillRect(0, 0, 32, 32); }, 'spark');
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.12, map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false;
  pts.userData = { vel, life: 0, frozen: false, origin: new THREE.Vector3(),
    burst(o) { this.origin.copy(o); this.life = 1.5; for (let i = 0; i < count; i++) { pos.set([o.x, o.y, o.z], i * 3); vel[i].set((Math.random() - 0.5) * 7, Math.random() * 6, (Math.random() - 0.5) * 7); } g.attributes.position.needsUpdate = true; pts.visible = true; },
    update(dt) { if (this.frozen || this.life <= 0) return; this.life -= dt; for (let i = 0; i < count; i++) { vel[i].y -= 9.8 * dt; pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt; } g.attributes.position.needsUpdate = true; if (this.life <= 0) pts.visible = false; } };
  pts.visible = false;
  return pts;
}

// =====================================================================================
// Street infrastructure kit (docs/MISSION_GUIDE.md "Infrastructure kit", docs/RENDERING.md stage 4)
// =====================================================================================
// Every prop is a set of parts (one merged geometry per material) shared by all copies, so a street of any length is a
// handful of InstancedMesh draws per 48 m cell; small props get a cull distance the engine applies per tier.
//   const k = streetKit({ era: '2049', seed: 4 });
//   k.kerb([[6, 20], [6, -90]]); k.lamps([[6.5, 0.15, 18], ...], { yaw: -Math.PI / 2 }); k.bollards(...); k.car([x, 0, z], yaw)
//   scene.add(k.build());  k.colliders -> [{ min: [x,y,z], max: [x,y,z] }] (or k.collide(game))
// Eras: '2026' (contemporary), '2049' (Rain City: dark metal, LED accents, holo kiosks, near-future cars, scooters),
// '2196' (ruined: rust, broken lamps, wrecks, tilt), 'ancient' (wattle fences, wells, carts, stalls, pots, barrels).

const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _s4 = new THREE.Vector3(1, 1, 1), _p4 = new THREE.Vector3();
const G = {
  box: (sx, sy, sz, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z),
  cyl: (rt, rb, h, seg, x = 0, y = 0, z = 0) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z),
  rot: (g, rx, ry, rz) => g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))),
  tube: (pts, r, seg = 6, tub = 16) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), tub, r, seg, false),
  merge: list => {
    const ok = list.filter(Boolean);
    for (const g of ok) {
      if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    }
    return ok.length === 1 ? ok[0] : mergeGeometries(ok);
  },
};
const radialTex = (key, inner = 0.25) => canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(inner, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }, key);

// ---------- shared materials (cached per era) ----------
const SMAT = new Map();
function streetMaterials(era = '2049') {
  if (SMAT.has(era)) return SMAT.get(era);
  const ruin = era === '2196', anc = era === 'ancient';
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    metal: std({ color: ruin ? 0x4a3628 : era === '2026' ? 0x3a3f46 : 0x1f2328, metalness: ruin ? 0.35 : 0.75, roughness: ruin ? 0.85 : 0.42 }),
    painted: std({ color: ruin ? 0x5a4a3a : era === '2026' ? 0x2c4a3a : 0x2a2f36, metalness: 0.3, roughness: 0.55 }),
    steel: std({ color: ruin ? 0x5c4434 : 0x9aa0a8, metalness: 1, roughness: ruin ? 0.8 : 0.28 }),
    rubber: std({ color: 0x0d0d0f, metalness: 0, roughness: 0.92 }),
    concrete: std({ color: ruin ? 0x5d5a52 : 0x7b7c7d, map: concreteTex(), metalness: 0, roughness: 0.9 }),
    kerb: std({ color: 0xffffff, vertexColors: true, map: concreteTex(), metalness: 0, roughness: 0.82 }),
    wood: std({ color: anc ? 0x6b4a2e : 0x7a5434, map: woodTex(), metalness: 0, roughness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9fb8c8, metalness: 0, roughness: 0.04, transparent: true, opacity: ruin ? 0.12 : 0.22, depthWrite: false, side: THREE.DoubleSide }),
    carGlass: std({ color: 0x06090c, metalness: 0.6, roughness: ruin ? 0.6 : 0.06 }),
    paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: ruin ? 0.1 : 0.5, roughness: ruin ? 0.8 : 0.3, clearcoat: ruin ? 0 : 1, clearcoatRoughness: 0.12 }),
    grate: std({ color: 0x2a2a2c, map: grateTex(), metalness: 0.7, roughness: 0.6 }),
    manhole: std({ color: 0x3a3a3c, map: manholeTex(), metalness: 0.7, roughness: 0.55 }),
    emissive: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),   // * instanceColor: lenses, LEDs, screens
    halo: new THREE.MeshBasicMaterial({ color: 0xffffff, map: radialTex('streetHalo'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }),
    screen: new THREE.MeshBasicMaterial({ map: adTex(), color: new THREE.Color(1.4, 1.4, 1.4), toneMapped: false }),
    vend: new THREE.MeshBasicMaterial({ map: vendTex(), color: new THREE.Color(1.3, 1.3, 1.3), toneMapped: false }),
    puddle: std({ color: 0x050607, metalness: 0, roughness: 0.04, transparent: true, alphaMap: radialTex('puddleA', 0.6), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    straw: std({ color: 0xa58552, metalness: 0, roughness: 0.95 }),
    stone: std({ color: 0x9a8a72, map: concreteTex(), metalness: 0, roughness: 0.92 }),
    pottery: std({ color: 0x9a5a36, metalness: 0, roughness: 0.75 }),
    cloth: std({ color: 0xffffff, metalness: 0, roughness: 0.9, side: THREE.DoubleSide }),   // * instanceColor: awnings of stalls
  };
  for (const k in M) M[k].userData.rzStreet = k;
  SMAT.set(era, M);
  return M;
}
function concreteTex() {
  return canvasTex(256, 256, (g, w, h) => { const r = rng(91); g.fillStyle = '#9a9a98'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 120 + r() * 70; g.fillStyle = `rgba(${v},${v},${v - 4},0.25)`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(40,40,36,0.12)'; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 40, 10 + r() * 30, r() * 3, 0, 7); g.fill(); } }, 'streetConc', { repeat: [1, 1] });
}
function woodTex() {
  return canvasTex(128, 128, (g, w, h) => { const r = rng(17); g.fillStyle = '#8a6440'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${50 + r() * 40},${30 + r() * 25},${14 + r() * 10},${0.2 + r() * 0.3})`; g.fillRect(0, y, w, 1 + r() * 2); } }, 'streetWood', { repeat: [1, 1] });
}
function grateTex() {
  return canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#5a5a5c'; g.fillRect(0, 0, w, h); g.fillStyle = '#050505'; for (let x = 8; x < w - 6; x += 9) g.fillRect(x, 6, 5, h - 12); g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); }, 'streetGrate');
}
function manholeTex() {
  return canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#4a4a4c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1a1a1a'; g.lineWidth = 2; for (let r = 14; r < 62; r += 8) { g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke(); } for (let a = 0; a < 12; a++) { g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a / 6 * Math.PI) * 60, 64 + Math.sin(a / 6 * Math.PI) * 60); g.stroke(); } g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 61, 0, 7); g.stroke(); }, 'streetManhole');
}
function adTex() {
  return canvasTex(512, 256, (g, w, h) => {
    const ads = [['#0a2a3a', '#5fe6ff', 'HELIX'], ['#2a0a24', '#ff4fa8', 'NOVA'], ['#1a1a08', '#ffd34a', 'KAFE 24'], ['#081a12', '#3aff9a', 'TRANSIT']];
    ads.forEach(([bg, fg, t], i) => { const x = (i % 2) * 256, y = Math.floor(i / 2) * 128; const grd = g.createLinearGradient(x, y, x + 256, y + 128); grd.addColorStop(0, bg); grd.addColorStop(1, '#000'); g.fillStyle = grd; g.fillRect(x, y, 256, 128); g.fillStyle = fg; g.font = '700 40px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillText(t, x + 128, y + 76); g.globalAlpha = 0.35; g.fillRect(x + 30, y + 92, 196, 4); g.globalAlpha = 1; });
  }, 'streetAds');
}
function vendTex() {
  return canvasTex(128, 256, (g, w, h) => { const r = rng(5); g.fillStyle = '#10161c'; g.fillRect(0, 0, w, h); for (let row = 0; row < 6; row++) for (let c = 0; c < 4; c++) { g.fillStyle = `hsl(${r() * 360},70%,${45 + r() * 20}%)`; g.fillRect(10 + c * 28, 14 + row * 30, 18, 24); } g.fillStyle = '#e8f4ff'; g.fillRect(10, 200, 108, 14); g.fillStyle = '#5fe6ff'; g.fillRect(10, 224, 60, 18); }, 'streetVend');
}

// ---------- prop part library: each kind -> [{ mat, geo, color? }] in prop-local space (+z forward, y up) ----------
const PARTS = new Map();
function partsOf(kind, era, o = {}) {
  const key = kind + '|' + era + '|' + JSON.stringify(o);
  if (PARTS.has(key)) return PARTS.get(key);
  const ruin = era === '2196', e49 = era === '2049', P = [];
  const add = (mat, geos, extra) => P.push({ mat, geo: G.merge([].concat(geos)), ...extra });
  switch (kind) {
    case 'lamp': {   // street light: base, tapered pole, bracket arm, luminaire housing, lit lens, glow halo
      const h = o.height ?? 6.5, reach = o.reach ?? 1.3;
      const metal = [G.cyl(0.16, 0.18, 0.5, 12, 0, 0.25, 0), G.cyl(0.13, 0.16, 0.06, 12, 0, 0.53, 0), G.cyl(0.06, 0.095, h - 0.6, 12, 0, 0.56 + (h - 0.6) / 2, 0), G.box(0.07, 0.3, 0.025, 0, 1.1, 0.088)];
      metal.push(G.tube([[0, h - 0.55, 0], [0, h - 0.12, 0.25], [0, h - 0.05, reach * 0.6], [0, h - 0.07, reach]], 0.04, 6, 10));
      metal.push(G.box(0.34, 0.09, 0.72, 0, h - 0.11, reach + 0.12), G.box(0.3, 0.05, 0.2, 0, h - 0.04, reach - 0.18));
      add('metal', metal);
      if (!ruin) {
        add('emissive', G.box(0.26, 0.012, 0.58, 0, h - 0.162, reach + 0.12), { color: o.color ?? 0xffd9a8, intensity: o.intensity ?? 4.5 });
        // soft glow card cross under the lens (the low tier has no bloom: this is what tells a lit lamp from a dark bar)
        const hy = h - 0.24, hz = reach + 0.12;
        add('halo', [G.rot(new THREE.PlaneGeometry(1.3, 1.3), Math.PI / 2, 0, 0).translate(0, hy, hz), new THREE.PlaneGeometry(1.1, 0.8).translate(0, hy, hz), G.rot(new THREE.PlaneGeometry(1.1, 0.8), 0, Math.PI / 2, 0).translate(0, hy, hz)], { color: o.color ?? 0xffd9a8, intensity: 0.5 });
        if (e49 && o.accent !== null) add('emissive', G.box(0.02, 1.2, 0.02, 0, 2.4, 0.075), { color: o.accent ?? 0x2ae6ff, intensity: 2.5 });
      }
      break;
    }
    case 'bollard': {
      add('metal', [G.cyl(0.09, 0.1, 0.9, 12, 0, 0.45, 0), G.cyl(0.1, 0.1, 0.04, 12, 0, 0.92, 0)]);
      if (e49) add('emissive', G.cyl(0.095, 0.095, 0.05, 12, 0, 0.78, 0), { color: o.color ?? 0x2ae6ff, intensity: 2 });
      else add('steel', G.cyl(0.097, 0.097, 0.06, 12, 0, 0.78, 0));
      break;
    }
    case 'bin': {
      add('painted', [G.cyl(0.26, 0.24, 0.85, 14, 0, 0.425, 0), G.cyl(0.28, 0.28, 0.05, 14, 0, 0.87, 0)]);
      add('metal', [G.cyl(0.04, 0.04, 0.2, 6, 0, 0.98, 0), G.box(0.24, 0.04, 0.02, 0, 0.75, 0.255), G.cyl(0.03, 0.03, 0.9, 6, 0.32, 0.45, 0)]);
      break;
    }
    case 'bench': {
      const wood = [], metal = [];
      for (let i = 0; i < 4; i++) wood.push(G.box(1.7, 0.035, 0.09, 0, 0.46, -0.16 + i * 0.105));
      for (let i = 0; i < 3; i++) wood.push(G.rot(G.box(1.7, 0.09, 0.035), -0.25, 0, 0).translate(0, 0.62 + i * 0.12, -0.24 - i * 0.03));
      for (const x of [-0.7, 0.7]) metal.push(G.box(0.05, 0.44, 0.05, x, 0.22, 0.13), G.box(0.05, 0.44, 0.05, x, 0.22, -0.18), G.box(0.05, 0.05, 0.42, x, 0.43, -0.02), G.rot(G.box(0.05, 0.45, 0.05), -0.25, 0, 0).translate(x, 0.68, -0.27));
      add(e49 ? 'metal' : 'wood', wood); add('metal', metal);
      break;
    }
    case 'drain': {   // kerb-side grate (flush with the road)
      add('grate', G.rot(new THREE.PlaneGeometry(0.9, 0.45), -Math.PI / 2, 0, 0).translate(0, 0.008, 0));
      break;
    }
    case 'manhole': {
      add('manhole', G.cyl(0.36, 0.36, 0.016, 20, 0, 0.004, 0));
      break;
    }
    case 'trafficLight': {   // pole + mast arm over the road with a signal head; lenses lit by state (instanceColor)
      const arm = o.arm ?? 4.5, h = 5.6;
      add('metal', [G.cyl(0.11, 0.13, h, 12, 0, h / 2, 0), G.cyl(0.18, 0.2, 0.4, 12, 0, 0.2, 0), G.rot(G.cyl(0.06, 0.07, arm, 8), 0, 0, Math.PI / 2).translate(-arm / 2, h - 0.3, 0),
        G.box(0.36, 1.05, 0.26, -arm + 0.4, h - 0.85, 0.02), G.box(0.3, 0.86, 0.22, 0, 2.75, 0.2), G.box(0.06, 0.4, 0.06, 0, 2.9, 0.06)]);
      for (let k = 0; k < 3; k++) for (const [x, y, z] of [[-arm + 0.4, h - 0.53 - k * 0.32, 0.16], [0, 3.0 - k * 0.25, 0.32]]) {
        const lens = new THREE.CircleGeometry(x === 0 ? 0.08 : 0.11, 14).translate(x, y, z);
        add('emissive', lens, { color: [0xff2a1a, 0xffb020, 0x30ff70][k], intensity: 0.12, lensIndex: k });
      }
      break;
    }
    case 'shelter': {   // bus / tram stop: posts, roof with LED edge, glass back + sides, bench, lit ad panel, route sign
      const W = o.width ?? 4, D = 1.5, H = 2.6;
      add('metal', [G.box(0.08, H, 0.08, -W / 2, H / 2, -D / 2), G.box(0.08, H, 0.08, W / 2, H / 2, -D / 2), G.box(0.08, H, 0.08, -W / 2, H / 2, D / 2 - 0.2), G.box(0.08, H, 0.08, W / 2, H / 2, D / 2 - 0.2),
        G.box(W + 0.3, 0.12, D + 0.2, 0, H + 0.06, 0), G.box(1.5, 0.05, 0.4, -0.6, 0.46, -D / 2 + 0.3), G.box(0.06, 0.44, 0.3, -1.3, 0.22, -D / 2 + 0.3), G.box(0.06, 0.44, 0.3, 0.1, 0.22, -D / 2 + 0.3),
        G.box(1.2, 2.0, 0.12, W / 2 - 0.75, 1.15, -D / 2 + 0.06), G.cyl(0.05, 0.05, 3.2, 8, W / 2 + 0.6, 1.6, D / 2), G.box(0.5, 0.7, 0.06, W / 2 + 0.6, 2.9, D / 2)]);
      add('glass', [G.box(W - 1.4, 2.2, 0.02, -0.7, 1.2, -D / 2), G.box(0.02, 2.2, D - 0.3, -W / 2, 1.2, -0.15)]);
      const ad = G.box(1.1, 1.85, 0.02, W / 2 - 0.75, 1.15, -D / 2 + 0.13), auv = ad.attributes.uv;   // one ad of the 2 x 2 atlas
      for (let i = 0; i < auv.count; i++) auv.setXY(i, auv.getX(i) * 0.5 + (o.ad ?? 0) % 2 * 0.5, auv.getY(i) * 0.5 + 0.5 - Math.floor((o.ad ?? 0) / 2) % 2 * 0.5);
      add('screen', ad);
      add('emissive', [G.box(W + 0.3, 0.025, 0.025, 0, H + 0.0, D / 2 + 0.1), G.box(0.44, 0.5, 0.01, W / 2 + 0.6, 2.95, D / 2 + 0.035)], { color: e49 ? (o.color ?? 0x2ae6ff) : 0xf0f4ff, intensity: e49 ? 2.2 : 1.2 });
      break;
    }
    case 'kiosk': {   // vending machine (2026 / 2196) or holo kiosk (2049)
      if (e49) {
        add('metal', [G.box(0.7, 2.1, 0.5, 0, 1.05, 0), G.box(0.8, 0.08, 0.6, 0, 2.14, 0)]);
        add('vend', G.box(0.56, 1.3, 0.02, 0, 1.25, 0.26));
        add('emissive', [G.box(0.02, 2.0, 0.02, -0.36, 1.05, 0.26), G.box(0.02, 2.0, 0.02, 0.36, 1.05, 0.26)], { color: o.color ?? 0xff2a8a, intensity: 2.4 });
      } else {
        add('painted', [G.box(0.9, 1.9, 0.75, 0, 0.95, 0)]);
        add(ruin ? 'carGlass' : 'vend', G.box(0.6, 1.1, 0.02, -0.08, 1.15, 0.38));
        add('metal', [G.box(0.12, 0.3, 0.03, 0.33, 1.1, 0.385), G.box(0.6, 0.18, 0.05, -0.08, 0.35, 0.39)]);
      }
      break;
    }
    case 'railing': {   // one 2 m panel: posts, top / mid rails, balusters
      const L = o.length ?? 2, h = o.height ?? 1.05, bars = [];
      for (let i = 0; i <= Math.round(L / 0.13); i++) bars.push(G.box(0.018, h - 0.1, 0.018, -L / 2 + i * L / Math.round(L / 0.13), h / 2, 0));
      add('metal', [G.box(0.05, h, 0.05, -L / 2, h / 2, 0), G.box(L, 0.05, 0.06, 0, h, 0), G.box(L, 0.03, 0.03, 0, 0.12, 0), ...bars]);
      break;
    }
    case 'car': case 'van': case 'wreck': {   // near-future compact car / van (paint * instanceColor), glass cabin, wheels, LED light bars
      const van = kind === 'van', wreck = kind === 'wreck' || ruin;
      const L = van ? 4.9 : 4.4, Wd = van ? 1.98 : 1.84, wb = van ? 1.55 : 1.38, rw = van ? 0.36 : 0.34, yb = 0.3, ra = rw + 0.07;
      const sink = wreck ? 0.1 : 0;   // flat tyres
      // side profile (x = length, front at +x): sill with wheel arches, bumper, bonnet, beltline, rear deck
      const prof = new THREE.Shape(); const hf = L / 2, hr = -L / 2;
      prof.moveTo(hr + 0.08, yb);
      prof.lineTo(-wb - ra, yb); prof.absarc(-wb, yb, ra, Math.PI, 0, true);
      prof.lineTo(wb - ra, yb); prof.absarc(wb, yb, ra, Math.PI, 0, true);
      if (van) {
        prof.lineTo(hf - 0.06, yb); prof.quadraticCurveTo(hf + 0.06, yb + 0.05, hf + 0.04, 0.62); prof.quadraticCurveTo(hf, 0.98, hf - 0.4, 1.08);
        prof.lineTo(hr + 0.12, 1.1); prof.quadraticCurveTo(hr - 0.02, 1.08, hr - 0.02, 0.8); prof.lineTo(hr, yb + 0.06);
      } else {
        prof.lineTo(hf - 0.1, yb); prof.quadraticCurveTo(hf + 0.08, yb + 0.04, hf + 0.06, 0.56); prof.lineTo(hf - 0.02, 0.7);
        prof.quadraticCurveTo(hf - 0.5, 0.86, hf - 1.15, 0.9); prof.lineTo(hr + 0.65, 0.95);
        prof.quadraticCurveTo(hr + 0.05, 0.96, hr - 0.03, 0.74); prof.lineTo(hr, yb + 0.08);
      }
      prof.lineTo(hr + 0.08, yb);
      const body = new THREE.ExtrudeGeometry(prof, { depth: Wd - 0.14, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 10 });
      body.translate(0, -sink, -(Wd - 0.14) / 2); G.rot(body, 0, -Math.PI / 2, 0);   // length along z, front at +z
      // greenhouse: curved windscreen and roof, narrower than the body (tumblehome)
      const cab = new THREE.Shape(), Hb = van ? 1.08 : 0.9;
      if (van) { cab.moveTo(hr + 0.15, Hb); cab.lineTo(hf - 0.45, Hb); cab.quadraticCurveTo(hf - 0.62, Hb + 0.6, hf - 1.05, Hb + 0.92); cab.lineTo(hr + 0.22, Hb + 0.95); cab.lineTo(hr + 0.15, Hb); }
      else { cab.moveTo(hr + 0.7, Hb + 0.04); cab.lineTo(hf - 1.15, Hb); cab.quadraticCurveTo(hf - 1.55, Hb + 0.36, hf - 2.05, Hb + 0.47); cab.quadraticCurveTo(hr + 1.6, Hb + 0.52, hr + 1.25, Hb + 0.42); cab.quadraticCurveTo(hr + 0.95, Hb + 0.28, hr + 0.7, Hb + 0.04); }
      const gw = Wd - (van ? 0.3 : 0.42);
      const glass = new THREE.ExtrudeGeometry(cab, { depth: gw, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 8 });
      glass.translate(0, -sink, -gw / 2); G.rot(glass, 0, -Math.PI / 2, 0);
      const paintParts = [body];
      // pillars and roof skin in body colour over the glass (B pillar + roof rails), mirrors
      if (!van) {
        paintParts.push(G.box(gw + 0.13, 0.04, 1.1, 0, Hb + 0.54 - sink, -0.32));
        for (const sx of [-1, 1]) { paintParts.push(G.box(0.03, 0.42, 0.1, sx * (gw / 2 + 0.06), Hb + 0.24 - sink, -0.25)); paintParts.push(G.box(0.16, 0.08, 0.12, sx * (Wd / 2 + 0.03), Hb + 0.08 - sink, hf - 1.25)); }
      } else for (const sx of [-1, 1]) { paintParts.push(G.box(0.03, 0.9, 0.1, sx * (gw / 2 + 0.06), Hb + 0.46 - sink, 0.3)); paintParts.push(G.box(0.16, 0.1, 0.12, sx * (Wd / 2 + 0.04), Hb + 0.1 - sink, hf - 0.5)); }
      add('paint', paintParts, { tint: true });
      add('carGlass', glass);
      const wheels = [], rims = [];
      for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        wheels.push(G.rot(G.cyl(rw, rw, 0.22, 18), 0, 0, Math.PI / 2).translate(x * (Wd / 2 - 0.13), rw - sink * 0.6, z * wb));
        rims.push(G.rot(G.cyl(rw * 0.64, rw * 0.6, 0.03, 14), 0, 0, Math.PI / 2).translate(x * (Wd / 2 - 0.02), rw - sink * 0.6, z * wb));
      }
      add('rubber', [...wheels, G.box(Wd - 0.3, 0.12, L - 1.0, 0, 0.26, 0)]);   // tyres + dark underbody
      add('steel', rims);
      if (!wreck) {
        // parked: daytime-running light bars only (opts.lit = true for headlights on)
        add('emissive', [G.box(Wd - 0.42, 0.035, 0.03, 0, van ? 0.66 : 0.64, hf + 0.075)], { color: 0xeaf4ff, intensity: o.lit ? 3 : 0.35 });
        add('emissive', [G.box(Wd - 0.3, 0.04, 0.03, 0, van ? 0.9 : 0.8, hr - 0.06)], { color: 0xff1a2a, intensity: o.lit ? 2.4 : 0.5 });
        if (e49) add('emissive', [G.box(0.025, 0.025, L * 0.55, Wd / 2 - 0.02, 0.27, 0), G.box(0.025, 0.025, L * 0.55, -Wd / 2 + 0.02, 0.27, 0)], { color: o.glow ?? 0x2ae6ff, intensity: 1.6, tintGlow: true });
      }
      break;
    }
    case 'scooter': {
      add('rubber', [G.rot(G.cyl(0.2, 0.2, 0.08, 14), 0, 0, Math.PI / 2).translate(0, 0.2, 0.62), G.rot(G.cyl(0.2, 0.2, 0.08, 14), 0, 0, Math.PI / 2).translate(0, 0.2, -0.6)]);
      add('paint', [G.box(0.32, 0.12, 1.0, 0, 0.32, 0), G.box(0.3, 0.3, 0.45, 0, 0.55, -0.32), G.box(0.26, 0.08, 0.5, 0, 0.74, -0.3)], { tint: true });
      add('metal', [G.rot(G.cyl(0.03, 0.03, 0.9, 6), -0.3, 0, 0).translate(0, 0.72, 0.5), G.rot(G.cyl(0.02, 0.02, 0.6, 6), 0, 0, Math.PI / 2).translate(0, 1.15, 0.63)]);
      if (!ruin) add('emissive', G.box(0.16, 0.05, 0.03, 0, 0.98, 0.66), { color: 0xeaf4ff, intensity: 2.5 });
      break;
    }
    case 'cone': { add('painted', [G.cyl(0.03, 0.17, 0.62, 12, 0, 0.33, 0), G.box(0.38, 0.03, 0.38, 0, 0.015, 0)], { color: 0xff5a10 }); add('steel', G.cyl(0.09, 0.12, 0.08, 12, 0, 0.36, 0)); break; }
    case 'barrier': { add('painted', [G.box(1.8, 0.25, 0.06, 0, 0.85, 0), G.box(0.06, 0.95, 0.5, -0.8, 0.47, 0), G.box(0.06, 0.95, 0.5, 0.8, 0.47, 0)], { color: 0xd8d0b8 }); add('emissive', G.box(0.12, 0.08, 0.03, 0, 1.0, 0.03), { color: 0xffa020, intensity: e49 ? 2 : 0.6 }); break; }
    case 'rubble': {   // 2196 debris pile
      const r = rng(o.seed ?? 3), parts = [];
      for (let i = 0; i < 9; i++) { const s = 0.15 + r() * 0.5; parts.push(G.rot(G.box(s * (1 + r()), s * 0.6, s), r() * 3, r() * 3, r() * 3).translate((r() - 0.5) * 1.6, s * 0.25, (r() - 0.5) * 1.2)); }
      add('concrete', parts);
      break;
    }
    // ---- ancient ----
    case 'fence': {   // wattle fence panel: stakes + woven rods
      const L = o.length ?? 2, stakes = [], rods = [];
      for (let i = 0; i <= 4; i++) stakes.push(G.cyl(0.035, 0.04, 1.15, 6, -L / 2 + i * L / 4, 0.57, 0));
      for (let j = 0; j < 7; j++) { const y = 0.18 + j * 0.13, pts = []; for (let i = 0; i <= 8; i++) pts.push([-L / 2 + i * L / 8, y, ((i + j) % 2 ? 1 : -1) * 0.035]); rods.push(G.tube(pts, 0.018, 4, 16)); }
      add('wood', [...stakes, ...rods]);
      break;
    }
    case 'well': {
      const ring = [];
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ring.push(G.rot(G.box(0.5, 0.75, 0.25), 0, -a, 0).translate(Math.cos(a) * 0.72, 0.37, Math.sin(a) * 0.72)); }
      add('stone', ring);
      add('wood', [G.cyl(0.06, 0.07, 2.1, 8, -0.85, 1.05, 0), G.cyl(0.06, 0.07, 2.1, 8, 0.85, 1.05, 0), G.rot(G.cyl(0.05, 0.05, 1.9, 8), 0, 0, Math.PI / 2).translate(0, 1.85, 0), G.cyl(0.18, 0.18, 0.3, 10, 0.2, 1.2, 0)]);
      add('rubber', G.cyl(0.65, 0.65, 0.02, 16, 0, 0.6, 0));   // dark water
      break;
    }
    case 'cart': {
      add('wood', [G.box(1.3, 0.08, 2.0, 0, 0.75, 0), G.box(0.06, 0.35, 2.0, -0.62, 0.95, 0), G.box(0.06, 0.35, 2.0, 0.62, 0.95, 0), G.box(1.3, 0.35, 0.06, 0, 0.95, -0.97),
        G.box(0.08, 0.08, 1.9, -0.35, 0.68, 1.9), G.box(0.08, 0.08, 1.9, 0.35, 0.68, 1.9), G.rot(G.cyl(0.05, 0.05, 1.6, 6), 0, 0, Math.PI / 2).translate(0, 0.5, 0)]);
      add('wood', [G.rot(new THREE.TorusGeometry(0.48, 0.05, 6, 16), 0, Math.PI / 2, 0).translate(-0.75, 0.5, 0), G.rot(new THREE.TorusGeometry(0.48, 0.05, 6, 16), 0, Math.PI / 2, 0).translate(0.75, 0.5, 0)]);
      add('straw', [G.box(1.1, 0.25, 1.6, 0, 0.92, 0.1)]);
      break;
    }
    case 'stall': {   // market stall: posts, counter, cloth awning (instanceColor)
      add('wood', [G.box(0.1, 2.2, 0.1, -1.0, 1.1, -0.6), G.box(0.1, 2.2, 0.1, 1.0, 1.1, -0.6), G.box(0.1, 1.9, 0.1, -1.0, 0.95, 0.6), G.box(0.1, 1.9, 0.1, 1.0, 0.95, 0.6), G.box(2.1, 0.08, 1.0, 0, 0.9, 0.1), G.box(2.1, 0.8, 0.05, 0, 0.45, 0.58)]);
      add('cloth', G.rot(new THREE.PlaneGeometry(2.4, 1.6), -Math.PI / 2 + 0.25, 0, 0).translate(0, 2.05, 0), { tint: true });
      add('pottery', [G.cyl(0.12, 0.09, 0.22, 10, -0.6, 1.05, 0.1), G.cyl(0.1, 0.12, 0.18, 10, -0.25, 1.03, 0.2), G.cyl(0.14, 0.1, 0.25, 10, 0.4, 1.07, 0.05)]);
      break;
    }
    case 'pot': { add('pottery', [new THREE.LatheGeometry([[0.01, 0], [0.16, 0.04], [0.24, 0.25], [0.2, 0.45], [0.1, 0.55], [0.12, 0.62]].map(([x, y]) => new THREE.Vector2(x, y)), 12)]); break; }
    case 'barrel': { add('wood', [G.cyl(0.3, 0.26, 0.85, 14, 0, 0.425, 0)]); add('metal', [G.cyl(0.305, 0.305, 0.05, 14, 0, 0.2, 0), G.cyl(0.305, 0.305, 0.05, 14, 0, 0.65, 0)]); break; }
    case 'crate': { add('wood', [G.box(0.7, 0.6, 0.6, 0, 0.3, 0)]); break; }
    default: throw new Error('streetKit: unknown prop ' + kind);
  }
  PARTS.set(key, P);
  return P;
}
// size class for distance culling (m); 0 = never culled
const CULL = { bollard: 70, bin: 70, bench: 80, drain: 45, manhole: 55, cone: 50, barrier: 70, railing: 90, kiosk: 110, scooter: 90, pot: 50, barrel: 60, crate: 60, rubble: 90, fence: 100, cart: 110, stall: 120, well: 120 };

/**
 * Builder for streets and squares (see the section header). All methods return the builder (chainable).
 *   add(kind, [x, y, z], yaw = 0, { color, glow, ...part options })      any prop of the library
 *   lamps(points, opts) bollards(points) bins(points) benches(points) drains(points) manholes(points) cones(points)
 *   kerb(path, { height, width, gutter, y }) markings({ lanes, edges, crossings, stops, arrows, y }) puddles(list)
 *   cables(spans, { sag, radius }) catenary(path, { height, spacing }) rails(path, { gauge, sleepers, embedded })
 *   railing(path, { height }) trafficLight([x, y, z], yaw, { arm }) shelter([x, y, z], yaw, { width })
 *   car / van / wreck / scooter ([x, y, z], yaw, { color }) kiosk(...)  scatter(kind, path | { area: [x0, z0, x1, z1] }, { spacing, count, offset, seed, jitter })
 *   build() -> Group (InstancedMesh per part and 48 m cell; merged meshes for kerbs, markings, cables, rails, puddles)
 */
export function streetKit(opts = {}) {
  const era = opts.era ?? '2049', cell = opts.cell ?? 48, R = rng(opts.seed ?? 1), M = streetMaterials(era);
  const inst = [], merged = { kerb: [], concrete: [], rubber: [], steel: [], metal: [], puddle: [] }, paint = [], colliders = [], updaters = [];
  const k = {
    era, colliders,
    add(kind, p, yaw = 0, o = {}) {
      const tilt = era === '2196' && ['lamp', 'bollard', 'trafficLight', 'railing', 'barrier'].includes(kind) ? (R() - 0.5) * 0.12 : 0;
      inst.push({ kind, p: [p[0], p[1] ?? 0, p[2]], yaw, tilt, o, color: o.color, seed: R() });
      const fp = { lamp: 0.2, bollard: 0.12, bin: 0.3, bench: [0.9, 0.3], kiosk: [0.5, 0.45], shelter: null, car: [0.95, 2.2], van: [1.0, 2.5], wreck: [0.95, 2.2], trafficLight: 0.15, well: 0.95, cart: [0.7, 1.1], stall: [1.1, 0.7], barrel: 0.3, crate: 0.35 }[kind];
      if (fp) { const [hx, hz] = Array.isArray(fp) ? fp : [fp, fp], c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)); const ex = hx * c + hz * s, ez = hx * s + hz * c; colliders.push({ min: [p[0] - ex, p[1] ?? 0, p[2] - ez], max: [p[0] + ex, (p[1] ?? 0) + ({ lamp: 6, trafficLight: 5.6, car: 1.4, van: 2, wreck: 1.3 }[kind] ?? 1.2), p[2] + ez], kind }); }
      return k;
    },
    many(kind, points, o = {}) { for (const pt of points) k.add(kind, pt, pt[3] ?? o.yaw ?? 0, o); return k; },
    lamps(points, o = {}) { return k.many('lamp', points, o); },
    bollards(points, o = {}) { return k.many('bollard', points, o); },
    bins(points, o = {}) { return k.many('bin', points, o); },
    benches(points, o = {}) { return k.many('bench', points, o); },
    drains(points, o = {}) { return k.many('drain', points, o); },
    manholes(points, o = {}) { return k.many('manhole', points, o); },
    cones(points, o = {}) { return k.many('cone', points, o); },
    trafficLight(p, yaw = 0, o = {}) {
      k.add('trafficLight', p, yaw, o);
      const it = inst[inst.length - 1]; it.phase = o.phase ?? R() * 20; it.cycle = o.cycle ?? 24;
      return k;
    },
    shelter(p, yaw = 0, o = {}) { colliders.push({ min: [p[0] - 2.2, 0, p[2] - 0.9], max: [p[0] + 2.2, 2.7, p[2] - 0.6], kind: 'shelter' }); return k.add('shelter', p, yaw, o); },
    car(p, yaw = 0, o = {}) { return k.add(era === '2196' ? 'wreck' : 'car', p, yaw, { color: o.color ?? [0x8a1a1a, 0x1c2a44, 0xd8dde4, 0x202225, 0x5a6066, 0x2a4a3a, 0xb08a2a][Math.floor(R() * 7)], ...o }); },
    van(p, yaw = 0, o = {}) { return k.add('van', p, yaw, { color: o.color ?? [0xd8dde4, 0x3a3f46, 0x6a1a1a][Math.floor(R() * 3)], ...o }); },
    scooter(p, yaw = 0, o = {}) { return k.add('scooter', p, yaw, { color: o.color ?? [0xff2a8a, 0x2ae6ff, 0xe0e0e0, 0x202020][Math.floor(R() * 4)], ...o }); },
    kiosk(p, yaw = 0, o = {}) { return k.add('kiosk', p, yaw, o); },
    // points along a polyline (spacing) or random points in an area; kind gets each point with the path's yaw
    scatter(kind, where, o = {}) {
      const pts = [], sp = o.spacing ?? 8, jit = o.jitter ?? 0;
      if (Array.isArray(where)) {
        for (let i = 0; i < where.length - 1; i++) {
          const [x0, z0] = where[i], [x1, z1] = where[i + 1], L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0) + (o.turn ?? 0);
          const nx = (z1 - z0) / L, nz = -(x1 - x0) / L;
          for (let d = (o.start ?? sp / 2); d < L; d += sp) { const t = d / L, j = (R() - 0.5) * jit; pts.push([x0 + (x1 - x0) * t + nx * ((o.offset ?? 0) + j), o.y ?? 0, z0 + (z1 - z0) * t + nz * ((o.offset ?? 0) + j), yaw]); }
        }
      } else if (where.area) {
        const [x0, z0, x1, z1] = where.area;
        for (let i = 0; i < (o.count ?? 10); i++) pts.push([x0 + R() * (x1 - x0), o.y ?? 0, z0 + R() * (z1 - z0), R() * Math.PI * 2]);
      }
      for (const p of pts) { if (kind === 'car' || kind === 'van' || kind === 'scooter') k[kind](p, p[3], o); else k.add(kind, p, p[3], o); }
      return k;
    },
    // kerb stones along a path (left side of the path is the raised pavement), with a gutter channel on the road side
    kerb(path, o = {}) {
      const h = o.height ?? 0.15, w = o.width ?? 0.3, gw = o.gutter ?? 0.3, y = o.y ?? 0;
      for (let i = 0; i < path.length - 1; i++) {
        const [x0, z0] = path[i], [x1, z1] = path[i + 1], L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
        for (let d = 0; d < L - 0.01; d += 1) {
          const l = Math.min(1, L - d) - 0.01, c = d + l / 2, t = c / L, cx = x0 + (x1 - x0) * t, cz = z0 + (z1 - z0) * t;
          const g = G.box(w, h, l, -w / 2, h / 2, 0); G.rot(g, 0, yaw, 0).translate(cx, y, cz);
          tintGeo(g, 0.82 + R() * 0.3); merged.kerb.push(g);
          if (gw > 0) { const gg = G.box(gw, 0.01, l + 0.01, gw / 2, 0.004, 0); G.rot(gg, 0, yaw, 0).translate(cx, y, cz); tintGeo(gg, 0.45 + R() * 0.08); merged.kerb.push(gg); }
        }
      }
      return k;
    },
    // road paint: lanes [{ from, to, dash }], edges, crossings [{ at: [x, z], yaw, width, length }], stops, arrows
    markings(o = {}) {
      const y = o.y ?? 0.006;
      const seg = (a, b, width, dash) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); paint.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, length: L, width, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]), dash, y }); };
      for (const l of o.lanes || []) seg(l.from, l.to, l.width ?? 0.15, l.dash ?? [3, 6]);
      for (const l of o.edges || []) seg(l.from, l.to, l.width ?? 0.12, null);
      for (const c of o.crossings || []) {   // zebra: stripes across the road
        const W = c.width ?? 10, Ls = c.length ?? 3, n = Math.floor(W / 1.0), cs = Math.cos(c.yaw ?? 0), sn = Math.sin(c.yaw ?? 0);
        for (let i = 0; i < n; i++) { const u = -W / 2 + 0.5 + i; paint.push({ x: c.at[0] + u * cs, z: c.at[1] - u * sn, length: Ls, width: 0.5, yaw: c.yaw ?? 0, y }); }
      }
      for (const s of o.stops || []) seg(s.from, s.to, s.width ?? 0.4, null);
      for (const a of o.arrows || []) { const cs = Math.sin(a.yaw ?? 0), cn = Math.cos(a.yaw ?? 0); paint.push({ x: a.at[0], z: a.at[1], length: 2.2, width: 0.18, yaw: a.yaw ?? 0, y }); for (const s of [-1, 1]) paint.push({ x: a.at[0] + cs * 1.0 + s * cn * 0.25, z: a.at[1] + cn * 1.0 - s * cs * 0.25, length: 0.9, width: 0.16, yaw: (a.yaw ?? 0) + s * 0.6, y }); }
      return k;
    },
    puddles(list) { for (const [x, z, r = 1.2, y = 0.012] of list) { const g = G.rot(new THREE.CircleGeometry(r, 20), -Math.PI / 2, 0, 0); g.scale(1, 1, 0.55 + R() * 0.5); G.rot(g, 0, R() * 3, 0).translate(x, y, z); merged.puddle.push(g); } return k; },
    // overhead cables: spans [[x0, y0, z0], [x1, y1, z1]] with sag; catenary: masts along a path with messenger + contact wires
    cables(spans, o = {}) { for (const [a, b] of spans) { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - (o.sag ?? 0.6) * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]); } merged.rubber.push(G.tube(pts, o.radius ?? 0.015, 4, 12)); } return k; },
    catenary(path, o = {}) {
      const h = o.height ?? 5.6, sp = o.spacing ?? 16, wires = [];
      for (let i = 0; i < path.length - 1; i++) {
        const [x0, z0] = path[i], [x1, z1] = path[i + 1], L = Math.hypot(x1 - x0, z1 - z0), nx = (z1 - z0) / L, nz = -(x1 - x0) / L, side = o.side ?? 2.3;
        for (let d = 0; d <= L + 0.01; d += sp) {
          const t = d / L, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, mx = x + nx * side, mz = z + nz * side;
          merged.metal.push(G.cyl(0.09, 0.12, h + 0.6, 8, mx, (h + 0.6) / 2, mz));
          const arm = G.box(0.08, 0.08, side + 0.3); G.rot(arm, 0, Math.atan2(-nx, -nz), 0).translate(mx - nx * (side + 0.3) / 2, h + 0.35, mz - nz * (side + 0.3) / 2); merged.metal.push(arm);
          wires.push([x, z]);
        }
      }
      for (let i = 0; i < wires.length - 1; i++) { const [ax, az] = wires[i], [bx, bz] = wires[i + 1]; k.cables([[[ax, h + 0.35, az], [bx, h + 0.35, bz]]], { sag: 0.35, radius: 0.012 }); merged.steel.push(G.tube([[ax, h, az], [bx, h, bz]], 0.01, 4, 2)); for (let s = 1; s < 4; s++) { const t = s / 4, x = ax + (bx - ax) * t, z = az + (bz - az) * t; merged.steel.push(G.box(0.01, 0.35 - 1.4 * 0.35 * t * (1 - t), 0.01, x, h + (0.35 - 1.4 * 0.35 * t * (1 - t)) / 2, z)); } }
      return k;
    },
    // transit rails along a path: two rails (head, web, foot), sleepers, ballast bed (embedded: flush grooved tram rails)
    rails(path, o = {}) {
      const gauge = o.gauge ?? 1.435, y = o.y ?? 0, emb = !!o.embedded;
      for (let i = 0; i < path.length - 1; i++) {
        const [x0, z0] = path[i], [x1, z1] = path[i + 1], L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        for (const s of [-1, 1]) {
          const rail = emb ? [G.box(0.07, 0.02, L, s * gauge / 2, 0.005, 0)] : [G.box(0.07, 0.04, L, s * gauge / 2, 0.15, 0), G.box(0.02, 0.09, L, s * gauge / 2, 0.085, 0), G.box(0.14, 0.02, L, s * gauge / 2, 0.03, 0)];
          for (const g of rail) { G.rot(g, 0, yaw, 0).translate(cx, y, cz); merged.steel.push(g); }
        }
        if (!emb) {
          for (let d = 0.3; d < L; d += 0.65) { const t = d / L, g = G.box(2.5, 0.12, 0.24, 0, 0.0, 0); G.rot(g, 0, yaw, 0).translate(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t); merged.concrete.push(g); }
          const bed = G.box(3.4, 0.08, L, 0, -0.03, 0); G.rot(bed, 0, yaw, 0).translate(cx, y, cz); tintGeo(bed, 0.6); merged.kerb.push(bed);
        }
      }
      return k;
    },
    railing(path, o = {}) {
      for (let i = 0; i < path.length - 1; i++) {
        const [x0, z0] = path[i], [x1, z1] = path[i + 1], L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2, n = Math.max(1, Math.round(L / 2));
        for (let j = 0; j < n; j++) { const t = (j + 0.5) / n; k.add('railing', [x0 + (x1 - x0) * t, o.y ?? 0, z0 + (z1 - z0) * t], yaw, { length: L / n, height: o.height }); }
      }
      return k;
    },
    build() {
      const group = new THREE.Group(); group.name = 'streetKit:' + era;
      // instanced props: one InstancedMesh per (kind + options, part, cell)
      const buckets = new Map();
      for (const it of inst) {
        const po = { ...it.o }; delete po.color; delete po.glow; delete po.phase; delete po.cycle; delete po.yaw;
        const ck = Math.floor(it.p[0] / cell) + ',' + Math.floor(it.p[2] / cell);
        const key = it.kind + '|' + JSON.stringify(po) + '|' + ck;
        let b = buckets.get(key); if (!b) buckets.set(key, b = { kind: it.kind, po, list: [] });
        b.list.push(it);
      }
      const col = new THREE.Color();
      for (const b of buckets.values()) {
        const parts = partsOf(b.kind, era, b.po);
        for (const part of parts) {
          const mat = M[part.mat], n = b.list.length;
          const im = new THREE.InstancedMesh(part.geo, mat, n);
          im.name = b.kind + ':' + part.mat; im.castShadow = part.mat !== 'halo' && part.mat !== 'emissive' && part.mat !== 'glass'; im.receiveShadow = true;
          const needColor = part.mat === 'emissive' || part.mat === 'halo' || part.tint || part.color !== undefined;
          b.list.forEach((it, i) => {
            _q4.setFromEuler(new THREE.Euler(it.tilt, it.yaw, it.tilt * 0.6)); _p4.set(...it.p);
            im.setMatrixAt(i, _m4.compose(_p4, _q4, _s4));
            if (needColor) {
              if (part.tint) col.set(it.color ?? 0xb0b4b8).multiplyScalar(era === '2196' ? 0.55 : 1);
              else if (part.tintGlow) col.set(it.o.glow ?? part.color);
              else col.set(part.lensIndex !== undefined ? part.color : (it.color ?? part.color ?? 0xffffff));
              if (part.intensity !== undefined) col.multiplyScalar(part.intensity);
              im.setColorAt(i, col);
            }
          });
          if (part.lensIndex !== undefined) { im.userData.lens = part.lensIndex; im.userData.items = b.list; im.userData.base = new THREE.Color(part.color); }
          im.computeBoundingSphere();
          if (CULL[b.kind]) im.userData.rzCullDist = CULL[b.kind];
          group.add(im);
          if (im.userData.lens !== undefined) updaters.push(im);
        }
      }
      // merged geometry: kerbs, rails, sleepers, catenary, cables, puddles, markings
      for (const key in merged) if (merged[key].length) {
        const m = new THREE.Mesh(G.merge(merged[key]), M[key]); m.name = 'street:' + key; m.receiveShadow = true; m.castShadow = key !== 'puddle'; group.add(m);
      }
      if (paint.length) { const pm = RZ.roadPaint({ strips: paint, y: paint[0].y }); pm.name = 'street:markings'; group.add(pm); }
      // traffic lights cycle green -> amber -> red (each light its own phase); group.userData.update(t) or the engine drives it
      group.userData.update = (t) => {
        for (const im of updaters) {
          const lens = im.userData.lens;
          im.userData.items.forEach((it, i) => {
            const c = ((t + it.phase) % it.cycle) / it.cycle, state = c < 0.45 ? 2 : c < 0.55 ? 1 : 0;
            col.copy(im.userData.base).multiplyScalar(state === lens ? 3.2 : 0.08); im.setColorAt(i, col);
          });
          im.instanceColor.needsUpdate = true;
        }
      };
      if (updaters.length) { group.userData.rzAnimate = true; group.userData.update(0); }
      group.userData.colliders = colliders;
      return group;
    },
    collide(game) { for (const c of colliders) game.collision.add(c.min, c.max); return k; },
  };
  return k;
}
function tintGeo(g, v) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(v);
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return g;
}
/** One prop as a Group (non-instanced), e.g. prop('shelter', { era: '2049' }) for a one-off placement. */
export function prop(kind, o = {}) {
  const era = o.era ?? '2049', M = streetMaterials(era), g = new THREE.Group(); g.name = 'prop:' + kind;
  const col = new THREE.Color();
  for (const part of partsOf(kind, era, o.parts || {})) {
    let mat = M[part.mat];
    if (part.mat === 'emissive' || part.mat === 'halo' || part.tint || part.color !== undefined) {
      mat = mat.clone(); col.set(part.tint ? (o.color ?? 0xb0b4b8) : (part.color ?? 0xffffff)); if (part.intensity !== undefined) col.multiplyScalar(part.intensity); mat.color.copy(col);
    }
    const m = new THREE.Mesh(part.geo, mat); m.castShadow = part.mat !== 'halo' && part.mat !== 'emissive'; m.receiveShadow = true; g.add(m);
  }
  return g;
}
