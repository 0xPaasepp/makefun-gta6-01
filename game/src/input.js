// SOLMAR input — keyboard + touch buttons + pointer camera orbit.
export class Input {
  constructor(game) {
    this.game = game;
    this.keys = {};
    this.touch = { forward: false, back: false, left: false, right: false };
    this.yawDelta = 0; this.pitchDelta = 0;
    this._bindKeys();
    this._bindTouch();
    this._bindPointer();
  }
  _bindKeys() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      const g = this.game;
      if (e.code === 'KeyE') g.tryEnterCar();
      if (e.code === 'KeyF') g.combat.shoot();
      if (e.code === 'KeyM') g.hud.toggleMap();
      if (e.code === 'Escape' || e.code === 'KeyP') g.togglePause();
      if (e.code === 'Space') { g.jump(); e.preventDefault(); }
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  }
  _bindTouch() {
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const on = (e) => { e.preventDefault(); this.touch[key] = true; };
      const off = (e) => { e.preventDefault(); this.touch[key] = false; };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off, { passive: false });
      el.addEventListener('mousedown', on);
      el.addEventListener('mouseup', off);
    };
    bind('t-up', 'forward'); bind('t-down', 'back');
    bind('t-left', 'left'); bind('t-right', 'right');
    const act = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false });
      el.addEventListener('click', fn);
    };
    act('t-act', () => this.game.tryEnterCar());
    act('t-fire', () => this.game.combat.shoot());
  }
  _bindPointer() {
    const cv = document.getElementById('game-canvas');
    let dragging = false, lx = 0, ly = 0;
    cv.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; });
    addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.yawDelta += (e.clientX - lx) * 0.005;
      this.pitchDelta += (e.clientY - ly) * 0.004;
      lx = e.clientX; ly = e.clientY;
    });
    addEventListener('pointerup', () => { dragging = false; });
  }
  get state() {
    const k = this.keys, t = this.touch;
    return {
      forward: !!(k.KeyW || k.ArrowUp || t.forward),
      back: !!(k.KeyS || k.ArrowDown || t.back),
      left: !!(k.KeyA || k.ArrowLeft || t.left),
      right: !!(k.KeyD || k.ArrowRight || t.right),
      sprint: !!(k.ShiftLeft || k.ShiftRight),
    };
  }
  consumeCamera() {
    const d = { yaw: this.yawDelta, pitch: this.pitchDelta };
    this.yawDelta = 0; this.pitchDelta = 0;
    return d;
  }
}
