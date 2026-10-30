import { describe, expect, test } from "bun:test";
import { machine, review, reviewWalk } from "../helpers/diagram-fixtures";

describe("state", () => {
  test("walk throws when consecutive states have no transition", () => {
    expect(() => machine.walk(["idle", "done"], { at: 0 })).toThrow();
  });

  describe("composite", () => {
    test("a walk enters a composite through its initial state and leaves through its transitions", () => {
      const walk = reviewWalk();

      expect(walk.spans.screening).toHaveLength(1);
      expect(() => review.walk(["draft", "decision"], { at: 0 })).toThrow();
    });
  });
});
