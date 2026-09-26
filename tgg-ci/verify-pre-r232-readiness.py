#!/usr/bin/env python3
import argparse,json,pathlib,sys,hashlib

EXPECTED_CANDIDATE="b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3"
EXPECTED_CONTROL_PLANE="7c971ec44be0daf00d81807f588db264239f5fe4"

p=argparse.ArgumentParser()
p.add_argument("--readiness",required=True)
a=p.parse_args()

path=pathlib.Path(a.readiness)
doc=json.loads(path.read_text())
errors=[]

if doc.get("schema")!="tgg.pre-r232.readiness.v1":
    errors.append("schema")
if doc.get("status")!="PRE_R232_READY":
    errors.append("status")
if doc.get("errors") not in ([],None):
    errors.append("embedded-errors")
if doc.get("r232PromotionExecuted") is not False:
    errors.append("r232-state")

bindings=doc.get("bindings") or {}
if bindings.get("candidateSha")!=EXPECTED_CANDIDATE:
    errors.append("candidate")
if str(bindings.get("controlPlaneCommit") or "").lower()!=EXPECTED_CONTROL_PLANE:
    errors.append("control-plane")
if not str(bindings.get("controlInstanceId") or "").startswith("ocid1.instance."):
    errors.append("instance")
if not str(bindings.get("hostAgentUrl") or "").startswith("https://"):
    errors.append("host-url")
if len(str(bindings.get("tokenSha256") or ""))!=64:
    errors.append("token-fingerprint")
if not bindings.get("r231ReceiptId"):
    errors.append("r231-receipt-id")

expected_hash=hashlib.sha256(json.dumps(bindings,sort_keys=True,separators=(",",":")).encode()).hexdigest()
if str(doc.get("bindingsSha256") or "").lower()!=expected_hash:
    errors.append("bindings-hash")

checks=doc.get("checks") or {}
for key in ("ociApply","httpsFinalization","liveReadiness","r231Intake"):
    if checks.get(key)!="PASS":
        errors.append("check:"+key)

result={
  "schema":"tgg.pre-r232.readiness.verification.v1",
  "status":"PASS" if not errors else "FAIL",
  "errors":errors,
  "readinessSha256":hashlib.sha256(path.read_bytes()).hexdigest(),
  "bindingsSha256":expected_hash,
  "candidateSha":EXPECTED_CANDIDATE,
  "r232PromotionExecuted":False
}
print(json.dumps(result,indent=2))
sys.exit(0 if not errors else 1)
