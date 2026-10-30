import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { fieldFlow, fieldLines, streamlines } from "svjeez/extras";
import { bounds } from "../helpers/field";

describe("fieldFlow", () => {
  const { lines } = streamlines(() => [1, 0], { bounds, spacing: 50 });

  test("loops one particle per line out of step with the others", () => {
    const svg = render(
      { width: 400, height: 300, duration: 8, title: "Flow", reducedMotion: false },
      <>
        {fieldLines(lines, { at: 0, over: 2 }).toString()}
        {fieldFlow(lines, { at: 1 })}
      </>,
    );

    expect(svg.match(/<circle/g)!.length).toBeGreaterThanOrEqual(lines.length);
    expect(new Set(svg.match(/translate:[\d.]+px [\d.]+px/g)).size).toBeGreaterThan(lines.length);
  });
});
