import * as THREE from 'three';
import { mulberry } from '../core/character.js';

export const rng = mulberry;
const texCache = new Map();

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

// Building facade: returns {map, emissive}
export function facadeTextures(seed, style = 'modern') {
  const key = 'facade' + seed + style;
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
  const out = { map, emissive }; texCache.set(key, out); return out;
}

export function neonTexture(text, color, opts = {}) {
  const key = 'neon' + text + color + (opts.vertical ? 'v' : '');
  const font = opts.font || '700 72px Rajdhani, sans-serif';
  return canvasTex(opts.vertical ? 128 : 512, opts.vertical ? 512 : 128, (g, w, h) => {
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

// Wet asphalt with puddles: roughness + color variation
export function asphaltMaterial(repeat = [6, 30]) {
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
  return new THREE.MeshStandardMaterial({ map: col, roughnessMap: rough, roughness: 0.85, metalness: 0.15, envMapIntensity: 1.2 });
}

export function tileMaterial(base = '#3a3d42', grout = '#202226', repeat = [8, 8], opts = {}) {
  const map = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = grout; g.fillRect(0, 0, w, h);
    const r = rng(base.length * 13);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const c = new THREE.Color(base).offsetHSL(0, 0, (r() - 0.5) * 0.04);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
  }, 'tile' + base + grout, { repeat });
  return new THREE.MeshStandardMaterial({ map, roughness: opts.roughness ?? 0.35, metalness: opts.metalness ?? 0.1, ...opts.extra });
}

export function stoneMaterial(base = '#9a8466', repeat = [2, 2], seed = 3) {
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
  return new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0 });
}

export function concreteMaterial(base = '#6d6e70', repeat = [2, 2], opts = {}) {
  const map = canvasTex(256, 256, (g, w, h) => {
    const r = rng(base.charCodeAt(2));
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); }
    if (opts.stains) for (let i = 0; i < 8; i++) { const x = r() * w; const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, 'rgba(20,30,10,0.0)'); grd.addColorStop(1, 'rgba(20,30,10,0.35)'); g.fillStyle = grd; g.fillRect(x, 0, 6 + r() * 20, h); }
  }, 'conc' + base + !!opts.stains, { repeat });
  return new THREE.MeshStandardMaterial({ map, roughness: opts.roughness ?? 0.85, metalness: 0.02 });
}

export function sky(top, horizon, opts = {}) {
  const geo = new THREE.SphereGeometry(opts.radius || 600, 32, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(top) }, uHor: { value: new THREE.Color(horizon) }, uSun: { value: new THREE.Color(opts.sun || 0x000000) }, uSunDir: { value: new THREE.Vector3(...(opts.sunDir || [0, 0.2, -1])).normalize() }, uStars: { value: opts.stars || 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uTop,uHor,uSun,uSunDir; uniform float uStars,uTime; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ float y=max(vD.y,0.0); vec3 c=mix(uHor,uTop,pow(y,0.55));
        float s=max(dot(vD,uSunDir),0.0); c+=uSun*(pow(s,8.0)*0.6+pow(s,300.0)*4.0);
        vec3 q=floor(vD*420.0); float st=step(0.9975,h(q))*uStars*smoothstep(0.05,0.4,vD.y)*(0.6+0.4*sin(uTime*2.0+h(q)*40.0));
        c+=vec3(st);
        gl_FragColor=vec4(c,1.0); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

// Rain as streak lines around the camera. Can freeze (Zero Second).
export class Rain {
  constructor(count = 5000, area = 40, color = 0x9fc4dd) {
    this.count = count; this.area = area; this.frozen = false;
    const pos = new Float32Array(count * 6); this.vel = new Float32Array(count);
    const r = rng(42);
    for (let i = 0; i < count; i++) {
      const x = (r() - 0.5) * area, y = r() * 30, z = (r() - 0.5) * area;
      pos.set([x, y, z, x + 0.02, y + 0.55, z], i * 6); this.vel[i] = 18 + r() * 8;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false }));
    this.mesh.frustumCulled = false; this.center = new THREE.Vector3();
  }
  update(dt, cam) {
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

export function box(w, h, d, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true;
  return m;
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

export function cableCurve(points, radius = 0.05, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 8, false), mat || new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
  m.castShadow = true; return m;
}
