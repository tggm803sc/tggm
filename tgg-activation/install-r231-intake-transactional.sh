#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="${TGG_HOST_AGENT_SERVER:-/opt/tgg-host-agent/server.py}"
SERVICE="${TGG_HOST_AGENT_SERVICE:-tgg-host-agent}"
ACTIVATION_DIR="${TGG_ACTIVATION_DIR:-/opt/tgg/activation}"
INGEST="$ACTIVATION_DIR/ingest-r231-snapshot.py"
STATE_DIR="${TGG_ACTIVATION_STATE_DIR:-/var/lib/tgg-host-agent/activation-evidence}"
BACKUP_DIR="${TGG_HOST_AGENT_BACKUP_DIR:-/var/lib/tgg-host-agent/backups}"
HEALTH_URL="${TGG_HOST_AGENT_LOCAL_HEALTH_URL:-http://127.0.0.1:8787/health}"
REMOTE_STATUS_URL="${TGG_HOST_AGENT_LOCAL_REMOTE_STATUS_URL:-http://127.0.0.1:8787/v1/remote/status}"

mkdir -p "$ACTIVATION_DIR" "$STATE_DIR" "$BACKUP_DIR"

[ -f "$SERVER" ] || { echo "FAIL: Host Agent server missing: $SERVER" >&2; exit 1; }
[ -f "$ROOT/forge-v14-host-agent/server.py" ] || { echo "FAIL: patched server missing" >&2; exit 1; }
[ -f "$ROOT/forge-v14-host-agent/ingest-r231-snapshot.py" ] || { echo "FAIL: intake verifier missing" >&2; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
INSTALL_NONCE="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
BACKUP="$BACKUP_DIR/server.py.$STAMP"
cp "$SERVER" "$BACKUP"
ORIGINAL_SHA="$(sha256sum "$BACKUP" | awk '{print $1}')"
CANDIDATE_SHA="$(sha256sum "$ROOT/forge-v14-host-agent/server.py" | awk '{print $1}')"

rollback() {
  echo "ROLLBACK: restoring $BACKUP"
  cp "$BACKUP" "$SERVER"
  RESTORED_SHA="$(sha256sum "$SERVER" | awk '{print $1}')"
  if [ "$RESTORED_SHA" != "$ORIGINAL_SHA" ]; then
    echo "ROLLBACK_FAIL: restored server hash mismatch" >&2
    return 99
  fi
  python3 -m py_compile "$SERVER" || true
  systemctl restart "$SERVICE" || true
  sleep 1
  curl -fsS "$HEALTH_URL" >/dev/null 2>&1 || true
  echo "ROLLBACK_VERIFIED:$RESTORED_SHA"
}
trap 'rc=$?; if [ $rc -ne 0 ]; then rollback; fi; exit $rc' EXIT

# Preflight current live server before changing it.
python3 -m py_compile "$SERVER"
systemctl is-active --quiet "$SERVICE"
curl -fsS "$HEALTH_URL" >/dev/null
curl -fsS "$REMOTE_STATUS_URL" >/dev/null

# Install new verifier + patched server.
install -m 0755 "$ROOT/forge-v14-host-agent/ingest-r231-snapshot.py" "$INGEST"
install -m 0750 "$ROOT/forge-v14-host-agent/server.py" "$SERVER"
INSTALLED_SHA="$(sha256sum "$SERVER" | awk '{print $1}')"
[ "$INSTALLED_SHA" = "$CANDIDATE_SHA" ] || {
  echo "FAIL: installed Host Agent hash does not match candidate" >&2
  exit 1
}
python3 -m py_compile "$SERVER" "$INGEST"

systemctl restart "$SERVICE"
sleep 1
systemctl is-active --quiet "$SERVICE"

# Post-install smoke: preserve old routes and advertise new route.
curl -fsS "$HEALTH_URL" >/dev/null
curl -fsS "$REMOTE_STATUS_URL" | python3 -c '
import json,sys
d=json.load(sys.stdin)
ops=d.get("operations",[])
assert "r231-snapshot-intake" in ops, ops
'

# New route must exist and reject unauthenticated request.
CODE="$(
  curl -sS -o /tmp/tgg-r231-unauth.json -w '%{http_code}' \
    -X POST -H 'Content-Type: application/json' \
    --data '{}' \
    "${REMOTE_STATUS_URL%/v1/remote/status}/v1/evidence/r231-snapshot"
)"
[ "$CODE" = "401" ] || { echo "FAIL: intake route unauthenticated probe expected 401, got $CODE" >&2; exit 1; }

# Commit install: disable rollback trap.
trap - EXIT

cat > "$STATE_DIR/INSTALL_RECEIPT.json" <<EOF
{
  "schema":"tgg.host-agent.r231.install.receipt.v2",
  "status":"PASS",
  "candidateSha":"b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3",
  "installNonce":"$INSTALL_NONCE",
  "installedAt":"$(date -u +%FT%TZ)",
  "server":"$SERVER",
  "backup":"$BACKUP",
  "originalServerSha256":"$ORIGINAL_SHA",
  "candidateServerSha256":"$CANDIDATE_SHA",
  "installedServerSha256":"$INSTALLED_SHA",
  "service":"$SERVICE",
  "health":"PASS",
  "remoteStatus":"PASS",
  "unauthorizedIntakeProbe":401,
  "r232PromotionExecuted":false
}
EOF

echo "FORGE_V14_R231_TRANSACTIONAL_INSTALL:PASS"
