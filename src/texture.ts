import { hexBytes } from "./color";
import { def, type Ref } from "./defs";
import { el } from "./el";
import { num } from "./format";
import type { Point } from "./layout/box";
import type { SvgNode } from "./svg";

export type Hex = `#${string}`;

/** One character per color. `null` is a transparent pixel. */
export type Palette = Readonly<Record<string, Hex | null>>;

declare const textureBrand: unique symbol;

/** A parsed pixel grid. It maps onto a face with row 0 at the top. */
export interface Texture {
  readonly [textureBrand]: true;
  readonly width: number;
  readonly height: number;
}

export type Face = "top" | "north" | "south" | "east" | "west";

/** Every face resolves: a bare texture covers all five, and any face not named falls back to `side`. */
export type Skin = Texture | ({ readonly side: Texture } & { readonly [F in Face]?: Texture });

const HEX = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i;

/** The 8-digit forms carry alpha; `#rgb` and `#rrggbb` are always solid. */
const alphaOf = (color: Hex): number => (color.length === 9 ? parseInt(color.slice(7), 16) : 255);

const runs = (rows: readonly (readonly (Hex | null)[])[], color: Hex): string =>
  rows
    .flatMap((row, y) => {
      const out: string[] = [];
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== color) continue;
        const start = x;
        while (row[x + 1] === color) x++;
        out.push(`M${start} ${y}h${x - start + 1}v1h${start - x - 1}z`);
      }
      return out;
    })
    .join("");

class Grid {
  readonly opaque: boolean;
  readonly colors: readonly Hex[];
  readonly base: Hex | undefined;
  readonly paths: ReadonlyMap<Hex, string>;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly rows: readonly (readonly (Hex | null)[])[],
  ) {
    const tally = new Map<Hex, number>();
    let solid = true;
    for (const row of rows) {
      for (const pixel of row) {
        if (pixel === null || alphaOf(pixel) !== 255) solid = false;
        if (pixel !== null) tally.set(pixel, (tally.get(pixel) ?? 0) + 1);
      }
    }
    const colors = [...tally.keys()];
    this.opaque = solid;
    this.colors = colors;
    this.base = solid ? colors.reduce((best, color) => (tally.get(color)! > tally.get(best)! ? color : best)) : undefined;
    this.paths = new Map(colors.map((color) => [color, runs(rows, color)]));
  }
}

const gridOf = (texture: Texture): Grid => texture as unknown as Grid;

export const isOpaque = (texture: Texture): boolean => gridOf(texture).opaque;

const shaded = (color: Hex, shade: number): Hex => {
  const [r, g, b, a] = hexBytes(color);
  const hex = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return `#${hex(r * shade)}${hex(g * shade)}${hex(b * shade)}${a === 255 ? "" : hex(a)}`;
};

/** Parse pixel art. Each line is a row and each character a palette key. */
export const texture = (palette: Palette, art: string): Texture => {
  const lines = art.split("\n").filter((line) => line.trim() !== "");
  const indent = Math.min(...lines.map((line) => line.length - line.trimStart().length));
  const rows = lines.map((line) => [...line.slice(indent).trimEnd()]);
  const width = rows[0]?.length ?? 0;
  if (width === 0) throw new Error("texture() needs at least one row of pixels.");
  for (const color of Object.values(palette)) if (color !== null && !HEX.test(color)) throw new Error(`texture() takes #rgb, #rrggbb or #rrggbbaa colors, got ${color}.`);
  const pixels = rows.map((row, y) => {
    if (row.length !== width) throw new Error(`texture() row ${y} has ${row.length} pixels; row 0 has ${width}.`);
    return row.map((key) => {
      const color = palette[key];
      if (color === undefined) throw new Error(`texture() row ${y} uses "${key}", which the palette lacks.`);
      return color;
    });
  });
  return new Grid(width, rows.length, pixels) as unknown as Texture;
};

export const resolve = (skin: Skin, face: Face): Texture => ("side" in skin ? (skin[face] ?? skin.side) : skin);

const faded = new WeakMap<Grid, Map<number, Ref<"symbol">>>();

/** The texture in pixel units, darkened by `shade`. An opaque one sits on its commonest color, so no seam shows between runs. */
const symbolOf = (grid: Grid, shade: number): Ref<"symbol"> => {
  let shades = faded.get(grid);
  if (!shades) faded.set(grid, (shades = new Map()));
  const known = shades.get(shade);
  if (known) return known;
  const symbol = def.symbol({ style: "overflow:visible" }, [
    grid.base && el.rect({ width: grid.width, height: grid.height, fill: shaded(grid.base, shade) }),
    grid.colors.filter((color) => color !== grid.base).map((color) => el.path({ d: grid.paths.get(color)!, fill: shaded(color, shade) })),
  ]);
  shades.set(shade, symbol);
  return symbol;
};

export const face = (texture: Texture, shade: number, origin: Point, u: Point, v: Point, bleed: number): SvgNode => {
  const grid = gridOf(texture);
  const grow = 1 + 2 * bleed;
  const [a, b, c, d] = [(u.x * grow) / grid.width, (u.y * grow) / grid.width, (v.x * grow) / grid.height, (v.y * grow) / grid.height];
  const [e, f] = [origin.x - bleed * (u.x + v.x), origin.y - bleed * (u.y + v.y)];
  return el.use({ href: symbolOf(grid, shade), transform: `matrix(${[a, b, c, d, e, f].map((n) => num(n, 4)).join(" ")})` });
};
