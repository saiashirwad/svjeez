import { describe, expect, test } from "bun:test";
import { timeAt } from "../../src/editor";
import { play } from "../helpers/live-editor";

describe("update", () => {
  test("pausing holds the time, seeking moves it, and playing goes on from there", () => {
    const paused = play([{ type: "pause", now: 1500 }]).state;
    expect(timeAt(paused.clock, 9000)).toBe(1.5);

    const sought = play([{ type: "seek", at: 3, now: 9000 }], paused).state;
    expect(timeAt(sought.clock, 9999)).toBe(3);

    const playing = play([{ type: "play", now: 10_000 }], sought).state;
    expect(timeAt(playing.clock, 11_000)).toBe(4);
  });
});
