import { describe, expect, test } from "bun:test";
import { readingTime, timeline } from "svjeez/extras";
import { at } from "../helpers/extras-probe";

describe("pacing", () => {
  test("pace scales scenes, not gaps", () => {
    const tl = timeline({ intro: 2, body: 3 }, { gap: 0.5, pace: 2 });
    expect([tl.intro, tl.body, tl.duration]).toEqual([
      { at: 0, over: 4 },
      { at: 4.5, over: 6 },
      10.5,
    ]);
  });

  test("a timeline starting inside another's scene lays out its beats from there", () => {
    const outer = timeline({ intro: 2, body: 6 }, { gap: 1 });
    const beats = timeline({ setup: 1, punchline: 2 }, { at: outer.body.at, gap: 0.5 });
    expect([beats.setup, beats.punchline, beats.duration, beats.end]).toEqual([
      { at: 3, over: 1 },
      { at: 4.5, over: 2 },
      3.5,
      6.5,
    ]);
  });

  test("readingTime holds for words / wps + settle, at least min", () => {
    expect(readingTime("one two three four five six seven")).toBe(3);
    expect(
      readingTime(["one two three", "four five six seven"], { wps: 7, settle: 0, min: 0 }),
    ).toBe(1);
    expect(readingTime("hi")).toBe(2);
  });
});

describe("time helpers", () => {
  test("a timeline's show fades a scene in and out, and its enter fades in and stays", () => {
    const tl = timeline({ intro: 4, body: 4 }, { fade: 0.5 });
    expect([3, 6, 50].map((t) => at(tl.show("body"), t).opacity)).toEqual([0, 1, 0]);
    expect([3, 6, 50].map((t) => at(tl.enter("body"), t).opacity)).toEqual([0, 1, 1]);
    expect(() => timeline({ enter: 1 })).toThrow('"enter" is reserved');
  });
});
