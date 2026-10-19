// head_a mesh: evaluates the sculpted form on the canonical grid (head_a_grid.js) for one person.
import { interpS, lerp, clamp } from './head_a_util.js';
import { makeSurface, dirOf, knotHeights, KA, CEN } from './head_a_form.js';
import { makeEyeModel, applyLids } from './head_a_lids.js';
import { makeMouthModel, applyLips } from './head_a_lips.js';

const DEG = Math.PI / 180;

// elevation (rad) of the surface point at height y on the column of azimuth th
function elevAtHeight(S, th, y, guess) {
  const C = CEN;
  let ph = guess !== undefined ? guess : Math.atan2(y - C[1], 85);
  const d = [0, 0, 0], p = [0, 0, 0];
  for (let it = 0; it < 10; it++) {
    S.point(dirOf(th, ph, d), p);
    const hz = Math.hypot(p[0] - C[0], p[2] - C[2]);
    const ph2 = Math.atan2(y - C[1], hz);
    if (Math.abs(ph2 - ph) < 2e-4) { ph = ph2; break; }
    ph = ph2;
  }
  return ph;
}

export function evalGrid(F, G, hooks = {}) {
  const S = makeSurface(F);
  const KH = knotHeights(F);
  const names = G.knotNames;
  const NK = names.length;
  const W = G.W, NU = G.NU, NV = G.NV;
  // knot elevations per column (symmetric: compute for th >= 0, mirror; asymmetry is added by fields)
  const kel = new Float64Array((NU + 1) * NK);
  const NH = G.NH;
  for (let h = 0; h <= NH; h++) {
    const thDeg = G.colTh[NH + h];
    const th = thDeg * DEG;
    let prev;
    for (let k = 0; k < NK; k++) {
      const y = interpS(KA, KH[names[k]], Math.abs(thDeg));
      let e;
      if (names[k] === 'bottom') e = elevAtHeight(S, th, y, -1.15);
      else e = elevAtHeight(S, th, y, prev);
      if (k > 0 && e <= kel[(NH + h) * NK + k - 1] + 1e-4) e = kel[(NH + h) * NK + k - 1] + 1e-3;
      kel[(NH + h) * NK + k] = e; kel[(NH - h) * NK + k] = e;
      prev = e;
    }
  }
  const pos = new Float64Array(G.NVtx * 3);
  const dir = new Float64Array(G.NVtx * 3);
  const d = [0, 0, 0], p = [0, 0, 0];
  for (let j = 0; j < NV; j++) {
    const [s, f] = G.rowSeg[j];
    for (let i = 0; i <= NU; i++) {
      const th = G.colTh[i] * DEG;
      const e0 = kel[i * NK + s], e1 = s + 1 < NK ? kel[i * NK + s + 1] : e0;
      const ph = lerp(e0, e1, f);
      dirOf(th, ph, d);
      S.point(d, p);
      const k = (j * W + i) * 3;
      pos[k] = p[0]; pos[k + 1] = p[1]; pos[k + 2] = p[2];
      dir[k] = d[0]; dir[k + 1] = d[1]; dir[k + 2] = d[2];
    }
  }
  // crown pole
  dirOf(0, Math.PI / 2, d); S.point(d, p);
  const kp = G.pole * 3; pos[kp] = p[0]; pos[kp + 1] = p[1]; pos[kp + 2] = p[2]; dir[kp] = 0; dir[kp + 1] = 1; dir[kp + 2] = 0;
  const base = pos.slice();
  const eyes = [makeEyeModel(F, -1), makeEyeModel(F, 1)];
  const margins = eyes.map(EM => applyLids(F, G, pos, base, EM, 0, true));
  const MMd = makeMouthModel(F, S.FC);
  applyLips(F, G, S.FC, pos, base, MMd, 0, 0);
  return { pos, base, dir, S, kel, eyes, margins, mouth: MMd };
}

// area-weighted vertex normals with seam welding
export function computeNormals(pos, index, seam, out) {
  const n = out || new Float32Array(pos.length);
  n.fill(0);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    n[a] += nx; n[a + 1] += ny; n[a + 2] += nz; n[b] += nx; n[b + 1] += ny; n[b + 2] += nz; n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
  }
  if (seam) for (const [a, b] of seam) { for (let k = 0; k < 3; k++) { const s = n[a * 3 + k] + n[b * 3 + k]; n[a * 3 + k] = s; n[b * 3 + k] = s; } }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}
export { clamp };
