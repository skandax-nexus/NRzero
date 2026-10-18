import * as THREE from 'three';
import { Character } from '../core/character.js';
import { glowMat, canvasTex } from './kit.js';

// Ambient pedestrian walking back and forth along a lane.
export class Walker {
  constructor(game, look, lane) {
    this.c = new Character({ ...look, lod: true, shadows: false });
    this.lane = lane; // {x, z0, z1, speed}
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.z = lane.z0 + Math.random() * (lane.z1 - lane.z0);
    this.speed = lane.speed ?? (0.9 + Math.random() * 0.6);
    this.c.root.position.set(lane.x + (Math.random() - 0.5) * 0.8, lane.y || 0, this.z);
    game.scene.add(this.c.root);
    this.idle = lane.idle || false;
    if (this.idle) this.c.root.rotation.y = lane.ry ?? Math.random() * 6;
  }
  update(dt) {
    if (this.c.frozen) return;
    if (!this.idle) {
      this.z += this.dir * this.speed * dt;
      if (this.z > Math.max(this.lane.z0, this.lane.z1)) this.dir = -1;
      if (this.z < Math.min(this.lane.z0, this.lane.z1)) this.dir = 1;
      this.c.root.position.z = this.z;
      this.c.root.rotation.y = this.dir > 0 ? 0 : Math.PI;
      this.c.speed = this.speed;
    } else this.c.speed = 0;
    this.c.update(dt);
  }
}

export function trainCar(len = 16, livery = 0xe9edf2, accent = 0x2ae6ff) {
  const g = new THREE.Group();
  const body = new THREE.MeshPhysicalMaterial({ color: livery, metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.3, metalness: 0.5 });
  const shell = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, len - 3, 6, 16), body);
  shell.rotation.x = Math.PI / 2; shell.scale.set(1, 1, 1.15); shell.position.y = 2.0; shell.castShadow = true; g.add(shell);
  const win = new THREE.Mesh(new THREE.BoxGeometry(3.08, 0.8, len - 3), new THREE.MeshStandardMaterial({ color: 0x1a2028, emissive: 0xffe9c8, emissiveIntensity: 1.3, roughness: 0.1 }));
  win.position.y = 2.4; g.add(win);
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, len - 2), glowMat(accent, 4)); strip.position.set(s * 1.55, 1.5, 0); g.add(strip);
  }
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, len - 2), dark); skirt.position.y = 0.6; g.add(skirt);
  g.userData.len = len;
  return g;
}
export function trainNose(accent = 0x2ae6ff) {
  const g = new THREE.Group();
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), glowMat(0xffffff, 8)); lamp.position.set(-0.8, 1.5, 0); g.add(lamp);
  const lamp2 = lamp.clone(); lamp2.position.x = 0.8; g.add(lamp2);
  const sp = new THREE.SpotLight(0xdff4ff, 60, 60, 0.5, 0.6, 1.4); sp.position.set(0, 1.6, 0); sp.target.position.set(0, 0, 10); g.add(sp, sp.target);
  return g;
}

export function lampPost(color = 0xffd9a8, h = 6.5) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.8, roughness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, h, 10), metal); pole.position.y = h / 2; pole.castShadow = true; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), metal); arm.position.set(0, h - 0.1, 0.7); g.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.7), glowMat(color, 5)); head.position.set(0, h - 0.17, 1.3); g.add(head);
  return g;
}

// Security drone with a vision cone. Patrols waypoints, detects player in cone with line-of-sight.
export class Drone {
  constructor(game, path, opts = {}) {
    this.game = game; this.path = path.map(p => new THREE.Vector3(...p)); this.i = 0; this.speed = opts.speed || 1.6;
    this.range = opts.range || 8; this.fov = opts.fov || 0.42; this.alert = 0; this.wait = 0; this.disabled = false;
    const g = this.mesh = new THREE.Group();
    const shellM = new THREE.MeshPhysicalMaterial({ color: 0x2a2f36, metalness: 0.8, roughness: 0.3, clearcoat: 1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), shellM); body.scale.set(1, 0.7, 1.2); body.castShadow = true; g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), shellM); ring.rotation.x = Math.PI / 2; g.add(ring);
    this.eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), glowMat(0xff3344, 6)); this.eye.position.set(0, -0.02, 0.36); g.add(this.eye);
    for (const s of [-1, 1]) { const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16), new THREE.MeshBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.25 })); rotor.position.set(s * 0.5, 0.12, 0); g.add(rotor); }
    // cone
    const coneGeo = new THREE.ConeGeometry(Math.tan(this.fov) * this.range, this.range, 32, 1, true);
    coneGeo.translate(0, -this.range / 2, 0); coneGeo.rotateX(-Math.PI / 2 + 0.35);
    this.coneMat = new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.cone = new THREE.Mesh(coneGeo, this.coneMat); this.cone.position.z = 0.3; g.add(this.cone);
    this.light = new THREE.SpotLight(0xff4455, 40, this.range * 1.3, this.fov, 0.4, 1.5);
    this.light.position.set(0, 0, 0.3); g.add(this.light); this.light.target.position.set(0, -Math.tan(0.35) * 6, 6.3); g.add(this.light.target);
    g.position.copy(this.path[0]); game.scene.add(g);
    this.t = Math.random() * 10;
  }
  update(dt) {
    this.t += dt; const g = this.mesh, p = this.game.player;
    g.position.y = this.path[0].y + Math.sin(this.t * 2) * 0.08;
    if (this.disabled) { this.cone.visible = false; this.light.visible = false; this.eye.material.emissiveIntensity = 0.3; return 0; }
    // movement
    if (this.wait > 0) { this.wait -= dt; g.rotation.y += Math.sin(this.t * 1.2) * dt * 0.8; }
    else {
      const tgt = this.path[(this.i + 1) % this.path.length]; const d = new THREE.Vector3(tgt.x - g.position.x, 0, tgt.z - g.position.z);
      const dist = d.length();
      if (dist < 0.1) { this.i = (this.i + 1) % this.path.length; this.wait = 1.6; }
      else {
        d.normalize(); const sp = this.speed * (this.alert > 0.3 ? 0.3 : 1);
        g.position.x += d.x * Math.min(dist, sp * dt); g.position.z += d.z * Math.min(dist, sp * dt);
        const yaw = Math.atan2(d.x, d.z); let dy = yaw - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * Math.min(1, dt * 4);
      }
    }
    // detection
    const pp = p.pos.clone(); pp.y += p.crouching ? 0.7 : 1.2;
    const to = pp.clone().sub(g.position); const dist = to.length();
    const fwd = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
    const flat = to.clone().setY(0).normalize();
    const ang = Math.acos(Math.max(-1, Math.min(1, flat.dot(fwd))));
    const range = this.range * (p.crouching ? 0.62 : 1);
    let seen = dist < range && ang < this.fov * 1.25 && !this.game.collision.blocked(g.position, pp, 1.0, this.game.temporal.current);
    if (this.game.residueOn) seen = seen && dist < range * 0.9;
    this.alert = Math.max(0, Math.min(1.2, this.alert + (seen ? dt * (1.6 - dist / range) * 1.2 : -dt * 0.5)));
    const a = Math.min(1, this.alert);
    this.coneMat.opacity = 0.06 + a * 0.12; this.coneMat.color.setRGB(1, 0.2 + (1 - a) * 0.5, 0.25 + (1 - a) * 0.3);
    this.light.color.copy(this.coneMat.color);
    if (seen) { const yaw = Math.atan2(to.x, to.z); let dy = yaw - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * Math.min(1, dt * 2 * a); }
    return this.alert;
  }
}

// Diegetic animated screen texture
export function screenTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const g = c.getContext('2d');
  tex.userData.redraw = (t) => { draw(g, w, h, t); tex.needsUpdate = true; };
  tex.userData.redraw(0);
  return tex;
}

export function sparks(count = 120, color = 0xffb060) {
  const pos = new Float32Array(count * 3), vel = [];
  for (let i = 0; i < count; i++) vel.push(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tex = canvasTex(32, 32, (c) => { const grd = c.createRadialGradient(16, 16, 0, 16, 16, 16); grd.addColorStop(0, '#fff'); grd.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = grd; c.fillRect(0, 0, 32, 32); }, 'spark');
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.12, map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false;
  pts.userData = { vel, life: 0, frozen: false, origin: new THREE.Vector3(),
    burst(o) { this.origin.copy(o); this.life = 1.5; for (let i = 0; i < count; i++) { pos.set([o.x, o.y, o.z], i * 3); vel[i].set((Math.random() - 0.5) * 7, Math.random() * 6, (Math.random() - 0.5) * 7); } g.attributes.position.needsUpdate = true; pts.visible = true; },
    update(dt) { if (this.frozen || this.life <= 0) return; this.life -= dt; for (let i = 0; i < count; i++) { vel[i].y -= 9.8 * dt; pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt; } g.attributes.position.needsUpdate = true; if (this.life <= 0) pts.visible = false; } };
  pts.visible = false;
  return pts;
}
