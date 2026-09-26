#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${TGG_ACTIVATION_STATE_DIR:-/var/lib/tgg-host-agent/activation-evidence}"
PROOF="${1:?Usage: validate-returned-r232-proof.sh <promotion-proof.json>}"
REQUEST="$STATE_DIR/R232_PROMOTION_REQUEST.json"
VERIFY="$STATE_DIR/R232_PROMOTION_VERIFICATION.json"
BROWSER="$STATE_DIR/R232_BROWSER_PROOF.json"
LEDGER="$STATE_DIR/used-r232-receipts.json"

[ -f "$REQUEST" ] ||
  { echo "FAIL: R232 promotion request missing" >&2; exit 270; }

python3 "$ROOT/verify-r232-promotion-proof.py" \
  --request "$REQUEST" \
  --proof "$PROOF" \
  --used-receipts "$LEDGER" \
  --out "$VERIFY"

python3 "$ROOT/emit-r232-browser-proof.py" \
  --verification "$VERIFY" \
  --out "$BROWSER"

echo "R232_PROOF_VALIDATED:$BROWSER"
echo "R232 has NOT been executed."
