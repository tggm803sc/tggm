# TGG World — deploy, verify and roll back

The playable slice lives in `tgg-game3d/` and is published by
`.github/workflows/tgg-world-pages.yml` to
<https://tggm803sc.github.io/tggm/>. It is static: no server, no database,
nothing that costs money.

## What runs when

| Event | Build + tests | Publish | Smoke test |
| --- | --- | --- | --- |
| Push to `main` touching `tgg-game3d/**` or the workflow | yes | yes | yes |
| Pull request touching the same paths | yes | **no** | no |
| Manual `workflow_dispatch` | yes | yes | yes |

`concurrency` is per-ref with `cancel-in-progress`, so a newer push on the same
branch abandons the older run instead of racing it. Only the `main` run ever
reaches the `github-pages` environment.

## Guard chain

1. `npm ci` — lockfile exact.
2. `npm test` — the `node:test` suite. A failing test stops the job.
3. `npm run build` — esbuild bundle.
4. Bundle proof — `index.html`, `game.js`, `style.css` exist and are non-empty,
   `game.js` is over 200 kB (an empty or stub build fails here), `index.html`
   really loads `./game.js`, and no source maps leaked into `dist`.
5. Upload + deploy (main only).
6. Smoke test — fetches the published page up to 12 times, requires the
   `btnHandbrake` and `startBest` markers, then fetches `game.js` and
   `style.css` and re-checks their size. A published-but-broken deployment
   turns the workflow red instead of failing silently.

Because `deploy` has `needs: build`, a red build never publishes. A red smoke
job leaves the previous deployment serving, which is the safe outcome.

## Rolling back

Fastest, keeps history:

```
git revert <commit>            # revert the bad change
git push origin main           # workflow rebuilds and republishes
```

Or redeploy a known-good commit without editing history:

1. Actions → **TGG World Pages** → **Run workflow** → choose the branch/tag you
   want, or
2. `gh workflow run tgg-world-pages.yml --ref <branch>`, or
3. **Re-run jobs** on the earlier successful run (its artifact is rebuilt from
   that commit, so the site returns to exactly that build).

Emergency stop (site stays up, nothing new is published):

```
gh workflow disable tgg-world-pages.yml
```

Settings → Pages → Source can be switched to *None* to take the site offline
entirely. Neither action deletes commits or player saves.

## Local equivalents

```
cd tgg-game3d
npm ci
npm test            # same suite CI runs
npm run build       # writes dist/
python3 -m http.server 3000 --directory dist   # play it at :3000
```

Local checkpoints: tags `tgg-free-checkpoint-1/2/3` on this worktree.

## Known limits

- Fetching the smoke test's page proves HTML + assets are served, not that
  WebGL renders on a real device. Gameplay is verified separately in a browser.
- `tgg-app` (Next.js + Prisma) is a different workflow (`tgg-app-check.yml`) and
  is not published by this one; it needs `DATABASE_URL` to do anything.
