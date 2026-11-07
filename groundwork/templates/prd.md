# PRD: <product name>

<!-- Lineage: Marty Cagan, "How to Write a Good PRD" (SVPG, 2005); ISO/IEC/IEEE 29148:2018 stakeholder and system requirements. -->

- Status: draft | approved · Owner: <name> · Updated: <date> · Intent: `docs/intent.md`
- Prototype / mockup: <link, once it exists>
- ID scheme: REQ-xxx requirements · JRN-xxx journeys · NFR-xxx non-functional · SEC-xxx security requirements (in `docs/srd.md` when there is one) (an adopted PRD maps its own IDs here, e.g. `A1–J6 = REQ`)

## 1. Summary
<one paragraph: the product, for whom, the core outcome>

## 2. Problem
<who has which problem, what they do today, why now>

## 3. Users
| Persona | Goal | Skill level | Devices / platforms |
|---|---|---|---|

## 4. Goals and success metrics
| Goal | Metric | Target | How it's measured |
|---|---|---|---|

## 5. Requirements
Each requirement is **singular, unambiguous, verifiable and traceable** (ISO/IEC/IEEE 29148). One need per row, testable through its acceptance criteria.

Write each acceptance criterion in EARS (`WHEN <trigger>, the system SHALL <response>`) or Given/When/Then. A row that is out of scope or already built says so as a marker: in a cell of its own, in parentheses, or after a full stop or dash (`(out of scope)`, `(deferred)`, `(delivered)`). The same word inside the requirement's text ("…after they are delivered") is not a status.

| ID | Requirement (user story: as a …, I want …, so that …) | Priority (must/should/could) | Acceptance criteria (EARS or Given/When/Then) |
|---|---|---|---|
| REQ-001 | | must | AC-001: WHEN …, the system SHALL … |

### Domain model (when the product renders or manages things with structure)
<the key entities and how they relate; the fixture the UI and tests are built from>

## 6. User journeys
- JRN-001: <step-by-step journey, linked to REQs>

## 7. Non-functional
| ID | Requirement (performance, offline, accessibility, privacy, availability, scale) |
|---|---|
| NFR-001 | |

## 8. Scope
- In (MVP): <REQ IDs>
- Non-goals: <list, with why>
- Constraints: <deadline, budget, compliance, platforms, licences, hardware>

## 9. AI requirements (only if the product uses AI)
Model and provider, what the AI may and may not do, prompts and data it sees, cost per use, failure and fallback behaviour, evaluation (how quality is measured), personal data rules.

## 10. Technical outline
<high-level architecture, integrations, security and privacy notes; details go to the TRD/BSD/SRD>

## 11. Rollout
| Phase | What ships | Exit criteria | Testbed / environment |
|---|---|---|---|

## 12. Alternatives considered
| Option | Pros | Cons | Why chosen / rejected |
|---|---|---|---|

## 13. Risks, assumptions and dependencies
| Risk / assumption / dependency | Likelihood | Impact | Mitigation / how verified |
|---|---|---|---|

## 14. Open decisions
[NEEDS CLARIFICATION: …] (GATE 1 fails while any in-scope marker remains)

## 15. Decision log
| Date | Decision | Why | By (user's words) |
|---|---|---|---|
