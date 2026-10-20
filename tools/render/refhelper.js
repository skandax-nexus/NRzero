// Browser-side helper for the rendering reference views (see docs/RENDERING.md, "Reference views").
// Evaluated in the game page by tools/render/refviews.mjs (and inlined into drive.mjs steps files).
// Defines window.REF:
//   Installing the helper takes over the frame loop: the game is paused and the engine's per-rAF render is held, so
//   frames are only simulated and drawn when REF asks for them (fixed 1/30 s steps: the same view gives the same
//   frame, and SwiftShader is not kept busy drawing frames nobody looks at). REF.release() gives the loop back.
//   REF.view(v)      fixed camera pose v = { name, p:[x,y,z], l:[x,y,z], fov, place?:[x,y,z,yaw], era?, pre?, post?, frames? }
//                    The pose is held through game.cine (mission camera code cannot move it), the world is stepped
//                    v.frames (default 6) times around it, then time stops and the pose is re-applied and drawn.
//                    HUD / dialogue / letterbox DOM is hidden so only the 3D frame is captured.
//                    Close-up views (fov <= 45) hold engine.focus() on the look target like game.shot() does, and
//                    engine.settlePost() snaps the smoothed post values (grade, eye adaptation, focus) first.
//   REF.postOff(list) switches post features off for an A/B capture (null restores them).
//   REF.measure(n)   times 3 full frames (composer) and 1 scene-pass-only frame, each fenced with readPixels, and
//                    records renderer counts. Results are also pushed to window.REF_LOG.
(() => {
  const g = window.__game, E = g.engine, P = E.camera.position.constructor;
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  const yieldNow = () => new Promise(res => setTimeout(res, 30));
  // hold the game loop (see header); a second install keeps the first saved render
  const draw = E._refRender || (E._refRender = E.render);
  E.render = () => {}; g.paused = true; g.audio.ctx?.suspend?.();
  const vis = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const REF = window.REF = {
    hide() {
      if (document.getElementById('refcss')) return;
      const s = document.createElement('style'); s.id = 'refcss';
      s.textContent = 'body > *:not(#app){display:none!important} #app > *:not(#viewport){display:none!important}';
      document.head.appendChild(s);
    },
    pose(v) { const c = E.camera; c.position.set(...v.p); c.fov = v.fov || 58; c.updateProjectionMatrix(); c.lookAt(new P(...v.l)); },
    release() { E.render = draw; delete E._refRender; g.paused = false; g.audio.ctx?.resume?.(); },
    async view(v) {
      REF.hide(); g.shake = 0;
      if (v.era && g.temporal.current !== v.era) g.temporal.setImmediate(v.era);
      if (v.place) g.player.place(...v.place);
      if (v.pre) (0, eval)(v.pre);
      const a = new P(...v.p), b = new P(...v.l);
      g.cine = { from: { p: a.clone(), l: b.clone() }, to: { p: a.clone(), l: b.clone() }, t: 0, dur: 0.001, look: b.clone(), fov: v.fov || 58 };
      REF.pose(v);
      // settle: simulate only (drawing is not needed to advance the world, and every full-size SwiftShader draw
      // that blocks the page for seconds lets Chromium's IPC queues balloon; see measure())
      for (let i = 0; i < (v.frames || 6); i++) { g.step(1 / 30); await yieldNow(); }
      g.cine = null; g.shake = 0; REF.pose(v); E.fx.uShift.value = 0; E.fx.uDamage.value = 0;
      if (v.post) (0, eval)(v.post);
      // close-up views (fov <= 45, the dialogue shots) focus like game.shot() does; others render as gameplay.
      // settlePost() jumps grade / eye adaptation / focus to their targets so every capture is deterministic.
      E.focus?.(v.fov && v.fov <= 45 ? b : null); E.settlePost?.();
      draw.call(E, g.time); await yieldNow();
      return 'view ' + v.name;
    },
    // Async on purpose: a synchronous minute of SwiftShader frames makes Chromium queue IPC in the browser and
    // renderer processes until the shared container OOM-kills the renderer, so each timed frame yields first.
    async measure(name, n = 3) {
      const r = E.renderer, gl = r.getContext(), px = new Uint8Array(4), t = g.time;
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const render = draw;
      {
        await yieldNow(); render.call(E, t); sync();
        const full = []; for (let i = 0; i < n; i++) { await yieldNow(); const t0 = performance.now(); render.call(E, t); sync(); full.push(performance.now() - t0); }
        const st = { ...E.stats };
        // scene pass only (shadow maps + main pass into the composer's input target, exactly what RenderPass draws)
        const sc = []; for (let i = 0; i < 1; i++) { await yieldNow(); const t0 = performance.now(); r.setRenderTarget(E.composer.readBuffer); r.clear(); r.render(g.scene, E.camera); r.setRenderTarget(null); sync(); sc.push(performance.now() - t0); }
        r.setRenderTarget(null);
        const L = { point: 0, spot: 0, dir: 0, hemi: 0, amb: 0, shadow: 0 }; let objects = 0, instanced = 0, transparent = 0; const mats = new Set();
        g.scene.traverse(o => {
          if (!vis(o)) return;
          if (o.isLight) {
            if (o.isPointLight) L.point++; else if (o.isSpotLight) L.spot++; else if (o.isDirectionalLight) L.dir++; else if (o.isHemisphereLight) L.hemi++; else if (o.isAmbientLight) L.amb++;
            if (o.castShadow && r.shadowMap.enabled) L.shadow++;
          }
          if (o.isMesh || o.isPoints || o.isLine) { objects++; if (o.isInstancedMesh) instanced++; for (const m of [].concat(o.material)) { mats.add(m); if (m.transparent) transparent++; } }
        });
        const res = { view: name, tier: E.quality, mobile: E.device.mobile, size: window.innerWidth + "x" + window.innerHeight, pr: +E.pixelRatio.toFixed(2),
          calls: st.calls, tris: st.triangles, sceneCalls: st.sceneCalls, sceneTris: st.sceneTriangles,
          frameMs: +med(full).toFixed(1), frameMinMs: +Math.min(...full).toFixed(1), sceneMinMs: +Math.min(...sc).toFixed(1),
          lights: L, objects, instanced, transparent, materials: mats.size, programs: r.info.programs.length,
          textures: r.info.memory.textures, geometries: r.info.memory.geometries, era: g.temporal.current, post: st.post, grade: E.grade };
        const mem = performance.memory; if (mem) res.jsHeapMB = Math.round(mem.usedJSHeapSize / 1048576);
        (window.REF_LOG = window.REF_LOG || []).push(res); return res;
      }
    },
    // A/B: switch the post features listed in `off` off (null = back to the saved set), snapping the smoothed values.
    postOff(off) {
      if (off) { if (!REF._postSave) REF._postSave = new Set(E.postOff); E.postOff = new Set(off); }
      else if (REF._postSave) { E.postOff = REF._postSave; REF._postSave = null; }
      E.applyPost(); E.settlePost(); draw.call(E, g.time);
      return E.stats.post;
    },
    // PNG data URL of the current frame (canvas only: cheaper and steadier than a page screenshot).
    grab() { draw.call(E, g.time); return E.renderer.domElement.toDataURL('image/png'); },
  };
  return 'REF ready';
})();
