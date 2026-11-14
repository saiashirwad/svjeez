import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { render, sampled } from "svjeez";

// Node 20 has no Map.groupBy; remove it so these run as they would there.
const native = Map.groupBy;

describe("without Map.groupBy, as on Node 20", () => {
  beforeAll(() => {
    // SAFETY: TypeScript types Map.groupBy as required, but this test deletes it, so the cast lets delete compile.
    delete (Map as { groupBy?: unknown }).groupBy;
  });
  afterAll(() => {
    Map.groupBy = native;
  });

  test("sampled groups channels by lane", () => {
    const svg = render(
      { width: 10, height: 10, duration: 1, title: "t" },
      <circle
        r={2}
        animation={sampled((t) => ({ x: t, y: t }), { over: 1, tolerance: { translate: 0.1 } })}
      />,
    );

    expect(svg).toContain("@keyframes");
  });
});
