import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateScore,
  driverFloorFor,
  parseScore,
  sizeForTotal,
} from "./calculate-score.mjs";

test("maps every baseline total boundary", () => {
  const cases = [
    [6, "XS"],
    [9, "XS"],
    [10, "S"],
    [14, "S"],
    [15, "M"],
    [20, "M"],
    [21, "L"],
    [26, "L"],
    [27, "XL"],
    [31, "XL"],
    [32, "XXL"],
    [36, "XXL"],
  ];

  for (const [total, expected] of cases) assert.equal(sizeForTotal(total), expected);
});

test("accepts numeric scores and labels", () => {
  assert.equal(parseScore("1"), 1);
  assert.equal(parseScore("m"), 3);
  assert.equal(parseScore("XXL"), 6);

  assert.deepEqual(calculateScore(["M", 3, "3", "M", 3, 3]), {
    dimensions: {
      changeBreadth: 3,
      technicalNovelty: 3,
      integrationsAndDependencies: 3,
      dataAndStateChange: 3,
      qualityAndOperationalRisk: 3,
      deliveryCoordinationAndReversibility: 3,
    },
    total: 18,
    baselineSize: "M",
    driverGuardrail: { size: "XS", reason: null, applied: false },
    size: "M",
  });
});

test("applies the strongest driver floor", () => {
  const cases = [
    [[1, 1, 1, 1, 1, 1], "XS", null],
    [[5, 1, 1, 1, 1, 1], "M", "one dimension is XL"],
    [[6, 1, 1, 1, 1, 1], "L", "one dimension is XXL"],
    [[5, 5, 1, 1, 1, 1], "XL", "two or more dimensions are XL or higher"],
    [[6, 6, 1, 1, 1, 1], "XXL", "two or more dimensions are XXL"],
  ];

  for (const [scores, size, reason] of cases) {
    assert.deepEqual(driverFloorFor(scores), { size, reason });
  }
});

test("raises the final size without changing the baseline total", () => {
  const concentratedRisk = calculateScore([1, 2, 1, 1, 6, 2]);
  assert.equal(concentratedRisk.total, 13);
  assert.equal(concentratedRisk.baselineSize, "S");
  assert.equal(concentratedRisk.driverGuardrail.size, "L");
  assert.equal(concentratedRisk.driverGuardrail.applied, true);
  assert.equal(concentratedRisk.size, "L");

  const migration = calculateScore([4, 4, 2, 5, 5, 5]);
  assert.equal(migration.total, 25);
  assert.equal(migration.baselineSize, "L");
  assert.equal(migration.driverGuardrail.size, "XL");
  assert.equal(migration.size, "XL");
});

test("does not lower a baseline that already exceeds its driver floor", () => {
  const result = calculateScore([5, 4, 4, 4, 4, 4]);
  assert.equal(result.baselineSize, "L");
  assert.equal(result.driverGuardrail.size, "M");
  assert.equal(result.driverGuardrail.applied, false);
  assert.equal(result.size, "L");
});

test("rejects malformed input", () => {
  assert.throws(() => parseScore("7"), /Invalid score/);
  assert.throws(() => calculateScore([1, 2]), /Expected 6 dimension scores/);
  assert.throws(() => sizeForTotal(5), /Invalid total/);
});
