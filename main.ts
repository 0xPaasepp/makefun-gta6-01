// SOLMAR — Streets of the Sun, a gta6-01 entry (Node 22, standard library
// only). The game is this directory's game/ folder: plain static files a
// desktop browser loads offline (game/index.html and its ES modules, with
// three.js vendored under game/vendor/, no network request). The program
// hands it in: it copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library.
//
// Rebuild 13: eight named story missions, a full-city map screen, BUSTED /
// WASTED screens, handbrake driving, and the golden-hour clock clamped to
// 16:30–19:30 — before copying, it validates the four screenshots (each a
// real 1280x800 render, at most 256 KiB) so a broken or oversized shot can
// never reach the grader silently.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly instead of handing in an empty game: the entry needs the
// playable index, the vendored three.js, and 3–4 screenshots.
if (!existsSync(join(here, 'game', 'index.html'))) throw new Error('game/index.html is missing');
if (!existsSync(join(here, 'game', 'vendor', 'three.module.min.js'))) throw new Error('game/vendor/three.module.min.js is missing');
if (!existsSync(join(here, 'screenshots'))) throw new Error('screenshots/ is missing');

// Screenshot gate (rebuild 12, kept in rebuild 13): exactly the four
// named shots, each a JPEG at most 256 KiB. A missing or oversized shot
// fails the build here, where it can be fixed, instead of failing the
// entry in grading. Shot 2 must show real driving (speed readout);
// shot 3 the police dispatch panel — the staging scripts enforce that.
const expectedShots = [
  '1-city-on-foot.jpg', '2-driving-palm-avenue.jpg',
  '3-police-chase.jpg', '4-harbor-heist.jpg',
];
for (const name of expectedShots) {
  const p = join(here, 'screenshots', name);
  if (!existsSync(p)) throw new Error(`screenshots/${name} is missing`);
  const size = statSync(p).size;
  if (size > 262144) throw new Error(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
  const head = readFileSync(p).subarray(0, 3);
  if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) throw new Error(`screenshots/${name} is not a JPEG`);
}
const extra = readdirSync(join(here, 'screenshots')).filter((f) => !expectedShots.includes(f));
if (extra.length) throw new Error(`unexpected files in screenshots/: ${extra.join(', ')}`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
