# Changelog

## 0.3.0 (2026-11-04)
- **Lifecycle after release:** new playbooks `UPGRADE` (dependencies, SDKs, runtimes, store-policy deadlines), `MAINTAIN` (reactive refactoring and tech-debt registry), `OPERATE` (observability, incidents, hotfix, rollback), and `SECURITY` (scan, triage with KEV/EPSS/reachability, reactive advisories, leaked secrets).
- New P0 stages: `upgrade`, `refactor`, `incident`, `security`. Incident and security stages bypass the GATE 1 edit guard.
- Packs gained `maintain` (outdated/upgrade/audit/dead-code/override commands per stack), `rollback`, `observe`, and `policies` (Play target API, Apple Xcode minimum, with sources to re-check).
- `gw maintain`, `gw eol` (live end-of-life check via endoflife.date).
- **Skill catalogue:** 69 curated skills from ECC, Superpowers, and agent-skills (MIT), pinned by commit. `gw skills`, `gw skills fetch <id>`, `gw skills install <id>` (installs with LICENSE, recorded in `.groundwork/skills.lock.json`).
- **Upgrading Groundwork:** `gw upgrade <new-folder>` (backup, replace not merge, migrate state), `gw verify [--clean]` (detect local edits and leftover files via `MANIFEST.json`), automatic state migration on the next command or session start, and project overrides in `.groundwork/packs/` and `.groundwork/tools.json`.
- Templates: tech-debt, incident/postmortem, runbook. Tools: osv-scanner, gitleaks, syft, trivy.

## 0.2.0 (2026-11-04)
- First public version: host scan, phases H0–P11, gates, hooks, run receipts, nine platform packs, silent feedback loop.
