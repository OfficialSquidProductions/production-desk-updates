# Shot Shooting Order — local implementation and review

Development worktree: `shot-order-dev`, branch `feat/shot-shooting-order`.
Based on `7cd5b0b`, which includes published 1.5.13 source `7b929a6` and its release verification records. The existing `lined-script-dev` worktree was clean at inspection and remains unchanged. No AGENTS.md or local .agents skills were present in this checkout or its workspace ancestors. CONTRIBUTING.md, desktop run/test guidance and earlier schedule/shot/portable review notes were read.

## Behavior and storage

The sidebar has a separate **Shot Shooting Order** tab with shot strips and the shared detail inspector. It uses the existing schedule drag controller: broad upper/lower row targets, large handles, a blue insertion marker, live destination text, edge autoscroll, Escape cancellation and exact placement through a keyboard-accessible handle dialog. Up/Down selects shots; the inspector arrows move the selected shot. Moving, details editing and undo/redo preserve pane position.

`_shots` remains the single canonical record collection and Shot List order. `_shotShootingOrder` is an optional production-wide array of shot IDs. It is written on the first actual filming move. Merely opening the new tab on an older production creates no persisted order. New shots append, deleted/stale IDs disappear, and no reorder changes shot numbers, IDs, lined coverage, scene schedules or scenario arrays. Details are edited on the same records in either view. Scenario and shoot-day filters provide schedule reference; the filming arrangement itself is shared across scenarios. Filtered moves use complete-order anchors, leaving hidden shots in relative order. Estimates and export rows follow the displayed view's order.

Complete `.productiondesk` and full JSON backups preserve the optional field through existing extension serialization. No sender-local paths, localStorage or derived duplicate shots are needed. Validation checks the optional array shape and uniqueness; stale IDs from older clients are accepted and reconciled by the editor. Existing scene-based USS exports retain their existing behavior.

## Repeat checks

From `windows-src` (provide an installed Playwright module/browser through environment variables when needed):

```sh
python3 -B -m unittest discover -s tests -v
node --test tests/shot-shooting-order.cjs tests/schedule-drag.cjs tests/lined-export.cjs tests/mac-store-exports.cjs tests/platform-branding.cjs tests/support-errors.cjs
node tools/check_shot_order_browser.cjs
node tools/check_lined_browser.cjs --all
python3 -B tools/check_macos_desktop.py --source
python3 -B tools/build_macos.py --app-only --no-share --preview
python3 -B tools/check_macos_desktop.py --app 'dist/Production Desk Shot Order Preview.app'
```

The builder requires committed clean sources and stamps the exact commit. The preview has a unique bundle ID, `ProductionDeskPreview`, no update feed and disabled automatic updates. Native routing sends direct launches to `ProductionDeskPreviews/preview-local.productiondesk.shot-order-preview`, independently of stable/beta data. **Start Packaged Shot Order Preview.command** creates a fresh home and runs the Foundation-based storage preflight before starting the executable. Data, previous-save backups, preferences, PDFs, diagnostics and logs use the preview namespace. The installed application is never replaced.

Evidence is under ignored `windows-src/build/shot-order-review/`. Final packaged checks and exact implementation commit will be recorded after the build. Windows/Electron installer runtime, touch and iOS execution are outside this Mac verification. The initial implementation task did not authorize publication; the later desktop release authorization is recorded below.

The real-browser keyboard check permits the minimal scroll needed to reveal an adjacent row. The first packaged run exposed an overly strict test assertion (a valid 9-pixel reveal was rejected); the test now checks the selected row's actual visibility and bounds the scroll to one adjacent row. The implementation's navigation behavior was unchanged. An initial sandbox-only build could not convert icons; the isolated build completed with approved execution outside that restriction.

## Final packaged Mac verification

Exact tested source: `8cf1b78c82b3563068c13ee8a8ec1464de701635` (implementation `7bba85a0607d83ae997537075b124ec2f2613a14`).

Artifact: `windows-src/dist/Production Desk Shot Order Preview.app`.
Use **Start Packaged Shot Order Preview.command** for a fresh preflight-checked review home. This is an ad-hoc signed local Apple Silicon preview, not a new public release or notarized distribution.

Passed:

- 95 backend tests on source and bundled Python/packaged modules: 94 passed, one existing Windows pypdf dependency skip.
- 27 focused Node checks, including order reconciliation/validation, existing scene move planning, PDF gutter exports, platform behavior and support errors.
- Existing browser aggregate: 68 checks, zero page errors.
- New source and final packaged browser aggregate: 468 shots, broad content/handle dragging, before/after placement, edge autoscroll and feedback, Escape/tiny-motion/keyboard access, cross-scene and filtered ordering, hidden-order integrity, both-view editing/addition/deletion, scenario switching, IDs/coverage, Undo/Redo, reload and restart. Zero page errors.
- Actual Save As `.productiondesk` transfer: sender storage removed before clean-profile recipient import; every production field, filming order, shot ID, scene schedule, linked annotation and original PDF byte preserved. Recipient continued editing and survived reload/backend restart.
- Native WebKit: 63 named regression checks plus native focused-save/import/reload checks passed against the packaged runtime. The same aggregate passed through the actual compiled AppKit app's server after verifying its child command used bundled Python and the preflight-approved temporary workspace path.
- Preflight checked direct-launch and disposable-home data/log/backup/PDF routing before app launch. Native assertions passed for stable/beta/preview precedence and safe folder names. Signature verification passed deep/strict. The runtime manifest records 249 byte-identical source files and the newly compiled PDF helper.
- Actual-app testing fingerprinted all existing stable/beta data files (including logs/backups) and installed app components before and after: content hashes and modification times were unchanged. The earlier `lined-script-dev` worktree remains clean on its original branch.

Evidence in `windows-src/build/shot-order-review/`: `summary.json`, `build.log`, `signature.log`, `packaged-runtime-sha256.json`, `browser-source.json`, `browser-packaged.json`, `browser-regressions.log`, `native-packaged.log`, `actual-app-result.json`, `actual-app-webkit.log`, `direct-launch-preflight.json`, `preview-isolation-test.log`, `python-source.log`, `python-packaged.log`, `node-tests.log`, `sender.productiondesk`, `shot-shooting-order.png`, `drag-feedback.png`. The supporting actual-app harness is `check_actual_app.py` in that evidence folder.

No implementation blocker remains. Windows/Electron execution and installer verification were not performed; the optional desktop updater Node suite also requires an unavailable `electron-updater` dependency. iOS/touch execution and physical native menu interaction were not tested. No installed-app replacement, real-project edits, public publication, feed changes, release-version bump, notarization or new signing credentials were performed.


## Production Desk 1.5.14 desktop release

The user subsequently authorized public desktop publication. Exact release source: `c7b09a4050e8cd42c08d2892e9bed04dc79e6c82`, preserving every 1.5.13 fix. Mac build 36 is Developer ID signed, Apple notarized and stapled, including the sealed one-click installer. The app and installer pass deep/strict signing, ticket validation, Gatekeeper and distribution checks. The installer also passes isolated fresh-install/update/payload/project-preservation and unrelated-app/symlink/invalid-package protection tests.

[Exact-source Windows CI](https://github.com/OfficialSquidProductions/production-desk-updates/actions/runs/39872592161) passed 90 checks each on the packaged, installed and reinstalled application and published Windows build 42. The initial run failed a synthetic placement test that targeted an offscreen strip; the fixture was corrected to use a visible valid insertion point while retaining feedback/cancellation assertions. The final Mac app was rebuilt from the same corrected commit. The failed run did not publish an installer.

Final notarized Mac QA passed all 63 named native checks plus save/import/reload checks, actual application startup through its bundled server, and real-browser shot-order/keyboard/scroll/cancel checks with 468 shots. A full `.productiondesk` transfer retained all fields, IDs, filming order, schedules, linked marks and original PDF bytes after sender storage removal; recipient edits, reload and backend restart passed. All 41 local Node checks passed; the backend suite passed 94 of 95 locally with the existing Windows pypdf skip, while exact Windows CI supplied Windows dependencies.

Before app/installer/updater QA, Foundation verified disposable-home data/log/backup routing. Installed app and all persistent stable/beta data/log/backup fingerprints remained unchanged (1,233 protected files). QA did not install into Applications or open real projects. App Store and TestFlight submissions are unchanged. Windows remains unsigned; touch and physical native-menu interaction were not tested.

Release evidence is in ignored `windows-src/build/release-1.5.14/`, including signing/notarization records, exact CI reports, actual-app/native/browser/handoff reports, public artifact checksum records and prior-version updater checks. An automatic review initially paused Mac draft staging on a stale assumption that the installer was still processing. Reading the completed successful installer export, ticket/Gatekeeper/distribution/self-test record supplied new evidence; the single retry was approved. No prerequisite was bypassed.
