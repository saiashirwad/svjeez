/** @jsxImportSource svjeez/scene */
import { describe, expect, test } from "bun:test";
import {
  Group,
  Image,
  Instance,
  Sequence,
  Shape,
  arc,
  circle,
  diagnose,
  ease,
  ellipse,
  isLane,
  line,
  picture,
  polygon,
  rect,
  sampled,
  scene,
  shake,
  show,
  span,
  svg,
  svgPath,
  symbol,
  track,
  type Model,
  type SceneElement,
  type Vec,
} from "svjeez/scene";

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test" }, build);

const only = (model: Model.Scene): Model.SceneNode => model.root.children[0]!;

const shapeOf = (model: Model.Scene): Model.ShapeNode => {
  const node = only(model);

  if (node.kind !== "shape") throw new Error(`expected a shape, got a ${node.kind}`);

  return node;
};

const geometryLane = (model: Model.Scene): Model.Lane<Model.Geometry> => {
  const { geometry } = shapeOf(model);

  if (!isLane(geometry)) throw new Error("expected a geometry lane");

  return geometry;
};

const structure = (geometry: Model.Geometry): string =>
  geometry.kind === "path"
    ? geometry.contours.map((c) => `${c.curves.length}${c.closed ? "z" : ""}`).join(",")
    : geometry.kind;

const body = (build: () => SceneElement, duration = 4): string =>
  svg.emit(made(build, duration)).split("</style>").at(-1)!;

const css = (build: () => SceneElement): string => svg.emit(made(build)).split("</style>")[0]!;

/** The path data an `<animate attributeName="d">` moves through. */
const morphs = (out: string): string[] =>
  /attributeName="d" values="([^"]*)"/.exec(out)?.[1]?.split(";") ?? [];

const commands = (d: string): string => d.replace(/[-\d.]+/g, "#").replace(/\s+/g, "");

describe("animated geometry", () => {
  test("keys of one parametric kind stay that kind, and the box and origin are the first key's", () => {
    const model = made(() => (
      <Shape geometry={track(rect(10, 10)).to(rect(40, 20, { radius: 4 }), span(0, 1))} />
    ));

    const lane = geometryLane(model);

    expect(lane.keys.map((key) => key.value.kind)).toEqual(["rect", "rect", "rect"]);
    expect(lane.keys[1]!.value).toEqual({ kind: "rect", size: [40, 20], radius: [4, 4, 4, 4] });
    expect(shapeOf(model).box).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(shapeOf(model).origin).toEqual([5, 5]);
  });

  test("any other pair of kinds becomes paths with the same contours and curve counts", () => {
    const lane = geometryLane(
      made(() => (
        <Shape
          geometry={track(rect(20, 20))
            .to(ellipse(10, 6), span(0, 1))
            .to(svgPath("M0 0L10 0L5 8Z M20 0L30 0L25 8Z"), span(1, 1))}
        />
      )),
    );

    const shapes = new Set(lane.keys.map((key) => structure(key.value)));

    expect(lane.keys.every((key) => key.value.kind === "path")).toBe(true);
    expect([...shapes]).toHaveLength(1);
  });

  test("polygons blend by point when they have as many points, and match as paths when not", () => {
    const tri = polygon([
      [0, 0],
      [10, 0],
      [5, 8],
    ]);

    const same = geometryLane(
      made(() => (
        <Shape
          geometry={track(tri).to(
            polygon([
              [0, 0],
              [20, 0],
              [10, 16],
            ]),
            span(0, 1),
          )}
        />
      )),
    );

    const other = geometryLane(
      made(() => (
        <Shape
          geometry={track(tri).to(
            polygon([
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
            ]),
            span(0, 1),
          )}
        />
      )),
    );

    expect(same.keys[0]!.value.kind).toBe("polygon");
    expect(other.keys[0]!.value.kind).toBe("path");
  });

  test("a contour closed in one key and open in another is open in all", () => {
    const lane = geometryLane(
      made(() => <Shape geometry={track(rect(20, 20)).to(line([0, 0], [20, 20]), span(0, 1))} />),
    );

    expect(
      lane.keys.every((key) => key.value.kind === "path" && !key.value.contours[0]!.closed),
    ).toBe(true);
  });

  test("a nonzero and an evenodd path can't blend", () => {
    const evenodd: Model.Geometry = {
      kind: "path",
      rule: "evenodd",
      contours: [
        {
          start: [0, 0],
          curves: [
            [
              [0, 0],
              [1, 0],
              [1, 0],
            ],
          ],
          closed: false,
        },
      ],
    };

    expect(() =>
      made(() => <Shape geometry={track(svgPath("M0 0L2 0L2 2Z")).to(evenodd, span(0, 1))} />),
    ).toThrow("morphs between a nonzero and an evenodd path");
  });

  test("a cut inside a transition stops at the geometry between, by parameter", () => {
    const lane = geometryLane(
      made(() => (
        <Shape
          geometry={track(arc({ radius: 10, sweep: 0 }))
            .to(arc({ radius: 10, sweep: 200 }), span(0, 2), ease.linear)
            .repeat({ until: 3 })}
        />
      )),
    );

    expect(lane.keys.map((key) => key.value)).toContainEqual({
      kind: "arc",
      radius: 10,
      start: 0,
      sweep: 100,
    });
  });

  test("a looped morph inside a sequence is rotated with a real geometry at the seam", () => {
    const lane = geometryLane(
      made(() => (
        <Sequence at={0.5}>
          <Shape
            geometry={track(rect(10, 10))
              .to(rect(30, 10), span(0, 1), ease.linear)
              .to(rect(10, 10), span(1, 1), ease.linear)
              .loop(2)}
          />
        </Sequence>
      )),
    );

    expect(lane.keys[0]!.value).toEqual({ kind: "rect", size: [20, 10], radius: [0, 0, 0, 0] });
  });

  test("SVG draws a moving geometry as one path whose d animates through SMIL, with the same commands in every key", () => {
    const out = body(() => (
      <Shape
        geometry={track(rect(10, 10)).to(circle(20), span(0, 1))}
        at={[50, 50]}
        fill="#FF0000"
      />
    ));

    const values = morphs(out);

    expect(out).toContain('<path d="M');
    expect(values.length).toBeGreaterThan(1);
    expect(new Set(values.map(commands)).size).toBe(1);
  });

  test("a radius moves through d too", () => {
    const values = morphs(
      body(() => <Shape geometry={track(circle(4)).to(circle(20), span(0, 1))} fill="#FF0000" />),
    );

    expect(values[0]).toStartWith("M4 0C");
    expect(values.at(-1)).toStartWith("M20 0C");
  });

  test("an opening arc stays on its circle between keys, not on a blend between two paths", () => {
    const values = morphs(
      body(() => (
        <Shape
          geometry={track(arc({ radius: 40, sweep: 10 })).to(
            arc({ radius: 40, sweep: 350 }),
            span(0, 2),
          )}
          stroke={{ color: "#FF0000", width: 2 }}
        />
      )),
    );

    expect(values.length).toBeGreaterThan(10);
    expect(new Set(values.map(commands)).size).toBe(1);

    for (const d of values) {
      const numbers = d.match(/[-\d.]+/g)!.map(Number);
      const [x, y] = numbers.slice(-2);

      expect(Math.hypot(x!, y!)).toBeCloseTo(40, 1);
    }
  });

  test("an ease in steps is written as cuts, since SMIL can't blend path data in steps", () => {
    const out = body(() => (
      <Shape
        geometry={track(rect(10, 10)).to(rect(40, 10), span(0, 1), ease.steps(3))}
        fill="#FF0000"
      />
    ));

    expect(morphs(out)).toHaveLength(4);
    expect(out).toContain('calcMode="discrete"');
  });
});

describe("strokes, scales and trims", () => {
  test("an animated stroke width is a CSS lane", () => {
    const style = css(() => (
      <Shape
        geometry={circle(10)}
        stroke={{ color: "#FF0000", width: track(2).to(8, span(0, 1)) }}
      />
    ));

    expect(style).toContain("stroke-width:2");
    expect(style).toContain("stroke-width:8");
  });

  test("a scale that differs across and down writes both into one CSS scale", () => {
    const style = css(() => (
      <Shape
        geometry={rect(10, 10)}
        scale={track<Vec>([1, 1]).to([2, 0.5], span(0, 1))}
        fill="#FF0000"
      />
    ));

    expect(style).toContain("scale:1 1");
    expect(style).toContain("scale:2 0.5");
  });

  test("a trim whose start moves writes the dash, and hides at no length", () => {
    const style = css(() => (
      <Shape
        geometry={circle(10)}
        stroke={{ color: "#FF0000", width: 3, cap: "round" }}
        trim={track<Vec>([0, 0]).to([0.2, 0.7], span(0, 1)).to([1, 1], span(2, 1))}
      />
    ));

    expect(style).toContain("stroke-dasharray:0 2;stroke-dashoffset:0;visibility:hidden");
    expect(style).toContain("stroke-dasharray:0.5 2;stroke-dashoffset:-0.2;visibility:visible");
    expect(style).toContain("stroke-dasharray:0 2;stroke-dashoffset:-1;visibility:hidden");
  });

  test("a static trim with no length draws no stroke, so a round cap leaves no dot", () => {
    expect(
      body(() => (
        <Shape
          geometry={circle(10)}
          stroke={{ color: "#FF0000", cap: "round" }}
          trim={[0.5, 0.5]}
        />
      )),
    ).toContain('<circle r="10" fill="none"/>');
  });

  test("a moving trim on a filled shape strokes an element of its own, so hiding it keeps the fill", () => {
    const out = body(() => (
      <Shape
        geometry={rect(10, 10)}
        at={[5, 5]}
        fill="#00FF00"
        stroke={{ color: "#FF0000" }}
        trim={track<Vec>([0, 0]).to([0, 1], span(0, 1))}
      />
    ));

    expect(out).toMatch(
      /<g transform="translate\(5 5\)">\s*<rect width="10" height="10" fill="#00FF00"\/>\s*<rect width="10" height="10" fill="none" stroke="#FF0000"/,
    );
  });

  test("an opacity cut over a moving trim writes opacity, so the trim's own visibility can't show through", () => {
    const style = css(() => (
      <Group opacity={show(span(1, 2), { fade: 0 })}>
        <Shape
          geometry={circle(10)}
          stroke={{ color: "#FF0000" }}
          trim={track<Vec>([0, 0]).to([0, 1], span(0, 1))}
        />
      </Group>
    ));

    expect(style).toContain("opacity:0");
    expect(style).not.toContain("visibility:hidden;}");
  });
});

describe("images and instances", () => {
  const pic = picture('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"/>');

  test("an image fills a frame of its own, keeping its ratio when given one side", () => {
    const model = made(() => <Image src={pic} at={[10, 10]} width={80} />);
    const node = only(model);

    expect(node).toMatchObject({
      kind: "image",
      size: [80, 40],
      box: { x: 0, y: 0, width: 80, height: 40 },
    });
    expect(svg.emit(model)).toContain(
      '<image x="10" y="10" width="80" height="40" preserveAspectRatio="none" href="data:image/svg+xml,',
    );
  });

  test("a symbol is lowered once, drawn once in defs, and used by every instance", () => {
    const dot = symbol("dot", () => <Shape geometry={circle(4)} fill="#FF0000" />);

    const model = made(() => (
      <Group>
        <Instance of={dot} at={[10, 10]} />
        <Instance of={dot} at={[30, 10]} scale={2} />
      </Group>
    ));

    expect(Object.keys(model.symbols)).toEqual(["dot"]);
    expect(model.root.children.map((node) => node.kind)).toEqual(["instance", "instance"]);
    expect(model.root.children[0]!.box).toEqual({ x: -4, y: -4, width: 8, height: 8 });

    const out = svg.emit(model);

    expect(out.match(/<circle/g)).toHaveLength(1);
    expect(out).toContain('<defs>\n    <g id="symbol-dot">');
    expect(out).toContain('<use href="#symbol-dot" transform="translate(10 10)"/>');
    expect(diagnose(model, svg)).toEqual([]);
  });

  test("a prefix keeps two scenes' symbols apart", () => {
    const dot = symbol("dot", () => <Shape geometry={circle(4)} fill="#FF0000" />);

    expect(
      svg.emit(
        made(() => <Instance of={dot} />),
        { prefix: "x-" },
      ),
    ).toContain('href="#x-symbol-dot"');
  });

  test("a symbol that moves can't be placed inside a sequence that starts later", () => {
    const spinner = symbol("spinner", () => (
      <Shape geometry={rect(4, 4)} rotate={track(0).to(90, span(0, 1))} fill="#FF0000" />
    ));

    expect(() =>
      made(() => (
        <Sequence at={1}>
          <Instance of={spinner} />
        </Sequence>
      )),
    ).toThrow("a symbol's tracks run on the scene's clock");
  });

  test("two symbols with one name throw", () => {
    const a = symbol("dot", () => <Shape geometry={circle(4)} />);
    const b = symbol("dot", () => <Shape geometry={circle(5)} />);

    expect(() =>
      made(() => (
        <Group>
          <Instance of={a} />
          <Instance of={b} />
        </Group>
      )),
    ).toThrow('Two different symbols are both named "dot"');
  });
});

describe("shake and sampled", () => {
  test("shake swings, shrinks and settles at rest", () => {
    const node = only(
      made(() => <Shape geometry={circle(4)} motion={shake(span(0, 1), { offset: [10, 0] })} />),
    );

    const offset = node.layers[0]!.offset;

    expect(isLane(offset)).toBe(true);

    if (!isLane(offset)) return;

    expect(offset.keys[1]!.value[0]).toBeCloseTo(-10 * (1 - 1 / 12));
    expect(offset.keys.at(-1)!.value).toEqual([0, 0]);
  });

  test("sampled keeps two keys for a straight line and cuts at a jump", () => {
    const linear = only(
      made(() => (
        <Shape
          geometry={circle(4)}
          rotate={sampled(span(0, 2), (t) => t * 90, { tolerance: 0.1 })}
        />
      )),
    );

    const stepped = only(
      made(() => (
        <Shape
          geometry={circle(4)}
          rotate={sampled(span(0, 2), (t) => (t < 1 ? 0 : 90), { tolerance: 0.1 })}
        />
      )),
    );

    const rotate = linear.layers[0]!.rotate;
    const jumped = stepped.layers[0]!.rotate;

    expect(isLane(rotate) && rotate.keys.map((key) => [key.t, key.value])).toEqual([
      [0, 0],
      [2, 180],
      [4, 180],
    ]);
    expect(isLane(jumped) && jumped.keys.some((key) => key.ease?.kind === "steps")).toBe(true);
  });

  test("sampled geometry keeps its kind", () => {
    const lane = geometryLane(
      made(() => (
        <Shape
          geometry={sampled(span(0, 1), (t) => arc({ radius: 10, sweep: 30 + 300 * t * t }), {
            tolerance: 0.2,
          })}
          stroke={{ color: "#FF0000" }}
        />
      )),
    );

    expect(lane.keys.every((key) => key.value.kind === "arc")).toBe(true);
    expect(lane.keys.length).toBeGreaterThan(3);
  });

  test("sampled.motion simplifies each value with its own tolerance", () => {
    const node = only(
      made(() => (
        <Shape
          geometry={circle(4)}
          motion={sampled.motion(span(0, 1), (t) => ({ offset: [t * 10, 0], opacity: 1 - t / 2 }), {
            tolerance: { offset: 0.1, opacity: 0.01 },
          })}
        />
      )),
    );

    const [layer] = node.layers;

    expect(isLane(layer!.offset) && layer!.offset.keys[1]!.value).toEqual([10, 0]);
    expect(isLane(layer!.opacity) && layer!.opacity.keys[1]!.value).toBe(0.5);
  });

  test("sampled throws on a geometry that changes its structure", () => {
    expect(() =>
      sampled(span(0, 1), (t) => (t < 0.5 ? rect(1, 1) : circle(1)), { tolerance: 0.1 }),
    ).toThrow("doesn't match the first sample");
  });
});
