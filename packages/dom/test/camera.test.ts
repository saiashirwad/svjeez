import { expect, test } from "bun:test";
import { rect } from "svjeez/geometry";
import { shots } from "../src/camera.ts";
import type { Box, Snapshot } from "../src/tree.ts";

const box = (
  part: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  children: Box[] = [],
): Box => ({
  kind: "box",
  tag: "div",
  part,
  box: { x, y, width, height },
  radii: [0, 0, 0, 0],
  shadows: [],
  opacity: 1,
  clip: false,
  children,
});

const snapshot = (name: string): Snapshot => ({
  name,
  width: 400,
  height: 400,
  pad: 0,
  box: { x: 0, y: 0, width: 400, height: 400 },
  root: box(undefined, 0, 0, 400, 400, [
    box("field", 20, 300, 100, 20),
    box("corner", 390, 0, 10, 10),
  ]),
});

const frame = rect(0, 0, 200, 100);

test("shots open on the whole snapshot and frame a part as the move into its snapshot starts", () => {
  const { stops, over } = shots(
    [snapshot("a"), { wait: 1 }, [snapshot("b"), { over: 0.4 }]],
    { b: "field" },
    { frame, margin: 0 },
  );

  expect(over).toBe(0.5);
  expect(stops.map((s) => s.show.at)).toEqual([0, 1]);
  expect(stops[0]!.target).toMatchObject({ x: 0, y: 0, w: 400, h: 400 });
  expect(stops[1]!.target).toMatchObject({ x: 20, y: 285, w: 100, h: 50 });
});

test("a part near the edge is framed without showing past the snapshot", () => {
  const { stops } = shots([snapshot("a"), snapshot("b")], { b: "corner" }, { frame, margin: 0 });

  expect(stops[1]!.target).toMatchObject({ x: 300, y: 0, w: 100, h: 50 });
});

test("a shot that comes too soon after the one before waits for it", () => {
  const steps = [
    snapshot("a"),
    [snapshot("b"), { over: 0.1 }],
    [snapshot("c"), { over: 0.1 }],
  ] as const;

  const { stops } = shots(steps, { b: "field", c: "all" }, { frame, over: 0.5 });

  expect(stops.map((s) => s.show.at)).toEqual([0, 0.5, 1]);
});

test("a missing part is an error that names it", () => {
  expect(() => shots([snapshot("a"), snapshot("b")], { b: "nope" }, { frame })).toThrow(
    'no part "nope"',
  );
});
