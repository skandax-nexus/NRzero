// Cost of scene-lighting switches on one reference view, as CPU time of the browser's GPU process per frame
// (the SwiftShader rasterizer's own work), measured A/B/A/B in one page. Wall-clock frame times on the shared
// container swing by 30 % with the host load; the GPU process's CPU time is far less sensitive to it.
// See docs/RENDERING.md, stage 2 "Cost".
//   node tools/render/cpuab.mjs <mission m1..m4> <view> <gfx> W H [--mobile] <reps> <frames> <cfg>...
//   cfg = '+'-joined engine ?light= switches ('-' = all on), optionally '@<tier>' to switch tier first, e.g.
//   node tools/render/cpuab.mjs m1 m1b_street_people low 844 390 --mobile 6 2 - noenv+nofog+nowet+nocontact+norig+noshadow+noshafts
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url';
const R = path.dirname(url.fileURLToPath(import.meta.url));
const a = process.argv.slice(2); const mobile = a.includes('--mobile'); const pos = a.filter(x => !x.startsWith('--'));
const [mission, viewName, gfx, W, H, reps, frames, ...cfgs] = pos;
const VIEWS = JSON.parse(fs.readFileSync(path.join(R, 'views.json'), 'utf8')); const M = VIEWS[mission]; const view = M.views.find(v => v.name === viewName);
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
const ctx = await b.newContext({ viewport: { width: +W >> 2, height: +H >> 2 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto(`http://localhost:8765/index.html?m=${M.m}&dtcap=0.25&gfx=${gfx}&auto`);
await p.waitForFunction(M.ready, null, { timeout: 900000, polling: 1000 });
const ppidOf = d => { try { const t = fs.readFileSync(`/proc/${d}/stat`, 'utf8'); return +t.slice(t.lastIndexOf(')') + 2).split(' ')[1]; } catch { return -1; } };
const all = fs.readdirSync('/proc').filter(d => /^\d+$/.test(d)).map(d => { try { return { pid: +d, ppid: ppidOf(d), cmd: fs.readFileSync(`/proc/${d}/cmdline`, 'utf8') }; } catch { return null; } }).filter(Boolean);
const mainP = all.find(x => x.ppid === process.pid && x.cmd.includes('user-data-dir'));
const udd = mainP && mainP.cmd.split('\0').find(x => x.startsWith('--user-data-dir='));
const mine = all.filter(x => udd && x.cmd.includes('gpu-process') && x.cmd.includes(udd)).map(x => x.pid); if (mine.length !== 1) console.log('gpu pids', mine, udd, all.filter(x => x.ppid === process.pid).map(x => x.cmd.slice(0, 80)));
const GPU = mine[mine.length - 1];
await p.setViewportSize({ width: +W, height: +H }); await p.waitForTimeout(1500);
await p.evaluate(fs.readFileSync(path.join(R, 'refhelper.js'), 'utf8'));
await p.evaluate(`REF.view(${JSON.stringify(view)})`);
const tck = 100;
const gpuCpu = () => { const s = fs.readFileSync(`/proc/${GPU}/stat`, 'utf8'); const f = s.slice(s.lastIndexOf(')') + 2).split(' '); return (+f[11] + +f[12]) / tck; };
const out = {}; for (const c of cfgs) out[c] = [];
for (let k = 0; k < +reps; k++) for (const c of cfgs) {
  const [sw, tier] = c.split('@');
  await p.evaluate(({ sw, tier }) => { const g = window.__game, E = g.engine; if (tier && E.quality !== tier) E.setQuality(tier); E.lightOff = new Set(sw === '-' ? [] : sw.split('+')); E.applyLighting(); E.applyPost?.(); E.settlePost(); E._refRender.call(E, g.time); E.renderer.getContext().readPixels(0, 0, 1, 1, 6408, 5121, new Uint8Array(4)); }, { sw, tier });
  const c0 = gpuCpu();
  await p.evaluate(n => { const g = window.__game, E = g.engine, gl = E.renderer.getContext(); for (let i = 0; i < n; i++) { E._refRender.call(E, g.time); gl.readPixels(0, 0, 1, 1, 6408, 5121, new Uint8Array(4)); } }, +frames);
  out[c].push((gpuCpu() - c0) / +frames * 1000);
}
const st = v => { const s = v.slice().sort((x, z) => x - z); return { med: +s[s.length >> 1].toFixed(0), min: +s[0].toFixed(0), max: +s[s.length - 1].toFixed(0) }; };
const res = {}; for (const c in out) res[c] = st(out[c]);
console.log(JSON.stringify({ mission, viewName, gfx, size: W + 'x' + H, frames: +frames, reps: +reps, gpuCpuMsPerFrame: res }));
await b.close();
