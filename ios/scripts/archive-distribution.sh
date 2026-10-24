#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
xcodebuild -project ProductionDesk.xcodeproj -scheme ProductionDesk \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath archive-build \
  -archivePath artifacts/ProductionDesk-1.5.16-40-signed.xcarchive \
  CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM=FZ298DXLS3 \
  CODE_SIGN_IDENTITY=BECA8AEC09386515B77633778749994DB94177F8 \
  PROVISIONING_PROFILE_SPECIFIER='Production Desk App Store FZ298DXLS3' archive
