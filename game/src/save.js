// save.js — localStorage save/load. Saves money, health, mission progress,
// player position, wanted level and the clock. Versioned so old saves never
// crash a new build.

import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      money: state.money,
      health: state.health,
      missionIndex: state.missionIndex,
      stepIndex: state.stepIndex,
      wanted: state.wanted,
      player: { x: state.player.x, z: state.player.z, heading: state.player.heading },
      minutes: state.minutes,
      storyDone: state.storyDone,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}
