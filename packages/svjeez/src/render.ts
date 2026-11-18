import { compile } from "./compile";
import type { FontStyle, FontValue } from "./font/font";
import { RATE_ATTR } from "./rate";
import { num } from "./format";
import type { Seconds } from "./time";
import { element, raw, serialize, text, type SvgNode } from "./svg";
import { traceOf, type TimelineTrack } from "./traced";
import { validateSvg } from "./validate";

export interface RenderOptions {
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly desc?: string;
  readonly duration: Seconds;
  readonly css?: string;
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
  /**
   * Font properties on the root `<svg>`, which every text inherits unless it says otherwise: a family embeds as one
   * written on a text does. Default none.
   */
  readonly font?: RootFont;
}

export interface RootFont {
  readonly family?: FontValue;
  readonly weight?: number;
  readonly style?: FontStyle;
}

/** The SVG backend's last step: compile the emitted nodes' lanes, wrap them in the root, serialize, and validate. */
export const render = (options: RenderOptions, nodes: readonly SvgNode[]): string => {
  const { width, height, duration } = options;

  const playbackRate = options.playbackRate ?? 1;

  if (!(playbackRate > 0 && Number.isFinite(playbackRate)))
    throw new Error(`svg.emit() needs a positive, finite playbackRate, got ${playbackRate}.`);
  const prefix = options.prefix ?? "";

  if (prefix !== "" && !/^[A-Za-z][\w-]*$/.test(prefix))
    throw new Error(
      `svg.emit() needs a prefix of letters, digits, _ and -, starting with a letter, got ${JSON.stringify(prefix)}.`,
    );

  const stillAt =
    options.reducedMotion === false
      ? undefined
      : Math.max(0, Math.min(duration, options.reducedMotion?.at ?? duration * 0.85));

  const trace = traceOf();
  const timeline: TimelineTrack[] | undefined = trace?.within ? [] : undefined;

  const { css, ...compiled } = compile(
    nodes,
    { width, height, duration, playbackRate, prefix, stillAt, loop: options.loop ?? true },
    options.css,
    timeline,
    {
      ...(options.font?.family !== undefined && { "font-family": options.font.family }),
      ...(options.font?.weight !== undefined && { "font-weight": num(options.font.weight) }),
      ...(options.font?.style !== undefined && { "font-style": options.font.style }),
    },
  );

  const rootAttributes = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: `0 0 ${num(width)} ${num(height)}`,
    width: num(width),
    height: num(height),
    role: "img",
    "aria-labelledby": options.desc ? `${prefix}t ${prefix}d` : `${prefix}t`,
  };

  const rated = {
    ...rootAttributes,
    ...(playbackRate !== 1 && { [RATE_ATTR]: num(playbackRate) }),
    ...compiled.root,
  };

  const root = element("svg", prefix ? { ...rated, class: `${prefix}root` } : rated, [
    element("title", { id: `${prefix}t` }, [text(options.title)]),
    ...(options.desc ? [element("desc", { id: `${prefix}d` }, [text(options.desc)])] : []),
    ...(css ? [element("style", {}, [raw(`\n${css}\n`)])] : []),
    ...compiled.body,
  ]);

  const source = serialize(root);
  const { errors, warnings } = validateSvg(source);

  if (errors.length > 0)
    throw new Error(
      `Generated SVG is invalid:\n${errors.map((error) => `  - ${error}`).join("\n")}`,
    );

  const svg = `${source}\n`;

  trace?.onRender(svg, {
    warnings,
    duration,
    loop: options.loop ?? true,
    timeline: timeline ?? [],
  });

  return svg;
};
