#!/usr/bin/env python3
import argparse,datetime,hashlib,json,os,pathlib,tempfile
EXPECTED_SHA='b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3'
p=argparse.ArgumentParser()
p.add_argument('--marker',required=True)
p.add_argument('--receipt',required=True)
p.add_argument('--server',required=True)
p.add_argument('--ledger',required=True)
p.add_argument('--max-age-seconds',type=int,default=600)
p.add_argument('--check-only',action='store_true')
a=p.parse_args()
marker_path=pathlib.Path(a.marker); receipt_path=pathlib.Path(a.receipt); server_path=pathlib.Path(a.server); ledger_path=pathlib.Path(a.ledger)
errors=[]
try:
    m=json.loads(marker_path.read_text()); r=json.loads(receipt_path.read_text())
except Exception:
    raise SystemExit('FAIL: invalid marker/receipt JSON')
if m.get('schema')!='tgg.install.receipt.gate.pass.v2': errors.append('invalid-marker-schema')
if m.get('status')!='PASS': errors.append('marker-not-pass')
if str(m.get('candidateSha') or '').lower()!=EXPECTED_SHA: errors.append('candidate-sha-mismatch')
if m.get('r232PromotionExecuted') is not False: errors.append('marker-r232-state-invalid')
if m.get('installNonce')!=r.get('installNonce'): errors.append('install-nonce-mismatch')
receipt_sha=hashlib.sha256(receipt_path.read_bytes()).hexdigest()
if m.get('installReceiptSha256')!=receipt_sha: errors.append('install-receipt-sha-mismatch')
if not server_path.is_file(): errors.append('live-server-missing')
else:
    server_sha=hashlib.sha256(server_path.read_bytes()).hexdigest()
    if m.get('installedServerSha256')!=server_sha: errors.append('live-server-sha-mismatch')
    if r.get('installedServerSha256')!=server_sha: errors.append('receipt-server-sha-mismatch')
try:
    ts=datetime.datetime.fromisoformat(str(m.get('createdAt') or '').replace('Z','+00:00'))
    age=(datetime.datetime.now(datetime.timezone.utc)-ts).total_seconds()
    max_age=min(int(m.get('maxAgeSeconds',a.max_age_seconds)),a.max_age_seconds)
    if age < -60: errors.append('future-dated-gate-marker')
    elif age > max_age: errors.append('stale-gate-marker')
except Exception:
    errors.append('invalid-marker-created-at')
marker_id=hashlib.sha256(marker_path.read_bytes()).hexdigest()
used=set()
if ledger_path.exists():
    try:
        ld=json.loads(ledger_path.read_text()); used=set(map(str,ld.get('markerIds',[])))
    except Exception:
        errors.append('marker-ledger-invalid')
if marker_id in used: errors.append('replayed-gate-marker')
if errors:
    print(json.dumps({'schema':'tgg.install.receipt.gate.marker.verification.v1','status':'FAIL','errors':errors},indent=2))
    raise SystemExit(1)
if not a.check_only:
    used.add(marker_id)
    ledger_path.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix=ledger_path.name+'.',dir=str(ledger_path.parent))
    with os.fdopen(fd,'w') as f:
        json.dump({'markerIds':sorted(used)},f,indent=2); f.flush(); os.fsync(f.fileno())
    os.replace(tmp,ledger_path)
print(json.dumps({'schema':'tgg.install.receipt.gate.marker.verification.v1','status':'PASS','markerId':marker_id,'candidateSha':EXPECTED_SHA,'installNonce':m.get('installNonce'),'consumed':not a.check_only,'checkOnly':a.check_only},indent=2))
