# Project import review

Local implementation on `feat/lined-script-controls`; no release, feed changes, notarization or installed-app replacement.

Import is beside Save As. Portable project files preserve the complete project schema: metadata, original source script, all original PDF revisions, scenes and breakdown text/fields, categories and elements (cast, links, availability and events), calendars, every schedule scenario/board/day/banner, strip colors, shots/takes/timing and project settings, coverage/drawing/note annotations, label coordinates, links and arbitrary project extensions. Internal IDs remain stable even when importing a duplicate; only its colliding production ID and display title change to keep the copy separate.

Pending edits save before reading. Cancel during reading is safe, including delayed responses. The final save commits atomically before switching productions; failure leaves the existing project in place. Imports remain undoable/redoable. Duplicate JSON fields, duplicate IDs, broken links, invalid versions and damaged/missing original PDFs report errors. Older JSON/USS repairs remain available.

Launch the separate preview with [Start Packaged Project Import Preview.command](Start%20Packaged%20Project%20Import%20Preview.command). The launcher checks preview metadata, disabled updates and Foundation storage paths before starting it and uses a new disposable home. The native `ProductionDeskPreview` flag additionally isolates direct launches in their own `ProductionDeskPreviews/preview-<bundle ID>` namespace. Workspace, previous-save backup, settings, PDFs and diagnostics all derive from that directory. No UI tool relaunch is needed for verification.

Verification results and tested source commit are recorded after the packaged checks. Test data and detailed logs live only under ignored `windows-src/build/import-review/`.

Windows/Electron and iOS/device execution require their own environments and are not claimed by Mac verification. Device preferences are local. Originals absent from old files cannot be reconstructed. Immutable PDF blobs may be cached after a cancelled/rejected merge, but the current workspace is unchanged. No public release is authorized.
