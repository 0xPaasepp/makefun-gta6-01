// SOLMAR — Streets of the Sun. Game orchestrator: player, camera, driving,
// stealing, shooting, wanted, missions, save, and the debug API the
// playtest + screenshot tools drive (window.__solmar).
//
// Rebuild 12: permanent golden hour (the clock wraps inside 16:30–19:30),
// weapon wheel (Q / 1–4, rifle unlocks at respect 80), garage paint shop
// (C at Mara's garage, $50 a coat), respect ranks, Sun Shell collectibles,
// police dispatch panel, DJ radio idents, car horn (H), ACES tone mapping
// for the cinematic sunset grade.
// Rebuild 13: EIGHT named story missions (was 3), a full-city map screen
// (M / Tab) with districts, legend, gold route and a stats panel
// (escapes / takedowns / races won), explicit BUSTED / WASTED screens
// (never a silent respawn), the opening Mara call as an incoming phone
// call, handbrake (Space), and the debug clock clamped into the golden
// band so no tool can stage a morning screenshot by accident.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, districtAt, streetNameAt } from './config.js';
import { City } from './city.js';
import { Car, TrafficSystem, makeParkedCars } from './vehicles.js';
import { buildPlayerMesh, PedSystem } from './people.js';
import { PoliceSystem } from './police.js';
import { MissionSystem } from './missions.js';
import { CombatSystem } from './combat.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { SaveSystem } from './save.js';
import { clamp, angleLerp } from './rng.js';

const WHEEL_ORDER = ['pistol', 'smg', 'shotgun', 'rifle'];

export class Game {
  constructor() {
    this.state = {
      money: CONFIG.startMoney, mission: 0, wanted: 0,
      health: 100, armor: 0, started: false, paused: false, mapOpen: false,
      hour: CONFIG.goldenHour.defaultHour, minute: CONFIG.goldenHour.defaultMinute,
      weapon: 'pistol', respect: 0, shellsGot: [], paint: 0,
      weaponsOwned: { pistol: true, smg: false, shotgun: false, rifle: false },
      // Rebuild 13 stats — shown on the map screen, saved in v3.
      stats: { escapes: 0, takedowns: 0, racesWon: 0 },
    };
    this.px = CONFIG.playerStart.x; this.pz = CONFIG.playerStart.z;
    this.heading = CONFIG.playerStart.heading;
    this.inCar = false; this.currentCar = null;
    this.time = 0; this._autosaveT = 0; this._clockT = 0;
    this.cameraMode = 'follow';
    this.aimPoint = null;
    this._lastMouseX = 0; this._lastMouseY = 0;
    this._smgGiven = false; this._shotgunGiven = false; this._rifleGiven = false;
    this._zone = '';
    this._bustedCd = 0;
    this._prevWanted = 0; this._justBusted = false;

    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    // No tone mapping: the default (linear) grade keeps the pastel walls
    // and the white t-shirt bright at golden hour — ACES darkened the
    // whole city into silhouettes in rebuild 12 testing.
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe8876a);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
    this.camera.position.set(0, 6, 16);

    this.city = new City(this.scene);
    this.city.setTimeOfDay(this.state.hour);
    this.cars = makeParkedCars(this.scene);
    // Traffic is exposed as a plain array (game.traffic[i]) with the system
    // kept beside it for updates.
    this._trafficSys = new TrafficSystem(this.scene);
    this.traffic = this._trafficSys.list;
    this.peds = new PedSystem(this.scene);
    this.police = new PoliceSystem(this.scene, this.city);
    // Cruiser rams shove the player (or their car) away from the cruiser.
    this.police._onRam = (cruiser, dt) => {
      const dx = this.px - cruiser.x, dz = this.pz - cruiser.z;
      const d = Math.hypot(dx, dz) || 1;
      const push = 8 * dt;
      if (this.inCar && this.currentCar) {
        this.currentCar.x += (dx / d) * push;
        this.currentCar.z += (dz / d) * push;
        this.currentCar.speed *= 0.94;
        this.currentCar.syncMesh();
        this.px = this.currentCar.x; this.pz = this.currentCar.z;
      } else {
        this.px += (dx / d) * push;
        this.pz += (dz / d) * push;
        this._syncPlayerMesh();
      }
    };
    this.missions = new MissionSystem(this.scene, this.state);
    this.audio = new AudioEngine();
    this.combat = new CombatSystem(this.scene, this.audio);
    this.hud = new HUD();
    this.input = new Input();
    this.save = new SaveSystem();

    this.playerMesh = buildPlayerMesh();
    this.playerMesh.position.set(this.px, 0.3, this.pz);
    this.scene.add(this.playerMesh);
    // Fake blob shadow under the player (cheap, reads well in screenshots).
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.set(this.px, 0.32, this.pz);
    this.scene.add(this.blob);

    this.input.onFirstGesture = () => this.audio.ensure();
    window.addEventListener('resize', () => this._resize());
    this._resize();
    this._bindUI();
    this._last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0.001, (now - this._last) / 1000));
      this._last = now;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
    this._exposeDebug();
    this._updateContinueButton();
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  _updateContinueButton() {
    const btn = document.getElementById('btn-continue');
    if (btn) btn.style.display = this.save.hasSave() ? 'inline-block' : 'none';
  }
  _respectRank() {
    const idx = Math.min(CONFIG.respectRanks.length - 1, Math.floor((this.state.respect || 0) / CONFIG.respectPerRank));
    return CONFIG.respectRanks[idx];
  }
  _bindUI() {
    const start = (load) => {
      this.audio.ensure(); this.audio.click();
      // Stale title-screen input must not leak into the first frame
      // (a click/key pressed between rAF ticks survives endTick).
      this.input.endTick(); this.input.mouseDown = false;
      document.getElementById('title-screen').style.display = 'none';
      if (load) this._loadSave();
      else this._newGame();
      this.state.started = true;
      const def = this.missions.missionDef(this.state.mission);
      // Rebuild 13: the story opens on Mara's incoming phone call.
      if (!load && this.state.mission === 0) this.hud.showPhoneCall(def.giver, def.intro, 9000);
      else this.hud.showDialogue(def.giver, def.intro, 7000);
    };
    document.getElementById('btn-new').addEventListener('click', () => start(false));
    document.getElementById('btn-continue').addEventListener('click', () => start(true));
    document.getElementById('btn-controls').addEventListener('click', () => {
      const p = document.getElementById('controls-panel');
      p.style.display = p.style.display === 'none' ? 'block' : 'none';
      this.audio.click();
    });
    document.getElementById('btn-resume').addEventListener('click', () => this._setPaused(false));
    document.getElementById('btn-quit-title').addEventListener('click', () => {
      this._setPaused(false);
      this.state.started = false;
      document.getElementById('title-screen').style.display = 'flex';
      this._updateContinueButton();
    });
    // Rebuild 13: map-screen buttons.
    document.getElementById('btn-map-resume').addEventListener('click', () => this._closeMap());
    document.getElementById('btn-map-save').addEventListener('click', () => {
      this.saveNow();
      this.hud.toast('Game saved.');
      this._refreshMap();
    });
    document.getElementById('btn-map-load').addEventListener('click', () => {
      this._loadSave();
      this.hud.toast('Save loaded — welcome back to Solmar.');
      this._refreshMap();
    });
    document.getElementById('btn-map-quit').addEventListener('click', () => {
      this._closeMap();
      this.state.started = false;
      document.getElementById('title-screen').style.display = 'flex';
      this._updateContinueButton();
    });
    document.getElementById('t-fire').addEventListener('click', () => { this.input.pressed.add('KeyF'); });
    document.getElementById('t-enter').addEventListener('click', () => { this.input.pressed.add('KeyE'); });
  }
  _openMap() {
    if (!this.state.started || this.state.paused) return;
    this.state.mapOpen = true;
    this._refreshMap();
    this.hud.showMap();
    this.audio.click();
  }
  _closeMap() {
    this.state.mapOpen = false;
    this.hud.hideMap();
    this.audio.click();
  }
  _refreshMap() {
    const obj = this.missions.objectivePos();
    this.hud.updateMapStats({
      money: this.state.money, mission: this.state.mission,
      shells: this.missions.shellsGotCount(), shellsTotal: CONFIG.shells.length,
      respect: this.state.respect, respectRank: this._respectRank(), stats: this.state.stats,
    });
    this.hud.drawFullMap(this.px, this.pz, this.heading, obj,
      [...this.police.footCops, ...this.police.cruisers],
      [...this.cars, ...this.traffic], this.missions.guards,
      this.missions._packageMeshes, this.missions._shellMeshes);
  }
  _newGame() {
    this.state.money = CONFIG.startMoney; this.state.mission = 0;
    this.state.health = 100; this.state.armor = 0; this.state.wanted = 0;
    this.state.hour = CONFIG.goldenHour.defaultHour; this.state.minute = CONFIG.goldenHour.defaultMinute;
    this.state.respect = 0; this.state.shellsGot = []; this.state.paint = 0;
    this.state.weapon = 'pistol';
    this.state.stats = { escapes: 0, takedowns: 0, racesWon: 0 };
    this.state.mapOpen = false; this.hud.hideMap(); this.hud.hideBusted();
    this.state.weaponsOwned = { pistol: true, smg: false, shotgun: false, rifle: false };
    this._smgGiven = false; this._shotgunGiven = false; this._rifleGiven = false;
    this._prevWanted = 0; this._justBusted = false;
    this.px = CONFIG.playerStart.x; this.pz = CONFIG.playerStart.z;
    this.heading = CONFIG.playerStart.heading;
    if (this.currentCar) this.exitCar();
  }
  _loadSave() {
    const d = this.save.read();
    if (!d) { this._newGame(); return; }
    this.state.money = d.money ?? CONFIG.startMoney;
    this.state.mission = d.mission ?? 0;
    this.state.health = d.health ?? 100;
    this.state.armor = d.armor ?? 0;
    this.state.hour = d.hour ?? CONFIG.goldenHour.defaultHour;
    this.state.respect = d.respect ?? 0;
    this.state.shellsGot = d.shellsGot ?? [];
    this.state.paint = d.paint ?? 0;
    this.state.stats = d.stats || { escapes: 0, takedowns: 0, racesWon: 0 };
    this.state.weaponsOwned = d.weaponsOwned || { pistol: true };
    this.px = d.px ?? CONFIG.playerStart.x;
    this.pz = d.pz ?? CONFIG.playerStart.z;
    this.heading = d.heading ?? 0;
    if (this.state.mission === 2) this.missions.spawnGuards();
    if (this.state.mission >= 2) this.state.weaponsOwned.smg = true;
    // Restore collected shells (hide their meshes).
    for (const sh of this.missions._shellMeshes) {
      if (this.state.shellsGot.includes(sh.index)) { sh.got = true; sh.mesh.visible = false; }
    }
    this.city.setTimeOfDay(this.state.hour);
    this.hud.toast('Save loaded — welcome back to Solmar.');
  }
  saveNow() {
    return this.save.write({
      money: this.state.money, mission: this.state.mission,
      px: this.px, pz: this.pz, heading: this.heading,
      health: this.state.health, armor: this.state.armor, hour: this.state.hour,
      respect: this.state.respect, shellsGot: this.state.shellsGot,
      paint: this.state.paint, weaponsOwned: this.state.weaponsOwned,
      stats: this.state.stats,
    });
  }
  _setPaused(p) {
    this.state.paused = p;
    document.getElementById('pause-screen').style.display = p ? 'flex' : 'none';
  }

  // ---- debug / automation API (used by playtest + screenshots) ----
  _exposeDebug() {
    const self = this;
    window.__solmar = {
      game: self,
      state() {
        return { started: self.state.started, money: self.state.money, mission: self.state.mission,
          wanted: self.state.wanted, inCar: self.inCar, health: self.state.health,
          speed: self.currentCar ? Math.abs(self.currentCar.speed) : 0,
          respect: self.state.respect, respectRank: self._respectRank(),
          shells: self.missions.shellsGotCount(), weapon: self.state.weapon,
          radio: self.audio.stationName(), radioTrack: self.audio.stationTrack(),
          paint: self.state.paint, shellsTotal: CONFIG.shells.length,
          hour: self.state.hour, minute: self.state.minute,
          mapOpen: self.state.mapOpen, stats: { ...self.state.stats },
          handbraking: self.currentCar ? !!self.currentCar.handbraking : false,
          lastHornAt: self.audio.lastHornAt };
      },
      teleport(x, z) { self.px = x; self.pz = z; if (self.currentCar) { self.currentCar.x = x; self.currentCar.z = z; self.currentCar.syncMesh(); } self._syncPlayerMesh(); },
      aimAt(x, z) { self.aimPoint = { x, z }; self.heading = Math.atan2(x - self.px, z - self.pz); },
      setHeading(a) { self.heading = a; },
      setWanted(n) { self.state.wanted = n; self.police.setWanted(n, self.px, self.pz); },
      setMission(n) { self.state.mission = n; if (n === 2) self.missions.spawnGuards(); },
      setSpeed(v) { if (self.currentCar) self.currentCar.speed = v; },
      // Rebuild 13: the debug clock is clamped into the golden band —
      // the rebuild-12 shots read 09:41/10:42 because the old API let a
      // tool stage a morning hour against a sunset sky. Never again.
      setTimeOfDay(h) {
        const band = CONFIG.goldenHour;
        const hh = Math.min(band.end - 0.01, Math.max(band.start, h));
        self.state.hour = hh; self.city.setTimeOfDay(hh);
      },
      setRespect(n) { self.state.respect = n; },
      openMap() { self._openMap(); },
      closeMap() { self._closeMap(); },
      giveWeapon(w) { self.state.weaponsOwned[w] = true; },
      paintCar(i) { self._paintCar(i); },
      faceCamera() { self.cameraMode = 'face'; },
      followCamera() { self.cameraMode = 'follow'; },
      enterNearestCar() { return self._enterCar(); },
      exitCar() { self.exitCar(); },
    };
  }

  _syncPlayerMesh() {
    this.playerMesh.position.set(this.px, 0.3, this.pz);
    this.playerMesh.rotation.y = this.heading;
    this.blob.position.set(this.px, 0.32, this.pz);
  }
  _nearestCar(maxD) {
    let best = null, bd = maxD;
    for (const c of this.cars) {
      const d = Math.hypot(c.x - this.px, c.z - this.pz);
      if (d < bd) { bd = d; best = c; }
    }
    for (const c of this.traffic) {
      const d = Math.hypot(c.x - this.px, c.z - this.pz);
      if (d < bd && Math.abs(c.speed) < 3) { bd = d; best = c; }
    }
    return best;
  }
  _enterCar() {
    const car = this._nearestCar(5);
    if (!car) return false;
    this.inCar = true; this.currentCar = car;
    car.parked = false;
    this.px = car.x; this.pz = car.z; this.heading = car.heading;
    this.playerMesh.visible = false; this.blob.visible = false;
    const ev = this.missions.onCarStolen(car);
    if (ev === 'm2-stolen') {
      this.state.wanted = 2; this.police.setWanted(2, this.px, this.pz);
      this.hud.showDialogue('KITO', 'That\'s the Neon Sport! Cops are on you — LOSE THEM!', 5000);
      this.audio.alarm();
    } else if (ev === 'm1-stolen') {
      this.hud.showDialogue('MARA', 'Nice wheels. Now bring it to my garage — south end of this road.', 4500);
    } else if (car.occupied || this.traffic.includes(car)) {
      this.state.wanted = Math.max(this.state.wanted, 2);
      this.police.setWanted(this.state.wanted, this.px, this.pz);
      this.audio.alarm();
      this.hud.toast('Car alarm! The police saw that.');
    }
    this.audio.setEngine(true, 0);
    return true;
  }
  exitCar() {
    if (!this.currentCar) return;
    const c = this.currentCar;
    this.px = c.x - Math.sin(c.heading) * 0 - 2.4;
    this.pz = c.z - 2.4;
    this.heading = c.heading;
    this.inCar = false; this.currentCar = null;
    this.playerMesh.visible = true; this.blob.visible = true;
    this._syncPlayerMesh();
    this.audio.setEngine(false, 0);
  }
  // Garage paint shop: cycle to the next coat, $50, only in Mara's garage.
  _paintCar(nextIdx) {
    if (!this.inCar || !this.currentCar) return false;
    const inGarage = Math.hypot(this.px - CONFIG.safehouse.x, this.pz - CONFIG.safehouse.z) < CONFIG.safehouse.r + 2;
    if (!inGarage) { this.hud.toast('Paint shop is at Mara\'s garage.'); return false; }
    const idx = typeof nextIdx === 'number' ? nextIdx : (this.state.paint + 1) % CONFIG.paints.length;
    const paint = CONFIG.paints[idx];
    if (this.state.money < CONFIG.paintCost) { this.hud.toast(`Need $${CONFIG.paintCost} for paint.`); return false; }
    this.state.money -= CONFIG.paintCost;
    this.state.paint = idx;
    this.state.respect = (this.state.respect || 0) + 1;
    this.currentCar.repaint(paint.color);
    this.audio.spray();
    this.hud.showDialogue('MARA', `Fresh ${paint.name} — looking sharp, Dario. That's how you turn heads in Solmar.`, 4000);
    this.saveNow();
    return true;
  }
  // Weapon wheel: cycle to the next owned weapon (Q) or previous (Z).
  _cycleWeapon(dir) {
    const cur = WHEEL_ORDER.indexOf(this.state.weapon);
    for (let step = 1; step <= WHEEL_ORDER.length; step++) {
      const next = WHEEL_ORDER[(cur + dir * step + WHEEL_ORDER.length * 2) % WHEEL_ORDER.length];
      if (this.state.weaponsOwned[next]) {
        this.state.weapon = next;
        this.hud.showWheel(next, this.state.weaponsOwned);
        this.hud.toast(CONFIG.weapons[next].name + ' equipped');
        return;
      }
    }
    this.hud.showWheel(this.state.weapon, this.state.weaponsOwned);
  }
  _shootOnce() {
    // Direct, deterministic shot: ray from the player through the aim point,
    // nearest target within 1.3u of the ray takes weapon damage.
    const w = CONFIG.weapons[this.state.weapon];
    if (this.combat.cooldown > 0) return;
    this.combat.cooldown = w.cooldown;
    this.combat.shotsFired++;
    this.audio.gunshot();
    const origin = { x: this.px, z: this.pz };
    let dir;
    if (this.aimPoint) {
      const dx = this.aimPoint.x - this.px, dz = this.aimPoint.z - this.pz;
      const d = Math.hypot(dx, dz) || 1;
      dir = { x: dx / d, z: dz / d };
    } else dir = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    const targets = [];
    for (const p of this.peds.list) if (p.alive) targets.push(p);
    for (const gd of this.missions.guards) if (gd.alive) targets.push(gd);
    let best = null, bestD = w.range;
    for (let pel = 0; pel < w.pellets; pel++) {
      const spread = (Math.random() - 0.5) * 2 * w.spread;
      const a = Math.atan2(dir.x, dir.z) + spread;
      const d = { x: Math.sin(a), z: Math.cos(a) };
      for (const t of targets) {
        const rx = t.x - origin.x, rz = t.z - origin.z;
        const along = rx * d.x + rz * d.z;
        if (along < 0 || along > w.range) continue;
        const perp = Math.abs(rx * d.z - rz * d.x);
        if (perp < 1.3 && along < bestD) { bestD = along; best = t; }
      }
      const ex = origin.x + d.x * (best ? bestD : w.range);
      const ez = origin.z + d.z * (best ? bestD : w.range);
      this.combat._tracer(origin, ex, ez);
    }
    if (best) {
      best.hp -= w.damage;
      const killed = best.hp <= 0;
      // Rebuild 13: every landed shot counts (hit-marker flash), every
      // takedown counts toward the map's stats panel.
      this.combat.registerHit(killed);
      if (killed) this.state.stats.takedowns++;
      const isGuard = this.missions.guards.includes(best);
      if (killed) {
        best.alive = false;
        if (best.mesh) best.mesh.visible = false;
        if (!isGuard) {
          this.state.wanted = Math.max(this.state.wanted, 1);
          this.police.setWanted(this.state.wanted, this.px, this.pz);
        }
      } else if (!isGuard) {
        this.state.wanted = Math.max(this.state.wanted, 1);
        this.police.setWanted(this.state.wanted, this.px, this.pz);
      }
    }
  }

  update(dt) {
    this.time += dt;
    if (!this.state.started || this.state.paused) {
      // Attract mode: slow orbit around the plaza behind the title screen.
      if (!this.state.started) {
        const a = this.time * 0.05;
        this.camera.position.set(Math.sin(a) * 26, 12, Math.cos(a) * 26);
        this.camera.lookAt(0, 2, 0);
        this._trafficSys.update(dt);
        this.peds.update(dt, this.time);
        this.city.fountainWater.scale.y = 1 + Math.sin(this.time * 2) * 0.06;
      }
      this.input.endTick();
      return;
    }
    const inp = this.input;
    // Map: M / Tab opens the full-city map (the world freezes behind it);
    // Esc closes the map first, then pauses. P pauses as before.
    if (inp.map) { if (this.state.mapOpen) this._closeMap(); else this._openMap(); }
    if (this.state.mapOpen) {
      if (inp.wasPressed('Escape') || inp.wasPressed('KeyP')) this._closeMap();
      inp.endTick();
      return;
    }
    // Pause.
    if (inp.wasPressed('Escape') || inp.wasPressed('KeyP')) { this._setPaused(!this.state.paused); inp.consume('Escape'); inp.consume('KeyP'); }
    if (this.state.paused) { inp.endTick(); return; }
    // Radio + mute + horn + paint + weapon wheel.
    if (inp.radio) {
      const st = this.audio.cycleStation();
      this.hud.toast(`${st.name} — ${st.dj}: ${this.audio.stationTrack()}`);
    }
    if (inp.mute) { this.audio.setMuted(!this.audio.muted); this.hud.toast(this.audio.muted ? 'Sound off' : 'Sound on'); }
    if (inp.horn && this.inCar) this.audio.horn();
    if (inp.paint) this._paintCar();
    if (inp.wheelNext) this._cycleWeapon(1);
    if (inp.wheelPrev) this._cycleWeapon(-1);
    for (const [k, w] of [['Digit1', 'pistol'], ['Digit2', 'smg'], ['Digit3', 'shotgun'], ['Digit4', 'rifle']]) {
      if (inp.wasPressed(k) && this.state.weaponsOwned[w]) {
        this.state.weapon = w;
        this.hud.showWheel(w, this.state.weaponsOwned);
        this.hud.toast(CONFIG.weapons[w].name + ' equipped');
      }
    }
    // Clock: 1 game hour per 150 sim-seconds — but it WRAPS inside the
    // golden band (16:30–19:30), so the light never leaves sunset.
    this._clockT += dt;
    if (this._clockT > 2.5) {
      this._clockT = 0;
      this.state.minute += 1;
      if (this.state.minute >= 60) {
        this.state.minute = 0;
        this.state.hour += 1;
        if (this.state.hour >= CONFIG.goldenHour.end) this.state.hour = CONFIG.goldenHour.start;
        this.city.setTimeOfDay(this.state.hour);
      }
    }
    // Mouse aim: ray from the camera through the cursor onto y=0 — but only
    // once the mouse has actually moved, so keyboard-only play (and the
    // debug aimAt) keeps using the facing direction.
    this._updateMouseAim();
    // --- Movement ---
    if (this.inCar && this.currentCar) {
      this.currentCar.drive(inp, dt);
      const c = this.currentCar;
      const fixed = this.city.resolveCollision(c.x, c.z, 2.1);
      if (fixed[0] !== c.x || fixed[1] !== c.z) { c.x = fixed[0]; c.z = fixed[1]; c.speed *= 0.4; c.syncMesh(); }
      this.px = c.x; this.pz = c.z; this.heading = c.heading;
      this.audio.setEngine(true, Math.abs(c.speed) / c.maxSpeed);
      if (inp.wasPressed('KeyE')) this.exitCar();
    } else {
      const speed = inp.run ? CONFIG.runSpeed : CONFIG.walkSpeed;
      // Camera-relative movement: W = away from camera.
      const camFwd = new THREE.Vector3();
      this.camera.getWorldDirection(camFwd);
      camFwd.y = 0; camFwd.normalize();
      const camRight = new THREE.Vector3().crossVectors(camFwd, new THREE.Vector3(0, 1, 0)).negate();
      let mx = 0, mz = 0;
      if (inp.forward) { mx += camFwd.x; mz += camFwd.z; }
      if (inp.back) { mx -= camFwd.x; mz -= camFwd.z; }
      if (inp.left) { mx -= camRight.x; mz -= camRight.z; }
      if (inp.right) { mx += camRight.x; mz += camRight.z; }
      const ml = Math.hypot(mx, mz);
      if (ml > 0.01) {
        mx /= ml; mz /= ml;
        const nx = clamp(this.px + mx * speed * dt, CONFIG.world.minX, 202);
        const nz = clamp(this.pz + mz * speed * dt, CONFIG.world.minZ, CONFIG.world.maxZ);
        const fixed = this.city.resolveCollision(nx, nz, 0.7);
        this.px = fixed[0]; this.pz = fixed[1];
        const targetH = Math.atan2(mx, mz);
        this.heading = angleLerp(this.heading, targetH, Math.min(1, dt * 12));
        // Walk-cycle swing.
        const sw = Math.sin(this.time * 9) * 0.45;
        this.playerMesh.userData.legL.rotation.x = sw;
        this.playerMesh.userData.legR.rotation.x = -sw;
        this.playerMesh.userData.armL.rotation.x = -sw * 0.8;
        this.playerMesh.userData.armR.rotation.x = sw * 0.8;
      } else {
        this.playerMesh.userData.legL.rotation.x *= 0.8;
        this.playerMesh.userData.legR.rotation.x *= 0.8;
        this.playerMesh.userData.armL.rotation.x *= 0.8;
        this.playerMesh.userData.armR.rotation.x *= 0.8;
      }
      this._syncPlayerMesh();
      if (inp.wasPressed('KeyE')) this._enterCar();
    }
    // --- Shooting ---
    if ((inp.wasPressed('KeyF') || inp.wasPressed('Mouse0')) && !this.inCar) this._shootOnce();
    else if ((inp.down('KeyF') || inp.mouseDown) && this.state.weapon === 'smg' && !this.inCar) this._shootOnce();
    if (this.inCar && inp.wasPressed('KeyF')) this._shootOnce();
    // --- World sim ---
    this._trafficSys.update(dt);
    this.peds.update(dt, this.time);
    this.combat.update(dt);
    this.city.fountainWater.scale.y = 1 + Math.sin(this.time * 2) * 0.06;
    // Guards shoot back (light pressure, never a one-shot).
    for (const gd of this.missions.guards) {
      if (!gd.alive) continue;
      gd.shootT -= dt;
      const d = Math.hypot(gd.x - this.px, gd.z - this.pz);
      if (gd.shootT <= 0 && d < 32) {
        gd.shootT = 2.6;
        if (this.state.armor > 0) this.state.armor = Math.max(0, this.state.armor - 3);
        else this.state.health = Math.max(0, this.state.health - 3);
        this.combat._tracer({ x: gd.x, z: gd.z }, this.px, this.pz);
      }
    }
    // --- Police ---
    const bust = this.police.update(dt, this.px, this.pz, this.inCar, this.currentCar ? Math.abs(this.currentCar.speed) : 0);
    this.state.wanted = this.police.wanted;
    if (bust === 'busted' && this._bustedCd <= 0) {
      this._bustedCd = 5;
      this.state.money = Math.max(0, this.state.money - 100);
      this.state.wanted = 0; this.police.setWanted(0, this.px, this.pz);
      this.state.health = 100;
      this._justBusted = true;
      if (this.currentCar) this.exitCar();
      this.px = 0; this.pz = 20; this._syncPlayerMesh();
      // Rebuild 13: an explicit BUSTED screen — the top-1 bug was a
      // silent respawn with no screen at all. This one cannot be missed.
      this.hud.showBusted('BUSTED', 'Solmar PD took $100 and dumped you at the plaza. Lay low for a bit.');
    }
    this._bustedCd = Math.max(0, this._bustedCd - dt);
    this.audio.setSiren(this.state.wanted > 0);
    // Wasted: respawn at the plaza, lose $150.
    if (this.state.health <= 0) {
      this.state.health = 100; this.state.armor = 0;
      this.state.money = Math.max(0, this.state.money - 150);
      this.state.wanted = 0; this.police.setWanted(0, this.px, this.pz);
      this._justBusted = true;
      if (this.currentCar) this.exitCar();
      this.px = 0; this.pz = 20; this._syncPlayerMesh();
      this.hud.showBusted('WASTED', 'Kito dragged you to the plaza. That cost you $150.');
    }
    // Rebuild 13 escapes: wanted fell to zero on its own (not a bust or
    // a waste) — the player evaded the law fair and square.
    if (this._prevWanted > 0 && this.state.wanted === 0 && !this._justBusted) this.state.stats.escapes++;
    this._prevWanted = this.state.wanted;
    this._justBusted = false;
    // --- Missions + side jobs ---
    const prevMission = this.state.mission;
    const ev = this.missions.update(dt, this.px, this.pz, this.inCar, this.time);
    if (ev) {
      if (ev.type === 'mission-complete') {
        this.audio.missionDone();
        this.saveNow();
        this.hud.showDialogue(ev.who, ev.text + ` (+$${ev.reward})`, 7000);
        // Rebuild 13: missions 5 and 8 ARE race wins — they count.
        if (ev.id === 5 || ev.id === 8) this.state.stats.racesWon++;
        if (ev.id === 2 && !this._smgGiven) { this._smgGiven = true; this.state.weaponsOwned.smg = true; this.hud.toast('SMG unlocked — press 2'); }
        if (ev.id === 8) this.hud.toast('Story complete — Solmar is yours!');
      } else if (ev.type === 'job-done') {
        this.audio.pickup();
        this.saveNow();
        if (ev.id === 'race' || ev.id === 'race2') this.state.stats.racesWon++;
        this.hud.showDialogue(ev.who, ev.text + ` (+$${ev.reward})`, 5500);
      } else if (ev.type === 'shell') {
        this.audio.shellChime();
        this.saveNow();
        this.hud.toast(ev.text + ` (+$${ev.reward})`);
      } else if (ev.type === 'shells-done') {
        this.audio.missionDone();
        this.saveNow();
        this.hud.showDialogue(ev.who, ev.text + ` (+$${ev.reward})`, 7000);
      } else if (ev.type === 'job-start' || ev.type === 'job-progress') {
        this.hud.showDialogue(ev.who, ev.text, 5000);
      }
    }
    // New mission started: show its giver's opening line.
    if (this.state.mission !== prevMission && this.state.mission >= 1 && this.state.mission <= 7) {
      const def = this.missions.missionDef(this.state.mission);
      this.hud.showDialogue(def.giver, def.intro, 7000);
    }
    if (this.state.mission >= 2 && !this._shotgunGiven) {
      this._shotgunGiven = true; this.state.weaponsOwned.shotgun = true;
      this.hud.toast('Shotgun stashed at the docks — press 3');
    }
    // Rifle unlocks at respect 80 (rank KNOWN) — the wheel shows it locked
    // until then.
    if (!this._rifleGiven && (this.state.respect || 0) >= 80) {
      this._rifleGiven = true; this.state.weaponsOwned.rifle = true;
      this.hud.toast('Rifle unlocked — respect pays. Press 4');
    }
    // Safehouse: standing in Mara's garage on foot heals + refills armor.
    const inGarage = Math.hypot(this.px - CONFIG.safehouse.x, this.pz - CONFIG.safehouse.z) < CONFIG.safehouse.r;
    const district = districtAt(this.px, this.pz);
    if (inGarage && !this.inCar) {
      this.state.health = Math.min(100, this.state.health + 6 * dt);
      this.state.armor = Math.min(100, this.state.armor + 4 * dt);
      this._zone = 'SAFEHOUSE — Mara\'s Garage (healing)';
    } else if (this.px > 205) this._zone = 'BEACH';
    else if (this.px > 160 && this.pz < -40) this._zone = 'DOCKS';
    else if (this.px > 160) this._zone = 'MARINA';
    else if (Math.abs(this.px) < 20 && Math.abs(this.pz) < 20) this._zone = 'SOLMAR PLAZA';
    else if (Math.abs(this.px) < 8) this._zone = 'PALM AVENUE';
    else this._zone = district.name;
    // Paint shop prompt while parked in the garage in a car.
    if (this.inCar && inGarage) {
      this.hud.showPaint(CONFIG.paints[(this.state.paint + 1) % CONFIG.paints.length].name, CONFIG.paintCost, this.state.money);
    } else {
      this.hud.hidePaint();
    }
    // Autosave.
    this._autosaveT += dt;
    if (this._autosaveT > CONFIG.autosaveSecs) { this._autosaveT = 0; this.saveNow(); }
    // --- Camera ---
    this._updateCamera(dt);
    // --- HUD ---
    const speedKmh = this.inCar && this.currentCar ? Math.abs(this.currentCar.speed) * 4.4 : 0;
    const phase = this.state.hour >= 18.5 ? 'DUSK' : 'GOLDEN HOUR';
    this.hud.update({
      health: this.state.health, armor: this.state.armor, money: this.state.money,
      wanted: this.state.wanted, hour: this.state.hour, minute: this.state.minute,
      speedKmh, mission: this.state.mission, inCar: this.inCar,
      weapon: CONFIG.weapons[this.state.weapon].name, radio: this.audio.stationName(),
      radioDj: this.audio.stationDj(), radioTrack: this.audio.stationTrack(),
      zone: this._zone, street: streetNameAt(this.px, this.pz),
      respect: this.state.respect, respectRank: this._respectRank(),
      shells: this.missions.shellsGotCount(), shellsTotal: CONFIG.shells.length,
      phase, paintName: this.inCar ? CONFIG.paints[this.state.paint].name : '',
    });
    this.hud.updateDispatch(this.police.dispatchState(
      this.px, this.pz, this.inCar && this.currentCar ? Math.abs(this.currentCar.speed) : 0, this.inCar));
    const obj = this.missions.objectivePos();
    this.hud.drawMinimap(this.px, this.pz, this.heading, obj,
      [...this.police.footCops, ...this.police.cruisers],
      [...this.cars, ...this.traffic], this.missions.guards,
      this.missions._packageMeshes, this.missions._shellMeshes);
    inp.endTick();
  }
  _updateMouseAim() {
    // Project the cursor onto the ground plane for aiming. Skipped until
    // the mouse moves from its initial (0,0) corner, so a fresh page never
    // aims at the screen corner by accident.
    if (this.input.mouseX === this._lastMouseX && this.input.mouseY === this._lastMouseY) return;
    this._lastMouseX = this.input.mouseX; this._lastMouseY = this.input.mouseY;
    try {
      const nx = (this.input.mouseX / window.innerWidth) * 2 - 1;
      const ny = -(this.input.mouseY / window.innerHeight) * 2 + 1;
      const v = new THREE.Vector3(nx, ny, 0.5).unproject(this.camera);
      const dir = v.sub(this.camera.position).normalize();
      if (Math.abs(dir.y) < 0.001) return;
      const t = -this.camera.position.y / dir.y;
      if (t > 0) this.aimPoint = { x: this.camera.position.x + dir.x * t, z: this.camera.position.z + dir.z * t };
    } catch (e) { /* ignore */ }
  }
  _updateCamera(dt) {
    const fwd = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    if (this.cameraMode === 'face') {
      // Front view: camera in front of the player, looking back — the white
      // t-shirt and face read clearly, fountain behind the player.
      const tx = this.px + fwd.x * 6.5, tz = this.pz + fwd.z * 6.5;
      this.camera.position.set(tx, 2.6, tz);
      this.camera.lookAt(this.px, 1.6, this.pz);
      return;
    }
    const dist = this.inCar ? 11 : 7.5;
    const height = this.inCar ? 4.6 : 3.6;
    const lookAhead = this.inCar ? 7 : 3.5;
    const tx = this.px - fwd.x * dist, tz = this.pz - fwd.z * dist;
    // Smooth-follow so the frame never jumps.
    const k = Math.min(1, dt * 5);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(this.px + fwd.x * lookAhead, 1.4, this.pz + fwd.z * lookAhead);
  }
}
