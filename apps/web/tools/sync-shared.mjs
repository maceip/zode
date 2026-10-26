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

import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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

// The contract is a specification, not a file the app ships, so it is not
// copied.  Instead the app records its fingerprint, and the self check
// fails when the contract changes without the app being updated.
//
// A fingerprint, not a timestamp: a fresh `git checkout` gives every file
// the same modification time, so comparing mtimes is a coin flip in CI.
const CONTRACT = join(SHARED, 'contract.md');
const CONTRACT_FINGERPRINT = join(APP, 'assets', 'contract.sha256');
const contractHash = createHash('sha256').update(await readFile(CONTRACT)).digest('hex');

if (checkOnly) {
  const recorded = (await readFile(CONTRACT_FINGERPRINT, 'utf8').catch(() => '')).trim();
  if (recorded !== contractHash) {
    console.error('drift: packages/shared/contract.md changed without the web app being updated');
    drifted = true;
  } else {
    console.log('ok:    the web app matches packages/shared/contract.md');
  }
} else {
  await writeFile(CONTRACT_FINGERPRINT, `${contractHash}\n`);
  console.log(`wrote: apps/web/assets/contract.sha256 (${contractHash.slice(0, 16)}…)`);
}

process.exit(drifted ? 1 : 0);
