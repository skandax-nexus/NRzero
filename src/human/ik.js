// Inverse kinematics helpers for the cast's 21-bone rig (docs/MOTION.md, "Locomotion & secondary motion").
// Everything works in world space and writes local bone quaternions back, so it composes with the animation mixer
// and with any parent transform (a scaled person root, a leaning root, a moving vehicle).
//   rotateWorld(bone, q)         turn a bone by a world-space rotation (q premultiplied onto its world orientation)
//   setWorldQuat(bone, q)        give a bone a world orientation
//   twoBoneIK(a, b, c, target)   thigh / shin / foot (or upper arm / forearm / hand): reach `target` with the end of the
//                                chain, keeping the plane the animation bent the middle joint in (knees keep pointing
//                                where they pointed); returns how far the target stayed out of reach (m)
import * as THREE from 'three';

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion();
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _C = new THREE.Vector3(), _n = new THREE.Vector3();
const _u = new THREE.Vector3(), _w = new THREE.Vector3(), _t = new THREE.Vector3(), _sc = new THREE.Vector3(), _ps = new THREE.Vector3();

// Fast reads of a bone's world transform from its matrixWorld (no walk up the parents): the callers keep the
// matrices current (the person root is updated once a frame, every edit below updates the edited subtree).
export const wpos = (o, v) => v.setFromMatrixPosition(o.matrixWorld);
export const wquat = (o, q) => { o.matrixWorld.decompose(_ps, q, _sc); return q; };

/** Rotate `bone` by the world-space rotation q (its children follow). Updates the bone's world matrix. */
export function rotateWorld(bone, q) {
  wquat(bone, _qa);
  _qa.premultiply(q);
  return setWorldQuat(bone, _qa);
}
/** Give `bone` the world orientation q. Updates the bone's world matrix (and its children's). */
export function setWorldQuat(bone, q) {
  const p = bone.parent;
  if (p) { wquat(p, _qb).invert(); bone.quaternion.copy(_qb.multiply(q)); }
  else bone.quaternion.copy(q);
  bone.updateMatrixWorld(true);
  return bone;
}

/**
 * Two-bone IK: a (root joint, e.g. thigh), b (middle, shin), c (end, foot). Moves c's origin to `target` (world).
 * `pole` (optional world vector): bend direction used only when the animated chain is straight. Returns the distance
 * the target was out of reach (0 when reached). `weight` blends between the animated chain (0) and the solve (1).
 */
export function twoBoneIK(a, b, c, target, pole = null, weight = 1) {
  if (weight <= 0) return 0;
  wpos(a, _A); wpos(b, _B); wpos(c, _C);
  const l1 = _A.distanceTo(_B), l2 = _B.distanceTo(_C);
  if (l1 < 1e-4 || l2 < 1e-4) return 0;
  _t.copy(target);
  if (weight < 1) _t.lerpVectors(_C, target, weight);
  const dist = _A.distanceTo(_t);
  const lo = Math.abs(l1 - l2) + 1e-3, hi = (l1 + l2) * 0.9995;
  const d = Math.min(hi, Math.max(lo, dist));
  // 1. the middle joint: bend about the chain's plane normal to the angle that spans d
  _u.subVectors(_A, _B); _w.subVectors(_C, _B);
  _n.crossVectors(_u, _w);
  if (_n.lengthSq() < 1e-10) {          // straight chain: bend toward the pole (or keep straight)
    if (!pole) _n.set(1, 0, 0); else _n.crossVectors(_u, pole);
    if (_n.lengthSq() < 1e-10) _n.set(1, 0, 0);
  }
  _n.normalize();
  const cur = _u.angleTo(_w);
  const want = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))));
  const delta = want - cur;
  if (Math.abs(delta) > 1e-5) {
    // rotating C about n through B by -delta opens the angle at B (u x w = n: positive turns w away from u)
    _qc.setFromAxisAngle(_n, delta);
    rotateWorld(b, _qc);
  }
  // 2. the root joint: swing the chain so the end points at the target
  wpos(c, _C);
  _u.subVectors(_C, _A).normalize(); _w.subVectors(_t, _A).normalize();
  if (_u.dot(_w) < 0.999999) { _qc.setFromUnitVectors(_u, _w); rotateWorld(a, _qc); }
  return Math.max(0, dist - hi);
}
