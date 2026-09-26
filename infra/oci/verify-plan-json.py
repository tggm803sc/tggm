#!/usr/bin/env python3
import argparse, ipaddress, json, pathlib, sys

EXPECTED_CANDIDATE="b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3"
EXPECTED_CONTROL_PLANE="7c971ec44be0daf00d81807f588db264239f5fe4"

ALLOWED_RESOURCE_TYPES={
  "oci_core_vcn",
  "oci_core_internet_gateway",
  "oci_core_route_table",
  "oci_core_security_list",
  "oci_core_subnet",
  "oci_core_instance",
}

p=argparse.ArgumentParser()
p.add_argument("--plan-json",required=True)
p.add_argument("--out",required=True)
a=p.parse_args()

plan=json.loads(pathlib.Path(a.plan_json).read_text())
errors=[]
warnings=[]

if str(plan.get("format_version") or "")=="":
    errors.append("plan-format-version-missing")

variables=plan.get("variables") or {}
def v(name, default=None):
    x=variables.get(name)
    if isinstance(x,dict) and "value" in x:
        return x["value"]
    return default

candidate=str(v("candidate_sha","")).lower()
control_commit=str(v("control_plane_commit","")).lower()
admin_cidr=str(v("admin_cidr",""))
enable_game=bool(v("enable_game_node",False))
allow_paid=bool(v("allow_paid_game_node",False))

if candidate!=EXPECTED_CANDIDATE:
    errors.append("candidate-sha-mismatch")
if control_commit!=EXPECTED_CONTROL_PLANE:
    errors.append("control-plane-commit-mismatch")
if enable_game:
    errors.append("paid-game-node-unexpectedly-enabled")
if allow_paid:
    errors.append("paid-game-node-allow-unexpectedly-enabled")

try:
    net=ipaddress.ip_network(admin_cidr, strict=False)
    if net.prefixlen==0:
        errors.append("admin-cidr-global")
except Exception:
    errors.append("admin-cidr-invalid-or-missing")

resource_changes=plan.get("resource_changes") or []
types={}
unexpected=[]
for rc in resource_changes:
    typ=str(rc.get("type") or "")
    types[typ]=types.get(typ,0)+1
    if typ and typ not in ALLOWED_RESOURCE_TYPES:
        unexpected.append(typ)

if unexpected:
    errors.append("unexpected-resource-types:"+",".join(sorted(set(unexpected))))

# Count expected managed resources in a default, game-node-disabled plan.
expected_counts={
  "oci_core_vcn":1,
  "oci_core_internet_gateway":1,
  "oci_core_route_table":1,
  "oci_core_security_list":2,
  "oci_core_subnet":2,
  "oci_core_instance":1,
}
for typ,count in expected_counts.items():
    actual=types.get(typ,0)
    if actual!=count:
        errors.append(f"resource-count:{typ}:expected={count}:actual={actual}")

# Inspect security-list planned values for broad admin rules or TCP/8787 exposure.
for rc in resource_changes:
    if rc.get("type")!="oci_core_security_list":
        continue
    after=((rc.get("change") or {}).get("after") or {})
    rules=after.get("ingress_security_rules") or []
    for rule in rules:
        source=str(rule.get("source") or "")
        proto=str(rule.get("protocol") or "")
        tcp=rule.get("tcp_options") or {}
        lo=tcp.get("min")
        hi=tcp.get("max")
        if proto=="6" and lo is not None and hi is not None and int(lo)<=8787<=int(hi):
            errors.append("public-or-private-tcp-8787-rule-present")
        if source in ("0.0.0.0/0","::/0") and proto=="6" and lo in (22,8000,6001,6002):
            errors.append(f"broad-admin-port:{lo}")

# Explicitly ensure the default control instance remains A1.Flex and game instance absent.
control_shapes=[]
game_instances=0
for rc in resource_changes:
    if rc.get("type")!="oci_core_instance":
        continue
    name=str(rc.get("name") or "")
    after=((rc.get("change") or {}).get("after") or {})
    if name=="control":
        control_shapes.append(after.get("shape"))
    elif name=="game":
        game_instances+=1
if control_shapes!=["VM.Standard.A1.Flex"]:
    errors.append("control-shape-mismatch")
if game_instances:
    errors.append("game-instance-present")

summary={
  "schema":"tgg.oci.plan.verification.v1",
  "status":"PASS" if not errors else "BLOCKED",
  "errors":errors,
  "warnings":warnings,
  "candidateSha":EXPECTED_CANDIDATE,
  "controlPlaneCommit":EXPECTED_CONTROL_PLANE,
  "adminCidr":admin_cidr,
  "enableGameNode":enable_game,
  "allowPaidGameNode":allow_paid,
  "resourceTypeCounts":types,
  "allowedResourceTypes":sorted(ALLOWED_RESOURCE_TYPES),
  "resourceManagerApply":"NOT_RUN",
  "r232PromotionExecuted":False
}

out=pathlib.Path(a.out)
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(summary,indent=2)+"\n")
print(json.dumps(summary,indent=2))
sys.exit(0 if not errors else 1)
