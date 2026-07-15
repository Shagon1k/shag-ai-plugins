---
name: conventional-commit
description: Prepare and create a Conventional Commit from staged changes. Use when the user asks to commit, generate a commit message, or validate staged commit scope. Detects related unstaged work, handles repositories without prior commits, and always requires explicit confirmation before running git commit.
---

# Conventional Commit

Run immediately in parallel:

- `git status --short`
- `git diff --staged --stat`
- `git diff --staged`
- `git branch --show-current`
- `git rev-parse --verify HEAD` followed by `git log --oneline -10` only when `HEAD` exists

## 1 — Nothing staged

If `git diff --staged` is empty: output "Nothing staged. Run `git add` first." and stop.

## 2 — Partial staging check

From `git status --short`, find:

- unstaged tracked files: lines where the first character is a space and the second is `M`, `D`,
  or `A` (for example, ` M path/to/file`);
- untracked files: lines beginning with `??`.

If any exist, check whether they belong to the same feature, module, or logical unit as the staged
changes. Do not infer relation from proximity alone. If they look related, list them and ask:

> These files look related to your staged changes:
>
> - `<path>`
>   Stage them too? (yes / no)

If yes: `git add <files>`, then re-run status, staged stat, and staged diff. If no, or none are
related: continue silently. Never stage ignored files, secrets, or unrelated changes.

## 3 — Infer scope

Apply first match from staged file paths:

| Condition                                                                         | Scope               |
| --------------------------------------------------------------------------------- | ------------------- |
| All under `frontend/`                                                             | `frontend`          |
| All under `backend/`                                                              | `backend`           |
| Mixed `frontend/` + `backend/`                                                    | _(none)_            |
| Only root config files (`docker-compose*`, `.gitlab-ci*`, `Dockerfile*`, `.env*`) | `infra`             |
| Only `_docs/` or `notes/`                                                         | `docs`              |
| All under a single named subdirectory                                             | that directory name |
| Otherwise                                                                         | _(none)_            |

## 4 — Generate message

**Type** — pick one:

| Type       | When to use                                                      |
| ---------- | ---------------------------------------------------------------- |
| `feat`     | New feature                                                      |
| `fix`      | Bug fix                                                          |
| `chore`    | Maintenance (deps, configs) — no production code behavior change |
| `docs`     | Documentation only                                               |
| `refactor` | Code restructuring, no behavior change                           |
| `test`     | Tests only                                                       |
| `perf`     | Performance improvement                                          |
| `build`    | Build system or external dependencies                            |
| `ci`       | CI/CD configuration                                              |
| `style`    | Formatting/whitespace, no code change                            |

**Subject line**: `<type>(<scope>): <imperative description>`

- Max 72 chars total
- Imperative mood — "add", not "added" or "adds"
- Lowercase, except proper nouns (e.g. `fix(Stripe): ...`)
- No trailing period
- Omit `(<scope>)` when no scope applies

**Body**: include only when the _why_ is not obvious from the subject. Blank line before body. Wrap at 72 chars. Do not restate the diff.

**Footer**:

- `BREAKING CHANGE: <description>` — if public API is removed, renamed, or behavior changes incompatibly
- `Closes #N` — if an issue number appears in the current branch name or recent log

## 5 — Validate the staged patch

Run `git diff --staged --check`. If it reports whitespace errors, conflict markers, or another
mechanical problem, show the relevant paths and stop before proposing a commit. Do not modify the
staged patch unless the user asks.

Do not claim tests passed unless they were run in the current work. A commit-message request does
not itself authorize unrelated fixes or dependency changes.

## 6 — Present and confirm

Show the message in a code block. Then ask exactly:

> Ready to commit, or cancel? **(y / c)**

**y** — commit with message:

```bash
git commit -m "<subject>"
# Add another -m argument for a body or footer when present.
```

**c** — output "Cancelled." and stop. Do not run any git command.
