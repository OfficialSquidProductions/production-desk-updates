# Production Desk for iPhone and iPad

Open `ProductionDesk.xcodeproj`, scheme `ProductionDesk`. The app supports iOS/iPadOS 17+ and retains bundle ID `com.hosier.scheduler.ipad` and the v1 local workspace store. Version 1.5.14 (39) ports the tested Mac build 37 editor improvements: continuous original-PDF reading, lined-script tools and keyboard preferences, gutter information labels and exports, focused undo/redo, shot-list navigation/deletion, schedule placement feedback, and atomic imports. Native Files, AirDrop/sharing, iPhone touch targets and iPad portrait panes remain platform-specific. The separate Shot Shooting Order view is absent; saved `_shotShootingOrder` data, including stale IDs, is preserved as opaque compatibility data.

The UIKit/WKWebView shell bundles its editor and PDF engines for offline use. `ProductionDesk/Web/project-file.js` is shared with `../windows-src/web/project-file.js`; keep the implementations identical. Native Files, sharing and document opening live in `NativeFiles.swift`, `DeskViewController.swift` and `AppDelegate.swift`.

Run web checks with `node --test scripts/test-web.mjs` (47 checks). Run the native/unit/UI suite with `xcodebuild -project ProductionDesk.xcodeproj -scheme ProductionDesk -destination 'platform=iOS Simulator,name=iPad mini (A17 Pro)' CODE_SIGNING_ALLOWED=NO test`. UI tests use fictional productions.

For distribution, use the existing team and matching app-specific profile. `scripts/archive-distribution.sh` prepares a signed archive; export/upload options permit App Store review (not internal-TestFlight-only) and do not auto-increment versions. Review current App Store Connect build numbers before each release. Credentials and profiles are never stored in this repository.

See [portable project format](PORTABLE-PROJECTS.md) for compatibility and limits. Physical Files providers, AirDrop and large-production memory usage remain physical-device QA items.

Temporary TestFlight demo: **Load The Last Light demo** adds or reopens the separate fictional eight-scene *The Last Light* production without replacing existing work. See [demo content and removal](DEMO-CONTENT.md).

See [iOS 1.5.14 review evidence](IOS-APP-STORE-REVIEW-1.5.14.md) for package identity, test results, limitations and submission receipt.
