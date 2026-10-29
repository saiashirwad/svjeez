import { num } from "./format";
import { raw, type SvgNode } from "./svg";

let ambient: string | undefined;

/** The prefix `render()` falls back to while `prefixed()` runs. */
export const ambientPrefix = (): string | undefined => ambient;

/**
 * Run `build` with every `render()` inside it defaulting to `prefix`. A scene you didn't write then comes out with its
 * own ids, classes and keyframes, so `nest()` can put it inside another scene, or beside a second copy of itself.
 */
export const prefixed = <T>(prefix: string, build: () => T): T => {
  const before = ambient;
  ambient = prefix;

  try {
    return build();
  } finally {
    ambient = before;
  }
};

export interface NestOptions {
  readonly x?: number;
  readonly y?: number;
  /** Drawn size. One given derives the other from the scene's aspect; none keeps the scene's own size. */
  readonly width?: number;
  readonly height?: number;
}

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/**
 * A rendered scene drawn inline inside another, still animating. Through `<img>` or `<image>` a nested SVG freezes, so
 * this copies its markup in as a child `<svg>`. The scene must come from `render({ prefix })` or `prefixed()`, or its
 * names would collide with the scene around it.
 */
export const nest = (svg: string, { x = 0, y = 0, width, height }: NestOptions = {}): SvgNode => {
  const open = /<svg\b[^>]*>/.exec(svg);
  const close = svg.lastIndexOf("</svg>");

  if (!open || close < open.index)
    throw new Error("nest() needs a rendered SVG, got markup with no <svg> root.");

  if (/\.a\{animation-duration/.test(svg))
    throw new Error(
      'nest() needs a scene rendered with a prefix. Render it inside prefixed("…", build).',
    );

  const root = open[0];

  const box = attr(root, "viewBox")
    ?.split(/[\s,]+/)
    .map(Number);

  const own = {
    width: Number(attr(root, "width") ?? box?.[2]),
    height: Number(attr(root, "height") ?? box?.[3]),
  };

  if (!(own.width > 0 && own.height > 0))
    throw new Error("nest() needs an SVG with a width and height or a viewBox.");
  const w = width ?? (height === undefined ? own.width : (height * own.width) / own.height);
  const h = height ?? (w * own.height) / own.width;
  const viewBox = attr(root, "viewBox") ?? `0 0 ${num(own.width)} ${num(own.height)}`;
  const style = attr(root, "style");

  return raw(
    `<svg x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" viewBox="${viewBox}"${style ? ` style="${style}"` : ""}>${svg.slice(open.index + root.length, close)}</svg>`,
  );
};
