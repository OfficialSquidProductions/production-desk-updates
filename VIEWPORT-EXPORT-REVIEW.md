# Viewport and portable-export follow-up

Local branch: `feat/viewport-scene-gutter-followup`, based on the published 1.5.12 source. The user has now authorized publishing this specific follow-up as the next desktop update. Release verification is recorded below; installed-app replacement remains out of scope.

Shot deletion keeps list/editor/page viewport offsets, chooses the next visible shot (previous at the end), and preserves filter scope through undo/redo. Main Breakdown defaults to scene/page navigation; Continuous Scroll is an explicit checkbox before the page selector, stored as optional project `_breakdownSettings.continuousScroll`. Missing settings in older files mean false without a migration write. Original pages remain whole, including shared scene pages; page controls handle multi-page scenes. Text-only scripts can also show all scenes optionally.

Settings gives Key Binds its own spaced row above opacity. Lined PDF exports retain off-page boxes/connectors, expand output MediaBox/CropBox only where needed, preserve original script coordinates/rotation and source asset bytes, and retain readable long gutter notes. Expanded PDF pages can have different sizes. `.productiondesk` remains the editable handoff format; device key binds/appearance/opacity stay local.

The published baseline reproduced deletion from scrollTop 40586 to 0, four continuously visible PDF pages with no option, zero Settings control gap and a gutter export still confined to 612-point paper width. Current synthetic cross-profile verification removes all sender storage before recipient import, checks every project field and both original PDFs, then edits a shot/label and saves/reopens through a recipient backend restart. It also tests rotated/cropped originals, gutter raster ink, long labels and narrow/scaled Settings layout.

Use [Start Packaged Viewport Export Preview.command](Start%20Packaged%20Viewport%20Export%20Preview.command) after the local preview build. Before launching it, the launcher validates preview identity, disabled updates and dedicated Foundation storage for workspace, settings, PDFs, logs and backups. No computer-use relaunch is required.

Tested implementation commit: `fa05a909bd6951975da91cd9b9d4a5f5eec476fe`.

Preview: `windows-src/dist/Production Desk Viewport Export Preview.app`, unique bundle ID `local.productiondesk.viewport-preview.fa05a90`. It is locally ad-hoc signed, with updates disabled and the feed URL removed. All 248 bundled runtime source files match the tested checkout. Direct-launch namespace and temporary Foundation home/workspace/PDF/settings/log/backup routing were checked before launch; the actual native app used its bundled Python and isolated workspace.

Passed:

- Backend aggregate: 92 passed, 1 Windows-only PDF dependency skip (93 total).
- Node helper/geometry tests: 24 passed.
- Packaged browser aggregate: 68 checks, zero page errors, including all previous Lined Script/Shot List/Schedule/Import/Main Breakdown regressions.
- Native Mac WebKit: 60 named checks plus native save/import/reload checks, against the actual packaged app's server. A Safari-incompatible text-reading helper in the new test was replaced by the same `getReader()` stream path already used by production.
- Independent-profile handoff suite: all 6 groups passed against the packaged runtime. Real Save As contains all project fields, both original PDF revisions, raw source script, stable IDs/links, labels/positions, scenes, shots, schedules, elements and the Breakdown view preference. Sender storage was removed before recipient import. Recipient shot editing, actual label dragging at 150% PDF zoom, save/reopen and backend restart passed; every original asset remained byte-identical. No sender storage path occurs in the portable file.
- Settings geometry passed at 560/720/1024/1660px and 150% scaling. Screenshots and exported PDF raster were inspected. Colored label/connector ink exists beyond both original paper edges; rotated/cropped originals retain native text coordinates. Very long gutter notes remain readable in expanded output bounds. A page with no gutter content keeps its original dimensions.
- All four reported problems reproduced against the untouched published source baseline. All 1,233 protected installed-app and real project/log/backup files retained their hashes and modification times.

Evidence: ignored `windows-src/build/viewport-followup-review/summary.json`, `artifact.json`, `baseline-reproductions.json`, `handoff-result.json`, `actual-app-result.json`, storage preflight reports, full logs, Settings screenshots, `gutter-export.pdf` and `gutter-export.png`. QA data is fictional and isolated.

Compatibility limits: no Windows application, iOS/device or Intel Mac execution in this follow-up. Windows checks were updated but not run remotely because no new release/push is authorized. Portable format v1 is unchanged; older apps retain their earlier viewing/export behavior and need this new build for the new controls. Device opacity/key binds remain local. Whole original PDF pages are retained, so a shared page can show adjacent scene text; scene navigation jumps to its page reference and manual page controls handle multi-page scenes. Expanded PDFs may require different print paper/fit settings. No remaining local blocker, public release, feed change, notarization or installed-app replacement.

## Desktop release preparation

User-approved candidate: **1.5.13, Mac build 35**. Windows uses the exact-source workflow run number. Final release gates include exact-commit aggregate tests, Windows packaged/install/reinstall CI, existing Developer ID signing and Apple notarization/stapling, sealed-installer scratch tests, public downloads/signatures and isolated prior-version updater checks. No App Store/TestFlight changes.
