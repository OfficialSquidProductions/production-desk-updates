# Lined scripts

Production Desk 1.5.2 includes lined scripts in the regular Mac and Windows app.

## Try it

1. Export a full backup before importing new work.
2. Open Production Desk and choose your production.
3. Open **Lined script → Attach original PDF**. New PDF screenplay imports retain their original automatically.
4. Drag a coverage line over the passage. Each new line creates a distinct shot in the scene selected in Main Breakdown (or the first scene). Select it to edit details or deliberately link an existing shot. With no scenes, it saves as an unlinked draft.
5. Use straight or wavy coverage, pen, highlighter, arrows, and typed notes. Set color and width.
6. Use **Select** to move a mark, drag line endpoints, or drag a coverage information box into either page gutter. Its connector identifies the owning line; clicking the line highlights its box. Settings controls box opacity.
7. Enter description, movement, camera, lens, size, and equipment on the line. Linked details update the shot list. Numeric shot entries add the period automatically: scene 1 plus shot 1 becomes 1.1. **Renumber shot…** rejects occupied numbers or explicitly swaps them while preserving references. Page references and timing notes appear in Script coverage and shot-list exports. Existing manual shot notes remain separate.
8. Settings → **Key Binds** configures tool and action shortcuts. Conflicts must be changed or cleared before saving. Shortcuts pause while typing and in dialogs. Undo/redo preserves the current scroll and selected line.
9. Enable **Continuous scroll**, to the left of the page count, to draw lines and notes across pages. The view scrolls at the edge while drawing. Text-only imports can use **Create from script text** to generate an annotation copy.
10. Right-click a shot or coverage line to delete it. Linked deletion removes the shot and every linked coverage line across revisions; Cancel keeps both, and Undo restores both. Each tab has its own **Don’t show again** checkbox; reset them in **Settings → Deletion warnings**.
11. Choose **Export lined PDF**. Export a **full backup** to retain editable marks and the original PDF.

Find shot number provides ordered autocomplete; Enter selects an exact match, arrows navigate suggestions, and deleted shots are excluded. Shot numbers, scene numbers, cameras, and movement labels follow the linked shot.
Multiple lines on different pages can link to the same shot. Deleting a shot or scene
also removes its coverage lines; Undo restores them. Freehand drawings and standalone
notes are independent of shots.

## Storage and export

Original PDFs are immutable files under `pdfs/<sha256>.pdf` in the normal application data folder.
Full JSON backups preserve PDFs and editable annotations. PDF exports retain original
page text, graphics and dimensions and add flattened annotation overlays. Gutter boxes
are placed inside the PDF page on export; editable gutter positions remain saved. USS and CSV exclude lined-script data.

Mac data: `~/Library/Application Support/Slate/`. Windows data: `%APPDATA%/production-desk/`.

PDFs may be up to 40 MB; full backups up to 200 MB. Use unencrypted PDFs. Scanned PDFs
can be annotated, but scene extraction requires selectable text. PDF revisions retain
separate marks; revision transfer is manual. OCR and collaborative editing are not included.

## Testing

`python3 -B -m unittest discover -s tests -v` checks the shared backend.
`python3 -B tools/check_macos_desktop.py` checks the packaged Mac app in native WebKit.
On Windows, `python tools/check_windows.py` checks the unpacked, installed and reinstalled app.
Tests use synthetic productions and an original PDF with rotated/cropped pages.

`node tools/check_lined_browser.cjs --all` runs the optional browser aggregate with
Playwright and Chromium, including real keyboard/mouse checks. See
[local review and test coverage](../LINED-SCRIPT-REVIEW.md).
