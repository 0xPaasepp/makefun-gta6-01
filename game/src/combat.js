// SOLMAR — combat. Pistol with tracers, muzzle flash, 12-round magazine,
// guard hits (3 to drop one) and guards shooting back.

export class Combat {
  constructor(THREE, scene, game) {
    this.THREE = THREE; this.scene = scene; this.game = game;
    this.ammo = 12; this.magSize = 12;
    this.reloadT = 0;
    this.coolT = 0;
    this.tracers = [];
    this.flash = null;
  }

  shoot() {
    if (this.reloadT > 0 || this.coolT > 0) return false;
    if (this.ammo <= 0) { this.reload(); return false; }
    this.ammo--;
    this.coolT = 0.28;
    const g = this.game;
    const px = g.player.x, pz = g.player.z;
    const h = g.player.heading;
    // aim: forward from the player; if a guard is roughly ahead, hit it
    const ox = px + Math.sin(h) * 1.2, oz = pz + Math.cos(h) * 1.2;
    const ex = px + Math.sin(h) * 26, ez = pz + Math.cos(h) * 26;
    this._tracer(ox, oz, ex, ez);
    this.game.audio.playShot();
    // hit check: nearest alive guard within a narrow cone ahead
    let best = null, bd = 1e9;
    for (const gd of g.people.guards) {
      if (!gd.alive) continue;
      const dx = gd.x - px, dz = gd.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > 28) continue;
      const dot = (dx * Math.sin(h) + dz * Math.cos(h)) / d; // 1 = dead ahead
      if (dot > 0.86 && d < bd) { bd = d; best = gd; }
    }
    if (best) {
      best.hp--;
      this._tracer(ox, oz, best.x, best.z);
      this.game.hud.flashHit();
      if (best.hp <= 0) {
        best.alive = false;
        best.mesh.visible = false;
        this.game.hud.showDialogue('Guard down.', 'Dario', 2);
        this.game.audio.playChime();
      }
    }
    g.hud.updateAmmo(this.ammo, this.magSize);
    return true;
  }

  reload() {
    if (this.reloadT > 0 || this.ammo === this.magSize) return;
    this.reloadT = 1.1;
    this.game.hud.updateAmmo(this.ammo, this.magSize, true);
  }

  _tracer(x1, z1, x2, z2) {
    const geo = new this.THREE.BufferGeometry().setFromPoints([
      new this.THREE.Vector3(x1, 1.4, z1),
      new this.THREE.Vector3(x2, 1.4, z2),
    ]);
    const mat = new this.THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95 });
    const line = new this.THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, mat, life: 0.14 });
  }

  update(dt) {
    this.coolT = Math.max(0, this.coolT - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.ammo = this.magSize;
        this.game.hud.updateAmmo(this.ammo, this.magSize);
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.mat.opacity = Math.max(0, t.life / 0.14);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose(); t.mat.dispose();
        this.tracers.splice(i, 1);
      }
    }
    // guards shoot back when the player is close and the heist is live
    const g = this.game;
    if (g.missions.index === 2 && !g.missions.done) {
      for (const gd of g.people.guards) {
        if (!gd.alive) continue;
        const d = Math.hypot(gd.x - g.player.x, gd.z - g.player.z);
        gd.shootCd -= dt;
        if (d < 30 && gd.shootCd <= 0) {
          gd.shootCd = 1.6 + Math.random() * 0.8;
          this._tracer(gd.x, gd.z, g.player.x, g.player.z);
          this.game.audio.playShot(true);
          if (d < 22) g.damagePlayer(6);
        }
      }
    }
  }
}
