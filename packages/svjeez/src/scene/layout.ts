import type { Box, Vec } from "./ir";
import { flat, type Child, type Common, type SceneElement } from "./nodes";
import { Anchor, canvasAnchor, fractionOf, placeIn, Ref, type Place } from "./refs";
import type { Arrange } from "./settle";

/**
 * Layout containers. Each lowers into a plain group that measures its children's boxes and places every child so its
 * box lands in its slot, wherever the child's own origin is: a circle's is its center, a rect's its top-left. A child
 * in a container has no `at` of its own, since the container places it; motion layers and `rotate`, `scale` and
 * `opacity` still apply, around where it was placed, because layout reads the box at rest.
 */
export type Alignment = "start" | "center" | "end";

const SHARE: Readonly<Record<Alignment, number>> = { start: 0, center: 0.5, end: 1 };

const share = (value: Alignment, what: string): number => {
  const found = SHARE[value];

  if (found === undefined)
    throw new Error(`${what} takes "start", "center" or "end", got "${String(value)}".`);

  return found;
};

const isPair = (value: number | Vec): value is Vec => Array.isArray(value);

/** A length, or one across and one down, checked to be finite and not negative. */
const room = (value: number | Vec, what: string): Vec => {
  const [x, y] = isPair(value) ? value : [value, value];

  if (!(x >= 0 && y >= 0 && Number.isFinite(x + y)))
    throw new Error(`${what} needs finite lengths of 0 or more, got ${x} and ${y}.`);

  return [x, y];
};

/** Where each of `sizes` starts when they follow one another from `from`, `space` apart, and where the last ends. */
const run = (sizes: readonly number[], from: number, space: number) => {
  let at = from;

  const starts = sizes.map((size) => {
    const start = at;

    at += size + space;

    return start;
  });

  return { starts, end: sizes.length === 0 ? from : at - space };
};

export interface StackProps extends Common {
  /** Default `column`. */
  readonly direction?: "row" | "column";
  /** Between two children. Default 0. */
  readonly gap?: number;
  /** Where each child sits across the stack. Default `start`. */
  readonly align?: Alignment;
  /** Room around the children, inside the stack's box: one length, or one across and one down. Default 0. */
  readonly padding?: number | Vec;
  readonly children?: Child;
}

/**
 * Children one after another along a row or a column, `gap` apart. The stack's frame starts at the top-left of its
 * box, padding included, so its `at` puts that corner.
 */
export const Stack = ({
  direction = "column",
  gap = 0,
  align = "start",
  padding = 0,
  children,
  ...props
}: StackProps): SceneElement => {
  if (direction !== "row" && direction !== "column")
    throw new Error(`<Stack> takes direction "row" or "column", got "${String(direction)}".`);
  const [space] = room(gap, "<Stack> gap");
  const [px, py] = room(padding, "<Stack> padding");
  const cross = share(align, "<Stack> align");
  const row = direction === "row";

  const arrange: Arrange = (boxes) => {
    const mains = boxes.map((box) => (row ? box.width : box.height));
    const sides = boxes.map((box) => (row ? box.height : box.width));
    const across = Math.max(0, ...sides);
    const [lead, edge] = row ? [px, py] : [py, px];
    const { starts, end } = run(mains, lead, space);

    const slots = starts.map((start, i): Vec => {
      const side = edge + (across - sides[i]!) * cross;

      return row ? [start, side] : [side, start];
    });

    const [length, breadth] = [end + lead, across + edge * 2];

    return {
      slots,
      box: { x: 0, y: 0, width: row ? length : breadth, height: row ? breadth : length },
    };
  };

  return {
    type: "group",
    props,
    children: flat(children),
    settle: { kind: "arrange", label: "<Stack>", arrange },
    layout: { container: "stack", direction, gap: row ? [space, 0] : [0, space] },
  };
};

export interface GridProps extends Common {
  /** How many cells across. Children fill rows from the left. */
  readonly columns: number;
  /** Between two cells: one length, or one across and one down. Default 0. */
  readonly gap?: number | Vec;
  /** Where a child sits across its cell. Default `start`. */
  readonly justify?: Alignment;
  /** Where a child sits down its cell. Default `start`. */
  readonly align?: Alignment;
  readonly padding?: number | Vec;
  readonly children?: Child;
}

/**
 * Children in rows of `columns` cells. Each column is as wide as its widest child and each row as tall as its tallest.
 * The grid's frame starts at the top-left of its box, padding included.
 */
export const Grid = ({
  columns,
  gap = 0,
  justify = "start",
  align = "start",
  padding = 0,
  children,
  ...props
}: GridProps): SceneElement => {
  if (!(Number.isInteger(columns) && columns >= 1))
    throw new Error(`<Grid> needs a whole number of columns, 1 or more, got ${columns}.`);
  const [gx, gy] = room(gap, "<Grid> gap");
  const [px, py] = room(padding, "<Grid> padding");
  const [u, v] = [share(justify, "<Grid> justify"), share(align, "<Grid> align")];

  const arrange: Arrange = (boxes) => {
    const widths = Array.from({ length: Math.min(columns, boxes.length) }, () => 0);
    const heights = Array.from({ length: Math.ceil(boxes.length / columns) }, () => 0);

    boxes.forEach((box, i) => {
      const [column, line] = [i % columns, Math.floor(i / columns)];

      widths[column] = Math.max(widths[column]!, box.width);
      heights[line] = Math.max(heights[line]!, box.height);
    });

    const across = run(widths, px, gx);
    const down = run(heights, py, gy);

    return {
      slots: boxes.map((box, i): Vec => {
        const [column, line] = [i % columns, Math.floor(i / columns)];

        return [
          across.starts[column]! + (widths[column]! - box.width) * u,
          down.starts[line]! + (heights[line]! - box.height) * v,
        ];
      }),
      box: { x: 0, y: 0, width: across.end + px, height: down.end + py },
    };
  };

  return {
    type: "group",
    props,
    children: flat(children),
    settle: { kind: "arrange", label: "<Grid>", arrange },
    layout: { container: "grid", gap: [gx, gy] },
  };
};

export interface AlignProps extends Omit<Common, "at"> {
  /**
   * What to place the children against: the canvas (the default), a box in the parent's frame, or a node's box by its
   * ref. Against a node that moves, the children move with it.
   */
  readonly to?: "canvas" | Box | Ref;
  /** Which point of `to` the children's boxes take: the same point of each box lands on it. Default `center`. */
  readonly place?: Place;
  /** How far in from the edges `place` names: one length, or one across and one down. Default 0. */
  readonly inset?: number | Vec;
  readonly children?: Child;
}

/**
 * Places children against a box: `place="top-right"` puts each child's top-right corner on the top-right corner of
 * `to`, `inset` in from both edges. Its frame's origin is that point. It places itself, so it takes no `at` and
 * can't sit in another container.
 */
export const Align = ({
  to = "canvas",
  place = "center",
  inset = 0,
  children,
  ...props
}: AlignProps): SceneElement => {
  if ("at" in props)
    throw new Error(
      "<Align> places itself against its to, so it takes no at. Move it in with inset.",
    );
  const [u, v] = fractionOf(place, "<Align>");
  const gap = room(inset, "<Align> inset");
  const label = `<Align place="${place}">`;

  const at =
    to === "canvas"
      ? canvasAnchor(`the canvas's ${place}`, (box) => placeIn(box, place, gap, label))
      : to instanceof Ref
        ? new Anchor(to, `${to.label} (${place})`, (box) => placeIn(box, place, gap, label))
        : placeIn(to, place, gap, label);

  const arrange: Arrange = (boxes) => {
    const slots = boxes.map((box): Vec => [-box.width * u, -box.height * v]);
    const xs = boxes.flatMap((box, i) => [slots[i]![0], slots[i]![0] + box.width]);
    const ys = boxes.flatMap((box, i) => [slots[i]![1], slots[i]![1] + box.height]);

    if (boxes.length === 0) return { slots, box: { x: 0, y: 0, width: 0, height: 0 } };
    const [x, y] = [Math.min(...xs), Math.min(...ys)];

    return { slots, box: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y } };
  };

  return {
    type: "group",
    props: { ...props, at },
    children: flat(children),
    settle: { kind: "arrange", label: "<Align>", arrange },
    layout: { container: "align" },
  };
};
