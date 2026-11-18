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
  ease,
  ellipse,
  line,
  pathData,
  picture,
  polygon,
  rect,
  sampled,
  scene,
  shake,
  span,
  symbol,
  track,
  type SceneElement,
  type Vec,
} from "svjeez/scene";
import { diagnose, isLane, svg, type Model } from "svjeez/scene/tools";

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

const commands = (d: string): string => d.replace(/[^A-Za-z]/g, "");

/** Where relative path data ends: its `M` and every step after it, added up. */
const ends = (d: string): [number, number] => {
  const at: [number, number] = [0, 0];

  for (const [, command, list] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const numbers = (list!.match(/-?[\d.]+/g) ?? []).map(Number);

    if (command === "M") [at[0], at[1]] = [numbers[0]!, numbers[1]!];
    else if (command === "c" || command === "l")
      [at[0], at[1]] = [at[0] + numbers.at(-2)!, at[1] + numbers.at(-1)!];
  }

  return at;
};

describe("animated geometry", () => {
  test("keys of one parametric kind stay that kind, and the box and origin are the first key's", () => {
    const model = made(() => (
      <Shape
        fill="#000000"
        geometry={track(rect(10, 10)).to(rect(40, 20, { radius: 4 }), span(0, 1))}
      />
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
          fill="#000000"
          geometry={track(rect(20, 20))
            .to(ellipse(10, 6), span(0, 1))
            .to(pathData("M0 0L10 0L5 8Z M20 0L30 0L25 8Z"), span(1, 1))}
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
          fill="#000000"
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
          fill="#000000"
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
      made(() => (
        <Shape
          fill="#000000"
          geometry={track(rect(20, 20)).to(line([0, 0], [20, 20]), span(0, 1))}
        />
      )),
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
      made(() => (
        <Shape fill="#000000" geometry={track(pathData("M0 0L2 0L2 2Z")).to(evenodd, span(0, 1))} />
      )),
    ).toThrow("morphs between a nonzero and an evenodd path");
  });

  test("a cut inside a transition stops at the geometry between, by parameter", () => {
    const lane = geometryLane(
      made(() => (
        <Shape
          fill="#000000"
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
        <Sequence start={0.5}>
          <Shape
            fill="#000000"
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

  test("an unstroked radius is a CSS scale of the widest circle, around its center", () => {
    const out = svg.emit(
      made(() => <Shape geometry={track(circle(4)).to(circle(20), span(0, 1))} fill="#FF0000" />),
    );

    expect(out).toContain('<circle r="20" fill="#FF0000" class="a m1 fb"/>');
    expect(out).toContain("scale:0.2");
    expect(out).not.toContain("<animate");
  });

  test("a stroked radius animates r, since a scale would scale the stroke too", () => {
    const out = body(() => (
      <Shape geometry={track(circle(4)).to(circle(20), span(0, 1))} stroke={{ color: "#FF0000" }} />
    ));

    expect(out).toContain('attributeName="r" values="4;20"');
    expect(out).not.toContain('attributeName="d"');
  });

  test("a stroked rect animates its own width, height and radius, and only those that change", () => {
    const out = body(() => (
      <Shape
        geometry={track(rect(10, 10, { radius: 2 })).to(rect(40, 10, { radius: 4 }), span(0, 1))}
        stroke={{ color: "#FF0000" }}
      />
    ));

    expect(out).toContain('<rect width="40" height="10" rx="4"');
    expect(out).toContain('attributeName="width"');
    expect(out).toContain('attributeName="rx"');
    expect(out).not.toContain('attributeName="height"');
    expect(out).not.toContain('attributeName="d"');
  });

  test("a line with one moving end animates that end, and one with more moves d", () => {
    const one = body(() => (
      <Shape
        geometry={track(line([0, 0], [10, 0])).to(line([0, 0], [30, 0]), span(0, 1))}
        stroke={{ color: "#FF0000" }}
      />
    ));

    const both = morphs(
      body(() => (
        <Shape
          geometry={track(line([0, 0], [10, 0])).to(line([5, 5], [30, 20]), span(0, 1))}
          stroke={{ color: "#FF0000" }}
        />
      )),
    );

    expect(one).toContain('attributeName="x2" values="10;30"');
    expect(both.map(commands)).toEqual(["Ml", "Ml"]);
  });

  test("a geometry that only moves is drawn still, with a CSS translate", () => {
    const style = svg.emit(
      made(() => (
        <Shape
          geometry={track(
            polygon([
              [0, 0],
              [10, 0],
              [5, 8],
            ]),
          ).to(
            polygon([
              [20, 10],
              [30, 10],
              [25, 18],
            ]),
            span(0, 1),
          )}
          stroke={{ color: "#FF0000" }}
        />
      )),
    );

    expect(style).toContain('<polygon points="0 0 10 0 5 8"');
    expect(style).toContain("translate:20px 10px");
    expect(style).not.toContain("<animate");
  });

  test("an arc on one circle is its widest arc, opened and turned by a CSS dash", () => {
    const style = css(() => (
      <Shape
        geometry={track(arc({ radius: 40, start: 0, sweep: 90 })).to(
          arc({ radius: 40, start: 90, sweep: 180 }),
          span(0, 1),
        )}
        stroke={{ color: "#FF0000", width: 2 }}
      />
    ));

    const out = body(() => (
      <Shape
        geometry={track(arc({ radius: 40, start: 0, sweep: 90 })).to(
          arc({ radius: 40, start: 90, sweep: 180 }),
          span(0, 1),
        )}
        stroke={{ color: "#FF0000", width: 2 }}
      />
    ));

    expect(out).toContain('<path d="M40 0A40 40 0 1 1 0 -40"');
    expect(out).not.toContain("<animate");
    expect(style).toContain("stroke-dasharray:0.333 2;stroke-dashoffset:0");
    expect(style).toContain("stroke-dasharray:0.667 2;stroke-dashoffset:-0.333");
    expect(style).not.toContain("visibility");
  });

  test("a dashed arc with round caps keeps its dot at no length, as a still arc of no sweep draws one", () => {
    const style = css(() => (
      <Shape
        geometry={track(arc({ radius: 40, sweep: 0 })).to(
          arc({ radius: 40, sweep: 300 }),
          span(0, 1),
        )}
        stroke={{ color: "#FF0000", width: 2, cap: "round" }}
      />
    ));

    expect(style).toContain("stroke-dasharray:0 2;stroke-dashoffset:0");
    expect(style).not.toContain("visibility");
  });

  test("a sweep that changes direction can't be one dash, so it moves d", () => {
    const values = morphs(
      body(() => (
        <Shape
          geometry={track(arc({ radius: 40, sweep: -90 })).to(
            arc({ radius: 40, sweep: 90 }),
            span(0, 1),
          )}
          stroke={{ color: "#FF0000" }}
        />
      )),
    );

    expect(values.length).toBeGreaterThan(2);
  });

  test("an arc whose path moves stays on its circle between keys, not on a blend between two paths", () => {
    const values = morphs(
      body(() => (
        <Shape
          geometry={track(arc({ radius: 40, sweep: 10 })).to(
            arc({ radius: 40, sweep: 350 }),
            span(0, 2),
          )}
          stroke={{ color: "#FF0000", width: 2, dash: [4, 4] }}
        />
      )),
    );

    expect(values.length).toBeGreaterThan(10);
    expect(new Set(values.map(commands)).size).toBe(1);

    for (const d of values) {
      const [x, y] = ends(d);

      expect(Math.hypot(x, y)).toBeCloseTo(40, 1);
    }
  });

  test("an ease in steps is written as cuts, since SMIL can't blend path data in steps", () => {
    const out = body(() => (
      <Shape
        geometry={track(rect(10, 10)).to(circle(10), span(0, 1), ease.steps(3))}
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

  test("a moving trim with a butt cap needs no visibility, so a filled shape stays one element", () => {
    const style = css(() => (
      <Shape
        geometry={rect(10, 10)}
        fill="#00FF00"
        stroke={{ color: "#FF0000" }}
        trim={track<Vec>([0, 0]).to([0, 1], span(0, 1))}
      />
    ));

    expect(style).toContain("stroke-dashoffset:1}");
    expect(style).not.toContain("visibility");
  });

  test("a moving trim on a filled shape strokes an element of its own when its caps must hide, so hiding them keeps the fill", () => {
    const out = body(() => (
      <Shape
        geometry={rect(10, 10)}
        at={[5, 5]}
        fill="#00FF00"
        stroke={{ color: "#FF0000", cap: "round" }}
        trim={track<Vec>([0, 0]).to([0, 1], span(0, 1))}
      />
    ));

    expect(out).toMatch(
      /<g transform="translate\(5 5\)">\s*<rect width="10" height="10" fill="#00FF00"\/>\s*<rect width="10" height="10" fill="none" stroke="#FF0000" stroke-linecap="round"/,
    );
  });

  test("an opacity cut over a moving trim writes opacity, so the trim's own visibility can't show through", () => {
    const style = css(() => (
      <Group opacity={track(0).set(1, 1).set(0, 3)}>
        <Shape
          geometry={circle(10)}
          stroke={{ color: "#FF0000", cap: "round" }}
          trim={track<Vec>([0, 0]).to([0, 1], span(0, 1))}
        />
      </Group>
    ));

    expect(style).toContain("opacity:0");
    expect(style).not.toContain("visibility:hidden;}");
  });
});

describe("a dash under a trim", () => {
  test("a still trim keeps the dashes inside it, each cut at its ends, as one dash array", () => {
    const out = body(() => (
      <Shape
        geometry={line([0, 0], [100, 0])}
        stroke={{ color: "#000000", width: 2, dash: [10, 5] }}
        trim={[0.12, 0.5]}
      />
    ));

    expect(out).toContain('stroke-dasharray="10 5 10 5 5 101" stroke-dashoffset="-15"');
    expect(out).not.toContain("pathLength");
  });

  test("a dash of no length is a dot where it lies, and a trim that keeps no dash draws no stroke", () => {
    expect(
      body(() => (
        <Shape
          geometry={line([0, 0], [100, 0])}
          stroke={{ color: "#000000", cap: "round", dash: [0, 10] }}
          trim={[0.15, 0.4]}
        />
      )),
    ).toContain('stroke-dasharray="0 10 0 10 0 101" stroke-dashoffset="-20"');
    expect(
      body(() => (
        <Shape
          geometry={line([0, 0], [100, 0])}
          fill="#00FF00"
          stroke={{ color: "#000000", dash: [10, 20] }}
          trim={[0.11, 0.29]}
        />
      )),
    ).not.toContain("stroke=");
  });

  test("a moving trim masks the dashed stroke with the trimmed one, and leaves the fill whole", () => {
    const model = made(() => (
      <Shape
        key="ring"
        geometry={circle(10)}
        at={[50, 50]}
        fill="#00FF00"
        stroke={{ color: "#000000", width: 2, dash: [4, 2], cap: "round" }}
        trim={track<Vec>([0, 0]).to([0, 1], span(0, 2))}
      />
    ));

    const out = svg.emit(model);

    expect(out).toMatch(
      /<mask id="m\d*"[^>]*>\s*<circle r="10" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/,
    );
    expect(out).toMatch(/<circle r="10" fill="#00FF00"\/>/);
    expect(out).toMatch(
      /<circle r="10" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 2" mask="url\(#m\d*\)"/,
    );
    expect(diagnose(model, svg)).toEqual([
      expect.objectContaining({ feature: "movingDashedTrim", key: "ring", severity: "warning" }),
    ]);
  });

  test("with butt caps a moving trim over a dash is exact", () => {
    const model = made(() => (
      <Shape
        geometry={circle(10)}
        stroke={{ color: "#000000", dash: [4, 2] }}
        trim={track<Vec>([0, 0]).to([0, 1], span(0, 2))}
      />
    ));

    expect(diagnose(model, svg)).toEqual([]);
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
    const dot = symbol(() => <Shape geometry={circle(4)} fill="#FF0000" />);

    const model = made(() => (
      <Group>
        <Instance key="dot" of={dot} at={[10, 10]} />
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
    const dot = symbol(() => <Shape geometry={circle(4)} fill="#FF0000" />);

    expect(
      svg.emit(
        made(() => <Instance key="dot" of={dot} />),
        { prefix: "x-" },
      ),
    ).toContain('href="#x-symbol-dot"');
  });

  test("a symbol that moves can't be placed inside a sequence that starts later", () => {
    const spinner = symbol(() => (
      <Shape geometry={rect(4, 4)} rotate={track(0).to(90, span(0, 1))} fill="#FF0000" />
    ));

    expect(() =>
      made(() => (
        <Sequence start={1}>
          <Instance of={spinner} />
        </Sequence>
      )),
    ).toThrow("a symbol's tracks run on the scene's clock");
  });

  test("a symbol is named for its first instance's key, and two that would share a name don't", () => {
    const a = symbol(() => <Shape fill="#000000" geometry={circle(4)} />);
    const b = symbol(() => <Shape fill="#000000" geometry={circle(5)} />);

    const model = made(() => (
      <Group>
        <Group key="left">
          <Instance key="dot" of={a} />
        </Group>
        <Group key="right">
          <Instance key="dot" of={b} />
          <Instance key="again" of={a} />
        </Group>
      </Group>
    ));

    expect(Object.keys(model.symbols)).toEqual(["dot", "dot-2"]);
    expect(svg.emit(model).match(/<use href="#symbol-dot"/g)).toHaveLength(2);
  });
});

describe("shake and sampled", () => {
  test("shake swings, shrinks and settles at rest", () => {
    const node = only(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(4)}
          motion={shake({ offset: [10, 0] }, span(0, 1))}
        />
      )),
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
          fill="#000000"
          geometry={circle(4)}
          rotate={sampled((t) => t * 90, span(0, 2), { tolerance: 0.1 })}
        />
      )),
    );

    const stepped = only(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(4)}
          rotate={sampled((t) => (t < 1 ? 0 : 90), span(0, 2), { tolerance: 0.1 })}
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
          geometry={sampled((t) => arc({ radius: 10, sweep: 30 + 300 * t * t }), span(0, 1), {
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
          fill="#000000"
          geometry={circle(4)}
          motion={sampled.motion((t) => ({ offset: [t * 10, 0], opacity: 1 - t / 2 }), span(0, 1), {
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
      sampled((t) => (t < 0.5 ? rect(1, 1) : circle(1)), span(0, 1), { tolerance: 0.1 }),
    ).toThrow("doesn't match the first sample");
  });
});
