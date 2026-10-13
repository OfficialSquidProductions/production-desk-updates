# Lined-script beta

This branch adds **Lined script** to Production Desk 1.5.0-beta.1 for Mac and Windows.
It is a separate app named **Production Desk Beta**. Main, the website, stable
installers, and production update feeds are unchanged. Automatic updates are disabled.

## Try it

1. Export a full backup from your stable app if you want to try existing work.
2. Open Production Desk Beta and import that backup. The beta starts with its own sample workspace.
3. Open **Lined script → Attach original PDF**. New PDF screenplay imports retain their original automatically.
4. Choose a shot or **New linked shot**, then drag a coverage line over the passage.
5. Use straight or wavy coverage, pen, highlighter, arrows, and typed notes. Set color and width.
6. Use **Select** to move a mark, drag line endpoints, or drag a coverage label into a margin.
7. Edit **Camera movement** to update the linked shot-list field. Add timing notes to individual lines.
8. Choose **Export lined PDF**. Export a **full backup** to retain editable marks and the original PDF.

Shot numbers, scene numbers, cameras, and movement labels follow the linked shot.
Multiple lines on different pages can link to the same shot. Deleting a shot or scene
also removes its coverage lines; Undo restores them. Freehand drawings and standalone
notes are independent of shots.

## Separate storage

- Mac: `~/Library/Application Support/ProductionDeskBeta/`
- Windows: `%APPDATA%/production-desk-beta/`

The beta never migrates the stable workspace automatically. Full JSON backups include
original PDFs and annotations and can move beta work between Mac and Windows. Do not
restore beta backups into older stable builds: they do not understand PDF attachments.
USS and CSV files exclude lined-script data.

Original PDFs are immutable files under `pdfs/<sha256>.pdf`; autosaves contain only
references and normalized annotation coordinates. PDF exports retain the original
page text and graphics and add flattened transparent annotation overlays. Keep the
full JSON backup if you need to edit the marks later.

## Current limits

- PDFs up to 40 MB; full backups up to 200 MB. Password-protected PDFs must be decrypted first.
- A scanned PDF can be attached and annotated, but scene extraction still requires selectable text.
- Each PDF revision has its own annotations. Automatic revision comparison and mark transfer are not included.
- This beta does not include OCR, collaborative editing, or editable PDF-native annotation objects.
- Deleted productions/revisions may leave original PDF files in the beta data folder to preserve Undo.
- The Mac beta is locally signed and requires Apple Silicon and macOS 12+. The Windows beta is unsigned and requires Windows 10/11 x64.

## Build and verify

Run from source with `python3 -B server.py --data /path/to/separate-beta/workspace.json`.
Open the printed local address. Keep `--data` separate from stable data.

```sh
python3 -B -m unittest discover -s tests -v
python3 -B tools/build_macos.py --app-only --no-share
python3 -B tools/check_macos_desktop.py
```

On Windows, run `python tools/build_windows.py`, then `python tools/check_windows.py`.
The beta branch triggers GitHub Actions and uploads `production-desk-beta-windows`.
It cannot publish a production release. The installer check exercises the unpacked app,
installation, and reinstallation with synthetic projects in a separate smoke-test folder.

The test fixture includes two pages with rotation and a crop box. Shared WebKit/Electron
checks cover attachment, all drawing tools, movable labels, linked movements, zoom,
Undo/Redo, persistence, export, and full PDF backups. Backend checks cover malformed
marks, missing/tampered attachments, immutable originals, and cross-origin rejection.
