# MAINTAIN: refactoring and tech debt (reactive)

Maintenance is reactive: act when work touches the code, not on a schedule.

## Tech-debt registry: `docs/tech-debt.md` (template `templates/tech-debt.md`)
Add an item when any of these happens:
| Trigger | Action |
|---|---|
| a change took more than 2× its estimate because of the code | add an item with an "interest" note (what it costs each time) |
| the same area causes a bug 2–3 times | add or raise the item |
| you find dead code, duplication, missing tests, or a confusing design while doing a task | add an item; don't fix it now unless it's a tiny cleanup |
| a dependency is unmaintained | add a dependency-type item, and an UPGRADE entry |

Score each item: **priority = (impact × frequency) / cost**, each on a 1–5 scale.

## When a task touches an area that has debt
- **Boy-scout rule:** do a small cleanup in the same area, as a separate commit with no behaviour change.
- If the top debt item blocks the task, propose fixing it first (one line: cost and benefit) and let the user decide.

## Safe refactoring
1. Tests are green. For legacy code without tests, write **characterization tests** first: record real inputs, snapshot the outputs, assert they stay identical. Use Jest/Vitest snapshots, pytest syrupy, ApprovalTests, or Go golden files. Remove nondeterminism (time, random, ordering) before snapshotting.
2. Take one mechanical step at a time (rename, extract, move), using IDE/LSP refactors where possible. Run the tests and commit after each step.
3. Never mix a refactor and a behaviour change in one commit.
4. **Large replacements** use the strangler fig: put a facade in front of the old code, route one path to the new code, compare, move the rest gradually, then delete the old code.
5. Long work: put it behind a feature flag or use branch by abstraction, so main stays releasable.

## Dead code and unused dependencies
Run the pack's `maintain.<stack>.deadcode` command (`gw maintain`). Delete a finding only when the tests pass and nothing references it dynamically (reflection, DI, public API, plugins, config).

## Drift between docs and code (converge)
When the code and the current-truth docs (PRD, FSD, BSD, approved mockup) disagree, show the user each difference and let them choose: the docs change to describe the code, or new tasks are appended to bring the code back to the docs. Record the choice in the plan. Never rewrite finished tasks or silently "fix" either side. `gw trace` shows REQs that lost their task or test.

## Size and gates
Treat refactors as `CHANGE` work: refactoring a single module is `small`; cross-module work, or anything touching auth or data, is `standard` and goes through GATE 1 as usual. Mark items `done` in the registry with the commit.
