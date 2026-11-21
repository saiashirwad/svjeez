import { describe, expect, test } from "bun:test";
import { Shape, along, circle, ease, path, scene, span, track, type Vec } from "svjeez";
import { isLane } from "svjeez/tools";
import { alongOutline, lengthOf } from "../src/model/geometry";
import { outlineOf } from "../src/author/values";
import { blendVec, valueAt } from "../src/model/sample";

const route = path().moveTo([0, 0]).lineTo([100, 0]).lineTo([100, 100]);
const outline = outlineOf(route);
const red = "#FF0000";
const size = { size: [200, 200], duration: 2, title: "Test" } as const;

describe("along", () => {
  test("a still progress sits on the path with its heading", () => {
    const at = (p: number) => {
      const { offset, rotate } = along(route, p, { turn: true });

      if (!Array.isArray(offset)) throw new Error("a still progress gives a still offset");

      return { offset, rotate: rotate! };
    };

    expect(at(0).offset).toEqual([0, 0]);
    expect(at(0).rotate).toBeCloseTo(0);
    expect(at(0.25).offset).toEqual([50, 0]);
    expect(at(0.5).offset).toEqual([100, 0]);
    expect(at(0.75).offset[0]).toBeCloseTo(100);
    expect(at(0.75).offset[1]).toBeCloseTo(50);
    expect(at(0.75).rotate).toBeCloseTo(90);
    expect(at(1).offset).toEqual([100, 100]);
    expect(at(1).rotate).toBeCloseTo(90);
    expect(at(2).offset).toEqual([100, 100]);
  });

  test("turn is off unless asked", () => {
    expect(along(route, 0.5).rotate).toBeUndefined();
  });

  test("a track gives a lane that lands on the path", () => {
    const progress = track(0).to(1, span(0, 2), ease.linear);

    const node = scene(size, () => (
      <Shape geometry={circle(4)} fill={red} motion={along(route, progress, { turn: true })} />
    )).root.children[0]!;

    const { offset, rotate } = node.layers[0]!;

    expect(isLane(offset)).toBe(true);
    expect(isLane(rotate)).toBe(true);

    const [x, y] = valueAt(offset, 1, blendVec);

    expect(x).toBeCloseTo(100, 0);
    expect(y).toBeCloseTo(0, 0);
    expect(valueAt(offset, 2, blendVec)[1]).toBeCloseTo(100, 0);
  });

  test("the same track as draw puts the marker at the line's tip", () => {
    const progress = track(0).to(1, span(0, 2), ease.inOut);

    const [line, marker] = scene(size, () => (
      <>
        <Shape geometry={route} stroke={{ color: red }} draw={progress} />
        <Shape geometry={circle(4)} fill={red} motion={along(route, progress)} />
      </>
    )).root.children;

    if (line?.kind !== "shape" || !line.trim) throw new Error("the line has no trim");

    const { trim } = line;
    const place = marker!.layers[0]!.offset;

    for (const time of [0, 0.4, 1, 1.6, 2]) {
      const [, end] = valueAt(trim, time, blendVec);
      const tip = alongOutline(outline, end * lengthOf(outline)).point;
      const [x, y] = valueAt(place, time, blendVec);

      expect(x).toBeCloseTo(tip[0], 0);
      expect(y).toBeCloseTo(tip[1], 0);
    }
  });

  test("a looping track loops", () => {
    const progress = track(0).to(1, span(0, 1), ease.linear).loop(1);

    const node = scene(size, () => (
      <Shape geometry={circle(4)} fill={red} motion={along(route, progress)} />
    )).root.children[0]!;

    const lane = node.layers[0]!.offset;
    const [a, b]: [Vec, Vec] = [valueAt(lane, 0.5, blendVec), valueAt(lane, 1.5, blendVec)];

    expect(isLane(lane)).toBe(true);
    expect(a).toEqual(b);
  });
});
