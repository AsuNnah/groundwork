# Skill & plugin matrix (starting point; re-check the inventory per project)

Popularity or install counts are not proof of safety. Names and repos of community skills change; verify before installing.

| Artifact / need | Usually available skill | Candidate if there is a gap | Use when |
|---|---|---|---|
| Requirements interview | `interview-me`, `idea-refine` | none | always for P1 |
| PRD | `spec-driven-development`, `prd` | `github/awesome-copilot@prd` | only if existing skills fall short |
| FSD / plan / tasks | `spec-driven-development`, `planning-and-task-breakdown` | none | standard+ |
| Flow diagrams (AFD) | none / Mermaid | `cathrynlavery/diagram-design@diagram-design` | complex, branching flows |
| UI design brief (DBD) | `hallmark`, `design-taste-frontend`, `frontend-ui-engineering` | `pbakaus/impeccable@shape` | meaningful UI; overlaps, so pick one |
| API & DB (BSD) | `api-and-interface-design` | `softaworks/agent-toolkit@database-schema-designer` | non-trivial relational schema |
| Security requirements (SRD) | `security-and-hardening`, `security-audit` | `wshobson/agents@security-requirement-extraction` | large threat surface |
| Postgres / Supabase | none | `supabase/agent-skills@supabase-postgres-best-practices` | only when the stack uses it |
| Browser testing | `browser-testing-with-devtools` | Playwright MCP | web target |
| Mobile UI testing | none | Appium MCP / Maestro | android/ios targets, after vetting |
| Knowledge graph | `graphify` | `Graphify-Labs/graphify` (PyPI `graphifyy`) | multi-module repos with many docs |

Rules: inventory first; install only the specific skill from a multi-skill repo; prefer project scope; record repo, skill id, ref/hash, scope, scan result, decision, and who approved each exception. SkillSpector verdicts: SAFE supports allow, CAUTION needs review, DO_NOT_INSTALL blocks.
