// AFTERZERO realistic head, approach A: sculpted deformation of a dense sphere-topology mesh.
// createHead(params) per docs/ART_SPEC.md section 1. All geometry and textures are generated here.
import * as THREE from 'three';
import { buildHeadData, computeNormals } from './head_a_sculpt.js';
import { normParams } from './head_a_spec.js';

const GEO_CACHE = new Map();

function keyOf(P) { return JSON.stringify([P.sex, P.age, P.seed, P.shape, P.detail]); }

function buildGeometry(P) {
  const k = keyOf(P);
  let c = GEO_CACHE.get(k);
  if (c) return c;
  const D = buildHeadData(P);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(D.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(computeNormals(D.position, D.index, D.seamPairs), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(D.uv, 2));
  g.setIndex(new THREE.BufferAttribute(D.index, 1));
  // morphs (relative)
  const mp = [], mn = [];
  const n0 = g.getAttribute('normal').array;
  for (const d of D.morphs) {
    mp.push(new THREE.BufferAttribute(d, 3));
    const p = new Float32Array(D.position.length);
    for (let i = 0; i < p.length; i++) p[i] = D.position[i] + d[i];
    const n = computeNormals(p, D.index, D.seamPairs);
    for (let i = 0; i < n.length; i++) n[i] -= n0[i];
    mn.push(new THREE.BufferAttribute(n, 3));
  }
  g.morphAttributes.position = mp; g.morphAttributes.normal = mn; g.morphTargetsRelative = true;
  // vertex colors from tags (interior darkening)
  const col = new Float32Array(D.NV * 3);
  for (let i = 0; i < D.NV; i++) {
    const t = D.tag[i];
    let c3 = [1, 1, 1];
    if (t === 1) c3 = [0.95, 0.62, 0.6];
    else if (t === 2) c3 = [0.45, 0.2, 0.2];
    else if (t === 3) c3 = [0.18, 0.05, 0.05];
    else if (t === 4) c3 = [0.12, 0.05, 0.04];
    else if (t === 5) c3 = [0.8, 0.45, 0.45];
    col[i * 3] = c3[0]; col[i * 3 + 1] = c3[1]; col[i * 3 + 2] = c3[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  c = { geometry: g, data: D };
  GEO_CACHE.set(k, c);
  return c;
}

export function createHead(params = {}) {
  const P = normParams(params);
  const { geometry, data: D } = buildGeometry(P);
  const group = new THREE.Group();
  group.name = 'head_a';
  const skinMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.skin), roughness: 0.55, vertexColors: true });
  const mesh = new THREE.Mesh(geometry, skinMaterial);
  mesh.name = 'headSkin';
  mesh.morphTargetInfluences = [0, 0, 0];
  group.add(mesh);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xe8e2da, roughness: 0.15 });
  const irisMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.eyeColor), roughness: 0.2 });
  const eyes = D.eyes.map(e => {
    const g = new THREE.Group();
    g.position.set(...e.center);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(e.radius, 32, 20), eyeMat);
    g.add(ball);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(e.radius * 0.5, 24), irisMat);
    iris.position.z = e.radius * 0.88;
    g.add(iris);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(e.radius * 0.2, 16), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    pupil.position.z = e.radius * 0.885;
    g.add(pupil);
    group.add(g);
    return g;
  });
  const L = D.landmarks;
  const v3 = a => new THREE.Vector3(a[0], a[1], a[2]);
  const head = {
    group, skinMaterial,
    setGaze(p) {
      for (const e of eyes) {
        if (!p) { e.rotation.set(0, 0, 0); continue; }
        const local = group.worldToLocal(p.clone());
        const d = local.sub(e.position);
        e.rotation.set(-Math.max(-0.3, Math.min(0.3, Math.atan2(d.y, d.z))), Math.max(-0.4, Math.min(0.4, Math.atan2(d.x, d.z))), 0);
      }
    },
    setBlink(v) { mesh.morphTargetInfluences[0] = v; },
    setMouth(v) { mesh.morphTargetInfluences[1] = v; },
    setSmile(v) { mesh.morphTargetInfluences[2] = v; },
    update() {},
    scalp: { geometry, center: new THREE.Vector3(0, 0.09 * D.S, -0.005 * D.S), radius: 0.105 * D.S },
    landmarks: { eyeL: v3(L.eyeL), eyeR: v3(L.eyeR), noseTip: v3(L.noseTip), mouth: v3(L.mouth), chin: v3(L.chin), crown: v3(L.crown), earL: v3(L.earL), earR: v3(L.earR) },
    dispose() { skinMaterial.dispose(); },
  };
  return head;
}
