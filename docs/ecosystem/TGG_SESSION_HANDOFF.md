# TGG SESSION HANDOFF — 2026-11-17

## What is waiting on you

Two pull requests are still open: `tgg-os`#10 and this docs-only PR in `tggm`.
They are independent and can be merged in either order.

The four `tgg-studio` / `tru-go-getta-mixtape` PRs from this session have been
merged, in the order each CI branch required:

| PR | Repo | State |
|---|---|---|
| [#1](https://github.com/tggm803sc/tru-go-getta-mixtape/pull/1) | `tru-go-getta-mixtape` | **merged** — fixes the gate that had been failing on `main` |
| [#2](https://github.com/tggm803sc/tru-go-getta-mixtape/pull/2) | `tru-go-getta-mixtape` | **merged** — `Static gates` now runs on every PR and is required on `main` |
| [#1](https://github.com/tggm803sc/tgg-studio/pull/1) | `tgg-studio` | **merged** — quota-safe autosave and feed; 5 new tests |
| [#2](https://github.com/tggm803sc/tgg-studio/pull/2) | `tgg-studio` | **merged** — `Test and build` now runs on every PR and is required on `main` |
| [#10](https://github.com/tggm803sc/tgg-os/pull/10) | `tgg-os` | open — reopen where you left off; minute-accurate clock |

Each CI branch was stacked on its repo's fix branch, because the gates it runs
could not be green off `main` (`tgg-studio`'s `test/` directory only existed in
#1; the mixtape gate was still red in `main`). `#1` was merged first in each
repo, then `#2`. `main` is `c60758d` (`tgg-studio`) and `b9158c4`
(`tru-go-getta-mixtape`), and both got a green push-triggered run before the
check was made required — the gate was never armed on a red branch.

## Ordered next tasks

### P0 — finish what is already in flight

1. **Review and merge the two remaining PRs** (`tgg-os`#10 and this docs PR).
   The four `tgg-studio` / `tru-go-getta-mixtape` PRs are merged; their checks
   re-ran green on `main` after the merge.
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
5. **CI is in force.** Both workflows are on `main` and each is a required
   status check, so a red run blocks a PR merge. Two gaps remain, neither
   verified by failing a run on purpose: `enforce_admins` is off (the owner can
   still merge past red), and only PR merges are gated — a direct push to
   `main` is unchecked. Turning on `enforce_admins`, or moving the requirement
   into a ruleset that also covers direct pushes, closes them.
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
  way. Nothing was merged into one codebase.
- The `main` branch that was red and the two that had no CI are documented in
  `TGG_SESSION_TEST_RESULTS.md`; re-run those exact commands before trusting a
  future state.
