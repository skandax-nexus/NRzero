// Procedural hair (docs/ART_SPEC.md §3): strand-textured cards grown over the scalp.
// Each card is a ribbon that starts at a root on the scalp, follows a style's flow field,
// bends under gravity and is pushed out of the head so the hair has real volume. A canvas
// texture draws hundreds of individual strands with wispy tips; vertex colours add root
// occlusion and per-lock variation; an anisotropic highlight runs along the strands.
// Beards and moustaches use the same cards rooted on the face.
import * as THREE from 'three';
import { hairlineY } from './hairline.js';

const cache = new Map();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function rngF(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- strand textures
function strandTexture(kind) {
  if (cache.has('tex' + kind)) return cache.get('tex' + kind);
  const W = 128, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), R = rngF(kind.length * 97 + 3);
  g.clearRect(0, 0, W, H);
  const N = kind === 'beard' ? 150 : 210;
  const wave = kind === 'curly' ? [9, 0.07] : kind === 'wavy' ? [4, 0.018] : kind === 'beard' ? [3, 0.05] : [1.2, 0.012];
  for (let k = 0; k < N; k++) {
    // strands crowd the middle of the card so its edges are soft
    const u = W / 2 + (R() + R() + R() - 1.5) * W * 0.42;
    const tip = H * (R() < 0.6 ? R() * 0.18 : 0.18 + R() * 0.5); // where the strand ends (canvas top = card tip)
    const ph = R() * 6.28, amp = wave[0] * (0.6 + R() * 0.8), lum = 150 + R() * 105;
    g.strokeStyle = `rgba(${lum | 0},${lum | 0},${lum | 0},${0.75 + R() * 0.25})`;
    g.lineWidth = kind === 'beard' ? 1.6 + R() : 1.1 + R() * 1.3;
    g.beginPath(); g.moveTo(u, H);
    for (let y = H; y >= tip; y -= 8) g.lineTo(u + Math.sin(y * wave[1] + ph) * amp + (H - y) * (R() - 0.5) * 0.004, y);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  cache.set('tex' + kind, tex); return tex;
}
function anisoMap() {
  if (cache.has('aniso')) return cache.get('aniso');
  const d = new Uint8Array(4 * 4 * 4); for (let i = 0; i < 16; i++) { d[i * 4] = 128; d[i * 4 + 1] = 255; d[i * 4 + 2] = 255; d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, 4, 4); t.needsUpdate = true; cache.set('aniso', t); return t;
}
function hairMaterial(color, kind) {
  const m = new THREE.MeshPhysicalMaterial({
    color, map: strandTexture(kind), alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide, vertexColors: true,
    roughness: 0.55, metalness: 0, anisotropy: 0.45, anisotropyMap: anisoMap(), specularIntensity: 0.38, specularColor: new THREE.Color(color).lerp(new THREE.Color(0xfff0e0), 0.45), envMapIntensity: 0.6,
  });
  m.name = 'hair';
  return m;
}

// ---------------------------------------------------------------- growth
const UP = new THREE.Vector3(0, 1, 0);
function tangentOf(v, n) { return v.clone().addScaledVector(n, -v.dot(n)).normalize(); }

function makeCollider(head) {
  const C = head.scalp.center, pt = head.scalp.point;
  const ears = [head.landmarks.earL, head.landmarks.earR];
  const q = new THREE.Vector3();
  return (p, clr, cling = 0) => {
    q.subVectors(p, C);
    const len = q.length(), th = Math.atan2(q.x, q.z), ph = Math.acos(clamp(q.y / len, -1, 1));
    const rs = pt(th, ph).distanceTo(C), target = rs + clr;
    if (len < target) p.copy(C).addScaledVector(q.normalize(), target);
    else if (cling > 0 && p.y > 0.055) p.copy(C).addScaledVector(q.normalize(), len - (len - target) * cling); // drape on the skull
    for (const e of ears) { q.subVectors(p, e); const d = q.length(), r = 0.019 + clr * 0.5; if (d < r) p.copy(e).addScaledVector(q.normalize(), r); }
    // shoulders, upper back and chest (head space; the body's shoulder line sits ~15 cm below the head pivot)
    if (p.y < -0.06) {
      const sx = clamp(p.x, -0.17, 0.17), dx = p.x - sx, dy = p.y + 0.165, dz = p.z + 0.03, d = Math.hypot(dx, dy, dz), r = 0.062 + clr;
      if (d < r) { p.x = sx + dx / d * r; p.y = -0.165 + dy / d * r; p.z = -0.03 + dz / d * r; }
      const ex = p.x / (0.17 + clr), ey = (p.y + 0.34) / (0.2 + clr), ez = (p.z + 0.015) / (0.115 + clr), k = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (k < 1 && p.y < -0.16) { p.x /= 1; p.z = -0.015 + (p.z + 0.015) / k; }
    }
  };
}

function scalpFrame(head, th, ph) {
  const p = head.scalp.point(th, ph), e = 0.01;
  const a = head.scalp.point(th + e, ph), b = head.scalp.point(th, ph + e);
  const n = new THREE.Vector3().crossVectors(a.sub(p), b.sub(p)).normalize();
  if (n.dot(p.clone().sub(head.scalp.center)) < 0) n.negate();
  return { p, n };
}

// style table: flow, length (m), lift, gravity, noise, volume (clearance growth), texture
const STYLES = {
  quiff: { flow: 'quiff', len: [0.03, 0.1], lift: 0.22, grav: 0.04, noise: 0.12, vol: 0.014, cling: 0.55, tex: 'wavy' },
  messy: { flow: 'whorl', len: [0.065, 0.1], lift: 0.2, grav: 0.13, noise: 0.22, vol: 0.013, cling: 0.3, tex: 'wavy', fringe: 'fall', cover: 'ears' },
  short: { flow: 'whorl', len: [0.03, 0.05], lift: 0.16, grav: 0.08, noise: 0.16, vol: 0.007, cling: 0.45, tex: 'straight' },
  curly: { flow: 'whorl', len: [0.022, 0.032], lift: 0.5, grav: 0.03, noise: 0.8, vol: 0.011, cling: 0.2, tex: 'curly' },
  swept: { flow: 'back', len: [0.05, 0.08], lift: 0.22, grav: 0.07, noise: 0.1, vol: 0.011, cling: 0.4, tex: 'straight' },
  'grey-swept': { flow: 'back', len: [0.055, 0.085], lift: 0.12, grav: 0.16, noise: 0.1, vol: 0.008, cling: 0.5, tex: 'wavy' },
  bob: { flow: 'part', len: [0.2, 0.24], lift: 0.06, grav: 0.5, noise: 0.08, vol: 0.009, cling: 0.75, tex: 'wavy', cutY: -0.03, fringe: 'side' },
  long: { flow: 'part', len: [0.34, 0.42], lift: 0.08, grav: 0.5, noise: 0.12, vol: 0.012, cling: 0.7, tex: 'wavy', cutY: -0.25, fringe: 'side', wave: 1 },
  'tied-back': { flow: 'tie', tie: [0, 0.078, -0.098], len: [0.25, 0.25], lift: 0, grav: 0, noise: 0.05, vol: 0.003, cling: 0.9, tex: 'straight', tail: 'pony', loose: 8 },
  bun: { flow: 'tie', tie: [0, 0.062, -0.1], len: [0.25, 0.25], lift: 0, grav: 0, noise: 0.04, vol: 0.003, cling: 0.9, tex: 'straight', tail: 'bun', loose: 2 },
};

function flowDir(st, p, n, th, R, partTh) {
  let v;
  if (st.flow === 'whorl') {
    const W = new THREE.Vector3(-0.012, 0.19, -0.055); // crown whorl, slightly off-centre
    v = p.clone().sub(W);
    if (Math.abs(th) < 1.25 && p.y > 0.12) v.add(new THREE.Vector3(0.35 * Math.sign(th + 0.3), -0.3, 0.6)); // fringe falls forward and to one side
  } else if (st.flow === 'quiff') { // modern cut: top swept up and back to one side, short tapered sides
    if (p.y > 0.142) v = new THREE.Vector3(-0.35 + p.x * 1.5, 0.2 - (p.z < 0 ? 0.5 : 0), -1);
    else v = new THREE.Vector3(p.x * 2, -1, -0.5);
  } else if (st.flow === 'back') {
    v = new THREE.Vector3(0, p.y > 0.13 ? 0.25 : -0.45, -1);
    v.x += p.x * 4;
  } else if (st.flow === 'part') {
    const side = Math.sign(th - partTh) || 1;
    v = new THREE.Vector3(side * 0.9, -0.5, Math.abs(th) < 1.2 ? 0.15 : -0.2);
    if (p.y < 0.15) v.set(p.x * 3, -1, p.z * 0.6);
  } else {
    v = new THREE.Vector3(...st.tie).sub(p);
  }
  v.x += (R() - 0.5) * st.noise; v.y += (R() - 0.5) * st.noise; v.z += (R() - 0.5) * st.noise;
  return tangentOf(v, n);
}

// ---------------------------------------------------------------- card builder
class Cards {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
  add(pts, sides, widths, ao, tint) {
    const base = this.n;
    for (let i = 0; i < pts.length; i++) {
      const t = i / (pts.length - 1), w = widths[i] * 0.5, p = pts[i], s = sides[i];
      this.pos.push(p.x - s.x * w, p.y - s.y * w, p.z - s.z * w, p.x + s.x * w, p.y + s.y * w, p.z + s.z * w);
      this.uv.push(0, t, 1, t);
      const a = (ao[0] + (ao[1] - ao[0]) * Math.min(1, t / 0.55)) * tint;
      this.col.push(a, a, a, a, a, a);
      if (i < pts.length - 1) { const k = base + i * 2; this.idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    this.n += pts.length * 2;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx); g.computeVertexNormals();
    return g;
  }
}

function strand(cards, collide, start, dir, n0, o) {
  const pts = [], sides = [], widths = [];
  const p = start.clone(), d = dir.clone(), q = new THREE.Vector3();
  const segs = o.segs, seg = o.len / segs;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    if (i > 0) {
      d.addScaledVector(UP, -o.grav).add(q.set((o.R() - 0.5) * o.curl, (o.R() - 0.5) * o.curl, (o.R() - 0.5) * o.curl)).normalize();
      const prev = p.clone();
      p.addScaledVector(d, seg);
      collide(p, o.clr0 + o.vol * Math.min(1, t * 1.6), o.cling || 0);
      d.subVectors(p, prev).normalize();
      if (o.stop && o.stop(p)) { if (pts.length < 2) { pts.push(p.clone()); sides.push(sides[0]); widths.push(widths[0]); } break; }
    }
    const radial = p.clone().sub(o.center).normalize();
    let side = new THREE.Vector3().crossVectors(d, radial);
    if (side.lengthSq() < 1e-8) side = new THREE.Vector3(1, 0, 0);
    side.normalize();
    pts.push(p.clone()); sides.push(side); widths.push(o.width * (1 - 0.55 * t));
  }
  if (o.wave) for (let i = 1; i < pts.length; i++) { // soft waves that grow toward the ends
    const t = i / (pts.length - 1), a = o.wave * Math.min(1, t * 1.8) * Math.sin(t * o.len * 38 + o.wph);
    pts[i].addScaledVector(sides[i], a); pts[i].addScaledVector(pts[i].clone().sub(o.center).normalize(), Math.abs(a) * 0.4);
  }
  if (pts.length >= 2) cards.add(pts, sides, widths, o.ao, o.tint);
  void n0;
}

// ---------------------------------------------------------------- public API
export function createHair(params = {}, head) {
  const style = params.style || 'short', detail = params.detail || 'high';
  const group = new THREE.Group(); group.name = 'hair';
  if (!head || !head.scalp?.point) return group;
  const R = rngF(params.seed || 7), A = head.anatomy || { fem: 0, old: 0, masc: 1 };
  const color = new THREE.Color(params.color ?? 0x1a1410);
  const grey = color.getHSL({}).l > 0.4;
  const collide = makeCollider(head), center = head.scalp.center;
  const lod = detail === 'low' ? 0.2 : detail === 'medium' ? 0.5 : 1;
  const st = STYLES[style];
  if (st) {
    const cards = new Cards();
    const count = Math.round((style === 'curly' ? 1400 : style === 'tied-back' || style === 'bun' ? 700 : 1150) * lod);
    const segs = detail === 'low' ? 3 : detail === 'medium' ? 5 : 7, width = (style === 'curly' ? 0.01 : 0.011) / Math.sqrt(lod);
    const partTh = 0.32;
    let made = 0, tries = 0;
    while (made < count && tries < count * 40) {
      tries++;
      const th = (R() * 2 - 1) * Math.PI, ph = Math.acos(1 - 2 * R() * 0.78);
      const { p, n } = scalpFrame(head, th, ph);
      if (p.y < hairlineY(th, { fem: A.fem, old: A.old, masc: A.masc, recede: params.recede }) + 0.002) continue;
      const layer = made / count; // 0 = first (inner) cards
      const clr0 = 0.0018 + 0.004 * layer;
      const dir = flowDir(st, p, n, th, R, partTh);
      const lift = st.lift * (0.6 + 0.8 * R()) * (st.flow === 'whorl' && p.y < 0.12 ? 0.4 : 1);
      const lift2 = st.flow === 'quiff' && p.y < 0.142 ? 0.05 : null;
      dir.addScaledVector(n, lift2 ?? lift).normalize();
      let len = st.len[0] + (st.len[1] - st.len[0]) * R();
      if (st.flow === 'whorl' || st.flow === 'back') len *= p.y < 0.1 ? 0.7 : 1; // shorter at the nape and sides
      if (st.flow === 'quiff') len = p.y > 0.142 ? (0.075 + R() * 0.035) * (p.z > 0.02 ? 1.1 : 0.85) : 0.024 + R() * 0.014;
      if (st.flow === 'tie') len = new THREE.Vector3(...st.tie).distanceTo(p) * 1.05;
      const front = Math.abs(th) < 1.15 && p.z > 0.02;
      const fringeY = (st.fringe === 'fall' ? 0.108 + R() * 0.02 : 0.122 + R() * 0.012) + Math.abs(p.x) * 0.15;
      const cutY = st.cutY != null ? st.cutY + (R() - 0.5) * 0.012 : 0;
      const stop = q => (st.cutY != null && q.y < cutY) ||
        (front && q.z > 0.03 && q.y < fringeY && Math.abs(q.x) < 0.06) ||
        (st.cover === 'ears' && q.y < 0.058) || (st.flow === 'tie' && q.distanceTo(new THREE.Vector3(...st.tie)) < 0.012);
      const tint = (grey ? 0.82 + R() * 0.3 : 0.88 + R() * 0.2) * (st.flow === 'tie' ? 0.92 : 1);
      strand(cards, collide, p.clone().addScaledVector(n, clr0), dir, n, {
        segs: st.wave ? segs + 4 : segs, len, grav: st.grav / segs * 4, curl: st.noise * 0.35, clr0, vol: st.vol * (0.4 + 0.6 * layer), width: width * (0.8 + 0.4 * R()), cling: st.cling, wave: st.wave ? 0.007 * (0.6 + 0.8 * R()) : 0, wph: R() * 6.28,
        ao: [0.3 + 0.3 * layer, 0.7 + 0.3 * layer], tint, R, center, stop,
      });
      made++;
    }
    // loose strands framing the face (tied styles) and the tail
    if (st.loose) for (let k = 0; k < st.loose * Math.max(1, lod * 2); k++) {
      const s = k % 2 ? 1 : -1, th = s * (0.95 + R() * 0.25), ph = Math.acos(0.42 + R() * 0.08);
      const { p, n } = scalpFrame(head, th, ph);
      strand(cards, collide, p.addScaledVector(n, 0.004), tangentOf(new THREE.Vector3(s * 0.2, -1, 0.25), n), n, {
        segs, len: 0.09 + R() * 0.05, grav: 0.12, curl: 0.25, clr0: 0.004, vol: 0.006, width: width * 0.6, ao: [0.6, 1], tint: 0.95, R, center,
      });
    }
    if (st.tail === 'pony') {
      const T = new THREE.Vector3(...st.tie);
      for (let k = 0; k < 60 * lod + 12; k++) {
        const a = R() * Math.PI * 2, r = 0.004 + R() * 0.009;
        const start = T.clone().add(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -0.004));
        strand(cards, collide, start, new THREE.Vector3(Math.cos(a) * 0.25, -0.35, -1).normalize(), UP, {
          segs: segs + 2, len: 0.2 + R() * 0.08, grav: 0.2, curl: 0.12, clr0: 0.002, vol: 0.004, width: width * 0.85, ao: [0.55, 1], tint: 0.85 + R() * 0.3, R, center,
        });
      }
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0035, 6, 14), new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.7 }));
      band.position.copy(T).add(new THREE.Vector3(0, 0, -0.006)); group.add(band);
    }
    if (st.tail === 'bun') {
      const B = new THREE.Vector3(st.tie[0], st.tie[1] - 0.004, st.tie[2] - 0.026);
      for (let k = 0; k < 70 * lod + 14; k++) { // locks wrapped around the bun
        const ax = new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), ref = Math.abs(ax.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0);
        const u = new THREE.Vector3().crossVectors(ax, ref).normalize(), v = new THREE.Vector3().crossVectors(ax, u);
        const pts = [], sides = [], widths = [], r = 0.026 + R() * 0.006, a0 = R() * 6.28;
        for (let i = 0; i <= 10; i++) { const a = a0 + i / 10 * 4.4; pts.push(B.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r)); sides.push(ax.clone()); widths.push(width * 0.9); }
        cards.add(pts, sides, widths, [0.6, 0.95], 0.85 + R() * 0.25);
      }
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.6), roughness: 0.7 }));
      core.position.copy(B); group.add(core);
    }
    group.add(hairCap(head, A, params, color));
    const mesh = new THREE.Mesh(cards.build(), hairMaterial(color, st.tex));
    mesh.castShadow = true; mesh.name = 'hairCards'; group.add(mesh);
  }
  if (params.beard === 'full' || params.beard === 'short') group.add(createBeard(params, head, R, detail));
  return group;
}

function hairCap(head, A, params, color) {
  const NT = 72, NP = 30, pos = [], col = [], idx = [];
  for (let j = 0; j <= NP; j++) for (let i = 0; i <= NT; i++) {
    const th = (i / NT * 2 - 1) * Math.PI, ph = j / NP * 2.25;
    const { p, n } = scalpFrame(head, th, ph);
    p.addScaledVector(n, 0.0016);
    const hy = hairlineY(th, { fem: A.fem, old: A.old, masc: A.masc, recede: params.recede });
    const a = clamp((p.y - hy - 0.006) / 0.006, 0, 1);
    pos.push(p.x, p.y, p.z); col.push(0.55, 0.55, 0.55, a);
    if (i < NT && j < NP) { const k = j * (NT + 1) + i; idx.push(k, k + NT + 1, k + 1, k + 1, k + NT + 1, k + NT + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), vertexColors: true, alphaTest: 0.5, roughness: 0.9, envMapIntensity: 0.25 }));
  m.name = 'hairCap'; m.castShadow = false; m.receiveShadow = true;
  return m;
}

function createBeard(params, head, R, detail) {
  const geo = head.scalp.geometry, P = geo.attributes.position, N = geo.attributes.normal;
  const lm = head.landmarks, mouthY = lm.mouth.y, chinY = lm.chin.y;
  const cards = new Cards(), center = head.scalp.center;
  const color = new THREE.Color(params.beardColor ?? params.color ?? 0x2a2420);
  const lod = detail === 'low' ? 0.25 : detail === 'medium' ? 0.55 : 1;
  const long = params.beard === 'full' ? 1 : 0.6;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const want = Math.round(900 * lod);
  let made = 0, tries = 0;
  const lipW = 0.025;
  while (made < want && tries < want * 60) {
    tries++;
    const i = (R() * P.count) | 0;
    p.fromBufferAttribute(P, i); n.fromBufferAttribute(N, i);
    const ax = Math.abs(p.x);
    if (p.z < -0.02 || p.y > 0.045) continue;
    const jawY = chinY - 0.016 + 0.045 * clamp(ax / 0.056, 0, 1);
    if (p.y < jawY - 0.012) continue;
    if (ax > 0.024 && p.y > 0.04 - 0.3 * (ax - 0.024)) continue; // cheek line
    const lipTop = mouthY + 0.0085, lipBot = mouthY - 0.009;
    const isMoustache = p.y > lipTop && p.y < lm.noseTip.y - 0.014 && ax < lipW + 0.004;
    if (p.y <= lipTop && p.y >= lipBot && ax < lipW * 1.05) continue;
    if (p.y > lipTop && !isMoustache && ax < 0.03) continue;
    const down = isMoustache ? new THREE.Vector3(Math.sign(p.x) * 0.6, -1, 0.15) : new THREE.Vector3(p.x * 2, -1, 0.35);
    const dir = tangentOf(down, n).addScaledVector(n, 0.25).normalize();
    const len = (isMoustache ? 0.011 + R() * 0.005 : (0.012 + R() * 0.014) * long) * (p.y < chinY + 0.01 ? 1.25 : 1);
    const start = p.clone().addScaledVector(n, 0.0012);
    const pts = [], sides = [], widths = [], q = start.clone(), d = dir.clone();
    for (let k = 0; k <= 4; k++) {
      if (k) { d.addScaledVector(UP, -0.12).normalize(); q.addScaledVector(d, len / 4); q.addScaledVector(n, 0.0008); }
      const s = new THREE.Vector3().crossVectors(d, n).normalize();
      pts.push(q.clone()); sides.push(s); widths.push(0.009 * (1 - 0.5 * k / 4) / Math.sqrt(lod));
    }
    cards.add(pts, sides, widths, [0.45, 1], 0.8 + R() * 0.45);
    made++;
  }
  void center;
  const m = new THREE.Mesh(cards.build(), hairMaterial(color, 'beard')); m.name = 'beard'; m.castShadow = true;
  return m;
}
