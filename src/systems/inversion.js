// Inversion (shared system; owner: M11 The Inverted Hospital).
// Bible: "Inverted state: temporarily reverses selected processes, subject to energy and stability limits."
// "Reverse selected motion or mechanism · Local and readable; no universal rewind of all consequences."
// Visual language: "debris returning to impact points, reflections moving out of sync, gravity changing only in
// readable zones. Keep gameplay silhouettes clear."
//
//   import { Inversion } from '../systems/inversion.js';
//   const inv = new Inversion(game, { cost: 0.25, duration: 4.5, range: 7 });
//   const z = inv.zone({ id: 'corridor', min: [14, 0, 1], max: [46, 3.2, 7], dir: -1, label: 'EAST CORRIDOR',
//                        doors: [{ at: [14, 4], axis: 'x', width: 4 }] });   // readable threshold bands (chevrons)
//   const tr = inv.track(mesh, { from: [x, y, z], to: [x, y, z], arc: 1.2, spin: [0, 3, 0],   // u = 0 original, 1 landed
//                        schedule: [2, 3, 1.2, 0.8],    // hold landed · return to origin · hold origin · fall again
//                        hazard: { radius: 0.8, msg: 'THE GURNEY CAME BACK' }, label: 'gurney', zone: z });
//   const d = inv.track(panel, { from, to, drift: true, u: 1, latch: true });   // rests at u=1; an inversion returns it
//   inv.unlock();                       // shows the INVERT touch button and the X key hint
//   inv.invert(tr)                      // what X / INVERT does to the selected track (picked automatically)
//   const s = inv.sound({ pos: [x, y, z], maxD: 34 });   // inverted acoustics: quieter as you approach (reversed zone)
//   inv.onInvert = (track) => ...       inv.onHit = (track) => ...   (default: game.fail(hazard.msg))
//
// A track's local clock runs through its schedule; an inversion runs that clock backward for `duration` seconds,
// so a returning hazard falls back to where it landed and a fallen object climbs back to where it was. Only the
// selected track changes: nothing else in the room rewinds. Every selectable track shows a faint path line to its
// origin while Kai is near, so the player can read where it will go.
import * as THREE from 'three';
import { touchButton } from './combat.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _a = V(), _b = V(), _f = V();
const ease = x => x * x * (3 - 2 * x);
export const INV_COLORS = { reverse: 0xa8d8ff, forward: 0xffd8a0, select: 0xc8e8ff };

let styled = false;
function injectStyle() {
  if (styled) return; styled = true;
  const s = document.createElement('style');
  s.textContent = `
  #touch .tc-btn.cb-invert{width:58px;height:58px;right:calc(172px + var(--sr,0px));bottom:calc(92px + var(--sb,0px));color:#c8e8ff;border-color:rgba(168,216,255,.6)}
  #touch .tc-btn.cb-invert.hide{display:none}
  #touch .tc-btn.cb-invert span{font:700 9px var(--ui,system-ui);letter-spacing:.16em}
  .inv-badge{position:absolute;right:22px;top:118px;padding:5px 10px;border-radius:6px;background:rgba(14,18,24,.62);border:1px solid rgba(168,216,255,.35);
    font:700 11px var(--ui,system-ui);letter-spacing:.24em;color:#d8ecff;pointer-events:none;opacity:0;transition:opacity .6s}
  .inv-badge.on{opacity:1}.inv-badge.fwd{color:#ffe2bc;border-color:rgba(255,216,160,.35)}
  .inv-pulse{position:absolute;left:50%;bottom:96px;width:64px;height:64px;margin:0 0 0 -32px;border-radius:50%;pointer-events:none;
    border:2px solid rgba(200,232,255,.0);opacity:0}
  .inv-meter{position:absolute;left:50%;bottom:118px;transform:translateX(-50%);display:flex;gap:4px;align-items:center;pointer-events:none;opacity:0;transition:opacity .6s;
    font:700 10px var(--ui,system-ui);letter-spacing:.24em;color:#d8ecff}
  .inv-meter.on{opacity:1}.inv-meter i{display:block;width:6px;border-radius:2px;background:rgba(216,236,255,.18);transition:height .2s,background .2s}
  .inv-meter i.on{background:#d8ecff;box-shadow:0 0 6px rgba(216,236,255,.6)}`;
  document.head.appendChild(s);
}

function chevronTexture(color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const g = c.getContext('2d'); g.clearRect(0, 0, 128, 32);
  g.strokeStyle = '#' + new THREE.Color(color).getHexString(); g.lineWidth = 5; g.lineCap = 'round';
  for (let k = 0; k < 4; k++) { const x = 10 + k * 32; g.beginPath(); g.moveTo(x, 5); g.lineTo(x + 12, 16); g.lineTo(x, 27); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Inversion {
  constructor(game, o = {}) {
    this.game = game; this.o = o;
    this.cost = o.cost ?? 0.25; this.duration = o.duration ?? 4.5; this.range = o.range ?? 7; this.cooldown = o.cooldown ?? 1.2;
    this.key = o.key || 'KeyX'; this.unlocked = !!o.unlocked; this.cool = 0; this.uses = 0;
    this.zones = []; this.tracks = []; this.sounds = []; this.selected = null;
    this.onInvert = o.onInvert || null; this.onHit = o.onHit || null; this.onRefuse = o.onRefuse || null;
    this.enabled = true; this.hazardsOn = true; this.t = 0;
    injectStyle();
    const hud = document.getElementById('hud') || document.body;
    this.badge = document.createElement('div'); this.badge.className = 'inv-badge'; hud.appendChild(this.badge);
    this.meter = document.createElement('div'); this.meter.className = 'inv-meter';
    this.meter.innerHTML = '<b style="margin-right:6px">SOUND</b>' + Array.from({ length: 10 }, (_, i) => `<i style="height:${6 + i * 1.6}px"></i>`).join('');
    hud.appendChild(this.meter); this.bars = [...this.meter.querySelectorAll('i')];
    this.pulseEl = document.createElement('div'); this.pulseEl.className = 'inv-pulse'; hud.appendChild(this.pulseEl);
    this.btn = touchButton(game, 'cb-invert', 'INVERT', this.key, '<svg viewBox="0 0 24 24"><path d="M4 8h12l-3-3M20 16H8l3 3"/></svg>');
    // the selection marker: a ring under the picked track and a path line back to its origin
    const scene = game.scene;
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 6, 40), new THREE.MeshBasicMaterial({ color: INV_COLORS.select, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }));
    this.ring.rotation.x = Math.PI / 2; this.ring.visible = false; this.ring.renderOrder = 5; scene.add(this.ring);
    this.lineGeo = new THREE.BufferGeometry(); this.lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 24), 3));
    this.line = new THREE.Line(this.lineGeo, new THREE.LineDashedMaterial({ color: INV_COLORS.reverse, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.7, toneMapped: false, depthWrite: false }));
    this.line.visible = false; this.line.frustumCulled = false; scene.add(this.line);
    this.off = game.onUpdate((dt) => this.update(dt));
  }

  unlock(on = true) { this.unlocked = on; this.btn?.classList.toggle('hide', !on || !this.game.touch?.enabled); }

  /** A readable zone: an AABB that runs forward (dir 1) or reversed (dir -1, or a function of time). */
  zone(o) {
    const z = { id: o.id, label: o.label || '', min: V(...o.min), max: V(...o.max), dirFn: typeof o.dir === 'function' ? o.dir : null, dir0: typeof o.dir === 'number' ? o.dir : -1, bands: [], tint: null };
    z.dir = () => (z.dirFn ? z.dirFn(this.t) : z.dir0);
    z.contains = (p, pad = 0) => p.x > z.min.x - pad && p.x < z.max.x + pad && p.z > z.min.z - pad && p.z < z.max.z + pad && p.y > z.min.y - 1 && p.y < z.max.y;
    const scene = this.game.scene;
    for (const d of o.doors || []) {   // threshold bands: chevrons that scroll the way time runs in the room
      const tex = chevronTexture(0xffffff); tex.repeat.set(Math.max(1, Math.round(d.width / 1.0)), 1);
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: INV_COLORS.reverse, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(d.width, d.depth || 0.7), mat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = d.axis === 'x' ? Math.PI / 2 : 0;
      if (d.flip) m.rotation.z += Math.PI;
      m.position.set(d.at[0], (d.y ?? 0) + 0.015, d.at[1]); m.renderOrder = 3; m.userData.noBatch = true; scene.add(m);
      // a faint membrane in the opening (reads as "the air is different in there")
      const mem = new THREE.Mesh(new THREE.PlaneGeometry(d.width, d.height || 2.6), new THREE.MeshBasicMaterial({ color: INV_COLORS.reverse, transparent: true, opacity: 0.06, toneMapped: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      mem.position.set(d.at[0], (d.y ?? 0) + (d.height || 2.6) / 2, d.at[1]); mem.rotation.y = d.axis === 'x' ? Math.PI / 2 : 0; mem.userData.noBatch = true; scene.add(mem);
      z.bands.push({ m, mat, tex, mem });
    }
    this.zones.push(z); return z;
  }
  zoneAt(p) { for (let i = this.zones.length - 1; i >= 0; i--) if (this.zones[i].contains(p)) return this.zones[i]; return null; }
  dirAt(p) { const z = this.zoneAt(p); return z ? z.dir() : 1; }

  /**
   * A motion that can run backward. u = 0 is the original position (before 08:14), u = 1 where it ended up.
   *   from / to / arc / spin       pose by interpolation (or pose(u, obj) for anything else)
   *   schedule [hL, r, h0, f]      cycling hazard: hold landed, return (1→0), hold at origin, fall again (0→1)
   *   drift: true, u, latch        rests at its end; an inversion carries it the other way (latch: stays there)
   *   hazard { radius, height, msg, pos() }   touching it while it moves fails back to the checkpoint
   *   collide [sx, sy, sz]         a collision box that follows the object
   */
  track(obj, o = {}) {
    const tr = { obj, o, label: o.label || 'motion', zone: o.zone || null, selectable: o.selectable !== false, u: o.u ?? (o.drift ? 1 : 1), prevU: 0, inv: 0, done: false, enabled: true, speed: 0 };
    if (o.from) tr.from = V(...o.from); if (o.to) tr.to = V(...o.to);
    tr.rot0 = obj.rotation.clone();
    if (o.schedule) { tr.sched = o.schedule; tr.period = o.schedule.reduce((a, b) => a + b, 0); tr.clock = ((o.phase ?? 0) % tr.period + tr.period) % tr.period; tr.u = this.schedU(tr, tr.clock); }
    tr.driftRate = o.driftRate ?? 1 / Math.max(0.3, o.dur ?? 1.2);
    if (o.collide) tr.box = this.game.collision.add([0, -10, 0], [0, -9, 0]);
    tr.prevU = tr.u; this.pose(tr, tr.u);
    this.tracks.push(tr); return tr;
  }
  schedU(tr, c) {
    const [hL, r, h0] = tr.sched; const f = tr.sched[3];
    if (c < hL) return 1;
    if (c < hL + r) return 1 - ease((c - hL) / r);
    if (c < hL + r + h0) return 0;
    return ease((c - hL - r - h0) / f);
  }
  /** Seconds until the track starts its next move (0 while moving). */
  nextMove(tr) {
    if (!tr.sched) return 0;
    const [hL, r, h0] = tr.sched, c = tr.clock;
    if (c < hL) return hL - c; if (c < hL + r) return 0; if (c < hL + r + h0) return hL + r + h0 - c; return 0;
  }
  pose(tr, u) {
    const { obj, o } = tr;
    if (o.pose) { o.pose(u, obj, tr); }
    else if (tr.from && tr.to) {
      obj.position.lerpVectors(tr.from, tr.to, u);
      if (o.arc) obj.position.y += Math.sin(u * Math.PI) * o.arc;
      if (o.spin) obj.rotation.set(tr.rot0.x + o.spin[0] * u, tr.rot0.y + o.spin[1] * u, tr.rot0.z + o.spin[2] * u);
    }
    if (tr.box) {
      const s = o.collide, p = obj.getWorldPosition(_a);
      tr.box.min.set(p.x - s[0] / 2, p.y + (o.collideY ?? 0), p.z - s[2] / 2); tr.box.max.set(p.x + s[0] / 2, p.y + (o.collideY ?? 0) + s[1], p.z + s[2] / 2);
    }
  }
  worldPos(tr, out = V()) { return tr.o.hazard?.pos ? out.copy(tr.o.hazard.pos(tr)) : tr.obj.getWorldPosition(out); }

  ready() { return this.unlocked && this.cool <= 0 && this.game.temporal.stability >= this.cost; }
  /** Reverse the selected motion for `duration` seconds (costs stability). */
  invert(tr = this.selected, opts = {}) {
    const g = this.game, T = g.temporal;
    if (!tr || !this.unlocked) { if (this.unlocked && !opts.silent) { g.ui.toast('NOTHING TO INVERT IN REACH', 1200); this.onRefuse?.('none'); } return false; }
    if (this.cool > 0 && !opts.free) return false;
    if (!opts.free && T.stability < this.cost) { g.ui.toast('STABILITY TOO LOW TO INVERT', 1500); g.audio.sfxPlay('fail'); this.onRefuse?.('stability'); return false; }
    if (!opts.free) T.stability = Math.max(0, T.stability - this.cost);
    tr.inv = opts.duration ?? tr.o.invertFor ?? this.duration; this.cool = this.cooldown; this.uses++;
    g.audio.sfxPlay('rewind'); if (g.engine.fx?.uShift) g.engine.fx.uShift.value = 0.3;
    if (g.player.char) g.player.char.wristBoost = 8;
    g.touch?.buzz?.(18);
    this.onInvert?.(tr); tr.o.onInvert?.(tr);
    return true;
  }

  /** Inverted acoustics: in a reversed zone a sound gets quieter as you approach its source. */
  sound(o) {
    const s = { pos: V(...o.pos), maxD: o.maxD ?? 30, r0: o.r0 ?? 1.0, period: o.period ?? 1.0, acc: 0, gain: 0, d: 99, on: o.on ?? true, inverted: o.inverted ?? (() => true), play: o.play || null, freq: o.freq ?? 988, vol: o.vol ?? 0.22, meter: o.meter !== false };
    this.sounds.push(s); return s;
  }
  gainOf(s, p) {
    const d = Math.hypot(p.x - s.pos.x, (p.y + 1.2 - s.pos.y) * 0.5, p.z - s.pos.z); s.d = d;
    const k = Math.max(0, Math.min(1, (d - s.r0) / (s.maxD - s.r0)));
    return s.inverted() ? 0.04 + 0.96 * Math.pow(k, 0.8) : Math.max(0, 1 - k);
  }

  update(dt) {
    const g = this.game, pl = g.player, p = pl.pos;
    this.t += dt; this.cool = Math.max(0, this.cool - dt);
    const allow = g.control && !g.ui.dlgActive && !g.overlayOpen;
    // tracks
    for (const tr of this.tracks) {
      if (!tr.enabled) continue;
      tr.prevU = tr.u;
      const back = tr.inv > 0; if (back) tr.inv = Math.max(0, tr.inv - dt);
      const zr = tr.zone ? Math.abs(tr.zone.dir()) : 1, rate = (tr.o.rate ?? 1) * zr;
      if (tr.sched) {
        if (!tr.frozen) { tr.clock = ((tr.clock + (back ? -dt : dt) * rate) % tr.period + tr.period) % tr.period; tr.u = this.schedU(tr, tr.clock); }
      } else if (tr.o.drift) {
        if (!tr.done) {
          const goal = back ? 0 : 1;   // a drift rests where it landed; an inversion carries it to its origin
          tr.u += Math.sign(goal - tr.u) * Math.min(Math.abs(goal - tr.u), dt * tr.driftRate * rate);
          if (tr.o.latch && tr.u <= 0.0001) { tr.u = 0; tr.done = true; tr.o.onLatch?.(tr); }
        }
      } else if (tr.o.step) tr.o.step(dt, tr, back);
      if (tr.u !== tr.prevU) this.pose(tr, tr.u);
      tr.speed = Math.abs(tr.u - tr.prevU) / Math.max(dt, 1e-4);
      // hazard
      const hz = tr.o.hazard;
      if (hz && this.hazardsOn && allow && !g._failing && tr.speed > (hz.minSpeed ?? 0.05)) {
        const w = this.worldPos(tr, _a), r = hz.radius ?? 0.7;
        if (Math.hypot(w.x - p.x, w.z - p.z) < r && w.y > p.y - 0.4 && w.y < p.y + (hz.height ?? 2.0)) {
          if (this.onHit) this.onHit(tr); else g.fail(hz.msg || 'IT CAME BACK');
        }
      }
    }
    // selection: the nearest selectable track in front of Kai, within range
    let best = null, bs = Infinity;
    if (this.unlocked && this.enabled) {
      _f.set(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
      for (const tr of this.tracks) {
        if (!tr.enabled || !tr.selectable || tr.done || (tr.o.canInvert && !tr.o.canInvert(tr))) continue;
        const w = this.worldPos(tr, _a); _b.set(w.x - p.x, 0, w.z - p.z); const d = _b.length();
        if (d > (tr.o.range ?? this.range)) continue;
        const dot = d > 0.01 ? _b.normalize().dot(_f) : 1; if (dot < 0.35 && d > 1.6) continue;
        const sc = d * (1.6 - dot); if (sc < bs) { bs = sc; best = tr; }
      }
    }
    this.selected = best;
    if (best && !g.cine) {
      const w = this.worldPos(best, _a);
      this.ring.visible = true; this.ring.position.set(w.x, Math.max(p.y, w.y - 0.6) + 0.04, w.z);
      this.ring.scale.setScalar(1 + Math.sin(this.t * 5) * 0.06); this.ring.material.opacity = best.inv > 0 ? 1 : this.ready() ? 0.85 : 0.35;
      // path line back to its origin (where it goes if time runs back)
      const arr = this.lineGeo.attributes.position.array, n = 24;
      for (let i = 0; i < n; i++) {
        const u = best.u * (1 - i / (n - 1));
        if (best.from && best.to) { _b.lerpVectors(best.from, best.to, u); if (best.o.arc) _b.y += Math.sin(u * Math.PI) * best.o.arc; if (best.obj.parent && best.obj.parent !== g.scene) best.obj.parent.localToWorld(_b); }
        else _b.copy(w);
        arr[i * 3] = _b.x; arr[i * 3 + 1] = _b.y; arr[i * 3 + 2] = _b.z;
      }
      this.lineGeo.attributes.position.needsUpdate = true; this.line.computeLineDistances(); this.line.visible = !!(best.from && best.to);
    } else { this.ring.visible = false; this.line.visible = false; }
    if (this.unlocked && allow && g.input.hit(this.key)) this.invert(best);
    if (this.btn) { this.btn.classList.toggle('hide', !this.unlocked || !g.touch?.enabled); this.btn.style.opacity = this.ready() && best ? '' : '0.45'; }
    // zone visuals and the HUD badge
    const here = this.zoneAt(p);
    for (const z of this.zones) {
      const d = z.dir(), col = d < 0 ? INV_COLORS.reverse : INV_COLORS.forward;
      for (const b of z.bands) { b.tex.offset.x -= dt * 0.8 * d; b.mat.color.setHex(col); b.mem.material.color.setHex(col); b.mem.material.opacity = 0.05 + Math.sin(this.t * 1.7) * 0.015; }
    }
    if (here && here.label && !g.cine) {
      const rev = here.dir() < 0; this.badge.textContent = (rev ? '◁◁ REVERSED · ' : '▷ FORWARD · ') + here.label;
      this.badge.classList.add('on'); this.badge.classList.toggle('fwd', !rev);
    } else this.badge.classList.remove('on');
    // sounds (+ an accessible visual pulse for the clue tone)
    let meterG = -1;
    for (const s of this.sounds) {
      if (!s.on) continue;
      s.gain = this.gainOf(s, p);
      if (s.meter) meterG = Math.max(meterG, s.gain);
      s.acc += dt; if (s.acc < s.period) continue; s.acc = 0;
      if (s.play) s.play(s.gain, s);
      else if (g.audio.ctx && s.gain > 0.05) { const a = g.audio.ctx.currentTime; g.audio.tone(s.freq, 0.13, 'sine', s.vol * s.gain, g.audio.sfx, a, 0.004); g.audio.tone(s.freq * 2, 0.06, 'sine', s.vol * 0.25 * s.gain, g.audio.sfx, a, 0.002); }
      if (s.meter && !g.cine) this.flash(s.gain);
    }
    if (meterG >= 0 && !g.cine) { this.meter.classList.add('on'); const n = Math.round(meterG * 10); this.bars.forEach((b, i) => b.classList.toggle('on', i < n)); }
    else this.meter.classList.remove('on');
  }
  flash(gn) {
    const el = this.pulseEl; if (!el.animate) return;
    el.animate([{ opacity: 0.55 * gn, transform: 'scale(0.6)', borderColor: `rgba(200,232,255,${0.7 * gn})` }, { opacity: 0, transform: `scale(${1.2 + gn * 1.1})`, borderColor: 'rgba(200,232,255,0)' }], { duration: 700, easing: 'ease-out' });
  }
  setHazards(on) { this.hazardsOn = on; }
  remove(tr) { tr.enabled = false; if (tr.box) tr.box.enabled = false; }
  dispose() {
    this.off?.(); this.btn?.classList.add('hide');
    this.badge.remove(); this.meter.remove(); this.pulseEl.remove();
    this.ring.parent?.remove(this.ring); this.line.parent?.remove(this.line);
    for (const z of this.zones) for (const b of z.bands) { b.m.parent?.remove(b.m); b.mem.parent?.remove(b.mem); }
    this.sounds.length = 0;
  }
}
