#!/usr/bin/env python3
import argparse,datetime,hashlib,json,pathlib,secrets

EXPECTED_SHA="b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3"
MAX_SNAPSHOT_AGE_SECONDS=600

p=argparse.ArgumentParser()
p.add_argument("--handoff",required=True)
p.add_argument("--r231-snapshot",required=True)
p.add_argument("--out",required=True)
a=p.parse_args()

handoff_path=pathlib.Path(a.handoff)
snapshot_path=pathlib.Path(a.r231_snapshot)
handoff=json.loads(handoff_path.read_text())
snapshot=json.loads(snapshot_path.read_text())

if handoff.get("status")!="PROMOTABLE_NOT_EXECUTED":
    raise SystemExit("FAIL: handoff status is not PROMOTABLE_NOT_EXECUTED")
if handoff.get("candidateSha")!=EXPECTED_SHA:
    raise SystemExit("FAIL: handoff candidate SHA mismatch")
if handoff.get("r232PromotionExecuted") is not False:
    raise SystemExit("FAIL: handoff incorrectly claims R232 execution")
if handoff.get("readyForR232") is not True:
    raise SystemExit("FAIL: handoff is not readyForR232")

if snapshot.get("schema")!="tgg.certification.snapshot.v1":
    raise SystemExit("FAIL: invalid R231 snapshot schema")
if str(snapshot.get("candidateSha") or "").lower()!=EXPECTED_SHA:
    raise SystemExit("FAIL: R231 snapshot candidate SHA mismatch")
if str(snapshot.get("servedSha") or "").lower()!=EXPECTED_SHA:
    raise SystemExit("FAIL: R231 snapshot served SHA mismatch")

evidence_hash=str(snapshot.get("evidenceHash") or "").lower()
snapshot_nonce=str(snapshot.get("nonce") or "").strip()
if len(evidence_hash)!=64 or any(c not in "0123456789abcdef" for c in evidence_hash):
    raise SystemExit("FAIL: invalid R231 evidenceHash")
if not snapshot_nonce:
    raise SystemExit("FAIL: missing R231 snapshot nonce")

certified_at=str(snapshot.get("certifiedAt") or "")
try:
    cert=datetime.datetime.fromisoformat(certified_at.replace("Z","+00:00"))
    age=(datetime.datetime.now(datetime.timezone.utc)-cert).total_seconds()
    if age < -60 or age > MAX_SNAPSHOT_AGE_SECONDS:
        raise SystemExit("FAIL: R231 snapshot is not fresh")
except ValueError:
    raise SystemExit("FAIL: invalid R231 certifiedAt timestamp")

r11_hash=str(handoff.get("r11EvidenceSha256") or "").lower()
if len(r11_hash)!=64 or any(c not in "0123456789abcdef" for c in r11_hash):
    raise SystemExit("FAIL: invalid R11 evidence hash")

request={
  "schema":"tgg.r232.promotion.request.v3",
  "candidateSha":EXPECTED_SHA,
  "servedShaRequired":EXPECTED_SHA,
  "handoffSha256":hashlib.sha256(handoff_path.read_bytes()).hexdigest(),
  "r11EvidenceSha256":r11_hash,
  "r231SnapshotSha256":hashlib.sha256(snapshot_path.read_bytes()).hexdigest(),
  "r231EvidenceHash":evidence_hash,
  "r231SnapshotNonce":snapshot_nonce,
  "r231CertifiedAt":certified_at,
  "promotionNonce":secrets.token_hex(32),
  "requestedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "maxReceiptAgeSeconds":600,
  "requireExactServedSha":True,
  "requireBoundHandoffSha":True,
  "requireBoundR11EvidenceHash":True,
  "requireBoundR231SnapshotSha":True,
  "requireBoundR231EvidenceHash":True,
  "requireBoundR231SnapshotNonce":True,
  "requireBoundPromotionNonce":True,
  "requireUniqueReceiptId":True,
  "failClosed":True,
  "r232PromotionExecuted":False
}
pathlib.Path(a.out).write_text(json.dumps(request,indent=2))
print(json.dumps(request,indent=2))
