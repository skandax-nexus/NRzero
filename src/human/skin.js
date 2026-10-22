// The people's look at run time (docs/CHARACTER_LOOK.md, "Plan"): physically based skin, eyes, hair and cloth shading
// for the cast's one-atlas people, plus facial life (blinks, saccades, gaze, lids that follow the gaze).
//
// Everything here works on the shipped cast (assets/models/cast.glb) without a rebuild:
// - per template, once: the atlas mesh is analysed in its rest pose (eye spheres and lids from the eye / lash pieces,
//   face landmarks, ears, lips from the painted atlas, hands, hair shell, concavity, contact with cloth and hair) and the
//   result is stored as four small vertex attributes (`azFace`, `azFace2`, `azHairT`, `azDet`) shared by every clone;
// - per person: the atlas material is cloned (same shader program for everyone) with its own uniforms for the eyes;
//   mesh.onBeforeRender places the eyes once a frame from the head bone, h.update(dt) advances blinks and saccades.
// The eyes are the MakeHuman cornea shells, textured with a painted disc: the iris moves by shifting the disc lookup
// (the shell is a sphere, so the shift reads as a rotation), the lids close by painting lid skin over the shell above a
// lid line, and the painted catch-light is replaced by the scene's real reflections on a wet cornea.
//
// Tiers (the engine's quality, read from realism.getQuality() when a program compiles; a tier switch recompiles):
// high: everything (pore / weave detail maps, wrinkle relief, iris parallax); medium: pore detail on skin and wrinkle
// relief; low: no detail maps or relief (region shading, eyes, hair and the facial life only cost a few ALU).
// Run-time switches (A/B): ?look=classic (the old shader, nothing here runs), or any of
// ?look=nolight,nopores,noeyes,noface,nohair,nocloth,noskin; ?look=dbg:<channel> paints one analysis channel
// (oily, red, cav, thin, lips, brow, crow, nail, tip, det); ?looktier=high|medium|low forces a tier.
import * as THREE from 'three';
import { getQuality } from '../world/realism.js';

const Q = new globalThis.URLSearchParams(globalThis.location ? globalThis.location.search : '');
const LOOKQ = (Q.get('look') || '').split(',').filter(Boolean);
export const look = {
  classic: LOOKQ.includes('classic'),
  off: new Set(LOOKQ.filter(s => s.startsWith('no')).map(s => s.slice(2))),
  dbg: (LOOKQ.find(s => s.startsWith('dbg:')) || '').slice(4),
  tier: Q.get('looktier') || null,
  stats: { templates: 0, prepMs: 0, persons: 0 },
};
const on = k => !look.off.has(k);
const tierName = () => look.tier || (() => { try { return getQuality(); } catch { return 'medium'; } })();
const TIER = { low: 0, medium: 1, high: 2 };

// ages and sexes of the builds (assets/models/cast_index.json); a person whose entry has not arrived yet starts at 30
const AGES = {};
try {
  globalThis.fetch?.(new globalThis.URL('../../assets/models/cast_index.json', import.meta.url).href).then(r => (r.ok ? r.json() : null))
    .then(j => { for (const c of (j && j.characters) || []) AGES[c.id] = { age: c.age, sex: c.sex }; for (const f of ageWait) f(); ageWait.length = 0; })
    .catch(() => {});
} catch { /* no fetch (node) */ }
const ageWait = [];

// ------------------------------------------------------------------------------------------------------------------
// detail maps (our own, generated once): skin pores + fine creases, and a fabric weave. RG = normal xy, B = cavity.
// ------------------------------------------------------------------------------------------------------------------
let detailMaps = null;
function hash2(x, y, s) { let h = Math.imul(x * 374761393 + y * 668265263 + s * 2147483647, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function heightToTexture(N, H, cav, strength) {
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, xl = (x + N - 1) % N, xr = (x + 1) % N, yu = (y + N - 1) % N, yd = (y + 1) % N;
    const dx = (H[y * N + xr] - H[y * N + xl]) * strength, dy = (H[yd * N + x] - H[yu * N + x]) * strength;
    const l = Math.hypot(dx, dy, 1);
    data[i * 4] = Math.round((-dx / l * 0.5 + 0.5) * 255); data[i * 4 + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255);
    data[i * 4 + 2] = Math.round(Math.max(0, Math.min(1, cav[i])) * 255); data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}
function makeDetailMaps() {
  const N = 256;
  // skin: a 3 cm tile. Pores (jittered grid, ~0.35 mm dimples, slightly exaggerated so they register in close-ups), a
  // net of fine shallow creases (two crossing families, warped), soft bumps. Cavity: pores and creases dark.
  const H = new Float32Array(N * N), C = new Float32Array(N * N).fill(1);
  const cell = 7, G = N / cell | 0;
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
    for (let k = 0; k < 2; k++) {
      const px = (gx + hash2(gx, gy, 1 + k)) * N / G, py = (gy + hash2(gx, gy, 3 + k)) * N / G;
      const r = 1.1 + 1.4 * hash2(gx, gy, 5 + k), d = 0.5 + 0.5 * hash2(gx, gy, 7 + k);
      for (let oy = -4; oy <= 4; oy++) for (let ox = -4; ox <= 4; ox++) {
        const x = Math.floor(px) + ox, y = Math.floor(py) + oy, ddx = x + 0.5 - px, ddy = y + 0.5 - py;
        const g = Math.exp(-(ddx * ddx + ddy * ddy) / (2 * r * r)) * d;
        const i = ((y + N) % N) * N + ((x + N) % N);
        H[i] -= g; C[i] = Math.min(C[i], 1 - 0.55 * g);
      }
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N * Math.PI * 2, v = y / N * Math.PI * 2;
    const w1 = Math.sin(u * 3 + Math.sin(v * 2) * 1.3) * 1.6, w2 = Math.sin(v * 4 + Math.sin(u * 3) * 1.1) * 1.4;
    const l1 = Math.pow(Math.abs(Math.sin((u + v) * 9 + w1)), 14), l2 = Math.pow(Math.abs(Math.sin((u - v) * 11 + w2)), 14);
    const soft = 0.25 * Math.sin(u * 5 + Math.sin(v * 7)) * Math.sin(v * 6 + Math.sin(u * 4));
    const i = y * N + x;
    H[i] += -0.55 * (l1 + l2) + soft * 0.4;
    C[i] = Math.min(C[i], 1 - 0.3 * (l1 + l2));
  }
  const pores = heightToTexture(N, H, C, 0.55);
  // weave: a 2 cm tile, plain weave of 24 threads, each thread rounded, over / under alternating, slub noise
  const W = new Float32Array(N * N), WC = new Float32Array(N * N), T = 24, P = N / T;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const tx = Math.floor(x / P), ty = Math.floor(y / P), fx = (x % P) / P, fy = (y % P) / P;
    const warpUp = ((tx + ty) & 1) === 0;
    const slub = 0.85 + 0.3 * hash2(tx, 0, 11) * hash2(Math.floor(y / (P * 3)), tx, 12);
    const warp = Math.sin(fx * Math.PI) * (warpUp ? 1 : 0.55) * slub, weft = Math.sin(fy * Math.PI) * (warpUp ? 0.55 : 1) * (0.85 + 0.3 * hash2(ty, 1, 13));
    const i = y * N + x;
    W[i] = Math.max(warp, weft) + 0.05 * hash2(x, y, 14);
    WC[i] = 0.55 + 0.45 * Math.max(warp, weft);
  }
  const weave = heightToTexture(N, W, WC, 0.9);
  return { pores, weave };
}

// ------------------------------------------------------------------------------------------------------------------
// template analysis (rest pose, mesh space; once per geometry, shared by every clone)
// ------------------------------------------------------------------------------------------------------------------
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
// the atlas, read back small (lips, hair colour); null where the image cannot be drawn
function atlasPixels(tex, S = 256) {
  try {
    const img = tex && tex.image; if (!img || !img.width) return null;
    const cv = globalThis.OffscreenCanvas ? new globalThis.OffscreenCanvas(S, S) : Object.assign(globalThis.document.createElement('canvas'), { width: S, height: S });
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, S, S);
    const d = cx.getImageData(0, 0, S, S).data;
    return (u, v) => { const x = Math.max(0, Math.min(S - 1, Math.floor(u * S))), y = Math.max(0, Math.min(S - 1, Math.floor((tex.flipY ? 1 - v : v) * S))), i = (y * S + x) * 4; return [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]; };
  } catch { return null; }
}
const srgb2lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function analyse(mesh, mat) {
  const t0 = globalThis.performance ? globalThis.performance.now() : 0;
  const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, M = g.attributes.azMask;
  const n = pos.count, idx = g.index, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  const bones = mesh.skeleton ? mesh.skeleton.bones.map(b => b.name.replace(/_\d+$/, '')) : [];
  const bi = name => bones.indexOf(name);
  const wOf = (i, b) => { if (b < 0 || !SI) return 0; let w = 0; for (let k = 0; k < 4; k++) if (SI.getComponent(i, k) === b) w += SW.getComponent(i, k); return w; };
  const HEAD = bi('head'), HL = bi('hand_L'), HR = bi('hand_R');
  const P = i => [pos.getX(i), pos.getY(i), pos.getZ(i)], Nn = i => [nor.getX(i), nor.getY(i), nor.getZ(i)];
  const mk = i => [M.getX(i), M.getY(i), M.getZ(i)];
  const isSkin = new Uint8Array(n), isHair = new Uint8Array(n), isEye = new Uint8Array(n), isLash = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const [r, gl, h] = mk(i);
    if (r > 0.5) isSkin[i] = 1;
    if (h > 0.5 && r < 0.3 && !(Math.abs(h - 0.5) < 0.06 && gl < 0.03)) isHair[i] = 1;
    if (gl > 0.97 && r < 0.03 && h < 0.03 && wOf(i, HEAD) > 0.9) isEye[i] = 1;
    if (Math.abs(h - 0.5) < 0.06 && r < 0.03 && gl < 0.03) isLash[i] = 1;
  }
  const out = { eyes: null, face: null };
  // ---- eyes: one sphere per side, the disc's centre and radius in the atlas, the lid lines (e-space, y up)
  const eyeIdx = []; for (let i = 0; i < n; i++) if (isEye[i]) eyeIdx.push(i);
  if (eyeIdx.length >= 16 && uv) {
    const us = eyeIdx.map(i => uv.getX(i)), vs = eyeIdx.map(i => uv.getY(i));
    const cu = (Math.min(...us) + Math.max(...us)) / 2, cv = (Math.min(...vs) + Math.max(...vs)) / 2;
    const R = Math.max(Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs)) / 2;
    const sides = [1, -1].map(s => { const E = eyeIdx.filter(i => Math.sign(pos.getX(i)) === s); return E.length >= 8 ? sphereFit(E.map(P)) : null; });
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
  const pix = atlasPixels(mat.map);
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
  const hands = [HL, HR].map(b => {
    if (b < 0) return null;
    const vs = []; for (let i = 0; i < n; i++) if (isSkin[i] && wOf(i, b) > 0.6) vs.push(i);
    if (vs.length < 20) return null;
    const bone = mesh.skeleton.bones[b], inv = mesh.skeleton.boneInverses[b];
    const hp = new THREE.Vector3().setFromMatrixPosition(inv.clone().invert());   // rest position of the joint (mesh space at bind)
    hp.applyMatrix4(mesh.bindMatrixInverse);
    const c = [0, 0, 0]; for (const i of vs) { const p = P(i); c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    c[0] /= vs.length; c[1] /= vs.length; c[2] /= vs.length;
    const D = new THREE.Vector3(c[0] - hp.x, c[1] - hp.y, c[2] - hp.z).normalize();
    let tmax = 0; for (const i of vs) { const p = P(i); tmax = Math.max(tmax, (p[0] - hp.x) * D.x + (p[1] - hp.y) * D.y + (p[2] - hp.z) * D.z); }
    void bone;
    return { hp, D, tmax };
  });
  // ---- welded adjacency (UV seams split vertices; neighbourhoods and boundaries need the surface)
  const key = new Map(), weld = new Int32Array(n);
  for (let i = 0; i < n; i++) { const k = Math.round(pos.getX(i) * 4000) + ',' + Math.round(pos.getY(i) * 4000) + ',' + Math.round(pos.getZ(i) * 4000); let w = key.get(k); if (w === undefined) { w = i; key.set(k, i); } weld[i] = w; }
  const nb = Array.from({ length: n }, () => []), edgeCount = new Map(), triN = idx ? idx.count / 3 : n / 3;
  const area3 = new Float32Array(n), areaUV = new Float32Array(n);
  for (let t = 0; t < triN; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3, b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    const wa = weld[a], wb = weld[b], wc = weld[c];
    for (const [p, q] of [[wa, wb], [wb, wc], [wc, wa]]) {
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
  // concavity per welded vertex: how far the neighbours' centroid lies in front of the normal (per edge length)
  const conc = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (weld[i] !== i || !nb[i].length) continue;
    const p = P(i), q = Nn(i), c = [0, 0, 0]; let el = 0;
    for (const j of nb[i]) { const pj = P(j); c[0] += pj[0]; c[1] += pj[1]; c[2] += pj[2]; el += Math.hypot(pj[0] - p[0], pj[1] - p[1], pj[2] - p[2]); }
    const k = nb[i].length; c[0] /= k; c[1] /= k; c[2] /= k; el /= k;
    conc[i] = ((c[0] - p[0]) * q[0] + (c[1] - p[1]) * q[1] + (c[2] - p[2]) * q[2]) / Math.max(el, 1e-4);
  }
  for (let it = 0; it < 2; it++) { const c2 = conc.slice(); for (let i = 0; i < n; i++) if (weld[i] === i && nb[i].length) { let s = conc[i]; for (const j of nb[i]) s += conc[j]; c2[i] = s / (nb[i].length + 1); } conc.set(c2); }
  // contact: skin close to cloth or hair (collars, cuffs, the hairline): spatial hash of the other pieces
  const CELL = 0.01, grid = new Map(), gk = (x, y, z) => x + ',' + y + ',' + z;
  for (let i = 0; i < n; i++) if (!isSkin[i] && !isEye[i] && !isLash[i]) { const p = P(i), k = gk(Math.floor(p[0] / CELL), Math.floor(p[1] / CELL), Math.floor(p[2] / CELL)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); }
  const contact = i => {
    const p = P(i), q = Nn(i), cx = Math.floor(p[0] / CELL), cy = Math.floor(p[1] / CELL), cz = Math.floor(p[2] / CELL); let best = 1;
    for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const a = grid.get(gk(cx + dx, cy + dy, cz + dz)); if (!a) continue;
      for (const j of a) { const pj = P(j), d = [pj[0] - p[0], pj[1] - p[1], pj[2] - p[2]], L = Math.hypot(...d); if (L > 0.025) continue; const facing = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / (L || 1); if (facing < -0.2) continue; best = Math.min(best, L / 0.025); }
    }
    return 1 - smooth(0.12, 1, best);
  };
  // hair: distance to the shell's open border (tips, fringe), over the welded surface
  const hairDist = new Float32Array(n).fill(1e9), queue = [];
  for (let i = 0; i < n; i++) if (isHair[i] && weld[i] === i) {
    let border = false;
    for (const j of nb[i]) { const ek = i < j ? i * n + j : j * n + i; if (edgeCount.get(ek) === 1 || !isHair[j]) { border = true; break; } }
    if (border) { hairDist[i] = 0; queue.push(i); }
  }
  for (let it = 0; it < 60 && queue.length; it++) {      // a few relaxation sweeps (Bellman-Ford on the hair graph)
    const next = [];
    for (const i of queue) { const p = P(i); for (const j of nb[i]) { if (!isHair[j]) continue; const pj = P(j), d = hairDist[i] + Math.hypot(pj[0] - p[0], pj[1] - p[1], pj[2] - p[2]); if (d < hairDist[j] - 1e-5) { hairDist[j] = d; next.push(j); } } }
    queue.length = 0; for (const j of new Set(next)) queue.push(j);
  }
  const crown = [Mc[0], Mc[1] + 1.55 * u, Mc[2] - 0.9 * u];
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
      F1.set([0, 0, isHair[i] ? 0 : q8(cav * 0.9), 0], i * 4);
    }
    if (isHair[i]) {
      const q = Nn(i), d = [p[0] - crown[0], p[1] - crown[1], p[2] - crown[2]], dn = d[0] * q[0] + d[1] * q[1] + d[2] * q[2];
      let tg = [d[0] - q[0] * dn, d[1] - q[1] * dn, d[2] - q[2] * dn]; let L = Math.hypot(...tg);
      if (L < 1e-5) { tg = [-q[0] * q[1], 1 - q[1] * q[1], -q[2] * q[1]].map(v => -v); L = Math.hypot(...tg) || 1; }
      const cd = Math.hypot(...d) / u;
      // root to tip by the distance from the crown only (overlapping shell layers then shade alike: no seams)
      const tip = smooth(1.0, 4.2, cd) * 0.85 + 0.15 * smooth(0.4, 2.0, cd);
      HT.set([s8(tg[0] / L), s8(tg[1] / L), s8(tg[2] / L), s8(tip)], i * 4);
    }
  }
  // the mouth line: lip vertices define the mouth centre (micro-expressions, mouth-corner shading)
  if (lipCand.length) { const c = [0, 0, 0]; for (const i of lipCand) { const p = P(i); c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; } out.face.mouth = c.map(v => v / lipCand.length); }
  out.face.nose = nose; out.face.hair = hairCol; out.face.lipBase = lipBase; out.face.lips = lipCand.length;
  out.attrs = {
    azFace: new THREE.BufferAttribute(F1, 4, true), azFace2: new THREE.BufferAttribute(F2, 4, true),
    azHairT: new THREE.BufferAttribute(HT, 4, true), azDet: new THREE.BufferAttribute(DET, 1),
  };
  out.ms = (globalThis.performance ? globalThis.performance.now() : 0) - t0;
  look.stats.templates++; look.stats.prepMs += out.ms;
  return out;
}

// ------------------------------------------------------------------------------------------------------------------
// shader
// ------------------------------------------------------------------------------------------------------------------
const DBG = { oily: 'vAzFace.x', red: 'vAzFace.y', cav: 'vAzFace.z', thin: 'vAzFace.w', lips: 'vAzFace2.x', brow: 'vAzFace2.y', crow: 'vAzFace2.z', nail: 'vAzFace2.w', tip: 'vAzHairT.w', det: 'fract( vAzDet )', tan: 'normalize( vAzHairT.xyz ) * 0.5 + 0.5', face: 'gl_FrontFacing ? vec3( 1.0, 0.2, 0.2 ) : vec3( 0.2, 0.2, 1.0 )', mask: 'vAzMask', nrm: 'normal * 0.5 + 0.5' };
function lightsChunk() {
  let s = THREE.ShaderChunk.lights_physical_pars_fragment;
  const a = 'vec3 irradiance = dotNL * directLight.color;';
  const b = 'reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );';
  const c = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
  if (!s.includes(a) || !s.includes(b) || !s.includes(c)) return s;
  s = s.replace(a, `${a}
    float azNL = dot( geometryNormal, directLight.direction );
    float azW = azSkin * AZ_WRAP + azHair * 0.2 + azCloth * 0.08;
    vec3 azIrr = ( vec3( dotNL ) + ( saturate( ( azNL + azW ) / ( 1.0 + azW ) ) - dotNL ) * mix( vec3( 1.0 ), vec3( 1.0, 0.42, 0.3 ), azSkin ) ) * directLight.color;
    // thin skin (ears, nostril wings, lids) lets red light through from behind
    if ( azThin > 0.01 ) {
      float azBack = pow( saturate( dot( geometryViewDir, - directLight.direction ) ), 3.0 ) * 0.7 + saturate( - azNL ) * 0.25;
      azIrr += azThin * azBack * vec3( 1.0, 0.28, 0.16 ) * directLight.color;
    }`);
  s = s.replace(b, `{ vec3 azSp = irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
    if ( azHair > 0.01 ) azSp = mix( azSp, azHairSpec( directLight.direction, geometryViewDir, geometryNormal ) * directLight.color * saturate( azNL * 0.6 + 0.4 ), azHair * AZ_HAIRK );
    if ( azCloth > 0.01 ) azSp += azCloth * material.diffuseColor * directLight.color * ( pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), 4.0 ) * saturate( azNL + 0.35 ) * 0.5 );
    reflectedLight.directSpecular += azSp; }`);
  s = s.replace(c, 'reflectedLight.directDiffuse += azIrr * BRDF_Lambert( material.diffuseColor );');
  // Kajiya-Kay strands: a white primary lobe shifted toward the root, a tinted secondary lobe toward the tip, broken
  // up along the strands by the painted strand stripes
  return `vec3 azHairSpec( vec3 L, vec3 V, vec3 N ) {
    vec3 H = normalize( L + V );
    vec3 T1 = normalize( azTv + N * ( azShift - 0.1 ) ), T2 = normalize( azTv + N * ( azShift + 0.14 ) );
    float d1 = dot( T1, H ), d2 = dot( T2, H );
    float s1 = pow( sqrt( max( 0.0, 1.0 - d1 * d1 ) ), 110.0 ), s2 = pow( sqrt( max( 0.0, 1.0 - d2 * d2 ) ), 28.0 );
    return vec3( s1 * 0.12 * azSparkle ) + azHairTint * s2 * 0.25 * ( 0.5 + 0.5 * azSparkle );
  }
` + s;
}

function patch(sh, U, tier, dbg) {
  const T = tier;
  Object.assign(sh.uniforms, U);
  sh.defines = sh.defines || {};
  sh.defines.AZ_TIER = T;
  sh.defines.AZ_WRAP = on('light') ? '0.3' : '0.5';
  sh.defines.AZ_HAIRK = on('hair') ? '0.88' : '0.0';
  if (on('eyes') && U.azEyeC.value.z > 0) sh.defines.AZ_EYES = 1;
  if (on('skin')) sh.defines.AZ_SKIN = 1;
  if (on('pores') && T > 0) sh.defines.AZ_PORES = 1;
  if (on('cloth') && T > 1) sh.defines.AZ_WEAVE = 1;
  if (on('light')) sh.defines.AZ_LIGHT = 1;
  sh.vertexShader = `attribute vec3 azMask; attribute vec4 azFace; attribute vec4 azFace2; attribute vec4 azHairT; attribute float azDet;
varying vec3 vAzMask; varying vec4 vAzFace; varying vec4 vAzFace2; varying vec4 vAzHairT; varying vec3 vAzRest; varying float vAzDet;
uniform vec4 azExpr;
` + sh.vertexShader
    .replace('#include <begin_vertex>', `#include <begin_vertex>
	vAzMask = azMask; vAzFace = azFace; vAzFace2 = azFace2; vAzDet = azDet; vAzRest = position;
	// micro-expressions on the rest mesh: the brows lift (azExpr.x; skin vertices carry the lift weight in azHairT.w)
	transformed.y += step( 0.5, azMask.r ) * azHairT.w * azExpr.x * 0.0028;`)
    .replace('#include <skinnormal_vertex>', `#include <skinnormal_vertex>
	{ vec3 azTo = azHairT.xyz;
	#ifdef USE_SKINNING
	  azTo = ( skinMatrix * vec4( azTo, 0.0 ) ).xyz;
	#endif
	  vAzHairT = vec4( normalMatrix * azTo, azHairT.w ); }`);
  let F = `varying vec3 vAzMask; varying vec4 vAzFace; varying vec4 vAzFace2; varying vec4 vAzHairT; varying vec3 vAzRest; varying float vAzDet;
uniform vec4 azEye; uniform vec4 azEyeC; uniform vec4 azLid; uniform vec4 azLook; uniform vec3 azHairTint; uniform vec3 azEyeX; uniform vec3 azEyeY; uniform vec3 azEyeZ;
uniform vec4 azEyeL; uniform vec4 azEyeR; uniform vec4 azCrown;
#ifdef AZ_PORES
uniform sampler2D azPoreMap;
#endif
#ifdef AZ_WEAVE
uniform sampler2D azWeaveMap;
#endif
float azSkin = 0.0; float azGloss = 0.0; float azHair = 0.0; float azCloth = 0.0; float azThin = 0.0; float azCav = 0.0;
float azEyeK = 0.0; float azLidK = 0.0; float azTear = 0.0; float azShift = 0.0; float azSparkle = 1.0; float azMicro = 1.0; vec3 azTv = vec3( 0.0, 1.0, 0.0 );
` + sh.fragmentShader;
  F = F.replace('void main() {', `void main() {
	azSkin = vAzMask.r; azGloss = vAzMask.g; azHair = vAzMask.b;
	azCloth = saturate( 1.0 - azSkin - azHair ) * ( 1.0 - smoothstep( 0.12, 0.5, azGloss ) );
	azThin = vAzFace.w * azSkin; azCav = vAzFace.z;
	azTv = normalize( vAzHairT.xyz + vec3( 0.0, 1e-4, 0.0 ) );`);
  // ---- albedo: eyes (gaze, lids, catch-light), skin regions, hair root to tip
  F = F.replace('#include <map_fragment>', `
#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
#ifdef AZ_EYES
	vec2 azE = ( vMapUv - azEyeC.xy ) / azEyeC.z; azE.y = - azE.y;
	if ( azGloss > 0.9 && azSkin < 0.1 && azHair < 0.1 && dot( azE, azE ) < 1.3 ) {
		azEyeK = 1.0;
		vec2 azS = azE - azEye.xy;
	#if AZ_TIER > 1
		// iris depth: the iris sits behind the cornea, so it shifts against the view direction
		{ vec3 azVw = normalize( ( vec4( normalize( vViewPosition ), 0.0 ) * viewMatrix ).xyz );
		  float azIr = smoothstep( 0.42, 0.3, length( azS ) );
		  azS -= azIr * 0.07 * vec2( dot( azVw, azEyeX ), dot( azVw, azEyeY ) ) / max( 0.4, dot( azVw, azEyeZ ) ); }
	#endif
		float azSl = length( azS ); if ( azSl > 0.97 ) azS *= 0.97 / azSl;
		sampledDiffuseColor = texture2D( map, azEyeC.xy + vec2( azS.x, - azS.y ) * azEyeC.z );
		// the painted catch-light (fixed in the texture) gives way to the iris on the other side of the disc
		vec2 azDc = azS - vec2( -0.17, 0.17 ); float azWc = exp( - dot( azDc, azDc ) / 0.006 );
		if ( azWc > 0.02 ) sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, texture2D( map, azEyeC.xy + vec2( - azS.x, azS.y ) * azEyeC.z ).rgb, min( 1.0, azWc * 1.5 ) );
		// upper lid line (closes with azEye.z, drops when looking down), lid shadow, lash line, tear meniscus
		float azLy = mix( azLid.x + 0.07, azLid.y - 0.03, azEye.z ) - azEye.w - 0.4 * azE.x * azE.x * ( 1.0 - azEye.z );
		azLidK = smoothstep( -0.012, 0.012, azE.y - azLy );
		float azShade = 1.0 - 0.55 * ( 1.0 - smoothstep( 0.0, 0.17, azLy - azE.y ) );
		azShade *= 1.0 - 0.3 * smoothstep( 0.35, 0.75, abs( azE.x ) );
		sampledDiffuseColor.rgb *= azShade;
		azTear = smoothstep( 0.05, 0.0, abs( azE.y - azLid.y - 0.02 ) ) * ( 1.0 - azLidK );
		vec3 azLidC = texture2D( map, azEyeC.xy + vec2( 2.5, 0.5 ) * azEyeC.w ).rgb * vec3( 0.86, 0.76, 0.74 );
		vec3 azLash = texture2D( map, azEyeC.xy + vec2( 1.5, 0.5 ) * azEyeC.w ).rgb;
		azLidC = mix( azLidC, azLash, smoothstep( 0.05, 0.0, azE.y - azLy ) * 0.85 );
		sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, azLidC, azLidK );
		azSkin = max( azSkin, azLidK ); azGloss *= 1.0 - azLidK; azCav = max( azCav, 0.25 * ( 1.0 - azLidK ) );
	}
#endif
	diffuseColor *= sampledDiffuseColor;
#endif`);
  F = F.replace('#include <color_fragment>', `#include <color_fragment>
#ifdef AZ_SKIN
	if ( azSkin > 0.01 && azEyeK < 0.5 ) {
		vec3 azC = diffuseColor.rgb;
		// blood under the skin: cheeks, nose, ears, knuckles redder; eye sockets darker and cooler; lips; nails paler
		azC *= mix( vec3( 1.0 ), vec3( 1.07, 0.9, 0.88 ), vAzFace.y * azSkin );
		azC *= mix( vec3( 1.0 ), vec3( 0.86, 0.85, 0.9 ), vAzFace.z * azSkin * 0.8 );
		azC = mix( azC, azC * vec3( 1.04, 0.92, 0.92 ), vAzFace2.x * azSkin * 0.5 );
		azC = mix( azC, azC * vec3( 1.05, 1.0, 1.0 ) + vec3( 0.035, 0.025, 0.025 ), vAzFace2.w * azSkin );
		// complexion: blotches and, with age, spots (rest-space noise, so they stay on the body)
		{ vec3 azP = vAzRest * 70.0; float azN = sin( azP.x * 1.7 + sin( azP.y * 2.3 ) ) * sin( azP.y * 1.9 + sin( azP.z * 2.9 ) ) * sin( azP.z * 2.1 + sin( azP.x * 3.1 ) );
		  azC *= 1.0 + azSkin * ( 0.03 * azN - azLook.x * 0.09 * smoothstep( 0.55, 0.9, azN ) );
		  azC = mix( azC, azC * vec3( 1.04, 0.95, 0.94 ), azSkin * 0.25 * smoothstep( -0.2, 0.6, azN ) ); }
		diffuseColor.rgb = azC;
	}
#endif
	if ( azHair > 0.01 ) {
		// root to tip: darker roots, lighter sun-touched tips; strand-to-strand variation drives the highlight shift
		float azL = dot( diffuseColor.rgb, vec3( 0.3, 0.55, 0.15 ) ), azB = dot( azHairTint, vec3( 0.3, 0.55, 0.15 ) ) + 1e-3;
		float azV = clamp( azL / azB - 1.0, -1.0, 1.0 );
		// strands: a fine streak pattern across the strand direction (angle around the crown, rest space), faded out
		// where a strand gets thinner than a pixel; it shifts and breaks up the highlight and the colour
		vec3 azRc = vAzRest - azCrown.xyz;
		float azTh = atan( azRc.x, azRc.z ), azAl = length( azRc ) * 30.0;
		float azN = sin( azTh * 400.0 + 1.7 * sin( azAl * 7.0 ) ) * 0.5 + sin( azTh * 923.0 + 0.8 * sin( azAl * 11.0 ) ) * 0.3 + sin( azTh * 228.0 + azAl * 3.0 ) * 0.2;
		float azSk = 1.0 - smoothstep( 1.0, 3.0, fwidth( azTh * 400.0 ) );
		azN *= azSk;
		azShift = azV * 0.08 + azN * 0.12; azSparkle = 0.45 + 0.9 * smoothstep( -0.6, 0.8, azN + azV * 0.5 );
		diffuseColor.rgb *= 1.0 + 0.16 * azN * azHair;
		diffuseColor.rgb *= mix( 1.0, mix( 0.74, 1.14, vAzHairT.w ), azHair );
	}`);
  // ---- roughness by region (skin, lips, nails, hair, cornea, tear line)
  F = F.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
	{ float azRs = mix( 0.56, 0.38, vAzFace.x );
	  azRs = mix( azRs, 0.3, vAzFace2.x ); azRs = mix( azRs, 0.28, vAzFace2.w ); azRs += azLook.x * 0.06;
	#ifndef AZ_SKIN
	  azRs = 0.5;
	#endif
	  float azRg = azEyeK > 0.5 ? mix( 0.035, 0.02, azTear ) : 0.07;
	  roughnessFactor = mix( mix( mix( roughnessFactor, azRs, azSkin ), 0.44, azHair ), azRg, azGloss ); }`);
  // ---- normals: pore / weave detail (tier-gated), wrinkle relief with age
  F = F.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#if AZ_TIER > 0
	{ float azDist = length( vViewPosition );
	  float azFade = 1.0 - smoothstep( 1.0, 3.2, azDist );
	  vec3 azQ0 = dFdx( - vViewPosition ), azQ1 = dFdy( - vViewPosition );
	#ifdef AZ_SKIN
	  if ( azFade > 0.0 && azSkin > 0.5 && azEyeK < 0.5 && azLook.x > 0.02 ) {
		// forehead lines and crow's feet (rest space, so they move with the skin), deeper with age
		vec3 azP = vAzRest;
		float azH = - pow( 0.5 + 0.5 * sin( azP.y * 680.0 + 2.0 * sin( azP.x * 55.0 ) ), 6.0 ) * vAzFace2.y * smoothstep( 0.2, 0.9, vAzFace2.y );
		vec3 azEc = azP.x > azEyeL.x * 0.5 + azEyeR.x * 0.5 ? azEyeL.xyz : azEyeR.xyz;
		vec2 azD = azP.xy - azEc.xy - vec2( sign( azP.x - azEc.x ) * azEyeL.w * 0.42, 0.0 );
		azH -= pow( 0.5 + 0.5 * sin( atan( azD.y, abs( azD.x ) ) * 15.0 + length( azD ) * 300.0 ), 8.0 ) * vAzFace2.z;
		azH *= azLook.x * 0.0007 * azFade;
		vec2 azHd = vec2( dFdx( azH ), dFdy( azH ) );
		vec3 azR1 = cross( azQ1, normal ), azR2 = cross( normal, azQ0 ); float azDet = dot( azQ0, azR1 ) * faceDirection;
		normal = normalize( abs( azDet ) * normal - sign( azDet ) * ( azHd.x * azR1 + azHd.y * azR2 ) );
	  }
	#endif
	#if defined( AZ_PORES ) || defined( AZ_WEAVE )
	  bool azDoSkin = false, azDoCloth = false;
	  #ifdef AZ_PORES
	  azDoSkin = azSkin > 0.5 && azEyeK < 0.5;
	  #endif
	  #ifdef AZ_WEAVE
	  azDoCloth = azCloth > 0.5 && azFade > 0.0;
	  #endif
	  if ( azFade > 0.0 && ( azDoSkin || azDoCloth ) ) {
		vec2 azDuv = vMapUv * vAzDet / ( azDoSkin ? 0.03 : 0.02 );
		vec4 azDn;
		#if defined( AZ_PORES ) && defined( AZ_WEAVE )
		  azDn = azDoSkin ? texture2D( azPoreMap, azDuv ) : texture2D( azWeaveMap, azDuv );
		#elif defined( AZ_PORES )
		  azDn = texture2D( azPoreMap, azDuv );
		#else
		  azDn = texture2D( azWeaveMap, azDuv );
		#endif
		float azK = azFade * ( azDoSkin ? 0.9 - 0.3 * vAzFace.x : 0.75 );
		vec2 azNxy = ( azDn.xy * 2.0 - 1.0 ) * azK;
		vec3 azS0 = vec3( dFdx( azDuv ), 0.0 ), azS1 = vec3( dFdy( azDuv ), 0.0 );
		vec3 azR1 = cross( azQ1, normal ), azR2 = cross( normal, azQ0 );
		vec3 azT = azR1 * azS0.x + azR2 * azS1.x, azBt = azR1 * azS0.y + azR2 * azS1.y;
		float azM = max( dot( azT, azT ), dot( azBt, azBt ) );
		if ( azM > 0.0 ) { float azSc = inversesqrt( azM ); normal = normalize( azT * ( azNxy.x * azSc ) + azBt * ( azNxy.y * azSc ) + normal * sqrt( max( 0.0, 1.0 - dot( azNxy, azNxy ) ) ) ); }
		azMicro = mix( 1.0, azDn.b, azFade );
	  }
	#endif
	}
#endif`);
  // ---- after the physical material is set up: pores break up the specular, wet hair never turns to vinyl
  F = F.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
	material.roughness = min( 1.0, material.roughness + ( 1.0 - azMicro ) * 0.25 * azSkin );
	material.roughness = mix( material.roughness, max( material.roughness, 0.36 ), azHair );
	material.specularColor *= mix( 1.0, azMicro, azSkin );`);
  F = F.replace('#include <lights_physical_pars_fragment>', lightsChunk());
  // ---- indirect light: occlusion in cavities and contacts; a fresnel sheen driven by the scene's own ambient (no
  // constant studio fill: faces darken in the dark and take the place's colour)
  F = F.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
	{ float azAo = 1.0 - azCav * 0.65;
	  reflectedLight.indirectDiffuse *= azAo; reflectedLight.indirectSpecular *= azAo * azAo * ( 1.0 - 0.55 * azHair );
	  float azF = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 4.0 );
	#ifdef AZ_LIGHT
	  reflectedLight.indirectDiffuse += material.diffuseColor * ( irradiance + iblIrradiance ) * RECIPROCAL_PI * azF * ( azSkin * 0.6 + azCloth * 0.4 + azHair * 0.3 );
	#else
	  reflectedLight.indirectDiffuse += material.diffuseColor * ( vec3( 0.045, 0.048, 0.058 ) + vec3( 0.07, 0.08, 0.1 ) * pow( azF, 0.75 ) ) * ( 1.0 - 0.5 * azGloss );
	#endif
	}`);
  if (dbg && DBG[dbg]) F = F.replace('#include <dithering_fragment>', `#include <dithering_fragment>\n\tgl_FragColor = vec4( vec3( ${DBG[dbg]} ), 1.0 );`);
  sh.fragmentShader = F;
}

// ------------------------------------------------------------------------------------------------------------------
// per person: material, uniforms, facial life
// ------------------------------------------------------------------------------------------------------------------
let mainCam = null;
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function lookMaterial(src, U, info) {
  const m = src.clone();
  m.userData = { ...src.userData, azSkin: true, azLook: true };
  const tierKey = () => { const t = TIER[tierName()] ?? 1; return t; };
  m.customProgramCacheKey = () => 'azlook' + tierKey() + '|' + [...look.off].join('') + look.dbg + (U.azEyeC.value.z > 0 ? 'e' : '');
  m.onBeforeCompile = sh => {
    const t = tierKey();
    if (t > 0 && (on('pores') || on('cloth'))) { detailMaps ??= makeDetailMaps(); U.azPoreMap = { value: detailMaps.pores }; U.azWeaveMap = { value: detailMaps.weave }; }
    patch(sh, U, t, look.dbg);
  };
  void info;
  m.needsUpdate = true;
  return m;
}

/**
 * Hook for makePerson (cast3d.js): gives person handle `h` the look shading and facial life. No-op with ?look=classic.
 * Adds h.face = { blink(), look(worldPoint|null), state } (optional for callers: feature-detect h.face).
 */
export function lookPerson(h, seed = 1) {
  if (look.classic || !h || !h.meshes) return h;
  const atlas = h.meshes.filter(o => o.isSkinnedMesh && [].concat(o.material).some(m => m && m.userData && m.userData.slot === 'atlas'));
  if (!atlas.length) return h;
  const main = atlas.find(o => !o.userData.lod) || atlas[0];
  const g = main.geometry;
  let info = g.userData.azLook;
  if (!info) {
    const mat = [].concat(main.material).find(m => m.userData.slot === 'atlas');
    try { info = analyse(main, mat); } catch (e) { console.warn('look: analysis failed for', h.id, e && e.message); info = { failed: true }; }
    g.userData.azLook = info;
  }
  if (info.failed) return h;
  const E = info.eyes, Fc = info.face;
  const age = AGES[h.id]?.age;
  const U = {
    azEye: { value: new THREE.Vector4(0, 0, 0, 0) },
    azEyeC: { value: E ? new THREE.Vector4(E.cu, E.cv, E.R, E.cs) : new THREE.Vector4(0, 0, 0, 0) },
    azLid: { value: new THREE.Vector4(E ? E.U : 0.12, E ? E.Lo : -0.22, 0, 0) },
    azLook: { value: new THREE.Vector4(age != null ? Math.max(0, Math.min(1, (age - 22) / 50)) : 0.15, 0, 0, 0) },
    azHairTint: { value: new THREE.Vector3(...Fc.hair) },
    azEyeX: { value: new THREE.Vector3(1, 0, 0) }, azEyeY: { value: new THREE.Vector3(0, 1, 0) }, azEyeZ: { value: new THREE.Vector3(0, 0, 1) },
    azEyeL: { value: E ? new THREE.Vector4(...E.L.c, Fc.u) : new THREE.Vector4(Fc.M[0] + 0.032, Fc.M[1], Fc.M[2], Fc.u) },
    azEyeR: { value: E ? new THREE.Vector4(...E.Rr.c, Fc.u) : new THREE.Vector4(Fc.M[0] - 0.032, Fc.M[1], Fc.M[2], Fc.u) },
    azExpr: { value: new THREE.Vector4(0, 0, 0, 0) },
    azCrown: { value: new THREE.Vector4(Fc.M[0], Fc.M[1] + 1.55 * Fc.u, Fc.M[2] - 0.9 * Fc.u, 0) },
  };
  if (age == null) ageWait.push(() => { const a = AGES[h.id]?.age; if (a != null) U.azLook.value.x = Math.max(0, Math.min(1, (a - 22) / 50)); });
  const mats = new Map();
  for (const o of atlas) {
    if (!o.geometry.attributes.azFace) {
      for (const k in info.attrs) {
        const a = info.attrs[k];
        if (o.geometry.attributes.position.count === a.count) o.geometry.setAttribute(k, a);
      }
    }
    if (!o.geometry.attributes.azFace) continue;
    o.material = Array.isArray(o.material)
      ? o.material.map(m => (m.userData.slot === 'atlas' ? (mats.get(m) || mats.set(m, lookMaterial(m, U, info)).get(m)) : m))
      : (o.material.userData.slot === 'atlas' ? (mats.get(o.material) || mats.set(o.material, lookMaterial(o.material, U, info)).get(o.material)) : o.material);
  }
  look.stats.persons++;
  // ---- facial life
  const R = mulberry((seed * 7919 + 13) | 0);
  const S = { t: 0, nextBlink: 0.6 + R() * 2.5, blinkT: -1, gaze: new THREE.Vector2(), want: new THREE.Vector2(), sacc: 0.3 + R(), glance: 2 + R() * 5,
    glanceOff: new THREE.Vector2(), micro: new THREE.Vector2(), brow: 0, browT: 3 + R() * 6, browTo: 0, frame: -1, far: false, fix: null };
  const headBone = main.skeleton ? main.skeleton.bones.findIndex(b => b.name.replace(/_\d+$/, '') === 'head') : -1;
  const eyeMid = E ? new THREE.Vector3((E.L.c[0] + E.Rr.c[0]) / 2, (E.L.c[1] + E.Rr.c[1]) / 2, (E.L.c[2] + E.Rr.c[2]) / 2) : new THREE.Vector3(...Fc.M);
  const blinkCurve = t => (t < 0 ? 0 : t < 0.075 ? t / 0.075 : t < 0.11 ? 1 : t < 0.27 ? 1 - (t - 0.11) / 0.16 : 0);
  const character = () => { let p = h.root.parent; for (let k = 0; k < 3 && p; k++, p = p.parent) if (p.userData && p.userData.character) return p.userData.character; return null; };
  const face = h.face = {
    state: S, uniforms: U, info,
    blink() { if (S.blinkT < 0) S.blinkT = 0; },
    // world point to look at (a Vector3), or null: free gaze
    look(p) { S.fix = p ? (p.isVector3 ? p : null) : null; },
  };
  const tick = dt => {
    if (!(dt > 0)) return;
    S.t += dt;
    const ch = character(), talking = ch && ch.talk > 0;
    // blinks: every 2-6 s (more often while talking), 75 ms close, 35 ms shut, 160 ms open; sometimes a double blink
    if (S.blinkT >= 0) { S.blinkT += dt; if (S.blinkT > 0.3) { S.blinkT = -1; if (R() < 0.12) S.nextBlink = 0.18; } }
    else if ((S.nextBlink -= dt) <= 0) { S.blinkT = 0; S.nextBlink = (talking ? 1.4 : 2.0) + R() * (talking ? 3 : 4.5); }
    // saccades: small fixational jumps every 0.4-1.6 s, a glance away every 3-9 s that comes back after a moment
    if ((S.sacc -= dt) <= 0) { S.sacc = 0.4 + R() * 1.2; S.micro.set((R() - 0.5) * 0.06, (R() - 0.5) * 0.04); }
    if ((S.glance -= dt) <= 0) {
      if (S.glanceOff.lengthSq() > 0) { S.glanceOff.set(0, 0); S.glance = 3 + R() * 6; }
      else { S.glanceOff.set((R() - 0.5) * 0.36, (R() - 0.6) * 0.16); S.glance = 0.5 + R() * 1.2; if (R() < 0.45 && S.blinkT < 0) S.blinkT = 0; }
    }
    // micro-expressions: a brow lift now and then (more while talking), easing in and out
    if ((S.browT -= dt) <= 0) { S.browTo = S.browTo > 0 ? 0 : (talking ? 0.6 + R() * 0.4 : 0.25 + R() * 0.35); S.browT = S.browTo > 0 ? 0.5 + R() * 0.9 : (talking ? 1.5 : 4) + R() * 6; }
    S.brow += (S.browTo - S.brow) * Math.min(1, dt * 6);
  };
  const up = h.update;
  h.update = dt => { up(dt); tick(dt); };
  const frame = (renderer, scene, camera) => {
    const f = renderer.info.render.frame;
    if (S.frame === f) return; S.frame = f;
    const ev = U.azEye.value;
    ev.z = on('face') ? blinkCurve(S.blinkT) : 0;
    U.azExpr.value.x = on('face') ? S.brow : 0;
    if (!E || headBone < 0 || !on('face')) { ev.x = ev.y = ev.w = 0; return; }
    // rest (mesh) space -> world for the head: matrixWorld * bindMatrixInverse * head * boneInverse * bindMatrix
    const sk = main.skeleton, bone = sk.bones[headBone];
    _m.multiplyMatrices(main.matrixWorld, main.bindMatrixInverse).multiply(bone.matrixWorld).multiply(sk.boneInverses[headBone]).multiply(main.bindMatrix);
    const ex = U.azEyeX.value.set(1, 0, 0).transformDirection(_m), ey = U.azEyeY.value.set(0, 1, 0).transformDirection(_m), ez = U.azEyeZ.value.set(0, 0, 1).transformDirection(_m);
    const eye = _v.copy(eyeMid).applyMatrix4(_m);
    if (camera && camera.isPerspectiveCamera && camera.fov < 89) mainCam = camera;
    if (mainCam && eye.distanceToSquared(mainCam.position) > 144) { S.far = true; ev.x = ev.y = ev.w = 0; return; }
    S.far = false;
    // where to look: the face's own fixation (face.look), the character's lookTarget, else ahead along the body
    let tgt = S.fix;
    const ch = character(), lt = ch && ch.lookTarget;
    if (!tgt && lt) tgt = lt.isVector3 ? lt : lt.getWorldPosition ? lt.getWorldPosition(_v2) : lt.position && _v2.copy(lt.position);
    if (tgt && lt && !lt.isVector3 && lt.userData && lt.userData.character && lt.userData.character.head) { lt.userData.character.head.getWorldPosition(_v2); _v2.y += 0.07; tgt = _v2; }
    let yaw = 0, pitch = 0;
    if (tgt) {
      const d = _v2.copy(tgt).sub(eye);
      if (d.lengthSq() > 0.04) { const lx = d.dot(ex), ly = d.dot(ey), lz = d.dot(ez); yaw = Math.atan2(lx, Math.max(0.05, lz)); pitch = Math.atan2(ly, Math.hypot(lx, lz)); }
    } else {
      // free gaze: ahead along the body (the head's sway is cancelled, as real eyes hold a fixation)
      h.root.getWorldQuaternion(_q); const fwd = _v2.set(0, -0.12, 1).applyQuaternion(_q);
      const lx = fwd.dot(ex), ly = fwd.dot(ey), lz = fwd.dot(ez); yaw = Math.atan2(lx, Math.max(0.05, lz)); pitch = Math.atan2(ly, Math.hypot(lx, lz));
    }
    const k = 2 / Math.PI;
    S.want.set(Math.max(-0.34, Math.min(0.34, yaw * k + S.glanceOff.x + S.micro.x)), Math.max(-0.22, Math.min(0.2, pitch * k + S.glanceOff.y + S.micro.y)));
    S.gaze.lerp(S.want, 0.55);     // a saccade takes ~2 frames
    ev.x = S.gaze.x; ev.y = S.gaze.y;
    ev.w = Math.max(-0.05, Math.min(0.1, -S.gaze.y * 0.55));    // the upper lid follows the eye down
    void scene;
  };
  for (const o of atlas) {
    const prev = o.onBeforeRender, def = THREE.Object3D.prototype.onBeforeRender;
    o.onBeforeRender = prev && prev !== def ? function (r, s, c, gm, mt, gr) { frame(r, s, c); prev.call(this, r, s, c, gm, mt, gr); } : (r, s, c) => frame(r, s, c);
  }
  return h;
}
