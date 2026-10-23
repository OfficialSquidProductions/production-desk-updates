# iPhone/iPad 1.5.14 (39) parity and review

**Submitted: Waiting for Review, October 23, 2026 at 9:02 AM EDT.** [Apple submission receipt](https://appstoreconnect.apple.com/apps/6823682933/distribution/reviewsubmissions/details/d73314c9-938b-44f4-94ba-5676c33a08e5). This is a verified submission, not Apple approval. Initial delivery blocks below were resolved.

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

Before changes, iOS **1.5.10 (31)** (`c3adeeb1-85fd-4fa9-9f65-401dcf99d45d`) was Waiting for Review. Mac **1.5.14 (37)** was independently Waiting for Review. After build39 processed successfully, the old iOS version was withdrawn, updated to 1.5.14, associated with build39, and resubmitted. The exact final receipt is recorded below; submission is not approval.


## Exact iOS review notes

No account or sign-in is required. Production Desk works offline and stores projects locally on this iPhone or iPad. Choose Load The Last Light demo beside the production selector to open an original eight-scene production with sixteen shots, three shooting days, an eight-page selectable screenplay PDF, lined marks, and sample breakdowns. Open Demo guide for the walkthrough. Repeated demo loading preserves sample edits; Reset demo affects only the separate sample and supports Undo.

Build 39 updates iPhone and iPad to the Mac 1.5.14 editor feature baseline, while retaining native iOS storage, Files import/export, share sheets, and iPad portrait Script/Breakdown panes. Check Main breakdown (original PDF page/zoom/Continuous Scroll and text tagging), Shooting schedule (drag strips or tap a grab handle for precise placement), Shot list (edit, reorder, track takes and delete), Lined script (coverage/drawing tools, linked shots, undo/redo and lined PDF export), Elements and Reports. Lined Script settings include configurable keyboard shortcuts for external keyboards and information-box opacity. Labels can be moved into page gutters; PDF exports retain them.

Use Save As to save a complete .productiondesk file in Files, or Export > Share project to open the native share sheet. Import > Browse Files opens projects as separate productions and preserves existing work. Original PDFs, editable lined marks, script text, shots, schedules and notes travel together between iOS, Mac and Windows. No external runtime or account is required on iOS. The separate Shot Shooting Order tab is absent; regular Shot List functionality and older saved project data are preserved. Updates are delivered by Apple.


## Final test results and initial delivery blocks

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


## Authorized delivery retry — 2026-10-23

After fresh direct human authorization was forwarded through the trusted parent, the single authorized source-branch retry succeeded. Remote branch `fix/ios-1.5.14-parity` now points to `009757723ea1e8e288080bdded69a54a7e1706e7`. Remote main was reconciled at `6c7a8d96166cf3faeea32047ac72a66933cb6947`; this task did not push main.

Live App Store reconciliation showed only iOS1.5.10(31) as the latest upload (Complete) and the existing pending version Waiting for Review, with no build39 present. The existing final IPA hash, archive identity and all source hashes were rechecked unchanged. The single authorized archive upload retry started at approximately 08:54 EDT. Processing/selection/submission results follow below after completion.


Upload succeeded at **08:55:18 EDT**, with `** EXPORT SUCCEEDED **` and no warning/error in `ios/upload-39.log`. Apple build UUID is **`bab24f81-d435-4462-a1e9-be2b84977e1a`**, iOS **1.5.14 (39)**. Processing completed and TestFlight displayed **Ready to Submit**. The old iOS-only review item belongs to submission `cc59fe0c-9f0b-4764-8432-c48b7065a435`; removal was requested once via the iOS version page. macOS submission `7d2a7d8a-ebdc-473e-a13f-b819742790db` stayed Waiting for Review.


The build-row Delete control was initially denied before execution because the label could imply deleting build31. New relevant official evidence was then read: Apple's [Choose a build to submit](https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit/) explicitly states that removing a build from a version does not remove it from the account and identifies the same Delete (–) button in the version's Build section. One evidence-based retry succeeded. The Add Build dialog subsequently showed build31 still available alongside build39; only the version association changed.


## Verified final iOS submission

The saved version is **1.5.14**, selected build **39**, Apple build UUID **`bab24f81-d435-4462-a1e9-be2b84977e1a`**. The exact iOS notes in this document were saved, then verified after page reload with an exact 1,711-character match. Sign-in remains not required; the existing automatic release-after-approval choice is retained. No new legal agreement, account, security or credential change occurred.

Add for Review transitioned to Ready for Review and created one draft iOS item, **1.5.14 (39)**. The final Submit for Review request returned **1 Item Submitted**. The new [iOS submission receipt](https://appstoreconnect.apple.com/apps/6823682933/distribution/reviewsubmissions/details/d73314c9-938b-44f4-94ba-5676c33a08e5) displays **Waiting for Review**, **iOS App 1.5.14**, **1.5.14 (39)**, **October 23, 2026 at 9:02 AM EDT**, submission ID **`d73314c9-938b-44f4-94ba-5676c33a08e5`**, submitted by Alexander Hosier. Screenshot: ignored `ios/build/ios-review-receipt-39.png`. Receipt data and final release state: `ios/build/app-store-receipt-39.json`, `ios/build/release-evidence-39.json`.

The originally uploaded build31 remains in the account. The old iOS submission was `cc59fe0c-9f0b-4764-8432-c48b7065a435`; the new submission above contains only the iOS item. Mac **1.5.14 (37)** and its submission remained Waiting for Review. Windows44 and both websites were not modified by this task.

Runtime source remains **`36ef48eda1d445b1c75e013f3abbb2a3ca78088b`**. The published source branch initially reached **`009757723ea1e8e288080bdded69a54a7e1706e7`**; final documentation follows on the same branch. Main publication/integration belongs to the coordinator and was not pushed by this task. The signed IPA and all 245 web-source hashes remain unchanged. There is no active upload, unresolved denial, or remaining submission action. Review approval is pending.
