#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${TGG_ACTIVATION_STATE_DIR:-/var/lib/tgg-host-agent/activation-evidence}"
SERVER="${TGG_HOST_AGENT_SERVER:-/opt/tgg-host-agent/server.py}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RECEIPT="$STATE_DIR/INSTALL_RECEIPT.json"
MARKER="$STATE_DIR/INSTALL_RECEIPT_GATE_PASS.json"
MARKER_TMP="$STATE_DIR/.INSTALL_RECEIPT_GATE_PASS.pending.json"
VERIFY_TMP="$STATE_DIR/.install-receipt-verification.json"

mkdir -p "$STATE_DIR"
rm -f "$MARKER_TMP" "$VERIFY_TMP"

# Phase 1: validate without consuming.
python3 "$ROOT/verify-and-consume-install-receipt.py" \
  --receipt "$RECEIPT" \
  --server "$SERVER" \
  --ledger "$STATE_DIR/used-install-receipts.json" \
  --max-age-seconds 900 \
  --check-only > "$VERIFY_TMP"

# Stage the next artifact before consuming the one-time receipt.
python3 - "$RECEIPT" "$SERVER" "$VERIFY_TMP" "$MARKER_TMP" <<'PY'
import datetime,hashlib,json,os,pathlib,sys,tempfile
receipt_path=pathlib.Path(sys.argv[1]); server_path=pathlib.Path(sys.argv[2])
verify_path=pathlib.Path(sys.argv[3]); marker_path=pathlib.Path(sys.argv[4])
receipt=json.loads(receipt_path.read_text())
verification=json.loads(verify_path.read_text())
if verification.get("status")!="PASS" or verification.get("checkOnly") is not True:
    raise SystemExit("FAIL: install receipt check-only verification did not pass")
marker={
  "schema":"tgg.install.receipt.gate.pass.v2",
  "status":"PASS",
  "candidateSha":receipt.get("candidateSha"),
  "installNonce":receipt.get("installNonce"),
  "installReceiptSha256":hashlib.sha256(receipt_path.read_bytes()).hexdigest(),
  "installedServerSha256":hashlib.sha256(server_path.read_bytes()).hexdigest(),
  "createdAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "maxAgeSeconds":600,
  "consumed":False,
  "r232PromotionExecuted":False
}
marker_path.write_text(json.dumps(marker,indent=2))
PY

# Phase 2 / commit: consume receipt only after the marker has staged successfully.
python3 "$ROOT/verify-and-consume-install-receipt.py" \
  --receipt "$RECEIPT" \
  --server "$SERVER" \
  --ledger "$STATE_DIR/used-install-receipts.json" \
  --max-age-seconds 900 >/dev/null

# Atomic publication on the same filesystem.
mv -f "$MARKER_TMP" "$MARKER"
rm -f "$VERIFY_TMP"
echo "INSTALL_RECEIPT_GATE_MARKED:PASS"
