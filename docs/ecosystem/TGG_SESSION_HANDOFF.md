# TGG SESSION HANDOFF — 2026-11-17

## What is waiting on you

Five pull requests are open, each on its own repo, each verified locally. The
`tgg-os` and docs PRs are independent and can be merged in any order. The two
CI PRs are **not** independent: each is stacked on its repo's #1, so merge in
the order shown below.

| PR | Repo | What it does | Risk |
|---|---|---|---|
| [#1](https://github.com/tggm803sc/tru-go-getta-mixtape/pull/1) | `tru-go-getta-mixtape` | Fixes the gate that has been failing on `main`, letting both static gates run again | very low — test expectation only |
| [#2](https://github.com/tggm803sc/tru-go-getta-mixtape/pull/2) | `tru-go-getta-mixtape` | CI: runs `npm run check` on every PR and on pushes to `main` | very low — one new workflow file, green on the runner |
| [#1](https://github.com/tggm803sc/tgg-studio/pull/1) | `tgg-studio` | Quota-safe autosave and feed; 5 new tests | medium — changes the storage contract (extra return values, harmless to current callers) |
| [#2](https://github.com/tggm803sc/tgg-studio/pull/2) | `tgg-studio` | CI: runs `npm ci`, `npm test`, `npm run build` and a bundle assertion on every PR | very low — one new workflow file, green on the runner |
| [#10](https://github.com/tggm803sc/tgg-os/pull/10) | `tgg-os` | Reopen where you left off; minute-accurate clock | low — three files, typechecked and built |

Plus this docs-only PR in `tggm` (`docs/ecosystem/`).

**Merge order matters in two repos.** Each CI branch is stacked on that repo's
`fix/…` branch, because the gates it runs cannot be green off `main` yet
(`tgg-studio`'s `test/` directory only exists in #1; the mixtape gate is still
red in `main`). Merge `#1` first and GitHub retargets `#2` to `main`
automatically, leaving a diff of just the workflow file. Each CI PR is already
`success` with 0 annotations on its current base.

## Ordered next tasks

### P0 — finish what is already in flight

1. **Review and merge the five PRs.** Each has the local command output in its
   body; re-run the same command after merge. Merge each repo's #1 before its
   #2 so the CI branch is not retargeted mid-review.
2. **Verify the TGG OS resume and clock in a browser** (`npm run dev`, reload on
   Snap → Chat, confirm it comes back to Chat; confirm the clock changes on the
   minute). This is the only unverified part of that PR.
3. **Verify the studio banner** by filling `localStorage` past quota (or
   temporarily setting the budget) and confirming the banner appears, then
   disappears after a successful save.

### P1 — close the reliability gaps this session found

4. **Wire `tgg-studio`'s `App.jsx` to the new storage status.** `saveProject`
   now returns `saved | trimmed | failed` and `savePublished` returns
   `{ cuts, status }`; the editor still ignores them and keeps its own list in
   memory. Use the existing `showToast` for `trimmed`/`failed`, and
   `setFeed(saved.cuts)` on publish. Small diff, deferred only because of B1.
5. **CI is written but not in force.** `tgg-studio`#2 and
   `tru-go-getta-mixtape`#2 add the workflows (`npm ci` + `npm test` +
   `npm run build` / `npm run check`); both are green on GitHub's runners. They
   protect nothing until merged — that is P0 above. Optional hardening once
   they are in: require the check on `main` in branch protection, so a red run
   blocks the merge instead of only reporting it.
6. **Run `next build` for `tgg-app`** with a database URL, so the app is
   verified beyond `tsc --noEmit`.

### P2 — verification the session could not do

7. **Check GitHub Actions runs** for `tgg-world-pages.yml` and the nine `tggm`
   workflows, and record the Pages URL with the SHA it serves.
8. **Make `tggm-universe-private` testable** (credentials for clone, or a CI
   workflow that runs its five suites). Its current state is unknown.
9. **Runtime suite health for TGG OS**: the measured probes in
   `TGG_ECOSYSTEM_REGISTER.md` show the declared statuses are right today, but
   nothing re-checks them. A small scheduled probe that updates
   `src/suite.ts` statuses (or a build-time check) would stop a dead tile from
   being presented as `Live`.

### P3 — larger, needs decisions or credentials

10. **Unreal TGG World**: nothing can be built until the real `.uproject` and an
    engine build environment exist. Do not let browser slices stand in for it.
11. **OCI apply**: needs credentials and explicit authorisation; until then the
    control plane has no host and `tggm` PRs #15/#16 stay blocked.
12. **Provider integrations** (Higgsfield/OpenAI): verify against a real endpoint
    with credentials before any claim of working generation.

## Facts to keep

- The ecosystem is **six repositories**, one private; there are no organizations.
- `tru-go-getta-mixtape` is the TGG Projects/Source/Higgsfield service, not a
  mixtape site — do not judge it by its name.
- Browser games (`tggm/tgg-game3d`), the Next app (`tggm/tgg-app`), TGG OS,
  TGG Studio and the Unreal drop are **separate codebases** and were kept that
  way. Nothing was merged.
- The two `main` branches that were red or untested are documented in
  `TGG_SESSION_TEST_RESULTS.md`; re-run those exact commands before trusting a
  future state.
