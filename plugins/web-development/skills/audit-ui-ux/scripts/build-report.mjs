#!/usr/bin/env node
/**
 * Build a self-contained report.html and a session summary.md from an audit directory.
 *
 *   node build-report.mjs <audit-dir> [--allow-pending]
 *
 * Runs the audit validator first and refuses to build when it reports errors.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFindings, validateAudit } from "./validate-audit.mjs";

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE_PATH = path.join(SKILL_ROOT, "assets/report-template.html");
const PRINCIPLES_PATH = path.join(SKILL_ROOT, "references/principles.md");
const MAX_REPORT_BYTES = 15 * 1024 * 1024;
const IMAGE_TYPES = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const SEVERITY_ORDER = { blocker: 0, major: 1, minor: 2 };
const FREQUENCY_ORDER = { widespread: 0, recurring: 1, isolated: 2 };
const STATUS_LABELS = {
  checked: "✓ Checked",
  "not-applicable": "– Not applicable",
  unverifiable: "? Unverifiable",
  pending: "… Pending",
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function loadPrincipleTitles(file = PRINCIPLES_PATH) {
  const titles = new Map();
  if (!fs.existsSync(file)) return titles;
  for (const match of fs.readFileSync(file, "utf8").matchAll(/\*\*((?:FL|VI|CO)-\d{2}) ([^*]+?)\.?\*\*/g)) {
    titles.set(match[1], match[2]);
  }
  return titles;
}

export function sortFindings(findings) {
  return [...findings].sort((left, right) => {
    const kind = (left.kind === "defect" ? 0 : 1) - (right.kind === "defect" ? 0 : 1);
    if (kind) return kind;
    const severity = (SEVERITY_ORDER[left.severity] ?? 3) - (SEVERITY_ORDER[right.severity] ?? 3);
    if (severity) return severity;
    const frequency = (FREQUENCY_ORDER[left.frequency] ?? 3) - (FREQUENCY_ORDER[right.frequency] ?? 3);
    return frequency || left.id.localeCompare(right.id);
  });
}

function severityKey(finding) {
  return finding.kind === "defect" ? finding.severity : finding.kind;
}

function severityLabel(finding) {
  if (finding.kind === "signature") return "Signature idea";
  const key = severityKey(finding);
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function imagesFor(finding) {
  const evidence = finding.evidence ?? {};
  const annotations = evidence.annotations ?? [];
  if (annotations.length > 0) return annotations;
  // Without annotations, embed one raw screenshot, preferring a viewport capture over a
  // full-page one, so a report stays portable.
  const images = (evidence.files ?? []).filter((file) => IMAGE_TYPES[path.extname(file).toLowerCase()]);
  const viewport = images.find((file) => !/-full\.[a-z]+$/i.test(file));
  return viewport || images[0] ? [viewport ?? images[0]] : [];
}

function dataUri(auditDir, relative) {
  const type = IMAGE_TYPES[path.extname(relative).toLowerCase()];
  if (!type) return null;
  const file = path.join(auditDir, relative);
  if (!fs.existsSync(file)) return null;
  return `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
}

/** Prefer a PNG beside an SVG annotation; more chat clients display PNG inline. */
export function displayImagePath(auditDir, relative) {
  if (path.extname(relative).toLowerCase() === ".svg") {
    const png = relative.replace(/\.svg$/i, ".png");
    if (fs.existsSync(path.join(auditDir, png))) return path.join(auditDir, png);
  }
  return path.join(auditDir, relative);
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function coverageStats(audit, lenses) {
  const counts = { checked: 0, "not-applicable": 0, unverifiable: 0, pending: 0 };
  for (const surface of audit.surfaces ?? []) {
    for (const lens of lenses) {
      const status = surface.lenses?.[lens]?.status;
      if (status in counts) counts[status] += 1;
    }
  }
  return { ...counts, total: (audit.surfaces ?? []).length * lenses.length };
}

function principleText(principle, titles) {
  return titles.has(principle) ? `${principle} ${titles.get(principle)}` : principle;
}

function renderFinding(finding, auditDir, titles) {
  const sketchFiles = finding.sketches ?? [];
  const images = [
    ...sketchFiles.map((relative) => ({ relative, sketch: true })),
    ...imagesFor(finding).map((relative) => ({ relative, sketch: false })),
  ]
    .map((image) => ({ ...image, uri: dataUri(auditDir, image.relative) }))
    .filter((image) => image.uri);
  const figure = (image, index, caption) =>
    `<figure><button type="button" class="zoom" aria-label="Enlarge image ${index + 1} for ${escapeHtml(finding.id)}">` +
    `<img src="${image.uri}" alt="${escapeHtml(`${finding.id}: ${image.sketch ? "concept sketch of " : ""}${finding.title}`)}" loading="lazy"></button>` +
    `${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
  const sketchImages = images.filter((image) => image.sketch);
  const currentImages = images.filter((image) => !image.sketch);
  const compare = sketchImages.length > 0 && currentImages.length > 0;
  const media = compare
    ? `<div class="compare">${figure(currentImages[0], 0, "Now")}${figure(sketchImages[0], 1, "Proposed · concept sketch, not an implementation")}</div>`
    : images.map((image, index) => figure(image, index, image.sketch ? "Concept sketch, not an implementation" : "")).join("");
  const sketchSources = sketchFiles.filter((file) => /\.html?$/i.test(file));
  const location = finding.location ?? {};
  const where = [
    escapeHtml(location.description),
    location.component ? `Component: <code>${escapeHtml(location.component)}</code>` : "",
    location.selector ? `Selector: <code>${escapeHtml(location.selector)}</code>` : "",
    location.node ? `Design node: <code>${escapeHtml(location.node)}</code>` : "",
    `Surfaces: ${escapeHtml((finding.surfaces ?? []).join(", "))}`,
  ]
    .filter(Boolean)
    .join("<br>");
  const rows = finding.kind === "signature" ? [
    ["Moment", where],
    ["Today", escapeHtml(finding.observation)],
    ["Idea", escapeHtml(finding.recommendation)],
    ["Why it fits", escapeHtml(finding.impact)],
    ["Risks and safeguards", escapeHtml(finding.risks)],
    ["Sketch source", sketchSources.map((file) => `<code>${escapeHtml(file)}</code>`).join(", ")],
  ].filter(([, value]) => value) : [
    ["Where", where],
    ["Observed", escapeHtml(finding.observation)],
    [finding.kind === "defect" ? "Impact" : "Expected benefit", escapeHtml(finding.impact)],
    ["Principle", escapeHtml((finding.principle ?? []).map((item) => principleText(item, titles)).join("; "))],
    ["Recommendation", escapeHtml(finding.recommendation)],
    ["Done when", escapeHtml(finding.acceptance)],
    [
      "Evidence",
      escapeHtml(
        [finding.evidence?.basis, finding.evidence?.measurement].filter(Boolean).join(" · ") +
          (finding.evidence?.files?.length ? ` · ${finding.evidence.files.join(", ")}` : ""),
      ),
    ],
  ].filter(([, value]) => value);
  const chips = [
    `<span class="chip ${severityKey(finding)}">${escapeHtml(severityLabel(finding))}</span>`,
    finding.frequency ? `<span class="chip">${escapeHtml(finding.frequency)}</span>` : "",
    finding.cost ? `<span class="chip">Cost: ${escapeHtml(finding.cost)}</span>` : "",
    finding.obviousness ? `<span class="chip">${escapeHtml(finding.obviousness)}</span>` : "",
    `<span class="chip">${escapeHtml(finding.lens)}</span>`,
    finding.effort ? `<span class="chip">Effort ${escapeHtml(finding.effort)}</span>` : "",
  ].join("");
  return `<article class="finding" id="${escapeHtml(finding.id)}" data-severity="${escapeHtml(severityKey(finding))}" data-lens="${escapeHtml(finding.lens)}">
<header><span class="fid">${escapeHtml(finding.id)}</span><h3>${escapeHtml(finding.title)}</h3><div class="chips">${chips}</div></header>
<div class="body${compare ? " has-compare" : media ? " has-media" : ""}">${media ? `<div class="media">${media}</div>` : ""}
<dl>${rows.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join("")}</dl></div>
</article>`;
}

/** Group findings by product area; findings spanning several areas go to "Across the product". */
export function groupByArea(audit, findings) {
  const areas = audit.areas ?? [];
  const surfaceArea = new Map((audit.surfaces ?? []).map((surface) => [surface.id, surface.area]));
  const groups = [
    { id: "across", title: "Across the product", findings: [] },
    ...areas.map((area) => ({ id: area.id, title: area.title, findings: [] })),
  ];
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const finding of findings) {
    const owned = finding.area && byId.get(finding.area);
    const touched = [...new Set((finding.surfaces ?? []).map((id) => surfaceArea.get(id)).filter(Boolean))];
    const single = touched.length === 1 ? byId.get(touched[0]) : undefined;
    const target = owned || single || byId.get("across");
    target.findings.push(finding);
  }
  if (!areas.length) groups[0].title = "All findings";
  return groups.filter((group) => group.findings.length);
}

function filterGroup(name, label, values) {
  if (values.length < 2) return "";
  const buttons = values
    .map(
      (value) =>
        `<button type="button" data-filter="${name}" data-value="${escapeHtml(value)}" aria-pressed="true">${escapeHtml(value)}</button>`,
    )
    .join("");
  return `<fieldset><legend>${label}</legend>${buttons}</fieldset>`;
}

export function buildReport(auditDir, audit, findings, titles = loadPrincipleTitles()) {
  const lenses = audit.lenses;
  const sorted = sortFindings(findings);
  const byId = new Map(findings.map((finding) => [finding.id, finding]));
  const defects = findings.filter((finding) => finding.kind === "defect");
  const suggestions = sorted.filter((finding) => finding.kind === "suggestion");
  const signatures = sorted.filter((finding) => finding.kind === "signature");
  const count = (severity) => defects.filter((finding) => finding.severity === severity).length;
  const coverage = coverageStats(audit, lenses);
  const target = audit.target ?? {};
  const product = audit.product ?? {};

  const header = `<header class="page">
<h1>${escapeHtml(audit.title)}</h1>
<p class="meta"><span>${escapeHtml(target.name)}</span>${target.location ? `<span>${escapeHtml(target.location)}</span>` : ""}${target.revision ? `<span>Revision ${escapeHtml(target.revision)}</span>` : ""}<span>${escapeHtml(audit.date)}</span><span>Mode: ${escapeHtml((audit.modes ?? []).join(", "))}</span></p>
${audit.verdict ? `<p class="verdict">${escapeHtml(audit.verdict)}</p>` : ""}
<div class="stats">
<div class="stat"><b>${count("blocker")}</b><span>Blockers</span></div>
<div class="stat"><b>${count("major")}</b><span>Major</span></div>
<div class="stat"><b>${count("minor")}</b><span>Minor</span></div>
<div class="stat"><b>${suggestions.length}</b><span>Suggestions</span></div>
${signatures.length ? `<div class="stat"><b>${signatures.length}</b><span>Signature ideas</span></div>` : ""}
<div class="stat"><b>${coverage.checked}/${coverage.total}</b><span>Lens checks done</span></div>
<div class="stat"><b>${coverage.unverifiable}</b><span>Unverifiable</span></div>
</div>
</header>`;

  const priorities = (audit.priorities ?? [])
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map(
      (finding, index) => `<li><span class="rank">${index + 1}</span><div>
<h3><a href="#${escapeHtml(finding.id)}">${escapeHtml(finding.title)}</a></h3>
<div class="chips"><span class="chip ${severityKey(finding)}">${escapeHtml(severityLabel(finding))}</span> <span class="chip">${escapeHtml(finding.frequency)}</span> <span class="chip">${escapeHtml(finding.lens)}</span></div>
<p>${escapeHtml(finding.recommendation)}</p></div></li>`,
    )
    .join("");
  const fixFirst = priorities
    ? `<section aria-labelledby="fix-first"><h2 id="fix-first">Fix first</h2><ol class="priorities">${priorities}</ol></section>`
    : "";

  const findingLink = (id) => (byId.has(id) ? `<a href="#${escapeHtml(id)}">${escapeHtml(id)}</a>` : escapeHtml(id));
  const previous = audit.previous;
  const PREVIOUS_LABELS = { resolved: "Resolved", "partly-resolved": "Partly resolved", open: "Still open", regressed: "Regressed", "not-rechecked": "Not re-checked" };
  const previousSection = previous?.results?.length
    ? `<section aria-labelledby="since"><h2 id="since">Since the last audit</h2>
<div class="stats">${Object.entries(PREVIOUS_LABELS)
        .map(([key, label]) => [label, previous.results.filter((result) => result.status === key).length])
        .filter(([, n]) => n)
        .map(([label, n]) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`)
        .join("")}<div class="stat"><b>${(previous.newDefects ?? defects.filter((finding) => !previous.results.some((result) => result.now === finding.id)).map((finding) => finding.id)).length}</b><span>New problems</span></div></div>
<div class="table-scroll"><table><thead><tr><th scope="col">Before</th><th scope="col">Status</th><th scope="col">Now</th><th scope="col">Note</th></tr></thead><tbody>${previous.results
        .map((result) => `<tr><th scope="row">${escapeHtml(result.id)}${result.title ? `<span class="note">${escapeHtml(result.title)}</span>` : ""}</th><td>${escapeHtml(PREVIOUS_LABELS[result.status] ?? result.status)}</td><td>${result.now ? findingLink(result.now) : "—"}</td><td>${escapeHtml(result.note ?? "")}</td></tr>`)
        .join("")}</tbody></table></div></section>`
    : "";
  const themes = audit.themes ?? [];
  const themesSection = themes.length
    ? `<section aria-labelledby="themes"><h2 id="themes">Themes</h2>
<p class="lede">Findings grouped by shared root cause. Fixing a theme usually fixes several findings at once.</p>
<div class="themes">${themes
        .map(
          (theme) => `<article class="theme" id="${escapeHtml(theme.id)}"><h3>${escapeHtml(theme.title)}</h3>
<p><strong>Root cause:</strong> ${escapeHtml(theme.rootCause)}</p>
<p><strong>Direction:</strong> ${escapeHtml(theme.recommendation)}</p>
<p class="refs">${theme.findings.map(findingLink).join(" · ")}</p></article>`,
        )
        .join("")}</div></section>`
    : "";
  const METRIC_LABELS = { screens: "Screens", interactions: "Interactions", decisions: "Decisions", fields: "Fields typed", scrollPx: "Scrolled (px)", waitSeconds: "Waiting (s)" };
  const journeys = audit.journeys ?? [];
  const taskGoal = new Map((audit.tasks ?? []).map((task) => [task.id, task.goal]));
  const journeySection = journeys.length
    ? `<section aria-labelledby="journeys"><h2 id="journeys">Cost of the journey</h2><div class="table-scroll"><table>
<thead><tr><th scope="col">Task</th>${Object.values(METRIC_LABELS).map((label) => `<th scope="col">${label}</th>`).join("")}</tr></thead>
<tbody>${journeys
        .map(
          (journey) =>
            `<tr><th scope="row">${escapeHtml(journey.task)}<span class="note">${escapeHtml(taskGoal.get(journey.task) ?? "")}${journey.note ? ` — ${escapeHtml(journey.note)}` : ""}</span></th>${Object.keys(METRIC_LABELS)
              .map((key) => `<td>${journey.metrics?.[key] ?? "—"}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody></table></div></section>`
    : "";
  const strengths = audit.strengths ?? [];
  const strengthsSection = strengths.length
    ? `<section aria-labelledby="strengths" class="prose"><h2 id="strengths">What works — keep it</h2><ul class="strengths">${strengths
        .map((strength) => `<li><strong>${escapeHtml(strength.title)}.</strong> ${escapeHtml(strength.why)}${strength.surfaces?.length ? ` <span class="note">${escapeHtml(strength.surfaces.join(", "))}</span>` : ""}</li>`)
        .join("")}</ul></section>`
    : "";

  const severities = ["blocker", "major", "minor"].filter((value) =>
    defects.some((finding) => finding.severity === value),
  );
  const usedLenses = lenses.filter((lens) => defects.some((finding) => finding.lens === lens));
  const groups = groupByArea(audit, sorted);
  const SEVERITY_TITLES = { blocker: "Blockers", major: "Major", minor: "Minor" };
  const issueGroups = groups
    .map((group) => {
      const items = group.findings.filter((finding) => finding.kind === "defect");
      if (!items.length) return "";
      const bySeverity = ["blocker", "major", "minor"]
        .map((severity) => {
          const level = items.filter((finding) => finding.severity === severity);
          return level.length
            ? `<div class="sev-group"><h4 class="sev-title"><span class="chip ${severity}">${SEVERITY_TITLES[severity]}</span> ${level.length}</h4>${level.map((finding) => renderFinding(finding, auditDir, titles)).join("\n")}</div>`
            : "";
        })
        .join("");
      return `<section class="area-group" aria-labelledby="area-${escapeHtml(group.id)}"><h3 class="area-title" id="area-${escapeHtml(group.id)}">${escapeHtml(group.title)} <span class="note">${plural(items.length, "problem")}</span></h3>${bySeverity}</section>`;
    })
    .join("\n");
  const areaNav = (prefix, pick, describe) => {
    const links = groups
      .map((group) => {
        const items = group.findings.filter(pick);
        return items.length ? `<li><a href="#${prefix}-${escapeHtml(group.id)}">${escapeHtml(group.title)}</a> <span class="note">${describe(items)}</span></li>` : "";
      })
      .join("");
    return links ? `<nav class="area-nav" aria-label="Areas"><ul>${links}</ul></nav>` : "";
  };
  const severityCounts = (items) =>
    ["blocker", "major", "minor"]
      .map((severity) => [severity, items.filter((finding) => finding.severity === severity).length])
      .filter(([, n]) => n)
      .map(([severity, n]) => `${n} ${severity}`)
      .join(", ");
  const findingsSection = `<section aria-labelledby="findings" class="part"><h2 id="findings">Part 1 · Problems</h2>
<p class="lede">Violations of usability principles, WCAG, or the product's own system, grouped by product area and ordered by severity.</p>
${areaNav("area", (finding) => finding.kind === "defect", severityCounts)}
${defects.length ? `<div class="filters" role="search" aria-label="Filter problems">${filterGroup("severity", "Severity", severities)}${filterGroup("lens", "Lens", usedLenses)}<input type="search" placeholder="Search problems" aria-label="Search problems"></div>
<p class="count" id="finding-count" aria-live="polite"></p>
<div id="defect-list">${issueGroups}</div>` : "<p>No problems were recorded.</p>"}
</section>`;
  const ideaGroups = groups
    .map((group) => {
      const ideas = [
        ...group.findings.filter((finding) => finding.kind === "signature"),
        ...group.findings.filter((finding) => finding.kind === "suggestion"),
      ];
      return ideas.length
        ? `<section class="area-group" aria-labelledby="ideas-${escapeHtml(group.id)}"><h3 class="area-title" id="ideas-${escapeHtml(group.id)}">${escapeHtml(group.title)} <span class="note">${plural(ideas.length, "idea")}</span></h3>${ideas.map((finding) => renderFinding(finding, auditDir, titles)).join("\n")}</section>`
        : "";
    })
    .join("\n");
  const ideasSection = suggestions.length || signatures.length
    ? `<section aria-labelledby="ideas" class="part ideas"><h2 id="ideas">Part 2 · Ideas</h2>
<p class="lede">Taste suggestions and product-specific ideas. They are opinions, not failures, and none is required to fix the problems above.</p>
${areaNav("ideas", (finding) => finding.kind !== "defect", (items) => plural(items.length, "idea"))}
${product.direction ? `<p class="prose"><strong>Direction as observed:</strong> ${escapeHtml(product.direction)}</p>` : ""}
${product.idea ? `<p class="prose"><strong>Core idea:</strong> ${escapeHtml(product.idea)}</p>` : ""}
${ideaGroups}</section>`
    : "";

  const tasks = (audit.tasks ?? [])
    .map(
      (task) =>
        `<tr><td>${escapeHtml(task.id)}</td><td>${escapeHtml(task.goal)}</td><td>${escapeHtml(task.importance)}</td><td>${escapeHtml(task.status)}${task.note ? `<span class="note">${escapeHtml(task.note)}</span>` : ""}</td><td>${escapeHtml((task.surfaces ?? []).join(", "))}</td></tr>`,
    )
    .join("");
  const tasksSection = `<section aria-labelledby="tasks"><h2 id="tasks">Tasks walked</h2><div class="table-scroll"><table>
<thead><tr><th scope="col">ID</th><th scope="col">Goal</th><th scope="col">Importance</th><th scope="col">Status</th><th scope="col">Surfaces</th></tr></thead>
<tbody>${tasks}</tbody></table></div></section>`;

  const findingCount = (surfaceId, lens) =>
    findings.filter((finding) => finding.lens === lens && (finding.surfaces ?? []).includes(surfaceId)).length;
  const coverageRows = (audit.surfaces ?? [])
    .map((surface) => {
      const cells = lenses
        .map((lens) => {
          const entry = surface.lenses?.[lens] ?? { status: "pending" };
          const found = findingCount(surface.id, lens);
          return `<td><span class="st ${escapeHtml(entry.status)}">${escapeHtml(STATUS_LABELS[entry.status] ?? entry.status)}${found ? ` · ${found} finding${found > 1 ? "s" : ""}` : ""}${entry.note ? `<span class="note">${escapeHtml(entry.note)}</span>` : ""}</span></td>`;
        })
        .join("");
      return `<tr><th scope="row">${escapeHtml(surface.id)}</th><td>${escapeHtml(surface.screen)}</td><td>${escapeHtml(surface.state)}</td><td>${escapeHtml(surface.viewport)}${surface.theme ? ` · ${escapeHtml(surface.theme)}` : ""}</td>${cells}</tr>`;
    })
    .join("");
  const coverageSection = `<section aria-labelledby="coverage"><h2 id="coverage">Coverage</h2><div class="table-scroll"><table>
<thead><tr><th scope="col">Surface</th><th scope="col">Screen</th><th scope="col">State</th><th scope="col">Viewport</th>${lenses.map((lens) => `<th scope="col">${escapeHtml(lens)}</th>`).join("")}</tr></thead>
<tbody>${coverageRows}</tbody></table></div>
${(audit.recheck ?? []).length ? `<p class="count">Re-checked ${audit.recheck.length} surface lenses without findings: ${escapeHtml(audit.recheck.map((entry) => `${entry.surface} ${entry.lens} (${entry.result})`).join(", "))}.</p>` : ""}
</section>`;

  const list = (items) => (items?.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "");
  const conditions = audit.conditions ?? {};
  const context = `<section aria-labelledby="context" class="prose"><h2 id="context">Context and assumptions</h2>
<p>${escapeHtml(product.summary)}${product.tone ? ` Tone: ${escapeHtml(product.tone)}.` : ""}</p>
<p><strong>Scope:</strong> ${escapeHtml(target.scope)}</p>
${audit.personas?.length ? `<p><strong>Personas:</strong> ${escapeHtml(audit.personas.join(", "))}</p>` : ""}
${conditions.viewports?.length ? `<p><strong>Viewports:</strong> ${escapeHtml(conditions.viewports.join(", "))}${conditions.themes?.length ? `; <strong>themes:</strong> ${escapeHtml(conditions.themes.join(", "))}` : ""}</p>` : ""}
${conditions.stress?.length ? `<p><strong>Stress content:</strong> ${escapeHtml(conditions.stress.join("; "))}</p>` : ""}
${audit.sources?.length ? `<p><strong>Design sources:</strong> ${escapeHtml(audit.sources.join(", "))}</p>` : ""}
${product.assumptions?.length ? `<h3>Assumptions</h3>${list(product.assumptions)}` : ""}
${audit.limitations?.length ? `<h3>Limitations</h3>${list(audit.limitations)}` : ""}
</section>`;

  const footer = `<footer class="page">This is an expert review against usability principles, WCAG 2.2 AA, and in-page measurements. It is not usability testing with real users; validate high-stakes decisions with the people who use the product.</footer>`;

  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  return template
    .replace("{{title}}", () => escapeHtml(audit.title))
    .replace("{{content}}", () => [header, previousSection, fixFirst, themesSection, journeySection, strengthsSection, findingsSection, ideasSection, tasksSection, coverageSection, context, footer].join("\n"));
}

export function buildSummary(auditDir, audit, findings, reportPath) {
  const byId = new Map(findings.map((finding) => [finding.id, finding]));
  const defects = findings.filter((finding) => finding.kind === "defect");
  const count = (severity) => defects.filter((finding) => finding.severity === severity).length;
  const coverage = coverageStats(audit, audit.lenses);
  const lines = [`# ${audit.title}`, ""];
  if (audit.verdict) lines.push(audit.verdict, "");
  lines.push(
    `- Findings: ${plural(count("blocker"), "blocker")}, ${count("major")} major, ${count("minor")} minor, ${plural(findings.filter((finding) => finding.kind === "suggestion").length, "suggestion")}, ${plural(findings.filter((finding) => finding.kind === "signature").length, "signature idea")}`,
    `- Coverage: ${coverage.checked} of ${coverage.total} lens checks done, ${coverage.unverifiable} unverifiable, ${coverage["not-applicable"]} not applicable`,
    `- Report: ${reportPath}`,
    "",
  );
  if (audit.previous?.results?.length) {
    const tally = {};
    for (const result of audit.previous.results) tally[result.status] = (tally[result.status] ?? 0) + 1;
    lines.push("## Since the last audit", "", `- ${Object.entries(tally).map(([status, n]) => `${n} ${status}`).join(", ")}`, "");
  }
  if (audit.themes?.length) {
    lines.push("## Themes", "");
    for (const theme of audit.themes) lines.push(`- **${theme.title}** (${theme.findings.join(", ")}): ${theme.recommendation}`);
    lines.push("");
  }
  if (audit.journeys?.length) {
    lines.push("## Cost of the journey", "");
    for (const journey of audit.journeys) {
      const metrics = Object.entries(journey.metrics ?? {}).map(([key, value]) => `${value} ${key}`).join(", ");
      lines.push(`- ${journey.task}: ${metrics}${journey.note ? ` (${journey.note})` : ""}`);
    }
    lines.push("");
  }
  const priorities = (audit.priorities ?? []).map((id) => byId.get(id)).filter(Boolean);
  if (priorities.length) {
    lines.push("## Fix first", "");
    priorities.forEach((finding, index) => {
      lines.push(`${index + 1}. **${finding.id}: ${finding.title}** (${finding.severity}, ${finding.frequency}, ${finding.lens})`);
      const image = imagesFor(finding)[0];
      if (image) lines.push("", `   ![${finding.id}](${displayImagePath(auditDir, image)})`, "");
      const sketch = (finding.sketches ?? []).find((file) => IMAGE_TYPES[path.extname(file).toLowerCase()]);
      if (sketch) lines.push(`   ![${finding.id} proposed](${displayImagePath(auditDir, sketch)})`, "");
      lines.push(`   ${finding.recommendation}`, "");
    });
  }
  const ideas = sortFindings(findings).filter((finding) => finding.kind === "signature");
  if (ideas.length) {
    lines.push("## Signature ideas", "");
    for (const idea of ideas) {
      lines.push(`- **${idea.id}: ${idea.title}** (${idea.cost}, ${idea.obviousness}): ${idea.recommendation}`);
      const sketch = (idea.sketches ?? []).find((file) => IMAGE_TYPES[path.extname(file).toLowerCase()]);
      if (sketch) lines.push("", `  ![${idea.id} sketch](${displayImagePath(auditDir, sketch)})`, "");
    }
    lines.push("");
  }
  if (audit.strengths?.length) {
    lines.push("## What works", "", ...audit.strengths.map((strength) => `- **${strength.title}.** ${strength.why}`), "");
  }
  if (audit.limitations?.length) {
    lines.push("## Limitations", "", ...audit.limitations.map((item) => `- ${item}`), "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function buildAuditOutputs(auditDir, { allowPending = false } = {}) {
  const { errors, warnings } = validateAudit(auditDir, { allowPending });
  if (errors.length) {
    const error = new Error(`Audit is invalid:\n${errors.map((item) => `- ${item}`).join("\n")}`);
    error.validation = { errors, warnings };
    throw error;
  }
  const audit = JSON.parse(fs.readFileSync(path.join(auditDir, "audit.json"), "utf8"));
  const { findings } = readFindings(auditDir);
  const reportPath = path.join(auditDir, "report.html");
  const summaryPath = path.join(auditDir, "summary.md");
  const html = buildReport(auditDir, audit, findings);
  fs.writeFileSync(reportPath, html, "utf8");
  fs.writeFileSync(summaryPath, buildSummary(auditDir, audit, findings, reportPath), "utf8");
  const size = Buffer.byteLength(html);
  if (size > MAX_REPORT_BYTES) {
    warnings.push(`report.html is ${(size / 1024 / 1024).toFixed(1)} MB; crop or compress screenshots to keep it portable`);
  }
  return { reportPath, summaryPath, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const positional = args.filter((argument) => !argument.startsWith("--"));
  const unknown = args.filter((argument) => argument.startsWith("--") && argument !== "--allow-pending");
  if (positional.length !== 1 || unknown.length > 0) {
    console.error("Usage: build-report.mjs <audit-dir> [--allow-pending]");
    process.exit(2);
  }
  try {
    const result = buildAuditOutputs(path.resolve(positional[0]), { allowPending: args.includes("--allow-pending") });
    for (const warning of result.warnings) console.log(`warning: ${warning}`);
    console.log(result.reportPath);
    console.log(result.summaryPath);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
