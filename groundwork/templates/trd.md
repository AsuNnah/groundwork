# TRD: <product>

<!-- Lineage: ISO/IEC/IEEE 42010:2022 (architecture description), arc42 v9 (12 sections), C4 model (context, container, dynamic, deployment views), "Design Docs at Google" (goals and non-goals, alternatives). "TRD" is common usage; the standard terms are "architecture description" and "design doc". -->
- Owner: <name> · Status: draft | reviewed | approved · Updated: <date>

## 1. Context and constraints
Targets: <from project.json> · Stack: <ADR-0001> · Host constraints: <from env-report, e.g. iOS built on CI>

## 2. Goals and non-goals
- Goals: <what this design must achieve, linked to PRD/NFR IDs>
- Non-goals: <what it deliberately does not try to do>
- Stakeholders and their concerns: <who cares about what: user, operator, security, store reviewer…>

## 3. Solution strategy
<the few fundamental choices (stack, architecture style, key patterns) and why, linked to ADRs>

## 4. System context
<what talks to what, outside the system boundary; Mermaid C4 context or flowchart>

## 5. Architecture and components
| Component / module | Responsibility | Public interface | Code location |
|---|---|---|---|
<diagram (Mermaid C4 container or flowchart)>

## 6. Runtime view
<one or two key scenarios as sequence diagrams: how the components work together (C4 dynamic view)>

## 7. Deployment view
| Environment | Node / host / service | What runs there | Scaling / redundancy |
|---|---|---|---|
<C4 deployment diagram; dev, CI, staging, production>

## 8. Technology
| Concern | Choice | Version | Why (ADR) |
|---|---|---|---|

## 9. Data
<entities, storage, retention, migrations. Details: docs/bsd.md>

## 10. API contracts
<link docs/contracts/openapi.yaml; auth, errors, versioning. Projects with a real backend or DB: docs/bsd.md (templates/bsd.md)>

## 11. Integrations
| Service | Purpose | Auth | Limits | Failure mode |
|---|---|---|---|---|

## 12. Configuration
| Setting / env var (name only, never the value) | Purpose | Default | Required |
|---|---|---|---|

## 13. Network and exposure (services)
| Port / endpoint | Protocol | Exposed to | Encryption | Auth |
|---|---|---|---|---|

## 14. Quality requirements (from PRD NFR-xxx)
| NFR | Quality scenario (stimulus → expected response, measurable) | Design response | How it's verified |
|---|---|---|---|
| NFR-001 | e.g. 100 concurrent users open the dashboard → p95 < 800 ms | | |

## 15. Cross-cutting
Logging and observability, secrets, performance budgets, offline/sync, i18n, accessibility.

## 16. Build, test, release
<build commands, test tiers (link test-strategy), packaging, release and rollback>

## 17. Engineering constraints
<rules the code must follow: e.g. no unwrap outside tests, upstream-compatible patches, licence obligations>

## 18. Risks and technical debt
| Risk / debt | Impact | Mitigation | Link (docs/tech-debt.md) |
|---|---|---|---|

## 19. Decisions
Architecture decisions live in `docs/adr/`. List the important ones: ADR-0001 …

## 20. Glossary
| Term | Meaning |
|---|---|

## 21. Open questions
[NEEDS CLARIFICATION: …]
