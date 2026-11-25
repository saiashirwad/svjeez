import { expect, test } from "bun:test";
import { ease, span, track, type Track } from "svjeez";
import { valueAt } from "svjeez/tools";
import { laneOf, mixNumber, type Timing } from "../src/model/steps";
import { passageOf } from "../src/author/track";

const DURATION = 4;
const clock: Timing["clock"] = { offset: 0, end: DURATION, clips: [] };

const lane = (value: Track<number>, offset = 0) =>
  laneOf(
    passageOf(value).data,
    0,
    { duration: DURATION, clock: { ...clock, offset }, reads: new Map() },
    mixNumber,
    "test",
  );

const at = (value: Track<number>, t: number): number => valueAt(lane(value), t, mixNumber);

const ramp = track(0).to(1, span(0, 2), ease.linear).loop(2);

test("a loop with a phase shows the unshifted loop at t + phase", () => {
  const shifted = track(0).to(1, span(0, 2), ease.linear).loop(2, { phase: 0.5 });

  for (const t of [0, 0.3, 1, 1.4, 2.2, 3.9]) {
    const wanted = at(ramp, (t + 0.5) % 2);

    expect(at(shifted, t)).toBeCloseTo(wanted, 3);
  }
});

test("phase wraps into the period and may be negative", () => {
  const plain = track(0).to(1, span(0, 2), ease.linear).loop(2, { phase: 0.5 });
  const wrapped = track(0).to(1, span(0, 2), ease.linear).loop(2, { phase: 4.5 });
  const back = track(0).to(1, span(0, 2), ease.linear).loop(2, { phase: -1.5 });

  for (const t of [0.2, 1.1, 2.7]) {
    expect(at(wrapped, t)).toBeCloseTo(at(plain, t), 6);
    expect(at(back, t)).toBeCloseTo(at(plain, t), 6);
  }
});

test("a phased loop closes its seam when the period divides the duration", () => {
  for (const phase of [0.25, 0.7, 1.3]) {
    const shifted = track(0).to(1, span(0, 2), ease.linear).loop(2, { phase });

    expect(at(shifted, 0)).toBeCloseTo(at(shifted, DURATION - 1e-6), 3);
    expect(at(shifted, 0)).toBeCloseTo(at(ramp, phase), 3);
  }
});

test("a motion that rests inside the period keeps its rest, shifted", () => {
  const pulse = track(0).to(1, span(0, 0.5), ease.linear).to(0, span(0.5, 0.5), ease.linear);
  const shifted = pulse.loop(2, { phase: 1.75 });

  expect(at(shifted, 0)).toBeCloseTo(0, 3);
  expect(at(shifted, 0.5)).toBeCloseTo(0.5, 3);
  expect(at(shifted, 0.75)).toBeCloseTo(1, 3);
  expect(at(shifted, 1.25)).toBeCloseTo(0, 3);
  expect(at(shifted, 1.5)).toBeCloseTo(0, 3);
});

test("a zero phase is the plain loop, and the output is the same every time", () => {
  const plain = lane(ramp);

  expect(lane(track(0).to(1, span(0, 2), ease.linear).loop(2, { phase: 0 }))).toEqual(plain);
  expect(lane(track(0).to(1, span(0, 2), ease.linear).loop(2, { phase: 0.7 }))).toEqual(
    lane(track(0).to(1, span(0, 2), ease.linear).loop(2, { phase: 0.7 })),
  );
});

test("a phase must be a finite number", () => {
  expect(() => track(0).to(1, span(0, 1)).loop(2, { phase: Number.NaN })).toThrow("finite phase");
});
