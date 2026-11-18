// SOLMAR — HUD. Dense, information-rich interface on every screen:
// mission panel (chapter / objective / timer / stage bars), police
// response list with named units + status tags, circular minimap with live
// streets + mission blips, dialogue box with a canvas-drawn character
// portrait, weapon slots, money, wanted stars, radio station, speed +
// vehicle condition, health/armor bars. Plus the title screen (gradient
// SOLMAR logo, sunset, menu, controls, portraits) and the full city map
// (M key: districts, mission list, legend, GPS route).

import { CONFIG } from './config.js';

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

const CSS = `
#hud{position:absolute;inset:0;pointer-events:none;font-family:'Segoe UI',Arial,sans-serif;color:#fff;overflow:hidden}
.panel{background:rgba(10,10,24,.72);border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:10px 12px;backdrop-filter:blur(2px)}
#mission{position:absolute;top:12px;left:12px;width:340px}
#mission .chapter{font-size:11px;letter-spacing:2px;color:#ffd166;font-weight:700}
#mission .objective{font-size:16px;font-weight:700;margin:3px 0}
#mission .hint{font-size:12px;color:#cfe3ff;opacity:.9}
#mission .timer{font-size:12px;color:#ff9f1c;font-weight:700;margin-top:4px}
.stagebars{display:flex;gap:5px;margin-top:7px}
.stagebars i{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.25)}
.stagebars i.on{background:#ffd166}
#police{position:absolute;top:170px;left:12px;width:230px;font-size:12px}
#police .ptitle{font-size:11px;letter-spacing:2px;color:#ff6b6b;font-weight:700;margin-bottom:5px}
#police .unit{display:flex;justify-content:space-between;padding:2px 0}
#police .tag{background:#ff2e63;border-radius:4px;padding:0 6px;font-size:10px;font-weight:700}
#police .tag.foot{background:#4361ee}
#topleft2{position:absolute;top:12px;right:12px;text-align:right}
#money{font-size:30px;font-weight:800;color:#7CFC00;text-shadow:0 2px 6px #000}
#money.flash{color:#ffd166;transform:scale(1.12)}
#stars{font-size:26px;letter-spacing:3px;color:#ffd166;text-shadow:0 2px 4px #000;margin-top:2px}
#stars .off{color:rgba(255,255,255,.35)}
#clock{font-size:13px;color:#eaf2f8;margin-top:2px}
#radio{font-size:12px;color:#29e6ff;font-weight:700;margin-top:2px}
#health{position:absolute;left:12px;bottom:12px;width:260px}
#health .bar{height:12px;background:rgba(255,255,255,.2);border-radius:6px;overflow:hidden;margin:3px 0}
#health .bar i{display:block;height:100%;background:linear-gradient(90deg,#2ecc71,#7CFC00)}
#health .bar.armor i{background:linear-gradient(90deg,#4361ee,#29e6ff)}
#health .lbl{font-size:11px;letter-spacing:1px;color:#dfe9ff}
#weapons{display:flex;gap:6px;margin-top:7px}
#weapons .slot{border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:4px 8px;font-size:12px;background:rgba(255,255,255,.08)}
#weapons .slot.on{border-color:#ffd166;background:rgba(255,209,102,.25);font-weight:700}
#speedo{position:absolute;right:14px;bottom:150px;text-align:right}
#speedo .spd{font-size:42px;font-weight:800;text-shadow:0 2px 8px #000}
#speedo .unit{font-size:12px;color:#cfe3ff}
#speedo .cond{font-size:12px;color:#ffd166}
#minimapWrap{position:absolute;right:14px;bottom:14px;width:132px;height:132px}
#minimap{border-radius:50%;border:3px solid rgba(255,255,255,.7);box-shadow:0 0 0 3px rgba(0,0,0,.45),0 4px 14px rgba(0,0,0,.5);background:#101a2e}
#dialogue{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);width:560px;display:none;background:rgba(12,8,28,.85);border:1px solid rgba(255,46,136,.6);border-radius:12px;padding:10px 12px}
#dialogue .who{font-weight:800;color:#ff8fb3;font-size:13px}
#dialogue .line{font-size:15px;margin-top:2px}
#portrait{float:left;margin-right:10px;border-radius:8px;border:2px solid rgba(255,255,255,.4)}
#toast{position:absolute;top:44%;left:50%;transform:translate(-50%,-50%);font-size:34px;font-weight:800;color:#ffd166;text-shadow:0 3px 10px #000;display:none}
#hitmark{position:absolute;top:50%;left:50%;width:26px;height:26px;margin:-13px 0 0 -13px;display:none}
#hitmark:before,#hitmark:after{content:'';position:absolute;background:#fff;box-shadow:0 0 6px #000}
#hitmark:before{left:12px;top:0;width:2px;height:26px}
#hitmark:after{top:12px;left:0;height:2px;width:26px}
#crosshair{position:absolute;top:50%;left:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border:2px solid rgba(255,255,255,.9);border-radius:50%;box-shadow:0 0 4px #000;display:none}
#title{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(180deg,rgba(43,16,85,.55) 0%,rgba(255,46,99,.28) 45%,rgba(255,140,66,.42) 75%,rgba(10,10,30,.75) 100%);pointer-events:auto;text-align:center}
#title h1{font-size:92px;margin:0;letter-spacing:6px;background:linear-gradient(180deg,#ffd166,#ff2e63 60%,#7b2ff7);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 6px 30px rgba(0,0,0,.45);font-weight:900}
#title .sub{font-size:20px;letter-spacing:8px;color:#fff;margin:2px 0 18px;text-shadow:0 2px 8px #000}
#title .menu{display:flex;gap:12px;margin:10px 0}
#title button{pointer-events:auto;cursor:pointer;font-size:17px;font-weight:700;padding:12px 26px;border-radius:10px;border:2px solid #ffd166;background:rgba(20,10,40,.75);color:#ffd166}
#title button.primary{background:#ffd166;color:#241040}
#title button:hover{transform:scale(1.05)}
#title .controls{margin-top:16px;font-size:13px;line-height:1.7;color:#eaf2f8;background:rgba(10,10,24,.6);padding:10px 18px;border-radius:10px;border:1px solid rgba(255,255,255,.2)}
#title .faces{display:flex;gap:18px;margin-top:14px}
#title .face{text-align:center;font-size:12px;color:#fff}
#title .face canvas{border-radius:10px;border:2px solid rgba(255,255,255,.5)}
#mapscreen{position:absolute;inset:0;display:none;background:rgba(8,10,28,.92);pointer-events:auto;padding:18px}
#mapscreen h2{margin:0 0 8px;color:#ffd166;letter-spacing:2px}
#mapscreen .cols{display:flex;gap:18px}
#mapscreen canvas{border:2px solid rgba(255,255,255,.35);border-radius:10px;background:#101a2e}
#mapscreen .side{width:300px;font-size:13px;line-height:1.6}
#mapscreen .side b{color:#ffd166}
#pause{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(5,5,15,.7);pointer-events:auto}
#pause .box{text-align:center}
#pause h2{font-size:44px;letter-spacing:4px}
#pause p{color:#cfe3ff}
`;

export function drawPortrait(canvas, name) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const skins = { Mara: '#f1c27d', Kito: '#c68642', Dario: '#f1c27d' };
  const hairs = { Mara: '#6b2d1a', Kito: '#111111', Dario: '#2d1a0e' };
  const shirts = { Mara: '#e74c3c', Kito: '#2ecc71', Dario: '#ffffff' };
  // background
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#ff8c42'); bg.addColorStop(1, '#2b1055');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // shoulders / shirt
  g.fillStyle = shirts[name] || '#3498db';
  g.beginPath(); g.moveTo(8, H); g.quadraticCurveTo(W / 2, H - 52, W - 8, H); g.lineTo(W - 8, H); g.closePath(); g.fill();
  // neck + head
  g.fillStyle = skins[name] || '#f1c27d';
  g.fillRect(W / 2 - 9, H - 62, 18, 16);
  g.beginPath(); g.arc(W / 2, H - 78, 26, 0, Math.PI * 2); g.fill();
  // hair
  g.fillStyle = hairs[name] || '#222';
  g.beginPath(); g.arc(W / 2, H - 86, 26, Math.PI, 0); g.fill();
  g.fillRect(W / 2 - 26, H - 88, 52, 10);
  // eyes + smile
  g.fillStyle = '#1a1a1a';
  g.beginPath(); g.arc(W / 2 - 10, H - 78, 3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(W / 2 + 10, H - 78, 3, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7b2d1a'; g.lineWidth = 2;
  g.beginPath(); g.arc(W / 2, H - 68, 8, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
}

export class HUD {
  constructor(game) {
    this.game = game;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = el('div', null, document.getElementById('app'));
    this.root.id = 'hud';

    // mission panel
    const m = el('div', 'panel', this.root); m.id = 'mission';
    this.mChapter = el('div', 'chapter', m, 'CHAPTER 1');
    this.mObjective = el('div', 'objective', m, '');
    this.mHint = el('div', 'hint', m, '');
    this.mTimer = el('div', 'timer', m, '');
    const bars = el('div', 'stagebars', m);
    this.stageBars = [el('i', '', bars), el('i', '', bars), el('i', '', bars)];

    // police response list
    const p = el('div', 'panel', this.root); p.id = 'police';
    el('div', 'ptitle', p, 'SOLMAR PD — RESPONSE');
    this.policeList = el('div', '', p, '<div class="unit"><span>—</span><span>NO HEAT</span></div>');

    // top-right: money / stars / clock / radio
    const tr = el('div', '', this.root); tr.id = 'topleft2';
    this.moneyEl = el('div', '', tr, '$150'); this.moneyEl.id = 'money';
    this.starsEl = el('div', '', tr, ''); this.starsEl.id = 'stars';
    this.clockEl = el('div', '', tr, ''); this.clockEl.id = 'clock';
    this.radioEl = el('div', '', tr, 'SOL FM 98.1'); this.radioEl.id = 'radio';

    // health / armor / weapons
    const h = el('div', 'panel', this.root); h.id = 'health';
    el('div', 'lbl', h, 'HEALTH');
    const hb = el('div', 'bar', h); this.hpBar = el('i', '', hb);
    el('div', 'lbl', h, 'ARMOR');
    const ab = el('div', 'bar armor', h); this.armorBar = el('i', '', ab);
    const w = el('div', '', h); w.id = 'weapons';
    this.slotFists = el('div', 'slot', w, '👊 FISTS');
    this.slotPistol = el('div', 'slot on', w, '🔫 PISTOL 12/12');

    // speedometer
    const sp = el('div', '', this.root); sp.id = 'speedo';
    this.speedEl = el('div', 'spd', sp, '');
    el('div', 'unit', sp, 'km/h');
    this.condEl = el('div', 'cond', sp, '');
    sp.style.display = 'none';
    this.speedo = sp;

    // minimap
    const mm = el('div', '', this.root); mm.id = 'minimapWrap';
    this.minimap = el('canvas', '', mm);
    this.minimap.id = 'minimap';
    this.minimap.width = 264; this.minimap.height = 264;
    this.minimap.style.width = '132px'; this.minimap.style.height = '132px';

    // dialogue
    const d = el('div', '', this.root); d.id = 'dialogue';
    this.portrait = el('canvas', '', d);
    this.portrait.id = 'portrait';
    this.portrait.width = 64; this.portrait.height = 80;
    this.dWho = el('div', 'who', d, '');
    this.dLine = el('div', 'line', d, '');
    this.dialogueBox = d;
    this.dialogueUntil = 0;

    this.toast = el('div', '', this.root, ''); this.toast.id = 'toast';
    this.hitmark = el('div', '', this.root); this.hitmark.id = 'hitmark';
    this.crosshair = el('div', '', this.root); this.crosshair.id = 'crosshair';

    // title screen
    const t = el('div', '', this.root); t.id = 'title';
    el('h1', '', t, 'SOLMAR');
    el('div', 'sub', t, '— STREETS OF THE SUN —');
    const menu = el('div', 'menu', t);
    this.btnNew = el('button', 'primary', menu, '▶ NEW GAME');
    this.btnContinue = el('button', '', menu, '↻ CONTINUE');
    const faces = el('div', 'faces', t);
    for (const name of ['Dario', 'Mara', 'Kito']) {
      const f = el('div', 'face', faces);
      const cv = el('canvas', '', f);
      cv.width = 64; cv.height = 80;
      drawPortrait(cv, name);
      el('div', '', f, name);
    }
    el('div', 'controls', t,
      'WASD drive / walk &nbsp;·&nbsp; E enter / exit car &nbsp;·&nbsp; CLICK shoot &nbsp;·&nbsp; R reload<br>' +
      'M city map &nbsp;·&nbsp; P / ESC pause &nbsp;·&nbsp; Q radio station &nbsp;·&nbsp; SPACE handbrake<br>' +
      'Steal cars, lose the cops, run the Vane family out of the harbour.');
    this.titleScreen = t;

    // map screen
    const ms = el('div', '', this.root); ms.id = 'mapscreen';
    el('h2', '', ms, 'SOLMAR — CITY MAP &nbsp; <span style="font-size:13px;color:#cfe3ff">press M to close</span>');
    const cols = el('div', 'cols', ms);
    this.mapCanvas = el('canvas', '', cols);
    this.mapCanvas.width = 640; this.mapCanvas.height = 640;
    const side = el('div', 'side', cols);
    this.mapSide = side;
    this.mapScreen = ms;

    // pause
    const pz = el('div', '', this.root); pz.id = 'pause';
    const box = el('div', 'box', pz);
    el('h2', '', box, 'PAUSED');
    el('p', '', box, 'Press P or ESC to resume · autosaves every 30s');
    this.pauseScreen = pz;
  }

  showTitle(hasSave) {
    this.titleScreen.style.display = 'flex';
    this.btnContinue.style.display = hasSave ? '' : 'none';
  }
  hideTitle() { this.titleScreen.style.display = 'none'; }

  showDialogue(text, who = 'Mara', sec = 4) {
    this.dWho.textContent = who;
    this.dLine.textContent = text;
    drawPortrait(this.portrait, who);
    this.dialogueBox.style.display = 'block';
    this.dialogueUntil = performance.now() / 1000 + sec;
  }
  hideDialogue() { this.dialogueBox.style.display = 'none'; }

  flashMoney(text) {
    this.toast.textContent = text;
    this.toast.style.display = 'block';
    this.moneyEl.classList.add('flash');
    setTimeout(() => { this.toast.style.display = 'none'; this.moneyEl.classList.remove('flash'); }, 2200);
  }
  flashHit() {
    this.hitmark.style.display = 'block';
    setTimeout(() => { this.hitmark.style.display = 'none'; }, 120);
  }
  updateAmmo(ammo, mag, reloading = false) {
    this.slotPistol.textContent = reloading ? '🔫 RELOADING…' : `🔫 PISTOL ${ammo}/${mag}`;
  }

  setMission(mission, stage, done) {
    this.mChapter.textContent = mission ? mission.chapter : 'SOLMAR — FREE ROAM';
    this.mObjective.textContent = mission ? mission.stages[stage].objective : 'All missions complete.';
    this.mHint.textContent = mission ? mission.stages[stage].hint : 'The city is yours.';
    this.stageBars.forEach((b, i) => {
      b.className = done || i < (mission ? mission.id - 1 : 0) || (mission && i < mission.id - 1) ? 'on' : '';
      if (mission && i === mission.id - 1) b.className = 'on';
      if (done) b.className = 'on';
    });
  }
  setTimer(text) { this.mTimer.textContent = text || ''; }
  setMoney(n) { this.moneyEl.textContent = '$' + Math.floor(n).toLocaleString('en-US'); }
  setWanted(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += `<span class="${i < n ? '' : 'off'}">★</span>`;
    this.starsEl.innerHTML = s;
  }
  setClock(hour) {
    const h = Math.floor(hour) % 24;
    const m = Math.floor((hour % 1) * 60);
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    this.clockEl.textContent = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap} · SOLMAR`;
  }
  setRadio(name) { this.radioEl.textContent = '♪ ' + name; }
  setHealth(hp, armor) {
    this.hpBar.style.width = Math.max(0, hp) + '%';
    this.armorBar.style.width = Math.max(0, armor) + '%';
  }
  setSpeed(kmh, condition, driving) {
    this.speedo.style.display = driving ? 'block' : 'none';
    if (driving) {
      this.speedEl.textContent = Math.round(kmh);
      this.condEl.textContent = 'CONDITION ' + Math.round(condition) + '%';
    }
  }
  setPoliceUnits(units) {
    if (!units.length) {
      this.policeList.innerHTML = '<div class="unit"><span>—</span><span>NO HEAT</span></div>';
      return;
    }
    this.policeList.innerHTML = units.map((u) =>
      `<div class="unit"><span>${u.name}</span><span class="tag ${u.tag === 'ON FOOT' ? 'foot' : ''}">${u.tag}</span></div>`
    ).join('');
  }
  setCrosshair(on) { this.crosshair.style.display = on ? 'block' : 'none'; }
  showPause(on) { this.pauseScreen.style.display = on ? 'flex' : 'none'; }
  showMap(on) { this.mapScreen.style.display = on ? 'block' : 'none'; }

  /** Circular live minimap: streets, sea, player arrow, cars, police, mission blip. */
  drawMinimap(game) {
    const g = this.minimap.getContext('2d');
    const S = 264, C = S / 2;
    const scale = S / 460; // world 460 wide -> canvas
    const px = game.player.x, pz = game.player.z;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#101a2e'; g.fillRect(0, 0, S, S);
    // sea (east + south edges)
    g.fillStyle = '#1b7f8e';
    g.fillRect(C + 212 * scale, 0, S, S);
    g.fillRect(0, C + 212 * scale, S, S);
    // roads
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 5;
    for (const x of CONFIG.roadsX) {
      g.beginPath(); g.moveTo(C + x * scale, 0); g.lineTo(C + x * scale, S); g.stroke();
    }
    for (const z of CONFIG.roadsZ) {
      g.beginPath(); g.moveTo(0, C + z * scale); g.lineTo(S, C + z * scale); g.stroke();
    }
    // plaza
    g.fillStyle = '#f2a65a';
    g.beginPath(); g.arc(C, C, 24 * scale + 6, 0, Math.PI * 2); g.fill();
    // mission blip (pulsing gold)
    const tgt = game.missions.target();
    if (tgt) {
      const pulse = 6 + Math.sin(performance.now() / 300) * 2;
      g.fillStyle = '#ffd166';
      g.beginPath(); g.arc(C + tgt.x * scale, C + tgt.z * scale, pulse, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    }
    // police (red dots)
    g.fillStyle = '#ff2e63';
    for (const c of game.police.cruisers) {
      g.beginPath(); g.arc(C + c.x * scale, C + c.z * scale, 4, 0, Math.PI * 2); g.fill();
    }
    for (const c of game.police.cops) {
      g.beginPath(); g.arc(C + c.x * scale, C + c.z * scale, 3, 0, Math.PI * 2); g.fill();
    }
    // player arrow (white, points along heading)
    const h = game.player.heading;
    g.save();
    g.translate(C + px * scale, C + pz * scale);
    g.rotate(Math.atan2(Math.sin(h), -Math.cos(h)) + Math.PI);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(-6, 7); g.closePath(); g.fill();
    g.restore();
    g.restore();
    // north tick
    g.fillStyle = '#fff'; g.font = 'bold 13px Arial';
    g.fillText('N', C - 4, 14);
  }

  /** Full city map screen: districts, missions, legend, GPS route. */
  drawMap(game) {
    const g = this.mapCanvas.getContext('2d');
    const S = 640, C = S / 2;
    const scale = S / 460;
    g.fillStyle = '#101a2e'; g.fillRect(0, 0, S, S);
    // districts
    for (const d of CONFIG.districts) {
      g.fillStyle = d.color + '44';
      g.fillRect(C + (d.x - d.w / 2) * scale, C + (d.z - d.h / 2) * scale, d.w * scale, d.h * scale);
      g.strokeStyle = d.color; g.lineWidth = 1.5;
      g.strokeRect(C + (d.x - d.w / 2) * scale, C + (d.z - d.h / 2) * scale, d.w * scale, d.h * scale);
      g.fillStyle = '#fff'; g.font = 'bold 13px Arial';
      g.fillText(d.name, C + (d.x - d.w / 2) * scale + 4, C + (d.z - d.h / 2) * scale + 16);
    }
    // sea
    g.fillStyle = '#1b7f8e';
    g.fillRect(C + 212 * scale, 0, S, S);
    g.fillRect(0, C + 212 * scale, S, S);
    // roads
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 4;
    for (const x of CONFIG.roadsX) { g.beginPath(); g.moveTo(C + x * scale, 0); g.lineTo(C + x * scale, S); g.stroke(); }
    for (const z of CONFIG.roadsZ) { g.beginPath(); g.moveTo(0, C + z * scale); g.lineTo(S, C + z * scale); g.stroke(); }
    // GPS route: player -> mission target (dashed gold)
    const tgt = game.missions.target();
    if (tgt) {
      g.strokeStyle = '#ffd166'; g.lineWidth = 3; g.setLineDash([10, 6]);
      g.beginPath();
      g.moveTo(C + game.player.x * scale, C + game.player.z * scale);
      g.lineTo(C + tgt.x * scale, C + tgt.z * scale);
      g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ffd166';
      g.beginPath(); g.arc(C + tgt.x * scale, C + tgt.z * scale, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000'; g.font = 'bold 11px Arial';
      g.fillText('★', C + tgt.x * scale - 4, C + tgt.z * scale + 4);
    }
    // player
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(C + game.player.x * scale, C + game.player.z * scale, 7, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ff2e63'; g.lineWidth = 2; g.stroke();
    // mission list side panel
    this.mapSide.innerHTML = '<b>MISSIONS</b><br>' + CONFIG.missions.map((m, i) => {
      const st = game.missions.completed[i] ? '✓ DONE' : (i === game.missions.index && !game.missions.done ? '▶ ACTIVE' : '· LOCKED');
      return `${m.id}. ${m.title} — ${m.payoutText} <span style="color:#7CFC00">${st}</span>`;
    }).join('<br>') +
    '<br><br><b>LEGEND</b><br>★ mission target<br>○ you<br><span style="color:#ff2e63">●</span> police<br>' +
    '<br><b>DISTRICTS</b><br>' + CONFIG.districts.map((d) => d.name).join(' · ') +
    `<br><br><b>MONEY</b> $${Math.floor(game.money)} &nbsp; <b>WANTED</b> ${'★'.repeat(game.wanted)}${'☆'.repeat(5 - game.wanted)}`;
  }
}
