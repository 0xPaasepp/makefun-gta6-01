// The 3-mission story thread. Missions advance on game events; the game
// applies rewards and dialogue. Marker = the yellow beacon + minimap blip.
import { CONFIG } from './config.js';

export class Missions {
  constructor(onComplete) {
    this.index = 0; // 0-based: mission 1, 2, 3
    this.stage = 'steal';
    this.completed = 0;
    this.onComplete = onComplete;
  }

  get current() {
    return CONFIG.missions[this.index] ?? null;
  }

  get done() {
    return this.index >= CONFIG.missions.length;
  }

  title() {
    const m = this.current;
    return m ? m.title : 'Solmar — Free Roam';
  }

  text() {
    if (this.done) return 'All missions complete. Solmar is yours — free roam.';
    const m = this.current;
    if (this.index === 0) {
      return this.stage === 'steal'
        ? 'Steal any car (walk up and press E) and bring it to Mara.'
        : 'Deliver the car to Mara\'s garage — drive into the yellow marker.';
    }
    if (this.index === 1) {
      return this.stage === 'gotoMarina'
        ? 'Get the Neon Sport at the marina — it is parked on the pier.'
        : 'Lose the police! Stay unseen until your wanted level clears.';
    }
    if (this.index === 2) {
      return 'Grab the cash from the crates at the docks. The guards are armed.';
    }
    return m.brief;
  }

  marker() {
    if (this.done) return null;
    if (this.index === 0) return this.stage === 'steal' ? null : CONFIG.spots.garage;
    if (this.index === 1) return this.stage === 'gotoMarina' ? CONFIG.spots.neonSport : null;
    if (this.index === 2) return CONFIG.spots.cashCrates;
    return null;
  }

  // Returns the completed mission (or null) so the game can pay + save.
  event(evt) {
    if (this.done) return null;
    if (this.index === 0) {
      if (evt === 'carEntered' && this.stage === 'steal') {
        this.stage = 'deliver';
        return null;
      }
      if (evt === 'delivered' && this.stage === 'deliver') return this.complete();
    }
    if (this.index === 1) {
      if (evt === 'neonTaken' && this.stage === 'gotoMarina') {
        this.stage = 'evade';
        return null;
      }
      if (evt === 'wantedZero' && this.stage === 'evade') return this.complete();
    }
    if (this.index === 2) {
      if (evt === 'cashGrabbed') return this.complete();
    }
    return null;
  }

  complete() {
    const m = this.current;
    this.completed++;
    this.index++;
    this.stage = this.index === 0 ? 'steal' : this.index === 1 ? 'gotoMarina' : this.index === 2 ? 'gotoDocks' : 'done';
    if (this.onComplete) this.onComplete(m);
    return m;
  }

  serialize() {
    return { index: this.index, stage: this.stage, completed: this.completed };
  }

  restore(data) {
    if (!data) return;
    this.index = data.index ?? 0;
    this.stage = data.stage ?? 'steal';
    this.completed = data.completed ?? 0;
  }
}
