// Infrastructure Lab: the stage-4 building and street kit (realism.cityBlock eras, realism.settlement,
// props.streetKit, kit.box facades) in one street per era, rendered through the game's own Engine (post chain,
// scene lighting, static batching), for review captures. See docs/RENDERING.md stage 4 and docs/MISSION_GUIDE.md.
// URL: tools/render/infra-lab.html?era=2049|2026|2196|ancient&gfx=high|medium|low&view=0|1|2&frames=12
// Sets window.LAB_INFO { calls, triangles, batches, buildMs } and window.LAB_DONE after the last frame.
import * as THREE from 'three';
import { Engine } from '../../src/core/engine.js';
import * as RZ from '../../src/world/realism.js';
import { sky, Rain, box, facadeTextures, asphaltMaterial, tileMaterial } from '../../src/world/kit.js';
import { streetKit, lampPost } from '../../src/world/props.js';

const q = new URLSearchParams(location.search);
const era = q.get('era') || '2049', gfx = q.get('gfx') || 'high', view = +(q.get('view') || 0), frames = +(q.get('frames') || 12);
const E = window.LAB_E = new Engine(document.getElementById('v'));
E.setQuality(gfx, { adaptive: false });
const t0 = performance.now();
const scene = new THREE.Scene();
const night = era === '2049' || era === '2196';
scene.background = new THREE.Color(night ? 0x05070c : era === 'ancient' ? 0x9a6a5a : 0x8fa4b8);
scene.fog = new THREE.FogExp2(night ? (era === '2196' ? 0x10161a : 0x141a2c) : era === 'ancient' ? 0xc08a6a : 0xa8b4c0, night ? 0.012 : 0.006);
scene.environmentIntensity = 0.35;
const updaters = [];

// ---------------- lights + sky per era ----------------
if (era === '2049') {
  scene.add(sky(0x03050b, 0x1c2238, { sun: 0x402030, sunDir: [0, 0.05, -1] }));
  scene.add(new THREE.HemisphereLight(0x3a4a6a, 0x0a0a12, 0.55));
  const moon = new THREE.DirectionalLight(0x9fb4ff, 0.5); moon.position.set(-20, 40, 10); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 }); scene.add(moon, moon.target);
  for (const [c, x, z] of [[0xff3a9a, -6, -6], [0x3ae6ff, 6, -22], [0xffa050, -6, -40], [0xfff0d0, 0, -14]]) { const l = new THREE.PointLight(c, 40, 22, 1.8); l.position.set(x, 4, z); scene.add(l); }
  const rain = new Rain(3000, 40); scene.add(rain.mesh); updaters.push(dt => rain.update(dt, E.camera));
} else if (era === '2196') {
  scene.add(sky(0x060a0e, 0x1a2228, { stars: 0.6 }));
  scene.add(new THREE.HemisphereLight(0x5a7080, 0x101410, 0.6));
  const moon = new THREE.DirectionalLight(0xb8c8ff, 0.9); moon.position.set(25, 40, -10); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 }); scene.add(moon, moon.target);
  const fire = new THREE.PointLight(0xff8a40, 30, 14, 1.8); fire.position.set(-3, 1, -10); scene.add(fire);
} else {
  const env = RZ.skyEnvironment(E.renderer, scene, { preset: era === 'ancient' ? 'sunset' : 'day' });
  env.addSun(scene, { shadow: true, area: 34 });
}

// ---------------- ground ----------------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), era === 'ancient' ? RZ.pbrMaterial('dirt', { mapping: 'world' }) : asphaltMaterial([20, 20]));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

if (era === 'ancient') {
  // ---------------- ancient settlement ----------------
  const R = RZ.rng(7), list = [];
  const spots = [[-9, -4, 0.3], [-11, -14, 0.1], [-8, -25, -0.1], [9, -6, -0.2], [11, -17, 0.05], [8, -28, 0.2], [-20, -10, 0.6], [20, -20, -0.5]];
  spots.forEach(([x, z, yaw], i) => {
    const round = i % 4 === 3;
    list.push(round ? { position: [x, 0, z], round: true, radius: 2.6 + R() * 0.6, height: 2.4, wall: i % 2 ? 'mud' : 'stone', seed: i + 1 }
      : { position: [x, 0, z], yaw: yaw + (x < 0 ? Math.PI / 2 : -Math.PI / 2), width: 5 + R() * 2.5, depth: 4.2 + R() * 1.5, height: 2.6 + R() * 0.5, wall: ['stone', 'mud', 'timber'][i % 3], roof: i === 5 ? 'flat' : 'thatch', seed: i + 1 });
  });
  const v = RZ.settlement(list); scene.add(v.group);
  const k = streetKit({ era: 'ancient', seed: 3 });
  k.add('well', [0, 0, -15]).add('cart', [-3, 0, -6], 0.4).add('stall', [3.5, 0, -10], -0.3, { color: 0x8a2a1a }).add('stall', [3.8, 0, -21], -0.1, { color: 0x2a4a6a });
  k.scatter('fence', [[-14, 2], [-14, -32]], { spacing: 2, offset: 0 }).scatter('fence', [[14, -32], [14, 2]], { spacing: 2 });
  k.scatter('pot', { area: [-6, -30, 6, -2] }, { count: 14 }).scatter('barrel', { area: [-7, -28, 7, -4] }, { count: 6 }).scatter('crate', { area: [-6, -26, 6, -6] }, { count: 5 });
  scene.add(k.build());
} else {
  // ---------------- city street: buildings both sides (cityBlock in the era), the kit's street furniture ----------------
  const R = RZ.rng(era === '2049' ? 49 : era === '2026' ? 26 : 96), left = [], right = [];
  let z = 12;
  for (let i = 0; z > -90; i++) { const d = 10 + R() * 8; left.push({ width: d, depth: 16, height: 16 + R() * (era === '2196' ? 22 : 40), position: [-19, 0, z - d / 2], yaw: Math.PI / 2, seed: 100 + i, faces: ['shop', 'blank', 'windows', 'blank'] }); z -= d; }
  z = 12;
  for (let i = 0; z > -90; i++) { const d = 10 + R() * 8; right.push({ width: d, depth: 16, height: 16 + R() * (era === '2196' ? 22 : 40), position: [19, 0, z - d / 2], yaw: -Math.PI / 2, seed: 200 + i, faces: ['shop', 'blank', 'windows', 'blank'] }); z -= d; }
  const block = RZ.cityBlock([...left, ...right], { era, lit: era === '2026' ? 0.12 : 0.4, daylight: era === '2026' ? 1 : 0 }); scene.add(block.mesh);
  // pavements
  const walk = tileMaterial('#2b2e33', '#15171a', [3, 40], { roughness: 0.4 });
  for (const s of [-1, 1]) scene.add(box(5, 0.15, 110, walk, s * 8.5, 0, -40));
  const k = streetKit({ era, seed: 5 });
  k.kerb([[-6, 15], [-6, -95]]).kerb([[6, -95], [6, 15]]);
  k.markings({ lanes: [{ from: [0, 15], to: [0, -95] }], edges: [{ from: [-5.4, 15], to: [-5.4, -95] }, { from: [5.4, 15], to: [5.4, -95] }], crossings: [{ at: [0, -30], yaw: Math.PI / 2, width: 11, length: 3 }], stops: [{ from: [0.2, -27.6], to: [5.2, -27.6] }], arrows: [{ at: [2.7, -20], yaw: Math.PI }, { at: [-2.7, -40], yaw: 0 }] });
  k.drains([[-5.6, 0, 4, Math.PI / 2], [-5.6, 0, -18, Math.PI / 2], [5.6, 0, -8, Math.PI / 2], [5.6, 0, -50, Math.PI / 2]]).manholes([[1.8, 0, -6], [-2, 0, -44]]);
  k.scatter('lamp', [[6.6, 12], [6.6, -90]], { spacing: 14, turn: Math.PI / 2, y: 0.15 }).scatter('lamp', [[-6.6, -90], [-6.6, 12]], { spacing: 14, turn: Math.PI / 2, y: 0.15, start: 7 });
  k.scatter('bollard', [[-6.4, -26], [-6.4, -34]], { spacing: 1.6, y: 0.15 }).scatter('bollard', [[6.4, -34], [6.4, -26]], { spacing: 1.6, y: 0.15 });
  k.trafficLight([6.5, 0.15, -27], 0, { arm: 4.5 }).trafficLight([-6.5, 0.15, -33], Math.PI, { arm: 4.5 });
  k.shelter([8.6, 0.15, -12], -Math.PI / 2, { width: 4 }).benches([[-9.5, 0.15, -6, Math.PI / 2], [-9.5, 0.15, -52, Math.PI / 2]]).bins([[-7.2, 0.15, -9], [7.4, 0.15, -44], [-7.2, 0.15, -60]]);
  k.kiosk([-10.2, 0.15, -16, Math.PI / 2]).kiosk([10.2, 0.15, -60, -Math.PI / 2]);
  if (era === '2196') { k.add('rubble', [-3, 0, -12], 0.3, { seed: 2 }).add('rubble', [3.5, 0, -46], 1, { seed: 5 }).add('rubble', [-8, 0.15, -38], 2, { seed: 8 }); k.car([-4.3, 0, -20], 0.2).car([3.5, 0, -62], Math.PI + 0.4).van([-4.2, 0, -70], -0.1); }
  else {
    k.car([-4.4, 0, -4], 0).car([-4.4, 0, -12], 0).van([-4.3, 0, -46], 0).car([4.4, 0, 2], Math.PI).car([4.4, 0, -40], Math.PI).car([4.4, 0, -48], Math.PI);
    k.scooter([-7.4, 0.15, -21, 0.5]).scooter([-7.6, 0.15, -22.2, 0.5]).scooter([7.5, 0.15, -18, -0.4]);
    k.cones([[-1.5, 0, -64], [-0.5, 0, -65], [0.5, 0, -66]]).add('barrier', [-1, 0, -68], 0.2);
  }
  if (era === '2049') {
    k.rails([[3, 15], [3, -95]], { embedded: true }).rails([[-3, -95], [-3, 15]], { embedded: true });
    k.cables([[[-11, 9, -2], [11, 8.5, -3]], [[-11, 11, -26], [11, 10.2, -24]], [[-11, 8, -55], [11, 9.4, -57]]], { sag: 0.9 });
    k.puddles([[-2.2, -9, 1.6], [3.1, -24, 1.2], [-1.0, -36, 2.0], [2.2, -58, 1.4]]);
  }
  k.railing([[-6.2, -70], [-6.2, -80]]);
  scene.add(k.build());
  if (q.get('kitbox') === '1') {   // a kit.box() facade tower, as the finished missions build them
    const { map, emissive } = facadeTextures(3, 'modern');
    scene.add(box(14, 40, 14, new THREE.MeshStandardMaterial({ map, emissiveMap: emissive, emissive: 0xffffff }), 0, 0, -110, { cast: false }));
  }
  const lp = lampPost(0xffe2b0); lp.position.set(-8.6, 0.15, 4); scene.add(lp);   // the rebuilt classic lamp
}
const buildMs = Math.round(performance.now() - t0);
E.setScene(scene);

// ---------------- views ----------------
const views = era === 'ancient'
  ? [[[0, 9, 14], [0, 1, -16], 58], [[-3, 1.7, 1], [2, 1.2, -14], 52], [[6, 1.6, -3], [-6, 1.6, -9], 50]]
  : [[[1.5, 8, 20], [0, 6, -40], 58], [[-7.6, 1.7, 4], [-2, 1.3, -14], 52], [[6.5, 1.8, -36], [-4, 2.5, -18], 55]];
const [p, l, fov] = views[view % views.length];
E.camera.position.set(...p); E.camera.fov = fov; E.camera.updateProjectionMatrix(); E.camera.lookAt(new THREE.Vector3(...l));

let n = 0, t = 0;
function frame() {
  const dt = 1 / 30; t += dt;
  for (const u of updaters) u(dt);
  RZ.update(dt);
  E.render(t);
  n++;
  const info = window.LAB_INFO = { era, gfx, view, calls: E.stats.calls, triangles: E.stats.triangles, batches: E.stats.batches, batched: E.stats.batched, buildMs, frame: n };
  document.getElementById('info').textContent = JSON.stringify(info);
  if (n >= frames) { window.LAB_DONE = true; window.LAB_GRAB = () => { E.render(t); return E.renderer.domElement.toDataURL('image/png'); }; return; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
