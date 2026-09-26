#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$ROOT/TGG_OCI_PRODUCTION_STACK.zip}"
python3 "$ROOT/preflight.py"
rm -f "$OUT"
(
  cd "$ROOT"
  zip -q "$OUT" versions.tf variables.tf main.tf outputs.tf schema.yaml cloud-init-control.yaml.tftpl cloud-init-game.yaml.tftpl README.md
)
sha256sum "$OUT"
