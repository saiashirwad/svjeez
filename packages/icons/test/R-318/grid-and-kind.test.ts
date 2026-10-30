import { describe, expect, test } from "bun:test";
import type { Icon } from "../../src/icon.ts";
import * as lucide from "../../src/lucide.ts";
import * as tabler from "../../src/tabler.ts";

const sets = { tabler, lucide } as const;

describe.each(Object.entries(sets))("%s", (_, set) => {
  const icons: [string, Icon][] = Object.entries(set);

  test("every icon is a square grid of nonempty paths", () => {
    expect(icons.length).toBeGreaterThan(1000);

    const broken = icons.filter(
      ([, { grid, kind, paths }]) =>
        !(grid > 0) ||
        !["stroke", "fill"].includes(kind) ||
        paths.length === 0 ||
        paths.some((d) => !/^[Mm]/.test(d)),
    );

    expect(broken.map(([name]) => name)).toEqual([]);
  });
});

describe("tabler", () => {
  test("a filled icon is a fill icon with a Filled suffix", () => {
    expect(tabler.checkFilled.kind).toBe("fill");
    expect(tabler.check.kind).toBe("stroke");
    expect(tabler.arrowLeft.paths.length).toBeGreaterThan(0);
  });
});
