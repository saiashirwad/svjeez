import { describe, expect, test } from "bun:test";
import { flowchart } from "svjeez/extras";
import { spec, valid } from "../helpers/diagram-fixtures";

describe("diagram options", () => {
  test("play takes a start and a step, or one time per node after the first", () => {
    const times = (svg: string) =>
      [...svg.matchAll(/animation-delay:(-?[\d.]+)s/g)].map((m) => Number(m[1]));

    const stepped = times(valid(flowchart(spec, { play: { at: 1, step: 2 } }).node));
    const listed = times(valid(flowchart(spec, { play: { at: [1, 3] } }).node));
    expect(stepped.length).toBeGreaterThan(0);
    expect(Math.max(...stepped)).toBeCloseTo(Math.max(...listed), 6);
  });
});
