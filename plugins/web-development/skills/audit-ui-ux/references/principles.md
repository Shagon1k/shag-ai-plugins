---
audience: ai
---

# UX principles guidebook

Durable rules for the `flow`, `visual`, and `content` lenses. Accessibility criteria live in
[accessibility.md](accessibility.md). Cite rule IDs in a finding's `principle`.

Each rule gives the expectation, the signs of a violation to look for, and its source. The
signs are prompts, not a checklist to recite. Report only instances you observed.

A rule tells you when something is wrong. It does not tell you what would be distinctive or
delightful; record those ideas as `suggestion` findings, never as defects.

Sources: NN/g = Nielsen's 10 usability heuristics; GOV.UK = GOV.UK Design System and Service
Manual; Laws of UX = lawsofux.com summaries of established research; WCAG = WCAG 2.2.

## Flow and interaction (FL)

**FL-01 System status is always visible.** Every action produces feedback the user can see.
Look for: clicks with no visible response; work over about 1 second without a progress
indicator; work over about 10 seconds without progress, an estimate, or a way to continue
elsewhere; background saves with no saved state. *NN/g 1; Nielsen response-time limits.*

**FL-02 Location and next step are evident.** The user can tell where they are, what this
screen is for, and what to do next. Look for: no page title or active navigation state;
several equally loud actions where one is primary; multi-step processes without a step
indicator or a way to see what remains. *NN/g 1, 6.*

**FL-03 Users stay in control.** Every path has a way back or out. Look for: dead ends;
browser Back that loses work or exits a flow unexpectedly; dialogs without a cancel or
close; irreversible actions without undo or confirmation; prefer undo over confirmation
for frequent actions. *NN/g 3.*

**FL-04 Errors are prevented.** The interface makes the wrong action hard. Look for:
free-text where a constrained control fits; missing sensible defaults; destructive actions
next to frequent ones; disabled options with no explanation; formats the user must guess.
*NN/g 5.*

**FL-05 Recognition over recall.** Users never need to remember information between steps.
Look for: needing a code, ID, or value from an earlier screen; options hidden until typed;
no recent or suggested items where they would help; context lost when a panel opens.
*NN/g 6.*

**FL-06 Errors are recoverable.** When something fails, the user learns what happened and
keeps their work. Look for: input cleared after an error; messages only in a disappearing
toast; errors far from their cause; no retry for transient failures; generic "Something
went wrong". *NN/g 9; GOV.UK error message pattern; WCAG 3.3.1, 3.3.3.*

**FL-07 Consistency and conventions.** The same thing looks, behaves, and is named the same
everywhere, and common patterns work the way users expect from other products. Look for:
one action with two names or styles; custom controls that break platform behavior; links
that behave like buttons and buttons that navigate. *NN/g 4; Laws of UX: Jakob's law.*

**FL-08 No needless friction.** Every step, field, and confirmation earns its place. Look
for: repeated entry of the same information; forced account creation before value; questions
whose answers the product never uses; confirmations for reversible actions; more clicks
than the task's decisions require. *GOV.UK question protocol; WCAG 3.3.7.*

**FL-09 Actions are discoverable.** Interactive things look interactive and important
actions are visible. Look for: primary actions hidden in overflow menus or hover-only
reveals; text that looks like a link but is not, or the reverse; icon-only controls without
labels for uncommon actions; gestures with no visible alternative. *Norman, signifiers;
NN/g 6.*

**FL-10 Behavior is predictable.** A control does what its label promises and nothing more.
Look for: focus or input that triggers navigation or submission; a button whose result
differs from its label; settings that apply silently or not at all. *WCAG 3.2.1, 3.2.2.*

**FL-11 Every state is designed.** Empty, loading, error, partial, many-items, offline, and
no-permission states exist and help. Look for: blank areas while loading; empty lists with
no explanation or next action; tables that break with 500 rows; unavailable actions that
silently fail. *NN/g 1, 9.*

**FL-12 Choices are manageable.** The number and arrangement of options fit the decision.
Look for: long flat lists of equal options; all settings shown at once where progressive
disclosure would help; no default for a common choice. *Laws of UX: Hick's law, choice
overload.*

**FL-13 Targets fit their importance.** Frequent and primary targets are large and close to
where attention is; destructive targets are separated. Look for: small primary buttons on
mobile; critical actions out of thumb reach; Delete adjacent to Save. *Laws of UX: Fitts's
law.*

**FL-14 Experts are not slowed down.** Frequent users have accelerators that do not burden
novices. Look for: no bulk action where users repeat one item at a time; no keyboard path
in a keyboard-heavy tool; no way to skip repeated onboarding. *NN/g 7.*

**FL-15 Forms are easy to complete.** Look for: multi-column layouts for sequential fields;
placeholder text used as the label; required fields marked inconsistently (GOV.UK marks the
optional ones); missing `type`, `inputmode`, or `autocomplete`; validation on every
keystroke; field size that misrepresents expected length. *GOV.UK forms; WCAG 1.3.5, 3.3.2.*

**FL-16 Wayfinding survives navigation.** Look for: filters, tabs, or pagination lost on
Back or reload; URLs that cannot be shared to reach the same view; scroll position lost on
return to a list. *NN/g 3, 6.*

**FL-17 The interface is stable.** Content does not move under the user. Look for: layout
shift as images, ads, or fonts load; buttons that move as the user aims; spinners for
instant actions; optimistic updates that silently roll back. *Core Web Vitals CLS.*

**FL-18 Interruptions are justified.** Look for: modals for non-blocking information;
stacked dialogs; cookie, chat, and promo overlays covering the task; toasts carrying the
only copy of critical information or disappearing too fast to read. *NN/g 8; WCAG 2.2.1.*

## Visual design (VI)

**VI-01 Hierarchy matches importance.** The most important element on each screen gets the
most attention, and scan order follows task order. Look for: competing focal points;
secondary metadata louder than primary content; the primary action visually equal to the
secondary one. *Gestalt focal point; NN/g 8.*

**VI-02 Spacing encodes grouping.** Related items sit closer together than unrelated ones,
and spacing follows a consistent scale. Look for: labels nearer to the wrong field; equal
gaps everywhere so nothing groups; arbitrary one-off spacing values. *Gestalt proximity,
common region.*

**VI-03 Elements align.** Shared edges and a grid make structure readable. Look for: near-miss
alignments of a few pixels; mixed centered and left-aligned text in one block; columns that
drift between sections.

**VI-04 Typography is readable and structured.** Look for: body text below 16 px on the web
without a strong reason; lines longer than about 80 characters; tight line-height on body
text; more than a few type sizes without a clear scale; long passages in all caps; weight
used inconsistently for hierarchy. *Bringhurst, The Elements of Typographic Style.*

**VI-05 Color has consistent meaning.** Look for: the accent color used for both actions and
decoration; danger or success colors used decoratively; too many accent colors to learn;
state communicated by color alone (see WCAG 1.4.1).

**VI-06 Structure without noise.** Borders, dividers, shadows, and backgrounds encode real
structure. Look for: a card with border, shadow, and tinted background at once; dividers
between already separated groups; decoration that competes with content. *frontend-design:
visual structure is information.*

**VI-07 One visual system.** Radii, icon style and size, button styles, elevation, and
spacing come from one coherent set. Look for: three button styles for one role; mixed
outline and filled icon sets; one-off radii; deviations from the project's design tokens.

**VI-08 Controls look like what they are.** Look for: buttons indistinguishable from labels;
disabled states that look enabled or are unreadable; selected and unselected states that
differ only subtly; links without any distinguishing style in body text.

**VI-09 Density fits the task.** Operational tools can be dense; first-use and marketing
surfaces need room. Look for: data tools that waste space and force scrolling; onboarding
screens packed with controls.

**VI-10 Layout adapts, not just shrinks.** Look for: overlap or clipping; horizontal scroll;
desktop tables squeezed onto mobile; content order on mobile that buries the primary task;
hover-only affordances on touch.

**VI-11 Truncation keeps meaning.** Look for: names, paths, or IDs truncated at the end when
the distinguishing part is at the end; no way to see the full value; truncation that hides
the only differing part of similar items.

**VI-12 Icons and images earn their place.** Look for: unlabeled icons whose meaning is not
conventional; images that push the task below the fold without adding information;
distorted aspect ratios; mixed illustration styles.

**VI-13 Motion explains change.** Look for: animation that delays the task; entrance effects
on every section; transitions longer than about 300 ms for routine UI; motion that ignores
`prefers-reduced-motion`. *frontend-design; WCAG 2.3.3 (AAA) as best practice.*

**VI-14 Themes have parity.** Look for: dark theme with lost borders, unreadable states, or
images and logos with light-only backgrounds.

## Content (CO)

**CO-01 Speak the user's language.** Look for: internal or technical terms where users have
their own word; system states exposed raw ("null", error codes, enum values). *NN/g 2.*

**CO-02 Action labels say what happens.** Use a verb and object, and keep the same name
through the flow: a "Publish" button leads to a "Published" confirmation. Look for: "Submit",
"OK", or "Continue" where the outcome is specific; a button and its confirmation that use
different words. *frontend-design; GOV.UK buttons.*

**CO-03 Error messages help.** Say what happened and how to fix it, in plain words, near the
cause. Look for: blame ("You entered an invalid…"); vague text ("Invalid input"); apologies
in place of information; codes without explanation. *GOV.UK error messages.*

**CO-04 Empty states direct.** Explain why it is empty and offer the next action. Look for:
"No data"; empty states that look like loading or errors.

**CO-05 Text is scannable.** Front-load key words in headings, links, and buttons; keep one
idea per sentence. Look for: headings that start with filler; walls of text where a list
fits; important conditions buried mid-paragraph. *NN/g F-pattern research.*

**CO-06 One term per concept.** Look for: the same thing called "project", "workspace", and
"space" on different screens; one word meaning two things.

**CO-07 Tone and case are consistent.** Look for: mixed sentence and title case; jokes in
error or payment states; tone that does not fit the audience or the product summary.

**CO-08 Formats fit the locale.** Look for: ambiguous dates such as 03/04; numbers without
units or with inconsistent separators; relative times with no way to see the absolute time;
currency without a symbol or code.

**CO-09 Instructions come before the action.** Look for: format requirements revealed only
by an error; help hidden in tooltips for required information; placeholder text as the
only instruction. *GOV.UK hint text; WCAG 3.3.2.*

**CO-10 Links make sense out of context.** Look for: "click here", "read more", or several
identical link texts pointing to different places. *WCAG 2.4.4.*
