// SOLMAR — Streets of the Sun. Entry point: boots the game, exposes the
// debug API used by the playtest and screenshot scripts, and runs the loop.
// Static files only, no network requests.

import { Game } from './game.js';

const game = new Game();

function startLoop() {
  const tick = (now) => {
    game.frame(now);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
startLoop();

// Debug / automation API. Player heading forward is (sin h, cos h);
// default heading PI faces north (-z).
window.SOLMAR = {
  game,
  snapshot: () => game.snapshot(),
  state: () => game.state(),
  startNew: (fromSave = false) => game.startNew(fromSave),
  teleport: (x, z) => game.teleport(x, z),
  setHeading: (h) => game.setHeading(h),
  faceCamera: () => game.faceCamera(),
  followCamera: () => game.followCamera(),
  enterNearestCar: () => game.enterNearestCar(),
  exitCar: () => game.exitCar(),
  setWanted: (n) => game.setWanted(n),
  setMission: (i, stage = 0) => game.missions.setMission(i, stage),
  setMoney: (n) => game.setMoney(n),
  setSpeed: (v) => game.setSpeed(v),
  setTime: (h) => { game.hour = h; game.city.update(h); },
  showDialogue: (text, sec = 5, who = 'Kito') => game.hud.showDialogue(text, who, sec),
  shoot: () => game.combat.shoot(),
  save: () => game.saveGame(),
};
