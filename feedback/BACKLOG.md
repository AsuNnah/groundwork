# Groundwork improvement backlog

Derived from real-run feedback in `processed/`. Highest evidence first.

| ID | Improvement | Evidence (report → line) | Seen in N runs | Area (phase/pack/cli/scan) | Status |
|---|---|---|---|---|---|
| FB-002 | Existing projects: docs in another folder or nested product repo, own ID scheme, out-of-order phases. Map them (`docs_dir`, `docs.<key>`, P0 guidance) instead of pointer or duplicate files | run C (Rust server, nested repo): root `docs/prd.md`, `plan.md` created as pointers, G1 failed, edit blocked · run B (web + backend): unclear "adopting an existing PRD (A1..J6)", friction "out-of-order phases" | 2 | cli/P0/P1 | done (v0.4.0) |
| FB-003 | Small tasks in existing projects went untracked: 8 feature/fix commits with no stage or tier set and 0 agent notes; a workaround wasn't logged. P0 now applies to every task (one command at trivial), and workarounds are logged | run A (bot workspace): state stuck at H0 · run C (Rust server, nested repo): 0 notes | 2 | P0/GROUNDWORK | done (v0.4.0), watch next runs |
| FB-004 | Workspace with several products in one folder: one `.groundwork/` per product, documented | run A (bot workspace, two bot repos), run C (Rust server, nested repo) (nested repo) | 2 | P0 | done (v0.4.0, docs only) |
| FB-005 | Dev method override for project rules (no Docker in dev) | run A (bot workspace): improve note; rule written as prose in CLAUDE.md | 1 | cli | done (v0.4.0) |
| FB-006 | After an upgrade, flag finished phases whose instructions changed | run B (web + backend): unclear "already-completed phases are not flagged" | 1 | cli | done (v0.4.0) |
| FB-007 | Verify MCP/connector liveness (Chrome extension) | run B (web + backend): missing "had to probe the Chrome extension by hand" | 1 | P4 | done (v0.4.0, instruction; the CLI can't call MCP) |
| FB-008 | Feedback noise: optional SkillSpector CLI reported as misconfigured; info-level checks logged; ~120 trending lookalike names per refresh; FEEDBACK.md stale between phases | run A (bot workspace), run B (web + backend), run C (Rust server, nested repo) events | 3 | cli | done (v0.4.0) |
| FB-009 | Record the cross-cutting reason for a stack choice (reuse of a reference implementation) | run B (web + backend): friction P2 | 1 | P2 | won't do: the ADR is the right home; RESEARCH covers reference reuse |
| FB-001 | Doctor: when `/dev/kvm` is usable only via a logind seat ACL (user not in the `kvm` group), warn that access may vanish in SSH/headless/cron sessions and suggest `usermod -aG kvm` | First KVM verification on the dev host, 2026-11-04 (v0.2.0) | 1 | scan/cli | open |
