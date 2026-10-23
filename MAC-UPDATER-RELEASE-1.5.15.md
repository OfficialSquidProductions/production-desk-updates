# Standalone Mac updater recovery — 1.5.15 (45)

Release source: `d97ad860b856df61305757d5feb6aca38519bae0`, including tested fix
`d9bf6c810ea26bfcbd3b7eedda1dca62e630fa87` and public main
`b22e527b50b1b017317ca1d3954ef303e15481a9`. No later source changes were discarded.
This release changes the standalone Mac updater startup behavior. Windows remains
1.5.15 (44); iPhone/iPad, App Store and TestFlight submissions are unchanged.

The native updater recognizes late editor readiness independently of navigation
completion. Manual checks initialize/retry it, failed starts remain retryable,
and repeated callbacks/clicks cannot create concurrent update sessions. Existing
opt-out, Later suppression, signed download verification and save-before-install
protections remain intact. See [implementation verification](windows-src/UPDATER-STARTUP-FIX.md).

## Release verification

- Mac app and sealed installer: existing Developer ID identity, hardened runtime,
  Apple notarization/stapling, strict code-sign, Gatekeeper and distribution checks.
- App ZIP SHA-256: `f047546099cc34d04e8193ea82e2086b48d39ea910ebe8417139b1bf6e178bcc`.
- Installer ZIP SHA-256: `d655cbfaea65143609d8166c4f1d4f019c7a22c8943bcaf46369a3959b4dbe1b`.
- Sparkle signature validated against the unchanged embedded public key. Tampered
  archive bytes and an unrelated signing key were rejected.
- Native readiness, initialization error/retry, repeated/interrupted checks,
  cancellation, save gate and App Store/no-Sparkle checks passed.
- 95 Python tests (one Windows PDF dependency skip), 27 JavaScript tests, and the
  bundled Python suite passed. The final signed runtime passed 62 aggregate
  WebKit checks plus native save/import/reload/PDF checks. PDF rendering required
  a visible disposable QA window; assertions were unchanged.
- The unchanged shipping installer engine upgraded a disposable signed build 37
  to signed build 45, preserving synthetic project, settings and original PDFs.
  Sealed-installer self-tests passed fresh install/update and invalid-target guards.
- [Exact-source Windows CI](https://github.com/OfficialSquidProductions/production-desk-updates/actions/runs/40035682265)
  passed packaged installation and upgrade preservation. The same Windows version
  made this validation-only; the existing Windows release remains latest.
- Before user installation, all 3,374 protected app/data fingerprints remained
  unchanged across isolated QA. No real project was used for release testing.

Release artifacts are prepared for the existing signed feed and download pages.
Fresh public download, feed, old-version offer and actual desktop-install results
are recorded after publication. Local raw evidence is in ignored
`windows-src/build/release-1.5.15-45/`.

This package supports Apple Silicon on macOS 12 or later. Intel execution is not
claimed. The App Store package is a separate channel and is not replaced.
