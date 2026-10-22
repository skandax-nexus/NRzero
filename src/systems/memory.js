// Memory scenes (subjective, contradictory environments). Owner: M20 "Mira's Memory"; later missions may import it
// (M22 "distinguish reliable evidence from subjective memory", M23 shared-memory scenes).
//
// A memory is one place remembered by more than one person (or by one person in more than one life). Each rememberer
// is a "holder" and is a temporal state of game.temporal (keys 1/2/3 and Q switch between them, like eras), so
// everything the engine already does per state works here: T.only(obj, holder), collision boxes with
// { states: [holder] }, interactables with states, residue objects.
//
//   import { Memory, MemoryReplay, MemoryLoom } from '../systems/memory.js';
//   const mem = new Memory(game, {
//     id: 'calder', title: 'Calder Row · summer 2025',
//     holders: [{ id: 'kai', key: '1', name: 'AS KAI REMEMBERS', year: 'CALDER ROW · 2025', color: '#5fe6ff', glyph: '◐' },
//               { id: 'mira', key: '2', name: 'AS MIRA REMEMBERS', year: 'CALDER ROW · 2025', color: '#b9a4ff', glyph: '◑' }],
//     initial: 'kai',
//     bounds: [[x0, z0, x1, z1, minY?], ...],   // where the memory exists (union of rects; or { holderId: [...] })
//     onEdge: (holder) => game.ui.subtitle('mira', 'I don\'t remember past here.', 2400),
//   });
//   mem.fragment({ key: 'tune1', strand: 'I', anchor: 'tune', title, text, holder: 'mira' });   // record a found fragment
//   mem.contradict('taught', 'Who taught whom to skip stones', ['Kai: "I taught her."', 'Mira: "I taught him."']);
//
// Memories never fail the player: the edges push back softly, a replay rewinds and keeps what was learned.
//   MemoryReplay  a remembered stretch of time on a loop with a clock (08:13:30 -> 08:14:09), onReset / events at times.
//   MemoryLoom    the alignment model: N rings of anchors (one per memory), coupled levers rotate rings; spokes where
//                 every ring shows the same anchor are "aligned". A spoke may be marked contradictory: its anchors
//                 align but their content disagrees, and the loom is solved WITHOUT resolving it (forcing it is a
//                 choice the mission can refuse).
import * as THREE from 'three';

const PI = Math.PI;

// ---------------------------------------------------------------------------------------------------------------------
// Memory: holders as temporal states, soft edges, fragments, contradictions
// ---------------------------------------------------------------------------------------------------------------------
export class Memory {
  constructor(game, o) {
    this.game = game; this.o = o; this.id = o.id; this.title = o.title || o.id;
    this.holders = o.holders; this.bounds = o.bounds || null;
    this.found = new Map(); this.contradictions = new Map(); this.edgeHits = 0; this.switches = 0;
    this.edgeOn = true; this._last = null; this._edgeCool = 0;
    const T = game.temporal;
    T.configure(o.holders.map(h => ({ ...h, apply: (first, prev) => { h.apply?.(first, prev); o.onApply?.(h.id, prev); } })), o.initial || o.holders[0].id);
    T.onSwitch((id, prev) => { if (prev && id !== prev) this.switches++; });
    this.off = game.onUpdate(dt => this.update(dt));
  }
  get holder() { return this.game.temporal.current; }
  only(obj, ...holders) { return this.game.temporal.only(obj, ...holders); }
  /** Is (x, z) inside the remembered region for this holder? */
  // a rect may carry a 5th value: the lowest y it counts for (a bridge deck over water, a floor above a void)
  inside(x, z, holder = this.holder, y = null) {
    if (!this.bounds) return true;
    const list = Array.isArray(this.bounds) ? this.bounds : (this.bounds[holder] || this.bounds.all || []);
    for (const b of list) if (x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3] && (b[4] == null || y == null || y >= b[4])) return true;
    return false;
  }
  update(dt) {
    const g = this.game, p = g.player.pos;
    this._edgeCool -= dt;
    if (!this.edgeOn || !this.bounds || g.cine || g._failing) { this._last = null; return; }
    if (this.inside(p.x, p.z, this.holder, p.y)) { if (g.player.grounded !== false) this._last = [p.x, p.y, p.z]; return; }
    // outside what this holder remembers: ease back to the last remembered spot (no failure, no checkpoint)
    if (this._last) {
      const [x, y, z] = this._last, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d > 3) g.player.place(x, y, z, g.player.yaw);
      else { g.player.pos.x += dx * Math.min(1, dt * 6) + Math.sign(dx) * 0.02; g.player.pos.z += dz * Math.min(1, dt * 6) + Math.sign(dz) * 0.02; }
    }
    if (this._edgeCool <= 0) { this._edgeCool = 3.5; this.edgeHits++; this.o.onEdge?.(this.holder); }
  }
  /** Record a fragment (returns false if already found). f: { key, strand, anchor, title, text, holder, tag } */
  fragment(f) {
    if (this.found.has(f.key)) return false;
    this.found.set(f.key, { ...f, at: this.game.time });
    if (f.title) this.game.ui.addEvidence(f.title, f.text || '', f.tag || ('Memory · ' + this.title));
    this.o.onFragment?.(f);
    return true;
  }
  has(key) { return this.found.has(key); }
  count(pred = () => true) { let n = 0; for (const f of this.found.values()) if (pred(f)) n++; return n; }
  /** Two memories of the same thing disagree. Both stay true for the person who holds them. */
  contradict(key, title, sides) {
    if (this.contradictions.has(key)) return false;
    this.contradictions.set(key, { title, sides });
    this.game.ui.addEvidence('Contradiction · ' + title, sides.join('  /  '), 'Memory · ' + this.title);
    this.o.onContradiction?.(key);
    return true;
  }
  /** Reliability check for later missions: fragments flagged reliable (backed by an object) vs subjective. */
  reliability() { let r = 0, s = 0; for (const f of this.found.values()) (f.reliable ? r++ : s++); return { reliable: r, subjective: s }; }
  dispose() { this.off?.(); this.found.clear(); }
}

/** A soft wall where a memory stops: a vertical haze band (no strobing). Returns the mesh (add it, T.only it). */
export function memoryEdge(w, h, o = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(o.color ?? 0xd8ccff) }, uOp: { value: o.opacity ?? 0.55 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uTime; uniform vec3 uColor; uniform float uOp; varying vec2 vUv;\n' +
      'float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }\n' +
      'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }\n' +
      'void main(){ vec2 p = vec2(vUv.x * 9.0, vUv.y * 3.0);\n' +
      ' float f = n(p + vec2(uTime * 0.07, uTime * 0.11)) * 0.6 + n(p * 2.7 - vec2(uTime * 0.05, 0.0)) * 0.4;\n' +
      ' float v = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y)) * (0.55 + 0.45 * smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x)));\n' +
      ' gl_FragColor = vec4(uColor * (0.75 + f * 0.5), uOp * v * (0.45 + f * 0.55)); }',
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: true, fog: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.userData.noBatch = true; m.userData.noCapture = true; m.renderOrder = 3;
  m.userData.tick = (t) => { mat.uniforms.uTime.value = t; };
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------
// MemoryReplay: a remembered stretch of time on a loop
// ---------------------------------------------------------------------------------------------------------------------
const toSec = (hms) => { const [h, m, s] = hms.split(':').map(Number); return h * 3600 + m * 60 + s; };
const fmt = (sec) => { const s = Math.floor(sec), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
export class MemoryReplay {
  /** o: { from: '08:13:30', to: '08:14:09', seconds (real seconds per loop), events: [{ at: '08:13:40', fn }], onEnd } */
  constructor(game, o) {
    this.game = game; this.o = o; this.a = toSec(o.from); this.b = toSec(o.to); this.rate = (this.b - this.a) / (o.seconds || 60);
    this.t = this.a; this.running = false; this.loops = 0; this.fired = new Set(); this.hold = false;
    this.off = game.onUpdate(dt => this.update(dt));
  }
  start() { this.t = this.a; this.fired.clear(); this.running = true; }
  stop() { this.running = false; }
  get clock() { return fmt(this.t); }
  get left() { return (this.b - this.t) / this.rate; }        // real seconds left in this loop
  get frac() { return (this.t - this.a) / (this.b - this.a); }
  at(hms) { return this.t >= toSec(hms); }
  update(dt) {
    const g = this.game;
    if (!this.running || this.hold || g.cine || g.ui.dlgActive || g._failing || !g.control) return;
    this.t += dt * this.rate;
    for (const e of this.o.events || []) { const k = e.at; if (!this.fired.has(k) && this.t >= toSec(k)) { this.fired.add(k); try { e.fn(this); } catch (err) { console.warn('memory replay event', err); } } }
    if (this.t >= this.b) { this.running = false; this.loops++; this.o.onEnd?.(this); }
  }
  dispose() { this.off?.(); }
}

// ---------------------------------------------------------------------------------------------------------------------
// MemoryLoom: align memories by shared anchors, not by forcing one sequence
// ---------------------------------------------------------------------------------------------------------------------
export class MemoryLoom {
  /**
   * o: { rings: [[anchor, anchor, ...], ...] (cyclic order per ring, same length N), offsets: [k, ...] (start rotation),
   *      levers: [[ringIndex, ringIndex], ...] (each lever turns these rings one step), contradictory: ['ending'] }
   * Spoke s shows ring i's anchor rings[i][(s - offset_i) mod N].
   */
  constructor(o) {
    this.rings = o.rings; this.N = o.rings[0].length; this.off = (o.offsets || o.rings.map(() => 0)).slice();
    this.levers = o.levers || o.rings.map((_, i) => [i]); this.contra = new Set(o.contradictory || []); this.moves = 0; this.listeners = [];
  }
  anchorAt(ring, spoke) { const N = this.N; return this.rings[ring][(((spoke - this.off[ring]) % N) + N) % N]; }
  pull(lever, dir = 1) {
    for (const r of this.levers[lever]) this.off[r] = (((this.off[r] + dir) % this.N) + this.N) % this.N;
    this.moves++; for (const f of this.listeners) f(lever); return this.state();
  }
  onChange(fn) { this.listeners.push(fn); }
  /** Per spoke: { anchor | null, aligned, contradictory } */
  spokes() {
    const out = [];
    for (let s = 0; s < this.N; s++) {
      const a = this.anchorAt(0, s); let same = true;
      for (let r = 1; r < this.rings.length; r++) if (this.anchorAt(r, s) !== a) { same = false; break; }
      out.push({ spoke: s, anchor: same ? a : null, aligned: same, contradictory: same && this.contra.has(a) });
    }
    return out;
  }
  state() {
    const sp = this.spokes(), aligned = sp.filter(s => s.aligned && !s.contradictory).length, need = this.N - this.contra.size;
    return { spokes: sp, aligned, need, solved: aligned >= need, open: sp.filter(s => s.contradictory).map(s => s.anchor) };
  }
  /** Shortest lever sequence to solve from the current offsets (BFS; small N and ring counts only). */
  solve(limit = 12) {
    const key = (o) => o.join(','), start = this.off.slice(), seen = new Set([key(start)]), q = [[start, []]];
    const ok = (o) => { const save = this.off; this.off = o; const s = this.state().solved; this.off = save; return s; };
    while (q.length) {
      const [o, path] = q.shift(); if (ok(o)) return path; if (path.length >= limit) continue;
      for (let l = 0; l < this.levers.length; l++) {
        const n = o.slice(); for (const r of this.levers[l]) n[r] = (n[r] + 1) % this.N;
        const k = key(n); if (!seen.has(k)) { seen.add(k); q.push([n, [...path, l]]); }
      }
    }
    return null;
  }
}

/** Angle of spoke s (0 = toward -z, clockwise seen from above) for N spokes. */
export const spokeAngle = (s, N = 4) => -s * (2 * PI / N);
