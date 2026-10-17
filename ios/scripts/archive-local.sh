#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
xcodebuild -project ProductionDesk.xcodeproj -scheme ProductionDesk \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath archive-build \
  -archivePath artifacts/ProductionDesk-1.5.4-23-registered-ipad-unsigned.xcarchive \
  CODE_SIGNING_ALLOWED=NO archive
