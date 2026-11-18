// SOLMAR save — localStorage, versioned JSON, validated on load.
import { SAVE_KEY } from './config.js';

export class SaveSys {
  constructor(game) { this.game = game; }
  serialize() {
    const g = this.game;
    return {
      v: 1, money: g.money, mission: g.missions.index, stage: g.missions.stage,
      px: g.px, pz: g.pz, heading: g.heading, health: g.health, armor: g.armor,
      wanted: g.wanted, timeOfDay: g.timeOfDay, savedAt: Date.now(),
    };
  }
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize()));
      return true;
    } catch (e) { return false; }
  }
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.v !== 1 || typeof d.money !== 'number' || typeof d.mission !== 'number') return null;
      return d;
    } catch (e) { return null; }
  }
  hasSave() { return this.load() !== null; }
  apply(d) {
    const g = this.game;
    g.money = d.money; g.health = d.health ?? 100; g.armor = d.armor ?? 0;
    g.wanted = d.wanted ?? 0; g.timeOfDay = d.timeOfDay ?? 480;
    g.px = d.px ?? 0; g.pz = d.pz ?? 10; g.heading = d.heading ?? Math.PI;
    g.missions.setIndex(d.mission);
    g.missions.stage = d.stage || 'steal';
    if (g.playerMesh) g.playerMesh.position.set(g.px, 0, g.pz);
  }
}
