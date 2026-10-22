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
