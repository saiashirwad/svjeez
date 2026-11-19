/** @jsxImportSource svjeez */
import { Shape, circle, line, type SceneElement } from "svjeez";
import type { Control, Rect } from "../schema.ts";
import { painted } from "./context.ts";
import type { Context } from "./context.ts";
import { rounded } from "./geometry.ts";

/** The unchecked chrome of a native checkbox or radio: white, with a thin gray edge. */
const FACE = "#ffffff" as const;
const EDGE = "#767676" as const;

/**
 * A native control as core shapes, in the element's frame: a box or circle in `accent-color` with a tick, dot or dash,
 * or a select's chevron. Not the operating system's exact chrome, only what the control says.
 */
export const control = (kind: Control, box: Rect, ctx: Context): SceneElement[] => {
  if (kind.kind === "select") {
    const stroke = painted(kind.color);

    if (!stroke) return [];

    const { x, y, width, height } = box;
    const cx = x + width - 14;
    const cy = y + height / 2;

    return [
      <Shape
        key="@chevron"
        geometry={line([cx - 4, cy - 2], [cx, cy + 2], [cx + 4, cy - 2])}
        stroke={{ color: stroke.rgba, width: 1.5, cap: "round", join: "round" }}
      />,
    ];
  }

  const accent = painted(kind.accent);

  if (!accent) {
    ctx.note("control", "a checkbox or radio with no accent color is not drawn");

    return [];
  }

  const on = kind.checked || kind.indeterminate;
  const edge = on ? accent.rgba : EDGE;
  const { x, y, width, height } = box;
  const size = Math.min(width, height);
  const out: SceneElement[] = [];

  if (kind.kind === "radio") {
    const r = size / 2;

    out.push(
      <Shape
        key="@face"
        geometry={circle(r - 0.5)}
        at={[x + 0.5, y + 0.5]}
        fill={FACE}
        stroke={{ color: edge, width: 1 }}
      />,
    );

    if (kind.checked)
      out.push(
        <Shape
          key="@dot"
          geometry={circle(r * 0.46)}
          at={[x + r - r * 0.46, y + r - r * 0.46]}
          fill={accent.rgba}
        />,
      );

    return out;
  }

  const face = rounded(
    { x, y, width: size, height: size },
    [
      [2, 2],
      [2, 2],
      [2, 2],
      [2, 2],
    ],
    1,
  );

  out.push(
    <Shape
      key="@face"
      {...face}
      fill={on ? accent.rgba : FACE}
      stroke={{ color: edge, width: 1 }}
    />,
  );

  const mark = {
    color: "#ffffff" as const,
    width: Math.max(1.5, size * 0.15),
    cap: "flat" as const,
    join: "sharp" as const,
  };

  if (kind.indeterminate)
    out.push(
      <Shape
        key="@dash"
        geometry={line([x + size * 0.25, y + size / 2], [x + size * 0.75, y + size / 2])}
        stroke={mark}
      />,
    );
  else if (kind.checked)
    out.push(
      <Shape
        key="@tick"
        geometry={line(
          [x + size * 0.22, y + size * 0.52],
          [x + size * 0.42, y + size * 0.72],
          [x + size * 0.78, y + size * 0.3],
        )}
        stroke={mark}
      />,
    );

  return out;
};
