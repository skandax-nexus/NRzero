// AFTERZERO head_b: procedural anatomical signed distance field for a human head.
// Our own construction from anatomical masses: cranium (vault + frontal bone), a lofted
// face mass (per-height superellipse sections measured from adult proportions), mandible caps
// (front-view jaw outline + side-view jawline/ramus), zygoma, cheek pads, brow ridge, eye sockets
// with eyelids carved around the eyeball, nose (dorsum, lobule, alae, columella, nostrils), lips
// (outline driven volumes, philtrum, slit and mouth cavity), chin, ears and neck; blended with
// smooth min / max. Units: meters in head-group space (+Y up, face toward +Z, character left = +X).
// No three.js dependency (unit testable in node).

const { sqrt, abs, min, max, exp, sin, cos, atan2, PI, pow } = Math;

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function smoothstep(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
export function mix(a, b, t) { return a + (b - a) * t; }
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---- primitives -----------------------------------------------------------------------------
export function ell(x, y, z, rx, ry, rz) {
  const ax = x / rx, ay = y / ry, az = z / rz;
  const k0 = sqrt(ax * ax + ay * ay + az * az);
  if (k0 < 1e-6) return -min(rx, ry, rz);
  const bx = ax / rx, by = ay / ry, bz = az / rz;
  const k1 = sqrt(bx * bx + by * by + bz * bz);
  return k0 * (k0 - 1) / k1;
}
export function smin(a, b, k) { const h = k - abs(a - b); if (h <= 0) return a < b ? a : b; const t = h / k; return (a < b ? a : b) - t * t * k * 0.25; }
export function smax(a, b, k) { const h = k - abs(a - b); if (h <= 0) return a > b ? a : b; const t = h / k; return (a > b ? a : b) + t * t * k * 0.25; }
function rcone(px, py, pz, ax, ay, az, ra, bx, by, bz, rb) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const t = clamp((pax * bax + pay * bay + paz * baz) / l2, 0, 1);
  const dx = pax - bax * t, dy = pay - bay * t, dz = paz - baz * t;
  return sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t);
}
// signed distance to an open 2D polyline (flat array [x0,y0,x1,y1,...]); negative on the left side
export function polySD(P, px, py) {
  let best = 1e9, sg = 1;
  for (let i = 0; i + 3 < P.length; i += 2) {
    const ax = P[i], ay = P[i + 1], bx = P[i + 2], by = P[i + 3];
    const ex = bx - ax, ey = by - ay, wx = px - ax, wy = py - ay;
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
    const dx = wx - ex * t, dy = wy - ey * t, dd = dx * dx + dy * dy;
    if (dd < best) { best = dd; sg = (ex * wy - ey * wx) > 0 ? -1 : 1; }
  }
  return sqrt(best) * sg;
}
export function gauss(v, s) { const q = v / s; return q * q > 16 ? 0 : exp(-q * q); }

// ---- monotone cubic tables ------------------------------------------------------------------
function spline(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0]);
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const dk = [], mk = new Array(n);
  for (let i = 0; i < n - 1; i++) dk.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  mk[0] = dk[0]; mk[n - 1] = dk[n - 2];
  for (let i = 1; i < n - 1; i++) mk[i] = dk[i - 1] * dk[i] <= 0 ? 0 : (dk[i - 1] + dk[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (dk[i] === 0) { mk[i] = mk[i + 1] = 0; continue; }
    const a = mk[i] / dk[i], b = mk[i + 1] / dk[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / sqrt(h); mk[i] = t * a * dk[i]; mk[i + 1] = t * b * dk[i]; }
  }
  return v => {
    if (v <= xs[0]) return ys[0];
    if (v >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (xs[i + 1] < v) i++;
    const h = xs[i + 1] - xs[i], t = (v - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * mk[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * mk[i + 1];
  };
}
// sampled table over [Y0, Y0 + (TN-1)*DY] with derivative
const Y0 = -0.06, DY = 0.0005, TN = 420;
function table(pts) {
  const f = spline(pts);
  const out = new Float64Array(TN);
  for (let j = 0; j < TN; j++) out[j] = f(Y0 + j * DY);
  return out;
}
function tget(t, fi) { const i = fi | 0; return t[i] + (t[i + 1] - t[i]) * (fi - i); }
function tder(t, fi) { const i = fi | 0; return (t[i + 1] - t[i]) / DY; }

// ---- model ----------------------------------------------------------------------------------
export function makeModel(p) {
  const sex = clamp(p.sex ?? 0, 0, 1);
  const age = clamp(p.age ?? 30, 8, 80);
  const shape = p.shape || {}, marks = p.marks || {};
  const s = k => clamp(+shape[k] || 0, -1, 1);
  const rnd = mulberry32((p.seed | 0) * 7919 + 13);
  const r2 = () => rnd() * 2 - 1;
  const fem = sex, mal = 1 - sex;
  const ageY = clamp((age - 8) / 12, 0, 1);
  const old = clamp((age - 35) / 35, 0, 1);
  const young = clamp((28 - age) / 12, 0, 1);
  const m = {
    sex, age, fem, mal, old, young, child: 1 - ageY,
    S: mix(1, 0.94, fem) * mix(0.88, 1, ageY),
    seed: p.seed | 0,
    jaw: s('jaw'), cheek: s('cheek'), nose: s('nose'), noseWv: s('noseWidth'), lips: s('lips'),
    brow: s('brow'), eyeSize: s('eyeSize'), faceLen: s('faceLength'), chin: s('chin'),
    wrinkles: clamp(marks.wrinkles ?? 0, 0, 1),
    off: new Set(p._off || []),
    asym: [r2(), r2(), r2(), r2(), r2(), r2(), r2(), r2()],
  };
  const J = m.jaw, C = m.chin, CK = m.cheek, FL = m.faceLen;
  m.fl = 1 + 0.05 * FL - 0.04 * m.child;
  // jaw strength: male, jaw param; softer for women and children
  const jw = mix(1, 0.9, fem) * (1 + 0.06 * J) * mix(1, 0.92, m.child);
  const lowW = mix(1, 0.93, fem) * (1 + 0.03 * J);
  // ---- mandible ----
  m.gonX = (0.0515 + 0.0035 * J) * mix(1, 0.92, fem) * mix(1, 0.94, m.child);
  m.gonY = -0.006 - 0.003 * J + 0.004 * fem;
  m.gonZ = -0.004;
  m.mentY = (-0.0475 - 0.002 * C - 0.002 * FL) + 0.003 * fem;
  m.mentZ = 0.068 + 0.004 * C;
  m.chinHW = (0.020 + 0.003 * J + 0.0025 * mal) * (1 + 0.04 * C);
  m.jawRound = mix(0.008, 0.012, fem) - 0.002 * J;
  // jaw outline in front view (x, y) and jawline/ramus in side view (z, y): polylines, face on the left
  {
    const f = spline([[0, m.mentY], [m.chinHW * 0.6, m.mentY + 0.0006], [m.chinHW, m.mentY + 0.0024], [mix(m.chinHW, m.gonX, 0.5), mix(m.mentY, m.gonY, 0.45)],
      [m.gonX * 0.95, m.gonY - 0.0055], [m.gonX, m.gonY]]);
    const F = [-0.01, m.mentY];
    for (let i = 0; i <= 24; i++) { const x = m.gonX * i / 24; F.push(x, f(x)); }
    F.push(m.gonX + 0.012, m.gonY + 0.014, m.gonX + 0.08, m.gonY + 0.05);
    m.jawFP = F;
    const gz = m.gonZ, gy = m.gonY, mz = m.mentZ, my = m.mentY;
    const g = spline([[gz, gy], [mix(gz, mz, 0.35), mix(gy, my, 0.38)], [mix(gz, mz, 0.7), mix(gy, my, 0.74)], [mz, my], [mz + 0.012, my - 0.0005]]);
    const Sd = [gz - 0.06, gy + 0.045, gz - 0.025, gy + 0.016, gz - 0.008, gy + 0.003];
    for (let i = 0; i <= 20; i++) { const zz = gz + (mz + 0.012 - gz) * i / 20; Sd.push(zz, g(zz)); }
    Sd.push(mz + 0.04, my - 0.001);
    m.jawSP = Sd;
  }
  // eyes
  m.eyeR = 0.0119;
  m.eyeX = 0.0322 - 0.0008 * fem - 0.0006 * m.child; m.eyeY = 0.0855; m.eyeZ = 0.0718 + 0.0015 * fem + 0.0006 * m.eyeSize - 0.0012 * mal * (m.brow > 0 ? m.brow : 0);
  m.lidT = 0.0019 + 0.0002 * old;
  // almond fissure in the eye's frontal plane (metres, eye-local, left eye; medial = -x)
  const es = m.eyeSize, bp = Math.max(0, m.brow) * mal;
  m.cMx = -(0.0158 + 0.0004 * fem) * (1 + 0.025 * es); m.cMy = -0.0004;
  m.cLx = 0.0119 + 0.0004 * es; m.cLy = 0.0012 + 0.0012 * fem - 0.0008 * old;
  m.hU = 0.0045 + 0.0004 * fem + 0.0007 * es - 0.0005 * old - 0.0007 * bp;
  m.hL = 0.0047 + 0.0002 * fem + 0.0004 * es - 0.0004 * bp;
  m.sU = 0.43; m.sL = 0.6;
  m.creaseH = 0.0031 + 0.0012 * fem - 0.0006 * old;
  m.hood = clamp(0.35 + 0.65 * old - 0.15 * fem + 0.35 * m.brow, 0, 1.3);
  m.bags = clamp(0.15 + 0.85 * old - 0.3 * young, 0, 1);
  // legacy angular lid parameters (kept for reference / tilt)
  m.tilt = 0.06 + 0.07 * fem - 0.05 * old;
  m.browP = clamp(0.6 * mal + 0.15 + 0.35 * m.brow, 0, 1.3);
  // nose
  m.noseLen = 1 + 0.06 * m.nose + 0.035 * old - 0.05 * fem - 0.08 * m.child;
  m.noseProj = 1 + 0.07 * m.nose - 0.06 * fem - 0.1 * m.child;
  m.noseW = 1 + 0.12 * m.noseWv + 0.04 * mal + 0.04 * old;
  m.bridge = 1 + 0.3 * m.nose - 0.25 * fem - 0.3 * m.child;
  // mouth
  m.mouthHW = (0.0245 - 0.0007 * fem) * (1 + 0.04 * m.lips);
  m.lipU = (0.0036 + 0.0012 * fem) * (1 + 0.35 * m.lips) * (1 - 0.3 * old);
  m.lipL = (0.0046 + 0.0012 * fem) * (1 + 0.35 * m.lips) * (1 - 0.25 * old);
  m.lipUH = (0.0072 + 0.0009 * fem) * (1 + 0.16 * m.lips) * (1 - 0.25 * old);
  m.lipLH = (0.0092 + 0.0009 * fem) * (1 + 0.16 * m.lips) * (1 - 0.2 * old);
  m.mouthY = 0.0075;
  m.cheekP = 1 + 0.35 * CK;
  m.neckR = mix(0.055, 0.047, fem);
  m.jowl = old;
  // ear
  m.earX = 0.0718; m.earY = 0.0705; m.earZ = -0.0105;
  m.earS = (1.04 + 0.08 * old - 0.03 * fem);
  // asymmetry (tiny, seeded)
  m.eyeDy = 0.0004 * m.asym[0];
  m.noseDev = 0.0005 * m.asym[1];
  m.pU = Math.log(0.5) / Math.log(0.43);
  m.pL = Math.log(0.5) / Math.log(0.57);
  m.relief = buildRelief(m);
  buildNose(m);
  buildLidTables(m);
  buildEyeRelief(m);
  return m;
}

// ---- eyelids ------------------------------------------------------------------------------------
// Fissure: an almond in the eye's frontal plane (lx, ly), upper margin yU(lx) and lower yL(lx),
// from the medial canthus (cMx, cMy) to the lateral canthus (cLx, cLy). Tabulated.
const LN = 256;
function bump(s, peak) { const e = Math.log(0.5) / Math.log(peak); return sin(PI * pow(clamp(s, 0, 1), e)); }
function buildLidTables(m) {
  m.lidU = new Float64Array(LN); m.lidL = new Float64Array(LN);
  for (let i = 0; i < LN; i++) {
    const s = i / (LN - 1), base = m.cMy + (m.cLy - m.cMy) * s;
    m.lidU[i] = base + m.hU * pow(bump(s, m.sU), 0.72);
    m.lidL[i] = base - m.hL * pow(bump(s, m.sL), 0.82);
  }
}
/** upper / lower margin heights (eye-local metres) at lateral offset lx; closed outside the canthi */
export function lidAt(m, lx) {
  const s = (lx - m.cMx) / (m.cLx - m.cMx);
  if (s <= 0) { const v = m.cMy; return { s, up: v, lo: v }; }
  if (s >= 1) { const v = m.cLy; return { s, up: v, lo: v }; }
  const f = s * (LN - 1), i = f | 0, t = f - i;
  return { s, up: m.lidU[i] + (m.lidU[i + 1] - m.lidU[i]) * t, lo: m.lidL[i] + (m.lidL[i + 1] - m.lidL[i]) * t };
}
// legacy-compatible angular view of the lid curves (az around the eye centre)
export function lidCurves(m, az) {
  const rr = m.eyeR + m.lidT * 0.5;
  const L = lidAt(m, rr * sin(az));
  const t = L.s;
  return { t, up: Math.asin(clamp(L.up / rr, -1, 1)), lo: Math.asin(clamp(L.lo / rr, -1, 1)), c: 0 };
}

// lid relief offset above the eyeball surface (mm) at projected lid coords (px, py) in mm
function lidDelta(m, px, py) {
  const L = lidAt(m, px / 1000);
  const yU = L.up * 1000, yL = L.lo * 1000, s = L.s;
  const T = m.lidT * 1000, cH = m.creaseH * 1000;
  const ym = (yU + yL) * 0.5;
  const hu = py - yU, hl = yL - py;
  const sp = (v, k) => (v > 20 * k ? v : k * Math.log(1 + exp(v / k))); // softplus
  const inner = smoothstep(-0.12, 0.15, s) * smoothstep(1.12, 0.85, s);
  // upper lid: margin, pretarsal plate, crease, fold (hood) rising to the brow
  let du = T + 0.08 * max(hu, 0) - 0.55 * gauss(hu - cH, 0.5) * inner * (1 - 0.6 * min(m.hood, 1));
  du += sp(hu - cH - 0.2, 1.2) * 0.62 + sp(hu - cH - 3.6, 1.0) * 2.6 + m.hood * 1.3 * gauss(hu - cH - 0.7, 1.0) * inner;
  // lower lid: margin, slight roll, lid-cheek junction, bags, rise to the cheek
  let dl = T * 0.88 + 0.2 * max(hl, 0) + 0.35 * gauss(hl - 1.5, 0.9) - 0.3 * gauss(hl - 4.2, 1.1) * inner;
  dl += m.bags * 1.5 * gauss(hl - 5.0, 1.8) * inner + sp(hl - 6.5, 1.2) * 0.55 + sp(hl - 9.0, 1.0) * 2.6;
  let dd = mix(dl, du, smoothstep(ym - 0.9, ym + 0.9, py));
  dd += 6.0 * pow(smoothstep(0.04, -0.32, s), 1.2) + 3.6 * smoothstep(0.97, 1.32, s) + 20 * smoothstep(-0.25, -0.6, s) + 20 * smoothstep(1.25, 1.65, s);
  return dd;
}

// radial lid relief around the eye centre: r_eye(az, el) table (left eye frame)
const EAZ = 1.75, EEL = 1.45, EST = 0.02, ENA = Math.round(2 * EAZ / EST) + 1, ENE = Math.round(2 * EEL / EST) + 1;
function buildEyeRelief(m) {
  const R = m.eyeR;
  const ex = m.eyeX, ey = m.eyeY, ez = m.eyeZ;
  // first exit of the face relief along rays from the eye centre (coarse grid, bicubic upsampled)
  const CS = 0.05, CA = Math.round(2 * EAZ / CS) + 3, CE = Math.round(2 * EEL / CS) + 3;
  const RF = new Float64Array(CA * CE);
  for (let j = 0; j < CE; j++) for (let i = 0; i < CA; i++) {
    const az = -EAZ + (i - 1) * CS, el = -EEL + (j - 1) * CS;
    const dx = cos(el) * sin(az), dy = sin(el), dz = cos(el) * cos(az);
    let lo = 0.0, hi = 0.0;
    // march to the first exit, then bisect
    for (let t = 0.004; t <= 0.05; t += 0.002) { if (relief(m, abs(ex + dx * t), ey + dy * t, ez + dz * t) > 0) { hi = t; lo = t - 0.002; break; } }
    if (hi === 0) { RF[j * CA + i] = 0.05; continue; }
    for (let it = 0; it < 12; it++) { const md = (lo + hi) * 0.5; if (relief(m, abs(ex + dx * md), ey + dy * md, ez + dz * md) < 0) lo = md; else hi = md; }
    RF[j * CA + i] = (lo + hi) * 0.5;
  }
  const WA = new Float64Array(8), WE = new Float64Array(8);
  const rf = (az, el) => {
    const fi = (az + EAZ) / CS + 1, fj = (el + EEL) / CS + 1;
    const i = clamp(fi | 0, 1, CA - 3), j = clamp(fj | 0, 1, CE - 3);
    crw(clamp(fi - i, 0, 1), WA); crw(clamp(fj - j, 0, 1), WE);
    let v = 0;
    for (let b = 0; b < 4; b++) { let s2 = 0; for (let a = 0; a < 4; a++) s2 += WA[a] * RF[(j - 1 + b) * CA + i - 1 + a]; v += WE[b] * s2; }
    return v;
  };
  const T = new Float32Array(ENA * ENE);
  const pr = (R + 0.002) * 1000;
  for (let j = 0; j < ENE; j++) for (let i = 0; i < ENA; i++) {
    const az = -EAZ + i * EST, el = -EEL + j * EST;
    const px = pr * cos(el) * sin(az), py = pr * sin(el);
    // outside the orbital opening the lid surface recedes (the face surface takes over)
    const q = sqrt(((az + 0.02) / 1.48) ** 2 + ((el - 0.03) / 0.95) ** 2);
    const rl = R + (lidDelta(m, px, py) + 30 * smoothstep(0.9, 1.35, q)) / 1000;
    T[j * ENA + i] = smin(rf(az, el), rl, 0.007);
  }
  m.eyeRel = T;
}
const EWA = new Float64Array(8), EWE = new Float64Array(8);
function eyeRelief(m, r, az, el) {
  const fi = (az + EAZ) / EST, fj = (el + EEL) / EST;
  const i = fi | 0, j = fj | 0;
  crw(fi - i, EWA); crw(fj - j, EWE);
  const T = m.eyeRel;
  let v = 0, va = 0, ve = 0;
  for (let b = 0; b < 4; b++) {
    const row = (j - 1 + b) * ENA;
    let s = 0, sd = 0;
    for (let a = 0; a < 4; a++) { const tv = T[row + i - 1 + a]; s += EWA[a] * tv; sd += EWA[4 + a] * tv; }
    v += EWE[b] * s; va += EWE[b] * sd; ve += EWE[4 + b] * s;
  }
  va /= EST; ve /= EST;
  const qa = va / (r * cos(el) + 1e-6), qe = ve / (r + 1e-6);
  return (r - v) / sqrt(1 + qa * qa + qe * qe);
}

export function sdf(m, X, Y, Z) {
  const S = m.S;
  return headField(m, X / S, Y / S, Z / S) * S;
}

// ---- face relief ------------------------------------------------------------------------------
// Horizontal anatomical sections of an average adult male face (mm): [height y, [[x, z], ...]] from
// the midline to the side (nose, lips and eyes are separate features; this is the underlying mass).
const SECT = [
  [-62, [[0, 56], [10, 55], [20, 52], [30, 47], [40, 38], [48, 25], [54, 8], [55, 0]]],
  [-50, [[0, 74], [8, 73], [16, 70], [24, 65], [32, 58], [39, 48], [45, 36], [50, 22], [54, 8], [55, 0]]],
  [-36, [[0, 87], [8, 86], [16, 82.5], [24, 76], [32, 67], [39, 56], [45, 43], [50, 28], [54, 12], [55, 0]]],
  [-22, [[0, 90.5], [8, 89.5], [16, 86], [24, 80], [32, 71], [39, 60], [45, 47], [50, 32], [54, 15], [55.5, 0]]],
  [-8, [[0, 91], [8, 90], [16, 86.5], [24, 81], [32, 73.5], [40, 64], [47, 52], [52, 38], [56, 20], [57.5, 5], [58, 0]]],
  [5, [[0, 96], [8, 94.5], [16, 90.5], [22, 86], [28, 81], [36, 74], [44, 64], [50, 53], [55, 39], [59, 22], [60.5, 5], [61, 0]]],
  [16, [[0, 98], [8, 96.5], [16, 92.5], [24, 86], [32, 79], [40, 71], [47, 62], [53, 50], [58, 35], [61, 18], [62, 0]]],
  [30, [[0, 97], [8, 95.5], [16, 91.5], [26, 84], [36, 76], [45, 67], [52, 56], [58, 43], [62, 28], [65, 12], [65.5, 0]]],
  [45, [[0, 92], [10, 90.5], [20, 86], [30, 79.5], [40, 72], [48, 64], [55, 53], [61, 40], [65, 25], [67.5, 10], [68, 0]]],
  [60, [[0, 86], [10, 86.5], [20, 85.5], [30, 81.5], [40, 75.5], [48, 68.5], [55, 58], [61, 45], [66, 30], [69.5, 13], [70.5, 0]]],
  [72, [[0, 84], [10, 84.5], [20, 84.5], [30, 82], [40, 77], [48, 71], [55, 61], [61, 49], [66, 34], [70, 16], [71.5, 0]]],
  [85, [[0, 86], [8, 86], [16, 86], [26, 86], [36, 84], [46, 76], [53, 66], [60, 52], [66, 35], [70, 16], [71.5, 0]]],
  [100, [[0, 91.5], [8, 91], [16, 90], [26, 89], [36, 86], [46, 79], [54, 68], [61, 54], [67, 37], [70.5, 18], [72, 0]]],
  [110, [[0, 96.5], [12, 95.5], [22, 94.5], [32, 92.5], [42, 87], [50, 79], [57, 67], [63, 52], [68, 35], [71, 15], [72, 0]]],
  [122, [[0, 95], [15, 93.5], [28, 89.5], [40, 82], [50, 72], [59, 57], [66, 37], [71, 10], [72, 0]]],
  [135, [[0, 92.5], [15, 91], [30, 86], [42, 77.5], [52, 66], [61, 48], [67, 27], [71.5, 0]]],
  [150, [[0, 85], [15, 83.5], [30, 78], [42, 69], [52, 56], [60, 40], [67, 20], [70, 0]]],
  [165, [[0, 72], [15, 70], [30, 64], [42, 55], [52, 43], [59, 28], [62, 10], [63, 0]]],
];
const RZA = -0.005;                 // relief axis depth
const RDT = PI / 180, RNT = 182;    // 1 degree steps, 0..181 deg
const RY0 = -0.068, RDY = 0.001, RNY = 272;

function buildRelief(m) {
  const fem = m.fem, J = m.jaw, C = m.chin, CK = m.cheek;
  const secs = SECT.map(([ymm, pts]) => {
    const yc = ymm / 1000, y = yc < 0.1 ? 0.1 + (yc - 0.1) * m.fl : yc;
    // lower face width (jaw) and chin projection
    const low = smoothstep(0.02, -0.012, yc);
    const wx = (1 + (0.055 * J - 0.075 * fem - 0.06 * m.child) * low) * (1 - 0.01 * fem);
    const chinF = (0.0022 * C + 0.0006 * m.mal - 0.001 * fem) * smoothstep(-0.004, -0.024, yc);
    const browF = (yc > 0.095 && yc < 0.125) ? (0.0012 * (m.browP - 0.6)) * gauss(yc - 0.109, 0.007) : 0;
    const out = pts.map(([xm, zm]) => {
      const x = xm / 1000 * wx, z0 = zm / 1000;
      const front = gauss(x, 0.03);
      return [x, z0 + chinF * front + browF * gauss(x - 0.025, 0.025)];
    });
    return [y, out];
  });
  // radius of the base volume (cranium + neck) along a horizontal ray from the relief axis
  const baseR = (th, y) => {
    const st = sin(th), ct = cos(th);
    if (baseVol(m, 0, y, RZA) >= 0) return -0.02;
    let lo = 0, hi = 0.13;
    for (let it = 0; it < 18; it++) { const md = (lo + hi) * 0.5; if (baseVol(m, st * md, y, RZA + ct * md) < 0) lo = md; else hi = md; }
    return lo;
  };
  // per section: r(theta) on the grid, linearly extrapolated beyond the last authored point
  const cols = secs.map(([, pts]) => {
    const th = pts.map(([x, z]) => atan2(x, z - RZA)), rr = pts.map(([x, z]) => sqrt(x * x + (z - RZA) * (z - RZA)));
    const tl = th[th.length - 1];
    const f = spline(th.map((t, i) => [t, rr[i]]));
    const rl = rr[rr.length - 1], slope = (f(tl) - f(tl - 0.03)) / 0.03;
    const o = new Float64Array(RNT);
    for (let k = 0; k < RNT; k++) { const t = k * RDT; o[k] = t <= tl ? f(t) : rl + slope * (t - tl); }
    return o;
  });
  const T = new Float32Array(RNT * RNY);
  const thL = spline(secs.map(([y, pts]) => { const [x, z] = pts[pts.length - 1]; return [y, atan2(x, z - RZA)]; }));
  const BR = new Float64Array(RNT * RNY);
  for (let j = 0; j < RNY; j++) for (let k = 0; k < RNT; k++) BR[j * RNT + k] = baseR(k * RDT, RY0 + j * RDY);
  for (let k = 0; k < RNT; k++) {
    const f = spline(secs.map(([y], i) => [y, cols[i][k]]));
    const th = k * RDT;
    for (let j = 0; j < RNY; j++) {
      const y = RY0 + j * RDY;
      const up = smoothstep(0.03, 0.06, y);
      const wSide = smoothstep(mix(thL(y) - 0.04, 1.0, up), mix(thL(y) + 0.26, 1.62, up), th), wTop = smoothstep(0.15, 0.175, y);
      const w = max(wSide, wTop);
      T[j * RNT + k] = w > 0 ? mix(f(y), BR[j * RNT + k], w) : f(y);
    }
  }
  // sculpt layers: gaussian bumps in (theta, y): [thetaDeg, y, sTheta, sY, amplitude m]
  const B = [
    [16, 0.108, 13, 0.006, 0.0012 * (m.browP - 0.6)],                   // brow ridge strength
    [33, 0.064, 9, 0.009, 0.0011 * m.cheekP],                         // malar eminence
    [32, 0.038, 11, 0.009, -(0.0004 + 0.0018 * m.old - 0.0008 * m.young - 0.0005 * fem)], // submalar hollow
    [52, 0.11, 8, 0.014, -(0.0008 + 0.0012 * m.old)],                  // temple hollow
    [61, 0.004, 9, 0.014, 0.0009 * m.mal + 0.0004 * J],                 // masseter
    [24, 0.048, 9, 0.009, 0.0007 * fem + 0.0006 * m.young + 0.0004 * CK], // cheek fat pad
    [40, -0.012, 9, 0.01, 0.0012 * m.old],                              // jowl
    [62, 0.063, 16, 0.0045, 0.0012],                                     // zygomatic arch
  ];
  for (const [td, yc, st, sy, A] of B) {
    if (abs(A) < 1e-6) continue;
    const tc = td * RDT, stt = st * RDT;
    for (let j = 0; j < RNY; j++) {
      const gy = gauss(RY0 + j * RDY - yc, sy); if (gy < 1e-4) continue;
      for (let k = 0; k < RNT; k++) T[j * RNT + k] += A * gy * gauss(k * RDT - tc, stt);
    }
  }
  return T;
}

// Catmull-Rom weights and derivatives
function crw(t, o) {
  const t2 = t * t, t3 = t2 * t;
  o[0] = -0.5 * t3 + t2 - 0.5 * t; o[1] = 1.5 * t3 - 2.5 * t2 + 1; o[2] = -1.5 * t3 + 2 * t2 + 0.5 * t; o[3] = 0.5 * t3 - 0.5 * t2;
  o[4] = -1.5 * t2 + 2 * t - 0.5; o[5] = 4.5 * t2 - 5 * t; o[6] = -4.5 * t2 + 4 * t + 0.5; o[7] = 1.5 * t2 - t;
}
const WK = new Float64Array(8), WJ = new Float64Array(8);
function relief(m, ax, y, z) {
  const dz = z - RZA;
  const rho = sqrt(ax * ax + dz * dz);
  const th = atan2(ax, dz);
  let fk = th / RDT, fj = (y - RY0) / RDY;
  if (fk > RNT - 2.001) fk = RNT - 2.001;
  if (fj < 1) fj = 1; else if (fj > RNY - 2.001) fj = RNY - 2.001;
  const k = fk | 0, j = fj | 0;
  crw(fk - k, WK); crw(fj - j, WJ);
  const T = m.relief;
  let r = 0, rt = 0, ry = 0;
  for (let b = 0; b < 4; b++) {
    const row = (j - 1 + b) * RNT;
    let v = 0, vd = 0;
    for (let a = 0; a < 4; a++) {
      let kk = k - 1 + a; if (kk < 0) kk = -kk; // mirror at the midline
      const tv = T[row + kk];
      v += WK[a] * tv; vd += WK[4 + a] * tv;
    }
    r += WJ[b] * v; rt += WJ[b] * vd; ry += WJ[4 + b] * v;
  }
  rt /= RDT; ry /= RDY;
  const q = rt / (rho + 1e-6);
  return (rho - r) / sqrt(1 + q * q + ry * ry);
}

function cranium(ax, y, z) {
  let d = ell(ax, y - 0.105, z + 0.016, 0.083, 0.09, 0.0905);
  d = smin(d, ell(ax, y - 0.116, z, 0.0655, 0.079, 0.0945), 0.026);
  d = smax(d, ax - 0.0755, 0.012);
  d = smin(d, ell(ax, y - 0.045, z + 0.03, 0.061, 0.042, 0.062), 0.03);   // skull base / mastoid region
  return d;
}

function neck(m, x, y, z) {
  const nr = m.neckR / m.S;
  return rcone(x, y, z, 0, 0.03, -0.024, nr * 1.0, 0, -0.16, -0.006, nr * 1.02);
}
function baseVol(m, ax, y, z) {
  return smin(cranium(ax, y, z), neck(m, ax, y, z) + 0.016, 0.03);
}

function baseField(m, x, y, z) {
  const ax = abs(x);
  const yf = y < 0.1 ? 0.1 + (y - 0.1) / m.fl : y;   // face-length scaling below the brow (canonical y)
  let d = relief(m, ax, y, z);
  // mandible: front-view jaw outline and side-view jawline (only on the face side of the head)
  if (!m.off.has('jaw') && y < 0.09) {
    const capF = polySD(m.jawFP, ax, yf);
    const capS = polySD(m.jawSP, z, yf);
    let cap = smax(capF, capS, m.jawRound);
    const th = atan2(ax, z - RZA);
    cap = min(cap, 0.02) - 0.06 * max(smoothstep(1.62, 1.95, th), smoothstep(0.05, 0.085, yf));
    d = smax(d, cap, m.jawRound);
  }
  // neck: hard union at the back (same surface), smooth under the jaw
  d = smin(d, neck(m, x, y, z), 0.016);
  // chin (mental protuberance)
  if (z > 0.03 && y < 0.02) d = smin(d, ell(x, yf - (m.mentY + 0.016), z - (m.mentZ + 0.002), m.chinHW * 0.95, 0.014, 0.0185), 0.01);
  return d;
}

function headField(m, x, y, z) {
  const ax = abs(x);
  const yf = y < 0.1 ? 0.1 + (y - 0.1) / m.fl : y;
  let d = baseField(m, x, y, z);
  const off = m.off;
  if (!off.has('eyes') && z > 0.025 && ax < 0.07 && y > 0.045 && y < 0.13) d = eyes(m, d, x, ax, y, z);
  if (!off.has('nose') && z > 0.06 && ax < 0.04 && yf > 0.015 && yf < 0.11) d = nose(m, d, x, yf, z);
  if (!off.has('mouth') && z > 0.03 && ax < 0.055 && yf > -0.035 && yf < 0.045) d = mouth(m, d, x, ax, y, yf, z);
  if (!off.has('ear') && ax > 0.045 && y > 0.015 && y < 0.125 && z < 0.035 && z > -0.065) d = ear(m, d, ax, y, z);

  d = smax(d, -0.095 / m.S - y, 0.004);  // neck cut
  return d;
}

// ---------------------------------------------------------------------------------------------
function eyes(m, d, x, ax, y, z) {
  const ey = m.eyeY + (x > 0 ? m.eyeDy : -m.eyeDy);
  const lx = ax - m.eyeX, ly = y - ey, lz = z - m.eyeZ;
  const R = m.eyeR, T = m.lidT;
  const r = sqrt(lx * lx + ly * ly + lz * lz);
  if (r > 0.034) return d;
  const h = sqrt(lx * lx + lz * lz);
  const az = atan2(lx, lz), el = atan2(ly, h);
  // lid relief replaces the face surface around the eye (identical to it outside the socket)
  // the eye region (lids sinking into the socket) replaces the face surface; identical to it outside the socket
  const wA = smoothstep(EAZ - 0.05, EAZ - 0.3, abs(az)) * smoothstep(EEL - 0.05, EEL - 0.3, abs(el)) * smoothstep(0.025, 0.02, r) * smoothstep(R - 0.006, R - 0.003, r);
  if (wA > 0) d = mix(d, eyeRelief(m, r, az, el), wA);
  // palpebral fissure: almond prism along z, opened down into the eyeball (medial notch to a floor)
  const L = lidAt(m, lx);
  let w = max(ly - L.up, L.lo - ly, m.cMx - lx, lx - m.cLx);
  w = max(w, (R - 0.0025) - r, -0.0022 - lz, r - (R + T + 0.0045));
  d = smax(d, -w, 0.0007);
  // caruncle in the medial canthus
  d = smin(d, ell(lx - (m.cMx + 0.0022), ly - (m.cMy + 0.0001), lz - 0.0011, 0.0019, 0.0022, 0.0028), 0.0012);
  return d;
}

// ---------------------------------------------------------------------------------------------
// Nose: heightfield relief over the face (ridge profile Zr(y), ridge rounding rr(y), side-wall slope sl(y))
// plus alae volumes, alar creases and nostril cavities. All in canonical mm inside, metres outside.
const NY0 = 20, NDY = 0.25, NN = 361; // tables over y = 20..110 mm
function buildNose(m) {
  const nl = m.noseLen, np = m.noseProj, fem = m.fem;
  const nas = 95;
  const zb = (y) => mix(89.5, 100.5, clamp((nas - y) / (nas - 32.8), 0, 1)); // nose base line (face plane under the nose)
  const scoop = 0.9 * fem + 0.4 * m.child - 0.6 * max(0, m.nose);
  const prof = [[104, 80], [99, 87.5], [96, 90.2], [92, 91.6], [86, 94.2], [80, 97.9], [72, 102.8], [64, 107.6], [57, 111.8], [52, 114.8], [48.5, 117.3], [46, 118.8],
    [43.6, 118.9], [41, 117.7], [38.6, 115.3], [36.6, 112.3], [35, 108.6], [33.8, 104.7], [32.8, 101], [31.6, 96], [30, 89], [26, 84]];
  const P = prof.map(([y, z]) => {
    const t = clamp((nas - y) / (nas - 32.8), 0, 1.2);
    const y2 = y > nas ? y : nas - (nas - y) * nl;
    let z2 = zb(y) + (z - zb(y)) * mix(1, np, smoothstep(0.1, 0.8, t)) * mix(1, m.bridge, 0.35 * (1 - t));
    z2 -= scoop * gauss(t - 0.45, 0.22);                                     // scooped (concave) dorsum
    z2 += 0.5 * m.old * gauss(t - 0.42, 0.15) + 0.6 * max(0, m.nose) * gauss(t - 0.4, 0.15); // dorsal hump
    const up = 1.0 * fem * gauss(t - 0.98, 0.1);                            // slight tip rotation (upturn)
    return [y2 + up, z2];
  });
  const Zr = spline(P);
  const nw = m.noseW;
  const RR = spline([[104, 6], [96, 3.6], [86, 2.6], [72, 2.5], [60, 3.0], [52, 4.0], [47, 5.3 * mix(1, nw, 0.6)], [42, 5.4 * mix(1, nw, 0.6)], [37, 3.6], [33, 2.6], [26, 3]]);
  const SL = spline([[104, 0.8], [96, 1.15], [86, 1.45], [72, 1.6], [60, 1.6], [52, 1.75], [46, 1.95 / mix(1, nw, 0.5)], [40, 2.05 / mix(1, nw, 0.5)], [35, 2.3], [26, 2.5]]);
  m.nZ = new Float64Array(NN); m.nR = new Float64Array(NN); m.nS = new Float64Array(NN);
  for (let i = 0; i < NN; i++) { const y = NY0 + i * NDY; const yy = nas - (nas - y) / nl; m.nZ[i] = Zr(y); m.nR[i] = RR(yy); m.nS[i] = SL(yy); }
  // feature anchors (mm)
  const yAt = (y) => nas - (nas - y) * nl, zAt = (y, z) => zb(y) + (z - zb(y)) * mix(1, np, 0.8);
  m.nAla = [11.6 * nw, yAt(39.6), zAt(39.6, 96.0)];
  m.nNos = [6.0 * mix(1, nw, 0.7), yAt(36.8), zAt(36.8, 103.6)];
  m.nTip = [yAt(45), Zr(yAt(45))];
}
function ntab(t, Y) { let f = (Y - NY0) / NDY; if (f < 0) f = 0; else if (f > NN - 1.001) f = NN - 1.001; const i = f | 0, u = f - i; return t[i] + (t[i + 1] - t[i]) * u; }
function ntabD(t, Y) { let f = (Y - NY0) / NDY; if (f < 0) f = 0; else if (f > NN - 1.001) f = NN - 1.001; const i = f | 0; return (t[i + 1] - t[i]) / NDY; }
export function noseFrame(m) {
  return { tipY: m.nTip[0] / 1000, tipZ: m.nTip[1] / 1000, baseY: (m.nNos[1] - 3.6) / 1000, alaX: m.nAla[0] / 1000 };
}
function nose(m, d, x, y, z) {
  const X = abs(x - m.noseDev * smoothstep(0.1, 0.05, y)) * 1000, Y = y * 1000, Z = z * 1000;
  // dorsum / lobule heightfield
  const zr = ntab(m.nZ, Y), rr = ntab(m.nR, Y), sl = ntab(m.nS, Y);
  const q = sqrt(X * X + rr * rr);
  let zn = zr - sl * (q - rr);
  let gx = -sl * X / q, gy = ntabD(m.nZ, Y) - ntabD(m.nS, Y) * (q - rr) - sl * (rr / q - 1) * ntabD(m.nR, Y);
  // alae: elliptic wing bulges beside the lobule, merged with a smooth max of heights (alar groove)
  const [xa, ya, za] = m.nAla;
  const ey = (Y - ya) / 6.9, ex = (X - xa) / 5.0;
  const e2 = 1 - ex * ex - ey * ey;
  if (e2 > -0.6) {
    const H = 6.4 + 0.6 * m.mal;
    const sq = e2 > 0 ? sqrt(e2) : 0;
    const zal = za - 3 + H * (e2 > 0 ? sq : e2 * 0.6);
    const kq = 1.4;
    const hd = kq - abs(zn - zal);
    if (zal > zn - kq) {
      const ga = e2 > 0 ? -H * ex / (5.0 * sq + 1e-3) : -H * 0.6 * 2 * ex / 5.0, gya = e2 > 0 ? -H * ey / (6.9 * sq + 1e-3) : -H * 0.6 * 2 * ey / 6.9;
      if (hd > 0) { const t = hd / kq, w = zal > zn ? 0.5 + 0.5 * t : 0.5 - 0.5 * t; zn = max(zn, zal) + t * t * kq * 0.25; gx = mix(gx, ga, w); gy = mix(gy, gya, w); }
      else { zn = zal; gx = ga; gy = gya; }
    }
  }
  let dn = (Z - zn) / sqrt(1 + gx * gx + gy * gy);
  // nostrils carved from below, long axis toward the tip
  {
    const [nx0, ny0, nz0] = m.nNos;
    const lx0 = X - nx0, lz0 = Z - nz0, ly = Y - ny0;
    const cr = cos(0.5), sr = sin(0.5);
    const lx = cr * lx0 - sr * lz0, lz = sr * lx0 + cr * lz0;
    const c = cos(0.3), sn = sin(0.3);
    const ry = c * ly - sn * lz, rz = sn * ly + c * lz;
    dn = smax(dn, -ell(lx, ry, rz, 2.2 * mix(1, m.noseW, 0.5), 3.6, 4.6), 0.5);
  }
  const k = mix(1.4, 2.8, smoothstep(44, 52, Y));
  return smin(d, dn / 1000, k / 1000);
}

// ---------------------------------------------------------------------------------------------
export function lipOutline(m, ax) {
  const hw = m.mouthHW;
  const t = clamp(ax / hw, 0, 1.2);
  const ys = m.mouthY + 0.0008 * t * t;
  const tt = min(t, 1);
  const bow = 1 - 0.12 * gauss(tt, 0.09) + 0.05 * gauss(tt - 0.23, 0.1);
  const up = ys + m.lipUH * bow * pow(max(0, 1 - pow(tt, 2.4)), 0.72);
  const lo = ys - m.lipLH * pow(max(0, 1 - pow(tt, 2.1)), 0.6);
  return { ys, up, lo, t };
}

function mouth(m, d, x, ax, y, yf, z) {
  const L = lipOutline(m, ax);
  const hw = m.mouthHW;
  const fz = smoothstep(0.062, 0.085, z);
  let disp = 0;
  if (yf > L.up - 0.002 && yf < 0.034) {
    const v = clamp((yf - L.up) / (0.031 - L.up), 0, 1);
    const colX = mix(0.0054, 0.0036, v);
    const col = gauss(ax - colX, 0.0019) * 0.00055 * (1 - v * 0.5);
    const groove = -gauss(ax, 0.0026) * 0.00035 * (1 - v * 0.3);
    disp += (col + groove) * smoothstep(0.0, 0.18, v);
    disp += 0.0009 * gauss(ax, 0.018) * (1 - v) * (1 - v);
  }
  if (L.t < 1.15) {
    const fall = smoothstep(1.1, 0.8, L.t);
    if (yf >= L.ys) {
      const h = (yf - L.ys) / max(L.up - L.ys, 1e-4);
      let prof;
      if (h <= 1) prof = 0.3 + 0.7 * pow(sin(PI * 0.5 * min(1, (h + 0.05) / 0.72)), 0.7);
      else prof = max(0, 1 - (h - 1) * 2.6);
      const roll = 0.0003 * gauss(h - 1.0, 0.08);
      disp += (m.lipU * prof + roll) * fall * (1 - 0.3 * L.t * L.t);
    } else {
      const h = (L.ys - yf) / max(L.ys - L.lo, 1e-4);
      let prof;
      if (h <= 1) prof = 0.35 + 0.65 * pow(sin(PI * min(1, h * 0.68 + 0.12)), 0.55);
      else prof = max(0, 0.75 - (h - 1) * 2.2);
      disp += m.lipL * prof * fall * (1 - 0.3 * L.t * L.t);
      disp -= 0.0002 * gauss(ax, 0.003) * gauss(h - 0.5, 0.35) * fall;
    }
  }
  {
    const sy = L.lo - 0.0075 - 0.001 * m.chin;
    disp -= 0.0019 * gauss(yf - sy, 0.0048) * gauss(ax / 0.028, 0.8);
  }
  {
    disp -= 0.0010 * gauss(ax - hw - 0.0004, 0.0024) * gauss(yf - L.ys, 0.0038);
    disp += 0.0007 * gauss(ax - hw - 0.0062, 0.0048) * gauss(yf - L.ys, 0.0075);
  }
  {
    const t = clamp((0.03 - yf) / 0.04, 0, 1);
    const fx = mix(0.0185 * m.noseW, hw + 0.0068, pow(t, 0.8)) + 0.0018 * t * t;
    const depth = (0.0006 + 0.0018 * m.old + 0.0006 * m.wrinkles) * smoothstep(0, 0.12, t) * smoothstep(1.05, 0.7, t);
    disp -= depth * gauss(ax - fx, 0.0026 + 0.001 * m.old);
    disp += (0.0008 + 0.0016 * m.old) * smoothstep(0, 0.15, t) * smoothstep(1.0, 0.55, t) * gauss(ax - fx - 0.0065, 0.0055);
  }
  d -= disp * fz;
  if (L.t < 1.05) {
    const gap = 0.00055 + 0.00028 * (1 - L.t);
    const sheet = abs(yf - L.ys) - gap;
    const endC = (L.t - 1) * hw;
    let w = max(sheet, endC);
    w = max(w, 0.066 - z);
    d = smax(d, -w, 0.0007);
  }
  {
    const cav = ell(x, yf - (m.mouthY - 0.001), z - 0.074, hw * 0.9, 0.0052, 0.016);
    d = smax(d, -cav, 0.002);
  }
  return d;
}

// ---------------------------------------------------------------------------------------------
export function earFrame(m, ax, y, z) {
  const S = m.earS;
  const px = ax - m.earX, py = y - m.earY, pz = z - m.earZ;
  const ct = cos(0.26), st = sin(0.26);
  const v1 = ct * py + st * pz, u1 = -st * py + ct * pz;
  const cf = cos(0.30), sf = sin(0.30);
  const w = cf * px - sf * u1, u = sf * px + cf * u1;
  return { u: u / S, v: v1 / S, w: w / S, S };
}

function ear(m, d, ax, y, z) {
  const F = earFrame(m, ax, y, z);
  const u = F.u * 1000, v = F.v * 1000, w = F.w * 1000; // mm
  if (u * u / 900 + v * v / 1600 > 1.7 || w > 16 || w < -18) return d;
  const vv = v + 1.5;
  const au = 15.8 * (vv < -8 ? (1 - 0.3 * pow(min((-8 - vv) / 22, 1), 1.4)) : 1) * (vv > 10 ? (1 - 0.16 * pow((vv - 10) / 22, 2)) : 1);
  const uc = u + 1.0 + (vv < -8 ? 0.12 * (vv + 8) : 0);
  const av = 31.5;
  const e2 = sqrt((uc / au) * (uc / au) + (vv / av) * (vv / av));
  const rho = (1 - e2) * min(au, av) * 1.05;
  const lobe = smoothstep(-12, -20, vv);
  const front = smoothstep(4, 10, uc);
  let hgt;
  {
    const rim = 3.2 * sqrt(max(0, 1 - pow((rho - 2.2) / 2.6, 2)));
    const scapha = 1.2;
    const anti = 3.6 * gauss(rho - 9.5, 2.2);
    const conchaC = sqrt(pow((uc - 3.5) / 7.5, 2) + pow((vv + 5) / 10.5, 2));
    const concha = -9 * smoothstep(1.1, 0.35, conchaC);
    hgt = max(rim, scapha + anti) + concha;
    hgt = mix(hgt, 2.4 + 0.6 * gauss(rho - 4, 3), lobe);
    hgt = mix(hgt, 1.5 + concha * 0.8, front * (1 - lobe));
    hgt += 3.4 * gauss(uc - 10.5, 2.4) * gauss(vv + 6, 3.5);
    hgt += 2.2 * gauss(uc - 2, 2.8) * gauss(vv + 15, 2.6);
    hgt += 2.0 * gauss(vv - 5.5 + 0.25 * (uc - 4), 1.6) * smoothstep(12, 4, uc) * smoothstep(-2, 3, uc);
  }
  const thick = 3.2 + 2.2 * lobe;
  const wf = hgt + 1.5;
  const wb = wf - thick - max(0, -hgt) * 0.2;
  let de = max(-rho, max(w - wf, wb - w));
  const root = ell(uc - 4, vv + 3, w + 8, 9, 15, 11);
  de = smin(de, root, 3.0);
  const dm = de * 0.001 * F.S * 0.75;
  d = smin(d, dm, 0.0016);
  {
    const cv = ell((uc - 7.5) * 0.001, (vv + 6.5) * 0.001, (w + 3) * 0.001, 0.0028, 0.0034, 0.006);
    d = smax(d, -cv * F.S, 0.0012);
  }
  return d;
}
