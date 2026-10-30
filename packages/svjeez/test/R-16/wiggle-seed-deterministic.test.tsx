import { describe, expect, test } from "bun:test";
import { ease, wiggle } from "svjeez";
import { scene } from "../helpers/compile-scene";

describe("effects", () => {
  test("wiggle is byte-deterministic per seed", () => {
    const shaky = (seed: string) =>
      scene(
        <rect
          width={10}
          height={10}
          animation={wiggle({ x: 2, rotate: 3 }, { seed, ease: ease.hold })}
        />,
      );

    expect(shaky("a")).toBe(shaky("a"));
    expect(shaky("a")).not.toBe(shaky("b"));
  });
});
