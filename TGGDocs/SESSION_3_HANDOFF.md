# Session 3 — handoff

## Where the work is

| Piece | Location |
| --- | --- |
| CI hardening, deploy doc | GitHub `main` @ `cc6194d` (PR #21), verified by run #4 |
| These records | GitHub `TGGDocs/` (this PR) |
| Phase 2/3 app layer | this chat's worktree, tag `tgg-free-checkpoint-4` |
| Phase 4/5 game layer | same tag |

## Landing the worktree work

From an authenticated clone:

```
git fetch <this-worktree> tgg-free-checkpoint-4
git checkout -b feat/session3-world FETCH_HEAD
git diff --stat cc6194d..HEAD   # 20 files, ~1128 insertions
git push -u origin feat/session3-world
gh pr create --fill --base main
```

The changes are additive and independent of each other:

- `tgg-app/**` — schema + migration + `src/lib/world/*` + three `api/world`
  routes + 13 tests. Needs `DATABASE_URL`; nothing else in the repo changes.
- `tgg-game3d/**` — 4 files (`src/main.js`, `src/audio.js`, `index.html`,
  `style.css`). No new dependencies, bundle 545,483 → 546,227 B.

CI will validate both on push: the game workflow runs `npm test`, the bundle
proof and the live smoke test; `tgg-app-check.yml` runs `prisma generate` and
`tsc --noEmit`.

## Exact next actions

1. Land the worktree branch (above) and let both workflows finish.
2. Provision Postgres, set `DATABASE_URL`, run `npx prisma migrate deploy`,
   then `GET /api/world/health` must answer `{"ok":true,"database":"up"}`.
3. Point the game at the save API once a public host exists (it is static today
   and writes only to `localStorage`).
4. Stand up the creative engine on `:10041` or behind the documented bridge.
5. Run the phone pass: touch steering, handbrake, save/reload, rotate, background
   and resume — none of this has been done on real hardware.

## Reproducing this session's checks

```
cd tgg-game3d && npm test && npm run build
cd tgg-app && npm test && npm run check
# database proof (embedded Postgres, no root needed):
npm i embedded-postgres && node /tmp/pgtest/start-pg.mjs
cd tgg-app && DATABASE_URL=postgresql://tgg:tgg@127.0.0.1:55432/tgg \
  npx prisma migrate deploy && npx next dev -p 3100
```

## Checkpoints

`tgg-free-checkpoint-1` … `tgg-free-checkpoint-4` in this worktree. Rollback is
`git reset --hard tgg-free-checkpoint-3` for the pre-session state.
