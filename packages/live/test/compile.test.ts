import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { validateSvg } from "svjeez/frames";
import { Group, hitTest, scene } from "svjeez/scene";
import { jsx } from "svjeez/scene/jsx-runtime";
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

  test("a template with text and list params compiles with its defaults and reports its schema", async () => {
    const result = await compileScene(
      'import { render } from "svjeez";\nimport { defaults, list, number, text, type Values } from "svjeez/params";\n\nexport const params = {\n  title: text("Launch", { maxLength: 24 }),\n  bars: list(\n    { label: text("Q1"), value: number(4, { min: 0, max: 100 }) },\n    [{ label: "Q1", value: 40 }, { label: "Q2", value: 70 }],\n    { min: 1, max: 8 },\n  ),\n};\n\nexport default (p: Values<typeof params> = defaults(params)) =>\n  render(\n    { width: 200, height: 100, duration: 1, title: p.title },\n    <>{p.bars.map((bar, i) => <rect x={i * 20} y={100 - bar.value} width={16} height={bar.value} />)}</>,\n  );\n',
    );

    if (!result.ok) throw new Error(result.error.message);
    expect(result.svg).toContain(">Launch</title>");
    expect(result.params?.bars).toMatchObject({ kind: "list", min: 1, max: 8 });
    expect(structuredClone(result.params)).toEqual(result.params);
  });

  test("sources marks each element with the line that made it", async () => {
    const result = await compileScene(
      `import { render } from "svjeez";\nexport default () => render({ width: 10, height: 10, duration: 1, title: "x" },\n  <rect width={1} height={1} />);`,
      { sources: true },
    );

    expect(result.ok && result.svg).toContain('data-source="3"');
  });

  test("a scene can import world-atlas's maps", async () => {
    const result = await compileScene(
      `import land from "world-atlas/land-110m.json";\nimport { render } from "svjeez";\nexport default () => render({ width: 10, height: 10, duration: 1, title: "x" }, <text>{land.type}</text>);`,
    );

    expect(result.ok && result.svg).toContain("Topology");
  });

  test("a scene model compiles under its file's @jsxImportSource, and reports its size", async () => {
    const result = await compileScene(
      `/** @jsxImportSource svjeez/scene */\nimport { Shape, circle, enter, rect, scene, span } from "svjeez/scene";\n\nexport default scene({ size: [200, 120], duration: 4, title: "Hello" }, () => (\n  <>\n    <Shape geometry={rect(200, 120)} fill="#101010" />\n    <Shape geometry={circle(8)} at={[100, 40]} anchor="center" fill="#3EE6D6" motion={enter(span(1.2, 0.5), { scale: 0 })} />\n  </>\n));\n`,
    );

    if (!result.ok) throw new Error(result.error.message);
    expect(validateSvg(result.svg).errors).toEqual([]);
    expect(result.svg).toContain('<title id="t">Hello</title>');
    expect(result.scene).toEqual({ width: 200, height: 120, duration: 4, title: "Hello" });
    expect(result.stats.keyframes).toBeGreaterThan(0);
  });

  test("a scene model reports each node's box and the line that wrote it, and writes them with sources", async () => {
    const text = `/** @jsxImportSource svjeez/scene */\nimport { Shape, rect, scene } from "svjeez/scene";\n\nexport default scene({ size: [200, 120], duration: 1, title: "x" }, () => (\n  <>\n    <Shape key="back" geometry={rect(200, 120)} />\n    <Shape key="dot" geometry={rect(10, 10)} at={[50, 40]} />\n  </>\n));\n`;
    const result = await compileScene(text);

    if (!result.ok) throw new Error(result.error.message);
    expect(result.svg).not.toContain("data-key");
    const dot = hitTest(result.nodes ?? [], [55, 45]);

    expect(dot).toMatchObject({ key: "dot", box: { x: 50, y: 40, width: 10, height: 10 } });
    expect(dot?.source).toEqual({ file: "", line: 7 });
    expect(structuredClone(result.nodes)).toEqual(result.nodes);

    const traced = await compileScene(text, { sources: true });

    expect(traced.ok && traced.svg).toContain('data-key="dot" data-source="7"');
  });

  test("a default export that is neither a scene nor a function says what to write", async () => {
    const result = await compileScene("export default 42;");

    expect(result.ok ? undefined : result.error.message).toContain("export default scene(");
  });

  test("a syntax error reports line and column", async () => {
    const result = await compileScene("const a = 1;\nconst b = ;\nexport default () => a;");

    expect(result.ok ? undefined : result.error).toMatchObject({ kind: "syntax", line: 2 });
  });

  test("a runtime error keeps svjeez's message and carries the skill's fix", async () => {
    const result = await compileScene(
      `import { motion, render } from "svjeez";\nexport default () => render({ width: 10, height: 10, duration: 1, title: "x" }, <rect width={1} height={1} animation={motion({ x: 0 }).to({ x: 1 }, { at: 0, over: 0 })} />);`,
    );

    expect(result.ok ? undefined : result.error).toMatchObject({
      kind: "runtime",
      fix: "Use `.set(values, at)` for an instant change",
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
      await compileBuild(() =>
        scene({ size: [10, 20], duration: 1, title: "x" }, () => jsx(Group, {})),
      ),
    ).toMatchObject({ ok: true, scene: { width: 10, height: 20, duration: 1, title: "x" } });
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
    const result = await compileScene(read("../../../site/src/lab/live/pendulum.tsx"));

    if (!result.ok) throw new Error(result.error.message);
    expect(result.scene).toMatchObject({ width: 480, height: 320, title: "Pendulum" });
    expect(Object.keys(result.params ?? {})).toEqual(["length", "swing", "bob"]);
    // The length handle sits at the bottom of the arc, 190 below the pivot at (240, 36), and moves straight down.
    expect(result.handles?.length?.at).toEqual({ x: 240, y: 226 });
    expect(result.handles?.length?.way.x).toBeCloseTo(0);
    expect(result.handles?.length?.way.y).toBeCloseTo(1);
  });
});
