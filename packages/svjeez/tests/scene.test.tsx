import { describe, expect, test } from "bun:test";
import {
  Group,
  Sequence,
  Shape,
  arc,
  circle,
  ease,
  enter,
  motion,
  path,
  rect,
  scene,
  span,
  spin,
  tokens,
  track,
  type SceneElement,
} from "svjeez";
import { diagnose, isLane, isScene, svg, type Model } from "svjeez/tools";
import { FEATURES } from "../src/model/backend";

const theme = tokens({ light: { ink: "#111111" }, dark: { ink: "#EEEEEE" } });

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test" }, build);

const only = (model: Model.Scene): Model.SceneNode => model.root.children[0]!;

describe("lowering", () => {
  test("a node is keyed by its place, its key or its ref, under its parent", () => {
    const model = made(() => (
      <Group>
        <Shape fill="#000000" geometry={circle(4)} anchor="center" />
        <Group key="card">
          <Shape fill="#000000" key="title" geometry={rect(10, 4)} />
          <Shape fill="#000000" geometry={rect(10, 4)} />
        </Group>
      </Group>
    ));

    const [dot, card] = model.root.children;

    expect(dot!.key).toBe("0");
    expect(card?.kind === "group" && card.children.map((child) => child.key)).toEqual([
      "card/title",
      "card/1",
    ]);
  });

  test("two siblings with one key throw", () => {
    expect(() =>
      made(() => (
        <Group>
          <Shape fill="#000000" key="a" geometry={circle(4)} anchor="center" />
          <Shape fill="#000000" key="a" geometry={circle(4)} anchor="center" />
        </Group>
      )),
    ).toThrow('Two nodes are both keyed "a"');
  });

  test("boxes are measured in the node's own frame, and a group covers its children where they rest", () => {
    const model = made(() => (
      <Group at={[50, 50]}>
        <Shape fill="#000000" geometry={rect(20, 10)} at={[5, 5]} />
        <Shape
          fill="#000000"
          geometry={circle(4)}
          anchor="center"
          at={track([40, 0]).to([90, 0], span(0, 1))}
        />
        <Shape
          fill="#000000"
          geometry={path().moveTo([0, 0]).curveTo([0, 40], [30, 40], [30, 0])}
        />
      </Group>
    ));

    const group = only(model);

    expect(group.box).toEqual({ x: 0, y: -4, width: 44, height: 34 });
    expect(group.kind === "group" && group.children[2]!.box).toEqual({
      x: 0,
      y: 0,
      width: 30,
      height: 30,
    });
    expect(group.origin).toEqual([22, 13]);
  });

  test("an arc's box is its whole circle's, so it turns around the center", () => {
    const ring = only(
      made(() => (
        <Shape fill="#000000" geometry={arc({ radius: 10, sweep: 90 })} anchor="center" />
      )),
    );

    expect(ring.origin).toEqual([0, 0]);
  });

  test("a track inside a sequence lands on the scene's clock", () => {
    const node = only(
      made(() => (
        <Sequence start={1}>
          <Shape
            fill="#000000"
            geometry={circle(4)}
            anchor="center"
            opacity={track(0).to(1, span(0.5, 1), ease.linear)}
          />
        </Sequence>
      )),
    );

    const [layer] = node.layers;
    const opacity = layer!.opacity;

    expect(isLane(opacity) && opacity.keys.map((key) => [key.t, key.value])).toEqual([
      [0, 0],
      [1.5, 0],
      [2.5, 1],
      [4, 1],
    ]);
    expect(isLane(opacity) && opacity.keys[2]!.ease).toEqual(ease.linear);
  });

  test("a track that never changes is a plain value, and a layer that changes nothing is left out", () => {
    const node = only(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(4)}
          anchor="center"
          opacity={track(1)}
          motion={motion({ rotate: 0 })}
        />
      )),
    );

    expect(node.layers).toEqual([]);
  });

  test("a loop's period is snapped to divide the scene", () => {
    const node = only(
      made(
        () => (
          <Shape
            fill="#000000"
            geometry={circle(4)}
            anchor="center"
            rotate={spin({ every: 1.5 })}
          />
        ),
        4,
      ),
    );

    const rotate = node.layers[0]!.rotate;

    expect(isLane(rotate) && rotate.period).toBeCloseTo(4 / 3);
  });

  test("a track that outruns its sequence names it", () => {
    expect(() =>
      made(() => (
        <Sequence start={1} over={1}>
          <Shape
            fill="#000000"
            geometry={circle(4)}
            anchor="center"
            opacity={track(0).to(1, span(0.5, 1))}
          />
        </Sequence>
      )),
    ).toThrow("past the 1s <Sequence start={1} over={1}>");
  });

  test("tokens the scene uses are declared with both values", () => {
    const model = made(() => <Shape geometry={circle(4)} anchor="center" fill={theme.ink} />);

    expect(model.tokens.ink).toEqual({
      light: [17 / 255, 17 / 255, 17 / 255, 1],
      dark: [238 / 255, 238 / 255, 238 / 255, 1],
    });
    expect(only(model).kind === "shape" && only(model)).toMatchObject({
      fill: { kind: "token", name: "ink" },
    });
  });
});

describe("the SVG backend", () => {
  const body = (build: () => SceneElement): string =>
    svg.emit(made(build)).split("</style>").at(-1)!;

  test("nothing is inherited: a shape with no fill says so", () => {
    expect(
      body(() => <Shape geometry={circle(4)} anchor="center" stroke={{ color: "#FF0000" }} />),
    ).toContain('<circle r="4" fill="none" stroke="#FF0000"/>');
  });

  test("a token is a CSS variable with a light and a dark value", () => {
    const out = svg.emit(
      made(() => <Shape geometry={circle(4)} anchor="center" fill={theme.ink} />),
    );

    expect(out).toContain("svg{--ink:#EEEEEE}");
    expect(out).toContain("@media (prefers-color-scheme:light){svg{--ink:#111111}}");
    expect(out).toContain('fill="var(--ink)"');
  });

  test("a shape placed by its own coordinates turns around its fill box", () => {
    expect(
      body(() => (
        <Shape fill="#000000" geometry={rect(20, 10)} at={[5, 5]} rotate={spin({ every: 2 })} />
      )),
    ).toMatch(/<rect x="5" y="5" width="20" height="10" fill="#000000" class="a m1 fb"\/>/);
  });

  test("anything else turns around its origin, written out", () => {
    expect(
      body(() => (
        <Group at={[50, 50]} rotate={spin({ every: 2 })}>
          <Shape fill="#000000" geometry={rect(20, 10)} />
          <Shape fill="#000000" geometry={rect(4, 4)} at={[16, 6]} />
        </Group>
      )),
    ).toContain('<g transform="translate(50 50)" style="transform-origin:60px 55px" class="a m1">');
  });

  test("a group that only places one node is written as that node, placed by both", () => {
    const out = body(() => (
      <Group at={[50, 50]} rotate={spin({ every: 2 })}>
        <Shape geometry={path().moveTo([0, 0]).lineTo([20, 10])} stroke={{ color: "#FF0000" }} />
      </Group>
    ));

    expect(out).not.toContain("<g");
    expect(out).toContain(
      '<path d="M0 0L20 10" transform="translate(50 50)" fill="none" stroke="#FF0000" style="transform-origin:60px 55px" class="a m1"/>',
    );
  });

  test("layers share an element while that keeps their order, and nest when it would not", () => {
    const shared = body(() => (
      <Shape
        fill="#000000"
        geometry={circle(4)}
        anchor="center"
        rotate={spin({ every: 2 })}
        motion={motion({ offset: [0, 0] }).to({ offset: [10, 0] }, span(0, 1))}
      />
    ));

    const nested = body(() => (
      <Shape
        fill="#000000"
        geometry={circle(4)}
        anchor="center"
        motion={[
          motion({ rotate: 0 }).to({ rotate: 90 }, span(0, 1)),
          motion({ offset: [0, 0] }).to({ offset: [10, 0] }, span(0, 1)),
        ]}
      />
    ));

    expect(shared).not.toContain("<g");
    expect(nested).toMatch(/<g style="transform-origin:0px 0px" class="a m\d">\s*<circle/);
  });

  test("an entrance folds into the node's own opacity, so no wrapper draws it", () => {
    const out = svg.emit(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(4)}
          anchor="center"
          opacity={0.5}
          motion={enter(span(0, 1))}
        />
      )),
    );

    expect(out).toContain('<circle r="4" fill="#000000" class="a m1"/>');
    expect(out).toContain("opacity:0.5");
    expect(out).not.toContain("<g");
  });

  test("two layers that move at once nest, since one lane can't hold their product", () => {
    expect(
      body(() => (
        <Shape
          fill="#000000"
          geometry={circle(4)}
          anchor="center"
          opacity={track(1).to(0.5, span(0, 2))}
          motion={enter(span(0, 1))}
        />
      )),
    ).toMatch(/<g class="a m\d">\s*<circle r="4" fill="#000000" class="a m\d"\/>/);
  });

  test("a group with nothing of its own writes no element, but keeps one when asked for keys", () => {
    const build = () => (
      <Group>
        <Group key="row">
          <Shape fill="#000000" geometry={circle(4)} anchor="center" />
          <Shape fill="#000000" geometry={circle(4)} anchor="center" at={[10, 0]} />
        </Group>
      </Group>
    );

    expect(body(build)).not.toContain("<g");
    expect(svg.emit(made(build), { sources: true })).toContain('<g data-key="row">');
  });

  test("a point that goes round is a few curved keys, drawn on a motion path", () => {
    const angle = track(0).to(360, span(0, 2), ease.inOut);

    const model = made(() => (
      <Shape
        fill="#000000"
        geometry={circle(3)}
        anchor="center"
        at={angle.map((a): [number, number] => [
          100 + 40 * Math.cos((a * Math.PI) / 180),
          50 + 40 * Math.sin((a * Math.PI) / 180),
        ])}
      />
    ));

    const at = only(model).at;

    expect(isLane(at) && at.keys.some((key) => key.via)).toBe(true);
    expect(isLane(at) && at.keys.length).toBeLessThan(8);

    const out = svg.emit(model).split("</style>").at(-1)!;

    expect(out).toMatch(
      /<g style="scale:\.0625;offset-path:path\('M2240 800C[^']*'\);offset-rotate:0deg" class="a m1">\s*<circle r="3" fill="#000000" style="scale:16"\/>/,
    );
    expect(svg.emit(model)).toContain("offset-distance:100%");
  });

  test("a curved lane whose ease leaves 0 to 1 is refused, not drawn off its path", () => {
    const model = made(() => (
      <Shape fill="#000000" key="dot" geometry={circle(3)} anchor="center" />
    ));

    const dot = only(model);

    const bent: Model.Scene = {
      ...model,
      root: {
        ...model.root,
        children: [
          {
            ...dot,
            at: {
              kind: "lane",
              keys: [
                { t: 0, value: [0, 0] },
                {
                  t: 1,
                  value: [10, 0],
                  ease: ease.bezier(0.3, 1.5, 0.6, 1),
                  via: [
                    [3, 5],
                    [7, 5],
                  ],
                },
              ],
            },
          },
        ],
      },
    };

    expect(() => svg.emit(bent)).toThrow("an ease that leaves 0 to 1");
  });

  test("a feature the backend can't draw is named with its node, before anything is written", () => {
    const model = made(() => (
      <Shape fill="#000000" key="dot" geometry={circle(4)} anchor="center" />
    ));

    const dot = only(model);

    const blurred: Model.Scene = {
      ...model,
      root: { ...model.root, children: [{ ...dot, effects: [{ kind: "blur", radius: 2 }] }] },
    };

    const flat = {
      name: "Flat",
      supports: { ...svg.supports, blur: { level: "none", note: "no filters." } },
    } as const;

    expect(
      diagnose(blurred, flat).map((entry) => [entry.severity, entry.feature, entry.key]),
    ).toEqual([["error", "blur", "dot"]]);
    expect(diagnose(blurred, flat)[0]!.message).toBe(
      '<Shape> "dot" uses a blur, which Flat can\'t draw: no filters.',
    );

    const warned: string[] = [];

    svg.emit(blurred, { onWarning: (warning) => warned.push(`${warning.feature} ${warning.key}`) });
    expect(warned).toEqual([]);

    const faint: Model.Scene = {
      ...model,
      root: { ...model.root, children: [{ ...dot, effects: [{ kind: "blur", radius: 1 }] }] },
    };

    svg.emit(faint, { onWarning: (warning) => warned.push(`${warning.feature} ${warning.key}`) });
    expect(warned).toEqual(["softBlur dot"]);
  });

  test("every feature has words an author knows, not its id", () => {
    for (const [feature, words] of Object.entries(FEATURES)) {
      expect(svg.supports).toHaveProperty(feature);

      expect(words).toBeDefined();
      expect(words).not.toMatch(/[A-Z]/);
    }
  });
});

describe("isScene", () => {
  test("knows a scene model by its shape, and nothing else", () => {
    const model = made(() => <Shape geometry={circle(4)} anchor="center" fill="#FF0000" />);

    expect(isScene(model)).toBe(true);
    expect(isScene(structuredClone({ ...model, fonts: {} }))).toBe(true);
    expect(isScene(svg.emit(model))).toBe(false);
    expect(isScene(() => model)).toBe(false);
    expect(isScene({ ...model, root: null })).toBe(false);
    expect(isScene(null)).toBe(false);
  });
});
