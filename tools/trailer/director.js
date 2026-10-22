// Browser-side shot director for the AFTERZERO trailer (docs/TRAILER.md, "Shot spec").
// Evaluated in the game page by tools/trailer/preview.mjs (storyboard stills) and by the trailer recorder.
// It holds the frame loop like tools/render/refhelper.js (frames are simulated and drawn only on request), so a shot
// is frame-exact at its fps however slow the software renderer is. Defines window.DIR:
//   DIR.sim(sec, dt)         simulate game time without drawing (setup "wait")
//   DIR.until(js, timeout)   simulate until the JS expression is truthy (setup "until"); resolves true / false
//   DIR.begin(shot)          start a shot: grade, camera mode, focus; resets the shot clock
//   DIR.frame(i, draw)       simulate frame i (1/fps) and pose the camera; returns a JPEG data URL when draw is true
//   DIR.era(id, dur)         temporal switch driven by GAME time (temporal.switchTo uses wall time, which a
//                            frame-stepped capture would skip): the switch distortion rises, the era swaps at the
//                            midpoint (visibility, apply(), onSwitch listeners, band flare) and the distortion falls
//   DIR.freeze(on)           the Zero Second freeze look (desaturation uniform) without touching mission state
//   DIR.hideHud()            hide every DOM layer over the canvas (captures read the canvas only anyway)
//   DIR.actor(id)            the Character with that id (Kai is 'kai'), or null
//   DIR.pose(p, l, fov, roll) place the camera now (used by shots that need an exact camera inside a setup)
/* global window, document */
(() => {
  const g = window.__game, E = g.engine, cam = E.camera, V = cam.position.constructor;
  const draw = E._refRender || (E._refRender = E.render);
  E.render = () => {}; g.paused = true; g.audio.ctx?.suspend?.();
  E.resize?.();   // the engine queues resizes on rAF; apply the capture size now
  const yieldNow = () => new Promise(res => setTimeout(res, 0));
  const ease = (k, m) => {
    k = Math.max(0, Math.min(1, k));
    if (m === 'linear') return k;
    if (m === 'in') return k * k;
    if (m === 'out') return 1 - (1 - k) * (1 - k);
    if (m === 'sine') return 0.5 - 0.5 * Math.cos(Math.PI * k);
    return k * k * (3 - 2 * k);                      // 'inOut' (default)
  };
  // uniform Catmull-Rom through the key points (end points repeated), so multi-key paths never stop at a key
  const cr = (a, b, c, d, s) => {
    const s2 = s * s, s3 = s2 * s;
    return 0.5 * ((2 * b) + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s2 + (-a + 3 * b - 3 * c + d) * s3);
  };
  const noise = (t, f) => Math.sin(t * f) * 0.6 + Math.sin(t * f * 2.31 + 1.3) * 0.3 + Math.sin(t * f * 5.17 + 4.1) * 0.1;
  const tmpA = new V(), tmpB = new V(), focusPt = new V();
  const DIR = window.DIR = {
    shot: null, fps: 24, i: 0, t: 0, _sw: null,
    hideHud() {
      if (document.getElementById('dircss')) return;
      const s = document.createElement('style'); s.id = 'dircss';
      s.textContent = 'body > *:not(#app){display:none!important} #app > *:not(#viewport){display:none!important}';
      document.head.appendChild(s);
    },
    actor(id) { return id === 'kai' ? g.player.char : g.actors[id] || null; },
    // Setup time runs at most as fast as real time by default (pace 1), like the scripted playthroughs in tools/tests
    // (mission scripts mix game time with wall-clock waits: dialogue autoplay, temporal.switchTo). pace 0 = flat out.
    pace: 1,
    async _tick(k, t0, dt, pace) {
      if (!pace) { if (k % 3 === 2) await yieldNow(); return; }
      const ahead = (k + 1) * dt * 1000 / pace - (performance.now() - t0);
      await new Promise(res => setTimeout(res, Math.max(0, ahead)));
    },
    async sim(sec, dt = 1 / 30, pace = DIR.pace) {
      const n = Math.round(sec / dt), t0 = performance.now();
      for (let k = 0; k < n; k++) { g.step(dt); DIR._eraTick(dt); await DIR._tick(k, t0, dt, pace); }
      return g.time;
    },
    async until(js, timeout = 60, dt = 1 / 30, pace = DIR.pace) {
      const f = typeof js === 'function' ? js : () => (0, eval)(js);
      const t0 = performance.now();
      for (let k = 0; k * dt < timeout; k++) {
        let ok = false; try { ok = !!f(); } catch { ok = false; }
        if (ok) return true;
        g.step(dt); DIR._eraTick(dt); await DIR._tick(k, t0, dt, pace);
      }
      return false;
    },
    era(id, dur = 0.9) {
      const T = g.temporal; if (!T.def(id)) return 'no era ' + id;
      DIR._sw = { id, dur: Math.max(0.05, dur), t: 0, swapped: false };
      return 'era ' + id;
    },
    _eraTick(dt) {
      const S = DIR._sw; if (!S) return;
      S.t += dt; const k = Math.min(1, S.t / S.dur), T = g.temporal;
      E.fx.uShift.value = Math.sin(k * Math.PI);
      if (!S.swapped && k >= 0.5) {
        S.swapped = true; const prev = T.current;
        T.setImmediate(S.id);
        for (const l of T.listeners || []) { try { l(S.id, prev); } catch (e) { console.log('onSwitch', e.message); } }
        if (g.player?.char) g.player.char.wristBoost = 6;
      }
      if (k >= 1) { E.fx.uShift.value = 0; DIR._sw = null; }
    },
    freeze(on) { E.fx.uFreeze.value = on ? 1 : 0; return on; },
    pose(p, l, fov = 50, roll = 0) {
      cam.position.set(p[0], p[1], p[2]); cam.fov = fov; cam.updateProjectionMatrix();
      cam.up.set(0, 1, 0); cam.lookAt(tmpA.set(l[0], l[1], l[2]));
      if (roll) cam.rotateZ(roll * Math.PI / 180);
    },
    // camera state of a path shot at shot time t (seconds from frame 0, head handle included)
    sample(c, t) {
      const K = c.keys; if (!K || !K.length) return null;
      if (K.length === 1) return { p: K[0].p, l: K[0].l, fov: K[0].fov ?? 50, roll: K[0].roll || 0, focus: K[0].focus ?? null };
      const t0 = K[0].t, t1 = K[K.length - 1].t;
      const T = t0 + ease((t - t0) / Math.max(1e-6, t1 - t0), c.ease) * (t1 - t0);
      let i = 0; while (i < K.length - 2 && T > K[i + 1].t) i++;
      const a = K[Math.max(0, i - 1)], b = K[i], d = K[i + 1], e = K[Math.min(K.length - 1, i + 2)];
      const s = Math.max(0, Math.min(1, (T - b.t) / Math.max(1e-6, d.t - b.t)));
      const v = (k) => [0, 1, 2].map(j => cr(a[k][j], b[k][j], d[k][j], e[k][j], s));
      const lin = (k, def) => (b[k] ?? def) + ((d[k] ?? b[k] ?? def) - (b[k] ?? def)) * s;
      const fb = b.focus ?? null, fd = d.focus ?? fb;
      return { p: v('p'), l: v('l'), fov: lin('fov', 50), roll: lin('roll', 0), focus: fb == null ? fd : fd == null ? fb : fb + (fd - fb) * s };
    },
    begin(shot) {
      DIR.shot = shot; DIR.fps = shot.fps || 24; DIR.i = 0; DIR.t = 0; DIR._anchor = null;
      DIR.hideHud(); g.shake = 0;
      if (shot.grade) E.setGrade(shot.grade, { instant: true });
      const c = shot.camera || { mode: 'game' };
      if (c.mode === 'follow' && c.orbit) {
        const P = g.player; if (c.orbit.yaw != null) P.camYaw = c.orbit.yaw; if (c.orbit.pitch != null) P.camPitch = c.orbit.pitch;
        if (c.orbit.dist != null) P.camDist = c.orbit.dist; P.first = true;
      }
      if (c.mode === 'follow') { g.cine = null; E.focus(null); }
      E.settlePost?.();
      return 'begin ' + shot.id;
    },
    _hold(st) {   // keep mission camera code off a path shot (refhelper / record.mjs pattern)
      const a = tmpA.set(...st.p), b = tmpB.set(...st.l);
      g.cine = { from: { p: a.clone(), l: b.clone() }, to: { p: a.clone(), l: b.clone() }, t: 0, dur: 0.001, look: b.clone(), fov: st.fov };
    },
    frame(i, render = true) {
      const shot = DIR.shot, c = shot.camera || { mode: 'game' }, dt = 1 / DIR.fps;
      const t = i / DIR.fps; DIR.i = i; DIR.t = t;
      const st = c.mode === 'path' ? DIR.sample(c, t) : null;
      if (st && c.anchor) {        // keys are offsets from a moving point (a character, a bone): evaluated every frame
        if (c.anchorLive !== false || !DIR._anchor) { let a = null; try { a = (0, eval)(c.anchor); } catch { a = null; } if (a) DIR._anchor = [a.x, a.y, a.z]; }
        const A = DIR._anchor || [0, 0, 0];
        st.p = st.p.map((v, j) => v + A[j]); st.l = st.l.map((v, j) => v + A[j]);
      }
      if (st) DIR._hold(st);
      g.step(dt); DIR._eraTick(dt);
      if (st) {
        DIR.pose(st.p, st.l, st.fov, st.roll);
        if (c.focusOn) { let tg = null; try { tg = (0, eval)(c.focusOn); } catch { tg = null; } E.focus(tg, { active: () => true }); }
        else if (st.focus != null) { cam.getWorldDirection(focusPt); focusPt.multiplyScalar(st.focus).add(cam.position); E.focus(focusPt, { active: () => true }); }
        else E.focus(null);
      } else if (c.mode === 'follow' && c.keys?.[0]?.fov) { cam.fov = c.keys[0].fov; cam.updateProjectionMatrix(); }
      if (c.shake) {
        const a = c.shake * 0.04, r = c.shake * 0.006;
        cam.position.x += noise(t, 7.1) * a; cam.position.y += noise(t + 3, 6.3) * a;
        cam.rotateX(noise(t + 9, 5.2) * r); cam.rotateY(noise(t + 17, 4.7) * r);
      }
      if (!render) return null;
      draw.call(E, g.time);
      return E.renderer.domElement.toDataURL('image/jpeg', 0.92);
    },
    release() { E.render = draw; delete E._refRender; g.paused = false; },
  };
  return 'DIR ready';
})();
