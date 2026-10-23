# Mac updater startup recovery

Base: public main `b22e527b50b1b017317ca1d3954ef303e15481a9`, including Mac build 37
and the subsequent iOS/Windows parity changes. This patch does not change release
versions, feeds, public keys, installed applications or user preferences.

## Reproduction and behavior

The original native `didFinish` handler checked `window.slateDesktop?.ready` only
once. If the bridge did not exist yet, it returned false and never started
Sparkle. A native WKWebView fixture using the unmodified source reproduces this:
the bridge becomes ready 450 ms later, the update menu stays disabled, and there
are zero feed requests. This verifies a concrete failure path consistent with the
reported symptom; it does not inspect private state in the user's running app.

Readiness observation now starts before the trusted local editor is loaded and
also accepts navigation completion notifications. Nonblocking probes recognize a
late bridge, a pending or replaced readiness promise, and transient JavaScript
errors. Probes are serialized, validate the local origin, and ignore callbacks
after observation stops. Termination stops observation. Failed updater starts
retry with delays growing from one to at most 30 seconds.

Check for Updates remains available before automatic startup. It initializes or
retries Sparkle and reports a manual initialization error through its user driver.
Initialization is marked complete only after success. Repeated initialization,
readiness notifications and check clicks cannot create overlapping sessions. A
manual check consumes the one launch check, including when the user cancels it;
another explicit check remains available. Automatic opt-out, dismissed-offer
suppression and the existing save-before-install gate remain in effect.

The App Store implementation remains distribution-managed and links no Sparkle.
The public feed/key configuration and Sparkle download verification are unchanged.

## Verification

Run from `windows-src/` on a Mac with the pinned, checksum-verified Sparkle cache:

```sh
python3 -B tools/check_updater_readiness.py --baseline b22e527b50b1b017317ca1d3954ef303e15481a9
python3 -B tools/check_macos_updates.py
python3 -B -m unittest discover -s tests -v
```

The native runner packages ad hoc QA apps with unique bundle identifiers. Before
each launch it verifies Foundation home/Application Support routing into
disposable directories. WebKit is nonpersistent, feeds are loopback synthetic
fixtures, and the QA apps contain no workspace backend. The update driver forbids
downloads/extraction/installation; the save-gate test uses a counter continuation.
No foreground UI control or installed-app launch is required. Temporary apps and
homes are removed on completion.

Verified on Apple Silicon, macOS 26.6.2:

- Original-source reproduction: editor eventually ready, updater unstarted.
- Ten readiness cases: late bridge, pending promise, missing navigation callback,
  rejected/replaced promise, JavaScript probe error, interrupted navigation,
  stop/restart with stale callback, initialization failure/retry, changed origin,
  and termination. Expected cases request exactly one feed; changed origin and
  termination request none.
- Real Sparkle sessions: equal/older/newer/incompatible feeds, offline/malformed
  feeds, automatic opt-out, Later suppression, explicit recheck, startup failure
  and retry, manual startup before readiness, burst clicks, reentrant startup,
  cancellation and subsequent check. No download or installer requests.
- Save gate: asynchronous save, failed-save protection, retry, concurrent clicks,
  duplicate callbacks and one-time install continuation.
- Actual App Store entry point compiled; policy fixture retains its disabled
  distribution-managed menu; both binaries link no Sparkle.
- Python regressions: 95 tests, one Windows PDF dependency skip.
- The unchanged public key validates the cached published 1.5.14 (36) archive;
  a modified archive and unrelated signing key are rejected by the existing
  CryptoKit signature checker.
- Optimized Intel standalone entry point cross-compiles for macOS 12.

Local raw evidence is in ignored `build/updater-startup-fix/` (`baseline.log`,
`baseline-reproduction.json`, `native-updates.log`, `readiness-regressions.json`,
`unit.log`, `store-updater.log`, `signature.log`, `intel-compile.log`).

Intel execution, Windows execution, a full signed/notarized installer upgrade and
real update installation are not tested by this patch. No public release, upload,
installation or Dock change was performed. A future authorized release must
integrate this commit, select valid platform versions/builds, run normal signed
packaging/release gates and verify the resulting updater offer in disposable QA.
