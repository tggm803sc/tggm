#!/usr/bin/env python3
import argparse,hashlib,json,pathlib,sys

p=argparse.ArgumentParser()
p.add_argument("--snapshot",required=True)
p.add_argument("--receipt",required=True)
a=p.parse_args()

snap=pathlib.Path(a.snapshot).read_bytes()
receipt=json.loads(pathlib.Path(a.receipt).read_text())
errors=[]
if receipt.get("status")!="PASS":
    errors.append("receipt-not-pass")
if receipt.get("snapshotSha256")!=hashlib.sha256(snap).hexdigest():
    errors.append("snapshot-sha-mismatch")

print(json.dumps({"status":"PASS" if not errors else "FAIL","errors":errors},indent=2))
sys.exit(0 if not errors else 1)
