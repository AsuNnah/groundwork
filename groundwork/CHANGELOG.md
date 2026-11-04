# Changelog

## 0.3.3 (2026-11-05)
- **Required skill inspection with `skill-inspector`** (NVIDIA SkillSpector):
  - Every skill fetched from a GitHub repo, curated or trending, must have a recorded verdict for its exact commit before `gw skills install` accepts it (`gw skills verdict <id> APPROVE|CAUTION|REJECT "reason"`).
  - CAUTION needs `--accept-caution` after user approval.
  - **REJECT shows why** (reason, evidence, report path) and stops the install; the user decides. An install anyway needs `--override-reject "<user's words>"` and is recorded in the lock file and feedback log. A REJECT also stops future suggestions.
  - `--skip-inspection "<reason>"` exists for manual reviews and is logged.
- If `skill-inspector` is missing, Groundwork suggests installing it **first**: at session start, at the top of every recommendation list, in `gw doctor`, and when fetching.
  - It comes from the pinned official `nvidia/skillspector` repo (Apache-2.0).
  - `gw skills install skillspector/skill-inspector --global` bootstraps it without a verdict.
- `gw skills install --global` installs into `~/.claude/skills`.
- The SkillSpector CLI install is pinned in `tools.json`, and the scanners detect it.

## 0.3.2 (2026-11-04)
- **Weekly trending skill discovery (silent).**
  - Once a week, at the first session start, a background process reads skills.sh trending.
  - It drops non-dev skills, lookalikes of known sources (possible impersonation), skills already curated, and declined ones.
  - It classifies each candidate from its `SKILL.md` description and keeps the **top 10 that fit this project's targets, stacks and phases**, pinned to the current commit, in `.groundwork/skills-discovered.json`.
  - These show up in recommendations (★, "trending #N, not reviewed", up to 2 slots).
- Installing a discovered skill without a licence needs `--force`.
- `gw skills refresh [--force]`, `gw skills trending on|off`, `gw skills refresh-day <mon..sun|off>` (align with your weekly usage reset).

## 0.3.1 (2026-11-04)
- **Automatic, context-aware skill recommendations.** Ranked by task keywords, current phase, stage playbook, and stack/target, each with a "why now" reason. They appear at session start, after `gw phase`, and after `gw set` of stage, targets or stacks. On demand: `gw skills --for "<task>"`.
- `gw skills decline <id>` stops a suggestion from coming back. The agent rule: suggest once with the reason, never install without approval.
- Catalogue entries gained task `keywords`. Short keywords match whole words only.

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
