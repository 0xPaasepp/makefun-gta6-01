// SOLMAR — missions. Three-chapter story thread: steal a car for Mara,
// grab the Neon Sport and lose the cops, then the harbour heist for $3,500.
// The manager owns the objective text, stage bars and payouts; the game
// wires the world events (steal, deliver, grab, evade, cash) into it.

import { CONFIG } from './config.js';

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.index = 0; // 0-based: 0 = M1
    this.stage = 0;
    this.evadeT = 0;
    this.unseenT = 0;
    this.done = false;
    this.completed = [false, false, false];
    this.objective = '';
    this.chapter = '';
    this.hint = '';
    this.timerText = '';
    this._refreshText();
  }

  get mission() { return CONFIG.missions[this.index]; }
  get stageDef() { return this.mission ? this.mission.stages[this.stage] : null; }

  _refreshText() {
    const m = this.mission;
    if (!m || this.done) {
      this.chapter = 'SOLMAR — FREE ROAM';
      this.objective = 'All missions complete. The city is yours, Dario.';
      this.hint = 'Cruise, steal cars, dodge the law.';
      this.timerText = '';
      return;
    }
    this.chapter = m.chapter;
    this.objective = this.stageDef.objective;
    this.hint = this.stageDef.hint;
    this.timerText = '';
  }

  /** Debug / scripted jump: setMission(i, stage) with i 0-based. */
  setMission(i, stage = 0) {
    this.index = Math.max(0, Math.min(2, i));
    this.stage = Math.max(0, Math.min(1, stage));
    this.evadeT = 0; this.unseenT = 0;
    this._refreshText();
  }

  /** Objective target for the minimap / GPS: {x, z, label}. */
  target() {
    if (!this.mission || this.done) return null;
    const key = this.stageDef.key;
    if (this.index === 0) {
      return key === 'steal' ? { x: -37.5, z: 12, label: 'Steal a car' }
        : { x: CONFIG.garage.x, z: CONFIG.garage.z, label: "Mara's garage" };
    }
    if (this.index === 1) {
      return key === 'grab' ? { x: CONFIG.neonSport.x, z: CONFIG.neonSport.z, label: 'Neon Sport' }
        : { x: -30, z: -150, label: 'Lose the cops' };
    }
    return key === 'heist' ? { x: CONFIG.cashCrates.x, z: CONFIG.cashCrates.z, label: 'Cash crates' }
      : { x: -150, z: 150, label: 'Get clear' };
  }

  complete() {
    const m = this.mission;
    if (!m) return;
    this.game.addMoney(m.reward);
    this.completed[this.index] = true;
    this.game.hud.flashMoney(m.payoutText);
    this.game.audio.playChime();
    const lines = [CONFIG.dialogue.maraDone1, CONFIG.dialogue.kitoDone2, CONFIG.dialogue.kitoDone3];
    this.game.hud.showDialogue(lines[this.index], 'Kito', 5);
    this.game.saveGame();
    this.index++;
    this.stage = 0;
    this.evadeT = 0; this.unseenT = 0;
    if (this.index >= CONFIG.missions.length) this.done = true;
    this._refreshText();
  }

  advanceStage() {
    this.stage++;
    if (this.stage >= this.mission.stages.length) this.complete();
    else this._refreshText();
  }

  // ---- world events called by the game
  onStealCar() {
    if (this.index === 0 && this.stage === 0) this.advanceStage();
  }
  onDeliver() {
    if (this.index === 0 && this.stage === 1) this.complete();
  }
  onGrabNeon() {
    if (this.index === 1 && this.stage === 0) {
      this.advanceStage();
      this.game.setWanted(3);
      this.game.hud.showDialogue(CONFIG.dialogue.kitoNeon, 'Kito', 5);
      this.evadeT = 0;
    }
  }
  onCashGrabbed() {
    if (this.index === 2 && this.stage === 0) this.advanceStage();
  }
  onEscapeClear() {
    if (this.index === 2 && this.stage === 1) this.complete();
  }

  update(dt) {
    if (!this.mission || this.done) return;
    // M2 evade: survive unseen. Wanted 0 = clean; 25s of breaking line of
    // sight also counts (police far away counts as unseen).
    if (this.index === 1 && this.stage === 1) {
      const wanted = this.game.wanted;
      const nearest = this.game.nearestPoliceDist();
      if (wanted === 0) { this.complete(); return; }
      if (nearest > 45) {
        this.unseenT += dt;
        this.evadeT += dt;
        this.timerText = `UNSEEN ${Math.ceil(this.unseenT)}s / 25s`;
        if (this.unseenT >= 25) { this.game.setWanted(0); this.complete(); return; }
      } else {
        this.unseenT = 0;
        this.timerText = 'SHAKE THE TAIL — stay out of sight';
      }
    }
    // M3 escape: once the cash is grabbed, get 60+ units from the docks
    // with wanted 0, or simply survive 20s clear of the docks.
    if (this.index === 2 && this.stage === 1) {
      const d = Math.hypot(this.game.player.x - CONFIG.docks.x, this.game.player.z - CONFIG.docks.z);
      if (d > 70 && this.game.wanted === 0) { this.complete(); return; }
      this.timerText = d > 70 ? 'HEAT DYING — stay clear' : 'GET CLEAR OF THE DOCKS';
    }
  }
}
