// SOLMAR · game.js — orchestrator: loop, movement, driving, camera,
// day-sunset-night cycle, guards, bust/death, autosave, debug API state.
import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32 } from './rng.js';
import { City } from './city.js';
import { Vehicles } from './vehicles.js';
import { People } from './people.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { writeSave, readSave } from './save.js';
import { DIALOGUES } from './config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('game-canvas').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe87a9d);
    this.scene.fog = new THREE.Fog(0xe87a9d, 120, 430);
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(-6, 4, 26);

    this.sun = new THREE.DirectionalLight(0xffd9a0, 1.4);
    this.sun.position.set(80, 120, -40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(512, 512); // 512, not 1024 — SwiftShader FPS
    this.sun.shadow.camera.left = -160; this.sun.shadow.camera.right = 160;
    this.sun.shadow.camera.top = 160; this.sun.shadow.camera.bottom = -160;
    this.sun.shadow.camera.far = 400;
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xffc4d6, 0x8a6a4a, 0.9);
    this.scene.add(this.hemi);

    this.city = new City(this.scene);
    this.vehicles = new Vehicles(this.scene);
    this.people = new People(this.scene, mulberry32(4242));
    this.police = new Police(this.scene, this.city);
    this.missions = new Missions(this);
    this.combat = new Combat(this.scene);
    this.hud = new HUD();
    this.input = new Input();
    this.audio = new AudioEngine();
    this.clock = new THREE.Clock();
    this.rng = mulberry32(99);

    // --- state ---
    this.started = false; this.paused = false;
    this.money = CFG.startMoney; this.mission = 0; this.stage = 0;
    this.health = 100; this.armor = 50; this.ammo = 12;
    this.wanted = 0;
    this.px = CFG.playerStart.x; this.pz = CFG.playerStart.z;
    this.heading = CFG.playerStart.heading;
    this.speed = 0; this.inCar = false; this.car = null;
    this.hour = CFG.startHour;
    this.evadeT = 0; this.grabT = 0; this.walkPhase = 0; this.moving = false;
    this.cameraMode = 'chase';
    this.cruiseSpeed = null; // debug setSpeed: hold this speed
    this.saveT = 0;
    this.guardsSpawned = false;
    this.camPos = new THREE.Vector3(-6, 4, 26);
    this.camLook = new THREE.Vector3(-6, 1.5, 14);
    this.headlight = new THREE.SpotLight(0xffe9a3, 0, 40, 0.5, 0.5, 1.2);
    this.scene.add(this.headlight);
    this.headlightTarget = new THREE.Object3D();
    this.scene.add(this.headlightTarget);
    this.headlight.target = this.headlightTarget;

    this.input.onKey = (code) => this.onKey(code);
    window.addEventListener('resize', () => this.onResize());
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }
  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  onKey(code) {
    if (!this.started) return;
    if (code === 'KeyM') { this.hud.toggleMap(); }
    if (code === 'KeyP' || code === 'Escape') { this.paused = !this.paused; this.hud.setPaused(this.paused); }
    if (code === 'KeyR') this.combat.reload();
    if (code === 'KeyE') {
      if (this.inCar) this.exitCar();
      else this.enterNearestCar(4.5);
    }
  }
  startNew() {
    this.audio.ensure();
    this.resetState();
    this.started = true; this.paused = false;
    document.getElementById('start-screen').style.display = 'none';
    this.hud.show(); this.hud.setPaused(false);
    this.showDialogue(DIALOGUES.start, 5);
  }
  continueGame() {
    const s = readSave();
    if (!s) { this.startNew(); return; }
    this.audio.ensure();
    this.resetState();
    this.money = s.money; this.mission = s.mission; this.stage = s.stage;
    this.health = s.health; this.armor = s.armor; this.ammo = s.ammo;
    this.combat.ammo = s.ammo;
    this.px = s.px; this.pz = s.pz; this.heading = s.heading; this.hour = s.hour;
    if (this.mission === 2 && !this.guardsSpawned) this.spawnGuards();
    this.started = true; this.paused = false;
    document.getElementById('start-screen').style.display = 'none';
    this.hud.show();
    this.showDialogue({ who: 'Mara', text: 'Mara: Welcome back, Dario. The city missed you.' }, 4);
  }
  resetState() {
    this.money = CFG.startMoney; this.mission = 0; this.stage = 0;
    this.health = 100; this.armor = 50; this.ammo = 12; this.combat.ammo = 12;
    this.wanted = 0; this.evadeT = 0; this.grabT = 0;
    this.px = CFG.playerStart.x; this.pz = CFG.playerStart.z;
    this.heading = CFG.playerStart.heading;
    this.speed = 0; this.inCar = false; this.car = null; this.cruiseSpeed = null;
    this.hour = CFG.startHour; this.saveT = 0;
    this.police.clearAll();
    this.guardsSpawned = false;
    for (const gd of this.people.guards) this.scene.remove(gd.mesh);
    this.people.guards = [];
  }
  saveNow() { writeSave(this); }
  spawnGuards() {
    if (this.guardsSpawned) return;
    this.guardsSpawned = true;
    this.people.spawnGuards(CFG.cashCrates.x, CFG.cashCrates.z);
  }
  showDialogue(d, sec) { this.hud.showDialogue(d.who, d.text, sec); }
  setWanted(n) { this.wanted = clamp(Math.round(n), 0, 5); if (this.wanted === 0) this.police.clearAll(); }
  setMission(i, stage = 0) {
    this.mission = clamp(i, 0, 3); this.stage = stage; this.evadeT = 0; this.grabT = 0;
    if (this.mission === 2 && !this.guardsSpawned) this.spawnGuards();
  }
  setMoney(n) { this.money = n; }
  setSpeed(v) { this.cruiseSpeed = v; if (this.inCar && this.car) this.car.speed = v; }
  teleport(x, z) {
    this.px = x; this.pz = z;
    if (this.inCar && this.car) { this.car.x = x; this.car.z = z; this.car.speed = 0; }
    this.camPos.set(x - Math.sin(this.heading) * 8, 4, z - Math.cos(this.heading) * 8);
  }
  setHeading(h) { this.heading = h; if (this.inCar && this.car) this.car.heading = h; }
  faceCamera() { this.cameraMode = 'front'; }
  followCamera() { this.cameraMode = 'chase'; }
  enterNearestCar(range = 6) {
    const car = this.vehicles.nearestCar(this.px, this.pz, range, true);
    if (!car) return false;
    if (car.isTraffic && car.occupied) {
      this.setWanted(Math.max(this.wanted, 1));
      car.alarm = true;
      this.showDialogue({ who: 'Kito', text: 'Kito: That one had a driver — the alarm is screaming. Move!' }, 3);
    }
    car.isParked = false;
    this.inCar = true; this.car = car;
    this.px = car.x; this.pz = car.z; this.heading = car.heading; this.speed = car.speed;
    this.missions.onEnterCar(car);
    if (this.audio) this.audio.blip(520);
    return true;
  }
  exitCar() {
    if (!this.car) return;
    const c = this.car;
    this.px = c.x - Math.sin(c.heading + Math.PI / 2) * 2.2;
    this.pz = c.z - Math.cos(c.heading + Math.PI / 2) * 2.2;
    this.heading = c.heading;
    this.inCar = false; this.car = null; this.cruiseSpeed = null; this.speed = 0;
  }
  shoot() {
    if (!this.started || this.inCar) return null;
    const from = new THREE.Vector3(this.px, 1.45, this.pz);
    const dir = new THREE.Vector3(Math.sin(this.heading), -0.02, Math.cos(this.heading)).normalize();
    const hit = this.combat.shoot(from, dir, this.people.guards, this.audio);
    this.ammo = this.combat.ammo;
    return hit;
  }
  busted() {
    this.police.clearAll();
    this.wanted = 0;
    this.money = Math.max(0, this.money - 50);
    this.px = CFG.playerStart.x; this.pz = CFG.playerStart.z; this.heading = CFG.playerStart.heading;
    this.inCar = false; this.car = null;
    this.health = 100;
    this.showDialogue(DIALOGUES.busted, 4);
    this.saveNow();
  }
  respawn() {
    this.px = CFG.playerStart.x; this.pz = CFG.playerStart.z; this.heading = CFG.playerStart.heading;
    this.health = 100; this.armor = 25; this.wanted = 0;
    this.money = Math.max(0, this.money - 100);
    this.inCar = false; this.car = null;
    this.police.clearAll();
    this.showDialogue({ who: 'Dario', text: 'Dario: That hurt. Shake it off — Solmar is still out there.' }, 4);
    this.saveNow();
  }
  damagePlayer(amount) {
    let a = amount;
    if (this.armor > 0) { const absorbed = Math.min(this.armor, a * 0.6); this.armor -= absorbed; a -= absorbed; }
    this.health -= a;
    if (this.health <= 0) this.respawn();
  }
  updateGuards(dt) {
    if (!this.guardsSpawned) return;
    for (const gd of this.people.guards) {
      if (gd.dead) { gd.mesh.rotation.x = -Math.PI / 2; gd.mesh.position.y = 0.3; continue; }
      const d = Math.hypot(gd.x - this.px, gd.z - this.pz);
      gd.heading = Math.atan2(this.px - gd.x, this.pz - gd.z);
      gd.mesh.rotation.y = gd.heading;
      if (d < 26 && d > 6) { // close in
        gd.x += Math.sin(gd.heading) * 2.2 * dt;
        gd.z += Math.cos(gd.heading) * 2.2 * dt;
        gd.mesh.position.set(gd.x, 0, gd.z);
      }
      if (d < 30) {
        gd.shootCd -= dt;
        if (gd.shootCd <= 0) {
          gd.shootCd = 1.6 + Math.random() * 1.2;
          this.damagePlayer(6);
          if (this.audio) this.audio.gunshot();
          // tracer from guard to player
          const from = new THREE.Vector3(gd.x, 1.3, gd.z);
          const dir = new THREE.Vector3(this.px - gd.x, 0.1, this.pz - gd.z).normalize();
          const g2 = new THREE.BufferGeometry().setFromPoints([from, from.clone().addScaledVector(dir, d)]);
          const line = new THREE.Line(g2, new THREE.LineBasicMaterial({ color: 0xff8866, transparent: true, opacity: 0.9 }));
          this.scene.add(line);
          setTimeout(() => { this.scene.remove(line); g2.dispose(); }, 150);
        }
      }
    }
  }
  updateDriving(dt) {
    const c = this.car;
    const mv = this.input.move();
    const braking = mv.f < 0;
    if (this.cruiseSpeed !== null) {
      c.speed += clamp(this.cruiseSpeed - c.speed, -10 * dt, 8 * dt);
    } else if (mv.f > 0) {
      c.speed += c.spec.accel * dt;
    } else if (mv.f < 0) {
      if (c.speed > 0.5) c.speed -= 22 * dt; else c.speed -= 8 * dt;
    } else {
      c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 6 * dt);
    }
    c.speed = clamp(c.speed, -8, c.spec.top);
    const turnAuthority = clamp(Math.abs(c.speed) / 8, 0, 1);
    c.heading += mv.t * 1.5 * turnAuthority * dt * Math.sign(c.speed || 1) * -1;
    c.steer = mv.t;
    const nx = c.x + Math.sin(c.heading) * c.speed * dt;
    const nz = c.z + Math.cos(c.heading) * c.speed * dt;
    if (this.city.isBlocked(nx, nz, 1.5)) {
      c.speed *= 0.35; c.condition = Math.max(40, c.condition - 1);
    } else { c.x = nx; c.z = nz; }
    // soft world bounds
    c.x = clamp(c.x, -200, 206); c.z = clamp(c.z, -195, 195);
    // bump traffic cars
    for (const t of this.vehicles.traffic) {
      const d = Math.hypot(t.x - c.x, t.z - c.z);
      if (d < 4 && d > 0.01) {
        const push = (4 - d) * 0.5;
        t.x += ((t.x - c.x) / d) * push; t.z += ((t.z - c.z) / d) * push;
        c.speed *= 0.9;
      }
    }
    c.syncVisual(braking);
    this.px = c.x; this.pz = c.z; this.heading = c.heading; this.speed = c.speed;
    this.moving = Math.abs(c.speed) > 0.5;
    if (this.audio) this.audio.setEngine(clamp(Math.abs(c.speed) / 30, 0, 1), true);
  }
  updateOnFoot(dt) {
    const mv = this.input.move();
    const sprint = this.input.down('ShiftLeft') || this.input.down('ShiftRight');
    const sp = sprint ? 8 : 5;
    this.moving = mv.f !== 0 || mv.t !== 0;
    if (mv.t !== 0) this.heading += mv.t * 1.9 * dt * (mv.f < 0 ? -1 : 1);
    if (mv.f !== 0) {
      const nx = this.px + Math.sin(this.heading) * sp * mv.f * dt;
      const nz = this.pz + Math.cos(this.heading) * sp * mv.f * dt;
      const r = this.city.resolve(nx, nz, 0.6);
      this.px = clamp(r.x, -200, 206); this.pz = clamp(r.z, -195, 195);
      this.walkPhase += dt * sp * 1.6;
    }
    if (this.audio) this.audio.setEngine(0, false);
  }
  updateSky(dt) {
    this.hour = (this.hour + dt / 240) % 24; // full day = 4 min
    const h = this.hour;
    // keyframes: [hour, skyColor, sunIntensity, nightFactor]
    const keys = [
      [0, 0x0d1526, 0.1, 1], [6, 0x0d1526, 0.12, 1], [7, 0xf2a56b, 0.7, 0.25],
      [9, 0x87b5d6, 1.25, 0], [16.5, 0x87b5d6, 1.2, 0], [17.8, 0xe87a9d, 1.15, 0.1],
      [19, 0xc25a7e, 0.45, 0.55], [20, 0x0d1526, 0.12, 1], [24, 0x0d1526, 0.1, 1],
    ];
    let a = keys[0], b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (h >= keys[i][0] && h <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
    }
    const t = b[0] === a[0] ? 0 : clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
    const ca = new THREE.Color(a[1]), cb = new THREE.Color(b[1]);
    ca.lerp(cb, t);
    this.scene.background.copy(ca);
    this.scene.fog.color.copy(ca);
    this.sun.intensity = lerp(a[2], b[2], t);
    this.nightF = lerp(a[3], b[3], t);
    this.city.setNightFactor(this.nightF);
    this.hemi.intensity = 0.9 - this.nightF * 0.55;
    // sun swings west as evening falls
    const ang = ((h - 6) / 12) * Math.PI;
    this.sun.position.set(Math.cos(ang) * 140, 60 + Math.sin(ang) * 90, -40);
  }
  updateCamera(dt) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let dist, height, lookAhead;
    if (this.cameraMode === 'front') {
      dist = -7; height = 2.4; lookAhead = 0;
    } else if (this.inCar) {
      dist = 11; height = 5.5; lookAhead = 9;
    } else {
      dist = 6.5; height = 3.1; lookAhead = 5;
    }
    const tx = this.px - fx * dist, tz = this.pz - fz * dist;
    const k = 1 - Math.exp(-5 * dt);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (height - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camLook.x += (this.px + fx * lookAhead - this.camLook.x) * k;
    this.camLook.y += (1.4 - this.camLook.y) * k;
    this.camLook.z += (this.pz + fz * lookAhead - this.camLook.z) * k;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    // hero headlights at dusk/night
    if (this.inCar && this.car) {
      const on = this.nightF > 0.25;
      this.headlight.intensity = on ? 60 : 0;
      this.headlight.position.set(this.car.x, 1.2, this.car.z);
      this.headlightTarget.position.set(this.car.x + fx * 20, 0.4, this.car.z + fz * 20);
    } else this.headlight.intensity = 0;
  }
  update(dt) {
    if (this.input.mouseClicked && !this.inCar && this.started && !this.paused) this.shoot();
    if (this.inCar) this.updateDriving(dt); else this.updateOnFoot(dt);
    this.missions.update(dt);
    this.police.update(dt, this);
    this.vehicles.updateTraffic(dt, this);
    this.people.update(dt, { x: this.px, z: this.pz, heading: this.heading, walkPhase: this.walkPhase, moving: this.moving, inCar: this.inCar }, this.inCar);
    this.updateGuards(dt);
    this.combat.update(dt);
    this.ammo = this.combat.ammo;
    if (this.audio) this.audio.setSiren(this.wanted >= 2);
    // autosave every 30 s
    this.saveT += dt;
    if (this.saveT >= 30) { this.saveT = 0; this.saveNow(); }
    this.updateSky(dt);
    this.updateCamera(dt);
    this.hud.update(dt, this);
  }
  loop() {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = clamp(dt, 0, 0.1);
    if (this.started && !this.paused) this.update(dt);
    else if (this.started) this.hud.update(0, this);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }
  state() {
    return {
      started: this.started, money: Math.round(this.money), mission: this.mission,
      stage: this.stage, wanted: this.wanted, health: Math.round(this.health),
      armor: Math.round(this.armor), ammo: this.combat.ammo,
      speed: this.inCar && this.car ? Math.round(Math.abs(this.car.speed) * 3.6) : 0,
      inCar: this.inCar, x: +this.px.toFixed(2), z: +this.pz.toFixed(2),
      heading: +this.heading.toFixed(3), hour: +this.hour.toFixed(2),
      guardsAlive: this.people.guards.filter((gd) => !gd.dead).length,
      cruisers: this.police.cruisers.length, cops: this.police.cops.length,
      heli: !!this.police.heli,
    };
  }
  snapshot() { return this.state(); }
}
