import { describe, expect, test } from "bun:test";
import vm from "node:vm";
import { Effect } from "effect";
import * as svjeez from "svjeez";
import * as jsxDevRuntime from "svjeez/jsx-dev-runtime";
import * as tools from "svjeez/tools";
import {
  BrowserRunner,
  BunRunner,
  CompileError,
  RenderError,
  WorkerLoaderRunner,
  compile,
} from "../src/index.ts";
import type {
  CompileOptions,
  Files,
  WorkerCode,
  WorkerEntrypoint,
  WorkerLoader,
} from "../src/index.ts";
import { instantiate } from "../src/commonjs.ts";
import type { Define } from "../src/commonjs.ts";
import type { Namespace } from "../src/program.ts";

const SCENE = `import { Shape, rect, scene } from "svjeez";

export default scene({ size: [100, 80], duration: 1, title: "T" }, () => (
  <Shape id="box" geometry={rect(40, 30)} fill="#ff0000" />
));
`;

const CARD = `import { Group, Shape, component, rect } from "svjeez";

const label = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => ({ value }),
    jsonSchema: {
      input: () => ({ type: "object", properties: { label: { type: "string" } } }),
      output: () => ({}),
    },
  },
};

export const NoteCard = component({
  name: "NoteCard",
  props: label,
  render: ({ label }) => (
    <Group id="back">
      <Shape id="plate" geometry={rect(60, 20)} fill="#eeeeee" />
      <Shape id="note" geometry={rect(label.length, 4)} fill="#000000" />
    </Group>
  ),
});
`;

const GROUP = `import { Group } from "svjeez";
import { NoteCard } from "../components/NoteCard.tsx";

export const Group = () => (
  <Group id="all">
    <NoteCard id="one" label="Hello" />
  </Group>
);
`;

const MULTI: Files = {
  "scene.tsx": `import { scene } from "svjeez";
import { Group } from "./groups/card";

export default scene({ size: [200, 100], duration: 1, title: "T" }, () => <Group />);
`,
  "groups/card.tsx": GROUP.replace("import { Layer, scene }", "import { Group }"),
  "components/NoteCard.tsx": CARD,
};

const options: CompileOptions = { entry: "scene.tsx" };

const compiled = (files: Files, opts: CompileOptions = options) =>
  compile(files, opts).pipe(Effect.provide(BunRunner));

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

const failed = async (files: Files, opts: CompileOptions = options) => {
  const error = await run(Effect.flip(compiled(files, opts)));

  if (!(error instanceof CompileError)) throw new Error(`expected a CompileError, got ${error}`);

  return error;
};

const place = (error: CompileError) => `${error.file}:${error.line}:${error.col}`;

describe("compile", () => {
  test("renders a single file with data-svz-id", async () => {
    const program = await run(compiled({ "scene.tsx": SCENE }));
    const svg = await run(program.render());

    expect(svg).toStartWith("<svg");
    expect(svg).toContain('data-svz-id="box"');
  });

  test("leaves ids out when asked", async () => {
    const program = await run(compiled({ "scene.tsx": SCENE }, { ...options, ids: false }));

    expect(await run(program.render())).not.toContain("data-svz-id");
  });

  test("renders files that import each other across folders, with extensions or without", async () => {
    const program = await run(compiled(MULTI));
    const svg = await run(program.render());

    expect(svg).toContain('data-svz-id="one/back"');
    expect(svg).toContain('data-svz-id="one/note"');
  });

  test("finds components by name in every file, with their JSON Schema", async () => {
    const program = await run(compiled(MULTI));

    expect(Object.keys(program.components)).toEqual(["NoteCard"]);
    expect(program.components["NoteCard"]?.jsonSchema).toEqual({
      type: "object",
      properties: { label: { type: "string" } },
    });
    expect(program.components["NoteCard"]?.props).toBeDefined();
  });

  test("reads params declared with param.*, and passes the checked values to the scene", async () => {
    const program = await run(
      compiled({
        "scene.tsx": `import { Shape, param, rect, scene } from "svjeez";

export const params = {
  width: param.number(40, { min: 10, max: 90 }),
  tone: param.choice("red", ["red", "blue"]),
};

export default ({ width, tone }) =>
  scene({ size: [100, 80], duration: 1, title: "T" }, () => (
    <Shape id="box" geometry={rect(width, 30)} fill="#ff0000" />
  ));
`,
      }),
    );

    expect(program.params).toMatchObject({
      type: "object",
      properties: {
        width: { type: "number", minimum: 10, maximum: 90, default: 40 },
        tone: { type: "string", enum: ["red", "blue"], default: "red" },
      },
    });
    expect(await run(program.render({ width: 80, tone: "blue" }))).toContain('width="80"');
    expect(await run(program.render())).toContain('width="40"');

    const error = await run(Effect.flip(program.render({ width: 500 })));

    expect(error).toBeInstanceOf(RenderError);
    expect(error.message).toContain("width");
  });

  test("reads params declared as a Standard JSON Schema", async () => {
    const program = await run(
      compiled({
        "scene.tsx": `import { Shape, rect, scene } from "svjeez";

export const params = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => (typeof value.size === "number" ? { value } : { issues: [{ message: "size must be a number" }] }),
    jsonSchema: { input: () => ({ type: "object", required: ["size"] }), output: () => ({}) },
  },
};

export default ({ size }) =>
  scene({ size: [100, 80], duration: 1, title: "T" }, () => <Shape id="box" geometry={rect(size, 30)} fill="#ff0000" />);
`,
      }),
    );

    expect(program.params).toEqual({ type: "object", required: ["size"] });
    expect(await run(program.render({ size: 25 }))).toContain('width="25"');
    expect((await run(Effect.flip(program.render({})))).message).toContain("size must be a number");
  });

  test("a scene that declares nothing has no params", async () => {
    const program = await run(compiled({ "scene.tsx": SCENE }));

    expect(program.params).toEqual({ type: "object", properties: {}, additionalProperties: false });
    expect(program.components).toEqual({});
  });

  test("a render that throws is a RenderError that names the node", async () => {
    const program = await run(
      compiled({
        "scene.tsx": `import { Shape, rect, scene } from "svjeez";

export default () =>
  scene({ size: [100, 80], duration: 1, title: "T" }, () => (
    <Shape id="box" geometry={rect(-5, 30)} fill="#ff0000" />
  ));
`,
      }),
    );

    const error = await run(Effect.flip(program.render()));

    expect(error).toBeInstanceOf(RenderError);
    expect(error.message).toContain("rect()");
  });

  test("a function entry that returns no scene is a RenderError", async () => {
    const program = await run(compiled({ "scene.tsx": "export default () => 1;\n" }));
    const error = await run(Effect.flip(program.render()));

    expect(error).toBeInstanceOf(RenderError);
    expect(error.message).toContain("default export");
  });
});

describe("imports", () => {
  test("refuse a package outside the allowlist, at the import", async () => {
    const error = await failed({
      "scene.tsx": `import { scene } from "svjeez";\nimport fs from "node:fs";\n\nexport default scene({ size: [1, 1], duration: 1, title: "T" }, () => null);\n`,
    });

    expect(place(error)).toBe("scene.tsx:2:16");
    expect(error.message).toContain("node:fs");
  });

  test("allow what the host's allowlist lets through", async () => {
    const program = await run(
      compiled(
        { "scene.tsx": `import { answer } from "extra";\nexport default () => answer;\n` },
        { ...options, modules: (name) => name === "extra" },
      ).pipe(Effect.flip),
    );

    // The allowlist passed it; the runner then could not find the package.
    expect(program).toBeInstanceOf(CompileError);
    expect(program.message).not.toContain("not available");
  });

  test("refuse a relative import that matches no file, at the import", async () => {
    const error = await failed({
      "scene.tsx": `import { Missing } from "./nope";\nexport default Missing;\n`,
    });

    expect(place(error)).toBe("scene.tsx:1:25");
    expect(error.message).toContain("./nope");
  });

  test("refuse an import that climbs out of the files", async () => {
    const error = await failed({
      "scene.tsx": `import "../outside";\n`,
    });

    expect(place(error)).toBe("scene.tsx:1:8");
  });

  test("refuse an entry that is not a file", async () => {
    const error = await failed({ "scene.tsx": SCENE }, { entry: "other.tsx" });

    expect(error.file).toBe("other.tsx");
  });
});

describe("static scan", () => {
  const scan = (code: string) =>
    failed({ "scene.tsx": `import { scene } from "svjeez";\n${code}\n` });

  test("refuses eval", async () => {
    const error = await scan("export const x = eval('1');");

    expect(place(error)).toBe("scene.tsx:2:18");
    expect(error.message).toContain("eval");
  });

  test("refuses new Function", async () => {
    const error = await scan("export const f = new Function('return 1');");

    expect(place(error)).toBe("scene.tsx:2:22");
  });

  test("refuses globalThis, process and require", async () => {
    expect(place(await scan("export const g = globalThis;"))).toBe("scene.tsx:2:18");
    expect(place(await scan("export const p = process.env;"))).toBe("scene.tsx:2:18");
    expect(place(await scan("export const r = require('fs');"))).toBe("scene.tsx:2:18");
  });

  test("refuses __proto__ and import()", async () => {
    expect(place(await scan("const o = {}; o.__proto__ = {};"))).toBe("scene.tsx:2:17");
    expect(place(await scan("export const m = import('x');"))).toBe("scene.tsx:2:18");
  });

  test("does not mistake a string, a comment or a type for the name", async () => {
    const program = await run(
      compiled({
        "scene.tsx": `import { Shape, rect, scene } from "svjeez";\n// eval process globalThis\nconst note: Function | undefined = undefined;\nconst text = "eval(require)";\nconst o = { process: 1 };\nexport default scene({ size: [10, 10], duration: 1, title: "T" }, () => <Shape id="box" geometry={rect(o.process, 1)} fill="#ff0000" />);\n`,
      }),
    );

    expect(await run(program.render())).toContain("data-svz-id");
  });
});

describe("loop guard", () => {
  test("stops while (true) {} instead of hanging", async () => {
    const started = performance.now();

    const error = await failed(
      { "scene.tsx": `while (true) {}\nexport default null;\n` },
      { ...options, maxLoopIterations: 10_000 },
    );

    expect(error.message).toContain("10000 iterations");
    expect(place(error)).toStartWith("scene.tsx:1:");
    expect(performance.now() - started).toBeLessThan(2000);
  });

  test("stops a loop that runs while rendering, and the next render starts a new count", async () => {
    const program = await run(
      compiled(
        {
          "scene.tsx": `import { Shape, rect, scene } from "svjeez";

export default ({ n }) =>
  scene({ size: [100, 80], duration: 1, title: "T" }, () => {
    let width = 1;
    for (let i = 0; i < n; i++) width += 1;
    do { width += 0; } while (false);

    return <Shape id="box" geometry={rect(width, 5)} fill="#ff0000" />;
  });

export const params = { n: { kind: "number", value: 100, min: 0, max: 1e9, step: 1 } };
`,
        },
        { ...options, maxLoopIterations: 1000 },
      ),
    );

    expect(await run(program.render({ n: 500 }))).toContain('width="501"');
    expect(await run(program.render({ n: 500 }))).toContain('width="501"');

    const error = await run(Effect.flip(program.render({ n: 5000 })));

    expect(error.message).toContain("1000 iterations");
  });

  test("guards loops without braces and nested loops", async () => {
    const error = await failed(
      { "scene.tsx": `for (let i = 0; i < 3; i++) for (;;) i++;\nexport default null;\n` },
      { ...options, maxLoopIterations: 100 },
    );

    expect(error.message).toContain("100 iterations");
  });
});

describe("loop guard with an empty body", () => {
  const endless = `{ [Symbol.iterator]: () => ({ next: () => ({ done: false, value: 1 }) }) }`;

  test.each([
    ["for (;;);", `for (;;);`],
    ["while (true);", `while (true);`],
    ["for (const x of y);", `for (const x of ${endless});`],
    ["do ; while (true)", `do ; while (true)`],
  ])("stops %s", async (_name, loop) => {
    const error = await failed(
      { "scene.tsx": `${loop}\nexport default null;\n` },
      { ...options, maxLoopIterations: 100 },
    );

    expect(error.message).toContain("100 iterations");
  });
});

describe("imports of files that are not code", () => {
  test("refuses ./d.json at compile time, naming the import", async () => {
    const error = await failed({
      "scene.tsx": `import data from "./d.json";\nexport default data;\n`,
      "d.json": `{"a": 1}`,
    });

    expect(error.message).toContain("is not code");
    expect(place(error)).toStartWith("scene.tsx:1:");
  });
});

describe("reserved names", () => {
  test.each([
    `const __svzTick = () => {};`,
    `function __svzTick() {}`,
    `const o = { __svzTick: 1 };`,
    `const x = __svzTick;`,
  ])("refuses %s, so a scene cannot switch off the loop guard", async (code) => {
    const error = await failed({ "scene.tsx": `${code}\nwhile (true) {}\nexport default null;\n` });

    expect(error.message).toContain("__svz");
    expect(place(error)).toStartWith("scene.tsx:1:");
  });
});

describe("errors", () => {
  test("a syntax error is at its file, line and column", async () => {
    const error = await failed({
      "scene.tsx": `import { scene } from "svjeez";\n\nexport const a = (;\n`,
    });

    expect(error.file).toBe("scene.tsx");
    expect(error.line).toBe(3);
    expect(error.col).toBeGreaterThan(0);
  });

  test("a syntax error in another file names that file", async () => {
    const error = await failed({
      ...MULTI,
      "components/NoteCard.tsx": `export const x = <div>;\n`,
    });

    expect(error.file).toBe("components/NoteCard.tsx");
    expect(error.line).toBe(1);
  });

  test("a module that throws as it loads is at the line that threw", async () => {
    const error = await failed({
      "scene.tsx": `import { scene } from "svjeez";\n\nconst a = 1;\nthrow new Error("boom");\n`,
    });

    expect(error.message).toBe("boom");
    expect(error.file).toBe("scene.tsx");
    expect(error.line).toBe(4);
  });

  test("a module in a folder that throws as it loads is at its own file", async () => {
    const error = await failed({
      "scene.tsx": `import "./deep/inner";\nexport default null;\n`,
      "deep/inner.ts": `export const a: number = 1;\n\nthrow new Error("deep");\n`,
    });

    expect(place(error)).toStartWith("deep/inner.ts:3:");
  });
});

describe("BrowserRunner", () => {
  test("runs a multi-file scene with new Function", async () => {
    const program = await run(compile(MULTI, options).pipe(Effect.provide(BrowserRunner)));
    const svg = await run(program.render());

    expect(svg).toContain('data-svz-id="one/note"');
    expect(Object.keys(program.components)).toEqual(["NoteCard"]);
  });

  test("reports where a module threw, past the lines new Function adds", async () => {
    const error = await run(
      Effect.flip(
        compile({ "scene.tsx": `\n\nthrow new Error("late");\n` }, options).pipe(
          Effect.provide(BrowserRunner),
        ),
      ),
    );

    expect(place(error)).toStartWith("scene.tsx:3:");
  });
});

const isEntrypoint = (value: Namespace[string] | undefined): value is WorkerEntrypoint =>
  typeof value === "object" && value !== null && "fetch" in value;

/** A stand-in for `env.LOADER` that records what it was asked to start, and runs the worker in this process. */
const fakeLoader = () => {
  const codes: WorkerCode[] = [];
  const ids: string[] = [];

  const engine: Define = {
    name: "vm",
    define: (code, path) =>
      // SAFETY: compiled with those two parameters.
      vm.compileFunction(code, ["require", "exports"], { filename: path }) as ReturnType<
        Define["define"]
      >,
  };

  const libraries = {
    svjeez,
    "svjeez/jsx-dev-runtime": jsxDevRuntime,
    "svjeez/tools": tools,
  } satisfies Readonly<Record<string, Namespace>>;

  const loader: WorkerLoader = {
    get: (id, code) => {
      ids.push(id);

      return {
        getEntrypoint: () => ({
          fetch: async (request) => {
            const worker = await code();

            codes.push(worker);

            const files = Object.fromEntries(
              Object.entries(worker.modules)
                .filter(([name]) => !name.startsWith("@lib/"))
                .map(([name, { js }]) => [`/${name}`, js]),
            );

            try {
              const { entry } = instantiate(
                { entry: `/${worker.mainModule}`, files, libraries: [] },
                libraries,
                engine,
              );

              const host = entry["default"];

              if (!isEntrypoint(host)) throw new Error("The host module has no fetch.");

              return await host.fetch(request);
            } catch (thrown) {
              // A real isolate answers a module that throws with its message and a frame in the file.
              if (!(thrown instanceof CompileError)) throw thrown;

              throw new Error(
                `${thrown.message}\n    at /${thrown.file}:${thrown.line}:${thrown.col}`,
              );
            }
          },
        }),
      };
    },
  };

  return { loader, codes, ids };
};

const BUNDLES = {
  svjeez: "// bundle",
  "svjeez/jsx-dev-runtime": "// bundle",
  "svjeez/tools": "// bundle",
};

describe("WorkerLoaderRunner", () => {
  test("starts an isolate with no network, every module by name and imports by absolute path", async () => {
    const { loader, codes } = fakeLoader();

    const program = await run(
      compile(MULTI, options).pipe(
        Effect.provide(WorkerLoaderRunner(loader, { libraries: BUNDLES, cpuMs: 50 })),
      ),
    );

    const worker = codes[0];

    expect(worker?.globalOutbound).toBeNull();
    expect(worker?.mainModule).toBe("@host.js");
    expect(worker?.limits).toEqual({ cpuMs: 50 });

    expect(Object.keys(worker?.modules ?? {}).sort()).toEqual([
      "@guard.js",
      "@host.js",
      "@lib/svjeez",
      "@lib/svjeez/jsx-dev-runtime",
      "@lib/svjeez/tools",
      "components/NoteCard.tsx",
      "groups/card.tsx",
      "scene.tsx",
    ]);

    // A file in a folder names its neighbours and the libraries by path from the root, not from its own folder.
    const card = worker?.modules["groups/card.tsx"]?.js ?? "";

    expect(card).toContain('from "/components/NoteCard.tsx"');
    expect(card).toContain('from "/@lib/svjeez"');
    expect(card).toContain('from "/@lib/svjeez/jsx-dev-runtime"');
    expect(card).not.toContain('"../');
    expect(worker?.modules["scene.tsx"]?.js).toContain('from "/groups/card.tsx"');

    expect(await program.render({})).toBeDefined();
  });

  test("draws, describes and reports through the isolate", async () => {
    const { loader } = fakeLoader();
    const layer = WorkerLoaderRunner(loader, { libraries: BUNDLES });

    const program = await run(compile(MULTI, options).pipe(Effect.provide(layer)));

    expect(await run(program.render())).toContain('data-svz-id="one/back"');
    expect(program.components["NoteCard"]?.jsonSchema).toEqual({
      type: "object",
      properties: { label: { type: "string" } },
    });
    expect(program.params).toEqual({ type: "object", properties: {}, additionalProperties: false });

    const params = await run(
      compile(
        {
          "scene.tsx": `import { Shape, param, rect, scene } from "svjeez";
export const params = { width: param.number(40, { min: 10, max: 90 }) };
export default ({ width }) => scene({ size: [100, 80], duration: 1, title: "T" }, () => <Shape id="box" geometry={rect(width, 5)} fill="#ff0000" />);
`,
        },
        options,
      ).pipe(Effect.provide(layer)),
    );

    expect(params.params).toMatchObject({ properties: { width: { type: "number", maximum: 90 } } });
    expect(await run(params.render({ width: 70 }))).toContain('width="70"');
    expect((await run(Effect.flip(params.render({ width: 500 })))).message).toContain("width");
  });

  test("asks for a bundle of every library the scene imports", async () => {
    const { loader } = fakeLoader();

    const error = await run(
      Effect.flip(
        compile(MULTI, options).pipe(Effect.provide(WorkerLoaderRunner(loader, { libraries: {} }))),
      ),
    );

    expect(error).toBeInstanceOf(CompileError);
    expect(error.message).toContain('"svjeez"');
  });

  test("reuses a worker for the same files", async () => {
    const { loader, ids } = fakeLoader();
    const layer = WorkerLoaderRunner(loader, { libraries: BUNDLES });

    await run(compile(MULTI, options).pipe(Effect.provide(layer)));
    await run(compile(MULTI, options).pipe(Effect.provide(layer)));
    await run(compile({ "scene.tsx": SCENE }, options).pipe(Effect.provide(layer)));

    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
  });

  test("reports a module that throws as it loads in the isolate", async () => {
    const { loader } = fakeLoader();

    const error = await run(
      Effect.flip(
        compile({ "scene.tsx": `\nthrow new Error("late");\n` }, options).pipe(
          Effect.provide(WorkerLoaderRunner(loader, { libraries: BUNDLES })),
        ),
      ),
    );

    expect(error).toBeInstanceOf(CompileError);
    expect(place(error)).toStartWith("scene.tsx:2:");
  });
});
