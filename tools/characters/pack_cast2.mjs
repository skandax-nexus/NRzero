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
// Needs GT_MODS (node_modules dir with @gltf-transform/* , meshoptimizer and sharp; compress_cast.sh finds it).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
function simplify(prim, target, jointNames, lockBorder = true) {
  const p = floats(prim.getAttribute('POSITION'));
  const idx = new Uint32Array(prim.getIndices().getArray());
  const { A, S, W } = attrsOf(prim, jointNames);
  const [res, err] = MeshoptSimplifier.simplifyWithAttributes(idx, p, 3, A, S, W, null, Math.floor(target) * 3, MAXERR, lockBorder ? ['LockBorder'] : []);
  return { idx: res, err };
}
const report = [];
const charInfo = {};
for (const scene of root.listScenes()) for (const top of scene.listChildren()) {
  const ex = top.getExtras() || {}, id = ex.character || top.getName();
  const budget = +ex.tris_budget || 0;
  let atlas = null, total = 0, cards = 0;
  walk(top, n => { const t = meshTris(n); if (/^gh_/.test(n.getName())) cards += t; else total += t; if (n.getMesh() && n.getName() === id + '_mesh') atlas = n; });
  if (!atlas || !budget) { report.push(`${id}: ${total} tris (no budget)`); continue; }
  const skin = atlas.getSkin(), jointNames = skin ? skin.listJoints().map(j => j.getName()) : [];
  const prim = atlas.getMesh().listPrimitives()[0], before = total, mine = tris(prim);
  const target = budget - (total - mine);
  let err = 0, unlocked = false;
  if (mine > target) {
    const r = simplify(prim, target, jointNames); err = r.err; compact(prim, r.idx);
    if (tris(prim) > target * 1.02) { const r2 = simplify(prim, target, jointNames, false); err = r2.err; compact(prim, r2.idx); unlocked = true; }
  }
  total = 0; walk(top, n => { if (!/^gh_/.test(n.getName())) total += meshTris(n); });
  report.push([top, id, atlas, prim, before, total, budget, err, unlocked, jointNames, cards]);
}
await doc.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }));
for (let i = 0; i < report.length; i++) {
  if (typeof report[i] === 'string') continue;
  const [top, id, atlas, prim, before, total, budget, err, unlocked, jointNames, cards] = report[i];
  const ex = top.getExtras() || {};
  let lod = '';
  const lodT = +ex.lod_tris || 0;
  if (lodT && tris(prim) > lodT) {
    const r = simplify(prim, lodT, jointNames);
    let li = r.idx;
    if (li.length / 3 > lodT * 1.05) li = simplify(prim, lodT, jointNames, false).idx;
    const lp = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
    for (const sem of prim.listSemantics()) lp.setAttribute(sem, prim.getAttribute(sem));
    const ia = li.length && Math.max(...li) > 65535 ? new Uint32Array(li) : new Uint16Array(li);
    lp.setIndices(doc.createAccessor().setType('SCALAR').setArray(ia).setBuffer(prim.getIndices().getBuffer()));
    const lm = doc.createMesh(id + '_lod').addPrimitive(lp);
    const ln = doc.createNode(id + '_lod').setMesh(lm).setSkin(atlas.getSkin()).setExtras({ lod: 1 })
      .setTranslation(atlas.getTranslation()).setRotation(atlas.getRotation()).setScale(atlas.getScale());
    const par = atlas.getParentNode(); (par || top).addChild(ln);
    lod = ` lod ${li.length / 3}`;
  }
  charInfo[id] = { tris: total, cards, budget };
  report[i] = `${id}: ${before} -> ${total} tris (budget ${budget}, err ${err.toFixed(4)}${unlocked ? ', borders unlocked' : ''})${lod}, cards ${cards}`;
}
log('simplified\n' + report.join('\n'));

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
const hd = new Map();    // texture name -> { id, slot, webp buffer (full size) }
const enc = async (buf, size, q, alpha) => {
  let s = sharp(buf);
  if (size) s = s.resize(size, size, { kernel: 'lanczos3' });
  return s.webp({ quality: q, alphaQuality: alpha ? 90 : 100, effort: 5, smartSubsample: true }).toBuffer();
};
for (const t of root.listTextures()) {
  const id = texOwner.get(t); if (!id) continue;
  const img = t.getImage(); if (!img) continue;
  const meta = await sharp(Buffer.from(img)).metadata();
  const W = meta.width, nm = t.getName() || '';
  const isN = /_n$/.test(nm), isE = /_e$/.test(nm), isS = id === '*strands';
  if (isS) {          // the strand texture: the same in every part (alpha), 1024 everywhere
    t.setImage(new Uint8Array(await enc(Buffer.from(img), null, 88, true))).setMimeType('image/webp');
    continue;
  }
  const phone = HERO.has(id) ? Math.min(W, 1024) : Math.min(W, 512);
  const hq = isN ? 90 : isE ? 80 : 88;
  if (phone < W) hd.set(nm, { id, nm, buf: await enc(Buffer.from(img), null, hq, false) });
  t.setImage(new Uint8Array(await enc(Buffer.from(img), phone < W ? phone : null, isN ? 86 : isE ? 75 : 84, false))).setMimeType('image/webp');
}
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
