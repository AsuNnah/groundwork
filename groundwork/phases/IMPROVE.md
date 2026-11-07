# IMPROVE: audit an existing app, then fix what matters

Use this for an app that already exists when no single feature or bug is named yet: "improve my app", "what did we miss?", "audit this project", or an app you inherited or come back to after a long gap. The audit changes no code. The fixes that follow are ordinary changes (`phases/CHANGE.md`, `phases/MAINTAIN.md`). The method is adapted from ECC's `brownfield-retrospective` skill (MIT).

1. **One slice at a time, not the whole repo.**
   - The user names a module, feature, flow, bug or dependency: the slice is that code plus its direct callers.
   - Nothing named: count the files changed most in the last year (`git log --since=1.year --name-only --format=`). Propose the 2–3 busiest areas and let the user pick.
   - Keep a slice to about 15 files or 2,000 lines, and split a bigger one.
   - `gw set stage=improve`. P0 picks the tier as usual, at least `small` (auth, data or payments make it `standard`). The change folder is `docs/changes/<YYYYMMDD>-improve-<slice>/`.
2. **Baseline, with evidence, in `audit.md`** (`templates/audit.md`). Fix nothing yet: a fix during the audit hides the baseline.
   - Run the checks: the tests (count, failures, and coverage if it is configured), the last CI result, the dead-code and outdated commands from `gw maintain`, the scanners in `phases/SECURITY.md`, and a count of TODO, FIXME and HACK in the slice.
   - Review the slice as P9 reviews a diff: correctness, simplicity, tests, naming, security. Also look for swallowed errors.
   - Write down what the slice does today as WHEN … THEN … behaviours. They become the tests that must keep passing. If there are no current-truth docs, write `docs/system-overview.md` first (`phases/CHANGE.md` step 4).
   - Read the history: the slice's `git log`, its most changed and reverted files, and decisions that live only in the code.
   - Every finding points at a `file:line` or a command's output. Leave out a finding without evidence: it is an opinion.
3. **Gap register:** the table in `audit.md`, one row per gap. There are four kinds:
   | Kind | Look for |
   |---|---|
   | decision | choices and invariants that live only in the code |
   | practice | code that breaks the project's conventions or Groundwork's rules: no test, a swallowed error, no validation at a trust boundary |
   | missing | what a new build would have included: input validation, error reporting, observability, rate limits, migrations with rollback, accessibility, CI gates, user docs |
   | technology | an outdated, duplicated, unmaintained or risky dependency or tool |

   Severity: P0 is security exposure or data loss, P1 wrong behaviour, P2 practice or observability, P3 cleanup. Effort: S is under a session, M a few sessions, L needs its own plan.
4. **The user picks.** Show the rows by severity, mark the quick wins, and recommend a first batch. Each row gets a decision:
   - `now`: the row goes into `proposal.md` and `delta.md` (ADDED for a missing piece, MODIFIED for wrong behaviour, nothing for a refactor);
   - `later`: it moves to `docs/tech-debt.md` with its evidence (`phases/MAINTAIN.md`);
   - `won't fix`: the row keeps the reason.

   A `decision` row becomes an ADR (`templates/adr.md`), marked as reconstructed in the audit. GATE 1 approves the batch.
5. **Fix one row per task**, each task with its check. A wrong-behaviour row starts with a failing test. A refactor row keeps the behaviour: write characterization tests first (`phases/MAINTAIN.md`). A refactor and a behaviour change never share a commit. Mark the row done with its commit.
6. **Re-audit before P10.** Run step 2's checks on the same slice again and add the before and after numbers to `audit.md`. A gap is closed when the re-audit shows it, not when someone says so. Any new finding becomes a new row, and the next slice gets a new change folder.
