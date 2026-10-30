import { describe, expect, test } from "bun:test";
import { counter } from "../../src/index";
import { svg } from "../helpers/dynamics";

describe("counter", () => {
  test("one glyph per place per distinct digit, however often the number changes", () => {
    const counting = counter((t) => Math.floor(t * 10) % 10, { duration: 10, step: 0.1 });
    expect(svg(counting.node).match(/<path /g)).toHaveLength(10);
  });

  test("digits fix the places", () => {
    const r = counter(
      [
        { at: 0, value: 1 },
        { at: 3, value: 3.14 },
      ],
      { digits: 2 },
    );

    expect(svg(r.node).match(/<path /g)).toHaveLength(7);
  });

  test("a rolling digit moves as it fades", () => {
    const r = counter(
      [
        { at: 0, value: 1 },
        { at: 2, value: 2 },
      ],
      { roll: 0.3 },
    );

    expect(svg(r.node)).toContain("translate");
  });

  test("a negative value gets a sign place", () => {
    const r = counter([
      { at: 0, value: 5 },
      { at: 1, value: -5 },
    ]);

    expect(r.width).toBeGreaterThan(counter([{ at: 0, value: 5 }]).width);
  });

  test("errors", () => {
    expect(() =>
      counter(
        [
          { at: 0, value: 1 },
          { at: 0.1, value: 2 },
        ],
        { roll: 0.5 },
      ),
    ).toThrow("changes faster");
    expect(() => counter([])).toThrow("at least one value");
  });
});
