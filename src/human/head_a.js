// AFTERZERO realistic head, approach A: sculpted deformation of a dense sphere-topology mesh.
// createHead(params) per docs/ART_SPEC.md section 1. All geometry, textures and shaders are generated
// here by our own code (head_a_*.js helpers); nothing is downloaded or transcribed.
import * as THREE from 'three';
import { buildHeadData, computeNormals } from './head_a_sculpt.js';
import { normParams } from './head_a_spec.js';
import { skinVertexData, detailMaps, featureMaps, createSkinMaterial } from './head_a_skin.js';
import { createEye, tearLineGeometry } from './head_a_eye.js';

const CACHE = new Map();
const keyOf = (P) => JSON.stringify([P.sex, P.age, P.seed, P.shape, P.marks, P.skin, P.detail]);

function build(P) {
  const k = keyOf(P);
  let c = CACHE.get(k);
  if (c) return c;
  const T = [performance.now()];
  const D = buildHeadData(P);
  T.push(performance.now());
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(D.position, 3));
  const n0 = computeNormals(D.position, D.index, D.seamPairs);
  g.setAttribute('normal', new THREE.BufferAttribute(n0, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(D.uv, 2));
  g.setIndex(new THREE.BufferAttribute(D.index, 1));
  const mp = [], mn = [];
  for (const d of D.morphs) {
    mp.push(new THREE.BufferAttribute(d, 3));
    const p = new Float32Array(D.position.length);
    for (let i = 0; i < p.length; i++) p[i] = D.position[i] + d[i];
    const n = computeNormals(p, D.index, D.seamPairs);
    for (let i = 0; i < n.length; i++) n[i] -= n0[i];
    mn.push(new THREE.BufferAttribute(n, 3));
  }
  g.morphAttributes.position = mp; g.morphAttributes.normal = mn; g.morphTargetsRelative = true;
  T.push(performance.now());
  // skin data
  D.normals = n0;
  const SV = skinVertexData(D, P);
  T.push(performance.now());
  g.setAttribute('color', new THREE.BufferAttribute(SV.color, 3));
  g.setAttribute('skinData', new THREE.BufferAttribute(SV.data, 4));
  // detail UVs: seamless cylindrical projection in metres (12 tiles around, 47 mm tall)
  const uvd = new Float32Array(D.NV * 2);
  for (let i = 0; i < D.NV; i++) {
    const x = D.P0[i * 3], y = D.P0[i * 3 + 1], z = D.P0[i * 3 + 2];
    uvd[i * 2] = (Math.atan2(x, z) / (2 * Math.PI)) * 12; uvd[i * 2 + 1] = y / 0.0471;
  }
  // keep the seam column continuous (u jumps by 12 tiles exactly there)
  for (const [a, b] of D.seamPairs) uvd[b * 2] = uvd[a * 2] + (uvd[a * 2] < 0 ? 12 : -12) * 0 + (uvd[b * 2] - uvd[a * 2] > 6 ? 0 : 0);
  g.setAttribute('uvd', new THREE.BufferAttribute(uvd, 2));
  g.computeBoundingSphere();
  const hi = P.detail === 'high', med = P.detail === 'medium';
  const detail = P.detail === 'low' ? null : detailMaps();
  T.push(performance.now());
  const feat = P.detail === 'low' ? null : featureMaps(D, P, hi ? 1024 : 512, hi ? 512 : 256);
  T.push(performance.now());
  if (P.__timing) console.log('head_a timing ms: sculpt', (T[1] - T[0]).toFixed(0), 'normals', (T[2] - T[1]).toFixed(0), 'skinV', (T[3] - T[2]).toFixed(0), 'detail', (T[4] - T[3]).toFixed(0), 'feat', (T[5] - T[4]).toFixed(0));
  // tear lines
  const tears = hi || med ? D.eyes.map(e => (e.lowerP.length > 3 ? tearLineGeometry(e.lowerP, e.center, 0.0006 * D.S) : null)) : [null, null];
  c = { geometry: g, D, SV, detail, feat, tears };
  CACHE.set(k, c);
  return c;
}

export function createHead(params = {}) {
  const P = normParams(params);
  const B = build(P);
  const { geometry, D, SV } = B;
  const F = D.F;
  const group = new THREE.Group();
  group.name = 'head_a';
  const grey = Math.min(1, Math.max(0, (P.age - 45) / 25));
  const stub = [0.018 + 0.2 * grey, 0.014 + 0.19 * grey, 0.012 + 0.18 * grey];
  const skinMaterial = createSkinMaterial({
    base: SV.base, featAlbedo: B.feat ? B.feat.albedo : null, featNormal: B.feat ? B.feat.normal : null, detail: B.detail,
    stubbleColor: stub, sss: P.detail === 'low' ? 0.7 : 1, poreStrength: P.detail === 'high' ? 0.55 : 0.35,
  });
  const mesh = new THREE.Mesh(geometry, skinMaterial);
  mesh.name = 'headSkin';
  mesh.morphTargetInfluences = [0, 0, 0];
  group.add(mesh);
  // eyes
  const eyes = D.eyes.map(e => {
    const L = e.lids;
    const eye = createEye({ center: e.center, radius: e.radius, side: e.side, eyeColor: P.eyeColor, seed: P.seed + (e.side > 0 ? 0 : 7), detail: P.detail, lidUp: 4.3 / (L.R), lidLo: -5.2 / (L.R) });
    group.add(eye.group);
    return eye;
  });
  const wetMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.06, metalness: 0, envMapIntensity: 1.4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const t of B.tears) if (t) { const m = new THREE.Mesh(t, wetMat); m.name = 'tearLine'; m.renderOrder = 3; group.add(m); }
  // caruncles
  if (P.detail !== 'low') {
    const carMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.62, 0.26, 0.24), roughness: 0.25, metalness: 0 });
    const carGeo = new THREE.SphereGeometry(1, 10, 8);
    for (const e of D.eyes) { const m = new THREE.Mesh(carGeo, carMat); m.position.set(...e.caruncle.p); m.scale.set(...e.caruncle.r); m.name = 'caruncle'; group.add(m); }
  }
  const L = D.landmarks;
  const v3 = a => new THREE.Vector3(a[0], a[1], a[2]);
  let blink = 0, gazeUp = 0;
  const applyBlink = () => { mesh.morphTargetInfluences[0] = Math.min(1, Math.max(-0.18, blink - gazeUp * 0.35 * (1 - blink))); };
  const tmp = new THREE.Vector3();
  return {
    group, skinMaterial,
    setGaze(p) {
      gazeUp = 0;
      for (const e of eyes) {
        if (!p) { e.setRotation(0, 0); continue; }
        group.updateWorldMatrix(true, false);
        tmp.copy(p); group.worldToLocal(tmp);
        tmp.sub(e.group.position);
        const ry = Math.max(-0.42, Math.min(0.42, Math.atan2(tmp.x, tmp.z)));
        const rx = -Math.max(-0.32, Math.min(0.26, Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z))));
        e.setRotation(rx, ry);
        gazeUp = -rx;
      }
      applyBlink();
    },
    setBlink(v) { blink = v; applyBlink(); },
    setMouth(v) { mesh.morphTargetInfluences[1] = v; },
    setSmile(v) { mesh.morphTargetInfluences[2] = v; },
    update() {},
    scalp: { geometry, center: new THREE.Vector3(0, 0.09 * D.S, -0.008 * D.S), radius: 0.105 * D.S },
    landmarks: { eyeL: v3(L.eyeL), eyeR: v3(L.eyeR), noseTip: v3(L.noseTip), mouth: v3(L.mouth), chin: v3(L.chin), crown: v3(L.crown), earL: v3(L.earL), earR: v3(L.earR), browL: v3(L.browL), browR: v3(L.browR) },
    dispose() { skinMaterial.dispose(); for (const e of eyes) e.dispose(); wetMat.dispose(); },
    _data: F,
  };
}
