# Upgrading Groundwork

Your project data is never touched: it lives in `.groundwork/` and `docs/`. An upgrade only replaces the `groundwork/` folder.

## Easiest: paste this to your AI agent
Open your agent **in the project folder** and paste:

```text
Update Groundwork in this project to the latest release.
1. Run node groundwork/bin/gw.js version and tell me the current version.
2. Download the latest release of https://github.com/AsuNnah/groundwork into a temporary folder outside
   this project (git clone --depth 1 --branch <latest v* tag>). If it is not newer, stop and tell me.
3. Run: node groundwork/bin/gw.js upgrade <temporary folder>/groundwork
   (it backs up the old folder, replaces it, and migrates the project state; my docs/ and .groundwork/ stay).
4. Tell me in plain words: old → new version, what changed (from the printed changelog), any local edits
   it warned about, and any phases it flags for re-check. Then re-check those phases.
5. Run node groundwork/bin/gw.js verify and node groundwork/bin/gw.js doctor, and report the results.
6. Delete the temporary folder. Commit only if I ask.
```
The rest of this page is the same thing by hand.

## 1. Get the new version
Pick one:
```sh
# a specific release (recommended): use the latest tag from https://github.com/AsuNnah/groundwork/releases
git clone --depth 1 --branch v0.6.0 https://github.com/AsuNnah/groundwork /tmp/groundwork-new

# or the latest main
git clone --depth 1 https://github.com/AsuNnah/groundwork /tmp/groundwork-new
```
You can also download a version's zip from the [Releases page](https://github.com/AsuNnah/groundwork/releases) (each release lists its changes) and unpack it. The framework folder is `groundwork/` inside it.

Read the [CHANGELOG](groundwork/CHANGELOG.md) for what changed.

## 2. Upgrade each project
From the project root:

**From v0.3.0 or newer:**
```sh
node groundwork/bin/gw.js upgrade /tmp/groundwork-new/groundwork
```
It:
1. backs up the current folder to `.groundwork/backups/`;
2. replaces the folder rather than merging, so files removed in the new version are deleted;
3. warns about any framework files you edited locally;
4. migrates project state and prints the changelog since your version;
5. flags phases you already finished whose instructions changed, so the agent re-checks them (shown in `gw status` until done).

Downgrades are refused unless you pass `--force`.

**Going back to the previous version (rollback).** Every upgrade leaves the old folder in `.groundwork/backups/`, so you can return to it:
```sh
ls .groundwork/backups/                                   # e.g. groundwork-0.4.0-2026-11-05T…
node groundwork/bin/gw.js upgrade .groundwork/backups/groundwork-0.4.0-<time> --force
```
- Project state is kept. Fields the older version doesn't know (task receipts, `legacy`, `features`, reviews) stay in place and are ignored.
- The state version is set to the older version, so it runs without warnings.
- Hooks added by the newer version (0.5.0: the Stop hook) stay in `.claude/settings.json` and do nothing under the older CLI. You can delete that entry.
- To return to the newer version later, run a normal `gw upgrade` again. It re-runs the newer migrations, which are safe to repeat. The command is printed when you roll back.
- Tested path: 0.4.0 → 0.5.0 → 0.4.0 → 0.5.0, with tasks, receipts and hooks intact.

**From v0.2.0** (no `upgrade` command yet): replace the folder by hand.
```sh
rm -rf groundwork && cp -r /tmp/groundwork-new/groundwork .
node groundwork/bin/gw.js version     # the first command migrates the state automatically
```

**If you copied the new folder *over* the old one** (merge instead of replace):
```sh
node groundwork/bin/gw.js verify --clean   # removes leftover files from the old version
```

## 3. Check
```sh
node groundwork/bin/gw.js version   # framework version and project state version should match
node groundwork/bin/gw.js verify    # "Clean: matches the shipped version."
node groundwork/bin/gw.js status
```
Claude Code also migrates automatically at the next session start, if the hooks are installed.

## Local changes
Don't edit files inside `groundwork/`; upgrades replace them. Put project-specific changes here instead:
| Change | Put it in |
|---|---|
| a new or modified platform pack | `.groundwork/packs/<id>.json` (same id overrides the shipped pack) |
| tool install commands | `.groundwork/tools.json` |
| project rules for the agent | `CLAUDE.md` |
| improvements for every project | framework feedback (`.groundwork/FEEDBACK.md` → this repo's `feedback/inbox/`) |

If `gw upgrade` reported local edits, the old files are in `.groundwork/backups/<old-version>-<time>/`. Move what you need into the places above.

## Rolling back
```sh
rm -rf groundwork && cp -r .groundwork/backups/<backup-folder> groundwork
```
Project state written by a newer version stays readable: an older framework shows a warning but keeps working.
