# iPhone/iPad 1.5.14 (39) parity and review

Isolated clone `ios-parity-review-dev`, branch `fix/ios-1.5.14-parity`, based on reconciled remote main `b60faee5c260376f770dfceb3397d685ba7f1c5d`. Only `ios/` is changed. Mac 1.5.14 (37), its existing submission, releases, feed and websites are untouched.

## Implementation

The editor ports the Mac37 common modules for lined-script controls, distinct shot creation, normalized identifiers, autocomplete/renumbering, gutter labels/connectors/opacity and expanded PDF export bounds, context-preserving undo/redo, shot navigation/deletion, continuous script viewing, and schedule dragging/placement. iOS keeps its own `native-platform.js`, PDFKit/native PDF byte bridge, offline WebKit worker setup, UIKit Files/share sheets, portrait pane selection, appearance and v1 durable workspace store. No Mac entitlement is copied.

Imports flush current edits, parse without replacing the current workspace, allow cancellation before final commit, and atomically save the merged workspace before displaying the imported production. Colliding production IDs receive new production IDs; entity IDs scoped to a production and all relationship/extension fields remain intact. The separate filming-order tab/route is absent. `_shotShootingOrder` is neither reconciled nor deleted by regular editing, even when it contains stale shot IDs.

## Package

Version **1.5.14 (39)**; bundle `com.hosier.scheduler.ipad`; team `FZ298DXLS3`; iPhone/iPad iOS 17+. Existing app-specific App Store profile/certificate. App Store export uses `testFlightInternalTestingOnly=false` and disables automatic version changes.

Signed archive: ignored `ios/artifacts/ProductionDesk-1.5.14-39-signed.xcarchive`. IPA: `ios/artifacts/export-1.5.14-39/Production Desk.ipa`. SHA-256 `f3a10bdaabee55d254bc73299796780f0c3ed09faee2399d21e1d3e5905a97ed`, 3,319,950 bytes. All 245 bundled web files match reviewed source byte-for-byte (`ios/build/ipa-verification-39.json`). Signature verification passed with normal trust access. Exported entitlements are only the app identifier, team identifier, beta-reports-active, and get-task-allow=false.

## Validation and limits

47 web/data/bridge tests passed. Dedicated new disposable iPhone 17 Pro and iPad mini (A17 Pro), iOS 26.5, preserve all preexisting simulator and installed-app data. Runtime suites exercise shipped JavaScript and real native storage/PDF bridges. Additional Mac regression scripts are adapted for native APIs and canonical object-key comparison. They test an 80-page/600-shot production, controls/undo/gutter labels/settings, deep shot navigation/deletion, schedule drag placement/cancellation/autoscroll and alternate-scenario integrity. Synthetic pointer/drag/keyboard events are distinguished from XCUITest touch interactions.

The portable desktop fixture includes `_shotShootingOrder=['retired-shot-stale-id','fixture-shot']`, Continuous Scroll settings, a gutter label and original PDF bytes. Native iOS import/export checks the complete envelope. Independent coordinator testing imported/exported this exact fixture through frozen Mac37 Python with whole-envelope equality, unchanged original PDFs and an unchanged synthetic receiving workspace; evidence is under `platform-parity-integration-dev/windows-src/build/platform-parity-audit/ios-fixture-mac37-roundtrip.json`.

Physical iPhone/iPad, AirDrop, third-party Files providers and real-device memory/performance are unavailable. Simulator UIKit Files save/import/share sheets and rotation tests are recorded separately below. Simulator runtime performance does not establish hardware performance.

## App Store state

Before changes, iOS **1.5.10 (31)** (`c3adeeb1-85fd-4fa9-9f65-401dcf99d45d`) was Waiting for Review. Mac **1.5.14 (37)** was independently Waiting for Review. The iOS pending submission is preserved until replacement processing/testing completes. Final upload, processing, selection and resubmission evidence will be appended after verification; submission is not approval.


## Exact iOS review notes

No account or sign-in is required. Production Desk works offline and stores projects locally on this iPhone or iPad. Choose Load The Last Light demo beside the production selector to open an original eight-scene production with sixteen shots, three shooting days, an eight-page selectable screenplay PDF, lined marks, and sample breakdowns. Open Demo guide for the walkthrough. Repeated demo loading preserves sample edits; Reset demo affects only the separate sample and supports Undo.

Build 39 updates iPhone and iPad to the Mac 1.5.14 editor feature baseline, while retaining native iOS storage, Files import/export, share sheets, and iPad portrait Script/Breakdown panes. Check Main breakdown (original PDF page/zoom/Continuous Scroll and text tagging), Shooting schedule (drag strips or tap a grab handle for precise placement), Shot list (edit, reorder, track takes and delete), Lined script (coverage/drawing tools, linked shots, undo/redo and lined PDF export), Elements and Reports. Lined Script settings include configurable keyboard shortcuts for external keyboards and information-box opacity. Labels can be moved into page gutters; PDF exports retain them.

Use Save As to save a complete .productiondesk file in Files, or Export > Share project to open the native share sheet. Import > Browse Files opens projects as separate productions and preserves existing work. Original PDFs, editable lined marks, script text, shots, schedules and notes travel together between iOS, Mac and Windows. No external runtime or account is required on iOS. The separate Shot Shooting Order tab is absent; regular Shot List functionality and older saved project data are preserved. Updates are delivered by Apple.


## Final test results and current delivery state

Runtime implementation commit: `36ef48eda1d445b1c75e013f3abbb2a3ca78088b`. Later documentation commits do not change the signed payload. Final package web hashes still match this commit.

- Final iPhone39 native/runtime: **43 tests passed**, zero failures; `ios/build-iphone-final-39.log`, `ios/build/iphone-final-39.xcresult`.
- Final iPhone39 touch UI: **9 tests passed**, zero failures; `ios/build-iphone-final-ui-39.log`, `ios/build/iphone-final-ui-39.xcresult`. Includes Files save/import, share-sheet and picker cancellation, repeated navigation/relaunch, portrait/landscape/keyboard, actual long-press schedule drag and lined-tool toggles.
- Final iPad39 native/runtime and real-touch drag/tool test: **44 tests passed**, zero failures; `ios/build-ipad-final-39.log`, `ios/build/ipad-final-39.xcresult`.
- Full iPad UI suite: **8 tests passed** on candidate38 before the narrow dialog-handler restoration; `ios/build-ipad-final.log`, `ios/build/ipad-final-38.xcresult`. Final39 reran all native tests including the stronger queued-dialog-event regression and the additional real-touch test. It did not rerun those unchanged eight iPad UI tests after the two-line scope/guard restoration.
- Web/data: **47 tests passed**, zero failures; `ios/web-tests.log`.
- Final signature/profile/entitlements and all **245** bundled web source files verified; `ios/build/ipa-verification-39.json`, `ios/build/codesign-verify-39.log`, `ios/build/ios-entitlements-39.plist`, `ios/build/release-evidence-39.json`.

Initial candidate38 exposed a desktop-only lined PDF loader, then a helper omission during adaptation; both were corrected before final39. Inspection of an actual diagnostic also caught the loss of the older iOS content-scoped field binding/empty-scene guard. These were restored and a queued stale-dialog change is now explicitly tested. Native JSON comparisons canonicalize object keys, since dictionary ordering is not persisted semantics. The phone drag fixture brings the stacked board into view before testing edge autoscroll. Toolbar controls correctly expose themselves to XCUITest as switches due to aria-pressed.

All files on the test devices are fictional QA data. No installed Production Desk app, existing simulator, real workspace, credential, agreement, security setting, Mac/Scenic record, release/feed or website was changed. The earlier unuploaded candidate38 archive/IPA/evidence remain intact.

**Denied before execution:** source push `git push -u origin fix/ios-1.5.14-parity` to `https://github.com/OfficialSquidProductions/production-desk-updates.git`. Automatic approval review stated that network source egress/repository mutation to that remote lacked direct user authorization. Nothing was pushed. The local source commit remains available for coordinator read/integration.

**Denied before execution:** `xcodebuild -exportArchive` with `scripts/ExportOptions-upload.plist`, archive `artifacts/ProductionDesk-1.5.14-39-signed.xcarchive`, destination App Store Connect app **6823682933**, iOS **1.5.14 (39)**. Automatic approval review stated that sending the signed proprietary app artifact lacked trusted direct user authorization for that payload/destination. No upload started and no upload receipt exists. The existing iOS **1.5.10 (31)** remains Waiting for Review and was not removed or edited. Direct user approval has been requested for this upload and the subsequent iOS-only replacement/notes/resubmission. No retry will occur without materially new relevant authorization.
