# Feedback inbox

After working on a project with Groundwork, copy its `.groundwork/FEEDBACK.md` here:

```
cp <project>/.groundwork/FEEDBACK.md <groundwork-repo>/feedback/inbox/<project>-<YYYYMMDD>.md
```

Optionally add your own lines at the top under `## My notes`. Then, in a Claude session in your clone of this repo, say **"process feedback"**.

- `inbox/`: new reports, not yet processed
- `processed/`: reports already turned into backlog items
- `BACKLOG.md`: improvements derived from real runs, with evidence and status
