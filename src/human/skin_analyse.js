// Template analysis for the people's look (src/human/skin.js, docs/CHARACTER_LOOK.md): reads one cast mesh in its
// rest pose (plain typed arrays, no three.js, so it also runs in a worker: src/human/skin_worker.js) and returns the eye
// spheres and lid lines, the face frame and landmarks, and four per-vertex attributes: azFace (oily, red, cavity, thin),
// azFace2 (lips, brow, crow's feet, nail), azHairT (hair strand tangent + root-to-tip; on skin: the brow-lift weight),
// azDet (metres per uv unit, for the tiling detail maps). Hair vertices carry the distance to the shell's edge in
// azFace.x (0-3 cm), used for the frayed strand tips.
// Input D: { n, PA, NA (Float32 n*3), UV (Float32 n*2 | null), MK (azMask, Float32 n*3), SKI (n*4), SKW (Float32 n*4),
//            IDX (Uint32 | null), bones (names), handRest ([xyz | null, xyz | null] wrist rest positions), pix ({ S, data,
//            flipY } the atlas read back at S x S | null) }.
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gauss = (d2, s) => Math.exp(-d2 / (2 * s * s));
function sphereFit(P) {
  const N = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], y = [0, 0, 0, 0];
  for (const p of P) {
    const a = [2 * p[0], 2 * p[1], 2 * p[2], 1], b = p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
    for (let r = 0; r < 4; r++) { y[r] += a[r] * b; for (let c = 0; c < 4; c++) N[r][c] += a[r] * a[c]; }
  }
  for (let k = 0; k < 4; k++) {
    let m = k; for (let r = k + 1; r < 4; r++) if (Math.abs(N[r][k]) > Math.abs(N[m][k])) m = r;
    [N[k], N[m]] = [N[m], N[k]]; [y[k], y[m]] = [y[m], y[k]];
    if (Math.abs(N[k][k]) < 1e-12) return null;
    for (let r = 0; r < 4; r++) if (r !== k) { const f = N[r][k] / N[k][k]; for (let c = k; c < 4; c++) N[r][c] -= f * N[k][c]; y[r] -= f * y[k]; }
  }
  const s = y.map((v, i) => v / N[i][i]), c = s.slice(0, 3);
  return { c, r: Math.sqrt(Math.max(1e-10, s[3] + c[0] * c[0] + c[1] * c[1] + c[2] * c[2])) };
}
const srgb2lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function analyseData(D) {
  const t0 = globalThis.performance ? globalThis.performance.now() : 0;
  const prof = {}; let tp = t0; const PROF = k => { const t = globalThis.performance ? globalThis.performance.now() : 0; prof[k] = Math.round(t - tp); tp = t; };
  const n = D.n, PA = D.PA, NA = D.NA, UV = D.UV, MK = D.MK, SKI = D.SKI, SKW = D.SKW, IDX = D.IDX;
  const bones = D.bones || [];
  const bi = name => bones.indexOf(name);
  const wOf = (i, b) => { if (b < 0 || !SKI) return 0; let w = 0; for (let k = 0; k < 4; k++) if (SKI[i * 4 + k] === b) w += SKW[i * 4 + k]; return w; };
  const uv = UV ? { getX: i => UV[i * 2], getY: i => UV[i * 2 + 1] } : null;
  const HEAD = bi('head'), HL = bi('hand_L'), HR = bi('hand_R');
  const P = i => [PA[i * 3], PA[i * 3 + 1], PA[i * 3 + 2]], Nn = i => [NA[i * 3], NA[i * 3 + 1], NA[i * 3 + 2]];
  const mk = i => [MK[i * 3], MK[i * 3 + 1], MK[i * 3 + 2]];
  const isSkin = new Uint8Array(n), isHair = new Uint8Array(n), isEye = new Uint8Array(n), isLash = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const [r, gl, h] = mk(i);
    if (r > 0.5) isSkin[i] = 1;
    if (h > 0.5 && r < 0.3 && !(Math.abs(h - 0.5) < 0.06 && gl < 0.03)) isHair[i] = 1;
    if (gl > 0.97 && r < 0.03 && h < 0.03 && wOf(i, HEAD) > 0.9) isEye[i] = 1;
    if (Math.abs(h - 0.5) < 0.06 && r < 0.03 && gl < 0.03) isLash[i] = 1;
  }
  const out = { eyes: null, face: null };
  PROF('eyes0');
  // ---- eyes: one sphere per side, the disc's centre and radius in the atlas, the lid lines (e-space, y up)
  const eyeIdx = []; for (let i = 0; i < n; i++) if (isEye[i]) eyeIdx.push(i);
  if (eyeIdx.length >= 16 && uv) {
    const us = eyeIdx.map(i => uv.getX(i)), vs = eyeIdx.map(i => uv.getY(i));
    const cu = (Math.min(...us) + Math.max(...us)) / 2, cv = (Math.min(...vs) + Math.max(...vs)) / 2;
    const R = Math.max(Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs)) / 2;
    const sides = [1, -1].map(s => { const E = eyeIdx.filter(i => Math.sign(PA[i * 3]) === s); return E.length >= 8 ? sphereFit(E.map(P)) : null; });
    if (sides[0] && sides[1] && R > 0.01 && R < 0.1) {
      const eS = (S, p) => { const d = [p[0] - S.c[0], p[1] - S.c[1], p[2] - S.c[2]], L = Math.hypot(...d) || 1; const rr = Math.acos(Math.max(-1, Math.min(1, d[2] / L))) / (Math.PI / 2), al = Math.atan2(d[1], d[0]); return [rr * Math.cos(al), rr * Math.sin(al), L / S.r]; };
      // lid edges: the nearest skin around each eye, binned across the eye
      const up = [], lo = [];
      for (const S of sides) for (let i = 0; i < n; i++) {
        if (!isSkin[i] && !isLash[i]) continue;
        const p = P(i), e = eS(S, p); if (e[2] > 1.35) continue;
        const d = [p[0] - S.c[0], p[1] - S.c[1], p[2] - S.c[2]]; if (d[2] / Math.hypot(...d) < 0.3) continue;
        if (Math.abs(e[0]) > 0.25) continue;
        if (e[1] > 0) up.push(e[1]); else lo.push(e[1]);
      }
      up.sort((a, b) => a - b); lo.sort((a, b) => b - a);
      const U = up.length ? up[Math.min(up.length - 1, 1)] : 0.12, Lo = lo.length ? lo[Math.min(lo.length - 1, 1)] : -0.22;
      out.eyes = { cu, cv, R, cs: R / 0.94, U: Math.max(0.0, Math.min(0.3, U)), Lo: Math.max(-0.4, Math.min(-0.1, Lo)), L: sides[0], Rr: sides[1] };
    }
  }
  PROF('eyes');
  // ---- face frame: eye centres (or the head bone), interocular distance
  let Mc, u;
  if (out.eyes) { const a = out.eyes.L.c, b = out.eyes.Rr.c; Mc = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; u = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  else {
    let s = [0, 0, 0], k = 0, top = -1e9;
    for (let i = 0; i < n; i++) if (wOf(i, HEAD) > 0.8) { const p = P(i); s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; k++; top = Math.max(top, p[1]); }
    Mc = k ? [s[0] / k, top - 0.11, s[2] / k + 0.05] : [0, 1.6, 0.05]; u = 0.064;
  }
  if (!(u > 0.03 && u < 0.09)) u = 0.064;
  out.face = { M: Mc, u };
  const X = p => (p[0] - Mc[0]) / u, Y = p => (p[1] - Mc[1]) / u, Z = p => (p[2] - Mc[2]) / u;
  // nose tip: the most forward head skin on the midline below the eyes
  let nose = [0, -0.75, 0.55], bz = -1e9;
  for (let i = 0; i < n; i++) if (isSkin[i] && wOf(i, HEAD) > 0.5) { const p = P(i), x = X(p), y = Y(p), z = Z(p); if (Math.abs(x) < 0.25 && y < -0.1 && y > -1.3 && z > bz) { bz = z; nose = [x, y, z]; } }
  // lips: redder than the face's own skin in the painted atlas, in the mouth window
  PROF('nose');
  const pix = D.pix ? ((S, d, flipY) => (u, v) => { const x = Math.max(0, Math.min(S - 1, Math.floor(u * S))), y = Math.max(0, Math.min(S - 1, Math.floor((flipY ? 1 - v : v) * S))), i = (y * S + x) * 4; return [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]; })(D.pix.S, D.pix.data, D.pix.flipY) : null;
  const red = i => { const c = pix(uv.getX(i), uv.getY(i)); return (c[0] - c[1]) / (c[0] + c[1] + c[2] + 1e-3); };
  let lipBase = 0;
  const lipCand = [];
  if (pix && uv) {
    const rs = [];
    for (let i = 0; i < n; i++) if (isSkin[i] && wOf(i, HEAD) > 0.5) { const p = P(i), y = Y(p); if (y > -1.0 && y < 0.6) rs.push(red(i)); }
    rs.sort((a, b) => a - b); lipBase = rs.length ? rs[rs.length >> 1] : 0;
  }
  // hair colour (linear) and hands
  let hairCol = [0.05, 0.035, 0.025], hk = 0;
  if (pix && uv) { const s = [0, 0, 0]; for (let i = 0; i < n; i++) if (isHair[i]) { const c = pix(uv.getX(i), uv.getY(i)); s[0] += srgb2lin(c[0]); s[1] += srgb2lin(c[1]); s[2] += srgb2lin(c[2]); hk++; } if (hk) hairCol = s.map(v => v / hk); }
  PROF('lipsHair');
  const hands = [HL, HR].map(b => {
    if (b < 0) return null;
    const vs = []; for (let i = 0; i < n; i++) if (isSkin[i] && wOf(i, b) > 0.6) vs.push(i);
    if (vs.length < 20) return null;
    const r = D.handRest && D.handRest[b === HL ? 0 : 1]; if (!r) return null;
    const hp = { x: r[0], y: r[1], z: r[2] };     // rest position of the wrist joint (mesh space at bind)
    const c = [0, 0, 0]; for (const i of vs) { const p = P(i); c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    c[0] /= vs.length; c[1] /= vs.length; c[2] /= vs.length;
    const dl = Math.hypot(c[0] - hp.x, c[1] - hp.y, c[2] - hp.z) || 1, Dir = { x: (c[0] - hp.x) / dl, y: (c[1] - hp.y) / dl, z: (c[2] - hp.z) / dl };
    let tmax = 0; for (const i of vs) { const p = P(i); tmax = Math.max(tmax, (p[0] - hp.x) * Dir.x + (p[1] - hp.y) * Dir.y + (p[2] - hp.z) * Dir.z); }
    return { hp, D: Dir, tmax };
  });
  PROF('hands');
  // ---- welded adjacency (UV seams split vertices; neighbourhoods and boundaries need the surface)
  const key = new Map(), weld = new Int32Array(n);
  for (let i = 0; i < n; i++) { const k = (Math.round(PA[i * 3] * 4000) + 8192) * 268435456 + (Math.round(PA[i * 3 + 1] * 4000) + 8192) * 16384 + (Math.round(PA[i * 3 + 2] * 4000) + 8192); let w = key.get(k); if (w === undefined) { w = i; key.set(k, i); } weld[i] = w; }
  const nb = Array.from({ length: n }, () => []), edgeCount = new Map(), triN = IDX ? IDX.length / 3 : n / 3;
  const area3 = new Float32Array(n), areaUV = new Float32Array(n);
  for (let t = 0; t < triN; t++) {
    const a = IDX ? IDX[t * 3] : t * 3, b = IDX ? IDX[t * 3 + 1] : t * 3 + 1, c = IDX ? IDX[t * 3 + 2] : t * 3 + 2;
    const wa = weld[a], wb = weld[b], wc = weld[c];
    for (let e = 0; e < 3; e++) {
      const p = e === 0 ? wa : e === 1 ? wb : wc, q = e === 0 ? wb : e === 1 ? wc : wa;
      if (p === q) continue;
      if (!nb[p].includes(q)) nb[p].push(q);
      if (!nb[q].includes(p)) nb[q].push(p);
      const ek = p < q ? p * n + q : q * n + p; edgeCount.set(ek, (edgeCount.get(ek) || 0) + 1);
    }
    const pa = P(a), pb = P(b), pc = P(c);
    const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const A3 = 0.5 * Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]);
    let AU = 0;
    if (uv) AU = 0.5 * Math.abs((uv.getX(b) - uv.getX(a)) * (uv.getY(c) - uv.getY(a)) - (uv.getX(c) - uv.getX(a)) * (uv.getY(b) - uv.getY(a)));
    for (const v of [a, b, c]) { area3[v] += A3; areaUV[v] += AU; }
  }
  PROF('adj');
  // concavity per welded vertex: how far the neighbours' centroid lies in front of the normal (per edge length)
  const conc = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (weld[i] !== i || !nb[i].length) continue;
    const px = PA[i * 3], py = PA[i * 3 + 1], pz = PA[i * 3 + 2]; let cx = 0, cy = 0, cz = 0, el = 0;
    for (const j of nb[i]) { const dx = PA[j * 3] - px, dy = PA[j * 3 + 1] - py, dz = PA[j * 3 + 2] - pz; cx += dx; cy += dy; cz += dz; el += Math.sqrt(dx * dx + dy * dy + dz * dz); }
    const k = nb[i].length;
    conc[i] = (cx * NA[i * 3] + cy * NA[i * 3 + 1] + cz * NA[i * 3 + 2]) / k / Math.max(el / k, 1e-4);
  }
  for (let it = 0; it < 2; it++) { const c2 = conc.slice(); for (let i = 0; i < n; i++) if (weld[i] === i && nb[i].length) { let s = conc[i]; for (const j of nb[i]) s += conc[j]; c2[i] = s / (nb[i].length + 1); } conc.set(c2); }
  PROF('conc');
  // contact: skin close to cloth or hair (collars, cuffs, the hairline): spatial hash of the other pieces
  const CELL = 0.01, grid = new Map(), gk = (x, y, z) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024);
  for (let i = 0; i < n; i++) if (!isSkin[i] && !isEye[i] && !isLash[i]) { const p = P(i), k = gk(Math.floor(p[0] / CELL), Math.floor(p[1] / CELL), Math.floor(p[2] / CELL)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); }
  const contact = i => {
    const p = P(i), q = Nn(i), cx = Math.floor(p[0] / CELL), cy = Math.floor(p[1] / CELL), cz = Math.floor(p[2] / CELL); let best = 1;
    for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const a = grid.get(gk(cx + dx, cy + dy, cz + dz)); if (!a) continue;
      for (const j of a) { const dx = PA[j * 3] - p[0], dy = PA[j * 3 + 1] - p[1], dz = PA[j * 3 + 2] - p[2], L2 = dx * dx + dy * dy + dz * dz; if (L2 > 0.000625) continue; const L = Math.sqrt(L2); if ((dx * q[0] + dy * q[1] + dz * q[2]) < -0.2 * L) continue; best = Math.min(best, L / 0.025); }
    }
    return 1 - smooth(0.12, 1, best);
  };
  PROF('grid');
  // hair: distance to the shell's open border (tips, fringe), over the welded surface
  // (welded groups: the shell's edge comes down onto the skin, and the cast's quantised positions can weld an edge
  // vertex to the skin vertex under it, so a group is hair if any member is, and touches the skin if any member is not)
  const hairW = new Uint8Array(n), otherW = new Uint8Array(n);
  for (let i = 0; i < n; i++) { if (isHair[i]) hairW[weld[i]] = 1; else otherW[weld[i]] = 1; }
  const hairDist = new Float32Array(n).fill(1e9), queue = [];
  let borderN = 0;
  for (let i = 0; i < n; i++) if (hairW[i] && weld[i] === i) {
    let border = !!otherW[i];
    if (!border) for (const j of nb[i]) { const ek = i < j ? i * n + j : j * n + i; if (edgeCount.get(ek) === 1 || !hairW[j]) { border = true; break; } }
    if (border) { hairDist[i] = 0; queue.push(i); borderN++; }
  }
  for (let it = 0; it < 60 && queue.length; it++) {      // a few relaxation sweeps (Bellman-Ford on the hair graph)
    const next = [];
    for (const i of queue) { const p = P(i); for (const j of nb[i]) { if (!hairW[j]) continue; const pj = P(j), d = hairDist[i] + Math.hypot(pj[0] - p[0], pj[1] - p[1], pj[2] - p[2]); if (d < hairDist[j] - 1e-5) { hairDist[j] = d; next.push(j); } } }
    queue.length = 0; for (const j of new Set(next)) queue.push(j);
  }
  // smoothed copy: every vertex of a sawtooth tooth lies on the border (0); a few neighbour averages give the tooth
  // a depth (its tip smallest), so the frayed-tip test in the shader turns each tooth into a tapering tuft
  const hd = new Float32Array(n);
  for (let i = 0; i < n; i++) hd[i] = Math.min(0.03, hairDist[weld[i]]);
  for (let it = 0; it < 3; it++) {
    const h2 = hd.slice();
    for (let i = 0; i < n; i++) if (hairW[i] && weld[i] === i) { let s = hd[i] * 2, c = 2; for (const j of nb[i]) if (hairW[j]) { s += hd[j]; c++; } h2[i] = s / c; }
    hd.set(h2);
  }
  const crown = [Mc[0], Mc[1] + 2.3 * u, Mc[2] - 1.5 * u];   // above the back of the crown, outside the head
  PROF('hairD');
  // ---- attributes
  const F1 = new Uint8Array(n * 4), F2 = new Uint8Array(n * 4), HT = new Int8Array(n * 4), DET = new Float32Array(n);
  const q8 = v => Math.round(Math.max(0, Math.min(1, v)) * 255), s8 = v => Math.round(Math.max(-1, Math.min(1, v)) * 127);
  for (let i = 0; i < n; i++) {
    const w = weld[i], p = P(i), x = X(p), y = Y(p), z = Z(p), ax = Math.abs(x);
    DET[i] = areaUV[i] > 1e-12 ? Math.sqrt(area3[i] / areaUV[i]) : 1;
    const cav = smooth(0.06, 0.4, conc[w]);
    if (isSkin[i]) {
      const head = wOf(i, HEAD) + wOf(i, bi('neck')) * 0.3;
      let oily = 0, redn = 0, cv = cav * 0.8, thin = 0, lips = 0, brow = 0, crow = 0, nail = 0;
      if (head > 0.3) {
        const fore = smooth(0.25, 0.6, y) * (1 - smooth(1.5, 1.9, y)) * (1 - smooth(0.7, 1.0, ax)) * smooth(-0.9, -0.4, z);
        const dn2 = (x - nose[0]) ** 2 + ((y - nose[1]) * 0.6) ** 2 + ((z - nose[2]) * 0.8) ** 2;
        const noseW = gauss(dn2, 0.32) * (1 - smooth(0.0, 0.25, y + 0.05 - 0.3));
        const chin = gauss(x * x + ((y + 2.0) * 0.8) ** 2, 0.38) * smooth(-0.5, 0.2, z);
        oily = Math.max(fore * 0.55, noseW * 0.95, chin * 0.45);
        const cheek = gauss((ax - 0.85) ** 2 + (y + 0.62) ** 2 + ((z + 0.15) * 0.5) ** 2, 0.38);
        const tip = gauss((x - nose[0]) ** 2 + (y - nose[1]) ** 2 + (z - nose[2]) ** 2, 0.2);
        // ears: lateral, behind the eyes, between brow and jaw height
        const ear = smooth(1.02, 1.18, ax) * smooth(-1.25, -0.85, y) * (1 - smooth(0.2, 0.55, y)) * (1 - smooth(-0.55, -0.25, z));
        const alae = gauss((ax - 0.27) ** 2 + (y - nose[1] - 0.05) ** 2 + ((z - nose[2] + 0.22) * 0.8) ** 2, 0.11);
        // eye sockets: darker, cooler around and above the eyes (not on the lids' edge)
        const sock = out.eyes ? gauss((ax - 0.5) ** 2 + ((y + 0.02) * 1.3) ** 2, 0.33) * smooth(-0.2, 0.25, z) : 0;
        const lidW = out.eyes ? gauss((ax - 0.5) ** 2 + ((y - 0.1) * 2.2) ** 2, 0.22) * smooth(0.0, 0.25, z) : 0;
        redn = Math.max(cheek * 0.55, tip * 0.65, ear * 0.55, lidW * 0.25);
        thin = Math.max(ear, alae * 0.8, lidW * 0.35);
        cv = Math.max(cv, sock * 0.3, smooth(0.6, 1.0, conc[w] * 1.5) * 0.4);
        brow = smooth(0.2, 0.45, y) * (1 - smooth(1.4, 1.75, y)) * (1 - smooth(0.85, 1.1, ax)) * smooth(-0.8, -0.3, z);
        crow = gauss((ax - 1.0) ** 2 + ((y + 0.05) * 1.2) ** 2, 0.2) * smooth(-0.9, -0.3, z);
        if (pix && y < -0.9 && y > -2.0 && ax < 0.85 && z > -0.2) {
          const r = red(i); lips = smooth(lipBase + 0.012, lipBase + 0.05, r) * (1 - smooth(0.55, 0.85, ax));
          if (lips > 0.3) lipCand.push(i);
        }
        cv = Math.max(cv, contact(i) * 0.75);
      } else {
        cv = Math.max(cv, contact(i) * 0.6);
        for (const H of hands) {
          if (!H) continue;
          if (wOf(i, H === hands[0] ? HL : HR) < 0.5) continue;
          const t = ((p[0] - H.hp.x) * H.D.x + (p[1] - H.hp.y) * H.D.y + (p[2] - H.hp.z) * H.D.z) / H.tmax;
          const q = Nn(i), dors = q[1] * 0.85 + Math.abs(q[2]) * 0.0;
          nail = smooth(0.8, 0.9, t) * smooth(0.25, 0.6, dors);
          const knuck = gauss((t - 0.42) ** 2, 0.06) * smooth(0.0, 0.5, dors) + gauss((t - 0.66) ** 2, 0.05) * 0.6;
          redn = Math.max(redn, knuck * 0.45, smooth(0.85, 1.0, t) * 0.35);
          cv = Math.max(cv, knuck * 0.25);
        }
      }
      F1.set([q8(oily), q8(redn), q8(cv), q8(thin)], i * 4);
      if (head > 0.3) HT[i * 4 + 3] = s8(smooth(0.12, 0.3, y) * (1 - smooth(0.75, 1.45, y)) * (1 - smooth(0.8, 1.05, ax)) * smooth(-0.6, -0.2, z));
      F2.set([q8(lips), q8(brow), q8(crow), q8(nail)], i * 4);
    } else {
      F1.set([isHair[i] ? q8(hd[w] / 0.03) : 0, 0, isHair[i] ? 0 : q8(cav * 0.9), 0], i * 4);
    }
    if (isHair[i]) {
      const q = Nn(i), d = [p[0] - crown[0], p[1] - crown[1], p[2] - crown[2]], dn = d[0] * q[0] + d[1] * q[1] + d[2] * q[2];
      let tg = [d[0] - q[0] * dn, d[1] - q[1] * dn, d[2] - q[2] * dn]; let L = Math.hypot(...tg);
      if (L < 1e-5) { tg = [-q[0] * q[1], 1 - q[1] * q[1], -q[2] * q[1]].map(v => -v); L = Math.hypot(...tg) || 1; }
      const cd = Math.hypot(...d) / u;
      // root to tip by the distance from the crown only (overlapping shell layers then shade alike: no seams)
      const tip = smooth(1.4, 5.0, cd) * 0.85 + 0.15 * smooth(0.8, 2.6, cd);
      HT.set([s8(tg[0] / L), s8(tg[1] / L), s8(tg[2] / L), s8(tip)], i * 4);
    }
  }
  // the mouth line: lip vertices define the mouth centre (micro-expressions, mouth-corner shading)
  if (lipCand.length) { const c = [0, 0, 0]; for (const i of lipCand) { const p = P(i); c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; } out.face.mouth = c.map(v => v / lipCand.length); }
  out.face.nose = nose; out.face.hair = hairCol; out.face.lipBase = lipBase; out.face.lips = lipCand.length; out.face.hairBorder = borderN;
  out.attrs = { azFace: F1, azFace2: F2, azHairT: HT, azDet: DET };
  PROF('attrs');
  out.ms = (globalThis.performance ? globalThis.performance.now() : 0) - t0;
  out.prof = prof;
  return out;
}

