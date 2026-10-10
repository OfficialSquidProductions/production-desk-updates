#!/bin/zsh
cd "${0:A:h}"
echo "Starting Production Desk on this computer…"
echo "Open http://127.0.0.1:8765 in your browser."
echo "Keep this window open while you work. Press Control-C to stop."
python3 server.py
