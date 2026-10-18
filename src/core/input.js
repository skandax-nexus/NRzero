// Keyboard + mouse input with pointer lock and per-frame "pressed" edges.
export class Input {
  constructor(el) {
    this.el = el;
    this.down = new Set();
    this.pressed = new Set();
    this.mdx = 0; this.mdy = 0; this.wheel = 0;
    this.mouseDown = false; this.clicked = false;
    this.enabled = true;
    addEventListener('keydown', e => {
      if (e.repeat) return;
      this.down.add(e.code); this.pressed.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    addEventListener('mousemove', e => {
      if (document.pointerLockElement === el) { this.mdx += e.movementX; this.mdy += e.movementY; }
    });
    el.addEventListener('mousedown', () => { this.mouseDown = true; this.clicked = true; });
    addEventListener('mouseup', () => { this.mouseDown = false; });
    addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
  }
  lock() { if (document.pointerLockElement !== this.el) this.el.requestPointerLock?.()?.catch?.(() => {}); }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  get locked() { return document.pointerLockElement === this.el; }
  key(c) { return this.enabled && this.down.has(c); }
  hit(c) { return this.enabled && this.pressed.has(c); }
  anyHit(...cs) { return cs.some(c => this.hit(c)); }
  endFrame() { this.pressed.clear(); this.mdx = 0; this.mdy = 0; this.wheel = 0; this.clicked = false; }
}
