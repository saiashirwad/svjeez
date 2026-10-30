import { describe, expect, test } from "bun:test";
import { streamlines } from "svjeez/extras";
import { bounds } from "../helpers/field";

describe("streamlines", () => {
  test("write one subpath per line", () => {
    const { lines, d } = streamlines(() => [1, 1], { bounds, spacing: 40 });

    expect(d.match(/M/g)).toHaveLength(lines.length);
  });

  test("name the fix for bad options", () => {
    expect(() => streamlines(() => [1, 0], { bounds, spacing: 0 })).toThrow(
      "streamlines() needs a positive spacing, got 0.",
    );
  });
});
