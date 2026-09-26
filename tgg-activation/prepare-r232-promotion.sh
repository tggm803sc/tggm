#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${TGG_ACTIVATION_STATE_DIR:-/var/lib/tgg-host-agent/activation-evidence}"
HANDOFF="$STATE_DIR/ACTIVATION_HANDOFF.json"
R231="$STATE_DIR/R231_CERTIFICATION_SNAPSHOT.json"
INTAKE_RECEIPT="$STATE_DIR/R231_SNAPSHOT_INTAKE_RECEIPT.json"
INSTALL_RECEIPT="$STATE_DIR/INSTALL_RECEIPT.json"
INSTALL_GATE="$STATE_DIR/INSTALL_RECEIPT_GATE_PASS.json"
REQUEST="$STATE_DIR/R232_PROMOTION_REQUEST.json"
REQUEST_TMP="$STATE_DIR/.R232_PROMOTION_REQUEST.pending.json"

[ -f "$INSTALL_GATE" ] || { echo "BLOCKED: install gate marker missing" >&2; exit 259; }
[ -f "$INSTALL_RECEIPT" ] || { echo "BLOCKED: install receipt missing" >&2; exit 258; }
[ -f "$HANDOFF" ] || { echo "FAIL: activation handoff missing" >&2; exit 260; }
[ -f "$R231" ] || { echo "BLOCKED: fresh R231 certification snapshot required" >&2; exit 261; }
[ -f "$INTAKE_RECEIPT" ] || { echo "BLOCKED: verified R231 snapshot intake receipt required" >&2; exit 262; }

# Validate every downstream dependency first.
python3 "$ROOT/verify-r231-intake-receipt.py" \
  --snapshot "$R231" \
  --receipt "$INTAKE_RECEIPT"

python3 "$ROOT/verify-and-consume-install-gate-marker.py" \
  --marker "$INSTALL_GATE" \
  --receipt "$INSTALL_RECEIPT" \
  --server "${TGG_HOST_AGENT_SERVER:-/opt/tgg-host-agent/server.py}" \
  --ledger "$STATE_DIR/used-install-gate-markers.json" \
  --max-age-seconds 600 \
  --check-only >/dev/null

rm -f "$REQUEST_TMP"

# Stage the R232 request before consuming the one-time marker.
python3 "$ROOT/create-r232-promotion-request.py" \
  --handoff "$HANDOFF" \
  --r231-snapshot "$R231" \
  --out "$REQUEST_TMP"

# Commit: consume marker, then atomically publish the staged request.
python3 "$ROOT/verify-and-consume-install-gate-marker.py" \
  --marker "$INSTALL_GATE" \
  --receipt "$INSTALL_RECEIPT" \
  --server "${TGG_HOST_AGENT_SERVER:-/opt/tgg-host-agent/server.py}" \
  --ledger "$STATE_DIR/used-install-gate-markers.json" \
  --max-age-seconds 600 >/dev/null

mv -f "$REQUEST_TMP" "$REQUEST"
echo "R232_PROMOTION_REQUEST_READY:$REQUEST"
echo "R232 has NOT been executed."
