/** @jsxImportSource svjeez */
import {
  Group,
  Picture,
  Shape,
  linear,
  pattern,
  picture,
  radial,
  rect,
  type SceneElement,
} from "svjeez";
import type { PictureData, Stops } from "svjeez/tools";
import type {
  Background,
  Extent,
  ImageLayer,
  LinearGradient,
  Offset,
  Placement,
  RadialGradient,
  Rect,
  Repeat,
  Stop,
} from "../schema.ts";
import { painted, type Solid } from "./context.ts";
import { innerRadii, outline, rounded, type Radii, type Vec } from "./geometry.ts";
import { bytesOf } from "./image.tsx";
import type { Where } from "./paint.tsx";
import { bleed, unroll } from "./stops.ts";

/** Smaller than any difference that shows. */
const EPS = 0.01;

const covers = (a: Rect, b: Rect): boolean =>
  a.x <= b.x + EPS &&
  a.y <= b.y + EPS &&
  a.x + a.width >= b.x + b.width - EPS &&
  a.y + a.height >= b.y + b.height - EPS;

const same = (a: Rect, b: Rect): boolean => covers(a, b) && covers(b, a);

const intersect = (a: Rect, b: Rect): Rect => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);

  return {
    x,
    y,
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y),
  };
};

/** Stops as core takes them, never decreasing; undefined when fewer than two draw. */
const solid = (stops: readonly Stop[]): Stops | undefined => {
  let last = 0;

  const out = bleed(stops).map(({ offset, color }): [number, Solid] => {
    last = Math.max(last, Math.min(1, offset));

    return [last, painted(color)?.rgba ?? "#00000000"];
  });

  return out.length >= 2 ? out : undefined;
};

/** The tile a layer draws at: `size` against the box it is measured in and the image's own size, when it has one. */
const tileSize = (
  size: Placement["size"],
  origin: Rect,
  intrinsic: Vec | undefined,
): readonly [number, number] => {
  const whole: Vec = [origin.width, origin.height];

  if (size === "cover" || size === "contain") {
    if (!intrinsic) return whole;

    const fit = (size === "cover" ? Math.max : Math.min)(
      origin.width / intrinsic[0],
      origin.height / intrinsic[1],
    );

    return [intrinsic[0] * fit, intrinsic[1] * fit];
  }

  const [w, h] = size;

  const side = (own: Extent, other: Extent, axis: 0 | 1): number =>
    own !== "auto"
      ? own
      : !intrinsic
        ? whole[axis]
        : other === "auto"
          ? intrinsic[axis]
          : (other * intrinsic[axis]) / intrinsic[1 - axis]!;

  return [side(w, h, 0), side(h, w, 1)];
};

/** One axis of the tiles: where the first one starts, how big it is, and how far apart they repeat. */
interface Axis {
  readonly start: number;
  readonly size: number;
  /** The distance from one tile to the next; for an axis that does not repeat, far enough that no second one reaches `clip`. */
  readonly period: number;
  /** More than one tile shows. */
  readonly repeats: boolean;
}

const axisOf = (
  repeat: Repeat,
  tile: number,
  offset: Offset,
  origin: readonly [start: number, length: number],
  clip: readonly [start: number, length: number],
): Axis => {
  const [o0, length] = origin;
  const [c0, span] = clip;
  const size = repeat === "round" ? length / Math.max(1, Math.round(length / tile)) : tile;
  const count = Math.floor(length / size + EPS);

  const spaced = repeat === "space" && count >= 2;
  const start = spaced ? o0 : o0 + offset.px + (offset.percent / 100) * (length - size);
  const every = spaced ? size + (length - count * size) / (count - 1) : size;
  const wanted = repeat !== "no-repeat" && (repeat !== "space" || spaced);
  const reaches = start <= c0 + EPS && start + size >= c0 + span - EPS;

  if (wanted && !reaches) return { start, size, period: every, repeats: true };

  return {
    start,
    size,
    period: Math.max(size, c0 + span - start, start + size - c0),
    repeats: false,
  };
};

type Pic = (width: number, height: number) => PictureData;

/** The image a layer holds: its data, and its own size unless it has none (an SVG with no width, height or viewBox). */
const imageOf = (
  layer: ImageLayer,
  where: Where,
): { read: Pic; intrinsic: Vec | undefined } | undefined => {
  const bytes = bytesOf(layer.src);

  if (!bytes) {
    where.ctx.note(
      where.path,
      `a background or mask image url() that is not a data: URL is not drawn (${layer.src.slice(0, 60)})`,
    );

    return undefined;
  }

  try {
    const read = picture(bytes);

    return { read: () => read, intrinsic: [read.width, read.height] };
  } catch (error) {
    const markup = new TextDecoder().decode(bytes);

    if (/^\s*(<\?xml[^>]*\?>\s*)?<svg\b/i.test(markup))
      return {
        read: (width, height) => {
          const data =
            `data:image/svg+xml,${markup.trim().replace(/[%#<>"\r\n\t]/g, encodeURIComponent)}` as const;

          return { href: data, width, height, format: "svg", bytes: data.length, mode: "embed" };
        },
        intrinsic: undefined,
      };

    where.ctx.note(
      where.path,
      `a background or mask image that svjeez could not read is not drawn (${error instanceof Error ? error.message : String(error)})`,
    );

    return undefined;
  }
};

/** The stops of a gradient across `lo` to `hi` of its length: unrolled when it repeats, and as written when that cannot be done. */
const repeated = (
  layer: LinearGradient | RadialGradient,
  lo: number,
  hi: number,
  { path, ctx }: Where,
): readonly Stop[] => {
  if (!layer.repeating) return layer.stops;

  const stops = unroll(layer.stops, lo, hi);

  if (!stops)
    ctx.note(path, "a repeating gradient with no period, or too many repeats, is drawn once");

  return stops ?? layer.stops;
};

/** A radial gradient is circular in core, so an ellipse is a circle scaled inside a group, and a repeating one reaches as far as the tile's farthest corner. */
const radialStops = (
  layer: RadialGradient,
  tile: Rect,
  where: Where,
): { stops: Stops; reach: number } | undefined => {
  const [rx, ry] = layer.radius;
  const [cx, cy] = layer.at;

  const far = Math.max(
    ...[0, tile.width].flatMap((x) =>
      [0, tile.height].map((y) =>
        Math.hypot((x - cx) / Math.max(rx, 1e-3), (y - cy) / Math.max(ry, 1e-3)),
      ),
    ),
  );

  const reach = layer.repeating ? Math.max(far, 1e-3) : 1;
  const drawn = solid(repeated(layer, 0, reach, where));

  return drawn && { stops: drawn, reach };
};

/** One tile of a layer in `box`, with its corners when it is the clip itself. */
const tile = (
  layer: Background,
  key: string,
  box: Rect,
  radii: Radii | undefined,
  src: PictureData | undefined,
  where: Where,
): SceneElement | undefined => {
  if (layer.kind === "image")
    return (
      <Picture
        key={key}
        src={src!}
        fit="fill"
        width={box.width}
        height={box.height}
        at={[box.x, box.y]}
      />
    );

  if (layer.kind === "linear") {
    const drawn = solid(repeated(layer, 0, 1, where));

    if (!drawn) return undefined;

    return (
      <Shape
        key={key}
        {...rounded(box, radii)}
        fill={linear.across({ angle: layer.angle - 90, stops: drawn })}
      />
    );
  }

  const [rx, ry] = layer.radius;
  const found = radialStops(layer, { ...box, x: 0, y: 0 }, where);

  if (!found) return undefined;

  const r = Math.max(rx, ry, 1e-3);
  const [sx, sy] = [Math.max(rx, 1e-3) / r, Math.max(ry, 1e-3) / r];

  if (Math.abs(sx - sy) < 0.005) {
    const placed = rounded(box, radii);

    const center: Vec = [
      layer.at[0] + box.x - (placed.at?.[0] ?? 0),
      layer.at[1] + box.y - (placed.at?.[1] ?? 0),
    ];

    return (
      <Shape
        key={key}
        {...placed}
        fill={radial({ center, radius: r * found.reach, stops: found.stops })}
      />
    );
  }

  const [cx, cy] = layer.at;

  return (
    <Group key={key} clip={outline(box, radii)}>
      <Group key="ellipse" offset={[box.x + cx, box.y + cy]} origin="at" scale={[sx, sy]}>
        <Shape
          key="glow"
          geometry={rect(box.width / sx, box.height / sy)}
          at={[-cx / sx, -cy / sy]}
          fill={radial({ center: [cx / sx, cy / sy], radius: r * found.reach, stops: found.stops })}
        />
      </Group>
    </Group>
  );
};

/**
 * One background layer, drawn into the box `where` describes: its tile sized and placed in the origin box, repeated across the clip box.
 * `visible` is the part of the box that shows, when an opaque border hides the rest.
 */
export const layer = (
  layer: Background,
  key: string,
  where: Where,
  visible: Rect | undefined,
): SceneElement | undefined => {
  const { box, radii } = where;

  const place: Placement = layer.place ?? {
    size: ["auto", "auto"],
    position: [
      { percent: 0, px: 0 },
      { percent: 0, px: 0 },
    ],
    repeat: ["repeat", "repeat"],
    origin: { x: 0, y: 0, width: box.width, height: box.height },
    clip: { x: 0, y: 0, width: box.width, height: box.height },
  };

  const shift = (r: Rect): Rect => ({ ...r, x: r.x + box.x, y: r.y + box.y });
  const origin = shift(place.origin);
  const cut = visible ? intersect(shift(place.clip), visible) : shift(place.clip);

  if (cut.width <= 0 || cut.height <= 0) return undefined;

  const cutRadii = innerRadii(radii, [
    cut.y - box.y,
    box.x + box.width - (cut.x + cut.width),
    box.y + box.height - (cut.y + cut.height),
    cut.x - box.x,
  ]);

  const image = layer.kind === "image" ? imageOf(layer, where) : undefined;

  if (layer.kind === "image" && !image) return undefined;

  const [tw, th] = tileSize(place.size, origin, image?.intrinsic);

  if (!(tw > 0 && th > 0 && origin.width > 0 && origin.height > 0)) return undefined;

  const x = axisOf(
    place.repeat[0],
    tw,
    place.position[0],
    [origin.x, origin.width],
    [cut.x, cut.width],
  );

  const y = axisOf(
    place.repeat[1],
    th,
    place.position[1],
    [origin.y, origin.height],
    [cut.y, cut.height],
  );

  const src = image?.read(x.size, y.size);

  if (x.repeats || y.repeats) {
    const cell = tile(
      layer,
      "tile",
      { x: 0, y: 0, width: x.size, height: y.size },
      undefined,
      src,
      where,
    );

    if (!cell) return undefined;
    const placed = rounded(cut, cutRadii);
    const [ax, ay] = placed.at ?? [0, 0];

    return (
      <Shape
        key={key}
        {...placed}
        fill={pattern({
          size: [x.period, y.period],
          tile: <Group key="tile">{cell}</Group>,
          offset: [x.start - ax, y.start - ay],
        })}
      />
    );
  }

  const one: Rect = { x: x.start, y: y.start, width: x.size, height: y.size };

  if (same(one, cut)) {
    const whole = tile(layer, key, cut, cutRadii, src, where);

    return whole && layer.kind === "image" && cutRadii ? (
      <Group key={key} clip={outline(cut, cutRadii)}>
        {whole}
      </Group>
    ) : (
      whole
    );
  }

  if (intersect(one, cut).width <= 0 || intersect(one, cut).height <= 0) return undefined;

  const inside = covers(cut, one) && !cutRadii;
  const drawn = tile(layer, inside ? key : "tile", one, undefined, src, where);

  if (!drawn || inside) return drawn;

  return (
    <Group key={key} clip={outline(cut, cutRadii)}>
      {drawn}
    </Group>
  );
};
