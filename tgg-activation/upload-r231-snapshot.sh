#!/usr/bin/env bash
set -euo pipefail

SNAPSHOT="${1:?Usage: upload-r231-snapshot.sh R231_CERTIFICATION_SNAPSHOT.json}"
: "${TGG_HOST_AGENT_URL:?TGG_HOST_AGENT_URL required}"
: "${TGG_REMOTE_TOKEN:?TGG_REMOTE_TOKEN required}"

[ -f "$SNAPSHOT" ] || { echo "FAIL: snapshot file missing" >&2; exit 1; }
[[ "$TGG_HOST_AGENT_URL" == https://* ]] || { echo "FAIL: HTTPS Host Agent URL required" >&2; exit 1; }

curl --fail-with-body --silent --show-error   --connect-timeout 5 --max-time 20   -X POST   -H "Authorization: Bearer ${TGG_REMOTE_TOKEN}"   -H "Content-Type: application/json"   --data-binary "@$SNAPSHOT"   "${TGG_HOST_AGENT_URL%/}/v1/evidence/r231-snapshot"

echo
echo "R231_SNAPSHOT_UPLOAD:COMPLETE"
