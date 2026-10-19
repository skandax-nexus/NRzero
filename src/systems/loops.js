// Local Loops (gameplay bible: "observe repeated sequences and use knowledge to solve timing-based puzzles").
// Owner: Mission 6 (The Clockmaker's House). Extended by Mission 9 (Nine Minutes to Zero).
//
// A LocalLoop is a region of the world that repeats the same short sequence forever. The player is the only thing
// that remembers: objects the player disturbs snap back at the end of every repetition, but what the player has
// *learned* stays (retained knowledge, shown on the loop HUD and stored in game.flags.loopKnowledge).
// Being caught by the sequence is never a punishment: the loop simply rewinds and the player re-enters it at the
// latest restart point, keeping everything they know.
//
//   import { LocalLoop } from '../systems/loops.js';
//   const loop = new LocalLoop(game, { id: 'workshop', label: 'WORKSHOP LOOP', duration: 20, restart: [0, 0, -2, Math.PI] });
//   loop.at(4, () => arm.go(), { learn: ['arm', '0:04  The arm sweeps the near side'], when: () => playerWatching });
//   loop.hazard(() => armHits(player) && 'The arm caught you.');
//   loop.track(wedge, ['position', 'visible']);          // restored at every wrap / reset
//   loop.region = p => p.z < -1 && p.z > -29;             // HUD + hazards only while the player is inside
//   loop.onReset(n => n === 2 && game.ui.subtitle('kai', 'Again. But I know the rhythm now.'));
//   game.onUpdate(() => { arm.angle = armAngleAt(loop.t); });
//
// Everything is driven by game.onUpdate, so it is cleared with the scene and pauses with the game.
// For M9-style long loops: duration may be minutes; `iteration` counts repetitions; `variant(fn)` lets authored
// sequences deviate slightly per repetition ("repeat actions with small deviations"); `setLayer` drives the
// loop-memory music layer (loopState.layer) that themes can read to add one instrument per repetition.

/** Shared, read-only for music themes: the active loop's time, iteration and memory layer. */
export const loopState = { active: null, t: 0, iteration: 0, layer: 0, duration: 1 };

const fmt = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); };

function injectStyle() {
  if (document.getElementById('loop-hud-style')) return;
  const st = document.createElement('style'); st.id = 'loop-hud-style';
  st.textContent = `
  .loop-hud{position:absolute;left:28px;top:104px;display:flex;gap:12px;align-items:flex-start;pointer-events:none;opacity:0;transition:opacity .6s;font-family:var(--ui,system-ui)}
  .loop-hud.on{opacity:1}
  .loop-hud .lh-ring{position:relative;width:64px;height:64px;flex:none}
  .loop-hud svg{width:100%;height:100%;transform:rotate(-90deg)}
  .loop-hud .lh-bg{fill:rgba(6,10,16,.55);stroke:rgba(230,184,106,.18);stroke-width:4}
  .loop-hud .lh-fg{fill:none;stroke:#e6b86a;stroke-width:4;stroke-linecap:round;stroke-dasharray:170;transition:stroke .3s}
  .loop-hud .lh-mark{stroke:#f4ead8;stroke-width:3}
  .loop-hud .lh-mark.warn{stroke:#ff8a5a}
  .loop-hud .lh-time{position:absolute;inset:0;display:grid;place-items:center;font-weight:700;font-size:15px;color:#f4ead8;letter-spacing:.06em}
  .loop-hud .lh-side{max-width:min(330px,40vw);padding-top:2px}
  .loop-hud .lh-label{font-weight:700;font-size:13px;letter-spacing:.3em;color:#e6b86a}
  .loop-hud .lh-iter{font-weight:600;font-size:12px;letter-spacing:.24em;color:#c9bfae;margin-top:2px}
  .loop-hud .lh-know{margin-top:6px;font-weight:600;font-size:14px;line-height:1.3;color:#f4ead8;background:linear-gradient(90deg,rgba(6,10,16,.62),rgba(6,10,16,0));padding:4px 8px;border-left:2px solid rgba(230,184,106,.6)}
  .loop-hud .lh-know div{opacity:.92}
  .loop-hud .lh-know div.new{animation:lhnew 1.6s}
  .loop-hud.pulse .lh-ring{animation:lhpulse .5s}
  @keyframes lhnew{0%{color:#ffd58a;transform:translateX(-6px)}100%{transform:none}}
  @keyframes lhpulse{0%{transform:scale(1)}40%{transform:scale(1.08)}100%{transform:scale(1)}}
  html.touch .loop-hud{left:calc(14px + var(--sl,0px));top:calc(64px + var(--st,0px));gap:8px}
  html.touch .loop-hud .lh-ring{width:48px;height:48px}
  html.touch .loop-hud .lh-time{font-size:12px}
  html.touch .loop-hud .lh-know{font-size:12px;max-width:34vw}
  @media (max-width:760px){.loop-hud{left:16px;top:84px}}`;
  document.head.appendChild(st);
}

export class LocalLoop {
  /**
   * opts: { id, label, duration (s), restart: [x,y,z,yaw] (where a reset puts the player),
   *         hud: true, maxKnown: 4 (knowledge lines shown), region: (pos) => bool (HUD/hazards active only inside),
   *         maxLayer: 4, persist: true (store learned keys in game.flags.loopKnowledge[id]),
   *         resetToast: text shown the first time the loop rewinds the player }
   */
  constructor(game, opts = {}) {
    this.game = game; this.id = opts.id || 'loop'; this.label = opts.label || 'LOCAL LOOP';
    this.duration = opts.duration || 20; this.t = 0; this.iteration = 1; this.resets = 0;
    this.running = false; this.paused = false; this.frozen = false;
    this.restart = opts.restart || null; this.region = opts.region || null;
    this.events = []; this.hazards = []; this.tracked = []; this.knowledge = []; this.markers = [];
    this._onReset = []; this._onWrap = []; this._resetting = false; this.maxLayer = opts.maxLayer ?? 4; this.layer = 0;
    this.maxKnown = opts.maxKnown ?? 4; this.persist = opts.persist !== false; this.resetToast = opts.resetToast;
    this.scene = game.scene;
    if (this.persist) {
      const store = game.flags.loopKnowledge = game.flags.loopKnowledge || {};
      store[this.id] = store[this.id] || [];
    }
    if (opts.hud !== false) this.buildHud();
    this._off = game.onUpdate((dt) => this.update(dt));
    if (opts.autoStart !== false) this.start();
  }

  // ---------- control ----------
  start(t = 0) { this.running = true; this.t = t; loopState.active = this; this.syncState(); return this; }
  stop() { this.running = false; if (loopState.active === this) loopState.active = null; this.showHud(false); return this; }
  dispose() { this.stop(); this._off?.(); this.hud?.remove(); this.hud = null; clearInterval(this._watch); }
  setRestart(x, y, z, yaw = 0) { this.restart = [x, y, z, yaw]; }

  /** Schedule an event at loop time `time` (fires once per repetition). opts: { learn: [key, text], when: () => bool, warn } */
  at(time, fn, opts = {}) { const e = { time, fn, opts, fired: false }; this.events.push(e); if (opts.marker !== false && opts.learn) this.markers.push({ time, key: opts.learn[0], warn: !!opts.warn }); return e; }
  /** Is the loop time inside [t0, t1)? Wraps when t1 < t0. */
  window(t0, t1, t = this.t) { return t0 <= t1 ? t >= t0 && t < t1 : t >= t0 || t < t1; }
  /** 0..1 progress through [t0, t1) or -1 outside it. */
  progress(t0, t1, t = this.t) { if (!this.window(t0, t1, t)) return -1; const len = (t1 - t0 + this.duration) % this.duration || this.duration; return ((t - t0 + this.duration) % this.duration) / len; }
  /** Per-repetition deviation helper: fn(iteration) -> value (e.g. which door a patrol uses this time). */
  variant(fn) { return fn(this.iteration); }

  /** Hazard test: fn(loop) returns falsy, or a message (string/true) to rewind the loop. */
  hazard(fn) { this.hazards.push(fn); return fn; }
  /** Objects do not keep changes: listed props are restored at every wrap and reset. */
  track(obj, props = ['position', 'rotation', 'visible'], onRestore) {
    const snap = {};
    for (const p of props) { const v = obj[p]; snap[p] = v && v.clone ? v.clone() : v; }
    this.tracked.push({ obj, snap, onRestore }); return obj;
  }
  restoreTracked() {
    for (const { obj, snap, onRestore } of this.tracked) {
      for (const p in snap) { const v = snap[p]; if (v && v.clone && obj[p]?.copy) obj[p].copy(v); else obj[p] = v; }
      onRestore?.(obj);
    }
  }

  // ---------- knowledge (kept across resets) ----------
  knows(key) { return this.knowledge.some(k => k.key === key) || (this.persist && (this.game.flags.loopKnowledge?.[this.id] || []).includes(key)); }
  learn(key, text, opts = {}) {
    if (this.knowledge.some(k => k.key === key)) return false;
    this.knowledge.push({ key, text, at: this.game.time });
    if (this.persist) { const l = this.game.flags.loopKnowledge[this.id]; if (!l.includes(key)) l.push(key); }
    if (opts.time !== undefined && !this.markers.some(m => m.key === key)) this.markers.push({ time: opts.time, key, warn: !!opts.warn });
    if (!opts.silent) { this.game.audio.sfxPlay('anomaly'); this.pulse(); }
    this.renderHud(key);
    return true;
  }
  get known() { return this.knowledge.length; }

  // ---------- music memory layer ----------
  setLayer(n) { this.layer = Math.max(0, Math.min(this.maxLayer, n)); this.syncState(); }
  syncState() { if (loopState.active === this) Object.assign(loopState, { t: this.t, iteration: this.iteration, layer: this.layer, duration: this.duration }); }

  onReset(fn) { this._onReset.push(fn); return fn; }
  onWrap(fn) { this._onWrap.push(fn); return fn; }

  inside() { return !this.region || this.region(this.game.player.pos); }

  // ---------- per frame ----------
  update(dt) {
    const g = this.game;
    if (g.scene !== this.scene) { this.dispose(); return; }
    const inside = this.inside();
    this.showHud(this.running && inside && this.hudWanted !== false);
    if (!this.running || this.paused || this._resetting) return;
    if (this.frozen) { this.renderTime(); return; }
    const prev = this.t;
    this.t += dt;
    // events (handle large dt: fire every event crossed this frame, across a wrap too)
    this.fireRange(prev, Math.min(this.t, this.duration));
    if (this.t >= this.duration) { this.wrap(); this.fireRange(0, this.t); }
    this.syncState();
    this.renderTime();
    // hazards (only while the player is in the loop and has control)
    if (inside && g.control && !g.ui.dlgActive) {
      for (const h of this.hazards) { const r = h(this); if (r) { this.reset(typeof r === 'string' ? r : null); break; } }
    }
  }

  fireRange(a, b) {
    for (const e of this.events) {
      if (e.fired || e.time < a || e.time >= b) continue;
      e.fired = true;
      if (e.opts.learn && (!e.opts.when || e.opts.when())) this.learn(e.opts.learn[0], e.opts.learn[1], { time: e.time, warn: e.opts.warn });
      try { e.fn?.(this); } catch (err) { console.error(err); }
    }
  }

  wrap() {
    this.t -= this.duration; if (this.t > this.duration) this.t = 0;
    this.iteration++;
    for (const e of this.events) e.fired = false;
    this.restoreTracked();
    for (const f of this._onWrap) try { f(this.iteration, this); } catch (err) { console.error(err); }
    this.pulse();
  }

  /** Rewind the loop: soft fade (no flash), restart the sequence at t = 0, player back at the restart point. */
  async reset(reason) {
    if (this._resetting) return;
    const g = this.game, fx = g.engine.fx;
    this._resetting = true; this.resets++;
    g.control = false;
    g.audio.sfxPlay('rewind');
    if (reason) g.ui.toast(reason, 2200);
    g.touch?.buzz?.([20, 40, 20]);
    // gentle temporal ripple + fade (Comfort Mode: no white flash)
    let k = 0; const off = g.onUpdate(dt => { k = Math.min(1, k + dt * 2.2); fx.uShift.value = Math.sin(k * Math.PI) * 0.35; });
    await g.ui.fade(1, 420);
    off(); fx.uShift.value = 0;
    this.t = 0; this.iteration++;
    for (const e of this.events) e.fired = false;
    this.restoreTracked();
    if (this.restart) { const [x, y, z, yaw] = this.restart; g.player.place(x, y, z, yaw ?? 0); }
    this.setLayer(this.layer + 1);
    for (const f of this._onReset) try { f(this.resets, this); } catch (err) { console.error(err); }
    await new Promise(r => setTimeout(r, 260));
    await g.ui.fade(0, 520);
    if (this.resets === 1 && this.resetToast) g.ui.toast(this.resetToast, 4200);
    this._resetting = false;
    if (g.scene === this.scene) g.control = true;
  }

  // ---------- HUD ----------
  buildHud() {
    injectStyle();
    const host = document.getElementById('hud') || document.body;
    const el = this.hud = document.createElement('div'); el.className = 'loop-hud';
    el.innerHTML = `<div class="lh-ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" class="lh-bg"/><circle cx="32" cy="32" r="27" class="lh-fg"/><g class="lh-marks"></g></svg><div class="lh-time">0:00</div></div>
      <div class="lh-side"><div class="lh-label"></div><div class="lh-iter"></div><div class="lh-know"></div></div>`;
    el.querySelector('.lh-label').textContent = this.label;
    host.appendChild(el);
    this.$fg = el.querySelector('.lh-fg'); this.$time = el.querySelector('.lh-time'); this.$iter = el.querySelector('.lh-iter');
    this.$know = el.querySelector('.lh-know'); this.$marks = el.querySelector('.lh-marks');
    this.renderHud();
    // remove the HUD if the mission is torn down without a dispose()
    this._watch = setInterval(() => { if (this.game.scene !== this.scene) this.dispose(); }, 1000);
  }
  showHud(on) { if (!this.hud) return; if (on !== this._shown) { this._shown = on; this.hud.classList.toggle('on', on); } }
  pulse() { if (!this.hud) return; this.hud.classList.remove('pulse'); void this.hud.offsetWidth; this.hud.classList.add('pulse'); }
  renderTime() {
    if (!this.hud || !this._shown) return;
    const k = Math.max(0, Math.min(1, this.t / this.duration));
    this.$fg.style.strokeDashoffset = 170 * (1 - k);
    const txt = fmt(this.t); if (txt !== this._lastTxt) { this._lastTxt = txt; this.$time.textContent = txt; }
    const it = 'LOOP ' + this.iteration + (this.frozen ? ' · HELD' : ''); if (it !== this._lastIt) { this._lastIt = it; this.$iter.textContent = it; }
  }
  renderHud(newKey) {
    if (!this.hud) return;
    const show = this.knowledge.slice(-this.maxKnown);
    this.$know.style.display = show.length ? '' : 'none';
    this.$know.innerHTML = '';
    for (const k of show) { const d = document.createElement('div'); d.textContent = k.text; if (k.key === newKey) d.className = 'new'; this.$know.appendChild(d); }
    // markers for learned timings on the ring
    let svg = '';
    for (const m of this.markers) {
      if (!this.knows(m.key)) continue;
      const a = (m.time / this.duration) * Math.PI * 2, x0 = 32 + Math.cos(a) * 22, y0 = 32 + Math.sin(a) * 22, x1 = 32 + Math.cos(a) * 31, y1 = 32 + Math.sin(a) * 31;
      svg += `<line class="lh-mark${m.warn ? ' warn' : ''}" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`;
    }
    this.$marks.innerHTML = svg;
    this.renderTime();
  }
}

/**
 * Drive an actor through an authored routine that repeats with a loop (an NPC who "lives" the loop).
 *   loopRoutine(loop, actor, [ { t: 0, pos: [x, y, z] }, { t: 3, pos: [...], ry }, { t: 5, pos: [...], pose: 'reach' } ])
 * Between keys the actor walks in a straight line (speed from distance / time so the legs match the ground);
 * when standing it faces `ry` (or keeps its heading). keys may be a function (iteration) => keys for deviations.
 * Returns a stop() function.
 */
export function loopRoutine(loop, actor, keys) {
  const g = loop.game;
  const get = () => (typeof keys === 'function' ? keys(loop.iteration) : keys);
  return g.onUpdate((dt) => {
    if (!loop.running || loop.paused) return;
    const K = get(); if (!K.length) return;
    const t = loop.t;
    let i = K.length - 1; for (let j = 0; j < K.length; j++) if (K[j].t <= t) i = j;
    const a = K[i], b = K[(i + 1) % K.length];
    const tb = b.t > a.t ? b.t : b.t + loop.duration, span = tb - a.t;
    const k = span > 0 ? Math.max(0, Math.min(1, ((t < a.t ? t + loop.duration : t) - a.t) / span)) : 1;
    const ax = a.pos[0], az = a.pos[2], bx = b.pos[0], bz = b.pos[2];
    const moving = (Math.abs(bx - ax) + Math.abs(bz - az)) > 0.05 && !a.hold;
    const r = actor.root;
    if (moving) {
      r.position.set(ax + (bx - ax) * k, a.pos[1] + (b.pos[1] - a.pos[1]) * k, az + (bz - az) * k);
      actor.speed = Math.hypot(bx - ax, bz - az) / Math.max(0.1, span);
      actor.faceTowards(bx, bz, dt, 8);
    } else {
      r.position.set(ax, a.pos[1], az); actor.speed = 0;
      if (a.ry !== undefined) { let d = a.ry - r.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); r.rotation.y += d * Math.min(1, dt * 5); }
    }
    actor.pose = a.pose || null;
    if (a.bark && a._said !== loop.iteration) { a._said = loop.iteration; a.bark(loop.iteration); }
  });
}
