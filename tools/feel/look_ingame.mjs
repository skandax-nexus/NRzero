// Character look audit (docs/CHARACTER_LOOK.md): in-game captures in a mission's own lighting. Each subject is spawned
// with game.actor (or is Kai, the player) at the scene's lit spot, facing the camera direction, and shot head and
// shoulders / waist up / full body with a held camera (tools/render/refhelper.js pauses the loop and draws on request;
// close shots get the engine's dialogue rig and depth of field exactly like game.shot()).
//   node tools/feel/look_ingame.mjs <tools/feel/look_scenes/mN.json> <gfx high|medium|low> <W> <H> <outdir> [--mobile]
//        [--only=a,b] [--shots=head,mid,full] [--measure] (A/B: draw calls / triangles / frame time with the person
//        shown and hidden; frame times are only meaningful on an idle machine) [--query=k=v]
// Writes <outdir>/<scene>_<subject>_<shot>.png and <outdir>/stats.jsonl (template, LOD, draws, triangles, textures).
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url';
const R = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
const flag = n => { const a = args.find(x => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };
const [sceneFile, gfx, W, H, out] = pos; fs.mkdirSync(out, { recursive: true });
const S = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
const mobile = !!flag('mobile');
const only = flag('only') ? String(flag('only')).split(',') : null;
const shots = (flag('shots') || 'head,mid,full').split(',');
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
const ctx = await b.newContext({ viewport: { width: +W >> 2, height: +H >> 2 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERROR', e.message));
const t0 = Date.now();
await p.goto(`http://localhost:8765/index.html?m=${S.m}&dtcap=0.25&gfx=${gfx}&auto${S.query ? '&' + S.query : ''}${flag('query') ? '&' + flag('query') : ''}`);
await p.waitForFunction(S.ready, null, { timeout: 900000, polling: 1000 });
await p.setViewportSize({ width: +W, height: +H }); await p.waitForTimeout(1500);
await p.evaluate(fs.readFileSync(path.join(R, '../render/refhelper.js'), 'utf8'));
console.log('ready', ((Date.now() - t0) / 1000).toFixed(0) + 's');
await p.evaluate(async (S) => {
  const { CAST } = await import('/src/story/cast.js');
  const g = window.__game, V = g.engine.camera.position.constructor;
  if (S.era && g.temporal.current !== S.era) g.temporal.setImmediate(S.era);
  for (const id of S.hide || []) if (g.actors[id]) g.actors[id].root.visible = false;
  const sp = S.spot, camDir = Math.atan2(sp.cam[0] - sp.x, sp.cam[1] - sp.z);
  window.CAP = {
    cur: null,
    spawn(sub) {
      if (this.cur && this.cur !== g.player.char) { g.scene.remove(this.cur.root); delete g.actors['cap']; }
      if (sub.player) {
        g.player.place(sp.x, sp.y, sp.z, camDir); g.player.char.root.visible = true; this.cur = g.player.char;
      } else {
        // the player steps out of the frame (behind the camera)
        g.player.place(sp.x + Math.sin(camDir) * 6, sp.y, sp.z + Math.cos(camDir) * 6, camDir); g.player.char.root.visible = false;
        const look = sub.look || { ...(CAST[sub.role]?.look || {}), role: sub.role };
        this.cur = g.actor('cap', { ...look, umbrella: null }, sp.x, sp.y, sp.z, camDir);
      }
      this.cur.lookTarget = null; this.cur.speed = 0;
      for (let i = 0; i < 12; i++) g.step(1 / 30);
      return this.cur.template || 'procedural';
    },
    view(kind) {
      const c = this.cur, B = c.person?.bones || {}, P = n => (B[n] || c.root).getWorldPosition(new V());
      c.root.updateMatrixWorld(true);
      const h = P('head'), hp = P('hips'), az = camDir + (S.az ?? 0.38);
      const stat = (c.person?.height || 1.75) * (c.scale3d || 1), ground = c.root.position.y;
      let t, d, fov;
      if (kind === 'head') { t = h.clone().add(new V(0, 0.09, 0)); d = 0.85; fov = 30; }
      else if (kind === 'mid') { t = h.clone().lerp(hp, 0.5); d = 1.8; fov = 34; }
      else { t = new V(hp.x, ground + stat * 0.52, hp.z); d = 3.6; fov = 36; }
      return { name: kind, p: [t.x + Math.sin(az) * d, t.y + (kind === 'full' ? 0.15 : 0), t.z + Math.cos(az) * d], l: [t.x, t.y, t.z], fov, frames: 3 };
    },
    stats() {   // what this one person costs: meshes, draw calls (visible meshes x material groups), triangles, textures
      const c = this.cur; let draws = 0, tris = 0; const tex = new Set();
      const vis = o => { for (; o && o !== c.root.parent; o = o.parent) if (!o.visible) return false; return true; };
      c.root.traverse(o => {
        if (!o.isMesh || !vis(o)) return;
        const gm = o.geometry, n = gm.index ? gm.index.count : gm.attributes.position.count;
        const groups = gm.groups.length || 1; draws += groups; tris += n / 3;
        for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap', 'emissiveMap', 'roughnessMap']) if (m[k]?.image) tex.add(k + ':' + m[k].image.width + 'x' + m[k].image.height);
      });
      const castS = g.engine.renderer.shadowMap.enabled;
      return { template: c.template, lod: c.person?.lod ?? null, draws, shadowDraws: castS ? draws : 0, tris: Math.round(tris), textures: [...tex] };
    },
  };
}, S);
const log = [];
for (const sub of S.subjects) {
  if (only && !only.includes(sub.name)) continue;
  const t1 = Date.now();
  const tpl = await p.evaluate(sub => window.CAP.spawn(sub), sub);
  for (const kind of shots) {
    const v = await p.evaluate(k => window.CAP.view(k), kind);
    await p.evaluate(v => window.REF.view(v), v);
    const url = await p.evaluate(() => window.REF.grab());
    fs.writeFileSync(path.join(out, `${S.name}_${sub.name}_${kind}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  const st = await p.evaluate(() => window.CAP.stats());
  let m = null;
  if (flag('measure')) {   // A/B: same mid view with the person shown and hidden
    const v = await p.evaluate(() => window.CAP.view('mid'));
    await p.evaluate(v => window.REF.view(v), v);
    const on = await p.evaluate(() => window.REF.measure('on', 3));
    await p.evaluate(() => { window.CAP.cur.root.visible = false; });
    const off = await p.evaluate(() => window.REF.measure('off', 3));
    await p.evaluate(() => { window.CAP.cur.root.visible = true; });
    m = { callsOn: on.calls, callsOff: off.calls, trisOn: on.tris, trisOff: off.tris, msOn: on.frameMinMs, msOff: off.frameMinMs, sceneMsOn: on.sceneMinMs, sceneMsOff: off.sceneMinMs, tier: on.tier };
  }
  const rec = { scene: S.name, gfx, mobile, subject: sub.name, tpl, ...st, measure: m, sec: Math.round((Date.now() - t1) / 1000) };
  log.push(rec); console.log(JSON.stringify(rec));
  fs.appendFileSync(path.join(out, 'stats.jsonl'), JSON.stringify(rec) + '\n');
}
await b.close();
console.log('total', ((Date.now() - t0) / 1000).toFixed(0) + 's');
