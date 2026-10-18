# Mac TestFlight packaging

`tools/build_macos_store.py` builds a separate universal native AppKit/WKWebView
archive for macOS 12 or later. The original Developer ID build and its Sparkle
updater remain available through `tools/build_macos.py` and `desktop/Updates.swift`.

The Mac platform was added to existing App Store Connect app `6823682933`.
Its inspected bundle ID is `com.hosier.scheduler.ipad`; the public direct
download continues to use `local.slate.filmscheduler`.

From `windows-src`, use an existing Apple Development SHA-1 for local checking:

```sh
python3 tools/build_macos_store.py --output /absolute/new/output \
  --bundle-id com.hosier.scheduler.ipad \
  --identity EXISTING_DEVELOPMENT_SHA1 --local-development
```

For distribution, omit `--local-development` and supply the existing Apple
Distribution SHA-1, an existing Mac App Store provisioning profile using that
certificate, and `--installer-identity EXISTING_MAC_INSTALLER_SHA1`.
The tool validates the profile's Mac platform, team, bundle ID, beta entitlement,
and signing certificate. It emits manual export/upload options with
`testFlightInternalTestingOnly=true` and automatic version changes disabled.
It does not create credentials or profiles, upload, or change account settings.
Never use `-allowProvisioningUpdates` to work around missing signing assets.

Store builds link `StoreUpdates.swift` instead of Sparkle. The copied Python
framework and required nested interpreter use the app's identity. Executable
children have only sandbox/inherit entitlements; the parent allows loopback
server/client, user-selected files, and printing. `store_server.py` initializes
Python's built-in MIME map, avoiding inaccessible system Apache configuration.
The backend, editor, portable project formats, PDFs, and data models are unchanged.
Direct downloads keep their original launcher and updater behavior.

For the noninteractive sandbox check, pipe only the synthetic test PDF into:

```sh
"/path/to/Production Desk.app/Contents/MacOS/ProductionDesk" \
  --store-runtime-check < tests/lined-script.pdf
```

This checks the inherited Python/PDFKit subprocesses, local HTTP server/client,
packaged editor, and workspace save/reload in temporary sandbox storage. It
opens no GUI and never launches the disabled Production Desk Update QA helper.
Do not launch that helper or request its permissions.

The Store app uses container storage. Import a portable `.productiondesk` copy
to test an existing direct-download production; it does not read or migrate
the direct-download app's private data. The development archive is local
validation only. Distribution signing, Apple's processing, and the existing
owner group's Testing state must all be verified before claiming a Mac release.
Native file dialogs, printing/sharing, and TestFlight installation remain owner
acceptance checks.
