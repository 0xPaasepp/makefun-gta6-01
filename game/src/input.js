// SOLMAR — input. Keyboard + mouse state. WASD/arrows drive and walk,
// E enters/exits cars, Space handbrake, R reload, M map, P/Esc pause,
// click fires the pistol.

export class Input {
  constructor() {
    this.keys = {};
    this.mouseDown = false;
    this.mouseDX = 0;
    this._listeners = [];
    const kd = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      this.keys[e.key.toLowerCase()] = true;
      this._fire('keydown', e);
    };
    const ku = (e) => { this.keys[e.key.toLowerCase()] = false; };
    const md = (e) => { this.mouseDown = true; this._fire('mousedown', e); };
    const mu = () => { this.mouseDown = false; };
    const mm = (e) => { this.mouseDX = e.movementX || 0; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('mousedown', md);
    window.addEventListener('mouseup', mu);
    window.addEventListener('mousemove', mm);
    this._listeners.push(['keydown', kd], ['keyup', ku], ['mousedown', md], ['mouseup', mu], ['mousemove', mm]);
  }

  on(evt, fn) {
    this._handlers = this._handlers || {};
    (this._handlers[evt] = this._handlers[evt] || []).push(fn);
  }

  _fire(evt, e) {
    const hs = (this._handlers || {})[evt] || [];
    for (const h of hs) h(e);
  }

  isDown(...names) { return names.some((n) => !!this.keys[n]); }
  get up() { return this.isDown('w', 'arrowup'); }
  get down() { return this.isDown('s', 'arrowdown'); }
  get left() { return this.isDown('a', 'arrowleft'); }
  get right() { return this.isDown('d', 'arrowright'); }
  pressed(name) {
    const k = name.toLowerCase();
    if (this.keys[k]) { this.keys[k] = false; return true; }
    return false;
  }
}
