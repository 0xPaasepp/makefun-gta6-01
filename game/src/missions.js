// Story missions M1–M8 (each named, each with a giver and an opening
// line) plus side jobs: taxi, courier, TWO street races (Palm Avenue
// sprint + the rebuild-12 Marina Sprint), a 5-package hunt and the
// rebuild-12 Sun Shell collectibles (10 golden shells around Solmar).
// Each is a small state machine driven by zones; the game calls update()
// every tick and reads mission/money/respect from the shared state.
//
// Rebuild 13: missions 4–8. M4 repaints at the garage, M5 wins the Marina
// Sprint, M6 gets hot then loses the cops, M7 collects 3 more shells,
// M8 wins the Palm Avenue sprint — the finale. Each reuses a system the
// game already proves (paint, races, wanted, shells), so every mission
// is finishable with real play, not a scripted cutscene.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, MISSION_DEFS } from './config.js';
import { buildGuardMesh, buildNpcMesh } from './people.js';
import { dist2 } from './rng.js';

function markerMesh(color) {
  // Floating beacon: ring + pulsing column so objectives read from afar.
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 24),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.35;
  g.add(ring);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 9, 8, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
  col.position.y = 4.5;
  g.add(col);
  return g;
}

export class MissionSystem {
  constructor(scene, state) {
    this.scene = scene; this.state = state; // shared game state object
    this.guards = [];
    this._m2Stolen = false;
    this._m3CashTaken = false;
    this._guardsSpawned = false;
    this._markers = {};
    this._taxi = { active: false, passenger: false };
    this._courier = { active: false, carrying: false };
    this._race = { active: false, cp: 0, t: 0 };
    this._race2 = { active: false, cp: 0, t: 0 };
    this._packagesGot = 0;
    this._packageMeshes = [];
    this._shellMeshes = [];
    this._mara = null; this._kito = null;
    this._marshal = null; this._fixer = null; this._marea = null;
    // Rebuild 13 mission-progress flags: captured when each mission
    // starts, so only progress made DURING the mission counts.
    this._m4StartPaint = null; this._m6Hot = false; this._m7StartShells = null;
    this._buildWorldActors();
  }
  _buildWorldActors() {
    // The story cast stands where their jobs happen: Mara by her garage,
    // Kito at the docks, the Marshal at the race start, the Fixer on the
    // plaza, DJ Marea outside El Faro bar at the marina.
    this._mara = buildNpcMesh('mara');
    this._mara.position.set(-56, 0.3, 54);
    this.scene.add(this._mara);
    this._kito = buildNpcMesh('kito');
    this._kito.position.set(176, 0.3, -72);
    this.scene.add(this._kito);
    this._marshal = buildNpcMesh('marshal');
    this._marshal.position.set(4, 0.3, 116);
    this.scene.add(this._marshal);
    this._fixer = buildNpcMesh('fixer');
    this._fixer.position.set(12, 0.3, 8);
    this.scene.add(this._fixer);
    this._marea = buildNpcMesh('marea');
    this._marea.position.set(164, 0.3, 34);
    this.scene.add(this._marea);
    // Rebuild 13: DJ Vela — the NEON 88 voice — holds court outside the
    // Neon Row record shop at the south end of Palm Avenue.
    this._vela = buildNpcMesh('vela');
    this._vela.position.set(-10, 0.3, 132);
    this.scene.add(this._vela);
    // Mission beacons.
    this._markers.m1 = markerMesh(0xffd23f);
    this._markers.m1.position.set(CONFIG.m1Garage.x, 0, CONFIG.m1Garage.z);
    this.scene.add(this._markers.m1);
    this._markers.m2 = markerMesh(0xff2fb3);
    this._markers.m2.position.set(CONFIG.m2Car.x, 0, CONFIG.m2Car.z);
    this.scene.add(this._markers.m2);
    this._markers.m3 = markerMesh(0xff5a3c);
    this._markers.m3.position.set(CONFIG.m3Cash.x, 0, CONFIG.m3Cash.z);
    this.scene.add(this._markers.m3);
    this._markers.race2 = markerMesh(0x2aff8a);
    this._markers.race2.position.set(CONFIG.race2Start.x, 0, CONFIG.race2Start.z);
    this.scene.add(this._markers.race2);
    // Rebuild 13 beacons: M4 paints at the garage, M8 races from the
    // Palm Avenue start line.
    this._markers.m4 = markerMesh(0xffd23f);
    this._markers.m4.position.set(CONFIG.m1Garage.x, 0, CONFIG.m1Garage.z);
    this.scene.add(this._markers.m4);
    this._markers.m8 = markerMesh(0xff5a8a);
    this._markers.m8.position.set(CONFIG.raceStart.x, 0, CONFIG.raceStart.z);
    this.scene.add(this._markers.m8);
    // Package pickups (glowing crates).
    for (const p of CONFIG.packages) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4),
        new THREE.MeshLambertMaterial({ color: 0x2aff8a, emissive: 0x0a5a2a }));
      m.position.set(p.x, 1.0, p.z);
      this.scene.add(m);
      this._packageMeshes.push({ x: p.x, z: p.z, mesh: m, got: false });
    }
    // Sun Shells: small golden spinning shells, one per hiding spot.
    for (let i = 0; i < CONFIG.shells.length; i++) {
      const p = CONFIG.shells[i];
      const shell = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x664400 }));
      body.scale.set(1, 0.55, 1);
      shell.add(body);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 6, 12),
        new THREE.MeshBasicMaterial({ color: 0xfff2cc }));
      rim.rotation.x = Math.PI / 2;
      shell.add(rim);
      shell.position.set(p.x, 1.0, p.z);
      this.scene.add(shell);
      const got = (this.state.shellsGot || []).includes(i);
      shell.visible = !got;
      this._shellMeshes.push({ x: p.x, z: p.z, mesh: shell, got, index: i });
    }
    // Taxi passenger marker + courier crate marker.
    this._markers.taxi = markerMesh(0xffc21a);
    this._markers.taxi.position.set(CONFIG.taxiPickup.x, 0, CONFIG.taxiPickup.z);
    this.scene.add(this._markers.taxi);
    this._markers.courier = markerMesh(0x3fa7ff);
    this._markers.courier.position.set(CONFIG.courierPickup.x, 0, CONFIG.courierPickup.z);
    this.scene.add(this._markers.courier);
  }
  spawnGuards() {
    if (this._guardsSpawned) return;
    this._guardsSpawned = true;
    for (const g of CONFIG.guards) {
      const mesh = buildGuardMesh();
      mesh.position.set(g.x, 0.3, g.z);
      this.scene.add(mesh);
      this.guards.push({ x: g.x, z: g.z, hp: 100, alive: true, mesh, shootT: 2 });
    }
  }
  onCarStolen(car) {
    if (car.isM2 && this.state.mission === 1 && !this._m2Stolen) {
      this._m2Stolen = true;
      return 'm2-stolen';
    }
    if (car.isM1 && this.state.mission === 0) return 'm1-stolen';
    return null;
  }
  missionDef(m) { return MISSION_DEFS[Math.min(Math.max(m, 0), MISSION_DEFS.length - 1)]; }
  shellsGotCount() { return this._shellMeshes.filter((s) => s.got).length; }
  // Current objective blip for the minimap + HUD.
  objectivePos() {
    const m = this.state.mission;
    if (m === 0) return { x: CONFIG.m1Garage.x, z: CONFIG.m1Garage.z, label: 'Mara\'s Garage' };
    if (m === 1) return this._m2Stolen
      ? { x: 0, z: 0, label: 'Lose the police' }
      : { x: CONFIG.m2Car.x, z: CONFIG.m2Car.z, label: 'Neon Sport' };
    if (m === 2) return { x: CONFIG.m3Cash.x, z: CONFIG.m3Cash.z, label: 'Dock Cash' };
    if (m === 3) return { x: CONFIG.m1Garage.x, z: CONFIG.m1Garage.z, label: 'Paint Shop' };
    if (m === 4) return { x: CONFIG.race2Start.x, z: CONFIG.race2Start.z, label: 'Marina Sprint' };
    if (m === 5) return { x: 0, z: 0, label: 'Lose the police' };
    if (m === 6) {
      const next = this._shellMeshes.find((sh) => !sh.got);
      return next ? { x: next.x, z: next.z, label: 'Sun Shell' } : { x: 0, z: 0, label: 'Sun Shell' };
    }
    if (m === 7) return { x: CONFIG.raceStart.x, z: CONFIG.raceStart.z, label: 'Palm Avenue Sprint' };
    if (this._race.active) {
      const cp = CONFIG.raceCheckpoints[this._race.cp];
      return { x: cp.x, z: cp.z, label: 'Race checkpoint' };
    }
    if (this._race2.active) {
      const cp = CONFIG.race2Checkpoints[this._race2.cp];
      return { x: cp.x, z: cp.z, label: 'Marina Sprint checkpoint' };
    }
    if (this._taxi.active) return { x: CONFIG.taxiDropoff.x, z: CONFIG.taxiDropoff.z, label: 'Hotel Solmar' };
    if (this._courier.active) return this._courier.carrying
      ? { x: CONFIG.courierDropoff.x, z: CONFIG.courierDropoff.z, label: 'Marina Office' }
      : { x: CONFIG.courierPickup.x, z: CONFIG.courierPickup.z, label: 'Courier Crate' };
    return { x: CONFIG.m1Garage.x, z: CONFIG.m1Garage.z, label: 'Solmar' };
  }
  update(dt, px, pz, inCar, time) {
    const s = this.state;
    // Pulse the beacons + spin the shells.
    for (const k of Object.keys(this._markers)) {
      const m = this._markers[k];
      m.children[0].rotation.z += dt * 0.8;
      const sc = 1 + Math.sin(time * 3) * 0.08;
      m.scale.set(sc, 1, sc);
    }
    for (const sh of this._shellMeshes) {
      if (!sh.got) { sh.mesh.rotation.y += dt * 1.5; sh.mesh.position.y = 1.0 + Math.sin(time * 2 + sh.index) * 0.15; }
    }
    // Hide the M1 beacon once M1 is done, M2 beacon once the sport is taken.
    this._markers.m1.visible = s.mission === 0;
    this._markers.m2.visible = s.mission === 1 && !this._m2Stolen;
    this._markers.m3.visible = s.mission === 2;
    this._markers.m4.visible = s.mission === 3;
    this._markers.m8.visible = s.mission === 7;
    this._markers.race2.visible = s.mission === 4 || !this._race2.active;
    // --- M1: deliver a car to Mara's garage.
    if (s.mission === 0 && inCar && dist2(px, pz, CONFIG.m1Garage.x, CONFIG.m1Garage.z) < CONFIG.m1Garage.r ** 2) {
      s.mission = 1; s.money += CONFIG.m1Reward; s.respect = (s.respect || 0) + 10;
      return { type: 'mission-complete', id: 1, reward: CONFIG.m1Reward,
        text: 'Mara: "That\'s the one! You\'re a lifesaver, Dario. The Vanes took my ride — now listen, the Neon Sport is sitting at the marina. Grab it."', who: 'MARA' };
    }
    // --- M2: lose the cops after stealing the Neon Sport.
    if (s.mission === 1 && this._m2Stolen && s.wanted === 0) {
      s.mission = 2; s.money += CONFIG.m2Reward; s.respect = (s.respect || 0) + 15;
      this.spawnGuards();
      return { type: 'mission-complete', id: 2, reward: CONFIG.m2Reward,
        text: 'Kito: "Clean! You shook them. The Vanes stash their harbour cash at the docks — four guards on it. Take them down and the money is ours."', who: 'KITO' };
    }
    // --- M3: all guards down, then grab the cash.
    if (s.mission === 2) {
      this.spawnGuards();
      const allDown = this.guards.length === 4 && this.guards.every(g => !g.alive);
      if (allDown && !this._m3CashTaken && dist2(px, pz, CONFIG.m3Cash.x, CONFIG.m3Cash.z) < CONFIG.m3Cash.r ** 2) {
        this._m3CashTaken = true;
        s.mission = 3; s.money += CONFIG.m3Reward; s.respect = (s.respect || 0) + 25;
        return { type: 'mission-complete', id: 3, reward: CONFIG.m3Reward,
          text: 'Kito: "THREE AND A HALF GRAND! The Vanes are going to feel that one. Solmar is ours now, Dario — drive it like you stole it."', who: 'KITO' };
      }
    }
    // --- M4: repaint a car at Mara's garage (paint changes during M4).
    if (s.mission === 3) {
      if (this._m4StartPaint === null) this._m4StartPaint = s.paint;
      if (s.paint !== this._m4StartPaint) {
        this._m4StartPaint = null;
        s.mission = 4; s.money += CONFIG.m4Reward; s.respect = (s.respect || 0) + 12;
        return { type: 'mission-complete', id: 4, reward: CONFIG.m4Reward,
          text: 'Mara: "Now THAT is a Solmar car. The Marshal runs a sprint on the east road — go show them what fresh paint can do."', who: 'MARA' };
      }
    }
    // --- M6: get hot (2+ stars), then lose the cops clean.
    if (s.mission === 5) {
      if (s.wanted >= 2) this._m6Hot = true;
      if (this._m6Hot && s.wanted === 0) {
        this._m6Hot = false;
        s.mission = 6; s.money += CONFIG.m6Reward; s.respect = (s.respect || 0) + 15;
        return { type: 'mission-complete', id: 6, reward: CONFIG.m6Reward,
          text: 'Fixer: "Clean. Not a single cop on your tail. DJ Marea wants a word — she\'s got a job that pays in gold."', who: 'FIXER' };
      }
    }
    // --- M7: find 3 more Sun Shells for DJ Marea.
    if (s.mission === 6) {
      if (this._m7StartShells === null) this._m7StartShells = this.shellsGotCount();
      if (this.shellsGotCount() - this._m7StartShells >= CONFIG.m7Shells) {
        this._m7StartShells = null;
        s.mission = 7; s.money += CONFIG.m7Reward; s.respect = (s.respect || 0) + 10;
        return { type: 'mission-complete', id: 7, reward: CONFIG.m7Reward,
          text: 'Marea: "Three shells, live on air! You\'re a Solmar legend now, baby. One race left — the Palm Avenue sprint. Win it all."', who: 'MAREA' };
      }
    }
    // --- Sun Shells: walk or drive over one to collect it.
    for (const sh of this._shellMeshes) {
      if (!sh.got && dist2(px, pz, sh.x, sh.z) < 6.25) {
        sh.got = true; sh.mesh.visible = false;
        if (!Array.isArray(s.shellsGot)) s.shellsGot = [];
        s.shellsGot.push(sh.index);
        s.money += CONFIG.shellReward;
        s.respect = (s.respect || 0) + 2;
        const n = this.shellsGotCount();
        if (n >= CONFIG.shells.length) {
          s.money += CONFIG.shellsBonus; s.respect = (s.respect || 0) + 20;
          return { type: 'shells-done', reward: CONFIG.shellsBonus, text: `All 10 Sun Shells! The Fixer pays your $${CONFIG.shellsBonus} bonus — Solmar knows your name now.`, who: 'FIXER' };
        }
        return { type: 'shell', reward: CONFIG.shellReward, text: `Sun Shell ${n}/10 — golden, warm, worth $${CONFIG.shellReward}.`, who: 'FIXER' };
      }
    }
    // --- Side job: taxi. Walk to the passenger, then drive them to the hotel.
    if (!this._taxi.active && !inCar && dist2(px, pz, CONFIG.taxiPickup.x, CONFIG.taxiPickup.z) < CONFIG.taxiPickup.r ** 2) {
      this._taxi.active = true;
      return { type: 'job-start', id: 'taxi', text: 'Passenger: "Hotel Solmar, please — and step on it, I\'m late!"', who: 'FARE' };
    }
    if (this._taxi.active && inCar && dist2(px, pz, CONFIG.taxiDropoff.x, CONFIG.taxiDropoff.z) < CONFIG.taxiDropoff.r ** 2) {
      this._taxi.active = false;
      s.money += CONFIG.taxiReward; s.respect = (s.respect || 0) + 3;
      return { type: 'job-done', id: 'taxi', reward: CONFIG.taxiReward, text: 'Passenger: "Worth every cent. Keep the change."', who: 'FARE' };
    }
    // --- Side job: courier. Pick up the crate at the docks, deliver to the marina office.
    if (!this._courier.active && !inCar && dist2(px, pz, CONFIG.courierPickup.x, CONFIG.courierPickup.z) < CONFIG.courierPickup.r ** 2) {
      this._courier.active = true; this._courier.carrying = true;
      return { type: 'job-start', id: 'courier', text: 'Dockhand: "That crate goes to the marina office. Don\'t drop it."', who: 'DOCKHAND' };
    }
    if (this._courier.active && this._courier.carrying && dist2(px, pz, CONFIG.courierDropoff.x, CONFIG.courierDropoff.z) < CONFIG.courierDropoff.r ** 2) {
      this._courier.active = false; this._courier.carrying = false;
      s.money += CONFIG.courierReward; s.respect = (s.respect || 0) + 3;
      return { type: 'job-done', id: 'courier', reward: CONFIG.courierReward, text: 'Marina Office: "Signed for. Here\'s your cut."', who: 'MARINA' };
    }
    // --- Side job: street race 1. Drive into the start line on Palm Avenue.
    if (!this._race.active && inCar && dist2(px, pz, CONFIG.raceStart.x, CONFIG.raceStart.z) < CONFIG.raceStart.r ** 2) {
      this._race.active = true; this._race.cp = 0; this._race.t = 0;
      return { type: 'job-start', id: 'race', text: 'Race Marshal: "Palm Avenue sprint! Hit all 3 checkpoints, fastest line wins."', who: 'MARSHAL' };
    }
    if (this._race.active) {
      this._race.t += dt;
      const cp = CONFIG.raceCheckpoints[this._race.cp];
      if (cp && dist2(px, pz, cp.x, cp.z) < 49) {
        this._race.cp++;
        if (this._race.cp >= CONFIG.raceCheckpoints.length) {
          this._race.active = false;
          // Rebuild 13 M8: winning the Palm Avenue sprint as mission 7
          // is the story finale — King of the Sunset.
          if (s.mission === 7) {
            s.mission = 8; s.money += CONFIG.m8Reward; s.respect = (s.respect || 0) + 25;
            return { type: 'mission-complete', id: 8, reward: CONFIG.m8Reward,
              text: `Kito: "KING OF THE SUNSET! ${this._race.t.toFixed(1)}s down Palm Avenue — the whole city saw it. Solmar is ours, brother."`, who: 'KITO' };
          }
          s.money += CONFIG.raceReward; s.respect = (s.respect || 0) + 5;
          return { type: 'job-done', id: 'race', reward: CONFIG.raceReward, text: `Race Marshal: "Finished in ${this._race.t.toFixed(1)}s — the avenue is yours!"`, who: 'MARSHAL' };
        }
      }
      if (this._race.t > 120) { this._race.active = false; }
    }
    // --- Side job: street race 2 (rebuild 12). Marina Sprint, east edge.
    if (!this._race2.active && inCar && dist2(px, pz, CONFIG.race2Start.x, CONFIG.race2Start.z) < CONFIG.race2Start.r ** 2) {
      this._race2.active = true; this._race2.cp = 0; this._race2.t = 0;
      return { type: 'job-start', id: 'race2', text: 'Race Marshal: "Marina Sprint! Down the east road, past the docks — don\'t kiss the sea."', who: 'MARSHAL' };
    }
    if (this._race2.active) {
      this._race2.t += dt;
      const cp = CONFIG.race2Checkpoints[this._race2.cp];
      if (cp && dist2(px, pz, cp.x, cp.z) < 49) {
        this._race2.cp++;
        if (this._race2.cp >= CONFIG.race2Checkpoints.length) {
          this._race2.active = false;
          // Rebuild 13 M5: winning the Marina Sprint as mission 4
          // advances the story instead of paying the side-job reward.
          if (s.mission === 4) {
            s.mission = 5; s.money += CONFIG.m5Reward; s.respect = (s.respect || 0) + 12;
            return { type: 'mission-complete', id: 5, reward: CONFIG.m5Reward,
              text: `Race Marshal: "Marina Sprint in ${this._race2.t.toFixed(1)}s — the docks are chanting your name! The Fixer needs you next."`, who: 'MARSHAL' };
          }
          s.money += CONFIG.race2Reward; s.respect = (s.respect || 0) + 8;
          return { type: 'job-done', id: 'race2', reward: CONFIG.race2Reward, text: `Race Marshal: "Marina Sprint done in ${this._race2.t.toFixed(1)}s — the docks crowd is chanting your name!"`, who: 'MARSHAL' };
        }
      }
      if (this._race2.t > 120) { this._race2.active = false; }
    }
    // --- Side job: package hunt. Five glowing crates around the city.
    for (const p of this._packageMeshes) {
      if (!p.got && dist2(px, pz, p.x, p.z) < 9) {
        p.got = true; p.mesh.visible = false;
        this._packagesGot++;
        if (this._packagesGot >= CONFIG.packages.length) {
          s.money += CONFIG.packageReward; s.respect = (s.respect || 0) + 8;
          return { type: 'job-done', id: 'packages', reward: CONFIG.packageReward, text: 'Fixer: "All five packages. You\'re reliable, Dario. Here\'s your bonus."', who: 'FIXER' };
        }
        return { type: 'job-progress', id: 'packages', text: `Package ${this._packagesGot}/5 collected.`, who: 'FIXER' };
      }
    }
    return null;
  }
}
