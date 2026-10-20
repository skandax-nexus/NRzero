// Combat-lite (shared system; owner: M10 Enemies Who Remember). Readable, non-lethal temporal combat.
//
// Bible: "Combat NPCs should have readable surrender, retreat, alert, and search behaviours; avoid making every
// encounter end in lethal combat." / "Temporal powers alter positioning and timing, not just damage."
//
//   import { Combat } from '../systems/combat.js';
//   const C = new Combat(game, { hp: 4, onDown: () => C.fail('YOU WERE TAKEN DOWN') });
//   const e = C.addEnemy(character, { patrol: [[x, z], [x, z]], armed: true, states: ['2196'], kind: 'trooper' });
//   C.giveWeapon();                 // the captured temporal weapon: R / click / FIRE = stun bolt, hold = displace
//   C.noise([x, y, z], 12, 'console', 6, [e1, e2]);  // distraction: unaware enemies in range (optionally only these)
//                                   walk over and look around for `hold` seconds
//   C.decoy([x, y, z], 4);          // an afterimage (Echo Step) they see, chase and shoot instead of Kai
//   C.reset();                      // checkpoint restore: everyone back on patrol, Kai healed (restrained stay down)
//   C.allDown(list?) / C.alerted() / C.threat()  for scripting; combatState for music themes.
//
// Enemy states: patrol -> suspicious ('?') -> alert ('!', telegraphed shots) -> search ('…' last known position) ->
// patrol; investigate (noise); stunned (gold time bubble, can be subdued); displaced (thrown three seconds back
// along its own path); surrender (kneels, can be restrained); down (restrained, out of the fight).
// Stealth: an unaware enemy can be taken down from behind (hold E). Unarmed enemies that reach Kai capture him.
// Everything runs from game.onUpdate, so it is cleared with the scene and pauses with the game.
import * as THREE from 'three';

/** Shared, read-only for music themes: threat 0..1 (alerted enemies, shots), fighting flag. */
export const combatState = { threat: 0, alert: 0, fighting: false, stealth: 0 };

const FONT = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _fwd = new THREE.Vector3();
const angDiff = (a, b) => { const d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); };

// ---------- state markers (one shared canvas texture per state) ----------
const MARKS = {};
function markTex(kind) {
  if (MARKS[kind]) return MARKS[kind];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const col = { sus: '#ffc861', alert: '#ff5a5a', search: '#ffc861', stun: '#ffd27a', yield: '#e8eef2', down: '#7fd9a8' }[kind] || '#fff';
  g.fillStyle = 'rgba(8,10,14,0.55)'; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill();
  g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke();
  g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (kind === 'sus') { g.font = `700 38px ${FONT}`; g.fillText('?', 32, 34); }
  else if (kind === 'alert') { g.font = `700 40px ${FONT}`; g.fillText('!', 32, 34); }
  else if (kind === 'search') { for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(20 + i * 12, 34, 4, 0, 7); g.fill(); } }
  else if (kind === 'stun') { g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 13, 0, 7); g.stroke(); g.beginPath(); g.moveTo(32, 32); g.lineTo(32, 22); g.moveTo(32, 32); g.lineTo(39, 36); g.stroke(); }
  else if (kind === 'yield') { g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(22, 44); g.lineTo(22, 20); g.moveTo(42, 44); g.lineTo(42, 20); g.moveTo(22, 44); g.lineTo(42, 44); g.stroke(); }
  else if (kind === 'down') { g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(20, 33); g.lineTo(29, 42); g.lineTo(45, 23); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; MARKS[kind] = t; return t;
}

function injectStyle() {
  if (document.getElementById('combat-hud-style')) return;
  const st = document.createElement('style'); st.id = 'combat-hud-style';
  st.textContent = `
  .cb-hud{position:absolute;left:28px;bottom:50px;display:flex;flex-direction:column;gap:6px;pointer-events:none;opacity:0;transition:opacity .5s;font-family:var(--ui,system-ui)}
  .cb-hud.on{opacity:1}
  .cb-row{display:flex;gap:6px;align-items:center}
  .cb-row b{font:700 11px var(--ui,system-ui);letter-spacing:.3em;color:#c9bfae;min-width:74px}
  .cb-pip{width:22px;height:8px;border-radius:2px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);transition:background .3s}
  .cb-pip.on{background:#e8eef2;box-shadow:0 0 8px rgba(232,238,242,.5)}
  .cb-hud.hurt .cb-pip.on{background:#ff8a7a}
  .cb-cell{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,210,122,.45);background:transparent;transition:background .25s}
  .cb-cell.on{background:#ffd27a;box-shadow:0 0 10px rgba(255,210,122,.7)}
  .cb-mode{font:600 12px var(--ui,system-ui);letter-spacing:.18em;color:#ffd27a;margin-left:6px}
  .cb-vig{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .35s;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(140,30,30,.55) 100%)}
  .cb-vig.on{opacity:1}
  .cb-aim{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border:2px solid rgba(255,210,122,.55);border-radius:50%;pointer-events:none;opacity:0;transition:opacity .25s}
  .cb-aim.on{opacity:1}
  .cb-aim.lock{border-color:#ffd27a;box-shadow:0 0 10px rgba(255,210,122,.6)}
  #touch .tc-btn.cb-fire{width:68px;height:68px;right:calc(172px + var(--sr,0px));bottom:calc(16px + var(--sb,0px));color:#ffd27a;border-color:rgba(255,210,122,.6)}
  #touch .tc-btn.cb-fire.hide,#touch .tc-btn.cb-echo.hide{display:none}
  #touch .tc-btn.cb-echo{width:56px;height:56px;right:calc(252px + var(--sr,0px));bottom:calc(14px + var(--sb,0px));color:#9fe8ff;border-color:rgba(95,230,255,.6)}
  #touch .tc-btn.cb-fire span,#touch .tc-btn.cb-echo span{font:700 9px var(--ui,system-ui);letter-spacing:.18em}
  html.touch .cb-hud{left:calc(14px + var(--sl,0px));bottom:auto;top:calc(82px + var(--st,0px))}
  html.touch .cb-row b{min-width:58px;font-size:10px}`;
  document.head.appendChild(st);
}

/** A round touch button inside the touch layer that holds a virtual key while pressed. */
export function touchButton(game, cls, label, code, svg) {
  const root = game.touch?.root; if (!root) return null;
  let b = root.querySelector('.' + cls);
  if (!b) {
    b = document.createElement('button'); b.className = 'tc-btn ' + cls + ' hide'; b.setAttribute('aria-label', label);
    b.innerHTML = (svg || '') + `<span>${label}</span>`;
    const up = () => { b.classList.remove('down'); game.input.hold(code, false); };
    b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); b.classList.add('down'); game.input.hold(code, true); try { b.setPointerCapture(e.pointerId); } catch { /* ok */ } });
    b.addEventListener('pointerup', e => { e.stopPropagation(); up(); });
    b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    root.appendChild(b);
  }
  return b;
}

export class Combat {
  constructor(game, o = {}) {
    this.game = game; this.o = o;
    this.enemies = []; this.bolts = []; this.decoys = [];
    this.maxHp = o.hp ?? 4; this.hp = this.maxHp; this.sinceHit = 99;
    this.weapon = { owned: false, cells: 3, max: 3, regen: o.cellRegen ?? 3.5, acc: 0, cool: 0, hold: 0 };
    this.active = true; this.downed = false;
    this.onDown = o.onDown || (() => this.fail('YOU WERE TAKEN DOWN'));
    this.onCaught = o.onCaught || (() => this.fail('CAPTURED'));
    this.onShot = o.onShot || null;
    this.tags = new Map();
    injectStyle(); this.buildHud();
    const scene = game.scene;
    // shared geometry / materials
    this.boltGeo = new THREE.SphereGeometry(0.13, 12, 8);
    this.boltMatE = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false });
    this.boltMatK = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, toneMapped: false });
    this.haloMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.bubbleGeo = new THREE.SphereGeometry(1, 20, 14);
    this.trailMat = new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.8, toneMapped: false });
    this.scene = scene;
    this.off = game.onUpdate((dt, t) => this.update(dt, t));
    this.fireBtn = touchButton(game, 'cb-fire', 'FIRE', 'KeyR', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>');
  }

  buildHud() {
    const hud = document.getElementById('hud') || document.body;
    let el = hud.querySelector('.cb-hud');
    if (!el) {
      el = document.createElement('div'); el.className = 'cb-hud';
      el.innerHTML = `<div class="cb-row cb-hp"><b>VITALS</b></div><div class="cb-row cb-wp"><b>DISPLACER</b></div>`;
      hud.appendChild(el);
      const vig = document.createElement('div'); vig.className = 'cb-vig'; hud.appendChild(vig);
      const aim = document.createElement('div'); aim.className = 'cb-aim'; hud.appendChild(aim);
    }
    this.hud = el; this.vig = hud.querySelector('.cb-vig'); this.aim = hud.querySelector('.cb-aim');
    const hp = el.querySelector('.cb-hp'); hp.querySelectorAll('.cb-pip').forEach(p => p.remove());
    this.pips = []; for (let i = 0; i < this.maxHp; i++) { const p = document.createElement('i'); p.className = 'cb-pip on'; hp.appendChild(p); this.pips.push(p); }
    const wp = el.querySelector('.cb-wp'); wp.querySelectorAll('.cb-cell,.cb-mode').forEach(p => p.remove());
    this.cellsEl = []; for (let i = 0; i < this.weapon.max; i++) { const c = document.createElement('i'); c.className = 'cb-cell on'; wp.appendChild(c); this.cellsEl.push(c); }
    const m = document.createElement('span'); m.className = 'cb-mode'; wp.appendChild(m); this.modeEl = m;
    this.hudShown = false;
  }
  showHud(on) { this.hudShown = on; this.hud.classList.toggle('on', on); }

  // ---------------------------------------------------------------- enemies
  addEnemy(char, o = {}) {
    const p = char.root.position;
    const e = {
      char, o, kind: o.kind || 'trooper', name: o.name || 'CONTINUUM', armed: o.armed ?? true, states: o.states || null,
      patrol: (o.patrol || [[p.x, p.z]]).map(q => new THREE.Vector3(q[0], p.y, q[1])), pi: 0, wait: o.wait0 ?? 0, waitAt: o.wait ?? 2.2,
      home: { x: p.x, y: p.y, z: p.z, yaw: char.root.rotation.y },
      range: o.range ?? 11, fov: o.fov ?? 0.62, speed: o.speed ?? 1.3, run: o.run ?? 3.2, keep: o.keep ?? 6,
      state: o.state || 'patrol', alert: 0, last: new THREE.Vector3(), searchT: 0, stunT: 0, cool: 1 + Math.random(), tele: 0,
      shield: !!o.shield, nerve: o.nerve ?? 1, surrenders: o.surrenders ?? true, hist: [], histT: 0, dazeT: 0, invT: 0, look: 0,
      vel: new THREE.Vector3(), barkT: 0, tag: o.tag, enabled: true, scanY: 0, gotTarget: null,
    };
    // the state marker above the head
    e.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex('sus'), transparent: true, depthTest: false, toneMapped: false }));
    e.marker.scale.set(0.42, 0.42, 0.42); e.marker.visible = false; e.marker.renderOrder = 10; this.scene.add(e.marker);
    e.bubble = new THREE.Mesh(this.bubbleGeo, this.bubbleMat); e.bubble.scale.set(0.75, 1.15, 0.75); e.bubble.visible = false; this.scene.add(e.bubble);
    // the chest emitter (telegraph): brightens and pulses before a shot
    if (o.emitter !== false) {
      const em = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 20), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }));
      em.position.set(0, (o.chestY ?? 1.36), 0.17); char.root.add(em); e.emitter = em;
      const halo = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), this.haloMat.clone()); halo.position.set(0, (o.chestY ?? 1.36), 0.18); char.root.add(halo); e.halo = halo;
    }
    if (e.shield) {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.9, 20, 1, true, -0.9, 1.8), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      sh.position.set(0, 1.0, 0); char.root.add(sh); e.shieldMesh = sh;
    }
    // stealth takedown (from behind, unaware) and the restrain prompt (stunned / surrendered)
    e.takedown = this.game.interact({ pos: new THREE.Vector3(), radius: 1.7, hold: 0.55, once: false, prompt: o.takedownPrompt || 'Take down (from behind)',
      enabled: () => this.canTakedown(e), onUse: () => this.takedown(e) });
    e.restrain = this.game.interact({ pos: new THREE.Vector3(), radius: 1.9, hold: 0.45, once: false, prompt: 'Restrain (non-lethal)',
      enabled: () => e.enabled && (e.state === 'stunned' || e.state === 'surrender') && this.inEra(e), onUse: () => this.restrain(e) });
    this.enemies.push(e);
    return e;
  }
  removeEnemy(e) {
    this.enemies = this.enemies.filter(x => x !== e);
    this.game.removeInteract(e.takedown); this.game.removeInteract(e.restrain);
    e.marker.parent?.remove(e.marker); e.bubble.parent?.remove(e.bubble);
    if (e.emitter) { e.emitter.parent?.remove(e.emitter); e.halo.parent?.remove(e.halo); }
    if (e.shieldMesh) e.shieldMesh.parent?.remove(e.shieldMesh);
  }
  clear() { for (const e of [...this.enemies]) this.removeEnemy(e); this.clearBolts(); this.decoys = []; }
  clearBolts() { for (const b of this.bolts) b.mesh.parent?.remove(b.mesh); this.bolts = []; }

  inEra(e) { return !e.states || e.states.includes(this.game.temporal.current); }
  live(e) { return e.enabled && e.state !== 'down'; }
  /** enemies still in the fight (not restrained / surrendered / disabled) */
  standing(list = this.enemies) { return list.filter(e => e.enabled && e.state !== 'down' && e.state !== 'surrender'); }
  allDown(list = this.enemies) { return this.standing(list).length === 0; }
  alerted() { return this.enemies.filter(e => e.enabled && (e.state === 'alert' || e.state === 'search')); }
  threat() { return combatState.threat; }

  setState(e, s) {
    if (e.state === s) return;
    const prev = e.state; e.state = s;
    if (s === 'alert' && prev !== 'alert') { this.bark(e, 'spot'); this.game.audio.sfxPlay('alarm'); e.tele = 0; e.cool = Math.max(e.cool, 0.9); }
    if (s === 'search') { e.searchT = 0; this.bark(e, 'search'); }
    if (s === 'patrol' && (prev === 'search' || prev === 'investigate')) this.bark(e, 'lost');
    if (s === 'surrender') { this.bark(e, 'yield'); e.char.crouch = 1; e.char.speed = 0; }
    this.o.onState?.(e, s, prev);
  }
  bark(e, kind) {
    const list = e.o.barks?.[kind]; if (!list || !list.length) return;
    if (this.game.time < (this._barkAt || 0)) return; this._barkAt = this.game.time + 3.2;
    const line = list[Math.floor(Math.random() * list.length)];
    this.game.ui.subtitle(e.o.voice || null, line, 2600);
  }

  /** Distraction: unaware enemies within radius walk to pos and look around. */
  noise(pos, radius = 10, kind = 'noise', hold = 6, only = null) {
    const p = pos.isVector3 ? pos : new THREE.Vector3(...pos);
    for (const e of this.enemies) {
      if (!this.live(e) || (only && !only.includes(e))) continue;   // the caller decides which era (and who) hears it
      if (['alert', 'stunned', 'surrender', 'displaced'].includes(e.state)) continue;
      if (e.char.root.position.distanceTo(p) > radius) continue;
      e.last.copy(p); e.investKind = kind; e.searchT = 0; e.holdT = hold; e.state = 'patrol'; this.setState(e, 'investigate');
    }
  }
  inEraAt(e) { return !e.states || e.states.includes(this.game.temporal.current) || this.o.eraless; }
  /** An afterimage (Echo Step): enemies who can see it treat it as Kai until it fades. */
  decoy(pos, dur = 4) {
    const d = { pos: pos.isVector3 ? pos.clone() : new THREE.Vector3(...pos), t: dur };
    this.decoys.push(d);
    for (const e of this.enemies) {
      if (!this.live(e) || ['stunned', 'surrender', 'displaced'].includes(e.state)) continue;
      const dist = e.char.root.position.distanceTo(d.pos);
      if (dist < e.range * 1.4 && !this.losBlocked(e, d.pos)) { e.last.copy(d.pos); e.gotTarget = d; if (e.state !== 'alert') this.setState(e, e.armed ? 'alert' : 'investigate'); }
    }
    return d;
  }

  // ---------------------------------------------------------------- player
  giveWeapon() { this.weapon.owned = true; this.weapon.cells = this.weapon.max; this.showHud(true); this.fireBtn?.classList.remove('hide'); }
  hurt(n = 1) {
    if (this.downed || this.game._failing) return;
    this.hp = Math.max(0, this.hp - n); this.sinceHit = 0;
    this.game.audio.sfxPlay('heartbeat'); this.game.touch?.buzz?.([40, 30, 60]); this.game.shake = Math.max(this.game.shake || 0, 0.05);
    this.vig.classList.add('on'); clearTimeout(this._vt); this._vt = setTimeout(() => this.vig.classList.remove('on'), 650);
    this.hud.classList.add('hurt'); setTimeout(() => this.hud.classList.remove('hurt'), 600);
    if (!this.hudShown) this.showHud(true);
    if (this.hp <= 0) { this.downed = true; this.onDown(); }
  }
  heal() { this.hp = this.maxHp; this.sinceHit = 99; this.downed = false; }
  async fail(msg) {
    this.clearBolts();
    await this.game.fail(msg);
  }
  /** checkpoint restore: enemies back to their posts (restrained stay down unless all), Kai healed, cells refilled */
  reset(o = {}) {
    this.heal(); this.clearBolts(); this.decoys = []; this.weapon.cells = this.weapon.max; this.game.shake = 0;
    for (const e of this.enemies) {
      if (!o.all && e.state === 'down') continue;
      if (!o.all && e.state === 'surrender') continue;
      const h = e.home; e.char.root.position.set(h.x, h.y, h.z); e.char.root.rotation.y = h.yaw;
      e.char.frozen = false; e.char.crouch = 0; e.char.pose = null; e.char.speed = 0;
      e.pi = 0; e.wait = e.o.wait0 ?? 0; e.alert = 0; e.stunT = 0; e.tele = 0; e.cool = 1.5; e.hist = []; e.gotTarget = null;
      e.state = e.o.state || 'patrol'; e.bubble.visible = false;
    }
    this.game.ui.detection(0);
  }

  // ---------------------------------------------------------------- perception
  eye(e, out = _v) { const p = e.char.root.position; return out.set(p.x, p.y + 1.62, p.z); }
  losBlocked(e, target) { return this.game.collision.blocked(this.eye(e, new THREE.Vector3()), target, (e.char.root.position.y + 1.2), this.game.temporal.current); }
  canSee(e) {
    const g = this.game, pl = g.player; if (!this.inEra(e) || this.o.invisible?.()) return 0;
    const p = e.char.root.position, tgt = _w.set(pl.pos.x, pl.pos.y + (pl.crouching ? 0.8 : 1.3), pl.pos.z);
    const dx = tgt.x - p.x, dz = tgt.z - p.z, dist = Math.hypot(dx, dz);
    const dark = this.o.darkness ? this.o.darkness(e) : 0;
    let range = e.range * (pl.crouching ? 0.6 : 1) * (1 - dark * 0.45);
    if (e.state === 'alert' || e.state === 'search') range *= 1.35;
    if (dist > range) return 0;
    if (dist > 1.6) {
      const a = Math.abs(angDiff(Math.atan2(dx, dz), e.char.root.rotation.y + e.look));
      const fov = e.fov * (e.state === 'alert' ? 1.6 : 1);
      if (a > fov) return 0;
    }
    if (Math.abs(tgt.y - (p.y + 1.3)) > 4.5) return 0;
    if (g.collision.blocked(this.eye(e, new THREE.Vector3()), tgt, p.y + 1.2, g.temporal.current)) return 0;
    if (pl.crouching && this.o.cover?.(pl.pos)) return 0;
    return 1 - dist / (range + 0.01) * 0.7;
  }
  canTakedown(e) {
    if (!e.enabled || !this.inEra(e) || ['alert', 'stunned', 'surrender', 'down', 'displaced'].includes(e.state) || e.o.noTakedown) return false;
    const p = e.char.root.position, pl = this.game.player.pos;
    const a = Math.abs(angDiff(Math.atan2(pl.x - p.x, pl.z - p.z), e.char.root.rotation.y + e.look));
    return a > 1.85 && Math.hypot(pl.x - p.x, pl.z - p.z) < 1.8;
  }
  takedown(e) {
    const g = this.game; g.audio.sfxPlay('metal'); g.touch?.buzz?.(30);
    const p = e.char.root.position; g.player.char.faceTowards?.(p.x, p.z, 1, 1);
    g.player.yaw = Math.atan2(p.x - g.player.pos.x, p.z - g.player.pos.z); g.player.char.root.rotation.y = g.player.yaw;
    this.setState(e, 'down'); this.downed_(e);
    this.o.onTakedown?.(e);
  }
  restrain(e) { this.game.audio.sfxPlay('metal'); this.setState(e, 'down'); this.downed_(e); this.o.onRestrain?.(e); }
  downed_(e) {
    e.char.frozen = false; e.char.crouch = 0; e.char.speed = 0; e.char.pose = 'sit'; e.bubble.visible = false; e.alert = 0;
    if (e.emitter) { e.emitter.material.color.set(0x3a3020); e.halo.visible = false; }
    if (e.shieldMesh) e.shieldMesh.visible = false;
    this.o.onDowned?.(e);
  }

  // ---------------------------------------------------------------- update
  update(dt, t) {
    const g = this.game; if (!this.active || !g.scene) return;
    const allow = g.control && !g.ui.dlgActive && !g.overlayOpen;
    let maxAlert = 0, alerted = 0;
    for (const e of this.enemies) {
      if (!e.enabled) { e.marker.visible = false; continue; }
      const vis = this.inEra(e) && e.char.root.visible;
      this.updateEnemy(e, dt, t, allow);
      if (e.state !== 'down' && e.state !== 'surrender') {
        if (e.state === 'alert') alerted++;
        if (vis && ['patrol', 'suspicious', 'investigate', 'search'].includes(e.state)) maxAlert = Math.max(maxAlert, e.alert);
        if (e.state === 'alert') maxAlert = 1;
      }
      // marker + interact anchors
      const m = { suspicious: 'sus', investigate: 'sus', alert: 'alert', search: 'search', stunned: 'stun', surrender: 'yield', displaced: 'stun' }[e.state];
      e.marker.visible = !!m && vis && (e.state !== 'investigate' || e.alert > 0.05 || true);
      if (m) { if (e.marker.material.map !== markTex(m)) { e.marker.material.map = markTex(m); e.marker.material.needsUpdate = true; } }
      const rp = e.char.root.position;
      e.marker.position.set(rp.x, rp.y + 2.25 + Math.sin(t * 3) * 0.03, rp.z);
      e.takedown.pos.set(rp.x, rp.y + 1.0, rp.z); e.restrain.pos.set(rp.x, rp.y + 1.0, rp.z);
      e.bubble.position.set(rp.x, rp.y + 1.0, rp.z); e.bubble.visible = vis && (e.state === 'stunned');
    }
    combatState.alert = maxAlert; combatState.fighting = alerted > 0;
    combatState.threat += ((Math.min(1, alerted / 3 + this.bolts.length * 0.1)) - combatState.threat) * Math.min(1, dt * 1.5);
    if (this.o.detectionHud !== false && allow) g.ui.detection(alerted ? 0 : Math.min(0.99, maxAlert));
    // bolts
    this.updateBolts(dt);
    // decoys
    for (const d of this.decoys) d.t -= dt;
    this.decoys = this.decoys.filter(d => d.t > 0);
    // regen
    this.sinceHit += dt;
    if (this.sinceHit > 6 && this.hp < this.maxHp && !this.downed) { this.regenAcc = (this.regenAcc || 0) + dt; if (this.regenAcc > 2.2) { this.regenAcc = 0; this.hp++; } }
    // weapon
    const W = this.weapon;
    if (W.owned) {
      W.cool = Math.max(0, W.cool - dt);
      if (W.cells < W.max) { W.acc += dt; if (W.acc > W.regen) { W.acc = 0; W.cells++; } }
      const inp = g.input;
      const firing = allow && (inp.key('KeyR') || (inp.locked && inp.mouseDown));
      if (firing) W.hold += dt;
      const target = allow ? this.pickTarget() : null;
      this.aim.classList.toggle('on', allow && (firing || alerted > 0));
      this.aim.classList.toggle('lock', !!target);
      this.modeEl.textContent = W.hold > 0.45 ? (W.cells >= 2 ? 'DISPLACE ▸ release' : 'NEED 2 CELLS') : alerted ? 'R / CLICK · STUN — HOLD · DISPLACE' : '';
      if (!firing && W.hold > 0) { const charged = W.hold > 0.45; W.hold = 0; this.fire(charged ? 'displace' : 'stun', target); }
    }
    // hud
    this.pips.forEach((p, i) => p.classList.toggle('on', i < this.hp));
    this.cellsEl.forEach((c, i) => c.classList.toggle('on', i < W.cells));
    if (this.fireBtn) this.fireBtn.classList.toggle('hide', !W.owned || !g.touch?.enabled);
  }

  pickTarget() {
    const g = this.game, cam = g.engine.camera, pl = g.player;
    cam.getWorldDirection(_fwd); _fwd.y = 0; _fwd.normalize();
    let best = null, bs = Infinity;
    for (const e of this.enemies) {
      if (!e.enabled || !this.inEra(e) || ['down', 'surrender'].includes(e.state) || !e.char.root.visible) continue;
      const p = e.char.root.position, dx = p.x - pl.pos.x, dz = p.z - pl.pos.z, d = Math.hypot(dx, dz);
      if (d > 26 || d < 0.3) continue;
      const a = Math.abs(angDiff(Math.atan2(dx, dz), Math.atan2(_fwd.x, _fwd.z)));
      if (a > 0.62) continue;
      if (g.collision.blocked(_v.set(pl.pos.x, pl.pos.y + 1.3, pl.pos.z), _w.set(p.x, p.y + 1.2, p.z), pl.pos.y + 1.2, g.temporal.current)) continue;
      const s = d + a * 14 + (e.state === 'stunned' ? 12 : 0);
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }

  /** Fire the captured temporal weapon: 'stun' (1 cell) or 'displace' (2 cells). Returns true when a bolt left. */
  fire(mode = 'stun', target = this.pickTarget()) {
    const g = this.game, W = this.weapon, pl = g.player;
    const cost = mode === 'displace' ? 2 : 1;
    if (!W.owned || W.cool > 0) return false;
    if (W.cells < cost) { g.audio.sfxPlay('fail'); g.ui.toast(mode === 'displace' ? 'DISPLACE NEEDS TWO CELLS' : 'DISPLACER RECHARGING', 1200); return false; }
    W.cells -= cost; W.cool = 0.45; W.acc = 0;
    const from = new THREE.Vector3(pl.pos.x, pl.pos.y + 1.32, pl.pos.z);
    let dir;
    if (target) { const tp = target.char.root.position; dir = new THREE.Vector3(tp.x, tp.y + 1.15, tp.z).sub(from).normalize(); }
    else { g.engine.camera.getWorldDirection(_fwd); dir = _fwd.clone().setY(0).normalize(); }
    pl.yaw = Math.atan2(dir.x, dir.z); pl.char.root.rotation.y = pl.yaw;
    from.addScaledVector(dir, 0.5);
    if (pl.char) pl.char.wristBoost = 6;
    this.spawnBolt(from, dir, 30, 'kai', mode);
    this.zap(mode === 'displace' ? 520 : 880, 0.18);
    this.onShot?.(mode, target);
    return true;
  }
  zap(f = 880, dur = 0.15, vol = 0.05) {
    const A = this.game.audio; if (!A.ctx) return;
    try { const o = A.tone(f, dur, 'sawtooth', vol, A.sfx); o.o.frequency.exponentialRampToValueAtTime(f * 0.35, A.ctx.currentTime + dur); } catch { /* audio off */ }
  }
  spawnBolt(from, dir, speed, owner, mode = 'stun', aimAt = null) {
    const m = new THREE.Mesh(this.boltGeo, owner === 'kai' ? this.boltMatK : this.boltMatE);
    m.scale.setScalar(mode === 'displace' ? 1.6 : owner === 'kai' ? 0.9 : 1.15);
    m.position.copy(from); this.scene.add(m);
    this.bolts.push({ mesh: m, dir: dir.clone(), speed, owner, mode, life: 2.4, aimAt });
  }
  updateBolts(dt) {
    const g = this.game, pl = g.player, st = g.temporal.current;
    for (const b of this.bolts) {
      const p0 = b.mesh.position.clone();
      b.mesh.position.addScaledVector(b.dir, b.speed * dt); b.life -= dt;
      const p1 = b.mesh.position;
      if (g.collision.blocked(p0, p1, p1.y, st)) { b.life = 0; g.audio.sfxPlay('spark'); this.o.onImpact?.(p1.clone()); continue; }
      if (b.owner === 'kai') {
        for (const e of this.enemies) {
          if (!e.enabled || !this.inEra(e) || e.state === 'down' || e.state === 'surrender') continue;
          const ep = e.char.root.position; _v.set(ep.x, ep.y + 1.1, ep.z);
          if (distSeg(_v, p0, p1) < 0.62) { b.life = 0; this.hitEnemy(e, b); break; }
        }
      } else {
        // decoys soak bolts aimed at them
        if (b.aimAt && b.aimAt.t > 0 && p1.distanceTo(_w.copy(b.aimAt.pos).setY(b.aimAt.pos.y + 1.1)) < 0.75) { b.life = 0; this.o.onImpact?.(p1.clone()); continue; }
        _v.set(pl.pos.x, pl.pos.y + (pl.crouching ? 0.75 : 1.15), pl.pos.z);
        if (distSeg(_v, p0, p1) < 0.42 && !b.aimAt) { b.life = 0; this.hurt(1); }
      }
    }
    for (const b of this.bolts) if (b.life <= 0) b.mesh.parent?.remove(b.mesh);
    this.bolts = this.bolts.filter(b => b.life > 0);
  }
  hitEnemy(e, b) {
    const g = this.game;
    // a shielded officer blocks stuns from the front
    if (e.shield && e.shieldUp !== false && b.mode !== 'displace') {
      const p = e.char.root.position, a = Math.abs(angDiff(Math.atan2(-b.dir.x, -b.dir.z), e.char.root.rotation.y));
      if (a < 1.1) { g.audio.sfxPlay('metal'); g.ui.toast('SHIELDED · GET BEHIND IT', 1400); if (e.state !== 'alert') { e.last.copy(g.player.pos); this.setState(e, 'alert'); } void p; return; }
    }
    if (b.mode === 'displace') this.displace(e, b.dir);
    else this.stun(e);
    this.o.onHit?.(e, b.mode);
  }
  stun(e, sec = e.o.stunTime ?? 9) {
    this.setState(e, 'stunned'); e.stunT = sec; e.char.frozen = true; e.tele = 0; e.alert = 1;
    this.game.audio.sfxPlay('rewind');
    e.timesStunned = (e.timesStunned || 0) + 1;
  }
  /** Displace: the enemy is thrown back to where it stood ~3 s ago (or pushed 5 m along the shot), then dazed. */
  displace(e, dir) {
    const p = e.char.root.position;
    const back = e.hist.length ? e.hist[0] : null;
    let to = back && back.distanceTo(p) > 2 ? back.clone() : p.clone().addScaledVector(dir.clone().setY(0).normalize(), 5);
    // stop short of walls
    const st = this.game.temporal.current;
    for (let k = 0; k < 6 && this.game.collision.blocked(p, to, p.y + 1, st); k++) to.lerp(p, 0.3);
    this.o.onDisplace?.(e, p.clone(), to.clone());
    p.copy(to); e.hist = [];
    this.setState(e, 'displaced'); e.dazeT = 2.6; e.char.speed = 0; e.char.crouch = 0.6;
    this.game.audio.sfxPlay('rewind');
  }

  updateEnemy(e, dt, t, allow) {
    const g = this.game, pl = g.player, ch = e.char, p = ch.root.position;
    // position history for displacement (one sample per 0.25 s, 3 s deep)
    e.histT += dt; if (e.histT > 0.25) { e.histT = 0; e.hist.push(p.clone()); if (e.hist.length > 12) e.hist.shift(); }
    if (e.state === 'down') { ch.speed = 0; return; }
    if (e.state === 'surrender') { ch.speed = 0; ch.crouch = 1; if (e.emitter) e.emitter.material.color.set(0x6a5a30); return; }
    if (!allow && e.state !== 'stunned') { ch.speed = 0; return; }
    if (e.state === 'stunned') {
      e.stunT -= dt; ch.frozen = true;
      e.bubble.material.opacity = 0.12 + 0.06 * Math.sin(t * 6);
      if (e.stunT <= 0) { ch.frozen = false; e.last.copy(pl.pos); this.setState(e, 'alert'); this.maybeSurrender(e, true); }
      return;
    }
    if (e.state === 'displaced') {
      e.dazeT -= dt; ch.crouch = Math.max(0, ch.crouch - dt * 0.4);
      if (e.dazeT <= 0) { ch.crouch = 0; e.last.copy(pl.pos); this.setState(e, 'search'); }
      return;
    }
    const sees = this.canSee(e);
    // decoys win attention while they last
    const decoy = e.gotTarget && e.gotTarget.t > 0 ? e.gotTarget : null;
    if (!decoy) e.gotTarget = null;
    // awareness
    if (sees > 0) {
      const rate = (e.state === 'search' ? 2.6 : 1.25) * (0.5 + sees);
      e.alert = Math.min(1.2, e.alert + dt * rate);
      if (e.alert > 0.25 && e.state === 'patrol') this.setState(e, 'suspicious');
      if (e.alert >= 1) { e.last.copy(pl.pos); if (e.state !== 'alert') this.setState(e, 'alert'); }
      if (e.state === 'suspicious' || e.state === 'investigate') e.last.copy(pl.pos);
    } else {
      e.alert = Math.max(0, e.alert - dt * (e.state === 'alert' ? 0.12 : 0.32));
      if (e.state === 'suspicious' && e.alert < 0.05) this.setState(e, 'patrol');
    }
    if (e.state === 'alert' && sees > 0 && !decoy) e.last.copy(pl.pos);
    if (e.state === 'alert' && !sees && !decoy) { e.lostT = (e.lostT || 0) + dt; if (e.lostT > 3.5) { e.lostT = 0; this.setState(e, 'search'); } } else e.lostT = 0;

    // movement targets
    let target = null, speed = 0, faceTo = null;
    if (e.state === 'patrol') {
      const tp = e.patrol[e.pi % e.patrol.length];
      if (e.patrol.length < 2 || e.wait > 0) {
        e.wait -= dt; e.look = Math.sin(t * 0.6 + e.home.x) * 0.55;
        if (e.patrol.length < 2) { faceTo = null; const dy = angDiff(e.o.yaw ?? e.home.yaw, ch.root.rotation.y); ch.root.rotation.y += dy * Math.min(1, dt * 2); if (p.distanceTo(tp) > 0.3) { target = tp; speed = e.speed; } }
      } else { target = tp; speed = e.speed; e.look *= 0.9; if (Math.hypot(tp.x - p.x, tp.z - p.z) < 0.35) { e.pi = (e.pi + 1) % e.patrol.length; e.wait = e.waitAt; } }
    } else if (e.state === 'suspicious') {
      faceTo = e.last; e.look *= 0.9; speed = 0;
    } else if (e.state === 'investigate' || e.state === 'search') {
      const d = Math.hypot(e.last.x - p.x, e.last.z - p.z);
      if (d > 0.9 && e.searchT < 8 && !e.arrived) { target = e.last; speed = e.state === 'search' ? e.speed * 1.6 : e.speed * 1.25; e.searchT += dt * 0.35; }
      else { e.searchT += dt; e.look = Math.sin(t * 1.4 + e.home.z) * 1.1; }
      if (e.searchT > (e.state === 'search' ? 9 : (e.holdT ?? 6))) { e.alert = 0; e.look = 0; e.holdT = 6; this.setState(e, 'patrol'); }
    } else if (e.state === 'alert') {
      const tgt = decoy ? decoy.pos : e.last;
      const d = Math.hypot(tgt.x - p.x, tgt.z - p.z);
      faceTo = tgt; e.look *= 0.8;
      if (!e.armed) { target = tgt; speed = e.run; }
      else if (d > e.keep + 1.5 || (!sees && !decoy)) { target = tgt; speed = e.run * 0.85; }
      else if (d < e.keep - 2.5) { target = _w.set(p.x - (tgt.x - p.x), p.y, p.z - (tgt.z - p.z)).clone(); speed = e.speed; faceTo = tgt; }
      // capture (unarmed guards grab, armed ones too at point-blank)
      if (!decoy && Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < 1.15 && this.inEra(e) && !g._failing && (!e.armed || e.o.grab)) { this.onCaught(e); return; }
      // shooting with a readable telegraph
      if (e.armed && (sees > 0 || decoy) && this.inEra(e)) {
        e.cool -= dt;
        if (e.cool <= 0) {
          e.tele += dt;
          if (e.tele > (e.o.telegraph ?? 0.85)) {
            e.tele = 0; e.cool = (e.o.rate ?? 2.6) + Math.random() * 0.8;
            const from = new THREE.Vector3(p.x, p.y + 1.36, p.z);
            const aim = decoy ? decoy.pos.clone().setY(decoy.pos.y + 1.1) : new THREE.Vector3(pl.pos.x, pl.pos.y + (pl.crouching ? 0.75 : 1.15), pl.pos.z);
            this.spawnBolt(from, aim.sub(from).normalize(), e.o.boltSpeed ?? 11, 'enemy', 'stun', decoy);
            this.zap(340, 0.25, 0.04);
          }
        }
      }
      this.maybeSurrender(e, false);
    }
    // telegraph glow
    if (e.emitter) {
      const k = e.tele > 0 ? Math.min(1, e.tele / 0.85) : 0;
      e.emitter.scale.setScalar(1 + k * 0.6 + (k > 0 ? Math.sin(t * 30) * 0.15 * k : 0));
      e.halo.material.opacity = 0.18 + k * 0.6; e.halo.scale.setScalar(1 + k * 1.2);
    }
    // move with wall sliding
    if (faceTo && !target) ch.faceTowards(faceTo.x, faceTo.z, dt, 5);
    if (target) {
      const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.2) {
        const sp = Math.min(speed, d / Math.max(dt, 1e-3));
        e.vel.set(dx / d * sp, 0, dz / d * sp);
        const before = p.clone();
        p.x += e.vel.x * dt; p.z += e.vel.z * dt;
        const v0 = new THREE.Vector3();
        g.collision.resolve(p, v0, 0.34, 1.7, g.temporal.current, dt, p.y);
        p.y = before.y;
        const moved = Math.hypot(p.x - before.x, p.z - before.z) / Math.max(dt, 1e-3);
        ch.speed = moved;
        if (faceTo && e.state === 'alert') ch.faceTowards(faceTo.x, faceTo.z, dt, 6); else ch.faceTowards(target.x, target.z, dt, 6);
        if (moved < speed * 0.2) { e.stuck = (e.stuck || 0) + dt; if (e.stuck > 2.5) { e.stuck = 0; if (e.state === 'investigate' || e.state === 'search') e.searchT = 99; else if (e.state === 'patrol') { e.pi = (e.pi + 1) % e.patrol.length; } } } else e.stuck = 0;
      } else ch.speed = 0;
    } else ch.speed = 0;
  }

  maybeSurrender(e, afterStun) {
    if (!e.surrenders || e.kind === 'officer' && this.standing().length > 1) return;
    const others = this.standing().filter(x => x !== e && this.inEra(x) && x.char.root.position.distanceTo(e.char.root.position) < 22);
    const pl = this.game.player.pos, d = Math.hypot(pl.x - e.char.root.position.x, pl.z - e.char.root.position.z);
    // alone, already stunned once (or twice for officers), and Kai close with the weapon: they yield
    if (others.length === 0 && this.weapon.owned && (e.timesStunned || 0) >= (e.kind === 'officer' ? 2 : 1) && (afterStun || d < 7)) this.setState(e, 'surrender');
  }

  dispose() {
    this.off?.(); this.clear(); this.showHud(false); this.aim?.classList.remove('on'); this.vig?.classList.remove('on');
    this.fireBtn?.classList.add('hide'); combatState.threat = 0; combatState.fighting = false; combatState.alert = 0;
    this.game.ui.detection(0);
  }
}

function distSeg(p, a, b) {
  const ab = _fwd.copy(b).sub(a), l2 = ab.lengthSq();
  const t = l2 > 0 ? Math.max(0, Math.min(1, new THREE.Vector3().copy(p).sub(a).dot(ab) / l2)) : 0;
  return new THREE.Vector3().copy(a).addScaledVector(ab, t).distanceTo(p);
}
