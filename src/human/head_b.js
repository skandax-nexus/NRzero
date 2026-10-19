// AFTERZERO head_b (WIP rebuild): realistic procedural human head from an anatomical SDF.
import * as THREE from 'three';
import { makeModel, makeField, landmarks, clamp, SHAPE_KEYS } from './head_b_sdf.js';
import { buildSkinMesh } from './head_b_geo.js';

const CACHE = new Map();

function normParams(p) {
  const shape = p.shape || {}, marks = p.marks || {};
  const sh = {};
  for (const k of SHAPE_KEYS) sh[k] = clamp(+shape[k] || 0, -1, 1);
  return {
    sex: clamp(p.sex ?? 0, 0, 1), age: clamp(p.age ?? 30, 8, 80), skin: p.skin ?? 0xc08a64, eyeColor: p.eyeColor ?? 0x3a2a1c, seed: p.seed | 0,
    shape: sh, traits: p.traits || {}, marks: { scar: !!marks.scar, freckles: clamp(marks.freckles ?? 0, 0, 1), wrinkles: clamp(marks.wrinkles ?? 0, 0, 1), stubble: clamp(marks.stubble ?? 0, 0, 1) },
    detail: ['high', 'medium', 'low'].includes(p.detail) ? p.detail : 'high', _dbg: p._dbg || null,
  };
}

export function createHead(params = {}) {
  const t0 = performance.now();
  const np = normParams(params);
  const key = JSON.stringify(np);
  let A = CACHE.get(key);
  if (!A) {
    const m = makeModel(np);
    const F = makeField(m);
    const mesh = buildSkinMesh(m, F, np.detail);
    const g = new THREE.BufferGeometry();
    const S = m.S;
    const P = mesh.position.slice(); for (let i = 0; i < P.length; i++) P[i] *= S;
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normal, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.index, 1));
    const col = new Float32Array(P.length);
    const sk = new THREE.Color(np.skin);
    for (let i = 0; i < mesh.part.length; i++) {
      const pt = mesh.part[i];
      let c = sk;
      if (params._clay) c = new THREE.Color(0.6, 0.6, 0.6);
      if (pt === 1) c = new THREE.Color(0.55, 0.25, 0.22);
      if (pt === 2) c = new THREE.Color(0.1, 0.02, 0.02);
      if (pt === 3) c = new THREE.Color(0.15, 0.05, 0.04);
      if (pt === 6) c = new THREE.Color(0.8, 0.4, 0.4);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    A = { m, F, g, stats: mesh.stats, ms: performance.now() - t0 };
    CACHE.set(key, A);
  }
  const { m, F } = A;
  const S = m.S;
  const group = new THREE.Group();
  const skinMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, sheen: 0.2, sheenColor: new THREE.Color(0.5, 0.3, 0.25) });
  const skin = new THREE.Mesh(A.g, skinMat);
  group.add(skin);
  // eyes (temporary)
  const eyeGeo = new THREE.SphereGeometry(m.Re * S, 32, 24);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const cx = cv.getContext('2d'); cx.fillStyle = '#e8e2dc'; cx.fillRect(0, 0, 256, 128);
  const ic = new THREE.Color(np.eyeColor);
  cx.fillStyle = '#' + ic.getHexString(); cx.fillRect(0, 0, 256, 128 * 0.165);
  cx.fillStyle = '#050505'; cx.fillRect(0, 0, 256, 128 * 0.07);
  const et = new THREE.CanvasTexture(cv); et.colorSpace = THREE.SRGBColorSpace;
  const eyeMat = new THREE.MeshPhysicalMaterial({ map: et, roughness: 0.15, clearcoat: 1 });
  const eyes = [];
  for (const side of [1, -1]) {
    const piv = new THREE.Group();
    piv.position.set(side * m.eyeX * S, (m.eyeY + side * m.asym.eyeDy) * S, m.eyeZ * S);
    const ball = new THREE.Mesh(eyeGeo, eyeMat); ball.rotation.x = Math.PI / 2;
    const holder = new THREE.Group(); holder.add(ball); piv.add(holder);
    group.add(piv); eyes.push({ piv, holder });
  }
  if (params._marks) {
    const mk = [[0, -0.035, 0.085], [0, 0.005, 0.1], [0, 0.045, 0.12], [0.032, 0.085, 0.075], [-0.032, 0.085, 0.075], [0, 0.11, 0.095], [0, 0.195, 0], [0, 0.08, -0.105], [0.075, 0.07, -0.01], [-0.075, 0.07, -0.01]];
    const mg = new THREE.SphereGeometry(0.0022, 8, 6), mm = new THREE.MeshBasicMaterial({ color: 0xff2020, depthTest: false });
    for (const q of mk) { const s = new THREE.Mesh(mg, mm); s.position.set(q[0] * S, q[1] * S, q[2] * S); s.renderOrder = 9; group.add(s); }
  }
  const L = landmarks(m, F);
  const v3 = a => new THREE.Vector3(a[0] * S, a[1] * S, a[2] * S);
  const lm = {}; for (const k in L) lm[k] = v3(L[k]);
  group.userData.headStats = { ...A.stats, buildMs: A.ms };
  const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
  return {
    group, skinMaterial: skinMat,
    setGaze(p) {
      for (const e of eyes) {
        if (!p) { e.holder.rotation.set(0, 0, 0); continue; }
        group.updateWorldMatrix(true, false);
        _m.copy(group.matrixWorld).invert();
        _v.copy(p).applyMatrix4(_m).sub(e.piv.position);
        e.holder.rotation.set(Math.atan2(-_v.y, Math.hypot(_v.x, _v.z)), Math.atan2(_v.x, _v.z), 0, 'YXZ');
      }
    },
    setBlink() {}, setMouth() {}, setSmile() {}, update() {},
    scalp: { geometry: A.g, center: new THREE.Vector3(0, 0.095 * S, -0.01 * S), radius: 0.1 * S },
    landmarks: lm,
    dispose() {},
  };
}
