import { describe, expect, test } from "bun:test";
import {
  Limb,
  Shape,
  blob,
  bounds,
  brush,
  circle,
  limb,
  line,
  merge,
  polygon,
  sampled,
  scatter,
  scene,
  span,
  type Vec,
} from "svjeez";
import { boxesOf, type Model } from "svjeez/tools";
import { isLane } from "../src/model/lane";
import { SceneError } from "../src/model/scene-error";

const apart = (a: Vec, b: Vec): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

const pointCount = (geometry: ReturnType<typeof brush>): number =>
  geometry.kind === "path" ? geometry.contours.reduce((n, c) => n + c.curves.length, 0) : -1;

describe("brush", () => {
  test("spans its centerline and is as wide as asked", () => {
    const box = bounds(
      brush(
        [
          [0, 0],
          [100, 0],
        ],
        10,
      ),
    );

    // Round caps add half a width at each end; the smooth outline overshoots them by under a unit.
    expect(Math.abs(box.width - 110)).toBeLessThan(1);
    expect(Math.abs(box.height - 10)).toBeLessThan(0.5);
  });

  test("tapers from the first width to the last", () => {
    const shape = brush(
      [
        [0, 0],
        [100, 0],
      ],
      [20, 0],
    );

    const start = bounds(
      brush(
        [
          [0, 0],
          [1, 0],
        ],
        20,
      ),
    );

    expect(bounds(shape).height).toBeCloseTo(start.height, 0);
  });

  test("keeps the same outline size for any bend, so it can be sampled", () => {
    const straight = brush(
      [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
      [8, 2],
    );

    const bent = brush(
      [
        [0, 0],
        [50, 40],
        [100, 0],
      ],
      [8, 2],
    );

    expect(pointCount(bent)).toBe(pointCount(straight));
  });

  test("refuses fewer than two points and negative widths", () => {
    expect(() => brush([[0, 0]], 4)).toThrow("two points or more");
    expect(() =>
      brush(
        [
          [0, 0],
          [1, 1],
        ],
        [-1],
      ),
    ).toThrow("widths of 0 or more");
  });
});

describe("brush samples", () => {
  const bend = (dy: number): Vec[] => [
    [0, 0],
    [50, dy],
    [100, 0],
  ];

  test("sets the outline size, the same for any positions", () => {
    const few = pointCount(brush(bend(40), 6, { samples: 4 }));
    const many = pointCount(brush(bend(40), 6, { samples: 20 }));

    expect(few).toBeLessThan(many);
    expect(pointCount(brush(bend(-30), 6, { samples: 4 }))).toBe(few);
    expect(pointCount(brush(bend(0), 6, { samples: 20 }))).toBe(many);
    expect(pointCount(brush(bend(40), 6))).toBe(pointCount(brush(bend(10), 6)));
  });

  test("must be a whole number of 1 or more", () => {
    expect(() => brush(bend(10), 6, { samples: 0 })).toThrow("samples");
    expect(() => brush(bend(10), 6, { samples: 2.5 })).toThrow("samples");
  });
});

describe("brush.at", () => {
  const ends: Vec[] = [
    [10, 20],
    [110, 20],
  ];

  test("reads the endpoints, direction and width of a straight brush", () => {
    const start = brush.at(ends, [8, 2], 0);
    const end = brush.at(ends, [8, 2], 1);
    const mid = brush.at(ends, [8, 2], 0.5);

    expect(start.point).toEqual([10, 20]);
    expect(end.point).toEqual([110, 20]);
    expect(start.width).toBeCloseTo(8);
    expect(end.width).toBeCloseTo(2);
    expect(mid.width).toBeCloseTo(5);
    expect(mid.point[0]).toBeCloseTo(60);
    expect(mid.angle).toBeCloseTo(0);
  });

  test("follows a bent brush and refuses a share outside 0..1", () => {
    const points: Vec[] = [
      [0, 0],
      [50, 40],
      [100, 0],
    ];

    expect(brush.at(points, [3, 9, 3], 0.5).width).toBeCloseTo(9);
    expect(brush.at(points, 4, 0.5).point[1]).toBeGreaterThan(20);
    expect(() => brush.at(points, 4, 1.5)).toThrow("share");
  });
});

describe("blob", () => {
  test("is a closed shape around its points", () => {
    const shape = blob(
      [
        [0, 0],
        [40, 0],
        [40, 30],
        [0, 30],
      ],
      { round: 0 },
    );

    const box = bounds(shape);

    expect(box.width).toBeCloseTo(40, 5);
    expect(box.height).toBeCloseTo(30, 5);
    expect(shape.kind === "path" && shape.contours[0]!.closed).toBe(true);
  });

  test("refuses fewer than three points", () => {
    expect(() =>
      blob([
        [0, 0],
        [1, 1],
      ]),
    ).toThrow("three points or more");
  });
});

describe("limb", () => {
  test("two bones keep their lengths and land on the target", () => {
    const [root, knee, tip] = limb([0, 0], [30, 30], [40, 10]);

    expect(apart(root!, knee!)).toBeCloseTo(30, 1);
    expect(apart(knee!, tip!)).toBeCloseTo(30, 1);
    expect(apart(tip!, [40, 10])).toBeLessThan(0.02);
  });

  test("bend picks the side the joint bows to", () => {
    const right = limb([0, 0], [30, 30], [40, 0], { bend: 1 })[1]!;
    const left = limb([0, 0], [30, 30], [40, 0], { bend: -1 })[1]!;

    expect(right[1]).toBeGreaterThan(0);
    expect(left[1]).toBeLessThan(0);
  });

  test("three bones reach the target with every bone its own length", () => {
    const joints = limb([0, 0], [20, 20, 20], [30, 25]);

    expect(joints).toHaveLength(4);

    for (let i = 0; i < 3; i++) expect(apart(joints[i]!, joints[i + 1]!)).toBeCloseTo(20, 1);

    expect(apart(joints[3]!, [30, 25])).toBeLessThan(0.05);
  });

  test("points straight at a target out of reach", () => {
    const [, knee, tip] = limb([0, 0], [10, 10], [100, 0]);

    expect(knee).toEqual([10, 0]);
    expect(tip).toEqual([20, 0]);
  });
});

describe("scatter", () => {
  const dot = blob([
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]);

  test("places one copy per count along the line", () => {
    const shape = scatter(dot, { along: line([0, 0], [100, 0]), count: 5 });

    expect(shape.kind === "path" && shape.contours.length).toBe(5);
    expect(bounds(shape).width).toBeCloseTo(82, 0);
  });

  test("the same seed scatters the same way", () => {
    const options = { along: circle(20), count: 6, jitter: 0.6, seed: "leaves" };

    expect(scatter(dot, options)).toEqual(scatter(dot, options));
  });

  test("each returns the unmerged copies, which merge into scatter", () => {
    const options = { along: circle(20), count: 6, jitter: 0.6, seed: "leaves" };
    const copies = scatter.each(dot, options);

    expect(copies.length).toBe(6);
    expect(merge(...copies)).toEqual(scatter(dot, options));
  });

  test("refuses a count below one and a jitter outside 0..1", () => {
    expect(() => scatter(dot, { along: line([0, 0], [1, 0]), count: 0 })).toThrow("count of 1");
    expect(() => scatter(dot, { along: line([0, 0], [1, 0]), count: 2, jitter: 2 })).toThrow(
      "jitter",
    );
  });
});

describe("<Limb>", () => {
  const ROOT: Vec = [100, 100];
  const BONES = [60, 50];

  const around = (t: number): Vec => [
    ROOT[0] + (70 + 25 * Math.cos(Math.PI * t)) * Math.cos((2 * Math.PI * t) / 4),
    ROOT[1] + (70 + 25 * Math.cos(Math.PI * t)) * Math.sin((2 * Math.PI * t) / 4),
  ];

  const made = scene({ size: [300, 300], duration: 4, title: "Limb" }, () =>
    Limb({
      root: ROOT,
      bones: BONES,
      reach: around,
      over: span(0, 4),
      bend: -1,
      bone: (length, index) =>
        Shape({
          key: `bone-${index}`,
          geometry: line([0, 0], [length, 0]),
          stroke: { color: "#000000" },
        }),
      joint: (index) =>
        index === BONES.length
          ? Shape({ key: "tip", geometry: circle(1), fill: "#FF0000" })
          : undefined,
    }),
  );

  const rotations = (node: Model.SceneNode): number[][] =>
    node.kind === "group"
      ? [
          ...node.layers.flatMap((layer) =>
            isLane(layer.rotate) ? [layer.rotate.keys.map((key) => key.value)] : [],
          ),
          ...node.children.flatMap(rotations),
        ]
      : [];

  test("the tip lands on the target all the way round", () => {
    for (const t of [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]) {
      const box = Object.entries(boxesOf(made, t)).find(([key]) => key.endsWith("/tip"))![1];

      expect(apart([box.x + box.width / 2, box.y + box.height / 2], around(t))).toBeLessThan(1.5);
    }
  });

  test("a target circling the root never makes an angle jump by a turn", () => {
    const tracks = rotations(made.root);

    expect(tracks.length).toBe(BONES.length);

    for (const values of tracks)
      for (let i = 1; i < values.length; i++)
        expect(Math.abs(values[i]! - values[i - 1]!)).toBeLessThan(180);
  });
});

describe("limb.pose, aim and a moving root", () => {
  const bones = [60, 50, 30];
  const reach = (t: number): Vec => [90 + 20 * Math.cos(t * 2), 40 + 30 * Math.sin(t * 3)];
  const ball = (t: number): Vec => [200 + 80 * Math.cos(t), 150 + 60 * Math.sin(t * 1.7)];
  const hip = (t: number): Vec => [100, 20 + 8 * Math.sin(t * 4)];

  const tipBox = (made: ReturnType<typeof scene>, t: number) =>
    Object.entries(boxesOf(made, t)).find(([key]) => key.endsWith("/tip"))![1];

  const spot = (key: string) => (length: number, index: number) =>
    Shape({
      key: `${key}-${index}`,
      geometry: line([0, 0], [length, 0]),
      stroke: { color: "#000000" },
    });

  test("pose matches limb() joints and each bone's angle", () => {
    const pose = limb.pose({ root: [10, 20], bones, reach, bend: -1 });

    for (const t of [0, 0.7, 1.9, 3.3]) {
      const { joints, angles } = pose(t);
      const expected = limb([10, 20], bones, reach(t), { bend: -1 });

      expect(joints).toEqual(expected);
      expect(angles.length).toBe(bones.length);

      angles.forEach((angle, i) => {
        const [a, b] = [joints[i]!, joints[i + 1]!];

        expect(angle).toBeCloseTo((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI, 9);
      });
    }
  });

  test("with aim, the tip content faces the aim point", () => {
    const made = scene({ size: [400, 300], duration: 6, title: "Aim" }, () =>
      Limb({
        root: [20, 20],
        bones,
        reach,
        aim: ball,
        over: span(0, 6),
        tolerance: 0.05,
        step: 0.05,
        bone: spot("bone"),
        joint: (index) =>
          index === bones.length
            ? Shape({ key: "tip", geometry: line([0, 0], [40, 0]), stroke: { color: "#FF0000" } })
            : undefined,
      }),
    );

    const pose = limb.pose({ root: [20, 20], bones, reach });

    for (const t of [0, 1.1, 2.4, 3.7, 5.2]) {
      const box = tipBox(made, t);
      const tip = pose(t).joints.at(-1)!;
      const [x, y] = ball(t);
      const want = Math.atan2(y - tip[1], x - tip[0]);
      const got = Math.atan2(box.y + box.height / 2 - tip[1], box.x + box.width / 2 - tip[0]);

      expect(Math.abs(Math.sin((got - want) / 2)) * 2 * (180 / Math.PI)).toBeLessThan(1);
    }
  });

  test("a function root keeps the tip on reach in the parent frame", () => {
    const made = scene({ size: [400, 300], duration: 6, title: "Moving root" }, () =>
      Limb({
        root: hip,
        bones: [60, 50],
        reach: (t) => [130 + 10 * Math.cos(t), 100],
        over: span(0, 6),
        tolerance: 0.05,
        step: 0.05,
        bone: spot("bone"),
        joint: (index) =>
          index === 2 ? Shape({ key: "tip", geometry: circle(1), fill: "#FF0000" }) : undefined,
      }),
    );

    for (const t of [0, 1, 2.5, 4, 5.5]) {
      const box = tipBox(made, t);

      expect(
        apart([box.x + box.width / 2, box.y + box.height / 2], [130 + 10 * Math.cos(t), 100]),
      ).toBeLessThan(1.5);
    }
  });
});

describe("array forms and sampled defaults", () => {
  test("polygon and line take one array of points as well", () => {
    const a: Vec = [0, 0];
    const b: Vec = [10, 0];
    const c: Vec = [5, 8];

    expect(polygon([a, b, c])).toEqual(polygon(a, b, c));
    expect(line([a, b])).toEqual(line(a, b));
    expect(line([a, b, c])).toEqual(line(a, b, c));
  });

  test("sampled works without options", () => {
    const wave = (t: number) => Math.sin(t * 3) * 10;

    expect(sampled(wave, span(0, 2))).toEqual(sampled(wave, span(0, 2), { tolerance: 0.25 }));
    expect(sampled(wave, span(0, 2))).not.toEqual(sampled(wave, span(0, 2), { tolerance: 5 }));
  });
});

describe("review findings", () => {
  const signedArea = (outline: ReturnType<typeof scatter>): number[] =>
    outline.kind === "path"
      ? outline.contours.map((contour) => {
          const ring = [contour.start, ...contour.curves.map((curve) => curve[2])];

          return ring.reduce((sum, [x, y], i) => {
            const [nx, ny] = ring[(i + 1) % ring.length]!;

            return sum + (x * ny - nx * y) / 2;
          }, 0);
        })
      : [];

  test("<Limb> over a window that does not start at 0 reads reach at scene time and never jumps a turn", () => {
    const root: Vec = [100, 100];

    const around = (t: number): Vec => [
      root[0] + (70 + 10 * Math.sin((t - 3) * 9)) * Math.cos((t - 3) * 2 * Math.PI * 1.2),
      root[1] + (70 + 10 * Math.sin((t - 3) * 9)) * Math.sin((t - 3) * 2 * Math.PI * 1.2),
    ];

    const made = scene({ size: [300, 300], duration: 5, title: "Late limb" }, () =>
      Limb({
        root,
        bones: [60, 50],
        reach: around,
        over: span(3, 1),
        tolerance: 0.05,
        step: 0.02,
        bone: (length, index) =>
          Shape({
            key: `bone-${index}`,
            geometry: line([0, 0], [length, 0]),
            stroke: { color: "#000000" },
          }),
        joint: (index) =>
          index === 2 ? Shape({ key: "tip", geometry: circle(1), fill: "#FF0000" }) : undefined,
      }),
    );

    const rotates = (node: Model.SceneNode): number[][] =>
      node.kind === "group"
        ? [
            ...node.layers.flatMap((layer) =>
              isLane(layer.rotate) ? [layer.rotate.keys.map((key) => key.value)] : [],
            ),
            ...node.children.flatMap(rotates),
          ]
        : [];

    for (const values of rotates(made.root))
      for (let i = 1; i < values.length; i++)
        expect(Math.abs(values[i]! - values[i - 1]!)).toBeLessThan(180);

    for (const t of [3, 3.25, 3.5, 3.9, 4]) {
      const box = Object.entries(boxesOf(made, t)).find(([key]) => key.endsWith("/tip"))![1];

      expect(apart([box.x + box.width / 2, box.y + box.height / 2], around(t))).toBeLessThan(1.5);
    }
  });

  test("scatter with alternate keeps one winding so overlapping copies do not cancel", () => {
    const leaf = blob([
      [0, -6],
      [20, -3],
      [20, 3],
      [0, 6],
    ]);

    const areas = signedArea(
      scatter(leaf, { along: line([0, 0], [60, 0]), count: 6, alternate: true, angle: 30 }),
    );

    expect(areas).toHaveLength(6);
    expect(new Set(areas.map(Math.sign)).size).toBe(1);
  });

  test("limb keeps both bone lengths when the target is closer than the bones' difference", () => {
    const [root, knee, tip] = limb([0, 0], [150, 50], [50, 0]);

    expect(apart(root!, knee!)).toBeCloseTo(150, 1);
    expect(apart(knee!, tip!)).toBeCloseTo(50, 1);
  });

  test("limb keeps every bone length with three bones and a target too close", () => {
    const joints = limb([0, 0], [100, 20, 20], [10, 0]);

    [100, 20, 20].forEach((length, i) =>
      expect(apart(joints[i]!, joints[i + 1]!)).toBeCloseTo(length, 1),
    );
  });

  test("a target exactly on the root folds the chain instead of straightening it", () => {
    for (const bones of [
      [30, 30],
      [60, 50],
      [20, 20, 20],
    ]) {
      const joints = limb([5, 5], bones, [5, 5]);

      bones.forEach((length, i) =>
        expect(apart(joints[i]!, joints[i + 1]!)).toBeCloseTo(length, 1),
      );

      if (bones.length === 2) expect(apart(joints.at(-1)!, [5, 5])).toBeLessThan(bones[0]!);
      expect(joints.every((j) => j.every(Number.isFinite))).toBe(true);
    }
  });

  test("limb.pose has no flick at the sample that lands on the root", () => {
    const pose = limb.pose({
      root: [100, 100],
      bones: [60, 50],
      reach: (t) => [100 + 40 * Math.abs(t - 1), 100],
    });

    const at = pose(1).angles;

    for (const t of [0.98, 1.02]) {
      pose(t).angles.forEach((angle, i) =>
        expect(Math.abs(Math.sin(((angle - at[i]!) * Math.PI) / 360))).toBeLessThan(0.1),
      );
    }
  });

  test("aim without tip content throws a fix-it error", () => {
    const attempt = () =>
      Limb({
        root: [0, 0],
        bones: [10, 10],
        reach: () => [10, 5],
        aim: () => [50, 50],
        over: span(0, 1),
        bone: (length) =>
          Shape({ geometry: line([0, 0], [length, 0]), stroke: { color: "#000000" } }),
      });

    expect(attempt).toThrow(SceneError);
    expect(attempt).toThrow("aim");
  });

  test("brush.at takes samples and reads the centerline the outline uses", () => {
    const points: Vec[] = [
      [0, 0],
      [50, 40],
      [100, 0],
    ];

    expect(brush.at(points, 4, 0.5, { samples: 1 }).point[1]).toBeCloseTo(0, 0);
    expect(bounds(brush(points, 4, { samples: 1 })).height).toBeLessThan(10);
    expect(brush.at(points, 4, 0.5).point[1]).toBeGreaterThan(20);
  });

  test("line and polygon copy the array they are given", () => {
    const list: Vec[] = [
      [0, 0],
      [10, 0],
      [5, 8],
    ];

    const outline = polygon(list);
    const open = line(list);

    list.push([99, 99]);
    list.shift();

    expect(outline).toEqual(polygon([0, 0], [10, 0], [5, 8]));
    expect(open).toEqual(line([0, 0], [10, 0], [5, 8]));
  });
});
