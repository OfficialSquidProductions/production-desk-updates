> Historical icon-design candidate. Superseded by the original-icon restoration; see ORIGINAL-ICON-RESTORATION.md. The records below describe the earlier candidate and are not current publication instructions.

# Production Desk 1.5.20 universal icon candidate

The app icon now uses the supplied Production Desk artwork on Windows, direct
macOS downloads, iPhone, iPad and Mac App Store builds. The original 2048-pixel
PNG is preserved in `windows-src/desktop/assets/ProductionDesk.png`; the source
hash and deterministic platform generators are documented beside it. macOS
and Windows retain transparent corners. iOS uses an opaque 1024-pixel derivative
for Apple's asset catalog and system icon masking.

Bundle identifiers, updater trust, installation locations and project storage
are unchanged. No project migration or release-history deletion is included.
The separate Squid Productions in-app logo is unchanged.

## Prepared versions

- Standalone Mac: 1.5.20 (52), Apple Silicon.
- Windows source candidate: 1.5.20. Offline backend/runtime validation passed.
  Shipping installer, shell icon and installed upgrade validation remain blocked;
  earlier release holds remain in force.
- iPhone/iPad: 1.5.20 (42), signed App Store archive and IPA exported locally.
- Mac App Store: 1.5.20 (40), signed universal arm64/x86_64 archive and PKG
  exported locally, using the existing compliant Python runtime and profiles.

## Verification on November 5, 2026

- 111 Python tests completed: 110 passed, Windows-only PDF dependency test skipped.
- 63 shared web/updater JavaScript tests passed, with pinned electron-updater 6.8.9.
- 48 iOS web tests passed. iOS device archive, IPA export and Simulator build
  succeeded. iPhone/iPad compiled icon pixels were inspected. No new Simulator
  runtime or physical-device test is claimed.
- Native Mac packaged WebKit checks passed all 73 named workflows.
- Native Mac updater save, readiness, startup and Store-disabled-update checks passed.
- All five new icon tests passed with pinned Pillow 11.3.0, including seven ICO
  representations and byte-exact decoded 256-pixel artwork comparison.
- Standalone Mac and Mac Store packaged ICNS files are byte-identical; decoded
  platform icons were visually inspected against the supplied image.
- Mac Store binary audit passed: 68 universal native files, 86 rejected symbols absent.
  Signed PKG export succeeded; no new signing identity or profile was created.

## Windows offline validation

On the owner Windows VM, the source archive and canonical PNG were hash-verified.
The isolated build used pinned PyInstaller 6.22.3, Pillow 11.3.0 and pypdf 6.20.0.
All 114 Python tests, 14 Windows updater tests and 91 packaged-runtime smoke
checks passed. Two PDF exports retained original text, rotation and page bounds.
All seven backend EXE icon images byte-match the generated ICO. Existing apps,
QA profiles and real user data were left untouched.

The runtime-only Electron stage deliberately disabled executable resource
editing and is not a shipping installer. Its shell icon does not prove the
shipping icon. Fresh installation, installed shortcuts/taskbar icons and upgrade
validation remain unperformed because required official RCEdit/winCodeSign,
NSIS/resources and 7zip toolsets are absent and GitHub access is policy-blocked.
No restricted dependency download or alternate route was attempted.

`tools/build_demo.py` now writes UTF-8 with LF explicitly through `Path.open`,
retaining Python 3.9 support and byte-identical generated fixtures. The exact
Windows-tested patch was synchronized back to the Mac and its four fixture
checks plus nine Windows release-gate tests passed under the Mac system Python.
This changes fixture-generation tooling, not application behavior or bundled
user data. Full Windows logs remain in the isolated VM QA workspace; their
results and artifact fingerprints are recorded in the local build receipt.

Offline validation fingerprints (SHA-256; not release downloads):

- Backend EXE: `59044bc22c3e3960172e1545893ea69cdeb18a0997adf7ad47da7432a9a9dca8`
- ICO: `f4c58adf1a2c7ccfaab81f94f4c142878c08fc6c3ad26aae11877358e064c382`
- Runtime shell: `d20c4a1d6ccb5fb35bf8622860386a7631a0e04c56a1fc27f56b2494c20e62d4`
- Runtime app.asar: `46c0d9ddf69f601caf2fcb8cf86551c23ed47c7022477d518f637847b8c1f08e`
- Fixture generator: `dd23c9f24a58a3bae47a0fb06fd90b0e18be13568c702b75cb48e365c2bcd84d`

## Publication status

GitHub downloads and updater feeds have not been changed. GitHub shell access
was blocked by the execution environment's network policy, not a GitHub
authentication failure. Final Windows installer validation is pending; its
release hold remains.

Both Apple editions were confirmed at 1.5.19, Ready for Distribution and Review
Completed, with no pending review before creating the icon-only versions.
The new signed builds were uploaded successfully, processed by Apple and
visually checked in App Store Connect. Both were submitted on November 5:

- macOS 1.5.20 (40): Waiting for Review at submission, 16:38 UTC.
  [Submission receipt](https://appstoreconnect.apple.com/apps/6823682933/distribution/reviewsubmissions/details/88e18b29-526e-4040-9997-56fbf3a7a5c6).
- iOS/iPadOS 1.5.20 (42): Waiting for Review at submission, 16:40 UTC.
  [Submission receipt](https://appstoreconnect.apple.com/apps/6823682933/distribution/reviewsubmissions/details/a24ffae4-50e9-468a-9f74-05259383e829).

The inherited automatic release after approval, screenshots, pricing, privacy,
ratings and unrelated metadata were retained. Release/reviewer notes describe
only the icon change and distinguish new validation from the prior release's
functional evidence. Store availability has not been rechecked since submission. Mac upload
reported missing optional Python-extension dSYM warnings; the package upload
itself succeeded and the build was accepted for review.

The direct Mac app and sealed installer both passed Developer ID signatures,
stapled notarization, Gatekeeper and distribution checks. The shipping install
engine passed a signed 1.5.19 (51) → 1.5.20 (52) upgrade with byte-identical
synthetic projects, settings, portable backups and original PDFs. The sealed
installer passed fresh installation, upgrade, data preservation, unrelated-app
and symlink protection, and invalid-payload rejection. The new local Sparkle
feed signature passed with the existing trusted public key; modified archives
and unrelated keys were rejected. Live feed/download verification is pending
publication and is not claimed.

The Windows release gate has `publication_hold: true`. Push and manual workflows
can validate the candidate but cannot publish it until owner-VM validation is
complete and the hold is explicitly removed. This prevents later unrelated
commits from accidentally releasing the unvalidated candidate.

Prepared immutable archive checksums (SHA-256):

- Mac app ZIP: `7c12af7b9cda0d159454af94e87a2370f7ebcbc5990882bfabb9d753a43def6f`
- Mac installer ZIP: `25f3ddb3ca49c40de110ce753d86937067c7bacbb0d71c738c9960f7fd976c02`
- iOS IPA: `d5d1f0759ce18e6b839aa62ac12d744a5684f46f297fe8598e0dd91fdcb34b19`
- Mac Store PKG: `5b027e1b01678875bf4ed0ac6e84a86f2e35bd83454cc04cd728abf8288a6ee5`

The exported IPA and expanded Mac Store PKG passed strict code signatures,
exact version/build and bundle-identity checks. The IPA declares both iPhone
and iPad families; the exported Store PKG icon matches the notarized Mac app.
No private signing material or provisioning profile was committed.
