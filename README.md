# SOLMAR — Streets of the Sun

An original open-world crime game for the make.fun **gta6-01** competition
("Make GTA 6"): a sunny coastal city, a wheelman taking back his sister's
garage from the Vane family — steal a car, lose the cops in a Neon Sport,
pull a harbour heist.

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/0xPaasepp/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/0xPaasepp/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

## Play

Open `game/index.html` in a desktop browser — fully static, zero network
requests. Three.js is vendored under `game/vendor/`.

- **WASD / arrows** — move & drive · **E** — enter / exit car · **F** — pistol
- **SPACE** — jump · **M** — city map · **P / ESC** — pause · **SHIFT** — sprint
- Drag the mouse to orbit the camera; touch buttons on mobile.

## The game

- **Solmar**: a procedural coastal city — plaza + fountain, Palm Avenue,
  marina, docks with cranes, residential / commercial / industrial districts,
  parks, parking bays, traffic lights, day–sunset–night cycle.
- **Rendering**: ACES tone mapping, PMREM environment map, MeshPhysicalMaterial
  clearcoat car paint, animated water, fog, PCF soft shadows, lit windows and
  streetlights at night.
- **Cars**: 7 original models with detailed bodywork — cabin, glass, wheels,
  headlights, brake lights, mirrors, exhaust, interiors — plus suspension
  visuals, weight transfer, gear-based engine sound and damage smoke.
- **Systems**: wanted 0–5 (foot cops, cruisers that chase and ram, roadblocks,
  police helicopter at wanted 4), 3 story missions, a Sunset Sprint time
  trial, moving traffic, pedestrians, pistol combat, autosave + Continue.
- **Audio**: everything synthesized in WebAudio — engine, tires, collisions,
  gunshots, and SOL FM procedural radio. No audio files.

## Missions

1. **A Car for Mara** — steal a car, deliver it to the garage (+$500).
2. **Neon Nights** — grab the Neon Sport at the marina and lose the police (+$800).
3. **Harbour Heist** — four armed Vane guards, take the crates (+$3,500).

## Build

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to the
output dir and writes `dossier.json` via `vendor/makefun-game.ts`.

## License

MIT — see `LICENSE`. All characters, places, cars, and art are original;
nothing is taken from any other game.
