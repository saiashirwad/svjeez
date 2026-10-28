import type { Color } from "../attributes";
import { el } from "../el";
import { pathLength, type Point } from "../geometry";
import { ease, motion, type Seconds } from "../motion";
import { textWidth, type FontValue } from "../font/font";
import { draw } from "../recipes";
import type { SvgNode } from "../svg";
import { defaultDark, type Base16 } from "./theme";
import { travel } from "./timeline";

/**
 * `dot` a plain token. `comet` a bright head with a fading tail and halo. `trace` lights the path as the head runs it,
 * then lets it fade. `packet` a labelled chip, for a message with a name.
 */
export type FlowStyle = "dot" | "comet" | "trace" | "packet";

export interface FlowOptions {
  readonly at: Seconds;
  /** px/s. Default 220. Ignored when `over` is set. */
  readonly speed?: number;
  readonly over?: Seconds;
  readonly style?: FlowStyle;
  /** Default `defaultDark`; `color` defaults to its `base09`. */
  readonly theme?: Base16;
  readonly color?: Color;
  /** Head radius. Default 4.5. */
  readonly size?: number;
  /** A ring that ripples out where the trip ends. */
  readonly arrive?: boolean;
  /** The packet's text. */
  readonly label?: string;
  readonly fontSize?: number;
  /** Embedded for the packet label, which is sized by measuring it. */
  readonly font?: FontValue;
  /** Packet text color; defaults to `color`. */
  readonly ink?: Color;
  /** Packet fill. Default transparent over a solid outline. */
  readonly fill?: Color;
  readonly class?: string;
}

const TAIL = 8;
/** Px of path the comet's tail covers. */
const REACH = 36;

/** Something running `points` from `at`. `end` is when it arrives. */
export function flow(points: readonly Point[], options: FlowOptions): { readonly node: SvgNode; readonly end: Seconds } {
  const { at, speed = 220, style = "dot", theme = defaultDark, color = theme.base09, size = 4.5, arrive = false, class: cls } = options;
  const over = options.over ?? pathLength(points) / speed;
  const end = at + over;
  const lag = REACH / TAIL / (pathLength(points) / over);
  const run = (delay = 0) => travel(points, { at: at + delay, over });
  const head = el.circle({ r: size, fill: color, animation: run() });

  const body = (() => {
    switch (style) {
      case "dot":
        return head;
      case "comet":
        return [
          el.g({ opacity: 0.22 }, el.circle({ r: size * 2.4, fill: color, animation: run() })),
          Array.from({ length: TAIL }, (_, i) => {
            const k = (i + 1) / (TAIL + 1);
            return el.g({ opacity: 0.6 * (1 - k) }, el.circle({ r: size * (1 - 0.7 * k), fill: color, animation: run(lag * (i + 1)) }));
          }),
          head,
        ];
      case "trace":
        return [
          el.path({
            d: points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(""),
            fill: "none",
            stroke: color,
            strokeWidth: size * 0.6,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            animation: [motion().at(end + 0.15).to({ opacity: 0 }, 0.6), draw({ at, over }, ease.linear)],
          }),
          head,
        ];
      case "packet": {
        const text = options.label ?? "";
        const fontSize = options.fontSize ?? 11;
        const [w, h] = [textWidth(text, fontSize, options.font) + 14, fontSize + 9];
        return el.g({ animation: run() }, [
          el.rect({ x: -w / 2, y: -h / 2, width: w, height: h, rx: h / 2, fill: options.fill ?? color, fillOpacity: options.fill ? 1 : 0.18, stroke: color, strokeWidth: 1.25 }),
          el.text({ y: fontSize * 0.35, textAnchor: "middle", fontSize, fontFamily: options.font, fill: options.ink ?? color }, text),
        ]);
      }
    }
  })();

  const last = points.at(-1)!;
  const ring =
    arrive &&
    el.circle({
      cx: last.x,
      cy: last.y,
      r: size * 2,
      fill: "none",
      stroke: color,
      strokeWidth: 1.5,
      animation: motion({ opacity: 0, scale: 0.5 }).at(end).set({ opacity: 0.9 }).to({ opacity: 0, scale: 3 }, 0.7),
    });

  return { node: el.g({ class: cls }, [body, ring]), end: end + (arrive ? 0.7 : 0) };
}
