// SOLMAR · save.js — localStorage autosave (every 30 s + on mission complete).
import { CFG } from './config.js';

export function writeSave(game) {
  try {
    const s = {
      v: 1, money: game.money, mission: game.mission, stage: game.stage,
      health: game.health, armor: game.armor, ammo: game.ammo,
      px: game.px, pz: game.pz, heading: game.heading,
      hour: game.hour, savedAt: Date.now(),
    };
    localStorage.setItem(CFG.saveKey, JSON.stringify(s));
    return true;
  } catch (e) { return false; }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || typeof s.money !== 'number' || typeof s.mission !== 'number') return null;
    return s;
  } catch (e) { return null; }
}

export function hasSave() { return readSave() !== null; }
export function clearSave() { try { localStorage.removeItem(CFG.saveKey); } catch (e) {} }
