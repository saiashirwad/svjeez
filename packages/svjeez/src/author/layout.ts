import type { Box, Vec } from "../model/ir";
import { flat, type Child, type Common, type SceneElement } from "./nodes";
import { Anchor, canvasAnchor, fractionOf, placeIn, Ref, type Place } from "./refs";
import type { Arrange } from "./settle";

export type Alignment = "start" | "center" | "end";

const SHARE: Readonly<Record<Alignment, number>> = { start: 0, center: 0.5, end: 1 };

const share = (value: Alignment, what: string): number => {
  const found = SHARE[value];

  if (found === undefined)
    throw new Error(`${what} takes "start", "center" or "end", got "${String(value)}".`);

  return found;
};

const isPair = (value: number | Vec): value is Vec => Array.isArray(value);

const room = (value: number | Vec, what: string): Vec => {
  const [x, y] = isPair(value) ? value : [value, value];

  if (!(x >= 0 && y >= 0 && Number.isFinite(x + y)))
    throw new Error(`${what} needs finite lengths of 0 or more, got ${x} and ${y}.`);

  return [x, y];
};

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
  readonly direction?: "row" | "column";
  readonly gap?: number;
  readonly align?: Alignment;
  readonly padding?: number | Vec;
  readonly children?: Child;
}

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
  readonly columns: number;
  readonly gap?: number | Vec;
  readonly justify?: Alignment;
  readonly align?: Alignment;
  readonly padding?: number | Vec;
  readonly children?: Child;
}

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

export interface AlignProps extends Omit<Common, "at" | "anchor"> {
  readonly to?: "canvas" | Box | Ref;
  readonly place?: Place;
  readonly inset?: number | Vec;
  readonly children?: Child;
}

export const Align = ({
  to = "canvas",
  place = "center",
  inset = 0,
  children,
  ...props
}: AlignProps): SceneElement => {
  if ("at" in props || "anchor" in props)
    throw new Error(
      `<Align> places itself against its to, so it takes no ${"at" in props ? "at" : "anchor"}. Move it in with inset, and say which point lands where with place.`,
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
