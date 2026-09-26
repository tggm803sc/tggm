#!/usr/bin/env python3
import argparse,datetime,hashlib,json,os,pathlib,tempfile,sys

EXPECTED_SHA="b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3"

p=argparse.ArgumentParser()
p.add_argument("--receipt",required=True)
p.add_argument("--server",required=True)
p.add_argument("--ledger",required=True)
p.add_argument("--max-age-seconds",type=int,default=900)
p.add_argument("--check-only",action="store_true")
a=p.parse_args()

receipt_path=pathlib.Path(a.receipt)
server_path=pathlib.Path(a.server)
ledger_path=pathlib.Path(a.ledger)

errors=[]
try:
    d=json.loads(receipt_path.read_text())
except Exception:
    raise SystemExit("FAIL: invalid install receipt JSON")

if d.get("schema")!="tgg.host-agent.r231.install.receipt.v2":
    errors.append("invalid-receipt-schema")
if d.get("status")!="PASS":
    errors.append("receipt-not-pass")
if str(d.get("candidateSha") or "").lower()!=EXPECTED_SHA:
    errors.append("candidate-sha-mismatch")
nonce=str(d.get("installNonce") or "").strip()
if len(nonce)<32:
    errors.append("invalid-install-nonce")
if d.get("r232PromotionExecuted") is not False:
    errors.append("receipt-r232-state-invalid")

try:
    ts=datetime.datetime.fromisoformat(str(d.get("installedAt") or "").replace("Z","+00:00"))
    age=(datetime.datetime.now(datetime.timezone.utc)-ts).total_seconds()
    if age < -60:
        errors.append("future-dated-install-receipt")
    elif age > a.max_age_seconds:
        errors.append("stale-install-receipt")
except Exception:
    errors.append("invalid-installed-at")

if not server_path.is_file():
    errors.append("live-server-missing")
else:
    current=hashlib.sha256(server_path.read_bytes()).hexdigest()
    if d.get("installedServerSha256")!=current:
        errors.append("installed-server-sha-mismatch")
    if d.get("candidateServerSha256")!=current:
        errors.append("candidate-server-sha-mismatch")

used=set()
if ledger_path.exists():
    try:
        ld=json.loads(ledger_path.read_text())
        used=set(map(str,ld.get("installNonces",[])))
    except Exception:
        errors.append("install-ledger-invalid")
if nonce and nonce in used:
    errors.append("replayed-install-receipt")

if errors:
    print(json.dumps({
        "schema":"tgg.host-agent.install.receipt.verification.v1",
        "status":"FAIL",
        "errors":errors
    },indent=2))
    raise SystemExit(1)

if not a.check_only:
    ledger_path.parent.mkdir(parents=True,exist_ok=True)
    used.add(nonce)
    fd,tmp=tempfile.mkstemp(prefix=ledger_path.name+".",dir=str(ledger_path.parent))
    with os.fdopen(fd,"w") as f:
        json.dump({"installNonces":sorted(used)},f,indent=2)
        f.flush(); os.fsync(f.fileno())
    os.replace(tmp,ledger_path)

result={
    "schema":"tgg.host-agent.install.receipt.verification.v1",
    "status":"PASS",
    "candidateSha":EXPECTED_SHA,
    "installNonce":nonce,
    "installedAt":d.get("installedAt"),
    "installedServerSha256":d.get("installedServerSha256"),
    "consumed":not a.check_only,
    "checkOnly":a.check_only
}
print(json.dumps(result,indent=2))
