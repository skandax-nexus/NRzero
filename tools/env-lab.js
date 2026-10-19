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
RZ.init(renderer, { quality });

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
  const sky = timed('sky', () => RZ.skyEnvironment(renderer, scene, { preset: q.get('sky') || 'day' }));
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
// street: a short wet night street, interior-mapped facades, captured + box-projected reflections
// ------------------------------------------------------------------------------------------------
function street() {
  const scene = new THREE.Scene();
  const sky = timed('sky', () => RZ.skyEnvironment(renderer, scene, { preset: 'night-city' }));
  const L = 70; // street length (z from +10 to -60)
  // ground: road + sidewalks + curbs
  const road = timed('tex:asphalt', () => RZ.pbrMaterial('wetAsphalt', { mapping: 'world', ripples: true }));
  const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, L + 40), road); roadMesh.rotation.x = -Math.PI / 2; roadMesh.position.set(0, 0, -25); roadMesh.receiveShadow = true; scene.add(roadMesh);
  const walk = timed('tex:paving', () => RZ.pbrMaterial('concrete', { mapping: 'world', params: { slabs: 1, color: 0x77746f, wet: 0.85, stains: 0.3 }, ripples: { strength: 0.6 } }));
  const curbM = RZ.pbrMaterial('cutStone', { mapping: 'world', params: { color: 0x8a867e, rows: 1, wet: 0.8 } });
  for (const s of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, L + 40), walk); sw.position.set(s * 8.1, 0.08, -25); sw.receiveShadow = true; scene.add(sw);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.17, L + 40), curbM); curb.position.set(s * 6.05, 0.085, -25); curb.receiveShadow = true; scene.add(curb);
  }
  // buildings: left and right blocks
  const left = [], right = [];
  let z = 12, i = 0;
  const walls = ['brick', 'darkBrick', 'plaster', 'stone', 'concrete', 'brick'];
  while (z > -62) { const d = 9 + (i * 7.3 % 6); left.push({ width: d, depth: 14, height: 16 + (i * 13.7 % 20), position: [-17.2, 0, z - d / 2], yaw: Math.PI / 2, seed: 10 + i, wall: walls[i % 6], fireEscape: i % 3 === 0 }); z -= d; i++; }
  z = 12;
  while (z > -62) { const d = 10 + (i * 5.1 % 7); right.push({ width: d, depth: 14, height: 18 + (i * 11.3 % 26), position: [17.2, 0, z - d / 2], yaw: -Math.PI / 2, seed: 30 + i, wall: walls[(i + 3) % 6], fireEscape: i % 4 === 1 }); z -= d; i++; }
  const blockL = timed('blockL', () => RZ.cityBlock(left, { lit: 0.38, daylight: 0 }));
  const blockR = timed('blockR', () => RZ.cityBlock(right, { lit: 0.38, daylight: 0 }));
  scene.add(blockL.mesh, blockR.mesh);
  scene.fog = RZ.heightFog({ color: sky.fogColor.clone().multiplyScalar(1.4), density: 0.018, falloff: 0.035 });
  // lights
  const moon = new THREE.DirectionalLight(0x8aa0d0, 0.25); moon.position.set(-20, 40, 10); scene.add(moon);
  const lamps = [];
  for (let zz = 6; zz > -60; zz -= 16) for (const s of [-1, 1]) lamps.push({ position: [s * 6.3, 6.2, zz + (s > 0 ? 8 : 0)], color: 0xffc98a, intensity: 40, distance: 18 });
  lamps.sort((a, b) => Math.abs(a.position[2] - 0) - Math.abs(b.position[2] - 0));
  const LL = RZ.localLights(lamps);
  LL.apply(road); LL.apply(walk); LL.apply(curbM); LL.apply(blockL.material);
  for (const lp of lamps.slice(0, 3)) { const pl = new THREE.PointLight(lp.color, lp.intensity * 0.6, lp.distance, 2); pl.position.set(...lp.position); scene.add(pl); }
  // reflections: one capture in the street, box-projected to the street volume
  const probe = timed('capture', () => RZ.captureEnvironment(renderer, scene, [0, 2.0, -18], { box: { min: [-10.2, -0.2, -70], max: [10.2, 40, 30] } }));
  probe.apply(road); probe.apply(walk); probe.apply(curbM);
  camera.fov = 55;
  if (view === 1) { camera.position.set(-3, 9, 14); camera.lookAt(0, 4, -30); }
  else if (view === 2) { camera.position.set(-2, 6, -6); camera.lookAt(10.2, 8, -16); }
  else if (view === 3) { camera.position.set(5.5, 6.4, -9.5); camera.lookAt(10.2, 6.4, -12.8); }
  else { camera.position.set(1.2, 1.9, 8); camera.lookAt(-0.5, 2.4, -20); }
  return { scene, exposure: 1.1, bloom: [0.7, 0.55, 0.85] };
}

// ------------------------------------------------------------------------------------------------
const builders = { swatches, sky: skyView, street };
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
renderer.render(scene, camera); // first frame compiles programs; also gives honest draw-call counts incl. shadows
const compileMs = Math.round(performance.now() - tc);
const info = { ...renderer.info.render };
composer.render();
window.LAB_INFO = {
  scene: sceneName, quality, view, calls: info.calls, triangles: info.triangles, buildMs, compileMs,
  textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, programs: renderer.info.programs?.length, timings,
};
document.getElementById('info').textContent = `${sceneName} ${quality} calls=${info.calls} tris=${info.triangles} build=${buildMs}ms`;
window.LAB_DONE = true;
