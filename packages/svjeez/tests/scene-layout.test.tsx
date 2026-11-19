import { describe, expect, test } from "bun:test";
import {
  font,
  Align,
  Arrow,
  Center,
  Grid,
  Group,
  Shape,
  Stack,
  Text,
  arc,
  circle,
  ease,
  enter,
  morph,
  rect,
  ref,
  scene,
  span,
  track,
  type SceneElement,
} from "svjeez";
import { isLane, placements, svg, valueAt, type Model } from "svjeez/tools";

const mono = await font.load(new URL("./fixtures/SpaceMono-Regular.ttf", import.meta.url));

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

const rest = <T,>(value: Model.Animated<T>): T => (isLane(value) ? value.keys[0].value : value);

const placed = (node: Model.SceneNode): Model.Box => {
  const [x, y] = rest(node.at);

  return { ...node.box, x: x + node.box.x, y: y + node.box.y };
};

const sampled =
  <T,>(blend: (a: T, b: T, u: number) => T) =>
  (value: Model.Animated<T>, t: number): T => {
    if (!isLane(value)) return value;
    const keys = value.keys;
    const i = keys.findLastIndex((key) => key.t <= t);
    const [a, b] = [keys[Math.max(0, i)]!, keys[i + 1]];

    if (i < 0 || !b) return a.value;

    return blend(a.value, b.value, (t - a.t) / (b.t - a.t));
  };

const said = (line: Model.TextLine): string => line.runs.map((run) => run.text).join("");

const lerp = (p: number, q: number, u: number): number => p + (q - p) * u;

const at = (value: Model.Animated<Model.Vec>, t: number): Model.Vec =>
  valueAt(value, t, (a, b, u): Model.Vec => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]);

const angleAt = sampled<number>(lerp);

const tip = (model: Model.Scene, key: string, t: number): Model.Vec => {
  const { matrix } = placements(model, t).find((placed) => placed.key === key)!;

  return [matrix[4], matrix[5]];
};

describe("text", () => {
  test("one line is measured with the font, from ascent to descent, its baseline the ascent below its top", () => {
    const node = find(
      made(() => (
        <Text key="t" font={mono} size={20} fill="#000000">
          {"Hello"}
        </Text>
      )),
      "t",
    );

    const { ascent, descent } = mono.metrics;

    expect(node.box.width).toBeCloseTo(mono.measure("Hello", 20));
    expect(node.box.y).toBe(0);
    expect(node.kind === "text" && node.lines[0]!.at[1]).toBeCloseTo(ascent * 20);
    expect(node.box.height).toBeCloseTo((ascent + descent) * 20);
  });

  test("line breaks start lines a lineHeight apart, each with its advances and outline", () => {
    const node = find(
      made(() => (
        <Text key="t" font={mono} size={10} lineHeight={1.5} fill="#000000">
          {"one\ntwo\n\nfour"}
        </Text>
      )),
      "t",
    );

    const top = node.kind === "text" ? node.lines[0]!.at[1] : 0;

    expect(top).toBeCloseTo(mono.metrics.ascent * 10);
    expect(
      node.kind === "text" && node.lines.map((line) => [said(line), Math.round(line.at[1] - top)]),
    ).toEqual([
      ["one", 0],
      ["two", 15],
      ["", 30],
      ["four", 45],
    ]);
    expect(
      node.kind === "text" && node.lines[0]!.runs[0]!.advances.reduce((a, b) => a + b),
    ).toBeCloseTo(mono.measure("one", 10));
    expect(node.kind === "text" && node.lines[3]!.runs[0]!.outline!.length).toBeGreaterThan(0);
  });

  test("a width wraps at spaces, cuts a word too long for a line, and is the column's width", () => {
    const node = find(
      made(() => (
        <Text key="t" font={mono} size={10} width={40} fill="#000000">
          {"aa bb cc dd abcdefghij"}
        </Text>
      )),
      "t",
    );

    if (node.kind !== "text") throw new Error("not text");

    expect(node.lines.map(said)).toEqual(["aa bb", "cc dd", "abcdef", "ghij"]);
    expect(node.lines.every((line) => mono.measure(said(line), 10) <= 40)).toBe(true);
    expect(node.box.width).toBe(40);
  });

  test("align centers each line in its column, which starts at the box's left whatever align says", () => {
    const node = find(
      made(() => (
        <Text key="t" font={mono} size={10} width={60} align="center" fill="#000000">
          {"a\nabc"}
        </Text>
      )),
      "t",
    );

    if (node.kind !== "text") throw new Error("not text");
    const [one, three] = node.lines;

    expect(node.box.x).toBe(0);
    expect(node.box.width).toBe(60);
    expect(one!.at[0]).toBeCloseTo((60 - mono.measure("a", 10)) / 2);
    expect(three!.at[0]).toBeCloseTo((60 - mono.measure("abc", 10)) / 2);
  });

  test("SVG places every line itself, and every line's characters reach the font subset", () => {
    const out = svg.emit(
      made(() => (
        <Text font={mono} size={10} at={[10, 20]} anchor="baseline-left" fill="#000000">
          {"Ab\nQz"}
        </Text>
      )),
    );

    expect(out).toContain('<tspan x="10" y="20">Ab</tspan>');
    expect(out).toMatch(/<tspan x="10" y="3\d(\.\d+)?">Qz<\/tspan>/);
    expect(out).not.toContain("text-anchor");
    const embedded = font(Buffer.from(out.match(/base64,([^)]+)\)/)![1]!, "base64"));

    expect(["A", "b", "Q", "z"].every((char) => embedded.has(char))).toBe(true);
  });
});

describe("containers", () => {
  test("a row places each child's box in its slot, whatever its geometry", () => {
    const model = made(() => (
      <Stack key="row" direction="row" gap={5} align="center" at={[10, 20]}>
        <Shape fill="#000000" key="a" geometry={circle(3)} />
        <Shape fill="#000000" key="b" geometry={rect(10, 20)} />
        <Shape fill="#000000" key="c" geometry={arc({ radius: 4, sweep: 90 })} />
      </Stack>
    ));

    expect(placed(find(model, "row/a"))).toEqual({ x: 10, y: 27, width: 6, height: 6 });
    expect(placed(find(model, "row/b"))).toEqual({ x: 21, y: 20, width: 10, height: 20 });
    expect(placed(find(model, "row/c"))).toEqual({ x: 36, y: 26, width: 8, height: 8 });
    expect(find(model, "row").box).toEqual({ x: 10, y: 20, width: 34, height: 20 });
    expect(find(model, "row").at).toEqual([0, 0]);
  });

  test("padding is inside a column's box, and containers nest", () => {
    const model = made(() => (
      <Stack key="col" padding={[4, 6]} gap={2}>
        <Shape fill="#000000" key="a" geometry={rect(10, 10)} />
        <Stack key="inner" direction="row" gap={1}>
          <Shape fill="#000000" key="b" geometry={rect(3, 3)} />
          <Shape fill="#000000" key="c" geometry={rect(3, 5)} />
        </Stack>
      </Stack>
    ));

    expect(find(model, "col").box).toEqual({ x: 0, y: 0, width: 18, height: 29 });
    expect(placed(find(model, "col/inner"))).toEqual({ x: 4, y: 18, width: 7, height: 5 });
    expect(placed(find(model, "col/inner/c"))).toEqual({ x: 8, y: 18, width: 3, height: 5 });
  });

  test("a grid sizes columns and rows to their largest child and aligns each in its cell", () => {
    const model = made(() => (
      <Grid key="g" columns={2} gap={[2, 4]} justify="end" align="center">
        <Shape fill="#000000" key="a" geometry={rect(10, 4)} />
        <Shape fill="#000000" key="b" geometry={rect(4, 8)} />
        <Shape fill="#000000" key="c" geometry={rect(6, 6)} />
      </Grid>
    ));

    expect(placed(find(model, "g/a"))).toEqual({ x: 0, y: 2, width: 10, height: 4 });
    expect(placed(find(model, "g/b"))).toEqual({ x: 12, y: 0, width: 4, height: 8 });
    expect(placed(find(model, "g/c"))).toEqual({ x: 4, y: 12, width: 6, height: 6 });
    expect(find(model, "g").box).toEqual({ x: 0, y: 0, width: 16, height: 18 });
  });

  test("Align places against the canvas wherever it sits in the tree", () => {
    const model = made(() => (
      <Group key="moved" offset={[30, 40]}>
        <Align key="corner" place="bottom-right" inset={5}>
          <Shape fill="#000000" key="dot" geometry={circle(4)} />
        </Align>
      </Group>
    ));

    const corner = find(model, "moved/corner");
    const dot = placed(find(model, "moved/corner/dot"));
    const [x, y] = rest(corner.at);

    expect([x + 30 + dot.x + dot.width, y + 40 + dot.y + dot.height]).toEqual([195, 95]);
  });

  test("Align against a ref follows it", () => {
    const card = ref();

    const model = made(() => (
      <Group>
        <Shape
          fill="#000000"
          key="card"
          ref={card}
          geometry={rect(20, 10)}
          at={track([0, 0]).to([100, 0], span(0, 2))}
        />
        <Align key="label" to={card} place="top">
          <Shape fill="#000000" key="dot" geometry={circle(2)} />
        </Align>
      </Group>
    ));

    const label = find(model, "label");

    expect(at(label.at, 0)[0]).toBeCloseTo(10, 6);
    expect(at(label.at, 0)[1]).toBeCloseTo(0, 6);
    expect(at(label.at, 4)[0]).toBeCloseTo(110, 1);
  });

  test("a child that brings its own at, still or moving, is told the container places it", () => {
    for (const where of [[1, 1] as const, track([0, 0]).to([1, 1], span(0, 1))])
      expect(() =>
        made(() => (
          <Stack key="s">
            <Shape fill="#000000" key="a" geometry={circle(3)} anchor="center" at={where} />
          </Stack>
        )),
      ).toThrow('<Shape> "a" has its own at, but the <Stack> it sits in places it');
  });

  test("a child turns around where it was placed, since layout reads its box at rest", () => {
    const model = made(() => (
      <Stack key="s" direction="row">
        <Shape fill="#000000" key="a" geometry={rect(10, 10)} />
        <Shape
          fill="#000000"
          key="b"
          geometry={rect(10, 10)}
          rotate={track(0).to(360, span(0, 2), ease.linear).loop(2)}
          motion={{ offset: [0, 5] }}
        />
      </Stack>
    ));

    const b = find(model, "s/b");

    expect(placed(b)).toEqual({ x: 10, y: 0, width: 10, height: 10 });
    expect(b.origin).toEqual([5, 5]);
  });
});

describe("containers that draw themselves", () => {
  test("a stack with a fill and a stroke draws a background sized to its content, under it", () => {
    const model = made(() => (
      <Stack
        key="card"
        padding={4}
        gap={2}
        fill="#eeeeee"
        stroke={{ color: "#000000", width: 2 }}
        radius={3}
        at={[10, 10]}
      >
        <Shape fill="#000000" key="a" geometry={rect(20, 10)} />
        <Shape fill="#000000" key="b" geometry={rect(10, 10)} />
      </Stack>
    ));

    const card = find(model, "card");
    const background = find(model, "card/background");

    expect(card.kind === "group" && card.children[0]?.key).toBe("card/background");
    expect(card.box).toEqual({ x: 10, y: 10, width: 32, height: 34 });
    expect(placed(background)).toEqual(card.box);
    expect(background.kind === "shape" && background.geometry).toEqual({
      kind: "rect",
      size: [30, 32],
      radius: [3, 3, 3, 3],
    });
    expect(background.authored?.backdrop).toBe(true);
    expect(placed(find(model, "card/a"))).toEqual({ x: 16, y: 16, width: 20, height: 10 });
  });

  test("an unstroked child starts at the stroke's inner edge, never under it", () => {
    const model = made(() => (
      <Stack key="window" fill="#ffffff" stroke={{ color: "#000000", width: 1.5 }}>
        <Shape fill="#000000" key="bar" geometry={rect(40, 10)} />
      </Stack>
    ));

    const outline = find(model, "window/background");
    const bar = placed(find(model, "window/bar"));
    const geometry = outline.kind === "shape" ? rest(outline.geometry) : undefined;
    const [x] = rest(outline.at);

    expect(geometry?.kind === "rect" && x + geometry.size[0] + 0.75).toBe(bar.x + bar.width + 1.5);
    expect(bar).toEqual({ x: 1.5, y: 1.5, width: 40, height: 10 });
  });

  test("justify spreads a row of fixed width, and a row too narrow for its children says so", () => {
    const row = (width: number) =>
      made(() => (
        <Stack
          key="row"
          direction="row"
          justify="spread"
          align="center"
          width={width}
          height={20}
          padding={[5, 0]}
        >
          <Shape fill="#000000" key="a" geometry={rect(10, 10)} />
          <Shape fill="#000000" key="b" geometry={rect(10, 6)} />
          <Shape fill="#000000" key="c" geometry={rect(10, 10)} />
        </Stack>
      ));

    const model = row(100);

    expect(placed(find(model, "row/a"))).toEqual({ x: 5, y: 5, width: 10, height: 10 });
    expect(placed(find(model, "row/b"))).toEqual({ x: 45, y: 7, width: 10, height: 6 });
    expect(placed(find(model, "row/c"))).toEqual({ x: 85, y: 5, width: 10, height: 10 });
    expect(find(model, "row").box).toEqual({ x: 0, y: 0, width: 100, height: 20 });

    const end = made(() => (
      <Stack key="col" justify="end" height={50}>
        <Shape fill="#000000" key="a" geometry={rect(10, 10)} />
      </Stack>
    ));

    expect(placed(find(end, "col/a"))).toEqual({ x: 0, y: 40, width: 10, height: 10 });
    expect(() => row(30)).toThrow(
      '<Stack> "row" is 30 wide, but its children, gaps and padding need 40. Make it wider, or leave out width so it fits them.',
    );
  });

  test("Center lays its children over each other, centered, and can draw a pill around them", () => {
    const model = made(() => (
      <Center key="pill" width={60} height={24} radius={12} fill="#cccccc" at={[20, 30]}>
        <Shape fill="#000000" key="dot" geometry={circle(4)} />
        <Shape fill="#000000" key="bar" geometry={rect(30, 2)} />
      </Center>
    ));

    expect(find(model, "pill").box).toEqual({ x: 20, y: 30, width: 60, height: 24 });
    expect(placed(find(model, "pill/dot"))).toEqual({ x: 46, y: 38, width: 8, height: 8 });
    expect(placed(find(model, "pill/bar"))).toEqual({ x: 35, y: 41, width: 30, height: 2 });
    expect(placed(find(model, "pill/background"))).toEqual(find(model, "pill").box);

    const fitted = made(() => (
      <Center key="c" padding={[6, 2]}>
        <Shape fill="#000000" key="a" geometry={rect(10, 4)} />
        <Shape fill="#000000" key="b" geometry={rect(4, 10)} />
      </Center>
    ));

    expect(find(fitted, "c").box).toEqual({ x: 0, y: 0, width: 22, height: 14 });
  });

  test("a grid draws its background too, and tracks recolor a container's fill and stroke", () => {
    const model = made(() => {
      const fill = track<`#${string}`>("#000000").to("#ff0000", span(0, 1));
      const color = track<`#${string}`>("#ffffff").to("#00ff00", span(0, 1));

      return (
        <Grid key="grid" columns={2} gap={2} padding={2} fill={fill} stroke={{ color }}>
          <Shape fill="#000000" key="a" geometry={rect(10, 10)} />
          <Shape fill="#000000" key="b" geometry={rect(10, 10)} />
        </Grid>
      );
    });

    const background = find(model, "grid/background");

    expect(find(model, "grid").box).toEqual({ x: 0, y: 0, width: 28, height: 16 });
    expect(background.kind === "shape" && isLane(background.fill!)).toBe(true);
    expect(background.kind === "shape" && isLane(background.stroke!.color)).toBe(true);
  });

  test("align stretch widens each container child to the stack's inner width, in a morph too", () => {
    const window = () => (
      <Stack key="w" align="stretch" fill="#ffffff" stroke={{ color: "#000000", width: 2 }}>
        <Stack key="bar" direction="row" padding={2} fill="#cccccc">
          <Shape fill="#000000" key="dot" geometry={circle(2)} />
        </Stack>
        <Shape fill="#000000" key="body" geometry={rect(40, 10)} />
      </Stack>
    );

    const model = made(window);

    expect(placed(find(model, "w/bar"))).toEqual({ x: 2, y: 2, width: 40, height: 8 });
    expect(placed(find(model, "w/bar/background"))).toEqual({ x: 2, y: 2, width: 40, height: 8 });

    const morphed = made(() => morph(window(), window(), span(1, 1)));

    expect(placed(find(morphed, "w/bar"))).toEqual({ x: 2, y: 2, width: 40, height: 8 });
  });

  test("a child keyed background in a painted container is an error that names it", () => {
    expect(() =>
      made(() => (
        <Stack key="s" fill="#000000">
          <Shape fill="#000000" key="background" geometry={rect(10, 10)} />
        </Stack>
      )),
    ).toThrow('A child of <Stack> "s" is keyed "background"');
  });

  test("the background follows the container's own motion and is drawn first in the SVG", () => {
    const model = made(() => (
      <Stack key="s" fill="#123456" motion={enter(span(0, 1))} padding={4}>
        <Shape fill="#000000" key="a" geometry={rect(10, 10)} />
      </Stack>
    ));

    const out = svg.emit(model);

    expect(out.indexOf("#123456")).toBeLessThan(out.indexOf("#000000"));
  });
});

describe("anchors", () => {
  test("a node later in the tree, in another group, resolves to a still point", () => {
    const target = ref();

    const model = made(() => (
      <Group>
        <Group key="left" offset={[5, 5]}>
          <Shape
            fill="#000000"
            key="pin"
            geometry={circle(1)}
            anchor="center"
            at={target.part("box").bottomRight}
          />
        </Group>
        <Group key="target" ref={target} offset={[50, 20]}>
          <Shape fill="#000000" key="box" geometry={rect(20, 10)} at={[3, 4]} />
        </Group>
      </Group>
    ));

    expect(find(model, "left/pin").at).toEqual([68, 29]);
  });

  test("through a rotated and scaled group, still", () => {
    const target = ref();

    const model = made(() => (
      <Group>
        <Group offset={[100, 50]} rotate={90} scale={2} origin={[0, 0]}>
          <Shape fill="#000000" key="target" ref={target} geometry={rect(10, 4)} />
        </Group>
        <Shape fill="#000000" key="pin" geometry={circle(1)} anchor="center" at={target.right} />
      </Group>
    ));

    const [x, y] = rest(find(model, "pin").at);

    expect(x).toBeCloseTo(96);
    expect(y).toBeCloseTo(70);
  });

  test("a point on a node that moves follows it as a lane of few keys", () => {
    const target = ref();

    const model = made(() => (
      <Group>
        <Group offset={track([0, 0]).to([100, 40], span(1, 2), ease.inOut)}>
          <Shape fill="#000000" key="target" ref={target} geometry={rect(10, 10)} />
        </Group>
        <Group key="other" offset={[7, 3]}>
          <Shape fill="#000000" key="pin" geometry={circle(1)} anchor="center" at={target.center} />
        </Group>
      </Group>
    ));

    const pin = find(model, "other/pin").at;

    expect(isLane(pin)).toBe(true);
    expect(isLane(pin) && pin.keys.length).toBeLessThan(20);

    for (const t of [0, 1.5, 2, 2.5, 4]) {
      const u = t <= 1 ? 0 : t >= 3 ? 1 : undefined;
      const [x, y] = at(pin, t);

      if (u !== undefined) {
        expect(x).toBeCloseTo(-2 + 100 * u, 1);
        expect(y).toBeCloseTo(2 + 40 * u, 1);
      } else expect(y).toBeCloseTo((x + 2) * 0.4 + 2, 0);
    }
  });

  test("a point on a spinning node goes round", () => {
    const target = ref();

    const model = made(() => (
      <Group>
        <Group offset={[100, 50]} rotate={track(0).to(360, span(0, 4), ease.linear).loop(4)}>
          <Shape
            fill="#000000"
            key="target"
            ref={target}
            geometry={circle(2)}
            anchor="center"
            at={[30, 0]}
          />
          <Shape fill="#000000" geometry={circle(2)} anchor="center" at={[-30, 0]} />
        </Group>
        <Shape fill="#000000" key="pin" geometry={circle(1)} anchor="center" at={target.center} />
      </Group>
    ));

    const pin = find(model, "pin").at;

    expect(isLane(pin) && pin.keys.some((key) => key.via)).toBe(true);
    expect(isLane(pin) && pin.keys.length).toBeLessThan(10);

    for (let t = 0; t <= 4; t += 0.05) {
      const [x, y] = at(pin, t);
      const angle = (t / 4) * 2 * Math.PI;

      expect(
        Math.hypot(x - 100 - 30 * Math.cos(angle), y - 50 - 30 * Math.sin(angle)),
      ).toBeLessThan(0.06);
    }
  });

  test("a ref on no node, a part that is not there, and a ref on two nodes are named", () => {
    const lost = ref();
    const card = ref();

    expect(() =>
      made(() => <Shape fill="#000000" geometry={circle(1)} anchor="center" at={lost.center} />),
    ).toThrow("ref().center is a ref that is on no node");
    expect(() =>
      made(() => (
        <Group>
          <Group key="card" ref={card}>
            <Shape fill="#000000" key="title" geometry={rect(1, 1)} />
          </Group>
          <Shape
            fill="#000000"
            geometry={circle(1)}
            anchor="center"
            at={card.part("body").center}
          />
        </Group>
      )),
    ).toThrow(
      '<Group> "card" has no part "body", but ref().part("body").center asks for it. The parts right inside it are "title".',
    );
    expect(() =>
      made(() => (
        <Group>
          <Shape fill="#000000" key="card" ref={card} geometry={circle(1)} />
          <Group>
            <Shape fill="#000000" key="card" ref={card} geometry={circle(1)} />
          </Group>
        </Group>
      )),
    ).toThrow('A ref is on two nodes, <Shape> "card" and <Shape> "card"');
  });

  test("a node anchored to the group it sits in is a loop, and says so", () => {
    const card = ref();

    expect(() =>
      made(() => (
        <Group key="card" ref={card}>
          <Shape fill="#000000" key="a" geometry={rect(10, 10)} />
          <Shape fill="#000000" key="b" geometry={circle(1)} anchor="center" at={card.right} />
        </Group>
      )),
    ).toThrow("depends on itself");
  });
});

describe("arrows", () => {
  const a = ref();
  const b = ref();

  test("between two still nodes it is still geometry, stopping gap short of each edge", () => {
    const model = made(() => (
      <Group>
        <Shape fill="#000000" key="a" ref={a} geometry={rect(20, 20)} at={[0, 0]} />
        <Shape fill="#000000" key="b" ref={b} geometry={rect(20, 20)} at={[100, 0]} />
        <Arrow key="link" from={a.right} to={b.left} inset={5} stroke={{ color: "#000000" }} />
      </Group>
    ));

    const shaft = find(model, "link/shaft");
    const head = find(model, "link/head");

    expect(shaft.kind === "shape" && shaft.geometry).toEqual({
      kind: "line",
      from: [25, 10],
      to: [95, 10],
    });
    expect(
      head.kind === "shape" && rest(head.geometry).kind === "points" && rest(head.geometry),
    ).toMatchObject({
      points: [expect.anything(), [95, 10], expect.anything()],
    });
  });

  test("an end on a moving node turns and moves the shaft, and trims a straight one to length", () => {
    const model = made(() => (
      <Group>
        <Shape fill="#000000" key="a" ref={a} geometry={rect(20, 20)} />
        <Shape
          fill="#000000"
          key="b"
          ref={b}
          geometry={rect(20, 20)}
          at={track([100, 0]).to([100, 60], span(1, 1))}
        />
        <Arrow key="link" from={a.right} to={b.left} stroke={{ color: "#000000" }} />
      </Group>
    ));

    const shaft = find(model, "link/shaft");
    const head = find(model, "link/head");

    if (shaft.kind !== "shape") throw new Error("not a shape");
    expect(isLane(shaft.geometry)).toBe(false);
    expect(isLane(shaft.trim!)).toBe(true);
    expect(isLane(shaft.layers[0]!.rotate)).toBe(true);
    expect(angleAt(shaft.layers[0]!.rotate, 4)).toBeCloseTo(
      (Math.atan2(60, 80) * 180) / Math.PI,
      1,
    );
    const [x, y] = tip(model, "link/head", 4);

    expect(isLane(head.at)).toBe(false);
    expect(x).toBeCloseTo(100, 1);
    expect(y).toBeCloseTo(70, 1);
    expect(svg.emit(model)).toContain("<line");
  });

  test("a bent shaft that stretches writes its geometry as a lane of matching paths", () => {
    const model = made(() => (
      <Group>
        <Shape fill="#000000" key="a" ref={a} geometry={rect(20, 20)} />
        <Shape
          fill="#000000"
          key="b"
          ref={b}
          geometry={rect(20, 20)}
          at={track([100, 0]).to([160, 0], span(1, 1))}
        />
        <Arrow
          head="none"
          key="link"
          from={a.right}
          to={b.left}
          bend={0.3}
          stroke={{ color: "#000000" }}
        />
      </Group>
    ));

    const shaft = find(model, "link/shaft");

    if (shaft.kind !== "shape" || !isLane(shaft.geometry)) throw new Error("no geometry lane");
    expect(
      shaft.geometry.keys.every(
        (key) =>
          key.value.kind === "path" &&
          key.value.contours.length === 1 &&
          key.value.contours[0]!.curves.length === 1,
      ),
    ).toBe(true);
    expect(shaft.geometry.keys.at(-1)!.value).toMatchObject({
      contours: [{ curves: [[expect.anything(), expect.anything(), [140, 0]]] }],
    });
  });

  test("an arrow holds still while it is hidden, so an end that moves before it draws writes nothing", () => {
    const model = made(() => (
      <Group>
        <Shape fill="#000000" key="a" ref={a} geometry={rect(20, 20)} />
        <Shape
          fill="#000000"
          key="b"
          ref={b}
          geometry={rect(20, 20)}
          at={track([100, 0]).to([100, 60], span(0, 1))}
        />
        <Arrow
          key="link"
          from={a.right}
          to={b.left}
          stroke={{ color: "#000000" }}
          draw={track(0).to(1, span(2, 1))}
        />
      </Group>
    ));

    const shaft = find(model, "link/shaft");

    expect(shaft.layers.every((layer) => !isLane(layer.rotate))).toBe(true);
    expect(isLane(shaft.at)).toBe(false);
  });

  test("the head rides a drawing shaft, hidden until it starts", () => {
    const model = made(() => (
      <Group>
        <Arrow
          key="link"
          from={[0, 0]}
          to={[100, 0]}
          stroke={{ color: "#000000" }}
          draw={track(0).to(1, span(1, 1), ease.linear)}
        />
      </Group>
    ));

    const head = find(model, "link/head");
    const opacity = head.layers[0]!.opacity;

    const keys = isLane(opacity) ? opacity.keys.map((key) => [key.t, key.value]) : [];

    expect(keys.map(([, value]) => value)).toEqual([0, 1]);
    expect(keys[1]![0]).toBeCloseTo(1 + (8 * Math.cos(0.45)) / 100, 2);
    expect(tip(model, "link/head", 1.5)[0]).toBeCloseTo(50, 1);
    expect(tip(model, "link/head", 3)[0]).toBeCloseTo(100, 1);
  });
});
