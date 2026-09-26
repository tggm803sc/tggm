#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${TGG_CI_RECEIPT:-$ROOT/tgg-ci/latest-check.json}"
TMP="${OUT}.pending"
STAMP="$(date -u +%FT%TZ)"

cd "$ROOT"

set +e
CANONICAL_OUTPUT="$(node scripts/tgg-canonical-gate.mjs 2>&1)"
CANONICAL_RC=$?
ACTIVATION_OUTPUT="$(npm run --silent check:tgg-activation 2>&1)"
ACTIVATION_RC=$?
SOURCE_OUTPUT="$(npm run --silent check:tgg-source 2>&1)"
SOURCE_RC=$?
PROJECTS_OUTPUT="$(npm run --silent check:tgg-projects 2>&1)"
PROJECTS_RC=$?
HIGGSFIELD_OUTPUT="$(npm run --silent check:tgg-higgsfield 2>&1)"
HIGGSFIELD_RC=$?
set -e

STATUS="PASS"
if [ "$CANONICAL_RC" -ne 0 ] || [ "$ACTIVATION_RC" -ne 0 ] || [ "$SOURCE_RC" -ne 0 ] || [ "$PROJECTS_RC" -ne 0 ] || [ "$HIGGSFIELD_RC" -ne 0 ]; then
  STATUS="FAIL"
fi

export STATUS STAMP CANONICAL_RC ACTIVATION_RC SOURCE_RC PROJECTS_RC HIGGSFIELD_RC
export CANONICAL_OUTPUT ACTIVATION_OUTPUT SOURCE_OUTPUT PROJECTS_OUTPUT HIGGSFIELD_OUTPUT
python3 - "$TMP" <<'PY'
import json,os,pathlib,sys
out=pathlib.Path(sys.argv[1])
doc={
  "schema":"tgg.ci.canonical.receipt.v1",
  "authority":"TGG",
  "status":os.environ["STATUS"],
  "createdAt":os.environ["STAMP"],
  "checks":{
    "canonical":{"code":int(os.environ["CANONICAL_RC"]),"output":os.environ["CANONICAL_OUTPUT"][-12000:]},
    "activation":{"code":int(os.environ["ACTIVATION_RC"]),"output":os.environ["ACTIVATION_OUTPUT"][-12000:]},
    "source":{"code":int(os.environ["SOURCE_RC"]),"output":os.environ["SOURCE_OUTPUT"][-12000:]},
    "projects":{"code":int(os.environ["PROJECTS_RC"]),"output":os.environ["PROJECTS_OUTPUT"][-12000:]},
    "higgsfield":{"code":int(os.environ["HIGGSFIELD_RC"]),"output":os.environ["HIGGSFIELD_OUTPUT"][-12000:]}
  },
  "productionExecution":"NOT_RUN",
  "r232Promotion":"NOT_EXECUTED"
}
out.write_text(json.dumps(doc,indent=2))
PY

mv -f "$TMP" "$OUT"
cat "$OUT"

[ "$STATUS" = "PASS" ]
