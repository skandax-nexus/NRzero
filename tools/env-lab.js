// Environment Lab: renders the realism kit (src/world/realism.js) in four reference places for review.
// URL params:
//   scene=street|interior|ruins|valley|swatches   quality=low|medium|high   view=0|1 (camera)
//   t=<seconds of animation>   bloom=0|1   orbit=1 (interactive)
// Sets window.LAB_INFO { triangles, calls, buildMs, ... } and window.LAB_DONE after the final frame.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as RZ from '../src/world/realism.js';

const q = new URLSearchParams(location.search);
const sceneName = q.get('scene') || 'street';
const quality = q.get('quality') || 'high';
const view = +(q.get('view') || 0);
const W = window.innerWidth, H = window.innerHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = quality !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('v').appendChild(renderer.domElement);
RZ.init(renderer, { quality, comfort: q.get('comfort') !== '0' });

const camera = new THREE.PerspectiveCamera(58, W / H, 0.08, 2500);
const timings = {};
function timed(name, fn) { const t = performance.now(); const r = fn(); timings[name] = Math.round(performance.now() - t); return r; }

// ------------------------------------------------------------------------------------------------
// swatches: every procedural surface on a sphere + a box under a day sky (kit QA view)
// ------------------------------------------------------------------------------------------------
function swatches() {
  const scene = new THREE.Scene();
  const sky = timed('sky', () => RZ.skyEnvironment(renderer, scene, { preset: q.get('sky') || 'day' }));
  sky.addSun(scene, { shadow: true, area: 12 });
  const names = RZ.SURFACES;
  const cols = 7;
  names.forEach((n, i) => {
    const x = (i % cols - (cols - 1) / 2) * 1.5, z = -Math.floor(i / cols) * 1.7;
    const mat = timed('tex:' + n, () => RZ.pbrMaterial(n, { mapping: 'object', scale: n === 'rock' || n === 'wetAsphalt' ? 0.25 : 1 }));
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 24), mat); s.position.set(x, 0.5, z); s.castShadow = s.receiveShadow = true; scene.add(s);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.2), mat); b.position.set(x, 0.04, z); b.receiveShadow = true; scene.add(b);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), RZ.pbrMaterial('concrete', { mapping: 'world', params: { slabs: 1 } }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  if (q.get('close')) { camera.position.set(2, 0.9, 2.2); camera.lookAt(3, 0, -0.5); } else { camera.position.set(0, 4.2, 4.6); camera.lookAt(0, 0, -1.8); }
  return { scene, exposure: 1, bloom: [0.3, 0.4, 0.95] };
}

// ------------------------------------------------------------------------------------------------
// sky: horizon panorama with probe spheres (chrome / white / grey) to judge sky + IBL balance
// ------------------------------------------------------------------------------------------------
function skyView() {
  const scene = new THREE.Scene();
  const over = {}; for (const k of ['turbidity', 'ms', 'gain', 'elevation', 'azimuth', 'cover', 'glowIntensity']) if (q.has(k)) over[k] = +q.get(k);
  const sky = timed('sky', () => RZ.skyEnvironment(renderer, scene, { preset: q.get('sky') || 'day', ...over }));
  sky.addSun(scene, { shadow: true, area: 6 });
  const mats = [new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.02 }), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.4 })];
  mats.forEach((m, i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 24), m); s.position.set((i - 1) * 1.3, 1.0, -4); s.castShadow = true; scene.add(s); });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const yaw = THREE.MathUtils.degToRad(+(q.get('yaw') ?? (sky.sunDirection ? THREE.MathUtils.radToDeg(Math.atan2(sky.sunDirection.x, sky.sunDirection.z)) + 180 : 0)));
  camera.fov = +(q.get('fov') || 75);
  camera.position.set(0, 1.6, 0); camera.lookAt(-Math.sin(yaw) * 10, 1.6 + +(q.get('pitch') || 2.5), -Math.cos(yaw) * 10);
  window.SKY = sky; console.log('sky fog', sky.fogColor.getHexString(), 'sunI', sky.sunIntensity.toFixed(2), 'sunC', sky.sunColor.getHexString(), 'amb', sky.ambient.toArray().map(v => v.toFixed(3)).join(','));
  return { scene, exposure: 1, bloom: [0.4, 0.5, 0.95] };
}

// ------------------------------------------------------------------------------------------------
// shared prop helpers for the lab scenes (simple, built from kit materials)
// ------------------------------------------------------------------------------------------------
const metalDark = () => RZ.pbrMaterial('paintedMetalPanel', { mapping: 'object', params: { color: 0x1d2024, cols: 1, rows: 1, wear: 0.35, grime: 0.6, gloss: 0.5 } });
function streetLamp(scene, x, z, side, mat, glowColor = 0xffd9a8) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 6.4, 10), mat); pole.position.y = 3.2; g.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.5, 10), mat); base.position.y = 0.25; g.add(base);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.1), mat); arm.position.set(-side * 0.7, 6.3, 0); g.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.14, 0.32), mat); head.position.set(-side * 1.35, 6.22, 0); g.add(head);
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.02, 0.24), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: glowColor, emissiveIntensity: 9 }));
  lens.position.set(-side * 1.35, 6.14, 0); g.add(lens);
  g.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
  g.position.set(x, 0.16, z); scene.add(g);
  return new THREE.Vector3(x - side * 1.35, 6.1, z);
}
function neonSign(text, color, w, h) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.font = `700 ${Math.round(c.height * 0.55)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 14; g.fillStyle = color; g.fillText(text, c.width / 2, c.height / 2);
  g.shadowBlur = 3; g.fillStyle = '#fff'; g.globalAlpha = 0.65; g.fillText(text, c.width / 2, c.height / 2);
  g.globalAlpha = 1; g.strokeStyle = color; g.lineWidth = 6; g.shadowBlur = 10; g.strokeRect(8, 8, c.width - 16, c.height - 16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const box = new THREE.Group();
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.12), new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.4, metalness: 0.6 })); back.position.z = -0.07; box.add(back);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(3.2, 3.2, 3.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  box.add(face);
  return box;
}

// ------------------------------------------------------------------------------------------------
// street: a short wet night street, interior-mapped facades, captured + box-projected reflections
// ------------------------------------------------------------------------------------------------
function street() {
  const scene = new THREE.Scene();
  const sky = timed('sky', () => RZ.skyEnvironment(renderer, scene, { preset: 'night-city' }));
  const L = 90, zc = -30;
  // ground: road, sidewalks, curbs, paint
  const road = timed('tex:asphalt', () => RZ.pbrMaterial('wetAsphalt', { mapping: 'world', ripples: true }));
  const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, L + 120), road); roadMesh.rotation.x = -Math.PI / 2; roadMesh.position.set(0, 0, zc - 40); roadMesh.receiveShadow = true; scene.add(roadMesh);
  const walk = timed('tex:paving', () => RZ.pbrMaterial('concrete', { mapping: 'world', params: { slabs: 1, color: 0x6e6b66, wet: 0.9, stains: 0.3 }, ripples: { strength: 0.6 } }));
  const curbM = RZ.pbrMaterial('cutStone', { mapping: 'world', params: { color: 0x85827a, rows: 1, wet: 0.85 } });
  for (const s of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.16, L), walk); sw.position.set(s * 8.15, 0.08, zc); sw.receiveShadow = true; scene.add(sw);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.17, L), curbM); curb.position.set(s * 6.05, 0.085, zc); curb.receiveShadow = true; scene.add(curb);
  }
  scene.add(RZ.roadPaint({ strips: [{ x: 0, z: zc - 40, length: L + 100, width: 0.14, dash: [3, 5] }, { x: -5.3, z: zc, length: L, width: 0.12 }, { x: 5.3, z: zc, length: L, width: 0.12 },
    ...Array.from({ length: 7 }, (_, k) => ({ x: -4.2 + k * 1.4, z: -7, length: 3, width: 0.5 }))] }));
  // buildings
  const left = [], right = [];
  const walls = ['brick', 'darkBrick', 'plaster', 'stone', 'concrete', 'brick'];
  let z = 18, i = 0;
  while (z > -78) { const d = 9 + (i * 7.3 % 6); left.push({ width: d, depth: 14, height: 15 + (i * 13.7 % 22), position: [-17.3, 0, z - d / 2], yaw: Math.PI / 2, seed: 10 + i, wall: walls[i % 6], fireEscape: i % 3 === 0 }); z -= d; i++; }
  z = 18;
  while (z > -78) { const d = 10 + (i * 5.1 % 7); right.push({ width: d, depth: 14, height: 17 + (i * 11.3 % 28), position: [17.3, 0, z - d / 2], yaw: -Math.PI / 2, seed: 30 + i, wall: walls[(i + 3) % 6], fireEscape: i % 4 === 1 }); z -= d; i++; }
  // far cross-street towers closing the vista
  const far = [{ width: 30, depth: 16, height: 46, position: [-26, 0, -102], seed: 71, wall: 'concrete', faces: ['windows', 'windows', 'blank', 'windows'] },
    { width: 26, depth: 16, height: 64, position: [24, 0, -106], seed: 72, wall: 'panel', faces: ['windows', 'windows', 'blank', 'windows'] }];
  const facade = RZ.windowInteriorMaterial({ lit: 0.36, daylight: 0 });
  const blockL = timed('blockL', () => RZ.cityBlock(left, { material: facade }));
  const blockR = timed('blockR', () => RZ.cityBlock(right.concat(far), { material: facade }));
  scene.add(blockL.mesh, blockR.mesh);
  scene.add(RZ.skyline({ center: [0, -60], radius: [180, 420], arc: [-1.0, 1.0], count: 70, height: [50, 220], lit: 0.22 }));
  const fogC = sky.fogColor.clone().lerp(new THREE.Color(0x2a2430), 0.5).multiplyScalar(1.2);
  scene.fog = RZ.heightFog({ color: fogC, density: 0.022, falloff: 0.04 });
  scene.add(RZ.hazeLayer({ center: [0, -60], radius: 150, height: 90, arc: [-0.9, 0.9], color: fogC.clone().multiplyScalar(1.6), opacity: 0.35 }));
  // lights: lamps (real lights near camera, surface lights for the rest), neon
  const mDark = metalDark();
  const lampPos = [];
  for (let zz = 10; zz > -76; zz -= 15) for (const s of [-1, 1]) lampPos.push(streetLamp(scene, s * 6.5, zz + (s > 0 ? 7 : 0), s, mDark, s > 0 ? 0xffd2a0 : 0xfff0dc));
  const neon = [['NOODLES', '#ff3a8a', -10.05, 5.2, -4, 0], ['HOTEL', '#4ae0ff', 10.05, 6.5, -14, 1], ['PHARMACY', '#52ff9a', -10.05, 5.0, -27, 0], ['BAR', '#ffb040', 10.05, 5.4, -36, 1], ['24H', '#ff4040', -10.05, 4.8, -48, 0]];
  const neonLights = [];
  for (const [t, c, x, y, zz, right_] of neon) {
    const sg = neonSign(t, c, t.length * 0.55 + 0.6, 0.9); sg.position.set(x + (right_ ? -0.25 : 0.25), y, zz); sg.rotation.y = right_ ? -Math.PI / 2 : Math.PI / 2; scene.add(sg);
    neonLights.push({ position: [x + (right_ ? -1.2 : 1.2), y, zz], color: new THREE.Color(c), intensity: 12, distance: 9 });
  }
  const camZ = view === 1 ? 14 : 8;
  const all = lampPos.map((p, k) => ({ position: p.toArray(), color: k % 2 ? 0xffc890 : 0xffeedd, intensity: 30, distance: 16 })).concat(neonLights);
  all.sort((a, b) => Math.abs(a.position[2] - (camZ - 18)) - Math.abs(b.position[2] - (camZ - 18)));
  const LL = RZ.localLights(all);
  LL.apply(road); LL.apply(walk); LL.apply(curbM); LL.apply(facade);
  for (const lp of all.filter(l => l.distance > 15).slice(0, 4)) { const pl = new THREE.PointLight(lp.color, lp.intensity * 0.7, lp.distance, 2); pl.position.set(...lp.position); scene.add(pl); }
  const moon = new THREE.DirectionalLight(0x9db0e0, 0.18); moon.position.set(-30, 60, 20); moon.castShadow = quality !== 'low'; moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 150 }); scene.add(moon);
  for (const p of lampPos) scene.add(RZ.lightShaft({ from: [p.x, p.y - 0.05, p.z], to: [p.x, 0.0, p.z], radius: [0.22, 2.2], color: 0xffd2a0, intensity: 0.08, floorY: 0.1 }));
  // street dressing: bollards, bins, bags, contact shadows, grime decals at the wall bases
  for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.9, 10), mDark); b.position.set(-6.5, 0.6, -2 - k * 2.2); b.castShadow = true; scene.add(b); }
  const bin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 1.1), RZ.pbrMaterial('paintedMetalPanel', { mapping: 'object', params: { color: 0x2c4a36, cols: 1, rows: 1, wear: 0.6, grime: 0.8 } }));
  bin.position.set(9.1, 0.81, -20); bin.castShadow = true; scene.add(bin);
  const cs = RZ.contactShadow({ width: 2.6, depth: 1.8, opacity: 0.7 }); cs.position.set(9.1, 0.17, -20); scene.add(cs);
  const bags = RZ.rocks({ placements: [{ x: 7.8, y: 0.16, z: -19.6, scale: 0.42, sink: 0.25 }, { x: 8.2, y: 0.16, z: -21, scale: 0.36, sink: 0.25 }, { x: 7.6, y: 0.16, z: -20.6, scale: 0.3, sink: 0.25 }],
    material: new THREE.MeshPhysicalMaterial({ color: 0x08090a, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }), variants: 2, detail: 2 });
  scene.add(bags);
  const grime = RZ.pbrMaterial('grime', { mapping: 'world', alphaFromMask: true, params: { amount: 0.8, drips: 0.4, blotch: 0.8 } });
  for (const s of [-1, 1]) { const gm = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.6), grime); gm.position.set(s * 10.29, 0.95, zc); gm.rotation.y = -s * Math.PI / 2; scene.add(gm); }
  // rain
  scene.add(RZ.particles({ kind: 'rain', count: 7000, area: [30, 18, 30] }));
  // reflections: one capture in the street, box-projected to the street volume
  const probe = timed('capture', () => RZ.captureEnvironment(renderer, scene, [0, 2.0, -16], { box: { min: [-10.3, -0.3, -100], max: [10.3, 45, 30] } }));
  probe.apply(road); probe.apply(walk); probe.apply(curbM);
  camera.fov = 55;
  if (view === 1) { camera.position.set(-2.5, 8.5, 14); camera.lookAt(0, 4.5, -30); }
  else if (view === 2) { camera.position.set(-2, 6, -6); camera.lookAt(10.2, 8, -16); }
  else if (view === 3) { camera.position.set(5.5, 6.4, -9.5); camera.lookAt(10.2, 6.4, -12.8); }
  else if (view === 4) { camera.position.set(-7.5, 1.6, 2); camera.lookAt(-10.3, 1.4, -8); }
  else { camera.position.set(1.4, 1.75, 8); camera.lookAt(-0.3, 2.6, -20); }
  return { scene, exposure: 1.15, bloom: [0.7, 0.55, 0.85] };
}

// ------------------------------------------------------------------------------------------------
// interior: clean sci-fi lab hall with polished reflective floor (captured + box-projected)
// ------------------------------------------------------------------------------------------------
function interior() {
  const scene = new THREE.Scene();
  timed('sky', () => RZ.skyEnvironment(renderer, scene, { preset: 'interior', color: 0xeaf2ff, wall: 0x3a4048, intensity: 4 }));
  // the night city outside the observation window
  const night = RZ.skyEnvironment(renderer, null, { preset: 'night-city', apply: false });
  scene.background = night.background; scene.backgroundIntensity = 0.8;
  const W = 12, Hh = 5.2, Lz = 34, z0 = 6, zEnd = z0 - Lz;
  const floorM = timed('tex:floor', () => RZ.pbrMaterial('ceramicTile', { mapping: 'world', params: { color: 0x8e9398, grout: 0x45484c, count: 2, countY: 2, gloss: 0.72, variation: 0.35, marble: 0.08, lippage: 0.12 }, envMapIntensity: 1.0 }));
  const wallM = timed('tex:wall', () => RZ.pbrMaterial('paintedMetalPanel', { mapping: 'world', params: { color: 0xaab1b8, cols: 2, rows: 4, wear: 0.08, grime: 0.25, gloss: 0.55 } }));
  const darkM = RZ.pbrMaterial('paintedMetalPanel', { mapping: 'world', params: { color: 0x262a30, cols: 1, rows: 2, wear: 0.12, grime: 0.3, gloss: 0.5 } });
  const steel = RZ.pbrMaterial('brushedMetal', { mapping: 'object', params: { color: 0xa8adb2, roughness: 0.3 } });
  const rubberM = RZ.pbrMaterial('rubber', { mapping: 'world' });
  const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; m.castShadow = o.cast ?? true; m.receiveShadow = true; scene.add(m); return m; };
  add(new THREE.BoxGeometry(W, 0.2, Lz), floorM, 0, -0.1, z0 - Lz / 2);
  add(new THREE.BoxGeometry(W, 0.2, Lz), darkM, 0, Hh + 0.1, z0 - Lz / 2);
  // walls: left solid panels, right glass partition with lab bays, end wall with an observation window
  add(new THREE.BoxGeometry(0.3, Hh, Lz), wallM, -W / 2 - 0.15, Hh / 2, z0 - Lz / 2);
  add(new THREE.BoxGeometry(W, Hh, 0.3), wallM, 0, Hh / 2, z0 + 0.15);
  const wx0 = -4, wx1 = 4, wy0 = 1.0, wy1 = 4.2;
  add(new THREE.BoxGeometry(W, wy0, 0.3), wallM, 0, wy0 / 2, zEnd - 0.15);
  add(new THREE.BoxGeometry(W, Hh - wy1, 0.3), wallM, 0, (Hh + wy1) / 2, zEnd - 0.15);
  add(new THREE.BoxGeometry(wx0 + W / 2, wy1 - wy0, 0.3), wallM, (-W / 2 + wx0) / 2, (wy0 + wy1) / 2, zEnd - 0.15);
  add(new THREE.BoxGeometry(W / 2 - wx1, wy1 - wy0, 0.3), wallM, (W / 2 + wx1) / 2, (wy0 + wy1) / 2, zEnd - 0.15);
  for (const x of [-4, 0, 4]) add(new THREE.BoxGeometry(0.08, wy1 - wy0, 0.12), darkM, x, (wy0 + wy1) / 2, zEnd - 0.05);
  add(new THREE.BoxGeometry(W - 3.8, 0.08, 0.12), darkM, 0, wy0, zEnd - 0.05); add(new THREE.BoxGeometry(W - 3.8, 0.08, 0.12), darkM, 0, wy1, zEnd - 0.05);
  const winGlass = new THREE.MeshPhysicalMaterial({ color: 0x9fb4c0, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.2 });
  add(new THREE.PlaneGeometry(wx1 - wx0, wy1 - wy0), winGlass, 0, (wy0 + wy1) / 2, zEnd - 0.12, { cast: false });
  add(new THREE.BoxGeometry(0.3, 1.0, Lz), darkM, W / 2 + 0.15, 0.5, z0 - Lz / 2);
  add(new THREE.BoxGeometry(0.3, 0.9, Lz), darkM, W / 2 + 0.15, Hh - 0.45, z0 - Lz / 2);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fb4c0, metalness: 0, roughness: 0.04, transmission: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.4 });
  add(new THREE.BoxGeometry(0.04, Hh - 1.9, Lz), glass, W / 2 + 0.15, 1.0 + (Hh - 1.9) / 2, z0 - Lz / 2, { cast: false });
  // lab bay behind the glass
  add(new THREE.BoxGeometry(6, 0.2, Lz), floorM, W / 2 + 3.3, -0.1, z0 - Lz / 2);
  add(new THREE.BoxGeometry(0.3, Hh, Lz), wallM, W / 2 + 6.3, Hh / 2, z0 - Lz / 2);
  add(new THREE.BoxGeometry(6, 0.2, Lz), darkM, W / 2 + 3.3, Hh + 0.1, z0 - Lz / 2);
  for (let k = 0; k < 4; k++) { add(new THREE.BoxGeometry(1.2, 0.9, 3.2), darkM, W / 2 + 4.5, 0.45, -2 - k * 8); add(new THREE.BoxGeometry(1.1, 0.06, 3.0), steel, W / 2 + 4.5, 0.93, -2 - k * 8); }
  // pillars + floor/ceiling LED reveals + ceiling light lines
  const ledW = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xeaf2ff, emissiveIntensity: 4 });
  const ledC = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x38e1ff, emissiveIntensity: 3 });
  for (let k = 0; k < 6; k++) {
    const zz = z0 - 3 - k * 6;
    add(new THREE.BoxGeometry(0.7, Hh, 0.7), wallM, -W / 2 + 0.35, Hh / 2, zz);
    add(new THREE.BoxGeometry(0.72, 0.12, 0.72), steel, -W / 2 + 0.35, 0.06, zz);
    add(new THREE.BoxGeometry(0.08, Hh - 1.2, 0.04), ledC, -W / 2 + 0.72, Hh / 2, zz, { cast: false });
    add(new THREE.BoxGeometry(W - 1.6, 0.06, 0.22), ledW, 0, Hh - 0.03, zz + 3, { cast: false });
  }
  add(new THREE.BoxGeometry(0.04, 0.05, Lz), ledC, -W / 2 + 0.03, 0.06, z0 - Lz / 2, { cast: false });
  add(new THREE.BoxGeometry(W - 0.6, 0.05, 0.04), ledC, 0, 0.06, zEnd + 0.03, { cast: false });
  // furniture: central console + bench
  add(new THREE.BoxGeometry(3.2, 0.95, 1.1), darkM, -1.0, 0.475, -14);
  add(new THREE.BoxGeometry(3.3, 0.05, 1.2), steel, -1.0, 0.97, -14);
  const scr = document.createElement('canvas'); scr.width = 512; scr.height = 256; const g2 = scr.getContext('2d');
  const grd = g2.createLinearGradient(0, 0, 512, 256); grd.addColorStop(0, '#04202a'); grd.addColorStop(1, '#0a3a4a'); g2.fillStyle = grd; g2.fillRect(0, 0, 512, 256);
  g2.strokeStyle = '#5fe6ff'; g2.lineWidth = 2; for (let k = 0; k < 6; k++) { g2.beginPath(); for (let x = 0; x < 512; x += 8) g2.lineTo(x, 128 + Math.sin(x * 0.03 + k) * 40 * Math.sin(k + x * 0.002)); g2.stroke(); }
  g2.fillStyle = '#c8f4ff'; g2.font = '600 26px monospace'; g2.fillText('HELIX // CHRONO LAB 03', 20, 36); g2.fillText('FIELD STABILITY  97.2%', 20, 230);
  const st = new THREE.CanvasTexture(scr); st.colorSpace = THREE.SRGBColorSpace;
  const screen = add(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: st, color: new THREE.Color(1.3, 1.3, 1.3) }), -1.0, 1.55, -14.2, { cast: false });
  screen.rotation.x = -0.2;
  add(new THREE.BoxGeometry(0.05, 0.6, 0.05), steel, -1.0, 1.15, -14.25);
  add(new THREE.BoxGeometry(2.4, 0.45, 0.6), rubberM, 3.6, 0.225, -6);
  add(new THREE.BoxGeometry(2.5, 0.06, 0.65), steel, 3.6, 0.48, -6);
  const sign = neonSign('LAB 03', '#5fe6ff', 2.2, 0.6); sign.position.set(-W / 2 + 0.05, 3.6, -9); sign.rotation.y = Math.PI / 2; scene.add(sign);
  for (const [x, z] of [[-1, -14], [3.6, -6]]) { const cs = RZ.contactShadow({ width: 4.2, depth: 2.2, opacity: 0.55 }); cs.position.set(x, 0.005, z); scene.add(cs); }
  // night city through the window
  scene.add(RZ.skyline({ center: [0, -40], radius: [70, 220], arc: [-0.6, 0.6], count: 40, height: [20, 120], lit: 0.3 }));
  // lights: 3 real lights (one shadow caster) + emissive geometry captured into the env probe
  const key = new THREE.SpotLight(0xf0f6ff, 40, 30, 0.9, 0.6, 2); key.position.set(0, Hh - 0.3, -8); key.target.position.set(0, 0, -13); key.castShadow = quality !== 'low'; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; scene.add(key, key.target);
  const p1 = new THREE.PointLight(0xe8f0ff, 10, 14, 2); p1.position.set(0, Hh - 0.5, 0); scene.add(p1);
  const p2 = new THREE.PointLight(0x38e1ff, 5, 8, 2); p2.position.set(-W / 2 + 1, 1.5, -9); scene.add(p2);
  scene.add(RZ.particles({ kind: 'dust', count: 260, center: [0, 2.4, -12], area: [10, 4.5, 24], color: 0xd8ecff, size: 0.02, opacity: 0.3 }));
  const probe = timed('capture', () => RZ.captureEnvironment(renderer, scene, [0, 1.6, -12], { box: { min: [-W / 2, 0, zEnd], max: [W / 2 + 6, Hh, z0] } }));
  probe.apply(floorM); probe.apply(wallM); probe.apply(darkM); probe.apply(steel); probe.apply(glass, { box: null }); probe.apply(winGlass, { box: null });
  scene.environment = probe.texture;
  camera.fov = 60;
  if (view === 1) { camera.position.set(4.5, 2.4, 3.5); camera.lookAt(-1.5, 1.4, -14); }
  else if (view === 2) { camera.position.set(-2.5, 1.5, -18); camera.lookAt(0.5, 2.2, zEnd); }
  else { camera.position.set(1.6, 1.7, 3.2); camera.lookAt(-0.6, 1.55, -14); }
  return { scene, exposure: 0.9, bloom: [0.5, 0.5, 0.9] };
}

// ------------------------------------------------------------------------------------------------
// ruins: overgrown concrete shell, afternoon sun, light shafts and dust
// ------------------------------------------------------------------------------------------------
function ruins() {
  const scene = new THREE.Scene();
  const sky = timed('sky', () => RZ.skyEnvironment(renderer, scene, { preset: 'day', elevation: 26, azimuth: 235, cover: 0.38, turbidity: 2.8 }));
  const nz = RZ.makeNoise(12);
  const hf = (x, z) => nz.fbm2(x * 0.05, z * 0.05, 4) * 1.4 + Math.max(0, Math.hypot(x, z + 8) - 22) * 0.12 + nz.fbm2(x * 0.3, z * 0.3, 2) * 0.15 - 0.2 * Math.exp(-((x * x + (z + 8) * (z + 8)) / 80));
  const ter = timed('terrain', () => RZ.terrain({ size: 90, segments: Math.round(RZ.tier().terrainSeg * 0.6), center: [0, -10], heightFn: hf, rockSlope: 0.5, dirt: 0.55,
    layers: [['grass', { dryness: 0.5 }], ['dirt', { damp: 0.3 }], ['concrete', { color: 0x7a7872, stains: 0.9 }], ['gravel', { color: 0x6a665f }]] }));
  scene.add(ter.mesh);
  sky.addSun(scene, { shadow: quality !== 'low', area: 26, center: [0, 0, -8], distance: 70 });
  scene.fog = RZ.heightFog({ color: sky.hazeColor, density: 0.006, falloff: 0.05 });
  const conc = timed('tex:concrete', () => RZ.pbrMaterial('concrete', { mapping: 'world', params: { color: 0x87847d, stains: 1, formwork: 1 }, overlay: { kind: 'moss', amount: 0.42, ground: 0.6 } }));
  const add = (geo, mat, x, y, z, ry = 0, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
  // shell: back wall with window holes, side walls, one collapsed
  add(RZ.brokenWall({ width: 16, height: 7.5, thickness: 0.35, seed: 3, holes: 2, jag: 1.4, drop: 0.35, dropSide: 1 }), conc, 0, -0.2, -18);
  add(RZ.brokenWall({ width: 14, height: 6.5, thickness: 0.35, seed: 5, holes: 2, jag: 1.2, drop: 0.55, dropSide: 0 }), conc, -8, -0.2, -11, Math.PI / 2);
  add(RZ.brokenWall({ width: 9, height: 4.2, thickness: 0.35, seed: 8, holes: 0, jag: 1.4, drop: 0.7 }), conc, 7.8, -0.2, -13.5, Math.PI / 2);
  add(RZ.brokenWall({ width: 7, height: 1.6, thickness: 0.3, seed: 11, holes: 0, jag: 0.7 }), conc, -2.5, -0.2, -4.5);
  // fallen roof slab + columns with rebar
  add(RZ.brokenWall({ width: 7, height: 4.5, thickness: 0.28, seed: 14, holes: 0, jag: 0.8 }), conc, 3.5, 0.6, -9.5, 0.4, -1.25, 0.1);
  const rebarM = RZ.pbrMaterial('rust', { mapping: 'object', params: { amount: 0.85 } });
  for (const [x, z, h] of [[-4, -13, 5.2], [3, -14, 3.4], [-4, -6, 2.6]]) {
    add(RZ.brokenWall({ width: 0.55, height: h, thickness: 0.55, seed: Math.round(x * 7 + z), jag: 0.4 }), conc, x, -0.2, z);
    add(RZ.rebar({ origin: [0, h - 0.4, 0], spread: [0.4, 0.4], count: 5, length: 0.9, seed: Math.round(h * 10) }), rebarM, x, -0.2, z);
  }
  add(RZ.rebar({ origin: [-1.0, 0.6, 2.2], dir: [0.3, 1, 0.6], spread: [3, 0.1], count: 9, length: 0.7, seed: 4 }), rebarM, 3.5, 0.6, -9.5, 0.4, -1.25, 0.1);
  // rubble: angular concrete chunks piled under the collapse
  const rub = [], rr = RZ.rng(31);
  for (let k = 0; k < 80; k++) { const a = rr() * 6.28, d = Math.pow(rr(), 0.6) * 9; const x = Math.cos(a) * d * 1.2, z = -11 + Math.sin(a) * d * 0.7; rub.push({ x, z, scale: 0.18 + rr() * 0.7 * (1 - d / 12), sink: 0.05 }); }
  scene.add(RZ.rocks({ shape: 'chunk', placements: rub, heightAt: hf, seed: 4 }));
  scene.add(RZ.rocks({ placements: [{ x: 9, z: -2, scale: 1.4 }, { x: -11, z: -3, scale: 1.1 }, { x: 12, z: -20, scale: 2.2 }], heightAt: hf, seed: 8 }));
  // vegetation: grass + weeds, a tree growing inside, ivy on the walls
  const grass = timed('grass', () => RZ.instancedGrass({ rect: [-45, -55, 90, 90], heightAt: hf, mask: (x, z) => { const inside = Math.abs(x) < 7.5 && z < -4 && z > -17.5; return Math.max(0, Math.min(1, (nz.fbm2(x * 0.15, z * 0.15, 3) + 0.25) * 2.2)) * (inside ? 0.55 : 1); },
    radius: 26, height: 0.45, color: 0x56682c, tipColor: 0xa9a35e }));
  scene.add(grass.mesh);
  scene.add(RZ.forest({ species: 'broadleaf', placements: [{ x: -2.5, z: -12.5, scale: 0.9 }, { x: 16, z: -26, scale: 1.2 }, { x: -18, z: -24, scale: 1.1 }, { x: 22, z: -8, scale: 1.0 }, { x: -24, z: -6, scale: 1.25 }], heightAt: hf, seed: 3, impostors: false }));
  scene.add(RZ.forest({ species: 'shrub', placements: Array.from({ length: 14 }, () => ({ x: (rr() - 0.5) * 30, z: -6 - rr() * 20, scale: 0.6 + rr() * 0.6 })), heightAt: hf, seed: 9, impostors: false }));
  scene.add(RZ.ivy({ edges: [[[-7.5, 6.4, -17.8], [2, 5.8, -17.8], [0, 0, 1]], [[-7.85, 5.6, -16], [-7.85, 4.8, -8], [1, 0, 0]]],
    patches: [{ center: [-5.5, 0, -17.8], normal: [0, 0, 1], width: 3, height: 4.5 }, { center: [4.5, 0, -17.8], normal: [0, 0, 1], width: 2.2, height: 2.6 }, { center: [-7.85, 0, -9], normal: [1, 0, 0], width: 2.5, height: 3.2 }],
    length: [0.5, 1.8], density: 1.6, seed: 6 }));
  // light shafts through the back wall holes, along the sun
  const sd = sky.sunDirection.clone();
  for (const [x, y] of [[-3.2, 3.9], [2.6, 4.1]]) { const from = new THREE.Vector3(x, y, -18); const to = from.clone().addScaledVector(sd, -9); to.y = Math.max(to.y, 0); scene.add(RZ.lightShaft({ from: from.toArray(), to: to.toArray(), shape: 'box', size: [1.2, 1.2], spread: [1, 1.4], color: 0xffdcb0, intensity: 0.35, floorY: 0.2 })); }
  scene.add(RZ.particles({ kind: 'dust', count: 220, center: [0, 2.2, -12], area: [12, 4.4, 10], color: 0xffe6c4, size: 0.025, opacity: 0.5 }));
  scene.add(RZ.mountains({ center: [0, -10], radius: [260, 520], height: 90, seed: 5, grass: 0x4a5236 }));
  scene.add(RZ.hazeLayer({ center: [0, -10], radius: 230, height: 50, color: sky.hazeColor.clone().multiplyScalar(1.1), opacity: 0.45 }));
  camera.fov = 58;
  if (view === 1) { camera.position.set(-9, 4.5, 10); camera.lookAt(0, 2.2, -12); }
  else if (view === 2) { camera.position.set(-3.5, hf(-3.5, -9) + 1.6, -9); camera.lookAt(-5, 2.2, -17.8); }
  else { camera.position.set(3.2, hf(3.2, 5) + 1.7, 5); camera.lookAt(-1.5, 2.6, -14); }
  return { scene, exposure: 1.0, bloom: [0.25, 0.45, 1.3] };
}

// ------------------------------------------------------------------------------------------------
// valley: golden-hour valley with terrain splatting, river, waterfall, forest, grass, mountains
// ------------------------------------------------------------------------------------------------
function valley() {
  const scene = new THREE.Scene();
  const sky = timed('sky', () => RZ.skyEnvironment(renderer, scene, { preset: 'golden-hour', elevation: 9, azimuth: view === 1 ? 200 : 250 }));
  const nz = RZ.makeNoise(21);
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const riverX = z => 10 * Math.sin(z * 0.016) - 4;
  const cliff = (x, z) => { const d = Math.hypot((x + 46) * 0.8, (z + 70) * 1.3); return 26 * (1 - sm(14, 30, d)) * (x < -38 ? 1 : sm(-30, -38, x)); };
  const hf = (x, z) => {
    const rx = x - riverX(z), ax = Math.abs(rx);
    let h = Math.pow(Math.min(1.5, ax / 95), 1.7) * 52;
    h += nz.fbm2(x * 0.011, z * 0.011, 5) * 12 * sm(10, 60, ax) + nz.ridged2(x * 0.007, z * 0.007, 5) * 26 * sm(35, 110, ax);
    h += nz.fbm2(x * 0.06, z * 0.06, 3) * 1.1;
    h -= 2.4 * (1 - sm(4, 13, ax));
    h += cliff(x, z);
    return h;
  };
  const waterLevel = -1.1;
  const ter = timed('terrain', () => RZ.terrain({ size: 420, segments: RZ.tier().terrainSeg, center: [0, -80], heightFn: hf, waterLevel, rockSlope: 0.36, dirt: 0.25,
    layers: [['grass', { color: 0x4d6a26, dry: 0x8f8448, dryness: 0.3, bare: 0.4 }], ['dirt', {}], ['rock', { color: 0x7a7266, color2: 0x5a5046 }], ['sand', { color: 0xa89470 }]] }));
  scene.add(ter.mesh);
  sky.addSun(scene, { shadow: quality !== 'low', area: 45, center: [8, 0, -10], distance: 120 });
  const fogC = sky.hazeColor;
  scene.fog = RZ.heightFog({ color: fogC, density: 0.0022, falloff: 0.012, base: -2 });
  scene.add(RZ.hazeLayer({ center: [0, -80], radius: 300, height: 110, color: fogC.clone().multiplyScalar(1.05), opacity: 0.45 }));
  const wat = timed('water', () => RZ.water({ rect: [-60, -260, 110, 300], level: waterLevel, heightAt: hf, deep: 0x0a2226, shallow: 0x35574a, flow: [0.0, -0.04], waves: 0.45 }));
  scene.add(wat.mesh);
  const fall = RZ.waterfall({ top: [-37.5, hf(-38, -66) + 0.2, -66], height: hf(-38, -66) - waterLevel + 0.2, width: 5, dir: [1, 0.15], lip: 0.9, ambient: 0x8a7a80 });
  scene.add(fall);
  // forest on the slopes, riverside trees, rocks
  const rr = RZ.rng(77), trees = [], conifers = [], boulders = [];
  for (let k = 0; k < 1400; k++) {
    const x = -200 + rr() * 400, z = -280 + rr() * 300, h = hf(x, z), n = ter.normalAt(x, z);
    if (h < waterLevel + 1.2 || n.y < 0.8) continue;
    const ax = Math.abs(x - riverX(z));
    if (Math.hypot(x - 14, z - 22) < 16) continue;
    const dens = nz.fbm2(x * 0.02, z * 0.02, 3) + (ax > 40 ? 0.35 : -0.1);
    if (dens < 0.05) continue;
    (h > 18 || rr() < 0.35 ? conifers : trees).push({ x, z, scale: 0.8 + rr() * 0.6 });
  }
  for (let k = 0; k < 60; k++) { const z = -10 - rr() * 150, x = riverX(z) + (rr() < 0.5 ? -1 : 1) * (7 + rr() * 8); boulders.push({ x, z, scale: 0.6 + rr() * 1.6 }); }
  for (let k = 0; k < 18; k++) boulders.push({ x: -40 + rr() * 10, z: -60 - rr() * 20, scale: 1 + rr() * 2.5 });
  const focus = [14, 22];
  scene.add(timed('forest', () => RZ.forest({ species: 'broadleaf', placements: trees, heightAt: hf, focus, lodDistance: 70, seed: 2, budgetScale: 0.45 })));
  scene.add(timed('conifers', () => RZ.forest({ species: 'conifer', placements: conifers, heightAt: hf, focus, lodDistance: 70, seed: 5, budgetScale: 0.55 })));
  scene.add(RZ.rocks({ placements: boulders, heightAt: hf, seed: 3, moss: 0.35 }));
  const grass = timed('grass', () => RZ.instancedGrass({ rect: [-210, -290, 420, 420], heightAt: hf, mask: (x, z) => { const h = hf(x, z), n = ter.normalAt(x, z); return (h > waterLevel + 0.6 ? 1 : 0) * Math.max(0, Math.min(1, (n.y - 0.82) * 8)) * Math.min(1, (nz.fbm2(x * 0.05, z * 0.05, 3) + 0.45) * 2); },
    radius: 30, height: 0.5, color: 0x56742a, tipColor: 0xb8ac5c }));
  scene.add(grass.mesh);
  scene.add(RZ.mountains({ center: [0, -80], radius: [330, 760], height: 230, seed: 8, arc: [-Math.PI, Math.PI], snowLine: 175, rock: 0x524c46, grass: 0x34402a }));
  // reflections of the valley in the river
  if (q.get('hide')) for (const nm of q.get('hide').split(',')) scene.traverse(o => { if (o.name === nm) o.userData.noCapture = true; });
  const probe = timed('capture', () => RZ.captureEnvironment(renderer, scene, [0, 2, -30], { size: quality === 'high' ? 256 : 128 }));
  if (!q.has('noprobe')) probe.apply(wat.material);
  camera.fov = 55;
  const cx = 14, cz = 22;
  if (view === 2) { camera.position.set(-10, hf(-10, 40) + 14, 40); camera.lookAt(-20, 6, -60); }
  else if (view === 3) { camera.position.set(-22, hf(-22, -48) + 2.2, -48); camera.lookAt(-38, 8, -66); }
  else { camera.position.set(cx, hf(cx, cz) + 1.8, cz); camera.lookAt(-14, hf(cx, cz) - 1.5, -40); }
  return { scene, exposure: 1.0, bloom: [0.35, 0.5, 1.1] };
}

// ------------------------------------------------------------------------------------------------
const builders = { swatches, sky: skyView, street, interior, ruins, valley };
// let the page finish loading first: a scene build is long synchronous work and would hold back the load event
await new Promise(r => setTimeout(r, 30));
const t0 = performance.now();
const ctx = await (builders[sceneName] || swatches)();
const buildMs = Math.round(performance.now() - t0);
const scene = ctx.scene;
renderer.toneMappingExposure = ctx.exposure ?? 1;
camera.updateProjectionMatrix();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const [bs, br, bt] = ctx.bloom || [0.6, 0.5, 0.9];
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), bs, br, bt);
if (q.get('bloom') !== '0') composer.addPass(bloom);
composer.addPass(new OutputPass());

const T = +(q.get('t') || 1.5);
RZ.update(T);
ctx.update?.(T);
scene.updateMatrixWorld(true);
const tc = performance.now();
renderer.render(scene, camera); // first frame compiles programs
const compileMs = Math.round(performance.now() - tc);
const audit = RZ.auditScene(renderer, scene, camera); // honest draw calls / triangles incl. the shadow pass
composer.render();
window.LAB_INFO = {
  scene: sceneName, quality, view, calls: audit.calls, triangles: audit.triangles, lights: audit.lights, shadowCasters: audit.shadowCasters, budgetOk: audit.ok, buildMs, compileMs,
  textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, programs: renderer.info.programs?.length, timings,
};
document.getElementById('info').textContent = `${sceneName} ${quality} calls=${audit.calls} tris=${audit.triangles} lights=${audit.lights} shadows=${audit.shadowCasters} build=${buildMs}ms`;
window.LAB = { scene, camera, renderer, RZ, THREE, composer };
window.LAB_DONE = true;
