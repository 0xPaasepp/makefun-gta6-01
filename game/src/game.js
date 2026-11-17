// game.js — the game itself: player on foot and in cars, third-person camera,
// mission wiring, wanted/police/combat glue, toasts, pause/busted/wasted,
// and the ?shot= modes the screenshot runs use to stage a scene.

import * as THREE from 'three';
import { WORLD, PLAYER, CAR, WANTED, MISSIONS, STORY_END, STREET_NAMES } from './config.js';
import { mulberry32, clamp, angleLerp, dist2 } from './rng.js';
import { City, isRoad } from './city.js';
import { Traffic, Car } from './vehicles.js';
import { Crowd } from './people.js';
import { Police } from './police.js';
import { MissionManager, STORY_END as STORY } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { saveGame, loadGame } from './save.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'game';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.clock = new THREE.Clock();

    this.city = new City(this.scene);
    this.traffic = new Traffic(this.scene, this.city);
    this.crowd = new Crowd(this.scene, this.city);
    this.police = new Police(this.scene, this.city, this.crowd);
    this.missions = new MissionManager(this.scene);
    this.combat = new Combat(this.scene, this.camera);
    this.hud = new HUD();
    this.input = new Input(this.renderer.domElement);
    this.audio = new AudioEngine();

    // Player state.
    this.player = {
      x: PLAYER.startPos.x, z: PLAYER.startPos.z, heading: Math.PI,
      health: PLAYER.maxHealth, money: PLAYER.startMoney,
      inCar: null, speed: 0, onFootSpeed: 0,
    };
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 9;
    this.state = 'menu'; // menu | playing | paused | busted | dead
    this.missionIndex = 0;
    this.storyDone = false;
    this.minutes = 9 * 60;
    this.stealCooldown = 0;
    this.bustTimer = 0;
    this.lastSaveAt = 0;
    this.shotMode = new URLSearchParams(location.search).get('shot') || null;
    this.readyFlag = false;

    this.buildPlayerMesh();
    this.missions.scatterCash(10, mulberry32(99));
    this.bindMenuButtons();
    this.setupResize();
    this.applyShotMode();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  buildPlayerMesh() {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const jacket = new THREE.MeshLambertMaterial({ color: 0xff5a3c });
    const pants = new THREE.MeshLambertMaterial({ color: 0x223344 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.85, 0.26), pants);
    legs.position.y = 0.43; legs.castShadow = true;
    g.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.64, 0.32), jacket);
    torso.position.y = 1.16; torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
    head.position.y = 1.73; head.castShadow = true;
    g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x1a1210 }));
    hair.position.y = 1.78;
    g.add(hair);
    const armGeo = new THREE.BoxGeometry(0.14, 0.62, 0.14);
    this.armL = new THREE.Mesh(armGeo, jacket);
    this.armL.position.set(-0.38, 1.15, 0);
    g.add(this.armL);
    this.armR = new THREE.Mesh(armGeo, jacket);
    this.armR.position.set(0.38, 1.15, 0);
    g.add(this.armR);
    // pistol in the right hand
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    gun.position.set(0.38, 0.95, 0.25);
    g.add(gun);
    this.playerMesh = g;
    this.scene.add(g);
    this.walkPhase = 0;
  }

  bindMenuButtons() {
    const $ = (id) => document.getElementById(id);
    $('btnNew').onclick = () => { this.audio.ensure(); this.newGame(); };
    $('btnContinue').onclick = () => { this.audio.ensure(); this.continueGame(); };
    $('btnHow').onclick = () => $('howPanel').classList.toggle('hidden');
    $('btnResume').onclick = () => this.resume();
    $('btnSaveQuit').onclick = () => { this.doSave(); this.quitToMenu(); };
    $('btnBusted').onclick = () => this.afterBusted();
    $('btnDead').onclick = () => this.afterDead();
    // refresh the Continue button if a save exists
    const save = loadGame();
    if (save) {
      $('btnContinue').classList.remove('hidden');
      $('continueInfo').textContent = `Mission ${Math.min(save.missionIndex + 1, 3)}/3 · $${Math.floor(save.money)}`;
    }
  }

  setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // --- Game flow ------------------------------------------------------------
  newGame() {
    this.player.money = PLAYER.startMoney;
    this.player.health = PLAYER.maxHealth;
    this.player.x = PLAYER.startPos.x;
    this.player.z = PLAYER.startPos.z;
    this.player.heading = Math.PI;
    this.missionIndex = 0;
    this.storyDone = false;
    this.minutes = 9 * 60;
    this.police.clearAll();
    this.missions.startMission(0);
    this.startPlaying();
    this.hud.dialog('Mara', MISSIONS[0].briefing, 9000);
    this.hud.toast('MISSION 1 — FIRST WHEELS', 'Steal a car and bring it to Mara\'s Garage', 4000);
    this.hud.hint('WASD to move · E near a car to steal it · drag mouse to look');
  }

  continueGame() {
    const save = loadGame();
    if (!save) { this.newGame(); return; }
    this.player.money = save.money;
    this.player.health = save.health;
    this.player.x = save.player.x;
    this.player.z = save.player.z;
    this.player.heading = save.player.heading;
    this.missionIndex = save.missionIndex;
    this.storyDone = save.storyDone;
    this.minutes = save.minutes || 9 * 60;
    this.police.clearAll();
    if (save.wanted > 0) this.police.setStars(save.wanted);
    if (this.missionIndex < MISSIONS.length) this.missions.startMission(this.missionIndex);
    else this.missions.missionIndex = MISSIONS.length;
    this.missions.stepIndex = save.stepIndex || 0;
    this.startPlaying();
    this.hud.toast('WELCOME BACK TO SOLMAR', this.missionIndex < 3 ? MISSIONS[this.missionIndex].title : 'Free roam — the city is yours', 3500);
  }

  startPlaying() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('bustedScreen').classList.add('hidden');
    document.getElementById('deadScreen').classList.add('hidden');
    this.hud.show();
    this.state = 'playing';
    this.refreshObjective();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.doSave();
    document.getElementById('pauseStats').innerHTML =
      `💰 $${Math.floor(this.player.money)} &nbsp;·&nbsp; ${this.missionIndex < 3 ? MISSIONS[this.missionIndex].title : 'Story complete'}<br>` +
      `❤️ Health ${Math.round(this.player.health)} &nbsp;·&nbsp; ⭐ Wanted ${this.police.stars}<br>` +
      `📍 ${this.city.streetNameAt(this.player.x, this.player.z)} — progress saved.`;
    document.getElementById('pauseScreen').classList.remove('hidden');
  }

  resume() {
    document.getElementById('pauseScreen').classList.add('hidden');
    this.state = 'playing';
  }

  quitToMenu() {
    this.state = 'menu';
    this.hud.hide();
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
    const save = loadGame();
    if (save) {
      document.getElementById('btnContinue').classList.remove('hidden');
      document.getElementById('continueInfo').textContent = `Mission ${Math.min(save.missionIndex + 1, 3)}/3 · $${Math.floor(save.money)}`;
    }
  }

  doSave() {
    saveGame({
      money: this.player.money, health: this.player.health,
      missionIndex: this.missions.missionIndex, stepIndex: this.missions.stepIndex,
      wanted: this.police.stars,
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading },
      minutes: this.minutes, storyDone: this.storyDone,
    });
  }

  afterBusted() {
    this.player.money = Math.max(0, this.player.money - 300);
    this.player.health = 100;
    this.player.x = PLAYER.startPos.x; this.player.z = PLAYER.startPos.z;
    this.police.clearAll();
    document.getElementById('bustedScreen').classList.add('hidden');
    this.state = 'playing';
    this.hud.toast('OUT ON BAIL', 'Back on the streets. Stay sharp.', 3000);
  }

  afterDead() {
    this.player.money = Math.max(0, this.player.money - 200);
    this.player.health = 100;
    this.player.x = PLAYER.startPos.x; this.player.z = PLAYER.startPos.z;
    this.police.clearAll();
    document.getElementById('deadScreen').classList.add('hidden');
    this.state = 'playing';
    this.hud.toast('PATCHED UP', 'Mara sends her regards. And the bill.', 3000);
  }

  refreshObjective() {
    const m = this.missions;
    if (m.finished) {
      this.hud.setObjective('SOLMAR — FREE ROAM', 'The city is yours', 'Grab cash, steal cars, dodge the police. Story complete.');
      return;
    }
    const step = m.step;
    if (!step) return;
    this.hud.setObjective(m.mission.title, step.text, step.sub);
  }

  // --- Screenshot staging ---------------------------------------------------
  // ?shot=1..4 stages a real gameplay moment (no fake images: the game itself
  // runs and the browser screenshots it). Also used by the playtest.
  applyShotMode() {
    const mode = this.shotMode;
    if (!mode) return;
    this.audio.ensure = () => {};
    this.newGameSilent();
    if (mode === '1') {
      // On foot in the city, midday, traffic + pedestrians around.
      this.player.x = 4; this.player.z = 42; this.player.heading = Math.PI * 0.9;
      this.camYaw = Math.PI * 0.9;
    } else if (mode === '2') {
      // Driving a car east down Palm Avenue (road z=42), city ahead.
      const car = this.traffic.nearestCar(0, 42, 60);
      if (car) {
        this.enterCar(car, true);
        car.mesh.position.set(-40, 0, 42);
        car.heading = Math.PI / 2;
        car.mesh.rotation.y = car.heading;
        this.player.heading = car.heading;
        this.player.inCar.speed = 22;
        this.stageTrafficAhead();
      }
      this.camYaw = Math.PI / 2;
    } else if (mode === '3') {
      // Police chase: wanted 3, cops on your tail, mission active.
      const car = this.traffic.nearestCar(0, 42, 80);
      if (car) {
        this.enterCar(car, true);
        car.mesh.position.set(-40, 0, 42);
        car.heading = Math.PI / 2;
        car.mesh.rotation.y = car.heading;
        this.player.heading = car.heading;
        this.player.inCar.speed = 30;
        this.stageTrafficAhead();
      }
      this.police.setStars(3);
      this.missions.startMission(1);
      this.missions.stepIndex = 2; // escape step
      this.refreshObjective();
      this.camYaw = Math.PI / 2;
    } else if (mode === '4') {
      // Mission 3 in progress: at the dock office, guards + cash, wanted 2.
      this.missions.startMission(2);
      this.missions.stepIndex = 1;
      this.spawnGuards();
      // Face south toward the dock office, guards, cash and the sea.
      this.player.x = 150; this.player.z = 178; this.player.heading = 0;
      this.camYaw = 0;
      this.police.setStars(2);
      this.refreshObjective();
      this.hud.dialog('Kito', 'Guards on the dock — take them out, grab the cash, run.', 9000);
    }
    this.readyFlag = false;
    setTimeout(() => { this.readyFlag = true; window.__solmarReady = true; }, 2500);
  }

  // Put two traffic cars ahead of the player on the same avenue, so the
  // driving shots show traffic as well as the player's car.
  stageTrafficAhead() {
    const ahead = this.traffic.cars.slice(0, 2);
    const spots = [[25, 42], [70, 42]];
    ahead.forEach((car, i) => {
      car.mesh.position.set(spots[i][0], 0, spots[i][1]);
      car.heading = Math.PI / 2;
      car.mesh.rotation.y = car.heading;
      car.alongX = true;
      car.speed = 11;
    });
  }

  newGameSilent() {
    this.player.money = PLAYER.startMoney;
    this.player.health = PLAYER.maxHealth;
    this.player.x = PLAYER.startPos.x;
    this.player.z = PLAYER.startPos.z;
    this.player.heading = Math.PI;
    this.missionIndex = 0;
    this.storyDone = false;
    this.police.clearAll();
    this.missions.startMission(0);
    this.startPlaying();
  }

  // --- Entering / leaving cars ----------------------------------------------
  enterCar(car, silent) {
    if (this.player.inCar) return;
    if (car.occupied && !silent) {
      // Steal: yank the driver out — they flee, and the cops notice.
      const p = this.crowd.peds[Math.floor(Math.random() * this.crowd.peds.length)];
      car.occupied = false;
      car.stolen = true;
      this.audio.door();
      if (this.police.stars < 5 && this.police.anyoneSees(this.player.x, this.player.z, false)) {
        this.police.addStars(1);
        this.hud.toast('STOLEN CAR!', 'The police saw you take it — wanted level up', 3000);
      } else {
        this.hud.toast('CAR STOLEN', car.model.name, 1800);
      }
      this.crowd.scareNear(car.mesh.position.x, car.mesh.position.z, 12);
    } else if (!silent) {
      this.audio.door();
      this.hud.toast(car.model.name, car.stolen ? 'Your ride' : 'Borrowed. Permanently.', 1500);
    }
    this.traffic.remove(car);
    this.player.inCar = car;
    car.isPlayerCar = true;
    // Taking any car counts as a steal for the active mission step.
    if (!silent) this.checkMissionSteal();
    this.playerMesh.visible = false;
    this.player.heading = car.heading;
  }

  exitCar() {
    const car = this.player.inCar;
    if (!car) return;
    this.player.inCar = null;
    car.isPlayerCar = false;
    this.player.x = car.mesh.position.x + Math.sin(car.heading + Math.PI / 2) * 2.2;
    this.player.z = car.mesh.position.z + Math.cos(car.heading + Math.PI / 2) * 2.2;
    this.player.heading = car.heading;
    this.playerMesh.visible = true;
    this.audio.door();
  }

  // --- Mission step checks ----------------------------------------------------
  checkMissionSteal() {
    const m = this.missions;
    if (!m.active || !m.step) return;
    if (m.step.kind === 'steal') {
      if (m.mission.id === 'm2') this.police.addStars(2); // marina alarm
      this.completeStep();
    }
  }

  completeStep() {
    const res = this.missions.advance();
    this.refreshObjective();
    if (res.completed) {
      this.player.money += res.reward;
      this.audio.cash();
      this.audio.sting();
      this.doSave();
      if (this.missions.finished) {
        this.storyDone = true;
        this.hud.toast('🏆 STORY COMPLETE', `+$${res.reward} — the harbour is yours`, 5000);
        this.hud.dialog('Mara', STORY, 12000);
      } else {
        const next = res.next;
        this.hud.toast('MISSION COMPLETE', `+$${res.reward} — ${next.title}`, 4500);
        this.hud.dialog(next.giver, next.briefing, 9000);
      }
    } else {
      this.audio.pickup();
      const step = this.missions.step;
      if (step) this.hud.toast('OBJECTIVE UPDATED', step.text, 2600);
    }
  }

  spawnGuards() {
    if (this.missions.guardsSpawned) return;
    this.missions.guardsSpawned = true;
    const spots = [[150, 190], [170, 192], [158, 196], [182, 188]];
    for (const [x, z] of spots) this.crowd.spawnGuard(x, z);
    this.missions.dropCash(168, 182, 3500);
  }

  // --- Per-frame update -------------------------------------------------------
  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.state === 'playing') this.update(dt);
    else if (this.state === 'menu') this.menuCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  menuCamera(dt) {
    // Slow orbit over the city behind the start screen.
    const t = performance.now() * 0.00004;
    this.camera.position.set(Math.sin(t) * 150, 90, Math.cos(t) * 150);
    this.camera.lookAt(0, 0, 20);
  }

  update(dt) {
    const inp = this.input;
    const p = this.player;

    // Global keys.
    if (inp.pressed('p') || inp.pressed('escape')) { this.pause(); return; }
    if (inp.pressed('m')) {
      const on = this.audio.toggleMusic();
      this.hud.toast(on ? 'MUSIC ON' : 'MUSIC OFF', '', 1200);
    }
    if (inp.pressed('c')) this.camDist = this.camDist === 9 ? 14 : this.camDist === 14 ? 6 : 9;

    // Camera orbit by dragging.
    this.camYaw -= inp.dragDX * 0.005;
    this.camPitch = clamp(this.camPitch + inp.dragDY * 0.003, 0.05, 1.1);

    // --- Player movement ---
    const run = inp.down('shift');
    if (p.inCar) this.updateDriving(dt, inp);
    else this.updateOnFoot(dt, inp, run);

    // --- Combat ---
    this.combat.update(dt);
    if (!p.inCar) {
      this.hud.setCrosshair(true);
      if (inp.mouseClicked) this.tryShoot();
      if (inp.pressed('r')) {
        if (this.combat.reload()) this.hud.toast('RELOADING…', '', 900);
      }
    } else {
      this.hud.setCrosshair(false);
      if (inp.pressed('h')) this.audio.horn();
    }

    // --- Traffic, crowd, police, missions ---
    this.traffic.update(dt, p.inCar);
    this.crowd.update(dt, {
      city: this.city,
      playerPos: { x: p.x, z: p.z },
      wanted: this.police.stars,
      onCopNear: (cop, d) => {
        if (d < WANTED.bustRange && !p.inCar && Math.abs(p.onFootSpeed) < 2) {
          this.bustTimer += dt;
          if (this.bustTimer > 1.2) { this.getBusted(); }
        } else this.bustTimer = 0;
      },
      onGuardShoot: (guard, d) => {
        const dmg = this.combat.enemyShot(guard, d);
        if (dmg > 0) this.damagePlayer(dmg, 'guard');
        this.audio.noise(0.1, 0.12, 2000);
      },
    });
    this.police.update(dt, p.x, p.z, !!p.inCar, p.inCar ? Math.abs(p.inCar.speed) : p.onFootSpeed);
    this.audio.setSiren(this.police.stars > 0);
    if (p.inCar) {
      const impact = this.police.checkRam(p.inCar);
      if (impact > 12) this.damagePlayer(Math.floor(impact * 0.4), 'ram');
    }
    this.missions.update(dt, { x: p.x, z: p.z }, {
      onCash: (amount) => {
        p.money += amount;
        this.audio.cash();
        this.hud.toast(`+$${amount}`, 'Cash picked up', 1600);
        if (this.missions.mission && this.missions.mission.id === 'm3' &&
          this.missions.step && this.missions.step.kind === 'combat') {
          this.completeStep();
        }
      },
    });
    this.checkMissionProgress();

    // --- HUD ---
    this.hud.tickClock(dt);
    this.minutes = this.hud.gameMinutes;
    this.hud.setHealth(p.health);
    this.hud.setMoney(p.money);
    this.hud.setWanted(this.police.stars);
    this.hud.setAmmo(this.combat.ammo, this.combat.reserve);
    if (p.inCar) this.hud.setSpeed(Math.abs(p.inCar.speed) * 3.6, p.inCar.model.name);
    else this.hud.setSpeed(0, null);
    this.hud.drawMinimap(this.city, { x: p.x, z: p.z, heading: p.heading },
      this.traffic.allCars(), this.police.cars, this.crowd.cops, this.crowd.guards,
      this.missions.currentSpot());

    // Autosave every 30s while playing.
    if (performance.now() - this.lastSaveAt > 30000) {
      this.lastSaveAt = performance.now();
      this.doSave();
    }
    this.stealCooldown = Math.max(0, this.stealCooldown - dt);

    // Interact prompt.
    if (!p.inCar && this.stealCooldown <= 0) {
      const car = this.traffic.nearestCar(p.x, p.z, 4);
      this.hud.interact(car ? `[E] Steal ${car.model.name}` : null);
    } else this.hud.interact(null);
  }

  updateOnFoot(dt, inp, run) {
    const p = this.player;
    // Move relative to camera yaw.
    const fwd = inp.axis('s', 'w');
    const strafe = inp.axis('a', 'd');
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = 0, mz = 0;
    if (fwd !== 0 || strafe !== 0) {
      const len = Math.hypot(fwd, strafe);
      const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
      const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
      mx = (fx * fwd + rx * strafe) / len;
      mz = (fz * fwd + rz * strafe) / len;
      p.heading = Math.atan2(mx, mz);
      p.onFootSpeed = speed;
    } else p.onFootSpeed = 0;
    const nx = p.x + mx * speed * dt;
    const nz = p.z + mz * speed * dt;
    if (!this.city.blocked(nx, p.z, 0.8)) p.x = nx;
    if (!this.city.blocked(p.x, nz, 0.8)) p.z = nz;
    const c = this.city.clampToWorld(p.x, p.z);
    p.x = c.x; p.z = c.z;

    // Walk animation + mesh.
    this.walkPhase += dt * (p.onFootSpeed > 0 ? p.onFootSpeed * 1.6 : 0);
    const swing = Math.sin(this.walkPhase) * (p.onFootSpeed > 0 ? 0.55 : 0);
    this.armL.rotation.x = swing;
    this.armR.rotation.x = -swing;
    this.playerMesh.position.set(p.x, 0, p.z);
    this.playerMesh.rotation.y = p.heading;

    // Enter a car.
    if (inp.pressed('e') && this.stealCooldown <= 0) {
      const car = this.traffic.nearestCar(p.x, p.z, 4);
      if (car) { this.enterCar(car, false); this.stealCooldown = 0.8; }
    }

    // Third-person camera behind the player.
    const cx = p.x - Math.sin(this.camYaw) * this.camDist;
    const cz = p.z - Math.cos(this.camYaw) * this.camDist;
    const cy = 3.2 + this.camPitch * 7;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(p.x, 1.6, p.z);
  }

  updateDriving(dt, inp) {
    const p = this.player;
    const car = p.inCar;
    const throttle = inp.axis('s', 'w');
    const steer = inp.axis('a', 'd');
    car.drive(dt, throttle, steer);
    if (inp.down(' ')) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 30 * dt);
    // Collisions with buildings: stop dead, lose a little speed.
    if (this.city.blocked(car.mesh.position.x, car.mesh.position.z, 1.0)) {
      car.mesh.position.x -= Math.sin(car.heading) * car.speed * dt;
      car.mesh.position.z -= Math.cos(car.heading) * car.speed * dt;
      if (Math.abs(car.speed) > 14) this.damagePlayer(4, 'crash');
      car.speed *= 0.3;
    }
    const c = this.city.clampToWorld(car.mesh.position.x, car.mesh.position.z);
    car.mesh.position.x = c.x; car.mesh.position.z = c.z;
    p.x = car.mesh.position.x;
    p.z = car.mesh.position.z;
    p.heading = car.heading;
    this.audio.setEngine(Math.abs(car.speed) / car.model.top);

    if (inp.pressed('e')) this.exitCar();

    // Chase camera.
    this.camYaw = angleLerp(this.camYaw, car.heading, Math.min(1, dt * 2.5));
    const cx = p.x - Math.sin(this.camYaw) * (this.camDist + 2);
    const cz = p.z - Math.cos(this.camYaw) * (this.camDist + 2);
    const cy = 4.2 + this.camPitch * 6;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(p.x, 1.4, p.z);
  }

  tryShoot() {
    const origin = this.camera.position.clone();
    const targets = [...this.crowd.guards, ...this.crowd.cops, ...this.crowd.peds];
    const res = this.combat.shoot(origin, targets, () => {
      this.audio.gunshot();
      this.crowd.scareNear(this.player.x, this.player.z, 18);
    });
    if (!res) return;
    if (res.hit) {
      if (res.target.kind === 'ped') {
        // Shooting a civilian is a crime.
        this.police.addStars(1);
        this.hud.toast('CIVILIAN DOWN', 'The police are coming', 2500);
      } else if (res.killed) {
        this.hud.toast(res.target.kind === 'guard' ? 'GUARD DOWN' : 'COP DOWN', '', 1500);
        if (res.target.kind === 'guard') this.checkGuardsCleared();
        if (res.target.kind === 'cop') this.police.addStars(1);
      }
      // Any gunfire in the open draws attention.
      if (this.police.anyoneSees(this.player.x, this.player.z, false)) this.police.addStars(1);
    }
  }

  checkGuardsCleared() {
    const m = this.missions;
    if (m.mission && m.mission.id === 'm3' && m.step && m.step.kind === 'combat') {
      if (this.crowd.guards.every((g) => !g.alive)) {
        this.hud.toast('AREA CLEAR', 'Grab the cash at the dock office', 3000);
      }
    }
  }

  checkMissionProgress() {
    const m = this.missions;
    if (!m.active || !m.step) return;
    const p = this.player;
    if (m.step.kind === 'goto') {
      const spot = m.currentSpot();
      if (!spot) return;
      const d2 = dist2(p.x, p.z, spot.x, spot.z);
      const radius = m.mission.id === 'm3' && m.stepIndex === 0 ? 16 : 9;
      if (d2 < radius * radius) {
        if (m.mission.id === 'm3' && m.stepIndex === 0) this.spawnGuards();
        this.completeStep();
      }
    } else if (m.step.kind === 'escape') {
      if (this.police.stars === 0) this.completeStep();
    } else if (m.step.kind === 'combat') {
      // Progress happens via cash pickup (onCash) once guards are down.
      if (m.mission.id === 'm3' && this.crowd.guards.every((g) => !g.alive) && m.cashDrops.length === 0) {
        // Cash already taken — handled by onCash.
      }
    }
  }

  damagePlayer(amount, source) {
    const p = this.player;
    p.health -= amount;
    this.hud.flashDamage();
    if (p.health <= 0) {
      p.health = 0;
      this.audio.fail();
      if (source === 'guard' || source === 'ram' || source === 'crash') this.die();
      else this.getBusted();
    }
  }

  getBusted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.audio.fail();
    document.getElementById('bustedScreen').classList.remove('hidden');
  }

  die() {
    if (this.state !== 'playing') return;
    this.state = 'dead';
    this.audio.fail();
    document.getElementById('deadScreen').classList.remove('hidden');
  }
}
