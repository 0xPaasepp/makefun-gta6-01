// Keyboard input. `pressed` is edge-triggered and cleared by endFrame(),
// which the game loop calls EVERY frame in EVERY state (menu, playing,
// paused, busted, wasted) so a key can never stick across a state change.
export class Input {
  constructor() {
    this.held = Object.create(null);
    this.pressed = Object.create(null);
    this.onKeyDown = (e) => {
      if (e.repeat) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.held[k] = true;
      this.pressed[k] = true;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    };
    this.onKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.held[k] = false;
    };
    this.onMouseDown = (e) => {
      if (e.button === 0) {
        this.held.mouse = true;
        this.pressed.mouse = true;
      }
    };
    this.onMouseUp = (e) => {
      if (e.button === 0) this.held.mouse = false;
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  isDown(...keys) {
    return keys.some((k) => !!this.held[k]);
  }

  wasPressed(...keys) {
    return keys.some((k) => !!this.pressed[k]);
  }

  // Movement vector in camera space: x = strafe, y = forward.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.isDown('w', 'ArrowUp')) y += 1;
    if (this.isDown('s', 'ArrowDown')) y -= 1;
    if (this.isDown('a', 'ArrowLeft')) x -= 1;
    if (this.isDown('d', 'ArrowRight')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 0) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  endFrame() {
    this.pressed = Object.create(null);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
}
