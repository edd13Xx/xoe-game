#!/usr/bin/env bash
# v18 build: relay hook ON but pointed at the LOCAL test relay only (127.0.0.1:18791). No public URL.
set -euo pipefail
cd "$(dirname "$0")/.."
VITE_XOE_RELAY_ENABLED=true VITE_XOE_RELAY_BASE=http://127.0.0.1:18791 npm run -s build
cp dist/index.html /tmp/xoe-v18-build.html
echo "built /tmp/xoe-v18-build.html ($(wc -c < dist/index.html) bytes)"
