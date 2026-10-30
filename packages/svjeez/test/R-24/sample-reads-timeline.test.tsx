import { describe, expect, test } from "bun:test";
import { motion, sample } from "svjeez";
import { browser } from "../helpers/timeline-browser";
import { drawnAt, slide, stack } from "../helpers/timeline-sample";

describe("sample", () => {
  test("blends between keys with the transition's ease", () => {
    expect(sample(slide, 0.5, { duration: 2 })).toEqual({ x: 5 });
    expect(sample(slide, 1.5, { duration: 2 })).toEqual({ x: 10 });
  });

  test("a cut holds the old value up to it", () => {
    const cut = motion({ opacity: 1 }).at(1).set({ opacity: 0 });

    expect(sample(cut, 0.99, { duration: 2 })).toEqual({ opacity: 1 });
  });

  test("the scene loops unless loop is false, which holds the last frame", () => {
    expect(sample(slide, 2.5, { duration: 2 })).toEqual({ x: 5 });
    expect(sample(slide, -1.5, { duration: 2 })).toEqual({ x: 5 });
    expect(sample(slide, 2.5, { duration: 2, loop: false })).toEqual({ x: 10 });
  });

  test.if(browser)("matches where the browser draws the element", async () => {
    for (const { time, x, y } of await drawnAt()) {
      const values = sample(stack, time, { duration: 3 });

      expect(x).toBeCloseTo(values.x ?? NaN, 0);
      expect(y).toBeCloseTo(values.y ?? NaN, 0);
    }
  });
});
