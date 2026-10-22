# Portable Production Desk projects

## User flow

Choose a production, then **Save As…** in the main header. On iOS this opens the native Files destination picker; on the Mac/Windows host it uses the existing native save dialog. The selected production becomes one `.productiondesk` file. On iOS, **Export → Share project…** sends the same complete file through the anchored system share sheet. Transfer it by AirDrop, Files/iCloud, email, or another sharing app.

On desktop, choose **Import…** beside **Save As…**, then choose the file and **Import locally**. iOS also registers the file type and accepts opening a project directly from Files, including a cold launch. Import adds a separate production. It preserves existing projects and history; a colliding production ID gets a new identity while production-scoped scene/schedule/shot/annotation IDs and all references stay intact, and duplicate names receive an `imported copy` suffix. No imported production silently replaces another.

A recipient needs a Production Desk build containing this feature. Versions before 1.5.4 do not understand the new extension. **Full Production Desk backup (.json)** remains available for all productions and legacy interchange. **USS** remains available with its existing limitations.

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

Production Desk 1.5.4 adds this format on iOS/iPadOS 17+ (iPhone and iPad), macOS 12+ (Apple Silicon), and Windows. Legacy JSON and USS interchange remain available. Physical-device sharing providers and heavy production memory behavior require device QA.

## Desktop import safety

The import dialog saves pending field edits before reading the file. If that save fails, it keeps the current production and asks you to retry saving. Cancel remains available while the file is read and validated; a late response cannot commit a cancelled import. The final atomic workspace save temporarily disables cancellation. A failed final save leaves the current selection, project and undo history in place. A successful import is one undoable action and is already saved when its success message appears.

Duplicate IDs within a production, invalid scene/shot/coverage/calendar/board/linked-element relationships, duplicate JSON object fields, unsupported versions and invalid PDFs produce explicit errors. Unknown project extension fields remain intact. A valid production with no scenes is supported; an empty or corrupt file is rejected. Older JSON backups and USS files still use the existing compatibility repairs. Settings that belong to the production, such as shot start time and strip colors, travel with it; device appearance, key binds and label opacity remain device preferences.

The supported external binary assets in the current desktop schema are original PDF revisions. Other project fields, including inline assets in extensions, remain unchanged. Old files cannot supply an original script/PDF that their source app never retained. Older JSON backups without embedded PDFs can reuse an already present, checksum-valid original; a portable `.productiondesk` file must contain all referenced PDFs itself.
