// AFTERZERO head_b: realistic procedural human head (signed-distance-field sculpt).
// createHead(params) per docs/ART_SPEC.md section 1. The head is modelled as an anatomical SDF
// (head_b_sdf.js), polygonised with adaptive dual contouring and relaxed (head_b_geo.js), textured
// with UV-space baked procedural skin maps (head_b_tex.js) and shaded with a subsurface-style skin
// material (head_b_mat.js). Eyes, lashes, teeth and tongue are separate generated parts
// (head_b_parts.js). Geometry, textures and materials are cached by parameters.

import * as THREE from 'three';
import { makeModel, clamp } from './head_b_sdf.js';
import { buildSkin } from './head_b_geo.js';
import { bakeSkin } from './head_b_tex.js';
import { makeSkinMaterial, eyeTexture, makeEyeMaterial, makeCorneaMaterial } from './head_b_mat.js';
import { eyeballGeometry, corneaGeometry, lashGeometry, lashTexture, teethGeometry, tongueGeometry, EYE } from './head_b_parts.js';

const CACHE = new Map();

function normParams(p) {
  const shape = p.shape || {}, marks = p.marks || {};
  const sh = {};
  for (const k of ['jaw', 'cheek', 'nose', 'noseWidth', 'lips', 'brow', 'eyeSize', 'faceLength', 'chin']) sh[k] = clamp(+shape[k] || 0, -1, 1);
  return {
    sex: clamp(p.sex ?? 0, 0, 1), age: clamp(p.age ?? 30, 8, 80), skin: p.skin ?? 0xc08a64, eyeColor: p.eyeColor ?? 0x3a2a1c, seed: p.seed | 0,
    shape: sh, marks: { scar: !!marks.scar, freckles: clamp(marks.freckles ?? 0, 0, 1), wrinkles: clamp(marks.wrinkles ?? 0, 0, 1), stubble: clamp(marks.stubble ?? 0, 0, 1) },
    detail: ['high', 'medium', 'low'].includes(p.detail) ? p.detail : 'high',
    browColor: p.browColor ?? null,
  };
}

function browColorFor(np) {
  if (np.browColor != null) return np.browColor;
  // derive a plausible brow colour from skin and age (dark by default, greyer when old)
  const old = clamp((np.age - 50) / 25, 0, 1);
  const c = new THREE.Color(0x1a120c).lerp(new THREE.Color(0x7a746c), old * 0.7);
  return c.getHex();
}

function buildAssets(np) {
  const t0 = performance.now();
  const m = makeModel(np);
  const det = np.detail;
  const geo = buildSkin(m, det);
  const t1 = performance.now();
  const R = det === 'high' ? 1024 : det === 'medium' ? 512 : 256;
  const tex = bakeSkin(geo, m, { skin: np.skin, seed: np.seed, freckles: np.marks.freckles, stubble: np.marks.stubble, wrinkles: np.marks.wrinkles, scar: np.marks.scar, browColor: browColorFor(np) }, R);
  const t2 = performance.now();
  // skin geometry
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(geo.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(geo.normal, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(geo.uv, 2));
  g.setAttribute('skinAttr', new THREE.BufferAttribute(geo.attr, 2));
  g.setIndex(new THREE.BufferAttribute(geo.index, 1));
  const order = ['blinkA', 'blinkB', 'jaw', 'smile'];
  g.morphAttributes.position = order.map(k => new THREE.BufferAttribute(geo.morphs[k], 3));
  g.morphAttributes.normal = order.map(k => new THREE.BufferAttribute(geo.morphNormals[k], 3));
  g.morphTargetsRelative = true;
  g.computeBoundingSphere(); g.computeBoundingBox();
  const skinMat = makeSkinMaterial(tex, { normalScale: det === 'low' ? 0.5 : 0.9, detailNormal: det !== 'low' });
  // eyes
  const segU = det === 'high' ? 40 : det === 'medium' ? 20 : 10, segV = det === 'high' ? 24 : det === 'medium' ? 12 : 6;
  const eyeGeo = eyeballGeometry(m.S, segU, segV);
  const corneaGeo = det === 'low' ? null : corneaGeometry(m.S, segU, Math.round(segV * 0.7));
  const eyeTex = eyeTexture(np.eyeColor, np.seed);
  const lashGeo = det === 'low' ? null : lashGeometry(m);
  const teeth = det === 'low' ? null : [teethGeometry(m, true, det === 'high' ? 28 : 14), teethGeometry(m, false, det === 'high' ? 28 : 14)];
  const tongue = det === 'low' ? null : tongueGeometry(m);
  const t3 = performance.now();
  return {
    m, g, skinMat, eyeGeo, corneaGeo, eyeTex, lashGeo, teeth, tongue, stats: geo.stats, texMs: tex.ms,
    ms: { mesh: t1 - t0, tex: t2 - t1, parts: t3 - t2, total: t3 - t0 }, refs: 0,
  };
}

export function createHead(params = {}) {
  const t0 = performance.now();
  const np = normParams(params);
  const key = JSON.stringify(np);
  let A = CACHE.get(key);
  const cached = !!A;
  if (!A) { A = buildAssets(np); CACHE.set(key, A); }
  A.refs++;
  const m = A.m, S = m.S, det = np.detail;
  const group = new THREE.Group();
  group.name = 'head_b';
  const skin = new THREE.Mesh(A.g, A.skinMat);
  skin.name = 'skin';
  group.add(skin);

  // ---- eyes (each with its own material so lid occlusion uniforms are per eye)
  const lidOf = (side) => ({ cMx: m.cMx * S, cMy: m.cMy * S, cLx: m.cLx * S, cLy: m.cLy * S, hU: m.hU * S, hL: m.hL * S, sU: m.sU, sL: m.sL, side });
  const eyes = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * m.eyeX * S, (m.eyeY + side * m.eyeDy) * S, m.eyeZ * S);
    group.add(pivot);
    const em = makeEyeMaterial(A.eyeTex, lidOf(side));
    const ball = new THREE.Mesh(A.eyeGeo, em);
    pivot.add(ball);
    let cornea = null;
    if (A.corneaGeo) { cornea = new THREE.Mesh(A.corneaGeo, makeCorneaMaterial(lidOf(side))); cornea.renderOrder = 2; pivot.add(cornea); }
    eyes.push({ side, pivot, ball, cornea, mats: [em, cornea?.material].filter(Boolean), yaw: 0, pitch: 0 });
  }
  // ---- lashes
  let lashes = null;
  if (A.lashGeo) {
    const lm = new THREE.MeshStandardMaterial({ map: lashTexture(), color: 0xffffff, roughness: 0.6, alphaTest: 0.35, side: THREE.DoubleSide, transparent: false });
    lm.alphaToCoverage = true;
    lashes = new THREE.Mesh(A.lashGeo, lm);
    lashes.name = 'lashes';
    group.add(lashes);
  }
  // ---- teeth / tongue (lower parts on a jaw pivot)
  const jaw = new THREE.Group();
  const pivY = 0.058 * S, pivZ = 0.004 * S;
  jaw.position.set(0, pivY, pivZ);
  group.add(jaw);
  const jawInner = new THREE.Group(); jawInner.position.set(0, -pivY, -pivZ); jaw.add(jawInner);
  const mouthParts = [];
  if (A.teeth) {
    const tm = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, ior: 1.55, specularIntensity: 0.5, sheen: 0.2, sheenColor: new THREE.Color(0.5, 0.5, 0.55) });
    const up = new THREE.Mesh(A.teeth[0], tm), lo = new THREE.Mesh(A.teeth[1], tm);
    group.add(up); jawInner.add(lo);
    const tg = new THREE.Mesh(A.tongue, new THREE.MeshPhysicalMaterial({ color: 0x9a4a46, roughness: 0.42, sheen: 0.4, sheenColor: new THREE.Color(0.6, 0.3, 0.3) }));
    jawInner.add(tg);
    mouthParts.push(up, lo, tg);
    for (const p of mouthParts) p.visible = false;
  }

  // ---- state
  const st = { blink: 0, mouth: 0, smile: 0, gaze: null, sacc: [0, 0], saccT: 0.5, autoBlinkT: 3 + Math.random() * 3, blinkAnim: -1 };
  const infl = skin.morphTargetInfluences;
  function applyBlink(b) {
    b = clamp(b, 0, 1);
    const a = b < 0.5 ? 2 * b : 2 - 2 * b, c = b < 0.5 ? 0 : 2 * b - 1;
    infl[0] = a; infl[1] = c;
    if (lashes) { lashes.morphTargetInfluences[0] = a; lashes.morphTargetInfluences[1] = c; }
    for (const e of eyes) for (const mt of e.mats) mt.userData.uniforms.uBlink.value = b;
  }
  function applyMouth(v) {
    v = clamp(v, 0, 1);
    infl[2] = v;
    jaw.rotation.x = 0.26 * v; jaw.position.z = pivZ + 0.0025 * S * v;
    for (const p of mouthParts) p.visible = v > 0.02;
  }
  function applySmile(v) { infl[3] = clamp(v, 0, 1); }
  const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  function aimEyes() {
    for (const e of eyes) {
      let yaw = 0, pitch = 0;
      if (st.gaze) {
        group.updateWorldMatrix(true, false);
        _m.copy(group.matrixWorld).invert();
        _v.copy(st.gaze).applyMatrix4(_m).sub(e.pivot.position);
        yaw = Math.atan2(_v.x, _v.z); pitch = Math.atan2(-_v.y, Math.hypot(_v.x, _v.z));
      }
      yaw = clamp(yaw + st.sacc[0], -0.6, 0.6); pitch = clamp(pitch + st.sacc[1], -0.42, 0.42);
      e.yaw = yaw; e.pitch = pitch;
      _e.set(pitch, yaw, 0, 'YXZ');
      e.ball.quaternion.setFromEuler(_e);
      if (e.cornea) e.cornea.quaternion.copy(e.ball.quaternion);
      const m3 = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(e.ball.quaternion));
      for (const mt of e.mats) mt.userData.uniforms.uGaze.value.copy(m3);
    }
  }
  aimEyes();

  const v = (a, b, c) => new THREE.Vector3(a * S, b * S, c * S);
  const landmarks = {
    eyeL: v(m.eyeX, m.eyeY, m.eyeZ), eyeR: v(-m.eyeX, m.eyeY, m.eyeZ),
    noseTip: v(0, 0.045, 0.12), mouth: v(0, m.mouthY, 0.1), chin: v(0, -0.035, 0.085), crown: v(0, 0.195, 0),
    earL: v(m.earX + 0.004, m.earY, m.earZ), earR: v(-m.earX - 0.004, m.earY, m.earZ),
  };
  const ms = performance.now() - t0;
  group.userData.headStats = { tris: A.stats.tris, buildMs: cached ? 0 : A.ms.total, cached, detail: det, ms: A.ms, texMs: A.texMs };

  let disposed = false;
  return {
    group,
    skinMaterial: A.skinMat,
    setGaze(p) { st.gaze = p ? p.clone() : null; aimEyes(); },
    setBlink(b) { st.blink = clamp(b, 0, 1); applyBlink(st.blink); },
    setMouth(x) { st.mouth = clamp(x, 0, 1); applyMouth(st.mouth); },
    setSmile(x) { st.smile = clamp(x, 0, 1); applySmile(st.smile); },
    update(dt = 0.016) {
      // micro saccades
      st.saccT -= dt;
      if (st.saccT <= 0) { st.sacc = [(Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.035]; st.saccT = 0.4 + Math.random() * 1.6; aimEyes(); }
    },
    scalp: { geometry: A.g, center: v(0, 0.095, -0.01), radius: 0.1 * S },
    landmarks,
    buildMs: ms,
    dispose() {
      if (disposed) return; disposed = true;
      for (const e of eyes) for (const mt of e.mats) mt.dispose();
      if (lashes) lashes.material.dispose();
      for (const p of mouthParts) p.material.dispose?.();
      A.refs--;
      if (A.refs <= 0) {
        A.g.dispose(); A.skinMat.map?.dispose(); A.skinMat.normalMap?.dispose(); A.skinMat.roughnessMap?.dispose(); A.skinMat.dispose();
        A.eyeGeo.dispose(); A.corneaGeo?.dispose(); A.lashGeo?.dispose(); A.teeth?.forEach(t => t.dispose()); A.tongue?.dispose();
        CACHE.delete(key);
      }
    },
  };
}

export { EYE };
