# SRD: <product>

<!-- Lineage: Threat Modeling Manifesto (2020) four questions: what are we working on, what can go wrong, what are we going to do about it, did we do a good job. STRIDE (Kohnfelder and Garg, Microsoft, 1999); LINDDUN for privacy; OWASP ASVS 5.0 (2025) for requirements; NIST SSDF SP 800-218 v1.1 (v1.2 in draft) for the development process. -->
- Requirement standard: OWASP ASVS 5.0, level <L1 basic / L2 most apps with personal data / L3 high assurance>

## 0. System model
<data-flow diagram (Mermaid flowchart) of what we're working on: processes, data stores, external entities, and the trust boundaries crossing them>

## 1. Assets and data classification
| Asset / data | Class (public/internal/personal/sensitive) | Where stored | Retention |
|---|---|---|---|

## 2. Trust boundaries and threat actors
<boundaries (internet ↔ server, client ↔ API, admin ↔ console…) and who might attack each: anonymous internet, malicious user, compromised device, insider>

## 3. Threat model (STRIDE per entry point, plus LINDDUN privacy threats when personal data is in scope; one table per review round)
Threats get TH- IDs. The requirements that answer them get SEC- IDs in section 4.
### 3.1 <component or review round, date>
| ID | Entry point | Threat | Severity | Mitigation (SEC- IDs) | Task / status |
|---|---|---|---|---|---|
| TH-001 | | | | SEC-001 | T.. |

## 4. Requirements
Each security requirement gets a SEC- ID and a testable SHALL statement. `gw trace` reads this table, like the PRD's: a SEC- ID needs a task and a test that names it, unless its Status cell says `delivered` or `out of scope`. Cite ASVS 5.0 requirement IDs where they apply (v4 numbers changed).

| ID | Requirement | ASVS 5.0 | Status |
|---|---|---|---|
| SEC-001 | The system SHALL … | | |

Areas to cover:
- Authentication:
- Authorisation (who can do what):
- Input validation at trust boundaries:
- Secrets management (never in repo):
- Transport/storage encryption:
- Resource safety (rate limits, size limits, timeouts):
- Audit logging (without personal data), audit integrity:
- Dependency & supply-chain policy (SSDF: pinned dependencies, SBOM, signed releases, vulnerability response):
- Platform/store policy (permissions rationale, privacy labels, data safety):

## 5. Verification and penetration-test results
| ID | Test (what was attempted) | SEC IDs covered | Result | Date |
|---|---|---|---|---|

## 6. Residual risk
| Risk | Why accepted | Owner | Review by |
|---|---|---|---|

## 7. Review history
| Date | Scope | Reviewer | Findings |
|---|---|---|---|

## 8. Review cadence
<when this is re-reviewed: every release touching auth/input/crypto, at least every N months, after an incident>
