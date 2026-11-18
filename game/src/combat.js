// SOLMAR combat — pistol with tracers, hit detection vs peds + guards.
import * as THREE from 'three';

export class Combat {
  constructor(scene, game) {
    this.scene = scene; this.game = game;
    this.tracers = [];
    this.cooldown = 0;
    this.aimX = 0; this.aimZ = -10;
  }
  shoot() {
    if (this.cooldown > 0 || !this.game.started) return false;
    this.cooldown = 0.32;
    const g = this.game;
    const ox = g.px, oz = g.pz;
    const dx = this.aimX - ox, dz = this.aimZ - oz;
    const d = Math.hypot(dx, dz) || 1;
    const dir = { x: dx / d, z: dz / d };
    // tracer: bright line from muzzle toward aim point
    const len = Math.min(d, 60);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(ox, 1.3, oz),
      new THREE.Vector3(ox + dir.x * len, 1.3, oz + dir.z * len),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this.tracers.push({ line, t: 0 });
    g.audio.shoot();
    // hit the closest ped/guard within a cone of the shot
    const targets = [
      ...g.peds.list.filter((p) => p.alive).map((p) => ({ x: p.x, z: p.z, ref: p, kind: 'ped' })),
      ...g.missions.guards.filter((gd) => gd.alive).map((gd) => ({ x: gd.x, z: gd.z, ref: gd, kind: 'guard' })),
    ];
    let best = null, bestD = 1e9;
    for (const t of targets) {
      const tx = t.x - ox, tz = t.z - oz;
      const along = tx * dir.x + tz * dir.z;
      if (along < 1 || along > 60) continue;
      const perp = Math.abs(tx * dir.z - tz * dir.x);
      if (perp < 1.6 && along < bestD) { bestD = along; best = t; }
    }
    if (best) {
      best.ref.health -= 50;
      if (best.ref.health <= 0) {
        best.ref.alive = false;
        best.ref.mesh.visible = false;
        if (best.kind === 'guard') g.hud.flash('Guard down!');
        if (best.kind === 'ped') g.setWanted(Math.min(5, g.wanted + 1));
      }
    }
    return true;
  }
  guardShot(gd) {
    const g = this.game;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(gd.x, 1.3, gd.z),
      new THREE.Vector3(g.px, 1.3, g.pz),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff5544, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, t: 0 });
    g.audio.hit();
  }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.t += dt;
      tr.line.material.opacity = Math.max(0, 0.95 - tr.t * 5);
      if (tr.t > 0.2) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}
