import { afterAll, beforeAll, expect, test } from "bun:test";
import { Effect } from "effect";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile, pack } from "../scripts/binary.ts";
import * as Services from "../../../scripts/services.ts";

// Builds the binary for this machine once, then runs it on scenes in a temp folder (behind a symlink on macOS, where
// /var is /private/var) with no package.json, node_modules or tsconfig.

let bin = "";
let dir = "";

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "svjeez-bin-"));
  bin = await Effect.runPromise(
    pack("0.0.0-test").pipe(
      Effect.andThen(compile("0.0.0-test", undefined, join(dir, "out"))),
      Effect.provide(Services.layer),
    ),
  );
}, 120_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const run = (...args: string[]) => {
  const result = Bun.spawnSync([bin, ...args], { cwd: dir, stdout: "pipe", stderr: "pipe" });

  return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
};

const write = (name: string, text: string): string => {
  writeFileSync(join(dir, name), text);

  return name;
};

test("version names the build", () => {
  expect(run("version").out).toContain("0.0.0-test (single-file binary");
});

test("check reports type errors at their line, with a fix, and exits 1", () => {
  const file = write(
    "typed.tsx",
    `import { Shape, circle, scene } from "svjeez";

const COLORS: readonly string[] = ["#FF0000"];

export default scene({ size: [100, 100], duration: 1, loop: false, title: "T", desc: "D" }, () => (
  <Shape geometry={circle(5)} at={[50, 50]} fill={COLORS[0]!} />
));
`,
  );

  const { code, out } = run("check", file);

  expect(code).toBe(1);
  expect(out).toContain("typed.tsx:6:");
  expect(out).toContain("type-error  error: TS2322");
  expect(out).toContain("Colors are hex literals");
});

test("a lone scene builds and keeps its line numbers", () => {
  const file = write(
    "lone.tsx",
    `import { Group, Shape, circle, ease, scene, span, track } from "svjeez";

export default scene({ size: [200, 100], duration: 2, title: "Lone", desc: "Dots." }, () => (
  <Group>
    {[0, 1].map((i) => (
      <Shape key={\`dot-\${i}\`} geometry={circle(5)} at={[50 + i * 50, 50]} fill="#000000" />
    ))}
    <Shape key="mover" geometry={circle(5)} at={track([0, 80]).to([200, 80], span(0, 1), ease.out)} fill="#000000" />
  </Group>
));
`,
  );

  const { code, out } = run("check", file);

  expect(out).not.toContain("error:");
  expect(out).toContain('lone.tsx:8:5  loop-seam  warning: <Shape> "mover"');
  expect(code).toBe(0);
});

test("a number as a key type-checks and builds", () => {
  const file = write(
    "keyed.tsx",
    `import { Group, Shape, circle, scene } from "svjeez";

export default scene({ size: [100, 100], duration: 1, loop: false, title: "K", desc: "D" }, () => (
  <Group>
    {[0, 1].map((i) => <Shape key={i} geometry={circle(5)} at={[30 + i * 40, 50]} fill="#000000" />)}
  </Group>
));
`,
  );

  const { out } = run("check", file);

  expect(out).not.toContain("type-error");
  expect(out).not.toContain("compile-error");
});

test("a bunfig.toml beside the scene doesn't change how the binary loads it", () => {
  write("bunfig.toml", 'preload = ["./missing-preload.ts"]\n');

  try {
    expect(run("check", "lone.tsx").out).toContain("0 errors");
  } finally {
    rmSync(join(dir, "bunfig.toml"));
  }
});

test("init readies an empty folder: types, a tsconfig and a scene that checks clean", () => {
  const folder = "project";
  const { code } = run("init", folder);

  expect(code).toBe(0);
  expect(existsSync(join(dir, folder, ".svjeez/types/svjeez/index.d.ts"))).toBe(true);
  expect(existsSync(join(dir, folder, ".svjeez/node_modules/@types/node/index.d.ts"))).toBe(true);

  const tsconfig = JSON.parse(readFileSync(join(dir, folder, "tsconfig.json"), "utf8"));
  expect(tsconfig.compilerOptions.paths.svjeez).toEqual(["./.svjeez/types/svjeez/index.d.ts"]);

  const checked = run("check", join(folder, "scene.tsx"));
  expect(checked.out).toContain("0 errors, 0 warnings");
  expect(checked.code).toBe(0);
}, 60_000);

test("skill prints the skill from inside the binary", () => {
  expect(run("skill").out).toStartWith("---\nname: svjeez");
});
