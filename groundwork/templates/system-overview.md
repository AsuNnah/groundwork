# System overview: <project>

<!-- Lineage: matklad, "ARCHITECTURE.md" (2021): bird's-eye view, codemap, invariants, boundaries; arc42 sections 1–5; C4 context. Keep it short and revise it a couple of times a year. -->

Written from the code before changing an existing project, when no PRD/FSD/TRD describes it. Describe what is, not what should be.

## What it does
<one paragraph; main users>

## System context
<who and what is outside the system: users, external services, devices. One C4 context diagram>

## How to run and test
| Task | Command | Notes |
|---|---|---|
| install deps | | |
| run locally | | |
| run tests | | |
| build release | | |

## Structure
| Path / module | Responsibility | Entry point? |
|---|---|---|

## Invariants and boundaries
<rules the structure keeps, especially absences, e.g. "the domain layer never imports the UI", "only the worker writes to the queue">

## Data
Stores, main entities, where migrations live.

## External dependencies
APIs, services, env vars (names only), feature flags.

## Risky or unclear areas
Code without tests, known bugs, TODOs, anything you could not work out. Mark guesses `[NEEDS CLARIFICATION]`.
