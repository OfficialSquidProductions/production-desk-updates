# Lined scripts

Production Desk 1.5.0 includes lined scripts in the regular Mac and Windows app.

## Try it

1. Export a full backup before importing new work.
2. Open Production Desk and choose your production.
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

## Storage and export

Original PDFs are immutable files under `pdfs/<sha256>.pdf` in the normal application data folder.
Full JSON backups preserve PDFs and editable annotations. PDF exports retain original
page text and graphics and add flattened annotation overlays. USS and CSV exclude lined-script data.

Mac data: `~/Library/Application Support/Slate/`. Windows data: `%APPDATA%/production-desk/`.

PDFs may be up to 40 MB; full backups up to 200 MB. Use unencrypted PDFs. Scanned PDFs
can be annotated, but scene extraction requires selectable text. PDF revisions retain
separate marks; revision transfer is manual. OCR and collaborative editing are not included.

## Testing

`python3 -B -m unittest discover -s tests -v` checks the shared backend.
`python3 -B tools/check_macos_desktop.py` checks the packaged Mac app in native WebKit.
On Windows, `python tools/check_windows.py` checks the unpacked, installed and reinstalled app.
Tests use synthetic productions and an original PDF with rotated/cropped pages.
