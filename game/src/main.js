// SOLMAR bootstrap: create the game, wire the screens, expose a small
// debug API (window.SOLMAR) used by the playtest and the screenshots.
import { Game } from './game.js';

const game = new Game();

function wire(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

wire('btn-new', () => game.startNew());
wire('btn-continue', () => game.startContinue());
wire('btn-resume', () => {
  game.state = 'playing';
  game.hud.showScreen('playing');
});
wire('btn-restart', () => game.startNew());
wire('btn-retry-busted', () => {
  game.state = 'playing';
  game.hud.showScreen('playing');
});
wire('btn-retry-wasted', () => {
  game.state = 'playing';
  game.hud.showScreen('playing');
});
wire('btn-menu', () => {
  game.state = 'menu';
  game.hud.showScreen('start');
  game.updateStartButtons();
});

game.loop();

// Debug API for the playtest and screenshots (not part of gameplay).
window.SOLMAR = {
  game,
  snapshot: () => game.snapshot(),
  state: () => game.state,
  startNew: () => game.startNew(),
  teleport: (x, z) => {
    if (game.player.car) game.exitCar();
    game.player.x = x;
    game.player.z = z;
    game.playerMesh.position.set(x, 0, z);
  },
  setHeading: (h) => {
    game.player.heading = h;
  },
  faceCamera: () => {
    game.debugFrontCam = true;
  },
  followCamera: () => {
    game.debugFrontCam = false;
  },
  enterNearestCar: () => {
    const car = game.nearestParkedCar(6);
    if (car) game.enterCar(car);
    return car ? car.model.id : null;
  },
  exitCar: () => game.exitCar(),
  teleportCar: (x, z, heading) => {
    if (!game.player.car) return false;
    game.player.car.x = x;
    game.player.car.z = z;
    if (heading !== undefined) game.player.car.heading = heading;
    game.player.x = x;
    game.player.z = z;
    game.player.heading = game.player.car.heading;
    game.player.car.sync();
    return true;
  },
  setWanted: (n) => game.police.setWanted(n),
  setMission: (index, stage) => {
    game.missions.index = index;
    game.missions.stage = stage;
  },
  setMoney: (n) => {
    game.money = n;
  },
  setSpeed: (v) => {
    if (game.player.car) game.player.car.speed = v;
  },
  showDialogue: (text, seconds) => game.hud.setDialogue(text, seconds ?? 5),
  shoot: () => {
    const from = { x: game.player.x, z: game.player.z };
    return from;
  },
};
