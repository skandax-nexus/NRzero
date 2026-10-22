// Trailer render farm: a background queue that renders every approved shot (tools/trailer/shots/*.json,
// "approved": true) whose final frames are incomplete, at most FARM_JOBS (default 2) directors at once under
// nice -n 10, picks up shots approved while it runs, encodes each finished shot to <OUT>/clips/<id>.mp4
// (x264 crf 12, yuv420p, trailer fps) and exits when nothing is left. See docs/TRAILER.md, "Render farm".
//
//   node tools/trailer/farm.mjs start     start in the background (nohup; a no-op while a farm runs)
//   node tools/trailer/farm.mjs status    per-shot progress and the estimated time left
//   node tools/trailer/farm.mjs stop      stop the farm and its renderers (frames on disk are kept; start resumes)
//   node tools/trailer/farm.mjs run       the queue itself in the foreground (what start launches)
//
// Lock: <OUT>/farm.lock (pid). Log: <OUT>/farm.log. State: <OUT>/farm-state.json.
import fs from 'fs'; import path from 'path'; import url from 'url'; import { spawn } from 'child_process'; import { setTimeout } from 'timers';
import { OUT, shotFiles, readShots, shotHash, trailerConfig, framesDone } from './director.mjs';

const R = path.dirname(url.fileURLToPath(import.meta.url));
const SELF = url.fileURLToPath(import.meta.url), DIRECTOR = path.join(R, 'director.mjs');
const LOCK = path.join(OUT, 'farm.lock'), LOG = path.join(OUT, 'farm.log'), STATE = path.join(OUT, 'farm-state.json');
const JOBS = Math.max(1, +(process.env.FARM_JOBS || 2));
const SCAN_MS = 5000, MAX_FAILS = 3, SHOT_OVERHEAD = 120;   // s of page load + setup per shot (ETA)
fs.mkdirSync(OUT, { recursive: true });

const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const lockPid = () => { try { const pid = +fs.readFileSync(LOCK, 'utf8'); return pid && alive(pid) ? pid : 0; } catch { return 0; } };
const stamp = () => new Date().toISOString().slice(11, 19);
const say = (...a) => console.log(stamp(), ...a);

function approvedShots() {
  const seen = new Map();
  for (const f of shotFiles()) {
    let list; try { list = readShots(f); } catch (e) { say('! cannot read', path.basename(f), e.message); continue; }
    for (const s of list) {
      if (!s.id || s.approved !== true) continue;
      if (seen.has(s.id)) { say(`! duplicate approved shot id ${s.id} in ${path.basename(f)} (using ${path.basename(seen.get(s.id)._file)})`); continue; }
      seen.set(s.id, s);
    }
  }
  return [...seen.values()];
}
// state of one shot on disk: frames done for the current spec, clip up to date
function shotState(s, cfg) {
  const hash = shotHash(s, cfg.width, cfg.height, cfg.fps), dir = path.join(OUT, 'frames', s.id), N = s.frames | 0;
  let meta = null, prog = null, clip = null;
  try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')); } catch { /* none */ }
  try { prog = JSON.parse(fs.readFileSync(path.join(dir, 'progress.json'), 'utf8')); } catch { /* none */ }
  try { clip = JSON.parse(fs.readFileSync(path.join(OUT, 'clips', s.id + '.json'), 'utf8')); } catch { /* none */ }
  const current = !meta || meta.hash === hash;   // no meta yet: nothing stale on disk
  const done = current && fs.existsSync(dir) ? framesDone(dir, N) : 0;
  const clipOk = !!clip && clip.hash === hash && clip.frames === N && fs.existsSync(path.join(OUT, 'clips', s.id + '.mp4'));
  return { hash, dir, N, done, complete: done === N && N > 0, clipOk, prog, meta };
}

// ---------- run: the queue ----------
async function run() {
  const other = lockPid();
  if (other && other !== process.pid) { say(`farm already running (pid ${other})`); return; }
  fs.writeFileSync(LOCK, String(process.pid));
  const jobs = new Map(), fails = new Map(), failed = new Set(), busyUntil = new Map();
  let encoding = null, stopping = false;
  const writeState = () => {
    const o = { pid: process.pid, started: started, updated: Date.now(), jobs: [...jobs.entries()].map(([id, j]) => ({ id, pid: j.child.pid, since: j.since })), encoding: encoding?.id || null, failed: [...failed] };
    try { fs.writeFileSync(STATE + '.tmp', JSON.stringify(o, null, 1)); fs.renameSync(STATE + '.tmp', STATE); } catch { /* best effort */ }
  };
  const started = Date.now();
  const shutdown = sig => {
    if (stopping) return; stopping = true;
    say(`farm stopping (${sig}): ${jobs.size} renderer(s)${encoding ? ' + encoder' : ''}`);
    for (const j of jobs.values()) { try { process.kill(j.child.pid, 'SIGTERM'); } catch { /* gone */ } }
    if (encoding) { try { process.kill(encoding.child.pid, 'SIGTERM'); } catch { /* gone */ } }
    setTimeout(() => { try { if (+fs.readFileSync(LOCK, 'utf8') === process.pid) fs.unlinkSync(LOCK); } catch { /* gone */ } process.exit(0); }, 6000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM')); process.on('SIGINT', () => shutdown('SIGINT'));
  say(`farm started: pid ${process.pid}, up to ${JOBS} renderer(s), output ${OUT}`);

  const pipe = (child, id) => {
    let buf = '';
    const onData = d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) console.log(stamp(), line.startsWith('[') ? line : `[${id}] ${line}`); } };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
  };
  const render = s => {
    const child = spawn('nice', ['-n', '10', process.execPath, DIRECTOR, `${s._file}#${s.id}`, '--quiet'], { cwd: path.resolve(R, '../..'), stdio: ['ignore', 'pipe', 'pipe'] });
    jobs.set(s.id, { child, since: Date.now() }); pipe(child, s.id);
    say(`render ${s.id} (${path.basename(s._file)}): director pid ${child.pid}`);
    child.on('exit', code => {
      jobs.delete(s.id);
      if (stopping) return;
      if (code === 0) { fails.delete(s.id); say(`render ${s.id} finished`); }
      else if (code === 5) { busyUntil.set(s.id, Date.now() + 60000); say(`render ${s.id}: another director holds the shot, retry in 60 s`); }
      else {
        const n = (fails.get(s.id) || 0) + 1; fails.set(s.id, n);
        say(`! render ${s.id} exited with ${code} (failure ${n}/${MAX_FAILS})`);
        if (n >= MAX_FAILS) { failed.add(s.id); say(`! ${s.id} given up after ${MAX_FAILS} failures: fix the spec (the farm retries it when the spec changes)`); }
      }
      writeState();
    });
  };
  const encode = (s, st, cfg) => {
    const clips = path.join(OUT, 'clips'); fs.mkdirSync(clips, { recursive: true });
    const tmp = path.join(clips, s.id + '.part.mp4');
    const child = spawn('nice', ['-n', '10', 'ffmpeg', '-y', '-loglevel', 'error', '-framerate', String(cfg.fps), '-i', path.join(st.dir, '%05d.jpg'), '-frames:v', String(st.N),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', String(cfg.fps), '-movflags', '+faststart', tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
    encoding = { id: s.id, child }; pipe(child, s.id);
    say(`encode ${s.id}: ${st.N} frames -> clips/${s.id}.mp4`);
    child.on('exit', code => {
      encoding = null;
      if (code === 0) {
        fs.renameSync(tmp, path.join(clips, s.id + '.mp4'));
        fs.writeFileSync(path.join(clips, s.id + '.json'), JSON.stringify({ id: s.id, hash: st.hash, frames: st.N, fps: cfg.fps, width: cfg.width, height: cfg.height, encoded: new Date().toISOString() }, null, 1));
        say(`encoded ${s.id}`);
      } else if (!stopping) { say(`! encode ${s.id} failed (${code})`); fails.set('enc:' + s.id, (fails.get('enc:' + s.id) || 0) + 1); }
      writeState();
    });
  };

  const failHash = new Map();
  for (;;) {
    if (stopping) { await new Promise(r => setTimeout(r, 1000)); continue; }
    const cfg = trailerConfig(), shots = approvedShots();
    let pending = 0;
    for (const s of shots) {
      const st = shotState(s, cfg);
      // a failed shot whose spec changed gets another chance
      if (failed.has(s.id) && failHash.get(s.id) !== st.hash) { if (failHash.has(s.id)) { failed.delete(s.id); fails.delete(s.id); say(`${s.id}: spec changed, retrying`); } failHash.set(s.id, st.hash); }
      if (failed.has(s.id)) { failHash.set(s.id, st.hash); continue; }
      if (jobs.has(s.id)) { pending++; continue; }
      if (!st.complete) {
        pending++;
        if (jobs.size < JOBS && !(busyUntil.get(s.id) > Date.now())) render(s);
      } else if (!st.clipOk && (fails.get('enc:' + s.id) || 0) < MAX_FAILS) {
        pending++;
        if (!encoding) encode(s, st, cfg);
      }
    }
    writeState();
    if (!pending && !jobs.size && !encoding) { say('farm: nothing left to render or encode, exiting'); break; }
    await new Promise(r => setTimeout(r, SCAN_MS));
  }
  try { if (+fs.readFileSync(LOCK, 'utf8') === process.pid) fs.unlinkSync(LOCK); } catch { /* gone */ }
}

// ---------- start / stop / status ----------
function start() {
  const pid = lockPid();
  if (pid) { console.log(`farm already running (pid ${pid}); log ${LOG}`); return; }
  try { fs.unlinkSync(LOCK); } catch { /* none */ }
  const fd = fs.openSync(LOG, 'a');
  const child = spawn('nohup', [process.execPath, SELF, 'run'], { detached: true, stdio: ['ignore', fd, fd], cwd: path.resolve(R, '../..') });
  child.unref();
  fs.writeFileSync(LOCK, String(child.pid));   // the farm rewrites it with its own pid (nohup execs node in place)
  console.log(`farm started (pid ${child.pid}); log ${LOG}`);
}
async function stop() {
  const pid = lockPid();
  if (!pid) { console.log('farm is not running'); try { fs.unlinkSync(LOCK); } catch { /* none */ } return; }
  // the farm runs as its own process group (detached): directors, browsers and ffmpeg go with it
  try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch { /* gone */ } }
  for (let i = 0; i < 40 && alive(pid); i++) await new Promise(r => setTimeout(r, 250));
  if (alive(pid)) { try { process.kill(-pid, 'SIGKILL'); } catch { /* gone */ } }
  try { fs.unlinkSync(LOCK); } catch { /* gone */ }
  console.log(`farm stopped (pid ${pid}); frames on disk are kept, "start" resumes`);
}
function status() {
  const cfg = trailerConfig(), pid = lockPid();
  let state = null; try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { /* none */ }
  const running = new Set(pid && state ? state.jobs.map(j => j.id) : []);
  const shots = approvedShots();
  console.log(`farm: ${pid ? `running (pid ${pid}${state ? `, up ${Math.round((Date.now() - state.started) / 60000)} min` : ''})` : 'not running'} · ${cfg.width}x${cfg.height} @ ${cfg.fps} fps · ${JOBS} renderer(s) · log ${LOG}`);
  if (!shots.length) { console.log('no approved shots in tools/trailer/shots/*.json'); return; }
  let left = 0, leftShots = 0, rates = [];
  const rows = shots.map(s => {
    const st = shotState(s, cfg), p = st.prog && st.prog.hash === st.hash ? st.prog : null;
    if (p?.secPerFrame) rates.push(p.secPerFrame);
    const remaining = st.N - st.done; left += remaining; if (remaining && !running.has(s.id)) leftShots++;
    const what = running.has(s.id) ? `rendering (${p?.phase || 'starting'}${p?.frame !== undefined ? ` @${p.frame}` : ''})` : state?.failed?.includes(s.id) ? 'FAILED' : st.complete ? (st.clipOk ? 'done' : 'encode pending') : st.done ? 'partial' : 'queued';
    return [s.id, path.basename(s._file), `${st.done}/${st.N}`, (st.N ? (100 * st.done / st.N).toFixed(0) : 0) + '%', p?.secPerFrame ? p.secPerFrame + ' s/f' : '-', st.clipOk ? 'clip ok' : '', what];
  });
  const w = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i]).length)));
  for (const r of rows) console.log('  ' + r.map((c, i) => String(c).padEnd(w[i])).join('  '));
  const rate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 10;
  const eta = (left * rate + leftShots * SHOT_OVERHEAD) / JOBS;
  console.log(`left: ${left} frames in ${rows.filter(r => !r[6].startsWith('done')).length} shot(s) · ~${rate.toFixed(1)} s/frame per renderer${rates.length ? '' : ' (assumed)'} · ETA ~${eta >= 3600 ? (eta / 3600).toFixed(1) + ' h' : Math.round(eta / 60) + ' min'}`);
}

const cmd = process.argv[2];
if (cmd === 'start') start();
else if (cmd === 'stop') await stop();
else if (cmd === 'status') status();
else if (cmd === 'run') await run();
else { console.log('usage: node tools/trailer/farm.mjs start|status|stop|run'); process.exit(2); }
