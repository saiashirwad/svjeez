/** @jsxImportSource svjeez */
import {
  Group,
  adjust,
  blur,
  ellipse,
  moved,
  path,
  polygon,
  shadow,
  type Geometry,
  type SceneElement,
} from "svjeez";
import type { Effect } from "svjeez/tools";
import type { Background, ClipShape, FilterFn } from "../schema.ts";
import { painted } from "./context.ts";
import { outline, type Radii } from "./geometry.ts";
import { layer } from "./background.tsx";
import type { Where } from "./paint.tsx";

/** What a `filter` list becomes: core effects in the order written, and the opacity it multiplies the result by. */
interface Filtered {
  readonly effects: Effect[];
  readonly opacity: number;
}

export const filters = (list: readonly FilterFn[], { path: where, ctx }: Where): Filtered => {
  const effects: Effect[] = [];
  let opacity = 1;

  list.forEach((one, i) => {
    switch (one.fn) {
      case "blur":
        if (one.radius > 0) effects.push(blur(one.radius));

        return;
      case "drop-shadow": {
        const paint = painted(one.color);

        if (paint)
          effects.push(
            shadow({
              color: paint.hex,
              offset: [one.x, one.y],
              blur: one.blur,
              opacity: paint.alpha,
            }),
          );

        return;
      }

      case "brightness":
        effects.push(adjust({ brightness: one.amount }));

        return;
      case "contrast":
        effects.push(adjust({ contrast: one.amount }));

        return;
      case "saturate":
        effects.push(adjust({ saturate: one.amount }));

        return;
      case "grayscale":
        effects.push(adjust({ saturate: 1 - Math.min(1, one.amount) }));

        return;
      case "hue-rotate":
        effects.push(adjust({ hue: one.amount }));

        return;
      case "opacity":
        opacity *= Math.min(1, one.amount);

        if (list.slice(i + 1).some(({ fn }) => fn === "blur" || fn === "drop-shadow"))
          ctx.note(where, "filter: opacity() before blur() or drop-shadow() is drawn after them");
    }
  });

  return { effects, opacity };
};

/** A `clip-path` as core geometry, in the element's frame: `at` is where the border box's top-left corner is. */
export const clipOf = (shape: ClipShape, at: readonly [number, number]): Geometry => {
  const [x, y] = at;

  switch (shape.kind) {
    case "inset":
      return outline(
        { ...shape.rect, x: shape.rect.x + x, y: shape.rect.y + y },
        // SAFETY: capture writes four corners.
        shape.radii as Radii | undefined,
      );
    case "ellipse":
      return moved(ellipse(...shape.radius), [shape.center[0] + x, shape.center[1] + y]);
    case "polygon": {
      const points = shape.points.map(([px, py]): [number, number] => [px + x, py + y]);

      if (shape.rule === "nonzero") return polygon(...points);

      const [first, ...rest] = points;
      let drawing = path().moveTo(first ?? [0, 0]);

      for (const point of rest) drawing = drawing.lineTo(point);

      return { kind: "path", contours: drawing.close().contours, rule: "evenodd" };
    }

    case "path": {
      const moves = moved(path.parse(shape.d), [shape.at[0] + x, shape.at[1] + y]);

      return moves.kind === "path" ? { ...moves, rule: shape.rule } : moves;
    }
  }
};

/** `mask-image` layers as one alpha mask, drawn like background layers: where none of them has paint, the element is hidden. */
export const maskOf = (layers: readonly Background[], where: Where): SceneElement => (
  <Group key="mask">
    {[...layers].reverse().flatMap((one, i, all) => {
      const drawn = layer(
        one,
        `${one.kind === "image" ? "image" : "gradient"}${all.length - i}`,
        where,
        undefined,
      );

      return drawn ? [drawn] : [];
    })}
  </Group>
);
