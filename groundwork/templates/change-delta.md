# Delta: <YYYYMMDD-slug>

<!-- OpenSpec spec-delta format. Headings are load-bearing: `## ADDED|MODIFIED|REMOVED|RENAMED Requirements`, `### Requirement:`, `#### Scenario:`. -->
Merge into the current-truth docs after release, then archive this folder.

## ADDED Requirements
### Requirement: <name> (REQ-0xx)
The system SHALL <behaviour>.

#### Scenario: <name>
- WHEN <condition>
- THEN <result>

## MODIFIED Requirements
### Requirement: <name> (REQ-0yy)
<the FULL updated requirement text, not only the change>
The system SHALL <new behaviour>.

#### Scenario: <name>
- WHEN <condition>
- THEN <result>

> Review aid: was "<old wording>".

## REMOVED Requirements
### Requirement: <name> (REQ-0zz)
- **Reason:** …
- **Migration:** <what existing users or data need>

## RENAMED Requirements
- FROM: `### Requirement: <old name>`
- TO: `### Requirement: <new name>`
