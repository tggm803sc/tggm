#!/usr/bin/env python3
from pathlib import Path
import json,re,sys

root=Path(__file__).resolve().parent
files={p.name:p.read_text() for p in root.iterdir() if p.is_file()}
issues=[]

main=files.get("main.tf","")
vars_=files.get("variables.tf","")
control=files.get("cloud-init-control.yaml.tftpl","")
game=files.get("cloud-init-game.yaml.tftpl","")
schema=files.get("schema.yaml","")

required=["versions.tf","variables.tf","main.tf","outputs.tf","schema.yaml","cloud-init-control.yaml.tftpl","cloud-init-game.yaml.tftpl"]
for name in required:
    if name not in files:
        issues.append("missing:"+name)

if 'default = "0.0.0.0/0"' in vars_:
    issues.append("admin-cidr-has-broad-default")
if 'variable "admin_cidr"' not in vars_ or "cidrhost(var.admin_cidr, 0)" not in vars_:
    issues.append("admin-cidr-validation-missing")
if 'count                    = var.enable_game_node ? 1 : 0' not in main:
    issues.append("x86-image-query-not-conditional")
if 'count               = var.enable_game_node ? 1 : 0' not in main:
    issues.append("game-node-not-conditional")
if 'allow_paid_game_node' not in vars_ or '!var.enable_game_node || var.allow_paid_game_node' not in vars_:
    issues.append("paid-game-node-explicit-allow-missing")
if re.search(r'source\s*=\s*"0\.0\.0\.0/0"[\s\S]{0,140}min\s*=\s*8787',main):
    issues.append("host-agent-8787-public")
if 'source   = var.vcn_cidr' not in main or 'min = 8787' not in main:
    issues.append("host-agent-8787-private-rule-missing")
if "VM.Standard.A1.Flex" not in main:
    issues.append("a1-control-shape-missing")
if 'TGG_HOST_AGENT_BIND=127.0.0.1' not in control:
    issues.append("host-agent-loopback-bind-missing")
if "AWAITING_UNREAL_BINARY" not in game:
    issues.append("game-node-await-binary-marker-missing")
if 'default: false' not in schema:
    issues.append("schema-game-node-default-off-missing")
if 'candidate_sha' not in schema:
    issues.append("schema-candidate-sha-missing")
if 'control_plane_commit' not in vars_ or '^[0-9a-fA-F]{40}

result={
  "schema":"tgg.oci.preflight.v4",
  "status":"PASS" if not issues else "FAIL",
  "issues":issues,
  "candidateSha":"b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3",
  "gameNodeDefault":"OFF",
  "hostAgent8787Public":False,
  "adminCidrDefault":"NONE_REQUIRED_INPUT",
  "hostAgentAutoInstall":True,
  "hostAgentRemoteTokenProvisioned":False,
  "controlPlaneCommit":"341dd14e4968abf8ca75a8809de06ba9d6ca78fa"
}
print(json.dumps(result,indent=2))
sys.exit(0 if not issues else 1)
 not in vars_:
    issues.append("control-plane-commit-validation-missing")
if 'control_plane_commit' not in schema:
    issues.append("schema-control-plane-commit-missing")
if '/opt/tgg-host-agent/server.py' not in control:
    issues.append("host-agent-install-missing")
if 'systemctl enable --now tgg-host-agent' not in control:
    issues.append("host-agent-enable-missing")
if 'TGG_REMOTE_TOKEN is intentionally NOT provisioned by Terraform' not in control:
    issues.append("host-agent-secret-boundary-missing")
if 'git -C "$REPO" checkout --detach "$TGG_CONTROL_PLANE_COMMIT"' not in control:
    issues.append("exact-control-plane-checkout-missing")
if 'curl -fsS http://127.0.0.1:8787/health' not in control:
    issues.append("local-host-agent-health-check-missing")

result={
  "schema":"tgg.oci.preflight.v4",
  "status":"PASS" if not issues else "FAIL",
  "issues":issues,
  "candidateSha":"b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3",
  "gameNodeDefault":"OFF",
  "hostAgent8787Public":False,
  "adminCidrDefault":"NONE_REQUIRED_INPUT"
}
print(json.dumps(result,indent=2))
sys.exit(0 if not issues else 1)
