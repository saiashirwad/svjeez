import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { validateSvg } from "svjeez";

const dir = join(import.meta.dir, "../skills/svjeez/examples");

describe("skill examples", () => {
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".tsx"))) {
    test(`${file} renders a valid, animated SVG`, async () => {
      const { default: build } = (await import(join(dir, file))) as { default: () => string };
      const svg = build();
      expect(validateSvg(svg).errors).toEqual([]);
      expect(svg).toContain("@keyframes");
    });
  }
});
