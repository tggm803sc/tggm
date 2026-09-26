#!/usr/bin/env python3
import argparse,json,pathlib

p=argparse.ArgumentParser()
p.add_argument("--verification",required=True)
p.add_argument("--out",required=True)
a=p.parse_args()

v=json.loads(pathlib.Path(a.verification).read_text())
if v.get("status")!="PASS":
    raise SystemExit("FAIL: promotion proof verification is not PASS")
if v.get("r232PromotionExecuted") is not False:
    raise SystemExit("FAIL: verification state invalid")

doc={
  "schema":"tgg.r232.browser.promotion-proof.v2",
  "servedSha":v["servedSha"],
  "promotionReceipt":v["receiptId"],
  "receiptAt":v["receiptAt"],
  "evidenceHash":v["r231EvidenceHash"],
  "snapshotNonce":v["r231SnapshotNonce"],
  "handoffSha256":v["handoffSha256"],
  "r11EvidenceSha256":v["r11EvidenceSha256"],
  "r231SnapshotSha256":v["r231SnapshotSha256"],
  "promotionNonce":v["promotionNonce"]
}
pathlib.Path(a.out).write_text(json.dumps(doc,indent=2))
print(json.dumps(doc,indent=2))
