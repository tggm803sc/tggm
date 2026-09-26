#!/usr/bin/env python3
import json, os, subprocess, hashlib, time, secrets, re, tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BIND=os.getenv('TGG_HOST_AGENT_BIND','127.0.0.1')
PORT=int(os.getenv('TGG_HOST_AGENT_PORT','8787'))
HOST_ID=os.getenv('TGG_HOST_ID','tgg-production-01')
HOST_NAME=os.getenv('TGG_HOST_NAME','TGG Production')
PUBLIC=os.getenv('TGG_PUBLIC_BASE','').rstrip('/')
TOKEN=os.getenv('TGG_REMOTE_TOKEN','')
FORGE_PACKAGE=Path(os.getenv('TGG_FORGE_PACKAGE','/opt/tgg/TGG_FORGE_V4_HOST_AGENT_ACTIVATION.zip'))
FORGE_ROOT=Path(os.getenv('TGG_FORGE_ROOT','/opt/tgg/forge'))
ALLOW=os.getenv('TGG_ALLOW_ACTIVATION','0')=='1'
PROOF=Path('/var/lib/tgg-host-agent/latest-proof.json')
REPO_ROOT=Path(os.getenv('TGG_REPO_ROOT','/opt/tgg/repos'))
REPOS=['tgg-core','tgg-runtime','tgg-deploy','tgg-native-runner','tgg-public-host','tgg-mega-gate','tgg-world-mega-1000x']
CANDIDATE_SHA=os.getenv('TGG_R227_CANDIDATE_SHA','b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3').lower()
GATE_FILE=Path(os.getenv('TGG_MEGA_GATE_STATUS','/var/lib/tgg-host-agent/mega-gate.json'))
SERVED_SHA_FILE=Path(os.getenv('TGG_SERVED_SHA_FILE','/var/lib/tgg-host-agent/served-sha.txt'))
RECEIPTS=Path('/var/lib/tgg-host-agent/receipts')
REGISTRY=Path(os.getenv('TGG_REPO_REGISTRY','/var/lib/tgg-host-agent/repo-registry.json'))
RUNNER_STATUS_FILE=Path(os.getenv('TGG_RUNNER_STATUS_FILE','/var/lib/tgg-host-agent/runner-status.json'))
DISCOVERY_FILE=Path(os.getenv('TGG_DISCOVERY_FILE','/var/lib/tgg-host-agent/discovery.json'))
PUBLIC_BASE_URL=os.getenv('TGG_PUBLIC_BASE_URL',PUBLIC).strip().rstrip('/')
DISCOVERY_CALLBACK=os.getenv('TGG_DISCOVERY_CALLBACK','').strip().rstrip('/')
R231_INTAKE_ROUTE='/v1/evidence/r231-snapshot'
R231_MAX_BYTES=256*1024
R231_STATE_DIR=Path(os.getenv('TGG_ACTIVATION_STATE_DIR','/var/lib/tgg-host-agent/activation-evidence'))
R231_INGEST_SCRIPT=Path(os.getenv('TGG_R231_INGEST_SCRIPT','/opt/tgg/activation/ingest-r231-snapshot.py'))

def _stamp(): return time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())

def load_registry():
    try:
        data=json.loads(REGISTRY.read_text()) if REGISTRY.exists() else {}
    except: data={}
    if not isinstance(data,dict): data={}
    data.setdefault('schema','tgg.repo.registry.v1')
    data.setdefault('authority','TGG')
    data.setdefault('repositories',{})
    return data

def save_registry(data):
    REGISTRY.parent.mkdir(parents=True,exist_ok=True)
    data['updatedAt']=_stamp()
    REGISTRY.write_text(json.dumps(data,indent=2))
    return data

def scan_existing_repos():
    reg=load_registry(); repos=reg['repositories']; stamp=_stamp()
    for name in REPOS:
        path=REPO_ROOT/name
        if not path.exists(): continue
        branch=git_value(path,['rev-parse','--abbrev-ref','HEAD'])
        head=git_value(path,['rev-parse','HEAD'])
        repos[name]={
          'name':name,'path':str(path),'defaultBranch':branch,'headSha':head,
          'visibility':'internal','healthy':bool(branch and head),'source':'local-scan','updatedAt':stamp
        }
    return save_registry(reg)

def register_repo(body):
    body=body or {}; name=str(body.get('name') or '').strip()
    if not name:return {'ok':False,'error':'missing-name'}
    if name not in REPOS:return {'ok':False,'error':'repo-not-canonical','name':name}
    branch=str(body.get('defaultBranch') or body.get('branch') or '').strip()
    head=str(body.get('headSha') or body.get('sha') or '').strip().lower()
    if not branch:return {'ok':False,'error':'missing-branch'}
    if not re.fullmatch(r'[0-9a-f]{7,64}',head):return {'ok':False,'error':'invalid-head-sha'}
    reg=load_registry(); reg['repositories'][name]={
      'name':name,'defaultBranch':branch,'headSha':head,'visibility':str(body.get('visibility') or 'internal'),
      'healthy':bool(body.get('healthy',True)),'source':'authenticated-announcement','updatedAt':_stamp()
    }
    save_registry(reg); return {'ok':True,'repository':reg['repositories'][name]}

def registry_view():
    reg=scan_existing_repos()
    return {'schema':reg['schema'],'authority':'TGG','repositories':list(reg.get('repositories',{}).values()),'updatedAt':reg.get('updatedAt')}

def discovery_state():
    data={'schema':'tgg.host.discovery.state.v1','authority':'TGG','hostId':HOST_ID,'publicBaseUrl':PUBLIC_BASE_URL or None,'callback':DISCOVERY_CALLBACK or None,'updatedAt':_stamp()}
    if DISCOVERY_FILE.exists():
        try:
            saved=json.loads(DISCOVERY_FILE.read_text())
            if isinstance(saved,dict): data.update(saved)
        except: pass
    return data

def save_discovery(payload):
    current=discovery_state()
    for k in ('publicBaseUrl','callback','hostId'):
        if payload.get(k): current[k]=str(payload[k]).strip().rstrip('/')
    current['schema']='tgg.host.discovery.state.v1'; current['authority']='TGG'; current['updatedAt']=_stamp()
    DISCOVERY_FILE.parent.mkdir(parents=True,exist_ok=True)
    DISCOVERY_FILE.write_text(json.dumps(current,indent=2))
    return current

def resolved_base(handler=None):
    state=discovery_state(); explicit=(state.get('publicBaseUrl') or PUBLIC_BASE_URL or PUBLIC or '').strip().rstrip('/')
    if explicit: return explicit
    if handler:
        proto='https' if handler.headers.get('X-Forwarded-Proto','http')=='https' else 'http'
        host=handler.headers.get('X-Forwarded-Host') or handler.headers.get('Host')
        if host: return f'{proto}://{host}'.rstrip('/')
    return ''

def discovery_bootstrap(handler=None):
    base=resolved_base(handler)
    return {'schema':'tgg.host.discovery.bootstrap.v1','authority':'TGG','hostId':HOST_ID,'baseUrl':base or None,
      'wellKnown':(base+'/.well-known/tgg-server.json') if base else None,'forge':(base+'/.well-known/tgg-forge.json') if base else None,
      'repos':(base+'/v1/repos') if base else None,'unifiedStatus':(base+'/v1/status/unified') if base else None,
      'ready':(base+'/v1/ready') if base else None,'callback':DISCOVERY_CALLBACK or None,
      'status':'RESOLVED' if base else 'AWAITING_PUBLIC_BASE_URL','updatedAt':_stamp()}

def _pass(v):
    if v is True: return True
    if isinstance(v,dict): return v.get('ok') is True or str(v.get('status','')).upper()=='PASS'
    return str(v or '').upper()=='PASS'

def readiness():
    stamp=_stamp(); inv=repo_inventory(); by={r.get('name'):r for r in inv if isinstance(r,dict)}
    missing=[name for name in REPOS if name not in by]
    unhealthy=[name for name,r in by.items() if name in REPOS and not r.get('healthy')]
    st=system_status(); gates=gate_status(); served=served_sha()
    required=['browserSmoke','liveViewer','coreWorker','exactSha','acceptance','boundary','finalGate']
    bad_gates=[g for g in required if not _pass(gates.get(g))]
    runner_ok=st['runner']['active'] and st['runner']['label']=='tgg-online-host'
    sha_ok=(served==CANDIDATE_SHA)
    base=resolved_base()
    reasons=[]
    if missing: reasons.append({'missingRepos':missing})
    if unhealthy: reasons.append({'unhealthyRepos':unhealthy})
    if not runner_ok: reasons.append({'runner':'not-ready','active':st['runner']['active'],'label':st['runner']['label']})
    if not sha_ok: reasons.append({'servedSha':'mismatch-or-missing','served':served,'expected':CANDIDATE_SHA})
    if bad_gates: reasons.append({'gatesNotPass':bad_gates})
    if not base: reasons.append({'discovery':'public-base-unresolved'})
    ready=not reasons
    return {'schema':'tgg.readiness.v1','authority':'TGG','ready':ready,'status':'READY_FOR_R232' if ready else 'PENDING',
      'candidateSha':CANDIDATE_SHA,'servedSha':served,'repositories':inv,'runner':{'online':st['runner']['active'],'label':st['runner']['label']},
      'gates':gates,'baseUrl':base or None,'reasons':reasons,'updatedAt':stamp}

def sha256(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024), b''): h.update(chunk)
    return h.hexdigest()

def run(args,cwd=None,timeout=600):
    p=subprocess.run(args,cwd=cwd,text=True,capture_output=True,timeout=timeout)
    return {'ok':p.returncode==0,'code':p.returncode,'stdout':p.stdout[-12000:],'stderr':p.stderr[-12000:]}

def system_status():
    forge=run(['systemctl','is-active','tgg-forge'],timeout=10)
    native=run(['systemctl','is-active','tgg-native-runner'],timeout=10)
    compat=run(['systemctl','is-active','tgg-forge-runner'],timeout=10) if not native['ok'] else {'ok':False}
    runner_active=native['ok'] or compat['ok']
    runner_name='tgg-native-runner' if native['ok'] else ('tgg-forge-runner' if compat['ok'] else 'tgg-native-runner')
    runner_label=os.getenv('TGG_RUNNER_LABEL','tgg-online-host')
    if RUNNER_STATUS_FILE.exists():
        try:
            rs=json.loads(RUNNER_STATUS_FILE.read_text())
            if isinstance(rs,dict):
                runner_active=bool(rs.get('online',runner_active))
                runner_name=str(rs.get('name') or runner_name)
                labels=rs.get('labels') or [runner_label]
                if isinstance(labels,list) and labels: runner_label=str(labels[0])
        except: pass
    return {
      'ok': forge['ok'] and runner_active,
      'hostId':HOST_ID,'hostName':HOST_NAME,'authority':'TGG','runtime':'tgg-runtime','live':True,
      'forge':{'active':forge['ok']},'runner':{'active':runner_active,'name':runner_name,'label':runner_label},
      'package':{'exists':FORGE_PACKAGE.exists(),'sha256':sha256(FORGE_PACKAGE) if FORGE_PACKAGE.exists() else None}
    }

def git_value(repo,args):
    r=run(['git','-C',str(repo)]+args,timeout=10)
    return r['stdout'].strip() if r['ok'] else None

def repo_inventory():
    return registry_view()['repositories']

def gate_status():
    if GATE_FILE.exists():
        try:return json.loads(GATE_FILE.read_text())
        except: pass
    return {'browserSmoke':'PENDING','liveViewer':'PENDING','coreWorker':'PENDING','exactSha':'PENDING','acceptance':'PENDING','boundary':'PENDING','finalGate':'PENDING','updatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}

def served_sha():
    try:
        s=SERVED_SHA_FILE.read_text().strip().lower()
        return s if s else None
    except:return None

def unified_status():
    stamp=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    ss=system_status(); gates=gate_status(); ss_sha=served_sha()
    return {
      'schema':'tgg.unified.status.v1','authority':'TGG','generatedAt':stamp,'updatedAt':stamp,
      'nonce':secrets.token_hex(16),'candidateSha':CANDIDATE_SHA,'servedSha':ss_sha,
      'repositories':repo_inventory(),
      'runner':{'name':'tgg-native-runner','online':ss['runner']['active'],'busy':False,'labels':[ss['runner']['label']],'updatedAt':stamp},
      'gates':gates,
      'host':{'authority':'TGG','live':True,'hostHandshake':True,'hostId':HOST_ID,'updatedAt':stamp},
      'runtime':{'authority':'TGG','runtime':'tgg-runtime','live':True,'exactSha':ss_sha,'updatedAt':stamp}
    }

def promotion_receipt(body):
    served=served_sha(); requested=str((body or {}).get('servedSha') or (body or {}).get('candidateSha') or '').lower()
    if requested!=CANDIDATE_SHA:return {'ok':False,'error':'candidate-sha-mismatch','expected':CANDIDATE_SHA}
    if served!=CANDIDATE_SHA:return {'ok':False,'error':'served-sha-mismatch','servedSha':served,'expected':CANDIDATE_SHA}
    gates=gate_status()
    required=['browserSmoke','liveViewer','coreWorker','exactSha','acceptance','boundary','finalGate']
    bad=[g for g in required if str((gates.get(g) or {}).get('status') if isinstance(gates.get(g),dict) else gates.get(g)).upper()!='PASS' and gates.get(g) is not True]
    if bad:return {'ok':False,'error':'gates-not-pass','gates':bad}
    RECEIPTS.mkdir(parents=True,exist_ok=True)
    rid='tgg-'+secrets.token_hex(16); stamp=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    rec={'schema':'tgg.promotion.receipt.v1','authority':'TGG','receipt':rid,'candidateSha':CANDIDATE_SHA,'servedSha':served,'issuedAt':stamp,'hostId':HOST_ID}
    (RECEIPTS/(rid+'.json')).write_text(json.dumps(rec,indent=2))
    return {'ok':True,**rec}

def write_proof(extra=None):
    st=system_status(); p={
      'schema':'tgg.host.proof.v1','generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
      'authority':'TGG','runtime':'tgg-runtime','live':True,'hostHandshake':True,
      'coreHealth':st['forge']['active'],'workerHealth':st['runner']['active'],
      'source':'tgg-host-agent-v9','hostId':HOST_ID,
      'exactSha':served_sha() or st['package']['sha256']
    }
    if extra: p.update(extra)
    PROOF.parent.mkdir(parents=True,exist_ok=True); PROOF.write_text(json.dumps(p,indent=2))
    return p

def activate_forge():
    if not ALLOW: return {'ok':False,'error':'activation-disabled'}
    if not FORGE_PACKAGE.exists(): return {'ok':False,'error':'forge-package-missing','path':str(FORGE_PACKAGE)}
    FORGE_ROOT.mkdir(parents=True,exist_ok=True)
    unzip=run(['unzip','-o',str(FORGE_PACKAGE),'-d',str(FORGE_ROOT)],timeout=300)
    if not unzip['ok']: return {'ok':False,'stage':'unzip','detail':unzip}
    candidates=[FORGE_ROOT/'tgg-forge/bin/activate-v4.sh',FORGE_ROOT/'tgg-forge/bin/cutover-v3.sh',FORGE_ROOT/'bin/activate-v4.sh']
    script=next((p for p in candidates if p.exists()),None)
    if not script: return {'ok':False,'stage':'locate-activation','candidates':[str(x) for x in candidates]}
    os.chmod(script,0o750)
    res=run([str(script)],cwd=str(script.parent.parent),timeout=1200)
    proof=write_proof({'activation':res})
    return {'ok':res['ok'],'activation':res,'proof':proof}

def run_r227():
    candidates=[FORGE_ROOT/'tgg-forge/bin/run-r227.sh',FORGE_ROOT/'bin/run-r227.sh']
    script=next((p for p in candidates if p.exists()),None)
    if not script: return {'ok':False,'error':'r227-runner-script-missing'}
    os.chmod(script,0o750)
    res=run([str(script)],cwd=str(script.parent.parent),timeout=1200)
    return {'ok':res['ok'],'result':res,'proof':write_proof({'r227':res})}

class H(BaseHTTPRequestHandler):
    def out(self,code,obj):
        b=json.dumps(obj).encode(); self.send_response(code); self.send_header('content-type','application/json'); self.send_header('cache-control','no-store'); self.send_header('content-length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def authed(self): return TOKEN and self.headers.get('authorization','')==f'Bearer {TOKEN}'
    def do_GET(self):
        if self.path=='/.well-known/tgg-server.json':
            base=resolved_base(self) or f'http://{BIND}:{PORT}'
            return self.out(200,{'schema':'tgg.server.discovery.v1','authority':'TGG','hostId':HOST_ID,'status':base+'/v1/server/status','remote':base+'/v1/remote/status','proof':base+'/v1/proof/latest','unifiedStatus':base+'/v1/status/unified','promotionReceipt':base+'/v1/promotion/receipt','repoRegistry':base+'/v1/repos','r231SnapshotIntake':base+R231_INTAKE_ROUTE,'forgeDiscovery':base+'/.well-known/tgg-forge.json'})
        if self.path=='/v1/discovery/bootstrap': return self.out(200,discovery_bootstrap(self))
        if self.path=='/v1/discovery/state': return self.out(200,discovery_state())
        if self.path=='/.well-known/tgg-forge.json':
            base=resolved_base(self) or f'http://{BIND}:{PORT}'
            return self.out(200,{'schema':'tgg.forge.discovery.v1','authority':'TGG','registry':base+'/v1/repos','unifiedStatus':base+'/v1/status/unified','candidateSha':CANDIDATE_SHA,'existingReposOnly':True})
        if self.path=='/health': return self.out(200,{'ok':True,'service':'tgg-host-agent','authority':'TGG','bind':BIND,'port':PORT,'updatedAt':_stamp()})
        if self.path=='/v1/server/status': return self.out(200,system_status())
        if self.path=='/v1/repos': return self.out(200,registry_view())
        if self.path=='/v1/status/unified': return self.out(200,unified_status())
        if self.path=='/v1/ready': return self.out(200,readiness())
        if self.path=='/v1/remote/status': return self.out(200,{'ok':True,'authority':'TGG','allowActivation':ALLOW,'operations':['activate-forge','run-r227','register-discovery','register-repo','promotion-receipt','r231-snapshot-intake']})
        if self.path=='/v1/proof/latest':
            if PROOF.exists():
                try:return self.out(200,json.loads(PROOF.read_text()))
                except:pass
            return self.out(200,write_proof())
        return self.out(404,{'ok':False,'error':'not-found'})
    def handle_r231_snapshot_intake(self):
        ctype=(self.headers.get('content-type') or '').split(';')[0].strip().lower()
        if ctype!='application/json':
            return self.out(415,{'ok':False,'error':'application-json-required'})
        try:
            n=int(self.headers.get('content-length','0') or '0')
        except ValueError:
            return self.out(400,{'ok':False,'error':'invalid-content-length'})
        if n<2 or n>R231_MAX_BYTES:
            return self.out(413,{'ok':False,'error':'payload-too-large-or-empty'})
        raw=self.rfile.read(n)
        try:
            json.loads(raw)
        except Exception:
            return self.out(400,{'ok':False,'error':'invalid-json'})
        if not R231_INGEST_SCRIPT.exists():
            return self.out(503,{'ok':False,'error':'r231-ingest-script-missing'})

        R231_STATE_DIR.mkdir(parents=True,exist_ok=True)
        fd,tmp=tempfile.mkstemp(prefix='r231-upload.',suffix='.json',dir=str(R231_STATE_DIR))
        try:
            with os.fdopen(fd,'wb') as f:
                f.write(raw); f.flush(); os.fsync(f.fileno())
            cp=subprocess.run(
                ['python3',str(R231_INGEST_SCRIPT),'--input',tmp,'--state-dir',str(R231_STATE_DIR)],
                capture_output=True,text=True,timeout=15
            )
            if cp.returncode!=0:
                detail=(cp.stdout or cp.stderr)[-4000:]
                try: payload=json.loads(detail)
                except Exception: payload={'ok':False,'error':'r231-snapshot-rejected','detail':detail}
                return self.out(422,payload)
            try: payload=json.loads(cp.stdout)
            except Exception: payload={'ok':True,'status':'PASS','detail':cp.stdout[-4000:]}
            return self.out(200,payload)
        finally:
            try: os.unlink(tmp)
            except FileNotFoundError: pass

    def do_POST(self):
        if not self.authed(): return self.out(401,{'ok':False,'error':'unauthorized'})
        if self.path==R231_INTAKE_ROUTE: return self.handle_r231_snapshot_intake()
        if self.path=='/v1/discovery/register':
            try:
                n=int(self.headers.get('content-length','0') or '0'); body=json.loads(self.rfile.read(n) or b'{}')
            except: body={}
            return self.out(200,save_discovery(body))
        if self.path=='/v1/repos/register':
            try:
                n=int(self.headers.get('content-length','0') or '0'); body=json.loads(self.rfile.read(n) or b'{}')
            except: body={}
            rec=register_repo(body); return self.out(200 if rec.get('ok') else 400,rec)
        if self.path=='/v1/remote/activate-forge': return self.out(200,activate_forge())
        if self.path=='/v1/remote/run-r227': return self.out(200,run_r227())
        if self.path=='/v1/promotion/receipt':
            try:
                n=int(self.headers.get('content-length','0') or '0'); body=json.loads(self.rfile.read(n) or b'{}')
            except: body={}
            rec=promotion_receipt(body); return self.out(200 if rec.get('ok') else 409,rec)
        return self.out(404,{'ok':False,'error':'not-found'})
    def log_message(self,fmt,*args): pass

if __name__=='__main__': ThreadingHTTPServer((BIND,PORT),H).serve_forever()
