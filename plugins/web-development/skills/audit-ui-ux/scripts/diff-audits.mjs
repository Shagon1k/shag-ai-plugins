#!/usr/bin/env node
/**
 * Prepare a re-audit: propose how the previous audit's defects map onto the new audit.
 *
 *   node diff-audits.mjs <previous-audit-dir> <new-audit-dir>
 *
 * Prints a draft for the new audit.json `previous` block. Each previous defect gets a proposed
 * status: "open" when a new defect looks like the same problem, "not-rechecked" when none of
 * its screens were audited again, and "resolved?" otherwise. The "?" marks a proposal: confirm
 * every status against fresh evidence before writing it. The same comparison merges an
 * independent second pass: pass the audit directory first and its pass-2 directory second.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFindings } from "./validate-audit.mjs";

export const PREVIOUS_STATUSES = ["resolved", "open", "partly-resolved", "regressed", "not-rechecked"];

const WORD = /[a-z0-9]+/g;
const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "with", "no", "not", "as", "at", "by", "it"]);

export function tokens(text) {
  return new Set((String(text).toLowerCase().match(WORD) ?? []).filter((word) => word.length > 2 && !STOP.has(word)));
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/** Similarity of two findings from their lens, principles, location, and title. */
export function similarity(previous, current) {
  let score = 0;
  if (previous.lens === current.lens) score += 0.15;
  const sharedPrinciples = (previous.principle ?? []).filter((item) => (current.principle ?? []).includes(item));
  if (sharedPrinciples.length) score += 0.25;
  const locate = (finding) => [finding.location?.component, finding.location?.selector, finding.location?.node].filter(Boolean).join(" ");
  score += 0.3 * jaccard(tokens(locate(previous)), tokens(locate(current)));
  score += 0.3 * jaccard(tokens(`${previous.title} ${previous.location?.description ?? ""}`), tokens(`${current.title} ${current.location?.description ?? ""}`));
  return Math.round(score * 100) / 100;
}

export function proposeComparison(previousAudit, previousFindings, currentAudit, currentFindings, threshold = 0.35) {
  const screenOf = (audit) => new Map((audit.surfaces ?? []).map((surface) => [surface.id, surface.screen]));
  const previousScreens = screenOf(previousAudit);
  const currentScreens = new Set((currentAudit.surfaces ?? []).map((surface) => surface.screen));
  const candidates = currentFindings.filter((finding) => finding.kind === "defect");
  const claimed = new Set();
  const results = previousFindings
    .filter((finding) => finding.kind === "defect")
    .map((previous) => {
      const ranked = candidates
        .map((current) => ({ current, score: similarity(previous, current) }))
        .sort((left, right) => right.score - left.score);
      const best = ranked.find((entry) => entry.score >= threshold && !claimed.has(entry.current.id));
      const screens = [...new Set((previous.surfaces ?? []).map((id) => previousScreens.get(id)).filter(Boolean))];
      const rechecked = screens.some((screen) => currentScreens.has(screen));
      if (best) claimed.add(best.current.id);
      return {
        id: previous.id,
        title: previous.title,
        severity: previous.severity,
        status: best ? "open" : rechecked ? "resolved?" : "not-rechecked",
        now: best?.current.id ?? null,
        nowSeverity: best?.current.severity ?? null,
        score: best?.score ?? ranked[0]?.score ?? 0,
        screens,
      };
    });
  const unmatched = candidates.filter((finding) => !claimed.has(finding.id)).map((finding) => ({ id: finding.id, title: finding.title, severity: finding.severity }));
  return { results, newDefects: unmatched };
}

function loadAudit(dir) {
  const audit = JSON.parse(fs.readFileSync(path.join(dir, "audit.json"), "utf8"));
  const { findings, errors } = readFindings(dir);
  if (errors.length) throw new Error(`${dir}: ${errors.join("; ")}`);
  return { audit, findings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [previousDir, currentDir] = process.argv.slice(2);
  if (!previousDir || !currentDir) {
    console.error("Usage: diff-audits.mjs <previous-audit-dir> <new-audit-dir>");
    process.exit(2);
  }
  try {
    const previous = loadAudit(path.resolve(previousDir));
    const current = loadAudit(path.resolve(currentDir));
    const proposal = proposeComparison(previous.audit, previous.findings, current.audit, current.findings);
    console.log(JSON.stringify({ dir: path.relative(path.resolve(currentDir), path.resolve(previousDir)), ...proposal }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
