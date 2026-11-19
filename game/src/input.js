// Keyboard + mouse input. No pointer lock: the mouse aims by ray to the
// ground plane, and F / click both fire, so the game works in a plain tab.
// Rebuild 12: named action getters for the wheel (Q), horn (H), paint (C)
// and radio (R), so game.js reads intent, not raw key codes.
// Rebuild 13: M opens the full-city map (mute moves to N so M is free),
// Space is the handbrake while driving.
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseX = 0; this.mouseY = 0;
    this.mouseDown = false;
    this.pressed = new Set(); // edge-triggered, consumed by game each tick
    this.onFirstGesture = null;
    this._gestured = false;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this._gesture();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('mousemove', (e) => { this.mouseX = e.clientX; this.mouseY = e.clientY; });
    // Clicks on menus/buttons are UI, not shots: only a mousedown on the
    // game canvas itself records Mouse0. (A NEW GAME click used to leak
    // into the first frame as a pistol shot — instant wanted at spawn.)
    window.addEventListener('mousedown', (e) => { if (e.button === 0 && e.target && e.target.id === 'game-canvas') { this.mouseDown = true; this.pressed.add('Mouse0'); } this._gesture(); });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  _gesture() {
    if (!this._gestured) { this._gestured = true; if (this.onFirstGesture) this.onFirstGesture(); }
  }
  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  consume(code) { this.pressed.delete(code); }
  // Edge-triggered tap: true once, then consumed — for wheel/horn/paint.
  tap(code) { if (this.pressed.has(code)) { this.pressed.delete(code); return true; } return false; }
  endTick() { this.pressed.clear(); }
  get forward() { return this.down('KeyW') || this.down('ArrowUp'); }
  get back() { return this.down('KeyS') || this.down('ArrowDown'); }
  get left() { return this.down('KeyA') || this.down('ArrowLeft'); }
  get right() { return this.down('KeyD') || this.down('ArrowRight'); }
  get run() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
  // Rebuild 12 actions.
  get wheelNext() { return this.tap('KeyQ'); }      // cycle weapon / show wheel
  get wheelPrev() { return this.tap('KeyZ'); }      // cycle weapon backwards
  get horn() { return this.tap('KeyH'); }           // car horn
  get paint() { return this.tap('KeyC'); }          // repaint at Mara's garage
  get radio() { return this.tap('KeyR'); }          // next radio station
  get mute() { return this.tap('KeyN'); }           // mute toggle (rebuild 13: M is the map now)
  // Rebuild 13 actions.
  get map() { return this.tap('KeyM') || this.tap('Tab'); } // full-city map
  get handbrake() { return this.down('Space'); }    // handbrake while driving
}
