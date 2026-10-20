// Echo Step (shared system; owner: M10 Enemies Who Remember).
// Bible: "brief afterimage that distracts enemies or crosses a dangerous gap; consumes stability."
// "Short duration, cooldown, cannot solve every combat encounter."
//
//   import { EchoStep } from '../systems/echostep.js';
//   const echo = new EchoStep(game, { combat, cost: 0.3, cooldown: 7, linger: 4 });
//   echo.unlock();                          // shows the ECHO touch button and the V key hint
//   echo.gap({ from: [x, y, z], to: [x, y, z], radius: 2.2 });  // an authored crossing (a broken bridge, a field)
//   echo.onStep = (info) => ...             // { from, to, gap } after each step
//   echo.trigger()                          // what V / the ECHO button does
//
// One Echo Step: Kai's afterimage stays where he stood for `linger` seconds (enemies that see it treat it as Kai and
// shoot at it: combat.decoy), while Kai slips up to `dist` metres forward through the same second. Standing at a
// registered gap and facing across it, the step carries him over the gap instead (an arc above the void).
// Costs stability (game.temporal.stability) and has a cooldown; it is refused when stability is too low.
import * as THREE from 'three';
import { touchButton } from './combat.js';

const _f = new THREE.Vector3();

export class EchoStep {
  constructor(game, o = {}) {
    this.game = game; this.o = o; this.combat = o.combat || null;
    this.cost = o.cost ?? 0.3; this.cooldown = o.cooldown ?? 7; this.linger = o.linger ?? 4; this.dist = o.dist ?? 4.2;
    this.key = o.key || 'KeyV'; this.cool = 0; this.unlocked = !!o.unlocked; this.gaps = []; this.uses = 0; this.dash = null;
    this.onStep = o.onStep || null;
    // the afterimage: a ghost of Kai, built once
    this.ghost = null;
    try {
      const look = o.look || game.player.char.p;
      const C = game.player.char.constructor;
      const gh = new C({ ...look, role: 'kai', shadows: false });
      gh.setGhost(o.color ?? 0x5fe6ff); gh.root.visible = false; game.scene.add(gh.root);
      this.ghost = gh;
    } catch (err) { console.warn('echostep ghost', err); }
    this.ghostT = 0;
    this.btn = touchButton(game, 'cb-echo', 'ECHO', this.key, '<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="4" opacity=".45"/><circle cx="15" cy="12" r="5"/><path d="M3 12h2"/></svg>');
    this.off = game.onUpdate((dt) => this.update(dt));
  }
  unlock(on = true) { this.unlocked = on; this.btn?.classList.toggle('hide', !on || !this.game.touch?.enabled); }
  /** Register an authored crossing: standing within radius of `from` and facing `to`, a step carries Kai across. */
  gap(g) { const o = { from: new THREE.Vector3(...g.from), to: new THREE.Vector3(...g.to), radius: g.radius ?? 2.2, enabled: g.enabled || (() => true), id: g.id }; this.gaps.push(o); return o; }
  ready() { return this.unlocked && this.cool <= 0 && this.game.temporal.stability >= this.cost && !this.dash; }

  findGap() {
    const pl = this.game.player, p = pl.pos;
    for (const g of this.gaps) {
      if (!g.enabled()) continue;
      if (Math.hypot(p.x - g.from.x, p.z - g.from.z) > g.radius) continue;
      _f.set(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
      const to = new THREE.Vector3(g.to.x - p.x, 0, g.to.z - p.z).normalize();
      if (_f.dot(to) > 0.35) return g;
    }
    return null;
  }

  trigger() {
    const g = this.game, pl = g.player, T = g.temporal;
    if (!this.unlocked || this.dash) return false;
    if (this.cool > 0) { g.ui.toast('ECHO STEP RECHARGING', 1100); g.audio.sfxPlay('fail'); return false; }
    if (T.stability < this.cost) { g.ui.toast('STABILITY TOO LOW FOR AN ECHO STEP', 1500); g.audio.sfxPlay('fail'); return false; }
    T.stability = Math.max(0, T.stability - this.cost); this.cool = this.cooldown; this.uses++;
    const from = pl.pos.clone();
    // the afterimage holds Kai's last pose where he stood
    if (this.ghost) {
      const gh = this.ghost.root; gh.position.copy(from); gh.rotation.y = pl.yaw; gh.visible = true;
      this.ghost.speed = 0; this.ghost.crouch = pl.crouching ? 1 : 0; this.ghost.frozen = false; this.ghostT = this.linger;
      this.ghost.update(0.016); this.ghost.frozen = true;
    }
    this.decoy = this.combat?.decoy(from, this.linger) || null;
    const gap = this.findGap();
    let to;
    if (gap) to = gap.to.clone();
    else {
      _f.set(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
      to = from.clone().addScaledVector(_f, this.dist);
      // stop short of walls in this state
      const st = T.current;
      for (let k = 0; k < 8 && g.collision.blocked(from, to, from.y + 1.0, st); k++) to.lerp(from, 0.25);
    }
    this.dash = { from, to, t: 0, dur: gap ? 0.75 : 0.32, arc: gap ? 1.6 : 0.15, gap };
    g.audio.sfxPlay('rewind'); g.engine.fx.uShift && (g.engine.fx.uShift.value = 0.45);
    if (pl.char) pl.char.wristBoost = 8;
    g.touch?.buzz?.(20);
    return true;
  }

  update(dt) {
    const g = this.game, pl = g.player;
    this.cool = Math.max(0, this.cool - dt);
    if (this.unlocked && g.control && !g.ui.dlgActive && !g.overlayOpen && g.input.hit(this.key)) this.trigger();
    if (this.btn) { this.btn.classList.toggle('hide', !this.unlocked || !g.touch?.enabled); this.btn.style.opacity = this.ready() ? '' : '0.45'; }
    if (this.dash) {
      const d = this.dash; d.t = Math.min(1, d.t + dt / d.dur);
      const k = d.t < 0.5 ? 2 * d.t * d.t : 1 - Math.pow(-2 * d.t + 2, 2) / 2;
      pl.pos.lerpVectors(d.from, d.to, k); pl.pos.y += Math.sin(d.t * Math.PI) * d.arc; pl.vel.set(0, 0, 0);
      if (g.engine.fx.uShift) g.engine.fx.uShift.value = 0.45 * (1 - d.t);
      if (d.t >= 1) { pl.pos.copy(d.to); pl.vel.set(0, 0, 0); pl.grounded = true; this.dash = null; this.onStep?.({ from: d.from, to: d.to, gap: d.gap }); }
    }
    if (this.ghost && this.ghost.root.visible) {
      this.ghostT -= dt;
      const gm = this.ghost.ghostMat; if (gm?.uniforms?.uAlpha) gm.uniforms.uAlpha.value = Math.max(0, Math.min(1, this.ghostT / 1.2));
      if (gm?.uniforms?.uTime) gm.uniforms.uTime.value += dt;
      if (this.ghostT <= 0) this.ghost.root.visible = false;
    }
  }
  hideGhost() { if (this.ghost) this.ghost.root.visible = false; this.ghostT = 0; }
  dispose() { this.off?.(); this.hideGhost(); this.btn?.classList.add('hide'); }
}
