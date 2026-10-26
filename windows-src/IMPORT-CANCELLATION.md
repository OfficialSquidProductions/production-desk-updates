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
  clean/dirty ASCII/Unicode combinations. Native preview execution is pending
  a coordinated desktop slot; no release or installed app has been updated.

The native regression complements the modeled DOM unit tests: the latter verify
session/save behavior without claiming to exercise an actual Windows picker.
