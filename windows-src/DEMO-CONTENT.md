# The Last Cue — offline demo

**Load Demo** and **Demo guide** sit beside the production selector on desktop,
iPhone and iPad, visible on the start screen and every main view. The sample
is a separate editable production and works offline.

The canonical reference is the actual shipped Scenic 1.4.20 (25) sample:
`DEMO · The Last Cue`, `INT. BLACK-BOX THEATRE — EVENING`, Maya (22), Leo (23),
lighting cue twelve, the missed stage wash, and their reset. Dialogue and action
match Scenic. Scene 1 has shots 1A–1D: cameras A–D, lenses 24/50/85/35 mm, the same
descriptions, framing, movement, equipment, planned status and 5/3-minute
setup/shoot estimates. Scenic Normal priority maps to PD's middle Preferred
priority. Fountain punctuation is adapted for the script parser.

The older desktop The Last Light and iOS The Last Cue v1 samples remain ordinary
saved productions. Neither titles nor the older marker grant reset ownership.

## Feature coverage

| Feature | Included sample / test route |
| --- | --- |
| Script reading, editing, search and tagging | One original rehearsal scene with canonical dialogue and retained source Fountain. Edit text or tag an element. |
| Breakdown fields and review | Synopsis, cue notes, pages, script pages, duration, set, INT/EXT, evening, script day, unit and location. Toggle review/completion. |
| Cast and department elements | Maya/Leo, notebook, lamp, desk/chair, cameras, tripods, wash/console, sound, art, special equipment and reset notes. Rename, tag, unlink or add, then Undo. |
| Relationships and availability | Locked cast IDs, linked cast, weekends off and a fictional availability exception. |
| Schedule, banners, colors, boneyard | Rehearsal shoot places the scene between PREP/WRAP banners with a custom color; Unscheduled planning copy leaves the scene in the boneyard. Move/recolor/reorder/add a day. |
| Calendars and scenarios | First date 2026-11-02, weekends off, a fictional additional day off; two scenarios sharing a calendar. |
| Shot planning and tracking | Four shots with cameras/lenses/framing/movement/equipment/timing/notes. Planned status, zero takes; try takes, circle take, actual time, completion or reorder, then Undo. |
| Lined script | Embedded original two-page PDF; six editable marks: solid/wavy linked coverage, pen, highlighter, arrow and text. Edit, change pages or export a lined PDF. |
| Reports | One-line schedule, scene breakdowns and Cast workdays. |
| Files and printing | Ordinary Save As/import, full backup, USS, schedule CSV, shot CSV, lined PDF and Print / Save PDF. |
| Undo/redo and autosave | Loading/reset use normal undoable mutations; sidebar and top bar track pending, failed and successful saves. |
| Appearance and platform shell | Existing themes, settings, keyboard shortcuts, file dialogs and updater paths remain normal app features. |

The script has no vehicles, stunts, animals, wardrobe changes, VFX or background
performers, so those departments remain empty. No extra story scenes or completed
takes are invented; add disposable entries and Undo while testing. Cast workdays
lists scheduled workdays; hold/drop/pickup accounting remains unimplemented.
Scenic's geometry, blocking playback and camera/lighting calculations belong to
Scenic, not PD. Updates, permissions, external sharing, physical printing and
physical-device file providers require separate QA.

## Preserve, reopen and reset

Loading first flushes current edits; failure stops the load. The sample merges
through the existing portable validation/import path, including the checksum
PDF. It preserves existing productions and workspace extensions, including edits
made while the bundled file loads.

Repeated Load Demo reopens the managed sample, preserving edits and renamed
title without duplicates. Demo guide → Reset demo… → Reset only demo confirms
replacement of only that sample. Cancel does nothing. Undo restores its edited
state. The reset target remains the managed sample if another project is selected.

Ownership requires workspace-local
`_demoProjects['productiondesk.scenic.the-last-cue.v2']` plus the matching project
marker. Titles and markers alone never grant ownership. Save As excludes the
registry and normal imports merge only productions, so imported copies cannot
be reset. Older samples remain untouched. Deleting the managed sample through
Production settings permits a fresh Load Demo.

## Regenerate or remove

`web/demo/scenic-reference.json` retains the shipped reference with source hash.
From `windows-src/`, run `python3 tools/build_demo.py`, then copy the generated
`.productiondesk` and `.fountain` from `web/demo/` into
`../ios/ProductionDesk/Web/demo/`. Controllers, reference JSON and
`production-start.css` also stay byte-identical; regression checks enforce this.
No external download or private production assets are used.

For launch removal set `DEMO_ENABLED = false` in both
`windows-src/web/demo/demo.js` and `ios/ProductionDesk/Web/demo/demo.js`. This
hides and disables loading/reset; saved samples stay editable and exportable.
To remove bundled assets entirely, also remove each controller import and
construction plus the static launcher, then remove the demo directories.
Never automatically delete saved productions, alter portable formats or remove
markers from user copies.
