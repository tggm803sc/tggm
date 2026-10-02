#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_SHA="${TGG_VIDEO_AI_EXPECTED_SHA:-}"
[[ -n "$EXPECTED_SHA" ]] || { echo '{"status":"HOLD","reason":"TGG_VIDEO_AI_EXPECTED_SHA_REQUIRED"}'; exit 22; }

actual="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)"
[[ "$actual" == "$EXPECTED_SHA" ]] || {
  printf '{"status":"HOLD","reason":"WORKTREE_SHA_MISMATCH","expected":"%s","actual":"%s"}\n' "$EXPECTED_SHA" "$actual"
  exit 23
}

for cmd in docker curl ffmpeg ffprobe python3; do
  command -v "$cmd" >/dev/null 2>&1 || {
    printf '{"status":"HOLD","reason":"MISSING_HOST_DEPENDENCY","dependency":"%s"}\n' "$cmd"
    exit 24
  }
done

docker compose version >/dev/null 2>&1 || { echo '{"status":"HOLD","reason":"DOCKER_COMPOSE_UNAVAILABLE"}'; exit 25; }

export TGG_BUILD_SHA="$EXPECTED_SHA"

"$ROOT/deployment/tgg-video-ai-cutover.sh"

export TGG_PROD_ORIGIN="${TGG_PROD_ORIGIN:-${TGG_PUBLIC_BASE_URL:-}}"
export TGG_VIDEO_AI_PUBLIC_BASE_URL="${TGG_PROD_ORIGIN%/}/video-ai"
"$ROOT/deployment/tgg-video-ai-live-proof.sh"

printf '{"status":"HOST_BOOTSTRAP_PASS","sha":"%s","studioPath":"/video-studio","videoAiPath":"/video-ai"}\n' "$EXPECTED_SHA"
