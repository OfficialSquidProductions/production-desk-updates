# Production Desk for Windows

Download **Production-Desk-Windows-Setup.exe** from the
[official releases](https://github.com/OfficialSquidProductions/production-desk-updates/releases/latest).
Open that one file to install and launch Production Desk. Supports Windows 10/11
on x64 PCs. Installation is per user; no administrator password, Python, browser,
WebView2 download, internet connection, or separate runtime installation is needed.
The installer contains the entire app, Chromium/Electron, Python and the PDF reader.
This is an unsigned personal build; Windows may display a SmartScreen warning.

The Windows app uses the same `web/` UI, `film.py` parser and `server.py` persistence
as the Mac version. Script breakdowns, elements, calendars, scenarios, scheduling,
shot lists, light/dark appearance, deletion, Undo/Redo, all import/export formats,
native file dialogs, reports and PDF printing are retained. Ctrl shortcuts replace
Command shortcuts. PDF text extraction uses bundled pypdf rather than macOS PDFKit;
scans still require a text layer. Installed fonts are used when available, with
the same CSS fallbacks when proprietary fonts are absent.

Data is stored in `%APPDATA%/production-desk/`, outside the installation directory.
Use **Production Desk → Open Data Folder** to find `workspace.json`, its previous
save, and appearance settings. Reinstalling or upgrading preserves these files.
Transfer a Mac workspace using **Export → Full Production Desk backup**, then
**Import script / USS** on Windows. This retains scripts, shots and all productions.

**Production Desk → Check for Updates…** checks the Windows release channel.
Daily automatic checks default on. Automatic downloading/installation defaults
off and can be enabled in **Updates**. An installation waits for pending edits to
save; **Continue Installing Update…** retries after a save failure. The Mac
Sparkle feed and update signature remain separate. Windows downloads use HTTPS
and the release SHA-512 checksum; the public SHA-256 file supports manual checks.
This build has no Authenticode publisher certificate.

## Build and validation

On Windows x64 with Python 3.12 and Node 22:

```
python -m pip install -r desktop/windows/requirements-build.txt
python -m unittest discover -s tests -v
python tools/build_windows.py
python tools/check_windows.py
```

The output is `dist/windows/Production-Desk-Windows-Setup.exe`. NSIS embeds the
complete payload in this single installer rather than downloading it at install
time. Unpacked application files are internal build output; only the setup EXE
is needed by recipients. `latest.yml` and `.blockmap` are updater metadata.

The GitHub Actions workflow builds on a real Windows runner, tests the packaged
app, installs the EXE silently, runs the installed copy, reinstalls, checks data
hashes, then runs it again. The test verifies all five main views, shot editing,
Undo/Redo, disk persistence, failed-save blocking and retry, PDF/FDX imports,
full backup download/import, theme persistence, report PDF generation and
cross-origin request protection. Screenshots and machine-readable reports are
saved as the `windows-verification` workflow artifact. Publication runs only
after these checks pass.

Source is published under `windows-src/` in the release repository. This is a
shared desktop source tree with both Windows and Mac build tools, licensed under MIT. Project files, local
caches, proprietary fonts, Mac signing keys and Apple frameworks are excluded.
