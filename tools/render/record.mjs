// Offline "render farm" for gameplay clips: plays a mission in headless Chromium (SwiftShader) with scripted input,
// steps the game at a fixed frame rate (every frame is simulated exactly 1/fps, however slow the CPU renderer is),
// grabs each frame from the canvas and encodes an H.264 video with ffmpeg. The result is the frame-perfect clip
// a player's device would show at that fps, independent of the container's speed. See docs/RENDERING.md section 12.
//   node tools/render/record.mjs <mission m1..m4> <gfx high|medium|low> <out.mp4> [W=1280] [H=720] [--mobile]
//        [--seconds=6] [--fps=30] [--actions=actions.json] [--view=<views.json view name>] [--frames=dir] [--crf=18]
//        [--query=k=v&k2=v2]
//   actions.json: [{ "t": 0, "down": "KeyW" }, { "t": 2.5, "up": "KeyW" }, { "t": 1, "press": "KeyE" },
//                  { "t": 0, "eval": "__game.player.place(0, 0, 10, 0)" }]   (t in seconds of game time)
//   --view holds that reference camera (tools/render/views.json) for the whole clip; otherwise the game camera follows.
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url'; import os from 'os'; import { execFileSync } from 'child_process';
const R = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2); const pos = args.filter(a => !a.startsWith('--'));
const flag = n => { const a = args.find(x => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };
const [mission, gfx, out, W = '1280', H = '720'] = pos;
if (!mission || !gfx || !out) { console.log('usage: node tools/render/record.mjs <m1..m4> <gfx> <out.mp4> [W] [H] [--mobile] [--seconds=6] [--fps=30] [--actions=f.json] [--view=name]'); process.exit(1); }
const mobile = !!flag('mobile'), fps = +(flag('fps') || 30), secs = +(flag('seconds') || 6), n = Math.round(fps * secs);
const VIEWS = JSON.parse(fs.readFileSync(path.join(R, 'views.json'), 'utf8')); const M = VIEWS[mission];
const view = flag('view') ? M.views.find(v => v.name === flag('view')) : null;
const actions = flag('actions') ? JSON.parse(fs.readFileSync(flag('actions'), 'utf8')).sort((a, b) => a.t - b.t) : [];
const dir = flag('frames') || fs.mkdtempSync(path.join(os.tmpdir(), 'rzrec-')); fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
const ctx = await b.newContext({ viewport: { width: +W >> 2, height: +H >> 2 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto(`http://localhost:8765/index.html?m=${M.m}&dtcap=0.25&gfx=${gfx}&auto${flag('query') ? '&' + flag('query') : ''}`);
await p.waitForFunction(M.ready, null, { timeout: 900000, polling: 1000 });
await p.setViewportSize({ width: +W, height: +H }); await p.waitForTimeout(1500);
await p.evaluate(fs.readFileSync(path.join(R, 'refhelper.js'), 'utf8'));   // holds the frame loop: frames are drawn on request only
if (view) await p.evaluate(`REF.view(${JSON.stringify(view)})`);
else await p.evaluate(() => { window.REF.hide(); });
const t0 = Date.now(); let ai = 0;
for (let f = 0; f < n; f++) {
  const t = f / fps;
  while (ai < actions.length && actions[ai].t <= t + 1e-6) {
    const a = actions[ai++];
    if (a.down) await p.keyboard.down(a.down);
    if (a.up) await p.keyboard.up(a.up);
    if (a.press) await p.keyboard.press(a.press);
    if (a.eval) await p.evaluate(a.eval).catch(e => console.log('evalerr', e.message));
  }
  const jpg = await p.evaluate(({ dt, v }) => {
    const g = window.__game, E = g.engine;
    if (v) g.cine = { from: { p: E.camera.position.clone().set(...v.p), l: E.camera.position.clone().set(...v.l) }, to: { p: E.camera.position.clone().set(...v.p), l: E.camera.position.clone().set(...v.l) }, t: 0, dur: 0.001, look: E.camera.position.clone().set(...v.l), fov: v.fov || 58 };
    g.step(dt);
    if (v) window.REF.pose(v);
    E._refRender.call(E, g.time);
    return E.renderer.domElement.toDataURL('image/jpeg', 0.95);
  }, { dt: 1 / fps, v: view });
  fs.writeFileSync(path.join(dir, String(f).padStart(5, '0') + '.jpg'), Buffer.from(jpg.split(',')[1], 'base64'));
  if (f % 10 === 0) console.log(`frame ${f + 1}/${n}  ${((Date.now() - t0) / (f + 1) / 1000).toFixed(2)} s/frame`);
}
const stats = await p.evaluate(() => { const E = window.__game.engine; return { calls: E.stats.calls, tris: E.stats.triangles, post: E.stats.post, tier: E.quality }; });
await b.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, '%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(flag('crf') || 18), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
console.log(JSON.stringify({ out, frames: n, fps, size: `${W}x${H}`, gfx, mobile, wallSec: Math.round((Date.now() - t0) / 1000), framesDir: dir, ...stats }));
if (!flag('frames')) fs.rmSync(dir, { recursive: true, force: true });
