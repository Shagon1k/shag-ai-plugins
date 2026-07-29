## Work Tracking

- This section overrides the generic documentation-impact workflow for routine task tracking.
- GitHub Issues are the canonical home for executable tasks, bugs, and technical-debt items. The
  linked [<GITHUB_PROJECT_NAME>](<GITHUB_PROJECT_URL>) owns operational Status and Priority.
- Create a new Issue only when the developer explicitly asks to add, record, or track a task or
  Issue. A routine implementation request does not implicitly authorize external Issue creation.
- Add every agent-created Issue to the linked Project with `Status: Backlog` and `Priority: P2`
  unless the developer specifies different values.
- When the developer asks to work on a tracked Issue, move it to `In progress`. Move it to `Done`
  only after the required completion evidence exists. Use `Won't do` only after an explicit
  developer decision.
- Link pull requests to their Issue with a closing keyword such as `Closes #123`.
- `ROADMAP.md` owns product scope, delivery phases, milestones, and product-level deferred work; it
  does not mirror routine Issues.
- Update `ROADMAP.md` only on an explicit developer request. If requested work conflicts with its
  documented scope or phases, report the conflict and ask for direction instead of silently
  rewriting the Roadmap.
