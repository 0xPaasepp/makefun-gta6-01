// HUD: money / health / armor / wanted stars / clock / mission text /
// prompts / dialogue, plus a live circular minimap (canvas 2D) with the
// mission blip, police dots and traffic dots.
export class Hud {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.money = this.el('hud-money');
    this.speed = this.el('hud-speed');
    this.healthBar = this.el('hud-health-bar');
    this.healthText = this.el('hud-health-text');
    this.armorBar = this.el('hud-armor-bar');
    this.stars = this.el('hud-stars');
    this.clock = this.el('hud-clock');
    this.missionTitle = this.el('hud-mission-title');
    this.missionText = this.el('hud-mission-text');
    this.prompt = this.el('hud-prompt');
    this.dialogue = this.el('hud-dialogue');
    this.dialogueText = this.el('hud-dialogue-text');
    this.minimap = this.el('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.dialogueTimer = 0;
  }

  showScreen(name) {
    for (const id of ['screen-start', 'screen-pause', 'screen-busted', 'screen-wasted']) {
      const e = this.el(id);
      if (e) e.classList.toggle('hidden', id !== `screen-${name}`);
    }
    const hud = this.el('hud');
    if (hud) hud.classList.toggle('hidden', name === 'start');
  }

  setDialogue(text, seconds = 4) {
    if (!text) {
      this.dialogue.classList.add('hidden');
      return;
    }
    this.dialogueText.textContent = text;
    this.dialogue.classList.remove('hidden');
    this.dialogueTimer = seconds;
  }

  formatMoney(n) {
    return `$${Math.floor(n).toLocaleString('en-US')}`;
  }

  formatClock(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  update(s, dt) {
    this.money.textContent = this.formatMoney(s.money);
    this.speed.textContent = s.inCar ? `${Math.round(s.speedKmh)} km/h` : '';
    this.healthBar.style.width = `${Math.max(0, s.health)}%`;
    this.healthText.textContent = `${Math.ceil(Math.max(0, s.health))}`;
    this.armorBar.style.width = `${Math.max(0, s.armor)}%`;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '☆';
    this.stars.textContent = stars;
    this.stars.classList.toggle('hot', s.wanted > 0);
    this.clock.textContent = this.formatClock(s.gameMinutes);
    this.missionTitle.textContent = s.missionTitle;
    this.missionText.textContent = s.missionText;
    if (s.prompt) {
      this.prompt.textContent = s.prompt;
      this.prompt.classList.remove('hidden');
    } else {
      this.prompt.classList.add('hidden');
    }
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.dialogue.classList.add('hidden');
    }
    this.drawMinimap(s);
  }

  drawMinimap(s) {
    const ctx = this.mapCtx;
    const W = this.minimap.width;
    const H = this.minimap.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = W / 2;
    const scale = R / 210;
    const toMap = (x, z) => [cx + x * scale, cy + z * scale];
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R - 1, 0, Math.PI * 2);
    ctx.clip();
    // Sea east.
    ctx.fillStyle = '#155a80';
    ctx.fillRect(cx + 200 * scale, 0, W, H);
    // Land.
    ctx.fillStyle = '#20262e';
    ctx.fillRect(0, 0, W, H);
    // Roads.
    ctx.strokeStyle = '#5a636e';
    ctx.lineWidth = 2;
    for (const c of [-150, -100, -50, 0, 50, 100, 150]) {
      const [x1] = toMap(c, 0);
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, H);
      ctx.stroke();
      const [, y1] = toMap(0, c);
      ctx.beginPath();
      ctx.moveTo(0, y1);
      ctx.lineTo(W, y1);
      ctx.stroke();
    }
    // Plaza.
    ctx.fillStyle = '#8a7a58';
    const [px, pz] = toMap(0, 0);
    ctx.beginPath();
    ctx.arc(px, pz, 6, 0, Math.PI * 2);
    ctx.fill();
    // Mission blip (pulsing yellow).
    if (s.missionMarker) {
      const [mx, mz] = toMap(s.missionMarker.x, s.missionMarker.z);
      const pulse = 4 + Math.sin(s.now * 5) * 2;
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.arc(mx, mz, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Guards (red), police (blue), traffic (grey).
    for (const g of s.guards || []) {
      if (g.hp <= 0) continue;
      const [gx, gz] = toMap(g.x, g.z);
      ctx.fillStyle = '#ff4a4a';
      ctx.fillRect(gx - 2, gz - 2, 4, 4);
    }
    for (const c of s.cops || []) {
      const [gx, gz] = toMap(c.x, c.z);
      ctx.fillStyle = '#4a8aff';
      ctx.fillRect(gx - 2, gz - 2, 4, 4);
    }
    for (const c of s.cruisers || []) {
      const [gx, gz] = toMap(c.x, c.z);
      ctx.fillStyle = '#7ab8ff';
      ctx.beginPath();
      ctx.arc(gx, gz, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const c of s.traffic || []) {
      const [gx, gz] = toMap(c.x, c.z);
      ctx.fillStyle = '#9aa4ae';
      ctx.fillRect(gx - 1, gz - 1, 2, 2);
    }
    // Player arrow (white, rotated by heading).
    const [ux, uz] = toMap(s.player.x, s.player.z);
    ctx.save();
    ctx.translate(ux, uz);
    // Map +x is right, +z is down; the arrow points up, so rotate PI - h.
    ctx.rotate(Math.PI - s.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // Ring.
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 1, 0, Math.PI * 2);
    ctx.stroke();
  }
}
