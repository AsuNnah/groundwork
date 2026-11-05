# Template sources

Where each document template in `groundwork/templates/` comes from, and the latest version it was aligned with. Researched 2026-11-05; re-check these when releasing a template change. "Groundwork name" marks names that are ours, not a standard.

| Template | Origin | Latest version aligned with | Notes |
|---|---|---|---|
| intent.md | Amazon PR/FAQ "Working Backwards" (~2004; Bryar and Carr 2021); Basecamp Shape Up pitch (2019) | stable | Groundwork name; adds appetite, no-gos, rabbit holes |
| prd.md | Marty Cagan, "How to Write a Good PRD" (SVPG 2005); IEEE 830-1998 | ISO/IEC/IEEE 29148:2018 (edition 3 at DIS stage, ballot from Sep 2026) | requirement quality: singular, verifiable, traceable |
| fsd.md | Joel Spolsky, "Painless Functional Specifications" (2000) | ISO/IEC/IEEE 29148:2018 SRS | scenarios, non-goals, one owner |
| afd.md | Alistair Cockburn, *Writing Effective Use Cases* (2001), fully dressed | UML 2.5.1, BPMN 2.0.2 (ISO/IEC 19510) | Groundwork name; main success scenario + extensions, success/minimal guarantees |
| trd.md | IEEE 1471-2000; arc42 (2005); C4 model; "Design Docs at Google" (2020) | ISO/IEC/IEEE 42010:2022; arc42 v9.x (2025–2026) | goals/non-goals, runtime and deployment views, quality scenarios, risks, glossary |
| adr.md | Michael Nygard, "Documenting Architecture Decisions" (2011) | MADR 4.0.0 (2024) | drivers, confirmation, Y-statement |
| bsd.md | Chen ER model (1976); Swagger/OpenAPI; RFC 7807 | OpenAPI 3.2.0 (2025), AsyncAPI 3.1 (2026), RFC 9457 (2023), RFC 8594 Sunset | Groundwork name |
| dbd.md | design-brief practice; Nielsen heuristics (1994) | W3C DTCG Design Tokens format 2025.10; WCAG 2.2 (WCAG 3 still a draft) | Groundwork name (UI brief, not database design) |
| mockup-review.md | heuristic evaluation (Nielsen and Molich 1990); cognitive walkthrough (Wharton et al. 1994) | UXAgent (CHI 2025); "Lost in Simulation" (2026): AI personas don't replace real users | severity 0–4, tasks per persona |
| platform.md | none canonical | Google Play policy center; Apple App Review Guidelines, privacy manifests (2024) | deadlines change yearly: see pack `policies` |
| system-overview.md | matklad, "ARCHITECTURE.md" (2021); arc42 §1–5 | stable | invariants and boundaries |
| srd.md | STRIDE (Kohnfelder and Garg, Microsoft 1999); Threat Modeling Manifesto (2020) | OWASP ASVS 5.0 (2025); NIST SSDF 800-218 v1.1 (v1.2 draft Dec 2025); LINDDUN | system model first |
| security-exceptions.md | NIST SP 800-37 Rev. 2 risk acceptance | CISA VEX minimum requirements (2023); OpenVEX 0.2 | VEX statuses and justifications |
| test-strategy.md | IEEE 829 (1983/2008); test pyramid (Cohn 2009) | ISO/IEC/IEEE 29119-3:2021 | risk-based, exit criteria, regression rule |
| plan.md | ISO/IEC/IEEE 16326 | GitHub Spec Kit plan template; Shape Up | summary, technical context, appetite |
| runbook.md | ops runbooks; Google SRE book (2016) | SRE workbook (2018); PagerDuty incident response | one playbook per alert |
| incident.md | Google SRE book ch. 15 (2016); Allspaw, "Blameless PostMortems" (2012) | VOID reports (2022–2024); Learning from Incidents | contributing factors, no MTTR averages |
| tech-debt.md | Ward Cunningham, OOPSLA 1992 | Fowler quadrant (2009); Kruchten et al. 2019; Lenarduzzi et al. review | principal and interest |
| upgrade.md | SemVer 2.0.0 (2013) | endoflife.date; Renovate/Dependabot practice | EOL dates, release notes |
| lessons.md | US Army After Action Review; Kerth (2001) | Derby, Larsen and Horowitz, *Agile Retrospectives* 2nd ed. (2024) | planned vs happened |
| bugfix.md | Bugzilla bug-writing guidelines | ISO/IEC/IEEE 29119-3:2021 incident report | severity, priority, status |
| uat.md | ISTQB acceptance testing; Dan North, "Introducing BDD" (2006) | Gherkin; ISO/IEC/IEEE 29119-3:2021 completion report | Given per row, accepted known issues |
| change-proposal.md, change-delta.md | PEP 1 (2000); Rust RFCs; Kubernetes KEPs | OpenSpec spec-driven schema (2025) | delta headings are load-bearing |
