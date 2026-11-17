// main.js — bootstrap: create the game. Nothing else lives here so the
// entry point stays tiny and obvious.

import { Game } from './game.js';

const container = document.getElementById('app');
const game = new Game(container);

// Expose a handle for the playtest / screenshot driver (and curious players).
window.__solmar = game;
