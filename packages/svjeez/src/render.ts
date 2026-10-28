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
  readonly playbackRate?: number;
  /**
   * Put in front of every generated id, class, keyframe name, custom property and font family, so two scenes can share one HTML page.
   * Letters, digits, `_` and `-`, starting with a letter. Default none.
   */
  readonly prefix?: string;
  /** Freeze frame for prefers-reduced-motion. Default: 85% through. */
  readonly reducedMotion?: { readonly at: Seconds } | false;
  /** False plays the scene once and holds its last frame. Default true. */
  readonly loop?: boolean;
  /** Comment above the root element. */
  readonly comment?: string;
}

/** Compile motions and refs, serialize, and validate. Throws on invalid output. */
export const render = (options: RenderOptions, content: Child): string => {
  const { width, height, duration } = options;
  if (!(width > 0) || !(height > 0)) throw new Error(`render() needs a positive width and height, got ${width} by ${height}.`);
  if (!(duration > 0)) throw new Error(`render() needs a positive duration, got ${duration}.`);
  const playbackRate = options.playbackRate ?? 1;
  if (!(playbackRate > 0 && Number.isFinite(playbackRate))) throw new Error(`render() needs a positive, finite playbackRate, got ${playbackRate}.`);
  const prefix = options.prefix ?? "";
  if (prefix !== "" && !/^[A-Za-z][\w-]*$/.test(prefix)) throw new Error(`render() needs a prefix of letters, digits, _ and -, starting with a letter, got ${JSON.stringify(prefix)}.`);
  const stillAt =
    options.reducedMotion === false ? undefined : Math.max(0, Math.min(duration, options.reducedMotion?.at ?? duration * 0.85));
  const { css, ...compiled } = compile(children(content), { width, height, duration, playbackRate, prefix, stillAt, loop: options.loop ?? true }, options.css);
  const root = element(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${num(width)} ${num(height)}`,
      width: num(width),
      height: num(height),
      role: "img",
      "aria-labelledby": options.desc ? `${prefix}t ${prefix}d` : `${prefix}t`,
    },
    [
      element("title", { id: `${prefix}t` }, children(options.title, true)),
      ...(options.desc ? [element("desc", { id: `${prefix}d` }, children(options.desc, true))] : []),
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
