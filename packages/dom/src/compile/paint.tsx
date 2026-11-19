/** @jsxImportSource svjeez */
import { Group, Shape, blur, linear, polygon, radial, shadow, type SceneElement } from "svjeez";
import type { Stops, StrokeProps } from "svjeez/tools";
import type { Background, BorderStyle, Color, Rect, Shadow, Side } from "../schema.ts";
import { painted, type Context } from "./context.ts";
import {
  expand,
  innerRadii,
  inset,
  outline,
  ring,
  rounded,
  type Radii,
  type Sides,
  type Vec,
} from "./geometry.ts";

/** Where a layer is drawn: the border box in the element's frame, the corners, and who to blame. */
export interface Where {
  readonly box: Rect;
  readonly radii: Radii | undefined;
  readonly path: string;
  readonly ctx: Context;
}

type Gradient = Extract<Background, { kind: "linear" | "radial" }>;

const stopsOf = (gradient: Gradient): Stops | undefined => {
  let last = 0;

  const stops = gradient.stops.map(({ offset, color }): [number, `#${string}`] => {
    last = Math.max(last, Math.min(1, offset));

    return [last, painted(color)?.rgba ?? "#00000000"];
  });

  return stops.length >= 2 ? stops : undefined;
};

/** The radius CSS gives a radial gradient: an ellipse is drawn as the circle between its two radii. */
const radiusOf = (
  layer: Extract<Background, { kind: "radial" }>,
  box: Rect,
  note: (what: string) => void,
): number => {
  const [cx, cy] = layer.at;
  const [nearX, farX] = [Math.min(cx, box.width - cx), Math.max(cx, box.width - cx)];
  const [nearY, farY] = [Math.min(cy, box.height - cy), Math.max(cy, box.height - cy)];
  const closest = layer.size.startsWith("closest");
  const [x, y] = closest ? [nearX, nearY] : [farX, farY];
  const side = layer.size.endsWith("side");

  if (layer.shape === "circle")
    return side ? (closest ? Math.min(x, y) : Math.max(x, y)) : Math.hypot(x, y);

  const [rx, ry] = side ? [x, y] : [x * Math.SQRT2, y * Math.SQRT2];

  if (Math.abs(rx - ry) > 0.5) note("an elliptical radial-gradient is drawn as a circle");

  return (rx + ry) / 2;
};

/** The background color and each gradient layer, bottom first. */
export const backgrounds = (
  color: Color | undefined,
  layers: readonly Background[] | undefined,
  { box, radii, path, ctx }: Where,
): SceneElement[] => {
  const out: SceneElement[] = [];
  const shape = rounded(box, radii);
  const fill = painted(color);

  if (fill) out.push(<Shape key="background" {...shape} fill={fill.rgba} />);

  // CSS lists the topmost layer first.
  [...(layers ?? [])].reverse().forEach((layer, i, all) => {
    if (layer.kind === "image") return ctx.note(path, "a background-image url() is not drawn");

    const stops = stopsOf(layer);

    if (!stops) return;

    const paint =
      layer.kind === "linear"
        ? // CSS 0deg points up, and core's 0 points right.
          linear.across({ angle: layer.angle - 90, stops })
        : radial({
            center: layer.at,
            radius: Math.max(
              0.01,
              radiusOf(layer, box, (what) => ctx.note(path, what)),
            ),
            stops,
          });

    out.push(<Shape key={`gradient${all.length - i}`} {...shape} fill={paint} />);
  });

  return out;
};

const PLAIN: ReadonlySet<BorderStyle> = new Set(["solid", "dashed", "dotted", "double"]);

const dashes = (style: BorderStyle, w: number): Pick<StrokeProps, "dash" | "cap"> =>
  style === "dashed"
    ? { dash: [w * 3, w * 3] }
    : style === "dotted"
      ? { dash: [0.001, w * 2], cap: "round" }
      : {};

/**
 * One uniform line: a stroke of `width` whose middle runs `centre` px inside the box's edge (outside, when negative).
 * Core strokes straddle their outline, so an edge-aligned border is the outline pulled in by half a width.
 */
const line = (
  key: string,
  { box, radii }: Where,
  centre: number,
  width: number,
  style: BorderStyle,
  color: string,
): SceneElement[] => {
  const paint = painted(color);
  const middle = expand(box, radii, -centre);

  if (!paint || width <= 0 || middle.box.width < 0 || middle.box.height < 0) return [];

  return [
    <Shape
      key={key}
      {...rounded(middle.box, middle.radii, width)}
      stroke={{ color: paint.rgba, width, ...dashes(style, width) }}
    />,
  ];
};

/** A uniform border or outline of `width`, whose outer edge is `outer` px inside the box. */
const uniform = (
  key: string,
  where: Where,
  outer: number,
  width: number,
  style: BorderStyle,
  color: string,
): SceneElement[] => {
  if (!PLAIN.has(style)) where.ctx.note(where.path, `${key}-style ${style} is drawn solid`);

  if (style === "double" && width >= 3) {
    const third = width / 3;

    return [
      ...line(key, where, outer + third / 2, third, "solid", color),
      ...line(`${key}2`, where, outer + width - third / 2, third, "solid", color),
    ];
  }

  return line(
    key,
    where,
    outer + width / 2,
    width,
    PLAIN.has(style) && style !== "double" ? style : "solid",
    color,
  );
};

/** The widths of the sides that draw. */
export const widthsOf = (sides: readonly [Side, Side, Side, Side] | undefined): Sides => {
  const width = (side: Side) => (side.style === "none" || side.style === "hidden" ? 0 : side.width);

  return sides
    ? [width(sides[0]), width(sides[1]), width(sides[2]), width(sides[3])]
    : [0, 0, 0, 0];
};

export const border = (sides: readonly [Side, Side, Side, Side], where: Where): SceneElement[] => {
  const { box, radii, path, ctx } = where;

  const widths = widthsOf(sides);
  const [top] = sides;

  if (
    sides.every(
      (side, i) =>
        widths[i]! > 0 &&
        side.width === top.width &&
        side.style === top.style &&
        side.color === top.color,
    )
  )
    return uniform("border", where, 0, top.width, top.style, top.color);

  if (sides.some((side, i) => widths[i]! > 0 && side.style !== "solid"))
    ctx.note(path, "a border with different sides is drawn solid");

  const drawn = sides.flatMap((side, i) => {
    const paint = painted(side.color);

    return paint && widths[i]! > 0 ? [{ side: i, paint }] : [];
  });

  const inner = inset(box, widths);

  const edge = ring(
    outline(box, radii),
    inner.width > 0 && inner.height > 0 ? outline(inner, innerRadii(radii, widths)) : undefined,
  );

  if (new Set(drawn.map(({ paint }) => paint.rgba)).size <= 1)
    return drawn[0] ? [<Shape key="border" geometry={edge} fill={drawn[0].paint.rgba} />] : [];

  // One wedge per side, meeting along each corner's diagonal, and all of them cut to the ring.
  const { x, y, width: w, height: h } = box;
  const [t, r, b, l] = widths;

  const wedges: readonly (readonly Vec[])[] = [
    [
      [x, y],
      [x + w, y],
      [x + w - r, y + t],
      [x + l, y + t],
    ],
    [
      [x + w, y],
      [x + w, y + h],
      [x + w - r, y + h - b],
      [x + w - r, y + t],
    ],
    [
      [x + w, y + h],
      [x, y + h],
      [x + l, y + h - b],
      [x + w - r, y + h - b],
    ],
    [
      [x, y + h],
      [x, y],
      [x + l, y + t],
      [x + l, y + h - b],
    ],
  ];

  const names = ["top", "right", "bottom", "left"];

  return [
    <Group key="border" clip={edge}>
      {drawn.map(({ side, paint }) => (
        <Shape key={names[side]!} geometry={polygon(...wedges[side]!)} fill={paint.rgba} />
      ))}
    </Group>,
  ];
};

export const outlineOf = (
  {
    width,
    offset,
    color,
    style,
  }: { width: number; offset: number; color: Color; style: BorderStyle },
  where: Where,
): SceneElement[] =>
  style === "none" || style === "hidden"
    ? []
    : uniform("outline", where, -(offset + width), width, style, color);

/** CSS blur radius to a Gaussian standard deviation. */
const deviation = (radius: number): number => radius / 2;

/** What each shadow needs from the box: its padding box, for an inset one. */
export const shadows = (
  list: readonly Shadow[],
  where: Where,
  padding: { readonly box: Rect; readonly radii: Radii | undefined },
) => {
  const below: SceneElement[] = [];
  const above: SceneElement[] = [];
  const { box, radii } = where;

  // CSS paints the first shadow on top.
  [...list].reverse().forEach((one, i, all) => {
    const paint = painted(one.color);
    const n = all.length - i;

    if (!paint) return;

    const sigma = deviation(one.blur);
    const reach = Math.abs(one.x) + Math.abs(one.y) + one.blur * 3 + Math.abs(one.spread) + 1;

    if (one.inset) {
      const hole = expand(
        { ...padding.box, x: padding.box.x + one.x, y: padding.box.y + one.y },
        padding.radii,
        -one.spread,
      );

      const lit = expand(padding.box, padding.radii, reach);

      above.push(
        <Group key={`inset-shadow${n}`} clip={outline(padding.box, padding.radii)}>
          <Shape
            key="shadow"
            geometry={ring(
              outline(lit.box, lit.radii),
              hole.box.width > 0 && hole.box.height > 0 ? outline(hole.box, hole.radii) : undefined,
            )}
            fill={paint.hex}
            opacity={paint.alpha}
            {...(sigma > 0 && { effects: [blur(sigma)] })}
          />
        </Group>,
      );

      return;
    }

    // A shadow shows only outside the box, so the shape that casts it is cut away where the box is.
    const outside = expand(box, radii, reach);
    const cut = ring(outline(outside.box, outside.radii), outline(box, radii));

    if (one.spread === 0) {
      below.push(
        <Group key={`shadow${n}`} clip={cut}>
          <Shape
            key="caster"
            {...rounded(box, radii)}
            fill={paint.hex}
            effects={[
              shadow({
                color: paint.hex,
                offset: [one.x, one.y],
                blur: sigma,
                opacity: paint.alpha,
              }),
            ]}
          />
        </Group>,
      );

      return;
    }

    const spread = expand(box, radii, one.spread);

    if (spread.box.width <= 0 || spread.box.height <= 0) return;

    below.push(
      <Group key={`shadow${n}`} clip={cut}>
        <Shape
          key="caster"
          {...rounded(
            { ...spread.box, x: spread.box.x + one.x, y: spread.box.y + one.y },
            spread.radii,
          )}
          fill={paint.hex}
          opacity={paint.alpha}
          {...(sigma > 0 && { effects: [blur(sigma)] })}
        />
      </Group>,
    );
  });

  return { below, above };
};
