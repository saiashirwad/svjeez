import { describe, expect, test } from "bun:test";
import { Group, draw, enter, scene, span, tokens, track, type SceneElement } from "svjeez";
import { jsxDEV } from "svjeez/jsx-dev-runtime";
import { SceneError, boxesOf, svg, type Model } from "svjeez/tools";
import { Icon, type IconData, type IconProps } from "../src/index.ts";
import { check, heartFilled, rocket } from "../src/tabler.ts";

const theme = tokens({ light: { ink: "#111111" }, dark: { ink: "#EEEEEE" } });

const two: IconData = { grid: 10, kind: "stroke", paths: ["M0 5h10", "M5 0v10"] };
const solid: IconData = { grid: 10, kind: "fill", paths: ["M0 0h10v10z"] };

const draws = (...children: SceneElement[]): Model.Scene =>
  scene({ size: [200, 100], duration: 3, title: "Icons", theme }, () => Group({ children }));

const icon = (props: IconProps, line = 1): SceneElement =>
  jsxDEV(Icon, props, undefined, false, {
    fileName: "scene.tsx",
    lineNumber: line,
    columnNumber: 3,
  });

const thrown = (build: () => Model.Scene): SceneError => {
  try {
    build();
  } catch (error) {
    if (error instanceof SceneError) return error;
    throw error;
  }

  throw new Error("nothing was thrown");
};

interface Loose {
  readonly grid?: number;
  readonly kind?: string;
  readonly paths?: readonly string[];
}

const paths = (markup: string): string[] => markup.match(/<path [^>]*>/g) ?? [];

describe("Icon", () => {
  test("draws one stroked path per piece", () => {
    const markup = svg.emit(draws(icon({ icon: rocket, color: theme.ink })));

    expect(paths(markup)).toHaveLength(rocket.paths.length);
    expect(markup).toContain('stroke="var(--ink)"');
    expect(markup).toContain('stroke-width="2"');
    expect(markup).toContain('stroke-linecap="round"');
  });

  test("a solid icon is filled and takes no width", () => {
    const markup = svg.emit(draws(icon({ icon: heartFilled, color: "#E5453B" })));

    expect(paths(markup)).toHaveLength(1);
    expect(markup).toContain('fill="#E5453B"');
    expect(markup).not.toContain("stroke-width");

    const error = thrown(() => draws(icon({ icon: heartFilled, color: "#E5453B", width: 1 }, 9)));

    expect(error.message).toStartWith(
      "scene.tsx:9:3: <Icon> is given a width, but its icon is solid",
    );
  });

  test("size scales the icon from its grid", () => {
    const at = (size: number) => {
      const model = draws(icon({ icon: two, color: "#111111", size, key: "i" }));

      return boxesOf(model, 0)["i"]!;
    };

    const small = at(10);
    const big = at(40);

    expect(big.width).toBeCloseTo(small.width * 4, 3);
    expect(big.height).toBeCloseTo(small.height * 4, 3);
  });

  test("a trim function gets each piece's place and a trim can animate", () => {
    const seen: [number, number][] = [];

    const markup = svg.emit(
      draws(
        icon({
          icon: two,
          color: "#111111",
          trim: (piece, pieces) => {
            seen.push([piece, pieces]);

            return draw(span(0.2, 0.5).shift(piece * 0.5));
          },
        }),
      ),
    );

    expect(seen).toEqual([
      [0, 2],
      [1, 2],
    ]);
    expect(markup.match(/@keyframes/g)).toHaveLength(2);
  });

  test("an icon moves as one through the props every node takes", () => {
    const markup = svg.emit(
      draws(icon({ icon: two, color: "#111111", motion: enter(span(0, 0.5)), at: [10, 10] })),
    );

    expect(markup.match(/@keyframes/g)).toHaveLength(1);
  });

  test("shared icons define their paths once", () => {
    const uses = [0, 1, 2].map((i) =>
      icon({ icon: rocket, color: theme.ink, shared: true, at: [i * 30, 0] }),
    );

    const markup = svg.emit(draws(...uses));

    expect(markup.match(/<use /g)).toHaveLength(3);
    expect(paths(markup)).toHaveLength(rocket.paths.length);
  });

  test("shared icons of different colors are different definitions", () => {
    const markup = svg.emit(
      draws(
        icon({ icon: rocket, color: "#111111", shared: true }),
        icon({ icon: rocket, color: "#222222", shared: true }),
      ),
    );

    expect(paths(markup)).toHaveLength(rocket.paths.length * 2);
  });

  test("an icon is reusable across scenes", () => {
    const build = () => svg.emit(draws(icon({ icon: check, color: theme.ink, shared: true })));

    expect(build()).toBe(build());
  });
});

describe("Icon errors", () => {
  test("a trim on a solid icon says what to do instead", () => {
    const error = thrown(() =>
      draws(icon({ icon: solid, color: "#111111", trim: draw(span(0, 1)) }, 4)),
    );

    expect(error.node).toBe("<Icon>");
    expect(error.source).toEqual({ file: "scene.tsx", line: 4, column: 3 });
    expect(error.problem).toContain("solid");
    expect(error.fix).toContain("enter()");
  });

  test("a shared icon cannot change color or draw", () => {
    const error = thrown(() =>
      draws(
        // @ts-expect-error a track is not a color a shared icon can have
        icon({
          icon: rocket,
          color: track<"#111111" | "#222222">("#111111").to("#222222", span(0, 1)),
          shared: true,
        }),
      ),
    );

    expect(error.problem).toContain("is shared, so it is drawn once");
    expect(error.fix).toContain("drop shared");
  });

  test("a made-up icon is checked", () => {
    const bad = (value: Loose, text: string) =>
      // @ts-expect-error not an IconData on purpose
      expect(thrown(() => draws(icon({ icon: value, color: "#111111" }))).problem).toContain(text);

    bad({ grid: 0, kind: "stroke", paths: ["M0 0"] }, "grid is");
    bad({ grid: 24, kind: "line", paths: ["M0 0"] }, "kind");
    bad({ grid: 24, kind: "stroke", paths: [] }, "paths");
    bad({ grid: 24, kind: "stroke", paths: ["circle"] }, "paths");
    bad({}, "no icon to draw");
  });

  test("a size or width that is not a positive number is named", () => {
    expect(thrown(() => draws(icon({ icon: two, color: "#111111", size: 0 }))).problem).toContain(
      "size",
    );
    expect(thrown(() => draws(icon({ icon: two, color: "#111111", width: -1 }))).problem).toContain(
      "width",
    );
  });

  test("path data that does not parse names the icon", () => {
    const broken: IconData = { grid: 24, kind: "stroke", paths: ["Mx"] };

    expect(() => draws(icon({ icon: broken, color: "#111111" }, 6))).toThrow("scene.tsx:6");
  });
});
