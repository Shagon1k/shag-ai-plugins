# Code Style Rules

## Template Setup

Render this file to `<RULES_DIR>/code-style.md` and link it from the `AGENTS.md` Rule Index.
Keep only rules the project adopts; delete this section, placeholders, and rows that do not
apply. Record each exception the developer approves in the Exceptions section.

## Principles

- Write the obvious version. If a reader needs a comment to follow the control flow, simplify the
  code instead.
- A name reveals intent: why the thing exists, what it does, and how it is used. If a name needs a
  comment, rename it.
- One word per concept, one concept per word. Use the product's domain terms exactly as the
  Roadmap defines them.
- Prefer pronounceable, searchable names. Short names belong only to short scopes.

## Naming

| Element | Rule | Example |
| --- | --- | --- |
| Boolean variable or parameter | Reads as a question: `is`, `are`, `has`, `can`, `should`, `was`, `did`, `will`, `with`; a boolean constant too | `isOpen`, `hasDeadlineChanged`, `withDetails` |
| Function or method, including controller handlers | Verb phrase: `get`/`find`/`list` read, `build`/`create` make, `to`/`format` convert, `assert` throws | `getClubPermissions`, `listPending` |
| Class, type, component | Noun phrase | `SessionRoster`, `ClubSummary` |
| Module-level literal constant or fixed lookup table | `UPPER_SNAKE_CASE`; objects built for a library call stay camelCase | `MAX_SUGGESTIONS`, `HTTP_STATUS` |
| Collection | Plural noun without a type suffix | `members`, not `memberList` |
| Callback parameter | The singular of the collection | `members.map((member) => member.name)` |
| UI event handler | `handleX` where it is defined, `onX` where it is received | `handleSubmit`, `onSubmit` |
| UI state setter | `set` + the state name | `[isOpen, setIsOpen]` |
| Private member | The language's privacy feature, never a `_` prefix | `private readonly client` |

- Single-letter names are only loop counters, sort comparator pairs (`a`, `b`), and `_` for an
  unused position.
- Names keep their source: destructured values keep the property name, API and database fields keep
  the contract's names, and component props that mirror DOM or UI-library props keep those names
  (`open`, `disabled`). Framework-required names (`useX` hooks, route files) are exempt.
- Rename through the language's tooling, not text replacement, so references and shorthand
  properties stay correct.

## Numbers and Literals

- A number inside logic gets a name as a module-level constant. Constant initializers may hold
  arithmetic and schema limits (`7 * DAY_MS`, `.max(200)`); 0, 1, 2, default values, enum members,
  and type positions are exempt.
- Take a limit the shared schema already owns from that schema's exported constant instead of
  repeating it in a form or handler.
- Group related values by meaning (`ACCESS_LOST_STATUSES`) instead of repeating literal lists.
- String literals checked by a union or enum type may stay inline; the type already catches a typo.
- Tests keep literal expectations.

## Functions and Files

- One responsibility per function and file. Split a file past `<MAX_FILE_LINES>` lines and a function past
  `<MAX_COGNITIVE_COMPLEXITY>` cognitive complexity; pass an object past `<MAX_PARAMS>` parameters.
- Keep lines within `<MAX_LINE_LENGTH>` characters; the formatter owns wrapping.
- Keep side effects at the edges: I/O and persistence in services or handlers, pure functions for
  rules, mapping, and formatting. When steps must run in order, wrap the sequence in one function
  that owns it (pass the work as a callback) instead of relying on callers to call them in order.
- Compare with strict equality, return early instead of `else` after `return`, and prefer
  template strings and object shorthand.
- Validate data once, where it enters: request bodies and parameters, form and action arguments,
  provider responses, files. Inside the system, trust the shared contract types instead of parsing
  your own API responses or database rows again; keep a parse only where stored data can outlive
  its shape (a cache row) or right before a security-sensitive use (an outbound URL).

## Comments

- Comment why, not what. Keep legal notices, informative comments (a format, unit, or protocol
  fact), intent, and warnings about consequences.
- Delete noise, redundant narration, journaling, closing-brace labels, and commented-out code.
- Track later work as an Issue in the project's tracker rather than an untracked `TODO`.

## Exceptions

| Exception | Reason |
| --- | --- |
| `<name or pattern>` | `<why the rule does not apply>` |

## Enforcement

| Rule | Enforced by |
| --- | --- |
| `<rule>` | `<lint rule, formatter, type-check, or review>` |

Warnings fail the lint. A rule that tooling cannot check is a review item, not a suggestion.
