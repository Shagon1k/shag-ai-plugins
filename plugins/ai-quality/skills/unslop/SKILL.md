---
name: unslop
description: Default prose-quality pass for human-facing writing. When enabled, apply automatically to prose you draft or revise, even without an explicit request, to remove generic AI patterns and keep the voice direct, specific, and natural. Skip code, structured data, commands, citations, verbatim quotes, and wording that must remain exact.
user-invocable: true
disable-model-invocation: false
---

# Unslop

Apply this pass silently to every suitable prose passage. It always applies while the skill is
enabled. Preserve meaning and voice.

## Universal default

- **Fidelity.** Preserve facts, names, numbers, requirements, uncertainty, emphasis, and intent.
  Never invent evidence, benefits, opinions, reactions, or personal experience.
- **Scope.** Edit human-facing prose, including explanations, documentation, messages, and UI copy.
  In mixed content, edit only the surrounding prose.
- **Protected content.** Leave code blocks, inline code, commands, identifiers, URLs, citation
  syntax, structured data, and verbatim quotations unchanged. Preserve legal or otherwise required
  wording unless the user explicitly asks to rewrite it.
- **Restraint.** Keep deliberate repetition, jargon, formatting, humor, dialect, and punctuation
  when they serve the writing. Do not swap one artificial style for another.
- **Voice samples.** When the user provides their own writing sample, match its sentence length,
  diction, punctuation, paragraph openings, and transitions. Treat it as style evidence; do not
  copy its claims or quirks mechanically.
- **Delivery.** Return the requested answer, not a separate editing report. Explain changes only
  when asked.

## Rewrite

1. **Find the point.** Read the whole passage. Identify what the reader needs to know or do.
2. **Cut filler.** Remove throat-clearing, chatbot pleasantries, generic conclusions, and repeated
   ideas.
3. **State facts.** Replace vague importance, mood, or benefit claims with supported facts,
   mechanisms, examples, or instructions. If none exist, simplify or cut.
4. **Use plain words.** Prefer direct verbs and familiar language. Keep technical terms that are
   precise for the audience.
5. **Vary rhythm.** Mix sentence lengths naturally. Split sentences that require backtracking, but
   do not manufacture fragments, slang, or messiness to appear human.
6. **Break formulas.** Remove forced contrasts, trios, ranges, headings, and transitions. Keep them
   when the content genuinely needs them.
7. **Keep the voice.** Preserve the author's formality, confidence, dry humor, and intentional
   rough edges. Stable terminology beats synonym cycling.
8. **Audit once.** Check that every claim has the same scope and certainty, protected content is
   untouched, and no implied outcome became a new fact. Then stop.

## Patterns to catch

Treat these patterns as signals, not a word blacklist. Fix them only when they weaken the passage.

### Wordy framing

- **Puffery.** Replace "pivotal," "groundbreaking," "testament to," and "evolving landscape" with
  the event or consequence.
- **Stock framing.** Cut "at its core," "in today's world," "when it comes to," and "the reality
  is." Start with the point.
- **Meta-signposting.** Remove "it is worth noting," "the key takeaway," and "as mentioned above"
  when the sentence works without them. Cut "Interestingly," "Importantly," and "Let's dive in"
  when they only announce the topic or tell the reader how to react.
- **Excessive hedging.** Reduce stacked qualifiers such as "could potentially" or "it may be argued
  that." Keep uncertainty the evidence requires.
- **Nominalizations.** Turn noun-heavy phrases into verbs: "conduct an evaluation of" becomes
  "evaluate."
- **Fancy verbs.** Prefer "is," "has," "uses," and "helps" over "serves as," "boasts,"
  "utilizes," and "facilitates."
- **Chatbot talk.** Cut "Of course," "Great question," "I hope this helps," routine offers to do
  more work, and unsolicited reassurance such as "And that's okay" or "you're not alone."

### Vague language

- **Vague sources.** Name the source behind "experts say" or "reports suggest." If no source is
  available, keep honest uncertainty or cut the claim.
- **Generic endings.** Remove recaps and optimistic conclusions that add no fact, decision, or next
  step.
- **Abstract claims.** State the mechanism or measured result. "The compiler rejects a renamed
  column" says more than "types stay close to the schema."
- **Weak modifiers.** Cut intensifiers and adverbs that prop up a vague verb. Keep them when they
  change the meaning.
- **Hidden mechanisms.** Translate metaphorical nouns such as "substrate," "surface," and
  "flywheel" when they obscure what the system does. Cut decorative metaphors that the next
  sentence must translate back into literal terms. Keep precise terms the audience uses.
- **Dangling effects.** Expand "highlighting" or "ensuring" into a supported causal claim, or
  delete it. Do not preserve the emptiness as "plan accordingly" or "showing its value."

### Formulaic structure

- **Forced contrast.** Replace "not only X, but Y" with the direct point unless the contrast
  matters.
- **False shape.** Remove forced trios, meaningless "from X to Y" ranges, and predictable "despite
  challenges" turns.
- **Rhetorical setup.** Replace a question immediately answered by the author with the answer
  itself, unless the question creates real tension or invites the reader to think.
- **Repeated syntax.** Vary consecutive sentences or paragraphs that open with the same structure.
  Keep parallelism when it is deliberate.
- **Over-explanation.** Stop once the fact and its useful implication are clear. Cut restatements
  that add no condition, evidence, decision, or action.
- **Tiny sections.** Combine one-sentence sections when ordinary paragraphs would read better.
  Delete the warm-up sentence after a heading when it merely restates the heading.
- **Inline labels.** Remove labels that repeat the sentence, such as "Performance: Performance
  improved." Keep labels that help readers scan distinct items.
- **Punctuation tics.** Use colons, parentheses, dashes, headings, and bold text for function. Do
  not ban them or use them as a repeated rhythm.

### Mechanical prose

- **Dense sentences.** Split sentences that make the reader backtrack. Keep related clauses
  together when splitting would make the prose choppy.
- **Passive voice.** Name the actor when it matters. Keep passive voice when the actor is unknown,
  irrelevant, or deliberately backgrounded.
- **Synonym cycling.** Use one term for one concept. Normal repetition is clearer than decorative
  variation.
- **Slogan fragments.** Fold clipped tails such as "no guessing" and recurring punch-line endings
  into a complete sentence, or cut them. Keep intentional fragments that fit the author's voice.
- **Fake casualness.** Do not inject fragments, contractions, jokes, first person, or slang that
  clashes with the author or audience.

### Promotional voice

- **Tourism copy.** Replace "vibrant," "breathtaking," "renowned," and "must-visit" with
  observable details.
- **Name-dropping.** Explain what a named outlet or authority contributed, or remove the name.
- **Generic benefits.** Do not append "making work easier" or "helping teams collaborate" to a
  sentence that already states what the product does.
- **Synthetic balance.** Do not bolt on pros and cons when the source has a clear judgment.
- **Invented soul.** Preserve real reactions and lived experience. Never fabricate them.

## Final check

Ask which sentence could appear unchanged in an unrelated article, which claim changed strength,
and whether the edit erased a distinctive voice. Fix those spots, then stop. Over-editing creates
another kind of artificial prose.
