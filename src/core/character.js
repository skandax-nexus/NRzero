// Characters: realistic procedural humans (src/human/*) behind the game's original Character API.
// A look ({ height, female, skin, hair, hairStyle, top, topKind, coat, vest, ... } plus optional
// age, face, likeness, topType, pantsType, shoes, hood, detail) becomes a skinned body with
// clothing, a sculpted head with eyes and lids, and strand-card hair.
import * as THREE from 'three';
import { createHead } from '../human/head.js';
import { createHair } from '../human/hair.js';
import { createBody } from '../human/body.js';
import { cast, makePerson, templateBox } from '../human/cast3d.js';

// ---------- shared helpers ----------
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function makeMaterial(kind, color, extra = {}) {
  const c = new THREE.Color(color);
  switch (kind) {
    case 'skin': return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, metalness: 0, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xd0402c), ...extra });
    case 'leather': return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, metalness: 0.02, clearcoat: 0.25, clearcoatRoughness: 0.5, ...extra });
    case 'fabric': return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.88, sheen: 0.35, sheenRoughness: 0.8, sheenColor: c.clone().offsetHSL(0, 0, 0.15), ...extra });
    case 'hair': return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, ...extra });
    case 'metal': return new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.9, ...extra });
    case 'eye': return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, ...extra });
    case 'glow': return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: extra.intensity ?? 3, toneMapped: true });
    default: return new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...extra });
  }
}

// Holographic echo material (temporal residue / memories). Works on skinned and morphing meshes.
export function makeGhostMaterial(color = 0x5fe6ff) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uAlpha: { value: 1 } },
    vertexShader: `#include <common>
      #include <skinning_pars_vertex>
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 w = modelMatrix * vec4(transformed, 1.0); vW = w.xyz; vN = normalize(normalMatrix * objectNormal);
        vec4 mv = viewMatrix * w; vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime,uAlpha; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ float f=pow(1.0-abs(dot(vN,vV)),2.2); float scan=0.55+0.45*sin(vW.y*90.0-uTime*6.0);
        float flick=0.85+0.15*sin(uTime*37.0+vW.x*3.0); float a=(0.12+f*0.9)*scan*flick*uAlpha;
        gl_FragColor=vec4(uColor*(0.6+f*2.2),a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ---------- look -> human parameters ----------
const HAIR_MAP = { quiff: 'quiff', long: 'long', wavy: 'bob', bob: 'bob', bun: 'bun', 'tied-back': 'tied-back', messy: 'messy', short: 'short', curly: 'curly', swept: 'swept', 'grey-swept': 'grey-swept', buzz: 'buzz', bald: 'bald' };
const q = (v, step) => Math.round(v / step) * step;
// look.sex may be a 0..1 blend or 'f' / 'm' (mission looks); otherwise look.female
const femaleness = look => (typeof look.sex === 'number' ? look.sex : typeof look.sex === 'string' ? (/^f/i.test(look.sex) ? 1 : 0) : (look.female ? 1 : 0));

function humanParams(look) {
  const p = look, seed = p.seed ?? (hashStr(JSON.stringify([p.skin, p.hair, p.hairStyle, p.top, p.pants, p.height, p.female, p.face, p.age])) % 100000);
  const R = mulberry(seed);
  const sex = femaleness(p);
  const greyHair = new THREE.Color(p.hair ?? 0).getHSL({}).l > 0.45 && new THREE.Color(p.hair ?? 0).getHSL({}).s < 0.2;
  const age = p.age ?? (p.child || (p.height ?? 1.8) < 1.4 ? Math.round(4 + ((p.height ?? 1.2) - 1.0) * 20) : greyHair ? 50 + Math.floor(R() * 18) : 22 + Math.floor(R() * 26));
  const detail = p.detail || (p.lod ? 'low' : 'medium');
  // faces of unnamed people vary from the seed; named cast pass `face`
  const face = p.face || {
    jaw: (R() - 0.5) * 1.2, cheek: (R() - 0.5) * 1.2, nose: (R() - 0.5) * 1.2, noseWidth: (R() - 0.5) * 1.2, lips: (R() - 0.5) * 1.2,
    brow: (R() - 0.5) * 1.0, eyeSize: (R() - 0.5) * 0.8, faceLength: (R() - 0.5) * 1.0, chin: (R() - 0.5) * 1.0,
  };
  const shape = detail === 'low' ? Object.fromEntries(Object.entries(face).map(([k, v]) => [k, q(v, 0.5)])) : face; // share crowd geometry
  const topType = p.topType || (p.armor ? 'armored' : p.topKind === 'leather' ? 'jacket' : p.sash ? 'tunic' : p.vest ? 'uniform' : p.child ? 'jacket' : 'sweater');
  const hairStyle = HAIR_MAP[p.hairStyle] || 'short';
  const stubble = p.stubble === true ? 0.75 : (p.stubble || 0);
  const head = {
    sex, age, skin: p.skin ?? 0xc68e6a, eyeColor: p.eyes ?? 0x3a2a1c, seed, shape,
    marks: { stubble, scar: !!p.scar, wrinkles: p.wrinkles ?? Math.max(0, (age - 35) / 40), freckles: p.freckles || 0 },
    likeness: p.likeness, hair: p.hair, hairStyle, beardColor: p.beard ?? p.hair, browColor: p.browColor, recede: p.recede, build: p.build ?? 1,
    detail: p.detailHead || detail,
  };
  const hair = { style: hairStyle, color: p.hair, beard: p.beard ? (p.beardStyle || 'full') : null, beardColor: p.beard, seed, detail: p.detailHead || detail, recede: p.recede };
  const shoes = p.shoes || (p.sash && !p.boots ? 'sandals' : 'boots');
  const body = {
    height: detail === 'low' ? q(p.height ?? 1.75, 0.04) : (p.height ?? 1.8), sex, build: detail === 'low' ? q(p.build ?? 1, 0.1) : (p.build ?? 1), age, skin: p.skin ?? 0xc68e6a, seed, detail,
    outfit: {
      top: { type: topType, color: p.top ?? 0x2b2f35, material: p.topKind === 'leather' ? 'leather' : p.topKind === 'synthetic' ? 'synthetic' : 'fabric', hood: !!p.hood },
      coat: p.coat != null ? { type: p.coatType || (p.coat === 0xe8eaec || p.coatKind === 'lab' ? 'lab' : 'long'), color: p.coat, material: p.coatKind === 'leather' ? 'leather' : 'fabric' } : null,
      vest: p.vest != null ? { color: p.vest } : null,
      pants: { type: p.pantsType || (p.sash ? 'wraps' : p.vest && !p.coat ? 'cargo' : 'trousers'), color: p.pants ?? 0x23262b },
      shoes: { type: shoes, color: p.boots ?? 0x1a1612 },
      gloves: p.gloves ?? null, belt: p.belt ?? null, sash: p.sash ?? null, strap: !!p.strap, bracelets: p.bracelets ?? null, wristMark: !!p.wristMark,
    },
  };
  return { head, hair, body, detail };
}

// ---------- 3D cast allocation: story role -> template (realistic MakeHuman-based people with mocap animation) ----------
export const ROLE_TEMPLATE = {
  kai: 'town_m3', mira: 'town_f3', witness: 'town_m1', rook: 'town_m6', sera: 'town_f4', niko: 'sefa', tala: 'town_f2',
  iven: 'town_m4', jun: 'pell', hale: 'hale', brandt: 'roe', child: 'town_kid',
};
const POOLS = {
  // city people avoid period pieces (top hats, aprons, headscarves) until the era-specific costume build replaces them
  m: ['town_m2', 'arin', 'wren', 'town_m5'], f: ['odile', 'edda', 'town_f1'], oldM: ['ignatz', 'town_m6'], oldF: ['ilse', 'ondine'],
  kidM: ['town_kid', 'wren'], kidF: ['town_kid', 'maren'], settleM: ['calder', 'keeper', 'keeper_b'], settleF: ['vossel', 'mirela', 'oriel'],
};
function pickTemplate(look) {
  if (look.template && cast.ids.includes(look.template)) return look.template;
  if (look.role && ROLE_TEMPLATE[look.role]) return ROLE_TEMPLATE[look.role];
  const h = hashStr(JSON.stringify([look.skin, look.hair, look.top, look.pants, look.height, look.seed]));
  const fem = femaleness(look) > 0.5;
  const kid = look.child || (look.height ?? 1.75) < 1.4;
  const grey = new THREE.Color(look.hair ?? 0).getHSL({}).l > 0.45;
  const settler = look.sash != null || look.pantsType === 'wraps' || look.era === 'ancient';
  const pool = kid ? (fem ? POOLS.kidF : POOLS.kidM) : settler ? (fem ? POOLS.settleF : POOLS.settleM) : grey || (look.age ?? 30) > 58 ? (fem ? POOLS.oldF : POOLS.oldM) : fem ? POOLS.f : POOLS.m;
  return pool[h % pool.length];
}
const proxyBone = () => new THREE.Object3D(); // writes from old mission code land here harmlessly

// ---------- the humanoid ----------
export class Character {
  constructor(p = {}) {
    this.p = p = Object.assign({
      height: 1.8, build: 1, skin: 0xc68e6a, hair: 0x1a1410, hairStyle: 'short', eyes: 0x4a3420,
      top: 0x2b2f35, topKind: 'leather', pants: 0x23262b, boots: 0x1a1612, coat: null, coatKind: 'fabric',
      gloves: null, beard: null, stubble: false, scar: false, glasses: false, strap: false, wristMark: false,
      cap: null, umbrella: null, female: false, armor: false, belt: null, vest: null, sash: null, bracelets: null,
    }, p);
    this.root = new THREE.Group();
    this.root.userData.character = this;
    this.shadows = p.shadows ?? true;
    this.meshes = [];
    this.t = Math.random() * 10; this.phase = 0; this.speed = 0; this.crouch = 0; this.talk = 0;
    this.frozen = false; this.lookTarget = null; this.headYaw = 0; this.headPitch = 0; this.pose = null;
    this.build();
  }

  build() {
    if (cast.ready && !this.p.procedural) return this.build3d();
    const P = this.human = humanParams(this.p);
    const body = this.body = createBody(P.body);
    this.root.add(body.root);
    const B = body.bones;
    const head = this.headApi = createHead(P.head);
    B.head.add(head.group);
    const hair = createHair(P.hair, head);
    head.group.add(hair);
    this.hips = B.hips; this.spine = B.spine; this.chest = B.chest; this.neck = B.neck; this.head = B.head;
    this.restHipY = B.hips.position.y;
    this.arms = [['R', -1], ['L', 1]].map(([S, side]) => ({ sh: B['shoulder' + S], up: B['upperArm' + S], el: B['forearm' + S], hand: B['hand' + S], side }));
    this.legs = [['R', -1], ['L', 1]].map(([S, side]) => ({ th: B['thigh' + S], kn: B['shin' + S], ft: B['foot' + S], side }));
    this.eyes = head.eyes.map(eg => ({ eg }));
    this.mats = body.materials;
    if (body.wristRing) { this.wrist = body.wristRing; }
    if (this.p.cap) this.addCap(this.p.cap);
    if (this.p.glasses) this.addGlasses();
    if (this.p.umbrella) this.addUmbrella(this.p.umbrella);
    this.root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = this.shadows !== false && o.name !== 'lash';
      o.receiveShadow = !this.p.lod;
      this.meshes.push(o);
    });
    this.update(0);
  }

  // Realistic cast: a template person, recoloured for the look, animated by retargeted motion capture.
  build3d() {
    const look = this.p, id = pickTemplate(look);
    const person = this.person = makePerson(id, { seed: hashStr(JSON.stringify(look)) % 100000, clothA: look.coat ?? look.top, clothB: look.pants, skin: look.skin });
    const box = templateBox(id), natural = box ? box.max.y : 1.75;
    const scale = look.height ? Math.max(0.9, Math.min(1.1, look.height / natural)) : 1;
    person.root.scale.setScalar(scale);
    this.root.add(person.root);
    const B = person.bones;
    this.hips = B.hips; this.spine = B.spine; this.chest = B.chest; this.neck = B.neck; this.head = B.head;
    this.arms = [['R', -1], ['L', 1]].map(([S, side]) => ({ sh: proxyBone(), up: proxyBone(), el: proxyBone(), hand: B['hand_' + S] || proxyBone(), side, bone: { up: B['upperarm_' + S], el: B['forearm_' + S] } }));
    this.legs = [['R', -1], ['L', 1]].map(([S, side]) => ({ th: proxyBone(), kn: proxyBone(), ft: B['foot_' + S] || proxyBone(), side }));
    this.eyes = []; this.mats = {};
    this.template = id; this.scale3d = scale;
    if (look.wristMark && B.forearm_L && B.hand_L) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0035, 8, 28), new THREE.MeshStandardMaterial({ color: 0x0b2a33, emissive: 0x2fd8ff, emissiveIntensity: 1.6, roughness: 0.3 }));
      const hp = B.hand_L.position.clone(); ring.position.copy(hp).multiplyScalar(0.86);
      ring.lookAt(hp.clone().multiplyScalar(2)); B.forearm_L.add(ring); this.wrist = ring;
    }
    if (look.umbrella) this.addUmbrella(look.umbrella);
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = this.shadows !== false; o.receiveShadow = !look.lod; this.meshes.push(o); } });
    this.update(0);
  }

  /** Rebuild in place (keeps this.root), e.g. once the 3D cast has finished loading. */
  rebuild() {
    for (const c of [...this.root.children]) this.root.remove(c);
    this.meshes = []; this.person = null; this.headApi = null; this.wrist = null; this.umbrella = null; this.umbrellaPose = false;
    this.build();
  }

  addCap(color) {
    const L = this.headApi.landmarks, cm = makeMaterial('fabric', color);
    const g = new THREE.Group(); this.headApi.group.add(g);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.103, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), cm);
    dome.scale.set(0.98, 0.78, 1.08); dome.position.set(0, L.crown.y - 0.075, -0.008); g.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.006, 24, 1, false, -Math.PI / 2, Math.PI), cm);
    brim.scale.set(1, 1, 0.85); brim.position.set(0, L.crown.y - 0.07, 0.06); brim.rotation.x = 0.16; g.add(brim);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.004, 6, 32), makeMaterial('fabric', new THREE.Color(color).offsetHSL(0, 0, -0.06)));
    band.rotation.x = Math.PI / 2; band.scale.set(0.98, 1.08, 1); band.position.set(0, L.crown.y - 0.075, -0.008); g.add(band);
  }

  addGlasses() {
    const L = this.headApi.landmarks, gm = makeMaterial('metal', 0x9a9a9e, { roughness: 0.25 });
    const g = new THREE.Group(); this.headApi.group.add(g);
    const lens = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 0.95, transparent: true, opacity: 0.18, depthWrite: false });
    for (const s of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0175, 0.0009, 6, 28), gm); rim.scale.set(1.15, 0.8, 1);
      rim.position.set(s * 0.032, L.eyeL.y, L.eyeL.z + 0.012); g.add(rim);
      const gl = new THREE.Mesh(new THREE.CircleGeometry(0.0172, 24), lens); gl.scale.set(1.15, 0.8, 1); gl.position.copy(rim.position); g.add(gl);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.1, 5), gm); arm.rotation.x = Math.PI / 2;
      arm.position.set(s * 0.069, L.eyeL.y + 0.002, L.eyeL.z - 0.04); arm.rotation.y = s * 0.12; g.add(arm);
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0008, 4, 10, Math.PI), gm); bridge.position.set(0, L.eyeL.y + 0.002, L.eyeL.z + 0.014); g.add(bridge);
  }

  addUmbrella(color) {
    const arm = this.arms[1];
    this.umbrellaPose = true;
    const g = new THREE.Group(); arm.hand.add(g); g.position.set(0, this.person ? 0.07 : -0.07, 0.015);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.9, 6), makeMaterial('metal', 0x2a2a2e)).translateY(0.36));
    const can = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.2, 12, 1, true), new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide }));
    can.position.y = 0.8; g.add(can);
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
    if (this.person) return this.update3d(dt);
    const s = this.body.proportions.s;
    const sp = this.speed, A = Math.min(1, sp / 2.4), run = Math.max(0, Math.min(1, (sp - 3) / 2.5));
    this.phase += dt * (sp > 0.05 ? (4.2 + sp * 1.25) / Math.sqrt(s) : 0);
    const p = this.phase, cr = this.crouch;
    const breath = Math.sin(this.t * 1.7);
    this.legs.forEach((L, i) => {
      const ph = p + (i ? Math.PI : 0);
      const swing = -Math.sin(ph) * (0.48 + run * 0.35) * A;
      L.th.rotation.x = swing - cr * 1.05;
      L.kn.rotation.x = (Math.max(0, -Math.cos(ph)) * (0.85 + run * 0.6) * A + 0.03) + cr * 1.75;
      L.ft.rotation.x = -cr * 0.7 + Math.max(0, Math.sin(ph)) * 0.25 * A - Math.max(0, -Math.sin(ph)) * 0.1 * A;
      L.th.rotation.z = L.side * 0.02;
    });
    this.arms.forEach((a, i) => {
      if (a.side === 1 && this.umbrellaPose) { a.up.rotation.set(-0.45, 0, 0.1); a.el.rotation.set(-1.25, 0, 0); return; }
      const ph = p + (i ? 0 : Math.PI);
      a.up.rotation.x = -Math.sin(ph) * (0.42 + run * 0.4) * A + breath * 0.012 + (this.pose === 'reach' ? -1.1 : 0) - cr * 0.3;
      a.el.rotation.x = -0.14 - A * 0.32 - run * 0.7 - (this.pose === 'reach' ? 0.3 : 0) - cr * 0.4;
      a.up.rotation.z = a.side * (0.015 + run * 0.05);
      a.hand.rotation.x = -0.08;
    });
    this.hips.position.y = this.restHipY - (cr * 0.36 + A * 0.022 - Math.abs(Math.cos(p)) * 0.032 * A) * s;
    this.spine.rotation.x = A * 0.05 + run * 0.12 + cr * 0.35;
    this.spine.rotation.y = Math.sin(p) * 0.08 * A;
    this.chest.rotation.x = breath * 0.008;
    // head: look target, eyes follow, talking
    let yaw = 0, pitch = 0;
    const hp = new THREE.Vector3(); this.head.getWorldPosition(hp);
    let lt = null;
    if (this.lookTarget) {
      lt = this.lookTarget.isVector3 ? this.lookTarget : this.lookTarget.getWorldPosition ? this.lookTarget.getWorldPosition(new THREE.Vector3()) : this.lookTarget.position;
      const ang = Math.atan2(lt.x - hp.x, lt.z - hp.z) - this.root.rotation.y;
      yaw = Math.max(-1.0, Math.min(1.0, Math.atan2(Math.sin(ang), Math.cos(ang))));
      const dist = Math.hypot(lt.x - hp.x, lt.z - hp.z);
      pitch = Math.max(-0.4, Math.min(0.4, -Math.atan2((lt.y ?? hp.y) - hp.y - 0.08, dist)));
    }
    const k = Math.min(1, dt * 5);
    this.headYaw += (yaw - this.headYaw) * k; this.headPitch += (pitch - this.headPitch) * k;
    this.head.rotation.y = this.headYaw * 0.75; this.neck.rotation.y = this.headYaw * 0.25;
    this.head.rotation.x = this.headPitch * 0.6 - this.spine.rotation.x * 0.5 + (this.talk > 0 ? Math.sin(this.t * 7) * 0.02 : 0);
    const H = this.headApi;
    if (lt) H.setGaze(lt.isVector3 ? lt : new THREE.Vector3(lt.x, lt.y ?? hp.y, lt.z)); else H.setGaze(null);
    if (this.talk > 0) { this.talk -= dt; H.setMouth(0.15 + Math.abs(Math.sin(this.t * 13)) * 0.45 * (0.6 + 0.4 * Math.sin(this.t * 3.1))); }
    else H.setMouth(0);
    H.update(dt);
    if (this.wrist) this.wrist.material.emissiveIntensity = 1.4 + Math.sin(this.t * 2.2) * 0.6 + (this.wristBoost || 0);
    if (this.wristBoost) this.wristBoost = Math.max(0, this.wristBoost - dt * 6);
  }
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
const POSE_CLIPS = new Set(['sit', 'work', 'look', 'nod', 'sad', 'fall', 'talk', 'idle']);
Character.prototype.update3d = function (dt) {
  const P = this.person, sp = this.speed;
  if (sp > 0.05) P.move(sp, this.scale3d || 1, { crouch: this.crouch > 0.5 });
  else if (this.crouch > 0.5) P.play('crouch', 0.3, 0.02);
  else if (this.pose && POSE_CLIPS.has(this.pose)) P.play(this.pose, 0.35);
  else if (this.talk > 0) P.play('talk', 0.35);
  else P.play('idle', 0.4);
  if (this.talk > 0) this.talk -= dt;
  P.update(dt);
  // head turns toward the look target on top of the animation (world-space yaw, clamped and smoothed)
  let yaw = 0;
  if (this.lookTarget && this.head) {
    const lt = this.lookTarget.isVector3 ? this.lookTarget : this.lookTarget.getWorldPosition ? this.lookTarget.getWorldPosition(_v2) : this.lookTarget.position;
    this.head.getWorldPosition(_v);
    const ang = Math.atan2(lt.x - _v.x, lt.z - _v.z) - this.root.rotation.y;
    yaw = Math.max(-1.0, Math.min(1.0, Math.atan2(Math.sin(ang), Math.cos(ang))));
  }
  this.headYaw += (yaw - this.headYaw) * Math.min(1, dt * 5 || 1);
  if (Math.abs(this.headYaw) > 1e-3) for (const [b, k] of [[this.neck, 0.3], [this.head, 0.7]]) {
    if (!b || !b.parent) continue;
    b.getWorldQuaternion(_q); _q2.setFromAxisAngle(UPV, this.headYaw * k); _q.premultiply(_q2);
    b.parent.getWorldQuaternion(_q2).invert(); b.quaternion.copy(_q2.multiply(_q));
    b.updateMatrixWorld(true);
  }
  if (this.umbrellaPose) { // forearm raised to hold the umbrella over the head
    const a = this.arms[1].bone;
    if (a.up && a.el) {
      const right = _v.set(1, 0, 0).applyQuaternion(this.root.quaternion);
      for (const [b, ang] of [[a.up, -0.55], [a.el, -1.35]]) {
        b.getWorldQuaternion(_q); _q2.setFromAxisAngle(right, ang); _q.premultiply(_q2);
        b.parent.getWorldQuaternion(_q2).invert(); b.quaternion.copy(_q2.multiply(_q)); b.updateMatrixWorld(true);
      }
    }
  }
  if (this.wrist) this.wrist.material.emissiveIntensity = 1.4 + Math.sin(this.t * 2.2) * 0.6 + (this.wristBoost || 0);
  if (this.wristBoost) this.wristBoost = Math.max(0, this.wristBoost - dt * 6);
};

// Studio portraits for the dialogue UI and dossier. Rendered lazily on first use (each property is a getter).
let portraitRenderer = null;
function renderOne(id, def, size) {
  if (!portraitRenderer) {
    portraitRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    portraitRenderer.toneMapping = THREE.ACESFilmicToneMapping; portraitRenderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  const r = portraitRenderer; r.setSize(size, size, false);
  const cam = new THREE.PerspectiveCamera(20, 1, 0.05, 20);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(def.bg || 0x0b1118);
  const key = new THREE.DirectionalLight(def.keyColor || 0xffe2c4, 2.6); key.position.set(1.4, 1.4, 2); scene.add(key);
  const rim = new THREE.DirectionalLight(def.rimColor || 0x5fe6ff, 3.2); rim.position.set(-2, 1.2, -1.5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffd2b0, 0.6); fill.position.set(-1.6, 0.6, 1.8); scene.add(fill);
  scene.add(new THREE.HemisphereLight(0x8aa4c0, 0x1a1210, 0.55));
  const backGlow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), new THREE.MeshBasicMaterial({ color: def.glow || 0x16324a }));
  backGlow.position.set(0.2, 1.55, -0.7); scene.add(backGlow);
  const ch = new Character({ role: id, ...def.look, umbrella: null, detailHead: 'high', detail: 'medium' });
  scene.add(ch.root); ch.root.rotation.y = -0.3; ch.update(0.016);
  if (ch.headApi) { ch.headApi.setBlink(0); ch.headApi.update(0); }
  ch.root.updateMatrixWorld(true);
  const hp = new THREE.Vector3(); ch.head.getWorldPosition(hp);
  const eye = hp.clone().add(new THREE.Vector3(0, ch.person ? 0.09 : 0.07, ch.person ? 0.02 : 0));
  cam.position.set(eye.x + 0.3, eye.y + 0.05, eye.z + 0.95); cam.lookAt(eye.x, eye.y - 0.02, eye.z);
  if (ch.headApi) { ch.headApi.setGaze(cam.position); ch.headApi.update(0); }
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/jpeg', 0.9);
  ch.root.traverse(o => { if (o.isMesh && o.material?.dispose && !o.material.map) o.material.dispose(); });
  return url;
}
export function renderPortraits(cast, size = 320) {
  const out = {}, done = {};
  for (const [id, def] of Object.entries(cast)) {
    if (!def.look) continue;
    Object.defineProperty(out, id, {
      enumerable: true, configurable: true,
      get() { if (!(id in done)) { try { done[id] = renderOne(id, def, size); } catch (e) { console.warn('portrait', id, e); done[id] = ''; } } return done[id]; },
      set(v) { done[id] = v; },
    });
  }
  return out;
}
