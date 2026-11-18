// Save / load through localStorage. One key, plain JSON, validated on read.
import { CONFIG } from './config.js';

export function saveGame(snapshot) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      money: snapshot.money,
      health: snapshot.health,
      armor: snapshot.armor,
      mission: snapshot.mission,
      missionStage: snapshot.missionStage,
      player: { x: snapshot.player.x, z: snapshot.player.z, heading: snapshot.player.heading },
      gameMinutes: snapshot.gameMinutes,
      completedMissions: snapshot.completedMissions,
    };
    localStorage.setItem(CONFIG.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    if (typeof data.money !== 'number' || typeof data.mission !== 'number') return null;
    if (!data.player || typeof data.player.x !== 'number' || typeof data.player.z !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(CONFIG.saveKey);
  } catch {
    // storage unavailable — nothing to clear
  }
}
