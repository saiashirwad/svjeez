import { describe, expect, test } from "bun:test";
import { cut, shot, visible } from "svjeez/extras";
import { at } from "../helpers/extras-probe";

describe("time helpers", () => {
  test("visible is on during each span and stays on across gaps shorter than two fades", () => {
    const track = visible(
      [
        { at: 5, over: 1 },
        { at: 1, over: 1 },
        { at: 2.2, over: 0.8 },
      ],
      0.15,
    );

    expect([0.5, 1.5, 2.1, 2.5, 4, 5.5, 7].map((t) => at(track, t).opacity)).toEqual([
      0, 1, 1, 1, 0, 1, 0,
    ]);
  });

  test("cut is on only during its span, with no fade either side", () => {
    expect([0.9, 1.01, 2.99, 3.01].map((t) => at(cut({ at: 1, over: 2 }), t).opacity)).toEqual([
      0, 1, 1, 0,
    ]);
    expect([0, 0.5, 1.01].map((t) => at(cut({ at: 0, over: 1 }), t).opacity)).toEqual([1, 1, 0]);
  });

  test("a shot moves in and out inside its span, and cuts by default", () => {
    const risen = shot({ at: 10, over: 10 }, { enter: "rise", exit: "rise", over: 1 });
    expect([9.9, 15, 20.1].map((t) => at(risen, t).opacity)).toEqual([0, 1, 0]);
    expect([9.9, 15, 20.1].map((t) => at(risen, t).y)).toEqual([24, 0, -24]);
    expect(
      [9.99, 10.01, 19.99, 20.01].map((t) => at(shot({ at: 10, over: 10 }), t).opacity),
    ).toEqual([0, 1, 1, 0]);
    expect(at(shot({ at: 0, over: 5 }, { exit: "slide" }), 5.1).x).toBeCloseTo(-80);
    expect(() => shot({ at: 1, over: 0 })).toThrow("positive length");
  });
});
