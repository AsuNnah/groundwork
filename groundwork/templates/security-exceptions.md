# Security exceptions

<!-- Lineage: risk acceptance (NIST SP 800-37 Rev. 2); "not affected" statements follow VEX (CISA minimum requirements 2023, OpenVEX). Scanner ignores carry the same expiry (osv-scanner.toml `[[IgnoredVulns]]` id, ignoreUntil, reason). -->
Accepted risks only. Every entry expires; re-review on or before the expiry date. Export entries as OpenVEX when you publish an SBOM.

| ID | Advisory (CVE/GHSA) | Package / product | VEX status (not_affected / affected / fixed / under_investigation) | Justification (not_affected: component_not_present, vulnerable_code_not_present, vulnerable_code_not_in_execute_path, vulnerable_code_cannot_be_controlled_by_adversary, inline_mitigations_already_exist) + detail | Mitigation in place | Scanner ignore entry | Approved by (user's words) | Recorded on | Expires |
|---|---|---|---|---|---|---|---|---|---|
