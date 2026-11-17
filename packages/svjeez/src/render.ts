import { compile } from "./compile";
import { RATE_ATTR } from "./rate";
import { num } from "./format";
import type { Seconds } from "./motion";
import type { Css } from "./properties";
import { children, element, raw, serialize, type Child } from "./svg";
import { withSources } from "./sources";
import { traceOf, type TimelineTrack } from "./traced";
import { validateSvg } from "./validate";

export interface RenderOptions {
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly desc?: string;
  readonly duration: Seconds;
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
  readonly comment?: string;
  /**
   * Write `data-source` on every element made by the development JSX runtime (`svjeez/jsx-dev-runtime`): where it was
   * written, as `file:line:column` with the parts the JSX transform reports. For tools that link a picture back to its
   * code. Default false, and the output is unchanged.
   */
  readonly sources?: boolean;
  /** Receives SVG validation warnings from this render. */
  readonly onWarning?: (warning: string) => void;
}

/** Compile motions and refs, serialize, and validate. Throws on invalid output. */
export const render = (options: RenderOptions, content: Child): string => {
  const { width, height, duration } = options;

  if (!(width > 0 && width < Infinity) || !(height > 0 && height < Infinity))
    throw new Error(`render() needs a positive width and height, got ${width} by ${height}.`);

  if (!(duration > 0 && duration < Infinity))
    throw new Error(`render() needs a positive duration, got ${duration}.`);
  const playbackRate = options.playbackRate ?? 1;

  if (!(playbackRate > 0 && Number.isFinite(playbackRate)))
    throw new Error(`render() needs a positive, finite playbackRate, got ${playbackRate}.`);
  const prefix = options.prefix ?? "";

  if (prefix !== "" && !/^[A-Za-z][\w-]*$/.test(prefix))
    throw new Error(
      `render() needs a prefix of letters, digits, _ and -, starting with a letter, got ${JSON.stringify(prefix)}.`,
    );

  if (options.reducedMotion && !Number.isFinite(options.reducedMotion.at))
    throw new Error(`render() needs a finite reducedMotion.at, got ${options.reducedMotion.at}.`);

  const stillAt =
    options.reducedMotion === false
      ? undefined
      : Math.max(0, Math.min(duration, options.reducedMotion?.at ?? duration * 0.85));

  const nodes = children(content);
  const trace = traceOf();
  const timeline: TimelineTrack[] | undefined = trace?.within ? [] : undefined;

  const { css, ...compiled } = compile(
    (options.sources ?? trace?.sources) ? nodes.map(withSources) : nodes,
    { width, height, duration, playbackRate, prefix, stillAt, loop: options.loop ?? true },
    options.css,
    timeline,
  );

  const rootAttributes = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: `0 0 ${num(width)} ${num(height)}`,
    width: num(width),
    height: num(height),
    role: "img",
    "aria-labelledby": options.desc ? `${prefix}t ${prefix}d` : `${prefix}t`,
  };

  const rated =
    playbackRate === 1 ? rootAttributes : { ...rootAttributes, [RATE_ATTR]: num(playbackRate) };

  const root = element("svg", prefix ? { ...rated, class: `${prefix}root` } : rated, [
    element("title", { id: `${prefix}t` }, children(options.title, true)),
    ...(options.desc ? [element("desc", { id: `${prefix}d` }, children(options.desc, true))] : []),
    ...(compiled.defs.length > 0 ? [element("defs", {}, compiled.defs)] : []),
    ...(css ? [element("style", {}, [raw(`\n${css}\n`)])] : []),
    ...compiled.body,
  ]);

  const source = serialize(root);
  const { errors, warnings } = validateSvg(source);

  if (errors.length > 0)
    throw new Error(
      `Generated SVG is invalid:\n${errors.map((error) => `  - ${error}`).join("\n")}`,
    );

  const { comment } = options;

  if (comment !== undefined && (comment.includes("--") || comment.endsWith("-")))
    throw new Error(
      `render() comment can't contain "--" or end in "-", since XML comments can't: got "${comment}".`,
    );

  const svg = `${comment ? `<!-- ${comment} -->\n` : ""}${source}\n`;

  if (options.onWarning) for (const warning of warnings) options.onWarning(warning);

  trace?.onRender(svg, {
    warnings,
    duration,
    loop: options.loop ?? true,
    timeline: timeline ?? [],
  });

  return svg;
};
