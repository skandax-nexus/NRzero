// simplify_cast.mjs IN.glb OUT.glb: land every character of a raw cast on its triangle budget (docs/COSTUMES.md,
// "Mobile budgets") and emit the crowd low LOD.
//
// The generator's own decimation (build_humans.decimate_protected) keeps floors on the body, face and hands so its
// collapse never tears cloth; this pass finishes the job with meshoptimizer's attribute-aware simplifier:
// - open borders (hems, cuffs, hairline, the hair shell edge) are locked; uv seams are kept by meshopt's seam
//   handling (split vertices with one position), so no hole opens and no triangle spans two atlas islands;
// - the error metric sees the normal, the uv (texture), the shading mask (skin / gloss / hair) and a 6-d embedding
//   of the skin weights, so collapses that would slide the texture, smear skin onto cloth or bend wrongly at a joint
//   cost more than collapses on plain cloth;
// - only the atlas mesh (`<id>_mesh`) is simplified; glow (gx_) and hand props (gp_) are counted in the budget;
// - the armature root's extras carry `tris_budget` (and `lod_tris` for crowds and children): a second index list
//   simplified from the first one becomes `<id>_lod` (same vertex buffers, only a new index buffer; hidden; extras
//   lod=1). The runtime swaps it in at distance (cast3d.js setLOD).
// Prints one line per character: before -> after triangles, the meshopt error (relative to the mesh extent), the LOD.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MODS = process.env.GT_MODS;      // node_modules dir holding @gltf-transform/* and meshoptimizer (compress_cast.sh finds it)
const imp = p => import(pathToFileURL(path.join(MODS, p)).href);
const { NodeIO } = await imp('@gltf-transform/core/dist/index.js');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions/dist/index.js');
const { reorder, quantize, prune } = await imp('@gltf-transform/functions/dist/index.js');
const { MeshoptSimplifier, MeshoptEncoder } = await imp('meshoptimizer/index.js');
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;

const PACK = process.argv[2] === '--pack';
const [inp, out] = process.argv.slice(PACK ? 3 : 2);
const MAXERR = +(process.env.SIMPLIFY_ERR || 0.03);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inp);
const root = doc.getRoot();
if (PACK) {
  // `--pack`: the CLI's `meshopt --level high` minus its reorder step (reorder would un-share the LOD's vertex buffers;
  // the vertex order was already optimised before the LODs were added)
  const { EXTMeshoptCompression } = await imp('@gltf-transform/extensions/dist/index.js');
  await doc.transform(prune(), quantize({ pattern: /^(POSITION|TEXCOORD|JOINTS|WEIGHTS|COLOR)(_\d+)?$/, patternTargets: /^(POSITION|TEXCOORD|JOINTS|WEIGHTS|COLOR|NORMAL|TANGENT)(_\d+)?$/,
    quantizePosition: +(process.env.QPOS || 14), quantizeTexcoord: 12, quantizeNormal: 8, quantizeColor: 8, quantizeWeight: 8, quantizeGeneric: 12 }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write(out, doc);
  process.exit(0);
}

// bone embedding: each joint index -> a fixed pseudo-random unit vector in R^6 (weights blend linearly in it)
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

function attrsOf(prim) {
  const n = prim.getAttribute('POSITION').getCount();
  const nor = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0'), mk = prim.getAttribute('_MASK') || prim.getAttribute('_mask');
  const jo = prim.getAttribute('JOINTS_0'), we = prim.getAttribute('WEIGHTS_0');
  const N = nor && floats(nor), U = uv && floats(uv), K = mk && floats(mk), J = jo && jo.getArray(), Wt = we && floats(we);
  const S = 3 + 2 + 3 + 6, A = new Float32Array(n * S);
  for (let i = 0; i < n; i++) {
    const o = i * S;
    if (N) { A[o] = N[i * 3]; A[o + 1] = N[i * 3 + 1]; A[o + 2] = N[i * 3 + 2]; }
    if (U) { A[o + 3] = U[i * 2]; A[o + 4] = U[i * 2 + 1]; }
    if (K) { const ks = mk.getElementSize(); for (let k = 0; k < Math.min(3, ks); k++) A[o + 5 + k] = K[i * ks + k]; }
    if (J && Wt) for (let k = 0; k < 4; k++) { const w = Wt[i * 4 + k]; if (!w) continue; const e = EMB[J[i * 4 + k] & 255]; for (let d = 0; d < 6; d++) A[o + 8 + d] += w * e[d]; }
  }
  // normal 0.6, uv 4 (atlas space: a 1/256 slide is 4 texels on a 1024 map), mask 1.5, skin weights 1.2
  return { A, S, W: [0.6, 0.6, 0.6, 4, 4, 1.5, 1.5, 1.5, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2] };
}

function compact(prim, idx) {
  // keep only the vertices the new index list uses (every attribute accessor rewritten, same types)
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

function simplify(prim, target, lockBorder = true) {
  const pos = floats(prim.getAttribute('POSITION'));
  const idx = new Uint32Array(prim.getIndices().getArray());
  const { A, S, W } = attrsOf(prim);
  const [res, err] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, A, S, W, null, Math.floor(target) * 3, MAXERR, lockBorder ? ['LockBorder'] : []);
  return { idx: res, err };
}

const FALLBACK = process.env.BUDGETS ? JSON.parse(fs.readFileSync(process.env.BUDGETS, 'utf8')) : {};   // older raw files: {id: [budget, lod]}
const report = [];
for (const scene of root.listScenes()) for (const top of scene.listChildren()) {
  const ex = top.getExtras() || {}, id = ex.character || top.getName();
  const budget = +ex.tris_budget || (FALLBACK[id] || [])[0] || 0;
  let atlas = null, total = 0;
  walk(top, n => { total += meshTris(n); if (n.getMesh() && n.getName() === id + '_mesh') atlas = n; });
  if (!atlas || !budget) { report.push(`${id}: ${total} tris (no budget)`); continue; }
  const prim = atlas.getMesh().listPrimitives()[0], before = total, mine = tris(prim);
  const target = budget - (total - mine);
  let err = 0, unlocked = false;
  if (mine > target) {
    const r = simplify(prim, target);
    err = r.err; compact(prim, r.idx);
    if (tris(prim) > target * 1.02) {     // the locked borders stopped it short: let the borders go too (still seam-safe)
      const r2 = simplify(prim, target, false); err = r2.err; compact(prim, r2.idx); unlocked = true;
    }
  }
  total = 0; walk(top, n => { total += meshTris(n); });
  report.push([top, id, atlas, prim, before, total, budget, err, unlocked]);
}
// vertex cache / fetch order now, before the LODs share LOD0's vertex buffers (reorder would duplicate shared ones)
await doc.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }));
for (let i = 0; i < report.length; i++) {
  if (typeof report[i] === 'string') continue;
  const [top, id, atlas, prim, before, total, budget, err, unlocked] = report[i];
  const ex = top.getExtras() || {};
  let lod = '';
  const lodT = +ex.lod_tris || (FALLBACK[id] || [])[1] || 0;
  if (lodT && tris(prim) > lodT) {
    const r = simplify(prim, lodT);
    let li = r.idx;
    if (li.length / 3 > lodT * 1.05) li = simplify(prim, lodT, false).idx;
    const lp = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
    for (const sem of prim.listSemantics()) lp.setAttribute(sem, prim.getAttribute(sem));      // shared vertex buffers
    const ia = li.length && Math.max(...li) > 65535 ? new Uint32Array(li) : new Uint16Array(li);
    lp.setIndices(doc.createAccessor().setType('SCALAR').setArray(ia).setBuffer(prim.getIndices().getBuffer()));
    const lm = doc.createMesh(id + '_lod').addPrimitive(lp);
    const ln = doc.createNode(id + '_lod').setMesh(lm).setSkin(atlas.getSkin()).setExtras({ lod: 1 })
      .setTranslation(atlas.getTranslation()).setRotation(atlas.getRotation()).setScale(atlas.getScale());
    const par = atlas.getParentNode(); (par || top).addChild(ln);
    lod = ` lod ${li.length / 3}`;
  }
  report[i] = `${id}: ${before} -> ${total} tris (budget ${budget}, err ${err.toFixed(4)}${unlocked ? ', borders unlocked' : ''})${lod}`;
}
await io.write(out, doc);
console.log(report.join('\n'));
