#!/usr/bin/env python3
import argparse,datetime,json,pathlib,sys

EXPECTED_SHA="b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3"

p=argparse.ArgumentParser()
p.add_argument("--request",required=True)
p.add_argument("--proof",required=True)
p.add_argument("--used-receipts",default="")
p.add_argument("--out",required=True)
a=p.parse_args()

req=json.loads(pathlib.Path(a.request).read_text())
proof=json.loads(pathlib.Path(a.proof).read_text())
errors=[]

if req.get("schema")!="tgg.r232.promotion.request.v3":
    errors.append("invalid-request-schema")
if req.get("candidateSha")!=EXPECTED_SHA:
    errors.append("request-candidate-sha-mismatch")
if proof.get("schema")!="tgg.r232.promotion.proof.v3":
    errors.append("invalid-proof-schema")

candidate=str(proof.get("candidateSha") or "").lower()
served=str(proof.get("servedSha") or proof.get("deployedSha") or proof.get("exactSha") or "").lower()
if candidate!=EXPECTED_SHA:
    errors.append("proof-candidate-sha-mismatch")
if served!=EXPECTED_SHA:
    errors.append("proof-served-sha-mismatch")

bindings=[
 ("handoffSha256","handoff-sha-mismatch"),
 ("r11EvidenceSha256","r11-evidence-hash-mismatch"),
 ("r231SnapshotSha256","r231-snapshot-sha-mismatch"),
 ("r231EvidenceHash","r231-evidence-hash-mismatch"),
 ("r231SnapshotNonce","r231-snapshot-nonce-mismatch"),
 ("promotionNonce","promotion-nonce-mismatch"),
]
for field,err in bindings:
    if proof.get(field)!=req.get(field):
        errors.append(err)

receipt_id=str(proof.get("receiptId") or proof.get("promotionReceipt") or "").strip()
if not receipt_id:
    errors.append("missing-receipt-id")

def parse_time(value,label):
    try:
        return datetime.datetime.fromisoformat(str(value).replace("Z","+00:00"))
    except Exception:
        errors.append(f"invalid-{label}-timestamp")
        return None

now=datetime.datetime.now(datetime.timezone.utc)
max_age=int(req.get("maxReceiptAgeSeconds",600))

receipt_at=parse_time(proof.get("receiptAt") or proof.get("promotedAt") or "","receipt")
if receipt_at:
    age=(now-receipt_at).total_seconds()
    if age < -60: errors.append("future-dated-receipt")
    elif age > max_age: errors.append("stale-receipt")

requested_at=parse_time(req.get("requestedAt") or "","request")
if requested_at:
    age=(now-requested_at).total_seconds()
    if age < -60: errors.append("future-dated-request")
    elif age > max_age: errors.append("stale-promotion-request")

used=set()
used_path=pathlib.Path(a.used_receipts) if a.used_receipts else None
if used_path and used_path.exists():
    try:
        data=json.loads(used_path.read_text())
        used=set(map(str,data.get("receiptIds",[]) if isinstance(data,dict) else data))
    except Exception:
        errors.append("used-receipt-ledger-invalid")
if receipt_id and receipt_id in used:
    errors.append("replayed-receipt-id")

status="PASS" if not errors else "FAIL"
result={
  "schema":"tgg.r232.promotion.proof.verification.v3",
  "status":status,
  "errors":errors,
  "candidateSha":EXPECTED_SHA,
  "servedSha":served,
  "handoffSha256":req.get("handoffSha256"),
  "r11EvidenceSha256":req.get("r11EvidenceSha256"),
  "r231SnapshotSha256":req.get("r231SnapshotSha256"),
  "r231EvidenceHash":req.get("r231EvidenceHash"),
  "r231SnapshotNonce":req.get("r231SnapshotNonce"),
  "promotionNonce":req.get("promotionNonce"),
  "receiptId":receipt_id,
  "receiptAt":proof.get("receiptAt") or proof.get("promotedAt"),
  "r232PromotionExecuted":False
}
pathlib.Path(a.out).write_text(json.dumps(result,indent=2))

if errors:
    print(json.dumps(result,indent=2))
    raise SystemExit(1)

if used_path:
    used.add(receipt_id)
    used_path.parent.mkdir(parents=True,exist_ok=True)
    used_path.write_text(json.dumps({"receiptIds":sorted(used)},indent=2))

print(json.dumps(result,indent=2))
