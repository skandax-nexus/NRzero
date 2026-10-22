// Page-side half of the trailer director (tools/trailer/director.mjs). Injected with addInitScript BEFORE the game's
// modules run, so it can take over the frame loop from the very first frame. See docs/TRAILER.md, "Director".
//
// What it does in the page (no game file is edited, everything happens at run time):
//   - Math.random is a seeded generator (window.__TR_SEED, set by the director): crowds, rain and character phases
//     come out the same on every run of a shot. TR.reseed(n) restarts it (done when the shot's page is ready).
//   - When main.js publishes window.__game, the game loop is made inert: game.step() and engine.render() become
//     no-ops for the requestAnimationFrame loop, and the director drives the world itself with TR.tick(dt) and
//     TR.frame(...). Together with Playwright's fake clock (timers, rAF, performance.now, Date all run on virtual time,
//     advanced by the director exactly 1/fps per frame) the whole game, mission scripts included, runs in shot time.
//   - "Dry" frames run engine.render() with the composer switched off: the CPU side of the renderer (facades, static
//     batching, probe captures, grade / focus smoothing) advances exactly as it does on drawn frames, so a shot that is
//     resumed after a restart (simulated without drawing up to the first missing frame) continues seamlessly.
//   - Eye adaptation is snapped on frame 0 and then held ("exposure": "lock", the default) so no frame depends on how
//     many frames were drawn before it.
//   - Camera: keyframed paths (time-aware Catmull-Rom / Hermite positions and look targets, fov, roll, focus), easing,
//     handheld micro-shake, follow mode (offsets in the target's frame with operator lag) and game mode.
//   - Characters: TR.place / pose / clip / look / talk / walk / freeze / hide helpers for shot actions.
//   - Capture: JPEG straight from the WebGL canvas, or an accumulation buffer for supersampling (render larger, box /
//     high-quality downscale) and sub-frame motion blur (several renders averaged per output frame).
/* global window, document */
(() => {
  if (window.TR) return;
  // ---------- seeded Math.random (mulberry32) ----------
  let seed = (window.__TR_SEED ?? 20490314) >>> 0;
  let draws = 0;
  Math.random = () => { draws++; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  const TR = window.TR = { started: false, g: null, aeLock: false, errors: [] };
  TR.reseed = n => { seed = n >>> 0; return seed; };

  // ---------- take the frame loop over as soon as the game object exists ----------
  Object.defineProperty(window, '__game', {
    configurable: true, enumerable: true,
    get() { return undefined; },
    set(g) { Object.defineProperty(window, '__game', { configurable: true, enumerable: true, writable: true, value: g }); hook(g); },
  });
  function hook(g) {
    TR.g = g; const E = g.engine;
    TR._step = g.step.bind(g); g.step = () => {};
    g.clock.getDelta = () => 0;   // the rAF loop's own title-screen time stays still (TR.tick advances it)
    TR._render = E.render.bind(E); E.render = () => {};
    const start = g.start.bind(g); g.start = () => { TR.started = true; TR.ticks = 0; start(); };
    // when each scene was built (game time, ticks since start, random draws): determinism diagnostics
    const ns = g.newScene.bind(g); TR.scenes = [];
    TR.trace = [];
    const tr = (obj, name) => { const f = obj[name].bind(obj); obj[name] = (...a) => { TR.trace.push([name, +g.time.toFixed(2), TR.ticks, Math.round(performance.now())]); return f(...a); }; };
    tr(g, 'shot'); tr(g, 'talk'); tr(g, 'say'); tr(g.ui, 'fade'); tr(g.ui, 'chapterCard'); tr(g, 'runMissions');
    g.newScene = o => { TR.scenes.push([+g.time.toFixed(3), TR.ticks, draws]); return ns(o); };
    // eye adaptation hold: after the engine computed this frame's adaptation rates, zero them while locked
    const up = E._updatePost.bind(E);
    E._updatePost = dt => { up(dt); if (TR.aeLock && E.exposurePass?.enabled) { E.exposurePass.k = 0; E.exposurePass.kRef = 0; } };
  }

  // ---------- simulation ----------
  // one world step, exactly as the game loop would do it (title screen before the mission starts, paused game idle)
  TR.tick = dt => {
    const g = TR.g; if (!TR.started || !g) return false;
    if (g.audio?.ctx && g.audio.ctx.state === 'running') g.audio.ctx.suspend();   // no sound is recorded: save the CPU
    // title screen (the second or so before ?m= starts the mission): animated, but game time stays at 0 so the mission
    // timeline does not depend on how many title frames fell before the loader finished (a real-time race)
    if (g.titleUpdate) { g.titleUpdate(dt, g.time); TR.ticks++; return true; }
    if (g.paused && TR.shotOn) { g.paused = false; g.ui.show('pause', false); TR.errors.push('game paused itself at t=' + g.time.toFixed(2) + ': unpaused'); }
    if (!g.paused) { TR._step(dt); eraTick(dt); }
    TR.ticks++;
    return true;
  };
  // engine.render with or without the composer (dry = every CPU-side update, no drawing)
  TR.render = full => {
    const g = TR.g; if (!TR.started || !g) return;
    const C = g.engine.composer;
    if (full) { TR._render(g.time); return; }
    const own = Object.prototype.hasOwnProperty.call(C, 'render'), keep = C.render;
    C.render = () => {};
    try { TR._render(g.time); } finally { if (own) C.render = keep; else delete C.render; }
  };

  // Virtual-time advance inside the page: the same timer walk as Playwright's clock.runFor(), but between two timers it
  // yields with a MessageChannel task instead of a real setTimeout (clamped to >= 4 ms, far more on a loaded machine),
  // so microtask chains (await game.wait(...)) still run between timers. Falls back to the public runFor.
  const mc = new window.MessageChannel(); let mcRes = null; mc.port1.onmessage = () => { const r = mcRes; mcRes = null; r?.(); };
  const yieldTask = () => new Promise(r => { mcRes = r; mc.port2.postMessage(0); });
  TR.advance = async ms => {
    const C = window.__pwClock?.controller;
    if (!C) throw new Error('fake clock not installed');
    if (typeof C._takeFirstTimer !== 'function' || typeof C._advanceNow !== 'function') return C.runFor(ms);
    C._replayLogOnce?.();
    const to = Math.ceil(C._now.ticks + ms);
    let err = null;
    for (;;) {
      const timer = C._takeFirstTimer(to); if (!timer) break;
      C._duringTick = true;
      try {
        if (typeof timer.func === 'function') timer.func.apply(null, timer.type === 'AnimationFrame' ? [C._now.ticks] : timer.type === 'IdleCallback' ? [{ didTimeout: false, timeRemaining: () => 0 }] : timer.args);
        else (0, eval)(timer.func);
      } catch (e) { err = err || e; } finally { C._duringTick = false; }
      await yieldTask();
    }
    C._advanceNow(to);
    if (err) TR.errors.push('timer: ' + (err.message || err));
    return to;
  };
  // tick + advance + frame in one call (one round trip per sub-frame)
  TR.run = async (dt, ms, o) => { TR.tick(dt); await TR.advance(ms); return TR.frame(o); };

  // ---------- shot set-up ----------
  TR.hideCss = () => {
    if (document.getElementById('trcss')) return;
    const s = document.createElement('style'); s.id = 'trcss';
    s.textContent = 'body > *:not(#app){display:none!important} #app > *:not(#viewport){display:none!important} #touch, .touch, #rotate{display:none!important}';
    document.head.appendChild(s);
  };
  TR.begin = o => {
    const g = TR.g, E = g.engine;
    const diag = { ticks: TR.ticks, draws, scenes: TR.scenes, trace: TR.trace };
    TR.reseed(o.seed);
    if (o.fps) window.DIR.fps = o.fps;
    TR.hideCss();
    // the edit adds the trailer letterbox: the game's own (DOM) letterbox stays off for the whole shot
    g.ui.letterbox(false); g.ui.letterbox = () => {};
    g.ui.voice?.stop?.();
    if (o.grade) E.setGrade(o.grade, { instant: true });
    TR.V = E.camera.position.constructor; TR.Q = E.camera.quaternion.constructor;
    TR.shotOn = true;
    return { time: +g.time.toFixed(3), era: g.temporal?.current, quality: E.quality, grade: E.grade, size: window.innerWidth + 'x' + window.innerHeight, ...diag };
  };
  // optional trailer extras that only change what is drawn (see docs/TRAILER.md, "Quality")
  TR.extras = async x => {
    const out = {};
    if (x.crowdFar) { const m = await import(new window.URL('src/core/character.js', document.baseURI).href); m.charView.far = x.crowdFar; out.crowdFar = x.crowdFar; }
    if (x.shadowMap) { const E = TR.g.engine; E.settings.shadowMapMax = x.shadowMap; E.clampShadows(); out.shadowMap = x.shadowMap; }
    return out;
  };

  // ---------- camera ----------
  const ease = (name, k) => {
    k = Math.max(0, Math.min(1, k));
    if (name === 'linear' || name === 'none') return k;
    if (name === 'in') return k * k * k;
    if (name === 'out') return 1 - Math.pow(1 - k, 3);
    if (name === 'sine') return 0.5 - 0.5 * Math.cos(Math.PI * k);
    return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // inOut (cubic)
  };
  // time-aware Catmull-Rom (cubic Hermite with finite-difference velocities): C1 in time through every key
  function hermite(keys, u, get) {
    const n = keys.length;
    if (n === 1 || u <= keys[0].t) return get(keys[0]);
    if (u >= keys[n - 1].t) return get(keys[n - 1]);
    let i = 0; while (i < n - 2 && u > keys[i + 1].t) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
    const a = get(k0), b = get(k1), c = get(k2), d = get(k3), h = k2.t - k1.t, s = (u - k1.t) / h;
    const vel = (p, q, tp, tq) => p.map((_, j) => (tq > tp ? (q[j] - p[j]) / (tq - tp) : 0));
    const m1 = vel(i > 0 ? a : b, c, i > 0 ? k0.t : k1.t, k2.t), m2 = vel(b, i + 2 < n ? d : c, k1.t, i + 2 < n ? k3.t : k2.t);
    const s2 = s * s, s3 = s2 * s, h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    return b.map((_, j) => h00 * b[j] + h10 * h * m1[j] + h01 * c[j] + h11 * h * m2[j]);
  }
  // smooth deterministic noise for the handheld shake (sum of incommensurate sines, roughly -1..1)
  const wob = (t, s) => (Math.sin(t * 1.31 + s) * 0.5 + Math.sin(t * 2.71 + s * 2.3) * 0.3 + Math.sin(t * 6.13 + s * 4.1) * 0.12 + Math.sin(t * 11.7 + s * 7.7) * 0.06);
  const D2R = Math.PI / 180;

  TR.actor = id => { const g = TR.g; if (!id) return null; if (id === 'kai' || id === 'player') return g.player.char; return g.actors[id] || null; };
  const headPos = (id, out) => {
    const c = TR.actor(id); if (!c) return null;
    (c.head || c.root).getWorldPosition(out); if (!c.head) out.y += 1.6; return out;
  };

  // a JS expression from the spec (anchor, focusOn): evaluated in the page, null on error
  const js = (src, what) => { try { return (0, eval)(src); } catch (e) { if (!TR._jsErr?.[what]) { (TR._jsErr ||= {})[what] = 1; TR.errors.push(what + ': ' + e.message); } return null; } };
  const toVec = (o, out) => (!o ? null : o.isVector3 ? out.copy(o) : o.isObject3D ? o.getWorldPosition(out) : Array.isArray(o) ? out.set(o[0], o[1], o[2]) : 'x' in o ? out.set(o.x, o.y, o.z) : null);

  TR.setCamera = cam => {
    const g = TR.g, P = g.player;
    TR.cam = cam || { mode: 'game' };
    const k = (TR.cam.keys || []).slice().sort((a, b) => a.t - b.t);
    // focus per key: null takes the nearest numeric neighbour (no number anywhere = no depth of field)
    const nums = k.map((x, i) => [i, x.focus]).filter(([, f]) => typeof f === 'number');
    for (let i = 0; i < k.length; i++) if (typeof k[i].focus !== 'number' && nums.length) k[i] = { ...k[i], _focus: nums.reduce((b, n) => (Math.abs(n[0] - i) < Math.abs(b[0] - i) ? n : b))[1] }; else k[i] = { ...k[i], _focus: k[i].focus };
    TR.cam.keys = k;
    TR.cam.hasFocus = nums.length > 0;
    TR.cam.focusV = new TR.V(); TR.followState = null; TR._anchor = null;
    // follow without position keys = the game's own third-person camera behind Kai (driven by scripted input);
    // camera.orbit { yaw, pitch, dist } sets it at frame 0
    TR.cam.operator = TR.cam.mode === 'follow' && k.some(x => x.p);
    if (TR.cam.mode === 'follow' && !TR.cam.operator) {
      const o = TR.cam.orbit; g.cine = null;
      if (o) { if (o.yaw != null) P.camYaw = o.yaw; if (o.pitch != null) P.camPitch = o.pitch; if (o.dist != null) P.camDist = o.dist; P.first = true; }
    }
    if (TR.cam.mode !== 'game') TR.g.engine.focus(null);
    return k.length;
  };
  // pose the camera for shot time t (seconds from frame 0). Called after every step, drawn or dry.
  TR.camPose = (t, dt) => {
    const g = TR.g, E = g.engine, cam = E.camera, C = TR.cam; if (!C || C.mode === 'game') return null;
    const K = C.keys, V = TR.V, sh = C.shake || 0;
    if (C.mode === 'follow' && !C.operator) {   // game third-person camera: only the lens and the hand-held drift
      if (K[0]?.fov) { cam.fov = K[0].fov; cam.updateProjectionMatrix(); }
      if (sh > 0) shake(cam, t, sh);
      return null;
    }
    if (!K.length) return null;
    const T0 = K[0].t, T1 = K[K.length - 1].t;
    const u = T1 > T0 ? T0 + ease(C.ease || 'inOut', (t - T0) / (T1 - T0)) * (T1 - T0) : T0;
    const P = hermite(K, u, k => k.p), L = hermite(K, u, k => k.l || K[0].l);
    const [fov] = hermite(K, u, k => [k.fov ?? K[0].fov ?? 50]), [roll] = hermite(K, u, k => [k.roll ?? 0]);
    let pos = new V(...P), look = new V(...L);
    if (C.mode === 'path' && C.anchor) {   // keys are offsets from a moving point (a character, a bone)
      if (C.anchorLive !== false || !TR._anchor) { const a = toVec(js(C.anchor, 'anchor'), new V()); if (a) TR._anchor = a; }
      if (TR._anchor) { pos.add(TR._anchor); look.add(TR._anchor); }
    }
    if (C.mode === 'follow') {   // operator follow: offsets in the target's frame, with lag
      const a = TR.actor(C.target || 'kai'); if (!a) return null;
      const tp = a.root.getWorldPosition(new V()), ty = a.root.rotation.y;
      let S = TR.followState;
      if (!S) S = TR.followState = { p: tp.clone(), yaw: C.yaw ?? ty };
      const kp = dt > 0 ? 1 - Math.exp(-dt / Math.max(1e-3, C.lag ?? 0.3)) : 1;
      S.p.lerp(tp, kp);
      if (C.frame !== 'world' && C.yaw === undefined) { let d = ty - S.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); S.yaw += d * (dt > 0 ? 1 - Math.exp(-dt / Math.max(1e-3, C.yawLag ?? 0.8)) : 1); }
      const yw = C.frame === 'world' ? 0 : S.yaw;
      const fx = Math.sin(yw), fz = Math.cos(yw), rx = -fz, rz = fx;   // forward and right of the target
      const toW = o => new V(S.p.x + rx * o.x + fx * o.z, S.p.y + o.y, S.p.z + rz * o.x + fz * o.z);
      pos = toW(pos); look = toW(look);
    }
    cam.position.copy(pos);
    cam.up.set(0, 1, 0); cam.lookAt(look);
    if (roll) cam.rotateZ(roll * D2R);
    if (sh > 0) shake(cam, t, sh);
    cam.fov = fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    // depth of field (high tier) + the dialogue rig: camera.focusOn (actor id, JS expression or [x,y,z]) overrides
    // the keys' focus distance (metres along the view axis); "rig": false keeps the rig lights off
    const fo = C.focusOn;
    let focus = null;
    if (fo) focus = Array.isArray(fo) ? C.focusV.set(...fo) : TR.actor(fo) ? headPos(fo, C.focusV) : toVec(js(fo, 'focusOn'), C.focusV);
    else if (C.hasFocus) {
      const dist = hermite(K, u, k => [k._focus])[0];
      const d = new V(); cam.getWorldDirection(d);
      focus = C.focusV.copy(cam.position).addScaledVector(d, Math.max(0.3, dist));
    }
    E.focus(focus, { rig: C.rig !== false });
    return { p: [pos.x, pos.y, pos.z], fov };
  };
  // smooth hand-held drift (same amplitudes as the storyboard previews: 4 cm and 0.34 degrees at shake 1)
  function shake(cam, t, sh) {
    const r = sh * 0.006, a = sh * 0.04;
    cam.position.x += wob(t * 1.1, 1) * a; cam.position.y += wob(t, 2) * a * 0.8;
    cam.rotateX(wob(t * 0.9, 5) * r); cam.rotateY(wob(t * 0.8, 4) * r); cam.rotateZ(wob(t * 0.7, 6) * r * 0.5);
  }

  // ---------- characters (for shot actions) ----------
  TR.place = (id, x, y, z, ry) => {
    const g = TR.g;
    if (id === 'kai' || id === 'player') { g.player.place(x, y, z, ry ?? g.player.yaw); return true; }
    const c = TR.actor(id); if (!c) return false;
    c.root.position.set(x, y, z); if (ry !== undefined) c.root.rotation.y = ry; return true;
  };
  TR.act = (id, pose) => { const c = TR.actor(id); if (!c) return false; c.pose = pose; return true; };   // 'sit','work','look','nod','sad','fall','talk','idle' or null
  // force any motion-capture clip (idle, walk_slow, walk, jog, run, sprint, crouch, talk, nod, look, sit, work, sad, fall)
  TR.clip = (id, name, fade = 0.3, speed = 1) => {
    const c = TR.actor(id), P = c?.person; if (!P) return false;
    if (!P.__play) { P.__play = P.play; P.play = (n, f, s) => P.__play(P.__force ? P.__force.name : n, P.__force ? P.__force.fade : f, P.__force ? P.__force.speed : s); }
    P.__force = name ? { name, fade, speed } : null; return true;
  };
  TR.look = (id, target) => {
    const c = TR.actor(id); if (!c) return false;
    if (target == null) c.lookTarget = null;
    else if (target === 'camera') c.lookTarget = TR.g.engine.camera;
    else if (typeof target === 'string') { const o = TR.actor(target); c.lookTarget = o ? (o.head || o.root) : null; }
    else c.lookTarget = new TR.V(...target);
    return true;
  };
  TR.talk = (id, secs = 2) => { const c = TR.actor(id); if (!c) return false; c.talk = secs; return true; };
  TR.freeze = (id, on = true) => { const c = TR.actor(id); if (!c) return false; c.frozen = on; return true; };
  TR.hide = (id, on = true) => { const c = TR.actor(id); if (!c) return false; c.root.visible = !on; return true; };
  // walk an NPC along waypoints [[x,z], ...] at speed m/s (feet on y of its root), facing the way it goes
  TR.walk = (id, pts, speed = 1.4, opts = {}) => {
    const g = TR.g, c = TR.actor(id); if (!c || id === 'kai') return false;
    if (c.__walkStop) c.__walkStop();
    let i = 0;
    c.__walkStop = g.onUpdate(dt => {
      if (i >= pts.length) { c.speed = 0; c.__walkStop(); c.__walkStop = null; return; }
      const [x, z] = pts[i], p = c.root.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.05) { i++; return; }
      const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st;
      c.faceTowards(x, z, dt, opts.turn ?? 5); c.speed = speed;
    });
    return true;
  };

  // ---------- storyboard helpers (window.DIR, tools/trailer/director.js API used by the shot specs) ----------
  // DIR.era(id, dur): an era switch on GAME time: the switch distortion rises, the era swaps at the midpoint
  // (visibility, apply(), the onSwitch listeners, the band flare) and the distortion falls.
  let sw = null;
  function eraTick(dt) {
    if (!sw) return;
    const g = TR.g, T = g.temporal, E = g.engine;
    sw.t += dt; const k = Math.min(1, sw.t / sw.dur);
    E.fx.uShift.value = Math.sin(k * Math.PI);
    if (!sw.swapped && k >= 0.5) {
      sw.swapped = true; const prev = T.current;
      T.setImmediate(sw.id);
      for (const l of T.listeners || []) { try { l(sw.id, prev); } catch (e) { TR.errors.push('onSwitch: ' + e.message); } }
      if (g.player?.char) g.player.char.wristBoost = 6;
    }
    if (k >= 1) { E.fx.uShift.value = 0; sw = null; }
  }
  const DIR = window.DIR = {
    fps: 24, i: 0, t: 0, pace: 0,
    actor: id => TR.actor(id),
    era(id, dur = 0.9) { if (!TR.g.temporal.def(id)) return 'no era ' + id; sw = { id, dur: Math.max(0.05, dur), t: 0, swapped: false }; return 'era ' + id; },
    freeze(on) { TR.g.engine.fx.uFreeze.value = on ? 1 : 0; return on; },
    shift(v) { TR.g.engine.fx.uShift.value = v; return v; },
    hideHud: () => TR.hideCss(),
    pose(p, l, fov = 50, roll = 0) {
      const cam = TR.g.engine.camera; cam.position.set(p[0], p[1], p[2]); cam.fov = fov; cam.updateProjectionMatrix();
      cam.up.set(0, 1, 0); cam.lookAt(new TR.V(l[0], l[1], l[2])); if (roll) cam.rotateZ(roll * D2R);
    },
    // simulate game time inside the page (virtual clock included); dt 0.1 like the director's setup steps
    async sim(sec, dt = 0.1) { const n = Math.round(sec / dt); for (let k = 0; k < n; k++) { TR.tick(dt); await TR.advance(dt * 1000); TR.render(false); } return TR.g.time; },
    async until(src, timeout = 60, dt = 0.1) {
      const f = typeof src === 'function' ? src : () => (0, eval)(src);
      for (let w = 0; w <= timeout; w += dt) { let ok = false; try { ok = !!f(); } catch { ok = false; } if (ok) return true; TR.tick(dt); await TR.advance(dt * 1000); TR.render(false); }
      return false;
    },
  };
  void DIR;

  // ---------- a frame: pose, render (dry or drawn), capture ----------
  // o = { t, dt, draw: 'dry' | 'full', capture: false | 'jpeg' | 'acc', first, last, w, h, quality, settle, lockAfter }
  TR.frame = o => {
    const g = TR.g; if (!TR.started || !g) return null;
    const E = g.engine;
    window.DIR.t = o.t; window.DIR.i = Math.round(o.t * window.DIR.fps);
    TR.camPose(o.t, o.dt);
    if (o.settle) E.settlePost();
    if (o.draw !== 'full') { TR.render(false); return null; }
    TR.render(true);
    if (o.lockAfter) TR.aeLock = true;
    const cv = E.renderer.domElement;
    if (o.capture === 'jpeg') return cv.toDataURL('image/jpeg', o.quality ?? 0.95);
    if (o.capture === 'acc') {
      const A = TR._acc && TR._acc.w === o.w && TR._acc.h === o.h ? TR._acc : (TR._acc = { w: o.w, h: o.h, buf: new Float32Array(o.w * o.h * 4), n: 0, cv: null, ctx: null });
      if (!A.cv) { A.cv = document.createElement('canvas'); A.cv.width = o.w; A.cv.height = o.h; A.ctx = A.cv.getContext('2d', { willReadFrequently: true }); }
      if (o.first) { A.buf.fill(0); A.n = 0; }
      A.ctx.imageSmoothingEnabled = true; A.ctx.imageSmoothingQuality = 'high';
      A.ctx.drawImage(cv, 0, 0, o.w, o.h);
      const d = A.ctx.getImageData(0, 0, o.w, o.h).data, b = A.buf;
      for (let i = 0; i < d.length; i++) b[i] += d[i];
      A.n++;
      if (!o.last) return null;
      const img = A.ctx.createImageData(o.w, o.h), q = img.data, k = 1 / A.n;
      for (let i = 0; i < q.length; i++) q[i] = b[i] * k + 0.5;
      for (let i = 3; i < q.length; i += 4) q[i] = 255;
      A.ctx.putImageData(img, 0, 0);
      return A.cv.toDataURL('image/jpeg', o.quality ?? 0.95);
    }
    return true;
  };
  TR.stats = () => { const E = TR.g.engine; return { calls: E.stats.calls, tris: E.stats.triangles, post: E.stats.post, tier: E.quality, grade: E.grade, time: +TR.g.time.toFixed(3) }; };
})();
