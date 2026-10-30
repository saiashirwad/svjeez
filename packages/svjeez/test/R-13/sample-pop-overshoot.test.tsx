import { describe, expect, test } from "bun:test";
import { ease, motion, sample } from "svjeez";

describe("sample", () => {
  test("blends between keys with the transition's ease", () => {
    const popped = sample(motion({ scale: 1 }).to({ scale: 2 }, 1, ease.pop), 0.6, {
      duration: 1,
    });

    expect(popped.scale).toBeGreaterThan(2);
  });
});
