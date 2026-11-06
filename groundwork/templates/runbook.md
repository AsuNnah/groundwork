# Runbook: <product>

<!-- Lineage: Google SRE book (2016) and workbook (2018) on-call playbooks; PagerDuty incident response guide: one playbook per alert. -->

## Deploy
Per target: command / pipeline, where artifacts live, staged rollout steps.

## Roll back
Per target, from the pack's `rollback` recipe, adapted: exact commands and console clicks. Last tested: <date>.

## Observe
- Errors / crashes: <tool + link>
- Logs: <where, how to query by request_id>
- Uptime / health: <checks>
- SLOs and alert rules: <values>

## Alerts → playbook
One entry per alert, linked from the alert itself.
| Alert | What it means | Impact | First checks | Mitigation | Escalate to | Last verified |
|---|---|---|---|---|---|---|

## Secrets & access (names only, never values)
| Secret | Stored in | Used by | Rotation |
|---|---|---|---|

## Contacts
Owner, hosting/store accounts (names), escalation.
