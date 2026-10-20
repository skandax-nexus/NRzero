// Mission 6 environment: the clockmaker's house in Rain City's old clock quarter.
// One building in three authored states (2026 / 2049 / 2196): the shop, the looping workshop, the study with its
// hidden stair, and the clock tower. Static geometry is merged per material per era (few draw calls); materials
// come from the realism kit (world-mapped PBR). Owned by M6; M9+ may reuse helpers (Batch, clockFace, clockSet).
import * as THREE from 'three';
import * as RZ from './realism.js';
import { canvasTex, glowMat, rng, Motes } from './kit.js';
import { lampPost } from './props.js';
import { registerCast } from '../story/cast.js';
import { registerTheme } from '../core/audio.js';
import { loopState } from '../systems/loops.js';

export const TY = 5.0;            // tower floor height
export const ERAS = ['2026', '2049', '2196'];
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------------------------
// Geometry batching: everything static is merged into one mesh per material.
// ---------------------------------------------------------------------------------------------
export function mergeGeos(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    pos.set(p.array.subarray ? p.array.subarray(0, p.count * 3) : p.array, vo * 3);
    if (n) nor.set(n.array, vo * 3);
    if (u) uv.set(u.array, vo * 2);
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; }
    else { for (let i = 0; i < p.count; i++) idx[io + i] = vo + i; io += p.count; }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export class Batch {
  constructor() { this.map = new Map(); }
  push(mat, geo) { let l = this.map.get(mat); if (!l) this.map.set(mat, l = []); l.push(geo); return geo; }
  geo(mat, geo, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
    const g = geo.clone(); _m4.compose(V3(...pos), _q.setFromEuler(_e.set(...rot)), V3(...scl)); g.applyMatrix4(_m4); return this.push(mat, g);
  }
  box(mat, x0, y0, z0, x1, y1, z1) { const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return this.push(mat, g); }
  boxc(mat, cx, cy, cz, sx, sy, sz, ry = 0, rx = 0, rz = 0) { return this.geo(mat, new THREE.BoxGeometry(sx, sy, sz), [cx, cy, cz], [rx, ry, rz]); }
  cyl(mat, x, y, z, r, h, seg = 16, rot = [0, 0, 0], r1 = r) { return this.geo(mat, new THREE.CylinderGeometry(r1, r, h, seg), [x, y, z], rot); }
  build(parent, o = {}) {
    const out = [];
    for (const [mat, list] of this.map) {
      if (!list.length) continue;
      const m = new THREE.Mesh(mergeGeos(list), mat);
      m.castShadow = o.cast ?? true; m.receiveShadow = true; m.name = o.name || 'batch';
      parent.add(m); out.push(m);
      if (o.blockers && o.game) o.game.blocker(m);
    }
    for (const l of this.map.values()) for (const g of l) g.dispose();
    this.map.clear();
    return out;
  }
}

// ---------------------------------------------------------------------------------------------
// Textures drawn by code
// ---------------------------------------------------------------------------------------------
const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
export function clockFace(o = {}) {
  const key = 'm6face' + JSON.stringify(o);
  return canvasTex(512, 512, (g, w, h) => {
    const c = w / 2, r = rng(o.seed || 3);
    if (o.mirror) { g.translate(w, 0); g.scale(-1, 1); }
    const grd = g.createRadialGradient(c, c, 20, c, c, c);
    grd.addColorStop(0, o.paper || '#efe4c8'); grd.addColorStop(1, o.edge || '#cdbb92');
    g.fillStyle = o.glass ? 'rgba(0,0,0,0)' : '#2a2016'; g.fillRect(0, 0, w, h);
    g.beginPath(); g.arc(c, c, c - 4, 0, Math.PI * 2); g.fillStyle = grd; g.fill();
    if (o.aged) for (let k = 0; k < 260; k++) { g.fillStyle = `rgba(${90 + r() * 40},${60 + r() * 30},${20},${r() * 0.08})`; const a = r() * 6.28, d = r() * (c - 10); g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 4 + r() * 24, 0, 7); g.fill(); }
    g.strokeStyle = o.ink || '#1c1610'; g.fillStyle = o.ink || '#1c1610';
    g.lineWidth = 6; g.beginPath(); g.arc(c, c, c - 14, 0, 7); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(c, c, c - 44, 0, 7); g.stroke();
    for (let k = 0; k < 60; k++) { const a = k / 60 * Math.PI * 2, r0 = c - (k % 5 ? 24 : 40), r1 = c - 16; g.lineWidth = k % 5 ? 2 : 6; g.beginPath(); g.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0); g.lineTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1); g.stroke(); }
    g.font = `600 ${o.arabic ? 46 : 40}px "Cormorant Garamond", Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, rr = c - 82;
      g.save(); g.translate(c + Math.sin(a) * rr, c - Math.cos(a) * rr); if (!o.arabic) g.rotate(a);
      g.fillText(o.arabic ? String(k || 12) : ROMAN[k], 0, 0); g.restore();
    }
    if (o.name) { g.font = '600 26px "Cormorant Garamond", Georgia, serif'; g.fillText(o.name, c, c - 92); g.font = '500 18px "Cormorant Garamond", Georgia, serif'; g.fillText(o.sub || 'RAIN CITY', c, c + 96); }
    if (o.broken) { g.strokeStyle = 'rgba(20,14,8,0.85)'; g.lineWidth = 3; for (let k = 0; k < 9; k++) { g.beginPath(); let x = c + (r() - 0.5) * 40, y = c + (r() - 0.5) * 40; g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (r() - 0.5) * 120; y += (r() - 0.5) * 120; g.lineTo(x, y); } g.stroke(); } }
  }, key);
}

function spinesTex(seed = 1, worn = 0) {
  return canvasTex(512, 256, (g, w, h) => {
    const r = rng(seed); g.fillStyle = '#120c08'; g.fillRect(0, 0, w, h);
    const pal = ['#5a1e18', '#1f3a2a', '#2a2a44', '#6a4a22', '#3a2416', '#7a6a4a', '#14202a', '#4a1a2a', '#8a7a5a', '#2a1a10'];
    for (let row = 0; row < 2; row++) {
      let x = 0; const y0 = row * 128 + 8;
      while (x < w) {
        const bw = 10 + r() * 22, bh = 80 + r() * 38; if (r() < 0.06) { x += 14; continue; }
        const col = new THREE.Color(pal[Math.floor(r() * pal.length)]).offsetHSL(0, -worn * 0.3, -worn * 0.08 + (r() - 0.5) * 0.06);
        g.fillStyle = '#' + col.getHexString(); g.fillRect(x, y0 + 120 - bh, bw - 1.5, bh);
        g.fillStyle = `rgba(210,170,90,${0.25 + r() * 0.4 - worn * 0.2})`; g.fillRect(x + 1, y0 + 120 - bh + 10, bw - 3.5, 2); g.fillRect(x + 1, y0 + 120 - 18, bw - 3.5, 2);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + bw - 4, y0 + 120 - bh, 2.5, bh);
        x += bw;
      }
    }
  }, 'm6spines' + seed + worn);
}

function decalTex(kind) {
  return canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); const r = rng(kind.length * 17);
    if (kind === 'scratch') { // quarter-circle scratches where a bookcase has swung for decades
      g.strokeStyle = 'rgba(205,180,140,0.55)';
      for (let k = 0; k < 26; k++) { g.lineWidth = 0.8 + r() * 2.2; g.beginPath(); const rr = 380 + r() * 110; g.arc(0, 0, rr, 0.02 + r() * 0.1, Math.PI / 2 - r() * 0.1); g.stroke(); }
    } else if (kind === 'hazard') { // red/white paint under a hammer
      for (let x = -512; x < 1024; x += 48) { g.fillStyle = 'rgba(170,30,24,0.9)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 24, 0); g.lineTo(x + 24 + 512, 512); g.lineTo(x + 512, 512); g.fill(); }
      for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(30,24,18,${r() * 0.4})`; g.fillRect(r() * w, r() * h, 3 + r() * 9, 2 + r() * 5); }
    } else if (kind === 'safe') { // yellow gap markings
      g.fillStyle = 'rgba(214,170,40,0.92)'; g.fillRect(0, 0, w, 40); g.fillRect(0, h - 40, w, 40);
      g.font = '700 88px Rajdhani, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(214,170,40,0.85)'; g.fillText('WAIT', w / 2, h / 2 + 30);
      for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(30,24,18,${r() * 0.5})`; g.fillRect(r() * w, r() * h, 3 + r() * 9, 2 + r() * 5); }
    } else if (kind === 'puddle') {
      for (let k = 0; k < 8; k++) { const x = r() * w, y = r() * h, rr = 40 + r() * 120; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr * 1.5, rr, r() * 3, 0, 7); g.fill(); }
    }
  }, 'm6decal' + kind);
}

export function textPlate(lines, o = {}) {
  return canvasTex(o.w || 512, o.h || 256, (g, w, h) => {
    g.fillStyle = o.bg || '#7a5a2a'; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, 'rgba(255,230,170,0.25)'); grd.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = o.ink || '#2a1a08'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = o.ink || '#2a1a08'; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => { g.font = l.font || `600 ${o.size || 34}px "Cormorant Garamond", Georgia, serif`; g.fillText(l.text ?? l, w / 2, (h / (lines.length + 1)) * (i + 1)); });
  }, 'm6plate' + lines.map(l => l.text ?? l).join('|'));
}

function paperTex(kind) {
  return canvasTex(512, 384, (g, w, h) => {
    const r = rng(kind.length * 7);
    g.fillStyle = '#e9dfc4'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(120,90,40,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 6, 6); }
    g.strokeStyle = 'rgba(80,110,160,0.35)'; g.lineWidth = 1; for (let y = 60; y < h; y += 28) { g.beginPath(); g.moveTo(20, y); g.lineTo(w - 20, y); g.stroke(); }
    g.fillStyle = '#2a2018'; g.font = 'italic 500 26px "Cormorant Garamond", Georgia, serif';
    const lines = kind === 'ledger'
      ? ['14 June 2026 — Varen, two children.', 'Boy\'s watch, stopped at 8:14.', 'No charge. The girl paid', 'with a drawing.', '— 21:15: HE came again. Same face.']
      : kind === 'letter' ? ['Papa,', 'Ana turned five today. She asks', 'why Grandpa lives inside a clock.', 'Will you ever come out?', '— Lotte, 2041 (returned, unopened)']
        : ['ESCAPEMENT — UPPER COLLAR', 'for K.V. (he says: not yet)', 'each age keeps its own hour', '', '— O.H.'];
    lines.forEach((l, i) => g.fillText(l, 34, 52 + i * 56));
  }, 'm6paper' + kind);
}

// ---------------------------------------------------------------------------------------------
// Instanced clocks (wall of clocks): 1 body + 1 face per face style + 1 hands draw call.
// Each entry: { p: [x, y, z], ry, r, face: 0..n-1, off (minutes), rate (minutes per second), skip (skip the ninth minute) }
// ---------------------------------------------------------------------------------------------
export function clockSet(list, faces, o = {}) {
  const group = new THREE.Group(); group.name = 'clockSet';
  const bodyGeo = new THREE.CylinderGeometry(1, 1.04, 1, 28); bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.35 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, list.length);
  const tints = [0x6a4428, 0xb08a48, 0x3a2416, 0x8a6a3a, 0x2a2a2a];
  const faceGeo = new THREE.CircleGeometry(0.9, 32);
  const byFace = faces.map(() => []);
  list.forEach((c, i) => { byFace[c.face % faces.length].push(i); });
  const faceMeshes = faces.map((tex, fi) => { const m = new THREE.InstancedMesh(faceGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: o.glow ?? 0.04 }), Math.max(1, byFace[fi].length)); m.count = byFace[fi].length; group.add(m); return m; });
  const handGeo = new THREE.BoxGeometry(1, 1, 1); handGeo.translate(0, 0.5, 0);
  const hands = new THREE.InstancedMesh(handGeo, new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.4, metalness: 0.6 }), list.length * 2);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler(), C = new THREE.Color();
  const base = list.map(c => { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.ry || 0, 0)); const n = V3(0, 0, 1).applyQuaternion(q); return { q, n }; });
  list.forEach((c, i) => {
    const d = c.depth ?? 0.12;
    M.compose(P.set(...c.p).addScaledVector(base[i].n, -d / 2), base[i].q, S.set(c.r * 1.08, c.r * 1.08, d)); bodies.setMatrixAt(i, M);
    bodies.setColorAt(i, C.set(tints[(c.tint ?? i) % tints.length]));
  });
  byFace.forEach((ids, fi) => ids.forEach((i, j) => { const c = list[i]; M.compose(P.set(...c.p).addScaledVector(base[i].n, 0.004), base[i].q, S.set(c.r, c.r, 1)); faceMeshes[fi].setMatrixAt(j, M); }));
  bodies.castShadow = true; group.add(bodies, hands);
  hands.frustumCulled = false; bodies.frustumCulled = false; faceMeshes.forEach(m => { m.frustumCulled = false; });
  const handQ = new THREE.Quaternion();
  function update(minutes) {
    list.forEach((c, i) => {
      let m = (c.fixed !== undefined ? c.fixed : minutes * (c.rate ?? 1) + (c.off || 0));
      if (c.skip && c.fixed === undefined) { const mm = Math.max(0, m); const h = Math.floor(mm / 59), rr = mm - h * 59; m = h * 60 + (rr < 8 ? rr : rr + 1); }
      const hour = (m / 60) % 12, min = m % 60;
      for (let k = 0; k < 2; k++) {
        const ang = k ? -(min / 60) * Math.PI * 2 : -(hour / 12) * Math.PI * 2;
        handQ.copy(base[i].q).multiply(Q.setFromEuler(E.set(0, 0, ang)));
        const len = c.r * (k ? 0.78 : 0.52), wid = c.r * (k ? 0.045 : 0.07);
        M.compose(P.set(...c.p).addScaledVector(base[i].n, 0.012 + k * 0.006), handQ, S.set(wid, len, 0.01)); hands.setMatrixAt(i * 2 + k, M);
      }
    });
    hands.instanceMatrix.needsUpdate = true;
  }
  update(0);
  bodies.instanceMatrix.needsUpdate = true; if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  return { group, update, list };
}

// A single clock with real hands you can set (mantel clock, service dial, the great dial).
export function settableClock(r, faceTex, o = {}) {
  const g = new THREE.Group();
  if (!o.noBody) { const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.12, o.depth ?? 0.08, 32), o.bodyMat || new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.8, roughness: 0.35 })); body.rotation.x = Math.PI / 2; body.position.z = -(o.depth ?? 0.08) / 2; g.add(body); }
  const face = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.5, transparent: !!o.transparent, opacity: o.opacity ?? 1, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: o.glow ?? 0.05, side: o.double ? THREE.DoubleSide : THREE.FrontSide }));
  face.position.z = 0.003; g.add(face);
  const handMat = o.handMat || new THREE.MeshStandardMaterial({ color: 0x120c08, metalness: 0.7, roughness: 0.35 });
  const mk = (len, w) => { const pv = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.012 * r * 4), handMat); b.position.y = len * 0.42; pv.add(b); pv.position.z = 0.02; g.add(pv); return pv; };
  const hour = mk(r * 0.55, r * 0.08), minute = mk(r * 0.82, r * 0.05);
  minute.position.z = 0.03;
  const set = (h, m = 0) => { const sgn = o.mirror ? 1 : -1; hour.rotation.z = sgn * ((h % 12) + m / 60) / 12 * Math.PI * 2; minute.rotation.z = sgn * (m / 60) * Math.PI * 2; g.userData.time = [h, m]; };
  set(o.h ?? 0, o.m ?? 0);
  g.userData.set = set; g.userData.face = face;
  return g;
}

function gearGeometry(R, teeth, thick, hole = 0.2) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= teeth * 4; i++) {
    const a = i / (teeth * 4) * Math.PI * 2, k = i % 4, rr = k === 1 || k === 2 ? R : R * 0.88;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const holeP = new THREE.Path(); holeP.absarc(0, 0, R * hole, 0, Math.PI * 2, true); shape.holes.push(holeP);
  for (let s = 0; s < 5; s++) { const a0 = s / 5 * Math.PI * 2 + 0.25, a1 = a0 + Math.PI * 2 / 5 - 0.5; const p = new THREE.Path(); p.absarc(0, 0, R * 0.7, a0, a1, false); p.absarc(0, 0, R * 0.32, a1, a0, true); shape.holes.push(p); }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 4 }); geo.translate(0, 0, -thick / 2);
  return geo;
}

// ---------------------------------------------------------------------------------------------
// Cast: the clockmaker, his younger self (2026), his daughter Lotte (2026), and the recording.
// ---------------------------------------------------------------------------------------------
// Costumes follow the era of the scene (era field + colours): 2049 = contemporary-futuristic workwear,
// 2026 = ordinary present-day clothes. Templates are chosen explicitly so no one borrows a principal's face
// and no period piece (top hat, headscarf, long skirt) appears in the city eras.
export function registerM6Cast() {
  registerCast('oskar', {
    name: 'OSKAR HENSEL', role: 'Clockmaker · Old Quarter · 2049',
    bio: 'Seventy-eight. Has not left his house in twenty-three years. Keeps a promise to a man with Kai\'s face.',
    // 2049 workwear (COSTUMES.md `oskar`): graphite thermal knit, waxed-canvas utility vest with tool loops, slate technical trousers
    look: { era: '2049', costume: 'oskar', sex: 'm', template: 'ignatz', height: 1.7, build: 0.94, age: 78, skin: 0xe6bea4, hair: 0xe4e0d8, hairStyle: 'grey-swept', eyes: 0x5a6a78, beard: 0xd8d4cc, glasses: true,
      face: { jaw: -0.2, cheek: 0.35, nose: 0.45, noseWidth: 0.1, lips: -0.35, brow: 0.3, eyeSize: -0.15, faceLength: 0.35, chin: 0.1 }, wrinkles: 0.85,
      topType: 'sweater', top: 0x3a3f45, topKind: 'synthetic', vest: 0x4a3a2a, pantsType: 'trousers', pants: 0x2e3338, shoes: 'shoes', boots: 0x1c1a18, belt: 0x23201c, gloves: null },
    rimColor: 0xffc070, glow: 0x2a1a0c, bg: 0x120c08,
    vp: { sex: 'm', pitch: 0.7, rate: 0.84, langs: ['en-GB', 'en-IE', 'en-US'] },
  });
  registerCast('oskar26', {
    name: 'OSKAR HENSEL', role: 'Clockmaker · 2026',
    bio: 'Fifty-five, ink on his cuffs, a daughter at the counter. Already building a clock that must never finish.',
    // 2026 (COSTUMES.md `oskar26`): oatmeal crew-neck jumper, brown canvas work vest, dark jeans, leather work shoes
    look: { era: '2026', costume: 'oskar26', sex: 'm', template: 'town_m5', height: 1.71, build: 1.0, age: 55, skin: 0xe2b496, hair: 0x5a4a3c, hairStyle: 'swept', eyes: 0x5a6a78, stubble: true, glasses: true,
      face: { jaw: -0.1, cheek: 0.3, nose: 0.4, noseWidth: 0.1, lips: -0.25, brow: 0.25, eyeSize: -0.1, faceLength: 0.3, chin: 0.1 }, wrinkles: 0.35,
      topType: 'sweater', top: 0xbcb19c, topKind: 'fabric', vest: 0x5a4a38, pantsType: 'trousers', pants: 0x2e3a4c, shoes: 'shoes', boots: 0x3a2a1c, belt: 0x2a1d14 },
    rimColor: 0xffc070, glow: 0x2a1a0c, bg: 0x120c08,
    vp: { sex: 'm', pitch: 0.86, rate: 0.95, langs: ['en-GB', 'en-IE', 'en-US'] },
  });
  registerCast('lotte', {
    name: 'LOTTE HENSEL', role: 'Age 8 · 2026',
    bio: 'The clockmaker\'s daughter. Does her homework on the shop counter and counts the clocks when she is bored.',
    // 2026 kid: red hoodie, jeans, white trainers
    look: { era: '2026', costume: 'lotte', sex: 'f', template: 'town_kid', female: true, height: 1.27, build: 0.82, age: 8, skin: 0xf2cdb2, hair: 0xb88a4e, hairStyle: 'tied-back', eyes: 0x4a6a8a,
      face: { jaw: -0.4, cheek: 0.2, nose: -0.5, noseWidth: -0.2, lips: 0.1, brow: -0.2, eyeSize: 0.45, faceLength: -0.4, chin: -0.2 }, freckles: 0.5,
      topType: 'jacket', hood: true, top: 0xb03a44, topKind: 'fabric', pantsType: 'trousers', pants: 0x3a5078, shoes: 'shoes', boots: 0xe6e2da },
    rimColor: 0xffd8a0, glow: 0x2a1a10, bg: 0x140d08,
    vp: { sex: 'f', pitch: 1.5, rate: 1.04, langs: ['en-GB', 'en-US'] },
  });
  registerCast('recording', {
    name: 'RECORDING · 2026', role: 'Reel found inside the escapement', voice: true,
    vp: { sex: 'm', pitch: 0.7, rate: 0.84, langs: ['en-GB', 'en-US'] },
  });
  registerCast('neighbor', { name: 'NEIGHBOUR', role: 'Clock quarter · 2049', vp: { sex: 'm', pitch: 0.92, rate: 0.98, langs: ['en-GB', 'en-US'] } });
}
// 2049 neighbour: a sealed charcoal rain shell over a dark knit, umbrella (no period costume)
export const NEIGHBOR_LOOK = { era: '2049', costume: 'neighbor', sex: 'm', template: 'arin', height: 1.76, build: 1.0, age: 46, skin: 0xc89a7a, hair: 0x2a2420, hairStyle: 'short', eyes: 0x3a3028, stubble: true,
  topType: 'jacket', top: 0x262c32, topKind: 'synthetic', coat: 0x2a3038, coatKind: 'synthetic', pantsType: 'trousers', pants: 0x1c2026, shoes: 'boots', boots: 0x141210, umbrella: 0x1e2a36 };
// Residue echoes of 2026: Kai (7) and Mira (10) in ordinary present-day kids' clothes
export const KID_KAI = { era: '2026', costume: 'kid_kai', sex: 'm', template: 'wren', height: 1.22, build: 0.82, age: 7, skin: 0xb98463, hair: 0x15100c, hairStyle: 'messy', eyes: 0x3d2a18, topType: 'jacket', hood: true, top: 0x2a4a6a, topKind: 'fabric', pantsType: 'trousers', pants: 0x2f3a4e, shoes: 'shoes', boots: 0x3a2a1a };
export const KID_MIRA = { era: '2026', costume: 'kid_mira', sex: 'f', template: 'maren', female: true, height: 1.36, build: 0.84, age: 10, skin: 0xd9a585, hair: 0x120d0b, hairStyle: 'bob', eyes: 0x2f4a3a, topType: 'sweater', top: 0x6a2a3a, topKind: 'fabric', pantsType: 'trousers', pants: 0x1f2227, shoes: 'shoes', boots: 0x3a2a1a };

// ---------------------------------------------------------------------------------------------
// Music: themes that follow the house's beats. A minor world (motif E-B-A = Kai & Mira).
// ---------------------------------------------------------------------------------------------
export const towerState = { set: 0 };
export function registerM6Themes() {
  const CH = [[45, 57, 60, 64], [41, 57, 60, 65], [48, 55, 60, 64], [40, 55, 59, 64]];
  registerTheme('m6-house', { bpm: 66, step(a, s, t, d) { // 2049: dusty, intimate, clocks everywhere
    const bar = Math.floor(s / 16), b = s % 16, ch = CH[bar % 4];
    if (b === 0) { a.pad(ch.slice(1), t, d * 16, 0.016, 520); a.cello(ch[0], t, d * 16, 0.045); }
    if (b % 4 === 0) a.piano(ch[1 + (b >> 2) % 3] + 12, t, 0.13 + (b === 0 ? 0.05 : 0), 2.8);
    if (b === 0 || b === 8) a.tick(t, 0.014, b ? 4300 : 5200);
    if (bar % 2 === 0) { const mel = [76, 74, 72, 71, 72, 69], at = [0, 3, 6, 8, 11, 14], i = at.indexOf(b); if (i >= 0) a.glass(mel[i], t, 0.018); }
  } });
  registerTheme('m6-house-past', { bpm: 72, step(a, s, t, d) { // 2026: warm afternoon, a music box, a family
    const C2 = [[48, 55, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62], [45, 57, 60, 64]];
    const bar = Math.floor(s / 16), b = s % 16, ch = C2[bar % 4];
    if (b === 0) { a.pad(ch.slice(1).map(n => n + 12), t, d * 16, 0.014, 900); }
    if (b === 0 || b === 8) a.pluck(ch[0], t, 0.07);
    if (b % 2 === 0) a.piano(ch[1 + (b >> 1) % 3] + 24, t, 0.09, 1.6);
    if (b === 0 || b === 8) a.tick(t, 0.012, b ? 4600 : 5600);
    const mel = [79, 76, 77, 74, 76, 72], at = [0, 4, 6, 8, 10, 12], i = at.indexOf(b); if (bar % 2 === 1 && i >= 0) a.glass(mel[i], t, 0.02);
  } });
  registerTheme('m6-ruin', { bpm: 54, step(a, s, t, d) { // 2196: wind through a dead clock
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0 && bar % 2 === 0) { a.cello(33, t, d * 32, 0.05); a.pad([57, 64, 69], t, d * 32, 0.02, 420); }
    if (b === 0 && bar % 3 !== 2) a.tick(t, 0.02, 3000);
    if (b === 6 && bar % 3 === 1) a.glass([83, 81, 76][bar % 3], t, 0.02);
    if (b === 12 && bar % 4 === 3) a.piano(64, t, 0.1, 5);
  } });
  registerTheme('m6-loop', { bpm: 96, step(a, s, t, d) { // the workshop: 8 bars = one 20-second loop; one layer per repetition
    const bar = Math.floor(s / 16), b = s % 16, L = loopState.layer;
    if (b % 2 === 0) a.tick(t, b % 4 === 0 ? 0.026 : 0.012, b % 8 === 0 ? 6200 : 7600);
    if ([0, 6, 8, 14].includes(b)) a.pluck(b % 8 ? 52 : 45, t, 0.06);
    if (b === 0 || b === 8) a.drum(t, 0.12, 82, 40);
    if (L >= 1 && (b === 0 || b === 8)) a.cello(bar % 2 ? 40 : 33, t, d * 7, 0.045);
    if (L >= 2 && (b === 2 || b === 10)) a.piano([69, 72, 76, 74][(bar + (b >> 3)) % 4], t, 0.13, 1.4);
    if (L >= 3 && b === 0 && bar % 2 === 0) a.pad([57, 60, 64], t, d * 32, 0.018, 700);
    if (L >= 4 && bar % 8 === 0 && [0, 4, 8].includes(b)) a.glass([76, 83, 81][b / 4], t, 0.03);
    if (bar % 8 === 0 && b === 0) a.glass(88, t, 0.018);
  } });
  registerTheme('m6-tower', { bpm: 60, step(a, s, t, d) { // the stopped tower: pendulum, bowed metal, rising with each collar
    const bar = Math.floor(s / 16), b = s % 16, n = towerState.set;
    if (b === 0) a.tick(t, 0.05, 4200); if (b === 8) a.tick(t, 0.04, 2900);
    if (b === 0 && bar % 4 === 0) a.cello(33, t, d * 64, 0.05);
    if (b === 0 && bar % 2 === 1) [81, 88].forEach((k, i) => a.glass(k - (bar % 4 === 1 ? 0 : 2), t + i * d * 3, 0.016));
    if (n >= 1 && b === 0 && bar % 2 === 0) a.pad([57, 60, 64, 71], t, d * 32, 0.016, 600);
    if (n >= 2 && (b === 4 || b === 12)) a.drum(t, 0.08, 70, 40);
    if (n >= 3 && b % 4 === 0) a.piano([64, 67, 69, 71][(b >> 2)] + 12 * (bar % 2), t, 0.14, 2);
    if (bar % 4 === 2 && [0, 6, 12].includes(b)) a.piano([52, 59, 57][b / 6], t, 0.16, 4);
  } });
  registerTheme('m6-witness', { bpm: 54, step(a, s, t, d) { // the recording: Kai's motif slower, lower, weary
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0 && bar % 2 === 0) { a.cello(33, t, d * 32, 0.06); a.cello(40, t + d * 2, d * 28, 0.03); }
    if (bar % 2 === 0 && [0, 7, 13].includes(b)) a.piano([52, 59, 57][[0, 7, 13].indexOf(b)], t, 0.22, 5);
    if (b === (bar * 5) % 16 && bar % 2) a.glass(76 - (bar % 3) * 2, t, 0.016);
    if (b === 0 && bar % 3 === 0) a.tick(t, 0.03, 2600);
  } });
}

// ---------------------------------------------------------------------------------------------
// The house
// ---------------------------------------------------------------------------------------------
// Key positions used by the mission script.
export const P = {
  streetStart: [0, 0, 38], door: [0, 0, 8.4], shopIn: [0, 0, 6.6], workDoor: [0, 0, -1.0],
  landing: [0, 0.36, -2.4], pivot: [0, -11], armR: 7.0,
  hammerZ: [-19.8, -21.8, -23.8], gateZ: -29.2, studyIn: [0, 0, -30.4],
  mantel: [-6.4, 1.55, -35.5], bookcase: [6.0, 0, -34.5], arch: [6.2, -34.5], desk: [2.4, 0, -38.6], armchair: [-4.6, 0, -32.4],
  stairTop: [7.0, TY, -34.2], shaft: [-0.5, -35], lowCollar: TY + 1.2, midCollar: TY + 3.6, highCollar: TY + 5.8,
  scaffoldTop: TY + 2.6, ledgeTop: TY + 4.8, plaque: [-1.5, 0, -45.5],
};

export function buildHouse(game, T, opts = {}) {
  const scene = game.scene, R = rng(606), q = game.engine.quality || 'medium';
  RZ.init(game.engine.renderer, { quality: q });
  const groups = { all: new THREE.Group() }; scene.add(groups.all);
  for (const e of ERAS) { groups[e] = new THREE.Group(); groups[e].name = 'era' + e; scene.add(groups[e]); T.only(groups[e], e); }
  const arch = { all: new Batch() }, props = { all: new Batch() };
  for (const e of ERAS) { arch[e] = new Batch(); props[e] = new Batch(); }
  const col = (states, min, max, o) => game.collision.add(min, max, { ...(states ? { states } : {}), ...o });
  const S = (e, obj) => { groups[e].add(obj); return obj; };
  const world = { groups, dyn: [], updaters: [], P };

  // ---------- materials ----------
  const pm = (kind, params, o = {}) => RZ.pbrMaterial(kind, { params, mapping: 'world', ...o });
  const moss = { kind: 'moss', amount: 0.22, ground: 0.12 };
  const M = world.M = {
    cobble: pm('cutStone', { color: 0x4f4c48, joint: 0x1e1c1a, rows: 12, weathering: 0.7, wet: 1, variation: 0.6 }, { scale: 0.4, envMapIntensity: 1.3 }),
    kerb: pm('cutStone', { color: 0x6a6660, joint: 0x2a2826, rows: 3, wet: 1 }, { scale: 0.6 }),
    facade: pm('plaster', { color: 0x8c7c66, damage: 0.45, dirt: 0.7, wet: 0.6 }),
    facadeBrick: pm('brick', { color: 0x5e3426, soot: 0.6, wet: 0.5 }),
    stoneTrim: pm('cutStone', { color: 0x8a8070, rows: 2, weathering: 0.6 }),
    towerStone: pm('cutStone', { color: 0x7a7266, joint: 0x4a443c, rows: 7, weathering: 0.7 }),
    slate: pm('paintedMetalPanel', { color: 0x2c3034, cols: 6, rows: 12, wear: 0.5, grime: 0.6, gloss: 0.4, wet: 0.8 }),
    iron: pm('paintedMetalPanel', { color: 0x2e3a34, cols: 1, rows: 1, wear: 0.55, grime: 0.6, gloss: 0.5 }),
    machine: pm('paintedMetalPanel', { color: 0x46564a, cols: 4, rows: 2, wear: 0.65, grime: 0.55, gloss: 0.45 }),
    steel: pm('brushedMetal', { color: 0x8a8c8e, smudge: 0.6 }),
    rust: pm('rust', { amount: 0.75 }),
    concrete: pm('concrete', { color: 0x3e3a34, stains: 1, formwork: 0, cracks: 0.12, pores: 0.8 }),
    oak: pm('wood', { color: 0x4a3120, planks: 3, variation: 0.4 }),
    darkWood: pm('wood', { color: 0x2e1e14, planks: 2 }),
    floor: {
      '2026': pm('wood', { color: 0x7a5434, planks: 12, variation: 0.5 }),
      '2049': pm('wood', { color: 0x5a3e28, planks: 12, weathered: 0.35, variation: 0.6 }),
      '2196': pm('wood', { color: 0x463c30, planks: 12, weathered: 1 }, { overlay: moss }),
    },
    wall: {
      '2026': pm('plaster', { color: 0xcdbb98, under: 0xc2ae8a, damage: 0, dirt: 0.04 }),
      '2049': pm('plaster', { color: 0x9e8c70, damage: 0.4, dirt: 0.6 }),
      '2196': pm('plaster', { color: 0x6e665a, damage: 0.95, dirt: 0.9 }, { overlay: { ...moss, amount: 0.28, ground: 0.25 } }),
    },
    panel: {
      '2026': pm('wood', { color: 0x4a2c1a, planks: 6 }),
      '2049': pm('wood', { color: 0x352216, planks: 6, weathered: 0.3 }),
      '2196': pm('wood', { color: 0x2e2a22, planks: 6, weathered: 1 }, { overlay: moss }),
    },
    rubble: pm('concrete', { color: 0x6a645a, formwork: 0, stains: 1, cracks: 1 }, { overlay: { ...moss, amount: 0.3 } }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc89a4a, metalness: 0.65, roughness: 0.34 }),
    brassDark: new THREE.MeshStandardMaterial({ color: 0x8a6a34, metalness: 0.6, roughness: 0.45 }),
    blackIron: new THREE.MeshStandardMaterial({ color: 0x222326, metalness: 0.55, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xa8c0cc, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.16, envMapIntensity: 1.4, depthWrite: false }),
    glassDirty: new THREE.MeshPhysicalMaterial({ color: 0x8a8c78, metalness: 0, roughness: 0.4, transparent: true, opacity: 0.4, depthWrite: false }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x5a1e1a, roughness: 0.95 }),
    rug: new THREE.MeshStandardMaterial({ map: canvasTex(512, 384, (g, w, h) => {
      const r = rng(41); g.fillStyle = '#6a1c16'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 4000; k++) { g.fillStyle = `rgba(${40 + r() * 60},${10 + r() * 20},${10},${r() * 0.12})`; g.fillRect(r() * w, r() * h, 2, 2); }
      g.strokeStyle = '#1e2a3a'; g.lineWidth = 26; g.strokeRect(22, 22, w - 44, h - 44); g.strokeStyle = '#c89a50'; g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16); g.strokeRect(36, 36, w - 72, h - 72);
      for (let x = 30; x < w - 20; x += 22) for (const y of [22, h - 22]) { g.fillStyle = '#b8863e'; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y); g.lineTo(x, y + 6); g.lineTo(x - 6, y); g.fill(); }
      const cx = w / 2, cy = h / 2;
      for (const [rx, ry, c] of [[150, 110, '#1e2a3a'], [130, 92, '#8a2a1e'], [96, 66, '#c89a50'], [80, 54, '#2a3a4a'], [44, 30, '#a83a24'], [20, 14, '#e0c080']]) { g.fillStyle = c; g.beginPath(); g.moveTo(cx, cy - ry); g.quadraticCurveTo(cx + rx * 0.5, cy - ry * 0.5, cx + rx, cy); g.quadraticCurveTo(cx + rx * 0.5, cy + ry * 0.5, cx, cy + ry); g.quadraticCurveTo(cx - rx * 0.5, cy + ry * 0.5, cx - rx, cy); g.quadraticCurveTo(cx - rx * 0.5, cy - ry * 0.5, cx, cy - ry); g.fill(); }
      for (const [x, y] of [[70, 70], [w - 70, 70], [70, h - 70], [w - 70, h - 70]]) { g.fillStyle = '#1e2a3a'; g.beginPath(); g.arc(x, y, 22, 0, 7); g.fill(); g.fillStyle = '#c89a50'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
    }, 'm6rug2'), roughness: 1 }),
  };
  for (const k of ['iron', 'steel', 'rust', 'concrete']) M[k].envMapIntensity = 0.8;

  // =====================================================================================
  // STREET (old clock quarter, rain) — shared by all eras, tinted per era by the lighting rig
  // =====================================================================================
  const A = arch.all, B = props.all;
  A.box(M.cobble, -3.3, -0.3, 8.4, 3.3, 0, 48);                       // lane
  A.box(M.cobble, -7.6, -0.3, 8.4, 7.6, 0, 14.2);                      // court in front of the house
  for (const s of [-1, 1]) { A.box(M.kerb, s * 3.3, -0.3, 14.2, s * 4.6, 0.14, 48); }
  col(null, [-30, -1, 8.4], [30, 0, 60]);
  col(null, [-4.6, 0, 14.2], [-3.3, 0.14, 48]); col(null, [3.3, 0, 14.2], [4.6, 0.14, 48]);
  // neighbours: rows of old houses along the lane and flanking the court
  const bld = (x0, x1, z0, z1, face, o) => {
    const yaw = face === '+x' ? Math.PI / 2 : face === '-x' ? -Math.PI / 2 : 0;
    const w = face === '+z' ? x1 - x0 : z1 - z0, d = face === '+z' ? z1 - z0 : x1 - x0;
    return { width: w, depth: d, position: [(x0 + x1) / 2, o.y ?? 0, (z0 + z1) / 2], yaw, ...o };
  };
  const list = [];
  let z = 14.2; const walls = ['plaster', 'brick', 'stone', 'darkBrick', 'plaster', 'brick'];
  for (let i = 0; z < 47; i++) { const w = 6 + R() * 4; list.push(bld(-14, -4.6, z, Math.min(48, z + w), '+x', { height: 11 + R() * 7, seed: 10 + i, wall: walls[i % 6], groundFloor: 3.9, faces: ['shop', 'windows', 'blank', 'blank'], roof: { tank: false } })); z += w; }
  z = 14.2;
  for (let i = 0; z < 47; i++) { const w = 6 + R() * 4; list.push(bld(4.6, 14, z, Math.min(48, z + w), '-x', { height: 11 + R() * 8, seed: 30 + i, wall: walls[(i + 3) % 6], groundFloor: 3.9, faces: ['shop', 'windows', 'blank', 'blank'], roof: { tank: false } })); z += w; }
  list.push(bld(-22, -7.7, -1, 14.2, '+z', { height: 15, seed: 51, wall: 'brick', faces: ['windows', 'windows', 'blank', 'blank'], groundFloor: 4 }));
  list.push(bld(7.7, 22, -1, 14.2, '+z', { height: 16, seed: 52, wall: 'plaster', faces: ['windows', 'blank', 'blank', 'windows'], groundFloor: 4 }));
  list.push(bld(-22, -8.65, -44, -1, '+z', { height: 17, seed: 53, wall: 'darkBrick', faces: ['blank', 'blank', 'windows', 'windows'], groundFloor: 4 }));
  list.push(bld(9.85, 22, -44, -1, '+z', { height: 18, seed: 54, wall: 'stone', faces: ['blank', 'windows', 'windows', 'blank'], groundFloor: 4 }));
  list.push(bld(-24, 24, -66, -52, '+z', { height: 19, seed: 55, wall: 'brick', faces: ['windows', 'blank', 'blank', 'blank'], groundFloor: 4 }));
  list.push(bld(-7.7, 7.7, -0.6, 8.55, '+z', { y: 4.1, height: 5.6, seed: 61, wall: 'plaster', groundFloor: 0.2, floorHeight: 2.6, faces: ['windows', 'blank', 'blank', 'blank'], roof: { parapet: 0.5, tank: false, hvac: 0, antenna: 0, bulkhead: false } }));
  const block = RZ.cityBlock(list, { lit: 0.32, daylight: 0 });
  groups.all.add(block.mesh); world.facade = block.material;
  // house front: ground floor with the shop window, door, stone plinth and the sign
  const front = (mat, x0, y0, x1, y1) => { A.box(mat, x0, y0, 8.0, x1, y1, 8.45); };
  front(M.facadeBrick, -7.7, 0, -6.4, 4.1); front(M.facadeBrick, 6.4, 0, 7.7, 4.1);
  front(M.facadeBrick, -1.4, 0, -0.75, 4.1); front(M.facadeBrick, 0.75, 0, 1.4, 4.1);
  front(M.facadeBrick, -6.4, 0, -1.4, 0.7); front(M.facadeBrick, 1.4, 0, 6.4, 0.7);
  front(M.stoneTrim, -6.4, 3.2, 6.4, 4.1); front(M.facadeBrick, -0.75, 2.55, 0.75, 3.2);
  B.box(M.stoneTrim, -7.8, 3.95, 8.3, 7.8, 4.15, 8.75);                                           // cornice over the shop
  for (const x of [-6.4, -1.4, 1.4, 6.4]) B.box(M.darkWood, x - 0.08, 0.7, 8.25, x + 0.08, 3.2, 8.55);
  for (const [x0, x1] of [[-6.4, -1.4], [1.4, 6.4]]) { B.box(M.darkWood, x0, 0.62, 8.2, x1, 0.74, 8.6); for (let k = 1; k < 3; k++) B.box(M.darkWood, x0 + (x1 - x0) * k / 3 - 0.03, 0.74, 8.3, x0 + (x1 - x0) * k / 3 + 0.03, 3.2, 8.36); }
  for (const [x0, x1] of [[-6.4, -1.4], [1.4, 6.4]]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 2.46), M.glass); g.position.set((x0 + x1) / 2, 1.95, 8.33); groups.all.add(g); }
  col(null, [-7.7, 0, 8.0], [-0.75, 4.1, 8.45]); col(null, [0.75, 0, 8.0], [7.7, 4.1, 8.45]);
  // door (opens inward)
  const door = new THREE.Group(); door.position.set(-0.72, 0, 8.22); groups.all.add(door);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.44, 2.5, 0.07), M.oak); leaf.position.set(0.72, 1.25, 0); leaf.castShadow = true; door.add(leaf);
  const dglass = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), opts.brokenDoor ? M.glassDirty : M.glass); dglass.position.set(0.72, 1.7, 0.04); door.add(dglass);
  if (opts.brokenDoor) { const board = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.03), M.darkWood); board.position.set(0.72, 1.75, 0.07); board.rotation.z = 0.35; door.add(board); const b2 = board.clone(); b2.rotation.z = -0.3; b2.position.y = 1.5; door.add(b2); }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), M.brass); knob.position.set(1.28, 1.1, 0.06); door.add(knob);
  world.door = door; world.doorCol = col(null, [-0.75, 0, 8.0], [0.75, 2.6, 8.45]);
  // bracket sign + lamps
  const signTex = textPlate([{ text: 'HENSEL', font: '700 64px "Cinzel", Georgia, serif' }, 'UHREN · CLOCKS · REPAIRS', 'SINCE 1961'], { bg: '#1e2a24', ink: '#d8b468', w: 512, h: 256 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 0.06), [M.darkWood, M.darkWood, M.darkWood, M.darkWood, new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5, metalness: 0.3, emissive: 0xffd8a0, emissiveMap: signTex, emissiveIntensity: 0.25 }), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5 })]);
  sign.position.set(-2.4, 4.9, 9.4); sign.rotation.y = Math.PI / 2; groups.all.add(sign);
  B.box(M.blackIron, -2.42, 5.35, 8.45, -2.38, 5.4, 10.35);
  const bracketClock = settableClock(0.32, clockFace({ name: 'HENSEL', aged: true }), { h: 8, m: 14, glow: 0.5 }); bracketClock.position.set(-2.4, 5.9, 10.0); bracketClock.rotation.y = 0; groups.all.add(bracketClock);
  world.bracketClock = bracketClock;
  const lampMat = glowMat(0xffc88a, 4);
  for (const x of [-3.4, 3.4]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), lampMat); l.position.set(x, 3.0, 8.75); groups.all.add(l); }
  world.lampMat = lampMat;
  // lamp posts along the lane + bollards
  for (const [x, zz, ry] of [[-3.0, 18, Math.PI / 2], [3.0, 27, -Math.PI / 2], [-3.0, 37, Math.PI / 2]]) { const lp = lampPost(0xffc890, 5.4); lp.position.set(x, 0, zz); lp.rotation.y = ry; bake(B, lp); col(null, [x - 0.15, 0, zz - 0.15], [x + 0.15, 4, zz + 0.15]); }
  for (let k = 0; k < 6; k++) { const s = k % 2 ? 1 : -1; B.cyl(M.blackIron, s * 3.0, 0.45, 15 + Math.floor(k / 2) * 9, 0.1, 0.9, 10); }
  // puddles (reflective decals)
  const pud = new THREE.Mesh(new THREE.PlaneGeometry(6, 30), new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.02, metalness: 0.9, transparent: true, opacity: 0.55, alphaMap: decalTex('puddle'), depthWrite: false, envMapIntensity: 2 }));
  pud.rotation.x = -Math.PI / 2; pud.position.set(0, 0.012, 28); groups.all.add(pud);
  // awnings over the neighbours' shops
  for (const [x, zz, s] of [[-4.6, 22, 1], [4.6, 33, -1], [-4.6, 40, 1]]) { const aw = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 4), new THREE.MeshStandardMaterial({ color: [0x5a1e1a, 0x1e3a2a, 0x2a2a4a][Math.abs(Math.round(zz)) % 3], roughness: 0.9 })); aw.position.set(x + s * 0.7, 3.4, zz); aw.rotation.z = s * 0.25; groups.all.add(aw); }
  // the tower seen from the street: stone shaft above the workshop roof, pyramid roof, great dial
  A.box(M.slate, -8.4, 9.2, -29.2, 8.4, 9.5, -0.8);                                                     // workshop roof deck
  A.box(M.slate, 8.6, 9.0, -32.2, 9.85, 9.4, -1); A.box(M.slate, -8.65, 9.0, -29.6, -8.6, 9.4, -1);
  const roofG = new THREE.CylinderGeometry(0.02, 1, 1, 4, 1); roofG.rotateY(Math.PI / 4);
  for (const e of ['2026', '2049']) { arch[e].geo(M.slate, roofG, [-0.4, 21 + 2.6, -35], [0, 0, 0], [9.6, 5.2, 8.6]); arch[e].cyl(M.brassDark, -0.4, 27, -35, 0.08, 2.4, 8); }
  for (const [x0, x1, z0, z1] of [[-7.4, 6.6, -29.4, -28.9], [-7.4, 6.6, -41.4, -40.9], [-7.4, -6.9, -41.4, -28.9], [6.1, 6.6, -41.4, -28.9]]) {
    for (const e of ['2026', '2049']) arch[e].box(M.towerStone, x0, 9.2, z0, x1, 21, z1);
    arch['2196'].box(M.towerStone, x0, 9.2, z0, x1, x0 < -7 ? 17.5 : z0 < -41 ? 15.5 : 19, z1);
  }
  // great dial, outside face (shows 8:14 in 2049 — the moment every clock in the city stopped)
  const dialOut = {};
  for (const e of ERAS) {
    const d = settableClock(3.1, clockFace({ name: 'HENSEL', sub: 'MCMLXI', aged: e !== '2026', broken: e === '2196', paper: e === '2196' ? '#8a8270' : '#efe4c8' }), { h: e === '2026' ? 3 : e === '2049' ? 8 : 9, m: e === '2049' ? 14 : 0, glow: e === '2049' ? 0.55 : 0.15, noBody: true });
    d.position.set(-0.4, 15, -28.85); S(e, d); dialOut[e] = d;
  }
  world.dialOut = dialOut;

  // =====================================================================================
  // SHOP  x[-7.2, 7.2]  z[-0.8, 8.0]  ceiling 3.8
  // =====================================================================================
  for (const e of ERAS) {
    const a = arch[e], p = props[e];
    a.box(M.floor[e], -7.2, -0.2, -1.2, 7.2, 0, 8.0);
    a.box(M.wall[e], -7.6, 0, -1.2, -7.2, 4.1, 8.0); a.box(M.wall[e], 7.2, 0, -1.2, 7.6, 4.1, 8.0);
    a.box(M.panel[e], -7.2, 0, 7.9, -6.4, 4.0, 8.0); a.box(M.panel[e], 6.4, 0, 7.9, 7.2, 4.0, 8.0);
    // back wall with the workshop door (x -0.8..0.8)
    a.box(M.wall[e], -7.2, 0, -1.2, -0.85, 4.1, -0.8); a.box(M.wall[e], 0.85, 0, -1.2, 7.2, 4.1, -0.8); a.box(M.wall[e], -0.85, 2.45, -1.2, 0.85, 4.1, -0.8);
    // wainscot
    for (const [x0, z0, x1, z1] of [[-7.2, -0.8, -7.1, 7.9], [7.1, -0.8, 7.2, 7.9], [-7.1, -0.8, -0.85, -0.7], [0.85, -0.8, 7.1, -0.7]]) p.box(M.panel[e], x0, 0, z0, x1, 1.0, z1);
    if (e !== '2196') {
      a.box(M.wall[e], -7.2, 3.8, -1.2, 7.2, 4.1, 8.0);                         // ceiling
      for (let k = 0; k < 5; k++) p.box(M.darkWood, -7.2, 3.55, 0.2 + k * 1.8, 7.2, 3.8, 0.45 + k * 1.8); // beams
    } else {
      a.box(M.wall[e], -7.2, 3.8, -1.2, 7.2, 4.1, 2.2); a.box(M.wall[e], -7.2, 3.8, 5.8, 7.2, 4.1, 8.0); a.box(M.wall[e], -7.2, 3.8, 2.2, -3.0, 4.1, 5.8);
      for (const [x, zz, rx] of [[0.6, 3.4, 0.5], [3.4, 4.6, -0.35]]) p.boxc(M.darkWood, x, 1.6, zz, 4.2, 0.25, 0.25, 0.6, rx, 0.7);   // fallen beams
      for (let k = 0; k < 9; k++) { const x = -1 + R() * 6, zz = 2.5 + R() * 3.4, s = 0.4 + R() * 0.7; p.boxc(M.rubble, x, s / 2, zz, s * 1.4, s, s, R() * 3); }
      col(['2196'], [-0.4, 0, 2.6], [5.6, 0.9, 5.4]);
    }
    // counter (west), display case (east), grandfather clocks, workbench by the window
    p.box(M.panel[e], -5.6, 0, 0.6, -4.7, 1.0, 5.8); p.box(e === '2196' ? M.rubble : M.oak, -5.7, 1.0, 0.5, -4.6, 1.06, 5.9);
    col([e], [-5.7, 0, 0.5], [-4.6, 1.06, 5.9]);
    p.box(M.darkWood, 4.9, 0, 0.8, 6.7, 0.8, 6.2); p.box(M.brassDark, 4.85, 0.8, 0.75, 6.75, 0.85, 6.25);
    col([e], [4.85, 0, 0.75], [6.75, 1.2, 6.25]);
    for (const x of [-4.6, -3.5, 3.5, 4.6]) { p.box(M.darkWood, x - 0.32, 0, -0.75, x + 0.32, 2.15, -0.35); p.box(M.darkWood, x - 0.36, 2.15, -0.8, x + 0.36, 2.35, -0.3); col([e], [x - 0.36, 0, -0.8], [x + 0.36, 2.3, -0.3]); }
    p.box(M.oak, -7.1, 0, 4.2, -6.0, 0.9, 7.6); p.box(M.darkWood, -7.15, 0.9, 4.1, -5.9, 0.95, 7.7); col([e], [-7.1, 0, 4.1], [-5.9, 0.95, 7.7]);
    if (e !== '2196') { const gl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.36, 5.4), M.glass); gl.position.set(5.8, 1.03, 3.5); S(e, gl); }
  }
  col(null, [-7.2, -1, -1.2], [7.2, 0, 8.4]); col(null, [-7.6, 0, -1.2], [-7.2, 4.1, 8.0]); col(null, [7.2, 0, -1.2], [7.6, 4.1, 8.0]);
  col(null, [-7, -1, -41], [6.2, 0, -29.6]);
  // the wall of clocks (east wall + back wall + window displays); racing and skipping in 2049
  const faces = [clockFace({ name: 'HENSEL', aged: true }), clockFace({ arabic: true, paper: '#f4f0e6', edge: '#d8d0c0' }), clockFace({ paper: '#e8d8b0', aged: true, ink: '#3a1a0a' })];
  const clocks = [];
  for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) { const zz = 0.4 + k * 1.0 + (row % 2) * 0.45; if (zz > 7.4) continue; clocks.push({ p: [7.08, 1.55 + row * 0.72, zz], ry: -Math.PI / 2, r: 0.18 + R() * 0.14, face: Math.floor(R() * 3), off: R() * 600, rate: 0.5 + R() * 0.2, skip: true }); }
  for (let k = 0; k < 9; k++) { const x = -6.4 + k * 0.72; if (Math.abs(x) < 1.2) continue; clocks.push({ p: [x, 2.7 + (k % 2) * 0.35, -0.68], ry: 0, r: 0.16 + R() * 0.08, face: k % 3, off: R() * 600, rate: 0.5, skip: true }); }
  for (const [x0, x1] of [[-6.2, -1.6], [1.6, 6.2]]) for (let k = 0; k < 4; k++) clocks.push({ p: [x0 + (x1 - x0) * (k + 0.5) / 4, 1.1 + (k % 2) * 0.5, 7.86], ry: Math.PI, r: 0.2 + R() * 0.06, face: (k + 1) % 3, off: R() * 600, rate: 0.5, skip: true });
  // the four longcase clocks along the back wall: dial in the hood, a brass pendulum window below
  for (const [k, x] of [-4.6, -3.5, 3.5, 4.6].entries()) clocks.push({ p: [x, 1.86, -0.33], ry: 0, r: 0.22, face: k % 3, off: R() * 600, rate: 0.5, skip: true });
  for (const e of ['2026', '2049', '2196']) for (const x of [-4.6, -3.5, 3.5, 4.6]) {
    props[e].box(M.brassDark, x - 0.2, 0.5, -0.36, x + 0.2, 1.5, -0.33); props[e].box(M.blackIron, x - 0.16, 0.54, -0.335, x + 0.16, 1.46, -0.33);
    props[e].box(M.brass, x - 0.012, 0.8, -0.33, x + 0.012, 1.42, -0.32); props[e].cyl(M.brass, x, 0.8, -0.32, 0.09, 0.02, 16, [Math.PI / 2, 0, 0]);
  }
  const shopClocks = clockSet(clocks, faces, { glow: 0.05 });
  groups['2049'].add(shopClocks.group);
  const pastClocks = clockSet(clocks.map(c => ({ ...c, rate: 1 / 60, skip: false, off: 900 + R() * 4 })), faces, { glow: 0.04 });
  groups['2026'].add(pastClocks.group);
  world.updaters.push((dt, t) => { shopClocks.update(t * 0.5); pastClocks.update(t); });
  world.shopClocks = shopClocks;
  // 2196: a few fallen clocks + one still on the wall
  const ruinClocks = clockSet([{ p: [7.08, 2.2, 3.1], ry: -Math.PI / 2, r: 0.3, face: 0, fixed: 9 * 60 }, { p: [2.4, 0.06, 1.4], ry: 0, r: 0.24, face: 1, fixed: 125 }, { p: [-2.8, 0.08, 4.6], ry: 0.5, r: 0.2, face: 2, fixed: 540 }], faces);
  groups['2196'].add(ruinClocks.group);
  // pendant lamps (2026 / 2049)
  for (const e of ['2026', '2049']) { const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.34, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a3a2a, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide })); shade.position.set(0, 3.0, 3.5); S(e, shade); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), glowMat(0xffd8a8, 6)); bulb.position.set(0, 2.88, 3.5); S(e, bulb); props[e].box(M.blackIron, -0.01, 3.17, 3.49, 0.01, 3.8, 3.51); }
  // ledger on the 2026 counter (Varen children) + 2049 counter clutter
  const ledger = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.36), [M.cloth, M.cloth, new THREE.MeshStandardMaterial({ map: paperTex('ledger'), roughness: 0.9 }), M.cloth, M.cloth, M.cloth]);
  ledger.position.set(-5.15, 1.08, 3.7); ledger.rotation.y = Math.PI / 2 + 0.15; S('2026', ledger);
  for (let k = 0; k < 6; k++) props['2049'].boxc(M.brassDark, -5.15 + (R() - 0.5) * 0.6, 1.1, 2 + R() * 3, 0.12 + R() * 0.12, 0.04, 0.12 + R() * 0.1, R() * 3);

  // =====================================================================================
  // WORKSHOP  x[-8.2, 8.2]  z[-29.2, -1.2]  ceiling 9.2 — locked to 2049 (the loop pins it)
  // =====================================================================================
  {
    const a = arch['2049'], p = props['2049'];
    a.box(M.concrete, -8.2, -0.2, -29.2, 8.2, 0, -1.2);
    a.box(M.facadeBrick, -8.6, 0, -29.2, -8.2, 9.2, -1.2); a.box(M.facadeBrick, 8.2, 0, -29.2, 8.6, 9.2, -1.2);
    a.box(M.wall['2049'], -8.2, 0, -1.2, -0.85, 9.2, -0.8); a.box(M.wall['2049'], 0.85, 0, -1.2, 8.2, 9.2, -0.8); a.box(M.wall['2049'], -0.85, 2.45, -1.2, 0.85, 9.2, -0.8);
    // back wall with the escapement gate (x -1.1..1.1)
    a.box(M.facadeBrick, -8.2, 0, -29.6, -1.1, 9.2, -29.2); a.box(M.facadeBrick, 1.1, 0, -29.6, 8.2, 9.2, -29.2); a.box(M.facadeBrick, -1.1, 2.7, -29.6, 1.1, 9.2, -29.2);
    a.box(M.iron, -8.2, 8.9, -29.2, 8.2, 9.2, -1.2);
    col(null, [-8.6, -1, -29.6], [8.6, 0, -0.8]);
    col(null, [-8.6, 0, -29.6], [-8.2, 9, -0.8]); col(null, [8.2, 0, -29.6], [8.6, 9, -0.8]);
    col(null, [-8.2, 0, -1.2], [-0.85, 9, -0.8]); col(null, [0.85, 0, -1.2], [8.2, 9, -0.8]);
    col(null, [-8.2, 0, -29.6], [-1.1, 9, -29.2]); col(null, [1.1, 0, -29.6], [8.2, 9, -29.2]);
    // roof trusses + skylights
    for (let k = 0; k < 7; k++) { const zz = -3.2 - k * 4; p.box(M.iron, -8.2, 7.9, zz - 0.15, 8.2, 8.2, zz + 0.15); for (const s of [-1, 1]) p.boxc(M.iron, s * 4.2, 8.45, zz, 0.14, 1.0, 0.14, 0, 0, s * 0.9); }
    const sky = glowMat(0x3a4a62, 0.6); world.skylight = sky;
    { const sb = new Batch(); for (let k = 0; k < 6; k++) sb.geo(sky, new THREE.PlaneGeometry(3.2, 2.6), [k % 2 ? 3.6 : -3.6, 8.88, -5.2 - Math.floor(k / 2) * 8], [Math.PI / 2, 0, 0]); sb.build(groups['2049'], { cast: false, name: 'skylights' }); }
    // landing (raised) with the drive gearbox
    a.box(M.oak, -3.2, 0, -3.5, 3.2, 0.36, -1.2); col(null, [-3.2, 0, -3.5], [3.2, 0.36, -1.2]);
    for (const x of [-3.15, 3.15]) { p.box(M.blackIron, x - 0.04, 0.36, -3.45, x + 0.04, 1.4, -1.25); p.box(M.blackIron, x - 0.05, 1.32, -3.5, x + 0.05, 1.4, -1.2); col(null, [x - 0.06, 0.36, -3.5], [x + 0.06, 1.4, -1.2]); }
    for (const x of [-2.4, 2.4]) { p.box(M.blackIron, x - 0.8, 1.32, -3.48, x + 0.8, 1.4, -3.4); for (let k = 0; k < 5; k++) p.box(M.blackIron, x - 0.8 + k * 0.4 - 0.02, 0.36, -3.48, x - 0.8 + k * 0.4 + 0.02, 1.34, -3.42); col(null, [x - 0.85, 0.36, -3.52], [x + 0.85, 1.4, -3.38]); }
    p.box(M.iron, 2.2, 0.36, -2.0, 3.1, 1.5, -1.25); col(null, [2.2, 0.36, -2.0], [3.1, 1.5, -1.25]);           // gearbox housing
    p.box(M.oak, -3.1, 0.36, -2.0, -2.0, 1.25, -1.3); col(null, [-3.1, 0.36, -2.0], [-2.0, 1.25, -1.3]);       // bench with the wedge
  }
  world.wedgeHome = new THREE.Vector3(-2.55, 1.29, -1.65);
  const wedge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.12, 0.34, 3), M.brass); wedge.rotation.z = Math.PI / 2; wedge.position.copy(world.wedgeHome); groups['2049'].add(wedge); world.wedge = wedge;
  const driveGear = new THREE.Mesh(gearGeometry(0.42, 16, 0.08), M.brass); driveGear.position.set(2.65, 1.55, -1.95); groups['2049'].add(driveGear); world.driveGear = driveGear;
  {
    const p = props['2049'];
    // side machinery along the walls (blocks the safe wall path in the arm's reach)
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) { const zz = -5.6 - k * 2.9; p.box(M.iron, s * 6.55, 0, zz - 1.2, s * 8.2, 1.05, zz + 1.2); p.box(M.steel, s * 6.7, 1.05, zz - 0.9, s * 8.0, 1.25, zz + 0.9); p.cyl(M.steel, s * 7.3, 1.45, zz, 0.2, 1.4, 14, [Math.PI / 2, 0, 0]); }
      col(null, [Math.min(s * 6.55, s * 8.2), 0, -18.0], [Math.max(s * 6.55, s * 8.2), 1.25, -4.2]);
      for (let k = 0; k < 3; k++) { const zz = -6 - k * 4; p.box(M.oak, s * 7.7, 1.6, zz - 1.4, s * 8.2, 1.65, zz + 1.4); p.box(M.oak, s * 7.7, 2.3, zz - 1.4, s * 8.2, 2.35, zz + 1.4); for (let j = 0; j < 5; j++) p.boxc(j % 2 ? M.brassDark : M.darkWood, s * 7.95, 1.8, zz - 1.1 + j * 0.55, 0.3, 0.3, 0.4); }
      // hammer-line machine walls
      p.box(M.machine, s * 1.42, 0, -25.0, s * 8.2, 2.6, -18.6);
      for (let k = 0; k <= 6; k++) p.box(M.steel, s * 1.36, 0, -24.95 + k * 1.05, s * 1.42, 2.6, -24.83 + k * 1.05);   // rib plates
      p.box(M.brassDark, s * 1.34, 2.5, -25.05, s * 1.6, 2.68, -18.55); p.box(M.blackIron, s * 1.36, 0, -25.0, s * 1.42, 0.22, -18.6);
      p.cyl(M.brass, s * 1.3, 1.95, -21.8, 0.05, 6.3, 10, [Math.PI / 2, 0, 0]); p.cyl(M.rust, s * 1.31, 0.75, -21.8, 0.07, 6.3, 10, [Math.PI / 2, 0, 0]);
      for (const zz of [-24.3, -22.8, -20.8, -19.3]) { p.box(M.blackIron, s * 1.3, 1.25, zz - 0.18, s * 1.38, 1.6, zz + 0.18); p.cyl(M.brass, s * 1.29, 1.42, zz, 0.11, 0.03, 14, [0, 0, Math.PI / 2]); }
      col(null, [Math.min(s * 1.42, s * 8.2), 0, -25.0], [Math.max(s * 1.42, s * 8.2), 2.6, -18.6]);
      for (let k = 0; k < 3; k++) { p.box(M.steel, s * 2.2, 2.6, -24 + k * 2, s * 3.6, 3.4, -23 + k * 2); p.cyl(M.rust, s * 5.2, 3.1, -21.8, 0.5, 1.0, 16); }
      for (let k = 0; k < 4; k++) p.cyl(M.steel, s * 1.5, 1.6, -19 - k * 1.8, 0.07, 3.2, 8, [0, 0, 0]);
      // benches around the gate zone
      p.box(M.oak, s * 5.0, 0, -28.9, s * 8.1, 0.95, -26.2); p.box(M.darkWood, s * 4.95, 0.95, -28.95, s * 8.15, 1.0, -26.15); col(null, [Math.min(s * 4.95, s * 8.15), 0, -28.95], [Math.max(s * 4.95, s * 8.15), 1.0, -26.15]);
      for (let k = 0; k < 7; k++) p.boxc(M.brass, s * (5.5 + R() * 2.2), 1.05, -27.2 - R() * 1.4, 0.15, 0.04, 0.15, R() * 3);
    }
    // the pivot column
    p.cyl(M.iron, P.pivot[0], 4.6, P.pivot[1], 0.55, 9.2, 24);
    p.cyl(M.brassDark, P.pivot[0], 0.25, P.pivot[1], 1.0, 0.5, 24);
    col(null, [-0.6, 0, P.pivot[1] - 0.6], [0.6, 9, P.pivot[1] + 0.6]);
    // line shafts with pulleys near the ceiling
    for (const s of [-1, 1]) { p.box(M.iron, s * 4.0 - 0.1, 7.2, -28.8, s * 4.0 + 0.1, 7.4, -1.6); for (let k = 0; k < 6; k++) p.box(M.iron, s * 4.0 - 0.06, 7.4, -3 - k * 4.8, s * 4.0 + 0.06, 8.9, -2.8 - k * 4.8); }
    // hammer frames (static parts): posts and crossbars; red paint under heads, yellow gaps
    for (const hz of P.hammerZ) { for (const s of [-1, 1]) p.box(M.iron, s * 1.25, 0, hz - 0.18, s * 1.6, 4.6, hz + 0.18); p.box(M.iron, -1.6, 4.3, hz - 0.3, 1.6, 4.8, hz + 0.3); col(null, [1.25, 0, hz - 0.2], [1.62, 4.6, hz + 0.2]); col(null, [-1.62, 0, hz - 0.2], [-1.25, 4.6, hz + 0.2]); }
    const hazM = new THREE.MeshStandardMaterial({ map: decalTex('hazard'), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const safeM = new THREE.MeshStandardMaterial({ map: decalTex('safe'), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const db = new Batch();
    for (const hz of P.hammerZ) db.geo(hazM, new THREE.PlaneGeometry(2.4, 1.0), [0, 0.012, hz], [-Math.PI / 2, 0, 0]);
    for (let k = 0; k < 2; k++) db.geo(safeM, new THREE.PlaneGeometry(2.4, 0.9), [0, 0.012, (P.hammerZ[k] + P.hammerZ[k + 1]) / 2], [-Math.PI / 2, 0, 0]);
    db.build(groups['2049'], { cast: false, name: 'decals' });
    // anvil plates
    for (const hz of P.hammerZ) p.box(M.steel, -1.2, 0, hz - 0.45, 1.2, 0.05, hz + 0.45);
  }
  // big wall gears (rotate with the loop)
  const gears = [];
  for (const [x, y, zz, r, n, s] of [[-8.12, 4.6, -8, 1.6, 28, 1], [-8.1, 5.6, -12.2, 1.1, 20, -1], [8.12, 4.8, -10, 1.8, 30, -1], [8.1, 6.4, -14.6, 1.0, 18, 1], [0, 6.6, -29.15, 1.9, 32, 1]]) {
    const gm = new THREE.Mesh(gearGeometry(r, n, 0.16), r > 1.5 ? M.brassDark : M.brass); gm.position.set(x, y, zz);
    if (Math.abs(x) > 1) gm.rotation.y = Math.PI / 2; gm.castShadow = true; groups['2049'].add(gm); gears.push({ m: gm, s: s / r });
  }
  world.gears = gears;
  // the great arm
  const armG = new THREE.Group(); armG.position.set(P.pivot[0], 0, P.pivot[1]); groups['2049'].add(armG);
  {
    const ab = new Batch();
    ab.box(M.brass, 0.5, 0.5, -0.2, P.armR - 0.3, 1.35, 0.2);
    ab.box(M.iron, 0.5, 1.35, -0.12, P.armR - 0.4, 1.5, 0.12);
    for (let k = 0; k < 6; k++) ab.boxc(M.iron, 1.0 + k * 1.0, 0.92, 0, 0.08, 0.82, 0.44);
    ab.cyl(M.iron, P.armR - 0.2, 0.92, 0, 0.42, 1.1, 18);
    ab.cyl(M.brassDark, 0, 0.92, 0, 0.75, 1.0, 24);
    ab.boxc(M.blackIron, 3.6, 5.0, 0, 0.06, 7.6, 0.06, 0, 0, -0.42);
    ab.build(armG, { name: 'arm' });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), glowMat(0xff6a3a, 0.4)); lamp.position.set(P.armR - 0.2, 1.62, 0); armG.add(lamp); world.armLamp = lamp;
  }
  world.arm = armG;
  world.armBoxes = Array.from({ length: 7 }, () => col(['2049'], [0, -9, 0], [0, -9, 0]));
  // hammers (heads move)
  world.hammers = P.hammerZ.map(hz => {
    const g = new THREE.Group(); g.position.set(0, 3.0, hz); groups['2049'].add(g);
    const hb = new Batch(); hb.box(M.iron, -1.2, 0, -0.45, 1.2, 0.9, 0.45); hb.box(M.steel, -1.22, 0, -0.47, 1.22, 0.12, 0.47); hb.box(M.rust, -0.18, 0.9, -0.18, 0.18, 1.8, 0.18); hb.build(g, { name: 'hammer' });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), glowMat(0xff3020, 0.2)); lamp.position.set(1.42, 4.9, hz); groups['2049'].add(lamp);
    return { g, z: hz, lamp, box: col(['2049'], [-1.2, 3, hz - 0.45], [1.2, 3.9, hz + 0.45]), y: 3 };
  });
  // the escapement gate (two sliding leaves) + its lamp + escapement anchor above it
  const gate = { L: new THREE.Group(), R: new THREE.Group(), open: 0 };
  for (const [g, s] of [[gate.L, -1], [gate.R, 1]]) {
    const gb = new Batch(); gb.box(M.iron, 0, 0, -0.12, 1.12, 2.7, 0.12); for (let k = 0; k < 5; k++) gb.box(M.brass, 0.1, 0.3 + k * 0.5, 0.12, 1.02, 0.36 + k * 0.5, 0.15); gb.box(M.brassDark, 0.04, 1.2, -0.16, 0.12, 1.5, 0.16); gb.build(g, { name: 'gate' });
    g.position.set(s < 0 ? -1.12 : 0, 0, -29.4); g.userData.s = s; groups['2049'].add(g);
  }
  gate.col = col(['2049'], [-1.1, 0, -29.6], [1.1, 2.7, -29.2]);
  gate.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), glowMat(0xff3020, 2)); gate.lamp.position.set(0, 3.0, -29.1); groups['2049'].add(gate.lamp);
  const anchor = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 0.12), M.iron); anchor.position.set(0, 5.2, -29.05); groups['2049'].add(anchor); gate.anchor = anchor;
  world.gate = gate;
  // workshop door (back of the shop) — open only in 2049 after the intro; closed in 2026, blocked in 2196
  const wdoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.08), M.oak); wdoor.position.set(0, 1.2, -1.0); groups.all.add(wdoor);
  world.workDoor = wdoor; world.workDoorCol = col(null, [-0.85, 0, -1.2], [0.85, 2.45, -0.8]);
  for (let k = 0; k < 5; k++) props['2196'].boxc(M.rubble, -0.6 + R() * 1.2, 0.3 + k * 0.35, -0.6 - R() * 0.4, 0.8, 0.5, 0.5, R() * 3);

  // =====================================================================================
  // STUDY  x[-7, 6.2]  z[-41, -29.6]  ceiling 4.6 ; garden beyond (z < -41)
  // =====================================================================================
  const spineMat = {};
  for (const e of ERAS) { const t = spinesTex(e === '2026' ? 2 : 9, e === '2049' ? 0.4 : 0).clone(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(2.5, 0.5); t.needsUpdate = true; spineMat[e] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, emissive: 0x1a120a, emissiveIntensity: 0.25 }); }
  for (const e of ERAS) {
    const a = arch[e], p = props[e], ruin = e === '2196';
    a.box(M.floor[e], -7, -0.2, -41, 6.2, 0, -29.6);
    // walls: south wall exists via workshop back wall in 2049; other eras need their own (the gate is closed there)
    if (e !== '2049') { a.box(M.wall[e], -7, 0, -29.95, 6.2, 4.6, -29.6); col([e], [-7, 0, -29.95], [6.2, 4.6, -29.6]); }
    else { a.box(M.wall[e], -7, 0, -29.95, -1.1, 4.6, -29.62); a.box(M.wall[e], 1.1, 0, -29.95, 6.2, 4.6, -29.62); a.box(M.wall[e], -1.1, 2.7, -29.95, 1.1, 4.6, -29.62); }
    // west wall with fireplace
    a.box(M.wall[e], -7.4, 0, -41, -7, 4.6, -29.6); col([e], [-7.4, 0, -41], [-7, 4.6, -29.6]);
    // north wall with two windows (2196: broken through to the garden x -3.5..1.5)
    const holesN = ruin ? [[-3.5, 1.5, 0, 3.2]] : [[-5.2, -3.6, 1.0, 3.2], [-0.2, 1.4, 1.0, 3.2]];
    wallX(a, M.wall[e], -41.4, -41, -7, 6.2, 0, 4.6, holesN, 'x');
    colWallCells(col, [e], -41.4, -41, -7, 6.2, 0, 4.6, holesN);
    if (!ruin) for (const h of holesN) { const g = new THREE.Mesh(new THREE.PlaneGeometry(h[1] - h[0], h[3] - h[2]), M.glass); g.position.set((h[0] + h[1]) / 2, (h[2] + h[3]) / 2, -41.2); S(e, g); p.box(M.darkWood, h[0] - 0.08, h[2] - 0.12, -41.05, h[1] + 0.08, h[2], -40.85); p.box(M.darkWood, (h[0] + h[1]) / 2 - 0.03, h[2], -41.25, (h[0] + h[1]) / 2 + 0.03, h[3], -41.15); }
    // east wall with the archway (z -35.5..-33.5); 2196: collapsed above y 1.2 between z -38..-31
    const holesE = ruin ? [[-38.2, -31, 0.9, 4.6]] : [[-35.5, -33.5, 0, 2.8]];
    wallX(a, M.wall[e], 6.2, 6.6, -41, -29.6, 0, 4.6, holesE, 'z');
    colWallCells(col, [e], 6.2, 6.6, -41, -29.6, 0, 4.6, holesE, 'z');
    if (e === '2049') world.archBlock = col(['2049'], [6.2, 0, -35.5], [6.6, 2.8, -33.5]);
    // ceiling (tower floor slab) — 2196 has the hole the great dial fell through
    if (!ruin) a.box(M.panel[e], -7, 4.6, -41, 6.2, 5.0, -29.6);
    else { a.box(M.panel[e], -3.4, 4.6, -41, 6.2, 5.0, -29.6); a.box(M.panel[e], -7, 4.6, -36.6, -3.4, 5.0, -29.6); a.box(M.panel[e], -7, 4.6, -41, -3.4, 5.0, -40.6); }
    for (let k = 0; k < 4; k++) p.box(M.darkWood, -7, 4.3, -31.4 - k * 2.8, 6.2, 4.6, -31.1 - k * 2.8);
    p.box(M.panel[e], -7, 0, -41, -6.9, 1.1, -29.6);
    // fireplace
    p.box(M.stoneTrim, -7, 0, -36.9, -6.3, 1.45, -36.4); p.box(M.stoneTrim, -7, 0, -34.6, -6.3, 1.45, -34.1); p.box(M.stoneTrim, -7.05, 1.45, -37.2, -6.1, 1.6, -33.8);
    p.box(M.blackIron, -7, 0, -36.4, -6.7, 1.2, -34.6); col([e], [-7, 0, -37.2], [-6.1, 1.6, -33.8]);
    // desk, chair, armchair, rug, shelves on the north wall
    if (!ruin) {
      p.box(M.oak, 1.3, 0.78, -39.4, 3.5, 0.84, -37.8); for (const [x, zz] of [[1.4, -39.3], [3.4, -39.3], [1.4, -37.9], [3.4, -37.9]]) p.box(M.darkWood, x - 0.05, 0, zz - 0.05, x + 0.05, 0.78, zz + 0.05);
      p.box(M.darkWood, 1.35, 0.5, -39.35, 1.95, 0.78, -37.85); col([e], [1.3, 0, -39.4], [3.5, 0.84, -37.8]);
      p.box(M.cloth, -5.2, 0, -33.0, -4.0, 0.45, -31.8); p.box(M.cloth, -5.2, 0.45, -33.0, -5.0, 1.15, -31.8); p.box(M.cloth, -5.2, 0.45, -33.0, -4.0, 0.7, -32.85); p.box(M.cloth, -5.2, 0.45, -31.95, -4.0, 0.7, -31.8);
      col([e], [-5.2, 0, -33.0], [-4.0, 0.7, -31.8]);
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), M.rug); rug.rotation.x = -Math.PI / 2; rug.position.set(-1.6, 0.01, -35.2); S(e, rug);
    } else {
      p.boxc(M.oak, 2.4, 0.3, -38.6, 2.2, 0.08, 1.6, 0.4, 0.3, 0.2);
      for (let k = 0; k < 14; k++) { const x = 3 + R() * 3, zz = -38 + R() * 7, s = 0.3 + R() * 0.8; p.boxc(M.rubble, x, s / 2, zz, s * 1.3, s, s, R() * 3); }
      col(['2196'], [3.2, 0, -37.6], [5.8, 0.8, -31.4]);
    }
    // bookshelves along the north wall between the windows
    for (const [x0, x1] of ruin ? [[-7, -3.6], [1.6, 6.2]] : [[-3.4, -0.4], [1.6, 4.0]]) {
      p.box(M.darkWood, x0, 0, -40.95, x1, 3.6, -40.5);
      for (let k = 0; k < 4; k++) p.box(M.darkWood, x0, 0.25 + k * 0.85, -40.95, x1, 0.29 + k * 0.85, -40.45);
      if (!ruin) for (let k = 0; k < 4; k++) p.geo(spineMat[e], new THREE.PlaneGeometry(x1 - x0 - 0.1, 0.62), [(x0 + x1) / 2, 0.6 + k * 0.85, -40.6], [0, 0, 0], [1, 1, 1]);
      col([e], [x0, 0, -40.95], [x1, 3.6, -40.45]);
    }
  }
  // 2026: the archway with an iron gate, opened by the mantel clock at IX
  {
    const p = props['2026'];
    p.box(M.stoneTrim, 6.1, 2.8, -35.7, 6.7, 3.1, -33.3); for (const zz of [-35.6, -33.4]) p.box(M.stoneTrim, 6.1, 0, zz - 0.12, 6.7, 2.8, zz + 0.12);
    const ig = new THREE.Group(); ig.position.set(6.3, 0, -33.5); S('2026', ig);
    const gb = new Batch(); for (let k = 0; k < 8; k++) gb.box(M.blackIron, -0.03, 0, -0.1 - k * 0.25, 0.03, 2.7, -0.06 - k * 0.25); gb.box(M.blackIron, -0.04, 0.2, -2.0, 0.04, 0.28, 0); gb.box(M.blackIron, -0.04, 2.5, -2.0, 0.04, 2.58, 0); gb.box(M.brass, -0.06, 1.2, -1.95, 0.06, 1.4, -1.8); gb.build(ig, { name: 'irongate' });
    world.ironGate = ig; world.ironGateCol = col(['2026'], [6.15, 0, -35.5], [6.5, 2.8, -33.5]);
  }
  // 2049: the bookcase over the archway (hinged at z = -32.4)
  {
    const bc = new THREE.Group(); bc.position.set(6.1, 0, -32.4); S('2049', bc);
    const bb = new Batch(); bb.box(M.darkWood, -0.45, 0, -4.2, 0, 3.3, 0); for (let k = 0; k < 5; k++) bb.box(M.oak, -0.47, 0.2 + k * 0.72, -4.2, 0, 0.25 + k * 0.72, 0); bb.build(bc, { name: 'bookcase' });
    { const sb = new Batch(); for (let k = 0; k < 4; k++) sb.geo(spineMat['2049'], new THREE.PlaneGeometry(4.0, 0.6), [-0.47, 0.55 + k * 0.72, -2.1], [0, -Math.PI / 2, 0]); sb.build(bc, { name: 'spines' }); }
    world.bookcase = bc; world.bookcaseCol = col(['2049'], [5.65, 0, -36.6], [6.2, 3.3, -32.4]);
    const scratch = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 4.3), new THREE.MeshBasicMaterial({ map: decalTex('scratch'), transparent: true, depthWrite: false, opacity: 0.9 }));
    scratch.rotation.x = -Math.PI / 2; scratch.rotation.z = Math.PI / 2; scratch.position.set(6.1 - 2.15, 0.012, -32.4 - 2.15); S('2049', scratch); world.scratch = scratch;
  }
  // mantel clocks (settable) in 2026 and 2049
  world.mantel = {};
  for (const e of ['2026', '2049']) { const mc = settableClock(0.16, clockFace({ aged: e === '2049', seed: 7 }), { h: 4, m: 0, depth: 0.12 }); mc.position.set(-6.17, 1.84, -35.5); mc.rotation.y = Math.PI / 2; S(e, mc); props[e].box(M.oak, -6.55, 1.6, -35.78, -6.18, 2.08, -35.22); props[e].box(M.brass, -6.58, 2.08, -35.82, -6.15, 2.12, -35.18); props[e].box(M.brass, -6.58, 1.6, -35.82, -6.15, 1.64, -35.18); world.mantel[e] = mc; }
  // fire
  const fireLight = glowMat(0xff7a30, 3); const fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); fire.position.set(-6.85, 0.3, -35.5); S('2026', fire);
  const embers = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 1.2), fireLight); embers.position.set(-6.85, 0.05, -35.5); groups.all.add(embers); world.embers = embers; world.fire = fire;
  // letters on the 2049 desk (debt), plaque in the 2196 garden (debt)
  const letters = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.3), [M.cloth, M.cloth, new THREE.MeshStandardMaterial({ map: paperTex('letter'), roughness: 0.9 }), M.cloth, M.cloth, M.cloth]);
  letters.position.set(2.6, 0.86, -38.6); letters.rotation.y = 0.3; S('2049', letters);
  for (let k = 0; k < 7; k++) props['2049'].boxc(M.wall['2026'], 2.9 + R() * 0.4, 0.86 + k * 0.012, -38.3 - R() * 0.3, 0.24, 0.01, 0.16, R());
  const blueprint = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.52), new THREE.MeshStandardMaterial({ map: paperTex('blueprint'), roughness: 0.9 })); blueprint.rotation.x = -Math.PI / 2; blueprint.position.set(2.3, 0.85, -38.6); S('2026', blueprint);

  // garden (beyond the north wall): walls all eras, wild in 2196
  {
    const a = arch.all;
    a.box(M.facadeBrick, -7.4, 0, -50.4, 6.6, 3.2, -50); a.box(M.facadeBrick, -7.8, 0, -50.4, -7.4, 3.2, -41.4); a.box(M.facadeBrick, 6.6, 0, -50.4, 7.0, 3.2, -41.4);
    col(null, [-7.8, 0, -50.4], [7, 3.2, -50]); col(null, [-7.8, 0, -50.4], [-7.4, 3.2, -41.4]); col(null, [6.6, 0, -50.4], [7, 3.2, -41.4]);
    a.box(M.cobble, -7.4, -0.2, -50, 6.6, 0, -41.4); col(null, [-7.4, -1, -50], [6.6, 0, -41.4]);
    const dirt = pm('dirt', { color: 0x4a3a28, damp: 0.6 }, { overlay: { kind: 'moss', amount: 0.6, ground: 1 } });
    arch['2196'].box(dirt, -7.4, -0.15, -50, 6.6, 0.02, -41.4);
    // 2196 tree + plaque stone
    try {
      const t = RZ.tree({ species: 'broadleaf', seed: 66, height: 8 });
      const bark = pm('bark', {}, { mapping: 'triplanar', space: 'object' });
      const tg = new THREE.Group(); tg.add(new THREE.Mesh(t.trunk, bark), new THREE.Mesh(t.leaves, RZ.foliageMaterial('broadleaf'))); tg.position.set(-4.4, 0, -46.4); S('2196', tg);
      tg.children.forEach(c => { c.castShadow = true; });
      const sap = new THREE.Group(); const t2 = RZ.tree({ species: 'shrub', seed: 12, height: 1.8 }); sap.add(new THREE.Mesh(t2.trunk, bark), new THREE.Mesh(t2.leaves, RZ.foliageMaterial('broadleaf'))); sap.position.set(-4.4, 0, -46.4); S('2026', sap);
      const t3 = RZ.tree({ species: 'broadleaf', seed: 70, height: 4.5 }); const mid = new THREE.Group(); mid.add(new THREE.Mesh(t3.trunk, bark), new THREE.Mesh(t3.leaves, RZ.foliageMaterial('broadleaf'))); mid.position.set(-4.4, 0, -46.4); S('2049', mid);
    } catch (err) { console.warn('m6 tree', err); }
    col(null, [-4.8, 0, -46.8], [-4.0, 3, -46.0]);
    const ps = props['2196']; ps.box(M.stoneTrim, P.plaque[0] - 0.5, 0, P.plaque[2] - 0.3, P.plaque[0] + 0.5, 0.8, P.plaque[2] + 0.3); col(['2196'], [P.plaque[0] - 0.5, 0, P.plaque[2] - 0.3], [P.plaque[0] + 0.5, 0.8, P.plaque[2] + 0.3]);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.42), new THREE.MeshStandardMaterial({ map: textPlate(['LOTTE HENSEL', '2018 – 2101', 'who waited for the clock to stop'], { bg: '#5a4a2a', ink: '#1a1208', size: 40 }), roughness: 0.4, metalness: 0.7 }));
    pl.position.set(P.plaque[0], 0.62, P.plaque[2] + 0.31); pl.rotation.x = -0.35; S('2196', pl);
    try {
      const iv = RZ.ivy({ edges: [[[-7.4, 3.2, -50], [6.6, 3.2, -50], [0, 0, 1]], [[-7, 4.6, -41.05], [-3.5, 4.6, -41.05], [0, 0, 1]], [[6.6, 4.6, -40], [6.6, 4.6, -30], [1, 0, 0]]], patches: [{ center: [-1, 0, -41.0], normal: [0, 0, -1], width: 5, height: 3 }, { center: [0, 0, 7.9], normal: [0, 0, -1], width: 10, height: 3 }], seed: 6, density: 3 });
      S('2196', iv);
    } catch (err) { console.warn('m6 ivy', err); }
  }

  // =====================================================================================
  // STAIRWELL  x[6.2, 9.4]  z[-41.6, -32.6]   (two flights, 10 steps of 0.25)
  // =====================================================================================
  for (const e of ERAS) {
    const a = arch[e], p = props[e];
    a.box(M.floor[e], 6.2, -0.2, -41.6, 9.4, 0, -32.6); a.box(M.panel[e], 6.2, 10, -42, 9.8, 10.3, -32.2);
    a.box(M.wall[e], 9.4, 0, -41.6, 9.8, 10, -32.6); a.box(M.wall[e], 6.2, 0, -32.6, 9.8, 10, -32.2); a.box(M.wall[e], 6.2, 0, -42.0, 9.8, 10, -41.6);
    col([e], [9.4, 0, -41.6], [9.8, 10, -32.6]); col([e], [6.2, 0, -32.6], [9.8, 10, -32.2]); col([e], [6.2, 0, -42], [9.8, 10, -41.6]);
    col([e], [6.2, -1, -41.6], [9.4, 0, -32.6]);
    for (let k = 1; k <= 10; k++) {
      if (e === '2196' && k <= 6) continue;
      const y = 0.25 * k, z0 = -35.6 - 0.5 * k, z1 = z0 + 0.5;
      a.box(M.oak, 7.8, y - 0.25, z0, 9.4, y, z1); col([e], [7.8, y - 0.3, z0], [9.4, y, z1]);
    }
    a.box(M.oak, 6.62, 2.25, -41.6, 9.4, 2.5, -40.6); col([e], [6.2, 2.0, -41.6], [9.4, 2.5, -40.6]);
    for (let k = 1; k <= 10; k++) { const y = 2.5 + 0.25 * k, z0 = -40.6 + 0.5 * (k - 1); a.box(M.oak, 6.62, y - 0.25, z0, 7.8, y, z0 + 0.5); col([e], [6.2, y - 0.3, z0], [7.8, y, z0 + 0.5]); }
    a.box(M.oak, 6.2, TY - 0.25, -35.6, 7.8, TY, -32.6); col([e], [6.2, TY - 0.3, -35.6], [7.8, TY, -32.6]);
    // balustrade between the flights + newel posts
    p.box(M.darkWood, 7.75, 0, -40.6, 7.85, 3.5, -35.6); col([e], [7.72, 0, -40.6], [7.88, 6.2, -35.6]);
    p.box(M.darkWood, 6.2, TY, -32.7, 7.8, TY + 1.0, -32.6);
    if (e === '2196') for (let k = 0; k < 6; k++) p.boxc(M.rubble, 8.6 + (R() - 0.5), 0.25, -36.4 - k * 0.6, 0.6, 0.5, 0.5, R() * 3);
  }
  // =====================================================================================
  // TOWER  floor TY, x[-7, 6.2], z[-41, -29.6], up to 21
  // =====================================================================================
  for (const e of ERAS) {
    const a = arch[e], p = props[e], ruin = e === '2196';
    if (!ruin) { a.box(M.floor[e], -7, TY - 0.05, -41, 6.2, TY, -29.6); col([e], [-7, TY - 0.4, -41], [6.2, TY, -29.6]); }
    else { // the floor with the hole the great dial fell through (x -6.6..-3.4, z -40.6..-36.6)
      a.box(M.floor[e], -3.4, TY - 0.05, -41, 6.2, TY, -29.6); a.box(M.floor[e], -7, TY - 0.05, -36.6, -3.4, TY, -29.6); a.box(M.floor[e], -7, TY - 0.05, -41, -3.4, TY, -40.6);
      col([e], [-3.4, TY - 0.4, -41], [6.2, TY, -29.6]); col([e], [-7, TY - 0.4, -36.6], [-3.4, TY, -29.6]); col([e], [-7, TY - 0.4, -41], [-3.4, TY, -40.6]);
    }
    const top = ruin ? 17 : 21;
    a.box(M.towerStone, -7.4, TY, -41.4, -7, top, -29.6); a.box(M.towerStone, -7.4, TY, -41.4, 6.6, top, -41);
    a.box(M.towerStone, -7.4, 9.2, -29.6, 6.6, top, -29.2);
    a.box(M.towerStone, 6.2, TY, -32.6, 6.6, top, -29.6); a.box(M.towerStone, 6.2, TY, -41.4, 6.6, top, -35.6); a.box(M.towerStone, 6.2, TY + 2.6, -35.6, 6.6, top, -32.6);
    a.box(M.wall[e], -7, TY, -29.6, 6.2, 9.2, -29.4);
    col([e], [-7.4, TY, -41.4], [-7, 21, -29.6]); col([e], [-7.4, TY, -41.4], [6.6, 21, -41]); col([e], [-7, TY, -29.6], [6.2, 21, -29.2]);
    col([e], [6.2, TY, -32.6], [6.6, 21, -29.6]); col([e], [6.2, TY, -41.4], [6.6, 21, -35.6]);
    if (!ruin) { a.box(M.panel[e], -7.4, 21, -41.4, 6.6, 21.3, -29.2); for (let k = 0; k < 5; k++) p.box(M.darkWood, -7, 20.4, -31 - k * 2.4, 6.2, 20.7, -30.7 - k * 2.4); }
    // the shaft and its gear housing
    p.cyl(M.iron, P.shaft[0], TY + 6.5, P.shaft[1], 0.22, 13, 16);
    p.box(M.iron, P.shaft[0] - 1.3, 18, P.shaft[1] - 1.3, P.shaft[0] + 1.3, 19.4, P.shaft[1] + 1.3);
    col([e], [P.shaft[0] - 0.3, TY, P.shaft[1] - 0.3], [P.shaft[0] + 0.3, 19, P.shaft[1] + 0.3]);
    p.box(M.brassDark, P.shaft[0] - 0.7, TY, P.shaft[1] - 0.7, P.shaft[0] + 0.7, TY + 0.6, P.shaft[1] + 0.7); col([e], [P.shaft[0] - 0.7, TY, P.shaft[1] - 0.7], [P.shaft[0] + 0.7, TY + 0.6, P.shaft[1] + 0.7]);
    // a horizontal drive rod up to the great dial (z -29.6)
    p.cyl(M.iron, P.shaft[0], 14.5, -32.3, 0.12, 5.4, 10, [Math.PI / 2, 0, 0]);
    // slit windows
    for (const zz of [-33, -37.5]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.2), glowMat(e === '2026' ? 0xffe8c0 : e === '2049' ? 0x384860 : 0xc8d8e8, e === '2026' ? 2.2 : 0.8)); w.position.set(-6.98, 12, zz); w.rotation.y = Math.PI / 2; S(e, w); }
  }
  // great dial from inside (translucent glass, mirrored numerals, light from outside)
  world.dialIn = {};
  for (const e of ERAS) {
    const d = settableClock(3.1, clockFace({ mirror: true, glass: true, paper: e === '2196' ? 'rgba(120,120,110,0.5)' : 'rgba(240,226,190,0.55)', edge: 'rgba(200,180,140,0.3)', name: 'HENSEL', sub: 'MCMLXI', broken: e === '2196' }), { h: e === '2026' ? 3 : e === '2049' ? 8 : 9, m: e === '2049' ? 14 : 0, mirror: true, transparent: true, opacity: 0.92, glow: e === '2026' ? 1.1 : e === '2049' ? 0.85 : 0.35, noBody: true, double: true });
    d.position.set(-0.4, 15, -29.38); d.rotation.y = Math.PI; S(e, d); world.dialIn[e] = d;
  }
  // service dial on the shaft (readable: the hour each age keeps)
  world.service = {};
  for (const e of ERAS) {
    const d = settableClock(0.42, clockFace({ name: 'O.H.', sub: e, aged: e !== '2026', broken: e === '2196', paper: e === '2196' ? '#a89c80' : '#efe4c8', seed: 11 }), { h: e === '2026' ? 3 : e === '2049' ? 8 : 9, m: e === '2049' ? 14 : 0, glow: 0.18 });
    d.position.set(P.shaft[0] + 0.62, TY + 2.2, P.shaft[1]); d.rotation.y = Math.PI / 2; S(e, d); world.service[e] = d;
    props[e].box(M.iron, P.shaft[0] + 0.2, TY + 2.15, P.shaft[1] - 0.05, P.shaft[0] + 0.56, TY + 2.25, P.shaft[1] + 0.05);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), new THREE.MeshStandardMaterial({ map: textPlate(['EACH AGE KEEPS', 'ITS OWN HOUR', '— O.H. 2026 —'], { bg: '#8a6a30', size: 40 }), metalness: 0.8, roughness: 0.35, emissive: 0x2a1a08 }));
    plate.position.set(P.shaft[0] + 0.71, TY + 0.32, P.shaft[1]); plate.rotation.y = Math.PI / 2; S(e, plate);
  }
  // the three collars (brass rings with a pointer), one reachable per era
  world.collars = [P.lowCollar, P.midCollar, P.highCollar].map((y, i) => {
    const g = new THREE.Group(); g.position.set(P.shaft[0], y, P.shaft[1]); groups.all.add(g);
    const cb = new Batch(); cb.geo(M.brass, new THREE.TorusGeometry(0.42, 0.09, 10, 36), [0, 0, 0], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; cb.boxc(M.brass, Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5, 0.06, k % 3 ? 0.1 : 0.2, 0.06, a); }
    cb.build(g, { name: 'collar' });
    const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), M.blackIron); ptr.position.set(0, 0.1, 0.6); const pv = new THREE.Group(); pv.add(ptr); g.add(pv);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glowMat(0xffb060, 0.2)); lamp.position.set(0.62, 0.14, 0); g.add(lamp);
    return { g, pv, lamp, value: [5, 1, 6][i] };
  });
  // 2026: scaffolding (crate steps up to the mid collar)
  {
    const p = props['2026'];
    const steps = [[4.6, 5.6, -40.4, -39.4, 0.4], [3.6, 4.6, -40.4, -39.4, 0.8], [2.6, 3.6, -40.4, -39.4, 1.2], [1.4, 2.6, -40.4, -39.2, 1.6], [1.4, 2.4, -39.2, -38.2, 2.0], [1.4, 2.4, -38.2, -36.6, 2.4]];
    for (const [x0, x1, z0, z1, h] of steps) { p.box(M.oak, x0, TY, z0, x1, TY + h, z1); col(['2026'], [x0, TY, z0], [x1, TY + h, z1]); }
    p.box(M.oak, 0.15, TY + 2.45, -36.6, 2.5, TY + 2.6, -33.4); col(['2026'], [0.15, TY + 2.2, -36.6], [2.5, TY + 2.6, -33.4]);
    for (const [x, zz] of [[0.2, -36.5], [2.45, -36.5], [0.2, -33.5], [2.45, -33.5]]) p.box(M.rust, x - 0.04, TY, zz - 0.04, x + 0.04, TY + 3.8, zz + 0.04);
    p.box(M.rust, 0.15, TY + 3.5, -36.6, 2.5, TY + 3.56, -36.52); p.box(M.rust, 2.42, TY + 3.5, -36.6, 2.5, TY + 3.56, -33.4);
    for (let k = 0; k < 5; k++) p.boxc(M.brass, 0.6 + R() * 1.6, TY + 2.65, -36 + R() * 2, 0.2, 0.05, 0.2, R() * 3);
  }
  // 2196: fallen beam and rubble steps up to a broken ledge beside the high collar
  {
    const p = props['2196'];
    const st = [[3.8, 4.8, -31, -29.8, 0.4], [2.8, 3.8, -31, -29.8, 0.8], [1.8, 2.8, -31, -29.8, 1.2], [0.8, 1.8, -31, -29.8, 1.6], [-0.2, 0.8, -31, -29.8, 2.0], [-1.2, -0.2, -31, -29.8, 2.4], [-2.2, -1.2, -31, -29.8, 2.8], [-3.3, -2.2, -31, -29.8, 3.2], [-3.3, -2.1, -32, -31, 3.6], [-3.3, -2.1, -33, -32, 4.0], [-3.3, -2.1, -33.6, -33, 4.4]];
    for (const [x0, x1, z0, z1, h] of st) { p.box(M.rubble, x0, TY + h - 0.45, z0, x1, TY + h, z1); col(['2196'], [x0, TY + h - 0.45, z0], [x1, TY + h, z1]); }
    p.box(M.rubble, -3.3, TY + 4.4, -36.4, -0.85, TY + 4.8, -33.6); col(['2196'], [-3.3, TY + 4.3, -36.4], [-0.85, TY + 4.8, -33.6]);
    p.boxc(M.darkWood, 0.6, TY + 1.8, -30.4, 9.4, 0.5, 0.5, 0.05, 0, 0.36);
    p.boxc(M.darkWood, -2.7, TY + 2.6, -34.4, 0.45, 0.45, 6, 0.1, 0.62, 0);
    for (let k = 0; k < 10; k++) { const x = -6 + R() * 3, zz = -40 + R() * 3, s = 0.4 + R() * 0.8; p.boxc(M.rubble, x, s / 2, zz, s * 1.4, s, s, R() * 3); }
    const fallen = settableClock(1.4, clockFace({ broken: true, paper: '#8a8270' }), { h: 9, m: 0, noBody: true }); fallen.position.set(-5.2, 0.4, -38.6); fallen.rotation.set(-1.3, 0, 0.4); S('2196', fallen);
  }
  // pendulum (swings in 2026, still in 2049, fallen in 2196)
  world.pendulum = {};
  for (const e of ['2026', '2049']) {
    const pg = new THREE.Group(); pg.position.set(P.shaft[0] + 1.6, 18, P.shaft[1] - 2.2); S(e, pg);
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.06, 9, 0.06), M.brassDark); rod.position.y = -4.5; pg.add(rod);
    const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 28), M.brass); bob.rotation.x = Math.PI / 2; bob.position.y = -9.0; pg.add(bob);
    world.pendulum[e] = pg;
  }
  props['2196'].boxc(M.brassDark, 2.6, TY + 0.1, -38.8, 0.08, 0.08, 8.6, 0.9, Math.PI / 2, 0);
  props['2196'].cyl(M.brass, -0.6, TY + 0.06, -36.5, 0.55, 0.12, 24);
  // top gears (turn in 2026)
  world.topGears = [];
  for (const e of ERAS) {
    for (const [x, y, zz, r, n] of [[P.shaft[0] + 1.6, 17.2, P.shaft[1] + 1.4, 1.2, 22], [P.shaft[0] - 1.4, 17.6, P.shaft[1] + 1.4, 0.8, 16]]) {
      const gm = new THREE.Mesh(gearGeometry(r, n, 0.14), e === '2196' ? M.rust : M.brassDark); gm.position.set(x, y, zz); S(e, gm); if (e === '2026') world.topGears.push({ m: gm, s: 1 / r });
    }
  }
  // the hidden compartment in the shaft base (opens at the end) + the recorder
  const comp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.62), M.brass); comp.position.set(P.shaft[0] + 0.72, TY + 0.3, P.shaft[1] - 0.0); groups['2049'].add(comp); world.compDoor = comp;
  const rec = new THREE.Group(); rec.position.set(P.shaft[0] + 0.55, TY + 0.62, P.shaft[1]); rec.visible = false; groups['2049'].add(rec);
  { const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.24), new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.5, metalness: 0.4 })); rec.add(body); for (const s of [-1, 1]) { const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20), M.brass); reel.position.set(s * 0.08, 0.07, 0); rec.add(reel); } const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.08), new THREE.MeshBasicMaterial({ map: textPlate(['K.V. — FOR WHEN THE CHILD RETURNS'], { bg: '#e8dcc0', size: 26, w: 512, h: 96 }) })); lbl.rotation.x = -Math.PI / 2; lbl.position.y = 0.065; lbl.position.z = 0.09; lbl.scale.set(0.9, 0.9, 1); rec.add(lbl); }
  world.recorder = rec;

  // ---------- optional: the lying clock (2026 display case) ----------
  // five carriage clocks standing on the display case; one of them shows a time that has not happened yet (8:14)
  {
    const caseM = new THREE.MeshStandardMaterial({ color: 0xb08a48, metalness: 0.75, roughness: 0.3 });
    const capM = new THREE.MeshStandardMaterial({ color: 0x6a4a24, metalness: 0.6, roughness: 0.4 });
    const cf = clockFace({ paper: '#f6efdc', edge: '#e0d2b0', arabic: true });
    const times = [[3, 0], [2, 52], [11, 40], [8, 14], [3, 0]];
    world.carriage = times.map((tm, i) => {
      const g = new THREE.Group(), z = 1.35 + i * 0.95;
      g.position.set(5.3, 1.21, z); g.rotation.y = -Math.PI / 2 + (i - 2) * 0.06; groups['2026'].add(g);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.2), caseM); body.position.y = 0.17; g.add(body);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.24), capM); top.position.y = 0.36; g.add(top);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 16, Math.PI), capM); handle.position.y = 0.38; g.add(handle);
      const face = settableClock(0.105, cf, { noBody: true, h: tm[0], m: tm[1], glow: 0.12 }); face.position.set(0, 0.18, 0.102); g.add(face);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.01), capM); door.position.set(0, 0.17, -0.105); g.add(door);
      return { g, face, door, time: tm, pos: [4.7, 1.4, z], cam: [3.55, 1.62, z + 0.45], look: [5.3, 1.42, z] };
    });
    // the boy's wristwatch, hidden inside the lying clock
    const watch = new THREE.Group();
    const wcase = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 20), new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 0.8, roughness: 0.3 })); watch.add(wcase);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.17), new THREE.MeshStandardMaterial({ color: 0x1e3a5a, roughness: 0.8 })); strap.position.y = -0.004; watch.add(strap);
    watch.position.set(5.12, 1.6, world.carriage[3].g.position.z); watch.rotation.set(0.5, 0.4, 0); watch.visible = false; groups['2026'].add(watch);
    world.boyWatch = watch;
  }
  // ---------- optional: the date drum on the pivot column + Hensel's locked drawer (2049 workshop) ----------
  {
    const blank = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.38), new THREE.MeshStandardMaterial({ map: textPlate(['·  ·  ·  ·'], { bg: '#2a2620', ink: '#c8b890', size: 120 }), emissive: 0xffffff, emissiveMap: textPlate(['·  ·  ·  ·'], { bg: '#2a2620', ink: '#c8b890', size: 120 }), emissiveIntensity: 0.25, roughness: 0.6 }));
    const yt = textPlate(['2031'], { bg: '#e8dcc0', ink: '#3a1a0a', size: 150 });
    const year = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.38), new THREE.MeshStandardMaterial({ map: yt, emissive: 0xffffff, emissiveMap: yt, emissiveIntensity: 0.55, roughness: 0.6 }));
    for (const m of [blank, year]) { m.position.set(P.pivot[0], 2.45, P.pivot[1] + 0.57); groups['2049'].add(m); }
    year.position.z += 0.004; year.visible = false;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.5, 0.05), M.brassDark); frame.position.set(P.pivot[0], 2.45, P.pivot[1] + 0.54); groups['2049'].add(frame);
    world.dateDrum = { blank, year };
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.26, 0.05), M.darkWood); drawer.position.set(-2.55, 0.92, -2.03); groups['2049'].add(drawer);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.02), M.brass); lock.position.set(0, 0, -0.035); drawer.add(lock);
    const lockText = textPlate(['20 · ·'], { bg: '#c89a4a', ink: '#2a1a08', size: 120 });
    const lockFace = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.08), new THREE.MeshBasicMaterial({ map: lockText })); lockFace.position.set(0, 0, -0.047); lockFace.rotation.y = Math.PI; drawer.add(lockFace);
    world.drawer = drawer;
  }

  // ---------- atmosphere ----------
  const dustW = new Motes(380, [-8, 0.2, -29, 8, 8.5, -1.5], 0xffe2b0, 0.05, 0.12); groups['2049'].add(dustW.mesh); world.updaters.push(dt => dustW.update(dt)); world.dust = dustW;
  const dustS = new Motes(200, [-7, 0.2, -41, 6, 4.4, -30], 0xffe2b0, 0.04, 0.1); groups['2026'].add(dustS.mesh); world.updaters.push(dt => dustS.update(dt));
  const dustT = new Motes(240, [-7, TY, -41, 6, 20, -29.6], 0xffe0b8, 0.06, 0.1); groups.all.add(dustT.mesh); world.updaters.push(dt => dustT.update(dt));
  const spores = new Motes(220, [-7, 0, -50, 6, 12, -29], 0xc8ffb0, 0.05, 0.2); groups['2196'].add(spores.mesh); world.updaters.push(dt => spores.update(dt));
  try {
    world.shaft = {};
    for (const e of ERAS) {
      const ls = RZ.lightShaft({ from: [-0.4, 15, -29.6], to: [-0.6, TY, -36.5], radius: [2.2, 3.4], color: e === '2026' ? 0xffd8a0 : e === '2049' ? 0xffb070 : 0xc8d8f0, intensity: e === '2026' ? 0.35 : e === '2049' ? 0.22 : 0.3 });
      S(e, ls); world.shaft[e] = ls;
    }
    const sb = RZ.lightShaft({ from: [-2, 6.5, 9], to: [-2.6, 0, 3], radius: [1.2, 2.0], color: 0xffd8a0, intensity: 0.28 }); S('2026', sb);
  } catch (err) { console.warn('m6 shafts', err); }
  let rain = null;
  try { rain = RZ.particles({ kind: 'rain', count: 3500 }); scene.add(rain); world.rain = rain; } catch (err) { console.warn('m6 rain', err); }

  // ---------- build all batches ----------
  arch.all.build(groups.all, { blockers: true, game, name: 'arch' }); props.all.build(groups.all, { name: 'props' });
  for (const e of ERAS) { arch[e].build(groups[e], { blockers: true, game, name: 'arch' + e }); props[e].build(groups[e], { name: 'props' + e }); }
  world.update = (dt, t) => { RZ.update(dt); for (const f of world.updaters) f(dt, t); };
  return world;
}

// Bake every mesh of an object hierarchy into a batch (keeps its materials, world transforms).
export function bake(batch, obj) {
  obj.updateMatrixWorld(true);
  obj.traverse(o => { if (!o.isMesh) return; const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); batch.push(o.material, g); });
}

// Wall in a vertical plane with rectangular holes, as boxes. axis 'x': wall spans x in [a0, a1] at z in [c0, c1];
// axis 'z': spans z in [a0, a1] at x in [c0, c1]. holes: [[u0, u1, v0, v1]] along the span and in y.
function cells(a0, a1, y0, y1, holes) {
  const us = [a0, a1], vs = [y0, y1];
  for (const h of holes) { us.push(Math.max(a0, Math.min(a1, h[0])), Math.max(a0, Math.min(a1, h[1]))); vs.push(Math.max(y0, Math.min(y1, h[2])), Math.max(y0, Math.min(y1, h[3]))); }
  const U = [...new Set(us)].sort((a, b) => a - b), Vv = [...new Set(vs)].sort((a, b) => a - b), out = [];
  for (let i = 0; i < U.length - 1; i++) for (let j = 0; j < Vv.length - 1; j++) {
    const u = (U[i] + U[i + 1]) / 2, v = (Vv[j] + Vv[j + 1]) / 2;
    if (holes.some(h => u > h[0] && u < h[1] && v > h[2] && v < h[3])) continue;
    out.push([U[i], U[i + 1], Vv[j], Vv[j + 1]]);
  }
  return out;
}
function wallX(batch, mat, c0, c1, a0, a1, y0, y1, holes, axis = 'x') {
  for (const [u0, u1, v0, v1] of cells(a0, a1, y0, y1, holes)) {
    if (axis === 'x') batch.box(mat, u0, v0, c0, u1, v1, c1); else batch.box(mat, c0, v0, u0, c1, v1, u1);
  }
}
function colWallCells(col, states, c0, c1, a0, a1, y0, y1, holes, axis = 'x') {
  for (const [u0, u1, v0, v1] of cells(a0, a1, y0, y1, holes)) {
    if (axis === 'x') col(states, [u0, v0, c0], [u1, v1, c1]); else col(states, [c0, v0, u0], [c1, v1, u1]);
  }
}
