// hud.js — the DOM HUD (health, money, wanted stars, clock, objectives, toasts,
// dialogues) and the circular minimap drawn on a 2D canvas.

import { WORLD } from './config.js';

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'objectiveText', 'objectiveSub', 'missionTitle', 'clock', 'money',
      'wanted', 'healthFill', 'ammo', 'speed', 'speedo', 'carName', 'toastBig', 'toastSmall',
      'hint', 'crosshair', 'damage', 'dialog', 'dialogName', 'dialogText', 'interact',
      'minimap', 'startScreen', 'pauseScreen', 'bustedScreen', 'deadScreen', 'pauseStats',
      'btnContinue', 'continueInfo']) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = null;
    this.dialogTimer = null;
    this.hintTimer = null;
    this.gameMinutes = 9 * 60; // 09:00
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setObjective(title, text, sub) {
    this.el.missionTitle.textContent = title || 'Solmar City';
    this.el.objectiveText.textContent = text || '';
    this.el.objectiveSub.textContent = sub || '';
  }

  setHealth(h) {
    this.el.healthFill.style.width = Math.max(0, Math.min(100, h)) + '%';
    this.el.healthFill.style.background = h > 50
      ? 'linear-gradient(90deg,#37e05a,#a5ff6e)'
      : h > 25 ? 'linear-gradient(90deg,#e0a537,#ffd23f)' : 'linear-gradient(90deg,#e03737,#ff6e6e)';
  }

  setMoney(m) { this.el.money.textContent = '$ ' + Math.floor(m).toLocaleString('en-US'); }

  setWanted(stars) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < stars ? '★' : '☆';
    this.el.wanted.innerHTML = stars > 0 ? `<span class="lit">${s}</span>` : `<span style="opacity:.35">${s}</span>`;
  }

  setAmmo(ammo, reserve) {
    this.el.ammo.innerHTML = '🔫 ' + ammo + ' / ' + reserve;
  }

  setSpeed(kmh, carName) {
    if (carName) {
      this.el.speedo.classList.remove('hidden');
      this.el.speed.textContent = Math.round(kmh);
      this.el.carName.textContent = carName;
    } else {
      this.el.speedo.classList.add('hidden');
    }
  }

  setCrosshair(on) { this.el.crosshair.classList.toggle('hidden', !on); }

  flashDamage() {
    this.el.damage.style.opacity = '1';
    setTimeout(() => { this.el.damage.style.opacity = '0'; }, 130);
  }

  toast(big, small, ms) {
    this.el.toastBig.textContent = big || '';
    this.el.toastSmall.textContent = small || '';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.el.toastBig.textContent = '';
      this.el.toastSmall.textContent = '';
    }, ms || 2600);
  }

  hint(text, ms) {
    this.el.hint.textContent = text || '';
    clearTimeout(this.hintTimer);
    if (text) {
      this.hintTimer = setTimeout(() => { this.el.hint.textContent = ''; }, ms || 4000);
    }
  }

  dialog(name, text, ms) {
    this.el.dialogName.textContent = name || '';
    this.el.dialogText.textContent = text || '';
    this.el.dialog.classList.remove('hidden');
    clearTimeout(this.dialogTimer);
    this.dialogTimer = setTimeout(() => this.el.dialog.classList.add('hidden'), ms || 6000);
  }

  interact(text) {
    if (text) { this.el.interact.textContent = text; this.el.interact.classList.remove('hidden'); }
    else this.el.interact.classList.add('hidden');
  }

  tickClock(dt) {
    this.gameMinutes += dt * 2.2; // game clock runs ~2x real time
    const total = Math.floor(this.gameMinutes) % (24 * 60);
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    this.el.clock.textContent = hh + ':' + mm;
  }

  // --- Minimap ---------------------------------------------------------------
  drawMinimap(city, player, cars, policeCars, cops, guards, spot) {
    const ctx = this.mapCtx;
    const S = 190;
    const scale = S / (WORLD.size + 40);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    ctx.clearRect(0, 0, S, S);
    // sea + sand at the bottom
    ctx.fillStyle = '#1e7fb8';
    ctx.fillRect(0, S - 14, S, 14);
    ctx.fillStyle = '#e8d49a';
    ctx.fillRect(0, S - 18, S, 4);
    // blocks
    ctx.fillStyle = '#3a4a3a';
    for (const b of city.buildings) {
      const [x, y] = toMap(b.x - b.w / 2, b.z - b.d / 2);
      ctx.fillRect(x, y, Math.max(1.5, b.w * scale), Math.max(1.5, b.d * scale));
    }
    // roads
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 4;
    for (let c = -168; c <= 168; c += 42) {
      ctx.beginPath(); ctx.moveTo(...toMap(c, -210)); ctx.lineTo(...toMap(c, 210)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(...toMap(-210, c)); ctx.lineTo(...toMap(210, c)); ctx.stroke();
    }
    // mission marker
    if (spot) {
      const [x, y] = toMap(spot.x, spot.z);
      const pulse = 6 + Math.sin(performance.now() * 0.005) * 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, pulse + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // cash drops are drawn by the game via dots when close — skipped here.
    // traffic (grey), police (blue/red), guards (red)
    ctx.fillStyle = '#c8c8c8';
    for (const car of cars) {
      const [x, y] = toMap(car.mesh.position.x, car.mesh.position.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    for (const pc of policeCars) {
      const [x, y] = toMap(pc.mesh.position.x, pc.mesh.position.z);
      ctx.fillStyle = Math.floor(performance.now() / 300) % 2 ? '#ff3b30' : '#3b82ff';
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c8c8c8';
    }
    ctx.fillStyle = '#ff3b30';
    for (const g of guards) {
      const [x, y] = toMap(g.pos.x, g.pos.z);
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    // player arrow (rotates with heading)
    const [px, py] = toMap(player.x, player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.heading);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // view cone
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.heading);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.arc(0, 0, 42, -0.5, 0.5); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
