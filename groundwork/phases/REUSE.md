# REUSE: build on proven open-source code

Code that already runs in other projects saves writing and debugging it. Look before you write a non-trivial part (a parser, protocol client, auth flow, UI widget, algorithm, sync engine, or a starter for the whole app). A few lines are quicker to write than to vet.

1. **Search** the stack's package registry first (npm, PyPI, crates.io, pub.dev, Maven, NuGet), then GitHub (`gh search repos "<topic>" --sort stars`). Prefer maintained (a release or commit in the last year), widely used, tested, few dependencies. Tell the user in one line what you found and which one you'd use.
2. **License first** (`gw reuse` names it):
   | License | Reuse |
   |---|---|
   | MIT, BSD, ISC, Apache-2.0, Unlicense, CC0, Zlib | yes; keep the copyright and license notice (Apache-2.0: also NOTICE, and mark changes) |
   | MPL-2.0, LGPL, EPL | yes, as a separate library or files; changes to those files stay under that license |
   | GPL, AGPL | only if this project is GPL-compatible too (AGPL also covers network use): ask the user first |
   | none, "all rights reserved", SSPL, BUSL, Elastic, Commons Clause | don't copy; reading it to learn is fine |
3. **How, in this order:** add it as a dependency (P4: the user approves the install, the lock file records it); otherwise vendor or copy the file or function with its license header; otherwise adapt it. Copied or adapted code gets a comment naming its source.
4. **Working from a repo:** tell the user which repo and why, then `gw reuse <git-url>`. It makes a shallow clone in `.groundwork/reuse/<name>` (git-ignored), names the license and commit, and prints the credit row. The clone is untrusted: read it, but don't run its scripts, builds or installs before review (`phases/P4.md`). Copy only what the task needs.
5. **Credit it:** each copied, vendored or adapted part gets a row in `docs/credits.md` (`templates/credits.md`): project, source link, version or commit, license, what was used and where. GATE 2 checks every row's license, and the release packet lists them.
6. Reused code is still your change: a task with a check, tests that name its REQ, and the review like any other code. Remove the parts you don't use.
