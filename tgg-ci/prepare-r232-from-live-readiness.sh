#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${TGG_ACTIVATION_STATE_DIR:-/var/lib/tgg-host-agent/activation-evidence}"
READINESS="${TGG_PRE_R232_READINESS:-$STATE_DIR/PRE_R232_READY.json}"

[ -f "$READINESS" ] || {
  echo "BLOCKED: PRE_R232_READY evidence missing: $READINESS" >&2
  exit 271
}

VERIFY_JSON="$(python3 "$ROOT/tgg-ci/verify-pre-r232-readiness.py" --readiness "$READINESS")"
printf '%s\n' "$VERIFY_JSON"

STATUS="$(printf '%s' "$VERIFY_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))')"
[ "$STATUS" = "PASS" ] || {
  echo "BLOCKED: PRE_R232_READY verification failed" >&2
  exit 272
}

exec bash "$ROOT/tgg-activation/prepare-r232-promotion.sh"
