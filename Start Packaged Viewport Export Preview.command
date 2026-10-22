#!/bin/zsh
set -e
preview_root="${0:A:h}"
preview_app="$preview_root/windows-src/dist/Production Desk Viewport Export Preview.app"
mkdir -p "$preview_root/windows-src/build"
preview_data=$(mktemp -d "$preview_root/windows-src/build/viewport-preview-home.XXXXXX")
/usr/bin/python3 -B "$preview_root/windows-src/tools/preview_safety.py" --app "$preview_app" --home "$preview_data"
echo "Production Desk — viewport and portable-export review"
echo "Disposable review data: $preview_data"
echo "Use copies of project files. Updates are disabled."
export CFFIXED_USER_HOME="$preview_data"
exec "$preview_app/Contents/MacOS/ProductionDesk" -ApplePersistenceIgnoreState YES
