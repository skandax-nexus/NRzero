import * as THREE from 'three';
import { Engine } from './engine.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Collision } from './collision.js';
import { Temporal } from './temporal.js';
import { Player } from './player.js';
import { Character, renderPortraits } from './character.js';
import { CAST } from '../story/cast.js';

class Abort extends Error { constructor() { super('mission aborted'); this.abort = true; } }

export class Game {
  constructor() {
    this.engine = new Engine(document.getElementById('viewport'));
    this.input = new Input(this.engine.renderer.domElement);
    this.audio = new AudioEngine();
    this.ui = new UI(this);
    this.collision = new Collision();
    this.temporal = new Temporal(this);
    this.player = new Player(this);
    this.actors = {}; this.interactables = []; this.updaters = []; this.camBlockers = [];
    this.control = false; this.paused = false; this.running = false; this.token = 0;
    this.time = 0; this.cine = null; this.residueOn = false; this.residueUnlocked = false; this.residueObjs = [];
    this.checkpointData = null; this.flags = {}; this.killY = -30;
    this.clock = new THREE.Clock();
    const qp = new URLSearchParams(location.search);
    this.dtCap = +(qp.get('dtcap') || 0.05); this.autoplay = qp.has('auto');
    this.use = (txt) => { const it = this.interactables.find(i => i.prompt.toLowerCase().includes(txt.toLowerCase())); if (it) { this.useInteract(it); return true; } return false; };
    this.overlayOpen = false;
    this.engine.renderer.domElement.addEventListener('click', () => { if (this.running && !this.paused && !this.ui._choice && !this.overlayOpen) this.input.lock(); });
    document.addEventListener('pointerlockchange', () => {
      if (!this.input.locked && this.running && !this.paused && !this.ui._choice && !this.overlayOpen && this.control) this.pause(true);
    });
    addEventListener('keydown', e => {
      if (!this.running) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.journalOpen) { this.toggleJournal(false); return; }
        if (!this.overlayOpen && !this.ui._choice) this.pause(!this.paused);
      }
      if (e.code === 'KeyJ' && !this.paused && !this.ui.dlgActive && !this.overlayOpen) this.toggleJournal(!this.journalOpen);
    });
  }

  async init() {
    this.ui.portraits = renderPortraits(CAST);
  }

  // ---------- scene lifecycle ----------
  newScene(opts = {}) {
    const s = new THREE.Scene();
    s.background = new THREE.Color(opts.background ?? 0x000000);
    if (opts.fog) s.fog = new THREE.FogExp2(opts.fog[0], opts.fog[1]);
    s.environmentIntensity = opts.envIntensity ?? 0.35;
    this.scene = s; this.engine.setScene(s);
    this.collision.clear(); this.temporal.reset(); this.interactables = []; this.updaters = []; this.camBlockers = []; this.residueObjs = [];
    this.actors = { kai: this.player.char }; this.cine = null; this.shake = 0; this.flags.frozen = false; this.flags.crash = false;
    this.player.char.lookTarget = null; this.killY = opts.killY ?? -30;
    s.add(this.player.char.root);
    this.player.char.frozen = false; this.player.crouching = false;
    this.residueUnlocked = !!opts.residue; this.engine.fx.uFreeze.value = 0; this.engine.fx.uResidue.value = 0; this.engine.fx.uTint.value.set(1, 1, 1);
    this.engine.renderer.toneMappingExposure = opts.exposure ?? 1;
    this.engine.bloom.strength = opts.bloom ?? 0.7; this.engine.bloom.threshold = opts.bloomThreshold ?? 0.9;
    this.setResidue(false);
    return s;
  }

  actor(id, look, x, y, z, ry = 0) {
    const c = new Character(look || CAST[id].look);
    c.root.position.set(x, y, z); c.root.rotation.y = ry; this.scene.add(c.root);
    this.actors[id] = c; return c;
  }
  ambient(look, x, y, z, ry = 0) { const c = new Character(look); c.root.position.set(x, y, z); c.root.rotation.y = ry; this.scene.add(c.root); this.onUpdate(dt => c.update(dt)); return c; }
  blocker(mesh) { this.camBlockers.push(mesh); return mesh; }
  residue(obj) { obj.userData.residue = true; obj.visible = this.residueOn; this.residueObjs.push(obj); return obj; }
  onUpdate(fn) { this.updaters.push(fn); return () => { this.updaters = this.updaters.filter(f => f !== fn); }; }
  interact(o) {
    const it = Object.assign({ radius: 1.6, hold: 0, once: true, enabled: () => true, progress: 0 }, o);
    it.pos = it.pos.isVector3 ? it.pos : new THREE.Vector3(...it.pos);
    this.interactables.push(it); return it;
  }
  removeInteract(it) { this.interactables = this.interactables.filter(i => i !== it); }

  // ---------- script helpers (abortable) ----------
  guard(tok) { if (tok !== this.token) throw new Abort(); }
  async wait(sec) { const tok = this.token; const end = this.time + sec; await this.waitFor(() => this.time >= end); this.guard(tok); }
  waitFor(pred) {
    const tok = this.token;
    return new Promise((res, rej) => {
      const check = () => { if (tok !== this.token) return rej(new Abort()); if (pred()) return res(); requestAnimationFrame(check); };
      check();
    });
  }
  async say(id, text, opts) { const tok = this.token; this.guard(tok); await this.ui.say(id, text, opts); this.guard(tok); }
  async talk(lines, cinematic = false) {
    const tok = this.token; const prev = this.control;
    if (cinematic) this.control = false;
    await this.ui.talk(lines); this.guard(tok);
    if (cinematic) this.control = prev;
  }
  async choice(id, text, opts) { const tok = this.token; const r = await this.ui.choice(id, text, opts); this.guard(tok); if (this.running && !this.paused) this.input.lock(); return r; }
  objective(t) { this.ui.objective(t); if (t) this.audio.sfxPlay('pickup'); }

  // cinematic camera: tween to pos/look; hold until releaseCam()
  shot(pos, look, dur = 2, opts = {}) {
    const cam = this.engine.camera;
    const from = { p: cam.position.clone(), l: this.cine ? this.cine.look.clone() : this.player.lookAt.clone() };
    if (!this.cine) { const d = new THREE.Vector3(); cam.getWorldDirection(d); from.l = cam.position.clone().addScaledVector(d, 5); }
    const to = { p: new THREE.Vector3(...pos), l: new THREE.Vector3(...look) };
    this.cine = { from, to, t: 0, dur: Math.max(0.001, dur), look: from.l.clone(), fov: opts.fov, follow: opts.follow };
    return this.wait(dur);
  }
  releaseCam() { this.cine = null; this.player.first = true; this.engine.camera.fov = 58; this.engine.camera.updateProjectionMatrix(); }

  checkpoint(x, y, z, facing = 0, onRestore) { this.checkpointData = { x, y, z, facing, onRestore, state: this.temporal.current }; }
  async fail(msg) {
    if (this._failing) return; this._failing = true;
    const prev = this.control; this.control = false;
    this.audio.sfxPlay('fail'); this.ui.toast(msg || 'TIMELINE COLLAPSED', 2400);
    await this.ui.fade(1, 700);
    this.restoreCheckpoint();
    await new Promise(r => setTimeout(r, 400));
    await this.ui.fade(0, 700);
    this.control = prev || true; this._failing = false;
  }
  restoreCheckpoint() {
    const c = this.checkpointData; if (!c) return;
    if (c.state && c.state !== this.temporal.current && this.temporal.def(c.state)) this.temporal.setImmediate(c.state);
    this.player.place(c.x, c.y, c.z, c.facing);
    c.onRestore?.();
    this.ui.detection(0);
  }

  setResidue(on) {
    this.residueOn = on; this.ui.residue(on);
    for (const o of this.residueObjs) o.visible = on && (!o.userData.states || o.userData.states.includes(this.temporal.current));
    if (on) this.audio.sfxPlay('anomaly');
  }

  toggleJournal(on) { this.journalOpen = on; this.ui.toggleJournal(on); if (on) { this.paused = true; this.input.unlock(); } else { this.paused = false; this.input.lock(); } }
  pause(on) {
    this.paused = on; this.ui.show('pause', on);
    if (on) { this.input.unlock(); this.audio.ctx?.suspend(); } else { this.audio.ctx?.resume(); this.input.lock(); }
  }

  // ---------- missions ----------
  async runMissions(list, startIndex, onProgress) {
    const tok = ++this.token; this.running = true;
    try {
      for (let i = startIndex; i < list.length; i++) {
        onProgress?.(i);
        this.ui.objective(''); this.control = false;
        await list[i].run(this);
        this.guard(tok);
      }
    } catch (e) { if (!e.abort) { console.error(e); } }
  }
  abort() { this.token++; this.running = false; this.control = false; this.paused = false; this.ui.show('dialogue', false); this.ui.dlgActive = false; this.ui._adv?.(); this.ui.letterbox(false); this.ui.show('pause', false); this.ui.show('hud', false); this.ui.show('puzzle', false); this.overlayOpen = false; }

  // ---------- loop ----------
  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      const raw = this.clock.getDelta(); this.fps = this.fps ? this.fps * 0.95 + (1 / Math.max(raw, 1e-4)) * 0.05 : 30;
      const dt = Math.min(this.dtCap, raw);
      if (this.titleUpdate) { this.time += dt; this.titleUpdate(dt, this.time); }
      else if (!this.paused) this.step(dt);
      this.engine.render(this.time);
      this.input.endFrame();
    };
    loop();
  }

  step(dt) {
    this.time += dt;
    const allow = this.control && !this.ui.dlgActive && !this.overlayOpen;
    if (this.scene && this.player.char.root.parent === this.scene) {
      this.player.update(dt, allow);
    }
    this.temporal.update(dt);
    // residue vision
    if (this.residueUnlocked && allow && this.input.hit('KeyF')) this.setResidue(!this.residueOn);
    const fx = this.engine.fx;
    fx.uResidue.value += ((this.residueOn ? 1 : 0) - fx.uResidue.value) * Math.min(1, dt * 5);
    // interactables
    let best = null, bd = Infinity;
    if (allow) for (const it of this.interactables) {
      if (!it.enabled()) continue;
      if (it.states && !it.states.includes(this.temporal.current)) continue;
      const d = it.pos.distanceTo(this.player.pos.clone().setY(this.player.pos.y + 1));
      if (d < it.radius && d < bd) { bd = d; best = it; }
    }
    if (best) {
      if (best.hold > 0) {
        if (this.input.key('KeyE')) best.progress += dt / best.hold; else best.progress = Math.max(0, best.progress - dt * 2);
        this.ui.prompt(best.prompt, best.progress);
        if (best.progress >= 1) { best.progress = 0; this.useInteract(best); }
      } else {
        this.ui.prompt(best.prompt, 0);
        if (this.input.hit('KeyE')) this.useInteract(best);
      }
    } else this.ui.prompt(null);
    for (const id in this.actors) if (id !== 'kai') this.actors[id].update(dt);
    for (const f of [...this.updaters]) f(dt, this.time);
    // camera
    const cam = this.engine.camera;
    if (this.cine) {
      const c = this.cine; c.t = Math.min(c.dur, c.t + dt);
      const k = c.t / c.dur, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      cam.position.lerpVectors(c.from.p, c.to.p, e);
      c.look.lerpVectors(c.from.l, c.to.l, e);
      if (c.follow) c.look.copy(c.follow.isVector3 ? c.follow : c.follow.position).add(new THREE.Vector3(0, 1.5, 0));
      cam.lookAt(c.look);
      if (c.fov) { cam.fov += (c.fov - cam.fov) * Math.min(1, dt * 2); cam.updateProjectionMatrix(); }
    } else if (this.scene) this.player.updateCamera(dt, cam);
    if (this.shake > 0) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake));
  }

  useInteract(it) {
    if (it.once) this.removeInteract(it);
    this.ui.prompt(null);
    it.onUse?.(it);
  }
}
