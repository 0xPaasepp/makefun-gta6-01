// SOLMAR police — wanted escalation: foot cops, cruisers (chase/ram),
// roadblocks, helicopter at wanted 4, bust logic, wanted decay.
import * as THREE from 'three';
import { Car } from './vehicles.js';
import { buildPersonMesh } from './people.js';
import { makeRng } from './rng.js';

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.cruisers = [];
    this.footCops = [];
    this.roadblockCars = [];
    this.heli = null;
    this.roadblocks = [];
    this.bustT = 0;
    this.spawnT = 0;
    this.R = makeRng(777);
    this.heliMesh = null;
  }
  wantedLevel(wanted) { return wanted; }
  ensure(scene, wanted, px, pz) {
    // cruisers: wanted >= 2, up to wanted count
    const wantCruisers = wanted >= 2 ? Math.min(3, wanted - 1) : 0;
    while (this.cruisers.length < wantCruisers) {
      const a = this.R.range(0, Math.PI * 2);
      const c = new Car(scene, 'cruiser', px + Math.sin(a) * 40, pz + Math.cos(a) * 40, a, { parked: false });
      c.parked = false;
      this.cruisers.push(c);
    }
    while (this.cruisers.length > wantCruisers) {
      const c = this.cruisers.pop();
      scene.remove(c.mesh);
    }
    // foot cops: wanted >= 1, up to 2
    const wantFoot = wanted >= 1 ? Math.min(2, wanted) : 0;
    while (this.footCops.length < wantFoot) {
      const a = this.R.range(0, Math.PI * 2);
      const mesh = buildPersonMesh({ shirt: 0x1a2a4a, pants: 0x111111, skin: 0xc98d5f, guard: true });
      mesh.position.set(px + Math.sin(a) * 18, 0, pz + Math.cos(a) * 18);
      scene.add(mesh);
      this.footCops.push({ mesh, x: mesh.position.x, z: mesh.position.z, heading: a, bust: 0 });
    }
    while (this.footCops.length > wantFoot) {
      const c = this.footCops.pop();
      scene.remove(c.mesh);
    }
    // heli at wanted >= 4
    if (wanted >= 4 && !this.heliMesh) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 2),
        new THREE.MeshStandardMaterial({ color: 0x1a2a4a, metalness: 0.4, roughness: 0.4 }));
      body.castShadow = true; g.add(body);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.8, roughness: 0.2 }));
      glass.position.set(2, 0.1, 0); g.add(glass);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 9),
        new THREE.MeshStandardMaterial({ color: 0x222222 }));
      rotor.position.y = 1; g.add(rotor);
      g.userData.rotor = rotor;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x1a2a4a }));
      tail.position.set(-3.4, 0.3, 0); g.add(tail);
      const spot = new THREE.Mesh(new THREE.ConeGeometry(1.6, 14, 12),
        new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.14 }));
      spot.position.set(1, -7, 0); spot.rotation.x = Math.PI; g.add(spot);
      this.heliMesh = g;
      scene.add(g);
      this.heli = { mesh: g, angle: 0 };
    }
    if (wanted < 4 && this.heliMesh) {
      scene.remove(this.heliMesh); this.heliMesh = null; this.heli = null;
    }
    // roadblocks at wanted >= 3: two striped barriers + a parked cruiser
    if (wanted >= 3 && this.roadblocks.length === 0) {
      for (let i = 0; i < 2; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 0.6),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.4, 0.62),
          new THREE.MeshStandardMaterial({ color: 0xd21f1f, roughness: 0.6 }));
        const grp = new THREE.Group();
        grp.add(bar); grp.add(stripe);
        grp.position.set(px + 24 + i * 14, 0.7, pz + (i % 2 ? 8 : -8));
        scene.add(grp);
        this.roadblocks.push(grp);
      }
      const rb = new Car(scene, 'cruiser', px + 31, pz, Math.PI / 2, { parked: true });
      rb.parked = true;
      this.roadblockCars.push(rb);
    }
    if (wanted < 3) {
      for (const r of this.roadblocks) scene.remove(r);
      this.roadblocks = [];
      for (const rb of this.roadblockCars) scene.remove(rb.mesh);
      this.roadblockCars = [];
    }
  }
  update(dt, wanted, px, pz, inCar, playerCar, onBusted) {
    this.ensure(this.scene, wanted, px, pz);
    // cruisers chase + ram
    for (const c of this.cruisers) {
      const dx = px - c.x, dz = pz - c.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let dh = want - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const siren = Math.sin(performance.now() * 0.012) > 0;
      if (c.mesh.userData.sirenR) {
        c.mesh.userData.sirenR.material.emissiveIntensity = siren ? 2.5 : 0.2;
        c.mesh.userData.sirenB.material.emissiveIntensity = siren ? 0.2 : 2.5;
      }
      const input = { forward: d > 4, back: false, left: dh > 0.1, right: dh < -0.1 };
      c.update(dt, input, null, null);
      // ram: if close to player car, damage it and slow player
      if (inCar && playerCar && d < 4.5) {
        playerCar.damage = Math.min(100, playerCar.damage + 6 * dt);
        playerCar.speed *= (1 - dt * 0.6);
      }
    }
    // foot cops run at the player; bust on foot if close for 2s
    for (const cop of this.footCops) {
      const dx = px - cop.x, dz = pz - cop.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      cop.heading += (want - cop.heading) * Math.min(1, dt * 4);
      const sp = inCar ? 3.4 : 4.6;
      cop.x += Math.sin(cop.heading) * sp * dt;
      cop.z += Math.cos(cop.heading) * sp * dt;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      const swing = Math.sin(performance.now() * 0.012) * 0.5;
      cop.mesh.userData.arms[0].rotation.x = swing;
      cop.mesh.userData.arms[1].rotation.x = -swing;
      cop.mesh.userData.legs[0].rotation.x = -swing;
      cop.mesh.userData.legs[1].rotation.x = swing;
      if (!inCar && d < 2.6) {
        cop.bust += dt;
        if (cop.bust > 2) { cop.bust = 0; onBusted && onBusted(); }
      } else cop.bust = 0;
    }
    // heli circles overhead with spotlight
    if (this.heli) {
      this.heli.angle += dt * 0.5;
      const hx = px + Math.cos(this.heli.angle) * 18;
      const hz = pz + Math.sin(this.heli.angle) * 18;
      this.heli.mesh.position.set(hx, 26 + Math.sin(this.heli.angle * 2) * 2, hz);
      this.heli.mesh.lookAt(px, 0, pz);
      this.heli.mesh.userData.rotor.rotation.y += dt * 22;
    }
  }
  clearAll(scene) {
    for (const c of this.cruisers) scene.remove(c.mesh);
    for (const c of this.footCops) scene.remove(c.mesh);
    for (const rb of this.roadblockCars) scene.remove(rb.mesh);
    if (this.heliMesh) scene.remove(this.heliMesh);
    for (const r of this.roadblocks) scene.remove(r);
    this.cruisers = []; this.footCops = []; this.roadblocks = []; this.roadblockCars = [];
    this.heliMesh = null; this.heli = null;
  }
}
