#!/usr/bin/env node
/**
 * Validate a UI/UX audit directory against the audit-record contract.
 *
 *   node validate-audit.mjs <audit-dir> [--allow-pending | --stage plan|review|final]
 *
 * --allow-pending (= --stage plan) accepts an audit in progress: pending lenses, empty
 * priorities, no re-check, no synthesis or depth record yet. --stage review checks the end of
 * phase 4: closed lenses, evidence, and depth, but not yet the phase 5 outputs.
 * Exits 1 when any error is found. Warnings fail only the final stage of a version 2 audit, and
 * only when they name a finding or surface that is neither fixed nor named in `limitations`.
 * Schema version 2 enforces the depth benchmark, synthesis, sketch coverage, and signature rules;
 * version 1 audits still validate, with a warning that points to the migration.
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
export const SCHEMA_VERSIONS = [1, 2];
export const DEPTH_CHECKS = ["first-use", "failure-recovery", "keyboard", "constrained-states"];
export const CONSTRAINED_STATES = ["empty", "error", "long-content", "small-viewport"];
export const DEPTH_STATUSES = ["done", "not-applicable", "unverifiable"];
export const EXCEPTION_RULES = ["themes", "journeys", "strengths", "signatures", "suggestions", "sketches"];
// Default counts for the taste lens; audit.json `taste` overrides them when the user asks for a number.
export const TASTE_DEFAULTS = { suggestions: { min: 5, max: 12 }, signatures: { min: 2, max: 5 } };
const IMAGE_FILE = /\.(?:png|svg|jpe?g|webp|gif)$/i;
// Findings whose fix always changes what the user sees: the visual lens and the WCAG criteria
// about colour, contrast, and focus visibility. Target size (2.5.8) is left out on purpose: a
// larger hit area can be invisible.
const VISIBLE_WCAG = new Set(["WCAG 1.4.1", "WCAG 1.4.3", "WCAG 1.4.11", "WCAG 2.4.7", "WCAG 2.4.11", "WCAG 2.4.13"]);
export const visibleByNature = (finding) => finding.lens === "visual" || (finding.principle ?? []).some((item) => VISIBLE_WCAG.has(item));
const PRINCIPLE_PATTERN = /^(?:(?:FL|VI|CO)-\d{2}|WCAG \d\.\d{1,2}\.\d{1,2})$/;
const GENERIC_RECOMMENDATION =
  /^(?:improve|enhance|increase|add more|make (?:it )?more|ensure|consider improving)\b.{0,40}$/i;

const isText = (value) => typeof value === "string" && value.trim().length > 0;

export function readFindings(auditDir) {
  const file = path.join(auditDir, "findings.jsonl");
  if (!fs.existsSync(file)) {
    return { findings: [], errors: ["findings.jsonl is missing; create it empty when you write audit.json (phase 2)"] };
  }
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

/**
 * Stages: "plan" (phase 2, --allow-pending) accepts pending lenses and planned surfaces;
 * "review" (end of phase 4) requires closed lenses, evidence, and the depth record, but not yet
 * the phase 5 outputs (re-check, synthesis, priorities, sketches); "final" requires everything.
 */
export const STAGES = ["plan", "review", "final"];

export function validateAudit(auditDir, { allowPending = false, stage = allowPending ? "plan" : "final" } = {}) {
  if (!STAGES.includes(stage)) throw new Error(`stage must be one of ${STAGES.join(", ")}`);
  const planning = stage === "plan";
  allowPending = stage !== "final";
  const errors = [];
  const warnings = [];
  // Warnings about one finding or surface: phase 5 fixes each or names its ID in limitations.
  const itemWarnings = [];
  const warnAbout = (id, message) => {
    warnings.push(message);
    if (isText(id)) itemWarnings.push(id);
  };
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

  if (!SCHEMA_VERSIONS.includes(audit.version)) errors.push(`audit.json: version must be one of ${SCHEMA_VERSIONS.join(", ")}`);
  const v2 = audit.version === 2;
  if (audit.version === 1) {
    warnings.push("audit.json: version 1 is the legacy schema; version 2 rules (depth, synthesis, sketches, re-check eligibility) only warn (see audit-record.md, Migrating from version 1)");
  }
  // Declared exceptions: a rule that does not apply, with the reason, optionally for some IDs only.
  const exceptions = Array.isArray(audit.exceptions) ? audit.exceptions : [];
  for (const [index, exception] of exceptions.entries()) {
    if (!EXCEPTION_RULES.includes(exception?.rule)) errors.push(`exceptions[${index}]: rule must be one of ${EXCEPTION_RULES.join(", ")}`);
    if (!isText(exception?.reason)) errors.push(`exceptions[${index}]: reason is required`);
    if (exception?.ids !== undefined && !Array.isArray(exception.ids)) errors.push(`exceptions[${index}]: ids must be a list`);
  }
  const excepted = (rule, id) =>
    exceptions.some((exception) => exception?.rule === rule && isText(exception?.reason) && (!Array.isArray(exception.ids) || exception.ids.length === 0 || (id !== undefined && exception.ids.includes(id))));
  // In version 2, a synthesis rule is an error unless excepted; in version 1 it stays a warning.
  const enforce = (message) => (v2 ? errors : warnings).push(message);
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
    if (evidence.length === 0 && mode !== "source" && !planning) {
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
  if (pending > 0 && !planning) errors.push(`${pending} surface lenses are still pending`);

  // The visual lens note is a ledger: each screen and viewport names its visual checks once.
  if (v2 && !allowPending && lenses.includes("visual")) {
    const groups = new Map();
    for (const surface of surfaces) {
      if (surface?.lenses?.visual?.status !== "checked") continue;
      const key = `${surface.screen}|${surface.viewport}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(surface);
    }
    for (const group of groups.values()) {
      if (group.some((surface) => isText(surface.lenses.visual.note))) continue;
      const [first] = group;
      warnAbout(first.id, `${first.id}: visual is checked on ${first.screen} (${first.viewport}) but no surface of it has a visual note; name each visual check with the finding it produced or "consistent" (SKILL.md, phase 4)`);
    }
  }

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
    if (task?.status === "not-walked" && planning) {
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
        warnAbout(finding.id, `${label}: reported on ${surfaceId}, where lens ${finding.lens} is ${status}`);
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
    // Source findings and node-only design findings (no frame image to draw on) have no image.
    const surfaceImages = findingSurfaces.some((id) => (surfaces.find((surface) => surface.id === id)?.evidence ?? []).some((file) => IMAGE_FILE.test(file)));
    const imageless = evidence.basis === "source" || (evidence.basis === "design-node" && !surfaceImages && !files.some((file) => IMAGE_FILE.test(file)));
    if (finding.kind === "defect" && annotations.length === 0 && !imageless && !allowPending) {
      warnAbout(finding.id, `${label}: no annotated image; add one unless the finding has no visual location`);
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
        if (!PRINCIPLE_PATTERN.test(principle)) warnAbout(finding.id, `${label}: unrecognized principle ${JSON.stringify(principle)}`);
      }
      // Severity is judged on a task, so a blocker or major names the tasks it affects.
      const findingTasks = Array.isArray(finding.tasks) ? finding.tasks : [];
      for (const taskId of findingTasks) {
        if (!taskIds.has(taskId)) errors.push(`${label}: unknown task ${taskId}`);
      }
      if (v2 && ["blocker", "major"].includes(finding.severity) && findingTasks.length === 0) {
        errors.push(`${label}: a ${finding.severity} defect must list the tasks it affects in tasks`);
      }
    } else if (finding.kind === "suggestion") {
      if (finding.severity !== undefined) errors.push(`${label}: a suggestion must not have a severity`);
      if (!isText(finding.impact)) warnAbout(finding.id, `${label}: state the expected benefit in impact`);
    } else if (finding.kind === "signature") {
      if (finding.severity !== undefined) errors.push(`${label}: a signature idea must not have a severity`);
      for (const field of ["impact", "risks"]) {
        if (!isText(finding[field])) errors.push(`${label}: ${field} is required for a signature idea`);
      }
      if (!COSTS.includes(finding.cost)) errors.push(`${label}: cost must be one of ${COSTS.join(", ")}`);
      if (!OBVIOUSNESS.includes(finding.obviousness)) {
        errors.push(`${label}: obviousness must be one of ${OBVIOUSNESS.join(", ")}`);
      }
      if (v2 && !isText(finding.obviousnessReason)) {
        errors.push(`${label}: obviousnessReason must say what knowledge of the domain or its users the idea needs`);
      }
    }
    if (finding.noSketch !== undefined && !isText(finding.noSketch)) errors.push(`${label}: noSketch must be the reason no sketch applies`);
    if (finding.effort !== undefined && !EFFORTS.includes(finding.effort)) {
      errors.push(`${label}: effort must be one of ${EFFORTS.join(", ")}`);
    }
    if (isText(finding.recommendation) && GENERIC_RECOMMENDATION.test(finding.recommendation.trim())) {
      warnAbout(finding.id, `${label}: recommendation reads like a direction, not a concrete change`);
    }
  }

  // Taste output: enough suggestions and signature ideas for the scope, and ideas beyond the obvious.
  // audit.json `taste` holds counts the user asked for; they replace the default range.
  const signatures = findings.filter((finding) => finding.kind === "signature");
  const tasteSuggestions = findings.filter((finding) => finding.kind === "suggestion" && finding.lens === "taste");
  const requested = audit.taste ?? {};
  for (const key of ["suggestions", "signatures"]) {
    if (requested[key] !== undefined && !(Number.isInteger(requested[key]) && requested[key] >= 0)) {
      errors.push(`audit.json: taste.${key} must be a whole number the user asked for`);
    }
  }
  const range = (key) => (Number.isInteger(requested[key]) && requested[key] >= 0 ? { min: requested[key], max: requested[key], asked: true } : TASTE_DEFAULTS[key]);
  const counts = { suggestions: tasteSuggestions.length, signatures: signatures.length };
  const nouns = { suggestions: "taste suggestions", signatures: "signature ideas" };
  if (!allowPending && lenses.includes("taste")) {
    for (const key of ["suggestions", "signatures"]) {
      const { min, max, asked } = range(key);
      const target = asked ? `the ${min} the user asked for` : `${min} to ${max}`;
      if (counts[key] < min && !excepted(key)) {
        enforce(`audit.json: ${counts[key]} ${nouns[key]}; propose ${target}, or add an exception { "rule": "${key}", "reason": … } that says why the scope yields fewer`);
      } else if (counts[key] > max) {
        warnings.push(`audit.json: ${counts[key]} ${nouns[key]}, more than ${target}; keep the strongest`);
      }
    }
  }
  const nonObvious = signatures.filter((finding) => finding.obviousness === "non-obvious").length;
  const neededNonObvious = signatures.length >= 3 ? 2 : signatures.length > 0 ? 1 : 0;
  if (nonObvious < neededNonObvious) {
    enforce(`${nonObvious} of ${signatures.length} signature ideas are non-obvious; ${signatures.length >= 3 ? "three or more ideas need at least two" : "add at least one"} non-obvious idea`);
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
  if (!allowPending && !excepted("themes")) {
    const loose = defects.filter((finding) => ["blocker", "major"].includes(finding.severity) && !themed.has(finding.id));
    if (themes.length === 0 && defects.length >= 3) enforce("audit.json: no themes; group related findings by root cause, or add a themes exception with the reason");
    // Every blocker and major needs a theme or a reasoned exception, however small the audit.
    for (const finding of loose.filter((item) => !excepted("themes", item.id))) {
      enforce(`audit.json: ${finding.severity} defect ${finding.id} belongs to no theme; add it to one or list it in a themes exception`);
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
      if (!journeys.some((journey) => journey?.task === task.id) && !excepted("journeys", task.id)) {
        enforce(`audit.json: walked primary task ${task.id} has no journey metrics`);
      }
    }
  }
  const strengths = Array.isArray(audit.strengths) ? audit.strengths : [];
  for (const [index, strength] of strengths.entries()) {
    if (!isText(strength?.title) || !isText(strength?.why)) errors.push(`strengths[${index}]: title and why are required`);
    for (const surfaceId of strength?.surfaces ?? []) {
      if (!surfaceIds.has(surfaceId)) errors.push(`strengths[${index}]: unknown surface ${surfaceId}`);
    }
  }
  if (!allowPending && strengths.length === 0 && !excepted("strengths")) {
    enforce("audit.json: no strengths recorded; name what works and must survive the fixes");
  }

  // Re-audit: every defect of the previous audit gets a confirmed status.
  if (audit.previous !== undefined) {
    const previous = audit.previous ?? {};
    const STATUSES = ["resolved", "open", "partly-resolved", "regressed", "not-rechecked"];
    const previousDir = isText(previous.dir) ? path.resolve(auditDir, previous.dir) : "";
    let previousDefects = [];
    let previousFindings = [];
    const previousScreens = new Map();
    if (!previousDir || !fs.existsSync(path.join(previousDir, "findings.jsonl"))) {
      errors.push("audit.json: previous.dir must point to the previous audit directory");
    } else {
      previousFindings = readFindings(previousDir).findings.filter((finding) => finding.kind === "defect");
      previousDefects = previousFindings.map((finding) => finding.id);
      try {
        const previousAudit = JSON.parse(fs.readFileSync(path.join(previousDir, "audit.json"), "utf8"));
        for (const surface of previousAudit.surfaces ?? []) previousScreens.set(surface.id, surface.screen);
      } catch {
        // Without the previous audit.json the screens cannot be compared; the status checks still run.
      }
    }
    const currentScreens = new Set(surfaces.map((surface) => surface?.screen));
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
      // A screen audited again can run the old acceptance check, at least the part that is safe.
      const screens = (previousFindings.find((finding) => finding.id === result?.id)?.surfaces ?? []).map((id) => previousScreens.get(id)).filter(Boolean);
      const again = [...new Set(screens.filter((screen) => currentScreens.has(screen)))];
      if (result?.status === "not-rechecked" && again.length && !allowPending) {
        warnAbout(result.id, `${label}: not-rechecked, but ${again.join(", ")} ${again.length > 1 ? "were" : "was"} audited again; run the acceptance check or its safe part and record resolved, open, or partly-resolved, or name ${result.id} in limitations with what blocked the check`);
      }
    }
    for (const id of previousDefects) if (!seen.has(id)) errors.push(`audit.json: previous defect ${id} has no status`);
  }

  // Show, do not only tell (references/report.md): in version 2 every finding has a sketch, a
  // noSketch reason (its change is not visual), or a sketches exception. Version 1 only warned
  // about ideas and prioritized defects.
  if (!allowPending) {
    const needsSketch = v2 ? findings : findings.filter((item) => item.kind !== "defect" || priorities.includes(item.id));
    for (const finding of needsSketch) {
      const hasSketch = (finding.sketches ?? []).some((file) => IMAGE_FILE.test(file));
      if (hasSketch || excepted("sketches", finding.id)) continue;
      if (isText(finding.noSketch)) {
        if (visibleByNature(finding)) enforce(`${finding.id}: noSketch on a ${finding.lens === "visual" ? "visual-lens finding" : "colour, contrast, or focus-visibility finding"}; its fix changes what the user sees, so it needs a sketch or a sketches exception`);
        continue;
      }
      const what = finding.kind === "defect" ? "defect" : finding.kind === "signature" ? "signature idea" : "suggestion";
      enforce(`${finding.id}: ${what} without a sketch image; add one, give noSketch the reason the change is not visual, or add a sketches exception`);
    }
    // A sketch shared by findings whose current images differ cannot compare like with like.
    const sketchOwners = new Map();
    for (const finding of findings) {
      for (const file of (finding.sketches ?? []).filter((item) => IMAGE_FILE.test(item))) {
        if (!sketchOwners.has(file)) sketchOwners.set(file, []);
        sketchOwners.get(file).push(finding);
      }
    }
    for (const [file, owners] of sketchOwners) {
      const currents = new Set(owners.map((finding) => currentImageOf(finding)).filter(Boolean));
      if (owners.length > 1 && currents.size > 1 && !owners.every((finding) => excepted("sketches", finding.id))) {
        enforce(`${file} is the proposed sketch for ${owners.map((finding) => finding.id).join(", ")}, whose current images differ; sketch each against its own Now image`);
      }
    }
    for (const finding of findings) {
      const sketch = (finding.sketches ?? []).find((file) => IMAGE_FILE.test(file));
      const current = currentImageOf(finding);
      if (!sketch || !current || excepted("sketches", finding.id)) continue;
      const left = imageSize(path.join(auditDir, current));
      const right = imageSize(path.join(auditDir, sketch));
      if (!left || !right) continue;
      const ratio = left.width / left.height / (right.width / right.height);
      if (ratio > 1.15 || ratio < 1 / 1.15) {
        enforce(`${finding.id}: Now (${current}, ${left.width}×${left.height}) and Proposed (${sketch}, ${right.width}×${right.height}) have different shapes; sketch the same viewport and content`);
      }
    }
  }

  // Depth benchmark (version 2): a bounded second pass over the riskiest tasks and surfaces.
  if (v2 && !planning) validateDepth(audit.depth, { errors, surfaceIds, taskIds, findingIds });

  // Re-check sample. Only a checked surface lens that had no findings is eligible: a "confirmed"
  // entry must still have none, and a "new-findings" entry must name findings on that surface and lens.
  const cleanPairs = [];
  for (const surface of surfaces) {
    for (const lens of lenses) {
      if (surface?.lenses?.[lens]?.status === "checked" && !coveredPairs.has(`${surface.id}|${lens}`)) {
        cleanPairs.push(`${surface.id}|${lens}`);
      }
    }
  }
  const recheck = Array.isArray(audit.recheck) ? audit.recheck : [];
  const eligible = new Set();
  for (const [index, entry] of recheck.entries()) {
    const label = `recheck[${index}]`;
    const pair = `${entry?.surface}|${entry?.lens}`;
    let valid = true;
    if (!surfaceIds.has(entry?.surface)) (valid = false), errors.push(`${label}: unknown surface ${entry?.surface}`);
    if (!lenses.includes(entry?.lens)) (valid = false), errors.push(`${label}: unknown lens ${entry?.lens}`);
    if (!["confirmed", "new-findings"].includes(entry?.result)) (valid = false), errors.push(`${label}: result must be confirmed or new-findings`);
    if (entry?.result === "new-findings" && !(entry.findings?.length > 0)) {
      valid = false;
      errors.push(`${label}: new-findings must list the findings`);
    }
    for (const id of entry?.findings ?? []) {
      if (!findingIds.has(id)) (valid = false), errors.push(`${label}: unknown finding ${id}`);
    }
    if (!valid) continue;
    const status = surfaces.find((surface) => surface.id === entry.surface)?.lenses?.[entry.lens]?.status;
    // Version 2 rejects ineligible pairs; version 1 audits predate the rule, so they only warn
    // and keep counting the entry, as the version 1 validator did.
    let problem = "";
    if (status !== "checked") {
      problem = `${entry.surface} ${entry.lens} is ${status ?? "missing"}; only checked surface lenses can be re-checked`;
    } else if (entry.result === "confirmed" && coveredPairs.has(pair)) {
      problem = `${entry.surface} ${entry.lens} has findings; re-check a surface lens that had none`;
    } else if (entry.result === "new-findings") {
      const offTarget = entry.findings.filter((id) => {
        const finding = findingIds.get(id);
        return finding.lens !== entry.lens || !(finding.surfaces ?? []).includes(entry.surface);
      });
      if (offTarget.length) problem = `${offTarget.join(", ")} must list ${entry.surface} and lens ${entry.lens}`;
    }
    if (problem) enforce(`${label}: ${problem}`);
    if (!problem || !v2) eligible.add(pair);
  }
  const requiredRechecks = Math.min(cleanPairs.length, Math.max(3, Math.ceil(cleanPairs.length * 0.1)));
  const distinctRechecks = eligible.size;
  if (!allowPending && distinctRechecks < requiredRechecks) {
    errors.push(
      `audit.json: recheck covers ${distinctRechecks} surface lenses; at least ${requiredRechecks} of the ` +
        `${cleanPairs.length} checked lenses without findings must be re-checked`,
    );
  }

  // Independent second pass (follow-ups.md): its own record, merged into this one.
  if (audit.secondPass !== undefined) {
    const pass = audit.secondPass ?? {};
    const passDir = isText(pass.dir) && !path.isAbsolute(pass.dir) ? path.join(auditDir, pass.dir) : "";
    if (!passDir || !fs.existsSync(path.join(passDir, "findings.jsonl"))) {
      errors.push("audit.json: secondPass.dir must point to the second pass's audit directory inside this one");
    }
    if (!isText(pass.note)) errors.push("audit.json: secondPass.note must say who ran the pass and how its findings were merged");
    if (!Array.isArray(pass.added)) errors.push("audit.json: secondPass.added must list the findings the second pass added (empty when none)");
    for (const id of Array.isArray(pass.added) ? pass.added : []) {
      if (!findingIds.has(id)) errors.push(`audit.json: secondPass.added names ${id}, which is not a finding of this audit`);
    }
  }

  // Phase 5 is done only when each warning about a finding or surface is fixed or explained.
  if (v2 && stage === "final") {
    const limitations = (Array.isArray(audit.limitations) ? audit.limitations : []).filter(isText);
    const open = [...new Set(itemWarnings)].filter((id) => !limitations.some((item) => new RegExp(`\\b${id}\\b`).test(item)));
    if (open.length) {
      errors.push(`${open.length} warnings are neither fixed nor explained: ${open.join(", ")}; fix each, or add a limitations entry that names the ID and why the warning does not apply`);
    }
  }

  const stats = {
    version: audit.version,
    surfaces: surfaces.length,
    tasks: tasks.length,
    lensChecks: surfaces.length * lenses.length,
    pending,
    findings: findings.length,
    defects: defects.length,
    blockers: blockers.length,
    tasteSuggestions: tasteSuggestions.length,
    signatures: signatures.length,
    themes: themes.length,
    rechecks: distinctRechecks,
    requiredRechecks,
  };
  return { errors, warnings, stats };
}

/** The image the report shows as "Now": the first annotation, else the first screenshot. */
export function currentImageOf(finding) {
  const annotations = finding.evidence?.annotations ?? [];
  if (annotations.length) return annotations[0];
  const images = (finding.evidence?.files ?? []).filter((file) => IMAGE_FILE.test(file));
  return images.find((file) => !/-full\.[a-z]+$/i.test(file)) ?? images[0];
}

/** Pixel size of a PNG or the viewBox of an SVG; undefined for other files. */
export function imageSize(file) {
  try {
    if (/\.png$/i.test(file)) {
      const header = Buffer.alloc(24);
      const handle = fs.openSync(file, "r");
      fs.readSync(handle, header, 0, 24, 0);
      fs.closeSync(handle);
      return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
    }
    if (/\.svg$/i.test(file)) {
      const head = fs.readFileSync(file, "utf8").slice(0, 2000);
      const box = head.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
      if (box) return { width: Number(box[1]), height: Number(box[2]) };
    }
  } catch {
    // An unreadable image is reported by the file checks; size checks just skip it.
  }
  return undefined;
}

export function validateDepth(depth, { errors, surfaceIds, taskIds, findingIds }) {
  if (!depth || typeof depth !== "object") {
    errors.push(`audit.json: depth is required; record the depth benchmark (${DEPTH_CHECKS.join(", ")})`);
    return;
  }
  if (!isText(depth.selection)) errors.push("depth: selection must say which tasks and surfaces got the depth pass and why");
  if (!isText(depth.complete)) errors.push("depth: complete must say why the depth pass is finished");
  const checks = Array.isArray(depth.checks) ? depth.checks : [];
  for (const id of DEPTH_CHECKS) {
    const entries = checks.filter((check) => check?.check === id);
    if (entries.length !== 1) {
      errors.push(`depth: needs exactly one ${id} check`);
      continue;
    }
    const [check] = entries;
    const label = `depth ${id}`;
    if (!DEPTH_STATUSES.includes(check.status)) errors.push(`${label}: status must be one of ${DEPTH_STATUSES.join(", ")}`);
    if (!isText(check.note)) errors.push(`${label}: note must say what was exercised, or why it could not be`);
    if (check.status === "done" && !(check.surfaces?.length > 0)) errors.push(`${label}: done needs the surfaces it covered`);
    for (const surfaceId of check.surfaces ?? []) if (!surfaceIds.has(surfaceId)) errors.push(`${label}: unknown surface ${surfaceId}`);
    for (const taskId of check.tasks ?? []) if (!taskIds.has(taskId)) errors.push(`${label}: unknown task ${taskId}`);
    for (const findingId of check.findings ?? []) if (!findingIds.has(findingId)) errors.push(`${label}: unknown finding ${findingId}`);
    if (id === "constrained-states" && check.status === "done") {
      for (const state of CONSTRAINED_STATES) {
        if (!DEPTH_STATUSES.includes(check.states?.[state])) {
          errors.push(`${label}: states.${state} must be one of ${DEPTH_STATUSES.join(", ")}`);
        }
      }
    }
  }
  for (const check of checks) {
    if (!DEPTH_CHECKS.includes(check?.check)) errors.push(`depth: unknown check ${check?.check}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const allowPending = args.includes("--allow-pending");
  const stageIndex = args.indexOf("--stage");
  const stage = stageIndex >= 0 ? args[stageIndex + 1] : allowPending ? "plan" : "final";
  const positional = args.filter((argument, index) => !argument.startsWith("--") && !(stageIndex >= 0 && index === stageIndex + 1));
  const unknown = args.filter((argument) => argument.startsWith("--") && !["--allow-pending", "--stage"].includes(argument));
  if (positional.length !== 1 || unknown.length > 0 || !STAGES.includes(stage)) {
    console.error("Usage: validate-audit.mjs <audit-dir> [--allow-pending | --stage plan|review|final]");
    process.exit(2);
  }
  const { errors, warnings, stats } = validateAudit(path.resolve(positional[0]), { stage });
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
