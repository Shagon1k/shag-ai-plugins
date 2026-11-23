#!/usr/bin/env node
/**
 * Draft an improve-artifact rubric from a finished audit.
 *
 *   node export-rubric.mjs <audit-dir> [--out rubric.md] [--with-ideas]
 *
 * Mapping (each defect lands in exactly one place):
 *   - prioritized defects                    -> external checks (their acceptance criteria)
 *   - other defects citing a WCAG criterion  -> hard gates, one per criterion
 *   - other defects in a theme               -> the theme's scored criterion
 *   - remaining defects                      -> one "Other problems" criterion
 * Journey metrics become a scored criterion. Ideas join only with --with-ideas.
 * The rendered rubric is checked before it is written: each finding ID appears in exactly one
 * criterion row, gate, or check, so a finding never has two owners that can drift apart.
 * The output is a proposal; improve-artifact makes it binding only after acceptance.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFindings, validateAudit } from "./validate-audit.mjs";

const WCAG = /^WCAG (\d\.\d{1,2}\.\d{1,2})$/;
const cell = (text) => String(text ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

export function draftRubric(audit, findings, { withIdeas = false, auditPath = "<audit-dir>" } = {}) {
  const defects = findings.filter((finding) => finding.kind === "defect");
  const priorities = new Set(audit.priorities ?? []);
  const coverage = new Map();
  const gates = [];
  const checks = [];
  const criteria = [];

  // External checks: deterministic probes, token comparison, and prioritized acceptance criteria.
  checks.push({ id: "X1", text: `Page probes on every audited live surface report no contrast failures, unnamed controls, or obscured controls (\`page-probes.mjs\`, evidence in ${auditPath}/evidence).` });
  const evidenceFiles = [...(audit.surfaces ?? []).flatMap((surface) => surface.evidence ?? []), ...findings.flatMap((finding) => finding.evidence?.files ?? [])];
  if (evidenceFiles.some((file) => /inventory/.test(file))) {
    checks.push({ id: `X${checks.length + 1}`, text: "`compare-tokens.mjs` reports no off-token colours on the inventoried pages." });
  }
  for (const finding of defects.filter((item) => priorities.has(item.id))) {
    const id = `X${checks.length + 1}`;
    checks.push({ id, text: `${finding.id} ${finding.title}: ${finding.acceptance}` });
    coverage.set(finding.id, id);
  }

  // Hard gates: one per WCAG criterion among the remaining defects, plus no new blockers.
  const byCriterion = new Map();
  for (const finding of defects.filter((item) => !coverage.has(item.id))) {
    const criterion = (finding.principle ?? []).map((item) => item.match(WCAG)?.[1]).find(Boolean);
    if (!criterion) continue;
    if (!byCriterion.has(criterion)) byCriterion.set(criterion, []);
    byCriterion.get(criterion).push(finding);
  }
  for (const [criterion, items] of [...byCriterion].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))) {
    const id = `G${gates.length + 1}`;
    const surfaces = [...new Set(items.flatMap((item) => item.surfaces ?? []))].join(", ");
    gates.push({ id, text: `No WCAG ${criterion} failure remains on ${surfaces} (${items.map((item) => item.id).join(", ")}).` });
    for (const item of items) coverage.set(item.id, id);
  }
  gates.push({ id: `G${gates.length + 1}`, text: "No new blocker-severity problem appears on the audited tasks." });

  // Scored criteria: one per theme, then the journey cost, then everything else.
  for (const theme of audit.themes ?? []) {
    const remaining = theme.findings.filter((id) => !coverage.has(id) && defects.some((finding) => finding.id === id));
    if (!remaining.length) continue;
    const id = `C${criteria.length + 1}`;
    criteria.push({
      id,
      name: theme.title,
      acceptable: `The root cause is addressed: of ${remaining.join(", ")}, at most one minor problem still fails its acceptance check.`,
      target: `Every problem of this criterion (${remaining.join(", ")}) passes its acceptance check and a re-audit finds no new problem with the same root cause.`,
    });
    for (const findingId of remaining) coverage.set(findingId, id);
  }
  const journeys = (audit.journeys ?? []).filter((journey) => Object.values(journey.metrics ?? {}).some((value) => value > 0));
  if (journeys.length) {
    const today = journeys
      .map((journey) => `${journey.task}: ${Object.entries(journey.metrics).filter(([, value]) => value > 0).map(([key, value]) => `${key} ${value}`).join(", ")}`)
      .join("; ");
    criteria.push({
      id: `C${criteria.length + 1}`,
      name: "Cost of the walked journeys",
      acceptable: `Measured the same way, no metric is worse than today (${today}) and each journey improves at least one.`,
      target: "Decisions, screens, and scrolling of each journey are at least 30% lower than today, with no new waiting.",
    });
  }
  const rest = defects.filter((finding) => !coverage.has(finding.id));
  if (rest.length) {
    const id = `C${criteria.length + 1}`;
    criteria.push({
      id,
      name: "Other problems",
      acceptable: `Most of ${rest.map((finding) => finding.id).join(", ")} pass their acceptance checks; none got worse.`,
      target: "All of them pass their acceptance checks.",
    });
    for (const finding of rest) coverage.set(finding.id, id);
  }
  if (withIdeas) {
    const ideas = findings.filter((finding) => finding.kind !== "defect");
    if (ideas.length) {
      const id = `C${criteria.length + 1}`;
      criteria.push({
        id,
        name: "Visual direction and signature ideas",
        acceptable: `Each idea (${ideas.map((finding) => finding.id).join(", ")}) is adopted or declined with a reason, and nothing adopted breaks a gate.`,
        target: "The adopted ideas make the product more recognisably its own, judged against the sketches, with their usability safeguards in place.",
      });
      for (const finding of ideas) coverage.set(finding.id, id);
    }
  }

  const lines = [
    `# UI/UX rubric: ${audit.title}`,
    "",
    `Proposed from the audit of ${audit.date} (${auditPath}). It becomes binding only when accepted in improve-artifact; review the anchors before accepting.`,
    "",
    "| ID | Criterion | Acceptable (6) | Target (8.5+) |",
    "| --- | --- | --- | --- |",
    ...criteria.map((item) => `| ${item.id} | ${cell(item.name)} | ${cell(item.acceptable)} | ${cell(item.target)} |`),
    "",
    "Gates:",
    ...gates.map((gate) => `- ${gate.id} ${gate.text}`),
    "",
    "Checks:",
    ...checks.map((check) => `- ${check.id} ${check.text}`),
    "",
    `Coverage: ${[...coverage].map(([findingId, target]) => `${findingId}→${target}`).join(", ")}.`,
    "",
  ];
  const markdown = lines.join("\n");
  return { markdown, gates, checks, criteria, coverage: Object.fromEntries(coverage), ownership: checkOwnership(markdown, [...coverage.keys()], findings.map((finding) => finding.id)) };
}

/**
 * Check finding ownership on the rendered rubric: every required ID appears in exactly one
 * criterion row, gate, or check line, and no other finding ID appears in more than one. The
 * coverage line is the map itself and is not counted.
 */
export function checkOwnership(markdown, required, all = required) {
  const owners = new Map([...new Set([...required, ...all])].map((id) => [id, []]));
  for (const line of markdown.split("\n")) {
    const owner = line.match(/^\| (C\d+) \|/)?.[1] ?? line.match(/^- ([GX]\d+) /)?.[1];
    if (!owner) continue;
    for (const id of new Set(line.match(/\bF-\d{3,}\b/g) ?? [])) {
      if (owners.has(id)) owners.get(id).push(owner);
    }
  }
  const problems = [];
  for (const [id, places] of owners) {
    if (places.length > 1) problems.push(`${id} appears in ${places.join(", ")}`);
    else if (places.length === 0 && required.includes(id)) problems.push(`${id} appears in no criterion, gate, or check`);
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const out = outIndex >= 0 ? args[outIndex + 1] : undefined;
  const dir = args.find((argument, index) => !argument.startsWith("--") && !(outIndex >= 0 && index === outIndex + 1));
  if (!dir || (outIndex >= 0 && !out)) {
    console.error("Usage: export-rubric.mjs <audit-dir> [--out rubric.md] [--with-ideas]");
    process.exit(2);
  }
  const auditDir = path.resolve(dir);
  const { errors } = validateAudit(auditDir);
  if (errors.length) {
    console.error(`Audit is invalid; fix it first:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    process.exit(1);
  }
  const audit = JSON.parse(fs.readFileSync(path.join(auditDir, "audit.json"), "utf8"));
  const { markdown, ownership } = draftRubric(audit, readFindings(auditDir).findings, { withIdeas: args.includes("--with-ideas"), auditPath: dir });
  if (ownership.length) {
    console.error(`Rubric would give a finding several owners; fix the audit text first:\n${ownership.map((problem) => `- ${problem}`).join("\n")}`);
    process.exit(1);
  }
  if (out) {
    fs.writeFileSync(path.resolve(out), markdown);
    console.log(path.resolve(out));
  } else {
    process.stdout.write(markdown);
  }
}
