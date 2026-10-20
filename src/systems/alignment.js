// Celestial alignment helpers (shared system; owner: M7 The Broken Observatory).
//
// World convention: north = -z, east = +x, up = +y. Directions are given as a compass bearing (degrees, 0 = north,
// 90 = east) and an altitude (degrees above the horizon).
//
//   bearingDir(bearing, alt)            -> unit THREE.Vector3
//   rzAzimuth(bearing)                  -> the azimuth realism.js skyEnvironment() expects for the same direction
//   new StarField({ stars, radius, background, seed, spin })   named bright stars + a seeded background, one draw call;
//       .pole(bearing, alt) sets the axis the sky turns around, .spin(rad/s), .mark(name, color) puts a ring on a star
//   new Instrument(game, { name, yaw, pitch, bearings, alts, target, tolerance, ... })   a two-axis sighting
//       instrument with engraved marks (choice-driven: works with mouse, touch and ?auto test queues),
//       .operate() runs the sighting dialogue, .aligned, .error(), .set(b, a, animate), .sight() staged sight view
//   new OrreryRing(game, { center, y, r0, r1, arcs, speed, states })   a rotating ring platform made of arc segments:
//       per-frame collision boxes along each arc, carries a standing player, .displace(sec) snaps it back in time
//   ask(game, id, text, options)        game.choice that consumes game.autoQueue (scripted tests) when present
//
// Later missions (M19 "observatory pattern") may reuse StarField / Instrument / OrreryRing as they are.
import * as THREE from 'three';

export const DEG = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Unit vector for a compass bearing (deg, 0 = north/-z, 90 = east/+x) and altitude (deg). */
export function bearingDir(bearing, alt = 0) {
  const b = bearing * DEG, a = alt * DEG;
  return V(Math.sin(b) * Math.cos(a), Math.sin(a), -Math.cos(b) * Math.cos(a));
}
/** Compass bearing / altitude (deg) of a direction. */
export function dirBearing(v) {
  const n = v.clone().normalize();
  let b = Math.atan2(n.x, -n.z) / DEG; if (b < 0) b += 360;
  return { bearing: b, alt: Math.asin(Math.max(-1, Math.min(1, n.y))) / DEG };
}
/** realism.js skyEnvironment azimuth for a compass bearing (its azimuth runs from +z toward +x). */
export const rzAzimuth = (bearing) => 180 - bearing;
/** Angle in degrees between two pointing directions. */
export function angleBetween(b0, a0, b1, a1) { return bearingDir(b0, a0).angleTo(bearingDir(b1, a1)) / DEG; }
/** Human words for where a target sits relative to where the instrument points ("up and to the left"). */
export function relativeWords(b, a, tb, ta) {
  let db = ((tb - b + 540) % 360) - 180; const da = ta - a, out = [];
  if (Math.abs(da) > 2.5) out.push(da > 0 ? 'higher' : 'lower');
  if (Math.abs(db) > 2.5) out.push(db > 0 ? 'to the right' : 'to the left');
  return out.length ? out.join(' and ') : 'dead centre';
}

/** game.choice that consumes a scripted queue (game.autoQueue) in ?auto test runs. */
export async function ask(game, id, text, options) {
  if (game.autoplay && Array.isArray(game.autoQueue) && game.autoQueue.length) game.autoChoice = game.autoQueue.shift();
  return game.choice(id, text, options);
}

// ---------------------------------------------------------------------------------------------------------------
// StarField: named stars at authored bearings/altitudes plus a seeded background, drawn as one Points object on a
// sphere that turns around a pole (time-lapse readable: the pole star stays, everything else wheels around it).
// stars: [{ name, bearing, alt, mag (-1.5 bright .. 4 faint), color, planet }]
// ---------------------------------------------------------------------------------------------------------------
export class StarField {
  constructor(o = {}) {
    this.radius = o.radius ?? 420;
    this.group = new THREE.Group(); this.group.name = 'starfield';
    this.sky = new THREE.Group(); this.group.add(this.sky);
    this.named = new Map();
    const pos = [], col = [], size = [];
    const add = (dir, mag, color) => {
      const p = dir.clone().multiplyScalar(this.radius); pos.push(p.x, p.y, p.z);
      const c = new THREE.Color(color ?? 0xdfe8ff); const k = THREE.MathUtils.clamp(1.25 - mag * 0.22, 0.25, 1.6);
      col.push(c.r * k, c.g * k, c.b * k); size.push(THREE.MathUtils.clamp(5.2 - mag * 1.05, 1.2, 8));
    };
    let s = (o.seed ?? 7) >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const n = o.background ?? 900;
    for (let i = 0; i < n; i++) { const u = r() * 2 - 1, th = r() * Math.PI * 2, q = Math.sqrt(1 - u * u); add(V(q * Math.cos(th), u, q * Math.sin(th)), 2.2 + r() * 2.4, [0xdfe8ff, 0xfff0d8, 0xcfdcff, 0xffe2c0][Math.floor(r() * 4)]); }
    for (const st of o.stars || []) { const d = bearingDir(st.bearing, st.alt); add(d, st.mag ?? 1, st.color); this.named.set(st.name, { ...st, dir: d }); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
    this.uniforms = { uOpacity: { value: o.opacity ?? 1 }, uTwinkle: { value: 0 }, uScale: { value: o.scale ?? 1.6 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute float size; varying vec3 vC; uniform float uTwinkle, uScale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          float tw = 0.85 + 0.15 * sin(uTwinkle * 3.0 + position.x * 0.37 + position.z * 0.21);
          gl_PointSize = size * tw * uScale; }`,
      fragmentShader: `varying vec3 vC; uniform float uOpacity;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.0, r); a *= a;
          gl_FragColor = vec4(vC * a * uOpacity, 1.0); }`,
      vertexColors: true,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = -1;
    this.sky.add(this.points);
    this.markers = new Map();
    this.axis = V(0, 1, 0); this.rate = 0; this.angle = 0;
    if (o.pole) this.pole(o.pole[0], o.pole[1]);
  }
  /** The sky turns around this direction (the celestial pole for the site's latitude). */
  pole(bearing, alt) { this.axis = bearingDir(bearing, alt); return this; }
  spin(rate) { this.rate = rate; return this; }
  /** World direction of a named star right now. */
  dirOf(name) { const st = this.named.get(name); if (!st) return null; return st.dir.clone().applyQuaternion(this.sky.quaternion); }
  /** A soft ring around a named star (for staged sight views). */
  mark(name, color = 0x9fe8ff, size = 9) {
    const st = this.named.get(name); if (!st) return null;
    let m = this.markers.get(name);
    if (!m) {
      const tex = ringTexture();
      m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      m.position.copy(st.dir).multiplyScalar(this.radius * 0.98); m.scale.setScalar(size); this.sky.add(m); this.markers.set(name, m);
    }
    m.visible = true; m.material.color.set(color); return m;
  }
  unmark(name) { const m = this.markers.get(name); if (m) m.visible = false; }
  update(dt, t, camera) {
    if (this.rate) { this.angle += this.rate * dt; this.sky.quaternion.setFromAxisAngle(this.axis, this.angle); }
    this.uniforms.uTwinkle.value = t;
    if (camera) this.group.position.copy(camera.position);
  }
}
let _ringTex = null;
function ringTexture() {
  if (_ringTex) return _ringTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.5; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.beginPath(); g.moveTo(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26); g.lineTo(32 + Math.cos(a) * 31, 32 + Math.sin(a) * 31); g.stroke(); }
  _ringTex = new THREE.CanvasTexture(c); _ringTex.colorSpace = THREE.SRGBColorSpace; return _ringTex;
}

// ---------------------------------------------------------------------------------------------------------------
// Instrument: a sighting instrument with an azimuth ring (yaw node) and an altitude arc (pitch node). Its engraved
// marks are the choices offered (a knowledge puzzle, not a fiddly dial). The yaw node turns about +y so that its
// local -z points along the bearing; the pitch node tilts about its local x so local -z rises by the altitude.
//   new Instrument(game, { name, yaw, pitch, eye: [x,y,z], bearings: [{ v, label }], alts: [{ v, label }],
//                          bearing, alt, target: () => ({ bearing, alt, name }) , tolerance: 4, states: ['2049'],
//                          describe: (inst) => 'what the sight shows', speaker: 'kai' })
// ---------------------------------------------------------------------------------------------------------------
export class Instrument {
  constructor(game, o) {
    this.game = game; this.o = o; this.name = o.name;
    this.yaw = o.yaw; this.pitch = o.pitch;
    this.bearing = o.bearing ?? o.bearings[0].v; this.alt = o.alt ?? o.alts[0].v;
    this.shown = { b: this.bearing, a: this.alt };
    this.tolerance = o.tolerance ?? 4; this.locked = false; this.busy = false; this.moves = 0;
    this.listeners = [];
    game.onUpdate((dt) => this.update(dt));
    this.apply();
  }
  onChange(fn) { this.listeners.push(fn); }
  target() { const t = typeof this.o.target === 'function' ? this.o.target() : this.o.target; return t; }
  /** Angular error (deg) between the instrument and its target. */
  error() { const t = this.target(); return t ? angleBetween(this.bearing, this.alt, t.bearing, t.alt) : 180; }
  get aligned() { return this.error() <= this.tolerance; }
  dir() { return bearingDir(this.shown.b, this.shown.a); }
  apply() {
    if (this.yaw) this.yaw.rotation.y = -this.shown.b * DEG;
    if (this.pitch) this.pitch.rotation.x = this.shown.a * DEG;
  }
  /** Set the pointing; animate turns the bronze over ~0.9 s. */
  set(bearing, alt, animate = true) {
    this.bearing = bearing; this.alt = alt; this.moves++;
    if (!animate) { this.shown.b = bearing; this.shown.a = alt; this.apply(); }
    for (const f of this.listeners) f(this);
  }
  update(dt) {
    let db = ((this.bearing - this.shown.b + 540) % 360) - 180, da = this.alt - this.shown.a;
    if (Math.abs(db) < 0.02 && Math.abs(da) < 0.02) return;
    const k = Math.min(1, dt * 3.2);
    this.shown.b = (this.shown.b + db * k + 360) % 360; this.shown.a += da * k; this.apply();
    if (this.game.audio.ctx && Math.random() < dt * 10) this.game.audio.tick(this.game.audio.ctx.currentTime, 0.03, 900 + Math.random() * 400, this.game.audio.sfx);
  }
  /** Eye position of the sight in world space. */
  eye() { const p = V(); (this.o.eyeNode || this.pitch || this.yaw).getWorldPosition(p); if (this.o.eyeOffset) p.add(V(...this.o.eyeOffset)); return p; }
  /** Staged camera along the sight. Resolves after `sec`. */
  async sight(sec = 2.4, fov = 30) {
    const g = this.game, e = this.eye(), d = bearingDir(this.bearing, this.alt);
    const from = e.clone().addScaledVector(d, -0.6).add(V(0, 0.05, 0));
    await g.shot(from.toArray(), from.clone().addScaledVector(d, 40).toArray(), sec, { fov, dof: false });
  }
  /** Over-the-instrument view along where it points (the sky it is aimed at stays in frame while choosing). */
  async frame(sec = 0.9) {
    const g = this.game, e = this.eye(), d = bearingDir(this.bearing, this.alt), h = bearingDir(this.bearing, 0);
    const from = e.clone().addScaledVector(h, -(this.o.frameDist ?? 3.4)).addScaledVector(bearingDir(this.bearing + 90, 0), this.o.frameSide ?? 0).add(V(0, this.o.frameUp ?? 1.1, 0));
    g.ui.letterbox(true);
    await g.shot(from.toArray(), e.clone().addScaledVector(d, 30).toArray(), sec, { fov: 50, dof: false });
  }
  /** The sighting dialogue: ring, arc, look through the sight, step back. Returns true once aligned. */
  async operate() {
    if (this.busy || this.locked) return this.aligned;
    const g = this.game, o = this.o, sp = o.speaker || 'kai';
    this.busy = true;
    try {
      await this.frame(1.0);
      for (;;) {
        const bl = (o.bearings.find(x => x.v === this.bearing) || {}).label || `${Math.round(this.bearing)}°`;
        const al = (o.alts.find(x => x.v === this.alt) || {}).label || `${Math.round(this.alt)}°`;
        const opts = ['Turn the ring', 'Tilt the sight', 'Look through the sight', 'Step back'];
        const i = await ask(g, sp, `${this.name} · ring ${bl} · sight ${al}`, opts);
        if (i === 0) {
          const j = await ask(g, sp, 'Turn the ring to the mark…', [...o.bearings.map(x => x.label), 'Leave it']);
          if (j < o.bearings.length) { this.set(o.bearings[j].v, this.alt); g.audio.sfxPlay('metal'); await this.frame(1.1); }
        } else if (i === 1) {
          const j = await ask(g, sp, 'Tilt the sight to the mark…', [...o.alts.map(x => x.label), 'Leave it']);
          if (j < o.alts.length) { this.set(this.bearing, o.alts[j].v); g.audio.sfxPlay('metal'); await this.frame(1.1); }
        } else if (i === 2) {
          await this.look(); await this.frame(0.8);
        } else break;
        if (this.aligned) { this.locked = true; break; }
      }
    } finally { this.busy = false; }
    return this.aligned;
  }
  /** Look through the sight and describe what is there (mission-supplied words). */
  async look() {
    const g = this.game, prevCine = !g.control;
    g.control = false; g.ui.letterbox(true);
    await this.sight(2.2);
    const t = this.target();
    const words = this.o.describe ? this.o.describe(this, t) : (t ? `The target is ${relativeWords(this.bearing, this.alt, t.bearing, t.alt)}.` : 'Nothing.');
    if (words) await g.say(this.o.speaker || 'kai', words);
    if (!prevCine) { g.control = true; g.ui.letterbox(false); g.releaseCam(); }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// OrreryRing: a rotating ring platform (orrery floor) made of arc segments around a centre. Collision is a chain of
// small walk boxes along each arc, moved every frame; a player standing on a segment turns with it. Temporal hits
// can displace it backward (.displace(sec) returns it to where it was sec ago; a ghost shows the jump).
//   new OrreryRing(game, { center: [x, z], y, r0, r1, arcs: [[start, length] (deg bearing)], speed (rad/s),
//                          states: ['2196'], mesh (optional Object3D turned with the ring), step: 6 })
// ---------------------------------------------------------------------------------------------------------------
export class OrreryRing {
  constructor(game, o) {
    this.game = game; this.o = o; this.cx = o.center[0]; this.cz = o.center[1]; this.y = o.y;
    this.r0 = o.r0; this.r1 = o.r1; this.angle = 0; this.speed = o.speed ?? 0.2; this.paused = false;
    this.mesh = o.mesh || null; this.history = []; this.time = 0;
    const rm = (o.r0 + o.r1) / 2, half = Math.min(0.95, (o.r1 - o.r0) / 2 + 0.05), stepDeg = o.step ?? 6;
    this.boxes = [];
    for (const [start, len] of o.arcs) {
      const n = Math.max(2, Math.ceil(len / stepDeg));
      for (let i = 0; i <= n; i++) {
        const th = start + (len * i) / n;
        const b = game.collision.add([0, o.y - 0.4, 0], [0, o.y, 0], { states: o.states, walkOnly: true });
        b.th = th; b.rm = rm; b.half = half; this.boxes.push(b);
      }
    }
    this.arcs = o.arcs;
    this.place();
    game.onUpdate((dt) => this.update(dt));
  }
  /** Bearing (deg) of a world point around the ring centre. */
  bearingOf(x, z) { let b = Math.atan2(x - this.cx, -(z - this.cz)) / DEG; if (b < 0) b += 360; return b; }
  /** True if a world point lies on one of the ring's segments right now. */
  onSegment(x, z, pad = 0.15) {
    const r = Math.hypot(x - this.cx, z - this.cz); if (r < this.r0 - pad || r > this.r1 + pad) return false;
    const b = this.bearingOf(x, z), rot = this.angle / DEG;
    return this.arcs.some(([s, len]) => { const d = ((b - (s + rot)) % 360 + 360) % 360; return d <= len + 2; });
  }
  place() {
    const rot = this.angle / DEG;
    for (const b of this.boxes) {
      const th = (b.th + rot) * DEG, x = this.cx + Math.sin(th) * b.rm, z = this.cz - Math.cos(th) * b.rm;
      b.min.set(x - b.half, this.y - 0.4, z - b.half); b.max.set(x + b.half, this.y, z + b.half);
    }
    if (this.mesh) this.mesh.rotation.y = -this.angle;
  }
  /** Return to where the ring was `sec` seconds ago (a temporal displacement). Carries a standing player along. */
  displace(sec = 3) {
    const want = this.time - sec; let a = this.angle;
    for (let i = this.history.length - 1; i >= 0; i--) { if (this.history[i][0] <= want) { a = this.history[i][1]; break; } }
    const d = a - this.angle; this.carry(d); this.angle = a; this.place();
    return d;
  }
  carry(d) {
    const p = this.game.player.pos, g = this.game;
    if (!this.o.states || this.o.states.includes(g.temporal.current)) {
      if (p.y > this.y - 0.25 && p.y < this.y + 0.6 && this.onSegment(p.x, p.z)) {
        const dx = p.x - this.cx, dz = p.z - this.cz, c = Math.cos(d), s = Math.sin(d);
        // the player's bearing around the centre grows by d (bearings grow clockwise seen from above)
        p.x = this.cx + dx * c - dz * s; p.z = this.cz + dx * s + dz * c;
        g.player.yaw -= d;
      }
    }
  }
  update(dt) {
    this.time += dt;
    if (!this.paused && this.speed) { const d = this.speed * dt; this.carry(d); this.angle += d; this.place(); }
    this.history.push([this.time, this.angle]); while (this.history.length && this.history[0][0] < this.time - 8) this.history.shift();
  }
  dispose() { for (const b of this.boxes) b.enabled = false; }
}
