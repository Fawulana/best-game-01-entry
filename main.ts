// LUMENBREAK — a best-game-01 entry (Node 22, standard library only). The game is this
// directory's game/ folder: plain static files a desktop browser loads offline (game/index.html
// and its ES modules, no library and no network request). This program hands it in: it checks
// the entry is complete, copies game/ and screenshots/ from beside this file to /output, and
// writes /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// The game itself is a neon breakout: a paddle shatters crystal bricks across six hand-built
// walls, catching falling powerups (wide paddle, multi-ball, laser, slow ball, extra life),
// building a combo multiplier, and winning by clearing the last wall. It has a title screen
// with a live demo behind it, a HUD with score, best, level, lives and combo, a pause screen,
// level-clear banners, a game-over screen and a victory screen, all with a restart.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json). Only text_max_bytes shapes the dossier's bytes;
// the rest refuse an entry the scorer would refuse, so this program fails the same way here
// instead of handing in something invalid: at most 4 screenshots of at most 256 KiB each, at
// most 993 files or directories under game/ totalling at most 48 MiB, and no path under game/
// longer than 1000 bytes. game/ counts beside /output's own 1000-entry cap, its screenshots/
// and dossier.json.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  throw new Error(`lumenbreak: ${message}`);
}

/** Refuse early, with a plain reason, when the entry is not complete. */
function checkEntry() {
  if (!existsSync(join(here, 'game', 'index.html'))) fail('game/index.html is missing');
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) fail('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
    fail(`screenshots/ holds ${shots.length} images, need 3 or 4`);
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > CAPS.screenshots.max_bytes) fail(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
  }
}

checkEntry();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));

// Say what was handed in, so a run that silently wrote nothing is noticed at once.
const dossierBytes = statSync(join(out, 'dossier.json')).size;
const gameEntries = readdirSync(join(out, 'game')).length;
console.log(`lumenbreak: wrote ${out} (game/ ${gameEntries} top-level entries, dossier.json ${dossierBytes} bytes)`);
