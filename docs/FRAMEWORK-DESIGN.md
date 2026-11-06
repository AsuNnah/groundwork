# Vibe-Coding Framework — Design Blueprint

> Name: **Groundwork** (CLI `gw`). Implementation: `../groundwork/` (portable folder).
> Origin: a single "app development orchestrator" agent skill (preflight gate) → full framework.
> Date: 2026-11-04. Research basis: `research/ecc-notes.md`, `research/landscape-notes.md`.

---

## 0. One-paragraph summary

The current orchestrator is a strong **preflight gate** (requirements docs + vetted skill/plugin install),
but it is one prompt file: no persisted state, no target-platform knowledge, no environment checks,
no sandboxes, no enforcement. ECC, BMAD, Spec Kit, Superpowers, GSD, Kiro, AI-DLC etc. each solve parts
of the lifecycle — **none of them treats "target platform → toolchain → dev-environment readiness →
sandbox that mimics the target" as a first-class step.** That is the gap Groundwork fills.
Groundwork = a small **core** (lifecycle, gates, state, hooks) + **platform packs** (android, web, windows, …)
that each declare toolchain, readiness checks, scaffolds, sandbox recipe, and test tooling as data.

**Host-first.** The very first thing Groundwork runs — before any question about the app — is a **host scan**
(hardware + OS + virtualization + installed tools). The result, `host-profile.json`, decides *how* to develop
on that machine: which tools to install, native vs container vs WSL2 vs VM vs remote, which sandbox tiers
are available, and which targets can be built/tested locally. Groundwork adapts to whatever it runs on:
laptop, desktop PC, VM, cloud box, Windows, Linux, macOS, WSL, x86 or ARM.

---

## 1. What exists today (orchestrator assessment)

| Keep (strong) | Missing (framework gaps) |
|---|---|
| "No coding before preflight gate" rule | No persisted state — gate status lives in chat |
| Document chain: interview → PRD → FSD/AFD → TRD/BSD → DBD → SRD → plan | No target-platform / stack decision step |
| Inventory-before-install, skill vs plugin distinction | No dev-environment readiness (SDKs, Docker, KVM, licences) |
| Untrusted-candidate vetting (SkillSpector, manual review, block rules) | No sandbox / target-environment testing |
| Obsidian + Graphify knowledge navigation, with privacy scoping | No size tiers — small changes get same ceremony risk |
| Manifest template (`skill-requirements.md`) | No build/verify/review/release phases (stops at "SIAP BUILD") |
| (was Bahasa; now English) | No hooks → every rule is prompt-only (can be skipped) |

**Decision:** the orchestrator becomes Groundwork's phases P0–P5 almost verbatim. Everything after "SIAP BUILD"
and everything about platforms/environments/sandboxes is new.

---

## 2. What to borrow, what to avoid

| From | Borrow | Avoid |
|---|---|---|
| **ECC** | profile→module→component manifests + install-state receipt; hook profiles `minimal/standard/strict`; GateGuard "demand facts, not 'are you sure?'"; size classifier ("ceremony scales to blast radius"); file-staged handoffs ("each arrow is a file on disk"); `paths:`-glob language rules extending `common/`; Stop-hook batch format+typecheck; SQLite/JSON state with a `decisions` table; effect classes SE0–SE4 | 314 skills / 98 commands sprawl; 8 overlapping planning entry points; coarse modules (pick Kotlin → get every language); detection not driving install; no env or sandbox layer |
| **BMAD** | scale-adaptive tracks; stable requirement IDs in PRD; `project-context.md` (pinned stack versions); module packs per domain | heavy personas eating context; breaking rewrites |
| **Spec Kit** | constitution + "Phase -1 gates" with a *Complexity Tracking* justification; `[NEEDS CLARIFICATION]` markers; `research.md` option comparison; `quickstart.md` validation scenarios; `[P]` parallel tasks | library-first/CLI-first articles that misfit mobile/GUI |
| **Superpowers** | worktree per feature with clean test baseline; 2–5 min tasks with exact files + verification; fresh subagent per task; verification-before-completion | prompt-only enforcement |
| **GSD** | fresh-context subagents per phase, wave execution, atomic commit per plan, human UAT walkthrough (`verify-work`) | — |
| **Kiro** | steering inclusion modes (`always / fileMatch / manual / auto`); `bugfix.md` (current / expected / unchanged) | product lock-in |
| **OpenSpec** | `specs/` = current truth, `changes/<id>/` = deltas, archive merges | — |
| **AI-DLC** | workflow profiles chosen from the request; audit trail of gate approvals | 33-stage ceremony |
| **agent-skills (addyosmani)** | skill anatomy: when-to-use, process, **anti-rationalization table**, red flags, evidence-based verification | web-only verification |
| **Taskmaster** | PRD → dependency DAG → `next` unblocked task | LLM task graphs drifting |

---

## 3. Principles

1. **Files are the handoff.** Every phase reads files and writes files under `.groundwork/` + `docs/`. No hidden chat state. Any session (or another harness) can resume.
2. **Ceremony scales to blast radius.** A size tier (trivial / small / standard / large) picks which phases run. Security, auth, payments, public API, data migration ⇒ at least *standard*.
3. **Platform knowledge is data, not prose.** A platform pack is a manifest (`packs/<id>.json`) + scripts + templates. Core logic never hardcodes "android".
4. **Detect → decide → verify.** Detection proposes; the user (or gate) decides; a script verifies. Never claim "installed / passing / ready" without a receipt.
5. **Two human gates minimum** (Plan approved, Release approved) + automatic gates in between.
6. **Enforce with hooks where cheap, prompts where not.** Anything a script can check (env ready, tests run, gate file present) is a hook or a check script, not a sentence.
7. **Test where the user's app will run.** "Tests pass on my Linux box" ≠ done. Each target declares its sandbox tier; release gate requires the target-tier run (or an explicit, recorded waiver).
8. **Small core, opt-in packs.** Ship core + 2 packs first. Grow by demand.
9. **Untrusted by default.** Third-party skills, downloaded SDK scripts, emulator images, generated code — vetted or sandboxed.
10. **English everywhere** — prose, docs, reports, code, commits (decided 2026-11-04).
11. **Host-adaptive, never host-assuming.** No skill may assume an OS, shell, CPU arch, or installed tool. Everything that depends on the machine reads `host-profile.json`; anything unknown is scanned, not guessed. Re-scan when the machine changes (different laptop, new VM, tool installed).

---

## 4. Architecture (as built: `../groundwork/`)

```
groundwork/                 # copy this folder into any project root
├── GROUNDWORK.md           # agent entry: always-on rules + phase map (imported from CLAUDE.md)
├── README.md               # human: how to copy, init, commit, update
├── phases/                 # H0 P0 … P11 + playbooks (CHANGE, UPGRADE, MAINTAIN, OPERATE, SECURITY, RESEARCH, MOCKUP, REUSE, FIT): one file each, loaded only when reached
├── scan/scan.sh, scan.ps1  # zero-dependency host scanners → host-profile.json
├── bin/gw.js               # CLI: init doctor plan-install status set phase run gate hook
├── packs/<target>.json     # web backend android ios macos windows linux-desktop cli embedded
├── packs/tools.json        # install catalogue: per tool, the install command per package manager
├── templates/              # prd fsd trd srd adr plan test-strategy skill-requirements …
├── hooks/SKILL.md          # copied to .claude/skills/groundwork by init
└── bin/selftest.js         # decision rules vs synthetic hosts (outside test/, so project test runners skip it)
<project>/.groundwork/      # state (outside the framework folder)
  project.json state.json tasks.json host-profile.json env-report.json gates/ runs/ decisions.jsonl
```

**Dependency rule:** packs are data only. Core code never names a target; it reads `packs/*.json`.
Pack shape: `{id, title, host_only?, stacks{id:{detect, scaffold}}, tools[{id,min,severity}], stack_tools{stack:[…]},
sandbox{S0..S3:{needs|needs_any, how|run}}, min_release_tier, test_tooling, release}`.

## 4b. H0 — Host scan & adaptation (runs FIRST, before any project question)

### Why first
Every later decision depends on the machine: a 8 GB Windows laptop without admin rights and a 64 GB
Linux workstation with KVM need completely different install lists, dev methods, and test strategies.
Asking "what app do you want?" before knowing this leads to plans the machine cannot execute.

### Bootstrap problem → zero-dependency scanners
The scanner must run on a bare machine (no node/python guaranteed). So it ships as two native scripts
with identical JSON output:

| Host | Scanner | Notes |
|---|---|---|
| Linux, macOS, WSL, BSD | `core/scan/scan.sh` (POSIX sh) | uses `uname`, `/proc`, `sysctl`, `command -v` |
| Windows (native) | `core/scan/scan.ps1` (PowerShell 5.1+, built-in) | uses `Get-CimInstance`, `Get-ComputerInfo`, `Get-Command`, registry |

`gw` CLI (Node) comes *after* the scan; if Node is missing, the scan itself reports that and the install plan starts with it.

### What is scanned (`host-profile.json`)
| Group | Fields | How (Linux / macOS / Windows) |
|---|---|---|
| **os** | family (linux/macos/windows), distro + version, kernel, WSL yes/no + version, package managers (apt/dnf/pacman/zypper/apk/brew/winget/choco/scoop) | `/etc/os-release`, `uname`; `sw_vers`; `Win32_OperatingSystem` |
| **cpu** | arch (x86_64/arm64), model, cores/threads, virt extensions (vmx/svm, Apple VZ) | `/proc/cpuinfo`; `sysctl machdep.cpu`; `Win32_Processor.VirtualizationFirmwareEnabled` |
| **memory / disk** | RAM total/free, free disk on work dir, SSD vs HDD | `/proc/meminfo`, `df`; `sysctl hw.memsize`; `Win32_LogicalDisk` |
| **gpu** | vendor, model, VRAM, CUDA/Metal/DirectX availability | `lspci`/`nvidia-smi`; `system_profiler`; `Win32_VideoController` |
| **machine kind** | laptop / desktop / VM / container / cloud; hypervisor name; battery present | `systemd-detect-virt`, DMI chassis type, `/.dockerenv`; `sysctl kern.hv_vmm_present`; `Win32_ComputerSystem.Model`, `Win32_Battery` |
| **virtualization** | `/dev/kvm` usable, nested virt, Hyper-V/WSL2/VirtualBox/VMware, Apple Virtualization.framework | `/dev/kvm` + group; `sysctl kern.hv_support`; `Get-WindowsOptionalFeature` |
| **containers** | docker/podman installed + daemon reachable + rootless, compose, buildx, Docker Desktop vs engine | `docker info` |
| **display** | GUI session present (X11/Wayland/Quartz/Win), headless | `$DISPLAY`/`$WAYLAND_DISPLAY`; always GUI on mac/win desktop |
| **user rights** | admin/sudo available (non-interactive check only), home writable, corporate proxy | `sudo -n true`; `id -u`; `[Security.Principal.WindowsPrincipal]` |
| **network** | internet reachable, proxy env, registry reachable (npm/pypi/maven/docker hub) | lightweight HEAD requests, opt-out `--offline` |
| **toolchains** | versions of git, gh, node, npm/pnpm/bun, python/uv, java, kotlin, gradle, android sdk/adb/emulator, flutter/dart, dotnet, go, rust, xcode/xcrun, swift, gcc/clang/msvc, cmake, wine, qemu, playwright, appium, maestro, version managers (mise/asdf/nvm/sdkman/pyenv) | `command -v` + `--version` |
| **agent harness** | Claude Code version, sandbox mode on/off, installed skills/plugins | `claude --version`, `~/.claude/` |

Privacy: no hostnames, usernames, serials, MACs, IPs or file contents in the profile. Stored at
`~/.groundwork/host-profile.json` (machine-level, shared across projects) + copy of the *capabilities* only in `.groundwork/` of a project.

### From scan → capabilities → decisions
The raw scan is reduced to **capability flags** by rules in `core/scan/capabilities.yaml` (data, not code):

```yaml
- id: can_run_containers
  when: "containers.docker.daemon_ok or containers.podman.ok"
- id: can_run_kvm_vms            # android emulator, windows VM, qemu boards (fast)
  when: "virtualization.kvm_usable"            # linux
- id: can_run_hyperv_vms
  when: "os.family == 'windows' and virtualization.hyperv_enabled"
- id: can_run_apple_vms          # tart / macOS VMs
  when: "os.family == 'macos' and cpu.arch == 'arm64'"
- id: can_build_ios
  when: "os.family == 'macos' and toolchains.xcode"
- id: can_run_gui_tests
  when: "display.gui or toolchains.xvfb or os.family in ['macos','windows']"
- id: can_run_android_emulator_local
  when: "(can_run_kvm_vms or can_run_hyperv_vms or os.family=='macos') and memory.total_gb >= 8 and disk.free_gb >= 20"
- id: low_resources
  when: "memory.total_gb < 8 or cpu.threads < 4 or disk.free_gb < 20"
- id: on_battery_laptop
  when: "machine.kind == 'laptop'"
- id: can_install_system_packages
  when: "user.admin"
```

Then a **method selector** picks *how* to develop on this host (first match wins, user may override):

| Host situation | Dev method | Toolchain install style |
|---|---|---|
| Windows, WSL2 available | **WSL2-first** for web/backend/cli/android-build; native Windows for .NET/WinUI and Windows UI tests | `winget` for Windows side, distro pkg + `mise` inside WSL |
| Windows, no WSL2, no admin | **native, user-scope** (`scoop`, portable SDKs) or **remote** (Codespaces/dev VM) | user-scope only, never system |
| Linux workstation with Docker | **devcontainer** for every target that has an image; host for GUI dev | `mise`/`asdf` pinned per project, Docker images |
| Linux without Docker / no admin | **native user-scope** (`mise`, `uv`, SDKs in `~/.local`) | no sudo |
| macOS (Apple Silicon) | **native** (needed for iOS/macOS), containers for backend deps | `brew` + `mise`; Xcode via App Store |
| VM / cloud box, no GUI, no KVM | **headless**: container S1 locally, S2/S3 targets to CI/device farm | containers + `mise` |
| Container (agent already inside one) | **in-place**, no nested docker unless socket mounted; everything else S3 | none beyond project-local |
| low_resources laptop | **light mode**: no local emulators/VMs, remote builds for heavy targets, `--parallel=1` | minimal set |

And a **target feasibility table** is computed for P2 (shown to the user while choosing what to build):

| Target | Develop locally? | Test locally up to tier | Else |
|---|---|---|---|
| web/backend/cli | yes if runtime installable | S1 if containers, else S0 | — |
| android | yes (JDK+SDK, any OS) | S2 if `can_run_android_emulator_local`, else S1 (unit/Robolectric) | S3 CI emulator / Firebase Test Lab / USB device (`adb`) |
| ios / macos | only if `can_build_ios` | S2 (simulator) on mac | S3 macOS runner; on non-mac: shared logic only |
| windows desktop | yes on windows; cross-compile elsewhere | S2 native on windows; KVM VM on linux | S3 windows runner |
| linux desktop | yes on linux/WSLg; container elsewhere | S1 Xvfb | S3 ubuntu runner |
| embedded | yes if toolchain | S2 QEMU/Renode | HIL with real board |

Output to user (Bahasa): "Mesin ini: laptop Windows 11, 16 GB RAM, WSL2 aktif, tanpa Docker. Saran metode: WSL2 + mise.
Bisa dibangun & dites lokal: web, backend, android (emulator via Hyper-V). Perlu CI: iOS. Perlu dipasang: Git, Node 22 (WSL), Docker Desktop (opsional)."

### Install plan (generated, never auto-run)
`gw plan-install --targets android,web` merges: host profile × chosen targets × pack `toolchain:` → ordered list of
`{tool, version, method (winget/brew/apt/mise/sdkmanager/docker pull), scope (user/project/system), needs_admin, size_mb, why}`.
User approves the list (or parts). Each install is verified by re-running that scan probe; result appended to `.groundwork/env-report.json`.

### When to re-scan
On first run on a machine, when `host-profile.json` is older than 7 days, when a check fails unexpectedly,
after any install, or on `gw scan`. SessionStart hook compares a cheap fingerprint (os+arch+RAM+tool versions hash) and re-scans if it changed — this is how a project moved from a PC to a laptop adapts automatically.

---

## 5. Lifecycle — phases, artifacts, gates

Size tier picks phases (✓ = runs, · = skipped, ○ = light version). **H0 host scan always runs first (cached).**

| Phase | Trivial | Small | Standard | Large |
|---|---|---|---|---|
| H0 Host scan (§4b) | cached | ✓ | ✓ | ✓ |
| P0 Intake & sizing | ✓ | ✓ | ✓ | ✓ |
| P1 Discover (interview, PRD) | · | ○ | ✓ | ✓ |
| P2 Target & stack | · | ○ (detect) | ✓ | ✓ |
| P3 Environment readiness | ○ (cached) | ✓ | ✓ | ✓ |
| P4 Capability preflight (skills/plugins) | · | ○ | ✓ | ✓ |
| P5 Design docs | · | · | ○ (TRD+SRD) | ✓ (all needed) |
| P6 Plan + **GATE 1** | · | ○ | ✓ | ✓ |
| P7 Build (TDD loop) | ✓ | ✓ | ✓ | ✓ |
| P8 Verify in sandbox | ○ (S1) | ✓ (S1) | ✓ (target tier) | ✓ (target tier + matrix) |
| P9 Review + security | ○ | ✓ | ✓ | ✓ (+ security-audit) |
| P10 Release + **GATE 2** | · | ○ | ✓ | ✓ |
| P11 Learn | · | · | ○ | ✓ |

### P0 — Intake & sizing
- Input: user request + repo. Output: `.groundwork/project.yaml` (created or updated), `.groundwork/state.json`.
- Classify **project stage**: idea / greenfield / feature / bugfix / migration / maintenance.
- Classify **size tier** by blast radius: files likely touched, public API, data, auth, money, deploy targets.
- Detect existing stack (`scripts/detect.*`: `package.json`, `build.gradle(.kts)`, `pubspec.yaml`, `*.csproj`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `Podfile`, `*.xcodeproj`, `app.json` (Expo), `tauri.conf.json`, `CMakeLists.txt`, `platformio.ini`, `west.yml`, …).
- Read repo instructions (`CLAUDE.md`, `AGENTS.md`, README, `docs/`).

### P1 — Discover — from orchestrator
- `interview-me` (one question at a time) / `idea-refine` if vague → `docs/prd.md`.
- PRD gets **stable IDs**: `REQ-001`, `JRN-001`, `NFR-001`; non-goals; MVP boundary; success metrics.
- Unknowns marked `[NEEDS CLARIFICATION: …]` — gate 1 cannot pass while any remain in-scope.

### P2 — Target & stack — NEW
Decision questions (ask only what is not yet known):
1. **Who uses it and on what?** phone / desktop / browser / server / device / terminal.
2. **Targets** (multi-select): web, android, ios, windows, macos, linux-desktop, backend-api, cli, embedded, game.
3. **Distribution**: Play Store, App Store, MS Store/winget/MSI, Flathub/AppImage/deb, web hosting, Docker image, npm/PyPI/crates, OTA firmware.
4. **Offline / realtime / background / push / hardware access** (camera, BLE, GPS, USB, serial).
5. **Team skill & existing code** (keep the stack the user already knows).
6. **Constraints**: budget, licence, data residency, compliance, a11y, performance.

Stack recommender — rules in pack manifests, not in the skill text. Example defaults:

| Need | Default recommendation | Why |
|---|---|---|
| web app only | Next.js/Vite+React + Postgres | biggest ecosystem, easy hosting |
| android only, native feel | Kotlin + Jetpack Compose | first-party |
| android + ios, one codebase | Flutter **or** React Native/Expo | Expo if team knows JS |
| desktop all OS, small binary | Tauri (Rust + web UI) | 10× smaller than Electron |
| desktop all OS, max ecosystem | Electron | mature, Playwright-testable |
| windows-only business app | .NET 8+ WPF/WinUI 3 | first-party |
| api/backend | FastAPI / Node (Hono/Nest) / Go | by team skill |
| embedded | Zephyr or ESP-IDF / Arduino | by board |

Output: `.groundwork/project.yaml` `targets:` + `stack:` + `docs/adr/0001-stack.md` (options compared, decision, consequences).

### P3 — Environment readiness — NEW (biggest gap in every framework)
- Starts from `host-profile.json` (H0) — does not re-detect what H0 already knows; adds project-specific checks only.
- Runs `gw doctor`: common checks + each selected pack's `checks:` (see §7).
- Each check returns JSON: `{id, status: pass|fail|warn|skip, found, required, fix, autofix_allowed}`.
- Output: `.groundwork/env-report.json` + human summary (Bahasa).
- **Fix policy**: show exact fix command; run it only with user approval; never `sudo`, never global installs silently; prefer project-scoped (devcontainer, `mise`/`asdf`, `sdkmanager` into project dir, `uv`, `corepack`).
- Decide **sandbox tier per target** from host capabilities (see §8): e.g. no `/dev/kvm` ⇒ android tests go to S3 (CI/device farm) — recorded, not hidden.
- Pin versions → `.groundwork/toolchain.lock` (`node 22.x, jdk 21, android-sdk 35, gradle 8.x`) and generate `.devcontainer/devcontainer.json` when the pack supports it.

### P4 — Capability preflight — existing orchestrator steps 3–6
- Unchanged logic: inventory → minimum needed → vet (SkillSpector/manual) → install project-scoped → verify.
- New: the selected **packs** are themselves the first candidates (they're first-party); skill-plugin matrix moves to `core/templates/skill-plugin-matrix.md` + each pack lists `recommended_skills:` / `recommended_mcp:` (e.g. web → playwright MCP; android → appium/maestro MCP).
- Output: `docs/app-development/skill-requirements.md` (existing template) + `.groundwork/state.json.capabilities`.

### P5 — Design docs
Only those the tier + targets need:

| Doc | When |
|---|---|
| FSD (features + acceptance criteria, `REQ-` linked) | standard+ |
| AFD (user/system flows, Mermaid or `diagram-design`) | flows with branches |
| TRD (architecture, modules, data, integrations) | standard+ |
| BSD (API contracts → `contracts/openapi.yaml`, DB schema) | has backend/DB |
| DBD (design brief: screens, states, design tokens) | has UI |
| SRD (threats, authn/z, data classes, store-policy requirements) | always for standard+ |
| Platform notes (`docs/platform/<target>.md`: permissions, min OS, store rules, signing) | per target |

### P6 — Plan → **GATE 1**
- `docs/plan.md` + `.groundwork/tasks.json` (DAG): each task = `{id, title, req_ids, files, depends_on, parallel, test_first, verify_cmd, sandbox_tier, size}`; 15–60 min each.
- `docs/test-strategy.md`: pyramid per target (unit / integration / UI-E2E / device), which runs at which sandbox tier, coverage bar (use `constraint-driven-development` → `CONSTRAINTS.md`).
- **Phase -1 gates** (Spec Kit style, adjusted): Simplicity, No speculative abstraction, Integration-first tests, Target-reality (each target has a verify path), Security-reviewed. A failing gate needs a written justification in `docs/plan.md#complexity-tracking`.
- **GATE 1 receipt** (`.groundwork/gates/G1-plan.json`): checklist results + user approval quote + timestamp. Build hooks refuse feature edits without it (standard+).

### P7 — Build
- Git branch/worktree per feature; check test baseline green before starting.
- Loop per task from `gw next`: write failing test → implement → run `verify_cmd` → commit (atomic, conventional) → mark done in `tasks.json`.
- Fresh subagent per task for large tiers (context hygiene); inline for small.
- Pack build-resolver agents on build failure (gradle, xcode, msbuild, cargo, flutter).
- Change of scope ⇒ back to the affected phase only (re-run P2/P3 if a target or dependency changed).

### P8 — Verify in sandbox — NEW
- `gw sandbox up <target>` → `gw sandbox test <target>` → artifacts in `.groundwork/runs/<run-id>/` (logs, junit, screenshots, video, coverage).
- Per tier: S1 container tests every task; S2 emulator/VM per milestone; S3 CI/device-farm before release.
- Human UAT walkthrough (GSD `verify-work` style): scripted checklist from FSD acceptance criteria, in plain Bahasa, with screenshots for non-technical users.

### P9 — Review
- `code-review-and-quality` + pack reviewer agent + `security-audit` when auth/input/DB/FS/network/crypto/secrets touched.
- CRITICAL/HIGH must be fixed or waived in writing.

### P10 — Release → **GATE 2**
- Pack release recipe: versioning, changelog, signing (keystore / Apple certs / Authenticode / notarisation — secrets never in repo), packaging (AAB/APK, IPA, MSIX/MSI, AppImage/Flatpak/deb, Docker image, npm…), store checklists (privacy labels, permissions rationale, screenshots).
- GATE 2 receipt requires: all target-tier runs green (or waived), review clean, SRD items checked, user approval.

### P11 — Learn
- Retro → `docs/lessons.md`; repeated lessons proposed as rules/skill amendments (user approves; ECC instincts idea, but manual promotion).

---

## 6. Platform pack contract (original YAML sketch; implemented as JSON in `groundwork/packs/`)

```yaml
id: android
version: 0.1.0
title: Android apps
targets: [android]
stacks:
  kotlin-compose:
    detect: ["build.gradle.kts contains com.android.application", "**/AndroidManifest.xml"]
    scaffold: { command: "templates/kotlin-compose" }      # or official generator
    languages: [kotlin]
  flutter:
    detect: ["pubspec.yaml contains flutter:"]
    scaffold: { command: "flutter create --org {org} {name}" }
    requires_packs: []
toolchain:                              # pinned into .groundwork/toolchain.lock
  jdk: { min: "17", recommend: "21" }
  android-sdk: { platform: "35", build-tools: "35.0.0" }
  gradle: { via: wrapper }
checks:                                 # scripts in checks/, each prints check-result JSON
  - { id: jdk,            script: checks/jdk.sh,            severity: block }
  - { id: android-sdk,    script: checks/android-sdk.sh,    severity: block }
  - { id: kvm,            script: core:checks/kvm.sh,       severity: warn, affects: [sandbox.S2] }
  - { id: disk-20g,       script: core:checks/disk.sh 20,   severity: warn }
sandbox:
  S1: { kind: container, image: "ghcr.io/cirruslabs/android-sdk:35", run: "./gradlew test lint" }
  S2: { kind: emulator,  compose: sandbox/emulator.compose.yaml, needs: [kvm], run: "maestro test .maestro/" }
  S3: { kind: ci,        workflow: sandbox/ci-android.yml, alt: "Firebase Test Lab" }
test_tooling: [junit, robolectric, espresso, maestro, appium]
recommended_skills: []
recommended_mcp: [appium-mcp?]          # vetted in P4
release:
  artifacts: [aab, apk]
  signing: { secret: ANDROID_KEYSTORE, never_commit: true }
  checklist: templates/play-store-checklist.md
rules: [rules/kotlin.md, rules/gradle.md]
```

Schema lives in `core/schemas/pack.schema.json`; `gw pack validate` checks every pack in CI.

---

## 7. Environment readiness — check catalogue

**Common (core):** OS/arch, CPU/RAM/disk, git + identity, docker (daemon reachable, compose v2, buildx), `/dev/kvm`, network + proxy, `gh` auth (for CI tier), Claude Code version, sandbox mode, node/python presence for the `gw` CLI, secrets manager / `.env.example` vs `.env` keys present (names only, never values).

**Per target (in packs):**

| Target | Blocking checks | Warn checks |
|---|---|---|
| web | node (version from `.nvmrc`/`engines`), package manager (corepack) | playwright browsers installed, lighthouse |
| backend | runtime (python/uv, node, go, jdk, dotnet), docker for DB services | db client, migration tool |
| android | jdk 17+, android-sdk + platform-tools + build-tools, licences accepted | kvm, emulator system image, ≥20 GB disk |
| ios | macOS host **or** configured remote macOS runner, Xcode CLT, cocoapods/SPM | Apple dev account, signing identities |
| windows | dotnet SDK / msvc or cross toolchain (mingw, cargo-xwin) | Windows runner configured, kvm for dockur VM, licence acknowledged |
| linux-desktop | toolchain (gtk/qt dev libs, rust/node), xvfb | flatpak-builder, appimagetool |
| macos | same as ios | notarisation credentials |
| cli | language toolchain | cross targets (`rustup target`, `GOOS`), buildx/qemu for arm64 |
| embedded | vendor toolchain (arm-none-eabi-gcc / ESP-IDF / west), qemu or renode | serial access, board connected |

**Example (real first-run on a Linux workstation):** Docker installed but the user is not in the `docker` group ⇒ reported as *misconfigured* with the `usermod` fix, S1 unavailable until fixed.
VT-x disabled in BIOS ⇒ no KVM ⇒ android/windows emulator tests fall back to S3 (CI). sudo needs a password ⇒ install plan offers user-scope (mise) alternatives.
iOS/macOS ⇒ always S3 (macOS runner) on a non-Mac host.

---

## 8. Sandbox tiers

| Tier | What | Isolation | Use for | Needs |
|---|---|---|---|---|
| **S0** host | run on dev machine | none | quick unit tests only | — |
| **S1** container | devcontainer / Docker compose with real deps, `--network` restricted | container | unit, integration, API, web E2E (Playwright image), Linux GUI (Xvfb/noVNC), CLI per distro, cross-arch via buildx/qemu | Docker |
| **S2** emulator/VM | Android emulator (`budtmo/docker-android` or SDK emulator headless), Windows VM (`dockur/windows`, own licence), QEMU/Renode boards | VM | device-like UI tests (Maestro/Appium/Espresso), Windows UI (FlaUI/pywinauto/Appium NovaWindows) | **/dev/kvm** (Linux) |
| **S3** remote | GitHub Actions matrix (ubuntu/windows/macos runners), Tart macOS VMs, Firebase Test Lab / device farms, real hardware-in-the-loop | remote | authoritative per-OS runs, iOS/macOS everything, signing, store builds | runner credentials (`gh`), accounts |

Rules:
- Every target declares a **minimum release tier**: web S1, backend S1, cli S1(+S3 for win/mac), linux-desktop S1, android S2 or S3, windows S2 or S3, ios/macos S3, embedded S2 + HIL.
- The agent's own shell may be inside Claude Code's bubblewrap sandbox, which **breaks docker and Chromium** ⇒ sandbox commands run via the `gw` CLI as an allow-listed command, not ad-hoc.
- Untrusted/generated code runs in S1 with `--network=none` (or allowlist) and `cap_drop: ALL` by default.
- Runs write `.groundwork/runs/<id>/receipt.json` `{target, tier, image/digest, commit, cmd, exit, junit, artifacts, started, ended}` — gates read receipts, not claims.

---

## 9. State, artifacts, enforcement

### Repo layout created by Groundwork in a user project
```
.groundwork/
  project.yaml        # name, stage, tier, targets, stacks, packs, language (id/en)
  state.json          # current phase, phase statuses, open blockers, capabilities
  toolchain.lock      # pinned versions
  env-report.json     # last doctor result
  tasks.json          # task DAG + status
  gates/G1-plan.json, G2-release.json   # receipts with approval quote
  runs/<id>/…         # sandbox receipts + artifacts (gitignored except receipt)
  decisions.jsonl     # append-only decision log (ADR index)
docs/
  prd.md fsd.md afd.md trd.md bsd.md dbd.md srd.md plan.md test-strategy.md
  adr/NNNN-*.md platform/<target>.md lessons.md
  app-development/skill-requirements.md
  changes/<id>/{proposal,delta,tasks}.md     # brownfield deltas
.devcontainer/ (generated)   CONSTRAINTS.md   CLAUDE.md (groundwork import)
```

### Hooks (core, profile `minimal | standard | strict`)
| Event | Hook | Profile |
|---|---|---|
| SessionStart | inject `gw status` (phase, next step, blockers) — ≤ 1–2k chars | all |
| PreToolUse Edit/Write | block source edits when tier ≥ standard and no `G1` receipt (docs/tests/.groundwork allowed) | standard+ |
| PreToolUse Edit/Write | protect lint/test config & `CONSTRAINTS.md` from being weakened | standard+ |
| PreToolUse Bash | block `--no-verify`, `git push --force` to main, destructive rm outside repo | all |
| PostToolUse Edit | mark tasks touched; remind to run `verify_cmd` | strict |
| Stop | batch format + typecheck per pack (`packs/<id>.json: stop_checks`), not only JS | standard+ |
| Stop | if code changed and no test run since → warn | standard+ |
| PreCompact | save `state.json` summary for resume | all |

### Front door
User says anything → `gw` skill reads `.groundwork/state.json`, runs P0 if missing, otherwise says (in Bahasa):
"Fase sekarang: P3 Environment. Blocker: JDK belum ada. Langkah berikutnya: …". One entry point, not 8.

---

## 10. Distribution: copy one folder (decided 2026-11-04)

- The framework is **one self-contained folder `groundwork/`**. Copy it into any project root. Nothing to publish, no marketplace, no global install.
- `node groundwork/bin/gw.js init` (optional, one time) wires it in:
  - creates `.groundwork/` state;
  - adds `@groundwork/GROUNDWORK.md` to CLAUDE.md, plus a pointer in AGENTS.md;
  - adds the `/groundwork` skill in `.claude/skills/`;
  - merges 4 hooks (session start, edit guard, Stop check for unverified tasks, reference-app prompt) into `.claude/settings.json`.
- Without init, it still works: tell the agent "follow groundwork/GROUNDWORK.md".
- State is kept outside the framework folder (`.groundwork/`, `docs/`), so upgrading = replacing the folder.
- Zero dependencies: scanners are POSIX sh + PowerShell; the CLI is plain Node 18+.
- Packs are JSON files inside `groundwork/packs/`; add one to support a new target.
- A marketplace plugin wrapper can be added later without changing the folder.
---

## 11. Migration from the current orchestrator

| Current section | Goes to |
|---|---|
| Tujuan, Prinsip kerja | `core/rules/common/workflow.md` + `gw` front door |
| Step 1 Pahami aplikasi | `phases/` (P0) |
| Step 2 Rencana dokumen | `phases/` (P1) + `phases/` (P5) + `phases/` (P6) |
| Steps 3–6 Inventaris/vetting/install | `phases/` (P4), unchanged |
| Step 7 Gerbang SIAP BUILD | GATE 1 receipt `G1-plan.json` (+ hook enforcement) |
| Step 8 Development | `phases/` (P7) |
| Obsidian + Graphify | `phases/` optional skill, triggered for large tier |
| `preflight-manifest-template.md` | `core/templates/` (kept; gains Target, Env, Sandbox sections) |
| `skill-plugin-matrix.md` | `core/templates/` + per-pack `recommended_*` |

Keep the old skill working (thin wrapper calling `gw`) until the core is stable.

---

## 12. Roadmap (build the smallest thing that proves the idea)

| Milestone | Scope | Done when |
|---|---|---|
| **M0a** host scan | `scan.sh` + `scan.ps1` → `host-profile.json`, `capabilities.yaml`, method selector, target feasibility table | correct profile on: this Linux server, a Windows laptop, a macOS machine, a WSL distro, a VM |
| **M0b** skeleton | marketplace + `groundwork core` plugin, schemas (host-profile, project, state, check-result, gate, pack), `gw status/doctor/gate/plan-install` CLI, front-door skill, orchestrator content migrated to P0/P1/P4/P5/P6 | `gw doctor` on this host prints correct report; G1 receipt written |
| **M1** web + backend packs | S1 sandboxes (Playwright image, compose + Postgres), build/verify/review skills, Stop-hook checks | sample todo app goes P0 → P10 with receipts |
| **M2** hooks | G1 edit guard, config protection, SessionStart status, profiles | hooks tested with fixtures |
| **M3** android pack | S1 (gradle in container) + S3 (GH Actions emulator / Firebase Test Lab); S2 only on a KVM host | sample Compose app verified in CI |
| **M4** desktop packs | linux-desktop (Xvfb), windows (cross-compile + GH windows runner; dockur on KVM host), Electron/Tauri | sample Tauri app tested on 3 OS runners |
| **M5** ios/macos pack | macOS runner/Tart via S3, signing guidance | sample app builds + UI test on macOS runner |
| **M6** cli, embedded, crossplatform, game | as demand appears | — |
| **M7** learn loop + multi-harness | lessons → rule proposals; Codex/Cursor adapters | — |

---

## 13. Decisions (2026-11-04)

1. Name: **Groundwork** (CLI `gw`). Alternatives considered: Pathfinder, Kiln, Chameleon.
2. CLI language: **Node** (no dependencies); scanners in sh/PowerShell so they run before Node exists.
3. Language: **English** for everything.
4. KVM: rely on **S3 (CI/device farm)** by default. When virtualization is *capable but not configured* (VT-x off in BIOS, kvm module not loaded, user not in the `kvm` group, no nested virt in a VM or WSL, Hyper-V off), report it exactly like a missing program: found → fix → impact, with the CI fallback. Same treatment for Docker without socket permission and for outdated tools.
5. Distribution: **portable copy-in folder** (see §10).
6. Repo: public GitHub repository; the shippable unit is `groundwork/`.

## 14. Learning from real runs (added 2026-11-04)

- **Agent side:** an always-on rule in `GROUNDWORK.md` has the agent log framework-level friction silently with `gw note <missing|wrong|unclear|friction|user-signal|workaround|improve|worked> "…"`. It infers from behaviour and never asks the user for feedback.
- **CLI side:** deterministic signals go to `.groundwork/feedback/events.jsonl`: CLI errors, GATE 1 edit blocks, failed gate checks, non-ok environment checks (first time seen), failed runs, skipped or blocked phases, re-scans, and unknown targets.
- **Report:** `.groundwork/FEEDBACK.md` is rebuilt on every phase change and note. It's gitignored (personal).
- **Loop:** copy it to this repo's `feedback/inbox/`, then say "process feedback". Following the repo's `CLAUDE.md`, that clusters the reports into `feedback/BACKLOG.md` (with evidence and run counts), proposes changes to `groundwork/`, bumps `VERSION`, and archives the reports to `processed/`.

## 15. Post-release lifecycle, skill catalogue, framework upgrades (v0.3.0, 2026-11-04)

- **Playbooks** (not linear phases; chosen by the P0 stage): `UPGRADE`, `MAINTAIN` (reactive), `OPERATE`, `SECURITY`.
  - Stage-specific commands and rollback recipes are pack data (`maintain`, `rollback`, `observe`, `policies`).
  - Volatile facts are fetched live or carry a re-check source: runtime end of life from endoflife.date, store deadlines with an `as_of` date and the URL to check.
  - `incident` and `security` stages skip GATE 1 (mitigate first).
- **Skill catalogue** (`groundwork/catalog/skills.json`): skills are referenced, not vendored.
  - Each entry is pinned to a commit and tagged with phases, targets and stacks.
  - Fetch uses git sparse checkout into `.groundwork/cache/` for review.
  - Install copies the skill plus the source LICENSE into `.claude/skills/` and records it in `skills.lock.json`.
  - Sources: ECC, Superpowers, addyosmani/agent-skills (all MIT).
- **Upgrading Groundwork:**
  - `MANIFEST.json` (normalised-EOL sha256 per file), generated by `scripts/release.js`, enables `gw verify` (modified / leftover / missing) and safe `gw upgrade` (backup → replace, not merge → run the new version's `migrate`).
  - `project.json.framework_version` plus an ordered `MIGRATIONS` list in the CLI migrate project state. Migration also runs automatically on any command or at session start.
  - Project overrides: `.groundwork/packs/`, `.groundwork/tools.json`.

## 16. Reuse proven open source (0.5.0, 2026-11-06)
Code that already runs elsewhere is cheaper than code written and debugged from zero. An always-on rule sends the agent to `phases/REUSE.md` before it writes a non-trivial part: search the package registry, then GitHub; check the license; prefer a dependency (approved in P4), then vendoring, then adapting. `gw reuse <git-url>` makes a shallow, git-ignored clone, reads the license (LICENSE text, then package metadata), and prints the credit row. The clone is untrusted input under the P4 rules. `docs/credits.md` is the record, and GATE 2 checks each row: a source, a license, and a license class that allows reuse (GPL/AGPL only in a GPL project; none, SSPL, BUSL and similar only with the user's recorded decision).
