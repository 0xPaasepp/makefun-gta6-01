// SOLMAR entrypoint: copies game/ + screenshots/ into the output directory
// and writes /output/dossier.json from the vendored make.fun library.
// Node standard library only; runs as `node main.ts` (erasable TypeScript).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
const check = JSON.parse(readFileSync(join(outDir, 'dossier.json'), 'utf8'));
console.log(`SOLMAR: wrote ${outDir} (dossier ${dossier.length} bytes, keys: ${Object.keys(check).join(', ')})`);
