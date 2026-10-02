#!/usr/bin/env bash
set -euo pipefail

ORIGIN="${TGG_VIDEO_AI_PUBLIC_BASE_URL:-}"
EXPECTED_SHA="${TGG_BUILD_SHA:-}"
[[ -n "$ORIGIN" ]] || { echo '{"status":"HOLD","reason":"TGG_VIDEO_AI_PUBLIC_BASE_URL_REQUIRED"}'; exit 22; }
ORIGIN="${ORIGIN%/}"
[[ -n "$EXPECTED_SHA" ]] || { echo '{"status":"HOLD","reason":"TGG_BUILD_SHA_REQUIRED"}'; exit 23; }

for cmd in curl ffmpeg ffprobe python3; do command -v "$cmd" >/dev/null 2>&1 || { echo "{"status":"HOLD","reason":"$cmd unavailable"}"; exit 24; }; done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PROJECT="smoke-$(date +%s)-$$"
VID1="vid-a"
VID2="vid-b"
MUSIC="music"

ffmpeg -loglevel error -y -f lavfi -i "color=c=red:s=320x180:d=1:r=24" -c:v libx264 -pix_fmt yuv420p "$TMP/a.mp4"
ffmpeg -loglevel error -y -f lavfi -i "color=c=blue:s=320x180:d=1:r=24" -c:v libx264 -pix_fmt yuv420p "$TMP/b.mp4"
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=440:duration=2" -c:a aac "$TMP/music.m4a"

health="$(curl -fsS "$ORIGIN/health")"
python3 - "$EXPECTED_SHA" "$health" <<'PY'
import json,sys
expected=sys.argv[1]
data=json.loads(sys.argv[2])
if data.get("ok") is not True: raise SystemExit("health not ok")
if data.get("buildSha") != expected:
    print(json.dumps({"status":"HOLD","reason":"BUILD_SHA_MISMATCH","expected":expected,"served":data.get("buildSha")}))
    raise SystemExit(31)
PY

upload(){
  local id="$1" type="$2" ms="$3" file="$4" mime="$5"
  curl -fsS -X PUT     -H "Content-Type: $mime"     -H "X-TGG-Asset-Name: $(basename "$file")"     -H "X-TGG-Asset-Type: $type"     -H "X-TGG-Duration-Ms: $ms"     --data-binary "@$file"     "$ORIGIN/v1/projects/$PROJECT/assets/$id"
}

upload "$VID1" video 1000 "$TMP/a.mp4" video/mp4 >"$TMP/a.json"
upload "$VID2" video 1000 "$TMP/b.mp4" video/mp4 >"$TMP/b.json"
upload "$MUSIC" audio 2000 "$TMP/music.m4a" audio/mp4 >"$TMP/music.json"

python3 - "$TMP" "$PROJECT" >"$TMP/analyze-body.json" <<'PY'
import json,sys,pathlib
root=pathlib.Path(sys.argv[1]); project=sys.argv[2]
assets=[]
for n in ("a.json","b.json","music.json"):
    assets.append(json.loads((root/n).read_text())["asset"])
print(json.dumps({"assets":assets,"signals":{}}))
PY

curl -fsS -X POST -H 'Content-Type: application/json' --data-binary @"$TMP/analyze-body.json"   "$ORIGIN/v1/projects/$PROJECT/analyze" >"$TMP/analyzed.json"

python3 - "$TMP/analyzed.json" >"$TMP/plan-body.json" <<'PY'
import json,sys
x=json.load(open(sys.argv[1]))
print(json.dumps({
  "mode":"music-video",
  "directives":["auto-first-cut"],
  "mediaAnalyses":x.get("mediaAnalyses",[]),
  "musicAnalysis":x.get("musicAnalysis"),
  "canvas":{"width":320,"height":180}
}))
PY

curl -fsS -X POST -H 'Content-Type: application/json' --data-binary @"$TMP/plan-body.json"   "$ORIGIN/v1/projects/$PROJECT/plans" >"$TMP/plan.json"

PLAN_ID="$(python3 - "$TMP/plan.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))["plan"]["id"])
PY
)"

curl -fsS -X POST -H 'Content-Type: application/json' --data '{}'   "$ORIGIN/v1/projects/$PROJECT/plans/$PLAN_ID/apply" >"$TMP/applied.json"

TIMELINE_VERSION="$(python3 - "$TMP/applied.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))["timeline"]["version"])
PY
)"

python3 - "$TMP" "$TIMELINE_VERSION" >"$TMP/render-body.json" <<'PY'
import json,sys,pathlib
root=pathlib.Path(sys.argv[1]); version=int(sys.argv[2])
assets=[json.loads((root/n).read_text())["asset"] for n in ("a.json","b.json","music.json")]
print(json.dumps({"timelineVersion":version,"assets":assets,"preset":{"width":320,"height":180,"fps":24,"container":"mp4","codec":"h264"}}))
PY

curl -fsS -X POST -H 'Content-Type: application/json' --data-binary @"$TMP/render-body.json"   "$ORIGIN/v1/projects/$PROJECT/renders" >"$TMP/render.json"

JOB_ID="$(python3 - "$TMP/render.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))["job"]["id"])
PY
)"

for i in $(seq 1 120); do
  curl -fsS "$ORIGIN/v1/jobs/$JOB_ID" >"$TMP/job.json"
  status="$(python3 - "$TMP/job.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))["job"]["status"])
PY
)"
  [[ "$status" != "failed" ]] || { cat "$TMP/job.json"; exit 40; }
  [[ "$status" != "succeeded" ]] || break
  [[ "$i" -lt 120 ]] || { echo '{"status":"HOLD","reason":"RENDER_TIMEOUT"}'; exit 41; }
  sleep 1
done

OUTPUT_URI="$(python3 - "$TMP/job.json" <<'PY'
import json,sys
j=json.load(open(sys.argv[1]))["job"]
if j.get("status")!="succeeded": raise SystemExit(1)
o=j.get("output") or {}
if not o.get("uri"): raise SystemExit(2)
print(o["uri"])
PY
)"

curl -fsS "$OUTPUT_URI" -o "$TMP/out.mp4"
ffprobe -v error -show_entries format=duration -show_entries stream=codec_type,width,height -of json "$TMP/out.mp4" >"$TMP/probe.json"

python3 - "$TMP/probe.json" "$EXPECTED_SHA" "$PROJECT" "$JOB_ID" <<'PY'
import json,sys
probe=json.load(open(sys.argv[1]))
streams=probe.get("streams",[])
video=next((s for s in streams if s.get("codec_type")=="video"),None)
audio=next((s for s in streams if s.get("codec_type")=="audio"),None)
duration=float((probe.get("format") or {}).get("duration") or 0)
if not video or int(video.get("width") or 0)!=320 or int(video.get("height") or 0)!=180:
    raise SystemExit("video verification failed")
if not audio: raise SystemExit("audio verification failed")
if not (1.8 <= duration <= 2.2): raise SystemExit(f"duration {duration}")
print(json.dumps({
  "schema":"tgg.video-ai.live-proof.v1",
  "status":"PASS",
  "buildSha":sys.argv[2],
  "projectId":sys.argv[3],
  "jobId":sys.argv[4],
  "video":{"width":320,"height":180,"duration":duration},
  "audio":True,
  "promotion":"BACKEND_LIVE_PROOF_PASS_BROWSER_STUDIO_PROOF_STILL_REQUIRED"
},separators=(",",":")))
PY
