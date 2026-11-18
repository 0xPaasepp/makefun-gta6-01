// Pistol combat: a tracer from the muzzle to the hit point, damage on the
// nearest target inside a narrow cone. Guards take 2 hits; a hit pedestrian
// goes down. Shooting raises wanted (3 s cooldown between raises).
import * as THREE from 'three';

export class Combat {
  constructor(scene, audio, game) {
    this.scene = scene;
    this.audio = audio;
    this.game = game;
    this.tracers = [];
    this.lastWantedRaise = -10;
  }

  shoot(from, dir) {
    this.audio.gunshot();
    const origin = from.clone();
    const d = dir.clone().normalize();
    // Find the nearest living target inside a 12-degree cone, within 45 m.
    let best = null;
    let bestDist = 45;
    for (const t of this.game.shootTargets()) {
      if (t.hp <= 0) continue;
      const to = new THREE.Vector3(t.x - origin.x, 1.1 - origin.y, t.z - origin.z);
      const dist = to.length();
      if (dist > 45 || dist < 0.5) continue;
      to.normalize();
      const cos = to.dot(d);
      if (cos < 0.978) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    }
    const end = origin.clone().addScaledVector(d, best ? bestDist : 45);
    this.spawnTracer(origin, end);
    if (best) {
      best.hp -= 50;
      if (best.hp <= 0) {
        best.group.rotation.x = Math.PI / 2;
        best.group.position.y = 0.3;
        if (best.role === 'guard') this.game.onGuardDown(best);
      }
    }
    const now = this.game.now;
    if (now - this.lastWantedRaise > 3) {
      this.lastWantedRaise = now;
      this.game.police.addWanted(1);
    }
    return { hit: best, distance: bestDist };
  }

  spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95 })
    );
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      } else {
        t.line.material.opacity = t.life / 0.09;
      }
    }
  }
}
