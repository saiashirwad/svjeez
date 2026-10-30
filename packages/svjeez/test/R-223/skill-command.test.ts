import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cli } from "../helpers/cli";

const skill = readFileSync(join(import.meta.dir, "../../skills/svjeez/SKILL.md"), "utf8");

test("svjeez skill prints the skill", () => {
  expect(cli("skill").stdout.toString()).toBe(skill);
});

test("svjeez skill --install copies the skill, its references and its examples, and can run again", () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-skill-"));

  for (let run = 0; run < 2; run++)
    expect(cli("skill", "--install", "--dir", dir).exitCode).toBe(0);
  expect(readFileSync(join(dir, "svjeez/SKILL.md"), "utf8")).toBe(skill);

  for (const sub of ["examples", "references"]) {
    const shipped = readdirSync(join(import.meta.dir, "../../skills/svjeez", sub)).sort();
    expect(shipped.length).toBeGreaterThan(0);
    expect(readdirSync(join(dir, "svjeez", sub)).sort()).toEqual(shipped);
  }
});
