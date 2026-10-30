import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { validateSvg } from "svjeez";
import { root } from "../helpers/skill";

const examples = join(root, "examples");

describe("skill examples", () => {
  for (const file of readdirSync(examples).filter((name) => name.endsWith(".tsx"))) {
    test(`${file} renders a valid, animated SVG`, async () => {
      const { default: build }: { default: () => string } = await import(join(examples, file));
      const svg = build();
      expect(validateSvg(svg).errors).toEqual([]);
      expect(svg).toContain("@keyframes");
    });
  }
});
