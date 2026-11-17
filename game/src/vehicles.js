// vehicles.js — car models and traffic. A car is a small group of boxes with
// wheels; traffic cars follow the road grid, stop for nothing, and honk never.
// Parked cars sit at the kerb waiting to be stolen.

import * as THREE from 'three';
import { WORLD, CAR_MODELS, TRAFFIC } from './config.js';
import { mulberry32, range, intRange, pick, angleLerp, clamp } from './rng.js';
import { nearestRoadCoord, snapToRoad, isRoad } from './city.js';

export function makeCarMesh(model, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: model.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), darkMat);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 2.2), bodyMat);
  roof.position.set(0, 1.4, -0.2);
  g.add(roof);
  // headlights + taillights
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x554400 });
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lightMat);
    hl.position.set(sx, 0.62, 2.22);
    g.add(hl);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x550000 });
  for (const sx of [-0.65, 0.65]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), tailMat);
    tl.position.set(sx, 0.62, -2.22);
    g.add(tl);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  if (model.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xffe27a, emissive: 0x443300 }));
    sign.position.set(0, 1.55, -0.2);
    g.add(sign);
  }
  if (o.police) {
    const barMat = new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x1122aa });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), barMat);
    bar.position.set(0, 1.5, -0.2);
    g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.72;
    g.add(stripe);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(scene, model, x, z, heading, opts) {
    this.model = model;
    this.opts = opts || {};
    this.mesh = makeCarMesh(model, this.opts);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading || 0;
    scene.add(this.mesh);
    this.speed = 0;
    this.steer = 0;
    this.heading = heading || 0;
    this.occupied = !!this.opts.occupied;
    this.isPlayerCar = false;
    this.stolen = false;
    this.alarm = false;
    this.scene = scene;
  }

  get pos() { return this.mesh.position; }

  drive(dt, throttle, steerInput) {
    const m = this.model;
    if (throttle > 0) this.speed += m.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= 42 * dt;      // brake
      else this.speed = Math.max(-12, this.speed + m.accel * 0.6 * dt); // reverse
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 10 * dt);
    }
    this.speed = clamp(this.speed, -12, m.top);
    const steerTarget = steerInput * 0.55 * (this.speed >= 0 ? 1 : -1);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    this.heading += this.steer * (this.speed / m.top) * 2.6 * dt;
    this.mesh.position.x += Math.sin(this.heading) * this.speed * dt;
    this.mesh.position.z += Math.cos(this.heading) * this.speed * dt;
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * dt / 0.38;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    // front wheels steer visually
    this.mesh.userData.wheels[0].rotation.y = this.steer * 0.4;
    this.mesh.userData.wheels[1].rotation.y = this.steer * 0.4;
  }
}

// --- Traffic: cars that loop around the road grid ---------------------------
export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(4242);
    this.cars = [];
    this.spawn();
  }

  spawn() {
    const rng = this.rng;
    for (let i = 0; i < TRAFFIC.cars; i++) {
      const model = pick(rng, CAR_MODELS);
      const alongX = rng() < 0.5;
      const road = pick(rng, [-168, -126, -84, -42, 0, 42, 84, 126, 168]);
      const other = range(rng, -189, 189);
      const x = alongX ? other : road;
      const z = alongX ? road : other;
      const heading = alongX ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
      const car = new Car(this.scene, model, x, z, heading, { occupied: true });
      car.speed = range(rng, 8, 14);
      car.dir = heading;
      car.targetRoad = road;
      car.alongX = alongX;
      this.cars.push(car);
    }
    // Parked cars at the kerb.
    this.parked = [];
    for (let i = 0; i < TRAFFIC.parkedCars; i++) {
      const model = pick(rng, CAR_MODELS);
      const alongX = rng() < 0.5;
      const road = pick(rng, [-168, -126, -84, -42, 0, 42, 84, 126, 168]);
      const other = range(rng, -180, 180);
      const x = alongX ? other : road + (rng() < 0.5 ? 4.2 : -4.2);
      const z = alongX ? road + (rng() < 0.5 ? 4.2 : -4.2) : other;
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue; // keep the plaza clear
      const heading = alongX ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
      const car = new Car(this.scene, model, x, z, heading, { occupied: rng() < 0.35 });
      this.parked.push(car);
    }
  }

  allCars() { return this.cars.concat(this.parked); }

  update(dt, playerCar) {
    const rng = this.rng;
    for (const car of this.cars) {
      if (car === playerCar) continue;
      // Simple grid driving: keep going, turn at intersections sometimes.
      const p = car.mesh.position;
      const snapped = snapToRoad(p.x, p.z);
      // If drifting off the road line, steer back onto it.
      if (car.alongX) {
        const dz = snapped.z - p.z;
        car.heading = angleLerp(car.heading, Math.PI / 2 * Math.sign(Math.sin(car.heading) || 1), Math.min(1, dt * 2));
        p.z += clamp(dz, -1, 1) * dt * 4;
      } else {
        const dx = snapped.x - p.x;
        car.heading = angleLerp(car.heading, Math.sin(car.heading) >= 0 ? Math.PI : 0, Math.min(1, dt * 2));
        p.x += clamp(dx, -1, 1) * dt * 4;
      }
      // Random turn at an intersection.
      const onIntersection = Math.abs(p.x - nearestRoadCoord(p.x)) < 1.2 && Math.abs(p.z - nearestRoadCoord(p.z)) < 1.2;
      if (onIntersection && rng() < dt * 0.25) {
        car.alongX = !car.alongX;
        const turn = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        car.heading += turn;
      }
      // Keep speed, wrap around the map edges.
      car.speed += (11 - car.speed) * Math.min(1, dt);
      p.x += Math.sin(car.heading) * car.speed * dt;
      p.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.rotation.y = car.heading;
      if (p.x > 205) p.x = -205; if (p.x < -205) p.x = 205;
      if (p.z > 205) p.z = -205; if (p.z < -205) p.z = 205;
      const spin = car.speed * dt / 0.38;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    }
  }

  // Nearest car (traffic or parked) within range of a point.
  nearestCar(x, z, maxDist) {
    let best = null, bd = maxDist * maxDist;
    for (const car of this.allCars()) {
      const dx = car.mesh.position.x - x, dz = car.mesh.position.z - z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }

  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    const j = this.parked.indexOf(car);
    if (j >= 0) this.parked.splice(j, 1);
  }
}
