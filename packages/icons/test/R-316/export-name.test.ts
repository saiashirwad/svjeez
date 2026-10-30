import { describe, expect, test } from "bun:test";
import { exportName } from "../../scripts/generate.ts";

describe("exportName", () => {
  test.each([
    ["arrow-left", "arrowLeft"],
    ["rocket-filled", "rocketFilled"],
    ["arrow-up-1-0", "arrowUp1_0"],
    ["arrow-up-10", "arrowUp10"],
    ["delete", "iconDelete"],
    ["3d-cube", "icon3dCube"],
  ])("%s is %s", (file, name) => {
    expect(exportName(file)).toBe(name);
  });
});
