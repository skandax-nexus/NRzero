// Authors our own extra animation clips (docs/MOTION.md, "Locomotion & secondary motion") and writes them to
// assets/models/anims_extra.glb. Nothing here comes from the internet, and assets/models/anims.glb (the owner's motion
// capture) is only READ: its rig (node names, rest pose) is copied so the new clips retarget onto every cast body
// exactly like the owner's clips, and its idle clip gives the neutral base pose the keyframes are set on.
//
// The clips are keyframed by hand as joint angles (degrees) on top of that base pose, every rotation about the body's
// own axes (x = across the body, z = forward); the keys are eased (smoothstep) and sampled at 20 fps.
//   jump      standing jump, sampled by the vertical speed (0 = take-off, 0.5 = apex tuck, 1 = legs reaching down)
//   jump_run  running jump (a stride in the air: lead knee up, trail leg behind), same phase convention
// Both are "air" clips (az_clips.<name>.air = true): cast3d.js does not pull their soles to the floor when it
// retargets, and locomotion.js picks the phase from the vertical speed and blends the two by ground speed.
//   node tools/feel/author_clips.mjs [out.glb]            (default assets/models/anims_extra.glb)
import fs from 'fs'; import path from 'path'; import url from 'url';
const R = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const THREE = await import(path.join(R, 'vendor/three.module.min.js'));
const { MeshoptDecoder } = await import(path.join(R, 'vendor/addons/libs/meshopt_decoder.module.js'));
const OUT = process.argv[2] || path.join(R, 'assets/models/anims_extra.glb');
if (/anims\.glb$/.test(OUT)) throw new Error('never overwrite the owner\'s anims.glb');

// ---------------- read anims.glb (read only) ----------------
await MeshoptDecoder.ready;
const glb = fs.readFileSync(path.join(R, 'assets/models/anims.glb'));
const jlen = glb.readUInt32LE(12), J = JSON.parse(glb.slice(20, 20 + jlen).toString());
const binStart = 20 + jlen + 8, BIN = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jlen));
const views = J.bufferViews.map(v => {
  const ext = v.extensions && v.extensions.EXT_meshopt_compression;
  if (!ext) return BIN.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  const out = new Uint8Array(ext.count * ext.byteStride), src = BIN.subarray(ext.byteOffset || 0, (ext.byteOffset || 0) + ext.byteLength);
  MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, src, ext.mode, ext.filter);
  return out;
});
const NC = { SCALAR: 1, VEC3: 3, VEC4: 4 };
function accessor(i) {
  const a = J.accessors[i], n = NC[a.type], v = views[a.bufferView], bv = J.bufferViews[a.bufferView];
  const T = { 5126: Float32Array, 5122: Int16Array, 5120: Int8Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
  const stride = (bv.byteStride || (bv.extensions && bv.extensions.EXT_meshopt_compression && bv.extensions.EXT_meshopt_compression.byteStride) || n * T.BYTES_PER_ELEMENT);
  const out = new Float32Array(a.count * n), dv = new DataView(v.buffer, v.byteOffset, v.byteLength);
  const get = { 5126: (o) => dv.getFloat32(o, true), 5122: (o) => dv.getInt16(o, true), 5120: (o) => dv.getInt8(o), 5123: (o) => dv.getUint16(o, true), 5121: (o) => dv.getUint8(o) }[a.componentType];
  const norm = a.normalized ? { 5122: 32767, 5120: 127, 5123: 65535, 5121: 255 }[a.componentType] : 1;
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) { const x = get((a.byteOffset || 0) + i * stride + k * T.BYTES_PER_ELEMENT); out[i * n + k] = norm === 1 ? x : Math.max(-1, x / norm); }
  return out;
}
// the rig as THREE objects
const nodes = J.nodes.map(n => { const o = new THREE.Object3D(); o.name = n.name; if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); return o; });
J.nodes.forEach((n, i) => (n.children || []).forEach(c => nodes[i].add(nodes[c])));
const rig = nodes[J.scenes[J.scene || 0].nodes[0]];
const B = {}; nodes.forEach(o => { B[o.name] = o; });
const idleA = J.animations.find(a => a.name === 'idle');
const tracks = idleA.channels.map(ch => {
  const s = idleA.samplers[ch.sampler], nm = J.nodes[ch.target.node].name;
  const t = accessor(s.input), v = accessor(s.output);
  if (ch.target.path === 'rotation') return new THREE.QuaternionKeyframeTrack(nm + '.quaternion', t, v);
  if (ch.target.path === 'translation') return new THREE.VectorKeyframeTrack(nm + '.position', t, v);
  return new THREE.VectorKeyframeTrack(nm + '.scale', t, v);
});
const mixer = new THREE.AnimationMixer(rig);
mixer.clipAction(new THREE.AnimationClip('idle', -1, tracks)).play();
mixer.setTime(0.4); rig.updateMatrixWorld(true);
const BONES = J.nodes.map(n => n.name).filter(n => n !== rig.name);
const base = {}; for (const k of BONES) base[k] = { q: B[k].quaternion.clone(), p: B[k].position.clone() };
mixer.stopAllAction();

// ---------------- posing helpers (world space, about the body's axes) ----------------
const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _p = new THREE.Quaternion();
const D = Math.PI / 180;
function rotW(name, axis, deg) {
  const b = B[name]; if (!b || !deg) return;
  b.getWorldQuaternion(_q); _q.premultiply(_p.setFromAxisAngle(axis, deg * D));
  b.parent.getWorldQuaternion(_p).invert(); b.quaternion.copy(_p.multiply(_q)); b.updateMatrixWorld(true);
}
// k: { thigh:[L,R] forward swing, knee:[L,R] flexion, foot:[L,R] plantar flexion (toes down), spine, chest (forward
// lean), arm:[L,R] forward raise, elbow:[L,R] flexion, abd:[L,R] arm out to the side, head (down), twist (chest yaw) }
function pose(k) {
  for (const n of BONES) { B[n].quaternion.copy(base[n].q); B[n].position.copy(base[n].p); }
  rig.updateMatrixWorld(true);
  rotW('spine', X, k.spine || 0); rotW('chest', X, k.chest || 0); rotW('chest', Y, k.twist || 0);
  rotW('neck', X, (k.head || 0) * 0.4); rotW('head', X, (k.head || 0) * 0.6);
  ['L', 'R'].forEach((s, i) => {
    rotW('thigh_' + s, X, -(k.thigh ? k.thigh[i] : 0));
    rotW('shin_' + s, X, k.knee ? k.knee[i] : 0);
    rotW('foot_' + s, X, k.foot ? k.foot[i] : 0);
    rotW('upperarm_' + s, Z, (i ? -1 : 1) * (k.abd ? k.abd[i] : 0));
    rotW('upperarm_' + s, X, -(k.arm ? k.arm[i] : 0));
    rotW('forearm_' + s, X, -(k.elbow ? k.elbow[i] : 0));
  });
  const out = {}; for (const n of BONES) out[n] = B[n].quaternion.clone();
  out._hips = B.hips.position.clone();
  return out;
}

// ---------------- the clips (keys at phase 0, 0.25, 0.5, 0.75, 1) ----------------
const CLIPS = {
  jump: [
    { t: 0.0, thigh: [6, -4], knee: [6, 8], foot: [38, 32], spine: 4, arm: [48, 42], elbow: [24, 28], abd: [12, 12], head: -6 },
    { t: 0.25, thigh: [26, 16], knee: [36, 30], foot: [22, 16], spine: 8, arm: [30, 26], elbow: [32, 34], abd: [18, 18], head: -2 },
    { t: 0.5, thigh: [50, 40], knee: [74, 68], foot: [6, 4], spine: 14, chest: 4, arm: [16, 12], elbow: [38, 36], abd: [24, 26], head: 4 },
    { t: 0.75, thigh: [34, 26], knee: [46, 40], foot: [2, 0], spine: 10, chest: 2, arm: [12, 10], elbow: [30, 28], abd: [30, 30], head: 6 },
    { t: 1.0, thigh: [20, 12], knee: [24, 20], foot: [8, 6], spine: 6, arm: [16, 14], elbow: [26, 24], abd: [32, 30], head: 6 },
  ],
  jump_run: [
    { t: 0.0, thigh: [64, -24], knee: [92, 26], foot: [2, 36], spine: 10, arm: [-34, 52], elbow: [40, 72], abd: [8, 8], head: -4, twist: -6 },
    { t: 0.5, thigh: [56, -8], knee: [72, 62], foot: [4, 22], spine: 12, chest: 2, arm: [-14, 36], elbow: [42, 62], abd: [18, 18], head: 2, twist: -4 },
    { t: 1.0, thigh: [40, 20], knee: [26, 56], foot: [-4, 6], spine: 8, arm: [10, 22], elbow: [44, 50], abd: [26, 24], head: 6, twist: -2 },
  ],
};
const FPS = 20, DUR = 1.0;
const ease = x => x * x * (3 - 2 * x);
const anims = [];
for (const name in CLIPS) {
  const keys = CLIPS[name].map(k => ({ t: k.t, P: pose(k) }));
  const n = Math.round(DUR * FPS) + 1, times = new Float32Array(n);
  const rot = {}; for (const b of BONES) rot[b] = new Float32Array(n * 4);
  const hip = new Float32Array(n * 3);
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) * DUR; times[i] = t;
    let j = 0; while (j < keys.length - 2 && t > keys[j + 1].t) j++;
    const a = keys[j], b = keys[j + 1], u = ease(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
    for (const bn of BONES) { q.copy(a.P[bn]).slerp(b.P[bn], u); if (i && q.dot(new THREE.Quaternion().fromArray(rot[bn], (i - 1) * 4)) < 0) { q.x = -q.x; q.y = -q.y; q.z = -q.z; q.w = -q.w; } q.toArray(rot[bn], i * 4); }
    new THREE.Vector3().lerpVectors(a.P._hips, b.P._hips, u).toArray(hip, i * 3);
  }
  anims.push({ name, times, rot, hip });
}

// ---------------- write anims_extra.glb: the same rig (names, rest pose) + our clips ----------------
const chunks = []; let off = 0;
const out = { asset: { version: '2.0', generator: 'AFTERZERO tools/feel/author_clips.mjs' }, scene: 0, scenes: [{ name: 'Scene', nodes: [] }], nodes: [], buffers: [], bufferViews: [], accessors: [], animations: [] };
const idx = new Map(); J.nodes.forEach((n, i) => idx.set(n.name, i));
J.nodes.forEach(n => {
  const o = { name: n.name };
  for (const k of ['translation', 'rotation', 'scale', 'children']) if (n[k]) o[k] = n[k];
  out.nodes.push(o);
});
out.scenes[0].nodes = J.scenes[J.scene || 0].nodes.slice();
const meta = { fps: FPS, authored: 'tools/feel/author_clips.mjs (keyframed joint angles on the idle base pose; ours, not motion capture)', clips: {} };
for (const a of anims) meta.clips[a.name] = { air: true, duration: DUR, phase: 'vertical speed: 0 take-off, 0.5 apex, 1 reaching for the ground', frames: a.times.length };
out.nodes[idx.get(rig.name)].extras = { az_clips: JSON.stringify(meta) };
function addAcc(arr, type) {
  const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
  out.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length }); chunks.push(buf); off += buf.length;
  const acc = { bufferView: out.bufferViews.length - 1, componentType: 5126, count: arr.length / NC[type], type };
  if (type === 'SCALAR') { acc.min = [arr[0]]; acc.max = [arr[arr.length - 1]]; }
  out.accessors.push(acc); return out.accessors.length - 1;
}
for (const a of anims) {
  const A = { name: a.name, channels: [], samplers: [] }, ti = addAcc(a.times, 'SCALAR');
  for (const bn of BONES) { A.samplers.push({ input: ti, output: addAcc(a.rot[bn], 'VEC4'), interpolation: 'LINEAR' }); A.channels.push({ sampler: A.samplers.length - 1, target: { node: idx.get(bn), path: 'rotation' } }); }
  A.samplers.push({ input: ti, output: addAcc(a.hip, 'VEC3'), interpolation: 'LINEAR' }); A.channels.push({ sampler: A.samplers.length - 1, target: { node: idx.get('hips'), path: 'translation' } });
  out.animations.push(A);
}
let bin = Buffer.concat(chunks); const bpad = (4 - (bin.length % 4)) % 4; if (bpad) bin = Buffer.concat([bin, Buffer.alloc(bpad)]);
out.buffers.push({ byteLength: bin.length });
let js = Buffer.from(JSON.stringify(out)); const jpad = (4 - (js.length % 4)) % 4; if (jpad) js = Buffer.concat([js, Buffer.alloc(jpad, 0x20)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004E4942, 4);
fs.writeFileSync(OUT, Buffer.concat([head, jh, js, bh, bin]));
console.log('wrote', OUT, anims.map(a => a.name).join(', '), fs.statSync(OUT).size, 'bytes');
