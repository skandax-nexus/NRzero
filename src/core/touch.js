// Touch controls for phones and tablets, landscape-first.
//   left thumb   floating analog stick (appears where the thumb lands; push to the rim to sprint)
//   right thumb  drag anywhere to look; action cluster in the bottom-right corner
//   buttons      Interact (contextual, shows the prompt, hold-to-use ring), Jump, Crouch toggle,
//                Residue Vision and era switches (only once unlocked), Case Board, Pause
// Everything feeds Input (virtual keys, analog stick, look radians), so game code is input-agnostic.
// Auto-enabled on touch-first devices and hidden again when a keyboard is used.
// URL ?touch=1 / ?touch=0 forces it on / off (testing on desktop, or keyboard on a tablet).
import { STICK_SPRINT } from './player.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('afterzero.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('afterzero.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const DEAD_ZONE = 0.12;

const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ICON = {
  pause: svg('<path d="M8.5 5.5v13M15.5 5.5v13"/>'),
  board: svg('<rect x="3.5" y="4" width="7" height="7.5" rx="1"/><rect x="13.5" y="4" width="7" height="5" rx="1"/><rect x="13.5" y="12" width="7" height="8" rx="1"/><rect x="3.5" y="14.5" width="7" height="5.5" rx="1"/>'),
  jump: svg('<path d="M6.5 12.5 12 7l5.5 5.5"/><path d="M6.5 18 12 12.5l5.5 5.5" opacity=".55"/>'),
  crouch: svg('<path d="M6.5 6 12 11.5 17.5 6" opacity=".55"/><path d="M6.5 11.5 12 17l5.5-5.5"/>'),
  lamp: svg('<path d="M9 4.5h6l1.6 5H7.4z"/><path d="M8.6 9.5h6.8v2.2H8.6z"/><path d="M12 14.5v2M7.2 15.6l-1.2 1.6M16.8 15.6l1.2 1.6M12 19.5v.5" opacity=".7"/>'),
  residue: svg('<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.1"/>'),
  hand: svg('<path d="M8.2 12.6V6.3a1.45 1.45 0 0 1 2.9 0v5.2M11.1 11.2V4.9a1.45 1.45 0 0 1 2.9 0v6.3M14 11.4V6.6a1.45 1.45 0 0 1 2.9 0v7.2c0 4.1-2.6 6.9-6.1 6.9-2.3 0-3.8-1-5-2.8l-2.3-3.6a1.4 1.4 0 0 1 2.3-1.6l2.4 2.6"/>'),
};

// Keyboard wording in mission text, rewritten for touch players.
const TOUCH_TEXT = [
  [/WASD move\s*·\s*SHIFT sprint\s*·\s*MOUSE look\s*·\s*E interact\s*·\s*J case board/i, 'LEFT THUMB move · push to the rim to sprint\nRIGHT THUMB look · HAND button interacts'],
  [/1 · 2026\s+2 · 2049\s+3 · 2196\s+\(Q cycles\)/, 'Tap 2026 · 2049 · 2196 on the right'],
  [/\s*\(hold E\)/gi, ''],
  [/\[J\] to review/gi, 'CASE BOARD button to review'],
  [/\bPress F to\b/g, 'Tap the EYE to'],
  [/Residue Vision \[F\]/g, 'Residue Vision (EYE button)'],
  [/\bC to crouch\b/g, 'CROUCH button'],
  [/\bPress E\b/g, 'Tap the HAND'],
];
export function touchText(s) { let t = String(s ?? ''); for (const [re, rep] of TOUCH_TEXT) t = t.replace(re, rep); return t; }

function matches(q) { try { return window.matchMedia(q).matches; } catch { return false; } }
export function touchPreferred() {
  return matches('(pointer: coarse)') || ((window.navigator.maxTouchPoints || 0) > 0 && !matches('(pointer: fine)'));
}

// Fullscreen + landscape lock. Must run inside a user gesture; every step may be refused
// (iPhone Safari has no element fullscreen, iframes need allowfullscreen), and that is fine.
export function enterImmersive() {
  const lockLandscape = () => { try { window.screen?.orientation?.lock?.('landscape')?.catch?.(() => {}); } catch { /* unsupported */ } };
  try {
    const el = document.documentElement, doc = document;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req && !(doc.fullscreenElement || doc.webkitFullscreenElement)) {
      const p = req.call(el, { navigationUI: 'hide' });
      if (p && p.then) p.then(lockLandscape, () => {}); else lockLandscape();
    } else lockLandscape();
  } catch { /* refused */ }
}
export function fullscreenAvailable() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen) && (document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true);
}

export class TouchControls {
  constructor(game) {
    this.game = game; this.input = game.input;
    const q = new URLSearchParams(location.search).get('touch');
    this.forced = q === '1' ? true : q === '0' ? false : null;
    this.enabled = false;
    this.sensitivity = store.get('lookSens', 1);
    this.haptics = store.get('haptics', true);
    this.buttons = new Map();    // pointerId -> { kind, el }
    this.stickId = null; this.lookId = null; this.stickR = 56;
    this.origin = { x: 0, y: 0 }; this.lookLast = { x: 0, y: 0 };
    this.promptText = null; this.promptHold = 0; this.shown = {}; this.swallowClick = false;
    this.eraKey = ''; this.lastEra = null;
    this.build();
    this.bind();
    this.setEnabled(this.forced ?? touchPreferred());
  }

  // ---------- DOM ----------
  build() {
    const root = this.root = document.createElement('div');
    root.id = 'touch'; root.className = 'hidden';
    root.innerHTML = `
      <div class="tc-stick idle"><div class="tc-base"><div class="tc-knob"></div></div></div>
      <div class="tc-top">
        <button class="tc-btn tc-small" data-tc="board" aria-label="Case board">${ICON.board}</button>
        <button class="tc-btn tc-small" data-tc="pause" aria-label="Pause">${ICON.pause}</button>
      </div>
      <div class="tc-eras"></div>
      <button class="tc-btn tc-residue hidden" data-tc="residue" aria-label="Residue Vision">${ICON.residue}<span>RESIDUE</span></button>
      <button class="tc-btn tc-lamp hidden" data-tc="lamp" aria-label="Shoulder lamp">${ICON.lamp}<span>LAMP</span></button>
      <button class="tc-btn tc-crouch" data-tc="crouch" aria-label="Crouch">${ICON.crouch}<span>CROUCH</span></button>
      <button class="tc-btn tc-jump" data-tc="jump" aria-label="Jump">${ICON.jump}<span>JUMP</span></button>
      <div class="tc-act">
        <div class="tc-act-label" data-tc="interact"><b></b><i>HOLD</i></div>
        <button class="tc-btn tc-interact" data-tc="interact" aria-label="Interact">
          <svg class="tc-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46"/><circle class="p" cx="50" cy="50" r="46" pathLength="100"/></svg>
          ${ICON.hand}
        </button>
      </div>`;
    $('app').appendChild(root);
    const q = s => root.querySelector(s);
    this.el = {
      stick: q('.tc-stick'), base: q('.tc-base'), knob: q('.tc-knob'), eras: q('.tc-eras'),
      residue: q('.tc-residue'), lamp: q('.tc-lamp'), crouch: q('.tc-crouch'), jump: q('.tc-jump'),
      act: q('.tc-act'), label: q('.tc-act-label b'), ring: q('.tc-ring .p'),
    };
  }

  bind() {
    this.root.addEventListener('pointerdown', e => this.onDown(e), { passive: false });
    addEventListener('pointermove', e => this.onMove(e), { passive: true });
    addEventListener('pointerup', e => this.release(e.pointerId));
    addEventListener('pointercancel', e => this.release(e.pointerId));
    addEventListener('blur', () => this.releaseAll());
    addEventListener('pointerdown', () => { this.swallowClick = false; }, true);   // a new gesture
    addEventListener('click', e => { if (this.swallowClick) { this.swallowClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
    // switch modes with the device actually in use (2-in-1 laptops, tablets with keyboards)
    addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !this.enabled && this.forced !== false) this.setEnabled(true); }, true);
    addEventListener('keydown', e => { if (this.enabled && this.forced !== true && MOVE_KEYS.has(e.code)) this.setEnabled(false); });
    // no long-press menus, pinch-zoom or double-tap zoom during play
    document.addEventListener('contextmenu', e => { if (this.enabled) e.preventDefault(); });
    for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, e => e.preventDefault());
    // turning the phone to portrait mid-play pauses behind the rotate prompt
    try {
      const mq = window.matchMedia('(orientation: portrait)');
      const onTurn = () => { if (mq.matches && this.enabled) { this.releaseAll(); this.game.autoPause?.(); } };
      mq.addEventListener ? mq.addEventListener('change', onTurn) : mq.addListener(onTurn);
    } catch { /* no matchMedia */ }
    addEventListener('resize', () => this.layout());
    this.layout();
  }

  layout() {
    const s = Math.min(window.innerWidth, window.innerHeight);
    this.stickR = clamp(Math.round(s * 0.15), 44, 72);
    this.root.style.setProperty('--stick-r', this.stickR + 'px');
  }

  setEnabled(on) {
    this.enabled = on; this.input.touchMode = on;
    document.documentElement.classList.toggle('touch', on);
    if (on) this.input.unlock(); else { this.releaseAll(); this.root.classList.add('hidden'); }
  }

  // ---------- pointers ----------
  onDown(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse' && this.forced !== true) { this.setEnabled(false); return; }
    e.preventDefault();   // no emulated mouse events, no focus, no text selection
    const btn = e.target.closest('[data-tc]');
    if (btn) { this.pressButton(btn, e.pointerId); return; }
    const W = window.innerWidth, H = window.innerHeight, x = e.clientX, y = e.clientY;
    if (this.stickId === null && x < W * 0.42 && y > H * 0.2) this.startStick(e);
    else if (this.lookId === null) { this.lookId = e.pointerId; this.lookLast.x = x; this.lookLast.y = y; this.input.lookActive = true; }
  }

  onMove(e) {
    if (e.pointerId === this.stickId) this.moveStick(e.clientX, e.clientY);
    else if (e.pointerId === this.lookId) {
      const dx = e.clientX - this.lookLast.x, dy = e.clientY - this.lookLast.y;
      this.lookLast.x = e.clientX; this.lookLast.y = e.clientY;
      // a drag across the long side of the screen turns the camera ~225 degrees
      const k = this.sensitivity * 1.25 * Math.PI / Math.max(window.innerWidth, window.innerHeight);
      this.input.addLook(dx * k, dy * k * 0.8);
    }
  }

  release(id) {
    if (id === this.stickId) {
      this.stickId = null; this.input.setStick(0, 0, 0);
      this.el.stick.classList.add('idle'); this.el.stick.classList.remove('sprint');
      this.el.base.style.transform = ''; this.el.knob.style.transform = '';
    } else if (id === this.lookId) {
      this.lookId = null; this.input.lookActive = false;
    } else {
      const b = this.buttons.get(id); if (!b) return;
      this.buttons.delete(id); b.el.classList.remove('down');
      if (b.kind === 'interact' && ![...this.buttons.values()].some(o => o.kind === 'interact')) this.input.hold('KeyE', false);
    }
  }
  releaseAll() {
    for (const id of [this.stickId, this.lookId, ...this.buttons.keys()]) if (id !== null) this.release(id);
  }

  startStick(e) {
    const R = this.stickR, W = window.innerWidth, H = window.innerHeight;
    this.stickId = e.pointerId;
    this.origin.x = clamp(e.clientX, R + 12, W * 0.42);
    this.origin.y = clamp(e.clientY, R + 12, H - R - 12);
    this.el.stick.classList.remove('idle');
    this.moveStick(e.clientX, e.clientY);
  }

  moveStick(x, y) {
    const R = this.stickR, o = this.origin;
    let dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy);
    if (d > R * 1.6) {            // the base follows a thumb that wanders off, so the stick never sticks
      const k = (d - R * 1.6) / d; o.x += dx * k; o.y += dy * k;
      dx = x - o.x; dy = y - o.y; d = R * 1.6;
    }
    const m = Math.min(1, d / R), mag = m < DEAD_ZONE ? 0 : (m - DEAD_ZONE) / (1 - DEAD_ZONE);
    const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : 0;
    this.input.setStick(nx * mag, -ny * mag, mag);
    this.el.base.style.transform = `translate(${o.x - R}px,${o.y - R}px)`;
    this.el.knob.style.transform = `translate(${nx * m * R}px,${ny * m * R}px)`;
    this.el.stick.classList.toggle('sprint', mag >= STICK_SPRINT && !this.game.player.crouching);
  }

  pressButton(btn, id) {
    const kind = btn.dataset.tc, g = this.game, inp = this.input;
    const el = kind === 'interact' ? this.root.querySelector('.tc-interact') : btn;
    this.buttons.set(id, { kind, el }); el.classList.add('down');
    // the browser follows a tap with a click at the same spot; when the button just opened an
    // overlay there (case board, pause menu), that click must not land on the overlay
    this.swallowClick = true;
    switch (kind) {
      case 'interact': inp.hold('KeyE', true); break;
      case 'jump': inp.press('Space'); break;
      case 'crouch': inp.press('KeyC'); break;
      case 'residue': inp.press('KeyF'); break;
      case 'lamp': inp.press('KeyL'); break;
      case 'era': {
        const T = g.temporal;
        if (T.current !== btn.dataset.id && !T.canSwitch(btn.dataset.id)) this.buzz([30, 40, 30]);
        inp.press('Digit' + btn.dataset.key);
        break;
      }
      case 'board':
        if (g.journalOpen) g.toggleJournal(false);
        else if (g.running && !g.paused && !g.ui.dlgActive && !g.overlayOpen) g.toggleJournal(true);
        break;
      case 'pause':
        if (!g.running || g.overlayOpen || g.ui._choice) break;
        if (g.journalOpen) g.toggleJournal(false);
        g.pause(!g.paused);
        break;
    }
  }

  // ---------- per-frame sync with game state ----------
  setPrompt(text, hold = 0) { this.promptText = text || null; this.promptHold = hold; }

  update() {
    const g = this.game, root = this.root;
    if (!this.enabled) return;
    const playing = g.running && !g.titleUpdate && $('title').classList.contains('hidden');
    this.toggle(root, 'hidden', !playing);
    if (!playing) { if (this.stickId !== null || this.lookId !== null || this.buttons.size) this.releaseAll(); return; }
    const allow = g.control && !g.ui.dlgActive && !g.overlayOpen && !g.paused && !g.journalOpen;
    this.toggle(root, 'tc-locked', !allow);
    this.toggle(root, 'tc-modal', g.paused || g.journalOpen || g.overlayOpen);

    // contextual interact button
    const text = allow ? this.promptText : null;
    this.toggle(this.el.act, 'show', !!text);
    if (text && text !== this.shown.text) {
      this.el.label.textContent = touchText(text);
      this.toggle(this.el.act, 'hold', /\bhold\b/i.test(text));
    }
    this.shown.text = text;
    const hold = Math.round((text ? this.promptHold : 0) * 100);
    if (hold !== this.shown.hold) { this.el.ring.style.strokeDashoffset = 100 - hold; this.shown.hold = hold; }

    this.toggle(this.el.crouch, 'on', g.player.crouching);
    this.toggle(this.el.residue, 'hidden', !g.residueUnlocked);
    this.toggle(this.el.residue, 'on', !!g.residueOn);
    this.toggle(this.el.lamp, 'hidden', !g.lampAvailable);
    this.toggle(this.el.lamp, 'on', !!g.lampOn);
    this.syncEras();
  }

  syncEras() {
    const T = this.game.temporal;
    const defs = T.unlocked && T.defs.length > 1 ? T.defs : [];
    const key = defs.map(d => `${d.id}:${d.key}:${d.year}:${d.color}`).join('|');
    if (key !== this.eraKey) {
      this.eraKey = key;
      this.el.eras.innerHTML = defs.map(d =>
        `<button class="tc-btn tc-era" data-tc="era" data-id="${d.id}" data-key="${d.key}" style="--era:${d.color || '#5fe6ff'}" aria-label="Switch to ${d.name} ${d.year}">` +
        `<small>${d.glyph || '◎'}</small><b>${d.year}</b></button>`).join('');
    }
    if (defs.length) {
      const low = T.stability < 0.18 || T.switching;
      for (const b of this.el.eras.children) { this.toggle(b, 'on', b.dataset.id === T.current); this.toggle(b, 'low', low); }
      if (this.lastEra && this.lastEra !== T.current) this.buzz(28);
    }
    this.lastEra = T.current;
  }

  toggle(el, cls, on) { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }

  // ---------- haptics ----------
  buzz(pattern) {
    const nav = window.navigator;
    if (!this.enabled || !this.haptics || !nav.vibrate) return;
    if (nav.userActivation && !nav.userActivation.hasBeenActive) return;   // browsers block it before a tap
    try { nav.vibrate(pattern); } catch { /* unsupported */ }
  }

  setSensitivity(v) { this.sensitivity = v; store.set('lookSens', v); }
  setHaptics(on) { this.haptics = on; store.set('haptics', on); if (on) this.buzz(15); }
}
