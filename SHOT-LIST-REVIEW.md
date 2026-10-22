# Shot List selection and keyboard navigation

This local change builds on `32d24c8` and the completed Lined Script implementation
`866c68b`. It retains the published 1.5.11 original-PDF/Main Breakdown fixes.
No installed app, user workspace, public release, update feed or signing identity is replaced.

## Behavior

- Clicking/selecting a different shot updates the details panel and selected styling
  while retaining the existing list and row nodes. List position, page scroll and
  the details panel's scroll position stay in place. Selecting the same shot is a no-op.
- Unmodified Up/Down selects the previous/next shot in the currently displayed order.
  Focus follows the row without scrolling the page. Only the list pane scrolls, by
  the amount needed to reveal an offscreen row. Holding the key repeats navigation.
  First and last rows do not wrap; a list with no matches does not consume arrows.
- Arrows remain available to text fields, textareas, numeric steppers, datalists,
  dropdowns, searches, editable content, other buttons and focused controls. Navigation
  pauses in dialogs, during dragging and IME composition, and for modified arrows.
- Search filters repair a hidden selection and refresh its details consistently.
  Navigation follows filtered rows and the changed shooting order after reordering.
  Reordering preserves list and details scroll offsets.
- The new configurable Lined Script bindings stay scoped to that tab. A Lined Script
  action assigned ArrowDown does not replace Shot List navigation.
- Selection/navigation does not modify project data, create undo entries or change
  shooting order. Edits and reordered shots still save normally. Reopening starts the
  normal view; this change does not introduce persistent per-device selection/scroll state.

## Verification

All fixtures are synthetic and all app data is disposable.

- Browser source aggregate: 51 checks passed, zero page errors. Includes 600 variable-height
  shots, 20 repeated clicks, held arrows, focused controls, scene/status/search filtering,
  first/last/single/empty lists, reordering and configured shortcut interactions. Real
  mouse clicks and 24 consecutive keyboard moves retain deep context. Real textarea
  arrows and numeric steppers keep editing; edits/order survive reload.
- Native source WebKit aggregate: 45 named checks passed, plus native save/import/reload checks.
- Python suite: 81 total, 80 passed, 1 Windows `pypdf` dependency skip.
- Existing Lined Script, workspace layout, original-PDF and Main Breakdown regressions pass.
- The optional `--baseline-shots 32d24c8` browser run checks the previous Shot List module
  against these assertions. Its expected failure is recorded alongside the passing results.

Packaged verification and the exact tested implementation commit are recorded below
once the separate preview is built. Windows runtime/installer testing is unavailable
on this Mac; no VM, Wine or current Electron runtime is installed. No release is authorized.

## Review and repeat

Run **Start Packaged Shot List Preview.command** to launch the separate preview with a
fresh isolated review home under ignored `windows-src/build/`. Its location is printed
in Terminal and retained after quitting. Import copies for review. The earlier Lined
Script preview and launcher are preserved.

From `windows-src`:

```sh
python3 -B -m unittest discover -s tests -v
python3 -B tools/check_macos_desktop.py --source
node tools/check_lined_browser.cjs --all
python3 -B tools/check_macos_desktop.py --app 'dist/Production Desk Shot List Preview.app'
```

Playwright and Chromium are needed for the optional browser checks. Existing local
installations can be supplied using `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE`.
`PRODUCTION_DESK_RUNTIME` and `PYTHON` select a packaged server/web/Python runtime.
Evidence is under ignored `windows-src/build/shot-navigation-review/`.
