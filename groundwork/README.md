# Groundwork

A portable, host-adaptive development framework for AI coding agents (Claude Code first; works with any agent that reads `AGENTS.md`).

**Copy one folder into any project and it works.** It scans the machine first, then picks tools, a dev method, and test sandboxes that fit that machine: laptop, PC, VM, container, Windows, Linux, macOS, WSL, x86 or ARM.

## Use in a project
1. Copy this `groundwork/` folder into the project root.
2. Run once: `node groundwork/bin/gw.js init`
   - creates `.groundwork/` (project state);
   - adds `@groundwork/GROUNDWORK.md` to `CLAUDE.md` (and a pointer in `AGENTS.md` if one exists);
   - adds the `/groundwork` skill in `.claude/skills/`;
   - adds 2 hooks to `.claude/settings.json`: a session-start status and the GATE 1 edit guard. Use `--no-hooks` to skip them, or `--profile minimal` for no hooks or gate enforcement;
   - scans the machine and prints the environment report.
3. Start your agent and say what you want to build. It follows `GROUNDWORK.md`.

No Node yet? Run the scanner directly to see what to install first:
`sh groundwork/scan/scan.sh` (Linux/macOS/WSL) · `powershell -ExecutionPolicy Bypass -File groundwork\scan\scan.ps1` (Windows).

Without running `init`, you can still tell the agent "follow groundwork/GROUNDWORK.md". Init only adds the automatic parts.

## Commands
```
gw init | doctor [--fresh] | plan-install | status | next
gw set tier=standard targets=web,android stacks.android=flutter
gw phase <H0..P11> <done|skipped|in_progress|blocked> ["note"]
gw run <target> <S0|S1|S2|S3> -- <test command>     # writes a receipt
gw gate <G1|G2> [--approve "user's words"]
```
(`gw` = `node groundwork/bin/gw.js`)

## What's inside
| Path | What |
|---|---|
| `GROUNDWORK.md` | agent entry point: rules + phase map |
| `phases/` | one file per phase: H0 host scan → P0 intake … P10 release → P11 learn, plus CHANGE for brownfield work |
| `scan/` | zero-dependency host scanners (`scan.sh`, `scan.ps1`) |
| `bin/gw.js` | CLI (Node 18+, no dependencies) |
| `packs/` | one JSON per target (web, backend, android, ios, macos, windows, linux-desktop, cli, embedded) + the `tools.json` install catalogue |
| `templates/` | PRD, FSD, TRD, SRD, ADR, plan, test strategy, skill requirements |
| `test/selftest.js` | `node groundwork/test/selftest.js` |

## Updating
Replace the `groundwork/` folder with a newer copy. Project state is in `.groundwork/` and `docs/`, so nothing is lost.

## What to commit
Commit `groundwork/`, `.groundwork/` (project.json, state.json, tasks.json, gates/, decisions.jsonl, run receipts), and `docs/`. These are gitignored automatically: `host-profile.json` and `env-report.json` (they're machine-specific; every machine rescans), plus `feedback/` and `FEEDBACK.md` (personal).

## Adding a target
Add `packs/<id>.json` (copy an existing pack) and any missing tools to `packs/tools.json`. The core code doesn't change.

## Feedback from real runs (silent)
While it works, the agent silently logs framework friction (`gw note …`): missing tools or steps, wrong checks, unclear instructions, too much ceremony, your corrections or overrides, and what worked. The CLI also logs automatic signals: errors, blocked edits, failed gates, checks and runs, skipped phases. You are never asked for feedback.
Everything is compiled into **`.groundwork/FEEDBACK.md`**, which updates as phases complete (or on demand with `gw feedback`). It's gitignored. When you're done, copy it to the framework repo's `feedback/inbox/` and say "process feedback" there.
