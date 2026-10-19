// Browser-side helper for the rendering reference views (see docs/RENDERING.md, "Reference views").
// Evaluated in the game page by tools/render/refviews.mjs (and inlined into drive.mjs steps files).
// Defines window.REF:
//   REF.view(v)      fixed camera pose v = { name, p:[x,y,z], l:[x,y,z], fov, place?:[x,y,z,yaw], era?, pre?, frames? }
//                    The pose is held through game.cine (mission camera code cannot move it), the world runs a few
//                    frames around it, then the game is paused (time stops: crowd, rain, grain freeze) and the pose
//                    is re-applied. HUD / dialogue / letterbox DOM is hidden so only the 3D frame is captured.
//   REF.measure(n)   times 5 full frames (composer) and 3 scene-only frames, each fenced with readPixels, and
//                    records renderer counts. Results are also pushed to window.REF_LOG.
(() => {
  const g = window.__game, E = g.engine, P = E.camera.position.constructor;
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  const frames = n => new Promise(r => { let k = 0; const f = () => { if (++k >= n) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const vis = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  window.REF = {
    hide() {
      if (document.getElementById('refcss')) return;
      const s = document.createElement('style'); s.id = 'refcss';
      s.textContent = 'body > *:not(#app){display:none!important} #app > *:not(#viewport){display:none!important}';
      document.head.appendChild(s);
    },
    pose(v) { const c = E.camera; c.position.set(...v.p); c.fov = v.fov || 58; c.updateProjectionMatrix(); c.lookAt(new P(...v.l)); },
    async view(v) {
      REF.hide(); g.paused = false; g.shake = 0;
      if (v.era && g.temporal.current !== v.era) g.temporal.setImmediate(v.era);
      if (v.place) g.player.place(...v.place);
      if (v.pre) (0, eval)(v.pre);
      const a = new P(...v.p), b = new P(...v.l);
      g.cine = { from: { p: a.clone(), l: b.clone() }, to: { p: a.clone(), l: b.clone() }, t: 0, dur: 0.001, look: b.clone(), fov: v.fov || 58 };
      REF.pose(v); await frames(v.frames || 8);
      g.paused = true; g.cine = null; g.shake = 0; REF.pose(v); E.fx.uShift.value = 0; E.fx.uDamage.value = 0;
      if (v.post) (0, eval)(v.post);
      await frames(3);
      return 'view ' + v.name;
    },
    measure(name) {
      const r = E.renderer, gl = r.getContext(), px = new Uint8Array(4), t = g.time;
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      E.render(t); sync(); E.render(t); sync();
      const full = []; for (let i = 0; i < 5; i++) { const t0 = performance.now(); E.render(t); sync(); full.push(performance.now() - t0); }
      const st = { ...E.stats };
      const sc = []; for (let i = 0; i < 3; i++) { const t0 = performance.now(); r.setRenderTarget(null); r.render(g.scene, E.camera); sync(); sc.push(performance.now() - t0); }
      E.render(t); sync();
      const L = { point: 0, spot: 0, dir: 0, hemi: 0, amb: 0, shadow: 0 }; let objects = 0, instanced = 0, transparent = 0; const mats = new Set();
      g.scene.traverse(o => {
        if (!vis(o)) return;
        if (o.isLight) {
          if (o.isPointLight) L.point++; else if (o.isSpotLight) L.spot++; else if (o.isDirectionalLight) L.dir++; else if (o.isHemisphereLight) L.hemi++; else if (o.isAmbientLight) L.amb++;
          if (o.castShadow && r.shadowMap.enabled) L.shadow++;
        }
        if (o.isMesh || o.isPoints || o.isLine) { objects++; if (o.isInstancedMesh) instanced++; for (const m of [].concat(o.material)) { mats.add(m); if (m.transparent) transparent++; } }
      });
      const res = { view: name, tier: E.quality, mobile: E.device.mobile, size: innerWidth + 'x' + innerHeight, pr: +E.pixelRatio.toFixed(2),
        calls: st.calls, tris: st.triangles, sceneCalls: st.sceneCalls, sceneTris: st.sceneTriangles,
        frameMs: +med(full).toFixed(1), frameMinMs: +Math.min(...full).toFixed(1), sceneOnlyMs: +med(sc).toFixed(1),
        lights: L, objects, instanced, transparent, materials: mats.size, programs: r.info.programs.length,
        textures: r.info.memory.textures, geometries: r.info.memory.geometries, era: g.temporal.current };
      (window.REF_LOG = window.REF_LOG || []).push(res); return res;
    },
  };
  return 'REF ready';
})();
