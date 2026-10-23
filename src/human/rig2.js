// Look v2 at run time (docs/CHARACTER_LOOK.md, "Cast rebuild"): what the rebuilt cast (assets/models/cast2*.glb)
// carries beyond the classic 21-bone people, all optional and feature-detected, so classic builds pass through untouched:
//  - hair cards (`gh_<id>`, material slot 'hair'): strand cards with our procedural strand texture, shaded with
//    strand highlights, alpha resolved by a stable screen-space dither (no MSAA needed), a cheaper card set on the low
//    tier, hidden beyond a distance (the hair volume underneath carries the silhouette there);
//  - face bones (jaw, eyes, upper / lower lids, brows, mouth corners): driven from the facial life in skin.js
//    (blinks, gaze, speech, brows) through h.rig2.face;
//  - finger bones (3 per finger): a relaxed rest, a grip around a shown hand prop, a fist (h.rig2.hand(side, pose)),
//    applied procedurally on top of the motion capture (anims.glb has no finger tracks and is never touched).
// ?look=classic loads the classic cast (nothing here runs); ?look=nocards hides the cards, ?look=nofingers,
// ?look=nofacebones switch single parts off.
import * as THREE from 'three';
import { getQuality } from '../world/realism.js';

const Q = new globalThis.URLSearchParams(globalThis.location ? globalThis.location.search : '');
const OFF = new Set((Q.get('look') || '').split(',').filter(s => s.startsWith('no')).map(s => s.slice(2)));
const tierName = () => Q.get('looktier') || (() => { try { return getQuality(); } catch { return 'medium'; } })();
const TIER = { low: 0, medium: 1, high: 2 };
const key = n => n.replace(/_\d+$/, '');
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const rig2 = { stats: { templates: 0, persons: 0, cards: 0 }, off: OFF, camera: null };

// card distance limits (m) per tier: beyond them the hair volume alone reads the same
const CARD_FAR = [9, 16, 26];
// the soft fringe pass (two-pass hair) within these distances (m) per tier
const SOFT_FAR = [4.5, 8, 14];

// ------------------------------------------------------------------------------------------------------------------
// hair card material (one program for every build: the colour lives in the vertex attribute azHCol)
// ------------------------------------------------------------------------------------------------------------------
const cardMats = new Map();
// pass: 0 = one pass, coverage resolved by a stable 4x4 ordered dither (far people, ?look=nosofthair);
//       1 = the opaque core of the strands (coverage >= AZC_CORE, writes depth);
//       2 = the soft fringe around it (coverage below the core's threshold, alpha-blended over the core and whatever is
//           behind, no depth write): smooth strand edges and tips without MSAA, no stipple, no sawtooth.
const AZC_CORE = 0.62;
function cardMaterial(src, tier, pass = 0) {
  const k = (src.map ? src.map.uuid : 'x') + '|' + tier + '|' + pass;
  let m = cardMats.get(k);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ map: src.map || null, color: 0xffffff, roughness: 0.55, metalness: 0, side: THREE.DoubleSide, alphaTest: pass === 2 ? 0 : 0.5, envMapIntensity: 0.3 });
  if (pass === 2) { m.transparent = true; m.depthWrite = false; m.alphaTest = 0; }
  m.userData = { ...src.userData, slot: 'hair', azCards: true, azPass: pass };
  m.name = 'az_hair_cards' + (pass ? '_' + pass : '');
  m.customProgramCacheKey = () => 'azcards' + tier + '_' + pass;
  m.onBeforeCompile = sh => {
    sh.defines = sh.defines || {};
    sh.defines.AZC_TIER = tier;
    sh.defines.AZC_PASS = pass;
    sh.vertexShader = 'attribute vec3 azHCol;\nattribute vec3 azHTan;\nvarying vec3 vHCol;\nvarying vec3 vHTan;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvHCol = pow( azHCol, vec3( 2.2 ) );')
      .replace('#include <skinnormal_vertex>', `#include <skinnormal_vertex>
	{ vec3 azT = azHTan * 2.0 - 1.0;
	#ifdef USE_SKINNING
	  azT = ( skinMatrix * vec4( azT, 0.0 ) ).xyz;
	#endif
	  vHTan = normalMatrix * azT; }`);
    let F = 'varying vec3 vHCol;\nvarying vec3 vHTan;\nfloat azcShift = 0.0; float azcSpark = 1.0; float azcRoot = 1.0;\n' + sh.fragmentShader;
    // the strand texture: R brightness (sRGB-decoded by the sampler: back to a gentle curve), G a per-strand random,
    // B depth across the card, A coverage (kept through the mip chain: mips average thin strands away)
    F = F.replace('#include <map_fragment>', `
	vec4 azT = texture2D( map, vMapUv );
	float azLum = sqrt( azT.r );
	// root occlusion: the strands near the scalp sit under the others (uv v = 0 at the root)
	azcRoot = mix( 0.55, 1.0, smoothstep( 0.0, 0.5, vMapUv.y ) );
	diffuseColor.rgb = vHCol * ( 0.6 + 0.4 * azLum ) * ( 0.84 + 0.16 * azT.b ) * azcRoot;
	azcShift = ( azT.g - 0.5 ) * 0.12; azcSpark = ( 0.65 + 0.6 * azT.g ) * azLum * azcRoot;
	// brows and lashes carry no strand tangent (look2.py, MATTE_FINE): matte fine hairs, no sheen stripes
	azcSpark *= smoothstep( 0.02, 0.08, length( vHTan ) );
	{ vec2 azSz = vec2( textureSize( map, 0 ) );
	  vec2 azDx = dFdx( vMapUv * azSz ), azDy = dFdy( vMapUv * azSz );
	  float azMip = max( 0.0, 0.5 * log2( max( dot( azDx, azDx ), dot( azDy, azDy ) ) ) );
	  float azA = saturate( azT.a * ( 1.0 + 0.22 * azMip ) );
	#if AZC_PASS == 1
	  if ( azA < ${AZC_CORE.toFixed(2)} ) discard;
	  diffuseColor.a = 1.0;
	#elif AZC_PASS == 2
	  if ( azA >= ${AZC_CORE.toFixed(2)} || azA < 0.03 ) discard;
	  diffuseColor.a = smoothstep( 0.03, ${AZC_CORE.toFixed(2)}, azA );
	#else
	  ivec2 azP = ivec2( gl_FragCoord.xy ) & 3;
	  int azI = azP.x + azP.y * 4;
	  float azB = float( ( azI == 0 ? 0 : azI == 1 ? 8 : azI == 2 ? 2 : azI == 3 ? 10 : azI == 4 ? 12 : azI == 5 ? 4 : azI == 6 ? 14 : azI == 7 ? 6 : azI == 8 ? 3 : azI == 9 ? 11 : azI == 10 ? 1 : azI == 11 ? 9 : azI == 12 ? 15 : azI == 13 ? 7 : azI == 14 ? 13 : 5 ) ) / 16.0;
	  if ( azA < 0.2 + 0.6 * azB ) discard;
	  diffuseColor.a = 1.0;
	#endif
	}`);
    F = F.replace('#include <alphatest_fragment>', '');
    F = F.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectSpecular *= ( 0.3 + 0.7 * azcSpark ) * azcRoot;\n\treflectedLight.indirectDiffuse *= 0.55 + 0.45 * azcRoot;');
    F = F.replace('#include <color_fragment>', '');
    // strand highlights (Kajiya-Kay): a white primary lobe toward the root and a tinted secondary toward the tip,
    // along the strand direction; diffuse wraps a little (light through the strands)
    const lp = THREE.ShaderChunk.lights_physical_pars_fragment;
    const a = 'reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );';
    const c = 'vec3 irradiance = dotNL * directLight.color;';
    if (lp.includes(a) && lp.includes(c)) {
      F = F.replace('#include <lights_physical_pars_fragment>', `vec3 azKK( vec3 L, vec3 V, vec3 N, vec3 T, vec3 col ) {
    vec3 H = normalize( L + V );
    vec3 T1 = normalize( T + N * ( azcShift - 0.08 ) ), T2 = normalize( T + N * ( azcShift + 0.12 ) );
    float d1 = dot( T1, H ), d2 = dot( T2, H );
    float s1 = pow( sqrt( max( 0.0, 1.0 - d1 * d1 ) ), 80.0 ), s2 = pow( sqrt( max( 0.0, 1.0 - d2 * d2 ) ), 26.0 );
    // a coherent sheen band across the head (v6: sparse white flecks from a sharper, more random primary lobe)
    return vec3( s1 * 0.2 * azcSpark ) + col * s2 * 0.34 * azcSpark;
  }
` + lp.replace(c, c + `
    irradiance = saturate( dot( geometryNormal, directLight.direction ) * 0.75 + 0.25 ) * directLight.color;`)
        .replace(a, `{ vec3 azTn = normalize( vHTan + vec3( 0.0, 1e-5, 0.0 ) );
      reflectedLight.directSpecular += azKK( directLight.direction, geometryViewDir, geometryNormal, azTn, material.diffuseColor ) * directLight.color * saturate( dot( geometryNormal, directLight.direction ) * 0.6 + 0.4 ); }`));
    }
    sh.fragmentShader = F;
  };
  m.needsUpdate = true;
  cardMats.set(k, m);
  return m;
}

// ------------------------------------------------------------------------------------------------------------------
// per template (once, shared by every clone)
// ------------------------------------------------------------------------------------------------------------------
const attr = (g, n) => g.attributes[n] || g.attributes[n.toUpperCase()];
function rename(g, from, to) { const a = attr(g, from); if (a && !g.attributes[to]) { g.setAttribute(to, a); g.deleteAttribute(g.attributes[from] ? from : from.toUpperCase()); } }

/** t = cast3d's template record. Returns t.v2 (null for classic builds). */
export function prepareTemplate(t) {
  if (t.v2 !== undefined) return t.v2;
  t.v2 = null;
  let meta = null;
  try { meta = t.root.userData.look ? JSON.parse(t.root.userData.look) : null; } catch { meta = null; }
  let cards = null, main = null;
  t.root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    if (/^gh_/.test(o.name)) cards = o;
    else if (!o.userData.lod && !o.userData.gadget && !o.geometry.attributes._gid && (o.geometry.attributes.azMask) && (!main || o.geometry.attributes.position.count > main.geometry.attributes.position.count)) main = o;
  });
  if (!meta && !cards) return null;
  const V = { meta: meta || {}, cardName: cards ? cards.name : null, loCount: 0, fullCount: 0, fingers: [], props: {} };
  t.root.updateMatrixWorld(true);
  const bones = {}; t.root.traverse(o => { if (o.isBone) bones[key(o.name)] = o; });
  // finger flexion axes in each bone's parent space (rest)
  const pq = new THREE.Quaternion(), rq = new THREE.Quaternion();
  t.root.getWorldQuaternion(rq);
  for (const n in (meta && meta.fingers) || {}) {
    const b = bones[n]; if (!b || !b.parent) continue;
    b.parent.getWorldQuaternion(pq);
    const ax = new THREE.Vector3(...meta.fingers[n]).applyQuaternion(rq).applyQuaternion(pq.invert()).normalize();
    const f = /^(thumb|index|middle|ring|pinky)(\d)_([LR])$/.exec(n);
    V.fingers.push({ name: n, axis: ax, finger: f ? f[1] : '', seg: f ? +f[2] : 1, side: f ? f[3] : 'L' });
  }
  // eye bones: the rest forward and the lid axis in head space are the template's own x / y (the builds face +z)
  V.hasFace = !!(bones.jaw && bones.eye_L && bones.eye_R && bones.lid_L && bones.lid_R);
  if (V.hasFace && bones.head) {     // the template's left-right and up axes in the head bone's space
    bones.head.getWorldQuaternion(pq).invert();
    V.hx = new THREE.Vector3(1, 0, 0).applyQuaternion(rq).applyQuaternion(pq).normalize();
    V.hy = new THREE.Vector3(0, 1, 0).applyQuaternion(rq).applyQuaternion(pq).normalize();
    V.hz = new THREE.Vector3(0, 0, 1).applyQuaternion(rq).applyQuaternion(pq).normalize();
  }
  // hand props: which hand holds each (the dominant joint of the prop mesh)
  t.root.traverse(o => {
    if (!o.isSkinnedMesh || !o.userData.gadget || !o.userData.prop) return;
    const si = o.geometry.attributes.skinIndex, sk = o.skeleton; if (!si || !sk) return;
    const cnt = {}; for (let i = 0; i < si.count; i += 7) { const j = si.getX(i); cnt[j] = (cnt[j] || 0) + 1; }
    const j = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    const nm = sk.bones[j] ? key(sk.bones[j].name) : '';
    const side = /_L$/.test(nm) ? 'L' : /_R$/.test(nm) ? 'R' : null;
    if (side) V.props[o.userData.gadget] = side;
  });
  // cards: attributes, the low-tier set first in the index list
  if (cards) {
    const g = cards.geometry;
    rename(g, '_hcol', 'azHCol'); rename(g, '_htan', 'azHTan');
    const lo = attr(g, '_hlo');
    if (g.index && lo) {
      const I = g.index.array, n = I.length / 3, A = [], B = [];
      for (let i = 0; i < n; i++) (lo.getX(I[i * 3]) > 0.5 ? A : B).push(I[i * 3], I[i * 3 + 1], I[i * 3 + 2]);
      const out = new (I.constructor)(I.length); out.set(A, 0); out.set(B, A.length);
      g.setIndex(new THREE.BufferAttribute(out, 1));
      V.loCount = A.length;
    }
    V.fullCount = g.index ? g.index.count : g.attributes.position.count;
    if (!g.attributes.azHCol) g.setAttribute('azHCol', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(0.05), 3));
    if (!g.attributes.azHTan) { const a = new Float32Array(g.attributes.position.count * 3); for (let i = 1; i < a.length; i += 3) a[i] = 1; g.setAttribute('azHTan', new THREE.BufferAttribute(a, 3)); }
    V.main = main ? main.name : null;
  }
  // the baked roughness map carries the cavity occlusion in its red channel: use it as the ambient occlusion
  t.root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.userData && m.userData.slot === 'atlas' && m.roughnessMap && !m.aoMap) { m.aoMap = m.roughnessMap; m.aoMapIntensity = 1; m.needsUpdate = true; } });
  rig2.stats.templates++;
  t.v2 = V;
  return V;
}

/**
 * Long hair cards follow the spring bones the motion step hangs from the head (springs.js re-weights the main mesh's
 * long hair; the cards copy the weights of the nearest main-mesh hair vertex), once per template, after
 * prepareSprings(). Safe to call without springs.
 */
export function prepareCardSprings(t) {
  const V = t.v2; if (!V || !V.cardName || V.springDone) return;
  V.springDone = true;
  const rig = t.springRig; if (!rig || !rig.chains || !rig.chains.some(c => c.kind === 'hair')) return;
  let cards = null, main = null;
  t.root.traverse(o => { if (o.isSkinnedMesh && o.name === V.cardName) cards = o; if (o.isSkinnedMesh && o.name === rig.mesh) main = o; });
  if (!cards || !main) return;
  t.root.updateMatrixWorld(true);
  const gm = main.geometry, gc = cards.geometry, MK = gm.attributes.azMask;
  const nBody = main.skeleton.bones.length;
  // raw (quantized) positions -> rest world: bone world * its inverse bind (each mesh has its own quantization, so its
  // own inverse binds); the spring bones' inverse binds were made for the main mesh: card = main * Mmain^-1 * Mcard
  const hi = main.skeleton.bones.findIndex(b => key(b.name) === 'hips'), hc = cards.skeleton.bones.findIndex(b => key(b.name) === 'hips');
  if (hi < 0 || hc < 0) return;
  const Mm = new THREE.Matrix4().multiplyMatrices(main.skeleton.bones[hi].matrixWorld, main.skeleton.boneInverses[hi]);
  const Mc = new THREE.Matrix4().multiplyMatrices(cards.skeleton.bones[hc].matrixWorld, cards.skeleton.boneInverses[hc]);
  V.springFix = new THREE.Matrix4().copy(Mm).invert().multiply(Mc);
  const SIm = gm.attributes.skinIndex, SWm = gm.attributes.skinWeight;
  // main-mesh hair vertices that hang on a spring bone
  const pm = [], im = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < gm.attributes.position.count; i++) {
    if (!(MK.getZ(i) > 0.5)) continue;
    let spring = false; for (let k = 0; k < 4; k++) if (SIm.getComponent(i, k) >= nBody && SWm.getComponent(i, k) > 0.01) spring = true;
    if (!spring) continue;
    v.fromBufferAttribute(gm.attributes.position, i).applyMatrix4(Mm); pm.push(v.x, v.y, v.z); im.push(i);
  }
  if (!im.length) return;
  const SIc = gc.attributes.skinIndex, SWc = gc.attributes.skinWeight, n = gc.attributes.position.count;
  const NI = new Uint16Array(n * 4), NW = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) { NI[i * 4 + k] = SIc.getComponent(i, k); NW[i * 4 + k] = SWc.getComponent(i, k); }
    v.fromBufferAttribute(gc.attributes.position, i).applyMatrix4(Mc);
    let best = -1, bd = 0.03 * 0.03;
    for (let j = 0; j < im.length; j++) { const dx = pm[j * 3] - v.x, dy = pm[j * 3 + 1] - v.y, dz = pm[j * 3 + 2] - v.z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = j; } }
    if (best < 0) continue;
    const s = im[best];
    for (let k = 0; k < 4; k++) { NI[i * 4 + k] = SIm.getComponent(s, k); NW[i * 4 + k] = SWm.getComponent(s, k); }
  }
  gc.setAttribute('skinIndex', new THREE.BufferAttribute(NI, 4));
  gc.setAttribute('skinWeight', new THREE.BufferAttribute(NW, 4));
  V.cardSprings = true;
}

// ------------------------------------------------------------------------------------------------------------------
// per person
// ------------------------------------------------------------------------------------------------------------------
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3();
// grip / fist targets (extra flexion in rad per segment; thumb separately)
const POSES = {
  relax: { f: [0, 0, 0], t: [0, 0, 0] },
  grip: { f: [1.05, 1.15, 0.55], t: [0.45, 0.35, 0.3] },
  fist: { f: [1.35, 1.5, 0.95], t: [0.7, 0.5, 0.45] },
  point: { f: [1.3, 1.4, 0.8], t: [0.6, 0.4, 0.3] },
};
const SPREAD = { index: 0.0, middle: 0.0, ring: 0.06, pinky: 0.12 };

/** Per person (cast3d.makePerson calls it after the springs): h.rig2 = { face, hand(side, pose), update(dt) }. */
export function attach(h, t) {
  const V = t.v2;
  if (!V) return null;
  const B = h.bones, tier = TIER[tierName()] ?? 1;
  const R = { face: null, cards: null, hands: { L: { pose: 'relax', k: 0, cur: [0, 0, 0], ct: [0, 0, 0], want: null }, R: { pose: 'relax', k: 0, cur: [0, 0, 0], ct: [0, 0, 0], want: null } }, t: 0, gaitCurl: 0 };
  const rest = new Map();
  const keep = b => { if (b && !rest.has(b)) rest.set(b, b.quaternion.clone()); };
  // cards: material, tier range, distance culling, the long-hair springs
  if (V.cardName && !OFF.has('cards')) {
    let cm = null, mm = null;
    h.root.traverse(o => { if (o.isSkinnedMesh && o.name === V.cardName) cm = o; if (o.isSkinnedMesh && V.main && o.name === V.main) mm = o; });
    if (cm) {
      const src = [].concat(cm.material)[0];
      R.cardMat = { dither: cardMaterial(src, tier, 0), core: cardMaterial(src, tier, 1), soft: cardMaterial(src, tier, 2) };
      cm.material = R.cardMat.dither;
      // the phone build (cast3d.js castTier: gfx=low and phones) draws the low card set and casts no card shadow
      const phoneBuild = t.root.userData.castTier === 'phone';
      cm.castShadow = tier > 0 && !phoneBuild; cm.frustumCulled = false;
      cm.geometry.setDrawRange(0, (tier === 0 || phoneBuild) && V.loCount ? V.loCount : Infinity);
      if (V.cardSprings && mm && mm.skeleton.bones.length > cm.skeleton.bones.length) {
        const n0 = cm.skeleton.bones.length, extra = mm.skeleton.bones.slice(n0);
        const inv = cm.skeleton.boneInverses.concat(mm.skeleton.boneInverses.slice(n0).map(m => m.clone().multiply(V.springFix)));
        cm.bind(new THREE.Skeleton(cm.skeleton.bones.concat(extra), inv), cm.bindMatrix);
      }
      // the soft fringe (after the spring re-bind: it shares the final skeleton): a second draw of the same cards (same geometry and skeleton), for people near the camera
      if (!OFF.has('softhair')) {
        const sm = new THREE.SkinnedMesh(cm.geometry, R.cardMat.soft);
        sm.name = cm.name + '_soft'; sm.frustumCulled = false; sm.castShadow = false; sm.receiveShadow = cm.receiveShadow;
        sm.position.copy(cm.position); sm.quaternion.copy(cm.quaternion); sm.scale.copy(cm.scale);
        sm.bindMode = cm.bindMode; sm.bind(cm.skeleton, cm.bindMatrix);
        sm.visible = false; sm.userData = { ...cm.userData, azSoft: true };
        // transparent objects are depth-sorted by their bounding sphere: the cards' rest-pose sphere (a skinned
        // mesh would otherwise skin every vertex once on the CPU to find it)
        if (!cm.geometry.boundingSphere) cm.geometry.computeBoundingSphere();
        sm.boundingSphere = cm.geometry.boundingSphere.clone();
        cm.parent.add(sm);
        R.soft = sm;
      }
      R.cards = cm;
      rig2.stats.cards++;
    }
  } else if (V.cardName) h.root.traverse(o => { if (o.isSkinnedMesh && o.name === V.cardName) o.visible = false; });
  // camera tracking (any rendered atlas mesh of this person reports the camera it is drawn with)
  for (const o of h.meshes) {
    if (!o.isSkinnedMesh || o === R.cards) continue;
    const prev = o.onBeforeRender, def = THREE.Object3D.prototype.onBeforeRender;
    o.onBeforeRender = function (r, s, c, ...rest_) { if (c && c.isPerspectiveCamera && c.fov < 89) rig2.camera = c; if (prev && prev !== def) prev.call(this, r, s, c, ...rest_); };
    break;
  }
  // face bones: the facial life (skin.js) writes R.face.want each frame; applied in update()
  if (V.hasFace && !OFF.has('facebones')) {
    for (const n of ['jaw', 'eye_L', 'eye_R', 'lid_L', 'lid_R', 'lidlo_L', 'lidlo_R', 'brow_L', 'brow_R', 'mouth_L', 'mouth_R']) keep(B[n]);
    const browRest = { L: B.brow_L ? B.brow_L.position.clone() : null, R: B.brow_R ? B.brow_R.position.clone() : null };
    const mouthRest = { L: B.mouth_L ? B.mouth_L.position.clone() : null, R: B.mouth_R ? B.mouth_R.position.clone() : null };
    R.face = {
      want: { blink: 0, yaw: 0, pitch: 0, lid: 0, brow: 0, jaw: 0, wide: 0, smile: 0 },
      apply() {
        const w = this.want, AX = V.hx, AY = V.hy, AZ = V.hz;
        const rot = (b, axis, ang) => { if (!b) return; _q.setFromAxisAngle(axis, ang); b.quaternion.copy(_q.multiply(rest.get(b))); };
        for (const S of ['L', 'R']) {
          // eyes: yaw about head y, pitch about head x (premultiplied in the head's space)
          const e = B['eye_' + S];
          if (e) { _q.setFromAxisAngle(AY, clamp(w.yaw, -0.6, 0.6)); _q2.setFromAxisAngle(AX, clamp(-w.pitch, -0.45, 0.45)); e.quaternion.copy(_q.multiply(_q2).multiply(rest.get(e))); }
          // upper lid: follows the eye down, closes with the blink; lower lid rises a little
          const up = clamp(w.blink, 0, 1) * 0.6 + clamp(-w.pitch, -0.3, 0.4) * 0.55 + w.lid;
          rot(B['lid_' + S], AX, clamp(up, -0.15, 0.62));
          rot(B['lidlo_' + S], AX, -clamp(w.blink, 0, 1) * 0.16 + clamp(w.pitch, -0.2, 0.2) * 0.2);
          const br = B['brow_' + S];
          if (br && browRest[S]) br.position.copy(browRest[S]).addScaledVector(AY, w.brow * 0.0026);
          const mc = B['mouth_' + S];
          if (mc && mouthRest[S]) mc.position.copy(mouthRest[S]).addScaledVector(AX, (S === 'L' ? 1 : -1) * w.wide * 0.0028).addScaledVector(AY, w.smile * 0.002 - w.jaw * 0.003).addScaledVector(AZ, -w.wide * 0.001);
        }
        rot(B.jaw, AX, clamp(w.jaw, 0, 1) * 0.2);
      },
    };
  }
  // fingers
  const fingers = OFF.has('fingers') ? [] : V.fingers.map(f => ({ ...f, bone: B[f.name] })).filter(f => f.bone);
  for (const f of fingers) keep(f.bone);
  const propSide = V.props;
  R.hand = (side, pose) => { const H = R.hands[side]; if (H) H.want = pose || null; };
  R.update = dt => {
    R.t += dt;
    if (R.face && !R.face.driven) R.face.apply();
    if (fingers.length) {
      // grip when a hand prop of that hand is shown; a touch more curl while walking (hands swing loose, not stiff)
      const sp = h.motion && h.motion.cmd ? h.motion.cmd.speed || 0 : 0;
      R.gaitCurl += (clamp(sp / 3, 0, 1) * 0.14 - R.gaitCurl) * Math.min(1, dt * 3);
      for (const S of ['L', 'R']) {
        const H = R.hands[S];
        let pose = H.want;
        if (!pose) { pose = 'relax'; for (const tp in propSide) if (propSide[tp] === S) { const g = h.gadgets[tp]; if (g && g.shown !== false && g.props.some(o => o.visible)) pose = 'grip'; } }
        const P = POSES[pose] || POSES.relax;
        for (let k = 0; k < 3; k++) {
          H.cur[k] += (P.f[k] - H.cur[k]) * Math.min(1, dt * 8);
          H.ct[k] += (P.t[k] - H.ct[k]) * Math.min(1, dt * 8);
        }
      }
      const breathe = 0.03 * Math.sin(R.t * 0.9);
      for (const f of fingers) {
        const H = R.hands[f.side], i = f.seg - 1;
        let a = f.finger === 'thumb' ? H.ct[i] : H.cur[i] + (R.gaitCurl + breathe) * (0.6 + 0.2 * i) + (SPREAD[f.finger] || 0) * 0.5 * (i === 0 ? 1 : 0.3);
        if (!(a > 1e-4 || a < -1e-4)) { f.bone.quaternion.copy(rest.get(f.bone)); continue; }
        a = clamp(a, -0.3, 1.7);
        _q.setFromAxisAngle(f.axis, a);
        f.bone.quaternion.copy(_q).multiply(rest.get(f.bone));
      }
    }
    // cards: distance culling (the camera of the last rendered frame)
    if (R.cards) {
      const cam = rig2.camera;
      let on = h.lod ? false : true, soft = false;
      if (on && cam) {
        h.root.getWorldPosition(_v);
        const d2 = _v.distanceToSquared(cam.position), far = CARD_FAR[tier];
        on = d2 < far * far;
        soft = on && !!R.soft && d2 < SOFT_FAR[tier] * SOFT_FAR[tier];
      }
      if (R.cards.visible !== on) R.cards.visible = on;
      if (R.soft) {
        if (R.soft.visible !== soft) R.soft.visible = soft;
        const want = soft ? R.cardMat.core : R.cardMat.dither;
        if (R.cards.material !== want) R.cards.material = want;
      }
    }
  };
  h.rig2 = R;
  rig2.stats.persons++;
  return R;
}
