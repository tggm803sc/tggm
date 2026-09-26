#!/usr/bin/env python3
import argparse,datetime,hashlib,json,os,pathlib,tempfile,sys

EXPECTED_SHA="b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3"
MAX_AGE=600

p=argparse.ArgumentParser()
p.add_argument("--input",required=True)
p.add_argument("--state-dir",default="/var/lib/tgg/activation-evidence")
p.add_argument("--expected-upload-sha256",default="")
a=p.parse_args()

src=pathlib.Path(a.input)
if not src.is_file():
    raise SystemExit("FAIL: snapshot input missing")

raw=src.read_bytes()
upload_sha=hashlib.sha256(raw).hexdigest()
if a.expected_upload_sha256 and upload_sha.lower()!=a.expected_upload_sha256.lower():
    raise SystemExit("FAIL: uploaded snapshot SHA-256 mismatch")

try:
    d=json.loads(raw)
except Exception:
    raise SystemExit("FAIL: snapshot is not valid JSON")

errors=[]
if d.get("schema")!="tgg.certification.snapshot.v1":
    errors.append("invalid-schema")
if str(d.get("candidateSha") or "").lower()!=EXPECTED_SHA:
    errors.append("candidate-sha-mismatch")
if str(d.get("servedSha") or "").lower()!=EXPECTED_SHA:
    errors.append("served-sha-mismatch")

eh=str(d.get("evidenceHash") or "").lower()
nonce=str(d.get("nonce") or "").strip()
if len(eh)!=64 or any(c not in "0123456789abcdef" for c in eh):
    errors.append("invalid-evidence-hash")
if not nonce:
    errors.append("missing-nonce")

try:
    ts=datetime.datetime.fromisoformat(str(d.get("certifiedAt") or "").replace("Z","+00:00"))
    age=(datetime.datetime.now(datetime.timezone.utc)-ts).total_seconds()
    if age < -60:
        errors.append("future-dated-snapshot")
    elif age > MAX_AGE:
        errors.append("stale-snapshot")
except Exception:
    errors.append("invalid-certified-at")

state_dir=pathlib.Path(a.state_dir)
ledger_path=state_dir/"used-r231-snapshot-nonces.json"
used=set()
if ledger_path.exists():
    try:
        ledger=json.loads(ledger_path.read_text())
        used=set(map(str,ledger.get("nonces",[])))
    except Exception:
        errors.append("nonce-ledger-invalid")
if nonce and nonce in used:
    errors.append("replayed-r231-snapshot-nonce")

if errors:
    print(json.dumps({
        "schema":"tgg.r231.snapshot.intake.v1",
        "status":"FAIL",
        "errors":errors,
        "uploadSha256":upload_sha
    },indent=2))
    raise SystemExit(1)

state_dir.mkdir(parents=True,exist_ok=True)
dest=state_dir/"R231_CERTIFICATION_SNAPSHOT.json"

fd,tmp=tempfile.mkstemp(prefix=dest.name+".",dir=str(state_dir))
with os.fdopen(fd,"wb") as f:
    f.write(raw)
    f.flush()
    os.fsync(f.fileno())
os.replace(tmp,dest)

used.add(nonce)
fd,tmp=tempfile.mkstemp(prefix=ledger_path.name+".",dir=str(state_dir))
with os.fdopen(fd,"w") as f:
    json.dump({"nonces":sorted(used)},f,indent=2)
    f.flush()
    os.fsync(f.fileno())
os.replace(tmp,ledger_path)

receipt={
    "schema":"tgg.r231.snapshot.intake.receipt.v1",
    "status":"PASS",
    "candidateSha":EXPECTED_SHA,
    "servedSha":EXPECTED_SHA,
    "evidenceHash":eh,
    "snapshotNonce":nonce,
    "snapshotSha256":upload_sha,
    "storedPath":str(dest),
    "receivedAt":datetime.datetime.now(datetime.timezone.utc).isoformat()
}
receipt_path=state_dir/"R231_SNAPSHOT_INTAKE_RECEIPT.json"
receipt_path.write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt,indent=2))
