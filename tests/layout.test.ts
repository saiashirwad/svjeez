import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Box, Point } from "../src/layout/box";
import { lanes } from "../src/layout/lanes";
import { layered, type LayeredInput } from "../src/layout/layered";
import { sequence } from "../src/layout/sequence";
import { tree } from "../src/layout/tree";

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const onBorder = (p: Point, b: Box) => {
  const near = (u: number, v: number) => Math.abs(u - v) < 1e-6;
  const inX = p.x >= b.x - 1e-6 && p.x <= b.x + b.w + 1e-6;
  const inY = p.y >= b.y - 1e-6 && p.y <= b.y + b.h + 1e-6;
  return ((near(p.x, b.x) || near(p.x, b.x + b.w)) && inY) || ((near(p.y, b.y) || near(p.y, b.y + b.h)) && inX);
};

const nodes = (ids: string, w = 80, h = 36) => ids.split(" ").map((id, i) => ({ id, w: w + (i % 3) * 20, h: h + (i % 2) * 14 }));
const edges = (list: string) => list.split(" ").map((pair) => ({ from: pair.split(">")[0]!, to: pair.split(">")[1]! }));

const graphs: Record<string, LayeredInput> = {
  chain: { nodes: nodes("a b c d"), edges: edges("a>b b>c c>d") },
  diamond: { nodes: nodes("a b c d"), edges: edges("a>b a>c b>d c>d") },
  cycle: { nodes: nodes("idle run wait done"), edges: edges("idle>run run>wait wait>run run>idle run>done") },
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
};

describe("layered", () => {
  for (const [name, graph] of Object.entries(graphs)) {
    for (const direction of ["TB", "LR"] as const) {
      const out = layered({ ...graph, direction });
      const boxes = [...out.nodes.entries()];

      test(`${name} ${direction}: no two nodes overlap`, () => {
        for (const [i, [a, ba]] of boxes.entries()) for (const [b, bb] of boxes.slice(i + 1)) expect(`${a}/${b} ${overlap(ba, bb)}`).toBe(`${a}/${b} false`);
      });

      test(`${name} ${direction}: no node sits inside a group it is not in`, () => {
        for (const g of graph.groups ?? []) {
          const box = out.groups.get(g.id)!;
          for (const [id, b] of boxes) expect(`${id} in ${g.id}: ${overlap(b, box)}`).toBe(`${id} in ${g.id}: ${g.members.includes(id)}`);
        }
      });

      test(`${name} ${direction}: edges start and end on node borders`, () => {
        for (const e of out.edges) {
          expect(onBorder(e.points[0]!, out.nodes.get(e.from)!)).toBe(true);
          expect(onBorder(e.points.at(-1)!, out.nodes.get(e.to)!)).toBe(true);
          for (const [k, p] of e.points.slice(1).entries()) expect(p.x === e.points[k]!.x || p.y === e.points[k]!.y).toBe(true);
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

  test("a cycle reverses one edge for ranking but still points the right way", () => {
    const out = layered(graphs.cycle!);
    const back = out.edges.find((e) => e.from === "wait" && e.to === "run")!;
    expect(onBorder(back.points.at(-1)!, out.nodes.get("run")!)).toBe(true);
    expect(out.rank.get("wait")).toBeGreaterThan(out.rank.get("run")!);
  });

  test("a self loop leaves and returns to the node's far side", () => {
    const out = layered({ nodes: nodes("a b"), edges: edges("a>b b>b") });
    const loop = out.edges[1]!;
    const b = out.nodes.get("b")!;
    expect(loop.points.every((p) => p.x >= b.x + b.w - 1e-6)).toBe(true);
    expect([onBorder(loop.points[0]!, b), onBorder(loop.points.at(-1)!, b)]).toEqual([true, true]);
  });

  test("an edge label sits beside its edge, clear of every node", () => {
    const out = layered({ nodes: nodes("a b c"), edges: [{ from: "a", to: "b", label: { w: 40, h: 16 } }, { from: "a", to: "c", label: { w: 30, h: 16 } }] });
    for (const e of out.edges) for (const b of out.nodes.values()) expect(overlap(e.label!, b)).toBe(false);
  });

  test("unknown ids and a node in two groups throw", () => {
    expect(() => layered({ nodes: nodes("a"), edges: edges("a>b") })).toThrow();
    expect(() => layered({ nodes: nodes("a b"), edges: [], groups: [{ id: "x", members: ["a"], label: { w: 1, h: 1 } }, { id: "y", members: ["a"], label: { w: 1, h: 1 } }] })).toThrow();
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
        const kids = input.nodes.filter((n) => n.parent === id).map((n) => cross(out.nodes.get(n.id)!));
        expect(cross(out.nodes.get(id)!)).toBeCloseTo((kids[0]! + kids.at(-1)!) / 2, 6);
      }
    });

    test(`${direction}: subtrees never overlap and siblings keep their order`, () => {
      const boxes = [...out.nodes.values()];
      for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) expect(overlap(a, b)).toBe(false);
      expect(["a", "b", "c"].map((id) => cross(out.nodes.get(id)!))).toEqual(["a", "b", "c"].map((id) => cross(out.nodes.get(id)!)).sort((p, q) => p - q));
    });

    test(`${direction}: edges run from the parent's border to the child's`, () => {
      for (const e of out.edges) expect([onBorder(e.points[0]!, out.nodes.get(e.from)!), onBorder(e.points.at(-1)!, out.nodes.get(e.to)!)]).toEqual([true, true]);
    });
  }

  test("breadth-first order", () => {
    expect(tree(input).order).toEqual(["root", "a", "b", "c", "a1", "a2", "a3", "b1", "c1", "c11"]);
  });

  test("two roots, an unknown parent and a cycle throw", () => {
    expect(() => tree({ nodes: [{ id: "a", w: 1, h: 1 }, { id: "b", w: 1, h: 1 }] })).toThrow("one root");
    expect(() => tree({ nodes: [{ id: "a", w: 1, h: 1 }, { id: "b", parent: "z", w: 1, h: 1 }] })).toThrow("unknown parent");
    expect(() => tree({ nodes: [{ id: "r", w: 1, h: 1 }, { id: "a", parent: "b", w: 1, h: 1 }, { id: "b", parent: "a", w: 1, h: 1 }] })).toThrow("cycle");
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
    const pairs = [["user", "api"], ["api", "db"], ["user", "db"]] as const;
    pairs.forEach(([a, b], i) => {
      const label = out.rows[i]!.box;
      expect(label.x).toBeGreaterThan(x(a));
      expect(label.x + label.w).toBeLessThan(x(b));
    });
  });

  test("arrows run lifeline to lifeline, one row below the last", () => {
    expect(out.rows[0]!.points).toEqual([{ x: x("user"), y: out.rows[0]!.points[0]!.y }, { x: x("api"), y: out.rows[0]!.points[0]!.y }]);
    const tops = out.rows.map((r) => Math.min(r.box.y, ...r.points.map((p) => p.y)));
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    expect(out.lifelines.get("api")![1].y).toBeGreaterThan(Math.max(...out.rows.map((r) => r.box.y + r.box.h)));
  });

  test("a self message's label clears the next lifeline", () => {
    const self = out.rows[3]!;
    expect(self.points[1]!.x).toBeGreaterThan(x("api"));
    expect(self.box.x + self.box.w).toBeLessThan(x("db"));
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

test("src/layout imports nothing outside src/layout", () => {
  const dir = join(import.meta.dir, "../src/layout");
  for (const file of readdirSync(dir)) {
    const imports = [...readFileSync(join(dir, file), "utf8").matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    for (const path of imports) expect(`${file}: ${path}`).toMatch(/: \.\/[\w-]+$/);
  }
});
