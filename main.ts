// main.ts — the entrypoint: hands the game in.
// Copies game/ and screenshots/ from this repository into the output directory
// (MAKEFUN_OUTPUT_DIR, or /output) and writes /output/dossier.json with
// buildDossier from vendor/makefun-game.ts. Pure Node standard library only.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Start from a clean output directory so two runs write identical bytes.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Copy the playable game and its screenshots, preserving the tree exactly.
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// The dossier is byte for byte what the kit's library writes from those files.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// A short human-readable summary on stdout (the grader ignores it).
console.log(`solmar: wrote ${outDir}/game, ${outDir}/screenshots and ${outDir}/dossier.json (${dossier.length} bytes)`);
