import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { BunServices } from "@effect/platform-bun";
import { Effect, Layer, ManagedRuntime } from "effect";
import { Workspace } from "../src/workspace.ts";

const dir = new URL("./.chains-" + process.pid + "/", import.meta.url).pathname;
const file = dir + "spin.tsx";

const text = `import { Shape, circle, ease, scene, span, track } from "svjeez";

const spin = track(0).to(360, span(0.5, 1), ease.out).rewind(0.5, ease.out);
const other = track(0).to(90, span(0.5, 1), ease.in);

export default scene({ size: [100, 100], duration: 4, title: "Spin", desc: "A dot turns." }, () => (
  <Shape geometry={circle(10)} fill="#888888" offset={[50, 50]} rotate={spin} opacity={other.map((t) => t / 90)} />
));
`;

const live = ManagedRuntime.make(
  Workspace.layer({ root: dir, mode: "file", file }).pipe(Layer.provide(BunServices.layer)),
);

const state = () => live.runPromise(Effect.flatMap(Workspace, (w) => w.state));

beforeAll(async () => {
  await Bun.write(file, text);
});

afterAll(async () => {
  await live.dispose();
  await Bun.$`rm -rf ${dir}`.quiet();
});

describe("motion chains in the workspace", () => {
  test("each step's target and curve are signals of their own, written at their sites", async () => {
    const view = await state();
    const target = view.controls.find((c) => c.key === "spin.step0.target");
    const curve = view.controls.find((c) => c.key === "spin.step0.ease");

    expect(target).toMatchObject({ kind: "number", value: 360 });
    expect(curve).toMatchObject({ kind: "ease", value: "ease.out" });
    expect(target?.sites[0]?.text).toBe("360");
    expect(view.marks.some((mark) => mark.key === "spin.step0.target")).toBe(true);
  });

  test("a lane's moves are tied to their chain's steps, not to another chain's equal span", async () => {
    const view = await state();

    const moves = (prop: string) => view.lanes.find((lane) => lane.lane === prop)?.spans;

    expect(moves("rotate")?.map((span) => span.signal)).toEqual(["spin.step0", "spin.step1"]);
    expect(moves("opacity")?.map((span) => span.signal)).toEqual(["other.step0"]);
  });
});
