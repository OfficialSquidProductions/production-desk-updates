# iOS/iPad 1.5.19 (41) candidate

Existing app 6823682933, bundle `com.hosier.scheduler.ipad`, remains live at
1.5.14. The next candidate contains today's current-production script imports,
shot-size values and optional movement/descriptions in lined annotations,
renumber baselines, Settings backdrop dismissal and spacing changes.

Native validation found a platform-specific import bug: Foundation's JSON
bridge reuses empty NSArray instances, which WKWebView returns as aliased
JavaScript arrays. A scene insertion could then also insert schedule IDs into
scene records. `nativeAPI('/api/workspace')` now restores JSON tree semantics
before validation and editing. `structuredClone` alone would preserve aliases.
An actual native regression records `rawAliases=true`, `normalizedAliases=false`,
one valid scene and schedule ID, and unchanged production identity. A separate
Node regression covers the same aliased-input contract.

48 Node checks pass. Complete native suites pass 46 tests each on fresh iPhone
17 Pro and iPad Pro 13-inch M5 Simulators (iOS 26.5). These include script/Final
Draft/PDF import, scene tagging, schedules/shots, saved/reopened projects,
portable/PDF integrity, explicit renumber resets, four annotation setting
combinations, both Settings dialogs and preference persistence. Annotation
exports retain selectable original script text and use the existing raster
overlay: rendered pixels are checked with Vision OCR, including the final words
of a long description. PDFKit text extraction alone cannot inspect that overlay.

Five iPhone native UI tests pass: repeated inside/backdrop/X touch behavior for
both Settings dialogs; JSON/PDF share cancellation/reopening; portable Save As,
import and share cancellation; synthetic script editing and native Files save/
import; navigation-order changes and cold launch. Three matching iPad touch tests pass: repeated Settings backdrop/X/inside
behavior, synthetic script editing with a complete native Files save/import
round trip, and navigation-order/cold-launch persistence. The Files test was
slow because XCTest repeatedly waited for OS animation-idle notifications,
but it completed successfully; it is not counted as an unfinished check.
Tests explicitly seed independent fictional productions because script imports
now preserve the current production. Asynchronous test controllers are retained
through their checks; JSON comparisons use stable keys. Real user apps/projects
and Scenic's separate Simulators were not used.

`ios/artifacts/ProductionDesk-1.5.19-41-signed.xcarchive` archived successfully.
The exported IPA passed strict signatures, the existing FZ298DXLS3 distribution
profile, no get-task-allow, correct iPhone/iPad device families, exact comparisons
of all 239 Web resource files, system-only linkage, and no installer-scheme,
Sparkle/Python updater payload or incoming URL handler. IPA SHA-256:
`d67a3db18726079817c6330904d04a4d35e3ad422192bf3b95c59d34159eb85f`.
No signing/profile/account changes were made.

Publication blockers: automatic approval review rejected the App Store Connect
New Version > Create action for 1.5.19, citing the earlier App Store hold despite
the later delegated user instruction lifting it. The create action was denied;
no iOS binary upload or submission was attempted after that denial, and no
workaround was used. The existing live iOS listing remains unchanged. The
local, signed candidate is reviewable and ready for the remaining publication
steps once this denial is resolved. Automatic approval review separately denied
pushing the iOS changes/review evidence to remote main, citing the earlier
Mac-GitHub-only scope. That combined commit/push command did not execute; the
changes were then preserved in a local commit without a remote push. Neither
denied operation was retried or bypassed. Renewed human confirmation is needed
for iOS version creation, binary upload/submission and the main-branch source push. Preserve Free pricing, factual
privacy declarations, existing listing and automatic-after-approval behavior.

Evidence: `windows-src/build/store-20261101` (ignored local test artifacts).
The completed suites are `iphone-final.xcresult`, `iphone-touch.xcresult`,
`ipad-unit.xcresult` and `ipad-touch.xcresult`. Both disposable Simulators were
shut down after verification. No test remains running.
