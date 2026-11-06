# Feedback inbox

Once per machine, let every project send its feedback events here as they happen:

```
node <project>/groundwork/bin/gw.js feedback inbox <groundwork-repo>/feedback/inbox
```

Each project then appends to `inbox/<project>-<id>.jsonl` (the id tells apart two projects with the same name): one context line, then every agent note and automatic signal, each with the framework version. The files stay on this machine and git ignores them. `gw feedback inbox off` stops it.

Without that, copy a project's `.groundwork/FEEDBACK.md` here after working on it:

```
cp <project>/.groundwork/FEEDBACK.md <groundwork-repo>/feedback/inbox/<project>-<YYYYMMDD>.md
```

Optionally add your own lines at the top under `## My notes`. Then, in a Claude session in your clone of this repo, say **"process feedback"**.

- `inbox/`: new reports, not yet processed
- `processed/`: reports already turned into backlog items
- `BACKLOG.md`: improvements derived from real runs, with evidence and status
