# Temporary TestFlight demo

**Load Demo** in the main heading opens `DEMO · The Last Cue`, an original fictional college theatre rehearsal with adult student characters Maya and Leo. It includes a three-scene script, breakdown elements, cue notes, a sample rehearsal schedule and three shots. Everything is local and works offline.

Loading adds a separate production through the normal undoable workspace mutation and autosave. Existing productions are not changed. Repeated loads reopen the existing demo by `_betaDemo.key`, preserving its name and edits without creating duplicate productions. If that production is deleted through the normal settings flow, Load Demo creates a fresh sample. Imported portable copies remain separate and editable.

The source script and fixture construction live in `ProductionDesk/Web/demo/`. Save As, full backup and import use the ordinary production-file implementation, retaining the original script and all edited fields. Demo loading never changes a format or migrates real productions.

Before public launch, set `DEMO_ENABLED = false` in `demo/demo.js` to hide and disable the action. Existing saved demo documents continue to work. To remove the assets entirely, also remove the demo import, `loadDemo` function and native button block from `app.js`, then delete `Web/demo/`. Never delete saved demo documents automatically; users may have edited them. Keep or remove the demo tests with the feature as appropriate.
