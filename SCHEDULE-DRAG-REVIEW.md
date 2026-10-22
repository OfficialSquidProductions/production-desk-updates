# Shooting Schedule drag and placement improvements

This local change builds on `e1c9b62`, preserving the completed Lined Script and Shot List
work and the published 1.5.11 original-PDF/Main Breakdown fixes. It does not publish a
release, alter update feeds, replace an installed app or use an existing user workspace.

## Interaction

- The strip body is a grab area; script-label text no longer competes with dragging.
  Each strip also has a prominent grab handle, including the holding boards. Clicking
  that handle opens the existing exact-placement dialog as a keyboard-friendly alternative.
- Drop over the upper half of an entire strip to insert before it, or over its lower
  half to insert after it. No thin border or margin is required. Day headers and footers
  accept start/end placement; empty days, Unscheduled and Holding have generous targets.
  Between-day placement is available on the main board with explicit feedback.
- A blue insertion line, destination outline and live placement message identify the
  exact destination. The source is dimmed. Feedback updates on target entry/hover and
  while scrolling, without changing row heights or moving the target under the pointer.
- Holding near a visible scroll-pane edge scrolls that pane automatically, in either
  direction. Drop commits one move; moving/scrolling alone never changes the schedule.
- Escape, an outside drop or switching scenario/view cancels. External drag payloads,
  stale gestures, invalid targets and self/no-op placements cannot mutate the board.
  Successful moves preserve the panes' scroll positions and are undoable/redoable.
- Strip clicks still open the breakdown. Color controls and day controls remain independent;
  color/edit controls cannot accidentally start a strip move. Tiny pointer movement uses
  normal click behavior rather than committing a reorder.

## Data integrity

A move is planned on copies of the scenario's board arrays. The destination reference is
resolved before removing the source, so a standalone banner moving past a day does not
shift the destination incorrectly. Only the active scenario's board contents change.
Scene IDs, shot links, coverage marks, manual notes and other scenarios remain intact.
A source must occur exactly once. No-op placements preserve redo history.

## Source verification

- Browser aggregate: 56 checks, zero page errors. Tests include 200 synthetic scenes,
  three banners, multiple days, an empty day, Unscheduled, Holding, another scenario,
  linked shots and coverage. Adjacent/distant up/down moves, broad target entry, cross-day
  moves, banner index shifts, cancellation, autoscroll, undo/redo and save/reopen pass.
- Real Chromium mouse gestures drag from full strip content and from the large handle.
  Live insertion feedback is asserted while autoscrolling. Escape leaves the saved
  workspace unchanged, and saved board/shot/coverage relationships survive a reload.
- Native WebKit aggregate: 49 named checks, plus existing native save/import/reload checks.
- Backend aggregate: 81 tests, 80 passed and 1 Windows `pypdf` dependency skip.
- Node source checks: 20 passed, including five pure move-planning tests covering
  destination/index handling, uniqueness, no-op and invalid/duplicate-source rejection.
- Existing Lined Script, Shot List, original-PDF and Main Breakdown regressions pass.
- The optional `--baseline-board e1c9b62` browser comparison detects the previous UI's
  missing large grab handle. Its expected failure is distinct from current passing checks.

Packaged verification and the exact tested implementation commit are recorded below after
building the separate preview. Windows runtime/installer testing remains unavailable locally.

## Review and repeat

Run **Start Packaged Schedule Preview.command** to use a separate preview and fresh review
home under ignored `windows-src/build/`. It prints the data location and keeps review
files there after quitting. Import copies for QA. Earlier previews and launchers remain.

From `windows-src`:

```sh
python3 -B -m unittest discover -s tests -v
node --test tests/schedule-drag.cjs tests/mac-store-exports.cjs tests/platform-branding.cjs tests/support-errors.cjs
python3 -B tools/check_macos_desktop.py --source
node tools/check_lined_browser.cjs --all
python3 -B tools/check_macos_desktop.py --app 'dist/Production Desk Schedule Preview.app'
```

Browser checks need Playwright and Chromium. Existing installations can be supplied via
`PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE`; `PRODUCTION_DESK_RUNTIME` and `PYTHON`
select packaged assets and Python. Evidence is in `windows-src/build/schedule-drag-review/`.
