import { compile } from "./compile";
import { num } from "./format";
import type { Seconds } from "./motion";
import { children, element, raw, serialize, type Child } from "./svg";
import { validateSvg } from "./validate";

export interface RenderOptions {
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly desc?: string;
  /** One loop in seconds. Every motion lives on this timeline, or on a loop that divides it. */
  readonly duration: Seconds;
  /** Fonts and page classes. */
  readonly css?: string;
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
  const stillAt =
    options.reducedMotion === false ? undefined : Math.max(0, Math.min(duration, options.reducedMotion?.at ?? duration * 0.85));
  const compiled = compile(children(content), { width, height, duration, stillAt });
  const css = [options.css?.trim(), compiled.css].filter(Boolean).join("\n\n");
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
