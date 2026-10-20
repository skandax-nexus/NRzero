// Capture one reference view under several post-processing variants in one page load (tuning aid, see
// docs/RENDERING.md "Post-processing"). Every variant is the same frame: the world is paused by refhelper.js.
//
//   node tools/render/postvariants.mjs <mission m1..m4> <view name> <out dir> <gfx> [W=1280] [H=720] [--mobile]
//        <variant>...   where variant = name:<post switches joined by +>[:<js run with E = engine, g = game>]
//   e.g. full:  legacy:noao+noaa+nodof+noae+nograde  aodebug:aodebug  strongao::E.aoPass.intensity=1.2
// Writes <out>/<view>.<name>.png. The js of a variant stays in effect for later variants.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const mobile = args.includes('--mobile');
const pos = args.filter(a => !a.startsWith('--'));
const [mission, viewName, out, gfx = 'high'] = pos;
let rest = pos.slice(4);
const W = /^\d+$/.test(rest[0]) ? +rest.shift() : 1280, H = /^\d+$/.test(rest[0]) ? +rest.shift() : 720;
const VIEWS = JSON.parse(fs.readFileSync(path.join(here, 'views.json'), 'utf8'));
const M = VIEWS[mission], view = M?.views.find(v => v.name === viewName);
if (!view || !rest.length) { console.error('usage: see header'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
const ctx = await b.newContext({ viewport: { width: Math.round(W / 4), height: Math.round(H / 4) }, screen: { width: W, height: H }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()); });
const t0 = Date.now(), log = s => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);
await p.goto(`http://localhost:8765/index.html?m=${M.m}&dtcap=0.25&gfx=${gfx}&auto`);
await p.waitForFunction(M.ready, null, { timeout: 900000, polling: 1000 }); log('ready');
await p.setViewportSize({ width: W, height: H }); await p.waitForTimeout(1500);
await p.evaluate(fs.readFileSync(path.join(here, 'refhelper.js'), 'utf8'));
log(await p.evaluate(`REF.view(${JSON.stringify(view)})`));
for (const v of rest) {
  const [name, offs = '', ...js] = v.split(':');
  const post = await p.evaluate(`(() => { const g = __game, E = g.engine; ${js.join(':')}; return REF.postOff(${JSON.stringify(offs ? offs.split('+') : [])}); })()`);
  const data = await p.evaluate('REF.grab()');
  fs.writeFileSync(path.join(out, `${viewName}.${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  log(`${name} [${post}]`);
}
await b.close();
