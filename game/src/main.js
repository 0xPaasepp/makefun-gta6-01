// SOLMAR boot: build the game, wire the title screen, autostart when the
// URL asks (?autostart=1) so automated playtests can drive straight in.
// Rebuild 12: the opening line is Mara's named-mission intro, and the
// boot exposes the golden-hour phase on the title screen.
// Rebuild 13: the opening line arrives as Mara's incoming PHONE CALL,
// the same presentation a real NEW GAME shows.
import { Game } from './game.js';
import { MISSION_DEFS } from './config.js';

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.__solmarGame = game;
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') {
    document.getElementById('title-screen').style.display = 'none';
    game.state.started = true;
    const def = MISSION_DEFS[0];
    game.hud.showPhoneCall(def.giver, def.intro, 9000);
  }
});
