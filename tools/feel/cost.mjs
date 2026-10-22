// Frame cost probe for the physics & controls step (docs/MOTION.md). Loads a mission, waits for player control, holds
// the game loop and times N frames driven by hand at a fixed dt with Kai walking in a slow circle: the player update
// (physics + animation), the camera, the whole game step and the render, in ms per frame (median and p90).
//   node tools/feel/cost.mjs --m=<index> [--gfx=low] [--frames=120] [--query=phys=classic] [--size=844x390]
/* global window, performance */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const args = process.argv.slice(2);
const flag = n => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const m = flag('m') || '0', gfx = flag('gfx') || 'low', frames = +(flag('frames') || 120), q = flag('query');
const [W, H] = (flag('size') || '844x390').split('x').map(Number);
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto(`http://localhost:8765/index.html?m=${m}&gfx=${gfx}&dtcap=0.25&auto${q ? '&' + q : ''}`);
await p.waitForFunction(() => window.__game && window.__game.control && window.__game.scene, null, { timeout: 600000, polling: 1000 });
const r = await p.evaluate(async (N) => {
  const g = window.__game, E = g.engine, pl = g.player, inp = g.input;
  const draw = E.render; E.render = () => {}; g.paused = true;
  await new Promise(res => setTimeout(res, 300));
  const T = { player: [], camera: [], step: [], render: [] };
  const up = pl.update.bind(pl), cam = pl.updateCamera.bind(pl);
  let tp = 0, tc = 0;
  pl.update = (dt, a) => { const t = performance.now(); const v = up(dt, a); tp = performance.now() - t; return v; };
  pl.updateCamera = (dt, c) => { const t = performance.now(); const v = cam(dt, c); tc = performance.now() - t; return v; };
  inp.down.add('KeyW');
  for (let i = 0; i < N; i++) {
    pl.camYaw += 0.02;
    const t0 = performance.now(); g.step(1 / 30); const t1 = performance.now();
    draw.call(E, g.time); const t2 = performance.now();
    inp.endFrame();
    if (i >= 10) { T.player.push(tp); T.camera.push(tc); T.step.push(t1 - t0); T.render.push(t2 - t1); }
  }
  inp.down.delete('KeyW');
  pl.update = up; pl.updateCamera = cam; E.render = draw; g.paused = false;
  const st = a => { const s = a.slice().sort((x, y) => x - y); return { med: +s[s.length >> 1].toFixed(3), p90: +s[Math.floor(s.length * 0.9)].toFixed(3) }; };
  return { boxes: g.collision.boxes.length, quality: E.quality, player: st(T.player), camera: st(T.camera), step: st(T.step), render: st(T.render) };
}, frames);
console.log(JSON.stringify({ m, gfx, query: q || 'new', ...r }));
await b.close();
