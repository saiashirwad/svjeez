import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { validateSvg } from "svjeez";
import { compileBuild, compileScene } from "../src/compile";
import { errorFixes, errorTable, FIXES, fixFor } from "../src/fixes";
import generated from "../src/skill-errors";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("compileScene", () => {
  test("a scene that declares params compiles from its source text with the defaults", async () => {
    const result = await compileScene(read("../../../site/src/lab/a/meadow.tsx"));

    if (!result.ok) throw new Error(result.error.message);
    expect(validateSvg(result.svg).errors).toEqual([]);
    expect(result.stats).toMatchObject({ scriptBytes: 0 });
    expect(result.stats.keyframes).toBeGreaterThan(0);
    expect(result.stats.gzip).toBeLessThan(result.stats.bytes);
  });

  test("sources marks each element with the line that made it", async () => {
    const result = await compileScene(
      `import { render } from "svjeez";\nexport default () => render({ width: 10, height: 10, duration: 1, title: "x" },\n  <rect width={1} height={1} />);`,
      { sources: true },
    );

    expect(result.ok && result.svg).toContain('data-source="3"');
  });

  test("a syntax error reports line and column", async () => {
    const result = await compileScene("const a = 1;\nconst b = ;\nexport default () => a;");

    expect(result.ok ? undefined : result.error).toMatchObject({ kind: "syntax", line: 2 });
  });

  test("a runtime error keeps svjeez's message and carries the skill's fix", async () => {
    const result = await compileScene(
      `import { motion, render } from "svjeez";\nexport default () => render({ width: 10, height: 10, duration: 1, title: "x" }, <rect width={1} height={1} animation={motion({ x: 0 }).to({ x: 1 }, 0)} />);`,
    );

    expect(result.ok ? undefined : result.error).toMatchObject({
      kind: "runtime",
      fix: "Use `.set()` for an instant change",
    });
    expect(result.ok ? "" : result.error.message).toContain("to() needs a positive duration");
  });

  test("an unknown import is named, with what can be imported", async () => {
    const result = await compileScene(`import x from "lodash";\nexport default () => String(x);`);

    expect(result.ok ? "" : result.error.message).toContain('"lodash"');
    expect(result.ok ? "" : result.error.message).toContain('"svjeez/params"');
  });

  test("compileBuild measures what a build returns, or reports what it throws", async () => {
    expect(await compileBuild(() => "<svg/>")).toMatchObject({ ok: true, stats: { bytes: 6 } });
    expect(
      await compileBuild(() => {
        throw new Error("nope");
      }),
    ).toMatchObject({ ok: false, error: { kind: "runtime", message: "nope" } });
  });
});

describe("fixes", () => {
  test("the generated table is the skill's, so run `bun run generate` after editing it", () => {
    expect(generated).toBe(errorTable(read("../../svjeez/skills/svjeez/SKILL.md")));
  });

  test("every runtime error in the skill's table has a fix", () => {
    const skill = read("../../svjeez/skills/svjeez/SKILL.md");

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

describe("what a scene declares", () => {
  test("a compile reports the scene's size and length, its params, and where each param's handle sits and moves", async () => {
    const result = await compileScene(read("../../site/src/lab/live/pendulum.tsx"));

    if (!result.ok) throw new Error(result.error.message);
    expect(result.scene).toMatchObject({ width: 480, height: 320, title: "Pendulum" });
    expect(Object.keys(result.params ?? {})).toEqual(["length", "swing", "bob"]);
    // The length handle sits at the bottom of the arc, 190 below the pivot at (240, 36), and moves straight down.
    expect(result.handles?.length?.at).toEqual({ x: 240, y: 226 });
    expect(result.handles?.length?.way.x).toBeCloseTo(0);
    expect(result.handles?.length?.way.y).toBeCloseTo(1);
  });
});
