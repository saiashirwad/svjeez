import { describe, expect, test } from "bun:test";
import { Ink, tool } from "svjeez";
import { scene } from "../helpers/ink";

describe("Ink", () => {
  test("a still stroke is one filled outline from a symbol", () => {
    const svg = scene(<Ink d="M10 50H190" tool={tool.brush()} fill="#123456" />);
    expect(svg).toContain('fill="#123456"');
    expect(svg.match(/<use /g)).toHaveLength(1);
    expect(svg).not.toContain("<mask");
  });

  test("draw reveals it through a mask, then hands over to an unmasked copy", () => {
    const svg = scene(<Ink d="M10 50H190" tool={tool.brush()} draw={{ at: 0.2, over: 1 }} />);
    expect(svg.match(/<mask /g)).toHaveLength(1);
    expect(svg.match(/<use /g)).toHaveLength(2);
    expect(svg.match(/<symbol /g)).toHaveLength(1);
    expect(svg).toContain('pathLength="1"');
  });

  test("the same path and tool embed their outline once", () => {
    const hand = tool.pen();

    const svg = scene(
      <>
        <Ink d="M10 50H190" tool={hand} />
        <Ink d="M10 50H190" tool={hand} fill="red" />
      </>,
    );

    expect(svg.match(/<symbol /g)).toHaveLength(1);
  });
});
