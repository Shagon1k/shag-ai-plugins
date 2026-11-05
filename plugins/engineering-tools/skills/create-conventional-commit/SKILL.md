---
name: create-conventional-commit
description: Prepare and create a Conventional Commit from staged changes. Use when the user asks to commit or to write or validate a commit message. Always requires explicit confirmation before git commit. Not for push, amend, or history rewrites.
user-invocable: true
disable-model-invocation: false
---

# Create Conventional Commit

Never run `git commit` without `y` in step 6. Never use `git add -A`, `git add .`, or `-a`;
stage only user-approved paths with `git add -- <paths>`.

## 1 — Gather state

- `git rev-parse --show-toplevel`: fails: say "Not a git repository." and stop. Run all
  later commands from this root.
- `git rev-parse --verify --quiet HEAD`: non-zero exit means no commits; skip all `git log`.
- `git status --porcelain=v1`: `XY <path>`; `X` staged, `Y` working tree.
- `git diff --staged --stat`, then `git diff --staged`.
- `git branch --show-current`.

## 2 — Decide what to commit

1. Unmerged entries (`U` in either column, `AA`, `DD`): output "Resolve merge conflicts first."
   and stop.
2. Nothing staged (`git diff --staged --quiet` exits 0): if status is empty, output "Nothing to
   commit." and stop; otherwise list changed paths and ask which to stage; none chosen: stop.
3. Partially staged files (`MM` and similar): ask "Stage the rest too? (yes / no)".
4. Unstaged or untracked (`??`) files tied to the staged change by content, imports, or
   references (not proximity), not already asked about: list them and ask "These look related.
   Stage them too? (yes / no / pick paths)".
5. Never offer ignored or secret-like files (`.env*`, keys, credentials). Staged ones: show paths;
   ask to unstage (`git restore --staged -- <path>`; without `HEAD`, `git rm --cached -f -- <path>`)
   or stop.
6. Unrelated changes mixed: ask whether to commit together or stop to split.

After any `git add`, repeat steps 1–2. Then run `git diff --staged --check`; on failure, show
its output and stop. Fix only if asked.

## 3 — Read repository conventions

Configuration beats history; history beats defaults.
- Configuration (commitlint, commitizen, `CONTRIBUTING*`, agent instructions): types, scopes,
  header length, case.
- History (needs `HEAD`): `git log --format=%s -20 -- <staged paths>`; use it for scope and
  case only when those subjects follow Conventional Commits.

## 4 — Choose type and scope

**Type** (lowercase): configured list, else `feat`, `fix`, `docs`, `style` (formatting), `refactor` (no
behavior change), `perf`, `test`, `build` (build, dependencies), `ci`, `chore` (other
maintenance), `revert` (footer `Refs: <sha>`). Pick the primary effect: `feat` or `fix` outranks supporting tests, docs, or
refactoring. If two fit equally, ask the user, recommending one.

**Scope** (optional noun), first that applies:

1. Configured scope matching the staged paths; none matches but scope required: ask.
2. A scope used by most step 3 history subjects.
3. The module or package holding all staged files, in kebab-case; never `src` or `lib`.
4. None. If several fit equally, omit it and list them in step 6.

## 5 — Write the message

```text
<type>[(<scope>)][!]: <description>

[body]

[footers]
```

- **Header**: imperative ("add", not "added"), lowercase unless conventions or proper nouns
  differ, no trailing period, ≤ 72 characters or the configured limit.
- **Body**: only when the reason is not obvious; why, not the diff. Wrap at 72.
- **Footers**: `<Token>: <value>` or `<Token> #<value>`; tokens use `-` for spaces
  (`Reviewed-by`) except `BREAKING CHANGE`.
- **Breaking change** (incompatible API or behavior), any type: `!` and footer `BREAKING CHANGE: <what breaks, how to migrate>` (uppercase; `BREAKING-CHANGE` is
  equivalent).
- **Issues**: `Refs #<n>` only for an issue ID from the branch name or user; `Closes #<n>` only
  if the user says it resolves it.

Separate header, body paragraphs, and footers with one blank line. Mention tests only if run.

## 6 — Confirm

Show the message in a code block, staged files, and scope alternatives:

> Commit with this message? **(y / edit / c)**

- `y`: go to step 7.
- `edit` or requested changes: revise, ask again.
- `c`: output "Cancelled." and stop; run no more git commands.
- Anything else: ask again.

## 7 — Commit

Pass the message on stdin, not `-m`:

```bash
git commit --cleanup=whitespace -F - <<'COMMIT_MSG'
<confirmed message, verbatim>
COMMIT_MSG
```

Without a POSIX shell, use `-F <file>` with a temporary file outside the repository, then delete it.

- Commit-msg hook rejects the message: fix the reported rule and return to step 6.
- Other failure: show output, stop; `--no-verify` only if the user asks.
- Success: report `git log -1 --format='%h %s'` and any `git status` changes made by hooks.
