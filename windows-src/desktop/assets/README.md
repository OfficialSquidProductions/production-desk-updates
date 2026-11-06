# Original Production Desk application icons

The original SP monogram is restored from the pre-redesign source at
`9c1f6b3f968a1285d0e7a56e9980498b6358026a`.

- Mac and Mac App Store use the original `desktop/Icon.swift` renderer with
  `web/assets/sp-logo.png`: proportionate red SP on a rounded white tile.
- iPhone and iPad use the byte-identical original 1024px opaque AppIcon.png,
  Git blob `55a377c3e8aecdf7968b3981eaa4c2c27c7c4380`. Archive scripts retain it.
- Windows uses the original red SP composition on its dark (25,20,25) backdrop,
  with seven ICO representations. The application, installer and backend share it.

The desk-and-lamp artwork is removed from active packaging inputs. In-app
branding, bundle identities, project storage and updater trust are unchanged.
