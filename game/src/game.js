// SOLMAR game core — renderer (ACES, env map, clearcoat, fog, shadows),
// day/night cycle, third-person camera, player + car control, wanted,
// collision, autosave, debug API used by playtests and screenshots.
import * as THREE from 'three';
import { WORLD, PARKED_CARS, DIALOGUES, START_MONEY } from './config.js';
import { buildCity } from './city.js';
import { Car, TrafficCar } from './vehicles.js';
import { Pedestrians, buildPersonMesh } from './people.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { SaveSys } from './save.js';
import { makeRng } from './rng.js';

export class Game {
  constructor() {
    this.started = false; this.paused = false;
    this.money = START_MONEY;
    this.health = 100; this.armor = 0;
    this.wanted = 0; this.wantedT = 0; this.unseenT = 0;
    this.px = 0; this.pz = 12; this.heading = Math.PI;
    this.vy = 0; this.onGround = true;
    this.timeOfDay = 480; // minutes, 08:00 start
    this.currentCar = null;
    this.cars = []; this.traffic = [];
    this.fps = 0; this._frames = 0; this._fpsT = 0;
    this.realFps = 0; this._realFrames = 0; this._realT = performance.now();
    this.quality = 0; // 0 full, 1 no shadows, 2 low pixel ratio
    this.saveT = 0;
    this.camYaw = 0; this.camPitch = 0.32; this.camDist = 9;
    this._lastT = performance.now();
  }

  init() {
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfd9e8, 120, 420);
    this.camera = new THREE.PerspectiveCamera(62, 2, 0.1, 900);
    // environment map: PMREM from a tiny gradient sky scene (no external files)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x87b5d6);
    const skyTop = new THREE.Mesh(new THREE.SphereGeometry(50, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x9fd0ee, side: THREE.BackSide }));
    envScene.add(skyTop);
    const sunBall = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
    sunBall.position.set(20, 30, -30); envScene.add(sunBall);
    this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
    // sun + sky light
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -70; this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70; this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.camera.far = 320;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
    this.scene.add(this.hemi);
    // world
    this.city = buildCity(this.scene);
    this.colliders = this.city.colliders;
    // parked cars
    for (const p of PARKED_CARS) {
      const car = new Car(this.scene, p.model, p.x, p.z, p.angle, { parked: true });
      this.cars.push(car);
    }
    // traffic on road loops
    const R = makeRng(31337);
    const models = ['sedan', 'hatch', 'taxi', 'pickup', 'van'];
    for (let i = 0; i < 16; i++) {
      const vertical = i % 2 === 0;
      const road = WORLD.roads[i % WORLD.roads.length];
      const t = new TrafficCar(this.scene, models[i % models.length],
        vertical ? road : R.range(-140, 140), vertical ? R.range(-140, 140) : road,
        vertical ? (i % 4 < 2 ? 0 : Math.PI) : (i % 4 < 2 ? Math.PI / 2 : -Math.PI / 2));
      const loop = [];
      for (let s = -140; s <= 140; s += 70) {
        loop.push(vertical ? { x: road, z: s } : { x: s, z: road });
      }
      t.setRoute(loop);
      this.traffic.push(t);
      this.cars.push(t);
    }
    // people
    this.peds = new Pedestrians(this.scene);
    this.police = new Police(this.scene);
    this.missions = new Missions(this.scene, this);
    this.combat = new Combat(this.scene, this);
    this.hud = new HUD(this);
    this.input = new Input(this);
    this.audio = new AudioSys();
    this.save = new SaveSys(this);
    // player mesh — white t-shirt
    this.playerMesh = buildPersonMesh({ shirt: 0xffffff, pants: 0x2c3e50, skin: 0xe8b98a, hair: 0x1a1a1a });
    this.playerMesh.position.set(this.px, 0, this.pz);
    this.scene.add(this.playerMesh);
    this.hud.setMissionText(this.missions.missionText());
    this.resize();
    addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.tick());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- collision: circle vs AABB, returns corrected pos or null ----
  resolve(x, z, r) {
    for (const c of this.colliders) {
      const cx = Math.max(c.x - c.hw, Math.min(x, c.x + c.hw));
      const cz = Math.max(c.z - c.hd, Math.min(z, c.z + c.hd));
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.01;
        return { x: cx + (dx / d) * r, z: cz + (dz / d) * r, hit: true };
      }
    }
    return null;
  }

  start(newGame = true) {
    if (newGame) {
      this.money = START_MONEY; this.health = 100; this.armor = 0;
      this.wanted = 0; this.px = 0; this.pz = 12; this.heading = Math.PI;
      this.missions.setIndex(0);
      this.timeOfDay = 480;
    }
    this.started = true; this.paused = false;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    document.getElementById('touch-ui').style.display = 'block';
    this.audio.ensure();
    if (newGame) this.hud.showDialogue(DIALOGUES.intro.who, DIALOGUES.intro.text, 8);
  }
  startNew() { this.start(true); }
  continueGame() {
    const d = this.save.load();
    this.start(false);
    if (d) this.save.apply(d);
    this.hud.showDialogue('SOLMAR', 'Welcome back, Dario. The city kept your money warm.');
  }
  togglePause() {
    if (!this.started) return;
    this.paused = !this.paused;
    document.getElementById('pause-overlay').style.display = this.paused ? 'flex' : 'none';
  }
  saveNow() { return this.save.save(); }
  addMoney(n) { this.money += n; this.audio.pickup(); }
  setMoney(n) { this.money = n; }
  setWanted(n) { this.wanted = Math.max(0, Math.min(5, n)); this.unseenT = 0; }
  setTimeOfDay(hours) { this.timeOfDay = ((hours % 24) + 24) % 24 * 60; this.updateSun(); }
  setMission(i) { this.missions.setIndex(i); }
  setSpeed(s) { if (this.currentCar) this.currentCar.speed = s; }
  damagePlayer(n) {
    if (this.armor > 0) { const a = Math.min(this.armor, n); this.armor -= a; n -= a; }
    this.health = Math.max(0, this.health - n);
    if (this.health <= 0) this.onBusted(true);
  }
  onBusted(dead = false) {
    this.money = Math.max(0, this.money - 200);
    this.health = 100; this.armor = 0;
    if (this.currentCar) this.exitCar();
    this.px = 0; this.pz = 12; this.heading = Math.PI;
    this.playerMesh.position.set(this.px, 0, this.pz);
    this.setWanted(0);
    this.police.clearAll(this.scene);
    this.hud.showDialogue(DIALOGUES.busted.who, DIALOGUES.busted.text, 7);
    this.saveNow();
  }
  jump() {
    if (this.currentCar || !this.onGround) return;
    this.vy = 7; this.onGround = false;
  }

  nearestCar(maxD = 4.5) {
    let best = null, bd = maxD;
    for (const c of this.cars) {
      if (c instanceof TrafficCar) continue; // traffic is moving; steal parked only
      const d = Math.hypot(c.x - this.px, c.z - this.pz);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  tryEnterCar() {
    if (!this.started || this.paused) return;
    if (this.currentCar) { this.exitCar(); return; }
    const car = this.nearestCar();
    if (!car) return;
    this.currentCar = car;
    car.parked = false; car.occupied = true;
    this.heading = car.heading;
    this.playerMesh.visible = false;
    this.audio.ensure();
    if (car.model === 'sport' && this.missions.index === 1) {
      // M2 pickup handled in missions update; wanted set there
    } else if (car.alarm !== true && this.missions.index !== 0) {
      // stealing outside M1 draws a little heat the first time
    }
    if (this.missions.index === 0 && this.missions.stage === 'steal') {
      this.hud.flash('Deliver the car to Mara\'s garage!');
    }
  }
  enterNearestCar() { this.tryEnterCar(); }
  exitCar() {
    if (!this.currentCar) return;
    const car = this.currentCar;
    this.currentCar = null;
    car.occupied = false;
    this.px = car.x - Math.sin(car.heading) * 2.6;
    this.pz = car.z - Math.cos(car.heading) * 2.6;
    this.heading = car.heading;
    this.playerMesh.visible = true;
    this.playerMesh.position.set(this.px, 0, this.pz);
  }
  teleport(x, z) {
    if (this.currentCar) {
      this.currentCar.x = x; this.currentCar.z = z;
      this.currentCar.mesh.position.set(x, 0, z);
    }
    this.px = x; this.pz = z;
    this.playerMesh.position.set(x, 0, z);
  }
  setHeading(h) {
    this.heading = h;
    if (this.currentCar) {
      this.currentCar.heading = h;
      this.currentCar.mesh.rotation.y = h;
    }
  }
  aimAt(x, z) {
    this.combat.aimX = x; this.combat.aimZ = z;
    this._aimLockT = 2.5; // debug aim sticks for 2.5 sim-seconds (tick auto-aim resumes after)
  }
  shoot() { this.combat.shoot(); }
  showDialogue(text, who = 'SOLMAR') { this.hud.showDialogue(who, text); }
  faceCamera() {
    // put the camera in front of the player, looking at them (for screenshots)
    const f = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    this.camera.position.set(this.px + f.x * 6, 2.2, this.pz + f.z * 6);
    this.camera.lookAt(this.px, 1.4, this.pz);
    this._faceCam = true;
  }
  followCamera() { this._faceCam = false; }

  tick() {
    const now = performance.now();
    let dt = Math.min(0.05, (now - this._lastT) / 1000);
    this._lastT = now;
    if (!this.started || this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    // FPS meter (sim-time) + adaptive quality on REAL frame rate:
    // SwiftShader / weak GPUs drop shadows, then pixel ratio.
    this._frames++; this._fpsT += dt;
    if (this._fpsT >= 1) { this.fps = this._frames; this._frames = 0; this._fpsT = 0; }
    this._realFrames++;
    const realNow = performance.now();
    if (realNow - this._realT >= 4000) {
      this.realFps = this._realFrames / ((realNow - this._realT) / 1000);
      this._realFrames = 0; this._realT = realNow;
      if (this.realFps < 12 && this.quality === 0) {
        this.quality = 1; this.sun.castShadow = false;
      } else if (this.realFps < 8 && this.quality === 1) {
        this.quality = 2; this.renderer.setPixelRatio(0.66);
      }
    }
    // day/night: 1 game-hour per 150 real seconds
    this.timeOfDay = (this.timeOfDay + dt * (60 / 150)) % 1440;
    this.updateSun();
    const input = this.input.state;
    const cam = this.input.consumeCamera();
    this.camYaw -= cam.yaw;
    this.camPitch = Math.max(0.08, Math.min(1.1, this.camPitch + cam.pitch));
    if (this.currentCar) {
      this.currentCar.update(dt, input, this.colliders, (x, z, r) => this.resolve(x, z, r));
      this.px = this.currentCar.x; this.pz = this.currentCar.z;
      this.heading = this.currentCar.heading;
      this.audio.engine(this.currentCar.speed, true, this.currentCar.gear);
      if (Math.abs(this.currentCar.speed) > 20 && (input.left || input.right)) this.audio.noise(0.1, 0.06, 1200);
    } else {
      const sp = (input.sprint ? 9 : 5) * dt;
      const f = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
      const r = { x: Math.cos(this.heading), z: -Math.sin(this.heading) };
      let mx = 0, mz = 0;
      if (input.forward) { mx += f.x; mz += f.z; }
      if (input.back) { mx -= f.x; mz -= f.z; }
      if (input.left) { mx -= r.x; mz -= r.z; }
      if (input.right) { mx += r.x; mz += r.z; }
      const ml = Math.hypot(mx, mz);
      if (ml > 0) {
        mx /= ml; mz /= ml;
        let nx = this.px + mx * sp, nz = this.pz + mz * sp;
        nx = Math.max(-232, Math.min(204, nx));
        nz = Math.max(-232, Math.min(232, nz));
        const hit = this.resolve(nx, nz, 0.6);
        if (hit) { nx = hit.x; nz = hit.z; }
        this.px = nx; this.pz = nz;
        this.heading = Math.atan2(mx, mz);
        const swing = Math.sin(now * 0.014) * (input.sprint ? 0.8 : 0.55);
        this.playerMesh.userData.arms[0].rotation.x = swing;
        this.playerMesh.userData.arms[1].rotation.x = -swing;
        this.playerMesh.userData.legs[0].rotation.x = -swing;
        this.playerMesh.userData.legs[1].rotation.x = swing;
      }
      // gravity / jump
      if (!this.onGround) {
        this.vy -= 22 * dt;
        const y = this.playerMesh.position.y + this.vy * dt;
        if (y <= 0) { this.playerMesh.position.y = 0; this.vy = 0; this.onGround = true; }
        else this.playerMesh.position.y = y;
      }
      this.playerMesh.position.set(this.px, this.playerMesh.position.y, this.pz);
      this.playerMesh.rotation.y = this.heading;
      this.audio.engine(0, false, 1);
    }
    // aim follows camera forward when shooting on foot (unless debug aim locked)
    if (!this.currentCar) {
      this._aimLockT = Math.max(0, (this._aimLockT || 0) - dt);
      if (!this._aimLockT) {
        this.combat.aimX = this.px + Math.sin(this.heading) * 20;
        this.combat.aimZ = this.pz + Math.cos(this.heading) * 20;
      }
    }
    // traffic + peds + police + missions + combat
    for (const t of this.traffic) t.updateTraffic(dt, this.city.trafficLights, (x, z, r) => this.resolve(x, z, r));
    this.peds.update(dt, { x: this.px, z: this.pz }, this.wanted);
    this.police.update(dt, this.wanted, this.px, this.pz, !!this.currentCar, this.currentCar,
      () => this.onBusted(false));
    this.missions.update(dt);
    this.combat.update(dt);
    this.city.update(dt);
    // wanted decay when unseen (no cops within 30u)
    const copNear = this.police.cruisers.some((c) => Math.hypot(c.x - this.px, c.z - this.pz) < 30)
      || this.police.footCops.some((c) => Math.hypot(c.x - this.px, c.z - this.pz) < 20)
      || !!this.police.heli;
    if (this.wanted > 0) {
      if (!copNear) {
        this.unseenT += dt;
        if (this.unseenT > 12) { this.wanted--; this.unseenT = 0; }
      } else this.unseenT = 0;
    }
    // radio + autosave
    this.audio.radio(dt);
    this.saveT += dt;
    if (this.saveT > 30) { this.saveT = 0; this.saveNow(); }
    // camera follow
    if (!this._faceCam) {
      const cy = this.heading + this.camYaw;
      const cx = this.px - Math.sin(cy) * this.camDist;
      const cz = this.pz - Math.cos(cy) * this.camDist;
      const ch = 3.2 + this.camPitch * 6;
      this.camera.position.lerp(new THREE.Vector3(cx, ch, cz), Math.min(1, dt * 6));
      this.camera.lookAt(this.px, 1.5, this.pz);
    }
    // shadow camera follows the player
    this.sun.position.set(this.px + 60, 90, this.pz + 40);
    this.sun.target.position.set(this.px, 0, this.pz);
    this.hud.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateSun() {
    // timeOfDay minutes -> sun angle; 06:00 sunrise, 18:00 sunset
    const t = this.timeOfDay / 60; // hours
    const dayF = Math.max(0, Math.sin(((t - 6) / 12) * Math.PI)); // 0 night, 1 noon
    const night = dayF < 0.12;
    const warm = new THREE.Color(0xff9a4d), noon = new THREE.Color(0xfff1d6);
    this.sun.color.copy(noon).lerp(warm, 1 - Math.min(1, dayF * 2));
    this.sun.intensity = 0.25 + dayF * 2.4;
    this.hemi.intensity = 0.25 + dayF * 0.7;
    const skyDay = new THREE.Color(0x8ec9ee), skyNight = new THREE.Color(0x0b1626);
    const sky = skyNight.clone().lerp(skyDay, dayF);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    this.city.setNight(night);
    this.renderer.toneMappingExposure = 1.05 + dayF * 0.15;
  }

  state() {
    return {
      started: this.started, money: this.money, mission: this.missions.index,
      wanted: this.wanted, inCar: !!this.currentCar, health: this.health,
      speed: this.currentCar ? this.currentCar.speed : 0,
      px: this.px, pz: this.pz, fps: this.fps, realFps: Math.round(this.realFps), quality: this.quality, timeOfDay: this.timeOfDay,
    };
  }
}
