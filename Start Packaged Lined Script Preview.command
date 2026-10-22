#!/bin/zsh
set -e
preview_root="${0:A:h}"
preview_app="$preview_root/windows-src/dist/Production Desk Lined Script Preview.app"
if [[ ! -x "$preview_app/Contents/MacOS/ProductionDesk" ]]; then
  echo "Build the local preview first; see LINED-SCRIPT-REVIEW.md."
  exit 1
fi
mkdir -p "$preview_root/windows-src/build"
preview_data=$(mktemp -d "$preview_root/windows-src/build/lined-preview-home.XXXXXX")
echo "Production Desk — packaged Lined Script review"
echo "Disposable review data: $preview_data"
echo "This preview has updates disabled and uses its own sample data. Import copies for review."
export CFFIXED_USER_HOME="$preview_data"
exec "$preview_app/Contents/MacOS/ProductionDesk" -ApplePersistenceIgnoreState YES
