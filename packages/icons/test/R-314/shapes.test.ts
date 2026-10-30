import { describe, expect, test } from "bun:test";
import * as lucide from "../../src/lucide.ts";
import * as tabler from "../../src/tabler.ts";

describe("tabler", () => {
  test("an outline icon keeps its pieces and drops the invisible frame", () => {
    expect(tabler.rocket).toEqual({
      grid: 24,
      kind: "stroke",
      paths: [
        "M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3",
        "M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3",
        "M14 9a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
      ],
    });

    const frames = Object.values(tabler).filter(({ paths }) => paths.includes("M0 0h24v24H0z"));

    expect(frames).toEqual([]);
  });
});

describe("lucide", () => {
  test("a circle becomes arcs", () => {
    expect(lucide.circle).toEqual({
      grid: 24,
      kind: "stroke",
      paths: ["M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0"],
    });
  });

  test("a rounded rect becomes a path that closes", () => {
    const [d] = lucide.square.paths;

    expect(d).toBe(
      "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z",
    );
  });
});
