// Autosave + manual save to localStorage. Plain JSON, versioned key, and a
// validity check so a corrupt save never bricks the title screen.
// Rebuild 12: payload v2 — respect, shells, paint and owned weapons ride
// along; a v1 save migrates cleanly with defaults.
// Rebuild 13: payload v3 — stats (escapes, takedowns, races won) ride
// along too; v2 saves migrate cleanly with zeroed stats.
import { CONFIG } from './config.js';

export class SaveSystem {
  constructor() { this.key = CONFIG.saveKey; }
  hasSave() {
    try { return !!localStorage.getItem(this.key); } catch (e) { return false; }
  }
  write(data) {
    try {
      const payload = {
        v: 3, savedAt: Date.now(),
        respect: 0, shellsGot: [], paint: 0, weaponsOwned: { pistol: true },
        stats: { escapes: 0, takedowns: 0, racesWon: 0 },
        ...data,
      };
      localStorage.setItem(this.key, JSON.stringify(payload));
      return true;
    } catch (e) { return false; }
  }
  read() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (typeof d !== 'object' || d === null) return null;
      if (typeof d.money !== 'number' || typeof d.mission !== 'number') return null;
      // v1 -> v2 migration: fill the rebuild-12 fields with defaults.
      if (d.v !== 2 && d.v !== 3) {
        d.v = 3;
        d.respect = typeof d.respect === 'number' ? d.respect : 0;
        d.shellsGot = Array.isArray(d.shellsGot) ? d.shellsGot : [];
        d.paint = typeof d.paint === 'number' ? d.paint : 0;
        d.weaponsOwned = d.weaponsOwned || { pistol: true };
      }
      // v2 -> v3 migration: stats default to zero.
      if (d.v === 2) {
        d.v = 3;
        d.stats = { escapes: 0, takedowns: 0, racesWon: 0 };
      }
      if (!d.stats || typeof d.stats !== 'object') d.stats = { escapes: 0, takedowns: 0, racesWon: 0 };
      return d;
    } catch (e) { return null; }
  }
  clear() { try { localStorage.removeItem(this.key); } catch (e) { /* ignore */ } }
}
