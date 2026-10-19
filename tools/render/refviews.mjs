// Capture the rendering reference views (tools/render/views.json) for one mission and one quality tier,
// with per-view frame cost and renderer counts. See docs/RENDERING.md, "Reference views".
//
//   node tools/render/refviews.mjs <mission m1..m4> <gfx high|medium|low> <out dir> [W=1280] [H=720] [--mobile]
//        [--base=http://localhost:8765/] [--views=name,name] [--noshot] [--ready-timeout=ms] [--emit-steps=dir]
//
// Loading runs at quarter size (SwiftShader is fill-rate bound, so the mission intro plays much faster), then the
// viewport is set to WxH before any view is taken. Writes <out>/<view>.png and <out>/<mission>_<gfx>[_mobile].json.
// --emit-steps=dir writes equivalent tools/drive.mjs steps files (refviews_<mission>.json) and exits; those load at
// full size and need generous timeouts, but produce the same frames.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const flag = n => { const a = args.find(x => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };
const VIEWS = JSON.parse(fs.readFileSync(path.join(here, 'views.json'), 'utf8'));
const HELPER = fs.readFileSync(path.join(here, 'refhelper.js'), 'utf8');

if (flag('emit-steps')) {
  const dir = flag('emit-steps'); fs.mkdirSync(dir, { recursive: true });
  for (const [id, M] of Object.entries(VIEWS)) {
    if (id.startsWith('_')) continue;
    const steps = [{ until: M.ready, timeout: 900000 }, { wait: 1500 }, { eval: HELPER }];
    for (const v of M.views) steps.push({ eval: `REF.view(${JSON.stringify(v)})` }, { eval: `REF.measure(${JSON.stringify(v.name)})` }, { shot: v.name + '.png' });
    steps.push({ eval: 'JSON.stringify(window.REF_LOG)' });
    fs.writeFileSync(path.join(dir, `refviews_${id}.json`), JSON.stringify(steps, null, 1));
    console.log('wrote', path.join(dir, `refviews_${id}.json`), `(?m=${M.m})`);
  }
  process.exit(0);
}

const [mission, gfx = 'high', out = '.', W = '1280', H = '720'] = pos;
const M = VIEWS[mission]; if (!M) { console.error('unknown mission', mission); process.exit(2); }
const mobile = !!flag('mobile'), base = flag('base') || 'http://localhost:8765/';
const only = flag('views') ? String(flag('views')).split(',') : null;
fs.mkdirSync(out, { recursive: true });
const w = +W, h = +H;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: Math.round(w / 4), height: Math.round(h / 4) }, screen: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage();
const seen = new Set();
p.on('console', m => { const t = m.type() + ': ' + m.text(); if (['error', 'warning'].includes(m.type()) && !seen.has(t) && !t.includes('GPU stall')) { seen.add(t); console.log(t); } });
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
p.on('crash', () => { console.log('RENDERER CRASHED (out of memory?)'); process.exit(3); });
const t0 = Date.now(), log = s => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);
await p.goto(`${base}index.html?m=${M.m}&dtcap=0.25&gfx=${gfx}&auto`);
try { await p.waitForFunction(M.ready, null, { timeout: +(flag('ready-timeout') || 900000), polling: 1000 }); log('ready'); }
catch { log('TIMEOUT waiting for ' + M.ready); await b.close(); process.exit(4); }
await p.setViewportSize({ width: w, height: h });
await p.waitForTimeout(1500);
log(await p.evaluate(HELPER));
// Results merge into the per-mission JSON after every view, so an interrupted run can resume with --resume
// (skips views already recorded there).
const file = path.join(out, `${mission}_${gfx}${mobile ? '_mobile' : ''}.json`);
let results = flag('resume') && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
for (const v of M.views) {
  if (only && !only.includes(v.name)) continue;
  if (flag('resume') && results.some(r => r.view === v.name)) continue;
  log(await p.evaluate(`REF.view(${JSON.stringify(v)})`));
  const r = await p.evaluate(`REF.measure(${JSON.stringify(v.name)})`);
  log(JSON.stringify(r));
  if (!flag('noshot')) {
    const data = await p.evaluate('REF.grab()');
    fs.writeFileSync(path.join(out, v.name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
  }
  results = results.filter(x => x.view !== v.name).concat([r]);
  fs.writeFileSync(file, JSON.stringify(results, null, 1));
}
log('saved ' + file);
await b.close();
