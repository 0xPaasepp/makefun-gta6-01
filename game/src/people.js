// SOLMAR people — Dario (plain WHITE T-SHIRT, must read clearly on camera),
// pedestrians with simple sidewalk wandering, guards.
import * as THREE from 'three';
import { PEOPLE_NAMES } from './config.js';
import { makeRng } from './rng.js';

const skinTones = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0, 0xa06b42];
const shirtColors = [0x3a6ea5, 0xc0392b, 0x27ae60, 0x8e44ad, 0xe67e22, 0x16a085, 0xd4ac0d, 0x5d6d7e];

function limb(w, h, d, color, x, y) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.position.set(x, y, 0); m.castShadow = true; return m;
}

export function buildPersonMesh(opts = {}) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: opts.skin ?? 0xe8b98a, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: opts.shirt ?? 0xffffff, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: opts.pants ?? 0x2c3e50, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: opts.hair ?? 0x1a1a1a, roughness: 1 });
  // torso — the white t-shirt (large, bright, unmistakable)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.18; torso.castShadow = true; g.add(torso);
  // t-shirt sleeves
  for (const s of [1, -1]) {
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.3), shirt);
    sleeve.position.set(s * 0.4, 1.38, 0); g.add(sleeve);
  }
  // head + hair
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skin);
  head.position.y = 1.74; head.castShadow = true; g.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.34), hair);
  hairM.position.y = 1.94; g.add(hairM);
  // arms + legs (pivots for walk swing)
  const arms = [], legs = [];
  for (const s of [1, -1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.4, 1.48, 0);
    arm.add(limb(0.16, 0.62, 0.16, opts.skin ?? 0xe8b98a, 0, -0.3));
    g.add(arm); arms.push(arm);
    const leg = new THREE.Group(); leg.position.set(s * 0.16, 0.84, 0);
    leg.add(limb(0.2, 0.8, 0.2, opts.pants ?? 0x2c3e50, 0, -0.4));
    g.add(leg); legs.push(leg);
  }
  if (opts.guard) {
    // Vane guard: dark vest + cap
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.5, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 }));
    vest.position.y = 1.22; g.add(vest);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.36), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    cap.position.y = 2.02; g.add(cap);
  }
  g.userData.arms = arms; g.userData.legs = legs;
  return g;
}

export class Pedestrians {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    const R = makeRng(99);
    for (let i = 0; i < 26; i++) {
      const mesh = buildPersonMesh({
        skin: R.pick(skinTones), shirt: R.pick(shirtColors),
        pants: R.pick([0x2c3e50, 0x4a3728, 0x555555, 0x1a5276]),
        hair: R.pick([0x1a1a1a, 0x4a2c14, 0x777777, 0x8a5a2a]),
      });
      const x = R.range(-160, 160), z = R.range(-160, 160);
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      this.list.push({
        name: PEOPLE_NAMES[i % PEOPLE_NAMES.length],
        mesh, x, z, alive: true, health: 100,
        heading: R.range(0, Math.PI * 2), speed: R.range(1.2, 2.4),
        target: { x: R.range(-160, 160), z: R.range(-160, 160) },
        walkT: R.range(0, 6), fleeing: false,
      });
    }
  }
  update(dt, playerPos, wanted) {
    for (const p of this.list) {
      if (!p.alive) continue;
      p.walkT += dt;
      // flee if player is shooting / wanted nearby
      const dP = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (wanted > 0 && dP < 14) p.fleeing = true;
      else if (dP > 30) p.fleeing = false;
      const sp = p.fleeing ? 5.2 : p.speed;
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 2 || p.fleeing) {
        p.target = p.fleeing
          ? { x: p.x + (p.x - playerPos.x), z: p.z + (p.z - playerPos.z) }
          : { x: (Math.random() - 0.5) * 320, z: (Math.random() - 0.5) * 320 };
      }
      const want = Math.atan2(dx, dz);
      p.heading += (want - p.heading) * Math.min(1, dt * 3);
      p.x += Math.sin(p.heading) * sp * dt;
      p.z += Math.cos(p.heading) * sp * dt;
      p.x = Math.max(-230, Math.min(200, p.x));
      p.z = Math.max(-230, Math.min(230, p.z));
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      const swing = Math.sin(p.walkT * (p.fleeing ? 11 : 7)) * 0.5;
      p.mesh.userData.arms[0].rotation.x = swing;
      p.mesh.userData.arms[1].rotation.x = -swing;
      p.mesh.userData.legs[0].rotation.x = -swing;
      p.mesh.userData.legs[1].rotation.x = swing;
    }
  }
  nearest(x, z, maxD = 60) {
    let best = null, bd = maxD;
    for (const p of this.list) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}
