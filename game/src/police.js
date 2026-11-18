// Wanted system + police: foot cops who can bust the player, cruisers
// that chase and ram, roadblocks at high wanted. Wanted decays when the
// player stays unseen.
import { CONFIG } from './config.js';
import { createCarMesh, Car } from './vehicles.js';
import { createPersonMesh } from './people.js';

const POLICE_MODEL = { id: 'police', name: 'Cruiser', color: 0xe8e8e8, topSpeed: 34, accel: 18, len: 4.6, wid: 2.0 };

export class Police {
  constructor(scene, THREE, game) {
    this.scene = scene;
    this.THREE = THREE;
    this.game = game;
    this.wanted = 0;
    this.cops = [];
    this.cruisers = [];
    this.roadblocks = [];
    this.bustTimer = 0;
    this.lastSeenAt = 0;
    this.lastDecayAt = 0;
    this.spawnTimer = 0;
    this.chaseState = 'none';
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    if (this.wanted === 0) this.clearRoadblocks();
  }

  addWanted(n) {
    this.setWanted(this.wanted + n);
  }

  clearRoadblocks() {
    for (const c of this.roadblocks) this.scene.remove(c.group);
    this.roadblocks = [];
  }

  spawnCop(x, z) {
    const mesh = createPersonMesh(this.THREE, 0x2040c0, { pants: 0x101418 });
    const cop = {
      group: mesh, x, z, heading: 0, speed: CONFIG.police.footCopSpeed,
      bustHold: 0,
    };
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.cops.push(cop);
    return cop;
  }

  spawnCruiser(x, z) {
    const car = new Car(this.THREE, POLICE_MODEL, x, z, 0);
    car.isPolice = true;
    const barMat = new this.THREE.MeshLambertMaterial({ color: 0x2040c0, emissive: 0x102060 });
    const bar = new this.THREE.Mesh(
      new this.THREE.BoxGeometry(0.5, 0.18, 1.1),
      barMat
    );
    bar.position.set(0, 1.55, 0);
    car.group.add(bar);
    car.lightBarMat = barMat;
    this.scene.add(car.group);
    this.cruisers.push(car);
    return car;
  }

  spawnRoadblock(x, z, heading) {
    const car = new Car(this.THREE, POLICE_MODEL, x, z, heading);
    car.isPolice = true;
    this.scene.add(car.group);
    this.roadblocks.push(car);
    this.spawnCop(x + 3, z + 3);
    this.spawnCop(x - 3, z - 3);
  }

  nearestCopDistance(px, pz) {
    let best = Infinity;
    for (const c of this.cops) best = Math.min(best, Math.hypot(c.x - px, c.z - pz));
    for (const c of this.cruisers) best = Math.min(best, Math.hypot(c.x - px, c.z - pz));
    return best;
  }

  update(dt, now) {
    const g = this.game;
    const px = g.player.x;
    const pz = g.player.z;
    const inCar = !!g.player.car;

    // Spawning.
    this.spawnTimer -= dt;
    if (this.wanted >= 1 && this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      const wantCops = Math.min(1 + this.wanted, CONFIG.police.maxFootCops);
      const wantCruisers = this.wanted >= 2 ? Math.min(this.wanted - 1, CONFIG.police.maxCruisers) : 0;
      if (this.cops.length < wantCops) {
        const a = Math.random() * Math.PI * 2;
        this.spawnCop(px + Math.cos(a) * 45, pz + Math.sin(a) * 45);
      }
      if (this.cruisers.length < wantCruisers) {
        const a = Math.random() * Math.PI * 2;
        this.spawnCruiser(px + Math.cos(a) * 55, pz + Math.sin(a) * 55);
      }
      if (this.wanted >= 4 && this.roadblocks.length === 0) {
        const a = Math.random() * Math.PI * 2;
        this.spawnRoadblock(px + Math.cos(a) * 35, pz + Math.sin(a) * 35, a);
      }
    }

    // Seen check + decay.
    const nearest = this.nearestCopDistance(px, pz);
    const seen = nearest < CONFIG.police.seenDistance;
    if (seen) {
      this.lastSeenAt = now;
      this.lastDecayAt = now;
    } else if (this.wanted > 0 && now - this.lastSeenAt > CONFIG.police.decayUnseenSeconds) {
      if (now - this.lastDecayAt > CONFIG.police.decayStepSeconds) {
        this.lastDecayAt = now;
        this.setWanted(this.wanted - 1);
        if (this.wanted === 0) g.onWantedCleared();
      }
    }

    // Foot cops chase on foot; they can only bust a player on foot.
    this.bustTimer = 0;
    for (const c of this.cops) {
      const dx = px - c.x;
      const dz = pz - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        c.heading = Math.atan2(-dx, -dz) + Math.PI;
        const step = Math.min(d, c.speed * dt);
        c.x += (dx / d) * step;
        c.z += (dz / d) * step;
      }
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y = c.heading;
      if (!inCar && d < CONFIG.police.bustDistance) {
        this.bustTimer += dt;
        if (this.bustTimer > CONFIG.police.bustTime) g.onBusted();
      }
    }
    // Despawn cops that fell far behind.
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      if (Math.hypot(c.x - px, c.z - pz) > 140) {
        this.scene.remove(c.group);
        this.cops.splice(i, 1);
      }
    }

    // Cruisers chase the player's car and ram it: 40 damage per second
    // of contact (attempt-2 fix: a flat rate, not a per-hit chunk).
    for (let i = this.cruisers.length - 1; i >= 0; i--) {
      const c = this.cruisers[i];
      const dx = px - c.x;
      const dz = pz - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        const targetHeading = Math.atan2(-dx, -dz) + Math.PI;
        let dh = targetHeading - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
        c.speed = Math.min(POLICE_MODEL.topSpeed, c.speed + POLICE_MODEL.accel * dt);
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
      }
      c.sync();
      // Flashing light bar: red / blue alternating twice a second.
      if (c.lightBarMat) {
        const red = Math.floor(this.game.now * 4) % 2 === 0;
        c.lightBarMat.emissive.setHex(red ? 0xff2020 : 0x2040ff);
      }
      if (inCar && d < 3.2) {
        g.damagePlayer(CONFIG.police.cruiserRamDamagePerSec * dt);
        // Shove the player's car a little.
        g.player.car.x += (dx / (d || 1)) * 1.5 * dt;
        g.player.car.z += (dz / (d || 1)) * 1.5 * dt;
      }
      if (Math.hypot(c.x - px, c.z - pz) > 160) {
        this.scene.remove(c.group);
        this.cruisers.splice(i, 1);
      }
    }

    this.chaseState =
      this.wanted === 0 ? 'none'
      : this.cruisers.length > 0 ? 'chase'
      : this.roadblocks.length > 0 ? 'roadblock'
      : 'foot';
  }
}
