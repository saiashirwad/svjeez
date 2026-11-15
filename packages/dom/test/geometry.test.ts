import { expect, test } from "bun:test";
import { matrix } from "../src/draw/geometry.ts";

test("a transform keeps three decimal places in every matrix entry", () => {
  expect(matrix({ matrix: [0.955, 0.1234, -0.5678, 0.875, 1.5, 2.25], origin: [0, 0] })).toBe(
    "translate(0 0) matrix(0.955 0.123 -0.568 0.875 1.5 2.25) translate(0 0)",
  );
});
