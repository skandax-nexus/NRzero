// Same-frame A/B captures of one reference view with arbitrary page-side switches (docs/RENDERING.md, "Fixes after
// review 1"). Every cfg is a JavaScript snippet evaluated in the game page before the view is re-posed and drawn
// (E = engine, g = game, KIT / RZ are not imported: use E / g); the frame of each cfg is saved as
// <out>/<view>_<cfg>.png and the mean sRGB value of optional regions is printed (x0,y0,x1,y1 as 0..1 fractions).
//   node tools/render/abshots.mjs <m1..m4> <view> <gfx> W H [--mobile] <out> name='js' [name2='js'] ...
//        [--regions=floor:0.3,0.8,0.7,1;wall:0.6,0.3,0.9,0.6] [--query=k=v]
//   e.g. node tools/render/abshots.mjs m2 m2b_interior_people low 844 390 --mobile /tmp/ab \
//          f0='E.scene.userData.envFloor=0;E._light.sig=""' f2='E.scene.userData.envFloor=0.2;E._light.sig=""'
// A cfg that changes the scene probe should clear E._light.sig (the helper settles lighting, which re-captures it).
/* global window, document, Image */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url';
const R = path.dirname(url.fileURLToPath(import.meta.url));
const a = process.argv.slice(2); const mobile = a.includes('--mobile');
const opt = k => (a.find(x => x.startsWith('--' + k + '=')) || '').slice(k.length + 3);
const base = opt('base') || 'http://localhost:8765/', query = opt('query');
const regions = (opt('regions') || '').split(';').filter(Boolean).map(s => { const [n, v] = s.split(':'); return [n, v.split(',').map(Number)]; });
const pos = a.filter(x => !x.startsWith('--'));
const [mission, viewName, gfx, W, H, out, ...cfgArgs] = pos;
const cfgs = cfgArgs.map(c => { const i = c.indexOf('='); return [c.slice(0, i), c.slice(i + 1)]; });
fs.mkdirSync(out, { recursive: true });
const VIEWS = JSON.parse(fs.readFileSync(path.join(R, 'views.json'), 'utf8')); const M = VIEWS[mission]; const view = M.views.find(v => v.name === viewName);
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
const ctx = await b.newContext({ viewport: { width: +W >> 2, height: +H >> 2 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
await p.goto(`${base}index.html?m=${M.m}&dtcap=0.25&gfx=${gfx}&auto${query ? '&' + query : ''}`);
await p.waitForFunction(M.ready, null, { timeout: 900000, polling: 1000 });
await p.setViewportSize({ width: +W, height: +H }); await p.waitForTimeout(1500);
await p.evaluate(fs.readFileSync(path.join(R, 'refhelper.js'), 'utf8'));
await p.evaluate(`REF.view(${JSON.stringify(view)})`);
const res = {};
for (const [name, js] of cfgs) {
  await p.evaluate(src => { const g = window.__game, E = g.engine; (new Function('g', 'E', src))(g, E); }, js);   // eslint-disable-line no-new-func
  await p.evaluate(`REF.view(${JSON.stringify(view)})`);
  const d = await p.evaluate('REF.grab()');
  fs.writeFileSync(path.join(out, `${viewName}_${name}.png`), Buffer.from(d.split(',')[1], 'base64'));
  const st = await p.evaluate(async ([src, regs]) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const o = {};
    for (const [n, [x0, y0, x1, y1]] of regs) {
      const px = x.getImageData(Math.round(x0 * c.width), Math.round(y0 * c.height), Math.max(1, Math.round((x1 - x0) * c.width)), Math.max(1, Math.round((y1 - y0) * c.height))).data;
      let r = 0, gg = 0, bb = 0; const k = px.length / 4;
      for (let i = 0; i < px.length; i += 4) { r += px[i]; gg += px[i + 1]; bb += px[i + 2]; }
      r /= k; gg /= k; bb /= k;
      const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb); let h = 0;
      if (mx > mn) { h = mx === r ? ((gg - bb) / (mx - mn) + 6) % 6 : mx === gg ? (bb - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4; h *= 60; }
      o[n] = { rgb: [r, gg, bb].map(v => +v.toFixed(1)), luma: +(0.2126 * r + 0.7152 * gg + 0.0722 * bb).toFixed(1), hue: +h.toFixed(0), sat: +(mx ? (mx - mn) / mx : 0).toFixed(2) };
    }
    const E = window.__game.engine;
    return { regions: o, calls: E.stats.calls, tris: E.stats.triangles, probeLum: E.stats.probeLum, probeScale: E.stats.probeScale, roomLum: E.stats.roomLum };
  }, [d, regions]);
  res[name] = st; console.log(name, JSON.stringify(st));
}
fs.writeFileSync(path.join(out, `${viewName}_${gfx}${mobile ? '_mobile' : ''}.json`), JSON.stringify(res, null, 1));
await b.close();
