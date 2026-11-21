import { expect, test } from "bun:test";
import { ease, keyframes, span, track, type Vec } from "svjeez";
import { valueAt } from "svjeez/tools";
import { laneOf, mixNumber, mixVec, type Clock } from "../src/model/steps";
import { passageOf } from "../src/author/track";

const clock: Clock = { offset: 0, end: 4, clips: [] };
const timing = { duration: 4, clock, reads: new Map() };

const sample = (value: ReturnType<typeof keyframes<number>>, t: number): number =>
  valueAt(laneOf(passageOf(value).data, 0, timing, mixNumber, "test"), t, mixNumber);

test("values at the frame times, held before the first and after the last", () => {
  const bounce = keyframes([
    [0.5, 0],
    [1, 100, ease.linear],
    [2, 0, ease.linear],
    [3, 40, ease.linear],
  ]);

  expect(sample(bounce, 0)).toBe(0);
  expect(sample(bounce, 0.5)).toBeCloseTo(0, 6);
  expect(sample(bounce, 1)).toBeCloseTo(100, 6);
  expect(sample(bounce, 1.5)).toBeCloseTo(50, 6);
  expect(sample(bounce, 2)).toBeCloseTo(0, 6);
  expect(sample(bounce, 2.5)).toBeCloseTo(20, 6);
  expect(sample(bounce, 3.5)).toBeCloseTo(40, 6);
});

test("it is the chain of to() calls it stands for, and the same every time", () => {
  const written = track(0).to(10, span(0, 1), ease.out).to(0, span(1, 2), ease.in);

  const made = () =>
    keyframes([
      [0, 0],
      [1, 10, ease.out],
      [3, 0, ease.in],
    ]);

  expect(passageOf(made())).toEqual(passageOf(written));
  expect(passageOf(made())).toEqual(passageOf(made()));
});

test("it is a track: it loops, and it takes points", () => {
  const wave = keyframes([
    [0, 0],
    [1, 10, ease.linear],
    [2, 0, ease.linear],
  ]).loop(2, { phase: 1 });

  expect(sample(wave, 0)).toBeCloseTo(10, 3);
  expect(sample(wave, 1)).toBeCloseTo(0, 3);

  const there = keyframes<Vec>([
    [0, [0, 0]],
    [1, [10, 20], ease.linear],
  ]);

  expect(
    valueAt(laneOf(passageOf(there).data, [0, 0], timing, mixVec, "test"), 0.5, mixVec),
  ).toEqual([5, 10]);
});

test("frames out of order, or none, are an error", () => {
  expect(() =>
    keyframes([
      [1, 0],
      [0.5, 1],
    ]),
  ).toThrow("increasing order");
  expect(() =>
    keyframes([
      [1, 0],
      [1, 1],
    ]),
  ).toThrow("increasing order");
  expect(() => keyframes<number>([])).toThrow("at least one frame");
});
