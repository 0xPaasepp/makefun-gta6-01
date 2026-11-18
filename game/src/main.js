// SOLMAR bootstrap — creates the game, wires start/continue buttons,
// exposes window.SOLMAR + window.__solmar debug API (playtests use it).
import { Game } from './game.js';
import { DIALOGUES } from './config.js';

const game = new Game();
game.init();

const api = {
  game,
  state: () => game.state(),
  startNew: () => game.startNew(),
  continueGame: () => game.continueGame(),
  teleport: (x, z) => game.teleport(x, z),
  setHeading: (h) => game.setHeading(h),
  faceCamera: () => game.faceCamera(),
  followCamera: () => game.followCamera(),
  enterNearestCar: () => game.tryEnterCar(),
  exitCar: () => game.exitCar(),
  setWanted: (n) => game.setWanted(n),
  setTimeOfDay: (h) => game.setTimeOfDay(h),
  setMission: (i) => game.setMission(i),
  setMoney: (n) => game.setMoney(n),
  setSpeed: (s) => game.setSpeed(s),
  showDialogue: (text, who) => game.showDialogue(text, who),
  shoot: () => game.combat.shoot(),
  aimAt: (x, z) => game.aimAt(x, z),
  snapshot: () => game.state(),
};
window.SOLMAR = api;
window.__solmar = api;

document.getElementById('btn-start').addEventListener('click', () => game.startNew());
document.getElementById('btn-continue').addEventListener('click', () => game.continueGame());
document.getElementById('btn-resume').addEventListener('click', () => game.togglePause());

// Continue button only enabled when a save exists.
if (!game.save.hasSave()) {
  const b = document.getElementById('btn-continue');
  b.disabled = true; b.style.opacity = '0.4';
}

// ?autostart=1 — used by the automated playtest.
if (new URLSearchParams(location.search).get('autostart') === '1') {
  game.startNew();
}
