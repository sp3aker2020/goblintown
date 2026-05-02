import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyChaos,
  chaosSummaryForTroll,
  type ChaosClassification,
} from "../chaos-classify.js";

describe("classifyChaos", () => {
  it("detects NO DEFECTS FOUND", () => {
    const cls = classifyChaos(
      "NO DEFECTS FOUND. The artifact is correct and handles all edge cases."
    );
    assert.equal(cls.noDefectsFound, true);
    assert.equal(cls.defects.length, 0);
    assert.equal(cls.severityScore, 0);
  });

  it("detects no defects found (case-insensitive)", () => {
    const cls = classifyChaos("no defect found — every case is covered.");
    assert.equal(cls.noDefectsFound, true);
  });

  it("classifies a numbered list of attacks", () => {
    const input = [
      "1. SQL injection via unsanitized user input in the WHERE clause",
      "2. Off-by-one error in the loop boundary check",
      "3. Performance issue: N+1 query pattern in the fetch loop",
      "4. Style: variable naming is inconsistent (camelCase vs snake_case)",
    ].join("\n");
    const cls = classifyChaos(input);
    assert.equal(cls.noDefectsFound, false);
    assert.equal(cls.defects.length, 4);
    assert.equal(cls.defects[0].severity, "critical"); // injection
    assert.equal(cls.defects[1].severity, "major");    // off-by-one
    assert.equal(cls.defects[2].severity, "minor");    // performance
    assert.equal(cls.defects[3].severity, "nitpick");  // style
    assert.equal(cls.counts.critical, 1);
    assert.equal(cls.counts.major, 1);
    assert.equal(cls.counts.minor, 1);
    assert.equal(cls.counts.nitpick, 1);
    assert.ok(cls.severityScore > 0);
    assert.ok(cls.severityScore <= 1);
  });

  it("classifies bullet lists", () => {
    const input = [
      "- The regex fails on empty strings (edge case)",
      "- Missing null check causes crash on undefined input",
    ].join("\n");
    const cls = classifyChaos(input);
    assert.equal(cls.defects.length, 2);
    assert.equal(cls.defects[0].severity, "major");    // edge case
    assert.equal(cls.defects[1].severity, "critical");  // crash
  });

  it("handles single-blob output as one finding", () => {
    const cls = classifyChaos("This function is completely wrong and will fail.");
    assert.equal(cls.noDefectsFound, false);
    assert.equal(cls.defects.length, 1);
    assert.equal(cls.defects[0].severity, "major"); // "wrong" + "fail"
  });

  it("severityScore caps at 1.0", () => {
    const input = [
      "1. Security vulnerability: XSS via unescaped output",
      "2. Crash on null pointer dereference",
      "3. Data loss when concurrent writes collide",
      "4. Race condition in the cache invalidation",
      "5. Injection possible through the template engine",
    ].join("\n");
    const cls = classifyChaos(input);
    assert.equal(cls.severityScore, 1); // 5 criticals >> cap
  });

  it("returns empty defects for empty input", () => {
    const cls = classifyChaos("");
    assert.equal(cls.noDefectsFound, false);
    assert.equal(cls.defects.length, 0);
    assert.equal(cls.severityScore, 0);
  });
});

describe("chaosSummaryForTroll", () => {
  it("produces clear-pass message for no-defects", () => {
    const cls: ChaosClassification = {
      noDefectsFound: true,
      defects: [],
      counts: { critical: 0, major: 0, minor: 0, nitpick: 0 },
      severityScore: 0,
    };
    const summary = chaosSummaryForTroll(cls);
    assert.ok(summary.includes("NO DEFECTS FOUND"));
    assert.ok(summary.includes("could not break"));
  });

  it("produces structured summary with severity counts", () => {
    const cls = classifyChaos(
      "1. SQL injection in query builder\n" +
      "2. Missing error handling\n" +
      "3. Verbose logging\n"
    );
    const summary = chaosSummaryForTroll(cls);
    assert.ok(summary.includes("3 finding(s)"));
    assert.ok(summary.includes("CRITICAL"));
    assert.ok(summary.includes("Severity score:"));
  });

  it("limits to top 5 most severe findings", () => {
    const lines = Array.from({ length: 8 }, (_, i) =>
      `${i + 1}. Bug number ${i + 1} causes incorrect results`
    ).join("\n");
    const cls = classifyChaos(lines);
    const summary = chaosSummaryForTroll(cls);
    assert.ok(summary.includes("and 3 more"));
  });
});

describe("informedShinies", () => {
  // Quick integration check — the actual reward.test.ts covers shinies deeply
  it("is importable alongside shinies", async () => {
    const { informedShinies } = await import("../reward.js");
    assert.equal(typeof informedShinies, "function");
  });
});
