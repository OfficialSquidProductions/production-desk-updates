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

Evidence is under ignored `windows-src/build/shot-order-review/`. Final packaged checks and exact implementation commit will be recorded after the build. Windows/Electron installer runtime, touch and iOS execution are outside this Mac verification. No publication or new release is authorized or performed.

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
