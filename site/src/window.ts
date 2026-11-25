import { createHash } from "node:crypto";
import type { SceneSource } from "@svjeez/astro/scene";
import { isScene, svg as backend } from "svjeez/tools";
import { theme } from "@examples/colors.ts";

type SceneModule = Extract<SceneSource, { readonly src: string }>;

const isText = (source: SceneSource): source is string => typeof source === "string";

const isModule = (source: SceneSource): source is SceneModule =>
  typeof source === "object" && "src" in source;

const markup = (source: SceneSource): string => {
  if (isText(source)) return source;

  if (isScene(source)) return backend.emit(source);

  if (isModule(source)) {
    if (source.svg === undefined)
      throw new Error(`windowed() got ${source.src} without its markup.`);

    return source.svg;
  }

  return markup(source());
};

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const declared = (scheme: "light" | "dark") =>
  Object.values(theme)
    .map((token) => `--${token.name}:${token[scheme]}`)
    .join(";");

const TOKENS = `svg{${declared("dark")}}@media (prefers-color-scheme:light){svg{${declared("light")}}}`;

const SANS = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif";

export interface WindowOptions {
  /** The window's size, in its own pixels. Without a height the window is as tall as the scene needs at that width. */
  readonly size: readonly [number, number?];
  /** The title bar's text. Without one the window has no bar. */
  readonly title?: string;
  /** The title bar's height. */
  readonly bar?: number;
  /** No window at all: the scene fitted into the size on a transparent canvas. */
  readonly bare?: boolean;
}

/** The scene's SVG inside a window of the given size. */
export const windowed = (
  source: SceneSource,
  { size: [w, height], title, bar = 40, bare = false }: WindowOptions,
) => {
  const inner = markup(source);
  const id = `w${createHash("sha256").update(inner).digest("hex").slice(0, 6)}`;
  const top = title === undefined || bare ? 0 : bar;

  const [, , vw = 1, vh = 1] =
    /viewBox="([^"]*)"/
      .exec(inner)?.[1]
      ?.split(/[\s,]+/)
      .map(Number) ?? [];

  const h = height ?? top + Math.round((w * vh) / vw);
  const name = /<title[^>]*>([^<]*)<\/title>/.exec(inner)?.[1] ?? "";
  const desc = /<desc[^>]*>([^<]*)<\/desc>/.exec(inner)?.[1];

  const nested = inner
    .replace(/<title[^>]*>[^<]*<\/title>\s*/, "")
    .replace(/<desc[^>]*>[^<]*<\/desc>\s*/, "")
    .replace(/<svg\b([^>]*)>/, (_, attributes: string) => {
      const kept = attributes.replace(/\s(width|height|role|aria-labelledby)="[^"]*"/g, "");

      return `<svg${kept} y="${top}" width="${w}" height="${h - top}">`;
    });

  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="${id}t${desc === undefined ? "" : ` ${id}d`}">
  <title id="${id}t">${name}</title>${desc === undefined ? "" : `\n  <desc id="${id}d">${desc}</desc>`}`;

  if (bare) return `${head}\n  ${nested}\n</svg>`;

  const middle = (text: string) =>
    `<text x="${w / 2}" y="${bar / 2 + 4.5}" font-size="12" text-anchor="middle" font-family="${SANS}" fill="var(--muted)">${escape(text)}</text>`;

  const lights = ["--red", "--yellow", "--green"]
    .map(
      (color, i) =>
        `<circle cx="${20.5 + 18 * i}" cy="${bar / 2 + 0.5}" r="5.5" fill="var(${color})"/>`,
    )
    .join("");

  return `${head}
  <style>${TOKENS}</style>
  <clipPath id="${id}c"><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="12"/></clipPath>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="12" fill="var(--background)"/>
  <g clip-path="url(#${id}c)">${nested}</g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="12" fill="none" stroke="var(--raised)"/>
  ${top ? `<path d="M0.5 ${bar + 0.5}h${w - 1}" stroke="var(--surface)"/>${lights}${middle(title!)}` : ""}
</svg>`;
};
