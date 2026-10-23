# Windows 1.5.15 build 44 publication

Published October 23, 2026 from source `2659993c76f48c03f4506c23f563af4838a0ce41`, based on remote main `b60faee5c260376f770dfceb3397d685ba7f1c5d` and the verified Mac editor baseline `906a498f295f8feba1182e1d4e2051411e188ad9`.

- [Windows release and downloads](https://github.com/OfficialSquidProductions/production-desk-updates/releases/tag/windows-1.5.15-build-44)
- [Real Windows CI run 39952628138 / run number 44](https://github.com/OfficialSquidProductions/production-desk-updates/actions/runs/39952628138)
- [Windows updater feed](https://github.com/OfficialSquidProductions/production-desk-updates/releases/latest/download/latest.yml)
- [Product website](https://productiondesk.squidproductions.org/) and [download website](https://updates.squidproductions.org/)

The Windows version advances from 1.5.14 to 1.5.15 because both the release gate and electron-updater require a strictly newer semantic version. Rebuilding 1.5.14 with a different workflow build number would not offer an update to existing 1.5.14 installations. The Mac public feed and artifacts remain 1.5.14 build 37.

## Changes

The Windows editor now uses the current shared editor with the separate Shot Shooting Order navigation and route removed. The regular Shot List remains editable and supports reorder, Undo/Redo, filters and reports. Saved `_shotShootingOrder` data, including stale IDs from older clients, remains opaque and survives editing and portable export/import unchanged. Stale help text advertising the removed tab was removed.

The Windows packaged smoke check was updated to open the five supported main views, rather than trying to click the removed tab. It continues to execute `desktop/windows/shot-order-regressions.cjs`, which verifies tab absence, regular Shot List behavior, and unchanged retired data through save and recipient import. Its real updater comparison now starts from the previous public Windows version, 1.5.14.

## Validation

The workflow completed successfully on a real GitHub-hosted Windows Server 2025 x64 runner with Python 3.12 and Node 22:

- 98 Python backend tests passed, including portable transfer from deleted sender storage into a clean recipient directory.
- 27 shared JavaScript tests and 14 desktop updater tests passed.
- The complete offline NSIS installer built with the pinned dependencies.
- 89 runtime checks passed in each of the unpacked application, silently installed copy, and reinstalled copy.
- Installation and reinstallation preserved the isolated workspace hashes. The installed application included its Python backend and ran successfully.
- Runtime checks covered PDF/FDX imports, original-script rendering, lined PDF/gutter exports, schedule dragging, large shot lists, Save As/import, backup restoration, failed-save gates, retired-tab compatibility, and preserved project relationships.
- Windows screenshot artifacts were inspected: regular Shot List is present, and the removed separate tab is absent.

Verification artifact `12500644258` (`windows-verification`) has SHA-256 `e435f60c44f0d4c17bb811d9e545ec1cdbb6ee2b8f6442c5b61d3d570831e9dd`.

The live public feed was then read using electron-updater 6.8.9's real NSIS generic provider and the actual 1.5.14 client update-policy source from `c7b09a4050e8cd42c08d2892e9bed04dc79e6c82`. It offered 1.5.15 with the published changelog and **Install Update / Later** buttons. This read-only check made one live metadata request and initiated zero updater downloads or installations. It ran on macOS with the Windows platform/version adapter; real installer execution was independently tested by Windows CI.

## Served artifact verification

All four assets were downloaded from the new version-specific public release and matched their GitHub API SHA-256 digests and sizes. The EXE also matched the published checksum file, generated CI installer report, and live updater feed SHA-512. The generic latest feed matched the version-specific feed byte for byte.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `Production-Desk-Windows-Setup.exe` | 126335344 | `3703893547115ef0fb21a28f471ff6252a8b4bc718a6dc728ca5cccf09056055` |
| `Production-Desk-Windows-Setup.exe.blockmap` | 133246 | `c95b5e66b455c90903d854ca4cce823ce379a2ac06a22d4e380769871d259199` |
| `latest.yml` | 1206 | `cfa6391fbc15451b9bad848e58641070677770c9059386e7f3c068b14630fed9` |
| `Production-Desk-Windows-Setup.sha256` | 101 | `114a0d44c6c0d811d86503c5ebbc4ded432e6fc7f62a1b30084b991f485f8e1b` |

Installer SHA-512 (base64): `ILWngY9EG9F5rYKh56YkKWdBaQPmzor9kjOmQoklfI2jAz1QS/PofeL4rBxadEKwOskPKk1UKhyFvCc4NRiXsw==`.

## Publication and preservation

The new tag is `windows-1.5.15-build-44`; GitHub's latest release pointer and Windows generic updater feed select it. No prior release or asset was overwritten. Website source commit `9a7abdd7ec8fb3f37ec2e22bbf86b684b773e29f` in `fr0nkle/productiondesk` changes only Windows links and adds the Windows version and checksum link. The release repository's root download page and README likewise point to the version-specific Windows asset.

The Mac build 37 appcast, archives, installer, checksums, prior release notes, Mac download links and website Mac-feed script are unchanged. The served Mac appcast was verified byte-identical to the baseline and still selects build 37. Existing project data, installed applications, other working directories, and App Store records were not modified by this task.

Local evidence is retained in the isolated checkout under `windows-src/build/release-1.5.15-44/`, including `public-artifacts.json`, `old-version-offer.json`, `ci-jobs.json`, `ci-job.log`, all downloaded release assets, and extracted Windows verification reports/screenshots.

## Limits

The Windows build is unsigned and has no Authenticode publisher certificate; Windows may show a SmartScreen prompt. The tested Windows environment was a CI Windows Server 2025 x64 runner; no physical Windows 10/11 machine was available. The installer was installed and reinstalled, but a full 1.5.14-to-1.5.15 NSIS installation through an interactive old app was not performed. The older client's real live-feed offer and the new installer were verified separately.

GitHub reports `immutable: false` for the new release. It has a new unique tag and untouched version-specific assets, but GitHub-enforced release immutability is not enabled. Enabling it requires changing the repository's release security settings, which this task was instructed to preserve. See [GitHub's immutable-release documentation](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases). No security setting was changed.
