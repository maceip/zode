#!/usr/bin/env node
/**
 * Zode web app — self check.
 *
 * Boots the real app inside a minimal DOM stub and asserts the contract:
 *
 *   • every member of `window.zode` (contract §2) exists, with the right shape
 *   • `window.zode.version === 1` and the capability matrix is complete
 *   • every request type of contract §3 is answered
 *   • every intent name of contract §4 has a handler
 *   • the drag strip drags, fills on a double click, and debounces
 *   • the §6 web fallback works on its own (picker, notifications, search,
 *     fullscreen)
 *   • the agent fires the right haptic programs
 *   • no file imports a bare specifier (the shells bundle the folder verbatim)
 *   • every `.js` file parses
 *
 * Exits non-zero when anything fails.
 *
 *   node selfcheck.mjs
 */

import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installDomStub, createEvent } from './tools/dom-stub.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const SHARED = join(REPO, 'packages/shared');

/** @type {{name: string, ok: boolean, error: string|null}[]} */
const results = [];
let failures = 0;

/**
 * @param {string} name
 * @param {() => any} fn
 * @returns {Promise<void>}
 */
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true, error: null });
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    const message = String(/** @type {any} */ (error)?.stack ?? error);
    results.push({ name, ok: false, error: message });
    console.log(`  FAIL ${name}`);
    console.log(`       ${message.split('\n').slice(0, 4).join('\n       ')}`);
  }
}

/**
 * @param {any} condition
 * @param {string} message
 * @returns {void}
 */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise((resolve_) => setTimeout(resolve_, ms));

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listFiles(dir) {
  /** @type {string[]} */
  const found = [];
  /** @type {string[]} */
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else found.push(full);
    }
  }
  return found.sort();
}

// ---------------------------------------------------------------------------
// Boot the app in the DOM stub
// ---------------------------------------------------------------------------

const stub = installDomStub();

const root = stub.document.createElement('div');
root.setAttribute('id', 'zode-root');
stub.document.body.appendChild(root);

await import('./src/main.js');

const zode = /** @type {any} */ (globalThis).window.zode;
const app = /** @type {any} */ (globalThis).window.zodeApp;

console.log('Zode web app — self check\n');

// ---------------------------------------------------------------------------
// 1. The contract §2 surface
// ---------------------------------------------------------------------------

const API_METHODS = [
  'haptic',
  'hapticStop',
  'attach',
  'onAttachment',
  'notify',
  'onNotificationAction',
  'performIntent',
  'onIntent',
  'journal',
  'search',
  'onSearch',
  'onDeepLink',
  'openPath',
];

const WINDOW_METHODS = ['dragStart', 'toggleFillScreen', 'setFullScreen', 'isFullScreen'];

const CAPABILITY_KEYS = [
  'haptics',
  'attachments',
  'notifications',
  'intents',
  'journal',
  'search',
  'windowControl',
];

await test('window.zode is installed', () => {
  assert(zode, 'window.zode is missing');
  assert(typeof zode === 'object', 'window.zode is not an object');
});

await test('window.zode exposes every §2 method', () => {
  for (const name of API_METHODS) {
    assert(typeof zode[name] === 'function', `window.zode.${name} is missing`);
  }
  assert(zode.window, 'window.zode.window is missing');
  for (const name of WINDOW_METHODS) {
    assert(typeof zode.window[name] === 'function', `window.zode.window.${name} is missing`);
  }
});

await test('window.zode.version === 1', () => {
  assert(zode.version === 1, `expected version 1, got ${String(zode.version)}`);
});

await test('window.zode.platform is a known platform', () => {
  assert(
    ['macos', 'windows', 'web'].includes(zode.platform),
    `unexpected platform ${String(zode.platform)}`,
  );
  assert(zode.platform === 'web', 'the self check runs without a native shell, expected "web"');
});

await test('window.zode.capabilities reports every flag', () => {
  assert(zode.capabilities, 'capabilities are missing');
  for (const key of CAPABILITY_KEYS) {
    assert(typeof zode.capabilities[key] === 'boolean', `capabilities.${key} is not a boolean`);
  }
  assert(
    zode.capabilities.haptics === false,
    'the WebAudio fallback is not a real haptic engine, capabilities.haptics must be false',
  );
});

await test('on* returns an idempotent unsubscribe', () => {
  const calls = [];
  const off = zode.onSearch((value) => calls.push(value));
  assert(typeof off === 'function', 'onSearch must return an unsubscribe function');
  off();
  off();
  assert(calls.length === 0, 'no event should have been delivered');
});

await test('an event without a listener is dropped, never buffered', () => {
  const before = [];
  const off = zode.onAttachment((a) => before.push(a));
  off();
  /** @type {any} */ (globalThis).window.__zodeNative__({
    type: 'event',
    event: 'attachment',
    payload: { id: 'x', name: 'x.txt' },
  });
  assert(before.length === 0, 'a dropped event must not be buffered');
});

// ---------------------------------------------------------------------------
// 2. Request types (contract §3)
// ---------------------------------------------------------------------------

const { REQUEST_TYPES, INTENT_NAMES, VIEW_NAMES } = await import('./src/bridge/contract.js');

await test('every §3 request type is answered by the bridge', async () => {
  /** @type {Record<string, Record<string, unknown>>} */
  const payloads = {
    'haptic.play': { program: 'tick' },
    'haptic.stop': { program: 'tick' },
    'attach.pick': {},
    'notify.post': { title: 'Zode', body: 'self check' },
    'intent.perform': { intent: 'zode.show', payload: { view: 'library' } },
    'journal.write': { title: 'self check', body: 'journal' },
    'search.query': { query: 'harbour' },
    'window.dragStart': { screenX: 4, screenY: 8 },
    'window.toggleFill': {},
    'window.setFullScreen': { fullScreen: false },
    'window.isFullScreen': {},
    'app.openPath': { path: '/tmp/nowhere' },
    'app.info': {},
  };

  for (const type of REQUEST_TYPES) {
    assert(payloads[type] !== undefined, `no payload prepared for "${type}"`);
    let result = null;
    let code = null;
    try {
      result = await app.bridge.request(type, payloads[type]);
    } catch (error) {
      code = /** @type {any} */ (error)?.code ?? null;
    }
    if (type === 'app.openPath') {
      // A browser cannot open a local path — the contract wants a loud,
      // typed failure instead of a hang (contract §12).
      assert(code === 'unsupported', `"${type}" should fail with "unsupported", got ${String(code)}`);
    } else {
      assert(code === null, `"${type}" failed with "${String(code)}": ${String(code)}`);
      assert(result !== null && typeof result === 'object', `"${type}" must resolve an object`);
    }
  }
});

await test('the web fallback answers every §3 request type', async () => {
  const { createWebFallback } = await import('./src/bridge/web-fallback.js');
  const fallback = createWebFallback({ doc: stub.document, win: globalThis.window });
  for (const type of REQUEST_TYPES) {
    assert(fallback.supportsRequest(type), `the fallback does not handle "${type}"`);
  }
  assert(fallback.supportsRequest('nope.nope') === false, 'unknown types must not be supported');
});

await test('an unknown request type is a loud error', async () => {
  const { createEnvelope } = await import('./src/bridge/transport.js');
  let threw = false;
  try {
    createEnvelope('nope.nope', {});
  } catch {
    threw = true;
  }
  assert(threw, 'creating an envelope with an unknown type must throw');
});

// ---------------------------------------------------------------------------
// 3. Intents (contract §4)
// ---------------------------------------------------------------------------

await test('every §4 intent name has a handler', async () => {
  for (const intent of INTENT_NAMES) {
    const result = await zode.performIntent(intent, payloadFor(intent));
    assert(result, `performIntent("${intent}") returned nothing`);
    assert(result.ok === true, `performIntent("${intent}") failed: ${result.message}`);
  }
});

/**
 * @param {string} intent
 * @returns {Record<string, unknown>}
 */
function payloadFor(intent) {
  switch (intent) {
    case 'zode.search':
      return { query: 'harbour' };
    case 'zode.play':
      return { id: 'trk-001', kind: 'track' };
    case 'zode.agent.newTask':
      return { prompt: 'summarise the harbour tracks' };
    case 'zode.attach':
      return {
        attachments: [
          { id: 'att-1', name: 'notes.txt', path: '', mimeType: 'text/plain', size: 12, source: 'drop' },
        ],
      };
    case 'zode.show':
      return { view: 'library' };
    default:
      return {};
  }
}

await test('zode.show navigates between the five views', () => {
  for (const view of VIEW_NAMES) {
    app.router.navigate(view);
    assert(app.router.current.view === view, `failed to navigate to ${view}`);
  }
});

await test('a deep link is parsed and followed', () => {
  const route = app.router.handleDeepLink('zode://view/collection');
  assert(route.view === 'collection', `deep link routed to ${route.view}`);
  const link = app.router.handleDeepLink('zode://search?q=harbour');
  assert(link.view === 'search', `deep link routed to ${link.view}`);
  assert(link.query === 'harbour', `deep link query was ${String(link.query)}`);
});

// ---------------------------------------------------------------------------
// 4. The drag strip (contract §5)
// ---------------------------------------------------------------------------

const dragZone = app.dragZone.el;

await test('the drag strip is marked and fixed height', () => {
  assert(
    dragZone.getAttribute('data-zode-drag-zone') === 'true',
    'the strip must carry data-zode-drag-zone="true"',
  );
  assert(
    String(dragZone.style.height ?? '').includes('34px'),
    `the strip height must come from --drag-zone-height (34px), got ${String(dragZone.style.height)}`,
  );
});

await test('pointerdown on the strip starts a window drag', () => {
  const calls = [];
  const original = zode.window.dragStart;
  zode.window.dragStart = (x, y) => calls.push([x, y]);
  const event = createEvent('pointerdown', { screenX: 120, screenY: 44 });
  dragZone.dispatchEvent(event);
  zode.window.dragStart = original;
  assert(calls.length === 1, `dragStart was called ${calls.length} times`);
  assert(calls[0][0] === 120 && calls[0][1] === 44, `dragStart got ${String(calls[0])}`);
  assert(event.defaultPrevented, 'pointerdown must call preventDefault() so the page never selects text');
});

await test('a control inside the strip is not swallowed', () => {
  const calls = [];
  const original = zode.window.dragStart;
  zode.window.dragStart = (x, y) => calls.push([x, y]);
  const control = dragZone.querySelector('[data-zode-drag-ignore]');
  assert(control, 'the strip should contain at least one control');
  const event = createEvent('pointerdown', { screenX: 10, screenY: 10 });
  control.dispatchEvent(event);
  zode.window.dragStart = original;
  assert(calls.length === 0, 'a control inside the strip must not start a window drag');
});

await test('dblclick on the strip fills the screen, debounced by 300 ms', async () => {
  const calls = [];
  const original = zode.window.toggleFillScreen;
  zode.window.toggleFillScreen = () => {
    calls.push(Date.now());
    return Promise.resolve(true);
  };
  dragZone.dispatchEvent(createEvent('dblclick', {}));
  dragZone.dispatchEvent(createEvent('dblclick', {}));
  dragZone.dispatchEvent(createEvent('dblclick', {}));
  assert(calls.length === 1, `one double click fired toggleFillScreen ${calls.length} times`);
  await wait(340);
  dragZone.dispatchEvent(createEvent('dblclick', {}));
  assert(calls.length === 2, 'after the debounce window a new double click must fire again');
  zode.window.toggleFillScreen = original;
});

// ---------------------------------------------------------------------------
// 5. The §6 web fallback
// ---------------------------------------------------------------------------

await test('attach() opens the file picker and returns attachments', async () => {
  const attachments = await zode.attach();
  assert(Array.isArray(attachments), 'attach() must resolve an array');
  assert(attachments.length === 1, `expected one attachment, got ${attachments.length}`);
  const attachment = attachments[0];
  assert(typeof attachment.id === 'string', 'the attachment needs an id');
  assert(typeof attachment.name === 'string', 'the attachment needs a name');
  assert(attachment.path === '', 'the browser attachment has no path');
  assert(attachment.mimeType.length > 0, 'the attachment needs a mime type');
  assert(typeof attachment.size === 'number', 'the attachment needs a size');
  assert(attachment.source === 'picker', `expected source "picker", got ${attachment.source}`);
});

await test('notify() falls back to the Notification API', async () => {
  const posted = [];
  class FakeNotification {
    /** @param {string} title @param {any} [options] */
    constructor(title, options) {
      this.title = title;
      this.options = options;
      posted.push(this);
    }
  }
  FakeNotification.permission = 'granted';
  globalThis.window.Notification = FakeNotification;
  await zode.notify({ title: 'Zode', body: 'hello' });
  assert(posted.length === 1, `expected one notification, got ${posted.length}`);
  assert(posted[0].title === 'Zode', 'the notification title was lost');
  delete globalThis.window.Notification;
});

await test('search() filters the in-memory library', async () => {
  const results = await zode.search('harbour');
  assert(Array.isArray(results), 'search() must resolve an array');
  assert(results.length > 0, 'searching for "harbour" must find something');
  for (const result of results) {
    assert(typeof result.id === 'string', 'a search result needs an id');
    assert(typeof result.title === 'string', 'a search result needs a title');
    assert(
      ['track', 'album', 'artist', 'playlist', 'task', 'file', 'action'].includes(result.kind),
      `unexpected result kind ${String(result.kind)}`,
    );
  }
});

await test('toggleFillScreen() uses the Fullscreen API', async () => {
  // Start from a known state: an earlier check already toggled the API.
  stub.document.fullscreenElement = null;
  const first = await zode.window.toggleFillScreen();
  assert(first === true, 'the first toggle should fill the screen');
  assert(stub.document.fullscreenElement !== null, 'the Fullscreen API was not used');
  const second = await zode.window.toggleFillScreen();
  assert(second === false, 'the second toggle should leave the fullscreen state');
});

await test('journal() resolves (the browser has no system journal)', async () => {
  await zode.journal({ title: 'self check', body: 'journal entry' });
});

await test('openPath() is unsupported in a browser', async () => {
  let code = null;
  try {
    await zode.openPath('/tmp/whatever');
  } catch (error) {
    code = /** @type {any} */ (error)?.code ?? null;
  }
  assert(code === 'unsupported', `expected the "unsupported" error code, got ${String(code)}`);
});

// ---------------------------------------------------------------------------
// 6. The app itself
// ---------------------------------------------------------------------------

await test('the app renders the five views, the rail and the drag strip', () => {
  assert(app, 'the app was not created');
  assert(app.rail.el, 'the rail is missing');
  assert(app.dragZone.el, 'the drag strip is missing');
  assert(app.views.list.length === 5, `expected five views, got ${app.views.list.length}`);
  for (const view of VIEW_NAMES) {
    assert(app.views.get(view), `the "${view}" view is missing`);
  }
  const active = app.views.list.filter((view) => view.el.getAttribute('data-active') === 'true');
  assert(active.length === 1, `exactly one view must be active, got ${active.length}`);
});

await test('the rail switches the view', () => {
  const tile = app.rail.el.querySelector('[data-view="library"]');
  assert(tile, 'the rail has no library tile');
  tile.dispatchEvent(createEvent('click', {}));
  assert(app.router.current.view === 'library', 'the rail did not switch the view');
});

await test('every view renders real content', async () => {
  const { TRACKS, ALBUMS, ARTISTS, PLAYLISTS } = await import('./src/data/library.js');

  const nowPlaying = app.views.get('now-playing').el;
  assert(nowPlaying.querySelector('.np-title').textContent.length > 0, 'the Now Playing title is empty');
  assert(nowPlaying.querySelector('.np-artist').textContent.length > 0, 'the artist line is empty');
  assert(nowPlaying.querySelector('.np-scrubber'), 'the scrubber is missing');
  assert(nowPlaying.querySelectorAll('.np-button').length === 3, 'the transport row needs three buttons');

  const collection = app.views.get('collection').el;
  const tiles = collection.querySelectorAll('.collection-tile').length;
  assert(
    tiles === ALBUMS.length + 8 + PLAYLISTS.length + ARTISTS.length,
    `the collection should hold ${ALBUMS.length + 8 + PLAYLISTS.length + ARTISTS.length} tiles, got ${tiles}`,
  );

  const library = app.views.get('library').el;
  assert(
    library.querySelectorAll('.library-row').length === TRACKS.length,
    `the library should list ${TRACKS.length} rows`,
  );
  assert(library.querySelector('.library-index').textContent === '01', 'the index numbers are wrong');

  const search = app.views.get('search').el;
  assert(search.querySelector('input'), 'the search field is missing');

  const agent = app.views.get('agent').el;
  assert(agent.querySelector('textarea'), 'the composer is missing');
  assert(agent.querySelector('.agent-live'), 'the live region is missing');
  assert(agent.querySelector('.agent-stop'), 'the stop button is missing');

  assert(
    String(dragZone.textContent).includes('ZODE'),
    'the drag strip must carry the Zode wordmark',
  );
});

await test('the library is deterministic and big enough', async () => {
  const { TRACKS, ALBUMS, ARTISTS, PLAYLISTS, artistAlbums } = await import('./src/data/library.js');
  assert(TRACKS.length >= 40, `expected 40+ tracks, got ${TRACKS.length}`);
  assert(ALBUMS.length >= 8, `expected 8+ albums, got ${ALBUMS.length}`);
  assert(ARTISTS.length >= 5, `expected 5+ artists, got ${ARTISTS.length}`);
  assert(PLAYLISTS.length >= 3, `expected 3+ playlists, got ${PLAYLISTS.length}`);

  // No artist may appear twice (an artist with two albums is one artist).
  const names = ARTISTS.map((artist) => artist.name);
  assert(new Set(names).size === names.length, `duplicate artists: ${names.join(', ')}`);
  for (const artist of ARTISTS) {
    assert(
      artistAlbums(artist.id).length === artist.albumIds.length,
      `the albums of "${artist.name}" do not match the catalogue`,
    );
  }

  // Import the library in a *fresh* process and compare: the seed must
  // produce the very same library everywhere.
  const script = `import(${JSON.stringify(new URL('./src/data/library.js', import.meta.url).href)}).then((m) => {
    console.log(m.TRACKS.map((t) => t.id + ':' + t.duration).join(','));
  });`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
  });
  assert(child.status === 0, `the child process failed: ${child.stderr}`);
  const expected = TRACKS.map((track) => `${track.id}:${track.duration}`).join(',');
  assert(
    child.stdout.trim() === expected,
    'the library is not deterministic across processes',
  );
});

// ---------------------------------------------------------------------------
// 7. The agent and its haptics
// ---------------------------------------------------------------------------

await test('a running task fires the looping "working" program', async () => {
  const haptics = [];
  const stops = [];
  const originalHaptic = zode.haptic;
  const originalStop = zode.hapticStop;
  zode.haptic = (program, opts) => {
    haptics.push([program, opts]);
    return Promise.resolve();
  };
  zode.hapticStop = (program) => {
    stops.push(program);
    return Promise.resolve();
  };

  const task = app.agent.start('list the harbour tracks', []);
  assert(task.state === 'running', 'the task did not start');
  assert(haptics.length === 1, `expected one haptic, got ${haptics.length}`);
  assert(haptics[0][0] === 'working', `expected the "working" program, got ${String(haptics[0][0])}`);
  assert(haptics[0][1]?.loop === true, 'the "working" program must loop');

  await wait(2600);
  assert(stops.includes('working'), '"working" was never stopped');
  assert(
    haptics.some(([program]) => program === 'done'),
    'the "done" program never fired',
  );
  assert(task.state === 'done', `the task state is "${task.state}"`);

  zode.haptic = originalHaptic;
  zode.hapticStop = originalStop;
});

await test('a failing task fires the "error" program', async () => {
  const haptics = [];
  const stops = [];
  const originalHaptic = zode.haptic;
  const originalStop = zode.hapticStop;
  zode.haptic = (program) => {
    haptics.push(program);
    return Promise.resolve();
  };
  zode.hapticStop = (program) => {
    stops.push(program);
    return Promise.resolve();
  };

  const task = app.agent.start('please fail this', []);
  await wait(1300);
  assert(task.state === 'error', `the task state is "${task.state}"`);
  assert(stops.includes('working'), '"working" was never stopped');
  assert(haptics.includes('error'), 'the "error" program never fired');

  zode.haptic = originalHaptic;
  zode.hapticStop = originalStop;
});

await test('an attachment fires "attach" (and "drop" for a drop)', () => {
  const haptics = [];
  const originalHaptic = zode.haptic;
  zode.haptic = (program) => {
    haptics.push(program);
    return Promise.resolve();
  };
  app.agent.start('collect the files', []);
  app.views.get('agent').handleAttachment({
    id: 'att-9',
    name: 'tracklist.txt',
    path: '',
    mimeType: 'text/plain',
    size: 4,
    source: 'drop',
  });
  zode.haptic = originalHaptic;
  assert(haptics.includes('attach'), 'the "attach" program never fired');
  assert(haptics.includes('drop'), 'the "drop" program never fired');
  app.agent.stop();
});

await test('a native attachment event reaches the agent', () => {
  const received = [];
  const off = zode.onAttachment((attachment) => received.push(attachment));
  globalThis.window.__zodeNative__({
    type: 'event',
    event: 'attachment',
    payload: { id: 'att-7', name: 'setlist.m3u', path: '/tmp/setlist.m3u', mimeType: 'audio/x-mpeg', size: 9, source: 'dock' },
  });
  off();
  assert(received.length === 1, `the event was not delivered (${received.length})`);
  assert(received[0].source === 'dock', 'the attachment source was lost');
});

// ---------------------------------------------------------------------------
// 8. Static checks
// ---------------------------------------------------------------------------

const allFiles = await listFiles(HERE);
const jsFiles = allFiles.filter((file) => file.endsWith('.js') || file.endsWith('.mjs'));

await test('every JavaScript file parses', () => {
  for (const file of jsFiles) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert(
      result.status === 0,
      `${relative(HERE, file)} does not parse:\n${result.stderr || result.stdout}`,
    );
  }
});

await test('no file imports a bare specifier', async () => {
  const importPattern = /(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*['"]([^'"]+)['"]/g;
  const dynamicPattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const file of jsFiles) {
    const source = await readFile(file, 'utf8');
    for (const pattern of [importPattern, dynamicPattern]) {
      pattern.lastIndex = 0;
      let match = pattern.exec(source);
      while (match) {
        const specifier = match[1];
        const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
        const isNodeBuiltin = specifier.startsWith('node:');
        assert(
          isRelative || isNodeBuiltin,
          `${relative(HERE, file)} imports the bare specifier "${specifier}"`,
        );
        match = pattern.exec(source);
      }
    }
  }
});

await test('the bundled copies of the shared files are byte identical', async () => {
  for (const name of ['tokens.css', 'haptics.json']) {
    const copy = await readFile(join(HERE, 'assets', name));
    const original = await readFile(join(SHARED, name));
    assert(
      copy.equals(original),
      `assets/${name} differs from packages/shared/${name} — re-run tools/sync-shared.mjs`,
    );
  }
});

await test('the web app matches the frozen contract', async () => {
  // A fingerprint, not a timestamp.  A fresh `git checkout` gives every file
  // the same modification time, so comparing mtimes is a coin flip in CI —
  // and it was failing there for exactly that reason.
  const contract = await readFile(join(SHARED, 'contract.md'));
  const fingerprint = createHash('sha256').update(contract).digest('hex');
  const recorded = (await readFile(join(HERE, 'assets', 'contract.sha256'), 'utf8').catch(() => '')).trim();
  assert(
    recorded === fingerprint,
    'packages/shared/contract.md changed without the web app being updated — ' +
      'run `node tools/sync-shared.mjs`',
  );
});

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

app.agent.stop();
app.player.destroy();

console.log('');
console.log(`${results.length - failures}/${results.length} checks passed`);
if (failures > 0) {
  console.log('');
  for (const result of results.filter((entry) => !entry.ok)) {
    console.log(`FAILED: ${result.name}`);
    console.log(result.error);
    console.log('');
  }
}

stub.restore();
process.exit(failures === 0 ? 0 : 1);
