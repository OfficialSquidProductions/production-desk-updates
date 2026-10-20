#!/bin/zsh
cd "${0:A:h}"
echo "Production Desk — local breakdown editing development preview"
echo "Open http://127.0.0.1:8766 in your browser."
echo "This preview has its own sample workspace. Keep this window open; Control-C stops it."
python3 -B windows-src/server.py --port 8766 --data windows-src/build/breakdown-dev/workspace.json
