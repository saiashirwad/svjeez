import { describe, expect, test } from "bun:test";
import { motion, sample } from "svjeez";

describe("sample", () => {
  test("a cut holds the old value up to it", () => {
    const cut = motion({ opacity: 1 }).at(1).set({ opacity: 0 });

    expect(sample(cut, 1.01, { duration: 2 })).toEqual({ opacity: 0 });
  });
});
