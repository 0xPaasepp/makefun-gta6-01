// missions.js — the story thread: three missions from config, each a chain of
// steps (go somewhere, steal a car, lose the cops, shoot guards, grab cash).
// Owns the yellow marker, the mission state, and the cash pickups.

import * as THREE from 'three';
import { MISSIONS, STORY_END } from './config.js';
import { clamp } from './rng.js';

// Where each mission's "goto" step points (all inside the city).
export const MISSION_SPOTS = {
  garage: { x: -8, z: 63, label: "Mara's Garage" },
  marina: { x: 150, z: 178, label: 'Marina Pickup' },
  lockup: { x: 175, z: -189, label: "Kito's Lockup" },
  dockOffice: { x: 168, z: 186, label: 'Dock Office' },
};

function spotFor(missionId, stepIndex) {
  if (missionId === 'm1') return MISSION_SPOTS.garage;
  if (missionId === 'm2') return stepIndex === 0 ? MISSION_SPOTS.marina : MISSION_SPOTS.lockup;
  if (missionId === 'm3') {
    if (stepIndex === 0) return MISSION_SPOTS.dockOffice;
    return MISSION_SPOTS.garage;
  }
  return MISSION_SPOTS.garage;
}

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.missionIndex = 0;   // 0..2, 3 = story complete
    this.stepIndex = 0;
    this.active = false;
    this.done = false;
    this.cashDrops = [];
    this.guardsSpawned = false;

    // The yellow marker: a floating diamond + a light beam, visible from far.
    const geo = new THREE.OctahedronGeometry(1.6);
    this.marker = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    this.marker.visible = false;
    scene.add(this.marker);
    const beamGeo = new THREE.CylinderGeometry(1.1, 1.1, 60, 12, 1, true);
    this.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
    }));
    this.beam.visible = false;
    scene.add(this.beam);
  }

  get mission() { return MISSIONS[this.missionIndex]; }
  get step() { return this.mission ? this.mission.steps[this.stepIndex] : null; }
  get finished() { return this.missionIndex >= MISSIONS.length; }

  currentSpot() {
    if (!this.mission || !this.step || this.step.kind !== 'goto') return null;
    return spotFor(this.mission.id, this.stepIndex);
  }

  startMission(idx) {
    this.missionIndex = idx;
    this.stepIndex = 0;
    this.active = true;
    this.guardsSpawned = false;
    return this.mission;
  }

  advance() {
    this.stepIndex += 1;
    if (this.stepIndex >= this.mission.steps.length) {
      const reward = this.mission.reward;
      this.missionIndex += 1;
      this.stepIndex = 0;
      this.active = this.missionIndex < MISSIONS.length;
      this.guardsSpawned = false;
      return { completed: true, reward, next: this.mission || null };
    }
    return { completed: false, reward: 0, next: null };
  }

  // Cash pickup: a spinning green bundle the player walks/drives over.
  dropCash(x, z, amount) {
    const g = new THREE.Group();
    const bundle = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x2fae5a }));
    bundle.castShadow = true;
    g.add(bundle);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.12, 0.2),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    band.position.y = 0.05;
    g.add(band);
    g.position.set(x, 0.6, z);
    this.scene.add(g);
    const drop = { mesh: g, x, z, amount, spin: 0 };
    this.cashDrops.push(drop);
    return drop;
  }

  update(dt, playerPos, callbacks) {
    // Marker bob + spin.
    const spot = this.currentSpot();
    if (this.active && spot && this.step && this.step.kind === 'goto') {
      this.marker.visible = true;
      this.beam.visible = true;
      this.marker.position.set(spot.x, 5 + Math.sin(performance.now() * 0.003) * 0.8, spot.z);
      this.marker.rotation.y += dt * 1.5;
      this.beam.position.set(spot.x, 30, spot.z);
    } else {
      this.marker.visible = false;
      this.beam.visible = false;
    }
    for (const d of this.cashDrops) {
      d.spin += dt * 3;
      d.mesh.rotation.y = d.spin;
      d.mesh.position.y = 0.6 + Math.sin(d.spin * 1.4) * 0.15;
    }
    // Walk over cash to collect it.
    for (let i = this.cashDrops.length - 1; i >= 0; i--) {
      const d = this.cashDrops[i];
      const dx = playerPos.x - d.x, dz = playerPos.z - d.z;
      if (dx * dx + dz * dz < 4) {
        this.scene.remove(d.mesh);
        this.cashDrops.splice(i, 1);
        if (callbacks && callbacks.onCash) callbacks.onCash(d.amount);
      }
    }
  }

  // Free-roam cash pickups scattered around the city (side activity).
  scatterCash(count, rng) {
    for (let i = 0; i < count; i++) {
      const x = (rng() * 2 - 1) * 180;
      const z = (rng() * 2 - 1) * 170;
      this.dropCash(x, z, 50 + Math.floor(rng() * 4) * 25);
    }
  }
}

export { STORY_END };
