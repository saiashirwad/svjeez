import { describe, expect, test } from "bun:test";
import { compileScene } from "../../src/compile";
import { zeroDurationScene } from "../helpers/live-compile";

describe("compileScene", () => {
  test("a runtime error keeps svjeez's message and carries the skill's fix", async () => {
    const result = await compileScene(zeroDurationScene);

    expect(result.ok ? "" : result.error.message).toContain("to() needs a positive duration");
  });
});
