import * as THREE from 'three';
import { box, glowMat, stoneMaterial, canvasTex, rng, chronolith, Motes, sky } from '../world/kit.js';
import { Walker } from '../world/props.js';
import { settlerLook } from '../story/cast.js';

const $ = id => document.getElementById(id);

function waterMaterial() {
  const n = canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = Math.sin(x * 0.12 + Math.sin(y * 0.07) * 2) * 0.5 + Math.sin((x + y) * 0.05) * 0.5;
      const b = Math.cos(y * 0.11 + Math.sin(x * 0.06) * 2) * 0.5 + Math.cos((x - y) * 0.045) * 0.5;
      img.data[i] = 128 + a * 50; img.data[i + 1] = 128 + b * 50; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, 'waterN', { repeat: [6, 6], linear: true });
  return new THREE.MeshPhysicalMaterial({ color: 0x2a6a72, roughness: 0.06, metalness: 0.1, normalMap: n, normalScale: new THREE.Vector2(0.6, 0.6), transparent: true, opacity: 0.88, clearcoat: 1, envMapIntensity: 1.6 });
}

function waterfall(w, h) {
  const tex = canvasTex(128, 512, (g, W, H) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); const r = rng(77);
    for (let k = 0; k < 220; k++) { const x = r() * W, l = 30 + r() * 140; const grd = g.createLinearGradient(0, 0, 0, l); grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, `rgba(230,245,255,${0.3 + r() * 0.6})`); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.save(); g.translate(x, r() * H); g.fillRect(0, 0, 2 + r() * 4, l); g.restore(); }
  }, 'falls', { repeat: [Math.max(1, w / 4), 1] });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xcfe8ff, side: THREE.DoubleSide }));
  m.userData.tex = tex; return m;
}

function tree(R, x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 4, 8), new THREE.MeshStandardMaterial({ color: 0x4a3424, roughness: 0.95 })); trunk.position.y = 2; trunk.castShadow = true; g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.22 + R() * 0.08, 0.45, 0.22 + R() * 0.1), roughness: 0.85, flatShading: true });
  for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + R() * 0.8, 1), leafMat); f.position.set((R() - 0.5) * 2.2, 4 + R() * 1.8, (R() - 0.5) * 2.2); f.castShadow = true; g.add(f); }
  return g;
}

// Hand-painted mural panels for the sequence puzzle
function muralCanvas(kind) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 220; const g = c.getContext('2d');
  const r = rng(kind.length * 31);
  g.fillStyle = '#c9a774'; g.fillRect(0, 0, 320, 220);
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${90 + r() * 60},${60 + r() * 40},${30 + r() * 20},${r() * 0.15})`; g.fillRect(r() * 320, r() * 220, 3, 3); }
  const ink = '#4a2a18', ochre = '#9a3a1a', teal = '#2f6a6a';
  const person = (x, y, s = 1, col = ink, glow = false) => { g.fillStyle = col; g.beginPath(); g.arc(x, y - 22 * s, 6 * s, 0, 7); g.fill(); g.fillRect(x - 4 * s, y - 16 * s, 8 * s, 18 * s); g.fillRect(x - 5 * s, y + 2 * s, 3 * s, 12 * s); g.fillRect(x + 2 * s, y + 2 * s, 3 * s, 12 * s); if (glow) { g.strokeStyle = '#2ad0e0'; g.lineWidth = 3; g.beginPath(); g.arc(x - 7 * s, y - 6 * s, 4 * s, 0, 7); g.stroke(); } };
  const ring = (x, y, R, done = 1) => { g.strokeStyle = '#1a1210'; g.lineWidth = 14; g.beginPath(); g.arc(x, y, R, Math.PI * 0.5, Math.PI * 0.5 + Math.PI * 2 * done); g.stroke(); };
  g.fillStyle = teal; g.fillRect(0, 190, 320, 30);
  if (kind === 'construction') { ring(160, 110, 55, 0.65); for (let k = 0; k < 5; k++) person(50 + k * 55, 175, 1, ink, k === 2); g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.moveTo(100, 150); g.lineTo(130, 60); g.stroke(); }
  if (kind === 'prosperity') { ring(160, 100, 50); for (let k = 0; k < 7; k++) { g.fillStyle = '#5a7a2a'; g.beginPath(); g.ellipse(20 + k * 45, 180, 14, 6, 0, 0, 7); g.fill(); } for (let k = 0; k < 6; k++) person(30 + k * 52, 170, 0.8, k % 2 ? ochre : ink); g.fillStyle = '#e8b040'; g.beginPath(); g.arc(270, 40, 18, 0, 7); g.fill(); }
  if (kind === 'destruction') { ring(160, 100, 50); g.fillStyle = '#c8401a'; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(20 + k * 35, 190); g.quadraticCurveTo(30 + k * 35, 140 - r() * 40, 40 + k * 35, 190); g.fill(); } for (let k = 0; k < 4; k++) { g.strokeStyle = '#e8d090'; g.lineWidth = 3; g.beginPath(); const x = 40 + k * 80; g.moveTo(x, 0); g.lineTo(x + 30, 60); g.stroke(); } person(160, 175, 1, ink, true); }
  if (kind === 'abandonment') { ring(160, 105, 50); g.strokeStyle = '#3a5a2a'; g.lineWidth = 4; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(110 + k * 20, 60); g.bezierCurveTo(100 + k * 22, 100, 130 + k * 15, 130, 110 + k * 20, 190); g.stroke(); } g.fillStyle = '#7a6a5a'; for (let k = 0; k < 5; k++) g.fillRect(20 + k * 60, 160 + (k % 2) * 8, 30, 30 - (k % 2) * 8); }
  g.strokeStyle = '#5a3a20'; g.lineWidth = 8; g.strokeRect(4, 4, 312, 212);
  return c;
}

export default {
  id: 'm4', act: 'ACT I · THE WORLD THAT REMEMBERS', title: 'The Man from the Last Day', sub: 'The Settlement · c. 1000 BCE',
  async run(game) {
    const { ui, audio } = game;
    const scene = game.newScene({ background: 0xd88a50, fog: [0xc88a62, 0.0085], exposure: 1.0, bloom: 0.55, bloomThreshold: 0.92, envIntensity: 0.6, residue: true });
    const R = rng(1000);
    const skyM = sky(0x3a4a8a, 0xf0a060, { sun: 0xffb060, sunDir: [-0.8, 0.12, -0.6], stars: 0 }); scene.add(skyM);
    // sun
    scene.add(new THREE.HemisphereLight(0xffd8b0, 0x3a2a1a, 0.9));
    const sun = new THREE.DirectionalLight(0xffc080, 3.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 }); sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);
    game.onUpdate(() => { const p = game.player.pos; sun.position.set(p.x - 60, p.y + 22, p.z - 45); sun.target.position.copy(p); });

    // ground
    const grassTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#6a6a34'; g.fillRect(0, 0, w, h); for (let k = 0; k < 9000; k++) { g.fillStyle = `hsl(${55 + R() * 30},${30 + R() * 25}%,${18 + R() * 22}%)`; g.fillRect(R() * w, R() * h, 2, 3); } }, 'grass', { repeat: [24, 24] });
    const groundGeo = new THREE.PlaneGeometry(260, 260, 120, 120);
    const gp = groundGeo.attributes.position;
    for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), y = gp.getY(i), d = Math.hypot(x, y); const hill = Math.max(0, d - 48) * 0.35 * (0.6 + 0.4 * Math.sin(x * 0.05) * Math.cos(y * 0.04)); gp.setZ(i, hill + (d > 48 ? Math.sin(x * 0.2) * Math.cos(y * 0.17) * 1.2 : 0)); }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    // dirt paths
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 1 });
    for (const [x, z, w, l, ry] of [[0, 8, 4, 26, 0], [-12, -18, 3.5, 20, 0.9], [12, -18, 3.5, 22, -0.7], [14, -6, 3.5, 12, Math.PI / 2]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, l), pathMat); p.rotation.set(-Math.PI / 2, 0, ry); p.position.set(x, 0.02, z); p.receiveShadow = true; scene.add(p); }
    // ground collision with a hidden stairwell hole at x[-1.5,1.5] z[-17,-25]
    game.collision.add([-60, -1, -16.99], [60, 0, 60]);
    game.collision.add([-60, -1, -80], [60, 0, -25.01]);
    game.collision.add([-60, -1, -25.01], [-1.5, 0, -16.99]); game.collision.add([1.5, -1, -25.01], [60, 0, -16.99]);
    const slab = box(3.2, 0.25, 8.2, stoneMaterial('#8a7a62', [1, 2], 5), 0, -0.2, -21); scene.add(slab);
    const slabCol = game.collision.add([-1.6, -0.5, -25.1], [1.6, 0.02, -16.9]);
    // boundary
    for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2; game.collision.addBox(Math.sin(a) * 46, 0, Math.cos(a) * 46, 10, 10, 10); }

    // river + pool
    const water = waterMaterial();
    const river = new THREE.Mesh(new THREE.PlaneGeometry(6, 120), water); river.rotation.set(-Math.PI / 2, 0, 0.35); river.position.set(-28, 0.05, -10); scene.add(river);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(7, 40), water); pool.rotation.x = -Math.PI / 2; pool.position.set(-24, 0.06, -30); scene.add(pool);
    game.onUpdate((dt, t) => { water.normalMap.offset.set(t * 0.01, -t * 0.04); });
    // cliffs + waterfalls (from the cover)
    const cliffMat = stoneMaterial('#6a5a48', [3, 4], 8);
    for (const [x, z, w, h, ry] of [[-30, -48, 30, 28, 0.3], [5, -62, 40, 36, 0], [40, -48, 30, 30, -0.4], [-50, -15, 20, 24, 1.3]]) { const c = box(w, h, 8, cliffMat, x, 0, z); c.rotation.y = ry; scene.add(c); }
    const falls = [];
    for (const [x, y, z, w, h, ry] of [[-26, 2, -43.6, 6, 26, 0.3], [-4, 3, -57.8, 5, 33, 0], [10, 3, -57.8, 3, 33, 0], [34, 2, -44.4, 4, 28, -0.4]]) { const f = waterfall(w, h); f.position.set(x, y + h / 2 - 2, z); f.rotation.y = ry; scene.add(f); falls.push(f); }
    game.onUpdate((dt, t) => { for (const f of falls) f.userData.tex.offset.y = t * 0.45; });
    const mist = new Motes(300, [-34, 0, -48, 40, 6, -36], 0xffffff, 0.6, 0.6); mist.mesh.material.opacity = 0.18; scene.add(mist.mesh); game.onUpdate(dt => mist.update(dt));
    const pollen = new Motes(500, [-30, 0.2, -40, 30, 6, 25], 0xffe0a0, 0.06, 0.3); scene.add(pollen.mesh); game.onUpdate(dt => pollen.update(dt));
    // distant temples (left of the cover)
    const templeMat = stoneMaterial('#b08860', [2, 4], 12);
    for (const [x, z, h] of [[-62, -70, 30], [-48, -82, 42], [-75, -55, 22], [60, -85, 34]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(4, 7, h, 8), templeMat); t.position.set(x, h / 2, z); scene.add(t); const d = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 8, 0, 7, 0, Math.PI / 2), templeMat); d.position.set(x, h, z); scene.add(d); const sp = new THREE.Mesh(new THREE.ConeGeometry(1, 6, 8), templeMat); sp.position.set(x, h + 6, z); scene.add(sp); }

    // houses around the plaza
    const houseMat = stoneMaterial('#b49a74', [2, 1], 3), roofMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 1 });
    const houses = [[-18, 6], [-22, -6], [18, 8], [22, -2], [-14, 18], [14, 20], [-26, 14], [26, 14], [-8, 26], [8, 28]];
    houses.forEach(([x, z], k) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); scene.add(g);
      const w = 5 + R() * 2, d = 5 + R() * 2;
      g.add(box(w, 3, d, houseMat, 0, 0, 0));
      if (k % 3 === 0) { const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) / 2, 20, 10, 0, 7, 0, Math.PI / 2), houseMat); dome.position.y = 3; dome.castShadow = true; g.add(dome); }
      else { const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.4, 4), roofMat); roof.rotation.y = Math.PI / 4; roof.position.y = 4.2; roof.castShadow = true; g.add(roof); }
      g.add(box(1.2, 2, 0.1, new THREE.MeshStandardMaterial({ color: 0x1a120a }), 0, 0, d / 2 + 0.01));
      const lamp = box(0.25, 0.25, 0.25, glowMat(0xffa040, 3), 0.9, 2, d / 2 + 0.2); g.add(lamp);
      game.collision.addBox(x, 0, z, w * 0.9, 3, d * 0.9);
    });
    for (let k = 0; k < 26; k++) { const a = R() * Math.PI * 2, r = 30 + R() * 14; scene.add(tree(R, Math.sin(a) * r, Math.cos(a) * r, 0.8 + R() * 0.7)); }
    for (const [x, z] of [[-9, 14], [10, 12], [-30, -24], [24, -26]]) { scene.add(tree(R, x, z, 0.9)); game.collision.addBox(x, 0, z, 0.8, 4, 0.8); }

    // the Old Ring (a stone Chronolith) on its platform
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 0.6, 40), stoneMaterial('#9a8a72', [4, 1], 6)); plat.position.set(0, 0.3, -10); plat.receiveShadow = true; plat.castShadow = true; scene.add(plat);
    game.collision.add([-4.6, 0, -14.6], [4.6, 0.6, -5.4]);
    const oldRing = chronolith(1.15, { stone: 0x5a4a3a, color: 0xffb060, power: 0.0 }); oldRing.position.set(0, 3.5, -11); scene.add(oldRing);
    game.collision.addBox(0, 0, -11, 6, 7, 1.2);
    game.onUpdate((dt, t) => oldRing.userData.update(t));
    const pedestal = box(1, 1.1, 1, stoneMaterial('#7a6a52', [1, 1], 9), 0, 0.6, -7.2); scene.add(pedestal); game.collision.addBox(0, 0.6, -7.2, 1, 1.1, 1);
    const sockets = [];
    for (let k = 0; k < 3; k++) { const s = box(0.22, 0.04, 0.3, glowMat(0xffb060, 0), -0.3 + k * 0.3, 1.71, -7.2, { cast: false }); scene.add(s); sockets.push(s); }
    // a fire with storytellers
    const fire = new THREE.PointLight(0xff8a30, 30, 14, 1.6); fire.position.set(10, 1, 4); scene.add(fire);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })); flame.position.set(10, 0.6, 4); scene.add(flame);
    const embers = new Motes(80, [9.4, 0.2, 3.4, 10.6, 4, 4.6], 0xff8a30, 0.08, 0.9); scene.add(embers.mesh); game.onUpdate(dt => embers.update(dt));
    game.onUpdate((dt, t) => { fire.intensity = 26 + Math.sin(t * 13) * 6 + Math.sin(t * 7.7) * 4; flame.scale.set(1 + Math.sin(t * 9) * 0.1, 1 + Math.sin(t * 11) * 0.2, 1); });

    // settlers
    const walkers = [];
    for (let k = 0; k < 7; k++) walkers.push(new Walker(game, settlerLook(R), { x: -14 + k * 4.5, y: 0, z0: 18, z1: -2, speed: 0.8 + R() * 0.4 }));
    for (const [x, z, ry] of [[8.6, 5.4, 2.4], [11.4, 5.2, -2.4], [10.2, 2.6, 0], [-20, -27, 1.2], [19, -4, -1.6], [-6, -3, 0.4]]) walkers.push(new Walker(game, settlerLook(R), { x, y: 0, z0: z, z1: z, idle: true, ry }));
    for (let k = 0; k < 3; k++) walkers.push(new Walker(game, { ...settlerLook(R), height: 1.1 + R() * 0.15, build: 0.8 }, { x: -4 + k * 4, y: 0, z0: 4, z1: 12, speed: 1.8 }));
    game.onUpdate(dt => { for (const w of walkers) w.update(dt); });

    // glyph stones teaching the visual language
    const glyphTex = (kind) => canvasTex(128, 128, (g) => { g.fillStyle = '#7a6a52'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#ffd090'; g.lineWidth = 7; g.shadowColor = '#ffb060'; g.shadowBlur = 10; g.beginPath();
      if (kind === 'water') { for (let k = 0; k < 3; k++) { g.moveTo(20, 40 + k * 25); g.bezierCurveTo(45, 25 + k * 25, 75, 55 + k * 25, 108, 40 + k * 25); } }
      if (kind === 'seed') { g.ellipse(64, 70, 22, 34, 0, 0, 7); g.moveTo(64, 36); g.lineTo(64, 16); g.moveTo(64, 26); g.lineTo(80, 14); }
      if (kind === 'star') { for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44); } g.moveTo(84, 64); g.arc(64, 64, 20, 0, 7); }
      if (kind === 'ring') { g.arc(64, 64, 40, 0.3, Math.PI * 2 - 0.3); g.moveTo(64, 64); g.arc(64, 64, 6, 0, 7); }
      g.stroke(); }, 'glyph' + kind);
    const glyphStone = (kind, x, z, ry) => { const s = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 0.35), [stoneMaterial('#7a6a52', [1, 1], 4), stoneMaterial('#7a6a52', [1, 1], 4), stoneMaterial('#7a6a52', [1, 1], 4), stoneMaterial('#7a6a52', [1, 1], 4), new THREE.MeshStandardMaterial({ map: glyphTex(kind), emissiveMap: glyphTex(kind), emissive: 0xffa050, emissiveIntensity: 0.5, roughness: 0.9 }), stoneMaterial('#7a6a52', [1, 1], 4)]); s.position.set(x, 0.8, z); s.rotation.y = ry; s.castShadow = true; scene.add(s); game.collision.addBox(x, 0, z, 1, 1.6, 1); return s; };
    glyphStone('water', -17, -22, 0.9); glyphStone('seed', 16, -2.5, -Math.PI / 2); glyphStone('star', 11, -22, -0.7); glyphStone('ring', 2.5, -4.6, 0);

    // granary + observatory steps + shrine
    const gran = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 5, 16), houseMat); gran.position.set(21, 2.5, -8); gran.castShadow = true; scene.add(gran); game.collision.addBox(21, 0, -8, 6, 5, 6);
    const granRoof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 2.6, 16), roofMat); granRoof.position.set(21, 6.3, -8); scene.add(granRoof);
    const obs = new THREE.Group(); obs.position.set(15, 0, -32); scene.add(obs);
    for (let k = 0; k < 5; k++) obs.add(box(12 - k * 2, 1, 12 - k * 2, stoneMaterial('#a08a68', [3, 1], 2), 0, k, 0));
    game.collision.addBox(15, 0, -32, 12, 1, 12);
    for (let k = 1; k < 5; k++) game.collision.addBox(15, k, -32, 12 - k * 2, 1, 12 - k * 2);
    const bronze = new THREE.MeshStandardMaterial({ color: 0xb08040, metalness: 1, roughness: 0.3 });
    for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.6 + k * 0.5, 0.06, 8, 48), bronze); r.position.y = 6.6; r.rotation.set(k * 0.8, k * 0.5, 0); obs.add(r); }
    game.onUpdate(dt => obs.children.slice(-3).forEach((r, i) => { r.rotation.y += dt * 0.2 * (i + 1); }));
    const shrine = new THREE.Group(); shrine.position.set(-20, 0, -26); scene.add(shrine);
    for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { shrine.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 3.2, 10), houseMat)).position.set(x, 1.6, z); game.collision.addBox(-20 + x, 0, -26 + z, 0.6, 3.2, 0.6); }
    shrine.add(box(4, 0.3, 4, houseMat, 0, 3.2, 0));

    // fragments
    let fragments = 0;
    const fragment = (x, y, z, title, text) => {
      const f = new THREE.Group(); f.position.set(x, y, z); scene.add(f);
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0x8a7a5a, emissive: 0xffa040, emissiveIntensity: 0.7, roughness: 0.8 })); f.add(tab);
      const l = new THREE.PointLight(0xffb060, 6, 5, 1.5); f.add(l);
      game.onUpdate((dt, t) => { f.rotation.y += dt * 0.8; f.position.y = y + Math.sin(t * 2) * 0.05; });
      game.interact({ pos: [x, y, z], radius: 2.2, prompt: 'Take the inscription fragment', onUse: () => { scene.remove(f); fragments++; audio.sfxPlay('anomaly'); ui.addEvidence(title, text, 'THE SETTLEMENT'); game.objective(fragments < 3 ? `Find the three fragments of the Telling (${fragments}/3)` : 'Return the fragments to the Old Ring'); } });
    };
    fragment(-20, 1.1, -26, 'Fragment: the water', 'A carved wave. "The river was taught to stay." The settlement treats water as memory.');
    fragment(21, 0.9, -4.4, 'Fragment: the seed', 'A seed glyph beside a ring. "What is planted in the ring grows backward."');
    fragment(15, 5.6, -32, 'Fragment: the stars', 'A star glyph with a date-count. One of the counted days is marked with Kai\'s wrist symbol.');

    // characters
    const tala = game.actor('tala', null, -3, 0, 14, Math.PI);
    const niko = game.actor('niko', null, 2.5, 0.6, -6.2, Math.PI * 0.95);

    // ---------- underground chamber (y = -4) ----------
    const CYL = -4;
    const chamberMat = stoneMaterial('#6a5a46', [3, 2], 14);
    const stepsGroup = new THREE.Group(); stepsGroup.visible = false; scene.add(stepsGroup);
    for (let k = 0; k < 14; k++) { const y = -0.285 * (k + 1), z = -17.3 - k * 0.57; stepsGroup.add(box(3, 0.3, 0.6, chamberMat, 0, y - 0.15, z)); }
    stepsGroup.add(box(12, 0.3, 12, chamberMat, 0, CYL - 0.3, -31));
    for (const x of [-1.65, 1.65]) stepsGroup.add(box(0.3, 4.6, 8.4, chamberMat, x, CYL, -21));
    for (const [x, z, w, d] of [[-6.15, -31, 0.3, 12], [6.15, -31, 0.3, 12], [0, -37.15, 12.6, 0.3], [-3.8, -25, 4.6, 0.3], [3.8, -25, 4.6, 0.3]]) stepsGroup.add(box(w, 4.6, d, chamberMat, x, CYL, z));
    stepsGroup.add(box(12.6, 0.3, 12.6, chamberMat, 0, CYL + 4.3, -31));
    const stairCols = [];
    const torches = [];
    for (const [x, z] of [[-5.6, -27], [5.6, -27], [-5.6, -35], [5.6, -35]]) { const t = new THREE.PointLight(0xff9a40, 0, 10, 1.6); t.position.set(x, CYL + 2.4, z); scene.add(t); torches.push(t); stepsGroup.add(box(0.15, 0.4, 0.15, glowMat(0xff9a40, 4), x, CYL + 2.1, z)); }
    // murals on chamber walls
    const muralKinds = ['construction', 'prosperity', 'destruction', 'abandonment'];
    muralKinds.forEach((k, i) => { const tex = new THREE.CanvasTexture(muralCanvas(k)); tex.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.65), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })); const side = i < 2 ? -1 : 1; m.position.set(side * 5.98, CYL + 1.9, -28.5 - (i % 2) * 5); m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; stepsGroup.add(m); });
    // the niche + card
    const niche = box(1.4, 1.2, 0.4, new THREE.MeshStandardMaterial({ color: 0x1a120a }), 0, CYL + 1, -36.9); stepsGroup.add(niche);
    const niDoor = box(1.5, 1.3, 0.2, chamberMat, 0, CYL + 0.95, -36.7); stepsGroup.add(niDoor);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.01), new THREE.MeshStandardMaterial({ map: canvasTex(340, 220, (g, w, h) => { const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#d8dde2'); grd.addColorStop(1, '#8a9098'); g.fillStyle = grd; g.fillRect(0, 0, w, h); g.strokeStyle = '#2a8aaa'; g.lineWidth = 6; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(60, 70, 20 + k * 9, k, k + 4.6); g.stroke(); } g.fillStyle = '#111'; g.font = '600 26px Rajdhani, sans-serif'; g.fillText('HELIX', 120, 62); g.font = '700 30px Rajdhani, sans-serif'; g.fillText('K. VAREN', 24, 150); g.font = '500 18px Rajdhani, sans-serif'; g.fillText('TEMPORAL SYSTEMS · LVL 5', 24, 178); g.fillText('ISSUED 19.10.2049', 24, 202); g.fillStyle = 'rgba(80,60,30,0.35)'; g.fillRect(0, 0, w, h); }, 'helixcard'), roughness: 0.4, metalness: 0.3, emissive: 0x302820, emissiveIntensity: 0.3 }));
    card.position.set(0, CYL + 0.8, -36.75); card.rotation.x = -0.3; card.visible = false; stepsGroup.add(card);

    // ---------- SCRIPT ----------
    ui.missionTag('MISSION 4 · THE MAN FROM THE LAST DAY'); ui.show('hud', true);
    game.temporal.configure([{ id: 'past', key: '1', name: 'PAST', year: 'c. 1000 BCE', glyph: '◐', color: '#ffb060' }], 'past');
    ui.era('PAST', 'THE SETTLEMENT · ~3,000 YEARS AGO', '◐', [], '#ffb060');
    audio.wind(0.25); audio.water(0.12); audio.setTheme('past');
    game.player.place(0, 0, 20, Math.PI); game.checkpoint(0, 0, 20, Math.PI);
    game.control = false; ui.letterbox(true);
    // waking up
    const kai = game.player.char; kai.root.rotation.z = Math.PI / 2; kai.root.position.y = 0.25;
    game.engine.camera.position.set(0.6, 0.6, 19.2);
    await game.shot([0.8, 0.5, 18.9], [-2, 1.2, 14], 0.01, { fov: 40 });
    await ui.fade(0, 2500);
    tala.root.position.set(-1.4, 0, 17.5); tala.lookTarget = kai.head;
    await ui.subtitle('tala', 'You wear no dust, but the old story knows your face.', 3600);
    kai.root.rotation.z = 0; kai.root.position.y = 0; kai.crouch = 1;
    await game.shot([4, 2.2, 22], [0, 1.2, 18], 2.2, { fov: 55 });
    kai.crouch = 0;
    await ui.chapterCard('ACT I · THE WORLD THAT REMEMBERS', 'The Man from the Last Day', 'The settlement · three thousand years before the Zero Second', 3600);
    await game.shot([-2.5, 1.9, 21], [-1, 1.5, 17.5], 1.6, { fov: 45 });
    await game.talk([
      ['kai', 'Where — when is this?'],
      ['tala', 'This is the valley of the Ring. You fell out of the evening. Niko will want to see you. He keeps the Telling.'],
    ]);
    game.releaseCam(); ui.letterbox(false); game.control = true;
    game.objective('Find Niko at the Old Ring');
    tala.lookTarget = null;
    let metNiko = false;
    game.interact({ pos: [2.5, 1.6, -6.2], radius: 3, prompt: 'Speak with Niko', onUse: () => { metNiko = true; } });
    await game.waitFor(() => metNiko);
    game.control = false; ui.letterbox(true);
    niko.lookTarget = kai.head; kai.lookTarget = niko.head;
    await game.shot([game.player.pos.x + 1.8, 2.2, game.player.pos.z + 1.6], [2.5, 2, -6.2], 1.4, { fov: 42 });
    await game.talk([
      ['niko', 'Show me your wrist.'],
      ['kai', 'It\'s just a— it\'s a scar. I\'ve had it since I was a child.'],
      ['niko', 'The ring on your wrist is the Ring in our valley. You came before the first fire.'],
      ['kai', 'I\'ve never been here.'],
      ['niko', 'That is what the others said.'],
    ]);
    await game.talk([
      ['kai', 'Others?'],
      ['niko', 'The Telling has three pieces, carved by the first keepers and hidden so no single hand could read it. If the stones know you, you can bring them home.'],
      ['niko', 'Learn the marks. Water at the shrine. Seed at the granary. Stars at the top of the counting steps.'],
    ]);
    ui.addEvidence('"That is what the others said."', 'Niko, keeper of the settlement, recognized the mark on Kai\'s wrist and implied other visitors bearing it came before him.', 'THE OLD RING');
    game.releaseCam(); ui.letterbox(false); game.control = true; kai.lookTarget = null;
    game.objective('Find the three fragments of the Telling (0/3)');
    ui.toast('Follow the glyph stones: wave · seed · star', 4500);
    // barks
    const barks = [{ x: 10, z: 4, line: '"The fire tellers say a man of no dust walks out of the Ring every age."', done: false }, { x: -20, z: -26, id: 'tala', line: 'You ask where the river began. We ask who taught it to stay.', done: false }];
    game.onUpdate(() => { for (const b of barks) if (!b.done && Math.hypot(game.player.pos.x - b.x, game.player.pos.z - b.z) < 5) { b.done = true; ui.subtitle(b.id || null, b.line, 4000); } });
    await game.waitFor(() => fragments >= 3);
    let placed = false;
    game.interact({ pos: [0, 1.6, -7.2], radius: 2.4, prompt: 'Place the fragments on the pedestal', onUse: () => { placed = true; } });
    await game.waitFor(() => placed);
    game.control = false; ui.letterbox(true);
    await game.shot([5, 3, -2], [0, 3, -11], 1.6, { fov: 50 });
    for (const s of sockets) { s.material.emissiveIntensity = 4; audio.sfxPlay('pickup'); await game.wait(0.35); }
    audio.sfxPlay('switch'); oldRing.userData.disc.material.uniforms.uPower.value = 0.6; game.player.char.wristBoost = 10;
    await game.wait(1);
    await game.shot([4, 2.4, -16], [0, 0, -21], 1.2, { fov: 50 });
    audio.sfxPlay('door'); game.shake = 0.12;
    await new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt * 0.5); slab.position.x = u * 3.4; if (u >= 1) { off(); res(); } }); });
    game.shake = 0; slabCol.enabled = false; stepsGroup.visible = true;
    for (let k = 0; k < 14; k++) { const y = -0.285 * (k + 1), z = -17.3 - k * 0.57; stairCols.push(game.collision.add([-1.5, y - 0.3, z - 0.3], [1.5, y, z + 0.3])); }
    game.collision.add([-6, CYL - 0.6, -37], [6, CYL, -25.2]);
    game.collision.add([-1.8, CYL, -25.3], [-1.5, 4, -17]); game.collision.add([1.5, CYL, -25.3], [1.8, 4, -17]);
    game.collision.add([-6.3, CYL, -37.3], [-6, 0, -25]); game.collision.add([6, CYL, -37.3], [6.3, 0, -25]); game.collision.add([-6, CYL, -37.3], [6, 0, -37]);
    game.collision.add([-6, CYL, -25.2], [-1.5, 0, -24.9]); game.collision.add([1.5, CYL, -25.2], [6, 0, -24.9]);
    for (const t of torches) t.intensity = 14;
    await game.say('niko', 'No one has opened the Telling-room since my grandmother\'s grandmother. Go. The walls remember in order — if you can find the order.');
    game.releaseCam(); ui.letterbox(false); game.control = true;
    game.checkpoint(0, 0, -15.5, Math.PI);
    game.objective('Descend into the underground chamber');
    await game.waitFor(() => game.player.pos.y < CYL + 0.5);
    audio.setTheme('chronolith'); audio.wind(0.05);
    game.checkpoint(0, CYL, -27, Math.PI);
    game.objective('Reconstruct the sequence of the murals');
    let solved = false;
    game.interact({ pos: [0, CYL + 1.4, -31], radius: 5, once: false, prompt: 'Study the murals', enabled: () => !solved, onUse: async () => { solved = await muralPuzzle(game); } });
    await game.waitFor(() => solved);
    audio.sfxPlay('success');
    ui.addEvidence('The four murals', 'Construction, prosperity, destruction, abandonment. In the first, a builder with a glowing ring on his wrist stands among the workers.', 'TELLING-ROOM');
    game.control = false; ui.letterbox(true);
    await game.shot([1.4, CYL + 1.7, -33.6], [0, CYL + 1, -36.8], 1.4, { fov: 42 });
    audio.sfxPlay('door');
    await new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt * 0.6); niDoor.position.y = CYL + 0.95 - u * 1.4; if (u >= 1) { off(); res(); } }); });
    card.visible = true; const cl = new THREE.PointLight(0x9fe8ff, 6, 4, 1.5); cl.position.set(0, CYL + 1.2, -36.2); scene.add(cl);
    audio.sfxPlay('motif');
    await game.wait(0.8);
    await game.shot([0.3, CYL + 1.15, -35.9], [0, CYL + 0.82, -36.75], 1.4, { fov: 30 });
    await game.talk([
      ['kai', 'A Helix access card. My name. My level. Issued the nineteenth of October, 2049.'],
      ['kai', 'My wrist reads the stone around it at three thousand years.'],
    ]);
    niko.root.position.set(1.4, CYL, -31.5); niko.lookTarget = kai.head; niko.faceTowards(0, -35, 1, 99);
    kai.lookTarget = niko.head;
    await game.shot([-1.6, CYL + 1.8, -33.5], [1.2, CYL + 1.6, -31.8], 1.4, { fov: 45 });
    await game.talk([
      ['niko', 'The first one who came left it in the wall. For the one who would come last.'],
      ['kai', 'The last one?'],
      ['niko', 'The stars-count marks every arrival. You are the seventeenth.'],
    ]);
    ui.addEvidence('A card from 2049, three thousand years old', 'Kai\'s own Helix access card, sealed in the Telling-room. Niko: "You are the seventeenth." Helix did not invent the machine. Someone found it.', 'TELLING-ROOM');
    await game.wait(0.6);
    await ui.fade(1, 2000);
    game.releaseCam(); ui.letterbox(false); audio.allBeds(0); audio.setTheme('title');
  },
};

// Mural ordering puzzle (diegetic, solvable from what the murals show)
function muralPuzzle(game) {
  const order = ['construction', 'prosperity', 'destruction', 'abandonment'];
  const shuffled = ['destruction', 'construction', 'abandonment', 'prosperity'];
  const el = $('puzzle'); game.overlayOpen = true; game.input.unlock();
  el.innerHTML = `<div class="pz-box"><h3>THE TELLING</h3><p>Four walls. Four moments. Choose them in the order they happened.</p><div class="pz-row"></div><div class="pz-msg"></div><button class="pz-btn">Step back</button></div>`;
  el.classList.remove('hidden');
  const row = el.querySelector('.pz-row'), msg = el.querySelector('.pz-msg');
  let picked = [];
  const cards = shuffled.map(k => { const d = document.createElement('div'); d.className = 'pz-card'; d.appendChild(muralCanvas(k)); const s = document.createElement('span'); s.textContent = '· · ·'; d.appendChild(s); row.appendChild(d); return { k, d }; });
  return new Promise(res => {
    const close = (ok) => { el.classList.add('hidden'); el.innerHTML = ''; game.overlayOpen = false; game.input.lock(); res(ok); };
    el.querySelector('.pz-btn').onclick = () => close(false);
    if (game.autoplay) setTimeout(() => close(true), 600);
    cards.forEach(c => c.d.onclick = () => {
      if (picked.includes(c.k)) return;
      picked.push(c.k); game.audio.sfxPlay('blip');
      const n = document.createElement('div'); n.className = 'num'; n.textContent = picked.length; c.d.appendChild(n);
      if (picked.length === 4) {
        if (picked.every((k, i) => k === order[i])) { msg.textContent = 'THE WALLS REMEMBER IN ORDER'; game.audio.sfxPlay('success'); setTimeout(() => close(true), 1400); }
        else { msg.textContent = 'NOT THAT ORDER — LOOK AT THE RING ITSELF: UNFINISHED · WHOLE · BURNING · OVERGROWN'; game.audio.sfxPlay('fail'); setTimeout(() => { picked = []; cards.forEach(cc => cc.d.querySelector('.num')?.remove()); }, 900); }
      }
    });
  });
}
