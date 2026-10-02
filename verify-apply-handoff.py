#!/usr/bin/env python3
import argparse,json,pathlib,sys

EXPECTED_SHA="b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3"
EXPECTED_CONTROL_PLANE_COMMIT="7c971ec44be0daf00d81807f588db264239f5fe4"
EXPECTED_VIDEO_AI_SHA="469518eff0fe1641f6889c5ff78c2f3c0df189c7"
EXPECTED_VIDEO_AI_STATUS="VIDEO_AI_RELEASE_PINNED_NOT_DEPLOYED"

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
if d.get("videoAiReleaseSha")!=EXPECTED_VIDEO_AI_SHA:
    errors.append("video-ai-release-sha-mismatch")
if d.get("videoAiReleaseBranch")!="release/tgg-video-ai-v1":
    errors.append("video-ai-release-branch-mismatch")
if d.get("videoAiCheckoutStatus")!=EXPECTED_VIDEO_AI_STATUS:
    errors.append("video-ai-checkout-status-mismatch")
if d.get("videoAiProductionDeployed") is not False:
    errors.append("video-ai-production-state-invalid")

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
  "videoAiReleaseSha":EXPECTED_VIDEO_AI_SHA,
  "videoAiCheckoutStatus":EXPECTED_VIDEO_AI_STATUS,
  "videoAiProductionDeployed":False,
  "r232PromotionExecuted":False
},indent=2))
sys.exit(0 if not errors else 1)
