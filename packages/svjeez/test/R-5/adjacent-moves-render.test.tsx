import { describe, expect, test } from "bun:test";
import { motion } from "svjeez";
import { scene } from "../helpers/compile-scene";

describe("timeline", () => {
  test("a move that starts just after the previous one ends still renders", () => {
    const track = motion({ opacity: 0 })
      .to({ opacity: 1 }, 0.333333)
      .at(1 / 3)
      .to({ opacity: 0 }, 0.5);

    expect(() => scene(<rect animation={track} />, 2)).not.toThrow();
  });
});
