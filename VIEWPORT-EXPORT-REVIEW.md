# Viewport and portable-export follow-up

Local branch: `feat/viewport-scene-gutter-followup`, based on the published 1.5.12 source. No new release, remote push, feed change, notarization or installed-app replacement is authorized or performed.

Shot deletion keeps list/editor/page viewport offsets, chooses the next visible shot (previous at the end), and preserves filter scope through undo/redo. Main Breakdown defaults to scene/page navigation; Continuous Scroll is an explicit checkbox before the page selector, stored as optional project `_breakdownSettings.continuousScroll`. Missing settings in older files mean false without a migration write. Original pages remain whole, including shared scene pages; page controls handle multi-page scenes. Text-only scripts can also show all scenes optionally.

Settings gives Key Binds its own spaced row above opacity. Lined PDF exports retain off-page boxes/connectors, expand output MediaBox/CropBox only where needed, preserve original script coordinates/rotation and source asset bytes, and retain readable long gutter notes. Expanded PDF pages can have different sizes. `.productiondesk` remains the editable handoff format; device key binds/appearance/opacity stay local.

The published baseline reproduced deletion from scrollTop 40586 to 0, four continuously visible PDF pages with no option, zero Settings control gap and a gutter export still confined to 612-point paper width. Current synthetic cross-profile verification removes all sender storage before recipient import, checks every project field and both original PDFs, then edits a shot/label and saves/reopens through a recipient backend restart. It also tests rotated/cropped originals, gutter raster ink, long labels and narrow/scaled Settings layout.

Use [Start Packaged Viewport Export Preview.command](Start%20Packaged%20Viewport%20Export%20Preview.command) after the local preview build. Before launching it, the launcher validates preview identity, disabled updates and dedicated Foundation storage for workspace, settings, PDFs, logs and backups. No computer-use relaunch is required.

Final tested commit, packaged checks and evidence will be recorded after verification. Evidence stays under ignored `windows-src/build/viewport-followup-review/`. Windows application/iOS/device execution is not claimed by local Mac testing.
