# Groundwork

**A portable, host-adaptive development framework for AI coding agents.**
Copy one folder into any project. Groundwork scans the machine first, then plans, builds, and tests the software on a toolchain and sandbox that fit *that* machine, whether it's a laptop, PC, VM, container, Windows, Linux, macOS, WSL, x86 or ARM.

```text
scan host → intake & size → requirements → target & stack → environment ready
→ skills/plugins vetted → design → plan [GATE 1] → build → verify in sandbox
→ review → release [GATE 2] → learn
```

> Status: **alpha (v0.2.0)**. The Linux scanner, CLI, gates, hooks, and feedback loop are tested on Linux. The Windows scanner (`scan.ps1`) and the macOS path are untested. Feedback from real runs is how it improves (see [Learning from real runs](#learning-from-real-runs)).

---

## Why

Agent frameworks such as BMAD, Spec Kit, Superpowers, GSD, Kiro, OpenSpec, and ECC cover planning, TDD, review, and memory well. All of them assume the agent already sits on a machine that can build and test the app. None of them treat this chain as a first-class step:

**what machine is this → which target platform → is the environment ready → a test sandbox that mimics the target.**

Groundwork does. Some examples:
- "Docker is installed but you're not in the `docker` group."
- "VT-x is disabled in BIOS, so Android emulator tests run on CI until you enable it."
- "iOS can't be built on Linux, so the UI tests go to a macOS runner."

Each comes with the exact fix and a fallback.

## Quick start

```bash
# 1. copy the framework folder into your project root
cp -r groundwork/ /path/to/your-project/

# 2. one-time setup (state folder, CLAUDE.md import, /groundwork skill, 2 hooks, host scan)
cd /path/to/your-project
node groundwork/bin/gw.js init

# 3. open your agent (Claude Code, or anything that reads CLAUDE.md / AGENTS.md)
#    and describe what you want to build.
```

No Node yet? Run the scanner on its own first. It has no dependencies:
`sh groundwork/scan/scan.sh` (Linux/macOS/WSL) · `powershell -ExecutionPolicy Bypass -File groundwork\scan\scan.ps1` (Windows)

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
`groundwork/packs/*.json`: **web, backend, android, ios, macos, windows, linux-desktop, cli, embedded**.
Each pack declares stacks (with detection markers and scaffolds), required tools with minimum versions, sandbox recipes per tier, test tooling, and release steps. `packs/tools.json` maps each tool to install commands per package manager (mise, winget, brew, apt, dnf, pacman, official installers). To add a target, add a JSON file; the core code doesn't change.

## Learning from real runs

While it works, the agent **silently** logs framework-level friction with `gw note <category> "…"`, and the CLI logs automatic signals: errors, blocked edits, failed gates, checks and runs, skipped phases. The agent never asks the user for feedback.

1. Everything is compiled into the project's `.groundwork/FEEDBACK.md`, which is gitignored.
2. Copy it into this repo's [`feedback/inbox/`](feedback/README.md).
3. Ask an agent in this repo to "process feedback". [`CLAUDE.md`](CLAUDE.md) defines the triage into [`feedback/BACKLOG.md`](feedback/BACKLOG.md) and the release steps.

## CLI

```
gw init [--profile minimal|standard|strict] [--no-hooks]
gw doctor [--fresh] [--json]      gw plan-install        gw status | next
gw set tier=standard targets=web,android stacks.android=flutter
gw phase <H0..P11> <done|skipped|in_progress|blocked> ["note"]
gw run <target> <S0..S3> -- <cmd> gw gate <G1|G2> [--approve "user's words"]
gw note <category> "text"         gw feedback
```
`gw` = `node groundwork/bin/gw.js` (Node 18+, no dependencies).

## Repository layout

| Path | Contents |
|---|---|
| [`groundwork/`](groundwork/README.md) | **the framework**: copy this folder into projects |
| [`docs/FRAMEWORK-DESIGN.md`](docs/FRAMEWORK-DESIGN.md) | full design, rationale, roadmap |
| [`research/`](research/README.md) | notes on ECC, BMAD, Spec Kit, Superpowers, GSD, Kiro, AI-DLC, OpenSpec, sandboxing |
| [`feedback/`](feedback/README.md) | inbox and backlog for real-run feedback |

## Development

```bash
node groundwork/test/selftest.js   # decision rules against synthetic hosts
sh -n groundwork/scan/scan.sh      # scanner syntax
```
Rules: keep `groundwork/` dependency-free (POSIX sh, PowerShell 5.1+, Node stdlib) and in English. Platform knowledge goes in packs, not in core code.

## Roadmap
- [x] Host scan, capability rules, dev-method selection, target feasibility
- [x] Phases H0–P11, templates, gates, hooks, run receipts, silent feedback loop
- [ ] Verified Windows (`scan.ps1`) and macOS runs
- [ ] Ready-to-use CI workflow templates per pack (Android emulator, macOS, Windows runners)
- [ ] Devcontainer generation per stack
- [ ] More packs (game engines, browser extensions, cross-platform presets)

## Acknowledgements
Ideas borrowed (with thanks) from [ECC](https://github.com/affaan-m/ecc), [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD), [GitHub Spec Kit](https://github.com/github/spec-kit), [Superpowers](https://github.com/obra/superpowers), [GSD](https://github.com/open-gsd/gsd-core), [Kiro](https://kiro.dev), [OpenSpec](https://github.com/Fission-AI/OpenSpec), [AWS AI-DLC](https://github.com/awslabs/aidlc-workflows), and [agent-skills](https://github.com/addyosmani/agent-skills). See [`docs/FRAMEWORK-DESIGN.md`](docs/FRAMEWORK-DESIGN.md) §2 for what was taken from each.

## License
[MIT](LICENSE)
