#!/usr/bin/env bash
# Verify an installed copy of the recovered brainstorming skill against the hash
# manifest taken from the files that were rebuilt and smoke-tested here.
#
# Usage: check-manifest.sh [installed-skill-dir] [manifest]
#   installed-skill-dir  defaults to this script's parent directory
#   manifest             defaults to MANIFEST.sha256 beside this script
#
# Exits 0 when every manifest entry matches, 1 when anything is missing or
# different, 2 on a usage error. Extra files in the installed copy are reported
# but never treated as a failure: an install may legitimately carry more.
set -uo pipefail

here="$(cd -- "$(dirname -- "$0")" && pwd)"
target="${1:-$here}"
manifest="${2:-$here/MANIFEST.sha256}"

if [[ ! -d "$target" ]]; then
  echo "not a directory: $target" >&2
  exit 2
fi
if [[ ! -f "$manifest" ]]; then
  echo "no manifest at: $manifest" >&2
  exit 2
fi

ok=0
bad=0
missing=0

while read -r expected path; do
  [[ -z "${expected:-}" || -z "${path:-}" ]] && continue
  file="$target/$path"
  if [[ ! -f "$file" ]]; then
    printf 'MISSING  %s\n' "$path"
    missing=$((missing + 1))
    continue
  fi
  actual=$(sha256sum "$file" | cut -d' ' -f1)
  if [[ "$actual" == "$expected" ]]; then
    printf 'ok       %s\n' "$path"
    ok=$((ok + 1))
  else
    printf 'CHANGED  %s\n         expected %s\n         actual   %s\n' "$path" "$expected" "$actual"
    bad=$((bad + 1))
  fi
done < "$manifest"

echo
echo "matched $ok · changed $bad · missing $missing"

if [[ $bad -eq 0 && $missing -eq 0 ]]; then
  echo "result: verified"
  exit 0
fi
echo "result: does not match the recovered set"
exit 1
