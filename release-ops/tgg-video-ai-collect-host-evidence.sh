#!/usr/bin/env bash
set -euo pipefail

OPS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_ROOT="${TGG_RELEASE_ROOT:-}"
EVIDENCE_DIR="${TGG_VIDEO_AI_EVIDENCE_DIR:-$OPS_ROOT/release-evidence}"
EXPECTED_SHA="${TGG_VIDEO_AI_EXPECTED_SHA:-469518eff0fe1641f6889c5ff78c2f3c0df189c7}"
ORIGIN="${TGG_PROD_ORIGIN:-${TGG_PUBLIC_BASE_URL:-}}"

fail(){
  printf '{"status":"HOLD","reason":"%s"}\n' "$1" >&2
  exit "${2:-1}"
}

[[ -n "$RELEASE_ROOT" ]] || fail "TGG_RELEASE_ROOT_REQUIRED" 22
[[ -n "$ORIGIN" ]] || fail "TGG_PROD_ORIGIN_REQUIRED" 23

mkdir -p "$EVIDENCE_DIR"
rm -f "$EVIDENCE_DIR"/{canary,bootstrap,health}.json

export TGG_VIDEO_AI_EXPECTED_SHA="$EXPECTED_SHA"
export TGG_PROD_ORIGIN="${ORIGIN%/}"
export TGG_PUBLIC_BASE_URL="${ORIGIN%/}"
export TGG_RELEASE_ROOT="$RELEASE_ROOT"

canary_log="$(mktemp)"
bootstrap_log="$(mktemp)"
trap 'rm -f "$canary_log" "$bootstrap_log"' EXIT

"$OPS_ROOT/release-ops/tgg-video-ai-v1-canary.sh" | tee "$canary_log"
python3 - "$canary_log" "$EVIDENCE_DIR/canary.json" <<'PY'
import json,sys
src,out=sys.argv[1:3]
lines=open(src,encoding="utf-8").read().splitlines()
obj=None
for line in reversed(lines):
    try:
        x=json.loads(line)
    except Exception:
        continue
    if x.get("schema")=="tgg.video-ai.canary-proof.v1":
        obj=x
        break
if not obj:
    raise SystemExit("CANARY_EVIDENCE_NOT_FOUND")
open(out,"w",encoding="utf-8").write(json.dumps(obj,indent=2)+"\n")
PY

(
  cd "$RELEASE_ROOT"
  TGG_VIDEO_AI_EXPECTED_SHA="$EXPECTED_SHA" \
  TGG_PROD_ORIGIN="${ORIGIN%/}" \
  bash deployment/tgg-video-ai-host-bootstrap.sh
) | tee "$bootstrap_log"

python3 - "$bootstrap_log" "$EVIDENCE_DIR/bootstrap.json" <<'PY'
import json,sys
src,out=sys.argv[1:3]
lines=open(src,encoding="utf-8").read().splitlines()
obj=None
for line in reversed(lines):
    try:
        x=json.loads(line)
    except Exception:
        continue
    if x.get("status")=="HOST_BOOTSTRAP_PASS":
        obj=x
        break
if not obj:
    raise SystemExit("BOOTSTRAP_EVIDENCE_NOT_FOUND")
open(out,"w",encoding="utf-8").write(json.dumps(obj,indent=2)+"\n")
PY

curl -fsS "${ORIGIN%/}/video-ai/health" > "$EVIDENCE_DIR/health.json"

python3 - "$EXPECTED_SHA" "$EVIDENCE_DIR/health.json" <<'PY'
import json,sys
expected,path=sys.argv[1:3]
d=json.load(open(path,encoding="utf-8"))
if d.get("ok") is not True:
    raise SystemExit("HEALTH_NOT_OK")
if d.get("buildSha") != expected:
    raise SystemExit(f"HEALTH_SHA_MISMATCH:{d.get('buildSha')}")
PY

printf '{"schema":"tgg.video-ai.host-evidence-collector.v1","status":"PASS","dir":"%s","files":["canary.json","bootstrap.json","health.json"]}\n' "$EVIDENCE_DIR"
