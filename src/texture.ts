import { def, type Ref } from "./defs";
import { el } from "./el";
import { num } from "./format";
import type { Point } from "./space";
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

class Grid {
  private static count = 0;
  readonly id = Grid.count++;
  readonly opaque: boolean;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly rows: readonly (readonly (Hex | null)[])[],
  ) {
    this.opaque = rows.every((row) => row.every((pixel) => pixel !== null && channels(pixel)[3] === 255));
  }
}

const gridOf = (texture: Texture): Grid => texture as unknown as Grid;

export const idOf = (texture: Texture): number => gridOf(texture).id;

/** Whether every pixel is solid, so a block wearing it hides what is behind it. */
export const isOpaque = (texture: Texture): boolean => gridOf(texture).opaque;

const HEX = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i;

const channels = (color: Hex): readonly [number, number, number, number] => {
  const digits = color.slice(1);
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
  const [r, g, b, a = 255] = (full.match(/../g) ?? []).map((pair) => parseInt(pair, 16));
  return [r!, g!, b!, a];
};

const shaded = (color: Hex, shade: number): Hex => {
  const [r, g, b, a] = channels(color);
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

const runs = (grid: Grid, color: Hex): string =>
  grid.rows
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

const faded = new WeakMap<Grid, Map<number, Ref<"symbol">>>();

/** The texture in pixel units, darkened by `shade`. An opaque one sits on its commonest color, so no seam shows between runs. */
const symbolOf = (grid: Grid, shade: number): Ref<"symbol"> => {
  const known = faded.get(grid)?.get(shade);
  if (known) return known;
  const colors = [...new Set(grid.rows.flat().filter((pixel): pixel is Hex => pixel !== null))];
  const count = (color: Hex) => grid.rows.flat().filter((pixel) => pixel === color).length;
  const base = grid.opaque ? colors.reduce((best, color) => (count(color) > count(best) ? color : best)) : undefined;
  const symbol = def.symbol({ style: "overflow:visible" }, [
    base && el.rect({ width: grid.width, height: grid.height, fill: shaded(base, shade) }),
    colors.filter((color) => color !== base).map((color) => el.path({ d: runs(grid, color), fill: shaded(color, shade) })),
  ]);
  faded.set(grid, (faded.get(grid) ?? new Map()).set(shade, symbol));
  return symbol;
};

/**
 * The texture on the screen parallelogram `origin`, `origin + u`, `origin + v`, grown by `bleed` of an edge on every
 * side so faces that abut leave no antialiased seam.
 */
export const face = (texture: Texture, shade: number, origin: Point, u: Point, v: Point, bleed: number): SvgNode => {
  const grid = gridOf(texture);
  const grow = 1 + 2 * bleed;
  const [a, b, c, d] = [(u.x * grow) / grid.width, (u.y * grow) / grid.width, (v.x * grow) / grid.height, (v.y * grow) / grid.height];
  const [e, f] = [origin.x - bleed * (u.x + v.x), origin.y - bleed * (u.y + v.y)];
  return el.use({ href: symbolOf(grid, shade), transform: `matrix(${[a, b, c, d, e, f].map((n) => num(n, 4)).join(" ")})` });
};
