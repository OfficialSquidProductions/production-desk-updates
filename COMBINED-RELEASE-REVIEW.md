# Combined release prepared locally

Candidate: **Production Desk 1.5.12, Mac build 34**. Windows uses version 1.5.12 and its eventual workflow run number. This branch combines Lined Script controls and identity fixes, Shot List keyboard/scroll fixes, Schedule drag usability, full portable-project import and preview-storage safeguards. The published original-PDF/Main Breakdown commit `3552b21b29f7605bf92dbb12f19452d7ca507548` remains an ancestor.

GitHub read-only inspection: `main` is `fda5fc347dc406b4fec0c9d90ff304de660b2e52`; latest releases are `macos-1.5.11-build-33` and `windows-1.5.11-build-36`, both targeting `3552b21`. Local Mac and Windows manifests and lockfile match 1.5.12. Release notes cover all combined changes. Public download links and hosted appcast files remain unchanged.

**Distribution approved:** the user explicitly approved public GitHub artifacts and desktop-feed activation after the earlier denied handoff did not execute. The existing Windows workflow publishes automatically for a newer version pushed to `main`. The prepared source will now be published to `main` and its exact-commit Windows gates verified before the combined release is reported complete. Only the established Production Desk desktop channels are authorized; App Store/TestFlight remains unchanged.

Use [Start Packaged Combined Release Preview.command](Start%20Packaged%20Combined%20Release%20Preview.command) for disposable local QA. It verifies disabled updates and dedicated storage paths before launch. Installed Production Desk and real user data must remain unchanged.

Final test evidence is recorded after local checks under ignored `windows-src/build/combined-release-review/`. App Store/TestFlight changes and installed-app replacement remain out of scope. Windows packaged execution requires an available Windows environment; signed/notarized public distribution is a separate pending gate.

## Verified candidate

Tested commit: `6185691ab1dc9224badb6f195b15b8b1fdb81df2` on `release/1.5.12-local-review`. App: `windows-src/dist/Production Desk Combined Release Preview.app` (1.5.12, build 34), unique preview identity `local.productiondesk.combined-preview.6185691`; feed removed and updater checks disabled. Ad-hoc signature verified. All 247 bundled runtime source files match the checkout; the native executable and generated PDF helper hashes are recorded.

- Full Python aggregate: 89 passed, 1 Windows-only PDF dependency test skipped (90 total).
- Node helper aggregate: 20 passed. The Windows workflow now includes the Schedule helper tests.
- Browser aggregates: 64 source and 64 packaged-runtime checks, zero page errors. These include all completed editing changes, complete Save As/import round trips, asset bytes and references, undo/redo, malformed/older/large files, delayed cancellation, save failures and reopening.
- Native Mac WebKit: 56 named aggregate checks plus native save/import/reload checks passed against the actual AppKit-launched preview's bundled server.
- Real native updater save gate passed. All 8 local Sparkle scenarios passed: equal, older, newer (twice), incompatible, offline, malformed and opt-out. The fixture always chooses Later and forbids download/install. Dedicated storage was checked before launch. A macOS `/var` path alias false positive was corrected to compare canonical paths; the initial preflight stopped before launching the fixture.
- Read-only Windows version gate confirms 1.5.12 is newer than latest 1.5.11. Read-only live Mac appcast inspection confirms build 33 remains current, below proposed 34. GitHub `main` remains `fda5fc3` after testing.
- The preview's direct-launch and disposable-home paths were checked before launch. Installed app and every existing stable/beta workspace, PDF, setting, diagnostic log and backup retained identical hashes/mtimes. No installed app replacement, App Store/TestFlight action, public artifact, remote push or feed change occurred.

Evidence: ignored `windows-src/build/combined-release-review/summary.json`, `artifact.json`, `actual-app-result.json`, storage preflight reports, live-feed/version-gate reports and full test/build logs.

Not run: Windows packaged/installed QA (no Wine/VM/runtime locally), the pinned NSIS updater suite (dependencies absent), the one Windows PDF test, and public signed-archive/notarization checks (no public archive prepared). Public distribution is now explicitly approved. A newer-version push to `main` activates the existing Windows workflow; its packaged/installed gates must pass on the exact source commit. Mac publication additionally requires Developer ID signing, notarization/stapling and verified public downloads/updater offer.

## Public release verification in progress

Final source is `7d9472b9494cd1385eff0c8fd210dd3396ff92d8`. Exact-commit Windows CI run [39724379126](https://github.com/OfficialSquidProductions/production-desk-updates/actions/runs/39724379126) passed: 93 backend tests, 20 helper tests, 14 real NSIS updater tests and 83 native smoke checks each on packaged, installed and reinstalled copies. Windows 1.5.12 build 39 is public; the downloaded EXE, checksums, blockmap and update metadata match the successful CI artifact. The Windows release channel remains the latest GitHub release.

CI caught and resolved a path-separator assumption in the preview test and missing optional screenplay-font handling on clean Windows installations. The corrected fallback passes the complete browser suite with all optional fonts unavailable; the prior implementation fails that same scenario. The final source retains all original-PDF/Main Breakdown fixes.

Mac 1.5.12 (34) app and sealed installer use the existing Developer ID identity, are Apple-notarized and stapled, and pass strict code-sign, Gatekeeper and distribution checks. All 247 runtime source files match final source. The final notarized app passed 56 native aggregate checks plus native save/import/reload checks. Installer scratch tests passed fresh install/update, project preservation, unrelated/symlink destination and invalid-payload rejection. No user installation was replaced; all 1,231 protected installed-app and real project/log/backup files remain unchanged.

The verified Mac archive, installer, notes, checksums and appcast are staged in this publication commit. Fresh public-download and prior-version updater-offer checks follow deployment; do not interpret staging as completion of those checks. App Store/TestFlight submissions remain unchanged.
