#!/usr/bin/env node
/**
 * Copy the frozen shared files into `apps/web/assets/`.
 *
 * The native shells bundle `apps/web` verbatim, so the app cannot reach
 * `packages/shared/` at runtime — it ships byte identical copies instead.
 * The self check verifies that the copies still match.
 *
 *   node tools/sync-shared.mjs          → copy
 *   node tools/sync-shared.mjs --check  → verify only (exit 1 on drift)
 */

import { copyFile, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const SHARED = resolve(APP, '../../packages/shared');

const FILES = ['tokens.css', 'haptics.json'];
const checkOnly = process.argv.includes('--check');

let drifted = false;

for (const name of FILES) {
  const from = join(SHARED, name);
  const to = join(APP, 'assets', name);
  if (checkOnly) {
    const original = await readFile(from);
    const copy = await readFile(to).catch(() => null);
    if (!copy || !copy.equals(original)) {
      console.error(`drift: assets/${name} differs from packages/shared/${name}`);
      drifted = true;
    } else {
      console.log(`ok:    assets/${name} matches packages/shared/${name}`);
    }
    continue;
  }
  await copyFile(from, to);
  console.log(`copied: packages/shared/${name} → apps/web/assets/${name}`);
}

process.exit(drifted ? 1 : 0);
