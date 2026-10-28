import { f2dot14, i16, i8, required, u16, u32, u8, type Sfnt } from "./sfnt";

interface Point {
  readonly x: number;
  readonly y: number;
  readonly on: boolean;
}

type Contour = readonly Point[];

const location = (f: Sfnt, glyph: number): readonly [number, number] => {
  const loca = required(f, "loca");
  const long = i16(f, required(f, "head") + 50) === 1;
  const at = (g: number) => (long ? u32(f, loca + 4 * g) : 2 * u16(f, loca + 2 * g));
  const glyf = required(f, "glyf");

  return [glyf + at(glyph), glyf + at(glyph + 1)];
};

const simple = (f: Sfnt, at: number, contours: number): Contour[] => {
  const ends = Array.from({ length: contours }, (_, i) => u16(f, at + 10 + 2 * i));
  const points = contours === 0 ? 0 : ends[contours - 1]! + 1;
  let p = at + 10 + 2 * contours;
  p += 2 + u16(f, p);
  const flags: number[] = [];

  while (flags.length < points) {
    const flag = u8(f, p++);
    flags.push(flag);

    if (flag & 8) for (let repeat = u8(f, p++); repeat > 0; repeat--) flags.push(flag);
  }

  const coords = (short: number, same: number): number[] => {
    let value = 0;

    return flags.map((flag) => {
      if (flag & short) value += flag & same ? u8(f, p++) : -u8(f, p++);
      else if (!(flag & same)) {
        value += i16(f, p);
        p += 2;
      }

      return value;
    });
  };

  const xs = coords(2, 16);
  const ys = coords(4, 32);
  let start = 0;

  return ends.map((end) => {
    const contour = Array.from({ length: end - start + 1 }, (_, k) => ({
      x: xs[start + k]!,
      y: ys[start + k]!,
      on: (flags[start + k]! & 1) === 1,
    }));

    start = end + 1;

    return contour;
  });
};

const MORE = 0x20;

/** A real glyph has a handful of components. A hostile font can fan them out exponentially through nesting. */
const MAX_COMPONENTS = 4096;

/** Contours of a glyph in font units, y up. Composite glyphs are flattened through each component's offset and matrix. */
export const contours = (
  f: Sfnt,
  glyph: number,
  depth = 0,
  budget = { components: MAX_COMPONENTS },
): Contour[] => {
  const [at, end] = location(f, glyph);

  if (at === end) return [];
  const count = i16(f, at);

  if (count >= 0) return simple(f, at, count);

  if (depth > 8) throw new Error("This font nests composite glyphs too deeply.");
  const result: Contour[] = [];
  let p = at + 10;

  for (let flags = MORE; flags & MORE;) {
    flags = u16(f, p);

    if (--budget.components < 0)
      throw new Error("This font's composite glyphs have too many components.");
    const component = u16(f, p + 2);
    p += 4;
    const words = flags & 1;

    const [dx, dy] =
      flags & 2 ? (words ? [i16(f, p), i16(f, p + 2)] : [i8(f, p), i8(f, p + 1)]) : [0, 0];

    p += words ? 4 : 2;
    let [a, b, c, d] = [1, 0, 0, 1];

    if (flags & 0x08) {
      a = d = f2dot14(f, p);
      p += 2;
    } else if (flags & 0x40) {
      [a, d] = [f2dot14(f, p), f2dot14(f, p + 2)];
      p += 4;
    } else if (flags & 0x80) {
      [a, b, c, d] = [f2dot14(f, p), f2dot14(f, p + 2), f2dot14(f, p + 4), f2dot14(f, p + 6)];
      p += 8;
    }

    for (const contour of contours(f, component, depth + 1, budget))
      result.push(
        contour.map(({ x, y, on }) => ({ x: a * x + c * y + dx, y: b * x + d * y + dy, on })),
      );
  }

  return result;
};

const fixed = (n: number): string => String(Math.round(n * 100) / 100);

/**
 * SVG path data for contours, scaled from font units and placed with its origin at (x, y), y down.
 * TrueType curves are quadratic, with an implied on-curve point between two off-curve points.
 */
export const pathData = (
  outlines: readonly Contour[],
  scale: number,
  x: number,
  y: number,
): string => {
  const px = (p: { x: number; y: number }) => `${fixed(x + p.x * scale)} ${fixed(y - p.y * scale)}`;
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true });

  return outlines
    .flatMap((contour) => {
      if (contour.length <= 1) return [];
      const first = contour.findIndex((p) => p.on);

      const ring =
        first < 0
          ? [mid(contour.at(-1)!, contour[0]!), ...contour]
          : [...contour.slice(first), ...contour.slice(0, first)];

      const start = ring[0]!;
      let d = `M${px(start)}`;
      let control: Point | undefined;

      for (const point of ring.slice(1)) {
        if (point.on) {
          d += control ? `Q${px(control)} ${px(point)}` : `L${px(point)}`;
          control = undefined;
        } else {
          if (control) d += `Q${px(control)} ${px(mid(control, point))}`;
          control = point;
        }
      }

      if (control) d += `Q${px(control)} ${px(start)}`;

      return [`${d}Z`];
    })
    .join("");
};
