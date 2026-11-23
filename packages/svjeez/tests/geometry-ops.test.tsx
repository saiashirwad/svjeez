/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import {
  Group,
  Shape,
  along,
  alpha,
  around,
  bounds,
  circle,
  length,
  line,
  merge,
  mirrored,
  path,
  pointAt,
  random,
  rect,
  reversed,
  rotated,
  scaled,
  scene,
  spline,
  tokens,
  type Vec,
} from "svjeez";
import { svg } from "svjeez/tools";

describe("geometry transforms and queries", () => {
  test("rotated, scaled, mirrored and reversed transform outlines accurately", () => {
    const seg = line([0, 0], [10, 0]);
    const turned = rotated(seg, 90);
    const turnedBox = bounds(turned);

    expect(turnedBox.width).toBeCloseTo(0, 4);
    expect(turnedBox.height).toBeCloseTo(10, 4);
    expect(pointAt(turned, 1).point[0]).toBeCloseTo(0, 4);
    expect(pointAt(turned, 1).point[1]).toBeCloseTo(10, 4);

    const pivoted = rotated(seg, 90, [5, 0]);
    expect(pointAt(pivoted, 0).point[0]).toBeCloseTo(5, 4);
    expect(pointAt(pivoted, 0).point[1]).toBeCloseTo(-5, 4);

    const bigger = scaled(rect(10, 20), [2, 3]);
    expect(bounds(bigger)).toEqual({ x: 0, y: 0, width: 20, height: 60 });

    const flippedX = mirrored(line([2, 0], [8, 0]), "x");
    expect(pointAt(flippedX, 0).point[0]).toBeCloseTo(-2, 4);
    expect(pointAt(flippedX, 1).point[0]).toBeCloseTo(-8, 4);

    const flippedY = mirrored(line([0, 3], [0, 7]), "y", [0, 5]);
    expect(pointAt(flippedY, 0).point[1]).toBeCloseTo(7, 4);
    expect(pointAt(flippedY, 1).point[1]).toBeCloseTo(3, 4);

    const back = reversed(seg);
    expect(pointAt(back, 0).point[0]).toBeCloseTo(10, 4);
    expect(pointAt(back, 1).point[0]).toBeCloseTo(0, 4);
  });

  test("merge and around combine multiple outlines into one geometry", () => {
    const combined = merge(rect(10, 10), circle(5));
    expect(bounds(combined).x).toBeCloseTo(-5, 3);
    expect(bounds(combined).width).toBeCloseTo(15, 3);

    const petal = line([0, -10], [0, -20]);
    const ring = around(4, petal);
    const box = bounds(ring);

    expect(box.x).toBeCloseTo(-20, 3);
    expect(box.y).toBeCloseTo(-20, 3);
    expect(box.width).toBeCloseTo(40, 3);
    expect(box.height).toBeCloseTo(40, 3);

    const angles: number[] = [];
    const indices: number[] = [];

    const custom = around(
      3,
      (deg, index) => {
        angles.push(deg);
        indices.push(index);

        return line([0, 0], [10, 0]);
      },
      { offset: 30 },
    );

    expect(angles).toEqual([30, 150, 270]);
    expect(indices).toEqual([0, 1, 2]);
    expect(length(custom)).toBeCloseTo(30, 3);
  });

  test("length, pointAt (degrees), along and spline", () => {
    const horizontal = line([0, 0], [100, 0]);
    expect(length(horizontal)).toBeCloseTo(100, 4);

    const mid = pointAt(horizontal, 0.25);
    expect(mid.point[0]).toBeCloseTo(25, 4);
    expect(mid.point[1]).toBeCloseTo(0, 4);
    expect(mid.angle).toBeCloseTo(0, 4);

    const vertical = line([0, 0], [0, 50]);
    expect(pointAt(vertical, 0.5).angle).toBeCloseTo(90, 4);

    const pts = along(horizontal, 5);
    expect(pts.map(([x]) => Math.round(x))).toEqual([0, 25, 50, 75, 100]);

    const ringPts = along(circle(10), 4);
    expect(ringPts).toHaveLength(4);
    expect(
      Math.hypot(ringPts[0]![0] - ringPts[2]![0], ringPts[0]![1] - ringPts[2]![1]),
    ).toBeCloseTo(20, 1);

    const knots: readonly Vec[] = [
      [0, 0],
      [20, 30],
      [60, 10],
      [100, 40],
    ];

    const openSpline = spline(knots);
    expect(pointAt(openSpline, 0).point[0]).toBeCloseTo(0, 3);
    expect(pointAt(openSpline, 1).point[0]).toBeCloseTo(100, 3);
    expect(pointAt(openSpline, 1).point[1]).toBeCloseTo(40, 3);

    const closedSpline = spline(knots, { closed: true });
    expect(length(closedSpline)).toBeGreaterThan(length(openSpline));
  });

  test("PathBuilder.arcTo and PathBuilder.add build compound shapes", () => {
    const semi = path().moveTo([0, 0]).arcTo(20, 20, 0, false, true, [40, 0]).close();
    const box = bounds(semi);

    expect(box.x).toBeCloseTo(0, 2);
    expect(box.width).toBeCloseTo(40, 2);
    expect(box.height).toBeCloseTo(20, 2);

    const built = path().moveTo([0, 0]).lineTo([10, 0]).add(circle(5));
    expect(length(built)).toBeCloseTo(10 + 2 * Math.PI * 5, 1);
  });
});

describe("alpha and random", () => {
  test("alpha sets opacity on hex colors and tokens", () => {
    const translucent = alpha("#FF0000", 0.5);
    expect(translucent).toBe("#ff000080");

    const theme = tokens({
      light: { ink: "#112233", bg: "#FFFFFF" },
      dark: { ink: "#DDEEFF", bg: "#111111" },
    });

    const model = scene({ size: [100, 100], duration: 1, title: "Alpha", theme }, () => (
      <Group>
        <Shape geometry={rect(40, 40)} fill={alpha(theme.ink, 0.25)} />
      </Group>
    ));

    const out = svg.emit(model);
    expect(out).toContain("color-mix");
  });

  test("random(seed) produces a deterministic sequence in [0, 1)", () => {
    const a = random(42);
    const b = random(42);
    const c = random(99);

    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    const seqC = Array.from({ length: 8 }, () => c());

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);

    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
