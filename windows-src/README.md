# Production Desk — desktop source

Local script breakdowns, lined PDFs, film schedules, stripboards, and shot lists for Mac and Windows.
The desktop source lives in `windows-src/` for compatibility with the existing Windows
release workflow; it is shared by both desktop platforms. Production Desk is free and
open source under the [MIT license](../LICENSE).

Download the packaged app from [productiondesk.squidproductions.org](https://productiondesk.squidproductions.org/).

## Run from source

With Python 3.9 or later, run these commands from this directory:

```sh
python3 server.py
```

Open `http://127.0.0.1:8765` in a browser. Work is stored locally in `data/`.
The browser app needs no npm build. Mac PDF imports use PDFKit through the included
Swift source and require Xcode command-line tools. On Windows, install `pypdf`
for PDF imports (`python -m pip install pypdf`). Scanned PDFs need a text layer.

See the [lined-script guide](LINED-SCRIPTS.md) for PDF annotations and exports.

## Test

```sh
python3 -m unittest discover -s tests -v
```

Windows PDF tests require `pypdf`; they skip if it is unavailable. Mac PDF tests
require the Xcode tools. Fixtures are synthetic productions.

## Build the Mac app

On an Apple Silicon Mac with macOS 12 or later and Xcode installed:

```sh
python3 tools/fetch_sparkle.py
python3 tools/build_macos.py --app-only --no-share
python3 tools/check_macos_updates.py
python3 tools/check_macos_desktop.py
```

The first command downloads the pinned Sparkle release and verifies its checksum.
The builder uses the local Xcode `Python3.framework` and produces
`dist/Production Desk.app`. It signs the local build ad hoc. Omit `--app-only`
to create the DMG and omit `--no-share` to create the share installer as well.
Signing official updater archives requires the maintainer's private signing key,
which is not included. Local app builds do not require that key.

Packaged Mac and Windows apps check for newer compatible releases after the editor
opens, unless automatic checks are disabled. The launch notice shows the changelog
and offers Install Update or Later. Installation requires the user's choice and a
successful workspace save. Open editor dialogs must first be saved or closed, so
unfinished drafts remain intact. Later postpones the notice until the next launch;
Check for Updates can reopen it. Ordinary exit never installs an update, and
offline or invalid feeds stay quiet during automatic checks. Existing Mac Sparkle
signatures and Windows HTTPS/checksum validation remain in use.

On Mac, Check for Updates can initialize the updater before the editor is ready
and retry a failed initialization. Automatic startup observes delayed editor
readiness independently of navigation completion, with bounded retry delays if
Sparkle cannot initialize. The native updater check above uses uniquely identified
QA bundles, disposable storage/preferences and loopback fixtures; it never opens
the installed app or a production workspace. See the
[startup fix verification](UPDATER-STARTUP-FIX.md) for coverage and limits.

## Build on Windows

Use Windows x64, Python 3.12, and Node 22:

```sh
python -m pip install -r desktop/windows/requirements-build.txt
python -m unittest discover -s tests -v
python tools/build_windows.py
python tools/check_windows.py
```

See [Windows details](desktop/windows/README.md). The result is the complete offline
`dist/windows/Production-Desk-Windows-Setup.exe` installer.

## Source map

- `film.py`: script parsing and USS validation.
- `server.py`: local serving, native import/export, and atomic persistence.
- `web/`: shared browser interface and original Squid Productions artwork.
- `desktop/Slate.swift`, `desktop/Updates.swift`: Mac shell and Sparkle updater.
- `desktop/Installer.swift`, `desktop/Icon.swift`: Mac installer and icon generation.
- `desktop/windows/`: Electron shell, preload bridge, and pinned dependency manifests.
- `tools/`: Mac and Windows builders, PDF extraction, and packaged-app checks.
- `tests/`: backend tests and native updater save/signature checks.

See [contribution guidelines](../CONTRIBUTING.md) and
[third-party notices](../THIRD_PARTY_NOTICES.md). Forks must configure their own
application identity, update hosting, and signing keys before distribution.


## Portable project files (local development)

This working copy adds **Save As…** for one complete `.productiondesk` project and **Import…** for cross-device transfer. All saved fields and original PDFs travel in one file. Existing JSON backups and USS remain supported. See `PORTABLE-PROJECTS.md` for the format, compatibility, tests and development-build limits.

## Offline testing sample

Load Demo beside the production selector opens the Scenic-matched Last Cue sample.
See [content, coverage, safe reset and removal](DEMO-CONTENT.md).

## Shot List navigation (local development)

Click a shot to change its details while keeping your position in the list. With the
list or one of its shot rows focused, Up/Down selects the previous/next visible shot
in shooting order, scrolling the list only as needed. Arrow keys keep their normal
behavior in editing fields, dropdowns and other focused controls. Filters and reordered
shots determine the navigation order. See [local review and verification](../SHOT-LIST-REVIEW.md).

## Shooting Schedule drag placement (local development)

Drag a strip's content or its grab handle. The top/bottom halves of each strip insert
before/after it, with a blue placement marker. Day headers/footers and holding-board
headers also accept drops. Hold near the scroll-pane edge to scroll; Escape cancels.
Click a handle for the precise Move dialog, or click strip content to open its breakdown.
See [local review and verification](../SCHEDULE-DRAG-REVIEW.md).

## Saved filming-order compatibility

The separate Shot Shooting Order tab was removed in Mac build 37. Use the regular
**Shot list** for shot editing, reordering, filtering, estimates, export and print.
Older filming-order data is retained unchanged in saved projects and portable
.productiondesk exports for compatibility; no data migration deletes it.
See [Mac release verification](../MAC-APP-STORE-REVIEW.md).
