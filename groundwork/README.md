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
gw set docs_dir=app/docs | docs.prd=<path> | dev_method=native-user-scope dev_method_reason="…" | references=<app>,<site>
gw phase <H0..P11> <done|skipped|in_progress|blocked> ["note"]
gw run <target> <S0|S1|S2|S3> -- <test command>     # writes a receipt
gw gate <G1|G2> [--approve "user's words"]
```
(`gw` = `node groundwork/bin/gw.js`)

## What's inside
| Path | What |
|---|---|
| `GROUNDWORK.md` | agent entry point: rules + phase map |
| `phases/` | one file per phase: H0 host scan → P0 intake … P10 release → P11 learn; playbooks CHANGE, UPGRADE, MAINTAIN, OPERATE, SECURITY |
| `scan/` | zero-dependency host scanners (`scan.sh`, `scan.ps1`) |
| `bin/gw.js` | CLI (Node 18+, no dependencies) |
| `packs/` | one JSON per target (web, backend, android, ios, macos, windows, linux-desktop, cli, embedded) + the `tools.json` install catalogue |
| `templates/` | planning: PRD, ADR, plan, test strategy, skill requirements · design: FSD, AFD (flows), TRD, BSD (API + DB), DBD (UI brief), SRD (security), platform notes · change: system overview, proposal, delta, bugfix · research: reference app · verify: UAT · after release: upgrade report, tech debt, security exceptions, incident, runbook, lessons |
| `catalog/skills.json` | pinned skill catalogue |
| `MANIFEST.json`, `CHANGELOG.md`, `VERSION` | release metadata used by `gw upgrade` / `gw verify` |
| `test/selftest.js` | `node groundwork/test/selftest.js` |

## Existing projects
Groundwork maps onto what is already there instead of duplicating it (details: `phases/P0.md`, "Fitting an existing project"):
- docs in another folder: `gw set docs_dir=<path>`, or per file `docs.prd=`, `docs.plan=`, `docs.test_strategy=`;
- a project rule against the host's dev method (e.g. no Docker): `gw set dev_method=native-user-scope dev_method_reason="…"`;
- several products in one folder: one `groundwork/` copy per product.

## Updating Groundwork in a project
Your project data is never in this folder. It lives in `.groundwork/` and `docs/`, so an update only replaces framework files.

**Recommended:**
`node groundwork/bin/gw.js upgrade /path/to/new/groundwork`
1. Backs up the current folder to `.groundwork/backups/` (gitignored).
2. **Replaces** the folder rather than merging: files the new version removed are deleted, so no stale instructions stay behind.
3. Warns about any files you edited locally. Each release ships a `MANIFEST.json` of file checksums to compare against.
4. Runs the new version's state migration and prints the changelog since your version.

Downgrades are refused unless you pass `--force`.

**Manual copy also works:** delete the old `groundwork/` and copy the new one in. If you copied over the old folder instead, run `gw verify --clean` to remove leftovers. Either way, the next `gw` command or session start migrates the state automatically. `gw version` shows the framework version and the project's state version.

**Don't edit files inside `groundwork/`.** Put project-specific changes where upgrades don't touch them:
- `.groundwork/packs/<id>.json`: adds a pack, or replaces a shipped pack with the same id;
- `.groundwork/tools.json`: adds or overrides tool install commands;
- `CLAUDE.md`: project rules.

If a change would help every project, it belongs in the framework instead: the agent logs it as feedback (`gw note improve …`).

## After release: maintenance playbooks
| Situation | Playbook | Helpers |
|---|---|---|
| Dependency / SDK / runtime updates, store deadlines | `phases/UPGRADE.md` | `gw maintain`, `gw eol` |
| Refactoring, tech debt (reactive) | `phases/MAINTAIN.md` | `templates/tech-debt.md` |
| Monitoring, incidents, hotfix, rollback | `phases/OPERATE.md` | `templates/incident.md`, `templates/runbook.md` |
| Vulnerabilities, advisories, leaked secrets | `phases/SECURITY.md` | osv-scanner, gitleaks, trivy, syft via `gw plan-install` |
| "Make it like X": how a reference app works | `phases/RESEARCH.md` | `templates/reference-research.md`; Scrapling and REA via `gw plan-install` |

## Skill catalogue
`gw skills` suggests agent skills for the current phase, stage, targets and stacks. They come from `catalog/skills.json`: 69 curated skills from [ECC](https://github.com/affaan-m/ecc), [Superpowers](https://github.com/obra/superpowers) and [agent-skills](https://github.com/addyosmani/agent-skills), all MIT-licensed and pinned to exact commits.
- `gw skills fetch <id>` downloads one for review only.
- `gw skills install <id>` installs it into `.claude/skills/` with its LICENSE and records it in `.groundwork/skills.lock.json`.

**Inspection before install (required):** every skill fetched from a GitHub repo is vetted with [`skill-inspector`](https://github.com/nvidia/skillspector/tree/main/skills/skill-inspector), NVIDIA SkillSpector's static scan plus semantic review.
1. `gw skills fetch <id>`.
2. Run `skill-inspector` on the folder and save the report to `docs/skill-reviews/<name>.md`.
3. `gw skills verdict <id> <APPROVE|CAUTION|REJECT> "<reason>" --report …`.
4. `gw skills install <id>`.

| Verdict | What happens |
|---|---|
| APPROVE | installs |
| CAUTION | needs your approval (`--accept-caution`) |
| **REJECT** | stops and shows why; you decide. To install anyway: `--override-reject "<your words>"`, recorded in the lock file |

If `skill-inspector` isn't on the machine, Groundwork suggests installing it first: `gw skills install skillspector/skill-inspector --global`, pinned to the official NVIDIA repo. The SkillSpector CLI is optional and listed by `gw plan-install`.

**Weekly trending discovery (silent):**
1. Once a week, at the first session start, a background job reads the [skills.sh](https://skills.sh) trending list.
2. It drops:
   - non-dev skills (media, marketing);
   - evasion tools;
   - **lookalikes of known sources**, such as the six fake `*/superpowers` repos found on 2026-11-04;
   - vendor skills for services you don't use (`services=` in `gw set`);
   - skills for stacks you don't use.
3. It keeps up to 10 that fit this project, pinned to a commit, in `.groundwork/skills-discovered.json`.

They show up in recommendations as ★ "trending #N, not reviewed". Install still requires review, and a repo without a licence needs `--force`.
- `gw skills refresh-day <mon..sun>`: align the refresh with your weekly usage reset.
- `gw skills trending off`: disable it.
- `gw skills refresh`: run it now.

## What to commit
Commit `groundwork/`, `.groundwork/` (project.json, state.json, tasks.json, gates/, decisions.jsonl, run receipts), and `docs/`. These are gitignored automatically: `host-profile.json` and `env-report.json` (they're machine-specific; every machine rescans), plus `feedback/`, `FEEDBACK.md`, `backups/` and `cache/` (personal or regenerable). Commit `skills.lock.json` and `skills-discovered.json` (or ignore the latter, since it regenerates weekly).

## Adding a target
Add `packs/<id>.json` (copy an existing pack) and any missing tools to `packs/tools.json`. The core code doesn't change.

## Feedback from real runs (silent)
While it works, the agent silently logs framework friction (`gw note …`): missing tools or steps, wrong checks, unclear instructions, too much ceremony, your corrections or overrides, and what worked. The CLI also logs automatic signals: errors, blocked edits, failed gates, checks and runs, skipped phases. You are never asked for feedback.
Everything is compiled into **`.groundwork/FEEDBACK.md`**, which updates as phases complete (or on demand with `gw feedback`). It's gitignored. When you're done, copy it to the framework repo's `feedback/inbox/` and say "process feedback" there.
