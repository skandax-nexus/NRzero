// Temporal State Switching: authored states of one location (never unrestricted date selection).
export class Temporal {
  constructor(game) {
    this.game = game; this.defs = []; this.current = 'default'; this.unlocked = false;
    this.stability = 1; this.objects = []; this.switching = false; this.listeners = [];
  }
  reset() { this.defs = []; this.current = 'default'; this.unlocked = false; this.objects = []; this.listeners = []; this.stability = 1; this.locked = false; }

  configure(defs, initial) {
    this.defs = defs; this.current = initial; this.applyVisibility();
    const d = this.def(); d?.apply?.(true); this.refreshHud();
  }
  def(id = this.current) { return this.defs.find(d => d.id === id); }
  // tag an object as existing only in some states
  only(obj, ...states) { obj.userData.states = states; this.objects.push(obj); obj.visible = states.includes(this.current); return obj; }
  onSwitch(fn) { this.listeners.push(fn); }
  applyVisibility() { for (const o of this.objects) o.visible = o.userData.states.includes(this.current); }

  refreshHud() {
    const d = this.def(); if (!d) return;
    this.game.ui.era(d.name, d.year, d.glyph, this.unlocked ? this.defs.map(x => ({ key: x.key, label: x.year, on: x.id === this.current })) : [], d.color);
  }

  setImmediate(id) {
    const prev = this.current; this.current = id; this.applyVisibility(); this.def()?.apply?.(false, prev);
    for (const l of this.listeners) l(id, prev); this.refreshHud();
    if (this.def()?.theme) this.game.audio.setTheme(this.def().theme, 0.3);
  }

  canSwitch(id) {
    return this.unlocked && !this.switching && !this.locked && id !== this.current && this.def(id) && this.stability >= 0.18;
  }

  async switchTo(id, opts = {}) {
    if (!opts.force && !this.canSwitch(id)) {
      if (this.unlocked && this.stability < 0.18) { this.game.ui.toast('CHRONOLITH STABILITY LOW'); this.game.audio.sfxPlay('fail'); }
      return false;
    }
    const g = this.game, fx = g.engine.fx;
    this.switching = true; if (!opts.free) this.stability -= 0.22;
    g.audio.sfxPlay('switch');
    if (g.player?.char.wrist) g.player.char.wristBoost = 6;
    const t0 = performance.now(), dur = opts.dur || 900;
    await new Promise(res => {
      let swapped = false;
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        fx.uShift.value = Math.sin(k * Math.PI);
        if (!swapped && k >= 0.5) {
          swapped = true; const prev = this.current; this.current = id;
          this.applyVisibility(); this.def()?.apply?.(false, prev);
          for (const l of this.listeners) l(id, prev);
          g.ui.flash(90); this.refreshHud();
          if (this.def()?.theme) g.audio.setTheme(this.def().theme, 0.4);
        }
        if (k < 1) requestAnimationFrame(tick); else { fx.uShift.value = 0; res(); }
      };
      tick();
    });
    this.switching = false;
    return true;
  }

  update(dt) {
    const g = this.game;
    this.stability = Math.min(1, this.stability + dt * 0.09);
    g.ui.stability(this.stability);
    if (!this.unlocked || !g.control || g.paused) return;
    for (const d of this.defs) if (g.input.hit('Digit' + d.key)) this.switchTo(d.id);
    if (g.input.hit('KeyQ')) {
      const i = this.defs.findIndex(d => d.id === this.current);
      this.switchTo(this.defs[(i + 1) % this.defs.length].id);
    }
  }
}
