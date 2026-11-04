# OPERATE: monitoring, incidents, hotfixes, rollback

Use after the first production release, and whenever the user reports something broken in production.

## A. Make production observable (once, before or at the first release)
The pack's `observe` list gives what each target needs (`gw maintain` prints it). Minimum set:
- **Backend:** `/healthz` and `/readyz` endpoints; structured JSON logs with a request id and version; error tracking; an uptime check; an SLO (start with 99.5%/30d availability plus p95 latency) with burn-rate alerts.
- **Mobile/desktop:** crash reporting; widen a staged rollout only while crash-free users stay at or above 99.5%.
- Tag every event with the **release version**. That is what links an error spike to a deploy and makes rollback decisions fast.

Write `docs/runbook.md` (template `templates/runbook.md`): how to deploy, how to roll back, where logs, errors and dashboards are, secrets locations (names only), and who to contact.

## B. Incident (reactive)
**Mitigate first, find the root cause later.**
| SEV | Meaning | Response |
|---|---|---|
| SEV1 | outage, data loss or corruption, security breach, payments broken | stop everything; mitigate within minutes; tell users |
| SEV2 | major feature broken for many users, no workaround | same day: roll back or hotfix |
| SEV3 | partial breakage, a workaround exists | next release |
| SEV4 | cosmetic | backlog |

1. Create `docs/incidents/<YYYY-MM-DD>-<slug>.md` from `templates/incident.md`. Keep a UTC timeline as you go: detected, acknowledged, mitigated, resolved.
2. Started after a deploy? **Roll back first** using the pack's `rollback` recipe; turning a feature flag off is faster still. Note:
   - **Mobile apps can't be rolled back.** Halt or pause the staged rollout, then ship a fix with a higher version.
   - **Database:** only roll back code whose migrations were expand/contract.
3. Communicate (status page or users) for SEV1–2.
4. Then fix it, using the hotfix flow below.
5. SEV1–2: write the blameless postmortem section within 5 days. Action items each have a type (prevent / mitigate / detect), an owner, and a date.

The incident playbook does not need GATE 1. Record a waiver in state.json with the incident id.

## C. Hotfix
```sh
git switch -c hotfix/<version+1> v<released-version>   # branch from the released tag, not main
# write a failing regression test, fix it, run the release-tier tests (gw run …)
git commit -m "fix: <summary> (incident <id>)"
git tag -a v<version+1> -m "hotfix" && git push origin hotfix/<version+1> --tags
git switch main && git cherry-pick -x <sha>            # the fix must land on main too
```
If the project is trunk-based (main is always releasable), fix on main and cherry-pick to the release branch instead. Release with P10's checklist and a **staged rollout**. Get user approval before publishing.

## D. Rollback readiness (check at every release)
- The previous artifact or image is still deployable (immutable tags/digests).
- Migrations are expand/contract: the previous build still runs against the new schema.
- Mobile/desktop: staged rollout plus remote config or feature flags for risky features.
- Embedded: A/B slots with test-then-confirm.
