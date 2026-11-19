import { describe, expect, test } from "bun:test";
import {
  font,
  picture,
  Align,
  Arrow,
  Grid,
  Group,
  Picture,
  Sequence,
  Shape,
  Stack,
  Text,
  circle,
  ease,
  morph,
  polygon,
  rect,
  ref,
  scene,
  span,
  track,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import { renderFrames } from "svjeez/frames";
import { jsx } from "svjeez/jsx-runtime";
import { restyle } from "svjeez/page";
import { boxesOf, hitTest, isLane, placements, svg, type Model } from "svjeez/tools";
import { blendVec, valueAt } from "../src/model/sample";
import { startTrace, stopTrace } from "../src/svg/traced";
import integration from "./fixtures/scene/integration";

const mono = await font.load(new URL("./fixtures/SpaceMono-Regular.ttf", import.meta.url));

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test" }, build);

const all = (model: Model.Scene): Model.SceneNode[] => {
  const out: Model.SceneNode[] = [];

  const visit = (node: Model.SceneNode): void => {
    out.push(node);

    if (node.kind === "group") node.children.forEach(visit);
  };

  visit(model.root);

  return out;
};

const find = (model: Model.Scene, key: string): Model.SceneNode => {
  const found = all(model).find((node) => node.key === key);

  if (!found) throw new Error(`no node "${key}"`);

  return found;
};

const at = (node: Model.SceneNode, t: number): Vec => valueAt(node.at, t, blendVec);

const own = (node: Model.SceneNode): Model.Layer => node.layers.at(-1)!;

const center = ({ x, y, width, height }: Model.Box): Vec => [x + width / 2, y + height / 2];

const near = (a: Vec, b: Vec, within = 0.1): void => {
  expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(within);
};

const red = "#E0533D";
const blue = "#2F7FD0";

describe("timelines reach a node wherever it sits", () => {
  test("a Stack at the top of a scene is a container, not the root, so it places its children", () => {
    const model = made(() => (
      <Stack direction="row" gap={4}>
        <Shape key="a" geometry={rect(10, 10)} fill={red} />
        <Shape key="b" geometry={rect(10, 10)} fill={red} />
      </Stack>
    ));

    expect(at(find(model, "0/b"), 0)).toEqual([14, 0]);
  });

  test("inside a Grid, a track on one of its parts", () => {
    const model = made(() => {
      const dim = track(1).to(0.25, span(0, 1), ease.linear);

      return (
        <Grid key="grid" columns={2} gap={4}>
          <Shape key="a" geometry={rect(10, 10)} fill={red} />
          <Shape key="b" geometry={rect(10, 10)} fill={red} opacity={dim} />
        </Grid>
      );
    });

    expect(valueAt(own(find(model, "grid/b")).opacity, 1, (a, b, u) => a + (b - a) * u)).toBe(0.25);
    expect(at(find(model, "grid/b"), 0)).toEqual([14, 0]);
  });

  test("inside a morph, a ref on the same node in each state is one node", () => {
    const model = made(() => {
      const fade = track(1).to(0.5, span(0, 1));

      return morph(
        <Shape key="dot" geometry={circle(4)} fill={red} opacity={fade} />,
        <Shape key="dot" geometry={circle(8)} fill={red} opacity={fade} />,
        span(2, 1),
      );
    });

    const dot = find(model, "dot");

    expect(isLane(own(dot).opacity)).toBe(true);
    expect(isLane(dot.kind === "shape" && dot.geometry)).toBe(true);
  });

  test("inside nested Sequences, on the clock of the one the node sits in", () => {
    const model = made(() => {
      const dot = track<Vec>([0, 0]).to([10, 0], span(0, 1), ease.linear);

      return (
        <Sequence when={span(1)}>
          <Sequence when={span(0.5)}>
            <Shape key="dot" geometry={circle(4)} anchor="center" at={dot} fill={red} />
          </Sequence>
        </Sequence>
      );
    });

    const dot = find(model, "dot");

    expect([at(dot, 1.5), at(dot, 2), at(dot, 2.5)]).toEqual([
      [0, 0],
      [5, 0],
      [10, 0],
    ]);
  });
});

describe("morph between states that hold layout, text, connectors, images", () => {
  test("a Stack reflows: each child moves from its slot in one state to its slot in the next", () => {
    const model = made(() =>
      morph(
        <Stack key="row" direction="row" gap={4}>
          <Shape key="a" geometry={rect(10, 10)} fill={red} />
          <Shape key="b" geometry={rect(10, 10)} fill={red} />
        </Stack>,
        <Stack key="row" direction="row" gap={4}>
          <Shape key="a" geometry={rect(10, 10)} fill={red} />
          <Shape key="new" geometry={rect(30, 10)} fill={red} />
          <Shape key="b" geometry={rect(20, 10)} fill={red} />
        </Stack>,
        span(1, 1),
      ),
    );

    const b = find(model, "row/b");

    expect([at(b, 0), at(b, 2)]).toEqual([
      [14, 0],
      [48, 0],
    ]);
    expect(at(find(model, "row/new"), 2)).toEqual([14, 0]);
    expect(boxesOf(model, 2)["row/b"]).toEqual({ x: 48, y: 0, width: 20, height: 10 });
  });

  test("a Grid and an Align in a morph state are arranged in that state", () => {
    const model = made(() =>
      morph(
        <Group key="g">
          <Grid key="grid" columns={2}>
            <Shape key="a" geometry={rect(10, 10)} fill={red} />
            <Shape key="b" geometry={rect(10, 10)} fill={red} />
          </Grid>
          <Align key="corner" place="bottom-right">
            <Shape key="c" geometry={rect(10, 10)} fill={red} />
          </Align>
        </Group>,
        <Group key="g">
          <Grid key="grid" columns={1}>
            <Shape key="a" geometry={rect(10, 10)} fill={red} />
            <Shape key="b" geometry={rect(10, 10)} fill={red} />
          </Grid>
          <Align key="corner" place="bottom-right">
            <Shape key="c" geometry={rect(20, 20)} fill={red} />
          </Align>
        </Group>,
        span(1, 1),
      ),
    );

    expect([at(find(model, "g/grid/b"), 0), at(find(model, "g/grid/b"), 2)]).toEqual([
      [10, 0],
      [0, 10],
    ]);
    expect(boxesOf(model, 0)["g/corner/c"]).toEqual({ x: 190, y: 90, width: 10, height: 10 });
    expect(boxesOf(model, 2)["g/corner/c"]).toEqual({ x: 180, y: 80, width: 20, height: 20 });
  });

  test("a container in a morph state that holds an anchored node says where to attach it", () => {
    expect(() =>
      made(() => {
        const a = ref();

        return (
          <Group>
            <Shape key="a" ref={a} geometry={rect(10, 10)} fill={red} />
            {morph(
              <Stack key="s">
                <Arrow head="none" key="l" from={[0, 0]} to={a.right} stroke={{ color: red }} />
              </Stack>,
              <Stack key="s" gap={4}>
                <Arrow head="none" key="l" from={[0, 0]} to={a.right} stroke={{ color: red }} />
              </Stack>,
              span(1, 1),
            )}
          </Group>
        );
      }),
    ).toThrow('A <Stack> in a morph() state holds <Arrow> "l", which is placed by an anchor');
  });

  test("a node anchored in one state and placed at a point in another says how to write it", () => {
    const state = (at: Vec | "anchor") =>
      made(() => {
        const a = ref();

        const dot = (where: Vec | "anchor") => (
          <Shape
            key="d"
            geometry={circle(2)}
            anchor="center"
            at={where === "anchor" ? a.right : where}
            fill={blue}
          />
        );

        return (
          <Group>
            <Shape key="a" ref={a} geometry={rect(10, 10)} at={[100, 50]} fill={red} />
            {morph(dot(at), dot(at === "anchor" ? [10, 10] : "anchor"), span(1, 1))}
          </Group>
        );
      });

    expect(() => state("anchor")).toThrow(
      '"d" is placed at <Shape> "a".right in one morph() state and at a point in another. A morph blends points, not anchors',
    );
    expect(() => state([10, 10])).toThrow(
      '"d" is placed at a point in one morph() state and at <Shape> "a".right',
    );
  });

  test("a container around a morph reflows: its other children make room as the morph resizes", () => {
    const xAt = (model: Model.Scene, key: string, t: number): number =>
      placements(model, t).find((placed) => placed.key === key)!.matrix[4];

    const model = made(() => (
      <Stack key="row" direction="row" gap={2} fill={red}>
        {morph(
          <Shape key="a" geometry={rect(10, 10)} fill={red} />,
          <Shape key="a" geometry={rect(40, 10)} fill={red} />,
          span(1, 1),
          { curve: ease.linear },
        )}
        <Shape key="b" geometry={rect(10, 10)} fill={red} />
      </Stack>
    ));

    expect(xAt(model, "row/b", 0)).toBeCloseTo(12, 6);
    expect(xAt(model, "row/b", 1.5)).toBeCloseTo(27, 6);
    expect(xAt(model, "row/b", 3)).toBeCloseTo(42, 6);

    const row = model.root.children[0]!;
    const background = row.kind === "group" ? row.children[0] : undefined;

    expect(background?.key).toBe("row/background");
    expect(background?.kind === "shape" && isLane(background.geometry)).toBe(true);
  });

  test("a morph deep inside a container, or one whose nodes enter, reflows the container too", () => {
    const yAt = (model: Model.Scene, key: string, t: number): number =>
      placements(model, t).find((placed) => placed.key === key)!.matrix[5];

    const model = made(() => (
      <Align key="middle">
        <Stack key="col" gap={2}>
          <Group key="g">
            {morph(
              [<Shape key="a" geometry={rect(10, 10)} fill={red} />],
              [
                <Shape key="a" geometry={rect(10, 10)} fill={red} />,
                <Shape key="c" geometry={rect(10, 10)} at={[0, 20]} fill={red} />,
              ],
              span(1, 1),
            )}
          </Group>
          <Shape key="b" geometry={rect(10, 10)} fill={red} />
        </Stack>
      </Align>
    ));

    expect(yAt(model, "middle/col/g/a", 3) - yAt(model, "middle/col/g/a", 0)).toBeCloseTo(-10, 6);
    expect(yAt(model, "middle/col/b", 3) - yAt(model, "middle/col/b", 0)).toBeCloseTo(10, 6);
  });

  test("a container that can't reflow, around a morph inside a Sequence, is an error that names it", () => {
    expect(() =>
      made(() => (
        <Stack key="row" direction="row">
          <Sequence when={span(1)}>
            <Group key="g">
              {morph(
                <Shape key="a" geometry={rect(10, 10)} fill={red} />,
                <Shape key="a" geometry={rect(40, 10)} fill={red} />,
                span(0, 1),
              )}
            </Group>
          </Sequence>
          <Shape key="b" geometry={rect(10, 10)} fill={red} />
        </Stack>
      )),
    ).toThrow(
      '<Stack> "row" lays out <Shape> "a", which a morph() resizes, brings in or takes away inside a <Sequence>',
    );

    expect(() =>
      made(() => (
        <Stack key="row" direction="row">
          {morph(
            <Shape key="a" geometry={rect(10, 10)} fill={red} />,
            <Shape key="a" geometry={rect(40, 10)} fill={red} />,
            span(0, 1),
          )}
          {morph(
            <Shape key="b" geometry={rect(10, 10)} fill={red} />,
            <Shape key="b" geometry={rect(40, 10)} fill={red} />,
            span(1, 1),
          )}
        </Stack>
      )),
    ).toThrow("A <Stack> holds morphs on different spans or with different options");
  });

  test("a Line or Arrow end given a track is an error that names the connector", () => {
    const moving = track<Vec>([0, 0]).to([50, 0], span(0, 1));
    // SAFETY: what a scene written without types hands over: a track where TypeScript would refuse it.
    const untyped = moving as never;

    expect(() =>
      made(() => <Arrow key="arrow" from={[0, 0]} to={untyped} stroke={{ color: blue }} />),
    ).toThrow(
      '<Arrow> "arrow" is given a track for its to, but an end is a point or an anchor. To move an end, attach it to a ref\'s anchor, as in to={card.left}, and move the node it is attached to.',
    );

    expect(() =>
      made(() => (
        <Arrow head="none" key="line" from={untyped} to={[9, 9]} stroke={{ color: blue }} />
      )),
    ).toThrow('<Arrow> "line" is given a track for its from');
  });

  test("a Stack around a morph that only moves or recolors its children still lays it out", () => {
    const model = made(() => (
      <Stack direction="row" gap={2}>
        {morph(
          <Shape key="a" geometry={rect(10, 10)} fill={red} />,
          <Shape key="a" geometry={rect(10, 10)} fill={blue} />,
          span(1, 1),
        )}
        <Shape key="b" geometry={rect(10, 10)} fill={red} />
      </Stack>
    ));

    expect(boxesOf(model, 3)["0/b"]?.x).toBe(12);
  });

  test("text that rewraps crossfades between its two layouts", () => {
    const model = made(() =>
      morph(
        <Text key="t" font={mono} size={10} width={60} fill={red}>
          {"hello world again"}
        </Text>,
        <Text key="t" font={mono} size={10} width={200} fill={red}>
          {"hello world again"}
        </Text>,
        span(1, 1),
      ),
    );

    const t = find(model, "t");

    expect(t.kind).toBe("group");
    expect(
      t.kind === "group" && t.children.map((child) => child.kind === "text" && child.lines.length),
    ).toEqual([3, 1]);
  });

  test("an arrow on refs whose targets move in the morph follows them", () => {
    const model = made(() => {
      const a = ref();
      const b = ref();

      const state = (y: number) => (
        <Group>
          <Shape key="a" ref={a} geometry={rect(10, 10)} fill={red} />
          <Shape key="b" ref={b} at={[100, y]} geometry={rect(10, 10)} fill={red} />
        </Group>
      );

      return (
        <Group>
          {morph(state(0), state(60), span(1, 1))}
          <Arrow key="arrow" from={a.right} to={b.left} stroke={{ color: blue }} />
        </Group>
      );
    });

    for (const t of [0, 1.5, 3]) {
      const tip = placements(model, t).find((node) => node.key === "arrow/head");
      const target = boxesOf(model, t)["0/b"]!;

      expect(tip).toBeDefined();
      near(center(boxesOf(model, t)["arrow/head"]!), [target.x, target.y + 5], 6);
    }
  });

  test("an image and a shape move between states, and a picture that changes is refused", () => {
    const badge = picture('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"/>');
    const other = picture('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');

    const model = made(() =>
      morph(
        <Group>
          <Picture key="i" src={badge} />
          <Shape key="s" geometry={circle(4)} fill={red} anchor="center" at={[0, 0]} />
        </Group>,
        <Group>
          <Picture key="i" src={badge} at={[50, 50]} />
          <Shape key="s" geometry={circle(4)} fill={red} anchor="center" at={[80, 0]} scale={2} />
        </Group>,
        span(1, 1),
      ),
    );

    expect(boxesOf(model, 2)["0/i"]).toEqual({ x: 50, y: 50, width: 20, height: 10 });
    expect(boxesOf(model, 2)["0/s"]).toEqual({ x: 72, y: -8, width: 16, height: 16 });

    expect(() =>
      made(() =>
        morph(<Picture key="i" src={badge} />, <Picture key="i" src={other} />, span(1, 1)),
      ),
    ).toThrow('morph() can\'t blend <Picture> "i": its picture or size differs between states');
  });
});

describe("anchors follow whatever moves their node", () => {
  const follows = (target: (box: SceneElement) => SceneElement, moved: string) => {
    const model = made(() => {
      const a = ref();

      return (
        <Group>
          {target(<Shape key="a" ref={a} geometry={rect(10, 10)} fill={red} />)}
          <Shape key="dot" geometry={circle(1)} anchor="center" at={a.right} fill={blue} />
        </Group>
      );
    }, 3);

    for (const t of [0, 0.3, 0.7, 1.2, 2.5]) {
      const box = boxesOf(model, t)[moved]!;

      near(center(boxesOf(model, t).dot!), [box.x + box.width, box.y + box.height / 2]);
    }

    return model;
  };

  test("tracks", () => {
    const model = made(() => {
      const a = ref();
      const pos = track<Vec>([0, 0]).to([80, 40], span(0, 1));
      const turn = track(0).to(90, pos.span.next(1));

      return (
        <Group>
          <Shape key="a" ref={a} geometry={rect(10, 10)} fill={red} at={pos} rotate={turn} />
          <Shape key="dot" geometry={circle(1)} anchor="center" at={a.right} fill={blue} />
        </Group>
      );
    }, 3);

    near(center(boxesOf(model, 0).dot!), [10, 5]);
    near(center(boxesOf(model, 1).dot!), [90, 45]);
    near(center(boxesOf(model, 2).dot!), [85, 50]);
  });

  test("a spring", () => {
    follows(
      (node) => (
        <Group
          offset={track<Vec>([0, 0]).to(
            [80, 40],
            span(0, 2),
            ease.spring({ stiffness: 120, damping: 10 }),
          )}
        >
          {node}
        </Group>
      ),
      "0/a",
    );
  });

  test("a morph", () => {
    follows(
      (node) =>
        morph(
          <Group key="m">{node}</Group>,
          <Group key="m" offset={[60, 30]}>
            {node}
          </Group>,
          span(0.5, 1),
        ),
      "m/a",
    );
  });

  test("a derived track", () => {
    const angle = track(0).to(180, span(0, 2), ease.inOut);

    follows(
      (node) => (
        <Group offset={angle.map((a): Vec => [50 + 30 * Math.cos((a * Math.PI) / 180), 50])}>
          {node}
        </Group>
      ),
      "0/a",
    );
  });

  test("a geometry that grows takes its anchors along", () => {
    const model = made(() => {
      const bar = ref();

      return (
        <Group>
          <Shape
            key="bar"
            ref={bar}
            geometry={track(rect(10, 10)).to(rect(60, 10), span(0, 1), ease.linear)}
            fill={red}
          />
          <Shape key="dot" geometry={circle(1)} anchor="center" at={bar.right} fill={blue} />
        </Group>
      );
    });

    near(center(boxesOf(model, 0).dot!), [10, 5]);
    near(center(boxesOf(model, 0.5).dot!), [35, 5]);
    near(center(boxesOf(model, 1).dot!), [60, 5]);
  });

  test("a part through a layout container and through a morph", () => {
    const model = made(() => {
      const row = ref();
      const card = ref();

      return (
        <Group>
          <Stack key="row" ref={row} direction="row" gap={4} at={[0, 50]}>
            <Shape key="x" geometry={rect(10, 10)} fill={red} />
            <Shape key="y" geometry={rect(10, 10)} fill={red} />
          </Stack>
          <Group key="card" ref={card}>
            {morph(
              <Shape key="body" geometry={rect(10, 10)} fill={red} />,
              <Shape key="body" geometry={rect(10, 10)} at={[100, 0]} fill={red} />,
              span(1, 1),
            )}
          </Group>
          <Shape
            key="one"
            geometry={circle(1)}
            anchor="center"
            at={row.part("y").right}
            fill={blue}
          />
          <Shape
            key="two"
            geometry={circle(1)}
            anchor="center"
            at={card.part("body").left}
            fill={blue}
          />
        </Group>
      );
    });

    near(center(boxesOf(model).one!), [24, 55]);
    near(center(boxesOf(model, 0).two!), [0, 5]);
    near(center(boxesOf(model, 2).two!), [100, 5]);
  });
});

describe("springs across slices", () => {
  const settle = { stiffness: 170, damping: 26 };

  test("a step hands a spring's speed on to the next step", () => {
    const model = made(() => {
      const first = track<Vec>([0, 0]).to([60, 0], span(0, 0.4), ease.spring(settle));
      const dot = first.to([60, 60], first.span.next(1.5), ease.spring(settle));

      return <Shape key="dot" geometry={circle(4)} anchor="center" at={dot} fill={red} />;
    });

    const dot = find(model, "dot");
    const speed = (from: number, to: number) => (at(dot, to)[0] - at(dot, from)[0]) / (to - from);

    expect(at(dot, 0.4)[0]).toBeLessThan(59);
    expect(speed(0.38, 0.4)).toBeGreaterThan(15);
    expect(speed(0.4, 0.42)).toBeGreaterThan(10);
    near(at(dot, 4), [60, 60], 0.05);
  });

  test("a spring in a morph moves points; colors take an ease over the span", () => {
    const model = made(() =>
      morph(
        <Shape key="a" geometry={rect(10, 10)} fill={red} />,
        <Shape key="a" at={[50, 0]} geometry={rect(20, 10)} fill={blue} />,
        span(1, 2),
        { curve: ease.spring(settle) },
      ),
    );

    const a = find(model, "a");

    expect(a.kind === "shape" && isLane(a.fill)).toBe(true);
    near(at(a, 3), [50, 0], 0.05);
  });

  test("a spring on trim is allowed; on geometry or a color it is a clear error", () => {
    const trim = made(() => (
      <Shape
        key="s"
        geometry={rect(10, 10)}
        stroke={{ color: red }}
        trim={track<Vec>([0, 0]).to([0, 1], span(0, 2), ease.spring(settle))}
      />
    ));

    const trimmed = find(trim, "s");

    expect(trimmed.kind === "shape" && isLane(trimmed.trim)).toBe(true);

    expect(() =>
      made(() => (
        <Shape
          key="s"
          geometry={track(rect(10, 10)).to(rect(40, 10), span(0, 2), ease.spring(settle))}
          fill={red}
        />
      )),
    ).toThrow(
      'geometry on <Shape> "s" moves on a spring, and a spring moves only numbers and points. Use an ease such as ease.out.',
    );

    expect(() =>
      made(() => (
        <Shape
          key="s"
          geometry={rect(10, 10)}
          fill={track<Paint>(red).to(blue, span(0, 2), ease.spring(settle))}
        />
      )),
    ).toThrow('fill on <Shape> "s" moves on a spring');
  });
});

describe("derived tracks feed every kind of value", () => {
  const angle = track(0).to(1, span(0, 2), ease.inOut);

  test("geometry, trim, a color and an anchor's node", () => {
    const model = made(() => {
      const dot = ref();

      return (
        <Group>
          <Shape key="bar" geometry={angle.map((u) => rect(10 + 40 * u, 10))} fill={red} />
          <Shape
            key="ring"
            geometry={circle(10)}
            stroke={{ color: red }}
            trim={angle.map((u): Vec => [0, u])}
          />
          <Shape key="lamp" geometry={circle(4)} fill={angle.map((u) => (u < 0.5 ? red : blue))} />
          <Shape
            key="dot"
            ref={dot}
            geometry={circle(2)}
            anchor="center"
            at={angle.map((u): Vec => [100 + 50 * u, 50])}
            fill={red}
          />
          <Arrow head="none" key="tie" from={[100, 0]} to={dot.top} stroke={{ color: blue }} />
        </Group>
      );
    });

    const pick = <K extends "geometry" | "trim" | "fill">(key: string, prop: K) => {
      const node = find(model, key);

      return node.kind === "shape" ? node[prop] : undefined;
    };

    expect(isLane(pick("bar", "geometry"))).toBe(true);
    expect(isLane(pick("ring", "trim"))).toBe(true);
    expect(isLane(pick("lamp", "fill"))).toBe(true);
    expect(boxesOf(model, 2)["bar"]?.width).toBeCloseTo(50, 5);

    for (const t of [0, 1, 2]) {
      const dot = boxesOf(model, t).dot!;
      const shaft = placements(model, t).find((node) => node.key === "tie/shaft")!;
      const [a, b, , , e, f] = shaft.matrix;
      const [dx, dy] = [dot.x + dot.width / 2 - 100, dot.y];

      near([e, f], [100, 0], 0.01);
      expect(Math.abs(a * dy - b * dx) / Math.hypot(a, b) / Math.hypot(dx, dy)).toBeLessThan(1e-3);
    }
  });
});

const everyKind = (options: { readonly loop?: boolean } = {}): Model.Scene => {
  const badge = picture('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"/>');

  return scene({ size: [200, 100], duration: 4, title: "Every kind", ...options }, () => {
    const fade = track(1).to(0.5, span(0, 1));

    return (
      <Group>
        <Shape
          key="moved"
          geometry={circle(2)}
          anchor="center"
          at={[190, 90]}
          fill={blue}
          opacity={fade}
        />
        <Shape key="shape" geometry={rect(20, 10)} at={[10, 10]} rotate={30} fill={red} />
        <Text key="text" font={mono} size={10} at={[40, 20]} scale={2} fill={red}>
          {"hi"}
        </Text>
        <Picture key="image" src={badge} at={[90, 10]} rotate={90} />
        <Shape
          key="star"
          geometry={circle(4)}
          fill={red}
          anchor="center"
          at={[130, 15]}
          scale={[2, 1]}
        />
        <Stack key="stack" direction="row" at={[10, 60]} gap={2}>
          <Shape key="cell" geometry={rect(10, 10)} fill={blue} />
        </Stack>
        <Group key="morph" offset={[60, 60]}>
          {morph(
            <Shape key="m" geometry={rect(10, 10)} fill={red} />,
            <Shape key="m" geometry={rect(10, 10)} at={[40, 0]} fill={blue} />,
            span(1, 1),
          )}
        </Group>
      </Group>
    );
  });
};

describe("identity and output for every node kind", () => {
  startTrace({ within: import.meta.dir });
  const model = everyKind();

  stopTrace();

  test("keys run from the root down through containers and morphs", () => {
    expect(all(model).map((node) => node.key)).toEqual([
      "root",
      "moved",
      "shape",
      "text",
      "image",
      "star",
      "stack",
      "stack/cell",
      "morph",
      "morph/m",
    ]);
  });

  test("sources: true writes each node's key and where it was written, prefix and playbackRate included", () => {
    const out = svg.emit(model, { sources: true, prefix: "p", playbackRate: 2 });

    for (const key of [
      "moved",
      "shape",
      "text",
      "image",
      "star",
      "stack",
      "stack/cell",
      "morph",
      "morph/m",
    ])
      expect(out).toMatch(
        new RegExp(`data-key="${key}"[^>]*data-source="[^"]*scene-integration\\.test\\.tsx:\\d+`),
      );

    expect(out).toContain('data-playback-rate="2"');
    expect(out).not.toMatch(/\bclass="a\b/);
    expect(out).toMatch(/\bclass="pa\b|p-?a\b/);
  });

  test("hitTest finds each kind at rest and at a time, under rotate and scale", () => {
    const hit = (point: Vec, t = 0) => hitTest(model, point, t)?.key;

    expect(hit([20, 15])).toBe("shape");
    expect(hit([10.5, 10.5])).toBeUndefined();
    expect(hit([45, 15])).toBe("text");
    expect(hit([95, 20])).toBe("image");
    expect(hit([137, 15])).toBe("star");
    expect(hit([15, 65])).toBe("stack/cell");
    expect(hit([65, 65], 0)).toBe("morph/m");
    expect(hit([65, 65], 3)).toBeUndefined();
    expect(hit([125, 65], 3)).toBeUndefined();
    expect(hit([105, 65], 3)).toBe("morph/m");
  });

  test("boxesOf turns and scales each kind's box", () => {
    const boxes = boxesOf(model);

    expect(boxes.image).toEqual({ x: 95, y: 5, width: 10, height: 20 });
    expect(boxes.star).toEqual({ x: 122, y: 11, width: 16, height: 8 });
  });

  test("loop: false plays once and holds", () => {
    const once = svg.emit(everyKind({ loop: false }));

    expect(once).not.toContain("animation-iteration-count:infinite");
  });
});

describe("the SVG backend", () => {
  test("a geometry eased past its ends still animates in SMIL, whose keySplines take 0 to 1 only", () => {
    const back = ease.bezier(0.34, 1.56, 0.64, 1);

    const out = svg.emit(
      made(() => (
        <Shape
          geometry={track(polygon([0, 0], [10, 0], [5, 20])).to(
            polygon([0, 0], [10, 0], [90, 20]),
            span(0, 2),
            back,
          )}
          fill={red}
        />
      )),
    );

    const splines = [...out.matchAll(/keySplines="([^"]*)"/g)].flatMap((m) =>
      m[1]!.split(/[ ;]/).map(Number),
    );

    expect(out).toContain('attributeName="d"');
    expect(splines.length).toBeGreaterThan(0);
    expect(splines.every((y) => y >= 0 && y <= 1)).toBe(true);
  });
});

describe("errors a newcomer meets first", () => {
  test("a lowercase tag, or JSX another runtime built, says what to write", () => {
    // SAFETY: what an untyped file hands the runtime for a lowercase tag.
    expect(() => jsx("rect" as never, { width: 4, height: 4 })).toThrow(
      "JSX holds <rect>, an SVG tag, which a scene doesn't draw",
    );

    // SAFETY: what scene() is handed when a file's JSX is another library's, such as React's.
    expect(() => made(() => ({ $$typeof: "react.element", props: {} }) as never)).toThrow(
      "scene()'s callback holds JSX that another runtime built, not a scene node. Put `/** @jsxImportSource svjeez */` at the top of the file",
    );
  });

  test("bare text and a shape with no geometry say what to write", () => {
    // SAFETY: what JSX hands over for text written straight inside a group.
    expect(() => made(() => <Group>{"hello" as never}</Group>)).toThrow(
      'The scene holds the bare text "hello". Write text in a <Text font={…} size={…} fill={…}>.',
    );

    // SAFETY: what a scene written without types hands over.
    expect(() => made(() => <Shape geometry={undefined as never} fill={red} />)).toThrow(
      "<Shape> has no geometry. Give it one, such as geometry={rect(40, 20)}.",
    );
  });

  test("a child a container places, given an at, says to drop it", () => {
    expect(() =>
      made(() => (
        <Stack>
          <Shape key="a" geometry={circle(4)} anchor="center" at={[5, 5]} fill={red} />
        </Stack>
      )),
    ).toThrow('<Shape> "a" has its own at, but the <Stack> it sits in places it. Drop its at');
  });

  test("an unkeyed morph says to key what changes", () => {
    expect(() =>
      made(() =>
        morph(
          <Group>
            <Shape geometry={circle(4)} fill={red} />
          </Group>,
          <Group>
            <Shape geometry={circle(4)} fill={red} />
            <Shape geometry={circle(4)} fill={red} />
          </Group>,
          span(1, 1),
        ),
      ),
    ).toThrow('Give each node that comes, goes or changes a key, as in <Shape key="…" />');
  });

  test("a ref on no node says so, when an anchor uses it", () => {
    expect(() =>
      made(() => {
        const ghost = ref();

        return <Shape geometry={circle(4)} anchor="center" at={ghost.right} fill={red} />;
      }),
    ).toThrow("ref().right is a ref that is on no node. Give one node ref={…} with it.");
  });

  test("a span past the end of the scene names the prop and the node", () => {
    expect(() =>
      made(() => (
        <Shape key="late" geometry={circle(4)} opacity={track(0).to(1, span(3.5, 1))} fill={red} />
      )),
    ).toThrow('"late"');

    expect(() =>
      made(() => (
        <Sequence when={span(3, 2)}>
          <Shape geometry={circle(4)} fill={red} />
        </Sequence>
      )),
    ).toThrow("A <Sequence when={span(3, 2)}> runs until 5s, past the 4s scene.");

    expect(() =>
      made(() => (
        <Shape
          fill="#000000"
          key="late"
          geometry={circle(4)}
          opacity={track(0).to(1, span(3.5, 1))}
        />
      )),
    ).toThrow(
      'opacity on <Shape> "late" runs until 4.5s, past the 4s scene. End it by then, or give scene() a longer duration.',
    );

    expect(() =>
      made(() => {
        const fade = track(1).to(0, span(0, 5));

        return <Shape key="dot" geometry={circle(4)} anchor="center" fill={red} opacity={fade} />;
      }),
    ).toThrow('"dot"');
  });
});

const browser = await renderFrames(
  svg.emit(made(() => <Shape geometry={rect(4, 4)} fill={red} />)),
  {
    times: [0],
  },
).then(
  () => true,
  (error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping frame tests: ${error.message.split("\n")[0]}`);

    return false;
  },
);

const same = (a: Uint8Array, b: Uint8Array) => Buffer.from(a).equals(Buffer.from(b));

const shot = async (
  markup: string,
  reducedMotion: "reduce" | "no-preference",
): Promise<Uint8Array> => {
  const { chromium } = await import("playwright-core");
  const chrome = await chromium.launch();

  try {
    const page = await chrome.newPage({ viewport: { width: 320, height: 200 }, reducedMotion });
    await page.setContent(`<style>body{margin:0}</style>${markup}`);
    await page.waitForTimeout(300);

    return new Uint8Array(await page.screenshot());
  } finally {
    await chrome.close();
  }
};

describe.if(browser)("frames", () => {
  test("reduced motion holds the picture at the scene's still time, every slice and node kind together", async () => {
    for (const playbackRate of [1, 2]) {
      const out = svg.emit(integration, { playbackRate, prefix: "r" });
      const reduced = await shot(out, "reduce");

      const paused = await shot(
        restyle(out, { at: integration.still!, paused: true }),
        "no-preference",
      );

      expect(same(reduced, paused)).toBe(true);
    }
  });
});
