import { describe, expect, test } from "bun:test";
import { rect } from "svjeez";
import { cartogram, toBars } from "../../src/index.ts";
import { map, scene } from "../helpers/geo-world.ts";

describe("cartogram()", () => {
  const people = { France: 67, Germany: 83, Spain: 47, Italy: 60, Poland: 38, Portugal: 10 };
  const result = cartogram(map, people, { at: 2, over: 1 });

  test("morphs each outline into a circle through the d channel, and returns the rest of the map", () => {
    const svg = scene(result.node);

    expect(svg.match(/attributeName="d"/g)).toHaveLength(6);
    expect(result.rest).toContain(map.region("Canada").d);
    expect(result.rest).not.toContain(map.region("France").d);
  });

  test("asks for one number per region", () => {
    expect(() => cartogram(map, { France: [1, 2] }, { at: 0 })).toThrow(
      'cartogram() takes one number per region, but "250" has a list.',
    );
  });
});

describe("toBars()", () => {
  test("morphs through the d channel", () => {
    const people = { France: 67, Germany: 83, Spain: 47, Italy: 60 };
    const frame = rect(600, 100, 300, 200);

    expect(
      scene(toBars(map, people, { at: 1, frame }).node).match(/attributeName="d"/g),
    ).toHaveLength(4);
  });
});
