# Mac 1.5.18 (49)

Scripts import into the active production. Matching scene numbers retain stable IDs, breakdown edits, shot links and schedule positions; new scenes enter each schedule's boneyard. Unmentioned scenes and older original-PDF revisions/annotations are retained. Complete `.productiondesk`, backup and USS imports continue to create independent productions. Script parsing, cancellation, prior-save and final atomic-save gates remain in place. Text imported after a PDF displays the new text without discarding older lining.

Lined information boxes always include Shot Size when present. Device Settings has independent camera-movement and shot-description checkboxes, off by default. Display and PDF export use the same field formatter and existing measured wrapping/page-expansion pipeline. Settings survive restart and do not modify production data.

Manual renumbering persists a per-scene baseline inside `_linedScript.numbering`. New linked shots and drawn coverage advance from it, preserving full numeric prefixes and skipping occupied identifiers. Undo/Redo and portable files include the baseline. Examples tested: 4.3 → 7.1 → 7.2 → 7.3, then 3.2 → 3.3 → 3.4; reopening proposes 3.5.

Validation uses synthetic workspaces, isolated Foundation homes and nonpersistent WebKit. The focused browser test captures four actual PDF exports and checks long-description contents and box bounds. The native Mac aggregate also exports the four PDFs, exercises the above controls, plus existing portable/CSV round trips, original pages, annotations, settings, navigation, schedules and shot editing. Backend: 105 total, 104 passed and one Windows-only skip. Shared Node suite: 48 passed. The standalone Windows updater test requires Windows dependencies and is outside this Mac release; no Windows build is requested.

Only the Developer ID direct-download Mac release may ship. Source commits carry `[skip ci]` to suppress the push-triggered Windows workflow; Windows metadata and App Store version/submissions remain unchanged. Native mobile adapters retain their platform-specific picker and PDF bridge. Shared changes are staged for later releases. The Python 3.14 Store runtime and private-API fixes are untouched; standalone Mac retains its existing runtime/launcher workflow.

Generated evidence lives under ignored `windows-src/build/mac-script-fixes/` and `windows-src/build/export-check/`. Final signing, notarization, public digests and live updater verification are recorded after publication.

## Signed Mac publication

Release: https://github.com/OfficialSquidProductions/production-desk-updates/releases/tag/macos-1.5.18-build-49

Source: `11a531a9cc66c829544cdfc8164229077ea967da`. The final packaged runtime passed 69 named native workflow checks and 48 shared JavaScript tests. Both app and sealed installer pass Developer ID, stapled notarization, Gatekeeper and distribution checks. The signed build47 → build49 installation test preserves synthetic workspaces, settings, backups and original PDFs. The sealed installer additionally passes fresh installation, update, unrelated-app, symlink and invalid-payload cases.

Mac updater ZIP SHA-256: `a430b9f17931e4236d00c644653f2e108ac99fc6d14027a3e37b742a001853d0`. Installer ZIP SHA-256: `5d1ef8e3aa34b463aca078d9d4e3b6c0725d4e29e678bcc397383ba2767b17cc`. Windows latest remains `windows-1.5.17-build-62`; its four asset digests and all Windows/App Store release metadata are preserved. No Windows workflow was triggered by either source commit. Public-download and real old-client updater checks are recorded under `build/mac-script-fixes/` after the feed deployment.
