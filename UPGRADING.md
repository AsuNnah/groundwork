# Upgrading Groundwork

Your project data is never touched: it lives in `.groundwork/` and `docs/`. An upgrade only replaces the `groundwork/` folder.

## 1. Get the new version
Pick one:
```sh
# a specific release (recommended): use the latest tag from https://github.com/AsuNnah/groundwork/releases
git clone --depth 1 --branch v0.3.3 https://github.com/AsuNnah/groundwork /tmp/groundwork-new

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
4. migrates project state and prints the changelog since your version.

Downgrades are refused unless you pass `--force`.

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
