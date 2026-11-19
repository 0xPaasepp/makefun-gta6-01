// Wanted system 0–5: foot cops chase and can bust, cruisers chase and ram,
// roadblocks at high wanted, helicopter from wanted 4. Wanted decays when
// no officer is close.
//
// Rebuild 12 — POLICE DISPATCH: every unit has a name and a live state
// (IN SIGHT / CLOSING IN / SEARCHING / EVADING) shown in the HUD dispatch
// panel, Solmar's answer to the top-1 panel. Cruisers are real 'cruiser'
// models with a two-tone body and a flashing light bar; foot cops are
// proper officer builds with badge and cap.
import * as THREE from '../vendor/three.module.min.js';
import { buildCarMesh } from './vehicles.js';
import { buildOfficerMesh } from './people.js';
import { CONFIG } from './config.js';

// Named dispatch units — Solmar PD, all original names.
const UNIT_NAMES = [
  'UNIT 7 — ROOK', 'UNIT 12 — VELA', 'UNIT 3 — BRISA', 'UNIT 9 — FARO',
  'UNIT 5 — LUNA', 'UNIT 21 — SOL', 'UNIT 14 — MAR', 'UNIT 2 — OLA',
];

export class PoliceSystem {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.wanted = 0;
    this.footCops = [];   // {x,z,heading,speed,mesh,bustT,alive,unit}
    this.cruisers = [];   // Car-like {x,z,heading,speed,mesh,unit}
    this.heliMesh = null; this.heliAngle = 0;
    this.roadblocks = [];
    this._decayT = 0;
    this._spawnT = 0;
    this._busted = false;
    this._unitSeq = 0;
    // Rebuild 13: evade progress — 0–100% while no officer is close.
    // Hitting 100% is when the wanted level drops; the dispatch panel
    // shows it live ("HIDDEN — evading 62%") instead of a bare status.
    this.evadePct = 0;
  }
  _nextUnit() { return UNIT_NAMES[this._unitSeq++ % UNIT_NAMES.length]; }
  setWanted(n, px, pz) {
    this.wanted = Math.max(0, Math.min(5, n));
    this._decayT = 0;
    if (this.wanted === 0) {
      this._clearUnits();
    } else {
      this._spawnT = 0; // spawn immediately on next update
    }
  }
  _clearUnits() {
    for (const c of this.footCops) this.scene.remove(c.mesh);
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    this.footCops = []; this.cruisers = [];
    this.evadePct = 0;
    if (this.heliMesh) { this.scene.remove(this.heliMesh); this.heliMesh = null; }
    for (const r of this.roadblocks) this.scene.remove(r);
    this.roadblocks = [];
  }
  _spawnFootCop(px, pz) {
    const a = Math.random() * Math.PI * 2;
    const x = px + Math.sin(a) * 34, z = pz + Math.cos(a) * 34;
    const mesh = buildOfficerMesh();
    mesh.position.set(x, 0.3, z);
    this.scene.add(mesh);
    this.footCops.push({ x, z, heading: a, speed: 4.4, mesh, bustT: 0, alive: true, unit: this._nextUnit() });
  }
  _spawnCruiser(px, pz) {
    const a = Math.random() * Math.PI * 2;
    const x = px + Math.sin(a) * 42, z = pz + Math.cos(a) * 42;
    const mesh = buildCarMesh('cruiser', 0x111111);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.cruisers.push({ x, z, heading: a, speed: 0, mesh, sirenT: Math.random() * 2, unit: this._nextUnit() });
  }
  _spawnHeli() {
    if (this.heliMesh) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 2),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.8),
      new THREE.MeshLambertMaterial({ color: 0x9fd8ff }));
    glass.position.set(2.0, 0.3, 0); g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
    tail.position.set(-3.6, 0.4, 0); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1.1; g.add(rotor);
    g.userData.rotor = rotor;
    const blur = new THREE.Mesh(new THREE.CircleGeometry(4.2, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 }));
    blur.rotation.x = -Math.PI / 2; blur.position.y = 1.15; g.add(blur);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    light.position.set(2, -1, 0); g.add(light);
    g.userData.spot = light;
    g.userData.unit = 'AIR 1 — HALCON';
    this.scene.add(g);
    this.heliMesh = g;
  }
  _spawnRoadblocks(px, pz) {
    if (this.roadblocks.length) return;
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const x = px + Math.sin(a) * 26, z = pz + Math.cos(a) * 26;
      const rb = new THREE.Group();
      for (let k = -1; k <= 1; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 2.4),
          new THREE.MeshLambertMaterial({ color: k === 0 ? 0xff5a2a : 0xffffff }));
        bar.position.set(k * 2.2, 0.55, 0); rb.add(bar);
      }
      // Cones flanking the barrier.
      for (const s of [-1, 1]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8),
          new THREE.MeshLambertMaterial({ color: 0xff5a2a }));
        cone.position.set(s * 4.5, 0.45, 0); rb.add(cone);
      }
      rb.position.set(x, 0, z);
      rb.rotation.y = Math.random() * Math.PI;
      this.scene.add(rb);
      this.roadblocks.push(rb);
    }
  }
  nearestCopDist(px, pz) {
    let d = Infinity;
    for (const c of this.footCops) d = Math.min(d, Math.hypot(c.x - px, c.z - pz));
    for (const c of this.cruisers) d = Math.min(d, Math.hypot(c.x - px, c.z - pz));
    return d;
  }
  // Dispatch panel state: each live unit with name, distance and status.
  // IN SIGHT < 15u, CLOSING IN < 35u, SEARCHING beyond that; EVADING when
  // the player is moving fast in a car.
  dispatchState(px, pz, playerSpeed, inCar) {
    if (this.wanted <= 0) return { wanted: 0, status: 'CLEAR', units: [] };
    const units = [];
    const stateFor = (d) => {
      if (inCar && playerSpeed > 14) return 'EVADING';
      if (d < 15) return 'IN SIGHT';
      if (d < 35) return 'CLOSING IN';
      return 'SEARCHING';
    };
    for (const c of this.footCops) {
      const d = Math.hypot(c.x - px, c.z - pz);
      units.push({ name: c.unit, kind: 'FOOT', dist: Math.round(d), state: stateFor(d) });
    }
    for (const c of this.cruisers) {
      const d = Math.hypot(c.x - px, c.z - pz);
      units.push({ name: c.unit, kind: 'CRUISER', dist: Math.round(d), state: stateFor(d) });
    }
    if (this.heliMesh) {
      const d = Math.hypot(this.heliMesh.position.x - px, this.heliMesh.position.z - pz);
      units.push({ name: 'AIR 1 — HALCON', kind: 'HELI', dist: Math.round(d), state: inCar && playerSpeed > 14 ? 'EVADING' : 'IN SIGHT' });
    }
    const anySight = units.some((u) => u.state === 'IN SIGHT');
    return {
      wanted: this.wanted,
      status: anySight ? 'IN SIGHT' : (inCar && playerSpeed > 14 ? 'EVADING' : 'SEARCHING'),
      evadePct: Math.round(this.evadePct),
      units: units.slice(0, 4),
    };
  }
  // Returns 'busted' when a foot cop holds the player, else null.
  update(dt, px, pz, inCar, playerSpeed) {
    if (this.wanted <= 0) return null;
    this._spawnT -= dt;
    if (this._spawnT <= 0) {
      this._spawnT = 1.2;
      const wantFoot = Math.min(2 + this.wanted, 4);
      if (this.footCops.length < wantFoot) this._spawnFootCop(px, pz);
      const wantCruisers = this.wanted >= 2 ? Math.min(this.wanted - 1, 3) : 0;
      if (this.cruisers.length < wantCruisers) this._spawnCruiser(px, pz);
      if (this.wanted >= 4) { this._spawnHeli(); this._spawnRoadblocks(px, pz); }
    }
    // Foot cops chase on foot.
    for (const c of this.footCops) {
      const dx = px - c.x, dz = pz - c.z;
      const d = Math.hypot(dx, dz) || 1;
      c.heading = Math.atan2(dx, dz);
      c.x += (dx / d) * c.speed * dt;
      c.z += (dz / d) * c.speed * dt;
      c.mesh.position.set(c.x, 0.3, c.z);
      c.mesh.rotation.y = c.heading;
      if (d < 2.0 && !inCar) {
        c.bustT += dt;
        if (c.bustT > 4) return 'busted';
      } else c.bustT = 0;
    }
    // Cruisers chase and ram: steer toward the player, faster than traffic.
    for (const c of this.cruisers) {
      const dx = px - c.x, dz = pz - c.z;
      const d = Math.hypot(dx, dz) || 1;
      const target = Math.atan2(dx, dz);
      let diff = target - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      c.speed = Math.min(21, c.speed + 9 * dt);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Light bar flash: alternate the red and blue halves.
      c.sirenT += dt;
      const on = Math.floor(c.sirenT * 3) % 2 === 0;
      const barR = c.mesh.userData.barR, barB = c.mesh.userData.barB;
      if (barR) barR.material.color.setHex(on ? 0xff2222 : 0x551111);
      if (barB) barB.material.color.setHex(on ? 0x111155 : 0x2244ff);
    }
    // Cruisers ram: a hard shove when one reaches the player's car.
    for (const c of this.cruisers) {
      const d = Math.hypot(px - c.x, pz - c.z);
      if (d < 3.4 && this._onRam) this._onRam(c, dt);
    }
    // Helicopter circles overhead, spotlight cone sweeping the ground.
    if (this.heliMesh) {
      this.heliAngle += dt * 0.5;
      this.heliMesh.position.set(px + Math.cos(this.heliAngle) * 22, 30, pz + Math.sin(this.heliAngle) * 22);
      this.heliMesh.rotation.y = -this.heliAngle;
      this.heliMesh.userData.rotor.rotation.y += dt * 18;
      if (!this.heliMesh.userData.beam) {
        const beam = new THREE.Mesh(new THREE.ConeGeometry(7, 30, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.13, side: THREE.DoubleSide }));
        beam.position.y = -15;
        this.heliMesh.add(beam);
        this.heliMesh.userData.beam = beam;
      }
    }
    // Wanted decays only when no officer is close.
    const near = this.nearestCopDist(px, pz);
    if (near > 30) {
      this._decayT += dt;
      this.evadePct = Math.min(100, (this._decayT / 5) * 100);
      if (this._decayT > 5) { this._decayT = 0; this.evadePct = 0; this.wanted = Math.max(0, this.wanted - 1); if (this.wanted === 0) this._clearUnits(); }
    } else { this._decayT = 0; this.evadePct = 0; }
    return null;
  }
}
