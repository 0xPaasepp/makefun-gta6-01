// SOLMAR · vehicles.js — 7 original car models, traffic, parked cars,
// hero-car physics helpers. Glossy paint, rotating wheels, brake lights,
// headlight cones, underglow on the Neon Sport.
import * as THREE from 'three';
import { CAR_MODELS, PARKED } from './config.js';
import { mulberry32, pick } from './rng.js';

function headlightCone() {
  const geo = new THREE.ConeGeometry(1.1, 9, 12, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffe9a3, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(geo, mat);
  cone.rotation.x = -Math.PI / 2 - 0.12; // point forward, slightly down
  return cone;
}

export function makeCarMesh(modelName, opts = {}) {
  const spec = CAR_MODELS[modelName];
  const g = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color: spec.color, shininess: 90, specular: 0x888888 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x18222e, shininess: 140, specular: 0xcccccc });
  const isVan = modelName === 'van';
  const isPickup = modelName === 'pickup';
  // body
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.62, 4.4), paint);
  body.position.y = 0.62; body.castShadow = true; g.add(body);
  // cabin
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, isVan ? 0.85 : 0.55, isVan ? 3.4 : 2.1), isVan ? paint : glass);
  cab.position.set(0, isVan ? 1.3 : 1.18, isVan ? -0.2 : -0.25); cab.castShadow = true; g.add(cab);
  if (isPickup) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.6), new THREE.MeshLambertMaterial({ color: 0x2c2f33 }));
    bed.position.set(0, 0.95, 1.3); g.add(bed);
  }
  if (modelName === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe9a3 }));
    sign.position.set(0, 1.62, -0.25); g.add(sign);
  }
  if (modelName === 'sport') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), new THREE.MeshLambertMaterial({ color: 0x1c1c1c }));
    spoiler.position.set(0, 1.15, -2.1); g.add(spoiler);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffc400, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06; g.add(glow);
    g.userData.underglow = glow;
  }
  // wheels (rotate with speed; front wheels steer visually)
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const hubMat = new THREE.MeshBasicMaterial({ color: 0x9aa0a8 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, wheelMat);
    tyre.rotation.z = Math.PI / 2; tyre.castShadow = true; w.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8), hubMat);
    hub.rotation.z = Math.PI / 2; w.add(hub);
    w.position.set(wx, 0.38, wz);
    g.add(w); wheels.push(w);
  }
  // headlights + cones, brake lights
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const hx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), hlMat);
    hl.position.set(hx, 0.72, 2.22); g.add(hl);
    const cone = headlightCone(); cone.position.set(hx, 0.7, 6.4); g.add(cone);
  }
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const brakes = [];
  for (const bx of [-0.65, 0.65]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), brakeMat.clone());
    b.position.set(bx, 0.72, -2.22); g.add(b); brakes.push(b);
  }
  // cruiser light bar
  let lightBar = null;
  if (modelName === 'cruiser') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.28; lightBar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.x = 0.28; lightBar.add(blue);
    lightBar.position.set(0, 1.55, -0.25);
    lightBar.userData = { red, blue };
    g.add(lightBar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.22, 4.42), new THREE.MeshLambertMaterial({ color: 0xf0ede4 }));
    stripe.position.y = 0.62; g.add(stripe);
  }
  g.userData = { wheels, brakes, lightBar, spec, modelName };
  if (opts.isNeon) g.userData.isNeon = true;
  return g;
}

export class Car {
  constructor(mesh, modelName, x, z, heading) {
    this.mesh = mesh; this.model = modelName;
    this.spec = CAR_MODELS[modelName];
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.steer = 0;
    this.isParked = false; this.isTraffic = false; this.isNeon = !!mesh.userData.isNeon;
    this.occupied = false; this.alarm = false; this.condition = 100;
    this.wheelSpin = 0;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
  }
  syncVisual(braking) {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.wheelSpin += (this.speed * 0.016) / 0.38;
    const u = this.mesh.userData;
    for (let i = 0; i < u.wheels.length; i++) {
      u.wheels[i].children[0].rotation.x = this.wheelSpin;
      u.wheels[i].children[1].rotation.x = this.wheelSpin;
      if (i < 2) u.wheels[i].rotation.y = this.steer * 0.4;
    }
    for (const b of u.brakes) b.material.color.setHex(braking ? 0xff1a1a : 0x550000);
  }
}

export class Vehicles {
  constructor(scene) {
    this.scene = scene;
    this.cars = []; // parked + traffic
    const rng = mulberry32(777);
    // parked cars (stealable)
    for (const [x, z, h, model] of PARKED) {
      const mesh = makeCarMesh(model);
      scene.add(mesh);
      const car = new Car(mesh, model, x, z, h);
      car.isParked = true;
      this.cars.push(car);
    }
    // Neon Sport at the marina
    const neonMesh = makeCarMesh('sport', { isNeon: true });
    scene.add(neonMesh);
    const neon = new Car(neonMesh, 'sport', 186, -92, Math.PI / 2);
    neon.isParked = true;
    this.cars.push(neon);
    this.neonSport = neon;
    // 16 traffic cars on block-perimeter loops
    this.traffic = [];
    const models = ['sedan', 'hatch', 'taxi', 'pickup', 'van', 'sedan', 'hatch'];
    for (let i = 0; i < 16; i++) {
      const model = models[i % models.length];
      const mesh = makeCarMesh(model);
      scene.add(mesh);
      const cx = [-125, -75, -25, 25, 75, 125][i % 6];
      const cz = [-125, -75, -25, 25, 75, 125][Math.floor(i / 6) % 6];
      const car = new Car(mesh, model, cx + 25, cz - 25, 0);
      car.isTraffic = true; car.occupied = true;
      // rectangular loop around the block (on the roads)
      const hx = 25, hz = 25;
      car.loop = [
        [cx + hx, cz - hz], [cx + hx, cz + hz], [cx - hx, cz + hz], [cx - hx, cz - hz],
      ];
      car.wp = i % 4;
      car.cruise = 7 + rng() * 4;
      this.traffic.push(car);
      this.cars.push(car);
    }
  }
  nearestCar(x, z, maxDist, includeTraffic = true) {
    let best = null, bd = maxDist;
    for (const c of this.cars) {
      if (c.isTraffic && !includeTraffic) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  updateTraffic(dt, hero) {
    for (const c of this.traffic) {
      const [tx, tz] = c.loop[c.wp];
      const dx = tx - c.x, dz = tz - c.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) { c.wp = (c.wp + 1) % 4; continue; }
      const targetH = Math.atan2(dx, dz);
      let dh = targetH - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
      // slow down if the hero car is right ahead
      const dhHero = hero && hero.inCar ? Math.hypot(hero.px - c.x, hero.pz - c.z) : 999;
      const want = dhHero < 10 ? 0 : c.cruise;
      c.speed += Math.max(-10 * dt, Math.min(6 * dt, want - c.speed));
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.syncVisual(false);
    }
  }
}
