# SRD: <product>

## 1. Assets and data classification
| Asset / data | Class (public/internal/personal/sensitive) | Where stored | Retention |
|---|---|---|---|

## 2. Trust boundaries and threat actors
<boundaries (internet ↔ server, client ↔ API, admin ↔ console…) and who might attack each: anonymous internet, malicious user, compromised device, insider>

## 3. Threat model (STRIDE per entry point; one table per review round)
### 3.1 <component or review round, date>
| ID | Entry point | Threat | Severity | Mitigation | Task / status |
|---|---|---|---|---|---|
| SEC-001 | | | | | T.. |

## 4. Requirements
- Authentication:
- Authorisation (who can do what):
- Input validation at trust boundaries:
- Secrets management (never in repo):
- Transport/storage encryption:
- Resource safety (rate limits, size limits, timeouts):
- Audit logging (without personal data), audit integrity:
- Dependency & supply-chain policy:
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
