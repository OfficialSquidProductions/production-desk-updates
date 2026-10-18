# Production Desk

**Free, offline script breakdowns, film scheduling, and shot lists for macOS and Windows.**

Production Desk helps filmmakers turn a screenplay into a practical shooting plan.
Import a script, tag cast and production elements, arrange scenes on a stripboard,
and plan camera setups—all on your own computer, without an account or subscription.
Built by Squid Productions for real productions and shared under the [MIT license](LICENSE).

## Download

| Platform | Download | Requirements |
| --- | --- | --- |
| macOS | [Download for Mac](https://updates.squidproductions.org/Production-Desk-1.5.5-24.zip) | Apple Silicon (M1 or newer), macOS 12 or later. Unzip and move Production Desk.app to Applications. |
| Windows | [Download Windows installer](https://github.com/OfficialSquidProductions/production-desk-updates/releases/latest/download/Production-Desk-Windows-Setup.exe) | Windows 10/11, x64. Run the single `.exe` installer; installation is for the current user. |

Visit the [Production Desk website](https://productiondesk.squidproductions.org/) for the
download page. Packaged desktop apps include their runtimes; you do not need to install
Python or a separate browser. Production Desk 1.5.5 for Mac is signed with Developer ID
and notarized by Apple, with a stapled ticket. Windows is unsigned and may show a SmartScreen prompt.

Alternatively, download the [one-click Mac installer](https://updates.squidproductions.org/Production-Desk-Installer-1.5.5-24.zip).

macOS and Windows are the public desktop editions. iPhone and iPad builds are available through the existing owner-only internal TestFlight groups; iOS source is in `ios/`.

## What you can do

- **Import screenplays:** selectable-text PDF, Final Draft (`.fdx`), Fountain, and plain text.
- **Break down scenes:** tag cast, props, wardrobe, locations, and other production elements;
  edit scene details, page counts, notes, and estimated shooting time.
- **Build shooting schedules:** drag scene strips into shooting days, add banners, set days
  off, flag element availability conflicts, and compare alternative schedule scenarios.
- **Plan shot lists:** record camera setups, lenses, setup/shoot estimates, takes, and completion.
- **Line original script PDFs:** link straight/wavy coverage to shots, draw and highlight,
  add camera movements and notes, and export lined PDFs.
- **Create reports:** one-line schedules, scene breakdowns, cast workdays, and printable PDFs.
- **Move your work:** export full JSON backups, USS schedules, and CSV reports.
- **Work locally:** automatic disk saves, Undo/Redo, and light/dark appearance.

## Get started

1. Open the desktop app and explore the fictional sample production, **The Last Light**,
   or choose **New production**.
2. Choose **Import script / USS** to bring in a screenplay or schedule. Imports create a
   separate production and preserve your existing projects.
3. Review the imported scene headings, cast, and page estimates in **Main breakdown**.
4. Open **Shooting schedule**, set your production calendar, and drag scenes into shooting days.
5. Add camera coverage in **Shot list**, then export or print your reports.

Use **Export → Full Production Desk backup** regularly. Full backups preserve all productions,
script text, shots, original PDFs, lined-script annotations, and schedules and can be transferred between Mac and Windows.
USS interchange files omit script text and shot lists.

## Your files and privacy

Production work is processed and stored locally. The app has no analytics or advertising,
and local work continues without an internet connection. Desktop update checks use the
internet and do not upload production files.

After the editor opens, newer compatible desktop updates show a changelog with
Install Update or Later. Installation requires your choice and a successful save;
finish or cancel open editor dialogs first. Ordinary exit never installs updates.

- **Mac data:** `~/Library/Application Support/Slate/`
- **Windows data:** `%APPDATA%/production-desk/`

Choose **Production Desk → Open Data Folder** to find your workspace and previous-save backup.
Updating or reinstalling the app preserves this separate data folder. Exported backups
also protect against loss of the computer or disk.

## Current limits

PDF import requires selectable text; OCR is not included. Imported cast, scene numbering,
and page counts need review. Production Desk does not yet include collaborative editing,
call sheets, script revision reconciliation, automatic schedule optimization, or advanced
cast hold/drop/pickup calculations. USS compatibility with other applications should be
tested with their importers.

## Source and development

The shared Mac and Windows source is in [`windows-src/`](windows-src/README.md).
That directory retains its original name for compatibility with the Windows release workflow.
The repository root also hosts the Mac update feed and its download archives.

- [Run from source and build the Mac app](windows-src/README.md)
- [Build and verify the Windows installer](windows-src/desktop/windows/README.md)
- [Contribute or report a bug](CONTRIBUTING.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

To run from source with Python 3.9 or later:

```sh
cd windows-src
python3 server.py
```

Open `http://127.0.0.1:8765`. See the [desktop guide](windows-src/README.md) for PDF dependencies,
tests, and packaging instructions.

## Support

[Open a GitHub issue](https://github.com/OfficialSquidProductions/production-desk-updates/issues/new)
or email [alexanderhosier@squidproductions.org](mailto:alexanderhosier@squidproductions.org).
Include the app version, operating system, steps to reproduce, and expected versus actual
behavior. Keep private scripts and production data out of public reports.

Also from Squid Productions: [Scenic](https://scenic.squidproductions.org/), our scene planner.

## Bug and crash reports

Open **Production settings → Report a bug…** or **Report a crash…**. Describe
what happened, review the technical summary, and choose **Open email draft** to
prepare an email to alexanderhosier@squidproductions.org. You send the email yourself.
Copy or save a text report if your email app is unavailable. Detected errors and
interrupted desktop sessions are retained locally for reporting after restart;
**Dismiss saved crash report** clears those details. Project files and logs are
not attached automatically.

## Production Desk 1.5.4 portable files

Save and share complete editable productions, including embedded assets. Imports create distinct productions while preserving current work. See [portable format](windows-src/PORTABLE-PROJECTS.md) and [iPhone/iPad sources](ios/README.md).
