import { compile } from "./compile";
import { num } from "./format";
import type { Seconds } from "./motion";
import type { Css } from "./properties";
import { children, element, raw, serialize, type Child } from "./svg";
import { validateSvg } from "./validate";

export interface RenderOptions {
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly desc?: string;
  /** One loop in seconds. Every motion lives on this timeline, or on a loop that divides it. */
  readonly duration: Seconds;
  /** Fonts and page classes. Build it with `css` to read declared properties. */
  readonly css?: string | Css;
  /** Playback rate: 2 plays twice as fast. `duration` and `reducedMotion.at` stay in scene seconds. Default 1. */
  readonly speed?: number;
  /** Freeze frame for prefers-reduced-motion. Default: 85% through. */
  readonly reducedMotion?: { readonly at: Seconds } | false;
  /** Comment above the root element. */
  readonly comment?: string;
}

/** Compile motions and refs, serialize, and validate. Throws on invalid output. */
export const render = (options: RenderOptions, content: Child): string => {
  const { width, height, duration } = options;
  if (!(width > 0) || !(height > 0)) throw new Error("render() needs a positive width and height.");
  if (!(duration > 0)) throw new Error("render() needs a positive duration.");
  const speed = options.speed ?? 1;
  if (!(speed > 0 && Number.isFinite(speed))) throw new Error(`render() needs a positive, finite speed, got ${speed}.`);
  const stillAt =
    options.reducedMotion === false ? undefined : Math.max(0, Math.min(duration, options.reducedMotion?.at ?? duration * 0.85));
  const { css, ...compiled } = compile(children(content), { width, height, duration, speed, stillAt }, options.css);
  const root = element(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${num(width)} ${num(height)}`,
      width: num(width),
      height: num(height),
      role: "img",
      "aria-labelledby": options.desc ? "t d" : "t",
    },
    [
      element("title", { id: "t" }, children(options.title, true)),
      ...(options.desc ? [element("desc", { id: "d" }, children(options.desc, true))] : []),
      ...(compiled.defs.length > 0 ? [element("defs", {}, compiled.defs)] : []),
      ...(css ? [element("style", {}, [raw(`\n${css}\n`)])] : []),
      ...compiled.body,
    ],
  );
  const source = serialize(root);
  const { errors } = validateSvg(source);
  if (errors.length > 0) throw new Error(`Generated SVG is invalid:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
  return `${options.comment ? `<!-- ${options.comment} -->\n` : ""}${source}\n`;
};
