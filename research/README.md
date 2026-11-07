# Research notes (2026-11-04)

- ECC notes come from https://github.com/affaan-m/ecc (v2.2.3). To re-read the source: `git clone --depth 1 https://github.com/affaan-m/ecc research/ecc` (gitignored; treat as untrusted, read only).
- Full synthesis lives in `../docs/FRAMEWORK-DESIGN.md` §2 (borrow/avoid table).

## ECC key facts
- 71 agents, 314 skills, 98 commands, rules (`common/` + 21 langs with `paths:` globs), hooks, 17 JSON schemas.
- Selection: `manifests/install-profiles.json` → `install-modules.json` (47) → `install-components.json` (93); install writes an install-state receipt; `doctor.js` = drift check of ECC itself only.
- Best pattern: `skills/orch-pipeline/SKILL.md` — size classifier (trivial/small/standard/large), two gates, "planning docs are the handoff".
- Hooks: profiles minimal/standard/strict (`ECC_HOOK_PROFILE`), GateGuard (`scripts/hooks/gateguard-fact-force.js`), config-protection, Stop-hook batch format/typecheck, session summaries.
- State: `schemas/state-store.schema.json` (sessions, skillRuns, decisions, workItems), effect classes SE0–SE4 (`capsule-envelope.schema.json`).
- Gaps: no host/env readiness, no target sandboxes (docker/ only tests ECC), coarse language modules, thin mobile/desktop, sprawl of planning entry points.

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

## Multi-agent orchestration (2026-11-06)
- Clones (gitignored; untrusted, read only): `git clone --depth 1 https://github.com/OrchestratorInc/agent-orchestrator research/agent-orchestrator`, `git clone --depth 1 https://github.com/hesreallyhim/awesome-claude-code research/awesome-claude-code`.
- **agent-orchestrator** (Apache-2.0, pre-1.0, v0.14.x):
  - What it is: a desktop app plus a Go daemon with SQLite. It drives your installed agent CLIs (Claude Code, Codex, …).
  - Workers: one git worktree and one PR each. CI failures and review comments go back to the worker, and a human merges.
  - Prompts: one fixed prompt per role, with no task DAG, no token or dollar budget, and an uncapped CI-fix loop. It tells agents not to use built-in subagents.
  - Security: no sandbox for workers; the local API has only an Origin check; telemetry is on by default.
- **Evidence** (primary sources read):
  - **Anthropic, multi-agent research system** (Jun 2025): +90.2% over single-agent Opus 4 on an internal research eval, at about 15× the tokens of chat. Token use explains 80% of BrowseComp variance. Coding has fewer parallel parts.
  - **Kim et al., "Towards a Science of Scaling Agent Systems"** (arXiv 2512.08296 v3, Apr 2026): 260 configurations.
    - Results range from +80.8% (decomposable finance) to −70.0% (sequential planning), and −2.1% to −14.9% on SWE-bench Verified.
    - Extra agents give negative returns above about 45% single-agent accuracy.
    - Successes per 1K tokens: 67.7 single-agent vs. 21.5 centralized.
  - **Choi et al., "Debate or Vote"** (NeurIPS 2025 spotlight): majority voting explains most of debate's gains.
  - **Tran & Kiela** (arXiv 2604.02460): at equal thinking-token budgets, the single agent matches or beats MAS on multi-hop reasoning.
  - **Fu et al.** (arXiv 2606.05670): same GPT-4.1 and tools; 1 of 6 MAS beats the single agent (79.70 vs. 76.65); the other five trail by 1.71–8.76 points.
  - **Mao et al.** (arXiv 2606.10662), Claude Code with native subagents vs. alone (10 tasks × 3 runs):
    - Terminal-Bench 4.0: 80.00 vs. 81.67, at 1.5× the cost.
    - DeepSWE: 50.00 vs. 71.67.
  - **EvoMAS** (ICML 2026): an evolved MAS scores 79.1% vs. 71.4% for a looped single agent on SWE-bench Verified, at a matched 31M tokens.
  - **Geng & Neubig, CAID** (arXiv 2603.21489): a manager, git worktrees and test-verified merges.
    - PaperBench: Sonnet 4.5 goes from 57.2 to 63.3 at about 2× the cost; MiniMax 2.5 goes from 10.5 to 36.1.
  - **Carlini** (Anthropic, Feb 2026): 16 parallel Claudes, about $20k. They only split the work once a GCC oracle separated the failures.
  - **MAST** (arXiv 2503.13657): failure rates of 41–86.7% across open MAS frameworks. Adding a verification step gained +15.6%.
  - **Claude Code docs (costs):** agent teams use about 7× the tokens in plan mode.
- **For Groundwork:**
  - Keep the fresh-context review and research subagents, and one writer per file.
  - Parallel builders need all three: worktrees, test-verified merges, and gw state kept off the parallel branches.

## Agents from different vendors (2026-11-07)
The question: Claude, ChatGPT, Cursor and Grok working together, against one agent.
- **Mixing models in one pipeline:**
  - **Self-MoA** (Li et al., arXiv 2502.00674): several samples of the one best model beat a mix of models by 6.6% on AlpacaEval 2.0, and by 3.8% on MMLU, CRUX and MATH. Mixing lowers the average quality. A mix only helped (by 0.17–0.35%) where each model was best at a different subtask.
  - **X-MAS** (arXiv 2505.16997): a mix helps only when every role gets the model a benchmark shows is best for it. A random mix is often worse than one strong model.
- **Review by a second vendor** (Song, arXiv 2610.01471, Oct 2026; preprint by one author; 900 review sessions, 150 planted errors):
  - On code, the same model in a fresh session scored F1 40.7%, the other vendor 37.2% (no significant difference).
  - On documents, the other vendor scored 42.1% against 24.5%.
  - One review from each found 56.7% of the errors, against 42.7% for two same-model reviews (p=.006). A third reviewer added 1.3 points, and a weak second model did no better than self-review.
- **Errors converge:** Goel et al. (ICML 2025, arXiv 2502.04313) and Kim et al. (arXiv 2506.07962) find that stronger models make more similar mistakes, across vendors too. Judges also favour models like themselves.
- **Councils** (karpathy/llm-council; Perplexity Model Council): no independent accuracy data. One vendor's index (Suprmind, Q3 2026) found another model's correction stood on 3.4–7.4% of answers.
- **Cost:** four subscriptions run about $90 a month at entry tiers and $700–900 at top tiers (prices conflict across sources). Cursor runs Claude and GPT models itself. A pay-per-use second opinion: PAL MCP (BeehiveInnovations/pal-mcp-server), or another vendor's CLI.
- **For Groundwork:** for code, P9's fresh same-model reviewer is enough. A second vendor pays for GATE 1 documents and for high-stakes diffs: a strong model, two reviews at most.
