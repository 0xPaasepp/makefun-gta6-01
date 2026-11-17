// police.js — the wanted system and the Solmar Police response.
// Stars rise when you steal cars, shoot, or hit people; they fall when no cop
// can see you for a while. Police cars chase and ram; foot cops chase and bust.

import * as THREE from 'three';
import { WANTED } from './config.js';
import { clamp, angleLerp } from './rng.js';
import { Car, makeCarMesh } from './vehicles.js';

const POLICE_MODEL = { name: 'SPD Interceptor', color: 0x1a1a1a, top: 48, accel: 30, seats: 4, value: 0 };

export class Police {
  constructor(scene, city, crowd) {
    this.scene = scene;
    this.city = city;
    this.crowd = crowd;
    this.stars = 0;
    this.unseenTimer = 0;
    this.cars = [];
    this.heat = 0; // 0..1, how "hot" the chase feels (drives siren + music)
    this._px = 0;  // last known player position (spawn anchor before first update)
    this._pz = 42;
  }

  addStars(n, reason) {
    this.stars = clamp(this.stars + n, 0, WANTED.maxStars);
    this.unseenTimer = 0;
    this.syncForce();
    return this.stars;
  }

  setStars(n) {
    this.stars = clamp(n, 0, WANTED.maxStars);
    this.unseenTimer = 0;
    this.syncForce();
  }

  // Spawn / remove police cars and foot cops to match the wanted level.
  syncForce() {
    const wantCars = WANTED.copCarsPerStar[this.stars];
    const wantCops = WANTED.footCopsPerStar[this.stars];
    while (this.cars.length < wantCars) this.spawnCar();
    while (this.cars.length > wantCars) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    while (this.crowd.cops.length < wantCops) {
      const a = Math.random() * Math.PI * 2;
      this.crowd.spawnCop(this._px + Math.cos(a) * 25, this._pz + Math.sin(a) * 25);
    }
    while (this.crowd.cops.length > wantCops) {
      this.crowd.removeCop(this.crowd.cops[this.crowd.cops.length - 1]);
    }
  }

  spawnCar() {
    const a = Math.random() * Math.PI * 2;
    const x = this._px + Math.cos(a) * 45;
    const z = this._pz + Math.sin(a) * 45;
    const car = new Car(this.scene, POLICE_MODEL, x, z, Math.atan2(this._px - x, this._pz - z), { police: true, occupied: true });
    car.isPolice = true;
    this.cars.push(car);
    return car;
  }

  // Returns true when any police unit can currently see the player.
  anyoneSees(px, pz, inCar) {
    const seeDist = inCar ? 70 : 46;
    for (const c of this.cars) {
      const dx = c.mesh.position.x - px, dz = c.mesh.position.z - pz;
      if (dx * dx + dz * dz < seeDist * seeDist) return true;
    }
    for (const cop of this.crowd.cops) {
      const dx = cop.pos.x - px, dz = cop.pos.z - pz;
      if (dx * dx + dz * dz < 30 * 30) return true;
    }
    return false;
  }

  update(dt, px, pz, inCar, playerSpeed) {
    this._px = px; this._pz = pz;
    if (this.stars === 0) { this.heat = Math.max(0, this.heat - dt * 0.5); return; }

    const seen = this.anyoneSees(px, pz, inCar);
    if (seen) this.unseenTimer = 0;
    else {
      this.unseenTimer += dt;
      if (this.unseenTimer > WANTED.decayDelaySec) {
        this.stars -= 1;
        this.unseenTimer = 0;
        this.syncForce();
      }
    }
    this.heat = seen ? 1 : Math.max(0, this.heat - dt * 0.2);

    // Police cars: steer toward the player, ram on contact.
    for (const car of this.cars) {
      const p = car.mesh.position;
      const dx = px - p.x, dz = pz - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const wantHeading = Math.atan2(dx, dz);
      const speedTarget = d > 60 ? 46 : d > 12 ? 40 : 26;
      car.speed += (speedTarget - car.speed) * Math.min(1, dt * 1.2);
      car.heading = angleLerp(car.heading, wantHeading, Math.min(1, dt * 2.2));
      // avoid driving through buildings: nudge around colliders
      if (this.city.blocked(p.x + Math.sin(car.heading) * 4, p.z + Math.cos(car.heading) * 4, 1)) {
        car.heading += dt * 2.5;
      }
      p.x += Math.sin(car.heading) * car.speed * dt;
      p.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt / 0.38;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
      // respawn far-away stragglers near the player
      if (d > 160) {
        const a = Math.random() * Math.PI * 2;
        p.x = px + Math.cos(a) * 55;
        p.z = pz + Math.sin(a) * 55;
      }
    }
  }

  // Police car contact with the player's car: returns impact speed for damage.
  checkRam(playerCar) {
    if (!playerCar) return 0;
    let impact = 0;
    for (const c of this.cars) {
      const dx = c.mesh.position.x - playerCar.mesh.position.x;
      const dz = c.mesh.position.z - playerCar.mesh.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 3.4) {
        impact = Math.max(impact, Math.abs(c.speed - playerCar.speed));
        // shove the player car sideways a little
        playerCar.mesh.position.x += (dx / (d || 1)) * -0.6;
        playerCar.mesh.position.z += (dz / (d || 1)) * -0.6;
        c.speed *= 0.6;
      }
    }
    return impact;
  }

  clearAll() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
    for (const c of [...this.crowd.cops]) this.crowd.removeCop(c);
    this.stars = 0;
    this.unseenTimer = 0;
  }
}
