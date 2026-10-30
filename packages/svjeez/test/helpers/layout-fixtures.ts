import { lanes } from "../../src/layout/lanes";
import type { Box, Point } from "../../src/layout/box";
import type { LayeredInput } from "../../src/layout/layered";
import { sequence } from "../../src/layout/sequence";

export const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const onBorder = (p: Point, b: Box) => {
  const near = (u: number, v: number) => Math.abs(u - v) < 1e-6;
  const inX = p.x >= b.x - 1e-6 && p.x <= b.x + b.w + 1e-6;
  const inY = p.y >= b.y - 1e-6 && p.y <= b.y + b.h + 1e-6;

  return (
    ((near(p.x, b.x) || near(p.x, b.x + b.w)) && inY) ||
    ((near(p.y, b.y) || near(p.y, b.y + b.h)) && inX)
  );
};

export const nodes = (ids: string, w = 80, h = 36) =>
  ids.split(" ").map((id, i) => ({ id, w: w + (i % 3) * 20, h: h + (i % 2) * 14 }));

export const edges = (list: string) =>
  list.split(" ").map((pair) => ({ from: pair.split(">")[0]!, to: pair.split(">")[1]! }));

export const graphs = {
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

const label = (text: string) => ({ w: text.length * 7.2, h: 17 });

export const routed = {
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

export const segments = (points: readonly Point[]) =>
  points.slice(1).map((q, k) => [points[k]!, q] as const);

export const collinear = ([a, b]: readonly [Point, Point], [c, d]: readonly [Point, Point]) => {
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

export const through = ([p, q]: readonly [Point, Point], b: Box) =>
  Math.max(p.x, q.x) > b.x + 0.5 &&
  Math.min(p.x, q.x) < b.x + b.w - 0.5 &&
  Math.max(p.y, q.y) > b.y + 0.5 &&
  Math.min(p.y, q.y) < b.y + b.h - 0.5;

export const treeInput = {
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

export const sequenceOut = sequence({
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

export const lifelineX = (id: string) => sequenceOut.lifelines.get(id)![0].x;

export const lanesOut = lanes({
  lanes: [
    { id: "a", label: { w: 40, h: 14 } },
    { id: "b", label: { w: 80, h: 14 } },
  ],
  spans: [{ lane: "a", from: 1, to: 3 }],
  events: [{ lane: "b", at: 2 }],
  links: [{ from: "a", to: "b", at: 2.5 }],
  scale: 50,
});
