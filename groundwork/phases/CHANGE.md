# CHANGE: changes to an existing system (brownfield)

Use for features, bugfixes, or refactors in a codebase that already exists, together with P0's tier.

- **Current truth:** `docs/` (PRD/FSD/TRD) describes the system as it is. If those docs are missing, write a short `docs/system-overview.md` from the code first (`templates/system-overview.md`): modules, entry points, data, how to run, how to test.
- **Change folder:** `docs/changes/<YYYYMMDD-slug>/`
  - `proposal.md` (`templates/change-proposal.md`): why, what changes, out of scope, affected REQ IDs;
  - `delta.md` (`templates/change-delta.md`): requirements ADDED / MODIFIED / REMOVED, each with WHEN/THEN scenarios;
  - `tasks` go into `.groundwork/tasks.json` as usual.
- **Bugfix:** instead of a proposal, write `bugfix.md` (`templates/bugfix.md`) with: current behaviour (with repro steps), expected behaviour, behaviour that must stay unchanged, and the root cause once found. The first task is a failing test that reproduces the bug.
- **After release:** merge the delta into the current-truth docs and move the folder to `docs/changes/archive/`.
