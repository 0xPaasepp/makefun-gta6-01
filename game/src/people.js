// SOLMAR — people. Dario Voss (plain WHITE T-SHIRT, clearly visible),
// 26 varied pedestrians, Mara and Kito NPCs, and the armed Vane guards
// at the harbour. All original characters, built from boxes.

import { CONFIG } from './config.js';

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xfd79a8];

export function makePersonMesh(THREE, opts = {}) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: opts.skin ?? 0xf1c27d });
  const shirt = new THREE.MeshLambertMaterial({ color: opts.shirt ?? 0x3498db });
  const pants = new THREE.MeshLambertMaterial({ color: opts.pants ?? 0x2c3e50 });
  const h = opts.height ?? 1.8;
  const s = h / 1.8;
  // torso — Dario's is PLAIN WHITE (0xffffff) by construction
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62 * s, 0.72 * s, 0.34 * s), shirt);
  torso.position.y = 1.12 * s;
  g.add(torso);
  // head + hair
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34 * s, 0.36 * s, 0.32 * s), skin);
  head.position.y = 1.68 * s;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.36 * s, 0.14 * s, 0.34 * s),
    new THREE.MeshLambertMaterial({ color: opts.hair ?? 0x2d1a0e })
  );
  hair.position.y = 1.9 * s;
  g.add(hair);
  // arms
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.62 * s, 0.16 * s), skin);
  armL.position.set(-0.42 * s, 1.12 * s, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42 * s;
  g.add(armR);
  // legs
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.72 * s, 0.22 * s), pants);
  legL.position.set(-0.15 * s, 0.36 * s, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.15 * s;
  g.add(legR);
  g.userData = { armL, armR, legL, legR, scale: s };
  return g;
}

export class PeopleManager {
  constructor(THREE, scene, rng, colliders) {
    this.THREE = THREE; this.scene = scene; this.rng = rng;
    this.colliders = colliders;
    this.peds = []; // {mesh, x, z, heading, speed, target, phase}
    this.guards = []; // {mesh, x, z, heading, hp, alive, shootCd}
    this._spawnPeds();
    this._spawnNPCs();
    this._spawnGuards();
  }

  _spawnPeds() {
    // 26 pedestrians strolling sidewalks and the plaza.
    for (let i = 0; i < 26; i++) {
      const onPlaza = i < 6;
      const x = onPlaza ? this.rng.range(-20, 20) : this.rng.pick(CONFIG.roadsX) + this.rng.pick([-7.5, 7.5]);
      const z = onPlaza ? this.rng.range(-20, 20) : this.rng.range(-190, 190);
      const mesh = makePersonMesh(this.THREE, {
        skin: this.rng.pick(SKIN),
        shirt: this.rng.pick(SHIRTS),
        pants: this.rng.pick([0x2c3e50, 0x5d4037, 0x37474f, 0x6d4c41]),
        height: this.rng.range(1.6, 1.95),
        hair: this.rng.pick([0x2d1a0e, 0x111111, 0x6b4f2a, 0x999999]),
      });
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.peds.push({
        mesh, x, z,
        heading: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.2, 2.4),
        target: this._newTarget(x, z),
        phase: this.rng.range(0, Math.PI * 2),
      });
    }
  }

  _newTarget(x, z) {
    // nearby sidewalk point: snap to a road line offset, or stay in plaza
    if (Math.abs(x) < 28 && Math.abs(z) < 28) {
      return { x: this.rng.range(-22, 22), z: this.rng.range(-22, 22) };
    }
    const road = this.rng.pick(CONFIG.roadsX);
    const along = this.rng.range(-190, 190);
    return this.rng.chance(0.5)
      ? { x: road + this.rng.pick([-7.5, 7.5]), z: along }
      : { x: along, z: this.rng.pick(CONFIG.roadsZ) + this.rng.pick([-7.5, 7.5]) };
  }

  _spawnNPCs() {
    // Mara at her garage, Kito at the docks.
    this.mara = makePersonMesh(this.THREE, { skin: 0xf1c27d, shirt: 0xe74c3c, pants: 0x2c3e50, height: 1.7, hair: 0x6b2d1a });
    this.mara.position.set(3, 0, -70);
    this.scene.add(this.mara);
    this.kito = makePersonMesh(this.THREE, { skin: 0xc68642, shirt: 0x2ecc71, pants: 0x37474f, height: 1.85, hair: 0x111111 });
    this.kito.position.set(174, 0, 146);
    this.scene.add(this.kito);
  }

  _spawnGuards() {
    // 4 armed Vane guards around the cash crates at the docks.
    const spots = [[182, 152], [190, 154], [184, 162], [192, 160]];
    for (const [x, z] of spots) {
      const mesh = makePersonMesh(this.THREE, { skin: 0xe0ac69, shirt: 0x7b1f1f, pants: 0x1a1a1a, height: 1.9, hair: 0x111111 });
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      // a dark pistol box in the guard's hand
      const gun = new this.THREE.Mesh(
        new this.THREE.BoxGeometry(0.08, 0.08, 0.4),
        new this.THREE.MeshLambertMaterial({ color: 0x111111 })
      );
      gun.position.set(0.45, 1.05, 0.2);
      mesh.add(gun);
      this.guards.push({ mesh, x, z, heading: this.rng.range(0, Math.PI * 2), hp: 3, alive: true, shootCd: 1 + this.rng.f() });
    }
  }

  update(dt, playerPos, playerAlive) {
    for (const p of this.peds) {
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) { p.target = this._newTarget(p.x, p.z); continue; }
      const want = Math.atan2(dx, dz);
      let dh = want - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      p.x = Math.max(-205, Math.min(205, p.x));
      p.z = Math.max(-205, Math.min(205, p.z));
      p.phase += dt * 7;
      const sw = Math.sin(p.phase) * 0.45;
      p.mesh.userData.legL.rotation.x = sw;
      p.mesh.userData.legR.rotation.x = -sw;
      p.mesh.userData.armL.rotation.x = -sw * 0.7;
      p.mesh.userData.armR.rotation.x = sw * 0.7;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
    // guards patrol a small beat around the crates
    for (const gd of this.guards) {
      if (!gd.alive) continue;
      gd.heading += Math.sin(Date.now() * 0.0004 + gd.x) * 0.004;
      gd.mesh.rotation.y = gd.heading;
      gd.mesh.position.set(gd.x, 0, gd.z);
    }
  }
}
