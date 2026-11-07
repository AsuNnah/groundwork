# Groundwork

**A portable, host-adaptive development framework for AI coding agents.**
Copy one folder into any project. Groundwork scans the machine first, then plans, builds, and tests the software on a toolchain and sandbox that fit *that* machine, whether it's a laptop, PC, VM, container, Windows, Linux, macOS, WSL, x86 or ARM.

```text
new app       scan host → intake & size → requirements → target & stack → environment ready
              → skills/plugins vetted → design → plan [GATE 1] → build → verify in sandbox
              → review → release [GATE 2] → learn
existing app  scan host → intake & size → baseline tests → change proposal → plan [GATE 1]
              → build → verify in sandbox → review → release [GATE 2] → learn
improve it    pick a slice → audit with evidence → gap register → you pick → fix → re-audit
```

An app that already exists skips the requirements and design documents: each change gets a short proposal and a requirement delta instead. To improve an app without a specific change in mind, ask for an audit (see [Existing apps](#6-existing-apps-and-after-release)).

> Status: **alpha (v0.7.1)**. Built and tested with **[Claude Code](https://claude.com/claude-code)** as the coding agent: real projects, and a [benchmark](#benchmark-groundwork-vs-plain-claude-code) on Claude Code 2.1.319 with Claude Sonnet 5.5, Opus 5.5 and Haiku 5.5. The scanner and CLI are tested on Linux, Windows and macOS, and the CI templates on GitHub runners (see [What it supports](#what-it-supports)). Feedback from real runs is how it improves (see [Learning from real runs](#learning-from-real-runs)).

---

## Why

Agent frameworks such as BMAD, Spec Kit, Superpowers, GSD, Kiro, OpenSpec, and ECC cover planning, TDD, review, and memory well. All of them assume the agent already sits on a machine that can build and test the app. None of them treat this chain as a first-class step:

**what machine is this → which target platform → is the environment ready → a test sandbox that mimics the target.**

Groundwork does. Some examples:
- "Docker is installed but you're not in the `docker` group."
- "VT-x is disabled in BIOS, so Android emulator tests run on CI until you enable it."
- "iOS can't be built on Linux, so the UI tests go to a macOS runner."

Each comes with the exact fix and a fallback.

## Easiest: paste this to your AI agent
Open your agent (Claude Code or similar) **in your project folder** and paste the block below. It downloads Groundwork, sets it up, and reports what this machine still needs.

```text
Set up the Groundwork framework in this project.
1. If a groundwork/ folder already exists here, stop and tell me: I need the update prompt instead.
2. Download the latest release of https://github.com/AsuNnah/groundwork into a temporary folder outside
   this project (git clone --depth 1 --branch <latest v* tag>; if git is missing, use the release zip).
3. Copy only its groundwork/ folder into this project's root. Then delete the temporary folder.
4. Run: node groundwork/bin/gw.js init
   If Node.js 18+ is missing, run the scanner instead (sh groundwork/scan/scan.sh, or on Windows
   powershell -ExecutionPolicy Bypass -File groundwork\scan\scan.ps1) and tell me how to install Node first.
5. Explain the environment report in plain words: what is ready, what is missing or misconfigured,
   the exact fix for each, and what it affects. Install nothing without asking me.
6. From now on follow groundwork/GROUNDWORK.md, and ask me what I want to build or change.
```
Updating later: paste the prompt in [UPGRADING.md](UPGRADING.md#easiest-paste-this-to-your-ai-agent).

## Quick start (by hand)

```bash
# 1. copy the framework folder into your project root
cp -r groundwork/ /path/to/your-project/

# 2. one-time setup (state folder, CLAUDE.md import, /groundwork skill, 3 hooks, host scan)
cd /path/to/your-project
node groundwork/bin/gw.js init

# 3. open your agent (Claude Code, or anything that reads CLAUDE.md / AGENTS.md)
#    and describe what you want to build or change. In an app that already
#    exists, "audit this app" starts the improve flow.
```

No Node yet? Run the scanner on its own first. It has no dependencies:
`sh groundwork/scan/scan.sh` (Linux/macOS/WSL) · `powershell -ExecutionPolicy Bypass -File groundwork\scan\scan.ps1` (Windows)

## What it supports

### Dev environments
- **Machines:** Linux, Windows 10 and 11 (natively or with WSL2) and macOS, on a laptop, PC, VM or container, x86-64 or ARM64. BSD is detected and treated like Linux, but it hasn't been tested.
- **Needs:** Node.js 18 or newer for the CLI. The scanner alone needs only `sh` or PowerShell 5.1.
- **Tested:** framework CI runs the selftest, a real host scan and a CLI smoke test on Linux, Windows and macOS (GitHub runners, Node 18 and the current LTS). The Windows scanner was also run on a Windows 11 VM.
- **Coding agents:** tested with **Claude Code** (2.1.319, running Claude Sonnet 5.5, Opus 5.5 and Haiku 5.5 in the [benchmark](#benchmark-groundwork-vs-plain-claude-code)). Claude Code gets everything: the `/groundwork` skill, the hooks and the GATE 1 edit guard. Other agents that read `AGENTS.md` get the rules without the hooks, but none of them has been tested.
- **Dev method:** the host scan picks one of eight (see [Host scan first](#1-host-scan-first-h0)). A project can override it with `gw set dev_method=…`.
- **Test sandboxes:** Docker or Podman for S1. For S2: KVM on Linux, Hyper-V on Windows, or Apple Virtualization on macOS. For S3: GitHub Actions through the `gh` CLI. When the machine lacks a tier, the tests go to CI. See [Sandbox tiers](#4-sandbox-tiers).

### App targets and stacks
Choose them with `gw set targets=web,backend stacks.web=vite-react stacks.backend=node`. *Release tier* is the sandbox tier where a target's tests must pass before GATE 2. *CI runners* are where the workflow from `gw ci write` runs.

| Target | Stacks | Release tier | CI runners |
|---|---|---|---|
| `web` | `vite-react`, `nextjs`, `vue`, `svelte`, `flutter`, `react-native`, `compose-multiplatform` | S1 | Linux, Windows, macOS (`compose-multiplatform`: Linux) |
| `backend` | `node`, `python`, `go`, `java-spring`, `dotnet` | S1 | Linux |
| `cli` | `go`, `rust`, `python`, `node` | S1 | Linux, Windows, macOS |
| `browser-extension` | `mv3`, `wxt`, `plasmo` | S1 | Linux |
| `linux-desktop` | `gtk`, `qt`, `electron`, `tauri`, `flutter`, `compose-multiplatform` | S1 | Linux |
| `game` | `godot`, `unity`, `unreal` | S1 | Linux (no template for `unreal`) |
| `android` | `kotlin-compose`, `flutter`, `react-native`, `dotnet-maui`, `compose-multiplatform` | S2 | Linux (emulator on KVM) |
| `ios` | `swiftui`, `flutter`, `react-native`, `dotnet-maui`, `compose-multiplatform` | S2 | macOS (iOS Simulator) |
| `windows` | `dotnet-wpf-winui`, `electron`, `tauri`, `flutter`, `dotnet-maui`, `compose-multiplatform` | S2 | Windows |
| `macos` | `swiftui`, `electron`, `tauri`, `flutter`, `dotnet-maui`, `compose-multiplatform` | S3 | macOS |
| `embedded` | `zephyr`, `esp-idf`, `platformio` | S3 | Linux |

- **`ios` and `macos` need a Mac** to develop. On other machines, Groundwork works on the shared code locally and runs their builds and tests on macOS CI runners.
- **Presets** set one stack on every target it covers (`gw set preset=…`):
  - `flutter` and `kotlin-multiplatform`: android, ios, web, windows, macos and linux-desktop;
  - `react-native`: android, ios and web;
  - `electron` and `tauri`: windows, macos and linux-desktop;
  - `dotnet-maui`: android, ios, windows and macos.
- **Verified:** every CI template has passed with the sample projects in [`tests/ci-fixtures/`](tests/ci-fixtures/), on every GitHub runner its workflow uses. `gw ci list` names any runner in a project's workflows that hasn't been verified yet.

## Benchmark: Groundwork vs plain Claude Code

The same 10 tasks ran in Claude Code with and without Groundwork: 240 runs on 2026-11-07, with Claude Code 2.1.319 and Groundwork 0.7.1. Claude Sonnet 5.5 and Haiku 5.5 ran each task 5 times in each setup, and Opus 5.5 ran each twice. Hidden tests that the agent never saw graded every run. The tasks are small and clearly specified: bug fixes, a feature and an API change in existing code, a new function and a new CLI app from a spec, a file endpoint, a refactor, a question, and a quick fix the user will test. The cases, the runner and every run's data are in [`bench/`](bench/README.md).

**In short:** plain Claude Code already passed every hidden test on these tasks, so Groundwork had no room to improve correctness. It cost 2.1–4.4 times as much and took 1.8–5 times as long. The extra went into process: the tests ran in every coding task, there was 1.5–3.4 times as much test code, each change was written down, and a separate agent reviewed the work. That is worth paying for on larger or riskier work, on work that spans sessions, and on machines that still need setting up. This benchmark doesn't measure those.

| All runs | Sonnet 5.5: plain | Groundwork | Opus 5.5: plain | Groundwork | Haiku 5.5: plain | Groundwork |
|---|---|---|---|---|---|---|
| Passed every hidden test | 50/50 | 50/50 | 20/20 | 20/20 | 50/50 | 50/50 |
| Cost at list price | $3.65 | $7.57 (+108%) | $6.57 | $27.92 (+325%) | $0.40 | $1.76 (+336%) |
| Time | 22.4 min | 39.9 min (+78%) | 35.9 min | 113.5 min (+216%) | 25.8 min | 129.2 min (+400%) |
| Tokens | 7.86M | 17.22M (+119%) | 4.45M | 23.08M (+419%) | 12.88M | 66.34M (+415%) |
| Coding runs that ran the tests | 32/40 | 40/40 | 16/16 | 16/16 | 35/40 | 40/40 |
| Test code written (lines) | 297 | 1,008 | 1,159 | 1,733 | 1,004 | 3,153 |
| App code written (lines) | 1,378 | 1,395 | 897 | 726 | 2,151 | 2,199 |
| Doc files written | 12 | 50 | 14 | 42 | 20 | 110 |
| Reviews by a separate agent | 0 | 7 | 0 | 17 | 0 | 25 |
| Permission prompts | 76 | 105 | 38 | 90 | 79 | 174 |

Coding runs are all tasks except the question and the quick fix the user tests. Recorded test data (golden files, snapshots) is not in the test lines.

| Median cost per run, plain → Groundwork | Sonnet 5.5 | Opus 5.5 | Haiku 5.5 |
|---|---|---|---|
| Trivial bug fix | $0.039 → $0.068 (+73%) | $0.115 → $0.289 (+152%) | $0.003 → $0.008 (+166%) |
| Small feature in existing code | $0.073 → $0.115 (+57%) | $0.169 → $0.890 (+426%) | $0.005 → $0.026 (+406%) |
| New function from a spec | $0.073 → $0.103 (+42%) | $0.144 → $0.424 (+194%) | $0.006 → $0.011 (+91%) |
| Public API change from a PRD | $0.057 → $0.392 (+593%) | $0.469 → $2.60 (+453%) | $0.007 → $0.047 (+615%) |
| Python: bug fix plus a new flag | $0.072 → $0.084 (+16%) | $0.297 → $0.792 (+167%) | $0.005 → $0.018 (+222%) |
| File endpoint (security implied, not asked) | $0.093 → $0.149 (+61%) | $0.406 → $3.46 (+754%) | $0.007 → $0.044 (+481%) |
| Refactor, behaviour unchanged | $0.144 → $0.223 (+55%) | $0.994 → $3.29 (+231%) | $0.026 → $0.079 (+200%) |
| New CLI app from a spec | $0.112 → $0.209 (+87%) | $0.587 → $1.96 (+235%) | $0.017 → $0.065 (+288%) |
| Question only, no changes | $0.021 → $0.033 (+63%) | $0.041 → $0.066 (+60%) | $0.001 → $0.002 (+50%) |
| Quick fix, user will test it | $0.029 → $0.045 (+52%) | $0.061 → $0.185 (+203%) | $0.002 → $0.003 (+43%) |

Each model's tables (tokens, turns, time, spread and the runs worth a look): [Sonnet 5.5](bench/results/2026-11-07-claude-sonnet-5-5/summary.md) · [Opus 5.5](bench/results/2026-11-07-claude-opus-5-5/summary.md) · [Haiku 5.5](bench/results/2026-11-07-claude-haiku-5-5/summary.md).

**What Groundwork gave you here**
- **The tests always ran.** With Groundwork the agent ran the tests in all 96 coding runs; without it, in 83 (86%). For the new CLI app, plain Sonnet and Haiku ran no tests in any of their 10 runs. With Groundwork, all 10 wrote and ran tests.
- **More test code, about the same app code.** 1.5–3.4 times the test lines. App code stayed within 20% (Opus wrote 19% less with Groundwork).
- **A record of each change.** Changes to existing code left a proposal and a requirement delta in `docs/changes/`. Plain runs left the code and their final message.
- **Reviews that found things the hidden tests don't check.** The reviews recorded 138 findings (7 HIGH) and marked 83 fixed. Two examples: a crash on a malformed request URL (Haiku), and a crash on a null JSON body that was there before the task (Opus).
- **Security risks written down.** For the CSV export, Groundwork's security review noted spreadsheet-formula injection in all 10 Sonnet and Haiku runs; no plain run of those models mentioned it. Opus noted it in both setups. No run escaped it in code, because that changes the exported data: it stayed a decision for the user.
- **Small requests stay small.** The question changed no files in any run and used about 3k more tokens, the always-loaded rules. When the user said they would test the fix themselves, neither setup ran tests with Sonnet or Haiku. Opus with Groundwork still did in 1 of 2 runs.

**What it cost**
- **Money and time:** 2.1–4.4 times the cost and 1.8–5 times the time. The process grows with the task: the API change described in a PRD cost 5.5–7.2 times as much, the trivial fix 1.7–2.7 times, and a question 1.5–1.6 times.
- **More permission prompts** (1.4–2.4 times): Groundwork runs more shell commands, such as tests and `gw` steps. In an interactive session, each command your allowlist doesn't cover asks you first.
- **No correctness gain on small, clear tasks:** both setups passed every hidden test.

**Choosing**
- For quick fixes, questions, and small, clear tasks on a tight budget, plain Claude Code is enough.
- For changes to an app people rely on, work across sessions, anything with auth, payments or personal data, or a new machine or target platform, Groundwork's tests, reviews, change records and environment checks are what you pay for.

**Limits:**
- The tasks are small and self-contained.
- The runs are headless with approval given up front, which flattens Groundwork's questions and gates.
- With 5 runs per cell (2 for Opus), differences under about 20% can be noise.
- Cost is Claude Code's own `total_cost_usd` at API list prices. On a subscription, the same tokens count against your usage limits instead.
- The hidden tests check behaviour, not readability.
- The runs used Groundwork 0.7.1 before the `IMPROVE` playbook was added, and no case uses it.

More in [`bench/README.md`](bench/README.md#limits).

## How it works

### 1. Host scan first (H0)
`scan.sh` / `scan.ps1` collect OS, machine kind, CPU and architecture, RAM, disk, GPU, virtualization (KVM, Hyper-V, Apple VZ, nested), container engine, GUI or headless, admin rights, and about 30 toolchains. They collect no hostnames, usernames, serials, or IPs. From the scan, `gw doctor` decides:

| Dev method | Chosen when |
|---|---|
| `devcontainer` | Linux with a usable container engine |
| `native-user-scope` | no containers and/or no admin: mise / uv / SDKs in the user's home |
| `wsl2-first` | Windows with WSL2 |
| `native-winget` | Windows admin without WSL2 |
| `native-macos` | macOS (required for iOS/macOS) |
| `light` | < 8 GB RAM, < 4 threads, or < 20 GB free |
| `in-place` | the agent is already inside a container |
| `manual` | the scan can't tell what the host is |

Problems are **notifications, not dead ends**. Each one has a status (`missing`, `misconfigured`, `unsupported`, or `unknown`), the exact fix, and its impact until fixed.

### 2. Size-tiered phases
`trivial / small / standard / large` decide which phases run. Ceremony scales with blast radius: auth, payments, personal data, public APIs, and migrations are always `standard` or higher. Each phase is one file in `groundwork/phases/`, loaded only when the agent reaches it.

### 3. Gates with receipts
- **GATE 1 (plan):** requires the PRD, plan, test strategy, and task list, no open `[NEEDS CLARIFICATION]` markers, a ready environment, and the user's own words of approval. Until then, a hook blocks source edits in standard and large projects.
- **GATE 2 (release):** requires a passing test-run receipt at each target's release tier.

### 4. Sandbox tiers
| Tier | Where | Typical use |
|---|---|---|
| S0 | host | unit tests |
| S1 | container | integration with a real DB, web E2E (Playwright), Linux GUI (Xvfb), CLI per distro |
| S2 | emulator / VM | Android emulator, Windows VM, iOS Simulator (on a Mac), QEMU boards |
| S3 | CI / remote / device | GitHub Actions OS matrix, macOS runners, device farms, real hardware |

`gw run <target> <tier> -- <cmd>` writes a receipt, and it refuses to claim a tier the host can't provide.

### 5. Platform packs (data, not code)
`groundwork/packs/*.json`: **web, backend, android, ios, macos, windows, linux-desktop, cli, embedded, game, browser-extension** (their stacks: [App targets and stacks](#app-targets-and-stacks)).
Each pack declares stacks (with detection markers and scaffolds), required tools with minimum versions, sandbox recipes per tier, test tooling, and release steps. `packs/tools.json` maps each tool to install commands per package manager (mise, winget, brew, apt, dnf, pacman, official installers). To add a target, add a JSON file; the core code doesn't change.

- **Cross-platform presets** (`packs/presets.json`): `gw set preset=kotlin-multiplatform` (or flutter, react-native, electron, tauri, dotnet-maui) sets one stack on every target it covers; `targets=` in the same command takes a subset. Choose several UI targets and `gw set` lists the presets that cover them all. Tests and CI still follow each target: Android on an emulator, iOS on a macOS simulator, web in a browser, desktop on each OS.
- **CI workflows** (`gw ci write [target…]`): a ready GitHub Actions workflow per target from `templates/ci/`, with actions pinned to commit SHAs, the pack's runners (Android emulator on KVM, macOS, Windows), services such as Postgres and Redis, and monorepo support (workflow at the git root, `paths` filters, `working-directory`). Each step fragment says whether it has been verified on real runners.
- **Devcontainers** (`gw devcontainer`): `.devcontainer/devcontainer.json` merged from the blocks your targets' stacks need (`packs/devcontainers.json`), with post-create commands and the checks to run inside it.

### 6. Existing apps and after release
Groundwork works on apps it didn't build: 7 of the 10 [benchmark](#benchmark-groundwork-vs-plain-claude-code) cases change existing code.

| Scenario | Playbook | What it gives you |
|---|---|---|
| Change an existing app: feature, bugfix, migration | `CHANGE` | the existing tests run first, and the ones that already fail are named, never counted as yours; a change folder (a proposal and a requirement delta, or a bug report whose first task is a failing test) instead of a new document set; one GATE 1 per change. `FIT` maps the project's own docs folder, ID scheme and process. |
| Improve an existing app ("what did we miss?") | `IMPROVE` | one slice at a time: a baseline with evidence (tests, CI, dead code, security scanners, history), then a gap register of four kinds (undocumented decisions, practice, missing pieces, technology) with severity and effort. You pick the rows, each fix is a normal change, and a re-audit shows the gaps closed. Adapted from ECC's `brownfield-retrospective`. |
| Dependency / SDK / runtime updates | `UPGRADE` | outdated → classify (patch/minor/major/0.x/SDK) → one major at a time → codemods → tests at release tier. `gw eol` checks runtime end of life live via endoflife.date. Pack `policies` track store deadlines (Play target API, Apple Xcode minimum). |
| Refactoring, tech debt (reactive) | `MAINTAIN` | debt registry with `(impact × frequency) / cost`, boy-scout rule, characterization tests before touching legacy code, strangler fig, dead-code tools per stack |
| Production | `OPERATE` | minimal observability per target, SEV1–4 incident flow (mitigate first), hotfix from the release tag, **rollback per target** (mobile: halt the staged rollout and roll forward, since there's no rollback), blameless postmortems |
| See it before it's built | `MOCKUP` | wireframe → visual mockup → clickable prototype for every screen and state, in **Figma** (official Figma MCP, when connected) or a no-account HTML prototype; your approval comes before GATE 1, and the build follows the mockup |
| Reference apps ("like X") | `RESEARCH` | how the reference works, from evidence: docs → source → using it → [Scrapling](https://github.com/D4Vinci/Scrapling) → [REA](https://github.com/morluto/rea) (apps, APKs, binaries); starts automatically on "learn X" / "app like X", asks for the goal if it is vague, recommends the depth the goal needs and steps up to the next method until the goal is met; lawful and authorised only, never copying proprietary code |
| Security | `SECURITY` | osv-scanner, gitleaks, stack audits; priority from KEV, EPSS, reachability and exposure (P0 = 72 h … P3 = next upgrade); reactive advisory flow; leaked-secret response |

`gw maintain` prints the exact outdated, upgrade, audit, dead-code, override, rollback and observability commands for your project's stacks.

### 7. Skill catalogue
Recommendations are **automatic and context-aware**. They appear at session start, when a phase advances, when the stack changes, and at the start of each task (`gw skills --for "<task>"`). Each one carries a "why now" reason: task keywords, phase, stage playbook, or stack. Declined skills aren't suggested again. `gw skills` recommends agent skills for the current phase and stack from a curated catalogue of **74 skills** from [ECC](https://github.com/affaan-m/ecc), [Superpowers](https://github.com/obra/superpowers), [agent-skills](https://github.com/addyosmani/agent-skills) and [Ponytail](https://github.com/DietrichGebert/ponytail), all MIT and pinned to exact commits.
- Fetch is review-only and flags executable files.
- Install copies the skill and its LICENSE into the project and records it in a lockfile.
- Groundwork doesn't vendor third-party skills; it points to them.

**Installed skills, found again.** Claude Code lists every installed skill, and in a long list the later ones lose their descriptions, so they can't trigger on their own. `gw skills index` indexes them all (your skills, the project's, those synced from claude.ai, plugins) into categories. The task's words, the project's stage and the phase bring categories into play, and a deep search inside them ranks the skills that fit. The hooks name up to three at session start and when a message fits, each once per session, so the agent can invoke them by name. The index also lists the skills installed twice; Groundwork never installs a second copy and never deletes one.

**Inspected before install.** Every skill from a GitHub repo must pass [`skill-inspector`](https://github.com/nvidia/skillspector) (NVIDIA SkillSpector) with a verdict recorded for its exact commit.
- APPROVE installs; CAUTION needs your approval.
- REJECT shows the reasons and lets you decide.
- If the inspector is missing, Groundwork suggests installing it first.

**Weekly trending discovery.** Once a week, silently, Groundwork reads the skills.sh trending list and keeps up to 10 skills that fit your project's targets, stacks, services and phases. It filters out non-dev skills, evasion tools, vendor skills you don't use, and **lookalikes impersonating known sources**. Picks appear in recommendations as ★ "trending, not reviewed".

### 8. Updating Groundwork itself
`gw upgrade <new-folder>`:
- backs up the old folder;
- **replaces** it rather than merging, so no stale instructions remain;
- warns about local edits using the shipped `MANIFEST.json` checksums;
- migrates the project state.

Project data in `.groundwork/` and `docs/` is never touched. Project-specific packs and tools go in `.groundwork/packs/` and `.groundwork/tools.json`, so upgrades never clobber them. Manual copies are detected and migrated automatically, and `gw verify --clean` removes leftovers. **Step-by-step guide: [UPGRADING.md](UPGRADING.md).**

## Learning from real runs

While it works, the agent **silently** logs framework-level friction with `gw note <category> "…"`, and the CLI logs automatic signals: errors, blocked edits, failed gates, checks and runs, skipped phases. The agent never asks the user for feedback.

1. Everything is compiled into the project's `.groundwork/FEEDBACK.md`, which is gitignored.
2. Copy it into this repo's [`feedback/inbox/`](feedback/README.md), e.g. `cp <project>/.groundwork/FEEDBACK.md feedback/inbox/$(date +%F)-<project>.md`. The raw events are in `<project>/.groundwork/feedback/events.jsonl`.
3. Ask an agent in this repo to "process feedback". [`CLAUDE.md`](CLAUDE.md) defines the triage into [`feedback/BACKLOG.md`](feedback/BACKLOG.md) and the release steps.

## CLI

```
gw init [--profile minimal|standard|strict] [--no-hooks]
gw doctor [--fresh] [--json]      gw plan-install        gw status | next
gw set tier=standard targets=web,android stacks.android=flutter
gw set docs_dir=<path> | dev_method=<method>
gw research "<reference app>" ["goal"]
gw phase <H0..P11> <done|skipped|in_progress|blocked> ["note"]
gw run <target> <S0..S3> -- <cmd> gw gate <G1|G2> [--approve "user's words"]
gw set preset=<kotlin-multiplatform|flutter|react-native|electron|tauri|dotnet-maui> [targets=a,b]
gw ci [list] | print <target> | write [target...] [--os linux,windows,macos] [--force]
gw devcontainer [--print] [--force]
gw note <category> "text"         gw feedback
gw maintain | eol | skills [--all|fetch <id>|install <id>]
gw version | verify [--clean] | upgrade <new-groundwork-folder>
```
`gw` = `node groundwork/bin/gw.js` (Node 18+, no dependencies).

## Repository layout

| Path | Contents |
|---|---|
| [`groundwork/`](groundwork/README.md) | **the framework**: copy this folder into projects |
| [`UPGRADING.md`](UPGRADING.md) | how to update Groundwork in your projects |
| [`docs/FRAMEWORK-DESIGN.md`](docs/FRAMEWORK-DESIGN.md) | full design, rationale, roadmap |
| [`research/`](research/README.md) | notes on ECC, BMAD, Spec Kit, Superpowers, GSD, Kiro, AI-DLC, OpenSpec, sandboxing |
| [`feedback/`](feedback/README.md) | inbox and backlog for real-run feedback |
| [`scripts/release.js`](scripts/release.js) | regenerates `groundwork/MANIFEST.json` and the fixture workflows before each release |
| [`tests/ci-fixtures/`](tests/ci-fixtures) | small sample projects, one per pack and stack, whose generated CI workflows prove the templates |
| [`bench/`](bench/README.md) | the benchmark against plain Claude Code: cases with hidden tests, the runner, the report and every run's data |

## Development

```bash
node groundwork/bin/selftest.js   # decision rules, catalogue, packs, manifest
node scripts/release.js            # after changing groundwork/: refresh MANIFEST.json (bump VERSION + CHANGELOG for releases)
sh -n groundwork/scan/scan.sh      # scanner syntax
node scripts/ci-smoke.js           # scanner + CLI smoke test on this OS (CI runs it on Linux, Windows and macOS)
node scripts/fixture-workflows.js  # regenerate the fixture workflows from templates/ci (--check: fail on drift)
node bench/run.js --check          # the benchmark cases are sound (free); bench/README.md has the real, paid runs
```
CI (`.github/workflows/`): `ci.yml` runs the selftest and smoke test on Ubuntu, Windows and macOS with Node 18 and the current LTS; `devcontainers.yml` builds every devcontainer block set and runs its checks; `gw-tests-ci-fixtures-*.yml` are the generated workflows for the sample projects in `tests/ci-fixtures/`, so every template runs on real runners.
Rules: keep `groundwork/` dependency-free (POSIX sh, PowerShell 5.1+, Node stdlib) and in English. Platform knowledge goes in packs, not in core code.

## Roadmap
- [x] Host scan, capability rules, dev-method selection, target feasibility
- [x] Phases H0–P11, templates, gates, hooks, run receipts, silent feedback loop
- [x] Post-release playbooks (upgrade, maintain, operate, security), skill catalogue, framework upgrade/verify
- [x] Verified Windows runs (`scan.ps1` and the CLI on Windows 11, and the CI on Windows runners) (0.6.0)
- [x] Ready-to-use CI workflow templates per pack: Android emulator, Windows and Linux runners, Kotlin Multiplatform (0.6.0)
- [x] Devcontainer generation per stack (0.6.0)
- [x] More packs and presets: game engines, browser extensions, cross-platform presets with a stack chosen by the targets (0.6.0)
- [x] Verified macOS runs on GitHub's macOS runners: `scan.sh`, the CLI, and the macOS and iOS CI fragments (0.7.0)
- [x] Verify the remaining CI fragments on real projects: React Native, .NET MAUI, Tauri, Zephyr, Flutter on Android (0.7.0)
- [x] Verify the Unity fragment (0.7.0)
- [x] A team the main session leads, with what delegating costs (`gw team`) (0.7.0)
- [x] Installed-skill index: categories, a search by task, stage and phase, duplicates (0.7.0)
- [x] Feedback from every project streamed to the framework's inbox (0.7.0)
- [ ] `scan.sh` on a developer's own Mac, beyond GitHub's runner image
- [x] Verify the last three CI runner combinations: `dotnet` for `backend` on Linux, and `flutter` for `windows` and `web` on the Windows runner (0.7.1)

## Acknowledgements
Skill inspection by [NVIDIA SkillSpector](https://github.com/nvidia/skillspector) (Apache-2.0). Ideas borrowed (with thanks) from [ECC](https://github.com/affaan-m/ecc), [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD), [GitHub Spec Kit](https://github.com/github/spec-kit), [Superpowers](https://github.com/obra/superpowers), [GSD](https://github.com/open-gsd/gsd-core), [Kiro](https://kiro.dev), [OpenSpec](https://github.com/Fission-AI/OpenSpec), [AWS AI-DLC](https://github.com/awslabs/aidlc-workflows), and [agent-skills](https://github.com/addyosmani/agent-skills). See [`docs/FRAMEWORK-DESIGN.md`](docs/FRAMEWORK-DESIGN.md) §2 for what was taken from each.

## License
[MIT](LICENSE)
