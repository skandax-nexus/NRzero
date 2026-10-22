// Storyboard previews for the AFTERZERO trailer: runs shots from tools/trailer/shots/gN.json exactly as the recorder
// will (same URL, ready check, setup, actions, camera, grade; tools/trailer/director.js), but draws only a few frames
// at a small size, and writes one strip per shot (cut-in | middle | cut-out) for review.
//   node tools/trailer/preview.mjs <g1..g6 | all | path/to/group.json> [--shots=s01,s07] [--w=640] [--h=295]
//        [--gfx=high] [--at=in,mid,out | keys | 0,12,40 (frame numbers)] [--out=dir] [--base=http://localhost:8765/]
//        [--resume] (skip shots whose strip exists)  [--log] (print setup progress)
// Frame numbers count from 0 at the first recorded frame (the head handle); the cut-in frame is `handles`.
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url'; import { execFileSync } from 'child_process';
const R = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
const flag = n => { const a = args.find(x => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };
const W = +(flag('w') || 640), H = +(flag('h') || 296), base = flag('base') || 'http://localhost:8765/';
const out = flag('out') || '/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/trailer/storyboard/previews';
fs.mkdirSync(out, { recursive: true });
const groups = !pos[0] || pos[0] === 'all' ? ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'] : pos;
const want = flag('shots') ? new Set(String(flag('shots')).split(',')) : null;
const shots = [];
for (const gname of groups) {
  const f = gname.endsWith('.json') ? gname : path.join(R, 'shots', gname + '.json');
  for (const s of JSON.parse(fs.readFileSync(f, 'utf8')).shots) if (!want || want.has(s.id)) shots.push(s);
}
const DIRJS = fs.readFileSync(path.join(R, 'director.js'), 'utf8');
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
const report = [];
for (const shot of shots) {
  const strip = path.join(out, shot.id + '.jpg');
  if (flag('resume') && fs.existsSync(strip)) continue;
  const t0 = Date.now(), log = [];
  const ctx = await b.newContext({ viewport: { width: Math.max(160, W >> 1), height: Math.max(90, H >> 1) }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', e => log.push('PAGEERROR ' + e.message));
  try {
    let u = shot.url; if (flag('gfx')) u = u.replace(/gfx=[a-z]+/, 'gfx=' + flag('gfx'));
    await p.goto(base + u);
    await p.waitForFunction(shot.ready || 'window.__game && __game.control', null, { timeout: 900000, polling: 500 });
    await p.setViewportSize({ width: W, height: H }); await p.waitForTimeout(800);
    await p.evaluate(DIRJS);
    for (const s of shot.setup || []) {
      if (s.eval) { const r = await p.evaluate(s.eval).catch(e => 'evalerr ' + e.message); if (r !== undefined && flag('log')) log.push('eval ' + JSON.stringify(r).slice(0, 120)); if (String(r).startsWith('evalerr')) log.push(r); }
      if (s.down) await p.keyboard.down(s.down);
      if (s.up) await p.keyboard.up(s.up);
      if (s.press) { await p.keyboard.down(s.press); await p.evaluate('DIR.sim(1/30)'); await p.keyboard.up(s.press); }
      if (s.wait) await p.evaluate(`DIR.sim(${+s.wait}, 1 / 30, ${s.pace ?? 'DIR.pace'})`);
      if (s.until) { const ok = await p.evaluate(`DIR.until(${JSON.stringify(s.until)}, ${+(s.timeout || 60)}, 1 / 30, ${s.pace ?? 'DIR.pace'})`); if (!ok) log.push('UNTIL-TIMEOUT ' + s.until.slice(0, 100)); }
    }
    const fps = shot.fps || 24, n = shot.frames, hd = shot.handles ?? 12;
    await p.evaluate(sh => window.DIR.begin(sh), shot);
    let at = flag('at') || 'in,mid,out';
    let frames;
    if (at === 'keys') frames = (shot.camera?.keys || []).map(k => Math.round(k.t * fps));
    else frames = at.split(',').map(x => x === 'in' ? hd : x === 'out' ? n - 1 - hd : x === 'mid' ? Math.round(n / 2) : +x);
    frames = [...new Set(frames.map(f => Math.max(0, Math.min(n - 1, f))))].sort((a, c) => a - c);
    const acts = (shot.actions || []).slice().sort((a, c) => a.t - c.t); let ai = 0;
    const imgs = [];
    for (let f = 0; f <= frames[frames.length - 1]; f++) {
      const t = f / fps;
      while (ai < acts.length && acts[ai].t <= t + 1e-6) {
        const a = acts[ai++];
        if (a.down) await p.keyboard.down(a.down);
        if (a.up) await p.keyboard.up(a.up);
        if (a.press) await p.keyboard.press(a.press);
        if (a.eval) { const r = await p.evaluate(a.eval).catch(e => 'evalerr ' + e.message); if (String(r).startsWith('evalerr')) log.push('action ' + r); }
      }
      const jpg = await p.evaluate(([i, d]) => window.DIR.frame(i, d), [f, frames.includes(f)]);
      if (!jpg) await p.waitForTimeout(18);   // let requestAnimationFrame run between frames: mission scripts await on it
      if (jpg) { const fp = path.join(out, `${shot.id}_${String(f).padStart(4, '0')}.jpg`); fs.writeFileSync(fp, Buffer.from(jpg.split(',')[1], 'base64')); imgs.push(fp); }
    }
    const info = await p.evaluate(() => { const g = window.__game, E = g.engine; return { canvas: E.renderer.domElement.width + 'x' + E.renderer.domElement.height, era: g.temporal.current, calls: E.stats.calls, tris: E.stats.triangles, grade: E.grade, kai: g.player.pos.toArray().map(v => +v.toFixed(2)) }; });
    if (imgs.length > 1) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...imgs.flatMap(i => ['-i', i]), '-filter_complex', imgs.map((_, k) => `[${k}]scale=${W & ~1}:${H & ~1}[v${k}]`).join(';') + ';' + imgs.map((_, k) => `[v${k}]`).join('') + `hstack=inputs=${imgs.length}`, strip]);
    else if (imgs.length) fs.copyFileSync(imgs[0], strip);
    report.push({ id: shot.id, ok: true, sec: Math.round((Date.now() - t0) / 1000), frames, ...info, log });
  } catch (e) { report.push({ id: shot.id, ok: false, err: e.message.split('\n')[0], log }); }
  console.log(JSON.stringify(report[report.length - 1]));
  await ctx.close();
}
await b.close();
fs.writeFileSync(path.join(out, 'report_' + Date.now() + '.json'), JSON.stringify(report, null, 1));
