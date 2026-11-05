# Production Desk application artwork

`ProductionDesk.png` is the exact 2048×2048 user-supplied app artwork, preserved
without cropping, redrawing or adding a frame. SHA-256:
`2b6fd2cbe192de93c65c1697b64e5e5c87d55c217bf08f113c81b37475b32273`.

- `desktop/Icon.swift` renders the complete Mac iconset, retaining transparency.
  Both standalone and Mac App Store builders use it.
- `tools/app_icon.py` creates the Windows executable/installer ICO with 16, 24,
  32, 48, 64, 128 and 256 pixel representations using the pinned Pillow dependency.
- `ios/scripts/generate-app-icon.swift` produces the 1024-pixel iPhone/iPad asset.
  It fills only transparent pixels with black to satisfy the App Store's opaque
  image requirement; Apple's operating system applies the final icon mask.

The separate `web/assets/sp-logo.png` remains the Squid Productions in-app logo.
Changing the application icon does not change bundle identifiers, project data,
storage locations, updater keys or existing releases.
