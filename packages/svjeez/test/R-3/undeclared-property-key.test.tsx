import { describe, expect, test } from "bun:test";
import { motion } from "svjeez";
import type { yaw } from "../helpers/compile-fixtures";

describe("properties", () => {
  test("an undeclared property key is refused when the motion is built", () => {
    // SAFETY: the key is deliberately undeclared, so the cast lets it reach motion(), which must refuse it at runtime.
    expect(() => motion().to({ ["--nope:angle" as typeof yaw]: 1 }, 1)).toThrow(/never declared/);
  });
});
