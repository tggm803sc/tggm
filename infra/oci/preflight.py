#!/usr/bin/env python3
from pathlib import Path
import json,sys,subprocess

root=Path(__file__).resolve().parent
files={p.name:p.read_text() for p in root.iterdir() if p.is_file()}
issues=[]
main=files.get("main.tf",""); vars_=files.get("variables.tf","")
control=files.get("cloud-init-control.yaml.tftpl",""); game=files.get("cloud-init-game.yaml.tftpl","")
schema=files.get("schema.yaml",""); finalizer=files.get("finalize-host-agent.sh","")

for name in ["versions.tf","variables.tf","main.tf","outputs.tf","schema.yaml","cloud-init-control.yaml.tftpl","cloud-init-game.yaml.tftpl","finalize-host-agent.sh"]:
    if name not in files: issues.append("missing:"+name)

if 'default = "0.0.0.0/0"' in vars_: issues.append("admin-cidr-has-broad-default")
if 'variable "admin_cidr"' not in vars_ or "cidrhost(var.admin_cidr, 0)" not in vars_: issues.append("admin-cidr-validation-missing")
if 'count                    = var.enable_game_node ? 1 : 0' not in main: issues.append("x86-image-query-not-conditional")
if 'count               = var.enable_game_node ? 1 : 0' not in main: issues.append("game-node-not-conditional")
if 'allow_paid_game_node' not in vars_ or '!var.enable_game_node || var.allow_paid_game_node' not in vars_: issues.append("paid-game-node-explicit-allow-missing")
try:
    control_security=main.split('resource "oci_core_security_list" "control" {',1)[1].split('resource "oci_core_security_list" "runtime" {',1)[0]
except Exception:
    control_security=""; issues.append("control-security-list-not-found")
if "8787" in control_security: issues.append("control-host-agent-8787-ingress-present")
if "VM.Standard.A1.Flex" not in main: issues.append("a1-control-shape-missing")
if 'TGG_HOST_AGENT_BIND=0.0.0.0' not in control: issues.append("host-agent-proxy-reachable-bind-missing")
if "AWAITING_UNREAL_BINARY" not in game: issues.append("game-node-await-binary-marker-missing")
if 'default: false' not in schema: issues.append("schema-game-node-default-off-missing")
if 'candidate_sha' not in schema: issues.append("schema-candidate-sha-missing")
if 'control_plane_commit' not in vars_ or '^[0-9a-fA-F]{40}$' not in vars_: issues.append("control-plane-commit-validation-missing")
if 'control_plane_commit' not in schema: issues.append("schema-control-plane-commit-missing")
if '/opt/tgg-host-agent/server.py' not in control: issues.append("host-agent-install-missing")
if 'systemctl enable --now tgg-host-agent' not in control: issues.append("host-agent-enable-missing")
if 'TGG_REMOTE_TOKEN is intentionally NOT provisioned by Terraform' not in control: issues.append("host-agent-secret-boundary-missing")
if 'git -C "$REPO" checkout --detach "$TGG_CONTROL_PLANE_COMMIT"' not in control: issues.append("exact-control-plane-checkout-missing")
if 'curl -fsS http://127.0.0.1:8787/health' not in control: issues.append("local-host-agent-health-check-missing")

for needle,issue in [
    ("/data/coolify/proxy/dynamic/tgg-host-agent.yaml","coolify-dynamic-route-missing"),
    ("host.docker.internal:8787","coolify-host-upstream-missing"),
    ("certResolver: letsencrypt","coolify-letsencrypt-missing"),
    ("v1/auth-probe-noop","host-agent-auth-noop-check-missing"),
    ("tokenSha256","token-fingerprint-receipt-missing")
]:
    if needle not in finalizer: issues.append(issue)

if (root/"finalize-host-agent.sh").exists():
    cp=subprocess.run(["bash","-n",str(root/"finalize-host-agent.sh")],capture_output=True,text=True)
    if cp.returncode: issues.append("finalizer-shell-syntax:"+cp.stderr.strip())

result={"schema":"tgg.oci.preflight.v5","status":"PASS" if not issues else "FAIL","issues":issues,"candidateSha":"b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3","controlPlaneCommit":"7c971ec44be0daf00d81807f588db264239f5fe4","gameNodeDefault":"OFF","hostAgentBind":"0.0.0.0","controlIngress8787":"CLOSED","hostAgentRemoteTokenProvisionedByTerraform":False,"httpsFinalizer":"READY","adminCidrDefault":"NONE_REQUIRED_INPUT"}
print(json.dumps(result,indent=2)); sys.exit(0 if not issues else 1)
