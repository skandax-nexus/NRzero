// Cost of the stage-4 infrastructure upgrade (facade buildings, masonry, street kit, static batching) on one reference
// view, A/B/A/B in one page (docs/RENDERING.md, stage 4 "Cost"). Per frame it records the CPU time of the browser's
// GPU process (the SwiftShader rasterizer: GPU work), of the renderer process (JavaScript + WebGL command encoding:
// the CPU / draw-call side) and the wall clock, plus draw calls and triangles.
//   node tools/render/infraab.mjs <mission m1..m4> <view> <gfx> W H [--mobile] <reps> <frames> <cfg>...
//   cfg: new | legacy (everything as before stage 4) | nobatch (upgrade without batching) | batchonly (legacy kit, batched)
//        | plainmat (upgrade, but batched facades drawn with a plain material: geometry cost only)
//        | probe1 / probe2 (facade shader cut short: plumbing only / wall without windows) | aniso1 (facade walls without anisotropic filtering)
//        | mipnear / miptri (facade wall textures with LinearMipmapNearest / LinearMipmapLinear filtering)
//        | fulllight ('low' facades with the full BRDF for direct lights)
//        | oldmat (stage-3 kit surface materials reverted to their canvas textures; everything else as 'new')
//        | i0 / i1 / i2 (facades forced to RZ_INTERIOR 0 / 1 / 2)
//   node tools/render/infraab.mjs m1 m1a_establishing low 844 390 --mobile 6 2 new legacy
//   --shots=<dir> also saves the first frame of every cfg as <dir>/<view>_<gfx>_<cfg>.png (same frame, same page)
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url';
const R = path.dirname(url.fileURLToPath(import.meta.url));
const a = process.argv.slice(2); const mobile = a.includes('--mobile'); const pos = a.filter(x => !x.startsWith('--'));
const base = (a.find(x => x.startsWith('--base=')) || '--base=http://localhost:8765/').slice(7);
const shots = (a.find(x => x.startsWith('--shots=')) || '').slice(8);
const [mission, viewName, gfx, W, H, reps, frames, ...cfgs] = pos;
const VIEWS = JSON.parse(fs.readFileSync(path.join(R, 'views.json'), 'utf8')); const M = VIEWS[mission]; const view = M.views.find(v => v.name === viewName);
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
const ctx = await b.newContext({ viewport: { width: +W >> 2, height: +H >> 2 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto(`${base}index.html?m=${M.m}&dtcap=0.25&gfx=${gfx}&auto`);
await p.waitForFunction(M.ready, null, { timeout: 900000, polling: 1000 });
const ppidOf = d => { try { const t = fs.readFileSync(`/proc/${d}/stat`, 'utf8'); return +t.slice(t.lastIndexOf(')') + 2).split(' ')[1]; } catch { return -1; } };
const all = fs.readdirSync('/proc').filter(d => /^\d+$/.test(d)).map(d => { try { return { pid: +d, ppid: ppidOf(d), cmd: fs.readFileSync(`/proc/${d}/cmdline`, 'utf8') }; } catch { return null; } }).filter(Boolean);
const mainP = all.find(x => x.ppid === process.pid && x.cmd.includes('user-data-dir'));
const udd = mainP && mainP.cmd.split('\0').find(x => x.startsWith('--user-data-dir='));
const pick = t => all.filter(x => udd && x.cmd.includes('--type=' + t) && x.cmd.includes(udd)).map(x => x.pid);
const GPU = pick('gpu-process').pop(), RND = pick('renderer');
await p.setViewportSize({ width: +W, height: +H }); await p.waitForTimeout(1500);
await p.evaluate(fs.readFileSync(path.join(R, 'refhelper.js'), 'utf8'));
await p.evaluate(`REF.view(${JSON.stringify(view)})`);
const tck = 100;
const cpu = pid => { try { const s = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); const f = s.slice(s.lastIndexOf(')') + 2).split(' '); return (+f[11] + +f[12]) / tck; } catch { return 0; } };
const rcpu = () => RND.reduce((s, pid) => s + cpu(pid), 0);
const out = {}; for (const c of cfgs) out[c] = { gpu: [], cpu: [], wall: [], js: [], calls: 0, tris: 0 };
for (let k = 0; k < +reps; k++) for (const c of cfgs) {
  const st = await p.evaluate(cfg => {
    const g = window.__game, E = g.engine;
    E.setInfraLegacy(cfg === 'legacy' || cfg === 'batchonly');
    if (E.setMaterialsLegacy) E.setMaterialsLegacy(cfg === 'oldmat');
    const iv = /^i(\d)$/.exec(cfg);
    g.scene.traverse(o => { const m = o.material; if (!m || !m.userData?.facade) return; if (m.userData.i0 === undefined) m.userData.i0 = m.defines.RZ_INTERIOR;
      const want = iv ? +iv[1] : m.userData.i0; if (String(m.defines.RZ_INTERIOR) !== String(want)) { m.defines.RZ_INTERIOR = want; m.needsUpdate = true; } });
    // probeN: facade shader cut short (realism RZ_FACADE_PROBE: 1 = plumbing only, 2 = wall without windows)
    const pr = /^probe(\d)$/.exec(cfg);
    // fulllight: 'low' facades with the full physical BRDF for direct lights (realism RZ_FACADE_FULL_LIGHT)
    g.scene.traverse(o => { const m = o.material; if (!m || !m.userData?.facade) return; const want = cfg === 'fulllight' ? 1 : undefined;
      if (m.defines.RZ_FACADE_FULL_LIGHT !== want) { if (want) m.defines.RZ_FACADE_FULL_LIGHT = 1; else delete m.defines.RZ_FACADE_FULL_LIGHT; m.needsUpdate = true; } });
    // aniso1: the facade wall texture array without anisotropic filtering (re-uploaded; restored by the other cfgs)
    g.scene.traverse(o => { const m = o.material, U = m?.userData?.facade?.uniforms; if (!U) return;
      for (const k of ['rzWA', 'rzWN', 'rzWO']) { const t = U[k].value; if (!t) continue; if (t.userData.an0 === undefined) t.userData.an0 = t.anisotropy;
        const want = cfg === 'aniso1' ? 1 : t.userData.an0; if (t.anisotropy !== want) { t.anisotropy = want; t.needsUpdate = true; }
        if (t.userData.mf0 === undefined) t.userData.mf0 = t.minFilter;
        const mf = cfg === 'mipnear' ? 1004 : cfg === 'miptri' ? 1008 : t.userData.mf0; if (t.minFilter !== mf) { t.minFilter = mf; t.needsUpdate = true; } } });
    g.scene.traverse(o => { const m = o.material; if (!m || !m.userData?.facade) return; const want = pr ? +pr[1] : undefined;
      if ((m.defines.RZ_FACADE_PROBE) !== want) { if (want) m.defines.RZ_FACADE_PROBE = want; else delete m.defines.RZ_FACADE_PROBE; m.needsUpdate = true; } });
    if (cfg === 'nobatch') { E._batch.reset(); E.batchOn = false; }
    if (cfg === 'batchonly') { E.batchOn = true; E._batch.scan(g.scene); E._batch.update(g.scene, E.camera, 1); }
    if (cfg === 'plainmat') {   // upgraded geometry with a plain material: separates geometry cost from facade-shader cost
      g.scene.traverse(o => { if (o.userData.rzBatch && o.material.userData.facade) o.material = o.userData.pm || (o.userData.pm = new o.material.constructor({ color: 0x404448, roughness: 0.8 })); });
    }
    E.settlePost(); E._refRender.call(E, g.time); E.renderer.getContext().readPixels(0, 0, 1, 1, 6408, 5121, new Uint8Array(4));
    return { calls: E.stats.calls, tris: E.stats.triangles };
  }, c);
  out[c].calls = st.calls; out[c].tris = st.tris;
  if (shots && k === 0) { fs.mkdirSync(shots, { recursive: true }); const d = await p.evaluate('REF.grab()'); fs.writeFileSync(path.join(shots, `${viewName}_${gfx}${mobile ? '_mobile' : ''}_${c}.png`), Buffer.from(d.split(',')[1], 'base64')); }
  const g0 = cpu(GPU), r0 = rcpu(), t0 = Date.now();
  // js: main-thread time of the frame's render call (three.js + WebGL command submission: the draw-call side), the
  // GPU queue drained before each frame so it measures submission only
  const js = await p.evaluate(n => { const g = window.__game, E = g.engine, gl = E.renderer.getContext(), px = new Uint8Array(4); let t = 0;
    for (let i = 0; i < n; i++) { gl.readPixels(0, 0, 1, 1, 6408, 5121, px); const t0 = performance.now(); E._refRender.call(E, g.time); t += performance.now() - t0; gl.readPixels(0, 0, 1, 1, 6408, 5121, px); }
    return t / n; }, +frames);
  out[c].js.push(js);
  out[c].gpu.push((cpu(GPU) - g0) / +frames * 1000); out[c].cpu.push((rcpu() - r0) / +frames * 1000); out[c].wall.push((Date.now() - t0) / +frames);
}
const st = v => { const s = v.slice().sort((x, z) => x - z); return { med: +s[s.length >> 1].toFixed(1), min: +s[0].toFixed(1), max: +s[s.length - 1].toFixed(1) }; };
const res = {}; for (const c in out) res[c] = { calls: out[c].calls, tris: out[c].tris, gpuMs: st(out[c].gpu), rendererCpuMs: st(out[c].cpu), wallMs: st(out[c].wall), jsSubmitMs: st(out[c].js) };
console.log(JSON.stringify({ mission, viewName, gfx, size: W + 'x' + H, mobile, frames: +frames, reps: +reps, result: res }));
await b.close();
