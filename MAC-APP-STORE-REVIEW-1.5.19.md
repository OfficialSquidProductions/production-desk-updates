# Mac App Store 1.5.19 (39) — November 1 remediation

Existing listing: 6823682933 (`com.hosier.scheduler.ipad`). Replaces rejected
1.5.14 (38), submission `7d2a7d8a-ebdc-473e-a13f-b819742790db`.

The actual November 1 review identifies Guideline 2.5.2 and `itms-services`.
The October 28 exported build contains that scheme only in bundled CPython
3.14.10 `urllib/parse.py`'s registered network-location schemes. The Store
launcher already restricts navigation to the active loopback origin and explicit
support email, and links `StoreUpdates.swift` rather than Sparkle.

Runtime preparation now applies the exact library hunk from CPython's official
[v3.14.10 App Store compliance patch](https://github.com/python/cpython/blob/v3.14.10/Mac/Resources/app-store-compliance.patch),
the change made by `--with-app-store-compliance`. The vendored patch SHA-256 is
`f56e472da7d14223ecab83a3bd62778978dbad3e35433c90310e5054dfdc7a64`.
It removes scheme handling without obfuscation. Complete prepared file/symlink
hashes and before/after parser hashes are recorded; the Store builder rejects
old manifests. Public GitHub runtime/updater preparation is unchanged.

The complete exported payload, including compressed archives and bytecode, is
now scanned for installer-scheme references, updater components/feed metadata,
and unexpected incoming URL handlers. Build 38 is a positive control: its exact
parser registry entry fails. Corrected build 39 passes 1,178 payload inspections.
The prior 68 universal binaries / 86 rejected private symbols audit also passes.
Python 3.14.10 and removal of unused OpenSSL/TLS, Tk/Tcl and LZMA remain intact.

The native delegate's existing URL rules are factored into a testable function.
Tests reject installer, remote HTTP/HTTPS, file, JavaScript, wrong-loopback-port,
localhost and unsolicited mail navigation. Active loopback editor/downloads and
explicitly clicked support email retain their intended paths. An executable
sandbox parent tests the exact exported Python bytes: scheme registration is
absent, installer requests fail, and local URL parsing and SHA-256 work. Direct
execution of a sandbox-inheriting child without its sandbox parent is invalid;
that preliminary invocation trapped and is not counted as a passing test.

The signed exported package passed strict deep signatures, exact entitlements,
provisioning, source/archive byte comparisons and the full native audit. A
unique development-signed clone passed the packaged editor aggregate, repeated
imports/renumbers, Settings dismissal/persistence and four actual annotation
PDF combinations, plus sandbox Python/PDFKit, loopback and save/reload. Native
NSSavePanel cancel/save produced a valid portable project retaining original
PDFs and shot numbers 7.1/7.2/3.2/3.3/3.4. The 1,238 protected installed-app and
real-data files retained identical hashes and modification times.

Only sandbox/server/client, user-selected-file and printing entitlements remain
on the parent; executable helpers inherit its sandbox. network.server is
required for the packaged backend's 127.0.0.1 ephemeral listener, not remote
sharing. No entitlement was indiscriminately removed.

Xcode reports upload success for 1.5.19 (39); App Store Connect independently
processed it as Ready to Submit, then accepted its resubmission. It is Waiting
for Review as of November 1, 2026, 3:11 PM local. Build UUID is
`1fafccc7-5903-495e-9c01-a06902ea07a4`; the existing submission ID is unchanged.
The receipt screenshot is `windows-src/build/store-20261101/mac-review-receipt.jpg`. Version, truthful current-feature description and
3,758-character remediation/reproduction notes were saved. Free pricing,
privacy declarations, existing release-after-approval setting, listings and
signing/account settings were preserved. Final submission receipt is recorded
in the ignored `windows-src/build/store-20261101` evidence when available.

Windows publication remains held until native Windows VM testing. Source
commits use `[skip ci]` because main-path pushes otherwise trigger its installer
publication workflow. This Store-only work does not alter the public Mac
1.5.19 (51) feed or immutable artifacts.

Final live verification: Apple completed review and **approved 1.5.19 (39)**.
The existing macOS listing now shows **1.5.19 Ready for Distribution** under
its unchanged automatic release setting. Approval receipt:
`windows-src/build/store-20261101/mac-review-approved.jpg`.
