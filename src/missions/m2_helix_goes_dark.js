import * as THREE from 'three';
import { box, glowMat, tileMaterial, canvasTex, chronolith, Motes } from '../world/kit.js';
import { Drone, sparks } from '../world/props.js';
import { Character } from '../core/character.js';
import { CAST } from '../story/cast.js';

const H = 4; // wall height

export default {
  id: 'm2', act: 'PROLOGUE · THE ZERO SECOND', title: 'Helix Goes Dark', sub: 'Helix Temporal Research Facility · 2049',
  async run(game) {
    const { ui, audio } = game;
    const scene = game.newScene({ background: 0x020305, fog: [0x05070a, 0.03], exposure: 1.1, bloom: 0.8, bloomThreshold: 0.85, envIntensity: 0.5 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.35, metalness: 0.15 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a9, roughness: 0.3, metalness: 0.5 });
    const floorMat = tileMaterial('#5a5e64', '#2a2c30', [10, 10], { roughness: 0.2, metalness: 0.2 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.35, metalness: 0.85 });

    const wall = (x0, z0, x1, z1, y = 0, h = H, mat = wallMat) => {
      const w = Math.max(0.3, Math.abs(x1 - x0)), d = Math.max(0.3, Math.abs(z1 - z0));
      const m = box(w, h, d, mat, (x0 + x1) / 2, y, (z0 + z1) / 2); scene.add(m); game.blocker(m);
      game.collision.add([Math.min(x0, x1) - (w === 0.3 ? 0.15 : 0), y, Math.min(z0, z1) - (d === 0.3 ? 0.15 : 0)], [Math.max(x0, x1) + (w === 0.3 ? 0.15 : 0), y + h, Math.max(z0, z1) + (d === 0.3 ? 0.15 : 0)]);
      // trim strip
      const trim = box(w + 0.02, 0.06, d + 0.02, glowMat(0xffffff, 0.6), (x0 + x1) / 2, y + 0.25, (z0 + z1) / 2); scene.add(trim); trims.push(trim);
      return m;
    };
    const trims = [];
    const floor = (x0, z0, x1, z1, y = 0) => { const f = box(x1 - x0, 0.2, z0 - z1, floorMat, (x0 + x1) / 2, y - 0.2, (z0 + z1) / 2, { cast: false }); scene.add(f); game.collision.add([x0, y - 0.2, z1], [x1, y, z0]); const c = box(x1 - x0, 0.2, z0 - z1, panelMat, (x0 + x1) / 2, y + H, (z0 + z1) / 2, { cast: false }); scene.add(c); };

    // ---------- layout ----------
    floor(-8, 0, 8, -14); floor(-2, -14, 2, -50); floor(-10, -16, -2, -26); floor(2, -18, 10, -28); floor(-12, -32, -2, -44); floor(2, -36, 9, -46); floor(-10, -50, 10, -68); floor(-2, -68, 2, -72);
    // lobby
    wall(-8, 0, 8, 0); wall(-8, 0, -8, -14); wall(8, 0, 8, -14); wall(-8, -14, -1.6, -14); wall(1.6, -14, 8, -14);
    // corridor walls with door gaps
    wall(-2, -14, -2, -16); wall(-2, -16, -2, -20); wall(-2, -22, -2, -26); wall(-2, -26, -2, -32); wall(-2, -32, -2, -37); wall(-2, -39, -2, -44); wall(-2, -44, -2, -50);
    wall(2, -14, 2, -18); wall(2, -18, 2, -24); wall(2, -26, 2, -28); wall(2, -28, 2, -36); wall(2, -36, 2, -40); wall(2, -42, 2, -46); wall(2, -46, 2, -50);
    // security office
    wall(-10, -16, -2, -16); wall(-10, -26, -2, -26); wall(-10, -16, -10, -26);
    // office A
    wall(2, -18, 10, -18); wall(2, -28, 10, -28); wall(10, -18, 10, -28);
    // archive
    wall(-12, -32, -2, -32); wall(-12, -44, -2, -44); wall(-12, -32, -12, -44);
    // maintenance
    wall(2, -36, 9, -36); wall(2, -46, 9, -46); wall(9, -36, 9, -46);
    // power room
    wall(-10, -50, -2, -50); wall(2, -50, 10, -50); wall(-10, -50, -10, -68); wall(10, -50, 10, -68); wall(-10, -68, -2, -68); wall(2, -68, 10, -68);
    wall(-2, -68, -2, -72); wall(2, -68, 2, -72);
    // lift shaft back wall (open below)
    wall(-2, -72, 2, -72, -14, H + 14, steel);

    // ---------- lighting ----------
    scene.add(new THREE.HemisphereLight(0x9fb4c8, 0x101010, 0.18));
    const lights = [];
    const lamp = (x, y, z, c = 0xeaf4ff, i = 26, d = 14) => { const l = new THREE.PointLight(c, i, d, 1.6); l.position.set(x, y, z); scene.add(l); lights.push(l); const panel = box(1.4, 0.04, 0.4, glowMat(c, 3), x, y + 0.3, z, { cast: false }); scene.add(panel); l.userData.panel = panel; return l; };
    lamp(-4, 3.4, -5); lamp(4, 3.4, -9); lamp(0, 3.4, -20); lamp(0, 3.4, -34); lamp(0, 3.4, -46); lamp(-6, 3.4, -21); lamp(6, 3.4, -23); lamp(-7, 3.4, -38); lamp(5.5, 3.4, -41); lamp(-5, 3.4, -58); lamp(5, 3.4, -62);
    const key = new THREE.SpotLight(0xffffff, 120, 30, 0.7, 0.5, 1.4); key.position.set(0, 3.9, -6); key.target.position.set(0, 0, -8); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key, key.target);
    let emergency = false;
    const setEmergency = (on) => {
      emergency = on;
      for (const l of lights) { l.color.set(on ? 0xff2030 : 0xeaf4ff); l.intensity = on ? 14 : 26; l.userData.panel.material.emissive.set(on ? 0xff1020 : 0xeaf4ff); }
      for (const t of trims) t.material.emissive.set(on ? 0x601010 : 0xffffff);
      key.color.set(on ? 0xff3040 : 0xffffff); key.intensity = on ? 40 : 120;
    };
    game.onUpdate((dt, t) => { if (!emergency) return; for (let k = 0; k < lights.length; k++) { const l = lights[k]; const f = (Math.sin(t * 3 + k) * 0.5 + 0.5); l.intensity = 6 + f * 14 * (Math.sin(t * 31 + k * 7) > 0.96 ? 0.2 : 1); } });
    // rotating beacons
    const beacons = [];
    for (const [x, z] of [[0, -14.3], [0, -49.7], [-1.7, -60], [9.6, -55]]) { const b = new THREE.SpotLight(0xff2030, 0, 16, 0.35, 0.3, 1.2); b.position.set(x, 3.6, z); scene.add(b, b.target); beacons.push(b); const bulb = box(0.2, 0.2, 0.2, glowMat(0xff2030, 0), x, 3.5, z); scene.add(bulb); b.userData.bulb = bulb; }
    game.onUpdate((dt, t) => { for (const b of beacons) { if (!emergency) continue; b.intensity = 50; b.userData.bulb.material.emissiveIntensity = 4; const a = t * 3; b.target.position.set(b.position.x + Math.cos(a) * 5, 0, b.position.z + Math.sin(a) * 5); } });
    const dust = new Motes(500, [-10, 0.2, -70, 10, 3.8, 0], 0xcfe0ff, 0.04, 0.1); scene.add(dust.mesh); game.onUpdate(dt => dust.update(dt));

    // ---------- props ----------
    const desk = (x, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.add(box(2, 0.08, 0.9, new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.3 }), 0, 0.74, 0)); g.add(box(1.9, 0.72, 0.05, steel, 0, 0, -0.4)); const mon = box(0.8, 0.5, 0.04, new THREE.MeshStandardMaterial({ color: 0x0a0e14, emissive: 0x3a8aff, emissiveIntensity: 0.9 }), 0, 0.85, -0.25); g.add(mon); scene.add(g); game.collision.addBox(x, 0, z, ry ? 0.9 : 2, 1, ry ? 2 : 0.9); return g; };
    desk(0, -9.5); desk(-6, -19, 0); desk(-6, -23.5); desk(6, -21); desk(6, -25.5); desk(-9, -36, Math.PI / 2);
    // archive shelves
    for (let k = 0; k < 4; k++) { const sh = box(5.5, 2.6, 0.6, steel, -7.5, 0, -34 - k * 2.6); scene.add(sh); game.collision.addBox(-7.5, 0, -34 - k * 2.6, 5.5, 2.6, 0.6); for (let j = 0; j < 14; j++) scene.add(box(0.3, 0.38, 0.45, new THREE.MeshStandardMaterial({ color: [0x8a6a4a, 0x4a5a6a, 0xd8d2c0][j % 3], roughness: 0.8 }), -10 + j * 0.38, 0.4 + (j % 3) * 0.8, -34 - k * 2.6)); }
    // maintenance pipes
    for (let k = 0; k < 5; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 10, 10), steel); p.rotation.z = Math.PI / 2; p.position.set(5.5, 3.2 - k * 0.3, -45.5 + k * 0.1); scene.add(p); }
    // lobby: Helix logo wall + reception
    const logoTex = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = '#5fe6ff'; g.lineWidth = 8; g.shadowColor = '#5fe6ff'; g.shadowBlur = 16; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(120, 128, 50 + k * 20, k, k + 4.8); g.stroke(); } g.fillStyle = '#e8f8ff'; g.font = '600 64px Cinzel, serif'; g.fillText('HELIX', 220, 150); }, 'helixlogo');
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, blending: THREE.AdditiveBlending, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false })); lg.position.set(0, 2.4, -13.8); scene.add(lg);

    // ---------- power room ----------
    const gen = new THREE.Group(); gen.position.set(0, 0, -62); scene.add(gen);
    gen.add(box(5, 3, 2.2, steel, 0, 0, 0)); game.collision.addBox(0, 0, -62, 5, 3, 2.2);
    const slots = [];
    for (let k = 0; k < 3; k++) { const s = box(0.5, 0.8, 0.3, new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0xff2030, emissiveIntensity: 1 }), -1.4 + k * 1.4, 1, 1.15); gen.add(s); slots.push(s); }
    const coreGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.4, 24), glowMat(0x5fe6ff, 0)); coreGlow.position.y = 1.5; coreGlow.position.z = -0.2; gen.add(coreGlow);
    // damaged conduit (lure zone)
    const conduitPos = new THREE.Vector3(7, 0, -58.5);
    const conduit = new THREE.Group(); conduit.position.copy(conduitPos); scene.add(conduit);
    conduit.add(box(0.6, 3.6, 0.6, steel, 2.4, 0, 0));
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), cableMat); c.position.set(1.0 - k * 0.5, 2.4, 0); c.rotation.z = 0.6 + k * 0.4; conduit.add(c); }
    const zoneDisc = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.6, 48), new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.25, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    zoneDisc.rotation.x = -Math.PI / 2; zoneDisc.position.set(0, 0.03, 0); conduit.add(zoneDisc);
    const spk = sparks(80, 0xffd080); scene.add(spk); game.onUpdate(dt => spk.userData.update(dt));
    let sparkT = 0; game.onUpdate(dt => { sparkT -= dt; if (sparkT < 0) { sparkT = 1 + Math.random() * 2; spk.userData.burst(new THREE.Vector3(conduitPos.x + 0.8, 2.6, conduitPos.z)); audio.sfxPlay('spark'); } });
    const arc = new THREE.PointLight(0x9fd8ff, 0, 12, 1.5); arc.position.set(conduitPos.x, 1.5, conduitPos.z); scene.add(arc);
    const lever = new THREE.Group(); lever.position.set(9.6, 1.3, -54); scene.add(lever);
    lever.add(box(0.25, 0.6, 0.4, steel, 0, -0.3, 0));
    const handle = box(0.06, 0.5, 0.06, new THREE.MeshStandardMaterial({ color: 0xffb030, emissive: 0x804000 }), 0, 0, 0); handle.rotation.z = 0.6; lever.add(handle);
    // lift
    const lift = new THREE.Group(); lift.position.set(0, 0, -70); scene.add(lift);
    lift.add(box(3.8, 0.2, 3.8, steel, 0, -0.2, 0));
    for (const s of [-1, 1]) lift.add(box(0.08, 1.1, 3.6, new THREE.MeshStandardMaterial({ color: 0xffb030, metalness: 0.6 }), s * 1.85, 0, 0));
    const liftBox = game.collision.add([-1.9, -0.2, -71.9], [1.9, 0, -68.1]);
    const liftGate = box(3.8, 2.6, 0.08, new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.9, roughness: 0.3, transparent: true, opacity: 0.85 }), 0, 0, -68.1); scene.add(liftGate);
    const liftGateBox = game.collision.add([-2, 0, -68.3], [2, 3, -67.9]);
    // lower level (y = -12): temporal lab approach + chamber door
    const LY = -12;
    floor(-2.5, -72, 2.5, -96, LY);
    wall(-2.5, -72, -2.5, -96, LY, H, steel); wall(2.5, -72, 2.5, -96, LY, H, steel);
    const doorL = box(2.5, 4, 0.5, new THREE.MeshPhysicalMaterial({ color: 0x0c0d10, metalness: 0.9, roughness: 0.2, clearcoat: 1 }), -1.25, LY, -95.5), doorR = doorL.clone(); doorR.position.x = 1.25; scene.add(doorL, doorR);
    const doorBox = game.collision.add([-2.5, LY, -95.8], [2.5, LY + 4, -95.2]);
    const doorRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.08, 8, 64), glowMat(0x5fe6ff, 2)); doorRing.position.set(0, LY + 2, -95.1); scene.add(doorRing);
    for (let z = -74; z > -95; z -= 4) { const l = new THREE.PointLight(0x5fe6ff, 8, 7, 1.6); l.position.set(0, LY + 3.6, z); scene.add(l); scene.add(box(0.3, 0.04, 2.5, glowMat(0x5fe6ff, 2.5), 0, LY + 3.95, z, { cast: false })); }
    const beyond = chronolith(0.9, { power: 0.7 }); beyond.position.set(0, LY + 3, -108); scene.add(beyond); game.onUpdate((dt, t) => beyond.userData.update(t));
    const beyondLight = new THREE.PointLight(0x9fe8ff, 0, 30, 1.2); beyondLight.position.set(0, LY + 2, -100); scene.add(beyondLight);
    // the child's drawing on the floor
    const drawingTex = canvasTex(512, 384, (g, w, h) => {
      g.fillStyle = '#f2ead6'; g.fillRect(0, 0, w, h);
      const crayon = (c, pts, lw = 6) => { g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x + Math.random() * 2, y + Math.random() * 2) : g.moveTo(x, y)); g.stroke(); };
      g.fillStyle = '#111'; g.beginPath(); g.arc(330, 170, 110, 0, 7); g.fill(); g.fillStyle = '#f2ead6'; g.beginPath(); g.arc(330, 170, 70, 0, 7); g.fill();
      crayon('#3aa0d0', [[260, 170], [300, 140], [360, 200], [400, 170]], 4);
      const kid = (x, c, hair, hl) => { g.fillStyle = '#f0c0a0'; g.beginPath(); g.arc(x, 210, 22, 0, 7); g.fill(); crayon(hair, hl, 8); crayon(c, [[x, 232], [x, 300]], 10); crayon(c, [[x - 25, 255], [x + 25, 255]], 6); crayon('#333', [[x, 300], [x - 15, 345]]); crayon('#333', [[x, 300], [x + 15, 345]]); };
      kid(90, '#d03a2a', '#222', [[70, 195], [90, 186], [110, 195]]);
      kid(160, '#7a4ad0', '#222', [[138, 195], [160, 184], [182, 195], [184, 230]]);
      crayon('#d03a2a', [[115, 255], [135, 255]], 6);
      g.fillStyle = '#222'; g.font = '28px "Comic Sans MS", cursive'; g.fillText('ME', 70, 370); g.fillText('MIRA', 128, 370); g.fillText('THE MACHINE', 260, 330);
      g.fillStyle = '#b02020'; g.font = '18px monospace'; g.fillText('HELIX ARCHIVE · 2026', 330, 30);
    }, 'drawing');
    const drawing = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshStandardMaterial({ map: drawingTex, roughness: 0.9 }));
    drawing.rotation.x = -Math.PI / 2; drawing.rotation.z = 0.3; drawing.position.set(0.6, LY + 0.02, -90); scene.add(drawing);

    // ---------- characters ----------
    const rook = game.actor('rook', null, 0.5, 0, -11, Math.PI * 0.95);
    const hale = game.actor('hale', null, -1.8, 0, -11.5, Math.PI * 0.8);
    const iven = game.actor('iven', null, 7.2, 0, -43.5, -Math.PI / 2);
    iven.crouch = 0.6;
    // residue echoes in the security office
    const echoBrandt = new Character(CAST.brandt.look); echoBrandt.root.position.set(-5, 0, -21.5); echoBrandt.root.rotation.y = Math.PI / 2; echoBrandt.setGhost(0x5fe6ff); scene.add(echoBrandt.root); game.residue(echoBrandt.root);
    const echoHale = new Character(CAST.hale.look); echoHale.root.position.set(-3.6, 0, -21.5); echoHale.root.rotation.y = -Math.PI / 2; echoHale.setGhost(0x5fe6ff); scene.add(echoHale.root); game.residue(echoHale.root);
    game.onUpdate(dt => { echoBrandt.update(dt); echoHale.update(dt); });
    // residue footprints toward cell 1
    const fpMat = new THREE.MeshBasicMaterial({ color: 0x5fe6ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let k = 0; k < 12; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.28), fpMat); f.rotation.x = -Math.PI / 2; const u = k / 11; f.position.set(0.3 * (k % 2 ? 1 : -1) + u * 7, 0.02, -15 - u * 9.5); f.rotation.z = -Math.atan2(7, -9.5); scene.add(f); game.residue(f); }

    // ---------- drones ----------
    const drones = [
      new Drone(game, [[0, 2.6, -16], [0, 2.6, -47]], { speed: 1.5, range: 8.5 }),
      new Drone(game, [[0, 2.6, -47], [0, 2.6, -16]], { speed: 1.2, range: 7.5 }),
    ];
    drones.forEach(d => { d.mesh.visible = false; d.disabled = true; });
    let maxAlert = 0;
    game.onUpdate(dt => {
      maxAlert = 0; for (const d of drones) maxAlert = Math.max(maxAlert, d.update(dt));
      ui.detection(maxAlert);
      if (maxAlert >= 1 && game.control) { game.fail('DETECTED BY SECURITY DRONE'); }
    });
    const resetDrones = () => { drones[0].mesh.position.copy(drones[0].path[0]); drones[0].i = 0; drones[1].mesh.position.copy(drones[1].path[0]); drones[1].i = 0; drones.forEach(d => d.alert = 0); };

    // ---------- warden ----------
    const warden = makeWarden(); warden.position.set(-7, 0, -66); scene.add(warden); warden.visible = false;
    const W = { active: false, pos: warden.position, vel: new THREE.Vector3(), hp: 3, dead: false, stun: 0 };

    // ---------- SCRIPT ----------
    audio.hum(0.12, 55); audio.setTheme(null);
    ui.missionTag('MISSION 2 · HELIX GOES DARK'); ui.show('hud', true);
    game.temporal.configure([{ id: '2049', key: '1', name: 'PRESENT', year: '2049', glyph: '◎', color: '#5fe6ff' }], '2049');
    ui.era('PRESENT', 'HELIX FACILITY · 2049', '◎', [], '#5fe6ff');
    game.player.place(0, 0, -2, Math.PI);
    setEmergency(false);
    game.control = false; ui.letterbox(true);
    game.engine.camera.position.set(3, 2.4, -3);
    await ui.fade(0, 1400);
    await ui.chapterCard('PROLOGUE · THE ZERO SECOND', 'Helix Goes Dark', 'Helix Temporal Research Facility', 3200);
    rook.lookTarget = game.player.char.head; hale.lookTarget = game.player.char.head; game.player.char.lookTarget = rook.head;
    await game.shot([2.5, 1.9, -6.5], [0.5, 1.6, -11], 1.8, { fov: 42 });
    await game.talk([
      ['rook', 'Kai. You came in through the station. Of course you did.'],
      ['kai', 'A train stopped in mid-air, Elias. I pulled three people out from under it.'],
      ['rook', 'A system failure. A sensor cascade. Nothing more.'],
      ['kai', 'Every recording says it hasn\'t happened yet.'],
      ['rook', 'Then the recordings are wrong.'],
      ['rook', 'Go home. The central chamber is sealed and the main lift is locked out. Officer Hale will see you to the door.'],
    ]);
    // lockdown
    audio.sfxPlay('alarm'); setEmergency(true); ui.flash(80); audio.hum(0.2, 41);
    await ui.subtitle('speaker', 'Containment fault. Facility lockdown initiated. All personnel shelter in place.', 3200);
    await game.talk([
      ['hale', 'That\'s not a drill tone. Director—'],
      ['rook', 'Stay with him, Hale.'],
    ]);
    // Rook & Hale leave through the north door
    const leave = (c, dx) => { c.lookTarget = null; let u = 0; const from = c.root.position.clone(); const off = game.onUpdate(dt => { u += dt * 0.25; c.speed = 1.6; c.faceTowards(dx, -30, dt); c.root.position.lerpVectors(from, new THREE.Vector3(dx, 0, -30), Math.min(1, u)); if (u >= 1) { c.root.visible = false; off(); } }); };
    leave(rook, 0.2); await game.wait(0.6); leave(hale, -0.6);
    await game.shot([0, 2.4, -6], [0, 1.4, -18], 2.2, { fov: 55 });
    drones.forEach(d => { d.mesh.visible = true; d.disabled = false; });
    audio.sfxPlay('drone');
    await game.talk([['kai', 'Drones in the corridor. Lockdown means they flag anyone not on a shelter list.'], ['kai', 'The main lift is locked. There\'s a service lift behind the power room — if it has power.']]);
    game.releaseCam(); ui.letterbox(false); game.control = true;
    game.player.char.lookTarget = null;
    audio.setTheme('stealth');
    game.objective('Find a way down: restore power to the service lift');
    ui.toast('C to crouch · stay out of the drones\' light', 4500);
    game.checkpoint(0, 0, -11, Math.PI, resetDrones);

    // residue vision unlock, entering security office
    let cells = 0;
    const cellObj = () => game.objective(`Collect power cells (${cells}/3) · Restore the service lift`);
    const makeCell = (x, z, y = 0.9) => {
      const c = new THREE.Group(); c.position.set(x, y, z); scene.add(c);
      c.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 16), steel));
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 16), glowMat(0x5fe6ff, 4)); c.add(core);
      const pl = new THREE.PointLight(0x5fe6ff, 4, 4, 1.5); c.add(pl);
      game.onUpdate((dt, t) => { c.rotation.y += dt; c.position.y = y + Math.sin(t * 2) * 0.03; });
      game.interact({ pos: [x, 1, z], radius: 1.8, prompt: 'Take power cell', onUse: () => { scene.remove(c); cells++; audio.sfxPlay('pickup'); cellObj(); } });
    };
    game.onUpdate(() => { if (!game.residueUnlocked && game.player.pos.x < -2.5 && game.player.pos.z < -15 && game.player.pos.z > -26) { game.residueUnlocked = true; residueIntro(); } });
    const residueIntro = async () => {
      game.player.char.wristBoost = 8; audio.sfxPlay('anomaly');
      await game.say('kai', 'My wrist — it\'s reacting to this room. Like the street. Like the toy.');
      ui.toast('RESIDUE VISION UNLOCKED\nPress F to see temporal echoes', 5000);
      game.objective('Press F — inspect the temporal residue in the security office');
      await game.waitFor(() => game.residueOn);
      cellObj();
    };
    let heardEcho = false;
    game.interact({ pos: [-4.3, 1.3, -21.5], radius: 2.6, prompt: 'Listen to the echo', enabled: () => game.residueOn, onUse: async () => {
      echoBrandt.talk = 3;
      await game.talk([
        ['brandt', 'Rook wants the chamber logs wiped before the inspectors get here. All of 08:14.'],
        ['hale', 'Not my call. I\'m not touching anything with Varen\'s name on it.'],
        ['brandt', 'Then I\'ll do it. And you didn\'t see me, Hale. Understood?'],
        ['hale', 'I saw you.'],
      ]);
      heardEcho = true;
      ui.addEvidence('Residue: the wiped logs', 'An echo in the security office: Brandt ordered by Rook to wipe the 08:14 chamber logs. Hale refused.', 'HELIX SECURITY · 07:58');
    } });
    makeCell(-6, -23.5 + 0.1, 0.95); // security office desk
    makeCell(8.6, -19.2, 0.9); // office A (footprints lead here)
    // Iven in maintenance
    game.interact({ pos: [7.2, 1, -43.5], radius: 2.4, prompt: 'Talk to the technician', onUse: async () => {
      iven.lookTarget = game.player.char.head; iven.crouch = 0;
      await game.talk([
        ['iven', 'Don\'t — oh. You\'re not security. You\'re Varen. Your face is on half the access logs this morning.'],
        ['kai', 'I just got here.'],
        ['iven', 'Then you\'ve been here twice. Listen — Rook ran a full Chronolith test at 08:14. Nobody approved it. My team was in the chamber.'],
        ['iven', 'Take this cell. The generator needs three. And don\'t trust anyone on the security channel who sounds too helpful.'],
      ]);
      cells++; audio.sfxPlay('pickup'); cellObj();
      ui.addEvidence('Iven Marr\'s testimony', 'Rook ran an unapproved full Chronolith test at 08:14. Iven\'s team was inside the chamber.', 'MAINTENANCE · 08:31');
    } });
    // optional archive: Mira evidence
    const file = box(0.4, 0.05, 0.3, new THREE.MeshStandardMaterial({ color: 0xd8c8a0, emissive: 0x403020, emissiveIntensity: 0.4 }), -9, 0.79, -36); scene.add(file);
    game.interact({ pos: [-9, 1, -36], radius: 2, prompt: 'Read the open personnel file', onUse: async () => {
      audio.sfxPlay('motif');
      await game.talk([
        ['kai', 'VAREN, MIRA. Status: deceased, 2026. Last record access…'],
        ['kai', 'Today. 08:14. From inside the central chamber.'],
      ]);
      ui.addEvidence('Mira\'s file — accessed today', 'Mira Varen: deceased 2026. Her personnel record was opened at 08:14 today, from inside the sealed central chamber.', 'HELIX ARCHIVE');
    } });

    await game.waitFor(() => cells >= 3);
    game.objective('Insert the power cells into the generator');
    let inserted = false;
    game.interact({ pos: [0, 1.2, -60.6], radius: 2.4, prompt: 'Insert power cells', onUse: () => { inserted = true; } });
    await game.waitFor(() => inserted);
    game.checkpoint(0, 0, -52, Math.PI, () => { resetDrones(); W.pos.set(-7, 0, -66); W.stun = 1.5; });
    for (let k = 0; k < 3; k++) { slots[k].material.emissive.set(0x5fe6ff); audio.sfxPlay('pickup'); await game.wait(0.3); }
    coreGlow.material.emissiveIntensity = 3; audio.hum(0.25, 62);
    // the Warden wakes
    game.control = false; ui.letterbox(true);
    warden.visible = true;
    await game.shot([2, 2.2, -56], [-7, 1.8, -66], 1.6, { fov: 48 });
    audio.sfxPlay('metal'); warden.userData.eye.material.emissiveIntensity = 8;
    await ui.subtitle('speaker', 'Unauthorized power draw. Warden unit activated.', 2600);
    await game.talk([['kai', 'A Warden. Helix built those to hold the chamber. You can\'t hurt one — it rewinds damage.']]);
    audio.setTheme('tension');
    game.releaseCam(); ui.letterbox(false); game.control = true;
    W.active = true;
    game.objective('Lure the Warden into the damaged conduit, then pull the breaker');
    (async () => { await game.wait(4); await ui.subtitle('iven', 'Varen! It rewinds any damage that ENDS. So don\'t let it end — the conduit by the breaker!', 4500); })();
    let arcOn = 0, rewinds = 0, leverCD = 0;
    game.interact({ pos: [9.3, 1.3, -54], radius: 2, once: false, prompt: 'Pull the breaker', enabled: () => leverCD <= 0 && !W.dead, onUse: () => {
      leverCD = 3; handle.rotation.z = -0.6; audio.sfxPlay('spark'); audio.sfxPlay('boom');
      arcOn = 2.6; spk.userData.burst(new THREE.Vector3(conduitPos.x, 1.5, conduitPos.z));
    } });
    game.onUpdate((dt, t) => {
      leverCD -= dt; if (leverCD <= 0) handle.rotation.z = 0.6;
      arc.intensity = arcOn > 0 ? 40 + Math.random() * 60 : 0; zoneDisc.material.opacity = arcOn > 0 ? 0.8 : 0.2 + Math.sin(t * 4) * 0.08;
      if (!W.active || W.dead) return;
      const inZone = W.pos.distanceTo(conduitPos) < 2.2;
      if (arcOn > 0) {
        arcOn -= dt;
        if (inZone) {
          W.stun = 0.5; warden.userData.flicker = true;
          if (Math.random() < dt * 6) spk.userData.burst(W.pos.clone().setY(1.5));
          if ((W.zap = (W.zap || 0) + dt) > 0.8) { W.zap = 0; rewinds++; audio.sfxPlay('rewind'); game.engine.fx.uShift.value = 0.35; setTimeout(() => game.engine.fx.uShift.value = 0, 120); }
          if (rewinds >= 3) { W.dead = true; }
        }
      } else warden.userData.flicker = false;
      // chase
      if (W.stun > 0) { W.stun -= dt; return; }
      const to = game.player.pos.clone().sub(W.pos).setY(0); const d = to.length();
      to.normalize();
      W.vel.lerp(to.multiplyScalar(2.7), Math.min(1, dt * 3)); W.vel.y = 0;
      W.pos.addScaledVector(W.vel, dt);
      game.collision.resolve(W.pos, new THREE.Vector3(), 0.7, 2.6, '2049', dt); W.pos.y = 0;
      warden.rotation.y = Math.atan2(W.vel.x, W.vel.z);
      warden.userData.walk(t, W.vel.length());
      if (d < 1.4 && game.control) { audio.sfxPlay('metal'); game.fail('THE WARDEN CAUGHT YOU'); }
    });
    game.onUpdate((dt, t) => { if (warden.userData.flicker) warden.children.forEach((c, i) => c.visible = Math.sin(t * 60 + i) > -0.6); else warden.children.forEach(c => c.visible = true); });
    await game.waitFor(() => W.dead);
    game.control = false; warden.userData.flicker = false;
    audio.sfxPlay('metal'); audio.setTheme(null);
    await game.shot([W.pos.x - 3, 2, W.pos.z + 3], [W.pos.x, 1.2, W.pos.z], 1.2);
    let fall = 0; await new Promise(res => { const off = game.onUpdate(dt => { fall = Math.min(1, fall + dt * 1.5); warden.rotation.x = fall * 1.4; warden.position.y = -fall * 0.3; if (fall >= 1) { off(); res(); } }); });
    game.shake = 0.3; await game.wait(0.4); game.shake = 0;
    await game.talk([['kai', 'It rewinds damage. It can\'t rewind a current that never stops.']]);
    game.releaseCam(); game.control = true;
    // lift authorization choice
    game.objective('Use the service lift');
    await game.waitFor(() => game.player.pos.z < -64.5 && Math.abs(game.player.pos.x) < 3);
    game.control = false;
    await ui.subtitle('hale', 'Varen? It\'s Hale. I see you on the power-room camera. I can release the service lift.', 3800);
    await ui.subtitle('brandt', 'Ignore him. Hale\'s compromised. I\'m the one with override authority — let me guide you.', 3800);
    const pick = await game.choice('kai', heardEcho ? '(The echo in the security office: Brandt wiped the logs. Hale refused.)' : 'Two voices. Only one of them wants me down there.', ['Trust Hale.', 'Trust Brandt.']);
    game.flags.trustedHale = pick === 0;
    if (pick === 0) {
      await game.talk([['hale', 'Lift\'s released. And Varen — whatever Rook buried down there, I didn\'t help him bury it.']]);
    } else {
      audio.sfxPlay('alarm');
      await game.talk([['brandt', 'Thank you, Doctor. Security, he\'s at the service lift.'], ['kai', '…Of course.']]);
      await ui.subtitle('hale', 'Brandt locked the lift. There\'s a manual release on the left rail — crank it, fast!', 3600);
      game.control = true;
      drones[0].mesh.position.set(0, 2.6, -52); drones[0].path = [new THREE.Vector3(-6, 2.6, -56), new THREE.Vector3(6, 2.6, -56)]; drones[0].alert = 0.4;
      let cranked = false;
      game.objective('Crank the manual lift release (hold E)');
      game.interact({ pos: [-1.6, 1, -67.5], radius: 1.8, hold: 2.5, prompt: 'Crank manual release (hold E)', onUse: () => { cranked = true; } });
      await game.waitFor(() => cranked);
      game.control = false; drones.forEach(d => { d.disabled = true; });
    }
    drones.forEach(d => { d.disabled = true; }); ui.detection(0);
    // ride down with Iven
    audio.sfxPlay('door'); liftGateBox.enabled = false;
    await new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt); liftGate.position.y = u * 2.8; if (u >= 1) { off(); res(); } }); });
    iven.root.visible = true; iven.root.position.set(1, 0, -69.5); iven.crouch = 0; iven.lookTarget = null;
    game.player.place(-0.6, 0, -70.5, Math.PI);
    await game.shot([3.5, 2.5, -63], [0, 1.2, -70], 1);
    await game.say('iven', 'You\'re going to the chamber. I\'m coming. My team was in there at 08:14.');
    liftBox.enabled = false;
    audio.sfxPlay('door'); audio.hum(0.3, 36);
    await new Promise(res => {
      let y = 0; const off = game.onUpdate(dt => {
        y = Math.max(LY, y - dt * 2.4); lift.position.y = y; game.player.pos.y = y; iven.root.position.y = y; game.player.vel.set(0, 0, 0);
        game.cine.to.p.set(3.2, y + 2.4, -66); game.cine.to.l.set(0, y + 1.2, -70);
        if (y <= LY) { off(); res(); }
      });
      game.shot([3.2, 2.4, -66], [0, 1.2, -70], 0.01);
    });
    game.collision.add([-1.9, LY - 0.2, -71.9], [1.9, LY, -68.1]);
    setEmergency(false); audio.setTheme('chronolith');
    game.releaseCam(); game.control = true;
    game.checkpoint(0, LY, -74, Math.PI);
    iven.lookTarget = game.player.char.head;
    game.onUpdate(dt => { // Iven follows
      if (!iven.root.visible) return; const to = game.player.pos.clone().sub(iven.root.position).setY(0); const d = to.length();
      if (d > 2.2) { to.normalize(); iven.root.position.addScaledVector(to, dt * Math.min(3.5, d)); iven.speed = Math.min(3.5, d); iven.faceTowards(game.player.pos.x, game.player.pos.z, dt); } else iven.speed = 0;
    });
    game.objective('Reach the central chamber');
    let readDrawing = false;
    game.interact({ pos: [0.6, LY + 0.6, -90], radius: 2.2, prompt: 'Pick up the drawing', onUse: () => { readDrawing = true; } });
    await game.waitFor(() => readDrawing);
    game.control = false; ui.letterbox(true);
    await game.shot([1.8, LY + 1.4, -88], [0.6, LY + 0.1, -90], 1.2, { fov: 38 });
    audio.sfxPlay('motif');
    await game.talk([
      ['kai', 'Two kids. A boy and a girl. Holding hands next to a black ring.'],
      ['kai', '"Me. Mira. The machine." That\'s my handwriting.'],
    ]);
    iven.root.position.set(-1, LY, -88.6); iven.faceTowards(0.6, -90, 1, 99);
    await game.shot([-2.4, LY + 1.8, -86.5], [0.2, LY + 1.4, -89.5], 1.2, { fov: 45 });
    await game.talk([
      ['iven', 'Archive stamp says 2026. This drawing is twenty-three years old.'],
      ['iven', 'Then someone has been using your credentials. For a very long time.'],
      ['kai', 'I was twelve.'],
    ]);
    ui.addEvidence('A child\'s drawing', 'Two children beside a black circular machine: "ME · MIRA · THE MACHINE." Kai\'s handwriting. Archived by Helix in 2026 — when Kai was twelve.', 'LOWER LEVEL');
    // the chamber opens
    doorBox.enabled = false; audio.sfxPlay('door');
    await game.shot([0, LY + 1.7, -84], [0, LY + 2, -100], 1.4, { fov: 50 });
    beyondLight.intensity = 0;
    await new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt * 0.5); doorL.position.x = -1.25 - u * 2.4; doorR.position.x = 1.25 + u * 2.4; beyondLight.intensity = u * 120; if (u >= 1) { off(); res(); } }); });
    audio.sfxPlay('switch');
    await game.shot([0, LY + 1.7, -93], [0, LY + 3, -108], 2.4, { fov: 55 });
    await game.say('kai', 'The Chronolith.');
    ui.flash(400); await ui.fade(1, 1400);
    game.releaseCam(); ui.letterbox(false); audio.allBeds(0);
  },
};

function makeWarden() {
  const g = new THREE.Group();
  const armor = new THREE.MeshPhysicalMaterial({ color: 0xd8dce0, metalness: 0.5, roughness: 0.3, clearcoat: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 0.8, roughness: 0.4 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 0.8), armor); torso.position.y = 2.0; g.add(torso);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 20), glowMat(0x5fe6ff, 4)); core.rotation.x = Math.PI / 2; core.position.set(0, 2.05, 0.41); g.add(core);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.55), dark); head.position.y = 2.8; g.add(head);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.05), glowMat(0xff2030, 2)); eye.position.set(0, 2.82, 0.28); g.add(eye);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.6), dark); hips.position.y = 1.3; g.add(hips);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.35, 1.2, 0); g.add(leg);
    const th = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.2, 0.36), armor); th.position.y = -0.6; leg.add(th); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(s * 0.85, 2.4, 0); g.add(arm);
    const up = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.3, 0.3), armor); up.position.y = -0.65; arm.add(up);
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), dark); fist.position.y = -1.4; arm.add(fist); arms.push(arm);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { eye, walk(t, v) { const a = Math.min(1, v / 2) * 0.6; legs.forEach((l, i) => l.rotation.x = Math.sin(t * 6 + i * Math.PI) * a); arms.forEach((l, i) => l.rotation.x = -Math.sin(t * 6 + i * Math.PI) * a * 0.8); } };
  return g;
}
