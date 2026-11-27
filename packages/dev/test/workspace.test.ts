import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { BunServices } from "@effect/platform-bun";
import { Effect, Layer, ManagedRuntime } from "effect";
import { Refused, Workspace } from "../src/workspace.ts";
import type { LaneEase, StateView } from "../src/workspace.ts";

const fixture = new URL("./fixtures/pulse.tsx", import.meta.url).pathname;
const dir = new URL("./.work-" + process.pid + "/", import.meta.url).pathname;
const file = dir + "pulse.tsx";
let original = "";

const runtime = () =>
  ManagedRuntime.make(
    Workspace.layer({ root: dir, mode: "file", file }).pipe(Layer.provide(BunServices.layer)),
  );

let live: ReturnType<typeof runtime>;

const run = <A, E>(effect: Effect.Effect<A, E, Workspace>) => live.runPromise(effect);

const state = () => run(Effect.flatMap(Workspace, (w) => w.state));

beforeAll(async () => {
  original = await Bun.file(fixture).text();
  await Bun.write(file, original);
  live = runtime();
});

afterAll(async () => {
  await live.dispose();
  await Bun.$`rm -rf ${dir}`.quiet();
});

const control = (view: StateView, key: string) => view.controls.find((c) => c.key === key);

describe("workspace", () => {
  test("opens a scene: its build, its signals, and its own controls first", async () => {
    const view = await state();

    expect(view.error).toBeUndefined();
    expect(view.svg).toContain("<svg");
    expect(view.duration).toBe(4);
    expect(view.controls.slice(0, 2).map((c) => [c.key, c.group, c.kind])).toEqual([
      ["rhythm", "derived", "number"],
      ["center", "derived", "pad"],
    ]);
    expect(control(view, "rhythm")?.value).toBe(2);
    expect(control(view, "center")?.value).toEqual([100, 60]);
    expect(control(view, "RADIUS")).toMatchObject({ group: "const", value: 24 });
    expect(view.marks.length).toBeGreaterThan(8);
  });

  test("matches a lane's span to the span signal it was written with, and says its curve", async () => {
    const view = await state();
    const spans = view.lanes.flatMap((lane) => lane.spans);

    const written = view.controls.find((c) => c.kind === "span")?.key;
    const out: LaneEase = { kind: "bezier", points: [0.23, 1, 0.32, 1] };

    expect(written).toStartWith("span@");
    expect(spans.filter((span) => span.signal === written)).toEqual([
      { start: 0.5, over: 1, ease: out, signal: written },
      { start: 0.5, over: 1, ease: out, signal: written },
    ]);
  });

  test("a preview builds the change without touching the file", async () => {
    const preview = await run(Effect.flatMap(Workspace, (w) => w.preview("RADIUS", 40)));

    expect("svg" in preview && preview.svg).toContain('r="40"');
    expect(await Bun.file(file).text()).toBe(original);
    expect(await Array.fromAsync(new Bun.Glob(".*").scan({ cwd: dir, dot: true }))).toEqual([]);
  });

  test("a commit edits exactly that literal, and undo puts the file back byte for byte", async () => {
    const after = await run(Effect.flatMap(Workspace, (w) => w.commit("RADIUS", 30)));

    expect(await Bun.file(file).text()).toBe(
      original.replace("const RADIUS = 24;", "const RADIUS = 30;"),
    );
    expect(after.log).toEqual({ labels: ["RADIUS: 24 → 30"], at: 1 });
    expect(control(after, "RADIUS")?.value).toBe(30);

    const undone = await run(Effect.flatMap(Workspace, (w) => w.undo));

    expect(await Bun.file(file).text()).toBe(original);
    expect(undone.log.at).toBe(0);

    await run(Effect.flatMap(Workspace, (w) => w.redo));
    expect(await Bun.file(file).text()).toContain("const RADIUS = 30;");
    await run(Effect.flatMap(Workspace, (w) => w.undo));
    expect(await Bun.file(file).text()).toBe(original);
  });

  test("a derived control and a pad write all the signals they are made of", async () => {
    await run(Effect.flatMap(Workspace, (w) => w.commit("rhythm", 4)));
    let text = await Bun.file(file).text();

    expect(text).toContain("const STAGGER = 0.5;");
    expect(text).toContain("const DUR = 3;");

    await run(Effect.flatMap(Workspace, (w) => w.commit("center", [120, 70])));
    text = await Bun.file(file).text();
    expect(text).toContain("const CENTER: [number, number] = [120, 70];");

    await run(Effect.flatMap(Workspace, (w) => w.undo));
    await run(Effect.flatMap(Workspace, (w) => w.undo));
    expect(await Bun.file(file).text()).toBe(original);
  });

  test("variants build five values across a control's range", async () => {
    const variants = await run(Effect.flatMap(Workspace, (w) => w.variants("RADIUS")));

    expect(variants.map((v) => v.value)).toEqual([0, 12, 24, 36, 48]);
    expect(variants.every((v) => v.svg?.includes("<svg"))).toBe(true);
  });

  test("a scene that stops building is shown as an error, with the last good drawing kept", async () => {
    await Bun.write(file, original.replace("export default scene(", "export default scene(oops, "));
    await run(Effect.flatMap(Workspace, (w) => w.changed([file])));
    const broken = await state();

    expect(broken.error).toContain("oops");
    expect(broken.svg).toContain("<svg");

    await Bun.write(file, original);
    await run(Effect.flatMap(Workspace, (w) => w.changed([file])));
    expect((await state()).error).toBeUndefined();
  });

  test("an unknown control is refused with a reason", async () => {
    expect(run(Effect.flatMap(Workspace, (w) => w.commit("NOPE", 1)))).rejects.toBeInstanceOf(
      Refused,
    );
  });
});
