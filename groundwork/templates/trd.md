# TRD: <product>

## 1. Context and constraints
Targets: <from project.json> · Stack: <ADR-0001> · Host constraints: <from env-report, e.g. iOS built on CI>

## 2. System context
<what talks to what, outside the system boundary; Mermaid C4 context or flowchart>

## 3. Architecture and components
| Component / module | Responsibility | Public interface | Code location |
|---|---|---|---|
<diagram (Mermaid C4 container or flowchart)>

## 4. Technology
| Concern | Choice | Version | Why (ADR) |
|---|---|---|---|

## 5. Data
<entities, storage, retention, migrations. Details: docs/bsd.md>

## 6. API contracts
<link docs/contracts/openapi.yaml; auth, errors, versioning. Projects with a real backend or DB: docs/bsd.md (templates/bsd.md)>

## 7. Integrations
| Service | Purpose | Auth | Limits | Failure mode |
|---|---|---|---|---|

## 8. Configuration
| Setting / env var (name only, never the value) | Purpose | Default | Required |
|---|---|---|---|

## 9. Network and exposure (services)
| Port / endpoint | Protocol | Exposed to | Encryption | Auth |
|---|---|---|---|---|

## 10. Non-functional requirements (from PRD NFR-xxx)
| NFR | Design response | How it's verified |
|---|---|---|

## 11. Cross-cutting
Logging and observability, secrets, performance budgets, offline/sync, i18n, accessibility.

## 12. Build, test, release
<build commands, test tiers (link test-strategy), packaging, release and rollback>

## 13. Engineering constraints
<rules the code must follow: e.g. no unwrap outside tests, upstream-compatible patches, licence obligations>

## 14. Open questions
[NEEDS CLARIFICATION: …]
