import { describe, expect, test } from "bun:test";
import { ease, motion, sample } from "svjeez";
import { browser } from "../helpers/timeline-browser";
import { drawnAt, stack } from "../helpers/timeline-sample";

describe("sample", () => {
  test("a loop snaps to divide the scene, as render runs it", () => {
    const spin = motion({ rotate: 0 }).to({ rotate: 360 }, 0.9, ease.linear).loop(0.9);

    expect(sample(spin, 1.5, { duration: 3 }).rotate).toBeCloseTo(180);
  });

  test.if(browser)("matches where the browser draws the element", async () => {
    for (const { time, opacity } of await drawnAt()) {
      const values = sample(stack, time, { duration: 3 });

      expect(opacity).toBeCloseTo(values.opacity ?? NaN, 2);
    }
  });
});
