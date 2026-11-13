#!/usr/bin/env bash
# Build all three contracts to wasm (LOCAL ONLY — nothing is deployed) and print SHA-256.
set -euo pipefail
export PATH="/home/box/.local/bin:$HOME/.cargo/bin:$PATH"
export OPENSSL_NO_VENDOR=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for c in xoe-token xoe-rewards wnear-mock; do
  (cd "$ROOT/contracts/$c" && cargo near build non-reproducible-wasm)
done
cd "$ROOT"
sha256sum target/near/*/*.wasm | tee wasm-sha256.txt
