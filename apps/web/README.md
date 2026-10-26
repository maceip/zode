# Zode — web app

The Zune-era (2006–2011) × Microsoft Metro music/agent app that the native
macOS and Windows shells host in a system webview.

* **No build step, no bundler, no dependencies.** Plain ES modules + JSDoc
  types + plain CSS. The shells bundle this folder verbatim as static assets.
* **The app never touches a platform transport.** It only talks to
  `window.zode` (the frozen contract in `packages/shared/contract.md`).
* **It works with no native bridge at all.** The §6 web fallback shim answers
  every request in a plain browser.

---

## Run it

```bash
cd apps/web
node serve.mjs                 # → http://127.0.0.1:5173/
PORT=8080 node serve.mjs       # a different port
```

The server is ~70 lines of `node:http` + `node:fs` — no express.

```bash
node selfcheck.mjs             # boots the app in a DOM stub, 35 checks
node tools/sync-shared.mjs     # re-copy packages/shared → assets/
node tools/sync-shared.mjs --check   # verify the copies are byte identical
```

`selfcheck.mjs` exits non-zero when anything fails.

---

## Layout

```
apps/web/
├── index.html                 the document the shells load
├── serve.mjs                  dev static server (node:http + node:fs only)
├── selfcheck.mjs              contract self check (node built-ins only)
├── assets/
│   ├── tokens.css             verbatim copy of packages/shared/tokens.css
│   ├── haptics.json           verbatim copy of packages/shared/haptics.json
│   └── zode-mark.svg          the [ZODE] bracket mark (favicon)
├── src/
│   ├── main.js                entry point: install the bridge, build the app
│   ├── bridge/
│   │   ├── contract.js        CONTRACT_VERSION, DRAG_ZONE_HEIGHT, the §3/§4
│   │   │                      vocabularies, BridgeError
│   │   ├── transport.js       platform detection + the §1 envelope
│   │   ├── web-audio-haptics.js  the haptic waveform synthesiser
│   │   ├── web-fallback.js    the §6 browser shim
│   │   └── zode.js            installs `window.zode` (the whole §2 surface)
│   ├── app/
│   │   ├── app.js             the shell: rail + stage + bridge wiring
│   │   ├── drag-zone.js       the top drag strip (contract §5)
│   │   ├── rail.js            the Metro left rail
│   │   ├── router.js          view routing + deep link parsing
│   │   ├── player.js          the deterministic playback clock
│   │   └── icons.js           the flat SVG icon set
│   ├── views/                 now-playing, collection, library, search, agent
│   ├── data/
│   │   ├── library.js         the seeded, deterministic library
│   │   └── agent.js           the fake agent engine
│   ├── util/dom.js            tiny DOM helpers (no innerHTML anywhere)
│   └── styles/                app.css (shell) + views.css (the five views)
└── tools/
    ├── dom-stub.mjs           the minimal DOM the self check runs against
    └── sync-shared.mjs        copies the frozen shared files into assets/
```

---

## The bridge

`src/bridge/zode.js` installs exactly the contract §2 surface — nothing more,
nothing less:

```js
window.zode.platform            // 'macos' | 'windows' | 'web'
window.zode.version             // 1
window.zode.capabilities        // { haptics, attachments, notifications,
                                //   intents, journal, search, windowControl }
window.zode.haptic(program, {loop})
window.zode.hapticStop(program)
window.zode.attach()
window.zode.onAttachment(cb)
window.zode.notify({title, body, id, urgency})
window.zode.onNotificationAction(cb)
window.zode.performIntent(intent, payload)
window.zode.onIntent(cb)
window.zode.journal({title, body, date})
window.zode.search(query)
window.zode.onSearch(cb)
window.zode.window.dragStart(screenX, screenY)
window.zode.window.toggleFillScreen()
window.zode.window.setFullScreen(fullScreen)
window.zode.window.isFullScreen()
window.zode.onDeepLink(cb)
window.zode.openPath(path)
```

`on*` returns an unsubscribe function that is safe to call twice. A native
event with no listener is dropped, never buffered (contract §2.2).

**How a call reaches a shell** (`src/bridge/transport.js`):

| platform | transport |
|---|---|
| macOS | `window.webkit.messageHandlers.zode.postMessage(env)` |
| Windows | `window.chrome.webview.postMessage(env)` |
| browser | the §6 fallback answers the request in-process |

Every request is a §1 envelope `{ id, type, payload }`; the response envelope
`{ id, ok, result }` / `{ id, ok: false, error: { code, message } }` resolves
the promise. The shell pushes events with `window.__zodeNative__({ type: 'event',
event, payload })` — the bridge installs that entry point.

An unknown request type or intent name throws immediately
(`src/bridge/contract.js`), so a drift between the app and a shell is loud
rather than silent.

---

## Haptics

`src/bridge/web-audio-haptics.js` renders the programs of
`packages/shared/haptics.json` as audio (contract §6 and §7):

* one `OscillatorNode` per track, at the track's `carrierHz`
* the intensity curve drives a `GainNode` through `setValueCurveAtTime`
  (linear interpolation between the control points, exactly as the contract
  demands)
* the sharpness curve is mapped onto a lowpass `BiquadFilterNode`
  (320 Hz → 7.5 kHz)
* `transient` tracks are short exponentially decaying envelopes
* `working` loops seamlessly — every iteration is scheduled ahead of the play
  head by a look-ahead scheduler

**The Windows shell mirrors this file** (it must: Windows desktops have no
rich haptic API), so keep it clean and well commented.

The app fires:

| moment | program |
|---|---|
| agent task starts | `working` (loops) |
| agent task finishes | `hapticStop('working')` + `done` (the triple roll) |
| agent task fails | `hapticStop('working')` + `error` |
| an attachment arrives | `attach` |
| a file is dropped | `drop` |
| a view is selected | `select` |

---

## The window chrome

`src/app/drag-zone.js` renders a fixed strip at the very top of the document
(`--drag-zone-height`, 34 px) and marks it `data-zode-drag-zone="true"`.

* `pointerdown` → `zode.window.dragStart(e.screenX, e.screenY)` +
  `preventDefault()` (the page never text-selects)
* `dblclick` → `zode.window.toggleFillScreen()`, debounced by **300 ms** so one
  double click can never fire it twice
* `user-select: none`, `cursor: default` — it is a drag strip, not a title
  bar: no traffic lights, no minimise/maximise
* controls that live inside the strip call `stopPropagation()` and carry
  `data-zode-drag-ignore`, so the strip never swallows their clicks

---

## The five views

| view | what it is |
|---|---|
| **Now Playing** | big square Metro tile of album art, Segoe-UI-Light title, artist, scrubber, transport row, elapsed/remaining |
| **Collection** | horizontal carousels of square album tiles, playlist tiles and artist tiles under uppercase tracked labels |
| **Library** | dense two-column list: index number, title + artist, duration hard right |
| **Search** | search field plus results grouped by kind — `track`, `album`, `artist`, `playlist`, `task`, `file`, `action` |
| **Agent** | task list, running-task state, composer box, `aria-live` status region — and the haptics |

A Metro left rail of large square icon tiles switches between them.

---

## Data

`src/data/library.js` builds a seeded library (mulberry32, fixed seed
`0x5a4f4445`): **10 albums, 9 artists, 3 playlists, 50 tracks**. The same
seed produces the same library in every process, so screenshots and tests are
stable. Album art is generated as a CSS gradient from a hash of the album id —
no binary assets.

`src/data/agent.js` is the fake agent: `start(prompt, attachments)`,
`stop()`, and the events `task:start`, `task:progress`, `task:done`,
`task:error` (plus `task:stopped` for a cancelled run). The timings are fixed
(2.3 s for a successful run, 0.95 s for a failure) and a prompt containing
`fail` / `error` / `break` / `unsupported` takes the failure path — handy for
testing the error haptic.

---

## Notes for the shells

* The app must be served from a stable origin (contract §1.3): `zode://app/`
  on macOS, `https://app.zode.local/` on Windows. **Never `file://`** — the
  haptic programs are loaded with `fetch`.
* `assets/tokens.css` and `assets/haptics.json` are byte identical copies of
  the frozen files in `packages/shared/`. The shells must copy the *whole*
  `apps/web` folder, including `assets/`.
* A shell may refine the capability matrix by answering `app.info` with an
  extra `capabilities` object; the bridge merges it into
  `window.zode.capabilities`.
* `window.zode.window.dragStart` is a no-op in a browser — the shells must
  perform the real window drag.

### Known gaps

* `capabilities.journal` is `false` in a browser: there is no system journal.
  `zode.journal()` still resolves and the fallback records the entry in a
  local log.
* `zode.openPath()` fails with `code: 'unsupported'` in a browser — a page
  cannot open a local path.
* `capabilities.windowControl` is `true` in a browser because fill/fullscreen
  works; the *drag* half is a no-op there.
