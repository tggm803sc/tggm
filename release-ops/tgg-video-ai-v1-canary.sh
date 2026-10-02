#!/usr/bin/env bash
set -euo pipefail

ROOT="${TGG_RELEASE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
EXPECTED_SHA="${TGG_VIDEO_AI_EXPECTED_SHA:-469518eff0fe1641f6889c5ff78c2f3c0df189c7}"
PROJECT="${TGG_VIDEO_AI_CANARY_PROJECT:-tgg-video-ai-canary}"
COMPOSE="${TGG_COMPOSE_FILE:-$ROOT/deployment/DockerComposeTopology.yml}"
CANARY_PORT="${TGG_VIDEO_AI_CANARY_PORT:-18050}"
CANARY_ORIGIN="http://127.0.0.1:${CANARY_PORT}"

fail(){
  printf '{"status":"HOLD","stage":"canary","reason":"%s"}\n' "$1" >&2
  exit "${2:-1}"
}

actual="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)"
[[ "$actual" == "$EXPECTED_SHA" ]] || fail "WORKTREE_SHA_MISMATCH" 22

for cmd in docker curl ffmpeg ffprobe python3; do
  command -v "$cmd" >/dev/null 2>&1 || fail "MISSING_${cmd^^}" 23
done
docker compose version >/dev/null 2>&1 || fail "DOCKER_COMPOSE_UNAVAILABLE" 24

cleanup(){
  docker compose -p "$PROJECT" -f "$COMPOSE" down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

export TGG_BUILD_SHA="$EXPECTED_SHA"
export TGG_VIDEO_AI_PUBLIC_BASE_URL="$CANARY_ORIGIN"
export TGG_VIDEO_AI_ALLOWED_ORIGINS="http://127.0.0.1:${CANARY_PORT}"

override="$(mktemp)"
cat > "$override" <<YAML
services:
  video-ai:
    ports:
      - "${CANARY_PORT}:10050"
  web:
    ports: []
  postgres:
    ports: []
YAML

docker compose -p "$PROJECT" -f "$COMPOSE" -f "$override" config >/dev/null
docker compose -p "$PROJECT" -f "$COMPOSE" -f "$override" build video-ai video-ai-worker
docker compose -p "$PROJECT" -f "$COMPOSE" -f "$override" up -d video-ai video-ai-worker

for i in $(seq 1 45); do
  if curl -fsS --connect-timeout 2 --max-time 5 "$CANARY_ORIGIN/health" > /tmp/tgg-video-ai-canary-health.json 2>/dev/null; then
    break
  fi
  [[ "$i" -lt 45 ]] || fail "CANARY_HEALTH_TIMEOUT" 31
  sleep 2
done

python3 - "$EXPECTED_SHA" /tmp/tgg-video-ai-canary-health.json <<'PY'
import json,sys
expected=sys.argv[1]
data=json.load(open(sys.argv[2]))
if data.get("ok") is not True:
    raise SystemExit("health_not_ok")
if data.get("buildSha") != expected:
    raise SystemExit(f"build_sha_mismatch:{data.get('buildSha')}")
PY

export TGG_PROD_ORIGIN="$CANARY_ORIGIN"
export TGG_VIDEO_AI_PUBLIC_BASE_URL="$CANARY_ORIGIN"
"$ROOT/deployment/tgg-video-ai-live-proof.sh" > /tmp/tgg-video-ai-canary-proof.json

python3 - /tmp/tgg-video-ai-canary-proof.json <<'PY'
import json,sys
text=open(sys.argv[1]).read().strip().splitlines()[-1]
data=json.loads(text)
if data.get("status") != "PASS":
    raise SystemExit("live_proof_not_pass")
print(json.dumps({
  "schema":"tgg.video-ai.canary-proof.v1",
  "status":"PASS",
  "buildSha":data.get("buildSha"),
  "promotion":"CANARY_PASS_PRODUCTION_CUTOVER_STILL_REQUIRED"
},separators=(",",":")))
PY
