import { el } from "../el";
import { rect, type Rect } from "../geometry";
import type { SvgNode } from "../svg";
import { defaultDark, tint, type Base16 } from "./theme";

export interface WindowOptions {
  readonly theme?: Base16;
  readonly title?: string;
  /** `"muted"` gray dots, `"traffic"` red, yellow and green. */
  readonly dots?: "muted" | "traffic" | false;
  /** Title bar height. Default 40. */
  readonly bar?: number;
  readonly radius?: number;
  /** For the title's font. */
  readonly class?: string;
}

export interface AppWindowResult {
  readonly node: SvgNode;
  readonly body: Rect;
}

/** An app window filling `frame`. `body` is the area under the title bar. */
export function appWindow(
  frame: Rect,
  {
    theme = defaultDark,
    title,
    dots = "muted",
    bar = 40,
    radius = 12,
    class: cls,
  }: WindowOptions = {},
): AppWindowResult {
  const dot = (i: number) =>
    dots === "traffic" ? tint(theme, (["red", "yellow", "green"] as const)[i]!) : theme.base02;

  const node = el.g({ class: cls }, [
    el.rect({
      x: frame.x,
      y: frame.y,
      width: frame.w,
      height: frame.h,
      rx: radius,
      fill: theme.base00,
      stroke: theme.base02,
    }),
    el.path({ d: `M${frame.x} ${frame.y + bar}h${frame.w}`, stroke: theme.base01 }),
    dots &&
      [0, 1, 2].map((i) =>
        el.circle({ cx: frame.x + bar / 2 + i * 18, cy: frame.y + bar / 2, r: 5.5, fill: dot(i) }),
      ),
    title &&
      el.text(
        {
          x: frame.center.x,
          y: frame.y + bar / 2 + 4,
          fontSize: 12,
          textAnchor: "middle",
          fill: theme.base04,
        },
        title,
      ),
  ]);

  return { node, body: rect(frame.x, frame.y + bar, frame.w, frame.h - bar) };
}
