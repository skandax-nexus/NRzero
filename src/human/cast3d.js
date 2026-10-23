// The 3D cast: realistic skinned people (MakeHuman-based bodies in era-correct costumes with gadgets, built by
// tools/characters (CAST=nrzero), see docs/COSTUMES.md and assets/models/cast_index.json) plus shared motion-capture clips retargeted onto every body.
// assets/models/cast.glb holds every person (one root per template id); assets/models/anims.glb holds the reference rig
// and clips (idle, walk_slow, walk, jog, run, sprint, crouch, talk, nod, look, sit, work, sad, fall).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { lookPerson, look as LOOK } from './skin.js';    // the look shading and facial life (docs/CHARACTER_LOOK.md); ?look=classic: off
import { prepareTemplate as prepareV2, prepareCardSprings, attach as attachV2 } from './rig2.js';   // look v2 builds: hair cards, face and finger bones
import { getQuality } from '../world/realism.js';
import { MOTION, Motion, analyseTemplate, gaitProfile } from './locomotion.js';   // walking style (docs/MOTION.md); ?motion=classic: off
import { prepareTemplate as prepareSprings, attachSprings } from './springs.js';   // coat tails and hair (docs/MOTION.md)

const T = {};            // id -> { root, clips, speeds, height, box }
const key = n => n.replace(/_\d+$/, '');
let lib = null;          // { clips, root, meta }
export const cast = { ready: false, ids: [], meta: {}, loading: null, index: {} };

// ---------------- loading ----------------
export function loadCast(base = new globalThis.URL('../../assets/models/', import.meta.url).href) {
  if (cast.loading) return cast.loading;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  // models load from .glb, or (hosts that serve no binary types, e.g. the web preview) from base64 text beside them
  const parse = buf => new Promise((ok, bad) => loader.parse(buf, base, ok, bad));
  const viaText = async f => {
    const r = await globalThis.fetch(base + f.replace(/\.glb$/, '.b64.txt'));
    if (!r.ok) throw new Error('no ' + f);
    const bin = globalThis.atob((await r.text()).trim()), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return parse(buf.buffer);
  };
  const get = f => new Promise((ok, bad) => loader.load(base + f, ok, undefined, bad)).catch(() => viaText(f));
  cast.loading = (async () => {
    try {
      await MeshoptDecoder.ready;
      // the new motion also reads our own authored clips (anims_extra.glb: same rig, never the owner's anims.glb) and
      // the cast index (sex, age, height per build) for each person's gait; both are optional
      const extra = MOTION.classic ? null : get('anims_extra.glb').catch(() => null);
      const index = MOTION.classic ? null : globalThis.fetch(base + 'cast_index.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
      // look v2 (docs/CHARACTER_LOOK.md, "Cast rebuild"): the rebuilt cast in part files listed by cast2.json, phone-size
      // atlases inside, full-size atlases in HD packs for desktop tiers; ?look=classic (or no cast2.json): cast.glb
      const man = LOOK.classic ? null : await globalThis.fetch(base + 'cast2.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
      const parts = man && man.parts && man.parts.length ? man.parts.map(p => p.file) : null;
      const hd = parts && man.hd && man.hd.length && wantHD() ? Promise.all(man.hd.map(h => get(h.file).catch(() => null))) : null;
      const castP = parts ? Promise.all(parts.map(get)).catch(e => { console.warn('cast2 unavailable, classic cast', e && e.message); cast.version = 1; return Promise.all([get('cast.glb')]); }) : Promise.all([get('cast.glb')]);
      cast.version = parts ? 2 : 1;
      const [cs, a, x, ix] = await Promise.all([castP, get('anims.glb'), extra, index]);
      const c = { scene: { children: cs.flatMap(g => g.scene.children) } };
      let meta = {};
      a.scene.traverse(o => { if (o.userData && o.userData.az_clips) try { meta = JSON.parse(o.userData.az_clips); } catch { /* older file */ } });
      const clips = a.animations.slice();
      if (x) {
        let xm = {};
        x.scene.traverse(o => { if (o.userData && o.userData.az_clips) try { xm = JSON.parse(o.userData.az_clips); } catch { /* none */ } });
        for (const cl of x.animations) if (!clips.some(k => k.name === cl.name)) clips.push(cl);
        meta = { ...meta, clips: { ...(meta.clips || {}), ...(xm.clips || {}) } };
      }
      if (ix && ix.characters) for (const e of ix.characters) cast.index[e.id] = e;
      lib = { clips, root: a.scene, meta }; cast.meta = meta;
      c.scene.children.slice().forEach(root => {
        let skinned = null, hips = null, top = 0;
        root.traverse(o => {
          if (o.isSkinnedMesh) skinned = o;
          if (o.isBone && key(o.name) === 'hips') hips = o;
          if (o.isMesh) {
            o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
            const g = o.geometry, mk = g.attributes._mask || g.attributes._MASK;
            if (mk) { g.setAttribute('azMask', mk); g.deleteAttribute(g.attributes._mask ? '_mask' : '_MASK'); }
            for (const n of ['_gcol', '_gid']) { const a = g.attributes[n] || g.attributes[n.toUpperCase()]; if (a && !g.attributes[n]) { g.setAttribute(n, a); g.deleteAttribute(n.toUpperCase()); } }
            if (o.userData.lod) o.visible = false;      // crowd low LOD (shares the atlas mesh's vertex buffers): setLOD(1) swaps it in
            [].concat(o.material).forEach(m => {
              const t = m.userData.tint; if (t) m.color.setRGB(t[0], t[1], t[2]);
              m.envMapIntensity = 0.8;
              if (mk && m.userData.slot === 'atlas') skinShade(m);
              if (m.userData.slot === 'glass') { o.castShadow = false; m.depthWrite = false; }   // see-through lens: no shadow on the eyes
              if (m.userData.slot === 'glow' && g.attributes._gid) o.castShadow = false;
            });
          }
        });
        if (!skinned || !hips) return;
        root.updateMatrixWorld(true);
        root.traverse(o => { if (o.isBone) top = Math.max(top, o.getWorldPosition(new THREE.Vector3()).y); });
        // stature: the standing body height the generator built (no hat, hood, raised prop or umbrella in it), so a
        // look.height scales the person, not their umbrella; older files: the head joint + 12 cm
        const stature = +root.userData.stature || top + 0.12;
        const box = new THREE.Box3();
        root.traverse(o => { if (o.isMesh && !o.userData.gadget && !o.userData.lod && !/^g[xlp]_/.test(o.name)) box.expandByObject(o); });
        if (box.isEmpty()) box.setFromObject(root);
        box.max.y = stature;
        T[root.name] = { root, height: stature, box, clips: null, speeds: {} };
        cast.ids.push(root.name);
      });
      cast.ready = cast.ids.length > 0;
      // full-size atlases (desktop tiers): the images are swapped into the templates' textures in place (clones and
      // the look's material copies share those Texture objects); waits a little so the first frames are sharp
      if (hd) {
        cast.hdReady = hd.then(applyHD).catch(e => console.warn('cast2 hd:', e && e.message));
        await Promise.race([cast.hdReady, new Promise(ok => setTimeout(ok, +(new globalThis.URLSearchParams(globalThis.location ? globalThis.location.search : '').get('hdwait') || 8000)))]);
      }
    } catch (e) { console.warn('3D cast unavailable; using procedural humans.', e && e.message); }
    return cast.ready;
  })();
  return cast.loading;
}
// HD packs on high, and on medium off phones; ?casthd=0 / 1 forces it
function wantHD() {
  const q = new globalThis.URLSearchParams(globalThis.location ? globalThis.location.search : '').get('casthd');
  if (q != null) return q !== '0';
  let tier = 'medium'; try { tier = getQuality(); } catch { /* realism not set up */ }
  const nav = globalThis.navigator, ua = nav ? nav.userAgent || '' : '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (nav && nav.maxTouchPoints > 0 && globalThis.screen && Math.min(globalThis.screen.width, globalThis.screen.height) <= 1100);
  return tier === 'high' || (tier === 'medium' && !mobile);
}
async function applyHD(list) {
  let n = 0;
  const byName = new Map();
  for (const id in T) T[id].root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.name) byName.set(m.name, m); });
  for (const g of list) {
    if (!g) continue;
    const mats = await g.parser.getDependencies('material');
    for (const m of mats) {
      const dst = byName.get(m.name); if (!dst) continue;
      for (const k of ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
        if (m[k] && dst[k] && m[k].image) { dst[k].image = m[k].image; dst[k].needsUpdate = true; n++; }
      }
    }
  }
  cast.hd = n;
  return n;
}
export const hasTemplate = id => !!T[id];
export const templateHeight = id => (T[id] ? T[id].height : 1.75);
// body box of a template: x / z of the dressed body, max.y = its stature (character.js scales look.height by it)
export const templateBox = id => (T[id] ? T[id].box : null);

// ---------------- retargeting (world-space rotations, pelvis travel scaled, soles kept on the floor) ----------------
function solePoints(root, bones) {
  const out = [], A = new THREE.Vector3(), B = new THREE.Vector3(), f = new THREE.Vector3();
  let top = 0;
  root.traverse(o => { if (bones.includes(o)) top = Math.max(top, o.getWorldPosition(A).y); });
  for (const k of ['L', 'R']) {
    const foot = bones.find(b => key(b.name) === 'foot_' + k), toe = bones.find(b => key(b.name) === 'toe_' + k);
    if (!foot || !toe) continue;
    foot.getWorldPosition(A); toe.getWorldPosition(B);
    f.subVectors(B, A).setY(0); const len = f.length(); f.normalize();
    const heel = A.clone().addScaledVector(f, -0.045 * top / 1.75).setY(0), ball = B.clone().setY(0), tip = B.clone().addScaledVector(f, len * 0.4).setY(0);
    out.push([foot, foot.worldToLocal(heel)], [foot, foot.worldToLocal(ball)], [toe, toe.worldToLocal(tip)]);
  }
  return out;
}
const solePt = new THREE.Vector3();
const soleY = pts => { let m = Infinity; for (const [b, p] of pts) m = Math.min(m, solePt.copy(p).applyMatrix4(b.matrixWorld).y); return m; };

function retarget(srcRoot, clip, dstRoot, fps = 30) {
  const sb = {}, db = [];
  srcRoot.traverse(b => { if (b.name && !b.isMesh) sb[key(b.name)] = b; });
  dstRoot.traverse(b => { if (b.isBone && sb[key(b.name)]) db.push(b); });
  srcRoot.updateMatrixWorld(true); dstRoot.updateMatrixWorld(true);
  const wq = o => o.getWorldQuaternion(new THREE.Quaternion());
  const restS = {}, restD = new Map(), restLocal = new Map();
  for (const k in sb) restS[k] = wq(sb[k]).invert();
  db.forEach(b => { restD.set(b, wq(b)); restLocal.set(b, b.quaternion.clone()); });
  const sHips = sb.hips, dHips = db.find(b => key(b.name) === 'hips');
  const info = ((cast.meta || {}).clips || {})[clip.name] || {};
  if (!sHips || !dHips) return { clip, speed: info.speed || 0 };
  const restHipPos = dHips.position.clone();
  const sHip0 = sHips.getWorldPosition(new THREE.Vector3()), dHip0 = dHips.getWorldPosition(new THREE.Vector3());
  const ratio = dHip0.y / Math.max(1e-3, sHip0.y), seated = !!info.seat || clip.name === 'sit', grounded = !seated && clip.name !== 'fall' && !info.air;
  const sSole = grounded ? solePoints(srcRoot, Object.values(sb)) : [], dSole = grounded ? solePoints(dstRoot, db) : [];
  const seat = info.seat || 0.466;
  const mixer = new THREE.AnimationMixer(srcRoot);
  mixer.clipAction(clip).play();
  const n = Math.max(2, Math.round(clip.duration * fps) + 1), times = new Float32Array(n);
  const qv = new Map(db.map(b => [b, new Float32Array(n * 4)])), pv = new Float32Array(n * 3);
  const W = new THREE.Quaternion(), PI = new THREE.Quaternion(), v = new THREE.Vector3(), wp = new THREE.Vector3(), lp = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const tt = Math.min(clip.duration, i / fps * (clip.duration / ((n - 1) / fps))); times[i] = tt;
    mixer.setTime(tt); srcRoot.updateMatrixWorld(true);
    for (const b of db) {
      const k = key(b.name);
      W.copy(wq(sb[k])).multiply(restS[k]).multiply(restD.get(b));
      b.parent.getWorldQuaternion(PI).invert();
      b.quaternion.copy(PI.multiply(W));
      b.updateMatrixWorld(true);
      b.quaternion.toArray(qv.get(b), i * 4);
    }
    sHips.getWorldPosition(v);
    wp.copy(dHip0); wp.x += (v.x - sHip0.x) * ratio; wp.y += (v.y - sHip0.y) * ratio; wp.z += (v.z - sHip0.z) * ratio;
    if (seated) wp.y = seat + (v.y - seat) * ratio;
    if (grounded && sSole.length && dSole.length) {
      lp.copy(wp); dHips.parent.worldToLocal(lp); dHips.position.copy(lp); dHips.updateMatrixWorld(true);
      wp.y += soleY(sSole) * ratio - soleY(dSole);
    }
    dHips.parent.worldToLocal(wp); wp.toArray(pv, i * 3);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(srcRoot);
  db.forEach(b => b.quaternion.copy(restLocal.get(b)));
  dHips.position.copy(restHipPos);
  dstRoot.updateMatrixWorld(true);
  const tracks = db.map(b => new THREE.QuaternionKeyframeTrack(b.name + '.quaternion', times, qv.get(b)));
  tracks.push(new THREE.VectorKeyframeTrack(dHips.name + '.position', times, pv));
  return { clip: new THREE.AnimationClip(clip.name, clip.duration, tracks), speed: (info.speed || 0) * ratio };
}
function clipsFor(t) {
  if (t.clips) return t.clips;
  t.clips = {};
  lib.clips.forEach(c => { const r = retarget(lib.root, c, t.root); t.clips[c.name] = r.clip; t.speeds[c.name] = r.speed; });
  if (!MOTION.classic) try { analyseTemplate(t); } catch (e) { console.warn('motion: no gait data for', t.root.name, e && e.message); t.motionInfo = null; }
  return t.clips;
}

// ---------------- skin shading for the cast's atlas material ----------------
// Per-vertex mask (azMask): r = skin, g = gloss (eyes, leather, metal), b = hair. Skin gets wrapped diffuse with a warm
// terminator (cheap subsurface look) and a soft specular; eyes are glossy; a small fill + rim keeps faces readable at night.
export const shade = { fill: { value: new THREE.Color(0.045, 0.048, 0.058) }, rim: { value: new THREE.Color(0.07, 0.08, 0.1) } };
let skinLights = null;
const skinChunk = () => skinLights || (skinLights = THREE.ShaderChunk.lights_physical_pars_fragment
  .replace('vec3 irradiance = dotNL * directLight.color;', `vec3 irradiance = dotNL * directLight.color;
    float azNL = dot( geometryNormal, directLight.direction );
    float azW = azSkin * 0.5 + azHair * 0.25;
    vec3 azIrr = ( vec3( dotNL ) + ( saturate( ( azNL + azW ) / ( 1.0 + azW ) ) - dotNL ) * mix( vec3( 1.0 ), vec3( 1.0, 0.5, 0.36 ), azSkin ) ) * directLight.color;`)
  .replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
    'reflectedLight.directDiffuse += azIrr * BRDF_Lambert( material.diffuseColor );'));
export function skinShade(m) {
  if (m.userData.azSkin) return m;
  m.userData.azSkin = true;
  m.customProgramCacheKey = () => 'azskin';
  m.onBeforeCompile = sh => {
    sh.uniforms.azFill = shade.fill; sh.uniforms.azRim = shade.rim;
    sh.vertexShader = 'attribute vec3 azMask;\nvarying vec3 vAzMask;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvAzMask = azMask;');
    sh.fragmentShader = 'varying vec3 vAzMask;\nuniform vec3 azFill;\nuniform vec3 azRim;\nfloat azSkin = 0.0;\nfloat azGloss = 0.0;\nfloat azHair = 0.0;\n' + sh.fragmentShader
      .replace('void main() {', 'void main() {\n\tazSkin = vAzMask.r; azGloss = vAzMask.g; azHair = vAzMask.b;')
      .replace('#include <lights_physical_pars_fragment>', skinChunk())
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = mix( mix( mix( roughnessFactor, 0.5, azSkin ), 0.62, azHair ), 0.07, azGloss );')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        { float azR = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 3.0 );
          reflectedLight.indirectDiffuse += material.diffuseColor * ( azFill + azRim * azR ) * ( 1.0 - 0.5 * azGloss ); }`);
  };
  m.needsUpdate = true;
  return m;
}

// ---------------- instances ----------------
const GAITS = ['walk_slow', 'walk', 'jog', 'run', 'sprint'], LOCO = new Set(GAITS.concat(['crouch']));
const DEFAULT_SPEED = { walk_slow: 0.9, walk: 1.2, jog: 2.9, run: 4.3, sprint: 6.5, crouch: 0.85 };
const matCache = new Map();
const variant = (m, tag, fn) => {
  const k = m.uuid + '|' + tag; let v = matCache.get(k);
  if (!v) { v = m.clone(); if (m.userData.azSkin) { v.userData.azSkin = false; skinShade(v); } fn(v); matCache.set(k, v); }
  return v;
};
const lin = c => new THREE.Color(c);
const POSTURE = new Set(['crouch', 'sit']), LONG = /umbrella|staff|spear|cane|pole|rifle|wand_long/;

// the glow group (`gx_<id>`: every gadget's emissive part and smoked lens in one mesh, one draw call): per vertex
// `_gcol` = glow colour, `_gid` = (gadget index / 32, segment / 32, opacity). One clone per person holds that person's
// levels (uniform array azLv) and visibility (azVis); all clones share one shader program.
function glowGroupMaterial(src) {
  const m = src.clone();
  const u = { lv: { value: new Float32Array(32) }, vis: { value: new Float32Array(32).fill(1) } };
  m.userData = { ...src.userData, az: u };
  m.emissive.setRGB(0, 0, 0); m.emissiveMap = null; m.vertexColors = false;
  if (m.transparent) { m.depthWrite = true; m.alphaTest = 0; }
  m.customProgramCacheKey = () => 'azglow' + (m.transparent ? 't' : 'o');
  m.onBeforeCompile = sh => {
    sh.uniforms.azLv = u.lv; sh.uniforms.azVis = u.vis;
    sh.vertexShader = 'attribute vec3 _gcol;\nattribute vec3 _gid;\nuniform float azLv[32];\nuniform float azVis[32];\nvarying vec3 vAzCol;\nvarying vec3 vAzGlow;\nvarying float vAzA;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        int azI = int( _gid.x * 32.0 + 0.5 );
        vAzCol = _gcol; vAzGlow = _gcol * azLv[ azI ]; vAzA = _gid.z;
        if ( azVis[ azI ] < 0.5 ) transformed = vec3( 0.0 );`);
    sh.fragmentShader = 'varying vec3 vAzCol;\nvarying vec3 vAzGlow;\nvarying float vAzA;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float azLens = step( vAzA, 0.99 );
          diffuseColor.rgb = mix( vAzCol * 0.05 + 0.012, vec3( 0.006, 0.009, 0.014 ), azLens ); diffuseColor.a = vAzA; }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = vAzA > 0.99 ? 0.28 : 0.05;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance = vAzGlow;');
  };
  m.needsUpdate = true;
  return m;
}

/**
 * Make a person from template `id`. opts: { seed, clothA, clothB, skin (hex, builds with a 'skin' slot), shadow, glow (force every gadget level) }.
 * Returns { root, bones, mixer, actions, meshes, height, gadgets, setGadget(type, level), showProp(type, on),
 *           play(name, fade, speed), move(speed, scale, {crouch}), update(dt) }.
 * Gadgets (docs/COSTUMES.md): glow meshes `gx_<type>` (userData.gadget, slot 'glow', idle level, segs, `_gseg` attribute)
 * get their own material clone per person so each one is driven alone; hand props `gp_<type>` (userData.prop 'hand').
 */
export function makePerson(id, opts = {}) {
  const t = T[id] || T[cast.ids[0]];
  // the new motion: gait data and (once per template, before any clone) the spring bones for loose cloth and hair
  if (!MOTION.classic) {
    clipsFor(t);
    if (t.motionInfo && !MOTION.off.has('spring')) try { prepareSprings(t); } catch (e) { console.warn('springs: none for', t.root.name, e && e.message); }
  }
  try { if (prepareV2(t)) prepareCardSprings(t); } catch (e) { console.warn('look v2: template skipped', t.root.name, e && e.message); }
  const root = SkeletonUtils.clone(t.root);
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0);
  const seed = opts.seed ?? Math.floor(Math.random() * 1e6);
  const meshes = [], bones = {}, gadgets = {}, lods = [], lod0 = [], glowGroups = [];
  root.traverse(o => {
    if (o.isBone) bones[key(o.name)] = o;
    if (!o.isMesh) return;
    meshes.push(o);
    const gt = o.userData.gadget;
    if (gt) {
      const g = gadgets[gt] || (gadgets[gt] = { type: gt, glow: [], props: [], level: 0, idle: 0 });
      if (o.userData.prop) g.props.push(o);
    }
    if (o.userData.lod) lods.push(o); else if (o.isSkinnedMesh && !gt && !o.geometry.attributes._gid) lod0.push(o);
    if (o.geometry.attributes._gid && o.userData.gadgets) {       // the character's one glow group (every gadget)
      const types = JSON.parse(o.userData.gadgets), idle = JSON.parse(o.userData.idle || '[]'), props = JSON.parse(o.userData.props || '[]');
      const m = glowGroupMaterial([].concat(o.material)[0]), u = m.userData.az;
      types.forEach((tp, i) => {
        const g = gadgets[tp] || (gadgets[tp] = { type: tp, glow: [], props: [], level: 0, idle: 0 });
        g.idle = idle[i] ?? 1; g.level = opts.glow ?? g.idle; g.slot = i; g.group = u; g.prop = props[i] || '';
        u.lv.value[i] = g.level;
      });
      o.material = m; glowGroups.push(o);
      return;
    }
    o.material = [].concat(o.material).map(m => {
      const slot = m.userData.slot;
      if (slot === 'glow' && gt) {      // one clone per person and gadget: its intensity is driven on its own
        const v = m.clone(), g = gadgets[gt];
        g.idle = o.userData.idle ?? 1; g.level = opts.glow ?? g.idle;
        v.emissiveIntensity = g.level; g.glow.push(v);
        return v;
      }
      if (slot === 'clothA' && opts.clothA != null) return variant(m, 'a' + opts.clothA, v => v.color.copy(lin(opts.clothA)));
      if (slot === 'clothB' && opts.clothB != null) return variant(m, 'b' + opts.clothB, v => v.color.copy(lin(opts.clothB)));
      if (slot === 'skin' && opts.skin != null) return variant(m, 's' + opts.skin, v => v.color.copy(lin(opts.skin)));
      return m;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  const clips = clipsFor(t);
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const n in clips) actions[n] = mixer.clipAction(clips[n]);
  let cur = null;
  const rnd = k => ((Math.imul(seed + 1, 2654435761) ^ Math.imul(k + 7, 40503)) >>> 0) % 1000 / 1000;
  const pace = 0.93 + 0.14 * rnd(1);
  const h = { root, bones, id: t.root.name, mixer, actions, meshes, gadgets, current: null, height: t.height, speeds: t.speeds, pace };
  h.setGadget = (type, level) => { const g = gadgets[type]; if (!g) return; g.level = level; g.glow.forEach(m => { m.emissiveIntensity = level; }); if (g.group) g.group.lv.value[g.slot] = level; };
  // props: showProp is the caller's wish; long props (umbrella, staff, spear) also hide while crouching or sitting,
  // where they would sink through the floor
  const vis = g => { const on = g.shown !== false && !(g.long && POSTURE.has(h.current)); g.props.forEach(o => { o.visible = on; }); if (g.group) g.group.vis.value[g.slot] = on ? 1 : 0; };
  h.showProp = (type, on) => { const g = gadgets[type]; if (g) { g.shown = on; vis(g); } };
  for (const t in gadgets) { const g = gadgets[t]; g.long = LONG.test(t) || g.props.some(o => o.userData.long); }
  // level of detail: 0 = full mesh (+ glow group), 1 = crowd low LOD (6 000 triangles, glow baked); no-op without one
  h.lod = 0;
  h.setLOD = n => { if (!lods.length) return; h.lod = n ? 1 : 0; lods.forEach(o => { o.visible = !!n; }); lod0.forEach(o => { o.visible = !n; }); glowGroups.forEach(o => { o.visible = !n; }); };
  h.postureChanged = (prev, name) => { if (POSTURE.has(name) || POSTURE.has(prev)) for (const t in gadgets) if (gadgets[t].long) vis(gadgets[t]); };
  h.play = (name, fade = 0.25, speed = 1) => {
    if (!actions[name]) name = LOCO.has(name) && actions.walk ? 'walk' : 'idle';
    if (h.motion) { if (LOCO.has(name)) h.motion.cmd.speed = (t.speeds[name] || DEFAULT_SPEED[name] || 1.2) * speed; else { h.motion.cmd.pose = name; h.motion.cmd.speed = 0; } h.motion.poseFade = fade || 0.01; return; }
    const a = actions[name];
    if (!a) return;
    a.timeScale = LOCO.has(name) ? speed : speed * pace;
    if (cur === a) return;
    const prev = cur, prevName = h.current;
    a.reset(); a.enabled = true; a.setEffectiveWeight(1);
    const dur = a.getClip().duration;
    if (prev && LOCO.has(name) && LOCO.has(prevName)) a.time = (prev.time / prev.getClip().duration) % 1 * dur;
    else a.time = rnd(name.length) * dur;
    a.play();
    if (prev) prev.crossFadeTo(a, fade, false);
    cur = a; h.current = name;
    if (POSTURE.has(name) || POSTURE.has(prevName)) for (const t in gadgets) if (gadgets[t].long) vis(gadgets[t]);
  };
  h.move = (speed, scale = 1, mo = {}) => {
    const sp = n => (t.speeds[n] || DEFAULT_SPEED[n] || 1.2) * scale;
    if (h.motion) { h.motion.cmd.speed = speed; h.motion.cmd.crouch = !!mo.crouch; return mo.crouch ? 'crouch' : 'walk'; }
    if (mo.crouch) { h.play('crouch', 0.3, Math.max(0.35, Math.min(2.4, Math.max(0.2, speed) / sp('crouch')))); return 'crouch'; }
    let best = null, bd = Infinity;
    for (const n of GAITS) {
      if (!actions[n]) continue;
      const d = Math.abs(Math.log(speed / sp(n))) - (n === h.current ? 0.12 : 0);
      if (d < bd) { bd = d; best = n; }
    }
    h.play(best || 'walk', 0.3, Math.max(0.3, Math.min(2.2, speed / sp(best || 'walk'))));
    return best;
  };
  // the new motion (locomotion.js) drives the mixer itself; ?motion=classic or a template without gait data: crossfades
  if (!MOTION.classic && t.motionInfo) {
    const ix = cast.index[t.root.name] || {};
    h.motion = new Motion(h, t.motionInfo, seed, gaitProfile(t.root.name, ix));
    h.motion.meta = ix;
    if (t.springRig) try { h.motion.springs = attachSprings(h, t.springRig); } catch (e) { console.warn('springs: not attached for', h.id, e && e.message); }
  }
  h.update = dt => (h.motion ? h.motion.update(dt) : mixer.update(dt));
  // look v2: hair cards, finger poses and the face bones (skin.js drives the face) after the body motion
  try { if (attachV2(h, t)) { const up0 = h.update; h.update = dt => { up0(dt); h.rig2.update(dt); }; } } catch (e) { console.warn('look v2: person skipped', h.id, e && e.message); }
  h.play('idle', 0);
  try { lookPerson(h, seed); } catch (e) { console.warn('look: skipped for', h.id, e && e.message); }
  return h;
}
