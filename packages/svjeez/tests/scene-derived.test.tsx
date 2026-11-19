import { describe, expect, test } from "bun:test";
import {
  Group,
  Sequence,
  Shape,
  circle,
  ease,
  rect,
  ref,
  scene,
  span,
  tokens,
  track,
  type Paint,
  type SceneElement,
  type Vec,
  within,
} from "svjeez";
import { isLane, svg, type Model } from "svjeez/tools";
import { easeAt } from "../src/model/ease-at";
import { blendNumber, blendVec, valueAt } from "../src/model/sample";

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test" }, build);

const only = (model: Model.Scene): Model.SceneNode => model.root.children[0]!;

const own = (node: Model.SceneNode): Model.Layer => node.layers.at(-1)!;

const keysOf = <T,>(value: Model.Animated<T>): readonly Model.Key<T>[] =>
  isLane(value) ? value.keys : [];

const progress = track(0).to(1, span(0.5, 2), ease.inOut).to(0.25, span(3, 0.5));

describe("affine mappings", () => {
  test("keep their source's keys and eases one to one", () => {
    const node = only(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(2)}
          anchor="center"
          at={progress.map((p): Vec => [p * 200, 40])}
        />
      )),
    );

    const source = keysOf(
      own(only(made(() => <Shape fill="#000000" geometry={circle(2)} opacity={progress} />)))
        .opacity,
    );

    expect(keysOf(node.at).map((key) => [key.t, key.value, key.ease])).toEqual(
      source.map((key) => [key.t, [key.value * 200, 40], key.ease]),
    );
  });

  test("a loop stays a loop with its period, and chained maps compose", () => {
    const theta = track(0).to(360, span(0, 2), ease.linear).loop(2);

    const node = only(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(2)}
          rotate={theta.map((t) => -t * 2).map((t) => t + 10)}
        />
      )),
    );

    const rotate = own(node).rotate;

    expect(isLane(rotate) && rotate.period).toBe(2);
    expect(keysOf(rotate).map((key) => key.value)).toEqual([10, -710]);
  });

  test("a mapping that bends inside a move is not affine", () => {
    const node = only(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(2)}
          opacity={progress.map((p) => Math.min(p, 0.5))}
        />
      )),
    );

    expect(keysOf(own(node).opacity).length).toBeGreaterThan(5);

    for (let t = 0; t <= 4; t += 0.05)
      expect(valueAt(own(node).opacity, t, blendNumber)).toBeCloseTo(
        Math.min(
          0.5,
          t < 3
            ? easeAt(ease.inOut, (t - 0.5) / 2)
            : 1 + (0.25 - 1) * easeAt(ease.out, (t - 3) / 0.5),
        ),
        2,
      );
  });

  test("two sources moving on the same keys map key for key", () => {
    const a = track(0).to(10, span(1, 1));
    const b = track(5).to(-5, span(1, 1));

    const node = only(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(2)}
          anchor="center"
          at={a.with(b).map((x, y): Vec => [x + y, x - y])}
        />
      )),
    );

    expect(keysOf(node.at).map((key) => key.value)).toEqual([
      [5, -5],
      [5, -5],
      [5, 15],
      [5, 15],
    ]);
  });

  test("geometry can be derived, keeping its kind", () => {
    const node = only(
      made(() => <Shape fill="#000000" geometry={progress.map((p) => rect(10 + p * 90, 20))} />),
    );

    expect(
      node.kind === "shape" &&
        keysOf(node.geometry).map((key) => key.value.kind === "rect" && key.value.size),
    ).toEqual([
      [10, 20],
      [10, 20],
      [100, 20],
      [100, 20],
      [32.5, 20],
      [32.5, 20],
    ]);
  });
});

describe("windows", () => {
  const draw = track(0).to(1, span(0.5, 2), ease.inOut);

  const windowed = (from: number, to: number) =>
    own(
      only(
        made(() => <Shape fill="#000000" geometry={circle(2)} opacity={within(draw, from, to)} />),
      ),
    ).opacity;

  test("cut an eased step exactly, in two keys around the same ease", () => {
    const lane = windowed(0.25, 0.75);

    const source = own(
      only(made(() => <Shape fill="#000000" geometry={circle(2)} opacity={draw} />)),
    ).opacity;

    expect(keysOf(lane).length).toBeLessThanOrEqual(4);

    for (let t = 0; t <= 4; t += 0.05) {
      const at = valueAt(source, t, blendNumber);

      expect(valueAt(lane, t, blendNumber)).toBeCloseTo(
        Math.min(1, Math.max(0, (at - 0.25) / 0.5)),
        6,
      );
    }
  });

  test("of a plain number is a plain number", () => {
    const node = only(
      made(() => <Shape fill="#000000" geometry={circle(2)} opacity={within(0.5, 0.25, 0.75)} />),
    );

    expect(own(node).opacity).toBe(0.5);
  });

  test("need a start below the end", () => {
    expect(() => within(draw, 0.5, 0.5)).toThrow("not a span");
  });
});

describe("sampled mappings", () => {
  const around = (t: number): Vec => [
    100 + 40 * Math.cos((t * Math.PI) / 180),
    50 + 40 * Math.sin((t * Math.PI) / 180),
  ];

  const angle = track(0).to(360, span(0, 4), ease.inOut);

  test("are fitted to few keys that stay within the tolerance", () => {
    const node = only(
      made(() => (
        <Shape fill="#000000" geometry={circle(2)} anchor="center" at={angle.map(around)} />
      )),
    );

    const keys = keysOf(node.at);

    expect(keys.length).toBeGreaterThan(4);
    expect(keys.length).toBeLessThan(120);

    for (let t = 0; t <= 4; t += 0.01) {
      const [x, y] = valueAt(node.at, t, blendVec);
      const [ex, ey] = around(360 * easeAt(ease.inOut, t / 4));

      expect(Math.hypot(x - ex, y - ey)).toBeLessThan(0.08);
    }
  });

  test("a looping source is sampled over one period and keeps it", () => {
    const node = only(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(2)}
          anchor="center"
          at={track(0).to(360, span(0, 2), ease.linear).loop(2).map(around)}
        />
      )),
    );

    expect(isLane(node.at) && node.at.period).toBe(2);
    expect(keysOf(node.at).at(-1)!.t).toBe(2);
  });

  test("a looser tolerance gives fewer keys", () => {
    const tight = keysOf(
      only(
        made(() => (
          <Shape fill="#000000" geometry={circle(2)} anchor="center" at={angle.map(around)} />
        )),
      ).at,
    ).length;

    const loose = keysOf(
      only(
        made(() => (
          <Shape
            fill="#000000"
            geometry={circle(2)}
            anchor="center"
            at={angle.map(around, { tolerance: 1 })}
          />
        )),
      ).at,
    ).length;

    expect(loose).toBeLessThan(tight);
  });

  test("sources on different keys are sampled together", () => {
    const a = track(0).to(10, span(0, 2), ease.linear);
    const b = track(0).to(10, span(1, 2), ease.linear);

    const node = only(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(2)}
          opacity={a.with(b).map((x, y) => (x + y) / 20)}
        />
      )),
    );

    for (const t of [0.5, 1.5, 2.5])
      expect(valueAt(own(node).opacity, t, blendNumber)).toBeCloseTo(
        (Math.min(t / 2, 1) * 10 + Math.max(0, Math.min((t - 1) / 2, 1)) * 10) / 20,
        3,
      );
  });
});

describe("derived tracks", () => {
  test("follow their sources inside a sequence", () => {
    const node = only(
      made(() => (
        <Sequence when={span(1)}>
          <Shape
            fill="#000000"
            geometry={circle(2)}
            opacity={track(0)
              .to(1, span(0, 1), ease.linear)
              .map((p) => 1 - p)}
          />
        </Sequence>
      )),
    );

    expect(keysOf(own(node).opacity).map((key) => [key.t, key.value])).toEqual([
      [0, 1],
      [1, 1],
      [2, 0],
      [4, 0],
    ]);
  });

  test("of still values are still values", () => {
    const node = only(
      made(() => (
        <Shape
          fill="#000000"
          geometry={circle(2)}
          opacity={track(0.25)
            .with(2)
            .map((a, b) => a * b)}
        />
      )),
    );

    expect(node.layers[0]?.opacity).toBe(0.5);
  });

  test("read only numbers and points, and keep one shape", () => {
    expect(() =>
      made(() => (
        <Shape
          geometry={circle(2)}
          fill={track<"#000000" | "#ffffff">("#000000")
            .to("#ffffff", span(0, 1))
            .map((c) => c)}
        />
      )),
    ).toThrow("derived from a track of something other than numbers or points");

    expect(() =>
      made(() => (
        <Shape
          fill="#000000"
          geometry={track(0)
            .to(1, span(0, 1))
            .map((p) => (p < 0.5 ? rect(10, 10) : circle(4)))}
        />
      )),
    ).toThrow("derived to values of different shapes");
  });

  test("an anchor can be mapped in the frame of the box it is on", () => {
    const model = made(() => {
      const card = ref();

      return (
        <Group>
          <Shape fill="#000000" key="card" ref={card} geometry={rect(20, 10)} at={[10, 10]} />
          <Shape
            fill="#000000"
            geometry={circle(2)}
            anchor="center"
            at={card.right.map(([x, y]): Vec => [x + 5, y])}
          />
        </Group>
      );
    });

    expect(model.root.children[1]!.at).toEqual([35, 15]);
  });
});

describe("a derived value that switches", () => {
  const theme = tokens({
    light: { on: "#FF0000", off: "#0000FF" },
    dark: { on: "#00FF00", off: "#000000" },
  });

  const switched = (on: Paint, off: Paint): readonly Model.Key<Model.Paint>[] => {
    const node = only(
      made(() => <Shape geometry={circle(4)} fill={progress.map((p) => (p > 0.5 ? on : off))} />),
    );

    return node.kind === "shape" && node.fill ? keysOf(node.fill) : [];
  };

  test("holds each color and cuts at the moment it switches", () => {
    const keys = switched("#FF0000", "#0000FF");

    expect(keys.map((key) => key.value)).toEqual([
      [0, 0, 1, 1],
      [1, 0, 0, 1],
      [0, 0, 1, 1],
    ]);
    expect(keys.slice(1).map((key) => key.ease === ease.hold)).toEqual([true, true]);

    const opacity = own(
      only(made(() => <Shape fill="#000000" geometry={circle(2)} opacity={progress} />)),
    ).opacity;

    expect(valueAt(opacity, keys[1]!.t - 1e-6, blendNumber)).toBeLessThanOrEqual(0.5);
    expect(valueAt(opacity, keys[1]!.t + 1e-6, blendNumber)).toBeGreaterThan(0.5);
  });

  test("switches between tokens the same way, and draws", () => {
    const keys = switched(theme.on, theme.off);

    expect(keys.map((key) => key.value)).toEqual([
      { kind: "token", name: "off" },
      { kind: "token", name: "on" },
      { kind: "token", name: "off" },
    ]);
    expect(
      svg.emit(
        made(() => (
          <Shape
            geometry={circle(4)}
            fill={progress.map((p) => (p > 0.5 ? theme.on : theme.off))}
          />
        )),
      ),
    ).toContain("@keyframes");
  });
});
