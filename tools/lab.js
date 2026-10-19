// Human Lab: renders head/body/hair modules under fixed, realistic lighting for review and judging.
// URL params:
//   head=../src/human/head.js  body=../src/human/body.js  hair=../src/human/hair.js
//   view=portrait|profile|threeq|full|lineup|walk|eyes   preset=kai|mira|witness|niko|rook|tala|sera|iven
//   detail=high|medium|low   t=<seconds for walk pose>   bg=studio|city|sunset
//   ref=1  show the owner's reference art (assets/cast/<preset>_ref.png) beside the render (kai, mira, witness, sera)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const q = new URLSearchParams(location.search);
const view = q.get('view') || 'portrait';
const detail = q.get('detail') || 'high';

export const PRESETS = {
  kai: { ref: 'kai', head: { sex: 0, age: 32, skin: 0xc08a64, eyeColor: 0x2e2216, seed: 11, shape: { jaw: 0.45, cheek: 0.35, nose: 0.2, noseWidth: -0.05, lips: -0.05, brow: 0.45, eyeSize: -0.2, faceLength: 0.15, chin: 0.25 }, marks: { stubble: 0.95, wrinkles: 0.15 } },
         hair: { style: 'messy', color: 0x0d0a09, beard: 'stubble', beardColor: 0x14100d },
         body: { height: 1.83, sex: 0, build: 1.05, age: 32, skin: 0xc08a64, outfit: { top: { type: 'jacket', color: 0x1c1d20, material: 'leather', hood: true }, pants: { type: 'trousers', color: 0x2a2c2f }, shoes: { type: 'boots', color: 0x1b1611 }, gloves: 0x1d1a17, belt: 0x2a1d14, strap: true, wristMark: true } } },
  mira: { ref: 'mira', head: { sex: 1, age: 28, skin: 0xe2b394, eyeColor: 0x5a6a72, seed: 22, shape: { jaw: -0.35, cheek: 0.55, nose: -0.1, noseWidth: -0.3, lips: 0.45, brow: -0.3, eyeSize: 0.35, faceLength: 0.05, chin: -0.05 }, marks: { freckles: 0.05 } },
         hair: { style: 'bob', color: 0x140e0b },
         body: { height: 1.69, sex: 1, build: 0.95, age: 30, skin: 0xd9a585, outfit: { top: { type: 'armored', color: 0x1c2026, material: 'leather' }, pants: { type: 'trousers', color: 0x1f2227 }, shoes: { type: 'boots', color: 0x15120f }, belt: 0x1a1612 } } },
  witness: { ref: 'witness', head: { sex: 0, age: 58, skin: 0xb3815f, eyeColor: 0x2e2216, seed: 11, shape: { jaw: 0.45, cheek: 0.25, nose: 0.25, noseWidth: -0.05, lips: -0.25, brow: 0.55, eyeSize: -0.25, faceLength: 0.2, chin: 0.25 }, marks: { scar: true, wrinkles: 0.8 } },
         hair: { style: 'grey-swept', color: 0x9a9690, beard: 'full', beardColor: 0x8a8580 },
         body: { height: 1.81, sex: 0, build: 1.0, age: 58, skin: 0xa77a5d, outfit: { top: { type: 'sweater', color: 0x1e1e1f, material: 'fabric' }, coat: { type: 'long', color: 0x2a2724, material: 'leather' }, pants: { type: 'trousers', color: 0x202020 }, shoes: { type: 'boots', color: 0x141210 }, gloves: 0x111111, wristMark: true } } },
  niko: { head: { sex: 0, age: 19, skin: 0x8c5a3a, eyeColor: 0x2a1a0e, seed: 33, shape: { jaw: -0.1, cheek: 0.3, nose: 0, noseWidth: 0.35, lips: 0.4, brow: 0, eyeSize: 0.1, faceLength: -0.1, chin: 0 }, marks: {} },
         hair: { style: 'short', color: 0x0e0a08 },
         body: { height: 1.68, sex: 0, build: 0.92, age: 19, skin: 0x8c5a3a, outfit: { top: { type: 'tunic', color: 0xcdb48a, material: 'fabric' }, sash: 0x9b3b24, pants: { type: 'wraps', color: 0x7a6248 }, shoes: { type: 'sandals', color: 0x5a3e28 }, bracelets: 0xc9a050 } } },
  rook: { head: { sex: 0, age: 62, skin: 0xd3a487, eyeColor: 0x45566a, seed: 44, shape: { jaw: 0, cheek: -0.2, nose: 0.4, noseWidth: -0.1, lips: -0.4, brow: 0.1, eyeSize: -0.1, faceLength: 0.35, chin: 0.1 }, marks: { wrinkles: 0.85 } },
         hair: { style: 'grey-swept', color: 0xb8b4ae },
         body: { height: 1.78, sex: 0, build: 0.97, age: 62, skin: 0xd3a487, outfit: { top: { type: 'uniform', color: 0x2f3542, material: 'fabric' }, coat: { type: 'lab', color: 0xe8eaec, material: 'fabric' }, pants: { type: 'trousers', color: 0x2a2e36 }, shoes: { type: 'shoes', color: 0x14151a } } } },
  tala: { head: { sex: 1, age: 41, skin: 0x7d4f33, eyeColor: 0x24160c, seed: 55, shape: { jaw: 0, cheek: 0.5, nose: 0.1, noseWidth: 0.3, lips: 0.3, brow: -0.2, eyeSize: 0, faceLength: 0.1, chin: 0 }, marks: { wrinkles: 0.3 } },
         hair: { style: 'bun', color: 0x15100b },
         body: { height: 1.64, sex: 1, build: 1.0, age: 41, skin: 0x7d4f33, outfit: { top: { type: 'tunic', color: 0x3f6a6a, material: 'fabric' }, sash: 0xd0a24a, pants: { type: 'wraps', color: 0x5a4632 }, shoes: { type: 'sandals', color: 0x4a3220 }, bracelets: 0xd9b25c } } },
  sera: { ref: 'sera', head: { sex: 1, age: 34, skin: 0xb07a55, eyeColor: 0x6a7a62, seed: 66, shape: { jaw: 0.15, cheek: 0.4, nose: 0, noseWidth: 0, lips: 0.2, brow: 0.25, eyeSize: 0.05, faceLength: 0.1, chin: 0.15 }, marks: { scar: true, wrinkles: 0.1 } },
         hair: { style: 'tied-back', color: 0x2a1c14 },
         body: { height: 1.72, sex: 1, build: 1.0, age: 34, skin: 0xb07a55, outfit: { top: { type: 'jacket', color: 0x4a3a28, material: 'fabric', hood: true }, vest: { color: 0x3a3a2c }, pants: { type: 'cargo', color: 0x3a3a30 }, shoes: { type: 'boots', color: 0x2a2018 }, strap: true } } },
  iven: { head: { sex: 0, age: 45, skin: 0xe0b394, eyeColor: 0x3a5a2a, seed: 77, shape: { jaw: 0.1, cheek: 0, nose: 0.2, noseWidth: 0.2, lips: 0, brow: 0, eyeSize: 0, faceLength: 0, chin: -0.1 }, marks: { stubble: 0.5, wrinkles: 0.35, freckles: 0.3 } },
         hair: { style: 'short', color: 0x6a3f22, beard: 'stubble' },
         body: { height: 1.76, sex: 0, build: 1.1, age: 45, skin: 0xe0b394, outfit: { top: { type: 'sweater', color: 0x37404a, material: 'fabric' }, vest: { color: 0xd9781e }, pants: { type: 'cargo', color: 0x2c333b }, shoes: { type: 'boots', color: 0x2a2018 }, gloves: 0x5a4a3a } } },
};

async function tryImport(p) { if (!p) return null; try { return await import(p); } catch (e) { console.error('import failed', p, e); document.getElementById('info').textContent += ' [import failed: ' + p + '] '; return null; } }

const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('v').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const bg = q.get('bg') || 'studio';
scene.background = new THREE.Color(bg === 'sunset' ? 0x3a2a24 : bg === 'city' ? 0x0a1018 : 0x14181d);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const key = new THREE.DirectionalLight(bg === 'sunset' ? 0xffc08a : 0xfff0e2, 2.6); key.position.set(1.6, 2.6, 2.4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.01;
Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -0.5, near: 0.1, far: 10 }); scene.add(key);
const rim = new THREE.DirectionalLight(bg === 'city' ? 0x5fe6ff : 0x9fc4ff, 2.2); rim.position.set(-2, 2, -2.5); scene.add(rim);
const fill = new THREE.DirectionalLight(0xffd2b0, 0.5); fill.position.set(-2, 1, 2); scene.add(fill);
const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.7 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const headMod = await tryImport(q.get('head'));
const bodyMod = await tryImport(q.get('body'));
const hairMod = await tryImport(q.get('hair'));

function fallbackHead() { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), new THREE.MeshStandardMaterial({ color: 0x888888 })); m.position.y = 0.09; g.add(m); return { group: g, setGaze() {}, setBlink() {}, setMouth() {}, setSmile() {}, update() {}, landmarks: { eyeL: new THREE.Vector3(0.032, 0.085, 0.075), eyeR: new THREE.Vector3(-0.032, 0.085, 0.075) }, scalp: { geometry: m.geometry, center: new THREE.Vector3(0, 0.09, 0), radius: 0.1 } }; }

function build(presetName) {
  const P = PRESETS[presetName] || PRESETS.kai;
  const t0 = performance.now();
  const head = headMod?.createHead ? headMod.createHead({ ...P.head, detail }) : fallbackHead();
  if (hairMod?.createHair) head.group.add(hairMod.createHair({ ...P.hair, detail }, head));
  let body = null, root = new THREE.Group();
  if (bodyMod?.createBody) {
    body = bodyMod.createBody({ ...P.body, detail });
    root.add(body.root); body.bones.head.add(head.group);
  } else {
    const s = P.body.height / 1.8; head.group.position.y = 1.60 * s; root.add(head.group);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 16), new THREE.MeshStandardMaterial({ color: P.head.skin })); neck.position.y = 1.52 * s; root.add(neck);
  }
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { head, body, root, ms: performance.now() - t0, P };
}

const presetName = q.get('preset') || 'kai';
const cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 50);
const actors = [];
if (view === 'lineup') {
  const names = ['kai', 'mira', 'witness', 'niko', 'rook', 'tala', 'sera', 'iven'];
  names.forEach((n, i) => { const a = build(n); a.root.position.x = (i - (names.length - 1) / 2) * 0.62; a.root.rotation.y = 0.15; scene.add(a.root); actors.push(a); });
  cam.fov = 26; cam.position.set(0, 1.25, 8.6); cam.lookAt(0, 0.95, 0);
} else {
  const a = build(presetName); scene.add(a.root); actors.push(a);
  const hp = new THREE.Vector3();
  a.root.updateMatrixWorld(true); a.head.group.getWorldPosition(hp);
  const eye = hp.clone().add(new THREE.Vector3(0, 0.08, 0));
  if (view === 'portrait') { cam.fov = 22; cam.position.set(eye.x + 0.18, eye.y + 0.02, eye.z + 0.95); cam.lookAt(eye.x, eye.y - 0.015, eye.z); }
  if (view === 'threeq') { cam.fov = 22; cam.position.set(eye.x + 0.62, eye.y + 0.05, eye.z + 0.72); cam.lookAt(eye.x, eye.y - 0.01, eye.z); }
  if (view === 'profile') { cam.fov = 22; cam.position.set(eye.x + 0.95, eye.y, eye.z + 0.02); cam.lookAt(eye.x, eye.y - 0.01, eye.z + 0.02); }
  if (view === 'eyes') { cam.fov = 12; cam.position.set(eye.x + 0.05, eye.y + 0.01, eye.z + 0.55); cam.lookAt(eye.x, eye.y, eye.z + 0.05); }
  if (view === 'full' || view === 'walk') { cam.fov = 28; const h = a.P.body.height; cam.position.set(1.3, h * 0.62, 3.6); cam.lookAt(0, h * 0.5, 0); }
  a.head.setGaze?.(cam.position);
}

// simple procedural walk on the contract skeleton for deformation checks
function pose(a, t) {
  const b = a.body?.bones; if (!b) return;
  const p = t * 6.5, A = 1;
  b.thighL.rotation.x = -Math.sin(p) * 0.55 * A; b.thighR.rotation.x = Math.sin(p) * 0.55 * A;
  b.shinL.rotation.x = Math.max(0, -Math.cos(p)) * 1.0 + 0.05; b.shinR.rotation.x = Math.max(0, Math.cos(p)) * 1.0 + 0.05;
  b.upperArmL.rotation.x = Math.sin(p) * 0.5; b.upperArmR.rotation.x = -Math.sin(p) * 0.5;
  b.forearmL.rotation.x = -0.45; b.forearmR.rotation.x = -0.45;
  b.spine.rotation.y = Math.sin(p) * 0.08;
}
if (q.get('ref') !== null && actors.length === 1 && actors[0].P.ref) { cam.setViewOffset(W, H, W / 4, 0, W, H); }
const T = parseFloat(q.get('t') || '0.35');
for (const a of actors) { if (view === 'walk') pose(a, T); a.head.setBlink?.(parseFloat(q.get('blink') || '0')); a.head.setMouth?.(parseFloat(q.get('mouth') || '0')); a.head.update?.(0.016); }
scene.updateMatrixWorld(true);
renderer.render(scene, cam);
const info = renderer.info.render;
window.LAB_INFO = { triangles: info.triangles, calls: info.calls, buildMs: actors.map(a => Math.round(a.ms)) };
document.getElementById('info').textContent += ` ${view} ${presetName} tris=${info.triangles} calls=${info.calls} build=${window.LAB_INFO.buildMs.join(',')}ms`;
const refName = q.get('ref') !== null && actors.length === 1 ? (actors[0].P.ref || null) : null;
if (refName) {
  const im = new Image(); im.src = '../assets/cast/' + refName + '_ref.png';
  Object.assign(im.style, { position: 'fixed', right: '0', top: '0', height: '100%', maxWidth: '50%', objectFit: 'cover', borderLeft: '2px solid #333' });
  document.body.appendChild(im);
  await new Promise(r => { im.onload = r; im.onerror = r; });
}
window.LAB_DONE = true;
