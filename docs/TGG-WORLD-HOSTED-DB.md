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
anonymous load                     {"state":"signed-out","status":401}
A load (new career)                {"state":"ok","save":null}
A first push                       {"state":"ok","revision":1,"bestRunMs":1200}
A push on stale revision           {"state":"conflict","revision":1}
A submitRun 845ms                  {"state":"ok","duplicate":false,"revision":2,"best":845,"runs":2}
A retry same run id                {"state":"ok","duplicate":true,"save":null}
A reload                           {"revision":2,"bestRunMs":845,"runs":2}
B load (isolation)                 {"state":"ok","save":null}
B reusing A's run id               {"state":"failed","status":409}
== done (exit 0) ==
```

What each line means:

| Line | Proves |
| --- | --- |
| `anonymous load ... 401` | No session cookie, no save. Player ids only ever come from the httpOnly `tgg_player_id` cookie. |
| `A load ... save:null` | A player with no career yet reads `null`, not an error. |
| `A first push ... revision 1` | The first save creates the row with optimistic-concurrency revision 1. |
| `A push on stale revision ... conflict` | An old tab cannot overwrite a newer career; the server returns the authoritative revision. |
| `A submitRun 845ms ... best:845` | A finished run updates best and run count in one transaction. |
| `A retry same run id ... duplicate:true` | Retrying a POST does not double-count the run. |
| `B load ... save:null` | One player cannot see another player's career. |
| `B reusing A's run id ... 409` | A run id belonging to someone else is refused. |

The proof seeds two throwaway players (`76561190000090001/2`) and clears their
world rows before it starts; it does not touch other players' data.

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
