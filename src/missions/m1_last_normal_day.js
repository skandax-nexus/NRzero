import * as THREE from 'three';
import { asphaltMaterial, facadeTextures, neonSign, sky, Rain, box, glowMat, puddleGlow, concreteMaterial, tileMaterial, rng, canvasTex } from '../world/kit.js';
import { Walker, trainCar, trainNose, lampPost, screenTexture, sparks } from '../world/props.js';
import { citizenLook, CAST } from '../story/cast.js';
import { Character } from '../core/character.js';

const NEON = [0xff2a8a, 0x2ae6ff, 0xffa040, 0x9a5aff, 0x3aff9a, 0xff4040];

function building(game, x0, x1, z0, z1, h, seed, faceX) {
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
  const { map, emissive } = facadeTextures(seed % 6, seed % 3 === 0 ? 'glass' : 'modern');
  const m = map.clone(), e = emissive.clone();
  m.repeat.set(Math.max(1, d / 10), Math.max(1, h / 22)); e.repeat.copy(m.repeat);
  m.wrapS = m.wrapT = e.wrapS = e.wrapT = THREE.RepeatWrapping; m.needsUpdate = e.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: m, emissiveMap: e, emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.55, metalness: 0.35 });
  const b = box(w, h, d, mat, (x0 + x1) / 2, 0, (z0 + z1) / 2, { cast: false });
  game.scene.add(b); game.blocker(b);
  game.collision.add([Math.min(x0, x1), 0, Math.min(z0, z1)], [Math.max(x0, x1), h, Math.max(z0, z1)]);
  // roof details
  if (h > 25) { const ant = box(0.2, 6, 0.2, glowMat(0xff3030, 1), (x0 + x1) / 2, h, (z0 + z1) / 2); game.scene.add(ant); }
  return b;
}

function shopInterior(seed) {
  return canvasTex(512, 256, (g, w, h) => {
    const r = rng(seed + 1);
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#3a3026'); grd.addColorStop(0.5, '#9a8268'); grd.addColorStop(1, '#2a221c');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(255,240,210,0.9)'; g.fillRect(30 + k * 100, 6, 60, 6); const lg = g.createRadialGradient(60 + k * 100, 10, 0, 60 + k * 100, 10, 90); lg.addColorStop(0, 'rgba(255,230,190,0.5)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.fillRect(k * 100 - 40, 0, 200, 140); }
    for (let row = 0; row < 3; row++) { g.fillStyle = '#1c1612'; g.fillRect(0, 70 + row * 45, w, 5); for (let x = 4; x < w; x += 9 + r() * 10) { g.fillStyle = `hsl(${r() * 360},${30 + r() * 40}%,${30 + r() * 40}%)`; g.fillRect(x, 70 + row * 45 - 12 - r() * 16, 6 + r() * 5, 28); } }
    g.fillStyle = '#16110e'; g.fillRect(w * 0.55, h * 0.62, w * 0.35, h * 0.38);
    for (let k = 0; k < 2 + seed % 3; k++) { const x = 60 + r() * (w - 120); g.fillStyle = 'rgba(15,10,8,0.85)'; g.beginPath(); g.ellipse(x, h * 0.6, 14, 20, 0, 0, 7); g.fill(); g.fillRect(x - 18, h * 0.66, 36, h * 0.34); }
    const v = g.createLinearGradient(0, 0, w, 0); v.addColorStop(0, 'rgba(0,0,0,0.6)'); v.addColorStop(0.15, 'rgba(0,0,0,0)'); v.addColorStop(0.85, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  }, 'shop' + seed);
}

function shopfront(game, x, z0, z1, side, color, sign) {
  const len = Math.abs(z1 - z0), zc = (z0 + z1) / 2;
  const interior = shopInterior(Math.abs(Math.round(z0 * 7)) % 5);
  const tint = new THREE.Color(color).lerp(new THREE.Color(0xffe8c8), 0.55);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(len - 1, 3.2), new THREE.MeshStandardMaterial({ color: 0x050608, emissiveMap: interior, emissive: tint, emissiveIntensity: 1.1, roughness: 0.05, metalness: 0.3 }));
  glass.position.set(x + side * 0.02, 1.8, zc); glass.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; game.scene.add(glass);
  const awn = box(1.6, 0.12, len - 0.6, new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.4, metalness: 0.6 }), x + side * 0.8, 3.6, zc);
  game.scene.add(awn);
  const strip = box(0.05, 0.05, len - 0.6, glowMat(color, 3), x + side * 1.6, 3.6, zc); game.scene.add(strip);
  if (sign) {
    const s = neonSign(sign, '#' + new THREE.Color(color).getHexString(), Math.min(len - 1, 5), 1.1, { flicker: Math.random() < 0.3 });
    s.position.set(x + side * 0.05, 4.6, zc); s.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; game.scene.add(s);
    const pg = puddleGlow(color, 2.5, 5, 0.16); pg.position.set(x + side * 2.6, 0.17, zc); game.scene.add(pg);
  }
}

export default {
  id: 'm1', act: 'PROLOGUE · THE ZERO SECOND', title: 'The Last Normal Day', sub: 'Rain City · 2049',
  async run(game) {
    const { ui, audio } = game;
    const scene = game.newScene({ background: 0x05070c, fog: [0x141a2c, 0.0115], exposure: 1.05, bloom: 0.75, bloomThreshold: 0.88, envIntensity: 0.25 });
    const R = rng(2049);
    scene.add(sky(0x03050b, 0x1c2238, { sun: 0x402030, sunDir: [0, 0.05, -1], stars: 0 }));

    // --- lights ---
    scene.add(new THREE.HemisphereLight(0x3a4a6a, 0x0a0a12, 0.55));
    const moon = new THREE.DirectionalLight(0x9fb4ff, 0.55); moon.position.set(-20, 40, 10); moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 }); moon.shadow.bias = -0.0005;
    scene.add(moon, moon.target);
    game.onUpdate(() => { const p = game.player.pos; moon.position.set(p.x - 20, p.y + 40, p.z + 10); moon.target.position.copy(p); });
    const pl = (c, i, x, y, z, d = 22) => { const l = new THREE.PointLight(c, i, d, 1.8); l.position.set(x, y, z); scene.add(l); return l; };
    pl(0xff3a9a, 40, -7, 4, -2); pl(0x3ae6ff, 40, 7, 4, -20); pl(0xffa050, 45, -7, 4, -38); pl(0x9a6aff, 35, 7, 4, -56);
    pl(0xffffff, 50, 0, 6, -82, 18); pl(0xffe0b0, 60, 4, 7, -108, 26); pl(0x5fe6ff, 70, 0, 12, -132, 40);

    // --- ground ---
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 170), asphaltMaterial([1, 14]));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -55); ground.receiveShadow = true; scene.add(ground);
    game.collision.add([-40, -1, -160], [40, 0, 40]);
    const walkMat = tileMaterial('#2b2e33', '#15171a', [3, 40], { roughness: 0.3 });
    for (const s of [-1, 1]) {
      const sw = box(5, 0.15, 120, walkMat, s * 8.5, 0, -35); scene.add(sw); game.collision.addBox(s * 8.5, 0, -35, 5, 0.15, 120, { walkOnly: true });
      const curb = box(0.25, 0.18, 120, new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.7 }), s * 6.05, 0, -35); scene.add(curb);
    }
    // lane markings
    for (let z = 20; z > -92; z -= 6) { const m = box(0.15, 0.01, 2.6, new THREE.MeshStandardMaterial({ color: 0xbbbbaa, roughness: 0.6 }), 0, 0, z); scene.add(m); }
    // plaza
    const plaza = box(22, 0.15, 44, tileMaterial('#33363c', '#1a1c20', [8, 16], { roughness: 0.25 }), 0, 0, -117); scene.add(plaza);
    game.collision.addBox(0, 0, -117, 22, 0.15, 44, { walkOnly: true });

    // --- buildings ---
    let z = 25, i = 0;
    while (z > -92) { const d = 9 + R() * 9, z1 = Math.max(-95, z - d); building(game, -30, -11, z, z1, 18 + R() * 55, i++, 1); if (R() < 0.8) shopfront(game, -11, z, z1, 1, NEON[i % NEON.length], ['NOODLE 24H', 'PHARMA+', 'KAFE', 'HOTEL', 'ARCADE', 'BAR 2049'][i % 6]); z = z1; }
    z = 25;
    while (z > -92) { const d = 9 + R() * 9, z1 = Math.max(-95, z - d); building(game, 30, 16, z, z1, 22 + R() * 60, i++ + 50, -1); z = z1; }
    building(game, -40, 40, 40, 28, 40, 7); // behind start
    building(game, -40, -11, -95, -140, 70, 9); building(game, 16, 40, -95, -140, 60, 10);
    // distant skyline
    for (let k = 0; k < 26; k++) { const h = 40 + R() * 140, x = -120 + R() * 240, zz = -200 - R() * 150; const b = box(14 + R() * 20, h, 14 + R() * 20, new THREE.MeshStandardMaterial({ color: 0x0a0d14, emissiveMap: facadeTextures(k % 6).emissive, emissive: 0x8899bb, emissiveIntensity: 0.6, roughness: 0.8 }), x, 0, zz, { cast: false }); scene.add(b); }

    // --- rail corridor (right) ---
    const railBed = box(5, 0.05, 170, concreteMaterial('#2a2b2d', [1, 30]), 13.5, 0, -55); scene.add(railBed);
    for (const rx of [12.8, 14.2]) scene.add(box(0.1, 0.15, 170, new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 1, roughness: 0.25 }), rx, 0.05, -55));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(122, 2.2), new THREE.MeshPhysicalMaterial({ color: 0x8fb8d0, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide }));
    glass.rotation.y = Math.PI / 2; glass.position.set(11, 1.25, -37); scene.add(glass);
    game.collision.add([10.9, 0, -98], [11.1, 3, 25]);
    for (let zz = 24; zz > -98; zz -= 6) scene.add(box(0.12, 2.4, 0.12, new THREE.MeshStandardMaterial({ color: 0x2a2e34, metalness: 0.8, roughness: 0.4 }), 11, 0, zz));
    // overhead catenary
    for (let zz = 20; zz > -130; zz -= 16) { scene.add(box(0.15, 6, 0.15, new THREE.MeshStandardMaterial({ color: 0x1f2328, metalness: 0.8 }), 15.8, 0, zz)); scene.add(box(4, 0.1, 0.1, new THREE.MeshStandardMaterial({ color: 0x1f2328 }), 13.8, 5.9, zz)); }
    scene.add(box(0.03, 0.03, 160, new THREE.MeshStandardMaterial({ color: 0x111111 }), 13.5, 5.6, -55));
    // boundary walls (invisible)
    game.collision.add([-11, 0, 26], [16, 5, 27]); game.collision.add([-11.2, 0, -140], [-11, 6, 26]); game.collision.add([16, 0, -140], [16.2, 6, 26]);
    game.collision.add([-12, 0, -141], [17, 8, -139]);

    // --- lamps & dressing ---
    for (let zz = 18; zz > -92; zz -= 14) for (const s of [-1, 1]) {
      const lp = lampPost(0xffe2b0); lp.position.set(s * 6.5, 0.15, zz); lp.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(lp);
      const pg = puddleGlow(0xffd9a0, 1.4, 4, 0.18); pg.position.set(s * 5.2, 0.02, zz); scene.add(pg);
      game.collision.addBox(s * 6.5, 0, zz, 0.3, 6, 0.3);
    }
    // vertical blade signs
    const blades = [['HELIX', 0x2ae6ff], ['未来', 0xff2a8a], ['TRANSIT', 0xffa040], ['夜', 0x9a5aff], ['OPEN', 0x3aff9a]];
    blades.forEach(([t, c], k) => { const s = neonSign(t, '#' + new THREE.Color(c).getHexString(), 1.1, 4.4, { vertical: true, flicker: k === 3 }); s.position.set(-10.3, 8 + (k % 2) * 3, 12 - k * 20); scene.add(s); });
    blades.forEach(([t, c], k) => { const s = neonSign(['CHRONO', 'ZERO', 'BAR', '雨', 'HOTEL'][k], '#' + new THREE.Color(NEON[(k + 2) % 6]).getHexString(), 1.1, 4.4, { vertical: true }); s.position.set(15.3, 9 + (k % 2) * 4, 4 - k * 21); scene.add(s); });
    // holographic billboard
    const bb = screenTexture(512, 288, (g, w, h, t) => {
      const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#04121c'); grd.addColorStop(1, '#0a2a3a'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.save(); g.translate(w * 0.28, h / 2); g.rotate(t * 0.6);
      g.strokeStyle = '#5fe6ff'; g.lineWidth = 6; g.shadowColor = '#5fe6ff'; g.shadowBlur = 20;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0, 0, 50 + k * 18, k, k + 4.6); g.stroke(); }
      g.restore(); g.shadowBlur = 10; g.fillStyle = '#e8f8ff'; g.font = '700 52px Rajdhani, sans-serif'; g.fillText(game.flags.m1warning ? 'DO NOT' : 'HELIX', w * 0.5, h * 0.45);
      g.font = '500 24px Rajdhani, sans-serif'; g.fillStyle = game.flags.m1warning ? '#ff6a6a' : '#9fdfff'; g.fillText(game.flags.m1warning ? 'BUILD THE MACHINE' : 'TOMORROW, ENGINEERED.', w * 0.5, h * 0.62);
      if (game.flags.m1warning) { g.fillStyle = 'rgba(255,0,40,0.2)'; g.fillRect(0, 0, w, h); }
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 7.9), new THREE.MeshBasicMaterial({ map: bb, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false }));
    board.position.set(15.9, 16, -40); board.rotation.y = -Math.PI / 2; scene.add(board);
    let bbT = 0; game.onUpdate((dt, t) => { bbT += dt; if (bbT > 0.08) { bbT = 0; bb.userData.redraw(t); } });

    // flying traffic
    const cars = [];
    for (let k = 0; k < 10; k++) {
      const c = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.8, 4, 8), new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.9, roughness: 0.3 })); body.rotation.x = Math.PI / 2; c.add(body);
      const tl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), glowMat(k % 2 ? 0xff3030 : 0xffffff, 8)); tl.position.z = k % 2 ? 1.4 : -1.4; c.add(tl);
      c.userData = { speed: (k % 2 ? 1 : -1) * (14 + R() * 10), lane: -4 + (k % 4) * 2.6, y: 22 + (k % 3) * 9 };
      c.position.set(c.userData.lane, c.userData.y, -150 + R() * 200); scene.add(c); cars.push(c);
    }

    // rain
    const rain = new Rain(5200, 46); scene.add(rain.mesh);
    game.onUpdate(dt => rain.update(dt, game.engine.camera));

    // neon flicker
    const flickers = []; scene.traverse(o => { if (o.userData.flicker != null) flickers.push(o); });
    game.onUpdate((dt, t) => { if (game.flags.frozen) return; for (const f of flickers) f.material.opacity = (Math.sin(t * 23 + f.userData.flicker) > 0.92 || Math.sin(t * 3 + f.userData.flicker) > 0.97) ? 0.25 : 1; for (const c of cars) { c.position.z += c.userData.speed * dt; if (c.position.z > 60) c.position.z = -200; if (c.position.z < -200) c.position.z = 60; } });

    // --- crowd ---
    const walkers = [];
    for (let k = 0; k < 13; k++) walkers.push(new Walker(game, citizenLook(R, { umbrella: true }), { x: (k % 2 ? 8.3 : -8.6) + (R() - 0.5), y: 0.15, z0: 20, z1: -78 }));
    const idlers = [[-9.8, -6, 1.6], [-9.6, -24, 1.4], [9.9, -9, -1.5], [-9.7, -41, 1.5], [9.6, -63, -1.6], [-9.5, -68, 1.2], [-4, -101, 0.4], [-6, -112, 2.6], [3, -124, 3.4]];
    for (const [x, zz, ry] of idlers) walkers.push(new Walker(game, citizenLook(R, { umbrella: true }), { x, y: 0.15, z0: zz, z1: zz, idle: true, ry }));
    game.onUpdate(dt => { for (const w of walkers) w.update(dt); });

    // --- anomaly 1: the toy that un-fell ---
    const child = game.actor('child', { height: 1.12, build: 0.85, skin: 0xe0b394, hair: 0x3a2418, hairStyle: 'short', top: 0xd8a020, topKind: 'fabric', pants: 0x2a3a5a, boots: 0xc02020 }, -8.8, 0.15, -14, 1.2);
    const mom = game.ambient(citizenLook(R, { umbrella: true, override: { female: true, umbrella: 0x7a1f2a } }), -9.4, 0.15, -14.6, 1.0);
    const toy = new THREE.Group(); toy.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.1), new THREE.MeshStandardMaterial({ color: 0xd04030, metalness: 0.3, roughness: 0.4 })));
    const toyEye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), glowMat(0x5fe6ff, 6)); toyEye.position.set(0, 0.02, 0.055); toy.add(toyEye); scene.add(toy);
    const trail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: 0x5fe6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending })); scene.add(trail);
    const hand = new THREE.Vector3(), floor = new THREE.Vector3(-8.2, 0.22, -13.3);
    game.onUpdate((dt, t) => {
      if (game.flags.frozen) return;
      child.arms[1].hand.getWorldPosition(hand); child.arms[1].up.rotation.x = -0.6; child.arms[1].el.rotation.x = -0.8;
      const k = (t % 4) / 4; let p;
      if (k < 0.25) p = hand.clone();
      else if (k < 0.4) { const u = (k - 0.25) / 0.15; p = hand.clone().lerp(floor, u); p.y = hand.y + (floor.y - hand.y) * u * u; }
      else if (k < 0.6) p = floor.clone();
      else if (k < 0.75) { const u = 1 - (k - 0.6) / 0.15; p = hand.clone().lerp(floor, u); p.y = hand.y + (floor.y - hand.y) * u * u; }
      else p = hand.clone();
      toy.position.copy(p); toy.rotation.y = t;
      trail.position.copy(p); trail.material.opacity = k > 0.6 && k < 0.75 ? 0.5 : Math.max(0, trail.material.opacity - dt * 2);
      child.lookTarget = toy;
    });
    // --- anomaly 2: the backward clock ---
    const clock = new THREE.Group(); clock.position.set(9.6, 0.15, -34); scene.add(clock);
    clock.add(box(0.14, 3.4, 0.14, new THREE.MeshStandardMaterial({ color: 0x1d2a22, metalness: 0.7, roughness: 0.4 }), 0, 0, 0));
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 40), new THREE.MeshStandardMaterial({ color: 0xf1ead8, emissive: 0xffe8b0, emissiveIntensity: 0.6, roughness: 0.4 }));
    face.rotation.z = Math.PI / 2; face.position.y = 3.7; clock.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 8, 40), new THREE.MeshStandardMaterial({ color: 0x1d2a22, metalness: 0.8, roughness: 0.3 })); rim.rotation.y = Math.PI / 2; rim.position.y = 3.7; clock.add(rim);
    const hands = [];
    for (const s of [-1, 1]) for (const [len, w] of [[0.32, 0.04], [0.46, 0.025]]) {
      const hnd = new THREE.Group(); hnd.position.set(s * 0.07, 3.7, 0); hnd.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.01), new THREE.MeshStandardMaterial({ color: 0x111111 })); bar.position.y = len / 2; hnd.add(bar); clock.add(hnd); hands.push({ hnd, len });
    }
    game.onUpdate((dt) => { if (game.flags.frozen) return; for (const h of hands) h.hnd.rotation.z += (h.len > 0.4 ? 1.6 : 0.13) * dt * (h.hnd.rotation.y > 0 ? 1 : -1); });
    shopfront(game, 16, -30, -38, -1, 0xffa040, 'CHRONO REPAIR');
    // --- anomaly 3: tomorrow's footage ---
    const tv = screenTexture(512, 320, (g, w, h, t) => {
      g.fillStyle = '#0b1016'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1b2a3a'; g.fillRect(0, h * 0.62, w, h * 0.38);
      g.fillStyle = '#26303a'; for (let k = 0; k < 6; k++) g.fillRect(20 + k * 85, h * 0.2 - k % 2 * 20, 60, h * 0.45);
      g.save(); g.translate(w * 0.58, h * 0.62); g.rotate(-0.22); g.fillStyle = '#d8dde2'; g.fillRect(-150, -46, 260, 44); g.fillStyle = '#ffd9a0'; g.fillRect(-140, -36, 230, 10); g.restore();
      g.fillStyle = 'rgba(255,140,40,0.5)'; g.beginPath(); g.arc(w * 0.62, h * 0.6, 40 + Math.sin(t * 9) * 4, 0, 7); g.fill();
      for (let k = 0; k < 700; k++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
      g.fillStyle = '#ff3040'; g.beginPath(); g.arc(28, 28, 9, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = '700 22px Rajdhani, sans-serif'; g.fillText('LIVE · CENTRAL STATION', 46, 36);
      g.font = '600 20px Rajdhani, sans-serif'; g.fillText('19.10.2049  08:15:0' + (Math.floor(t) % 10), 22, h - 20);
    });
    shopfront(game, -11, -50, -60, 1, 0x3ae6ff, 'OPTIC ELECTRONICS');
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.94), new THREE.MeshBasicMaterial({ map: tv, color: new THREE.Color(1.4, 1.4, 1.4), toneMapped: false }));
      s.position.set(-10.9, 1.2 + r * 1.05, -53 - c * 1.65); s.rotation.y = Math.PI / 2; scene.add(s);
    }
    let tvT = 0; game.onUpdate((dt, t) => { tvT += dt; if (tvT > 0.1 && !game.flags.frozen) { tvT = 0; tv.userData.redraw(t); } });

    let anomalies = 0;
    const objMain = () => game.ui.objective(`Reach Helix Temporal Research Facility${anomalies < 3 ? `  ·  Anomalies ${anomalies}/3 (optional)` : ''}`);
    const anomaly = async (lines, ev) => {
      anomalies++; audio.sfxPlay('anomaly');
      await game.talk(lines); ui.addEvidence(...ev); objMain();
    };
    game.interact({ pos: [-8.6, 1, -13.6], radius: 3.2, prompt: 'Inspect the child\'s toy', onUse: () => anomaly([
      ['child', 'It keeps coming back. I drop it and it comes back.'],
      ['kai', 'It fell… and then it un-fell.'],
      ['child', 'Mister, your wrist is glowing.'],
    ], ['The toy that un-fell', 'A toy falls from a child\'s hand, then returns along the same arc — in reverse. Cause precedes effect?', 'RAIN CITY · 08:02'] ) });
    game.interact({ pos: [9.6, 1.5, -34], radius: 3, prompt: 'Inspect the street clock', onUse: () => anomaly([
      ['kai', 'Running backward. Not broken. Rewinding — at exactly one second per second.'],
      ['kai', 'Something is pulling the whole street toward a single moment.'],
    ], ['The backward clock', 'Chrono Repair\'s street clock counts down. Every rotation lands on 08:14:59 — never past it.', 'RAIN CITY · 08:06']) });
    game.interact({ pos: [-10.3, 1.5, -55], radius: 3.2, prompt: 'Watch the display screens', onUse: () => anomaly([
      ['kai', 'Live feed. Central Station. Dated tomorrow.'],
      ['kai', 'That\'s a train on the platform. On the platform.'],
    ], ['Tomorrow\'s footage', 'Shop screens show a live feed of Central Station dated 19.10.2049 — a derailed train across the platform.', 'RAIN CITY · 08:09']) });

    // --- security checkpoint ---
    const hale = game.actor('hale', null, 2.4, 0.15, -81.2, Math.PI * 0.85);
    const gateMat = new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.35, roughness: 0.05, emissive: 0x2a6a8a, emissiveIntensity: 0.6 });
    for (let x = -10.5; x <= 10.5; x += 1.5) { if (Math.abs(x) < 1.6) continue; scene.add(box(0.12, 1.1, 0.5, new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.8, roughness: 0.3 }), x, 0.15, -82)); scene.add(box(1.38, 0.9, 0.04, gateMat, x + 0.75, 0.2, -82)); }
    game.collision.add([-11, 0, -82.3], [-1.2, 2, -81.7]); game.collision.add([1.2, 0, -82.3], [11, 2, -81.7]);
    const gate = box(2.4, 1.0, 0.06, new THREE.MeshPhysicalMaterial({ color: 0xff5060, transparent: true, opacity: 0.45, emissive: 0xff2030, emissiveIntensity: 1.2 }), 0, 0.15, -82); scene.add(gate);
    const gateBox = game.collision.add([-1.2, 0, -82.3], [1.2, 2, -81.7]);
    const arch = new THREE.Group(); arch.position.set(0, 0.15, -82); scene.add(arch);
    for (const s of [-1, 1]) arch.add(box(0.3, 2.8, 0.6, new THREE.MeshStandardMaterial({ color: 0x1c2026, metalness: 0.8, roughness: 0.35 }), s * 1.35, 0, 0));
    arch.add(box(3, 0.3, 0.6, new THREE.MeshStandardMaterial({ color: 0x1c2026, metalness: 0.8 }), 0, 2.8, 0));
    const scanLight = box(2.4, 0.05, 0.05, glowMat(0xff3040, 4), 0, 2.75, 0.31); arch.add(scanLight);
    const hsign = neonSign('HELIX SECURITY · CHECKPOINT C', '#9fdfff', 6, 0.6, { font: '600 46px Rajdhani, sans-serif' }); hsign.position.set(0, 3.7, -82); scene.add(hsign);

    // --- station & Helix tower ---
    const canopy = box(8, 0.3, 32, new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.7, roughness: 0.3 }), 12, 5.5, -112); scene.add(canopy);
    for (let zz = -98; zz >= -126; zz -= 7) { scene.add(box(0.25, 5.5, 0.25, new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.8 }), 8.6, 0, zz)); game.collision.addBox(8.6, 0, zz, 0.3, 5.5, 0.3); }
    for (let zz = -99; zz >= -126; zz -= 4.5) scene.add(box(0.12, 0.06, 3, glowMat(0xfff1d8, 3), 11, 5.3, zz));
    const stSign = neonSign('CENTRAL STATION', '#ffd34a', 6, 0.8); stSign.position.set(8.4, 4.6, -100); stSign.rotation.y = Math.PI / 2; scene.add(stSign);
    // platform edge strip
    scene.add(box(0.3, 0.02, 30, glowMat(0xffd34a, 2.5), 11.1, 0.15, -112));
    // station clock (stopped clock motif)
    const sclock = new THREE.Group(); sclock.position.set(10.5, 4.6, -108); scene.add(sclock);
    const sface = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d8, emissiveIntensity: 1.2 })); sface.rotation.z = Math.PI / 2; sclock.add(sface);
    const sh = []; for (const len of [0.5, 0.7]) { const g = new THREE.Group(); g.position.x = -0.07; g.rotation.y = -Math.PI / 2; const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.01), new THREE.MeshStandardMaterial({ color: 0x050505 })); b2.position.y = len / 2; g.add(b2); sclock.add(g); sh.push(g); }
    sh[0].rotation.z = -Math.PI * 2 * (8.25 / 12); sh[1].rotation.z = -Math.PI * 2 * (14 / 60);
    // Helix tower
    const tower = box(26, 120, 18, new THREE.MeshPhysicalMaterial({ color: 0x0c1118, metalness: 0.9, roughness: 0.15, clearcoat: 1, emissiveMap: facadeTextures(3, 'glass').emissive, emissive: 0x9fdfff, emissiveIntensity: 0.5 }), 0, 0, -152, { cast: false });
    scene.add(tower);
    const logo = new THREE.Group(); logo.position.set(0, 26, -142.8); scene.add(logo);
    for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(4 + k * 1.1, 0.12, 8, 64, Math.PI * 1.6), glowMat(0x5fe6ff, 3.5)); r.rotation.z = k * 1.3; logo.add(r); }
    game.onUpdate(dt => { logo.children.forEach((r, k) => r.rotation.z += dt * (0.2 + k * 0.1) * (k % 2 ? -1 : 1)); });
    const hx = neonSign('HELIX TEMPORAL RESEARCH', '#e8f8ff', 16, 1.6, { font: '600 60px Cinzel, serif' }); hx.position.set(0, 18, -142.8); scene.add(hx);
    const doors = box(6, 4, 0.2, new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0x5fe6ff, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.1 }), 0, 0.15, -139.8); scene.add(doors);

    // --- Jun Park ---
    const jun = game.actor('jun', null, 9.4, 0.15, -103, -Math.PI / 2);
    const junTalk = game.interact({ pos: [9.4, 1.2, -103], radius: 2.6, prompt: 'Talk to the transit operator', onUse: async () => {
      await game.talk([
        ['jun', 'Trains are running early. Not late — early. Forty-one seconds, every one of them.'],
        ['kai', 'Since when?'],
        ['jun', 'Since the one that hasn\'t come in yet.'],
      ]);
      game.flags.metJun = true;
    } });

    // civilians on the platform (rescue targets)
    const civSpots = [[10.2, -106.5], [9.2, -111.2], [10.4, -115.8]];
    const civs = civSpots.map(([x, zz], k) => { const c = new Character({ ...citizenLook(rng(300 + k)), umbrella: null, lod: false }); c.root.position.set(x, 0.15, zz); c.root.rotation.y = Math.PI / 2 + (k - 1) * 0.4; scene.add(c.root); game.onUpdate(dt => c.update(dt)); return c; });

    // the train (arrives for the Zero Second)
    const train = new THREE.Group(); scene.add(train);
    for (let k = 0; k < 3; k++) { const car = trainCar(16); car.position.z = k * 16.4; train.add(car); }
    const nose = trainNose(); nose.position.z = -8; nose.rotation.y = Math.PI; train.add(nose);
    train.position.set(13.5, 0.05, 80); train.visible = false;
    const sp = sparks(160); scene.add(sp); game.onUpdate(dt => sp.userData.update(dt));
    // ambient passing train early on
    const passer = new THREE.Group(); for (let k = 0; k < 3; k++) { const car = trainCar(16, 0xd8dde4, 0xffa040); car.position.z = k * 16.4; passer.add(car); } scene.add(passer);
    passer.position.set(13.5, 0.05, 90);
    game.onUpdate(dt => { if (game.flags.frozen || game.flags.crash) return; passer.position.z -= 22 * dt; if (passer.position.z < -230) passer.position.z = 120; });

    // Mira (glimpse at the end)
    const mira = new Character(CAST.mira.look); mira.root.position.set(-3.5, 0.15, -125); mira.root.rotation.y = 0.3; mira.root.visible = false; scene.add(mira.root);
    game.actors.mira = mira;

    // --- barks ---
    const barks = [
      { z: -26, x: -9.6, id: null, line: '"My phone says 8:14. The station board says tomorrow."' },
      { z: -64, x: 9.6, id: null, line: '"Did you lose a minute just now? Everyone on the line lost a minute."' },
      { z: -96, x: 4, id: null, line: '"They\'re saying Helix had another power test. On a Sunday."' },
    ];
    game.onUpdate(() => { const p = game.player.pos; for (const b of barks) if (!b.done && Math.hypot(p.x - b.x, p.z - b.z) < 5) { b.done = true; ui.subtitle(null, b.line, 3800); } });

    // ---------------- SCRIPT ----------------
    audio.rain(0.5); audio.crowd(0.12); audio.hum(0.05, 49); audio.setTheme('city');
    game.player.place(0.5, 0.15, 14, Math.PI);
    game.checkpoint(0.5, 0.15, 14, Math.PI);
    ui.missionTag('MISSION 1 · THE LAST NORMAL DAY');
    ui.show('hud', true);
    ui.era('PRESENT', 'RAIN CITY · 2049', '◎', [], '#5fe6ff');
    game.temporal.configure([{ id: '2049', key: '1', name: 'PRESENT', year: '2049', glyph: '◎', color: '#5fe6ff' }], '2049');
    // opening shot
    game.control = false; ui.letterbox(true);
    game.engine.camera.position.set(-4, 18, -20);
    await ui.fade(0, 1800);
    await game.shot([3, 3.2, 20], [0, 2, 0], 6);
    await ui.chapterCard('PROLOGUE · THE ZERO SECOND', 'The Last Normal Day', 'Rain City · 2049', 3200);
    await game.shot([1.8, 1.9, 17.2], [0.4, 1.5, 13.8], 2.2);
    await game.talk([['kai', 'Sunday. Rain. Rook said "come in quietly." Rook has never said quietly in his life.']]);
    game.releaseCam(); ui.letterbox(false); game.control = true;
    objMain();
    ui.toast('WASD move · SHIFT sprint · MOUSE look · E interact · J case board', 6000);

    // Rook's call (non-blocking while walking)
    await game.waitFor(() => game.player.pos.z < -42 || anomalies >= 2);
    audio.sfxPlay('pickup');
    await ui.subtitle('phone', 'Kai. It\'s Rook. Where are you?', 3000);
    await ui.subtitle('kai', 'Twenty minutes out. What happened?', 2600);
    await ui.subtitle('phone', 'Nothing happened. That is the problem — everything is happening early.', 3800);
    await ui.subtitle('phone', 'Come through Checkpoint C. Speak to no one about the readings.', 3400);
    await ui.subtitle('kai', 'What readings?', 2000);
    await ui.subtitle('phone', 'Exactly.', 1800);

    // checkpoint
    await game.waitFor(() => game.player.pos.z < -77);
    game.interact({ pos: [0, 1.2, -81.3], radius: 2.4, prompt: 'Scan badge', onUse: async () => {
      scanLight.material.emissive.set(0x40ff90);
      await game.talk([
        ['hale', 'Badge.'],
        ['kai', 'Kai Varen. Temporal systems. Rook called me in.'],
        ['hale', 'Scanner says you badged through here at 07:12.'],
        ['kai', 'I was asleep at 07:12.'],
        ['hale', 'Then somebody wearing your face is very punctual. Go on. Helix entrance is past the platform.'],
      ]);
      gateBox.enabled = false; audio.sfxPlay('door'); game.flags.gate = true;
      game.onUpdate(dt => { gate.position.x = Math.min(2.6, gate.position.x + dt * 2); });
      ui.addEvidence('Badge used at 07:12', 'Checkpoint C logged Kai\'s credentials an hour before he arrived. Someone has his face — or his access.', 'CHECKPOINT C');
    } });
    game.objective('Pass the security checkpoint');
    await game.waitFor(() => game.flags.gate);
    game.objective('Cross Central Station to the Helix entrance');
    game.checkpoint(0, 0.15, -86, Math.PI);

    // ---------------- THE ZERO SECOND ----------------
    await game.waitFor(() => game.player.pos.z < -104);
    game.removeInteract(junTalk);
    game.control = false; ui.letterbox(true);
    audio.setTheme(null, 0.5);
    train.visible = true; train.position.set(13.5, 0.05, 60);
    const hornT = game.onUpdate(dt => { train.position.z -= 30 * dt; });
    audio.tone(311, 1.6, 'sawtooth', 0.06, audio.sfx); audio.tone(370, 1.6, 'sawtooth', 0.05, audio.sfx);
    await game.shot([4.5, 2.2, -112], [13, 2, -60], 1.6, { fov: 50 });
    await game.wait(0.6);
    // clocks stop
    hornT();
    for (const c of sh) c.visible = false; // stopped clock with no hands
    train.position.set(12.2, 0.6, -82); train.rotation.set(0.04, -0.28, 0.12);
    sp.userData.burst(new THREE.Vector3(12, 1, -96)); for (let k = 0; k < 6; k++) sp.userData.update(0.05);
    sp.userData.frozen = true;
    game.flags.frozen = true; rain.frozen = true;
    for (const w of walkers) w.c.frozen = true; for (const c of civs) c.frozen = true; jun.frozen = true; hale.frozen = true; child.frozen = true; mom.frozen = true;
    audio.silence(0); game.engine.fx.uFreeze.value = 1; ui.flash(200);
    await game.wait(1.2);
    await game.shot([11, 3.5, -100], [12, 1.4, -88], 2.0, { fov: 46 });
    await game.wait(0.8);
    await game.shot([3.5, 1.9, -108], [game.player.pos.x, 1.4, game.player.pos.z], 1.4, { fov: 58 });
    await game.talk([['kai', '…Nothing is moving. The rain. The train. Me — only me.'], ['kai', 'They\'re standing right where it\'s going to land.']]);
    game.releaseCam(); ui.letterbox(false); game.control = true;
    audio.setTheme('chronolith', 0.1); audio.unsilence(); audio.allBeds(0); audio.music.gain.value = 0.35;
    const hb = setInterval(() => audio.sfxPlay('heartbeat'), 1500);
    let saved = 0;
    game.objective('Time has stopped. Pull the civilians off the platform (0/3)');
    civs.forEach((c, k) => game.interact({ pos: c.root.position.clone().setY(1.1), radius: 2.0, hold: 0.9, prompt: 'Pull to safety (hold E)', onUse: () => {
      const from = c.root.position.clone(), to = new THREE.Vector3(-1.5 - k * 1.6, 0.15, -108 - k * 2.5);
      let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt * 1.6); c.root.position.lerpVectors(from, to, u * u * (3 - 2 * u)); if (u >= 1) off(); });
      audio.sfxPlay('rewind'); saved++;
      game.objective(saved < 3 ? `Time has stopped. Pull the civilians off the platform (${saved}/3)` : '');
    } }));
    await game.waitFor(() => saved >= 3);
    clearInterval(hb);
    await game.wait(1.2);
    game.control = false; ui.letterbox(true);
    await game.shot([-2, 2.4, -98], [11, 1.5, -108], 1.5, { fov: 55 });
    // time resumes — crash
    game.engine.fx.uFreeze.value = 0; ui.flash(150); audio.setTheme(null, 0.1); audio.rain(0.6); audio.crowd(0.25);
    game.flags.frozen = false; rain.frozen = false; sp.userData.frozen = false;
    for (const w of walkers) { w.c.frozen = false; w.speed = 3.5; } for (const c of civs) c.frozen = false; jun.frozen = false; hale.frozen = false; child.frozen = false; mom.frozen = false;
    game.flags.crash = true;
    let u = 0; const from = train.position.clone();
    audio.sfxPlay('metal'); game.shake = 0.5;
    const crash = game.onUpdate(dt => {
      u = Math.min(1, u + dt * 0.9); const e = 1 - Math.pow(1 - u, 3);
      train.position.set(from.x - e * 4.5, from.y - e * 0.45, from.z - e * 26); train.rotation.set(0.04, -0.28 - e * 0.25, 0.12 + e * 0.18);
      if (Math.random() < 0.3) sp.userData.burst(new THREE.Vector3(train.position.x - 1, 0.6, train.position.z - 8));
      if (u >= 1) crash();
    });
    const fire = new THREE.PointLight(0xff7a30, 80, 25, 1.8); fire.position.set(9, 2, -108); scene.add(fire);
    game.onUpdate((dt, t) => { fire.intensity = 60 + Math.sin(t * 17) * 15 + Math.sin(t * 7.3) * 10; });
    await game.wait(2.4);
    game.shake = 0;
    // dialogue
    jun.root.position.set(1.5, 0.15, -104); jun.lookTarget = game.player.char.head; jun.faceTowards(game.player.pos.x, game.player.pos.z, 1, 99);
    game.player.char.lookTarget = jun.head;
    await game.shot([game.player.pos.x + 1.6, 1.8, game.player.pos.z + 1.8], [jun.root.position.x, 1.6, jun.root.position.z], 1.4, { fov: 45 });
    await game.talk([
      ['jun', 'The event lasted one second.'],
      ['kai', 'What event?'],
      ['jun', 'That\'s the problem. Every recording says it hasn\'t happened yet.'],
    ]);
    // the voice
    game.flags.m1warning = true; audio.silence(1.6); await game.wait(0.3);
    game.engine.fx.uTint.value.set(1.15, 0.85, 0.85);
    await game.shot([0, 3, -96], [0, 14, -120], 2, { fov: 60 });
    await game.say('voice', 'Kai Varen. Do not build the machine.');
    game.engine.fx.uTint.value.set(1, 1, 1);
    // Mira in the crowd
    mira.root.visible = true; mira.lookTarget = game.player.char.head;
    await game.shot([game.player.pos.x + 0.6, 1.8, game.player.pos.z + 1.5], [mira.root.position.x, 1.6, mira.root.position.z], 1.6, { fov: 32 });
    audio.sfxPlay('motif');
    await game.say('kai', '…Mira?');
    const gm = mira.setGhost(0xb9a6ff); let a = 1;
    await new Promise(res => { const off = game.onUpdate(dt => { a -= dt * 0.7; gm.uniforms.uAlpha.value = Math.max(0, a); if (a <= 0) { off(); mira.root.visible = false; res(); } }); });
    ui.addEvidence('A woman like Mira', 'In the station crowd, a woman with Mira\'s face looked straight at Kai — then came apart like light. Mira has been dead 23 years.', 'CENTRAL STATION · 08:15');
    await game.wait(1);
    await ui.fade(1, 1600);
    game.releaseCam(); ui.letterbox(false);
    audio.allBeds(0); audio.setTheme(null);
  },
};
