import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry } from '../core/character.js';
import * as RZ from './realism.js';

export const rng = mulberry;
const texCache = new Map();

// Infrastructure upgrade switches (docs/RENDERING.md, stage 4): ?infra=off builds the shared kit exactly as before the
// upgrade (A/B captures); ?infra=nofacade,nomasonry,nolamp,nobatch switch single parts off.
const INFRA = (() => { try { return new Set(String(new URLSearchParams(window.location.search).get('infra') || '').split(',').filter(Boolean)); } catch { return new Set(); } })();
/** false when ?infra=off or ?infra=no<part> switched an upgrade part off (facade, masonry, lamp, batch). */
export function infraOn(part) { return !INFRA.has('off') && !INFRA.has('no' + part); }

export function canvasTex(w, h, draw, key, opts = {}) {
  if (key && texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); }
  if (key) texCache.set(key, t);
  return t;
}

// Building facade: returns {map, emissive}. Both carry userData.rzFacade, so a box() built with them becomes a real
// building (see box()); era: '2049' (default, Rain City) | '2026' | '2196' picks the facade variant.
export function facadeTextures(seed, style = 'modern', era = '2049') {
  const key = 'facade' + seed + style + era;
  if (texCache.has(key)) return texCache.get(key);
  const r = rng(seed);
  const W = 256, H = 512, cols = 6 + Math.floor(r() * 4), rows = 18 + Math.floor(r() * 10);
  const cw = W / cols, rh = H / rows;
  const warm = ['#ffd9a0', '#ffc070', '#ffe8c8', '#ffb060'], cool = ['#a8e8ff', '#7fd0ff', '#d8f4ff', '#c0b0ff'];
  const lit = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) lit.push(r() < 0.32 ? (r() < 0.7 ? warm : cool)[Math.floor(r() * 4)] : null);
  const map = canvasTex(W, H, (g) => {
    g.fillStyle = style === 'glass' ? '#141c26' : '#1a1d22'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      g.fillStyle = style === 'glass' ? '#1d2a38' : '#0d1015';
      g.fillRect(x * cw + 2, y * rh + 2, cw - 4, rh - 4);
    }
    g.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < rows; y += 4) g.fillRect(0, y * rh, W, 2);
  });
  const emissive = canvasTex(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    let i = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const c = lit[i++]; if (!c) continue;
      const grd = g.createLinearGradient(0, y * rh, 0, (y + 1) * rh);
      grd.addColorStop(0, c); grd.addColorStop(1, '#00000000');
      g.globalAlpha = 0.5 + r() * 0.5; g.fillStyle = grd; g.fillRect(x * cw + 3, y * rh + 3, cw - 6, rh - 6);
      if (r() < 0.3) { g.fillStyle = '#000'; g.globalAlpha = 0.6; g.fillRect(x * cw + 3 + r() * cw * 0.5, y * rh + 3, cw * 0.15, rh - 6); }
    }
    g.globalAlpha = 1;
  });
  map.userData.rzFacade = emissive.userData.rzFacade = { seed, style, era };
  const out = { map, emissive }; texCache.set(key, out); return out;
}

export function neonTexture(text, color, opts = {}) {
  const key = 'neon' + text + color + (opts.vertical ? 'v' : '');
  const font = opts.font || '700 72px Rajdhani, sans-serif';
  let W = opts.vertical ? 128 : 512;
  if (!opts.vertical) { const m = document.createElement('canvas').getContext('2d'); m.font = font; W = Math.min(2048, Math.max(512, Math.ceil(m.measureText(text).width + 90))); }
  return canvasTex(W, opts.vertical ? 512 : 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = color;
    if (opts.vertical) { [...text].forEach((ch, i, a) => g.fillText(ch, w / 2, h / (a.length + 1) * (i + 1))); }
    else { g.fillText(text, w / 2, h / 2); g.shadowBlur = 4; g.fillStyle = '#fff'; g.globalAlpha = 0.6; g.fillText(text, w / 2, h / 2); }
    g.globalAlpha = 1; g.strokeStyle = color; g.lineWidth = 4; g.shadowBlur = 12; g.strokeRect(6, 6, w - 12, h - 12);
  }, key);
}

export function neonSign(text, color, w = 3, h = 0.75, opts = {}) {
  const tex = neonTexture(text, color, opts);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(opts.intensity ?? 2.2, opts.intensity ?? 2.2, opts.intensity ?? 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  m.userData.flicker = opts.flicker ? Math.random() * 10 : null;
  return m;
}

// ---------- surface materials (docs/RENDERING.md, stage 3) ----------
// asphaltMaterial / tileMaterial / stoneMaterial / concreteMaterial keep their signatures and return the same
// MeshStandardMaterial, now with a GPU-baked albedo, tangent-space normal map and ORM map (realism.textureSet: tile
// bevels and recessed grout, chamfered stone joints, concrete pores and pour lines, asphalt aggregate and cracks),
// texture size by tier (256 low, 512 medium / high, the asphalt 1024 on high). The bakes are colour-neutral and
// shared by every call (one set per kind and variant), the authored colour is material.color, so materials with equal
// arguments stay equal (static batching merges them) and a mission's palette is kept. 'low' skips the AO map (one
// texture tap less; the grout and joints are already dark in the albedo). The canvas versions from before the upgrade
// come back with ?infra=nomat (or off), or at runtime with setKitMaterialsLegacy(scene, true) for A/B captures.
const NEUTRAL = 0xbcbcbc;   // sRGB 188 = linear 0.5: bakes are made with this colour, material.color = authored / neutral
const _nl = new THREE.Color(NEUTRAL).r;
const kitClones = new WeakMap();
function kitSet(kind, params, variant, hero) {
  const T = RZ.tier();
  return RZ.textureSet(kind, params, { size: hero ? (T.kitHero ?? T.texHero) : (T.kitTex ?? T.tex), seed: 11 + variant * 7 });
}
// per-repeat clones (shared GPU texture, own uv transform), cached so equal arguments give equal texture objects
function kitMaps(set, repeat) {
  let m = kitClones.get(set); if (!m) kitClones.set(set, m = new Map());
  const k = repeat[0] + ',' + repeat[1];
  if (!m.has(k)) {
    const c = t => { const x = t.clone(); x.repeat.set(repeat[0], repeat[1]); x.anisotropy = Math.max(t.anisotropy, 4); return x; };
    m.set(k, { map: c(set.map), normalMap: c(set.normalMap), orm: c(set.ormMap) });
  }
  return m.get(k);
}
const tintOf = (hex, mul = 1) => { const c = new THREE.Color(hex); return c.setRGB(c.r / _nl * mul, c.g / _nl * mul, c.b / _nl * mul); };
// PBR version of a kit material, or null (legacy switch, no renderer to bake with): the caller builds the canvas one
function kitPBR(kind, params, variant, repeat, o) {
  if (!infraOn('mat')) return null;
  let set;
  try { set = kitSet(kind, params, variant, o.hero); } catch (e) { if (!kitPBR.warned) { kitPBR.warned = true; console.warn('kit: surface bake unavailable, canvas materials', e.message); } return null; }
  const M = kitMaps(set, repeat), ao = RZ.getQuality() !== 'low' && o.ao !== false;
  const props = { map: M.map, normalMap: M.normalMap, roughnessMap: M.orm, aoMap: ao ? M.orm : null, roughness: o.roughness, metalness: o.metalness };
  if (o.color) props.color = o.color;
  const mat = new THREE.MeshStandardMaterial({ ...props, envMapIntensity: o.envMapIntensity ?? 1 });
  mat.normalScale.set(o.normalScale ?? 1, o.normalScale ?? 1);
  mat.defines = { RZ_SPECAA: '' };   // realism's shared chunk: specular AA on the mapped normal (no sparkle on glossy tiles)
  mat.userData.rzKitMat = { pbr: { ...props, defines: mat.defines }, legacy: o.legacy };
  return mat;
}
/**
 * A/B switch for captures and cost measurements: legacy = true gives the scene's kit surface materials (asphalt, tile,
 * stone, concrete) their canvas textures from before the stage-3 upgrade, false the baked PBR sets again. Returns the
 * number of materials switched.
 */
export function setKitMaterialsLegacy(scene, legacy) {
  const done = new Set();
  scene.traverse(o => {
    if (o.userData.rzBatch) return;   // merged copies (private material clones) are rebuilt by the caller
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      const K = m.userData?.rzKitMat; if (!K || typeof K.legacy !== 'function' || done.has(m)) continue;
      done.add(m);
      if (legacy && !K.legacyProps) K.legacyProps = K.legacy();
      const P = legacy ? K.legacyProps : K.pbr;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap']) m[k] = P[k] || null;
      if (P.color) m.color.copy(P.color); else m.color.setRGB(1, 1, 1);
      m.roughness = P.roughness; m.metalness = P.metalness; m.defines = P.defines || {};
      m.needsUpdate = true;
    }
  });
  return done.size;
}

// Wet asphalt with puddles: roughness + color variation
function asphaltLegacy(repeat) {
  const rough = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},0.06)`; g.fillRect(r() * w, r() * h, 2, 2); }
    for (let i = 0; i < 9; i++) {
      const x = r() * w, y = r() * h, rr = 40 + r() * 90;
      const grd = g.createRadialGradient(x, y, 0, x, y, rr); grd.addColorStop(0, 'rgba(40,40,40,0.9)'); grd.addColorStop(0.6, 'rgba(90,90,90,0.5)'); grd.addColorStop(1, 'rgba(154,154,154,0)');
      g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, rr * 1.4, rr, r() * 3, 0, 7); g.fill();
    }
  }, 'asphaltR', { repeat, linear: true });
  const col = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#1b1d20'; g.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 9000; i++) { const v = 20 + r() * 30; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
  }, 'asphaltC', { repeat });
  return { map: col, roughnessMap: rough, roughness: 0.85, metalness: 0.15 };
}
export function asphaltMaterial(repeat = [6, 30]) {
  const pbr = kitPBR('wetAsphalt', { color: 0x2e3033, stone: 0x5e5c5a, puddles: 0.4, cracks: 0.55, wear: 0.45, wet: 0.55 }, 0, repeat,
    // no AO map: its specular occlusion would dim the neon mirrored in the wet street (the look the street is built on)
    { hero: true, ao: false, roughness: 0.92, metalness: 0.15, envMapIntensity: 1.2, legacy: () => asphaltLegacy(repeat) });
  if (pbr) return pbr;
  return new THREE.MeshStandardMaterial({ ...asphaltLegacy(repeat), envMapIntensity: 1.2 });
}

function tileLegacy(base, grout, repeat, opts) {
  const map = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = grout; g.fillRect(0, 0, w, h);
    const r = rng(base.length * 13);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const c = new THREE.Color(base).offsetHSL(0, 0, (r() - 0.5) * 0.04);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
  }, 'tile' + base + grout, { repeat });
  return { map, roughness: opts.roughness ?? 0.35, metalness: opts.metalness ?? 0.1 };
}
export function tileMaterial(base = '#3a3d42', grout = '#202226', repeat = [8, 8], opts = {}) {
  // 4 x 4 tiles per repeat like the canvas version; grout baked at a quarter of the tile (linear), the mission's
  // grout / tile contrast is kept within that (missions use 0.16-0.31); tile body roughness ~0.45 in the bake
  const pbr = kitPBR('ceramicTile', { color: NEUTRAL, grout: 0x646464, count: 4, gloss: 0.2, variation: 0.35, lippage: 1, joint: 0.0055 }, 0, repeat,
    { color: tintOf(base), roughness: Math.min(2.2, (opts.roughness ?? 0.35) / 0.45), metalness: opts.metalness ?? 0.1, legacy: () => tileLegacy(base, grout, repeat, opts) });
  if (pbr) { if (opts.extra) pbr.setValues(opts.extra); return pbr; }
  return new THREE.MeshStandardMaterial({ ...tileLegacy(base, grout, repeat, opts), ...opts.extra });
}

function stoneLegacy(base, repeat, seed) {
  const map = canvasTex(256, 256, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 6; row++) {
      let x = row % 2 ? -20 : 0; const y = row * 43;
      while (x < w) {
        const bw = 40 + r() * 40, c = new THREE.Color(base).offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12);
        g.fillStyle = '#' + c.getHexString(); g.fillRect(x + 2, y + 2, bw - 4, 39);
        for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(x + r() * bw, y + r() * 40, 3, 3); }
        x += bw;
      }
    }
  }, 'stone' + base + seed, { repeat });
  return { map, roughness: 0.92, metalness: 0 };
}
export function stoneMaterial(base = '#9a8466', repeat = [2, 2], seed = 3) {
  // ashlar: 6 courses per repeat like the canvas version, two bake variants (by seed parity)
  const pbr = kitPBR('cutStone', { color: NEUTRAL, joint: 0x8a8a8a, variation: 0.6, weathering: 0.3, rows: 6 }, seed & 1, repeat,
    { color: tintOf(base, 1.08), roughness: 1.12, metalness: 0, legacy: () => stoneLegacy(base, repeat, seed) });
  const m = pbr || new THREE.MeshStandardMaterial(stoneLegacy(base, repeat, seed));
  m.userData.rzKit = 'stone';   // box() adds masonry detail to house-sized stone boxes
  return m;
}

function concreteLegacy(base, repeat, opts) {
  const map = canvasTex(256, 256, (g, w, h) => {
    const r = rng(base.charCodeAt(2));
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); }
    if (opts.stains) for (let i = 0; i < 8; i++) { const x = r() * w; const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, 'rgba(20,30,10,0.0)'); grd.addColorStop(1, 'rgba(20,30,10,0.35)'); g.fillStyle = grd; g.fillRect(x, 0, 6 + r() * 20, h); }
  }, 'conc' + base + !!opts.stains, { repeat });
  return { map, roughness: opts.roughness ?? 0.85, metalness: 0.02 };
}
export function concreteMaterial(base = '#6d6e70', repeat = [2, 2], opts = {}) {
  const pbr = kitPBR('concrete', { color: NEUTRAL, formwork: 0.35, stains: opts.stains ? 0.95 : 0.2, pores: 0.6, slabs: 0, cracks: 0.45 }, opts.stains ? 1 : 0, repeat,
    { color: tintOf(base), roughness: (opts.roughness ?? 0.85) / 0.9, metalness: 0.02, legacy: () => concreteLegacy(base, repeat, opts) });
  return pbr || new THREE.MeshStandardMaterial(concreteLegacy(base, repeat, opts));
}

// Tileable cloud noise for sky(): R = billows (4-64 cells), G = fine detail (16-128 cells); generated once (~15 ms).
let cloudTex = null;
function cloudTexture() {
  if (cloudTex) return cloudTex;
  const N = 256, out = new Uint8Array(N * N * 4), r = rng(97);
  const lat = (c) => { const v = new Float32Array(c * c); for (let i = 0; i < v.length; i++) v[i] = r(); return v; };
  const octs = [4, 8, 16, 32, 64, 128].map(c => ({ c, v: lat(c) }));
  const vn = (o, x, y) => {   // tileable value noise at texel (x, y)
    const fx = x * o.c / N, fy = y * o.c / N, ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const c = o.c, x0 = ix % c, y0 = iy % c, x1 = (ix + 1) % c, y1 = (iy + 1) % c, v = o.v;
    const a = v[y0 * c + x0] + (v[y0 * c + x1] - v[y0 * c + x0]) * tx, b = v[y1 * c + x0] + (v[y1 * c + x1] - v[y1 * c + x0]) * tx;
    return a + (b - a) * ty;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let big = 0, wb = 0, amp = 1;
    for (let k = 0; k < 5; k++) { big += vn(octs[k], x, y) * amp; wb += amp; amp *= 0.52; }
    let fine = 0, wf = 0; amp = 1;
    for (let k = 2; k < 6; k++) { fine += vn(octs[k], x, y) * amp; wf += amp; amp *= 0.55; }
    const i = (y * N + x) * 4;
    out[i] = Math.max(0, Math.min(255, ((big / wb - 0.5) * 1.7 + 0.5) * 255));
    out[i + 1] = Math.max(0, Math.min(255, ((fine / wf - 0.5) * 1.6 + 0.5) * 255)); out[i + 2] = 0; out[i + 3] = 255;
  }
  cloudTex = new THREE.DataTexture(out, N, N, THREE.RGBAFormat);
  cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping; cloudTex.magFilter = THREE.LinearFilter;
  cloudTex.minFilter = THREE.LinearMipmapLinearFilter; cloudTex.generateMipmaps = true; cloudTex.needsUpdate = true;
  return cloudTex;
}

// Sky dome. opts: sun, sunDir, stars, left (horizon colour on the -x side), radius, and (docs/RENDERING.md section 12)
// clouds: coverage 0..1 of a drifting cloud deck (default 0.45, 0 = none): undersides lit by the horizon colour (the
// city glow at night, the haze at dusk), edges and silver linings by the sun colour, the sun and stars hidden behind
// them, dissolving into the horizon haze. One texture tap in the existing sky draw on every tier; ?infra=nosky
// (or off) draws the plain gradient.
export function sky(top, horizon, opts = {}) {
  const geo = new THREE.SphereGeometry(opts.radius || 600, 32, 16);
  const clouds = infraOn('sky') ? Math.max(0, Math.min(1, opts.clouds ?? 0.45)) : 0;
  const uClock = { value: 0 }, t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(top) }, uHor: { value: new THREE.Color(horizon) }, uSun: { value: new THREE.Color(opts.sun || 0x000000) }, uSunDir: { value: new THREE.Vector3(...(opts.sunDir || [0, 0.2, -1])).normalize() }, uStars: { value: opts.stars || 0 }, uTime: { value: 0 }, uLeft: { value: new THREE.Color(opts.left ?? horizon) },
      uCloud: { value: clouds }, uCloudTex: { value: clouds > 0 ? cloudTexture() : null }, uClock },
    defines: { CLOUDS: clouds > 0 ? 1 : 0 },
    vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uTop,uHor,uSun,uSunDir,uLeft; uniform float uStars,uTime,uCloud,uClock; uniform sampler2D uCloudTex; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ float y=max(vD.y,0.0); vec3 hor=mix(uLeft,uHor,smoothstep(-0.6,0.6,vD.x)); vec3 c=mix(hor,uTop,pow(y,0.55));
        float s=max(dot(vD,uSunDir),0.0); c+=uSun*(pow(s,8.0)*0.6+pow(s,300.0)*4.0);
        vec3 q=floor(vD*420.0); float st=step(0.9975,h(q))*uStars*smoothstep(0.05,0.4,vD.y)*(0.6+0.4*sin(uTime*2.0+h(q)*40.0));
        c+=vec3(st);
        #if CLOUDS
          if (vD.y > 0.0) {
            vec2 cuv = vD.xz / (vD.y + 0.12) * 0.5 + vec2(uClock * 0.0016, uClock * 0.0007);
            vec4 nt = texture2D(uCloudTex, cuv);
            float n = nt.r * 0.74 + nt.g * 0.26;
            float dens = smoothstep(1.0 - uCloud, 1.0 - uCloud * 0.35, n) * smoothstep(0.0, 0.2, vD.y);
            vec3 under = mix(hor * 1.3, mix(hor, uTop, 0.45), smoothstep(0.0, 0.75, vD.y));
            vec3 cc = under * mix(1.0, 0.72, smoothstep(0.62, 1.0, n)) + uSun * (0.25 + 1.4 * pow(s, 5.0)) * (1.15 - n * 0.6);
            c = mix(c, cc, dens * 0.9) + uSun * pow(s, 24.0) * dens * (1.0 - dens) * 2.5;
          }
        #endif
        gl_FragColor=vec4(c,1.0); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = -10; m.frustumCulled = false;
  if (clouds > 0) m.onBeforeRender = () => { uClock.value = ((typeof performance !== 'undefined' ? performance.now() : 0) - t0) / 1000; };
  return m;
}

// Rain around the camera. Can freeze (Zero Second). Same API as before the rendering upgrade (count, area, color;
// .mesh, .update(dt, cam), .frozen), but drawn as camera-facing streak quads animated on the GPU (docs/RENDERING.md,
// section 12): no per-frame CPU loop or buffer upload, width kept >= ~1 px with the alpha scaled by coverage (no 1 px
// scratches at a constant brightness, distant rain thins out into the fog), per-drop brightness and length variation,
// and frozen drops shorten into hanging beads. ?infra=norain (or off) builds the legacy line streaks.
// Plain (non-instanced) geometry: every vertex carries its drop's random vec4, because tiny instances (2-4 vertices)
// run poorly on phone GPUs and on ANGLE / SwiftShader (m1a, low: instanced +7 % of the frame, plain = the old CPU rain).
function rainGeometry(count, lines, seed = 42) {
  const corner = lines ? [[0, 0], [0, 1]] : [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]], nv = corner.length;
  const pos = new Float32Array(count * nv * 3), aS = new Float32Array(count * nv * 4), r = rng(seed);
  for (let i = 0; i < count; i++) {
    const d = [r(), r(), r(), r()];
    for (let k = 0; k < nv; k++) { const v = i * nv + k; pos[v * 3] = corner[k][0]; pos[v * 3 + 1] = corner[k][1]; aS.set(d, v * 4); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(aS, 4));
  if (!lines) {
    const idx = new Uint32Array(count * 6);
    for (let i = 0; i < count; i++) idx.set([0, 1, 2, 0, 2, 3].map(x => x + i * 4), i * 6);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}
const RAIN_VS = `attribute vec4 aS; uniform float uT, uSpeed, uLen, uW, uViewH; uniform vec3 uArea, uOff; varying float vA; varying float vX;
  #include <fog_pars_vertex>
  void main(){
    float sp = uSpeed * (0.82 + aS.w * 0.36);
    vec3 vel = vec3(sp * 0.035, -sp, sp * 0.012);
    vec3 ctr = cameraPosition + uOff;
    vec3 p = (aS.xyz - 0.5) * uArea + vel * uT;
    p = mod(p - ctr + uArea * 0.5, uArea) - uArea * 0.5 + ctr;
    vec3 axis = normalize(vel);
    vec3 toCam = cameraPosition - p; float dist = length(toCam);
    vec3 side = normalize(cross(axis, toCam / max(dist, 1e-3)));
    vec4 vp = viewMatrix * vec4(p, 1.0);
    // world size of one pixel at this depth; streaks never get thinner than ~1.1 px, their alpha carries the coverage
    float px = max(-vp.z, 0.05) * 2.0 / (projectionMatrix[1][1] * uViewH);
    #if RZ_LINES
      float w = max(uW, px);   // 1 px GL lines (phone tiers): same animation and fades, the line rasterizer's cost
    #else
      float w = max(uW, px * 1.1);
    #endif
    float L = uLen * (0.7 + fract(aS.w * 7.13) * 0.6);
    #if RZ_LINES
      vec3 wp = p + axis * (position.y - 0.5) * L;
    #else
      vec3 wp = p + side * position.x * w + axis * (position.y - 0.5) * L;
    #endif
    vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
    vA = sqrt(uW / w) * smoothstep(0.6, 2.5, dist) * (0.55 + fract(aS.x * 13.7 + aS.y * 3.1) * 0.9);
    vX = position.x * 2.0;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const RAIN_FS = `uniform vec3 uCol; uniform float uOp; varying float vA; varying float vX;
  #include <fog_pars_fragment>
  void main(){
    #if RZ_LINES
      float a = 1.0;
    #else
      float a = 1.0 - vX * vX;
    #endif
    gl_FragColor = vec4(uCol, a * uOp * vA);
    #include <fog_fragment>
  }`;
export class Rain {
  constructor(count = 5000, area = 40, color = 0x9fc4dd) {
    this.count = count; this.area = area; this.frozen = false; this.center = new THREE.Vector3();
    if (!infraOn('rain')) { this._legacy(count, area, color); return; }
    this.legacy = false; this.vel = new Float32Array(0);
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uT: { value: 0 }, uSpeed: { value: 22 }, uLen: { value: 0.62 }, uW: { value: 0.0045 }, uArea: { value: new THREE.Vector3(area, 30, area) },
      uOff: { value: new THREE.Vector3(0, 7, 0) }, uCol: { value: new THREE.Color(color) }, uOp: { value: 0.6 },
    }]);
    this.uniforms.uViewH = RZ.shared.viewH;   // kept current by the engine
    this._len = 0.62;
    // high: soft-edged streak quads; phone tiers (low / medium): the same drops as 1 px GL lines, which SwiftShader and
    // phone GPUs rasterize at the old line rain's cost (docs/RENDERING.md section 12)
    const lines = RZ.getQuality() !== 'high';
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, fog: true, defines: { RZ_LINES: lines ? 1 : 0 } });
    if (lines) this.uniforms.uOp.value = 0.5;
    this.mesh = lines ? new THREE.LineSegments(rainGeometry(count, true), mat) : new THREE.Mesh(rainGeometry(count, false), mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; this.mesh.raycast = () => {};
    // the engine makes the scene wet while rain is visible; env-probe captures and static batching skip the streaks
    this.mesh.userData.rzRain = true; this.mesh.userData.noCapture = true; this.mesh.userData.noBatch = true;
    Object.defineProperty(this.mesh, 'rzRainSystem', { value: this });   // tools reach the Rain from its mesh (not in userData: clone() JSON-copies it)
  }
  update(dt, cam) {
    if (this.legacy) return this._legacyUpdate(dt, cam);
    const U = this.uniforms;
    if (cam) this.center.copy(cam.position);
    // frozen drops keep their place and shorten into hanging beads; they stretch back into streaks when time resumes
    const k = 1 - Math.exp(-Math.min(dt, 0.25) * 10);
    U.uLen.value += ((this.frozen ? 0.07 : this._len) - U.uLen.value) * k;
    if (this.frozen) return;
    U.uT.value = (U.uT.value + dt) % 3600;
  }
  _legacy(count, area, color) {
    this.legacy = true;
    const pos = new Float32Array(count * 6); this.vel = new Float32Array(count);
    const r = rng(42);
    for (let i = 0; i < count; i++) {
      const x = (r() - 0.5) * area, y = r() * 30, z = (r() - 0.5) * area;
      pos.set([x, y, z, x + 0.02, y + 0.55, z], i * 6); this.vel[i] = 18 + r() * 8;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false }));
    this.mesh.frustumCulled = false;
    this.mesh.userData.rzRain = true; this.mesh.userData.noCapture = true;
  }
  _legacyUpdate(dt, cam) {
    const p = this.mesh.geometry.attributes.position.array, A = this.area, cx = cam.position.x, cz = cam.position.z, cy = cam.position.y;
    if (this.frozen) return;
    for (let i = 0; i < this.count; i++) {
      const o = i * 6; let y = p[o + 1] - this.vel[i] * dt;
      let x = p[o], z = p[o + 2];
      if (y < cy - 6 || x - cx > A / 2 || cx - x > A / 2 || z - cz > A / 2 || cz - z > A / 2) {
        y = cy + 10 + Math.random() * 14;
        if (x - cx > A / 2 || cx - x > A / 2) x = cx + (Math.random() - 0.5) * A;
        if (z - cz > A / 2 || cz - z > A / 2) z = cz + (Math.random() - 0.5) * A;
      }
      p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = x + 0.02; p[o + 4] = y + 0.55; p[o + 5] = z;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

// Floating dust / spores / embers
export class Motes {
  constructor(count, box, color = 0xffd9a0, size = 0.06, speed = 0.3) {
    const pos = new Float32Array(count * 3); const r = rng(5);
    for (let i = 0; i < count; i++) pos.set([box[0] + r() * (box[3] - box[0]), box[1] + r() * (box[4] - box[1]), box[2] + r() * (box[5] - box[2])], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tex = canvasTex(64, 64, (c) => { const grd = c.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, '#fff'); grd.addColorStop(0.3, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = grd; c.fillRect(0, 0, 64, 64); }, 'mote');
    this.mesh = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.box = box; this.speed = speed; this.t = 0; this.frozen = false;
  }
  update(dt) {
    if (this.frozen) return; this.t += dt;
    const p = this.mesh.geometry.attributes.position.array, b = this.box;
    for (let i = 0; i < p.length; i += 3) {
      p[i] += Math.sin(this.t * 0.5 + i) * dt * this.speed; p[i + 1] += Math.cos(this.t * 0.3 + i * 0.7) * dt * this.speed * 0.6 + dt * this.speed * 0.2;
      if (p[i + 1] > b[4]) p[i + 1] = b[1];
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

// Level box. Two kinds are upgraded in place (opts.detail = false keeps the plain box):
//  * a box textured with facadeTextures() and at least 8 m tall becomes a real building: interior-mapped windows with
//    frames and sills, cornices, ledges, fire escapes, balconies, AC units, pipes, rooftop plant and the era's retrofits
//    (LED strips, sign panels, canopies). Its geometry is built on the first frame its scene renders
//    (resolveFacades(), called by the engine), so it can keep clear of what the scene placed around it (signs, awnings,
//    lamps, neighbours): faces against a neighbour become party walls, a ground floor the scene dressed is left plain,
//    the other street faces get shops. Camera blockers still ray-test the plain box.
//  * a house-sized box with a stoneMaterial() gets a plinth course, corner quoins, a timber wall plate and beam ends
//    (child meshes that share the box's material; the engine merges them across houses).
export function box(w, h, d, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true;
  if (opts.detail !== false && mat && !Array.isArray(mat)) detailBox(m, w, h, d, mat, opts);
  return m;
}

// ---------- facade buildings and masonry (docs/RENDERING.md, stage 4) ----------
const FACADES = [];   // facade boxes waiting for their scene's first frame
function detailBox(m, w, h, d, mat, opts) {
  const fac = mat.map?.userData?.rzFacade || mat.emissiveMap?.userData?.rzFacade;
  if (fac && infraOn('facade') && h >= 8 && Math.min(w, d) >= 4) {
    m.userData.rzFacadeBox = { w, h, d, seed: fac.seed, style: fac.style, era: opts.era || fac.era || '2049', far: !mat.map, legacy: mat, built: false };
    m.raycast = boxRaycast;
    FACADES.push(m);
    return;
  }
  if (mat.userData?.rzKit === 'stone' && infraOn('masonry') && h >= 2.4 && h <= 12 && Math.min(w, d) >= 2.5) masonry(m, w, h, d, mat);
}
const _ray = new THREE.Ray(), _inv = new THREE.Matrix4(), _bb = new THREE.Box3(), _hit = new THREE.Vector3();
// Camera blockers (player.js) ray-test the building's plain box, not every rung of its fire escapes.
function boxRaycast(raycaster, hits) {
  const b = this.userData.rzFacadeBox;
  if (!b) { THREE.Mesh.prototype.raycast.call(this, raycaster, hits); return; }
  _inv.copy(this.matrixWorld).invert(); _ray.copy(raycaster.ray).applyMatrix4(_inv);
  _bb.min.set(-b.w / 2, -b.h / 2, -b.d / 2); _bb.max.set(b.w / 2, b.h / 2, b.d / 2);
  if (!_ray.intersectBox(_bb, _hit)) return;
  _hit.applyMatrix4(this.matrixWorld);
  const dist = raycaster.ray.origin.distanceTo(_hit);
  if (dist < raycaster.near || dist > raycaster.far) return;
  hits.push({ distance: dist, point: _hit.clone(), object: this });
}
const rootOf = o => { while (o.parent) o = o.parent; return o; };
// world AABB of a mesh from its geometry's bounding box (cheap, no vertex walk)
function meshAABB(o, out = new THREE.Box3()) {
  if (o.isInstancedMesh) { if (!o.boundingBox) o.computeBoundingBox(); return out.copy(o.boundingBox).applyMatrix4(o.matrixWorld); }
  const g = o.geometry; if (!g) return out.makeEmpty();
  if (!g.boundingBox) g.computeBoundingBox();
  return out.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
}
function facadeAABB(o, out = new THREE.Box3()) {
  const b = o.userData.rzFacadeBox;
  out.min.set(-b.w / 2, -b.h / 2, -b.d / 2); out.max.set(b.w / 2, b.h / 2, b.d / 2);
  return out.applyMatrix4(o.matrixWorld);
}
/**
 * Build the facade boxes of `scene` that are still plain (called by the engine every frame; returns at once when
 * none are waiting). Missions that render without the engine can call it once after building the scene.
 */
/** Timings of the last resolveFacades() that built something (ms): scan, probes + avoid tests, geometry, material. */
export const facadeStats = { n: 0, scan: 0, probe: 0, geometry: 0, material: 0, total: 0, avoidCalls: 0 };
export function resolveFacades(scene) {
  if (!FACADES.length) return 0;
  const mine = [];
  for (let i = FACADES.length - 1; i >= 0; i--) {
    const m = FACADES[i], ud = m.userData.rzFacadeBox;
    if (!ud || ud.built) { FACADES.splice(i, 1); continue; }
    if (rootOf(m) === scene) { mine.push(m); FACADES.splice(i, 1); }
    else if ((ud.wait = (ud.wait || 0) + 1) > 1800) FACADES.splice(i, 1);   // never added to a rendered scene
  }
  if (!mine.length) return 0;
  const t0 = performance.now();
  scene.updateMatrixWorld(true);
  // every other mesh of the scene is an obstacle the new geometry keeps clear of (characters, sky domes, ground
  // planes and other huge things excluded); facade boxes count with their plain box
  const obst = [], fac = [];
  const visit = o => {
    if (o.userData.character || o.userData.rzBatch) return;   // characters move; merged copies duplicate their sources
    if (o.userData.rzFacadeBox) { fac.push({ o, b: facadeAABB(o) }); return; }
    if ((o.isMesh || o.isInstancedMesh) && !o.userData.noCapture) {
      const b = meshAABB(o), s = b.getSize(_hit);
      // sprawling things (ground planes, merged street runs, skies: two sides over 12 m) are too coarse to test against
      const big = (s.x > 12) + (s.y > 12) + (s.z > 12);
      if (isFinite(s.x) && Math.max(s.x, s.z) <= 80 && big < 2 && !(s.y < 0.3 && b.max.y < 0.35)) obst.push({ o, b, s: s.clone() });
    }
    for (const c of o.children) visit(c);
  };
  visit(scene);
  Object.assign(facadeStats, { n: mine.length, scan: performance.now() - t0, probe: 0, geometry: 0, material: 0, avoidCalls: 0 });
  for (const m of mine) {
    try { buildFacade(m, obst, fac); } catch (e) { console.warn('kit: facade upgrade failed, keeping the plain box', e); }
  }
  facadeStats.total = performance.now() - t0;
  return facadeStats.total;
}
const FACE_DIRS = [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0]];   // building front (+z), right (+x), back, left
const _v = new THREE.Vector3(), _q = new THREE.Box3();
function buildFacade(m, obst, fac) {
  const tb = performance.now();
  const ud = m.userData.rzFacadeBox, { w, h, d } = ud;
  const self = facadeAABB(m), M = m.matrixWorld, R3 = new THREE.Matrix3().setFromMatrix4(M);
  // probe slab in front of a local face direction k: out from the face by [o0, o1], across `span` of its width, y [y0, y1]
  const probe = (k, o0, o1, y0, y1, span = 0.9) => {
    const [dx, , dz] = FACE_DIRS[k], half = (dx ? d : w) / 2 * span, ext = (dx ? w : d) / 2;
    const c = new THREE.Vector3(dx * (ext + (o0 + o1) / 2), -h / 2 + (y0 + y1) / 2, dz * (ext + (o0 + o1) / 2));
    const e = new THREE.Vector3(dx ? (o1 - o0) / 2 : half, (y1 - y0) / 2, dz ? (o1 - o0) / 2 : half);
    _q.min.copy(c).sub(e); _q.max.copy(c).add(e);
    return _q.clone().applyMatrix4(M);
  };
  const along = (k) => { const [dx, , dz] = FACE_DIRS[k]; return _v.set(dz ? 1 : 0, 0, dx ? 1 : 0).applyMatrix3(R3).normalize().clone(); };
  const coverage = (k, box, list) => {   // fraction of the face's width covered by boxes in `list` overlapping `box`
    const a = along(k), segs = [];
    const fc = self.getCenter(new THREE.Vector3()), L = (FACE_DIRS[k][0] ? d : w);
    for (const it of list) {
      if (it.o === m || !it.b.intersectsBox(box)) continue;
      const lo = Math.max(-L / 2, Math.min(it.b.min.clone().sub(fc).dot(a), it.b.max.clone().sub(fc).dot(a))), hi = Math.min(L / 2, Math.max(it.b.min.clone().sub(fc).dot(a), it.b.max.clone().sub(fc).dot(a)));
      if (hi > lo) segs.push([lo, hi]);
    }
    segs.sort((p, q) => p[0] - q[0]); let cov = 0, cur = -Infinity;
    for (const [lo, hi] of segs) { if (hi <= cur) continue; cov += hi - Math.max(lo, cur); cur = hi; }
    return cov / L;
  };
  const info = [0, 1, 2, 3].map(k => {
    const party = coverage(k, probe(k, 0.02, 0.6, 0.5, Math.min(h - 0.5, 12)), fac) > 0.5;
    const dressed = !ud.far && coverage(k, probe(k, -0.05, 1.3, 0.3, 5.2), obst.filter(it => Math.max(it.s.x, it.s.z) > 1.8)) > 0.3;
    const street = obst.reduce((n, it) => n + (it.b.intersectsBox(probe(k, 0, 12, 0, 8)) ? 1 : 0), 0);
    return { party, dressed, street };
  });
  // the main (street) face becomes the building's front: most scene dressing in front of it, open, longest
  let main = 0, best = -1;
  info.forEach((f, k) => { const sc = (f.party ? -1000 : 0) + f.street * 10 + (FACE_DIRS[k][0] ? d : w) * 0.01; if (sc > best) { best = sc; main = k; } });
  const yaw = [0, Math.PI / 2, Math.PI, -Math.PI / 2][main];
  const width = FACE_DIRS[main][0] ? d : w, depth = FACE_DIRS[main][0] ? w : d;
  // building-local face j (front, right, back, left) -> box face index (FACE_DIRS[k] = R_y(k * 90 deg) * +z)
  const toBox = j => (main + j) % 4;
  const r = rng((ud.seed + 1) * 7919 + Math.round(self.min.x * 13 + self.min.z * 7 + h * 3));
  const glass = ud.style === 'glass' || ud.far;
  const wall = glass ? (r() < 0.75 ? 'panel' : 'concrete') : ['concrete', 'darkBrick', 'brick', 'panel', 'plaster', 'darkBrick'][Math.floor(r() * 6)];
  const faces = [0, 1, 2, 3].map(j => { const f = info[toBox(j)]; return f.party ? 'blank' : (j === 0 && !ud.far ? 'shop' : 'windows'); });
  const groundBlank = [0, 1, 2, 3].map(j => info[toBox(j)].dressed);
  const pad = 0.04;
  const avoid = (mn, mx) => {
    facadeStats.avoidCalls++;
    _q.min.copy(mn).addScalar(-pad); _q.max.copy(mx).addScalar(pad);
    for (const it of obst) if (it.b.intersectsBox(_q)) return true;
    for (const it of fac) if (it.o !== m && it.b.intersectsBox(_q)) return true;
    return false;
  };
  // building-local avoid: the builder hands world AABBs relative to its own frame, which is the box's local frame
  const avoidLocal = (mn, mx) => {
    const b = new THREE.Box3(mn, mx).applyMatrix4(M);
    return avoid(b.min, b.max);
  };
  const tall = h > 60, low = RZ.getQuality() !== 'high';   // phone tiers: no balusters / treads / rungs (sub-pixel there)
  const o = {
    width, depth, height: h, base: -h / 2, yaw, seed: ud.seed * 17 + Math.floor(r() * 1000), era: ud.era, wall, faces, groundBlank, avoid: avoidLocal,
    detail: low || ud.far ? 'low' : 'high', groundLedge: !groundBlank[0],
  };
  if (glass) Object.assign(o, { floorHeight: 3.5 + r() * 0.4, bay: 2.6 + r() * 0.8, windowWidth: undefined, mullion: 3, ledges: 0, balconies: 0, cornice: false, fireEscape: false });
  if (glass) { const bay = o.bay; o.windowWidth = bay * 0.86; o.windowHeight = o.floorHeight * 0.74; o.sill = o.floorHeight * 0.13; }
  if (ud.far) Object.assign(o, { ac: 0, pipes: 0, holo: tall ? 0 : (r() < 0.3 ? 1 : 0), cables: 0, roof: { bulkhead: r() < 0.5, hvac: 1, tank: false, antenna: r() < 0.5 ? 1 : 0, billboard: false, dish: false } });
  const tg = performance.now(); facadeStats.probe += tg - tb;
  const geo = RZ.facadeGeometry(o);
  const tm = performance.now(); facadeStats.geometry += tm - tg;   // includes the avoid() tests
  ud.legacyGeo = m.geometry; ud.geo = geo;   // the plain box is kept for A/B captures (setInfraLegacy)
  m.geometry = geo;
  m.material = ud.mat = RZ.windowInteriorMaterial({ lit: 0.42, daylight: 0, interior: 1.25 });
  facadeStats.material += performance.now() - tm;
  ud.built = true; ud.info = { faces, groundBlank, main, wall, triangles: geo.index.count / 3 };
}

/**
 * A/B switch for captures and cost measurements: legacy = true shows the scene's upgraded kit objects as they were
 * before the infrastructure upgrade (plain facade boxes with the mission's material, no masonry, legacy lamp posts),
 * false shows the upgrade again. Returns the number of objects switched.
 */
export function setInfraLegacy(scene, legacy) {
  let n = 0; const swaps = [];
  scene.traverse(o => {
    const f = o.userData.rzFacadeBox;
    if (f && f.built) { o.geometry = legacy ? f.legacyGeo : f.geo; o.material = legacy ? f.legacy : f.mat; n++; }
    if (o.userData.rzMasonry) { o.userData.rzMasonry.visible = !legacy; n++; }
    if (o.userData.rzSwap) swaps.push(o);
  });
  for (const o of swaps) { o.userData.rzSwap(legacy); n++; }
  return n;
}

// Masonry detail for house-sized stone boxes (m.userData.rzMasonry = the child group).
let woodMat = null;
function masonry(m, w, h, d, mat) {
  const stone = [], wood = [], add = (list, sx, sy, sz, x, y, z) => { const g = new THREE.BoxGeometry(sx, sy, sz); worldUV(g, sx, sy, sz); g.translate(x, y, z); list.push(g); };
  const hw = w / 2, hd = d / 2, y0 = -h / 2;
  add(stone, w + 0.1, 0.36, d + 0.1, 0, y0 + 0.18, 0);   // plinth course
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (let y = 0.4, k = 0; y < h - 0.5; y += 0.44, k++) {   // quoins
    const lx = k % 2 ? 0.5 : 0.32, lz = k % 2 ? 0.32 : 0.5;
    add(stone, lx, 0.4, lz, sx * (hw - lx / 2 + 0.03), y0 + y + 0.2, sz * (hd - lz / 2 + 0.03));
  }
  add(wood, w + 0.12, 0.16, d + 0.12, 0, y0 + h - 0.08, 0);   // timber wall plate under the roof
  if (Math.max(w, d) < 9) {
    const longX = w >= d, n = Math.max(3, Math.round((longX ? w : d) / 0.85));
    for (let i = 0; i < n; i++) {
      const t = -0.5 + (i + 0.5) / n;
      for (const s of [-1, 1]) {
        if (longX) add(wood, 0.15, 0.15, 0.42, t * (w - 0.5), y0 + h - 0.32, s * (hd + 0.14)); else add(wood, 0.42, 0.15, 0.15, s * (hw + 0.14), y0 + h - 0.32, t * (d - 0.5));
      }
    }
  }
  const grp = new THREE.Group(); grp.name = 'masonry';
  const sm = new THREE.Mesh(mergeGeometries(stone), mat); sm.castShadow = m.castShadow; sm.receiveShadow = true;
  if (!woodMat) woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3322, map: woodTexture(), roughness: 0.88, metalness: 0 });
  const wm = new THREE.Mesh(mergeGeometries(wood), woodMat); wm.castShadow = m.castShadow; wm.receiveShadow = true;
  grp.add(sm, wm); m.add(grp); m.userData.rzMasonry = grp;
}
// box uvs in meters / 3 (close to the repeat the missions give their stone textures on house walls)
function worldUV(g, sx, sy, sz) {
  const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const su = ax > 0.5 ? sz : sx, sv = ay > 0.5 ? sz : sy;
    uv.setXY(i, uv.getX(i) * su / 3, uv.getY(i) * sv / 3);
  }
}
function woodTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const r = rng(77); g.fillStyle = '#6e5038'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${40 + r() * 30},${25 + r() * 20},${12 + r() * 10},${0.25 + r() * 0.3})`; g.fillRect(0, y, w, 1 + r() * 2); }
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(20,12,6,0.35)'; g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 5, 1.5, 0, 0, 7); g.fill(); }
  }, 'kitWood', { repeat: [1, 1] });
}

export function glowMat(color, intensity = 3) { return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(color), emissiveIntensity: intensity }); }

// Fake reflection streak on wet ground beneath a light source
export function puddleGlow(color, w = 1.2, l = 6, opacity = 0.35) {
  const tex = canvasTex(64, 256, (g, W, H) => {
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const gx = g.createLinearGradient(0, 0, W, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, W, H);
  }, 'puddle');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
}

// Black stone ring with glowing runes: the Chronolith
export function chronolith(scale = 1, opts = {}) {
  const g = new THREE.Group();
  const stone = new THREE.MeshPhysicalMaterial({ color: opts.stone || 0x0b0c0f, roughness: 0.25, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.2 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.42, 24, 96), stone); ring.castShadow = true; g.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.08, 12, 96), glowMat(opts.color || 0x5fe6ff, 2.5)); g.add(inner);
  const runes = new THREE.Group();
  const runeTex = canvasTex(1024, 64, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 3; const r = rng(11);
    for (let x = 10; x < w; x += 26) { c.beginPath(); for (let k = 0; k < 4; k++) { const px = x + r() * 16, py = 12 + r() * 40; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); if (r() < 0.4) { c.beginPath(); c.arc(x + 8, 32, 6, 0, 7); c.stroke(); } }
  }, 'runes');
  runeTex.wrapS = THREE.RepeatWrapping; runeTex.repeat.set(3, 1);
  const runeBand = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 96, 1, true), new THREE.MeshBasicMaterial({ map: runeTex, color: new THREE.Color(opts.color || 0x5fe6ff).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  runeBand.rotation.x = Math.PI / 2; runeBand.scale.set(1.0, 1, 1.0); runes.add(runeBand); g.add(runes);
  // event horizon disc
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.85, 64), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(opts.color || 0x5fe6ff) }, uPower: { value: opts.power ?? 0.4 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime,uPower; uniform vec3 uColor; varying vec2 vUv;
      void main(){ vec2 c=vUv-0.5; float r=length(c)*2.0; float a=atan(c.y,c.x);
        float sw=sin(a*6.0+r*14.0-uTime*2.5)*0.5+0.5; float core=smoothstep(1.0,0.0,r);
        float rings=sin(r*40.0-uTime*4.0)*0.5+0.5;
        vec3 col=uColor*(sw*0.6+rings*0.3)*core*uPower*2.0 + vec3(1.0)*pow(core,6.0)*uPower;
        gl_FragColor=vec4(col, (core*0.85)*uPower); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  g.add(disc);
  // floating halo fragments ("broken halos")
  const frags = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.TorusGeometry(3.1 + i * 0.45, 0.04, 6, 80, Math.PI * (0.6 + i * 0.3)), glowMat(opts.color || 0x5fe6ff, 1.2 + i * 0.3));
    f.rotation.set(Math.random() * 3, Math.random() * 3, 0); frags.add(f);
  }
  g.add(frags);
  g.scale.setScalar(scale);
  g.userData = { disc, runes, frags, inner, update(t) { disc.material.uniforms.uTime.value = t; runeTex.offset.x = t * 0.02; frags.children.forEach((f, i) => { f.rotation.x += 0.003 * (i + 1); f.rotation.y += 0.002 * (i + 1); }); } };
  return g;
}

// A cable / hose along points. Given an organic material (non-metal, rough, green-dominant: the 2196 vines), medium
// and high build a vine instead: tapering to about half its radius toward its end, with a slight irregular swell
// and wobble, a shared bark material (realism 'bark' with moss, the authored colour desaturated and pulled toward a
// woody olive, u around / v along in metres) and, on high, a few ivy leaf cards along it (one shared foliage
// material: the static batcher merges them). Dark cables (the default black material) and every other material keep the plain tube.
export function cableCurve(points, radius = 0.05, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const q = RZ.getQuality();
  if (mat && isVineMaterial(mat)) {
    // low: the same tapering, wobbling stem in a plain woody colour (no bark maps, no leaves: the old tube's cost)
    try { return vineMesh(curve, radius, mat, q === 'high', q === 'low'); } catch (e) { console.warn('vine', e); }
  }
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 8, false), mat || new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
  m.castShadow = true; return m;
}
function isVineMaterial(m) {
  if (!m.isMeshStandardMaterial || m.map || (m.metalness ?? 0) > 0.2 || (m.roughness ?? 1) < 0.7 || m.transparent) return false;
  const c = m.color; return c.g > c.r * 1.15 && c.g > c.b * 1.15;
}
const vineMats = new Map();
let vineLeafMat = null, vineSeed = 1;
function vineMaterial(mat, plain) {
  let v = vineMats.get(plain ? mat.uuid + ':plain' : mat);
  if (v) return v;
  // the authored green, desaturated and pulled toward a woody olive brown (old stems lignify; moss keeps the green)
  const c = mat.color.clone(), l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  c.lerp(new THREE.Color(l, l, l), 0.35).lerp(new THREE.Color(0x4a3f2c), 0.35);
  if (plain) {
    v = new THREE.MeshStandardMaterial({ color: c.lerp(mat.color, 0.2), roughness: 1, metalness: 0, name: 'vineBarkLite' });   // a little of the moss green kept
    vineMats.set(mat.uuid + ':plain', v);
    return v;
  }
  // bark plates stretched along the stem (u: ~6 narrow strands around a 7 cm stem, v: about one plate per metre), so
  // it reads as fibrous vine bark, not as a scaled hose
  v = RZ.pbrMaterial('bark', { params: { color: c.getHex(), lichen: 0.45, depth: 0.6 }, mapping: 'uv', repeat: [2, 0.3], metalness: 0, roughness: 1, tint: 0x8f9a80, normalScale: 0.7 });
  v.userData.rzBatchSafe = true; v.name = 'vineBark';
  vineMats.set(mat, v);
  return v;
}
function vineMesh(curve, radius, mat, leaves, plain = false) {
  const TS = 48, RS = 8, r = rng(vineSeed++ * 7919);
  const frames = curve.computeFrenetFrames(TS, false), len = curve.getLength();
  const P = [], N = [], U = [], I = [], ph = r() * 6.28, ph2 = r() * 6.28;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= TS; i++) {
    const t = i / TS; curve.getPointAt(t, p);
    const Nf = frames.normals[i], Bf = frames.binormals[i];
    // taper, irregular swelling (nodes), a little lateral wobble around the authored path
    const rr = radius * 1.2 * (1 - 0.55 * t) * (0.9 + 0.12 * Math.sin(t * 23 + ph) + 0.07 * Math.sin(t * 61 + ph2));
    const wob = radius * 0.8 * Math.sin(t * 9 + ph) * Math.min(1, t * 6);
    p.addScaledVector(Nf, wob).addScaledVector(Bf, wob * 0.6 * Math.cos(t * 7 + ph2));
    for (let j = 0; j <= RS; j++) {
      const a = j / RS * Math.PI * 2;
      n.copy(Nf).multiplyScalar(Math.cos(a)).addScaledVector(Bf, Math.sin(a));
      P.push(p.x + n.x * rr, p.y + n.y * rr, p.z + n.z * rr); N.push(n.x, n.y, n.z);
      U.push(j / RS * Math.PI * 2 * radius, t * len);
    }
  }
  for (let i = 0; i < TS; i++) for (let j = 0; j < RS; j++) {
    const a = i * (RS + 1) + j, b = a + RS + 1;
    I.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  const m = new THREE.Mesh(g, vineMaterial(mat, plain)); m.castShadow = true; m.name = 'vine';
  if (leaves) {
    // ivy leaf cards: single quads hanging off the stem, more toward the growing end
    const LP = [], LN = [], LU = [], LC = [], LI = [], nl = Math.max(3, Math.round(len * 1.6));
    const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), out = new THREE.Vector3(), q0 = new THREE.Vector3();
    for (let k = 0; k < nl; k++) {
      const t = 0.12 + 0.88 * Math.sqrt(r()); curve.getPointAt(t, q0);
      const fi = Math.min(TS, Math.round(t * TS)), a = r() * Math.PI * 2;
      out.copy(frames.normals[fi]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[fi], Math.sin(a)).normalize();
      side.crossVectors(out, up); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
      const sz = 0.22 + r() * 0.16, hang = new THREE.Vector3().copy(out).multiplyScalar(0.6).addScaledVector(up, -0.8).normalize();
      const base = LP.length / 3, c0 = q0.clone().addScaledVector(out, radius);
      const cn = new THREE.Vector3().crossVectors(side, hang).normalize(), shade = 0.75 + 0.25 * r();
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const pp = c0.clone().addScaledVector(side, (u - 0.5) * sz).addScaledVector(hang, v * sz);
        LP.push(pp.x, pp.y, pp.z); LN.push(cn.x, cn.y, cn.z); LU.push(u, v); LC.push(shade, shade, shade);
      }
      LI.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3)); lg.setAttribute('normal', new THREE.Float32BufferAttribute(LN, 3));
    lg.setAttribute('uv', new THREE.Float32BufferAttribute(LU, 2)); lg.setAttribute('color', new THREE.Float32BufferAttribute(LC, 3)); lg.setIndex(LI);
    if (!vineLeafMat) { vineLeafMat = RZ.foliageMaterial('ivy', { flutter: 0.4, color: 0x7a9064, translucency: 0.45 }); vineLeafMat.userData.rzBatchSafe = true; vineLeafMat.name = 'vineLeaves'; }
    const lm = new THREE.Mesh(lg, vineLeafMat); lm.castShadow = false; lm.name = 'vineLeaves';
    m.add(lm);
  }
  return m;
}
