import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { tint, defaultDark } from "svjeez/extras";
import { chart } from "../src/index.ts";

const scene = (...children: Parameters<typeof render>[1][]) =>
  render({ width: 500, height: 300, duration: 6, title: "chart" }, children);

const quarters = ["Q1", "Q2", "Q3", "Q4"];

const band = () =>
  chart({
    width: 400,
    height: 200,
    at: { x: 50, y: 20 },
    x: { kind: "band", domain: quarters },
    data: [
      ["Q1", 12],
      ["Q2", 48],
      ["Q3", 31],
      ["Q4", 87],
    ],
  });

describe("chart frame", () => {
  test("a fitted y domain includes 0 and is niced, so the baseline is the bottom of the plot", () => {
    const c = band();
    expect(c.y(0)).toBe(220);
    expect(c.y(100)).toBe(20);
    expect(scene(c.node)).toContain(">100</text>");
  });

  test("zero: false fits the data alone", () => {
    const c = chart({
      width: 400,
      height: 200,
      x: { kind: "band", domain: quarters },
      y: { zero: false },
      data: [
        ["Q1", 52],
        ["Q4", 87],
      ],
    });

    expect(c.y(50)).toBe(200);
  });

  test("an explicit domain is niced and wins over data", () => {
    const c = chart({
      width: 400,
      height: 200,
      x: { kind: "linear", domain: [0, 9.7], ticks: 5 },
      y: { domain: [3, 97] },
    });

    expect(c.x(10)).toBe(400);
    expect(c.y(100)).toBe(0);
  });

  test("a linear x scale fits the data when it has no domain", () => {
    const c = chart({
      width: 300,
      height: 100,
      x: { kind: "linear" },
      data: [
        [2, 1],
        [8, 5],
      ],
    });

    expect(c.x(2)).toBeGreaterThanOrEqual(0);
    expect(c.x(8)).toBeLessThanOrEqual(300);
  });

  test("bands sit in domain order, evenly, and x() returns each band's center", () => {
    const c = band();
    const centers = quarters.map((q) => c.x(q));
    expect(centers).toEqual([...centers].sort((a, b) => a - b));
    expect(centers[1]! - centers[0]!).toBeCloseTo(centers[2]! - centers[1]!, 6);
    expect(c.bandwidth).toBeGreaterThan(0);
    expect(c.bandwidth).toBeLessThan(100);
  });

  test("it draws its axes in the colors axes() uses", () => {
    const svg = scene(band().node);
    expect(svg).toContain(tint(defaultDark, "comment"));
    expect(svg).toContain(tint(defaultDark, "muted"));

    for (const q of quarters) expect(svg).toContain(`>${q}</text>`);
  });

  test("grid adds faint lines across the plot", () => {
    const [plain, gridded] = [false, true].map((grid) =>
      scene(
        chart({
          width: 400,
          height: 200,
          grid,
          x: { kind: "band", domain: quarters },
          data: [["Q1", 5]],
        }).node,
      ),
    );

    expect(plain).not.toContain("stroke-opacity");
    expect(gridded).toContain("stroke-opacity");
  });
});

describe("bars", () => {
  test("each bar rests with its top at y(value) and its foot on the baseline", () => {
    const c = band();
    const { bars } = c.bars({ Q1: 12, Q4: 87 });
    expect(bars.map((b) => b.key)).toEqual(["Q1", "Q4"]);
    expect(bars[1]!.bounds.y).toBeCloseTo(c.y(87), 1);
    expect(bars[1]!.bounds.y + bars[1]!.bounds.h).toBeCloseTo(c.y(0), 1);
  });

  test("bars grow with a stagger and report when the last one lands", () => {
    const c = band();
    const result = c.bars({ Q1: 12, Q2: 48, Q3: 31, Q4: 87 }, { at: 1, over: 0.5, stagger: 0.2 });
    expect(result.end).toBeCloseTo(2.1, 6);
    const svg = scene(result.node);
    expect(svg).toContain("@keyframes");
    expect(svg.match(/animation-name:/g)?.length).toBe(4);
  });

  test("grouped series sit side by side inside a band", () => {
    const c = band();
    const a = c.bars({ Q1: 10 }, { group: { index: 0, count: 2 } }).bars[0]!.bounds;
    const b = c.bars({ Q1: 20 }, { group: { index: 1, count: 2 } }).bars[0]!.bounds;
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.w);
    expect(a.w).toBeLessThan(c.bandwidth / 2);
  });

  test("series take the theme's accents in a fixed order unless told a color", () => {
    const c = band();
    const first = scene(c.bars({ Q1: 1 }).node);
    const second = scene(c.bars({ Q1: 1 }).node);
    expect(first).toContain(tint(defaultDark, "blue"));
    expect(second).toContain(tint(defaultDark, "number"));
    expect(scene(c.bars({ Q1: 1 }, { color: "#ff0000" }).node)).toContain("#ff0000");
  });

  test("values writes each number at its bar", () => {
    const svg = scene(band().bars({ Q4: 87 }, { values: true }).node);
    expect(svg).toContain(">87</text>");
  });

  test("a negative bar hangs from the zero line", () => {
    const c = chart({
      width: 400,
      height: 200,
      x: { kind: "band", domain: ["a", "b"] },
      y: { domain: [-50, 50] },
    });

    const [up, down] = c.bars({ a: 25, b: -25 }).bars;
    expect(up!.bounds.y + up!.bounds.h).toBeCloseTo(c.y(0), 1);
    expect(down!.bounds.y).toBeCloseTo(c.y(0), 1);
    expect(down!.bounds.y + down!.bounds.h).toBeCloseTo(c.y(-25), 1);
  });
});

describe("line and area", () => {
  const c = chart({
    width: 400,
    height: 200,
    x: { kind: "linear", domain: [0, 10] },
    y: { domain: [0, 100] },
  });

  const points = [
    [0, 10],
    [5, 60],
    [10, 40],
  ] as const;

  test("a line has one scene point per datum and draws on over its span", () => {
    const line = c.line(points, { at: 1, over: 2 });
    expect(line.points).toHaveLength(3);
    expect(line.points[1]).toEqual({ x: c.x(5), y: c.y(60) });
    expect(line.end).toBe(3);
    expect(line.d).toMatch(/^M/);
    expect(scene(line.node)).toContain("stroke-dasharray");
  });

  test("curves change the path", () => {
    const [linear, smooth, step] = (["linear", "monotone", "step"] as const).map(
      (curve) => c.line(points, { curve }).d,
    );

    expect(new Set([linear, smooth, step]).size).toBe(3);
    expect(linear).not.toContain("C");
    expect(smooth).toContain("C");
  });

  test("dots add one circle per point", () => {
    const svg = scene(c.line(points, { dots: true }).node);
    expect(svg.match(/<circle/g)?.length).toBe(3);
  });

  test("a label is written past the last point", () => {
    expect(scene(c.line(points, { label: "median" }).node)).toContain(">median</text>");
  });

  test("an area fills down to the baseline and wipes in", () => {
    const area = c.area(points);
    expect(area.fill).toMatch(/Z$/);
    expect(area.fill).toContain(`${c.y(0)}`);
    const svg = scene(area.node);
    expect(svg).toContain("<clipPath");
    expect(svg).toContain("<linearGradient");
  });

  test("line: false leaves just the fill", () => {
    const svg = scene(c.area(points, { line: false }).node);
    expect(svg).not.toContain("stroke-dasharray");
  });

  test("a band chart draws lines through its category centers", () => {
    const b = band();

    const line = b.line([
      ["Q1", 10],
      ["Q2", 40],
      ["Q4", 70],
    ]);

    expect(line.points.map((p) => p.x)).toEqual([b.x("Q1"), b.x("Q2"), b.x("Q4")]);
  });
});

describe("errors name the call, what it got and the fix", () => {
  const c = band();

  test("chart()", () => {
    expect(() =>
      chart({ width: 0, height: 10, x: { kind: "band", domain: ["a"] }, data: [["a", 1]] }),
    ).toThrow("chart() needs a positive width and height, got 0 and 10.");
    expect(() => chart({ width: 10, height: 10, x: { kind: "band", domain: ["a"] } })).toThrow(
      "chart() needs y.domain or data to fit the y scale, got neither.",
    );
    expect(() =>
      chart({ width: 10, height: 10, x: { kind: "band", domain: [] }, y: { domain: [0, 1] } }),
    ).toThrow("chart() needs at least one x.domain category, got none.");
    expect(() =>
      chart({
        width: 10,
        height: 10,
        x: { kind: "band", domain: ["a", "a"] },
        y: { domain: [0, 1] },
      }),
    ).toThrow(`chart() needs distinct x.domain categories, got "a" twice.`);
    expect(() =>
      chart({
        width: 10,
        height: 10,
        x: { kind: "linear", domain: [0, 1] },
        data: [[0, Number.NaN]],
      }),
    ).toThrow("chart() needs finite data, got [0, NaN] at index 0.");
    expect(() =>
      chart({ width: 10, height: 10, x: { kind: "linear" }, y: { domain: [0, 1] } }),
    ).toThrow("chart() needs x.domain or data to fit the x scale, got neither.");
  });

  test("bars()", () => {
    expect(() => c.bars({})).toThrow("bars() needs at least one value, got none.");
    expect(() => c.bars({ Q5: 1 })).toThrow(
      `bars() got "Q5", which is not in the x domain (Q1, Q2, Q3, Q4). Add it to x.domain.`,
    );
    expect(() => c.bars({ Q1: Number.NaN })).toThrow(
      `bars() needs finite values, got NaN for "Q1".`,
    );
    expect(() => c.bars({ Q1: 500 })).toThrow(
      `bars() got 500 for "Q1", outside the y domain [0, 100].`,
    );
    expect(() => c.bars({ Q1: 1 }, { over: 0 })).toThrow("bars() needs a positive over, got 0.");
    expect(() => c.bars({ Q1: 1 }, { group: { index: 2, count: 2 } })).toThrow(
      "bars() needs group.index below group.count, got 2 of 2.",
    );
  });

  test("line() and area()", () => {
    expect(() => c.line([["Q1", 1]])).toThrow("line() needs at least 2 points, got 1.");
    expect(() =>
      c.line([
        ["Q1", 1],
        ["Q9", 2],
      ]),
    ).toThrow(`line() got "Q9" at index 1, which is not in the x domain`);
    expect(() =>
      c.line([
        ["Q1", 1],
        ["Q2", Number.POSITIVE_INFINITY],
      ]),
    ).toThrow("line() needs finite values, got [Q2, Infinity] at index 1.");
    expect(() =>
      c.area([
        ["Q1", 1],
        ["Q2", 900],
      ]),
    ).toThrow("area() got [Q2, 900] at index 1, outside the chart");
    expect(() =>
      c.line(
        [
          ["Q1", 1],
          ["Q2", 2],
        ],
        // SAFETY: a deliberately invalid curve, to reach the runtime check that plain JS callers hit.
        { curve: "wavy" as "step" },
      ),
    ).toThrow(`line() needs curve "linear", "monotone" or "step", got "wavy".`);
  });

  test("bars() on a linear scale", () => {
    const linear = chart({
      width: 10,
      height: 10,
      x: { kind: "linear", domain: [0, 1] },
      y: { domain: [0, 1] },
    });

    // @ts-expect-error bars() exists only on a band scale
    expect(() => linear.bars({ a: 1 })).toThrow("bars() needs a band x scale, got a linear one.");
  });
});
