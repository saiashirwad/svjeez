/** @jsxImportSource svjeez/scene */
import { describe, expect, test } from "bun:test";
import {
  Group,
  Sequence,
  Shape,
  arc,
  circle,
  diagnose,
  ease,
  enter,
  isLane,
  isScene,
  motion,
  path,
  rect,
  scene,
  span,
  spin,
  svg,
  tokens,
  track,
  type Model,
  type SceneElement,
} from "svjeez/scene";

const theme = tokens({ light: { ink: "#111111" }, dark: { ink: "#EEEEEE" } });

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test" }, build);

const only = (model: Model.Scene): Model.SceneNode => model.root.children[0]!;

describe("lowering", () => {
  test("a node is keyed by its place, its key or its ref, under its parent", () => {
    const model = made(() => (
      <Group>
        <Shape geometry={circle(4)} />
        <Group key="card">
          <Shape key="title" geometry={rect(10, 4)} />
          <Shape geometry={rect(10, 4)} />
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
          <Shape key="a" geometry={circle(4)} />
          <Shape key="a" geometry={circle(4)} />
        </Group>
      )),
    ).toThrow('Two nodes are both keyed "a"');
  });

  test("boxes are measured in the node's own frame, and a group covers its children where they rest", () => {
    const model = made(() => (
      <Group at={[50, 50]}>
        <Shape geometry={rect(20, 10)} at={[5, 5]} />
        <Shape geometry={circle(4)} at={track([40, 0]).to([90, 0], span(0, 1))} />
        <Shape geometry={path().moveTo([0, 0]).curveTo([0, 40], [30, 40], [30, 0])} />
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
    const ring = only(made(() => <Shape geometry={arc({ radius: 10, sweep: 90 })} />));

    expect(ring.origin).toEqual([0, 0]);
  });

  test("a track inside a sequence lands on the scene's clock", () => {
    const node = only(
      made(() => (
        <Sequence at={1}>
          <Shape geometry={circle(4)} opacity={track(0).to(1, span(0.5, 1), ease.linear)} />
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
      made(() => <Shape geometry={circle(4)} opacity={track(1)} motion={motion({ rotate: 0 })} />),
    );

    expect(node.layers).toEqual([]);
  });

  test("a loop's period is snapped to divide the scene", () => {
    const node = only(made(() => <Shape geometry={circle(4)} rotate={spin({ every: 1.5 })} />, 4));
    const rotate = node.layers[0]!.rotate;

    expect(isLane(rotate) && rotate.period).toBeCloseTo(4 / 3);
  });

  test("a track that outruns its sequence names it", () => {
    expect(() =>
      made(() => (
        <Sequence at={1} over={1}>
          <Shape geometry={circle(4)} opacity={track(0).to(1, span(0.5, 1))} />
        </Sequence>
      )),
    ).toThrow("past the 1s <Sequence at={1} over={1}>");
  });

  test("tokens the scene uses are declared with both values", () => {
    const model = made(() => <Shape geometry={circle(4)} fill={theme.ink} />);

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
    expect(body(() => <Shape geometry={circle(4)} stroke={{ color: "#FF0000" }} />)).toContain(
      '<circle r="4" fill="none" stroke="#FF0000"/>',
    );
  });

  test("a token is a CSS variable with a light and a dark value", () => {
    const out = svg.emit(made(() => <Shape geometry={circle(4)} fill={theme.ink} />));

    expect(out).toContain("svg{--ink:#EEEEEE}");
    expect(out).toContain("@media (prefers-color-scheme:light){svg{--ink:#111111}}");
    expect(out).toContain('fill="var(--ink)"');
  });

  test("a shape placed by its own coordinates turns around its fill box", () => {
    expect(
      body(() => <Shape geometry={rect(20, 10)} at={[5, 5]} rotate={spin({ every: 2 })} />),
    ).toMatch(/<rect x="5" y="5" width="20" height="10" fill="none" class="a m1 fb"\/>/);
  });

  test("anything else turns around its origin, written out", () => {
    expect(
      body(() => (
        <Group at={[50, 50]} rotate={spin({ every: 2 })}>
          <Shape geometry={rect(20, 10)} />
        </Group>
      )),
    ).toContain('<g transform="translate(50 50)" style="transform-origin:60px 55px" class="a m1">');
  });

  test("layers share an element while that keeps their order, and nest when it would not", () => {
    const shared = body(() => (
      <Shape
        geometry={circle(4)}
        rotate={spin({ every: 2 })}
        motion={motion({ offset: [0, 0] }).to({ offset: [10, 0] }, span(0, 1))}
      />
    ));

    const nested = body(() => (
      <Shape
        geometry={circle(4)}
        motion={[
          motion({ rotate: 0 }).to({ rotate: 90 }, span(0, 1)),
          motion({ offset: [0, 0] }).to({ offset: [10, 0] }, span(0, 1)),
        ]}
      />
    ));

    expect(shared).not.toContain("<g");
    expect(nested).toMatch(/<g style="transform-origin:0px 0px" class="a m\d">\s*<circle/);
  });

  test("an entrance and the node's own opacity nest, since both are opacity", () => {
    expect(
      body(() => <Shape geometry={circle(4)} opacity={0.5} motion={enter(span(0, 1))} />),
    ).toMatch(/<g class="a m1">\s*<circle r="4" fill="none" opacity="0.5"\/>/);
  });

  test("a feature the backend can't draw is named with its node, before anything is written", () => {
    const model = made(() => <Shape key="dot" geometry={circle(4)} />);
    const dot = only(model);

    const blurred: Model.Scene = {
      ...model,
      root: { ...model.root, children: [{ ...dot, effects: [{ kind: "blur", radius: 2 }] }] },
    };

    expect(
      diagnose(blurred, svg).map((entry) => [entry.severity, entry.feature, entry.key]),
    ).toEqual([["error", "blur", "dot"]]);
    expect(() => svg.emit(blurred)).toThrow('"dot" uses blur, which SVG can\'t draw');
  });
});

describe("isScene", () => {
  test("knows a scene model by its shape, and nothing else", () => {
    const model = made(() => <Shape geometry={circle(4)} fill="#FF0000" />);

    expect(isScene(model)).toBe(true);
    expect(isScene(structuredClone({ ...model, fonts: {} }))).toBe(true);
    expect(isScene(svg.emit(model))).toBe(false);
    expect(isScene(() => model)).toBe(false);
    expect(isScene({ ...model, root: null })).toBe(false);
    expect(isScene(null)).toBe(false);
  });
});
