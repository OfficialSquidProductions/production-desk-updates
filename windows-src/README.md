# Production Desk — desktop source

Local script breakdowns, film schedules, stripboards, and shot lists for Mac and Windows.
The desktop source lives in `windows-src/` for compatibility with the existing Windows
release workflow; it is shared by both desktop platforms. Production Desk is free and
open source under the [MIT license](../LICENSE).

Download the packaged app from [productiondesk.squidproductions.org](https://productiondesk.squidproductions.org/).
The iPhone/iPad edition is in [`../ios/`](../ios/README.md).

## Run from source

With Python 3.9 or later, run these commands from this directory:

```sh
python3 server.py
```

Open `http://127.0.0.1:8765` in a browser. Work is stored locally in `data/`.
The browser app needs no npm build. Mac PDF imports use PDFKit through the included
Swift source and require Xcode command-line tools. On Windows, install `pypdf`
for PDF imports (`python -m pip install pypdf`). Scanned PDFs need a text layer.

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
```

The first command downloads the pinned Sparkle release and verifies its checksum.
The builder uses the local Xcode `Python3.framework` and produces
`dist/Production Desk.app`. It signs the local build ad hoc. Omit `--app-only`
to create the DMG and omit `--no-share` to create the share installer as well.
Signing official updater archives requires the maintainer's private signing key,
which is not included. Local app builds do not require that key.

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
