// Pistol / SMG / Shotgun / Rifle. Hits are ray-vs-target math (robust at
// 1 FPS), with a visible tracer line, a muzzle flash and a hit spark.
// Shooting a civilian draws the police; shooting a guard does not.
// Rebuild 12: muzzle flash + impact spark, and the Rifle's long range.
// Rebuild 13: hit/kill counters (the map's stats panel shows Takedowns)
// and a crosshair hit-marker flash, so a hit reads even at a glance.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';

export class CombatSystem {
  constructor(scene, audio) {
    this.scene = scene; this.audio = audio;
    this.cooldown = 0;
    this.tracers = []; // {line, life}
    this.shotsFired = 0;
    this.hits = 0; this.kills = 0;
    this._flash = null; this._flashT = 0;
    this._sparks = [];
  }
  // Called by game.js when its own ray shot lands: counts the hit, and a
  // kill when the target went down. Flashes the crosshair as a hit-marker.
  registerHit(killed) {
    this.hits++;
    if (killed) this.kills++;
    const ch = document.getElementById('crosshair');
    if (ch) {
      ch.style.borderColor = killed ? '#ff5a3c' : '#ffd23f';
      ch.style.transform = 'scale(1.6)';
      setTimeout(() => { ch.style.borderColor = ''; ch.style.transform = ''; }, 160);
    }
  }
  // targets: [{x,z,hp,alive,kind}] — kind 'ped' | 'guard' | 'cop'
  fire(origin, dir, weaponKey, targets) {
    if (this.cooldown > 0) return null;
    const w = CONFIG.weapons[weaponKey] || CONFIG.weapons.pistol;
    this.cooldown = w.cooldown;
    this.shotsFired++;
    this.audio.gunshot();
    this._muzzle(origin, dir);
    let best = null; let bestD = w.range;
    for (let p = 0; p < w.pellets; p++) {
      const spread = (Math.random() - 0.5) * 2 * w.spread;
      const a = Math.atan2(dir.x, dir.z) + spread;
      const d = { x: Math.sin(a), z: Math.cos(a) };
      for (const t of targets) {
        if (!t.alive) continue;
        const rx = t.x - origin.x, rz = t.z - origin.z;
        const along = rx * d.x + rz * d.z;
        if (along < 0 || along > w.range) continue;
        const perp = Math.abs(rx * d.z - rz * d.x);
        if (perp < 1.3 && along < bestD) { bestD = along; best = { t, d }; }
      }
      const endX = origin.x + d.x * (best ? bestD : w.range);
      const endZ = origin.z + d.z * (best ? bestD : w.range);
      this._tracer(origin, endX, endZ);
    }
    if (best) {
      best.t.hp -= w.damage;
      this._spark(best.t.x, best.t.z);
      if (best.t.hp <= 0) { best.t.alive = false; if (best.t.mesh) best.t.mesh.visible = false; }
      this.registerHit(!best.t.alive);
      return { hit: best.t, kind: best.t.kind || 'ped', killed: !best.t.alive };
    }
    return { hit: null };
  }
  _muzzle(origin, dir) {
    if (!this._flash) {
      this._flash = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe14d }));
      this.scene.add(this._flash);
    }
    this._flash.position.set(origin.x + dir.x * 1.2, 1.45, origin.z + dir.z * 1.2);
    this._flash.visible = true;
    this._flashT = 0.06;
  }
  _spark(x, z) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff5a2a }));
    s.position.set(x, 1.3, z);
    this.scene.add(s);
    this._sparks.push({ mesh: s, life: 0.25 });
  }
  _tracer(origin, ex, ez) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(origin.x, 1.45, origin.z),
      new THREE.Vector3(ex, 1.2, ez),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe14d }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this._flash) {
      this._flashT -= dt;
      if (this._flashT <= 0) this._flash.visible = false;
    }
    for (let i = this._sparks.length - 1; i >= 0; i--) {
      const s = this._sparks[i];
      s.life -= dt;
      if (s.life <= 0) { this.scene.remove(s.mesh); this._sparks.splice(i, 1); }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}
