import { describe, expect, test } from "bun:test";
import { render } from "svjeez";

describe("playbackRate", () => {
  test("playbackRate must be positive", () => {
    expect(() =>
      render({ width: 10, height: 10, duration: 1, title: "x", playbackRate: 0 }, null),
    ).toThrow(/playbackRate/);
  });
});
