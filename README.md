<div align="center">

<img src="icons/zode-256.png" alt="Zode" width="128" height="128" />

# zode

**Code content before chrome — native shells, a Metro web app, and mobile clients.**

One product, five surfaces, one contract.

</div>

---

## Download

Every push to `main` cuts a release with real binaries. These links always point at the newest
one:

| Platform | File | What it is |
|---|---|---|
| **macOS** | [zode-macos-universal.dmg](https://github.com/maceip/zode/releases/latest/download/zode-macos-0.1.0-universal.dmg) | The native macOS shell in a disk image |
| **Windows** | [zode-windows-x64.msi](https://github.com/maceip/zode/releases/latest/download/zode-windows-0.1.0-x64.msi) | Per-user installer, no admin rights |
| **Windows** | [zode-windows-x64.zip](https://github.com/maceip/zode/releases/latest/download/zode-windows-0.1.0-x64.zip) | The portable build |
| **Windows** | [zode-windows-x64.exe](https://github.com/maceip/zode/releases/latest/download/zode-windows-0.1.0-x64.exe) | Needs the `web/` folder beside it |
| **Android** | [zode-android-debug.apk](https://github.com/maceip/zode/releases/latest/download/zode-android-0.1.0-debug.apk) | Debug build — install with "unknown sources" |
| **iOS** | — | Builds from source; see [mobile/ios](mobile/ios/README.md) |

[All releases →](https://github.com/maceip/zode/releases)

> The macOS disk image is currently **signed ad-hoc, not notarised**, so a *downloaded* copy gets
> macOS's "downloaded from the internet" warning and may be moved to the Trash. A copy you build
> yourself on the same Mac is never quarantined and opens with no prompt. See
> [docs/RELEASING.md](docs/RELEASING.md).

---

## What this is

Zode is a music-and-agent app with the visual language of the original Zune (2006–2011) and
Microsoft's Metro design language: flat square tiles, a near-black or warm-paper canvas,
Segoe-style light display type, uppercase tracked labels, and fast "reveal" motion.

It is also an **experimental departure from the three-column app that rules today**. Where the
dominant music services stack a navigation column, a list column and a detail column and ask you
to scroll between them, Zode is one full-window canvas — a poster wall of albums and a single
focused pane that takes over the whole surface when you need it. The chrome is the app, the
window has no title bar, and the content owns every pixel. It is a sketch of what a music app
could be if it were built for the screen instead of for the scroll.

The desktop apps are **native shells** that render the web app in the **system webview** —
`WKWebView` on macOS, **Edge WebView2** on Windows — with **no native window controls at all**.
The window chrome is the app's own cards and typography. The single concession is a **34 px drag
strip across the top** so the window can be moved, and a **double-click on that strip fills the
screen with this app window**.

<p align="center">
  <img src="icons/social-preview.png" alt="Zode" width="820" />
</p>

<p align="center">
  <em>Now Playing &nbsp;·&nbsp; Collection &nbsp;·&nbsp; Agent</em>
</p>

<p align="center">
  <img src="docs/screenshots/web-now-playing.png" width="49%" alt="Now Playing" />
  <img src="docs/screenshots/web-collection.png" width="49%" alt="Collection" />
</p>

## How to use

**Thirty seconds, in a browser.** No build step, no dependencies:

```bash
node apps/web/serve.mjs      # then open http://localhost:5173
```

The browser build is the same app the native shells host, so everything below works there too —
minus the native window behaviour and the platform integrations.

**The desktop app.** Every push to `main` cuts a release with installers attached — see
[Releases](../../releases) for `zode-macos-<version>-universal.dmg`, `zode-windows-<version>-x64.msi`
and `zode-android-<version>-debug.apk`. Install and launch; there is no account, no sign-in, and
no network requirement.

**Moving the window.** The **34 px strip across the top** is the only part of the window that
moves it. Drag it to move the window; **double-click it to fill the screen** with the app (the
whole display, menu bar included). Everything below the strip is content, and clicks there go to
the app.

**Dropping files.** Drag a file anywhere onto the window and it arrives in the app as an
attachment. On macOS, dropping a file on the **dock icon** does the same thing. The Agent view
picks attachments up and can act on them.

**The agent.** Open the **Agent** view from the rail (or the ✦ button in the strip), describe a
task, and press ⌘↵ / Ctrl↵ to send it. While the agent works, the app gives a tiny slow haptic
wave; when a task finishes you get the triple roll.

**Keyboard.**

| Key | What it does |
|---|---|
| `⌘F` / `Ctrl+F` | Jump to search |
| `Space` | Play / pause |
| `←` `→` | Previous / next track |
| `↵` | Open the selected item |
| `⌘↵` / `Ctrl↵` | Send the agent task |

**The canvas.** The half-filled disc in the strip switches between the near-black **ink** canvas
and the warm **paper** canvas. The choice is remembered, and the iOS and Android clients offer
the same pair.

## How it's made

**One contract, five surfaces.** `packages/shared/contract.md` is the frozen contract. The web
app never talks to a platform transport; it only calls `window.zode`. Each shell installs a thin
adapter that maps that API onto its own transport, so a feature added to the contract shows up on
every platform at once.

| Layer | macOS | Windows | iOS | Android | Web |
|---|---|---|---|---|---|
| Surface | `WKWebView` | Edge WebView2 | SwiftUI | Jetpack Compose | plain ESM |
| Window | Borderless `NSWindow` | Raw Win32 | — | — | — |
| Haptics | CoreHaptics | `waveOut` synth | CoreHaptics | `VibrationEffect` | WebAudio |
| Platform glue | App Intents, Media Intents, Journaling, CoreSpotlight | App Actions, App Content Search, toasts | App Intents | Search intents, notifications | — |
| Language | Swift | C# / .NET 10 | Swift | Kotlin | JavaScript |

**The web app has no dependencies and no build step.** Plain ES modules, served as-is. That is not
a purity exercise: it means both native shells can bundle `apps/web/` verbatim and cannot drift
from it, and there is no bundler to break.

**Haptics are data.** `packages/shared/haptics.json` holds waveform *programs* — event lists with
intensity and sharpness curves. Each platform renders the same program with the best engine it
has, so "done" (a triple roll) and "working" (a tiny slow wave) mean the same thing everywhere.
Where a platform has no haptic hardware the app says so in `capabilities.haptics` rather than
pretending.

**One library, everywhere.** `scripts/dump_library.mjs` imports the web app and writes
`packages/shared/library.json`; the iOS and Android clients decode that same file. The library
cannot drift between platforms because there is only one copy of it.

**Icons are generated.** `icons/make_icons.py` produces the `.icns`, the `.ico`, the Android
densities, the favicon and the social preview from a single source PNG, and CI fails if
regenerating them changes the tree.

**Releases are automatic.** `.github/workflows/release.yml` runs on every push to `main` and
publishes a GitHub Release with a macOS `.dmg`, a Windows `.msi` and `.zip`, and an Android
`.apk`.

> **The macOS image is signed but not yet notarised.** Notarisation is Apple's service and needs
> a paid Apple Developer account plus five repository secrets; the release workflow does the
> whole pipeline the moment they are there. Until then a *downloaded* `.dmg` gets the
> "downloaded from the internet" warning, because macOS quarantines every download and an
> ad-hoc signature is not a signature Gatekeeper trusts. A copy you **build yourself** on the
> same Mac is not quarantined and opens with no prompt at all. The setup is in
> [docs/RELEASING.md](docs/RELEASING.md), and `./scripts/check-notarization.sh` tells you
> exactly where you stand.



## Why it is shaped like this

Every platform speaks the **same frozen contract** (`packages/shared/contract.md`). The web app
never touches a platform transport directly; it only calls `window.zode`. Each shell installs a
thin adapter that maps that API onto its own transport.

```
                    ┌──────────────────────────────┐
                    │   apps/web  (zero-dep ESM)    │
                    │   window.zode  —  contract v1 │
                    └───────────────┬──────────────┘
                                    │  message envelope
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
     ┌────────▼────────┐  ┌─────────▼─────────┐  ┌────────▼────────┐
     │  macOS shell    │  │  Windows shell    │  │  mobile clients │
     │  WKWebView      │  │  WebView2         │  │  SwiftUI/Compose│
     │  CoreHaptics    │  │  Win32 + waveOut  │  │  CoreHaptics /  │
     │  App Intents    │  │  App Actions      │  │  VibrationEffect│
     └─────────────────┘  └───────────────────┘  └─────────────────┘
```

**Haptics are defined once.** `packages/shared/haptics.json` holds waveform *programs* —
event lists with intensity and sharpness curves. Each platform renders that same program with
the best engine it has, so the triple-roll "done" and the tiny slow "working" wave feel
identical everywhere.

## Repository layout

```
zode/
├── packages/shared/          ← the single source of truth (frozen)
│   ├── contract.md           native bridge contract v1
│   ├── haptics.json          haptic waveform programs
│   ├── library.json          the canonical library — every platform presents these records
│   └── tokens.css            design tokens (colour, type, metrics)
├── apps/web/                 ← the Zune/Metro web app the shells host
│                              zero dependencies, no build step, plain ES modules
├── shells/macos/             ← SwiftUI + WKWebView native shell
├── shells/windows/           ← Win32 + WebView2 native shell
├── mobile/ios/               ← SwiftUI Metro client
├── mobile/android/           ← Jetpack Compose Metro client
├── icons/                    ← every native icon variant, generated by make_icons.py
├── docs/                     ← platform notes + rendered screenshots
└── scripts/                  ← publish, verify, icon generation, screenshot capture
```

### One library, every platform

The web app owns the records. `scripts/dump_library.mjs` imports it directly and publishes
`packages/shared/library.json` — 9 artists, 10 albums, 50 tracks, 3 playlists, with ids,
durations, track numbers and accent colours. Both mobile clients read that file from their
bundle; neither invents its own catalogue.

```bash
python3 scripts/export_library.py           # publish
python3 scripts/export_library.py --check   # verify every copy agrees
```


## The window rules

Both desktop shells obey the same five rules, defined in contract §5:

1. **No native window controls.** No traffic lights, no minimise, no maximise, no close, no
   title bar. The app's own content owns the entire window.
2. **The web content owns every pixel** of the client area — the shell paints no background,
   border, or shadow over it.
3. **The top 34 px is a drag zone.** `pointerdown` there starts a *real* OS window drag
   (`NSWindow.performDrag` on macOS, `WM_NCLBUTTONDOWN`/`HTCAPTION` on Windows).
4. **Double-clicking the drag zone fills the screen with this app window** — the *entire
   display bounds*, not the work area, and deliberately **not** OS fullscreen (the menu bar and
   Spaces stay put).
5. **Nothing below the strip moves the window.**

The strip also carries the app's own controls (search, canvas, new task) — they are excluded
from the drag, exactly as the contract requires.


## Platform capability matrix

Honest about what each platform can actually do:

| Capability | macOS 27 | Windows 11 | iOS | Android | Web |
|---|:--:|:--:|:--:|:--:|:--:|
| System webview | `WKWebView` | WebView2 | `WKWebView` | WebView | browser |
| Rich haptics | ⚠️ audio fallback¹ | ⚠️ audio fallback² | ✅ Taptic Engine | ✅ vibrator | ⚠️ WebAudio |
| Drop file anywhere on window | ✅ | ✅ | — | — | ✅ picker |
| Drop on app icon | ✅ Dock | ✅ taskbar | — | — | — |
| System search | ✅ Spotlight | ⚠️ MSIX only³ | ✅ Spotlight | ✅ AppSearch | in-app |
| System intents | ✅ App Intents + Media Intents | ✅ App Actions (MSIX) | ✅ App Intents | ✅ intents | in-app |
| Notifications | ✅ | ✅ (needs AUMID) | ✅ | ✅ | ⚠️ browser |
| System journal | ✅ Journaling Suggestions | ❌ none⁴ | ✅ | ❌ none⁴ | ❌ none⁴ |
| Signing | Developer ID / Apple ID | none required⁵ | Apple ID | upload key | — |

¹ Macs have **no Taptic Engine**. `CoreHaptics` exists on macOS 10.15+, but
`CHHapticEngine.capabilitiesForHardware().supportsHaptics` is false on most hardware, so Zode
synthesises the same waveform as audio and reports `capabilities.haptics = false`.

² Windows desktops have **no rich haptic API** — only `IVibrationDevice`, a coarse pulse. Zode
synthesises the waveform through `waveOut` so the *shape* survives, and additionally fires a
coarse vibration when the hardware supports one.

³ App Actions and App Content Search require **package identity**, so those paths need the
MSIX build. The unpackaged build still works; the manifest and `appactions.json` are shipped in
`shells/windows/msix/`.

⁴ Windows and Android have no system journal equivalent. `journal.write` resolves successfully
and lands in a local activity log (`%LOCALAPPDATA%\Zode\journal.jsonl`) instead.

⁵ The brief specifies **no Windows signing key**, so the default build is unpackaged and needs
none. Only the optional MSIX path wants a certificate.

## Building

### The web app (no build step)

```bash
cd apps/web
node serve.mjs            # http://127.0.0.1:5173
node selfcheck.mjs        # contract conformance self-test
```

No `npm install` — the app is plain ES modules with zero runtime dependencies, which is what
lets both shells bundle the folder verbatim.

### macOS shell

```bash
cd shells/macos
./sign.sh                 # list your codesigning identities
export ZODE_TEAM_ID=YOUR_TEAM_ID
./build.sh                # archive + export a signed .app
```

`build.sh` runs `xcodebuild archive` with `CODE_SIGN_STYLE=Automatic`,
`DEVELOPMENT_TEAM="$ZODE_TEAM_ID"` and `-allowProvisioningUpdates`, so your developer profile
is used automatically. The Xcode project is **generated**, not hand-written:

```bash
python3 tools/generate_xcodeproj.py     # deterministic; re-runs produce identical output
python3 tools/validate_pbxproj.py       # structural validation
```

For live development against the web app, set `ZODE_DEV_URL=http://127.0.0.1:5173` and the shell
loads your dev server instead of the bundled assets.

### Windows shell

```powershell
cd shells/windows
.\build.ps1               # unpackaged, no certificate required
.\build-msix.ps1          # optional: package identity for App Actions
```

The shell serves the web app from a virtual host (`https://app.zode.local/`) rather than
`file://`, so the origin is stable and the bridge is not subject to file-origin restrictions.

### Mobile

```bash
cd mobile/ios      # open ZodeMobile.xcodeproj in Xcode
cd mobile/android  # open in Android Studio, or ./gradlew :app:assembleDebug
```

> The Android `gradle-wrapper.jar` **is** committed, so `./gradlew` works straight out of
> a clone. Regenerate it with `gradle wrapper --gradle-version 8.11.1` if you need to.
> `local.properties` is gitignored — it points at your SDK.

## Icons

Every native icon variant is generated from the single source artwork in `icons/zode.png`:

```bash
python3 icons/make_icons.py
```

That produces `zode.icns` (macOS, squircle-masked with Apple's ~10% padding), `zode.ico`
(Windows, 16–256 px), the iOS 1024 px master, the Android adaptive foreground/background plus
all five mipmap densities, a favicon, and the 1280×640 GitHub social preview.

## Publishing

```bash
export GH_TOKEN=ghp_xxxxxxxx   # scope: repo
./scripts/publish-github.sh
```

Creates the public `zode` repository, pushes `main`, and points `origin` at it.

After that, **every push to `main` cuts a release automatically** — the
[Release workflow](.github/workflows/release.yml) builds the macOS `.dmg`, the Windows `.msi` and
`.zip`, and the Android `.apk`, and attaches them to a new GitHub Release. The macOS image is
signed, and it is **notarised and stapled** too as soon as the five Apple secrets are in place —
until then it is signed ad-hoc, and the release notes say so in plain words.

The one-time Apple setup that notarisation needs is in
**[docs/RELEASING.md](docs/RELEASING.md)**. If a notarisation ever fails, it does not take the
release down: the image is still built, still signed, and still attached — it is just labelled as
not notarised.

## Status

**Verified by actually building it:**

- The **Android client compiles and assembles** — `./gradlew :app:assembleDebug` produces a
  real APK (JDK 17 + Android SDK 36 + Gradle 8.11.1).
- The **web app boots and renders** — every view was captured in headless Chromium
  (`scripts/shoot-web.mjs`), the drag strip measures exactly 34 px, and `node selfcheck.mjs`
  passes 35/35 checks including the haptic wiring.
- The **Windows shell** passes 57/57 static checks plus a cross-check against the web app's
  own constants (request types, event names, error codes, attachment sources, intent names).
- The **macOS shell** passes a structural audit of the generated Xcode project and a
  cross-check of the contract's request types, intent names and error codes.
- **Every Swift source parses** — all 48 files in the macOS shell and the iOS client go through
  `swiftc -parse` (`scripts/check_swift.sh`). This is a syntax check, not a type check, but it
  is what caught an unterminated `#if canImport(CoreHaptics)` block that would have failed the
  macOS compile outright.
- **Every Swift file is in the Xcode project's Sources phase** — a file that exists but is not
  compiled is a "cannot find type in scope" error waiting to happen
  (`tools/check_project_sources.py`).
- Every generated Xcode project is **byte-deterministic** — re-running the generator produces
  an identical file.
- `Info.plist` / `Zode.entitlements` parse as plists; the MSIX manifest and `appactions.json`
  are valid XML/JSON and cover every intent.
- Icons regenerate byte-identically. No credential material is committed.

**Verified in CI, on real runners** — [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on
genuine macOS, Windows and Android machines and does what a Linux authoring box cannot:

- `xcodebuild` **compiles** the macOS shell.
- `dotnet build` **compiles** the Windows shell.
- `xcodebuild` **compiles** the iOS client for the simulator.
- `./gradlew :app:assembleDebug` **assembles** the Android APK.
- The icons regenerate **byte-identically**, and the web app's own self-check passes.

**The Windows shell also compiles on Linux.** The project sets `EnableWindowsTargeting`, so the
.NET SDK restores the Windows SDK projections and the WebView2 references and compiles the same
sources the Windows runner does. `scripts/check_windows_build.sh` runs it, so a Win32 compile
error is caught in seconds rather than waiting for CI.

**Still needs a human with the hardware:**

- Runtime window behaviour — that the drag strip really moves the window with the right feel,
  that double-click really fills the display, that nothing below the strip moves the window.
- Whether the triple-roll "done" and the tiny slow "working" wave actually *sound* like a
  triple roll and a slow wave. The waveforms are correct as data; only ears can confirm them.
- Dock / taskbar drop end to end.
- Signing and **notarisation** with a real Developer ID. The release workflow signs ad-hoc until
  the Apple secrets are added — see [docs/RELEASING.md](docs/RELEASING.md).
- Siri, Spotlight, App Actions and the Journal integration end to end.

Each platform's `deliverable.md` separates *verified* from *not verified*. Read
[`docs/PLATFORM-NOTES.md`](docs/PLATFORM-NOTES.md) for the per-platform detail and
[`packages/shared/contract.md`](packages/shared/contract.md) for the full bridge specification.

## Verifying it yourself

```bash
./scripts/verify.sh        # every check that does not need a Mac / Windows box
```

It runs 17 checks and skips 4 that genuinely need hardware (the macOS, Windows and Android
compiles, and the iOS compile). Two of the checks want a toolchain and **skip quietly** when it
is not installed, so the script works on a bare machine:

```bash
./scripts/check_swift.sh        # needs a Swift compiler   (swiftc -parse)
./scripts/check_csharp.sh       # needs the .NET SDK       (Roslyn parse, no Windows needed)
./scripts/check_windows_build.sh # needs the .NET SDK      (the real Windows compile)
```

Both are syntax checks, not type checks — they cannot replace `xcodebuild` and `dotnet build`,
but they catch the same class of error in seconds instead of waiting for CI.


## Licence

MIT — see [LICENSE](LICENSE).
