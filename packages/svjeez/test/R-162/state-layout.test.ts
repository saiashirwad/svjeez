import { describe, expect, test } from "bun:test";
import { inside, machine, review, touches } from "../helpers/diagram-fixtures";

describe("state", () => {
  test("the initial state sits below its marker and a final state above its bullseye", () => {
    expect(machine.get("idle").y).toBeGreaterThan(machine.bounds.y + 14);
    expect(machine.bounds.y + machine.bounds.h).toBeGreaterThan(
      machine.get("done").y + machine.get("done").h + 18,
    );
  });

  describe("composite", () => {
    test("inner states sit inside their container, below its header", () => {
      for (const id of ["screening", "decision"] as const) {
        expect(inside(review.get("review"), review.get(id))).toBe(true);
        expect(review.get(id).y).toBeGreaterThan(review.get("review").y + 30);
      }
    });

    test("a transition to the composite ends on its border; one from an inner state leaves the container", () => {
      const into = review.edge("draft", "review").at(-1)!;
      expect(into.y).toBeCloseTo(review.get("review").y, 6);
      const out = review.edge("decision", "published");
      expect(touches(out[0]!, review.get("review"))).toBe(true);
      expect(inside(review.get("review"), review.get("published"))).toBe(false);
    });
  });
});
