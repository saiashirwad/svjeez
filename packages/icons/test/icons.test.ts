import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exportName } from "../scripts/generate.ts";
import type { Icon } from "../src/icon.ts";
import * as lucide from "../src/lucide.ts";
import * as tabler from "../src/tabler.ts";

const sets = { tabler, lucide } as const;

describe.each(Object.entries(sets))("%s", (_, set) => {
  const icons: [string, Icon][] = Object.entries(set);

  test("every icon is a square grid of nonempty paths", () => {
    expect(icons.length).toBeGreaterThan(1000);

    const broken = icons.filter(
      ([, { grid, kind, paths }]) =>
        !(grid > 0) ||
        !["stroke", "fill"].includes(kind) ||
        paths.length === 0 ||
        paths.some((d) => !/^[Mm]/.test(d)),
    );

    expect(broken.map(([name]) => name)).toEqual([]);
  });
});

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

  test("a filled icon is a fill icon with a Filled suffix", () => {
    expect(tabler.checkFilled.kind).toBe("fill");
    expect(tabler.check.kind).toBe("stroke");
    expect(tabler.arrowLeft.paths.length).toBeGreaterThan(0);
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

describe("exportName", () => {
  test.each([
    ["arrow-left", "arrowLeft"],
    ["rocket-filled", "rocketFilled"],
    ["arrow-up-1-0", "arrowUp1_0"],
    ["arrow-up-10", "arrowUp10"],
    ["delete", "iconDelete"],
    ["3d-cube", "icon3dCube"],
  ])("%s is %s", (file, name) => {
    expect(exportName(file)).toBe(name);
  });
});

test("regenerating writes the committed files", async () => {
  const read = () =>
    ["tabler", "lucide"].map((n) =>
      readFileSync(join(import.meta.dirname, `../src/${n}.ts`), "utf8"),
    );

  const before = read();

  const run = Bun.spawnSync(["bun", join(import.meta.dirname, "../scripts/generate.ts")]);

  expect(run.exitCode).toBe(0);
  expect(read()).toEqual(before);
});
