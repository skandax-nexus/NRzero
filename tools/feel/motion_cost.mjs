// CPU cost of the people's animation in a mission (docs/MOTION.md, "Locomotion & secondary motion"): loads mission m,
// holds the game loop and steps it N frames at a fixed dt without rendering (Kai walking a slow circle), timing every
// Character.update (Kai and everyone else) and, under the new motion, locomotion.js's own share (MOTION.stats).
//   node tools/feel/motion_cost.mjs --m=<index> [--gfx=low] [--frames=120] [--query=motion=classic]
/* global window, performance */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const args = process.argv.slice(2);
const flag = n => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const m = flag('m') || '0', gfx = flag('gfx') || 'low', frames = +(flag('frames') || 120), q = flag('query');
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto(`http://localhost:8765/index.html?m=${m}&gfx=${gfx}&dtcap=0.25&auto${q ? '&' + q : ''}`);
await p.waitForFunction(() => window.__game && window.__game.control && window.__game.scene, null, { timeout: 600000, polling: 1000 });
const r = await p.evaluate(async (N) => {
  const g = window.__game, E = g.engine, inp = g.input;
  const L = await import('/src/human/locomotion.js');
  const draw = E.render; E.render = () => {}; g.paused = true;
  draw.call(E, g.time);         // one render so the camera and LOD are set
  await new Promise(res => setTimeout(res, 300));
  // time every Character.update
  const C = g.player.char.constructor, up = C.prototype.update;
  let tKai = 0, tOther = 0, nOther = 0;
  C.prototype.update = function (dt) { const t = performance.now(); const v = up.call(this, dt); const d = performance.now() - t; if (this === g.player.char) tKai += d; else { tOther += d; nOther++; } return v; };
  const T = { kai: [], others: [], step: [], motion: [] }, people = new Set(), seen = new Set();
  const mu = L.Motion.prototype.update; L.Motion.prototype.update = function (dt) { seen.add(this); return mu.call(this, dt); };
  inp.down.add('KeyW');
  for (let i = 0; i < N; i++) {
    g.player.camYaw += 0.02;
    tKai = tOther = 0; nOther = 0; const ms0 = L.MOTION.stats.ms;
    const t0 = performance.now(); g.step(1 / 30); const t1 = performance.now();
    if (g.scene.onBeforeRender) g.scene.onBeforeRender(E.renderer, g.scene, E.camera, null);
    inp.endFrame();
    if (i >= 10) { T.kai.push(tKai); T.others.push(tOther); T.step.push(t1 - t0); T.motion.push(L.MOTION.stats.ms - ms0); people.add(nOther); }
  }
  inp.down.delete('KeyW');
  C.prototype.update = up; E.render = draw; g.paused = false;
  const st = a => { const s = a.slice().sort((x, y) => x - y); return { med: +s[s.length >> 1].toFixed(3), p90: +s[Math.floor(s.length * 0.9)].toFixed(3), mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) }; };
  L.Motion.prototype.update = mu;
  const lods = {}; for (const M of seen) { const k = M.hero ? 'kai' : 'lod' + M.lod + (M.springs ? '+spring' : ''); lods[k] = (lods[k] || 0) + 1; }
  return { quality: E.quality, othersUpdated: [...people].join('/'), lods, kai: st(T.kai), others: st(T.others), motion: st(T.motion), step: st(T.step) };
}, frames);
console.log(JSON.stringify({ m, gfx, query: q || 'default', ...r }));
await b.close();
