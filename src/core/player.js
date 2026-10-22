import * as THREE from 'three';
import { Character } from './character.js';
import { CAST } from '../story/cast.js';
import { Motor, PHYS, PHYS_CLASSIC } from './physics.js';

const UP = new THREE.Vector3(0, 1, 0);
export const STICK_SPRINT = 0.9;        // joystick push (0..1) at which a touch player breaks into a sprint
export const STICK_SPRINT_EXIT = 0.78;  // ...and below which the sprint ends (hysteresis: no flicker at the rim)
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const SPEED = { crouch: 1.7, walk: 3.1, stroll: 1.5, sprint: 5.6, stickMin: 0.6 };
const FACE_K = 14, FACE_RATE = 12;      // facing: eases at 14/s, at most 12 rad/s (about 690 deg/s)
const CROUCH_H = 1.1;
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3(), _s = new THREE.Vector3();

// Critically damped spring step towards 0 (x, v in an object), angular frequency w.
function spring(o, w, dt) {
  if (dt <= 0) return;
  const ex = Math.exp(-w * dt), k = o.v + w * o.x;
  o.x = (o.x + k * dt) * ex; o.v = (o.v - w * k * dt) * ex;
}

export class Player {
  constructor(game) {
    this.game = game;
    this.char = new Character({ role: 'kai', ...CAST.kai.look });
    this.pos = this.char.root.position; this.vel = new THREE.Vector3();
    this.yaw = 0; this.camYaw = Math.PI; this.camPitch = 0.18; this.camDist = 3.4; this.grounded = true;
    this.radius = 0.32; this.height = 1.75; this.crouching = false; this.sprinting = false;
    this.stepAcc = 0; this.ray = new THREE.Raycaster(); this.camPos = new THREE.Vector3(); this.lookAt = new THREE.Vector3();
    this.camSmooth = new THREE.Vector3(); this.first = true;
    // new physics (physics.js); missions may turn the edge brake off with player.edgeAssist = false
    this.motor = new Motor(game.collision); this.edgeAssist = true;
    this.visOffset = new THREE.Vector3(); this._sim = new THREE.Vector3(); this._carry = new THREE.Vector3();
    this._tv = new THREE.Vector3(); this._people = []; this._peopleT = 0; this._peopleSrc = [];
    this.stickSprint = false; this.autoCrouch = false;
    this.cam = { arm: 3.4, side: 1, eye: 1.55, step: { x: 0, v: 0 }, dip: { x: 0, v: 0 } };
    this._hs = 0; this._yawPrev = 0;
    // safe respawn: the last stable, well-supported spot (falls into the void return there instead of failing)
    this.safe = null; this._safeT = 0; this._stable = 0; this._respawning = false; this._hidKai = false;
  }

  place(x, y, z, facing = 0) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.yaw = facing; this.char.root.rotation.y = facing;
    this.camYaw = facing + Math.PI; this.first = true;
    this.motor.reset(this.pos); this.grounded = true; this._carryBox = null; this._sim.copy(this.pos); this.visOffset.set(0, 0, 0);
    this.cam.step.x = this.cam.step.v = this.cam.dip.x = this.cam.dip.v = 0; this._hs = 0; this._yawPrev = facing;
    this._stable = 0; this.showKai(true);
    this.applyVisual();
  }

  // camera orbit: mouse (pointer lock or drag fallback; Input only reports movement then), touch drag, arrows, wheel
  lookInput(dt, inp) {
    if (inp.mdx || inp.mdy) { this.camYaw -= inp.mdx * 0.0024; this.camPitch = Math.max(-0.5, Math.min(0.85, this.camPitch + inp.mdy * 0.002)); }
    if (inp.lookYaw || inp.lookPitch) { this.camYaw -= inp.lookYaw; this.camPitch = Math.max(-0.5, Math.min(0.85, this.camPitch + inp.lookPitch)); }
    if (inp.key('ArrowLeft')) this.camYaw += dt * 2; if (inp.key('ArrowRight')) this.camYaw -= dt * 2;
    this.camDist = Math.max(2.2, Math.min(5.5, this.camDist + inp.wheel * 0.3));
  }

  update(dt, allowMove) {
    if (PHYS_CLASSIC) return this.updateClassic(dt, allowMove);
    const g = this.game, inp = g.input, M = this.motor, pos = this.pos;
    this.lookInput(dt, inp);
    // a mission moved Kai since the last frame (lifts, carries, dashes, push-outs, place): no smoothing across it
    if (pos.distanceToSquared(this._sim) > 1e-10) { M.prev.copy(pos); M.renderOffset.set(0, 0, 0); if (pos.distanceToSquared(this._sim) > 1) { M.stepOff = M.stepVel = 0; } }
    else if (M.grounded && M.groundBox?.carry && M.groundBox === this._carryBox) {   // opt-in moving platform: ride along
      _v.copy(M.groundBox.min).sub(this._carry);
      if (_v.lengthSq() < 1) { pos.add(_v); M.prev.add(_v); }
    }
    M.grounded = this.grounded;                     // missions may set grounded (Echo Step landing, m05 terrain)

    let mx = 0, mz = 0, analog = 0;
    if (allowMove) {
      if (inp.key('KeyW')) mz += 1; if (inp.key('KeyS')) mz -= 1;
      if (inp.key('KeyA')) mx += 1; if (inp.key('KeyD')) mx -= 1;
      // touch joystick (keys win when both are used)
      if (!mx && !mz && inp.stick.mag > 0) { mx = -inp.stick.x; mz = inp.stick.y; analog = inp.stick.mag; }
      if (inp.hit('KeyC') || inp.hit('ControlLeft')) { this.crouching = !this.crouching; this.autoCrouch = false; }
    }
    const len = Math.hypot(mx, mz);
    const keySprint = allowMove && !analog && len > 0 && (inp.key('ShiftLeft') || inp.key('ShiftRight'));
    // the stick sprints from STICK_SPRINT and keeps sprinting down to STICK_SPRINT_EXIT
    this.stickSprint = allowMove && analog > 0 && !this.crouching && (analog >= STICK_SPRINT || (this.stickSprint && analog >= STICK_SPRINT_EXIT));
    this.sprinting = keySprint || this.stickSprint;
    if (keySprint && this.crouching) { this.crouching = false; this.autoCrouch = false; }
    const stroll = allowMove && !analog && (inp.key('AltLeft') || inp.key('AltRight'));
    let speed;
    if (analog && !this.stickSprint) {
      const k = smooth(0, 0.72, analog);            // a walk from a light push, a full jog by ~3/4 of the travel
      speed = this.crouching ? SPEED.crouch * (0.35 + 0.65 * k) : SPEED.stickMin + (SPEED.walk - SPEED.stickMin) * k;
    } else speed = this.crouching ? SPEED.crouch : this.sprinting ? SPEED.sprint : stroll ? SPEED.stroll : SPEED.walk;
    // touch: the camera drifts behind a player who runs sideways, unless a finger is steering it
    if (analog && !inp.lookActive) this.camYaw -= inp.stick.x * Math.min(1, analog) * 0.5 * dt;
    const fwdYaw = this.camYaw + Math.PI, tv = this._tv.set(0, 0, 0);
    if (len > 0) {
      const sx = Math.sin(fwdYaw), cz = Math.cos(fwdYaw);
      tv.set((sx * mz + cz * mx) / len, 0, (cz * mz - sx * mx) / len).multiplyScalar(speed);
      const d = wrap(Math.atan2(tv.x, tv.z) - this.yaw), lim = FACE_RATE * dt;
      this.yaw += Math.max(-lim, Math.min(lim, d * (1 - Math.exp(-FACE_K * dt))));
    }
    // jump: buffered for PHYS.buffer s; a crouched player stands up to jump when there is headroom
    if (allowMove && inp.hit('Space')) {
      if (this.crouching && M.headroom(pos, this.radius, CROUCH_H, this.height) === null) { this.crouching = false; this.autoCrouch = false; }
      M.jumpBuf = PHYS.buffer;
    }
    const H = this.crouching ? CROUCH_H : this.height;
    const people = allowMove && !g.cine ? this.gatherPeople(dt) : [];
    this._camPeople = people;
    M.frame({ pos, vel: this.vel, dt, state: g.temporal.current, tv, hasInput: len > 0, sprint: this.sprinting, radius: this.radius,
      height: H, crouching: this.crouching, canJump: !this.crouching, assist: this.edgeAssist, killY: g.killY ?? -30, people });
    this.grounded = M.grounded;
    if (pos.y < (g.killY ?? -30)) this.fallOut();
    else this.trackSafe(dt, allowMove);
    if (g.cine) this.showKai(true);
    // a low ceiling crouches Kai, and he stands again once clear
    if (!this.crouching && M.grounded && M.headroom(pos, this.radius, CROUCH_H, this.height) !== null) { this.crouching = true; this.autoCrouch = true; }
    else if (this.crouching && this.autoCrouch && M.headroom(pos, this.radius, CROUCH_H, this.height) === null) { this.crouching = false; this.autoCrouch = false; }

    // visual: interpolated position + smoothed step, on the model (pos stays the simulated feet point)
    this.visOffset.copy(M.renderOffset); this.visOffset.y += M.stepOff;
    const st = this.cam.step; st.x += M.snaps; spring(st, 14, dt); st.x = Math.max(-0.6, Math.min(0.6, st.x));
    if (M.landing > 2) this.cam.dip.v -= Math.min(1.5, (M.landing - 2) * 0.25);
    spring(this.cam.dip, 10, dt);

    // character animation and the physics -> motion interface (docs/MOTION.md)
    const ch = this.char; ch.root.rotation.y = this.yaw;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    ch.speed = hs; ch.crouch += ((this.crouching ? 1 : 0) - ch.crouch) * Math.min(1, dt * 8);
    this.setInterface(ch, dt, hs, M.airT, M.landing);
    this.applyVisual();
    ch.update(dt);
    if (hs > 0.5 && this.grounded) { this.stepAcc += hs * dt; if (this.stepAcc > (this.sprinting ? 0.9 : 0.75)) { this.stepAcc = 0; g.audio.sfxPlay('step'); } }
    this._sim.copy(pos);
    this._carryBox = M.groundBox?.carry ? M.groundBox : null;
    if (this._carryBox) this._carry.copy(this._carryBox.min);
  }

  // Remember the last stable spot: grounded for 0.4 s, under player control, with ground under the whole footprint.
  trackSafe(dt, allowMove) {
    const g = this.game, M = this.motor;
    this._stable = M.grounded && allowMove && !g.cine && !M.groundBox?.carry ? this._stable + dt : 0;
    if (this._stable < 0.4 || (this._safeT -= dt) > 0) return;
    this._safeT = 0.25;
    if (this.footprintOk(this.pos.x, this.pos.y, this.pos.z)) {
      const s = this.safe || (this.safe = {});
      s.x = this.pos.x; s.y = this.pos.y; s.z = this.pos.z; s.yaw = this.yaw; s.scene = g.scene; s.state = g.temporal.current;
    }
  }
  footprintOk(x, y, z) {
    const col = this.game.collision, st = this.game.temporal.current, r = this.radius;
    for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
      const t = col.groundHeight(x + ox, z + oz, y, st);
      if (t === null || Math.abs(t - y) > 0.05) return false;
    }
    return true;
  }
  // Fell below the kill plane: back to the last safe spot after a short fade (no fail, nothing lost). Falls with no
  // safe spot still standing (an era switch removed it, a new scene, game.fallRespawn === false) fail as before.
  fallOut() {
    const g = this.game, s = this.safe;
    if (this._respawning || g._failing) return;
    if (!s || g.fallRespawn === false || s.scene !== g.scene || s.state !== g.temporal.current || !this.footprintOk(s.x, s.y, s.z)) { g.fail('You fell between states.'); return; }
    const prev = g.control; this._respawning = true; g.control = false;
    g.touch?.buzz?.([40, 40, 60]); g.audio.sfxPlay?.('rewind');
    const done = () => { this._respawning = false; if (g.control === false && !g._failing) g.control = prev; };
    Promise.resolve(g.ui.fade(1, 260)).then(() => {
      if (g.scene === s.scene && !g._failing && s.state === g.temporal.current && this.footprintOk(s.x, s.y, s.z)) this.place(s.x, s.y, s.z, s.yaw);
      else if (!g._failing) { this._respawning = false; g.fail('You fell between states.'); return null; }
      return g.ui.fade(0, 380);
    }).then(done, done);
  }

  // Distance along the camera arm (from o, unit dir d) to the first person cylinder (0.5 m: body + near-plane margin).
  peopleArm(o, d, far) {
    let best = far;
    const ps = this._camPeople; if (!ps?.length) return best;
    const a = d.x * d.x + d.z * d.z; if (a < 1e-6) return best;
    for (const p of ps) {
      const ox = o.x - p.x, oz = o.z - p.z, b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - 0.5 * 0.5;
      if (c < 0) continue;                                       // the pivot is inside: ignore (the motor keeps people off Kai)
      const disc = b * b - a * c; if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / a; if (t <= 0 || t >= best) continue;
      const y = o.y + d.y * t; if (y < p.y - 0.1 || y > p.y + 1.9) continue;
      best = t - 0.15;
    }
    return best;
  }

  // Kai's model hides while the camera arm is squeezed into his head (backed into a corner), and shows again after.
  showKai(on) {
    const m = this.char.person?.root || this.char.body?.root;
    if (!m) return;
    if (!on && !this._hidKai && m.visible) { m.visible = false; this._hidKai = true; }
    else if (on && this._hidKai) { m.visible = true; this._hidKai = false; }
  }

  setInterface(ch, dt, hs, airT, landing) {
    if (!ch.vel?.isVector3) ch.vel = new THREE.Vector3();
    ch.vel.copy(this.vel);
    ch.accel = dt > 0 ? (hs - this._hs) / dt : 0;
    ch.turnRate = dt > 0 ? wrap(this.yaw - this._yawPrev) / dt : 0;
    ch.grounded = this.grounded; ch.airTime = airT; ch.landing = landing;
    this._hs = hs; this._yawPrev = this.yaw;
  }

  // The visual offset goes on the model root under char.root (char.root.position is player.pos itself). A Character
  // that applies it itself declares consumesVisualOffset and reads char.visualOffset.
  applyVisual() {
    const ch = this.char; ch.visualOffset = this.visOffset;
    if (ch.consumesVisualOffset) return;
    const m = ch.person?.root || ch.body?.root;
    if (m) m.position.copy(this.visOffset);
  }

  // People near Kai (named actors, ambient and crowd Characters in the scene) as soft cylinders for the motor.
  gatherPeople(dt) {
    const g = this.game, scene = g.scene, src = this._peopleSrc;
    if ((this._peopleT -= dt) <= 0 || !src.length) {
      this._peopleT = 0.25; src.length = 0;
      const seen = new Set([this.char]);
      for (const id in g.actors) { const c = g.actors[id]; if (c && !seen.has(c)) { seen.add(c); src.push(c); } }
      if (scene) for (const o of scene.children) { const c = o.userData?.character; if (c && !seen.has(c)) { seen.add(c); src.push(c); } }
    }
    const out = this._people; out.length = 0; let n = 0;
    for (const c of src) {
      const r = c.root;
      if (!r || r.parent !== scene || !r.visible || c.ghostMat || c.noCollide || c.p?.noCollide) continue;
      const p = r.position, dx = p.x - this.pos.x, dz = p.z - this.pos.z;
      if (dx * dx + dz * dz > 9 || Math.abs(p.y - this.pos.y) > 2) continue;
      const o = this._peopleBuf?.[n] || ((this._peopleBuf ||= [])[n] = {});
      o.x = p.x; o.y = p.y; o.z = p.z; o.r = PHYS.personR * (c.scale3d || 1); o.key = c; out.push(o); n++;
    }
    return out;
  }

  updateCamera(dt, cam) {
    if (PHYS_CLASSIC) return this.updateCameraClassic(dt, cam);
    const C = this.cam, g = this.game, pos = this.pos, vo = this.visOffset;
    C.eye += ((this.crouching ? 1.15 : 1.55) - C.eye) * Math.min(1, dt * 8);
    if (this.first) { C.eye = this.crouching ? 1.15 : 1.55; C.step.x = C.step.v = C.dip.x = C.dip.v = 0; }
    // pivot: the interpolated body, with stairs smoothed a little more than the body and a gentle landing dip
    const target = this.lookAt.set(pos.x + vo.x, pos.y + vo.y - this.motor.stepOff + C.step.x + C.eye + C.dip.x, pos.z + vo.z);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const dir = _d.set(Math.sin(this.camYaw) * cp, sp, Math.cos(this.camYaw) * cp);
    const right = _r.crossVectors(UP, dir).normalize();
    const state = g.temporal.current, col = g.collision, R = 0.2;
    // the shoulder offset shrinks when a wall is close on that side
    const sideHit = col.rayCast(target, right, 0.42 + R, R, state);
    const side = Math.max(0, Math.min(0.42, sideHit - 0.02));
    C.side = this.first || side < C.side ? side : C.side + (side - C.side) * Math.min(1, dt * 3);
    const shoulder = _s.copy(target).addScaledVector(right, C.side);
    // spring arm: pulls in at once (never inside a wall), eases back out
    let want = this.camDist;
    const hb = col.rayCast(shoulder, dir, want + R, R, state);
    if (hb < Infinity) want = Math.min(want, hb - 0.02);
    const blockers = g.camBlockers;
    if (blockers.length) {
      this.ray.set(shoulder, dir); this.ray.far = want + 0.3;
      const hits = this.ray.intersectObjects(blockers, false);
      for (const h of hits) if (h.object.visible) { want = Math.min(want, h.distance - 0.3); break; }
    }
    want = Math.max(0.3, want);
    C.arm = this.first || want < C.arm ? want : C.arm + (want - C.arm) * Math.min(1, dt * 4);
    // people between Kai and the camera: the arm slides in front of them (quickly, not in one frame), never closer
    // than 0.7 m, so the camera does not pass through a head
    const pw = Math.max(0.7, this.peopleArm(shoulder, dir, this.camDist));
    C.pArm = this.first || C.pArm === undefined ? pw : C.pArm + (pw - C.pArm) * Math.min(1, dt * (pw < C.pArm ? 10 : 3));
    const arm = Math.min(C.arm, C.pArm);
    this.first = false;
    // backed into a wall, the arm is too short to see past Kai's shoulder: hide his model until it opens again
    if (arm < 0.6) this.showKai(false); else if (arm > 0.75) this.showKai(true);
    this.camSmooth.copy(shoulder).addScaledVector(dir, arm);
    cam.position.copy(this.camSmooth);
    cam.lookAt(shoulder.x, shoulder.y - 0.05, shoulder.z);
  }

  // ---------------- ?phys=classic: the original player and camera ----------------
  updateClassic(dt, allowMove) {
    const g = this.game, inp = g.input;
    this.lookInput(dt, inp);
    let mx = 0, mz = 0, analog = 0;
    if (allowMove) {
      if (inp.key('KeyW')) mz += 1; if (inp.key('KeyS')) mz -= 1;
      if (inp.key('KeyA')) mx += 1; if (inp.key('KeyD')) mx -= 1;
      // touch joystick (keys win when both are used)
      if (!mx && !mz && inp.stick.mag > 0) { mx = -inp.stick.x; mz = inp.stick.y; analog = inp.stick.mag; }
      if (inp.hit('KeyC') || inp.hit('ControlLeft')) this.crouching = !this.crouching;
    }
    const keySprint = allowMove && !analog && (inp.key('ShiftLeft') || inp.key('ShiftRight')) && mz > 0;
    const stickSprint = allowMove && analog >= STICK_SPRINT && !this.crouching;   // crouched players sneak at full push
    this.sprinting = keySprint || stickSprint;
    if (keySprint) this.crouching = false;
    const fwdYaw = this.camYaw + Math.PI;
    const len = Math.hypot(mx, mz);
    // partial stick deflection walks slower: 30% of walk speed near the dead zone, full walk from ~85%
    const walkScale = analog && !stickSprint ? 0.3 + 0.7 * smooth(0.12, 0.85, analog) : 1;
    const speed = (this.crouching ? 1.7 : this.sprinting ? 5.6 : 3.1) * walkScale;
    // touch: the camera drifts behind a player who runs sideways, unless a finger is steering it
    if (analog && !inp.lookActive) this.camYaw -= inp.stick.x * Math.min(1, analog) * 0.5 * dt;
    const tv = new THREE.Vector3();
    if (len > 0) {
      const sx = Math.sin(fwdYaw), cz = Math.cos(fwdYaw);
      tv.set((sx * mz + cz * mx) / len, 0, (cz * mz - sx * mx) / len).multiplyScalar(speed);
      const targetYaw = Math.atan2(tv.x, tv.z);
      let d = targetYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 12);
    }
    if (allowMove && this.grounded && inp.hit('Space') && !this.crouching) { this.vel.y = 4.6; this.grounded = false; }
    // integrate in small substeps so fast falls or low frame rates never tunnel through floors
    const n = Math.max(1, Math.ceil(dt / 0.02)), h = dt / n;
    let wasG = this.grounded, air = this.motor.airT, landing = 0;
    for (let i = 0; i < n; i++) {
      const accel = this.grounded ? 14 : 3;
      this.vel.x += (tv.x - this.vel.x) * Math.min(1, h * accel);
      this.vel.z += (tv.z - this.vel.z) * Math.min(1, h * accel);
      this.vel.y = Math.max(-30, this.vel.y - 13 * h);
      const prevY = this.pos.y, vy = this.vel.y;
      this.pos.addScaledVector(this.vel, h);
      const res = g.collision.resolve(this.pos, this.vel, this.radius, this.crouching ? 1.1 : this.height, g.temporal.current, h, prevY);
      this.grounded = res.grounded;
      if (this.grounded && !wasG) landing = Math.max(landing, -vy);
      air = this.grounded ? 0 : air + h; wasG = this.grounded;
    }
    this.motor.airT = air;
    if (this.pos.y < (g.killY ?? -30)) g.fail('You fell between states.');

    // character animation
    const ch = this.char; ch.root.rotation.y = this.yaw;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    ch.speed = hs; ch.crouch += ((this.crouching ? 1 : 0) - ch.crouch) * Math.min(1, dt * 8);
    this.setInterface(ch, dt, hs, air, landing);
    ch.update(dt);
    if (hs > 0.5 && this.grounded) { this.stepAcc += hs * dt; if (this.stepAcc > (this.sprinting ? 0.9 : 0.75)) { this.stepAcc = 0; g.audio.sfxPlay('step'); } }
  }

  updateCameraClassic(dt, cam) {
    const target = this.lookAt.set(this.pos.x, this.pos.y + (this.crouching ? 1.15 : 1.55), this.pos.z);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const dir = new THREE.Vector3(Math.sin(this.camYaw) * cp, sp, Math.cos(this.camYaw) * cp);
    const right = new THREE.Vector3().crossVectors(UP, dir).normalize();
    const shoulder = target.clone().addScaledVector(right, 0.42);
    let dist = this.camDist;
    const blockers = this.game.camBlockers;
    if (blockers.length) {
      this.ray.set(shoulder, dir); this.ray.far = dist + 0.3;
      const hits = this.ray.intersectObjects(blockers, false).filter(h => h.object.visible);
      if (hits.length) dist = Math.max(0.6, hits[0].distance - 0.3);
    }
    const desired = shoulder.clone().addScaledVector(dir, dist);
    if (this.first) { this.camSmooth.copy(desired); this.first = false; }
    this.camSmooth.lerp(desired, Math.min(1, dt * 14));
    cam.position.copy(this.camSmooth);
    cam.lookAt(shoulder.x, shoulder.y - 0.05, shoulder.z);
  }
}
