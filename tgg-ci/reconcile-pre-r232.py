#!/usr/bin/env python3
import argparse, json, pathlib, sys, hashlib

EXPECTED_CANDIDATE="b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3"
EXPECTED_CONTROL_PLANE="7c971ec44be0daf00d81807f588db264239f5fe4"

p=argparse.ArgumentParser()
p.add_argument("--oci-handoff", required=True)
p.add_argument("--https-finalization", required=True)
p.add_argument("--live-readiness", required=True)
p.add_argument("--r231-receipt", required=True)
p.add_argument("--out", required=True)
a=p.parse_args()

def load(path):
    return json.loads(pathlib.Path(path).read_text())

oci=load(a.oci_handoff)
https=load(a.https_finalization)
live=load(a.live_readiness)
r231=load(a.r231_receipt)

errors=[]

if oci.get("schema")!="tgg.oci.apply.handoff.v2":
    errors.append("oci-handoff-schema")
if oci.get("candidateSha")!=EXPECTED_CANDIDATE:
    errors.append("oci-candidate-mismatch")
if str(oci.get("controlPlaneCommit") or "").lower()!=EXPECTED_CONTROL_PLANE:
    errors.append("oci-control-plane-mismatch")
if not str(oci.get("controlInstanceId") or "").startswith("ocid1.instance."):
    errors.append("oci-instance-id")
if not oci.get("controlPublicIp"):
    errors.append("oci-public-ip")
if oci.get("r232PromotionExecuted") is not False:
    errors.append("oci-r232-state")

if https.get("schema")!="tgg.host-agent.https.finalization.v1":
    errors.append("https-finalization-schema")
if https.get("status")!="HTTPS_HOST_AGENT_READY":
    errors.append("https-not-ready")
host_url=str(https.get("hostAgentUrl") or "")
if not host_url.startswith("https://"):
    errors.append("https-host-url")
if https.get("tokenConfigured") is not True:
    errors.append("token-not-configured")
token_sha=str(https.get("tokenSha256") or "")
if len(token_sha)!=64:
    errors.append("token-fingerprint-invalid")
if https.get("unauthorizedProbe")!=401:
    errors.append("unauthorized-probe")
if https.get("authenticatedNoopProbe")!=404:
    errors.append("authenticated-probe")
if https.get("r232PromotionExecuted") is not False:
    errors.append("https-r232-state")

if live.get("schema")!="tgg.live.readiness.v1":
    errors.append("live-readiness-schema")
if live.get("status")!="READY":
    errors.append("live-readiness-not-ready")
if live.get("r231SnapshotIntakeAdvertised") is not True:
    errors.append("r231-intake-not-advertised")
if live.get("promotionReceiptAdvertised") is not True:
    errors.append("promotion-receipt-not-advertised")
if live.get("r232PromotionExecuted") is not False:
    errors.append("live-r232-state")

r231_schema=str(r231.get("schema") or "")
if r231_schema not in ("tgg.r231.intake.receipt.v1","tgg.r231.snapshot.receipt.v1"):
    errors.append("r231-receipt-schema")
r231_status=str(r231.get("status") or r231.get("result") or "")
if r231_status not in ("PASS","ACCEPTED","STORED"):
    errors.append("r231-receipt-status")
r231_candidate=str(r231.get("candidateSha") or r231.get("candidate_sha") or "").lower()
if r231_candidate and r231_candidate!=EXPECTED_CANDIDATE:
    errors.append("r231-candidate-mismatch")

bindings={
  "candidateSha":EXPECTED_CANDIDATE,
  "controlPlaneCommit":EXPECTED_CONTROL_PLANE,
  "controlInstanceId":oci.get("controlInstanceId"),
  "controlPublicIp":oci.get("controlPublicIp"),
  "hostAgentUrl":host_url,
  "tokenSha256":token_sha or None,
  "hostId":live.get("hostId"),
  "r231ReceiptId":r231.get("receiptId") or r231.get("receipt") or r231.get("id")
}
bindings_sha=hashlib.sha256(json.dumps(bindings,sort_keys=True,separators=(",",":")).encode()).hexdigest()

doc={
  "schema":"tgg.pre-r232.readiness.v1",
  "status":"PRE_R232_READY" if not errors else "BLOCKED",
  "errors":errors,
  "bindings":bindings,
  "bindingsSha256":bindings_sha,
  "checks":{
    "ociApply":"PASS" if not any(x.startswith("oci-") for x in errors) else "FAIL",
    "httpsFinalization":"PASS" if not any(x.startswith("https-") or x.endswith("-probe") or x.startswith("token-") for x in errors) else "FAIL",
    "liveReadiness":"PASS" if not any(x.startswith("live-") or x.endswith("-advertised") for x in errors) else "FAIL",
    "r231Intake":"PASS" if not any(x.startswith("r231-") for x in errors) else "FAIL"
  },
  "r232PromotionExecuted":False
}

path=pathlib.Path(a.out)
path.parent.mkdir(parents=True,exist_ok=True)
path.write_text(json.dumps(doc,indent=2)+"\n")
print(json.dumps(doc,indent=2))
sys.exit(0 if not errors else 1)
