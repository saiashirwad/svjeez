import { describe, expect, test } from "bun:test";
import { rect } from "svjeez";
import { Marker } from "svjeez/extras";
import { frozen, frozenMarker } from "../helpers/extras-frozen";

describe("reduced motion", () => {
  test("an animated Marker freezes at its stop's size, with no SMIL", () => {
    const svg = frozenMarker();

    expect(svg).not.toContain("<animate");
    const marker = /<rect [^>]*rx="6"[^>]*class="a (m\d+)"/;
    expect([
      frozen(svg, marker, "width", (4 / 6) * 100),
      frozen(svg, marker, "height", (4 / 6) * 100),
    ]).toEqual(["30px", "40px"]);
  });
});

describe("errors name the call, the constraint and the value", () => {
  const span = { at: 0, over: 1 };
  test.each([
    ["Marker", () => Marker({ stops: [] }), "Marker() needs at least one stop, got none."],
    [
      "Marker over",
      () => Marker({ stops: [{ during: span, target: rect(0, 0, 1, 1) }], over: 0 }),
      "Marker() needs a positive over, got 0.",
    ],
  ])("%s", (_, make, message) => {
    expect(make).toThrow(message);
  });
});
