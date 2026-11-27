import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { BunServices } from "@effect/platform-bun";
import { Effect, Layer, ManagedRuntime } from "effect";
import { Workspace } from "../src/workspace.ts";

const dir = new URL("./.work-files-" + process.pid + "/", import.meta.url).pathname;
const scene = dir + "scene.tsx";
const tokens = dir + "tokens.ts";

const SCENE = `import { Group, Shape, circle, rect, scene } from "svjeez";
import { palette } from "./theme";

export default scene(
  { size: [200, 120], duration: 2, title: "Files", desc: "A dot whose size lives in another file." },
  () => (
    <Group>
      <Shape geometry={circle(palette.dot)} offset={[100, 60]} fill={palette.ink} />
      <Shape geometry={rect(80, 20)} offset={[100, 100]} fill="#FFFFFF" />
    </Group>
  ),
);
`;

const THEME = 'export { palette } from "./tokens";\n';
const TOKENS = 'export const palette = { dot: 24, ink: "#3EE6D6" } as const;\n';

const live = ManagedRuntime.make(
  Workspace.layer({ root: dir, mode: "file", file: scene }).pipe(Layer.provide(BunServices.layer)),
);

const run = <A, E>(effect: Effect.Effect<A, E, Workspace>) => live.runPromise(effect);

const state = () => run(Effect.flatMap(Workspace, (w) => w.state));

const disk = (file: string) => Bun.file(file).text();

beforeAll(async () => {
  await Bun.write(scene, SCENE);
  await Bun.write(dir + "theme.ts", THEME);
  await Bun.write(tokens, TOKENS);
});

afterAll(async () => {
  await live.dispose();
  await Bun.$`rm -rf ${dir}`.quiet();
});

describe("a scene that imports its constants", () => {
  test("the imported fields are signals of the other file, and only the scene is marked", async () => {
    const view = await state();
    const dot = view.controls.find((c) => c.key === "palette.dot");

    expect(view.error).toBeUndefined();
    expect(view.svg).toContain('r="24"');
    expect(dot).toMatchObject({ group: "field", value: 24 });
    expect(dot?.sites[0]?.file).toBe(tokens);
    expect(dot?.uses).toHaveLength(1);
    expect(view.marks.some((mark) => mark.key === "palette.dot" && !mark.use)).toBe(false);
    expect(view.marks.filter((mark) => mark.key === "palette.dot" && mark.use)).toHaveLength(1);
    expect(view.marks.some((mark) => mark.key.startsWith("Shape.rect[0]"))).toBe(true);
  });

  test("a preview builds the other file's new text without writing it", async () => {
    const preview = await run(Effect.flatMap(Workspace, (w) => w.preview("palette.dot", 40)));

    expect("svg" in preview && preview.svg).toContain('r="40"');
    expect(await disk(tokens)).toBe(TOKENS);
    expect(await Array.fromAsync(new Bun.Glob(".*").scan({ cwd: dir, dot: true }))).toEqual([]);
    expect((await state()).svg).toContain('r="24"');
  });

  test("a commit writes that file only, undo and redo put it back, and the drawing follows", async () => {
    const after = await run(Effect.flatMap(Workspace, (w) => w.commit("palette.dot", 30)));

    expect(await disk(tokens)).toBe(TOKENS.replace("dot: 24", "dot: 30"));
    expect(await disk(scene)).toBe(SCENE);
    expect(after.svg).toContain('r="30"');
    expect(after.log.labels).toEqual(["palette.dot: 24 → 30"]);

    const undone = await run(Effect.flatMap(Workspace, (w) => w.undo));

    expect(await disk(tokens)).toBe(TOKENS);
    expect(undone.svg).toContain('r="24"');

    const redone = await run(Effect.flatMap(Workspace, (w) => w.redo));

    expect(redone.svg).toContain('r="30"');
    await run(Effect.flatMap(Workspace, (w) => w.undo));
  });

  test("a change to that file on disk rebuilds the scene, and its own writes do not", async () => {
    await Bun.write(tokens, TOKENS.replace("dot: 24", "dot: 12"));
    await run(Effect.flatMap(Workspace, (w) => w.changed([tokens])));
    expect((await state()).svg).toContain('r="12"');

    await Bun.write(tokens, TOKENS);
    await run(Effect.flatMap(Workspace, (w) => w.changed([tokens])));
    expect((await state()).svg).toContain('r="24"');
  });

  test("extract turns a literal into a constant, as one step to undo", async () => {
    const key = (await state()).controls.find((c) => c.key.startsWith("Shape.rect[0]"))?.key ?? "";
    const after = await run(Effect.flatMap(Workspace, (w) => w.extract(key, "BAR_WIDTH")));
    const text = await disk(scene);

    expect(text).toContain("const BAR_WIDTH = 80;");
    expect(text).toContain("rect(BAR_WIDTH, 20)");
    expect(after.controls.find((c) => c.key === "BAR_WIDTH")).toMatchObject({ value: 80 });
    expect(after.log.labels).toEqual(["extract BAR_WIDTH from rect width"]);

    await run(Effect.flatMap(Workspace, (w) => w.undo));
    expect(await disk(scene)).toBe(SCENE);
  });

  test("extract refuses a name the scene already uses", async () => {
    const key = (await state()).controls.find((c) => c.key.startsWith("Shape.rect[0]"))?.key ?? "";

    expect(run(Effect.flatMap(Workspace, (w) => w.extract(key, "palette")))).rejects.toThrow();
    expect(await disk(scene)).toBe(SCENE);
  });
});
