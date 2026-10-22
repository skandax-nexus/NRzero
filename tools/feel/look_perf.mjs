// Character look (docs/CHARACTER_LOOK.md): frame cost of the look shading (src/human/skin.js) against the classic
// shading, A/B in the same page and the same frame: every person's materials are swapped with face.useLook(on/off)
// between timed frames (tools/render/refhelper.js REF.measure: min of 3 fenced full frames + 1 scene-pass frame).
//   node tools/feel/look_perf.mjs <m> <gfx> <W> <H> <out.json> [--mobile] [--reps=3] [--views=play,close,mid] [--query=k=v]
// Views: play = the gameplay camera behind Kai (4.2 m, fov 58), mid = Kai waist up (1.8 m, fov 34), close = Kai's face
// (0.85 m, fov 30: the worst case, the face fills the frame). Machine load makes absolute numbers noisy: compare the
// A/B pairs, which are interleaved.
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url';
const R = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
const flag = n => { const a = args.find(x => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };
const [m, gfx, W, H, out] = pos;
const mobile = !!flag('mobile'), reps = +(flag('reps') || 3), views = String(flag('views') || 'play,mid,close').split(',');
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
const ctx = await b.newContext({ viewport: { width: +W >> 2, height: +H >> 2 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
const t0 = Date.now();
await p.goto(`http://localhost:8765/index.html?m=${m}&dtcap=0.25&gfx=${gfx}&auto&look=new${flag('query') ? '&' + flag('query') : ''}`);
await p.waitForFunction('window.__game && __game.control', null, { timeout: 900000, polling: 1000 });
await p.setViewportSize({ width: +W, height: +H }); await p.waitForTimeout(1500);
await p.evaluate(fs.readFileSync(path.join(R, '../render/refhelper.js'), 'utf8'));
const prep = await p.evaluate(async () => {
  const SK = await import('/src/human/skin.js'); if (SK.look.idle) await SK.look.idle();
  const g = window.__game, persons = [];
  g.scene.traverse(o => { const f = o.userData?.character?.person?.face; if (f && f.useLook) persons.push(f); });
  window.LP = { persons, set(on) { for (const f of persons) f.useLook(on); } };
  return { persons: persons.length, stats: SK.look.stats, tier: g.engine.quality };
});
console.log('ready', ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(prep));
const res = { m, gfx, mobile, size: W + 'x' + H, prep, views: {} };
for (const vn of views) {
  const v = await p.evaluate(vn => {
    const g = window.__game, c = g.player.char, V = g.engine.camera.position.constructor;
    c.root.updateMatrixWorld(true);
    const head = c.head.getWorldPosition(new V()), hips = c.hips.getWorldPosition(new V()), yaw = c.root.rotation.y;
    const fw = new V(Math.sin(yaw), 0, Math.cos(yaw));
    let t, d, fov, side = 1;
    if (vn === 'close') { t = head.clone().add(new V(0, 0.09, 0)); d = 0.85; fov = 30; }
    else if (vn === 'mid') { t = head.clone().lerp(hips, 0.5); d = 1.8; fov = 34; }
    else { t = head.clone().add(new V(0, 0.2, 0)); d = -4.2; fov = 58; side = 0; }
    const pp = t.clone().addScaledVector(fw, d).add(new V(fw.z * 0.4 * side, side ? 0 : 0.9, -fw.x * 0.4 * side));
    return { name: vn, p: [pp.x, pp.y, pp.z], l: [t.x, t.y, t.z], fov, frames: 3 };
  }, vn);
  await p.evaluate(v => window.REF.view(v), v);
  const A = [], B = [];
  for (let r = 0; r < reps; r++) {
    for (const on of (r % 2 ? [false, true] : [true, false])) {
      await p.evaluate(on => window.LP.set(on), on);
      const x = await p.evaluate(n => window.REF.measure(n, 3), vn + (on ? ':look' : ':classic'));
      (on ? A : B).push({ frame: x.frameMinMs, scene: x.sceneMinMs, calls: x.calls, tris: x.tris, programs: x.programs, heap: x.jsHeapMB });
    }
  }
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  res.views[vn] = { look: { frame: med(A.map(a => a.frame)), scene: med(A.map(a => a.scene)), calls: A[0].calls, tris: A[0].tris }, classic: { frame: med(B.map(a => a.frame)), scene: med(B.map(a => a.scene)), calls: B[0].calls, tris: B[0].tris }, raw: { look: A, classic: B } };
  console.log(vn, JSON.stringify({ look: res.views[vn].look, classic: res.views[vn].classic }));
  const url2 = await p.evaluate(() => window.REF.grab());
  fs.writeFileSync(out.replace(/\.json$/, '') + '_' + vn + '.png', Buffer.from(url2.split(',')[1], 'base64'));
}
fs.writeFileSync(out, JSON.stringify(res, null, 1));
await b.close();
console.log('total', ((Date.now() - t0) / 1000).toFixed(0) + 's');
