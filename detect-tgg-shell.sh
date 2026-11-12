#!/usr/bin/env bash
# detect-tgg-shell.sh — report how the TGG app reaches Android.
#
# Answers one question: is this app packaged with Capacitor, Cordova, as an
# installable web app (PWA), or not packaged at all?
#
# Read-only. Starts from the repo root (the script's own directory), so it can
# be run from anywhere. Always exits 0 — it reports state, it does not gate CI.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT" || { echo "cannot enter $ROOT" >&2; exit 1; }

# first match under the repo, skipping .git; prints nothing when absent
find_any() {
  find . -path ./.git -prune -o "$@" -print -quit 2>/dev/null | head -n 1
}

# marker files ---------------------------------------------------------------
cap_config="$(find_any -iname 'capacitor.config.*')"
cor_config="$(find_any -iname 'config.xml' -not -path '*/node_modules/*')"
android_dir="$(find_any -type d -name 'android' -not -path '*/node_modules/*')"
manifest_xml="$(find_any -iname 'AndroidManifest.xml' -not -path '*/node_modules/*')"
gradle_file="$(find_any -iname 'build.gradle*' -not -path '*/node_modules/*')"
uproject="$(find_any -iname '*.uproject')"
apk_file="$(find_any -iname '*.apk')"
aab_file="$(find_any -iname '*.aab')"
sw_file="$(find_any \( -name 'sw.js' -o -name 'service-worker.js' \) -not -path '*/node_modules/*')"
icons_dir=""
[ -d tgg-app/public/icons ] && icons_dir="tgg-app/public/icons"
play_route=""
[ -d tgg-app/src/app/play ] && play_route="tgg-app/src/app/play"
next_app=""
[ -f tgg-app/package.json ] && next_app="tgg-app"

# web app manifests, either a static file or a Next metadata route
pwa_manifest="$(find_any -iname '*.webmanifest' -not -path '*/node_modules/*')"
if [ -z "$pwa_manifest" ]; then
  pwa_manifest="$(find_any \( -name 'manifest.ts' -o -name 'manifest.tsx' \) -path '*/app/*' -not -path '*/node_modules/*')"
fi

# dependency markers, package.json only (lockfiles mention "android" via esbuild)
cap_dep=""
grep -qE '"@capacitor/(core|cli)"' package.json tgg-app/package.json tgg-game3d/package.json 2>/dev/null && cap_dep="yes"
cor_dep=""
grep -qE '"cordova(-[a-z]+)?":' package.json tgg-app/package.json tgg-game3d/package.json 2>/dev/null && cor_dep="yes"

# unreal android settings (the Track B path)
ue_android=""
if grep -rq "AndroidRuntimeSettings" game tgg-app 2>/dev/null; then
  ue_android="$(grep -rl "AndroidRuntimeSettings" game tgg-app 2>/dev/null | head -n 1)"
fi

# derived state --------------------------------------------------------------
has_capacitor="no"
{ [ -n "$cap_config" ] || [ -n "$cap_dep" ]; } && has_capacitor="yes"
has_cordova="no"
{ [ -n "$cor_config" ] || [ -n "$cor_dep" ]; } && has_cordova="yes"
has_native_project="no"
{ [ -n "$android_dir" ] || [ -n "$manifest_xml" ] || [ -n "$gradle_file" ]; } && has_native_project="yes"
has_pwa="no"
{ [ -n "$pwa_manifest" ] && [ -n "$sw_file" ]; } && has_pwa="yes"
has_unreal="no"
{ [ -n "$uproject" ] || [ -n "$ue_android" ]; } && has_unreal="yes"
has_artifact="no"
{ [ -n "$apk_file" ] || [ -n "$aab_file" ]; } && has_artifact="yes"

show() {  # show <label> <value-or-empty>
  printf '  %-22s: %s\n' "$1" "${2:-none}"
}

echo
echo "TGG ANDROID SHELL DETECTION"
echo "  repo root             : $ROOT"
echo "  generated             : $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo
echo "NATIVE WRAPPERS"
show "capacitor config" "$cap_config"
show "capacitor dependency" "$cap_dep"
show "cordova config.xml" "$cor_config"
show "cordova dependency" "$cor_dep"
show "native android/" "$android_dir"
show "AndroidManifest.xml" "$manifest_xml"
show "gradle build files" "$gradle_file"
echo
echo "WEB APP"
show "next.js app" "$next_app"
show "playable route" "$play_route"
show "web app manifest" "$pwa_manifest"
show "service worker" "$sw_file"
show "icons" "$icons_dir"
show "installable" "$has_pwa"
echo
echo "UNREAL ANDROID"
show ".uproject" "$uproject"
show "AndroidRuntimeSettings" "$ue_android"
echo
echo "BUILD ARTIFACTS"
show ".apk" "$apk_file"
show ".aab" "$aab_file"
echo

# verdict --------------------------------------------------------------------
shell="NONE"
detail="no native wrapper, no installable web app, no packaged build"
if [ "$has_capacitor" = "yes" ]; then
  shell="CAPACITOR"
  detail="web assets wrapped in a Capacitor native container"
elif [ "$has_cordova" = "yes" ]; then
  shell="CORDOVA"
  detail="web assets wrapped in a Cordova/PhoneGap container"
elif [ "$has_pwa" = "yes" ]; then
  shell="CHROME-INSTALLED WEB APP (PWA)"
  detail="served over HTTPS-or-localhost, installed to the home screen by Chrome; no native container"
elif [ -n "$next_app" ]; then
  shell="NONE"
  detail="bare web app opened by URL in the mobile browser; not installable, not wrapped"
fi

echo "---------------- VERDICT ----------------"
printf 'SHELL          : %s\n' "$shell"
printf 'DETAIL         : %s\n' "$detail"
printf 'NATIVE PROJECT : %s\n' "$( [ "$has_native_project" = yes ] && echo present || echo absent )"
printf 'INSTALLABLE    : %s\n' "$( [ "$has_pwa" = yes ] && echo "yes (manifest + service worker)" || echo "no (needs manifest + service worker + secure context)" )"
printf 'PACKAGED BUILD : %s\n' "$( [ "$has_artifact" = yes ] && echo present || echo "absent (no .apk/.aab in repo)" )"
printf 'UNREAL PATH    : %s\n' "$( [ "$has_unreal" = yes ] && echo "scaffolded" || echo "not scaffolded (no .uproject, no Android settings)" )"
if [ -n "$next_app" ]; then
  printf 'RUNS TODAY AS  : Next.js dev/prod server, opened at /play\n'
fi
echo "-----------------------------------------"
echo

exit 0
