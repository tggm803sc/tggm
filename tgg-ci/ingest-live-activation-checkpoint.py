#!/usr/bin/env python3
import argparse,json,pathlib,sys,hashlib,datetime,tempfile,os

EXPECTED_CANDIDATE="b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3"
EXPECTED_CONTROL_PLANE="7c971ec44be0daf00d81807f588db264239f5fe4"

p=argparse.ArgumentParser()
p.add_argument("--pre-r232",required=True)
p.add_argument("--request",default="")
p.add_argument("--out",required=True)
a=p.parse_args()

pre_path=pathlib.Path(a.pre_r232)
pre=json.loads(pre_path.read_text())
errors=[]

if pre.get("schema")!="tgg.pre-r232.readiness.v1": errors.append("pre-r232-schema")
if pre.get("status")!="PRE_R232_READY": errors.append("pre-r232-status")
if pre.get("errors") not in ([],None): errors.append("pre-r232-errors")
if pre.get("r232PromotionExecuted") is not False: errors.append("pre-r232-r232-state")

bindings=pre.get("bindings") or {}
if bindings.get("candidateSha")!=EXPECTED_CANDIDATE: errors.append("candidate")
if str(bindings.get("controlPlaneCommit") or "").lower()!=EXPECTED_CONTROL_PLANE: errors.append("control-plane")
if not str(bindings.get("hostAgentUrl") or "").startswith("https://"): errors.append("host-url")
if not bindings.get("r231ReceiptId"): errors.append("r231-receipt")

calc=hashlib.sha256(json.dumps(bindings,sort_keys=True,separators=(",",":")).encode()).hexdigest()
if str(pre.get("bindingsSha256") or "").lower()!=calc: errors.append("bindings-hash")

request_state="NOT_PREPARED"
request_sha=None
if a.request:
    req_path=pathlib.Path(a.request)
    req=json.loads(req_path.read_text())
    if req.get("schema")!="tgg.r232.promotion.request.v3": errors.append("request-schema")
    if req.get("candidateSha")!=EXPECTED_CANDIDATE: errors.append("request-candidate")
    if req.get("r232PromotionExecuted") is not False: errors.append("request-r232-state")
    if not req.get("promotionNonce"): errors.append("request-nonce")
    request_sha=hashlib.sha256(req_path.read_bytes()).hexdigest()
    if not errors:
        request_state="REQUEST_PREPARED_NOT_EXECUTED"

now=datetime.datetime.now(datetime.timezone.utc).isoformat()
doc={
  "schema":"tgg.live.activation.checkpoint.v1",
  "status":"BLOCKED" if errors else ("PRE_R232_REQUEST_PREPARED" if request_state=="REQUEST_PREPARED_NOT_EXECUTED" else "PRE_R232_READY"),
  "errors":errors,
  "candidateSha":EXPECTED_CANDIDATE,
  "controlPlaneCommit":EXPECTED_CONTROL_PLANE,
  "preR232ReadinessSha256":hashlib.sha256(pre_path.read_bytes()).hexdigest(),
  "bindingsSha256":calc,
  "hostAgentUrl":bindings.get("hostAgentUrl"),
  "controlInstanceId":bindings.get("controlInstanceId"),
  "r231ReceiptId":bindings.get("r231ReceiptId"),
  "r232RequestState":request_state,
  "r232RequestSha256":request_sha,
  "r232PromotionExecuted":False,
  "updatedAt":now
}

out=pathlib.Path(a.out)
out.parent.mkdir(parents=True,exist_ok=True)
fd,tmp=tempfile.mkstemp(prefix=out.name+".",dir=str(out.parent))
with os.fdopen(fd,"w") as f:
    json.dump(doc,f,indent=2); f.write("\n"); f.flush(); os.fsync(f.fileno())
os.replace(tmp,out)

print(json.dumps(doc,indent=2))
sys.exit(0 if not errors else 1)
