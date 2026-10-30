import { describe, expect, test } from "bun:test";
import { compileScene } from "../../src/compile";
import { zeroDurationScene } from "../helpers/live-compile";

describe("compileScene", () => {
  test("a syntax error reports line and column", async () => {
    const result = await compileScene("const a = 1;\nconst b = ;\nexport default () => a;");

    expect(result.ok ? undefined : result.error).toMatchObject({ kind: "syntax", line: 2 });
  });

  test("a runtime error keeps svjeez's message and carries the skill's fix", async () => {
    const result = await compileScene(zeroDurationScene);

    expect(result.ok ? undefined : result.error).toMatchObject({
      kind: "runtime",
      fix: "Use `.set()` for an instant change",
    });
    expect(result.ok ? "" : result.error.message).toContain("to() needs a positive duration");
  });
});
