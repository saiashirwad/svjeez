// One look for every scene in the examples gallery. Scenes import from here so the cards read as one set.
// Palette, fonts and the type scale come first, then the rules for layout and motion.
import {
  css as cssTag,
  ease,
  enter,
  motion,
  span,
  type Color,
  type Css,
  type FontValue,
  type SvgNode,
} from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import { geist } from "./fonts/faces";
import { css, mono, theme } from "./style";

/** Palette and fonts. `theme` paints with `var(--base0X)`, so the site's palette picker recolors a scene that uses it. */
export { css, geist, mono, theme };

/** `css` as a hole for a scene whose own style is a `css` template: css`${paletteCss} .dot { fill: ${color.accent} }`. */
const text = css;
const strings = Object.assign([text], { raw: [text] });
export const paletteCss: Css = cssTag(strings);

/** Colors for `fx.duotone`, which needs hex: the dark palette's blue and yellow. */
export const duotone = { dark: "#5EA0FF", light: "#FFD60A" } as const;

/** The canvas: 16:9, because a gallery card crops everything to 16:9. Author at this size, or at the same ratio. */
export const WIDTH = 960;
export const HEIGHT = 540;

/** Nothing but a full-bleed background crosses this margin. */
export const MARGIN = 48;

/** The page already prints the title twice, so only a scene whose title is part of the picture draws one. */
export const TITLE = { x: MARGIN, y: 76, size: 30, weight: 600 } as const;
export const SUBTITLE = { x: MARGIN, y: 102, size: 15 } as const;

/** Type scale at 960 wide. Geist for text and JetBrains Mono for code, axis labels, units and figures. No letterspaced caps. */
export const size = {
  title: 30,
  subtitle: 15,
  heading: 18,
  label: 12,
  smallest: 11,
  readout: 44,
  code: 18,
} as const;

/** Line weights: hairlines for grids, axes and panel strokes, then data and connectors, then the highlighted thing. */
export const stroke = { hairline: 1, data: 1.5, accent: 2, mark: 3 } as const;

/** Panels (a window, a tile) are `panel` with a hairline `edge` and this radius. The canvas itself is square. */
export const RADIUS = 8;

/**
 * One accent per scene, the site's own: it marks the one thing being talked about. Everything else is `faint` to `ink`.
 * Series that must be told apart take `series` in order. `error` means error or negative and nothing else.
 */
export const color = {
  bg: theme.base00,
  panel: theme.base01,
  edge: theme.base02,
  faint: theme.base03,
  dim: theme.base04,
  text: theme.base05,
  ink: theme.base06,
  accent: theme.base0D,
  // SAFETY: the theme's base colors are hex strings, which are valid Colors.
  series: [theme.base0D, theme.base09, theme.base0E, theme.base0C] as readonly Color[],
  error: theme.base08,
} as const;

/**
 * The palette's hues, which carry the data and structure; greys stay for the background, text and scaffolding.
 * A scene takes two or three, in `series` order: blue, then orange, then purple. Cyan is the fourth, for a map or a diagram
 * that needs one more. Green and red keep their meaning (done, error), and `yellow` is for a highlight. Rosé Pine's green
 * is its blue, so a scene that already uses blue never adds green.
 */
export const hue = {
  blue: theme.base0D,
  orange: theme.base09,
  purple: theme.base0E,
  cyan: theme.base0C,
  green: theme.base0B,
  red: theme.base08,
  yellow: theme.base0A,
} as const;

/** A hue at low opacity: a fill for an area, a box or a land mass. Spread it onto the element: `<rect {...wash(hue.blue)} />`. */
export const wash = (hue: Color, opacity = 0.18) => ({ fill: hue, fillOpacity: opacity }) as const;

/** A washed fill with a stroke of the same hue: a box or a panel that belongs to a series. */
export const boxed = (hue: Color, opacity = 0.16, width = 1.5) =>
  ({ ...wash(hue, opacity), stroke: hue, strokeWidth: width }) as const;

/** Motion. Entrances ease out over 0.4 to 0.6s with an 8px rise. Moves ease in and out. Clocks and progress are linear. */
export const motions = {
  /** First content starts by here. */
  lead: 0.2,
  over: 0.5,
  rise: 8,
  /** Between items that arrive in turn: 0.06 to 0.12s. */
  stagger: 0.09,
  /** How long a loop holds its last frame, and how long its content takes to fade before the restart. */
  hold: 2,
  fade: 0.6,
} as const;

/** Fade in with an 8px rise. */
export const rise = (at: number, over: number = motions.over) =>
  enter({ at, over }, { opacity: 0, y: motions.rise }, ease.out);

/** The `n`th of a staggered run that starts at `at`. */
export const nth = (at: number, n: number, over: number = motions.over) =>
  rise(at + n * motions.stagger, over);

/** Fade the content, never the background, at the end of the loop. Put it on a group around everything but the background. */
export const leave = (duration: number) =>
  motion({ opacity: 1 }).to({ opacity: 0 }, span(duration - motions.fade, motions.fade), ease.in);

/** The transform that centers a `w` by `h` drawing inside the margins, scaled down to fit and up to at most 1.5x. */
export const fit = (w: number, h: number): string => {
  const s = Math.min(1.5, (WIDTH - 2 * MARGIN) / w, (HEIGHT - 2 * MARGIN) / h);

  return `translate(${(WIDTH - s * w) / 2} ${(HEIGHT - s * h) / 2}) scale(${s})`;
};

/** The scene title and at most one subtitle line, top left. */
export function Title({
  title,
  subtitle,
  at = motions.lead,
  family = geist,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly at?: number;
  /** The font for both lines; Geist unless a scene sets it. */
  readonly family?: FontValue;
}): SvgNode {
  return jsx("g", {
    animation: rise(at),
    fontFamily: family,
    children: [
      jsx("text", {
        x: TITLE.x,
        y: TITLE.y,
        fontSize: TITLE.size,
        fontWeight: TITLE.weight,
        fill: color.ink,
        children: title,
      }),
      subtitle
        ? jsx("text", {
            x: SUBTITLE.x,
            y: SUBTITLE.y,
            fontSize: SUBTITLE.size,
            fill: color.dim,
            children: subtitle,
          })
        : null,
    ],
  });
}
