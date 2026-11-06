# Changelog

## 0.6.0 (2026-11-06)
The roadmap items after 0.5.0: CI workflows per pack, devcontainers per stack, more packs and presets, and a scanner verified on Windows.

### Added
- **CI workflows** (`gw ci [list] | print <target> | write [target...] [--os …] [--force]`):
  - one GitHub Actions workflow per target, assembled from `templates/ci/` (a skeleton, one step fragment per stack, service blocks);
  - actions pinned to commit SHAs; the pack chooses the runners (Android emulator with KVM on Ubuntu, macOS for Apple targets, Windows), services (Postgres + Redis for backend) and stack variables;
  - `--os` or `gw set ci_os=linux,windows` narrows the runners; an OS the pack can't use is an error;
  - monorepos: when the project is a subfolder of the git repo, the workflow goes to the git root with `paths` filters and `working-directory`;
  - every fragment carries a `# verified:` line, so an untested template says so in the generated file;
  - existing workflows are kept unless `--force`; `gw doctor` warns when a target's release tier runs on CI and its workflow is missing;
  - P8 uses it for S3.
- **Devcontainers** (`gw devcontainer [--print] [--force]`): `.devcontainer/devcontainer.json` merged from the blocks the project's stacks need (`packs/devcontainers.json`: image, features, ports, extensions, env, post-create commands), plus the notes and checks to run inside it. P3 uses it.
- **New packs:** `game` (Godot, Unity, Unreal) and `browser-extension` (Manifest V3, WXT, Plasmo).
- **New stacks:** Flutter and React Native for web; .NET MAUI for Android, iOS, macOS and Windows; Flutter for macOS, Windows and Linux desktop.
- **Cross-platform presets** (`gw set preset=flutter|react-native|electron|tauri|dotnet-maui [targets=…]`, `packs/presets.json`): one stack on every target it covers.
- `godot` in the scanners and `tools.json`.
- **Framework CI** (in the repo, not shipped): selftest and a scanner + CLI smoke test on Ubuntu and Windows with Node 18 and the current LTS; generated workflows for sample projects in `tests/ci-fixtures/`; a devcontainer build of every block set.

### Changed
- npm 12+ and pnpm 10+ block dependencies' install scripts unless the project approves them. The Node CI fragment now warns when that happened, and P3 tells the agent to ask the user which to approve.
- The desktop packs (Linux, Windows, macOS) have a policy for Electron projects: Electron below 43 does not install on Node 26. Its extract-zip step stops part-way and exits 0, so the binary is missing. Use Electron 43+, or pin Node 24. Found by the Electron fixture on GitHub runners.

### Fixed
- `gw ci` gave a project at the repo root a garbage workflow name and folder when the project path and git's path were spelled differently: Windows 8.3 short names (`RUNNER~1`), or symlinks. It now asks git for the project's folder.
- On Windows with Node 26, `gw doctor` triggered a Node deprecation warning (DEP0190: args passed to a shell spawn), which also broke `gw doctor --json` when stderr was captured with stdout.
- `scan.ps1 -Out` wrote the profile with a UTF-8 BOM on Windows PowerShell 5.1, and the CLI couldn't parse it. It now writes UTF-8 without a BOM, and the CLI strips a BOM when it reads JSON.
- `scan.ps1 -Out` with a relative path now resolves against the current directory.

## 0.5.0 (2026-11-05)
Verification-first: a task is done when its check passes, not when the agent says so. Based on the workflow research (spec-driven, harness and verification patterns) and real headless agent runs before and after.

### Added
- **Tasks with checks** (`gw task add|start|done|block|reopen|list`):
  - `gw task done <id>` runs the task's `verify` command and records a receipt; only a pass marks it done;
  - one task in progress at a time;
  - a circuit breaker after 3 failed checks (`attempt_limit`): stop and talk to the user;
  - a diff-budget note over 400 changed lines (`diff_budget`).
- **Stop hook:** the turn doesn't end while a started task has no passing check, or a done task has no passing receipt. It blocks once per change, never loops, and is off with `profile minimal` or `gw set stop_hook=off`. Existing projects get it on upgrade.
- **Traceability** (`gw trace`):
  - GATE 1 fails on an in-scope REQ/SEC with no task;
  - GATE 2 fails on one that no test names (or waive it with a reason).
- **Doc budget** (`gw docs`, `gw set features=ui,api,db,auth,pii,payments,public`):
  - the documents the tier and features need, and GATE 1 checks exactly that list;
  - re-tiering is logged with `tier_reason`.
- **Requirement lint** (`gw lint`):
  - errors: duplicate IDs; delta requirements without SHALL/MUST or without a scenario;
  - warnings: no EARS or Given/When/Then criterion, over-long rows, scenarios without WHEN/THEN, removals without a reason.
- **Fresh-context review** (`gw review add|done`): required at standard and above, and GATE 2 fails on an open CRITICAL/HIGH finding.
- **Delivery metrics** (`gw metrics`, also in FEEDBACK.md):
  - first-pass rate, rework, failed checks and median task time;
  - reverts, circuit breakers and stop blocks.
- **Quality sensors** in P8:
  - Semgrep and jscpd in `tools.json`;
  - a `mutation` command per stack in the packs (Stryker, mutmut, gremlins, cargo-mutants, PIT, dotnet-stryker).
- MOCKUP: what to do when the Figma editor has no WebGL (hardware acceleration off, or a virtual display without the GPU).
- **Reuse proven open source** (`phases/REUSE.md`, `gw reuse <git-url>`): before writing a non-trivial part from scratch, look for a maintained project that does it. `gw reuse` makes a shallow, git-ignored clone in `.groundwork/reuse/<name>`, names its license and commit, and prints the credit row. Reused code is credited in `docs/credits.md` (`templates/credits.md`). GATE 2 fails on a row with no source or license, a license that doesn't allow reuse (none, SSPL, BUSL, …), or GPL/AGPL code in a project that isn't GPL, unless the row records the user's decision.

### Changed
- GROUNDWORK.md is 44% smaller (about 1,500 tokens, from 2,700). Skill vetting and recommendation details moved to `phases/P4.md`.
- **Lower token cost per run:**
  - `gw phase` and `gw set` print one line with the next step, not the full status, project.json and skill list. Skill suggestions show at session start and in `gw skills --for`, and never for the large tier only or, at the trivial tier, without a match in the task;
  - check output is saved to `.groundwork/runs/<id>/logs/output.txt`. The terminal shows its last 12 lines on a pass and 60 on a failure;
  - at the trivial tier `gw status` gives the whole P7 step (task, check, done), and P8 for a project with no targets, so neither phase file needs reading;
  - in a change to an existing project, `gw status` says P2–P4 need reading only if the change adds a target, stack or dependency;
  - GROUNDWORK.md shows the exact task commands, and says to type the CLI in full: runs that put it in a shell variable were blocked by permission checks and lost turns;
  - CHANGE and P6–P10 no longer repeat what the CLI prints when it matters (circuit breaker, diff budget, gate lists). P0's guide for existing projects moved to `phases/FIT.md`.
- GATE 1: one review packet and one approval (intent, mockup, plan), after a consistency pass that asks two-option questions. Mockup steps are feedback rounds.
- CHANGE: every change, even a trivial one, is a task with a check. Tests that already failed are reported as pre-existing.
- P1/PRD template: EARS acceptance criteria. At small tier the REQs go in the plan, with no separate PRD.
- Plan template: decisions, not code. P9 and MAINTAIN: a converge check (the user picks docs or code; tasks are appended).

### Fixed from the real agent runs (before/after benchmark)
- **Brownfield doc budget:** a change to an existing system needs its change folder (`proposal.md` + `delta.md`, or `bugfix.md`), plus the SRD or DBD only when triggered. Before this fix, one new endpoint asked for 8 new documents.
- **Traceability in brownfield:** `gw trace` and GATE 1 check only the REQ IDs the active change names. A PRD row marked `delivered` needs no new task. (A run had to attach already-built REQs to a new task to pass G1.)
- `gw task verify <id> "<cmd>"` changes a task's check and logs it as a decision. CHANGE tells the agent to scope the check to its change when the baseline is already red. (A run edited `tasks.json` with sed.)
- `gw task --help`, `gw review --help` and `gw --help` print usage and exit 0. (A run hit a CLI error.)
- `gw set targets=` rejects unknown targets and lists the known ones (an HTTP API is `backend`). (A v0.4.0 run logged this.)
- **Run receipts can't overstate isolation:** `gw run <target> S1 -- npm test` is refused, because S1 needs a container command (S2 an emulator or VM, S3 CI). A script that starts the environment itself passes with `--wrapper`. (A v0.4.0 run got an S1 receipt for a host test.)
- `gw run host S0 -- <cmd>` works for projects with no targets (libraries, scripts). Unknown targets list the known ones. (Every CLI error in the final runs was a target name.)
- A change to an existing project skips P1 and P5 in `gw status`, since the change folder replaces them. (A run was told to do P1 after finishing P7.)
- `gw set` prints no skill suggestions at the trivial tier. A first failed check hints at scoping it to the task's own tests when the baseline is red.
- The Stop hook's message defers to the user: if they asked to stop or skip checks, the agent says which task is unverified instead of carrying on.
- The fresh-context reviewer is skipped below standard tier unless the user asks.
- P6 and P8 follow `gw docs` for a change: no separate plan, test strategy or UAT. Those go in the proposal. (Runs wrote 7 documents for one additive endpoint, against 3 required.)
- CHANGE puts the baseline run before the task, so a red baseline shapes the check from the start. When a check passes, the agent is told to report what ran with its real counts and to name pre-existing failures. (One run took a silent `grep` as "tests pass".)
- The backend pack has a concrete S1 recipe for a service without dependencies (`docker run … <pinned runtime image> <test command>`).
- Every command answers `--help` with its usage line and exit 0 (a run hit `gw run --help`; a `--help` after `--` still goes to the command being run). `gw task add --help` prints usage. A duplicate task ID says how to change its check. `gw run host S0` works in any project as a plain host run, which never counts as a target's release run. (These three came from the last measured round; they change only error and help paths and were not re-measured.)
- **The framework's selftest moved to `groundwork/bin/selftest.js`.** In `groundwork/test/`, a project's bare `node --test` ran it as one of the project's tests, and it failed inside a container. Run it with `node groundwork/bin/selftest.js`. A selftest now checks that no framework file looks like a test to node --test, jest, vitest or mocha. (Seen in the trimmed f4 run.)
- **`delivered` in a change:** a requirement marked `delivered` needs a new task only when the change's `delta.md` or `bugfix.md` names it. A mention in `proposal.md` (e.g. "the REQ-001 tests still pass") no longer makes GATE 1 ask for one. (A run lost 6 turns reading the CLI to find this.)
- Rollback: a forced downgrade sets the state version, so the older CLI runs without "newer framework" warnings, and prints the command to come back.

### Upgrade notes
- Tasks already `done` are marked `legacy` and need no receipt. Reopened tasks need a new passing check.
- Rollback to 0.4.0: see UPGRADING.md.

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
- **Templates aligned with their original sources and latest versions.** Every template names its lineage, and `docs/TEMPLATE-SOURCES.md` lists origin, latest version and URL-level references:
  - PRD: ISO/IEC/IEEE 29148 requirement quality;
  - FSD: Spolsky's scenarios and non-goals;
  - AFD: Cockburn use cases (main success scenario, extensions, guarantees);
  - TRD: arc42 v9, 42010:2022, C4 runtime/deployment views, quality scenarios;
  - ADR: MADR 4.0 (drivers, confirmation);
  - BSD: OpenAPI 3.2, AsyncAPI 3, RFC 9457, deprecation policy;
  - DBD: W3C DTCG tokens 2025.10, WCAG 2.2 criteria;
  - mockup review: heuristic evaluation, severity 0–4, AI-persona limits;
  - SRD: Threat Modeling Manifesto, ASVS 5.0, SSDF, LINDDUN;
  - security exceptions: VEX statuses;
  - test strategy: 29119-3 risk-based, exit criteria;
  - runbook: alert playbooks;
  - incident: contributing factors (LFI/VOID);
  - change delta: the exact OpenSpec format;
  - plus intent (appetite, no-gos), plan, UAT, bugfix, lessons, tech debt, upgrade;
  - a new selftest checks table column consistency in every template.
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
