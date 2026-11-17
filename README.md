# SOLMAR — Streets of the Sun

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/0xPaasepp/makefun-gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/0xPaasepp/makefun-gta6-01/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game for make.fun's **gta6-01 "Make GTA 6"** bounty.
A completely original city, story, characters and art — nothing from any
commercial game.

## The game

**Solmar** is a sun-soaked coastal city. You are **Dario Voss**, a wheelman who
burned his last crew. Your sister **Mara** runs a garage on Coral Row and your
old friend **Kito** has a plan to take the harbour back from the **Vane family**.

- **Open world on foot and by car** — a full city grid with a beach, a harbour,
  a marina, traffic, pedestrians, palms and a central plaza
- **Steal and drive cars** — 7 original car models; yank a driver out of a
  traffic car or take a parked one (the police notice)
- **Wanted level + police response** — 0–5 stars; police cars chase and ram,
  foot cops chase and bust you; break line of sight to cool down
- **Missions + story** — 3 missions: steal a car for Mara, grab the Neon Sport
  at the marina and lose the cops, then the harbour heist with armed guards
- **Combat** — pistol with tracers, reload, guards who shoot back
- **HUD with minimap** — health, money, wanted stars, clock, speed, mission
  objective and a live circular minimap with police and mission markers
- **Start screen, pause, save** — progress autosaves (localStorage) after every
  mission and every 30 seconds; continue from the menu
- **Sound, all synthesized** — engine hum, sirens, gunshots, a warm bassline
  loop; no audio files, no network

## Play

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome. It plays with **zero network requests** — every script is a file under
`game/` (Three.js is vendored as `game/vendor/three.module.min.js`).

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080/index.html
```

**Controls:** WASD move/drive · mouse drag to look · Shift sprint · E enter /
steal a car · Space handbrake · Click shoot · R reload · C camera · H horn ·
P / Esc pause · M music.

## Layout

- `game/index.html` — page, HUD, screens
- `game/src/config.js` — tuning, city layout, car models, mission scripts
- `game/src/city.js` — the city: streets, buildings, beach, harbour
- `game/src/vehicles.js` — car models + traffic AI
- `game/src/people.js` — pedestrians, foot cops, guards
- `game/src/police.js` — wanted system + police chase AI
- `game/src/missions.js` — mission state, marker, cash drops
- `game/src/combat.js` — pistol shooting
- `game/src/hud.js` — HUD + minimap
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — synthesized sound (WebAudio, no files)
- `game/src/save.js` — localStorage save/load
- `game/src/game.js` — player, camera, mission wiring, main loop
- `game/src/main.js` — bootstrap
- `main.ts` — entrypoint: copies `game/` + `screenshots/` to `/output` and
  writes `dossier.json` (pure Node stdlib)

## License

MIT — see [LICENSE](LICENSE).
