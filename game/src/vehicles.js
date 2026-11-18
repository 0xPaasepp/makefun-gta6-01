// Cars: 7 original models built from boxes, traffic that loops the road
// grid, parked cars along the roadsides (close enough to reach on foot),
// and the Neon Sport at the marina.
import { CONFIG } from './config.js';
import { mulberry32, range, pick } from './rng.js';

const ROADS = [-150, -100, -50, 0, 50, 100, 150];

export function createCarMesh(THREE, model) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: model.color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(model.len, 0.7, model.wid), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(model.len * 0.45, 0.6, model.wid * 0.85), glassMat);
  cabin.position.set(-model.len * 0.05, 1.2, 0);
  g.add(cabin);
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [
    [model.len * 0.32, model.wid / 2], [model.len * 0.32, -model.wid / 2],
    [-model.len * 0.32, model.wid / 2], [-model.len * 0.32, -model.wid / 2],
  ]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
  }
  // Headlights + taillights.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x554400 });
  for (const wz of [-model.wid * 0.3, model.wid * 0.3]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.3), lightMat);
    h.position.set(model.len / 2, 0.6, wz);
    g.add(h);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xc02020, emissive: 0x440000 });
  for (const wz of [-model.wid * 0.3, model.wid * 0.3]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.3), tailMat);
    t.position.set(-model.len / 2, 0.6, wz);
    g.add(t);
  }
  g.userData.tailMats = [tailMat];
  if (model.id === 'sport') {
    const spoiler = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.08, model.wid * 0.9),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    spoiler.position.set(-model.len / 2 + 0.1, 1.15, 0);
    g.add(spoiler);
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(model.len * 0.9, 0.06, model.wid * 0.9),
      new THREE.MeshLambertMaterial({ color: 0x19e3d6, emissive: 0x0a8a80 })
    );
    glow.position.y = 0.12;
    g.add(glow);
  }
  if (model.id === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xf5e6a0, emissive: 0x554400 })
    );
    sign.position.set(0, 1.62, 0);
    g.add(sign);
  }
  if (model.id === 'truck') {
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(model.len * 0.55, 1.6, model.wid * 0.95),
      new THREE.MeshLambertMaterial({ color: 0x6a6f75 })
    );
    cargo.position.set(-model.len * 0.18, 1.35, 0);
    g.add(cargo);
  }
  return g;
}

export class Car {
  constructor(THREE, model, x, z, heading) {
    this.model = model;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.occupied = false;
    this.isPlayer = false;
    this.isPolice = false;
    this.group = createCarMesh(THREE, model);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = -heading;
  }

  sync() {
    this.group.position.set(this.x, 0, this.z);
    // Local +x is the car's nose (headlights); it must point along
    // (sin h, cos h), which needs rotation.y = h - PI/2.
    this.group.rotation.y = this.heading - Math.PI / 2;
  }

  setBraking(on) {
    const mats = this.group.userData.tailMats;
    if (!mats) return;
    for (const m of mats) m.emissiveIntensity = on ? 2.5 : 1;
  }
}

// Traffic: cars loop along the road grid, wrapping at the city edge.
export class Traffic {
  constructor(scene, THREE) {
    this.cars = [];
    const rand = mulberry32(777);
    const models = CONFIG.cars.filter((m) => m.id !== 'sport');
    for (let i = 0; i < CONFIG.trafficCount; i++) {
      const model = pick(rand, models);
      const alongNS = rand() < 0.5;
      const road = pick(rand, ROADS);
      const dir = rand() < 0.5 ? 1 : -1;
      const x = alongNS ? road + (dir > 0 ? 2.5 : -2.5) : range(rand, -190, 190);
      const z = alongNS ? range(rand, -190, 190) : road + (dir > 0 ? 2.5 : -2.5);
      const heading = alongNS ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const car = new Car(THREE, model, x, z, heading);
      car.speed = range(rand, 9, 15);
      car.alongNS = alongNS;
      car.dir = dir;
      scene.add(car.group);
      this.cars.push(car);
    }
  }

  update(dt) {
    for (const c of this.cars) {
      if (c.alongNS) {
        c.z += c.dir * c.speed * dt;
        if (c.z > 195) c.z = -195;
        if (c.z < -195) c.z = 195;
      } else {
        c.x += c.dir * c.speed * dt;
        if (c.x > 195) c.x = -195;
        if (c.x < -195) c.x = 195;
      }
      c.sync();
    }
  }
}

// Parked cars along roadsides, close to the road so the player can reach
// them on foot. A few are occupied — stealing one draws police attention.
export function createParkedCars(scene, THREE) {
  const rand = mulberry32(4242);
  const models = CONFIG.cars.filter((m) => m.id !== 'sport');
  const spots = [
    { x: 5.5, z: 40, h: 0 }, { x: -5.5, z: 62, h: Math.PI },
    { x: 55.5, z: -30, h: 0 }, { x: 105.5, z: 80, h: 0 },
    { x: -45.5, z: -80, h: Math.PI }, { x: 155.5, z: 20, h: 0 },
    { x: -105.5, z: 110, h: Math.PI }, { x: 5.5, z: -120, h: 0 },
    { x: 45.5, z: 140, h: 0 }, { x: -155.5, z: -40, h: Math.PI },
  ];
  const cars = [];
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const model = pick(rand, models);
    const car = new Car(THREE, model, s.x, s.z, s.h);
    car.occupied = i % 3 === 1;
    scene.add(car.group);
    cars.push(car);
  }
  // The Neon Sport at the marina.
  const sport = CONFIG.cars.find((m) => m.id === 'sport');
  const neon = new Car(THREE, sport, CONFIG.spots.neonSport.x, CONFIG.spots.neonSport.z, Math.PI / 2);
  neon.isMissionCar = true;
  scene.add(neon.group);
  cars.push(neon);
  return cars;
}
