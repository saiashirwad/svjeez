import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { validateSvg } from "svjeez";
import { compileBuild, compileScene } from "../src/compile";
import { errorFixes, FIXES, fixFor } from "../src/fixes";

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
