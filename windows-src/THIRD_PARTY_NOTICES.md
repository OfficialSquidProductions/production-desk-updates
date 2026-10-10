# Third-party notices

Production Desk source written by Squid Productions is licensed under MIT.
Dependencies, platform SDKs, and standards retain their respective licenses;
the repository's MIT license does not relicense them. Squid Productions names
and logos are trademarks of their owner. No trademark rights are granted.

## Runtime and build dependencies

- Python: [Python license](https://docs.python.org/3/license.html).
  Packaged Mac builds retain the Python framework's license files.
- Sparkle: [Sparkle license and bundled notices](https://github.com/sparkle-project/Sparkle/blob/2.10.0/LICENSE).
  The Mac builder includes `Sparkle-LICENSE.txt` in the app. The framework is fetched
  from its official release and checksum-verified; it is not vendored in source.
- Electron and Chromium: [Electron licensing](https://github.com/electron/electron/blob/main/LICENSE).
  Preserve the license and third-party notices included in Electron distributions.
- electron-updater, electron-builder, pypdf, PyInstaller, Pillow, and their dependencies
  retain the licenses in their pinned dependency distributions. Windows dependency
  versions are recorded in `desktop/windows/package-lock.json` and `requirements-build.txt`
  within the desktop source directory.
- Apple frameworks and Xcode are supplied separately by Apple under their own terms.

## Data formats and optional fonts

Production Desk implements the [Universal Schedule Standard](https://github.com/UniversalScheduleStandard/UniversalScheduleStandard)
and [Universal Category Identification](https://github.com/UniversalScheduleStandard/UniversalCategoryIdentification).
Their specification documents remain licensed by their authors under CC BY-ND 4.0;
this repository does not redistribute modified specification documents.

Optional Adobe Reross and Final Draft fonts are loaded only from a user's own installation.
They are not included in this repository. System and Courier fallbacks support use without them.
