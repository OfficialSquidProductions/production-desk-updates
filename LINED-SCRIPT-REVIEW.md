# Lined Script local review

Branch: `feat/lined-script-controls` in `lined-script-dev`.
Base: `fda5fc347dc406b4fec0c9d90ff304de660b2e52` (1.5.11 build 33), including
`3552b21b29f7605bf92dbb12f19452d7ca507548` and the original-PDF/Main Breakdown fixes.
This work is local: no release version, update feed, public download, or installed app was changed.
The prior `breakdown-editing-dev` checkout remains clean.

## Changes

1. Settings → **Key Binds** captures shortcuts for annotation tools, page navigation,
   style, continuous scrolling, zoom, shot creation/linking/renumbering, deletion,
   PDF attachment and export. Save rejects conflicts and reserved application/editing
   commands; clearing a binding disables it. Defaults and custom binds persist in device
   settings. Tooltips show assigned keys. Actions pause in fields, editable content,
   dialogs, IME composition, repeated key events and active pointer gestures.
2. Undo/redo updates annotations and the inspector without reconstructing the PDF.
   Deep vertical/horizontal scroll and selected line survive edits, deletion, restore,
   linking and renumbering. History stores selection separately from saved project data.
   Mac and Windows menu actions share the same focus/dialog guard as keyboard handling.
3. Scene 1 + shot `1`, `.1`, or `1.1` displays **1.1**. Repeated periods collapse;
   explicit dotted identifiers and existing letter suffixes remain supported. Shared
   formatting covers line labels, choices, Shot list, CSV and print.
4. Coverage boxes have connectors and visible selected outlines. Drag them into either
   gutter; only label coordinates can leave the paper. Settings has a 15–100% background
   opacity slider. Gutter text wraps to fit. PDF export places boxes inside the original
   page, preserving original page dimensions, content and editable gutter positions.
5. Clicking a line selects/highlights its box, including while another tool is active.
6. Every completed new coverage line creates its own shot in the scene selected in Main
   Breakdown (or the first scene). If no scene exists, it remains an editable unlinked
   draft until a scene is added. Explicit linking is available for intentional shared
   coverage. It never seeds a new line with the previous line's shot ID.
7. Selected linked coverage has **Renumber shot…** and a configurable shortcut. An occupied
   number is rejected unless the user explicitly enables swapping. Stable shot IDs keep
   all line/revision references, details and manual notes intact.
8. Deleted shots disappear from the live link choices and search. Undo restores the shot
   and all linked coverage across revisions.
9. Link choices sort naturally by full shot identifier. **Find shot number** supplies
   autocomplete with exact Enter selection, arrows, Escape and clickable suggestions.
   Ambiguous results require a deliberate choice.

## Validation

All QA uses synthetic temporary workspaces, never the installed app's data.

- Full Python suite: **81 tests, 80 passed, 1 skipped**. The skip requires Windows' `pypdf`
  dependency. Includes settings merge/validation/atomic rejection, gutter coordinates,
  save/reload, backups, original immutability and existing project/server regressions.
- Browser aggregate: **46 checks passed, zero page errors**. Includes existing Lined
  Script, workspace layout, Main Breakdown, original-PDF and general shot/edit/import regressions, plus new controls.
  Real Chromium keyboard and mouse checks exercise focus, Cmd/Ctrl undo/redo, gutter drag,
  browser resizing, save/reopen and settings persistence.
- Native macOS WebKit aggregate: **41 named checks passed**, plus existing native
  save/update/import/reload checks. Includes the new controls on an 80-page mixed-width
  PDF with 600 pre-existing shots, multiple scenes, repeated edits, zoom, selection,
  undo/redo, collision swaps, delete/restore, autocomplete and full backup/import.
- Node source helpers: **15 tests passed** (Mac Store exports, platform branding and support error handling).
- Swift type-check: `desktop/Slate.swift` and `desktop/Updates.swift` passed against the
  existing verified local Sparkle framework. JavaScript syntax and `git diff --check` pass.

Not run: actual Windows/Electron installer execution, Windows PDF extraction,
iOS tests, notarization/publication/App Store workflows. Packaged Mac verification
is now complete as described below (ad-hoc signing only).
The native harness verifies the menu bridge behavior; it does not simulate an OS menu click.
No current test failures or permission blockers remain.

## Try locally

Double-click **Start Lined Script Dev.command**, then open <http://127.0.0.1:8767>.
It uses a separate sample workspace under `windows-src/build/lined-dev/`. Import a
copy of a production for manual review. Stop with Control-C. Do not open the installed
working app for this source preview.

Repeat from `windows-src`:

```sh
python3 -B -m unittest discover -s tests -v
python3 -B tools/check_macos_desktop.py --source
node tools/check_lined_browser.cjs --all
node --test tests/mac-store-exports.cjs tests/platform-branding.cjs tests/support-errors.cjs
```

The optional browser harness uses Playwright and Chromium. `PLAYWRIGHT_MODULE` and
`BROWSER_EXECUTABLE` can point to existing local installations; `PYTHON` overrides Python.
Screenshots/PDF evidence is generated under ignored `windows-src/build/`.

## Packaged Mac verification completed

Implementation tested: `866c68b2f47aa0fa2065dd3b88f2906e8a7f2a3c`.
The app's native executable and Python/web runtime were built from that commit.
Subsequent tracked changes add only test-target selection, this report and the safe launcher.

Artifact: `windows-src/dist/Production Desk Lined Script Preview.app`.
It is an Apple Silicon, locally ad-hoc-signed app, not a notarized release. Its bundle
metadata supplies a unique preview identifier, marks it as a beta to skip update startup
and migration, disables automatic updates, removes the live feed URL, and records the
implementation commit. Runtime assets match the committed source; SHA-256 evidence is
under `windows-src/build/packaged-lined-review/`.

Use **Start Packaged Lined Script Preview.command** from this checkout to launch it.
That launcher supplies a fresh isolated home under ignored `windows-src/build/` and
prints its data location. Review data stays there after quitting. Import copies only.
Use this launcher for isolation instead of opening the app bundle directly.

Passed against the packaged runtime:

- Offline build, bundled standard-library startup, and `codesign --verify --deep --strict`.
- Full Python suite with bundled Python/backend: 81 total, 80 passed, 1 Windows dependency skip.
- Browser aggregate with bundled Python/server/web assets: 46 checks, zero page errors,
  including real keyboard/mouse behavior and the 1.5.11 PDF/Main Breakdown regressions.
- Native WebKit aggregate against bundled Python/backend: 41 named checks plus native
  save/import/reload checks.
- Actual compiled AppKit app launch: Foundation home and Application Support isolation
  were proved before launch. Its child used the bundled Python and temporary workspace.
  The same native aggregate passed against that actual app's server. The test stopped only
  its own processes. Installed app and every existing Slate file retained their original
  fingerprints and modification times.

No Windows VM, Wine or current Windows/Electron runtime/dependencies were available.
The old Windows installer on disk was not installed or executed on macOS. Windows remains
an explicitly untested runtime/installer platform for this patch. The native harness
checks the menu bridge behavior, not physical OS menu clicks. Nothing was published,
notarized with new credentials, installed over the working app, or enabled in an update feed.

Repeat packaged checks from `windows-src` after building the preview:

```sh
python3 -B tools/check_macos_desktop.py --app 'dist/Production Desk Lined Script Preview.app'
PRODUCTION_DESK_RUNTIME="$PWD/dist/Production Desk Lined Script Preview.app/Contents/Resources/runtime" \
PYTHON="$PWD/dist/Production Desk Lined Script Preview.app/Contents/Frameworks/Python3.framework/Versions/3.9/bin/python3.9" \
node tools/check_lined_browser.cjs --all
```

Evidence: `build/packaged-lined-review/summary.json`, `build.log`, `signature.log`,
`packaged-runtime-sha256.json`, `native-packaged.log`, `actual-app-result.json`,
`actual-app-webkit.log`, `browser-packaged.json`, and `python-packaged.log`.
