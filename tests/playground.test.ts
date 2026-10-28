import { describe, expect, test } from "bun:test";
import { compileScene } from "../site/playground/core";
import { examples } from "../site/playground/examples";
import { validateSvg } from "../src/index";

describe("playground", () => {
  for (const example of examples) {
    test(`${example.id} transpiles, renders and validates`, async () => {
      const result = await compileScene(example.source);
      if (!result.ok) throw new Error(`${example.id}: ${result.error.message}`);
      expect(validateSvg(result.svg).errors).toEqual([]);
      expect(result.stats.scriptBytes).toBe(0);
      expect(result.stats.keyframes).toBeGreaterThan(0);
    });
  }

  test("a syntax error reports line and column", async () => {
    const result = await compileScene("const a = 1;\nconst b = ;\nexport default () => a;");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.line).toBe(2);
  });

  test("a library error keeps svjeez's message", async () => {
    const result = await compileScene(`import { render } from "svjeez";\nexport default () => render({ width: 0, height: 10, duration: 1, title: "x" }, <g />);`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("render() needs a positive width");
  });

  test("an unknown import is named", async () => {
    const result = await compileScene(`import x from "lodash";\nexport default () => String(x);`);
    expect(result.ok ? "" : result.error.message).toContain('"lodash"');
  });
});
