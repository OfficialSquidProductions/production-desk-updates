# Production Desk 1.5.16 preparation

This release retains CSV/complete portable export commit `760f907d81a118c831bbacea6186ab95560d5649` and Mac build 45 updater recovery. Shipping apps no longer include the demo launcher, guide, screenplay, portable sample or Scenic handoff. Fresh desktop storage creates one empty production. No migration removes user projects, legacy sample markers or imported copies. Historical fixtures and controller coverage live in `windows-src/tests/fixtures/demo/`, outside shipping resources; `tests/demo_data.py` holds the test-only script.

## Version and review state

The user selected 1.5.16 after Windows downgrade rejection was demonstrated for requested 1.0.0. Mac standalone build 46; iOS/iPad candidate build 40. Windows build identity is the exact-commit Actions run number. Do not force updater downgrades. App Store iOS 1.5.14 (39) and Mac 1.5.14 (37) were Waiting for Review at inspection. Their UI requires removing the pending version from review before submitting a replacement build. No review withdrawal, metadata change or replacement submission is authorized yet; archives may be prepared.

## Local verification

- 99 Python tests passed, one Windows PDF dependency skip.
- 35 shared JavaScript tests, 14 pinned Windows updater tests and 47 iOS web tests passed.
- iPhone/iPad app, unit-test and UI-test targets compiled with Xcode (no Simulator launched).
- Mac package compiled; all 236 web resources and five backend modules match source; demo directory, test fixture directory and sample project files absent.
- Isolated background native WebKit aggregate passed real controls, CSV parsing and complete portable restore into a fresh recipient after sender removal, with 12 CSV breakdown rows and two original PDF revisions. Also covers shot navigation/order/deletion, large imports, schedule drag/cancel/undo, original-PDF annotations and gutter export.
- Native Mac updater save, initialization failure/retry, delayed/rejected readiness, navigation interruption/repeated callback, cancellation, overlapping-check prevention and App Store updater behavior passed. QA apps used unique identifiers, disposable Foundation homes/preferences and nonpersistent WebKit. Installed apps and real projects were unused.
- Exact-source Windows branch validation #51 and main release workflow #52 passed the packaged app, installed copy and reinstall checks. Source: `151f38d330e3131576d3eda47e0bf52ba914cea2`. The Windows harness saves/reopens between independent heavy scenarios after Chromium reported WSAENOBUFS in a combined run; all assertions remain, and per-stage/network diagnostics are retained.
- Mac app and one-click installer passed Developer ID signature, notarization/stapling, Gatekeeper and distribution checks. The shipping installer passed fresh install/update/data preservation and invalid-payload tests in disposable storage; signed build 45 → 46 upgrade preserved synthetic project/settings/PDF bytes. Native Mac shipping sources have not changed since the package build; subsequent changes affect only Windows QA helpers.
- Mac release: https://github.com/OfficialSquidProductions/production-desk-updates/releases/tag/macos-1.5.16-build-46
- Windows release: https://github.com/OfficialSquidProductions/production-desk-updates/releases/tag/windows-1.5.16-build-52
- Exact-source main CI: https://github.com/OfficialSquidProductions/production-desk-updates/actions/runs/40115935619
- iOS Simulator runtime/Files UI has not been rerun in this task; test targets compile, fixtures are external to the shipping app. Signed iPhone/iPad 1.5.16 (40) IPA and universal Mac App Store 1.5.16 (46) PKG are prepared locally, not uploaded. Existing review submissions remain unchanged.

## Proposed historical-download cleanup — NOT executed

Read-only inventory before 1.5.16: 12 GitHub releases, 60 release assets, 26 tags and 59 download-site root ZIP/checksum/HTML/XML files. The latter comprise 57 versioned app/installer/checksum/notes files plus `appcast.xml` and `index.html`; CNAME and .nojekyll remain service configuration. Existing latest platform releases are `windows-1.5.15-build-44` and `macos-1.5.15-build-45`. The full inventory with IDs, URLs and hashes is retained locally in `windows-src/build/demo-removal/public-inventory.json`.

After both new platform releases and existing-client update paths pass, propose archiving all bytes, checksum manifests and release metadata before separately confirming retirement of the 12 existing release records/60 assets and the 57 prior versioned root files. Retain the newest 1.5.16 Mac and Windows platform releases, live updater index/feed paths, source code, MIT license and git history. Recommend retaining all 26 historical tags for reproducibility; tag removal would need its own enumerated confirmation. Never rewrite history.

Deleting old assets would break direct release/download URLs, cached old-feed enclosure links and rollback links. GitHub release deletion has no reliable UI restore; archived bytes allow reconstruction, not restoration of original IDs. Root-file removal through a normal git commit is reversible but still breaks links while absent. A grace period is recommended. Keeping one newest version across two platform release records preserves the existing Windows latest-release convention and Mac signed feed. No deletion should precede separate action-time confirmation.
