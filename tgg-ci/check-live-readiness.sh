#!/usr/bin/env bash
set -euo pipefail

: "${TGG_HOST_AGENT_URL:?TGG_HOST_AGENT_URL required}"
: "${TGG_REMOTE_TOKEN:?TGG_REMOTE_TOKEN required}"

BASE="${TGG_HOST_AGENT_URL%/}"
[[ "$BASE" == https://* ]] || {
  echo '{"schema":"tgg.live.readiness.v1","status":"BLOCKED","reason":"https-host-agent-url-required"}'
  exit 2
}

HEALTH="$(curl --fail-with-body --silent --show-error --connect-timeout 5 --max-time 15 "$BASE/health")"
DISCOVERY="$(curl --fail-with-body --silent --show-error --connect-timeout 5 --max-time 15 "$BASE/.well-known/tgg-server.json")"
REMOTE="$(curl --fail-with-body --silent --show-error --connect-timeout 5 --max-time 15 "$BASE/v1/remote/status")"

export HEALTH DISCOVERY REMOTE
python3 - <<'PY'
import json,os,sys
health=json.loads(os.environ["HEALTH"])
discovery=json.loads(os.environ["DISCOVERY"])
remote=json.loads(os.environ["REMOTE"])

errors=[]
if health.get("ok") is not True:
    errors.append("health-not-ok")
if discovery.get("authority")!="TGG":
    errors.append("discovery-authority-mismatch")
if remote.get("ok") is not True:
    errors.append("remote-status-not-ok")
ops=remote.get("operations") or []
for required in ("r231-snapshot-intake","promotion-receipt"):
    if required not in ops:
        errors.append("missing-operation:"+required)

result={
  "schema":"tgg.live.readiness.v1",
  "status":"READY" if not errors else "BLOCKED",
  "errors":errors,
  "hostAuthority":discovery.get("authority"),
  "hostId":discovery.get("hostId"),
  "r231SnapshotIntakeAdvertised":"r231-snapshot-intake" in ops,
  "promotionReceiptAdvertised":"promotion-receipt" in ops,
  "r232PromotionExecuted":False
}
print(json.dumps(result,indent=2))
sys.exit(0 if not errors else 1)
PY
