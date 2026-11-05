# AFD: <product> app flows

One section per flow that branches or involves more than one actor. Link each flow to its FSD feature and REQ IDs.

## Flow: <name> (REQ-001, AC-001)
- Actors: <user, admin, system, external service>
- Trigger: <what starts it>
- Preconditions: <signed in, online, permission granted…>

```mermaid
sequenceDiagram
  actor U as User
  participant A as App
  participant S as Server
  U->>A: action
  A->>S: request
  alt success
    S-->>A: 200 data
    A-->>U: show result
  else failure
    S-->>A: error
    A-->>U: error state + retry
  end
```

- Error and edge paths: timeout, offline, no permission, duplicate submit, cancel midway
- End states: <what is true when the flow finishes, for each path>
