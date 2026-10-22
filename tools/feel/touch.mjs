// Touch-feel probe for the audit (docs/MOTION.md): phone landscape (default 844x390, isMobile + hasTouch), mission 1.
// Drives the real touch controls with CDP touch events and reads back what Input / Player made of them:
// stick dead zone, the walk-speed curve against thumb travel, the sprint threshold, camera drag per pixel,
// and the layout of the JUMP / CROUCH / interact buttons. Writes <out>/touch.json and screenshots.
//   node tools/feel/touch.mjs --out=<dir> [--size=844x390] [--m=0] [--query=phys=classic]
/* global window, document */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path';
const args = process.argv.slice(2);
const flag = n => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const out = flag('out'); fs.mkdirSync(out, { recursive: true });
const [W, H] = (flag('size') || '844x390').split('x').map(Number);
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto(`http://localhost:8765/index.html?m=${flag('m') || 0}&gfx=low&dtcap=0.25&auto&touch=1${flag('query') ? '&' + flag('query') : ''}`);
await p.waitForFunction(() => window.__game && window.__game.control && !window.__game.ui.dlgActive, null, { timeout: 600000, polling: 1000 });
await p.waitForTimeout(1500);
const cdp = await ctx.newCDPSession(p);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id: id ?? 0, radiusX: 8, radiusY: 8, force: 1 })) });
const R = { size: [W, H] };
await p.screenshot({ path: path.join(out, 'touch_hud.png') });
R.layout = await p.evaluate(() => {
  const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { cx: Math.round(b.x + b.width / 2), cy: Math.round(b.y + b.height / 2), w: Math.round(b.width), h: Math.round(b.height), visible: b.width > 0 && getComputedStyle(e).opacity !== '0' }; };
  return { jump: r('.tc-jump'), crouch: r('.tc-crouch'), interact: r('.tc-interact'), stickIdle: r('.tc-base'), stickR: window.__game.touch.stickR, enabled: window.__game.touch.enabled };
});
// stick: put a thumb down at the bottom-left and push it forward in steps, sampling Input.stick and Kai's speed
const ox = 150, oy = H - 110;
await touch('touchStart', [[ox, oy]]);
R.stick = [];
for (const d of [3, 6, 8, 10, 15, 20, 30, 40, 50, 53, 54, 56, 59, 70, 95]) {
  await touch('touchMove', [[ox, oy - d]]);
  await p.waitForTimeout(700);
  R.stick.push(await p.evaluate(px => { const g = window.__game, s = g.input.stick, pl = g.player; return { px, mag: +s.mag.toFixed(3), sprint: pl.sprinting, speed: +Math.hypot(pl.vel.x, pl.vel.z).toFixed(2), sprintRing: document.querySelector('.tc-stick')?.classList.contains('sprint') }; }, d));
}
await touch('touchEnd', []);
await p.waitForTimeout(800);
// camera drag: a right-thumb drag of 100 px to the right and 60 px down
const yaw0 = await p.evaluate(() => [window.__game.player.camYaw, window.__game.player.camPitch]);
await touch('touchStart', [[W * 0.7, H * 0.4, 1]]);
for (let i = 1; i <= 10; i++) { await touch('touchMove', [[W * 0.7 + i * 10, H * 0.4 + i * 6, 1]]); await p.waitForTimeout(60); }
await touch('touchEnd', []);
await p.waitForTimeout(400);
const yaw1 = await p.evaluate(() => [window.__game.player.camYaw, window.__game.player.camPitch]);
R.look = { yawDegPer100px: +((yaw0[0] - yaw1[0]) * 180 / Math.PI).toFixed(1), pitchDegPer60px: +((yaw1[1] - yaw0[1]) * 180 / Math.PI).toFixed(1), deg180Px: Math.round(180 / ((yaw0[0] - yaw1[0]) * 180 / Math.PI) * 100) };
// jump: tap the button, see whether Kai leaves the ground
const j = R.layout.jump;
if (j) {
  // every simulated frame is sampled in the page (frames are slow under SwiftShader, so polling from here misses the apex)
  const y0 = await p.evaluate(() => { const g = window.__game; window.__jt = { y0: g.player.pos.y, top: g.player.pos.y }; window.__jtOff = g.onUpdate(() => { window.__jt.top = Math.max(window.__jt.top, g.player.pos.y); }); return g.player.pos.y; });
  await touch('touchStart', [[j.cx, j.cy, 2]]); await p.waitForTimeout(120); await touch('touchEnd', []);
  await p.waitForTimeout(2500);
  const top = await p.evaluate(() => { window.__jtOff?.(); return window.__jt.top; });
  R.jumpTap = { rose: +(top - y0).toFixed(2) };
}
await p.screenshot({ path: path.join(out, 'touch_after.png') });
fs.writeFileSync(path.join(out, 'touch.json'), JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
await b.close();
