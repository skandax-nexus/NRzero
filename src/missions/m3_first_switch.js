import * as THREE from 'three';
import { box, glowMat, tileMaterial, concreteMaterial, canvasTex, rng, chronolith, Motes, cableCurve } from '../world/kit.js';
import { Character } from '../core/character.js';
import { CAST } from '../story/cast.js';

export default {
  id: 'm3', act: 'PROLOGUE · THE ZERO SECOND', title: 'The First Switch', sub: 'Chronolith Chamber · 2026 / 2049 / 2196',
  async run(game) {
    const { ui, audio } = game, T = game.temporal;
    const scene = game.newScene({ background: 0x020305, fog: [0x06080c, 0.028], exposure: 1.1, bloom: 0.85, bloomThreshold: 0.85, envIntensity: 0.45, killY: -8, residue: true });
    const R = rng(196);
    const G = { '2026': new THREE.Group(), '2049': new THREE.Group(), '2196': new THREE.Group() };
    for (const k in G) { scene.add(G[k]); T.only(G[k], k); }
    const S = (state, mesh) => { G[state].add(mesh); return mesh; };
    const col = (states, min, max) => game.collision.add(min, max, { states });

    // ---------- materials per era ----------
    const M = {
      '2026': { wall: concreteMaterial('#7a7670', [3, 2]), floor: concreteMaterial('#5a5650', [6, 6]), trim: glowMat(0xffa040, 2) },
      '2049': { wall: new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.3, metalness: 0.2 }), floor: tileMaterial('#6a6e74', '#2a2c30', [12, 12], { roughness: 0.18, metalness: 0.3 }), trim: glowMat(0x5fe6ff, 2.5) },
      '2196': { wall: concreteMaterial('#4a5048', [3, 2], { stains: true }), floor: concreteMaterial('#3a4036', [6, 6], { stains: true }), trim: glowMat(0x3a5a40, 0.5) },
    };
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.35, metalness: 0.85 });
    const rust = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.9, metalness: 0.4 });

    // ---------- the chamber (circular, radius 12) ----------
    const RAD = 12;
    for (const st of ['2026', '2049', '2196']) {
      const wallM = M[st].wall.clone(); wallM.side = THREE.BackSide;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, 9, 64, 1, true, 0.17, Math.PI * 2 - 0.34), wallM);
      cyl.rotation.y = Math.PI; cyl.position.y = 4.5; cyl.receiveShadow = true; S(st, cyl);
      const fl = new THREE.Mesh(new THREE.CircleGeometry(RAD, 64), M[st].floor); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; S(st, fl);
      if (st !== '2026') { const ceil = new THREE.Mesh(new THREE.CircleGeometry(RAD, 64), st === '2049' ? steel : M[st].wall); ceil.rotation.x = Math.PI / 2; ceil.position.y = 9; S(st, ceil); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(RAD - 0.1, 0.05, 6, 96), M[st].trim); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; S(st, ring);
    }
    game.collision.add([-RAD, -1, -RAD], [RAD, 0, RAD]); // chamber floor (all eras)
    for (let k = 0; k < 24; k++) { // circular wall colliders (skip north exit)
      const a = (k / 24) * Math.PI * 2, x = Math.sin(a) * (RAD + 0.4), z = Math.cos(a) * (RAD + 0.4);
      if (z < -RAD + 2 && Math.abs(x) < 3) continue;
      game.collision.addBox(x, 0, z, 3.4, 9, 3.4);
    }
    // the Chronolith (exists in every era — older than all of them)
    const ch = chronolith(1.25, { power: 0.15 }); ch.position.set(0, 3.6, -2); scene.add(ch);
    game.collision.addBox(0, 0, -2, 7, 7, 1.4);
    const plinth = box(4, 0.6, 2.4, new THREE.MeshPhysicalMaterial({ color: 0x0b0c0f, roughness: 0.2, metalness: 0.6, clearcoat: 1 }), 0, 0, -2); scene.add(plinth);
    game.onUpdate((dt, t) => ch.userData.update(t));
    const chLight = new THREE.PointLight(0x9fe8ff, 30, 25, 1.5); chLight.position.set(0, 3.6, 0); scene.add(chLight);

    // era dressing in the chamber
    // 2026: scaffolding, work lights, plastic sheets
    for (let k = 0; k < 6; k++) {
      const a = -1.2 + k * 0.5, x = Math.sin(a) * 9, z = Math.cos(a) * 9;
      const sc = new THREE.Group(); sc.position.set(x, 0, z); sc.rotation.y = a; S('2026', sc);
      for (const dx of [-1, 1]) for (const dz of [-0.6, 0.6]) sc.add(box(0.06, 6, 0.06, rust, dx, 0, dz));
      for (let y = 1.5; y < 6; y += 1.5) { sc.add(box(2.1, 0.05, 1.3, new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 }), 0, y, 0)); }
    }
    for (const [x, z] of [[-7, 5], [7, 5], [-8, -6], [8, -6]]) { const l = new THREE.SpotLight(0xffb060, 60, 25, 0.8, 0.6, 1.4); l.position.set(x, 2.5, z); l.target.position.set(0, 2, -2); S('2026', l); S('2026', l.target); S('2026', box(0.4, 0.3, 0.3, glowMat(0xffd090, 5), x, 2.4, z)); S('2026', box(0.05, 2.4, 0.05, rust, x, 0, z)); }
    for (let k = 0; k < 4; k++) { const sheet = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), new THREE.MeshStandardMaterial({ color: 0xdde8e8, transparent: true, opacity: 0.35, roughness: 0.4, side: THREE.DoubleSide })); const a = 2 + k * 0.6; sheet.position.set(Math.sin(a) * 11, 2.5, Math.cos(a) * 11); sheet.lookAt(0, 2.5, 0); S('2026', sheet); }
    // 2049: clean lab, consoles, cyan light
    const lab = [];
    for (const [x, z] of [[-6, 4], [6, 4], [-8, -1], [8, -1]]) { const c = box(1.6, 1, 0.8, steel, x, 0, z); S('2049', c); S('2049', box(1.4, 0.6, 0.04, new THREE.MeshStandardMaterial({ color: 0x0a0e14, emissive: 0x3a9aff, emissiveIntensity: 1.1 }), x, 1.15, z - 0.3)); col(['2049'], [x - 0.8, 0, z - 0.4], [x + 0.8, 1, z + 0.4]); }
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const l = new THREE.PointLight(0xdff4ff, 14, 14, 1.6); l.position.set(Math.sin(a) * 9, 8, Math.cos(a) * 9); S('2049', l); S('2049', box(1.2, 0.05, 0.3, glowMat(0xdff4ff, 3), l.position.x, 8.7, l.position.z)); lab.push(l); }
    // 2196: overgrowth, holes in the roof, moonlight
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x2e5a2a, roughness: 0.8 });
    for (let k = 0; k < 22; k++) { const a = R() * Math.PI * 2, r = RAD - 0.3; const pts = []; for (let j = 0; j < 6; j++) pts.push([Math.sin(a + j * 0.05) * (r - j * 0.05), 9 - j * 1.4 - R(), Math.cos(a + j * 0.05) * (r - j * 0.05)]); S('2196', cableCurve(pts, 0.05 + R() * 0.06, vineMat)); }
    for (let k = 0; k < 40; k++) { const g = new THREE.Mesh(new THREE.ConeGeometry(0.15 + R() * 0.2, 0.6 + R() * 0.8, 5), new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.9 })); const a = R() * 6.28, r = 3 + R() * 8; g.position.set(Math.sin(a) * r, 0.3, Math.cos(a) * r); S('2196', g); }
    const moon = new THREE.SpotLight(0x9fc8ff, 160, 40, 0.35, 0.5, 1.2); moon.position.set(-3, 18, 5); moon.target.position.set(0, 0, 0); moon.castShadow = true; S('2196', moon); S('2196', moon.target);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3, 18, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); shaft.position.set(-1.5, 9, 2.5); shaft.rotation.z = 0.15; S('2196', shaft);
    for (let k = 0; k < 10; k++) S('2196', box(0.6 + R(), 0.4 + R() * 0.6, 0.6 + R(), M['2196'].wall, -9 + R() * 18, 0, 3 + R() * 7));

    // ---------- power junction (the defining moment) ----------
    const JX = -7.2, JZ = -8.2;
    const jb = (st, mat) => S(st, box(1.2, 1.6, 0.4, mat, JX, 0.6, JZ));
    jb('2026', new THREE.MeshStandardMaterial({ color: 0x8a8a84, roughness: 0.7 })); jb('2049', steel); jb('2196', rust);
    const spool = S('2026', new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.8 }))); spool.rotation.z = Math.PI / 2; spool.position.set(JX + 1.5, 0.5, JZ + 1.2);
    const cable26 = S('2026', cableCurve([[JX + 1.3, 0.6, JZ + 1.2], [JX + 0.8, 0.1, JZ + 0.6], [JX + 0.2, 0.05, JZ + 0.5], [JX, 0.8, JZ + 0.21]], 0.05)); cable26.visible = false;
    const cable49 = S('2049', cableCurve([[JX, 2.2, JZ + 0.21], [JX + 0.3, 1.2, JZ + 0.3], [JX + 2, 0.06, JZ + 0.6], [JX + 5.2, 0.06, JZ - 0.5], [-2.1, 0.5, -11.7]], 0.06, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 }))); cable49.visible = false;
    const burned = S('2049', box(0.5, 0.5, 0.05, new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }), JX, 1.6, JZ + 0.21));
    const jLight = S('2049', box(0.15, 0.15, 0.05, glowMat(0xff2030, 3), JX + 0.4, 2.1, JZ + 0.22));

    // ---------- the gallery (z -12 .. -52) ----------
    // floors per era
    S('2049', box(20, 0.2, 40, M['2049'].floor, 0, -0.2, -32, { cast: false })); col(['2049'], [-10, -0.2, -52], [10, 0, -12]);
    S('2196', box(20, 0.2, 40, M['2196'].floor, 0, -0.2, -32, { cast: false })); col(['2196'], [-10, -0.2, -52], [10, 0, -12]);
    S('2026', box(20, 0.2, 2.5, M['2026'].floor, 0, -0.2, -13.25, { cast: false })); col(['2026'], [-10, -0.2, -14.5], [10, 0, -12]);
    // the 2026 pit
    S('2026', box(20, 0.2, 38, new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1 }), 0, -12, -33, { cast: false }));
    for (let k = 0; k < 14; k++) S('2026', box(0.08, 10, 0.08, rust, -9 + (k % 7) * 3, -11, -16 - Math.floor(k / 7) * 30));
    const caution = canvasTex(256, 32, (g, w, h) => { for (let x = -32; x < w; x += 32) { g.fillStyle = '#e8b020'; g.fillRect(x, 0, 16, h); g.fillStyle = '#111'; g.fillRect(x + 16, 0, 16, h); } }, 'caution', { repeat: [6, 1] });
    S('2026', box(20, 0.12, 0.12, new THREE.MeshBasicMaterial({ map: caution }), 0, 1.0, -14.4));
    // gallery walls (all eras, per material)
    for (const st of ['2026', '2049', '2196']) {
      for (const x of [-10.15, 10.15]) S(st, box(0.3, 10, 40, M[st].wall, x, -1, -32));
      S(st, box(20.6, 10, 0.3, M[st].wall, 0, -1, -52.15));
      for (const x of [-6, 6]) S(st, box(8, 9, 0.3, M[st].wall, x, 0, -12));
    }
    game.collision.add([-10.3, -12, -52], [-10, 10, -12]); game.collision.add([10, -12, -52], [10.3, 10, -12]); game.collision.add([-10, -12, -52.3], [10, 10, -52]);
    game.collision.add([-10, 0, -12.15], [-2, 9, -11.85]); game.collision.add([2, 0, -12.15], [10, 9, -11.85]);
    // 2049 blast door
    const door = S('2049', box(4, 4.5, 0.4, new THREE.MeshPhysicalMaterial({ color: 0x23272d, metalness: 0.9, roughness: 0.25, clearcoat: 1 }), 0, 0, -12));
    const doorStripe = S('2049', box(4.02, 0.12, 0.42, glowMat(0xff2030, 2), 0, 2.2, -12));
    const doorBox = col(['2049'], [-2, 0, -12.3], [2, 4.5, -11.7]);
    // 2196 rubble at the entrance
    for (let k = 0; k < 8; k++) S('2196', box(1 + R(), 0.8 + R() * 2, 1 + R(), M['2196'].wall, -1.6 + R() * 3.2, 0, -12.5 - R() * 1.2));
    col(['2196'], [-2, 0, -13.6], [2, 3, -11.7]);
    // 2049 machinery block
    const mach = new THREE.Group(); mach.position.set(0, 0, -30); S('2049', mach);
    mach.add(box(20, 4.6, 8, steel, 0, 0, 0));
    const rotor = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.5, 16, 48), new THREE.MeshPhysicalMaterial({ color: 0x8a9098, metalness: 1, roughness: 0.2, clearcoat: 1 })); rotor.position.set(-3, 3.6, 4.1); mach.add(rotor);
    const rotor2 = rotor.clone(); rotor2.position.x = 4; mach.add(rotor2);
    for (let k = 0; k < 6; k++) mach.add(box(0.1, 0.1, 8.2, glowMat(0x5fe6ff, 1.5), -9 + k * 3.6, 4.6, 0));
    game.onUpdate(dt => { rotor.rotation.z += dt * 2; rotor2.rotation.z -= dt * 2.4; });
    col(['2049'], [-10, 0, -34], [10, 4.6, -26]);
    // 2196 rubble field + cargo lift
    for (let k = 0; k < 26; k++) { const b = box(1 + R() * 3, 0.5 + R() * 2.5, 1 + R() * 3, k % 3 ? rust : M['2196'].wall, -9 + R() * 14, 0, -25 - R() * 13); b.rotation.y = R(); S('2196', b); }
    const bent = S('2196', new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.5, 12, 32, Math.PI * 1.2), rust)); bent.position.set(-3, 1.2, -30); bent.rotation.set(1.2, 0.3, 0.4);
    col(['2196'], [-10, 0, -40], [4.6, 3, -24]); col(['2196'], [4.6, 0, -40], [10, 3, -24.6]);
    const lift = new THREE.Group(); lift.position.set(7, 0, -22); S('2196', lift);
    lift.add(box(3, 0.25, 3, rust, 0, -0.05, 0));
    for (const s of [-1, 1]) lift.add(box(0.1, 1, 3, new THREE.MeshStandardMaterial({ color: 0xa08020, roughness: 0.6, metalness: 0.5 }), s * 1.45, 0.2, 0));
    const scissor = new THREE.Group(); lift.add(scissor);
    for (let k = 0; k < 4; k++) { const b = box(0.08, 0.08, 3.2, steel, -1.3 + (k % 2) * 2.6, 0, 0); b.rotation.x = k < 2 ? 0.6 : -0.6; scissor.add(b); }
    const liftCol = col(['2196'], [5.5, -0.2, -23.5], [8.5, 0.2, -20.5]);
    S('2196', box(0.2, 0.2, 0.2, glowMat(0xffb030, 2), 8.6, 1.4, -20.6));
    // catwalk (y = 5): 2049 full, 2196 broken at -37
    const CY = 5;
    S('2049', box(3, 0.2, 24, steel, 7, CY - 0.2, -32)); col(['2049'], [5.5, CY - 0.2, -44], [8.5, CY, -20]);
    for (const s of [-1, 1]) S('2049', box(0.05, 1, 24, new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.9 }), 7 + s * 1.5, CY, -32));
    col(['2049'], [8.5, CY, -44], [8.7, CY + 1.2, -20]); col(['2049'], [5.3, CY, -44], [5.5, CY + 1.2, -26]);
    S('2196', box(3, 0.2, 17, rust, 7, CY - 0.2, -28.5)); col(['2196'], [5.5, CY - 0.2, -37], [8.5, CY, -20]);
    const brokenEnd = S('2196', box(3, 0.2, 3, rust, 7.3, CY - 1.2, -38.3)); brokenEnd.rotation.x = 0.7;
    col(['2196'], [8.5, CY, -37], [8.7, CY + 1.2, -20]);
    // 2049 mezzanine + control panel
    S('2049', box(20, 0.25, 8, steel, 0, CY - 0.25, -48)); col(['2049'], [-10, CY - 0.25, -52], [10, CY, -44]);
    S('2049', box(20, 1.1, 0.06, new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.25, roughness: 0.05 }), 0, CY, -44)); col(['2049'], [-10, CY, -44.1], [5.5, CY + 1.2, -43.9]);
    const panel = new THREE.Group(); panel.position.set(0, CY, -50.5); S('2049', panel);
    panel.add(box(5, 1.1, 1, steel, 0, 0, 0));
    const scr = box(4.6, 1.6, 0.06, new THREE.MeshStandardMaterial({ color: 0x050a10, emissive: 0x5fe6ff, emissiveIntensity: 0.4 }), 0, 1.2, -0.4); panel.add(scr);
    col(['2049'], [-2.5, CY, -51], [2.5, CY + 1.1, -50]);
    // 2026 / 2196 at mezzanine level: nothing (2026) / collapsed (2196)
    for (let k = 0; k < 6; k++) { const b = box(2 + R() * 3, 0.25, 2 + R() * 2, rust, -8 + R() * 16, 0, -46 - R() * 5); b.rotation.set(R() * 0.6, R(), R() * 0.4); S('2196', b); }
    // gallery lights per era
    const galleryLights = [];
    for (let z = -16; z > -52; z -= 8) {
      const l49 = new THREE.PointLight(0xdff4ff, 0, 18, 1.6); l49.position.set(0, 8, z); S('2049', l49); galleryLights.push(l49);
      const strip = S('2049', box(14, 0.06, 0.3, glowMat(0xdff4ff, 0.2), 0, 8.8, z)); l49.userData.strip = strip;
      const em = new THREE.PointLight(0xff2030, 5, 10, 1.6); em.position.set(-9, 3, z); S('2049', em); l49.userData.em = em;
      const l26 = new THREE.PointLight(0xffa050, 18, 18, 1.6); l26.position.set(z % 16 ? -8 : 8, 2, z); S('2026', l26); S('2026', box(0.3, 0.3, 0.3, glowMat(0xffd090, 4), l26.position.x, 2, z));
    }
    const moon2 = new THREE.SpotLight(0x9fc8ff, 220, 60, 0.5, 0.6, 1.1); moon2.position.set(2, 25, -30); moon2.target.position.set(4, 0, -32); moon2.castShadow = true; S('2196', moon2); S('2196', moon2.target);
    for (let k = 0; k < 3; k++) { const sh = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3.5, 24, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); sh.position.set(-5 + k * 5, 6, -20 - k * 11); S('2196', sh); }
    for (let k = 0; k < 30; k++) { const v = cableCurve([[-10 + R() * 20, 9, -14 - R() * 36], [-10 + R() * 20, 6, -14 - R() * 36], [-10 + R() * 20, 2.5, -14 - R() * 36]], 0.04 + R() * 0.05, vineMat); S('2196', v); }
    const leaves = new Motes(250, [-10, 0, -52, 10, 9, 12], 0xb6ff8a, 0.07, 0.25); S('2196', leaves.mesh); game.onUpdate(dt => leaves.update(dt));
    const dust26 = new Motes(400, [-10, 0, -52, 10, 9, 12], 0xffd9a0, 0.05, 0.15); S('2026', dust26.mesh); game.onUpdate(dt => dust26.update(dt));
    const hemi = new THREE.HemisphereLight(0xaabbcc, 0x111111, 0.25); scene.add(hemi);

    // the figure on the broken catwalk (2196 only) — a glimpse, never a face
    const figure = new Character({ ...CAST.witness.look, lod: true }); figure.setGhost(0xff8a6a); figure.root.position.set(7, CY, -36); figure.root.rotation.y = 0; S('2196', figure.root);
    figure.root.visible = false;

    // ---------- era definitions ----------
    const setFogBg = (c, d) => { scene.fog.color.set(c); scene.fog.density = d; scene.background.set(c); };
    T.configure([
      { id: '2026', key: '1', name: 'PAST', year: '2026', glyph: '◐', color: '#ffb060', theme: 'past', apply: () => { setFogBg(0x1a120a, 0.022); hemi.color.set(0xffd0a0); chLight.color.set(0xffc890); } },
      { id: '2049', key: '2', name: 'PRESENT', year: '2049', glyph: '◎', color: '#5fe6ff', theme: 'chronolith', apply: () => { setFogBg(0x06080c, 0.022); hemi.color.set(0xaabbcc); chLight.color.set(0x9fe8ff); } },
      { id: '2196', key: '3', name: 'FUTURE', year: '2196', glyph: '◑', color: '#9affb0', theme: 'future', apply: () => { setFogBg(0x08120e, 0.02); hemi.color.set(0x8ab0a0); chLight.color.set(0xb6ffcc); } },
    ], '2049');

    // ---------- characters ----------
    const iven = game.actor('iven', null, 3.5, 0, 4, -2.4); T.only(iven.root, '2049');
    iven.lookTarget = game.player.char.head;

    // ---------- SCRIPT ----------
    ui.missionTag('MISSION 3 · THE FIRST SWITCH'); ui.show('hud', true);
    audio.hum(0.15, 41); audio.setTheme('chronolith');
    game.player.place(0, 0, 8, Math.PI);
    game.checkpoint(0, 0, 8, Math.PI);
    game.control = false; ui.letterbox(true);
    game.engine.camera.position.set(0, 1.6, 11);
    await ui.fade(0, 1400);
    await game.shot([0, 6, 10], [0, 3.6, -2], 4, { fov: 50 });
    await ui.chapterCard('PROLOGUE · THE ZERO SECOND', 'The First Switch', 'Which one is real?', 3200);
    await game.shot([2.4, 1.8, 5.5], [0, 2.2, 1], 1.6, { fov: 45 });
    await game.talk([
      ['iven', 'Helix says they built it in 2031. The foundation surveys say this ring was here before the foundation.'],
      ['kai', 'It\'s humming at the same frequency as my wrist.'],
      ['iven', 'Don\'t touch it. Varen. Don\'t—'],
    ]);
    game.releaseCam(); ui.letterbox(false); game.control = true;
    game.objective('Approach the Chronolith');
    let touched = false;
    game.interact({ pos: [0, 1.4, -0.6], radius: 2.4, prompt: 'Touch the Chronolith', onUse: () => { touched = true; } });
    await game.waitFor(() => touched);
    game.control = false; ui.letterbox(true);
    game.player.char.pose = 'reach'; game.player.char.wristBoost = 12;
    await game.shot([2.2, 2, 1.6], [0, 2, -1], 1.2, { fov: 42 });
    audio.sfxPlay('switch'); ch.userData.disc.material.uniforms.uPower.value = 0.9; chLight.intensity = 90;
    // flicker through eras
    for (const st of ['2026', '2196', '2026', '2196', '2049']) { await T.switchTo(st, { force: true, free: true, dur: 380 }); }
    game.player.char.pose = null;
    await game.talk([
      ['kai', 'The room — it was three rooms. Unfinished. Running. Dead.'],
      ['iven', 'Your mark is synced to it. It\'s reading you like a key.'],
      ['kai', 'Not a key. A bookmark.'],
    ]);
    T.unlocked = true; T.refreshHud(); T.stability = 1;
    game.releaseCam(); ui.letterbox(false); game.control = true;
    ui.toast('TEMPORAL STATE SWITCHING UNLOCKED\n1 · 2026      2 · 2049      3 · 2196      (Q cycles)\nEach switch drains Chronolith stability', 7000);
    game.objective('The blast door has no power. Find where the power was lost.');
    await game.say('iven', 'Main power to the gallery runs from that junction. It\'s been dead since before I worked here — the feed was never installed.');
    // junction step: in 2026, connect the cable
    let connected = false;
    game.interact({ pos: [JX + 1, 1, JZ + 0.9], radius: 2.4, states: ['2049'], once: false, prompt: 'Inspect the junction', enabled: () => !connected, onUse: () => ui.subtitle('kai', 'Burned out. No feed line — someone planned one, then never ran it.', 3200) });
    game.interact({ pos: [JX + 1, 1, JZ + 0.9], radius: 2.6, states: ['2026'], hold: 1.2, prompt: 'Run the cable into the junction (hold E)', onUse: async () => {
      connected = true; cable26.visible = true; audio.sfxPlay('pickup');
      await game.say('kai', 'If I connect it here… it has been connected for twenty-three years.');
      game.objective('Return to 2049 and activate the power');
    } });
    await game.waitFor(() => connected);
    await game.waitFor(() => T.current === '2049');
    // the present has changed
    cable49.visible = true; burned.visible = false; jLight.material.emissive.set(0x40ff90); audio.sfxPlay('anomaly');
    await game.wait(0.6);
    await game.talk([
      ['iven', '…That cable. That cable has always been there. I\'ve walked past it every day for six years.'],
      ['kai', 'Not every day. Since about four seconds ago.'],
    ]);
    ui.addEvidence('The cable that was always there', 'Kai connected a feed cable in 2026. In 2049 it had been installed for 23 years — and Iven remembers walking past it.', 'CHRONOLITH CHAMBER');
    let poweredOn = false;
    S('2049', box(0.3, 0.8, 0.3, new THREE.MeshStandardMaterial({ color: 0xffb030, emissive: 0x603000 }), JX + 2.2, 0.6, JZ + 0.3));
    game.interact({ pos: [JX + 2.2, 1.2, JZ + 0.6], radius: 2.2, states: ['2049'], prompt: 'Activate gallery power', onUse: () => { poweredOn = true; } });
    await game.waitFor(() => poweredOn);
    audio.sfxPlay('door'); audio.sfxPlay('success');
    for (const l of galleryLights) { l.intensity = 22; l.userData.strip.material.emissiveIntensity = 3; l.userData.em.visible = false; }
    for (const l of lab) l.intensity = 22;
    doorStripe.material.emissive.set(0x40ff90);
    await new Promise(res => { let u = 0; const off = game.onUpdate(dt => { u = Math.min(1, u + dt * 0.7); door.position.y = u * 4.4; if (u >= 1) { doorBox.enabled = false; off(); res(); } }); });
    game.checkpoint(0, 0, -16, Math.PI);
    game.objective('Cross the gallery to the control room');
    // hints when blocked
    await game.waitFor(() => game.player.pos.z < -20);
    await ui.subtitle('kai', 'The accelerator block fills the whole gallery. In 2049 there\'s no way past it.', 3200);
    ui.toast('Try another era here', 3000);
    await game.waitFor(() => T.current === '2196' && game.player.pos.z < -15);
    await ui.subtitle('kai', '2196. It collapsed. And somebody built a cargo lift beside the rubble.', 3200);
    game.objective('Use the cargo lift in 2196 to reach the catwalk');
    let lifted = false;
    game.interact({ pos: [7, 1, -22], radius: 2.2, states: ['2196'], prompt: 'Ride the cargo lift', onUse: async () => {
      game.control = false; game.player.place(7, 0, -22, Math.PI);
      audio.sfxPlay('door');
      await new Promise(res => { let y = 0; const off = game.onUpdate(dt => { y = Math.min(CY, y + dt * 1.6); lift.position.y = y; scissor.scale.y = 1 + y * 0.8; scissor.position.y = -y / 2; game.player.pos.y = y + 0.01; game.player.vel.set(0, 0, 0); liftCol.min.y = y - 0.2; liftCol.max.y = y + 0.2; if (y >= CY) { off(); res(); } }); });
      lifted = true; game.control = true;
      game.checkpoint(7, CY, -23, Math.PI);
    } });
    await game.waitFor(() => lifted);
    game.objective('Cross the catwalk');
    // glimpse of the figure
    figure.root.visible = true; let fa = 1;
    game.onUpdate(dt => { if (!figure.root.visible) return; figure.lookTarget = game.player.char.head; figure.update(dt); if (game.player.pos.z < -27 && T.current === '2196') { fa -= dt * 1.2; figure.ghostMat.uniforms.uAlpha.value = Math.max(0, fa); if (fa <= 0) figure.root.visible = false; } });
    await game.waitFor(() => game.player.pos.z < -27 && T.current === '2196');
    await ui.subtitle('kai', 'Someone was standing there. A long coat… gone.', 2800);
    ui.addEvidence('A man on the broken catwalk', 'In 2196, a figure in a long coat watched Kai from the end of a collapsed catwalk. He came apart before Kai could see his face.', 'GALLERY · 2196');
    await game.waitFor(() => game.player.pos.z < -34);
    if (T.current === '2196') await ui.subtitle('kai', 'It ends here. But in 2049 this catwalk was whole.', 3000);
    game.objective('Switch to 2049 and reach the control panel');
    ui.toast('Careful: in 2026 there is no catwalk at all', 3500);
    let reached = false;
    game.interact({ pos: [0, CY + 1.2, -50], radius: 2.6, states: ['2049'], prompt: 'Access the control panel', onUse: () => { reached = true; } });
    game.onUpdate(() => { if (game.player.pos.y > 4 && game.player.pos.z < -40) game.checkpoint(6.8, CY, -42, Math.PI); });
    await game.waitFor(() => reached);
    // the fracture
    game.control = false; ui.letterbox(true);
    scr.material.emissiveIntensity = 2.5;
    await game.shot([3, CY + 2, -46], [0, CY + 1.4, -51], 1.4, { fov: 45 });
    await game.say('kai', 'Activation log: 08:14:59. Operator: K. VAREN. Witness credentials: K. VAREN.');
    await game.say('kai', 'Which one is real?');
    audio.silence(1.2); await game.wait(1.2);
    await game.say('voice', 'All of them. That\'s why this is dangerous.');
    audio.sfxPlay('boom'); game.shake = 0.25;
    const seq = ['2026', '2196', '2049', '2026', '2196', '2026'];
    for (const st of seq) { await T.switchTo(st, { force: true, free: true, dur: 260 }); }
    game.shake = 0.6; audio.sfxPlay('metal'); ui.flash(600);
    game.engine.fx.uShift.value = 1;
    await game.wait(1.4);
    game.shake = 0; game.engine.fx.uShift.value = 0;
    await ui.fade(1, 900);
    game.releaseCam(); ui.letterbox(false); audio.allBeds(0); audio.setTheme(null);
  },
};
