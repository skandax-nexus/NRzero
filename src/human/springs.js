// Secondary motion for the 3D cast (docs/MOTION.md, "Locomotion & secondary motion"): coat tails, skirts, tunics,
// sash ends and long hair swing with the body instead of moving rigidly with it.
// The cast rig has 21 body bones and no cloth bones, so each template gets a few spring bones at run time:
//  - skirt: a ring of 8 bones hung from the hips; the loose cloth below the hip joints (cloth that is away from the
//    legs: coat tails, tunics, skirts, sash ends) is re-weighted toward them, more toward the hem;
//  - hair: 3 bones (left, back, right) hung from the head; hair below ear level is re-weighted toward them.
// The body's own bones and their skin weights stay as built (anims.glb keeps retargeting); only the main atlas mesh
// gets the new weights (the crowd low LOD keeps its own). Each bone carries a damped Verlet particle at its tip that
// lags behind the body (inertia, turns, landings), is pulled back to its rest shape, keeps its distance to the
// neighbouring tips (the hem stays a ring) and is pushed out of the thigh capsules, so cloth never passes through the
// legs. Far people get the collision only (no dynamics); ?motion=nospring turns it all off.
import * as THREE from 'three';

const key = n => n.replace(/_\d+$/, '');
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const NSK = 8, NHAIR = 3;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _o = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

function segDist(p, a, b, out) {        // distance from p to segment ab; out = closest point
  _w.subVectors(b, a); const l2 = _w.lengthSq();
  const t = l2 > 1e-9 ? clamp(_v.subVectors(p, a).dot(_w) / l2, 0, 1) : 0;
  out.copy(a).addScaledVector(_w, t);
  return p.distanceTo(out);
}

/**
 * Once per template (t = cast3d's { root, ... }): find the loose cloth and long hair, re-weight them to new spring
 * bones and remember the rig. Returns null when the template has nothing that would swing.
 */
export function prepareTemplate(t) {
  if (t.springRig !== undefined) return t.springRig;
  t.springRig = null;
  let mesh = null;
  t.root.traverse(o => { if (o.isSkinnedMesh && !o.userData.lod && !o.userData.gadget && !o.geometry.attributes._gid && o.geometry.attributes.azMask && (!mesh || o.geometry.attributes.position.count > mesh.geometry.attributes.position.count)) mesh = o; });
  if (!mesh) return null;
  const G = mesh.geometry, sk = mesh.skeleton, bones = sk.bones;
  const bi = {}; bones.forEach((b, i) => { bi[key(b.name)] = i; });
  for (const k of ['hips', 'thigh_L', 'thigh_R', 'shin_L', 'shin_R', 'foot_L', 'foot_R', 'head', 'neck', 'chest']) if (bi[k] === undefined) return null;
  t.root.updateMatrixWorld(true);
  // raw (quantized) mesh positions -> rest world: every bone's world * its inverse bind is the same map at rest
  const M = new THREE.Matrix4().multiplyMatrices(bones[bi.hips].matrixWorld, sk.boneInverses[bi.hips]);
  const J = k => bones[bi[k]].getWorldPosition(new THREE.Vector3());
  const hipJ = J('thigh_L').add(J('thigh_R')).multiplyScalar(0.5), hips = J('hips');
  const knee = { L: J('shin_L'), R: J('shin_R') }, thigh = { L: J('thigh_L'), R: J('thigh_R') }, ank = { L: J('foot_L'), R: J('foot_R') };
  const headJ = J('head'), neckJ = J('neck');
  const P = G.attributes.position, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight, MK = G.attributes.azMask, n = P.count;
  const pos = new Float32Array(n * 3), p = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i++) { p.fromBufferAttribute(P, i).applyMatrix4(M); p.toArray(pos, i * 3); }
  // leg radius: the median distance of the thigh-weighted vertices (skin or trousers) from the thigh bone
  const dl = [];
  for (let i = 0; i < n; i += 3) for (let k = 0; k < 4; k++) if (SW.getComponent(i, k) > 0.85 && (SI.getComponent(i, k) === bi.thigh_L)) { p.fromArray(pos, i * 3); dl.push(segDist(p, thigh.L, knee.L, c)); }
  dl.sort((a, b) => a - b);
  const rLeg = clamp(dl.length ? dl[dl.length >> 1] : 0.075, 0.05, 0.11);
  // per vertex: skirt blend (loose cloth below the hips) and hair blend (long hair below the ears)
  const sS = new Float32Array(n), sH = new Float32Array(n), ang = new Float32Array(n);
  let nS = 0, nH = 0;
  const lowY = Math.min(knee.L.y, knee.R.y);
  for (let i = 0; i < n; i++) {
    p.fromArray(pos, i * 3);
    const skin = MK.getX(i), gloss = MK.getY(i), hair = MK.getZ(i);
    if (hair > 0.5) {
      const s = smooth(headJ.y + 0.01, headJ.y - 0.11, p.y) * smooth(0.02, 0.06, Math.hypot(p.x - headJ.x, p.z - headJ.z));
      if (s > 0.01 && p.y > neckJ.y - 0.25) { sH[i] = s; ang[i] = Math.atan2(p.x - headJ.x, p.z - headJ.z); nH++; }
      continue;
    }
    if (skin > 0.3 || gloss > 0.5) continue;
    if (p.y > hipJ.y + 0.02 || p.y < Math.min(ank.L.y, ank.R.y) + 0.06) continue;
    const d = Math.min(segDist(p, thigh.L, knee.L, c), segDist(p, thigh.R, knee.R, c), segDist(p, knee.L, ank.L, c) + 0.012, segDist(p, knee.R, ank.R, c) + 0.012);
    const rl = rLeg * (p.y > lowY ? 1 : 0.8);
    const s = smooth(rl + 0.02, rl + 0.07, d) * smooth(hipJ.y + 0.02, hipJ.y - 0.16, p.y);
    if (s > 0.01) { sS[i] = s; ang[i] = Math.atan2(p.x - hips.x, p.z - hips.z); nS++; }
  }
  const chains = [];
  const W = k => bones[bi[k]].matrixWorld;
  // a chain: n bones around a centre at height y, hung from parent bone pk; tips from the hem / hair ends per sector
  const build = (kind, count, centre, y, r0, s, pk, defLen, phase) => {
    const out = [];
    for (let k = 0; k < count; k++) {
      const a = phase + k * (2 * Math.PI / (kind === 'hair' ? 4 : count));
      const o = new THREE.Vector3(centre.x + Math.sin(a) * r0, y, centre.z + Math.cos(a) * r0);
      // the sector's lowest loose points give the rest tip
      let tx = 0, tz = 0, tw = 0, ty = Infinity;
      const half = Math.PI / (kind === 'hair' ? 3 : count) * 1.2;
      for (let i = 0; i < n; i++) {
        if (!(s[i] > 0.4)) continue;
        const da = Math.abs(Math.atan2(Math.sin(ang[i] - a), Math.cos(ang[i] - a)));
        if (da > half) continue;
        ty = Math.min(ty, pos[i * 3 + 1]);
      }
      for (let i = 0; i < n; i++) {
        if (!(s[i] > 0.4)) continue;
        const da = Math.abs(Math.atan2(Math.sin(ang[i] - a), Math.cos(ang[i] - a)));
        if (da > half || pos[i * 3 + 1] > ty + 0.06) continue;
        tx += pos[i * 3]; tz += pos[i * 3 + 2]; tw++;
      }
      const tip = tw ? new THREE.Vector3(tx / tw, ty, tz / tw) : o.clone().add(new THREE.Vector3(Math.sin(a) * 0.05, -defLen, Math.cos(a) * 0.05));
      if (tip.distanceTo(o) < 0.08) tip.y = o.y - 0.08;
      // local to the parent bone at rest
      const inv = new THREE.Matrix4().copy(W(pk)).invert();
      out.push({ a, local: o.clone().applyMatrix4(inv), tipLocal: tip.clone().applyMatrix4(inv), len: tip.distanceTo(o), origin: o, tip });
    }
    chains.push({ kind, parent: pk, bones: out, first: 0 });
  };
  if (nS > 60) build('skirt', NSK, hips, hipJ.y + 0.03, 0.05, sS, 'hips', 0.35, 0);
  if (nH > 40) build('hair', NHAIR, headJ, headJ.y - 0.01, 0.02, sH, 'head', 0.12, Math.PI / 2);
  if (!chains.length) return null;
  // spring bone indices after the body's; inverse binds so that, at rest, bone world * inverse = M (like the others)
  let next = bones.length;
  const inverses = [];
  for (const ch of chains) {
    ch.first = next;
    for (const b of ch.bones) {
      // rest world of the spring bone: the parent's rotation, at the origin
      const pw = W(ch.parent);
      pw.decompose(_a, _q, _b);
      const wm = new THREE.Matrix4().compose(b.origin, _q, _b);
      b.restLocal = new THREE.Matrix4().copy(pw).invert().multiply(wm);
      inverses.push(new THREE.Matrix4().copy(wm).invert().multiply(M));
      next++;
    }
  }
  // new weights: the original 4 influences scaled by (1 - s), the two nearest spring bones of the sector by s
  const NI = new Uint8Array(n * 4), NW = new Float32Array(n * 4);
  const cand = [];
  for (let i = 0; i < n; i++) {
    cand.length = 0;
    const s = sS[i] || sH[i], ch = sS[i] ? chains.find(c => c.kind === 'skirt') : sH[i] ? chains.find(c => c.kind === 'hair') : null;
    for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k) * (ch ? 1 - s : 1); if (w > 0) cand.push([SI.getComponent(i, k), w]); }
    if (ch) {
      // the two neighbouring bones in angle
      let best = 0, bd = Infinity, second = 0, sd = Infinity;
      ch.bones.forEach((b, k) => { const d = Math.abs(Math.atan2(Math.sin(ang[i] - b.a), Math.cos(ang[i] - b.a))); if (d < bd) { second = best; sd = bd; best = k; bd = d; } else if (d < sd) { second = k; sd = d; } });
      const u = bd + sd > 1e-6 ? bd / (bd + sd) : 0;
      cand.push([ch.first + best, s * (1 - u)], [ch.first + second, s * u]);
    }
    cand.sort((x, y) => y[1] - x[1]);
    let tot = 0; for (let k = 0; k < 4 && k < cand.length; k++) tot += cand[k][1];
    for (let k = 0; k < 4; k++) { const e = cand[k]; NI[i * 4 + k] = e ? e[0] : 0; NW[i * 4 + k] = e && tot > 0 ? e[1] / tot : 0; }
  }
  G.setAttribute('skinIndex', new THREE.BufferAttribute(NI, 4));
  G.setAttribute('skinWeight', new THREE.BufferAttribute(NW, 4));
  t.springRig = { mesh: mesh.name, chains, inverses, rLeg, nS, nH };
  return t.springRig;
}

/** Per person: add the spring bones to the clone's skeleton (the geometry's new weights need them) and return the sim. */
export function attachSprings(h, rig) {
  if (!rig) return null;
  let mesh = null;
  h.root.traverse(o => { if (o.isSkinnedMesh && o.name === rig.mesh) mesh = o; });
  if (!mesh) return null;
  const B = h.bones, sk = mesh.skeleton, extra = [];
  const S = { chains: [], rig, t: 0, valid: false };
  for (const ch of rig.chains) {
    const parent = B[ch.parent], C = { kind: ch.kind, parent, nodes: [] };
    for (const b of ch.bones) {
      const bone = new THREE.Bone(); bone.name = 'az_' + ch.kind + '_' + C.nodes.length;
      b.restLocal.decompose(bone.position, bone.quaternion, bone.scale);
      parent.add(bone); extra.push(bone);
      C.nodes.push({ bone, rest: b, tip: new THREE.Vector3(), prev: new THREE.Vector3(), restQ: bone.quaternion.clone(), len: b.len });
    }
    S.chains.push(C);
  }
  const ns = new THREE.Skeleton(sk.bones.concat(extra), sk.boneInverses.concat(rig.inverses.map(m => m.clone())));
  mesh.bind(ns, mesh.bindMatrix);
  return new Springs(h, S);
}

const _dir = new THREE.Vector3(), _dir0 = new THREE.Vector3(), _pq = new THREE.Quaternion();
const _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3(), _h1 = new THREE.Vector3(), _h2 = new THREE.Vector3();
const CFG = { skirt: { stiff: 7, damp: 2.2, grav: 0.35, ring: 0.5 }, hair: { stiff: 12, damp: 3.5, grav: 0.25, ring: 0 } };

export class Springs {
  constructor(h, S) { this.h = h; this.S = S; this.valid = false; this.wind = new THREE.Vector3(); }
  reset() { this.valid = false; }
  /** dt: frame time; dyn: false = collision only (far people), no inertia. */
  update(dt, dyn = true) {
    const h = this.h, B = h.bones;
    const sc = h.root.getWorldScale(_o).y;
    // the leg capsules (thigh to knee to ankle), the chest for hair
    B.thigh_L.getWorldPosition(_k1); B.shin_L.getWorldPosition(_h1);
    B.thigh_R.getWorldPosition(_k2); B.shin_R.getWorldPosition(_h2);
    const r = (this.S.rig.rLeg + 0.02) * sc;
    const fresh = !this.valid || !(dt > 0);
    const steps = fresh ? 1 : Math.min(4, Math.ceil(dt / (1 / 60)));
    const sdt = fresh ? 0 : dt / steps;
    for (const C of this.S.chains) {
      const cf = CFG[C.kind];
      C.parent.updateWorldMatrix(true, false);
      C.parent.getWorldQuaternion(_pq);
      for (const nd of C.nodes) {
        nd.bone.quaternion.copy(nd.restQ); nd.bone.updateMatrixWorld(true);
        nd.o = nd.o || new THREE.Vector3(); nd.bone.getWorldPosition(nd.o);
        nd.restTip = nd.restTip || new THREE.Vector3(); nd.restTip.copy(nd.rest.tipLocal).applyMatrix4(C.parent.matrixWorld);
        if (fresh || !dyn || nd.tip.distanceToSquared(nd.restTip) > 1) { nd.tip.copy(nd.restTip); nd.prev.copy(nd.restTip); }
      }
      for (let s = 0; s < steps; s++) {
        if (dyn && sdt > 0) for (const nd of C.nodes) {
          // Verlet: inertia (damped), gravity, a pull back to the rest shape
          _v.subVectors(nd.tip, nd.prev).multiplyScalar(Math.exp(-cf.damp * sdt));
          nd.prev.copy(nd.tip);
          nd.tip.add(_v); nd.tip.y -= 9.81 * cf.grav * sdt * sdt;
          nd.tip.addScaledVector(this.wind, sdt * sdt);
          nd.tip.lerp(nd.restTip, 1 - Math.exp(-cf.stiff * sdt));
        }
        // the hem keeps its ring: neighbours stay about as far apart as at rest
        if (cf.ring && C.nodes.length > 2) for (let k = 0; k < C.nodes.length; k++) {
          const a = C.nodes[k], b = C.nodes[(k + 1) % C.nodes.length];
          const d0 = a.rest.tip.distanceTo(b.rest.tip) * sc, d = a.tip.distanceTo(b.tip);
          if (d > 1e-5) { const corr = (d - d0) / d * 0.5 * cf.ring; _v.subVectors(b.tip, a.tip).multiplyScalar(corr); a.tip.add(_v); b.tip.sub(_v); }
        }
        for (const nd of C.nodes) {
          if (C.kind === 'skirt') {
            // out of the thigh capsules (legs push the cloth, cloth never passes through them)
            for (const [a, b] of [[_k1, _h1], [_k2, _h2]]) {
              const d = segDist(nd.tip, a, b, _w);
              if (d < r && d > 1e-6) nd.tip.sub(_w).multiplyScalar(r / d).add(_w);
            }
          } else {
            // hair stays outside a sphere around the neck and behind the face
            B.neck.getWorldPosition(_w);
            const d = nd.tip.distanceTo(_w), r0 = 0.085 * sc;
            if (d < r0 && d > 1e-6) nd.tip.sub(_w).multiplyScalar(r0 / d).add(_w);
          }
          // fixed length from its root
          _v.subVectors(nd.tip, nd.o); const l = _v.length(), L = nd.len * sc;
          if (l > 1e-6) nd.tip.copy(nd.o).addScaledVector(_v, L / l);
          // never above the root (cloth does not fly up over the hips; hair not over the head)
          if (nd.tip.y > nd.o.y - 0.25 * L) nd.tip.y = nd.o.y - 0.25 * L;
        }
      }
      // the bones point at their tips
      for (const nd of C.nodes) {
        _dir0.subVectors(nd.restTip, nd.o).normalize(); _dir.subVectors(nd.tip, nd.o).normalize();
        _q.setFromUnitVectors(_dir0, _dir);
        nd.bone.getWorldQuaternion(_q2); _q2.premultiply(_q);
        nd.bone.parent.getWorldQuaternion(_pq).invert(); nd.bone.quaternion.copy(_pq.multiply(_q2));
        nd.bone.updateMatrixWorld(true);
      }
    }
    this.valid = true;
  }
}
