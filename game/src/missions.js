// SOLMAR · missions.js — 3-mission story state machine.
// complete() advances the mission state FIRST, then saves — so Continue
// restores the NEW mission, never the one just finished.
import { CFG, DIALOGUES, MISSIONS } from './config.js';

export class Missions {
  constructor(game) { this.game = game; }
  get mission() { return this.game.mission; }
  get stage() { return this.game.stage; }

  objective() {
    if (this.game.mission >= 3) return { chapter: 'SOLMAR — FREE ROAM', text: 'The city is yours. Drive, explore, cause trouble.', sub: 'Wanted decays when you stay out of sight.' };
    const m = MISSIONS[this.game.mission];
    const s = m.stages[Math.min(this.game.stage, m.stages.length - 1)];
    return { chapter: m.chapter, text: s.text, sub: s.sub };
  }
  // Gold blip target for the minimap / map.
  target() {
    const g = this.game;
    if (g.mission === 0) return g.stage === 0 ? null : { x: CFG.garage.x, z: CFG.garage.z };
    if (g.mission === 1) return g.stage === 0 ? { x: CFG.neonSport.x, z: CFG.neonSport.z } : null;
    if (g.mission === 2) return { x: CFG.cashCrates.x, z: CFG.cashCrates.z };
    return null;
  }
  complete() {
    const g = this.game;
    const m = MISSIONS[g.mission];
    if (!m) return;
    g.money += m.reward;
    g.mission += 1; g.stage = 0; // advance FIRST
    if (g.mission === 1) g.showDialogue(DIALOGUES.delivered, 4);
    else if (g.mission === 2) g.showDialogue(DIALOGUES.evaded, 4);
    else if (g.mission === 3) g.showDialogue(DIALOGUES.heistDone, 5);
    if (g.audio) g.audio.chime();
    g.saveNow(); // save AFTER advancing
    if (g.mission === 2) g.spawnGuards();
  }
  // Called when the player enters a car.
  onEnterCar(car) {
    const g = this.game;
    if (g.mission === 0 && g.stage === 0) {
      g.stage = 1;
      g.showDialogue({ who: 'Mara', text: 'Mara: That\u2019s the one — bring it to my garage at the north end of the plaza road.' }, 4);
    }
    if (g.mission === 1 && g.stage === 0 && car.isNeon) {
      g.stage = 1;
      g.setWanted(3);
      g.showDialogue(DIALOGUES.neon, 4);
    }
  }
  update(dt) {
    const g = this.game;
    // M1: deliver the stolen car to the garage.
    if (g.mission === 0 && g.stage === 1 && g.inCar) {
      const d = Math.hypot(g.px - CFG.garage.x, g.pz - CFG.garage.z);
      if (d < 7) this.complete();
    }
    // M2 evade: progress while no police unit is close; wanted 0 also completes.
    if (g.mission === 1 && g.stage === 1) {
      if (g.wanted <= 0) { this.complete(); return; }
      const near = g.police.nearestDist();
      if (near === null || near > 45) {
        g.evadeT += dt;
        if (g.evadeT >= 12) this.complete();
      } else g.evadeT = Math.max(0, g.evadeT - dt * 0.5);
    }
    // M3: stand by the cash crates to grab them, then get clear.
    if (g.mission === 2 && g.stage === 0) {
      const d = Math.hypot(g.px - CFG.cashCrates.x, g.pz - CFG.cashCrates.z);
      if (d < 4.5) {
        g.grabT += dt;
        if (g.grabT >= 1.6) { g.stage = 1; g.showDialogue({ who: 'Dario', text: 'Dario: Got it — $3,500. Now get clear of the docks!' }, 4); }
      } else g.grabT = 0;
    }
    if (g.mission === 2 && g.stage === 1) {
      const d = Math.hypot(g.px - CFG.docksPoint.x, g.pz - CFG.docksPoint.z);
      if (d > 55) this.complete();
    }
  }
}
