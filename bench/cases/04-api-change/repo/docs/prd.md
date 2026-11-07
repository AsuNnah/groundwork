# PRD: notes-api

## Problem
Our team keeps short notes in a shared tool. Other services read and create them over HTTP.

## Requirements
| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| REQ-001 | As a client, I can list all notes | must | WHEN a client sends GET /notes THEN the system SHALL return 200 and a JSON array of notes |
| REQ-002 | As a client, I can create a note | must | WHEN a client sends POST /notes with a JSON title THEN the system SHALL return 201 and the new note with id and created_at |
| REQ-003 | As an analyst, I can export all notes as CSV | should | WHEN a client sends GET /notes.csv THEN the system SHALL return 200, Content-Type text/csv and one row per note (planned, not built yet) |

## Non-goals
Authentication (internal network only), editing and deleting notes.
