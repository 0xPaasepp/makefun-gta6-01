// People: Dario (plain WHITE T-SHIRT, always), pedestrians, Mara, Kito,
// the dock guards, the race marshal, the Fixer and DJ Marea. Simple
// articulated block figures — readable at a glance, cheap to render.
// Rebuild 12: 40 pedestrians (was 26), a distinct police-officer build,
// sunglasses + white sneakers on Dario, and the full story cast standing
// in the world where their jobs happen.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { makeRng, range, pick } from './rng.js';

const SKIN = [0xe8b98a, 0xc98a5a, 0x8a5a34, 0xf0c8a0];
const SHIRTS = [0x3b7ac2, 0xc23b3b, 0x3b9a5a, 0xd8a03b, 0x7a4a9a, 0x2a9a8a, 0xe87a3b, 0xff5a8a, 0xf2b8a0];
const PANTS = [0x2a2a3a, 0x3a3a2a, 0x4a4a4a, 0x1a2a3a, 0x6a3a3a];

// Dario Voss — plain WHITE T-SHIRT, dark jeans, sunglasses, white sneakers.
// The shirt is the point: a big untextured white torso box, visible from
// every camera angle, with a slight emissive so it reads white even in shade.
export function buildPlayerMesh() {
  const g = new THREE.Group();
  const skin = 0xe8b98a;
  // PLAIN WHITE T-SHIRT, unlit: pure white from every angle and every
  // light, so it reads white even in the shade of the golden hour.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  torso.position.y = 1.25;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 2.1;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.54),
    new THREE.MeshLambertMaterial({ color: 0x1a1210 }));
  hair.position.y = 2.4;
  g.add(hair);
  // Sunglasses: dark bar across the face, front of the head.
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.06),
    new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
  shades.position.set(0, 2.12, 0.26);
  g.add(shades);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.0, 0.26),
    new THREE.MeshLambertMaterial({ color: skin }));
  armL.position.set(-0.62, 1.25, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.62; g.add(armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.34),
    new THREE.MeshLambertMaterial({ color: 0x2a2a3a }));
  legL.position.set(-0.24, 0.42, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.24; g.add(legR);
  // White sneakers.
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xffffff }));
  shoeL.position.set(-0.24, 0.07, 0.06); g.add(shoeL);
  const shoeR = shoeL.clone(); shoeR.position.x = 0.24; g.add(shoeR);
  g.userData.armL = armL; g.userData.armR = armR;
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

export function buildPedMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.45),
    new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.2; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46),
    new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 2.0; g.add(head);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.95, 0.24),
    new THREE.MeshLambertMaterial({ color: skin }));
  armL.position.set(-0.56, 1.2, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.56; g.add(armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 0.32),
    new THREE.MeshLambertMaterial({ color: pants }));
  legL.position.set(-0.22, 0.4, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
  g.userData.armL = armL; g.userData.armR = armR;
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

// Police officer on foot: navy uniform, badge, peaked cap, baton.
export function buildOfficerMesh() {
  const g = buildPedMesh(0x1a2a4a, 0x14141c, 0xe8b98a);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.05),
    new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x332200 }));
  badge.position.set(-0.2, 1.45, 0.24); g.add(badge);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x101828 }));
  cap.position.y = 2.28; g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.2),
    new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
  brim.position.set(0, 2.22, 0.3); g.add(brim);
  const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  baton.position.set(0.68, 1.0, 0.1); baton.rotation.z = 0.3; g.add(baton);
  return g;
}

// Armed dock guard: dark vest, helmet, rifle.
export function buildGuardMesh() {
  const g = buildPedMesh(0x2a2a22, 0x1a1a1a, 0xc98a5a);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  vest.position.y = 1.3; g.add(vest);
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.52),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  helmet.position.y = 2.28; g.add(helmet);
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.1),
    new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
  rifle.position.set(0.5, 1.4, 0.3); g.add(rifle);
  return g;
}

// The story cast: Mara (red jacket), Kito (teal hoodie, yellow cap),
// Race Marshal (checkered cap, orange vest), the Fixer (green suit,
// sunglasses), DJ Marea (pink jacket, headphones) at El Faro, and DJ Vela
// (rebuild 13: purple synth jacket, shades) outside the Neon Row record shop.
export function buildNpcMesh(kind) {
  if (kind === 'mara') {
    const g = buildPedMesh(0xc23b3b, 0x2a2a3a, 0xf0c8a0);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x3a1a10 }));
    hair.position.set(0, 2.0, -0.2); g.add(hair);
    return g;
  }
  if (kind === 'kito') {
    const g = buildPedMesh(0x2a9a8a, 0x3a3a2a, 0x8a5a34);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffd23f }));
    cap.position.y = 2.3; g.add(cap);
    return g;
  }
  if (kind === 'marshal') {
    const g = buildPedMesh(0xff5a2a, 0x1a1a1a, 0xe8b98a);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    cap.position.y = 2.3; g.add(cap);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x2aff8a }));
    flag.position.set(0.6, 1.5, 0); g.add(flag);
    return g;
  }
  if (kind === 'fixer') {
    const g = buildPedMesh(0x3b9a5a, 0x1a1a1a, 0x8a5a34);
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    shades.position.set(0, 2.02, 0.24); g.add(shades);
    return g;
  }
  if (kind === 'marea') {
    const g = buildPedMesh(0xff5a8a, 0x2a2a3a, 0xf0c8a0);
    const phones = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.56),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    phones.position.y = 2.32; g.add(phones);
    return g;
  }
  if (kind === 'vela') {
    const g = buildPedMesh(0x7a4a9a, 0x1a1a1a, 0xc98a5a);
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    shades.position.set(0, 2.02, 0.24); g.add(shades);
    const record = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    record.position.set(0.6, 1.3, 0.15); record.rotation.x = Math.PI / 2; g.add(record);
    return g;
  }
  return buildPedMesh(0x3b7ac2, 0x2a2a3a, 0xe8b98a);
}

export class PedSystem {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    const rng = makeRng(31337);
    for (let i = 0; i < CONFIG.pedCount; i++) {
      // Peds walk on sidewalks: near a road line, offset onto the kerb.
      // A few cluster at the plaza and the beach so the city feels full.
      let x, z;
      if (i < 6) { x = range(rng, -14, 14); z = range(rng, -14, 14); }
      else if (i < 10) { x = range(rng, 205, 215); z = range(rng, -60, 100); }
      else {
        const vertical = rng() < 0.5;
        const road = pick(rng, vertical ? CONFIG.roadsX : CONFIG.roadsZ);
        const along = range(rng, -150, 150);
        const side = rng() < 0.5 ? 6.5 : -6.5;
        x = vertical ? road + side : along;
        z = vertical ? along : road + side;
      }
      const mesh = buildPedMesh(pick(rng, SHIRTS), pick(rng, PANTS), pick(rng, SKIN));
      const ped = {
        x, z, alive: true, hp: 50,
        heading: rng() * Math.PI * 2,
        speed: range(rng, 1.2, 2.2),
        mesh, wanderT: range(rng, 2, 6), phase: rng() * 6,
      };
      mesh.position.set(x, 0.3, z);
      mesh.rotation.y = ped.heading;
      this.list.push(ped);
      scene.add(mesh);
    }
  }
  update(dt, time) {
    for (const p of this.list) {
      if (!p.alive) { p.mesh.visible = false; continue; }
      p.wanderT -= dt;
      if (p.wanderT <= 0) {
        p.wanderT = range(Math.random, 3, 7);
        p.heading += (Math.random() - 0.5) * 2.2;
      }
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      // Keep peds inside the city; turn around at the edge.
      if (p.x < -215 || p.x > 200 || p.z < -160 || p.z > 160) p.heading += Math.PI;
      p.mesh.position.set(p.x, 0.3, p.z);
      p.mesh.rotation.y = p.heading;
      const sw = Math.sin(time * 6 + p.phase) * 0.35;
      p.mesh.userData.legL.rotation.x = sw;
      p.mesh.userData.legR.rotation.x = -sw;
      p.mesh.userData.armL.rotation.x = -sw * 0.7;
      p.mesh.userData.armR.rotation.x = sw * 0.7;
    }
  }
}
