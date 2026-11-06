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
- iPhone/iPad 1.5.20 (43) unsigned device archive succeeded with the original icon.
- Windows ICO regenerated with all seven required resolutions. No new native
  Windows installation or upgrade test is claimed; its shipping 1.5.19 icon
  already uses the original SP design.

## Distribution status

No new release, updater-feed change, Store upload or installed-app replacement
has been performed by this restoration yet. The Mac build is local/ad-hoc only.
Automatic approval review blocked Developer ID signing and notarization until
the user explicitly approves that submission. App Store Connect's session
expired while inspecting the previously pending Mac/iOS 1.5.20 reviews; sign-in
is required before their live status can be refreshed or either review changed.

The existing Apple review records and current public downloads are preserved.
The GitHub source update is tracked separately from artifact publication.
