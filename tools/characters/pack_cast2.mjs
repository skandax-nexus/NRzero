// pack_cast2.mjs RAW.glb OUTDIR [--parts=10.5] : the look v2 cast (docs/CHARACTER_LOOK.md, "Cast rebuild") from the
// generator's raw export (build_humans.py with LOOK2, every character at full density):
//  1. every atlas mesh lands on its triangle budget (docs/COSTUMES.md "Mobile budgets") with meshoptimizer's
//     attribute-aware simplifier, as simplify_cast.mjs does, plus a face / hand importance: the attributes of vertices
//     on the head, face bones, hands and fingers are scaled up, so collapses there cost more (the face and fingers keep
//     their triangles, plain cloth goes first). Hair cards (gh_) are their own mesh and are not counted in the budget
//     (they are distance-culled and drawn at 45 % on the low tier, see src/human/rig2.js);
//  2. crowd low LOD index lists (`<id>_lod`) as before;
//  3. textures: the part files carry phone-size atlases (Kai 1024, everyone else 512; WebP), the HD pack files carry
//     the full-size atlases (Kai 2048, named / crowd 1024) and are loaded on desktop tiers only (cast3d.js swaps the
//     images in place); the shared strand texture is in every part;
//  4. the characters are split into part files of at most --parts MB (the web preview serves each file up to 16 MB
//     after base64), and OUTDIR/cast2.json lists them.
// Hero pipeline (docs/CHARACTER_LOOK.md, "Faces: hero pipeline"; budgets in docs/COSTUMES.md "Mobile budgets"):
//  - two builds per principal over one vertex buffer: the HD build (`<id>_mesh`, high tier and desktop medium) and a
//    phone build (`<id>_tlo`, a second index list, extras { tier: 'phone', lod: 1 }); cast3d.js keeps one per tier;
//  - the head (head and face bones) gets its own triangle target in each build and is simplified apart from the body
//    (vertex locks), so the decimation goes to the body and clothes; crowds keep one build plus the 6 000 LOD;
//  - the face's normal map is baked from a Loop-subdivided copy of the raw head onto each shipped head (head_bake.mjs):
//    the HD atlas against the HD build, the phone atlas against the phone build; the painted pores stay on top.
//    HEAD_BAKE=0 skips it, TIERS=0 packs one build per character as before.
// Needs GT_MODS (node_modules dir with @gltf-transform/* , meshoptimizer and sharp; compress_cast.sh finds it).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const MODS = process.env.GT_MODS;
const imp = p => import(pathToFileURL(path.join(MODS, p)).href);
const { NodeIO } = await imp('@gltf-transform/core/dist/index.js');
const { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP } = await imp('@gltf-transform/extensions/dist/index.js');
const { reorder, quantize, prune, dedup } = await imp('@gltf-transform/functions/dist/index.js');
const { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } = await imp('meshoptimizer/index.js');
const sharp = (await import('node:module')).createRequire(path.join(MODS, 'x.js'))('sharp');
await MeshoptSimplifier.ready; await MeshoptEncoder.ready; await MeshoptDecoder.ready;

const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
const flag = n => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : null; };
const [inp, outDir] = pos;
const PART_MB = +(flag('parts') || 10.5);
const MAXERR = +(process.env.SIMPLIFY_ERR || 0.03);
const TIERS = process.env.TIERS !== '0', BAKE = process.env.HEAD_BAKE !== '0';
const { boneWeights, loopSubdivide, bakeHeadNormals, vertexAO, rasterUV, bakeVertexScalar } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'head_bake.mjs')).href);
// triangle budgets per class: [HD build, phone build] in total (atlas + glow + props, not the hair cards) and for the
// head (head and face bones: face, scalp, ears, eyes, mouth, hair volume); null head = whatever the raw head has
const PRINCIPALS = new Set(['mira', 'witness', 'sera', 'rook']);
function tierBudget(id, budget, rawHead) {
  const cap = (x) => Math.min(rawHead, x);
  // proto:makehuman: the hero's head is subdivided in the generator (build_humans.subdivide_head): a denser HD head
  if (budget >= 16000) return { hi: +(process.env.HERO_HI || 34000), lo: 16000, headHi: cap(+(process.env.HERO_HEAD_HI || 19000)), headLo: cap(+(process.env.HERO_HEAD_LO || 6400)) };
  if (PRINCIPALS.has(id)) return { hi: 17000, lo: budget, headHi: cap(8000), headLo: cap(4600) };
  if (budget > 9000) return { hi: 13000, lo: budget, headHi: cap(5600), headLo: cap(4000) };
  return { hi: budget, lo: budget, headHi: cap(Math.max(2600, Math.min(3400, rawHead * 0.3))), headLo: null };
}
const IMPORTANCE = +(process.env.FACE_IMPORTANCE || 2.5);
fs.mkdirSync(outDir, { recursive: true });
const io = () => new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', ...a);

// ------------------------------------------------------------------------------------------------------------------
// 1-2. simplify + LOD (one pass over the raw document)
// ------------------------------------------------------------------------------------------------------------------
const doc = await io().read(inp);
const root = doc.getRoot();
log('read', inp, root.listScenes()[0].listChildren().length, 'characters');

const EMB = [];
for (let j = 0; j < 256; j++) {
  let s = Math.imul(j + 1, 2654435761) >>> 0; const v = [];
  for (let k = 0; k < 6; k++) { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; v.push((s / 4294967296) * 2 - 1); }
  const n = Math.hypot(...v) || 1; EMB.push(v.map(x => x / n));
}
const tris = p => (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
const meshTris = n => (n.getMesh() ? n.getMesh().listPrimitives().reduce((a, p) => a + tris(p), 0) : 0);
const walk = (n, f) => { f(n); n.listChildren().forEach(c => walk(c, f)); };
const floats = acc => { const a = acc.getArray(); const out = new Float32Array(a.length); const nm = acc.getNormalized();
  const sc = !nm ? 1 : a instanceof Uint8Array ? 1 / 255 : a instanceof Uint16Array ? 1 / 65535 : a instanceof Int8Array ? 1 / 127 : a instanceof Int16Array ? 1 / 32767 : 1;
  for (let i = 0; i < a.length; i++) out[i] = a[i] * sc; return out; };
const HEADRE = /^(head|jaw|eye_[LR]|lid_[LR]|lidlo_[LR]|brow_[LR]|mouth_[LR])$/;
const IMPORTANT = /^(head|neck|jaw|eye_[LR]|lid_[LR]|lidlo_[LR]|brow_[LR]|mouth_[LR]|hand_[LR]|(thumb|index|middle|ring|pinky)\d_[LR])$/;

function attrsOf(prim, jointNames) {
  const n = prim.getAttribute('POSITION').getCount();
  const nor = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0'), mk = prim.getAttribute('_MASK') || prim.getAttribute('_mask');
  const jo = prim.getAttribute('JOINTS_0'), we = prim.getAttribute('WEIGHTS_0');
  const N = nor && floats(nor), U = uv && floats(uv), K = mk && floats(mk), J = jo && jo.getArray(), Wt = we && floats(we);
  const S = 3 + 2 + 3 + 6, A = new Float32Array(n * S);
  const imp = jointNames.map(nm => IMPORTANT.test(nm));
  for (let i = 0; i < n; i++) {
    const o = i * S;
    let f = 1;
    if (J && Wt) { let w = 0; for (let k = 0; k < 4; k++) if (imp[J[i * 4 + k]]) w += Wt[i * 4 + k]; f = 1 + (IMPORTANCE - 1) * Math.min(1, w); }
    if (N) { A[o] = N[i * 3] * f; A[o + 1] = N[i * 3 + 1] * f; A[o + 2] = N[i * 3 + 2] * f; }
    if (U) { A[o + 3] = U[i * 2] * f; A[o + 4] = U[i * 2 + 1] * f; }
    if (K) { const ks = mk.getElementSize(); for (let k = 0; k < Math.min(3, ks); k++) A[o + 5 + k] = K[i * ks + k] * f; }
    if (J && Wt) for (let k = 0; k < 4; k++) { const w = Wt[i * 4 + k]; if (!w) continue; const e = EMB[J[i * 4 + k] & 255]; for (let d = 0; d < 6; d++) A[o + 8 + d] += w * e[d] * f; }
  }
  return { A, S, W: [0.6, 0.6, 0.6, 4, 4, 1.5, 1.5, 1.5, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2] };
}
function compact(prim, idx) {
  const n = prim.getAttribute('POSITION').getCount(), remap = new Int32Array(n).fill(-1);
  let m = 0;
  for (let i = 0; i < idx.length; i++) if (remap[idx[i]] < 0) remap[idx[i]] = m++;
  for (const sem of prim.listSemantics()) {
    const acc = prim.getAttribute(sem), es = acc.getElementSize(), a = acc.getArray();
    const b = new a.constructor(m * es);
    for (let i = 0; i < n; i++) if (remap[i] >= 0) for (let k = 0; k < es; k++) b[remap[i] * es + k] = a[i * es + k];
    const nacc = doc.createAccessor(acc.getName()).setType(acc.getType()).setArray(b).setNormalized(acc.getNormalized()).setBuffer(acc.getBuffer());
    prim.setAttribute(sem, nacc);
    if (acc.listParents().every(p => p === root)) acc.dispose();
  }
  const ni = m > 65535 ? new Uint32Array(idx.length) : new Uint16Array(idx.length);
  for (let i = 0; i < idx.length; i++) ni[i] = remap[idx[i]];
  const old = prim.getIndices();
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(ni).setBuffer(old.getBuffer()));
  if (old.listParents().every(p => p === root)) old.dispose();
}
function simplify(prim, target, jointNames, lockBorder = true, idxIn = null, lock = null) {
  const p = floats(prim.getAttribute('POSITION'));
  const idx = idxIn ? new Uint32Array(idxIn) : new Uint32Array(prim.getIndices().getArray());
  const { A, S, W } = attrsOf(prim, jointNames);
  const [res, err] = MeshoptSimplifier.simplifyWithAttributes(idx, p, 3, A, S, W, lock, Math.floor(target) * 3, MAXERR, lockBorder ? ['LockBorder'] : []);
  return { idx: res, err };
}
// per vertex: on the head (head + face bones > 0.5)
function headMask(prim, jointNames) {
  const jo = prim.getAttribute('JOINTS_0'), we = prim.getAttribute('WEIGHTS_0');
  if (!jo || !we) return null;
  const w = boneWeights(jo.getArray(), floats(we), jointNames, HEADRE), m = new Uint8Array(w.length);
  for (let i = 0; i < w.length; i++) m[i] = w[i] > 0.5 ? 1 : 0;
  return m;
}
const triCount = (idx, m, want) => { let n = 0; for (let t = 0; t < idx.length; t += 3) if ((m[idx[t]] & m[idx[t + 1]] & m[idx[t + 2]]) === want) n++; return n; };
/** head-aware simplification: the head to headT triangles (body locked), then the body to the rest (head locked). */
function simplifyTiered(prim, idx, total, headT, jointNames, hm) {
  let cur = new Uint32Array(idx), err = 0;
  const notHead = new Uint8Array(hm.length), isHead = new Uint8Array(hm.length);
  for (let i = 0; i < hm.length; i++) { notHead[i] = hm[i] ? 0 : 1; isHead[i] = hm[i]; }
  const nAll = () => cur.length / 3;
  const h0 = triCount(cur, hm, 1);
  if (headT != null && h0 > headT) {
    const r = simplify(prim, nAll() - (h0 - headT), jointNames, true, cur, notHead); cur = r.idx; err = Math.max(err, r.err);
  }
  if (nAll() > total) {
    const r = simplify(prim, total, jointNames, true, cur, isHead); cur = r.idx; err = Math.max(err, r.err);
    if (nAll() > total * 1.02) { const r2 = simplify(prim, total, jointNames, false, cur, isHead); cur = r2.idx; err = Math.max(err, r2.err); }
    if (nAll() > total * 1.02) { const r3 = simplify(prim, total, jointNames, false, cur, null); cur = r3.idx; err = Math.max(err, r3.err); }
  }
  return { idx: cur, err, head: triCount(cur, hm, 1) };
}
const report = [];
const charInfo = {};
const bakeLogEarly = [];
const bakeJobs = {};        // id -> { sub (subdivided raw head), hi: {P,N,UV,skin,foreign}, lo: {...} }
const maskOf = prim => { const mk = prim.getAttribute('_MASK') || prim.getAttribute('_mask'); return mk ? { a: floats(mk), s: mk.getElementSize() } : null; };
/** shipped triangles split into head skin (baked) and everything else (left alone where they share texels). */
function splitSkin(idx, hm, mk) {
  const skin = [], other = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    let isSkin = !!(hm && hm[a] && hm[b] && hm[c]);
    if (isSkin && mk) {
      const r = (mk.a[a * mk.s] + mk.a[b * mk.s] + mk.a[c * mk.s]) / 3, g = (mk.a[a * mk.s + 1] + mk.a[b * mk.s + 1] + mk.a[c * mk.s + 1]) / 3;
      const bl = mk.s > 2 ? (mk.a[a * mk.s + 2] + mk.a[b * mk.s + 2] + mk.a[c * mk.s + 2]) / 3 : 0;
      isSkin = r > 0.5 && g < 0.4 && bl < 0.4;
    }
    (isSkin ? skin : other).push(a, b, c);
  }
  return { skin: new Uint32Array(skin), other: new Uint32Array(other) };
}
for (const scene of root.listScenes()) for (const top of scene.listChildren()) {
  const ex = top.getExtras() || {}, id = ex.character || top.getName();
  const budget = +ex.tris_budget || 0;
  let atlas = null, total = 0, cards = 0;
  walk(top, n => { const t = meshTris(n); if (/^gh_/.test(n.getName())) cards += t; else total += t; if (n.getMesh() && n.getName() === id + '_mesh') atlas = n; });
  if (!atlas || !budget) { report.push(`${id}: ${total} tris (no budget)`); continue; }
  const skin = atlas.getSkin(), jointNames = skin ? skin.listJoints().map(j => j.getName()) : [];
  const prim = atlas.getMesh().listPrimitives()[0], before = total, mine = tris(prim), others = total - mine;
  const hm = headMask(prim, jointNames);
  const rawIdx = new Uint32Array(prim.getIndices().getArray());
  const rawHead = hm ? triCount(rawIdx, hm, 1) : 0;
  const tb = TIERS && hm ? tierBudget(id, budget, rawHead) : { hi: budget, lo: budget, headHi: null, headLo: null };
  // the bake source: the raw head skin, one Loop subdivision step
  if (BAKE && hm) {
    const P = floats(prim.getAttribute('POSITION')), UV = floats(prim.getAttribute('TEXCOORD_0'));
    const { skin: rs, other: ro } = splitSkin(rawIdx, hm, maskOf(prim));
    if (rs.length) {
      bakeJobs[id] = { sub: loopSubdivide(P, UV, rs) };
      // ambient occlusion of the head skin against the head, hair volume, eyes, neck and collar (raw mesh)
      const N = floats(prim.getAttribute('NORMAL'));
      let cx = 0, cy = 0, cz = 0; for (const v of rs) { cx += P[v * 3]; cy += P[v * 3 + 1]; cz += P[v * 3 + 2]; }
      cx /= rs.length; cy /= rs.length; cz /= rs.length;
      const occ = [];
      for (let t = 0; t < rawIdx.length; t += 3) {
        let near = false;
        for (let k = 0; k < 3; k++) { const v = rawIdx[t + k]; if ((P[v * 3] - cx) ** 2 + (P[v * 3 + 1] - cy) ** 2 + (P[v * 3 + 2] - cz) ** 2 < 0.22 * 0.22) near = true; }
        if (near) occ.push(rawIdx[t], rawIdx[t + 1], rawIdx[t + 2]);
      }
      const t0 = Date.now(), ao = vertexAO(P, N, rs, new Uint32Array(occ));
      // fix round 3: a build's per-vertex occlusion relief (`_aor`, build_humans.ao_relief: Kai's nose sides, nasolabial
      // folds and under-eye crescent), applied to the bake, then dropped from the shipped mesh
      const aorA = prim.getAttribute('_AOR') || prim.getAttribute('_aor');
      if (aorA) { const R = floats(aorA); for (const v of new Set(rs)) ao[v] = 1 - (1 - ao[v]) * (1 - R[v]); }
      let mean = 0, nn = 0; for (const v of new Set(rs)) { mean += ao[v]; nn++; }
      bakeJobs[id].ao = { UV, skin: rs, other: ro, val: ao };
      bakeLogEarly.push(`${id}: head ao ${(Date.now() - t0) / 1000}s, mean ${(mean / nn).toFixed(2)}, ${occ.length / 3} occluders`);
    }
  }
  for (const nm_ of ['_AOR', '_aor']) if (prim.getAttribute(nm_)) prim.setAttribute(nm_, null);      // (bake input only)
  let err = 0, head = rawHead;
  const target = tb.hi - others;
  if (mine > target || (tb.headHi != null && rawHead > tb.headHi)) {
    const r = hm ? simplifyTiered(prim, rawIdx, target, tb.headHi, jointNames, hm) : simplify(prim, target, jointNames);
    err = r.err; head = r.head ?? head; compact(prim, r.idx);
  }
  total = 0; walk(top, n => { if (!/^gh_/.test(n.getName())) total += meshTris(n); });
  report.push([top, id, atlas, prim, before, total, budget, err, tb, jointNames, cards, head, others, rawHead]);
}
await doc.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }));
const addIndexNode = (top, atlas, prim, li, name, extras) => {
  const lp = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
  for (const sem of prim.listSemantics()) lp.setAttribute(sem, prim.getAttribute(sem));
  const ia = li.length && Math.max(...li) > 65535 ? new Uint32Array(li) : new Uint16Array(li);
  lp.setIndices(doc.createAccessor().setType('SCALAR').setArray(ia).setBuffer(prim.getIndices().getBuffer()));
  const lm = doc.createMesh(name).addPrimitive(lp);
  const ln = doc.createNode(name).setMesh(lm).setSkin(atlas.getSkin()).setExtras(extras)
    .setTranslation(atlas.getTranslation()).setRotation(atlas.getRotation()).setScale(atlas.getScale());
  const par = atlas.getParentNode(); (par || top).addChild(ln);
};
for (let i = 0; i < report.length; i++) {
  if (typeof report[i] === 'string') continue;
  const [top, id, atlas, prim, before, total, budget, err, tb, jointNames, cards, head, others, rawHead] = report[i];
  const ex = top.getExtras() || {};
  let lod = '', phone = '';
  const hm = headMask(prim, jointNames);
  const hiIdx = new Uint32Array(prim.getIndices().getArray());
  let loIdx = null;
  // the phone build: a second index list over the same vertices
  if (hm && tb.lo < tb.hi) {
    const r = simplifyTiered(prim, hiIdx, tb.lo - others, tb.headLo, jointNames, hm);
    loIdx = r.idx;
    addIndexNode(top, atlas, prim, loIdx, id + '_tlo', { tier: 'phone', lod: 1 });
    phone = ` | phone ${loIdx.length / 3 + others} (head ${r.head})`;
    top.setExtras({ ...ex, tris_phone: loIdx.length / 3 + others });
  }
  const lodT = +ex.lod_tris || 0;
  if (lodT && tris(prim) > lodT) {
    const r = simplify(prim, lodT, jointNames);
    let li = r.idx;
    if (li.length / 3 > lodT * 1.05) li = simplify(prim, lodT, jointNames, false).idx;
    addIndexNode(top, atlas, prim, li, id + '_lod', { lod: 1 });
    lod = ` lod ${li.length / 3}`;
  }
  if (bakeJobs[id] && hm) {
    const P = floats(prim.getAttribute('POSITION')), N = floats(prim.getAttribute('NORMAL')), UV = floats(prim.getAttribute('TEXCOORD_0')), mk = maskOf(prim);
    const hi = splitSkin(hiIdx, hm, mk);
    bakeJobs[id].hi = { P, N, UV, skin: hi.skin, other: hi.other };
    if (loIdx) { const lo = splitSkin(loIdx, hm, mk); bakeJobs[id].lo = { P, N, UV, skin: lo.skin, other: lo.other }; }
  }
  charInfo[id] = { tris: total, cards, budget, head, phone: loIdx ? loIdx.length / 3 + others : total };
  report[i] = `${id}: ${before} -> ${total} tris (budget ${budget}, HD ${tb.hi}, head ${rawHead} -> ${head}, err ${err.toFixed(4)})${phone}${lod}, cards ${cards}`;
}
log('simplified\n' + report.join('\n'));
if (bakeLogEarly.length) log(bakeLogEarly.join('\n'));

// quantize: custom attributes 8 bits (normalized), geometry like compress_cast.sh but 10-bit normals (smooth cheeks)
await doc.transform(quantize({ pattern: /^_/, quantizeGeneric: 8 }));
await doc.transform(prune(), quantize({ pattern: /^(POSITION|TEXCOORD|JOINTS|WEIGHTS|COLOR|NORMAL)(_\d+)?$/, patternTargets: /^(POSITION|TEXCOORD|JOINTS|WEIGHTS|COLOR|NORMAL|TANGENT)(_\d+)?$/,
  quantizePosition: 14, quantizeTexcoord: 12, quantizeNormal: 10, quantizeColor: 8, quantizeWeight: 8, quantizeGeneric: 12 }));
log('quantized');

// ------------------------------------------------------------------------------------------------------------------
// 3. textures: originals kept aside for the HD pack, the document gets phone sizes (WebP)
// ------------------------------------------------------------------------------------------------------------------
const texOwner = new Map();      // texture -> character id (by material name)
for (const m of root.listMaterials()) {
  const id = m.getName().replace(/_(atlas|hair|glow)$/, '');
  for (const t of [m.getBaseColorTexture(), m.getNormalTexture(), m.getEmissiveTexture(), m.getMetallicRoughnessTexture(), m.getOcclusionTexture()]) if (t && !texOwner.has(t)) texOwner.set(t, /_hair$/.test(m.getName()) ? '*strands' : id);
}
const HERO = new Set(['kai']);
const bakeLog = [];
const hd = new Map();    // texture name -> { id, slot, webp buffer (full size) }
const enc = async (buf, size, q, alpha) => {
  let s = sharp(buf);
  if (size) s = s.resize(size, size, { kernel: 'lanczos3' });
  return s.webp({ quality: q, alphaQuality: alpha ? 90 : 100, effort: 5, smartSubsample: true }).toBuffer();
};
for (const t of root.listTextures()) {
  const id = texOwner.get(t); if (!id) continue;
  let img = t.getImage(); if (!img) continue;
  const meta = await sharp(Buffer.from(img)).metadata();
  const W = meta.width, nm = t.getName() || '';
  const isN = /_n$/.test(nm), isE = /_e$/.test(nm), isS = id === '*strands', isR = /_r$/.test(nm);
  const aoJob = !isS && !isN && !isE && bakeJobs[id] && bakeJobs[id].ao;
  if (aoJob) {        // baked head occlusion: the occlusion map (R) in full, the albedo a little (creases read in direct light)
    const { data, info } = await sharp(Buffer.from(img)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = new Uint8Array(data.buffer, data.byteOffset, data.length), res = info.width;
    const FC = new Uint8Array(res * res); rasterUV(aoJob.UV, aoJob.other, res, i => { FC[i] = 1; });
    let n = 0;
    bakeVertexScalar(aoJob.UV, aoJob.skin, aoJob.val, res, (i, a) => {
      if (FC[i]) return;
      const k = isR ? 0.25 + 0.75 * a : 0.8 + 0.2 * a;
      if (isR) px[i * 3] = Math.round(px[i * 3] * k); else for (let c = 0; c < 3; c++) px[i * 3 + c] = Math.round(px[i * 3 + c] * k);
      n++;
    });
    img = new Uint8Array(await sharp(Buffer.from(px), { raw: { width: res, height: res, channels: 3 } }).png().toBuffer());
    bakeLog.push(`${id} ${nm}: occlusion on ${n} texels`);
  }
  if (isS) {          // the strand texture: the same in every part (alpha), 1024 everywhere
    t.setImage(new Uint8Array(await enc(Buffer.from(img), null, 88, true))).setMimeType('image/webp');
    continue;
  }
  const phone = HERO.has(id) ? Math.min(W, 1024) : Math.min(W, 512);
  const hq = isN ? 90 : isE ? 80 : 88;
  const job = isN && bakeJobs[id] && bakeJobs[id].hi ? bakeJobs[id] : null;
  if (job) {          // the head's normal map baked onto each shipped build (HD atlas: HD build; phone atlas: phone build)
    const bake = async (size, mesh) => {
      const { data, info } = await sharp(Buffer.from(img)).removeAlpha().resize(size, size, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
      const px = new Uint8Array(data.buffer, data.byteOffset, data.length);
      const r = bakeHeadNormals(px, info.width, job.sub, mesh, mesh.skin, mesh.other);
      bakeLog.push(`${id} ${size}: ${r.texels} texels, mean ${r.meanDev.toFixed(1)} deg`);
      return sharp(Buffer.from(px), { raw: { width: info.width, height: info.height, channels: 3 } });
    };
    const q = (s, qq) => s.webp({ quality: qq, effort: 5, smartSubsample: true }).toBuffer();
    if (phone < W) hd.set(nm, { id, nm, buf: await q(await bake(W, job.hi), 92) });
    t.setImage(new Uint8Array(await q(await bake(phone, job.lo || job.hi), 90))).setMimeType('image/webp');
    continue;
  }
  if (phone < W) hd.set(nm, { id, nm, buf: await enc(Buffer.from(img), null, hq, false) });
  t.setImage(new Uint8Array(await enc(Buffer.from(img), phone < W ? phone : null, isN ? 86 : isE ? 75 : 84, false))).setMimeType('image/webp');
}
if (bakeLog.length) log('head bake\n' + bakeLog.join('\n'));
doc.createExtension(EXTTextureWebP).setRequired(true);
log('textures', root.listTextures().length, 'hd', hd.size);

// ------------------------------------------------------------------------------------------------------------------
// 4. parts: each character's share of the file, then greedy packing under PART_MB
// ------------------------------------------------------------------------------------------------------------------
const tops = root.listScenes()[0].listChildren();
const raw = await io().writeBinary(doc);
async function subset(keep, packOpts = true) {
  const d = await io().readBinary(raw);
  const sc = d.getRoot().listScenes()[0];
  for (const n of sc.listChildren()) if (!keep.has(n.getName())) { walk(n, x => { if (x !== n) x.dispose(); }); n.dispose(); }
  for (const s of d.getRoot().listSkins()) if (!s.listJoints().length || s.listParents().every(p => p === d.getRoot())) s.dispose();
  await d.transform(prune({ keepAttributes: true, keepIndices: true, keepLeaves: false }));
  if (packOpts) d.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  return d;
}
const sizes = {};
for (const n of tops) {
  const d = await subset(new Set([n.getName()]));
  sizes[n.getName()] = (await io().writeBinary(d)).byteLength;
}
const strandBytes = (() => { for (const t of root.listTextures()) if (texOwner.get(t) === '*strands') return t.getImage().byteLength; return 0; })();
log('sizes', Object.entries(sizes).map(([k, v]) => k + ' ' + (v / 1e6).toFixed(2)).join(', '));
// greedy: in cast order (principals first: the first part holds the cast a mission needs most often), new part when full
const order = tops.map(n => n.getName());
const parts = [];
let cur = null;
for (const id of order) {
  const s = sizes[id] - strandBytes;
  if (!cur || cur.bytes + s > PART_MB * 1e6) { cur = { ids: [], bytes: strandBytes }; parts.push(cur); }
  cur.ids.push(id); cur.bytes += s;
}
const manifest = { version: 2, built: new Date().toISOString(), parts: [], hd: [], characters: charInfo };
for (let i = 0; i < parts.length; i++) {
  const d = await subset(new Set(parts[i].ids));
  const file = `cast2_${i}.glb`;
  await io().write(path.join(outDir, file), d);
  const bytes = fs.statSync(path.join(outDir, file)).size;
  manifest.parts.push({ file, ids: parts[i].ids, bytes });
  log(file, (bytes / 1e6).toFixed(2), 'MB', parts[i].ids.length, 'characters');
  if (bytes > 11.5e6) console.error('WARNING: part over 11.5 MB:', file);
}
// HD packs: materials + full-size images only (no meshes), split the same way
{
  const groups = [];
  let g = null;
  for (const id of order) {
    const mine = [...hd.values()].filter(h => h.id === id);
    const b = mine.reduce((a, h) => a + h.buf.byteLength, 0);
    if (!mine.length) continue;
    if (!g || g.bytes + b > PART_MB * 1e6) { g = { ids: [], bytes: 0, items: [] }; groups.push(g); }
    g.ids.push(id); g.bytes += b; g.items.push(...mine);
  }
  const { Document } = await imp('@gltf-transform/core/dist/index.js');
  for (let i = 0; i < groups.length; i++) {
    const d = new Document();
    d.createBuffer();
    d.createScene('hd');
    // one material per character atlas, its slots filled with the full-size images (cast3d.js copies them by name)
    const byMat = {};
    for (const it of groups[i].items) {
      const t = d.createTexture(it.nm).setImage(new Uint8Array(it.buf)).setMimeType('image/webp');
      const m = byMat[it.id] || (byMat[it.id] = d.createMaterial(it.id + '_atlas'));
      if (/_n$/.test(it.nm)) m.setNormalTexture(t); else if (/_e$/.test(it.nm)) m.setEmissiveTexture(t); else if (/_r$/.test(it.nm)) m.setMetallicRoughnessTexture(t); else m.setBaseColorTexture(t);
    }
    d.createExtension(EXTTextureWebP).setRequired(true);
    const file = `cast2_hd_${i}.glb`;
    await io().write(path.join(outDir, file), d);
    const bytes = fs.statSync(path.join(outDir, file)).size;
    manifest.hd.push({ file, ids: groups[i].ids, bytes });
    log(file, (bytes / 1e6).toFixed(2), 'MB');
    if (bytes > 11.5e6) console.error('WARNING: hd pack over 11.5 MB:', file);
  }
}
fs.writeFileSync(path.join(outDir, 'cast2.json'), JSON.stringify(manifest, null, 1));
log('done ->', outDir);
void dedup;
