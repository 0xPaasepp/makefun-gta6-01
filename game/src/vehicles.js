// Nine original car models, built from boxes and extruded wedges.
// Rebuild 12: every model now reads as a real car — grille, bumpers,
// mirrors, hubcapped rims, glowing headlights with light cones (golden
// hour: headlights on, streets alive). The Neon Sport is a true extruded
// wedge with hood scoop, side skirts and a wing. New: a police 'cruiser'
// (two-tone + light bar, built in) and a box 'truck' for traffic variety.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { makeRng, range, pick } from './rng.js';

export const CAR_MODELS = ['sedan', 'hatch', 'taxi', 'pickup', 'van', 'sport', 'coupe', 'cruiser', 'truck'];

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}

function wedgeBody(len, wid, h, color) {
  // Side-profile wedge, extruded across the width: low nose, high tail.
  const s = new THREE.Shape();
  s.moveTo(-len / 2, 0);
  s.lineTo(len / 2, 0);
  s.lineTo(len / 2 - 0.25, h * 0.55);
  s.lineTo(-len / 2 + 0.5, h);
  s.lineTo(-len / 2, h * 0.7);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: wid, bevelEnabled: false });
  g.translate(0, 0, -wid / 2);
  g.rotateY(Math.PI / 2); // extrusion across Z becomes across X after rotate
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
  return m;
}

function wedgeCabin(len, wid, h, color) {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, 0);
  s.lineTo(len / 2, 0);
  s.lineTo(len / 2 - 0.2, h * 0.8);
  s.lineTo(-len / 2 + 0.2, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: wid, bevelEnabled: false });
  g.translate(0, 0, -wid / 2);
  g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
  return m;
}

// Headlight pair: bright lenses only. (A translucent forward cone was
// tried in rebuild 12 and rendered as giant grey triangles — removed.)
function headlights(g, noseX, y, halfW) {
  for (const s of [1, -1]) {
    const hl = box(0.08, 0.16, 0.55, 0xfff6c0, noseX, y, s * halfW);
    hl.material = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
    g.add(hl);
  }
}

function tailLights(g, tailX, y, halfW) {
  for (const s of [1, -1]) {
    const tl = box(0.08, 0.14, 0.5, 0xcc2222, tailX, y, s * halfW);
    tl.material = new THREE.MeshBasicMaterial({ color: 0xdd3333 });
    g.add(tl);
  }
}

export function buildCarMesh(model, color) {
  const g = new THREE.Group();
  const glass = 0x1a2a3a;
  const dark = 0x14161a;
  const chrome = 0xc8c8c8;
  let wheelR = 0.34;
  const addWheel = (x, z) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 0.28, 12),
      new THREE.MeshLambertMaterial({ color: dark }));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, wheelR, z);
    g.add(w);
    // Hubcap: a bright disc on the outer face, so wheels read as wheels.
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.55, wheelR * 0.55, 0.3, 10),
      new THREE.MeshLambertMaterial({ color: chrome }));
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, wheelR, z);
    g.add(hub);
  };
  if (model === 'sport') {
    wheelR = 0.42;
    const body = wedgeBody(4.4, 1.9, 0.75, color);
    body.position.y = 0.42;
    g.add(body);
    const cabin = wedgeCabin(2.0, 1.6, 0.62, glass);
    cabin.position.set(-0.3, 1.05, 0);
    g.add(cabin);
    // Hood scoop + side skirts + rear wing + front splitter.
    g.add(box(0.9, 0.16, 0.7, dark, 1.35, 1.2, 0));
    g.add(box(3.4, 0.1, 0.08, dark, 0, 0.5, 0.98));
    g.add(box(3.4, 0.1, 0.08, dark, 0, 0.5, -0.98));
    g.add(box(0.5, 0.08, 2.0, dark, -2.2, 0.55, 0)); // splitter
    g.add(box(0.12, 0.1, 1.9, dark, -2.15, 1.05, 0));
    g.add(box(0.5, 0.06, 1.9, color, -2.1, 1.18, 0)); // wing
    // Neon underglow strip.
    const glow = box(3.6, 0.08, 1.7, 0xff2fb3, 0, 0.12, 0);
    glow.material = new THREE.MeshBasicMaterial({ color: 0xff2fb3 });
    g.add(glow);
    headlights(g, 2.21, 0.75, 0.6);
    tailLights(g, -2.21, 0.8, 0.6);
  } else if (model === 'cruiser') {
    // Police cruiser: black body, white doors, light bar (red/blue halves).
    g.add(box(4.4, 0.8, 1.85, 0x111111, 0, 0.72, 0));
    g.add(box(2.3, 0.7, 1.65, glass, -0.1, 1.45, 0));
    g.add(box(1.6, 0.78, 1.87, 0xe8e8e8, 0.1, 0.72, 0)); // white doors
    g.add(box(4.42, 0.1, 1.87, 0x222222, 0, 0.55, 0));
    const barR = box(0.5, 0.16, 0.6, 0xff2222, -0.1, 1.95, -0.32);
    barR.material = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    barR.name = 'lightbar-red';
    g.add(barR);
    const barB = box(0.5, 0.16, 0.6, 0x2244ff, -0.1, 1.95, 0.32);
    barB.material = new THREE.MeshBasicMaterial({ color: 0x2244ff });
    barB.name = 'lightbar-blue';
    g.add(barB);
    g.userData.barR = barR; g.userData.barB = barB;
    headlights(g, 2.21, 0.75, 0.6);
    tailLights(g, -2.21, 0.8, 0.6);
  } else if (model === 'truck') {
    g.add(box(2.0, 1.6, 2.0, color, 1.6, 1.1, 0)); // cab
    g.add(box(0.9, 0.9, 1.8, glass, 2.2, 1.5, 0));
    g.add(box(4.2, 2.0, 2.1, 0xd8d8d8, -1.2, 1.3, 0)); // cargo box
    g.add(box(4.22, 0.3, 2.12, color, -1.2, 2.4, 0));
    wheelR = 0.42;
    headlights(g, 2.55, 0.9, 0.7);
    tailLights(g, -3.31, 0.9, 0.7);
  } else if (model === 'coupe') {
    const body = wedgeBody(4.2, 1.85, 0.8, color);
    body.position.y = 0.4; g.add(body);
    const cabin = wedgeCabin(1.9, 1.55, 0.6, glass);
    cabin.position.set(-0.25, 1.1, 0); g.add(cabin);
    g.add(box(0.4, 0.06, 1.8, color, -2.0, 1.2, 0));
    g.add(box(4.25, 0.12, 1.87, chrome, 0, 0.5, 0)); // chrome bumper
    headlights(g, 2.11, 0.75, 0.6);
    tailLights(g, -2.11, 0.8, 0.6);
  } else if (model === 'pickup') {
    g.add(box(4.6, 0.85, 1.9, color, 0, 0.75, 0));
    g.add(box(1.7, 0.75, 1.8, glass, 0.9, 1.5, 0));
    g.add(box(2.2, 0.5, 1.7, dark, -1.2, 1.35, 0)); // open bed
    g.add(box(0.3, 0.5, 1.9, chrome, 2.3, 0.8, 0)); // bull bar
    wheelR = 0.4;
    headlights(g, 2.31, 0.8, 0.6);
    tailLights(g, -2.31, 0.8, 0.6);
  } else if (model === 'van') {
    g.add(box(4.8, 1.9, 2.0, color, 0, 1.25, 0));
    g.add(box(0.9, 0.8, 1.8, glass, 2.0, 1.5, 0));
    g.add(box(4.82, 0.12, 2.02, chrome, 0, 0.5, 0));
    wheelR = 0.38;
    headlights(g, 2.41, 1.0, 0.7);
    tailLights(g, -2.41, 1.0, 0.7);
  } else if (model === 'taxi') {
    g.add(box(4.3, 0.8, 1.85, 0xffc21a, 0, 0.72, 0));
    g.add(box(2.2, 0.7, 1.65, glass, -0.2, 1.45, 0));
    const sign = box(0.7, 0.22, 0.5, 0x111111, -0.2, 1.95, 0);
    sign.material = new THREE.MeshBasicMaterial({ color: 0xffe14d });
    g.add(sign);
    g.add(box(4.32, 0.18, 1.87, 0x111111, 0, 0.95, 0)); // checker band
    headlights(g, 2.16, 0.75, 0.6);
    tailLights(g, -2.16, 0.8, 0.6);
  } else if (model === 'hatch') {
    g.add(box(3.7, 0.75, 1.8, color, 0, 0.7, 0));
    g.add(box(2.0, 0.65, 1.65, glass, -0.3, 1.35, 0));
    g.add(box(3.72, 0.12, 1.82, chrome, 0, 0.45, 0));
    headlights(g, 1.86, 0.72, 0.6);
    tailLights(g, -1.86, 0.78, 0.6);
  } else { // sedan — the hero GT silhouette: wedge body, grille, mirrors
    const body = wedgeBody(4.4, 1.85, 0.8, color);
    body.position.y = 0.4; g.add(body);
    const cabin = wedgeCabin(2.2, 1.6, 0.62, glass);
    cabin.position.set(-0.15, 1.1, 0); g.add(cabin);
    g.add(box(0.12, 0.3, 1.2, dark, 2.21, 0.75, 0)); // grille
    g.add(box(4.45, 0.12, 1.87, chrome, 0, 0.5, 0)); // chrome bumper
    g.add(box(0.25, 0.12, 0.2, dark, 1.0, 1.35, 1.0)); // mirrors
    g.add(box(0.25, 0.12, 0.2, dark, 1.0, 1.35, -1.0));
    headlights(g, 2.21, 0.78, 0.6);
    tailLights(g, -2.21, 0.82, 0.6);
  }
  addWheel(1.45, 0.95); addWheel(1.45, -0.95);
  addWheel(-1.45, 0.95); addWheel(-1.45, -0.95);
  // Long golden-hour blob shadow: stretched EAST (away from the low
  // western sun) so the car sits on the road instead of floating on it.
  const blob = new THREE.Mesh(new THREE.CircleGeometry(2.3, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(1.1, 0.03, 0);
  blob.scale.set(1.5, 0.5, 1);
  g.add(blob);
  // Brake lights: dim red strip at the tail.
  const brake = box(0.1, 0.16, 1.5, 0x881111, -2.2, 0.85, 0);
  brake.material = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
  g.add(brake);
  g.userData.wheelR = wheelR;
  g.userData.model = model;
  return g;
}

export class Car {
  constructor(model, color, x, z, heading, parked = false) {
    this.model = model; this.color = color;
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.parked = parked;
    this.occupied = false; this.alarm = false; this.alarmT = 0;
    this.handbraking = false;
    this.maxSpeed = model === 'sport' ? CONFIG.sportMaxSpeed : CONFIG.carMaxSpeed;
    this.mesh = buildCarMesh(model, color);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
  }
  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }
  // Repaint in place (garage paint shop): rebuild the mesh with the new
  // colour, keeping position, heading and speed.
  repaint(color) {
    const scene = this.mesh.parent;
    if (scene) scene.remove(this.mesh);
    this.color = color;
    this.mesh = buildCarMesh(this.model, color);
    this.syncMesh();
    if (scene) scene.add(this.mesh);
  }
  // Arcade drive: W/S throttle, A/D steer (steering scales with speed).
  // Rebuild 13: Space is the handbrake — hard speed cut + sharper steer,
  // so the car can swing round a corner instead of ploughing through it.
  drive(input, dt) {
    const fwd = input.forward ? 1 : 0;
    const back = input.back ? 1 : 0;
    this.handbraking = !!(input.handbrake && Math.abs(this.speed) > 1);
    if (this.handbraking) {
      this.speed *= Math.max(0, 1 - 4.5 * dt);
      if (Math.abs(this.speed) < 0.4) this.speed = 0;
    } else {
      if (fwd) this.speed += CONFIG.carAccel * dt;
      if (back) this.speed -= (this.speed > 0.5 ? CONFIG.carBrake : CONFIG.carAccel * 0.6) * dt;
      if (!fwd && !back) this.speed *= Math.max(0, 1 - 1.6 * dt);
    }
    this.speed = Math.max(-9, Math.min(this.maxSpeed, this.speed));
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const dir = this.speed >= 0 ? 1 : -1;
    const steerGain = this.handbraking ? 1.9 : 1;
    this.heading += steer * CONFIG.carSteer * steerGain * dt * Math.min(1, Math.abs(this.speed) / 6) * dir;
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    // Stay in the city (soft wall).
    this.x = Math.max(CONFIG.world.minX + 4, Math.min(202, this.x));
    this.z = Math.max(CONFIG.world.minZ + 4, Math.min(CONFIG.world.maxZ - 4, this.z));
    this.syncMesh();
  }
}

export class TrafficSystem {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    const rng = makeRng(777);
    const models = ['sedan', 'hatch', 'taxi', 'pickup', 'van', 'coupe', 'truck'];
    const colors = [0xc23b3b, 0x3b7ac2, 0xe8e8e8, 0x2a2a2a, 0x3b9a5a, 0xd8a03b, 0x7a4a9a, 0xff5a8a, 0x2a9a8a];
    for (let i = 0; i < CONFIG.trafficCount; i++) {
      const vertical = i % 2 === 0;
      const road = pick(rng, vertical ? CONFIG.roadsX : CONFIG.roadsZ);
      const along = range(rng, -150, 150);
      const dir = rng() < 0.5 ? 1 : -1;
      const car = new Car(pick(rng, models), pick(rng, colors),
        vertical ? road + (dir > 0 ? 2.2 : -2.2) : along,
        vertical ? along : road + (dir > 0 ? 2.2 : -2.2),
        vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2));
      car.speed = range(rng, 7, 11) * dir;
      car.parked = false;
      this.list.push(car);
      scene.add(car.mesh);
    }
  }
  update(dt) {
    for (const c of this.list) {
      const v = Math.abs(c.speed);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      // Wrap around the city edge so traffic never runs out.
      if (c.x < -215) c.x = 200; if (c.x > 205) c.x = -210;
      if (c.z < -160) c.z = 155; if (c.z > 160) c.z = -155;
      c.syncMesh();
    }
  }
}

// Parked cars along road kerbs — close to the road, never far off-road.
export function makeParkedCars(scene) {
  const rng = makeRng(4242);
  const spots = [
    { x: -50, z: 10, model: 'sedan', color: CONFIG.m1Car.color, m1: true },
    { x: 180, z: 60, model: 'sport', color: CONFIG.m2Car.color, m2: true },
    { x: -53.4, z: -30, model: 'hatch', color: 0x3b7ac2 },
    { x: 103.4, z: 60, model: 'coupe', color: 0xc23b3b },
    { x: -3.4, z: -70, model: 'sedan', color: 0xe8e8e8 },
    { x: 53.4, z: 100, model: 'pickup', color: 0x2a7a4a },
    { x: -103.4, z: 20, model: 'van', color: 0xd8a03b },
    { x: 103.4, z: -20, model: 'taxi', color: 0xffc21a },
    { x: -46.6, z: -110, model: 'sedan', color: 0x7a4a9a },
    { x: 146.6, z: 40, model: 'hatch', color: 0x3b9a5a },
    { x: 53.4, z: -60, model: 'coupe', color: 0x2a2a2a },
    { x: -153.4, z: 90, model: 'sedan', color: 0x9a5a3b },
    { x: -103.4, z: -100, model: 'truck', color: 0x3b7ac2 },
    { x: 146.6, z: 120, model: 'sport', color: 0xffd23f },
  ];
  const cars = [];
  for (const s of spots) {
    const heading = s.x < 0 ? 0 : Math.PI; // parked facing along the road
    const car = new Car(s.model, s.color, s.x, s.z, s.m1 || s.m2 ? 0 : heading, true);
    car.isM1 = !!s.m1; car.isM2 = !!s.m2;
    cars.push(car);
    scene.add(car.mesh);
  }
  return cars;
}
