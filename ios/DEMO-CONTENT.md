# The Last Light — temporary offline demo

**Load The Last Light demo** is a prominent permanent entry beside the production
selector on Mac, Windows, iPhone and iPad. **Demo guide** explains every tool and
contains the explicit sample-only reset and original Scenic file handoff.

Production Desk's original `DEMO` screenplay in `server.py` is canonical. The
bundled Fountain is byte-identical: eight scenes, Maya/Eli/Jonah, North coast and
Point Harbor lighthouse, the wagon, folded map, brass key, letter, photograph
and compass. Added planning data is fictional and is labeled as testing data.
The screenplay has not been rewritten to fit a different demo.

| Tab / tool | Reference data and exercise |
| --- | --- |
| Main breakdown | Eight original scenes, script text/search/tagging, synopses, pages, durations, location, script day, unit, sequence, continuity notes, review and completion examples. |
| Shooting schedule | Location-first and Story-order alternatives; three shooting days, PREP/MEAL/WRAP banners, custom strip colors, an unscheduled scene, weekends/turnaround and a cast availability exception. Move, reorder or recolor, then Undo. |
| Lined script | Eight embedded original PDF pages, one per scene. Eight linked coverage lines (solid/wavy), pen, highlighter, arrow and text. Export an editable production or lined PDF. |
| Shot list | Sixteen shots, two per scene, cameras A/B, 24/35/50/85 mm lenses, static/tracking/tilt/pan moves, support and timing examples. Fictional scene 3A has three takes, circle take 2 and 20 actual minutes; other shots are Ready/Planned. |
| Elements | Cast, sets, locations, wardrobe, props, vehicle, camera, grip, electric, sound, art, dressing, greenery and continuity. Linked cast, locked board IDs and availability. No background cast, animals or stunt performers are invented. |
| Reports | Populated One-line schedule, Scene breakdowns and Cast workdays. Switch schedule scenarios to compare. Hold/drop/pickup accounting remains unsupported. |
| Files / settings | Normal Save As/import, full backup, USS, CSV, lined PDF, Print/PDF, themes and production settings. USS intentionally omits script text and shots. |

Scenic has the same eight numbered scenes and sixteen numbered shots, original
script passages in scene notes, named characters/props/locations, scene-specific
illustrative maps, camera links and movement/lighting examples. The maps are
blocking references, not surveyed locations or physical safety plans. Vertical
tilt, stair height, real tides and calibrated lighting are not simulated.

## Local connection to Scenic

Load The Last Light in both apps. Alternatively use **Demo guide → Save original
Scenic demo…**, then Scenic **Import project…**. This imports a separate original
starting copy; it does not contain later Production Desk edits.

For updated shots: Production Desk **Shot list → All days / All scenes / All
statuses → Export shots**; Scenic **Shot list → Import shot list CSV**. Preview the
eight existing scenes and import. Scene numbers 1–8 and shot numbers 1A–8B match;
reimport updates details and preserves maps, camera links and coverage checks.
Renumbering creates new entries under the existing importer contract. Inspect a
camera/relink it when a changed lens or shot size should also change its map
framing. Shooting status/takes are distinct from Scenic coverage checks.

There is no account, network handoff or automatic sync. Script edits, schedules
and map geometry do not travel in shot CSV. Scenic CSV does not import back into
Production Desk. Use each app's full portable file to preserve its complete data.

`web/demo/the-last-light-spec.json` is the non-secret shared reference for other
local test tools (including Camera Stats): canonical script SHA256, original
scene IDs/numbers/text, characters/locations/props and camera/shot/take examples.

## Preserve, reopen, reset

Loading first flushes current work, then validates/imports the bundled file.
A failed current save stops loading. The portable PDF is checksum verified.
Repeated loading reopens the workspace-owned sample, keeping edits and its
renamed title; it does not add duplicates. Reset requires explicit confirmation,
replaces only the owned sample, and is undoable. Cancel is inert.

Ownership uses workspace-local `_demoProjects['productiondesk.the-last-light.v3']`
and the matching project marker. A title or marker alone never grants ownership.
Portable exports omit the registry, and imports do not grant it. Existing Last
Light, Last Cue, legacy samples and imported copies remain ordinary productions;
this new sample never upgrades or overwrites them. Scenic uses the same ownership
principle with key `scenic-the-last-light-v2`.

## Regenerate / remove entry points later

From `windows-src`, run `python3 tools/build_demo.py --scenic-root ../../scenic-store`.
It reads the original `server.py` screenplay and generates paired files, the
shared spec, the PDF/annotations and Scenic fixture. PD mobile demo assets are
copied automatically. Run `python3 ios/prepare.py` in Scenic to refresh all mobile
web resources. Scenic's generator template is `tools/demo-controller.js`.

For production removal set `DEMO_ENABLED = false` in both PD `demo/demo.js`
copies and set `enabled=false` in Scenic `tools/demo-controller.js`, regenerate,
then run Scenic's mobile preparation. This hides/disables entry points without
deleting saved samples or user edits. If removing bundled assets entirely,
remove the controller imports/construction and HTML entry points together.
Never auto-delete saved productions or remove portable-format support.
