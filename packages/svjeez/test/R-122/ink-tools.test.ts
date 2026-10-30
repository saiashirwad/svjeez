import { describe, expect, test } from "bun:test";
import { inkPath, tool } from "svjeez";
import { thickness } from "../helpers/ink";

describe("tools", () => {
  const line = "M0 50H200";

  test("a pen draws an even line at its size", () => {
    const d = inkPath(line, tool.pen({ size: 2, taper: 0 }));
    expect(thickness(d, 100)).toBeCloseTo(2, 0);
  });

  test("a brush is widest mid-stroke and comes to a point at the ends", () => {
    const d = inkPath(line, tool.brush({ size: 8, pressure: 0, wobble: 0 }));
    expect(thickness(d, 100)).toBeCloseTo(8, 0);
    expect(thickness(d, 3)).toBeLessThan(2);
  });

  test("a nib is thick across its edge and thin along it", () => {
    const chisel = tool.nib({ size: 6, angle: 0, thin: 0.1 });
    expect(thickness(inkPath(line, chisel), 100)).toBeCloseTo(0.6, 0);
    expect(chisel.width(0.5, 50, Math.PI / 2)).toBeCloseTo(6, 6);
  });

  test("a pencil wavers with a seed", () => {
    expect(inkPath(line, tool.pencil({ seed: 3 }))).not.toBe(
      inkPath(line, tool.pencil({ seed: 4 })),
    );
  });
});
