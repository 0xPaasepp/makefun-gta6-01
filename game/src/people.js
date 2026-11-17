// people.js — pedestrians, foot police and mission guards.
// Pedestrians stroll the sidewalks and flee from gunfire and stolen cars.
// Guards stand at mission spots and shoot back.

import * as THREE from 'three';
import { WORLD, PED_COLORS, TRAFFIC } from './config.js';
import { mulberry32, range, pick, clamp } from './rng.js';
import { nearestRoadCoord } from './city.js';

function makePersonMesh(color, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: o.skin || 0xc98d64 });
  const shirt = new THREE.MeshLambertMaterial({ color });
  const pants = new THREE.MeshLambertMaterial({ color: o.pants || 0x2b2d42 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.24), pants);
  legs.position.y = 0.43;
  legs.castShadow = true;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.3), shirt);
  torso.position.y = 1.16;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);
  const armGeo = new THREE.BoxGeometry(0.13, 0.6, 0.13);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.36, 1.15, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.36, 1.15, 0);
  g.add(armR);
  g.userData.armL = armL; g.userData.armR = armR; g.userData.legs = legs;
  if (o.police) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x16233f }));
    cap.position.y = 1.95;
    g.add(cap);
  }
  if (o.guard) {
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.4, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
    vest.position.y = 1.2;
    g.add(vest);
  }
  return g;
}

export class Person {
  constructor(scene, x, z, opts) {
    const o = opts || {};
    this.scene = scene;
    this.kind = o.kind || 'ped';
    this.mesh = makePersonMesh(o.color || pick(mulberry32((x * 31 + z * 17) | 0), PED_COLORS), o);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.heading = Math.random() * Math.PI * 2;
    this.speed = o.speed || range(mulberry32((x * 7 + z * 13) | 0), 1.2, 2.2);
    this.health = o.health || 100;
    this.alive = true;
    this.fleeing = false;
    this.fleeTimer = 0;
    this.shootCooldown = 0;
    this.walkPhase = Math.random() * 10;
    this.target = null; // guard target (player position)
  }

  get pos() { return this.mesh.position; }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = 0.25;
    }
    return !this.alive;
  }

  update(dt, ctx) {
    if (!this.alive) return;
    const p = this.mesh.position;
    this.walkPhase += dt * this.speed * 4;
    const swing = Math.sin(this.walkPhase) * 0.5;
    this.mesh.userData.armL.rotation.x = swing;
    this.mesh.userData.armR.rotation.x = -swing;

    if (this.kind === 'guard' && ctx && ctx.playerPos) {
      // Guards hold their post and shoot at the player when close.
      const dx = ctx.playerPos.x - p.x, dz = ctx.playerPos.z - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      this.heading = Math.atan2(dx, dz);
      this.shootCooldown -= dt;
      if (d < 34 && this.shootCooldown <= 0 && ctx.onGuardShoot) {
        this.shootCooldown = 1.1 + Math.random() * 0.7;
        ctx.onGuardShoot(this, d);
      }
      this.mesh.rotation.y = this.heading;
      return;
    }

    if (this.kind === 'cop') {
      // Foot cops run at the player when the wanted level is up.
      if (ctx && ctx.playerPos && ctx.wanted > 0) {
        const dx = ctx.playerPos.x - p.x, dz = ctx.playerPos.z - p.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 60) {
          this.heading = Math.atan2(dx, dz);
          const sp = 5.2;
          p.x += Math.sin(this.heading) * sp * dt;
          p.z += Math.cos(this.heading) * sp * dt;
          this.mesh.rotation.y = this.heading;
          if (ctx.onCopNear) ctx.onCopNear(this, d);
          return;
        }
      }
      // otherwise patrol slowly
    }

    if (this.fleeing) {
      this.fleeTimer -= dt;
      if (this.fleeTimer <= 0) this.fleeing = false;
      const sp = 5.5;
      p.x += Math.sin(this.heading) * sp * dt;
      p.z += Math.cos(this.heading) * sp * dt;
      this.mesh.rotation.y = this.heading;
    } else {
      // Stroll along the sidewalk grid.
      p.x += Math.sin(this.heading) * this.speed * dt;
      p.z += Math.cos(this.heading) * this.speed * dt;
      this.mesh.rotation.y = this.heading;
      const nearRoadX = Math.abs(p.x - nearestRoadCoord(p.x)) < 8;
      const nearRoadZ = Math.abs(p.z - nearestRoadCoord(p.z)) < 8;
      if (!nearRoadX && !nearRoadZ && Math.random() < dt * 0.2) {
        this.heading = (Math.floor(Math.random() * 4) * Math.PI) / 2;
      }
      if (Math.abs(p.x) > 200 || Math.abs(p.z) > 200) this.heading += Math.PI;
    }
    const c = ctx && ctx.city ? ctx.city.clampToWorld(p.x, p.z) : null;
    if (c) { p.x = c.x; p.z = c.z; }
  }

  fleeFrom(x, z) {
    const dx = this.mesh.position.x - x, dz = this.mesh.position.z - z;
    this.heading = Math.atan2(dx, dz);
    this.fleeing = true;
    this.fleeTimer = 3 + Math.random() * 2;
  }
}

export class Crowd {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(777);
    this.peds = [];
    this.cops = [];
    this.guards = [];
    for (let i = 0; i < TRAFFIC.pedestrians; i++) {
      const x = range(this.rng, -190, 190);
      const z = range(this.rng, -190, 180);
      const ped = new Person(scene, x, z, { kind: 'ped' });
      this.peds.push(ped);
    }
  }

  spawnCop(x, z) {
    const cop = new Person(this.scene, x, z, { kind: 'cop', color: 0x16233f, speed: 3 });
    this.cops.push(cop);
    return cop;
  }

  spawnGuard(x, z) {
    const guard = new Person(this.scene, x, z, { kind: 'guard', color: 0x8a1a1a, health: 100 });
    this.guards.push(guard);
    return guard;
  }

  removeGuard(g) {
    const i = this.guards.indexOf(g);
    if (i >= 0) { this.scene.remove(g.mesh); this.guards.splice(i, 1); }
  }

  removeCop(c) {
    const i = this.cops.indexOf(c);
    if (i >= 0) { this.scene.remove(c.mesh); this.cops.splice(i, 1); }
  }

  update(dt, ctx) {
    for (const p of this.peds) p.update(dt, ctx);
    for (const c of this.cops) c.update(dt, ctx);
    for (const g of this.guards) g.update(dt, ctx);
  }

  scareNear(x, z, radius) {
    for (const p of this.peds) {
      const dx = p.pos.x - x, dz = p.pos.z - z;
      if (dx * dx + dz * dz < radius * radius) p.fleeFrom(x, z);
    }
  }
}
