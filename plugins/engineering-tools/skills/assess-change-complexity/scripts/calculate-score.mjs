#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

export const DIMENSIONS = [
  "changeBreadth",
  "technicalNovelty",
  "integrationsAndDependencies",
  "dataAndStateChange",
  "qualityAndOperationalRisk",
  "deliveryCoordinationAndReversibility",
];

const LABELS = ["XS", "S", "M", "L", "XL", "XXL"];

export function parseScore(value) {
  const normalized = String(value).trim().toUpperCase();
  const labelIndex = LABELS.indexOf(normalized);
  if (labelIndex !== -1) return labelIndex + 1;

  const score = Number(normalized);
  if (Number.isInteger(score) && score >= 1 && score <= 6) return score;

  throw new Error(`Invalid score "${value}"; expected 1-6 or XS-XXL`);
}

export function sizeForTotal(total) {
  if (!Number.isInteger(total) || total < 6 || total > 36) {
    throw new Error(`Invalid total "${total}"; expected an integer from 6 to 36`);
  }
  if (total <= 9) return "XS";
  if (total <= 14) return "S";
  if (total <= 20) return "M";
  if (total <= 26) return "L";
  if (total <= 31) return "XL";
  return "XXL";
}

export function driverFloorFor(scores) {
  const parsed = scores.map(parseScore);
  const xxlCount = parsed.filter((score) => score === 6).length;
  const xlOrHigherCount = parsed.filter((score) => score >= 5).length;

  if (xxlCount >= 2) {
    return { size: "XXL", reason: "two or more dimensions are XXL" };
  }
  if (xlOrHigherCount >= 2) {
    return { size: "XL", reason: "two or more dimensions are XL or higher" };
  }
  if (xxlCount === 1) {
    return { size: "L", reason: "one dimension is XXL" };
  }
  if (xlOrHigherCount === 1) {
    return { size: "M", reason: "one dimension is XL" };
  }
  return { size: "XS", reason: null };
}

function higherSize(left, right) {
  return LABELS.indexOf(left) >= LABELS.indexOf(right) ? left : right;
}

export function calculateScore(values) {
  if (values.length !== DIMENSIONS.length) {
    throw new Error(`Expected ${DIMENSIONS.length} dimension scores, received ${values.length}`);
  }

  const scores = values.map(parseScore);
  const dimensions = Object.fromEntries(DIMENSIONS.map((name, index) => [name, scores[index]]));
  const total = scores.reduce((sum, score) => sum + score, 0);
  const baselineSize = sizeForTotal(total);
  const driverGuardrail = driverFloorFor(scores);
  const size = higherSize(baselineSize, driverGuardrail.size);

  return {
    dimensions,
    total,
    baselineSize,
    driverGuardrail: {
      ...driverGuardrail,
      applied: size !== baselineSize,
    },
    size,
  };
}

function printUsage() {
  console.error(
    "Usage: calculate-score.mjs <breadth> <novelty> <integrations> <data> <operations> <delivery> [--json]",
  );
}

export function main(args) {
  const json = args.includes("--json");
  const values = args.filter((arg) => arg !== "--json");

  try {
    const result = calculateScore(values);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Size: ${result.size}`);
      console.log(`Baseline: ${result.baselineSize} (${result.total}/36)`);
      if (result.driverGuardrail.reason) {
        const effect = result.driverGuardrail.applied ? "applied" : "already satisfied";
        console.log(
          `Driver floor: ${result.driverGuardrail.size} (${result.driverGuardrail.reason}; ${effect})`,
        );
      }
    }
    return 0;
  } catch (error) {
    printUsage();
    console.error(error.message);
    return 1;
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) process.exitCode = main(process.argv.slice(2));
