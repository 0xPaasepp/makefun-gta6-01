// SOLMAR · main.js — bootstrap: build the game, wire the start screen,
// expose the window.SOLMAR debug API used by playtests and screenshots.
import { Game } from './game.js';
import { hasSave } from './save.js';

const game = new Game();

const startScreen = document.getElementById('start-screen');
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');

if (hasSave()) {
  btnContinue.style.display = 'inline-block';
  btnContinue.textContent = 'CONTINUE — PICK UP WHERE YOU LEFT OFF';
} else {
  btnContinue.style.display = 'none';
}
btnNew.addEventListener('click', () => game.startNew());
btnContinue.addEventListener('click', () => game.continueGame());

// Also allow Enter on the start screen to start a new game.
window.addEventListener('keydown', (e) => {
  if (!game.started && e.code === 'Enter') game.startNew();
});

// ?autostart=1 intentionally does nothing: the game starts via
// window.SOLMAR.startNew() (start screen button or debug call).
window.SOLMAR = {
  game,
  snapshot: () => game.snapshot(),
  state: () => game.state(),
  startNew: () => game.startNew(),
  teleport: (x, z) => game.teleport(x, z),
  setHeading: (h) => game.setHeading(h),
  faceCamera: () => game.faceCamera(),
  followCamera: () => game.followCamera(),
  enterNearestCar: () => game.enterNearestCar(6),
  exitCar: () => game.exitCar(),
  setWanted: (n) => game.setWanted(n),
  setMission: (i, stage) => game.setMission(i, stage === undefined ? 0 : stage),
  setMoney: (n) => game.setMoney(n),
  setSpeed: (v) => game.setSpeed(v),
  showDialogue: (text, sec) => game.showDialogue({ who: 'Kito', text }, sec || 5),
  shoot: () => game.shoot(),
};
window.__solmar = window.SOLMAR;
startScreen.classList.add('ready');
