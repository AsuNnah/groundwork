# Audit: <slice>

<!-- Lineage: ECC's brownfield-retrospective skill (MIT, github.com/affaan-m/ecc): a slice-first audit, a four-kind gap register, the fixes, then a re-audit. Playbook: phases/IMPROVE.md. -->
Date: <YYYY-MM-DD> · Perimeter: <paths in scope, entry points, direct callers> · Size: <files, lines>

## Baseline
| Check | Command | Result |
|---|---|---|
| tests | `<test command>` | <passed / failed, coverage if configured> |
| CI | <workflow> | <the last run on the default branch> |
| dead code, outdated | the `gw maintain` commands | <counts> |
| security | <scanners from phases/SECURITY.md> | <findings> |
| TODO / FIXME / HACK | <search in the slice> | <count> |

## What it does today
<!-- Behaviours as WHEN … THEN …. They become the tests that must keep passing. -->
- WHEN <trigger>, THEN <result>.

## History
<!-- The slice's git log: the most changed and reverted files, and decisions that live only in the code. -->

## Gap register
| ID | Kind | Gap | Evidence | Fix | Severity | Effort | Decision | Status |
|---|---|---|---|---|---|---|---|---|
| G-01 | practice | <a failed save is caught and ignored> | `<src/orders.js:88>` | <report the error to the caller> | P1 | S | now | open |

Kind: decision · practice · missing · technology. Severity: P0 security exposure or data loss · P1 wrong behaviour · P2 practice or observability · P3 cleanup. Effort: S under a session · M a few sessions · L its own plan. Decision: now · later (moved to docs/tech-debt.md) · won't fix (with the reason).

## Re-audit
| Check | Before | After |
|---|---|---|
| tests | | |
