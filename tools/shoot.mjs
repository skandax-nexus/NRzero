// Screenshot helper for agents and judges (headless Chromium + SwiftShader).
// node tools/shoot.mjs "<url>" out.png [width=900] [height=900] [--mobile] [--wait=ms] [--until=<js expr>] [--channel=chromium-headless-shell]
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const args = process.argv.slice(2);
const [url, out, w = '900', h = '900'] = args.filter(a => !a.startsWith('--'));
const flag = n => { const a = args.find(x => x.startsWith('--' + n)); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };
const mobile = !!flag('mobile');
// channel 'chromium' (full build, new headless): the default headless shell leaks memory on long software-rendered frames
const b = await chromium.launch({ channel: flag('channel') || 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage();
p.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log('console.' + m.type() + ':', m.text()); });
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
await p.goto(url);
const until = flag('until') || 'window.LAB_DONE === true';
try { await p.waitForFunction(until, null, { timeout: +(flag('timeout') || 240000), polling: 500 }); } catch { console.log('timeout waiting for', until); }
if (flag('wait')) await p.waitForTimeout(+flag('wait'));
const info = await p.evaluate(() => window.LAB_INFO || null).catch(() => null);
if (info) console.log('LAB_INFO', JSON.stringify(info));
await p.screenshot({ path: out, timeout: 180000 });
await b.close();
console.log('saved', out);
