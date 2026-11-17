# Session 3 — test results

Every number here came from a command in this session. Nothing is projected.

## CI (GitHub)

| Check | Result |
| --- | --- |
| Workflow YAML parses | ok — jobs `build`, `deploy`, `smoke`; deploy guarded to non-PR events |
| Guard block simulated locally against `dist/` | ok — 3 files present, `game.js` 545,483 B > 200 kB, index loads `./game.js`, no maps |
| Smoke assertions against live site | ok — markers present, `game.js` 200 / 545,483 B |
| Run #4 on `main` (`cc6194d`) | **success** (build → deploy → smoke) |

## Game unit tests (`cd tgg-game3d && npm test`)

```
ℹ tests 13   ℹ pass 13   ℹ fail 0   ℹ cancelled 0   ℹ skipped 0
```

## App unit tests (`cd tgg-app && npm test`, `node --test` with type stripping)

```
ℹ tests 13   ℹ pass 13   ℹ fail 0   ℹ cancelled 0   ℹ skipped 0
```

## App typecheck (`npm run check`)

`tsc --noEmit` → exit 0 after typing the JSON column as `Prisma.InputJsonValue`.

## Database (real PostgreSQL 18.6, embedded, port 55432)

Migration `20261117153936_world_saves` applied: *"Your database is now in sync
with your schema."*

Live route results through `next dev` on :3100:

| Request | Result |
| --- | --- |
| `GET /api/world/health` | 200 `{"ok":true,"database":"up"}` |
| `GET /api/world/save` no cookie | 401 `unauthenticated` |
| `PUT /api/world/save` no cookie | 401 `unauthenticated` |
| `POST /api/world/runs` with unknown player cookie | 401 `unauthenticated` |
| `PUT` save as player A (fresh) | 201, revision 1, best 950, career kept |
| `GET` save as player A | 200, same row |
| `GET` save as player B | 200 `{"save":null}` — isolation holds |
| `PUT` with stale `revision:0` | 409 `stale_revision`, returns authoritative row |
| `PUT` `bestRunMs:"fast"` | 400 `invalid_best_run` |
| `PUT` 9 kB career blob | 400 `career_too_large` |
| `POST` run `run_e2e_0001` | 201, best improved 950 → 750, runs 2 |
| `POST` same run again | 200 `duplicate:true` — idempotent |
| `POST` A's run id as player B | 409 `run_owned_by_another_player` |
| `GET /api/world/runs` | returns `totalMs 750`, `legs [600,150]` |
| Database rows after the run | 1 save row (revision 2, runs 2, best 750) + 1 run row |

## Game browser checks (cloud browser, software GL)

| Check | Result |
| --- | --- |
| Leg split | `L1 0:01.0` matching the timer, `inline-block`, 20 px line inside the mission card |
| Background tab | `document.hidden true` → `paused() true`; run time frozen at 1.050 s |
| Return from hidden | `paused() false`; only 0.151 s banked across a ~2 s hide (no lurch) |
| Quality recovery | ratio 0.8 → **0.95** after 220 fast frames, → **0.8** after 60 slow frames, cap 1.25 |
| 390×844 layout | split visible, no horizontal overflow, mission card 200 px |
| 360×640 layout | no horizontal overflow |
| 844×390 landscape | no overflow either axis, pedals and speedo in view, canvas 844×390 |

## Not tested

- Physical Android/iOS device: **NOT TESTED** (no device available).
- Hosted Postgres: no `DATABASE_URL` provisioned for any environment.
- Creative engine render: engine absent, nothing listening on `:10041`.
- Device frame rate: the cloud browser uses software GL (3–7 fps) and is not
  representative of a phone GPU.
