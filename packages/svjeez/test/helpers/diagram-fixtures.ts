import { el, render, type Rect, type SvgNode } from "svjeez";
import { flowchart, sequence, stateMachine, tree, lanes } from "svjeez/extras";

export const valid = (node: SvgNode) =>
  render({ width: 800, height: 600, duration: 10, title: "diagram" }, node);

export const inside = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - 1e-6 &&
  inner.y >= outer.y - 1e-6 &&
  inner.x + inner.w <= outer.x + outer.w + 1e-6 &&
  inner.y + inner.h <= outer.y + outer.h + 1e-6;

export const touches = (p: { x: number; y: number }, b: Rect) =>
  p.x >= b.x - 1e-6 && p.x <= b.x + b.w + 1e-6 && p.y >= b.y - 1e-6 && p.y <= b.y + b.h + 1e-6;

export const chart = flowchart(
  {
    nodes: {
      start: { label: "Start", role: "input" },
      check: { label: "Ok?", role: "decision" },
      work: "Work",
      db: { label: "Save", role: "store" },
      end: { label: "Done", role: "output" },
    },
    groups: { core: { label: "Core", nodes: ["check", "work"] } },
    edges: [
      ["start", "check"],
      ["check", "work", { label: "yes" }],
      ["work", "check"],
      ["check", "db", { label: "no" }],
      ["db", "end"],
    ],
  },
  { x: 100, y: 50, play: { at: 1 } },
);

export const seq = sequence(
  {
    actors: { user: "User", api: { label: "API" }, db: { label: "Postgres", role: "store" } },
    messages: [
      ["user", "api", "POST /login"],
      ["api", "db", "select"],
      ["db", "api", "row", { reply: true }],
      ["api", "api", "hash"],
      { note: "api", text: "ok" },
    ],
  },
  { play: { at: 2, step: 0.5 } },
);

export const machine = stateMachine({
  states: { idle: "Idle", run: { label: "Running" }, done: { label: "Done", final: true } },
  initial: "idle",
  transitions: [
    ["idle", "run", "start"],
    ["run", "idle", "pause"],
    ["run", "done"],
  ],
});

export const review = stateMachine({
  states: {
    draft: "Draft",
    review: {
      label: "Review",
      states: { screening: "Screening", decision: "Decision" },
      initial: "screening",
    },
    published: { label: "Published", final: true },
  },
  initial: "draft",
  transitions: [
    ["draft", "review", "submit"],
    ["screening", "decision"],
    ["review", "draft", "rejected"],
    ["decision", "published", "approved"],
  ],
});

export const reviewWalk = () =>
  review.walk(["draft", "review", "screening", "decision", "published"], { at: 0 });

export const spec = {
  nodes: { a: "A", b: "B", c: "C" },
  edges: [
    ["a", "b"],
    ["b", "c"],
  ],
} as const;

export const team = tree(
  {
    nodes: {
      root: "Root",
      a: { label: "A", parent: "root" },
      b: { label: "B", parent: "root", role: "tool" },
      a1: { label: "A1", parent: "a" },
    },
  },
  { play: { at: 1 } },
);

export const run = lanes(
  {
    lanes: { a: "A", b: { label: "B", role: "tool" } },
    spans: [{ lane: "a", from: 0, to: 2, label: "busy" }],
    events: [{ lane: "b", at: 1, label: "READ" }],
    links: [{ from: "a", to: "b", at: 1.5 }],
  },
  { scale: 50, x: 10, y: 20, play: { at: 0 } },
);

export { el };
