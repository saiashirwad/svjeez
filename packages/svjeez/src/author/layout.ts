import { SceneError } from "../model/scene-error";
import type { Box, Vec } from "../model/ir";
import { EPSILON } from "../model/time";
import { flat, type Backdrop, type Child, type Common, type SceneElement } from "./nodes";
import { restOf } from "./derived";
import { Anchor, canvasAnchor, fractionOf, placeIn, Ref, type Place } from "./refs";
import type { Arrange, Size } from "./settle";

/** Where something sits in free room: a name, or a fraction from 0 (start) to 1 (end). */
export type Alignment = "start" | "center" | "end" | number;

/** Each child's extra offset along the stack, given the free length and the child count; added to its packed position. */
export type Distribute = (free: number, count: number) => readonly number[];

/** Where children sit along the stack: an Alignment shifts them together, a function places each. */
export type Justify = Alignment | Distribute;

/** Every child moves by the same share of the free room. */
const together =
  (along: number): Distribute =>
  (free, count) =>
    Array.from({ length: count }, () => free * along);

const NAMED = { start: 0, center: 0.5, end: 1 } as const;

const share = (value: Alignment, what: string): number => {
  // SAFETY: an unknown key just misses NAMED and falls through to the validation below.
  const found: unknown = NAMED[value as keyof typeof NAMED] ?? value;

  if (!(found === Number(found) && Number(found) >= 0 && Number(found) <= 1))
    throw new SceneError(
      `${what} takes "start", "center", "end" or a number from 0 to 1, got ${JSON.stringify(value)}.`,
    );

  return Number(found);
};

/** The first child at the start and the last at the end, with equal gaps between. */
export const spread: Distribute = (free, count) =>
  Array.from({ length: count }, (_, i) => (count > 1 ? (free * i) / (count - 1) : 0));

const isPair = (value: number | Vec): value is Vec => Array.isArray(value);

const room = (value: number | Vec, what: string): Vec => {
  const [x, y] = isPair(value) ? value : [value, value];

  if (!(x >= 0 && y >= 0 && Number.isFinite(x + y)))
    throw new SceneError(`${what} needs finite lengths of 0 or more, got ${x} and ${y}.`);

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

const size = (value: number | undefined, what: string): number | undefined => {
  if (value !== undefined && !(value >= 0 && Number.isFinite(value)))
    throw new SceneError(`${what} needs a finite length of 0 or more, got ${value}.`);

  return value;
};

const paint = (label: string, { fill, stroke, radius }: Backdrop, padding: number | Vec) => {
  const [px, py] = room(padding, `${label} padding`);
  const line = stroke === undefined ? 0 : restOf(stroke.width ?? 1);

  if (!(line >= 0 && Number.isFinite(line)))
    throw new SceneError(`${label} needs a stroke width of 0 or more, got ${line}.`);

  return {
    backdrop: {
      ...(fill !== undefined && { fill }),
      ...(stroke !== undefined && { stroke }),
      ...(radius !== undefined && { radius }),
    },
    inset: [px + line, py + line] satisfies Vec,
  };
};

const fits = (
  label: string,
  where: string,
  side: "wide" | "tall",
  given: number | undefined,
  need: number,
): number => {
  if (given === undefined) return need;

  if (given < need - EPSILON)
    throw new SceneError(
      `${where} is ${given} ${side}, but its children${label === "<Stack>" ? ", gaps" : ""} and padding need ${Math.ceil(need * 100) / 100}.`,
      `Make it ${side === "wide" ? "wider" : "taller"}, or leave out ${side === "wide" ? "width" : "height"} so it fits them.`,
    );

  return given;
};

export interface StackProps extends Common, Backdrop {
  readonly direction?: "row" | "column";
  readonly gap?: number;
  readonly align?: Alignment;
  /** Widen each container child to the stack's inner breadth; `align` then has nothing left to place. */
  readonly stretch?: boolean;
  readonly justify?: Justify;
  readonly padding?: number | Vec;
  readonly width?: number;
  readonly height?: number;
  readonly children?: Child;
}

export const Stack = ({
  direction = "column",
  gap = 0,
  align = "start",
  stretch = false,
  justify = "start",
  padding = 0,
  width,
  height,
  fill,
  stroke,
  radius,
  children,
  ...props
}: StackProps): SceneElement => {
  const label = "<Stack>";

  if (direction !== "row" && direction !== "column")
    throw new SceneError(`<Stack> takes direction "row" or "column", got "${String(direction)}".`);
  const [space] = room(gap, "<Stack> gap");
  const { backdrop, inset } = paint(label, { fill, stroke, radius }, padding);
  const cross = share(align, "<Stack> align");

  const distribute =
    justify instanceof Function ? justify : together(share(justify, "<Stack> justify"));

  const row = direction === "row";
  const [wide, tall] = [size(width, "<Stack> width"), size(height, "<Stack> height")];

  const sized = (given: Size): Arrange => {
    const [fixedMain, fixedCross] = row ? [given.width, given.height] : [given.height, given.width];

    return (boxes, where) => {
      const mains = boxes.map((box) => (row ? box.width : box.height));
      const sides = boxes.map((box) => (row ? box.height : box.width));
      const [lead, edge] = row ? inset : [inset[1], inset[0]];
      const content = run(mains, 0, space).end;
      const widest = Math.max(0, ...sides);
      const [mainSide, crossSide] = row ? (["wide", "tall"] as const) : (["tall", "wide"] as const);
      const length = fits(label, where, mainSide, fixedMain, content + lead * 2);
      const breadth = fits(label, where, crossSide, fixedCross, widest + edge * 2);
      const free = length - lead * 2 - content;
      const across = breadth - edge * 2;
      const shifts = distribute(free, boxes.length);

      if (shifts.length !== boxes.length || !shifts.every(Number.isFinite))
        throw new SceneError(
          `<Stack> justify gave ${shifts.length} offsets for ${boxes.length} children; it needs one finite number for each.`,
        );
      const { starts } = run(mains, lead, space);

      const slots = starts.map((packed, i): Vec => {
        const side = edge + (across - sides[i]!) * cross;
        const start = packed + shifts[i]!;

        return row ? [start, side] : [side, start];
      });

      return {
        slots,
        box: { x: 0, y: 0, width: row ? length : breadth, height: row ? breadth : length },
        ...(stretch && { sizes: boxes.map(() => (row ? { height: across } : { width: across })) }),
      };
    };
  };

  const own: Size = {
    ...(wide !== undefined && { width: wide }),
    ...(tall !== undefined && { height: tall }),
  };

  return {
    type: "group",
    props: { ...props, ...backdrop },
    children: flat(children),
    settle: {
      kind: "arrange",
      label,
      arrange: sized(own),
      resize: (size) => sized({ ...size, ...own }),
    },
    layout: { container: "stack", direction, gap: row ? [space, 0] : [0, space] },
    paints: true,
  };
};

export interface GridProps extends Common, Backdrop {
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
  fill,
  stroke,
  radius,
  children,
  ...props
}: GridProps): SceneElement => {
  if (!(Number.isInteger(columns) && columns >= 1))
    throw new SceneError(`<Grid> needs a whole number of columns, 1 or more, got ${columns}.`);
  const [gx, gy] = room(gap, "<Grid> gap");
  const { backdrop, inset } = paint("<Grid>", { fill, stroke, radius }, padding);
  const [px, py] = inset;
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
    props: { ...props, ...backdrop },
    children: flat(children),
    settle: { kind: "arrange", label: "<Grid>", arrange },
    layout: { container: "grid", gap: [gx, gy] },
    paints: true,
  };
};

export interface CenterProps extends Common, Backdrop {
  readonly padding?: number | Vec;
  readonly width?: number;
  readonly height?: number;
  readonly children?: Child;
}

export const Center = ({
  padding = 0,
  width,
  height,
  fill,
  stroke,
  radius,
  children,
  ...props
}: CenterProps): SceneElement => {
  const label = "<Center>";
  const { backdrop, inset } = paint(label, { fill, stroke, radius }, padding);

  const own: Size = {
    ...(width !== undefined && { width: size(width, "<Center> width") }),
    ...(height !== undefined && { height: size(height, "<Center> height") }),
  };

  const sized =
    (given: Size): Arrange =>
    (boxes, where) => {
      const w = fits(
        label,
        where,
        "wide",
        given.width,
        Math.max(0, ...boxes.map((box) => box.width)) + inset[0] * 2,
      );

      const h = fits(
        label,
        where,
        "tall",
        given.height,
        Math.max(0, ...boxes.map((box) => box.height)) + inset[1] * 2,
      );

      return {
        slots: boxes.map((box): Vec => [(w - box.width) / 2, (h - box.height) / 2]),
        box: { x: 0, y: 0, width: w, height: h },
      };
    };

  return {
    type: "group",
    props: { ...props, ...backdrop },
    children: flat(children),
    settle: {
      kind: "arrange",
      label,
      arrange: sized(own),
      resize: (size) => sized({ ...size, ...own }),
    },
    layout: { container: "center" },
    paints: true,
  };
};

export interface AlignProps extends Omit<Common, "at" | "anchor" | "offset"> {
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
  const given = (["at", "offset", "anchor"] as const).find((name) => name in props);

  if (given)
    throw new SceneError(
      `<Align> places itself against its to, so it takes no ${given}. Move it in with inset, and say which point lands where with place.`,
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
    props: { ...props, offset: at },
    children: flat(children),
    settle: { kind: "arrange", label: "<Align>", arrange },
    layout: { container: "align" },
  };
};
