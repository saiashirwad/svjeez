export type Point = { readonly x: number; readonly y: number };

export interface Size {
  readonly w: number;
  readonly h: number;
}

export interface Box extends Point, Size {}

/** Rank axis down the page (`TB`) or across it (`LR`). */
export type Direction = "TB" | "LR";

// SAFETY: a Box flips to a Box and a Point to a Point, so the result has the same keys as T
export const flip = <T extends Box | Point>(value: T): T =>
  ("w" in value
    ? { x: value.y, y: value.x, w: value.h, h: value.w }
    : { x: value.y, y: value.x }) as T;

export const union = (boxes: readonly Box[]): Box => {
  const [left, top] = [Math.min(...boxes.map((b) => b.x)), Math.min(...boxes.map((b) => b.y))];

  return {
    x: left,
    y: top,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - left,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - top,
  };
};

export const around = (points: readonly Point[]): Box =>
  union(points.map((p) => ({ ...p, w: 0, h: 0 })));

/** Drops repeated points and the middle of three in a straight line. */
export const simplify = (points: readonly Point[]): Point[] =>
  points.reduce<Point[]>((out, p) => {
    const [a, b] = [out.at(-2), out.at(-1)];

    if (b && b.x === p.x && b.y === p.y) return out;

    if (a && b && ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y)))
      out[out.length - 1] = p;
    else out.push(p);

    return out;
  }, []);

/** Each id's position in `ids`, and a lookup that throws `missing(id)` for an id not among them. `unique` is false when an id repeats. */
export const indexing = (ids: readonly string[], missing: (id: string) => string) => {
  const index = new Map(ids.map((id, i) => [id, i]));

  return {
    unique: index.size === ids.length,
    at: (id: string): number => {
      const i = index.get(id);

      if (i === undefined) throw new Error(missing(id));

      return i;
    },
  };
};
