import { describe, expect, test } from "bun:test";
import { restyle } from "svjeez";
import { restyleScene } from "../helpers/frames-restyle";

describe("restyle", () => {
  test("an untouched copy is the input", () => {
    const svg = restyleScene({ at: 2.5 });
    expect(restyle(svg, {})).toBe(svg);
  });
});
