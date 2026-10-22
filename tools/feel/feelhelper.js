// Browser-side helper for the walking-style and physics audit (docs/MOTION.md). Evaluated in the game page by
// tools/feel/audit.mjs after the title screen has loaded (cast ready). Defines window.FEEL:
//   FEEL.setup()            holds the game loop (frames are simulated and drawn only on request, like
//                           tools/render/refhelper.js), builds the "feel course" scene: a gridded floor, stairs,
//                           a micro-stepped ramp, ledges, walls, a low ceiling, a lift and room for NPCs.
//   FEEL.run(sc)            runs one scenario at a fixed dt and returns per-frame samples (player state, Kai's
//                           bones in world space, ground under each foot, bone angular velocities) and, when asked,
//                           JPEG frames from a chase and/or a side camera.
//   FEEL.groundAt(x, z, y)  top of the highest collision box under (x, z) at or below y + 0.3 (null: none).
// Nothing here changes game code: input is fed through Input's own key / stick state, the world through Collision.
/* global window */
(() => {
  const g = window.__game, E = g.engine;
  const FEEL = window.FEEL = { boxes: [], dyn: [], actors: [], walkers: [] };
  let T = null, props = null, castMod = null, draw = null;

  FEEL.groundAt = (x, z, y = 1e9) => {
    let top = null;
    for (const b of g.collision.boxes) {
      if (!g.collision.isActive(b, g.temporal.current)) continue;
      if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue;
      if (b.max.y <= y + 0.3 && (top === null || b.max.y > top)) top = b.max.y;
    }
    return top;
  };

  function gridTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'); x.fillStyle = '#6d7076'; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = '#4a4d52'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); }
    x.strokeStyle = '#25272b'; x.lineWidth = 5; x.strokeRect(0, 0, 256, 256);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  const mats = {};
  const mat = (col) => mats[col] || (mats[col] = new T.MeshStandardMaterial({ color: col, roughness: 0.8 }));
  // a collision box with a visible mesh
  function solid(min, max, col = 0x8a8f98, opts = {}) {
    const b = g.collision.add(min, max, opts);
    const m = new T.Mesh(new T.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), mat(col));
    m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2); m.castShadow = m.receiveShadow = true;
    g.scene.add(m); b.mesh = m; if (opts.blocker) g.blocker(m);
    return b;
  }
  FEEL.solid = solid;
  FEEL.dynSolid = (min, max, col, opts) => { const b = solid(min, max, col, opts); FEEL.dyn.push(b); return b; };
  FEEL.clearDyn = () => {
    for (const b of FEEL.dyn) { g.collision.boxes = g.collision.boxes.filter(x => x !== b); b.mesh?.parent?.remove(b.mesh); g.camBlockers = g.camBlockers.filter(m => m !== b.mesh); }
    FEEL.dyn = [];
    for (const a of FEEL.actors) { a.root.parent?.remove(a.root); for (const id in g.actors) if (g.actors[id] === a) delete g.actors[id]; }
    FEEL.actors = [];
    for (const w of FEEL.walkers) { w.c.root.parent?.remove(w.c.root); w.off?.(); }
    FEEL.walkers = []; FEEL.lift = null;
  };

  FEEL.setup = async () => {
    T = await import('/vendor/three.module.min.js');
    props = await import('/src/world/props.js');
    castMod = await import('/src/story/cast.js');
    // hold the loop (see tools/render/refhelper.js)
    draw = E._feelRender || (E._feelRender = E.render);
    E.render = () => {}; g.paused = true; g.titleUpdate = null; g.audio.ctx?.suspend?.();
    const s = document.createElement('style'); s.textContent = 'body > *:not(#app){display:none!important} #app > *:not(#viewport){display:none!important}';
    document.head.appendChild(s);
    const scene = g.newScene({ background: 0x9fb2c4, envIntensity: 0.6, exposure: 1.0, bloom: 0.2 });
    scene.add(new T.HemisphereLight(0xdfe8f4, 0x4a4036, 1.1));
    const sun = new T.DirectionalLight(0xfff2e0, 2.2); sun.position.set(-20, 30, 12); sun.castShadow = true;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -30; sun.shadow.camera.right = sun.shadow.camera.top = 30; sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun, sun.target);
    // floor: 1 m grid (thick lines every 4 m) so foot sliding reads in the frames
    const tex = gridTexture(); tex.repeat.set(30, 30);
    const fl = new T.Mesh(new T.PlaneGeometry(120, 120), new T.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
    g.collision.add([-60, -1, -60], [60, 0, 60]);
    // stairs (x 10..12.4): 10 steps 0.18 rise / 0.30 run up along -z from z = 0, a 2 m landing, 10 steps down
    const ST = FEEL.stairs = { x0: 10, x1: 12.4, rise: 0.18, run: 0.30, n: 10, z0: 0 };
    for (let i = 0; i < ST.n; i++) solid([ST.x0, 0, ST.z0 - (i + 1) * ST.run], [ST.x1, (i + 1) * ST.rise, ST.z0 - i * ST.run], i % 2 ? 0x9a9488 : 0x8c867a);
    const zl = ST.z0 - ST.n * ST.run; solid([ST.x0, 0, zl - 2], [ST.x1, ST.n * ST.rise, zl], 0x7f7a70);
    for (let i = 0; i < ST.n; i++) solid([ST.x0, 0, zl - 2 - (i + 1) * ST.run], [ST.x1, (ST.n - i - 1) * ST.rise + 0.0001, zl - 2 - i * ST.run], i % 2 ? 0x9a9488 : 0x8c867a);
    // m13-style big risers (0.40 m) at x 16..18
    for (let i = 0; i < 4; i++) solid([16, 0, -(i + 1) * 0.7], [18, (i + 1) * 0.4, -i * 0.7], 0xa08c78);
    // ramp (x 20..22.4): AABB world, so a slope is micro-steps 0.05 rise / 0.15 run (18 deg), 20 steps up to 1.0 m
    const RP = FEEL.ramp = { x0: 20, x1: 22.4, rise: 0.05, run: 0.15, n: 20 };
    for (let i = 0; i < RP.n; i++) solid([RP.x0, 0, -(i + 1) * RP.run], [RP.x1, (i + 1) * RP.rise, -i * RP.run], 0x7d8a76);
    solid([RP.x0, 0, -RP.n * RP.run - 2], [RP.x1, RP.n * RP.rise, -RP.n * RP.run], 0x6d7a66);
    // high platform for drops and ledge tests (x 26..30, z -4..0, top 3.0); a 1.0 m platform beside it
    solid([26, 0, -4], [30, 3.0, 0], 0x707884, { blocker: true });
    solid([32, 0, -4], [36, 1.0, 0], 0x7a828e);
    // long wall for angled approaches (x = -10 face, z -20..20)
    solid([-11, 0, -20], [-10, 3, 20], 0xb0a090, { blocker: true });
    // an inside corner (x -20, z -20): two walls
    solid([-26, 0, -21], [-20, 3, -20], 0xa09080, { blocker: true }); solid([-21, 0, -27], [-20, 3, -20], 0xa09080, { blocker: true });
    // low ceiling (x -30..-26, z 6..10, underside 2.2)
    solid([-30, 2.2, 6], [-26, 2.6, 10], 0x606870);
    // thin wall for tunnelling (x 40.0..40.05)
    solid([40, 0, -10], [40.05, 3, 10], 0xc06050);
    g.player.place(0, 0, 0, 0); g.control = true;
    for (let i = 0; i < 10; i++) { g.step(1 / 30); }
    draw.call(E, g.time);
    return { boxes: g.collision.boxes.length, kai: g.player.char.template, cast: !!g.player.char.person, quality: E.quality };
  };

  // ---------- sampling ----------
  const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'thigh_L', 'shin_L', 'foot_L', 'toe_L', 'thigh_R', 'shin_R', 'foot_R', 'toe_R', 'upperarm_L', 'forearm_L', 'hand_L', 'upperarm_R', 'forearm_R', 'hand_R', 'clavicle_L', 'clavicle_R'];
  const prevQ = new Map();
  function boneSample(ch, tag, dt) {
    const P = ch.person; if (!P) return null;
    ch.root.updateMatrixWorld(true);
    const out = {}, v = new T.Vector3(), q = new T.Quaternion();
    let wmax = 0, wbone = '';
    for (const k of BONES) {
      const b = P.bones[k]; if (!b) continue;
      b.getWorldPosition(v); out[k] = [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
      b.getWorldQuaternion(q);
      const key = tag + k, p = prevQ.get(key);
      if (p && dt > 0) { const ang = 2 * Math.acos(Math.min(1, Math.abs(p.dot(q)))); const w = ang / dt; if (w > wmax && !/^hips$/.test(k)) { wmax = w; wbone = k; } }
      prevQ.set(key, q.clone());
    }
    out.wmax = +wmax.toFixed(2); out.wbone = wbone;
    out.clip = P.current; const a = P.actions[P.current]; out.ts = a ? +a.timeScale.toFixed(3) : 0;
    out.gL = FEEL.groundAt(out.foot_L[0], out.foot_L[2], out.foot_L[1]);
    out.gR = FEEL.groundAt(out.foot_R[0], out.foot_R[2], out.foot_R[1]);
    out.gtL = FEEL.groundAt(out.toe_L[0], out.toe_L[2], out.toe_L[1]);
    out.gtR = FEEL.groundAt(out.toe_R[0], out.toe_R[2], out.toe_R[1]);
    out.ry = +ch.root.rotation.y.toFixed(4);
    return out;
  }
  // rest offsets: foot / toe bone heights above the sole in Kai's idle pose (to turn bone heights into sole heights)
  FEEL.restFoot = () => {
    const ch = g.player.char; ch.person.play('idle', 0); ch.speed = 0; ch.update(0.001); ch.root.updateMatrixWorld(true);
    const v = new T.Vector3(), y0 = ch.root.position.y, r = {};
    for (const k of ['foot_L', 'toe_L', 'foot_R', 'toe_R', 'hips', 'head']) { ch.person.bones[k].getWorldPosition(v); r[k] = +(v.y - y0).toFixed(4); }
    return r;
  };

  function frameJPG(view, size) {
    const cam = E.camera, pl = g.player, p = pl.pos;
    if (view === 'side') {
      // fixed-distance side camera, perpendicular to the scenario's travel direction (FEEL.sideDir), tracking the player
      const d = FEEL.sideDir || [1, 0], dist = FEEL.sideDist || 3.6, h = FEEL.sideH ?? 1.0;
      cam.position.set(p.x + d[0] * dist, p.y + h, p.z + d[1] * dist); cam.fov = FEEL.sideFov || 50; cam.updateProjectionMatrix();
      cam.lookAt(p.x, p.y + 0.85, p.z);
    } else if (view === 'wide') {
      const w = FEEL.wide; cam.position.set(...w.p); cam.fov = w.fov || 50; cam.updateProjectionMatrix(); cam.lookAt(w.l[0], w.l[1], w.l[2]);
    }
    draw.call(E, g.time);
    const c = E.renderer.domElement;
    if (!size) return c.toDataURL('image/jpeg', 0.85);
    const o = FEEL._oc || (FEEL._oc = document.createElement('canvas')); o.width = size[0]; o.height = size[1];
    o.getContext('2d').drawImage(c, 0, 0, size[0], size[1]);
    return o.toDataURL('image/jpeg', 0.85);
  }

  // Scenario: { name, dt, frames, place:[x,y,z,yaw], camYaw, camPitch, timeline:[{f, down:[], up:[], press:[], stick:[x,y,mag], camYawRate, eval}],
  //             setup (JS string, run once after reset), render: { every, views:['chase','side','wide'], from, to }, npc: true (sample NPCs) }
  FEEL.run = async (sc) => {
    const inp = g.input, pl = g.player;
    FEEL.clearDyn(); prevQ.clear();
    inp.down.clear(); inp.virtual.clear(); inp.setStick(0, 0, 0); inp.endFrame(); inp.touchMode = !!sc.touch;
    pl.crouching = false; pl.char.crouch = 0; pl.camDist = 3.4;
    FEEL.sideDir = sc.sideDir || [1, 0]; FEEL.sideDist = sc.sideDist; FEEL.sideH = sc.sideH; FEEL.sideFov = sc.sideFov; FEEL.wide = sc.wide;
    const pc = sc.place || [0, 0, 0, 0];
    pl.place(...pc);
    pl.camYaw = sc.camYaw ?? pc[3] + Math.PI; pl.camPitch = sc.camPitch ?? 0.18;
    g.cine = null; g.control = true;
    if (sc.setup) (0, eval)(sc.setup);
    // settle a few frames in idle so the mixer starts from the idle pose
    for (let i = 0; i < (sc.settle ?? 20); i++) { g.step(sc.dt); inp.endFrame(); }
    prevQ.clear();
    const S = [], R = [], dt = sc.dt, tl = (sc.timeline || []).slice().sort((a, b) => a.f - b.f);
    let ti = 0, camRate = 0, cost = 0;
    for (let f = 0; f < sc.frames; f++) {
      while (ti < tl.length && tl[ti].f <= f) {
        const e = tl[ti++];
        (e.down || []).forEach(k => inp.down.add(k)); (e.up || []).forEach(k => inp.down.delete(k));
        (e.press || []).forEach(k => inp.pressed.add(k));
        if (e.stick) inp.setStick(...e.stick);
        if (e.camYawRate !== undefined) camRate = e.camYawRate;
        if (e.camYaw !== undefined) pl.camYaw = e.camYaw;
        if (e.eval) (0, eval)(e.eval);
      }
      pl.camYaw += camRate * dt;
      const t0 = performance.now();
      g.step(dt);
      cost += performance.now() - t0;
      inp.endFrame();
      if (FEEL.lift) FEEL.lift(dt, g.time);
      const s = { f, t: +(f * dt).toFixed(4), p: [pl.pos.x, pl.pos.y, pl.pos.z].map(x => +x.toFixed(4)), v: [pl.vel.x, pl.vel.y, pl.vel.z].map(x => +x.toFixed(3)),
        gr: pl.grounded ? 1 : 0, yaw: +pl.yaw.toFixed(4), cr: pl.crouching ? 1 : 0, sp: pl.sprinting ? 1 : 0,
        cam: [E.camera.position.x, E.camera.position.y, E.camera.position.z].map(x => +x.toFixed(3)), camYaw: +pl.camYaw.toFixed(4) };
      s.k = boneSample(pl.char, 'kai', dt);
      if (sc.npc) s.n = FEEL.actors.concat(FEEL.walkers.map(w => w.c)).map((c, i) => { const b = boneSample(c, 'n' + i, dt); return b && { ...b, rp: [c.root.position.x, c.root.position.y, c.root.position.z].map(x => +x.toFixed(4)), speed: c.speed }; });
      S.push(s);
      const r = sc.render;
      if (r && f >= (r.from || 0) && f <= (r.to ?? 1e9) && (f - (r.from || 0)) % r.every === 0) {
        const fr = { f };
        for (const v of r.views) { if (v === 'chase') pl.updateCamera(0, E.camera); fr[v] = frameJPG(v, r.size); }
        // restore the chase camera for the next simulated frame
        pl.updateCamera(0, E.camera);
        R.push(fr);
        await new Promise(res => setTimeout(res, 5));
      }
    }
    inp.down.clear(); inp.setStick(0, 0, 0); inp.touchMode = false;
    return { name: sc.name, dt, samples: S, renders: R, stepMs: +(cost / sc.frames).toFixed(3) };
  };

  // NPC helpers for scenarios
  FEEL.actor = (id, x, y, z, ry) => { const c = g.actor(id, null, x, y, z, ry); FEEL.actors.push(c); return c; };
  FEEL.walker = (lane, seed) => {
    let s = seed || 1; const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const w = new props.Walker(g, castMod.citizenLook(rng), lane); FEEL.walkers.push(w); w.off = g.onUpdate(dt => w.update(dt)); return w;
  };
  FEEL.release = () => { E.render = draw; g.paused = false; };
})();
