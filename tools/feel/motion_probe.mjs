// Prints what src/human/locomotion.js measured in the retargeted clips of some templates (gait cycles per loop, the
// left / right strike phases, stride, speed, arm swing) and the gait profile each person gets.
//   node tools/feel/motion_probe.mjs [ids=kai,witness,child] [--eval="js expression"]
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const args = process.argv.slice(2);
const ids = (args.find(a => !a.startsWith('--')) || 'kai').split(',');
const ev = (args.find(a => a.startsWith('--eval=')) || '').slice(7);
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 320, height: 200 } })).newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:8765/index.html?gfx=low&dtcap=0.25&auto&motion=new');
await p.waitForFunction(() => window.__game && window.__game.player.char.person, null, { timeout: 600000, polling: 500 });
const out = await p.evaluate(async ({ ids, ev }) => {
  const C = await import('/src/human/cast3d.js');
  const r = {};
  for (const id of ids) {
    const h = C.makePerson(id, { seed: 3 }); const M = h.motion; if (!M) { r[id] = 'no motion'; continue; }
    const cl = {};
    for (const [n, c] of Object.entries(M.info.clips)) cl[n] = { D: +c.D.toFixed(3), n: c.n, o: +c.o.toFixed(3), oR: +c.oR.toFixed(3), stand: +c.stand.toFixed(3), speed: +c.speed.toFixed(3), stride: +c.stride.toFixed(3), ampL: +c.ampL.toFixed(3), ampR: +c.ampR.toFixed(3), cL: Array.from(c.cL).map(x => Math.round(x * 9)).join(''), cR: Array.from(c.cR).map(x => Math.round(x * 9)).join('') };
    r[id] = { leg: M.info.leg, ank: M.info.ank, profile: M.P, clips: cl };
  }
  if (ev) r._eval = (0, eval)(ev);
  return r;
}, { ids, ev });
console.log(JSON.stringify(out, null, 1));
await b.close();
