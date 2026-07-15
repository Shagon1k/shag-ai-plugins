# <Project Name> - Design Reference

> Current UI/UX direction, design-system status, and screen behavior contracts.
> Keep exact values and implementation rules in their canonical design or code sources.

| Document owner | Last reviewed |
| --- | --- |
| `<owner>` | `<YYYY-MM-DD>` |

## Template Setup

Complete this section with the developer before using the file as project guidance, then
delete the entire section.

### Source-first setup

1. Ask the developer to share any existing vision and assets before asking detailed
   questions: design files or MCP access, screenshots, HTML prototypes, reference sites,
   brand assets, existing code, and written notes.
2. Inspect the available sources and prefill every decision they establish.
3. Identify conflicts, missing behavior, and uncertain assumptions.
4. Ask one grouped set of questions only for the remaining gaps. Do not make the developer
   repeat information already present in a source.
5. Choose an appropriate level of detail. A project may begin with minimal direction,
   partial guidance, or a detailed external design system.

If the project has minimal design direction, propose a suitable UI-library or platform
baseline, mark it `Draft`, and get developer approval before substantial styled UI work.

### Setup choices

| Item | Project value |
| --- | --- |
| Design maturity | `<minimal / partial / detailed>` |
| Initial visual baseline | `<UI library defaults / custom direction / existing design source>` |
| Target devices | `<desktop / mobile / tablet / responsive combination>` |
| Input methods | `<mouse / keyboard / touch / other>` |
| Supported locales | `<locales or single-language>` |
| Accessibility target | `<standard or project baseline>` |
| Roadmap | `<ROADMAP_PATH>` |
| Architecture reference | `<ARCHITECTURE_PATH>` |
| Frontend design rules | `<DESIGN_RULES_PATH>` |

Remove all setup instructions, unresolved placeholders, examples, and rows that do not
apply. Move unresolved but relevant choices to the Design Decision Log. Do not preserve
empty sections merely because they exist in the template.

## 1. Design Contract & Sources

<!-- State what this document owns and where adjacent concerns live. -->

- **This document owns:** experience direction, visual foundations, interaction patterns,
  screen behavior, and design implementation/QA status.
- **Roadmap owns:** product scope, delivery phases, priorities, and backlog.
- **Architecture owns:** system boundaries, data, APIs, infrastructure, and technical
  decisions.
- **Design and code sources own:** exact token values, component implementation, and the
  latest inspectable visual state.

When sources disagree, use the source marked authoritative for that concern. If multiple
sources claim authority for the same concern, do not guess: ask the developer to choose and
record the resolution in the Design Decision Log.

### Design sources

Use any combination of sources. A visual reference does not automatically define production
architecture or responsive behavior.

| Source | Location / access | Authoritative for | Limitations / notes |
| --- | --- | --- | --- |
| Design tool / Figma MCP | `<file, URL, or frame IDs>` | `<visual system, screens, prototypes>` | `<coverage or access limits>` |
| Screenshots / images | `<paths or URLs>` | `<visual reference>` | `<missing states, behavior, or viewport context>` |
| HTML prototype / template | `<path or URL>` | `<layout, content, or interaction>` | `<throwaway code or unsupported behavior>` |
| Existing application / code | `<path or URL>` | `<current behavior or implementation>` | `<legacy or incomplete areas>` |
| Brand assets | `<path or URL>` | `<logo, imagery, iconography, fonts>` | `<usage or licensing limits>` |
| Written direction / references | `<path, URL, or summary>` | `<intent, tone, selected references>` | `<open interpretation>` |

### Status legend

| Dimension | Values | Meaning of completion |
| --- | --- | --- |
| Design | `None` / `Draft` / `Approved` | `Approved` means the developer accepted the direction. |
| Build | `Not started` / `Partial` / `Done` | `Done` means the documented contract exists in the current implementation. |
| QA | `Not checked` / `Passed` / `Issues` | `Passed` requires recorded evidence against the authoritative source and applicable baselines. |

## 2. Experience Direction

Keep this brief. For a design-light project, a few concrete bullets are enough.

- **Primary users:** <Who uses the product and in what context?>
- **Core experience:** <What should feel especially easy, clear, or valuable?>
- **Visual character:** <Neutral, operational, playful, editorial, premium, etc.>
- **Content voice:** <Concise, reassuring, technical, conversational, etc.>
- **UX non-goals:** <Experiences or conventions the product deliberately avoids.>

### Design principles

| Principle | Practical consequence |
| --- | --- |
| `<Principle>` | `<How it changes UI decisions>` |
| `<Principle>` | `<How it changes UI decisions>` |
| `<Principle>` | `<How it changes UI decisions>` |

## 3. Foundations

Record intent, canonical location, and status. Do not duplicate complete token catalogs here.
Before substantial styled UI work, color, typography, spacing/layout, and responsive strategy
must have at least a draft contract and a canonical destination.
Choose one canonical exact-value source per foundation; treat other sources as references or
sync targets rather than competing truth.

| Area | Intent / usage contract | Canonical source | Design | Build | QA |
| --- | --- | --- | --- | --- | --- |
| Color and themes | `<semantic roles, theme strategy>` | `<design variables or token file>` | `<status>` | `<status>` | `<status>` |
| Typography | `<display, heading, body, label roles>` | `<design variables or typography file>` | `<status>` | `<status>` | `<status>` |
| Spacing and layout | `<scale, containers, grid>` | `<token or layout source>` | `<status>` | `<status>` | `<status>` |
| Breakpoints and responsive behavior | `<target widths and adaptation strategy>` | `<token or rule source>` | `<status>` | `<status>` | `<status>` |
| Radii, borders, and elevation | `<surface hierarchy>` | `<token source>` | `<status>` | `<status>` | `<status>` |
| Iconography | `<library, style, sizing>` | `<asset or rule source>` | `<status>` | `<status>` | `<status>` |
| Imagery and illustration | `<purpose, style, asset rules>` | `<asset or design source>` | `<status>` | `<status>` | `<status>` |
| Motion | `<feedback, duration, reduced-motion approach>` | `<token or rule source>` | `<status>` | `<status>` | `<status>` |

### Experience baselines

| Area | Project contract | Canonical source |
| --- | --- | --- |
| Accessibility | `<keyboard, focus, semantics, contrast, target size>` | `<rule or checklist>` |
| Localization | `<locales, text expansion, date/number formats, RTL if relevant>` | `<i18n rule or guide>` |
| Content overflow | `<wrapping, truncation, dynamic content policy>` | `<rule or component guidance>` |
| Input and device support | `<mouse, keyboard, touch, hover assumptions>` | `<rule or QA matrix>` |

## 4. Experience Structure

The Roadmap route map owns product scope. This section records how users experience the app
shell and how important workflows move between views.

### App shells and navigation

| Context | Shell / navigation | Responsive behavior | Source |
| --- | --- | --- | --- |
| `<public / authenticated / admin / other>` | `<header, sidebar, tabs, footer>` | `<adaptation>` | `<source>` |

### Key user flows

Include only workflows that cross multiple views or contain non-obvious branches. Use a
compact Mermaid diagram or short ordered flow. Remove this subsection when none are needed.

```text
<entry> -> <primary steps> -> <success outcome>
                  \-> <error or alternate outcome>
```

## 5. Screens & States

### Screen coverage

| Route / view | Purpose | Primary design source | Design | Build | QA |
| --- | --- | --- | --- | --- | --- |
| `<route or view>` | `<user outcome>` | `<frame, screenshot, prototype, or written spec>` | `<status>` | `<status>` | `<status>` |

### Detailed screen specifications

Add a block only when source artifacts do not fully communicate behavior. Duplicate this
block for each screen that needs clarification; otherwise remove the subsection.

#### `<Route / Screen Name>`

- **Purpose:** <User outcome.>
- **Access / context:** <Who sees it and under what conditions?>
- **Primary action:** <Main user action and result.>
- **Structure:** <Sections in reading or task order.>
- **Responsive behavior:** <How structure and navigation adapt.>
- **Source:** <Design frame, screenshot, HTML prototype, or other reference.>

| State | Trigger | Expected UI and recovery |
| --- | --- | --- |
| Default | `<trigger>` | `<expected UI>` |
| Loading | `<trigger>` | `<progress and interaction behavior>` |
| Empty | `<trigger>` | `<message and useful next action>` |
| Error | `<trigger>` | `<clear failure and recovery action>` |
| Unauthorized / unavailable | `<trigger>` | `<redirect, explanation, or alternative>` |
| Success | `<trigger>` | `<confirmation and next state>` |

Remove impossible states. Add validation, disabled, offline, destructive-confirmation, or
other states only when they materially apply.

## 6. Components & Patterns

### Component inventory

Track shared components whose visual or behavioral contract should be reused. Feature-local
components need an entry only when agents could otherwise recreate them inconsistently.

| Component | Purpose | Variants / states | Design or code source | Design | Build | QA |
| --- | --- | --- | --- | --- | --- | --- |
| `<Component>` | `<role>` | `<meaningful variants and states>` | `<source>` | `<status>` | `<status>` | `<status>` |

### Interaction patterns

| Pattern | Contract / expected behavior | Canonical source | Status |
| --- | --- | --- | --- |
| Forms and validation | `<timing, messages, submission behavior>` | `<source>` | `<status>` |
| Loading and progress | `<local/global feedback and long-running work>` | `<source>` | `<status>` |
| Empty and error states | `<tone, recovery, escalation>` | `<source>` | `<status>` |
| Notifications and feedback | `<toast, inline, inbox, email boundaries>` | `<source>` | `<status>` |
| Dialogs and overlays | `<when used, dismissal, focus behavior>` | `<source>` | `<status>` |
| Destructive actions | `<confirmation and reversibility>` | `<source>` | `<status>` |
| Permissions and unavailable actions | `<hide, disable, explain, or redirect>` | `<source>` | `<status>` |

## 7. Design Decision Log

Keep only design-facing decisions and questions here. Link technical decisions to the
architecture record and delivery timing to the Roadmap.

| ID | Area | Decision / question | Status | Rationale or next trigger | Source |
| --- | --- | --- | --- | --- | --- |
| `DES-001` | `<area>` | `<decision or open question>` | `<Open / Decided / Deferred / Superseded>` | `<why, owner, or revisit condition>` | `<source>` |

## 8. Design QA & Maintenance

| Check | Target / coverage | Evidence | Status |
| --- | --- | --- | --- |
| Source parity | `<screens/components compared with authoritative sources>` | `<link, screenshot, or notes>` | `<status>` |
| Responsive layout | `<required viewports and orientations>` | `<evidence>` | `<status>` |
| Keyboard and focus | `<critical flows and components>` | `<evidence>` | `<status>` |
| Accessibility | `<standard and automated/manual checks>` | `<evidence>` | `<status>` |
| Dynamic content | `<long text, empty data, errors, user content>` | `<evidence>` | `<status>` |
| Localization | `<locales and text expansion>` | `<evidence>` | `<status>` |
| Browser and input support | `<supported browsers/devices/input methods>` | `<evidence>` | `<status>` |

Update this document when an authoritative source changes, a screen or shared pattern is
added, implementation status changes materially, or design QA changes the accepted behavior.
Keep exact implementation details in code and rules; keep this file focused on design intent,
coverage, and status.
