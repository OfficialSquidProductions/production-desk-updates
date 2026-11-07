# Original Production Desk icon restoration

The pre-redesign SP assets are restored while preserving application behavior,
current project handling and update trust. The original Mac renderer and iOS
asset were recovered from `9c1f6b3f968a1285d0e7a56e9980498b6358026a`.
The iOS PNG's Git blob is `55a377c3e8aecdf7968b3981eaa4c2c27c7c4380`.
Both match the existing original assets on GitHub main at
`ea868baa08ab5b92a86eb15421f139202733a010`.

- Direct Mac and Mac App Store: red SP on the original rounded white tile.
- iPhone/iPad: byte-identical original opaque 1024px red-SP-on-white icon.
- Windows: original red SP on dark `(25,20,25)` background. Existing backend,
  shell, installer and uninstaller icon wiring is preserved.

The desk-and-lamp artwork and its iOS generator are removed from active build
inputs. Functional changes and the separate in-app SP logo are preserved.
The Windows publication hold and portable-fixture compatibility fix remain.
No release or history was deleted, and the old icon branch is not merged wholesale.

## Local verification on November 6, 2026

- 111 Python tests: 110 passed; one Windows-only PDF dependency check skipped.
  All five icon tests passed using the pinned Pillow 11.3.0 dependency.
- Native packaged Mac WebKit regression checks passed.
- Mac 1.5.21 (53) builds with the restored icon, providing a version newer than
  the published redesigned-icon Mac 1.5.20 (52).
- iPhone/iPad 1.5.21 (43) unsigned device archive succeeded with the original icon.
- Windows ICO regenerated with all seven required resolutions. No new native
  Windows installation or upgrade test is claimed; its shipping 1.5.19 icon
  already uses the original SP design.

## Distribution status on November 7, 2026

[Mac 1.5.21 (53)](https://github.com/OfficialSquidProductions/production-desk-updates/releases/tag/macos-1.5.21-build-53)
is published. Application and one-click installer both passed Developer ID
signatures, Apple notarization, stapled tickets, Gatekeeper and distribution
checks. The signed 1.5.20 (52) to 1.5.21 (53) upgrade retained synthetic projects,
preferences, backups and original PDFs. Installer fresh-install, upgrade,
symlink/unrelated-app protection and invalid-payload checks passed.

The signed update ZIP matches the existing trusted public key. Tampered bytes
and an unrelated signing key were rejected. GitHub's asset digests match the
verified local ZIPs. The new feed entry retains the prior signed builds 52 and
51; existing Windows download links and its publication hold are preserved.

- App ZIP SHA-256: `50529e89af6e25f2fc4802104c68b7f8764b9b82e1a33506c06c3758911d705b`
- Installer ZIP SHA-256: `8082c9136ae11b3b39582fea52331107c5bba9ab51951856c00bd036665d8f5c`

The earlier signing/notarization approval block was resolved by the user's
explicit November 7 approval. No signing identity, update key or provisioning
profile was replaced. Installed apps and 1,234 protected app/data/log/backup
files retain their hashes and modification times. No release was deleted.

App Store Connect is still signed out. Its current Mac Store review/release
status cannot be verified or changed without sign-in. The public iPhone/iPad
1.5.20 icon update was reported live; a new unsigned 1.5.21 (43) device archive
with the original icon is ready. It has not been signed, uploaded or submitted.
No Store build or installed TestFlight app was changed by this restoration.
