import { describe, expect, test } from "bun:test";
import { flowchart, sequence, tree } from "svjeez/extras";
import { machine, spec } from "../helpers/diagram-fixtures";

describe("sequence", () => {
  test("a list of the wrong length throws", () => {
    expect(() =>
      sequence({ actors: { a: "A" }, messages: [["a", "a", "x"]] }, { play: { at: [1, 2] } }),
    ).toThrow();
  });
});

describe("state", () => {
  test("a decreasing list of times throws", () => {
    expect(() => machine.walk(["idle", "run"], { at: [2, 1] })).toThrow();
  });
});

describe("diagram options", () => {
  test("a flowchart list with too few times throws", () => {
    expect(() => flowchart(spec, { play: { at: [1] } })).toThrow(/needs 2 times, got 1/);
  });

  test("a tree list with too many times throws", () => {
    expect(() =>
      tree({ nodes: { r: "R", k: { label: "K", parent: "r" } } }, { play: { at: [1, 2] } }),
    ).toThrow(/needs 1 times, got 2/);
  });
});
