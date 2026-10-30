import { describe, expect, test } from "bun:test";
import { def, ease, motion, sample } from "svjeez";

describe("sample", () => {
  test("reads numeric properties, and leaves colors out", () => {
    const glow = def.property("glow", { syntax: "number", inherits: false, initial: 0 });

    const lit = motion({ [glow]: 0, fill: "#000000" }).to(
      { [glow]: 1, fill: "#ffffff" },
      1,
      ease.linear,
    );

    expect(sample(lit, 0.25, { duration: 1 })).toEqual({ [glow]: 0.25 });
  });

  test("errors name what is missing", () => {
    expect(() => sample(motion().to({ width: 10 }, 1), 0, { duration: 1 })).toThrow(
      "sample() needs a starting value for width. Pass it to motion({ width: … }).",
    );
  });
});
