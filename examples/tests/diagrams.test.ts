import { describe, expect, test } from "bun:test";

describe("the examples' drawn edges never cross", () => {
  type P = { readonly x: number; readonly y: number };

  const cross = (a: P, b: P, c: P, d: P) => {
    const side = (p: P, q: P, r: P) =>
      Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));

    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
  };

  /** Proper crossings between two sampled curves, ignoring the last 20px before a shared end, where merges join. */
  const crossings = (p: readonly P[], q: readonly P[]) => {
    const [end, other] = [p.at(-1)!, q.at(-1)!];

    const near = (s: P) =>
      Math.hypot(s.x - end.x, s.y - end.y) < 20 && Math.hypot(end.x - other.x, end.y - other.y) < 1;

    let n = 0;

    for (let i = 1; i < p.length; i++)
      for (let j = 1; j < q.length; j++)
        if (!near(p[i]!) && cross(p[i - 1]!, p[i]!, q[j - 1]!, q[j]!)) n++;

    return n;
  };

  const count = (lines: readonly (readonly P[])[]) =>
    lines.reduce((n, p, i) => n + lines.slice(i + 1).reduce((m, q) => m + crossings(p, q), 0), 0);

  test("flowchart", async () => {
    const { chart } = await import("../flowchart/index");

    const pairs = [
      ["pr", "gather"],
      ["gather", "analyze"],
      ["memory", "analyze"],
      ["analyze", "lint"],
      ["lint", "issues"],
      ["issues", "fix"],
      ["fix", "lint"],
      ["issues", "post"],
    ] as const;

    expect(count(pairs.map(([a, b]) => chart.edge(a, b)))).toBe(0);
  });

  test("state", async () => {
    const { agent } = await import("../state/index");

    const pairs = [
      ["idle", "working"],
      ["planning", "acting"],
      ["acting", "planning"],
      ["working", "waiting"],
      ["waiting", "working"],
      ["working", "done"],
      ["working", "failed"],
    ] as const;

    expect(count(pairs.map(([a, b]) => agent.edge(a, b)))).toBe(0);
  });
});
