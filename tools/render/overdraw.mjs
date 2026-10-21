// node tools/render/overdraw.mjs <mission> <view> <gfx> W H [--mobile] : fragments shaded per pixel in the engine's real draw order
// (depth test on, depth writes on: what early-z lets through), for the whole scene and for facade materials only
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path';
const R = '/home/user/NRzero/tools/render';
const a = process.argv.slice(2); const mobile = a.includes('--mobile'); const pos = a.filter(x => !x.startsWith('--'));
const [mission, viewName, gfx, W, H] = pos;
const VIEWS = JSON.parse(fs.readFileSync(path.join(R, 'views.json'), 'utf8')); const M = VIEWS[mission]; const view = M.views.find(v => v.name === viewName);
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: +W >> 2, height: +H >> 2 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto(`http://localhost:8765/index.html?m=${M.m}&dtcap=0.25&gfx=${gfx}&auto`);
await p.waitForFunction(M.ready, null, { timeout: 900000, polling: 1000 });
await p.setViewportSize({ width: +W, height: +H }); await p.waitForTimeout(1500);
await p.evaluate(fs.readFileSync(path.join(R, 'refhelper.js'), 'utf8'));
await p.evaluate(`REF.view(${JSON.stringify(view)})`);
const res = await p.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, E = g.engine, r = E.renderer, S = g.scene, cam = E.camera;
  E._refRender.call(E, g.time);
  const w = r.domElement.width, h = r.domElement.height;
  const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
  const om = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1 / 255, 1 / 255, 1 / 255, THREE.LinearSRGBColorSpace), blending: THREE.AdditiveBlending, depthTest: true, depthWrite: true, fog: false, toneMapped: false });
  const run = (facOnly) => {
    const hidden = [];
    S.traverse(o => { if ((o.isPoints || o.isLine || o.isSprite) && o.visible) { o.visible = false; hidden.push(o); }
      if (facOnly && (o.isMesh) && o.visible) { const ms = [].concat(o.material || []); if (!ms.some(m => m.userData && m.userData.facade)) { o.visible = false; hidden.push(o); } } });
    const bg = S.background, fog = S.fog; S.background = null; S.overrideMaterial = om;
    const oc = new THREE.Color(); r.getClearColor(oc); const oa = r.getClearAlpha(); r.setClearColor(0x000000, 1);
    r.setRenderTarget(rt); r.clear(); r.render(S, cam); r.setRenderTarget(null);
    S.overrideMaterial = null; S.background = bg; S.fog = fog; r.setClearColor(oc, oa);
    for (const o of hidden) o.visible = true;
    const px = new Uint8Array(w * h * 4); r.readRenderTargetPixels(rt, 0, 0, w, h, px);
    let sum = 0, cov = 0, hist = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < px.length; i += 4) { const v = px[i]; sum += v; if (v) cov++; hist[Math.min(5, v)]++; }
    return { fragPerPixel: +(sum / (w * h)).toFixed(3), fragPerCovered: +(sum / Math.max(1, cov)).toFixed(3), coverage: +(cov / (w * h)).toFixed(3), hist: hist.map(x => +(x / (w * h)).toFixed(3)) };
  };
  const all = run(false), fac = run(true);
  // the same with a depth pre-pass (fragments a perfect front-to-back order would shade): colorWrite off first
  return { w, h, all, fac };
});
console.log(JSON.stringify(res));
await b.close();
