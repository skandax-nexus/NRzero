import * as THREE from 'three';

// ---------- shared helpers ----------
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const geoCache = new Map();
function cached(key, fn) { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); }
const capsule = (r, l, cs = 6, rs = 14) => cached(`c${r}_${l}_${cs}_${rs}`, () => new THREE.CapsuleGeometry(r, l, cs, rs));
const sphere = (r, w = 28, h = 20) => cached(`s${r}_${w}_${h}`, () => new THREE.SphereGeometry(r, w, h));

// Smooth tapered limb along -Y from 0 to -len. radii: [[t(0..1), r], ...]
function limb(len, radii, seg = 18) {
  return cached('limb' + len + JSON.stringify(radii), () => {
    const r0 = radii[0][1], r1 = radii[radii.length - 1][1];
    const body = [];
    for (let i = radii.length - 1; i >= 0; i--) body.push(new THREE.Vector2(radii[i][1], -len * radii[i][0]));
    const top = [];
    for (let i = 5; i >= 0; i--) { const a = (i / 5) * Math.PI / 2; top.push(new THREE.Vector2(Math.sin(a) * r0 + 1e-4, Math.cos(a) * r0 * 0.9)); }
    // bottom cap (from axis outward), body (bottom to top), top cap (outward to axis)
    const bottom = [];
    for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; bottom.push(new THREE.Vector2(Math.sin(a) * r1 + 1e-4, -len - Math.cos(a) * r1 * 0.9)); }
    const all = [...bottom, ...body, ...top.slice(1)];
    const g = new THREE.LatheGeometry(all, seg);
    return g;
  });
}

function noiseDisplace(geo, amp, freq, seed = 1) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * freq + seed) * Math.cos(v.y * freq * 1.3 + seed * 2.1) * Math.sin(v.z * freq * 0.9 + seed * 3.7);
    const n2 = Math.sin(v.x * freq * 2.7 + seed * 5) * Math.sin(v.z * freq * 2.3 + v.y * 3);
    v.multiplyScalar(1 + (n * 0.7 + n2 * 0.3) * amp);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Fabric micro-detail normal map generated once.
let fabricNormal = null;
function getFabricNormal() {
  if (fabricNormal) return fabricNormal;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const i = (y * 128 + x) * 4;
    const w = Math.sin(x * 0.8) * 0.5 + Math.sin(y * 0.8) * 0.5;
    const n = (Math.random() - 0.5) * 0.35;
    img.data[i] = 128 + (Math.sin(x * 0.8) * 30 + n * 40);
    img.data[i + 1] = 128 + (Math.sin(y * 0.8) * 30 + n * 40);
    img.data[i + 2] = 255 - Math.abs(w) * 20; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  fabricNormal = new THREE.CanvasTexture(c);
  fabricNormal.wrapS = fabricNormal.wrapT = THREE.RepeatWrapping; fabricNormal.repeat.set(6, 6);
  return fabricNormal;
}

export function makeMaterial(kind, color, extra = {}) {
  const c = new THREE.Color(color);
  switch (kind) {
    case 'skin': return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.52, metalness: 0, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xff9c80), clearcoat: 0.08, clearcoatRoughness: 0.6, ...extra });
    case 'leather': return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.42, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.35, ...extra });
    case 'fabric': return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.9, sheen: 1, sheenRoughness: 0.7, sheenColor: c.clone().offsetHSL(0, 0, 0.25), normalMap: getFabricNormal(), normalScale: new THREE.Vector2(0.35, 0.35), ...extra });
    case 'hair': return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, sheen: 1, sheenRoughness: 0.3, sheenColor: c.clone().offsetHSL(0.02, 0.1, 0.25), ...extra });
    case 'metal': return new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.9, ...extra });
    case 'eye': return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, ...extra });
    case 'glow': return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: extra.intensity ?? 3, toneMapped: true });
    default: return new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...extra });
  }
}

// Holographic echo material (temporal residue / memories)
export function makeGhostMaterial(color = 0x5fe6ff) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uAlpha: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(normalMatrix*normal); vec4 mv=viewMatrix*w; vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime,uAlpha; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ float f=pow(1.0-abs(dot(vN,vV)),2.2); float scan=0.55+0.45*sin(vW.y*90.0-uTime*6.0);
        float flick=0.85+0.15*sin(uTime*37.0+vW.x*3.0); float a=(0.12+f*0.9)*scan*flick*uAlpha;
        gl_FragColor=vec4(uColor*(0.6+f*2.2),a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ---------- the humanoid ----------
export class Character {
  constructor(p = {}) {
    this.p = p = Object.assign({
      height: 1.8, build: 1, skin: 0xc68e6a, hair: 0x1a1410, hairStyle: 'short', eyes: 0x4a3420,
      top: 0x2b2f35, topKind: 'leather', pants: 0x23262b, boots: 0x1a1612, coat: null, coatKind: 'fabric',
      gloves: null, beard: null, stubble: false, scar: false, glasses: false, strap: false, wristMark: false,
      cap: null, umbrella: null, female: false, armor: false, belt: 0x2a1d14, vest: null, sash: null, bracelets: null,
    }, p);
    this.root = new THREE.Group();
    this.root.userData.character = this;
    this.shadows = p.shadows ?? true;
    this.meshes = [];
    this.t = Math.random() * 10; this.phase = 0; this.speed = 0; this.crouch = 0; this.talk = 0;
    this.frozen = false; this.lookTarget = null; this.headYaw = 0; this.pose = null;
    this.build();
    const s = p.height / 1.8; this.root.scale.setScalar(s);
  }

  add(parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = this.shadows !== false; m.receiveShadow = !this.p?.lod; parent.add(m); this.meshes.push(m); return m;
  }

  build() {
    const p = this.p, b = p.build, fem = p.female;
    const M = this.mats = {
      skin: makeMaterial('skin', p.skin),
      hair: makeMaterial('hair', p.hair),
      top: makeMaterial(p.topKind, p.top),
      pants: makeMaterial('fabric', p.pants),
      boots: makeMaterial('leather', p.boots, { roughness: 0.5 }),
      eye: makeMaterial('eye', 0xf2efe9), iris: makeMaterial('eye', p.eyes), pupil: makeMaterial('eye', 0x050505),
      lip: makeMaterial('skin', new THREE.Color(p.skin).offsetHSL(-0.02, 0.08, -0.12)),
      brow: makeMaterial('hair', new THREE.Color(p.hair).offsetHSL(0, 0, -0.03)),
      strap: makeMaterial('leather', 0x3b2618), metal: makeMaterial('metal', 0x8a8f96),
      glove: p.gloves ? makeMaterial('leather', p.gloves) : null,
      coat: p.coat ? makeMaterial(p.coatKind, p.coat, { side: THREE.DoubleSide }) : null,
    };
    const R = this.root;
    // hips
    const hips = this.hips = new THREE.Group(); hips.position.y = 0.96; R.add(hips);
    this.add(hips, sphere(0.16), M.pants, 0, -0.01, 0, (fem ? 1.08 : 0.98) * b, 0.62, 0.7);
    if (p.belt) this.add(hips, cached('belt', () => new THREE.CylinderGeometry(0.163, 0.163, 0.05, 28)), makeMaterial('leather', p.belt), 0, 0.07, 0, b * (fem ? 1.05 : 1), 1, 0.74);
    // spine/torso
    const spine = this.spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
    const prof = fem
      ? [[0.001, 0], [0.13, 0.0], [0.122, 0.12], [0.15, 0.27], [0.165, 0.34], [0.15, 0.44], [0.085, 0.52], [0.04, 0.54]]
      : [[0.001, 0], [0.145, 0.0], [0.15, 0.12], [0.175, 0.26], [0.19, 0.38], [0.175, 0.47], [0.09, 0.535], [0.04, 0.55]];
    const torsoGeo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32);
    const torso = this.add(spine, torsoGeo, M.top, 0, 0, 0, b, 1, fem ? 0.66 : 0.62);
    this.torso = torso;
    if (p.armor) { // segmented chest plates
      const am = makeMaterial('leather', new THREE.Color(p.top).offsetHSL(0, 0, 0.06), { metalness: 0.3, clearcoat: 0.9 });
      for (let i = 0; i < 3; i++) this.add(spine, cached('plate' + i, () => new THREE.TorusGeometry(0.155 + i * 0.01, 0.012, 6, 30, Math.PI)), am, 0, 0.2 + i * 0.075, 0.0, b, 1, 0.75).rotation.set(0, 0, 0);
      const seam = makeMaterial('glow', 0x5fe6ff, { intensity: 1.6 });
      this.add(spine, capsule(0.004, 0.32, 2, 4), seam, 0.06, 0.26, 0.105).rotation.z = 0.12;
    }
    if (p.vest) this.add(spine, new THREE.LatheGeometry(prof.slice(1, 6).map(([r, y]) => new THREE.Vector2(r + 0.015, y)), 24), makeMaterial('fabric', p.vest), 0, 0, 0, b, 1, 0.66);
    if (p.sash) { const s = this.add(spine, cached('sash', () => new THREE.TorusGeometry(0.2, 0.025, 8, 30)), makeMaterial('fabric', p.sash), 0, 0.25, 0, b * 0.95, 1, 0.66); s.rotation.set(Math.PI / 2, 0.55, 0); }
    if (p.strap) { // bandolier across chest
      const s = this.add(spine, cached('strap', () => new THREE.TorusGeometry(0.21, 0.018, 6, 36)), M.strap, 0, 0.27, 0, b * 0.94, 1, 0.68); s.rotation.set(Math.PI / 2, 0.62, 0);
      for (let i = 0; i < 4; i++) this.add(spine, cached('pouch', () => new THREE.BoxGeometry(0.035, 0.045, 0.025)), M.strap, -0.07 + i * 0.045, 0.2 + i * 0.05, 0.12).rotation.z = 0.6;
    }
    // collar
    const collar = this.add(spine, cached('collar', () => new THREE.CylinderGeometry(0.075, 0.095, 0.07, 20, 1, true)), M.top, 0, 0.55, 0, 1, 1, 0.9);
    collar.material = M.top;
    // coat skirt
    if (M.coat) {
      const cp = [[0.17, 0.5], [0.2, 0.38], [0.185, 0.2], [0.17, 0.05], [0.2, -0.2], [0.24, -0.45], [0.27, -0.62]];
      const g = new THREE.LatheGeometry(cp.map(([r, y]) => new THREE.Vector2(r, y)), 28, -Math.PI * 0.86 + Math.PI / 2, Math.PI * 1.72);
      this.coatMesh = this.add(spine, g, M.coat, 0, -0.02, 0, b * 1.04, 1, 0.74);
      this.coatMesh.rotation.y = Math.PI;
      // lapels
      this.add(spine, cached('lapel', () => new THREE.BoxGeometry(0.05, 0.22, 0.012)), M.coat, -0.06, 0.4, 0.118, 1, 1, 1).rotation.z = 0.35;
      this.add(spine, cached('lapel', () => new THREE.BoxGeometry(0.05, 0.22, 0.012)), M.coat, 0.06, 0.4, 0.118, 1, 1, 1).rotation.z = -0.35;
    }
    // neck + head
    const neck = this.neck = new THREE.Group(); neck.position.y = 0.53; spine.add(neck);
    this.add(neck, capsule(0.048, 0.07), M.skin, 0, 0.05, 0, fem ? 0.88 : 1, 1, 0.95);
    const head = this.head = new THREE.Group(); head.position.y = 0.11; neck.add(head);
    this.buildHead(head);
    // arms
    this.arms = [-1, 1].map(side => {
      const sh = new THREE.Group(); sh.position.set(side * (fem ? 0.175 : 0.2) * b, 0.46, 0); spine.add(sh);
      this.add(sh, sphere(0.058), M.top, -side * 0.01, -0.005, 0, 1.05, 0.82, 0.92);
      const up = new THREE.Group(); sh.add(up); up.rotation.z = side * 0.08;
      const k = fem ? 0.82 : 1;
      this.add(up, limb(0.29, [[0, 0.052 * k], [0.25, 0.05 * k], [0.55, 0.046 * k], [1, 0.038 * k]]), M.top, 0, -0.01, 0, 1, 1, 0.92);
      const el = new THREE.Group(); el.position.y = -0.29; up.add(el);
      this.add(el, limb(0.25, [[0, 0.04 * k], [0.25, 0.042 * k], [0.7, 0.034 * k], [1, 0.03 * k]]), M.top, 0, 0, 0, 1, 1, 0.9);
      // cuff
      this.add(el, cached('cuff', () => new THREE.CylinderGeometry(0.043, 0.043, 0.04, 14)), M.top, 0, -0.22, 0);
      const hand = new THREE.Group(); hand.position.y = -0.27; el.add(hand);
      const hm = M.glove || M.skin;
      this.add(hand, capsule(0.03, 0.04), hm, 0, -0.035, 0.0, 1, 1, 0.65);
      this.add(hand, capsule(0.013, 0.03), hm, side * -0.022, -0.02, 0.022).rotation.set(0.4, 0, side * 0.5);
      if (!p.lod) for (let f = 0; f < 4; f++) this.add(hand, capsule(0.0085, 0.035, 2, 6), hm, -0.018 + f * 0.012, -0.085, 0.004).rotation.x = 0.25;
      if (p.wristMark && side === -1) {
        this.wrist = this.add(el, cached('wrist', () => new THREE.TorusGeometry(0.044, 0.007, 8, 24)), makeMaterial('glow', 0x5fe6ff, { intensity: 2.4 }), 0, -0.19, 0);
        this.wrist.rotation.x = Math.PI / 2;
      }
      if (p.bracelets) for (let i = 0; i < 2; i++) { const br = this.add(el, cached('brc', () => new THREE.TorusGeometry(0.04, 0.006, 6, 18)), makeMaterial('metal', p.bracelets, { roughness: 0.35 }), 0, -0.17 - i * 0.025, 0); br.rotation.x = Math.PI / 2; }
      return { sh, up, el, hand, side };
    });
    // legs
    this.legs = [-1, 1].map(side => {
      const th = new THREE.Group(); th.position.set(side * 0.092 * b, -0.02, 0); hips.add(th);
      const k = fem ? 0.92 : 1;
      this.add(th, limb(0.43, [[0, 0.085 * k], [0.15, 0.084 * k], [0.5, 0.072 * k], [0.85, 0.058 * k], [1, 0.054 * k]]), M.pants, 0, 0, 0, b, 1, 1);
      const kn = new THREE.Group(); kn.position.y = -0.43; th.add(kn);
      this.add(kn, limb(0.42, [[0, 0.053 * k], [0.2, 0.058 * k], [0.4, 0.054 * k], [0.8, 0.042 * k], [1, 0.04 * k]]), M.pants, 0, 0, 0, 1, 1, 0.95);
      // boot shaft
      this.add(kn, cached('bootshaft', () => new THREE.CylinderGeometry(0.06, 0.056, 0.17, 16)), M.boots, 0, -0.34, 0);
      const ft = new THREE.Group(); ft.position.y = -0.45; kn.add(ft);
      this.add(ft, capsule(0.048, 0.12), M.boots, 0, -0.01, 0.045, 1, 0.75, 1).rotation.x = Math.PI / 2;
      this.add(ft, cached('sole', () => new THREE.BoxGeometry(0.1, 0.022, 0.25)), makeMaterial('std', 0x111111, { roughness: 0.9 }), 0, -0.045, 0.045);
      if (p.strap && side === 1) this.add(th, cached('holster', () => new THREE.BoxGeometry(0.05, 0.16, 0.09)), M.strap, 0.08, -0.22, 0);
      return { th, kn, ft, side };
    });
    if (p.umbrella) this.addUmbrella(p.umbrella);
  }

  buildHead(head) {
    const p = this.p, M = this.mats, fem = p.female;
    this.add(head, sphere(0.104, 36, 28), M.skin, 0, 0.105, -0.008, fem ? 0.88 : 0.92, 1.06, 1.0);
    // face mass + jaw
    this.add(head, sphere(0.086, 32, 24), M.skin, 0, 0.062, 0.022, fem ? 0.84 : 0.9, fem ? 1.02 : 1.06, 0.92);
    this.add(head, sphere(0.04, 20, 16), M.skin, 0, 0.006, 0.058, fem ? 0.95 : 1.2, 0.72, 0.8); // chin
    if (!fem) for (const s of [-1, 1]) this.add(head, sphere(0.03, 16, 12), M.skin, s * 0.04, 0.025, 0.03, 0.8, 0.9, 1.1); // jaw angle
    for (const s of [-1, 1]) this.add(head, sphere(0.024, 16, 12), M.skin, s * 0.046, 0.074, 0.07, 1, 0.7, 0.6); // cheekbones
    this.add(head, sphere(0.06, 24, 12), M.skin, 0, 0.126, 0.054, 1.28, 0.32, 0.55); // brow ridge
    // nose
    const nose = this.add(head, capsule(0.0105, 0.034, 4, 10), M.skin, 0, 0.088, 0.104, 1, 1, 1);
    nose.rotation.x = -0.32;
    this.add(head, sphere(0.0128, 14, 10), M.skin, 0, 0.068, 0.11, 1.3, 0.85, 1);
    for (const s of [-1, 1]) this.add(head, sphere(0.008, 10, 8), M.skin, s * 0.011, 0.066, 0.104, 1, 0.8, 1); // nostril wings
    // eyes
    this.eyes = [];
    if (p.lod) { // simplified face for crowds
      for (const s of [-1, 1]) this.add(head, sphere(0.011, 8, 6), M.pupil, s * 0.033, 0.099, 0.088, 1, 0.7, 0.5);
      this.mouth = this.add(head, sphere(0.017, 10, 6), M.lip, 0, 0.04, 0.094, 1.4, 0.4, 0.5);
      this.add(head, capsule(0.011, 0.03, 2, 6), M.skin, 0, 0.08, 0.104).rotation.x = -0.3;
      this.buildHair(head);
      if (p.cap) { const cm = makeMaterial('fabric', p.cap); this.add(head, new THREE.SphereGeometry(0.112, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), cm, 0, 0.115, -0.005, 0.98, 0.9, 1.04); }
      return;
    }
    for (const s of [-1, 1]) {
      const eg = new THREE.Group(); eg.position.set(s * 0.033, 0.099, 0.08); head.add(eg);
      this.add(eg, sphere(0.0155, 16, 12), M.eye);
      const iris = this.add(eg, sphere(0.0085, 14, 10), M.iris, 0, 0, 0.0105, 1, 1, 0.5);
      this.add(eg, sphere(0.0042, 10, 8), M.pupil, 0, 0, 0.0145, 1, 1, 0.5);
      // eyelid (upper) for blinking
      const lid = this.add(eg, cached('lid', () => new THREE.SphereGeometry(0.0166, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42)), M.skin, 0, 0, 0);
      lid.rotation.x = 0.28;
      const lash = this.add(eg, cached('lash', () => new THREE.TorusGeometry(0.0158, 0.0018, 4, 16, Math.PI)), M.pupil, 0, 0.004, 0.004);
      lash.rotation.set(-1.2, 0, 0); lash.visible = fem; this.eyes.push({ eg, lid, iris });
      const brow = this.add(head, cached('brow' + (fem ? 'f' : 'm'), () => new THREE.CapsuleGeometry(fem ? 0.0035 : 0.005, 0.028, 2, 6)), M.brow, s * 0.036, 0.128 + (fem ? 0.004 : 0), 0.099);
      brow.rotation.z = Math.PI / 2 + s * (fem ? 0.2 : 0.1);
      this.add(head, sphere(0.022, 12, 10), M.skin, s * 0.098, 0.088, 0.0, 0.42, 1, 0.7); // ears
    }
    // lips
    this.mouth = this.add(head, sphere(0.017, 16, 10), M.lip, 0, 0.041, 0.095, fem ? 1.45 : 1.5, 0.34, 0.5);
    this.add(head, sphere(0.016, 14, 8), M.lip, 0, 0.032, 0.092, fem ? 1.3 : 1.25, fem ? 0.48 : 0.4, 0.5);
    // facial hair
    if (p.stubble || p.beard) {
      const col = p.beard || p.hair;
      const bm = makeMaterial('hair', col, p.beard ? {} : { transparent: true, opacity: 0.26, roughness: 0.95, depthWrite: false });
      const g = new THREE.SphereGeometry(0.086, 28, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.42);
      if (p.beard) noiseDisplace(g, 0.05, 60, 3);
      const bb = this.add(head, g, bm, 0, 0.055, 0.028, 0.98, 1.02, 0.99);
      bb.rotation.x = -0.25;
      if (p.beard) this.add(head, sphere(0.02, 12, 8), bm, 0, 0.05, 0.1, 1.6, 0.5, 0.6); // moustache
    }
    if (p.scar) {
      const sc = this.add(head, cached('scar', () => new THREE.BoxGeometry(0.004, 0.06, 0.004)), makeMaterial('skin', 0xb0645a), 0.036, 0.1, 0.1);
      sc.rotation.z = 0.25;
    }
    if (p.glasses) {
      const gm = makeMaterial('metal', 0x2a2a2a);
      for (const s of [-1, 1]) this.add(head, cached('lens', () => new THREE.TorusGeometry(0.02, 0.0025, 6, 20)), gm, s * 0.035, 0.1, 0.104);
      this.add(head, cached('bridge', () => new THREE.BoxGeometry(0.02, 0.003, 0.003)), gm, 0, 0.102, 0.106);
      const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, roughness: 0.05, transparent: true, opacity: 0.25 });
      for (const s of [-1, 1]) this.add(head, cached('glass', () => new THREE.CircleGeometry(0.019, 18)), lensMat, s * 0.035, 0.1, 0.105);
    }
    this.buildHair(head);
    if (p.cap) {
      const cm = makeMaterial('fabric', p.cap);
      this.add(head, new THREE.SphereGeometry(0.112, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), cm, 0, 0.115, -0.005, 0.98, 0.9, 1.04);
      const brim = this.add(head, cached('brim', () => new THREE.CylinderGeometry(0.09, 0.09, 0.008, 20, 1, false, -Math.PI / 2, Math.PI)), cm, 0, 0.13, 0.06, 1, 1, 0.9);
      brim.rotation.x = 0.12;
    }
  }

  buildHair(head) {
    const p = this.p, M = this.mats, style = p.hairStyle;
    if (style === 'bald') return;
    const seed = (p.hair % 97) + 1;
    const C = new THREE.Vector3(0, 0.105, -0.01);
    // scalp cap: front hairline raised, back lowered
    const capG = new THREE.SphereGeometry(0.1115, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.47);
    noiseDisplace(capG, style === 'messy' ? 0.035 : 0.018, 70, seed);
    const cap = this.add(head, capG, M.hair, C.x, C.y, C.z, 0.95, 1.06, 1.04);
    cap.rotation.x = -0.5;
    // flat locks lying on the scalp give volume and direction
    const lock = (dir, len, w, thick, flow) => {
      const d = new THREE.Vector3(...dir).normalize();
      const m = this.add(head, sphere(0.04, 16, 10), M.hair, 0, 0, 0, w, thick, len);
      m.position.copy(C).addScaledVector(d, 0.106);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      m.rotateY(flow);
      return m;
    };
    if (style === 'messy' || style === 'short' || style === 'swept' || style === 'grey-swept') {
      const n = style === 'messy' ? 16 : 11, rnd = mulberry(seed);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.3, el = 0.45 + rnd() * 0.45;
        const dir = [Math.cos(a) * Math.cos(el) * 0.92, Math.sin(el), Math.sin(a) * Math.cos(el) * 0.95 - 0.12];
        const big = style === 'messy' ? 1.2 : 1;
        lock(dir, (1.1 + rnd() * 0.5) * big, 0.75 + rnd() * 0.3, style === 'messy' ? 0.42 : 0.3, (style.includes('swept') ? 0 : rnd() * 1.2) + a);
      }
      if (style === 'messy') for (let i = 0; i < 4; i++) { // fringe strands
        const f = this.add(head, capsule(0.009, 0.045, 3, 8), M.hair, -0.04 + i * 0.024, 0.178, 0.078 - Math.abs(i - 1.5) * 0.006);
        f.rotation.set(0.75 + (i % 2) * 0.2, 0, (i - 1.5) * 0.3);
      }
      // nape
      this.add(head, sphere(0.09, 24, 16), M.hair, 0, 0.075, -0.05, 1.02, 0.85, 0.75);
      for (const s of [-1, 1]) this.add(head, sphere(0.03, 12, 10), M.hair, s * 0.085, 0.12, 0.0, 0.45, 1.1, 1.3); // sideburn area
    }
    if (style === 'long' || style === 'bun' || style === 'wavy') {
      const rnd = mulberry(seed);
      for (let i = 0; i < 12; i++) { // part-swept locks
        const a = (i / 12) * Math.PI * 2, el = 0.55 + rnd() * 0.3;
        lock([Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el) - 0.1], 1.4, 0.9, 0.28, a + 0.3);
      }
      this.add(head, sphere(0.1, 24, 16), M.hair, 0, 0.09, -0.045, 1.04, 0.95, 0.85);
      if (style !== 'bun') {
        const hm = makeMaterial('hair', p.hair, { side: THREE.DoubleSide });
        const backG = new THREE.CylinderGeometry(0.1, 0.14, 0.34, 28, 8, true, Math.PI * 0.6, Math.PI * 1.8);
        noiseDisplace(backG, 0.06, 40, seed + 2);
        const back = this.add(head, backG, hm, 0, -0.06, -0.03, 1.02, 1, 0.82);
        back.rotation.y = Math.PI; this.hairBack = back;
        for (const s of [-1, 1]) { // strand framing the face
          const st = this.add(head, capsule(0.014, 0.16, 4, 8), M.hair, s * 0.088, 0.03, 0.02, 1, 1, 0.8);
          st.rotation.z = s * 0.1; st.rotation.x = -0.15;
        }
      } else {
        this.add(head, sphere(0.048, 18, 14), M.hair, 0, 0.16, -0.105, 1, 0.9, 1);
      }
    }
  }

  addUmbrella(color) {
    const arm = this.arms[1];
    arm.up.rotation.x = -0.5; arm.el.rotation.x = -1.4; this.umbrellaPose = true;
    const g = new THREE.Group(); arm.hand.add(g); g.position.set(0, -0.06, 0.02);
    this.add(g, cached('upole', () => new THREE.CylinderGeometry(0.008, 0.008, 0.95, 6)), this.mats.metal, 0, 0.35, 0);
    this.add(g, cached('ucan', () => new THREE.ConeGeometry(0.6, 0.22, 10, 1, true)), new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }), 0, 0.8, 0);
    g.rotation.x = 1.25; // compensate elbow so umbrella points up
    this.umbrella = g;
  }

  // ---- runtime ----
  setGhost(color = 0x5fe6ff) {
    const gm = this.ghostMat = makeGhostMaterial(color);
    for (const m of this.meshes) { m.material = gm; m.castShadow = false; m.receiveShadow = false; }
    return gm;
  }

  faceTowards(x, z, dt, rate = 6) {
    const target = Math.atan2(x - this.root.position.x, z - this.root.position.z);
    let d = target - this.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * rate);
  }

  update(dt) {
    if (this.frozen) return;
    this.t += dt;
    if (this.ghostMat) this.ghostMat.uniforms.uTime.value = this.t;
    const sp = this.speed, A = Math.min(1, sp / 2.4), run = Math.max(0, Math.min(1, (sp - 3) / 2.5));
    this.phase += dt * (sp > 0.05 ? (4.2 + sp * 1.25) : 0);
    const p = this.phase, cr = this.crouch;
    const breath = Math.sin(this.t * 1.7);
    // legs
    this.legs.forEach((L, i) => {
      const q = p + (i ? Math.PI : 0);
      const swing = -Math.sin(q) * (0.5 + run * 0.35) * A;
      L.th.rotation.x = swing - cr * 1.05;
      L.kn.rotation.x = (Math.max(0, -Math.cos(q)) * (0.9 + run * 0.6) * A + 0.04) + cr * 1.75;
      L.ft.rotation.x = -cr * 0.7 + Math.max(0, Math.sin(q)) * 0.25 * A;
    });
    // arms
    this.arms.forEach((a, i) => {
      if (a.side === 1 && this.umbrellaPose) return;
      const q = p + (i ? 0 : Math.PI);
      a.up.rotation.x = -Math.sin(q) * (0.45 + run * 0.4) * A + breath * 0.015 + (this.pose === 'reach' ? -1.1 : 0) - cr * 0.3;
      a.el.rotation.x = -0.18 - A * 0.35 - run * 0.7 - (this.pose === 'reach' ? 0.3 : 0) - cr * 0.4;
      a.up.rotation.z = a.side * (0.07 + run * 0.05);
    });
    // body
    this.hips.position.y = 0.96 - cr * 0.36 - A * 0.025 + Math.abs(Math.cos(p)) * 0.035 * A;
    this.spine.rotation.x = A * 0.06 + run * 0.12 + cr * 0.35;
    this.spine.rotation.y = Math.sin(p) * 0.09 * A;
    this.spine.scale.y = 1 + breath * 0.006;
    if (this.coatMesh) this.coatMesh.rotation.x = -A * 0.12 - run * 0.15 + Math.sin(p * 2) * 0.03 * A;
    // head: look target + talk
    let yaw = 0, pitch = 0;
    if (this.lookTarget) {
      const hp = new THREE.Vector3(); this.head.getWorldPosition(hp);
      const lt = this.lookTarget.isVector3 ? this.lookTarget : this.lookTarget.position;
      const ang = Math.atan2(lt.x - hp.x, lt.z - hp.z) - this.root.rotation.y;
      yaw = Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(ang), Math.cos(ang))));
      const dist = Math.hypot(lt.x - hp.x, lt.z - hp.z);
      pitch = Math.max(-0.4, Math.min(0.4, -Math.atan2((lt.y ?? hp.y) - hp.y, dist)));
    }
    this.headYaw += (yaw - this.headYaw) * Math.min(1, dt * 5);
    this.head.rotation.y = this.headYaw;
    this.head.rotation.x = pitch * 0.6 - this.spine.rotation.x * 0.5 + (this.talk > 0 ? Math.sin(this.t * 7) * 0.025 : 0);
    if (this.talk > 0) { this.talk -= dt; this.mouth.scale.y = 0.36 + Math.abs(Math.sin(this.t * 17)) * 0.35; }
    else this.mouth.scale.y = 0.36;
    // blink
    if (!this.eyes.length) return;
    const bl = (this.t % 4.1) < 0.12 ? 1 : 0;
    for (const e of this.eyes) e.lid.rotation.x = bl ? 1.25 : 0.28;
    if (this.wrist) this.wrist.material.emissiveIntensity = 1.6 + Math.sin(this.t * 2.2) * 0.8 + (this.wristBoost || 0);
    if (this.wristBoost) this.wristBoost = Math.max(0, this.wristBoost - dt * 6);
  }
}

// Render studio portraits for the dialogue UI / dossier using a temporary renderer.
export function renderPortraits(cast, size = 320) {
  const out = {};
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  r.setSize(size, size, false); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.PerspectiveCamera(22, 1, 0.05, 20);
  for (const [id, def] of Object.entries(cast)) {
    if (!def.look) continue;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(def.bg || 0x0b1118);
    const key = new THREE.DirectionalLight(def.keyColor || 0xffe2c4, 3.2); key.position.set(1.4, 1.2, 2); scene.add(key);
    const rim = new THREE.DirectionalLight(def.rimColor || 0x5fe6ff, 4.5); rim.position.set(-2, 1, -1.5); scene.add(rim);
    const rim2 = new THREE.DirectionalLight(0xff8a5a, 1.2); rim2.position.set(2, 0.5, -1.5); scene.add(rim2);
    scene.add(new THREE.HemisphereLight(0x8aa4c0, 0x1a1210, 0.6));
    const backGlow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 32), new THREE.MeshBasicMaterial({ color: def.glow || 0x16324a }));
    backGlow.position.set(0.15, 1.6, -0.6); scene.add(backGlow);
    const ch = new Character({ ...def.look, umbrella: null });
    scene.add(ch.root); ch.root.rotation.y = -0.32; ch.update(0.016);
    for (const e of ch.eyes) e.eg.rotation.y = 0.3;
    for (const e of ch.eyes) e.lid.rotation.x = 0.28;
    const hp = new THREE.Vector3(); ch.head.getWorldPosition(hp);
    cam.position.set(hp.x + 0.26, hp.y + 0.1, hp.z + 0.95); cam.lookAt(hp.x, hp.y + 0.06, hp.z);
    r.render(scene, cam);
    out[id] = r.domElement.toDataURL('image/jpeg', 0.9);
  }
  r.dispose(); r.forceContextLoss?.();
  return out;
}
