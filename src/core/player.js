import * as THREE from 'three';
import { Character } from './character.js';
import { CAST } from '../story/cast.js';

const UP = new THREE.Vector3(0, 1, 0);
export const STICK_SPRINT = 0.9;   // joystick push (0..1) at which a touch player breaks into a sprint
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Player {
  constructor(game) {
    this.game = game;
    this.char = new Character({ role: 'kai', ...CAST.kai.look });
    this.pos = this.char.root.position; this.vel = new THREE.Vector3();
    this.yaw = 0; this.camYaw = Math.PI; this.camPitch = 0.18; this.camDist = 3.4; this.grounded = true;
    this.radius = 0.32; this.height = 1.75; this.crouching = false; this.sprinting = false;
    this.stepAcc = 0; this.ray = new THREE.Raycaster(); this.camPos = new THREE.Vector3(); this.lookAt = new THREE.Vector3();
    this.camSmooth = new THREE.Vector3(); this.first = true;
  }

  place(x, y, z, facing = 0) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.yaw = facing; this.char.root.rotation.y = facing;
    this.camYaw = facing + Math.PI; this.first = true;
  }

  update(dt, allowMove) {
    const g = this.game, inp = g.input;
    // camera orbit: mouse (pointer lock or drag fallback; Input only reports movement then) and touch drag
    if (inp.mdx || inp.mdy) { this.camYaw -= inp.mdx * 0.0024; this.camPitch = Math.max(-0.5, Math.min(0.85, this.camPitch + inp.mdy * 0.002)); }
    if (inp.lookYaw || inp.lookPitch) { this.camYaw -= inp.lookYaw; this.camPitch = Math.max(-0.5, Math.min(0.85, this.camPitch + inp.lookPitch)); }
    if (inp.key('ArrowLeft')) this.camYaw += dt * 2; if (inp.key('ArrowRight')) this.camYaw -= dt * 2;
    this.camDist = Math.max(2.2, Math.min(5.5, this.camDist + inp.wheel * 0.3));

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
    for (let i = 0; i < n; i++) {
      const accel = this.grounded ? 14 : 3;
      this.vel.x += (tv.x - this.vel.x) * Math.min(1, h * accel);
      this.vel.z += (tv.z - this.vel.z) * Math.min(1, h * accel);
      this.vel.y = Math.max(-30, this.vel.y - 13 * h);
      const prevY = this.pos.y;
      this.pos.addScaledVector(this.vel, h);
      const res = g.collision.resolve(this.pos, this.vel, this.radius, this.crouching ? 1.1 : this.height, g.temporal.current, h, prevY);
      this.grounded = res.grounded;
    }
    if (this.pos.y < (g.killY ?? -30)) g.fail('You fell between states.');

    // character animation
    const ch = this.char; ch.root.rotation.y = this.yaw;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    ch.speed = hs; ch.crouch += ((this.crouching ? 1 : 0) - ch.crouch) * Math.min(1, dt * 8);
    ch.update(dt);
    if (hs > 0.5 && this.grounded) { this.stepAcc += hs * dt; if (this.stepAcc > (this.sprinting ? 0.9 : 0.75)) { this.stepAcc = 0; g.audio.sfxPlay('step'); } }
  }

  updateCamera(dt, cam) {
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
