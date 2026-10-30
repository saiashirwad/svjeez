import { describe, expect, test } from "bun:test";
import { tree } from "../../src/layout/tree";

describe("tree", () => {
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
