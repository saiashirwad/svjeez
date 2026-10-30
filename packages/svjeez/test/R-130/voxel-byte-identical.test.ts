import { describe, expect, test } from "bun:test";
import { blue, build, green, place } from "../helpers/voxel";

describe("voxel.scene", () => {
  test("output is byte-identical across runs", () => {
    const blocks = [
      place([0, 0, 0]),
      place([1, 0, 0], { skin: green, from: 1, to: 4 }),
      place([0, 1, 0], { skin: blue }),
    ];

    expect(build(blocks)).toBe(build(blocks));
  });
});
