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

SSL and hashing remain available through bundled OpenSSL 3.5.9. The complete
unused Tk/Tcl frameworks, tkinter extension/package, and LZMA extension/module
are excluded. Python code, dependency symbols and diagnostic strings are not
hidden or renamed. Dynamic library paths are relocated to the actual packaged
dependencies. Original Python license and installer dependency notices remain.
Every prepared file and symlink is checked against its source manifest.

The Store launcher uses the new interpreter. The standalone launcher, updater,
public feed, pricing, release setting and other platforms are unchanged.
Existing sandbox and inherited helper entitlements are retained; no new
certificate, account capability, profile or security exception was created.

## Validation completed before GUI access

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

## Submission checkpoint

Distribution candidate is 1.5.14 (38), pending inspection of current App Store
Connect build availability before upload. Its profile/certificates match the
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

Shared GUI/browser access is pending the parent task's slot. Still required:
live ASC listing/version/build/release-setting verification, isolated final
packaged WebKit/native app checks,
upload, processing, build selection, factual review response and resubmission.
No upload or resubmission has occurred at this checkpoint.

Proposed factual reviewer response, to update with the actual selected build:

> We replaced the Xcode Python 3.9 runtime in the Mac app with Python Software
> Foundation Python 3.14.10. SSL and hashing now use the packaged OpenSSL 3.5.9
> libraries and no longer link TrustEvaluationAgent or another private framework.
> We removed the unused Tcl/Tk frameworks and tkinter extension, and the unused
> LZMA extension/module. We audited every native binary and both architecture
> slices in the final package against all the symbols and framework references
> listed in the October 26 guideline 2.5.1 rejection. The audit found none.
> The local server, script/PDF imports, project save/reload and exports were
> regression tested in an isolated sandbox. Please review the corrected Mac build.

Only post claims above after the final package and GUI checks support them.

Official runtime source: https://www.python.org/downloads/release/python-31410/
