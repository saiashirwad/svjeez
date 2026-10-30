import { describe, expect, test } from "bun:test";
import { motion, sample } from "svjeez";

describe("sample", () => {
  test("layers add up: x, y and rotate add, opacity and scale multiply", () => {
    const values = sample(
      [
        motion({ x: 4, opacity: 0.5, rotate: 10 }),
        motion({ x: 1, y: 2, opacity: 0.5, scale: 2 }),
        false,
        motion({ scale: 3, rotate: 5 }),
      ],
      0,
      { duration: 1 },
    );

    expect(values).toEqual({ x: 5, y: 2, opacity: 0.25, rotate: 15, scale: 6 });
  });

  test("errors name what is missing", () => {
    expect(() => sample([motion({ width: 1 }), motion({ width: 2 })], 0, { duration: 1 })).toThrow(
      "Two motions both animate `width` in sample(): put them in one motion().",
    );
  });
});
