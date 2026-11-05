# Changelog

## 0.4.0 (2026-11-05)
From real-run feedback (3 projects: a Discord/Telegram bot workspace, a web+backend app, a Rust server) and user requests.

### Added
- **Reference-app research** (`phases/RESEARCH.md`, `templates/reference-research.md`):
  - when the user says "like X", the agent works out how X works from evidence: docs → source → using it → Scrapling → REA;
  - it suggests the tool the question needs whatever it costs, with approval, and lawfully;
  - **starts automatically:** a new `UserPromptSubmit` hook spots "learn X", "pelajari X", "I want an app like X", "X for reference", "bikin kayak X" (English + Indonesian) and points the agent at the playbook;
  - existing projects with hooks get the new hook on upgrade;
  - the agent asks for the goal if it's vague (what to learn, what for, when it's done), recommends the depth the goal needs, and after each method checks the goal, stepping up to the next method or another route until it's met;
  - `gw research "<X>" ["goal"]` records the reference, creates `docs/research/<x>.md`, and has doctor check Scrapling and REA;
  - `gw plan-install` prints the pinned installs (`scrapling[fetchers,ai]==0.5.1`, `rea-agents@6.8.0`).
- **Mockups before building** (`phases/MOCKUP.md`, `templates/mockup/index.html`, a Mockups section in `templates/dbd.md`):
  - P5 adds wireframe → visual mockup → clickable prototype for every screen state and size;
  - built in **Figma** through the official Figma MCP when the user wants it and has connected it (editable layers, DBD tokens as variables, comments read back), otherwise as a no-account HTML clickable prototype;
  - the user's approval is a P6 pre-build check, P7 builds from the mockup, and P8/P9 compare against it;
  - the prompt hook also spots "mockup", "wireframe", "Figma", "tampilan aplikasi".
  - **Figma first when the machine can use it:** packs with screens declare `"ui": true`, and doctor then checks whether a Figma plugin or MCP is set up (config files only, never credentials);
  - the agent verifies the login with `whoami` and tells the user exactly what to do, marking each **manual action**: turn it on (`claude mcp add …` or `/plugin`), restart, `/mcp` → Authenticate, a free sign-up, or logging in to figma.com plus the Claude in Chrome extension for browser steps;
  - it falls back to the HTML prototype if there's no internet, the user declines, or setup fails.
- **Existing projects map instead of duplicate:**
  - `gw set docs_dir=<path>` or `docs.prd=/docs.plan=/docs.test_strategy=` (GATE 1 and the edit guard follow them; doc names match case-insensitively). This replaces pointer files.
  - P0 explains: adopting another ID scheme, phases done out of order, workspaces with several products.
- **Dev method override:** `gw set dev_method=native-user-scope dev_method_reason="no Docker in dev"`. Doctor and `gw run` honour it, with local container tiers off.
- **Upgrade re-check:** `gw upgrade` flags finished phases whose instructions changed. They show in `gw status` until they're marked done again.
- P4: verify each MCP server or connector a later phase needs with one harmless call.
- P0: every task gets P0, even a one-line fix (one command at the trivial tier). Workarounds are logged.
- Copy-paste prompts for an AI agent: set up (README) and update (UPGRADING.md).
- **Templates aligned with real project docs** (compared against two real runs' document sets):
  - new `intent.md` (confirmed statement of intent, written before the PRD) and `mockup-review.md` (blind review by independent persona reviewers);
  - PRD gains summary, goals and metrics, domain model, scope and constraints, AI requirements, rollout, alternatives, open decisions, decision log;
  - FSD gains Part 0 conventions (screen spec layout, shared components, dialogs, validation, roles, scenario IDs), traceability, reconciliation, a large-project split;
  - AFD gains a flow index with AF IDs, code anchors, system flows;
  - TRD gains system context, technology, configuration, network exposure, NFR responses, build/release, engineering constraints;
  - BSD gains roles, file and log formats, other protocols;
  - DBD gains audience and job, principles, information architecture, components and states, deliberately absent;
  - SRD gains trust boundaries, per-round threat tables, pen-test results, residual risk, review history and cadence;
  - plan gains delivered, dependencies, backlog, test approach;
  - research gains a verdict, reuse decisions, a compatibility contract, PRD corrections, a verify list, and full reports.
- Templates for every document the phases ask for: `afd.md` (app flows), `bsd.md` (API contracts + DB schema + migrations), `dbd.md` (UI design brief: tokens, screen states, accessibility), `platform.md` (per-target permissions, signing, store rules), `system-overview.md`, `change-proposal.md`, `change-delta.md`, `bugfix.md`, `uat.md`, `lessons.md`, `upgrade.md`, `security-exceptions.md`.
- Phases P5, P8, P11, CHANGE, UPGRADE and SECURITY now point at them.
- Selftest: every `templates/*.md` named in a phase file must exist.

### Fixed
- Doctor reported skill vetting as "misconfigured" when only the optional SkillSpector CLI was missing.
- `.groundwork/FEEDBACK.md` went stale between phases. It's now rebuilt on every event.
- Info-level checks (e.g. Playwright installed per project) are no longer logged as problems.
- Trending lookalikes logged ~120 skill names per refresh. Now each new impersonating repo is logged once.
- `gw plan-install` never chose npm-based install commands.

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
