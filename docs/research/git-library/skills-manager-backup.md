# Skills Manager: Git backup and multi-device sync

Source: `github.com/xingkongliang/skills-manager` (MIT), shallow clone of `main` at `d30530c` (2026-11-03). Paths below are relative to the clone's `src-tauri/src/` unless noted. The code is Rust/Tauri with SQLite. Its comments cite an internal `docs/merge-engine-design.md` and a "backup redesign" document. Neither is in the repo.

## 1. Repo layout: what is committed

**The library itself is the repo.** `git init` runs directly in the central skills dir (`~/.skills-manager/skills` by default, `core/central_repo.rs::skills_dir`). There is no separate export or staging copy. `core/git_backup.rs::init_repo_unlocked` pins `init.defaultRefFormat=files`, because libgit2 cannot open reftable repos (issue #504). It also creates branch `main`, sets the device identity, writes `.gitignore`, and makes the initial commit.

Committed tree:

```
<skill-dir>/...                                   skill content, verbatim (nested up to depth 6)
.skills-manager/schema.json                       {schema_version, app_min_version, created_by}
.skills-manager/protocol.json                     merge-protocol marker (sticky)
.skills-manager/skills/<skill_id>.json            SkillMetaFile
.skills-manager/scenarios/<scenario_id>.json      preset: name, description, icon, sort_order
.skills-manager/scenario-skills/<sid>/<skid>.json preset membership: sort_order + tools{agent: bool}
.gitignore
```

- `SkillMetaFile` (`core/sync_metadata.rs`) contains `skill_id` (UUID), `path` (relative content dir), `path_key` (normalized path for collision checks), `enabled`, `tags` (sorted), and `source {type, ref, subpath, branch}`. `ref` is dropped for `import` and `local` sources, because those refs are machine paths.
- **SQLite is not committed.** The DB is a cache. `sync_metadata.rs::write_all_from_db_unlocked` projects DB to JSON before each commit. `reindex_from_metadata_unlocked` rebuilds DB rows from JSON after each pull or clone, keeping per-device fields such as `source_revision`, `update_status` and `last_checked_at` from the previous local row.
- **Presets ("scenarios") and per-preset, per-agent toggles are portable** (membership `tools` map). The actual deployment state (`skill_targets` and the active preset) stays in the local DB (see §4).
- One file per object is deliberate: each JSON file is a merge unit.

Exclusions:
- `ensure_gitignore` always appends `.DS_Store`, `Thumbs.db`, `*.tmp`, `.skills-manager.lock`, `__pycache__/` and `*.pyc`. It never rewrites user lines. `untrack_python_artifacts` runs `git rm --cached` once for `.pyc` files that are already tracked.
- `remove_tmp_metadata_files` deletes atomic-write leftovers (`x.json.tmp.<uuid>`) before every commit, because these broke the merge validator on other devices.
- **>100 MB:** `apply_oversized_exclusions` (`SKILL_SIZE_LIMIT_BYTES`) writes an auto-managed `.gitignore` section between marker comments. It ignores `/<skill-dir>/` together with its `.skills-manager/skills/<id>.json`. It **never untracks** a skill that is already tracked; it only warns. A skill that shrinks below the limit re-enters the backup. The app also warns at 1 GB total repo size (`size_report`).
- **Secrets:** none live in the skills dir. Tokens go to the OS keychain and proxy/API settings stay in SQLite. Skill contents are **not** scanned for secrets (issue #406 raises this).

## 2. Trigger, cadence, process, git engine

- **Auto backup** (`core/auto_backup.rs`): runs in the Tauri GUI process only. `core/file_watcher.rs` calls `notify_central_change()` for any change outside `.git`. This sets `DIRTY` and records a timestamp.
  - Debounce: **120 s** of quiet after the last change. A 15 s poll loop checks whether a round is due. Exponential backoff applies after failures, capped near 1 h (`2^5 × 2 min`).
  - Startup round after **90 s**. It pushes whatever `commit_on_exit` committed locally at quit. `commit_on_exit` itself never touches the network.
  - **There is no idle periodic pull.** A round runs only when the tree is dirty or at startup (open issue #524 asks for background pulls).
  - Each round (`run_round_blocking`) does the following in order:
    1. Try the repo lock (fail fast, skip if busy).
    2. Quiet `fetch`.
    3. Bail on `unrelated_histories` or `detached`.
    4. Project DB to JSON, then commit `"auto backup"`.
    5. If behind, object-merge, unless the remote touches a pending conflict (`PausedOnConflict`, deliberate backpressure).
    6. Push. A non-fast-forward rejection re-arms the next round. Auto rounds create no snapshot tag.
- **Back Up Now / Sync** (`commands/git_backup.rs::git_backup_sync` → `run_sync_blocking`) is one transaction under a single lock: project → commit → fetch → merge if behind → **snapshot tag** → push. On rejection it retries fetch, merge and push up to 3 times. Snapshot tags are lightweight, named `sm-v-YYYYMMDD-HHMMSS-<sha>`, and pushed explicitly, because `--follow-tags` skips lightweight tags.
- **CLI** (`bin/skills-manager-cli.rs`, `GitCommand::{Status, Init, Clone, SetRemote, ...}`) offers the same core operations on demand. There is no daemon.
- **Locking:** `core/repo_lock.rs::RepoLock` is a file lock (`.skills-manager.lock`, gitignored) shared by the GUI, CLI and background work. Foreground operations wait for it; background work fails fast.
- **Git engine: hybrid.**
  - All local operations (`add`, `commit`, `tag`, `status`, `merge`, `read-tree`) **shell out to system git** (`core/git_command.rs`).
  - The **object merge uses `git2` (libgit2)** to read trees, build trees and write the merge commit.
  - Network operations default to system git. An opt-in setting (`git_backup_engine=git2`, `core/git2_engine.rs`) routes HTTP(S) fetch, push, ls-remote and clone through libgit2 with keychain credentials. SSH and custom remotes always use system git.

## 3. Merge model ("skill-aware merging")

The code is in `core/merge/`. The object merge is the default; setting `merge_engine=system` switches back to the line-level `git merge` (`mod.rs::gated_pull_unlocked`).

Pipeline (`apply.rs::object_merge_pull_unlocked`):
1. **P1/P2:** project and commit everything, then require a clean tree.
2. Fetch. Set `ours` = HEAD, `theirs` = `origin/<branch>`, and **`base` = `repo.merge_base(ours, theirs)`**, a real 3-way base.
3. If the remote has no `protocol.json`, it was written by a pre-protocol client. The code falls back to `git merge` (`merge_branch_system`). That fallback aborts on conflict and raises `SYNC_CONFLICT`.
4. `check_old_client_writes`: every app commit carries a `Skills-Manager-Protocol: 2` trailer. A commit whose tree has `protocol.json` but whose message lacks the trailer came from an old client or from manual git. Depending on the case, the code blocks or warns.
5. `snapshot.rs::read_snapshot` turns each tree into logical objects:
   - **skills**, keyed by `skill_id`. Each holds its meta plus the **tree OID of its content dir**.
   - scenarios
   - memberships
   - residual files
6. `decision.rs::decide` is a **pure function** of (base, ours, theirs, pinned pendings, last-touch times). Both devices therefore compute the same plan.
   - **Per skill, object table:**
     - added on one side → take it
     - deleted on one side and unchanged on the other → deletion propagates
     - delete vs modify → conflict
     - both sides added the same id with different content → conflict
   - **Per skill, component merge** (`merge_components`): `content` (tree OID), `path` and `attrs` (enabled + tags + source, as one unit) each go through 3-way pick independently. **A rename is a `path` change and an edit is a `content` change, so the two combine cleanly.** If any single component diverges on both sides to unequal values, the whole skill conflicts. The merge never goes below the skill directory; there is no line merge of `SKILL.md`.
   - **Whole-file objects** (scenarios, memberships, residual files) use 3-way per key. When both sides changed a key, **newest committer time wins**, with the commit id as a deterministic tie-break.
   - Self-heals: drops orphan memberships, drops junk files in the metadata namespace, and moves path collisions to a fresh path.
7. `treebuild.rs` builds the merged tree. `validate.rs` checks it strictly: metadata and directories must be paired, and there must be no new orphan dirs. Any violation aborts with zero changes. Untracked or ignored files in the worktree that would be shadowed block the merge with an explicit error, never a forced checkout.
8. Crash-safe apply (`finish_apply`):
   - writes `REF_PRE_MERGE` and per-conflict staging refs
   - writes the 2-parent merge commit
   - moves the branch with a compare-and-swap (CAS)
   - force-checks out the new tree
   - promotes the staging refs
   - `recover_on_startup` replays an interrupted apply.

**Conflict representation ("keep local + Needs attention").**
- A conflicting skill keeps the **ours** version in the merged tree.
- The merge commit message gets a `Skills-Manager-Conflicts: id1, id2` trailer.
- A hidden ref `refs/skills-manager/conflicts/<id>` pins the theirs commit against GC.
- `pending.rs`: **the source of truth is the commit history.** `Conflicts:` and `Resolved:` trailers are replayed in topological order. The SQLite table is only a rebuildable UI projection, so every device sees the same pending set after syncing.
- A skill that is pending on both devices with different pinned versions → `SYNC_CONFLICT` "resolve on one device first".
- The app never pushes hidden refs; `prune_hidden_refs_on_remote` cleans them up after a manual `--mirror` push.

**Resolution** (`resolve.rs`, actions `keep_local | use_remote | keep_both`):
1. Take a safety snapshot tag first.
2. Apply the action. `use_remote` extracts the theirs tree. `keep_both` writes the theirs tree to a free sibling path with a new id.
3. Commit with a `Skills-Manager-Resolved: <id>` trailer, using `--allow-empty` because keep-local changes nothing in the tree. This trailer is the close signal for other devices.
4. Delete the pin ref and the projection row.

## 4. Restore on a new machine; deployment; portable vs machine state

- **First run** (`src/components/FirstRunRestoreDialog.tsx`): if the library is empty, no remote is saved and the dir is not a repo, a one-time dialog offers "start fresh" or "restore from URL".
- **Restore steps:**
  1. Sanitize the URL; credentials go to the keychain.
  2. `git_backup_clone` → `git_backup.rs::clone_into_unlocked`.
  3. Clone into place. Local-only skills are merged in, and identical same-named skills are accepted.
  4. If a same-named local skill **differs**, the clone stops with `CLONE_LOCAL_DIFFERS`. The user can confirm a `set_aside` list instead; those local versions are copied to a sibling folder and the clone continues.
  5. On failure, the previous library is put back.
- **Reclone** is the recovery path for broken history. It sets the old `.git` aside and keeps it if it holds history the remote lacks.
- After a clone, `reconcile_skills_index_unlocked` rebuilds the DB from `.skills-manager/*.json`. If the metadata is missing, it falls back to scanning dirs and creates `source_type: "import"` rows.
- **Deployment to agents is not part of sync.** Agents read skills through symlinks (or copies) that point into the central library, so **content changes from a pull reach agents immediately**. Deploying newly arrived skills or changed presets happens at app startup (`scenario_service.rs` re-syncs the active preset with `sync_scenario_skills`) or through preset and deploy actions. A preset deploy only **adds**; it does not remove skills dropped from a preset (#524).
- **Machine-local (SQLite or keychain only):**
  - agent install paths (`custom_tool_paths` setting, `core/tool_adapters.rs`)
  - deployed targets (`skill_targets`)
  - active preset, symlink/copy mode
  - device name (stored, then written to the local `.git/config` `user.name` and `user.email`, which attributes commits to the device)
  - update-check state, proxy, tokens
- **Portable:** skill content, tags, `enabled`, source descriptors, presets, and per-preset agent toggles.
- Snapshot restore (`restore_snapshot_version_unlocked`):
  1. Commit anything dirty and tag a safety snapshot.
  2. Run `read-tree --reset -u <tag>`.
  3. Write a forward commit. History is never rewritten.

## 5. Auth

- **GitHub device flow** (`core/github_api.rs`):
  - public OAuth App `client_id`, no client secret
  - scope `repo` (broad; #406 asks for least privilege)
  - `device_flow_start` and `device_flow_poll` are separate Tauri commands, with polling driven by the UI. `slow_down` is surfaced to the UI.
  - On authorization the token never reaches the webview. `connect_with_token` handles it in the backend.
- `connect_backup_repo`:
  1. `GET /user` validates the token and gets the login.
  2. `GET /repos/{login}/{name}`, and on 404, `POST /user/repos` with `private: true, auto_init: false` (default name `skills-manager-backup`).
  3. 403 is mapped to `GITHUB_SCOPE`.
- PAT mode uses the same tail (`github_backup_connect`).
- `remote_has_heads` probes whether the remote already has content, so the UI can choose between push and restore.
- **Keychain** (`core/git_credentials.rs`):
  - `keyring` crate, service `skills-manager-git-backup`, keyed by host, stores `{username, password}`
  - **Tokens are never stored in URLs on disk.** `split_credentials_from_url` moves userinfo out of any pasted URL into the keychain.
  - System git receives credentials through a static askpass script (`<base>/git-askpass.sh`). The script only echoes `SKILLS_MANAGER_ASKPASS_*` environment variables that are set per call.
  - git2 receives them through a credentials callback capped at 2 attempts, because libgit2 otherwise loops on a bad token.
  - Errors are passed through `redact_urls_in_text`.
- **Arbitrary remote:** Settings accepts any HTTPS (PAT), SSH or self-hosted URL. SSH relies on the user's own agent and keys through system git.
- Disconnect has three levels: this machine only; revoke the GitHub authorization; delete the remote repo (through GitHub's confirmation page).

## 6. Upstream skill updates vs backup

- `core/skill_auto_updater.rs` / `update_git_skill_internal` rewrites the skill dir in the library. The file watcher sees the change, and **the update becomes an ordinary `"auto backup"` commit** after the debounce. Updates have no special status in the merge.
- If two devices auto-update the same skill to the same upstream revision, their content tree OIDs are equal, so `pick` sees no conflict.
- An upstream update on one device combined with a local edit on another is a whole-skill conflict.
- `source_revision` and `remote_revision` are **not** in `SkillMetaFile`; reindex keeps them from the local row. Inference, not verified: after pulling a peer's update, a device can still carry a stale revision and may re-report or re-apply the update.

## 7. Fragile areas / known bugs

- **#504 (open):** an interrupted restore on Windows with `git_backup_engine=git2` left `HEAD → refs/heads/.invalid`, and sync then failed permanently. Commit `fix(backup): keep the skills library out of git's reftable format` is related.
- **#553 (fixed 2026-10-17):** removing the last preset membership did not propagate, because git does not store the empty `scenario-skills/` dir, so the other device saw an "incomplete snapshot" and skipped the replace. This is a general hazard of directory-per-collection metadata.
- **#421 (fixed):** the app panicked on startup when `schema.json` existed but the `skills/` metadata was empty while skill dirs were present. Reindex refuses to wipe the library (`EmptySkillMetadata`).
- **#524 (open):** on/off deployment state is per machine; there is no idle or headless background pull; preset deploy only adds. A user works around this with a cron script that runs `sm git pull` plus deploy and undeploy.
- **#536 (closed) / commit #539:** Linux AppImage git children broke through libcurl symbol conflicts. Bundling or inheriting git environments is fragile.
- **#406 (open):** the `repo` scope is too broad; skill contents may contain secrets.
- Recent hardening commits (Oct 2026):
  - clone and re-clone never drop local skills or unpushed history
  - "set aside differing local versions"
  - reftable avoidance
  - `.pyc` untracking
  - tmp-file pruning
  - Python artifacts and atomic-write tmp files committed by older clients broke validation on other devices.
- The code is complex. The merge alone is about 4.7k lines, plus a protocol trailer, old-client detection, staging and pin refs, and crash replay. Much of it guards against the user or an older client touching the repo with plain git.

## Worth borrowing for AFK

1. **Make `~/.agents/skills` (or a sibling mirror) the git worktree, and keep a small JSON metadata namespace in the same repo.** Use one file per object (`skills/<id>.json`, `packs/<id>.json`, preferences), with a stable skill id rather than the folder name. AFK's settings.json `invocation` preferences and pack definitions would become per-object files that merge independently. Moving from a Drive-synced settings.json to this format would remove last-writer-wins across the whole file.
2. **Treat the DB/settings as a projection and rebuild it after every pull.** For AFK, the matching step is: after a pull, rerun the existing "reapply invocation preferences to SKILL.md/openai.yaml" pass (already done after install and update), plus Kit reconciliation.
3. **Per-skill 3-way component merge on the git merge-base:** content tree hash vs path vs attributes. On conflict, keep local and mark the skill "Needs attention", with keep mine / use remote / keep both. Taking a safety snapshot before any resolution makes every choice undoable. This could be built in Node with `git` plumbing (`merge-base`, `ls-tree`, `read-tree`, `commit-tree`) without libgit2.
4. **Newest-wins for small whole-file settings**, using committer time with the commit id as a tie-break. This suits pack definitions and preferences, where a conflict UI is overkill.
5. **Cadence:** about 2 minutes of trailing debounce on file-watch events, commit at exit, push at startup, a single Sync transaction that retries on a non-fast-forward rejection, and snapshot tags only on manual backups. Add an **idle periodic pull** as well, which is the gap #524 reports.
6. **Auth hygiene:** device flow without a client secret, find-or-create a private repo, keychain storage, credentials split out of pasted URLs, an askpass script fed by environment variables, and URL redaction in errors. Use a narrower scope than `repo` if a GitHub App or fine-grained token flow is feasible.
7. **Exclusions:** an auto-managed `.gitignore` section for oversized skills, never untracking a skill that is already tracked; ignore `__pycache__`, `*.pyc` and tmp files; prune tmp files before each commit.
8. **Clone-into-existing-library safety:** accept identical skills, merge local-only skills, and stop with a "set aside" list when same-named skills differ. This applies directly to AFK machines that already have skills installed through `npx skills add`.
9. **Keep machine wiring out of the repo:** agent paths, scope activation and symlink mode.

## Not worth borrowing (or defer)

- **Mixed-client protocol machinery:** protocol trailers, old-client detection, legacy line-merge fallback. AFK would ship one writer from day one. A version field in a schema file is enough.
- **Dual network engines** (system git plus a libgit2 pilot). They caused the #504 class of bug. Use system git only from Node.
- **Hidden pin refs and trailer replay as the conflict source of truth.** This makes sense for convergence across many devices, but a committed `.afk/conflicts/<id>.json`, or simply the local settings, is simpler at AFK's scale.
- **Treating upstream updates as ordinary edits.** For AFK, skills installed by `npx skills add` are reproducible from their source. Consider committing only a lock or manifest of source plus revision for registry skills, and full content only for local or authored skills. Updates then become a small manifest diff and do not conflict with local edits. This also avoids the stale `source_revision` problem.
- **A "tools" (installer shell commands) equivalent:** Skills Manager has none. AFK tools stay machine-run, and only their declarations should sync, never their outputs.
- **Directory-per-collection metadata without an explicit manifest.** Empty dirs vanish in git (#553). Prefer one manifest file per collection, or an explicit `schema.json` listing which collections are complete.
