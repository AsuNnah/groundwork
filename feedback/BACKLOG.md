# Groundwork improvement backlog

Derived from real-run feedback in `processed/`. Highest evidence first.

| ID | Improvement | Evidence (report → line) | Seen in N runs | Area (phase/pack/cli/scan) | Status |
|---|---|---|---|---|---|
| FB-001 | Doctor: when `/dev/kvm` is usable only via a logind seat ACL (user not in the `kvm` group), warn that access may vanish in SSH/headless/cron sessions and suggest `usermod -aG kvm` | First KVM verification on the dev host, 2026-11-04 (v0.2.0) | 1 | scan/cli | open |
