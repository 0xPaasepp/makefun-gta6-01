// SOLMAR · police.js — wanted escalation: foot cops, cruisers that chase a
// side-offset aim point with a 5.5 m separation push (they CANNOT overlap the
// hero car), roadblocks at wanted 5, helicopter circling ahead of the
// player low enough to stay in the chase camera's frame.
// decrement would never spawn a cruiser.
import * as THREE from 'three';
import { ROADS_V, ROADS_H } from './config.js';
import { makeCarMesh, Car } from './vehicles.js';
import { makePerson } from './people.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.cops = [];    // {mesh,x,z,heading,bustT}
    this.cruisers = []; // Car instances
    this.heli = null; this.heliRotor = null;
    this.roadblocks = [];
    this.spawnCd = 0;
    this.decayT = 0;
    this.sirenPhase = 0;
  }
  nearestDist() {
    const g = this.game;
    let best = null;
    for (const c of this.cops) { const d = Math.hypot(c.x - g.px, c.z - g.pz); if (best === null || d < best) best = d; }
    for (const c of this.cruisers) { const d = Math.hypot(c.x - g.px, c.z - g.pz); if (best === null || d < best) best = d; }
    return best;
  }
  spawnCop(g) {
    const a = Math.random() * Math.PI * 2;
    const x = g.px + Math.sin(a) * 26, z = g.pz + Math.cos(a) * 26;
    const mesh = makePerson({ shirt: 0x1c2733, pants: 0x1c2733, skin: 0xd9a066, hair: 0x111111 });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.38), new THREE.MeshLambertMaterial({ color: 0x10151c }));
    cap.position.y = 1.92; mesh.add(cap);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.cops.push({ mesh, x, z, heading: a, bustT: 0 });
  }
  spawnCruiser(g) {
    // Spawn ON the road nearest the player, 30 m away along it, so the
    // cruiser starts on drivable surface and can close in on a straight run.
    let x, z;
    let bv = ROADS_V[0], dv = 1e9;
    for (const rx of ROADS_V) { const d = Math.abs(g.px - rx); if (d < dv) { dv = d; bv = rx; } }
    let bh = ROADS_H[0], dh = 1e9;
    for (const rz of ROADS_H) { const d = Math.abs(g.pz - rz); if (d < dh) { dh = d; bh = rz; } }
    const side = Math.random() < 0.5 ? -1 : 1;
    if (dv <= dh) { x = bv; z = g.pz + side * (26 + Math.random() * 10); }
    else { z = bh; x = g.px + side * (26 + Math.random() * 10); }
    x = Math.max(-195, Math.min(200, x));
    z = Math.max(-195, Math.min(195, z));
    const mesh = makeCarMesh('cruiser');
    this.scene.add(mesh);
    const car = new Car(mesh, 'cruiser', x, z, Math.atan2(g.px - x, g.pz - z));
    car.side = Math.random() < 0.5 ? -1 : 1; // side-offset side
    this.cruisers.push(car);
  }
  spawnRoadblocks(g) {
    if (this.roadblocks.length) return;
    const fx = Math.sin(g.heading), fz = Math.cos(g.heading);
    for (const off of [-4, 4]) {
      const px = -fz * off, pz = fx * off;
      const mesh = makeCarMesh('cruiser');
      this.scene.add(mesh);
      const car = new Car(mesh, 'cruiser', g.px + fx * 26 + px, g.pz + fz * 26 + pz, g.heading + Math.PI / 2);
      car.isRoadblock = true;
      this.roadblocks.push(car);
    }
  }
  spawnHeli(g) {
    if (this.heli) return;
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5), new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
    body.castShadow = true; grp.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.6), new THREE.MeshPhongMaterial({ color: 0x9adfe8, shininess: 120 }));
    glass.position.set(0, 0.2, 1.8); grp.add(glass);
    const rotor = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.add(blade);
    rotor.position.y = 1; grp.add(rotor);
    this.heliRotor = rotor;
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    skidL.position.set(-0.9, -1, 0); grp.add(skidL);
    const skidR = skidL.clone(); skidR.position.x = 0.9; grp.add(skidR);
    // searchlight cone under the heli
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(3, 8, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    cone.rotation.x = Math.PI; cone.position.y = -4.5; grp.add(cone);
    this.scene.add(grp);
    this.heli = grp;
    this.heliAngle = 0;
  }
  clearAll() {
    for (const c of this.cops) this.scene.remove(c.mesh);
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    for (const c of this.roadblocks) this.scene.remove(c.mesh);
    if (this.heli) this.scene.remove(this.heli);
    this.cops = []; this.cruisers = []; this.roadblocks = []; this.heli = null;
  }
  update(dt, g) {
    this.game = g;
    this.sirenPhase += dt;
    // --- spawning (dt-based cooldown, works at 1 FPS) ---
    this.spawnCd -= dt;
    if (this.spawnCd <= 0) {
      this.spawnCd = 2.2;
      const wantCops = g.wanted >= 1 ? Math.min(2, g.wanted) : 0;
      const wantCruisers = g.wanted >= 2 ? Math.min(3, g.wanted - 1) : 0;
      if (this.cops.length < wantCops) this.spawnCop(g);
      if (this.cruisers.length < wantCruisers) this.spawnCruiser(g);
      if (g.wanted >= 5) this.spawnRoadblocks(g);
      if (g.wanted >= 4) this.spawnHeli(g);
      if (g.wanted < 4 && this.heli) { this.scene.remove(this.heli); this.heli = null; }
      if (g.wanted < 5) {
        for (const rb of this.roadblocks) this.scene.remove(rb.mesh);
        this.roadblocks = [];
      }
    }
    // --- wanted decay when unseen ---
    const near = this.nearestDist();
    if (g.wanted > 0 && (near === null || near > 50)) {
      this.decayT += dt;
      if (this.decayT >= 5) { g.wanted = Math.max(0, g.wanted - 1); this.decayT = 0; }
    } else this.decayT = 0;
    // --- foot cops chase + bust ---
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      if (g.wanted === 0) { this.scene.remove(c.mesh); this.cops.splice(i, 1); continue; }
      const dx = g.px - c.x, dz = g.pz - c.z, d = Math.hypot(dx, dz) || 1;
      c.heading = Math.atan2(dx, dz);
      const sp = g.inCar ? 4.6 : 4.4;
      c.x += Math.sin(c.heading) * sp * dt;
      c.z += Math.cos(c.heading) * sp * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      const sw = Math.sin(performance.now() * 0.012) * 0.5;
      c.mesh.userData.legL.rotation.x = sw; c.mesh.userData.legR.rotation.x = -sw;
      if (!g.inCar && d < 1.7) {
        c.bustT += dt;
        if (c.bustT > 2.2) { g.busted(); return; }
      } else c.bustT = 0;
    }
    // --- cruisers: side-offset aim + 5.5 m separation push ---
    const fx = Math.sin(g.heading), fz = Math.cos(g.heading);
    for (let i = this.cruisers.length - 1; i >= 0; i--) {
      const c = this.cruisers[i];
      if (g.wanted < 2) { this.scene.remove(c.mesh); this.cruisers.splice(i, 1); continue; }
      // aim at a point 4 m to the side of the player, so the cruiser pulls
      // alongside instead of driving straight into the hero car
      const ax = g.px - fz * 4 * c.side, az = g.pz + fx * 4 * c.side;
      const dx = ax - c.x, dz = az - c.z, d = Math.hypot(dx, dz) || 1;
      const targetH = Math.atan2(dx, dz);
      let dh = targetH - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      const wantSpeed = d > 6 ? 29 : 12;
      c.speed += Math.max(-14 * dt, Math.min(10 * dt, wantSpeed - c.speed));
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      // separation push: never closer than 5.5 m to the hero car
      const hdx = c.x - g.px, hdz = c.z - g.pz, hd = Math.hypot(hdx, hdz);
      if (hd < 5.5 && hd > 0.01) {
        const push = (5.5 - hd);
        c.x += (hdx / hd) * push; c.z += (hdz / hd) * push;
        // a hard shove still dents the hero car a little
        if (hd < 3.5 && g.inCar && g.car) { g.car.condition = Math.max(40, g.car.condition - 2 * dt * 10); }
      }
      // keep out of buildings: steer toward the nearest road centreline and
      // drive along it toward the player instead of grinding against a wall
      if (this.city.isBlocked(c.x, c.z, 1.4)) {
        c.speed *= 0.6;
        let bv = ROADS_V[0], dv = 1e9;
        for (const rx of ROADS_V) { const d = Math.abs(c.x - rx); if (d < dv) { dv = d; bv = rx; } }
        let bh = ROADS_H[0], dh = 1e9;
        for (const rz of ROADS_H) { const d = Math.abs(c.z - rz); if (d < dh) { dh = d; bh = rz; } }
        const targetH = Math.abs(c.x - bv) < Math.abs(c.z - bh)
          ? Math.atan2(0, Math.sign(g.pz - c.z))
          : Math.atan2(Math.sign(g.px - c.x), 0);
        let dh2 = targetH - c.heading;
        while (dh2 > Math.PI) dh2 -= Math.PI * 2;
        while (dh2 < -Math.PI) dh2 += Math.PI * 2;
        c.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh2));
      }
      c.syncVisual(false);
      // blinking light bar
      const lb = c.mesh.userData.lightBar;
      if (lb) {
        const on = Math.sin(this.sirenPhase * 9) > 0;
        lb.userData.red.material.color.setHex(on ? 0xff2222 : 0x440000);
        lb.userData.blue.material.color.setHex(on ? 0x111133 : 0x2244ff);
      }
    }
    // --- helicopter: circles ahead of the player, LOW enough to stay in the
    // chase camera's frame (22 m ahead, 12.5 m up — the camera looks slightly
    // down, so a high heli would sit above the top of the frame) ---
    if (this.heli) {
      this.heliAngle += dt * 0.55;
      const ax = g.px + fx * 22, az = g.pz + fz * 22;
      const hx = ax + Math.sin(this.heliAngle) * 7;
      const hz = az + Math.cos(this.heliAngle) * 7;
      this.heli.position.set(hx, 12.5, hz);
      this.heli.rotation.y = Math.atan2(g.px - hx, g.pz - hz);
      if (this.heliRotor) this.heliRotor.rotation.y += dt * 22;
    }
  }
}
