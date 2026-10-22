#!/bin/zsh
cd "${0:A:h}"
echo "Production Desk — local Lined Script development preview"
echo "Open http://127.0.0.1:8767 in your browser."
echo "This preview has its own sample workspace. Keep this window open; Control-C stops it."
python3 -B windows-src/server.py --port 8767 --data windows-src/build/lined-dev/workspace.json
