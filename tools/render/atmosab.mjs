// Cost of the stage-6 atmosphere upgrade (kit Rain as GPU streaks, kit sky() cloud deck) on one reference view,
// same page and same frame, A/B/A/B: 'new' draws the current Rain / sky, 'legacy' swaps in the pre-upgrade line rain
// (built by kit's own legacy path) and the cloudless sky program. Reports the browser GPU process's CPU time per frame
// (SwiftShader's rasterizer work, see cpuab.mjs) and the main-thread cost of Rain.update() per frame (the CPU side a
// phone pays every frame). See docs/RENDERING.md section 12.
//   node tools/render/atmosab.mjs <mission m1..m4> <view> <gfx> W H [--mobile] <reps> <frames> [--shots=dir]
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url';
const R = path.dirname(url.fileURLToPath(import.meta.url));
const a = process.argv.slice(2); const mobile = a.includes('--mobile'); const pos = a.filter(x => !x.startsWith('--'));
const shots = (a.find(x => x.startsWith('--shots=')) || '').slice(8);
const [mission, viewName, gfx, W, H, reps, frames] = pos;
const VIEWS = JSON.parse(fs.readFileSync(path.join(R, 'views.json'), 'utf8')); const M = VIEWS[mission]; const view = M.views.find(v => v.name === viewName);
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
const ctx = await b.newContext({ viewport: { width: +W >> 2, height: +H >> 2 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 200)); });
await p.goto(`http://localhost:8765/index.html?m=${M.m}&dtcap=0.25&gfx=${gfx}&auto`);
await p.waitForFunction(M.ready, null, { timeout: 900000, polling: 1000 });
const ppidOf = d => { try { const t = fs.readFileSync(`/proc/${d}/stat`, 'utf8'); return +t.slice(t.lastIndexOf(')') + 2).split(' ')[1]; } catch { return -1; } };
const all = fs.readdirSync('/proc').filter(d => /^\d+$/.test(d)).map(d => { try { return { pid: +d, ppid: ppidOf(d), cmd: fs.readFileSync(`/proc/${d}/cmdline`, 'utf8') }; } catch { return null; } }).filter(Boolean);
const mainP = all.find(x => x.ppid === process.pid && x.cmd.includes('user-data-dir'));
const udd = mainP && mainP.cmd.split('\0').find(x => x.startsWith('--user-data-dir='));
const GPU = all.filter(x => udd && x.cmd.includes('gpu-process') && x.cmd.includes(udd)).map(x => x.pid).pop();
await p.setViewportSize({ width: +W, height: +H }); await p.waitForTimeout(1500);
await p.evaluate(fs.readFileSync(path.join(R, 'refhelper.js'), 'utf8'));
await p.evaluate(`REF.view(${JSON.stringify(view)})`);
// build the legacy twins once
const info = await p.evaluate(async () => {
  const KIT = await import('/src/world/kit.js');
  const g = window.__game, E = g.engine, S = E.scene, cam = E.camera, A = window.__atmos = { rain: [], sky: [] };
  S.traverse(o => {
    if (o.userData.rzRain && o.isMesh && o.material.uniforms?.uLen) {
      const L = Object.create(KIT.Rain.prototype); L.count = o.geometry.instanceCount; L.area = o.material.uniforms.uArea.value.x; L.frozen = false;
      L._legacy(L.count, L.area, o.material.uniforms.uCol.value.getHex()); L._legacyUpdate(0.016, cam); L.mesh.visible = false; o.parent.add(L.mesh);
      A.rain.push({ n: o, l: L.mesh, legacy: L });
    }
    if (o.isMesh && o.material.uniforms?.uCloud && o.material.defines?.CLOUDS) {
      const m0 = o.material, m1 = m0.clone(); m1.defines = { CLOUDS: 0 }; m1.uniforms = m0.uniforms; A.sky.push({ o, n: m0, l: m1 });
    }
  });
  A.set = legacy => { for (const r of A.rain) { r.n.visible = !legacy; r.l.visible = legacy; } for (const s of A.sky) s.o.material = legacy ? s.l : s.n; };
  // main-thread cost of one Rain.update() (legacy: the CPU streak loop + buffer upload flag; new: two uniforms)
  const tUpd = (fn) => { const t0 = performance.now(); for (let i = 0; i < 200; i++) fn(); return (performance.now() - t0) / 200; };
  const r0 = A.rain[0];
  const upd = r0 ? { legacy: tUpd(() => { r0.legacy._legacyUpdate(1 / 30, cam); }), newer: tUpd(() => { const f = r0.n.material.uniforms; f.uT.value += 1 / 30; f.uLen.value += 0; }) } : null;
  if (r0) r0.legacy._legacyUpdate(0, cam);
  return { rain: A.rain.map(r => r.legacy.count), sky: A.sky.length, upd };
});
console.log('atmos', JSON.stringify(info));
const tck = 100;
const gpuCpu = () => { const s = fs.readFileSync(`/proc/${GPU}/stat`, 'utf8'); const f = s.slice(s.lastIndexOf(')') + 2).split(' '); return (+f[11] + +f[12]) / tck; };
const cfgs = ['new', 'legacy']; const out = { new: [], legacy: [] }; const wall = { new: [], legacy: [] };
for (let k = 0; k < +reps; k++) for (const c of cfgs) {
  await p.evaluate(legacy => { const g = window.__game, E = g.engine; window.__atmos.set(legacy); E.settlePost(); E._refRender.call(E, g.time); E.renderer.getContext().readPixels(0, 0, 1, 1, 6408, 5121, new Uint8Array(4)); }, c === 'legacy');
  const c0 = gpuCpu(), w0 = Date.now();
  await p.evaluate(n => { const g = window.__game, E = g.engine, gl = E.renderer.getContext(); for (let i = 0; i < n; i++) { E._refRender.call(E, g.time); gl.readPixels(0, 0, 1, 1, 6408, 5121, new Uint8Array(4)); } }, +frames);
  out[c].push((gpuCpu() - c0) / +frames * 1000); wall[c].push((Date.now() - w0) / +frames);
}
if (shots) {
  fs.mkdirSync(shots, { recursive: true });
  for (const c of cfgs) {
    const png = await p.evaluate(legacy => { const g = window.__game, E = g.engine; window.__atmos.set(legacy); E.settlePost(); E._refRender.call(E, g.time); return E.renderer.domElement.toDataURL('image/png'); }, c === 'legacy');
    fs.writeFileSync(path.join(shots, `${viewName}_${gfx}${mobile ? '_mobile' : ''}_${c}.png`), Buffer.from(png.split(',')[1], 'base64'));
  }
}
const st = v => { const s = v.slice().sort((x, z) => x - z); return { med: +s[s.length >> 1].toFixed(0), min: +s[0].toFixed(0), max: +s[s.length - 1].toFixed(0) }; };
const res = { view: viewName, gfx, size: `${W}x${H}`, mobile, load: fs.readFileSync('/proc/loadavg', 'utf8').split(' ').slice(0, 3).join(' '), info, gpu: {}, wall: {} };
for (const c of cfgs) { res.gpu[c] = st(out[c]); res.wall[c] = st(wall[c]); }
console.log(JSON.stringify(res));
await b.close();
