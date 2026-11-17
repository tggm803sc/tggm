# Session 3 — blockers

## 1. No push credentials in the cloud worktree

The chat worktree has no git remote, no SSH key and no token; `git ls-remote`
works anonymously (public repo) but `git push` cannot authenticate, and `gh` is
not logged in. Large source changes therefore stay in the worktree unless they
are re-sent file-by-file through the GitHub API. Small files (CI config, docs)
were delivered that way.

**Unblocks with:** running `git push` from a machine that is authenticated, or
adding a token/SSH key to this environment.

## 2. No PostgreSQL for any deployed environment

`tgg-app` needs `DATABASE_URL` (`provider = "postgresql"`). The schema, the
migration and the routes are proven against an embedded PostgreSQL 18.6 on
`127.0.0.1:55432`, but no hosted instance exists, so the career save is not live
for players and the game still persists to `localStorage` only.

**Unblocks with:** a Postgres URL in the deployment's secrets, then
`npx prisma migrate deploy`.

## 3. No public host for the TGG services

`tgg-projects`, `tgg-source` and `tgg-higgsfield` run locally on 10020/10030/
10040 and are healthy, but nothing exposes them publicly. The OCI path needs the
account owner's tenancy, DNS records and an ARM capacity check. Freebuff Sites
is at both caps (10 saved sites, 6 published), so it cannot host them either.

## 4. Creative engine absent

`tgg-higgsfield` reports `provider_bridge_configured: false` and nothing listens
on `:10041`, so render jobs fail with `creative_engine_*` errors by design. No
render was attempted or claimed. The three-endpoint bridge contract is written
down in `docs/TGG-CLOUDWAYS-REPLACEMENT.md`.

## 5. Cloudways still required

Because of blockers 2–4, the paid box keeps running the creative and project
services. Nothing in this session cancelled, downgraded or modified it, and no
money was spent.

## 6. Physical devices

No Android or iOS hardware is reachable from this environment. Every mobile
number in the test results comes from a desktop browser with an emulated
viewport and software rendering.
