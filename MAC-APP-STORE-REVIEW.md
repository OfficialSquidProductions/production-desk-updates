# Production Desk Mac App Store correction — 2026-10-23

Worktree: `mac-store-review-dev`, branch `fix/mac-store-network-review`, based on `80ac6bb`. Runtime source at that commit is identical to public standalone source `c7b09a4050e8cd42c08d2892e9bed04dc79e6c82` (1.5.14 Mac build 36). Existing development worktrees and published standalone artifacts are unchanged.

## Remedy

Retain `com.apple.security.network.server`. This is required functionality, not an unused permission. `desktop/Slate.swift` launches bundled Python with `store_server.py --port 0 --data <container workspace> --parent-pid <app PID>`. `server.py` creates `ThreadingHTTPServer(("127.0.0.1", args.port), Handler)`. The socket listens only on IPv4 loopback at an ephemeral port; no Bonjour, LAN sharing, public listener, or privileged daemon is involved. The app's WKWebView loads its editor and calls local script import, workspace, PDF and export endpoints. `StoreExports.swift` also uses URLSession as a loopback client. Client permission alone cannot open this listener.

Main app entitlements: sandbox, user-selected read/write, network client/server, printing. Python launchers/interpreter and PDFKit extraction helper use only sandbox + inherit; they inherit the main app sandbox. Libraries have no extra access entitlements. No new exception entitlement, account capability, signing identity or profile is introduced. The Store build excludes Sparkle and migration-source files and uses Apple-managed updates.

Signed sandbox A/B test: the normal app passed bundled Python/PDFKit extraction, localhost serving, save and reload in temporary storage. A disposable copy with only `network.server` removed failed at `socket.bind()` with `PermissionError: [Errno 1] Operation not permitted`. Helpers and other entitlements were unchanged. Evidence: `windows-src/build/store-review-20261023/entitlement-ab-result.json` and its raw logs.

Apple's rejection is an automated 2.4.5 check on Mac 1.5.10 (31), submission `7d2a7d8a-ebdc-473e-a13f-b819742790db`. Read in connected Brave / Alex Main. Existing App Review notes mentioned a local runtime but omitted the listener explanation. App Store API credentials/CLI were unavailable; browser reads used the existing authenticated session.

## Requested tab removal and compatibility

The separate Shot Shooting Order navigation and app route are removed. The regular Shot List, editing, reorder, exports and printing retain their original path. `_shotShootingOrder` remains accepted by desktop/native format validation and serialized by portable files. The editor no longer reconciles this retired field when viewing or editing; even stale older-client IDs remain unchanged. No migration deletes the field or rewrites user storage.

The existing browser/native aggregate now verifies tab absence, regular Shot List canonical order/edit/reorder/Undo/Redo, and exact retained-field preservation through import, save, portable export and recipient import. Backend portable tests retain complete project fields, IDs and original PDF bytes. Low-level legacy order parsing remains for compatibility.

Candidate: **1.5.14 (37)**, `com.hosier.scheduler.ipad`, team `FZ298DXLS3`. Marketing version follows the latest public feature baseline; unique build 37 follows standalone build 36 and the latest observed ASC Mac upload 31. The Store builder now defaults `testFlightInternalTestingOnly` to false; internal-only uploads require an explicit option. The published standalone version/feed/artifacts are untouched.

## Exact App Review Information text

No account or sign-in is required. Projects are stored locally. Choose Load The Last Light demo beside the production selector to open an original eight-scene production with sixteen shots, three shooting days, an eight-page screenplay PDF, lined marks, and sample breakdowns. Open Demo guide for the feature walkthrough. Check Main breakdown, Shooting schedule, Shot list, Lined script, and Reports. Save As exports a portable .productiondesk project. Native Mac includes its local runtime; no external software or account is needed. Updates are delivered by Apple.

Network server entitlement: Production Desk includes an offline HTTP backend used by its own WKWebView editor. On launch the app starts its bundled Python runtime as a sandbox-inheriting child. It listens only on 127.0.0.1, on an OS-assigned ephemeral TCP port. The editor connects to this loopback server to load the bundled interface, import PDF/Final Draft/Fountain/text scripts, save and reload breakdowns, shots and schedules, and create local project/PDF/CSV exports. The native save handler also downloads export bytes from this same loopback origin. There is no LAN/public sharing or remotely accessible server. The backend shuts down when the app exits. com.apple.security.network.server permits the local listening socket; com.apple.security.network.client permits the app's local client requests. In signed App Sandbox testing, removing only network.server prevented backend startup with Operation not permitted at socket.bind(). The bundled Python/PDF helpers inherit the main app's sandbox. To observe the functionality, launch the app, load the demo, edit a shot or schedule, choose Save, and use Save As to export a .productiondesk file. These operations use this local service. Build 37 removes the separate Shot Shooting Order tab while preserving regular Shot List functionality and saved project compatibility.

## Exact App Review reply text

Production Desk requires com.apple.security.network.server for its bundled offline HTTP backend. The native Mac app launches its bundled Python runtime as a sandbox-inheriting child, which opens a TCP listener only on 127.0.0.1 with an OS-assigned ephemeral port. Its own WKWebView loads the bundled editor and uses that loopback service for script import, breakdown/shot/schedule save and reload, and local project/PDF/CSV exports. The native save handler also reads export bytes from the same loopback origin. The app does not expose a LAN or public server, and the backend exits with the app. The client entitlement is also required for these local client connections. We verified in a signed App Sandbox build that removing only the server entitlement causes socket.bind() to fail with Operation not permitted and prevents backend startup. We have added this explanation and reproduction steps to App Review Information. The corrected Mac build is 1.5.14 (37), including the latest tested features and removal of the separate Shot Shooting Order tab; regular Shot List and portable project compatibility are preserved. Please review this required local server functionality under guideline 2.4.5.

## Official references

- [Network server entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.network.server)
- [Apple entitlement key reference: network access and inheritance](https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/Chapters/EnablingAppSandbox.html)
- [App Review Guidelines 2.4.5](https://developer.apple.com/app-store/review/guidelines/#hardware-compatibility)
- [App Sandbox Information (temporary exception entitlements)](https://developer.apple.com/help/app-store-connect/reference/app-uploads/app-sandbox-information/)

Validation evidence and the final upload/selection/submission state are recorded separately in the final task handoff. Successful upload/processing or resubmission does not constitute Apple approval.

## Verified candidate and execution blocker

Implementation commit: `35460adcc911e8020f358074c468452702a430a7` (follow-up test/documentation commits may follow; production payload remains this implementation). Candidate output is under ignored `windows-src/build/store-review-20261023/`:

- `distribution/ProductionDesk.xcarchive`: universal arm64/x86_64 Apple Distribution archive, with matching main-app dSYM UUIDs.
- `export/Production Desk.pkg`: Mac Installer Distribution package, SHA-256 `8ac9bce096c22c063e175763cbf1950a0ded0077edffdd8f547fd3a96d33ce8c`.
- `package-verification.json`: all 79 signed native files, main and inherited helper entitlements, exact runtime resource/source/archive comparison, no Sparkle, no real workspace or migration source.
- `sandbox-runtime-result.json`, `sandbox-webkit.log`: corrected sandbox app plus separately sandbox-signed WebKit harness passed 62 named aggregate checks and native focus/save/import/reload checks. macOS ignored CFFIXED_USER_HOME for sandbox apps; the read-only preflight established a new unique QA container with no pre-existing workspace before UI launch. Only this unique QA identity was launched. Runtime listener was `127.0.0.1:53616`, confirmed by lsof; the port varies per launch.
- `protected-result.json`: SHA-256 and modification times unchanged for all 1,236 protected installed-app, stable/beta and Store-container data files.
- `python-tests.log`: 94 passed, one existing Windows pypdf skip. `node-tests.log`: 27 passed. `export-policy.log`: native origin/path/response/filename/size policy passed.
- `portable-independent-tests.log`: portable sender storage removed before clean recipient import; complete project fields, old filming order and PDFs survive roundtrip. Browser compatibility assertions also retain stale filming-order IDs through regular edits and exports.

Native save-panel interaction was not newly driven manually this turn. The signed sandbox suite verified export API/bytes/import and the native save policy was tested. Intel code was built/signed, while runtime checks ran on Apple Silicon. The updated standalone Chromium compatibility tool was syntax-checked; its shared assertions ran in native sandbox WebKit.

**Upload denied before execution.** Automatic approval review rejected the `xcodebuild -exportArchive` operation using `distribution/ExportOptions-upload.plist`, citing the original prepare-only restriction and not accepting the later delegated user authorization to upload. No upload process was started. Do not bypass or retry this denied operation without materially new relevant authorization evidence. The attempted parent-task message via the app tool failed with `thread not found`; this task's checkpoint/final response is the handoff channel.

App Store Connect was not mutated: Mac remains rejected 1.5.10 (31); no new build was selected, no review Notes/reply was saved/sent, and no resubmission occurred. No iOS/Scenic record, standalone artifact/feed, account security setting, signing credential, real project or installed app changed. Upload readiness is verified locally; processing, selection and resubmission remain blocked, and Apple approval is unknown.
