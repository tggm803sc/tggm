#!/usr/bin/env bash
# Verify the TGG World career API against a hosted PostgreSQL.
#
#   DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" bash scripts/verify-hosted-db.sh
#
# or put DATABASE_URL in tgg-app/.env.local (already gitignored) and run it with
# no arguments. The script never prints the connection string: output names the
# host and database only.
#
# It applies migrations, starts the app on :3200, waits for /api/world/health to
# report the database up, then runs tgg-app/scripts/hosted-db-proof.mjs, which
# asserts the eight required behaviours, seeds two throwaway players and removes
# their world rows again (KEEP_PROOF_PLAYERS=1 leaves them for inspection).
#
# Used by .github/workflows/tgg-world-db-verify.yml, so the same command runs
# on a laptop and in CI.
set -uo pipefail
export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/tgg-app" || exit 1

if [ -z "${DATABASE_URL:-}" ] && [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "No DATABASE_URL. Put it in tgg-app/.env.local or pass it in the environment." >&2
  exit 2
fi

echo "== prisma migrate deploy =="
npx prisma migrate deploy || exit 3

echo "== start app on :3200 =="
npx next dev -p 3200 -H 0.0.0.0 > /tmp/tgg-hosted-next.log 2>&1 &
app_pid=$!
trap 'kill "$app_pid" 2>/dev/null' EXIT

for i in $(seq 1 40); do
  body=$(curl -s -m 5 http://127.0.0.1:3200/api/world/health || true)
  if echo "$body" | grep -q '"database":"up"'; then
    echo "health: $body"
    break
  fi
  if [ "$i" = 40 ]; then
    echo "app never reported the database up; last body: $body" >&2
    tail -30 /tmp/tgg-hosted-next.log >&2
    exit 4
  fi
  sleep 3
done

echo "== endpoint proofs =="
APP_URL=http://127.0.0.1:3200 node scripts/hosted-db-proof.mjs
status=$?
echo "== done (exit $status) =="
exit "$status"
