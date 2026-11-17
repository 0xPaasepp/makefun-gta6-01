// combat.js — on-foot pistol combat. Click to shoot a hitscan ray from the
// camera; guards and cops take damage, peds flee, tracers + muzzle flash sell it.

import * as THREE from 'three';

export class Combat {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.ammo = 12;
    this.reserve = 48;
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.tracers = [];
    this.raycaster = new THREE.Raycaster();
  }

  get canShoot() { return this.cooldown <= 0 && this.reloadTimer <= 0 && this.ammo > 0; }

  reload() {
    if (this.reloadTimer > 0 || this.ammo === 12 || this.reserve === 0) return false;
    this.reloadTimer = 1.1;
    return true;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const need = 12 - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        this.reserve -= take;
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.12);
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }
  }

  // Shoot from the camera through the screen centre. targets: array of Person.
  // Returns { hit, killed, target }.
  shoot(origin, targets, onShot) {
    if (!this.canShoot) return null;
    this.cooldown = 0.28;
    this.ammo -= 1;
    if (onShot) onShot();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(origin, dir);
    this.raycaster.far = 90;
    const meshes = [];
    const byMesh = new Map();
    for (const t of targets) {
      if (!t.alive) continue;
      t.mesh.traverse((m) => { if (m.isMesh) { meshes.push(m); byMesh.set(m, t); } });
    }
    const hits = this.raycaster.intersectObjects(meshes, false);
    const end = origin.clone().add(dir.clone().multiplyScalar(90));
    let result = { hit: false, killed: false, target: null };
    if (hits.length > 0) {
      const h = hits[0];
      end.copy(h.point);
      const target = byMesh.get(h.object);
      if (target) {
        const killed = target.damage(34 + Math.floor(Math.random() * 20));
        result = { hit: true, killed, target };
      }
    }
    // Tracer line from the gun to the hit point.
    const geo = new THREE.BufferGeometry().setFromPoints([origin.clone(), end]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 1 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ mesh: line, life: 0.12 });
    return result;
  }

  // Enemy shot at the player: returns damage dealt (with miss chance at range).
  enemyShot(shooter, distance) {
    const missChance = Math.min(0.55, distance / 70);
    if (Math.random() < missChance) return 0;
    return 6 + Math.floor(Math.random() * 9);
  }
}
