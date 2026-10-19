// Spoken dialogue using the device's built-in speech engine (Web Speech API).
// No recorded or downloaded audio: every line is synthesized at runtime, with a
// distinct voice, pitch and pace per character. Falls back silently where unsupported.

import { CAST } from '../story/cast.js';

const PROFILES = {
  kai:     { sex: 'm', pitch: 0.95, rate: 1.0,  langs: ['en-US', 'en-GB'] },
  mira:    { sex: 'f', pitch: 1.05, rate: 0.96, langs: ['en-GB', 'en-US'] },
  witness: { sex: 'm', pitch: 0.72, rate: 0.86, langs: ['en-GB', 'en-US'] },
  sera:    { sex: 'f', pitch: 0.92, rate: 1.04, langs: ['en-AU', 'en-US', 'en-GB'] },
  rook:    { sex: 'm', pitch: 0.84, rate: 0.92, langs: ['en-GB', 'en-US'] },
  phone:   { sex: 'm', pitch: 0.84, rate: 0.95, langs: ['en-GB', 'en-US'], as: 'rook' },
  niko:    { sex: 'm', pitch: 1.12, rate: 0.98, langs: ['en-IN', 'en-ZA', 'en-US'] },
  tala:    { sex: 'f', pitch: 0.88, rate: 0.92, langs: ['en-IN', 'en-ZA', 'en-GB'] },
  iven:    { sex: 'm', pitch: 1.02, rate: 1.1,  langs: ['en-IE', 'en-GB', 'en-US'] },
  jun:     { sex: 'm', pitch: 1.04, rate: 1.02, langs: ['en-US', 'en-CA'] },
  hale:    { sex: 'm', pitch: 0.78, rate: 0.94, langs: ['en-US'] },
  brandt:  { sex: 'm', pitch: 0.95, rate: 1.06, langs: ['en-GB', 'en-US'] },
  child:   { sex: 'f', pitch: 1.55, rate: 1.06, langs: ['en-US', 'en-GB'] },
  voice:   { sex: 'm', pitch: 0.45, rate: 0.78, langs: ['en-GB', 'en-US'] },
  speaker: { sex: 'f', pitch: 0.9,  rate: 0.95, langs: ['en-GB', 'en-US'] },
};

const FEMALE = ['female', 'woman', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'serena', 'fiona', 'zira', 'aria', 'jenny', 'sonia', 'libby', 'susan', 'hazel', 'heera', 'veena', 'allison', 'ava', 'kate', 'emily', 'catherine', 'martha', 'nicky', 'salli', 'joanna', 'kimberly', 'ivy', 'amy', 'emma', 'olivia', 'natasha', 'clara', 'neerja', 'isha', 'michelle', 'zoe', 'sara', 'google us english', 'linda', 'heather', 'kendra'];
const MALE = ['male', ' man', 'daniel', 'alex', 'fred', 'oliver', 'arthur', 'david', 'guy', 'ryan', 'mark', 'george', 'james', 'rishi', 'aaron', 'gordon', 'lee', 'thomas', 'brian', 'matthew', 'joey', 'justin', 'william', 'tom', 'reed', 'rocko', 'eddy', 'grandpa', 'ravi', 'prabhat', 'christopher', 'eric', 'roger', 'liam', 'connor', 'richard', 'sean', 'mitchell', 'nathan'];
const QUALITY = ['natural', 'neural', 'premium', 'enhanced', 'online', 'google', 'siri', 'wavenet'];

function sexOf(v) {
  const n = ' ' + (v.name || '').toLowerCase() + ' ';
  if (FEMALE.some(k => n.includes(k))) return 'f';
  if (MALE.some(k => n.includes(k))) return 'm';
  return null;
}

export class Voice {
  constructor(game) {
    this.game = game;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.supported = !!(this.synth && window.SpeechSynthesisUtterance);
    this.enabled = this.load('voices', true);
    this.volume = this.load('voiceVolume', 1);
    this.voices = []; this.assigned = {}; this.speaking = 0;
    // recorded performances (tools/voice/build_voices.py): neural voices per character, keyed by speaker + line
    this.recorded = null; this.clip = null;
    if (typeof window !== 'undefined' && window.fetch) window.fetch(new globalThis.URL('../../assets/voice/manifest.json', import.meta.url).href).then(r => (r.ok ? r.json() : null)).then(m => {
      if (m && m.lines) { this.recorded = m; this.base = new globalThis.URL('../../assets/voice/', import.meta.url).href; this.supported = true; }
    }).catch(() => { /* no recorded voices in this build */ });
    if (!this.supported) return;
    const refresh = () => { this.voices = this.synth.getVoices().filter(v => /^en/i.test(v.lang)); this.assigned = {}; };
    refresh();
    this.synth.addEventListener?.('voiceschanged', refresh);
    // iOS/Android only allow speech after a user gesture: prime it on the first touch or click.
    const unlock = () => { try { const u = new window.SpeechSynthesisUtterance(' '); u.volume = 0; this.synth.speak(u); } catch { /* ignore */ } window.removeEventListener('pointerdown', unlock); };
    addEventListener('pointerdown', unlock);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); });
  }

  load(k, d) { try { const v = localStorage.getItem('afterzero.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }
  save(k, v) { try { localStorage.setItem('afterzero.' + k, JSON.stringify(v)); } catch { /* ignore */ } }
  setEnabled(on) { this.enabled = on; this.save('voices', on); if (!on) this.stop(); }

  profile(id) {
    if (PROFILES[id]) return PROFILES[id];
    if (CAST[id]?.vp) return { langs: ['en-US', 'en-GB'], pitch: 1, rate: 1, ...CAST[id].vp };
    // unnamed barks: a stable random citizen voice per line source
    const h = [...String(id || 'x')].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    return { sex: h % 2 ? 'f' : 'm', pitch: 0.85 + (h % 7) * 0.05, rate: 0.95 + (h % 5) * 0.03, langs: ['en-US', 'en-GB'] };
  }

  pick(id) {
    const key = PROFILES[id]?.as || id || 'crowd';
    if (this.assigned[key] !== undefined) return this.assigned[key];
    const p = this.profile(id);
    const used = new Set(Object.values(this.assigned).filter(Boolean).map(v => v.name));
    let best = null, bestScore = -1e9;
    for (const v of this.voices) {
      const n = v.name.toLowerCase();
      let s = 0;
      if (QUALITY.some(q => n.includes(q))) s += 3;
      const li = p.langs.findIndex(l => v.lang.replace('_', '-').toLowerCase() === l.toLowerCase());
      if (li >= 0) s += 3 - li;
      const sx = sexOf(v);
      if (sx === p.sex) s += 4; else if (sx && sx !== p.sex) s -= 8;
      if (used.has(v.name)) s -= 2.5; // prefer a different voice for each character
      if (v.localService) s += 0.5;
      if (s > bestScore) { bestScore = s; best = v; }
    }
    this.assigned[key] = best;
    return best;
  }

  // Key of a recorded line: FNV-1a of "speaker|text" (same as tools/voice/build_voices.py).
  lineKey(id, text) {
    const k = (id || 'crowd') + '|' + text.trim();
    let h = 2166136261; for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  // Play a recorded performance if this build has one for the line; resolves when it ends.
  playRecorded(id, text, onWord) {
    const file = this.recorded?.lines?.[this.lineKey(id, text)];
    if (!file) return null;
    this.stop();
    const a = new window.Audio(this.base + file);
    a.volume = Math.min(1, this.volume * (this.game.audio?.volume ?? 1));
    this.clip = a; this.speaking++; this.duck(true);
    return new Promise(res => {
      let done = false, tick = null;
      const fin = () => { if (done) return; done = true; clearInterval(tick); if (this.clip === a) this.clip = null; this.speaking = Math.max(0, this.speaking - 1); if (!this.speaking) this.duck(false); res(); };
      a.onended = fin; a.onerror = fin; a.onpause = () => { if (a.ended) fin(); };
      if (onWord) tick = setInterval(() => { if (!a.paused) onWord(); }, 260);
      setTimeout(fin, 2500 + text.length * 120); // safety net
      a.play().catch(fin);
    });
  }

  // Speak a line. Resolves when finished (or immediately when voices are off/unsupported).
  speak(id, text, { onWord } = {}) {
    if (!this.supported || !this.enabled || this.game.autoplay || !text) return Promise.resolve();
    const rec = this.playRecorded(id, text, onWord);
    if (rec) return rec;
    if (!this.synth) return Promise.resolve();
    const clean = text.replace(/[“”"]/g, '').replace(/\s+[—–-]\s+/g, ', ').replace(/\.\.\.|…/g, '. ');
    this.synth.cancel();
    const p = this.profile(id);
    const u = new window.SpeechSynthesisUtterance(clean);
    const v = this.pick(id); if (v) { u.voice = v; u.lang = v.lang; }
    u.pitch = p.pitch; u.rate = p.rate; u.volume = this.volume * (this.game.audio?.volume ?? 1);
    this.speaking++; this.duck(true);
    return new Promise(res => {
      let done = false;
      const fin = () => { if (done) return; done = true; this.speaking = Math.max(0, this.speaking - 1); if (!this.speaking) this.duck(false); res(); };
      u.onend = fin; u.onerror = fin;
      if (onWord) u.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) onWord(); };
      setTimeout(fin, 1500 + clean.length * 95 / p.rate); // safety net for engines that never fire onend
      try { this.synth.speak(u); } catch { fin(); }
    });
  }

  stop() {
    if (this.clip) { const c = this.clip; this.clip = null; try { c.pause(); c.onended?.(); } catch { /* ignore */ } }
    if (this.synth) { try { this.synth.cancel(); } catch { /* ignore */ } }
    this.speaking = 0; this.duck(false);
  }
  pause() { if (this.clip) this.clip.pause(); if (this.synth) try { this.synth.pause(); } catch { /* ignore */ } }
  resume() { if (this.clip) this.clip.play().catch(() => {}); if (this.synth) try { this.synth.resume(); } catch { /* ignore */ } }

  duck(on) {
    const a = this.game.audio; if (!a?.ctx || !a.music) return;
    a.music.gain.setTargetAtTime(on ? 0.22 : (a.theme ? 0.55 : 0), a.ctx.currentTime, 0.25);
    if (a.amb) a.amb.gain.setTargetAtTime(on ? 0.45 : 0.7, a.ctx.currentTime, 0.25);
  }
}
