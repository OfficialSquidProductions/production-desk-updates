#!/bin/zsh
set -e
preview_root="${0:A:h}"
preview_app="$preview_root/windows-src/dist/Production Desk Shot Order Preview.app"
if [[ ! -x "$preview_app/Contents/MacOS/ProductionDesk" ]]; then
  echo "Build the local preview first; see SHOT-SHOOTING-ORDER-REVIEW.md."
  exit 1
fi
mkdir -p "$preview_root/windows-src/build"
preview_home=$(mktemp -d "$preview_root/windows-src/build/shot-order-preview-home.XXXXXX")
# Check native Foundation routing, data, logs and backups before any app launch.
python3 "$preview_root/windows-src/tools/preview_safety.py" --app "$preview_app" --home "$preview_home"
echo "Disposable review home: $preview_home"
export CFFIXED_USER_HOME="$preview_home"
exec "$preview_app/Contents/MacOS/ProductionDesk" -ApplePersistenceIgnoreState YES
