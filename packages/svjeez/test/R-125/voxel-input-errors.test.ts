import { describe, expect, test } from "bun:test";
import { voxel } from "svjeez/voxel";
import { build, place } from "../helpers/voxel";

describe("voxel.scene", () => {
  test("a cell must be whole and a lifetime must run forward", () => {
    expect(() => build([place([0.5, 0, 0])])).toThrow(/whole cell/);
    expect(() => build([place([0, 0, 0], { from: 4, to: 4 })])).toThrow(/from < to/);
  });
});

describe("voxel.texture", () => {
  test("rejects a ragged row, an unknown key and a color it cannot shade", () => {
    expect(() => voxel.texture({ a: "#fff" }, "aa\na")).toThrow(/row 1/);
    expect(() => voxel.texture({ a: "#fff" }, "ab")).toThrow(/"b"/);
    // @ts-expect-error a named color is a type error; untyped callers still get the runtime check
    expect(() => voxel.texture({ a: "red" }, "a")).toThrow(
      "texture() needs #rgb, #rrggbb or #rrggbbaa colors, got red.",
    );
  });
});
