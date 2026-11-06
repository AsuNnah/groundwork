# FIT: fitting Groundwork onto an existing project

Don't duplicate what the project already has; map it.
- **Docs live elsewhere** (another folder, a nested product repo, other file names):
  - point Groundwork at them, `gw set docs_dir=<path>` or per file `gw set docs.prd=<path> docs.plan=<path> docs.test_strategy=<path>`;
  - never create pointer or duplicate files to satisfy a gate;
  - file names match case-insensitively (`PRD.md`), and the GATE 1 edit guard allows edits there.
- **Its own ID scheme** (e.g. `A1..J6`): keep it. Add one line to the PRD header mapping it, e.g. `ID scheme: A1–J6 = REQ, S1–S7 = NFR, AF-xx = JRN`, and link to those IDs.
- **Phases done out of order or under another process:** record what exists with a note instead of redoing it, e.g. `gw phase P5 in_progress "FSD, AFD drafted before P2"`, and continue from the earliest phase still missing.
- **Several products in one folder** (workspace of repos): Groundwork tracks one project per `.groundwork/`. Copy `groundwork/` into each product folder you work in and start the agent there. In one git repo (monorepo), `gw ci write` puts each product's workflow at the repo root, runs it in the product folder and triggers it only on changes there. Alternatively, keep one copy at the workspace root, set `docs_dir` to the active product, and set `name=`.
- **Project rule against the host's dev method** (e.g. no Docker in development): `gw set dev_method=native-user-scope dev_method_reason="no Docker in dev"`. Doctor and `gw run` then stop offering local container tiers (S1 goes to CI). `gw set dev_method=` clears it.
- **A reference app to model on** ("like X", "copy the closest existing bot"): `phases/RESEARCH.md`.
