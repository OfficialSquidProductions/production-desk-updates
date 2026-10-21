# Original PDF reading in Main Breakdown

Desktop 1.5.11 (33) displays original PDF pages in Main Breakdown using the already
bundled offline PDF.js renderer and its aligned, selectable text layer. No hosted
viewer, OCR service, or script upload is involved. The original PDF bytes and
existing breakdown/project formats are unchanged.

The old view inferred dialogue from plain extraction and ended it at a blank line.
PDF extraction commonly removes blank paragraphs, so action after the first
character cue inherited dialogue indentation. The regression fixture reproduces
this with `The lantern returns to the table.` after `We have one more take.`.
The new reader uses the PDF's original page geometry, including rotation.

- Selecting text across pages tags the scene chosen in the scene picker. Scrolling
  the PDF does not silently select another scene. Changing scenes jumps to the
  imported Script page reference; page numbers remain editable in the sheet.
- Tagging and actor entry retain the mounted script, inputs, tag category, drafts,
  native text selection, and scroll. Entry focus remains available for another
  actor. The earlier breakdown editing correction is included in this release.
- Fit width and explicit zoom are available. Text stays mounted across pages for
  selection; offscreen canvas bitmaps are released to keep long scripts practical.
- If an original is missing or unreadable, the view shows the extracted scene text
  as an unformatted transcript and explains how to attach the original in Lined
  Script. It does not pretend to reconstruct the original layout.
- Image-only pages display their original image and explain that selectable text
  is absent. Type elements in the sheet, or use a searchable PDF. Initial script
  import still requires extractable text and scene headings; a scan can be attached
  to an existing production from Lined Script for reading/manual breakdown.
- Text edits affect the extracted scene text, not the immutable PDF. Schedules,
  reusable elements, actors, shot lists, portable files and backups retain their
  existing behavior. No data migration is required.

## Validation

All fixtures are fictional. The prior local-fix commit `96b69e8` fails the PDF
regression with action wrongly rendered as dialogue. The corrected source passes:

- Native macOS WKWebView against the actual packaged runtime, including the existing
  portable export/import, scheduling, lined PDF and updater save-protection paths.
- Twelve browser workflow groups: cross-page range selection, real mouse hit
  selection, actual keyboard Enter, repeat tags/actors, draft/caret/scroll retention,
  scene page navigation, rotation, missing-original recovery, scans, 60-page bitmap
  release with retained text, save and reopen.
- 78 backend checks: 77 passed; one Windows-only PDF dependency skip on this Mac.
- 62 JavaScript/data/bridge checks.
- All 40 native/unit/runtime tests on each of iPad mini (A17 Pro) and iPhone 17 Pro
  simulators, iOS 26.5. Native PDF tests read files through the existing iOS bridge,
  tag text, retain selection/focus, navigate pages, save, and reopen.

Native resize observation schedules layout on the next animation frame to avoid
feedback loops while a PDF and its scrollbars initialize. The packaged Windows
startup support check keeps this path covered rather than suppressing errors.

WebKit's missing ReadableStream async iterator is avoided by giving the PDF.js
text layer its stream directly; it consumes that stream with supported readers.
The desktop and iOS reader modules/styles are identical. Native iOS sources include
this correction for later builds; pending App Store/TestFlight packages and project
versions/signing are unchanged.

Physical iPhone/iPad touch/keyboard QA and Intel Mac execution were not performed.
The direct Mac distribution targets Apple Silicon, as before. Windows application
verification is performed by the existing packaged/installed/reinstalled CI workflow;
check the GitHub run for the release commit before claiming its result.

To repeat the isolated browser check (requires Playwright and Chromium):

```sh
node windows-src/tools/check_breakdown_browser.cjs --pdf
# Expected failure demonstrating the previous formatting defect:
node windows-src/tools/check_breakdown_browser.cjs --pdf --baseline 96b69e8
```

`PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` can point at existing local tools.
For native desktop checks, build with the existing Mac builder and run
`python3 windows-src/tools/check_macos_desktop.py`. `--source` checks source without
requiring a packaged app. All these harnesses use temporary synthetic workspaces.
