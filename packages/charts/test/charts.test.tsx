import { describe, expect, test } from "bun:test";
import { Group, font, morph, scene, span, tokens, track, type SceneElement } from "svjeez";
import { SceneError, boxesOf, inspect, svg, type Scene } from "svjeez/tools";
import { Chart, area, bars, line, type Plot } from "../src/index.ts";

const theme = tokens({
  light: { bg: "#FFFFFF", ink: "#111111", soft: "#888888", blue: "#0A6CFF", red: "#E5453B" },
  dark: { bg: "#000000", ink: "#EEEEEE", soft: "#999999", blue: "#5EA0FF", red: "#FF6961" },
});

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url).pathname,
);

const look = { font: mono, axis: theme.soft, label: theme.ink, at: [50, 20] } as const;
const months = ["Jan", "Feb", "Mar"];
const band = { kind: "band", domain: months } as const;

const sceneOf = (build: () => SceneElement): Scene =>
  scene({ size: [400, 300], duration: 4, title: "chart", theme }, () => <Group>{build()}</Group>);

const planOf = (build: (plot: Plot) => SceneElement): Plot => {
  let seen: Plot | undefined;

  svg.emit(
    sceneOf(() => (
      <Chart
        {...look}
        size={[300, 200]}
        x={band}
        series={[bars({ Jan: 10, Feb: 40, Mar: 25 }, { color: theme.blue })]}
      >
        {(plot) => {
          seen = plot;

          return build(plot);
        }}
      </Chart>
    )),
  );

  return seen!;
};

const errorOf = (make: () => SceneElement): SceneError => {
  try {
    svg.emit(sceneOf(make));
  } catch (error) {
    if (!(error instanceof SceneError)) throw error;

    return error;
  }

  throw new Error("did not throw");
};

describe("scales", () => {
  test("a chart with bars fits y to the data and includes zero", () => {
    const plot = planOf(() => <Group />);

    expect(plot.y(0)).toBe(200);
    expect(plot.y(40)).toBe(0);
    expect(plot.bandwidth).toBeGreaterThan(0);
    expect(plot.x("Jan")).toBeLessThan(plot.x("Feb"));
  });

  test("a line alone fits tightly, so zero stays out", () => {
    let plot: Plot | undefined;

    svg.emit(
      sceneOf(() => (
        <Chart
          {...look}
          size={[300, 200]}
          x={{ kind: "linear" }}
          series={[
            line(
              [
                [1, 90],
                [2, 100],
              ],
              { color: theme.blue },
            ),
          ]}
        >
          {(p) => {
            plot = p;

            return <Group />;
          }}
        </Chart>
      )),
    );

    expect(plot!.y(100)).toBe(0);
    expect(plot!.y(90)).toBe(200);
  });

  test("x() names the categories when asked for another", () => {
    const plot = planOf(() => <Group />);

    expect(() => plot.x("Apr")).toThrow(
      'plot.x() got "Apr", which is not in x.domain (Jan, Feb, Mar)',
    );
  });
});

describe("drawing", () => {
  const sample = (): Scene =>
    sceneOf(() => (
      <Chart
        {...look}
        size={[300, 200]}
        x={band}
        series={[
          bars(
            { Jan: 10, Feb: 40, Mar: 25 },
            { name: "a", color: theme.blue, draw: track(0).to(1, span(0.2, 1)), values: true },
          ),
          bars(
            { Jan: 20, Feb: 10, Mar: 5 },
            { name: "b", color: theme.red, draw: track(0).to(1, span(0.4, 1)) },
          ),
        ]}
      />
    ));

  test("bars side by side share a band, and stay on the canvas", () => {
    const view = sample();
    const boxes = Object.entries(boxesOf(view, 4));
    const a = boxes.find(([key]) => key.endsWith("a/Jan"))![1];
    const b = boxes.find(([key]) => key.endsWith("b/Jan"))![1];

    expect(a.x + a.width).toBeLessThan(b.x);
    expect(b.height).toBeCloseTo(a.height * 2, 0);
    expect(inspect(view).filter((finding) => finding.severity === "error")).toEqual([]);
  });

  test("bars, an area with dots and a label emit animated svg", () => {
    const view = sceneOf(() => (
      <Chart
        {...look}
        size={[300, 200]}
        x={band}
        series={[
          bars(
            { Jan: 10, Feb: 40, Mar: 25 },
            { color: theme.blue, draw: track(0).to(1, span(0.2, 1)), values: true },
          ),
          area(
            [
              ["Jan", 10],
              ["Feb", 40],
              ["Mar", 25],
            ],
            {
              name: "trend",
              color: theme.red,
              draw: track(0).to(1, span(1, 1)),
              dots: true,
              label: "trend",
            },
          ),
        ]}
      />
    ));

    expect(svg.emit(view)).toContain("@keyframes");
    expect(inspect(view).filter((finding) => finding.severity === "error")).toEqual([]);
  });

  test("a changed dataset morphs between states", () => {
    const datasets: Record<string, number>[] = [
      { Jan: 10, Feb: 40 },
      { Jan: 30, Feb: 20, Mar: 35 },
    ];

    const states = datasets.map((values) => (
      <Chart
        key="c"
        {...look}
        size={[300, 200]}
        x={band}
        y={{ domain: [0, 40] }}
        series={[bars(values, { color: theme.blue })]}
      />
    ));

    const view = sceneOf(() => <Group>{morph.between(states, [span(1, 1)])}</Group>);

    expect(svg.emit(view)).toContain("@keyframes");
    expect(inspect(view).filter((finding) => finding.severity === "error")).toEqual([]);
  });
});

describe("errors", () => {
  const chart =
    (series: Parameters<typeof Chart>[0]["series"], extra = {}) =>
    () => <Chart {...look} size={[300, 200]} x={band} series={series} {...extra} />;

  test("a category outside x.domain names the series and the fix", () => {
    expect(errorOf(chart([bars({ Apr: 1 }, { name: "sales", color: theme.blue })])).message).toBe(
      'bars("sales") has "Apr", which is not in x.domain (Jan, Feb, Mar). Add it to x.domain, or drop it from the data.',
    );
  });

  test("bars need categories", () => {
    expect(
      errorOf(chart([bars({ a: 1 }, { color: theme.blue })], { x: { kind: "linear" } })).problem,
    ).toBe("bars() needs categories on the x axis, and x is linear.");
  });

  test("a lone point, a value outside y.domain and a repeated name", () => {
    expect(errorOf(chart([line([["Jan", 1]], { color: theme.blue })])).problem).toBe(
      "line() has 1 point.",
    );

    expect(
      errorOf(chart([bars({ Jan: 99 }, { color: theme.blue })], { y: { domain: [0, 10] } }))
        .problem,
    ).toBe("bars() has 99 at Jan, outside y.domain [0, 10].");

    expect(
      errorOf(
        chart([bars({ Jan: 1 }, { color: theme.blue }), bars({ Jan: 2 }, { color: theme.red })]),
      ).problem,
    ).toBe('Two series are both named "bars".');
  });

  test("a plot area with no size", () => {
    expect(errorOf(chart([], { size: [0, 200] })).problem).toBe("size is [0, 200].");
  });

  test("an unknown curve", () => {
    expect(
      errorOf(
        chart([
          line(
            [
              ["Jan", 1],
              ["Feb", 2],
            ],
            {
              color: theme.blue, // SAFETY: a JavaScript caller can pass any string.
              curve: "wavy" as "linear",
            },
          ),
        ]),
      ).fix,
    ).toBe('Use "linear", "monotone" or "step".');
  });
});
