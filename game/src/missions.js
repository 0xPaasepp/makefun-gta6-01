// SOLMAR missions — 3-mission story thread + one side activity
// (Sunset Sprint time trial). Markers, guards, rewards.
import * as THREE from 'three';
import { MISSIONS, DIALOGUES } from './config.js';
import { buildPersonMesh } from './people.js';

export class Missions {
  constructor(scene, game) {
    this.scene = scene; this.game = game;
    this.index = 0;           // 0=M1, 1=M2, 2=M3, 3=done
    this.stage = 'steal';     // M1: steal -> deliver; M2: steal -> evade; M3: fight -> collect
    this.guards = [];
    this.marker = null;
    this.trial = null;        // side activity state
    this.trialRings = [];
    this.evadeT = 0;
    this.collectT = 0;
    this.buildMarker();
    this.buildTrialRings();
  }
  buildMarker() {
    const geo = new THREE.CylinderGeometry(4.5, 4.5, 0.3, 24);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.55 });
    this.marker = new THREE.Mesh(geo, mat);
    this.marker.position.set(MISSIONS[0].blip.x, 0.4, MISSIONS[0].blip.z);
    this.scene.add(this.marker);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.2, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    beam.position.y = 13;
    this.marker.add(beam);
  }
  moveMarker(x, z, color = 0xf1c40f) {
    this.marker.position.set(x, 0.4, z);
    this.marker.material.color.setHex(color);
    this.marker.visible = true;
  }
  hideMarker() { this.marker.visible = false; }
  buildTrialRings() {
    // Sunset Sprint: 5 rings around the city, starts at the plaza ring.
    const spots = [[20, 20], [90, -40], [40, -130], [-90, -90], [-140, 40]];
    const geo = new THREE.TorusGeometry(3.4, 0.35, 10, 24);
    for (const [x, z] of spots) {
      const ring = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0xff7f00, emissive: 0xff7f00, emissiveIntensity: 0.9 }));
      ring.position.set(x, 2.2, z);
      ring.rotation.y = Math.PI / 2;
      ring.visible = false;
      this.scene.add(ring);
      this.trialRings.push({ mesh: ring, x, z, hit: false });
    }
  }
  startTrial() {
    if (this.trial) return;
    this.trial = { idx: 0, t: 0, limit: 75 };
    this.trialRings.forEach((r, i) => { r.hit = false; r.mesh.visible = i === 0; });
    this.game.hud.showDialogue(DIALOGUES.trial.who, DIALOGUES.trial.text);
  }
  updateTrial(dt, px, pz) {
    if (!this.trial) {
      // auto-prompt: stepping into the plaza ring starts it
      const r0 = this.trialRings[0];
      if (Math.hypot(px - r0.x, pz - r0.z) < 4) this.startTrial();
      return;
    }
    this.trial.t += dt;
    const cur = this.trialRings[this.trial.idx];
    if (cur && Math.hypot(px - cur.x, pz - cur.z) < 4.5) {
      cur.hit = true; cur.mesh.visible = false;
      this.trial.idx++;
      const next = this.trialRings[this.trial.idx];
      if (next) next.mesh.visible = true;
      else {
        this.game.addMoney(300);
        this.game.hud.showDialogue('KITO', `Sunset Sprint done in ${this.trial.t.toFixed(1)}s! +$300.`);
        this.trial = null;
      }
    }
    if (this.trial && this.trial.t > this.trial.limit) {
      this.game.hud.showDialogue('KITO', 'Sprint failed — too slow. The ring is still there if you want another go.');
      this.trial = null;
      this.trialRings.forEach((r) => { r.mesh.visible = false; });
    }
  }
  spawnGuards() {
    const spots = [[182, -72], [196, -88], [178, -96], [192, -64]];
    for (const [x, z] of spots) {
      const mesh = buildPersonMesh({ shirt: 0x222222, pants: 0x111111, skin: 0x8a5a3b, guard: true });
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.guards.push({ mesh, x, z, alive: true, health: 100, shootT: 0 });
    }
  }
  update(dt) {
    const g = this.game;
    const px = g.px, pz = g.pz;
    this.marker.rotation.y += dt * 1.2;
    this.updateTrial(dt, px, pz);
    if (this.index === 0) {
      if (this.stage === 'steal') {
        if (g.currentCar) { this.stage = 'deliver'; this.moveMarker(-50, 60); }
      } else if (this.stage === 'deliver') {
        if (g.currentCar && Math.hypot(px + 50, pz - 60) < 9) this.completeM1();
        if (!g.currentCar) { this.stage = 'steal'; this.moveMarker(-50, 10); }
      }
    } else if (this.index === 1) {
      if (this.stage === 'steal') {
        if (g.currentCar && g.currentCar.model === 'sport') {
          this.stage = 'evade';
          g.setWanted(2);
          g.hud.showDialogue(DIALOGUES.m2start.who, DIALOGUES.m2start.text);
          this.moveMarker(0, 0, 0xff3333);
          this.hideMarker();
        }
      } else if (this.stage === 'evade') {
        if (g.wanted === 0) {
          this.evadeT += dt;
          if (this.evadeT > 2) this.completeM2();
        } else this.evadeT = 0;
      }
    } else if (this.index === 2) {
      if (this.stage === 'fight') {
        const alive = this.guards.filter((gd) => gd.alive).length;
        if (alive === 0) { this.stage = 'collect'; this.moveMarker(188, -80, 0x2ecc71); }
        for (const gd of this.guards) {
          if (!gd.alive) continue;
          const d = Math.hypot(gd.x - px, gd.z - pz);
          gd.shootT += dt;
          if (d < 26 && gd.shootT > 1.6) {
            gd.shootT = 0;
            g.damagePlayer(6);
            g.combat.guardShot(gd);
          }
          // guards hold position, face the player
          gd.mesh.lookAt(px, 0, pz);
        }
      } else if (this.stage === 'collect') {
        if (Math.hypot(px - 188, pz + 80) < 7) {
          this.collectT += dt;
          if (this.collectT > 1.5) this.completeM3();
        } else this.collectT = 0;
      }
    }
  }
  completeM1() {
    const g = this.game;
    g.addMoney(500);
    this.index = 1; this.stage = 'steal';
    g.hud.showDialogue(DIALOGUES.m1done.who, DIALOGUES.m1done.text);
    g.hud.setMissionText(MISSIONS[1].text);
    this.moveMarker(180, 60);
    g.saveNow();
  }
  completeM2() {
    const g = this.game;
    g.addMoney(800);
    this.index = 2; this.stage = 'fight';
    g.hud.showDialogue(DIALOGUES.m2done.who, DIALOGUES.m2done.text);
    g.hud.setMissionText(MISSIONS[2].text);
    this.moveMarker(190, -80, 0xff3333);
    this.spawnGuards();
    g.saveNow();
  }
  completeM3() {
    const g = this.game;
    g.addMoney(3500);
    this.index = 3; this.stage = 'done';
    g.hud.showDialogue(DIALOGUES.m3done.who, DIALOGUES.m3done.text);
    g.hud.setMissionText('All missions complete. Solmar is yours — free roam, Dario.');
    this.hideMarker();
    g.saveNow();
  }
  missionText() {
    if (this.index >= 3) return 'All missions complete. Solmar is yours — free roam, Dario.';
    return MISSIONS[this.index].text;
  }
  setIndex(i) {
    this.index = i;
    if (i === 0) { this.stage = 'steal'; this.moveMarker(-50, 10); }
    if (i === 1) { this.stage = 'steal'; this.moveMarker(180, 60); }
    if (i === 2) {
      this.stage = 'fight'; this.moveMarker(190, -80, 0xff3333);
      if (!this.guards.length) this.spawnGuards();
    }
    if (i >= 3) this.hideMarker();
    this.game.hud.setMissionText(this.missionText());
  }
}
