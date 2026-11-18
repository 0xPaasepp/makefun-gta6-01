// SOLMAR · people.js — Dario (plain WHITE t-shirt, unlit so it reads pure
// white on screen), pedestrians, and the armed harbour guards.
import * as THREE from 'three';
import { PEOPLE } from './config.js';

function box(w, h, d, color, opts = {}) {
  const m = opts.unlit
    ? new THREE.MeshBasicMaterial({ color })
    : new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.castShadow = true;
  return mesh;
}

// A simple blocky person. Dario's shirt uses MeshBasicMaterial pure white.
export function makePerson(cfg, opts = {}) {
  const g = new THREE.Group();
  const shirtMat = opts.whiteShirt
    ? new THREE.MeshBasicMaterial({ color: 0xffffff })
    : new THREE.MeshLambertMaterial({ color: cfg.shirt });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.08; torso.castShadow = true; g.add(torso);
  const head = box(0.34, 0.34, 0.34, cfg.skin); head.position.y = 1.66; g.add(head);
  const hair = box(0.36, 0.12, 0.36, cfg.hair); hair.position.y = 1.86; g.add(hair);
  const legL = box(0.22, 0.72, 0.24, cfg.pants); legL.position.set(-0.16, 0.36, 0); g.add(legL);
  const legR = box(0.22, 0.72, 0.24, cfg.pants); legR.position.set(0.16, 0.36, 0); g.add(legR);
  const armL = box(0.16, 0.6, 0.18, cfg.skin); armL.position.set(-0.42, 1.08, 0); g.add(armL);
  const armR = box(0.16, 0.6, 0.18, cfg.skin); armR.position.set(0.42, 1.08, 0); g.add(armR);
  g.userData = { legL, legR, armL, armR, torso };
  return g;
}

const PED_SHIRTS = [0xe85d75, 0x2fa36b, 0xf2b705, 0x7a5fd0, 0x3e7cc2, 0xe87a2f, 0x9be15d, 0xd16ba5, 0x4fc3c3, 0xc23b2e];
const PED_PANTS = [0x23283a, 0x333333, 0x5a4a3a, 0x2b3a55, 0x4a4a4a];
const PED_SKINS = [0xd9a066, 0xe8b98a, 0x8a5a3b, 0xc98d5f, 0xf0c8a0];

export class People {
  constructor(scene, rng) {
    this.scene = scene;
    this.peds = [];
    this.guards = [];
    this.rng = rng;
    // Dario — the hero. White shirt, unlit.
    this.dario = makePerson(PEOPLE.dario, { whiteShirt: true });
    scene.add(this.dario);
    // 26 pedestrians wandering the sidewalks.
    for (let i = 0; i < 26; i++) {
      const cfg = {
        shirt: PED_SHIRTS[i % PED_SHIRTS.length],
        pants: PED_PANTS[i % PED_PANTS.length],
        skin: PED_SKINS[i % PED_SKINS.length],
        hair: [0x1a1210, 0x3a1f16, 0x0d0d0d, 0x6b5a2f][i % 4],
      };
      const mesh = makePerson(cfg);
      const x = -160 + rng() * 320, z = -160 + rng() * 320;
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      this.peds.push({
        mesh, x, z, heading: rng() * Math.PI * 2,
        speed: 0.9 + rng() * 0.9, walkPhase: rng() * 6, turnT: 0, fleeing: false,
      });
    }
  }
  spawnGuards(cx, cz) {
    for (const [dx, dz] of [[-6, -4], [6, -3], [-4, 6], [7, 5]]) {
      const mesh = makePerson(PEOPLE.guard);
      // dark red jacket + a visible rifle box
      const gun = box(0.08, 0.08, 0.9, 0x111111);
      gun.position.set(0.3, 1.15, 0.35); mesh.add(gun);
      mesh.position.set(cx + dx, 0, cz + dz);
      this.scene.add(mesh);
      this.guards.push({ mesh, x: cx + dx, z: cz + dz, hp: 3, dead: false, shootCd: 1 + Math.random(), heading: 0 });
    }
  }
  update(dt, player, carNear) {
    // pedestrians: wander, flee from a fast car
    for (const p of this.peds) {
      p.turnT -= dt;
      const dp = Math.hypot(p.x - player.x, p.z - player.z);
      if (carNear && dp < 9) { p.fleeing = true; }
      else if (dp > 16) p.fleeing = false;
      if (p.turnT <= 0) { p.heading += (Math.random() - 0.5) * 2.2; p.turnT = 1.5 + Math.random() * 2; }
      let sp = p.speed;
      if (p.fleeing) { // run away from the player
        p.heading = Math.atan2(p.x - player.x, p.z - player.z); sp = 3.4;
      }
      p.x += Math.sin(p.heading) * sp * dt;
      p.z += Math.cos(p.heading) * sp * dt;
      p.x = Math.max(-195, Math.min(205, p.x));
      p.z = Math.max(-195, Math.min(195, p.z));
      p.walkPhase += dt * sp * 3;
      const swing = Math.sin(p.walkPhase) * 0.5;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
      p.mesh.userData.armL.rotation.x = -swing * 0.7;
      p.mesh.userData.armR.rotation.x = swing * 0.7;
    }
    // Dario walk cycle
    const u = this.dario.userData;
    const sw = Math.sin(player.walkPhase || 0) * (player.moving ? 0.55 : 0);
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw * 0.7; u.armR.rotation.x = sw * 0.7;
    this.dario.position.set(player.x, 0, player.z);
    this.dario.rotation.y = player.heading;
    this.dario.visible = !player.inCar;
  }
}
