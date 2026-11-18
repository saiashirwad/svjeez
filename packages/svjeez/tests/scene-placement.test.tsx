/** @jsxImportSource svjeez/scene */
import { describe, expect, test } from "bun:test";
import { font } from "svjeez";
import {
  Align,
  Arrow,
  Group,
  Image,
  Instance,
  Shape,
  Stack,
  Text,
  arc,
  circle,
  ease,
  line,
  morph,
  path,
  picture,
  polygon,
  polyline,
  rect,
  ref,
  scene,
  seq,
  span,
  symbol,
  timeline,
  track,
  type SceneElement,
} from "svjeez/scene";
import {
  boxesOf,
  describe as described,
  hitTest,
  isLane,
  type Model,
  type StrokeProps,
} from "svjeez/scene/tools";

const mono = await font.load(new URL("./fixtures/SpaceMono-Regular.ttf", import.meta.url));

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test" }, build);

/** Where each node's box is in the scene, at rest, rounded to a hundredth. */
const boxes = (build: () => SceneElement, at = 0): Record<string, readonly number[]> =>
  Object.fromEntries(
    Object.entries(boxesOf(made(build), at)).map(([key, { x, y, width, height }]) => [
      key,
      [x, y, width, height].map((n) => Math.round(n * 100) / 100),
    ]),
  );

const pic = picture('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"/>');

describe("at places the anchor point of the box", () => {
  test("a shape's box goes top-left at at, whatever its geometry, and anchor names another point", () => {
    const found = boxes(() => (
      <Group>
        <Shape fill="#000000" key="rect" geometry={rect(20, 10)} at={[10, 10]} />
        <Shape fill="#000000" key="circle" geometry={circle(5)} at={[10, 10]} />
        <Shape fill="#000000" key="centered" geometry={circle(5)} at={[10, 10]} anchor="center" />
        <Shape
          fill="#000000"
          key="corner"
          geometry={rect(20, 10)}
          at={[100, 50]}
          anchor="bottom-right"
        />
        <Shape
          fill="#000000"
          key="share"
          geometry={rect(20, 10)}
          at={[100, 50]}
          anchor={[0.5, 1]}
        />
        <Shape
          fill="#000000"
          key="arc"
          geometry={arc({ radius: 8, sweep: 90 })}
          at={[40, 40]}
          anchor="center"
        />
        <Shape fill="#000000" key="none" geometry={circle(5)} />
      </Group>
    ));

    expect(found.rect).toEqual([10, 10, 20, 10]);
    expect(found.circle).toEqual([10, 10, 10, 10]);
    expect(found.centered).toEqual([5, 5, 10, 10]);
    expect(found.corner).toEqual([80, 40, 20, 10]);
    expect(found.share).toEqual([90, 40, 20, 10]);
    // An arc's box is its whole circle's.
    expect(found.arc).toEqual([32, 32, 16, 16]);
    // Without at, the anchor point sits at the parent's origin.
    expect(found.none).toEqual([0, 0, 10, 10]);
  });

  test("a line, polygon or path with no at stays where its coordinates are; with one, at places its box", () => {
    const curve = path().moveTo([20, 60]).lineTo([60, 20]).lineTo([100, 60]);

    const found = boxes(() => (
      <Group>
        <Shape fill="#000000" key="kept" geometry={curve} />
        <Shape fill="#000000" key="placed" geometry={curve} at={[0, 0]} />
        <Shape fill="#000000" key="line" geometry={line([10, 50], [90, 50])} />
        <Shape
          fill="#000000"
          key="moved"
          geometry={line([10, 50], [90, 50])}
          at={[0, 0]}
          anchor="left"
        />
        <Shape
          fill="#000000"
          key="poly"
          geometry={polygon([
            [5, 5],
            [15, 5],
            [10, 15],
          ])}
          at={[50, 50]}
          anchor="center"
        />
      </Group>
    ));

    expect(found.kept).toEqual([20, 20, 80, 40]);
    expect(found.placed).toEqual([0, 0, 80, 40]);
    expect(found.line).toEqual([10, 50, 80, 0]);
    expect(found.moved).toEqual([0, 0, 80, 0]);
    expect(found.poly).toEqual([45, 45, 10, 10]);
  });

  test("text's at places its box, from the top of its ascent; a baseline anchor names a point on its first baseline", () => {
    const { ascent } = mono.metrics;

    const model = made(() => (
      <Group>
        <Text key="top" font={mono} size={10} at={[10, 20]} fill="#000000">
          Hi
        </Text>
        <Text key="base" font={mono} size={10} at={[10, 20]} anchor="baseline-left" fill="#000000">
          Hi
        </Text>
        <Text
          key="mid"
          font={mono}
          size={10}
          width={40}
          align="end"
          at={[100, 20]}
          anchor="baseline"
          fill="#000000"
        >
          Hi
        </Text>
        <Text key="right" font={mono} size={10} at={[100, 50]} anchor="bottom-right" fill="#000000">
          Hi
        </Text>
      </Group>
    ));

    const found = boxesOf(model);

    expect([found.top!.x, found.top!.y]).toEqual([10, 20]);
    expect(found.base!.x).toBe(10);
    expect(found.base!.y).toBeCloseTo(20 - ascent * 10);
    // A baseline anchor names the middle of the column, whatever align does with the lines in it.
    expect(found.mid!.x).toBeCloseTo(80);
    expect(found.mid!.width).toBe(40);
    expect(found.right!.x + found.right!.width).toBeCloseTo(100);
    expect(found.right!.y + found.right!.height).toBeCloseTo(50);
  });

  test("an image is placed by its box, an instance and a group by their frames unless they have an anchor", () => {
    const dot = symbol(() => <Shape geometry={rect(10, 10)} at={[5, 5]} fill="#FF0000" />);

    const found = boxes(() => (
      <Group>
        <Image key="image" src={pic} at={[10, 10]} anchor="center" />
        <Instance key="frame" of={dot} at={[50, 50]} />
        <Instance key="centered" of={dot} at={[50, 50]} anchor="center" />
        <Group key="group" at={[20, 30]}>
          <Shape fill="#000000" key="a" geometry={rect(10, 10)} />
          <Shape fill="#000000" key="b" geometry={rect(10, 10)} at={[30, 10]} />
        </Group>
        <Group key="middle" at={[100, 50]} anchor="center">
          <Shape fill="#000000" key="a" geometry={rect(10, 10)} at={[5, 5]} />
          <Shape fill="#000000" key="b" geometry={rect(10, 10)} at={[35, 15]} />
        </Group>
      </Group>
    ));

    expect(found.image).toEqual([-10, 0, 40, 20]);
    expect(found.frame).toEqual([55, 55, 10, 10]);
    expect(found.centered).toEqual([45, 45, 10, 10]);
    // A child at [0, 0] lands where the group's at is.
    expect(found["group/a"]).toEqual([20, 30, 10, 10]);
    expect(found["group/b"]).toEqual([50, 40, 10, 10]);
    expect(found.middle).toEqual([80, 40, 40, 20]);
  });

  test("a layout container is placed by its box like any group, and its anchor reads the box it lays out", () => {
    const found = boxes(() => (
      <Stack key="row" direction="row" gap={4} at={[100, 50]} anchor="center">
        <Shape fill="#000000" geometry={rect(10, 10)} />
        <Shape fill="#000000" geometry={rect(10, 20)} />
      </Stack>
    ));

    expect(found.row).toEqual([88, 40, 24, 20]);
  });

  test("a moving at moves the anchor point", () => {
    const model = made(() => (
      <Shape
        fill="#000000"
        key="dot"
        geometry={circle(5)}
        anchor="center"
        at={track<Model.Vec>([20, 20]).to([120, 60], span(0, 2))}
      />
    ));

    const at = model.root.children[0]!.at;

    expect(isLane(at) && at.keys.slice(0, 2).map((key) => key.value)).toEqual([
      [20, 20],
      [120, 60],
    ]);

    const found = boxes(
      () => (
        <Shape
          fill="#000000"
          key="box"
          geometry={rect(10, 10)}
          at={track<Model.Vec>([20, 20]).to([120, 60], span(0, 2))}
          anchor="center"
        />
      ),
      2,
    );

    expect(found.box).toEqual([115, 55, 10, 10]);
  });
});

describe("curved motion keeps its curve when the anchor point is not the frame's origin", () => {
  test("a box centered on a point that goes round, and one that follows it, stay on it", () => {
    const angle = track(0).to(360, span(0, 2), ease.inOut);
    const dot = ref("dot");

    const model = made(() => (
      <Group>
        <Shape
          fill="#000000"
          ref={dot}
          geometry={rect(6, 6)}
          anchor="center"
          at={angle.map((a): [number, number] => [
            100 + 40 * Math.cos((a * Math.PI) / 180),
            50 + 40 * Math.sin((a * Math.PI) / 180),
          ])}
        />
        <Shape fill="#000000" key="tag" geometry={rect(10, 4)} anchor="center" at={dot.center} />
      </Group>
    ));

    const at = model.root.children[0]!.at;

    expect(isLane(at) && at.keys.some((key) => key.via)).toBe(true);

    for (const t of [0, 0.4, 0.9, 1.3, 2]) {
      const { dot: one, tag } = boxesOf(model, t);

      // The dot's center keeps to the circle, and the tag's center to the dot's.
      expect(Math.abs(Math.hypot(one!.x + 3 - 100, one!.y + 3 - 50) - 40)).toBeLessThan(0.1);
      expect(Math.hypot(one!.x + 3 - (tag!.x + 5), one!.y + 3 - (tag!.y + 2))).toBeLessThan(0.1);
    }
  });
});

describe("a box is what the shape paints", () => {
  const stroked = (
    geometry: Parameters<typeof Shape>[0]["geometry"],
    stroke: Omit<StrokeProps, "color">,
  ) =>
    boxes(() => <Shape key="s" geometry={geometry} stroke={{ color: "#000000", ...stroke }} />).s!;

  test("a stroke grows the box by half its width, so at places the painted corner", () => {
    expect(stroked(rect(20, 10), { width: 4 })).toEqual([0, 0, 24, 14]);
    expect(
      boxes(() => (
        <Shape
          key="s"
          geometry={rect(20, 10)}
          at={[10, 10]}
          stroke={{ color: "#000000", width: 4 }}
        />
      )).s,
    ).toEqual([10, 10, 24, 14]);
    expect(stroked(circle(10), { width: 2 })).toEqual([0, 0, 22, 22]);

    // The model keeps the outline's own frame: the rect starts half the stroke in.
    const model = made(() => (
      <Shape geometry={rect(20, 10)} stroke={{ color: "#000000", width: 4 }} />
    ));

    expect(model.root.children[0]!.at).toEqual([2, 2]);
  });

  test("caps: butt stops at the ends, square and round reach half the width past them", () => {
    expect(stroked(line([0, 0], [100, 0]), { width: 10 })).toEqual([0, -5, 100, 10]);
    expect(stroked(line([0, 0], [100, 0]), { width: 10, cap: "square" })).toEqual([
      -5, -5, 110, 10,
    ]);
    expect(stroked(line([0, 0], [100, 0]), { width: 10, cap: "round" })).toEqual([-5, -5, 110, 10]);
    // A slanted butt end reaches only as far as its corners.
    expect(stroked(line([0, 0], [100, 100]), { width: 10 })).toEqual([
      -3.54, -3.54, 107.07, 107.07,
    ]);
  });

  test("joins: a miter reaches its tip, unless that is past the limit of 4, a bevel and a round don't", () => {
    const triangle = polygon([
      [0, 0],
      [100, 0],
      [50, 100],
    ]);

    // The apex's miter: half the width over sin(26.6°) below it.
    expect(stroked(triangle, { width: 10 })[3]).toBeCloseTo(116.18, 1);
    expect(stroked(triangle, { width: 10, join: "round" })).toEqual([-5, -5, 110, 110]);
    expect(stroked(triangle, { width: 10, join: "bevel" })[3]).toBeCloseTo(107.24, 1);

    // A spike too sharp for the limit is beveled, so its tip adds nothing.
    const spike = polyline([
      [0, 0],
      [100, 5],
      [0, 10],
    ]);

    expect(stroked(spike, { width: 10 })[2]).toBeLessThan(101);
  });

  test("a dash or a trim puts caps anywhere along the outline", () => {
    const curve = path().moveTo([0, 0]).curveTo([30, 40], [70, 40], [100, 0]);

    expect(stroked(curve, { width: 4, cap: "round", dash: [4, 4] })).toEqual([-2, -2, 104, 34]);
    expect(stroked(curve, { width: 4 })[1]).toBeGreaterThan(-2);
  });

  test("a stack places painted boxes, so a gap of 0 never overlaps", () => {
    const found = boxes(() => (
      <Stack key="col" gap={0} at={[10, 10]}>
        <Shape key="a" geometry={rect(20, 10)} stroke={{ color: "#000000", width: 2 }} />
        <Shape key="b" geometry={rect(20, 10)} stroke={{ color: "#000000", width: 2 }} />
      </Stack>
    ));

    expect(found["col/a"]).toEqual([10, 10, 22, 12]);
    expect(found["col/b"]).toEqual([10, 22, 22, 12]);
  });

  test("anchors on a ref are on the painted box, and so is a hit", () => {
    const card = ref("card");

    const model = made(() => (
      <Group>
        <Shape
          ref={card}
          geometry={rect(40, 20)}
          at={[10, 10]}
          stroke={{ color: "#000000", width: 6 }}
        />
        <Shape fill="#000000" key="tag" geometry={rect(4, 4)} at={card.right} anchor="left" />
      </Group>
    ));

    expect(boxesOf(model).tag).toEqual({ x: 56, y: 21, width: 4, height: 4 });
    // On the stroke, outside the outline.
    expect(hitTest(model, [11, 11])?.key).toBe("card");
  });
});

describe("timelines move the anchor point", () => {
  test("move takes the point at names to the point given; move to an anchor lands it, or a point measured from it", () => {
    const dot = ref("dot");
    const pin = ref("pin");

    const model = made(() => {
      timeline(
        seq(
          dot.move([100, 50], 1),
          dot.move(pin, 1),
          dot.move(pin, 1, undefined, { point: [5, 0] }),
        ),
      );

      return (
        <Group>
          <Shape fill="#000000" ref={pin} geometry={rect(20, 20)} at={[150, 10]} />
          <Shape fill="#000000" ref={dot} geometry={circle(5)} at={[20, 20]} anchor="center" />
        </Group>
      );
    });

    const at = (t: number) => {
      const { x, y } = boxesOf(model, t).dot!;

      return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
    };

    // The dot's center goes to the point, then onto the pin's center, then its right edge does.
    expect(at(1)).toEqual([95, 45]);
    expect(at(2)).toEqual([155, 15]);
    expect(at(3)).toEqual([150, 15]);
  });

  test("a path drawn by its coordinates starts a move from where they put its box", () => {
    const mark = ref("mark");

    const model = made(() => {
      timeline(mark.moveBy([10, 0], 1));

      return (
        <Shape
          ref={mark}
          geometry={path().moveTo([40, 40]).lineTo([60, 50])}
          stroke={{ color: "#000000", width: 0 }}
        />
      );
    });

    const at = (t: number) => {
      const { x, y } = boxesOf(model, t).mark!;

      return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
    };

    expect(at(0)).toEqual([40, 40]);
    expect(at(1)).toEqual([50, 40]);
  });
});

describe("morph and describe follow the rule", () => {
  test("a node whose anchor changes between states moves so each state's anchor point is where it says", () => {
    const model = made(() =>
      morph(
        <Shape fill="#000000" key="dot" geometry={rect(10, 10)} at={[50, 50]} />,
        <Shape fill="#000000" key="dot" geometry={rect(20, 20)} at={[50, 50]} anchor="center" />,
        span(0, 1),
      ),
    );

    expect(boxesOf(model, 0).dot).toEqual({ x: 50, y: 50, width: 10, height: 10 });
    expect(boxesOf(model, 1).dot).toEqual({ x: 40, y: 40, width: 20, height: 20 });
  });

  test("a group's anchor is read on its box in each state", () => {
    const model = made(() =>
      morph(
        <Group key="g" at={[100, 50]} anchor="center">
          <Shape fill="#000000" key="a" geometry={rect(10, 10)} />
        </Group>,
        <Group key="g" at={[100, 50]} anchor="center">
          <Shape fill="#000000" key="a" geometry={rect(10, 10)} />
          <Shape fill="#000000" key="b" geometry={rect(10, 10)} at={[30, 0]} />
        </Group>,
        span(0, 1),
      ),
    );

    expect(boxesOf(model, 0)["g/a"]).toEqual({ x: 95, y: 45, width: 10, height: 10 });
    expect(boxesOf(model, 1)["g/a"]).toEqual({ x: 80, y: 45, width: 10, height: 10 });
  });

  test("describe says where the box's top-left is, as at wrote it", () => {
    const { frames } = described(
      made(() => (
        <Group>
          <Shape
            key="card"
            geometry={rect(40, 20)}
            at={[30, 20]}
            fill="#FF0000"
            stroke={{ color: "#000000", width: 2 }}
          />
          <Shape key="dot" geometry={circle(5)} at={[100, 50]} anchor="center" fill="#0000FF" />
        </Group>
      )),
      [0],
    );

    const nodes = frames[0]!.nodes;

    expect(nodes.find((node) => node.key === "card")?.box).toEqual([30, 20, 42, 22]);
    expect(nodes.find((node) => node.key === "dot")?.box).toEqual([95, 45, 10, 10]);
  });
});

describe("the nine places", () => {
  const PLACES = [
    ["top-left", "topLeft"],
    ["top", "top"],
    ["top-right", "topRight"],
    ["left", "left"],
    ["center", "center"],
    ["right", "right"],
    ["bottom-left", "bottomLeft"],
    ["bottom", "bottom"],
    ["bottom-right", "bottomRight"],
  ] as const;

  test("each is a ref's anchor and an anchor string, naming the same point", () => {
    const card = ref("card");

    const found = boxes(() => (
      <Group>
        <Shape ref={card} geometry={rect(40, 20)} at={[60, 30]} fill="#000000" />
        {PLACES.map(([place, property]) => (
          <Shape
            key={place}
            geometry={rect(40, 20)}
            at={card[property]}
            anchor={place}
            fill="#000000"
          />
        ))}
      </Group>
    ));

    // The tag's place lands on the card's point of the same name, so a tag of the card's size covers it.
    for (const [place] of PLACES) expect(found[place]).toEqual([60, 30, 40, 20]);
  });

  test("a wrong place, as an anchor or on <Align>, is told the nine", () => {
    const nine = PLACES.map(([place]) => `"${place}"`).join(", ");

    expect(() =>
      made(() => (
        // @ts-expect-error: "middle" is not a place.
        <Align place="middle">
          <Shape fill="#000000" geometry={rect(10, 10)} />
        </Align>
      )),
    ).toThrow(`takes a place, one of ${nine}, got "middle".`);
    expect(() =>
      made(() => (
        // @ts-expect-error: "base" is not a baseline.
        <Text font={mono} size={10} at={[0, 0]} anchor="base" fill="#000000">
          Hi
        </Text>
      )),
    ).toThrow(
      `takes a place, one of ${nine}, or on a text "baseline-left", "baseline" or "baseline-right", or two fractions`,
    );
  });
});

describe("errors say what to write", () => {
  test("an unknown anchor, a baseline off text, and an anchor on an empty box", () => {
    expect(() =>
      // @ts-expect-error: "middle" is not a place.
      made(() => <Shape fill="#000000" key="s" geometry={rect(10, 10)} anchor="middle" />),
    ).toThrow(
      'anchor on "s" takes a place, one of "top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right", or two fractions of the box such as [0.5, 1], got "middle".',
    );
    expect(() =>
      made(() => (
        // @ts-expect-error: only text has a baseline.
        <Shape fill="#000000" key="s" geometry={rect(10, 10)} at={[0, 0]} anchor="baseline" />
      )),
    ).toThrow(
      'anchor="baseline" on "s" names a baseline, which only a <Text> has. Use a place on the box, such as "bottom".',
    );
    expect(() => made(() => <Group key="g" at={[10, 10]} anchor="center" />)).toThrow(
      'anchor on "g" names a point of its box, but the box is empty: it draws nothing at rest. Drop anchor and place it by at alone.',
    );
  });

  test("an anchor on a path with no at, on a container's child, on Align and on a connector", () => {
    expect(() =>
      made(() => (
        <Shape
          key="p"
          geometry={path().moveTo([0, 0]).lineTo([10, 10])}
          anchor="center"
          stroke={{ color: "#000000" }}
        />
      )),
    ).toThrow(
      'anchor on "p" names the point its at places, but it has no at, so it stays where its coordinates put it. Give it an at, or drop anchor.',
    );
    expect(() =>
      made(() => (
        <Stack key="col">
          <Shape fill="#000000" key="a" geometry={rect(10, 10)} anchor="center" />
        </Stack>
      )),
    ).toThrow('"col/a" has anchor="center", but the <Stack> it sits in lines up its box itself.');
    expect(() =>
      made(() => (
        // @ts-expect-error: Align places itself.
        <Align anchor="center">
          <Shape fill="#000000" geometry={rect(10, 10)} />
        </Align>
      )),
    ).toThrow("<Align> places itself against its to, so it takes no anchor.");
    expect(() =>
      made(() => (
        // @ts-expect-error: a connector is placed by its ends.
        <Arrow from={[0, 0]} to={[10, 10]} stroke={{ color: "#000000" }} anchor="center" />
      )),
    ).toThrow("<Arrow> is placed by its from and to, so it takes no anchor.");
  });
});

describe("symbols", () => {
  test("a layout container inside a symbol is laid out, and a group's anchor applies there", () => {
    const row = symbol(() => (
      <Stack direction="row" gap={2} at={[0, 0]} anchor="center">
        <Shape fill="#000000" geometry={rect(10, 10)} />
        <Shape fill="#000000" geometry={rect(10, 10)} />
      </Stack>
    ));

    expect(boxes(() => <Instance key="i" of={row} at={[100, 50]} />).i).toEqual([89, 45, 22, 10]);
  });
});
