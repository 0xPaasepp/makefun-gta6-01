// SOLMAR — the game itself. States: menu / playing / paused / busted /
// wasted. The loop clamps its delta (clock fix) and calls input.endFrame()
// on EVERY frame in EVERY state, so keys never stick across a state change.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildCity, hitsCollider, clampToCity } from './city.js';
import { Traffic, createParkedCars } from './vehicles.js';
import { createPedestrians, createGuards, updatePedestrians, createPersonMesh } from './people.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';

export class Game {
  constructor() {
    this.state = 'menu';
    this.now = 0;
    this.money = CONFIG.player.startMoney;
    this.health = CONFIG.player.health;
    this.armor = CONFIG.player.armor;
    this.gameMinutes = 9 * 60;
    this.saveTimer = 0;
    this.debugFrontCam = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 40, 60);

    this.city = buildCity(this.scene, THREE);
    this.traffic = new Traffic(this.scene, THREE);
    this.parkedCars = createParkedCars(this.scene, THREE);
    this.pedestrians = createPedestrians(this.scene, THREE);
    this.guards = createGuards(this.scene, THREE);

    // Dario Voss — plain WHITE T-SHIRT, dark jeans. Visible in the cover shot.
    this.playerMesh = createPersonMesh(THREE, 0xffffff, { pants: 0x1c2733 });
    this.playerMesh.scale.setScalar(1.05);
    this.scene.add(this.playerMesh);
    this.player = {
      x: CONFIG.spots.playerStart.x,
      z: CONFIG.spots.playerStart.z,
      heading: Math.PI,
      car: null,
    };
    this.playerMesh.position.set(this.player.x, 0, this.player.z);

    this.police = new Police(this.scene, THREE, this);
    this.missions = new Missions((m) => this.onMissionComplete(m));
    this.audio = new AudioEngine();
    this.combat = new Combat(this.scene, this.audio, this);
    this.hud = new Hud();
    this.input = new Input();

    // Mission beacon: yellow cylinder + light, moved to the active marker.
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 14, 14, 1, true),
      new THREE.MeshLambertMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    this.beaconLight = new THREE.PointLight(0xffd23a, 1.2, 30);
    this.scene.add(this.beaconLight);

    // Armor pickup on the plaza: +50 armor, respawns 60 s after pickup.
    this.armorPickup = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.2, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x37d67a, emissive: 0x1a7a3a })
    );
    this.armorPickup.position.set(10, 0.8, 8);
    this.scene.add(this.armorPickup);
    this.armorRespawn = 0;

    this.clock = new THREE.Clock();
    this.camPos = new THREE.Vector3(0, 40, 60);
    this.camLook = new THREE.Vector3(0, 0, 0);
    this.running = true;
    window.addEventListener('resize', () => this.onResize());
    this.hud.showScreen('start');
    this.updateStartButtons();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateStartButtons() {
    const cont = document.getElementById('btn-continue');
    if (cont) cont.classList.toggle('hidden', !hasSave());
  }

  startNew() {
    this.audio.ensure();
    this.resetWorld();
    this.state = 'playing';
    this.hud.showScreen('playing');
    this.hud.setDialogue('Mara: Dario! I need wheels — steal a car and bring it to my garage.', 5);
  }

  startContinue() {
    this.audio.ensure();
    const data = loadGame();
    this.resetWorld();
    if (data) {
      this.money = data.money;
      this.health = data.health;
      this.armor = data.armor;
      this.gameMinutes = data.gameMinutes ?? 540;
      this.player.x = data.player.x;
      this.player.z = data.player.z;
      this.player.heading = data.player.heading ?? Math.PI;
      this.missions.restore({ index: data.mission, stage: data.missionStage, completed: data.completedMissions });
    }
    this.state = 'playing';
    this.hud.showScreen('playing');
    this.hud.setDialogue('Welcome back, Dario.', 3);
  }

  resetWorld() {
    this.money = CONFIG.player.startMoney;
    this.health = CONFIG.player.health;
    this.armor = CONFIG.player.armor;
    this.gameMinutes = 9 * 60;
    this.player.x = CONFIG.spots.playerStart.x;
    this.player.z = CONFIG.spots.playerStart.z;
    this.player.heading = Math.PI;
    this.player.car = null;
    this.playerMesh.visible = true;
    this.police.setWanted(0);
    this.police.cops.splice(0).forEach((c) => this.scene.remove(c.group));
    this.police.cruisers.splice(0).forEach((c) => this.scene.remove(c.group));
    this.saveTimer = 0;
  }

  // ---- events from police / missions / combat ----
  damagePlayer(amount) {
    if (this.state !== 'playing') return;
    let rest = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.health -= rest;
    if (this.health <= 0) {
      this.health = 0;
      this.onWasted();
    }
  }

  onBusted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.money = Math.max(0, this.money - CONFIG.player.bustFine);
    this.police.setWanted(0);
    this.exitCar();
    this.player.x = CONFIG.spots.plaza.x;
    this.player.z = CONFIG.spots.plaza.z + 12;
    this.health = CONFIG.player.health;
    this.hud.showScreen('busted');
    this.autosave();
  }

  onWasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.money = Math.max(0, this.money - CONFIG.player.bustFine);
    this.police.setWanted(0);
    this.exitCar();
    this.player.x = CONFIG.spots.plaza.x;
    this.player.z = CONFIG.spots.plaza.z + 12;
    this.health = CONFIG.player.health;
    this.hud.showScreen('wasted');
    this.autosave();
  }

  onWantedCleared() {
    // Missions.complete() already pays through onMissionComplete — never pay twice.
    this.missions.event('wantedZero');
  }

  onGuardDown(guard) {
    this.hud.setDialogue('Guard down. Keep moving, Dario.', 2.5);
  }

  onMissionComplete(m) {
    this.payReward(m);
  }

  payReward(m) {
    this.money += m.reward;
    this.audio.blip(990, 0.12, 'square', 0.2);
    setTimeout(() => this.audio.blip(1320, 0.18, 'square', 0.2), 140);
    const next = this.missions.current;
    this.hud.setDialogue(
      next ? `${m.title} complete — +$${m.reward}. Next: ${next.title}.` : `${m.title} complete — +$${m.reward}. All missions done!`,
      5
    );
    this.autosave();
  }

  shootTargets() {
    return [...this.guards, ...this.pedestrians];
  }

  // ---- interaction ----
  nearestParkedCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.parkedCars) {
      if (c.isPlayer) continue;
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  enterCar(car) {
    this.player.car = car;
    car.isPlayer = true;
    this.playerMesh.visible = false;
    this.player.x = car.x;
    this.player.z = car.z;
    this.player.heading = car.heading;
    this.audio.blip(660, 0.08, 'square', 0.12);
    if (car.occupied) {
      this.police.addWanted(1);
      this.audio.alarm();
      this.hud.setDialogue('Car alarm! Someone saw you steal it.', 3);
    }
    if (car.isMissionCar) {
      this.missions.event('neonTaken');
      this.police.setWanted(Math.max(3, this.police.wanted));
      this.hud.setDialogue('Kito: That Neon Sport is hot — lose the cops!', 4);
    } else {
      // 'carEntered' only advances the stage in mission 1; the reward is
      // paid by onMissionComplete when the delivery completes.
      this.missions.event('carEntered');
    }
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.isPlayer = false;
    car.speed = 0;
    this.player.car = null;
    this.player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2;
    this.player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2;
    this.player.heading = car.heading;
    this.playerMesh.visible = true;
  }

  // ---- per-frame ----
  loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this.loop());
    // Clamped delta: a hitch can never teleport the simulation.
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.now += dt;
    try {
      if (this.state === 'playing') this.updatePlaying(dt);
      else if (this.state === 'menu') this.updateMenu(dt);
      else this.updateOverlay(dt);
    } finally {
      // Always consumed, in every state — a key can never stick.
      this.input.endFrame();
    }
    this.renderer.render(this.scene, this.camera);
  }

  updateMenu(dt) {
    // Slow orbit around the plaza while the start screen is up.
    const t = this.now * 0.08;
    this.camera.position.set(Math.sin(t) * 55, 26, Math.cos(t) * 55);
    this.camera.lookAt(0, 2, 0);
    this.traffic.update(dt);
    updatePedestrians(this.pedestrians, dt);
    if (this.input.wasPressed('Enter')) this.startNew();
  }

  updateOverlay(dt) {
    // Paused / busted / wasted: world frozen, but P must still unpause.
    if (this.state === 'paused' && this.input.wasPressed('p', 'P', 'Escape')) {
      this.state = 'playing';
      this.hud.showScreen('playing');
    }
    if ((this.state === 'busted' || this.state === 'wasted') && this.input.wasPressed('Enter')) {
      this.state = 'playing';
      this.hud.showScreen('playing');
    }
    this.combat.update(dt);
  }

  updatePlaying(dt) {
    // Pause toggles BOTH ways on P (attempt-2 fix: P could never unpause).
    if (this.input.wasPressed('p', 'P', 'Escape')) {
      this.state = 'paused';
      this.hud.showScreen('pause');
      return;
    }
    if (this.input.wasPressed('m', 'M')) {
      const on = this.audio.toggleMusic();
      this.hud.setDialogue(on ? 'Radio on.' : 'Radio off.', 1.5);
    }
    this.gameMinutes += dt;

    // Movement.
    if (this.player.car) this.updateDriving(dt);
    else this.updateOnFoot(dt);

    // Interact.
    if (this.input.wasPressed('e', 'E')) {
      if (this.player.car) this.exitCar();
      else {
        const car = this.nearestParkedCar(4.5);
        if (car) this.enterCar(car);
      }
    }
    // Shoot (on foot).
    if (!this.player.car && (this.input.wasPressed(' ', 'f', 'F') || this.input.wasPressed('mouse'))) {
      const from = new THREE.Vector3(this.player.x, 1.4, this.player.z);
      const dir = new THREE.Vector3(Math.sin(this.player.heading), 0, Math.cos(this.player.heading));
      this.combat.shoot(from, dir);
    }

    // World.
    this.traffic.update(dt);
    updatePedestrians(this.pedestrians, dt);
    this.police.update(dt, this.now);
    this.combat.update(dt);
    this.audio.setEngine(this.player.car ? Math.abs(this.player.car.speed) / this.player.car.model.topSpeed : 0);

    // Mission checks.
    const marker = this.missions.marker();
    if (marker) {
      this.beacon.visible = true;
      this.beacon.position.set(marker.x, 7, marker.z);
      this.beaconLight.position.set(marker.x, 8, marker.z);
      const d = Math.hypot(this.player.x - marker.x, this.player.z - marker.z);
      if (this.missions.index === 0 && this.missions.stage === 'deliver' && this.player.car && d < 6) {
        const done = this.missions.event('delivered');
        if (done) {
          // payReward already ran inside onMissionComplete — just celebrate.
          this.hud.setDialogue('Mara: Perfect! Here is your $500, Dario.', 4);
          this.exitCar();
        }
      }
      if (this.missions.index === 2 && d < 4.5) {
        const done = this.missions.event('cashGrabbed');
        if (done) this.hud.setDialogue('Kito: $3,500! The Vane family will be furious. Run!', 5);
      }
    } else {
      this.beacon.visible = false;
    }

    // Armor pickup on the plaza.
    if (this.armorPickup.visible) {
      this.armorPickup.rotation.y += dt;
      const ad = Math.hypot(this.player.x - 10, this.player.z - 8);
      if (ad < 2.2) {
        this.armor = Math.min(100, this.armor + 50);
        this.armorPickup.visible = false;
        this.armorRespawn = 60;
        this.audio.blip(1200, 0.15, 'sine', 0.2);
        this.hud.setDialogue('Picked up body armor (+50).', 2.5);
      }
    } else if (this.armorRespawn > 0) {
      this.armorRespawn -= dt;
      if (this.armorRespawn <= 0) this.armorPickup.visible = true;
    }

    // Prompt.
    let prompt = '';
    if (!this.player.car) {
      const car = this.nearestParkedCar(4.5);
      if (car) prompt = car.occupied ? 'Press E to steal this car (occupied!)' : 'Press E to get in the car';
    } else {
      prompt = 'Press E to get out  •  W/S drive  •  A/D steer';
    }
    if (this.missions.index === 2 && this.missions.stage === 'gotoDocks') {
      const d = Math.hypot(this.player.x - CONFIG.spots.cashCrates.x, this.player.z - CONFIG.spots.cashCrates.z);
      if (d < 12) prompt = 'Grab the cash — reach the crates!';
    }

    // Autosave.
    this.saveTimer += dt;
    if (this.saveTimer > CONFIG.autosaveSeconds) {
      this.saveTimer = 0;
      this.autosave();
    }

    // Camera + HUD.
    this.updateCamera(dt);
    this.hud.update(
      {
        money: this.money,
        health: this.health,
        armor: this.armor,
        wanted: this.police.wanted,
        gameMinutes: this.gameMinutes,
        missionTitle: this.missions.title(),
        missionText: this.missions.text(),
        prompt,
        player: { x: this.player.x, z: this.player.z, heading: this.player.heading },
        inCar: !!this.player.car,
        speedKmh: this.player.car ? Math.abs(this.player.car.speed) * 3.6 : 0,
        missionMarker: marker,
        cops: this.police.cops,
        cruisers: this.police.cruisers,
        traffic: this.traffic.cars,
        guards: this.guards,
        now: this.now,
      },
      dt
    );
  }

  updateOnFoot(dt) {
    const mv = this.input.moveVector();
    const run = this.input.isDown('Shift');
    const speed = run ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
    if (mv.x !== 0 || mv.y !== 0) {
      // Camera-relative movement: camera looks along the player heading.
      // Screen-right is (-cos h, sin h) in world space (three.js camera).
      const camYaw = this.player.heading;
      const fx = Math.sin(camYaw);
      const fz = Math.cos(camYaw);
      const rx = -Math.cos(camYaw);
      const rz = Math.sin(camYaw);
      const dx = fx * mv.y + rx * mv.x;
      const dz = fz * mv.y + rz * mv.x;
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - this.player.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.player.heading += Math.max(-10 * dt, Math.min(10 * dt, dh));
      const nx = this.player.x + Math.sin(this.player.heading) * speed * dt;
      const nz = this.player.z + Math.cos(this.player.heading) * speed * dt;
      this.moveWithCollision(nx, nz, 0.5);
    }
    this.playerMesh.position.set(this.player.x, Math.abs(Math.sin(this.now * 9)) * 0.04, this.player.z);
    this.playerMesh.rotation.y = this.player.heading;
  }

  updateDriving(dt) {
    const car = this.player.car;
    const fwd = this.input.isDown('w', 'ArrowUp');
    const back = this.input.isDown('s', 'ArrowDown');
    const left = this.input.isDown('a', 'ArrowLeft');
    const right = this.input.isDown('d', 'ArrowRight');
    if (fwd) car.speed += car.model.accel * dt;
    else if (back) car.speed -= car.model.accel * 0.7 * dt;
    else car.speed *= Math.max(0, 1 - 1.2 * dt);
    car.setBraking(back && car.speed > 0.5);
    car.speed = Math.max(-10, Math.min(car.model.topSpeed, car.speed));
    if (Math.abs(car.speed) > 0.2) {
      const steer = (left ? 1 : 0) - (right ? 1 : 0);
      car.heading += steer * 1.9 * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 8);
    }
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const hit = hitsCollider(nx, nz, 1.6, this.city.colliders);
    const clamped = clampToCity(nx, nz);
    if (!hit && clamped.x === nx && clamped.z === nz) {
      car.x = nx;
      car.z = nz;
    } else {
      car.speed *= 0.4;
    }
    this.player.x = car.x;
    this.player.z = car.z;
    this.player.heading = car.heading;
    car.sync();
  }

  moveWithCollision(nx, nz, r) {
    const clamped = clampToCity(nx, nz);
    nx = clamped.x;
    nz = clamped.z;
    // Axis-separated: try x, then z, so the player slides along walls.
    if (!hitsCollider(nx, this.player.z, r, this.city.colliders)) this.player.x = nx;
    if (!hitsCollider(this.player.x, nz, r, this.city.colliders)) this.player.z = nz;
  }

  updateCamera(dt) {
    const p = this.player;
    let dist = p.car ? 12 : 7.5;
    let height = p.car ? 5 : 3.6;
    let tx;
    let tz;
    let lx;
    let lz;
    if (this.debugFrontCam && !p.car) {
      // Front shot: camera ahead of the player, looking back at them, so
      // the white t-shirt is clearly visible.
      tx = p.x + Math.sin(p.heading) * 5.5;
      tz = p.z + Math.cos(p.heading) * 5.5;
      lx = p.x;
      lz = p.z;
      height = 2.2;
    } else {
      tx = p.x - Math.sin(p.heading) * dist;
      tz = p.z - Math.cos(p.heading) * dist;
      lx = p.x + Math.sin(p.heading) * 6;
      lz = p.z + Math.cos(p.heading) * 6;
    }
    const k = 1 - Math.exp(-6 * dt);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camPos.y += (height - this.camPos.y) * k;
    this.camLook.x += (lx - this.camLook.x) * k;
    this.camLook.z += (lz - this.camLook.z) * k;
    this.camLook.y += (1.4 - this.camLook.y) * k;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  autosave() {
    saveGame({
      money: this.money,
      health: this.health,
      armor: this.armor,
      mission: this.missions.index,
      missionStage: this.missions.stage,
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading },
      gameMinutes: this.gameMinutes,
      completedMissions: this.missions.completed,
    });
  }

  snapshot() {
    return {
      state: this.state,
      money: this.money,
      health: this.health,
      armor: this.armor,
      wanted: this.police.wanted,
      mission: this.missions.index,
      stage: this.missions.stage,
      missionTitle: this.missions.title(),
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading },
      inCar: !!this.player.car,
      speed: this.player.car ? this.player.car.speed : 0,
      carModel: this.player.car ? this.player.car.model.id : null,
      chase: this.police.chaseState,
      cops: this.police.cops.length,
      cruisers: this.police.cruisers.length,
      gameMinutes: this.gameMinutes,
    };
  }
}
