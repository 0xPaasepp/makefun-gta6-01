// SOLMAR — save. localStorage autosave (every 30s + on mission complete),
// Continue restores money, mission, position, health and time of day.

export const SAVE_KEY = 'solmar-save-v1';

export function saveGameData(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGameData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d !== 'object' || d === null) return null;
    if (typeof d.money !== 'number' || typeof d.missionIndex !== 'number') return null;
    return d;
  } catch (e) { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
