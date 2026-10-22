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

Packaged verification and the exact tested implementation commit are recorded below. Windows runtime/installer testing is unavailable
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

## Separate packaged Mac preview: verified

Implementation commit: `61b3c0b53c369db47b829dde50344e18d000b87f`.
The preview's native executable and Python/web runtime were built from this commit.
Later changes record results and make the browser test polling compatible with CSP;
no runtime code or security settings changed after the tested implementation commit.

Artifact: `windows-src/dist/Production Desk Shot List Preview.app`.
It is ad-hoc signed, has its own preview bundle identifier, has update startup disabled,
and has no live feed URL. The existing Lined Script preview is preserved separately.
Use **Start Packaged Shot List Preview.command** for an isolated review home.

Passed:

- Offline app build, bundled runtime startup and deep/strict code-signature verification.
- All 247 bundled runtime files matched the recorded SHA-256 manifest.
- Full packaged browser aggregate: 51 checks, zero page errors. Real mouse and keyboard
  tests cover deep shot selection, 24 consecutive arrow moves, textarea/numeric editing,
  save/reopen, and the previous Lined Script/PDF/Main Breakdown workflows.
- Native WebKit aggregate against bundled Python/server/assets: 45 named checks plus
  native save/import/reload checks.
- Actual compiled AppKit app startup used a separately proved temporary home and
  Application Support directory. Its child used the bundled Python and isolated
  workspace; the same 45-check native aggregate passed through that app's own server.
- Full packaged Python suite: 81 total, 80 passed, 1 Windows dependency skip.
- The previous `32d24c8` Shot List module failed the new regression as expected:
  **Selecting a shot rebuilt the list**. This is distinct from the passing current runs.
- Existing installed-app fingerprints and every existing Slate data-file fingerprint
  and modification time stayed unchanged. Only test-owned processes were stopped.

The browser comparison initially hit a harness-only CSP string-evaluation restriction.
Polling now uses the existing browser evaluation API, and the comparison reaches the
intended regression. CSP and application security settings remain unchanged.

Windows remains an untested runtime/installer platform for this patch. The one Python
skip needs Windows' `pypdf` dependency. Native bridge behavior is covered, while physical
OS menu clicks were not automated. No release, feed change, installation or notarization
was performed, and no new signing credentials were used. No implementation blocker remains.

Evidence: `windows-src/build/shot-navigation-review/summary.json`,
`browser-source.json`, `native-source.log`, `python-source.log`, `baseline-32d24c8.log`,
`build.log`, `signature.log`, `packaged-runtime-sha256.json`, `browser-packaged.json`,
`native-packaged.log`, `python-packaged.log`, `actual-app-result.json`,
`actual-app-webkit.log`. Screenshot: `windows-src/build/shot-navigation.png`.
