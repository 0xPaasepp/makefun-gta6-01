# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/0xPaasepp/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/0xPaasepp/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMAR — Streets of the Sun: an original open-world crime game set in the coastal city of Solmar at permanent golden hour. Drive, steal cars, outrun the police, and run eight named story missions for Dario Voss — plus taxi fares, courier runs, two street races, a package hunt, 10 hidden Sun Shells, and a working paint shop at Mara's garage.

## Run it

```sh
python3 -m http.server 8080 --directory game
```

Then open http://localhost:8080/ in a desktop browser. No network needed — everything (including three.js) is vendored under `game/`.

## Play

- **WASD / arrows** — move on foot, drive in a car · **Space** — handbrake
- **E** — steal / exit a car (stealing an occupied car draws the police)
- **F / click** — shoot · **Q / 1–4** — weapon wheel (Pistol, SMG, Shotgun, Rifle)
- **R** — cycle radio stations (OLA 104.5 with DJ Marea, NEON 88 with DJ Vela, PALM 92 with DJ Sol) · **H** — horn · **N** — mute · **P / Esc** — pause
- **M / Tab** — full-city map: named districts, legend, gold route to the objective, stats (Cash, Story x/8, Shells, Respect, Escapes / Takedowns / Races won), SAVE / LOAD
- **C** — repaint your car at Mara's garage ($50 a coat, 6 colours)

Eight named story missions, each with a giver and an objective: **A Car for Mara** (steal a car, +$500), **Neon Nights** (grab the Neon Sport at the marina and lose the cops, +$800), **Harbour Heist** (take down 4 armed guards and grab the cash at the docks, +$3,500), **Paint It Gold** (repaint a car at the garage, +$600), **Marina Sprint** (win the east-road race, +$700), **Badge Trouble** (get 2+ stars, then lose the cops clean, +$900), **Shell Game** (find 3 Sun Shells for DJ Marea, +$500), and the finale **King of the Sunset** (win the Palm Avenue sprint, +$5,000). The story opens on Mara's incoming phone call.

Wanted level 0–5 with foot cops, chase cruisers, roadblocks and a police helicopter, plus a live dispatch panel with named units (UNIT 7 — ROOK, AIR 1 — HALCON…) and IN SIGHT / SEARCHING / EVADING states with a live evade %. Getting caught or wasted shows an explicit BUSTED / WASTED screen — never a silent respawn. Respect ranks from NOBODY to LEGEND OF SOLMAR; 10 Sun Shells to find; autosave every 30 seconds and on every mission complete.

## Golden hour, glare-safe

The clock lives inside the 16:30–19:30 golden band forever and the sun sits low in the west, off the north–south Palm Avenue sightlines — so driving into the sunset never whites the screen out. Long shadows stretch east from every building, palm and car, headlights glow, and a vignette keeps the street readable.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ddn7bre1&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
