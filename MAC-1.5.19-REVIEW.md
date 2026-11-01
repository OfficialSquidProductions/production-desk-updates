# Mac 1.5.19 (51)

Lined annotations and PDF exports show the shot-size value without the `Shot Size:` prefix. The shared coverage formatter retains the optional movement and description fields. All script-import, original-PDF, annotation and numbering fixes from Mac49 are preserved.

Only global Settings and Production settings opt into backdrop dismissal. A primary pointer press and click must both land outside the dialog bounds. Inside clicks, padding clicks and drags beginning inside retain the dialog. The modal consumes the click before leaving the top layer, preventing click-through into the production. Other edit/confirmation dialogs keep their existing dismissal policy. X remains available in both Settings dialogs.

Global preferences still autosave; status callbacks retain their original status node so an in-flight save can finish after the user closes Settings and opens another menu. Production settings only commit with Save settings; backdrop and X discard unsubmitted drafts identically.

Testing uses fictional productions, disposable homes and nonpersistent native WebKit. Focused real-mouse checks cover repeated inside/outside/X actions in both menus, drags, clicks over the underlying New production button, save/reopen persistence and four actual PDF exports. Native checks cover the same dialog behavior and prior import/renumber/export regressions. No installed app or real project is used.

Publish only the signed/notarized direct-download Mac app, sealed installer and updater feed. Source commits carry `[skip ci]` so the shared source does not trigger Windows builds. Windows 1.5.17 build62 assets and release metadata, App Store build metadata, and Store Python3.14/private-API fixes remain unchanged. No automatic release is scheduled.

The supplied dark Settings screenshot was materialized and inspected locally before changing layout. Lined Script options now use separate sentence-case rows with aligned 16px checkboxes, an 8px row gap, and a 22px gap before Key Binds. The existing opacity controls and every preference remain available. Browser checks cover light/dark themes at 1280×800, 900×650 and 700×560, including scrolling, toggling and backdrop dismissal. The source image remains unchanged with its Library identity on the local reference copy; it is not included in the app or a deliverable.

## Mac publication

Release: https://github.com/OfficialSquidProductions/production-desk-updates/releases/tag/macos-1.5.19-build-51

Tested source: `7772e8b18667c8526fa1c08af6bbfe41d71f4f52`. The final package passed 73 named native WebKit workflow checks and 49 shared JavaScript tests. Both app and sealed installer pass Developer ID signature, stapled notarization, Gatekeeper and distribution checks. A signed Mac49 → Mac51 upgrade preserves synthetic data, and installer self-tests cover fresh install, update, preserved projects, unrelated apps, symlinks and invalid payloads.

Updater ZIP SHA-256: `70e261235c7749504230d10d97e836a720b806ef8a872f00051cb3262403b222`. Installer ZIP SHA-256: `6a09a45b105d13b32313f3c3946ee7153ce0a2babc5a11b49fa11e5cfe6e9448`. Windows remains 1.5.17 build62, with its four release assets unchanged; source commits triggered no Windows workflow. App Store build metadata and submissions are untouched. Post-deployment download/source/signature and old-client updater checks are recorded under ignored `windows-src/build/mac-settings-fixes/`.
