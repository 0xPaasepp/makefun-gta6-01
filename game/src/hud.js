// DOM HUD: health/armor/money, wanted stars, clock, speed, objective,
// live circular minimap (roads, blocks, sea, blips — never an empty grid),
// dialogue box with SVG portraits, and toasts.
//
// Rebuild 12: weapon wheel (4 slots, locked states), police dispatch
// panel (named units + live states), respect bar + rank, Sun Shell
// counter, paint-shop menu, street name under the minimap, and district
// labels drawn on the minimap itself.
// Rebuild 13: the full-city map screen (M) with districts, legend, a gold
// route line to the objective and a stats panel; an incoming-call style
// for the opening phone dialogue; live evade % in the dispatch panel;
// the radio line now names the track playing.
import { CONFIG, MISSION_TEXT, DISTRICTS } from './config.js';
import { dist } from './rng.js';

export const PORTRAITS = {
  MARA: '<svg viewBox="0 0 64 64" width="52" height="52"><rect width="64" height="64" rx="10" fill="#5a1a1a"/><circle cx="32" cy="26" r="14" fill="#f0c8a0"/><path d="M18 24 Q32 6 46 24 L46 14 Q32 2 18 14 Z" fill="#3a1a10"/><rect x="20" y="44" width="24" height="18" rx="6" fill="#c23b3b"/></svg>',
  KITO: '<svg viewBox="0 0 64 64" width="52" height="52"><rect width="64" height="64" rx="10" fill="#0f3a34"/><circle cx="32" cy="26" r="14" fill="#8a5a34"/><rect x="18" y="10" width="28" height="9" rx="4" fill="#ffd23f"/><rect x="20" y="44" width="24" height="18" rx="6" fill="#2a9a8a"/></svg>',
  DARIO: '<svg viewBox="0 0 64 64" width="52" height="52"><rect width="64" height="64" rx="10" fill="#27435e"/><circle cx="32" cy="26" r="14" fill="#e8b98a"/><path d="M18 20 Q32 8 46 20 L46 14 Q32 4 18 14 Z" fill="#1a1210"/><rect x="20" y="44" width="24" height="18" rx="6" fill="#ffffff"/><rect x="20" y="44" width="24" height="4" fill="#d8d8d8"/></svg>',
  FARE: '<svg viewBox="0 0 64 64" width="52" height="52"><rect width="64" height="64" rx="10" fill="#4a3a1a"/><circle cx="32" cy="26" r="14" fill="#f0c8a0"/><rect x="18" y="12" width="28" height="8" rx="4" fill="#2a2a2a"/><rect x="20" y="44" width="24" height="18" rx="6" fill="#3b7ac2"/></svg>',
  MARSHAL: '<svg viewBox="0 0 64 64" width="52" height="52"><rect width="64" height="64" rx="10" fill="#222"/><circle cx="32" cy="26" r="14" fill="#c98a5a"/><rect x="18" y="12" width="28" height="8" rx="4" fill="#ff5a2a"/><rect x="20" y="44" width="24" height="18" rx="6" fill="#e8e8e8"/></svg>',
  FIXER: '<svg viewBox="0 0 64 64" width="52" height="52"><rect width="64" height="64" rx="10" fill="#1a2a1a"/><circle cx="32" cy="26" r="14" fill="#8a5a34"/><rect x="20" y="44" width="24" height="18" rx="6" fill="#3b9a5a"/></svg>',
  DOCKHAND: '<svg viewBox="0 0 64 64" width="52" height="52"><rect width="64" height="64" rx="10" fill="#3a2a1a"/><circle cx="32" cy="26" r="14" fill="#e8b98a"/><rect x="18" y="12" width="28" height="8" rx="4" fill="#ffd23f"/><rect x="20" y="44" width="24" height="18" rx="6" fill="#b07a3a"/></svg>',
  MARINA: '<svg viewBox="0 0 64 64" width="52" height="52"><rect width="64" height="64" rx="10" fill="#123a4a"/><circle cx="32" cy="26" r="14" fill="#f0c8a0"/><rect x="20" y="44" width="24" height="18" rx="6" fill="#4a7a8d"/></svg>',
  MAREA: '<svg viewBox="0 0 64 64" width="52" height="52"><rect width="64" height="64" rx="10" fill="#3a1a3a"/><circle cx="32" cy="26" r="14" fill="#f0c8a0"/><rect x="18" y="10" width="28" height="8" rx="4" fill="#111111"/><rect x="20" y="44" width="24" height="18" rx="6" fill="#ff5a8a"/></svg>',
  VELA: '<svg viewBox="0 0 64 64" width="52" height="52"><rect width="64" height="64" rx="10" fill="#2a1a4a"/><circle cx="32" cy="26" r="14" fill="#c98a5a"/><rect x="18" y="12" width="28" height="8" rx="4" fill="#111111"/><rect x="20" y="44" width="24" height="18" rx="6" fill="#7a4a9a"/></svg>',
};

const WHEEL_SLOTS = ['pistol', 'smg', 'shotgun', 'rifle'];

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['hud-health', 'hud-armor', 'hud-money', 'hud-stars', 'hud-clock',
      'hud-speed', 'hud-weapon', 'hud-radio', 'objective', 'dialogue', 'dialogue-portrait',
      'dialogue-name', 'dialogue-name-text', 'dialogue-text', 'dialogue-phone', 'minimap', 'toast', 'hud-zone', 'hud-street',
      'hud-respect', 'hud-respect-bar', 'hud-shells', 'hud-paint', 'dispatch',
      'dispatch-status', 'dispatch-units', 'weapon-wheel', 'hud-phase',
      'map-screen', 'map-canvas', 'map-stats', 'busted-screen', 'busted-title', 'busted-sub']) {
      this.el[id] = document.getElementById(id);
    }
    this._dialogueT = null;
    this._toastT = null;
    this._wheelT = null;
    this._bustedT = null;
  }
  showDialogue(who, text, ms = 5200) {
    const d = this.el.dialogue;
    this.el['dialogue-portrait'].innerHTML = PORTRAITS[who] || PORTRAITS.DARIO;
    // The name is its own span (dialogue-name-text) — writing textContent
    // on the whole name div would destroy the phone-call tag beside it.
    if (this.el['dialogue-name-text']) this.el['dialogue-name-text'].textContent = who;
    else this.el['dialogue-name'].textContent = who;
    if (this.el['dialogue-phone']) this.el['dialogue-phone'].style.display = 'none';
    d.style.borderColor = 'rgba(255,210,63,.7)';
    this.el['dialogue-text'].textContent = text;
    d.style.display = 'flex';
    if (this._dialogueT) clearTimeout(this._dialogueT);
    this._dialogueT = setTimeout(() => { d.style.display = 'none'; }, ms);
  }
  // Rebuild 13: the opening phone call — same dialogue box, styled as an
  // incoming call (green border + "INCOMING CALL" tag), so the story
  // opens on a ringing phone, not a caption.
  showPhoneCall(who, text, ms = 8000) {
    this.showDialogue(who, text, ms);
    this.el.dialogue.style.borderColor = '#2aff8a';
    if (this.el['dialogue-phone']) {
      this.el['dialogue-phone'].style.display = 'inline-block';
      this.el['dialogue-phone'].textContent = '📞 INCOMING CALL';
    }
    if (this.el['dialogue-name-text']) this.el['dialogue-name-text'].textContent = who + ' — PHONE';
    else this.el['dialogue-name'].textContent = who + ' — PHONE';
  }
  // Rebuild 13: explicit BUSTED / WASTED screen — never a silent respawn.
  showBusted(kind, sub, ms = 3500) {
    const s = this.el['busted-screen'];
    if (!s) return;
    this.el['busted-title'].textContent = kind;
    this.el['busted-sub'].textContent = sub;
    s.style.display = 'flex';
    if (this._bustedT) clearTimeout(this._bustedT);
    this._bustedT = setTimeout(() => { s.style.display = 'none'; }, ms);
  }
  hideBusted() { if (this.el['busted-screen']) this.el['busted-screen'].style.display = 'none'; }
  hideDialogue() { this.el.dialogue.style.display = 'none'; }
  toast(text, ms = 2600) {
    const t = this.el.toast;
    t.textContent = text;
    t.style.display = 'block';
    if (this._toastT) clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.style.display = 'none'; }, ms);
  }
  // Weapon wheel: 4 slots, current highlighted, locked ones dimmed.
  showWheel(current, owned) {
    const w = this.el['weapon-wheel'];
    if (!w) return;
    w.innerHTML = WHEEL_SLOTS.map((key, i) => {
      const cfg = CONFIG.weapons[key];
      const ok = !!owned[key];
      const cur = key === current;
      return `<div class="wheel-slot${cur ? ' current' : ''}${ok ? '' : ' locked'}"><span class="wheel-key">${i + 1}</span>${cfg.name}${ok ? '' : ' (locked)'}</div>`;
    }).join('');
    w.style.display = 'flex';
    if (this._wheelT) clearTimeout(this._wheelT);
    this._wheelT = setTimeout(() => { w.style.display = 'none'; }, 1800);
  }
  // Dispatch panel: overall status + one row per live unit.
  // Rebuild 13: shows the live evade % while the player is hidden.
  updateDispatch(disp) {
    const panel = this.el.dispatch;
    if (!panel) return;
    if (!disp || disp.wanted <= 0) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    const evade = disp.evadePct > 0 && disp.status !== 'IN SIGHT'
      ? ` · HIDDEN — evading ${disp.evadePct}%` : '';
    this.el['dispatch-status'].textContent = `SOLMAR PD — ${disp.status}${evade}`;
    this.el['dispatch-units'].innerHTML = disp.units.map((u) =>
      `<div class="dispatch-row"><span class="dispatch-name">${u.name}</span><span class="dispatch-dist">${u.dist}m</span><span class="dispatch-state ${u.state === 'IN SIGHT' ? 'hot' : ''}">${u.state}</span></div>`).join('');
  }
  // Paint shop menu: shows while parked in Mara's garage in a car.
  showPaint(paintName, cost, money) {
    const p = this.el['hud-paint'];
    if (!p) return;
    p.innerHTML = `PAINT SHOP — press C: <b>${paintName}</b> · $${cost} · you have $${Math.floor(money)}`;
    p.style.display = 'block';
  }
  hidePaint() { if (this.el['hud-paint']) this.el['hud-paint'].style.display = 'none'; }
  update(s) {
    // s: {health, armor, money, wanted, hour, minute, speedKmh, mission,
    //     weapon, radio, radioDj, inCar, zone, street, respect, respectRank,
    //     shells, shellsTotal, phase, paintName}
    this.el['hud-health'].style.width = Math.max(0, s.health) + '%';
    this.el['hud-armor'].style.width = Math.max(0, s.armor) + '%';
    this.el['hud-money'].textContent = '$' + Math.floor(s.money).toLocaleString('en-US');
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '☆';
    this.el['hud-stars'].textContent = stars;
    this.el['hud-stars'].style.color = s.wanted > 0 ? '#ffd23f' : 'rgba(255,255,255,0.55)';
    const hh = String(Math.floor(s.hour) % 24).padStart(2, '0');
    const mm = String(Math.floor(s.minute) % 60).padStart(2, '0');
    this.el['hud-clock'].textContent = `${hh}:${mm}`;
    this.el['hud-speed'].textContent = s.inCar ? `${Math.round(s.speedKmh)} km/h` : '0 km/h';
    this.el['hud-weapon'].textContent = s.weapon + (s.paintName ? ` · ${s.paintName}` : '');
    this.el['hud-radio'].textContent = '♪ ' + s.radio + (s.radioDj ? ' — ' + s.radioDj : '') + (s.radioTrack ? ' · ' + s.radioTrack : '');
    this.el.objective.textContent = MISSION_TEXT[Math.min(s.mission, MISSION_TEXT.length - 1)];
    this.el['hud-zone'].textContent = s.zone || '';
    if (this.el['hud-street']) this.el['hud-street'].textContent = s.street || '';
    if (this.el['hud-phase']) this.el['hud-phase'].textContent = s.phase || 'GOLDEN HOUR';
    if (this.el['hud-respect']) this.el['hud-respect'].textContent = `RESPECT ${s.respectRank || 'NOBODY'} · ${Math.floor(s.respect || 0)}`;
    if (this.el['hud-respect-bar']) {
      const per = CONFIG.respectPerRank || 40;
      this.el['hud-respect-bar'].style.width = Math.min(100, ((s.respect || 0) % per) / per * 100) + '%';
    }
    if (this.el['hud-shells']) this.el['hud-shells'].textContent = `☀ SHELLS ${s.shells || 0}/${s.shellsTotal || 10}`;
  }
  drawMinimap(px, pz, heading, objective, cops, cars, guards, packages, shells) {
    const cv = this.el.minimap;
    if (!cv) return;
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const mx = (x) => ((x + 230) / 460) * W;
    const mz = (z) => ((z + 170) / 340) * H;
    g.clearRect(0, 0, W, H);
    // Base + sea.
    g.fillStyle = '#20262e'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1e6f9e'; g.fillRect(mx(205), 0, W - mx(205), H);
    // City blocks (dark) then roads (light lines) so the grid always reads.
    g.fillStyle = '#3a3f47';
    const xs = [-205, ...CONFIG.roadsX, 205];
    const zs = [-165, ...CONFIG.roadsZ, 165];
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < zs.length - 1; j++) {
        g.fillRect(mx(xs[i] + 5.5), mz(zs[j] + 5.5), mx(xs[i + 1] - 5.5) - mx(xs[i] + 5.5), mz(zs[j + 1] - 5.5) - mz(zs[j] + 5.5));
      }
    }
    g.strokeStyle = '#7a7f88'; g.lineWidth = 2;
    for (const x of CONFIG.roadsX) { g.beginPath(); g.moveTo(mx(x), 0); g.lineTo(mx(x), H); g.stroke(); }
    for (const z of CONFIG.roadsZ) { g.beginPath(); g.moveTo(0, mz(z)); g.lineTo(W, mz(z)); g.stroke(); }
    // District labels, tiny but legible.
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.font = 'bold 7px Arial, sans-serif';
    g.textAlign = 'center';
    for (const d of DISTRICTS) g.fillText(d.name, mx(d.x), mz(d.z));
    // Plaza + fountain.
    g.fillStyle = '#cfc4a8';
    g.beginPath(); g.arc(mx(0), mz(0), 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4fb3e8';
    g.beginPath(); g.arc(mx(0), mz(0), 2.5, 0, Math.PI * 2); g.fill();
    // Sun Shells (gold dots).
    g.fillStyle = '#ffd23f';
    for (const sh of shells || []) {
      if (!sh.got) { g.beginPath(); g.arc(mx(sh.x), mz(sh.z), 2, 0, Math.PI * 2); g.fill(); }
    }
    // Packages.
    g.fillStyle = '#2aff8a';
    for (const p of packages) { if (!p.got) { g.fillRect(mx(p.x) - 1.5, mz(p.z) - 1.5, 3, 3); } }
    // Guards.
    g.fillStyle = '#ff5a3c';
    for (const gd of guards) { if (gd.alive) { g.beginPath(); g.arc(mx(gd.x), mz(gd.z), 2.5, 0, Math.PI * 2); g.fill(); } }
    // Traffic.
    g.fillStyle = '#c8c8c8';
    for (const c of cars) { g.fillRect(mx(c.x) - 1, mz(c.z) - 1, 2, 2); }
    // Cops.
    g.fillStyle = '#ff2222';
    for (const c of cops) { g.beginPath(); g.arc(mx(c.x), mz(c.z), 2.5, 0, Math.PI * 2); g.fill(); }
    // Objective blip (pulsing yellow).
    if (objective) {
      const pulse = 3.5 + Math.sin(performance.now() / 300) * 1.5;
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.arc(mx(objective.x), mz(objective.z), pulse, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#111'; g.lineWidth = 1; g.stroke();
    }
    // Player arrow.
    g.save();
    g.translate(mx(px), mz(pz));
    g.rotate(-heading);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 1; g.stroke();
    g.restore();
  }
  // ---- Rebuild 13: full-city map screen (M / Tab) ----
  // Big canvas: the same city grid as the minimap, at readable scale,
  // with district names, a gold route line from the player to the
  // objective (routed along the road grid), and every live blip.
  showMap() { if (this.el['map-screen']) this.el['map-screen'].style.display = 'flex'; }
  hideMap() { if (this.el['map-screen']) this.el['map-screen'].style.display = 'none'; }
  updateMapStats(s) {
    // s: {money, mission, shells, shellsTotal, respect, respectRank, stats}
    const el = this.el['map-stats'];
    if (!el) return;
    const st = s.stats || { escapes: 0, takedowns: 0, racesWon: 0 };
    el.innerHTML = `
      <div class="map-stat"><span>CASH</span><b>$${Math.floor(s.money).toLocaleString('en-US')}</b></div>
      <div class="map-stat"><span>STORY</span><b>${Math.min(s.mission, 8)} / 8</b></div>
      <div class="map-stat"><span>SUN SHELLS</span><b>${s.shells || 0} / ${s.shellsTotal || 10}</b></div>
      <div class="map-stat"><span>RESPECT</span><b>${s.respectRank || 'NOBODY'} · ${Math.floor(s.respect || 0)}</b></div>
      <div class="map-stat"><span>ESCAPES</span><b>${st.escapes || 0}</b></div>
      <div class="map-stat"><span>TAKEDOWNS</span><b>${st.takedowns || 0}</b></div>
      <div class="map-stat"><span>RACES WON</span><b>${st.racesWon || 0}</b></div>`;
  }
  drawFullMap(px, pz, heading, objective, cops, cars, guards, packages, shells) {
    const cv = this.el['map-canvas'];
    if (!cv) return;
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const mx = (x) => ((x + 230) / 460) * W;
    const mz = (z) => ((z + 170) / 340) * H;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#20262e'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1e6f9e'; g.fillRect(mx(205), 0, W - mx(205), H);
    g.fillStyle = '#3a3f47';
    const xs = [-205, ...CONFIG.roadsX, 205];
    const zs = [-165, ...CONFIG.roadsZ, 165];
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < zs.length - 1; j++) {
        g.fillRect(mx(xs[i] + 5.5), mz(zs[j] + 5.5), mx(xs[i + 1] - 5.5) - mx(xs[i] + 5.5), mz(zs[j + 1] - 5.5) - mz(zs[j] + 5.5));
      }
    }
    g.strokeStyle = '#7a7f88'; g.lineWidth = 2;
    for (const x of CONFIG.roadsX) { g.beginPath(); g.moveTo(mx(x), 0); g.lineTo(mx(x), H); g.stroke(); }
    for (const z of CONFIG.roadsZ) { g.beginPath(); g.moveTo(0, mz(z)); g.lineTo(W, mz(z)); g.stroke(); }
    // Gold route: player -> nearest road -> along the grid -> objective.
    if (objective) {
      const nearRoad = (v, roads) => roads.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, roads[0]);
      const rx = nearRoad(px, CONFIG.roadsX);
      const rz = nearRoad(objective.z, CONFIG.roadsZ);
      g.strokeStyle = '#ffd23f'; g.lineWidth = 4; g.setLineDash([10, 7]);
      g.beginPath();
      g.moveTo(mx(px), mz(pz));
      g.lineTo(mx(rx), mz(pz));
      g.lineTo(mx(rx), mz(rz));
      g.lineTo(mx(objective.x), mz(objective.z));
      g.stroke();
      g.setLineDash([]);
      const legLen = Math.round(dist(px, pz, rx, pz) + dist(rx, pz, rx, rz) + dist(rx, rz, objective.x, objective.z));
      g.fillStyle = '#ffd23f'; g.font = 'bold 13px Arial, sans-serif'; g.textAlign = 'left';
      g.fillText(`${objective.label || 'Objective'} — ${legLen}m via ${CONFIG.roadsX.includes(rx) ? 'the grid' : 'the roads'}`, 12, H - 12);
    }
    // District labels, big enough to read at a glance.
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = 'bold 13px Arial, sans-serif';
    g.textAlign = 'center';
    for (const d of DISTRICTS) g.fillText(d.name, mx(d.x), mz(d.z));
    // Plaza + fountain.
    g.fillStyle = '#cfc4a8';
    g.beginPath(); g.arc(mx(0), mz(0), 12, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4fb3e8';
    g.beginPath(); g.arc(mx(0), mz(0), 4, 0, Math.PI * 2); g.fill();
    // Sun Shells.
    g.fillStyle = '#ffd23f';
    for (const sh of shells || []) {
      if (!sh.got) { g.beginPath(); g.arc(mx(sh.x), mz(sh.z), 4, 0, Math.PI * 2); g.fill(); }
    }
    // Packages.
    g.fillStyle = '#2aff8a';
    for (const p of packages) { if (!p.got) { g.fillRect(mx(p.x) - 3, mz(p.z) - 3, 6, 6); } }
    // Guards.
    g.fillStyle = '#ff5a3c';
    for (const gd of guards) { if (gd.alive) { g.beginPath(); g.arc(mx(gd.x), mz(gd.z), 5, 0, Math.PI * 2); g.fill(); } }
    // Traffic.
    g.fillStyle = '#c8c8c8';
    for (const c of cars) { g.fillRect(mx(c.x) - 2, mz(c.z) - 2, 4, 4); }
    // Cops.
    g.fillStyle = '#ff2222';
    for (const c of cops) { g.beginPath(); g.arc(mx(c.x), mz(c.z), 5, 0, Math.PI * 2); g.fill(); }
    // Objective blip (pulsing gold).
    if (objective) {
      const pulse = 8 + Math.sin(performance.now() / 300) * 3;
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.arc(mx(objective.x), mz(objective.z), pulse, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#111'; g.lineWidth = 2; g.stroke();
    }
    // Player arrow.
    g.save();
    g.translate(mx(px), mz(pz));
    g.rotate(-heading);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(-8, 9); g.closePath(); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 2; g.stroke();
    g.restore();
  }
}
