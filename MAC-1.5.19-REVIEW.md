# Mac 1.5.19 (50)

Lined annotations and PDF exports show the shot-size value without the `Shot Size:` prefix. The shared coverage formatter retains the optional movement and description fields. All script-import, original-PDF, annotation and numbering fixes from Mac49 are preserved.

Only global Settings and Production settings opt into backdrop dismissal. A primary pointer press and click must both land outside the dialog bounds. Inside clicks, padding clicks and drags beginning inside retain the dialog. The modal consumes the click before leaving the top layer, preventing click-through into the production. Other edit/confirmation dialogs keep their existing dismissal policy. X remains available in both Settings dialogs.

Global preferences still autosave; status callbacks retain their original status node so an in-flight save can finish after the user closes Settings and opens another menu. Production settings only commit with Save settings; backdrop and X discard unsubmitted drafts identically.

Testing uses fictional productions, disposable homes and nonpersistent native WebKit. Focused real-mouse checks cover repeated inside/outside/X actions in both menus, drags, clicks over the underlying New production button, save/reopen persistence and four actual PDF exports. Native checks cover the same dialog behavior and prior import/renumber/export regressions. No installed app or real project is used.

Publish only the signed/notarized direct-download Mac app, sealed installer and updater feed. Source commits carry `[skip ci]` so the shared source does not trigger Windows builds. Windows 1.5.17 build62 assets and release metadata, App Store build metadata, and Store Python3.14/private-API fixes remain unchanged. No automatic release is scheduled.
