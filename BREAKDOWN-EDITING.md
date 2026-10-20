# Breakdown editing correction

Local branch: `fix/breakdown-editing-context`, based on current Production Desk
1.5.10 source commit `b7fd96a4840d27259f465c5ddb47a716f966141d`.
The original checkout, its untracked Android work, the older Scheduler UI edits,
and the separate Call Sheet export experiment were left intact.

## Root cause and correction

Tag, cast-entry, remove-tag, and additional-category actions used `mutate()`'s
default full `render()`. That replaced `#content`, destroying the script range,
scroll containers, active input and drafts. The tag category returned to the first
option (Cast Members). The selected scene ID was retained in memory, but rebuilding
the controls discarded the surrounding editing context.

Both desktop and iPhone/iPad implementations now use the existing undo/save
mutation path without a full render for these actions. Only chips, counts and
suggestions update; script nodes, scene picker, tag category, iPad pane controls,
fields and entry forms stay mounted. Ancestor scroll offsets are retained while
chips change height. Actor entry clears and retains focus for the next name;
removing a focused chip returns focus to its category entry. Other drafts and
caret ranges survive. New category forms use delegated handlers. Scene navigation
clears cached script text so a previous scene's selection cannot be tagged into
the new scene. Undo/Redo data behavior is unchanged; those explicit actions still
use the existing full render.

## Verification on October 20, 2026

- Original commit fails the new browser regression: `Tagging replaced the script DOM`.
- Fixed source passes five browser workflow groups, including real keyboard Enter,
  save/reload, non-first-scene tagging, repeated actors, duplicate assignment
  prevention, draft/caret retention, removal, extra categories and Undo/Redo.
  No browser page errors.
- Native macOS WKWebView source harness passes its existing workflows plus four
  new breakdown workflow groups, including both pane scroll positions and script
  text range retention.
- Backend: 78 tests run, 77 pass, one Windows-only PDF dependency skip.
- iOS JavaScript/data/bridge suite: 47 pass.
- iPad mini (A17 Pro), iOS 26.5 simulator: new native breakdown regression passes,
  including selectionchange (without mouseup), pane switching, focus and native save.
- iPhone 17 Pro, iOS 26.5 simulator: all 39 native/unit/runtime tests pass,
  including the new breakdown regression.
- `git diff --check` passes. Version/build, signing/project configuration, release
  manifests, hosting and submitted binaries are unchanged. App Store Connect was
  not accessed.

This is source/WebKit and simulator validation. No physical iPhone/iPad testing,
Windows application execution, or rebuilt installed Mac release testing was done.
Real-device touch-selection and keyboard presentation remain manual QA items.
No unresolved execution blockers. Sandbox restrictions on local sockets and
Simulator/cache access were resolved by approved local test execution.

Logs: `windows-src/build/breakdown-check/{baseline,browser,mac-webkit,backend}.log`.
Native simulator results: `build/ipad-tests.xcresult`, `build/iphone-tests.xcresult`.
Build output and logs are local and excluded from commits.

## Try locally

Double-click **Start Breakdown Editing Dev.command**, then open
<http://127.0.0.1:8766>. It runs this corrected checkout with its own synthetic
workspace at `windows-src/build/breakdown-dev/workspace.json`; it does not replace
the installed application or use its saved workspace. Import a *copy* of a
production to check a longer real script. Stop with Control-C in the terminal.
The existing App Store release retains its current behavior until a future release.

For native iPhone/iPad development, open `ios/ProductionDesk.xcodeproj`, select
scheme **ProductionDesk**, a simulator, **Debug**, and Run. The unsigned simulator
build already exists at `build/ios-debug/Build/Products/Debug-iphonesimulator/ProductionDesk.app`.
Do not select Archive or change version/signing settings for this fix.

## Repeat checks

From this checkout:

```sh
(cd windows-src && python3 -m unittest discover -s tests -v)
(cd windows-src && python3 tools/check_macos_desktop.py --source)
(cd ios && node --test scripts/test-web.mjs)
node windows-src/tools/check_breakdown_browser.cjs
# Expected failure against original source:
node windows-src/tools/check_breakdown_browser.cjs --baseline b7fd96a
xcodebuild -project ios/ProductionDesk.xcodeproj -scheme ProductionDesk \
  -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath build/ios-debug -only-testing:ProductionDeskTests \
  CODE_SIGNING_ALLOWED=NO test
```

The optional browser harness needs Playwright and Chromium. `PLAYWRIGHT_MODULE`
can name an existing Playwright installation, `BROWSER_EXECUTABLE` an existing
Chromium browser, and `PYTHON` the Python executable. macOS source checks need
Xcode command-line tools. The Mac harness uses synthetic temporary workspaces.
