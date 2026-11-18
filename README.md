# SOLMAR — Streets of the Sun

[![Competition](https://make.fun/badge/gta6-01/competition)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/rank)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/reward)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the **gta6-01** bounty: the most
complete open-world crime game as static files. Fully original — its own
city, names, story and art. Nothing from Rockstar/GTA.

## The game

You are **Dario Voss**, wheelman of **Solmar**, a sunny coastal city with a
plaza and fountain, a palm avenue, a marina and a harbour. Your sister
**Mara** needs a car, the **Neon Sport** is waiting at the marina, and the
**Vane family** keeps $3,500 in cash at the docks.

- **Open world:** drive or walk anywhere in Solmar. 7 original car models,
  16 traffic cars, 26 pedestrians. Steal any car — stealing an occupied one
  draws the police and sets off its alarm.
- **Wanted system 0–5:** decays when you stay unseen. Foot cops chase and
  can bust you, cruisers chase and ram, roadblocks at high wanted.
- **3 missions:** steal a car for Mara (+$500), grab the Neon Sport and lose
  the cops (+$1,000), harbour heist against 4 armed guards (+$3,500).
- **Combat:** pistol with tracers. **HUD:** health/armor, money, wanted
  stars, clock, live circular minimap with mission blips. Start screen with
  Continue, pause, autosave every 30 s and on mission complete.
- **Audio:** everything synthesized with WebAudio, including radio-style music.
- **Tech:** Three.js vendored under `game/vendor/`. Static files under
  `game/` — `game/index.html` opens in a desktop browser with no network
  requests.

## Controls

WASD move & drive • E get in / out of a car • Click or Space shoot •
Shift run • P pause • M radio on/off

## Build

`node main.ts` copies `game/` + `screenshots/` to `/output` and writes
`/output/dossier.json` (via the vendored `vendor/makefun-game.ts`).
Node standard library only.

## License

MIT — see LICENSE.
