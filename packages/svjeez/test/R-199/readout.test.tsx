import { describe, expect, test } from "bun:test";
import { readout } from "svjeez/extras";
import { svgOf } from "../helpers/calculus";

describe("readout()", () => {
  test("shows one text per value it holds", () => {
    const svg = svgOf(readout((t) => (t < 2 ? "low" : "high"), { at: 1, over: 2, step: 0.5 }));

    expect(svg.match(/<text/g)).toHaveLength(2);
    expect(svg).toContain(">low</text>");
    expect(svg).toContain(">high</text>");
  });
});
