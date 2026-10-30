import { describe, expect, test } from "bun:test";
import { ease, motion, render } from "svjeez";

describe("the d channel", () => {
  test("the still twin draws the shape the morph has reached at the still moment", () => {
    const svg = render(
      { width: 100, height: 100, duration: 4, title: "Test", reducedMotion: { at: 2 } },
      <path
        d="M0 0H10"
        animation={motion({ d: "M0 0H10" }).at(1).to({ d: "M0 10H20" }, 2, ease.linear)}
      />,
    );

    expect(svg).toMatch(/<path[^>]*d="M0 5H15"/);
  });
});
