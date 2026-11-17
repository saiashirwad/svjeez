import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Miniflare } from "miniflare";

import { bundle } from "../scripts/build.ts";
import { stopped, type Compiled } from "../src/sandbox";

const ROOT = join(import.meta.dir, "..");
const EXAMPLES = join(ROOT, "../packages/svjeez/skills/svjeez/examples");

let sandbox: Miniflare;

beforeAll(async () => {
  await bundle(join(import.meta.dir, "harness.ts"), join(ROOT, "dist/harness.js"));
  sandbox = new Miniflare({
    modules: [{ type: "ESModule", path: join(ROOT, "dist/harness.js") }],
    compatibilityDate: "2026-07-30",
    workerLoaders: { LOADER: {} },
  });
}, 60_000);

afterAll(() => sandbox.dispose());

/** Compiles `source` in the sandbox, in workerd. */
const run = async (source: string): Promise<Compiled> =>
  // SAFETY: the harness answers with compile()'s result as JSON.
  (await (
    await sandbox.dispatchFetch("http://sandbox/", { method: "POST", body: source })
  ).json()) as Compiled;

const error = async (source: string) => {
  const result = await run(source);

  if (result.ok) throw new Error("Expected the compile to fail.");

  return result.error;
};

const HEAD = 'import { enter, render } from "svjeez";\n';

describe("the sandbox", () => {
  test("renders every skill example byte for byte as importing it does", async () => {
    const files = (await readdir(EXAMPLES)).filter((file) => file.endsWith(".tsx"));

    expect(files.length).toBeGreaterThan(4);

    for (const file of files) {
      const direct = (await import(join(EXAMPLES, file))).default();
      const result = await run(await Bun.file(join(EXAMPLES, file)).text());

      expect(result.ok ? result.svg : result.error).toBe(direct);
    }
  }, 60_000);

  test("returns validateSvg's warnings with the SVG", async () => {
    const result = await run(
      `${HEAD}export default () => render({ width: 100, height: 100, duration: 1, title: "t" }, <image href="https://example.com/a.png" width={10} height={10} />);\n`,
    );

    expect(result.ok && result.warnings.join()).toContain("will not load");
  });

  test("places a syntax error on its line and column", async () => {
    expect(await error(`${HEAD}export default function build() {\n  const x = ;\n}\n`)).toEqual({
      kind: "syntax",
      message: "Unexpected token",
      line: 3,
      column: 13,
      excerpt: "     2 | export default function build() {\n>    3 |   const x = ;\n     4 | }",
    });
  });

  test("places a runtime error on the scene's line", async () => {
    const found = await error(
      `${HEAD}const data: any = undefined;\nexport default () => {\n  return data.length;\n};\n`,
    );

    expect(found).toMatchObject({ kind: "runtime", line: 4, column: 15 });
    expect(found.message).toContain("reading 'length'");
    expect(found.excerpt).toContain(">    4 |   return data.length;");
  });

  test("places a library error on the scene's line, past the library's own frames", async () => {
    const found = await error(
      `${HEAD}export default () =>\n  render({ width: 100, height: 100, duration: 2, title: "t" },\n    <rect width={10} height={10} animation={enter({ at: 1, over: 3 })} />);\n`,
    );

    expect(found).toMatchObject({
      kind: "runtime",
      message: "A motion on <rect> runs until 4s, past the 2s scene.",
      line: 3,
    });
  });

  test("refuses an import outside the list, used or not, and names what is allowed", async () => {
    const found = await error(
      `${HEAD}import { readFile } from "node:fs/promises";\nexport default () => "";\n`,
    );

    expect(found).toMatchObject({ kind: "import", line: 2, column: 27 });
    expect(found.message).toContain(
      '"node:fs/promises" is not available here. A scene can import only: svjeez,',
    );
    expect(found.message).toContain("world-atlas/countries-110m.json");
  });

  test("names the import that asks for a missing export", async () => {
    expect(
      await error('import { render, nope } from "svjeez";\nexport default () => nope();\n'),
    ).toMatchObject({
      kind: "runtime",
      line: 1,
    });
  });

  test("has no network, and says so in its own words", async () => {
    const found = await error(
      `${HEAD}export default async () => {\n  await fetch("https://example.com");\n  return "";\n};\n`,
    );

    expect(found).toMatchObject({ kind: "runtime", line: 3 });
    expect(found.message).toStartWith("Scenes have no network");
  });

  test("serves the preloaded fonts and lists them for an unknown one", async () => {
    const fonts = 'import { google } from "@svjeez/fonts";\n';

    const found = await error(
      `${fonts}${HEAD}const face = await google("Roboto");\nexport default () => "";\n`,
    );

    expect(found).toMatchObject({ kind: "runtime", line: 3 });
    expect(found.message).toContain(
      'google("Roboto", { weight: 400, style: "normal" }) is not available',
    );
    expect(found.message).toContain("Inter 400, 500, 600, 700");

    const result = await run(
      `${fonts}${HEAD}const inter = await google("Inter", { weight: 600 });\nexport default () => render({ width: 200, height: 60, duration: 1, title: "t" }, <text x={10} y={40} fontFamily={inter}>office</text>);\n`,
    );

    // Ligatures off: the face is cut down to the glyphs used, so "ffi" does not embed the whole of Inter.
    expect(result.ok && result.svg.length).toBeLessThan(40_000);
  });

  test("draws a world-atlas map projected with d3-geo", async () => {
    const result = await run(
      `import { project } from "@svjeez/geo";\nimport { geoMercator } from "d3-geo";\nimport { rect } from "svjeez/geometry";\nimport world from "world-atlas/countries-110m.json";\n${HEAD}const map = project(world, { frame: rect(0, 0, 960, 540), projection: geoMercator(), filter: (f) => f.properties?.name !== "Antarctica" });\nexport default () => render({ width: 960, height: 540, duration: 1, title: "m" }, <path d={map.part("France").d} />);\n`,
    );

    expect(result.ok).toBe(true);
  });

  test("says what to write when there is no default export", async () => {
    expect((await error(`${HEAD}export const x = 1;\n`)).message).toContain(
      "export default function build()",
    );
  });
});

describe("when the runtime stops a scene", () => {
  test("a real rejection from the sandbox comes back as an error, not a failed request", async () => {
    // workerd ends a scene that waits forever by rejecting the call into it, as production does past a limit.
    const found = await error(
      `${HEAD}export default async () => {\n  await new Promise(() => {});\n};\n`,
    );

    expect(found.kind).toBe("limit");
    expect(found.message).toStartWith("The scene waits on something that never settles");
  });

  test("past the CPU limit, it says where to look", () => {
    expect(stopped("Worker exceeded CPU time limit.").message).toStartWith(
      "The scene ran past the CPU limit of 3 s; a real scene takes well under 0.1 s.",
    );
  });

  test("out of memory, it says so", () => {
    expect(stopped("Worker exceeded memory limit.").message).toStartWith(
      "The scene ran out of memory.",
    );
  });

  test("anything else keeps the runtime's words", () => {
    expect(stopped("Network connection lost.")).toEqual({
      kind: "limit",
      message:
        "The sandbox stopped the scene. Look for a loop that never ends, or far too much work. (The runtime said: Network connection lost.)",
    });
  });
});
