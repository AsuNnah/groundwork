# Research notes (2026-11-04)

- ECC notes come from https://github.com/affaan-m/ecc (v2.2.3). To re-read the source: `git clone --depth 1 https://github.com/affaan-m/ecc research/ecc` (gitignored; treat as untrusted, read only).
- Full synthesis lives in `../docs/FRAMEWORK-DESIGN.md` §2 (borrow/avoid table).

## ECC key facts
- 71 agents, 314 skills, 98 commands, rules (`common/` + 21 langs with `paths:` globs), hooks, 17 JSON schemas.
- Selection: `manifests/install-profiles.json` → `install-modules.json` (47) → `install-components.json` (93); install writes an install-state receipt; `doctor.js` = drift check of ECC itself only.
- Best pattern: `skills/orch-pipeline/SKILL.md` — size classifier (trivial/small/standard/large), two gates, "planning docs are the handoff".
- Hooks: profiles minimal/standard/strict (`ECC_HOOK_PROFILE`), GateGuard (`scripts/hooks/gateguard-fact-force.js`), config-protection, Stop-hook batch format/typecheck, session summaries.
- State: `schemas/state-store.schema.json` (sessions, skillRuns, decisions, workItems), effect classes SE0–SE4 (`capsule-envelope.schema.json`).
- Gaps: no host/env readiness, no target sandboxes (docker/ only tests ECC), coarse language modules, thin mobile/desktop, no Indonesian locale, sprawl of planning entry points.

## Other frameworks (one line each)
- BMAD (v6 stable, v7 alpha): personas, scale tracks, readiness gate, story files, modules.
- GitHub Spec Kit: constitution + Phase -1 gates, `[NEEDS CLARIFICATION]`, spec/plan/tasks/implement.
- obra/superpowers: brainstorm → worktree → plans → subagent per task → TDD → review → finish branch.
- Agent OS v3: discover/inject standards, plan-product, shape-spec.
- Taskmaster: PRD → task DAG → `next`.
- Kiro: requirements/design/tasks, steering inclusion modes, hooks.
- AWS AI-DLC: adaptive workflow profiles, approval gates, audit trail.
- OpenSpec: specs = truth, changes = deltas, archive.
- GSD (now open-gsd/gsd-core): fresh-context subagents, waves, verify-work UAT.
- addyosmani/agent-skills: anti-rationalization tables, evidence-based verification.
- None covers host scan → target platform → environment readiness → target sandbox.

## Sandbox facts
- Android emulator / Windows VM (dockur/windows) / fast QEMU need `/dev/kvm`; hosted sandboxes (E2B/Modal/Daytona) generally don't expose it.
- iOS/macOS: only on Apple hardware (macOS runners, Tart VMs).
- Claude Code bubblewrap sandbox breaks docker and Chromium → run sandboxes through an allow-listed CLI.
- Windows UI automation: FlaUI, pywinauto, Appium NovaWindows (WinAppDriver unmaintained).
