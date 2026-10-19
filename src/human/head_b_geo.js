// AFTERZERO head_b: skin mesh from the anatomical SDF.
// Adaptive octree dual contouring (head_b_mesh.js) with cell sizes chosen per region (fine lid
// margins / lip line, medium nose / ears / lips, coarse skull) -> tangential relaxation re-projected
// onto the field -> normals -> per-vertex tissue labels, curvature and SDF ambient occlusion.
// Pure JS (no three.js).

import { PART, clamp, smoothstep, lidAt } from './head_b_sdf.js';
import { polygonize, computeNormals, relax, compact } from './head_b_mesh.js';

const { sqrt, abs, max, min } = Math;

// octree: root cube 0.36 m at depth 9 -> leaf sizes 0.70, 1.41, 2.81, 5.6, 11.25 mm
const ROOT = { min: [-0.18, -0.15, -0.135], size: 0.36 };
const C1 = 0.00072, C2 = 0.00143, C3 = 0.00285, C4 = 0.0057, C5 = 0.0114;

function sizeFn(m, F, detail) {
  const hi = detail === 'high', med = detail === 'medium';
  const E = F.E;
  const sMargin = hi ? C1 : med ? C2 : C4;
  const sEye = hi ? C2 : med ? C3 : C4;
  const sLipLine = hi ? C1 : med ? C2 : C4;
  const sNose = hi ? C2 : med ? C3 : C4;
  const sEar = hi ? C2 : med ? C3 : C5;
  const sFace = hi ? C3 : C4;
  const sBack = hi ? C4 : med ? C4 : C5;
  const mw = m.mouthHW;
  return (x, y, z) => {
    const ax = abs(x);
    // eyes
    const ex = ax - E.x, ey = y - E.y, ez = z - E.z;
    const er2 = ex * ex + ey * ey + ez * ez;
    if (er2 < 0.0185 * 0.0185 && ez > -0.004) {
      const r = sqrt(er2);
      if (r > F.Re - 0.0015 && r < F.Re + 0.0045) {
        const al = Math.atan2(ex, ez), be = Math.atan2(ey, sqrt(ex * ex + ez * ez));
        const L = lidAt(m, al);
        if (L[2] > -0.08 && L[2] < 1.08 && (abs(be - L[0]) < 0.22 || abs(be - L[1]) < 0.2)) return sMargin;
      }
      return sEye;
    }
    // lips / mouth line
    if (ax < mw + 0.006 && abs(y - m.mouthY) < 0.016 && z > m.lipZ - 0.02) {
      if (abs(y - m.mouthY) < 0.0035 && z > m.lipZ - 0.014) return sLipLine;
      return sNose;
    }
    // nose
    if (ax < 0.024 && y > m.noseBaseY - 0.006 && y < m.sellY + 0.005 && z > m.sellZ - 0.012) return sNose;
    // ears
    if (ax > 0.06 && y > 0.025 && y < 0.12 && z < 0.025 && z > -0.045) return sEar;
    if (detail === 'low') return z > 0.04 && ax < 0.055 && y > m.chinY - 0.01 && y < m.browY + 0.02 ? C4 : C5;
    // face front
    if (z > 0.02 && ax < 0.07 && y > m.chinY - 0.012 && y < m.browY + 0.035) return sFace;
    if (z > -0.03 && y > m.chinY - 0.03 && y < m.browY + 0.06) return hi ? C3 : C4;
    if (y < -0.08) return C5;
    return sBack;
  };
}

/**
 * Build the skin mesh in canonical coordinates.
 * @returns {{position:Float32Array,index:Uint32Array,normal:Float32Array,part:Uint8Array,stats:object}}
 */
export function buildSkinMesh(m, F, detail = 'high') {
  const t0 = performance.now();
  const depth = detail === 'low' ? 8 : 9;
  const sdf = F.sdf;
  const res = polygonize(sdf, { min: ROOT.min, size: ROOT.size, depth, sizeFn: sizeFn(m, F, detail), lip: 1.6 });
  const t1 = performance.now();
  let { positions: P, indices: I } = compact(res.positions, res.indices);
  // relax: stronger on coarse regions, gentle at the lid margins and lip line
  relax(P, I, detail === 'low' ? 2 : 3, 0.5, sdf, null);
  const t2 = performance.now();
  const N = computeNormals(P, I);
  const nv = P.length / 3;
  const part = new Uint8Array(nv);
  for (let i = 0; i < nv; i++) part[i] = F.part(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  const t3 = performance.now();
  return { position: P, index: I, normal: N, part, stats: { tris: I.length / 3, verts: nv, evals: res.stats.evals, ms: { poly: t1 - t0, relax: t2 - t1, attr: t3 - t2 } } };
}

export { PART, clamp, smoothstep, max, min };
