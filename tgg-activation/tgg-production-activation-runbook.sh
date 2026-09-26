#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-dry-run}"
STATE_DIR="${TGG_ACTIVATION_STATE_DIR:-/var/lib/tgg-host-agent/activation-evidence}"
SERVER="${TGG_HOST_AGENT_SERVER:-/opt/tgg-host-agent/server.py}"
SNAPSHOT="${TGG_R231_SNAPSHOT_FILE:-}"

case "$MODE" in
  dry-run)
    LOG_DIR="${TGG_ACTIVATION_LOG_DIR:-${TMPDIR:-/tmp}/tgg-activation-dry-run}"
    ;;
  execute)
    LOG_DIR="${TGG_ACTIVATION_LOG_DIR:-$STATE_DIR/runbook}"
    ;;
  *)
    echo "Usage: $0 [dry-run|execute]" >&2
    exit 2
    ;;
esac
mkdir -p "$LOG_DIR"

timestamp() { date -u +%FT%TZ; }
log() { printf '%s %s\n' "$(timestamp)" "$*" | tee -a "$LOG_DIR/activation.log"; }

require_file() {
  [ -f "$1" ] || { log "BLOCKED missing file: $1"; exit 20; }
}

log "TGG production activation runbook mode=$MODE"
log "R232 promotion is explicitly outside this runbook."

# Always validate bundle helpers before any live action.
for f in \
  "$ROOT/install-r231-intake-transactional.sh" \
  "$ROOT/mark-install-receipt-gate-pass.sh" \
  "$ROOT/prepare-r232-promotion.sh" \
  "$ROOT/upload-r231-snapshot.sh"; do
  require_file "$f"
  bash -n "$f"
done

for f in \
  "$ROOT/verify-and-consume-install-receipt.py" \
  "$ROOT/verify-and-consume-install-gate-marker.py" \
  "$ROOT/verify-r231-intake-receipt.py" \
  "$ROOT/create-r232-promotion-request.py"; do
  require_file "$f"
  python3 -m py_compile "$f"
done

if [ "$MODE" = "dry-run" ]; then
  log "DRY_RUN PASS: helper syntax/compile checks complete"
  log "DRY_RUN next live requirements:"
  log " - reachable existing TGG Host Agent"
  log " - configured TGG_REMOTE_TOKEN"
  log " - HTTPS TGG_HOST_AGENT_URL"
  log " - fresh R231 snapshot file"
  log " - existing ACTIVATION_HANDOFF.json from the pre-R232 chain"
  log "NO LIVE MUTATION PERFORMED"
  exit 0
fi

: "${TGG_REMOTE_TOKEN:?TGG_REMOTE_TOKEN required}"
: "${TGG_HOST_AGENT_URL:?TGG_HOST_AGENT_URL required}"
[[ "$TGG_HOST_AGENT_URL" == https://* ]] || {
  log "BLOCKED: TGG_HOST_AGENT_URL must be HTTPS"
  exit 21
}
[ -n "$SNAPSHOT" ] || {
  log "BLOCKED: TGG_R231_SNAPSHOT_FILE required"
  exit 22
}
require_file "$SNAPSHOT"

log "STEP 1 transactional Host Agent install"
bash "$ROOT/install-r231-intake-transactional.sh"

log "STEP 2 bind and consume fresh install receipt into one-time gate marker"
bash "$ROOT/mark-install-receipt-gate-pass.sh"

log "STEP 3 upload fresh R231 snapshot through authenticated HTTPS Host Agent route"
bash "$ROOT/upload-r231-snapshot.sh" "$SNAPSHOT"

log "STEP 4 require persisted R231 snapshot + intake receipt"
require_file "$STATE_DIR/R231_CERTIFICATION_SNAPSHOT.json"
require_file "$STATE_DIR/R231_SNAPSHOT_INTAKE_RECEIPT.json"

python3 "$ROOT/verify-r231-intake-receipt.py" \
  --snapshot "$STATE_DIR/R231_CERTIFICATION_SNAPSHOT.json" \
  --receipt "$STATE_DIR/R231_SNAPSHOT_INTAKE_RECEIPT.json"

log "STEP 5 prepare bound one-time R232 promotion request"
bash "$ROOT/prepare-r232-promotion.sh"

require_file "$STATE_DIR/R232_PROMOTION_REQUEST.json"

python3 - "$STATE_DIR/R232_PROMOTION_REQUEST.json" "$LOG_DIR/PRE_R232_READY.json" <<'PY'
import datetime,hashlib,json,pathlib,sys
req=pathlib.Path(sys.argv[1])
out=pathlib.Path(sys.argv[2])
d=json.loads(req.read_text())
assert d.get("schema")=="tgg.r232.promotion.request.v3"
assert d.get("r232PromotionExecuted") is False
result={
  "schema":"tgg.production.activation.pre-r232.ready.v1",
  "status":"PROMOTABLE_NOT_EXECUTED",
  "r232PromotionExecuted":False,
  "r232RequestSha256":hashlib.sha256(req.read_bytes()).hexdigest(),
  "createdAt":datetime.datetime.now(datetime.timezone.utc).isoformat()
}
out.write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
PY

log "PRE_R232_READY:PASS"
log "HARD_STOP: R232 NOT EXECUTED"
