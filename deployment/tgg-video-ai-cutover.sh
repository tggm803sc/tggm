#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="${TGG_COMPOSE_FILE:-$ROOT/deployment/DockerComposeTopology.yml}"
ORIGIN="${TGG_PROD_ORIGIN:-${TGG_PUBLIC_BASE_URL:-}}"
VIDEO_AI_ORIGIN="${TGG_VIDEO_AI_PUBLIC_BASE_URL:-}"

fail(){ printf '{"status":"HOLD","reason":"%s"}\n' "$1" >&2; exit "${2:-1}"; }

canonical(){
  local v="${1:-}"; v="${v%/}"
  [[ -n "$v" ]] || return 1
  if [[ "$v" =~ ^https://[A-Za-z0-9._:-]+$ ]]; then printf '%s\n' "$v"
  elif [[ "$v" =~ ^[A-Za-z0-9._-]+(:[0-9]+)?$ ]]; then printf 'https://%s\n' "$v"
  else return 1
  fi
}

if [[ -z "$ORIGIN" ]]; then
  for f in /etc/tgg/*.env /opt/tgg/.env /srv/tgg/.env /var/lib/tgg/*.env; do
    [[ -f "$f" ]] || continue
    v="$(sed -n 's/^TGG_PUBLIC_BASE_URL=//p' "$f" | tail -n1 | tr -d "\"' ")"
    [[ -z "$v" ]] || { ORIGIN="$v"; break; }
  done
fi

if [[ -z "$ORIGIN" && -f /var/lib/tgg-host-agent/https-finalization.json ]]; then
  ORIGIN="$(sed -nE 's/.*"hostAgentUrl"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' /var/lib/tgg-host-agent/https-finalization.json | head -n1)"
fi

ORIGIN="$(canonical "$ORIGIN" || true)"
[[ -n "$ORIGIN" ]] || fail "TGG_PROD_ORIGIN_UNRESOLVED" 22

if [[ -z "$VIDEO_AI_ORIGIN" ]]; then
  VIDEO_AI_ORIGIN="${ORIGIN%/}/video-ai"
fi
VIDEO_AI_ORIGIN="$(canonical "$VIDEO_AI_ORIGIN" || true)"
[[ -n "$VIDEO_AI_ORIGIN" ]] || fail "TGG_VIDEO_AI_PUBLIC_BASE_URL_INVALID" 23

command -v docker >/dev/null 2>&1 || fail "docker_unavailable" 24
docker compose version >/dev/null 2>&1 || fail "docker_compose_unavailable" 25
command -v curl >/dev/null 2>&1 || fail "curl_unavailable" 26

export TGG_BUILD_SHA="${TGG_BUILD_SHA:-$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || printf unknown)}"
export TGG_PUBLIC_BASE_URL="$ORIGIN"
export TGG_VIDEO_AI_PUBLIC_BASE_URL="$VIDEO_AI_ORIGIN"
export TGG_VIDEO_AI_ALLOWED_ORIGINS="${TGG_VIDEO_AI_ALLOWED_ORIGINS:-$ORIGIN,https://tgg-video-studio-ai-editor.olandusgood.chatgpt.site}"

printf '=== TGG Video AI Cutover ===\n'
printf 'TGG_BUILD_SHA=%s\n' "$TGG_BUILD_SHA"
printf 'TGG_PROD_ORIGIN=%s\n' "$ORIGIN"
printf 'TGG_VIDEO_AI_PUBLIC_BASE_URL=%s\n' "$VIDEO_AI_ORIGIN"

docker compose -f "$COMPOSE" config >/dev/null
docker compose -f "$COMPOSE" build video-ai video-ai-worker web
docker compose -f "$COMPOSE" up -d postgres video-ai video-ai-worker web

for i in $(seq 1 30); do
  if curl -fsS --connect-timeout 3 --max-time 8 "$VIDEO_AI_ORIGIN/health" >/tmp/tgg-video-ai-health.json 2>/dev/null; then
    break
  fi
  [[ "$i" -lt 30 ]] || fail "video_ai_health_unreachable" 31
  sleep 2
done

curl -fsS "$VIDEO_AI_ORIGIN/.well-known/tgg-video-ai.json" >/tmp/tgg-video-ai-discovery.json
curl -fsS "$VIDEO_AI_ORIGIN/openapi.json" >/tmp/tgg-video-ai-openapi.json

python3 - <<'PY'
import json
for p in ["/tmp/tgg-video-ai-health.json","/tmp/tgg-video-ai-discovery.json","/tmp/tgg-video-ai-openapi.json"]:
    with open(p,"r",encoding="utf-8") as f:
        json.load(f)
print('{"status":"STATIC_AND_HTTP_PROOF_PASS"}')
PY

printf '{"status":"CUTOVER_READY","origin":"%s","videoAiOrigin":"%s","studioPath":"/video-studio","promotion":"PENDING_BROWSER_AND_REAL_MEDIA_PROOF"}\n' "$ORIGIN" "$VIDEO_AI_ORIGIN"
