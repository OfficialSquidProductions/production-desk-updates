# Combined release prepared locally

Candidate: **Production Desk 1.5.12, Mac build 34**. Windows uses version 1.5.12 and its eventual workflow run number. This branch combines Lined Script controls and identity fixes, Shot List keyboard/scroll fixes, Schedule drag usability, full portable-project import and preview-storage safeguards. The published original-PDF/Main Breakdown commit `3552b21b29f7605bf92dbb12f19452d7ca507548` remains an ancestor.

GitHub read-only inspection: `main` is `fda5fc347dc406b4fec0c9d90ff304de660b2e52`; latest releases are `macos-1.5.11-build-33` and `windows-1.5.11-build-36`, both targeting `3552b21`. Local Mac and Windows manifests and lockfile match 1.5.12. Release notes cover all combined changes. Public download links and hosted appcast files remain unchanged.

**Distribution hold:** public artifact/feed publication was denied before execution; explicit approval remains pending. The existing Windows workflow publishes automatically for a newer version pushed to `main`. No push to `main`, workflow dispatch, tag, release upload or update-feed activation is performed during this local preparation. The user's general request to update GitHub is recorded, but this continuation limits the current step to local preparation, read-only remote inspection and checks.

Use [Start Packaged Combined Release Preview.command](Start%20Packaged%20Combined%20Release%20Preview.command) for disposable local QA. It verifies disabled updates and dedicated storage paths before launch. Installed Production Desk and real user data must remain unchanged.

Final test evidence is recorded after local checks under ignored `windows-src/build/combined-release-review/`. App Store/TestFlight changes and installed-app replacement remain out of scope. Windows packaged execution requires an available Windows environment; signed/notarized public distribution is a separate pending gate.
