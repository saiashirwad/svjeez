/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  draw,
  enter,
  exit,
  path,
  span,
  type Anim,
  type Geometry,
  type Paint,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { SceneError, type Common, type Hex, type Place, type TextAnchorPlace } from "svjeez/tools";
import { typeset, type Mark, type Typeset } from "./mathjax.ts";
import { mapRing, pointsOf, type Ring } from "./path.ts";

export interface TexOptions {
  readonly size: number;
  readonly display?: boolean;
  readonly anchor?: TextAnchorPlace;
}

export interface TexProps extends Omit<Common, "anchor">, TexOptions {
  readonly children: string | readonly string[];
  readonly fill: Anim<Paint>;
  readonly colors?: Readonly<Record<string, Anim<Paint>>>;
  readonly write?: Span;
}

export interface TexBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TexMeasure extends TexBox {
  readonly baseline: number;
  readonly parts: readonly string[];
  part(id: string): TexBox;
}

const PLACES: Readonly<Record<Place | "baseline-left" | "baseline" | "baseline-right", Vec>> = {
  "top-left": [0, 0],
  top: [0.5, 0],
  "top-right": [1, 0],
  left: [0, 0.5],
  center: [0.5, 0.5],
  right: [1, 0.5],
  "bottom-left": [0, 1],
  bottom: [0.5, 1],
  "bottom-right": [1, 1],
  "baseline-left": [0, Number.NaN],
  baseline: [0.5, Number.NaN],
  "baseline-right": [1, Number.NaN],
};

const isFraction = (anchor: TextAnchorPlace): anchor is readonly [number, number] =>
  Array.isArray(anchor);

const fractionOf = (anchor: TextAnchorPlace): Vec => {
  if (isFraction(anchor)) {
    if (anchor.length === 2 && anchor.every(Number.isFinite)) return anchor;
  } else if (Object.hasOwn(PLACES, anchor)) return PLACES[anchor];

  throw new SceneError(
    `<Tex> takes an anchor that names a place, such as "center" or "baseline-left", or two fractions of its box such as [0.5, 1], got ${JSON.stringify(anchor)}.`,
  );
};

const cache = new Map<string, Typeset>();

const typesetOnce = (source: string, display: boolean): Typeset => {
  const key = `${display ? "D" : "T"}${source}`;
  const found = cache.get(key) ?? typeset(source, display);

  cache.set(key, found);

  return found;
};

const sourceOf = (children: TexProps["children"]): string => {
  const given: readonly unknown[] = Array.isArray(children) ? children : [children];

  if (
    !given.every((part): part is string => typeof part === "string") ||
    given.join("").trim() === ""
  )
    throw new SceneError(
      "<Tex> holds no TeX source.",
      "Write it as a string child: <Tex size={32} fill={…}>{String.raw`\\frac{a}{b}`}</Tex>.",
    );

  return given.join("");
};

const round = (n: number): number => Math.round(n * 100) / 100 + 0;

const tenth = (n: number): number => Math.round(n * 10) / 10 + 0;

interface Laid {
  readonly marks: readonly (Mark & { readonly rings: readonly Ring[] })[];
  readonly width: number;
  readonly height: number;
  readonly origin: Vec;
  readonly baseline: number;
}

const lay = (source: string, { size, display = true, anchor = "top-left" }: TexOptions): Laid => {
  if (!(size > 0 && Number.isFinite(size)))
    throw new SceneError(`<Tex> needs a size above 0, the pixels in one em, got ${size}.`);
  const { box, marks } = typesetOnce(source, display);
  const k = size / 1000;
  const [width, height, baseline] = [box[2] * k, box[3] * k, -box[1] * k];
  const [u, v] = fractionOf(anchor);
  const origin: Vec = [width * u, Number.isNaN(v) ? baseline : height * v];

  const place = ([x, y]: Vec): Vec => [(x - box[0]) * k - origin[0], (y - box[1]) * k - origin[1]];

  return {
    marks: marks.map((mark) => ({
      ...mark,
      rings: mark.rings.map((ring) => mapRing(ring, place)),
    })),
    width,
    height,
    origin,
    baseline,
  };
};

const geometryOf = (rings: readonly Ring[]): Geometry =>
  rings.reduce((built, ring) => {
    let next = built.moveTo(ring.start);

    for (const { to, via } of ring.segments)
      next = via ? next.curveTo(via[0], via[1], to) : next.lineTo(to);

    return next.close();
  }, path());

const boxOf = (rings: readonly Ring[]): TexBox => {
  const points = rings.flatMap(pointsOf);
  const [xs, ys] = [points.map(([x]) => x), points.map(([, y]) => y)];
  const [x, y] = [Math.min(...xs), Math.min(...ys)];

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const partList = (marks: readonly Mark[]): string[] => [
  ...new Set(marks.flatMap((mark) => mark.parts)),
];

const measure = (source: string, options: TexOptions): TexMeasure => {
  const laid = lay(source, options);
  const parts = partList(laid.marks);

  return {
    x: -laid.origin[0],
    y: -laid.origin[1],
    width: laid.width,
    height: laid.height,
    baseline: laid.baseline - laid.origin[1],
    parts,
    part(id) {
      const marks = laid.marks.filter((mark) => mark.parts.includes(id));

      if (marks.length === 0)
        throw new SceneError(
          `Tex.measure() found no part "${id}" in ${JSON.stringify(source)}.`,
          parts.length > 0
            ? `Its parts are ${parts.map((p) => `"${p}"`).join(", ")}.`
            : `Name one with \\cssId{${id}}{…}.`,
        );

      return boxOf(marks.flatMap((mark) => mark.rings));
    },
  };
};

const NAMES = new Map([
  ["/", "slash"],
  ["path", "symbol"],
]);

const isHex = (color: string): color is Hex => /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color);

interface Tree {
  readonly id?: string;
  readonly items: (Mark | Tree)[];
}

const isTree = (item: Mark | Tree): item is Tree => "items" in item;

const treeOf = (marks: readonly Mark[], source: string): Tree => {
  const root: Tree = { items: [] };
  const seen = new Set<string>();
  const stack: Tree[] = [root];

  for (const mark of marks) {
    let depth = 1;

    while (depth < stack.length && stack[depth]!.id === mark.parts[depth - 1]) depth++;
    stack.length = depth;

    for (const id of mark.parts.slice(depth - 1)) {
      if (seen.has(id))
        throw new SceneError(
          `<Tex> names two parts "${id}" in ${JSON.stringify(source)}.`,
          "Give each \\cssId{…} its own name.",
        );
      seen.add(id);
      const tree: Tree = { id, items: [] };

      stack.at(-1)!.items.push(tree);
      stack.push(tree);
    }

    stack.at(-1)!.items.push(mark);
  }

  return root;
};

export function Tex({
  children,
  size,
  display,
  anchor,
  fill,
  colors = {},
  write,
  at,
  ...common
}: TexProps): SceneElement {
  const source = sourceOf(children);

  const laid = lay(source, {
    size,
    ...(display !== undefined && { display }),
    ...(anchor !== undefined && { anchor }),
  });

  const total = laid.marks.length;

  if (write && !(write.over > 0))
    throw new SceneError(`write on <Tex> needs a span longer than 0 seconds, got ${write.over}.`);
  const stroke = write ? Math.min(0.6, write.over) : 0;
  const step = write && total > 1 ? (write.over - stroke) / (total - 1) : 0;

  const paintOf = (mark: Mark): Anim<Paint> => {
    if (mark.color === undefined) return fill;

    if (Object.hasOwn(colors, mark.color)) return colors[mark.color]!;

    if (isHex(mark.color)) return mark.color;

    throw new SceneError(
      `<Tex> colors part of ${JSON.stringify(source)} with \\color{${mark.color}}, which its colors don't name.`,
      `Give it colors={{ ${/^[a-z_$][\w$]*$/i.test(mark.color) ? mark.color : JSON.stringify(mark.color)}: theme.blue }}, or write a hex color such as \\color{#2F6FEB}.`,
    );
  };

  let index = 0;
  const outlines: SceneElement[] = [];

  const build = (tree: Tree): SceneElement[] => {
    const counts = new Map<string, number>();

    return tree.items.map((item) => {
      if (isTree(item)) return <Group key={item.id}>{build(item)}</Group>;
      const name = NAMES.get(item.char) ?? (item.char.trim() || "symbol");
      const count = (counts.get(name) ?? 0) + 1;

      counts.set(name, count);
      const key = count === 1 ? name : `${name}#${count}`;
      const { x, y } = boxOf(item.rings);

      const geometry = geometryOf(
        item.rings.map((ring) => mapRing(ring, ([px, py]) => [tenth(px - x), tenth(py - y)])),
      );

      const at: Vec = [round(x), round(y)];
      const paint = paintOf(item);
      const begin = write ? write.start + index++ * step : 0;

      if (write)
        outlines.push(
          <Shape
            key={`${outlines.length}`}
            geometry={geometry}
            at={at}
            stroke={{ color: paint, width: round(size * 0.025), join: "round" }}
            trim={draw(span(begin, stroke * 0.7))}
            motion={exit(span(begin + stroke * 0.7, stroke * 0.3))}
          />,
        );

      return (
        <Shape
          key={key}
          geometry={geometry}
          at={at}
          fill={paint}
          {...(write && { motion: enter(span(begin + stroke * 0.5, stroke * 0.5)) })}
        />
      );
    });
  };

  const glyphs = build(treeOf(laid.marks, source));

  return (
    <Group {...common} {...(at !== undefined && { offset: at })}>
      {glyphs}
      {write && <Group key="writing">{outlines}</Group>}
    </Group>
  );
}

Tex.measure = measure;
