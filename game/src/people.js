// People: 26 pedestrians wandering the sidewalks, Mara at the garage,
// Kito at the docks, and 4 armed guards at the harbour for mission 3.
import { CONFIG } from './config.js';
import { mulberry32, range, pick } from './rng.js';

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c94a, 0x9a4ad8, 0x4ad8d0, 0xe08a3a, 0x8a8f96];

export function createPersonMesh(THREE, shirtColor, opts = {}) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a078 });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: opts.pants ?? 0x2a2f3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.32), shirt);
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.62;
  g.add(head);
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), pants);
    leg.position.set(sx, 0.35, 0);
    g.add(leg);
  }
  for (const sx of [-0.36, 0.36]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), skin);
    arm.position.set(sx, 1.05, 0);
    g.add(arm);
  }
  if (opts.rifle) {
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x181818 })
    );
    gun.position.set(0.3, 1.15, 0.3);
    g.add(gun);
  }
  return g;
}

export class Person {
  constructor(THREE, x, z, shirtColor, opts = {}) {
    this.x = x;
    this.z = z;
    this.heading = opts.heading ?? 0;
    this.speed = opts.speed ?? range(Math.random, 1, 2);
    this.hp = opts.hp ?? 100;
    this.role = opts.role ?? 'pedestrian';
    this.name = opts.name ?? null;
    this.group = createPersonMesh(THREE, shirtColor, opts);
    this.group.position.set(x, 0, z);
    this.tx = x;
    this.tz = z;
    this.wait = 0;
  }

  sync() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }
}

export function createPedestrians(scene, THREE) {
  const rand = mulberry32(99);
  const people = [];
  for (let i = 0; i < CONFIG.pedestrianCount; i++) {
    const x = range(rand, -180, 180);
    const z = range(rand, -180, 180);
    const p = new Person(THREE, x, z, pick(rand, SHIRTS));
    p.tx = range(rand, -180, 180);
    p.tz = range(rand, -180, 180);
    scene.add(p.group);
    people.push(p);
  }
  // Mara — pink shirt — waits by her garage north of the plaza.
  const mara = new Person(THREE, CONFIG.spots.garage.x + 4, CONFIG.spots.garage.z + 2, 0xe86aa0, {
    role: 'mara', name: 'Mara', speed: 0, heading: Math.PI,
  });
  scene.add(mara.group);
  people.push(mara);
  // Kito — green shirt — at the docks.
  const kito = new Person(THREE, CONFIG.spots.docks.x - 8, CONFIG.spots.docks.z - 6, 0x3aa84a, {
    role: 'kito', name: 'Kito', speed: 0, heading: -Math.PI / 2,
  });
  scene.add(kito.group);
  people.push(kito);
  return people;
}

export function createGuards(scene, THREE) {
  const guards = [];
  const spots = [
    [176, 146], [192, 150], [180, 166], [196, 164],
  ];
  for (const [x, z] of spots) {
    const g = new Person(THREE, x, z, 0xb02020, { role: 'guard', hp: 100, speed: 0, rifle: true });
    scene.add(g.group);
    guards.push(g);
  }
  return guards;
}

// Pedestrians wander: walk to a target, pause, pick a new one.
export function updatePedestrians(people, dt) {
  for (const p of people) {
    if (p.role !== 'pedestrian') continue;
    if (p.wait > 0) {
      p.wait -= dt;
      continue;
    }
    const dx = p.tx - p.x;
    const dz = p.tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      p.tx = range(Math.random, -180, 180);
      p.tz = range(Math.random, -180, 180);
      p.wait = range(Math.random, 1, 4);
      continue;
    }
    p.heading = Math.atan2(-dx, -dz) + Math.PI;
    p.x += (dx / d) * p.speed * dt;
    p.z += (dz / d) * p.speed * dt;
    // Gentle walk bob.
    p.group.position.y = Math.abs(Math.sin(Date.now() * 0.008 + p.x)) * 0.05;
    p.sync();
  }
}
