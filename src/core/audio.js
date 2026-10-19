// Fully procedural WebAudio score + sound design, following the AFTERZERO music bible:
// intimate piano/cello against vast temporal scale; era-specific instrumentation; silence as storytelling.
const N = n => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz

export class AudioEngine {
  constructor() { this.ctx = null; this.theme = null; this.step = 0; this.volume = 0.8; this.started = false; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = this.volume;
    const comp = C.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    this.master.connect(comp).connect(C.destination);
    this.duck = C.createGain(); this.duck.connect(this.master);
    this.music = C.createGain(); this.music.gain.value = 0.55; this.music.connect(this.duck);
    this.sfx = C.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.duck);
    this.amb = C.createGain(); this.amb.gain.value = 0.7; this.amb.connect(this.duck);
    // reverb
    this.verb = C.createConvolver(); this.verb.buffer = this.impulse(3.6, 2.4);
    this.verbSend = C.createGain(); this.verbSend.gain.value = 0.7;
    this.verbSend.connect(this.verb).connect(this.duck);
    this.noiseBuf = this.makeNoise(3);
    this.layers = {};
    this.nextTime = C.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 60);
    this.started = true;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }

  impulse(sec, decay) {
    const C = this.ctx, len = C.sampleRate * sec, b = C.createBuffer(2, len, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  makeNoise(sec) {
    const C = this.ctx, b = C.createBuffer(1, C.sampleRate * sec, C.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3; }
    return b;
  }

  // ---------- ambience beds ----------
  bed(name, level, build) {
    if (!this.ctx) return;
    let L = this.layers[name];
    if (!L && level > 0) { L = this.layers[name] = build(); }
    if (L) L.gain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.8);
  }
  rain(level) {
    this.bed('rain', level, () => {
      const C = this.ctx, src = C.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      const g = C.createGain(); g.gain.value = 0;
      src.connect(hp).connect(lp).connect(g).connect(this.amb); src.start();
      // occasional heavy drips
      const drip = setInterval(() => { if (g.gain.value > 0.05) this.tone(2400 + Math.random() * 2000, 0.02, 'sine', 0.03 * g.gain.value, this.amb); }, 140);
      return { gain: g, stop: () => { src.stop(); clearInterval(drip); } };
    });
  }
  wind(level) {
    this.bed('wind', level, () => {
      const C = this.ctx, src = C.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = 0.5;
      const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.8;
      const lfo = C.createOscillator(); lfo.frequency.value = 0.08; const lg = C.createGain(); lg.gain.value = 250; lfo.connect(lg).connect(bp.frequency); lfo.start();
      const g = C.createGain(); g.gain.value = 0; src.connect(bp).connect(g).connect(this.amb); src.start();
      return { gain: g };
    });
  }
  hum(level, f = 55) {
    this.bed('hum', level, () => {
      const C = this.ctx, g = C.createGain(); g.gain.value = 0;
      for (const [m, a] of [[1, 0.5], [2, 0.25], [3.01, 0.1]]) { const o = C.createOscillator(); o.frequency.value = f * m; const og = C.createGain(); og.gain.value = a * 0.25; o.connect(og).connect(g); o.start(); }
      const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; g.connect(lp).connect(this.amb);
      return { gain: g };
    });
  }
  water(level) {
    this.bed('water', level, () => {
      const C = this.ctx, src = C.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const bp = C.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 1200;
      const g = C.createGain(); g.gain.value = 0; src.connect(bp).connect(g).connect(this.amb); src.start();
      return { gain: g };
    });
  }
  crowd(level) {
    this.bed('crowd', level, () => {
      const C = this.ctx, src = C.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = 0.7;
      const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 2.5;
      const g = C.createGain(); g.gain.value = 0; src.connect(bp).connect(g).connect(this.amb); src.start();
      return { gain: g };
    });
  }
  allBeds(level = 0) { for (const k in this.layers) this.layers[k].gain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.5); }

  // ---------- instruments ----------
  tone(f, dur, type = 'sine', vol = 0.2, out = this.sfx, t = this.ctx.currentTime, attack = 0.005) {
    const C = this.ctx, o = C.createOscillator(), g = C.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05); return { o, g };
  }
  piano(n, t, vel = 0.5, dur = 2.6) {
    const C = this.ctx, f = N(n), g = C.createGain(), lp = C.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400 + vel * 2000;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.22, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [m, a] of [[1, 1], [2, 0.42], [3, 0.18], [4.01, 0.08], [5.02, 0.04]]) {
      const o = C.createOscillator(); o.frequency.value = f * m * (1 + (Math.random() - 0.5) * 0.0015);
      const og = C.createGain(); og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + dur);
    }
    g.connect(lp); lp.connect(this.music); const s = C.createGain(); s.gain.value = 0.55; lp.connect(s).connect(this.verbSend);
  }
  pad(notes, t, dur, vol = 0.05, bright = 900) {
    const C = this.ctx, g = C.createGain(), lp = C.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = bright; lp.Q.value = 0.4;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur);
    for (const n of notes) for (const d of [-6, 6]) {
      const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = N(n); o.detune.value = d;
      o.connect(g); o.start(t); o.stop(t + dur + 0.1);
    }
    g.connect(lp); lp.connect(this.music); lp.connect(this.verbSend);
  }
  cello(n, t, dur, vol = 0.07) {
    const C = this.ctx, o = C.createOscillator(), g = C.createGain(), lp = C.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = N(n);
    const v = C.createOscillator(); v.frequency.value = 5.2; const vg = C.createGain(); vg.gain.value = N(n) * 0.006; v.connect(vg).connect(o.frequency);
    lp.type = 'lowpass'; lp.frequency.value = 650;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.5); g.gain.setValueAtTime(vol, t + dur - 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(lp).connect(g); g.connect(this.music); g.connect(this.verbSend);
    o.start(t); v.start(t); o.stop(t + dur + 0.1); v.stop(t + dur + 0.1);
  }
  flute(n, t, dur, vol = 0.05) {
    const C = this.ctx, o = C.createOscillator(), g = C.createGain();
    o.frequency.value = N(n);
    const v = C.createOscillator(); v.frequency.value = 4.6; const vg = C.createGain(); vg.gain.value = N(n) * 0.008; v.connect(vg).connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.15); g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(this.music); g.connect(this.verbSend);
    // breath
    const b = C.createBufferSource(); b.buffer = this.noiseBuf; const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = N(n) * 2; bp.Q.value = 6;
    const bg = C.createGain(); bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(vol * 0.6, t + 0.08); bg.gain.linearRampToValueAtTime(0, t + dur);
    b.connect(bp).connect(bg).connect(this.music);
    o.start(t); v.start(t); b.start(t, Math.random()); o.stop(t + dur + 0.1); v.stop(t + dur + 0.1); b.stop(t + dur + 0.1);
  }
  pluck(n, t, vol = 0.1) {
    const C = this.ctx, o = C.createOscillator(), g = C.createGain(), lp = C.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = N(n); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.4);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(lp).connect(g); g.connect(this.music); g.connect(this.verbSend); o.start(t); o.stop(t + 1.3);
  }
  drum(t, vol = 0.3, f0 = 140, f1 = 50) {
    const C = this.ctx, o = C.createOscillator(), g = C.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.25);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.55);
  }
  tick(t, vol = 0.05, f = 6000, out = this.music) {
    const C = this.ctx, s = C.createBufferSource(); s.buffer = this.noiseBuf;
    const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = f;
    const g = C.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(hp).connect(g).connect(out); s.start(t, Math.random() * 2); s.stop(t + 0.06);
  }
  glass(n, t, vol = 0.05) {
    const C = this.ctx;
    for (const [m, a] of [[1, 1], [2.76, 0.4], [5.4, 0.15]]) {
      const o = C.createOscillator(), g = C.createGain(); o.frequency.value = N(n) * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
      o.connect(g); g.connect(this.music); g.connect(this.verbSend); o.start(t); o.stop(t + 4.1);
    }
  }

  // ---------- generative themes (sixteenth-note scheduler) ----------
  setTheme(name, fade = 1.2) {
    if (!this.ctx || this.theme === name) return;
    const C = this.ctx;
    this.music.gain.cancelScheduledValues(C.currentTime);
    this.music.gain.setTargetAtTime(0, C.currentTime, fade / 4);
    clearTimeout(this._themeT);
    this._themeT = setTimeout(() => {
      this.theme = name; this.step = 0; this.nextTime = this.ctx.currentTime + 0.05;
      this.music.gain.setTargetAtTime(name ? 0.55 : 0, this.ctx.currentTime, 0.6);
    }, fade * 600);
  }

  schedule() {
    if (!this.theme || !this.ctx) return;
    const T = THEMES[this.theme]; if (!T) return;
    const sixteenth = 60 / T.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      try { T.step(this, this.step, this.nextTime, sixteenth); } catch (e) { console.warn(e); }
      this.step++; this.nextTime += sixteenth * (T.swing && this.step % 2 ? 1.08 : 1);
    }
  }

  // ---------- stingers ----------
  sfxPlay(name) {
    if (!this.ctx) return; const C = this.ctx, t = C.currentTime;
    switch (name) {
      case 'switch': {
        const s = C.createBufferSource(); s.buffer = this.noiseBuf; const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4;
        bp.frequency.setValueAtTime(200, t); bp.frequency.exponentialRampToValueAtTime(5000, t + 0.35); bp.frequency.exponentialRampToValueAtTime(120, t + 0.9);
        const g = C.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.3); g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        s.connect(bp).connect(g); g.connect(this.sfx); g.connect(this.verbSend); s.start(t); s.stop(t + 1.1);
        const o = this.tone(70, 1.4, 'sine', 0.5, this.sfx, t + 0.3); o.o.frequency.exponentialRampToValueAtTime(35, t + 1.6);
        this.glass(81, t + 0.3, 0.04); this.glass(88, t + 0.34, 0.03);
        break;
      }
      case 'anomaly': this.glass(76, t, 0.05); this.glass(83, t + 0.12, 0.04); this.glass(79, t + 0.24, 0.04); break;
      case 'pickup': this.tone(880, 0.25, 'triangle', 0.1, this.sfx, t); this.tone(1320, 0.4, 'sine', 0.08, this.sfx, t + 0.08); break;
      case 'success': [72, 76, 79, 84].forEach((n, i) => this.tone(N(n), 0.9, 'triangle', 0.07, this.sfx, t + i * 0.09)); break;
      case 'fail': this.tone(110, 0.6, 'sawtooth', 0.08, this.sfx, t); this.tone(104, 0.6, 'sawtooth', 0.08, this.sfx, t + 0.05); break;
      case 'alarm': for (let i = 0; i < 3; i++) { this.tone(880, 0.18, 'square', 0.05, this.sfx, t + i * 0.36); this.tone(660, 0.18, 'square', 0.05, this.sfx, t + i * 0.36 + 0.18); } break;
      case 'boom': {
        const o = this.tone(90, 2.2, 'sine', 0.9, this.sfx, t); o.o.frequency.exponentialRampToValueAtTime(25, t + 2);
        const s = C.createBufferSource(); s.buffer = this.noiseBuf; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const g = C.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.5); s.connect(lp).connect(g); g.connect(this.sfx); g.connect(this.verbSend); s.start(t); s.stop(t + 2.6);
        break;
      }
      case 'metal': {
        for (const f of [180, 263, 397, 611]) this.tone(f * (0.95 + Math.random() * 0.1), 1.8, 'triangle', 0.08, this.sfx, t);
        this.sfxPlay('boom'); break;
      }
      case 'door': { const o = this.tone(60, 1.0, 'sawtooth', 0.12, this.sfx, t); o.o.frequency.linearRampToValueAtTime(90, t + 0.9); this.tick(t + 0.95, 0.2, 2000, this.sfx); break; }
      case 'step': this.tick(t, 0.035, 900, this.sfx); break;
      case 'blip': this.tone(1800 + Math.random() * 200, 0.025, 'sine', 0.012, this.sfx, t); break;
      case 'clock': this.tick(t, 0.12, 3500, this.sfx); break;
      case 'spark': for (let i = 0; i < 5; i++) this.tick(t + Math.random() * 0.2, 0.2, 3000 + Math.random() * 3000, this.sfx); break;
      case 'heartbeat': this.drum(t, 0.5, 70, 40); this.drum(t + 0.22, 0.35, 65, 38); break;
      case 'motif': [64, 71, 69].forEach((n, i) => this.piano(n, t + i * 0.55, 0.55, 3.5)); break;
      case 'rewind': { const o = this.tone(1600, 0.8, 'sawtooth', 0.04, this.sfx, t); o.o.frequency.exponentialRampToValueAtTime(200, t + 0.7); break; }
      case 'drone': { const o = this.tone(220, 0.4, 'sawtooth', 0.03, this.sfx, t); o.o.frequency.linearRampToValueAtTime(240, t + 0.4); break; }
    }
  }

  // Zero Second: rain, crowd and score all stop.
  silence(sec = 1.2) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setValueAtTime(this.duck.gain.value, t); this.duck.gain.linearRampToValueAtTime(0, t + 0.05);
    if (sec > 0) this.duck.gain.setValueAtTime(0, t + sec), this.duck.gain.linearRampToValueAtTime(1, t + sec + 0.4);
  }
  unsilence() { if (!this.ctx) return; const t = this.ctx.currentTime; this.duck.gain.cancelScheduledValues(t); this.duck.gain.setTargetAtTime(1, t, 0.2); }
}

// Chord helpers (A minor world: the three-note motif E-B-A is Kai & Mira's shared memory)
const PROG = [[45, 57, 60, 64, 71], [41, 57, 60, 64, 69], [48, 55, 60, 64, 67], [43, 55, 59, 62, 67]];
// Missions can add generative themes: registerTheme('name', { bpm, step(a, stepIndex, time, sixteenth) { ... } })
export function registerTheme(name, def) { THEMES[name] = def; }

const THEMES = {
  title: { bpm: 78, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = PROG[bar % 4];
    if (b === 0) { a.pad(ch.slice(1), t, d * 16, 0.035, 700); a.cello(ch[0], t, d * 16, 0.06); }
    if (bar % 2 === 0 && [0, 6, 12].includes(b)) a.piano([76, 83, 81][b / 6], t, 0.42, 4);
    if (bar % 2 === 1 && b % 4 === 2) a.piano(ch[2 + (b >> 2) % 3] + 12, t, 0.22, 3);
  } },
  city: { bpm: 92, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = PROG[(bar >> 1) % 4];
    if (b === 0 && bar % 2 === 0) { a.pad(ch.slice(1, 4), t, d * 32, 0.022, 500); a.cello(ch[0], t, d * 32, 0.05); }
    if (b % 2 === 0) a.tick(t, b % 4 === 0 ? 0.03 : 0.015, 7000);
    if ([0, 3, 6, 10].includes(b)) a.piano(ch[1 + ((b + bar) % 4)] + 12, t, 0.18, 1.2);
    if (b === 0 || b === 8) a.drum(t, 0.08, 90, 45);
  } },
  stealth: { bpm: 84, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    if (b === 0 && bar % 2 === 0) { a.cello(33 + (bar % 4 ? 1 : 0), t, d * 32, 0.07); a.pad([57, 60, 63], t, d * 32, 0.018, 380); }
    if (b % 4 === 0) a.drum(t, 0.12, 70, 40);
    if (b % 2 === 1) a.tick(t, 0.012, 8000);
    if (bar % 4 === 3 && b === 12) a.glass(87, t, 0.02);
  } },
  tension: { bpm: 118, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16;
    if ([0, 3, 6, 8, 11, 14].includes(b)) a.drum(t, b === 0 ? 0.35 : 0.18, 120, 45);
    if (b % 2 === 0) a.cello(b % 4 ? 45 : 44, t, d * 1.6, 0.05);
    a.tick(t, b % 4 === 2 ? 0.04 : 0.012, 6000);
    if (b === 0 && bar % 2 === 0) a.pad([57, 60, 63, 66], t, d * 32, 0.025, 900);
  } },
  chronolith: { bpm: 48, step(a, s, t, d) {
    const b = s % 16, bar = Math.floor(s / 16);
    if (b === 0) { a.cello(33, t, d * 16, 0.06); a.pad([57, 64, 71], t, d * 16, 0.02, 500); }
    if (b === 0 && bar % 2 === 0) [76, 83, 81].forEach((n, i) => a.glass(n, t + i * d * 4, 0.03));
    if (b === 10 && bar % 3 === 1) a.glass(88, t, 0.02);
  } },
  past: { bpm: 82, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, scale = [57, 60, 62, 64, 67, 69, 72];
    if (b === 0) a.pad([45, 52, 57], t, d * 16, 0.02, 450);
    if ([0, 6, 10].includes(b)) a.drum(t, b === 0 ? 0.22 : 0.12, 160, 70);
    if (b % 4 === 2) a.pluck(scale[(bar * 3 + b) % 7] - 12, t, 0.07);
    if (b === 0 && bar % 2 === 0) a.flute(scale[(bar >> 1) % 7] + 12, t, d * 6, 0.035);
    if (b === 8 && bar % 2 === 0) a.flute(scale[((bar >> 1) + 2) % 7] + 12, t, d * 7, 0.03);
  } },
  future: { bpm: 70, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = PROG[bar % 4];
    if (b === 0) { a.pad(ch.slice(1).map(n => n + 12), t, d * 16, 0.03, 1100); a.cello(ch[0] - 12, t, d * 16, 0.05); }
    if (b === 4 && bar % 2) a.piano(ch[3] + 12, t, 0.2, 4);
  } },
  memory: { bpm: 64, step(a, s, t, d) {
    const bar = Math.floor(s / 16), b = s % 16, ch = PROG[bar % 4];
    if (b === 0) a.cello(ch[0] + 12, t, d * 16, 0.04);
    if (b % 4 === 0) a.piano(ch[1 + (b >> 2)] + 12, t, 0.18, 3);
    if (bar % 2 === 0 && b === 0) [76, 83, 81].forEach((n, i) => a.piano(n, t + i * d * 5, 0.3, 4));
  } },
};
