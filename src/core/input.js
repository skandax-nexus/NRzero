// Keyboard, mouse and touch input with per-frame "pressed" edges.
// Mouse look uses pointer lock when the page may take it, and falls back to click-drag look
// (iframes / sandboxes without pointer-lock permission). Touch controls (touch.js) feed the
// same channels: virtual keys, an analog stick and look deltas in radians.
export class Input {
  constructor(el) {
    this.el = el;
    this.down = new Set();        // physical keys held
    this.virtual = new Set();     // on-screen buttons held
    this.pressed = new Set();     // edges this frame (keys and buttons)
    this.mdx = 0; this.mdy = 0; this.wheel = 0;
    this.lookYaw = 0; this.lookPitch = 0;                  // touch look this frame (radians)
    this.stick = { x: 0, y: 0, mag: 0, active: false };    // touch joystick: x right, y forward, mag 0..1
    this.lookActive = false;                               // a finger is dragging the camera
    this.touchMode = false;                                // set by TouchControls
    this.mouseDown = false; this.clicked = false; this.dragLook = false; this.lockFailed = false;
    this.enabled = true;
    addEventListener('keydown', e => {
      if (e.repeat) return;
      this.down.add(e.code); this.pressed.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => this.releaseAll());
    addEventListener('mousemove', e => {
      if (this.locked) { this.mdx += e.movementX; this.mdy += e.movementY; }
      else if (this.dragLook && (e.buttons & 1)) { this.mdx += e.movementX || 0; this.mdy += e.movementY || 0; }
    });
    el.addEventListener('mousedown', e => { this.mouseDown = true; this.clicked = true; if (e.button === 0) this.dragLook = true; });
    addEventListener('mouseup', () => { this.mouseDown = false; this.dragLook = false; });
    addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockerror', () => this.lockDenied());
  }

  // Pointer lock is a desktop nicety: never on touch, never fatal when the host forbids it.
  lock() {
    if (this.touchMode || this.lockFailed || document.pointerLockElement === this.el || !this.el.requestPointerLock) return;
    try { const p = this.el.requestPointerLock(); p?.catch?.(() => this.lockDenied()); } catch { this.lockDenied(); }
  }
  // Inside a frame the denial is a sandbox policy and permanent; at top level it is usually transient
  // (e.g. re-locking too soon after Esc), so keep trying on later clicks. Drag-look works meanwhile.
  lockDenied() { if (window.self !== window.top) this.lockFailed = true; }
  unlock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* not permitted */ } }
  get locked() { return document.pointerLockElement === this.el; }

  key(c) { return this.enabled && (this.down.has(c) || this.virtual.has(c)); }
  hit(c) { return this.enabled && this.pressed.has(c); }
  anyHit(...cs) { return cs.some(c => this.hit(c)); }

  // ---- virtual input (touch buttons, joystick, look) ----
  press(code) { this.pressed.add(code); }
  hold(code, on) { if (on) { if (!this.virtual.has(code)) this.pressed.add(code); this.virtual.add(code); } else this.virtual.delete(code); }
  setStick(x, y, mag) { const s = this.stick; s.x = x; s.y = y; s.mag = mag; s.active = mag > 0; }
  addLook(yaw, pitch) { this.lookYaw += yaw; this.lookPitch += pitch; }
  releaseAll() { this.down.clear(); this.virtual.clear(); this.setStick(0, 0, 0); this.lookActive = false; this.dragLook = false; }

  endFrame() { this.pressed.clear(); this.mdx = 0; this.mdy = 0; this.wheel = 0; this.clicked = false; this.lookYaw = 0; this.lookPitch = 0; }
}
