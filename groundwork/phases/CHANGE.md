# CHANGE: changes to an existing system (brownfield)

With P0's tier, for features, bugfixes and refactors in an existing codebase.

1. **Baseline:** run the existing tests before changing anything. Tell the user by name which ones already fail (pre-existing); don't count them as yours or fix them unasked. With a red baseline, the task's check runs only your change's tests (e.g. `node --test test/duration.test.js`).
2. **A task with a check, even for a one-line fix:** `gw task add T01 "<change>" --verify "<test command>"`, `gw task start T01`, make the change, `gw task done T01`.
3. **Documents:** only what `gw docs` lists. For a change that is the folder `docs/changes/<YYYYMMDD-slug>/`, not a new PRD/FSD/TRD set:
   - `proposal.md` (`templates/change-proposal.md`): why, what changes, out of scope, affected REQ IDs, how the change is proven;
   - `delta.md` (`templates/change-delta.md`): requirements ADDED / MODIFIED / REMOVED / RENAMED, each a SHALL statement with `#### Scenario:` WHEN/THEN (the full text for MODIFIED);
   - a bugfix writes `bugfix.md` (`templates/bugfix.md`) instead: current behaviour with repro steps, expected behaviour, what must not change, the root cause. Its first task is a failing test that reproduces the bug.
   `gw trace` checks only the REQ IDs these name; a PRD row that is already built says `delivered`.
4. No current-truth docs (PRD/FSD/TRD in `docs/`)? First write a short `docs/system-overview.md` from the code (`templates/system-overview.md`). Starting from a reference app: `phases/RESEARCH.md`.
5. After release: merge the delta into the current-truth docs and move the folder to `docs/changes/archive/`.
