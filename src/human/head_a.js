// AFTERZERO realistic head, approach A (work in progress rebuild)
import * as THREE from 'three';
import { normParams, faceSpec } from './head_a_spec.js';
import { getGrid } from './head_a_grid.js';
import { evalGrid, computeNormals } from './head_a_mesh.js';

export function createHead(params = {}) {
  const P = normParams(params);
  const F = faceSpec(P);
  const G = getGrid(P.detail);
  const t0 = performance.now();
  const M = evalGrid(F, G);
  const t1 = performance.now();
  const sc = 0.001 * F.S;
  const pos = new Float32Array(M.pos.length);
  for (let i = 0; i < pos.length; i++) pos[i] = M.pos[i] * sc;
  const nrm = computeNormals(pos, G.index, G.seam);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(G.uv, 2));
  g.setIndex(G.index);
  const skinMaterial = new THREE.MeshStandardMaterial({ color: P.skin, roughness: 0.55 });
  const mesh = new THREE.Mesh(g, skinMaterial);
  mesh.name = 'headSkin';
  const group = new THREE.Group();
  group.add(mesh);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(F.eyeR * sc, 24, 16), eyeMat);
    e.position.set(s * F.E[0] * sc, F.E[1] * sc, F.E[2] * sc);
    group.add(e);
    const ir = new THREE.Mesh(new THREE.CircleGeometry(5.8 * sc, 24), new THREE.MeshStandardMaterial({ color: P.eyeColor }));
    ir.position.set(s * F.E[0] * sc, F.E[1] * sc, (F.E[2] + F.eyeR * 0.96) * sc);
    group.add(ir);
  }
  console.log('head_a eval ms', (t1 - t0).toFixed(1), 'verts', G.NVtx, 'tris', G.index.length / 3);
  return {
    group, skinMaterial,
    setGaze() {}, setBlink() {}, setMouth() {}, setSmile() {}, update() {},
    scalp: { geometry: g, center: new THREE.Vector3(0, 0.09 * F.S, -0.01 * F.S), radius: 0.105 * F.S },
    landmarks: {},
    dispose() {},
  };
}
