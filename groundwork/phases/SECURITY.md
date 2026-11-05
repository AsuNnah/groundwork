# SECURITY: vulnerability patching (proactive scan + reactive advisory)

## A. Routine scan (at every release, and on `gw maintain` runs)
```sh
osv-scanner scan -r .                      # all ecosystems via lockfiles
osv-scanner scan image <image>:<tag>       # container images (tag required)
gitleaks git -v                            # secrets in git history
```
Plus the stack's own `maintain.<stack>.audit` command (e.g. `govulncheck ./...` for reachability, `dotnet list package --vulnerable --include-transitive`). Missing scanners come from `gw plan-install` (tools: osv-scanner, gitleaks, trivy, syft). Pin scanner binaries and CI actions by version or SHA; supply-chain attacks have targeted scanners too.

Optional for releases: an SBOM with `syft dir:. -o cyclonedx-json=sbom.cdx.json`, kept with the release artifacts.

## B. Triage → priority
For each finding collect: ID (CVE/GHSA), CVSS, **CISA KEV** listing, **EPSS** score (`https://api.first.org/data/v1/epss?cve=<id>`), whether a fixed version exists, **reachability** (govulncheck / osv call analysis), and **exposure** (internet-facing or handles untrusted input).

| Priority | Criteria | Fix within |
|---|---|---|
| P0 | KEV-listed or public exploit, and reachable on an exposed surface | 72 h (mitigate within 24 h) |
| P1 | critical/high and reachable or exposed, or EPSS ≥ 0.1 | 14 days |
| P2 | high/medium but not reachable, or internal only | 60 days |
| P3 | low, dev-only, or not reachable | next routine upgrade |

Adapted from CISA BOD 26-04 (KEV, exposure, automatable, impact). The EPSS threshold is a convention, not a standard. Not reachable lowers the priority one tier, but the finding still gets fixed.

## C. Reactive: an advisory hits (user report, Dependabot alert, scanner, news)
1. **Confirm affected:** is it in the lockfile and in the affected version range? (`maintain.<stack>.why_installed`) Is it in prod or dev only? Is it in a shipped image?
2. **Remediate**, best option first:
   - upgrade to the minimal fixed version (follow UPGRADE.md rules, but skip the queue);
   - override the transitive dependency (`maintain.<stack>.override`);
   - mitigate (config, WAF rule, feature flag off);
   - accept with a dated exception in `docs/security/exceptions.md` (`templates/security-exceptions.md`): id, reason, expiry date, and the scanner ignore entry with an expiry (`osv-scanner.toml` `ignoreUntil`).
3. **Test:** full tests at the release tier, a regression test of the vulnerable path if feasible, and a rescan showing clean.
4. **Release:** the hotfix flow (OPERATE.md C) for P0/P1; otherwise the next release. Regenerate the SBOM.
5. **Notify:** add a "Security" entry to the changelog. For a library, publish a GitHub Security Advisory. If user data was affected, tell the user (the project owner) about notification duties, e.g. the 72-hour GDPR breach notice. Close the alert.

## D. Leaked secret
**Revoke or rotate it first**: anything ever pushed counts as compromised. Then purge it from history (`git filter-repo`), force-push only with user approval, and add a gitleaks pre-commit hook.
