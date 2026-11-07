# Benchmark: Groundwork vs plain Claude Code

The same tasks run through Claude Code twice. One arm is a plain project. The other has Groundwork installed (`gw init`: a CLAUDE.md import of `GROUNDWORK.md` and four hooks). Hidden tests that the agent never sees grade each run. The results and the method behind the README's [benchmark section](../README.md#benchmark-groundwork-vs-plain-claude-code) are here, so anyone can check or repeat them.

## Cases

| Case | What it asks | What the hidden tests check |
|---|---|---|
| 01 Trivial bug fix | a discount is subtracted instead of taken as a percentage | the fix, edge values, the untouched helper |
| 02 Small feature | priorities for an existing todo module | ordering, the marker, errors, old behaviour |
| 03 New function | `parseDuration` from a written spec (a stub and one red test exist) | 13 inputs, valid and invalid |
| 04 Public API change | a CSV export described in a PRD | header, RFC 4180 quoting, JSON routes unchanged |
| 05 Python fix plus a flag | a wrong median and a new `--json` flag | both, unrounded numbers, errors unchanged |
| 06 File endpoint | `GET /files/:name` from an uploads folder; security isn't mentioned | content types and 404s, then path traversal and bad names |
| 07 Refactor | "make it readable, keep the behaviour"; the code has quirks | 300 generated orders, edge cases and a legacy quirk, compared with the original |
| 08 New CLI app | a bookmark manager from a one-page spec | 9 user-level checks: ids, tags, merge, errors, storage |
| 09 Question | "what does this file export? no changes" | the answer names both exports and no file changed |
| 10 Quick fix, "I'll test it" | the case-01 bug, but the user is in a hurry | the fix; the report also counts runs that ran tests anyway |

`node bench/run.js --check` proves each case before any agent runs. The visible tests pass at the start (case 03 starts red on purpose). The hidden tests fail before the work (07 and 09 pass, since there is nothing to change). Reference solutions for 05, 06 and 08 pass every hidden test.

## How a run works

1. The case's starting repo is copied into a fresh git repo in the system temp folder. That is outside this repository, so the agent can't find the hidden tests. Each row records whether a tool call ever touched them (`peeked`).
2. In the Groundwork arm, `groundwork/` is copied in and `gw init` runs before the agent starts. The host scan is cached once beforehand, as on a machine that already uses Groundwork.
3. `claude -p` runs with the case prompt and the same flags in both arms:
   - `--model`;
   - `--setting-sources project,local`: no user settings, plugins or user hooks;
   - `--strict-mcp-config`: no MCP servers;
   - `--disable-slash-commands`: no personal skills;
   - `--permission-mode acceptEdits` with the same tool allowlist;
   - a budget cap per case and a 45-minute limit.

   Claude variables from the calling shell are removed, so effort and other session settings are the defaults.
4. Task prompts end with the same note in both arms: nobody is around to answer, and any approval is "Approved, go ahead." Without it, Groundwork stops at GATE 1 and waits. The question and quick-fix cases don't get the note.
5. Each run is graded on:
   - the hidden tests;
   - the project's own tests;
   - `git diff` line counts, split into code, tests, test data (fixtures, golden files, snapshots), docs and framework files;
   - the transcript: cost, tokens, turns, tool calls, test runs and subagents.

## Run it

```sh
node bench/run.js --check                       # validate the cases (free)
node bench/run.js --reps 5 --jobs 5             # 10 cases × 2 arms × 5 runs on claude-sonnet-5-5
node bench/run.js --model claude-opus-5-5 --reps 2
node bench/report.js bench/results/<dir>        # tables, also written to <dir>/summary.md
```

Rows go to `bench/results/<date>-<model>/rows.jsonl`. A re-run skips rows already there, so an interrupted run resumes. Transcripts and diffs stay in `raw/`, which is git-ignored. `node bench/run.js --regrade --out <dir>` recomputes a folder's transcript fields and diff counts from `raw/`.

## Results

| Folder | Model | Runs | Spend at list price |
|---|---|---|---|
| [`results/2026-11-07-claude-sonnet-5-5`](results/2026-11-07-claude-sonnet-5-5/summary.md) | Claude Sonnet 5.5 | 100 (5 per case and setup) | $11.21 |
| [`results/2026-11-07-claude-opus-5-5`](results/2026-11-07-claude-opus-5-5/summary.md) | Claude Opus 5.5 | 40 (2 per case and setup) | $34.48 |
| [`results/2026-11-07-claude-haiku-5-5`](results/2026-11-07-claude-haiku-5-5/summary.md) | Claude Haiku 5.5 | 100 (5 per case and setup) | $2.16 |

All three ran Claude Code 2.1.319 and Groundwork 0.7.1. The README's [benchmark section](../README.md#benchmark-groundwork-vs-plain-claude-code) sums them up.

## Limits

- **Small, self-contained tasks**, minutes rather than days. Groundwork's larger features are not exercised: work across sessions, upgrades, releases, CI templates, and the scan of a new machine.
- **Headless with approval given up front.** Nobody answers questions, so clarifying questions and gate approvals are flattened. That is where Groundwork talks to the user most.
- **Few runs per cell.** With 5 runs per case and arm, a cost or time difference under about 20% can be noise; the spread table shows the range. Pass rates of 5/5 against 4/5 are not a significant difference on their own.
- **Cost is list price.** It is Claude Code's own `total_cost_usd` at API list prices. On a subscription, the same tokens count against your usage limits instead.
- **Behaviour, not style.** The hidden tests check what the code does. Code size, test lines and docs are reported, but nobody judged readability.
- **One framework version.** The runs used Groundwork 0.7.1 before the `IMPROVE` playbook was added. That adds one stage to P0 and one line to `GROUNDWORK.md`, and no case uses it.
