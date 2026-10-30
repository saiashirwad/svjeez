import { describe, expect, test } from "bun:test";
import { lanesOut as out, overlap } from "../helpers/layout-fixtures";

describe("lanes", () => {
  test("marks sit inside their lane's row and links join the two rows", () => {
    const [a, b] = [out.rows.get("a")!, out.rows.get("b")!];
    expect(overlap(out.spans[0]!, a)).toBe(true);
    expect(out.events[0]!.at.y).toBe(b.y + b.h / 2);
    const [p, q] = out.links[0]!;
    expect([p.x, q.x]).toEqual([out.x(2.5), out.x(2.5)]);
    expect(p.y > a.y && p.y < a.y + a.h && q.y > b.y && q.y < b.y + b.h).toBe(true);
  });
});
