// AFTERZERO head_b (work in progress skeleton)
import * as THREE from 'three';
import { makeModel, sdf } from './head_b_sdf.js';
import { polygonize, computeNormals, relax } from './head_b_mesh.js';

function sizeFnHigh(m) {
  const S = m.S;
  return (x, y, z) => {
    x /= S; y /= S; z /= S;
    const ax = Math.abs(x);
    const dex = ax - m.eyeX, dey = y - m.eyeY, dez = z - m.eyeZ;
    if (dex * dex + dey * dey + dez * dez < 0.019 * 0.019) return 0.0013;
    if (ax < 0.026 && y > 0.022 && y < 0.1 && z > 0.075) return 0.0013;
    if (ax < 0.036 && y > -0.014 && y < 0.024 && z > 0.06) return 0.0013;
    const ux = ax - m.earX, uy = y - m.earY, uz = z - m.earZ;
    if (ux * ux + uy * uy + uz * uz < 0.04 * 0.04) return 0.0013;
    if (z > 0.02 && ax < 0.066 && y > -0.055 && y < 0.14) return 0.0026;
    return 0.0052;
  };
}

export function createHead(params = {}) {
  const t0 = performance.now();
  const m = makeModel(params);
  const f = (x, y, z) => sdf(m, x, y, z);
  const r = polygonize(f, { min: [-0.16, -0.11, -0.145], size: 0.32, depth: 9, sizeFn: sizeFnHigh(m), lip: 1.3 });
  const P = r.positions, I = r.indices;
  relax(P, I, 2, 0.5, f);
  const N = computeNormals(P, I);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setIndex(new THREE.BufferAttribute(I, 1));
  const skin = new THREE.MeshStandardMaterial({ color: params.skin ?? 0xc89070, roughness: 0.55 });
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geo, skin);
  group.add(mesh);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xe8e2da, roughness: 0.1 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.012 * m.S, 32, 24), eyeMat);
    e.position.set(s * m.eyeX * m.S, m.eyeY * m.S, m.eyeZ * m.S);
    group.add(e);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0058 * m.S, 32), new THREE.MeshStandardMaterial({ color: params.eyeColor ?? 0x3d2a18, roughness: 0.2 }));
    iris.position.set(s * m.eyeX * m.S, m.eyeY * m.S, (m.eyeZ + 0.0118) * m.S);
    group.add(iris);
  }
  console.log('head_b build', (performance.now() - t0).toFixed(1), 'ms tris', I.length / 3, JSON.stringify(r.stats));
  const v = (a, b, c) => new THREE.Vector3(a, b, c).multiplyScalar(m.S);
  return {
    group, skinMaterial: skin,
    setGaze() {}, setBlink() {}, setMouth() {}, setSmile() {}, update() {},
    scalp: { geometry: geo, center: v(0, 0.09, -0.01), radius: 0.1 * m.S },
    landmarks: { eyeL: v(m.eyeX, m.eyeY, m.eyeZ), eyeR: v(-m.eyeX, m.eyeY, m.eyeZ), noseTip: v(0, 0.047, 0.12), mouth: v(0, 0.005, 0.1), chin: v(0, -0.035, 0.085), crown: v(0, 0.195, 0), earL: v(0.075, 0.07, -0.01), earR: v(-0.075, 0.07, -0.01) },
    dispose() { geo.dispose(); skin.dispose(); },
  };
}
