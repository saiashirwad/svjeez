import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { union, type Box, type Point } from "../src/layout/box.ts";
import { lanes } from "../src/layout/lanes.ts";
import { layered, type LayeredInput } from "../src/layout/layered.ts";
import { curve } from "../src/curve.ts";
import { sequence } from "../src/layout/sequence.ts";
import { tree } from "../src/layout/tree.ts";

const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const onBorder = (p: Point, b: Box) => {
  const near = (u: number, v: number) => Math.abs(u - v) < 1e-6;
  const inX = p.x >= b.x - 1e-6 && p.x <= b.x + b.w + 1e-6;
  const inY = p.y >= b.y - 1e-6 && p.y <= b.y + b.h + 1e-6;

  return (
    ((near(p.x, b.x) || near(p.x, b.x + b.w)) && inY) ||
    ((near(p.y, b.y) || near(p.y, b.y + b.h)) && inX)
  );
};

const nodes = (ids: string, w = 80, h = 36) =>
  ids.split(" ").map((id, i) => ({ id, w: w + (i % 3) * 20, h: h + (i % 2) * 14 }));

const edges = (list: string) =>
  list.split(" ").map((pair) => ({ from: pair.split(">")[0]!, to: pair.split(">")[1]! }));

const graphs = {
  chain: { nodes: nodes("a b c d"), edges: edges("a>b b>c c>d") },
  diamond: { nodes: nodes("a b c d"), edges: edges("a>b a>c b>d c>d") },
  cycle: {
    nodes: nodes("idle run wait done"),
    edges: edges("idle>run run>wait wait>run run>idle run>done"),
  },
  long: { nodes: nodes("a b c d e"), edges: edges("a>b b>c c>d a>d a>e b>e") },
  wide: { nodes: nodes("r a b c d e f g"), edges: edges("r>a r>b r>c r>d a>e b>e c>f d>g a>g") },
  grouped: {
    nodes: nodes("in gather analyze lint clean out"),
    edges: edges("in>gather gather>analyze analyze>lint lint>clean clean>out in>out gather>clean"),
    groups: [{ id: "review", members: ["gather", "analyze", "clean"], label: { w: 90, h: 14 } }],
  },
  twoGroups: {
    nodes: nodes("a b c d e f g"),
    edges: edges("a>b a>c b>d c>e d>f e>f a>g g>f"),
    groups: [
      { id: "left", members: ["b", "d"], label: { w: 40, h: 14 } },
      { id: "right", members: ["c", "e"], label: { w: 120, h: 14 } },
    ],
  },
} satisfies Record<string, LayeredInput>;

describe("layered", () => {
  for (const [name, graph] of Object.entries<LayeredInput>(graphs)) {
    for (const direction of ["TB", "LR"] as const) {
      const out = layered({ ...graph, direction });
      const boxes = [...out.nodes.entries()];

      test(`${name} ${direction}: no two nodes overlap`, () => {
        for (const [i, [a, ba]] of boxes.entries())
          for (const [b, bb] of boxes.slice(i + 1))
            expect(`${a}/${b} ${overlap(ba, bb)}`).toBe(`${a}/${b} false`);
      });

      test(`${name} ${direction}: no node sits inside a group it is not in`, () => {
        for (const g of graph.groups ?? []) {
          const box = out.groups.get(g.id)!;

          for (const [id, b] of boxes)
            expect(`${id} in ${g.id}: ${overlap(b, box)}`).toBe(
              `${id} in ${g.id}: ${g.members.includes(id)}`,
            );
        }
      });

      test(`${name} ${direction}: edges start and end on node borders`, () => {
        for (const e of out.edges) {
          expect(onBorder(e.points[0]!, out.nodes.get(e.from)!)).toBe(true);
          expect(onBorder(e.points.at(-1)!, out.nodes.get(e.to)!)).toBe(true);

          for (const [k, p] of e.points.slice(1).entries())
            expect(p.x === e.points[k]!.x || p.y === e.points[k]!.y).toBe(true);
        }
      });

      test(`${name} ${direction}: ranks advance along the direction`, () => {
        const along = (b: Box) => (direction === "TB" ? [b.y, b.y + b.h] : [b.x, b.x + b.w]);

        for (const e of graph.edges) {
          const [from, to] = [out.nodes.get(e.from)!, out.nodes.get(e.to)!];
          const [ra, rb] = [out.rank.get(e.from)!, out.rank.get(e.to)!];
          const [first, second] = ra < rb ? [from, to] : [to, from];
          expect(ra).not.toBe(rb);
          expect(along(second)[0]!).toBeGreaterThan(along(first)[1]!);
        }
      });
    }
  }

  test("BT and RL mirror TB and LR, and every edge ends on its nodes", () => {
    const g = graphs.diamond!;

    const [tb, bt, lr, rl] = (["TB", "BT", "LR", "RL"] as const).map((direction) =>
      layered({ ...g, direction }),
    );

    const y = (out: typeof tb, id: string) => out!.nodes.get(id)!.y;
    const x = (out: typeof tb, id: string) => out!.nodes.get(id)!.x;

    expect(y(tb, "a")).toBeLessThan(y(tb, "d"));
    expect(y(bt, "a")).toBeGreaterThan(y(bt, "d"));
    expect(x(lr, "a")).toBeLessThan(x(lr, "d"));
    expect(x(rl, "a")).toBeGreaterThan(x(rl, "d"));
    expect(bt!.bounds.h).toBeCloseTo(tb!.bounds.h, 3);
    expect(rl!.bounds.w).toBeCloseTo(lr!.bounds.w, 3);

    for (const out of [bt!, rl!])
      for (const e of out.edges) {
        expect(onBorder(e.points[0]!, out.nodes.get(e.from)!)).toBe(true);
        expect(onBorder(e.points.at(-1)!, out.nodes.get(e.to)!)).toBe(true);
      }
  });

  test("a cycle reverses one edge for ranking but still points the right way", () => {
    const out = layered(graphs.cycle!);
    const back = out.edges.find((e) => e.from === "wait" && e.to === "run")!;
    expect(onBorder(back.points.at(-1)!, out.nodes.get("run")!)).toBe(true);
    expect(out.rank.get("wait")).toBeGreaterThan(out.rank.get("run")!);
  });

  test("a chain with backward edges round both sides stays straight", () => {
    const out = layered({
      nodes: nodes("start closed open half"),
      edges: edges("start>closed closed>open open>half half>closed half>open"),
    });

    const centers = ["start", "closed", "open", "half"].map(
      (id) => out.nodes.get(id)!.x + out.nodes.get(id)!.w / 2,
    );

    for (const x of centers) expect(x).toBeCloseTo(centers[0]!, 3);

    for (const e of out.edges.slice(0, 3)) expect(e.points).toHaveLength(2);
  });

  test("a wide node sends each of its edges out from above its target", () => {
    const out = layered({
      nodes: [{ id: "hub", w: 400, h: 40 }, ...nodes("a b c")],
      edges: edges("hub>a hub>b hub>c"),
    });

    for (const e of out.edges) expect(e.points.length).toBeLessThanOrEqual(2);
  });

  test("a self loop leaves and returns to the node's far side", () => {
    const out = layered({ nodes: nodes("a b"), edges: edges("a>b b>b") });
    const loop = out.edges[1]!;
    const b = out.nodes.get("b")!;
    expect(loop.points.every((p) => p.x >= b.x + b.w - 1e-6)).toBe(true);
    expect([onBorder(loop.points[0]!, b), onBorder(loop.points.at(-1)!, b)]).toEqual([true, true]);
  });

  test("an edge label sits beside its edge, clear of every node", () => {
    const out = layered({
      nodes: nodes("a b c"),
      edges: [
        { from: "a", to: "b", label: { w: 40, h: 16 } },
        { from: "a", to: "c", label: { w: 30, h: 16 } },
      ],
    });

    for (const e of out.edges)
      for (const b of out.nodes.values()) expect(overlap(e.label!, b)).toBe(false);
  });

  test("edges both ways between two nodes take separate lines and labels", () => {
    const label = { w: 40, h: 16 };

    const out = layered({
      nodes: nodes("a b c"),
      edges: [
        { from: "a", to: "b", label },
        { from: "b", to: "a", label },
        { from: "a", to: "b", label },
        { from: "b", to: "c" },
      ],
    });

    const [ab, ba, ab2] = out.edges;
    expect(ab!.points).not.toEqual([...ba!.points].reverse());
    expect(ab!.points).not.toEqual(ab2!.points);
    expect([overlap(ab!.label!, ba!.label!), overlap(ab!.label!, ab2!.label!)]).toEqual([
      false,
      false,
    ]);
  });

  describe("edges keep clear of each other", () => {
    const label = (text: string) => ({ w: text.length * 7.2, h: 17 });

    const routed = {
      "state example": {
        nodes: [
          { id: "start", w: 14, h: 14 },
          { id: "idle", w: 70, h: 39 },
          { id: "planning", w: 101, h: 39 },
          { id: "acting", w: 132, h: 39 },
          { id: "waiting", w: 158, h: 39 },
          { id: "done", w: 78, h: 47 },
          { id: "failed", w: 94, h: 47 },
        ],
        edges: [
          { from: "start", to: "idle" },
          ...[
            ["idle", "planning", "task"],
            ["planning", "acting", "plan"],
            ["acting", "planning", "result"],
            ["acting", "waiting", "ask"],
            ["waiting", "planning", "reply"],
            ["acting", "done", "finish"],
            ["acting", "failed", "error"],
          ].map(([from, to, text]) => ({ from: from!, to: to!, label: label(text!) })),
        ],
      },
      "decision fanning out": {
        nodes: [
          { id: "in", w: 90, h: 39 },
          { id: "check", w: 120, h: 62 },
          { id: "a", w: 80, h: 39 },
          { id: "b", w: 110, h: 39 },
          { id: "c", w: 80, h: 39 },
          { id: "d", w: 90, h: 39 },
          { id: "out", w: 90, h: 39 },
        ],
        edges: [
          { from: "in", to: "check" },
          ...["a", "b", "c", "d"].map((to) => ({ from: "check", to, label: label(`go ${to}`) })),
          ...["a", "b", "c", "d"].map((from) => ({ from, to: "out" })),
          { from: "d", to: "check", label: label("again") },
        ],
      },
      "two-cycle": {
        nodes: nodes("a b"),
        edges: [
          { from: "a", to: "b", label: label("go") },
          { from: "b", to: "a", label: label("back") },
        ],
      },
      ...graphs,
    } satisfies Record<string, LayeredInput>;

    const segments = (points: readonly Point[]) =>
      points.slice(1).map((q, k) => [points[k]!, q] as const);

    const collinear = ([a, b]: readonly [Point, Point], [c, d]: readonly [Point, Point]) => {
      if (a.x === b.x && c.x === d.x && Math.abs(a.x - c.x) < 0.5)
        return (
          Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) -
            Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) >
          0.5
        );

      if (a.y === b.y && c.y === d.y && Math.abs(a.y - c.y) < 0.5)
        return (
          Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
            Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) >
          0.5
        );

      return false;
    };

    const through = ([p, q]: readonly [Point, Point], b: Box) =>
      Math.max(p.x, q.x) > b.x + 0.5 &&
      Math.min(p.x, q.x) < b.x + b.w - 0.5 &&
      Math.max(p.y, q.y) > b.y + 0.5 &&
      Math.min(p.y, q.y) < b.y + b.h - 0.5;

    for (const [name, graph] of Object.entries<LayeredInput>(routed)) {
      for (const direction of ["TB", "LR"] as const) {
        const out = layered({ ...graph, direction });
        const lines = out.edges.map((e) => ({ ...e, segments: segments(e.points) }));

        test(`${name} ${direction}: no two edges share a stretch of line`, () => {
          for (const [i, e] of lines.entries())
            for (const f of lines.slice(i + 1))
              for (const s of e.segments)
                for (const t of f.segments)
                  expect(`${e.from}>${e.to} / ${f.from}>${f.to}: ${collinear(s, t)}`).toEndWith(
                    "false",
                  );
        });

        test(`${name} ${direction}: no edge runs through a node`, () => {
          for (const e of lines)
            for (const [id, b] of out.nodes)
              for (const s of e.segments)
                expect(`${e.from}>${e.to} through ${id}: ${through(s, b)}`).toEndWith("false");
        });

        test(`${name} ${direction}: labels clear nodes, other labels and other edges`, () => {
          const labelled = lines.filter((e) => e.label);

          for (const e of labelled) {
            for (const [id, b] of out.nodes)
              expect(`${e.from}>${e.to} label on ${id}: ${overlap(e.label!, b)}`).toEndWith(
                "false",
              );

            for (const f of labelled)
              if (f !== e)
                expect(
                  `${e.from}>${e.to} label on ${f.from}>${f.to} label: ${overlap(e.label!, f.label!)}`,
                ).toEndWith("false");

            for (const f of lines)
              if (f !== e)
                for (const s of f.segments)
                  expect(
                    `${e.from}>${e.to} label on ${f.from}>${f.to}: ${through(s, e.label!)}`,
                  ).toEndWith("false");
          }
        });
      }
    }
  });

  describe("crossings and ports", () => {
    const wires = (out: ReturnType<typeof layered>) =>
      out.edges.flatMap((e, i) => e.points.slice(1).map((q, k) => [e.points[k]!, q, i] as const));

    const crossings = (out: ReturnType<typeof layered>) => {
      const ccw = (a: Point, b: Point, c: Point) =>
        (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);

      const all = wires(out);
      let n = 0;

      for (const [i, [a, b, e]] of all.entries())
        for (const [c, d, f] of all.slice(i + 1))
          if (e !== f && ccw(a, b, c) * ccw(a, b, d) < 0 && ccw(c, d, a) * ccw(c, d, b) < 0) n++;

      return n;
    };

    test("a shuffled matching comes out with no crossings", () => {
      const out = layered({
        nodes: nodes("a1 a2 a3 a4 a5 b1 b2 b3 b4 b5"),
        edges: edges("a1>b3 a2>b5 a3>b1 a4>b4 a5>b2"),
      });

      expect(crossings(out)).toBe(0);
    });

    test("a tree declared in a scrambled order comes out with no crossings", () => {
      const out = layered({
        nodes: nodes("r a b c a1 a2 b1 b2 c1 c2 c3"),
        edges: edges("r>c r>a r>b c>c2 a>a2 b>b1 c>c1 a>a1 b>b2 c>c3"),
      });

      expect(crossings(out)).toBe(0);
    });

    test("a three-layer lattice is drawn with the fewest crossings it allows", () => {
      const out = layered({
        nodes: nodes("a b c d e f g h i"),
        edges: edges("a>d a>e b>d b>f c>e c>f d>g d>h e>h e>i f>g f>i"),
      });

      // Four is the least any order of its layers allows.
      expect(crossings(out)).toBeLessThanOrEqual(4);
    });

    test("edges leaving one node start at separate points along its side", () => {
      const out = layered({
        nodes: [{ id: "hub", w: 200, h: 40 }, ...nodes("a b c")],
        edges: edges("hub>a hub>b hub>c"),
      });

      const xs = out.edges.map((e) => e.points[0]!.x).sort((p, q) => p - q);
      expect(new Set(xs).size).toBe(3);

      for (let k = 1; k < xs.length; k++) expect(xs[k]! - xs[k - 1]!).toBeGreaterThanOrEqual(8);
    });

    test("edges entering one node end at separate points along its side", () => {
      const out = layered({
        nodes: [{ id: "hub", w: 200, h: 40 }, ...nodes("a b c")],
        edges: edges("a>hub b>hub c>hub"),
      });

      const xs = out.edges.map((e) => e.points.at(-1)!.x).sort((p, q) => p - q);
      expect(new Set(xs).size).toBe(3);

      for (let k = 1; k < xs.length; k++) expect(xs[k]! - xs[k - 1]!).toBeGreaterThanOrEqual(8);
    });

    test("a lone edge between nodes with overlapping spans runs straight", () => {
      const out = layered({
        nodes: [
          { id: "a", w: 200, h: 40 },
          { id: "b", w: 60, h: 40 },
        ],
        edges: edges("a>b"),
      });

      expect(out.edges[0]!.points).toHaveLength(2);
    });

    test("a node hanging off a long chain sits next to its only neighbour", () => {
      const out = layered({ nodes: nodes("a b c d x"), edges: edges("a>b b>c c>d x>d") });

      expect(out.rank.get("x")).toBe(out.rank.get("c"));
    });

    test("the same input gives the same layout", () => {
      const input = {
        nodes: nodes("a b c d e f"),
        edges: edges("a>b a>c b>d c>d d>e e>f f>b a>f"),
      };

      expect(layered(input)).toEqual(layered(input));
    });
  });

  describe("straightening", () => {
    const center = (b: Box) => b.x + b.w / 2;

    // Sideways steps along an edge, past the one it may take at each end to reach its ports.
    const kinks = (e: { readonly points: readonly Point[] }) =>
      Math.max(
        0,
        e.points.slice(1).filter((q, k) => Math.abs(q.x - e.points[k]!.x) > 0.5).length - 2,
      );

    test("a long edge runs straight between its bends", () => {
      const out = layered({
        nodes: nodes("a b c d e f g h"),
        edges: edges("a>b b>c c>d d>e a>e a>f f>g g>h b>h c>h"),
      });

      for (const e of out.edges) expect(kinks(e)).toBe(0);
    });

    for (const [name, graph] of Object.entries<LayeredInput>(graphs))
      test(`${name}: no long edge kinks between its bends`, () => {
        const out = layered(graph);

        const long = out.edges.filter(
          (e) => Math.abs(out.rank.get(e.from)! - out.rank.get(e.to)!) > 1,
        );

        expect(long.reduce((n, e) => n + kinks(e), 0)).toBe(0);
      });

    test("a chain of nodes of different widths stays perfectly straight", () => {
      const out = layered({ nodes: nodes("a b c d e"), edges: edges("a>b b>c c>d d>e") });
      const xs = [...out.nodes.values()].map(center);

      for (const x of xs) expect(x).toBeCloseTo(xs[0]!, 6);

      for (const e of out.edges) expect(e.points).toHaveLength(2);
    });

    test("a parent with two children sits centred over them", () => {
      const out = layered({ nodes: nodes("p a b"), edges: edges("p>a p>b") });
      const [p, a, b] = ["p", "a", "b"].map((id) => center(out.nodes.get(id)!));

      expect(p!).toBeCloseTo((a! + b!) / 2, 6);
    });

    test("a child with two parents sits centred under them", () => {
      const out = layered({ nodes: nodes("a b c"), edges: edges("a>c b>c") });
      const [a, b, c] = ["a", "b", "c"].map((id) => center(out.nodes.get(id)!));

      expect(c!).toBeCloseTo((a! + b!) / 2, 6);
    });
  });

  describe("curve", () => {
    const jog = [
      { x: 0, y: 0 },
      { x: 0, y: 30 },
      { x: 100, y: 30 },
      { x: 100, y: 60 },
    ];

    test("starts and ends on its points", () => {
      const { samples } = curve(jog);
      expect(samples[0]).toEqual([0, 0]);
      expect(samples.at(-1)).toEqual([100, 60]);
    });

    test("a jog is one S that never leaves the box of its points or doubles back", () => {
      const { samples } = curve(jog);

      for (const [k, [x, y]] of samples.entries()) {
        expect(x).toBeGreaterThanOrEqual(-1e-6);
        expect(x).toBeLessThanOrEqual(100 + 1e-6);

        if (k > 0) expect(y).toBeGreaterThanOrEqual(samples[k - 1]![1] - 1e-6);
      }
    });
  });

  test("unknown ids and a node in two groups throw", () => {
    expect(() => layered({ nodes: nodes("a"), edges: edges("a>b") })).toThrow();
    expect(() =>
      layered({
        nodes: nodes("a b"),
        edges: [],
        groups: [
          { id: "x", members: ["a"], label: { w: 1, h: 1 } },
          { id: "y", members: ["a"], label: { w: 1, h: 1 } },
        ],
      }),
    ).toThrow();
  });
});

describe("tree", () => {
  const input = {
    nodes: [
      { id: "root", w: 120, h: 36 },
      { id: "a", parent: "root", w: 60, h: 36 },
      { id: "b", parent: "root", w: 200, h: 50 },
      { id: "c", parent: "root", w: 60, h: 36 },
      { id: "a1", parent: "a", w: 90, h: 36 },
      { id: "a2", parent: "a", w: 90, h: 36 },
      { id: "a3", parent: "a", w: 90, h: 36 },
      { id: "c1", parent: "c", w: 40, h: 36 },
      { id: "b1", parent: "b", w: 30, h: 36 },
      { id: "c11", parent: "c1", w: 300, h: 36 },
    ],
  };

  for (const direction of ["TB", "LR"] as const) {
    const out = tree({ ...input, direction });
    const cross = (b: Box) => (direction === "TB" ? b.x + b.w / 2 : b.y + b.h / 2);

    test(`${direction}: each parent is centered over its first and last child`, () => {
      for (const id of ["root", "a", "b", "c", "c1"]) {
        const kids = input.nodes
          .filter((n) => n.parent === id)
          .map((n) => cross(out.nodes.get(n.id)!));

        expect(cross(out.nodes.get(id)!)).toBeCloseTo((kids[0]! + kids.at(-1)!) / 2, 6);
      }
    });

    test(`${direction}: subtrees never overlap and siblings keep their order`, () => {
      const boxes = [...out.nodes.values()];

      for (const [i, a] of boxes.entries())
        for (const b of boxes.slice(i + 1)) expect(overlap(a, b)).toBe(false);
      expect(["a", "b", "c"].map((id) => cross(out.nodes.get(id)!))).toEqual(
        ["a", "b", "c"].map((id) => cross(out.nodes.get(id)!)).sort((p, q) => p - q),
      );
    });

    test(`${direction}: edges run from the parent's border to the child's`, () => {
      for (const e of out.edges)
        expect([
          onBorder(e.points[0]!, out.nodes.get(e.from)!),
          onBorder(e.points.at(-1)!, out.nodes.get(e.to)!),
        ]).toEqual([true, true]);
    });
  }

  test("breadth-first order", () => {
    expect(tree(input).order).toEqual(["root", "a", "b", "c", "a1", "a2", "a3", "b1", "c1", "c11"]);
  });

  test("two roots, an unknown parent and a cycle throw", () => {
    expect(() =>
      tree({
        nodes: [
          { id: "a", w: 1, h: 1 },
          { id: "b", w: 1, h: 1 },
        ],
      }),
    ).toThrow("one root");
    expect(() =>
      tree({
        nodes: [
          { id: "a", w: 1, h: 1 },
          { id: "b", parent: "z", w: 1, h: 1 },
        ],
      }),
    ).toThrow("unknown parent");
    expect(() =>
      tree({
        nodes: [
          { id: "r", w: 1, h: 1 },
          { id: "a", parent: "b", w: 1, h: 1 },
          { id: "b", parent: "a", w: 1, h: 1 },
        ],
      }),
    ).toThrow("cycle");
  });
});

describe("sequence", () => {
  const out = sequence({
    actors: [
      { id: "user", w: 60, h: 36 },
      { id: "api", w: 50, h: 36 },
      { id: "db", w: 90, h: 48 },
    ],
    rows: [
      { kind: "message", from: "user", to: "api", label: { w: 220, h: 14 } },
      { kind: "message", from: "api", to: "db", label: { w: 40, h: 14 } },
      { kind: "message", from: "user", to: "db", label: { w: 500, h: 14 } },
      { kind: "message", from: "api", to: "api", label: { w: 80, h: 14 } },
      { kind: "note", actor: "db", size: { w: 120, h: 30 } },
    ],
  });

  const x = (id: string) => out.lifelines.get(id)![0].x;

  test("every message label fits between the lifelines it spans", () => {
    const pairs = [
      ["user", "api"],
      ["api", "db"],
      ["user", "db"],
    ] as const;

    pairs.forEach(([a, b], i) => {
      const label = out.rows[i]!.box;
      expect(label.x).toBeGreaterThan(x(a));
      expect(label.x + label.w).toBeLessThan(x(b));
    });
  });

  test("arrows run lifeline to lifeline, one row below the last", () => {
    expect(out.rows[0]!.points).toEqual([
      { x: x("user"), y: out.rows[0]!.points[0]!.y },
      { x: x("api"), y: out.rows[0]!.points[0]!.y },
    ]);
    const tops = out.rows.map((r) => Math.min(r.box.y, ...r.points.map((p) => p.y)));
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    expect(out.lifelines.get("api")![1].y).toBeGreaterThan(
      Math.max(...out.rows.map((r) => r.box.y + r.box.h)),
    );
  });

  test("a self message's label clears the next lifeline", () => {
    const self = out.rows[3]!;
    expect(self.points[1]!.x).toBeGreaterThan(x("api"));
    expect(self.box.x + self.box.w).toBeLessThan(x("db"));
  });
});

describe("sequence blocks, activations and notes", () => {
  const actors = [
    { id: "a", w: 40, h: 30 },
    { id: "b", w: 40, h: 30 },
    { id: "c", w: 40, h: 30 },
  ];

  const label = { w: 60, h: 14 };

  const out = sequence({
    actors,
    title: { w: 100, h: 20 },
    rows: [
      { kind: "open", tab: { w: 40, h: 18 }, label: { w: 80, h: 16 } },
      { kind: "message", from: "a", to: "b", label, activate: true },
      { kind: "open", tab: { w: 30, h: 18 } },
      { kind: "message", from: "b", to: "b", label, activate: true },
      { kind: "message", from: "b", to: "b", label, deactivate: true },
      { kind: "close" },
      { kind: "divider", label: { w: 50, h: 16 } },
      { kind: "message", from: "b", to: "a", label, deactivate: true },
      { kind: "close" },
      { kind: "note", actor: "a", to: "c", size: { w: 300, h: 26 } },
      { kind: "note", actor: "c", side: "left", size: { w: 90, h: 26 } },
    ],
  });

  const x = (id: string) => out.lifelines.get(id)![0].x;

  test("a frame spans the lifelines it involves and nests its children", () => {
    const [outer, inner] = out.frames;

    expect(outer!.box.x).toBeLessThan(x("a"));
    expect(outer!.box.x + outer!.box.w).toBeGreaterThan(x("b"));
    expect(outer!.box.x + outer!.box.w).toBeLessThan(x("c") + 1);
    expect(inner!.box.y).toBeGreaterThan(outer!.box.y);
    expect(inner!.box.y + inner!.box.h).toBeLessThan(outer!.box.y + outer!.box.h);
    expect(inner!.box.x).toBeGreaterThan(outer!.box.x);
    expect(outer!.dividers).toHaveLength(1);
    expect(outer!.dividers[0]!.y).toBeGreaterThan(inner!.box.y + inner!.box.h);
    expect(outer!.at).toBe(0);
    expect(inner!.at).toBe(1);
  });

  test("activations are bars on the lifeline, nested bars shift sideways", () => {
    const [first, second] = out.bars.filter((b) => b.actor === "b");

    expect(out.bars).toHaveLength(2);
    expect(first!.box.x + first!.box.w / 2).toBeCloseTo(x("b"));
    expect(second!.box.x).toBeGreaterThan(first!.box.x);
    expect(second!.box.y).toBeGreaterThan(first!.box.y);
    expect(second!.box.y + second!.box.h).toBeLessThanOrEqual(first!.box.y + first!.box.h);
  });

  test("an arrow stops at the edge of the bar it lands on", () => {
    const send = out.rows[0]!.points;

    expect(send[1]!.x).toBeLessThan(x("b"));
    expect(send[0]!.x).toBe(x("a"));
    const reply = out.rows[3]!.points;
    expect(reply[0]!.x).toBeLessThan(x("b"));
  });

  test("notes span two actors or sit beside one, and the title heads the diagram", () => {
    const [wide, beside] = [out.rows[4]!.box, out.rows[5]!.box];

    expect(wide.w).toBeGreaterThanOrEqual(300);
    expect(wide.x).toBeLessThan(x("a"));
    expect(beside.x + beside.w).toBeLessThan(x("c"));
    expect(out.title!.y).toBe(0);
    expect(out.heads.get("a")!.y).toBeGreaterThan(out.title!.h);
  });

  test("deactivating without an activation is an error", () => {
    expect(() => sequence({ actors, rows: [{ kind: "deactivate", actor: "a" }] })).toThrow(
      "has no activation",
    );
    expect(() => sequence({ actors, rows: [{ kind: "close" }] })).toThrow("never opened");
  });

  test("a boxed group of actors gets a frame behind them", () => {
    const boxed = sequence({
      actors,
      boxes: [{ actors: ["a", "b"], label: { w: 40, h: 14 } }],
      rows: [{ kind: "message", from: "a", to: "c", label }],
    });

    const [b] = boxed.boxes;

    expect(b!.box.x).toBeLessThan(boxed.heads.get("a")!.x);
    expect(b!.box.x + b!.box.w).toBeGreaterThan(boxed.heads.get("b")!.x + 40);
    expect(b!.box.x + b!.box.w).toBeLessThan(boxed.heads.get("c")!.x);
  });
});

describe("lanes", () => {
  const out = lanes({
    lanes: [
      { id: "a", label: { w: 40, h: 14 } },
      { id: "b", label: { w: 80, h: 14 } },
    ],
    spans: [{ lane: "a", from: 1, to: 3 }],
    events: [{ lane: "b", at: 2 }],
    links: [{ from: "a", to: "b", at: 2.5 }],
    scale: 50,
  });

  test("time maps linearly onto x after the label column", () => {
    expect(out.x(2) - out.x(1)).toBe(50);
    expect(out.x(0)).toBeGreaterThan(80);
    expect(out.spans[0]).toMatchObject({ x: out.x(1), w: 100 });
  });

  test("marks sit inside their lane's row and links join the two rows", () => {
    const [a, b] = [out.rows.get("a")!, out.rows.get("b")!];
    expect(overlap(out.spans[0]!, a)).toBe(true);
    expect(out.events[0]!.at.y).toBe(b.y + b.h / 2);
    const [p, q] = out.links[0]!;
    expect([p.x, q.x]).toEqual([out.x(2.5), out.x(2.5)]);
    expect(p.y > a.y && p.y < a.y + a.h && q.y > b.y && q.y < b.y + b.h).toBe(true);
  });
});

describe("size limits", () => {
  test("union and lanes take hundreds of thousands of boxes without a RangeError", () => {
    const boxes = Array.from({ length: 300_000 }, (_, i) => ({ x: i, y: 0, w: 1, h: 1 }));

    expect(union(boxes)).toEqual({ x: 0, y: 0, w: 300_000, h: 1 });

    const out = lanes({
      lanes: [{ id: "a", label: { w: 10, h: 10 } }],
      spans: [],
      events: boxes.map((b) => ({ lane: "a", at: b.x })),
      links: [],
      scale: 1,
    });

    expect(out.x(299_999)).toBeGreaterThan(out.x(0));
  });
});

test("src/layout imports nothing but itself, the types and SceneError", () => {
  const dir = join(import.meta.dir, "../src/layout");

  for (const file of readdirSync(dir)) {
    const imports = [...readFileSync(join(dir, file), "utf8").matchAll(/from\s+"([^"]+)"/g)].map(
      (m) => m[1]!,
    );

    for (const path of imports)
      expect(`${file}: ${path}`).toMatch(/: (svjeez\/tools|\.\/[\w-]+\.ts|\.\.\/types\.ts)$/);
  }
});
