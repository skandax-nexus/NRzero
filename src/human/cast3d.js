// The 3D cast: realistic skinned people (MakeHuman-based bodies with their own textures, clothing and rig, from the
// owner's AfterZero character pipeline, v1.2) plus shared motion-capture clips retargeted onto every body.
// assets/models/cast.glb holds every person (one root per template id); assets/models/anims.glb holds the reference rig
// and clips (idle, walk_slow, walk, jog, run, sprint, crouch, talk, nod, look, sit, work, sad, fall).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const T = {};            // id -> { root, clips, speeds, height, townsfolk }
const key = n => n.replace(/_\d+$/, '');
let lib = null;          // { clips, root, meta }
export const cast = { ready: false, ids: [], meta: {}, loading: null };

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
      const [c, a] = await Promise.all([get('cast.glb'), get('anims.glb')]);
      let meta = {};
      a.scene.traverse(o => { if (o.userData && o.userData.az_clips) try { meta = JSON.parse(o.userData.az_clips); } catch { /* older file */ } });
      lib = { clips: a.animations, root: a.scene, meta }; cast.meta = meta;
      c.scene.children.slice().forEach(root => {
        let skinned = null, hips = null, top = 0;
        root.traverse(o => {
          if (o.isSkinnedMesh) skinned = o;
          if (o.isBone && key(o.name) === 'hips') hips = o;
          if (o.isMesh) {
            o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
            const g = o.geometry, mk = g.attributes._mask || g.attributes._MASK;
            if (mk) { g.setAttribute('azMask', mk); g.deleteAttribute(g.attributes._mask ? '_mask' : '_MASK'); }
            [].concat(o.material).forEach(m => {
              const t = m.userData.tint; if (t) m.color.setRGB(t[0], t[1], t[2]);
              m.envMapIntensity = 0.8;
              if (mk && m.userData.slot === 'atlas') skinShade(m);
              if (m.userData.slot === 'glass') { o.castShadow = false; m.depthWrite = false; }   // see-through lens: no shadow on the eyes
            });
          }
        });
        if (!skinned || !hips) return;
        root.updateMatrixWorld(true);
        root.traverse(o => { if (o.isBone) top = Math.max(top, o.getWorldPosition(new THREE.Vector3()).y); });
        T[root.name] = { root, height: top, box: new THREE.Box3().setFromObject(root), clips: null, speeds: {}, townsfolk: /^town_/.test(root.name) };
        cast.ids.push(root.name);
      });
      cast.ready = cast.ids.length > 0;
    } catch (e) { console.warn('3D cast unavailable; using procedural humans.', e && e.message); }
    return cast.ready;
  })();
  return cast.loading;
}
export const hasTemplate = id => !!T[id];
export const templateHeight = id => (T[id] ? T[id].height : 1.75);
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
  const ratio = dHip0.y / Math.max(1e-3, sHip0.y), seated = !!info.seat || clip.name === 'sit', grounded = !seated && clip.name !== 'fall';
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

/**
 * Make a person from template `id`. opts: { seed, clothA, clothB, skin (hex, townsfolk only), shadow, glow (force every gadget level) }.
 * Returns { root, bones, mixer, actions, meshes, height, gadgets, setGadget(type, level), showProp(type, on),
 *           play(name, fade, speed), move(speed, scale, {crouch}), update(dt) }.
 * Gadgets (docs/COSTUMES.md): glow meshes `gx_<type>` (userData.gadget, slot 'glow', idle level, segs, `_gseg` attribute)
 * get their own material clone per person so each one is driven alone; hand props `gp_<type>` (userData.prop 'hand').
 */
export function makePerson(id, opts = {}) {
  const t = T[id] || T[cast.ids[0]];
  const root = SkeletonUtils.clone(t.root);
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0);
  const seed = opts.seed ?? Math.floor(Math.random() * 1e6);
  const meshes = [], bones = {}, gadgets = {};
  root.traverse(o => {
    if (o.isBone) bones[key(o.name)] = o;
    if (!o.isMesh) return;
    meshes.push(o);
    const gt = o.userData.gadget;
    if (gt) {
      const g = gadgets[gt] || (gadgets[gt] = { type: gt, glow: [], props: [], level: 0, idle: 0 });
      if (o.userData.prop) g.props.push(o);
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
      if (slot === 'skin' && opts.skin != null && t.townsfolk) return variant(m, 's' + opts.skin, v => v.color.copy(lin(opts.skin)));
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
  const h = { root, bones, id: t.root.name, mixer, actions, meshes, gadgets, current: null, height: t.height, speeds: t.speeds };
  h.setGadget = (type, level) => { const g = gadgets[type]; if (!g) return; g.level = level; g.glow.forEach(m => { m.emissiveIntensity = level; }); };
  h.showProp = (type, on) => { const g = gadgets[type]; if (g) g.props.forEach(o => { o.visible = on; }); };
  h.play = (name, fade = 0.25, speed = 1) => {
    if (!actions[name]) name = LOCO.has(name) && actions.walk ? 'walk' : 'idle';
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
  };
  h.move = (speed, scale = 1, mo = {}) => {
    const sp = n => (t.speeds[n] || DEFAULT_SPEED[n] || 1.2) * scale;
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
  h.update = dt => mixer.update(dt);
  h.play('idle', 0);
  return h;
}
