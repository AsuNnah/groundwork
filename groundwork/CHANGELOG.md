# Changelog

## 0.7.0 (2026-11-07)
The main session leads a team and knows what delegating costs. The installed skills that fit the work get named even when Claude's skill list hides them. Feedback from every project reaches the framework on its own. A real run on an existing desktop app fixed requirement tracing, gates and tasks for changes to existing projects. Every CI fragment now runs on real projects, macOS and iOS included. This release includes the unreleased 0.6.1 work.

### Added
- **`gw team`: the roles the lead hands work to, and their cost.** The main session is the project manager. It plans, hands work off by its shape, integrates one task at a time, runs the gates and talks to you.
  - The roles follow the tier, the features and the targets: code reviewer, security analyst, senior backend and frontend engineers, QA, platform and release, researcher, and a UX panel of the PRD's personas.
  - Each role says how it runs (a hat the lead wears, or a fresh subagent with read-only tools), its model and its brief.
  - At the large tier, `gw team` groups the tasks marked `parallel` into waves of at most 3 workers. Tasks in a wave share no files, and each one waits for the tasks it depends on.
  - It estimates the tokens against one agent doing everything, from published measurements (sources in `catalog/team.json`). Parallel builds cost about 1.6–4.3× and a fresh review +10–30%, and multi-agent runs often fail, so the lead delegates only where it pays.
  - `gw team log <role> <tokens>` records what a hand-off really cost, and FEEDBACK.md sums it per role.
- **Installed skills, found again (`gw skills index`).** Claude Code lists every installed skill, but in a long list the later ones lose their descriptions, so they can't trigger on their own.
  - The index covers every skill Claude Code loads: yours, the project's, the ones synced from claude.ai, and plugin skills (including custom paths in `plugin.json`). It files each skill into categories (`catalog/skill-categories.json`).
  - The task's words, the project's stage and features, and the phase bring categories into play. A deep search inside them then ranks the skills that fit, using the task's own words and what skills for this stage and phase talk about.
  - The hooks name up to 3 skills at session start, and on a message that fits. Each skill is named once per session, so the agent can invoke it by name. `gw skills --for "<task>"` lists them too.
  - The index lists skills installed twice, with their paths. Groundwork never deletes one, and `gw skills install` refuses a second copy of a skill that is already installed elsewhere (`--force` overrides).
  - Nothing is installed without you. Missing skills are still only recommended: fetched for review, inspected, then installed if you agree.
- **`gw feedback inbox <dir>`:** set it once per machine. Every project then also appends its feedback events to `<dir>/<project>-<id>.jsonl` (the id tells apart two projects with the same name): one line with the project's context first, and the framework version on each event. Notes for each version arrive without a manual hunt. `off` stops it.
- P6 tasks can carry `parallel` and `role`. P7 runs parallel workers, each in its own git worktree, only at the large tier. P9's reviewer is a fresh read-only subagent that gets a brief, reports real problems rather than style, and logs its cost.

### Fixed
From a real run on an existing desktop app (Groundwork 0.5.0):
- **Requirement IDs outside the PRD are traced:** a change's delta (`### Requirement: <name> (REQ-301, SEC-004)`: every ID in the heading's parentheses) and every requirements section of the SRD (SEC- IDs). Requirements under `## REMOVED` aren't expected to be built. `gw trace` says which open change it checks.
- **One GATE 1 per change.** `gates/G1.json` keeps one approval per change. A newer open change needs its own approval, approving it keeps the others', and the pre-edit hook says how to switch back (`gw set change=<id>`). Once every change is archived, the last approval stands, so `gw phase P10 done` works after archiving. Approving GATE 1 also marks P6 done and clears its re-check. On upgrade, a GATE 1 given on or after the day the active change opened stays that change's approval. An older one, and every GATE 2, are asked again.
- **Tasks:** `gw task add` keeps every `--req` (repeated, a comma list `--req REQ-001,SEC-002`, or `--req=REQ-001`) and refuses stray words and anything that isn't a requirement ID. `gw task req <id> <IDs>` changes a task's IDs until it is done.
- **Tasks recorded after the work:** `gw task start` says when uncommitted source code already exists, because it will count as the task's change. Docs, tests, CI files and setup files don't trigger it. A receipt says `dirty` when the tested tree isn't the commit it names. P7 says to start a task before writing its code.
- **Templates:** SRD threats get TH- IDs, and the security requirements get SEC- IDs in a table with an ASVS 5.0 column. The BSD and TRD fit apps without a server: IPC channels, CLI commands, sockets, local storage, helper processes, and network exposure.

Also fixed:
- The installed check (`gw skills`) misses no skill: skills synced from claude.ai and plugin skills on custom paths count as installed.
- A trending skill with the same name as another catalogue entry is listed once.
- The selftest no longer writes into the real `~/.groundwork` (its feedback inbox and caches).
- The selftest passes on a Mac with 8 GB of RAM or more. One test assumed such a host can't run the Android emulator (since 0.6.0).

CI fragments:
- **.NET MAUI on Linux:** a template project lists iOS and Mac Catalyst too, and restore needs every listed platform's workload (NETSDK1178). The fragment now builds the runner's platform alone (`-p:TargetFrameworks=…`).
- **.NET MAUI for iOS and Mac Catalyst:** .NET for Apple platforms accepts exactly one Xcode major.minor (`_RecommendedXcodeVersion`, which every release sets). The fragment selects that Xcode when the runner image has it. When it doesn't, it stops and says what to do: pin a workload set in `global.json` (`sdk.workloadVersion`) or use an image with that Xcode. Today the newest workload set (10.0.403) needs Xcode 27.1, which only GitHub's `xcode-27` preview image has. The sample project pins 10.0.401.
- **Kotlin Multiplatform iOS:** the app builds for a named simulator. The generic simulator destination also builds x86_64, which needs an `iosX64()` target that current wizard projects don't have (Compose resources failed with "provider has no value").
- **Flutter on iOS:** the integration test uses an iPhone on the newest runtime and waits until it has fully booted (`simctl bootstatus`). The first run timed out connecting to the Dart VM service.
- **Flutter on iOS, a hang:** `flutter test` can launch the app before it reads the simulator log, then wait forever for a line it missed ([flutter/flutter#181771](https://github.com/flutter/flutter/issues/181771); fixed upstream, not yet in stable 3.47.9). It hung a run on `main` until the 45-minute job limit. Each try now gets 15 minutes and only a hang runs again, once. A failing test still fails at once. The job limit is 60 minutes.
- **Unity:** the workflow stops with a clear error naming the secrets it needs (`UNITY_EMAIL`, `UNITY_PASSWORD`, and `UNITY_LICENSE` for Personal or `UNITY_SERIAL` for Pro) instead of failing inside GameCI, and it passes `UNITY_SERIAL` through.

### Changed
- **A requirement's status is a marker.** It counts when it starts a cell, sits in parentheses, or follows a full stop or dash: `(delivered)`, `(out of scope)`, `(deferred)`. A requirement whose text says "…after they are delivered" is no longer skipped. A row marked mid-sentence ("… already delivered") may now fail GATE 1 by name: mark it `(delivered)`.
- The installed-skill index follows symlinked skill folders, skips plugins that are disabled or installed for another project, and treats two same-named skills as one only when their descriptions say much the same.
- `gw team` waves keep a folder and the files in it apart, treat a glob as touching everything, and leave the files of the task in progress alone.
- `gw ci` names the runners a workflow uses that its fragment hasn't been verified on (`gw ci list`: "not yet on ubuntu-latest"; the generated file says to watch the first run there).
- React Native on Android: Maestro runs with its usage analytics turned off.
- Framework CI runs the selftest and the scanner + CLI smoke test on macOS too.

### Verified
All 29 fragments are now verified by the sample projects in `tests/ci-fixtures/` on GitHub runners, on every runner their packs use. New in this release:
- **iOS and macOS** (`macos-latest`: macOS 26 on Apple silicon):
  - a SwiftUI app's tests on the iOS Simulator and on macOS;
  - Flutter: the integration test on the iOS Simulator, and the macOS app build;
  - React Native (Expo): CocoaPods and the simulator build;
  - Kotlin Multiplatform: iOS simulator tests and the iosApp build, and the desktop package (DMG);
  - .NET MAUI for iOS and Mac Catalyst;
  - Tauri, Electron, and Node, Go, Rust and Python projects;
  - `scan.sh` and the CLI.
- **Android:** Flutter (the integration test on the emulator), React Native with Expo (Jest, release APK, a Maestro flow) and .NET MAUI.
- **Desktop and embedded:** Tauri 2 on Linux and Windows, .NET MAUI on Windows, and Zephyr (twister on `native_sim`).
- **Game:** Unity 6 with GameCI and a Personal licence: edit-mode and play-mode tests.

"macOS" here means GitHub's runner image, not a developer's own Mac.

## 0.6.0 (2026-11-06)
The roadmap items after 0.5.0: CI workflows per pack, devcontainers per stack, more packs and presets, and a scanner verified on Windows.

### Added
- **CI workflows** (`gw ci [list] | print <target> | write [target...] [--os …] [--force]`):
  - one GitHub Actions workflow per target, assembled from `templates/ci/` (a skeleton, one step fragment per stack, service blocks);
  - actions pinned to commit SHAs; the pack chooses the runners (Android emulator with KVM on Ubuntu, macOS for Apple targets, Windows), services (Postgres + Redis for backend) and stack variables;
  - `--os` or `gw set ci_os=linux,windows` narrows the runners; an OS the pack can't use is an error;
  - monorepos: when the project is a subfolder of the git repo, the workflow goes to the git root with `paths` filters and `working-directory`;
  - every fragment carries a `# verified:` line, so an untested template says so in the generated file. 19 of 29 are verified by the sample projects on GitHub runners: Android emulator, Kotlin Multiplatform (Android, web, desktop on Linux and Windows), Node, Python, Go, Rust, Java, .NET, Flutter web, Qt, GTK, Godot, ESP-IDF and PlatformIO. The macOS and iOS fragments, Unity, React Native, .NET MAUI, Tauri, Zephyr and Flutter on Android/iOS are not verified yet;
  - existing workflows are kept unless `--force`; `gw doctor` warns when a target's release tier runs on CI and its workflow is missing;
  - P8 uses it for S3.
- **Devcontainers** (`gw devcontainer [--print] [--force]`): `.devcontainer/devcontainer.json` merged from the blocks the project's stacks need (`packs/devcontainers.json`: image, features, ports, extensions, env, post-create commands), plus the notes and checks to run inside it. P3 uses it.
- **New packs:** `game` (Godot, Unity, Unreal) and `browser-extension` (Manifest V3, WXT, Plasmo).
- **New stacks:** Flutter and React Native for web; .NET MAUI for Android, iOS, macOS and Windows; Flutter for macOS, Windows and Linux desktop.
- **Cross-platform presets** (`gw set preset=kotlin-multiplatform|flutter|react-native|electron|tauri|dotnet-maui [targets=…]`, `packs/presets.json`): one stack on every target it covers.
- **A stack chosen by the targets:** when `gw set targets=…` names several UI targets with no stack yet, it lists the presets that cover all of them, for example `kotlin-multiplatform` and `flutter` for Android + iOS + web + desktop. P2 recommends one by the team's language. Either way each target keeps its own workflow and tests on its platform.
- **Kotlin Multiplatform** (`compose-multiplatform` stack for Android, iOS, web, Windows, macOS and Linux desktop):
  - Android uses the Android Gradle workflow (emulator included);
  - web runs the shared tests in headless Chrome (Wasm or JS) and builds the bundle;
  - desktop runs the JVM tests on each OS and packages with Compose Desktop;
  - iOS runs the simulator tests and builds the Xcode app;
  - the fragments read the project's Gradle task list, so both wizard layouts (`jvm()` or `jvm("desktop")`, Wasm or JS) work.
  A stack can now narrow its pack's CI runners (`ci_os`): KMP web runs on Linux only.
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
- `scan.ps1` on Windows 11 (checked on a Windows 11 26H2 VM as SYSTEM and as a non-elevated user):
  - the inbox `wsl.exe` stub counted as WSL, and asking it hung for about 60 s when WSL isn't installed and the machine is offline. Only the installed WSL (`Program Files\WSL`) is asked now;
  - the WindowsApps `python.exe` stub (exit 9009) counted as Python. A tool with no version and a failing exit is not reported now;
  - PowerShell 5.1 aliases (`curl`, `wget`) no longer count as tools.
- `gw init` / `gw doctor` crashed (`Cannot read properties of null`) when the scan output was not a readable profile. They now say so and show how to run the scanner by hand.
- The selftest assumed `node` and `git` on PATH, and failed on a fresh Windows machine with a portable Node. Task checks now use the Node running the selftest. Without git, the two tests that run git are skipped, and the summary says so. It also no longer leaves its temp projects behind (about 20 folders per run).

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
