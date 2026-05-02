import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("reviseGoblin", () => {
  it("exports reviseGoblin function", async () => {
    const { reviseGoblin } = await import("../revise.js");
    assert.equal(typeof reviseGoblin, "function");
  });
});
