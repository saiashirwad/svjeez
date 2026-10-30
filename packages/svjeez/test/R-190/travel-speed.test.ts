import { describe, expect, test } from "bun:test";
import { travel } from "svjeez/extras";
import { at } from "../helpers/extras-probe";

describe("time helpers", () => {
  test("travel crosses each leg at one speed, then hides", () => {
    const track = travel(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 300 },
      ],
      { at: 1, speed: 100 },
    );

    expect(at(track, 0.5)).toMatchObject({ opacity: 0, x: 0, y: 0 });
    expect(at(track, 2)).toMatchObject({ opacity: 1, x: 100, y: 0 });
    expect(at(track, 5.5)).toMatchObject({ x: 100, y: 300, opacity: 0 });
    expect(() => travel([{ x: 1, y: 1 }], { at: 0 })).toThrow();
  });
});
