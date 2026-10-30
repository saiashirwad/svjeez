import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("regenerating writes the committed files", async () => {
  const read = () =>
    ["tabler", "lucide"].map((n) =>
      readFileSync(join(import.meta.dirname, `../../src/${n}.ts`), "utf8"),
    );

  const before = read();

  const run = Bun.spawnSync(["bun", join(import.meta.dirname, "../../scripts/generate.ts")]);

  expect(run.exitCode).toBe(0);
  expect(read()).toEqual(before);
});
