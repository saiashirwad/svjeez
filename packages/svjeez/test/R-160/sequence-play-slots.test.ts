import { describe, expect, test } from "bun:test";
import { sequence } from "svjeez/extras";
import { seq } from "../helpers/diagram-fixtures";

describe("sequence", () => {
  test("message i runs between the two lifelines in its play slot", () => {
    const { span, points } = seq.message(1);
    expect(span).toEqual({ at: 2.5, over: 0.5 });
    expect(points.map((p) => p.x)).toEqual([seq.get("api").center.x, seq.get("db").center.x]);
    expect(seq.message(2).points[0]!.y).toBeGreaterThan(points[0]!.y);
    expect(() => seq.message(5)).toThrow();
  });

  test("with one time per row, each message runs until the next starts", () => {
    const timed = sequence(
      {
        actors: { a: "A", b: "B" },
        messages: [["a", "b", "x"], ["b", "a", "y"], { note: "a", text: "z" }],
      },
      { play: { at: [1, 1.5, 4], step: 0.6 } },
    );

    expect([0, 1, 2].map((i) => timed.message(i).span)).toEqual([
      { at: 1, over: 0.5 },
      { at: 1.5, over: 2.5 },
      { at: 4, over: 0.6 },
    ]);
  });
});
