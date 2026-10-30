import { describe, expect, test } from "bun:test";
import { errorFixes, errorTable, FIXES, fixFor } from "../../src/fixes";
import generated from "../../src/skill-errors";
import { read } from "../helpers/live-compile";

describe("fixes", () => {
  test("the generated table is the skill's, so run `bun run generate` after editing it", () => {
    expect(generated).toBe(errorTable(read("../../../svjeez/skills/svjeez/SKILL.md")));
  });

  test("every runtime error in the skill's table has a fix", () => {
    const skill = read("../../../svjeez/skills/svjeez/SKILL.md");

    const rows =
      skill.slice(skill.indexOf("Runtime errors.")).split("\n## ")[0]!.match(/^\| `/gm) ?? [];

    expect(FIXES.length).toBe(rows.length);
    expect(rows.length).toBeGreaterThan(10);
  });

  test("… in a message matches the value it stands for", () => {
    expect(fixFor("loop(0.5) is shorter than the motion, which runs until 2s.")).toBe(
      "The period must cover every step",
    );
    expect(fixFor("something else")).toBeUndefined();
    expect(errorFixes("no table here")).toEqual([]);
  });
});
