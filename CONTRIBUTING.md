# Contributing to Production Desk

Production Desk is free and open source under the [MIT license](LICENSE).
Issues and pull requests are welcome. Include the operating system, app version,
steps to reproduce, and expected versus actual behavior in bug reports.

## Source layout

- `windows-src/` contains the shared desktop app and both Mac and Windows build tools.
  The directory keeps its original name for compatibility with the release workflow.
- `ios/` contains the native iPhone/iPad app, its bundled web interface, and tests.
- Files at the repository root host the existing Mac update feed and download page.
  The main download website is maintained in [fr0nkle/productiondesk](https://github.com/fr0nkle/productiondesk).

## Development

Use a feature branch and synthetic productions. See
[desktop setup](windows-src/README.md), [Windows build instructions](windows-src/desktop/windows/README.md),
and [iOS setup](ios/README.md). Run the existing tests for each affected platform.
Preserve existing project formats, portable backups, offline operation, and
save-before-update behavior. Keep native bridge validation and local-origin checks intact.

Do not commit private scripts, user workspaces, backups, proprietary fonts,
credentials, signing keys, certificates, provisioning profiles, caches, or build output.
Keep public bug reports free of private production content. Report sensitive security
issues privately to alexanderhosier@squidproductions.org.

## Distribution

Maintainers publish official releases. Forks must use their own application identifiers,
update hosting, and signing keys before distributing modified builds. Do not present
modified downloads as official Squid Productions releases. Names and logos remain
trademarks of their owner; the MIT license does not grant trademark rights.
Third-party components retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
