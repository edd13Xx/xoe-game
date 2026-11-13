#!/usr/bin/env bash
# Run all unit tests + local sandbox integration tests. LOCAL ONLY.
set -euo pipefail
export PATH="/home/box/.local/bin:$HOME/.cargo/bin:$PATH"
export OPENSSL_NO_VENDOR=1
cd "$(dirname "$0")/.."
cargo test --workspace
