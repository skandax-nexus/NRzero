// Trailer director: renders one shot of tools/trailer/shots/*.json frame by frame from the real game, in headless
// Chromium (SwiftShader), on virtual time. Built on the approach of tools/render/record.mjs (docs/RENDERING.md §12.2);
// usage and the shot fields are documented in docs/TRAILER.md, "Director".
//
//   node tools/trailer/director.mjs <shot id | spec.json | spec.json#id> [--preview] [--from=f] [--to=f]
//        [--still=f1,f2,..] [--size=WxH] [--force] [--quiet]
//
//   final     every missing frame of the shot -> <OUT>/frames/<id>/%05d.jpg (JPEG q95, trailer.json width x height)
//   --preview every 4th frame at 640x360       -> <OUT>/preview/<id>/%05d.jpg + <OUT>/preview/<id>.mp4 + _sheet.jpg
//   --still   only the listed frames (full size) -> <OUT>/stills/<id>/%05d.jpg (always re-rendered)
//   --from / --to limit the frame range; --force deletes the shot's frames in that output first.
//
// How it works: page.js (injected before the game's modules) makes the game loop inert and seeds Math.random;
// Playwright's fake clock runs every timer, requestAnimationFrame callback and performance.now() on virtual time.
// The director then advances the world itself: one game step of exactly 1/fps per frame (game.step), one virtual-clock
// advance of the same length (mission scripts, dialogue, fades), the shot camera, and engine.render() — with the
// composer ("drawn") or without it ("dry": every CPU-side update, nothing drawn). Frames already on disk are simulated
// dry, so a restart continues where it stopped and the same spec renders the same frames.
/* global window */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import url from 'url'; import crypto from 'crypto'; import { execFileSync } from 'child_process';

export const VERSION = 1;
const R = path.dirname(url.fileURLToPath(import.meta.url));
export const ROOT = path.resolve(R, '../..');
export const OUT = process.env.TRAILER_OUT || '/tmp/claude-0/-home-user-NRzero/bd5ae5bd-ae4a-555b-ac14-7c4895688d29/scratchpad/trailer';
const BASE = process.env.TRAILER_BASE || 'http://localhost:8765/';
export const SHOTS_DIR = path.join(R, 'shots');

// ---------- spec helpers (shared with farm.mjs) ----------
export function trailerConfig() {
  let t = {};
  try { t = JSON.parse(fs.readFileSync(path.join(R, 'trailer.json'), 'utf8')); } catch { /* not written yet */ }
  return { fps: t.fps || 24, width: t.width || 1280, height: t.height || 720 };
}
export function shotFiles() { return fs.existsSync(SHOTS_DIR) ? fs.readdirSync(SHOTS_DIR).filter(f => f.endsWith('.json')).sort().map(f => path.join(SHOTS_DIR, f)) : []; }
export function readShots(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (Array.isArray(j) ? j : j.shots ? j.shots : [j]).map(s => ({ ...s, _file: file }));
}
export function findShot(target) {
  const [file, hashId] = target.split('#');
  if (file.endsWith('.json') && fs.existsSync(file)) {
    const list = readShots(path.resolve(file));
    const s = hashId ? list.find(x => x.id === hashId) : list.length === 1 ? list[0] : null;
    if (!s) throw new Error(hashId ? `no shot ${hashId} in ${file}` : `${file} holds ${list.length} shots: name one as ${file}#<id>`);
    return s;
  }
  for (const f of shotFiles()) { const s = readShots(f).find(x => x.id === target); if (s) return s; }
  throw new Error('shot not found: ' + target);
}
// everything that changes the pixels (not notes / beat / approved)
export function shotHash(s, W, H, fps) {
  const keys = ['url', 'ready', 'readyDt', 'setup', 'setupDt', 'frames', 'camera', 'actions', 'grade', 'exposure', 'ss', 'blur', 'extras', 'seed'];
  const o = { V: VERSION, W, H, fps }; for (const k of keys) o[k] = s[k] ?? null;
  return crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 12);
}
export const frameName = f => String(f).padStart(5, '0') + '.jpg';
export function framesDone(dir, n) { let c = 0; for (let f = 0; f < n; f++) if (fs.existsSync(path.join(dir, frameName(f)))) c++; return c; }

// ---------- main ----------
async function main() {
  const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
  const flag = n => { const a = args.find(x => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };
  if (!pos[0]) { console.log('usage: node tools/trailer/director.mjs <shot id | spec.json[#id]> [--preview] [--from=f] [--to=f] [--still=f1,f2] [--size=WxH] [--force]'); process.exit(2); }
  const shot = findShot(pos[0]);
  const cfg = trailerConfig(), fps = cfg.fps, dt = 1 / fps;
  const preview = !!flag('preview'), stills = flag('still') ? String(flag('still')).split(',').map(Number).filter(n => n >= 0) : null;
  let W = cfg.width, H = cfg.height;
  if (flag('size')) [W, H] = String(flag('size')).split('x').map(Number);
  if (preview) { W = 640; H = 360; }
  const mode = preview ? 'preview' : stills ? 'stills' : 'final';
  const N = shot.frames | 0; if (!(N > 0)) throw new Error('shot.frames must be > 0');
  const ss = preview ? 1 : Math.max(1, +shot.ss || 1);
  const bl = typeof shot.blur === 'number' ? { samples: shot.blur } : shot.blur || {};
  const samples = preview ? 1 : Math.max(1, bl.samples | 0 || 1), shutter = Math.min(1, Math.max(0.05, bl.shutter ?? 0.5));
  const nSub = samples > 1 ? Math.max(samples, Math.round(samples / shutter)) : 1, subDt = dt / nSub;
  const exposure = shot.exposure ?? 'lock';
  const seed = shot.seed ?? 20490314;
  const hash = shotHash(shot, W, H, fps);
  const dir = path.join(OUT, mode === 'final' ? 'frames' : mode, shot.id);
  fs.mkdirSync(dir, { recursive: true });
  const log = (...a) => { if (!flag('quiet') || a[0] === '!') console.log(`[${shot.id}]`, ...a); };

  // one director per shot and output
  const lock = path.join(dir, '.lock');
  if (fs.existsSync(lock)) {
    const pid = +fs.readFileSync(lock, 'utf8');
    let alive = false; try { process.kill(pid, 0); alive = pid !== process.pid; } catch { /* dead */ }
    if (alive) { console.log(`[${shot.id}] busy: director pid ${pid} renders this shot`); process.exit(5); }
  }
  fs.writeFileSync(lock, String(process.pid));
  const unlock = () => { try { if (+fs.readFileSync(lock, 'utf8') === process.pid) fs.unlinkSync(lock); } catch { /* gone */ } };
  process.on('exit', unlock);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { unlock(); process.exit(130); });

  // a changed spec makes the frames on disk stale
  const metaF = path.join(dir, 'meta.json');
  let meta = null; try { meta = JSON.parse(fs.readFileSync(metaF, 'utf8')); } catch { /* none */ }
  const wipe = () => { for (const f of fs.readdirSync(dir)) if (/^\d{5}\.jpg(\.tmp)?$/.test(f)) fs.unlinkSync(path.join(dir, f)); };
  if (flag('force') || (meta && meta.hash !== hash && mode !== 'stills')) { log(meta && meta.hash !== hash ? `spec changed (${meta.hash} -> ${hash}): old frames removed` : 'forced: frames removed'); wipe(); }
  meta = { id: shot.id, hash, version: VERSION, mode, fps, width: W, height: H, frames: N, ss, samples, shutter, exposure, seed, file: path.relative(ROOT, shot._file), mission: shot.mission, updated: new Date().toISOString() };
  fs.writeFileSync(metaF, JSON.stringify(meta, null, 1));

  // which frames to produce
  const from = Math.max(0, +(flag('from') ?? 0)), to = Math.min(N - 1, +(flag('to') ?? N - 1));
  let wanted = [];
  if (stills) wanted = stills.filter(f => f < N);
  else for (let f = from; f <= to; f++) if ((mode !== 'preview' || f % 4 === 0) && !fs.existsSync(path.join(dir, frameName(f)))) wanted.push(f);
  const progF = path.join(dir, 'progress.json');
  const writeProg = o => { try { fs.writeFileSync(progF + '.tmp', JSON.stringify({ id: shot.id, mode, total: N, hash, pid: process.pid, updated: Date.now(), ...o })); fs.renameSync(progF + '.tmp', progF); } catch { /* best effort */ } };
  if (!wanted.length) { log(`${mode}: nothing to render (${N} frames present)`); writeProg({ done: mode === 'final' ? framesDone(dir, N) : N, phase: 'complete' }); finish(); return; }
  const want = new Set(wanted), last = Math.max(...wanted);
  const draw = new Set(wanted); draw.add(0);                       // frame 0 snaps eye adaptation / grade / focus
  if (exposure === 'adapt') { const first = Math.min(...wanted); for (let f = Math.max(0, first - 24); f < first; f++) draw.add(f); }
  log(`${mode} ${W}x${H}${ss > 1 ? ' ss' + ss : ''}${samples > 1 ? ` blur ${samples}/${nSub}` : ''}: ${wanted.length} of ${N} frames to render (frames ${Math.min(...wanted)}..${last}), hash ${hash}`);

  // ---------- browser ----------
  const t0 = Date.now();
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio', '--disable-audio-output'] });
  const cleanup = async () => { try { await browser.close(); } catch { /* closed */ } };
  process.on('SIGTERM', () => { cleanup().finally(() => { unlock(); process.exit(143); }); });
  const ctx = await browser.newContext({ viewport: { width: Math.round(W * ss), height: Math.round(H * ss) }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => { errors.push(e.message); log('! PAGEERROR', e.message); });
  p.on('console', m => { if (m.type() === 'error') log('console.error', m.text().slice(0, 200)); });
  let inflight = 0;
  p.on('request', () => inflight++); p.on('requestfinished', () => inflight--); p.on('requestfailed', () => inflight--);
  await p.addInitScript(`window.__TR_SEED = ${seed >>> 0};`);
  await p.addInitScript({ path: path.join(R, 'page.js') });
  // the fake clock is paused: time only moves when the director advances it (runFor)
  const T0 = new Date('2049-03-14T21:00:00Z').getTime();
  await p.clock.install({ time: T0 });
  await p.clock.pauseAt(T0 + 1000);
  let u = shot.url.replace(/^\/+/, '');
  for (const [k, v] of [['dtcap', '0.25'], ['adaptive', '0'], ['auto', '']]) if (!new RegExp('[?&]' + k + '(=|&|$)').test(u)) u += (u.includes('?') ? '&' : '?') + k + (v ? '=' + v : '');
  await p.goto(BASE + u);

  // virtual time: integer milliseconds handed to the fake clock, the remainder carried
  let vt = 0;
  const advance = async ms => { const a = Math.round(vt + ms) - Math.round(vt); vt += ms; if (a > 0) await p.clock.runFor(a); };
  const prof = { step: 0, clock: 0, dry: 0, full: 0, nDry: 0, nFull: 0 };
  const tick = async (step, fr) => {
    let a = Date.now();
    await p.evaluate(s => window.TR.tick(s), step);
    let b = Date.now(); prof.step += b - a; a = b;
    await advance(step * 1000);
    b = Date.now(); prof.clock += b - a; a = b;
    const r = await p.evaluate(o => window.TR.frame(o), fr || { t: 0, dt: step, draw: 'dry' });
    if (fr?.draw === 'full') { prof.full += Date.now() - a; prof.nFull++; } else { prof.dry += Date.now() - a; prof.nDry++; }
    return r;
  };
  const idle = async () => { const s = Date.now(); while (inflight > 0 && Date.now() - s < 20000) await new Promise(r => setTimeout(r, 25)); };

  // ---------- ready ----------
  const ready = shot.ready || 'window.__game && __game.control';
  const readyDt = shot.readyDt ?? 0.1, readyMax = shot.readyTimeout ?? 900;
  let gt = 0;
  writeProg({ done: framesDone(dir, N), phase: 'loading' });
  for (;;) {
    const ok = await p.evaluate(`(() => { try { return !!(${ready}); } catch { return false; } })()`);
    if (ok) break;
    await idle();
    const started = await tick(readyDt).then(() => p.evaluate(() => window.TR.started));
    if (started) gt += readyDt;
    if (gt > readyMax || Date.now() - t0 > 1800e3) { log('! ready timeout:', ready); await cleanup(); process.exit(3); }
  }
  const begin = await p.evaluate(o => window.TR.begin(o), { seed: seed >>> 0, grade: shot.grade });
  if (shot.extras) log('extras', JSON.stringify(await p.evaluate(x => window.TR.extras(x), shot.extras)));
  log(`ready after ${gt.toFixed(1)} s game time, ${((Date.now() - t0) / 1000).toFixed(0)} s wall`, JSON.stringify(begin));

  // ---------- setup ----------
  writeProg({ done: framesDone(dir, N), phase: 'setup' });
  const setupDt = shot.setupDt ?? 0.1;
  const runInput = async a => {
    if (a.down) await p.keyboard.down(a.down);
    if (a.up) await p.keyboard.up(a.up);
    if (a.press) await p.keyboard.press(a.press);
    if (a.eval) { try { const r = await p.evaluate(a.eval); if (r !== undefined && r !== null && !flag('quiet')) log('eval:', JSON.stringify(r).slice(0, 160)); } catch (e) { log('! evalerr', e.message.split('\n')[0], '|', a.eval.slice(0, 120)); errors.push(e.message); } }
  };
  for (const s of shot.setup || []) {
    await runInput(s);
    const sd = s.dt ?? setupDt;
    if (s.wait) for (let w = 0; w < s.wait - 1e-9; w += sd) await tick(sd);
    if (s.until) {
      let w = 0; const max = s.timeout ?? 120;
      while (!(await p.evaluate(`(() => { try { return !!(${s.until}); } catch { return false; } })()`))) {
        if (w > max) { log('! setup until timeout after', max, 's:', s.until.slice(0, 120)); await cleanup(); process.exit(3); }
        await tick(sd); w += sd;
      }
      log(`until met after ${w.toFixed(1)} s`);
    }
  }
  if (shot.grade) await p.evaluate(g => window.__game.engine.setGrade(g, { instant: true }), shot.grade);
  await p.evaluate(c => window.TR.setCamera(c), shot.camera || { mode: 'game' });

  // ---------- frames ----------
  writeProg({ done: framesDone(dir, N), phase: 'render' });
  const actions = (shot.actions || []).slice().sort((a, b) => a.t - b.t);
  let ai = 0, drawn = 0, wrote = 0, ema = 0, sum = 0, nSum = 0;
  const capture = ss > 1 || samples > 1 ? 'acc' : 'jpeg';
  const firstSampled = nSub - samples;
  for (let f = 0; f <= last; f++) {
    while (ai < actions.length && actions[ai].t <= f * dt + 1e-6) await runInput(actions[ai++]);
    const isDraw = draw.has(f), tf = Date.now();
    let data = null;
    for (let k = 0; k < nSub; k++) {
      const sampled = k >= firstSampled, full = isDraw && sampled;
      const o = { t: f * dt - (nSub - 1 - k) * subDt, dt: subDt, draw: full ? 'full' : 'dry', capture, first: k === firstSampled, last: k === nSub - 1, w: W, h: H, quality: 0.95,
        settle: f === 0 && k === firstSampled, lockAfter: f === 0 && k === firstSampled && exposure === 'lock' };
      const r = await tick(subDt, o);
      if (full && k === nSub - 1) data = r;
    }
    if (isDraw) {
      drawn++;
      if (want.has(f) && typeof data === 'string') {
        const out = path.join(dir, frameName(f));
        fs.writeFileSync(out + '.tmp', Buffer.from(data.split(',')[1], 'base64')); fs.renameSync(out + '.tmp', out);
        wrote++;
        const sec = (Date.now() - tf) / 1000; ema = ema ? ema * 0.8 + sec * 0.2 : sec; if (f > 0) { sum += sec; nSum++; }
        const done = mode === 'final' ? framesDone(dir, N) : wrote;
        writeProg({ done, phase: 'render', frame: f, secPerFrame: +ema.toFixed(2), wall: Math.round((Date.now() - t0) / 1000) });
        if (wrote === 1 || wrote % 10 === 0 || f === last) log(`frame ${f} (${wrote}/${wanted.length})  ${sec.toFixed(2)} s/frame, avg ${ema.toFixed(2)}`);
      }
    }
  }
  const stats = await p.evaluate(() => ({ ...window.TR.stats(), errors: window.TR.errors }));
  await cleanup();
  const doneN = mode === 'final' ? framesDone(dir, N) : wrote;
  writeProg({ done: doneN, phase: mode === 'final' && doneN === N ? 'complete' : 'partial', secPerFrame: +ema.toFixed(2), wall: Math.round((Date.now() - t0) / 1000) });
  const ms = (v, n) => Math.round(v / Math.max(1, n));
  log('profile ms/tick:', JSON.stringify({ step: ms(prof.step, prof.nDry + prof.nFull), clock: ms(prof.clock, prof.nDry + prof.nFull), dry: ms(prof.dry, prof.nDry), full: ms(prof.full, prof.nFull), ticks: prof.nDry + prof.nFull }));
  log(JSON.stringify({ mode, wrote, drawn, frames: N, wall: Math.round((Date.now() - t0) / 1000), secPerFrame: +ema.toFixed(2), meanSec: nSum ? +(sum / nSum).toFixed(2) : null, size: `${W}x${H}`, ...stats, pageErrors: errors.length }));
  finish();

  function finish() {
    if (mode !== 'preview') return;
    // review aids: the preview as a clip at its real pace (every 4th frame at fps / 4) and a contact sheet
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps / 4), '-pattern_type', 'glob', '-i', path.join(dir, '*.jpg'), '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(fps), path.join(OUT, 'preview', shot.id + '.mp4')]);
      const n = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).length, cols = 6, rows = Math.ceil(n / cols);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', path.join(dir, '*.jpg'), '-vf', `scale=320:180,tile=${cols}x${rows}:padding=4:margin=4`, '-frames:v', '1', '-q:v', '3', path.join(OUT, 'preview', shot.id + '_sheet.jpg')]);
      log('preview:', path.join(OUT, 'preview', shot.id + '.mp4'), path.join(OUT, 'preview', shot.id + '_sheet.jpg'));
    } catch (e) { log('! preview encode failed', e.message.split('\n')[0]); }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  main().catch(e => { console.log('! director failed:', e.stack || e.message); process.exit(4); });
}
