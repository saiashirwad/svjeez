import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { compileScene } from "@svjeez/live/compile";
import { validateSvg } from "svjeez";

const dir = new URL("examples/", import.meta.url);

const examples = readdirSync(dir).map((file) => ({
  id: file.replace(".tsx.txt", ""),
  source: readFileSync(new URL(file, dir), "utf8"),
}));

describe("playground examples", () => {
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
});
