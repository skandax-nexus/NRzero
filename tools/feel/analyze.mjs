// Numbers for the walking-style and physics audit (docs/MOTION.md) from tools/feel/audit.mjs output.
//   node tools/feel/analyze.mjs <dir>            prints a report and writes <dir>/metrics.json
// Foot contact: a foot point (heel = foot bone, ball = toe bone, each minus its height in the idle pose) is planted
// while it is within 2.5 cm of the collision ground under it. Slide = horizontal travel of the planted point over one
// contact (cm per step). Strides come from heel strikes (first planted frame of each contact).
import fs from 'fs'; import path from 'path';
const dir = process.argv[2]; if (!dir) { console.log('usage: node tools/feel/analyze.mjs <dir>'); process.exit(1); }
const restIdle = JSON.parse(fs.readFileSync(path.join(dir, '_rest.json'), 'utf8'));
const load = n => { const f = path.join(dir, n + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
// contact reference: the lowest height (above the ground under it) each foot point reaches during Kai's steady
// keyboard gait on flat ground. The idle pose is no reference: the clips plant the foot with the ankle lower than idle.
const lowest = (S, key = s => s.k) => {
  const r = {};
  for (const b of ['foot_L', 'toe_L', 'foot_R', 'toe_R']) r[b] = Math.min(...S.map(key).filter(Boolean).map(k => k[b][1] - (k[(b[0] === 'f' ? 'g' : 'gt') + b.slice(-1)] ?? 0)));
  return r;
};
let rest = restIdle;
{ const d = load('walk_start_stop'); if (d) rest = lowest(d.samples.slice(30, 95)); }
const hyp = (a, b) => Math.hypot(a, b);
const r2 = x => (x == null || !isFinite(x) ? x : Math.round(x * 100) / 100);
const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const pct = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const M = {};
const hs = s => hyp(s.v[0], s.v[2]);

// ---------------- foot analysis ----------------
const PLANT = 0.025, PLANT_OUT = 0.04;
function feet(S, opts = {}) {
  const key = opts.key || (s => s.k);
  let restH = opts.rest || rest;
  if (opts.rest === 'auto') restH = lowest(S, key);     // NPCs: each body's own lowest foot / toe height over the run
  const res = { L: [], R: [] }, strikes = [], float = [], sink = [];
  for (const side of ['L', 'R']) {
    let seg = null;
    const close = () => { if (seg && seg.n >= 3) res[side].push(seg); else if (seg) strikes.splice(strikes.findIndex(x => x.i === seg.i0 && x.side === side), 1); seg = null; };
    for (let i = 0; i < S.length; i++) {
      const k = key(S[i]); if (!k) { close(); continue; }
      const f = k['foot_' + side], t = k['toe_' + side];
      const gH = k['g' + side] ?? 0, gT = k['gt' + side] ?? 0;
      const heel = f[1] - restH['foot_' + side] - gH, ball = t[1] - restH['toe_' + side] - gT;
      const sole = Math.min(heel, ball);
      if (opts.grounded && !opts.grounded(S[i])) { close(); continue; }
      if (sole < (seg ? PLANT_OUT : PLANT)) {      // hysteresis: in below 2.5 cm, out above 4 cm
        if (!seg) { seg = { i0: i, n: 0, heelPath: 0, ballPath: 0, minSole: sole, lastF: f, lastT: t, strike: f }; strikes.push({ i, side, pos: f }); }
        else {
          if (heel < PLANT) seg.heelPath += hyp(f[0] - seg.lastF[0], f[2] - seg.lastF[2]);
          if (ball < PLANT) seg.ballPath += hyp(t[0] - seg.lastT[0], t[2] - seg.lastT[2]);
        }
        seg.n++; seg.minSole = Math.min(seg.minSole, sole); seg.lastF = f; seg.lastT = t;
        sink.push(sole);
      } else close();
      float.push(sole);
    }
    close();
  }
  const segs = res.L.concat(res.R);
  // slide per step = the smaller of heel / ball travel while planted (the foot pivots on one of them)
  const slide = segs.map(s => Math.min(s.heelPath, s.ballPath) * 100), slideMax = segs.map(s => Math.max(s.heelPath, s.ballPath) * 100);
  strikes.sort((a, b) => a.i - b.i);
  return { segs, slide, slideMax, strikes, sink: Math.min(...sink, 0), minSole: segs.map(s => s.minSole) };
}
function gaitStats(S, dt, i0, i1, extra = {}) {
  const W = S.slice(i0, i1); if (W.length < 10) return null;
  const F = feet(W, extra);
  const sp = mean(W.map(hs));
  const st = F.strikes;
  const intervals = []; for (let i = 1; i < st.length; i++) if (st[i].side !== st[i - 1].side) intervals.push((st[i].i - st[i - 1].i) * dt);
  const strides = [];
  for (const side of ['L', 'R']) { const a = st.filter(s => s.side === side); for (let i = 1; i < a.length; i++) strides.push(hyp(a[i].pos[0] - a[i - 1].pos[0], a[i].pos[2] - a[i - 1].pos[2])); }
  const cadence = intervals.length ? 60 / mean(intervals) : null;
  const strideL = strides.length ? mean(strides) : null;
  // arm swing: hand fore-aft relative to the hips, along the facing direction; head / pelvis bob
  const fwd = s => { const y = s.k.ry; return [Math.sin(y), Math.cos(y)]; };
  const arm = side => { const a = W.map(s => { const [fx, fz] = fwd(s), h = s.k['hand_' + side], p = s.k.hips; return (h[0] - p[0]) * fx + (h[2] - p[2]) * fz; }); return (Math.max(...a) - Math.min(...a)) * 100; };
  const headY = W.map(s => s.k.head[1] - s.p[1]), hipY = W.map(s => s.k.hips[1] - s.p[1]);
  // trunk lean: chest ahead of hips along travel, degrees
  const lean = mean(W.map(s => { const [fx, fz] = fwd(s), c = s.k.chest, p = s.k.hips; return Math.atan2((c[0] - p[0]) * fx + (c[2] - p[2]) * fz, c[1] - p[1]) * 180 / Math.PI; }));
  const clips = [...new Set(W.map(s => s.k.clip))].join('/'), ts = mean(W.map(s => s.k.ts));
  return {
    speed: r2(sp), clips, timeScale: r2(ts), steps: st.length,
    slideMedCm: r2(med(F.slide)), slideP90Cm: r2(pct(F.slide, 0.9)), slideMaxPointCm: r2(med(F.slideMax)),
    cadenceSpm: r2(cadence), strideM: r2(strideL), strideTimesCadence: cadence && strideL ? r2(strideL * cadence / 120) : null,
    armSwingCm: { L: r2(arm('L')), R: r2(arm('R')) }, headBobCm: r2((Math.max(...headY) - Math.min(...headY)) * 100), pelvisBobCm: r2((Math.max(...hipY) - Math.min(...hipY)) * 100),
    pelvisHeightM: r2(mean(hipY)), leanDeg: r2(lean), sinkCm: r2(F.sink * 100), minSoleCmMed: r2(med(F.minSole) * 100),
  };
}
function pops(S, i0 = 0, i1 = S.length) {
  const W = S.slice(i0, i1).filter(s => s.k);
  const w = W.map(s => s.k.wmax);
  const changes = []; for (let i = 1; i < W.length; i++) if (W[i].k.clip !== W[i - 1].k.clip) changes.push(`${W[i].f}:${W[i - 1].k.clip}>${W[i].k.clip}`);
  let mi = 0; w.forEach((x, i) => { if (x > w[mi]) mi = i; });
  return { boneAngVelMax: r2(w[mi]), at: W[mi] && `${W[mi].f} ${W[mi].k.wbone} (${W[mi].k.clip})`, median: r2(med(w)), p95: r2(pct(w, 0.95)), clipChanges: changes };
}
const steadyWindow = (S, lo = 0.97) => {
  const top = Math.max(...S.map(hs)); const idx = S.map((s, i) => hs(s) >= top * lo && s.gr ? i : -1).filter(i => i >= 0);
  return idx.length ? [idx[0] + 8, idx[idx.length - 1]] : [0, 0];
};

// ---------------- locomotion scenarios ----------------
for (const n of ['walk_start_stop', 'stick_slow', 'stick_mid', 'sprint', 'crouch_walk', 'circle']) {
  const d = load(n); if (!d) continue; const S = d.samples, [a, b] = steadyWindow(S, n === 'circle' ? 0.9 : 0.97);
  M[n] = { steady: gaitStats(S, d.dt, a, b), pops: pops(S), stepMs: d.stepMs };
  // start: time to 90 % speed, slide in the first 2 steps; stop: distance, slide after release
  const top = Math.max(...S.map(hs)); const i90 = S.findIndex(s => hs(s) >= 0.9 * top), i10 = S.findIndex(s => hs(s) > 0.05);
  M[n].start = { t10to90: r2((i90 - i10) * d.dt), slideFirst1sCm: r2(Math.max(0, ...feet(S.slice(i10, i10 + Math.round(1 / d.dt))).slide)) };
  const iStop = S.findIndex((s, i) => i > i90 && hs(s) < 0.97 * top && hs(S[i - 1]) >= 0.97 * top);
  if (iStop > 0) {
    const iRest = S.findIndex((s, i) => i > iStop && hs(s) < 0.05);
    const W = S.slice(iStop, iRest > 0 ? iRest + 30 : S.length), Fs = feet(W);
    M[n].stop = { tStop: r2(((iRest > 0 ? iRest : S.length) - iStop) * d.dt), distM: r2(hyp(S[iRest > 0 ? iRest : S.length - 1].p[0] - S[iStop].p[0], S[iRest > 0 ? iRest : S.length - 1].p[2] - S[iStop].p[2])), slideMaxCm: r2(Math.max(0, ...Fs.slide)), slideSumCm: r2(Fs.slide.reduce((x, y) => x + y, 0)), clipsDuringStop: [...new Set(W.map(s => s.k.clip))].join('/') };
  }
}
// turns
for (const n of ['turn90', 'turn180']) {
  const d = load(n); if (!d) continue; const S = d.samples, dt = d.dt;
  const yaw = S.map(s => s.yaw); const rate = yaw.map((y, i) => i ? Math.abs(Math.atan2(Math.sin(y - yaw[i - 1]), Math.cos(y - yaw[i - 1]))) / dt : 0);
  const i0 = 60, target = n === 'turn90' ? Math.PI / 2 : Math.PI;
  const tot = i => Math.abs(Math.atan2(Math.sin(yaw[i] - yaw[i0 - 1]), Math.cos(yaw[i] - yaw[i0 - 1])));
  const i90 = S.findIndex((s, i) => i >= i0 && tot(i) >= 0.9 * target);
  const W = S.slice(i0, i0 + 30), F = feet(W);
  const minSp = Math.min(...S.slice(i0, i0 + 30).map(hs));
  M[n] = { yawRateMaxDegS: r2(Math.max(...rate) * 180 / Math.PI), t90pct: r2((i90 - i0) * dt), speedDipMs: r2(minSp), slideDuringTurnMaxCm: r2(Math.max(0, ...F.slide)), slideDuringTurnMedCm: r2(med(F.slide)), pops: pops(S, i0 - 5, i0 + 40), arcRadiusM: null };
  // path: how far Kai overshoots sideways during the turn (velocity lerp = skid)
  const p0 = S[i0].p; const after = S.slice(i0, i0 + 45);
  M[n].overshootM = r2(Math.max(...after.map(s => n === 'turn90' ? (s.p[2] - p0[2]) : (s.p[2] - p0[2]))));
}
// idle
{ const d = load('idle'); if (d) { const F = feet(d.samples);
   const rng = k => { const xs = d.samples.map(s => s.k[k][0]), zs = d.samples.map(s => s.k[k][2]); return r2(hyp(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * 100); };
  M.idle = { footDriftCm: { L: rng('foot_L'), R: rng('foot_R') }, contactSegs: F.segs.length, headSwayCm: r2((Math.max(...d.samples.map(s => s.k.head[0])) - Math.min(...d.samples.map(s => s.k.head[0]))) * 100), pops: pops(d.samples) }; } }
// jumps / landings (animation side)
for (const n of ['jump_in_place', 'jump_sprint', 'drop_3m']) {
  const d = load(n); if (!d) continue; const S = d.samples;
  const air = S.filter(s => !s.gr), iLand = S.findIndex((s, i) => i > 0 && s.gr && !S[i - 1].gr);
  M[n] = { airFrames: air.length, clipsInAir: [...new Set(air.map(s => s.k.clip))].join('/'), landingImpactMs: iLand > 0 ? r2(-S[iLand - 1].v[1]) : null, pelvisDipAfterLandCm: iLand > 0 ? r2((S[iLand - 1].k.hips[1] - S[iLand - 1].p[1] - Math.min(...S.slice(iLand, iLand + 15).map(s => s.k.hips[1] - s.p[1]))) * 100) : null, pops: pops(S),
    feetHeightInAirCm: air.length ? r2(Math.min(...air.map(s => Math.min(s.k.foot_L[1], s.k.foot_R[1]) - s.p[1])) * 100) : null };
}
// stairs / ramp: pelvis, foot float / penetration against the step under each foot, vertical pops of the capsule
for (const n of ['stairs', 'stairs_slow', 'risers40', 'ramp']) {
  const d = load(n); if (!d) continue; const S = d.samples.filter(s => s.k);
  const dy = S.map((s, i) => i ? s.p[1] - S[i - 1].p[1] : 0);
  const heel = side => S.map(s => s.k['foot_' + side][1] - rest['foot_' + side] - (s.k['g' + side] ?? 0));
  const ball = side => S.map(s => s.k['toe_' + side][1] - rest['toe_' + side] - (s.k['gt' + side] ?? 0));
  const sole = ['L', 'R'].map(sd => heel(sd).map((h, i) => Math.min(h, ball(sd)[i])));
  const lower = sole[0].map((x, i) => Math.min(x, sole[1][i]));
  const onStairs = S.map((s, i) => i).filter(i => S[i].p[2] < 0 && S[i].p[2] > -10.6);
  const L = onStairs.map(i => lower[i]);
  const F = feet(S);
  M[n] = { maxStepUpPerFrameCm: r2(Math.max(...dy) * 100), maxStepDownPerFrameCm: r2(-Math.min(...dy) * 100), airFramesOnStairs: onStairs.filter(i => !S[i].gr).length,
    lowerFootAboveStepCm: { median: r2(med(L) * 100), p90: r2(pct(L, 0.9) * 100), max: r2(Math.max(...L) * 100) }, penetrationCm: r2(Math.min(...sole[0], ...sole[1]) * 100),
    pelvisAboveCapsuleCm: { min: r2(Math.min(...onStairs.map(i => S[i].k.hips[1] - S[i].p[1])) * 100), max: r2(Math.max(...onStairs.map(i => S[i].k.hips[1] - S[i].p[1])) * 100) },
    slideMedCm: r2(med(F.slide)), speedOnStairs: r2(mean(onStairs.map(i => hs(S[i])))), clips: [...new Set(S.map(s => s.k.clip))].join('/') };
}
// walls / corner
for (const n of ['wall_30', 'wall_80', 'corner']) {
  const d = load(n); if (!d) continue; const S = d.samples, W = S.slice(Math.round(S.length * 0.6));
  const real = W.slice(1).map((s, i) => hyp(s.p[0] - W[i].p[0], s.p[2] - W[i].p[2]) / d.dt);
  const xs = W.map(s => s.p[0]), xd = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
  M[n] = { realSpeed: r2(mean(real)), velFedToAnimation: r2(mean(W.map(hs))), retainedOfInput: r2(mean(real) / 3.1), xMin: r2(Math.min(...S.map(s => s.p[0]))), wallNormalJitterCm: r2(Math.max(...xd) * 100), clips: [...new Set(W.map(s => s.k.clip))].join('/'), animTimeScale: r2(mean(W.map(s => s.k.ts))) };
  if (n === 'corner') M[n].note = 'pinned in the corner: real speed 0, but the velocity (and the jog cycle) stays at full speed';
}
// ceiling
{ const d = load('ceiling_jump'); if (d) { const S = d.samples; M.ceiling_jump = { sidewaysTeleportM: r2(Math.max(...S.slice(1).map((s, i) => hyp(s.p[0] - S[i].p[0], s.p[2] - S[i].p[2])))), apexM: r2(Math.max(...S.map(s => s.p[1]))), headTopApex: r2(Math.max(...S.map(s => s.p[1])) + 1.75), ceiling: 2.2, vyAfterBump: S.map(s => s.v[1]).find((v, i) => i > 6 && v === 0 && !S[i].gr) }; } }
// NPC bump
{ const d = load('npc_bump'); if (d) { const S = d.samples; const hp = S[0].n?.[0]?.rp; if (hp) { const dz = S.map(s => hyp(s.p[0] - s.n[0].rp[0], s.p[2] - s.n[0].rp[2])); M.npc_bump = { minDistM: r2(Math.min(...dz)), passedThrough: S[S.length - 1].p[2] > hp[2], npcMovedM: r2(hyp(S[S.length - 1].n[0].rp[0] - hp[0], S[S.length - 1].n[0].rp[2] - hp[2])) }; } } }
// camera vs wall (3 m platform x 26..30, z -4..0)
{ const d = load('cam_wall'); if (d) { const S = d.samples; const inside = S.filter(s => s.cam[0] > 26 && s.cam[0] < 30 && s.cam[2] > -4 && s.cam[2] < 0 && s.cam[1] < 3).length;
  const jumps = S.slice(1).map((s, i) => hyp(s.cam[0] - S[i].cam[0], s.cam[1] - S[i].cam[1], s.cam[2] - S[i].cam[2]) / d.dt);
  const dist = S.map(s => hyp(s.cam[0] - s.p[0], s.cam[2] - s.p[2]));
  M.cam_wall = { framesCameraInsideWall: inside, nearestCamToWallFaceM: r2(Math.min(...S.map(s => s.cam[0] < 26 ? 26 - s.cam[0] : -1).filter(x => x >= 0))), camSpeedMaxMs: r2(Math.max(...jumps)), camDistMin: r2(Math.min(...dist)), camDistMax: r2(Math.max(...dist)) }; } }
// crowd: NPC walkers' foot slide and turn snaps
{ const d = load('crowd'); if (d) { const S = d.samples; const n = S[0].n.length; const out = [];
  for (let j = 0; j < n; j++) {
    const key = s => s.n[j]; const F = feet(S, { key, rest: 'auto' });
    const ry = S.map(s => s.n[j].ry); const snaps = ry.slice(1).map((y, i) => Math.abs(Math.atan2(Math.sin(y - ry[i]), Math.cos(y - ry[i]))) * 180 / Math.PI);
    out.push({ speed: S[S.length - 1].n[j].speed, clip: [...new Set(S.map(s => s.n[j].clip))].join('/'), ts: r2(mean(S.map(s => s.n[j].ts))), maxTurnPerFrameDeg: r2(Math.max(...snaps)), boneAngVelMax: r2(Math.max(...S.map(s => s.n[j].wmax))), footSegs: F.segs.length, slideMedCm: r2(med(F.slide)), slideP90Cm: r2(pct(F.slide, 0.9)) });
  }
  M.crowd = out; } }
// ---------------- physics ----------------
const jumpStats = (S, dt) => {
  const iT = S.findIndex((s, i) => i > 0 && !s.gr && S[i - 1].gr && s.v[1] > 1); if (iT < 0) return null;
  const iL = S.findIndex((s, i) => i > iT && s.gr); const y0 = S[iT - 1].p[1];
  const apex = Math.max(...S.slice(iT, iL > 0 ? iL : S.length).map(s => s.p[1])) - y0;
  const g = []; for (let i = iT + 2; i < (iL > 0 ? iL : S.length) - 1; i++) g.push(-(S[i + 1].v[1] - S[i].v[1]) / dt);
  return { apexM: r2(apex), airTimeS: r2(((iL > 0 ? iL : S.length) - iT + 1) * dt), distM: iL > 0 ? r2(hyp(S[iL].p[0] - S[iT - 1].p[0], S[iL].p[2] - S[iT - 1].p[2])) : null, takeoffSpeed: r2(hs(S[iT - 1])), vy0: r2(S[iT].v[1] + (g.length ? med(g) * dt : 0)), gravity: r2(med(g)), landSpeed: iL > 0 ? r2(hs(S[iL])) : null };
};
M.physics = {};
for (const fps of [15, 30, 60, 144]) {
  const P = M.physics[fps] = {};
  const j = load('phys_jump_' + fps), jw = load('phys_jumpwalk_' + fps), js = load('phys_jumpsprint_' + fps);
  if (j) P.jump = jumpStats(j.samples, j.dt); if (jw) P.jumpWalk = jumpStats(jw.samples, jw.dt); if (js) P.jumpSprint = jumpStats(js.samples, js.dt);
  for (const [nm, key, target, tRel] of [['accel', 'phys_accel_', 3.1, 1.5], ['sprint', 'phys_sprintstop_', 5.6, 1.7]]) {
    const d = load(key + fps); if (!d) continue; const S = d.samples;
    const i0 = S.findIndex(s => hs(s) > 0.01), i90 = S.findIndex(s => hs(s) >= 0.9 * target), top = Math.max(...S.map(hs));
    const iRel = Math.round(tRel * fps), iRest = S.findIndex((s, i) => i > iRel && hs(s) < 0.02);
    P[nm] = { topSpeed: r2(top), t0to90: r2((i90 - i0 + 1) * d.dt), accel0: r2(hs(S[i0]) / d.dt), stopDistM: iRel > 0 && iRest > 0 ? r2(hyp(S[iRest].p[0] - S[iRel - 1].p[0], S[iRest].p[2] - S[iRel - 1].p[2])) : null, stopTimeS: iRel > 0 && iRest > 0 ? r2((iRest - iRel + 1) * d.dt) : null };
  }
  const tn = load('phys_tunnel_' + fps); if (tn) P.tunnel = { finalX: r2(tn.samples[tn.samples.length - 1].p[0]), tunnelled: tn.samples.some(s => s.p[0] > 40.05) };
  const fa = load('phys_fall30_' + fps); if (fa) { const S = fa.samples; P.fall30 = { finalY: r2(S[S.length - 1].p[1]), vMin: r2(Math.min(...S.map(s => s.v[1]))), landed: S[S.length - 1].gr === 1 }; }
  const st = load('phys_stairs_' + fps); if (st) { const S = st.samples; const dy = S.map((s, i) => i ? s.p[1] - S[i - 1].p[1] : 0); P.stairs = { topReached: Math.max(...S.map(s => s.p[1])) >= 1.79, finalY: r2(S[S.length - 1].p[1]), finalZ: r2(S[S.length - 1].p[2]), maxUpPerFrameCm: r2(Math.max(...dy) * 100), airFramesDown: S.filter(s => !s.gr).length, minHSpeedOnStairs: r2(Math.min(...S.filter(s => s.p[2] < -0.2 && s.p[2] > -10).map(hs))) }; }
  const co = load('phys_corner_' + fps); if (co) { const S = co.samples.slice(-Math.round(fps)); const jit = S.slice(1).map((s, i) => hyp(s.p[0] - S[i].p[0], s.p[2] - S[i].p[2])); P.corner = { jitterMaxCm: r2(Math.max(...jit) * 100), jitterMeanCm: r2(mean(jit) * 100), pos: S[S.length - 1].p.map(r2) }; }
  const wa = load('phys_wall30_' + fps); if (wa) { const S = wa.samples.slice(-Math.round(fps)); P.wall30 = { speedAlong: r2(mean(S.map(s => Math.abs(s.v[2])))), xMin: r2(Math.min(...wa.samples.map(s => s.p[0]))) }; }
}
// step-up / climb scans
M.stepUp = {}; for (const h of [0.2, 0.3, 0.4, 0.42, 0.43, 0.45, 0.5]) { const d = load('stepup_' + h); if (!d) continue; const S = d.samples; const dy = S.map((s, i) => i ? s.p[1] - S[i - 1].p[1] : 0); M.stepUp[h] = { climbed: S.some(s => s.gr && Math.abs(s.p[1] - h) < 0.01), popCm: r2(Math.max(...dy) * 100), framesToClimb: dy.filter(x => x > 0.005).length }; }
M.climb = {}; for (const mode of ['walk', 'sprint']) { M.climb[mode] = {}; for (const h of [0.6, 0.8, 0.9, 1.0, 1.1, 1.15, 1.2, 1.23, 1.25, 1.3, 1.4]) { const d = load(`climb_${mode}_${h}`); if (!d) continue; const S = d.samples; M.climb[mode][h] = S.some(s => s.gr && Math.abs(s.p[1] - h) < 0.01); } }
M.climbStand = {}; for (const h of [1.0, 1.15, 1.2]) { const d = load('climb_stand_' + h); if (d) M.climbStand[h] = d.samples.some(s => s.gr && Math.abs(s.p[1] - h) < 0.01); }
M.gaps = {}; for (const mode of ['late', 'edge']) for (const w of [4.0, 4.4, 4.6, 4.8, 5.0]) { const d = load(`gap_${mode}_${w}`); if (!d) continue; const S = d.samples; const t = S.findIndex(s => s.v[1] > 1); (M.gaps[mode] ||= {})[w] = { crossed: S.some(s => s.gr && Math.abs(s.p[1] - 2) < 0.01 && s.p[2] > w), takeoffZ: t > 0 ? r2(S[t - 1].p[2]) : null }; }
// ledge tolerance (edge at x = 36)
for (const n of ['ledge_key', 'ledge_stick']) { const d = load(n); if (!d) continue; const S = d.samples; const i = S.findIndex(s => !s.gr && s.p[0] > 35); M[n] = { fallStartsAtOverhangM: i > 0 ? r2(S[i].p[0] - 36) : null, lastGroundedX: i > 0 ? r2(S[i - 1].p[0]) : null, speed: i > 0 ? r2(hs(S[i - 1])) : null }; }
{ const d = load('buffer_probe'); if (d) { const S = d.samples; const take = S.filter((s, i) => i > 0 && s.v[1] > 1 && S[i - 1].v[1] <= 0.5).length; M.jumpBuffer = { jumps: take, buffered: take >= 2 }; } }
{ const d = load('coyote_probe'); if (d) { const S = d.samples; M.coyote = { jumpedAfterLeavingLedge: S.some(s => s.v[1] > 2) }; } }
{ const d = load('lift'); if (d) { const S = d.samples; let flick = 0; for (let i = 1; i < S.length; i++) if (S[i].gr !== S[i - 1].gr) flick++; const up = S.filter(s => s.t > 0.6 && s.t < 2.3), down = S.filter(s => s.t > 3.6 && s.t < 4.6);
  M.lift = { groundedTogglesTotal: flick, groundedFramesRising: up.filter(s => s.gr).length + '/' + up.length, groundedFramesDescending: down.filter(s => s.gr).length + '/' + down.length, clips: [...new Set(S.map(s => s.k.clip))].join('/') }; } }
for (const n of ['cost_kai', 'cost_crowd12']) { const d = load(n); if (d) M[n] = { stepMs: d.stepMs }; }
M.contactReference = { fromSteadyWalk: Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, r2(v * 100)])), idlePoseCm: Object.fromEntries(Object.entries(restIdle).map(([k, v]) => [k, r2(v * 100)])) };
fs.writeFileSync(path.join(dir, 'metrics.json'), JSON.stringify(M, null, 1));
console.log(JSON.stringify(M, null, 1));
