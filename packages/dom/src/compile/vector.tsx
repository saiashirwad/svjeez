/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  circle,
  ellipse,
  line,
  path,
  polygon,
  type Geometry,
  type SceneElement,
} from "svjeez";
import type { ShapeProps, StrokeProps } from "svjeez/tools";
import { isThemed, type Rect, type SvgNode, type Themed } from "../schema.ts";
import { fade, keyer, painted, type Context } from "./context.ts";
import { rounded, type Vec } from "./geometry.ts";
import { decompose, parseTransform } from "./transform.ts";

/** A style value that is not a color pair: `Themed` shows up only in the paints. */
const text = (value: string | Themed | undefined): string | undefined =>
  isThemed(value) ? undefined : value;

const number = (value: string | undefined, fallback = 0): number => {
  const n = parseFloat(value ?? "");

  return Number.isNaN(n) ? fallback : n;
};

const numbers = (value: string | undefined): number[] =>
  (value ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);

const points = (value: string | undefined): Vec[] => {
  const all = numbers(value);

  return Array.from({ length: Math.floor(all.length / 2) }, (_, i): Vec => [
    all[i * 2]!,
    all[i * 2 + 1]!,
  ]);
};

const capOf = (value: string | undefined): StrokeProps["cap"] =>
  value === "round" ? "round" : value === "square" ? "square" : "flat";

const joinOf = (value: string | undefined): StrokeProps["join"] =>
  value === "round" ? "round" : value === "bevel" ? "flat" : "sharp";

interface Lowering {
  readonly ctx: Context;
  readonly path: string;
}

/** The fill and stroke a node's computed paint asks for. */
const looks = (node: SvgNode, { ctx, path: where }: Lowering) => {
  const { style } = node;

  const colored = (name: "fill" | "stroke") => {
    const value = style[name];

    if (!isThemed(value) && value?.startsWith("url("))
      ctx.note(where, `a ${name} that is a paint server (${value}) is not drawn`);

    const color = painted(value);

    if (!color) return undefined;

    return fade(color, number(text(style[`${name}-opacity`]), 1));
  };

  const fill = colored("fill");
  const color = colored("stroke");
  const width = number(text(style["stroke-width"]), 1);

  const dash = numbers(style["stroke-dasharray"] === "none" ? "" : text(style["stroke-dasharray"]));
  const dashed = dash.length > 0 && dash.every((d) => d >= 0) && dash.some((d) => d > 0);

  const stroke: StrokeProps | undefined =
    color && width > 0
      ? {
          color,
          width,
          cap: capOf(text(style["stroke-linecap"])),
          join: joinOf(text(style["stroke-linejoin"])),
          ...(dashed && {
            dash: dash.length % 2 === 0 ? dash : [...dash, ...dash],
            dashOffset: number(text(style["stroke-dashoffset"])),
          }),
        }
      : undefined;

  return { fill, stroke, width: stroke ? width : 0 };
};

const geometry = (
  node: SvgNode,
  stroke: number,
  { ctx, path: where }: Lowering,
): { geometry: Geometry; at?: Vec } | undefined => {
  const { attrs } = node;
  const [x, y] = [number(attrs.x), number(attrs.y)];
  const half = stroke / 2;

  switch (node.tag) {
    case "path":
      try {
        return { geometry: path.parse(attrs.d ?? "") };
      } catch {
        ctx.note(where, `the path data "${attrs.d}" could not be read`);

        return undefined;
      }

    case "rect": {
      const [width, height] = [number(attrs.width), number(attrs.height)];
      const rx = number(attrs.rx, number(attrs.ry));
      const ry = number(attrs.ry, rx);

      if (!(width > 0 && height > 0)) return undefined;

      const radius = [Math.min(rx, width / 2), Math.min(ry, height / 2)] as const;

      return rounded({ x, y, width, height }, [radius, radius, radius, radius], stroke);
    }

    case "circle": {
      const r = number(attrs.r);

      return r > 0
        ? { geometry: circle(r), at: [number(attrs.cx) - r - half, number(attrs.cy) - r - half] }
        : undefined;
    }

    case "ellipse": {
      const [rx, ry] = [number(attrs.rx), number(attrs.ry)];

      return rx > 0 && ry > 0
        ? {
            geometry: ellipse(rx, ry),
            at: [number(attrs.cx) - rx - half, number(attrs.cy) - ry - half],
          }
        : undefined;
    }

    case "line":
      return {
        geometry: line([number(attrs.x1), number(attrs.y1)], [number(attrs.x2), number(attrs.y2)]),
      };
    case "polyline":
    case "polygon": {
      const all = points(attrs.points);

      if (all.length < 2) return undefined;

      return { geometry: node.tag === "polygon" ? polygon(...all) : line(...all) };
    }

    default:
      return undefined;
  }
};

const SHAPES: ReadonlySet<string> = new Set([
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
]);

const GROUPS: ReadonlySet<string> = new Set(["g", "a", "svg"]);

/** An SVG node's own transform and opacity, as the props of the group that carries it. */
const dressing = (node: SvgNode, { ctx, path: where }: Lowering) => {
  const matrix = parseTransform(node.attrs.transform);
  const opacity = number(text(node.style.opacity), 1);

  if (!matrix) ctx.note(where, `the transform "${node.attrs.transform}" could not be read`);

  const placed = matrix && decompose(matrix);

  const moved =
    placed &&
    (placed.translate[0] !== 0 ||
      placed.translate[1] !== 0 ||
      placed.rotate !== 0 ||
      placed.scale[0] !== 1 ||
      placed.scale[1] !== 1 ||
      placed.skew !== 0);

  return {
    ...(moved && {
      offset: placed.translate,
      origin: "at" as const,
      rotate: placed.rotate,
      scale: placed.scale,
      skew: placed.skew,
    }),
    ...(opacity < 1 && { opacity }),
  };
};

const lower = (node: SvgNode, key: string, parent: Lowering): SceneElement[] => {
  const here = { ctx: parent.ctx, path: `${parent.path}/${key}` };
  const dress = dressing(node, here);
  const dressed = Object.keys(dress).length > 0;

  if (GROUPS.has(node.tag)) {
    const name = keyer();

    const children = node.children.flatMap((child, i) =>
      lower(child, name(child.attrs.id ?? `${child.tag}[${i}]`), here),
    );

    return children.length === 0
      ? []
      : [
          <Group key={key} {...dress}>
            {children}
          </Group>,
        ];
  }

  if (!SHAPES.has(node.tag)) {
    here.ctx.note(here.path, `<${node.tag}> inside an svg is not drawn`);

    return [];
  }

  const { fill, stroke, width } = looks(node, here);
  const shape = geometry(node, width, here);

  if (!shape) return [];

  // The stroke's shape is backed off by half its width; the fill's is not.
  const bare = width > 0 ? (geometry(node, 0, here) ?? shape) : shape;

  const filled = node.tag === "line" ? undefined : fill;
  const parts: [string, ShapeProps][] = [];

  if (filled) {
    // A polyline's fill closes it, though its stroke does not.
    const geometry =
      node.tag === "polyline"
        ? polygon(...points(node.attrs.points))
        : node.style["fill-rule"] === "evenodd" &&
            "kind" in bare.geometry &&
            bare.geometry.kind === "path"
          ? { ...bare.geometry, rule: "evenodd" as const }
          : bare.geometry;

    parts.push(["fill", { ...bare, geometry, fill: filled }]);
  }

  if (stroke) parts.push(["stroke", { ...shape, stroke }]);

  const [only] = parts;

  if (!only) return [];

  // A fill and a stroke are two shapes of the one element: they share its group and its key.
  if (parts.length === 1 && !dressed) return [<Shape key={key} {...only[1]} />];

  return [
    <Group key={key} {...dress}>
      {parts.map(([name, props]) => (
        <Shape key={name} {...props} />
      ))}
    </Group>,
  ];
};

interface Fit {
  readonly scale: Vec;
  readonly shift: Vec;
}

/** How far along its free space a preserveAspectRatio alignment puts the viewBox. */
const share = (align: string): number => (align === "Min" ? 0 : align === "Max" ? 1 : 0.5);

/** The scale and shift that draw a viewBox into `box`, by preserveAspectRatio. */
const viewBox = (svg: SvgNode, box: Rect): Fit => {
  const [vx = 0, vy = 0, vw = box.width, vh = box.height] = numbers(svg.attrs.viewBox);

  const [align = "xMidYMid", rule = "meet"] = (svg.attrs.preserveAspectRatio ?? "")
    .trim()
    .split(/\s+/);

  if (!(vw > 0 && vh > 0)) return { scale: [1, 1], shift: [box.x, box.y] };

  const [sx, sy] = [box.width / vw, box.height / vh];

  if (align === "none") return { scale: [sx, sy], shift: [box.x - vx * sx, box.y - vy * sy] };

  const s = rule === "slice" ? Math.max(sx, sy) : Math.min(sx, sy);
  const ax = share(/x(Min|Mid|Max)/.exec(align)?.[1] ?? "Mid");
  const ay = share(/Y(Min|Mid|Max)/.exec(align)?.[1] ?? "Mid");

  return {
    scale: [s, s],
    shift: [
      box.x + (box.width - vw * s) * ax - vx * s,
      box.y + (box.height - vh * s) * ay - vy * s,
    ],
  };
};

/** An inline `<svg>` drawn into `box`, the element's content box in its parent's frame. */
export const vector = (
  svg: SvgNode,
  box: Rect,
  key: string,
  path: string,
  ctx: Context,
): SceneElement => {
  const { scale, shift } = viewBox(svg, box);
  const name = keyer();

  const here = { ctx, path };

  const children = svg.children.flatMap((child, i) =>
    lower(child, name(child.attrs.id ?? `${child.tag}[${i}]`), here),
  );

  return (
    <Group key={key} offset={shift} origin="at" scale={scale}>
      {children}
    </Group>
  );
};
