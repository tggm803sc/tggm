#!/usr/bin/env python3
import argparse,json,pathlib,sys

EXPECTED_SHA="b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3"
EXPECTED_CONTROL_PLANE_COMMIT="341dd14e4968abf8ca75a8809de06ba9d6ca78fa"

p=argparse.ArgumentParser()
p.add_argument("--handoff",required=True)
p.add_argument("--require-https",action="store_true")
a=p.parse_args()

d=json.loads(pathlib.Path(a.handoff).read_text())
errors=[]

if d.get("schema")!="tgg.oci.apply.handoff.v2":
    errors.append("invalid-schema")
if d.get("candidateSha")!=EXPECTED_SHA:
    errors.append("candidate-sha-mismatch")
if str(d.get("controlPlaneCommit") or "").lower()!=EXPECTED_CONTROL_PLANE_COMMIT:
    errors.append("control-plane-commit-mismatch")
if not str(d.get("controlInstanceId") or "").startswith("ocid1.instance."):
    errors.append("invalid-instance-id")
if not d.get("controlPublicIp"):
    errors.append("missing-public-ip")
if d.get("r232PromotionExecuted") is not False:
    errors.append("r232-state-invalid")

url=str(d.get("hostAgentUrl") or "")
if a.require_https:
    if d.get("status")!="HTTPS_HOST_AGENT_CONFIGURED_PENDING_LIVE_CHECK":
        errors.append("https-status-not-ready")
    if not url.startswith("https://"):
        errors.append("https-host-agent-url-missing")

print(json.dumps({
  "schema":"tgg.oci.apply.handoff.verification.v1",
  "status":"PASS" if not errors else "FAIL",
  "errors":errors,
  "candidateSha":EXPECTED_SHA,
  "controlPlaneCommit":EXPECTED_CONTROL_PLANE_COMMIT,
  "hostAgentUrl":url or None,
  "r232PromotionExecuted":False
},indent=2))
sys.exit(0 if not errors else 1)
