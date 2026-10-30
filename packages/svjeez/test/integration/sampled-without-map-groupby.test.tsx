import { describe, expect, test } from "bun:test";
import { render, sampled } from "svjeez";
import { withoutMapGroupBy } from "../helpers/no-map-groupby";

describe("without Map.groupBy, as on Node 20", () => {
  withoutMapGroupBy();

  test("sampled groups channels by lane", () => {
    const svg = render(
      { width: 10, height: 10, duration: 1, title: "t" },
      <circle
        r={2}
        animation={sampled((t) => ({ x: t, y: t }), { duration: 1, tolerance: { translate: 0.1 } })}
      />,
    );

    expect(svg).toContain("@keyframes");
  });
});
