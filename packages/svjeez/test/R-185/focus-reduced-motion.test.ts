import { describe, expect, test } from "bun:test";
import { el, rect, render } from "svjeez";
import { Focus } from "svjeez/extras";
import { frozen } from "../helpers/extras-frozen";

describe("reduced motion", () => {
  test("Focus freezes dimmed during its span with the focused rect lit", () => {
    const svg = render(
      { width: 100, height: 100, duration: 6, title: "Focus", reducedMotion: { at: 3 } },
      Focus({
        stops: [{ during: { at: 2, over: 2 }, target: rect(0, 0, 10, 10) }],
        dim: 0.3,
        children: el.rect({ width: 10, height: 10 }),
      }),
    );

    expect(svg).not.toContain("<animate");
    expect(frozen(svg, /<rect [^>]*width="120%"[^>]*class="a (m\d+)"/, "opacity", 50)).toBe("0.3");
    expect(frozen(svg, /<mask[^>]*>\s*<rect[^>]*\/>\s*<g class="a (m\d+)"/, "opacity", 50)).toBe(
      "1",
    );
  });
});

describe("errors name the call, the constraint and the value", () => {
  test.each([
    [
      "Focus",
      () => Focus({ stops: [], dim: 2, children: null }),
      "Focus() needs dim between 0 and 1, got 2.",
    ],
  ])("%s", (_, make, message) => {
    expect(make).toThrow(message);
  });
});
