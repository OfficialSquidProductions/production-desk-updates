# Portable Production Desk projects

## User flow

Choose a production, then **Save As…** in the main header. On iOS this opens the native Files destination picker; on the Mac/Windows host it uses the existing native save dialog. The selected production becomes one `.productiondesk` file. On iOS, **Export → Share project…** sends the same complete file through the anchored system share sheet. Transfer it by AirDrop, Files/iCloud, email, or another sharing app.

Recipients choose **Import…**, then **Browse Files…** on iOS or the file input on desktop. iOS also registers the file type and accepts opening a project directly from Files, including a cold launch. Import adds a separate production. It preserves existing projects and history; duplicate project IDs are remapped with scene/schedule/shot/annotation links retained, and duplicate names receive an `imported copy` suffix. No imported production silently replaces another.

A recipient needs a Production Desk build containing this feature. Versions before 1.5.4 do not understand the new extension. **Full Production Desk backup (.json)** remains available for all productions and legacy interchange. The breakdown sharing export is now **Scene breakdowns (.csv)**. Older USS files remain importable; CSV is a spreadsheet report, not a replacement for the lossless project format.

## Format contract

UTF-8 JSON, extension `.productiondesk`, MIME `application/vnd.productiondesk.project+json`, UTI `org.squidproductions.productiondesk.project` conforming to `public.json`:

```json
{
  "format": "org.squidproductions.productiondesk.project",
  "formatVersion": 1,
  "workspace": {
    "version": 1,
    "activeProject": "<production ID>",
    "projects": ["<one complete production object>"],
    "_pdfDocuments": {"<SHA-256>": "<base64 original PDF bytes>"}
  }
}
```

The actual `projects` entry is the existing production object, without field filtering. It retains production metadata, categories/elements and availability, all scene text and breakdown fields, all schedule scenarios/calendars/boards, shots/takes/timing, strip colors, every original PDF revision and editable annotation, and custom extension fields. `_sourceScript: {filename, text}` retains newly imported non-PDF script/Final Draft source. Existing saves retain all scene text they already contain; original non-PDF files never retained by old builds cannot be reconstructed.

This reuses the existing v1 workspace and full-backup PDF machinery. Original PDFs are embedded, checksum verified and stored immutably by SHA-256. No asset is loaded from a sender's machine-local path. Project contents are parsed as data; source scripts and arbitrary custom fields are never evaluated as code or instructions. The PDF renderer retains `isEvalSupported:false`.

Limits remain 40 MB per script/PDF, 40 MB of workspace data, and 200 MB per complete project/backup (including base64 overhead). A portable project must contain exactly one production and every referenced original PDF, even if the destination happens to have a matching local copy. Future format versions, invalid relationships, missing/tampered PDFs, malformed/empty files and capacity failures report errors. Native picker/share cancellation returns without reporting a successful save or changing the production. Original workspace/previous-save recovery is unchanged. Imports may retain immutable PDF blobs even if a later workspace-capacity check fails; current project data stays intact.

## Supported builds

Production Desk 1.5.4 adds this format on iOS/iPadOS 17+ (iPhone and iPad), macOS 12+ (Apple Silicon), and Windows. Legacy JSON and USS imports remain available. Physical-device sharing providers and heavy production memory behavior require device QA.

## Breakdown CSV and complete-session audit

**Export → Scene breakdowns (.csv)** exports every scene and banner in breakdown
order, including unscheduled scenes and scenes hidden by a view filter. Columns
include production, stable breakdown ID, type, scene number, script page, decimal
pages, estimated minutes, synopsis, comments and banner text. Every configured
category gets its own labeled column, including cast and custom departments; cell
values contain the scene's tagged element names, separated by line breaks. Empty
categories and scenes without tags remain represented. Duplicate category names
receive distinct column labels.

This is real UTF-8 CSV with a BOM for spreadsheet Unicode detection, CRLF records,
quoted cells and doubled embedded quotes. Commas, quotes and line breaks are
retained. Formula-like text receives a leading apostrophe so spreadsheet apps
keep it as text. Schedule CSV and Shot List CSV remain separate existing exports.
CSV does not carry editable PDF annotations or restore a production; use
`.productiondesk` for a complete handoff.

The `.productiondesk` v1 format is unchanged. The selected production includes:

| Content | Retained data |
| --- | --- |
| Breakdown and tags | Every scene/banner field, script text, comments, review/completion state, strip colors, category definitions and the exact scene-to-element ID associations |
| Elements and cast | Names, IDs/board IDs, categories, linked elements, availability, events and other element fields |
| Original scripts | Retained Fountain/TXT/Final Draft source text/XML and filename; every attached original PDF revision as checksum-verified embedded bytes |
| Lined script | Active revision, all tools/marks, linked and unlinked coverage details, page/document coordinates, notes and left/right gutter label positions |
| Shots | Canonical IDs/order, scene links, setup/camera details, estimates, takes, circled takes, status, actual times and notes; retired filming-order data remains intact |
| Schedules | Every scenario, board/day group, unscheduled board, calendar, date and day-off/event relationship |
| Project settings/extensions | Shot start time, breakdown viewing mode, metadata and unknown persisted production fields, without underscore filtering |

Script tags are stored as breakdown-to-element associations, together with their
category and element definitions. All of these are preserved.
Save As captures the current production; **Full backup** captures every production
in the workspace. Other open productions do not silently get bundled into a
single-production file. Export/import validation operates on clones, and adding
an imported production leaves the source production unchanged. Older v1 files
without schedules are repaired on a clone on both native JavaScript and desktop
paths. Existing entity IDs and links are retained; only a colliding production ID
and display title change when importing a separate copy.

An uncommitted editor dialog must be saved or cancelled before Save As; it cannot
silently omit a draft. Dialog drafts, Undo/Redo history, text selection, scroll,
zoom, current tool and window geometry are transient UI state, not project content.
Device appearance, keyboard bindings and the device's label-opacity preference
remain local. Export does not read OS credentials, account tokens, updater state,
file-picker permissions/bookmarks, support logs or crash reports. Original files
that an older app never retained cannot be reconstructed; missing referenced PDFs
cause an error instead of depending on the sender's local storage.

Verification: `python3 -B -m unittest discover -s tests -v` includes rich demo
handoff after the sender profile is deleted, recipient editing/re-export,
legacy import and malformed relationship/PDF rejection. `node --test
tests/breakdown-csv.cjs tests/project-file-purity.cjs` uses Python's standard CSV
reader to check interoperability and source-object preservation. On macOS,
`python3 -B tools/check_export_ui.py` drives the actual Export, Save As and Import
controls in a unique QA app with preflighted disposable storage/preferences,
including complete portable restoration after the QA sender has been removed.
