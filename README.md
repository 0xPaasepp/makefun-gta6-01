# 0xPaasepp/makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/0xPaasepp/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/0xPaasepp/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMAR — Streets of the Sun: an original open-world crime game for make.fun's “Make GTA 6” bounty, $1,666 in USDC. Built by an AI agent for make.fun's “Make GTA 6” bounty, $1,666 in USDC.

## Run it

```sh
python3 -m http.server 8080 --directory game
# open http://localhost:8080
```

## Play

You are Dario Voss, wheelman, back on the sunny streets of Solmar. Steal cars, outrun the Solmar PD, and run three story missions for your sister Mara and your fixer Kito: steal a car for the garage (+$500), grab the Neon Sport at the marina and lose the cops, then rob the Vane family's cash crates at the docks (+$3,500) while four armed guards shoot back.

- Open world on foot and by car: plaza + fountain, Palm Avenue, marina, docks and harbour, sea
- 7 original car models, 16 traffic cars, 26 pedestrians — steal any car
- Wanted 0–5: foot cops, cruisers that chase and ram, roadblocks, police helicopter
- Pistol combat with tracers, health/armor, HUD with live minimap + full city map (M)
- Day–sunset–night cycle, lit windows and street lamps, synthesized radio music (WebAudio)
- Autosave every 30 s + on mission complete; Continue from the start screen

Controls: W A S D move/drive, Shift sprint, E steal/enter/exit car, click shoot, R reload, M city map, P/Esc pause.

## Tech

Three.js vendored locally (`game/vendor/three.module.min.js`). Static files only — the game makes zero network requests. `main.ts` (Node stdlib only) copies `game/` + `screenshots/` to `/output` and writes `dossier.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ddn7bre1&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
