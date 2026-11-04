# Test strategy

| Target | Unit (S0) | Integration (S1) | UI / device (S2) | Authoritative (S3) | Release tier |
|---|---|---|---|---|---|
| web | vitest | playwright in container | — | CI browsers matrix | S1 |

- Coverage bar: <e.g. 80% lines on domain code> (see CONSTRAINTS.md if present)
- Test data & fixtures:
- Flaky-test policy: quarantine + issue, never silently skip
- CI matrix (S3): <workflow file, runners>
- Acceptance (UAT) checklist source: FSD acceptance criteria
