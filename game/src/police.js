// SOLMAR — police. Wanted 0–5 with escalation: foot cops at low wanted,
// cruisers that chase and ram, roadblocks at high wanted, a helicopter
// once the heat hits 3. Wanted decays when the player stays unseen.
// Foot cops can bust the player.

import { CONFIG } from './config.js';
import { makeCarMesh } from './vehicles.js';
import { makePersonMesh } from './people.js';

export class PoliceManager {
  constructor(THREE, scene, rng, colliders) {
    this.THREE = THREE; this.scene = scene; this.rng = rng;
    this.colliders = colliders;
    this.cops = []; // foot cops {mesh, x, z, heading, speed, bustT}
    this.cruisers = []; // {car-like}
    this.roadblocks = [];
    this.heli = null;
    this.heliOn = false;
    this.blink = 0;
    this.units = []; // HUD list: {name, tag}
    this._buildHeli();
  }

  _buildHeli() {
    const g = new this.THREE.Group();
    const body = new this.THREE.Mesh(
      new this.THREE.BoxGeometry(2.2, 1.4, 4.5),
      new this.THREE.MeshLambertMaterial({ color: 0x1c2733 })
    );
    g.add(body);
    const tail = new this.THREE.Mesh(
      new this.THREE.BoxGeometry(0.5, 0.5, 4),
      new this.THREE.MeshLambertMaterial({ color: 0x1c2733 })
    );
    tail.position.set(0, 0.3, 3.8); g.add(tail);
    const rotor = new this.THREE.Mesh(
      new this.THREE.BoxGeometry(9, 0.08, 0.5),
      new this.THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    rotor.position.y = 0.9; g.add(rotor);
    this.heliRotor = rotor;
    const cone = new this.THREE.Mesh(
      new this.THREE.ConeGeometry(6, 26, 16, 1, true),
      new this.THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.16, side: this.THREE.DoubleSide })
    );
    cone.position.y = -13; g.add(cone);
    g.visible = false;
    this.scene.add(g);
    this.heli = g;
  }

  _spawnCop(x, z) {
    const mesh = makePersonMesh(this.THREE, { skin: 0xe0ac69, shirt: 0x1b3a5c, pants: 0x1b3a5c, height: 1.85, hair: 0x111111 });
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.cops.push({ mesh, x, z, heading: 0, speed: 4.2, bustT: 0 });
  }

  _spawnCruiser(x, z) {
    const model = CONFIG.carModels.find((m) => m.id === 'cruiser');
    const mesh = makeCarMesh(this.THREE, model, this.rng);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.cruisers.push({ mesh, x, z, heading: 0, speed: 0, maxSpeed: 38, ramCd: 0 });
  }

  _spawnRoadblock(x, z, heading) {
    const model = CONFIG.carModels.find((m) => m.id === 'cruiser');
    const mesh = makeCarMesh(this.THREE, model, this.rng);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    this.roadblocks.push({ mesh, x, z, heading });
  }

  _clear(list) {
    for (const it of list) this.scene.remove(it.mesh);
    list.length = 0;
  }

  /** Keep spawned forces in line with the wanted level. */
  sync(wanted, px, pz, heading) {
    const wantCops = wanted >= 1 ? Math.min(2, wanted) : 0;
    const wantCruisers = wanted >= 2 ? Math.min(3, wanted - 1) : 0;
    while (this.cops.length < wantCops) this._spawnCop(px + this.rng.range(-30, 30), pz + this.rng.range(-30, 30));
    while (this.cops.length > wantCops) this.scene.remove(this.cops.pop().mesh);
    while (this.cruisers.length < wantCruisers) this._spawnCruiser(px + this.rng.range(-40, 40), pz + this.rng.range(-40, 40));
    while (this.cruisers.length > wantCruisers) this.scene.remove(this.cruisers.pop().mesh);
    // roadblocks at wanted 4+: two cruisers across the road ahead of the player
    if (wanted >= 4 && this.roadblocks.length === 0) {
      const fx = Math.sin(heading), fz = Math.cos(heading);
      const bx = px + fx * 55, bz = pz + fz * 55;
      this._spawnRoadblock(bx - fz * 3, bz + fx * 3, heading + Math.PI / 2);
      this._spawnRoadblock(bx + fz * 3, bz - fx * 3, heading + Math.PI / 2);
    }
    if (wanted < 4 && this.roadblocks.length) this._clear(this.roadblocks);
    // helicopter at wanted 3+
    this.heliOn = wanted >= 3;
    this.heli.visible = this.heliOn;
  }

  /** Chase behaviour. Returns 'busted' when a foot cop holds the player. */
  update(dt, wanted, px, pz, playerCar, onRam) {
    this.blink += dt;
    const flash = Math.floor(this.blink * 6) % 2 === 0;
    // lightbars blink red/blue
    for (const c of this.cruisers) {
      const lb = c.mesh.userData.lightbar;
      if (lb) {
        lb.red.color.setHex(flash ? 0xff0000 : 0x440000);
        lb.blue.color.setHex(flash ? 0x111188 : 0x2266ff);
      }
    }
    for (const rb of this.roadblocks) {
      const lb = rb.mesh.userData.lightbar;
      if (lb) {
        lb.red.color.setHex(flash ? 0xff0000 : 0x440000);
        lb.blue.color.setHex(flash ? 0x111188 : 0x2266ff);
      }
    }
    // foot cops run at the player while wanted; when the heat dies they
    // give up the chase and wander off instead of standing still.
    for (const cop of this.cops) {
      const dx = px - cop.x, dz = pz - cop.z;
      const d = Math.hypot(dx, dz);
      const want = wanted > 0 ? Math.atan2(dx, dz) : cop.heading + Math.sin(Date.now() * 0.0003 + cop.x) * 0.02;
      let dh = want - cop.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      cop.heading += Math.max(-4 * dt, Math.min(4 * dt, dh));
      cop.speed = wanted > 0 ? (d > 2 ? 4.4 : 0) : 1.6;
      cop.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.z += Math.cos(cop.heading) * cop.speed * dt;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      const sw = Math.sin(Date.now() * 0.012) * 0.5;
      cop.mesh.userData.legL.rotation.x = sw;
      cop.mesh.userData.legR.rotation.x = -sw;
      if (d < 1.6 && !playerCar) {
        cop.bustT += dt;
        if (cop.bustT > 1.6) return 'busted';
      } else cop.bustT = 0;
    }
    // cruisers chase and ram
    for (const c of this.cruisers) {
      const dx = px - c.x, dz = pz - c.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let dh = want - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, dh));
      c.speed = d > 6 ? c.maxSpeed : c.maxSpeed * 0.55;
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      const w = c.mesh.userData.wheels;
      for (const wheel of w) wheel.rotation.x += (c.speed / 0.36) * dt;
      if (d < 3.2) {
        c.ramCd -= dt;
        if (c.ramCd <= 0) { c.ramCd = 1.2; onRam && onRam(c); }
      }
    }
    // helicopter hovers above the player, rotor spinning
    if (this.heliOn) {
      this.heli.position.set(px + 6, 34, pz - 8);
      this.heliRotor.rotation.y += dt * 22;
      this.heli.rotation.y += dt * 0.2;
    }
    // HUD unit list
    this.units = [];
    this.cops.forEach((_, i) => this.units.push({ name: CONFIG.policeUnits[i % 6], tag: 'ON FOOT' }));
    this.cruisers.forEach((_, i) => this.units.push({ name: CONFIG.policeUnits[(i + 2) % 6], tag: i === 0 ? 'RAMMING' : 'PURSUIT' }));
    if (this.roadblocks.length) this.units.push({ name: CONFIG.policeUnits[4], tag: 'ROADBLOCK' });
    if (this.heliOn) this.units.push({ name: 'AIR 1', tag: 'HELICOPTER' });
    return null;
  }
}
