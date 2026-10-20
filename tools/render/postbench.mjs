// Per-pass cost of the post-processing chain on one reference view, with several tier / feature configurations
// measured interleaved in the same page (so host-load drift on the shared SwiftShader container hits every
// configuration alike). See docs/RENDERING.md, "Post-processing".
//
//   node tools/render/postbench.mjs <mission m1..m4> <view name> <out.json> [W=1280] [H=720] [--mobile] [--rounds=4]
//        [--configs=high,high:legacy,medium,medium:legacy,low,low:legacy] [--base=http://localhost:8765/]
//
// A configuration is <tier>[:legacy|:<comma-free list of post switches joined by +>]. `legacy` = the pre-upgrade
// chain on that tier (no AO / AA / DOF / eye adaptation / grade). Each pass is timed with a readPixels fence after it;
// the result is the minimum over the rounds per pass, plus the minimum whole frame.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const flag = n => { const a = args.find(x => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };
const VIEWS = JSON.parse(fs.readFileSync(path.join(here, 'views.json'), 'utf8'));
const HELPER = fs.readFileSync(path.join(here, 'refhelper.js'), 'utf8');
const [mission, viewName, out, W = '1280', H = '720'] = pos;
const M = VIEWS[mission]; const view = M?.views.find(v => v.name === viewName);
if (!view) { console.error('unknown mission / view'); process.exit(2); }
const mobile = !!flag('mobile'), base = flag('base') || 'http://localhost:8765/', rounds = +(flag('rounds') || 4);
const configs = String(flag('configs') || (mobile ? 'medium,medium:legacy,low,low:legacy' : 'high,high:legacy,medium,medium:legacy')).split(',');
const w = +W, h = +H;
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
const ctx = await b.newContext({ viewport: { width: Math.round(w / 4), height: Math.round(h / 4) }, screen: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()); });
p.on('crash', () => { console.log('RENDERER CRASHED'); process.exit(3); });
const t0 = Date.now(), log = s => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);
await p.goto(`${base}index.html?m=${M.m}&dtcap=0.25&gfx=${configs[0].split(':')[0]}&auto`);
await p.waitForFunction(M.ready, null, { timeout: 900000, polling: 1000 }); log('ready');
await p.setViewportSize({ width: w, height: h });
await p.waitForTimeout(1500);
log(await p.evaluate(HELPER));
log(await p.evaluate(`REF.view(${JSON.stringify(view)})`));
const res = await p.evaluate(async ({ configs, rounds }) => {
  const g = window.__game, E = g.engine, r = E.renderer, gl = r.getContext(), px = new Uint8Array(4), draw = E._refRender;
  const yieldNow = () => new Promise(res => setTimeout(res, 30));
  const fence = () => { const rt = r.getRenderTarget(); r.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); r.setRenderTarget(rt); };
  const names = new Map([[E.renderPass, 'scene'], [E.aoPass, 'ao'], [E.exposurePass, 'eye'], [E.dofPass, 'dof'], [E.bloom, 'bloom'], [E.outputPass, 'output'], [E.cinema, 'cinema'], [E.smaa, 'smaa']]);
  let T = {};
  for (const [pass, name] of names) {
    const orig = pass.render;
    pass.render = function (...a) { const t = performance.now(); orig.apply(this, a); fence(); T[name] = (T[name] || 0) + performance.now() - t; };
  }
  const LEGACY = ['noao', 'noaa', 'nodof', 'noae', 'nograde'];
  const apply = c => {
    const [tier, mod] = c.split(':');
    if (E.quality !== tier) E.setQuality(tier);
    E.postOff = new Set(mod === 'legacy' ? LEGACY : mod ? mod.split('+') : []);
    E.applyPost(); E.settlePost();
  };
  const best = {};
  for (let k = 0; k < rounds; k++) {
    for (const c of configs) {
      apply(c);
      await yieldNow(); draw.call(E, g.time); fence();   // warm-up (program switches, render target allocation)
      await yieldNow(); T = {};
      const t = performance.now(); draw.call(E, g.time); fence(); const total = performance.now() - t;
      const B = best[c] || (best[c] = { total: Infinity, passes: {}, calls: 0, post: '' });
      B.total = Math.min(B.total, total); B.calls = E.stats.calls; B.post = E.stats.post; B.size = r.domElement.width + 'x' + r.domElement.height;
      for (const n in T) B.passes[n] = Math.min(B.passes[n] ?? Infinity, T[n]);
    }
  }
  for (const c in best) { const B = best[c]; B.total = +B.total.toFixed(1); for (const n in B.passes) B.passes[n] = +B.passes[n].toFixed(1); B.postMs = +Object.entries(B.passes).filter(([n]) => n !== 'scene').reduce((s, [, v]) => s + v, 0).toFixed(1); }
  return best;
}, { configs, rounds });
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ mission, view: viewName, size: `${w}x${h}`, mobile, results: res }, null, 1));
for (const [c, B] of Object.entries(res)) log(`${c.padEnd(16)} total ${B.total} ms  post ${B.postMs} ms  calls ${B.calls}  [${B.post}]  ${JSON.stringify(B.passes)}`);
await b.close();
