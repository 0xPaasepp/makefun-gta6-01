// SOLMAR · combat.js — pistol with tracer lines, ammo, guard damage.
import * as THREE from 'three';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.ammo = 12; this.maxAmmo = 12;
    this.cooldown = 0;
    this.tracers = [];
    this.reloadT = 0;
    this.geo = new THREE.BufferGeometry();
  }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { this.ammo = this.maxAmmo; }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      tr.line.material.opacity = Math.max(0, tr.life / 0.18);
      if (tr.life <= 0) { this.scene.remove(tr.line); tr.line.geometry.dispose(); tr.line.material.dispose(); this.tracers.splice(i, 1); }
    }
  }
  // Fire from `from` along direction `dir`. Returns the first guard hit (or null).
  shoot(from, dir, guards, audio) {
    if (this.cooldown > 0 || this.reloadT > 0) return null;
    if (this.ammo <= 0) { this.reloadT = 1.1; return null; }
    this.ammo--; this.cooldown = 0.28;
    const end = from.clone().addScaledVector(dir, 60);
    let hitGuard = null, best = 60;
    for (const g of guards) {
      if (g.dead) continue;
      // ray vs vertical capsule approximated as a sphere at chest height
      const to = new THREE.Vector3(g.x - from.x, 1.1 - from.y, g.z - from.z);
      const t = to.dot(dir);
      if (t < 0 || t > 60) continue;
      const closest = from.clone().addScaledVector(dir, t);
      const d = Math.hypot(closest.x - g.x, closest.y - 1.1, closest.z - g.z);
      if (d < 1.3 && t < best) { best = t; hitGuard = g; }
    }
    if (hitGuard) end.copy(from).addScaledVector(dir, best);
    const g2 = new THREE.BufferGeometry().setFromPoints([from.clone(), end]);
    const m = new THREE.LineBasicMaterial({ color: 0xffe9a3, transparent: true, opacity: 1 });
    const line = new THREE.Line(g2, m);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.18 });
    if (audio) audio.gunshot();
    if (hitGuard) { hitGuard.hp -= 1; if (hitGuard.hp <= 0) hitGuard.dead = true; }
    return hitGuard;
  }
  reload() { if (this.ammo < this.maxAmmo && this.reloadT <= 0) this.reloadT = 1.1; }
}
