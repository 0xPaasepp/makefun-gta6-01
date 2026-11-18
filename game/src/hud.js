// SOLMAR · hud.js — HUD DOM, live circular minimap drawn from the REAL street
// network (roads, plaza, docks, marina, sea) + blips, and the M-key city map.
import { CFG, ROADS_V, ROADS_H, ROAD_W, SPURS } from './config.js';

const WORLD = 480; // world spans -240..240

function drawStreets(g, s, cx, cy) {
  // s = px per world unit, (cx,cy) = canvas centre for world (0,0)
  const X = (x) => cx + x * s, Z = (z) => cy + z * s;
  // ground
  g.fillStyle = '#20242a'; g.fillRect(0, 0, cx * 2, cy * 2);
  // sea east + marina basin
  g.fillStyle = '#175e6e';
  g.fillRect(X(CFG.seaX), 0, cx * 2 - X(CFG.seaX), cy * 2);
  g.fillRect(X(CFG.marina.x0), Z(CFG.marina.z0), (CFG.marina.x1 - CFG.marina.x0) * s, (CFG.marina.z1 - CFG.marina.z0) * s);
  // docks quay
  g.fillStyle = '#5a4f42';
  g.fillRect(X(CFG.docks.x0), Z(CFG.docks.z0), (CFG.docks.x1 - CFG.docks.x0) * s, (CFG.docks.z1 - CFG.docks.z0) * s);
  // blocks (faint)
  g.fillStyle = '#2e333b';
  for (const bx of [-125, -75, -25, 25, 75, 125]) {
    for (const bz of [-125, -75, -25, 25, 75, 125]) {
      if (Math.abs(bx) < 40 && Math.abs(bz) < 40) continue;
      g.fillRect(X(bx - 20), Z(bz - 20), 40 * s, 40 * s);
    }
  }
  // roads
  g.strokeStyle = '#8a8f98'; g.lineCap = 'round';
  for (const x of ROADS_V) {
    g.lineWidth = Math.max(2, ROAD_W * s);
    g.beginPath(); g.moveTo(X(x), Z(-170)); g.lineTo(X(x), Z(170)); g.stroke();
  }
  for (const z of ROADS_H) {
    g.lineWidth = Math.max(2, ROAD_W * s);
    g.beginPath(); g.moveTo(X(-170), Z(z)); g.lineTo(X(170), Z(z)); g.stroke();
  }
  for (const sp of SPURS) {
    g.lineWidth = Math.max(2, (sp.w || 8) * s);
    g.beginPath();
    if (sp.kind === 'v') { g.moveTo(X(sp.x), Z(sp.z0)); g.lineTo(X(sp.x), Z(sp.z1)); }
    else { g.moveTo(X(sp.x0), Z(sp.z)); g.lineTo(X(sp.x1), Z(sp.z)); }
    g.stroke();
  }
  // plaza
  g.fillStyle = '#c9a878';
  g.fillRect(X(-22), Z(-22), 44 * s, 44 * s);
  g.strokeStyle = '#7a5a38'; g.lineWidth = 1;
  g.strokeRect(X(-22), Z(-22), 44 * s, 44 * s);
  return { X, Z };
}

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      missionChapter: document.getElementById('mission-chapter'),
      missionText: document.getElementById('mission-text'),
      missionSub: document.getElementById('mission-sub'),
      missionProg: document.getElementById('mission-prog'),
      pd: document.getElementById('pd-panel'),
      money: document.getElementById('money'),
      stars: document.getElementById('stars'),
      clock: document.getElementById('clock'),
      radio: document.getElementById('radio'),
      health: document.getElementById('health-bar'),
      armor: document.getElementById('armor-bar'),
      weaponPistol: document.getElementById('weapon-pistol'),
      speed: document.getElementById('speed'),
      speedNum: document.getElementById('speed-num'),
      cond: document.getElementById('condition'),
      dialogue: document.getElementById('dialogue'),
      dlgName: document.getElementById('dlg-name'),
      dlgText: document.getElementById('dlg-text'),
      dlgAvatar: document.getElementById('dlg-avatar'),
      minimap: document.getElementById('minimap'),
      mapOverlay: document.getElementById('map-overlay'),
      mapCanvas: document.getElementById('citymap'),
      pause: document.getElementById('pause-overlay'),
    };
    this.mapOpen = false;
    this.dlgT = 0;
    this.minimapCtx = this.el.minimap.getContext('2d');
    this.mapCtx = this.el.mapCanvas.getContext('2d');
  }
  show() { this.el.hud.style.display = 'block'; }
  hide() { this.el.hud.style.display = 'none'; }
  showDialogue(who, text, sec) {
    this.el.dlgName.textContent = who;
    this.el.dlgText.textContent = text;
    const colors = { Mara: '#e85d75', Kito: '#2fa36b', Dario: '#3e7cc2' };
    this.el.dlgAvatar.style.background = colors[who] || '#888';
    this.el.dlgAvatar.textContent = who[0];
    this.el.dialogue.style.display = 'flex';
    this.dlgT = sec;
  }
  hideDialogue() { this.el.dialogue.style.display = 'none'; this.dlgT = 0; }
  toggleMap() {
    this.mapOpen = !this.mapOpen;
    this.el.mapOverlay.style.display = this.mapOpen ? 'flex' : 'none';
  }
  setPaused(p) { this.el.pause.style.display = p ? 'flex' : 'none'; }

  update(dt, g) {
    if (this.dlgT > 0) { this.dlgT -= dt; if (this.dlgT <= 0) this.hideDialogue(); }
    const obj = g.missions.objective();
    this.el.missionChapter.textContent = obj.chapter;
    this.el.missionText.textContent = obj.text;
    this.el.missionSub.textContent = obj.sub;
    // progress: 3 chapter segments, fill by mission + stage
    let segs = '';
    for (let i = 0; i < 3; i++) {
      let fill = 0;
      if (g.mission > i) fill = 100;
      else if (g.mission === i) fill = 50;
      segs += `<span class="seg"><span class="fill" style="width:${fill}%"></span></span>`;
    }
    this.el.missionProg.innerHTML = segs;
    // evade / grab progress hint
    if (g.mission === 1 && g.stage === 1) {
      this.el.missionSub.textContent = `SHAKE THE TAIL — stay out of sight (${Math.max(0, 12 - g.evadeT).toFixed(0)}s)`;
    }
    if (g.mission === 2 && g.stage === 0 && g.grabT > 0) {
      this.el.missionSub.textContent = `Grabbing the cash… ${Math.round((g.grabT / 1.6) * 100)}%`;
    }
    this.el.money.textContent = '$' + Math.floor(g.money).toLocaleString('en-US');
    this.el.stars.textContent = '★'.repeat(g.wanted) + '☆'.repeat(5 - g.wanted);
    this.el.stars.style.color = g.wanted > 0 ? '#ffd94d' : '#8a8f98';
    const hh = Math.floor(g.hour) % 24, mm = Math.floor((g.hour % 1) * 60);
    const ap = hh >= 12 ? 'PM' : 'AM';
    const h12 = ((hh + 11) % 12) + 1;
    this.el.clock.textContent = `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ap} · SOLMAR`;
    this.el.radio.textContent = g.audio && g.audio.radioOn ? '♪ SOL FM 98.1' : '♪ RADIO OFF';
    this.el.health.style.width = Math.max(0, g.health) + '%';
    this.el.armor.style.width = Math.max(0, g.armor) + '%';
    this.el.weaponPistol.textContent = `🔫 PISTOL ${g.combat.ammo}/12` + (g.combat.reloadT > 0 ? ' · RELOADING' : '');
    if (g.inCar && g.car) {
      this.el.speed.style.display = 'block';
      this.el.speedNum.textContent = Math.round(Math.abs(g.car.speed) * 3.6);
      this.el.cond.textContent = 'CONDITION ' + Math.round(g.car.condition) + '%';
    } else this.el.speed.style.display = 'none';
    // PD response panel
    const units = [];
    for (let i = 0; i < g.police.cops.length; i++) units.push(['UNIT ' + (7 + i), 'ON FOOT']);
    for (let i = 0; i < g.police.cruisers.length; i++) units.push(['UNIT ' + (3 + i), 'PURSUIT']);
    if (g.police.heli) units.push(['AIR 1', 'HELICOPTER']);
    let pd = '<div class="pd-title">SOLMAR PD — RESPONSE</div>';
    if (!units.length) pd += '<div class="pd-row"><span>—</span><span>NO HEAT</span></div>';
    else {
      for (const [name, st] of units) {
        const cls = st === 'ON FOOT' ? 'tag-blue' : 'tag-red';
        pd += `<div class="pd-row"><span>${name}</span><span class="tag ${cls}">${st}</span></div>`;
      }
    }
    this.el.pd.innerHTML = pd;
    this.drawMinimap(g);
    if (this.mapOpen) this.drawCityMap(g);
  }
  drawMinimap(g) {
    const c = this.el.minimap, ctx = this.minimapCtx;
    const W = c.width, H = c.height;
    const s = W / WORLD;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); ctx.clip();
    const { X, Z } = drawStreets(ctx, s, W / 2, H / 2);
    // mission blip (pulsing gold)
    const tgt = g.missions.target();
    if (tgt) {
      const r = 5 + Math.sin(performance.now() * 0.006) * 2;
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath(); ctx.arc(X(tgt.x), Z(tgt.z), r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // parked/traffic cars (grey dots)
    ctx.fillStyle = '#c8cdd4';
    for (const car of g.vehicles.cars) {
      if (car === g.car) continue;
      ctx.fillRect(X(car.x) - 1.5, Z(car.z) - 1.5, 3, 3);
    }
    // police (red/blue)
    for (const cop of g.police.cops) { ctx.fillStyle = '#4d8dff'; ctx.beginPath(); ctx.arc(X(cop.x), Z(cop.z), 3, 0, Math.PI * 2); ctx.fill(); }
    for (const cr of g.police.cruisers) { ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(X(cr.x), Z(cr.z), 3.5, 0, Math.PI * 2); ctx.fill(); }
    // player arrow
    ctx.save();
    ctx.translate(X(g.px), Z(g.pz));
    ctx.rotate(-g.heading); // canvas north = -z is up; heading PI = north
    ctx.fillStyle = '#ff9d2e';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    ctx.restore();
    // ring + N
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
    ctx.fillText('N', W / 2, 13);
  }
  drawCityMap(g) {
    const c = this.el.mapCanvas, ctx = this.mapCtx;
    const W = c.width, H = c.height;
    const s = (W - 40) / WORLD;
    ctx.clearRect(0, 0, W, H);
    const { X, Z } = drawStreets(ctx, s, W / 2, H / 2);
    const tgt = g.missions.target();
    if (tgt) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath(); ctx.arc(X(tgt.x), Z(tgt.z), 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = '#ff9d2e';
    ctx.save(); ctx.translate(X(g.px), Z(g.pz)); ctx.rotate(-g.heading);
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'left';
    ctx.fillText('PLAZA', X(-8), Z(-30));
    ctx.fillText('PALM AVENUE', X(104), Z(-140));
    ctx.fillText('MARINA', X(150), Z(-108));
    ctx.fillText('DOCKS', X(160), Z(140));
    ctx.fillText('MARA\u2019S GARAGE', X(-60), Z(-78));
  }
}
