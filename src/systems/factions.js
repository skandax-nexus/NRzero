// Faction support & choices (shared system; owner: M13 The Nine-Minute War).
//
// Bible: "Faction support — Request help, choose routes, resolve optional objectives. Changes mission tactics and
// support, not the core ending eligibility." NPC state: "Faction standing — Neutral / Continuum-aligned /
// Unwritten-sympathetic. Changes optional support, patrol responses and safe routes."
//
//   import { Factions, factionStanding, hasSupport, supportList, standingOf } from '../systems/factions.js';
//   const FX = new Factions(game);                    // the Continuum and the Unwritten by default; o.factions adds more
//   FX.show(true);                                    // HUD: one row per faction, standing -3..+3 as pips
//   FX.adjust('unwritten', +1, 'You freed their medic');  // toast, persists in game.flags.factions
//   FX.get('unwritten') / FX.standing()               // 'neutral' | 'continuum' | 'unwritten' (the bible's three values)
//   FX.offer({ id: 'smoke', faction: 'unwritten', label: 'SMOKE COVER', min: 0, uses: 1, onCall: () => ... });
//                                                     // a support the player can call now: G / touch SUPPORT
//   FX.withdraw('smoke');  FX.call('smoke');          // remove an offer / call it from script (tests)
//   FX.route('north', { continuum: 'Their patrols wave you through', unwritten: null })  // pick a route by standing
//   FX.grant('sable-civilians', 'sera', 'The freed Sable residents guide you through Rain City')   // later missions
//   FX.record('m13', 'free');                         // a faction-relevant choice, flags.factionChoices.m13
//   FX.dispose();
//
// Later missions only need the flags: factionStanding(game.flags), standingOf(game.flags, 'continuum'),
// hasSupport(game.flags, 'unwritten-sappers'), supportList(game.flags).
import { touchButton } from './combat.js';

export const FACTIONS = {
  continuum: { name: 'CONTINUUM', short: 'CONTINUUM', color: '#ffd27a', glyph: '✦', blurb: 'One permanent timeline. Order through fixed points.' },
  unwritten: { name: 'THE UNWRITTEN', short: 'UNWRITTEN', color: '#ff8f6a', glyph: '✕', blurb: 'Break the network. No history gets to be final.' },
};
const MIN = -3, MAX = 3;

/** 'continuum' | 'unwritten' | 'neutral' from stored flags (the side Kai leans to by at least 2 points). */
export function factionStanding(flags = {}) {
  const f = flags.factions || {}, c = f.continuum || 0, u = f.unwritten || 0;
  if (u - c >= 2 && u > 0) return 'unwritten';
  if (c - u >= 2 && c > 0) return 'continuum';
  return 'neutral';
}
export const standingOf = (flags = {}, id) => (flags.factions || {})[id] || 0;
export const supportList = (flags = {}) => (flags.factionSupport || []).slice();
export const hasSupport = (flags = {}, id) => supportList(flags).some(s => s.id === id);

function injectStyle() {
  if (document.getElementById('fx-hud-style')) return;
  const st = document.createElement('style'); st.id = 'fx-hud-style';
  st.textContent = `
  .fx-hud{position:absolute;left:28px;top:112px;display:flex;flex-direction:column;gap:5px;pointer-events:none;opacity:0;transition:opacity .5s;font-family:var(--ui,system-ui)}
  .fx-hud.on{opacity:1}
  .fx-row{display:flex;align-items:center;gap:5px}
  .fx-row b{font:700 10px var(--ui,system-ui);letter-spacing:.26em;min-width:92px;color:var(--fx)}
  .fx-row b i{font-style:normal;margin-right:6px}
  .fx-pip{width:9px;height:9px;transform:rotate(45deg);border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.06);transition:background .4s,border-color .4s}
  .fx-pip.mid{width:3px;height:9px;transform:none;border:none;background:rgba(255,255,255,.25)}
  .fx-pip.pos{background:var(--fx);border-color:var(--fx);box-shadow:0 0 6px var(--fx)}
  .fx-pip.neg{background:#8a2a2a;border-color:#ff6a6a}
  .fx-row.bump{animation:fxbump 1.1s}
  @keyframes fxbump{0%{transform:translateX(8px);filter:brightness(1.8)}100%{transform:none;filter:none}}
  .fx-offer{margin-top:3px;font:600 11px var(--ui,system-ui);letter-spacing:.16em;color:#e8eef2;opacity:0;transition:opacity .3s;white-space:nowrap}
  .fx-offer.on{opacity:1}
  .fx-offer kbd{font:700 10px var(--ui,system-ui);border:1px solid rgba(255,255,255,.45);border-radius:3px;padding:1px 5px;margin-right:6px}
  html.touch .fx-offer kbd{display:none}
  #touch .tc-btn.fx-support{width:56px;height:56px;right:calc(330px + var(--sr,0px));bottom:calc(14px + var(--sb,0px));color:#ff8f6a;border-color:rgba(255,143,106,.6)}
  #touch .tc-btn.fx-support.hide{display:none}
  #touch .tc-btn.fx-support span{font:700 8px var(--ui,system-ui);letter-spacing:.14em}
  html.touch .fx-hud{left:calc(14px + var(--sl,0px));top:calc(150px + var(--st,0px))}
  html.touch .fx-row b{min-width:74px;font-size:9px}
  @media (max-height:430px){html.touch .fx-hud{top:auto;bottom:calc(150px + var(--sb,0px))}}`;
  document.head.appendChild(st);
}

export class Factions {
  constructor(game, o = {}) {
    this.game = game; this.o = o;
    this.defs = { ...FACTIONS, ...(o.factions || {}) };
    const F = game.flags;
    F.factions = F.factions || {};
    for (const id of Object.keys(this.defs)) if (F.factions[id] === undefined) F.factions[id] = 0;
    F.factionSupport = F.factionSupport || [];
    F.factionChoices = F.factionChoices || {};
    this.offers = []; this.log = [];
    injectStyle(); this.buildHud();
    this.btn = touchButton(game, 'fx-support', 'SUPPORT', 'KeyG', '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>');
    this.off = game.onUpdate(dt => this.update(dt));
    this.save();
  }

  buildHud() {
    const hud = document.getElementById('hud') || document.body;
    hud.querySelector('.fx-hud')?.remove();
    const el = document.createElement('div'); el.className = 'fx-hud';
    this.rows = {};
    for (const [id, d] of Object.entries(this.defs)) {
      const row = document.createElement('div'); row.className = 'fx-row'; row.style.setProperty('--fx', d.color);
      row.innerHTML = `<b><i>${d.glyph}</i>${d.short || d.name}</b>`;
      const pips = [];
      for (let v = MIN; v <= MAX; v++) { const p = document.createElement('span'); p.className = 'fx-pip' + (v === 0 ? ' mid' : ''); p.dataset.v = v; row.appendChild(p); pips.push(p); }
      el.appendChild(row); this.rows[id] = { row, pips };
    }
    const off = document.createElement('div'); off.className = 'fx-offer'; el.appendChild(off); this.offerEl = off;
    hud.appendChild(el); this.hud = el; this.paint();
  }
  show(on = true) { this.shown = on; this.hud.classList.toggle('on', on); }
  paint() {
    for (const [id, r] of Object.entries(this.rows)) {
      const v = this.get(id);
      for (const p of r.pips) { const pv = +p.dataset.v; if (pv === 0) continue; p.classList.toggle('pos', v > 0 && pv > 0 && pv <= v); p.classList.toggle('neg', v < 0 && pv < 0 && pv >= v); }
    }
  }

  get(id) { return this.game.flags.factions[id] || 0; }
  standing() { return factionStanding(this.game.flags); }
  /** Change standing with a faction (clamped -3..+3); a short toast names the reason. */
  adjust(id, delta, reason = '') {
    if (!this.defs[id] || !delta) return this.get(id);
    const F = this.game.flags, before = this.get(id);
    F.factions[id] = Math.max(MIN, Math.min(MAX, before + delta));
    const d = this.defs[id], v = F.factions[id];
    this.log.push({ id, delta, reason, t: this.game.time });
    if (v !== before) {
      this.game.ui.toast(`${d.glyph} ${d.short || d.name} · STANDING ${delta > 0 ? '+' : '−'}${Math.abs(delta)}${reason ? ' · ' + reason.toUpperCase() : ''}`, 2600);
      const r = this.rows[id]; if (r) { r.row.classList.remove('bump'); void r.row.offsetWidth; r.row.classList.add('bump'); }
    }
    this.paint(); this.save(); this.o.onChange?.(id, v, delta);
    return v;
  }
  /** Is this faction friendly enough (>= min) for a support or a safe route? */
  allows(id, min = 0) { return this.get(id) >= min; }
  hostile(id) { return this.get(id) <= -2; }

  // ------------------------------------------------------------- support the player can call now
  offer(s) {
    this.withdraw(s.id);
    const o = { min: 0, uses: 1, cooldown: 0, ...s, cool: 0, used: 0 };
    this.offers.push(o); this.update(); return o;
  }
  withdraw(id) { this.offers = this.offers.filter(o => o.id !== id); this.update(); }
  available() { return this.offers.filter(o => o.used < o.uses && o.cool <= 0 && this.get(o.faction) >= o.min && (!o.enabled || o.enabled())); }
  call(id) {
    const o = id ? this.offers.find(x => x.id === id) : this.available()[0];
    if (!o) return false;
    if (o.used >= o.uses || o.cool > 0) { this.game.ui.toast('SUPPORT NOT READY', 1400); return false; }
    if (this.get(o.faction) < o.min) { this.game.ui.toast(`${this.defs[o.faction].short} WON'T HELP YOU YET`, 1800); this.game.audio.sfxPlay('fail'); return false; }
    if (o.enabled && !o.enabled()) { this.game.ui.toast(o.why || 'NOT FROM HERE', 1600); return false; }
    o.used++; o.cool = o.cooldown;
    this.game.audio.sfxPlay('blip');
    this.game.flags.factionCalls = (this.game.flags.factionCalls || 0) + 1;
    o.onCall?.(o);
    this.update();
    return true;
  }
  update(dt = 0) {
    const g = this.game;
    for (const o of this.offers) if (o.cool > 0) o.cool = Math.max(0, o.cool - dt);
    const av = this.available(), first = av[0];
    const show = !!first && this.shown && g.control !== false;
    if (this.offerEl) {
      this.offerEl.classList.toggle('on', show);
      if (first) { const txt = `<kbd>G</kbd>${this.defs[first.faction].glyph} ${first.label}${first.uses > 1 ? ' · ' + (first.uses - first.used) : ''}`; if (this.offerEl._t !== txt) { this.offerEl.innerHTML = txt; this.offerEl._t = txt; } }
    }
    if (this.btn) this.btn.classList.toggle('hide', !show || !g.touch?.enabled);
    if (show && g.control && !g.ui.dlgActive && !g.overlayOpen && g.input.hit('KeyG')) this.call(first.id);
  }

  // ------------------------------------------------------------- routes, choices and persistent support
  /** Pick the first route whose faction allows it: route('name', { continuum: 'id', unwritten: 'id' }, fallback). */
  route(name, byFaction, fallback = null) {
    let best = null, bv = -99;
    for (const [id, r] of Object.entries(byFaction)) { if (r == null) continue; const v = this.get(id); if (v >= 1 && v > bv) { bv = v; best = r; } }
    const pick = best ?? fallback;
    const F = this.game.flags; F.factionRoutes = F.factionRoutes || {}; F.factionRoutes[name] = pick; return pick;
  }
  record(key, value) { this.game.flags.factionChoices[key] = value; this.save(); }
  grant(id, faction, label) {
    const F = this.game.flags;
    if (!F.factionSupport.some(s => s.id === id)) F.factionSupport.push({ id, faction, label });
    this.save();
  }
  revoke(id) { const F = this.game.flags; F.factionSupport = F.factionSupport.filter(s => s.id !== id); this.save(); }
  save() { this.game.flags.factionStanding = this.standing(); }

  dispose() {
    this.off?.(); this.offers = []; this.show(false); this.btn?.classList.add('hide'); this.save();
  }
}
