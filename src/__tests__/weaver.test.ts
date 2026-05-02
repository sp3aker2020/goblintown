import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("synthesizePack", () => {
  it("exports synthesizePack function", async () => {
    const { synthesizePack } = await import("../weaver.js");
    assert.equal(typeof synthesizePack, "function");
  });
});
