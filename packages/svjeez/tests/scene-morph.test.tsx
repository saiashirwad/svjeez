import { describe, expect, test } from "bun:test";
import {
  Arrow,
  Group,
  Sequence,
  Shape,
  Stack,
  Text,
  circle,
  ease,
  morph,
  path,
  ref,
  rect,
  scene,
  span,
  track,
  type SceneElement,
  font,
} from "svjeez";
import {
  boxesOf,
  describe as describeScene,
  hitTest,
  check,
  isLane,
  SceneError,
  svg,
  valueAt,
  type Model,
} from "svjeez/tools";
import { mixGeometry } from "../src/model/geometry";
import { jsxDEV } from "svjeez/jsx-dev-runtime";
import { jsx } from "svjeez/jsx-runtime";
import { readFileSync } from "node:fs";
import { fontFixture } from "../../../fixtures/fonts";

const mono = font(readFileSync(fontFixture("JetBrainsMono")));

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test" }, build);

const find = (model: Model.Scene, key: string): Model.SceneNode => {
  const visit = (node: Model.SceneNode): Model.SceneNode | undefined =>
    node.key === key
      ? node
      : node.kind === "group"
        ? node.children.map(visit).find(Boolean)
        : undefined;

  const found = visit(model.root);

  if (!found) throw new Error(`no node "${key}"`);

  return found;
};

const lane = <T,>(value: Model.Animated<T> | undefined): Model.Lane<T> => {
  if (value === undefined || !isLane(value)) throw new Error("expected a lane");

  return value;
};

const ends = <T,>(value: Model.Animated<T> | undefined): [T, T] => {
  const { keys } = lane(value);

  return [keys[0].value, keys.at(-1)!.value];
};

const shape = (model: Model.Scene, key: string): Model.ShapeNode => {
  const node = find(model, key);

  if (node.kind !== "shape") throw new Error(`expected a shape, got a ${node.kind}`);

  return node;
};

describe("morph", () => {
  test("a node in both states moves, resizes and recolors over the span", () => {
    const model = made(() =>
      morph(
        <Shape key="a" geometry={rect(10, 10)} at={[0, 0]} fill="#ff0000" />,
        <Shape key="a" geometry={rect(40, 20)} at={[50, 30]} fill="#0000ff" />,
        span(1, 2),
      ),
    );

    const a = shape(model, "a");

    expect(ends(a.at)).toEqual([
      [0, 0],
      [50, 30],
    ]);
    expect(lane(a.at).keys.map((key) => key.t)).toEqual([0, 1, 3, 4]);
    expect(ends(a.geometry).map((g) => g.kind)).toEqual(["rect", "rect"]);
    expect(ends(a.fill)).toEqual([
      [1, 0, 0, 1],
      [0, 0, 1, 1],
    ]);
    expect(a.box).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  test("a shape that changes kind morphs as matched paths", () => {
    const a = shape(
      made(() =>
        morph(
          <Shape key="a" geometry={circle(10)} fill="#ff0000" />,
          <Shape key="a" geometry={rect(40, 20, { radius: 6 })} fill="#ff0000" />,
          span(0, 1),
        ),
      ),
      "a",
    );

    const [from, to] = ends(a.geometry);

    expect([from.kind, to.kind]).toEqual(["path", "path"]);
    expect(a.fill).toEqual([1, 0, 0, 1]);
  });

  test("rotate and scale come from each state, around the first state's origin", () => {
    const model = made(() =>
      morph(
        <Shape fill="#000000" key="a" geometry={rect(10, 10)} />,
        <Shape fill="#000000" key="a" geometry={rect(20, 10)} rotate={90} />,
        span(0, 1),
      ),
    );

    const [layer] = shape(model, "a").layers;

    expect(ends(layer!.rotate)).toEqual([0, 90]);
    const box = boxesOf(model, 2).a!;

    expect(box.x).toBeCloseTo(5);
    expect(box.y).toBeCloseTo(-5);
    expect(box.width).toBeCloseTo(10);
    expect(box.height).toBeCloseTo(20);
  });

  test("a node only in after enters, one only in before exits, by the recipes given", () => {
    const model = made(() =>
      morph(
        <Shape fill="#000000" key="old" geometry={rect(10, 10)} />,
        <Shape fill="#000000" key="new" geometry={rect(10, 10)} />,
        span(1, 1),
        { enter: { opacity: 0, scale: 0.5 } },
      ),
    );

    const [enter] = shape(model, "new").layers;
    const [exit] = shape(model, "old").layers;

    expect(ends(enter!.opacity)).toEqual([0, 1]);
    expect(ends(enter!.scale)).toEqual([
      [0.5, 0.5],
      [1, 1],
    ]);
    expect(ends(exit!.opacity)).toEqual([1, 0]);
    expect(exit!.scale).toEqual([1, 1]);
  });

  test("paint order follows after, with each exiting node kept where it was", () => {
    const model = made(() =>
      morph(
        [
          <Shape fill="#000000" key="a" geometry={rect(1, 1)} />,
          <Shape fill="#000000" key="gone" geometry={rect(1, 1)} />,
        ],
        [
          <Shape fill="#000000" key="b" geometry={rect(1, 1)} />,
          <Shape fill="#000000" key="a" geometry={rect(1, 1)} />,
        ],
        span(0, 1),
      ),
    );

    expect(model.root.children.map((node) => node.key)).toEqual(["b", "a", "gone"]);
  });

  test("groups match recursively, by key path", () => {
    const model = made(() =>
      morph(
        <Group key="g">
          <Shape fill="#000000" key="dot" geometry={circle(2)} anchor="center" at={[0, 0]} />
        </Group>,
        <Group key="g" offset={[10, 0]}>
          <Shape fill="#000000" key="dot" geometry={circle(2)} anchor="center" at={[5, 5]} />
        </Group>,
        span(0, 1),
      ),
    );

    expect(ends(find(model, "g").at)).toEqual([
      [0, 0],
      [10, 0],
    ]);
    expect(ends(find(model, "g/dot").at)).toEqual([
      [0, 0],
      [5, 5],
    ]);
  });

  test("text that changes its words crossfades; text that keeps them moves", () => {
    const label = (words: string, x: number) => (
      <Text key="t" font={mono} size={10} fill="#ffffff" at={[x, 20]}>
        {words}
      </Text>
    );

    const same = made(() => morph(label("one", 0), label("one", 30), span(0, 1)));

    expect(find(same, "t").kind).toBe("text");

    const changed = made(() => morph(label("one", 0), label("two", 30), span(0, 1)));
    const group = find(changed, "t");

    if (group.kind !== "group") throw new Error("expected a group");
    expect(ends(group.at)).toEqual([
      [0, 20],
      [30, 20],
    ]);
    expect(group.children.map((child) => child.key)).toEqual(["t/0", "t/1"]);
    expect(group.children.map((child) => ends(child.layers[0]!.opacity))).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  test("text whose words come back in a chain reuses the run that drew them", () => {
    const label = (words: string) => (
      <Text key="t" font={mono} size={10} fill="#ffffff" at={[0, 20]}>
        {words}
      </Text>
    );

    const model = made(() =>
      morph.between(["one", "two", "one", "two"].map(label), [
        span(0, 1),
        span(1.5, 1),
        span(3, 0.5),
      ]),
    );

    const group = find(model, "t");

    if (group.kind !== "group") throw new Error("expected a group");
    expect(group.children.map((child) => child.key)).toEqual(["t/0", "t/1"]);
    expect(
      group.children.map((child) => lane(child.layers[0]!.opacity).keys.map((key) => key.value)),
    ).toEqual([
      [1, 0, 0, 1, 1, 0, 0],
      [0, 1, 1, 0, 0, 1, 1],
    ]);
  });

  test("a chain of states goes through each in turn, and inside a Sequence on its clock", () => {
    const at = (x: number) => <Shape fill="#000000" key="a" geometry={rect(1, 1)} at={[x, 0]} />;

    const chain = shape(
      made(() => morph.between([at(0), at(10), at(20)], [span(0, 1), span(2, 1)]), 4),
      "a",
    );

    expect(lane(chain.at).keys.map((key) => [key.t, key.value[0]])).toEqual([
      [0, 0],
      [1, 10],
      [2, 10],
      [3, 20],
      [4, 20],
    ]);

    const placed = shape(
      made(() => <Sequence when={span(1)}>{morph(at(0), at(10), span(1, 1))}</Sequence>),
      "a",
    );

    expect(lane(placed.at).keys.map((key) => key.t)).toEqual([0, 2, 3, 4]);
  });

  test("a spring moves geometry and points, and colors take the default curve", () => {
    const a = shape(
      made(() =>
        morph(
          <Shape key="a" geometry={circle(10)} fill="#ff0000" />,
          <Shape key="a" geometry={rect(30, 20)} at={[40, 0]} fill="#00ff00" />,
          span(0, 3),
          { curve: ease.spring({ stiffness: 170, damping: 14 }) },
        ),
      ),
      "a",
    );

    expect(lane(a.at).keys.length).toBeGreaterThan(4);
    expect(Math.max(...lane(a.at).keys.map((key) => key.value[0]))).toBeGreaterThan(40);
    expect(lane(a.geometry).keys.length).toBeGreaterThan(4);
    expect(lane(a.fill).keys[1]!.ease).toEqual(ease.out);
  });

  test("morph.between takes a curve per transition", () => {
    const a = shape(
      made(() =>
        morph.between(
          [
            <Shape key="a" geometry={rect(10, 10)} at={[0, 0]} fill="#ff0000" />,
            <Shape key="a" geometry={rect(10, 10)} at={[10, 0]} fill="#ff0000" />,
            <Shape key="a" geometry={rect(10, 10)} at={[20, 0]} fill="#ff0000" />,
          ],
          [span(0, 1), span(2, 1)],
          { curve: [ease.linear, ease.in] },
        ),
      ),
      "a",
    );

    const { keys } = lane(a.at);

    expect([keys[1]!.ease, keys[3]!.ease]).toEqual([ease.linear, ease.in]);
  });

  test("a morph and a track take the same default curve", () => {
    const morphed = shape(
      made(() =>
        morph(
          <Shape key="a" geometry={circle(10)} fill="#ff0000" />,
          <Shape key="a" geometry={circle(10)} fill="#00ff00" />,
          span(0, 1),
        ),
      ),
      "a",
    );

    expect(lane(morphed.fill).keys[1]!.ease).toEqual(ease.out);

    const moved = shape(
      made(() => (
        <Shape
          key="b"
          geometry={circle(10)}
          fill="#ff0000"
          at={track([0, 0] as const).to([10, 0] as const, span(0, 1))}
        />
      )),
      "b",
    );

    expect(lane(moved.at).keys[1]!.ease).toEqual(ease.out);
  });

  test("a stagger starts each changing sibling later, with what it holds, and all end by the span's end", () => {
    const bars = (h: number) =>
      ["a", "b", "c"].map((key) => (
        <Group key={key}>
          <Shape fill="#000000" key="bar" geometry={rect(5, h)} />
          <Shape fill="#000000" key="dot" geometry={circle(h / 4)} />
        </Group>
      ));

    const model = made(() => morph(bars(10), bars(20), span(1, 1), { stagger: 0.25 }));
    const times = (key: string) => lane(shape(model, key).geometry).keys.map((k) => k.t);

    expect(times("a/bar")).toEqual([0, 1, 1.5, 4]);
    expect(times("a/dot")).toEqual([0, 1, 1.5, 4]);
    expect(times("c/bar")).toEqual([0, 1.5, 2, 4]);
    expect(() => made(() => morph(bars(10), bars(20), span(1, 1), { stagger: 0.5 }))).toThrow(
      "delays the last of the 3 things",
    );
  });

  test("a stagger function gives each changing sibling its own delay, and must return 0 or more", () => {
    const bars = (h: number) =>
      ["a", "b", "c"].map((key) => <Shape fill="#000000" key={key} geometry={rect(5, h)} />);

    const model = made(() =>
      morph(bars(10), bars(20), span(1, 1), { stagger: (i, count) => (count - 1 - i) * 0.25 }),
    );

    const times = (key: string) => lane(shape(model, key).geometry).keys.map((k) => k.t);

    expect(times("c")).toEqual([0, 1, 1.5, 4]);
    expect(times("a")).toEqual([0, 1.5, 2, 4]);
    expect(() => made(() => morph(bars(10), bars(20), span(1, 1), { stagger: () => -1 }))).toThrow(
      "delay of 0 or more seconds",
    );
  });

  test("each makes every changing sibling move for that long, spread over the span without a stagger", () => {
    const bars = (h: number) =>
      ["a", "b", "c"].map((key) => <Shape fill="#000000" key={key} geometry={rect(5, h)} />);

    const model = made(() => morph(bars(10), bars(20), span(1, 1), { each: 0.4 }));
    const times = (key: string) => lane(shape(model, key).geometry).keys.map((k) => k.t);

    for (const [key, start] of [
      ["a", 1],
      ["b", 1.3],
      ["c", 1.6],
    ] as const) {
      const [, from, to] = times(key);

      expect(from).toBeCloseTo(start, 5);
      expect(to).toBeCloseTo(start + 0.4, 5);
    }
  });

  test("each starts at the stagger delay when both are given", () => {
    const bars = (h: number) =>
      ["a", "b", "c"].map((key) => <Shape fill="#000000" key={key} geometry={rect(5, h)} />);

    const model = made(() => morph(bars(10), bars(20), span(1, 1), { stagger: 0.25, each: 0.4 }));
    const times = (key: string) => lane(shape(model, key).geometry).keys.map((k) => k.t);

    expect(times("a").slice(1, 3)).toEqual([1, 1.4]);
    expect(times("c")[1]).toBeCloseTo(1.5, 5);
    expect(times("c")[2]).toBeCloseTo(1.9, 5);
  });

  test("each throws when longer than the span, past it with the stagger, or not above 0", () => {
    const bars = (h: number) =>
      ["a", "b", "c"].map((key) => <Shape fill="#000000" key={key} geometry={rect(5, h)} />);

    const build = (options: { stagger?: number; each: number }) => () =>
      made(() => morph(bars(10), bars(20), span(1, 1), options));

    expect(build({ each: 1.5 })).toThrow("longer than its");
    expect(build({ stagger: 0.4, each: 0.5 })).toThrow("ends after the");

    for (const each of [0, -1, Number.NaN]) expect(build({ each })).toThrow("more than 0 seconds");
  });

  test("a track the states agree on is kept; one that differs between states throws, naming the key", () => {
    const spin = track(0).to(90, span(0, 1));

    const kept = shape(
      made(() =>
        morph(
          <Shape fill="#000000" key="a" geometry={rect(1, 1)} rotate={spin} />,
          <Shape fill="#000000" key="a" geometry={rect(1, 1)} rotate={spin} at={[5, 0]} />,
          span(2, 1),
        ),
      ),
      "a",
    );

    expect(ends(kept.layers[0]!.rotate)).toEqual([0, 90]);

    expect(() =>
      made(() =>
        morph(
          <Shape fill="#000000" key="a" geometry={rect(1, 1)} rotate={spin} />,
          <Shape fill="#000000" key="a" geometry={rect(1, 1)} rotate={45} />,
          span(2, 1),
        ),
      ),
    ).toThrow(`morph() can't blend the rotate of <Shape> "a"`);
  });

  test("errors name the key and say what to write", () => {
    expect(() =>
      made(() =>
        morph(
          <Shape fill="#000000" key="a" geometry={rect(1, 1)} />,
          <Text key="a" font={mono} size={10} fill="#ffffff">
            x
          </Text>,
          span(0, 1),
        ),
      ),
    ).toThrow(`morph() can't turn the node keyed "a" from a shape into a text`);

    expect(() =>
      made(() =>
        morph(
          <Shape fill="#000000" geometry={rect(1, 1)} />,
          <Text font={mono} size={10} fill="#ffffff">
            x
          </Text>,
          span(0, 1),
        ),
      ),
    ).toThrow("matched by its place among its siblings");

    expect(() =>
      made(() =>
        morph(
          [<Shape fill="#000000" geometry={rect(1, 1)} />],
          [
            <Shape fill="#000000" geometry={rect(1, 1)} />,
            <Shape fill="#000000" geometry={rect(2, 2)} />,
          ],
          span(0, 1),
        ),
      ),
    ).toThrow("the states have 1, 2 nodes with no key");

    expect(() =>
      made(() =>
        morph(
          <Shape key="a" geometry={rect(1, 1)} stroke={{ color: "#ffffff", cap: "round" }} />,
          <Shape key="a" geometry={rect(1, 1)} stroke={{ color: "#ffffff" }} />,
          span(0, 1),
        ),
      ),
    ).toThrow(`morph() can't blend <Shape> "a": its stroke's cap`);

    expect(() =>
      morph.between(
        [<Shape fill="#000000" geometry={rect(1, 1)} />, null, null],
        [span(0, 2), span(1, 1)],
      ),
    ).toThrow("span 2 starts at 1s, before span 1 ends at 2s");
    expect(() => morph.between([null, null], [])).toThrow("one span per transition");
  });

  test("the SVG is a plain animated picture", () => {
    const out = svg.emit(
      made(() =>
        morph(
          <Shape key="a" geometry={circle(10)} anchor="center" at={[20, 20]} fill="#ff0000" />,
          <Shape key="a" geometry={rect(40, 20)} at={[60, 30]} fill="#0000ff" />,
          span(1, 1),
        ),
      ),
    );

    expect(out).toContain('attributeName="d"');
    expect(out).toContain("@keyframes");
  });
});

describe("morph ids", () => {
  test("a node keeps the id its states agree on", () => {
    const model = made(() => (
      <Group>
        {morph(
          <Shape key="a" id="shape" geometry={rect(10, 10)} at={[0, 0]} fill="#ff0000" />,
          <Shape key="a" id="shape" geometry={rect(40, 20)} at={[50, 30]} fill="#0000ff" />,
          span(1, 2),
        )}
        <Arrow key="link" from={ref("shape").right} to={[100, 20]} stroke={{ color: "#000000" }} />
      </Group>
    ));

    expect(shape(model, "a").id).toBe("shape");
    expect(svg.emit(model, { ids: true })).toContain('data-svz-id="shape"');
  });

  test("states with different ids fail", () => {
    expect(() =>
      made(() =>
        morph(
          <Shape key="a" id="one" geometry={rect(10, 10)} fill="#ff0000" />,
          <Shape key="a" id="two" geometry={rect(40, 20)} fill="#0000ff" />,
          span(1, 2),
        ),
      ),
    ).toThrow(SceneError);
  });
});

describe("different paths", () => {
  const one = path.parse("M0 0 C5 5 10 5 10 0 L10 10 Z");
  const two = path.parse("M0 0 L10 0 L10 10 Z M20 20 L30 20 L30 30 L20 30 Z");
  const times = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4];

  const readers = (model: Model.Scene, key: string) => {
    const node = shape(model, key);

    for (const t of times) {
      const drawn = valueAt(node.geometry, t, mixGeometry);

      expect(drawn.kind).toBe("path");
      expect(boxesOf(model, t)[key]!.width).toBeGreaterThan(0);
    }

    expect(() => describeScene(model, times)).not.toThrow();
    expect(() => check(model).problems).not.toThrow();
    expect(() => svg.emit(model)).not.toThrow();
  };

  test("a morph between two paths of other shapes blends at every time", () => {
    readers(
      made(() =>
        morph(
          <Shape key="a" geometry={one} fill="#ff0000" />,
          <Shape key="a" geometry={two} fill="#0000ff" />,
          span(1, 2),
        ),
      ),
      "a",
    );
  });

  test("a track through paths, a rect and a circle blends at every time, stepped too", () => {
    readers(
      made(() => (
        <Shape
          key="a"
          geometry={track(rect(10, 10))
            .to(two, span(0, 1))
            .to(circle(5), span(1, 1), ease.steps(3))
            .to(one, span(2, 1))}
          fill="#ff0000"
        />
      )),
      "a",
    );
  });

  test("paths with other fill rules don't blend", () => {
    const contours: Model.Contour[] = [
      {
        start: [0, 0],
        curves: [
          [
            [1, 0],
            [2, 0],
            [3, 0],
          ],
        ],
        closed: true,
      },
    ];

    const nonzero: Model.Geometry = { kind: "path", rule: "nonzero", contours };

    expect(() => mixGeometry(nonzero, { ...nonzero, rule: "evenodd" }, 0.5, "a")).toThrow(
      "This is a bug in svjeez",
    );
  });
});

describe("boxes and hit tests", () => {
  const picture = () =>
    made(() => (
      <Group>
        <Shape fill="#000000" key="back" geometry={rect(200, 100)} />
        <Group key="card" offset={[50, 20]}>
          <Shape fill="#000000" key="face" geometry={rect(40, 40)} />
          <Shape fill="#000000" key="pip" geometry={circle(5)} anchor="center" at={[20, 20]} />
        </Group>
        <Shape fill="#000000" key="ghost" geometry={rect(200, 100)} opacity={0} />
        <Shape
          fill="#000000"
          key="mover"
          geometry={rect(10, 10)}
          at={track<Model.Vec>([150, 10]).to([150, 70], span(0, 1))}
        />
      </Group>
    ));

  test("boxesOf places every node in the scene's coordinates, at rest or at a time", () => {
    const boxes = boxesOf(picture());

    expect(boxes.root).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(boxes["card"]).toEqual({ x: 50, y: 20, width: 40, height: 40 });
    expect(boxes["card/pip"]).toEqual({ x: 65, y: 35, width: 10, height: 10 });
    expect(boxesOf(picture(), 2).mover).toEqual({ x: 150, y: 70, width: 10, height: 10 });
  });

  test("hitTest finds the deepest, topmost node shown under a point", () => {
    const model = picture();

    expect(hitTest(model, [70, 40])?.key).toBe("card/pip");
    expect(hitTest(model, [52, 22])?.key).toBe("card/face");
    expect(hitTest(model, [5, 5])?.key).toBe("back");
    expect(hitTest(model, [155, 15])?.key).toBe("mover");
    expect(hitTest(model, [155, 15], 2)?.key).toBe("back");
    expect(hitTest(model, [500, 500])).toBeUndefined();
  });
});

describe("source locations", () => {
  const source = { fileName: "/scene.tsx", lineNumber: 7, columnNumber: 5 };

  const written = () =>
    made(() =>
      jsxDEV(Group, {
        children: [
          jsxDEV(Shape, { fill: "#000000", geometry: rect(1, 1) }, "a", false, source),
          jsx(Shape, { fill: "#000000", geometry: rect(1, 1) }, "b"),
        ],
      }),
    );

  test("the development runtime records where each element was written, and lowering carries it", () => {
    const model = written();

    expect(find(model, "a").source).toEqual({ file: "/scene.tsx", line: 7, column: 5 });
    expect(find(model, "b").source).toBeUndefined();
  });

  test("the SVG backend writes keys and sources only when asked", () => {
    const model = written();

    expect(svg.emit(model)).not.toContain("data-");
    const out = svg.emit(model, { sources: true });

    expect(out).toContain('data-key="a" data-source="/scene.tsx:7:5"');
    expect(out).toContain('data-key="b"');
  });

  test("a morph's node keeps the source of the first state it is in", () => {
    const model = made(() =>
      morph(
        jsxDEV(Shape, { fill: "#000000", geometry: rect(1, 1) }, "a", false, source),
        jsxDEV(Shape, { fill: "#000000", geometry: rect(2, 2) }, "a", false, {
          ...source,
          lineNumber: 9,
        }),
        span(0, 1),
      ),
    );

    expect(find(model, "a").source?.line).toBe(7);
    expect(hitTest(model, [0.5, 0.5])?.source?.line).toBe(7);
  });
});

describe("morph between containers", () => {
  const card = (key: string, width = 40) => (
    <Shape key={key} geometry={rect(width, 20)} fill="#123456" />
  );

  const board = (left: string[], right: string[]) => (
    <Stack key="board" direction="row" gap={20}>
      <Stack key="todo" gap={10} width={60}>
        {left.map((key) => card(key))}
      </Stack>
      <Stack key="doing" gap={10} width={60}>
        {right.map((key) => card(key))}
      </Stack>
    </Stack>
  );

  const moving = (a: SceneElement, b: SceneElement): Model.Scene =>
    scene({ size: [200, 100], duration: 4, title: "Test" }, () => morph(a, b, span(1, 2)));

  test("a key that changes containers travels from its old box to its new one, above the columns", () => {
    const model = moving(board(["a", "b"], ["c"]), board(["b"], ["c", "a"]));

    const at = (t: number): [number, number] => {
      const box = boxesOf(model, t)["board/doing/a"];

      if (!box) throw new Error("board/doing/a has no box");

      return [box.x, box.y];
    };

    const [from, mid, to] = [at(0), at(2), at(4)];

    expect(from[0]).toBeLessThan(to[0]);
    expect(to[1]).toBeGreaterThan(from[1]);
    expect(mid[0]).toBeGreaterThan(from[0]);
    expect(mid[0]).toBeLessThan(to[0]);
    expect(mid[1]).toBeGreaterThan(from[1]);
    expect(mid[1]).toBeLessThan(to[1]);
  });

  test("it moves instead of fading, and siblings reflow by moving", () => {
    const model = moving(board(["a", "b"], ["c"]), board(["b"], ["c", "a"]));
    const a = find(model, "board/doing/a");
    const b = find(model, "board/todo/b");

    expect(a.layers).toHaveLength(0);
    expect(isLane(a.at)).toBe(true);
    expect(b.layers).toHaveLength(0);
    expect(isLane(b.at)).toBe(true);
  });

  test("the travelling node is drawn after both containers", () => {
    const model = moving(board(["a"], []), board([], ["a"]));
    const root = find(model, "board");

    if (root.kind !== "group") throw new Error("board is not a group");

    expect(root.children.map((child) => child.key)).toEqual([
      "board/todo",
      "board/doing",
      "board/doing/a",
    ]);
  });

  test("a key that repeats inside a state keeps matching per parent", () => {
    const model = moving(board(["a"], ["a"]), board([], ["a"]));
    const todo = find(model, "board/todo/a");

    expect(todo.layers.length).toBeGreaterThan(0);
    expect(isLane(find(model, "board/doing/a").layers[0]?.opacity)).toBe(false);
  });

  test("a node that would leave a container that clips fades out and in instead of travelling", () => {
    const clipped = (left: string[], right: string[]) => (
      <Stack key="board" direction="row" gap={20}>
        <Stack key="todo" gap={10} width={60} clip={rect(60, 60)}>
          {left.map((key) => card(key))}
        </Stack>
        <Stack key="doing" gap={10} width={60}>
          {right.map((key) => card(key))}
        </Stack>
      </Stack>
    );

    const model = moving(clipped(["a"], []), clipped([], ["a"]));

    expect(find(model, "board/todo/a").layers.length).toBeGreaterThan(0);
    expect(find(model, "board/doing/a").layers.length).toBeGreaterThan(0);
  });
});
