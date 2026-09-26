#!/usr/bin/env python3
import argparse,json,os,pathlib,re,sys,tempfile

EXPECTED_SHA="b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3"
EXPECTED_CONTROL_PLANE_COMMIT="7c971ec44be0daf00d81807f588db264239f5fe4"

p=argparse.ArgumentParser()
p.add_argument("--terraform-output",required=True)
p.add_argument("--out-dir",required=True)
p.add_argument("--https-host-agent-url",default="")
p.add_argument("--allow-paid-game-node",action="store_true")
a=p.parse_args()

src=pathlib.Path(a.terraform_output)
out=pathlib.Path(a.out_dir)
out.mkdir(parents=True,exist_ok=True)

try:
    raw=json.loads(src.read_text())
except Exception as e:
    raise SystemExit(f"FAIL: invalid Terraform output JSON: {e}")

def value(name, default=None):
    v=raw.get(name, default)
    if isinstance(v,dict) and "value" in v:
        return v["value"]
    return v

public_ip=str(value("control_public_ip") or "").strip()
private_ip=str(value("control_private_ip") or "").strip()
instance_id=str(value("control_instance_id") or "").strip()
coolify_url=str(value("coolify_setup_url") or "").strip()
candidate=str(value("tgg_candidate_sha") or "").lower()
control_plane_commit=str(value("tgg_control_plane_commit") or "").lower()
game_enabled=bool(value("game_node_enabled",False))
game_public_ip=value("game_public_ip")
game_private_ip=value("game_private_ip")

errors=[]
if not public_ip:
    errors.append("missing-control-public-ip")
if not private_ip:
    errors.append("missing-control-private-ip")
if not instance_id.startswith("ocid1.instance."):
    errors.append("invalid-control-instance-id")
if not coolify_url.startswith("http://"):
    errors.append("invalid-coolify-setup-url")
if candidate!=EXPECTED_SHA:
    errors.append("candidate-sha-mismatch")
if control_plane_commit!=EXPECTED_CONTROL_PLANE_COMMIT:
    errors.append("control-plane-commit-mismatch")
if game_enabled and not a.allow_paid_game_node:
    errors.append("paid-game-node-enabled-without-explicit-allow")

https_url=a.https_host_agent_url.strip().rstrip("/")
if https_url and not https_url.startswith("https://"):
    errors.append("host-agent-url-must-be-https")

if errors:
    result={
      "schema":"tgg.oci.apply.handoff.v2",
      "status":"FAIL",
      "errors":errors,
      "candidateSha":candidate or None,
      "controlPlaneCommit":control_plane_commit or None,
      "r232PromotionExecuted":False
    }
    print(json.dumps(result,indent=2))
    raise SystemExit(1)

status="HTTPS_HOST_AGENT_CONFIGURED_PENDING_LIVE_CHECK" if https_url else "OCI_APPLIED_HTTPS_REQUIRED"

handoff={
  "schema":"tgg.oci.apply.handoff.v2",
  "status":status,
  "candidateSha":EXPECTED_SHA,
  "controlPlaneCommit":EXPECTED_CONTROL_PLANE_COMMIT,
  "controlInstanceId":instance_id,
  "controlPublicIp":public_ip,
  "controlPrivateIp":private_ip,
  "coolifySetupUrl":coolify_url,
  "hostAgentUrl":https_url or None,
  "gameNodeEnabled":game_enabled,
  "gamePublicIp":game_public_ip,
  "gamePrivateIp":game_private_ip,
  "nextStep":"run npm run check:tgg-live-readiness after HTTPS Host Agent is configured" if https_url else "finish Coolify/domain/HTTPS and rerun this bridge with --https-host-agent-url",
  "r232PromotionExecuted":False
}

def atomic_write(path,text):
    fd,tmp=tempfile.mkstemp(prefix=path.name+".",dir=str(path.parent))
    with os.fdopen(fd,"w") as f:
        f.write(text); f.flush(); os.fsync(f.fileno())
    os.replace(tmp,path)

atomic_write(out/"OCI_APPLY_HANDOFF.json",json.dumps(handoff,indent=2)+"\n")

env_lines=[
  f"TGG_R227_CANDIDATE_SHA={EXPECTED_SHA}",
  f"TGG_CONTROL_PLANE_COMMIT={EXPECTED_CONTROL_PLANE_COMMIT}",
  f"TGG_OCI_CONTROL_PUBLIC_IP={public_ip}",
  f"TGG_OCI_CONTROL_PRIVATE_IP={private_ip}",
  f"TGG_OCI_CONTROL_INSTANCE_ID={instance_id}"
]
if https_url:
    env_lines.append(f"TGG_HOST_AGENT_URL={https_url}")
atomic_write(out/"tgg-live.env","\n".join(env_lines)+"\n")

print(json.dumps(handoff,indent=2))
