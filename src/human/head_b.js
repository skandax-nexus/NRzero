// AFTERZERO head_b: realistic procedural human head (signed-distance-field sculpt).
// createHead(params) per docs/ART_SPEC.md section 1.
//  - head_b_sdf.js   anatomical signed distance field built from params (sex, age, shape, traits, seed)
//  - head_b_mesh.js  adaptive octree dual contouring + mesh utilities
//  - head_b_geo.js   skin mesh: polygonise, relax, AO/thickness, morphs (blink, jaw, smile), UVs
//  - head_b_tex.js   UV-space baked procedural skin maps (albedo, normal, roughness)
//  - head_b_like.js  likeness: the owner's portraits fitted and projected onto the principals' faces
//  - head_b_mat.js   subsurface-style skin, eye and cornea materials
//  - head_b_parts.js eyeballs, cornea shells, lashes, teeth, tongue
// Geometry, textures and materials are cached by parameters and shared between instances.

import * as THREE from 'three';
import { makeModel, makeField, landmarks, clamp, SHAPE_KEYS } from './head_b_sdf.js';
import { buildSkinMesh } from './head_b_geo.js';
import { rasterGBuf, bakeSkin } from './head_b_tex.js';
import { makeSkinMaterial, eyeTexture, makeEyeMaterial, makeCorneaMaterial } from './head_b_mat.js';
import { eyeballGeometry, corneaGeometry, lashGeometry, lashTexture, teethGeometry, tongueGeometry } from './head_b_parts.js';
import { resolveLikeness, likenessTraits, projectPortrait } from './head_b_like.js';

const CACHE = new Map();
const JAW = { ang: 0.27, pivY: 0.06, pivZ: 0.002, slide: 0.0028 };

function normParams(p) {
  const shape = p.shape || {}, marks = p.marks || {};
  const sh = {};
  for (const k of SHAPE_KEYS) sh[k] = clamp(+shape[k] || 0, -1, 1);
  const np = {
    sex: clamp(p.sex ?? 0, 0, 1), age: clamp(p.age ?? 30, 8, 80), skin: p.skin ?? 0xc08a64, eyeColor: p.eyeColor ?? 0x3a2a1c, seed: p.seed | 0,
    shape: sh, marks: { scar: !!marks.scar, freckles: clamp(marks.freckles ?? 0, 0, 1), wrinkles: clamp(marks.wrinkles ?? 0, 0, 1), stubble: clamp(marks.stubble ?? 0, 0, 1) },
    detail: ['high', 'medium', 'low'].includes(p.detail) ? p.detail : 'high',
    browColor: p.browColor ?? null, beardColor: p.beardColor ?? null, traits: p.traits || null,
  };
  np.likeness = resolveLikeness(p, np);
  return np;
}

function browColorFor(np) {
  if (np.browColor != null) return np.browColor;
  const old = clamp((np.age - 48) / 25, 0, 1);
  const lum = ((np.skin >> 16 & 255) + (np.skin >> 8 & 255)) / 510;
  const c = new THREE.Color(lum > 0.75 && np.seed % 3 === 0 ? 0x4a3020 : 0x1c140e).lerp(new THREE.Color(0x8a847c), old * 0.75);
  return c.getHex();
}

function geoFrom(arrs, S) {
  const g = new THREE.BufferGeometry();
  const P = arrs.position.slice(); for (let i = 0; i < P.length; i++) P[i] *= S;
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(arrs.normal, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(arrs.uv, 2));
  g.setAttribute('skinAttr', new THREE.BufferAttribute(arrs.attr, 2));
  g.setAttribute('color', new THREE.BufferAttribute(arrs.color, 3));
  g.setIndex(new THREE.BufferAttribute(arrs.index, 1));
  const order = ['blink', 'jaw', 'smile'];
  g.morphAttributes.position = order.map(k => { const D = arrs.morphs[k].slice(); for (let i = 0; i < D.length; i++) D[i] *= S; return new THREE.BufferAttribute(D, 3); });
  g.morphAttributes.normal = order.map(k => new THREE.BufferAttribute(arrs.morphNormals[k], 3));
  g.morphTargetsRelative = true;
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

function scaled(pos, S) { const a = pos.slice(); for (let i = 0; i < a.length; i++) a[i] *= S; return a; }

function buildAssets(np) {
  const t0 = performance.now();
  const traits = { ...(np.likeness ? likenessTraits(np.likeness) : {}), ...(np.traits || {}) };
  const m = makeModel({ ...np, traits, natural: np.likeness ? 0.35 : 1 });
  const F = makeField(m);
  const det = np.detail;
  const t1 = performance.now();
  const mesh = buildSkinMesh(m, F, det);
  const t2 = performance.now();
  const S = m.S;
  const R = det === 'high' ? 1024 : det === 'medium' ? 512 : 256;
  const G = rasterGBuf(mesh, R);
  const portrait = np.likeness && det !== 'low' ? projectPortrait(np.likeness, G, m, F, mesh) : (np.likeness ? projectPortrait(np.likeness, G, m, F, mesh) : null);
  const tex = bakeSkin(G, m, F, { skin: np.skin, seed: np.seed, freckles: np.marks.freckles, stubble: np.marks.stubble, wrinkles: np.marks.wrinkles, scar: np.marks.scar, browColor: browColorFor(np), beardColor: np.beardColor }, portrait);
  const t3 = performance.now();
  const g = geoFrom(mesh, S);
  const skinMat = makeSkinMaterial(tex, { normalScale: det === 'low' ? 0.4 : 0.85, detailNormal: det === 'high', vertexColors: true });
  // eyes
  const segU = det === 'high' ? 40 : det === 'medium' ? 20 : 10, segV = det === 'high' ? 22 : det === 'medium' ? 12 : 6;
  const eyeGeo = eyeballGeometry(m.Re * S, segU, segV);
  const corneaGeo = det === 'low' ? null : corneaGeometry(m.Re * S, segU, Math.round(segV * 0.7));
  const eyeTex = eyeTexture(np.eyeColor, np.seed);
  let lashGeo = null;
  if (det !== 'low') {
    const L = lashGeometry(m, F, (side, upper, az) => blinkElev(m, F, upper, az));
    lashGeo = new THREE.BufferGeometry();
    lashGeo.setAttribute('position', new THREE.BufferAttribute(scaled(L.pos, S), 3));
    lashGeo.setAttribute('uv', new THREE.BufferAttribute(L.uv, 2));
    lashGeo.setIndex(L.idx);
    lashGeo.computeVertexNormals();
    lashGeo.morphAttributes.position = [new THREE.BufferAttribute(scaled(L.blink, S), 3)];
    lashGeo.morphTargetsRelative = true;
  }
  let teeth = null, tongue = null;
  if (det !== 'low') {
    teeth = [true, false].map(up => {
      const T = teethGeometry(m, F, up, det === 'high' ? 28 : 14);
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(scaled(T.pos, S), 3));
      tg.setAttribute('color', new THREE.BufferAttribute(T.col, 3));
      tg.setIndex(T.idx); tg.computeVertexNormals();
      return tg;
    });
    tongue = tongueGeometry(m, F, det === 'high' ? 20 : 10, det === 'high' ? 12 : 6);
    tongue.scale(S, S, S); tongue.computeVertexNormals();
  }
  const t4 = performance.now();
  const L = landmarks(m, F);
  return {
    m, F, g, skinMat, eyeGeo, corneaGeo, eyeTex, lashGeo, teeth, tongue, L,
    stats: { ...mesh.stats, tex: tex.ms },
    ms: { field: t1 - t0, mesh: t2 - t1, tex: t3 - t2, parts: t4 - t3, total: t4 - t0 },
  };
}

// upper/lower lid margin travel (radians of elevation) at full blink, shared with the lashes
function blinkElev(m, F, upper, az) {
  const L = (F.lidAtCached || (F.lidAtCached = makeLidCache(m)))(az);
  const meet = L[1] + 0.22 * (L[0] - L[1]);
  return upper ? meet - L[0] : meet - L[1];
}
function makeLidCache(m) { return (az) => F_lidAt(m, az); }
import { lidAt as F_lidAt } from './head_b_sdf.js';

const _m4 = new THREE.Matrix4(), _v = new THREE.Vector3(), _q = new THREE.Quaternion();

export function createHead(params = {}) {
  const t0 = performance.now();
  const np = normParams(params);
  const key = JSON.stringify(np);
  let A = CACHE.get(key);
  const cached = !!A;
  if (!A) { A = buildAssets(np); A.refs = 0; CACHE.set(key, A); }
  A.refs++;
  const { m, F } = A;
  const S = m.S, det = np.detail;
  const group = new THREE.Group();
  group.name = 'head_b';
  const skin = new THREE.Mesh(A.g, A.skinMat);
  skin.name = 'skin';
  skin.morphTargetInfluences = [0, 0, 0];
  group.add(skin);

  // ---- eyes ----
  const lidParams = side => ({ am: m.fis.am, al: m.fis.al, bm: m.fis.bm, bl: m.fis.bl, hu: m.fis.hu, hl: m.fis.hl, pu: m.fis.pu, pl: m.fis.pl, side });
  const eyes = [];
  for (const side of [1, -1]) {
    const piv = new THREE.Group();
    piv.position.set(side * F.E.x * S, (F.E.y + side * m.asym.eyeDy) * S, (F.E.z + side * m.asym.eyeDz) * S);
    const holder = new THREE.Group();
    const eyeMat = makeEyeMaterial(A.eyeTex, lidParams(side));
    const ball = new THREE.Mesh(A.eyeGeo, eyeMat); ball.name = 'eyeball';
    holder.add(ball);
    let cornea = null;
    if (A.corneaGeo) { cornea = new THREE.Mesh(A.corneaGeo, makeCorneaMaterial(lidParams(side))); cornea.renderOrder = 2; cornea.name = 'cornea'; holder.add(cornea); }
    piv.add(holder); group.add(piv);
    eyes.push({ side, piv, holder, mats: [eyeMat, cornea && cornea.material].filter(Boolean) });
  }
  // ---- lashes ----
  let lashes = null;
  if (A.lashGeo) {
    const lm = new THREE.MeshStandardMaterial({ map: lashTexture(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.6, color: new THREE.Color(np.age > 55 ? 0x6a625a : 0x2a221c) });
    lashes = new THREE.Mesh(A.lashGeo, lm); lashes.name = 'lashes';
    lashes.morphTargetInfluences = [0];
    lashes.castShadow = false;
    group.add(lashes);
  }
  // ---- mouth interior: teeth and tongue; the lower jaw rotates about the TMJ ----
  const jawPivot = new THREE.Group(); jawPivot.position.set(0, JAW.pivY * S, JAW.pivZ * S);
  const jawInner = new THREE.Group(); jawInner.position.set(0, -JAW.pivY * S, -JAW.pivZ * S); jawPivot.add(jawInner);
  group.add(jawPivot);
  const teethMat = A.teeth ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.4 }) : null;
  if (A.teeth) {
    group.add(new THREE.Mesh(A.teeth[0], teethMat));
    jawInner.add(new THREE.Mesh(A.teeth[1], teethMat));
  }
  let tongueMat = null;
  if (A.tongue) {
    tongueMat = new THREE.MeshPhysicalMaterial({ color: 0x8a3b38, roughness: 0.42, sheen: 0.3, sheenColor: new THREE.Color(0.6, 0.3, 0.3) });
    jawInner.add(new THREE.Mesh(A.tongue, tongueMat));
  }

  // ---- landmarks / scalp ----
  const v3 = a => new THREE.Vector3(a[0] * S, a[1] * S, a[2] * S);
  const lmk = {}; for (const k in A.L) lmk[k] = v3(A.L[k]);
  group.userData.headStats = { ...A.stats, buildMs: cached ? 0 : A.ms, cached, totalMs: performance.now() - t0, likeness: np.likeness || null };

  let blink = 0, mouth = 0, smile = 0;
  let gazeTarget = null;
  const sacc = { t: 0, next: 1.2, off: new THREE.Vector2(), cur: new THREE.Vector2() };
  function applyGaze() {
    for (const e of eyes) {
      let yaw = 0, pitch = 0;
      if (gazeTarget) {
        group.updateWorldMatrix(true, false);
        _m4.copy(group.matrixWorld).invert();
        _v.copy(gazeTarget).applyMatrix4(_m4).sub(e.piv.position);
        yaw = Math.atan2(_v.x, _v.z); pitch = Math.atan2(-_v.y, Math.hypot(_v.x, _v.z));
        // anatomical limits and slight convergence relief
        yaw = clamp(yaw, -0.6, 0.6); pitch = clamp(pitch, -0.45, 0.4);
      }
      yaw += sacc.cur.x; pitch += sacc.cur.y;
      e.holder.rotation.set(pitch, yaw, 0, 'YXZ');
      e.holder.updateMatrix();
      for (const mt of e.mats) mt.userData.uniforms.uGaze.value.setFromMatrix4(e.holder.matrix);
    }
  }
  function applyMorphs() {
    skin.morphTargetInfluences[0] = blink;
    skin.morphTargetInfluences[1] = mouth;
    skin.morphTargetInfluences[2] = smile;
    if (lashes) lashes.morphTargetInfluences[0] = blink;
    for (const e of eyes) for (const mt of e.mats) mt.userData.uniforms.uBlink.value = blink;
    jawPivot.rotation.x = 0; jawInner.position.z = -JAW.pivZ * S + JAW.slide * S * mouth;
    jawPivot.rotation.x = JAW.ang * mouth;
  }
  applyGaze(); applyMorphs();
  return {
    group, skinMaterial: A.skinMat,
    setGaze(p) { gazeTarget = p ? (gazeTarget || new THREE.Vector3()).copy(p) : null; applyGaze(); },
    setBlink(v) { blink = clamp(+v || 0, 0, 1); applyMorphs(); },
    setMouth(v) { mouth = clamp(+v || 0, 0, 1); applyMorphs(); },
    setSmile(v) { smile = clamp(+v || 0, 0, 1); applyMorphs(); },
    update(dt) {
      // micro saccades: small, quick re-fixations every ~1-3 s
      sacc.t += dt || 0;
      if (sacc.t > sacc.next) { sacc.t = 0; sacc.next = 0.8 + Math.random() * 2.4; sacc.off.set((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.03); }
      sacc.cur.lerp(sacc.off, Math.min(1, (dt || 0) * 25));
      applyGaze();
    },
    scalp: { geometry: A.g, center: new THREE.Vector3(0, 0.085 * S, -0.012 * S), radius: 0.102 * S },
    landmarks: lmk,
    dispose() {
      for (const e of eyes) for (const mt of e.mats) mt.dispose();
      if (lashes) lashes.material.dispose();
      if (teethMat) teethMat.dispose();
      if (tongueMat) tongueMat.dispose();
      if (--A.refs <= 0) {
        CACHE.delete(key);
        A.g.dispose(); A.eyeGeo.dispose(); A.corneaGeo?.dispose(); A.lashGeo?.dispose(); A.teeth?.forEach(t => t.dispose()); A.tongue?.dispose();
        for (const t of ['map', 'normalMap', 'roughnessMap']) A.skinMat[t]?.dispose();
        A.skinMat.dispose();
      }
    },
  };
}

export { quatDummy };
function quatDummy() { return _q; }
