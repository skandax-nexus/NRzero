// Scripted playthrough driver. Steps JSON: [{wait},{shot},{key},{down},{up},{eval},{until,timeout},{tap:[x,y]}]
// node tools/drive.mjs "<url>" steps.json [width] [height] [--mobile] [--outdir=dir]
// Use URL params ?m=<missionIndex>&dtcap=0.25&gfx=low&auto for fast automated runs.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path';
const args = process.argv.slice(2);
const [url, stepsFile, w = '960', h = '540'] = args.filter(a => !a.startsWith('--'));
const mobile = args.includes('--mobile');
const outdir = (args.find(a => a.startsWith('--outdir=')) || '--outdir=.').split('=')[1];
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const seen = new Set();
p.on('console', m => { const t = m.type() + ': ' + m.text(); if (!seen.has(t) && !t.includes('GPU stall')) { seen.add(t); console.log(t); } });
p.on('pageerror', e => console.log('PAGEERROR:', e.message, (e.stack || '').split('\n').slice(0, 3).join(' | ')));
await p.goto(url);
for (const s of steps) {
  if (s.wait) await p.waitForTimeout(s.wait);
  if (s.shot) await p.screenshot({ path: path.join(outdir, s.shot), timeout: 180000 }).catch(() => console.log('shotfail', s.shot));
  if (s.key) await p.keyboard.press(s.key);
  if (s.down) await p.keyboard.down(s.down);
  if (s.up) await p.keyboard.up(s.up);
  if (s.tap) await p.touchscreen.tap(s.tap[0], s.tap[1]);
  if (s.eval) { try { const r = await p.evaluate(s.eval); if (r !== undefined) console.log('eval:', JSON.stringify(r)); } catch (e) { console.log('evalerr', e.message); } }
  if (s.until) { const t0 = Date.now(); let ok = false; while (Date.now() - t0 < (s.timeout || 30000)) { if (await p.evaluate(s.until).catch(() => false)) { ok = true; break; } await p.waitForTimeout(250); } if (!ok) console.log('UNTIL-TIMEOUT:', s.until.slice(0, 90)); }
}
await b.close();
