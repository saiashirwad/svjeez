import { describe, expect, test } from "bun:test";
import { motion, render, voxel, type Block, type Vec3 } from "svg-motion";

const DURATION = 10;
const camera = voxel.camera({ yaw: 45, pitch: 30, unit: 10 });
const solid = (color: `#${string}`) => voxel.texture({ x: color }, "x");
const [red, green, blue] = [solid("#ff0000"), solid("#00ff00"), solid("#0000ff")];

const build = (blocks: readonly Block[]) =>
  render({ width: 200, height: 200, duration: DURATION, title: "Test" }, voxel.scene({ camera, blocks }));

const place = (at: Vec3, extra: Partial<Block> = {}): Block => ({ at, skin: red, ...extra });

const uses = (svg: string) =>
  [...svg.slice(svg.indexOf("<g>")).matchAll(/<use href="#(\w+)" x="([^"]+)" y="([^"]+)"(?: class="([^"]+)")?/g)].map(([, href, x, y, cls]) => ({
    href: href!,
    x: Number(x),
    y: Number(y),
    cls,
  }));

const topColor = (svg: string, href: string): string => {
  const symbol = svg.match(new RegExp(`<symbol id="${href}"[^>]*>([\\s\\S]*?)</symbol>`))![1]!;
  const top = [...symbol.matchAll(/href="#(\w+)"/g)].at(-1)![1]!;
  return svg.match(new RegExp(`<symbol id="${top}"[^>]*>\\s*<rect[^>]*fill="(#\\w+)"`))![1]!;
};

const cellAt = (cells: readonly Vec3[]) => (use: { x: number; y: number }) =>
  cells.find((cell) => Math.abs(camera.project(cell).x - use.x) < 0.01 && Math.abs(camera.project(cell).y - use.y) < 0.01);

const presenceAt = (svg: string, cls: string, t: number): number => {
  const name = svg.match(new RegExp(`\\.${cls.split(" ").at(-1)}\\{animation-name:([\\w-]+)`))![1]!;
  const body = svg.match(new RegExp(`@keyframes ${name}\\{(.*)\\}$`, "m"))![1]!;
  const keys = [...body.matchAll(/([\d.%,]+)\{visibility:(hidden|visible)\}/g)].flatMap(([, percents, value]) =>
    percents!.split(",").map((percent) => ({ at: (parseFloat(percent) / 100) * DURATION, value: value === "visible" ? 1 : 0 })),
  );
  return keys.filter((key) => key.at <= t).sort((a, b) => a.at - b.at).at(-1)!.value;
};

describe("voxel.scene", () => {
  test("blocks come out back to front however they are given", () => {
    const cells: Vec3[] = [[1, 1, 0], [0, 0, 0], [2, 0, 2], [0, 0, 1], [0, 1, 0], [1, 0, 3]];
    const depth = (cell: Vec3) => cell[0] + cell[1] + cell[2];
    const order = uses(build(cells.map((at) => place(at)))).map(cellAt(cells));
    expect(order.map((cell) => depth(cell!))).toEqual(cells.map(depth).sort((a, b) => a - b));
  });

  test("blocks sharing a cell keep the order given", () => {
    const colors = (blocks: readonly Block[]) => {
      const svg = build(blocks);
      return uses(svg).map((use) => topColor(svg, use.href));
    };
    expect(colors([place([0, 0, 0], { skin: red }), place([0, 0, 0], { skin: green })])).toEqual(["#ff0000", "#00ff00"]);
    expect(colors([place([0, 0, 0], { skin: green }), place([0, 0, 0], { skin: red })])).toEqual(["#00ff00", "#ff0000"]);
  });

  test("from and until toggle visibility at those times", () => {
    const svg = build([place([0, 0, 0], { from: 2, until: 6 })]);
    const cls = uses(svg)[0]!.cls!;
    expect([0, 1.9, 2.1, 5.9, 6.1, 9.9].map((t) => presenceAt(svg, cls, t))).toEqual([0, 0, 1, 1, 0, 0]);
  });

  test("a block with no lifetime has no animation", () => {
    expect(uses(build([place([0, 0, 0])]))[0]!.cls).toBeUndefined();
  });

  test("a block animation rides on its own use", () => {
    const svg = build([place([0, 0, 0], { animation: motion({ y: -20 }).to({ y: 0 }, 1) })]);
    expect(uses(svg)[0]!.cls).toMatch(/\ba\b/);
    expect(svg).toContain("translate:0px -20px");
  });

  describe("a block behind its three nearer neighbors", () => {
    const hidden = place([0, 0, 0]);
    const cover = (extra: Partial<Block> = {}) => ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const).map((at) => place(at, { skin: green, ...extra }));
    const count = (covers: readonly Block[]) => uses(build([hidden, ...covers])).length;

    test("is absent", () => expect(count(cover())).toBe(3));

    test.each([
      ["an animation", { animation: motion({ y: -5 }).to({ y: 0 }, 1) }],
      ["a transparent skin", { skin: voxel.texture({ x: "#00ff00", ".": null }, "x.") }],
      ["a later start", { from: 1 }],
    ] as const)("is present when a neighbor has %s", (_, extra) => {
      expect(count([cover(extra)[0]!, ...cover().slice(1)])).toBe(4);
    });

    test("is present when a neighbor lives a shorter time", () => {
      expect(uses(build([place([0, 0, 0], { until: 8 }), ...cover({ until: 5 })])).length).toBe(4);
    });

    test("is absent when a neighbor outlives it", () => {
      expect(uses(build([place([0, 0, 0], { from: 2, until: 5 }), ...cover({ from: 1, until: 7 })])).length).toBe(3);
    });
  });

  test("a solid 3x3x3 cube keeps only the blocks on its three nearer faces", () => {
    const cells = Array.from({ length: 27 }, (_, i): Vec3 => [i % 3, Math.floor(i / 3) % 3, Math.floor(i / 9)]);
    const shown = uses(build(cells.map((at) => place(at)))).map(cellAt(cells));
    expect(shown.length).toBe(19);
    expect(shown.every((cell) => cell!.some((axis) => axis === 2))).toBe(true);
  });

  test("blocks with the same skin share one symbol", () => {
    const hrefs = uses(build([place([0, 0, 0]), place([1, 0, 0], { skin: green }), place([2, 0, 0]), place([3, 0, 0], { skin: green }), place([4, 0, 0], { skin: blue })]));
    expect(hrefs[0]!.href).toBe(hrefs[2]!.href);
    expect(hrefs[1]!.href).toBe(hrefs[3]!.href);
    expect(new Set(hrefs.map((use) => use.href)).size).toBe(3);
  });

  test("a skin names a face and the rest fall back to its side", () => {
    const svg = build([{ at: [0, 0, 0], skin: { side: red, top: green } }]);
    expect(topColor(svg, uses(svg)[0]!.href)).toBe("#00ff00");
  });

  test("output is byte-identical across runs", () => {
    const blocks = [place([0, 0, 0]), place([1, 0, 0], { skin: green, from: 1, until: 4 }), place([0, 1, 0], { skin: blue })];
    expect(build(blocks)).toBe(build(blocks));
  });

  test("nothing animated sits inside a def", () => {
    const svg = build([place([0, 0, 0], { from: 1 })]);
    expect(svg.slice(svg.indexOf("<defs>"), svg.indexOf("</defs>"))).not.toContain('class="a');
  });

  test("a cell must be whole and a lifetime must run forward", () => {
    expect(() => build([place([0.5, 0, 0])])).toThrow(/whole cell/);
    expect(() => build([place([0, 0, 0], { from: 4, until: 4 })])).toThrow(/from < until/);
  });
});

describe("voxel.texture", () => {
  test("rejects a ragged row, an unknown key and a color it cannot shade", () => {
    expect(() => voxel.texture({ a: "#fff" }, "aa\na")).toThrow(/row 1/);
    expect(() => voxel.texture({ a: "#fff" }, "ab")).toThrow(/"b"/);
    expect(() => voxel.texture({ a: "red" as "#fff" }, "a")).toThrow(/red/);
  });
});

describe("voxel.camera", () => {
  test("projects linearly, so a path projects to the path of its projection", () => {
    const [a, b] = [camera.project([1, 2, 3]), camera.project([4, 0, 1])];
    const mid = camera.project([2.5, 1, 2]);
    expect(mid.x).toBeCloseTo((a.x + b.x) / 2);
    expect(mid.y).toBeCloseTo((a.y + b.y) / 2);
  });

  test("a block's height is its vertical edge", () => {
    const { y } = camera.project([0, 1, 0]);
    expect(y).toBeCloseTo(-10 * Math.cos(Math.PI / 6));
  });
});
