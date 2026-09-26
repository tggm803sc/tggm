#!/usr/bin/env bash
set -euo pipefail
umask 077

DOMAIN=""
TOKEN_MODE="generate"
TOKEN_FILE="/root/.tgg-secrets/host-agent-token"
ENV_FILE="/etc/tgg-host-agent.env"
DYNAMIC="/data/coolify/proxy/dynamic/tgg-host-agent.yaml"
RECEIPT="/var/lib/tgg-host-agent/https-finalization.json"

usage(){ echo "Usage: $0 --domain host-agent.example.com [--token-stdin|--generate-token]" >&2; }

while [ "$#" -gt 0 ]; do
  case "$1" in
    --domain)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      DOMAIN="$2"; shift 2 ;;
    --token-stdin) TOKEN_MODE="stdin"; shift ;;
    --generate-token) TOKEN_MODE="generate"; shift ;;
    *) usage; exit 2 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "FAIL: run as root" >&2; exit 10; }
[[ "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || { echo "FAIL: valid --domain required" >&2; exit 11; }

command -v docker >/dev/null
command -v curl >/dev/null
command -v python3 >/dev/null
[ -f "$ENV_FILE" ] || { echo "FAIL: host-agent env missing" >&2; exit 12; }
[ -d "/data/coolify/proxy/dynamic" ] || { echo "FAIL: Coolify dynamic config directory missing" >&2; exit 13; }
docker ps --format '{{.Names}}' | grep -qx coolify-proxy || { echo "FAIL: coolify-proxy not running" >&2; exit 14; }

if [ "$TOKEN_MODE" = "generate" ]; then
  TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
else
  IFS= read -r TOKEN
fi
[[ "$TOKEN" =~ ^[A-Za-z0-9_-]{32,128}$ ]] || { echo "FAIL: token must be 32-128 URL-safe characters" >&2; exit 15; }

install -d -m 0700 "$(dirname "$TOKEN_FILE")" "$(dirname "$RECEIPT")"
printf '%s\n' "$TOKEN" > "$TOKEN_FILE"
chmod 0600 "$TOKEN_FILE"

TGG_REMOTE_TOKEN_VALUE="$TOKEN" python3 - "$ENV_FILE" <<'PY'
import os,pathlib,tempfile,sys
path=pathlib.Path(sys.argv[1]); token=os.environ["TGG_REMOTE_TOKEN_VALUE"]
lines=[]
if path.exists():
    for line in path.read_text().splitlines():
        if line.startswith("TGG_REMOTE_TOKEN=") or line.startswith("TGG_HOST_AGENT_BIND="): continue
        lines.append(line)
lines += ["TGG_HOST_AGENT_BIND=0.0.0.0","TGG_REMOTE_TOKEN="+token]
fd,tmp=tempfile.mkstemp(prefix=path.name+".",dir=str(path.parent))
with os.fdopen(fd,"w") as f:
    f.write("\n".join(lines)+"\n"); f.flush(); os.fsync(f.fileno())
os.chmod(tmp,0o600); os.replace(tmp,path)
PY
unset TGG_REMOTE_TOKEN_VALUE

systemctl restart tgg-host-agent
sleep 1
systemctl is-active --quiet tgg-host-agent
curl -fsS http://127.0.0.1:8787/health >/dev/null

UNAUTH="$(curl -sS -o /tmp/tgg-u.json -w '%{http_code}' -X POST http://127.0.0.1:8787/v1/auth-probe-noop)"
[ "$UNAUTH" = "401" ] || { echo "FAIL: local unauth probe expected 401, got $UNAUTH" >&2; exit 16; }
AUTH="$(curl -sS -o /tmp/tgg-a.json -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8787/v1/auth-probe-noop)"
[ "$AUTH" = "404" ] || { echo "FAIL: local auth no-op expected 404, got $AUTH" >&2; exit 17; }

python3 - "$DOMAIN" "$DYNAMIC" <<'PY'
import os,pathlib,tempfile,sys
domain=sys.argv[1]; path=pathlib.Path(sys.argv[2]); q=chr(96)
content="\n".join([
"http:","  routers:","    tgg-host-agent:",
'      rule: "Host('+q+domain+q+')"',
"      entryPoints:","        - https","      service: tgg-host-agent",
"      tls:","        certResolver: letsencrypt",
"  services:","    tgg-host-agent:","      loadBalancer:","        servers:",
'          - url: "http://host.docker.internal:8787"',""
])
fd,tmp=tempfile.mkstemp(prefix=path.name+".",dir=str(path.parent))
with os.fdopen(fd,"w") as f:
    f.write(content); f.flush(); os.fsync(f.fileno())
os.chmod(tmp,0o600); os.replace(tmp,path)
PY

READY=0
for _ in $(seq 1 24); do
  if curl -fsS --connect-timeout 5 --max-time 10 "https://$DOMAIN/health" >/dev/null 2>&1; then READY=1; break; fi
  sleep 5
done
[ "$READY" = "1" ] || { echo "FAIL: HTTPS route not ready; verify DNS and ports 80/443" >&2; exit 18; }

EXT_UNAUTH="$(curl -sS -o /tmp/tgg-eu.json -w '%{http_code}' -X POST "https://$DOMAIN/v1/auth-probe-noop")"
[ "$EXT_UNAUTH" = "401" ] || { echo "FAIL: external unauth probe expected 401, got $EXT_UNAUTH" >&2; exit 19; }
EXT_AUTH="$(curl -sS -o /tmp/tgg-ea.json -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" "https://$DOMAIN/v1/auth-probe-noop")"
[ "$EXT_AUTH" = "404" ] || { echo "FAIL: external auth no-op expected 404, got $EXT_AUTH" >&2; exit 20; }

TOKEN_SHA="$(printf '%s' "$TOKEN" | sha256sum | awk '{print $1}')"
python3 - "$DOMAIN" "$TOKEN_SHA" "$RECEIPT" <<'PY'
import datetime,json,os,pathlib,sys,tempfile
domain,token_sha,out=sys.argv[1],sys.argv[2],pathlib.Path(sys.argv[3])
doc={"schema":"tgg.host-agent.https.finalization.v1","status":"HTTPS_HOST_AGENT_READY","hostAgentUrl":"https://"+domain,"proxy":"coolify-traefik","upstream":"http://host.docker.internal:8787","tokenConfigured":True,"tokenSha256":token_sha,"unauthorizedProbe":401,"authenticatedNoopProbe":404,"finalizedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"r232PromotionExecuted":False}
fd,tmp=tempfile.mkstemp(prefix=out.name+".",dir=str(out.parent))
with os.fdopen(fd,"w") as f:
    json.dump(doc,f,indent=2); f.flush(); os.fsync(f.fileno())
os.replace(tmp,out); print(json.dumps(doc,indent=2))
PY

unset TOKEN
echo "TGG_HOST_AGENT_HTTPS_READY:https://$DOMAIN"
echo "Token stored root-only at $TOKEN_FILE; token value was not printed."
