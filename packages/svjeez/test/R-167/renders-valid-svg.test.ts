import { describe, expect, test } from "bun:test";
import { flowchart } from "svjeez/extras";
import {
  chart,
  el,
  machine,
  review,
  reviewWalk,
  run,
  seq,
  team,
  valid,
} from "../helpers/diagram-fixtures";

describe("flowchart", () => {
  test("renders valid SVG, static and revealed", () => {
    expect(() => valid(chart.node)).not.toThrow();
    expect(() => valid(flowchart({ nodes: { a: "A" }, edges: [] }).node)).not.toThrow();
  });
});

describe("sequence", () => {
  test("renders valid SVG", () => expect(() => valid(seq.node)).not.toThrow());
});

describe("state", () => {
  test("a walk renders valid SVG", () => {
    const walk = machine.walk(["idle", "run", "idle", "run", "done"], {
      at: 1,
      dwell: 1,
      speed: 1e9,
    });

    expect(() => valid(el.g({}, [machine.node, walk.node]))).not.toThrow();
  });

  test("a walk through a composite renders valid SVG", () => {
    expect(() => valid(el.g({}, [review.node, reviewWalk().node]))).not.toThrow();
  });
});

describe("tree", () => {
  test("renders valid SVG", () => expect(() => valid(team.node)).not.toThrow());
});

describe("lanes", () => {
  test("renders valid SVG", () => expect(() => valid(run.node)).not.toThrow());
});
