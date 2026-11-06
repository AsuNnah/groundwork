# UPGRADE: dependency, SDK, runtime and framework updates

Use for stage `upgrade`, when a dependency or SDK update is needed, or when `gw eol` / a store policy forces one. Security-driven updates go through `SECURITY.md` first.

Commands for each stack are in the pack's `maintain` section (`gw maintain`). Platform deadlines are in its `policies` section; re-check the linked source before relying on one.

## 1. Inventory (read only)
- `gw maintain` prints the outdated/audit commands for this project's stacks. Run the **outdated** command for each stack.
- `gw eol` checks runtimes against endoflife.date: it warns when end of life is under 180 days away and fails when it has already passed.
- Check the pack `policies` for the targets, e.g. the Play target API level and the Apple Xcode minimum.
- Write the findings to `docs/upgrades/<YYYYMMDD>.md` (`templates/upgrade.md`) as a table: package, current, wanted (in range), latest, class (patch/minor/major/0.x/sdk), reason (security / policy / EOL / feature / routine).

## 2. Order of work
1. Security fixes (see `SECURITY.md`).
2. Platform deadlines (store policies).
3. End-of-life runtimes and SDKs.
4. Majors, **one at a time**.
5. Minor and patch updates, batched.

## 3. Risk classes
| Class | Rule |
|---|---|
| patch | batch together; merge when CI is green and the release is at least 3 days old |
| minor | group per ecosystem; full test run |
| major or 0.x | its own branch and commit; read the changelog/migration guide first; run the codemod if the pack lists one; full tests plus a manual smoke test of the main journeys |
| SDK / toolchain / runtime | its own branch, never mixed with dependency bumps; update the pins (`.mise.toml`, `.nvmrc`, `global.json`, Gradle wrapper, `compileSdk/targetSdk`) and the CI images together |

## 4. Per update
1. Make sure the test baseline is green first.
2. Apply one class or group of updates. Always commit lockfiles.
3. Run the codemod for majors, then fix compile errors and deprecations.
4. Run the tests at the target's release tier (`gw run <target> <tier> -- …`). For mobile/desktop SDK bumps, run on the S2/S3 tier, not just unit tests.
5. If it breaks and the fix isn't obvious within the timebox: revert, record the blocker in the upgrade doc, and move on to the next item.
6. Commit: `chore(deps): bump <pkg> <from>→<to> (<class>)`.

## 5. Keep it automated (optional, ask once)
Offer Renovate (wider ecosystem coverage, built-in automerge) or Dependabot (zero setup on GitHub), configured as follows:
- group minor and patch updates;
- automerge patches only (not 0.x) with a 3-day minimum release age;
- majors always get their own PR.

## 6. Done
Record each update in the changelog. Release through P10 if users are affected. `gw note` anything the pack commands got wrong.
