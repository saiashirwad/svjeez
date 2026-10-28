import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { validateSvg } from "svjeez";
import { compileScene } from "./core";

const dir = new URL("examples/", import.meta.url);
const examples = readdirSync(dir).map((file) => ({ id: file.replace(".tsx.txt", ""), source: readFileSync(new URL(file, dir), "utf8") }));

describe("playground", () => {
  test("the examples are there", () => expect(examples.length).toBeGreaterThan(0));

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
