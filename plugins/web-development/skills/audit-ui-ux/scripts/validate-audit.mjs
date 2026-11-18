#!/usr/bin/env node
/**
 * Validate a UI/UX audit directory against the audit-record contract.
 *
 *   node validate-audit.mjs <audit-dir> [--allow-pending]
 *
 * --allow-pending accepts an audit in progress: pending lenses, empty priorities, no re-check.
 * Exits 1 when any error is found. Warnings never fail the run.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MODES = ["live", "design", "screenshot", "source"];
export const LENS_STATUSES = ["pending", "checked", "not-applicable", "unverifiable"];
export const TASK_STATUSES = ["walked", "partial", "blocked", "not-walked"];
export const KINDS = ["defect", "suggestion", "signature"];
export const COSTS = ["accent", "component", "concept"];
export const OBVIOUSNESS = ["obvious", "non-obvious"];
export const BASES = ["measured", "observed", "design-node", "visual-estimate", "source"];
export const SEVERITIES = ["blocker", "major", "minor"];
export const FREQUENCIES = ["widespread", "recurring", "isolated"];
export const EFFORTS = ["S", "M", "L"];
const PRINCIPLE_PATTERN = /^(?:(?:FL|VI|CO)-\d{2}|WCAG \d\.\d{1,2}\.\d{1,2})$/;
const GENERIC_RECOMMENDATION =
  /^(?:improve|enhance|increase|add more|make (?:it )?more|ensure|consider improving)\b.{0,40}$/i;

const isText = (value) => typeof value === "string" && value.trim().length > 0;

export function readFindings(auditDir) {
  const file = path.join(auditDir, "findings.jsonl");
  if (!fs.existsSync(file)) return { findings: [], errors: ["findings.jsonl is missing"] };
  const findings = [];
  const errors = [];
  fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line, index) => {
      if (!line.trim()) return;
      try {
        findings.push({ ...JSON.parse(line), __line: index + 1 });
      } catch (error) {
        errors.push(`findings.jsonl:${index + 1}: invalid JSON (${error.message})`);
      }
    });
  return { findings, errors };
}

export function validateAudit(auditDir, { allowPending = false } = {}) {
  const errors = [];
  const warnings = [];
  const fileExists = (relative) =>
    isText(relative) &&
    !path.isAbsolute(relative) &&
    fs.existsSync(path.join(auditDir, relative));

  const auditPath = path.join(auditDir, "audit.json");
  if (!fs.existsSync(auditPath)) return { errors: ["audit.json is missing"], warnings, stats: {} };
  let audit;
  try {
    audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  } catch (error) {
    return { errors: [`audit.json: invalid JSON (${error.message})`], warnings, stats: {} };
  }

  if (audit.version !== 1) errors.push("audit.json: version must be 1");
  if (!isText(audit.title)) errors.push("audit.json: title is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(audit.date ?? "")) errors.push("audit.json: date must be YYYY-MM-DD");
  if (!isText(audit.target?.name)) errors.push("audit.json: target.name is required");
  if (!isText(audit.target?.scope)) errors.push("audit.json: target.scope is required");
  if (!Array.isArray(audit.modes) || audit.modes.length === 0 || audit.modes.some((mode) => !MODES.includes(mode))) {
    errors.push(`audit.json: modes must be a non-empty list of ${MODES.join(", ")}`);
  }
  if (!isText(audit.product?.summary)) errors.push("audit.json: product.summary is required");

  const lenses = Array.isArray(audit.lenses) ? audit.lenses : [];
  if (lenses.length === 0 || lenses.some((lens) => !isText(lens)) || new Set(lenses).size !== lenses.length) {
    errors.push("audit.json: lenses must be a non-empty list of unique names");
  }

  // Areas: the product scopes the report groups findings by.
  const areas = Array.isArray(audit.areas) ? audit.areas : [];
  const areaIds = new Set();
  for (const [index, area] of areas.entries()) {
    if (!/^[a-z][a-z0-9-]*$/.test(area?.id ?? "")) errors.push(`areas[${index}]: id must be a lowercase slug`);
    else if (areaIds.has(area.id)) errors.push(`areas[${index}]: duplicate id`);
    else areaIds.add(area.id);
    if (!isText(area?.title)) errors.push(`areas[${index}]: title is required`);
  }
  if (areas.length === 0) warnings.push("audit.json: no areas; the report cannot group findings by product scope");

  // Surfaces and the coverage ledger.
  const surfaces = Array.isArray(audit.surfaces) ? audit.surfaces : [];
  if (surfaces.length === 0) errors.push("audit.json: surfaces must list at least one surface");
  const surfaceIds = new Set();
  let pending = 0;
  for (const [index, surface] of surfaces.entries()) {
    const label = `surfaces[${index}]${surface?.id ? ` ${surface.id}` : ""}`;
    if (!/^S-\d{3,}$/.test(surface?.id ?? "")) errors.push(`${label}: id must look like S-001`);
    else if (surfaceIds.has(surface.id)) errors.push(`${label}: duplicate id`);
    else surfaceIds.add(surface.id);
    for (const field of ["screen", "state", "viewport"]) {
      if (!isText(surface?.[field])) errors.push(`${label}: ${field} is required`);
    }
    if (areas.length > 0 && !areaIds.has(surface?.area)) errors.push(`${label}: area must be one of the declared areas`);
    const mode = surface?.mode ?? (audit.modes?.length === 1 ? audit.modes[0] : undefined);
    if (surface?.mode !== undefined && !MODES.includes(surface.mode)) errors.push(`${label}: unknown mode ${surface.mode}`);
    const evidence = Array.isArray(surface?.evidence) ? surface.evidence : [];
    if (evidence.length === 0 && mode !== "source" && !allowPending) {
      errors.push(`${label}: evidence must list at least one file`);
    }
    for (const file of evidence) {
      if (!fileExists(file)) errors.push(`${label}: evidence file not found: ${file}`);
    }
    const statuses = surface?.lenses ?? {};
    for (const lens of lenses) {
      const entry = statuses[lens];
      if (!entry || !LENS_STATUSES.includes(entry.status)) {
        errors.push(`${label}: lens ${lens} needs a status (${LENS_STATUSES.join(", ")})`);
        continue;
      }
      if (entry.status === "pending") pending += 1;
      if (["not-applicable", "unverifiable"].includes(entry.status) && !isText(entry.note)) {
        errors.push(`${label}: lens ${lens} is ${entry.status} and needs a note`);
      }
    }
    for (const lens of Object.keys(statuses)) {
      if (!lenses.includes(lens)) warnings.push(`${label}: lens ${lens} is not declared in lenses`);
    }
  }
  if (pending > 0 && !allowPending) errors.push(`${pending} surface lenses are still pending`);

  // Tasks.
  const tasks = Array.isArray(audit.tasks) ? audit.tasks : [];
  if (tasks.length === 0) errors.push("audit.json: tasks must list at least one task");
  if (tasks.length > 0 && !tasks.some((task) => task?.importance === "primary")) {
    errors.push("audit.json: at least one task must be primary");
  }
  const taskIds = new Set();
  for (const [index, task] of tasks.entries()) {
    const label = `tasks[${index}]${task?.id ? ` ${task.id}` : ""}`;
    if (!/^T\d+$/.test(task?.id ?? "")) errors.push(`${label}: id must look like T1`);
    else if (taskIds.has(task.id)) errors.push(`${label}: duplicate id`);
    else taskIds.add(task.id);
    if (!isText(task?.goal)) errors.push(`${label}: goal is required`);
    if (!["primary", "secondary"].includes(task?.importance)) errors.push(`${label}: importance must be primary or secondary`);
    if (!TASK_STATUSES.includes(task?.status)) errors.push(`${label}: status must be one of ${TASK_STATUSES.join(", ")}`);
    if (task?.status === "not-walked" && allowPending) {
      // An audit in progress may not have walked every task yet.
    } else if (task?.status !== "walked" && !isText(task?.note)) {
      errors.push(`${label}: status ${task?.status} needs a note`);
    }
    for (const surfaceId of task?.surfaces ?? []) {
      if (!surfaceIds.has(surfaceId)) errors.push(`${label}: unknown surface ${surfaceId}`);
    }
  }

  // Findings.
  const { findings, errors: findingReadErrors } = readFindings(auditDir);
  errors.push(...findingReadErrors);
  const findingIds = new Map();
  const coveredPairs = new Set();
  for (const finding of findings) {
    const label = `findings.jsonl:${finding.__line}${finding.id ? ` ${finding.id}` : ""}`;
    if (!/^F-\d{3,}$/.test(finding.id ?? "")) errors.push(`${label}: id must look like F-001`);
    else if (findingIds.has(finding.id)) errors.push(`${label}: duplicate id`);
    else findingIds.set(finding.id, finding);
    if (!KINDS.includes(finding.kind)) errors.push(`${label}: kind must be one of ${KINDS.join(", ")}`);
    if (finding.area !== undefined && !areaIds.has(finding.area)) errors.push(`${label}: area ${finding.area} is not declared`);
    if (!lenses.includes(finding.lens)) errors.push(`${label}: lens must be one of ${lenses.join(", ")}`);
    for (const field of ["title", "observation", "recommendation"]) {
      if (!isText(finding[field])) errors.push(`${label}: ${field} is required`);
    }
    if (!isText(finding.location?.description)) errors.push(`${label}: location.description is required`);
    const findingSurfaces = Array.isArray(finding.surfaces) ? finding.surfaces : [];
    if (findingSurfaces.length === 0) errors.push(`${label}: surfaces must list at least one surface`);
    for (const surfaceId of findingSurfaces) {
      if (!surfaceIds.has(surfaceId)) {
        errors.push(`${label}: unknown surface ${surfaceId}`);
        continue;
      }
      coveredPairs.add(`${surfaceId}|${finding.lens}`);
      const status = surfaces.find((surface) => surface.id === surfaceId)?.lenses?.[finding.lens]?.status;
      if (["not-applicable", "unverifiable"].includes(status)) {
        warnings.push(`${label}: reported on ${surfaceId}, where lens ${finding.lens} is ${status}`);
      }
    }

    const evidence = finding.evidence ?? {};
    if (!BASES.includes(evidence.basis)) errors.push(`${label}: evidence.basis must be one of ${BASES.join(", ")}`);
    const files = Array.isArray(evidence.files) ? evidence.files : [];
    if (files.length === 0 && !isText(evidence.measurement)) {
      errors.push(`${label}: evidence needs files or a measurement`);
    }
    for (const file of files) {
      if (!fileExists(file)) errors.push(`${label}: evidence file not found: ${file}`);
    }
    const annotations = Array.isArray(evidence.annotations) ? evidence.annotations : [];
    for (const file of annotations) {
      if (!fileExists(file)) errors.push(`${label}: annotation not found: ${file}`);
    }
    const sketches = Array.isArray(finding.sketches) ? finding.sketches : [];
    for (const file of sketches) {
      if (!fileExists(file)) errors.push(`${label}: sketch not found: ${file}`);
    }
    if (finding.kind === "defect" && annotations.length === 0 && evidence.basis !== "source" && !allowPending) {
      warnings.push(`${label}: no annotated image; add one unless the finding has no visual location`);
    }

    if (finding.kind === "defect") {
      for (const field of ["impact", "acceptance"]) {
        if (!isText(finding[field])) errors.push(`${label}: ${field} is required for a defect`);
      }
      if (!SEVERITIES.includes(finding.severity)) errors.push(`${label}: severity must be one of ${SEVERITIES.join(", ")}`);
      if (!FREQUENCIES.includes(finding.frequency)) errors.push(`${label}: frequency must be one of ${FREQUENCIES.join(", ")}`);
      const principles = Array.isArray(finding.principle) ? finding.principle : [];
      if (principles.length === 0) errors.push(`${label}: principle must cite a guidebook rule or WCAG criterion`);
      for (const principle of principles) {
        if (!PRINCIPLE_PATTERN.test(principle)) warnings.push(`${label}: unrecognized principle ${JSON.stringify(principle)}`);
      }
    } else if (finding.kind === "suggestion") {
      if (finding.severity !== undefined) errors.push(`${label}: a suggestion must not have a severity`);
      if (!isText(finding.impact)) warnings.push(`${label}: state the expected benefit in impact`);
    } else if (finding.kind === "signature") {
      if (finding.severity !== undefined) errors.push(`${label}: a signature idea must not have a severity`);
      for (const field of ["impact", "risks"]) {
        if (!isText(finding[field])) errors.push(`${label}: ${field} is required for a signature idea`);
      }
      if (!COSTS.includes(finding.cost)) errors.push(`${label}: cost must be one of ${COSTS.join(", ")}`);
      if (!OBVIOUSNESS.includes(finding.obviousness)) {
        errors.push(`${label}: obviousness must be one of ${OBVIOUSNESS.join(", ")}`);
      }
    }
    if (finding.effort !== undefined && !EFFORTS.includes(finding.effort)) {
      errors.push(`${label}: effort must be one of ${EFFORTS.join(", ")}`);
    }
    if (isText(finding.recommendation) && GENERIC_RECOMMENDATION.test(finding.recommendation.trim())) {
      warnings.push(`${label}: recommendation reads like a direction, not a concrete change`);
    }
  }

  // Signature ideas: few, and at least one beyond the obvious.
  const signatures = findings.filter((finding) => finding.kind === "signature");
  if (signatures.length > 5) warnings.push(`${signatures.length} signature ideas; keep the strongest one to three`);
  if (signatures.length > 0 && !signatures.some((finding) => finding.obviousness === "non-obvious")) {
    warnings.push("every signature idea is marked obvious; add at least one non-obvious idea");
  }

  // Priorities.
  const priorities = Array.isArray(audit.priorities) ? audit.priorities : [];
  if (priorities.length > 5) errors.push("audit.json: priorities lists more than five findings");
  if (new Set(priorities).size !== priorities.length) errors.push("audit.json: priorities has duplicates");
  for (const id of priorities) {
    const finding = findingIds.get(id);
    if (!finding) errors.push(`audit.json: priority ${id} is not a finding`);
    else if (finding.kind !== "defect") errors.push(`audit.json: priority ${id} is not a defect`);
  }
  const defects = findings.filter((finding) => finding.kind === "defect");
  if (!allowPending && defects.length > 0 && priorities.length === 0) {
    errors.push("audit.json: priorities must list the defects to fix first");
  }
  const blockers = defects.filter((finding) => finding.severity === "blocker").map((finding) => finding.id);
  const unprioritizedBlocker = blockers.find((id) => !priorities.includes(id));
  if (!allowPending && unprioritizedBlocker && priorities.length < 5) {
    warnings.push(`audit.json: blocker ${unprioritizedBlocker} is not in priorities`);
  }

  // Synthesis: themes, journeys, strengths.
  const themes = Array.isArray(audit.themes) ? audit.themes : [];
  const themed = new Set();
  const themeIds = new Set();
  for (const [index, theme] of themes.entries()) {
    const label = `themes[${index}]${theme?.id ? ` ${theme.id}` : ""}`;
    if (!/^TH-\d+$/.test(theme?.id ?? "")) errors.push(`${label}: id must look like TH-1`);
    else if (themeIds.has(theme.id)) errors.push(`${label}: duplicate id`);
    else themeIds.add(theme.id);
    for (const field of ["title", "rootCause", "recommendation"]) {
      if (!isText(theme?.[field])) errors.push(`${label}: ${field} is required`);
    }
    if (!Array.isArray(theme?.findings) || theme.findings.length < 2) errors.push(`${label}: a theme groups at least two findings`);
    for (const id of theme?.findings ?? []) {
      if (!findingIds.has(id)) errors.push(`${label}: unknown finding ${id}`);
      else if (findingIds.get(id).kind !== "defect") errors.push(`${label}: ${id} is not a defect; themes group problems, ideas stay apart`);
      themed.add(id);
    }
  }
  if (!allowPending) {
    const loose = defects.filter((finding) => ["blocker", "major"].includes(finding.severity) && !themed.has(finding.id));
    if (themes.length === 0 && defects.length >= 3) warnings.push("audit.json: no themes; group related findings by root cause");
    else if (themes.length > 0) {
      for (const finding of loose) warnings.push(`audit.json: ${finding.severity} defect ${finding.id} belongs to no theme`);
    }
  }
  const journeys = Array.isArray(audit.journeys) ? audit.journeys : [];
  const METRICS = ["screens", "interactions", "decisions", "fields", "scrollPx", "waitSeconds"];
  for (const [index, journey] of journeys.entries()) {
    const label = `journeys[${index}]`;
    if (!taskIds.has(journey?.task)) errors.push(`${label}: unknown task ${journey?.task}`);
    for (const metric of METRICS) {
      const value = journey?.metrics?.[metric];
      if (value !== undefined && !(Number.isFinite(value) && value >= 0)) errors.push(`${label}: ${metric} must be a non-negative number`);
    }
    if (!Object.keys(journey?.metrics ?? {}).some((metric) => METRICS.includes(metric))) {
      errors.push(`${label}: metrics needs at least one of ${METRICS.join(", ")}`);
    }
  }
  if (!allowPending) {
    for (const task of tasks.filter((item) => item?.importance === "primary" && item?.status === "walked")) {
      if (!journeys.some((journey) => journey?.task === task.id)) warnings.push(`audit.json: walked primary task ${task.id} has no journey metrics`);
    }
  }
  const strengths = Array.isArray(audit.strengths) ? audit.strengths : [];
  for (const [index, strength] of strengths.entries()) {
    if (!isText(strength?.title) || !isText(strength?.why)) errors.push(`strengths[${index}]: title and why are required`);
    for (const surfaceId of strength?.surfaces ?? []) {
      if (!surfaceIds.has(surfaceId)) errors.push(`strengths[${index}]: unknown surface ${surfaceId}`);
    }
  }
  if (!allowPending && strengths.length === 0) warnings.push("audit.json: no strengths recorded; name what works and must survive the fixes");

  // Re-audit: every defect of the previous audit gets a confirmed status.
  if (audit.previous !== undefined) {
    const previous = audit.previous ?? {};
    const STATUSES = ["resolved", "open", "partly-resolved", "regressed", "not-rechecked"];
    const previousDir = isText(previous.dir) ? path.resolve(auditDir, previous.dir) : "";
    let previousDefects = [];
    if (!previousDir || !fs.existsSync(path.join(previousDir, "findings.jsonl"))) {
      errors.push("audit.json: previous.dir must point to the previous audit directory");
    } else {
      previousDefects = readFindings(previousDir).findings.filter((finding) => finding.kind === "defect").map((finding) => finding.id);
    }
    const results = Array.isArray(previous.results) ? previous.results : [];
    const seen = new Set();
    for (const [index, result] of results.entries()) {
      const label = `previous.results[${index}]${result?.id ? ` ${result.id}` : ""}`;
      if (seen.has(result?.id)) errors.push(`${label}: duplicate id`);
      seen.add(result?.id);
      if (previousDefects.length && !previousDefects.includes(result?.id)) errors.push(`${label}: not a defect of the previous audit`);
      if (!STATUSES.includes(result?.status)) errors.push(`${label}: status must be one of ${STATUSES.join(", ")} (confirm proposals such as "resolved?")`);
      if (["open", "partly-resolved", "regressed"].includes(result?.status) && !findingIds.has(result?.now)) {
        errors.push(`${label}: ${result?.status} needs "now", the matching finding in this audit`);
      }
      if (["resolved", "not-rechecked"].includes(result?.status) && !isText(result?.note)) {
        errors.push(`${label}: ${result.status} needs a note with the evidence or the reason`);
      }
    }
    for (const id of previousDefects) if (!seen.has(id)) errors.push(`audit.json: previous defect ${id} has no status`);
  }

  // Show, do not only tell.
  if (!allowPending) {
    for (const finding of findings.filter((item) => item.kind === "signature" && !(item.sketches?.length > 0))) {
      warnings.push(`${finding.id}: signature idea without a sketch; show it unless the environment cannot render HTML`);
    }
  }

  // Re-check sample.
  const cleanPairs = [];
  for (const surface of surfaces) {
    for (const lens of lenses) {
      if (surface?.lenses?.[lens]?.status === "checked" && !coveredPairs.has(`${surface.id}|${lens}`)) {
        cleanPairs.push(`${surface.id}|${lens}`);
      }
    }
  }
  const recheck = Array.isArray(audit.recheck) ? audit.recheck : [];
  const requiredRechecks = Math.min(cleanPairs.length, Math.max(3, Math.ceil(cleanPairs.length * 0.1)));
  for (const [index, entry] of recheck.entries()) {
    const label = `recheck[${index}]`;
    if (!surfaceIds.has(entry?.surface)) errors.push(`${label}: unknown surface ${entry?.surface}`);
    if (!lenses.includes(entry?.lens)) errors.push(`${label}: unknown lens ${entry?.lens}`);
    if (!["confirmed", "new-findings"].includes(entry?.result)) errors.push(`${label}: result must be confirmed or new-findings`);
    if (entry?.result === "new-findings" && !(entry.findings?.length > 0)) {
      errors.push(`${label}: new-findings must list the findings`);
    }
    for (const id of entry?.findings ?? []) {
      if (!findingIds.has(id)) errors.push(`${label}: unknown finding ${id}`);
    }
  }
  const distinctRechecks = new Set(recheck.map((entry) => `${entry?.surface}|${entry?.lens}`)).size;
  if (!allowPending && distinctRechecks < requiredRechecks) {
    errors.push(
      `audit.json: recheck covers ${distinctRechecks} surface lenses; at least ${requiredRechecks} of the ` +
        `${cleanPairs.length} checked lenses without findings must be re-checked`,
    );
  }

  const stats = {
    surfaces: surfaces.length,
    tasks: tasks.length,
    lensChecks: surfaces.length * lenses.length,
    pending,
    findings: findings.length,
    defects: defects.length,
    blockers: blockers.length,
    signatures: signatures.length,
    themes: themes.length,
    rechecks: distinctRechecks,
    requiredRechecks,
  };
  return { errors, warnings, stats };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const allowPending = args.includes("--allow-pending");
  const positional = args.filter((argument) => !argument.startsWith("--"));
  const unknown = args.filter((argument) => argument.startsWith("--") && argument !== "--allow-pending");
  if (positional.length !== 1 || unknown.length > 0) {
    console.error("Usage: validate-audit.mjs <audit-dir> [--allow-pending]");
    process.exit(2);
  }
  const { errors, warnings, stats } = validateAudit(path.resolve(positional[0]), { allowPending });
  for (const warning of warnings) console.log(`warning: ${warning}`);
  for (const error of errors) console.log(`error: ${error}`);
  console.log(
    `${errors.length} errors, ${warnings.length} warnings; ` +
      Object.entries(stats)
        .map(([key, value]) => `${key}=${value}`)
        .join(" "),
  );
  process.exit(errors.length > 0 ? 1 : 0);
}
