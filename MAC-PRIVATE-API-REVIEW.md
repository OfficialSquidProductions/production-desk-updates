# Production Desk Mac private API correction — 2026-10-28

Based on `b60faee` from the clean `mac-store-review-dev` checkout, the authoritative
Mac App Store build 1.5.14 (37). This separate checkout does not merge the later
Windows release, picker change, or demo-removal work. Bundle ID remains
`com.hosier.scheduler.ipad`, team `FZ298DXLS3`, App Store Connect app `6823682933`.

## Diagnosis and correction

Apple's October 26 rejection of submission
`7d2a7d8a-ebdc-473e-a13f-b819742790db`, guideline 2.5.1, identified the bundled
Xcode Python 3.9 runtime. Both `_ssl` and `_hashlib` actually link
`/System/Library/PrivateFrameworks/TrustEvaluationAgent.framework/Versions/A/TrustEvaluationAgent`.
Unused `_tkinter` and `_lzma` extensions import all 86 Tcl/LZMA symbols in Apple's
list. The new recursive audit reproduces every finding on the rejected package.

Store packaging now requires the official Python Software Foundation universal2
Python 3.14.10 runtime, published October 25, 2026. Its installer is pinned to
SHA-256 `286c7018aa2730f6747ca433dccdc2b31be45f078a9ea0ffa44d5f06368fd2d7`.
The downloaded bytes match Python.org's checksum and macOS confirms the trusted
PSF installer signature, timestamp, and notarization. It is extracted into this
task's workspace; nothing is installed and package scripts/pip are not run.

The app uses plain loopback HTTP and SHA-256 PDF integrity, with no Python TLS
feature. The final runtime excludes the complete unused Tk/Tcl, LZMA and
SSL/OpenSSL components, including `_ssl`, `_hashlib`, `_hmac`, `libssl` and
`libcrypto`. Hashing remains available through Python's built-in `_sha2` implementation. Python code, dependency symbols and diagnostic strings are not
hidden or renamed. Dynamic library paths are relocated to the actual packaged
dependencies. Original Python license and installer dependency notices remain.
Every prepared file and symlink is checked against its source manifest.

The Store launcher uses the new interpreter. The standalone launcher, updater,
public feed, pricing, release setting and other platforms are unchanged.
Existing sandbox and inherited helper entitlements are retained; no new
certificate, account capability, profile or security exception was created.

## Initial candidate validation (superseded by the offline runtime and navigation update)

Evidence is under ignored `windows-src/build/private-api-review/`:

- `rejected-build-audit.json`: positive control, all 86 listed symbols detected
  and the two private SSL/hashlib links reproduced in rejected build 37.
- `local/binary-audit.json`: corrected signed QA app passes all 73 universal
  native-file scans. No rejected symbol, private framework, external dependency
  or missing bundled dependency. Both Apple Silicon and Intel slices inspected.
- `runtime-check.log`: signed sandbox/inherited Python and PDFKit extraction,
  local HTTP server/client, packaged editor, temporary workspace save/reload pass.
- `qa-storage.json`: actual Foundation storage resolves to a unique QA container.
- `python314-tests.log`: 95 backend tests run under packaged Python 3.14.10 and
  OpenSSL 3.5.9; 94 pass and one Windows-only PDF dependency check skips. The
  separate test launcher copies fixtures to temporary sandbox storage and runs
  the signed PDF helper from its bundle. No installed app or real project is used.
- `mac-node-tests.log`: 27 Mac/shared JavaScript regressions pass. An initial
  all-platform invocation additionally attempted the Windows updater test, which
  cannot load the absent Windows electron-updater installation; the Mac/shared
  set is complete and passes.
- `export-policy.log`: native export origin/frame, token path, filename,
  response status/size and bundle metadata checks pass.
- `protected-before-gui.json`: 1,236 installed-app and real project files
  fingerprinted before further app/GUI checks.

An initial test-only launcher setup copied into an existing tools directory and
failed. Its shell continued into the original disposable QA app. The exact QA
app/backend processes were identified and stopped, and the runner was corrected
to fail on setup/compile errors. The short launch used the separate QA container,
not the installed app or production container. Subsequent backend tests use a
Foundation-only launcher with no GUI.

Runtime checks ran on Apple Silicon. Intel binaries are compiled and audited;
an Intel runtime test has not been performed.

## Earlier submission checkpoint (superseded packages)

App Store replacement candidates are Mac 1.5.14 (38) and iPhone/iPad 1.5.14 (40).
Live App Store Connect inspection confirmed the current Mac build is 37 and the
current iOS build is 39; the proposed build numbers are available. Its profile/certificates match the
existing Production Desk Mac identity and are valid. The common standalone
release configuration remains at build 37; Store build number is an explicit
candidate override.

The distribution installer export succeeded and its expanded payload passed
the same 73-file/86-symbol audit, strict deep signature verification, exact
profile/main/helper entitlement checks and source/archive resource comparison.
Main app and PDF helper dSYMs match both architecture slices. Package is
`windows-src/build/private-api-review/export-candidate/Production Desk.pkg`,
24,400,574 bytes, SHA-256
`0811fc7cd790c4ec398c8a4a033bc8bfd138a257eec03401a64502bcc4be9477`.
`package-verification.json`, `package-signature.log` and
`exported-package-binary-audit.json` record these checks. The 1,236 protected
files remain unchanged since the pre-GUI snapshot (`protected-result.json`).

The first final-package sandbox WebKit/native aggregate passed before the user's
navigation update; it is being repeated against the final feature packages. The
GUI slot has been released to Script Call while source/CLI work continues. No
upload or resubmission has been attempted. The waiting iOS review item is intact.

## Custom navigation requested on October 28

The user requested the default order Main breakdown, Lined script, Shot list,
Shooting schedule, Reports, Elements, plus customizable ordering on Mac,
iPhone and iPad. Settings now offers accessible 44px Move up/Move down buttons
and Restore default order. Changes persist as a device preference rather than
project data, preserve every existing navigation button and the active editor,
and suppress unrelated editor redraws. Failed saves retain the confirmed order
and report an accessible error. Settings writes are serialized. Invalid saved
orders fall back to the six defaults; invalid backend writes are atomic.

The exact submitted iOS39 source was restored before the mobile changes, preserving
its native bridges and verified editor behavior. Shared navigation/settings code
is identical in desktop and mobile resources. The public source is separately
reconciled against GitHub's newer 1.5.16 (46) Mac release, so publishing the
requested website/direct-download update will preserve its later fixes and demo
removal. The uncommitted Windows-only picker work is not included.

CLI checks: 98 backend tests ran under the signed offline Python 3.14.10 runtime;
97 passed and one Windows-only dependency check skipped. 30 shared JavaScript
checks and 47 mobile web/data checks passed. New Mac and iOS runtime fixtures
cover relaunch persistence, save failures, active editor/draft preservation,
other settings/project invariance, touch target sizes and default restoration.
An XCUITest adds real touch ordering and cold-launch verification. The iOS app
and tests compile successfully (`ios/build-navigation`, no simulator launched).
Runtime/UI results and final archive/package hashes will be recorded after tests.

Proposed factual reviewer response, to update with the actual selected build:

> We replaced the Xcode Python 3.9 runtime in the Mac app with Python Software
> Foundation Python 3.14.10. We removed the complete unused SSL/OpenSSL, Tcl/Tk
> and LZMA components, including the four extensions identified in the rejection.
> SHA-256 PDF integrity uses Python's built-in hash implementation. No packaged
> binary links TrustEvaluationAgent or another private framework. We audited every native binary and both architecture
> slices in the final package against all the symbols and framework references
> listed in the October 26 guideline 2.5.1 rejection. The audit found none.
> The local server, script/PDF imports, project save/reload and exports were
> regression tested in an isolated sandbox. Please review the corrected Mac build.

Only post claims above after the final package and GUI checks support them.

Official runtime source: https://www.python.org/downloads/release/python-31410/

## Final reset-control package checkpoint

Product source commit `37d72c2` moves Restore default order beside the Navigation
tabs heading. The first real phone touch test proved that the former button below
six rows could lie outside the modal viewport. That run passed reordering and
cold-launch persistence but did not restore the default. The revised test checks
the actual first tab and a second cold launch, rather than a transient status.
The final phone/iPad touch and Mac packaged-runtime retests are still required.

The final Store packages have been rebuilt after this correction:

- Mac 1.5.14 (38): `export-final/Production Desk.pkg`, 18,660,710 bytes,
  SHA-256 `189367f244da23dba6fb4b50a2e8a2084e0ce7415aa815696f0db8b1eb748567`.
  Its expanded payload passes strict deep signatures, profile and entitlement
  checks, exact source/archive resource comparison, and the recursive audit of
  all 68 universal Mach-O files against all 86 rejected symbols and private
  framework references. See `final-package-verification.json` and
  `final-package-binary-audit.json` under the private-api-review build directory.
- iPhone/iPad 1.5.14 (40): `ios/artifacts/export-1.5.14-40-final/Production Desk.ipa`,
  3,319,709 bytes, SHA-256
  `15b9f2cb45448bed6430d91d78da09f1ff8df5abc999a60c46f79e230b531b39`.
  Signature, distribution profile, team, device families and all 246 web resource
  paths/bytes match the source. See `ios/build/ipa-40-final-verification.json`.

All 44 native iPhone workflow tests passed before the layout-only correction.
The final simulator test build succeeds with normal ad-hoc simulator signing.
The prior packaged Mac feature checks and manual mouse/keyboard, native Save As
success/cancel checks passed; the final layout is awaiting its packaged retest.
All 30 shared and 47 mobile JavaScript tests pass after the correction.

Public-source integration is separately committed at `c59551a`: Mac 1.5.16 (47),
preserving newer public-source changes and the Windows 1.5.16 (52) release.
Its standalone archive is built and Developer ID signed locally; 38 applicable
shared tests and 47 mobile web tests pass. The Windows updater test requires the
absent Windows electron-updater installation and is outside this Mac release's
local test set. No upload, notarization submission, App Store review replacement,
source push, release publication or website deployment has occurred at this
checkpoint. The existing waiting iOS review item remains unchanged.

## Final runtime gates and successful uploads

The final reset-header package passed the full signed sandbox/WebKit aggregate
(`header-sandbox-runtime-result.json`). All 1,237 protected installed-app and
real-data files retained their exact bytes and modification times. The final
iPhone touch test passed move/save/cold-launch, reset, and a second cold launch
with the defaults. The final iPad run passed all 44 native workflow tests and the
same touch/reset/relaunch test. Exported test screenshots were visually inspected.
A separate phone test proves the final Elements row responds to actual up/down
taps after a bounded scroll. Its initial full swipe overscrolled past the controls;
the bounded-drag test passes without a product code change.

Xcode confirms successful uploads of Mac 1.5.14 (38) and iOS 1.5.14 (40).
App Store Connect shows them processing with build IDs
`1e28f62c-9afd-4060-ad8c-41e3d17e8495` (Mac) and
`396ed4c7-cb35-4629-916a-630474c0d822` (iOS). Selection and resubmission have
not occurred while processing is pending. The Mac upload has optional missing
dSYM warnings for PSF runtime modules; main app and PDF-helper dSYMs match both
architecture slices. The upload itself succeeded.

The Mac version description and review notes were saved with the navigation
feature and factual guideline 2.5.1 correction/testing details. Automatic release
after approval remains selected. The existing waiting iOS39 review is unchanged.

Public source commit `10607afea7da7022047217f655cfd123906336fb` was fast-forwarded
to the official repository's main branch, preserving the Windows release version.
CI passed backend/shared tests and compilation and is finishing packaged Windows
validation. The public Mac47 archive also passes the actual packaged native
WebKit editor/export suite, including CSV parsing and portable project transfer
into fresh storage. Its notarization upload succeeded (submission
`86B1F326-8593-4872-BF17-1A99F4EE0509`); the exported app's ticket is still pending.
No public release, feed, download-link or website deployment has occurred yet.
