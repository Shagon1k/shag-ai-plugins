# Architecture Decision Records

> Durable record of significant architecture decisions and why they were made.
> `ARCHITECTURE.md` describes the current system; `ROADMAP.md` tracks unresolved or deferred work.

## Template Setup

Complete this section with the developer before using the file as project guidance, then
delete the entire section.

1. Ask for existing architecture notes, diagrams, code, provider constraints, and prior
   decisions before asking detailed questions.
2. Extract decisions already supported by those sources, then ask only for missing context,
   alternatives, consequences, or approval status.
3. Create an ADR only for a significant, durable choice with meaningful alternatives or
   consequences. Do not record routine implementation details.
4. Assign sequential IDs (`ADR-001`, `ADR-002`, ...). Never reuse or renumber an ID.
5. Add every record to the index and duplicate the record block below as needed.
6. Remove all setup instructions, unresolved placeholders, examples, and unused optional
   `Follow-up` or `References` fields from the final file.

This template starts as one compact registry. Split it into an index plus one file per ADR
only when it becomes difficult to scan or concurrent edits cause conflicts.

## Statuses

| Status | Meaning |
| --- | --- |
| `Proposed` | A concrete decision is under review and is not yet current direction. |
| `Accepted` | The developer approved the decision; it is current direction. |
| `Rejected` | The proposal was explicitly declined; preserve the rationale for future context. |
| `Superseded` | A newer ADR replaced the decision; link the replacement. |

An accepted ADR is a historical record. Do not rewrite it to describe a later choice; create
a new ADR and mark the old one `Superseded by ADR-<NNN>`.

## Index

| ID | Decision | Status |
| --- | --- | --- |
| `ADR-<NNN>` | `<Short decision title>` | `<Proposed / Accepted / Rejected / Superseded by ADR-<NNN>>` |

---

## ADR-<NNN>: <Short Decision Title>

**Date:** <YYYY-MM-DD><br>
**Status:** <Proposed / Accepted / Rejected / Superseded by ADR-<NNN>>

### Context

<Describe the problem, relevant constraints, and why a decision is needed now.>

### Options Considered

- **<Option A>:** <Key benefit and trade-off.>
- **<Option B>:** <Key benefit and trade-off.>

### Decision

<State the selected option and its intended scope unambiguously.>

### Consequences

- **Benefits:** <What becomes easier or possible.>
- **Trade-offs / risks:** <Costs, limitations, dependencies, or operational burden.>
- **Follow-up (optional):** <Required implementation, migration, documentation, or verification work.>

### Revisit When

- <Concrete condition that would justify reconsidering this decision.>

### References (optional)

- <Relevant architecture section, issue, benchmark, design, or external source.>

---
