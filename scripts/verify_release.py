#!/usr/bin/env python3
"""Validate the release tooling: the workflow, the installer source, the scripts.

None of this needs a Mac, a Windows box or an Apple account — it is a static
check that the release pipeline is wired together and that the files it
depends on exist and are well formed.  A mistake here only shows up as a red
CI run hours later, so it is worth catching now.

Run it directly, or through scripts/verify.sh.
"""

from __future__ import annotations

import os
import re
import sys
import xml.dom.minidom

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FAILURES: list[str] = []
CHECKS = 0


def check(label: str, condition: bool, detail: str = "") -> None:
    global CHECKS
    CHECKS += 1
    if condition:
        print(f"  ok   {label}")
    else:
        print(f"  FAIL {label}" + (f" — {detail}" if detail else ""))
        FAILURES.append(label)


def read(*parts: str) -> str:
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as handle:
        return handle.read()


def exists(*parts: str) -> bool:
    return os.path.exists(os.path.join(ROOT, *parts))


# ---------------------------------------------------------------------------
# The release workflow
# ---------------------------------------------------------------------------
def check_release_workflow() -> None:
    path = ".github/workflows/release.yml"
    if not exists(path):
        check("the release workflow exists", False, f"{path} is missing")
        return
    text = read(path)

    check("the release workflow exists", True)
    check(
        "it runs on every push to main",
        bool(re.search(r"on:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]", text)),
        "no push-to-main trigger",
    )
    check("it can write releases", "contents: write" in text)
    check("it cuts a GitHub Release", "gh release create" in text)
    check("it attaches the built artifacts", "artifacts/*" in text)

    for job in ("android:", "windows:", "macos:", "release:"):
        check(f"it has a '{job.rstrip(':')}' job", f"\n  {job}" in text)
    check("the release job waits for the three builds",
          "needs: [android, windows, macos]" in text)

    # The artefacts the README promises have to be the ones the workflow makes.
    check("it builds a Windows .msi", "build-msi.ps1" in text)
    check("it builds a macOS .dmg", "build-dmg.sh" in text)
    check("it builds an Android .apk", "assembleDebug" in text)

    # Notarisation.
    check("it can import a Developer ID certificate",
          "MACOS_CERTIFICATE" in text and "set-key-partition-list" in text)
    check("it stores the notarisation credentials",
          "notarytool store-credentials" in text)


# ---------------------------------------------------------------------------
# The macOS disk image
# ---------------------------------------------------------------------------
def check_macos_dmg() -> None:
    path = "shells/macos/build-dmg.sh"
    if not exists(path):
        check("the disk image script exists", False, f"{path} is missing")
        return
    text = read(path)

    check("the disk image script exists", True)
    # The six steps that stop Gatekeeper from deleting the app.
    check("it signs with the hardened runtime", "--options runtime" in text)
    check("it adds a secure timestamp", "--timestamp" in text)
    check("it applies the entitlements", "--entitlements" in text)
    check("it notarises", "notarytool submit" in text)
    check("it staples the ticket", "stapler staple" in text)
    check("it signs the disk image itself",
          text.count("codesign") >= 2, "the .dmg is not signed")
    check("it verifies with Gatekeeper", "spctl --assess" in text)

    # The order matters: the version has to be stamped before the signature,
    # because the Info.plist is part of the signed bundle.
    stamp = text.find("CFBundleShortVersionString")
    sign = text.find('log "Signing the app"')
    check("the version is stamped before the signature",
          stamp != -1 and sign != -1 and stamp < sign,
          "the Info.plist is edited after codesign, which breaks the signature")

    # The app has to be notarised AND stapled before the disk image is made.
    notarise = text.find("notarize_one")
    dmg = text.find('log "Building the disk image"')
    check("the app is notarised before the disk image is built",
          notarise != -1 and dmg != -1 and notarise < dmg)


# ---------------------------------------------------------------------------
# The Windows installer
# ---------------------------------------------------------------------------
def check_windows_msi() -> None:
    path = "shells/windows/msi/Zode.wxs"
    if not exists(path):
        check("the installer source exists", False, f"{path} is missing")
        return

    try:
        document = xml.dom.minidom.parse(os.path.join(ROOT, path))
        check("the installer source is well-formed XML", True)
    except Exception as error:  # noqa: BLE001
        check("the installer source is well-formed XML", False, str(error))
        return

    text = read(path)
    check("it uses the WiX v5 schema",
          "http://wixtoolset.org/schemas/v4/wxs" in text)
    check("it harvests the publish directory", "<Files Include=" in text)
    check("it installs per user", 'Scope="perUser"' in text)
    check("it creates a Start menu shortcut", "<Shortcut " in text)
    check("it has an upgrade code", "UpgradeCode=" in text)
    # A hard-coded path would break the build on every other machine.
    check("it has no hard-coded drive paths",
          not re.search(r"[A-Z]:\\\\", text),
          "an absolute path is baked into the installer source")

    script = "shells/windows/build-msi.ps1"
    if not exists(script):
        check("the installer build script exists", False, f"{script} is missing")
        return
    text = read(script)
    check("the installer build script exists", True)
    check("it invokes the wix tool", "wix build" in text)
    check("it passes the payload directory", "ZodeAppDir=" in text)
    check("it produces a portable zip too", "Compress-Archive" in text)


# ---------------------------------------------------------------------------
# The repository the releases point at
# ---------------------------------------------------------------------------
def check_version() -> None:
    path = "VERSION"
    if not exists(path):
        check("the VERSION file exists", False, f"{path} is missing")
        return
    version = read(path).strip()
    check("the VERSION file exists", True)
    check("the version looks like a version",
          bool(re.fullmatch(r"\d+\.\d+\.\d+", version)),
          f"VERSION contains {version!r}")


def main() -> int:
    print("  release tooling")
    check_release_workflow()
    check_macos_dmg()
    check_windows_msi()
    check_version()

    print(f"\n  {CHECKS - len(FAILURES)}/{CHECKS} release checks passed")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
