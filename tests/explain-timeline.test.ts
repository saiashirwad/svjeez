import { expect, test } from "bun:test";
import { dataOf } from "../src/motion";
import { timeline } from "../src/explain/timeline";

test("timeline spaces spans and bounds fades", () => {
  const t = timeline({ intro: 2, focus: 3, outro: 1 }, { gap: 0.4 });
  expect(t.intro).toEqual({ at: 0, over: 2 });
  expect(t.focus).toEqual({ at: 2.4, over: 3 });
  expect(t.duration).toBeCloseTo(6.8);
  expect(dataOf(t.show("focus")).steps.map(s => s.start)).toEqual([2.4, 5.1000000000000005]);
  expect(dataOf(t.from("outro")).steps).toHaveLength(1);
  expect(() => timeline({ bad: 0 })).toThrow();
});
