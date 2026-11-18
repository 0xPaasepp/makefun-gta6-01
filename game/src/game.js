// SOLMAR — game orchestrator. Owns the renderer, the player (on foot and
// driving), the camera, the wanted system, the day-sunset-night cycle,
// autosave, and the wiring between city / vehicles / people / police /
// missions / combat / HUD / audio. Original open-world crime gameplay.

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { RNG } from './rng.js';
import { buildCity } from './city.js';
import { VehicleManager } from './vehicles.js';
import { PeopleManager, makePersonMesh } from './people.js';
import { PoliceManager } from './police.js';
import { MissionManager } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { saveGameData, loadGameData, hasSave } from './save.js';

export class Game {
  constructor() {
    this.rng = new RNG(20261118);
    this.app = document.getElementById('app');
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.app.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xdd7a4a, 120, 520);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

    // golden-hour sun + warm hemisphere light
    this.sun = new THREE.DirectionalLight(0xffb36b, 1.5);
    this.sun.position.set(-120, 90, -60);
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a2a4a, 0.85);
    this.scene.add(this.hemi);

    this.city = buildCity(THREE, this.scene, this.rng);
    this.colliders = this.city.colliders;
    this.vehicles = new VehicleManager(THREE, this.scene, this.rng, this.colliders);
    this.people = new PeopleManager(THREE, this.scene, this.rng, this.colliders);
    this.police = new PoliceManager(THREE, this.scene, this.rng, this.colliders);
    this.missions = new MissionManager(this);
    this.combat = new Combat(THREE, this.scene, this);
    this.hud = new HUD(this);
    this.input = new Input();
    this.audio = new AudioEngine();

    // ---- player: Dario Voss, plain WHITE T-SHIRT
    this.playerMesh = makePersonMesh(THREE, { skin: 0xf1c27d, shirt: 0xffffff, pants: 0x2c3e50, height: 1.82, hair: 0x2d1a0e });
    this.scene.add(this.playerMesh);
    this.player = {
      x: CONFIG.playerStart.x, z: CONFIG.playerStart.z,
      heading: Math.PI, speed: 0, health: 100, armor: 50,
      walkPhase: 0, mesh: this.playerMesh,
    };
    this.money = CONFIG.startMoney;
    this.wanted = 0;
    this.inCar = null; // vehicle object when driving
    this.hour = 17.8; // golden hour by default
    this.started = false;
    this.paused = false;
    this.mapOpen = false;
    this.cameraMode = 'follow'; // 'follow' | 'fixed'
    this.unseenT = 0;
    this.saveT = 0;
    this.lastT = performance.now();
    this._fpsT = 0;

    this._wireInput();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this._snapCamera();
    this.hud.showTitle(hasSave());
    this.hud.setMoney(this.money);
    this.hud.setWanted(0);
    this.hud.setHealth(100, 50);
    this.hud.setClock(this.hour);
    this.hud.setRadio(this.audio.stationName);
    this._refreshMissionHud();
  }

  // ---------------------------------------------------------- input wiring
  _wireInput() {
    this.input.on('keydown', (e) => {
      const k = e.key.toLowerCase();
      this.audio.init(); this.audio.resume();
      if (!this.started) return;
      if (k === 'e') this._toggleCar();
      if (k === 'm') this._toggleMap();
      if (k === 'p' || k === 'escape') this._togglePause();
      if (k === 'q') this.hud.setRadio(this.audio.nextStation());
      if (k === 'r') this.combat.reload();
    });
    this.input.on('mousedown', (e) => {
      this.audio.init(); this.audio.resume();
      if (!this.started || this.paused || this.mapOpen) return;
      if (e.target === this.renderer.domElement && !this.inCar) this.combat.shoot();
    });
    this.hud.btnNew.addEventListener('click', () => { this.audio.init(); this.audio.resume(); this.startNew(); });
    this.hud.btnContinue.addEventListener('click', () => {
      this.audio.init(); this.audio.resume();
      this.startNew(true);
    });
  }

  startNew(fromSave = false) {
    if (fromSave) {
      const d = loadGameData();
      if (d) this._applySave(d);
    } else {
      this.money = CONFIG.startMoney;
      this.missions = new MissionManager(this);
      this.player.x = CONFIG.playerStart.x; this.player.z = CONFIG.playerStart.z;
      this.player.heading = Math.PI; this.player.health = 100; this.player.armor = 50;
      this.wanted = 0; this.hour = 17.8; this.inCar = null;
    }
    this.started = true;
    this.paused = false;
    this.mapOpen = false;
    this.hud.hideTitle();
    this.hud.showMap(false);
    this.hud.showPause(false);
    this._snapCamera();
    this._refreshMissionHud();
    this.hud.setMoney(this.money);
    this.hud.setWanted(this.wanted);
    if (!fromSave) this.hud.showDialogue(CONFIG.dialogue.maraStart, 'Mara', 6);
  }

  _toggleMap() {
    if (!this.started) return;
    this.mapOpen = !this.mapOpen;
    this.hud.showMap(this.mapOpen);
    if (this.mapOpen) this.hud.drawMap(this);
  }
  _togglePause() {
    if (!this.started) return;
    this.paused = !this.paused;
    this.hud.showPause(this.paused);
  }

  // ---------------------------------------------------------- cars
  _toggleCar() {
    if (this.inCar) { this.exitCar(); return; }
    const car = this.vehicles.nearestCar(this.player.x, this.player.z, 4.5);
    if (!car) return;
    this.inCar = car;
    car.parked = false;
    car.speed = 0;
    this.playerMesh.visible = false;
    if (car.occupied) {
      car.occupied = false;
      car.alarm = true;
      this.setWanted(Math.max(this.wanted, 1));
      this.hud.showDialogue('Car alarm! Someone saw you take it.', 'Dario', 3);
    }
    if (car === this.vehicles.neonSport) this.missions.onGrabNeon();
    else this.missions.onStealCar();
    this.audio.playChime();
  }

  exitCar() {
    if (!this.inCar) return;
    const car = this.inCar;
    this.inCar = null;
    car.speed = 0;
    const sx = car.x + Math.cos(car.heading) * 2.2;
    const sz = car.z - Math.sin(car.heading) * 2.2;
    this.player.x = sx; this.player.z = sz;
    this.player.heading = car.heading;
    this.playerMesh.visible = true;
    this.playerMesh.position.set(sx, 0, sz);
  }

  // ---------------------------------------------------------- wanted / money
  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.hud.setWanted(this.wanted);
    this.police.sync(this.wanted, this.player.x, this.player.z, this.player.heading);
    this.unseenT = 0;
  }
  addMoney(n) { this.money += n; this.hud.setMoney(this.money); }
  setMoney(n) { this.money = n; this.hud.setMoney(this.money); }

  damagePlayer(n) {
    if (this.player.armor > 0) {
      const absorbed = Math.min(this.player.armor, n);
      this.player.armor -= absorbed; n -= absorbed;
    }
    this.player.health -= n;
    if (this.player.health <= 0) this._wasted();
    this.hud.setHealth(this.player.health, this.player.armor);
  }

  _wasted() {
    this.hud.showDialogue('Dario: Not like this…', 'Dario', 3);
    this.audio.playBust();
    this.money = Math.max(0, this.money - 50);
    this.player.health = 100; this.player.armor = 25;
    this.setWanted(0);
    if (this.inCar) this.exitCar();
    this.player.x = CONFIG.playerStart.x; this.player.z = CONFIG.playerStart.z;
    this._snapCamera();
    this.hud.setMoney(this.money);
    this.hud.setHealth(100, 25);
  }

  _busted() {
    this.hud.showDialogue('Busted! The Solmar PD takes $100 and your pride.', 'Dario', 4);
    this.audio.playBust();
    this.money = Math.max(0, this.money - 100);
    this.player.health = 100;
    this.setWanted(0);
    if (this.inCar) this.exitCar();
    this.player.x = CONFIG.playerStart.x; this.player.z = CONFIG.playerStart.z;
    this._snapCamera();
    this.hud.setMoney(this.money);
    this.hud.setHealth(100, this.player.armor);
  }

  nearestPoliceDist() {
    let best = Infinity;
    for (const c of this.police.cops) best = Math.min(best, Math.hypot(c.x - this.player.x, c.z - this.player.z));
    for (const c of this.police.cruisers) best = Math.min(best, Math.hypot(c.x - this.player.x, c.z - this.player.z));
    return best;
  }

  // ---------------------------------------------------------- save
  saveGame() {
    saveGameData({
      money: this.money,
      missionIndex: this.missions.index,
      missionStage: this.missions.stage,
      completed: this.missions.completed,
      health: this.player.health, armor: this.player.armor,
      x: this.player.x, z: this.player.z, heading: this.player.heading,
      hour: this.hour, wanted: this.wanted,
    });
  }
  _applySave(d) {
    this.money = d.money;
    this.missions.index = d.missionIndex; this.missions.stage = d.missionStage || 0;
    this.missions.completed = d.completed || [false, false, false];
    this.missions.done = this.missions.index >= CONFIG.missions.length;
    this.missions._refreshText();
    this.player.health = d.health ?? 100; this.player.armor = d.armor ?? 0;
    this.player.x = d.x ?? CONFIG.playerStart.x; this.player.z = d.z ?? CONFIG.playerStart.z;
    this.player.heading = d.heading ?? Math.PI;
    this.hour = d.hour ?? 17.8;
    this.wanted = d.wanted ?? 0;
    this.police.sync(this.wanted, this.player.x, this.player.z, this.player.heading);
  }

  _refreshMissionHud() {
    const m = this.missions.mission;
    this.hud.setMission(this.missions.done ? null : m, this.missions.stage, this.missions.done);
    this.hud.setTimer(this.missions.timerText);
  }

  // ---------------------------------------------------------- physics
  _collide(x, z, r) {
    // push a circle out of every building AABB; clamp to world bounds
    for (const b of this.colliders) {
      const cx = Math.max(b.x - b.hx, Math.min(x, b.x + b.hx));
      const cz = Math.max(b.z - b.hz, Math.min(z, b.z + b.hz));
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r; z = cz + (dz / d) * r;
        } else {
          x += r; // centre inside box: push out along +x
        }
      }
    }
    x = Math.max(CONFIG.world.minX, Math.min(CONFIG.world.maxX, x));
    z = Math.max(CONFIG.world.minZ, Math.min(CONFIG.world.maxZ, z));
    return [x, z];
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (this.inCar) {
      const car = this.inCar;
      const accel = this.input.up ? 22 : 0;
      const brake = this.input.down ? 26 : 0;
      const hand = this.input.isDown(' ') ? 30 : 0;
      if (accel) car.speed += accel * dt;
      if (brake) car.speed -= brake * dt;
      if (!accel && !brake) car.speed -= Math.sign(car.speed) * 6 * dt;
      if (hand) car.speed -= Math.sign(car.speed) * hand * dt;
      if (Math.abs(car.speed) < 0.15 && !accel) car.speed = 0;
      car.speed = Math.max(-12, Math.min(car.maxSpeed, car.speed));
      const steer = (this.input.left ? 1 : 0) - (this.input.right ? 1 : 0);
      const dir = car.speed >= 0 ? 1 : -1;
      car.heading += steer * 1.9 * dt * Math.min(1, Math.abs(car.speed) / 8) * dir;
      car.braking = brake > 0 || hand > 0;
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const [cx, cz] = this._collide(nx, nz, 1.4);
      if (cx !== nx || cz !== nz) {
        car.speed *= 0.4;
        car.condition = Math.max(40, car.condition - 0.4);
      }
      car.x = cx; car.z = cz;
      p.x = car.x; p.z = car.z; p.heading = car.heading; p.speed = car.speed;
      // M1 delivery: in a car at Mara's garage
      if (this.missions.index === 0 && this.missions.stage === 1) {
        if (Math.hypot(car.x - CONFIG.garage.x, car.z - CONFIG.garage.z) < 8) this.missions.onDeliver();
      }
    } else {
      const run = this.input.isDown('shift') ? 1.7 : 1;
      const fwd = (this.input.up ? 1 : 0) - (this.input.down ? 1 : 0);
      const strafe = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      const mx = Math.sin(p.heading) * fwd + Math.cos(p.heading) * strafe;
      const mz = Math.cos(p.heading) * fwd - Math.sin(p.heading) * strafe;
      const ml = Math.hypot(mx, mz);
      if (ml > 0) {
        const sp = 5.2 * run;
        const nx = p.x + (mx / ml) * sp * dt;
        const nz = p.z + (mz / ml) * sp * dt;
        const [cx, cz] = this._collide(nx, nz, 0.8);
        p.x = cx; p.z = cz;
        p.walkPhase += dt * 9;
        const sw = Math.sin(p.walkPhase) * 0.55;
        p.mesh.userData.legL.rotation.x = sw;
        p.mesh.userData.legR.rotation.x = -sw;
        p.mesh.userData.armL.rotation.x = -sw * 0.7;
        p.mesh.userData.armR.rotation.x = sw * 0.7;
      } else {
        p.mesh.userData.legL.rotation.x = 0;
        p.mesh.userData.legR.rotation.x = 0;
        p.mesh.userData.armL.rotation.x = 0;
        p.mesh.userData.armR.rotation.x = 0;
      }
      p.speed = 0;
      // mouse drag orbits the heading a little
      if (this.input.mouseDX) { p.heading += this.input.mouseDX * 0.003; this.input.mouseDX = 0; }
      // M3 cash grab on foot
      if (this.missions.index === 2 && this.missions.stage === 0) {
        if (Math.hypot(p.x - CONFIG.cashCrates.x, p.z - CONFIG.cashCrates.z) < 4) {
          this.missions.onCashGrabbed();
          this.setWanted(3);
        }
      }
    }
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    p.mesh.visible = !this.inCar;
  }

  // ---------------------------------------------------------- camera
  _snapCamera() {
    const p = this.player;
    const dist = this.inCar ? 11 : 7.5;
    const h = this.inCar ? 4.6 : 3.4;
    this.camera.position.set(
      p.x - Math.sin(p.heading) * dist,
      h,
      p.z - Math.cos(p.heading) * dist
    );
    this.camera.lookAt(p.x + Math.sin(p.heading) * 4, 1.6, p.z + Math.cos(p.heading) * 4);
  }

  _updateCamera(dt) {
    if (this.cameraMode === 'fixed') return;
    const p = this.player;
    const dist = this.inCar ? 11 : 7.5;
    const h = this.inCar ? 4.6 : 3.4;
    const tx = p.x - Math.sin(p.heading) * dist;
    const tz = p.z - Math.cos(p.heading) * dist;
    const k = 1 - Math.exp(-5 * dt);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (h - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(p.x + Math.sin(p.heading) * 4, 1.6, p.z + Math.cos(p.heading) * 4);
  }

  // ---------------------------------------------------------- debug API
  faceCamera() {
    const dx = this.camera.position.x - this.player.x;
    const dz = this.camera.position.z - this.player.z;
    this.player.heading = Math.atan2(dx, dz);
    this.cameraMode = 'fixed';
  }
  followCamera() { this.cameraMode = 'follow'; this._snapCamera(); }
  teleport(x, z) {
    this.player.x = x; this.player.z = z;
    if (this.inCar) { this.inCar.x = x; this.inCar.z = z; this.inCar.speed = 0; }
    this._snapCamera();
  }
  setHeading(h) { this.player.heading = h; if (this.inCar) this.inCar.heading = h; }
  enterNearestCar() {
    if (this.inCar) return true;
    const car = this.vehicles.nearestCar(this.player.x, this.player.z, 6);
    if (!car) return false;
    this.player.x = car.x; this.player.z = car.z;
    this._toggleCar();
    return true;
  }
  setSpeed(vKmh) {
    if (!this.inCar) return false;
    this.inCar.speed = Math.max(0, Math.min(this.inCar.maxSpeed, vKmh / 3.6));
    return true;
  }
  snapshot() {
    return {
      money: Math.round(this.money), wanted: this.wanted,
      mission: this.missions.index + 1, stage: this.missions.stage,
      objective: this.missions.objective,
      health: Math.round(this.player.health), armor: Math.round(this.player.armor),
      x: +this.player.x.toFixed(1), z: +this.player.z.toFixed(1),
      heading: +this.player.heading.toFixed(2),
      speedKmh: Math.round(Math.abs(this.player.speed || 0) * 3.6),
      inCar: !!this.inCar, carModel: this.inCar ? this.inCar.model.name : null,
      hour: +this.hour.toFixed(2), started: this.started,
      hasSave: hasSave(), guardsAlive: this.people.guards.filter((g) => g.alive).length,
      police: { cops: this.police.cops.length, cruisers: this.police.cruisers.length, heli: this.police.heliOn },
    };
  }
  state() {
    const s = this.snapshot();
    s.localStorage = (() => { try { return localStorage.getItem('solmar-save-v1'); } catch (e) { return null; } })();
    s.traffic = this.vehicles.traffic.length;
    s.parked = this.vehicles.cars.filter((c) => c.parked).length;
    s.peds = this.people.peds.length;
    s.completed = this.missions.completed;
    return s;
  }

  // ---------------------------------------------------------- main loop
  frame(now) {
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    if (this.started && !this.paused) {
      // day-sunset-night cycle: 1 game hour per 120 real seconds
      this.hour = (this.hour + dt / 120) % 24;
      this.city.update(this.hour);
      const sunA = ((this.hour - 6) / 12) * Math.PI; // 6h sunrise, 18h sunset
      const el = Math.max(0.06, Math.sin(sunA));
      this.sun.position.set(-Math.cos(sunA) * 160, el * 160, -80);
      this.sun.intensity = 0.7 + el * 0.9;
      this.sun.color.setHex(this.hour >= 17 && this.hour < 19.5 ? 0xffb36b : 0xfff2d9);
      this.hemi.intensity = this.hour >= 19 || this.hour < 6 ? 0.35 : 0.85;
      // fog follows the sky: orange-pink at sunset, deep blue at night
      if (this.hour >= 19 || this.hour < 6) this.scene.fog.color.setHex(0x1a1440);
      else if (this.hour >= 17) this.scene.fog.color.setHex(0xdd7a4a);
      else this.scene.fog.color.setHex(0x9fc8e8);

      this._updatePlayer(dt);
      this.vehicles.update(dt, this.inCar);
      this.people.update(dt, this.player, true);
      const busted = this.police.update(dt, this.wanted, this.player.x, this.player.z, this.inCar, (c) => {
        if (this.inCar) { this.inCar.speed *= 0.55; this.inCar.condition = Math.max(35, this.inCar.condition - 1.5); }
        else this.damagePlayer(4);
      });
      if (busted === 'busted') this._busted();
      this.missions.update(dt);
      this.combat.update(dt);
      this.audio.tickRadio();
      this.audio.setEngine(this.inCar ? Math.abs(this.player.speed || 0) * 3.6 : 0, !!this.inCar);
      this.audio.setSiren(this.wanted);

      // wanted decay: unseen for 8s drops one star
      if (this.wanted > 0) {
        const nd = this.nearestPoliceDist();
        if (nd > 45) {
          this.unseenT += dt;
          if (this.unseenT > 8) { this.setWanted(this.wanted - 1); }
        } else this.unseenT = 0;
      }

      // autosave every 30s
      this.saveT += dt;
      if (this.saveT > 30) { this.saveT = 0; this.saveGame(); }

      // HUD refresh (throttled to ~10Hz for the minimap)
      this._fpsT += dt;
      if (this._fpsT > 0.1) {
        this._fpsT = 0;
        this._refreshMissionHud();
        this.hud.setClock(this.hour);
        this.hud.setHealth(this.player.health, this.player.armor);
        this.hud.setSpeed(this.inCar ? Math.abs(this.player.speed || 0) * 3.6 : 0, this.inCar ? this.inCar.condition : 100, !!this.inCar);
        this.hud.setPoliceUnits(this.police.units);
        this.hud.setCrosshair(!this.inCar);
        this.hud.drawMinimap(this);
        if (this.hud.dialogueUntil && performance.now() / 1000 > this.hud.dialogueUntil) {
          this.hud.dialogueUntil = 0;
          this.hud.hideDialogue();
        }
        if (this.mapOpen) this.hud.drawMap(this);
      }
      this._updateCamera(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
