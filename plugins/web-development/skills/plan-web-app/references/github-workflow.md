# Optional GitHub Work Tracking

Use this branch only when the repository is hosted on GitHub and the developer opts in. Keep the
core project-guidance setup independent of GitHub when they skip it.

## Select a Profile

During a full setup for a GitHub repository, offer one choice:

| Choice | Behavior |
| --- | --- |
| `Skip` | Do not create or change GitHub templates, Projects, or work-tracking rules. |
| `Standard` | Apply the standard profile below without another questionnaire. |
| `Customize` | Ask only for deviations from the standard profile. |

Default to `Skip` when the developer does not answer. Do not block the rest of the guidance setup.
For a focused update, enter this branch only when the developer asks for GitHub work tracking.

Allow the developer to run `Customize` later as a focused update. Inspect the existing `.github`
files, linked Projects, fields, views, and workflows first; preserve or merge useful existing
configuration instead of replacing it blindly.

## Standard Profile

### Repository files

Render these assets to their repository paths:

| Asset | Output |
| --- | --- |
| `assets/github/ISSUE_TEMPLATE/task.yml` | `.github/ISSUE_TEMPLATE/task.yml` |
| `assets/github/ISSUE_TEMPLATE/bug.yml` | `.github/ISSUE_TEMPLATE/bug.yml` |
| `assets/github/ISSUE_TEMPLATE/tech-debt.yml` | `.github/ISSUE_TEMPLATE/tech-debt.yml` |
| `assets/github/ISSUE_TEMPLATE/config.yml` | `.github/ISSUE_TEMPLATE/config.yml` |
| `assets/github/pull_request_template.md` | `.github/pull_request_template.md` |

Keep blank Issues disabled. Do not add labels, assignees, organization issue types, or a
`projects:` key unless the repository already establishes them or the developer requests them.
Use the Project auto-add workflow instead of relying on every Issue author having Project write
access.

Insert `assets/GITHUB_WORK_TRACKING.template.md` into the final `AGENTS.md`, resolve its Project
name and URL from verified state, and keep the wording in English. If remote provisioning remains
incomplete, describe the planned Project accurately without inventing a URL.

### GitHub Project

Use this default Project configuration:

| Setting | Standard value |
| --- | --- |
| Owner | Repository owner resolved from the GitHub remote |
| Title | `<Product Name> Delivery` |
| Visibility | Private unless the developer explicitly approves public visibility |
| Repository link | Target repository |
| Saved view | `Board`, using `Status` for columns |
| Visible work metadata | `Status`, `Priority` |
| Status options | `Backlog`, `In progress`, `Done`, `Won't do` |
| Priority options | `P0`, `P1`, `P2`, `P3` |
| Agent-created Issue defaults | `Backlog`, `P2` |
| Auto-add | Issues from the target repository; exclude pull requests |

Treat the Issue or pull request title as the item's identity, not as an additional planning field.
Use `Won't do` only as a terminal disposition chosen by the developer. Do not enforce a false
transition restriction: an item may be declined from `Backlog` or after entering `In progress`.

When the developer asks the agent to work on an existing tracked Issue, move it to `In progress`.
Move it to `Done` only after the requested completion evidence exists. Move it to `Won't do` only
after an explicit developer decision. Auto-added Issues created by other people may remain without
Priority until triage; do not add token-backed automation solely to force a default Priority unless
the developer requests it.

## Customize Mini-Questionnaire

Ask one grouped, gap-only set and state the standard answer beside each question. Ask only about
areas the developer wants to change:

1. Which Issue forms should be added, removed, renamed, or have different fields?
2. Should blank Issues remain disabled?
3. Should the Project owner, title, or visibility differ from the standard?
4. Should the Board name, layout, Status options, or default Status differ?
5. Should the Priority options, meanings, or default Priority differ?
6. Should the auto-add filter include a narrower Issue subset or pull requests?
7. Should the standard Issue/Project/ROADMAP ownership rules have any project-specific exception?

Do not re-ask unchanged standard choices. Keep `Status` and `Priority` as the only work metadata
fields unless the developer explicitly asks for more. Summarize the resulting custom profile in
the artifact plan before writing.

## Provision Remote State

Treat local repository writes and remote GitHub mutations as separate effects.

1. Resolve the GitHub host, repository, owner, and existing linked Projects from current evidence.
2. Inspect available authenticated GitHub capabilities and required Project authorization. Treat
   network reachability, authentication, and authorization scopes as separate checks.
3. Reconcile with an existing suitable Project before proposing a new one. Do not create a
   duplicate merely because its title differs.
4. Include every proposed remote mutation in the artifact plan and obtain explicit approval before
   executing it.
5. Create or align the Project, link the repository, configure the fields and options, save the
   Board view, show only the selected metadata, and enable the Issue-only auto-add workflow.
6. Prefer an available authenticated GitHub integration, official CLI/API, or authenticated browser
   capability. Inspect current command or tool help rather than relying on remembered syntax.
7. When one capability cannot configure views or workflows, complete the safe supported mutations,
   then provide the smallest exact manual step or use an available authenticated UI capability.
   Never claim the Project is fully configured without reading back its URL, fields, view, and
   workflow state.

Do not delete or replace an existing Project, field, option, view, workflow, Issue template, or pull
request template without separate approval for that destructive change.

## Ownership Boundary

- GitHub Issues own executable tasks, bugs, and technical-debt work.
- The linked GitHub Project owns operational Status and Priority.
- Pull requests own implementation review, verification evidence, and Issue closure linkage.
- `ROADMAP.md` owns product scope, delivery phases, milestones, and product-level deferred work.
  Do not mirror routine Issues into it.
- Update `ROADMAP.md` only on an explicit developer request. If requested work conflicts with its
  documented scope or phases, report the conflict and ask for direction instead of silently
  rewriting the Roadmap.
