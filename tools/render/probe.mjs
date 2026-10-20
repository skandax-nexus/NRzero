// Load one mission like refviews.mjs does and evaluate JavaScript in the page (diagnostics: draw-call composition,
// batching / facade statistics, timings). See docs/RENDERING.md.
//   node tools/render/probe.mjs <mission m1..m4> <gfx> [W=1280] [H=720] [--mobile] [--view=<name>] [--query=k=v] [--base=url]
//        --eval=<js expression> | --file=<file with a js expression>   (repeatable; each result printed as JSON)
// The expression runs after the reference helper is installed (window.REF) and, with --view, after REF.view().
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const flags = n => args.filter(x => x.startsWith('--' + n + '=')).map(x => x.slice(n.length + 3));
const flag = n => flags(n)[0] ?? (args.includes('--' + n) ? true : null);
const VIEWS = JSON.parse(fs.readFileSync(path.join(here, 'views.json'), 'utf8'));
const [mission, gfx = 'high', W = '1280', H = '720'] = pos;
const M = VIEWS[mission]; if (!M) { console.error('unknown mission', mission); process.exit(2); }
const mobile = !!flag('mobile'), base = flag('base') || 'http://localhost:8765/';
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
const ctx = await b.newContext({ viewport: { width: Math.round(+W / 4), height: Math.round(+H / 4) }, screen: { width: +W, height: +H }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage();
p.on('console', m => { if (['error', 'warning'].includes(m.type()) && !m.text().includes('GPU stall')) console.log(m.type() + ':', m.text().slice(0, 300)); });
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
const t0 = Date.now(), log = s => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);
await p.goto(`${base}index.html?m=${M.m}&dtcap=0.25&gfx=${gfx}&auto${flag('query') ? '&' + flag('query') : ''}`);
await p.waitForFunction(M.ready, null, { timeout: 900000, polling: 1000 }); log('ready');
await p.setViewportSize({ width: +W, height: +H }); await p.waitForTimeout(1500);
await p.evaluate(fs.readFileSync(path.join(here, 'refhelper.js'), 'utf8'));
const v = flag('view') && M.views.find(x => x.name === flag('view'));
if (v) log(await p.evaluate(`REF.view(${JSON.stringify(v)})`));
for (const e of [...flags('eval'), ...flags('file').map(f => fs.readFileSync(f, 'utf8'))]) {
  try { log(JSON.stringify(await p.evaluate(e))); } catch (err) { log('ERROR ' + err.message); }
}
await b.close();
