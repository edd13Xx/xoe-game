#!/usr/bin/env bash
set -euo pipefail
# Owner ceiling: player-owned key direct to xAI; never enable a tester/owner-key relay.
VITE_XOE_RELAY_ENABLED=false VITE_XOE_RELAY_BASE='' npm run build
# make-standalone embeds the favicon into the single-file HTML, then we copy that
# delivery file and turn dist/ into a hostable PWA (manifest, icons, service worker).
node --input-type=module -e "import {existsSync,unlinkSync} from 'node:fs'; if(existsSync('dist/favicon.svg')) unlinkSync('dist/favicon.svg')"
SINGLE="Unknown-Orbital-Engine-XOE-v19-2026-11-10.html"
cp -f dist/index.html "$SINGLE"
node pwa/make-pwa.mjs "$SINGLE" dist "v19-2026-11-11"
