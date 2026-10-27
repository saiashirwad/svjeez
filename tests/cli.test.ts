import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = (...args: string[]) => Bun.spawnSync([process.execPath, join(import.meta.dir, "../src/cli.ts"), ...args]);
const skill = readFileSync(join(import.meta.dir, "../skills/svjeez/SKILL.md"), "utf8");

test("svjeez skill prints the skill", () => {
  expect(cli("skill").stdout.toString()).toBe(skill);
});

test("svjeez skill --install copies the skill and its examples, and can run again", () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-skill-"));
  for (let run = 0; run < 2; run++) expect(cli("skill", "--install", "--dir", dir).exitCode).toBe(0);
  expect(readFileSync(join(dir, "svjeez/SKILL.md"), "utf8")).toBe(skill);
  expect(readdirSync(join(dir, "svjeez/examples")).sort()).toEqual(["orbit.tsx", "review-flow.tsx", "toast.tsx"]);
});
