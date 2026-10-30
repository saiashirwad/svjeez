import { describe, expect, test } from "bun:test";
import { motion } from "svjeez";
import { scene } from "../helpers/paths";

describe("the d channel", () => {
  test("rejects paths with different commands", () => {
    expect(() => scene(motion({ d: "M0 0H10V10Z" }).to({ d: "M0 0L10 10Z" }, 1))).toThrow(
      "d on <path> moves between paths with different commands, so it would jump. Write them through matchPaths() first.",
    );
  });
});
