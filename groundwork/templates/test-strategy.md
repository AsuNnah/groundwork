# Test strategy

<!-- Lineage: ISO/IEC/IEEE 29119-3:2021 (risk-based test plan and strategy; replaces IEEE 829); test pyramid (Cohn 2009; Fowler/Vocke 2018): many fast unit tests, fewer integration, few end-to-end. -->

## Risks driving test focus
| Risk (from PRD, SRD, TRD) | Likelihood × impact | Tests that cover it | Tier |
|---|---|---|---|

| Target | Unit (S0) | Integration (S1) | UI / device (S2) | Authoritative (S3) | Release tier |
|---|---|---|---|---|---|
| web | vitest | playwright in container | — | CI browsers matrix | S1 |

- Completion (exit) criteria per tier: <e.g. S0 all green + coverage bar; S1 all integration green; S3 green on every target in the matrix>
- Regression and retest: <a fixed bug gets a regression test; which suites rerun on each change; full run before release>
- Test environment: <per tier, from the pack sandbox recipe>
- Coverage bar: <e.g. 80% lines on domain code> (see CONSTRAINTS.md if present)
- Test data & fixtures:
- Flaky-test policy: quarantine + issue, never silently skip
- CI matrix (S3): <workflow file, runners>
- Acceptance (UAT) checklist source: FSD acceptance criteria
