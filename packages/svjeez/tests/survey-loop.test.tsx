import { expect, test } from "bun:test";
import { ease, span, track } from "svjeez";
import { passageOf } from "../src/author/track";
import { laneOf, mixNumber, type Timing } from "../src/model/steps";
import { changesOf } from "../src/check/survey";

const DURATION = 2;
const clock: Timing["clock"] = { offset: 0, end: DURATION, clips: [] };

const lane = (value: ReturnType<typeof track<number>>) =>
  laneOf(
    passageOf(value).data,
    0,
    { duration: DURATION, clock, reads: new Map() },
    mixNumber,
    "test",
  );

test("a looped sawtooth changes across every period, jump back included", () => {
  const saw = lane(track(0).to(10, span(0, 0.5), ease.linear).loop(0.5));
  const changes = changesOf(saw, DURATION);

  for (const period of [0, 1, 2, 3]) {
    const mid = period * 0.5 + 0.25;

    expect(changes.some(([a, b]) => a <= mid && b >= mid)).toBe(true);
  }

  // the snap back at each wrap is its own change
  for (const wrap of [0.5, 1, 1.5])
    expect(changes.some(([a, b]) => a === wrap && b === wrap)).toBe(true);
});
