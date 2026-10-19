import { CAST } from '../story/cast.js';
import { touchText } from './touch.js';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class UI {
  constructor(game) {
    this.game = game; this.portraits = {}; this.evidence = [];
    this.dlgActive = false; this._adv = null; this._choice = null;
    const advance = () => { if (this._adv) this._adv(); };
    addEventListener('keydown', e => {
      if (!this.dlgActive) return;
      if (this._choice) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= this._choice.n) this._choice.pick(n - 1);
        if (e.code === 'ArrowDown' || e.code === 'KeyS') this._choice.move(1);
        if (e.code === 'ArrowUp' || e.code === 'KeyW') this._choice.move(-1);
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') this._choice.pick(this._choice.sel);
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') advance();
    });
    // Click or tap anywhere advances dialogue, except on real controls and menus.
    document.addEventListener('pointerdown', e => {
      const g = this.game;
      if (!this.dlgActive || this._choice || g.paused || g.journalOpen || e.button > 0) return;
      if (e.target.closest?.('button, input, select, label, a, #pause, #journal, #title, #puzzle')) return;
      advance();
    });
  }

  // Mission text names keyboard keys; touch players get touch wording.
  words(text) { return this.game.touch?.enabled ? touchText(text) : text; }

  show(id, on = true) { $(id).classList.toggle('hidden', !on); }

  // ---------- HUD ----------
  objective(text) {
    $('objective-text').textContent = text || '';
    $('objective').style.visibility = text ? 'visible' : 'hidden';
    const o = $('objective'); o.classList.remove('flash'); void o.offsetWidth; if (text) o.classList.add('flash');
  }
  missionTag(t) { $('mission-tag').textContent = t; }
  prompt(text, hold = 0) {
    this.game.touch?.setPrompt(text, hold);
    if (!text) { this.show('prompt', false); return; }
    $('prompt-text').textContent = text; this.show('prompt', true);
    $('hold-bar').firstElementChild.style.width = (hold * 100) + '%';
  }
  toast(text, ms = 2600) {
    const t = $('toast'); t.textContent = this.words(text); t.classList.add('show');
    clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.remove('show'), ms);
  }
  era(name, year, glyph, keys, color) {
    $('era-name').textContent = name; $('era-year').textContent = year; $('era-glyph').textContent = glyph || '◎';
    $('era-keys').innerHTML = (keys || []).map(k => `<span class="${k.on ? 'on' : ''}">${k.key} ${k.label}</span>`).join('');
    const c = color || '#5fe6ff';
    $('stab-arc').style.stroke = c; $('era-glyph').style.color = c; $('era-glyph').style.textShadow = `0 0 12px ${c}`;
  }
  stability(v) { $('stab-arc').style.strokeDashoffset = 170 * (1 - Math.max(0, Math.min(1, v))); }
  detection(v) {
    this.show('detect', v > 0.01);
    $('detect-fill').style.width = (Math.min(1, v) * 100) + '%';
  }
  residue(on) { this.show('residue-hint', on); }

  // ---------- screen ----------
  async fade(to, ms = 1200) { const f = $('fade'); f.style.transitionDuration = ms + 'ms'; f.style.opacity = to; await sleep(ms); }
  flash(ms = 120) { const f = $('flash'); f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, ms); }
  letterbox(on) { $('letterbox').classList.toggle('on', on); }
  async chapterCard(act, title, sub, ms = 4200) {
    $('cc-act').textContent = act; $('cc-title').textContent = title; $('cc-sub').textContent = sub || '';
    const c = $('chapter-card'); c.classList.remove('hidden'); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    c.style.opacity = 1; c.style.transition = 'opacity 1s';
    await sleep(ms); c.style.opacity = 0; await sleep(1000); c.classList.add('hidden');
  }

  // ---------- dialogue ----------
  setSpeaker(id) {
    const def = CAST[id] || { name: id.toUpperCase(), role: '' };
    $('dlg-name').textContent = def.name; $('dlg-role').textContent = def.role || '';
    const pid = def.portraitOf || id;
    const wrap = $('portrait-wrap');
    wrap.classList.toggle('voice', !!def.voice);
    wrap.classList.toggle('hidden', !this.portraits[pid] && !def.voice);
    if (this.portraits[pid]) $('portrait').src = this.portraits[pid];
    const ch = this.game.actors?.[id];
    if (ch) this._talker = ch; else this._talker = null;
  }

  async typeText(text) {
    const el = $('dlg-text'); el.textContent = '';
    let skip = false; this._adv = () => { skip = true; };
    for (let i = 0; i < text.length; i++) {
      if (skip || this.game.autoplay) { el.textContent = text; break; }
      el.textContent = text.slice(0, i + 1);
      if (this._talker) this._talker.talk = 0.25;
      if (i % 3 === 0 && text[i] !== ' ') this.game.audio.sfxPlay('blip');
      await sleep(/[.,!?—]/.test(text[i]) ? 70 : 22);
    }
    if (this._talker) this._talker.talk = 0.5;
  }

  async say(id, text, opts = {}) {
    this.dlgActive = true; this.show('dialogue', true);
    this.setSpeaker(id);
    $('dlg-choices').innerHTML = ''; $('dlg-next').style.visibility = 'hidden';
    await this.typeText(text);
    $('dlg-next').style.visibility = 'visible';
    await new Promise(res => {
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      this._adv = fin; if (opts.auto) setTimeout(fin, opts.auto * 1000);
      if (this.game.autoplay) setTimeout(fin, 250);
    });
    this._adv = null;
    if (!opts.keep) { this.show('dialogue', false); this.dlgActive = false; }
  }

  async talk(lines) { for (let i = 0; i < lines.length; i++) await this.say(lines[i][0], lines[i][1], { keep: i < lines.length - 1, ...(lines[i][2] || {}) }); }

  async choice(id, text, options) {
    this.dlgActive = true; this.show('dialogue', true); this.setSpeaker(id);
    $('dlg-next').style.visibility = 'hidden';
    await this.typeText(text);
    const box = $('dlg-choices'); box.innerHTML = '';
    const btns = options.map((o, i) => { const b = document.createElement('button'); b.innerHTML = `<b>${i + 1}</b>${o}`; box.appendChild(b); return b; });
    this.game.input.unlock();
    const idx = await new Promise(res => {
      const ch = this._choice = { n: options.length, sel: 0, pick: i => res(i), move: d => { ch.sel = (ch.sel + d + ch.n) % ch.n; btns.forEach((b, j) => b.classList.toggle('sel', j === ch.sel)); } };
      ch.move(0);
      if (this.game.autoplay) setTimeout(() => res(this.game.autoChoice || 0), 300);
      btns.forEach((b, i) => b.addEventListener('click', e => { e.stopPropagation(); res(i); }));
    });
    this._choice = null; box.innerHTML = '';
    this.show('dialogue', false); this.dlgActive = false;
    return idx;
  }

  // Non-blocking spoken subtitle (barks, voices)
  subtitle(id, text, ms = 3500) {
    const def = CAST[id] || { name: id };
    const s = $('subtitle'); s.innerHTML = (id ? `<b>${def.name}</b>` : '') + text; this.show('subtitle', true);
    const ch = this.game.actors?.[id]; if (ch) ch.talk = Math.min(ms / 1000, 3);
    clearTimeout(this._subT); this._subT = setTimeout(() => this.show('subtitle', false), ms);
    return sleep(ms);
  }

  // ---------- case board ----------
  addEvidence(title, text, tag = '') {
    if (this.evidence.find(e => e.title === title)) return;
    this.evidence.push({ title, text, tag });
    this.toast('CASE BOARD UPDATED\n' + title.toUpperCase() + '\n[J] to review');
    this.game.audio.sfxPlay('pickup');
  }
  renderJournal() {
    const g = $('journal-grid');
    g.innerHTML = this.evidence.length ? this.evidence.map((e, i) =>
      `<div class="ev" style="--r:${((i * 37) % 7 - 3) * 0.6}deg"><h4>${e.title}</h4><p>${e.text}</p><small>${e.tag}</small></div>`).join('')
      : `<div class="ev empty"><p>${this.words('No evidence yet. Inspect anomalies and use Residue Vision [F] once available.')}</p></div>`;
  }
  toggleJournal(on) {
    if (on) this.renderJournal();
    this.show('journal', on);
  }
}
