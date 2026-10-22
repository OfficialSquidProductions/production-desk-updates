# Project import review

Local implementation on `feat/lined-script-controls`; no release, feed changes, notarization or installed-app replacement.

Import is beside Save As. Portable project files preserve the complete project schema: metadata, original source script, all original PDF revisions, scenes and breakdown text/fields, categories and elements (cast, links, availability and events), calendars, every schedule scenario/board/day/banner, strip colors, shots/takes/timing and project settings, coverage/drawing/note annotations, label coordinates, links and arbitrary project extensions. Internal IDs remain stable even when importing a duplicate; only its colliding production ID and display title change to keep the copy separate.

Pending edits save before reading. Cancel during reading is safe, including delayed responses. The final save commits atomically before switching productions; failure leaves the existing project in place. Imports remain undoable/redoable. Duplicate JSON fields, duplicate IDs, broken links, invalid versions and damaged/missing original PDFs report errors. Older JSON/USS repairs remain available.

Launch the separate preview with [Start Packaged Project Import Preview.command](Start%20Packaged%20Project%20Import%20Preview.command). The launcher checks preview metadata, disabled updates and Foundation storage paths before starting it and uses a new disposable home. The native `ProductionDeskPreview` flag additionally isolates direct launches in their own `ProductionDeskPreviews/preview-<bundle ID>` namespace. Workspace, previous-save backup, settings, PDFs and diagnostics all derive from that directory. No UI tool relaunch is needed for verification.

Tested source commit: `2bb39cd86be0edf690a68ffd2948d25a68386685`.

Preview: `windows-src/dist/Production Desk Project Import Preview.app`, bundle ID `local.productiondesk.import-preview.2bb39cd`, ad-hoc signed and strict code-sign verification passed. Updates are disabled and its feed URL removed. Its 247 bundled runtime source files match the tested checkout; the PDF helper was compiled locally and exercised by regression checks.

Passed verification:

- Python aggregate: 89 passed, 1 skipped (90 total). The skip requires the Windows PDF dependency.
- Node helper tests: 20 passed.
- Browser aggregate: 64 checks on source and 64 against bundled Python/runtime; zero page errors. Includes actual Save As download → Import file input → save/reopen, original PDF byte equality, custom extension fields, stable IDs and duplicate-copy undo/redo, unsaved edits, failed prior/final saves, delayed cancellation, broken references, corrupt/missing assets, older repairs and 2,400 additional shots.
- Native Mac WebKit: 56 named aggregate checks plus native save/import/reload checks on source and against the actual packaged AppKit executable's own bundled server. Previous Lined Script, Shot List, Schedule and Main Breakdown regressions remain included.
- Python disk round trips also cover a valid empty production, original source, two PDF revisions, all project fields, backups, duplicate entity/annotation IDs, malformed/empty JSON, duplicate JSON keys, 5,000 additional shots and the workspace size limit.
- Native preview/stable/beta routing and support-session assertions passed. Before launching the preview, both direct-launch and temporary-home storage paths were checked for workspace, PDFs, settings, logs and backups. The actual app used the verified temporary workspace and bundled Python. Installed app and every existing stable/beta data file, diagnostic log and backup retained identical hashes and modification times.

Evidence: ignored `windows-src/build/import-review/summary.json`, `artifact.json`, `actual-app-result.json`, both storage preflight reports and full test/build logs. Disposable test workspaces were removed by the harnesses.

Windows/Electron and iOS/device execution require their own environments and are not claimed by Mac verification. Device preferences are local. Originals absent from old files cannot be reconstructed. Immutable PDF blobs may be cached after a cancelled/rejected merge, but the current workspace is unchanged. No public release is authorized.
