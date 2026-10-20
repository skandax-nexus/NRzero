// Capture tools/render/infra-lab.html (or any page that sets window.LAB_DONE and window.LAB_GRAB()) in new-headless
// Chromium with SwiftShader. See docs/RENDERING.md stage 4.
//   node tools/render/labshot.mjs "<url>" out.png [W=1280] [H=720] [--mobile] [--timeout=ms]
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
const [url, out, W = '1280', H = '720'] = pos, mobile = args.includes('--mobile');
const to = +((args.find(a => a.startsWith('--timeout=')) || '--timeout=600000').split('=')[1]);
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage();
p.on('console', m => { if (['error', 'warning'].includes(m.type()) && !m.text().includes('GPU stall')) console.log(m.type() + ':', m.text().slice(0, 300)); });
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
const t0 = Date.now();
await p.goto(url, { waitUntil: 'commit', timeout: to });
await p.waitForFunction('window.LAB_DONE', null, { timeout: to, polling: 500 });
const data = await p.evaluate('window.LAB_GRAB()');
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
console.log(JSON.stringify({ ...(await p.evaluate('window.LAB_INFO')), sec: Math.round((Date.now() - t0) / 1000) }));
await b.close();
