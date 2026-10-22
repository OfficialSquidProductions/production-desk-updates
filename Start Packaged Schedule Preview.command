#!/bin/zsh
set -e
preview_root="${0:A:h}"
preview_app="$preview_root/windows-src/dist/Production Desk Schedule Preview.app"
if [[ ! -x "$preview_app/Contents/MacOS/ProductionDesk" ]]; then
  echo "Build the local preview first; see SCHEDULE-DRAG-REVIEW.md."
  exit 1
fi
mkdir -p "$preview_root/windows-src/build"
preview_data=$(mktemp -d "$preview_root/windows-src/build/schedule-preview-home.XXXXXX")
echo "Production Desk — packaged Schedule review"
echo "Disposable review data: $preview_data"
echo "Updates are disabled. This preview uses its own sample data; import copies for review."
export CFFIXED_USER_HOME="$preview_data"
exec "$preview_app/Contents/MacOS/ProductionDesk" -ApplePersistenceIgnoreState YES
