# TGG World career database

The career API (`/api/world/save`, `/runs`, `/health`) needs one PostgreSQL
database. Locally it has been proven against PostgreSQL 18.6; this doc is the
hosted version of the same run.

## 1. Create the database

Any standard PostgreSQL works. From the services catalog, **Neon**
(serverless Postgres, free plan, no card) is the default pick; **Tiger Cloud**
gives two free services per account and is a plain Postgres too.

1. Create the project in the provider console.
2. Copy the connection string for the app role.
3. Make sure it ends with `sslmode=require` (both providers require TLS).
4. Put it in `tgg-app/.env.local` — that file is already in `tgg-app/.gitignore`,
   so it is never committed:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
```

Do not paste the string into chat, a commit, an issue or a games client. It is
the database's root credential.

## 2. Apply the schema

```bash
cd tgg-app
npx prisma migrate deploy
```

`20261117153936_world_saves` is a **baseline** migration: this repo had no
migration history before it, so it describes the whole schema, not just the two
world tables. A database that was created earlier with `prisma db push` already
has those tables and must be baselined once before `migrate deploy` will accept
it:

```bash
npx prisma migrate resolve --applied 20261117153936_world_saves
```

A fresh database needs nothing extra.

## 3. Prove the endpoints

```bash
# from the repo root; reads tgg-app/.env.local, or pass DATABASE_URL inline
bash scripts/verify-hosted-db.sh
```

Run it through `bash`: the file is committed as mode `100644`, so a bare
`./scripts/verify-hosted-db.sh` fails with "permission denied" after a clone.

It applies migrations, starts the app on `:3200`, waits for
`/api/world/health` to report `"database":"up"`, then runs
`tgg-app/scripts/hosted-db-proof.mjs` through the game's own sync client. It
prints the database **host** only, never the credentials.

Real output from the local Postgres run:

```
== prisma migrate deploy ==
No pending migrations to apply.
health: {"ok":true,"database":"up","latencyMs":80}
database                           "127.0.0.1:55432/tgg"
1. health                          {"ok":true,"database":"up","latencyMs":2}
2. anonymous load                  {"state":"signed-out","status":401}
3. first save                      {"state":"ok","revision":1,"bestRunMs":1200}
4. stale revision                  {"state":"conflict","revision":1}
5. run submission                  {"state":"ok","duplicate":false,"revision":2,"best":845,"runs":2}
6. duplicate retry                 {"state":"ok","duplicate":true,"save":null}
7. player isolation                {"state":"ok","save":null}
8. foreign run id                  {"state":"failed","status":409}
cleanup                            "proof rows removed"
RESULT: 8/8 checks passed
```

What each line means:

| Line | Proves |
| --- | --- |
| `1. health` | The app can round-trip a query, not just start. |
| `2. anonymous load ... 401` | No session cookie, no save. Player ids only ever come from the httpOnly `tgg_player_id` cookie. |
| `3. first save ... revision 1` | The first save creates the row with optimistic-concurrency revision 1. |
| `4. stale revision ... conflict` | An old tab cannot overwrite a newer career; the server returns the authoritative revision. |
| `5. run submission ... best:845` | A finished run updates best and run count in one transaction. |
| `6. duplicate retry ... duplicate:true` | Retrying a POST does not double-count the run. |
| `7. player isolation ... save:null` | One player cannot see another player's career. |
| `8. foreign run id ... 409` | A run id belonging to someone else is refused. |

Any failed check prints `FAILED CHECK:` and exits non-zero, so CI goes red
instead of green with a disappointing log.

The proof seeds two throwaway players (`76561190000090001/2`) and clears their
world rows before and after the run; it never touches other players' data.
`KEEP_PROOF_PLAYERS=1` leaves the rows in place for inspection.

### Run it from GitHub instead (no computer needed)

The repo has a dispatchable workflow, `TGG World DB Verify`:

1. Settings → Secrets and variables → Actions → **New repository secret**.
2. Name it `DATABASE_URL`; paste the hosted Postgres connection string
   (including `sslmode=require`). Save — GitHub never shows the value again.
3. Actions → **TGG World DB Verify** → **Run workflow** → branch `main`, leave
   `apply_migrations` on → **Run**.
4. Open the finished run and download the **tgg-world-db-verification**
   artifact; `db-verification.log` holds the proof lines, and the job summary
   shows them inline.

The workflow never prints the connection string (Actions masks the secret, and
the proof prints only the host). It fails with an explicit
`Missing secret DATABASE_URL` annotation while the secret is absent, refuses to
baseline a database that already has tables (`P3005`) instead of marking the
migration applied, and exits non-zero when any of the eight checks fails.

## 4. Point the game at it

When the app serves the game at `/game/`, sync is same-origin and needs nothing.
If the game is served from another origin, allow that origin with
`TGG_WORLD_ALLOWED_ORIGINS` (comma separated; `https://tggm803sc.github.io` is
allowed by default) and remember the session cookie is `SameSite=Lax`, so a
truly cross-site game needs the app to issue it for that site.

The GitHub Pages build has no `/api/world`, so it stays device-local by design:
the client treats a missing endpoint as "local only" and never blocks a frame.

## 5. Still open

- Hosting the Next.js app itself next to the database (the API has to be reachable
  for the game to sync).
- A physical-phone pass for the touch controls.
