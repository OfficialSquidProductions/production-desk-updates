# Import after cancelling a file picker

Cancelling a native file picker dispatches a bubbling `cancel` event from its
`input[type=file]`. The import dialog's `oncancel` handler previously treated
that event as cancellation of the dialog. The dialog stayed open, but its import
session had `cancelled=true`.

The next submit set the button to `Saving current work…`, successfully flushed
the existing workspace, and returned at the cancelled-session check before any
import request. The cleanup intentionally leaves cancelled sessions alone, so
the button remained disabled. This explains the missing import POST and why
Unicode parsing, file paths and the save backend all passed independent tests.

The handler now acts only when `event.target` is the dialog itself. File-picker
cancellation leaves pasted text/file choice and the open session usable. Dialog
Escape/cancel and the guard against cancellation during the final atomic save
keep their existing behavior. No file formats, save policy or data migration
changed.

Validation:

- `node --test tests/import-cancellation.cjs`: eight regressions fail before the
  fix and pass afterward. Covers clean/dirty ASCII/Unicode, repeated picker
  cancellation, failed prior/final saves and retries, real dialog cancellation,
  late completion with a newer dialog, and cancellation during final commit.
- Windows CI's JavaScript command now includes these tests; its complete shared
  JavaScript selection passes all 43 tests.
- `python -m unittest discover -s tests -v`: 102 tests pass on Windows using the
  existing bundled pypdf 6.20.0 in an isolated test dependency directory.
- `desktop/windows/project-import-regressions.cjs` additionally dispatches real
  bubbling DOM events on the file input and exercises submit/save for all four
  clean/dirty ASCII/Unicode combinations.

The original final tested commit is `9a7ab7d297b5dbf2d25f35f67b8baf4b172d8289`.
[Windows CI run 40815229376](https://github.com/OfficialSquidProductions/production-desk-updates/actions/runs/40815229376)
passed the actual native Open-dialog/Escape tests and packaged, installed and
reinstalled smoke checks. Its picker helper runs only with `GITHUB_ACTIONS=true`,
matches the smoke window's owned dialog and sends Escape only when that picker
is foreground. It checks trusted cancellation before testing real clipboard
imports and existing-production preservation.

For publication, the patch is integrated onto current public main, retaining the
Mac navigation/runtime source and immutable signed downloads. Windows now reads
its own `desktop/windows/release.json` and changelog; version 1.5.17 does not
modify Mac 1.5.16 (47), its signed feed or the Apple submission sources. The final
CI run also exercises device tab ordering, failure handling, reset and renderer
reload in the Windows package. Publication requires the final integrated commit's
checks to pass. CI proves the tested Windows environment; local Code Integrity
acceptance on another PC is a separate result and has not been claimed.

The native regression complements the modeled DOM unit tests: the latter verify
session/save behavior without claiming to exercise an actual Windows picker.
