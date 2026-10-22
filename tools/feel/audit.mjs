// Walking-style and physics audit driver (docs/MOTION.md). Loads the game's title screen in headless Chromium
// (SwiftShader), installs tools/feel/feelhelper.js, builds the feel course and runs the scenarios of
// tools/feel/scenarios.mjs at a fixed dt. Each scenario writes <out>/<name>.json (per-frame samples) and, when the
// scenario asks for renders, <out>/<name>/<view>_<frame>.jpg. Analyse with tools/feel/analyze.mjs, make contact sheets
// with tools/feel/sheet.py and clips with ffmpeg.
//   node tools/feel/audit.mjs --out=<dir> [--only=a,b] [--skip=a,b] [--gfx=low] [--size=640x360] [--norender]
//        [--query=phys=classic]   (extra URL params, e.g. to A/B a switch later)
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url';
import { scenarios } from './scenarios.mjs';
const R = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = n => { const a = args.find(x => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };
const out = flag('out'); if (!out) { console.log('usage: node tools/feel/audit.mjs --out=<dir> [--only=a,b]'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const [W, H] = (flag('size') || '640x360').split('x').map(Number);
const only = flag('only') ? flag('only').split(',') : null, skip = flag('skip') ? flag('skip').split(',') : [];
const list = scenarios().filter(s => (!only || only.includes(s.name)) && !skip.includes(s.name));
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 200)); });
const t0 = Date.now();
await p.goto(`http://localhost:8765/index.html?gfx=${flag('gfx') || 'low'}&dtcap=0.25&auto${flag('query') ? '&' + flag('query') : ''}`);
await p.waitForFunction(() => window.__game && window.__game.player.char.person && document.getElementById('loading')?.classList.contains('done'), null, { timeout: 600000, polling: 1000 });
console.log('loaded in', Math.round((Date.now() - t0) / 1000), 's');
await p.evaluate(fs.readFileSync(path.join(R, 'feelhelper.js'), 'utf8'));
console.log('setup', JSON.stringify(await p.evaluate(() => window.FEEL.setup())));
const rest = await p.evaluate(() => window.FEEL.restFoot());
fs.writeFileSync(path.join(out, '_rest.json'), JSON.stringify(rest));
for (const sc of list) {
  const t1 = Date.now();
  if (flag('norender')) delete sc.render;
  const r = await p.evaluate(s => window.FEEL.run(s), sc).catch(e => ({ error: e.message }));
  if (r.error) { console.log(sc.name, 'ERROR', r.error); continue; }
  if (r.renders.length) {
    const d = path.join(out, sc.name); fs.mkdirSync(d, { recursive: true });
    for (const fr of r.renders) for (const v of Object.keys(fr)) if (v !== 'f') fs.writeFileSync(path.join(d, `${v}_${String(fr.f).padStart(4, '0')}.jpg`), Buffer.from(fr[v].split(',')[1], 'base64'));
  }
  const nR = r.renders.length; delete r.renders;
  fs.writeFileSync(path.join(out, sc.name + '.json'), JSON.stringify({ ...r, meta: sc.meta || {}, place: sc.place }));
  console.log(`${sc.name}: ${r.samples.length} frames, ${nR} renders, step ${r.stepMs} ms, ${Math.round((Date.now() - t1) / 1000)} s`);
}
await b.close();
