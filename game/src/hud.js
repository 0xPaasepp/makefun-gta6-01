// SOLMAR HUD — health/armor, money, wanted stars, clock, speed,
// circular live minimap with mission blips, dialogue box, map overlay.
export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      health: document.getElementById('hud-health'),
      armor: document.getElementById('hud-armor'),
      money: document.getElementById('hud-money'),
      stars: document.getElementById('hud-stars'),
      clock: document.getElementById('hud-clock'),
      speed: document.getElementById('hud-speed'),
      mission: document.getElementById('hud-mission'),
      dialog: document.getElementById('dialogue'),
      dialogPortrait: document.getElementById('dialogue-portrait'),
      dialogWho: document.getElementById('dialogue-who'),
      dialogText: document.getElementById('dialogue-text'),
      flash: document.getElementById('hud-flash'),
      map: document.getElementById('map-overlay'),
      minimap: document.getElementById('minimap'),
    };
    this.dialogT = 0;
    this.flashT = 0;
    this.mm = this.el.minimap.getContext('2d');
    this.mapOpen = false;
  }
  setMissionText(t) { this.el.mission.textContent = t; }
  // Illustrated SVG portraits, same style as the title-screen cast.
  static PORTRAITS = {
    DARIO: '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#2a4a6a"/><circle cx="50" cy="38" r="18" fill="#e8b98a"/><path d="M32 30 Q50 12 68 30 L68 22 Q50 6 32 22Z" fill="#1a1a1a"/><rect x="34" y="36" width="8" height="3" fill="#1a1a1a"/><rect x="58" y="36" width="8" height="3" fill="#1a1a1a"/><path d="M42 52 Q50 56 58 52" stroke="#7a3b1e" stroke-width="2.5" fill="none"/><path d="M28 100 L32 62 Q50 54 68 62 L72 100Z" fill="#ffffff"/></svg>',
    MARA: '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#6a2a4a"/><circle cx="50" cy="38" r="18" fill="#f0c8a0"/><path d="M30 40 Q28 12 50 10 Q72 12 70 40 Q70 26 60 20 Q50 16 40 20 Q30 26 30 40Z" fill="#4a2c14"/><circle cx="43" cy="38" r="2.4" fill="#1a1a1a"/><circle cx="57" cy="38" r="2.4" fill="#1a1a1a"/><path d="M44 52 Q50 56 56 52" stroke="#a03040" stroke-width="2.5" fill="none"/><path d="M28 100 L32 62 Q50 54 68 62 L72 100Z" fill="#c0392b"/><circle cx="50" cy="74" r="3" fill="#ffd23d"/></svg>',
    KITO: '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#2a5a3a"/><circle cx="50" cy="38" r="18" fill="#c98d5f"/><path d="M32 34 Q50 16 68 34 L66 24 Q50 10 34 24Z" fill="#111111"/><rect x="32" y="26" width="36" height="5" fill="#222"/><circle cx="43" cy="38" r="2.4" fill="#1a1a1a"/><circle cx="57" cy="38" r="2.4" fill="#1a1a1a"/><path d="M40 52 Q50 58 60 52" stroke="#5a2a10" stroke-width="2.5" fill="none"/><path d="M28 100 L32 62 Q50 54 68 62 L72 100Z" fill="#16a085"/><rect x="46" y="66" width="8" height="12" fill="#f1c40f"/></svg>',
    'SOLMAR PD': '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#1a2a4a"/><circle cx="50" cy="40" r="18" fill="#e8b98a"/><path d="M30 36 Q50 14 70 36 L70 28 Q50 12 30 28Z" fill="#16233f"/><rect x="30" y="28" width="40" height="6" fill="#0d1526"/><circle cx="50" cy="22" r="4" fill="#ffd23d"/><circle cx="43" cy="40" r="2.4" fill="#1a1a1a"/><circle cx="57" cy="40" r="2.4" fill="#1a1a1a"/><path d="M42 54 Q50 57 58 54" stroke="#7a3b1e" stroke-width="2.5" fill="none"/><path d="M28 100 L32 64 Q50 56 68 64 L72 100Z" fill="#1a2a4a"/><rect x="46" y="68" width="8" height="10" fill="#ffd23d"/></svg>',
    SOLMAR: '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#e85d3d"/><circle cx="50" cy="50" r="30" fill="#ffd23d"/><circle cx="50" cy="50" r="22" fill="#ff9a3d"/><path d="M50 14 L50 24 M50 76 L50 86 M14 50 L24 50 M76 50 L86 50" stroke="#ffd23d" stroke-width="5"/></svg>',
  };
  showDialogue(who, text, dur = 6) {
    this.el.dialogWho.textContent = who;
    this.el.dialogText.textContent = text;
    if (this.el.dialogPortrait) {
      const key = String(who).toUpperCase();
      this.el.dialogPortrait.innerHTML = HUD.PORTRAITS[key] || HUD.PORTRAITS.SOLMAR;
    }
    this.el.dialog.style.display = 'flex';
    this.dialogT = dur;
  }
  flash(text) {
    this.el.flash.textContent = text;
    this.el.flash.style.display = 'block';
    this.flashT = 1.6;
  }
  toggleMap() {
    this.mapOpen = !this.mapOpen;
    this.el.map.style.display = this.mapOpen ? 'block' : 'none';
    if (this.mapOpen) this.drawCityMap();
  }
  drawCityMap() {
    const c = document.getElementById('citymap');
    const g = c.getContext('2d');
    const S = 460, k = S / 480;
    g.fillStyle = '#0d2b3d'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#3f7d5a'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#c9a86a';
    g.fillRect((208 + 240) * k, 0, (240 - 208) * k + 40, S); // beach
    g.fillStyle = '#14607e'; g.fillRect((208 + 240) * k + 30, 0, 60, S); // sea
    g.strokeStyle = '#2e3138'; g.lineWidth = 9;
    for (const v of [-150, -100, -50, 0, 50, 100, 150]) {
      g.beginPath(); g.moveTo((v + 240) * k, 0); g.lineTo((v + 240) * k, S); g.stroke();
      g.beginPath(); g.moveTo(0, (v + 240) * k); g.lineTo(S, (v + 240) * k); g.stroke();
    }
    g.fillStyle = '#d9c9a0'; g.beginPath(); g.arc(240 * k, 240 * k, 24, 0, 7); g.fill();
    g.fillStyle = '#d35400'; g.font = 'bold 15px sans-serif';
    g.fillText('SOLMAR', 12, 24);
    g.fillStyle = '#f1c40f';
    const m = this.game.missions;
    if (m.index < 3) {
      const b = [{ x: -50, z: 60 }, { x: 180, z: 60 }, { x: 190, z: -80 }][m.index];
      g.beginPath(); g.arc((b.x + 240) * k, (b.z + 240) * k, 8, 0, 7); g.fill();
    }
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc((this.game.px + 240) * k, (this.game.pz + 240) * k, 6, 0, 7); g.fill();
  }
  update(dt) {
    const g = this.game;
    this.el.health.style.width = Math.max(0, g.health) + '%';
    this.el.armor.style.width = Math.max(0, g.armor) + '%';
    this.el.money.textContent = '$' + g.money.toLocaleString('en-US');
    this.el.stars.textContent = '★'.repeat(g.wanted) + '☆'.repeat(5 - g.wanted);
    const h = Math.floor(g.timeOfDay / 60) % 24;
    const m = Math.floor(g.timeOfDay % 60);
    this.el.clock.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    const sp = g.currentCar ? Math.abs(g.currentCar.speed) * 3.6 : 0;
    this.el.speed.textContent = g.currentCar ? Math.round(sp) + ' km/h' : '';
    if (this.dialogT > 0) {
      this.dialogT -= dt;
      if (this.dialogT <= 0) this.el.dialog.style.display = 'none';
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.el.flash.style.display = 'none';
    }
    this.drawMinimap();
  }
  drawMinimap() {
    const g = this.game, ctx = this.mm, S = 150, R = S / 2;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, 7); ctx.clip();
    ctx.fillStyle = 'rgba(20,40,30,0.85)'; ctx.fillRect(0, 0, S, S);
    const k = S / 220; // show ~110u around player
    const px = (x) => R + (x - g.px) * k;
    const pz = (z) => R + (z - g.pz) * k;
    // sea
    ctx.fillStyle = '#14607e';
    ctx.fillRect(px(208), 0, S, S);
    // roads
    ctx.strokeStyle = '#555'; ctx.lineWidth = 4;
    for (const v of [-150, -100, -50, 0, 50, 100, 150]) {
      ctx.beginPath(); ctx.moveTo(px(v), 0); ctx.lineTo(px(v), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pz(v)); ctx.lineTo(S, pz(v)); ctx.stroke();
    }
    // plaza
    ctx.fillStyle = '#d9c9a0';
    ctx.beginPath(); ctx.arc(px(0), pz(0), 10, 0, 7); ctx.fill();
    // mission blip
    const mis = g.missions;
    if (mis.index < 3) {
      const b = [{ x: -50, z: 60 }, { x: 180, z: 60 }, { x: 190, z: -80 }][mis.index];
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(px(b.x), pz(b.z), 6, 0, 7); ctx.fill();
    }
    // traffic + cops
    ctx.fillStyle = '#ff8844';
    for (const t of g.traffic) { ctx.fillRect(px(t.x) - 2, pz(t.z) - 2, 4, 4); }
    ctx.fillStyle = '#4488ff';
    for (const c of g.police.cruisers) { ctx.fillRect(px(c.x) - 2, pz(c.z) - 2, 4, 4); }
    // player arrow
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.translate(R, R); ctx.rotate(-g.heading);
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, 7); ctx.stroke();
  }
}
