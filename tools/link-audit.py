#!/usr/bin/env python3
"""Audit every link on the TGG hub and status board with real HTTP requests.

Re-run this whenever the hub changes:

    python3 tools/link-audit.py                # checks the live front door (production)
    python3 tools/link-audit.py --base URL     # checks one origin only
    python3 tools/link-audit.py --json         # machine-readable report

Exit status is 0 only when every check passes, so it works in CI or a pre-commit hook.

Checks, per origin:
  * /, /status/, both stylesheets and the favicon return 200 with the expected bytes;
  * an unknown path falls back to the hub (the Worker's SPA fallback) instead of 404;
  * every href/src in the *served* HTML resolves to 200 (or to an in-page anchor that exists);
  * links listed in DEAD_MUST_NOT_APPEAR are absent from the served HTML.

It also probes every host in WATCH on each run and prints whether it is serving yet,
so one run tells you the moment a watched host comes up. A watch probe is a
watchlist entry, not a link: it is reported but never counted as a failure.
With --json the payload is {"watch": [...], "reports": [...]}.

Preconnect hints to font hosts are skipped: they are DNS/TLS hints, never fetched as
documents, so a bare request to them legitimately 404s. Inline data: URIs are skipped
too, since their payload is already in the page.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request

PRODUCTION = "https://site-19fd909da33e4eccb40534b3ceb6dc75.freebuff.page"

# The front door ships on production, so that is what runs by default. The site's
# preview environment is re-taken regularly by the TGG OS chat that owns it: on the
# last check (2026-11-18T21:48Z) it served their "Tru Go Getta World" app, not the hub,
# so auditing it by default would report another app's failures as ours. Use --base
# when you want to audit a specific origin.
DEFAULT_BASES = [("production", PRODUCTION)]

# Hosts that must never be presented as live links.
# site-16ce126d… (TGG AI Impact Desk) answers 404 "Not found" at the edge on every
# path, including after successful deploys and a publish, so it stays out of the hub
# until the host actually serves. Remove it here only after its own audit passes.
DEAD_MUST_NOT_APPEAR: set[str] = {"site-16ce126d091a4f96a04895dfac0dda"}

# Hosts we are waiting on: probed on every run and reported, but never a failure, so
# a plain audit run also tells us when one of them starts serving. When one comes up,
# link it in the hub, drop it from DEAD_MUST_NOT_APPEAR and remove it from here.
WATCH: list[tuple[str, str, str]] = [
    (
        "site-16ce126d091a4f96a04895dfac0dda",
        "TGG AI Impact Desk",
        "https://site-16ce126d091a4f96a04895dfac0dda.freebuff.page",
    ),
]

# host prefixes that are hints, not navigable documents
SKIP_HOSTS = ("https://fonts.googleapis.com", "https://fonts.gstatic.com")

ROUTES = [
    ("/", b"One Front Door"),
    ("/status/", b"Suite Status"),
    ("/styles.css", b"--"),
    ("/status/styles.css", b"--"),
    ("/favicon.svg", b"<svg"),
]
BOGUS_PATH = "/no-such-page-verify"


def fetch(url: str) -> tuple[int, bytes, str]:
    request = urllib.request.Request(url, headers={"user-agent": "tgg-link-audit"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.read(), response.headers.get("content-type", "")
    except urllib.error.HTTPError as error:
        body = error.read() or b""
        content_type = error.headers.get("content-type", "") if error.headers else ""
        return error.code, body, content_type
    except Exception as error:  # noqa: BLE001 - reported as a failure, never swallowed
        return 0, f"{type(error).__name__}: {error}".encode(), "ERR"


def watch_probe() -> list[dict]:
    """Ask each watched host for its root; record what it actually answered."""
    results = []
    for site, label, url in WATCH:
        status, body, content_type = fetch(url + "/")
        results.append(
            {
                "site": site,
                "label": label,
                "url": url,
                "status": status,
                "bytes": len(body),
                "serving": status == 200 and len(body) > 0,
                "detail": f"HTTP {status} · {len(body)}B · {content_type or 'no content-type'}",
            }
        )
    return results


def resolve(base: str, link: str) -> str:
    if link.startswith("http"):
        return link
    if link.startswith("/"):
        return base + link
    return f"{base}/{link}"


def audit(name: str, base: str) -> dict:
    report = {"name": name, "base": base, "checks": [], "failures": []}

    def record(label: str, ok: bool, detail: str) -> None:
        report["checks"].append({"check": label, "ok": ok, "detail": detail})
        if not ok:
            report["failures"].append(f"{label}: {detail}")

    for path, needle in ROUTES:
        status, body, content_type = fetch(base + path)
        ok = status == 200 and needle in body
        record(path, ok, f"HTTP {status} · {len(body)}B · {content_type or 'no content-type'}")

    status, body, _ = fetch(base + BOGUS_PATH)
    ok = status == 200 and b"One Front Door" in body
    record(BOGUS_PATH, ok, f"HTTP {status} · {len(body)}B · SPA fallback {'served hub' if ok else 'did NOT serve hub'}")

    status, body, _ = fetch(base + "/")
    if status != 200:
        record("served hub", False, f"HTTP {status} — cannot audit links")
        return report
    html = body.decode("utf-8", "replace")

    ids = set(re.findall(r'id="([^"]+)"', html))
    for link in dict.fromkeys(re.findall(r'(?:href|src)="([^"]+)"', html)):
        if link.startswith("#"):
            record(f"anchor {link}", link[1:] in ids, f"id {'found' if link[1:] in ids else 'MISSING'}")
            continue
        if link.startswith("data:"):
            continue  # inline payload, already in the document
        if link.startswith(SKIP_HOSTS):
            continue
        target = resolve(base, link)
        link_status, link_body, link_type = fetch(target)
        record(f"link {link}", link_status == 200, f"HTTP {link_status} · {len(link_body)}B · {link_type or 'no content-type'}")

    for dead in DEAD_MUST_NOT_APPEAR:
        record(f"dead link {dead}", dead not in html, "absent from served hub" if dead not in html else "STILL LINKED")

    status, body, _ = fetch(base + "/status/")
    if status != 200:
        record("status board", False, f"HTTP {status}")
        return report
    board = body.decode("utf-8", "replace")
    for link in dict.fromkeys(re.findall(r'(?:href|src)="([^"]+)"', board)):
        if link.startswith("#") or link.startswith("data:") or link.startswith(SKIP_HOSTS):
            continue
        target = resolve(base, link)
        link_status, link_body, link_type = fetch(target)
        record(f"status link {link}", link_status == 200, f"HTTP {link_status} · {len(link_body)}B · {link_type or 'no content-type'}")

    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", action="append", metavar="URL", help="origin to audit; repeatable")
    parser.add_argument("--json", action="store_true", help="print the report as JSON")
    args = parser.parse_args()

    bases = [("custom", url) for url in args.base] if args.base else DEFAULT_BASES
    reports = [audit(name, base) for name, base in bases]
    watch = watch_probe()

    if args.json:
        print(json.dumps({"watch": watch, "reports": reports}, indent=2))
    else:
        print("===== watch   probed on every run · never counts as a failure")
        for item in watch:
            mark = "UP  " if item["serving"] else "DOWN"
            verdict = "SERVING — ready to link" if item["serving"] else "still not serving"
            print(f"  [{mark}] {item['label']:55} {item['detail']} · {verdict}")
        print()
        for report in reports:
            print(f"===== {report['name']}  {report['base']}")
            for check in report["checks"]:
                print(f"  [{'ok  ' if check['ok'] else 'FAIL'}] {check['check']:55} {check['detail']}")
            total = len(report["checks"])
            print(f"  {total - len(report['failures'])}/{total} passed")
            for failure in report["failures"]:
                print(f"  FAIL {failure}")
            print()

    failures = sum(len(report["failures"]) for report in reports)
    summary = "all links OK" if not failures else f"{failures} failure(s)"
    # With --json, keep stdout pure JSON for parsers; the summary goes to stderr.
    print(summary, file=sys.stderr if args.json else sys.stdout)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
